/* 21/11/2026 · gear-findings: ψάρια από παθητικά εργαλεία (δίχτυ, παραγάδι, ζεμπίλι/παγίδα) ΔΕΝ μπαίνουν στα «πότε τσιμπάνε».
   Η ώρα τους είναι η ώρα ανάσυρσης, όχι η ώρα που πιάστηκαν. Το test τρέχει το πραγματικό νυχτερινό job (safety-job.mjs, run) με ψεύτικα δεδομένα:
   - με παθητικά ψάρια όλα την αυγή, τα ευρήματα πρέπει να είναι ΑΚΡΙΒΩΣ ίδια με το ίδιο σύνολο χωρίς αυτά (εκτός από τον μετρητή gearOut),
   - με την παλιά συμπεριφορά (τα ίδια ψάρια χωρίς τεχνική εργαλείου) τα ευρήματα αλλάζουν: το test πιάνει την επιστροφή του σφάλματος,
   - το «Τι πιάνεται τώρα» (trend:*) κρατά τα είδη από παθητικά εργαλεία, όπως πριν. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.mjs';

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('passive-gear catches stay out of the bite-time findings, and only out of those', async () => {
  const RealDate = Date, NOW = RealDate.parse('2026-11-19T10:00:00Z'), HR = 3600000;
  class FD extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } } globalThis.Date = FD;
  try {
    const g = {}; for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', rd(f))(g);
    const { run } = await import(pathToFileURL(path.join(ROOT, 'safety-job.mjs')).href + '?gear');
    /* 60 έξοδοι με καλάμι (τυχαίες ώρες), και 30 ψάρια από δίχτυ / παραγάδι / ζεμπίλι 3 ψαράδων τον τελευταίο μήνα, γραμμένα στην ανάσυρση την αυγή (05:30 UTC+2) */
    const build = (gearTech) => { let s = 4242, id = 1; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; const rows = [], D0 = RealDate.parse('2026-10-20T00:00:00Z');
      for (let i = 0; i < 60; i++) { const u = 'u' + (i % 5), st = D0 + i * 11 * HR + 4 * HR, dur = 5 * HR, e = [];
        for (let t = st; t < st + dur; t += HR) e.push({ t, wind: 6 + (i % 3) * 4, gust: 10, wave: 0.3 + (i % 4) * 0.2, press: 1012 + (i % 5), pt: (i % 3) - 1, rain: 0, cloud: 30, temp: 22, sst: 23, tide: 0 });
        const day = new RealDate(st).toISOString().slice(0, 10), lat = 34.7, lon = 32.4, fish = rnd() < 0.6 ? 1 + Math.floor(rnd() * 2) : 0;
        rows.push({ id: id++, user_id: u, kind: 'trip', sp: null, day, ms: st, ms2: st + dur, lat, lon, cnt: fish, tech: null, prof: 'boat', cond: { e, k: 'l' } });
        for (let k = 0; k < fish; k++) { const ms = st + Math.floor(rnd() * dur);
          rows.push({ id: id++, user_id: u, kind: 'catch', sp: 'dentex dentex', day, ms, ms2: null, lat, lon, cnt: 1, tech: 'βυθού', prof: 'boat', cond: { e: e[Math.floor((ms - st) / HR)] || e[0], k: 'l' } }); } }
      for (let i = 0; i < 30; i++) { const day0 = RealDate.parse('2026-11-19T00:00:00Z') - (30 - i) * 24 * HR, ms = day0 + 3.5 * HR, day = new RealDate(ms).toISOString().slice(0, 10), tech = gearTech[i % gearTech.length];
        const f = { t: Math.round(ms / HR) * HR, wind: 4, gust: 6, wave: 0.2, press: 1016, pt: 0, rain: 0, cloud: 10, temp: 18, sst: 22, tide: 0 };
        if (tech !== undefined) rows.push({ id: id++, user_id: 'netter' + (i % 3), kind: 'catch', sp: 'mullus surmuletus', day, ms, ms2: null, lat: 34.7, lon: 32.4, cnt: 3, tech, prof: 'boat', cond: { e: f, k: 'l' } }); }
      return rows; };
    const job = async rows => { const posts = {}, res = (o, stc = 200) => ({ ok: stc < 400, status: stc, json: async () => o, text: async () => (o == null ? '' : JSON.stringify(o)), headers: new Map() });
      const F = async (url, opt = {}) => { url = String(url); const m = (opt.method || 'GET').toUpperCase();
        if (url.includes('/rest/v1/catch_obs') && m === 'GET') { const off = +(/offset=(\d+)/.exec(url) || [0, 0])[1]; return res(rows.slice(off, off + 1000)); }
        if (m !== 'GET') { const t = /\/rest\/v1\/(\w+)/.exec(url); if (t && opt.body) { try { (posts[t[1]] = posts[t[1]] || []).push(JSON.parse(opt.body)); } catch (e) { } } return res(m === 'POST' && /rpc\//.test(url) ? true : null); }
        if (url.includes('open-meteo')) return res({ error: true }, 500); return res([]); };
      await run({ env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' }, fetch: F, PF: g.PF, webpush: null, sendMail: null, log: () => { } });
      const bs = (posts.bite_stats || []).flat().filter(x => x && x.key), stat = Object.fromEntries(bs.filter(x => !/^trend:/.test(x.key)).map(x => [x.key, x]));
      return { stat, trend: bs.filter(x => /^trend:/.test(x.key)), pers: (posts.user_bite_stats || []).flat() }; };
    const strip = S => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(S).map(([k, v]) => { const d = Object.assign({}, v.data); delete d.gearOut; return [k, { n: v.n, users: v.users, data: d }]; }))));

    const GEAR = ['Δίχτυ', 'Παραγάδι', 'Ζεμπίλι / παγίδα', 'Net', 'Longline', 'Trap / pot'];   // ακριβώς όπως τα γράφει το gear-view.js (TYPES), και στις δύο γλώσσες
    const withGear = await job(build(GEAR)), none = await job(build([undefined])), oldWay = await job(build(['βυθού']));
    assert.ok(withGear.stat.all, 'the general statistics exist');
    assert.equal(withGear.stat.all.data.gearOut, 30, 'all 30 passive-gear catches were left out');
    assert.equal(none.stat.all.data.gearOut, 0);
    assert.deepEqual(strip(withGear.stat), strip(none.stat), 'findings are exactly those of the same data without the passive-gear catches');
    assert.notDeepEqual(strip(oldWay.stat), strip(none.stat), 'the same catches counted as rod catches (the old behaviour) change the findings — so this test catches a regression');
    assert.ok(oldWay.stat.all.n > none.stat.all.n, 'and inflate the catch count: ' + oldWay.stat.all.n + ' vs ' + none.stat.all.n);
    /* προσωπικά ευρήματα: ο χρήστης με μόνο δίχτυα δεν παίρνει «πότε τσιμπάνε» από τις ανασύρσεις */
    assert.ok(!withGear.pers.some(p => /^netter/.test(p.user_id)), 'no personal bite-time findings from hauls');
    assert.ok(oldWay.pers.some(p => /^netter/.test(p.user_id)), '(with the old behaviour the netters got personal findings)');
    /* «Τι πιάνεται τώρα»: τα είδη από παθητικά εργαλεία μένουν (δείχνει τι πιάνεται, όχι πότε τσιμπάει) */
    const sp = T => JSON.stringify(T.map(x => x.data));
    assert.ok(sp(withGear.trend).includes('mullus surmuletus'), 'species caught with nets still appear in «what is being caught now»');
  } finally { globalThis.Date = RealDate; }
});
