// Supabase Edge Function «smart-api» (αντίγραφο για αναφορά· το deploy γίνεται με το ίδιο περιεχόμενο).
// Φέρνει μετρήσεις ανέμου και ΠΙΕΣΗΣ:
//   (1) METAR αεροδρομίων Κύπρου (aviationweather.gov)
//   (2) αυτόματους σταθμούς του Τμήματος Μετεωρολογίας Κύπρου (ανοιχτά δεδομένα XML)
//   (3) 1.11.1: METAR αεροδρομίων Ελλάδας (Αιγαίο, Ιόνιο, Κρήτη), με πλαίσιο συντεταγμένων
// Λόγος: οι πηγές δεν επιτρέπουν κλήση απευθείας από browser (CORS). Επιστρέφει λίστα:
// [{id,name,lat,lon,t(ISO UTC),dir(°),spd(kn),gust(kn),pres(hPa),src}]
// Προσθήκη ?debug=1 στο URL: επιστρέφει τα ονόματα παρατηρήσεων που στέλνει το DoM και πόσοι σταθμοί ήρθαν από κάθε πηγή.
const METAR_IDS = ["LCLK", "LCPH", "LCEN", "LCRA", "LCGK"];
const GR_BBOX = "34.7,19.2,41.8,29.8";           // lat0,lon0,lat1,lon1 (aviationweather.gov)
const DOM_URLS = ["https://www.dom.org.cy/AWS/OpenData/CyDoM.xml", "http://www.dom.org.cy/AWS/OpenData/CyDoM.xml"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300",
};
const UA = { "User-Agent": "Alkyon/1.0 (fishing app)" };
const tag = (s: string, t: string) => {
  const m = s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));
  return m ? m[1].trim() : null;
};
// "2026-10-27 23:10 (Local Time)" (ώρα Κύπρου) -> ISO UTC
function cyLocalToISO(s: string | null): string | null {
  const m = s && s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const off = (t: number) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Nicosia", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(t)).reduce((a: any, x) => (a[x.type] = x.value, a), {});
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t) / 60000;
  };
  let t = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) t = Date.UTC(y, mo - 1, d, h, mi) - off(t) * 60000;
  return new Date(t).toISOString();
}
const title = (c: string) => c.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
/* πίεση σε hPa· δέχεται hPa/mb, kPa, Pa, inHg· απορρίπτει ό,τι δεν είναι λογικό για μέση στάθμη θάλασσας */
function toHpa(v: any, unit = ""): number | null {
  let x = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(x)) return null;
  const u = unit.toLowerCase();
  if (u.startsWith("kpa")) x *= 10; else if (u === "pa") x /= 100; else if (u.includes("inhg") || (x > 25 && x < 32)) x *= 33.8639;
  x = Math.round(x * 10) / 10;
  return x >= 940 && x <= 1070 ? x : null;
}
function metarRows(raw: any) {
  return (Array.isArray(raw) ? raw : []).map((m: any) => ({
    id: m.icaoId, name: m.name, lat: m.lat, lon: m.lon,
    t: m.reportTime ? new Date(String(m.reportTime).replace(" ", "T") + (String(m.reportTime).endsWith("Z") ? "" : "Z")).toISOString() : (m.obsTime ? new Date(m.obsTime * 1000).toISOString() : null),
    dir: typeof m.wdir === "number" ? m.wdir : null, spd: m.wspd, gust: m.wgst ?? null,
    pres: toHpa(m.slp ?? m.altim), src: "METAR",
  })).filter((s: any) => s.spd != null && s.t && isFinite(s.lat) && isFinite(s.lon));
}
async function metar() {
  const r = await fetch(`https://aviationweather.gov/api/data/metar?ids=${METAR_IDS.join(",")}&format=json`, { headers: UA });
  if (!r.ok) throw new Error("metar " + r.status);
  return metarRows(await r.json());
}
/* 1.11.1: Ελλάδα — όλα τα αεροδρόμια μέσα στο πλαίσιο (τα τουρκικά της ακτής φεύγουν από το πρόθεμα ICAO LT) */
async function metarGR() {
  const r = await fetch(`https://aviationweather.gov/api/data/metar?bbox=${GR_BBOX}&format=json`, { headers: UA });
  if (!r.ok) throw new Error("metar-gr " + r.status);
  return metarRows(await r.json()).filter((s: any) => /^LG/.test(String(s.id || "")));
}
const seen = new Set<string>();
async function dom() {
  let xml = "";
  for (const u of DOM_URLS) {
    try { const r = await fetch(u, { headers: UA }); if (r.ok) { xml = await r.text(); break; } } catch (_) { /* δοκίμασε το επόμενο */ }
  }
  if (!xml) throw new Error("dom fetch");
  const coords: Record<string, { lat: number; lon: number }> = {};
  const sec = xml.match(/<stations>([\s\S]*?)<\/stations>/);
  for (const m of (sec ? sec[1] : "").matchAll(/<station>([\s\S]*?)<\/station>/g)) {
    const c = tag(m[1], "station_code"), la = parseFloat(tag(m[1], "station_latitude") || ""), lo = parseFloat(tag(m[1], "station_longitude") || "");
    if (c && isFinite(la) && isFinite(lo)) coords[c] = { lat: la, lon: lo };
  }
  const out: any[] = [];
  for (const m of xml.matchAll(/<observations>([\s\S]*?)<\/observations>/g)) {
    const code = tag(m[1], "station_code"); if (!code || !coords[code]) continue;
    let spd: number | null = null, dir: number | null = null, gust: number | null = null, pres: number | null = null, presMsl = false;
    for (const o of m[1].matchAll(/<observation>([\s\S]*?)<\/observation>/g)) {
      const n = (tag(o[1], "observation_name") || "").toLowerCase(), v = parseFloat(tag(o[1], "observation_value") || ""), u = (tag(o[1], "observation_unit") || "").toLowerCase();
      seen.add(n + " [" + u + "]");
      if (!isFinite(v)) continue;
      const kn = u.startsWith("m/s") ? v * 1.94384 : u.startsWith("km") ? v / 1.852 : v;
      if (n.includes("gust")) gust = Math.round(kn * 10) / 10;
      else if (n.startsWith("wind speed") && n.includes("10m")) spd = Math.round(kn * 10) / 10;
      else if (n.startsWith("wind direction") && n.includes("10m")) dir = Math.round(v);
      else if (n.includes("pressure") && !n.includes("tendency") && !n.includes("change")) {
        const p = toHpa(v, u), msl = /sea|msl|qnh|mean/.test(n);
        if (p != null && (pres == null || (msl && !presMsl))) { pres = p; presMsl = msl; }
      }
    }
    if (spd == null) continue;
    out.push({ id: code, name: title(code), lat: coords[code].lat, lon: coords[code].lon, t: cyLocalToISO(tag(m[1], "date_time")), dir, spd, gust, pres, src: "DoM" });
  }
  return out.filter((s) => s.t);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const [a, b, c] = await Promise.allSettled([metar(), dom(), metarGR()]);
  const val = (x: any) => (x.status === "fulfilled" ? x.value : []);
  const out = [...val(a), ...val(b), ...val(c)];
  if (new URL(req.url).searchParams.get("debug") === "1") {
    return new Response(JSON.stringify({ domObservationNames: [...seen].sort(), count: out.length, cy_metar: val(a).length, cy_dom: val(b).length, gr_metar: val(c).length,
      errors: [a, b, c].map((x: any) => x.status === "rejected" ? String(x.reason) : null), withPressure: out.filter((s: any) => s.pres != null).length, sample: val(c).slice(0, 3) }), { headers: CORS });
  }
  if (!out.length) {
    return new Response(JSON.stringify({ error: [a, b, c].map((x: any) => String(x.reason || "")).join(" | ") }), { status: 502, headers: CORS });
  }
  return new Response(JSON.stringify(out), { headers: CORS });
});
