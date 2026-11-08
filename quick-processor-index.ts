// @ts-nocheck
// Alkyon cron: forecast push, ασφάλεια εξόδων (Telegram), πτώση πίεσης. Παράγεται από build_edge.py. Μην το επεξεργάζεσαι στο χέρι.
import webpush from 'npm:web-push@3.6.7';

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
      wave:(()=>{ const lw=localWave(mm,ws,nn(at('wind_direction_10m',i))); return lw!=null?lw:nn(mm.wave); })(),waveOff:localWave(mm,ws,nn(at('wind_direction_10m',i)))!=null?nn(mm.wave):null,period:nn(mm.period),sst:nn(mm.sst),tide:tideAt(t),ptrend:(p!=null&&p0!=null)?ptrendOf(p-p0):'stable',cloud:c==null?'part':c<20?'clear':c<70?'part':'over'});
  }
  const num=a=>a.filter(v=>typeof v==='number'), av=a=>{a=num(a);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}, mx=a=>{a=num(a);return a.length?Math.max(...a):null;}, mn=a=>{a=num(a);return a.length?Math.min(...a):null;};
  const days=[], past=[], dks=Object.keys(byDay).sort();
  for(const date of dks.filter(x=>x<today).concat(dks.filter(x=>x>=today).slice(0,nd))){
    const zn=(typeof w.value.timezone==='string')?w.value.timezone:null, tzd=zn?nicOffAt(date,tz,zn):(tz===120||tz===180)?nicOffAt(date,tz):tz, sm=sunMoon(date,lat,lon,tzd), rows=byDay[date];
    const hours=rows.map(h=>({t:h.t,hr:h.hr,p:h.p,pres:h.pres,wind:h.wind,wave:h.wave,waveOff:h.waveOff,gust:h.gust,code:h.code,ptrend:h.ptrend,tide:h.tide,dir:h.dir,temp:h.temp,rain:h.rain,cloud:h.cloud,sst:h.sst,period:h.period,score:hourScore(sm,h.hr,opt&&opt.sp?Object.assign({sp:opt.sp},h):h),bite:hourScore(sm,h.hr,Object.assign(opt&&opt.sp?{sp:opt.sp}:{},h,{bite:true})),safe:safeHour(h)}));
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
  return {days,past,tz,nowLocal,wl};
}
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
  const thr=cfg.threshold||75, notified=Object.assign({},cfg.notified||{}), goods=[], press=[], winds=[], turns=[], changes=[], eves=[]; let nextGood=null, todayGood=null, tmrGood=null; const errs=[]; let okN=0;
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
      for(const g of goodDays(fc,thr)){ if(g.date===fc.nowLocal.slice(0,10)&&g.win&&g.win.e>=+fc.nowLocal.slice(11,13)&&(!todayGood||g.best>todayGood.best)) todayGood={place:p.name,date:g.date,best:g.best,win:g.win}; /* 1.1.0: πρωινό μήνυμα */ { const tm=new Date(Date.parse(fc.nowLocal.slice(0,10)+'T12:00:00Z')+864e5).toISOString().slice(0,10); if(g.date===tm&&g.win&&(!tmrGood||g.best>tmrGood.best)) tmrGood={place:p.name,pid:p.id,date:g.date,best:g.best,win:g.win}; } /* 1.1.2: βραδινό μήνυμα για αύριο */ if(g.date>fc.nowLocal.slice(0,10)&&(!nextGood||g.date<nextGood.date||(g.date===nextGood.date&&g.best>nextGood.best))) nextGood={place:p.name,date:g.date,best:g.best,win:g.win}; const key=p.id+':'+g.date; if(notified[key]) continue; let why=''; try{ why=whyGood(g.d,g.win,en); }catch(e){} goods.push({type:'good',place:p,key,date:g.date,best:g.best,win:g.win,wind:g.wind,why}); }
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
  return {nextGood,todayGood,tmrGood,items,notified,title,body:lines.concat(pl,tl,wl).join('\n'),msgs,area:area?{name:area.name,lat:area.lat,lon:area.lon}:null,errs,okN,goodsN:goods.length,pressN:press.length,turnsN:turns.length,windsN:winds.length};
}
g.PF={darkTxt,darkWin,squidEves,nextMoon,moonInfo,lims,moonAlt,moonEvents,moonPhase,solunarPeriods,pressureRise,sunMoon,hourScore,getForecast,findIdeal,message,check,goodDays,checkPlaces,dayLabel,bft,pressureEvent,windEvent,pressureTurns,pressureOutlook};
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
  const STEP_ERR = /^(Telegram updates|Telegram send|Email send|Telegram ping|port note decide|port notes|weekly|morning|Forecast job|Πίεση|Πίεση Telegram|Πίεση \(Open-Meteo\)|community push|squid|squid fc|squid notif_log|Καιρός εξόδου)$/;
  log = m => { log0(m); const t = String(m), k = t.split(':')[0].trim(); if (STEP_ERR.test(k)) ERRS.push({ k, m: t.slice(0, 300) }); };
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
      if (postsAll.length || likes.length || coms.length) {
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
    if (webpush && new Date().getUTCMinutes() % 15 < 5) {
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
    }
  } catch (e) { log('Καιρός εξόδου: ' + e.message); }
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
        if (!(E('VAPID_PUBLIC') && E('VAPID_PRIVATE'))) return J({ ok: false, error: 'VAPID secrets missing' });
        if (!vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', V('VAPID_PUBLIC'), V('VAPID_PRIVATE')); vapidSet = true; }
        const sr = await fetch(env.SUPABASE_URL + '/rest/v1/push_subs?user_id=eq.' + encodeURIComponent(uid) + '&select=id,sub,checked_at,turn', { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY } });
        const subs = sr.ok ? await sr.json() : [];
        let sent = 0, gone = 0, err = '';
        const at = new Date().toISOString();
        for (const r of subs || []) {
          try { await webpush.sendNotification(r.sub, JSON.stringify({ title: 'Alkyon ✓', body: body.lang === 'en' ? 'Test notification from the server. Alerts reach this phone.' : 'Δοκιμαστική ειδοποίηση από τον server. Οι ειδοποιήσεις φτάνουν σε αυτό το κινητό.', kind: 'test', id: 'test-' + at, tag: 'alk-test', at }), { TTL: 600 }); sent++; }
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
        if (!(E('VAPID_PUBLIC') && E('VAPID_PRIVATE'))) return J({ ok: false, error: 'VAPID secrets missing' });
        if (!vapidSet) { webpush.setVapidDetails('https://dinospapani.github.io/Alkyon/', E('VAPID_PUBLIC'), E('VAPID_PRIVATE')); vapidSet = true; }
        const r = await run({ env, PF, webpush, sendMail: null, log: m => console.log(String(m)), only: { comm: true } });
        return J({ ok: true, stats: r.stats });
      } catch (e) { return J({ ok: false, error: e.message }, 500); }
    }
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
    const r = await run({ env, PF, webpush: wp, sendMail: null, log: m => { logs.push(String(m)); console.log(m); } });
    return new Response(JSON.stringify({ ok: r.ok, stats: r.stats, logs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.log('cron error: ' + e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message, logs }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
