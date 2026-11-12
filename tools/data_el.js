// 1.10.6: ελληνικά ονόματα για δεδομένα που αποθηκεύτηκαν στα αγγλικά (είδος, δόλωμα, τεχνική, τύπος σημείου)
// Φτιάχνει το v4/data-el.js. Τρέξε ξανά όταν αλλάζουν οι λίστες: node tools/data_el.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
const ctx = { window: {}, document: { write() {}, documentElement: {} }, localStorage: { getItem: () => 'en' }, navigator: {} };
ctx.self = ctx.window; vm.createContext(ctx);
for (const f of ['species.js', 'knowledge.js', 'cy100.js']) { try { vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), ctx); } catch (e) { console.error(f, e.message); } }
const W = ctx.window, M = {};
const G = /[Ͱ-Ͽἀ-῿]/;
const add = (en, el) => { if (!en || !el || !G.test(el) || G.test(en)) return; const k = String(en).trim().toLowerCase(); if (k.length < 3 || M[k]) return; M[k] = String(el).trim(); };
// 1) διορθώσεις του Dinos (πρώτες, για να κερδίζουν)
[['Dusky grouper', 'Ροφός'], ['White grouper', 'Σφυρίδα'], ['Common dentex', 'Συναγρίδα'], ['Dentex', 'Συναγρίδα'], ['Grey triggerfish', 'Γουρουνόψαρο'], ['Gray triggerfish', 'Γουρουνόψαρο'], ['Goldblotch grouper', 'Στήρα'],
 ['Dogtooth grouper', 'Ασπρόβλαχος'], ['Live squid / cuttlefish', 'Ζωντανό καλαμάρι / σουπιά'], ['Rocks / reef', 'Βράχια / ύφαλος'], ['Spot', 'Σημείο'], ['Map point', 'Σημείο χάρτη'],
 ['My location', 'Η θέση μου'], ['Point', 'Σημείο'], ['Point from the logbook', 'Σημείο από το Ημερολόγιο']].forEach(([e, g]) => add(e, g));
// 2) είδη: species.js, SPKB, CY100
(W.SPECIES_DB || []).forEach(e => add(e[1], e[0]));
(W.SPKB || []).forEach(x => add(x.en, x.n));
(W.CY100 || []).forEach(x => add(x.e, x.n));
// 3) τύποι σημείου (map-view) και δολώματα/τεχνικές του λεξικού (γραμμές «Βυθού…» του i18n-en.js)
const mv = fs.readFileSync(path.join(R, 'v4', 'map-view.js'), 'utf8').match(/var SPT=EN\?\[([^\]]*)\]:\[([^\]]*)\]/);
if (mv) { const E = mv[1].match(/'[^']*'/g).map(s => s.slice(1, -1)), Gr = mv[2].match(/'[^']*'/g).map(s => s.slice(1, -1)); E.forEach((e, i) => add(e, Gr[i])); }
const i18 = fs.readFileSync(path.join(R, 'i18n-en.js'), 'utf8').split('\n');
for (const ln of i18.slice(22, 24)) for (const m of ln.matchAll(/"([^"]{2,40})":"([^"]{2,40})"/g)) add(m[2], m[1]);
const adv = fs.readFileSync(path.join(R, 'v4', 'advise.js'), 'utf8').match(/var KTR=\{([^}]*)\}/);
if (adv) for (const m of adv[1].matchAll(/'([^']{2,40})':'([^']{2,40})'/g)) add(m[2], m[1]);
const out = `/* 1.10.6: φτιάχνεται από tools/data_el.js — μην το αλλάζεις με το χέρι.
   Στα ελληνικά: δεδομένα που γράφτηκαν όταν η εφαρμογή ήταν στα αγγλικά (π.χ. «Dusky grouper», «Rocks / reef») φαίνονται με το ελληνικό όνομα.
   Τα δεδομένα δεν αλλάζουν· μόνο η εμφάνιση. */
(function(){ if(window.LANG==='en') return; var M=${JSON.stringify(M)}, G=/[\\u0370-\\u03ff\\u1f00-\\u1fff]/;
  function cap(src,v){ return /^[A-Z]/.test(src.trim())?v.charAt(0).toUpperCase()+v.slice(1):v; }
  function one(x){ var k=x.trim().toLowerCase(); return M[k]?cap(x,M[k]):x; }
  var GT={longline:'Παραγάδι',net:'Δίχτυ',pot:'Κλουβί',trap:'Κλουβί'};
  function dn(n){ if(n==null) return n; var s=String(n); if(!/[A-Za-z]{3}/.test(s)) return s; var k=s.trim().toLowerCase(); if(M[k]) return cap(s,M[k]);
    var g=k.match(/^(longline|net|pot|trap) (\\d+)$/); if(g) return GT[g[1]]+' '+g[2];   /* «Longline 17» → «Παραγάδι 17» */
    return s.split(/(\\s*,\\s*|\\s+·\\s+)/).map(function(p,i){ return i%2?p:one(p); }).join(''); }
  window.dataName=dn; window.spName=dn; })();
`;
fs.writeFileSync(path.join(R, 'v4', 'data-el.js'), out);
console.log(Object.keys(M).length, 'names,', out.length, 'bytes');
