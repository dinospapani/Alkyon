// Alkyon · φόρτωση του βαθμού για τα unit tests: ο νέος πυρήνας (score-config.js + score-core.js + forecast.js)
// και η «χρυσή» αναφορά (το forecast.js της 1.14.83, αυτούσιο, στο tests/unit/golden). Κάθε φόρτωση έχει δικό της περιβάλλον (vm), ψεύτικο ρολόι και localStorage.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';

export const SCORE_FILES = ['score-config.js', 'score-core.js', 'forecast.js'];
export const GOLDEN = 'tests/unit/golden/forecast-1.14.83.js';
const SRC = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function ctxOf({ now, storage, extra } = {}) {
  const RD = Date; let D = RD;
  if (now != null) { const NOW = typeof now === 'number' ? now : Date.parse(now); D = class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }; }
  const store = new Map(Object.entries(storage || {}));
  const ctx = { self: {}, console, Date: D, Math, JSON, Promise, Intl, setTimeout, clearTimeout, URL,
    fetch: async () => { throw new Error('no network'); } };
  if (storage !== null) ctx.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  Object.assign(ctx.self, extra || {});
  ctx.globalThis = ctx; vm.createContext(ctx); ctx.__store = store;
  return ctx;
}
/* ο σημερινός κώδικας. opt: {now, storage: {κλειδί: τιμή} | null (χωρίς localStorage, όπως στον server), extra: {SPKB, …}} */
export function loadNew(opt) { const ctx = ctxOf(opt); for (const f of SCORE_FILES) vm.runInContext(SRC(f), ctx, { filename: f }); return { PF: ctx.self.PF, AS: ctx.self.AlkyonScore, CFG: ctx.self.AlkyonScoreConfig, ctx }; }
/* η αναφορά: το forecast.js της 1.14.83, όπως ήταν */
export function loadOld(opt) { const ctx = ctxOf(opt); vm.runInContext(SRC(GOLDEN), ctx, { filename: GOLDEN }); return { PF: ctx.self.PF, ctx }; }
/* επαναλήψιμη «τύχη» (mulberry32), ώστε κάθε αποτυχία να αναπαράγεται */
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const pick = (r, a) => a[Math.floor(r() * a.length)];
/* αντίγραφο χωρίς πρωτότυπα άλλου περιβάλλοντος (για deepStrictEqual ανάμεσα σε δύο vm) */
export const plain = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'number' && !Number.isFinite(x) ? 'num:' + String(x) : x));

/* ψεύτικο Open-Meteo: ντετερμινιστικός καιρός 14 ημερών από έναν «σπόρο» (και τα τρία endpoints: καιρός, θάλασσα, μοντέλα) */
export function fakeMeteo(seed, { tz = 7200, zone = 'Asia/Nicosia', start = '2026-11-06T00:00', hours = 24 * 18, holes = false } = {}) {
  const t0 = Date.parse(start + ':00Z'), time = []; for (let i = 0; i < hours; i++) time.push(new Date(t0 + i * 3600e3).toISOString().slice(0, 16));
  const r = rng(seed), wave1 = [], val = (base, amp, per, noise) => time.map((_, i) => Math.round((base + amp * Math.sin(i / per) + (r() - 0.5) * noise) * 100) / 100);
  const hole = a => holes ? a.map(v => r() < 0.04 ? null : v) : a;
  const wind = val(11, 9, 7.3, 6).map(v => Math.max(0, v)), pres = val(1014, 7, 19, 1.2), cloud = val(50, 55, 11, 30).map(v => Math.max(0, Math.min(100, Math.round(v))));
  const W = { utc_offset_seconds: tz, timezone: zone, hourly: { time, pressure_msl: hole(pres), wind_speed_10m: wind, wind_gusts_10m: hole(wind.map(v => Math.round((v * 1.4 + 2) * 10) / 10)), wind_direction_10m: val(180, 170, 13, 20).map(v => ((Math.round(v) % 360) + 360) % 360),
    cloud_cover: hole(cloud), temperature_2m: val(20, 7, 3.8, 1), precipitation_probability: val(35, 45, 9, 30).map(v => Math.max(0, Math.min(100, Math.round(v)))), precipitation: val(0.1, 0.4, 5, 0.5).map(v => Math.max(0, v)),
    weather_code: time.map(() => { const x = r(); return x < 0.03 ? 95 : x < 0.2 ? 61 : x < 0.5 ? 3 : 0; }) } };
  const M = { utc_offset_seconds: tz, timezone: zone, hourly: { time, wave_height: hole(val(0.7, 0.6, 8.1, 0.3).map(v => Math.max(0, v))), wave_period: val(4.5, 1.5, 9, 0.5), wind_wave_height: val(0.4, 0.3, 8.1, 0.2).map(v => Math.max(0, v)), swell_wave_height: val(0.4, 0.3, 15, 0.1).map(v => Math.max(0, v)),
    sea_surface_temperature: hole(val(21, 3, 60, 0.2)), sea_level_height_msl: val(0, 0.12, 2, 0.01) } };
  const E = { utc_offset_seconds: tz, timezone: zone, hourly: { time, wind_speed_10m_ecmwf_ifs025: wind, wind_speed_10m_gfs_seamless: wind.map((v, i) => Math.max(0, v + 4 * Math.sin(i / 31))), wind_speed_10m_icon_seamless: wind.map((v, i) => Math.max(0, v - 5 * Math.cos(i / 23))) } };
  return async (url) => { const u = new URL(String(url)), j = u.hostname.startsWith('marine') ? M : u.searchParams.get('models') ? E : W; return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(j)), text: async () => JSON.stringify(j) }; };
}
