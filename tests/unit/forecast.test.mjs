// P0.9: γρήγοροι, ντετερμινιστικοί έλεγχοι του βαθμού (hourScore) και της ασφάλειας ωρών — χωρίς δίκτυο, χωρίς browser.
// Ελέγχουν ιδιότητες που η εφαρμογή υπόσχεται (όχι ακριβείς αριθμούς), ώστε μελλοντικές αλλαγές βαρών να μη σπάνε τα tests άσκοπα.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';

function loadPF() {
  const ctx = { self: {}, console, Date, Math, JSON, Promise, Intl, setTimeout, clearTimeout, fetch: async () => { throw new Error('no network'); } };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'forecast.js'), 'utf8'), ctx, { filename: 'forecast.js' });
  return ctx.self.PF;
}
const PF = loadPF();
/* ήλιος/σελήνη χωρίς ηλιοβασίλεμα κοντά στο μεσημέρι και χωρίς περιόδους σελήνης */
const SM = { f: 0.25, rise: 6 * 60, set: 18 * 60, maj: null, min: null };
const W = (o) => Object.assign({ wind: 6, wave: 0.3, gust: 10, ptrend: 'stable', cloud: 'part', prof: 'boat', sp: '' }, o);
const S = (o, hr = 9) => PF.hourScore(SM, hr, W(o));

test('score is always within 5..98', () => {
  for (const wind of [0, 5, 12, 20, 35, 60]) for (const wave of [0, 0.5, 1.5, 3, 6]) for (const code of [null, 95]) for (const hr of [0, 6, 12, 18, 23]) {
    const v = S({ wind, wave, code, gust: wind * 1.5 }, hr);
    assert.ok(v >= 5 && v <= 98, `wind ${wind} wave ${wave} code ${code} hr ${hr} → ${v}`);
  }
});

test('more wind and more wave never raise the score (boat, beyond the calm range)', () => {
  const winds = [12, 15, 20, 26, 35], waves = [0.5, 1, 1.5, 2, 3];
  for (let i = 1; i < winds.length; i++) assert.ok(S({ wind: winds[i] }) <= S({ wind: winds[i - 1] }), 'wind ' + winds[i]);
  for (let i = 1; i < waves.length; i++) assert.ok(S({ wave: waves[i] }) <= S({ wave: waves[i - 1] }), 'wave ' + waves[i]);
});

test('thunderstorm and strong gusts lower the score', () => {
  assert.ok(S({ code: 95 }) < S({ code: 3 }), 'thunderstorm');
  assert.ok(S({ gust: 36 }) < S({ gust: 10 }), 'gusts ≥35 kn');
});

test('bite score ignores sea state (boat profile)', () => {
  assert.equal(S({ wind: 30, wave: 3, gust: 40, bite: true }), S({ wind: 2, wave: 0.1, gust: 5, bite: true }));
});

test('dawn and dusk score higher than midday, all else equal', () => {
  const dawn = S({}, 6), noon = S({}, 12), dusk = S({}, 17);
  assert.ok(dawn > noon, `dawn ${dawn} > noon ${noon}`);
  assert.ok(dusk > noon, `dusk ${dusk} > noon ${noon}`);
});

test('profile is respected: spearfishing is much stricter with waves than shore', () => {
  const sp = S({ prof: 'spear', wave: 1.2 }), sh = S({ prof: 'shore', wave: 1.2 });
  assert.ok(sp < sh, `spear ${sp} < shore ${sh}`);
});

test('without a target species, sea temperature does not change the score', () => {
  assert.equal(S({ sst: 12 }), S({ sst: 26 }));
});

test('the edge copy of forecast.js equals forecast.js (server and app score the same)', () => {
  const fc = fs.readFileSync(path.join(ROOT, 'forecast.js'), 'utf8').trimEnd();
  for (const f of ['quick-processor-index.ts', 'watch-edge-index.ts'])
    assert.ok(fs.readFileSync(path.join(ROOT, f), 'utf8').includes(fc), f + ' must contain the current forecast.js');
});

/* ---------- παράθυρο ψαρέματος της ημέρας (getForecast) με ψεύτικο Open-Meteo και σταθερή ώρα ---------- */
function pfAt(nowIso) {
  const NOW = Date.parse(nowIso), RD = Date;
  class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
  const store = new Map();
  const ctx = { self: {}, console, Date: FD, Math, JSON, Promise, Intl, setTimeout, clearTimeout,
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'forecast.js'), 'utf8'), ctx, { filename: 'forecast.js' });
  ctx.localStorage.setItem('alkyon-fprof', 'boat');
  return ctx.self.PF;
}
function meteo(W) {
  return async (url) => {
    const u = new URL(String(url)), marine = u.hostname.startsWith('marine'), start = Date.parse('2026-11-06T00:00:00Z'), time = [];
    for (let i = 0; i < 24 * 12; i++) time.push(new Date(start + i * 3600e3).toISOString().slice(0, 16));
    const arr = f => time.map(f);
    const j = marine ? { utc_offset_seconds: 7200, timezone: 'Asia/Nicosia', hourly: { time, wave_height: arr(t => W(t).wave), wave_period: arr(() => 4), sea_surface_temperature: arr(() => 22), sea_level_height_msl: arr(() => 0) } }
      : { utc_offset_seconds: 7200, timezone: 'Asia/Nicosia', hourly: { time, pressure_msl: arr(() => 1016), wind_speed_10m: arr(t => W(t).wind), wind_gusts_10m: arr(t => W(t).wind + 4), wind_direction_10m: arr(() => 90), cloud_cover: arr(() => 20), temperature_2m: arr(() => 21), precipitation_probability: arr(() => 0), precipitation: arr(() => 0), weather_code: arr(() => 1) } };
    return { ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) };
  };
}

test('daily window: inside daylight ±1 h, every hour in it within 6 points of the best, and only safe hours', async () => {
  const PF = pfAt('2026-11-09T04:00:00Z');
  const fc = await PF.getForecast(34.66, 33.04, meteo(() => ({ wind: 6, wave: 0.3 })), { days: 3 });
  const days = fc.days.filter(d => d.safe && d.win);
  assert.ok(days.length >= 2, 'calm days have a window');
  for (const d of days) {
    const hrs = d.hours.filter(h => h.hr >= d.win.s && h.hr <= d.win.e);
    assert.ok(hrs.length >= 1);
    for (const h of hrs) assert.ok(h.score >= d.best - 6, `${d.date} ${h.hr}: ${h.score} vs best ${d.best}`);
    assert.ok(d.win.s >= 4 && d.win.e <= 20, `${d.date} window ${d.win.s}-${d.win.e} within daylight ±1 h`);
  }
});

test('a day over the safety limits (strong wind all day) is not offered as a safe window', async () => {
  const PF = pfAt('2026-11-09T04:00:00Z');
  const stormDay = '2026-11-10';
  const fc = await PF.getForecast(34.66, 33.04, meteo(t => t.startsWith(stormDay) ? { wind: 30, wave: 2.5 } : { wind: 6, wave: 0.3 }), { days: 3 });
  const d = fc.days.find(x => x.date === stormDay);
  assert.ok(d, 'storm day present');
  assert.equal(d.safe, false, 'storm day is not safe');
  const calmDay = fc.days.find(x => x.date === '2026-11-11');
  assert.ok(calmDay && calmDay.safe && calmDay.win, 'the next calm day still has a window');
});
