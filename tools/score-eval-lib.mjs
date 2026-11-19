// Alkyon · αξιολόγηση του βαθμού (P1.2): καθαρές συναρτήσεις στατιστικής, χωρίς δίκτυο και χωρίς δεδομένα χρηστών.
// Ερώτηση που απαντούν: «ένας βαθμός (ή μια διόρθωσή του) ξεχωρίζει πραγματικά τις εξόδους με περισσότερα ψάρια ανά ώρα;»
// και «έχουμε αρκετά δεδομένα για να το πούμε;». Δεν αλλάζουν τίποτα στην εφαρμογή.

/* επαναλήψιμη τύχη (mulberry32) */
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* AUC κατάταξης, όπως στον server (safety-job backtest): από όλα τα ζεύγη εξόδων με διαφορετικό αποτέλεσμα y,
   σε πόσα ο βαθμός s είναι μεγαλύτερος στην έξοδο με το μεγαλύτερο y (ισοπαλία = μισό). 0,5 = τύχη, 1 = τέλεια κατάταξη.
   Επιστρέφει {a, p} (p = ζεύγη) ή null όταν δεν υπάρχει κανένα ζεύγος με διαφορετικό αποτέλεσμα. */
export function auc(rows, key = 's', ykey = 'y') { let s = 0, p = 0;
  for (let i = 0; i < rows.length; i++) for (let j = 0; j < rows.length; j++) { if (!(rows[i][ykey] > rows[j][ykey])) continue; p++; const a = rows[i][key], b = rows[j][key]; s += a > b ? 1 : a === b ? 0.5 : 0; }
  return p ? { a: s / p, p } : null; }

/* συσχέτιση Spearman (με μέσες τάξεις στις ισοπαλίες) */
export function spearman(rows, key = 's', ykey = 'y') { const n = rows.length; if (n < 3) return null;
  const rank = k => { const idx = rows.map((r, i) => [r[k], i]).sort((a, b) => a[0] - b[0]), out = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++; const r = (i + j) / 2 + 1; for (let k2 = i; k2 <= j; k2++) out[idx[k2][1]] = r; i = j + 1; } return out; };
  const a = rank(key), b = rank(ykey), ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n; let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null; }

/* bootstrap: ξαναδειγματοληψία εξόδων (ή ολόκληρων χρηστών με cluster = 'u', γιατί οι έξοδοι του ίδιου ανθρώπου δεν είναι ανεξάρτητες).
   stat(rows) → αριθμός ή null. Επιστρέφει {est, lo, hi, n (έγκυρες επαναλήψεις), B}: διάστημα 95% με εκατοστημόρια. */
export function bootstrap(rows, stat, { B = 2000, seed = 1, cluster = null } = {}) { const r = rng(seed), est = stat(rows), vals = [];
  const groups = cluster ? Object.values(rows.reduce((m, x) => { (m[x[cluster]] = m[x[cluster]] || []).push(x); return m; }, {})) : null;
  for (let b = 0; b < B; b++) { let smp;
    if (groups) { smp = []; for (let i = 0; i < groups.length; i++) smp.push(...groups[Math.floor(r() * groups.length)]); }
    else { smp = new Array(rows.length); for (let i = 0; i < rows.length; i++) smp[i] = rows[Math.floor(r() * rows.length)]; }
    const v = stat(smp); if (v != null && v === v) vals.push(v); }
  vals.sort((a, b) => a - b); const q = p => vals.length ? vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * vals.length)))] : null;
  return { est, lo: q(0.025), hi: q(0.975), n: vals.length, B }; }

/* σύγκριση δύο βαθμών πάνω στις ΙΔΙΕΣ εξόδους: διαφορά AUC (b − a) με διάστημα 95% */
export function compare(rows, a, b, opt) { const d = rs => { const A = auc(rs, a), B2 = auc(rs, b); return A && B2 ? B2.a - A.a : null; }; return bootstrap(rows, d, opt); }

/* ψάρια ανά ώρα ανά ζώνη βαθμού (όπως το «Πόσο έπεσε μέσα») */
export function bands(rows, cuts = [50, 60, 70], key = 's') { const n = cuts.map(() => 0).concat(0), hr = n.slice(), fish = n.slice(), hit = n.slice();
  for (const x of rows) { let b = 0; while (b < cuts.length && x[key] >= cuts[b]) b++; n[b]++; hr[b] += x.h; fish[b] += x.fish; if (x.fish > 0) hit[b]++; }
  return { cuts, n, perHour: hr.map((h, i) => h >= 1 ? fish[i] / h : null), hit: n.map((x, i) => x ? hit[i] / x : null) }; }

/* πόσες εξόδους χρειαζόμαστε; Προσομοίωση: βαθμός και αποτέλεσμα με πραγματικό AUC «trueAuc» (διδιάστατη κανονική),
   posRate = ποσοστό εξόδων με ψάρια. Επιστρέφει την πιθανότητα το κάτω όριο του 95% να είναι πάνω από 0,5 (ισχύς). */
export function power(n, trueAuc, { posRate = 0.5, sims = 300, B = 300, seed = 7 } = {}) { const r = rng(seed), gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  /* AUC = Φ(d/√2) → d = √2·Φ⁻¹(AUC) */
  const inv = p => { let lo = -6, hi = 6; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, c = 0.5 * (1 + erf(m / Math.SQRT2)); if (c < p) lo = m; else hi = m; } return (lo + hi) / 2; }, d = Math.SQRT2 * inv(trueAuc);
  let ok = 0; for (let s = 0; s < sims; s++) { const rows = []; for (let i = 0; i < n; i++) { const y = r() < posRate ? 1 : 0; rows.push({ y, s: gauss() + (y ? d : 0) }); }
    const bs = bootstrap(rows, rs => { const A = auc(rs); return A ? A.a : null; }, { B, seed: 1000 + s }); if (bs.lo != null && bs.lo > 0.5) ok++; }
  return ok / sims; }
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }

/* ΚΑΝΟΝΑΣ ΑΠΟΦΑΣΗΣ, γραμμένος ΠΡΙΝ δούμε αποτελέσματα, για να μην προσαρμόζεται στα δεδομένα.
   Μια νέα επιρροή στον βαθμό (ή στη βεβαιότητα) ενεργοποιείται μόνο όταν ισχύουν ΟΛΑ:
   - αρκετά δεδομένα: ≥ minTrips έξοδοι με καταγραφή, από ≥ minUsers χρήστες, με ≥ minPos εξόδους με ψάρια και ≥ minPos χωρίς·
   - πραγματική βελτίωση: η διαφορά AUC είναι ≥ minDelta ΚΑΙ το κάτω όριο του 95% είναι πάνω από 0·
   - καμία υποομάδα (προφίλ) δεν χειροτερεύει αισθητά (ελέγχεται χωριστά).
   Αλλιώς: βάρος 0 και συνεχίζουμε να μαζεύουμε δεδομένα. */
export const GATE = { minTrips: 150, minUsers: 10, minPos: 30, minDelta: 0.03 };
export function decide({ trips, users, pos, neg, delta }, gate = GATE) { const why = [];
  if (trips < gate.minTrips) why.push(`trips ${trips} < ${gate.minTrips}`);
  if (users < gate.minUsers) why.push(`users ${users} < ${gate.minUsers}`);
  if (pos < gate.minPos) why.push(`trips with fish ${pos} < ${gate.minPos}`);
  if (neg < gate.minPos) why.push(`trips without fish ${neg} < ${gate.minPos}`);
  if (!delta || delta.est == null) why.push('no measurable difference');
  else { if (delta.est < gate.minDelta) why.push(`ΔAUC ${delta.est.toFixed(3)} < ${gate.minDelta}`); if (!(delta.lo > 0)) why.push(`95% interval includes 0 (${delta.lo == null ? 'n/a' : delta.lo.toFixed(3)} … ${delta.hi == null ? 'n/a' : delta.hi.toFixed(3)})`); }
  return { go: why.length === 0, why }; }
