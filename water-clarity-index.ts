// @ts-nocheck
// Supabase Edge Function «water-clarity» (v31z531, v31z548, v31z551, 1.1.0 ρεύματα + στρώσεις χάρτη): διαφάνεια νερού από δορυφόρο για το ψαροντούφεκο.
// Πηγή: Copernicus Marine, Μεσόγειος, ημερήσιες παρατηρήσεις L3 (μόνο όπου δεν είχε σύννεφα).
// Δίνει ZSD (βάθος Secchi, m) αν υπάρχει, αλλιώς KD490 (1/m). Αν όλα είναι κενά (σύννεφα/ακτή) → {err:'cloud'} και η εφαρμογή δείχνει την εκτίμηση από τις συνθήκες.
// Κλήση: GET /functions/v1/water-clarity?lat=34.75&lon=32.40  (προσθέστε &debug=1 για να δείτε τι απάντησε ο Copernicus)
// Δεν χρειάζεται κλειδί Copernicus ούτε βάση δεδομένων.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', ...CORS } });
const BASE = 'https://wmts.marine.copernicus.eu/teroWmts';
// L3 = πραγματικές παρατηρήσεις (κενά όπου σύννεφα) · L4 = χάρτης χωρίς κενά (συμπληρωμένος) ως εφεδρεία · MY = αρχείο
const PRODUCTS = ['OCEANCOLOUR_MED_BGC_L3_NRT_009_141', 'OCEANCOLOUR_MED_BGC_L4_NRT_009_142', 'OCEANCOLOUR_MED_BGC_L3_MY_009_143'];
const Z = 10, TS = 256, DAYS_BACK = 3;
const mem = { layers: null, layersAt: 0, hits: new Map(), phyAll: null, phyAt: 0, prof: new Map(), cur: new Map(), ovl: null, ovlAt: 0, cg: new Map(), scan: new Map() };
// v31z545: θερμοκρασία σε βάθος (θερμοκλινές) από το μοντέλο Copernicus Μεσογείου: ?mode=profile&lat=&lon=
const PHY = 'MEDSEA_ANALYSISFORECAST_PHY_006_013', WANT_DEPTHS = [0, 5, 10, 15, 20, 30, 40, 50, 75, 100];
/* v1.1.0: όλα τα επίπεδα του μοντέλου Μεσογείου μία φορά (θερμοκρασία thetao, ρεύματα uo/vo) */
async function phyCaps(F, now) {
  if (mem.phyAll && now - mem.phyAt < 12 * 3600e3) return mem.phyAll;
  const r = await getText(F, BASE + '/' + PHY + '?service=WMTS&version=1.0.0&request=GetCapabilities', 25000);
  if (!r.ok) throw new Error('caps ' + r.status);
  const all = [];
  for (const blk of r.s.split(/<(?:[\w-]+:)?Layer(?:\s[^>]*)?>/i).slice(1)) {
    const id = (blk.match(/<(?:[\w-]+:)?Identifier[^>]*>\s*([^<]+?)\s*<\/(?:[\w-]+:)?Identifier>/i) || [])[1]; if (!id) continue;
    const v = id.split('/').pop().toLowerCase(); if (!['thetao', 'uo', 'vo'].includes(v)) continue;
    const el = (blk.match(/<Dimension>[\s\S]*?<ows:Identifier>elevation<\/ows:Identifier>[\s\S]*?<\/Dimension>/i) || [''])[0];
    const elev = [...el.matchAll(/<Value>([^<]+)<\/Value>/g)].map(m => m[1]).join(',').split(',').map(Number).filter(Number.isFinite);
    const tdim = (blk.match(/<(?:[\w-]+:)?Dimension[^>]*>[\s\S]*?<(?:[\w-]+:)?Identifier[^>]*>\s*time\s*<\/(?:[\w-]+:)?Identifier>[\s\S]*?<\/(?:[\w-]+:)?Dimension>/i) || [''])[0];
    all.push({ id, v, elev, hourly: /PT1H/i.test(id), daily: /P1D/i.test(id), last: lastTime(tdim) });
  }
  mem.phyAll = all; mem.phyAt = now; return all;
}
export async function phyLayer(F, now = Date.now()) {
  const all = await phyCaps(F, now);
  const c = all.filter(x => x.v === 'thetao' && x.elev.length).sort((a, b) => (a.daily ? 0 : a.hourly ? 2 : 1) - (b.daily ? 0 : b.hourly ? 2 : 1));   // ημερήσιος μέσος πρώτα
  if (!c.length) throw new Error('no thetao layer');
  return c[0];
}
async function profile(F, lat, lon, now, dbg) {
  const L = await phyLayer(F, now), day = new Date(now).toISOString().slice(0, 10);
  const pick = WANT_DEPTHS.map(d => L.elev.reduce((b, e) => Math.abs(Math.abs(e) - d) < Math.abs(Math.abs(b) - d) ? e : b, L.elev[0])).filter((e, i, a) => a.indexOf(e) === i);
  const one = async (la, lo, e, ts) => { const t = tileOf(la, lo);
    const url = BASE + '/?service=WMTS&version=1.0.0&request=GetFeatureInfo&layer=' + encodeURIComponent(L.id) + '&tilematrixset=EPSG:3857&tilematrix=' + Z + '&tilerow=' + t.row + '&tilecol=' + t.col + '&i=' + t.i + '&j=' + t.j + '&INFOFORMAT=application/json&elevation=' + e + '&time=' + day + ts;
    try { const r = await getText(F, url); let j = null; try { j = JSON.parse(r.s); } catch (_) {} const v = j ? pickNum(j) : null; if (dbg && dbg.length < 12) dbg.push({ lat: +la.toFixed(3), lon: +lo.toFixed(3), e, ts, status: r.status, v }); return v != null && v > -2 && v < 40 ? Math.round(v * 100) / 100 : null; }
    catch (err) { if (dbg && dbg.length < 12) dbg.push({ err: String(err) }); return null; } };
  /* v31z551: αν το σημείο είναι στη στεριά ή πολύ κοντά στην ακτή (κελί μοντέλου ~4 km), ψάχνει την πλησιέστερη θάλασσα έως ~10 km */
  const surf = pick[0];
  let ts = 'T00:00:00.000Z', at = null;
  const cands = [[lat, lon]].concat(ring(lat, lon, 0.04, false), ring(lat, lon, 0.09, false));
  for (const T of ['T00:00:00.000Z', 'T12:00:00.000Z']) {
    if (await one(lat, lon, surf, T) != null) { ts = T; at = [lat, lon]; break; }
  }
  if (!at) for (const T of ['T00:00:00.000Z', 'T12:00:00.000Z']) {
    const res = await Promise.all(cands.slice(1).map(([a, b]) => one(a, b, surf, T)));
    const i = res.findIndex(v => v != null); if (i >= 0) { ts = T; at = cands[i + 1]; break; }
  }
  if (!at) return { date: day, layer: L.id, prof: [] };
  const out = await Promise.all(pick.map(async e => ({ d: Math.round(Math.abs(e) * 10) / 10, t: await one(at[0], at[1], e, ts) })));
  const moved = at[0] !== lat || at[1] !== lon;
  return { date: day, layer: L.id, prof: out.filter(x => x.t != null).sort((a, b) => a.d - b.d), ...(moved ? { at: { lat: +at[0].toFixed(3), lon: +at[1].toFixed(3) } } : {}) };
}

/* v1.1.0: ρεύματα (Copernicus MEDSEA, uo = ανατολή, vo = βορράς, m/s): ?mode=current&lat=&lon=
   Επιφάνεια ανά 3 ώρες για 24 ώρες (ωριαίο επίπεδο, αν υπάρχει) και σε βάθος από τον ημερήσιο μέσο όρο. */
const CUR_DEPTHS = [0, 10, 30, 50];
function vec(u, v) { if (u == null || v == null) return null; const ms = Math.hypot(u, v); return { kn: Math.round(ms * 1.94384 * 100) / 100, dir: Math.round((Math.atan2(u, v) * 180 / Math.PI + 360) % 360) }; }
async function gfi(F, id, la, lo, extra, dbg) {
  const t = tileOf(la, lo);
  const url = BASE + '/?service=WMTS&version=1.0.0&request=GetFeatureInfo&layer=' + encodeURIComponent(id) + '&tilematrixset=EPSG:3857&tilematrix=' + Z + '&tilerow=' + t.row + '&tilecol=' + t.col + '&i=' + t.i + '&j=' + t.j + '&INFOFORMAT=application/json' + extra;
  try { const r = await getText(F, url); let j = null; try { j = JSON.parse(r.s); } catch (_) {} const v = j ? pickNum(j) : null;
    if (dbg && dbg.length < 14) dbg.push({ id: id.split('/').slice(-2).join('/'), extra, status: r.status, v, raw: v == null ? r.s.replace(/\s+/g, ' ').slice(0, 120) : undefined });
    return v != null && Math.abs(v) < 5 ? v : null; } catch (e) { if (dbg && dbg.length < 14) dbg.push({ err: String(e) }); return null; }
}
async function current(F, lat, lon, now, dbg) {
  const all = await phyCaps(F, now);
  const pick = (v, f) => all.filter(x => x.v === v && f(x))[0];
  const hu = pick('uo', x => x.hourly), hv = pick('vo', x => x.hourly), du = pick('uo', x => x.daily && x.elev.length), dv = pick('vo', x => x.daily && x.elev.length);
  if (!du && !hu) throw new Error('no uo layer');
  const day = new Date(now).toISOString().slice(0, 10), dT = 'T00:00:00.000Z';
  const near = (L, d) => L.elev.length ? L.elev.reduce((b, e) => Math.abs(Math.abs(e) - d) < Math.abs(Math.abs(b) - d) ? e : b, L.elev[0]) : null;
  const el = (L, d) => { const e = L && near(L, d); return e == null ? '' : '&elevation=' + e; };
  /* σημείο θάλασσας: το ίδιο ή το πλησιέστερο έως ~10 km (κελί μοντέλου ~4 km) */
  const base = du || hu, probe = (a, b) => gfi(F, base.id, a, b, el(base, 0) + '&time=' + day + (base.hourly ? 'T' + String(new Date(now).getUTCHours()).padStart(2, '0') + ':00:00.000Z' : dT), dbg);
  let at = null;
  if (await probe(lat, lon) != null) at = [lat, lon];
  if (!at) { const c = ring(lat, lon, 0.04, false).concat(ring(lat, lon, 0.09, false)); const r = await Promise.all(c.map(([a, b]) => probe(a, b))); const i = r.findIndex(v => v != null); if (i >= 0) at = c[i]; }
  if (!at) return { err: 'nodata' };
  const out = { date: day };
  if (hu && hv) {
    const h0 = Math.floor(now / 3600e3) * 3600e3, lastMs = hu.last ? Date.parse(hu.last) : Infinity;
    const ts = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(k => h0 + k * 3600e3).filter(t => t <= lastMs);
    const hrs = await Promise.all(ts.map(async t => { const T = '&time=' + new Date(t).toISOString().slice(0, 13) + ':00:00.000Z';
      const [u, v] = await Promise.all([gfi(F, hu.id, at[0], at[1], el(hu, 0) + T, dbg), gfi(F, hv.id, at[0], at[1], el(hv, 0) + T, dbg)]);
      const w = vec(u, v); return w ? { t: new Date(t).toISOString().slice(0, 16) + 'Z', ...w } : null; }));
    out.hrs = hrs.filter(Boolean);
  }
  if (du && dv) {
    const deep = await Promise.all(CUR_DEPTHS.map(async d => { const e = near(du, d), T = '&elevation=' + e + '&time=' + day + dT;
      const [u, v] = await Promise.all([gfi(F, du.id, at[0], at[1], T, dbg), gfi(F, dv.id, at[0], at[1], T, dbg)]);
      const w = vec(u, v); return w ? { d: Math.round(Math.abs(e)), ...w } : null; }));
    out.deep = deep.filter(Boolean).filter((x, i, a) => a.findIndex(y => y.d === x.d) === i);
  }
  out.now = (out.hrs && out.hrs[0]) || (out.deep && out.deep[0]) || null;
  if (!out.now) return { err: 'nodata' };
  if (at[0] !== lat || at[1] !== lon) out.at = { lat: +at[0].toFixed(3), lon: +at[1].toFixed(3) };
  out.src = { h: hu ? hu.id.split('/').slice(1).join('/') : null, d: du ? du.id.split('/').slice(1).join('/') : null };
  return out;
}
/* 1.2.2: ρεύματα για πολλά σημεία του χάρτη από το Copernicus Μεσογείου (επιφάνεια, τρέχουσα ώρα): ?mode=curgrid&pts=lat,lon;lat,lon…
   Το μοντέλο Μεσογείου (~4 km, με αφομοίωση μετρήσεων) είναι πιο ακριβές εδώ από το παγκόσμιο του Open-Meteo (~8 km).
   null για σημεία χωρίς τιμή (στεριά / εκτός μοντέλου): ο χάρτης τότε δείχνει το Open-Meteo. */
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = null; } } }));
  return out; }
async function curGrid(F, pts, now, dbg) {
  const all = await phyCaps(F, now);
  const hu = all.filter(x => x.v === 'uo' && x.hourly)[0], hv = all.filter(x => x.v === 'vo' && x.hourly)[0];
  const du = all.filter(x => x.v === 'uo' && x.daily && x.elev.length)[0], dv = all.filter(x => x.v === 'vo' && x.daily && x.elev.length)[0];
  const U = hu && hv ? [hu, hv] : du && dv ? [du, dv] : null; if (!U) throw new Error('no uo/vo');
  const near0 = (L) => L.elev.length ? '&elevation=' + L.elev.reduce((b, e) => Math.abs(e) < Math.abs(b) ? e : b, L.elev[0]) : '';
  const hr = new Date(Math.floor(now / 3600e3) * 3600e3).toISOString().slice(0, 13) + ':00:00.000Z', T = U[0].hourly ? '&time=' + hr : '&time=' + new Date(now).toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const res = await pool(pts, 12, async ([la, lo]) => { const ck = 'g' + la.toFixed(3) + ',' + lo.toFixed(3) + T, c = mem.cg.get(ck); if (c && now - c.at < 3 * 3600e3) return c.v;
    const [u, v] = await Promise.all([gfi(F, U[0].id, la, lo, near0(U[0]) + T, dbg), gfi(F, U[1].id, la, lo, near0(U[1]) + T, dbg)]);
    const w = vec(u, v); mem.cg.set(ck, { at: now, v: w }); if (mem.cg.size > 5000) mem.cg.clear(); return w; });
  return { src: 'copernicus', model: U[0].id.split('/')[0], t: hr, pts: res };
}

/* 1.2.2: «Καλύτερο σημείο»: σάρωση πλέγματος σημείων θάλασσας γύρω από ένα κέντρο: ?mode=scan&lat=&lon=&r=km
   Για κάθε σημείο: άνεμος/ριπή/κύμα (μέγιστα στις ώρες της μέρας 06–18, σήμερα και αύριο), θερμοκρασία επιφάνειας, ρεύμα (Open-Meteo, ένα αίτημα για όλα),
   χλωροφύλλη (Copernicus, δορυφόρος L4). Τη βαθμολογία (μαζί με βάθος, κλίση βυθού, μέτωπα και τα ψάρια του χρήστη) την κάνει η εφαρμογή. */
async function scan(F, lat, lon, r, now, dbg) {
  r = Math.max(5, Math.min(60, r || 20)); const sp = r / 4.5, dLa = sp / 111, dLo = dLa / Math.cos(lat * Math.PI / 180), pts = [];
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) { const la = lat + i * dLa, lo = lon + j * dLo, km = Math.hypot(i * sp, j * sp); if (km <= r * 1.05) pts.push([Math.round(la * 1e4) / 1e4, Math.round(lo * 1e4) / 1e4]); }
  const la = pts.map(p => p[0]).join(','), lo = pts.map(p => p[1]).join(',');
  const [mr, wr] = await Promise.all([
    getText(F, 'https://marine-api.open-meteo.com/v1/marine?latitude=' + la + '&longitude=' + lo + '&hourly=wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction&forecast_days=2&timezone=auto&cell_selection=sea', 25000),
    getText(F, 'https://api.open-meteo.com/v1/forecast?latitude=' + la + '&longitude=' + lo + '&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kn&forecast_days=2&timezone=auto', 25000)]);
  if (!mr.ok || !wr.ok) throw new Error('open-meteo ' + mr.status + '/' + wr.status);
  let M = JSON.parse(mr.s), W = JSON.parse(wr.s); if (!Array.isArray(M)) M = [M]; if (!Array.isArray(W)) W = [W];
  const mx = (a) => { const v = a.filter(x => typeof x === 'number'); return v.length ? Math.max(...v) : null; }, av = (a) => { const v = a.filter(x => typeof x === 'number'); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
  const r1 = (x, k = 10) => x == null ? null : Math.round(x * k) / k;
  const nowLocal = M[0] && M[0].utc_offset_seconds != null ? new Date(now + M[0].utc_offset_seconds * 1000).toISOString().slice(0, 13) : null;
  let ov = null; try { ov = await overlays(F, now, null); } catch (e) {}
  const chl = ov && ov.chl ? await pool(pts, 12, ([a, b]) => sample(F, ov.chl.layer, a, b, ov.chl.day, dbg)) : pts.map(() => null);
  const out = pts.map((p, k) => { const m = M[k] && M[k].hourly, w = W[k] && W[k].hourly; if (!m || !w) return null;
    const T = m.time || [], days = [];
    for (const dd of [0, 1]) { const date = (T[0] || '').slice(0, 10), d0 = new Date(date + 'T12:00:00Z'); d0.setUTCDate(d0.getUTCDate() + dd); const ds = d0.toISOString().slice(0, 10);
      const idx = T.map((t, i) => ({ t, i })).filter(x => x.t.slice(0, 10) === ds && +x.t.slice(11, 13) >= 6 && +x.t.slice(11, 13) <= 18).map(x => x.i);
      days.push({ date: ds, w: r1(mx(idx.map(i => w.wind_speed_10m[i]))), g: r1(mx(idx.map(i => w.wind_gusts_10m[i]))), v: r1(mx(idx.map(i => m.wave_height[i])), 100) }); }
    const ih = nowLocal ? T.indexOf(nowLocal + ':00') : 0, i0 = ih >= 0 ? ih : 0;
    const ck = m.ocean_current_velocity && m.ocean_current_velocity[i0] != null ? m.ocean_current_velocity[i0] / 1.852 : null;
    return { la: p[0], lo: p[1], sst: r1(av((m.sea_surface_temperature || []).slice(0, 24))), ck: r1(ck, 100), cd: m.ocean_current_direction ? m.ocean_current_direction[i0] : null, chl: chl[k] != null ? Math.round(chl[k] * 1000) / 1000 : null, d: days }; });
  return { lat, lon, r, sp: Math.round(sp * 10) / 10, chlDay: ov && ov.chl ? ov.chl.day : null, pts: out.filter(Boolean) };
}

/* v1.1.0: στρώσεις χάρτη (χλωροφύλλη, θερμοκρασία επιφάνειας από δορυφόρο): ?mode=layers
   Επιστρέφει έτοιμες διευθύνσεις πλακιδίων WMTS (EPSG:3857) με την πιο πρόσφατη μέρα. Τα πλακίδια τα φορτώνει ο browser απευθείας. */
const OVL = { chl: ['OCEANCOLOUR_MED_BGC_L4_NRT_009_142', 'OCEANCOLOUR_MED_BGC_L3_NRT_009_141'], sst: ['SST_MED_SST_L4_NRT_OBSERVATIONS_010_004', 'SST_MED_PHY_SUBSKIN_L4_NRT_010_036'] };
function capsLayers(xml) {
  const out = [];
  for (const blk of xml.split(/<(?:[\w-]+:)?Layer(?:\s[^>]*)?>/i).slice(1)) {
    const id = (blk.match(/<(?:[\w-]+:)?Identifier[^>]*>\s*([^<]+?)\s*<\/(?:[\w-]+:)?Identifier>/i) || [])[1]; if (!id) continue;
    const tdim = (blk.match(/<(?:[\w-]+:)?Dimension[^>]*>[\s\S]*?<(?:[\w-]+:)?Identifier[^>]*>\s*time\s*<\/(?:[\w-]+:)?Identifier>[\s\S]*?<\/(?:[\w-]+:)?Dimension>/i) || [''])[0];
    const styles = [...blk.matchAll(/<(?:[\w-]+:)?Style([^>]*)>[\s\S]*?<(?:[\w-]+:)?Identifier[^>]*>\s*([^<]+?)\s*<\/(?:[\w-]+:)?Identifier>/gi)].map(m => ({ id: m[2], def: /isDefault\s*=\s*"true"/i.test(m[1]) }));
    out.push({ id, last: lastTime(tdim), style: (styles.find(x => x.def) || styles[0] || {}).id || '' });
  }
  return out;
}
async function overlays(F, now, dbg) {
  if (mem.ovl && now - mem.ovlAt < 6 * 3600e3) return mem.ovl;
  const res = {};
  for (const [k, prods] of Object.entries(OVL)) {
    for (const P of prods) {
      try { const r = await getText(F, BASE + '/' + P + '?service=WMTS&version=1.0.0&request=GetCapabilities', 20000);
        if (!r.ok) { if (dbg) dbg.push({ P, status: r.status }); continue; }
        const L = capsLayers(r.s).filter(x => !/P1M/i.test(x.id));
        const want = k === 'chl' ? (x => x.id.split('/').pop().toUpperCase() === 'CHL') : (x => /^analysed_sst$/i.test(x.id.split('/').pop()));
        const c = L.filter(want).sort((a, b) => (/gapfree|L4/i.test(b.id) ? 1 : 0) - (/gapfree|L4/i.test(a.id) ? 1 : 0));
        if (dbg) dbg.push({ P, status: r.status, n: L.length, ids: L.slice(0, 12).map(x => x.id.split('/').slice(1).join('/')) });
        if (!c.length) continue;
        const ly = c[0], day = (ly.last || new Date(now - 864e5).toISOString()).slice(0, 10);
        const tu = (st: string) => BASE + '?service=WMTS&request=GetTile&version=1.0.0&layer=' + encodeURIComponent(ly.id) + '&style=' + encodeURIComponent(st) + '&tilematrixset=EPSG:3857&tilematrix={z}&tilerow={y}&tilecol={x}&format=image/png&time=' + day + 'T00:00:00.000Z';
        /* 1.2.2: η προεπιλεγμένη κλίμακα χρωμάτων είναι για όλο τον κόσμο, οπότε η ανατολική Μεσόγειος (πολύ φτωχή σε χλωροφύλλη, θερμοκρασία σε στενό εύρος)
           βγαίνει παντού στο ίδιο χρώμα. url2 = στενή κλίμακα (Copernicus dynamic style): χλωροφύλλη 0.02–1 mg/m³ λογαριθμικά, θερμοκρασία ανά μήνα (σε K).
           Αν το url2 δεν δουλέψει, ο χάρτης γυρίζει στο url. */
        const mo = +day.slice(5, 7), SR: Record<number, [number, number]> = { 1: [15, 20], 2: [14, 19], 3: [14, 20], 4: [16, 22], 5: [18, 25], 6: [21, 28], 7: [24, 30], 8: [25, 31], 9: [24, 30], 10: [22, 28], 11: [19, 26], 12: [17, 22] };
        const sr = SR[mo] || [15, 30];
        const st2 = k === 'chl' ? 'cmap:algae,range:0.02/1,logScale' : 'cmap:thermal,range:' + (sr[0] + 273.15).toFixed(2) + '/' + (sr[1] + 273.15).toFixed(2);
        res[k] = { day, layer: ly.id, url: tu(ly.style), url2: tu(st2), range: k === 'chl' ? [0.02, 1] : sr };
        break;
      } catch (e) { if (dbg) dbg.push({ P, err: String(e) }); }
    }
  }
  if (res.chl || res.sst) { mem.ovl = res; mem.ovlAt = now; }
  return res;
}

async function getText(F, url, ms = 12000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await F(url, { signal: ac.signal }); const s = await r.text(); return { ok: r.ok, status: r.status, s }; } finally { clearTimeout(t); }
}
/* χρόνος: λίστα ημερομηνιών ή διάστημα «αρχή/τέλος/P1D» → η τελευταία ημερομηνία */
function lastTime(dim) {
  const vals = [...dim.matchAll(/<Value>([^<]+)<\/Value>/g)].map(m => m[1].trim()).join(',').split(',').map(x => x.trim()).filter(Boolean);
  let best = null;
  for (const v of vals) { const end = v.includes('/') ? v.split('/')[1] : v; if (!best || end > best) best = end; }
  const d = dim.match(/<Default>([^<]+)<\/Default>/);
  return best || (d ? d[1].trim() : null);
}
/* βρίσκει τα επίπεδα διαφάνειας (ZSD πρώτα, μετά KD490) από το GetCapabilities.
   v31z548: ανεκτικό στη μορφή (namespaces, πεζά/κεφαλαία, επιπλέον κατάληξη) και κρατά διαγνωστικά για το debug. */
export function varOf(id) {
  /* μόνο το ίδιο το μέγεθος· όχι τα βοηθητικά QI_KD490, KD490_count, KD490_error */
  const v = (id.split('/').pop() || '').trim().toUpperCase();
  return v === 'ZSD' || v === 'KD490' ? v : null;
}
export function parseCaps(xml, P) {
  const out = [], ids = [];
  for (const blk of xml.split(/<(?:[\w-]+:)?Layer(?:\s[^>]*)?>/i).slice(1)) {
    const id = (blk.match(/<(?:[\w-]+:)?Identifier[^>]*>\s*([^<]+?)\s*<\/(?:[\w-]+:)?Identifier>/i) || [])[1]; if (!id) continue;
    ids.push(id); const v = varOf(id); if (!v) continue;
    const dim = (blk.match(/<(?:[\w-]+:)?Dimension[^>]*>[\s\S]*?<(?:[\w-]+:)?Identifier[^>]*>\s*time\s*<\/(?:[\w-]+:)?Identifier>[\s\S]*?<\/(?:[\w-]+:)?Dimension>/i) || [''])[0];
    const multi = /multi/i.test(id) ? 0 : 1, l4 = /L4/.test(P) ? 20 : /_MY_/.test(P) ? 40 : 0;   // πρώτα L3 NRT, μετά L4, μετά αρχείο
    out.push({ id, v, last: lastTime(dim), rank: l4 + (v === 'ZSD' ? 0 : 10) + multi });
  }
  return { out, ids };
}
export async function layers(F, now = Date.now()) {
  if (mem.layers && mem.layers.length && now - mem.layersAt < 6 * 3600e3) return mem.layers;
  const out = [], diag = [];
  for (const P of PRODUCTS) {
    try {
      const r = await getText(F, BASE + '/' + P + '?service=WMTS&version=1.0.0&request=GetCapabilities', 20000);
      if (!r.ok) { diag.push({ P, status: r.status, head: r.s.slice(0, 300) }); continue; }
      const c = parseCaps(r.s, P); out.push(...c.out);
      diag.push({ P, status: r.status, len: r.s.length, found: c.out.length, ids: c.ids.slice(0, 25), head: c.ids.length ? undefined : r.s.slice(0, 400) });
    } catch (e) { diag.push({ P, err: String(e) }); }
  }
  out.sort((a, b) => a.rank - b.rank);
  mem.capsDiag = diag; mem.layers = out; mem.layersAt = now; return out;
}
/* σημείο → πλακίδιο EPSG:3857 και εικονοστοιχείο */
export function tileOf(lat, lon, z = Z) {
  const n = 2 ** z, x = (lon + 180) / 360 * n, s = Math.sin(lat * Math.PI / 180), y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  const col = Math.floor(x), row = Math.floor(y);
  return { col, row, i: Math.min(TS - 1, Math.floor((x - col) * TS)), j: Math.min(TS - 1, Math.floor((y - row) * TS)) };
}
/* πρώτος πεπερασμένος αριθμός μέσα στην απάντηση JSON (η μορφή του Copernicus μπορεί να αλλάξει) */
export function pickNum(o) {
  /* v31z551: πρώτα το features[].properties.value (μορφή Copernicus)· null = δεν υπάρχει μέτρηση (σύννεφα/ακτή).
     Ποτέ συντεταγμένες: παλιά έπαιρνε κατά λάθος το γεωγραφικό πλάτος όταν η τιμή ήταν null. */
  if (o == null) return null;
  if (typeof o === 'number') return Number.isFinite(o) ? o : null;
  if (typeof o === 'string') return null;
  if (Array.isArray(o)) { for (const x of o) { const v = pickNum(x); if (v != null) return v; } return null; }
  if (Array.isArray(o.features)) { for (const f of o.features) { const p = f && f.properties; if (p && 'value' in p) { const v = p.value; if (typeof v === 'number' && Number.isFinite(v)) return v; if (Array.isArray(v)) { const n = v.find(x => typeof x === 'number' && Number.isFinite(x)); if (n != null) return n; } } } return null; }
  if (o.properties && 'value' in o.properties) return pickNum(o.properties.value);
  if ('value' in o) return pickNum(o.value);
  for (const k of ['values', 'data']) if (k in o) { const v = pickNum(o[k]); if (v != null) return v; }
  return null;
}
async function sample(F, layer, lat, lon, day, dbg) {
  const t = tileOf(lat, lon);
  const url = BASE + '/?service=WMTS&version=1.0.0&request=GetFeatureInfo&layer=' + encodeURIComponent(layer) +
    '&tilematrixset=EPSG:3857&tilematrix=' + Z + '&tilerow=' + t.row + '&tilecol=' + t.col + '&i=' + t.i + '&j=' + t.j +
    '&INFOFORMAT=application/json&time=' + day + 'T00:00:00.000Z';
  try {
    const r = await getText(F, url);
    let j = null; try { j = JSON.parse(r.s); } catch (_) {}
    const v = j ? pickNum(j) : null;
    if (dbg && dbg.length < 12) dbg.push({ day, lat: +lat.toFixed(3), lon: +lon.toFixed(3), status: r.status, v, raw: v == null ? r.s.replace(/\s+/g, ' ').slice(0, 160) : undefined });
    return v != null && v > 0 && v < 200 ? v : null;   // το εύρος ανά μέγεθος ελέγχεται στο handle
  } catch (e) { if (dbg) dbg.push({ url, err: String(e) }); return null; }
}
/* το σημείο και 8 γύρω του (~1,5 km): κοντά στην ακτή το κεντρικό είναι συχνά κενό */
function ring(lat, lon, d = 0.014, center = true) {
  const dl = d / Math.cos(lat * Math.PI / 180), pts = center ? [[lat, lon]] : [];
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) pts.push([lat + a * d, lon + b * dl]);
  return pts;
}
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export async function handle(req, F = fetch, now = Date.now()) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return J({ error: 'method' }, 405);
  const q = new URL(req.url).searchParams, lat = parseFloat(q.get('lat')), lon = parseFloat(q.get('lon')), debug = q.get('debug') === '1';
  if (q.get('mode') === 'layers') { const dbg = debug ? [] : null; try { const v = await overlays(F, now, dbg); return J(debug ? { ...v, debug: dbg } : v); } catch (e) { return J({ err: 'layers', error: String(e) }, 502); } }
  if (q.get('mode') === 'curgrid') {
    const pts = String(q.get('pts') || '').split(';').map(x => x.split(',').map(Number)).filter(x => x.length === 2 && x.every(Number.isFinite) && x[0] > 30 && x[0] < 46.5 && x[1] > -6 && x[1] < 37).slice(0, 30);
    if (!pts.length) return J({ err: 'area', pts: [] });
    const dbg = debug ? [] : null;
    try { const v = await curGrid(F, pts, now, dbg); return J(debug ? { ...v, debug: dbg } : v); } catch (e) { return J({ err: 'curgrid', error: String(e), ...(debug ? { debug: dbg } : {}) }, 502); }
  }
  if (q.get('mode') === 'scan') {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return J({ error: 'bad lat/lon' }, 400);
    const r = parseFloat(q.get('r') || '20'), sk = 's' + lat.toFixed(2) + ',' + lon.toFixed(2) + ',' + Math.round(r), sh = mem.scan.get(sk);
    if (!debug && sh && now - sh.at < 2 * 3600e3) return J({ ...sh.v, cached: true });
    const dbg = debug ? [] : null;
    try { const v = await scan(F, lat, lon, r, now, dbg); mem.scan.set(sk, { at: now, v }); if (mem.scan.size > 200) mem.scan.clear(); return J(debug ? { ...v, debug: dbg } : v); }
    catch (e) { return J({ err: 'scan', error: String(e), ...(debug ? { debug: dbg } : {}) }, 502); }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return J({ error: 'bad lat/lon' }, 400);
  if (lat < 30 || lat > 46.5 || lon < -6 || lon > 37) return J({ err: 'area', error: 'outside the Mediterranean' });
  if (q.get('mode') === 'current') {
    const ck = 'c' + lat.toFixed(2) + ',' + lon.toFixed(2), ch = mem.cur.get(ck);
    if (!debug && ch && now - ch.at < 2 * 3600e3) return J({ ...ch.v, cached: true });
    const dbg = debug ? [] : null;
    try { const v = await current(F, lat, lon, now, dbg); if (!v.err) { mem.cur.set(ck, { at: now, v }); if (mem.cur.size > 400) mem.cur.clear(); } return J(debug ? { ...v, debug: dbg } : v); }
    catch (e) { return J({ err: 'current', error: String(e), ...(debug ? { debug: dbg } : {}) }, 502); }
  }
  if (q.get('mode') === 'profile') {
    const pk = 'p' + lat.toFixed(2) + ',' + lon.toFixed(2), ph = mem.prof.get(pk);
    if (!debug && ph && now - ph.at < 6 * 3600e3) return J({ ...ph.v, cached: true });
    const dbg = debug ? [] : null;
    try { const v = await profile(F, lat, lon, now, dbg); if (!v.prof.length) return J({ err: 'nodata', layer: v.layer, ...(debug ? { debug: dbg } : {}) }); mem.prof.set(pk, { at: now, v }); return J(debug ? { ...v, debug: dbg } : v); }
    catch (e) { return J({ err: 'profile', error: String(e), ...(debug ? { debug: dbg } : {}) }, 502); }
  }
  const key = lat.toFixed(2) + ',' + lon.toFixed(2), hit = mem.hits.get(key);
  if (!debug && hit && now - hit.at < 3 * 3600e3) return J({ ...hit.v, cached: true });
  const dbg = debug ? [] : null;
  let L = [];
  try { L = await layers(F, now); } catch (e) { return J({ err: 'caps', error: String(e) }, 502); }
  if (!L.length) return J({ err: 'nolayer', error: 'no ZSD/KD490 layer found in GetCapabilities', caps: mem.capsDiag }, 502);
  // ως 2 επίπεδα από τις L3 παρατηρήσεις και μετά το καλύτερο L4 (χωρίς κενά από σύννεφα)
  /* μόνο ημερήσια επίπεδα (P1D)· τα μηνιαία (P1M) είναι μέσος όρος μήνα και δεν λένε τίποτα για σήμερα */
  const daily = L.filter(x => !/P1M/i.test(x.id));
  const l3 = daily.filter(x => !/L4|_MY_/.test(x.id) && x.rank < 20).slice(0, 2), l4 = daily.filter(x => x.rank >= 20 && x.rank < 40).slice(0, 1);
  const TRY = [...new Map(((l3.length || l4.length) ? [...l3, ...l4] : daily.slice(0, 2)).map(x => [x.id, x])).values()];
  for (const ly of TRY) {
    const last = (ly.last || new Date(now - 864e5).toISOString()).slice(0, 10);
    for (let k = 0; k < DAYS_BACK; k++) {
      const day = new Date(Date.parse(last) - k * 864e5).toISOString().slice(0, 10);
      const ok = ly.v === 'ZSD' ? (v => v >= 0.2 && v <= 60) : (v => v >= 0.015 && v <= 6);   // ρεαλιστικά όρια: Secchi 0,2–60 m, KD490 0,015–6 /m
      let vals = (await Promise.all(ring(lat, lon).map(([a, b]) => sample(F, ly.id, a, b, day, dbg)))).filter(v => v != null && ok(v));
      /* κοντά στην ακτή: αν δεν βρεθεί τίποτα σε ~1,5 km, ψάχνει και σε ~3 km */
      if (!vals.length) vals = (await Promise.all(ring(lat, lon, 0.03, false).map(([a, b]) => sample(F, ly.id, a, b, day, dbg)))).filter(v => v != null && ok(v));
      if (vals.length) {
        const m = median(vals), v = { date: day, layer: ly.id, n: vals.length, ...(ly.rank >= 20 ? { filled: true } : {}) };
        if (ly.v === 'ZSD') { v.zsd = Math.round(m * 10) / 10; v.kd490 = Math.round(1.5 / m * 1000) / 1000; } else { v.kd490 = Math.round(m * 1000) / 1000; v.zsd = Math.round(1.5 / m * 10) / 10; }
        mem.hits.set(key, { at: now, v });
        return J(debug ? { ...v, tried: TRY.map(x => x.id.split('/').slice(1).join('/')), debug: dbg } : v);
      }
    }
  }
  const v = { err: 'cloud', checked: TRY.map(x => x.id + ' ≤' + x.last) };
  mem.hits.set(key, { at: now, v });
  return J(debug ? { ...v, tried: TRY.map(x => x.id.split('/').slice(1).join('/')), debug: dbg } : v);
}

if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(req => handle(req));
