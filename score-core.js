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
