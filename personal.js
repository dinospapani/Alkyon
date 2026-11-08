/* Προσωπική πρόγνωση: μαθαίνει από τις έξοδες (ώρες ψαρέματος) και τα τσιμπήματα του χρήστη.
   Καθαρές συναρτήσεις, χωρίς DOM· δουλεύει και σε node.
   v31z365: κάθε έξοδος μοιράζεται σε κομμάτια 10 λεπτών, το καθένα με τις δικές του συνθήκες:
   - φως (νύχτα, αυγή, πρωί, μεσημέρι, απόγευμα, σούρουπο) σε σχέση με την ανατολή/δύση εκείνης της μέρας, όχι με το ρολόι
   - σελήνη, πίεση και άνεμος της ώρας (condH από το Open-Meteo, αλλιώς οι συνθήκες της αρχής)
   - ο χρόνος πλεύσης (GPS πάνω από ~9 κόμβους, s.moving) δεν μετρά ως ψάρεμα· το τρόλινγκ (κάτω από 9 κόμβους) μετρά
   Και έλεγχος: προβλέπει το μοντέλο τις εξόδους που δεν είδε καλύτερα από τον μέσο όρο; (validate) */
(function(g){
'use strict';
const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14), K=4;           // K = «εικονικές» ώρες πριν εμπιστευτούμε τα δεδομένα
const NEED={hours:15,sessions:6,catches:10};
const ADV={sessions:50};                                              // από εδώ και πάνω έχει νόημα πιο προχωρημένη ανάλυση
const moonOf=ms=>{let a=((ms-REF)/86400000)%SYN; if(a<0)a+=SYN; return Math.floor(a/SYN*4+0.5)%4;};
const windCls=w=>w==null||isNaN(w)?null:w<8?0:w<=14?1:2;
const PTS=['fast','slow','stable','rise'];
const biteMs=(b,utcMin)=>{ if(!b||!b.date||!b.time) return null; const [y,m,d]=b.date.split('-').map(Number), [hh,mm]=b.time.split(':').map(Number); return Date.UTC(y,m-1,d,hh,mm)-utcMin*60000; };
function sessionsOf(trips){ return (trips||[]).filter(t=>t&&t.startMs&&t.endMs&&t.endMs>t.startMs&&(t.endMs-t.startMs)>=10*60000&&(t.endMs-t.startMs)<=16*3600000); }
/* φως: 0 νύχτα, 1 αυγή (ανατολή ±90′), 2 πρωί, 3 μεσημέρι (μέσο της μέρας ±60′), 4 απόγευμα, 5 σούρουπο (δύση ±90′) */
const LV={block:6,moon:4,ptrend:4,wind:3};
function phaseOf(m,rise,set){
  if(rise==null||set==null){ rise=360; set=1080; }
  m=((m%1440)+1440)%1440; const noon=(rise+set)/2;
  if(Math.abs(m-rise)<=90) return 1; if(Math.abs(m-set)<=90) return 5;
  if(m<rise-90||m>set+90) return 0;
  if(Math.abs(m-noon)<=60) return 3;
  return m<noon?2:4;
}
const sunCache={};
function sunTimes(dateStr,lat,lon,tzMin){
  if(lat==null||lon==null||!(g.PF&&g.PF.sunMoon)) return {rise:360,set:1080};
  const k=dateStr+'|'+(+lat).toFixed(1)+'|'+(+lon).toFixed(1)+'|'+tzMin; if(sunCache[k]) return sunCache[k];
  try{ const s=g.PF.sunMoon(dateStr,+lat,+lon,tzMin); return (sunCache[k]={rise:s.rise,set:s.set}); }catch(e){ return {rise:360,set:1080}; }
}
/* φάση φωτός για μια στιγμή (ms) σε μια θέση */
function phaseAt(ms,lat,lon,utcMin){ const loc=new Date(ms+utcMin*60000), ds=loc.toISOString().slice(0,10), st=sunTimes(ds,lat,lon,utcMin); return phaseOf(loc.getUTCHours()*60+loc.getUTCMinutes(),st.rise,st.set); }
const MOVE_KN=9;
/* μία έξοδος → κομμάτια 10 λεπτών με τις συνθήκες τους, και τα τσιμπήματα με τις δικές τους */
function prepOne(s,bites,misses,utcMin){
  const lat=s.lat!=null?s.lat:(s.cond0&&s.cond0.lat), lon=s.lon!=null?s.lon:(s.cond0&&s.cond0.lon);
  const win=x=>x.ms!=null&&x.ms>=s.startMs-600000&&x.ms<=s.endMs+600000;
  const inS=s.manual?[]:(bites||[]).map(b=>({b,ms:biteMs(b,utcMin)})).filter(win);
  const inM=s.manual?[]:(misses||[]).map(b=>({b,ms:biteMs(b,utcMin)})).filter(win);
  const cH={}; if(Array.isArray(s.condH)) s.condH.forEach(r=>{ if(Array.isArray(r)) cH[r[0]]={pt:r[1],w:r[2]}; });
  const cd0=s.cond0||{}, hasH=!s.manual&&Object.keys(cH).length>0;
  const cond=ms=>{ const r=hasH?cH[Math.floor(ms/3600000)]:null; return r?{ptrend:r.pt,wind:windCls(r.w)}:{ptrend:PTS.indexOf(cd0.ptrend),wind:windCls(cd0.wind)}; };
  const ev=inS.concat(inM).map(x=>{ const ms=Math.min(Math.max(x.ms,s.startMs),s.endMs-1), q=cond(ms), bp=PTS.indexOf(x.b.ptrend), bw=windCls(x.b.wind!=null?+x.b.wind:null);
    return {ms,f:{block:phaseAt(ms,lat,lon,utcMin),moon:moonOf(ms),ptrend:bp>=0?bp:q.ptrend,wind:bw!=null?bw:q.wind}}; });
  const mv=Array.isArray(s.moving)?s.moving.filter(m=>Array.isArray(m)&&!ev.some(e=>e.ms>=m[0]&&e.ms<=m[1])):[]; /* πλεύση χωρίς τσίμπημα */
  const sl=[]; let hrs=0, mvH=0;
  for(let t=s.startMs;t<s.endMs;t+=600000){ const dh=Math.min(600000,s.endMs-t)/3600000, mid=t+dh*1800000;
    if(mv.some(m=>mid>=m[0]&&mid<=m[1])){ mvH+=dh; continue; }
    const q=cond(mid); sl.push({dh,f:{block:phaseAt(mid,lat,lon,utcMin),moon:moonOf(mid),ptrend:q.ptrend,wind:q.wind}}); hrs+=dh; }
  const manualC=s.manual?Math.max(0,+s.count||0):0;
  return {id:s.id,manual:!!s.manual,sl,ev,hrs,mvH,catches:s.manual?manualC:inS.length,bitesAll:s.manual?manualC:ev.length};
}
function prepare(trips,bites,opt){ const utcMin=(opt&&opt.utcMin)||0; return sessionsOf(trips).map(s=>prepOne(s,bites,opt&&opt.misses,utcMin)); }
function aggregate(P){
  const T={}; for(const k in LV) T[k]=Array.from({length:LV[k]},()=>({h:0,c:0}));
  let H=0,C=0,CA=0,MV=0;
  for(const p of P){
    H+=p.hrs; C+=p.catches; CA+=p.bitesAll; MV+=p.mvH;
    for(const x of p.sl) for(const k in LV){ const i=x.f[k]; if(i!=null&&i>=0) T[k][i].h+=x.dh; }
    if(p.manual){ if(p.hrs>0) for(const x of p.sl) for(const k in LV){ const i=x.f[k]; if(i!=null&&i>=0) T[k][i].c+=p.bitesAll*x.dh/p.hrs; } }
    else for(const e of p.ev) for(const k in LV){ const i=e.f[k]; if(i!=null&&i>=0) T[k][i].c++; }
  }
  return {T,H,C,CA,MV,S:P.length};
}
function factorsOf(A){
  const r0=A.H>0?A.CA/A.H:0, factors={};
  for(const k in A.T) factors[k]=A.T[k].map((x,i)=>{ const rate=(x.c+K*r0)/(x.h+K); return {i,h:x.h,c:x.c,rate:x.h?x.c/x.h:null,m:r0>0?rate/r0:1}; });
  return {r0,factors};
}
/* αναμενόμενα τσιμπήματα σε μια έξοδο με ένα μοντέλο (ρυθμός × πολλαπλασιαστές κάθε συνθήκης) */
function expected(M,p){ let mu=0; for(const x of p.sl){ let m=1; for(const k in LV){ const i=x.f[k]; if(i!=null&&i>=0&&M.factors[k][i]) m*=M.factors[k][i].m; } mu+=x.dh*M.r0*m; } return mu; }
function dev(y,mu){ mu=Math.max(mu,1e-6); return 2*((y>0?y*Math.log(y/mu):0)-(y-mu)); }
/* έλεγχος σε εξόδους που το μοντέλο δεν είδε (5 ομάδες): απόκλιση Poisson μοντέλου και απλού μέσου όρου. gain>0 = καλύτερο από τον μέσο όρο. */
function validate(P){
  const Q=P.filter(p=>!p.manual&&p.hrs>0.2); if(Q.length<10) return null;
  const F=5; let dM=0,dB=0;
  for(let f=0;f<F;f++){
    const tr=Q.filter((_,i)=>i%F!==f), te=Q.filter((_,i)=>i%F===f); if(!te.length||!tr.length) continue;
    const A=aggregate(tr), M=factorsOf(A); if(!(M.r0>0)) continue;
    for(const p of te){ dM+=dev(p.bitesAll,expected(M,p)); dB+=dev(p.bitesAll,p.hrs*M.r0); }
  }
  if(!(dB>0)) return {n:Q.length,devModel:dM,devBase:dB,gain:0}; /* ο μέσος όρος εξηγεί ήδη τα πάντα: τίποτα να κερδίσει */
  return {n:Q.length,devModel:dM,devBase:dB,gain:(dB-dM)/dB};
}
function build(trips,bites,opt){
  const P=prepare(trips,bites,opt), A=aggregate(P), M=factorsOf(A);
  const progress={hours:A.H,sessions:A.S,catches:A.C,need:NEED,moving:A.MV,adv:ADV};
  const ready=A.H>=NEED.hours&&A.S>=NEED.sessions&&A.C>=NEED.catches;
  const v=ready?validate(P):null;
  return {r0:M.r0,factors:M.factors,progress,ready,H:A.H,C:A.C,S:A.S,valid:v,
    useful:ready&&(!v||v.gain>0), advReady:A.S>=ADV.sessions};
}
function score(model,x){
  if(!model||!model.ready) return null;
  let l=0; const F=model.factors;
  if(x.hr!=null) l+=Math.log(F.block[phaseOf(x.hr*60+30,x.rise,x.set)].m);
  if(x.f!=null) l+=Math.log(F.moon[Math.floor(x.f*4+0.5)%4].m);
  const pi=PTS.indexOf(x.ptrend); if(pi>=0) l+=Math.log(F.ptrend[pi].m);
  const wi=windCls(x.wind); if(wi!=null) l+=Math.log(F.wind[wi].m);
  return Math.max(5,Math.min(95,Math.round(50+38*Math.tanh(0.8*l))));
}
/* day = ημέρα του PF.getForecast (με day.f, day.rise, day.set). Επιστρέφει {best,win,hours} μόνο για ασφαλείς ώρες φωτός. */
function day(model,d,nowHourKey){
  if(!model||!model.ready) return null;
  const hours=d.hours.map(h=>({t:h.t,hr:h.hr,safe:h.safe,score:score(model,{hr:h.hr,rise:d.rise,set:d.set,f:d.f,ptrend:h.ptrend,wind:h.wind})}));
  const dl=h=>{const t=h.hr*60+30; return d.rise==null||(t>=d.rise-60&&t<=d.set+60);};
  const cand=hours.filter(h=>h.safe&&dl(h)&&(!nowHourKey||h.t>=nowHourKey));
  if(!cand.length) return {best:0,win:null,hours,safe:false};
  const best=Math.max(...cand.map(h=>h.score)), thr=best-6; let cur=null,groups=[];
  for(const h of hours){ if(cand.includes(h)&&h.score>=thr){ if(cur&&cur.e===h.hr-1) cur.e=h.hr; else {cur={s:h.hr,e:h.hr};groups.push(cur);} } }
  const win=groups.sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0]||null;
  return {best,win,hours,safe:true};
}
/* διαστήματα πλεύσης από μια διαδρομή GPS με χρόνους [[lat,lon,ms],…]: ταχύτητα πάνω από MOVE_KN για τουλάχιστον 2 λεπτά */
function movingFrom(pts){
  if(!Array.isArray(pts)||pts.length<2) return [];
  const R=6371000, r=Math.PI/180, d=(a,b)=>{ const dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r, x=Math.sin(dLa/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); };
  const out=[]; let cur=null;
  for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i], dt=(b[2]-a[2])/1000; if(!(dt>0)) continue;
    const kn=d(a,b)/dt*1.94384, fast=kn>=MOVE_KN&&dt<=30*60;
    if(fast){ if(cur&&a[2]-cur[1]<=3*60000) cur[1]=b[2]; else { cur=[a[2],b[2]]; out.push(cur); } } }
  return out.filter(m=>m[1]-m[0]>=2*60000);
}
/* v31z366: έλεγχος του γενικού βαθμού. Για εξόδους με scoreH (ο βαθμός που έδινε η εφαρμογή στην αρχή), τσιμπήματα ανά ώρα ψαρέματος
   σε τρεις ζώνες βαθμού: κάτω από 60, 60–79, 80 και πάνω. Η πλεύση (s.moving) δεν μετρά. */
const CB=[[0,60],[60,80],[80,101]];
function calib(trips,bites,opt){
  const utcMin=(opt&&opt.utcMin)||0, all=(bites||[]).concat((opt&&opt.misses)||[]), B=CB.map(r=>({lo:r[0],hi:r[1],h:0,c:0})); let n=0;
  for(const s of sessionsOf(trips)){
    if(s.manual||!Array.isArray(s.scoreH)||!s.scoreH.length) continue; const sc={}; s.scoreH.forEach(r=>{ if(Array.isArray(r)) sc[r[0]]=r[1]; });
    const bin=ms=>{ const v=sc[Math.floor(ms/3600000)]; if(v==null) return -1; return B.findIndex(b=>v>=b.lo&&v<b.hi); };
    const ev=all.map(b=>biteMs(b,utcMin)).filter(ms=>ms!=null&&ms>=s.startMs-600000&&ms<=s.endMs+600000);
    const mv=Array.isArray(s.moving)?s.moving.filter(m=>!ev.some(e=>e>=m[0]&&e<=m[1])):[]; let used=false;
    for(let t=s.startMs;t<s.endMs;t+=600000){ const dh=Math.min(600000,s.endMs-t)/3600000, mid=t+dh*1800000; if(mv.some(m=>mid>=m[0]&&mid<=m[1])) continue; const i=bin(mid); if(i>=0){ B[i].h+=dh; used=true; } }
    ev.forEach(ms=>{ const i=bin(Math.min(Math.max(ms,s.startMs),s.endMs-1)); if(i>=0) B[i].c++; });
    if(used) n++;
  }
  B.forEach(b=>{ b.rate=b.h>0?b.c/b.h:null; });
  /* συμπέρασμα μόνο με αρκετά δεδομένα: τουλάχιστον 5 ώρες στη χαμηλή και στην υψηλή ζώνη */
  const lo=B[0], hi=B[2], ok=n>=6&&lo.h>=5&&hi.h>=5;
  return {n,bins:B,ok,ratio:ok&&lo.rate>0?hi.rate/lo.rate:(ok&&hi.rate>0?Infinity:null)};
}
/* 1.9.33: σύγκριση με «μόνο σελήνη» (όπως οι σελίδες ηλιοσεληνιακών ωρών, π.χ. Fishing Reminder): κύρια περίοδος ±60′ +30, δευτερεύουσα ±60′ +15,
   νέα/πανσέληνος +10. «Καλή ώρα» = 70+. Για το Alkyon «καλή ώρα» = ο βαθμός που έδινε η εφαρμογή εκείνη την ώρα (scoreH) 70+.
   Μετρά ψάρια ανά ώρα ψαρέματος στις καλές και στις άλλες ώρες, για καθεμία από τις δύο μεθόδους. Η πλεύση δεν μετρά. */
function moonOnly(ms,lat,lon,utcMin){
  if(!(g.PF&&g.PF.sunMoon)||lat==null||lon==null) return null;
  const loc=new Date(ms+utcMin*60000), ds=loc.toISOString().slice(0,10), t=loc.getUTCHours()*60+loc.getUTCMinutes();
  let sm=null; try{ sm=g.PF.sunMoon(ds,+lat,+lon,utcMin); }catch(e){ return null; } if(!sm) return null;
  const near=a=>(a||[]).reduce((m,x)=>Math.min(m,Math.abs(x-t),Math.abs(x-t-1440),Math.abs(x-t+1440)),1e9);
  const f=sm.f!=null?sm.f:(g.PF.moonPhase?g.PF.moonPhase(ms).f:0.25), ph=Math.min(Math.abs(f),Math.abs(f-0.5),Math.abs(f-1))<=0.1?10:0;
  return 50+(near(sm.maj)<=60?30:near(sm.min)<=60?15:0)+ph;
}
function vsMoon(trips,bites,opt){
  const utcMin=(opt&&opt.utcMin)||0, all=(bites||[]).concat((opt&&opt.misses)||[]), Z=()=>({hi:{h:0,c:0},lo:{h:0,c:0}}), A=Z(), M=Z(); let n=0;
  for(const s of sessionsOf(trips)){
    if(s.manual||!Array.isArray(s.scoreH)||!s.scoreH.length) continue; const sc={}; s.scoreH.forEach(r=>{ if(Array.isArray(r)) sc[r[0]]=r[1]; });
    const lat=s.lat!=null?s.lat:(s.cond0&&s.cond0.lat), lon=s.lon!=null?s.lon:(s.cond0&&s.cond0.lon); if(lat==null) continue;
    const ev=all.map(b=>biteMs(b,utcMin)).filter(ms=>ms!=null&&ms>=s.startMs-600000&&ms<=s.endMs+600000);
    const mv=Array.isArray(s.moving)?s.moving.filter(m=>!ev.some(e=>e>=m[0]&&e<=m[1])):[]; let used=false;
    const put=(ms,dh,dc)=>{ const a=sc[Math.floor(ms/3600000)], m=moonOnly(ms,lat,lon,utcMin); if(a==null||m==null) return false;
      const ga=a>=70?A.hi:A.lo, gm=m>=70?M.hi:M.lo; ga.h+=dh; gm.h+=dh; ga.c+=dc; gm.c+=dc; return true; };
    for(let t=s.startMs;t<s.endMs;t+=600000){ const dh=Math.min(600000,s.endMs-t)/3600000, mid=t+dh*1800000; if(mv.some(m=>mid>=m[0]&&mid<=m[1])) continue; if(put(mid,dh,0)) used=true; }
    ev.forEach(ms=>put(Math.min(Math.max(ms,s.startMs),s.endMs-1),0,1));
    if(used) n++;
  }
  const rate=g=>g.h>0?g.c/g.h:null, ratio=G=>{ const a=rate(G.hi), b=rate(G.lo); return a==null||b==null?null:b>0?a/b:(a>0?Infinity:1); };
  const ok=n>=6&&A.hi.h>=3&&A.lo.h>=3&&M.hi.h>=3&&M.lo.h>=3;
  return {n,A,M,ok,rA:ratio(A),rM:ratio(M),rate};
}
const LIGHT_EL=['Νύχτα','Αυγή','Πρωί','Μεσημέρι','Απόγευμα','Σούρουπο'], LIGHT_EN=['Night','Dawn','Morning','Midday','Afternoon','Dusk'];
g.PP={calib,vsMoon,moonOnly,build,score,day,sessionsOf,moonOf,NEED,ADV,biteMs,phaseOf,phaseAt,movingFrom,validate,prepare,LIGHT_EL,LIGHT_EN,MOVE_KN};
if(typeof module!=='undefined') module.exports=g.PP;
})(typeof window!=='undefined'?window:globalThis);
