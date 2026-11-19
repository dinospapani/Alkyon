// @ts-nocheck
// Alkyon cron: forecast push, ασφάλεια εξόδων (Telegram), πτώση πίεσης. Παράγεται από build_edge.py. Μην το επεξεργάζεσαι στο χέρι.
import webpush from 'npm:web-push@3.6.7';

globalThis.self = globalThis.self || globalThis;
// ---- score-config.js ----
/* Alkyon · score-config: τα ΒΑΡΗ και τα ΟΡΙΑ του βαθμού ψαρέματος. ΜΟΝΟ δεδομένα, καθόλου λογική.
   Η λογική είναι στο score-core.js. Φορτώνεται πριν από το score-core.js και το forecast.js (σελίδα, service worker, server, ρολόι).

   ΕΚΔΟΣΗ: κάθε αλλαγή αριθμού εδώ αλλάζει τον βαθμό που βλέπει ο χρήστης. Γι' αυτό:
   - αλλάζει ΚΑΙ το «version» (π.χ. '2026.12-1'), ώστε κάθε αποθηκευμένη πρόβλεψη να ξέρει με ποια βάρη βγήκε·
   - η προηγούμενη έκδοση μένει ως αναφορά στα tests (tests/unit/golden) και η διαφορά τεκμηριώνεται (τι, γιατί, bug ή πρόθεση).
   Η έκδοση 2026.11-1 έχει ΑΚΡΙΒΩΣ τους αριθμούς που είχε το forecast.js στην 1.14.83 (έλεγχος ισοτιμίας: tests/unit/score-parity.test.mjs).

   Κανόνες βημάτων: λίστα που διαβάζεται με τη σειρά· ισχύει ο πρώτος κανόνας που ταιριάζει.
   lt: <   le: ≤   gt: >   ge: ≥   (χωρίς συνθήκη = «αλλιώς»)   d: πόσους βαθμούς προσθέτει.
   Μονάδες (ίδιες σε εφαρμογή και server): άνεμος/ριπή kn · κύμα m · πίεση hPa · θερμοκρασία °C · βροχή: πιθανότητα % ΚΑΙ mm/ώρα (δύο πεδία) · συννεφιά %. */
(function(g){
'use strict';
g.AlkyonScoreConfig={
  version:'2026.11-1',
  base:50,
  clamp:[5,98],
  /* «μόνο τσίμπημα» (bite): σαν να ήταν ήρεμη η θάλασσα */
  neutral:{wind:8,wave:0.3},
  /* όταν το κύμα λείπει (π.χ. λίμνη ή χωρίς θαλάσσιο μοντέλο) ο βαθμός υπολογίζεται με αυτή την τιμή· το data contract το σημειώνει ως «default» */
  waveDefault:0.5,
  /* τάση πίεσης 3 ωρών. Οι μελέτες δεν βρίσκουν σταθερή επίδραση (Stoner 2004)· μικρό + στην άνοδο (Guy 1992), μικρότερο στην απότομη πτώση */
  pressure:{slow:3,stable:3,rise:4,fast:1}, pressureDefault:'stable',
  cloud:{clear:0,part:2,over:4}, cloudDefault:'part',
  gust:[{ge:35,d:-10},{ge:28,d:-5},{d:0}],
  storm:{code:95,d:-15},
  rainProb:{from:70,d:-2},
  /* προφίλ ψαρέματος (εκτίμηση, όχι επικυρωμένη). Ό,τι άλλο εκτός από shore/lake/spear = boat */
  profiles:{
    boat:{ wind:[{lt:5,d:2},{le:12,d:4},{le:18,d:-3},{le:25,d:-12},{d:-25}],
           wave:[{le:0.5,d:3},{le:1,d:0},{le:1.5,d:-6},{le:2,d:-15},{d:-25}] },
    /* στεριά: αντέχει λίγο περισσότερο άνεμο, αλλά το δυνατό κύμα στην ακτή είναι επικίνδυνο */
    shore:{ wind:[{lt:5,d:2},{le:14,d:4},{le:20,d:-2},{le:27,d:-12},{d:-25}],
            wave:[{le:0.5,d:3},{le:1,d:1},{le:1.5,d:-5},{le:2,d:-16},{d:-28}] },
    /* λίμνη: δεν μετράει κύμα θάλασσας· θερμοκρασία αέρα ως ένδειξη για το ρηχό νερό· ελαφριά βροχή συχνά βοηθά */
    lake:{ wind:[{lt:5,d:3},{le:12,d:4},{le:18,d:-3},{le:25,d:-12},{d:-25}],
           wave:null,
           temp:[{lt:8,d:-4},{lt:14,d:-1},{le:27,d:3},{le:32,d:0},{d:-4}],
           rainProb:[{ge:40,lt:75,d:1},{d:0}] },
    /* ψαροντούφεκο: χαμηλό κύμα και ήπιος άνεμος μετράνε πολύ */
    spear:{ wind:[{lt:5,d:3},{le:10,d:4},{le:15,d:-6},{le:22,d:-16},{d:-28}],
            wave:[{le:0.3,d:4},{le:0.6,d:0},{le:1,d:-10},{le:1.5,d:-22},{d:-35}] }
  },
  /* φως: λυκαυγές/λυκόφως έως «window» λεπτά από ανατολή ή δύση (γραμμικά έως «max»)· μεσημέρι 11:00–15:00 */
  light:{ twilight:{window:75,max:14}, midday:{from:660,to:900,d:-4} },
  /* περίοδοι Knight από ακριβείς ώρες σελήνης: κύρια ±45′ +6 (μισό έως ±75′), δευτερεύουσα ±30′ +3 */
  solunar:{ major:{window:45,d:6,extra:30,dExtra:3}, minor:{window:30,d:3} },
  /* είδος-στόχος: θερμοκρασία θάλασσας ως προς το εύρος του είδους (knowledge.js)· ειδικοί κανόνες μόνο όπου υπάρχει μελέτη */
  species:{
    sst:{perDeg:2.5,max:10},
    order:['squid','sword'],
    kinds:{
      /* καλαμάρι (Cabanellas-Reboredo κ.ά. 2012): νέα σελήνη, λίγος άνεμος, χαμηλή πίεση, πιο κρύα θάλασσα, στενό παράθυρο στη δύση */
      squid:{ match:'loligo|καλαμάρ|squid', moonAmp:5, coldBonus:3, biteKeepsWind:true,
              wind:[{lt:8,d:3},{gt:14,d:-4},{d:0}], pres:[{lt:1012,d:3},{gt:1018,d:-2},{d:0}],
              dusk:{within:60,max:8,span:90} },
      /* ξιφίας (Ceyhan κ.ά. 2018, Αν. Μεσόγειος): καμία επίδραση σελήνης → χωρίς περιόδους solunar */
      sword:{ match:'xiphias|ξιφ|swordfish', noSolunar:true }
    }
  },
  /* «ο δείκτης μαθαίνει» (κοινά ευρήματα bite_stats): μόνο ισχυρά ευρήματα, συρρίκνωση n/(n+shrink), όριο πολλαπλασιαστή */
  learn:{shrink:60,min:0.85,max:1.15,minN:15},
  /* παράθυρο ημέρας: η μεγαλύτερη συνεχόμενη σειρά ωρών έως «within» βαθμούς κάτω από την καλύτερη· ώρες φωτός = ανατολή−pad έως δύση+pad (λεπτά) */
  window:{within:6,daylightPad:60},
  /* ΕΓΚΥΡΗ ΕΞΟΔΟΣ ΨΑΡΕΜΑΤΟΣ για την αξιολόγηση του βαθμού (ο κανόνας είναι στο score-core.js: session). Διάρκεια από minMin λεπτά έως maxHours ώρες. */
  session:{minMin:20,maxHours:16},
  /* προεπιλεγμένα όρια «ασφαλούς» ώρας (ο χρήστης τα αλλάζει: alkyon-limits) */
  limits:{wind:14,wave:0.9,gust:24},
  /* κλάσεις συνθηκών (για τη μάθηση): όρια «μικρότερο από» με τη σειρά· κλάση = πόσα όρια ξεπερνά η τιμή */
  bins:{
    sun:{nightPad:60,edge:90,midHalf:120},
    presLevel:[1010,1015,1020], wind:[5,10,15], wave:[0.3,0.6,1],
    rainMm:0.2, afterSet:[60,180,360], preDawn:90, moonPhases:8,
    dark:{dayPad:90,cloudDefault:{clear:10,over:85,other:45},cloudDim:0.8,cuts:[0.05,0.25]},
    thermocline:[20,50], chl:[0.04,0.07,0.12], sst:[16,19,22,25]
  },
  /* επίπεδα για τις οθόνες και τις ειδοποιήσεις. ΔΕΝ χρησιμοποιούνται ακόμα από τον κώδικα (P1.2): καταγράφονται εδώ οι τιμές που είναι σήμερα διάσπαρτες */
  levels:{good:70,fair:50,dayExcellent:80,dayGood:70,alert:75,alertEve:-5,alertWorse:-8,nextGood:60},
  /* βεβαιότητα (Low / Medium / High): από την ποιότητα των δεδομένων, ΟΧΙ από τον βαθμό.
     Επίπεδο = το χαμηλότερο από «πληρότητα» και «ορίζοντας», μείον τις προσαρμογές.
     Οι προσαρμογές «τοπικότητα» και «τεκμήρια» έχουν βάρος 0 μέχρι να δείξει η αξιολόγηση (P1.2) ότι αξίζουν· καταγράφονται όμως στο αποτέλεσμα. */
  confidence:{
    levels:['low','medium','high'],
    /* πληρότητα: ποια δεδομένα είναι απαραίτητα (χωρίς αυτά: low) και ποια σημαντικά (λείπει ένα: έως medium· λείπουν ≥ 2: low) */
    required:['wind'], important:['wave','sst'],
    /* το κύμα δεν μετρά στη λίμνη */
    notNeeded:{lake:['wave','sst']},
    /* ορίζοντας σε ημέρες από σήμερα: έως highTo → high, έως mediumTo → medium, μετά low */
    horizon:{highTo:2,mediumTo:5},
    adjust:{modelDisagree:-1,noLocal:0,evidenceStrong:0}
  },
  /* data contract: μονάδα κάθε μεταβλητής. Ίδιο σε εφαρμογή και server. */
  units:{ wind:'kn',gust:'kn',windDir:'deg',wave:'m',wavePeriod:'s',current:'kn',currentDir:'deg',pressure:'hPa',pressureTrend:'class',
          sst:'°C',airTemp:'°C',rainProb:'%',rainMm:'mm/h',cloud:'%',moonPhase:'0-1',moonIllum:'0-1',moonAlt:'deg',
          tide:'class',seaLevel:'m',depth:'m',slope:'%',clarity:'m',chl:'mg/m3',thermocline:'m',frontChl:'log10/km',frontSst:'°C/km',
          minute:'min',month:'1-12',weatherCode:'wmo' },
  quality:['meas','model','est','default','missing']
};
/* τα βάρη δεν αλλάζουν την ώρα που τρέχει η εφαρμογή: κάθε αλλαγή γίνεται εδώ, με νέα έκδοση */
(function fr(o){ if(o&&typeof o==='object'&&!Object.isFrozen(o)){ Object.freeze(o); for(var k in o) fr(o[k]); } })(g.AlkyonScoreConfig);
})(typeof self!=='undefined'?self:this);

// ---- score-core.js ----
/* Alkyon · score-core (AlkyonScore): ο ΕΝΑΣ πυρήνας του βαθμού ψαρέματος.
   Καθαρές συναρτήσεις: χωρίς DOM, χωρίς δίκτυο, χωρίς localStorage, χωρίς ρολόι. Ίδιο αρχείο σε σελίδα, service worker, server και ρολόι.
   Τα βάρη και τα όρια είναι ΜΟΝΟ στο score-config.js (AlkyonScoreConfig)· εδώ δεν υπάρχει κανένας αριθμός βαθμού.

   Τι δίνει:
   - hour(sm, hr, w, ctx)      → βαθμός ώρας (ακέραιος). Ίδιο αποτέλεσμα με το hourScore της 1.14.83 για το config 2026.11-1.
   - explain(sm, hr, w, ctx)   → {score, raw, base, reasons:[{k,d,v,unit}], cfg}: κάθε όρος που μπήκε στον βαθμό, με την τιμή που τον προκάλεσε.
   - window(hours, cand, key)  → {best, win}: το παράθυρο της ημέρας (ένας αλγόριθμος για βαθμό, τσίμπημα και προσωπικό).
   - bins(sm, h)               → κλάσεις συνθηκών (για τη μάθηση).
   - learn(L, sm, h)           → διόρθωση από τα κοινά ευρήματα (πολλαπλασιαστής με συρρίκνωση και όριο).
   - contract(h, meta)         → data contract: κάθε μεταβλητή ως {v, src, q, unit}. Τίποτα σιωπηλό: ό,τι λείπει γράφεται «missing» ή «default».
   - validate(input)           → λίστα σφαλμάτων (λάθος μονάδα, τιμή χωρίς πηγή, άγνωστη ποιότητα).
   - confidence(input, meta)   → {level:'low'|'medium'|'high', why[], pillars}: από την ποιότητα των δεδομένων, όχι από τον βαθμό.
   - evaluate(sm, h, meta)     → {score, bite, safe?, reasons, confidence, cfg}: όλα μαζί για μία ώρα πρόγνωσης.

   ctx = {sp, prof}: είδος-στόχος ({n, l, sst:[από,έως]} ή null) και προφίλ ('boat'|'shore'|'lake'|'spear').
   Ο πυρήνας ΔΕΝ τα μαντεύει: τα δίνει όποιος καλεί (το forecast.js τα διαβάζει από τις ρυθμίσεις του χρήστη). */
(function(g){
'use strict';
var CFG0=g.AlkyonScoreConfig;
if(!CFG0) throw new Error('score-core.js: φόρτωσε πρώτα το score-config.js');
var has=function(o,k){ return Object.prototype.hasOwnProperty.call(o,k); };
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
/* απόσταση δύο ωρών της ημέρας σε λεπτά (κυκλικά) */
function circDist(a,b){ var d=Math.abs(a-b)%1440; return Math.min(d,1440-d); }
/* απόσταση (λεπτά) της ώρας t από την πιο κοντινή περίοδο μιας λίστας */
function nearMin(t,arr){ var b=1e9, a=arr||[]; for(var i=0;i<a.length;i++) b=Math.min(b,Math.abs(t-a[i])); return b; }
/* κανόνες βημάτων: ο πρώτος που ταιριάζει (lt <, le ≤, gt >, ge ≥· χωρίς συνθήκη = αλλιώς) */
function step(v,rules){
  for(var i=0;i<rules.length;i++){ var r=rules[i];
    if(r.lt!==undefined&&!(v<r.lt)) continue;
    if(r.le!==undefined&&!(v<=r.le)) continue;
    if(r.gt!==undefined&&!(v>r.gt)) continue;
    if(r.ge!==undefined&&!(v>=r.ge)) continue;
    return r.d; }
  return 0;
}
/* κλάση = η θέση του πρώτου ορίου που η τιμή είναι μικρότερη· αλλιώς η τελευταία κλάση */
function cls(v,cuts){ for(var i=0;i<cuts.length;i++) if(v<cuts[i]) return i; return cuts.length; }

/* ---------- είδος ---------- */
var RX=[];   /* [config, [[kind, RegExp], …]] με τη σειρά του config */
function rxOf(cfg){ for(var i=0;i<RX.length;i++) if(RX[i][0]===cfg) return RX[i][1];
  var a=[], K=cfg.species.kinds, ord=cfg.species.order; for(var j=0;j<ord.length;j++) a.push([ord[j],new RegExp(K[ord[j]].match)]); RX.push([cfg,a]); return a; }
/* 'squid' | 'sword' | null: μόνο είδη με ειδικό κανόνα από μελέτη */
function kindOf(sp,cfg){ if(!sp) return null;
  var s=((sp.l||'')+' '+(sp.n||'')).toLowerCase(), rx=rxOf(cfg||CFG0);
  for(var i=0;i<rx.length;i++) if(rx[i][1].test(s)) return rx[i][0];
  return null; }
function profOf(prof,cfg){ return (prof==='shore'||prof==='lake'||prof==='spear')&&has(cfg.profiles,prof)?prof:'boat'; }

/* ---------- βαθμός ώρας ----------
   sm = ήλιος/σελήνη της ημέρας {f, rise, set, maj[], min[]} (λεπτά τοπικής ώρας), hr = ώρα 0–23,
   w = συνθήκες της ώρας {wind, wave, gust, ptrend, cloud, sst, temp, rain(%), pres, code, bite}.
   out (προαιρετικό): λίστα όπου μπαίνει κάθε όρος {k, d, v, unit}. Χωρίς out δεν δεσμεύεται μνήμη (καλείται χιλιάδες φορές). */
function hour(sm,hr,w,ctx,cfg,out){
  cfg=cfg||CFG0;
  var sp=ctx&&ctx.sp, kind=kindOf(sp,cfg), K=kind?cfg.species.kinds[kind]:null, P=cfg.profiles[profOf(ctx&&ctx.prof,cfg)], U=cfg.units, d;
  /* w.bite = μόνο «τσίμπημα»: σαν να ήταν ήρεμη η θάλασσα. Στο καλαμάρι ο άνεμος μένει, γιατί μετρά στο τσίμπημα (μελέτη). */
  var wind=w.bite?((K&&K.biteKeepsWind)?w.wind:cfg.neutral.wind):w.wind,
      wave=w.bite?cfg.neutral.wave:(w.wave==null?cfg.waveDefault:w.wave),
      gust=w.bite?null:w.gust;
  var base=cfg.base;
  if(K&&K.moonAmp){ d=Math.round(Math.cos(2*Math.PI*sm.f)*K.moonAmp); base+=d; if(out&&d) out.push({k:'moon',d:d,v:sm.f,unit:U.moonPhase}); }
  d=cfg.pressure[w.ptrend||cfg.pressureDefault]; base+=d; if(out&&d) out.push({k:'pressure',d:d,v:w.ptrend||cfg.pressureDefault,unit:U.pressureTrend});
  d=step(wind,P.wind); base+=d; if(out&&d) out.push({k:'wind',d:d,v:wind,unit:U.wind});
  if(P.wave){ d=step(wave,P.wave); base+=d; if(out&&d) out.push({k:'wave',d:d,v:wave,unit:U.wave}); }
  if(P.temp&&typeof w.temp==='number'){ d=step(w.temp,P.temp); base+=d; if(out&&d) out.push({k:'airTemp',d:d,v:w.temp,unit:U.airTemp}); }
  if(P.rainProb&&typeof w.rain==='number'){ d=step(w.rain,P.rainProb); base+=d; if(out&&d) out.push({k:'lightRain',d:d,v:w.rain,unit:U.rainProb}); }
  d=cfg.cloud[w.cloud||cfg.cloudDefault]; base+=d; if(out&&d) out.push({k:'cloud',d:d,v:w.cloud||cfg.cloudDefault,unit:'class'});
  if(gust!=null){ d=step(gust,cfg.gust); base+=d; if(out&&d) out.push({k:'gust',d:d,v:gust,unit:U.gust}); }
  /* θερμοκρασία θάλασσας σε σχέση με το εύρος του είδους. Χωρίς είδος δεν μετρά, γιατί η επίδραση αλλάζει από είδος σε είδος. */
  if(sp&&sp.sst&&w.sst!=null){ var lo=sp.sst[0], hi=sp.sst[1], dd=w.sst<lo?lo-w.sst:w.sst>hi?w.sst-hi:0;
    d=Math.min(cfg.species.sst.max,Math.round(dd*cfg.species.sst.perDeg)); base-=d; if(out&&d) out.push({k:'sst',d:-d,v:w.sst,unit:U.sst});
    if(K&&K.coldBonus&&!dd){ d=Math.round(K.coldBonus*(hi-w.sst)/Math.max(1,hi-lo)); base+=d; if(out&&d) out.push({k:'sstCold',d:d,v:w.sst,unit:U.sst}); } }
  if(K&&K.wind){ d=step(wind,K.wind); base+=d; if(out&&d) out.push({k:'speciesWind',d:d,v:wind,unit:U.wind});
    if(w.pres!=null){ d=step(w.pres,K.pres); base+=d; if(out&&d) out.push({k:'speciesPressure',d:d,v:w.pres,unit:U.pressure}); } }
  if(w.code!=null&&w.code>=cfg.storm.code){ d=cfg.storm.d; base+=d; if(out) out.push({k:'storm',d:d,v:w.code,unit:U.weatherCode}); }
  if(w.rain!=null&&w.rain>=cfg.rainProb.from){ d=cfg.rainProb.d; base+=d; if(out) out.push({k:'rain',d:d,v:w.rain,unit:U.rainProb}); }
  /* ώρα της ημέρας (κινητό μέρος, με δεκαδικά· στρογγυλεύεται στο τέλος) */
  var t=hr*60+30, b=0, L=cfg.light, S=cfg.solunar, x;
  var dTw=Math.min(circDist(t,sm.rise),circDist(t,sm.set));
  if(dTw<=L.twilight.window){ x=L.twilight.max*(1-dTw/L.twilight.window); b+=x; if(out) out.push({k:'twilight',d:x,v:dTw,unit:U.minute}); }
  var noSol=!!(K&&K.noSolunar), dMaj=noSol?1e9:sm.maj?nearMin(t,sm.maj):1e9, dMin=noSol?1e9:sm.min?nearMin(t,sm.min):1e9;
  if(K&&K.dusk){ var ds=circDist(t,sm.set); if(ds<=K.dusk.within){ x=K.dusk.max*(1-ds/K.dusk.span); b+=x; if(out) out.push({k:'speciesDusk',d:x,v:ds,unit:U.minute}); } }
  if(dMaj<=S.major.window){ b+=S.major.d; if(out) out.push({k:'solunarMajor',d:S.major.d,v:dMaj,unit:U.minute}); }
  else if(dMaj<=S.major.window+S.major.extra){ b+=S.major.dExtra; if(out) out.push({k:'solunarMajor',d:S.major.dExtra,v:dMaj,unit:U.minute}); }
  if(dMin<=S.minor.window){ b+=S.minor.d; if(out) out.push({k:'solunarMinor',d:S.minor.d,v:dMin,unit:U.minute}); }
  if(t>=L.midday.from&&t<=L.midday.to){ b+=L.midday.d; if(out) out.push({k:'midday',d:L.midday.d,v:t,unit:U.minute}); }
  if(out) out.raw=base+b;
  return clamp(Math.round(base+b),cfg.clamp[0],cfg.clamp[1]);
}
/* ο βαθμός μαζί με τους όρους του. Ισχύει πάντα: base + Σ d = raw, και score = στρογγύλεμα του raw μέσα στα όρια. */
function explain(sm,hr,w,ctx,cfg){ cfg=cfg||CFG0; var out=[], score=hour(sm,hr,w,ctx,cfg,out), raw=out.raw; delete out.raw;
  return {score:score,raw:raw,base:cfg.base,reasons:out,cfg:cfg.version}; }

/* ---------- παράθυρο ημέρας ----------
   hours = όλες οι ώρες της ημέρας με τη σειρά ({hr, …}), cand = οι ώρες που επιτρέπονται (υποσύνολο, ίδια αντικείμενα), key = 'score' | 'bite'.
   best = ο μεγαλύτερος βαθμός στις επιτρεπόμενες· win = η μεγαλύτερη συνεχόμενη σειρά επιτρεπόμενων ωρών έως «within» βαθμούς κάτω από τον best
   (σε ισοπαλία η πρώτη της ημέρας). Χωρίς επιτρεπόμενες ώρες: {best:null, win:null}. */
function windowOf(hours,cand,key,within){
  if(within==null) within=CFG0.window.within;
  if(!cand||!cand.length) return {best:null,win:null};
  /* όπως το Math.max(...τιμές): αριθμητική σύγκριση· αν κάποια τιμή δεν είναι αριθμός, το αποτέλεσμα είναι NaN (και δεν βγαίνει παράθυρο) */
  var best=-Infinity, i, v; for(i=0;i<cand.length;i++){ v=+cand[i][key]; if(v!==v){ best=NaN; break; } if(v>best) best=v; }
  var thr=best-within, groups=[], cur=null;
  for(i=0;i<hours.length;i++){ var h=hours[i]; if(cand.indexOf(h)>=0&&h[key]>=thr){ if(cur&&cur.e===h.hr-1) cur.e=h.hr; else { cur={s:h.hr,e:h.hr}; groups.push(cur); } } }
  var win=null; for(i=0;i<groups.length;i++) if(!win||(groups[i].e-groups[i].s)>(win.e-win.s)) win=groups[i];
  return {best:best,win:win};
}
/* ώρα φωτός (με περιθώριο): ανατολή−pad έως δύση+pad */
function daylight(sm,hr,pad){ if(pad==null) pad=CFG0.window.daylightPad; var t=hr*60+30; return t>=sm.rise-pad&&t<=sm.set+pad; }

/* ---------- κλάσεις συνθηκών (μάθηση) ---------- */
function bins(sm,h,cfg){ var B=(cfg||CFG0).bins, o={}, t=h.hr*60+30;
  if(sm&&sm.rise!=null){ var mid=(sm.rise+sm.set)/2;
    o.sun=t<sm.rise-B.sun.nightPad||t>sm.set+B.sun.nightPad?0:t<sm.rise+B.sun.edge?1:t>sm.set-B.sun.edge?5:(t<mid-B.sun.midHalf?2:t<=mid+B.sun.midHalf?3:4); }
  if(h.ptrend) o.pt=(h.ptrend==='fast'||h.ptrend==='slow')?0:h.ptrend==='rise'?2:1;
  if(typeof h.pres==='number') o.pl=cls(h.pres,B.presLevel);
  if(typeof h.wind==='number') o.wind=cls(h.wind,B.wind);
  if(typeof h.wave==='number') o.wave=cls(h.wave,B.wave);
  if(h.tide) o.tide=h.tide==='up'?0:h.tide==='down'?1:2;
  if(h.cloud) o.cloud=h.cloud==='clear'?0:h.cloud==='part'?1:2;
  if(typeof h.mm==='number') o.rain=h.mm>=B.rainMm?1:0;   /* βροχή σε mm (όχι πιθανότητα), όπως στον server */
  /* ώρες μετά τη δύση, φάση σελήνης, εποχή */
  if(sm&&sm.rise!=null){ var m=h.hr*60+30; if(m>=sm.rise&&m<sm.set) o.aft=0; else if(m<sm.rise&&m>=sm.rise-B.preDawn) o.aft=5;
    else { var af=m>=sm.set?m-sm.set:m+1440-sm.set; o.aft=cls(af,B.afterSet)+1; } }
  if(sm&&typeof sm.f==='number') o.moon=Math.round(sm.f*B.moonPhases)%B.moonPhases;
  if(h.t){ var mo=+String(h.t).slice(5,7)-1; if(mo>=0) o.season=mo===11||mo<=1?0:mo<=4?1:mo<=7?2:3; }
  /* σκοτάδι: μέρα → 0· αλλιώς φάση σελήνης × ύψος σελήνης × σύννεφα */
  if(sm&&sm.rise!=null&&typeof h.mal==='number'){ var m2=h.hr*60+30, D=B.dark;
    if(m2>=sm.rise+D.dayPad&&m2<=sm.set-D.dayPad) o.dark=0;
    else { var cl=typeof h.clp==='number'?h.clp:(h.cloud==='clear'?D.cloudDefault.clear:h.cloud==='over'?D.cloudDefault.over:D.cloudDefault.other);
      var Lm=(sm.illum||0)*Math.max(0,Math.sin(h.mal*Math.PI/180))*(1-D.cloudDim*Math.min(100,Math.max(0,cl))/100); o.dark=cls(Lm,D.cuts)+1; } }
  if(typeof h.thd==='number') o.thc=h.thd===0?0:cls(h.thd,B.thermocline)+1;
  if(typeof h.chl==='number') o.chl=cls(h.chl,B.chl);
  if(typeof h.sst==='number') o.sstb=cls(h.sst,B.sst);
  return o; }

/* ---------- μάθηση από τα κοινά ευρήματα ----------
   L = {ins:[{f, b, lift, n, src}]}. Μόνο ισχυρά ευρήματα (και οι δύο μέθοδοι, ή ≥ minN ψάρια), με συρρίκνωση n/(n+shrink). Όριο πολλαπλασιαστή min–max.
   Αλλάζει το h επιτόπου (score, bite, learn) και το επιστρέφει, όπως το learnAdj του forecast.js. */
function learn(L,sm,h,cfg){ var C=(cfg||CFG0).learn;
  if(!L||!L.ins||!L.ins.length) return h;
  var bb=bins(sm,h,cfg), lg=0, m=[];
  for(var i=0;i<L.ins.length;i++){ var x=L.ins[i]; if(!(x.src==='both'||x.n>=C.minN)||bb[x.f]!==x.b||!(x.lift>0)) continue;
    var wt=x.n/(x.n+C.shrink); lg+=wt*Math.log(x.lift); m.push({f:x.f,b:x.b,lift:x.lift}); }
  if(!m.length) return h;
  var k=Math.max(C.min,Math.min(C.max,Math.exp(lg)));
  h.learn={k:Math.round(k*100)/100,m:m};
  if(typeof h.score==='number') h.score=Math.max(0,Math.min(100,Math.round(h.score*k)));
  if(typeof h.bite==='number') h.bite=Math.max(0,Math.min(100,Math.round(h.bite*k)));
  return h; }

/* ---------- data contract ----------
   Από μία ώρα πρόγνωσης (όπως τη φτιάχνει το PF.getForecast) σε {μεταβλητή: {v, src, q, unit}}.
   q: 'model' (μοντέλο καιρού/θάλασσας) · 'meas' (μέτρηση, π.χ. βαρόμετρο συσκευής, δορυφόρος) · 'est' (εκτίμηση/διόρθωση) ·
      'default' (λείπει και ο βαθμός χρησιμοποίησε προεπιλογή) · 'missing' (λείπει και δεν μετρά στον βαθμό).
   meta = {sm, src:{…}, extra:{current, depth, slope, clarity, frontChl, frontSst, …}} — ό,τι δεν δοθεί γράφεται «missing». */
function ent(v,unit,src,q){ var ok=v!=null&&!(typeof v==='number'&&v!==v); return ok?{v:v,unit:unit,src:src,q:q}:{v:null,unit:unit,src:null,q:'missing'}; }
function contract(h,meta,cfg){ cfg=cfg||CFG0; meta=meta||{}; var U=cfg.units, S=meta.src||{}, sm=meta.sm||null, X=meta.extra||{}, o={};
  var wx=S.weather||'open-meteo', sea=S.marine||'open-meteo-marine';
  o.wind=ent(h.wind,U.wind,wx,'model');
  o.gust=ent(h.gust,U.gust,wx,'model');
  o.windDir=ent(h.dir,U.windDir,wx,'model');
  /* κύμα: με τοπική διόρθωση ακτής είναι εκτίμηση· αν λείπει, ο βαθμός παίρνει την προεπιλογή του config και αυτό ΓΡΑΦΕΤΑΙ */
  o.wave=h.wave!=null?ent(h.wave,U.wave,h.waveOff!=null?sea+'+exposure':sea,h.waveOff!=null?'est':'model'):{v:cfg.waveDefault,unit:U.wave,src:'config',q:'default'};
  o.wavePeriod=ent(h.period,U.wavePeriod,sea,'model');
  o.pressure=ent(h.pres!=null?h.pres:h.p,U.pressure,S.pressure||wx,S.pressure?'meas':'model');
  o.pressureTrend=h.ptrend?ent(h.ptrend,U.pressureTrend,S.pressure||wx,h.pres!=null||h.p!=null?(S.pressure?'meas':'model'):'default'):{v:cfg.pressureDefault,unit:U.pressureTrend,src:'config',q:'default'};
  o.sst=ent(h.sst,U.sst,sea,'model');
  o.airTemp=ent(h.temp,U.airTemp,wx,'model');
  o.rainProb=ent(h.rain,U.rainProb,wx,'model');
  o.rainMm=ent(h.mm,U.rainMm,wx,'model');
  o.cloud=ent(h.clp,U.cloud,S.cloud||wx,S.cloud?'meas':'model');
  o.weatherCode=ent(h.code,U.weatherCode,wx,'model');
  o.tide=ent(h.tide,U.tide,sea,'model');
  o.moonPhase=ent(sm?sm.f:null,U.moonPhase,'astro','meas');
  o.moonIllum=ent(sm?sm.illum:null,U.moonIllum,'astro','meas');
  o.moonAlt=ent(h.mal,U.moonAlt,'astro','meas');
  o.minute=ent(typeof h.hr==='number'?h.hr*60+30:null,U.minute,'clock','meas');
  o.month=ent(h.t?+String(h.t).slice(5,7):null,U.month,'clock','meas');
  o.chl=ent(h.chl,U.chl,S.chl||'copernicus','meas');
  o.thermocline=ent(h.thd,U.thermocline,S.thd||'copernicus','model');
  /* δεν μπαίνουν ακόμα στον βαθμό ώρας (βάρος 0)· υπάρχουν στο contract ώστε να φαίνεται τι είναι διαθέσιμο */
  var extra=['current','currentDir','seaLevel','depth','slope','clarity','frontChl','frontSst'];
  for(var i=0;i<extra.length;i++){ var k=extra[i], e=X[k]; o[k]=e&&typeof e==='object'?ent(e.v,U[k],e.src||null,e.q||'model'):ent(e,U[k],e!=null?'unknown':null,'model'); }
  return o; }
/* σφάλματα του contract: άγνωστη μεταβλητή, λάθος μονάδα, τιμή χωρίς πηγή, άγνωστη ποιότητα, αριθμός εκτός λογικής */
function validate(input,cfg){ cfg=cfg||CFG0; var U=cfg.units, Q=cfg.quality, errs=[];
  for(var k in input) if(has(input,k)){ var e=input[k];
    if(!has(U,k)){ errs.push(k+': unknown variable'); continue; }
    if(!e||typeof e!=='object'){ errs.push(k+': not an entry'); continue; }
    if(e.unit!==U[k]) errs.push(k+': unit '+e.unit+' (expected '+U[k]+')');
    if(Q.indexOf(e.q)<0) errs.push(k+': quality '+e.q);
    if(e.q==='missing'){ if(e.v!=null) errs.push(k+': missing but has a value'); }
    else { if(e.v==null) errs.push(k+': no value'); if(!e.src) errs.push(k+': no source'); }
    if(typeof e.v==='number'&&(e.v!==e.v||!isFinite(e.v))) errs.push(k+': not a finite number'); }
  return errs; }

/* ---------- βεβαιότητα ----------
   Από το data contract και τα στοιχεία της πρόγνωσης. Δεν εξαρτάται από τον βαθμό.
   meta = {dayOffset (ημέρες από σήμερα), prof, unc:{bad} (διαφωνία μοντέλων), local (υπάρχει τοπική διόρθωση/βυθός), evidence:'strong'|'some'|'none'} */
function confidence(input,meta,cfg){ cfg=cfg||CFG0; meta=meta||{}; var C=cfg.confidence, why=[], P={};
  var skip=(C.notNeeded&&C.notNeeded[profOf(meta.prof,cfg)])||[], miss=function(k){ var e=input&&input[k]; return !e||e.q==='missing'||e.q==='default'; };
  var lvl=2, i, req=0, imp=0;
  for(i=0;i<C.required.length;i++) if(miss(C.required[i])){ req++; why.push(C.required[i]+' missing'); }
  for(i=0;i<C.important.length;i++){ var k=C.important[i]; if(skip.indexOf(k)>=0) continue; if(miss(k)){ imp++; why.push(k+' missing'); } }
  P.completeness=req?0:imp>=2?0:imp===1?1:2;
  var off=meta.dayOffset; P.horizon=typeof off!=='number'?2:off<=C.horizon.highTo?2:off<=C.horizon.mediumTo?1:0;
  if(P.horizon<2) why.push('day +'+off);
  lvl=Math.min(P.completeness,P.horizon);
  P.models=meta.unc&&meta.unc.bad?0:(meta.unc?2:1);
  if(meta.unc&&meta.unc.bad){ lvl+=C.adjust.modelDisagree; why.push('weather models disagree'); }
  P.local=meta.local?2:1; if(!meta.local) lvl+=C.adjust.noLocal;
  P.evidence=meta.evidence==='strong'?2:meta.evidence==='some'?1:0; if(meta.evidence==='strong') lvl+=C.adjust.evidenceStrong;
  /* οι προσαρμογές δεν ανεβάζουν ποτέ το επίπεδο πάνω από ό,τι επιτρέπουν τα δεδομένα και ο ορίζοντας */
  lvl=clamp(lvl,0,Math.min(P.completeness,P.horizon));
  return {level:C.levels[lvl],n:lvl,why:why,pillars:P}; }

/* ---------- όλα μαζί για μία ώρα πρόγνωσης ----------
   h = ώρα του PF.getForecast (τα h.score / h.bite / h.learn που έχει ήδη ΔΕΝ διαβάζονται: όλα ξαναϋπολογίζονται από τις συνθήκες).
   Στρώματα: 1) πυρήνας (βάρη του config) → 2) κοινά ευρήματα (meta.learn = {ins:[…]}, με τα φρένα τους).
   Με τα ίδια meta.learn / sp / prof, το αποτέλεσμα ισούται με το h.score / h.bite του getForecast. */
function evaluate(sm,h,meta,cfg){ cfg=cfg||CFG0; meta=meta||{}; var ctx={sp:meta.sp||null,prof:meta.prof||null};
  var w=Object.assign({},h,{bite:false}), ex=explain(sm,h.hr,w,ctx,cfg), core=ex.score, coreBite=hour(sm,h.hr,Object.assign({},h,{bite:true}),ctx,cfg);
  var x=Object.assign({},h,{score:core,bite:coreBite}); delete x.learn; x=learn(meta.learn||null,sm,x,cfg);
  var reasons=ex.reasons; if(x.learn&&x.score!==core) reasons=reasons.concat([{k:'learn',d:x.score-core,v:x.learn.k,unit:'x'}]);
  var inp=contract(h,{sm:sm,src:meta.src,extra:meta.extra},cfg);
  var ev=meta.evidence||(x.learn?'some':'none');
  return {score:x.score,bite:x.bite,core:core,coreBite:coreBite,raw:ex.raw,base:ex.base,reasons:reasons,learn:x.learn||null,input:inp,
    confidence:confidence(inp,{dayOffset:meta.dayOffset,prof:meta.prof,unc:meta.unc,local:meta.local!=null?meta.local:h.waveOff!=null,evidence:ev},cfg),cfg:cfg.version}; }

/* ---------- έγκυρη έξοδος ψαρέματος ----------
   ΕΝΑΣ κανόνας, ίδιος στην εφαρμογή και στον server, για το ποιες έξοδοι μετράνε όταν ελέγχουμε «πόσο έπεσε μέσα ο βαθμός».
   Αρχή: μια έξοδος μετρά όταν η ΥΠΑΡΞΗ της δεν εξαρτάται από το αν πιάστηκαν ψάρια. Έξοδος χωρίς ψάρια είναι το ίδιο έγκυρη με έξοδο με ψάρια.
     live         καταγράφηκε την ώρα του ψαρέματος (Έναρξη/Τέλος, ρολόι, εργαλείο που ποντίστηκε και σηκώθηκε, διαδρομή με ώρες)   → ΕΓΚΥΡΗ
     nofish       «Ψάρεψα, τίποτα»: ο χρήστης δήλωσε μόνος του έξοδο χωρίς ψάρι                                                  → ΕΓΚΥΡΗ
     manual       έξοδος που πέρασε ο χρήστης με το χέρι (με ή χωρίς ψάρια)                                                      → ΕΓΚΥΡΗ
     fromCatches  «Έξοδος από τα ψάρια της ημέρας»: φτιάχνεται ΜΟΝΟ για μέρες που έχουν ψάρια, άρα έχει πάντα ψάρια             → ΟΧΙ (θα έδειχνε τον βαθμό καλύτερο ή χειρότερο χωρίς λόγο)
     unknown      παλιά γραμμή του server χωρίς σημάδι, με στρογγυλές ώρες και ψάρια: δεν ξέρουμε αν είναι manual ή fromCatches   → ΟΧΙ, μέχρι να την ξαναστείλει η εφαρμογή με σημάδι
     invalid      λάθος ώρες, κάτω από minMin λεπτά, πάνω από maxHours ώρες (ξεχασμένη έξοδος) ή χωρίς θέση                       → ΟΧΙ
   Δέχεται έξοδο της εφαρμογής ({startMs, endMs, lat, manual, nothing, fromCatches, sid, track, count}) ή γραμμή του catch_obs ({ms, ms2, lat, cnt, cond:{k}}).
   Το σημάδι cond.k που στέλνει η εφαρμογή: 'l' live · 'n' nofish · 'm' manual · 'c' fromCatches · 'x' invalid.
   Ο κανόνας αφορά ΜΟΝΟ την αξιολόγηση. Η μάθηση «πότε τσιμπάνε» και η προσωπική πρόγνωση συνεχίζουν να χρησιμοποιούν όλες τις εξόδους όπως πριν. */
var SK={l:'live',n:'nofish',m:'manual',c:'fromCatches',x:'invalid'}, SKR={live:'l',nofish:'n',manual:'m',fromCatches:'c',invalid:'x'};
function session(t,cfg){ var S=(cfg||CFG0).session; if(!t) return {kind:'invalid',valid:false,why:'no trip',k:'x'};
  var app=t.startMs!=null||t.endMs!=null, s=+(app?t.startMs:t.ms), e=+(app?t.endMs:t.ms2), k=t.cond&&typeof t.cond.k==='string'?t.cond.k:null, cnt=+(app?t.count:t.cnt)||0;
  var out=function(kind,why){ var v=kind==='live'||kind==='nofish'||kind==='manual'; return {kind:kind,valid:v,why:why||null,k:SKR[kind]||null}; };
  if(!(s>0)||!(e>s)) return out('invalid','times');
  var lat=t.lat!=null?t.lat:(t.cond0&&t.cond0.lat); if(lat==null||lat==='') return out('invalid','position');
  var d=e-s; if(d<S.minMin*60000) return out('invalid','short'); if(d>S.maxHours*3600000) return out('invalid','long');
  if(t.fromCatches||k==='c') return out('fromCatches');
  if(k==='x') return out('invalid','flagged');
  if(t.nothing||k==='n') return out('nofish');
  if(t.manual||k==='m') return out('manual');
  if(k==='l'||t.sid||(Array.isArray(t.track)&&t.track.length)) return out('live');
  /* χωρίς σημάδι: οι έξοδοι που καταγράφονται ζωντανά έχουν ώρες με ακρίβεια χιλιοστού· όσες μπαίνουν με το χέρι, ακέραια λεπτά */
  if(s%60000!==0||e%60000!==0) return out('live');
  if(app) return out('manual');
  return cnt>0?out('unknown','legacy row'):out('nofish'); }

g.AlkyonScore={VERSION:CFG0.version,session:session,config:CFG0,hour:hour,explain:explain,window:windowOf,daylight:daylight,bins:bins,learn:learn,kindOf:kindOf,profOf:profOf,
  contract:contract,validate:validate,confidence:confidence,evaluate:evaluate,step:step,cls:cls,circDist:circDist,nearMin:nearMin,clamp:clamp};
})(typeof self!=='undefined'?self:this);

// ---- forecast.js ----
/* Πρόγνωση δραστηριότητας ψαριών (ίδιο μοντέλο με την καρτέλα «Σήμερα») και έλεγχος για ειδοποιήσεις.
   Χρησιμοποιείται από τη σελίδα και από το service worker (importScripts).
   1.14.84 (P1.1): ο βαθμός υπολογίζεται στον ενιαίο πυρήνα (score-core.js, AlkyonScore) με τα βάρη του score-config.js.
   Εδώ μένουν ο καιρός (Open-Meteo), ήλιος/σελήνη, οι ειδοποιήσεις και οι ρυθμίσεις του χρήστη (προφίλ, είδος, όρια)·
   το hourScore, το learnBins, το learnAdj και το παράθυρο της ημέρας καλούν τον πυρήνα. Ίδια αποτελέσματα με την 1.14.83 (tests/unit/score-parity). */
(function(g){
'use strict';
const AS=g.AlkyonScore, CFG=g.AlkyonScoreConfig;
if(!AS||!CFG) throw new Error('forecast.js: φόρτωσε πρώτα score-config.js και score-core.js');
const clamp=AS.clamp;
const pad=n=>String(n).padStart(2,'0');
const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14);
const circDist=AS.circDist;
/* offset (λεπτά) της Κύπρου για μια συγκεκριμένη μέρα, ώστε να μετράει η αλλαγή ώρας μέσα στην πρόγνωση */
function nicOffAt(date,fallback,zone){ try{ var p=new Intl.DateTimeFormat('en-US',{timeZone:zone||'Asia/Nicosia',timeZoneName:'shortOffset'}).formatToParts(new Date(date+'T12:00:00Z')).find(function(x){ return x.type==='timeZoneName'; }).value, m=/GMT([+-])(\d+)(?::(\d+))?/.exec(p); if(m) return (m[1]==='-'?-1:1)*(parseInt(m[2],10)*60+(m[3]?parseInt(m[3],10):0)); if(p==='GMT'||p==='UTC') return 0; }catch(e){} return fallback; }
/* v31z361: ακριβής θέση σελήνης (σειρά χαμηλής ακρίβειας του Meeus, ~0,3°) αντί για την παλιά προσέγγιση από τη φάση.
   Δίνει ώρες μεσουρανήματος (σελήνη από πάνω), αντιμεσουρανήματος (από κάτω), ανατολής και δύσης με ακρίβεια λίγων λεπτών. */
const RD=Math.PI/180;
const jdD=ms=>ms/86400000+2440587.5-2451545;
function sunLon(d){ const M=(357.529+0.98560028*d)*RD; return (M/RD+1.9148*Math.sin(M)+0.02*Math.sin(2*M)+180+102.9372)*RD; }
function moonEq(d){ const T0=d/36525;
  const L=218.32+481267.881*T0+6.29*Math.sin((135.0+477198.87*T0)*RD)-1.27*Math.sin((259.3-413335.36*T0)*RD)+0.66*Math.sin((235.7+890534.22*T0)*RD)+0.21*Math.sin((269.9+954397.74*T0)*RD)-0.19*Math.sin((357.5+35999.05*T0)*RD)-0.11*Math.sin((186.5+966404.03*T0)*RD);
  const B=5.13*Math.sin((93.3+483202.02*T0)*RD)+0.28*Math.sin((228.2+960400.89*T0)*RD)-0.28*Math.sin((318.3+6003.15*T0)*RD)-0.17*Math.sin((217.6-407332.21*T0)*RD);
  const lam=L*RD, b=B*RD, e=(23.4393-3.6e-7*d)*RD;
  return {ra:Math.atan2(Math.sin(lam)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(lam)),dec:Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(lam)),lam}; }
/* ύψος σελήνης (μοίρες, γεωκεντρικό) */
function moonAlt(ms,lat,lon){ const d=jdD(ms), m=moonEq(d), H=(280.46061837+360.98564736629*d)*RD+lon*RD-m.ra;
  return Math.asin(Math.sin(lat*RD)*Math.sin(m.dec)+Math.cos(lat*RD)*Math.cos(m.dec)*Math.cos(H))/RD; }
/* φάση: 0 = νέα, 0,5 = πανσέληνος· φωτισμός 0–1 */
function moonPhase(ms){ const d=jdD(ms), el=((moonEq(d).lam-sunLon(d))/RD%360+360)%360; return {f:el/360,illum:(1-Math.cos(el*RD))/2}; }
/* 1.9.44: επόμενη νέα σελήνη και πανσέληνος μετά από ms (ακρίβεια ~10′): {nw, full} σε ms */
/* 1.9.47: καλύτερα βράδια για καλαμάρι: ανά μέρα η καλύτερη ώρα γύρω από τη δύση (±90′) με άνεμο <8 kn, κύμα ≤0,6 m και ασφαλή,
   μόνο μέρες έως ~3 μέρες από τη νέα σελήνη (αν δοθεί nw). Ταξινόμηση από τον μεγαλύτερο βαθμό. */
/* 1.9.50: σκοτάδι για καλαμάρι: από το σούρουπο (δύση +30′) όσο η σελήνη είναι κάτω από τον ορίζοντα ή πολύ λεπτή (φωτισμός <15%),
   έως την ανατολή της ή την αυγή (ανατολή ηλίου −30′). Επιστρέφει {s,e,why} σε λεπτά από τα μεσάνυχτα της ημέρας (e μπορεί >1440): why 'moon' = βγαίνει το φεγγάρι, 'dawn' = σκοτάδι ως το πρωί. */
function darkWin(date,set,rise,lat,lon,tz){ if(set==null||rise==null||lat==null) return null;
  const [y,m,d]=date.split('-').map(Number), base=Date.UTC(y,m-1,d)-(tz||0)*60000, s0=set+30, e0=rise+1440-30, step=10;
  const dark=mn=>{ const ms=base+mn*60000; return moonAlt(ms,lat,lon)<0.125||moonPhase(ms).illum<0.15; };
  let s=null; for(let t=s0;t<e0;t+=step){ if(dark(t)){ s=Math.round(t); break; } } if(s==null) return null;
  for(let t=s;t<e0;t+=step){ if(!dark(t)) return {s,e:Math.round(t),why:'moon'}; }
  return {s,e:Math.round(e0),why:'dawn'}; }
/* κείμενο: «σκοτάδι 17:20 ως το πρωί» ή «σκοτάδι 22:40–01:30 (βγαίνει το φεγγάρι)» */
function darkTxt(w,en){ if(!w) return ''; const hm=m=>{ m=((Math.round(m)%1440)+1440)%1440; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); };
  return (en?'dark ':'σκοτάδι ')+hm(w.s)+(w.why==='dawn'?(en?' till morning':' ως το πρωί'):'–'+hm(w.e)+(en?' (moonrise)':' (βγαίνει το φεγγάρι)')); }
function squidEves(days,nw,opt){ const D=86400000, out=[], now=opt&&opt.now;
  for(const d of days||[]){ if(d.set==null) continue;
    if(nw!=null&&Math.abs(Date.parse(d.date+'T12:00:00Z')-nw)>3.5*D) continue;
    let best=null;
    for(const x of d.hours||[]){ if(Math.abs(x.hr*60+30-d.set)>90) continue; if(now&&x.t<now) continue;
      if(x.safe===false||(x.wind!=null&&x.wind>=8)||(x.wave!=null&&x.wave>0.6)) continue;
      if(!best||x.score>best.score) best=x; }
    if(best) out.push({date:d.date,hr:best.hr,score:best.score,wind:best.wind,wave:best.wave,set:d.set,dark:opt&&opt.lat!=null?darkWin(d.date,d.set,d.rise,opt.lat,opt.lon,opt.tz):null}); }
  return out.sort((a,b)=>b.score-a.score); }
function nextMoon(ms){ const H=3600000, fz=t=>moonPhase(t).f; let nw=null, full=null, t=ms, a=fz(t);
  for(let i=0;i<24*32&&(nw==null||full==null);i++){ const t2=t+6*H, b=fz(t2);
    if(nw==null&&b<a){ let lo=t, hi=t2; for(let k=0;k<12;k++){ const m=(lo+hi)/2; if(fz(m)<fz(lo)) hi=m; else lo=m; } nw=Math.round(hi); }
    if(full==null&&a<0.5&&b>=0.5){ let lo=t, hi=t2; for(let k=0;k<12;k++){ const m=(lo+hi)/2; if(fz(m)<0.5) lo=m; else hi=m; } full=Math.round(hi); }
    t=t2; a=b; }
  return {nw,full}; }
/* γεγονότα σελήνης μεταξύ ms0 και ms1: rise, set, upper (από πάνω), lower (από κάτω). Ανατολή/δύση στο +0,125° (γεωκεντρικό, με διάθλαση και παράλλαξη). */
function moonEvents(ms0,ms1,lat,lon){
  const step=10*60000, H0=0.125, out=[]; let a0=moonAlt(ms0-step,lat,lon), a1=moonAlt(ms0,lat,lon);
  for(let t=ms0;t<ms1;t+=step){
    const a2=moonAlt(t+step,lat,lon);
    if((a1-H0)*(a2-H0)<=0&&a1!==a2){ const k=(H0-a1)/(a2-a1); if(k>=0&&k<1) out.push({type:a2>a1?'rise':'set',t:t+k*step}); }
    if((a1>=a0&&a1>a2)||(a1<=a0&&a1<a2)){ const den=a0-2*a1+a2, x=den?0.5*(a0-a2)/den:0; out.push({type:a1>a0||a1>a2?'upper':'lower',t:t+x*step,alt:a1}); }
    a0=a1; a1=a2;
  }
  return out.sort((x,y)=>x.t-y.t);
}
/* περίοδοι solunar (Knight): κύριες ±45′ γύρω από σελήνη πάνω/κάτω, δευτερεύουσες ±30′ γύρω από ανατολή/δύση */
const SOL_MAJ=CFG.solunar.major.window, SOL_MIN=CFG.solunar.minor.window;
function solunarPeriods(ms0,ms1,lat,lon){
  return moonEvents(ms0-3*3600000,ms1+3*3600000,lat,lon).map(e=>{
    const maj=e.type==='upper'||e.type==='lower', w=(maj?SOL_MAJ:SOL_MIN)*60000;
    return {kind:maj?'major':'minor',ev:e.type,t:e.t,s:e.t-w,e:e.t+w};
  }).filter(p=>p.e>=ms0&&p.s<=ms1);
}
function sunMoon(dateStr,lat,lon,tz){
  const [y,m,d]=dateStr.split('-').map(Number);
  const noonUtc=Date.UTC(y,m-1,d,12);
  const n=Math.floor((noonUtc-Date.UTC(y,0,0))/86400000), la=lat*Math.PI/180;
  const gm=2*Math.PI/365*(n-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(gm)-0.032077*Math.sin(gm)-0.014615*Math.cos(2*gm)-0.040849*Math.sin(2*gm));
  const dec=0.006918-0.399912*Math.cos(gm)+0.070257*Math.sin(gm)-0.006758*Math.cos(2*gm)+0.000907*Math.sin(2*gm)-0.002697*Math.cos(3*gm)+0.00148*Math.sin(3*gm);
  const cosH=Math.cos(90.833*Math.PI/180)/(Math.cos(la)*Math.cos(dec))-Math.tan(la)*Math.tan(dec);
  const H=Math.acos(clamp(cosH,-1,1))*180/Math.PI;
  const noon=720-4*lon-eq+tz, rise=720-4*(lon+H)-eq+tz, set=720-4*(lon-H)-eq+tz;
  /* v31z361: σελήνη από ακριβή υπολογισμό. Λεπτά από τα μεσάνυχτα της τοπικής μέρας (μπορεί <0 ή >1440 για περιόδους που περνούν τα μεσάνυχτα) */
  const ms0=Date.UTC(y,m-1,d)-tz*60000, ph=moonPhase(ms0+12*3600000), mm=t=>(t-ms0)/60000;
  const per=solunarPeriods(ms0,ms0+86400000,lat,lon), pick=(k)=>{ const e=per.find(p=>p.ev===k&&p.t>=ms0&&p.t<ms0+86400000); return e?((mm(e.t)%1440)+1440)%1440:null; };
  return {rise,set,f:ph.f,illum:ph.illum,ms0,
    maj:per.filter(p=>p.kind==='major').map(p=>mm(p.t)), min:per.filter(p=>p.kind==='minor').map(p=>mm(p.t)), periods:per,
    transit:pick('upper'),anti:pick('lower'),mrise:pick('rise'),mset:pick('set')};
}
/* απόσταση (λεπτά) της ώρας t από την πιο κοντινή περίοδο μιας λίστας */
const nearMin=AS.nearMin;
/* v31z363: είδος-στόχος για τον βαθμό. Στη σελίδα έρχεται από «Τι να ψαρέψω» (alkyon-advsp + knowledge.js),
   στον server και στο service worker από τη ρύθμιση (cfg.sp = {n, l, sst}). */
function targetSp(w){
  if(w&&w.sp) return w.sp;
  try{ if(typeof localStorage==='undefined') return null; const n=localStorage.getItem('alkyon-advsp'); if(!n) return null; let v=n; try{ v=JSON.parse(n); }catch(x){} if(!v) return null;
    const kb=(typeof self!=='undefined'&&self.SPKB)||[], e=kb.find(k=>k.n===v); return e?{n:e.n,l:e.l,sst:e.sst}:{n:v}; }catch(e){ return null; }
}
/* ειδικοί κανόνες από μελέτες: καλαμάρι (Cabanellas-Reboredo κ.ά. 2012, Μαγιόρκα), ξιφίας (Ceyhan κ.ά. 2018, Αν. Μεσόγειος) */
function spKind(sp){ return AS.kindOf(sp); }
/* 1.9.27: τι λέει η έρευνα για τη φάση της σελήνης σε κάθε είδος (k: 'new' μετρά στον βαθμό, 'none' ψάχτηκε και δεν βρέθηκε, null καμία μελέτη) */
function moonInfo(sp){
  if(sp===undefined) sp=targetSp({});
  const s=((sp&&(sp.l||''))+' '+(sp&&sp.n||'')).toLowerCase();
  if(/loligo|καλαμάρ|squid/.test(s)) return {k:'new',el:'Καλαμάρι: πιο πολλά κοντά στη νέα σελήνη, με λίγο άνεμο και χαμηλή πίεση, σε ένα στενό παράθυρο γύρω από το σούρουπο. Μετρά στον βαθμό.',en:'Squid: more near the new moon, with light wind and low pressure, in a short window around sunset. Counted in the score.',src:'Cabanellas-Reboredo et al. 2012, ICES J. Mar. Sci. (Mallorca)'};
  if(/sarda|scomber|thunnus|euthynnus|auxis|παλαμίδ|σκουμπρ|κολιό|τόνο|bonito|mackerel|tuna/.test(s)) return {k:'none',el:'Οικογένεια του τόνου (παλαμίδα, σκουμπρί, τόνος): με φεγγάρι κατεβαίνουν πιο βαθιά τη νύχτα, αλλά οι μελέτες δεν βρίσκουν διαφορά στο πόσα πιάνονται. Δεν μετρά στον βαθμό.',en:'Tuna family (bonito, mackerel, tuna): with moonlight they go deeper at night, but studies find no difference in catch rates. Not counted in the score.',src:'Andrzejaczek et al. 2024, Rev. Fish Biol. Fish. (190 studies)'};
  if(/xiphias|ξιφ|swordfish/.test(s)) return {k:'none',el:'Ξιφίας: παγκόσμια πιάνεται περισσότερο με φεγγάρι, αλλά στην Ανατολική Μεσόγειο δεν βρέθηκε διαφορά. Δεν μετρά στον βαθμό.',en:'Swordfish: worldwide more are caught with moonlight, but no difference was found in the Eastern Mediterranean. Not counted in the score.',src:'Andrzejaczek et al. 2024; Ceyhan et al. 2018'};
  if(/diplodus sargus|σαργό|white seabream/.test(s)) return {k:'none',el:'Σαργός: η ανασκόπηση για τον σαργό δεν αναφέρει ρόλο της σελήνης. Μετρούν η θερμοκρασία, η παλίρροια και ο καιρός. Δεν μετρά στον βαθμό.',en:'White seabream: the review on this species reports no role for the moon. Temperature, tide and weather matter. Not counted in the score.',src:'Giacalone et al. 2022, Environ. Biol. Fish.'};
  if(sp&&(sp.n||sp.l)) return {k:null,el:'Δεν υπάρχει μελέτη για τη φάση της σελήνης σε αυτό το ψάρι, γι’ αυτό δεν μετρά στον βαθμό. Μετρά ό,τι δείχνουν τα δικά σου ψάρια.',en:'There is no study on moon phase for this fish, so it is not counted in the score. What your own catches show is what counts.',src:''};
  return {k:null,el:'Η φάση μετρά μόνο όταν διαλέξεις είδος που έχει μελέτη (π.χ. καλαμάρι). Στα άλλα ψάρια οι μελέτες βρίσκουν μικρή επίδραση (5–10%) και με αντίθετη κατεύθυνση από είδος σε είδος.',en:'Moon phase counts only when you pick a species with a study (e.g. squid). For other fish, studies find a small effect (5–10%) that goes in opposite directions between species.',src:'Pulver 2017, N. Am. J. Fish. Manage.; Lowry et al. 2007, Fish. Res.'};
}
/* Ο βαθμός της ώρας. Εδώ διαβάζονται μόνο οι ρυθμίσεις του χρήστη· ο υπολογισμός είναι στο AlkyonScore.hour (score-core.js) με τα βάρη του score-config.js.
   w.bite = μόνο «τσίμπημα» (σαν να ήταν ήρεμη η θάλασσα). w.sp / w.prof αν δοθούν υπερισχύουν των ρυθμίσεων (server, ρολόι, service worker). */
function scoreCtx(w){
  /* προφίλ ψαρέματος. Στο service worker και στον server δεν υπάρχει localStorage, άρα χωρίς w.prof ισχύει «βάρκα». */
  let prof=w.prof; if(!prof){ try{ prof=typeof localStorage!=='undefined'?localStorage.getItem('alkyon-fprof'):null; }catch(e){ prof=null; } }
  return {sp:targetSp(w),prof};
}
function hourScore(sm,hr,w){ return AS.hour(sm,hr,w,scoreCtx(w)); }
const bft=w=>[1,4,7,11,17,22,28,34,41,48,56,64].filter(x=>x<=w).length;
/* v31z525: όρια «ασφαλούς» ώρας ρυθμίζονται από τον χρήστη (alkyon-limits: kn, kn, m)· προεπιλογή όπως πριν */
const LIMD={wind:CFG.limits.wind,wave:CFG.limits.wave,gust:CFG.limits.gust}; let LIMO=null;
function lims(){ if(LIMO) return Object.assign({},LIMD,LIMO); try{ const o=typeof localStorage!=='undefined'?JSON.parse(localStorage.getItem('alkyon-limits')||'null'):null; if(o&&typeof o==='object') return Object.assign({},LIMD,o); }catch(e){} return LIMD; }
const safeHour=h=>{ const L=lims(); return h.wind<=L.wind&&(h.wave==null||h.wave<=L.wave)&&(h.gust==null||h.gust<=L.gust)&&(h.code==null||h.code<CFG.storm.code); };
/* 1.14.23: «ο δείκτης μαθαίνει»: τα ευρήματα του «Πότε τσιμπάνε» (bite_stats) διορθώνουν λίγο τον δείκτη κάθε ώρας.
   Μόνο ισχυρά ευρήματα (και οι δύο μέθοδοι, ή ≥ 15 ψάρια), με «συρρίκνωση» n/(n+60): λίγα στοιχεία → σχεδόν καμία αλλαγή. Όριο ±15%.
   h.learn = τι ταίριαξε (για την εξήγηση). */
function learnBins(sm,h){ return AS.bins(sm,h); }
/* 1.14.24: {by:{sea,spear,lake}} → η ομάδα του προφίλ (σκάφος/ακτή = θάλασσα με καλάμι) */
const CEPH_L=['loligo vulgaris','loligo forbesii','alloteuthis media','alloteuthis subulata','todarodes sagittatus','illex coindetii','ommastrephes bartramii','sepia officinalis','sepia elegans','sepia orbignyana','sepioteuthis lessoniana','octopus vulgaris','eledone cirrhosa','eledone moschata'];
/* 1.14.26: με στόχο είδος: πρώτα τα ευρήματα του είδους (με δανεισμό από την ομάδα του), μετά κεφαλόποδα αν είναι κεφαλόποδο, αλλιώς η ομάδα του προφίλ */
function learnPick(L,sp){ if(!L||!L.by) return L; const la=String(sp&&typeof sp==='object'?(sp.l||''):(sp||'')).toLowerCase(); if(la){ if(L.sp&&L.sp[la]) return L.sp[la]; if(CEPH_L.indexOf(la)>=0) return L.by.ceph||null; } let p='boat'; try{ p=(typeof window!=='undefined'&&window.AK&&window.AK.prof)?window.AK.prof():'boat'; }catch(e){} return L.by[p==='spear'?'spear':p==='lake'?'lake':'sea']||null; }
function learnAdj(L,sm,h){ return AS.learn(L,sm,h); }
function ptrendOf(d){return d<=-3?'fast':d<=-1?'slow':d>=1?'rise':'stable';}
async function fetchJson(url,fetchFn){
  const f=fetchFn||fetch, ac=typeof AbortController!=='undefined'?new AbortController():null, t=ac&&setTimeout(()=>ac.abort(),12000);
  try{ const r=await f(url,ac?{signal:ac.signal}:undefined); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  finally{ if(t) clearTimeout(t); }
}
/* Επιστρέφει {days:[{date,best,win,hours,avgWind,avgWave,safe,why,wx}], tz, nowLocal}. opt.days = πόσες ημέρες (προεπιλογή 3, έως 14). */
const EXPC={};
async function getForecast(lat,lon,fetchFn,opt){
  const nd=Math.min(14,Math.max(1,(opt&&opt.days)||3));
  const q='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4);
  const [w,m]=await Promise.allSettled([
    fetchJson('https://api.open-meteo.com/v1/forecast?'+q+'&hourly=pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,temperature_2m,precipitation_probability,precipitation,weather_code&wind_speed_unit=kn&timezone=auto&past_days=2&forecast_days='+(nd+1),fetchFn),
    fetchJson('https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=wave_height,wave_period,wind_wave_height,swell_wave_height,sea_surface_temperature,sea_level_height_msl&timezone=auto&past_days=2&forecast_days='+(nd+1),fetchFn)
  ]);
  if(w.status!=='fulfilled') throw new Error('weather');
  const H=w.value.hourly||{}, T=H.time||[], tz=Math.round((w.value.utc_offset_seconds||0)/60);
  const mar={}; if(m.status==='fulfilled'&&m.value.hourly&&m.value.hourly.time){ const MH=m.value.hourly; MH.time.forEach((t,i)=>{mar[t]={ww:MH.wind_wave_height?MH.wind_wave_height[i]:null,sw:MH.swell_wave_height?MH.swell_wave_height[i]:null,wave:MH.wave_height?MH.wave_height[i]:null,period:MH.wave_period?MH.wave_period[i]:null,sst:MH.sea_surface_temperature?MH.sea_surface_temperature[i]:null,lvl:MH.sea_level_height_msl?MH.sea_level_height_msl[i]:null};}); }
  const tideAt=(t)=>{ const i=m.status==='fulfilled'&&m.value.hourly&&m.value.hourly.time?m.value.hourly.time.indexOf(t):-1; const L=i>0&&m.value.hourly.sea_level_height_msl; if(!L||typeof L[i-1]!=='number'||typeof L[i+1]!=='number') return null; const d=L[i+1]-L[i-1]; return d>0.01?'up':d<-0.01?'down':'slack'; };
  const nowLocal=new Date(Date.now()+tz*60000).toISOString().slice(0,16);
  const today=nowLocal.slice(0,10);
  /* 1.2.1: και οι 2 προηγούμενες μέρες (past_days=2), βαθμολογημένες με τον ίδιο τρόπο, σε χωριστό fc.past· το fc.days μένει από σήμερα */
  const past0=(()=>{ const d=new Date(today+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-2); return d.toISOString().slice(0,10); })();
  const at=(k,i)=>H[k]?H[k][i]:null, nn=v=>typeof v==='number'?v:null;
  /* 1.9.11: κατεύθυνση ανέμου ως προς την ακτή. Όταν ο άνεμος έρχεται από τη στεριά (λίγα km ανοιχτής θάλασσας προς τα εκεί),
     το κύμα ανέμου κοντά στο σημείο είναι μικρότερο από του μοντέλου (που είναι ανοιχτά). Μειώνεται ΜΟΝΟ το κύμα ανέμου (fetch-limited),
     το swell μένει όλο, και η τιμή δεν ανεβαίνει ποτέ πάνω από του μοντέλου. Μόνο στην εφαρμογή (χρειάζεται τον χάρτη ακτής). */
  const EXP=(opt&&opt.local===false)?null:(()=>{ try{ const X=typeof window!=='undefined'?window.AlkyonExposure:null; const k=lat.toFixed(3)+','+lon.toFixed(3); let r=EXPC[k]; if(r===undefined){ r=X&&X.compute?X.compute(lat,lon):null; EXPC[k]=r; } return r&&r.dirs?{r,hs:X.hs}:null; }catch(e){ return null; } })();
  const localWave=(mm,ws,dir)=>{ if(!EXP||mm.wave==null||mm.ww==null||mm.sw==null||ws==null||dir==null) return null;
    const f=EXP.r.dirs[Math.round((((dir%360)+360)%360)/22.5)%16].km; if(!(f<20)) return null;
    const wl=EXP.hs(ws*0.5144,Math.max(0.5,f)), ww=Math.min(mm.ww,wl), v=Math.sqrt(mm.sw*mm.sw+ww*ww);
    return v<mm.wave-0.05?Math.round(v*100)/100:null; };
  const byDay={};
  for(let i=0;i<T.length;i++){
    const t=T[i], date=t.slice(0,10); if(date<past0) continue;
    const p=at('pressure_msl',i), p0=i>=3?H.pressure_msl[i-3]:null, c=at('cloud_cover',i), ws=at('wind_speed_10m',i);
    if(ws==null) continue;
    const mm=mar[t]||{};
    (byDay[date]=byDay[date]||[]).push({t,hr:+t.slice(11,13),pres:p,wind:ws,gust:nn(at('wind_gusts_10m',i)),dir:nn(at('wind_direction_10m',i)),temp:nn(at('temperature_2m',i)),rain:nn(at('precipitation_probability',i)),mm:nn(at('precipitation',i)),code:nn(at('weather_code',i)),p:nn(p),cc:nn(c),
      wave:(()=>{ const lw=localWave(mm,ws,nn(at('wind_direction_10m',i))); return lw!=null?lw:nn(mm.wave); })(),waveOff:localWave(mm,ws,nn(at('wind_direction_10m',i)))!=null?nn(mm.wave):null,period:nn(mm.period),sst:nn(mm.sst),tide:tideAt(t),ptrend:(p!=null&&p0!=null)?ptrendOf(p-p0):'stable',clp:c,cloud:c==null?'part':c<20?'clear':c<70?'part':'over'});
  }
  const num=a=>a.filter(v=>typeof v==='number'), av=a=>{a=num(a);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}, mx=a=>{a=num(a);return a.length?Math.max(...a):null;}, mn=a=>{a=num(a);return a.length?Math.min(...a):null;};
  const days=[], past=[], dks=Object.keys(byDay).sort();
  for(const date of dks.filter(x=>x<today).concat(dks.filter(x=>x>=today).slice(0,nd))){
    const zn=(typeof w.value.timezone==='string')?w.value.timezone:null, tzd=zn?nicOffAt(date,tz,zn):(tz===120||tz===180)?nicOffAt(date,tz):tz, sm=sunMoon(date,lat,lon,tzd), rows=byDay[date];
    const LRN=learnPick((opt&&opt.learn)||(opt&&opt.learn===false?null:(typeof window!=='undefined'&&window.AlkyonLearn)||null),opt&&opt.sp);
    const chl=(opt&&typeof opt.chl==='number'&&(Date.parse(date)-Date.parse(today))/864e5<=2)?opt.chl:null, thd=(opt&&typeof opt.thd==='number'&&(Date.parse(date)-Date.parse(today))/864e5<=2)?opt.thd:null;
    const hours=rows.map(h=>learnAdj(LRN,sm,{chl,thd,mal:LRN?moonAlt(Date.parse(h.t+':00Z')-tzd*60000,lat,lon):null,clp:h.clp,mm:h.mm,t:h.t,hr:h.hr,p:h.p,pres:h.pres,wind:h.wind,wave:h.wave,waveOff:h.waveOff,gust:h.gust,code:h.code,ptrend:h.ptrend,tide:h.tide,dir:h.dir,temp:h.temp,rain:h.rain,cloud:h.cloud,sst:h.sst,period:h.period,score:hourScore(sm,h.hr,opt&&opt.sp?Object.assign({sp:opt.sp},h):h),bite:hourScore(sm,h.hr,Object.assign(opt&&opt.sp?{sp:opt.sp}:{},h,{bite:true})),safe:safeHour(h)}));
    const day=h=>AS.daylight(sm,h.hr);
    const cand=hours.filter(h=>h.safe&&day(h)&&(date!==today||h.t>=nowLocal.slice(0,13)+':00'));
    /* παράθυρο της ημέρας (AlkyonScore.window): η μεγαλύτερη σειρά ασφαλών ωρών φωτός κοντά στον καλύτερο βαθμό */
    const W1=AS.window(hours,cand,'score'), best=cand.length?W1.best:0, win=W1.win;
    /* 1.9.32: τσίμπημα της μέρας: καλύτερη ώρα φωτός ανεξάρτητα από άνεμο/κύμα (και στις ώρες εκτός ορίων) */
    const bc=hours.filter(h=>day(h)&&(date!==today||h.t>=nowLocal.slice(0,13)+':00')), W2=AS.window(hours,bc,'bite'), bite=W2.best, biteWin=W2.win;
    const used=win?hours.filter(h=>h.hr>=win.s&&h.hr<=win.e):hours;
    const why=cand.length?'':(hours.some(h=>h.safe&&day(h))?'night':'unsafe');
    const dr=rows.filter(r=>AS.daylight(sm,r.hr)), use=dr.length?dr:rows;
    const cnt={}; let storm=false; use.forEach(r=>{ if(r.code!=null){ cnt[r.code]=(cnt[r.code]||0)+1; if(r.code>=95) storm=true; } });
    const mode=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];
    const mid=rows.find(r=>r.hr===12)||rows[0];
    const wx={tmax:mx(rows.map(r=>r.temp)),tmin:mn(rows.map(r=>r.temp)),windAvg:av(use.map(r=>r.wind)),windMax:mx(use.map(r=>r.wind)),gustMax:mx(use.map(r=>r.gust)),windDir:mid?mid.dir:null,
      rainMax:mx(use.map(r=>r.rain)),rainMm:num(rows.map(r=>r.mm)).reduce((x,y)=>x+y,0),code:storm?95:(mode!=null?+mode:null),cloudAvg:av(use.map(r=>r.cc)),
      pStart:rows[0].p,pEnd:rows[rows.length-1].p,waveMax:mx(use.map(r=>r.wave)),waveAvg:av(use.map(r=>r.wave)),period:av(use.map(r=>r.period)),sst:av(rows.map(r=>r.sst)),illum:(1-Math.cos(2*Math.PI*sm.f))/2,rise:sm.rise,set:sm.set};
    (date<today?past:days).push({date,f:sm.f,rise:sm.rise,set:sm.set,best,win,bite,biteWin,why,hours,avgWind:av(used.map(h=>h.wind)),avgWave:av(used.filter(h=>h.wave!=null).map(h=>h.wave)),safe:cand.length>0,wx});
  }
  /* ωριαίο κύμα/βροχή και των 2 προηγούμενων ημερών, για την ορατότητα νερού (v31z531): [ώρα, κύμα, mm] */
  const wl=[]; for(let i=0;i<T.length;i++){ const t=T[i], mm=mar[t]||{}, r=nn(at('precipitation',i)); if(mm.wave==null&&r==null) continue; wl.push([t,mm.wave==null?null:Math.round(mm.wave*100)/100,r]); }
  /* 1.14.28: βεβαιότητα: πόσο διαφωνούν 3 μοντέλα (ECMWF, GFS, ICON) για τον μέσο άνεμο στις ώρες φωτός */
  if(opt&&opt.ens){ try{ const E=await ensSpread(lat,lon,fetchFn,nd); for(const d of days){ const e=E[d.date]; if(e){ d.unc=e; } } }catch(e){} }
  return {days,past,tz,nowLocal,wl};
}
const ENSC={};
async function ensSpread(lat,lon,fetchFn,nd){ const ck=lat.toFixed(2)+','+lon.toFixed(2); if(ENSC[ck]&&Date.now()-ENSC[ck].t<3*3600e3) return ENSC[ck].v; const v=await ensSpread0(lat,lon,fetchFn,nd); ENSC[ck]={t:Date.now(),v}; return v; }
async function ensSpread0(lat,lon,fetchFn,nd){
  const j=await fetchJson('https://api.open-meteo.com/v1/forecast?latitude='+lat.toFixed(3)+'&longitude='+lon.toFixed(3)+'&hourly=wind_speed_10m&models=ecmwf_ifs025,gfs_seamless,icon_seamless&wind_speed_unit=kn&timezone=auto&forecast_days='+Math.min(14,(nd||7)+1),fetchFn);
  const H=(j&&j.hourly)||{}, T=H.time||[], M=['ecmwf_ifs025','gfs_seamless','icon_seamless'].map(k=>H['wind_speed_10m_'+k]).filter(a=>Array.isArray(a)); if(M.length<2) return {};
  const by={}; T.forEach((t,i)=>{ const hr=+t.slice(11,13); if(hr<6||hr>19) return; const d=t.slice(0,10); const o=by[d]=by[d]||M.map(()=>[]); M.forEach((a,k)=>{ if(typeof a[i]==='number') o[k].push(a[i]); }); });
  const out={}; for(const d of Object.keys(by)){ const mean=by[d].map(a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null).filter(v=>v!=null); if(mean.length<2) continue; const lo=Math.min(...mean), hi=Math.max(...mean); out[d]={lo:Math.round(lo),hi:Math.round(hi),spread:Math.round(hi-lo),bad:hi-lo>=6&&hi>=10}; }
  return out; }
/* 1.14.28: «Γιατί 72;»: πόσο ανεβάζει/κατεβάζει τον βαθμό κάθε παράγοντας (σύγκριση με «ουδέτερη» τιμή), συν όσα μετρήθηκαν (μάθηση). */
function explainHour(sm,h,sp){ const w=Object.assign({},h,{bite:true}); if(sp) w.sp=sp; delete w.learn; const base=hourScore(sm,h.hr,w);
  const G={pt:{ptrend:'stable',pres:null},wind:{wind:8,gust:null},wave:{wave:0.3},sky:{cloud:'part',code:null,rain:0},water:{sst:null,temp:null}}, parts=[]; let sum=0;
  for(const k of Object.keys(G)){ const v=hourScore(sm,h.hr,Object.assign({},w,G[k])), d=base-v; if(Math.abs(d)>=1){ parts.push({k,d}); sum+=d; } }
  const rest=base-50-sum; if(Math.abs(rest)>=1) parts.push({k:'time',d:Math.round(rest)});
  const lk=(h.learn&&typeof h.bite==='number')?Math.round(h.bite-base):0; if(Math.abs(lk)>=1) parts.push({k:'learn',d:lk});
  return {base,score:base+lk,parts:parts.sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))}; }
/* Βρίσκει την πρώτη ιδανική ώρα τις επόμενες ~36 ώρες. */
function findIdeal(fc,threshold){
  const hourNow=fc.nowLocal.slice(0,13);
  for(const d of fc.days.slice(0,2)){
    if(!d.win||d.best<threshold) continue;
    const start=d.date+'T'+pad(d.win.s)+':00';
    if(d.date===fc.nowLocal.slice(0,10)&&start<hourNow+':00'&&d.win.e<+fc.nowLocal.slice(11,13)) continue;
    return {key:d.date+'T'+pad(d.win.s),date:d.date,win:d.win,best:d.best,wind:d.avgWind,wave:d.avgWave,isToday:d.date===fc.nowLocal.slice(0,10)};
  }
  return null;
}
function message(f){
  const day=f.isToday?'Σήμερα':'Αύριο';
  return {title:'Ιδανική ώρα για ψάρεμα',body:day+' '+pad(f.win.s)+':00–'+pad((f.win.e+1)%24)+':00 · δείκτης '+f.best+' · άνεμος '+bft(f.wind)+' Bft'+(f.wave!=null?' · κύμα '+f.wave.toFixed(1)+' m':'')};
}
/* cfg: {lat,lon,threshold,last}. Επιστρέφει {notify,key} ή null. */
async function check(cfg,fetchFn){
  if(!cfg||cfg.lat==null) return null;
  const fc=await getForecast(cfg.lat,cfg.lon,fetchFn);
  const f=findIdeal(fc,cfg.threshold||75);
  if(!f||f.key===cfg.last) return null;
  const m=message(f); return {title:m.title,body:m.body,key:f.key};
}
/* Απότομη αλλαγή πίεσης τις επόμενες ~30 ώρες: ≥3 hPa σε 3 ώρες ή ≥6 hPa σε 12 ώρες. */
function pressureEvent(fc){
  const now=fc.nowLocal.slice(0,13)+':00', fut=[];
  fc.days.forEach(d=>d.hours.forEach(h=>{ if(h.p!=null&&h.t>=now) fut.push(h); }));
  let best=null;
  for(const [n,lim] of [[3,3],[12,6]]){
    for(let i=0;i+n<fut.length&&i<30;i++){
      const d=fut[i+n].p-fut[i].p;
      if(Math.abs(d)>=lim&&(!best||Math.abs(d)/lim>best.k)) best={d,k:Math.abs(d)/lim,from:fut[i].p,to:fut[i+n].p,t:fut[i].t,hours:n};
    }
  }
  return best?{dir:best.d<0?'fall':'rise',delta:Math.round(Math.abs(best.d)*10)/10,from:Math.round(best.from),to:Math.round(best.to),t:best.t,hours:best.hours}:null;
}
/* Αλλαγή ανέμου τις επόμενες `hours` ώρες σε σχέση με την τωρινή ώρα: διεύθυνση ≥deg° (όταν και οι δύο ≥4 kn) ή ένταση ≥kn. */
function windEvent(fc,w){
  const deg=(w&&w.deg)||60, kn=(w&&w.kn)||6, hours=(w&&w.hours)||6;
  const now=fc.nowLocal.slice(0,13), hs=[];
  fc.days.forEach(d=>d.hours.forEach(h=>{ if(h.t.slice(0,13)>=now&&h.wind!=null) hs.push(h); }));
  hs.sort((a,b)=>a.t<b.t?-1:1);
  if(hs.length<2) return null;
  const h0=hs[0], lim=hs.slice(1,hours+1);
  for(let i=0;i<lim.length;i++){
    const h=lim[i], ds=Math.abs(h.wind-h0.wind);
    /* 1.9.52: η στροφή μετρά μόνο με αισθητό άνεμο και στις δύο ώρες (≥7 kn)· η αλλαγή έντασης μόνο αν ο ισχυρότερος από τους δύο φτάνει τα 10 kn.
       Πριν: «NW 0 kn → NE 5 kn» έβγαινε ως αλλαγή ανέμου, ενώ είναι νηνεμία προς ελαφρύ αεράκι. */
    let dd=0; if(h0.dir!=null&&h.dir!=null&&h0.wind>=7&&h.wind>=7){ dd=Math.abs(h.dir-h0.dir)%360; if(dd>180) dd=360-dd; }
    if(dd>=deg||(ds>=kn&&Math.max(h.wind,h0.wind)>=10)) return {from:h0,to:h,dd,ds,inH:i+1};
  }
  return null;
}
/* Σημεία καμπής της πίεσης (κορυφή/κοιλάδα) σε λείανση 3 σημείων. Επιστρέφει γεγονότα:
   {kind:'peak-soon'|'trough-soon'|'peak-past'|'trough-past', t, p, h}. "soon" = σε ≤3 ώρες, "ahead" = σε 4–24 ώρες, "past" = ξεκίνησε η πτώση/άνοδος τις τελευταίες ≤4 ώρες (επιβεβαιωμένη ≥0.1 hPa). */
const TURN_PROM=0.3; /* η προηγούμενη πορεία (άνοδος πριν από κορυφή, πτώση πριν από κοιλάδα) πρέπει να είναι τουλάχιστον τόσο */
const TURN_REV=0.1;  /* v31z351: η αντιστροφή μετά την καμπή μετρά από 0,1 hPa (όχι 0,3), ώστε η ειδοποίηση να έρχεται μόλις αρχίσει η αλλαγή */
/* καμπή: πριν από αυτήν πορεία ≥0,3 hPa (μέσα σε 6 ώρες) και μετά αντιστροφή ≥0,1 hPa */
function turnOk(s,i,isMax){
  const lo=Math.max(0,i-6), hi=Math.min(s.length-1,i+6), pre=s.slice(lo,i+1), post=s.slice(i,hi+1);
  const before=isMax?s[i]-Math.min.apply(null,pre):Math.max.apply(null,pre)-s[i];
  const after=isMax?s[i]-Math.min.apply(null,post):Math.max.apply(null,post)-s[i];
  return before>=TURN_PROM-1e-6&&after>=TURN_REV-1e-6;
}
function pressureTurns(fc){
  const hs=[]; fc.days.forEach(d=>d.hours.forEach(h=>{ if(h.p!=null) hs.push(h); }));
  hs.sort((a,b)=>a.t<b.t?-1:1);
  if(hs.length<8) return [];
  const raw=hs.map(h=>h.p), s=raw.map((v,i)=>i>0&&i<raw.length-1?0.25*raw[i-1]+0.5*v+0.25*raw[i+1]:v);
  const now=fc.nowLocal.slice(0,13); let n0=-1; hs.forEach((h,i)=>{ if(h.t.slice(0,13)<=now) n0=i; });
  if(n0<0) return [];
  const out=[];
  for(let i=Math.max(3,n0-6);i<=Math.min(s.length-3,n0+24);i++){
    let isMax=true,isMin=true;
    for(let k=-2;k<=2;k++){ if(!k) continue; if(s[i+k]>s[i]) isMax=false; if(s[i+k]<s[i]) isMin=false; if(s[i+k]===s[i]&&k<0){ isMax=false; isMin=false; } }
    if(!isMax&&!isMin) continue;
    if(!turnOk(s,i,isMax)) continue;
    const ahead=i-n0, base={t:hs[i].t,p:Math.round(s[i]*10)/10,h:Math.abs(ahead)};
    if(ahead>0&&ahead<=3) out.push(Object.assign({kind:isMax?'peak-soon':'trough-soon'},base));
    else if(ahead>3) out.push(Object.assign({kind:isMax?'peak-ahead':'trough-ahead'},base));
    else if(ahead<=0&&ahead>=-6){ const mv=isMax?s[i]-s[n0]:s[n0]-s[i]; if(ahead<0&&mv>=TURN_REV-1e-6) out.push(Object.assign({kind:isMax?'peak-past':'trough-past'},base)); }
  }
  return out;
}
/* v31z355: έναρξη ανόδου. Ρυθμός = αλλαγή σε 3 ώρες (λειασμένη). «Άνοδος» από +0,5 hPa/3ω (RISE_RATE).
   Έναρξη = η πρώτη ώρα που ο ρυθμός περνά το όριο, αφού για 3 ώρες πριν δεν ήταν πάνω από αυτό (πτώση ή σταθερή). v31z357: 3 ώρες (ήταν 4), ώστε να πιάνει και νέα άνοδο μετά από σύντομη στασιμότητα.
   Επιστρέφει: rise-soon (σε 1–3 ώρες, από την πρόγνωση) και rise-start (άρχισε τις τελευταίες 3 ώρες). */
const RISE_RATE=0.5;
function pressureRise(fc){
  const hs=[]; fc.days.forEach(d=>d.hours.forEach(h=>{ if(h.p!=null) hs.push(h); }));
  hs.sort((a,b)=>a.t<b.t?-1:1);
  if(hs.length<10) return [];
  const raw=hs.map(h=>h.p), s=raw.map((v,i)=>i>0&&i<raw.length-1?0.25*raw[i-1]+0.5*v+0.25*raw[i+1]:v);
  const now=fc.nowLocal.slice(0,13); let n0=-1; hs.forEach((h,i)=>{ if(h.t.slice(0,13)<=now) n0=i; });
  if(n0<0) return [];
  const r3=s.map((v,i)=>i>=3?v-s[i-3]:null), out=[];
  for(let i=Math.max(7,n0-3);i<=Math.min(s.length-1,n0+3);i++){
    if(r3[i]==null||r3[i]<RISE_RATE-1e-6) continue;
    let quiet=true; for(let k=i-3;k<i;k++){ if(r3[k]!=null&&r3[k]>=RISE_RATE-1e-6){ quiet=false; break; } }
    if(!quiet) continue;
    /* η άνοδος να συνεχίζει (όχι στιγμιαίο σκαμπανέβασμα): +0,3 hPa συνολικά μέσα στις επόμενες 3 ώρες από την έναρξη */
    const j=Math.min(s.length-1,i+3); if(s[j]-s[Math.max(0,i-3)]<0.3) continue;
    const ahead=i-n0, base={t:hs[i].t,p:Math.round(s[i]*10)/10,h:Math.abs(ahead),rate:Math.round(r3[i]*10)/10};
    if(ahead>=1) out.push(Object.assign({kind:'rise-soon'},base)); else out.push(Object.assign({kind:'rise-start'},base));
    break;
  }
  return out;
}
/* Εικόνα πίεσης για την οθόνη: τάση τελευταίων 3 ωρών, επόμενη καμπή (κορυφή/κοιλάδα) και τελευταία καμπή. Ίδια λείανση με το pressureTurns, αλλά σε όλη την πρόγνωση. */
function pressureOutlook(fc){
  const hs=[]; fc.days.forEach(d=>d.hours.forEach(h=>{ if(h.p!=null) hs.push(h); }));
  hs.sort((a,b)=>a.t<b.t?-1:1);
  if(hs.length<8) return null;
  const raw=hs.map(h=>h.p), s=raw.map((v,i)=>i>0&&i<raw.length-1?0.25*raw[i-1]+0.5*v+0.25*raw[i+1]:v);
  const now=fc.nowLocal.slice(0,13); let n0=-1; hs.forEach((h,i)=>{ if(h.t.slice(0,13)<=now) n0=i; });
  if(n0<0) return null;
  const ex=[];
  for(let i=2;i<=s.length-3;i++){
    let isMax=true,isMin=true;
    for(let k=-2;k<=2;k++){ if(!k) continue; if(s[i+k]>s[i]) isMax=false; if(s[i+k]<s[i]) isMin=false; if(s[i+k]===s[i]&&k<0){ isMax=false; isMin=false; } }
    if(!isMax&&!isMin) continue;
    if(!turnOk(s,i,isMax)) continue;
    ex.push({kind:isMax?'peak':'trough',t:hs[i].t,p:Math.round(s[i]*10)/10,i});
  }
  const next=ex.filter(e=>e.i>n0)[0]||null, last=ex.filter(e=>e.i<=n0).pop()||null;
  const d3=n0>=3?raw[n0]-raw[n0-3]:null;
  return {now:Math.round(raw[n0]*10)/10,d3:d3==null?null:Math.round(d3*10)/10,trend:d3==null?null:d3<=-0.5?'fall':d3>=0.5?'rise':'steady',
    next:next&&{kind:next.kind,t:next.t,p:next.p,hours:next.i-n0},last:last&&last.i>=n0-12?{kind:last.kind,t:last.t,p:last.p,hours:n0-last.i}:null};
}
function compassOf(d,lang){ if(d==null) return ''; const c=lang==='en'?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ']; return c[Math.round((((d%360)+360)%360)/45)%8]; }
const DNG=['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'], DNE=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
let DN=(typeof self!=='undefined'&&self.LANG==='en')?DNE:DNG; /* η γλώσσα ορίζεται από το cfg.lang (και ο service worker την παίρνει από εκεί) */
function dayLabel(date){ const dt=new Date(date+'T12:00:00Z'); return DN[dt.getUTCDay()]+' '+date.slice(8)+'/'+date.slice(5,7); }
function goodDays(fc,thr){ return fc.days.filter(d=>d.safe&&d.win&&d.best>=thr).map(d=>({date:d.date,best:d.best,win:d.win,wind:d.avgWind,wave:d.avgWave,d:d})); }
/* v31z405: «γιατί» μια καλή μέρα: σελήνη, πίεση, άνεμος (Bft και διεύθυνση), κύμα, νερό, στο παράθυρο των καλύτερων ωρών */
function whyGood(d,win,en){
  const t=(a,b)=>en?b:a; if(!d||!d.hours) return '';
  const hs=d.hours.filter(h=>win&&h.hr>=win.s&&h.hr<=win.e); if(!hs.length) return '';
  const avg=a=>{ const v=a.filter(x=>typeof x==='number'); return v.length?v.reduce((x,y)=>x+y,0)/v.length:null; };
  const MP=en?['new moon','waxing crescent','first quarter','waxing gibbous','full moon','waning gibbous','last quarter','waning crescent']:['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα σελήνη','Πανσέληνος','Φθίνουσα σελήνη','Τελευταίο τέταρτο','Φθίνων μηνίσκος'];
  const D8=en?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
  const cnt={}; hs.forEach(h=>{ if(h.ptrend) cnt[h.ptrend]=(cnt[h.ptrend]||0)+1; }); const pt=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];
  const PT={rise:t('πίεση σε άνοδο','pressure rising'),stable:t('σταθερή πίεση','steady pressure'),slow:t('πίεση πέφτει αργά','pressure falling slowly'),fast:t('πίεση πέφτει γρήγορα','pressure falling fast')};
  const w=avg(hs.map(h=>h.wind)), dirs=hs.map(h=>h.dir).filter(x=>typeof x==='number');
  let dir=null; if(dirs.length){ let sx=0,sy=0; dirs.forEach(a=>{ sx+=Math.sin(a*Math.PI/180); sy+=Math.cos(a*Math.PI/180); }); dir=(Math.atan2(sx,sy)*180/Math.PI+360)%360; }
  const wv=avg(hs.map(h=>h.wave)), sst=avg(hs.map(h=>h.sst));
  const out=[MP[Math.floor(((d.f%1)+1)%1*8+0.5)%8]];
  if(pt&&PT[pt]) out.push(PT[pt]);
  if(w!=null) out.push((w<1?t('άπνοια','calm'):(dir!=null&&w>=3?D8[Math.round(dir/45)%8]+' ':'')+bft(w)+' Bft'));
  if(wv!=null) out.push(t('κύμα ','waves ')+(Math.round(wv*10)/10).toFixed(1).replace('.',en?'.':',')+' m');
  if(sst!=null) out.push(t('νερό ','water ')+Math.round(sst)+'°C');
  return out.join(', ');
}
/* cfg: {places,threshold,notified,pressure,turn,wind,lang,area}. Επιστρέφει {items,notified,title,body,msgs,...}.
   msgs = ξεχωριστή ειδοποίηση ανά γεγονός: {kind:'turn'|'pressure'|'wind'|'good', key, title, body (σύντομο), full (όλο το κείμενο), place:{name,lat,lon}, t}.
   Πίεση (καμπές και απότομες αλλαγές): μόνο για την περιοχή ψαρέματος — cfg.area (π.χ. θέση ενεργής εξόδου), αλλιώς «Η θέση μου»,
   αλλιώς η πρώτη τοποθεσία με ειδοποιήσεις. Καμπές: «πριν» (σε ≤3 ώρες) και «μόλις άρχισε» (έως 4 ώρες μετά), για κάθε καμπή. */
async function checkPlaces(cfg,fetchFn){
  LIMO=(cfg&&cfg.limits&&typeof cfg.limits==='object')?cfg.limits:null;
  const thr=cfg.threshold||75, notified=Object.assign({},cfg.notified||{}), goods=[], press=[], winds=[], turns=[], changes=[], eves=[]; let nextGood=null, todayGood=null, tmrGood=null, wkGood=null; const errs=[]; let okN=0;
  const today=new Date(Date.now()-86400000).toISOString().slice(0,10);
  for(const k of Object.keys(notified)){ if(k.split(':').pop()<today) delete notified[k]; }
  const en=cfg.lang==='en'||(typeof self!=='undefined'&&self.LANG==='en'), t=(el,e)=>en?e:el;
  DN=en?DNE:DNG;
  const watched=(cfg.places||[]).filter(p=>p.watch!==false&&p.lat!=null);
  let area=cfg.area&&cfg.area.lat!=null?cfg.area:(watched.find(p=>p.gps||p.id==='gps')||watched[0]||null);
  if(area&&!area.name) area=Object.assign({},area,{name:t('Περιοχή ψαρέματος','Fishing area')});
  const areaKey=area?('A'+(+area.lat).toFixed(1)+','+(+area.lon).toFixed(1)):'';
  let areaDone=false;
  const near=(p)=>area&&Math.abs(p.lat-area.lat)<0.02&&Math.abs(p.lon-area.lon)<0.02;
  async function doPressure(fc,pl){
    if(areaDone) return; areaDone=true;
    if(cfg.pressure!==false){
      const ev=pressureEvent(fc);
      if(ev){ const key=areaKey+':pr-'+ev.dir+':'+ev.t.slice(0,10); if(!notified[key]) press.push(Object.assign({type:'pressure',place:pl,key},ev)); }
    }
    if(cfg.turn){
      for(const e of pressureTurns(fc)){
        if(/-ahead$/.test(e.kind)) continue; /* μόνο «σε λίγο» και «μόλις άρχισε» */
        if(e.kind.indexOf('trough')===0) continue; /* v31z355: τη θέση της κοιλάδας παίρνει η «έναρξη ανόδου» */
        const pk=e.kind.startsWith('peak')?'peak':'trough', ph=/-soon$/.test(e.kind)?'pre':'post';
        const key=areaKey+':pt-'+pk+'-'+ph+'-'+String(Math.floor(+e.t.slice(11,13)/6))+':'+e.t.slice(0,10);
        if(!notified[key]) turns.push(Object.assign({type:'turn',place:pl,key},e));
      }
      for(const e of pressureRise(fc)){
        /* ένα «σε λίγο» και ένα «ξεκίνησε» ανά κύκλο ανόδου· κλειδί με την ώρα έναρξης σε 4ωρα, ώστε μικρές μετακινήσεις του μοντέλου να μη δίνουν διπλά */
        const key=areaKey+':rs-'+(e.kind==='rise-soon'?'pre':'post')+'-'+String(Math.floor(+e.t.slice(11,13)/4))+':'+e.t.slice(0,10);
        if(!notified[key]) turns.push(Object.assign({type:'turn',place:pl,key},e));
      }
    }
  }
  for(const p of (cfg.onlyPlans?[]:cfg.places||[])){
    if(p.watch===false||p.lat==null) continue;
    try{
      const fc=await getForecast(p.lat,p.lon,fetchFn,{days:7,sp:cfg.sp||null});
      okN++;
      /* 1.14.28: καλή μέρα σε 2+ μέρες, μόνο αν τα μοντέλα συμφωνούν για τον άνεμο (αλλιώς περιμένουμε να ξεκαθαρίσει) */
      let gd=goodDays(fc,thr); const far=fc.nowLocal?new Date(Date.parse(fc.nowLocal.slice(0,10)+'T12:00:00Z')+2*864e5).toISOString().slice(0,10):null;
      if(far&&gd.some(g=>g.date>=far)){ try{ const E=await ensSpread(p.lat,p.lon,fetchFn,7); gd=gd.filter(g=>!(g.date>=far&&E[g.date]&&E[g.date].bad)); }catch(e){} }
      for(const g of gd){ if(g.date===fc.nowLocal.slice(0,10)&&g.win&&g.win.e>=+fc.nowLocal.slice(11,13)&&(!todayGood||g.best>todayGood.best)) todayGood={place:p.name,date:g.date,best:g.best,win:g.win}; /* 1.14.13: καλύτερη ευκαιρία του Σαββατοκύριακου (Πέμπτη βράδυ) */ { const wdy=new Date(g.date+'T12:00:00Z').getUTCDay(); if((wdy===6||wdy===0)&&g.date>fc.nowLocal.slice(0,10)&&g.win&&(!wkGood||g.best>wkGood.best)) wkGood={place:p.name,date:g.date,best:g.best,win:g.win}; } /* 1.1.0: πρωινό μήνυμα */ { const tm=new Date(Date.parse(fc.nowLocal.slice(0,10)+'T12:00:00Z')+864e5).toISOString().slice(0,10); if(g.date===tm&&g.win&&(!tmrGood||g.best>tmrGood.best)) tmrGood={place:p.name,pid:p.id,date:g.date,best:g.best,win:g.win}; } /* 1.1.2: βραδινό μήνυμα για αύριο */ if(g.date>fc.nowLocal.slice(0,10)&&(!nextGood||g.date<nextGood.date||(g.date===nextGood.date&&g.best>nextGood.best))) nextGood={place:p.name,date:g.date,best:g.best,win:g.win}; const key=p.id+':'+g.date; if(notified[key]) continue; let why=''; try{ why=whyGood(g.d,g.win,en); }catch(e){} goods.push({type:'good',place:p,key,date:g.date,best:g.best,win:g.win,wind:g.wind,why}); }
      /* v31z538: για μέρες που σου προτάθηκαν ήδη: (α) «άλλαξε η πρόγνωση» αν πέσει κάτω από τα όρια ασφαλείας ή αρκετά κάτω από τον στόχο,
         (β) υπενθύμιση το προηγούμενο βράδυ (19:00–23:59 τοπική ώρα) με τα τελευταία στοιχεία. Μία φορά η καθεμία ανά μέρα. */
      const nowD=fc.nowLocal.slice(0,10), nowH=+fc.nowLocal.slice(11,13), tmr=new Date(Date.parse(nowD+'T12:00:00Z')+864e5).toISOString().slice(0,10);
      for(const d of fc.days){
        if(!notified[p.id+':'+d.date]||d.date<=nowD) continue; /* η σημερινή όχι: ο δείκτης της μετρά μόνο τις ώρες που απομένουν */
        const xk=p.id+':x:'+d.date, ek=p.id+':eve:'+d.date;
        if(!notified[xk]){
          const bad=!d.safe?'unsafe':(d.best<thr-8?'worse':null);
          if(bad){ changes.push({type:'goodx',place:p,key:xk,date:d.date,best:d.best,why:bad,d}); continue; }
        }
        if(!notified[ek]&&!notified[xk]&&d.date===tmr&&nowH>=19&&d.safe&&d.win&&d.best>=thr-5){ let why=''; try{ why=whyGood(d,d.win,en); }catch(e){} eves.push({type:'goodeve',place:p,key:ek,date:d.date,best:d.best,win:d.win,why}); }
      }
      if(near(p)) await doPressure(fc,{name:p.name,lat:p.lat,lon:p.lon});
      if(cfg.wind){
        const we=windEvent(fc,cfg.wind);
        if(we){ const cp=compassOf(we.to.dir,cfg.lang), key=p.id+':wd-'+(cp||'sp')+Math.round(we.to.wind/4)+':'+we.to.t.slice(0,10); if(!notified[key]) winds.push({type:'wind',place:p,key,we}); }
      }
    }catch(e){ errs.push((p.name||p.id)+': '+(e&&e.message||e)); }
  }
  /* v31z545: μέτωπο θερμοκρασίας νερού κοντά στα σημεία (πλέγμα 5×5 ανά ~11 km, μοντέλο Open-Meteo): διαφορά ≥0,8° ανάμεσα σε γειτονικά σημεία, έως ~25 km από το σημείο. Μία φορά τη μέρα ανά σημείο. */
  const fronts=[];
  if(cfg.front&&!cfg.onlyPlans) for(const p of (cfg.places||[]).filter(x=>x.watch!==false&&x.lat!=null).slice(0,3)){
    try{
      const N=5, st=0.1, la=[], lo=[]; for(let j=0;j<N;j++) for(let i=0;i<N;i++){ la.push((+p.lat+(j-2)*st).toFixed(3)); lo.push((+p.lon+(i-2)*st).toFixed(3)); }
      const j=await fetchJson('https://marine-api.open-meteo.com/v1/marine?latitude='+la.join(',')+'&longitude='+lo.join(',')+'&current=sea_surface_temperature&cell_selection=sea',fetchFn);
      const arr=Array.isArray(j)?j:[j], T=arr.map(x=>x&&x.current&&typeof x.current.sea_surface_temperature==='number'?x.current.sea_surface_temperature:null);
      const R=Math.PI/180, km=(a,b,c,d)=>{ const x=(d-b)*R*Math.cos((a+c)/2*R), y=(c-a)*R; return Math.sqrt(x*x+y*y)*6371; };
      let best=null;
      for(let jj=0;jj<N;jj++) for(let ii=0;ii<N;ii++){ const k=jj*N+ii; if(T[k]==null) continue;
        for(const [dj,di] of [[0,1],[1,0]]){ const j2=jj+dj, i2=ii+di; if(j2>=N||i2>=N) continue; const k2=j2*N+i2; if(T[k2]==null) continue;
          const df=Math.abs(T[k]-T[k2]); if(df<0.8) continue; const mla=(+la[k]+ +la[k2])/2, mlo=(+lo[k]+ +lo[k2])/2, dist=km(+p.lat,+p.lon,mla,mlo); if(dist>25) continue;
          if(!best||df>best.df+0.1||(Math.abs(df-best.df)<=0.1&&dist<best.dist)) best={df,dist,mla,mlo,t1:Math.max(T[k],T[k2]),t2:Math.min(T[k],T[k2])}; } }
      const today=new Date(Date.now()+(arr[0]&&arr[0].utc_offset_seconds||0)*1000).toISOString().slice(0,10), key='front:'+p.id+':'+today;
      if(best&&!notified[key]){ const br=(Math.atan2(Math.sin((best.mlo-p.lon)*R)*Math.cos(best.mla*R),Math.cos(p.lat*R)*Math.sin(best.mla*R)-Math.sin(p.lat*R)*Math.cos(best.mla*R)*Math.cos((best.mlo-p.lon)*R))/R+360)%360;
        fronts.push({type:'front',place:p,key,f:best,br}); }
    }catch(e){ errs.push((p.name||p.id)+' front: '+(e&&e.message||e)); }
  }
  /* v31z544: πλάνο εξόδου («Θα βγω»): υπενθύμιση το προηγούμενο βράδυ, «ώρα να ξεκινήσεις» ~1 ώρα πριν από το καλύτερο παράθυρο, και ειδοποίηση αν χαλάσει. */
  const plans=[];
  for(const pl of (cfg.plans||[]).slice(0,6)){
    if(!pl||pl.lat==null||!pl.date) continue;
    try{
      const fc=await getForecast(+pl.lat,+pl.lon,fetchFn,{days:7,sp:cfg.sp||null}); okN++;
      const nowD=fc.nowLocal.slice(0,10), nowM=+fc.nowLocal.slice(11,13)*60+(+fc.nowLocal.slice(14,16)||0), tmr=new Date(Date.parse(nowD+'T12:00:00Z')+864e5).toISOString().slice(0,10);
      if(pl.date<nowD) continue; const d=fc.days.find(x=>x.date===pl.date); if(!d) continue;
      const xk='plan:x:'+pl.date, ek='plan:eve:'+pl.date, ak='plan:am:'+pl.date, bad=!d.safe?'unsafe':(d.best<thr-8?'worse':null);
      if(bad&&!notified[xk]&&(pl.date>nowD||(d.why!=='night'))){ plans.push({type:'planx',key:xk,pl,d,bad}); continue; }
      if(bad) continue;
      if(pl.date===tmr&&nowM>=19*60&&!notified[ek]){ let why=''; try{ why=whyGood(d,d.win,en); }catch(e){} plans.push({type:'planeve',key:ek,pl,d,why}); }
      if(pl.date===nowD&&d.win&&!notified[ak]){ const until=d.win.s*60-nowM; if(until>=10&&until<=80) plans.push({type:'planam',key:ak,pl,d,until}); }
    }catch(e){ errs.push((pl.name||'plan')+': '+(e&&e.message||e)); }
  }
  if(area&&!cfg.onlyPlans&&!areaDone&&(cfg.pressure!==false||cfg.turn)){
    try{ const fc=await getForecast(area.lat,area.lon,fetchFn,{days:3,sp:cfg.sp||null}); okN++; await doPressure(fc,{name:area.name,lat:area.lat,lon:area.lon}); }
    catch(e){ errs.push((area.name||'area')+': '+(e&&e.message||e)); }
  }
  goods.sort((a,b)=>b.best-a.best);
  const top=goods.slice(0,4).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:b.best-a.best);
  const lines=top.map(i=>i.place.name+': '+dayLabel(i.date)+' · '+t('δείκτης ','score ')+i.best+' · '+pad(i.win.s)+':00–'+pad((i.win.e+1)%24)+':00');
  if(goods.length>top.length) lines.push('+'+(goods.length-top.length)+t(' ακόμα',' more'));
  const ptxt=i=>t('η πίεση ','pressure ')+(i.dir==='fall'?t('πέφτει','falling'):t('ανεβαίνει','rising'))+' '+i.delta+' hPa '+t('σε ','in ')+i.hours+t(' ώρες (',' h (')+i.from+'→'+i.to+t(' hPa, από ',' hPa, from ')+i.t.slice(11,16)+').';
  const pl=press.slice(0,2).map(i=>i.place.name+': '+ptxt(i)+' '+(i.dir==='fall'?t('Πριν αλλάξει ο καιρός τα ψάρια συχνά τσιμπούν πιο έντονα.','Before the weather changes fish often bite harder.'):t('Ο καιρός συνήθως σταθεροποιείται.','The weather usually settles.')));
  const wtxt=i=>{ const f=i.we.from, to=i.we.to, W=v=>Math.round(v)+' kn';
    return t('άνεμος ','wind ')+(f.dir!=null?compassOf(f.dir,en?'en':'el')+' ':'')+W(f.wind)+' → '+to.t.slice(11,16)+' '+(to.dir!=null?compassOf(to.dir,en?'en':'el')+' ':'')+W(to.wind)+(to.gust!=null&&to.gust>=to.wind+6?' ('+t('ριπές ','gusts ')+W(to.gust)+')':''); };
  /* 1.9.58: αλλαγή ανέμου το πολύ μία ειδοποίηση ανά 4 ώρες (για όλα τα σημεία μαζί). Πριν: με 11 σημεία έφευγαν δεκάδες τη μέρα,
     γιατί κάθε σημείο είχε δική του ειδοποίηση και κάθε μικρή αλλαγή της πρόγνωσης έφτιαχνε νέο κλειδί. */
  { const wk='_wind:'+today, lastW=+notified[wk]||0;
    if(winds.length&&Date.now()-lastW<4*3600000) winds.length=0;
    else if(winds.length){ winds.sort((a,b)=>Math.max(b.we.to.wind,b.we.from.wind)-Math.max(a.we.to.wind,a.we.from.wind)); notified[wk]=Date.now(); } }
  const wl=winds.slice(0,2).map(i=>i.place.name+': '+wtxt(i));
  const ttxt=e=>{ const hh=e.t.slice(11,16), p=String(e.p).replace('.',en?'.':',');
    return {'rise-soon':t('η πίεση αρχίζει να ανεβαίνει γύρω στις '+hh+', σε ~'+e.h+' ώρ. Καλή ώρα να είσαι ήδη στο σημείο.','pressure starts rising around '+hh+', in ~'+e.h+' h. A good time to be at your spot already.'),
      'rise-start':t('ξεκίνησε άνοδος πίεσης (+'+String(e.rate).replace('.',en?'.':',')+' hPa σε 3 ώρες, τώρα '+p+' hPa).','pressure has started rising (+'+e.rate+' hPa in 3 h, now '+p+' hPa).'),
      'peak-soon':t('η πίεση φτάνει κορυφή ('+p+' hPa) στις '+hh+', σε ~'+e.h+' ώρ. Μετά αρχίζει να πέφτει.','pressure peaks ('+p+' hPa) at '+hh+', in ~'+e.h+' h. Then it starts falling.'),
      'trough-soon':t('η πίεση φτάνει κοιλάδα ('+p+' hPa) στις '+hh+', σε ~'+e.h+' ώρ. Μετά αρχίζει να ανεβαίνει.','pressure bottoms out ('+p+' hPa) at '+hh+', in ~'+e.h+' h. Then it starts rising.'),
      'peak-past':t('πέρασε η κορυφή ('+p+' hPa στις '+hh+'), η πίεση άρχισε να πέφτει.','the peak has passed ('+p+' hPa at '+hh+'), pressure has started falling.'),
      'trough-past':t('πέρασε η κοιλάδα ('+p+' hPa στις '+hh+'), η πίεση άρχισε να ανεβαίνει.','the low has passed ('+p+' hPa at '+hh+'), pressure has started rising.')}[e.kind]||''; };
  const tl=turns.slice(0,2).map(e=>e.place.name+': '+ttxt(e));
  const items=goods.concat(press,winds,turns,changes,eves,plans,fronts);
  items.forEach(i=>{notified[i.key]=1;});
  const kinds=(goods.length?1:0)+(press.length?1:0)+(winds.length?1:0)+(turns.length?1:0);
  const title=kinds>1?t('Ενημέρωση ψαρέματος','Fishing update'):goods.length>1?t('Καλές μέρες για ψάρεμα','Good days for fishing'):goods.length?t('Καλή μέρα για ψάρεμα','Good day for fishing'):press.length?t('Αλλαγή πίεσης','Pressure change'):turns.length?t('Καμπή πίεσης','Pressure turning point'):t('Αλλαγή ανέμου','Wind change');
  /* ξεχωριστά μηνύματα */
  const P=pl0=>pl0?{name:pl0.name,lat:pl0.lat,lon:pl0.lon}:null, msgs=[];
  turns.forEach(e=>{ const up=e.kind.indexOf('trough')===0||e.kind.indexOf('rise')===0, pre=/-soon$/.test(e.kind), tx=ttxt(e);
    const TT={'rise-soon':t('🔔 Σε λίγο ξεκινά άνοδος πίεσης','🔔 Pressure rise coming'),'rise-start':t('📈 Ξεκίνησε άνοδος πίεσης','📈 Pressure started rising'),'peak-soon':t('⏳ Πλησιάζει κορυφή πίεσης','⏳ Pressure peak coming'),'peak-past':t('📉 Ξεκίνησε κάθοδος πίεσης','📉 Pressure started falling')}[e.kind];
    msgs.push({kind:'turn',key:e.key,place:P(e.place),t:e.t,title:(TT||((up?'↗ ':'↘ ')+t('Καμπή πίεσης','Pressure turning point')))+' · '+e.place.name,body:tx.charAt(0).toUpperCase()+tx.slice(1),
      full:e.place.name+': '+tx+' '+(pre?t('Ειδοποίηση πριν από την καμπή.','Alert before the turning point.'):t('Ειδοποίηση μόλις άρχισε η αλλαγή.','Alert just after the change started.'))+t(' Πρόγνωση μοντέλου (Open-Meteo), όχι μέτρηση.',' Model forecast (Open-Meteo), not a measurement.')}); });
  press.forEach(i=>{ const tx=ptxt(i);
    msgs.push({kind:'pressure',key:i.key,place:P(i.place),t:i.t,title:(i.dir==='fall'?'📉 ':'📈 ')+t('Απότομη αλλαγή πίεσης','Sharp pressure change')+' · '+i.place.name,body:tx.charAt(0).toUpperCase()+tx.slice(1),
      full:i.place.name+': '+tx+' '+(i.dir==='fall'?t('Πριν αλλάξει ο καιρός τα ψάρια συχνά τσιμπούν πιο έντονα. Πρόσεχε την αλλαγή καιρού.','Before the weather changes fish often bite harder. Watch for the weather change.'):t('Ο καιρός συνήθως σταθεροποιείται.','The weather usually settles.'))}); });
  /* 1.9.58: μία ειδοποίηση ανέμου: το σημείο με τον δυνατότερο άνεμο, και τα υπόλοιπα στο πλήρες κείμενο */
  if(winds.length){ const i=winds[0], tx=wtxt(i), more=winds.length-1;
    msgs.push({kind:'wind',key:winds.map(x=>x.key).join('|').slice(0,180),place:P(i.place),t:i.we.to.t,title:'🌬 '+t('Αλλαγή ανέμου','Wind change')+' · '+i.place.name+(more?' +'+more:''),body:tx.charAt(0).toUpperCase()+tx.slice(1),full:winds.map(x=>x.place.name+': '+wtxt(x)).join('\n')}); }
  if(goods.length){ const tx=lines.join('\n');
    msgs.push({kind:'good',key:goods.map(i=>i.key).sort().join('|').slice(0,180),place:goods.length===1?P(goods[0].place):null,t:top[0]&&top[0].date,title:'🎣 '+(goods.length>1?t('Καλές μέρες για ψάρεμα','Good days for fishing'):t('Καλή μέρα για ψάρεμα','Good day for fishing')),
      body:lines[0]+(lines.length>1?' · +'+(goods.length-1):'')+(top[0]&&top[0].why?'\n'+top[0].why:''),full:goods.map(i=>i.place.name+': '+dayLabel(i.date)+' · '+t('δείκτης ','score ')+i.best+' · '+pad(i.win.s)+':00–'+pad((i.win.e+1)%24)+':00'+(i.why?'\n   '+i.why:'')).join('\n')}); }
  const span=w=>pad(w.s)+':00–'+pad((w.e+1)%24)+':00';
  changes.forEach(i=>{ const d=i.d, tx=i.why==='unsafe'?t('Η θάλασσα πλέον βγαίνει πάνω από τα όριά σου','The sea is now forecast above your limits')+(d.avgWind!=null?' ('+t('άνεμος ','wind ')+bft(d.wx&&d.wx.windMax!=null?d.wx.windMax:d.avgWind)+' Bft'+(d.wx&&d.wx.waveMax!=null?', '+t('κύμα ','waves ')+(Math.round(d.wx.waveMax*10)/10).toFixed(1).replace('.',en?'.':',')+' m':'')+')':'')+'.'
      :t('Ο δείκτης έπεσε στο ','The score dropped to ')+i.best+t(' (κάτω από τον στόχο σου '+thr+').',' (below your target of '+thr+').');
    msgs.push({kind:'good',key:i.key,place:P(i.place),t:i.date,title:'⚠️ '+t('Άλλαξε η πρόγνωση','Forecast changed')+' · '+dayLabel(i.date),body:i.place.name+': '+tx,full:i.place.name+', '+dayLabel(i.date)+': '+tx+' '+t('Είχε προταθεί ως καλή μέρα.','It had been suggested as a good day.')}); });
  eves.forEach(i=>{ const tx=t('Αύριο ','Tomorrow ')+dayLabel(i.date)+' · '+t('δείκτης ','score ')+i.best+' · '+t('καλύτερη ώρα ','best time ')+span(i.win);
    msgs.push({kind:'good',key:i.key,place:P(i.place),t:i.date,title:'🎣 '+t('Αύριο καλή μέρα','Good day tomorrow')+' · '+i.place.name,body:tx+(i.why?'\n'+i.why:''),full:i.place.name+': '+tx+(i.why?'\n'+i.why:'')+'\n'+t('Τελευταία πρόγνωση, απόψε.','Latest forecast, tonight.')}); });
  const sp2=w=>pad(w.s)+':00–'+pad((w.e+1)%24)+':00', cond=d=>[d.avgWind!=null?(en?'wind ':'άνεμος ')+bft(d.avgWind)+' Bft':'',d.avgWave!=null?(en?'waves ':'κύμα ')+(Math.round(d.avgWave*10)/10).toFixed(1).replace('.',en?'.':',')+' m':''].filter(Boolean).join(', ');
  fronts.forEach(i=>{ const f=i.f, dg=x=>(Math.round(x*10)/10).toFixed(1).replace('.',en?'.':','), tx=dg(f.df)+t('° διαφορά σε ~11 km, περίπου ','° difference over ~11 km, about ')+Math.round(f.dist)+t(' km ',' km ')+compassOf(i.br,en?'en':'el')+t(' του σημείου (',' of the spot (')+dg(f.t1)+'° → '+dg(f.t2)+'°).';
    msgs.push({kind:'good',key:i.key,place:{name:i.place.name,lat:+f.mla.toFixed(4),lon:+f.mlo.toFixed(4)},t:null,title:'🌡 '+t('Μέτωπο θερμοκρασίας · ','Temperature front · ')+i.place.name,body:tx.charAt(0).toUpperCase()+tx.slice(1),full:i.place.name+': '+tx+' '+t('Στα μέτωπα συχνά μαζεύονται πελαγικά (λίτσες, μαγιάτικα, παλαμίδες). Πρόγνωση μοντέλου, όχι μέτρηση.','Pelagics (leerfish, amberjack, bonito) often gather on fronts. Model forecast, not a measurement.')}); });
  plans.forEach(i=>{ const nm=i.pl.name||t('το σημείο σου','your spot'), d=i.d;
    if(i.type==='planx'){ const tx=i.bad==='unsafe'?t('η θάλασσα πλέον βγαίνει πάνω από τα όριά σου','the sea is now forecast above your limits')+(d.wx&&d.wx.windMax!=null?' ('+t('άνεμος έως ','wind up to ')+bft(d.wx.windMax)+' Bft'+(d.wx.waveMax!=null?', '+t('κύμα έως ','waves up to ')+(Math.round(d.wx.waveMax*10)/10).toFixed(1).replace('.',en?'.':',')+' m':'')+')':''):t('ο δείκτης έπεσε στο ','the score dropped to ')+d.best;
      msgs.push({kind:'good',key:i.key,place:P(i.pl),t:i.pl.date,title:'⚠️ '+t('Το πλάνο σου για ','Your plan for ')+dayLabel(i.pl.date),body:nm+': '+tx+'.',full:nm+', '+dayLabel(i.pl.date)+': '+tx+'. '+t('Δες την Πρόγνωση για άλλη μέρα.','Check the Forecast for another day.')}); }
    else if(i.type==='planeve'){ const tx=t('Αύριο ','Tomorrow ')+dayLabel(i.pl.date)+' · '+nm+' · '+t('καλύτερη ώρα ','best time ')+sp2(d.win)+' · '+t('δείκτης ','score ')+d.best+(cond(d)?' · '+cond(d):'');
      msgs.push({kind:'good',key:i.key,place:P(i.pl),t:i.pl.date,title:'📅 '+t('Αύριο βγαίνεις για ψάρεμα','Fishing tomorrow'),body:tx,full:tx+(i.why?'\n'+i.why:'')+'\n'+t('Ετοίμασε από απόψε: λίστα ελέγχου, δόλωμα, καύσιμα, επαφή ασφαλείας.','Prepare tonight: checklist, bait, fuel, safety contact.')}); }
    else { const tx=t('Η καλύτερη ώρα ξεκινά σε ~','The best time starts in ~')+i.until+t(' λεπτά (',' min (')+sp2(d.win)+') · '+nm+(cond(d)?' · '+cond(d):'');
      msgs.push({kind:'good',key:i.key,place:P(i.pl),t:i.pl.date,title:'⏰ '+t('Ώρα να ξεκινήσεις','Time to get going'),body:tx,full:tx}); } });
  return {nextGood,todayGood,tmrGood,wkGood,items,notified,title,body:lines.concat(pl,tl,wl).join('\n'),msgs,area:area?{name:area.name,lat:area.lat,lon:area.lon}:null,errs,okN,goodsN:goods.length,pressN:press.length,turnsN:turns.length,windsN:winds.length};
}
/* P1.1: πλήρες αποτέλεσμα του πυρήνα για μία ώρα πρόγνωσης (βαθμός, λόγοι, data contract, βεβαιότητα, έκδοση βαρών).
   Δεν χρησιμοποιείται ακόμα από καμία οθόνη· υπάρχει για τους ελέγχους και για το P1.2. h = ώρα του getForecast, d = η ημέρα της, dayOffset = ημέρες από σήμερα. */
function scoreHour(sm,h,o){ o=o||{}; const c=scoreCtx(Object.assign({},h,o.sp?{sp:o.sp}:null,o.prof?{prof:o.prof}:null));
  /* τα κοινά ευρήματα διαλέγονται όπως στο getForecast (ανά είδος ή ανά προφίλ) */
  const L=learnPick(o.learn||(o.learn===false?null:(typeof window!=='undefined'&&window.AlkyonLearn)||null),o.sp);
  return AS.evaluate(sm,h,{sp:c.sp,prof:c.prof,learn:L,dayOffset:o.dayOffset,unc:o.unc,local:o.local,evidence:o.evidence,src:o.src,extra:o.extra}); }
/* P1.2 (αξιολόγηση): στιγμιότυπο της πρόγνωσης για αποθήκευση στην αρχή μιας εξόδου, ώστε αργότερα να συγκρίνεται με το τι έγινε.
   Γραμμή ανά ώρα: [ώρα UTC (ms/3600000), βαθμός όπως τον είδε ο χρήστης, βαθμός πυρήνα πριν από τη μάθηση, βεβαιότητα 0–2,
   τοπική διόρθωση κύματος 0/1, εφαρμόστηκαν κοινά ευρήματα 0/1]. Οι δύο πρώτες στήλες είναι ό,τι κρατούσε το scoreH ως τώρα (συμβατό με τις παλιές εξόδους).
   Δεν αλλάζει κανέναν βαθμό και δεν εμφανίζεται πουθενά. */
function scoreRows(fc,lat,lon,o){ const out=[]; if(!fc||!fc.days) return {cfg:CFG.version,h:out};
  fc.days.forEach((d,di)=>{ let sm=null; try{ sm=sunMoon(d.date,+lat,+lon,fc.tz); }catch(e){}
    for(const x of d.hours){ if(x.score==null) continue; const row=[Math.floor((Date.parse(x.t+':00Z')-fc.tz*60000)/3600000),x.score];
      try{ if(sm){ const e=scoreHour(sm,x,Object.assign({dayOffset:di,unc:d.unc},o)); row.push(e.core,e.confidence.n,x.waveOff!=null?1:0,e.learn?1:0); } }catch(e){}
      out.push(row); } });
  return {cfg:CFG.version,h:out}; }
g.PF={session:(t)=>AS.session(t),scoreRows,scoreHour,scoreConfig:CFG.version,explainHour,ensSpread,learnPick,learnBins,learnAdj,darkTxt,darkWin,squidEves,nextMoon,moonInfo,lims,moonAlt,moonEvents,moonPhase,solunarPeriods,pressureRise,sunMoon,hourScore,getForecast,findIdeal,message,check,goodDays,checkPlaces,dayLabel,bft,pressureEvent,windEvent,pressureTurns,pressureOutlook};
})(typeof self!=='undefined'?self:this);

const PF = self.PF;

// ---- safety-job.mjs ----
// Τρέχει στο GitHub Actions κάθε ~5 λεπτά. Στέλνει αυτόματα ειδοποίηση ασφαλείας (Telegram και email)
// όταν μια έξοδος δεν έχει επιβεβαιωθεί μετά την ώρα επιστροφής, όταν χαθεί η επαφή με το κινητό (πρώτα ρωτάει τον ψαρά στο Telegram)
// ή όταν η μπαταρία είναι πολύ χαμηλή. Στέλνει επίσης "ξεκίνησε" και "γύρισε ασφαλής".

const TZ = 'Asia/Nicosia';
const hm = iso => new Intl.DateTimeFormat('el-GR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const hash32 = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const mapLink = (la, lo) => (la != null && lo != null) ? `https://maps.google.com/?q=${(+la).toFixed(5)},${(+lo).toFixed(5)}` : '';

/* 1.14.83 (P0.7): παλμός από το native GPS του κινητού (Android foreground service / iOS background location), με σβηστή οθόνη.
   Δεν έχει token χρήστη: αποδεικνύει ποια έξοδο ενημερώνει με το κλειδί hb_key που έγραψε η εφαρμογή στο safety_trips όταν ξεκίνησε η έξοδος.
   Ενημερώνει μόνο θέση/ώρα/μπαταρία ενεργής εξόδου· τίποτα άλλο. Αγνοεί παλμούς πιο πυκνούς από 20″. */
export async function heartbeat({ env, fetch: F = fetch, now = Date.now() }, b) {
  const id = String(b && b.id || ''), key = String(b && b.key || ''), lat = +(b && b.lat), lon = +(b && b.lon);
  if (!/^[\w.-]{3,80}$/.test(id) || !/^[a-f0-9]{32,128}$/.test(key)) return { status: 400, body: { ok: false, error: 'bad request' } };
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
  const H = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY };
  const r = await F(env.SUPABASE_URL + '/rest/v1/safety_trips?id=eq.' + encodeURIComponent(id) + '&hb_key=eq.' + key + '&status=in.(active,alerted)&select=id,hb_at', { headers: H });
  const a = r.ok ? await r.json() : [];
  if (!Array.isArray(a) || !a.length) return { status: 404, body: { ok: false, error: 'no active trip' } };
  const last = a[0].hb_at ? Date.parse(a[0].hb_at) : 0;
  if (now - last < 20e3) return { status: 200, body: { ok: true, skipped: 'rate' } };
  const at = new Date(now).toISOString(), o = { hb_at: at, hb_src: 'native' };
  if (hasPos) { o.last_lat = Math.round(lat * 1e5) / 1e5; o.last_lon = Math.round(lon * 1e5) / 1e5; o.last_at = at; }
  const bat = Math.round(+(b && b.battery)); if (Number.isFinite(bat) && bat >= 0 && bat <= 100) o.battery = bat;
  const u = await F(env.SUPABASE_URL + '/rest/v1/safety_trips?id=eq.' + encodeURIComponent(id) + '&hb_key=eq.' + key, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(o) });
  return u.ok ? { status: 200, body: { ok: true } } : { status: 502, body: { ok: false, error: 'update ' + u.status } };
}
/* 1.14.83 (P0.6): πρέπει να τρέξει ένα περιοδικό βήμα; Με ανοχή 60″ ώστε ένας cron κάθε 5′ να το τρέχει κάθε ~15′ χωρίς να γλιστρά. */
export function isDue(lastOk, nowMs, periodMs, slackMs = 60e3) {
  const t = lastOk ? Date.parse(lastOk) : NaN;
  if (!Number.isFinite(t)) return true;
  if (t > nowMs + 5 * 60e3) return true;   // ρολόι/τιμή στο μέλλον: δεν μπλοκάρει για πάντα
  return nowMs - t >= periodMs - slackMs;
}
/* 1.14.83 (P0.6): «κλείδωμα» βήματος χωρίς ακριβές λεπτό. Τρέχει μόνο αν (α) πέρασε η περίοδος από την τελευταία ΕΠΙΤΥΧΙΑ και
   (β) καμία άλλη εκτέλεση δεν το έχει ήδη πάρει τα τελευταία 5′. Το «πάρσιμο» είναι ατομικό: PATCH με όρο την προηγούμενη τιμή last_try
   (αν δύο εκτελέσεις τρέξουν μαζί, μόνο η μία βρίσκει τη γραμμή αμετάβλητη). Αν μια εκτέλεση πέσει στη μέση, μετά από 5′ το βήμα ξαναπαίρνεται. */
export async function claimStep(sb, name, periodMs, now = Date.now(), staleMs = 5 * 60e3) {
  const r = await sb(`job_state?name=eq.${encodeURIComponent(name)}&select=last_ok,last_try`);
  const row = r && r[0];
  if (!isDue(row ? row.last_ok : null, now, periodMs)) return false;
  const lt = row && row.last_try ? Date.parse(row.last_try) : NaN, lo = row && row.last_ok ? Date.parse(row.last_ok) : NaN;
  if (Number.isFinite(lt) && now - lt < staleMs && !(Number.isFinite(lo) && lo >= lt)) return false;   // τρέχει ήδη αλλού
  const at = new Date(now).toISOString();
  if (!row) {
    const ins = await sb('job_state', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify([{ name, last_try: at }]) });
    return Array.isArray(ins) && ins.length === 1;
  }
  const cond = row.last_try ? 'last_try=eq.' + encodeURIComponent(row.last_try) : 'last_try=is.null';
  const up = await sb(`job_state?name=eq.${encodeURIComponent(name)}&${cond}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ last_try: at }) });
  return Array.isArray(up) && up.length === 1;
}
export async function run({ env, fetch: F = fetch, sendMail, log = console.log, PF = null, webpush = null, only = null }) {
  const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY, TG = env.TELEGRAM_BOT_TOKEN;
  if (!URL_ || !KEY) { log('Λείπουν τα SUPABASE_URL / SUPABASE_SERVICE_KEY.'); return { ok: false }; }
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  const sb = async (path, opt = {}) => {
    const r = await F(URL_ + '/rest/v1/' + path, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
    if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const t = await r.text(); return t ? JSON.parse(t) : null;
  };
  const tg = async (method, body) => {
    const r = await F(`https://api.telegram.org/bot${TG}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error('Telegram ' + (j.description || r.status)); return j.result;
  };
  const stats = { linked: 0, start: 0, alert: 0, clear: 0, ping: 0, silence: 0, lowbat: 0, ok: 0, fc: 0, pa: 0, squid: 0 };
  const PING_WAIT_MIN = 15, LOWBAT = 10;
  // 1.9.50: τα σφάλματα των βημάτων μαζεύονται (για ειδοποίηση στους διαχειριστές στο τέλος· βλ. βήμα 9)
  const ERRS = [], log0 = log;
  const STEP_ERR = /^(Telegram updates|Telegram send|Email send|Telegram ping|port note decide|port notes|weekly|morning|Forecast job|Πίεση|Πίεση Telegram|Πίεση \(Open-Meteo\)|community push|squid|squid fc|squid notif_log|Καιρός εξόδου|bite stats)$/;
  log = m => { log0(m); const t = String(m), k = t.split(':')[0].trim(); if (STEP_ERR.test(k)) ERRS.push({ k, m: t.slice(0, 300) }); };
  /* 1.14.83 (P0.6): βήματα που τρέχουν «κάθε ~15′» δεν εξαρτώνται από το ακριβές λεπτό του cron: κρατιέται πότε έτρεξαν τελευταία φορά
     με επιτυχία (job_state). Αν ο cron αργήσει ή χάσει μια εκτέλεση, το βήμα τρέχει στην επόμενη. Χωρίς τον πίνακα (παλιό σχήμα): όπως πριν. */
  const jobs = {};
  const stepDue = async (name, periodMs) => {
    try { const ok = await claimStep(sb, name, periodMs, Date.now()); jobs[name] = { known: true }; return ok; }
    /* χωρίς τον πίνακα job_state (πριν το migration): τρέχει σε κάθε εκτέλεση· οι ειδοποιήσεις δεν διπλασιάζονται (notif_log) */
    catch (e) { jobs[name] = { known: false }; return true; } };
  const stepOk = async (name) => { if (!jobs[name] || !jobs[name].known) return;
    const at = new Date().toISOString();
    await sb(`job_state?name=eq.${encodeURIComponent(name)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_ok: at }) }).catch(e => log('job_state: ' + e.message)); };
  const patch = (id, o) => sb(`safety_trips?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) });
  // 1.9.19: τα Telegram των διαχειριστών (app_admins → το δικό τους Telegram από safety_contacts.self_chat_id)
  let ADM = null;
  const adminChats = async () => {
    if (ADM) return ADM;
    const a = (await sb('app_admins?select=user_id').catch(() => [])) || [];
    if (!a.length) return (ADM = []);
    const c = (await sb(`safety_contacts?user_id=in.(${a.map(x => x.user_id).join(',')})&select=self_chat_id`).catch(() => [])) || [];
    return (ADM = c.map(x => Number(x.self_chat_id)).filter(x => x && !isNaN(x)));
  };
  const contactOf = async uid => { const r = await sb(`safety_contacts?user_id=eq.${uid}&select=*`); return r && r[0]; };

  // 1) Σύνδεση επαφών Telegram: /start ΚΩΔΙΚΟΣ
  if (TG) {
    try {
      const ups = await tg('getUpdates', { timeout: 0, allowed_updates: ['message', 'callback_query'] });
      let last = null;
      for (const u of ups || []) {
        last = u.update_id;
        const cq = u.callback_query;
        // 1.9.19: έγκριση/απόρριψη σημειώσεων λιμανιών από διαχειριστή (κουμπιά ✅/❌)
        if (cq && typeof cq.data === 'string' && /^pn:(ok|no):[0-9a-f-]{36}$/.test(cq.data)) {
          const chat = cq.message && cq.message.chat && cq.message.chat.id;
          const [, act, id] = cq.data.split(':');
          try {
            const chats = await adminChats();
            if (chats.includes(Number(chat))) {
              await sb(`port_notes?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: act === 'ok' ? 'ok' : 'rejected' }) });
              await tg('answerCallbackQuery', { callback_query_id: cq.id, text: act === 'ok' ? 'Εγκρίθηκε' : 'Απορρίφθηκε' });
              if (cq.message) await tg('editMessageText', { chat_id: chat, message_id: cq.message.message_id, text: (cq.message.text || '') + (act === 'ok' ? '\n\n✅ Εγκρίθηκε: φαίνεται σε όλους.' : '\n\n❌ Απορρίφθηκε.') }).catch(() => null);
              stats.pn = (stats.pn || 0) + 1;
            } else await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Μόνο για διαχειριστές.' });
          } catch (e) { log('port note decide: ' + e.message); }
          continue;
        }
        if (cq && typeof cq.data === 'string' && cq.data.startsWith('ok:')) {
          const rows = await sb(`safety_trips?id=eq.${encodeURIComponent(cq.data.slice(3))}&select=user_id`);
          const c = rows && rows[0] ? await contactOf(rows[0].user_id) : null;
          const chat = cq.message && cq.message.chat && cq.message.chat.id;
          if (c && c.self_chat_id != null && Number(c.self_chat_id) === Number(chat)) {
            await patch(cq.data.slice(3), { hb_at: new Date().toISOString(), ping_at: null });
            await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ευχαριστώ!' });
            await tg('sendMessage', { chat_id: chat, text: '✅ Ευχαριστώ, καταγράφηκε ότι είσαι καλά. Σε ξαναρωτάω αν χαθεί πάλι το σήμα.' });
            stats.ok++;
          } else await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Η έξοδος δεν βρέθηκε.' });
          continue;
        }
        const m = u.message; if (!m || !m.text) continue;
        const mm = m.text.match(/^\/start\s+([A-Za-z0-9]{6,32})/); if (!mm) continue;
        const name = [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ') || 'Επαφή';
        const byTg = await sb(`safety_contacts?tg_code=eq.${encodeURIComponent(mm[1])}&select=user_id`);
        if (byTg && byTg[0]) {
          await sb(`safety_contacts?user_id=eq.${byTg[0].user_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tg_chat_id: m.chat.id, tg_name: name }) });
          await tg('sendMessage', { chat_id: m.chat.id, text: 'Συνδέθηκες ως επαφή ασφαλείας στο Alkyon. Θα λαμβάνεις ειδοποίηση αν κάποιος που ψαρεύει δεν γυρίσει στην ώρα του ή χαθεί η επαφή μαζί του.' });
          stats.linked++; continue;
        }
        const bySelf = await sb(`safety_contacts?self_code=eq.${encodeURIComponent(mm[1])}&select=user_id`).catch(() => null);
        if (bySelf && bySelf[0]) {
          await sb(`safety_contacts?user_id=eq.${bySelf[0].user_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ self_chat_id: m.chat.id }) });
          await tg('sendMessage', { chat_id: m.chat.id, text: 'Το Telegram σου συνδέθηκε με το Alkyon. Όταν είσαι σε έξοδο και χαθεί η επαφή με το κινητό σου, θα σε ρωτάω εδώ «είσαι καλά;» πριν ειδοποιήσω την επαφή ασφαλείας σου.' });
          stats.linked++; continue;
        }
        await tg('sendMessage', { chat_id: m.chat.id, text: 'Ο σύνδεσμος δεν είναι έγκυρος. Ζήτα νέο από τον φίλο σου.' });
      }
      if (last != null) await tg('getUpdates', { offset: last + 1, timeout: 0 });
    } catch (e) { log('Telegram updates: ' + e.message); }
  }

  const notify = async (c, text, trip, withLoc) => {
    let sent = 0;
    if (c && c.tg_chat_id && TG) {
      try { await tg('sendMessage', { chat_id: c.tg_chat_id, text }); if (withLoc && trip.last_lat != null) await tg('sendLocation', { chat_id: c.tg_chat_id, latitude: trip.last_lat, longitude: trip.last_lon }); sent++; }
      catch (e) { log('Telegram send: ' + e.message); }
    }
    if (c && c.email && sendMail) {
      try { await sendMail({ to: c.email, subject: text.split('\n')[0].slice(0, 90), text }); sent++; }
      catch (e) { log('Email send: ' + e.message); }
    }
    return sent;
  };
  const who = t => (t.user_name || 'Ο φίλος σου');
  const startText = t => `${who(t)} ξεκίνησε έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''}. Επιστροφή στις ${hm(t.due_at)}. Θα ειδοποιηθείς αυτόματα αν δεν επιβεβαιώσει ότι γύρισε, αν χαθεί η επαφή μαζί του ή αν το κινητό του μείνει από μπαταρία.`;
  const doneText = t => (t.alerted_at || t.silence_sent || t.lowbat_sent)
    ? `ΟΛΑ ΚΑΛΑ: ${who(t)} επιβεβαίωσε ότι γύρισε ασφαλής. Ευχαριστούμε.`
    : `✅ ${who(t)} γύρισε από την έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''}. Όλα καλά.`;
  const nowIso = new Date().toISOString();

  // Άμεση ενημέρωση από την εφαρμογή (phase: start | end) για μία έξοδο ενός χρήστη. Δεν τρέχει τα υπόλοιπα βήματα.
  // 1.9.61: το βήμα της Κοινότητας ως συνάρτηση, ώστε να τρέχει και αμέσως όταν κάποιος ανεβάζει ψάρι / κάνει like / σχόλιο
  const commStep = async () => {
  // 7β) 1.9.25: Κοινότητα, σαν τα κοινωνικά δίκτυα:
  //   (α) νέο ψάρι από άλλον χρήστη → push σε όσους έχουν «Νέα στην Κοινότητα» (places[].comm !== 'off'). Αν είναι πολλά, ένα μήνυμα «3 νέα ψάρια».
  //   (β) like ή σχόλιο σε δική σου ανάρτηση → push σε σένα (places[].commre !== 'off').
  //   Όχι στις ώρες ησυχίας (23:00–07:00 Κύπρου). Μία φορά ανά γεγονός (notif_log, ignore-duplicates). Όριο: το (α) το πολύ μία φορά ανά 30 λεπτά ανά χρήστη.
  if (webpush) {
    try {
      const since = new Date(Date.now() - 6 * 60000).toISOString();
      const enc = encodeURIComponent(since);
      // 1.9.56: τα νέα ψάρια των τελευταίων 2 ωρών (όχι μόνο 6′), ώστε όποιος κόπηκε από το όριο των 30′ να τα πάρει αργότερα σε ένα μήνυμα, αντί να χάνονται
      const encP = encodeURIComponent(new Date(Date.now() - 2 * 3600000).toISOString());
      const postsAll = (await sb(`community_posts?created_at=gt.${encP}&hidden=eq.false&select=id,user_id,author,species,latin,kg,cond,created_at&order=created_at.asc`).catch(() => [])) || [];
      const posts = postsAll.filter(p => p.created_at > since);
      const likes = (await sb(`community_likes?created_at=gt.${enc}&select=post_id,user_id,created_at`).catch(() => [])) || [];
      const coms = (await sb(`community_comments?created_at=gt.${enc}&hidden=eq.false&select=id,post_id,user_id,author,body,created_at`).catch(() => [])) || [];
      // 1.9.65: νέες αναφορές (→ διαχειριστές) και η περίληψη της εβδομάδας (Κυριακή 20:00–20:59 Κύπρου)
      const repsNew = (await sb(`community_reports?created_at=gt.${enc}&select=id,post_id,comment_id,reason,created_at`).catch(() => [])) || [];
      const cyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
      const wkDue = cyNow.getDay() === 0 && cyNow.getHours() === 20;
      if (postsAll.length || likes.length || coms.length || repsNew.length || wkDue) {
        const cyH = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2);
        const quietNow = cyH >= 23 || cyH < 7;
        const subsAll = (await sb('push_subs?select=id,user_id,sub,places').catch(() => [])) || [];
        const byUser = {}; for (const r of subsAll) (byUser[r.user_id] = byUser[r.user_id] || []).push(r);
        const flag = (rows, k) => !(rows.find(r => (r.places || []).find(p => p && p[k] === 'off')));
        const isEn = rows => !!(rows.find(r => (r.places || []).find(p => p && p.lang === 'en')));
        const quietOn = rows => !(rows.find(r => (r.places || []).find(p => p && p.quiet === 'off')));
        // 1.9.63: «μόνο όσους ακολουθώ» (places[].comm === 'follow', places[].follow = [user_id])
        const followOf = rows => { for (const r of rows) for (const p of (r.places || [])) if (p && p.comm === 'follow') return new Set(Array.isArray(p.follow) ? p.follow : []); return null; };
        const send = async (uid, key, kind, title, body) => {
          const rows = byUser[uid] || []; // 1.9.56: γράφεται στο ιστορικό (Ειδοποιήσεις της εφαρμογής) ακόμα κι αν το κινητό δεν έχει ενεργή συνδρομή push
          const at = new Date().toISOString();
          let ins = null; try { ins = await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (uid + '|' + key).slice(0, 250), user_id: uid, at, kind, title, body }) }); } catch (e) { return; }
          if (Array.isArray(ins) && !ins.length) return;   // ήδη στάλθηκε
          for (const r of rows) {
            try { await webpush.sendNotification(r.sub, JSON.stringify({ title, body, full: body, kind, id: key, tag: 'alk-' + key.slice(0, 40), at, url: '#community' }), { TTL: 3 * 3600 }); stats.comm = (stats.comm || 0) + 1; }
            catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }).catch(() => {}); }
          }
          return true;
        };
        // (α) νέα ψάρια
        if (postsAll.length) {
          // 1.9.63: νέο ρεκόρ Κοινότητας (βαρύτερο από κάθε προηγούμενη ανάρτηση του ίδιου είδους)
          for (const p of postsAll) {
            const q = p.cond && (p.cond.k === 'q' || p.cond.k === 'id');
            if (q || !(+p.kg > 0) || !p.species) continue;
            const prev = (await sb(`community_posts?species=eq.${encodeURIComponent(p.species)}&hidden=eq.false&created_at=lt.${encodeURIComponent(p.created_at)}&kg=not.is.null&select=kg&order=kg.desc&limit=1`).catch(() => [])) || [];
            if (prev.length && +p.kg > +prev[0].kg) p._rec = true;
          }
          // τελευταία ειδοποίηση «νέα ψάρια» ανά χρήστη (2 ώρες): ό,τι ανέβηκε μετά από αυτήν και δεν το έχει πάρει
          const recent = (await sb(`notif_log?kind=eq.comm&at=gt.${encP}&select=user_id,at`).catch(() => [])) || [];
          // 1.9.64: «Ειδοποίησέ με όταν κάποιος πιάσει…» (places[].wsp = κλειδιά ειδών, πεζά). Αμέσως, χωρίς το όριο των 30′, μία φορά ανά ανάρτηση.
          const spSent = {};
          for (const uid of Object.keys(byUser)) {
            const rows = byUser[uid]; const keys = new Set(); for (const r of rows) for (const pl of (r.places || [])) if (pl && Array.isArray(pl.wsp)) pl.wsp.forEach(k => keys.add(String(k).toLowerCase()));
            if (!keys.size || (quietNow && quietOn(rows))) continue;
            const en = isEn(rows);
            for (const p of postsAll) {
              if (p.user_id === uid || (p.cond && (p.cond.k === 'q' || p.cond.k === 'id'))) continue;
              const items = [{ s: p.species, la: p.latin, kg: p.kg }].concat((p.cond && Array.isArray(p.cond.more) ? p.cond.more : []).map(x => ({ s: x && x.s, kg: x && x.kg })));
              const hit = items.find(x => x.s && (keys.has(String(x.s).trim().toLowerCase()) || (x.la && keys.has(String(x.la).toLowerCase()))));
              if (!hit) continue;
              (spSent[uid] = spSent[uid] || new Set()).add(p.id);
              const kgT = hit.kg ? ' ' + String(hit.kg).replace('.', en ? '.' : ',') + ' kg' : '';
              await send(uid, 'csp:' + p.id.slice(0, 8), 'commsp', en ? `🐟 ${hit.s} in the Community` : `🐟 ${hit.s} στην Κοινότητα`, (p.author || (en ? 'An angler' : 'Ένας ψαράς')) + (en ? ' caught ' : ' έπιασε ') + hit.s + kgT);
            }
          }
          const lastAt = {}; for (const x of recent) if (!lastAt[x.user_id] || x.at > lastAt[x.user_id]) lastAt[x.user_id] = x.at;
          for (const uid of Object.keys(byUser)) {
            const rows = byUser[uid]; if (!flag(rows, 'comm') || (quietNow && quietOn(rows))) continue;
            const la = lastAt[uid] ? Date.parse(lastAt[uid]) : 0;
            if (la && Date.now() - la < 30 * 60000) continue;                 // όριο: μία φορά ανά 30′ (τα ψάρια περιμένουν, δεν χάνονται)
            const from = la ? new Date(la).toISOString() : since;              // από την τελευταία ειδοποίηση, αλλιώς τα 6′ όπως πριν
            const fs = followOf(rows);
            const mine = (la ? postsAll : posts).filter(p => p.user_id !== uid && p.created_at > from && (!fs || fs.has(p.user_id)) && !(spSent[uid] && spSent[uid].has(p.id))); if (!mine.length) continue;
            const en = isEn(rows), p0 = mine[mine.length - 1];
            const isQ = p => p.cond && (p.cond.k === 'q' || p.cond.k === 'id');
            const what = p => { if (isQ(p)) return (en ? 'asks: ' : 'ρωτά: ') + (p.cond.k === 'id' ? (en ? 'What fish is this?' : 'Τι ψάρι είναι;') : String(p.cond.q || '').slice(0, 80)); const more = (p.cond && Array.isArray(p.cond.more)) ? p.cond.more.length : 0; return (p.species || '') + (p.kg ? ' ' + String(p.kg).replace('.', en ? '.' : ',') + ' kg' : '') + (more ? (en ? ` +${more} more` : ` +${more} ακόμα`) : ''); };
            const rec = mine.filter(p => p._rec).pop();
            const title = rec ? (en ? `🏆 New Community record: ${rec.species}` : `🏆 Νέο ρεκόρ Κοινότητας: ${rec.species}`) : mine.length === 1 && isQ(p0) ? (en ? '❓ New question in the Community' : '❓ Νέα ερώτηση στην Κοινότητα') : mine.length > 1 ? (en ? `🐟 ${mine.length} new catches in the Community` : `🐟 ${mine.length} νέα ψάρια στην Κοινότητα`) : (en ? '🐟 New catch in the Community' : '🐟 Νέο ψάρι στην Κοινότητα');
            const one = p => (p.author || (en ? 'An angler' : 'Ένας ψαράς')) + (isQ(p) ? ' ' : (en ? ' caught ' : ' έπιασε ')) + what(p);
            const body = rec && mine.length === 1 ? one(rec) : mine.length > 1 ? mine.slice(-3).map(p => (p.author || '') + ': ' + what(p)).join(' · ') : one(p0);
            await send(uid, 'comm:' + mine.map(p => p.id.slice(0, 8)).join(','), 'comm', title, body);
          }
        }
        // (β) like / σχόλια στις δικές μου αναρτήσεις
        const pids = [...new Set([...likes.map(l => l.post_id), ...coms.map(c => c.post_id)])];
        if (pids.length) {
          const own = (await sb(`community_posts?id=in.(${pids.join(',')})&select=id,user_id,species`).catch(() => [])) || [];
          const po = {}; for (const p of own) po[p.id] = p;
          for (const l of likes) { const p = po[l.post_id]; if (!p || p.user_id === l.user_id) continue; const rows = byUser[p.user_id] || []; if (rows.length && (!flag(rows, 'commre') || (quietNow && quietOn(rows)))) continue;
            const en = isEn(rows); await send(p.user_id, 'cl:' + l.post_id.slice(0, 8) + ':' + l.user_id.slice(0, 8), 'commre', en ? '❤️ Someone liked your catch' : '❤️ Άρεσε σε κάποιον το ψάρι σου', p.species || ''); }
          for (const c of coms) { const p = po[c.post_id]; if (!p || p.user_id === c.user_id) continue; const rows = byUser[p.user_id] || []; if (rows.length && (!flag(rows, 'commre') || (quietNow && quietOn(rows)))) continue;
            const en = isEn(rows); await send(p.user_id, 'cc:' + c.id, 'commre', (en ? '💬 New comment on your ' : '💬 Νέο σχόλιο στο ') + (p.species || (en ? 'catch' : 'ψάρι σου')), (c.author ? c.author + ': ' : '') + String(c.body || '').slice(0, 120)); }
          // 1.9.62: απάντηση σε σχόλιο («@Όνομα …») → ειδοποίηση σε αυτόν που απάντησαν (αν δεν είναι ο ίδιος ή ο κάτοχος, που ήδη ειδοποιείται)
          const reps = coms.filter(c => /^@\S/.test(String(c.body || '')));
          if (reps.length) {
            const rp = [...new Set(reps.map(c => c.post_id))];
            const prev = (await sb(`community_comments?post_id=in.(${rp.join(',')})&hidden=eq.false&select=post_id,user_id,author`).catch(() => [])) || [];
            for (const c of reps) {
              const p = po[c.post_id]; const body = String(c.body || '');
              let to = null, name = '';
              for (const o of prev) { if (o.post_id !== c.post_id || !o.author || o.user_id === c.user_id) continue; if (body.startsWith('@' + o.author) && o.author.length > name.length) { name = o.author; to = o.user_id; } }
              if (!to || (p && to === p.user_id)) continue;
              const rows = byUser[to] || []; if (rows.length && (!flag(rows, 'commre') || (quietNow && quietOn(rows)))) continue;
              const en = isEn(rows);
              await send(to, 'cr:' + c.id, 'commre', (c.author || (en ? 'Someone' : 'Κάποιος')) + (en ? ' replied to you' : ' σου απάντησε'), body.slice(name.length + 1).trim().slice(0, 120) || (p && p.species) || '');
            }
          }
        }
        // 1.9.65: αναφορά → ειδοποίηση (εφαρμογή + Telegram) σε κάθε διαχειριστή, μία φορά ανά αναφορά
        if (repsNew.length) {
          const adm = (await sb('app_admins?select=user_id').catch(() => [])) || [];
          for (const r of repsNew) {
            let what = '';
            if (r.post_id) { const p = ((await sb(`community_posts?id=eq.${r.post_id}&select=author,species,cond`).catch(() => [])) || [])[0]; if (p) what = (p.author || '') + ': ' + (p.cond && p.cond.q ? String(p.cond.q).slice(0, 80) : (p.species || '')); }
            else if (r.comment_id) { const c = ((await sb(`community_comments?id=eq.${r.comment_id}&select=author,body`).catch(() => [])) || [])[0]; if (c) what = (c.author || '') + ': «' + String(c.body || '').slice(0, 100) + '»'; }
            if (!what) continue;
            const kindTxt = r.post_id ? 'ανάρτηση' : 'σχόλιο';
            for (const a of adm) {
              const ok = await send(a.user_id, 'rep:' + r.id, 'commadm', '🚩 Αναφορά σε ' + kindTxt + ' της Κοινότητας', what + ' · Κοινότητα › Αναφορές');
              if (ok && TG) { const c = await contactOf(a.user_id).catch(() => null); if (c && c.self_chat_id) await tg('sendMessage', { chat_id: c.self_chat_id, text: '🚩 Alkyon: αναφορά σε ' + kindTxt + ' της Κοινότητας\n' + what + '\nΆνοιξε Κοινότητα › Αναφορές για απόκρυψη ή απόρριψη.' }).catch(e => log('Telegram send: ' + e.message)); }
            }
          }
        }
        // 1.9.65: περίληψη εβδομάδας (Κυριακή βράδυ), σε όσους έχουν ανοιχτά τα «νέα ψάρια»
        if (wkDue) {
          const wk = ((await sb(`community_posts?created_at=gt.${encodeURIComponent(new Date(Date.now() - 7 * 864e5).toISOString())}&hidden=eq.false&select=user_id,author,species,kg,cond,day`).catch(() => [])) || []).filter(p => !(p.cond && (p.cond.k === 'q' || p.cond.k === 'id')) && p.species && (!p.day || Date.parse(p.day + 'T12:00:00Z') >= Date.now() - 7.5 * 864e5)); // 1.9.66: μόνο ψάρια που πιάστηκαν αυτή την εβδομάδα
          if (wk.length) {
            const day = cyNow.getFullYear() + '-' + String(cyNow.getMonth() + 1).padStart(2, '0') + '-' + String(cyNow.getDate()).padStart(2, '0');
            const cnt = {}; let big = null; const who = new Set();
            for (const p of wk) { who.add(p.user_id); const items = [{ s: p.species, kg: p.kg }].concat((p.cond && Array.isArray(p.cond.more) ? p.cond.more : []).filter(x => x && x.s)); for (const x of items) { cnt[x.s] = (cnt[x.s] || 0) + 1; if (+x.kg > 0 && (!big || +x.kg > big.kg)) big = { s: x.s, kg: +x.kg, a: p.author }; } }
            const n = Object.values(cnt).reduce((a, b) => a + b, 0), top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 3);
            for (const uid of Object.keys(byUser)) {
              const rows = byUser[uid]; if (!flag(rows, 'comm')) continue;
              const en = isEn(rows), kg = v => String(v).replace('.', en ? '.' : ',') + ' kg';
              const body = en ? `${n} catches from ${who.size} anglers. Most: ${top.map(k => k + ' (' + cnt[k] + ')').join(', ')}.` + (big ? ` Biggest: ${big.s} ${kg(big.kg)} (${big.a || ''}).` : '')
                : `${n} ψάρια από ${who.size} ψαράδες. Περισσότερα: ${top.map(k => k + ' (' + cnt[k] + ')').join(', ')}.` + (big ? ` Μεγαλύτερο: ${big.s} ${kg(big.kg)} (${big.a || ''}).` : '');
              await send(uid, 'wk:' + day, 'commwk', en ? '📊 This week in the Community' : '📊 Η εβδομάδα στην Κοινότητα', body);
            }
          }
        }
      }
    } catch (e) { log('community push: ' + e.message); }
  }
  };
  if (only && only.comm) { await commStep(); return { ok: true, stats }; }
  if (only) {
    const rows = (await sb(`safety_trips?id=eq.${encodeURIComponent(only.id)}&user_id=eq.${encodeURIComponent(only.uid)}&select=*`)) || [];
    const t = rows[0]; if (!t) return { ok: true, sent: 0, why: 'no trip' };
    const c = await contactOf(t.user_id);
    if (only.phase === 'start') {
      if (t.status !== 'active' || t.start_sent) return { ok: true, sent: 0, why: 'already' };
      if (Date.parse(t.due_at) <= Date.now()) return { ok: true, sent: 0, why: 'late' };
      const n = await notify(c, startText(t), t, false);
      await patch(t.id, { start_sent: true });
      return { ok: true, sent: n };
    }
    if (only.phase === 'end') {
      if (t.status !== 'done' || t.done_sent || !t.start_sent) return { ok: true, sent: 0, why: 'skip' };
      const n = await notify(c, doneText(t), t, false);
      await patch(t.id, { done_sent: true });
      return { ok: true, sent: n };
    }
    return { ok: false, why: 'bad phase' };
  }

  // 2) Νέες έξοδοι: ενημέρωση "ξεκίνησε" (εφεδρικά, αν δεν πρόλαβε η άμεση ειδοποίηση από την εφαρμογή).
  //    Αν η ώρα επιστροφής έχει ήδη περάσει, δεν στέλνουμε «ξεκίνησε» (θα ακολουθήσει η ειδοποίηση ασφαλείας).
  for (const t of (await sb(`safety_trips?status=eq.active&start_sent=eq.false&select=*`)) || []) {
    const late = Date.parse(t.due_at) <= Date.now();
    const c = late ? null : await contactOf(t.user_id);
    const n = late ? 0 : await notify(c, startText(t), t, false);
    await sb(`safety_trips?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ start_sent: true }) });
    if (n) stats.start++;
  }

  // 3) Εκπρόθεσμες έξοδοι: ειδοποίηση
  for (const t of (await sb(`safety_trips?status=eq.active&alerted_at=is.null&due_at=lt.${encodeURIComponent(nowIso)}&select=*`)) || []) {
    const c = await contactOf(t.user_id);
    const link = mapLink(t.last_lat, t.last_lon);
    const text = `ΕΙΔΟΠΟΙΗΣΗ ΑΣΦΑΛΕΙΑΣ: ${who(t)} είχε δηλώσει επιστροφή στις ${hm(t.due_at)} από έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''} και δεν έχει επιβεβαιώσει ότι γύρισε.\n` +
      (link ? `Τελευταία γνωστή θέση (${hm(t.last_at)}): ${link}\n` : 'Δεν υπάρχει καταγεγραμμένη θέση.\n') +
      'Δοκίμασε να τον/την καλέσεις. Αν δεν απαντά, κάλεσε το 112.';
    await notify(c, text, t, true);
    // 1.14.13: και push στους φίλους του στην εφαρμογή (όπου κι αν βρίσκονται)
    if (webpush) try {
      const fr = ((await sb(`friends?owner=eq.${encodeURIComponent(t.user_id)}&select=viewer`)) || []).map(x => x.viewer).filter(v => v && v !== t.user_id);
      const nm = String(t.user_name || '').slice(0, 40) || 'Ο φίλος σου';
      const pl = { id: 'late:' + t.id, kind: 'sos', tag: 'late-' + t.id, url: '#map', title: '⚠️ Δεν γύρισε ακόμα · Not back yet',
        body: nm + ': είχε δηλώσει επιστροφή στις ' + hm(t.due_at) + ' και δεν έχει επιβεβαιώσει ότι γύρισε. Κάλεσέ τον· αν δεν απαντά, 112. · Was due back and has not confirmed.',
        place: (typeof t.last_lat === 'number' && typeof t.last_lon === 'number') ? { name: nm, lat: t.last_lat, lon: t.last_lon } : undefined };
      for (const f of fr) for (const r of ((await sb(`push_subs?user_id=eq.${encodeURIComponent(f)}&select=id,sub`)) || [])) {
        try { await webpush.sendNotification(r.sub, JSON.stringify(pl), { TTL: 6 * 3600, urgency: 'high' }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }).catch(() => {}); }
      }
    } catch (e) { log('late friends: ' + e.message); }
    await sb(`safety_trips?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ alerted_at: nowIso, status: 'alerted' }) });
    stats.alert++;
  }

  // 3β) Χαμηλή μπαταρία
  for (const t of (await sb(`safety_trips?status=eq.active&lowbat_sent=eq.false&battery=lte.${LOWBAT}&select=*`).catch(() => [])) || []) {
    const c = await contactOf(t.user_id);
    const link = mapLink(t.last_lat, t.last_lon);
    await notify(c, `ΜΠΑΤΑΡΙΑ: το κινητό της εφαρμογής (${who(t)}) έχει ${t.battery}% μπαταρία και μπορεί να σβήσει σύντομα, ενώ είναι σε έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''}. Επιστροφή δηλωμένη στις ${hm(t.due_at)}.\n` + (link ? `Τελευταία γνωστή θέση (${hm(t.last_at)}): ${link}` : ''), t, true);
    await patch(t.id, { lowbat_sent: true });
    stats.lowbat++;
  }

  // 3γ) Έλεγχος σιωπής: πρώτα ρωτάμε τον ψαρά στο Telegram, μετά την επαφή
  const nowMs = Date.now();
  for (const t of (await sb(`safety_trips?status=eq.active&silence_min=gt.0&silence_sent=eq.false&due_at=gt.${encodeURIComponent(nowIso)}&select=*`).catch(() => [])) || []) {
    const hb = Date.parse(t.hb_at || t.last_at || t.created_at || nowIso);
    const age = Math.round((nowMs - hb) / 60000);
    if (t.ping_at && Date.parse(t.ping_at) < hb) { await patch(t.id, { ping_at: null }); t.ping_at = null; }
    if (!t.ping_at) {
      if (age < t.silence_min) continue;
      const c = await contactOf(t.user_id);
      if (!c || c.self_chat_id == null || !TG) continue;
      try {
        await tg('sendMessage', { chat_id: c.self_chat_id, text: `Είσαι καλά; Δεν έχουμε σήμα από το κινητό σου εδώ και ${age} λεπτά στην έξοδό σου. Πάτα το κουμπί αν όλα πάνε καλά. Αν δεν απαντήσεις σε ${PING_WAIT_MIN} λεπτά, θα ειδοποιηθεί η επαφή ασφαλείας σου.`, reply_markup: { inline_keyboard: [[{ text: '✅ Είμαι καλά', callback_data: 'ok:' + t.id }]] } });
        await patch(t.id, { ping_at: nowIso }); stats.ping++;
      } catch (e) { log('Telegram ping: ' + e.message); }
    } else if (nowMs - Date.parse(t.ping_at) >= PING_WAIT_MIN * 60000) {
      const c = await contactOf(t.user_id);
      const link = mapLink(t.last_lat, t.last_lon);
      await notify(c, `ΕΙΔΟΠΟΙΗΣΗ ΑΣΦΑΛΕΙΑΣ: χάθηκε η επαφή με το κινητό (${who(t)}) εδώ και ${age} λεπτά, σε έξοδο με σκάφος${t.route ? ' (' + t.route + ')' : ''}, και δεν απάντησε στον έλεγχο «είσαι καλά;». Επιστροφή δηλωμένη στις ${hm(t.due_at)}.\n` +
        (link ? `Τελευταία γνωστή θέση (${hm(t.last_at)}): ${link}\n` : 'Δεν υπάρχει καταγεγραμμένη θέση.\n') + 'Δοκίμασε να τον/την καλέσεις. Αν δεν απαντά, κάλεσε το 112. Μπορεί απλώς να είναι εκτός δικτύου.', t, true);
      await patch(t.id, { silence_sent: true }); stats.silence++;
    }
  }

  // 4) Επέκταση ώρας μετά από ειδοποίηση: ξανά σε ετοιμότητα
  for (const t of (await sb(`safety_trips?status=eq.alerted&due_at=gt.${encodeURIComponent(nowIso)}&select=id`)) || [])
    await sb(`safety_trips?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'active', alerted_at: null }) });

  // 5) Γύρισε ασφαλής: σε κάθε έξοδο για την οποία η επαφή ενημερώθηκε ότι ξεκίνησε (τελευταίες 6 ώρες), και πάντα μετά από ειδοποίηση
  const doneQ = 'safety_trips?status=eq.done&done_sent=eq.false&select=*&';
  const since = encodeURIComponent(new Date(Date.now() - 6 * 3600e3).toISOString());
  const doneList = (await sb(doneQ + `or=(alerted_at.not.is.null,silence_sent.eq.true,lowbat_sent.eq.true,and(start_sent.eq.true,created_at.gt.${since}))`).catch(() => sb(doneQ + 'alerted_at=not.is.null'))) || [];
  for (const t of doneList) {
    const c = await contactOf(t.user_id);
    await notify(c, doneText(t), t, false);
    await sb(`safety_trips?id=eq.${encodeURIComponent(t.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ done_sent: true }) });
    stats.clear++;
  }
  // 5β) 1.9.19: νέες σημειώσεις λιμανιών/ραμπών → στους διαχειριστές στο Telegram με ✅/❌
  if (TG) {
    try {
      const pend = (await sb('port_notes?status=eq.pending&tg_sent=eq.false&select=*&order=created_at.asc&limit=20')) || [];
      const chats = pend.length ? await adminChats() : [];
      const TAG = { shallow: 'ρηχά', rocks: 'βράχια', swell: 'φουσκοθαλασσιά', slippery: 'γλιστερή ράμπα', fee: 'χρέωση', parking: 'πάρκινγκ', fuel: 'καύσιμα', water: 'νερό', crowded: 'πολύς κόσμος', good: 'καλή ράμπα', night: 'σκοτεινό τη νύχτα', wind: 'εκτεθειμένο στον άνεμο' };
      for (const n of pend) {
        if (!chats.length) break;
        const text = `📝 Νέα σημείωση για ${n.port_name || 'λιμάνι/ράμπα'}\n` + (n.tags && n.tags.length ? 'Ετικέτες: ' + n.tags.map(t => TAG[t] || t).join(', ') + '\n' : '') +
          (n.note ? `«${n.note}»\n` : '') + mapLink(n.lat, n.lon);
        for (const chat of chats) await tg('sendMessage', { chat_id: chat, text, reply_markup: { inline_keyboard: [[{ text: '✅ Έγκριση', callback_data: 'pn:ok:' + n.id }, { text: '❌ Απόρριψη', callback_data: 'pn:no:' + n.id }]] } }).catch(e => log('port note send: ' + e.message));
        await sb(`port_notes?id=eq.${n.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tg_sent: true }) });
        stats.pnSent = (stats.pnSent || 0) + 1;
      }
    } catch (e) { if (!/relation|does not exist|404/i.test(e.message)) log('port notes: ' + e.message); }
  }

  // 6) Πρόγνωση: ειδοποιήσεις push για καλές μέρες ψαρέματος στις τοποθεσίες κάθε χρήστη (έλεγχος κάθε ~3 ώρες)
  if (PF && webpush) {
    const stale = new Date(Date.now() - 3 * 3600e3).toISOString();
    let rows = [];
    const stale1 = new Date(Date.now() - 14 * 60e3).toISOString(); // v31z355: καμπές πίεσης κάθε ~15 λεπτά
    // v31z357: όσοι έχουν ενεργή έξοδο ελέγχονται κι αυτοί κάθε ~15 λεπτά, με ειδοποιήσεις καμπής ανοιχτές
    let tripUsers = [];
    try { tripUsers = [...new Set(((await sb('safety_trips?status=eq.active&select=user_id')) || []).map(x => x.user_id).filter(Boolean))]; } catch (e) { /* χωρίς λίστα εξόδων */ }
    const tripOr = tripUsers.length ? `,and(user_id.in.(${tripUsers.join(',')}),checked_at.lt.${encodeURIComponent(stale1)})` : '';
    try { rows = (await sb(`push_subs?or=(checked_at.is.null,checked_at.lt.${encodeURIComponent(stale)},and(turn.eq.true,checked_at.lt.${encodeURIComponent(stale1)})${tripOr})&select=*`)) || []; }
    catch (e) {
      try { rows = (await sb(`push_subs?or=(checked_at.is.null,checked_at.lt.${encodeURIComponent(stale)})&select=*`)) || []; }
      catch (e2) { log('push_subs: ' + e2.message); }
    }
    for (const r of rows) {
      const upd = o => sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(o) });
      try {
        // περιοχή ψαρέματος για την πίεση: η θέση της ενεργής εξόδου του χρήστη, αν υπάρχει
        // v31z358: ένας χρήστης με πολλές εγγραφές push (π.χ. παλιά συνδρομή ή δεύτερη συσκευή): ελέγχεται μόνο η πιο πρόσφατη
        // και τα μηνύματα πάνε σε όλες τις συσκευές του, ώστε να μην έρχονται διπλά ή με παλιές τοποθεσίες/γλώσσα
        let targets = [r];
        try { const all = await sb(`push_subs?user_id=eq.${r.user_id}&select=id,sub,updated_at`); if (Array.isArray(all) && all.length) targets = all; } catch (e) { /* μόνο αυτή */ }
        if (targets.length > 1) {
          const prim = targets.slice().sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
          if (prim && prim.id !== r.id) { await upd({ checked_at: new Date().toISOString() }); stats.dupRow = (stats.dupRow || 0) + 1; continue; }
        }
        // v31z358: γλώσσα ειδοποιήσεων από την εφαρμογή (στήλη lang ή μέσα στις τοποθεσίες)
        const lang = (r.lang === 'en' || ((r.places || []).find(p => p && p.lang) || {}).lang === 'en') ? 'en' : 'el';
        let area = null, onTrip = tripUsers.indexOf(r.user_id) >= 0;
        try { const tr = await sb(`safety_trips?user_id=eq.${r.user_id}&status=eq.active&last_lat=not.is.null&select=last_lat,last_lon&limit=1`); if (tr && tr[0]) { onTrip = true; area = { id: 'trip', name: lang === 'en' ? 'Trip now' : 'Έξοδος τώρα', lat: +tr[0].last_lat, lon: +tr[0].last_lon }; } } catch (e) { /* χωρίς έξοδο */ }
        // v31z539: ώρες ησυχίας 23:00–07:00 (ώρα Κύπρου), εκτός αν ο χρήστης τις έκλεισε ή είναι σε έξοδο. Δεν αλλάζει το checked_at, οπότε στις 07:00 ελέγχεται αμέσως.
        const quietOn = !((r.places || []).find(p => p && p.quiet === 'off'));
        let cyH = new Date().getUTCHours(); try { cyH = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }) % 24; } catch (e) { /* UTC */ }
        // v31z544: πλάνα εξόδου (από την εφαρμογή, μέσα στις τοποθεσίες) · στις ώρες ησυχίας ελέγχονται μόνο αυτά (π.χ. «ώρα να ξεκινήσεις» στις 05:00)
        const plans = ((r.places || []).find(p => p && Array.isArray(p.plans)) || {}).plans || [];
        const quietNow = quietOn && !onTrip && (cyH >= 23 || cyH < 7);
        if (quietNow && !plans.length) { stats.quiet = (stats.quiet || 0) + 1; continue; }
        // v31z357: κατά την έξοδο οι ειδοποιήσεις καμπής/έναρξης ανόδου είναι πάντα ανοιχτές
        const turnOn = r.turn === true || onTrip;
        const res = await PF.checkPlaces({ plans, onlyPlans: quietNow, front: !!(r.places || []).find(p => p && p.front === 'on'), lang, sp: ((r.places || []).find(p => p && p.sp) || {}).sp || null, places: r.places || [], threshold: r.threshold || 75, pressure: r.pressure !== false, wind: r.wind || null, turn: turnOn, notified: r.state || {}, area }, F);
        log(`Πρόγνωση ${String(r.id).slice(0, 6)}: καμπή=${r.turn === true ? 'ναι' : 'όχι'}${onTrip ? ' (έξοδος: ναι)' : ''} τοποθεσίες=${(r.places || []).length} περιοχή=${res.area ? res.area.name : '-'} ok=${res.okN} καλές=${res.goodsN} πίεση=${res.pressN} καμπές=${res.turnsN} άνεμος=${res.windsN} μηνύματα=${(res.msgs || []).length}` + (res.errs && res.errs.length ? ' ΣΦΑΛΜΑΤΑ: ' + res.errs.join(' | ').slice(0, 300) : ''));
        let gone = false, sent = 0, failed = 0;
        // v31z542: εβδομαδιαία σύνοψη, Κυριακή 19:00–22:59 (ώρα Κύπρου), μία φορά: έξοδοι, ψάρια (χωρίς λαγοκέφαλους), καλύτερη μέρα, επόμενη καλή μέρα
        try {
          const cyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })), wd = cyNow.getDay(), hh = cyNow.getHours();
          const dkey = cyNow.getFullYear() + '-' + String(cyNow.getMonth() + 1).padStart(2, '0') + '-' + String(cyNow.getDate()).padStart(2, '0'), wk = 'wk:' + dkey;
          if (wd === 0 && hh >= 19 && hh <= 22 && !(res.notified || {})[wk]) {
            res.notified = res.notified || {}; res.notified[wk] = 1;
            const lo = new Date(cyNow.getTime() - 6 * 864e5), los = lo.getFullYear() + '-' + String(lo.getMonth() + 1).padStart(2, '0') + '-' + String(lo.getDate()).padStart(2, '0');
            const rows = (await sb(`records?select=kind,data&user_id=eq.${r.user_id}&kind=in.(bites,trips)&deleted=eq.false&data->>date=gte.${los}&limit=2000`).catch(() => [])) || [];
            const en = lang === 'en', t = (a, b) => en ? b : a, PEST = /λαγοκ[εέ]φαλ|κουνελ[οό]ψαρ|toadfish|puffer ?fish|lagocephalus|torquigener/i;
            const pest = b => !!b.pest || /^(Lagocephalus|Torquigener|Sphoeroides)\s/.test(b.latin || '') || PEST.test(b.species || '');
            const bs = rows.filter(x => x.kind === 'bites').map(x => x.data || {}).filter(b => !b.miss && !b.gear && !pest(b) && (b.date || '') <= dkey);
            const ps = rows.filter(x => x.kind === 'bites').map(x => x.data || {}).filter(b => pest(b) && (b.date || '') <= dkey).length;
            const trips = rows.filter(x => x.kind === 'trips').length, n = bs.reduce((s, b) => s + Math.max(1, Math.floor(+b.cnt) || 1), 0);
            const byDay = {}; bs.forEach(b => { byDay[b.date] = (byDay[b.date] || 0) + Math.max(1, Math.floor(+b.cnt) || 1); });
            const bd = Object.keys(byDay).sort((a, b) => byDay[b] - byDay[a])[0], sp = {}; bs.forEach(b => { if (b.species) sp[b.species] = (sp[b.species] || 0) + 1; });
            const top = Object.keys(sp).sort((a, b) => sp[b] - sp[a])[0], ng = res.nextGood;
            const DN = en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'], dn = s => DN[new Date(s + 'T12:00:00Z').getUTCDay()];
            const pad = x => String(x).padStart(2, '0');
            const parts = [];
            if (trips || n) parts.push(t('Αυτή την εβδομάδα: ', 'This week: ') + trips + t(trips === 1 ? ' έξοδος, ' : ' έξοδοι, ', trips === 1 ? ' trip, ' : ' trips, ') + n + t(n === 1 ? ' ψάρι' : ' ψάρια', n === 1 ? ' fish' : ' fish') + (top ? t(', κυρίως ', ', mostly ') + top : '') + (bd && n > 1 ? t('. Καλύτερη μέρα: ', '. Best day: ') + dn(bd) + ' (' + byDay[bd] + ')' : '') + '.');
            else parts.push(t('Αυτή την εβδομάδα δεν κατέγραψες εξόδους.', 'No trips logged this week.'));
            if (ps) parts.push('🐡 ' + ps + t(ps === 1 ? ' λαγοκέφαλος (δεν μετράει).' : ' λαγοκέφαλοι (δεν μετράνε).', ' toadfish (not counted).'));
            if (ng) parts.push(t('Επόμενη καλή μέρα: ', 'Next good day: ') + dn(ng.date) + ' ' + pad(ng.win.s) + ':00–' + pad((ng.win.e + 1) % 24) + ':00 · ' + ng.place + ' · ' + t('δείκτης ', 'score ') + ng.best + '.');
            res.msgs = (res.msgs || []).concat([{ kind: 'info', key: wk, title: '📅 ' + t('Η εβδομάδα σου', 'Your week'), body: parts.join(' '), full: parts.join('\n'), place: null, t: null }]);
          }
        } catch (e) { log('weekly: ' + e.message); }
        // 1.14.13: Πέμπτη 18:00–21:59 (ώρα Κύπρου), μία φορά: η καλύτερη ευκαιρία του Σαββατοκύριακου στα σημεία σου, με τον δικό σου στόχο
        try {
          const cyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })), wd = cyNow.getDay(), hh = cyNow.getHours();
          const dkey = cyNow.getFullYear() + '-' + String(cyNow.getMonth() + 1).padStart(2, '0') + '-' + String(cyNow.getDate()).padStart(2, '0'), wk = 'wke:' + dkey;
          if (wd === 4 && hh >= 18 && hh <= 21 && !(res.notified || {})[wk]) {
            res.notified = res.notified || {}; res.notified[wk] = 1;
            const en = lang === 'en', t = (a, b) => en ? b : a, g = res.wkGood, pad = x => String(x).padStart(2, '0');
            const DN = en ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
            const body = g ? t('Καλύτερη ευκαιρία: ', 'Best chance: ') + DN[new Date(g.date + 'T12:00:00Z').getUTCDay()] + ' ' + pad(g.win.s) + ':00–' + pad((g.win.e + 1) % 24) + ':00 · ' + g.place + ' · ' + t('δείκτης ', 'score ') + g.best + '.'
              : t('Αυτό το Σαββατοκύριακο καμία μέρα δεν φτάνει τον στόχο σου στα σημεία σου. Δες την Πρόγνωση για τις καλύτερες ώρες.', 'This weekend no day reaches your target at your spots. See the Forecast for the best hours.');
            res.msgs = (res.msgs || []).concat([{ kind: 'info', key: wk, title: '🎣 ' + t('Το Σαββατοκύριακό σου', 'Your weekend'), body, full: body, place: g ? null : null, t: null }]);
          }
        } catch (e) { log('weekly: ' + e.message); }
        // 1.1.0 / 1.1.2: «Σήμερα / Αύριο στα σημεία σου»: το προηγούμενο βράδυ (19:00–22:59) για αύριο, ή/και το πρωί (07:00–09:59) για σήμερα.
        // Ρύθμιση από την εφαρμογή: places[].morning = 'eve' (προεπιλογή) | 'morn' | 'both' | 'off' (το παλιό 'on' = πρωί).
        try {
          const mv = ((r.places || []).find(p => p && p.morning) || {}).morning || 'eve';
          const mode = mv === 'on' ? 'morn' : mv;
          const cyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })), hh = cyNow.getHours();
          const dkey = cyNow.getFullYear() + '-' + String(cyNow.getMonth() + 1).padStart(2, '0') + '-' + String(cyNow.getDate()).padStart(2, '0');
          const en = lang === 'en', pad = x => String(x).padStart(2, '0');
          res.notified = res.notified || {};
          const tg = res.todayGood, mk = 'mo:' + dkey;
          if ((mode === 'morn' || mode === 'both') && hh >= 7 && hh <= 9 && tg && tg.date === dkey && tg.win && tg.win.e >= hh && !res.notified[mk]) {
            res.notified[mk] = 1;
            const body = (en ? 'Today at ' : 'Σήμερα στο ') + tg.place + ': ' + pad(Math.max(tg.win.s, hh)) + ':00–' + pad((tg.win.e + 1) % 24) + ':00 · ' + (en ? 'score ' : 'δείκτης ') + tg.best + '.';
            res.msgs = (res.msgs || []).concat([{ kind: 'good', key: mk, title: '🌅 ' + (en ? 'Good fishing today' : 'Καλό ψάρεμα σήμερα'), body, full: body, place: null, t: null }]);
            stats.morning = (stats.morning || 0) + 1;
          }
          const mg = res.tmrGood, ek = mg ? 'ev:' + mg.date : null;
          /* αν ήδη φεύγει η βραδινή υπενθύμιση «Αύριο» για την ίδια τοποθεσία (από παλιότερη «καλή μέρα»), δεν στέλνεται δεύτερο μήνυμα */
          const dup = mg && (res.msgs || []).some(m => m && m.key && String(m.key).indexOf(':eve:' + mg.date) >= 0);
          if ((mode === 'eve' || mode === 'both') && hh >= 19 && hh <= 22 && mg && !res.notified[ek]) {
            res.notified[ek] = 1;
            if (!dup) {
              const body = (en ? 'Tomorrow at ' : 'Αύριο στο ') + mg.place + ': ' + pad(mg.win.s) + ':00–' + pad((mg.win.e + 1) % 24) + ':00 · ' + (en ? 'score ' : 'δείκτης ') + mg.best + '.';
              res.msgs = (res.msgs || []).concat([{ kind: 'good', key: ek, title: '🌙 ' + (en ? 'Good fishing tomorrow' : 'Καλό ψάρεμα αύριο'), body, full: body, place: null, t: mg.date }]);
              stats.evening = (stats.evening || 0) + 1;
            }
          }
        } catch (e) { log('morning: ' + e.message); }
        for (const m of res.msgs || []) {
          const at = new Date().toISOString();
          // v31z358: ίδιο μήνυμα την ίδια μέρα στον ίδιο χρήστη = μία φορά, ακόμα κι αν ο χρήστης έχει πολλές εγγραφές push (π.χ. παλιά συνδρομή)
          const ck = 'c' + m.kind + ':' + hash32(m.title + '|' + m.body) + ':' + at.slice(0, 10);
          const payload = { title: m.title, body: m.body, full: m.full, kind: m.kind, id: ck, tag: 'alk-' + ck, at, place: m.place || null, t: m.t || null };
          // ιστορικό στη βάση (για να φαίνεται στην εφαρμογή ακόμα κι αν δεν φτάσει το push)· αν υπάρχει ήδη, δεν ξαναστέλνεται
          let dup = false;
          try { const ins = await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (r.user_id + '|' + ck).slice(0, 250), user_id: r.user_id, at, kind: m.kind, title: m.title, body: m.body, details: m.full, place: m.place || null, t: m.t || null }) }); dup = Array.isArray(ins) && ins.length === 0; }
          catch (e) { if (!stats.nlErr) { log('notif_log: ' + e.message + ' (τρέξε το notif_log.sql)'); stats.nlErr = 1; } }
          if (dup) { stats.dup = (stats.dup || 0) + 1; continue; }
          // στέλνεται σε όλες τις συσκευές του χρήστη μαζί
          for (const q of targets) {
            try { await webpush.sendNotification(q.sub, JSON.stringify(payload), { TTL: 6 * 3600 }); sent++; }
            catch (e) {
              if (e.statusCode === 404 || e.statusCode === 410) { await sb(`push_subs?id=eq.${encodeURIComponent(q.id)}`, { method: 'DELETE' }).catch(() => {}); if (q.id === r.id) gone = true; continue; }
              failed++; if (failed === 1) log('Push: ' + (e.statusCode || '') + ' ' + e.message + ' ' + String(e.body || '').slice(0, 160));
            }
          }
        }
        if (gone) continue;
        stats.fc += sent;
        // η κατάσταση «στάλθηκε» αποθηκεύεται πάντα, ώστε να μην ξαναβγαίνουν τα ίδια σε κάθε έλεγχο
        // v31z544: με πλάνο για σήμερα ξαναελέγχεται σε ~10 λεπτά (για το «ώρα να ξεκινήσεις»), αλλιώς σε ~3 ώρες
        const cyD = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' }), planToday = plans.some(p => p && p.date === cyD);
        await upd({ checked_at: new Date(Date.now() - (planToday ? 170 * 60e3 : 0)).toISOString(), state: res.notified });
      } catch (e) { log('Forecast job: ' + e.message); try { await upd({ checked_at: new Date().toISOString() }); } catch (e2) { /* τίποτα */ } }
    }
  }
  // 7) Πτώση πίεσης κατά τη διάρκεια έξοδου: push και/ή Telegram στον ίδιο τον ψαρά (ενδεικτικό, από μοντέλο Open-Meteo)
  try {
    const PA_DROP = 3.0, PA_COOL = 3 * 3600e3;
    const act = (await sb('safety_trips?status=eq.active&last_lat=not.is.null&select=*')) || [];
    if (act.length && !('pa_at' in act[0])) log('Πίεση: λείπει η στήλη pa_at (τρέξε το safety-upgrade.sql).');
    else for (const t of act) {
      if (t.pa_at && Date.now() - Date.parse(t.pa_at) < PA_COOL) continue;
      let drop = null, now_ = null;
      try {
        const r = await F(`https://api.open-meteo.com/v1/forecast?latitude=${(+t.last_lat).toFixed(3)}&longitude=${(+t.last_lon).toFixed(3)}&hourly=pressure_msl&past_hours=4&forecast_hours=1&timezone=UTC`);
        const j = await r.json(), ts = (j.hourly && j.hourly.time) || [], ps = (j.hourly && j.hourly.pressure_msl) || [];
        let i = -1; for (let k = 0; k < ts.length; k++) if (Date.parse(ts[k] + 'Z') <= Date.now() && typeof ps[k] === 'number') i = k;
        if (i >= 3 && typeof ps[i - 3] === 'number') { now_ = ps[i]; drop = ps[i] - ps[i - 3]; }
      } catch (e) { log('Πίεση (Open-Meteo): ' + e.message); continue; }
      if (drop == null || drop > -PA_DROP) continue;
      const body = `Η πίεση πέφτει γρήγορα: ${drop.toFixed(1)} hPa σε 3 ώρες (τώρα ${Math.round(now_)} hPa). Συχνά σημαίνει αλλαγή καιρού. Κοίταξε τον ορίζοντα και την πρόγνωση. Ενδεικτικό, από μοντέλο.`;
      const c = await contactOf(t.user_id).catch(() => null);
      let sent = 0;
      if (c && c.self_chat_id != null && TG) { try { await tg('sendMessage', { chat_id: c.self_chat_id, text: '⚠ Alkyon: ' + body }); sent++; } catch (e) { log('Πίεση Telegram: ' + e.message); } }
      if (webpush) {
        const subs = await sb(`push_subs?user_id=eq.${t.user_id}&select=*`).catch(() => []);
        const at = new Date().toISOString(), key = 'trip-pa:' + t.id + ':' + at.slice(0, 13);
        try { await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (t.user_id + '|' + key).slice(0, 250), user_id: t.user_id, at, kind: 'pressure', title: '📉 Πτώση πίεσης στην έξοδο', body, details: body, place: { name: 'Έξοδος', lat: +t.last_lat, lon: +t.last_lon }, t: at }) }); } catch (e) { /* χωρίς ιστορικό */ }
        for (const r of subs || []) { try { await webpush.sendNotification(r.sub, JSON.stringify({ title: '📉 Πτώση πίεσης στην έξοδο', body, full: body, kind: 'pressure', id: key, tag: 'alk-trip-pa-' + at.slice(0, 13), at, place: { name: 'Έξοδος', lat: +t.last_lat, lon: +t.last_lon } }), { TTL: 3600 }); sent++; } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }).catch(() => {}); } }
      }
      await patch(t.id, { pa_at: new Date().toISOString() });
      if (sent) stats.pa++;
    }
  } catch (e) { log('Πίεση: ' + e.message); }
  // 7β) Κοινότητα (βλ. commStep πιο πάνω· 1.9.61: καλείται και αμέσως από την εφαρμογή με action 'comm')
  await commStep();

  // 7γ) 1.9.44 (1.9.47: καλύτερη ώρα, μόνο βράδια ±3 μέρες από τη νέα σελήνη): καλαμάρια γύρω από τη νέα σελήνη (μόνο όσοι το άνοιξαν: places[].squid === 'on').
  //   Οκτώβριος–Απρίλιος, 09:00–10:00 Κύπρου, από 3 μέρες πριν έως 2 μέρες μετά τη νέα σελήνη.
  //   Η καλύτερη ώρα κάθε βραδιού (δύση ±90′, άνεμος <8 kn, κύμα ≤0,6 m, PF.squidEves), πρώτο το καλύτερο. Μία ειδοποίηση ανά σελήνη ανά χρήστη (notif_log).
  if (webpush) {
    try {
      const nowD = new Date(), cyHs = +nowD.toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2), mon = +nowD.toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', month: 'numeric' });
      const nm = PF.nextMoon(Date.now() - 2 * 86400000); /* η νέα σελήνη που δεν έχει περάσει πάνω από 2 μέρες */
      if (cyHs === 9 && (mon >= 10 || mon <= 4) && nm && nm.nw && nm.nw - Date.now() <= 3 * 86400000) {
        const nmKey = new Date(nm.nw).toISOString().slice(0, 10);
        const subsS = (await sb('push_subs?select=id,user_id,sub,places').catch(() => [])) || [];
        const byU = {}; for (const r of subsS) (byU[r.user_id] = byU[r.user_id] || []).push(r);
        const fcMem = {};
        for (const uid of Object.keys(byU)) {
          const rows = byU[uid]; const pls = rows.flatMap(r => r.places || []); if (!pls.find(p => p && p.squid === 'on')) continue;
          // 1.9.48: όλα τα μέρη του χρήστη (έως 6), όχι μόνο το πρώτο· το καλύτερο βράδυ από όλα, με το όνομα του μέρους
          const seen = {}, plist = [];
          for (const p of pls) { if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue; const k = (+p.lat).toFixed(2) + ',' + (+p.lon).toFixed(2); if (seen[k]) continue; seen[k] = 1; plist.push({ p, k }); if (plist.length >= 6) break; }
          if (!plist.length) continue;
          const en = !!pls.find(p => p && p.lang === 'en');
          let good = [];
          for (const { p, k } of plist) {
            let fc = fcMem[k]; if (fc === undefined) { try { fc = await PF.getForecast(+p.lat, +p.lon, F, { days: 6, sp: { n: 'Καλαμάρι', l: 'Loligo vulgaris', sst: [14, 24] } }); } catch (e) { log('squid fc: ' + e.message); fc = null; } fcMem[k] = fc; }
            if (!fc || !fc.days) continue;
            good = good.concat(PF.squidEves(fc.days, nm.nw, { now: (fc.nowLocal || '').slice(0, 13) + ':00', lat: +p.lat, lon: +p.lon, tz: fc.tz }).map(g => ({ ...g, name: p.name || '' })));
          }
          if (!good.length) continue;
          good.sort((x, y) => y.score - x.score);
          // ένα βράδυ ανά μέρα στη λίστα (το καλύτερο μέρος εκείνης της μέρας)
          const byDay = {}; good = good.filter(g => byDay[g.date] ? false : (byDay[g.date] = 1));
          const multi = plist.length > 1;
          const pad = (n) => String(n).padStart(2, '0');
          const at_ = (g) => multi && g.name ? (en ? ' at ' : ' στο ') + g.name : '';
          const slot = (g) => PF.dayLabel(g.date) + ' ' + pad(g.hr) + ':00–' + pad((g.hr + 1) % 24) + ':00' + at_(g);
          const b0 = good[0], rest = good.slice(1, 4).map((g) => PF.dayLabel(g.date) + ' ' + pad(g.hr) + ':00' + at_(g));
          const nmTxt = new Date(nm.nw).toLocaleDateString(en ? 'en-GB' : 'el-GR', { timeZone: 'Asia/Nicosia', weekday: 'long', day: 'numeric', month: 'long' });
          const title = en ? '🦑 Squid: new moon ' + nmTxt : '🦑 Καλαμάρια: νέα σελήνη ' + nmTxt;
          const body = (en ? 'Best: ' : 'Καλύτερο: ') + slot(b0) + (en ? ' (score ' : ' (βαθμός ') + b0.score + ')' + (b0.dark && PF.darkTxt ? ' · ' + PF.darkTxt(b0.dark, en) : '') + (rest.length ? (en ? ' · also ' : ' · επίσης ') + rest.join(', ') : '') + (!multi && b0.name ? ' · ' + b0.name : '');
          const at = new Date().toISOString();
          let ins = null; try { ins = await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (uid + '|sq:' + nmKey).slice(0, 250), user_id: uid, at, kind: 'good', title, body }) }); } catch (e) { log('squid notif_log: ' + e.message); continue; } /* 1.9.48: χωρίς καταγραφή δεν στέλνουμε (αλλιώς θα ξαναστελνόταν την επόμενη μέρα) */
          if (!Array.isArray(ins) || !ins.length) continue;
          for (const r of rows) {
            try { await webpush.sendNotification(r.sub, JSON.stringify({ title, body, full: body, kind: 'good', id: 'sq:' + nmKey, tag: 'alk-sq-' + nmKey, at }), { TTL: 6 * 3600 }); stats.squid = (stats.squid || 0) + 1; }
            catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE' }).catch(() => {}); }
          }
        }
      }
    } catch (e) { log('squid: ' + e.message); }
  }

  // 8) v31z543: κατά την έξοδο, και με κλειστό κινητό: (α) καιρός που χαλάει τις επόμενες 3 ώρες στη θέση της εξόδου (καταιγίδα, άνεμος/ριπές/κύμα πάνω από τα όριά σου),
  //    (β) «ώρα να γυρίσεις»: απόσταση από το λιμάνι σου και ταχύτητα επιστροφής σε σχέση με τη δύση και την ώρα επιστροφής που δήλωσες. Έλεγχος ανά ~15 λεπτά.
  try {
    if (webpush && await stepDue('trip_wx', 15 * 60e3)) {
      const act = (await sb('safety_trips?status=eq.active&last_lat=not.is.null&select=*')) || [];
      for (const t of act) {
        const subs = (await sb(`push_subs?user_id=eq.${t.user_id}&select=*`).catch(() => [])) || []; if (!subs.length) continue;
        const pl = [].concat(...subs.map(x => x.places || [])), cfg = pl.find(p => p && (p.lim || p.home)) || pl[0] || {};
        const en = cfg.lang === 'en', tx = (a, b) => en ? b : a, L = Object.assign({ wind: 14, gust: 24, wave: 0.9 }, cfg.lim || {});
        const lat = +t.last_lat, lon = +t.last_lon, now = Date.now(), msgs = [];
        const hm = ms => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', minute: '2-digit' });
        /* (α) καιρός */
        try {
          const q = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&forecast_hours=4&timezone=UTC`;
          const [w, m] = await Promise.all([F(`https://api.open-meteo.com/v1/forecast?${q}&hourly=wind_speed_10m,wind_gusts_10m,weather_code&wind_speed_unit=kn`).then(r => r.json()), F(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height`).then(r => r.json()).catch(() => null)]);
          const ts = (w.hourly && w.hourly.time) || [], H = w.hourly || {}, wv = (m && m.hourly && m.hourly.wave_height) || [];
          let storm = null, over = null;
          ts.forEach((tt, i) => { const ms = Date.parse(tt + 'Z'); if (ms < now - 3600e3 || ms > now + 3 * 3600e3) return;
            if (!storm && H.weather_code && H.weather_code[i] >= 95) storm = ms;
            const ws = H.wind_speed_10m && H.wind_speed_10m[i], gs = H.wind_gusts_10m && H.wind_gusts_10m[i], wh = wv[i];
            if (!over && ((ws != null && ws > L.wind) || (gs != null && gs > L.gust) || (wh != null && wh > L.wave))) over = { ms, ws, gs, wh }; });
          if (storm) msgs.push({ k: 'storm:' + new Date(storm).toISOString().slice(0, 13), title: tx('⛈ Πιθανή καταιγίδα', '⛈ Thunderstorm possible'), body: tx('Γύρω στις ', 'Around ') + hm(storm) + tx(' στην περιοχή της εξόδου σου. Κοίταξε τον ουρανό και σκέψου την επιστροφή.', ' near your trip area. Watch the sky and consider heading back.') });
          if (over) msgs.push({ k: 'wx:' + new Date(over.ms).toISOString().slice(0, 10), title: tx('💨 Ο καιρός χαλάει', '💨 Weather is getting worse'), body: tx('Γύρω στις ', 'Around ') + hm(over.ms) + ': ' + [over.ws != null ? tx('άνεμος ', 'wind ') + Math.round(over.ws) + ' kn' : '', over.gs != null && over.gs > L.gust ? tx('ριπές ', 'gusts ') + Math.round(over.gs) + ' kn' : '', over.wh != null && over.wh > L.wave ? tx('κύμα ', 'waves ') + over.wh.toFixed(1) + ' m' : ''].filter(Boolean).join(', ') + tx(' (πάνω από τα όριά σου).', ' (over your limits).'), ms: over.ms });
        } catch (e) { log('Καιρός εξόδου: ' + e.message); }
        /* (β) ώρα να γυρίσεις */
        const hm0 = cfg.home;
        if (hm0 && hm0.lat != null) {
          const R = Math.PI / 180, dx = (hm0.lon - lon) * R * Math.cos((hm0.lat + lat) / 2 * R), dy = (hm0.lat - lat) * R, km = Math.sqrt(dx * dx + dy * dy) * 6371 * 1.1, nm = km / 1.852;
          const kn = +hm0.kn > 2 ? +hm0.kn : 15, eta = nm / kn * 60;
          if (nm >= 0.5) {
            const name = hm0.name || tx('το λιμάνι', 'the port'), due = t.due_at ? Date.parse(t.due_at) : null;
            if (due && due > now && due - now <= (eta + 10) * 60e3) msgs.push({ k: 'due:' + t.due_at, title: tx('🏠 Ώρα να γυρίσεις', '🏠 Time to head back'), body: tx('Για να είσαι πίσω στις ', 'To be back by ') + hm(due) + tx(' που δήλωσες, ξεκίνα τώρα: ~', ' as planned, leave now: ~') + Math.round(eta) + tx('′ για ', ' min to ') + name + ' (' + nm.toFixed(1) + ' nm).' });
            try { if (PF && PF.sunMoon) { const d = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' }), tz = Math.round((Date.parse(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })) - Date.parse(new Date().toLocaleString('en-US', { timeZone: 'UTC' }))) / 60000);
              const sm = PF.sunMoon(d, lat, lon, tz), set = Date.parse(d + 'T00:00:00Z') - tz * 60e3 + sm.set * 60e3;
              if (set > now && set - now <= (eta + 15) * 60e3) msgs.push({ k: 'sunset:' + d, title: tx('🌅 Η δύση πλησιάζει', '🌅 Sunset is near'), body: tx('Δύση στις ', 'Sunset at ') + hm(set) + tx('. Χρειάζεσαι ~', '. You need ~') + Math.round(eta) + tx('′ για ', ' min to ') + name + ' (' + nm.toFixed(1) + ' nm).' }); } } catch (e) { /* χωρίς δύση */ }
            const wx = msgs.find(x => x.ms); if (wx && wx.ms - now <= (eta + 30) * 60e3) msgs.push({ k: 'back:' + new Date(wx.ms).toISOString().slice(0, 13), title: tx('🏠 Ώρα να γυρίσεις', '🏠 Time to head back'), body: tx('Ο καιρός χαλάει γύρω στις ', 'The weather turns around ') + hm(wx.ms) + tx(' και η επιστροφή θέλει ~', ' and the trip home takes ~') + Math.round(eta) + tx('′ (', ' min (') + nm.toFixed(1) + ' nm).' });
          }
        }
        for (const m of msgs) {
          const at = new Date().toISOString(), key = 'trip-wx:' + t.id + ':' + m.k;
          let ins = null; try { ins = await sb('notif_log', { method: 'POST', headers: { Prefer: 'return=representation,resolution=ignore-duplicates' }, body: JSON.stringify({ id: (t.user_id + '|' + key).slice(0, 250), user_id: t.user_id, at, kind: 'info', title: m.title, body: m.body, details: m.body, place: { name: tx('Έξοδος', 'Trip'), lat, lon }, t: at }) }); } catch (e) { ins = [1]; }
          if (Array.isArray(ins) && !ins.length) continue; /* στάλθηκε ήδη */
          for (const r of subs) { try { await webpush.sendNotification(r.sub, JSON.stringify({ title: m.title, body: m.body, full: m.body, kind: 'info', id: key, tag: 'alk-' + key.slice(-40), at, place: { name: tx('Έξοδος', 'Trip'), lat, lon } }), { TTL: 1800 }); stats.tripwx = (stats.tripwx || 0) + 1; } catch (e) { /* συνδρομή που έληξε: καθαρίζεται στο 6 */ } }
        }
      }
      await stepOk('trip_wx');
    }
  } catch (e) { log('Καιρός εξόδου: ' + e.message); }
  // 8β) 1.14.21–1.14.23: «Πότε τσιμπάνε» από τον catch_obs (ανώνυμα, με συγκατάθεση).
  //  (α) Συμπλήρωση καιρού (κάθε εκτέλεση, λίγα κελιά) από το ιστορικό του Open-Meteo, ίδια πηγή για όλους:
  //      ψάρι/χαμένο → cond.e (η ώρα του) + cond.d (όλες οι ώρες φωτός της ίδιας μέρας, για σύγκριση)· έξοδος → cond.e (κάθε ώρα της). cond.enr=2.
  //  (β) Συγκεντρωτικά (μία φορά τη μέρα μετά τις 03:00 Κύπρου), δύο μέθοδοι:
  //      1. ΟΛΑ τα ψάρια, σύγκριση με τις ώρες της ίδιας μέρας (cc): πόσο πιο συχνή είναι μια συνθήκη στα ψάρια απ' ό,τι στις ώρες που υπήρχαν.
  //         Αφού ο ψαράς ήταν έξω εκείνη τη μέρα, η επιλογή «βγαίνω με καλό καιρό» δεν αλλοιώνει το αποτέλεσμα. Σελήνη: σύγκριση με ομοιόμορφη κατανομή.
  //      2. Έξοδοι (r): ψάρια ανά ώρα ψαρέματος, μετράνε και οι ώρες χωρίς ψάρι. Για είδος: οι έξοδοι με αυτόν τον στόχο (αν ≥ 10 ώρες).
  //      Ευρήματα (ins) με «both» όταν συμφωνούν και οι δύο, και «τι δούλεψε» (τεχνική, δόλωμα, βάθος) στις καλές συνθήκες.
  //      Κλειδιά bite_stats: 'all', 'sp:<είδος>', 'r:<κελί 2°>'· προσωπικά στον user_bite_stats (μόνο ο ίδιος τα διαβάζει).
  //  (γ) 1.14.23: κάθε απόγευμα (17–19 Κύπρου) ειδοποίηση «🎯 Αύριο … μοιάζει με τις καλύτερες ώρες σου» όταν η πρόγνωση ταιριάζει με τα προσωπικά ευρήματα.
  if (PF) {
    const HR = 3600000, DAY = 86400000, isoD = ms => new Date(ms).toISOString().slice(0, 10), nz = v => (typeof v === 'number' && isFinite(v)) ? v : null;
    const tzOf = lon => Math.round((+lon || 0) / 15) * 60, SMC = {}, SOL = {};
    const sunOf = (ms, la, lo) => { const tz = tzOf(lo), d = isoD(ms + tz * 60000), ck = d + ',' + la + ',' + lo; return { sm: SMC[ck] || (SMC[ck] = PF.sunMoon(d, +la, +lo, tz)), tz, d }; };
    const wxCache = {};
    const wxFor = async (la, lo, d1, d2) => {
      const ck = la + ',' + lo + ',' + d1 + ',' + d2; if (ck in wxCache) return wxCache[ck];
      const t1 = Date.parse(d1 + 'T00:00:00Z'), fut = Date.parse(d2 + 'T00:00:00Z') > Date.now() - DAY, recent = Date.now() - t1 < 85 * DAY;
      const past = Math.max(1, Math.min(92, Math.ceil((Date.now() - t1) / DAY) + 1)), pos = 'latitude=' + la + '&longitude=' + lo + '&timezone=GMT';
      const wv = 'temperature_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,precipitation';
      const mv = 'wave_height,wave_period,sea_surface_temperature,sea_level_height_msl,ocean_current_velocity';
      const fd = fut ? 3 : 1;
      const wu = recent ? `https://api.open-meteo.com/v1/forecast?${pos}&hourly=${wv}&past_days=${past}&forecast_days=${fd}&wind_speed_unit=kn`
        : `https://archive-api.open-meteo.com/v1/archive?${pos}&hourly=${wv}&start_date=${d1}&end_date=${d2}&wind_speed_unit=kn`;
      const mu = `https://marine-api.open-meteo.com/v1/marine?${pos}&hourly=${mv}` + (recent ? `&past_days=${past}&forecast_days=${fd}` : `&start_date=${d1}&end_date=${d2}`) + '&cell_selection=sea';
      const get = u => F(u).then(r => r.ok ? r.json() : null).catch(() => null);
      const [w, m] = await Promise.all([get(wu), get(mu)]);
      if (!w || !w.hourly || !w.hourly.time) return (wxCache[ck] = null);
      const H = {}, wh = w.hourly, mh = (m && m.hourly) || {}, mi = {};
      (mh.time || []).forEach((t, i) => { mi[t] = i; });
      wh.time.forEach((t, i) => { const k = mi[t], g = (a) => k == null ? null : nz(mh[a] && mh[a][k]);
        H[t] = { wind: nz(wh.wind_speed_10m[i]), gust: nz(wh.wind_gusts_10m && wh.wind_gusts_10m[i]), wdeg: nz(wh.wind_direction_10m && wh.wind_direction_10m[i]), press: nz(wh.pressure_msl[i]), cloud: nz(wh.cloud_cover[i]), rain: nz(wh.precipitation && wh.precipitation[i]), temp: nz(wh.temperature_2m[i]),
          wave: g('wave_height'), per: g('wave_period'), sst: g('sea_surface_temperature'), sl: g('sea_level_height_msl'), cur: g('ocean_current_velocity') }; });
      return (wxCache[ck] = H);
    };
    const key = ms => new Date(Math.round(ms / HR) * HR).toISOString().slice(0, 13) + ':00';
    const feat = (H, ms) => { const t = Math.round(ms / HR) * HR, a = H[key(t)]; if (!a) return null; const b = H[key(t - 3 * HR)], p1 = H[key(t - HR)], n1 = H[key(t + HR)];
      const o = { t, wind: a.wind, gust: a.gust, wdeg: a.wdeg, press: a.press, cloud: a.cloud, rain: a.rain, temp: a.temp, wave: a.wave, per: a.per, sst: a.sst, cur: a.cur };
      if (a.press != null && b && b.press != null) o.pt = Math.round((a.press - b.press) * 10) / 10;
      if (p1 && n1 && p1.sl != null && n1.sl != null) o.tide = Math.round((n1.sl - p1.sl) * 100) / 100;
      // 1.14.25: νερό που ζεσταίνει/κρυώνει (3 μέρες) και θάλασσα τις 2 προηγούμενες μέρες (θολούρα από κύμα: εκτίμηση διαύγειας)
      const s72 = H[key(t - 72 * HR)]; if (a.sst != null && s72 && s72.sst != null) o.sstd = Math.round((a.sst - s72.sst) * 10) / 10;
      let wmx = null; for (let q = 1; q <= 48; q++) { const x = H[key(t - q * HR)]; if (x && x.wave != null && (wmx == null || x.wave > wmx)) wmx = x.wave; } if (wmx != null) o.wv48 = wmx;
      for (const k of Object.keys(o)) if (o[k] == null) delete o[k]; else if (k !== 't' && k !== 'tide' && k !== 'pt' && k !== 'sstd') o[k] = Math.round(o[k] * 10) / 10;
      return o; };
    // ώρες φωτός (ανατολή −1 h … δύση +1 h) της τοπικής μέρας μιας στιγμής
    // 1.14.26: σύγκριση με τις ώρες που θα μπορούσε να πιαστεί: τσίμπημα τη μέρα → ώρες φωτός· τσίμπημα βράδυ/νύχτα → από 2 ώρες πριν τη δύση ως την ανατολή
    const nightHours = (ms, la, lo) => { const { sm, tz, d } = sunOf(ms, la, lo); if (!sm || sm.rise == null) return []; const d0 = Date.parse(d + 'T00:00:00Z') - tz * 60000, m = (ms + tz * 60000) % DAY / 60000, out = [];
      let a, b; if (m < sm.rise + 60) { const p = sunOf(ms - DAY, la, lo).sm; a = d0 - DAY + ((p && p.set != null ? p.set : sm.set) - 120) * 60000; b = d0 + sm.rise * 60000; } else { const nx = sunOf(ms + DAY, la, lo).sm; a = d0 + (sm.set - 120) * 60000; b = d0 + DAY + ((nx && nx.rise != null ? nx.rise : sm.rise)) * 60000; }
      for (let t = Math.ceil(a / HR) * HR; t <= b; t += HR) out.push(t); return out; };
    const ctlHours = (ms, la, lo) => { const { sm, tz } = sunOf(ms, la, lo); if (!sm || sm.rise == null) return []; const m = (ms + tz * 60000) % DAY / 60000; return (m >= sm.rise - 60 && m <= sm.set - 120) ? dayHours(ms, la, lo) : nightHours(ms, la, lo); };
    const thermoOf = P => { if (!P || P.length < 3) return null; let best = null; const gr = i => (P[i].t - P[i + 1].t) / Math.max(0.5, P[i + 1].d - P[i].d);
      for (let i = 0; i < P.length - 1; i++) { const g = gr(i); if (!best || g > best.g) best = { g, i }; }
      if (!best || best.g < 0.05 || P[0].t - P[P.length - 1].t < 1) return null; let a = best.i; while (a > 0 && gr(a - 1) >= best.g * 0.5) a--; return { top: P[a].d }; };
    const dayHours = (ms, la, lo) => { const { sm, tz, d } = sunOf(ms, la, lo); if (!sm || sm.rise == null) return []; const d0 = Date.parse(d + 'T00:00:00Z') - tz * 60000, out = [];
      for (let m = Math.ceil((sm.rise - 60) / 60) * 60; m <= sm.set + 60; m += 60) out.push(d0 + m * 60000); return out; };
    try {
      const todo = (await sb(`catch_obs?select=id,kind,day,ms,ms2,lat,lon,cond&cond->>enr=is.null&ms=lt.${Date.now() - 2 * HR}&lat=not.is.null&order=id.asc&limit=60`)) || [];
      let cells = 0, done = 0;
      for (const r of todo) {
        if (r.kind === 'trip' && !(r.ms2 && r.ms2 < Date.now() - HR)) continue;
        const t0 = +r.ms - 80 * HR, t1 = (r.kind === 'trip' ? +r.ms2 : +r.ms) + 30 * HR;
        const ck = r.lat + ',' + r.lon + ',' + isoD(t0) + ',' + isoD(t1); if (!(ck in wxCache)) { if (cells >= 10) continue; cells++; }
        const H = await wxFor(+r.lat, +r.lon, isoD(t0), isoD(t1));
        const cond = Object.assign({}, r.cond || {}); delete cond.e; delete cond.d;
        if (!H) cond.enr = -1;
        else if (r.kind === 'trip') { const hs = []; for (let t = Math.ceil(+r.ms / HR) * HR; t <= +r.ms2 && hs.length < 24; t += HR) { const f = feat(H, t); if (f) hs.push(f); }
          if (!hs.length) { const f = feat(H, (+r.ms + +r.ms2) / 2); if (f) hs.push(f); } cond.e = hs; cond.enr = hs.length ? 2 : -1; }
        else { const f = feat(H, +r.ms); if (f) { cond.e = f; cond.d = ctlHours(+r.ms, r.lat, r.lon).map(t => feat(H, t)).filter(Boolean); } cond.enr = f ? 2 : -1; }
        await sb(`catch_obs?id=eq.${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ cond }) });
        done++;
      }
      if (done) stats.benr = done;
    } catch (e) { log('bite stats: enrich ' + e.message); }
    // 1.14.29: χλωροφύλλη (Copernicus Μεσογείου, δορυφόρος L4 χωρίς κενά από σύννεφα) τη μέρα του ψαριού/της εξόδου → f.chl σε κάθε ώρα (cond.chv = 1 όταν ελέγχθηκε)
    try {
      const todoC = (await sb(`catch_obs?select=id,day,lat,lon,cond&cond->>enr=eq.2&or=(cond->>chv.is.null,cond->>chv.eq.1)&lat=gt.30&lat=lt.46.5&lon=gt.-6&lon=lt.37&order=id.asc&limit=12`)) || [];
      if (todoC.length) {
        const lr = await F(env.SUPABASE_URL + '/functions/v1/water-clarity?mode=layers').then(r => r.ok ? r.json() : null).catch(() => null), L = lr && lr.chl && lr.chl.layer;
        // παλιότερες μέρες: το αρχείο (MY L4) του ίδιου δορυφορικού προϊόντος· το NRT κρατά μόνο τους τελευταίους μήνες
        let LMY = null; const myLayer = async () => { if (LMY !== null) return LMY; LMY = ''; try { const r = await F('https://wmts.marine.copernicus.eu/teroWmts/OCEANCOLOUR_MED_BGC_L4_MY_009_144?service=WMTS&version=1.0.0&request=GetCapabilities'); if (r.ok) { const ids = [...(await r.text()).matchAll(/<(?:[\w-]+:)?Identifier[^>]*>\s*([^<]+?\/CHL)\s*<\//gi)].map(m => m[1]).filter(x => /P1D/i.test(x)); LMY = ids.sort((a, b) => (/gapfree/i.test(b) ? 1 : 0) - (/gapfree/i.test(a) ? 1 : 0))[0] || ''; } } catch (e) { } return LMY; };
        if (L) {
          const tile = (la, lo) => { const n = 1024, x = (lo + 180) / 360 * n, sn = Math.sin(la * Math.PI / 180), y = (0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI)) * n, col = Math.floor(x), row = Math.floor(y); return { col, row, i: Math.min(255, Math.floor((x - col) * 256)), j: Math.min(255, Math.floor((y - row) * 256)) }; };
          const num = o => { const fs = o && Array.isArray(o.features) ? o.features : []; for (const f of fs) { const v = f && f.properties && f.properties.value; const n = Array.isArray(v) ? v.find(x => typeof x === 'number') : v; if (typeof n === 'number' && isFinite(n) && n > 0 && n < 50) return n; } return null; };
          const one = async (la, lo, day, ly) => { const t = tile(la, lo); try { const r = await F('https://wmts.marine.copernicus.eu/teroWmts/?service=WMTS&version=1.0.0&request=GetFeatureInfo&layer=' + encodeURIComponent(ly || L) + '&tilematrixset=EPSG:3857&tilematrix=10&tilerow=' + t.row + '&tilecol=' + t.col + '&i=' + t.i + '&j=' + t.j + '&INFOFORMAT=application/json&time=' + day + 'T00:00:00.000Z'); return r.ok ? num(await r.json()) : null; } catch (e) { return null; } };
          let nC = 0;
          for (const r of todoC) {
            const la = +r.lat, lo = +r.lon, day = r.day; if (!day) continue; const d = 0.04, dl = d / Math.cos(la * Math.PI / 180);
            const pts = [[la, lo], [la + d, lo], [la - d, lo], [la, lo + dl], [la, lo - dl], [la + d, lo + dl], [la - d, lo - dl], [la + d, lo - dl], [la - d, lo + dl]];
            let v = (await Promise.all(pts.map(p => one(p[0], p[1], day)))).filter(x => x != null);
            if (!v.length) { const my = await myLayer(); if (my) v = (await Promise.all(pts.map(p => one(p[0], p[1], day, my)))).filter(x => x != null); }
            if (!v.length) { const pts2 = pts.slice(1).map(p => [la + (p[0] - la) * 2.2, lo + (p[1] - lo) * 2.2]); v = (await Promise.all(pts2.map(p => one(p[0], p[1], day)))).filter(x => x != null); }   // κοντά στην ακτή: ~9 km γύρω
            v.sort((a, b) => a - b); const chl = v.length ? Math.round(v[v.length >> 1] * 1000) / 1000 : null;
            if (chl == null && day >= isoD(Date.now() - 4 * DAY)) continue;   // ο δορυφόρος βγάζει τη μέρα με 1–3 μέρες καθυστέρηση: ξαναδοκιμάζει αργότερα
            const cond = Object.assign({}, r.cond || {}); cond.chv = 2; if (chl != null) { cond.chl = chl; const put = o => { if (Array.isArray(o)) o.forEach(x => { if (x) x.chl = chl; }); else if (o) o.chl = chl; }; put(cond.e); put(cond.d); }
            await sb(`catch_obs?id=eq.${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ cond }) }); nC++; }
          if (nC) stats.bchl = nC;
        }
      }
    } catch (e) { log('bite stats: chl ' + e.message); }
    // 1.14.30: θερμοκλινές τη μέρα του ψαριού (μοντέλο Copernicus Μεσογείου, μέσω water-clarity ?mode=profile&day=) → f.thd σε κάθε ώρα: 0 = ανακατεμένο νερό, αλλιώς βάθος (m) που αρχίζει
    try {
      const todoT = (await sb(`catch_obs?select=id,day,lat,lon,cond&cond->>enr=eq.2&cond->>thv=is.null&lat=gt.30&lat=lt.46.5&lon=gt.-6&lon=lt.37&order=id.asc&limit=6`)) || [];
      let nT = 0;
      for (const r of todoT) {
        if (!r.day) continue; let v = null;
        try { const q = await F(env.SUPABASE_URL + '/functions/v1/water-clarity?mode=profile&lat=' + (+r.lat).toFixed(2) + '&lon=' + (+r.lon).toFixed(2) + '&day=' + r.day); v = await q.json().catch(() => null); } catch (e) { v = null; }
        const P = v && Array.isArray(v.prof) ? v.prof.filter(x => typeof x.d === 'number' && typeof x.t === 'number').sort((a, b) => a.d - b.d) : null;
        if (!v || ((!P || P.length < 3) && r.day >= isoD(Date.now() - 4 * DAY))) continue;   // χωρίς απάντηση ή πολύ πρόσφατη μέρα: ξανά αργότερα
        const cond = Object.assign({}, r.cond || {}); cond.thv = 1;
        if (P && P.length >= 3) { const th = thermoOf(P), thd = th ? th.top : 0; cond.thd = thd; const put = o => { if (Array.isArray(o)) o.forEach(x => { if (x) x.thd = thd; }); else if (o) o.thd = thd; }; put(cond.e); put(cond.d); }
        await sb(`catch_obs?id=eq.${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ cond }) }); nT++; }
      if (nT) stats.bthd = nT;
    } catch (e) { log('bite stats: thermo ' + e.message); }

    // συνθήκες → κουτάκια (ίδια σειρά με τις ετικέτες στο v4/contrib.js)
    const sunBin = (ms, la, lo) => { const { sm, tz } = sunOf(ms, la, lo); const m = (ms + tz * 60000) % DAY / 60000;
      if (!sm || sm.rise == null) return null; if (m < sm.rise - 60 || m > sm.set + 60) return 0; if (m < sm.rise + 90) return 1; if (m > sm.set - 90) return 5; const mid = (sm.rise + sm.set) / 2; return m < mid - 120 ? 2 : m <= mid + 120 ? 3 : 4; };
    const solBin = (ms, la, lo) => { const d = isoD(ms), ck = d + ',' + la + ',' + lo; const ps = SOL[ck] || (SOL[ck] = PF.solunarPeriods(Date.parse(d + 'T00:00:00Z') - 6 * HR, Date.parse(d + 'T00:00:00Z') + 30 * HR, +la, +lo));
      const p = ps.find(x => ms >= x.s && ms <= x.e && x.kind === 'major') || ps.find(x => ms >= x.s && ms <= x.e); return p ? (p.kind === 'major' ? 0 : 1) : 2; };
    const FX = {
      sun: (f, ms, la, lo) => sunBin(ms, la, lo), moon: (f, ms) => Math.round(PF.moonPhase(ms).f * 8) % 8, sol: (f, ms, la, lo) => solBin(ms, la, lo),
      pt: f => f.pt == null ? null : f.pt <= -0.7 ? 0 : f.pt >= 0.7 ? 2 : 1,
      pl: f => f.press == null ? null : f.press < 1010 ? 0 : f.press < 1015 ? 1 : f.press < 1020 ? 2 : 3,
      wind: f => f.wind == null ? null : f.wind < 5 ? 0 : f.wind < 10 ? 1 : f.wind < 15 ? 2 : 3,
      wave: f => f.wave == null ? null : f.wave < 0.3 ? 0 : f.wave < 0.6 ? 1 : f.wave < 1 ? 2 : 3,
      tide: f => f.tide == null ? null : f.tide >= 0.02 ? 0 : f.tide <= -0.02 ? 1 : 2,
      cloud: f => f.cloud == null ? null : f.cloud < 25 ? 0 : f.cloud < 75 ? 1 : 2,
      rain: f => f.rain == null ? null : f.rain >= 0.2 ? 1 : 0,
      cur: f => f.cur == null ? null : f.cur < 0.4 ? 0 : f.cur < 1 ? 1 : 2,
      sstd: f => f.sstd == null ? null : f.sstd <= -0.5 ? 0 : f.sstd >= 0.5 ? 2 : 1,
      // 1.14.26: πραγματικό σκοτάδι = φάση σελήνης × πόσο ψηλά είναι × νέφωση (0 μέρα, 1 πολύ σκοτεινά, 2 μισοσκόταδο, 3 φεγγαρόφωτο)
      dark: (f, ms, la, lo) => { const sb = sunBin(ms, la, lo); if (sb == null) return null; if (sb >= 2 && sb <= 4) return 0; const al = PF.moonAlt(ms, +la, +lo), il = PF.moonPhase(ms).illum;
        const L = il * Math.max(0, Math.sin(al * Math.PI / 180)) * (1 - 0.8 * Math.min(100, Math.max(0, f.cloud == null ? 30 : f.cloud)) / 100); return L < 0.05 ? 1 : L < 0.25 ? 2 : 3; },
      // ώρες μετά τη δύση (0 μέρα, 1 0–1 h, 2 1–3 h, 3 3–6 h, 4 αργά τη νύχτα, 5 πριν την αυγή)
      aft: (f, ms, la, lo) => { const { sm, tz } = sunOf(ms, la, lo); if (!sm || sm.rise == null) return null; const m = (ms + tz * 60000) % DAY / 60000;
        if (m >= sm.rise && m < sm.set) return 0; if (m < sm.rise && m >= sm.rise - 90) return 5; const after = m >= sm.set ? m - sm.set : m + 1440 - sm.set; return after < 60 ? 1 : after < 180 ? 2 : after < 360 ? 3 : 4; },
      season: (f, ms) => { const mo = new Date(ms).getUTCMonth(); return mo === 11 || mo <= 1 ? 0 : mo <= 4 ? 1 : mo <= 7 ? 2 : 3; },
      sstb: f => f.sst == null ? null : f.sst < 16 ? 0 : f.sst < 19 ? 1 : f.sst < 22 ? 2 : f.sst < 25 ? 3 : 4,
      wv48: f => f.wv48 == null ? null : f.wv48 < 0.5 ? 0 : f.wv48 < 1.2 ? 1 : 2,
      // 1.14.29: χλωροφύλλη (mg/m³): πολύ καθαρό νερό … θολό/πλούσιο
      thc: f => f.thd == null ? null : f.thd === 0 ? 0 : f.thd < 20 ? 1 : f.thd < 50 ? 2 : 3,
      chl: f => f.chl == null ? null : f.chl < 0.04 ? 0 : f.chl < 0.07 ? 1 : f.chl < 0.12 ? 2 : 3,
    };
    const NB = { sun: 6, moon: 8, sol: 3, pt: 3, pl: 4, wind: 4, wave: 4, tide: 3, cloud: 3, rain: 2, cur: 3, sstd: 3, wv48: 3, dark: 4, aft: 6, season: 4, sstb: 5, chl: 4, thc: 4 };
    const DAYLEVEL = new Set(['season', 'sstb', 'chl', 'thc']);   // ίδιο όλη τη μέρα: μόνο από τις εξόδους, όχι σύγκριση ίδιας μέρας
    const bins = (f, ms, la, lo) => { const o = {}; for (const k of Object.keys(FX)) { const b = FX[k](f || {}, ms, la, lo); if (b != null) o[k] = b; } return o; };
    const depB = v => v == null ? null : v < 10 ? '0–10 m' : v < 30 ? '10–30 m' : v < 60 ? '30–60 m' : v < 100 ? '60–100 m' : '100+ m';
    const arr = n => Array(n).fill(0);
    // ένα «σύνολο» ψαριών (όλοι / είδος / περιοχή / ένας χρήστης) → data
    const analyse = (catches, trips, minCase, excl) => { const EX = new Set(excl || []);
      const c = {}, ctl = {}, fish = {}, eff = {}, worked = {};
      for (const k of Object.keys(NB)) { c[k] = arr(NB[k]); ctl[k] = arr(NB[k]); fish[k] = arr(NB[k]); eff[k] = arr(NB[k]); }
      const tripsBy = {}; for (const t of trips) (tripsBy[t.user_id] = tripsBy[t.user_id] || []).push(t);
      for (const t of trips) for (const f of t.cond.e) { const bb = bins(f, f.t, t.lat, t.lon); for (const k in bb) eff[k][bb[k]] += 1; }
      let n = 0; const users = new Set();
      // 1.14.25: κάθε τσίμπημα μετράει ως «γεγονός»: 30 γόπες μαζί ≈ 6, όχι 30 (1 + log2 του πλήθους)
      const ev = r => 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1)));
      // δίκαιο βάρος: με ≥ 3 ψαράδες κανείς δεν ξεπερνά το 25% του συνόλου
      const uT = {}; let tot = 0; for (const r of catches) { const v = ev(r); uT[r.user_id] = (uT[r.user_id] || 0) + v; tot += v; }
      const nu = Object.keys(uT).length, uf = {}; for (const u in uT) uf[u] = nu >= 3 ? Math.min(1, 0.25 * tot / uT[u]) : 1;
      for (const r of catches) {
        const w = ev(r) * uf[r.user_id], e = r.cond && r.cond.e && !Array.isArray(r.cond.e) ? r.cond.e : null, bb = bins(e, +r.ms, r.lat, r.lon);
        n += Math.max(1, Math.min(999, r.cnt || 1)); users.add(r.user_id);
        const inTrip = (tripsBy[r.user_id] || []).some(t => +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000);
        for (const f in bb) { c[f][bb[f]] += w; if (inTrip) fish[f][bb[f]] += w;
          const wk = (worked[f + ':' + bb[f]] = worked[f + ':' + bb[f]] || { tech: {}, bait: {}, dep: {}, lure: {} });
          const lc = r.cond && r.cond.lc, lw = r.cond && r.cond.lw; if (lc || lw) { const lk = [lc, lw != null ? lw : ''].filter(x => x !== '' && x != null).join(' '); wk.lure[lk] = (wk.lure[lk] || 0) + w; }
          if (r.tech) wk.tech[r.tech] = (wk.tech[r.tech] || 0) + w; const bt = r.cond && r.cond.bait; if (bt) wk.bait[bt] = (wk.bait[bt] || 0) + w; const db = depB(r.cond && r.cond.depth); if (db) wk.dep[db] = (wk.dep[db] || 0) + w; }
        // σύγκριση ίδιας μέρας: οι ώρες φωτός εκείνης της μέρας, με βάρος ώστε κάθε ψάρι να μετράει όσο ένα
        const dd = (r.cond && Array.isArray(r.cond.d)) ? r.cond.d : [];
        if (dd.length >= 3) { const cb = {}; for (const f of dd) { const b2 = bins(f, f.t, r.lat, r.lon); for (const k in b2) if (k !== 'moon') (cb[k] = cb[k] || arr(NB[k]))[b2[k]] += 1; }
          for (const k in cb) { const s = cb[k].reduce((a, b) => a + b, 0); if (s) cb[k].forEach((v, i) => { ctl[k][i] += w * v / s; }); } }
      }
      { const W = Object.keys(uT).reduce((a, u) => a + uT[u] * uf[u], 0); ctl.moon = arr(8).map(() => W / 8); }   // η σελήνη: κάθε φάση διαρκεί περίπου το ίδιο
      const data = { v: 3, f: {}, ins: [] }, cand = {};
      for (const f of Object.keys(NB)) { if (EX.has(f)) continue;
        const C = c[f].reduce((a, b) => a + b, 0), CT = ctl[f].reduce((a, b) => a + b, 0), E = eff[f].reduce((a, b) => a + b, 0), FS = fish[f].reduce((a, b) => a + b, 0), base = E > 0 ? FS / E : 0;
        const cc = !DAYLEVEL.has(f) && CT >= 5 ? c[f].map((v, i) => { const sh = ctl[f][i] / CT; return sh >= 0.03 && C ? Math.round((v / C) / sh * 100) / 100 : null; }) : null;
        const r = E >= 10 && FS >= 3 ? eff[f].map((e, i) => e >= 4 ? Math.round(fish[f][i] / e * 100) / 100 : null) : null;
        if (!C && !E) continue;
        data.f[f] = { c: c[f], e: eff[f].map(x => Math.round(x)), r, cc };
        // συνδυασμένο «πόσο πιο συχνά» ανά κουτάκι (για τον δανεισμό είδος ← ομάδα)
        data.f[f].l = c[f].map((v, i) => { const a = cc && cc[i] != null ? cc[i] : null, b = r && base > 0 && r[i] != null && eff[f][i] >= 4 ? r[i] / base : null; return a != null && b != null ? Math.sqrt(Math.max(0.01, a) * Math.max(0.01, b)) : a != null ? a : b; });
        if (cc) cc.forEach((l, i) => { if (l != null && c[f][i] >= minCase && (l >= 1.3 || l <= 0.7)) cand[f + ':' + i] = { f, b: i, lift: l, n: c[f][i], src: 'cc' }; });
        if (r && FS >= 5 && base > 0) eff[f].forEach((e, i) => { if (e >= 8 && fish[f] && fish[f][i] >= 5) { const l = fish[f][i] / e / base; if (l >= 1.25 || l <= 0.75) { const k = f + ':' + i, o = cand[k];
          if (o && (o.lift >= 1) === (l >= 1)) { o.lift = Math.sqrt(o.lift * l); o.src = 'both'; o.h = Math.round(e); } else if (!o) cand[k] = { f, b: i, lift: l, n: fish[f][i], h: Math.round(e), src: 'trip' }; } } });
      }
      const top = o => Object.entries(o).filter(x => x[1] >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
      data.wk = worked;
      data.ins = Object.values(cand).map(x => { x.lift = Math.round(x.lift * 100) / 100; if (x.lift > 1) { const wk = worked[x.f + ':' + x.b]; if (wk) { const w2 = { tech: top(wk.tech), bait: top(wk.bait), dep: top(wk.dep), lure: top(wk.lure) }; if (w2.tech.length || w2.bait.length || w2.dep.length || w2.lure.length) x.w = w2; } } return x; })
        .sort((a, b) => (b.src === 'both') - (a.src === 'both') || Math.abs(Math.log(b.lift)) - Math.abs(Math.log(a.lift))).slice(0, 6);
      data.hrs = Math.round(eff.sun.reduce((a, b) => a + b, 0));
      data.sun = c.sun; data.moon = c.moon; data.pt = c.pt; data.wind = c.wind;   // συμβατότητα με την 1.14.21
      return { n, users: users.size, data };
    };
    // 1.14.26: «δανεισμός» είδος ← ομάδα: με λίγα στοιχεία το είδος παίρνει τα ευρήματα της ομάδας του· όσο μαζεύονται, μετράει το ίδιο (K = 30 τσιμπήματα)
    const blend = (A, P, minCase) => { const K = 30, d = A.data, pd = P && P.data; if (!pd || !pd.f) { delete d.wk; return A; } const cand = [], top = o => Object.entries(o || {}).filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
      for (const f of Object.keys(NB)) { const a = d.f[f], p = pd.f[f]; if (!a && !p) continue; const nb = NB[f];
        for (let i = 0; i < nb; i++) { const ns = a ? a.c[i] || 0 : 0, ls = a && a.l ? a.l[i] : null, lp = p && p.l ? p.l[i] : null; if (ls == null && lp == null) continue;
          const lg = ((ls != null ? ns * Math.log(Math.max(0.05, ls)) : 0) + (lp != null ? K * Math.log(Math.max(0.05, lp)) : 0)) / ((ls != null ? ns : 0) + (lp != null ? K : 0)), l = Math.exp(lg);
          if ((l >= 1.3 || l <= 0.7) && (ns >= minCase || (lp != null && p.c[i] >= 8))) { const x = { f, b: i, lift: Math.round(l * 100) / 100, n: Math.round(ns), src: ns >= 15 && ls != null && (ls >= 1) === (l >= 1) ? 'both' : 'blend' };
            if (l > 1) { const wk = d.wk && d.wk[f + ':' + i]; if (wk) { const w2 = { tech: top(wk.tech), bait: top(wk.bait), dep: top(wk.dep), lure: top(wk.lure) }; if (w2.tech.length || w2.bait.length || w2.dep.length || w2.lure.length) x.w = w2; } } cand.push(x); } } }
      d.ins = cand.sort((a, b) => b.n - a.n || Math.abs(Math.log(b.lift)) - Math.abs(Math.log(a.lift))).slice(0, 6); d.blend = true; delete d.wk; return A; };
    // 1.14.25: έλεγχος ότι η μάθηση βοηθάει. Οι έξοδοι χωρίζονται σε 4 ομάδες ανά μέρα· για κάθε ομάδα τα ευρήματα βγαίνουν ΧΩΡΙΣ αυτήν
    // και ελέγχεται αν ο δείκτης με τη διόρθωση ξεχωρίζει καλύτερα τις εξόδους με ψάρια (ψάρια ανά ώρα) από τον απλό δείκτη (AUC).
    // Αν δεν βοηθά, η διόρθωση απενεργοποιείται (learnOff). Χρειάζονται ≥ 8 έξοδοι με διαφορετικό αποτέλεσμα.
    const fcHour = (f, la, lo, prof) => { const tz = tzOf(lo), hr = Math.floor(((f.t + tz * 60000) % DAY) / HR);
      return { hr, chl: f.chl, thd: f.thd, wind: f.wind, gust: f.gust, wave: f.wave, pres: f.press, rain: f.rain, mm: f.rain, clp: f.cloud, mal: PF.moonAlt(f.t, +la, +lo), temp: f.temp, sst: f.sst, prof: prof || 'boat', t: new Date(f.t + tz * 60000).toISOString().slice(0, 16),
        ptrend: f.pt == null ? 'stable' : f.pt <= -3 ? 'fast' : f.pt <= -1 ? 'slow' : f.pt >= 1 ? 'rise' : 'stable',
        tide: f.tide == null ? null : f.tide > 0.01 ? 'up' : f.tide < -0.01 ? 'down' : 'slack', cloud: f.cloud == null ? 'part' : f.cloud < 20 ? 'clear' : f.cloud < 70 ? 'part' : 'over' }; };
    // 1.14.28: ο δείκτης «ξαναζυγίζεται» από τα στοιχεία (Poisson με ridge): κάθε ώρα εξόδου → πόσα τσιμπήματα είχε, ανά συνθήκη.
    // Ενεργοποιείται μόνο με ≥ 200 εξόδους ΚΑΙ αν στον έλεγχο (4 ομάδες ανά μέρα) ξεχωρίζει καλύτερα τις καλές εξόδους από τον σημερινό δείκτη.
    const FIT_MIN = 200;
    const fitPoisson = (catches, trips, ex) => {
      const EXs = new Set(ex || []), feats = Object.keys(NB).filter(k => !EXs.has(k)), idx = {}; let D = 0; for (const k of feats) { idx[k] = D; D += NB[k]; }
      const byU = {}; for (const r of catches) (byU[r.user_id] = byU[r.user_id] || []).push(r);
      const X = [], Y = []; for (const t of trips) for (const f of t.cond.e) { const bb = bins(f, f.t, t.lat, t.lon), row = []; for (const k in bb) if (idx[k] != null) row.push(idx[k] + bb[k]);
        const y = (byU[t.user_id] || []).filter(r => +r.ms >= f.t - HR / 2 && +r.ms < f.t + HR / 2).reduce((a, r) => a + 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1))), 0); X.push(row); Y.push(y); }
      if (X.length < 50) return null; const N = X.length, w = new Float64Array(D), cnt = new Float64Array(D); let b0 = Math.log(Math.max(0.01, Y.reduce((a, b) => a + b, 0) / N)); for (const row of X) for (const j of row) cnt[j]++;
      const alpha = 2; for (let it = 0; it < 400; it++) { const g = new Float64Array(D); let gb = 0; for (let i = 0; i < N; i++) { let z = b0; for (const j of X[i]) z += w[j]; const lam = Math.exp(Math.min(5, z)), e = lam - Y[i]; gb += e; for (const j of X[i]) g[j] += e; }
        b0 -= 0.5 * gb / N; for (let j = 0; j < D; j++) w[j] -= 0.5 * (g[j] + alpha * w[j]) / Math.max(1, cnt[j] + alpha); }
      const ins = []; for (const k of feats) for (let b = 0; b < NB[k]; b++) { const j = idx[k] + b, l = Math.exp(w[j]); if (cnt[j] >= 20 && (l >= 1.3 || l <= 0.77)) ins.push({ f: k, b, lift: Math.round(l * 100) / 100, n: Math.round(cnt[j]), src: 'fit' }); }
      return { ins: ins.sort((a, c) => Math.abs(Math.log(c.lift)) - Math.abs(Math.log(a.lift))).slice(0, 8), score: (f, t) => { const bb = bins(f, f.t, t.lat, t.lon); let z = b0; for (const k in bb) if (idx[k] != null) z += w[idx[k] + bb[k]]; return z; } };
    };
    // 1.14.29: «Πόσο έπεσε μέσα»: κάθε έξοδος με τον βαθμό τσιμπήματος που θα έδινε ο δείκτης στις ώρες της (με τον καιρό που έγινε) → ψάρια ανά ώρα ανά ζώνη βαθμού
    const ACC_B = [50, 60, 70];
    // 1.14.86 (P1.2): ΕΓΚΥΡΗ ΕΞΟΔΟΣ για τον έλεγχο του βαθμού. Ο κανόνας είναι ένας, στο score-core.js (AlkyonScore.session), ίδιος με την εφαρμογή:
    // μετράνε οι έξοδοι που υπάρχουν ανεξάρτητα από το αν πιάστηκαν ψάρια (ζωντανή καταγραφή, «Ψάρεψα, τίποτα», με το χέρι), 20′ έως 16 ώρες, με θέση.
    // Μένουν έξω οι «έξοδοι από τα ψάρια της ημέρας» (έχουν πάντα ψάρια) και οι άκυρες. Η μάθηση (analyse) ΔΕΝ αλλάζει: χρησιμοποιεί όλες τις εξόδους όπως πριν.
    const sesOf = t => { try { return PF.session ? PF.session(t) : { kind: 'live', valid: true }; } catch (e) { return { kind: 'live', valid: true }; } };
    const evalOK = t => sesOf(t).valid;
    const sesCount = trips => { const o = {}; for (const t of trips) { const k = sesOf(t).kind; o[k] = (o[k] || 0) + 1; } return o; };
    const accOf = (catches, trips, g) => {
      const T = trips.filter(t => t.ms2 > t.ms && t.cond && Array.isArray(t.cond.e) && t.cond.e.length && evalOK(t)); if (T.length < 5) return null;
      const prof = g === 'spear' ? 'spear' : g === 'lake' ? 'lake' : 'boat', n = [0, 0, 0, 0], hr = [0, 0, 0, 0], fi = [0, 0, 0, 0], hit = [0, 0, 0, 0];
      for (const t of T) { const { sm } = sunOf(t.ms, t.lat, t.lon); let s = 0, k = 0; for (const f of t.cond.e) { const w = fcHour(f, t.lat, t.lon, prof); s += PF.hourScore(sm, w.hr, Object.assign({}, w, { bite: true })); k++; } if (!k) continue;
        const sc = s / k, b = sc < ACC_B[0] ? 0 : sc < ACC_B[1] ? 1 : sc < ACC_B[2] ? 2 : 3, fishN = catches.filter(r => r.user_id === t.user_id && +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000).reduce((a, r) => a + Math.max(1, Math.min(64, r.cnt || 1)), 0);
        n[b]++; hr[b] += (t.ms2 - t.ms) / HR; fi[b] += fishN; if (fishN > 0 || t.cond.rt === 2) hit[b]++; }
      return { b: ACC_B, n, r: hr.map((h, i) => h >= 1 ? Math.round(fi[i] / h * 100) / 100 : null), hit: n.map((x, i) => x ? Math.round(hit[i] / x * 100) : null), trips: n.reduce((a, b) => a + b, 0) };
    };
    // vo = true: δοκιμάζεται ΜΟΝΟ στις έγκυρες εξόδους (TV)· τα ευρήματα κάθε ομάδας βγαίνουν όπως πάντα από όλες τις υπόλοιπες (T).
    // vo = false: ο έλεγχος όπως ήταν έως την 1.14.85 (από αυτόν εξαρτάται ακόμα το αν η μάθηση είναι ενεργή, ώστε να μην αλλάξει κανένας βαθμός).
    const backtest = (catches, trips, ex, g, vo) => {
      const T = trips.filter(t => t.ms2 > t.ms), TV = vo ? T.filter(evalOK) : T; if (TV.length < 8) return null;
      const fold = d => { let x = 0; for (const ch of String(d)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x % 4; };
      const prof = g === 'spear' ? 'spear' : g === 'lake' ? 'lake' : 'boat';
      const res = [];
      for (let k = 0; k < 4; k++) {
        const test = TV.filter(t => fold(t.day) === k); if (!test.length) continue;
        const L = analyse(catches.filter(r => fold(r.day) !== k), T.filter(t => fold(t.day) !== k), 8, ex).data;
        for (const t of test) { const fishN = catches.filter(r => r.user_id === t.user_id && +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000).reduce((a, r) => a + Math.max(1, r.cnt || 1), 0);
          let sb0 = 0, sb1 = 0, nh = 0; const { sm } = sunOf(t.ms, t.lat, t.lon);
          for (const f of t.cond.e) { const w = fcHour(f, t.lat, t.lon, prof), b0 = PF.hourScore(sm, w.hr, Object.assign({}, w, { bite: true }));
            const h1 = PF.learnAdj({ ins: L.ins || [] }, sm, Object.assign({}, w, { score: b0, bite: b0 })); sb0 += b0; sb1 += h1.bite; nh++; }
          if (nh) res.push({ y: fishN / Math.max(1, (t.ms2 - t.ms) / HR), rt: t.cond && t.cond.rt, b0: sb0 / nh, b1: sb1 / nh }); }
      }
      // 1.14.28: «Πώς ήταν το ψάρεμα;»: έξοδος χωρίς καταγεγραμμένα ψάρια αλλά «Καλό» (π.χ. δίχτυ) μετράει σαν τυπική έξοδος με ψάρια, «Μέτριο» λιγότερο
      { const pos = res.filter(x => x.y > 0).map(x => x.y).sort((a, b) => a - b), med = pos.length ? pos[Math.floor(pos.length / 2)] : 0.5; for (const x of res) if (!(x.y > 0) && (x.rt === 2 || x.rt === 1)) x.y = x.rt === 2 ? med : med / 3; }
      const auc = key => { let s2 = 0, p = 0; for (let i = 0; i < res.length; i++) for (let j = 0; j < res.length; j++) { if (res[i].y <= res[j].y) continue; p++; s2 += res[i][key] > res[j][key] ? 1 : res[i][key] === res[j][key] ? 0.5 : 0; } return p ? { a: Math.round(s2 / p * 100) / 100, p } : null; };
      const A = auc('b0'), B2 = auc('b1'); if (!A || A.p < 10) return null;
      const out = { n: res.length, base: A.a, adj: B2.a, on: B2.a >= A.a - 0.01 };
      if (T.length >= FIT_MIN) {
        // βαθμός κάθε εξόδου από το μοντέλο που μάθαμε χωρίς αυτήν
        const resF = []; for (let k = 0; k < 4; k++) { const test = TV.filter(t => fold(t.day) === k); if (!test.length) continue; const F = fitPoisson(catches.filter(r => fold(r.day) !== k), T.filter(t => fold(t.day) !== k), ex); if (!F) continue;
          for (const t of test) { const fishN = catches.filter(r => r.user_id === t.user_id && +r.ms >= +t.ms - 15 * 60000 && +r.ms <= +t.ms2 + 15 * 60000).reduce((a, r) => a + Math.max(1, r.cnt || 1), 0); let z = 0, nh = 0; for (const f of t.cond.e) { z += F.score(f, t); nh++; } if (nh) resF.push({ y: fishN / Math.max(1, (t.ms2 - t.ms) / HR), b2: z / nh }); } }
        let s2 = 0, p = 0; for (let i = 0; i < resF.length; i++) for (let j = 0; j < resF.length; j++) { if (resF[i].y <= resF[j].y) continue; p++; s2 += resF[i].b2 > resF[j].b2 ? 1 : resF[i].b2 === resF[j].b2 ? 0.5 : 0; }
        if (p) { out.fit = Math.round(s2 / p * 100) / 100; out.fitOn = out.fit >= Math.max(out.base, out.adj) + 0.02; } }
      return out;
    };
    try {
      const cyH = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2);
      const cur = ((await sb('bite_stats?key=eq.all&select=updated_at')) || [])[0];
      if (cyH >= 3 && (!cur || Date.now() - Date.parse(cur.updated_at) > 20 * HR)) {
        const rows = [];
        for (let off = 0; off < 50000; off += 1000) { const a = (await sb(`catch_obs?select=user_id,kind,sp,day,ms,ms2,lat,lon,cnt,tech,prof,cond&order=id.asc&limit=1000&offset=${off}`)) || []; rows.push(...a); if (a.length < 1000) break; }
        // 1.14.24: χωριστά ανά είδος ψαρέματος: θάλασσα με καλάμι (σκάφος/ακτή), ψαροντούφεκο, λίμνη/φράγμα
        // 1.14.26: κεφαλόποδα (καλαμάρι, θράψαλο, σουπιά, σουπιοκαλάμαρο, χταπόδι…) χωριστή ομάδα· έξοδοι με στόχο κεφαλόποδο το ίδιο
        const CEPH = new Set(['loligo vulgaris', 'loligo forbesii', 'alloteuthis media', 'alloteuthis subulata', 'todarodes sagittatus', 'illex coindetii', 'ommastrephes bartramii', 'sepia officinalis', 'sepia elegans', 'sepia orbignyana', 'sepioteuthis lessoniana', 'octopus vulgaris', 'eledone cirrhosa', 'eledone moschata']);
        const grpOf = r => (r.sp && CEPH.has(r.sp)) ? 'ceph' : r.prof === 'spear' ? 'spear' : r.prof === 'lake' ? 'lake' : 'sea';
        const EXG = { sea: [], spear: [], ceph: [], lake: ['wave', 'tide', 'cur', 'sstd', 'wv48', 'chl', 'thc'] };
        // 1.14.25: μικρά ψάρια που πιάνονται κοπαδιαστά (γόπα, μαρίδα, σαρδέλα, γαύρος, σαυρίδι, κολιός…) ή < 20 cm: χωριστά από τα μεγάλα
        const SMALL = new Set(['boops boops', 'spicara smaris', 'spicara maena', 'spicara flexuosa', 'sardina pilchardus', 'sardinella aurita', 'engraulis encrasicolus', 'trachurus trachurus', 'trachurus mediterraneus', 'trachurus picturatus', 'scomber colias', 'scomber japonicus', 'scomber scombrus', 'atherina hepsetus', 'atherina boyeri', 'diplodus annularis', 'chromis chromis', 'coris julis', 'thalassoma pavo', 'serranus scriba', 'serranus cabrilla', 'serranus hepatus', 'pagellus acarne', 'oblada melanura', 'sarpa salpa', 'mullus barbatus', 'mullus surmuletus', 'gobius niger', 'symphodus tinca']);
        const isSmall = r => (r.sp && SMALL.has(r.sp)) || (r.cond && typeof r.cond.len === 'number' && r.cond.len > 0 && r.cond.len < 20);
        // 1.14.30: έλεγχος ποιότητας: εκτός από μελλοντικές ώρες/αδύνατες θέσεις, διπλές καταγραφές (ίδιος, ίδιο είδος, ±2′), > 60 εγγραφές ψαριού τη μέρα από έναν, έξοδοι < 10′ ή > 24 ώρες
        const QC = { fut: 0, pos: 0, dup: 0, flood: 0, trip: 0, cnt: 0 }, seenQ = new Map(), perDay = {};
        const okRow = r => { if (r.ms != null && +r.ms > Date.now() + HR) { QC.fut++; return false; } if (r.lat != null && (Math.abs(+r.lat) > 90 || Math.abs(+r.lon) > 180 || (+r.lat === 0 && +r.lon === 0))) { QC.pos++; return false; }
          if (r.kind === 'trip') { if (r.ms2 != null && r.ms != null && (+r.ms2 - +r.ms < 10 * 60000 || +r.ms2 - +r.ms > 24 * HR)) { QC.trip++; return false; } return true; }
          if (r.kind !== 'catch') return true; if ((r.cnt || 1) > 200) { r.cnt = 200; QC.cnt++; }
          const pd = r.user_id + '|' + r.day; perDay[pd] = (perDay[pd] || 0) + 1; if (perDay[pd] > 60) { QC.flood++; return false; }
          const k = r.user_id + '|' + (r.sp || '') + '|' + (r.cnt || 1), prev = seenQ.get(k); if (prev && prev.some(t => Math.abs(t - +r.ms) < 120000)) { QC.dup++; return false; } (prev || seenQ.set(k, []).get(k)).push(+r.ms); return true; };
        rows.sort((a, b) => (+a.ms || 0) - (+b.ms || 0)); const rowsQ = rows.filter(okRow);
        if (Object.values(QC).some(x => x)) log('bite stats: qc ' + JSON.stringify(QC));
        const catchesAll = rowsQ.filter(r => r.kind === 'catch' && r.ms != null && r.lat != null);
        const tripsAll = rowsQ.filter(r => r.kind === 'trip' && r.cond && Array.isArray(r.cond.e) && r.cond.e.length);
        const cell = r => (Math.floor(+r.lat / 2) * 2) + '_' + (Math.floor(+r.lon / 2) * 2);
        const now = new Date().toISOString(), out = [];
        // 1.14.29: ημερολόγιο εποχής: τσιμπήματα ανά μήνα (βάρος 1+log2 πλήθους, ώρα Κύπρου ≈ UTC μήνας)
        const monOf = cs => { const m = new Array(12).fill(0); for (const r of cs) { const mo = new Date(+r.ms).getUTCMonth(); m[mo] += 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1))); } return m.map(v => Math.round(v * 10) / 10); };
        const put = (k, a, g) => { a.data.grp = g; out.push({ key: k, n: a.n, users: a.users, data: a.data, updated_at: now }); };
        for (const g of ['sea', 'spear', 'lake', 'ceph']) {
          const catches = catchesAll.filter(r => grpOf(r) === g), trips = tripsAll.filter(t => grpOf(t) === g), ex = EXG[g];
          if (g !== 'sea' && !catches.length) continue;
          const pre = g === 'sea' ? '' : 'g:' + g + '|';   // θάλασσα: 'all', 'sp:…', 'r:…' (όπως πριν) · αλλιώς 'g:spear', 'g:spear|sp:…'
          const A0 = analyse(catches, trips, 8, ex); const A0wk = A0.data.wk; delete A0.data.wk; try { const bt = backtest(catches, trips, ex, g); A0.data.trips = trips.length; A0.data.ses = sesCount(trips); try { const bv = backtest(catches, trips, ex, g, true); if (bv) A0.data.btv = { n: bv.n, base: bv.base, adj: bv.adj }; } catch (e) { } A0.data.fitMin = FIT_MIN; A0.data.acc = accOf(catches, trips, g); if (g === 'sea') A0.data.qc = QC; if (bt) { A0.data.bt = bt; if (bt.fitOn) { const F = fitPoisson(catches, trips, ex); if (F && F.ins.length) { A0.data.ins = F.ins; A0.data.fitted = true; } } else if (!bt.on) A0.data.learnOff = true; } } catch (e) { log('bite stats: backtest ' + e.message); }
          A0.data.mon = monOf(catches); put(g === 'sea' ? 'all' : 'g:' + g, A0, g);
          if (g !== 'ceph') for (const [sz, cs] of [['big', catches.filter(r => !isSmall(r))], ['small', catches.filter(isSmall)]]) if (cs.length >= 10 && cs.length < catches.length) { const a = analyse(cs, trips, 6, ex); a.data.size = sz; delete a.data.wk; put(pre + sz, a, g); }
          const bySp = {}; for (const r of catches) if (r.sp) (bySp[r.sp] = bySp[r.sp] || []).push(r);
          for (const [sp, cs] of Object.entries(bySp)) { if (cs.length < 5) continue; const tg = trips.filter(t => t.sp === sp || (Array.isArray(t.cond.tg) && t.cond.tg.includes(sp))) /* 1.14.78: όλοι οι στόχοι της εξόδου */, hrs = tg.reduce((a, t) => a + t.cond.e.length, 0);
            const a = blend(analyse(cs, hrs >= 10 ? tg : trips, 5, ex), A0, 5); a.data.tgt = hrs >= 10; a.data.mon = monOf(cs); put(pre + 'sp:' + sp, a, g); }
          const byR = {}; for (const r of catches) (byR[cell(r)] = byR[cell(r)] || []).push(r);
          if (Object.keys(byR).length > 1) for (const [rc, cs] of Object.entries(byR)) { if (cs.length < 30) continue; put(pre + 'r:' + rc, blend(analyse(cs, trips.filter(t => cell(t) === rc), 8, ex), A0, 8), g); }
        }
        // 1.14.28: «Τι πιάνεται τώρα»: ανά κελί 1°, τσιμπήματα της τελευταίας εβδομάδας σε σχέση με τον μέσο όρο των 4 προηγούμενων· μόνο από ≥ 3 ψαράδες
        const trendNew = [];
        try {
          const todayD = isoD(Date.now()), dAgo = n => isoD(Date.now() - n * DAY), c1 = r => Math.floor(+r.lat) + '_' + Math.floor(+r.lon), TR = {};
          for (const r of catchesAll) { if (!r.day || r.day < dAgo(35)) continue; const k = c1(r) + '|' + (r.sp || (r.cond && r.cond.nm) || '?'), o = TR[k] = TR[k] || { cell: c1(r), sp: r.sp, nm: {}, g: grpOf(r), n7: 0, p: 0, u7: new Set(), u: new Set() };
            const v = 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1))), nm = r.cond && r.cond.nm; if (nm) o.nm[nm] = (o.nm[nm] || 0) + 1; o.u.add(r.user_id); if (r.day >= dAgo(7)) { o.n7 += v; o.u7.add(r.user_id); } else o.p += v / 4; }
          // 1.14.29: «Τι δουλεύει τώρα»: τεχνική / δόλωμα / τεχνητό (χρώμα, γραμμάρια) των τελευταίων 7 ημερών ανά κελί· μόνο τιμές από ≥ 2 ψαράδες, σε κελί με ≥ 3
          const WK = {}; for (const r of catchesAll) { if (!r.day || r.day < dAgo(7)) continue; const o = WK[c1(r)] = WK[c1(r)] || { u: new Set(), tech: {}, bait: {}, lure: {} }; o.u.add(r.user_id);
            const add = (m, v) => { if (!v) return; v = String(v).trim(); if (!v) return; const x = m[v.toLowerCase()] = m[v.toLowerCase()] || { v, u: new Set(), n: 0 }; x.u.add(r.user_id); x.n += 1 + Math.log2(Math.max(1, Math.min(64, r.cnt || 1))); };
            add(o.tech, r.tech); add(o.bait, r.cond && r.cond.bait); const lc = r.cond && r.cond.lc, lw = r.cond && r.cond.lw; if (lc || lw != null) add(o.lure, [lc, lw != null ? lw + 'g' : ''].filter(Boolean).join(' ')); }
          const works = {}; for (const [cl, o] of Object.entries(WK)) { if (o.u.size < 3) continue; const top = m => Object.values(m).filter(x => x.u.size >= 2).sort((a, b) => b.n - a.n).slice(0, 3).map(x => ({ v: x.v, n: Math.round(x.n), u: x.u.size }));
            const w = { tech: top(o.tech), bait: top(o.bait), lure: top(o.lure), users: o.u.size }; if (w.tech.length || w.bait.length || w.lure.length) works[cl] = w; }
          const byCell = {};
          for (const o of Object.values(TR)) { if (o.u7.size < 3 || o.n7 < 5) continue; const ratio = (o.n7 + 1) / (o.p + 1), nm = Object.entries(o.nm).sort((a, b) => b[1] - a[1])[0];
            const it = { sp: o.sp, nm: nm ? nm[0] : o.sp, g: o.g, n7: Math.round(o.n7), prev: Math.round(o.p * 10) / 10, ratio: Math.round(ratio * 10) / 10, users: o.u7.size, up: ratio >= 2, fresh: o.p < 0.5 };
            (byCell[o.cell] = byCell[o.cell] || []).push(it); if (it.up) trendNew.push(Object.assign({ cell: o.cell }, it)); }
          for (const cl of Object.keys(works)) byCell[cl] = byCell[cl] || [];
          for (const [cl, items] of Object.entries(byCell)) out.push({ key: 'trend:' + cl, n: items.reduce((a, x) => a + x.n7, 0), users: Math.max(works[cl] ? works[cl].users : 0, ...items.map(x => x.users)), data: { items: items.sort((a, b) => b.n7 - a.n7).slice(0, 8), works: works[cl] || null, day: todayD }, updated_at: now });
        } catch (e) { log('bite stats: trend ' + e.message); }
        if (out.length) await sb('bite_stats?on_conflict=key', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(out) });
        // προσωπικά (μόνο ο ίδιος τα διαβάζει): data = το είδος ψαρέματος που κάνει πιο συχνά, data.by = όλα όσα έχουν ≥ 10 ψάρια
        const byU = {}; for (const r of catchesAll) (byU[r.user_id] = byU[r.user_id] || []).push(r);
        const pers = [];
        for (const [u, cs0] of Object.entries(byU)) {
          const by = {}; let main = null, mainN = 0, tot = 0;
          for (const g of ['sea', 'spear', 'lake', 'ceph']) { const cs = cs0.filter(r => grpOf(r) === g), n = cs.reduce((a, r) => a + Math.max(1, Math.min(20, r.cnt || 1)), 0); tot += n; if (n < 10) continue;
            const a = analyse(cs, tripsAll.filter(t => t.user_id === u && grpOf(t) === g), 4, EXG[g]); const sp = {}; cs.forEach(r => { if (r.sp) sp[r.sp] = (sp[r.sp] || 0) + 1; });
            a.data.top = Object.entries(sp).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]); a.data.grp = g; try { a.data.acc = accOf(cs, tripsAll.filter(t => t.user_id === u && grpOf(t) === g), g); } catch (e) { } delete a.data.wk; by[g] = { n: a.n, data: a.data }; if (n > mainN) { mainN = n; main = g; } }
          if (!main) continue;
          const data = Object.assign({}, by[main].data, { by });
          // «Η παρέα μου»: εσύ + όσοι φίλοι μοιράζονται τα ψάρια τους μαζί σου (και συμμετέχουν)
          try { const fr = new Set(((await sb(`friends?viewer=eq.${encodeURIComponent(u)}&select=owner,share`)) || []).filter(x => x.share !== false).map(x => x.owner)); fr.delete(u);
            const crewC = catchesAll.filter(r => grpOf(r) === main && (r.user_id === u || fr.has(r.user_id))), cu = new Set(crewC.map(r => r.user_id));
            if (cu.size >= 2 && crewC.length >= 20) { const a = analyse(crewC, tripsAll.filter(t => grpOf(t) === main && (t.user_id === u || fr.has(t.user_id))), 5, EXG[main]); delete a.data.wk; data.crew = { n: a.n, users: cu.size, data: a.data }; } } catch (e) { }
          pers.push({ user_id: u, n: tot, data, updated_at: now }); }
        if (pers.length) await sb('user_bite_stats?on_conflict=user_id', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(pers) }).catch(e => log('bite stats: user ' + e.message));
        const rows_ = rows;
        stats.bstats = out.length; stats.bobs = rows_.length; stats.bpers = pers.length;
      }
    } catch (e) { log('bite stats: ' + e.message); }

    // (δ) 1.14.28: «Ανεβαίνουν/Εμφανίστηκαν … κοντά σου» (09:00–20:00 Κύπρου, μία φορά την εβδομάδα το πολύ)
        // ειδοποίηση «ανεβαίνουν…» σε όσους έχουν σημείο σε αυτό το κελί (μία φορά την εβδομάδα το πολύ)
    try { const cyH2 = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2);
      const trendNew = []; if (webpush && cyH2 >= 9 && cyH2 < 20) for (const x of ((await sb('bite_stats?key=like.trend:*&select=key,data').catch(() => [])) || [])) if (x.data && x.data.day >= isoD(Date.now() - 2 * DAY)) for (const it of ((x.data && x.data.items) || [])) if (it.up) trendNew.push(Object.assign({ cell: x.key.slice(6) }, it));
        if (webpush && trendNew.length) try {
          const subsT = (await sb('push_subs?select=id,user_id,sub,places').catch(() => [])) || [], wk = isoD(Date.now() - (new Date().getUTCDay() * DAY));
          const byUser = {}; for (const r of subsT) (byUser[r.user_id] = byUser[r.user_id] || []).push(r);
          for (const [u, subs] of Object.entries(byUser)) {
            const cells = new Set(); subs.forEach(r => (r.places || []).forEach(p => { if (p && typeof p.lat === 'number' && typeof p.lon === 'number' && p.trend !== false) cells.add(Math.floor(p.lat) + '_' + Math.floor(p.lon)); }));
            const hit = trendNew.filter(x => cells.has(x.cell)).sort((a, b) => b.ratio - a.ratio)[0]; if (!hit) continue;
            const recent = (await sb(`notif_log?user_id=eq.${encodeURIComponent(u)}&kind=eq.trend&at=gt.${encodeURIComponent(new Date(Date.now() - 6 * DAY).toISOString())}&select=id`)) || []; if (recent.length) continue;
            const nid = 'trend:' + u + ':' + hit.cell + ':' + (hit.sp || hit.nm) + ':' + wk, ceph = hit.g === 'ceph';
            const msg = { id: nid, kind: 'trend', tag: 'trend-' + hit.cell, url: '#log', title: (ceph ? '🦑 ' : '🎣 ') + (hit.fresh ? 'Εμφανίστηκαν: ' : 'Ανεβαίνουν: ') + hit.nm + ' κοντά σου', body: hit.n7 + ' τσιμπήματα την τελευταία εβδομάδα από ' + hit.users + ' ψαράδες' + (hit.fresh ? '' : ' (×' + String(hit.ratio).replace('.', ',') + ' από πριν)') + '. · ' + (hit.fresh ? 'Showing up' : 'On the rise') + ' near you.' };
            for (const r of subs) { try { await webpush.sendNotification(r.sub, JSON.stringify(msg), { TTL: 24 * 3600 }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {}); } }
            await sb('notif_log', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: nid, user_id: u, kind: 'trend', title: msg.title, body: msg.body, at: new Date().toISOString() }) }).catch(() => {});
            stats.trend = (stats.trend || 0) + 1; }
        } catch (e) { log('bite stats: trend push ' + e.message); }
    } catch (e) { log('bite stats: trend push ' + e.message); }
    // (γ) «🎯 Αύριο … μοιάζει με τις καλύτερες ώρες σου»
    try {
      const cyH = +new Date().toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', hour12: false }).slice(0, 2);
      if (webpush && cyH >= 17 && cyH < 19) {
        const tom = isoD(Date.now() + DAY), us = (await sb('user_bite_stats?select=user_id,n,data').catch(() => [])) || [];
        const LBL = { sun: ['νύχτα', 'αυγή', 'πρωί', 'μεσημέρι', 'απόγευμα', 'σούρουπο'], pt: ['πίεση πέφτει', 'πίεση σταθερή', 'πίεση ανεβαίνει'], sol: ['κύρια σεληνιακή περίοδος', 'δευτερεύουσα περίοδος', 'εκτός περιόδων'],
          pl: ['πίεση <1010', 'πίεση 1010–15', 'πίεση 1015–20', 'πίεση >1020'], wind: ['άνεμος 0–4 kn', 'άνεμος 5–9 kn', 'άνεμος 10–14 kn', 'άνεμος 15+ kn'], wave: ['κύμα <0,3 m', 'κύμα 0,3–0,6 m', 'κύμα 0,6–1 m', 'κύμα >1 m'],
          tide: ['στάθμη ανεβαίνει', 'στάθμη κατεβαίνει', 'στάθμη στάσιμη'], cloud: ['καθαρός ουρανός', 'λίγα σύννεφα', 'συννεφιά'], rain: ['χωρίς βροχή', 'βροχή'], cur: ['ρεύμα ασθενές', 'ρεύμα μέτριο', 'ρεύμα δυνατό'] };
        for (const u of us) {
          const good = ((u.data && u.data.ins) || []).filter(x => x.lift >= 1.3 && x.f !== 'moon'); if (good.length < 2) continue;
          const nid = 'best:' + u.user_id + ':' + tom; if (((await sb(`notif_log?id=eq.${encodeURIComponent(nid)}&select=id`)) || []).length) continue;
          const subs = (await sb(`push_subs?user_id=eq.${encodeURIComponent(u.user_id)}&select=id,sub,places`)) || []; if (!subs.length) continue;
          const pl = (subs.map(s => (s.places || []).find(p => p && typeof p.lat === 'number' && typeof p.lon === 'number')).find(Boolean)); if (!pl) continue;
          const la = Math.round(pl.lat * 10) / 10, lo = Math.round(pl.lon * 10) / 10, H = await wxFor(la, lo, isoD(Date.now() - DAY), isoD(Date.now() + 2 * DAY)); if (!H) continue;
          const hrs = dayHours(Date.parse(tom + 'T12:00:00Z') - tzOf(lo) * 60000, la, lo).filter(t => t > Date.now());
          const sc = hrs.map(t => { const f = feat(H, t); if (!f) return { t, s: 0, m: [] }; const bb = bins(f, t, la, lo), m = good.filter(x => bb[x.f] === x.b); return { t, s: m.reduce((a, x) => a + Math.log(x.lift), 0), m }; });
          let best = null; for (let i = 0; i < sc.length; i++) { if (sc[i].m.length < 2) continue; let j = i; while (j + 1 < sc.length && sc[j + 1].m.length >= 2 && j - i < 3) j++; const s = sc.slice(i, j + 1).reduce((a, x) => a + x.s, 0); if (!best || s > best.s) best = { i, j, s }; }
          if (!best) continue;
          const tz = new Date(sc[best.i].t).toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', minute: '2-digit', hour12: false });
          const tz2 = new Date(sc[best.j].t + HR).toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour: '2-digit', minute: '2-digit', hour12: false });
          const why = [...new Set(sc[best.i].m.map(x => LBL[x.f] && LBL[x.f][x.b]).filter(Boolean))].slice(0, 3).join(' · ');
          // 1.14.30: «Το σχέδιο για αύριο»: και τι να δοκιμάσεις: ό,τι δούλεψε σε αυτές τις συνθήκες (προσωπικά ευρήματα), αλλιώς «τι δουλεύει τώρα» στην περιοχή
          let tryW = ''; { const ws = sc[best.i].m.map(x => x.w).filter(Boolean)[0]; const pick = w => w && [].concat(w.lure || [], w.tech || [], w.bait || []).slice(0, 2).join(', ');
            tryW = pick(ws) || ''; if (!tryW) { try { const tw = ((await sb(`bite_stats?key=eq.${encodeURIComponent('trend:' + Math.floor(pl.lat) + '_' + Math.floor(pl.lon))}&select=data`)) || [])[0]; const w = tw && tw.data && tw.data.day >= isoD(Date.now() - 3 * DAY) && tw.data.works; if (w) tryW = [].concat((w.lure || []).map(x => x.v), (w.tech || []).map(x => x.v), (w.bait || []).map(x => x.v)).slice(0, 2).join(', '); } catch (e) { } } }
          const msg = { id: nid, kind: 'best', tag: 'best-' + tom, url: '#forecast', title: '🎯 Το σχέδιο για αύριο: ' + tz + '–' + tz2 + ' · Plan for tomorrow',
            body: 'Μοιάζει με τις ώρες που πιάνεις τα περισσότερα ψάρια: ' + why + (pl.name ? ' (' + String(pl.name).slice(0, 30) + ')' : '') + '.' + (tryW ? ' Δοκίμασε: ' + tryW + '.' : '') + ' Τα σημεία σου για αυτόν τον άνεμο στην πρόγνωση. · Matches the conditions you catch most in.' };
          for (const r of subs) { try { await webpush.sendNotification(r.sub, JSON.stringify(msg), { TTL: 12 * 3600 }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {}); } }
          await sb('notif_log', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: nid, user_id: u.user_id, kind: 'best', title: msg.title, body: msg.body, at: new Date().toISOString() }) }).catch(() => {});
          stats.best = (stats.best || 0) + 1;
        }
      }
    } catch (e) { log('bite stats: best ' + e.message); }
    // (ε) 1.14.30: Κυριακή 18:00–20:00 Κύπρου: «📅 Η εβδομάδα σου»: ψάρια/έξοδοι της εβδομάδας (αν συμμετέχεις), πόσο έπεσε μέσα ο δείκτης, η καλύτερη μέρα της επόμενης εβδομάδας
    try {
      const nowCy = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' })), cyH3 = nowCy.getHours();
      if (webpush && nowCy.getDay() === 0 && cyH3 >= 18 && cyH3 < 20) {
        const subsW = (await sb('push_subs?select=id,user_id,sub,places').catch(() => [])) || [], byUw = {}; for (const r of subsW) (byUw[r.user_id] = byUw[r.user_id] || []).push(r);
        const DNW = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'], todayW = isoD(Date.now()); let sent = 0;
        for (const [u, subs] of Object.entries(byUw)) {
          if (sent >= 40) break;
          const nid = 'week:' + u + ':' + todayW; if (((await sb(`notif_log?id=eq.${encodeURIComponent(nid)}&select=id`)) || []).length) continue;
          const pl = subs.map(x => (x.places || []).find(p => p && typeof p.lat === 'number' && typeof p.lon === 'number')).find(Boolean); if (!pl) continue;
          const mine = (await sb(`catch_obs?user_id=eq.${encodeURIComponent(u)}&day=gte.${isoD(Date.now() - 7 * DAY)}&select=kind,cnt`).catch(() => [])) || [];
          const fish = mine.filter(x => x.kind === 'catch').reduce((a, x) => a + Math.max(1, Math.min(200, x.cnt || 1)), 0), trips = mine.filter(x => x.kind === 'trip').length;
          let bestD = null; try { const fc = await PF.getForecast(+pl.lat, +pl.lon, F, { days: 7, learn: false }); for (const d of fc.days) { if (d.date <= todayW || !d.safe || !d.win) continue; if (!bestD || d.best > bestD.best) bestD = d; } } catch (e) { }
          let acc = ''; try { const us = ((await sb(`user_bite_stats?user_id=eq.${encodeURIComponent(u)}&select=data`)) || [])[0], a = us && us.data && us.data.acc; if (a && a.r) { const ok = a.r.map((x, i) => [x, i]).filter(x => x[0] != null && a.n[x[1]] >= 2); if (ok.length >= 2 && ok[0][0] > 0) { const k = ok[ok.length - 1][0] / ok[0][0]; if (k >= 1.2) acc = ' Στις ώρες με ψηλό δείκτη έπιασες ×' + String(Math.round(k * 10) / 10).replace('.', ',') + ' περισσότερα.'; } } } catch (e) { }
          if (!bestD && !fish && !trips) continue;
          const pad2 = n => String(n).padStart(2, '0'), dn = bestD ? DNW[new Date(bestD.date + 'T12:00:00Z').getUTCDay()] : '';
          const msg = { id: nid, kind: 'week', tag: 'week', url: '#forecast', title: '📅 Η εβδομάδα σου · Your week',
            body: (fish || trips ? 'Αυτή την εβδομάδα: ' + fish + ' ψάρια' + (trips ? ' σε ' + trips + (trips === 1 ? ' έξοδο' : ' εξόδους') : '') + '.' : 'Καμία καταγραφή αυτή την εβδομάδα.') + acc + (bestD ? ' Καλύτερη μέρα: ' + dn + ' ' + pad2(bestD.win.s) + ':00–' + pad2((bestD.win.e + 1) % 24) + ':00 (δείκτης ' + bestD.best + ')' + (pl.name ? ', ' + String(pl.name).slice(0, 30) : '') + '.' : '') + ' · Weekly summary.' };
          for (const r of subs) { try { await webpush.sendNotification(r.sub, JSON.stringify(msg), { TTL: 12 * 3600 }); } catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb(`push_subs?id=eq.${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {}); } }
          await sb('notif_log', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: nid, user_id: u, kind: 'week', title: msg.title, body: msg.body, at: new Date().toISOString() }) }).catch(() => {});
          sent++; stats.week = (stats.week || 0) + 1; }
      }
    } catch (e) { log('bite stats: week ' + e.message); }
  }
  log('Safety job: ' + JSON.stringify(stats));
  // 9) 1.9.50: υγεία του server. Σε κάθε εκτέλεση γράφεται «heartbeat» (backups/_system/heartbeat.json, το διαβάζει το watchdog του GitHub).
  //    Αν ένα βήμα αποτύχει σε 2 συνεχόμενες εκτελέσεις (όχι ένα στιγμιαίο σφάλμα δικτύου), μήνυμα Telegram στους διαχειριστές, το πολύ μία φορά ανά 6 ώρες ανά βήμα.
  if (!only) {
    try {
      const HB = URL_ + '/storage/v1/object/backups/_system/heartbeat.json', AH = { apikey: KEY, Authorization: 'Bearer ' + KEY };
      const st0 = await F(HB, { headers: AH }).then(r => r.ok ? r.json() : {}).catch(() => ({})) || {};
      const now = Date.now(), byK = {}, fails = {}, alerted = { ...(st0.alerted || {}) };
      for (const e of ERRS) (byK[e.k] = byK[e.k] || []).push(e.m);
      for (const k of Object.keys(byK)) fails[k] = ((st0.fails || {})[k] || 0) + 1;
      const due = Object.keys(byK).filter(k => fails[k] >= 2 && !(alerted[k] && now - alerted[k] < 6 * 3600000));
      if (due.length && TG) {
        const chats = await adminChats();
        const text = '⚠ Alkyon server: σφάλμα σε ' + due.length + (due.length === 1 ? ' βήμα' : ' βήματα') + ' (2 συνεχόμενες εκτελέσεις)\n' + due.map(k => '• ' + byK[k][0]).join('\n');
        let ok = 0; for (const c of chats) { try { await tg('sendMessage', { chat_id: c, text }); ok++; } catch (_) { /* τίποτα */ } }
        if (ok) { for (const k of due) alerted[k] = now; stats.health = due.length; }
      }
      for (const k of Object.keys(alerted)) if (now - alerted[k] > 86400000) delete alerted[k];
      await F(HB, { method: 'POST', headers: { ...AH, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: JSON.stringify({ at: new Date(now).toISOString(), fails, alerted, stats }) });
    } catch (e) { log0('health: ' + e.message); }
  }
  return { ok: true, stats };
}

// ---- handler ----
let vapidSet = false;
/* 1.12.4: ειδοποιήσεις στην εφαρμογή Android μέσω Firebase Cloud Messaging (HTTP v1).
   Η εφαρμογή γράφει στο push_subs συνδρομή {endpoint:'fcm:…', fcm:'<token>'}. Το pushx() έχει την ίδια διεπαφή με το web-push
   (sendNotification(sub, payload, {TTL})): συνδρομή με «fcm» → Firebase, αλλιώς web-push. Ένα token που δεν ισχύει πια (UNREGISTERED)
   γυρίζει statusCode 410, ώστε ο υπάρχων κώδικας να σβήνει τη συνδρομή όπως κάνει με τις web-push.
   Secret: FCM_SERVICE_ACCOUNT = όλο το JSON του service account του Firebase (Project settings › Service accounts › Generate new private key). */
let fcmTok = '', fcmExp = 0;
function fcmSA() { try { const s = (Deno.env.get('FCM_SERVICE_ACCOUNT') || '').trim(); const j = s ? JSON.parse(s) : null; return j && j.client_email && j.private_key && j.project_id ? j : null; } catch (e) { return null; } }
function b64u(b) { let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function fcmAccess(sa) {
  if (fcmTok && Date.now() < fcmExp - 120000) return fcmTok;
  const now = Math.floor(Date.now() / 1000), te = new TextEncoder();
  const head = b64u(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64u(te.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const pem = String(sa.private_key).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(head + '.' + claim));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + b64u(sig) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('FCM auth ' + r.status + ' ' + (j.error_description || j.error || ''));
  fcmTok = j.access_token; fcmExp = Date.now() + (j.expires_in || 3600) * 1000; return fcmTok;
}
async function fcmSend(sa, token, payload, ttl) {
  let p = {}; try { p = typeof payload === 'string' ? JSON.parse(payload) : (payload || {}); } catch (e) { p = { body: String(payload) }; }
  const data = {}; for (const k of Object.keys(p)) { const v = p[k]; if (v == null) continue; data[k] = typeof v === 'string' ? v : JSON.stringify(v); }
  const tag = p.tag ? String(p.tag).slice(0, 60) : undefined;
  const msg = { message: { token, notification: { title: String(p.title || 'Alkyon').slice(0, 200), body: String(p.body || '').slice(0, 1000) }, data,
    android: { priority: 'HIGH', ttl: Math.max(60, Math.min(2419200, Math.round(ttl || 86400))) + 's', notification: { channel_id: 'alkyon', icon: 'ic_stat_alkyon', color: '#FF7A4D', sound: 'default', tag } } } };
  const r = await fetch('https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send', { method: 'POST', headers: { Authorization: 'Bearer ' + await fcmAccess(sa), 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
  if (!r.ok) { const t = await r.text().catch(() => ''); const e = new Error('FCM ' + r.status + ' ' + t.slice(0, 200)); e.statusCode = (r.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(t)) ? 410 : r.status; e.body = t; throw e; }
  return { statusCode: 200 };
}
/* 1.13.0: ειδοποιήσεις στο iPhone/iPad κατευθείαν μέσω Apple Push Notification service (APNs, HTTP/2, κλειδί .p8 με JWT ES256).
   Η εφαρμογή iOS γράφει {endpoint:'apns:…', apns:'<device token hex>', apns_env:'production'|'sandbox'}.
   Secrets: APNS_KEY_P8 (όλο το .p8), APNS_KEY_ID, APNS_TEAM_ID· προαιρετικά APNS_TOPIC (αλλιώς com.alkyonfishing.app). */
let apnsJwt = '', apnsAt = 0;
function apnsCfg() { const k = (Deno.env.get('APNS_KEY_P8') || '').trim(), id = (Deno.env.get('APNS_KEY_ID') || '').trim(), team = (Deno.env.get('APNS_TEAM_ID') || '').trim();
  return k && id && team ? { k, id, team, topic: (Deno.env.get('APNS_TOPIC') || 'com.alkyonfishing.app').trim() } : null; }
async function apnsToken(c) {
  if (apnsJwt && Date.now() - apnsAt < 45 * 60000) return apnsJwt;   /* η Apple δέχεται το ίδιο token 20′–60′ */
  const te = new TextEncoder(), now = Math.floor(Date.now() / 1000);
  const head = b64u(te.encode(JSON.stringify({ alg: 'ES256', kid: c.id }))), claim = b64u(te.encode(JSON.stringify({ iss: c.team, iat: now })));
  const pem = c.k.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), ch => ch.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(head + '.' + claim));   /* r||s, όπως θέλει το JWT */
  apnsJwt = head + '.' + claim + '.' + b64u(sig); apnsAt = Date.now(); return apnsJwt;
}
async function apnsSend(c, sub, payload, ttl) {
  let p = {}; try { p = typeof payload === 'string' ? JSON.parse(payload) : (payload || {}); } catch (e) { p = { body: String(payload) }; }
  const body = Object.assign({}, p, { aps: { alert: { title: String(p.title || 'Alkyon').slice(0, 200), body: String(p.body || '').slice(0, 1000) }, sound: 'default', 'thread-id': p.tag ? String(p.tag).slice(0, 60) : undefined } });
  const host = sub.apns_env === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(2419200, Math.round(ttl || 86400)));
  const h = { authorization: 'bearer ' + await apnsToken(c), 'apns-topic': c.topic, 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-expiration': String(exp), 'content-type': 'application/json' };
  if (p.tag) h['apns-collapse-id'] = String(p.tag).slice(0, 60);
  const r = await fetch('https://' + host + '/3/device/' + encodeURIComponent(String(sub.apns)), { method: 'POST', headers: h, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text().catch(() => ''); const e = new Error('APNs ' + r.status + ' ' + t.slice(0, 200)); e.statusCode = (r.status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(t)) ? 410 : r.status; e.body = t; throw e; }
  return { statusCode: 200 };
}
function pushx(wp) {
  return { sendNotification: async (sub, payload, opts) => {
    if (sub && sub.apns) { const c = apnsCfg(); if (!c) { const e = new Error('APNS secrets missing'); e.statusCode = 500; throw e; } return apnsSend(c, sub, payload, opts && opts.TTL); }
    if (sub && sub.fcm) { const sa = fcmSA(); if (!sa) { const e = new Error('FCM_SERVICE_ACCOUNT missing'); e.statusCode = 500; throw e; } return fcmSend(sa, String(sub.fcm), payload, opts && opts.TTL); }
    if (!wp) { const e = new Error('VAPID secrets missing'); e.statusCode = 500; throw e; }
    return wp.sendNotification(sub, payload, opts);
  } };
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const secret = Deno.env.get('CRON_SECRET');
  const E = k => Deno.env.get(k) || '';
  /* 1.9.25: τα κλειδιά VAPID πρέπει να είναι base64url χωρίς «=» (το web-push απέρριπτε το κλειδί και δεν έφευγε καμία ειδοποίηση).
     Καθαρίζουμε κενά/εισαγωγικά, μετατρέπουμε + / σε - _ και κόβουμε τα = ώστε να δουλεύει όπως κι αν αποθηκεύτηκε. */
  const V = k => E(k).trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  /* και το token του Telegram χωρίς κενά/εισαγωγικά/«bot» μπροστά */
  const TGT = () => E('TELEGRAM_BOT_TOKEN').trim().replace(/^["']|["']$/g, '').replace(/^bot/i, '');
  const env = {
    SUPABASE_URL: E('SUPABASE_URL'),
    SUPABASE_SERVICE_KEY: E('SERVICE_KEY') || E('SUPABASE_SERVICE_ROLE_KEY'),
    TELEGRAM_BOT_TOKEN: TGT(),
  };
  const isCron = !!secret && req.headers.get('x-cron-secret') === secret;
  if (!isCron) {
    // Διαδρομή εφαρμογής: άμεσο «ξεκίνησε/γύρισε» για μία έξοδο του συνδεδεμένου χρήστη (έλεγχος με το token του χρήστη).
    const auth = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+/.test(auth)) return J({ ok: false, error: 'forbidden' }, 403);
    let body = {}; try { body = await req.json(); } catch (e) { /* κενό */ }
    // v31z351: δοκιμαστική ειδοποίηση push σε όλες τις συσκευές του συνδεδεμένου χρήστη (ελέγχει όλη την αλυσίδα server → κινητό)
    if (body && body.action === 'test') {
      try {
        const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: auth } });
        if (!u.ok) return J({ ok: false, error: 'unauthorized' }, 401);
        const uid = (await u.json()).id; if (!uid) return J({ ok: false, error: 'unauthorized' }, 401);
        const hasV = !!(E('VAPID_PUBLIC') && E('VAPID_PRIVATE'));
        if (!hasV && !fcmSA() && !apnsCfg()) return J({ ok: false, error: 'VAPID secrets missing' });
        if (hasV && !vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
        const px = pushx(hasV ? webpush : null);
        const sr = await fetch(env.SUPABASE_URL + '/rest/v1/push_subs?user_id=eq.' + encodeURIComponent(uid) + '&select=id,sub,checked_at,turn', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY } });
        const subs = sr.ok ? await sr.json() : [];
        let sent = 0, gone = 0, err = '';
        const at = new Date().toISOString();
        for (const r of subs || []) {
          try { await px.sendNotification(r.sub, JSON.stringify({ title: 'Alkyon ✓', body: body.lang === 'en' ? 'Test notification from the server. Alerts reach this phone.' : 'Δοκιμαστική ειδοποίηση από τον server. Οι ειδοποιήσεις φτάνουν σε αυτό το κινητό.', kind: 'test', id: 'test-' + at, tag: 'alk-test', at }), { TTL: 600 }); sent++; }
          catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { gone++; await fetch(env.SUPABASE_URL + '/rest/v1/push_subs?id=eq.' + encodeURIComponent(r.id), { method: 'DELETE', headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY } }); } else err = String(e.statusCode || '') + ' ' + e.message; }
        }
        const last = (subs || []).map(r => r.checked_at).filter(Boolean).sort().pop() || null;
        return J({ ok: true, subs: (subs || []).length, sent, gone, err, last_check: last, turn: (subs || []).some(r => r.turn === true) });
      } catch (e) { return J({ ok: false, error: e.message }, 500); }
    }
    // 1.9.61: άμεση ειδοποίηση Κοινότητας: η εφαρμογή το καλεί αμέσως μετά από νέο ψάρι, like ή σχόλιο (ο cron κάθε 5′ μένει εφεδρικός· το notif_log εμποδίζει διπλή αποστολή)
    if (body && body.action === 'comm') {
      try {
        const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: auth } });
        if (!u.ok) return J({ ok: false, error: 'unauthorized' }, 401);
        const hasV = !!(E('VAPID_PUBLIC') && E('VAPID_PRIVATE'));
        if (!hasV && !fcmSA() && !apnsCfg()) return J({ ok: false, error: 'VAPID secrets missing' });
        if (hasV && !vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
        const r = await run({ env, PF, webpush: pushx(hasV ? webpush : null), sendMail: null, log: m => console.log(String(m)), only: { comm: true } });
        return J({ ok: true, stats: r.stats });
      } catch (e) { return J({ ok: false, error: e.message }, 500); }
    }
    // 1.14.83 (P0.7): παλμός από το native GPS (σβηστή οθόνη) — κλειδί εξόδου αντί για token χρήστη
    if (body && body.action === 'hb') { try { const r = await heartbeat({ env }, body); return J(r.body, r.status); } catch (e) { return J({ ok: false, error: e.message }, 500); } }
    if (!body || body.action !== 'trip' || !/^[\w.-]{3,80}$/.test(String(body.id || '')) || !['start', 'end'].includes(body.phase)) return J({ ok: false, error: 'bad request' }, 400);
    try {
      const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: auth } });
      if (!u.ok) return J({ ok: false, error: 'unauthorized' }, 401);
      const uid = (await u.json()).id; if (!uid) return J({ ok: false, error: 'unauthorized' }, 401);
      const r = await run({ env, sendMail: null, log: m => console.log(String(m)), only: { uid, id: body.id, phase: body.phase } });
      return J(r);
    } catch (e) { console.log('trip error: ' + e.message); return J({ ok: false, error: e.message }, 500); }
  }
  let wp = null;
  if (E('VAPID_PUBLIC') && E('VAPID_PRIVATE')) {
    try {
      if (!vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
      wp = webpush;
    } catch (e) { console.log('VAPID: ' + e.message); }
  }
  const logs = [];
  try {
    const r = await run({ env, PF, webpush: (wp || fcmSA() || apnsCfg()) ? pushx(wp) : null, sendMail: null, log: m => { logs.push(String(m)); console.log(m); } });
    return new Response(JSON.stringify({ ok: r.ok, stats: r.stats, logs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.log('cron error: ' + e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message, logs }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
