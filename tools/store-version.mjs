#!/usr/bin/env node
/* Alkyon 1.14.102 · Ενημερώνει το app-version.json (τη διαβάζει η εφαρμογή για τη μπάρα «Νέα έκδοση»).
   ΚΑΝΟΝΑΣ: τρέχει ΜΟΝΟ όταν η έκδοση έχει εγκριθεί και είναι διαθέσιμη στο store για όσους τη διαβάζουν.
   Χρήση:
     node tools/store-version.mjs android 1.14.98
     node tools/store-version.mjs ios 1.14.101 --min 1.14.90
     node tools/store-version.mjs ios 1.15.0 --url itms-apps://apps.apple.com/app/idXXXXXXXXXX --el "από το App Store" --en "from the App Store"
     node tools/store-version.mjs ios --min none        (σβήνει το min)
   --min: κάτω από αυτή την έκδοση η μπάρα λέει «Απαιτείται ενημέρωση» και δεν κλείνει. Πρέπει να είναι ≤ της έκδοσης στο store. */
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const F = path.join(ROOT, 'app-version.json');
const RE = /^\d+\.\d+\.\d+$/;
const num = v => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v || ''); return m ? (+m[1]) * 1e6 + (+m[2]) * 1e3 + (+m[3]) : 0; };
const die = m => { console.error('store-version: ' + m); process.exit(1); };
const a = process.argv.slice(2), plat = a.shift();
if (!['android', 'ios'].includes(plat)) die('πρώτο όρισμα: android ή ios');
let v = a[0] && !a[0].startsWith('--') ? a.shift() : null;
const opt = {}; for (let i = 0; i < a.length; i += 2) { if (!a[i].startsWith('--') || a[i + 1] == null) die('λάθος όρισμα ' + a[i]); opt[a[i].slice(2)] = a[i + 1]; }
const j = JSON.parse(fs.readFileSync(F, 'utf8')), p = j[plat] || (j[plat] = {});
if (v) { if (!RE.test(v)) die('έκδοση της μορφής 1.14.98'); p.v = v; }
if (opt.min) { if (opt.min === 'none') delete p.min; else { if (!RE.test(opt.min)) die('--min της μορφής 1.14.90'); p.min = opt.min; } }
for (const k of ['url', 'el', 'en']) if (opt[k]) p[k] = opt[k];
if (!p.v || !p.url) die('λείπει έκδοση ή url για ' + plat);
if (p.min && num(p.min) > num(p.v)) die('το min (' + p.min + ') δεν μπορεί να είναι μεγαλύτερο από την έκδοση στο store (' + p.v + ')');
const line = o => JSON.stringify(Object.fromEntries(['v', 'min', 'url', 'el', 'en'].filter(k => o[k] != null).map(k => [k, o[k]])));
const out = '{"_":' + JSON.stringify(j._) + ',\n "android":' + line(j.android) + ',\n "ios":' + line(j.ios) + '}\n';
fs.writeFileSync(F, out); console.log(out);
