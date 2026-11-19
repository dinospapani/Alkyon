#!/usr/bin/env node
// Alkyon · αξιολόγηση του βαθμού σε πραγματικές εξόδους (P1.2).   node tools/score-eval.mjs <φάκελος δεδομένων>
// Ο φάκελος (ΕΚΤΟΣ repo: είναι δεδομένα χρηστών, έστω ανώνυμα) έχει:
//   trips.jsonl  μία έξοδος ανά γραμμή: [χρήστης, ms, ms2, lat, lon, prof, rt, sp, [[t, wind, gust, wave, press, pt, rain, cloud, temp, sst, tide], …]]  (catch_obs kind=trip, cond.e)
//   fish.json    [[ms, ψάρια, καταγραφές], …] με την ίδια σειρά
//   ins.json     τα τρέχοντα κοινά ευρήματα (bite_stats «all» → data.ins)
// Υπολογίζει τον βαθμό με τον ΙΔΙΟ πυρήνα της εφαρμογής (score-config + score-core + forecast.js) και τυπώνει μόνο συγκεντρωτικά.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auc, spearman, bootstrap, compare, bands, power, decide, GATE } from './score-eval-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = process.argv[2];
if (!DIR) { console.error('node tools/score-eval.mjs <data dir>'); process.exit(2); }
const g = {}; for (const f of ['score-config.js', 'score-core.js', 'forecast.js']) new Function('self', fs.readFileSync(path.join(ROOT, f), 'utf8'))(g);
const PF = g.PF, AS = g.AlkyonScore, HR = 3600000;
const T = fs.readFileSync(path.join(DIR, 'trips.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)), F = JSON.parse(fs.readFileSync(path.join(DIR, 'fish.json'), 'utf8')), INS = JSON.parse(fs.readFileSync(path.join(DIR, 'ins.json'), 'utf8'));
const tzOf = lon => Math.round((+lon || 0) / 15) * 60, isoD = ms => new Date(ms).toISOString().slice(0, 10);
/* ίδια μετατροπή με τον server (safety-job fcHour), ΜΕ το γνωστό του σφάλμα (βροχή mm στο πεδίο της πιθανότητας), ώστε να αναπαράγεται ο σημερινός έλεγχος */
const fcHour = (f, la, lo, prof) => { const tz = tzOf(lo), [t, wind, gust, wave, press, pt, rain, cloud, temp, sst, tide] = f, hr = Math.floor(((t + tz * 60000) % 86400000) / HR);
  return { hr, wind, gust, wave, pres: press, rain, mm: rain, clp: cloud, mal: PF.moonAlt(t, +la, +lo), temp, sst, prof: prof || 'boat', t: new Date(t + tz * 60000).toISOString().slice(0, 16),
    ptrend: pt == null ? 'stable' : pt <= -3 ? 'fast' : pt <= -1 ? 'slow' : pt >= 1 ? 'rise' : 'stable', tide: tide == null ? null : tide > 0.01 ? 'up' : tide < -0.01 ? 'down' : 'slack', cloud: cloud == null ? 'part' : cloud < 20 ? 'clear' : cloud < 70 ? 'part' : 'over' }; };
const rows = T.map((t, i) => { const [u, ms, ms2, la, lo, prof0, rt, sp, e] = t, prof = prof0 === 'spear' ? 'spear' : prof0 === 'lake' ? 'lake' : 'boat', tz = tzOf(lo), sm = PF.sunMoon(isoD(ms + tz * 60000), +la, +lo, tz);
  let b0 = 0, b1 = 0, s0 = 0, cf = 0, n = 0, learned = 0, nowave = 0;
  for (const f of e) { const w = fcHour(f, la, lo, prof), bite = PF.hourScore(sm, w.hr, Object.assign({}, w, { bite: true })), full = PF.hourScore(sm, w.hr, w);
    const h1 = PF.learnAdj({ ins: INS }, sm, Object.assign({}, w, { score: bite, bite })); if (h1.learn) learned++;
    const ev = AS.evaluate(sm, w, { prof, dayOffset: 0 }); cf += ev.confidence.n; if (w.wave == null) nowave++;
    b0 += bite; b1 += h1.bite; s0 += full; n++; }
  const h = Math.max(1, (ms2 - ms) / HR), fish = F[i][1];
  /* «έξοδος από τα ψάρια της ημέρας» (φτιάχνεται εκ των υστέρων γύρω από ψάρια): στρογγυλές ώρες. Έχει ΠΑΝΤΑ ψάρια, άρα δεν είναι δίκαιη δοκιμή του βαθμού. */
  const synth = ms % 60000 === 0 && ms2 % 60000 === 0;
  return { u, h, fish, y: fish / h, rt, prof: prof0 || 'boat', synth, bite: b0 / n, learn: b1 / n, full: s0 / n, conf: cf / n, learned: learned / n, nowave: nowave / n, hours: n }; });

const f2 = v => v == null ? 'n/a' : (Math.round(v * 100) / 100).toFixed(2), ci = b => `${f2(b.est)}  [95%: ${f2(b.lo)} … ${f2(b.hi)}]`;
const A = (rs, k) => bootstrap(rs, x => { const a = auc(x, k); return a ? a.a : null; }, { B: 4000, seed: 11 });
function section(name, rs) { const pos = rs.filter(x => x.fish > 0).length, users = new Set(rs.map(x => x.u)).size, pairs = (auc(rs, 'bite') || {}).p || 0;
  console.log(`\n== ${name}: ${rs.length} trips, ${users} users, ${pos} with fish, ${rs.length - pos} without, ${Math.round(rs.reduce((a, x) => a + x.h, 0))} fishing hours, ${pairs} informative pairs`);
  if (!pairs) { console.log('   no pair of trips with a different outcome → nothing can be measured'); return null; }
  console.log('   AUC bite score (core)            ' + ci(A(rs, 'bite')));
  console.log('   AUC full score (core, with sea)  ' + ci(A(rs, 'full')));
  console.log('   AUC bite + learned findings      ' + ci(A(rs, 'learn')) + '   (findings applied IN-SAMPLE: optimistic)');
  const d = compare(rs, 'bite', 'learn', { B: 4000, seed: 12 }); console.log('   ΔAUC learned − core              ' + ci(d));
  console.log('   Spearman bite vs fish/hour       ' + f2(spearman(rs, 'bite')) + '   · learned ' + f2(spearman(rs, 'learn')));
  const b = bands(rs, [50, 60, 70], 'bite'); console.log('   fish/hour by bite band <50|50-60|60-70|70+: ' + b.perHour.map(f2).join(' | ') + '   trips ' + b.n.join(' | '));
  console.log('   hours where findings applied     ' + Math.round(rs.reduce((a, x) => a + x.learned * x.hours, 0)) + ' of ' + rs.reduce((a, x) => a + x.hours, 0));
  return { trips: rs.length, users, pos, neg: rs.length - pos, delta: d }; }

console.log(`Alkyon score evaluation · config ${PF.scoreConfig} · ${T.length} contributed trips, ${T.reduce((a, t) => a + t[8].length, 0)} trip-hours`);
const all = section('ALL contributed trips (as the server backtest sees them)', rows);
const real = section('TRACKED trips only (recorded while fishing; "trips from the day\'s catches" removed)', rows.filter(x => !x.synth));
section('"Trips from the day\'s catches" only (always have fish by construction)', rows.filter(x => x.synth));
console.log('\n== Selection effect: is the outcome explained by HOW the trip was created?');
console.log('   AUC of "synthetic trip" flag vs fish/hour  ' + ci(A(rows.map(x => Object.assign({ s: x.synth ? 1 : 0 }, x)), 's')));
console.log('\n== Confidence pillars available in this data');
console.log('   completeness: trips with no wave data ' + rows.filter(x => x.nowave === 1).length + ' of ' + rows.length + ' · horizon: all hindcast (day 0) · model agreement: not stored · local correction: not stored');
const lo = rows.filter(x => x.nowave === 1), hi = rows.filter(x => x.nowave < 1); for (const [n, rs] of [['wave missing (confidence medium)', lo], ['wave present (confidence high)', hi]]) { const a = auc(rs, 'bite'); console.log(`   ${n}: ${rs.length} trips, AUC ${a ? f2(a.a) + ' (' + a.p + ' pairs)' : 'n/a'}`); }
console.log('\n== Decision rule (fixed before looking at results): ' + JSON.stringify(GATE));
for (const [n, r] of [['evidence (learned findings) → score/confidence, all trips', all], ['evidence, tracked trips only', real]]) { const d = r ? decide(r) : { go: false, why: ['not measurable'] }; console.log(`   ${n}: ${d.go ? 'GO' : 'NO-GO'}${d.why.length ? ' — ' + d.why.join('; ') : ''}`); }
console.log('   locality → score/confidence: NO-GO — not measurable: no trip records whether a local wave correction was applied');
if (process.argv.includes('--power')) { console.log('\n== How many trips are needed (power to show AUC > 0.5 at 95%, half of trips with fish)');
  for (const a of [0.6, 0.65, 0.7]) console.log('   true AUC ' + a + ': ' + [40, 80, 150, 300].map(n => n + ' trips → ' + Math.round(power(n, a) * 100) + '%').join(' · ')); }
