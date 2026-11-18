// @ts-nocheck
// Alkyon «watch» Edge Function. Παράγεται από build_edge.py (forecast.js + v4/data-el.js + watch-index.ts). Μην το επεξεργάζεσαι στο χέρι.
globalThis.self = globalThis.self || globalThis;
// ---- forecast.js ----
/* Πρόγνωση δραστηριότητας ψαριών (ίδιο μοντέλο με την καρτέλα «Σήμερα») και έλεγχος για ειδοποιήσεις.
   Χρησιμοποιείται από τη σελίδα και από το service worker (importScripts). */
(function(g){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pad=n=>String(n).padStart(2,'0');
const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14);
const circDist=(a,b)=>{const d=Math.abs(a-b)%1440;return Math.min(d,1440-d);};
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
const SOL_MAJ=45, SOL_MIN=30;
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
const nearMin=(t,arr)=>{ let b=1e9; for(const x of arr||[]) b=Math.min(b,Math.abs(t-x)); return b; };
/* v31z363: είδος-στόχος για τον βαθμό. Στη σελίδα έρχεται από «Τι να ψαρέψω» (alkyon-advsp + knowledge.js),
   στον server και στο service worker από τη ρύθμιση (cfg.sp = {n, l, sst}). */
function targetSp(w){
  if(w&&w.sp) return w.sp;
  try{ if(typeof localStorage==='undefined') return null; const n=localStorage.getItem('alkyon-advsp'); if(!n) return null; let v=n; try{ v=JSON.parse(n); }catch(x){} if(!v) return null;
    const kb=(typeof self!=='undefined'&&self.SPKB)||[], e=kb.find(k=>k.n===v); return e?{n:e.n,l:e.l,sst:e.sst}:{n:v}; }catch(e){ return null; }
}
/* ειδικοί κανόνες από μελέτες: καλαμάρι (Cabanellas-Reboredo κ.ά. 2012, Μαγιόρκα), ξιφίας (Ceyhan κ.ά. 2018, Αν. Μεσόγειος) */
function spKind(sp){ const s=((sp&&(sp.l||''))+' '+(sp&&sp.n||'')).toLowerCase(); return /loligo|καλαμάρ|squid/.test(s)?'squid':/xiphias|ξιφ|swordfish/.test(s)?'sword':null; }
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
function hourScore(sm,hr,w){
  const sp=targetSp(w), kind=spKind(sp);
  /* 1.9.32: w.bite = μόνο «τσίμπημα»: σαν να ήταν ήρεμη η θάλασσα (άνεμος 8 kn, κύμα 0,3 m, χωρίς ριπές). Στο καλαμάρι ο άνεμος μένει, γιατί μετρά στο τσίμπημα (μελέτη). */
  const wind=w.bite?(kind==='squid'?w.wind:8):w.wind, wave=w.bite?0.3:(w.wave==null?0.5:w.wave), gust=w.bite?null:w.gust;
  /* προφίλ ψαρέματος: προσαρμογή βαρών (εκτίμηση, όχι επικυρωμένη). Στο service worker δεν υπάρχει localStorage, άρα ισχύει «βάρκα». */
  let prof=w.prof; if(!prof){ try{ prof=typeof localStorage!=='undefined'?localStorage.getItem('alkyon-fprof'):null; }catch(e){ prof=null; } }
  /* v31z361: η σελήνη μετρά λιγότερο (μελέτες: επίδραση 5–10% σε κάποια είδη, καμία σε άλλα) */
  /* 1.9.27: η φάση μετρά μόνο όπου υπάρχει μελέτη για το είδος (moonInfo). Καλαμάρι: καλύτερα κοντά στη νέα σελήνη.
     Για τα άλλα είδη (και χωρίς είδος) 0: οι μελέτες βρίσκουν μικρή επίδραση (5–10%) και με αντίθετη κατεύθυνση από είδος σε είδος. */
  let base=50+(kind==='squid'?Math.round(Math.cos(2*Math.PI*sm.f)*5):0);
  /* v31z362: η πίεση μετρά ελάχιστα. Οι μελέτες δεν βρίσκουν σταθερή επίδραση στο τσίμπημα (πέρκα: καμία· ανασκόπηση Stoner 2004:
     κύριοι παράγοντες θερμοκρασία, φως, ρεύμα, τροφή). Μικρό +1 στην άνοδο (crappie: περισσότερη κίνηση σε άνοδο, Guy 1992)
     και −2 στην απότομη πτώση (συνήθως έρχεται κακοκαιρία). Το προσωπικό μοντέλο προσαρμόζει από τα δικά σου ψάρια. */
  base+={slow:3,stable:3,rise:4,fast:1}[w.ptrend||'stable'];
  if(prof==='shore'){        /* στεριά: αντέχει λίγο περισσότερο άνεμο, αλλά το δυνατό κύμα στην ακτή είναι επικίνδυνο */
    base+=wind<5?2:wind<=14?4:wind<=20?-2:wind<=27?-12:-25;
    base+=wave<=0.5?3:wave<=1?1:wave<=1.5?-5:wave<=2?-16:-28;
  } else if(prof==='lake'){  /* λίμνη: δεν μετράει κύμα θάλασσας */
    base+=wind<5?3:wind<=12?4:wind<=18?-3:wind<=25?-12:-25;
    /* v31z404: θερμοκρασία αέρα ως ένδειξη για το ρηχό νερό της λίμνης (κυπρίνος/λαβράκι πιο δραστήρια ~15–27°C· εκτίμηση) */
    if(typeof w.temp==='number') base+=w.temp<8?-4:w.temp<14?-1:w.temp<=27?3:w.temp<=32?0:-4;
    /* ελαφριά βροχή συχνά βοηθά στη λίμνη (θολώνει, φέρνει τροφή)· δυνατή όχι */
    if(typeof w.rain==='number'&&w.rain>=40&&w.rain<75) base+=1;
  } else if(prof==='spear'){ /* ψαροντούφεκο: χαμηλό κύμα και ήπιος άνεμος μετράνε πολύ */
    base+=wind<5?3:wind<=10?4:wind<=15?-6:wind<=22?-16:-28;
    base+=wave<=0.3?4:wave<=0.6?0:wave<=1?-10:wave<=1.5?-22:-35;
  } else {
    base+=wind<5?2:wind<=12?4:wind<=18?-3:wind<=25?-12:-25;
    base+=wave<=0.5?3:wave<=1?0:wave<=1.5?-6:wave<=2?-15:-25;
  }
  base+={clear:0,part:2,over:4}[w.cloud||'part'];
  if(gust!=null) base+=gust>=35?-10:gust>=28?-5:0;
  /* v31z363: θερμοκρασία θάλασσας σε σχέση με το εύρος του είδους (knowledge.js). Χωρίς είδος δεν μετρά, γιατί η επίδραση αλλάζει από είδος σε είδος. */
  if(sp&&sp.sst&&w.sst!=null){ const lo=sp.sst[0], hi=sp.sst[1], d=w.sst<lo?lo-w.sst:w.sst>hi?w.sst-hi:0; base-=Math.min(10,Math.round(d*2.5));
    if(kind==='squid'&&!d) base+=Math.round(3*(hi-w.sst)/Math.max(1,hi-lo)); } /* καλαμάρι: πιο κρύα θάλασσα, περισσότερη ψαριά */
  if(kind==='squid'){ base+=wind<8?3:wind>14?-4:0; if(w.pres!=null) base+=w.pres<1012?3:w.pres>1018?-2:0; } /* καλαμάρι: λίγος άνεμος, χαμηλή πίεση */
  if(w.code!=null&&w.code>=95) base-=15;
  if(w.rain!=null&&w.rain>=70) base-=2;
  const t=hr*60+30; let b=0;
  const dTw=Math.min(circDist(t,sm.rise),circDist(t,sm.set)); if(dTw<=75) b+=14*(1-dTw/75);
  /* v31z361: περίοδοι Knight από ακριβείς ώρες σελήνης: κύρια ±45′ +6 (μισό έως ±75′), δευτερεύουσα ±30′ +3 */
  const dMaj=kind==='sword'?1e9:sm.maj?nearMin(t,sm.maj):1e9, dMin=kind==='sword'?1e9:sm.min?nearMin(t,sm.min):1e9;
  if(kind==='squid'){ const ds=circDist(t,sm.set); if(ds<=60) b+=8*(1-ds/90); } /* καλαμάρι: στενό παράθυρο γύρω από τη δύση του ηλίου */
  if(dMaj<=SOL_MAJ) b+=6; else if(dMaj<=SOL_MAJ+30) b+=3;
  if(dMin<=SOL_MIN) b+=3;
  if(t>=660&&t<=900) b-=4;
  return clamp(Math.round(base+b),5,98);
}
const bft=w=>[1,4,7,11,17,22,28,34,41,48,56,64].filter(x=>x<=w).length;
/* v31z525: όρια «ασφαλούς» ώρας ρυθμίζονται από τον χρήστη (alkyon-limits: kn, kn, m)· προεπιλογή όπως πριν */
const LIMD={wind:14,wave:0.9,gust:24}; let LIMO=null;
function lims(){ if(LIMO) return Object.assign({},LIMD,LIMO); try{ const o=typeof localStorage!=='undefined'?JSON.parse(localStorage.getItem('alkyon-limits')||'null'):null; if(o&&typeof o==='object') return Object.assign({},LIMD,o); }catch(e){} return LIMD; }
const safeHour=h=>{ const L=lims(); return h.wind<=L.wind&&(h.wave==null||h.wave<=L.wave)&&(h.gust==null||h.gust<=L.gust)&&(h.code==null||h.code<95); };
/* 1.14.23: «ο δείκτης μαθαίνει»: τα ευρήματα του «Πότε τσιμπάνε» (bite_stats) διορθώνουν λίγο τον δείκτη κάθε ώρας.
   Μόνο ισχυρά ευρήματα (και οι δύο μέθοδοι, ή ≥ 15 ψάρια), με «συρρίκνωση» n/(n+60): λίγα στοιχεία → σχεδόν καμία αλλαγή. Όριο ±15%.
   h.learn = τι ταίριαξε (για την εξήγηση). */
function learnBins(sm,h){ const o={}, t=h.hr*60+30;
  if(sm&&sm.rise!=null){ o.sun=t<sm.rise-60||t>sm.set+60?0:t<sm.rise+90?1:t>sm.set-90?5:(t<(sm.rise+sm.set)/2-120?2:t<=(sm.rise+sm.set)/2+120?3:4); }
  if(h.ptrend) o.pt=(h.ptrend==='fast'||h.ptrend==='slow')?0:h.ptrend==='rise'?2:1;
  if(typeof h.pres==='number') o.pl=h.pres<1010?0:h.pres<1015?1:h.pres<1020?2:3;
  if(typeof h.wind==='number') o.wind=h.wind<5?0:h.wind<10?1:h.wind<15?2:3;
  if(typeof h.wave==='number') o.wave=h.wave<0.3?0:h.wave<0.6?1:h.wave<1?2:3;
  if(h.tide) o.tide=h.tide==='up'?0:h.tide==='down'?1:2;
  if(h.cloud) o.cloud=h.cloud==='clear'?0:h.cloud==='part'?1:2;
  if(typeof h.mm==='number') o.rain=h.mm>=0.2?1:0; /* 1.14.27: βροχή σε mm (όχι πιθανότητα), όπως στον server */
  /* 1.14.26: και ώρες μετά τη δύση, φάση σελήνης, εποχή, θερμοκρασία νερού (κυρίως για τα κεφαλόποδα) */
  if(sm&&sm.rise!=null){ const m=h.hr*60+30; if(m>=sm.rise&&m<sm.set) o.aft=0; else if(m<sm.rise&&m>=sm.rise-90) o.aft=5; else { const af=m>=sm.set?m-sm.set:m+1440-sm.set; o.aft=af<60?1:af<180?2:af<360?3:4; } }
  if(sm&&typeof sm.f==='number') o.moon=Math.round(sm.f*8)%8;
  if(h.t){ const mo=+String(h.t).slice(5,7)-1; if(mo>=0) o.season=mo===11||mo<=1?0:mo<=4?1:mo<=7?2:3; }
  /* 1.14.27: σκοτάδι, όπως στον server: μέρα → 0· αλλιώς φάση σελήνης × ύψος σελήνης × σύννεφα */
  if(sm&&sm.rise!=null&&typeof h.mal==='number'){ const m=h.hr*60+30; if(m>=sm.rise+90&&m<=sm.set-90) o.dark=0; else { const cl=typeof h.clp==='number'?h.clp:(h.cloud==='clear'?10:h.cloud==='over'?85:45); const L=(sm.illum||0)*Math.max(0,Math.sin(h.mal*Math.PI/180))*(1-0.8*Math.min(100,Math.max(0,cl))/100); o.dark=L<0.05?1:L<0.25?2:3; } }
  if(typeof h.thd==='number') o.thc=h.thd===0?0:h.thd<20?1:h.thd<50?2:3; /* 1.14.30: θερμοκλινές, όπως στον server */
  if(typeof h.chl==='number') o.chl=h.chl<0.04?0:h.chl<0.07?1:h.chl<0.12?2:3; /* 1.14.29: χλωροφύλλη (δορυφόρος), όπως στον server */
  if(typeof h.sst==='number') o.sstb=h.sst<16?0:h.sst<19?1:h.sst<22?2:h.sst<25?3:4;
  return o; }
/* 1.14.24: {by:{sea,spear,lake}} → η ομάδα του προφίλ (σκάφος/ακτή = θάλασσα με καλάμι) */
const CEPH_L=['loligo vulgaris','loligo forbesii','alloteuthis media','alloteuthis subulata','todarodes sagittatus','illex coindetii','ommastrephes bartramii','sepia officinalis','sepia elegans','sepia orbignyana','sepioteuthis lessoniana','octopus vulgaris','eledone cirrhosa','eledone moschata'];
/* 1.14.26: με στόχο είδος: πρώτα τα ευρήματα του είδους (με δανεισμό από την ομάδα του), μετά κεφαλόποδα αν είναι κεφαλόποδο, αλλιώς η ομάδα του προφίλ */
function learnPick(L,sp){ if(!L||!L.by) return L; const la=String(sp&&typeof sp==='object'?(sp.l||''):(sp||'')).toLowerCase(); if(la){ if(L.sp&&L.sp[la]) return L.sp[la]; if(CEPH_L.indexOf(la)>=0) return L.by.ceph||null; } let p='boat'; try{ p=(typeof window!=='undefined'&&window.AK&&window.AK.prof)?window.AK.prof():'boat'; }catch(e){} return L.by[p==='spear'?'spear':p==='lake'?'lake':'sea']||null; }
function learnAdj(L,sm,h){ if(!L||!L.ins||!L.ins.length) return h; const bb=learnBins(sm,h); let lg=0; const m=[];
  for(const x of L.ins){ if(!(x.src==='both'||x.n>=15)||bb[x.f]!==x.b||!(x.lift>0)) continue; const w=x.n/(x.n+60); lg+=w*Math.log(x.lift); m.push({f:x.f,b:x.b,lift:x.lift}); }
  if(!m.length) return h; const k=Math.max(0.85,Math.min(1.15,Math.exp(lg)));
  h.learn={k:Math.round(k*100)/100,m}; if(typeof h.score==='number') h.score=Math.max(0,Math.min(100,Math.round(h.score*k))); if(typeof h.bite==='number') h.bite=Math.max(0,Math.min(100,Math.round(h.bite*k)));
  return h; }
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
    const day=h=>{const t=h.hr*60+30;return t>=sm.rise-60&&t<=sm.set+60;};
    const cand=hours.filter(h=>h.safe&&day(h)&&(date!==today||h.t>=nowLocal.slice(0,13)+':00'));
    let best=0,win=null;
    if(cand.length){
      best=Math.max(...cand.map(h=>h.score)); const thr=best-6; let groups=[],cur=null;
      for(const h of hours){ if(h.safe&&h.score>=thr&&cand.includes(h)){ if(cur&&cur.e===h.hr-1){cur.e=h.hr;} else {cur={s:h.hr,e:h.hr};groups.push(cur);} } }
      win=groups.sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0]||null;
    }
    /* 1.9.32: τσίμπημα της μέρας: καλύτερη ώρα φωτός ανεξάρτητα από άνεμο/κύμα (και στις ώρες εκτός ορίων) */
    const bc=hours.filter(h=>day(h)&&(date!==today||h.t>=nowLocal.slice(0,13)+':00')); let bite=null,biteWin=null;
    if(bc.length){ bite=Math.max(...bc.map(h=>h.bite)); const bt=bite-6; let g2=[],c2=null; for(const h of hours){ if(bc.includes(h)&&h.bite>=bt){ if(c2&&c2.e===h.hr-1) c2.e=h.hr; else { c2={s:h.hr,e:h.hr}; g2.push(c2); } } } biteWin=g2.sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0]||null; }
    const used=win?hours.filter(h=>h.hr>=win.s&&h.hr<=win.e):hours;
    const why=cand.length?'':(hours.some(h=>h.safe&&day(h))?'night':'unsafe');
    const dr=rows.filter(r=>{const t=r.hr*60+30;return t>=sm.rise-60&&t<=sm.set+60;}), use=dr.length?dr:rows;
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
g.PF={explainHour,ensSpread,learnPick,learnBins,learnAdj,darkTxt,darkWin,squidEves,nextMoon,moonInfo,lims,moonAlt,moonEvents,moonPhase,solunarPeriods,pressureRise,sunMoon,hourScore,getForecast,findIdeal,message,check,goodDays,checkPlaces,dayLabel,bft,pressureEvent,windEvent,pressureTurns,pressureOutlook};
})(typeof self!=='undefined'?self:this);

globalThis.__ALKYON_PF = self.PF;
globalThis.__ALKYON_EL = {"african sailfin flyingfish": "Χελιδονόψαρο", "albacore": "Τονάκι", "ambush (hovering)": "Αναμονή", "american eel": "Χέλι", "angler (monkfish)": "Πεσκανδρίτσα", "annular seabream": "Σπάρος", "atlantic bluefin tuna": "Τόνος", "atlantic bonito": "Παλαμίδα", "atlantic chub mackerel": "Κολιός", "atlantic cod": "Μπακαλιάρος", "atlantic herring": "Ρέγγα", "atlantic horse mackerel": "Σαφρίδι", "atlantic mackerel": "Σκουμπρί", "atlantic pomfret": "Μπράμα", "atlantic salmon": "Σολομός", "axillary seabream": "Φατσούκλι", "banded dye-murex": "Μούρεξ", "big-scale sand smelt": "Αθερίνα", "bigfin reef squid": "Σουπιοκαλάμαρο", "black goby": "Γωβιός", "black scorpionfish": "Σκορπίνα", "black seabream": "Σκαθάρι", "black-bellied angler": "Πεσκαντρίτσα", "blackbelly rosefish": "Σκορπιός", "blackchin guitarfish": "Βιόλα", "blackspot seabream": "Μπαλάς", "blotched picarel": "Μένουλα", "blue runner": "Σούρος", "blue shark": "Γαλάζιος καρχαρίας", "blue swimmer crab": "Γαλάζιο καβούρι", "bluefish": "Λουφάρι", "bluespotted cornetfish": "Πιθκιαύλι", "bluestriped lizardfish": "Σκαρμός", "bogue": "Γόπα", "bottom fishing": "Βυθού", "bottom with bait": "Βυθού με δόλωμα", "bread": "ψωμί", "brown meagre": "Σιακός", "brown trout": "Πέστροφα", "butterfly blenny": "Σάλιαρος", "caramote prawn": "Γαρίδα", "cardinal fish": "Κρομμύδι", "chub mackerel": "Σκουμπρί", "comber": "Χάννος", "common carp": "Κυπρίνος", "common cuttlefish": "Σουπιά", "common dentex": "Συναγρίδα", "common dolphinfish": "Κυνηγός", "common eagle ray": "Πεζουνόψαρο", "common octopus": "Χταπόδι", "common pandora": "Λιθρίνι", "common smooth-hound": "Γαλέος", "common sole": "Γλώσσα", "common spiny lobster": "Καραβίδα", "common stingray": "Τρυγόνα", "curled picarel": "Μαρίδα αμερικάνα", "current / open water": "Ρεύμα / ανοιχτά", "cuttlefish": "Σουπιά", "damselfish": "Παπαθκιά", "date mussel": "Θαλάσσιος χουρμάς", "deep / bottom trolling": "Συρτή βυθού", "deep dive": "Βαθιά κατάδυση", "deep vertical": "Καθετή βαθιά", "dentex": "Συναγρίδα", "derbio": "Λιτσούι", "dogtooth grouper": "Ασπρόβλαχος", "dusky grouper": "Ροφός", "dusky spinefoot": "Σιγανός", "european anchovy": "Γαύρος", "european barracuda": "Λούτσος", "european conger": "Μουγκρί", "european eel": "Χέλι", "european flat oyster": "Στρείδι", "european flying squid": "Θράψαλο", "european hake": "Μερλούτσο", "european lobster": "Αστακός", "european perch": "Πέρκα", "european pilchard": "Σαρδέλα", "european seabass": "Λαβράκι / Λαυράκι", "european sprat": "Παπαλίνα", "european squid": "Καλαμάρι", "fishing": "Ψάρεμα", "flathead grey mullet": "Κέφαλος", "float fishing": "Με πλωτήρα", "flying gurnard": "Όρνιθα", "forkbeard": "Γάρος", "garfish": "Ζαργάνα", "gilthead seabream": "Τσιπούρα", "goldband goatfish": "Τουρκομπάρμπουνο", "goldblotch grouper": "Στήρα", "gray triggerfish": "Γουρουνόψαρο", "great mediterranean scallop": "Χτένι", "greater amberjack": "Μαγιάτικο", "greater weever": "Δρακαίνα", "grey triggerfish": "Γουρουνόψαρο", "harbour / pier": "Λιμάνι / μώλος", "hardyhead silverside": "Αθερίνα", "holes and ledges": "Τρύπες και φωλιές", "horse mackerel": "Σαυρίδι", "japanese eel": "Χέλι", "john dory": "Χριστόψαρο", "ledge / drop-off": "Ταμπλά / κατωφλι", "leerfish": "Λίτσα", "lesser spotted dogfish": "Σκυλοψαράκι", "limpet": "Πεταλίδα", "live bait": "Ζωντανό δόλωμα", "live baitfish": "Ζωντανό ψαράκι", "live sardine": "ζωντανή σαρδέλα", "live shrimp": "ζωντανή γαρίδα", "live squid": "ζωντανό καλαμάρι", "live squid / cuttlefish": "Ζωντανό καλαμάρι / σουπιά", "longspine spinefish": "Ξιφιούδι", "map point": "Σημείο χάρτη", "marbled electric ray": "Νάρκη", "marbled spinefoot": "Κουρκούνα άσπρη", "mediterranean horse mackerel": "Σαφρίδι", "mediterranean moray": "Σμέρνα", "mediterranean mussel": "Μύδι", "mediterranean parrotfish": "Σκάρος", "mediterranean slipper lobster": "Αρκούδα", "mediterranean spearfish": "Ζαργάνα", "mediterranean triton": "Τρίτωνας", "mottled grouper": "Πίγγα", "musky octopus": "Μοσχιός", "my location": "Η θέση μου", "narrow-barred spanish mackerel": "Μάκερελ", "nile tilapia": "Τιλάπια", "noble pen shell": "Πίνα", "northern pike": "Λούτσος", "octopus": "χταπόδι", "oilfish": "Τσιρίτζι", "other": "Άλλο", "painted comber": "Πέρκα", "parrotfish": "Σκάρος", "peacock wrasse": "Χειλού", "pearly razorfish": "Ποντικός", "picarel": "Μαρίδα", "pilotfish": "Πιλότος", "pink dentex": "Φαγκρί κορωνάτο", "point": "Σημείο", "point from the logbook": "Σημείο από το Ημερολόγιο", "rainbow wrasse": "Γύλος", "red bandfish": "Κορδέλα", "red lionfish": "Λεοντόψαρο", "red mullet": "Κουτσομούρα", "red porgy": "Φαγκρί", "red scorpionfish": "Σκορπίνα", "red soldier fish": "Ρώσσος", "rocks / reef": "Βράχια / ύφαλος", "roughtail stingray": "Βατί", "round herring": "Στρογγυλόρεγγα", "round sardinella": "Φρίσσα", "saddled seabream": "Μελανούρι", "salema porgy": "Σάλπα", "sand": "Άμμος", "sardine": "σαρδέλα", "scorpionfish": "Σκορπίνα", "searching / roaming": "Περιπλάνηση", "shallow vertical": "Καθετή ρηχή", "sharpsnout seabream": "Ούγενα", "shi drum": "Μυλοκόπι", "shore bottom fishing": "Βυθού από στεριά", "shore float fishing": "Με πλωτήρα από στεριά", "shore spinning": "Spinning από στεριά", "shortnose greeneye": "Γουρλομάτης", "shrimp": "γαρίδα", "silver-cheeked toadfish": "Λαγοκέφαλος", "spiny dogfish": "Σκυλόψαρο", "spiny spider crab": "Αράχνη (καβούρι)", "spot": "Σημείο", "squid": "καλαμάρι", "squid jigging": "Καλαμαριέρα", "stargazer": "Λύχνος", "streaked gurnard": "Καπόνι", "striped red mullet": "Μπαρμπούνι", "striped seabream": "Μουρμούρα", "surface trolling": "Συρτή αφρού", "swallowtail seaperch": "Κοκκινόχαννος", "swordfish": "Ξιφίας", "thornback ray": "Ράζα", "trolling": "Τρόλινγκ", "turbot": "Καλκάνι", "two-banded seabream": "Χαρατζίδα", "vanikoro sweeper": "Φατσούι", "warty crab": "Καβούρι πέτρας", "warty venus": "Αχιβάδα", "wels catfish": "Γουλιανός", "white grouper": "Σφυρίδα", "white seabream": "Σαργός", "white trevally": "Καραγκίδα", "worm": "σκουλήκι", "wreck": "Ναυάγιο", "wreckfish": "Κολαούζος", "zebra seabream": "Σορκός φαραώ"};
// ---- watch-index.ts ----
// Supabase Edge Function «watch» (v31z552, v31z553): η εφαρμογή Alkyon στο ρολόι Garmin.
//   GET  /functions/v1/watch?lat=34.9&lon=32.4[&code=ABC123]  → σύντομη πρόγνωση (ίδιος βαθμός με την εφαρμογή, από το forecast.js)
//   POST /functions/v1/watch  {code, t, lat, lon, kind:'fish'|'miss'|'pest', n, trip}  → γράφει το ψάρι στο Ημερολόγιο του χρήστη
//   GET  /functions/v1/watch?grid=1&lat=..&lon=..[&code=..]  → 1.9.72: χάρτης βυθού γύρω από το σημείο (συρτή βυθού στο ρολόι)
//   POST /functions/v1/watch  {code, kind:'undo'|'upd', cid[, miss, sp]}  → 1.9.75: αναίρεση/αλλαγή ψαριού από το ρολόι
//   POST /functions/v1/watch  {code, kind:'trip', ts, te, tz, tid, n, pts:[[lat,lon,ts],…]}  → 1.1.0: έξοδος από το ρολόι
// Τα ρολόγια Apple Watch και Wear OS χρησιμοποιούν την ίδια function και στέλνουν επιπλέον dev = 'applewatch' | 'wearos'.
// Το «code» είναι ο κωδικός σύνδεσης ρολογιού (Προφίλ › Ρολόι Garmin στην εφαρμογή, πίνακας watch_links, βλ. watch-link.sql).
// Χρειάζεται: Verify JWT = off. Τα SUPABASE_URL και SUPABASE_SERVICE_ROLE_KEY υπάρχουν ήδη σε κάθε Edge Function.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const J = (o, status = 200, cache = 'no-store') => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache, ...CORS } });
/* 1.14.83 (P0.5): ο κώδικας της πρόγνωσης (forecast.js) και τα ελληνικά ονόματα ειδών μπαίνουν στη function κατά το χτίσιμο
   (build_edge.py → watch-edge-index.ts). Τίποτα δεν κατεβαίνει πια από το GitHub την ώρα που τρέχει. */
const mem = { pf: null, pfAt: 0, fc: new Map(), codes: new Map(), el: null, elAt: 0 };
/* 1.10.10: ελληνικά ονόματα για είδη που γράφτηκαν στα αγγλικά (ίδιος πίνακας με την εφαρμογή, v4/data-el.js) */
export async function elNames(F, now) { return globalThis.__ALKYON_EL || {}; }
export function elName(M, n) { const s = String(n || ''); if (!/[A-Za-z]{3}/.test(s)) return s; const k = s.trim().toLowerCase(), v = M[k];
  if (v) return /^[A-Z]/.test(s.trim()) ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  const g = k.match(/^(longline|net|pot|trap) (\d+)$/); return g ? ({ longline: 'Παραγάδι', net: 'Δίχτυ', pot: 'Κλουβί', trap: 'Κλουβί' })[g[1]] + ' ' + g[2] : s; }
const env = (k) => (typeof Deno !== 'undefined' ? Deno.env.get(k) : (globalThis.process && process.env[k])) || '';

export async function loadPF(F = fetch, now = Date.now()) {
  if (globalThis.__ALKYON_PF) return globalThis.__ALKYON_PF;
  throw new Error('forecast bundle missing (deploy watch-edge-index.ts from build_edge.py)');
}
async function sb(F, path, opt = {}) {
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('service key');
  const r = await F(url + '/rest/v1/' + path, { ...opt, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  return r;
}
/* 1.14.83 (P0.5): κωδικοί ρολογιού με λήξη (180 μέρες χωρίς χρήση· κάθε χρήση την ανανεώνει), ανάκληση (revoked_at ή διαγραφή από την εφαρμογή)
   και όριο αποτυχημένων προσπαθειών: από την ίδια IP έως 20 λάθος κωδικούς ανά 15′, μετά 429. Η μνήμη κρατά έναν σωστό κωδικό έως 60″,
   οπότε μια αποσύνδεση ρολογιού ισχύει μέσα σε ένα λεπτό. */
export const WATCH_TTL_DAYS = 180, FAIL_MAX = 20, FAIL_WIN_MS = 15 * 60e3, CODE_CACHE_MS = 60e3;
export function normCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export async function rateLimited(F, ip, now = Date.now()) {
  if (!ip) return false;
  try { const r = await sb(F, 'watch_auth_fail?select=at&ip=eq.' + encodeURIComponent(ip) + '&at=gt.' + encodeURIComponent(new Date(now - FAIL_WIN_MS).toISOString()) + '&limit=' + FAIL_MAX);
    if (!r.ok) return false; const a = await r.json(); return Array.isArray(a) && a.length >= FAIL_MAX; } catch (e) { return false; }
}
export async function userOf(F, code, now = Date.now(), ip = '') {
  code = normCode(code); if (code.length < 6) return null;
  const c = mem.codes.get(code); if (c && c.v && now - c.at < CODE_CACHE_MS) return c.v;
  if (await rateLimited(F, ip, now)) return { limited: true };
  const nowIso = new Date(now).toISOString();
  const r = await sb(F, 'watch_links?select=user_id,lang,last_used_at&code=eq.' + code + '&revoked_at=is.null&or=' + encodeURIComponent('(expires_at.is.null,expires_at.gt.' + nowIso + ')') + '&limit=1'); if (!r.ok) return null;
  const a = await r.json(); const v = a && a[0] ? { user_id: a[0].user_id, lang: a[0].lang } : null;
  if (!v) { mem.codes.delete(code); if (ip) sb(F, 'watch_auth_fail', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ ip, at: nowIso }]) }).catch(() => {}); return null; }
  mem.codes.set(code, { at: now, v });
  /* ανανέωση λήξης το πολύ μία φορά την ώρα */
  const lu = a[0].last_used_at ? Date.parse(a[0].last_used_at) : 0;
  if (!(now - lu < 3600e3)) sb(F, 'watch_links?code=eq.' + code, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_used_at: nowIso, expires_at: new Date(now + WATCH_TTL_DAYS * 864e5).toISOString() }) }).catch(() => {});
  return v;
}
const ipOf = (req) => String(req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || '').trim().slice(0, 64);
const DAYS_EL = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'], DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const bft = (kn) => kn == null ? null : [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64].findIndex(x => kn < x) === -1 ? 12 : [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64].findIndex(x => kn < x);
const r1 = (x) => x == null ? null : Math.round(x * 10) / 10;
/* σύντομη μορφή για το ρολόι (μικρή μνήμη): ως 6 μέρες + οι επόμενες 12 ώρες + πίεση */
export function compact(PF, fc, en, lat = null, lon = null) {
  const now = fc.nowLocal.slice(0, 13) + ':00', today = fc.nowLocal.slice(0, 10);
  const days = fc.days.filter(d => d.date >= today).slice(0, 6).map(d => {
    const dt = new Date(d.date + 'T12:00:00Z');
    return { n: d.date === today ? (en ? 'Today' : 'Σήμερα') : (en ? DAYS_EN : DAYS_EL)[dt.getUTCDay()] + ' ' + dt.getUTCDate(), s: d.safe ? d.best : null,
      w: d.safe && d.win ? String(d.win.s).padStart(2, '0') + '-' + String((d.win.e + 1) % 24).padStart(2, '0') : '', b: bft(d.wx && d.wx.windMax != null ? d.wx.windMax : d.avgWind), v: r1(d.wx && d.wx.waveMax != null ? d.wx.waveMax : d.avgWave), x: d.safe ? 0 : 1 };
  });
  const hrs = []; fc.days.forEach(d => d.hours.forEach(h => { if (h.t >= now && hrs.length < 12) hrs.push({ h: h.hr, s: h.score != null ? Math.round(h.score) : null, b: bft(h.wind), v: r1(h.wave), p: h.pres != null ? r1(h.pres) : null }); }));   // 1.2.0: με ένα δεκαδικό, για ομαλό γράφημα στο ρολόι
  let pr = null; try { const ev = PF.pressureEvent(fc); if (ev) pr = { d: r1(ev.d), h: ev.hours, t: ev.t.slice(11, 16), from: Math.round(ev.from), to: Math.round(ev.to) }; } catch (e) {}
  const cur = hrs[0] || {};
  /* 1.2.0: σημερινές 24 ώρες για το δαχτυλίδι του ρολογιού: βαθμός ανά ώρα (-1 = όχι ασφαλής), ανατολή/δύση σε λεπτά από τα μεσάνυχτα, καλύτερο παράθυρο */
  let td = null; const d0 = fc.days.find(d => d.date === today);
  if (d0) { const h = new Array(24).fill(-1); d0.hours.forEach(x => { if (x.hr >= 0 && x.hr < 24) h[x.hr] = x.safe && x.score != null ? Math.round(x.score) : -1; });
    td = { h, r: d0.rise != null ? Math.round(d0.rise) : null, st: d0.set != null ? Math.round(d0.set) : null, ws: d0.safe && d0.win ? d0.win.s : null, we: d0.safe && d0.win ? d0.win.e : null };
    /* 1.2.2: ηλιοσεληνιακές περίοδοι σήμερα (κέντρο, λεπτά από τα μεσάνυχτα): ma = κύριες, mi = δευτερεύουσες */
    try { if (lat != null && lon != null && PF.sunMoon) { const sm = PF.sunMoon(today, lat, lon, Number.isFinite(+fc.tz) ? +fc.tz : 120), inDay = (m) => m >= 0 && m < 1440;
      td.ma = (sm.maj || []).filter(inDay).map(Math.round); td.mi = (sm.min || []).filter(inDay).map(Math.round); } } catch (e) {} }
  /* 1.9.92: αύριο, για το δαχτυλίδι του ρολογιού όταν σήμερα δεν βγαίνει (ή πέρασε): ίδια μορφή με το td, χωρίς ηλιοσεληνιακά */
  let t2 = null; try { const d1 = fc.days.find(d => d.date > today);
    if (d1) { const h = new Array(24).fill(-1); d1.hours.forEach(x => { if (x.hr >= 0 && x.hr < 24) h[x.hr] = x.safe && x.score != null ? Math.round(x.score) : -1; });
      t2 = { h, r: d1.rise != null ? Math.round(d1.rise) : null, st: d1.set != null ? Math.round(d1.set) : null, ws: d1.safe && d1.win ? d1.win.s : null, we: d1.safe && d1.win ? d1.win.e : null }; } } catch (e) {}
  /* 1.2.2: επόμενο καλό παράθυρο (σήμερα ή αύριο) για την ειδοποίηση «σε 30′» στο ρολόι: ts σε δευτερόλεπτα UTC */
  let bw = null; try { const tz = Number.isFinite(+fc.tz) ? +fc.tz : 120, nowS = Date.now() / 1000;
    for (const d of fc.days.filter(x => x.date >= today).slice(0, 2)) { if (!d.safe || !d.win) continue; const ts = Math.round((Date.parse(d.date + 'T' + String(d.win.s).padStart(2, '0') + ':00:00Z') - tz * 60000) / 1000);
      if (ts > nowS) { bw = { ts, s: Math.round(d.best), w: String(d.win.s).padStart(2, '0') + '-' + String((d.win.e + 1) % 24).padStart(2, '0') }; break; } } } catch (e) {}
  /* 1.9.69: καλαμάρι για τη σελίδα του ρολογιού: il = φωτισμός φεγγαριού %, nd = μέρες ως τη νέα σελήνη, dk = σκοτάδι απόψε [αρχή, τέλος σε λεπτά, 1 = ως το πρωί],
     ev = τα καλύτερα βράδια γύρω από τη νέα σελήνη (έως 3: όνομα μέρας, ώρα, βαθμός) */
  let sq = null; try { const tz = Number.isFinite(+fc.tz) ? +fc.tz : 120, nowMs = Date.now(), nm = PF.nextMoon ? PF.nextMoon(nowMs) : {}, il = PF.moonPhase ? Math.round(PF.moonPhase(nowMs).illum * 100) : null;
    const d0 = fc.days.find(d => d.date === today); let dk = null;
    if (d0 && lat != null && PF.darkWin) { const w = PF.darkWin(today, d0.set, d0.rise, lat, lon, tz); if (w) dk = [Math.round(w.s), Math.round(w.e), w.why === 'dawn' ? 1 : 0]; }
    const dn = (date) => { if (date === today) return en ? 'Today' : 'Σήμερα'; const dt = new Date(date + 'T12:00:00Z'); return (en ? DAYS_EN : DAYS_EL)[dt.getUTCDay()] + ' ' + dt.getUTCDate(); };
    const nwNear = (PF.nextMoon(nowMs - 3.5 * 864e5) || {}).nw;   // 1.9.70: η νέα σελήνη που πέρασε ως 3,5 μέρες πριν (όπως στην εφαρμογή), όχι η επόμενη του μήνα
    const ev = PF.squidEves ? PF.squidEves(fc.days.filter(d => d.date >= today), nwNear, { now: fc.nowLocal.slice(0, 13) + ':00', lat, lon, tz }).slice(0, 3).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map(e => ({ n: dn(e.date), h: e.hr, s: Math.round(e.score), ss: e.set != null ? Math.round(e.set) : null })) : [];   // 1.9.70: ss = δύση (λεπτά)
    /* αν η νέα σελήνη πέρασε τις τελευταίες 4 μέρες, nd < 0 («πριν 2 μέρες»): είναι ακόμα καλή περίοδος */
    let nd = nm.nw ? (nm.nw - nowMs) / 864e5 : null; try { const pm = PF.nextMoon(nowMs - 4 * 864e5).nw; if (pm && pm <= nowMs) nd = -(nowMs - pm) / 864e5; } catch (e) {}
    /* 1.9.70: wx = 1 όταν το φεγγάρι μεγαλώνει (αύξουσα), για τη φάση και το σχέδιο στο ρολόι */
    let wx = null; try { if (nd != null) wx = nd < 0 || nd > 14.8 ? 1 : 0; } catch (e) {}
    sq = { il, nd: nd == null ? null : Math.round(nd * 10) / 10, dk, ev, wx }; } catch (e) {}
  /* 1.10.9: για τη σελίδα «Έξοδος» του ρολογιού: θερμοκρασία νερού (wt) και αλλαγή πίεσης στις τελευταίες 3 ώρες (pd, hPa) */
  let wt = null, pd = null; try { const all = []; fc.days.forEach(d => d.hours.forEach(h => all.push(h))); let ci = -1; all.forEach((h, i) => { if (h.t <= now) ci = i; });
    if (ci < 0) ci = 0; const hc = all[ci]; if (hc) { if (hc.sst != null) wt = r1(hc.sst); const h3 = all[ci - 3]; if (h3 && hc.pres != null && h3.pres != null) pd = r1(hc.pres - h3.pres); } } catch (e) {}
  return { ok: 1, now: { s: cur.s, b: cur.b, v: cur.v, p: cur.p, wt, pd }, days, hrs, pr, tn: turns(PF, fc), at: fc.nowLocal.slice(11, 16), td, t2, bw, sq };
}
/* v31z553: καμπές πίεσης (ίδιες με την ειδοποίηση της εφαρμογής, PF.pressureTurns): k = 'peak' (κορυφή → μετά πέφτει) ή 'low' (πάτος → μετά ανεβαίνει),
   ts = ώρα σε δευτερόλεπτα UTC, t = τοπική ώρα ΩΩ:ΛΛ, p = hPa. Μόνο από 1 ώρα πριν ως 24 ώρες μετά. */
export function turns(PF, fc) {
  const out = []; let a = []; try { a = PF.pressureTurns(fc) || []; } catch (e) { a = []; }
  const tz = Number.isFinite(+fc.tz) ? +fc.tz : 120, now = Date.now() / 1000;
  for (const e of a) {
    const ts = Math.round((Date.parse(e.t + ':00Z') - tz * 60000) / 1000);
    if (!Number.isFinite(ts) || ts < now - 3600 || ts > now + 24 * 3600) continue;
    out.push({ k: /^peak/.test(e.kind) ? 'peak' : 'low', ts, t: e.t.slice(11, 16), p: Math.round(e.p) });
  }
  return out.slice(0, 4);
}
/* Apple Watch / Wear OS (dev): ίδια function με το Garmin· αλλάζει μόνο το κείμενο της σημείωσης */
function recNote(en, dev) { const n = dev === 'applewatch' ? 'Apple Watch' : dev === 'wearos' ? 'Wear OS' : 'Garmin'; return en ? 'Recorded on the ' + n + ' watch' : 'Καταγράφηκε στο ρολόι ' + n; }
function rid() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function localParts(ms, tzMin) { const d = new Date(ms + tzMin * 60000); const iso = d.toISOString(); return { date: iso.slice(0, 10), time: iso.slice(11, 16) }; }
/* ώρα Κύπρου (ή της ζώνης που στέλνει το ρολόι) */
function tzOf(ms) { try { const s = new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Nicosia', hour12: false }); const m = s.match(/(\d+)\/(\d+)\/(\d+),? (\d+):(\d+)/); const loc = Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] % 24, +m[5]); return Math.round((loc - ms) / 60000); } catch (e) { return 120; } }


/* ---------- 1.9.72: χάρτης βυθού για τη συρτή βυθού στο ρολόι ----------
   GET /functions/v1/watch?grid=1&lat=..&lon=..[&code=..] → πλέγμα EMODnet (~115 m) ±1,3 km γύρω από το σημείο, βάθος σε μέτρα (0 = στεριά/κενό).
   Με code: μπαίνουν και οι διορθώσεις βυθομέτρου του χρήστη (alkyon-dcorr από τις ρυθμίσεις της εφαρμογής), όπως στο κινητό.
   Κελί (i, j): κέντρο lon = x0 + i·dx, lat = y0 − j·dy (πρώτη γραμμή = βόρεια). */
const WCS = 'https://ows.emodnet-bathymetry.eu/wcs', CELL = 1 / 960;
export function parseTiff(buf) {
  const dv = new DataView(buf), le = dv.getUint16(0) === 0x4949; if (!le && dv.getUint16(0) !== 0x4d4d) throw new Error('tiff');
  if (dv.getUint16(2, le) !== 42) throw new Error('tiff magic');
  const ifd = dv.getUint32(4, le), n = dv.getUint16(ifd, le), tg = {}, SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12, tag = dv.getUint16(o, le), typ = dv.getUint16(o + 2, le), cnt = dv.getUint32(o + 4, le), size = (SZ[typ] || 1) * cnt, p = size <= 4 ? o + 8 : dv.getUint32(o + 8, le); let vals = [];
    if (typ === 3) for (let k = 0; k < cnt; k++) vals.push(dv.getUint16(p + k * 2, le));
    else if (typ === 4) for (let k = 0; k < cnt; k++) vals.push(dv.getUint32(p + k * 4, le));
    else if (typ === 12) for (let k = 0; k < cnt; k++) vals.push(dv.getFloat64(p + k * 8, le));
    else if (typ === 2) { let s = ''; for (let k = 0; k < cnt; k++) { const ch = dv.getUint8(p + k); if (ch) s += String.fromCharCode(ch); } vals = [s]; }
    else if (typ === 16) for (let k = 0; k < cnt; k++) vals.push(Number(dv.getBigUint64(p + k * 8, le)));
    tg[tag] = vals;
  }
  const w = tg[256][0], h = tg[257][0], bits = (tg[258] || [32])[0], comp = (tg[259] || [1])[0], fmt = (tg[339] || [3])[0];
  if (comp !== 1 || bits !== 32 || fmt !== 3) throw new Error('tiff format');
  const data = new Float32Array(w * h);
  if (tg[324]) { const tw = tg[322][0], th = tg[323][0], tx = Math.ceil(w / tw), offs = tg[324];
    for (let t = 0; t < offs.length; t++) { const ox = (t % tx) * tw, oy = Math.floor(t / tx) * th; for (let y = 0; y < th && oy + y < h; y++) for (let x = 0; x < tw && ox + x < w; x++) data[(oy + y) * w + ox + x] = dv.getFloat32(offs[t] + (y * tw + x) * 4, le); } }
  else { const rps = (tg[278] || [h])[0], so = tg[273]; let row = 0; for (let si = 0; si < so.length; si++) for (let r = 0; r < rps && row < h; r++, row++) for (let x = 0; x < w; x++) data[row * w + x] = dv.getFloat32(so[si] + (r * w + x) * 4, le); }
  let x0, y0, dx, dy; const M = tg[34264], S = tg[33550], P = tg[33922];
  if (M && M.length >= 8) { dx = M[0]; x0 = M[3]; dy = M[5]; y0 = M[7]; } else if (S && P) { dx = S[0]; dy = -S[1]; x0 = P[3]; y0 = P[4]; } else throw new Error('georef');
  return { w, h, data, x0, y0, dx, dy };
}
const wcsUrl = (b, interp = 'bilinear') => WCS + '?service=wcs&version=1.0.0&request=getcoverage&coverage=emodnet:mean&crs=EPSG:4326&bbox=' + [b.w, b.s, b.e, b.n].join(',') + '&format=image/tiff&interpolation=' + interp + '&resx=' + CELL + '&resy=' + CELL;
const tmo = (ms) => { try { return AbortSignal.timeout(ms); } catch (e) { return undefined; } };
/* το WCS μπορεί να δίνει υψόμετρο (θάλασσα < 0) ή βάθος (θάλασσα > 0): ένα σημείο βαθιάς θάλασσας νότια της Κύπρου το ξεκαθαρίζει (όπως η εφαρμογή) */
async function dSign(F) {
  if (mem.dsign) return mem.dsign;
  const r = await F(wcsUrl({ w: 33.19, s: 34.19, e: 33.21, n: 34.21 }, 'nearest'), { signal: tmo(12000) }); if (!r.ok) throw new Error('wcs ' + r.status);
  const g = parseTiff(await r.arrayBuffer()); let sum = 0; for (const v of g.data) sum += v; mem.dsign = sum < 0 ? -1 : 1; return mem.dsign;
}
function distM(a1, o1, a2, o2) { const R = 6371000, dl = (a2 - a1) * Math.PI / 180, dn = (o2 - o1) * Math.PI / 180, x = Math.sin(dl / 2) ** 2 + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
/* ίδιος τύπος με το corrAt της εφαρμογής (v4/troll.js): σταθμισμένος μέσος των διορθώσεων ως 2 km, που σβήνει μακριά από τις μετρήσεις */
export function corrAt(cs, lat, lon) { let sw = 0, sv = 0; for (const c of cs) { const d = distM(lat, lon, c[0], c[1]); if (d > 2000) continue; const w = 1 / Math.max(d, 60) ** 2; sw += w; sv += w * c[2]; }
  if (!sw) return 0; return sv / sw * Math.min(1, sw * 300 ** 2); }
export async function depthGrid(F, lat, lon, cs = [], rad = 1300) {
  const dla = rad / 111320, dlo = rad / (111320 * Math.cos(lat * Math.PI / 180));
  const b = { w: +(lon - dlo).toFixed(4), e: +(lon + dlo).toFixed(4), s: +(lat - dla).toFixed(4), n: +(lat + dla).toFixed(4) };
  const sg = await dSign(F);
  const r = await F(wcsUrl(b), { signal: tmo(12000) }); if (!r.ok) throw new Error('wcs ' + r.status);
  const g = parseTiff(await r.arrayBuffer());
  const x0 = g.x0 + g.dx / 2, y0 = g.y0 + g.dy / 2, ddy = -g.dy, d = new Array(g.w * g.h);
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { let v = g.data[j * g.w + i] * sg;
    if (!(v > 0) || v > 6000) { d[j * g.w + i] = 0; continue; }
    if (cs.length) v = Math.max(1, v + corrAt(cs, y0 - j * ddy, x0 + i * g.dx));
    d[j * g.w + i] = Math.round(v); }
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  return { ok: 1, x0: r6(x0), y0: r6(y0), dx: r6(g.dx), dy: r6(ddy), w: g.w, h: g.h, d, c: cs.length ? 1 : 0 };
}

/* 1.9.75: τα 4 είδη που πιάνεις πιο συχνά στη συρτή, συμπληρωμένα με τα γενικά: rows = [{sp, tech, w, m}] */
export function trollSpecies(rows) {
  const top = (rr) => { const c = new Map(); rr.forEach(x => { const n = String(x.sp || '').trim(); if (n && x.m !== 'true') c.set(n, (c.get(n) || 0) + 1); }); return [...c.entries()].sort((p, q) => q[1] - p[1]).map(e => e[0].slice(0, 30)); };   /* 1.9.93: 30 (με 18 έκοβε «Silver-cheeked toadfish»· το ρολόι μικραίνει τα γράμματα) */
  const tr = top(rows.filter(x => x.w || /συρτ|troll/i.test(String(x.tech || '')))), al = top(rows);
  return [...tr, ...al.filter(n => !tr.includes(n))].slice(0, 4);
}
/* 1.9.77: τα σημεία όπου έπιασες ψάρι με συρτή, ως 20 km από τη βάρκα (τα 40 κοντινότερα): [lat, lon, μολύβια|null, βυθός οργ.|null] */
export function trollSpots(rows, lat, lon) {
  return rows.filter(x => x.m !== 'true' && (x.w || /συρτ|troll/i.test(String(x.tech || ''))) && Number.isFinite(+x.la) && Number.isFinite(+x.lo) && (Math.abs(+x.la) > 0.01 || Math.abs(+x.lo) > 0.01))
    .map(x => ({ la: +x.la, lo: +x.lo, w: x.w && typeof x.w === 'object' ? x.w : {}, d: distM(lat, lon, +x.la, +x.lo) })).filter(x => x.d < 20000)
    .sort((p, q) => p.d - q.d).slice(0, 40)
    .map(x => [Math.round(x.la * 1e5) / 1e5, Math.round(x.lo * 1e5) / 1e5, Number.isFinite(+x.w.n) && +x.w.n > 0 ? Math.round(+x.w.n) : null, Number.isFinite(+x.w.bd) && +x.w.bd > 0 ? Math.round(+x.w.bd) : null]);
}
export async function handle(req, F = fetch, now = Date.now()) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url), q = u.searchParams, ip = ipOf(req);
  const user = async (code) => { const v = await userOf(F, code, now, ip).catch(() => null); return v && v.limited ? null : v; };
  try {
    if (req.method === 'GET') {
      const lat = parseFloat(q.get('lat')), lon = parseFloat(q.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return J({ ok: 0, err: 'pos' }, 400);
      if (q.get('grid') === '1') {   // 1.9.72: χάρτης βυθού για το ρολόι
        let cs = [];
        if (q.get('code')) { const us = await user(q.get('code'));
          if (us) try { const r = await sb(F, 'records?user_id=eq.' + us.user_id + '&kind=eq.settings&id=eq.main&select=data&limit=1'); const a = r.ok ? await r.json() : [];
            const dc = a && a[0] && a[0].data ? a[0].data['alkyon-dcorr'] : null; if (Array.isArray(dc)) cs = dc.filter(c => Array.isArray(c) && Number.isFinite(+c[0]) && Number.isFinite(+c[1]) && Number.isFinite(+c[2]) && Math.abs(+c[2]) <= 60 && distM(lat, lon, +c[0], +c[1]) < 4000).map(c => [+c[0], +c[1], +c[2]]); } catch (e) {} }
        const gk = 'g' + lat.toFixed(3) + ',' + lon.toFixed(3) + ':' + JSON.stringify(cs).length + ':' + cs.length;
        const gh = mem.fc.get(gk); if (gh && now - gh.at < 6 * 3600e3) return J(gh.v, 200, 'private, max-age=3600');
        const v = await depthGrid(F, lat, lon, cs); mem.fc.set(gk, { at: now, v });
        return J(v, 200, 'private, max-age=3600');
      }
      let en = q.get('lang') === 'en', lim = null, us = null;
      if (q.get('code')) { us = await user(q.get('code')); if (us && us.lang && !q.get('lang')) en = us.lang === 'en'; }   // η γλώσσα του ρολογιού (lang) έχει προτεραιότητα
      const key = lat.toFixed(2) + ',' + lon.toFixed(2) + (en ? 'e' : 'g') + JSON.stringify(lim || '');
      const bg = q.get('bg') === '1';   // από το παρασκήνιο του ρολογιού: μόνο οι καμπές πίεσης (λίγη μνήμη)
      const small = (v) => bg ? { ok: 1, tn: v.tn || [], p: v.now ? v.now.p : null, s: v.days && v.days[0] ? v.days[0].s : null, w: v.days && v.days[0] ? v.days[0].w : '', bw: v.bw || null } : v;
      /* 1.2.0: ώρα επιστροφής από το πλάνο εξόδου του κινητού (αν υπάρχει ενεργό), για το δαχτυλίδι της εξόδου στο ρολόι */
      const withDue = async (v) => { if (bg || !us) return v; let o = v;
        try { const r = await sb(F, 'safety_trips?user_id=eq.' + us.user_id + '&status=eq.active&select=due_at&order=due_at.desc&limit=1'); const a = r.ok ? await r.json() : [];
          const ms = a && a[0] ? Date.parse(a[0].due_at) : NaN; if (Number.isFinite(ms) && ms > now - 12 * 3600e3) o = { ...o, due: Math.round(ms / 1000) }; } catch (e) {}
        /* 1.2.2: τα 12 κοντινότερα αποθηκευμένα σημεία του χρήστη, για τη σελίδα «Σημείο» του ρολογιού: [όνομα, lat, lon] */
        try { const r = await sb(F, 'records?user_id=eq.' + us.user_id + '&kind=eq.spots&deleted=eq.false&select=data&limit=500'); const a = r.ok ? await r.json() : [];
          const d2 = (x) => (x.lat - lat) ** 2 + ((x.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2;
          const sp = (a || []).map(x => x && x.data).filter(x => x && Number.isFinite(+x.lat) && Number.isFinite(+x.lon) && !x.deleted).map(x => ({ n: String(x.name || '').slice(0, 20), lat: +x.lat, lon: +x.lon }))
            .sort((p, q) => d2(p) - d2(q)).slice(0, 12).map(x => [x.n, Math.round(x.lat * 1e5) / 1e5, Math.round(x.lon * 1e5) / 1e5]);
          if (sp.length && !en) { const M = await elNames(F, now); sp.forEach(x => { x[0] = elName(M, x[0]).slice(0, 20); }); }   /* 1.10.10: «Map point» → «Σημείο χάρτη» */
          if (sp.length) o = { ...o, sp }; } catch (e) {}
        /* 1.9.75: τα 4 είδη που πιάνεις πιο συχνά στη συρτή (αλλιώς γενικά), για την επιλογή είδους στο ρολόι */
        try { const r = await sb(F, 'records?user_id=eq.' + us.user_id + '&kind=eq.bites&deleted=eq.false&select=sp:data->>species,tech:data->>tech,w:data->wtr,m:data->>miss,la:data->>lat,lo:data->>lon&order=updated_at.desc&limit=1500'); const a = r.ok ? await r.json() : [];
          const tsp = trollSpecies(a || []); if (tsp.length) o = { ...o, tsp }; if (tsp.length && !en) { const M = await elNames(F, now); const tspl = tsp.map(n => elName(M, n)); if (tspl.some((x, i) => x !== tsp[i])) o = { ...o, tspl }; }   /* 1.10.10: όνομα στη γλώσσα του ρολογιού, η τιμή μένει ίδια */
          const tc = trollSpots(a || [], lat, lon); if (tc.length) o = { ...o, tc }; } catch (e) {}
        return o; };
      const hit = mem.fc.get(key); if (hit && now - hit.at < 30 * 60e3) return J(small(await withDue(hit.v)), 200, 'private, max-age=300');
      const PF = await loadPF(F, now);
      const fc = await PF.getForecast(lat, lon, F, { days: 6 });
      const v = compact(PF, fc, en, lat, lon); mem.fc.set(key, { at: now, v }); if (mem.fc.size > 300) mem.fc.clear();
      return J(small(await withDue(v)), 200, 'private, max-age=300');
    }
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      const us0 = await userOf(F, b.code, now, ip); if (us0 && us0.limited) return J({ ok: 0, err: 'rate' }, 429);
      const us = us0; if (!us) return J({ ok: 0, err: 'code' }, 403);
      const t0 = Number.isFinite(+b.t) ? +b.t : Number.isFinite(+b.ts) ? +b.ts * 1000 : NaN;   // το ρολόι στέλνει ts σε δευτερόλεπτα
      const t = t0 > 1.5e12 && t0 < now + 600e3 ? t0 : now;
      const tripId = (v) => String(v || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
      /* 1.1.0: έξοδος από το ρολόι (δραστηριότητα «Ψάρεμα»): αρχή/τέλος, διαδρομή, πόσα ψάρια → μία έξοδος στο Ημερολόγιο */
      if (b.kind === 'trip') {
        const tz = Number.isFinite(+b.tz) ? +b.tz : null;
        const s0 = Number.isFinite(+b.ts) ? +b.ts * 1000 : NaN, e0 = Number.isFinite(+b.te) ? +b.te * 1000 : now;
        if (!(s0 > 1.5e12) || e0 < s0 || e0 - s0 > 36 * 3600e3) return J({ ok: 0, err: 'time' }, 400);
        const pts = (Array.isArray(b.pts) ? b.pts : []).filter(p => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) && Math.abs(+p[0]) <= 90 && Math.abs(+p[1]) <= 180 && (Math.abs(+p[0]) > 0.01 || Math.abs(+p[1]) > 0.01))
          .slice(0, 1000).map(p => [Math.round(+p[0] * 1e5) / 1e5, Math.round(+p[1] * 1e5) / 1e5, Number.isFinite(+p[2]) ? +p[2] * 1000 : null]);
        let km = 0; for (let i = 1; i < pts.length; i++) { const [a, c] = [pts[i - 1], pts[i]], R = 6371, dl = (c[0] - a[0]) * Math.PI / 180, dn = (c[1] - a[1]) * Math.PI / 180, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(c[0] * Math.PI / 180) * Math.sin(dn / 2) ** 2; km += 2 * R * Math.asin(Math.sqrt(x)); }
        const lp = localParts(s0, tz != null ? tz : tzOf(s0)), en = us.lang === 'en', tid = tripId(b.tid) || rid(), mid = pts.length ? pts[Math.floor(pts.length / 2)] : null;
        const n = Math.max(0, Math.min(999, Math.floor(+b.n) || 0));
        const data = { id: tid, sid: tid, date: lp.date, spot: '', tech: '', species: '', count: n, kg: 0, startMs: s0, endMs: e0, km: Math.round(km * 10) / 10, track: pts, lat: mid ? mid[0] : null, lon: mid ? mid[1] : null,
          notes: recNote(en, b.dev), src: 'watch', _u: now };
        const r = await sb(F, 'records', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ user_id: us.user_id, kind: 'trips', id: tid, data, deleted: false, updated_at: new Date(now).toISOString() }]) });
        if (!r.ok && r.status !== 409) return J({ ok: 0, err: 'db ' + r.status, detail: (await r.text()).slice(0, 200) }, 502);
        return J({ ok: 1, id: tid });   // 409 = υπάρχει ήδη (το ρολόι το ξανάστειλε)
      }
      /* 1.10.4: δίχτυ / παραγάδι / κλουβί από το ρολόι. st 'out' = ρίχτηκε (φαίνεται «Στη θάλασσα» στην εφαρμογή), 'done' = ανέβηκε με n ψάρια.
         Γράφει το εργαλείο (kind 'gear', το παίρνει η εφαρμογή στα Εργαλεία) και, στο ανέβασμα, μία έξοδο και τα ψάρια (όπως η «Παλιά ρίψη» της εφαρμογής). */
      if (b.kind === 'gear') {
        const gid = tripId(b.gid); if (!gid) return J({ ok: 0, err: 'gid' }, 400);
        const en = us.lang === 'en', type = ['net', 'll', 'trap'].includes(b.gt) ? b.gt : 'net';
        const TN = { net: en ? 'Net' : 'Δίχτυ', ll: en ? 'Longline' : 'Παραγάδι', trap: en ? 'Pot' : 'Κλουβί' };
        const pt = (v) => Array.isArray(v) && Number.isFinite(+v[0]) && Number.isFinite(+v[1]) && Math.abs(+v[0]) <= 90 && Math.abs(+v[1]) <= 180 && (Math.abs(+v[0]) > 0.01 || Math.abs(+v[1]) > 0.01) ? [Math.round(+v[0] * 1e5) / 1e5, Math.round(+v[1] * 1e5) / 1e5] : null;
        const ms = (v) => Number.isFinite(+v) && +v > 1.5e9 && +v * 1000 < now + 600e3 ? +v * 1000 : null;
        const sa = pt(b.sa), sB = pt(b.sb) || sa, s0 = ms(b.s0), s1 = ms(b.s1) || s0, ha = pt(b.ha), hb = pt(b.hb) || ha, h0 = ms(b.h0), h1 = ms(b.h1) || h0;
        const done = b.gst === 'done' && h0 != null, name = String(b.gnm || '').trim().slice(0, 30) || TN[type];
        if (done && s0 != null && h1 < s0) return J({ ok: 0, err: 'time' }, 400);
        const it = { id: gid, type, name, state: done ? 'done' : 'out', src: 'watch',
          set: { a: sa, ta: s0, tb: s1, b: sB, pts: [sa, sB].filter(Boolean), ...(s0 == null ? { unknown: true } : {}) },
          haul: done ? { a: ha, ta: h0, tb: h1, b: hb, pts: [ha, hb].filter(Boolean) } : null, ...(done ? { done: h1 } : {}), _u: now };
        const rows = [{ user_id: us.user_id, kind: 'gear', id: gid, data: it, deleted: false, updated_at: new Date(now).toISOString() }];
        if (done) {
          const n = Math.max(0, Math.min(999, Math.floor(+b.n) || 0)), sid = 'g' + gid, tz = Number.isFinite(+b.tz) ? +b.tz : tzOf(h1), hp = localParts(h1, tz), sp0 = localParts(s0 != null ? s0 : h0, tz), pos = hb || ha || sB || sa;
          if (n > 0) rows.push({ user_id: us.user_id, kind: 'bites', id: 'b' + gid, data: { id: 'b' + gid, date: hp.date, time: hp.time, species: '', latin: '', bait: '', tech: TN[type], depth: null, kg: null, len: null, cnt: n, notes: '', place: '',
            lat: pos ? pos[0] : null, lon: pos ? pos[1] : null, photo: false, src: 'watch', prof: 'boat', gear: gid, gearName: name, trip: sid, _u: now }, deleted: false, updated_at: new Date(now).toISOString() });
          rows.push({ user_id: us.user_id, kind: 'trips', id: sid, data: { id: sid, sid, date: sp0.date, spot: name, prof: 'boat', tech: TN[type], species: '', count: n, kg: 0, startMs: s0 != null ? s0 : h0, endMs: h1,
            lat: pos ? pos[0] : null, lon: pos ? pos[1] : null, notes: recNote(en, b.dev), src: 'watch', manual: true, gear: [it], _u: now }, deleted: false, updated_at: new Date(now).toISOString() });
        }
        const r = await sb(F, 'records', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
        if (!r.ok) return J({ ok: 0, err: 'db ' + r.status, detail: (await r.text()).slice(0, 200) }, 502);
        return J({ ok: 1, id: gid });
      }
      /* 1.9.75: αναίρεση ή αλλαγή ψαριού από το ρολόι (οθόνη 6″ μετά το START στη συρτή): cid = ο κωδικός που έδωσε το ρολόι στο ψάρι */
      if (b.kind === 'undo' || b.kind === 'upd') {
        const cid = tripId(b.cid); if (!cid) return J({ ok: 0, err: 'cid' }, 400);
        const q = 'records?user_id=eq.' + us.user_id + '&kind=eq.bites&id=eq.' + cid;
        if (b.kind === 'undo') {
          /* 1.14.83: νέο _u στη διαγραφή, ώστε να κερδίζει καθαρά την προηγούμενη έκδοση σε κάθε κινητό */
          const g0 = await sb(F, q + '&select=data&limit=1'); const d0 = g0.ok ? await g0.json() : [];
          const r = await sb(F, q, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deleted: true, data: { ...((d0 && d0[0] && d0[0].data) || {}), _u: now }, updated_at: new Date(now).toISOString() }) });
          if (!r.ok) return J({ ok: 0, err: 'db ' + r.status }, 502);
          return J({ ok: 1, id: cid });
        }
        const r0 = await sb(F, q + '&select=data&limit=1'); const a0 = r0.ok ? await r0.json() : [];
        if (!a0 || !a0[0] || !a0[0].data) return J({ ok: 1, id: cid, skip: 1 });   // δεν υπάρχει (π.χ. σβήστηκε): τίποτα
        const d = { ...a0[0].data, _u: now };
        if (b.miss) { d.miss = true; d.species = ''; d.latin = ''; delete d.cnt; }
        if (typeof b.sp === 'string' && b.sp.trim()) { d.species = b.sp.trim().slice(0, 40); delete d.miss; }
        const r = await sb(F, q, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ data: d, updated_at: new Date(now).toISOString() }) });
        if (!r.ok) return J({ ok: 0, err: 'db ' + r.status }, 502);
        return J({ ok: 1, id: cid });
      }
      const kind = b.kind === 'miss' ? 'miss' : b.kind === 'pest' ? 'pest' : 'fish';
      const lp = localParts(t, Number.isFinite(+b.tz) ? +b.tz : tzOf(t)), en = us.lang === 'en';
      const lat = Number.isFinite(+b.lat) && Math.abs(+b.lat) > 0.01 ? Math.round(+b.lat * 1e5) / 1e5 : null, lon = Number.isFinite(+b.lon) && Math.abs(+b.lon) > 0.01 ? Math.round(+b.lon * 1e5) / 1e5 : null;
      const id = tripId(b.cid) || rid();   // 1.9.75: ο κωδικός του ρολογιού, για αναίρεση/αλλαγή αργότερα
      const data = { id, date: lp.date, time: lp.time, species: kind === 'pest' ? (en ? 'Silver-cheeked toadfish' : 'Λαγοκέφαλος') : '', latin: kind === 'pest' ? 'Lagocephalus sceleratus' : '', bait: '', tech: '', depth: null, kg: null, len: null,
        notes: '', place: '', lat, lon, photo: false, src: 'watch', _u: now, ...(kind === 'miss' ? { miss: true } : {}), ...(kind === 'pest' ? { pest: true } : {}), ...(Math.floor(+b.n) > 1 && Math.floor(+b.n) < 100 ? { cnt: Math.floor(+b.n) } : {}), ...(tripId(b.trip) ? { trip: tripId(b.trip) } : {}), ...(kind === 'fish' && b.tr && typeof b.tr === 'object' ? { wtr: { m: b.tr.m === 'b' ? 'bottom' : 'surface', kn: Number.isFinite(+b.tr.kn) ? Math.round(+b.tr.kn * 10) / 10 : null, hd: Number.isFinite(+b.tr.hd) ? Math.round(+b.tr.hd) : null, n: Number.isFinite(+b.tr.n) && +b.tr.n > 0 && +b.tr.n < 100 ? Math.round(+b.tr.n) : null, ln: Number.isFinite(+b.tr.ln) && +b.tr.ln > 0 && +b.tr.ln < 400 ? Math.round(+b.tr.ln) : null, bd: Number.isFinite(+b.tr.bd) && +b.tr.bd > 0 && +b.tr.bd < 500 ? Math.round(+b.tr.bd * 10) / 10 : null, cl: Number.isFinite(+b.tr.cl) && Math.abs(+b.tr.cl) < 100 ? Math.round(+b.tr.cl * 10) / 10 : null } } : {}) }; /* 1.6.4: συρτή από το ρολόι */
      const r = await sb(F, 'records', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ user_id: us.user_id, kind: 'bites', id, data, deleted: false, updated_at: new Date(now).toISOString() }]) });
      if (!r.ok && r.status !== 409) return J({ ok: 0, err: 'db ' + r.status, detail: (await r.text()).slice(0, 200) }, 502);   // 409 = το ρολόι το ξανάστειλε
      return J({ ok: 1, id, time: lp.time });
    }
    return J({ ok: 0, err: 'method' }, 405);
  } catch (e) { return J({ ok: 0, err: String(e && e.message || e) }, 502); }
}
if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(req => handle(req));
