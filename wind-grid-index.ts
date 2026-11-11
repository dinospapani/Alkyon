// @ts-nocheck
// Supabase Edge Function «wind-grid» (κοινή μνήμη πλέγματος ανέμου για τον χάρτη). Αντίγραφο για αναφορά: Supabase → Edge Functions → wind-grid → Code → index.ts → Deploy.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const FRESH_MS = 60 * 60e3;
const STALE_MAX_MS = 12 * 3600e3;
const HOURS = 120; /* 5 μέρες πρόγνωση (πριν 48)· μπαίνει και στο κλειδί, ώστε να μη σερβίρονται παλιά πλέγματα 48 ωρών */
const J = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS, ...extra } });

export function plan(q) {
  const num = k => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? v : NaN; };
  let s = num('s'), n = num('n'), w = num('w'), e = num('e');
  const N = parseInt(q.get('N') || '11', 10);
  const models = String(q.get('models') || '');
  if (![s, n, w, e].every(Number.isFinite)) return { error: 'bad bounds' };
  if (!(n > s) || !(e > w)) return { error: 'bad bounds' };
  if (s < -80 || n > 80 || w < -180 || e > 180) return { error: 'outside supported area' };   /* 1.12.10: όλος ο κόσμος (πριν μόνο Ευρώπη–Μ. Ανατολή, ανατολικά του Greenwich) */
  if (!(N >= 5 && N <= 13)) return { error: 'bad N' };
  if (!/^[a-z0-9_,]{0,90}$/.test(models)) return { error: 'bad models' };
  const span = Math.max(n - s, e - w); if (span > 40) return { error: 'area too large' };   /* 1.12.10: έως 40° (πριν 14°), με βήμα 4° για μεγάλες περιοχές */
  const step = span <= 3 ? 0.5 : span <= 8 ? 1 : span <= 16 ? 2 : 4;
  const sn = Math.floor(s / step) * step, nn = Math.ceil(n / step) * step, wn = Math.floor(w / step) * step, en = Math.ceil(e / step) * step;
  const lat = [], lon = [];
  for (let k = 0; k < N; k++) { lat.push(+(sn + (nn - sn) * k / (N - 1)).toFixed(4)); lon.push(+(wn + (en - wn) * k / (N - 1)).toFixed(4)); }
  const la = [], lo = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { la.push(lat[j].toFixed(3)); lo.push(lon[i].toFixed(3)); }
  const key = [sn, nn, wn, en, N, models || 'auto', 'h' + HOURS].join('_');
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + la.join(',') + '&longitude=' + lo.join(',') +
    '&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&past_hours=1&forecast_hours=' + HOURS + '&timezone=UTC' + (models ? '&models=' + models : '');
  return { key, lat, lon, N, url };
}

export async function handle(req, env, F = fetch, now = Date.now()) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return J({ error: 'method' }, 405);
  const p = plan(new URL(req.url).searchParams);
  if (p.error) return J({ error: p.error }, 400);
  const SB = env.SUPABASE_URL, KEY = env.SERVICE_KEY;
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  const sb = async (path, opt = {}) => { const r = await F(SB + '/rest/v1/' + path, { ...opt, headers: { ...H, ...(opt.headers || {}) } }); if (!r.ok) throw new Error('db ' + r.status); const t = await r.text(); return t ? JSON.parse(t) : null; };
  let row = null;
  try { const r = await sb('wind_cache?key=eq.' + encodeURIComponent(p.key) + '&select=data,fetched_at'); row = r && r[0] || null; } catch (e) { row = null; }
  const age = row ? now - Date.parse(row.fetched_at) : Infinity;
  const out = (data, fetched, flags) => J({ lat: p.lat, lon: p.lon, N: p.N, fetched_at: fetched, ...flags, data });
  if (row && age < FRESH_MS) return out(row.data, row.fetched_at, { cached: true });
  let up = null, upStatus = 0;
  try {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 25000);
    const r = await F(p.url, { signal: ac.signal }); clearTimeout(tm); upStatus = r.status;
    if (r.ok) up = await r.json();
  } catch (e) { upStatus = upStatus || 0; }
  if (up) {
    const arr = Array.isArray(up) ? up : [up];
    if (arr.length >= p.N * p.N && arr[0].hourly) {
      const iso = new Date(now).toISOString();
      try {
        await sb('wind_cache', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: p.key, data: arr, fetched_at: iso }) });
        if (Math.random() < 0.1) await sb('wind_cache?fetched_at=lt.' + encodeURIComponent(new Date(now - STALE_MAX_MS).toISOString()), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      } catch (e) {}
      return out(arr, iso, { cached: false });
    }
  }
  if (row && age < STALE_MAX_MS) return out(row.data, row.fetched_at, { cached: true, stale: true, upstream: upStatus });
  return J({ error: 'upstream', upstream: upStatus }, upStatus === 429 ? 429 : upStatus === 400 ? 400 : 502);
}

if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve(req => handle(req, { SUPABASE_URL: Deno.env.get('SUPABASE_URL') || '', SERVICE_KEY: Deno.env.get('SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '' }));
}