(function(){
'use strict';
const PU=window.AlkyonUnits;
const $=id=>document.getElementById(id);
function h(tag,props,...kids){
  const e=document.createElement(tag);
  for(const k in (props||{})){
    const v=props[k]; if(v==null||v===false) continue;
    if(k==='class') e.className=v;
    else if(k==='text') e.textContent=v;
    else if(k.slice(0,2)==='on') e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat()){ if(c==null||c===false) continue; e.append(c.nodeType?c:document.createTextNode(String(c))); }
  return e;
}
const NS='http://www.w3.org/2000/svg';
function s(tag,attrs,text){
  const e=document.createElementNS(NS,tag);
  for(const k in (attrs||{})) e.setAttribute(k,attrs[k]);
  if(text!=null) e.textContent=text;
  return e;
}
const pad=n=>String(n).padStart(2,'0');
const fmt=m=>{if(m==null||isNaN(m)) return '—'; m=((Math.round(m)%1440)+1440)%1440;return pad(Math.floor(m/60))+':'+pad(m%60);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

/* ---------- Time and astronomy ---------- */
const TZ='Asia/Nicosia';
let viewing=null, viewCond=null, cond=lsGet('alkyon-cond',null), refreshing=null; window.AlkyonCond=()=>cond;
/* Κύπρος: το ωράριο (θερινή/χειμερινή) υπολογίζεται ζωντανά από το Intl, ώστε η αλλαγή ώρας να μην περιμένει νέα λήψη καιρού. Αλλού μένει το offset της τοποθεσίας. */
const utcOff=()=>{ const u=cond&&typeof cond.utc==='number'?cond.utc:null; if(u==null) return -new Date().getTimezoneOffset(); if(cond.tzn){ const z=tzOffsetMin(new Date(),cond.tzn); if(z!=null) return z; } if(u===120||u===180){ try{ return tzOffsetMin(new Date()); }catch(e){} } return u; };
const shifted=()=>new Date(Date.now()+utcOff()*60000);
const nicosiaToday=()=>shifted().toISOString().slice(0,10);
const nicosiaNowMin=()=>{const d=shifted();return d.getUTCHours()*60+d.getUTCMinutes();};
function tzOffsetMin(d,zone){
  try{
    const p=new Intl.DateTimeFormat('en-US',{timeZone:zone||TZ,timeZoneName:'shortOffset'}).formatToParts(d).find(x=>x.type==='timeZoneName').value;
    const m=/GMT([+-])(\d+)(?::(\d+))?/.exec(p);
    if(m) return (m[1]==='-'?-1:1)*(parseInt(m[2],10)*60+(m[3]?parseInt(m[3],10):0));
    if(p==='GMT'||p==='UTC') return 0;
  }catch(e){}
  return zone?null:120;
}
const SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14);
function sunMoon(dateStr){
  const [y,m,d]=dateStr.split('-').map(Number);
  const noonUtc=Date.UTC(y,m-1,d,12);
  const tz0=utcOff(), tz=(cond&&cond.tzn&&tzOffsetMin(new Date(noonUtc),cond.tzn)!=null)?tzOffsetMin(new Date(noonUtc),cond.tzn):(tz0===120||tz0===180)?tzOffsetMin(new Date(noonUtc)):tz0; /* ωράριο της συγκεκριμένης μέρας */
  const n=Math.floor((noonUtc-Date.UTC(y,0,0))/86400000);
  const lat=cond&&cond.lat!=null?cond.lat:34.9, lon=cond&&cond.lon!=null?cond.lon:33.2, la=lat*Math.PI/180;
  const g=2*Math.PI/365*(n-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const cosH=Math.cos(90.833*Math.PI/180)/(Math.cos(la)*Math.cos(dec))-Math.tan(la)*Math.tan(dec);
  const H=Math.acos(clamp(cosH,-1,1))*180/Math.PI;
  const noon=720-4*lon-eq+tz, rise=720-4*(lon+H)-eq+tz, set=720-4*(lon-H)-eq+tz;
  let age=((noonUtc-tz*60000+0-REF)/86400000)%SYN; if(age<0) age+=SYN;
  const f=age/SYN;
  const illum=(1-Math.cos(2*Math.PI*f))/2;
  const transit=((noon+f*1440)%1440+1440)%1440;
  const out={noon,rise,set,age,f,illum,transit,anti:(transit+745)%1440,mrise:((transit-373)%1440+1440)%1440,mset:(transit+373)%1440};
  /* v31z361: ακριβείς ώρες σελήνης και περίοδοι solunar από το forecast.js (ίδιος υπολογισμός με την Πρόγνωση και τον server) */
  try{ if(window.PF&&window.PF.sunMoon){ const pm=window.PF.sunMoon(dateStr,lat,lon,tz);
    Object.assign(out,{f:pm.f,illum:pm.illum,age:pm.f*SYN,transit:pm.transit,anti:pm.anti,mrise:pm.mrise,mset:pm.mset,maj:pm.maj,min:pm.min,periods:pm.periods}); } }catch(e){}
  return out;
}
function moonName(f){
  const i=Math.floor(((f*8)+0.5))%8;
  return ['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα σελήνη','Πανσέληνος','Φθίνουσα σελήνη','Τελευταίο τέταρτο','Φθίνων μηνίσκος'][i];
}
function drawMoon(f){
  const svg=$('moonSvg'); svg.replaceChildren();
  const r=20, k=Math.cos(2*Math.PI*f), rx=r*Math.abs(k);
  svg.append(s('circle',{r:r,cx:0,cy:0,fill:'var(--line)',stroke:'var(--coast)','stroke-width':1}));
  const sweep=k>0?0:1;
  const gEl=s('g',{transform:f>0.5?'scale(-1,1)':''});
  gEl.append(s('path',{d:`M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${sweep} 0 ${-r}Z`,fill:'var(--ink)'}));
  svg.append(gEl);
}
function circDist(a,b){const d=Math.abs(a-b)%1440;return Math.min(d,1440-d);}

/* ---------- Activity model ---------- */
function haversine(a,b,c,d){const R=6371,r=Math.PI/180,dl=(c-a)*r,dn=(d-b)*r,x=Math.sin(dl/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function personal(){
  /* v31z363: το προσωπικό μοντέλο μετρά ψάρια (και χαμένα τσιμπήματα) ανά ώρα ψαρέματος, από τις εξόδους, μαζί με τις εξόδους χωρίς ψάρι.
     Πριν μετρούσε μόνο τα ψάρια, οπότε έβλεπε μόνο τις καλές μέρες. Ενεργό όταν υπάρχουν αρκετές ώρες, έξοδοι και ψάρια (personal.js NEED). */
  const P={n:0,enough:false,on:false,hour:new Array(24).fill(0),press:{},moon:new Array(8).fill(0)};
  try{
    if(!window.PP) return P;
    const m=window.PP.build(Store.get('trips'),Store.act(),{utcMin:utcOff(),misses:Store.misses?Store.misses():[]});
    P.n=m.C; P.enough=m.ready; P.on=m.useful&&lsGet('alkyon-pm',true)!==false; P.model=m; if(!m.ready) return P; /* v31z365: μόνο αν ο έλεγχος δεν δείχνει ότι είναι χειρότερο από τον μέσο όρο */
    const pt=x=>Math.round(clamp(Math.log(x)*10,-6,10)), F=m.factors;
    P.light=F.block.map(x=>pt(x.m)); /* v31z365: φως (νύχτα, αυγή, πρωί, μεσημέρι, απόγευμα, σούρουπο) */
    ['fast','slow','stable','rise'].forEach((k,i)=>{ if(F.ptrend[i]&&F.ptrend[i].h>0) P.press[k]=pt(F.ptrend[i].m); });
    for(let k=0;k<8;k++) P.moon[k]=pt(F.moon[Math.round(k/2)%4].m);
  }catch(e){}
  return P;
}
function compute(){
  const date=$('dDate').value||nicosiaToday();
  const wind=+$('dWind').value, wave=+$('dWave').value;
  const press=$('dPress').value, cloud=$('dCloud').value;
  const sm=sunMoon(date);
  const factors=[];
  const moon=Math.round(Math.cos(4*Math.PI*sm.f)*4); /* v31z361: ίδια βάρη με το forecast.js */
  factors.push(['Φάση σελήνης',moon]);
  const pv={slow:3,stable:3,rise:4,fast:1}[press]; /* v31z362: ίδια με το forecast.js */ factors.push(['Πίεση',pv]);
  const wv=wind<5?2:wind<=12?4:wind<=18?-3:wind<=25?-12:-25; factors.push(['Άνεμος',wv]);
  const cv=wave<=0.5?3:wave<=1?0:wave<=1.5?-6:wave<=2?-15:-25; factors.push(['Κύμα',cv]);
  const clv={clear:0,part:2,over:4}[cloud]; factors.push(['Ουρανός',clv]);
  const P=personal(), mIdx=Math.floor(sm.f*8+0.5)%8;
  const pmAdj=P.on?((P.press[press]||0)+P.moon[mIdx]):0;
  const base=50+factors.reduce((a,f)=>a+f[1],0)+pmAdj;
  const hours=[];
  for(let hr=0;hr<24;hr++){
    const t=hr*60+30; let b=0;
    const dTw=Math.min(circDist(t,sm.rise),circDist(t,sm.set));
    if(dTw<=75) b+=14*(1-dTw/75);
    const near=(arr,alt)=>arr?arr.reduce((m,x)=>Math.min(m,Math.abs(t-x)),1e9):alt;
    const dMaj=near(sm.maj,Math.min(circDist(t,sm.transit),circDist(t,sm.anti)));
    if(dMaj<=45) b+=6; else if(dMaj<=75) b+=3;
    const dMin=near(sm.min,Math.min(circDist(t,sm.mrise),circDist(t,sm.mset)));
    if(dMin<=30) b+=3;
    if(t>=660&&t<=900) b-=4;
    hours.push(clamp(Math.round(base+b+(P.on&&P.light?P.light[window.PP.phaseOf(hr*60+30,sm.rise,sm.set)]:0)),5,98));
  }
  const day=clamp(Math.round(base),5,98);
  return {date,wind,wave,sm,factors,hours,day,P:P,pmAdj:pmAdj};
}
function bft(w){return [1,4,7,11,17,22,28,34,41,48,56,64].filter(x=>x<=w).length;}
const ICO={
  arrow:'<svg viewBox="0 0 24 24"><path d="M12 20V5M6 11l6-6 6 6"/></svg>',
  wave:'<svg viewBox="0 0 24 24"><path d="M2 9c3-4 5-4 8 0s5 4 8 0 3-3 4-2M2 16c3-4 5-4 8 0s5 4 8 0 3-3 4-2"/></svg>',
  gauge:'<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M12 5v2"/></svg>',
  temp:'<svg viewBox="0 0 24 24"><path d="M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z"/></svg>',
  drop:'<svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>'
};
function tile(ico,label,val,sub,rot){
  const t=h('div',{class:'tile'+(val==='–'?' na':'')}); const i=h('span',{class:'ti'}); i.innerHTML=ICO[ico]; if(rot!=null){ const sv=i.firstChild; sv.style.transform='rotate('+Math.round(rot)+'deg)'; }
  t.append(i,h('b',{text:val}),h('span',{class:'tl',text:label}),h('span',{class:'ts',text:sub||'\u00a0'})); return t;
}
const PT_ARROW={slow:'↘',stable:'→',rise:'↗',fast:'↓'};
function renderTiles(c){
  const box=$('tiles'); if(!box) return; box.replaceChildren();
  const k=(viewCond||cond)||{}, dash='–';
  box.append(
    tile('arrow','Άνεμος',k.wind!=null?PU.wind(k.wind):dash,wdir(k),k.windDeg!=null?k.windDeg+180:0),
    tile('wave','Κύμα',k.wave!=null?PU.wave(k.wave):dash,k.wavePeriod?Math.round(k.wavePeriod)+' s':''),
    tile('gauge','Πίεση',k.press!=null?PU.pressP(k.press)[0]:dash,(k.ptrend?PT_ARROW[k.ptrend]+' ':'')+PU.label('press')),
    tile('temp','Αέρας',k.temp!=null?PU.temp(k.temp):dash,''),
    tile('drop','Θάλασσα',k.sst!=null?PU.temp(k.sst):dash,''),
    tile('arrow','Ρεύμα',k.cur!=null?k.cur.toFixed(1)+' kn':dash,k.curDir!=null?dirName(k.curDir):'',k.curDir!=null?k.curDir:0));
}
function renderSea(){
  const box=$('seaTiles'); if(!box) return; box.replaceChildren();
  const k=(viewCond||cond)||{}, dash='–';
  box.append(
    tile('drop','Θερμοκρασία',k.sst!=null?PU.temp(k.sst,1):dash,''),
    tile('arrow','Ρεύμα',k.cur!=null?k.cur.toFixed(2)+' kn':dash,k.curDir!=null?dirName(k.curDir):'',k.curDir!=null?k.curDir:0),
    tile('clock','Περίοδος κύματος',k.wavePeriod?Math.round(k.wavePeriod)+' s':dash,''));
  const n=$('seaNote'); let t='';
  if(k.cur==null) t='Δεν υπάρχουν δεδομένα ρεύματος για αυτή τη θέση.';
  else if(k.cur<0.3) t='Ασθενές ρεύμα: ελαφρύ μολύβι και φυσικό δόλωμα κάτω στο βυθό.';
  else if(k.cur<0.8) t='Ήπιο ρεύμα: τα ψάρια συγκεντρώνονται πίσω από βράχια και υφάλους. Ρίξε προς το ρεύμα.';
  else t='Ισχυρό ρεύμα: χρειάζεσαι βαρύτερο μολύβι και σταθερή άγκυρα.';
  if(k.sst!=null) t+=k.sst>=26?' Θερμό νερό: πιο δραστήρια ψάρια το πρωί και το βράδυ.':k.sst<=18?' Κρύο νερό: τα ψάρια είναι πιο αργά, ψάξε βαθύτερα.':'';
  n.textContent=t+' Δεδομένα μοντέλου, χαμηλής ανάλυσης κοντά στην ακτή.';
}
function renderStrip(c){
  const box=$('hdrStrip'); if(!box) return; box.replaceChildren();
  const k=(viewCond||cond)||{}, sm=c.sm, dash='–';
  const ph=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'][Math.floor(sm.f*8+0.5)%8];
  const chip=(l,v)=>h('span',{class:'sc'},h('i',{text:l}),h('b',{text:v}));
  const rf=h('button',{type:'button',class:'sc rf',id:'hdrRef','aria-label':'Ανανέωση συνθηκών'},h('i',{text:'Τώρα'}),h('b',{text:'↻ '+(k.at||dash)}));
  rf.addEventListener('click',()=>{ rf.classList.add('spin'); refreshConditions().finally(()=>rf.classList.remove('spin')); });
  box.append(
    chip('Άνεμος',k.wind!=null?PU.wind(k.wind)+(wdir(k)?' '+wdir(k):''):dash),
    chip('Πίεση',k.press!=null?k.press+' '+(k.ptrend?PT_ARROW[k.ptrend]:''):dash),
    chip('Κύμα',k.wave!=null?PU.wave(k.wave):dash),
    chip('Ρεύμα',k.cur!=null?k.cur.toFixed(1)+' kn'+(k.curDir!=null?' '+dirName(k.curDir):''):dash),
    chip('Θάλασσα',k.sst!=null?PU.temp(k.sst):dash),
    chip(ph+' Σελήνη',Math.round(sm.illum*100)+'%'),
    chip('Ανατολή',fmt(sm.rise)),chip('Δύση',fmt(sm.set)),rf);
}
function drawSun(sm,date){
  const sv=$('sunArc'); if(!sv) return; sv.replaceChildren();
  const el=(n,p)=>{const e=document.createElementNS(NS,n); for(const k in p) e.setAttribute(k,p[k]); return e;};
  const rise=sm.rise,set=sm.set, now=nicosiaNowMin(), isToday=date===nicosiaToday();
  sv.append(el('path',{class:'arc',d:'M20 100 A140 80 0 0 1 300 100'}),el('line',{class:'hz',x1:8,y1:100,x2:312,y2:100}));
  const p=(now-rise)/(set-rise);
  if(isToday&&p>=0&&p<=1){
    const x=160-140*Math.cos(Math.PI*p), y=100-80*Math.sin(Math.PI*p);
    sv.append(el('path',{class:'arcd',d:'M20 100 A140 80 0 0 1 '+x.toFixed(1)+' '+y.toFixed(1)}),el('circle',{cx:x.toFixed(1),cy:y.toFixed(1),r:7,fill:'#f2b84b'}));
  }
  const tx=(x,y,t,anc)=>{const e=el('text',{x:x,y:y,'text-anchor':anc||'middle'}); e.textContent=t; return e;};
  sv.append(tx(20,116,fmt(rise),'middle'),tx(300,116,fmt(set),'middle'));
  const dl=Math.max(0,set-rise); sv.append(tx(160,116,Math.floor(dl/60)+(window.LANG==='en'?'h ':'ω ')+Math.round(dl%60)+(window.LANG==='en'?'m':'λ'),'middle'));
}
/* ---------- Πού να πας ---------- */
function bestSpots(c){
  const bs=Store.get('bites').filter(b=>typeof b.lat==='number'&&typeof b.lon==='number');
  const cands=[]; Store.get('spots').forEach(s=>{ if(typeof s.lat==='number') cands.push({name:s.name||'Σημείο',lat:s.lat,lon:s.lon}); });
  bs.forEach(b=>{ if(!cands.some(x=>haversine(x.lat,x.lon,b.lat,b.lon)<0.6)) cands.push({name:b.place||AlkyonCoord.fmt(b.lat,b.lon),lat:b.lat,lon:b.lon}); });
  const k=(viewCond||cond)||{}, hrNow=Math.floor(nicosiaNowMin()/60), wb=w=>w==null?null:w<8?0:w<=14?1:2;
  const out=[];
  for(const x of cands){
    const near=bs.filter(b=>haversine(x.lat,x.lon,b.lat,b.lon)<=0.6); if(!near.length) continue;
    let sim=0;
    for(const b of near){
      let w=1; const bh=b.time?+b.time.slice(0,2):null;
      if(bh!=null&&Math.min(Math.abs(bh-hrNow),24-Math.abs(bh-hrNow))<=3) w+=1;
      if(b.ptrend&&b.ptrend===($('dPress').value)) w+=0.5;
      if(wb(b.wind)!=null&&wb(b.wind)===wb(+$('dWind').value)) w+=0.5;
      sim+=w;
    }
    const dist=(k.lat!=null)?haversine(k.lat,k.lon,x.lat,x.lon):null;
    out.push({x:x,n:near.length,sim:sim,dist:dist});
  }
  return out.sort((a,b)=>b.sim-a.sim).slice(0,3);
}
function renderBest(c){
  const box=$('bestBody'); if(!box) return; box.replaceChildren();
  const all=Store.get('bites').filter(b=>typeof b.lat==='number');
  if(all.length<3){ box.append(h('p',{class:'note',text:'Όταν καταγράψεις τουλάχιστον 3 τσιμπήματα με θέση, εδώ θα βλέπεις σε ποια σημεία σου έχει πετύχει περισσότερο, σε παρόμοια ώρα και συνθήκες.'})); return; }
  const top=bestSpots(c);
  if(!top.length){ box.append(h('p',{class:'note',text:'Δεν βρέθηκε σημείο με αρκετά τσιμπήματα.'})); return; }
  top.forEach((t,i)=>{
    const sub=t.n+' τσιμπήματα στο σημείο'+(t.dist!=null?' · '+(t.dist<1?Math.round(t.dist*1000)+' m':PU.dist(t.dist))+' από εσένα':'');
    box.append(h('div',{class:'bestrow'},h('span',{class:'rk',text:String(i+1)}),h('div',{style:'flex:1;min-width:0'},h('b',{text:t.x.name}),h('div',{class:'note',text:sub})),h('button',{class:'btn ghost sm',type:'button',text:'Χάρτης',onclick:()=>{switchTab('map');showOnMap(t.x.lat,t.x.lon);}})));
  });
  box.append(h('p',{class:'note',style:'margin:8px 0 0',text:'Βασίζεται στα δικά σου τσιμπήματα: ίδια περιοχή (έως 600 m), ώρα, πίεση και άνεμος παρόμοια με τώρα.'}));
}
function renderToday(){
  const c=compute();
  $('vWind').textContent=PU.wind(c.wind);
  $('vWave').textContent=PU.wave(c.wave);
  const sc=$('score'); sc.replaceChildren(String(c.day),h('small',{text:'/100'}));
  $('scoreText').textContent=c.day>=75?'Πολύ καλές προϋποθέσεις':c.day>=60?'Καλές προϋποθέσεις':c.day>=45?'Μέτριες προϋποθέσεις':'Δύσκολη μέρα για ψάρεμα';
  const rf=$('ringFg'); if(rf){ rf.style.strokeDashoffset=(326.7*(1-c.day/100)).toFixed(1); rf.setAttribute('class','rfg '+(c.day>=65?'good':c.day>=45?'mid':'bad')); }
  let fpk='boat'; try{ fpk=localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){}
  const TH={boat:[20,1.5,14,0.9],shore:[30,2,20,1.2],lake:[20,9,14,9],spear:[12,0.6,8,0.4]}[fpk]||[20,1.5,14,0.9];
  const lvl=(c.wind>TH[0]||c.wave>TH[1])?'bad':(c.wind>TH[2]||c.wave>TH[3])?'warn':'good';
  const pill=$('safePill'); pill.className='pill '+lvl;
  pill.textContent={good:fpk==='lake'?'Ήπιες συνθήκες':'Ήπια θάλασσα',warn:'Προσοχή',bad:'Δύσκολες συνθήκες'}[lvl];
  const WHO={boat:'έξοδο με μικρό σκάφος',shore:'ψάρεμα από την ακτή',lake:'ψάρεμα σε λίμνη/φράγμα',spear:'ψαροντούφεκο'}[fpk]||'έξοδο με μικρό σκάφος';
  const WH2={boat:'μικρό σκάφος',shore:'την ακτή (κύμα στα βράχια)',lake:'λίμνη/φράγμα',spear:'ψαροντούφεκο (ορατότητα/ρεύμα)'}[fpk]||'μικρό σκάφος';
  $('safeText').textContent={good:'Συνθήκες κατάλληλες για '+WHO+'.',warn:'Αρκετός άνεμος ή κύμα για '+WH2+'. Κοίτα την πρόγνωση για ριπές.',bad:'Άνεμος ή κύμα ψηλά για '+WH2+'. Καλύτερα αναβολή ή πιο προφυλαγμένο σημείο.'}[lvl];  const fx=$('factors'); fx.replaceChildren();
  const pressTx={slow:['Πέφτει αργά','Η πίεση πέφτει αργά: τα ψάρια τρώνε πιο πολύ πριν αλλάξει ο καιρός.'],stable:['Σταθερή','Η πίεση είναι σταθερή: φυσιολογική δραστηριότητα.'],rise:['Ανεβαίνει','Η πίεση ανεβαίνει: συνήθως πιο ήσυχα ψάρια.'],fast:['Πέφτει απότομα','Η πίεση πέφτει απότομα: έρχεται αλλαγή καιρού και τα ψάρια συχνά σταματούν.']};
  const cloudTx={clear:['Καθαρός','Καθαρός ουρανός: δυνατό φως, τα ψάρια πάνε πιο βαθιά.'],part:['Λίγα σύννεφα','Λίγα σύννεφα: καλό, μαλακό φως.'],over:['Συννεφιά','Συννεφιά: χαμηλό φως, τα ψάρια πλησιάζουν πιο εύκολα.']};
  const moonTx=c.factors[0][1]>=4?'Κοντά σε νέα ή πανσέληνο: ισχυρότερα ρεύματα και πιο έντονη όρεξη στα ψάρια.':c.factors[0][1]<=-4?'Κοντά σε τέταρτο: πιο ήρεμα ρεύματα και λιγότερη όρεξη στα ψάρια.':'Ενδιάμεση φάση σελήνης: ουδέτερη επίδραση.';
  const windTx=c.wind<5?'Σχεδόν άπνοια: εύκολο ψάρεμα και ασφαλής έξοδος.':c.wind<=12?'Ήπιος άνεμος: ιδανικός, ανακατεύει λίγο την επιφάνεια.':c.wind<=18?'Αρκετός άνεμος: δύσκολο το ψάρεμα και η ρίψη.':c.wind<=25?'Δυνατός άνεμος: κουραστικό και ανασφαλές για μικρό σκάφος.':'Πολύ δυνατός άνεμος: μην βγεις με μικρό σκάφος.';
  const waveTx=c.wave<=0.5?'Ήρεμη θάλασσα: καλή για ψάρεμα και ασφαλής.':c.wave<=1?'Μικρό κύμα: αποδεκτό.':c.wave<=1.5?'Μέτριο κύμα: ταλαιπωρεί το σκάφος και δυσκολεύει το ψάρεμα.':c.wave<=2?'Μεγάλο κύμα: δύσκολο και επικίνδυνο για μικρό σκάφος.':'Πολύ μεγάλο κύμα: μην βγεις με μικρό σκάφος.';
  const rows=[
    ['Σελήνη',moonName(c.sm.f),c.factors[0][1],moonTx],
    ['Πίεση',pressTx[$('dPress').value][0],c.factors[1][1],pressTx[$('dPress').value][1]],
    ['Άνεμος',PU.wind(c.wind),c.factors[2][1],windTx],
    ['Κύμα',PU.wave(c.wave),c.factors[3][1],waveTx],
    ['Ουρανός',cloudTx[$('dCloud').value][0],c.factors[4][1],cloudTx[$('dCloud').value][1]]
  ];
  const good=[],bad=[];
  for(const [n,val,v,tx] of rows){
    const k=v>=2?'good':v<=-3?'bad':'mid';
    if(k==='good') good.push(n); if(k==='bad') bad.push(n);
    fx.append(h('div',{class:'fx'},h('div',{class:'fxh'},h('b',{text:n}),h('span',{class:'mono',text:val}),h('span',{class:'fxc '+k,text:k==='good'?'Βοηθά':k==='bad'?'Δεν βοηθά':'Ουδέτερο'})),h('div',{class:'note',text:tx})));
  }
  const EN_=window.LANG==='en', nmE={'Σελήνη':'Moon','Πίεση':'Pressure','Άνεμος':'Wind','Κύμα':'Waves','Ουρανός':'Sky'}, jn=l=>l.map(x=>EN_?nmE[x]:x).join(', ');
  if(EN_) fx.prepend(h('p',{class:'note fxs',text:'Score 0–100: how favourable conditions are for fish to bite. 50 is average. Helps: '+(jn(good)||'nothing in particular')+'. Does not help: '+(jn(bad)||'nothing')+'.'}));
  else fx.prepend(h('p',{class:'note fxs',text:'Βαθμός 0–100: πόσο ευνοϊκές είναι οι συνθήκες για να τσιμπήσουν τα ψάρια. Το 50 είναι ο μέσος όρος. Βοηθά: '+(good.join(', ')||'τίποτα ιδιαίτερα')+'. Δεν βοηθά: '+(bad.join(', ')||'τίποτα')+'.'}));
  const dt=h('details',{class:'fxd'},h('summary',{text:'Δες τους πόντους'}),h('div',{class:'factors'},h('div',{class:'muted',text:'Βάση'}),h('div',{class:'v',text:'50'})));
  for(const [n,v] of c.factors){ dt.querySelector('.factors').append(h('div',{text:n}),h('div',{class:'v '+(v>0?'pos':v<0?'neg':''),text:(v>0?'+':'')+v})); }
  fx.append(dt);
  const P=c.P;
  if(P.enough){
    const row=h('div',{class:'fx'},h('div',{class:'fxh'},h('b',{text:'Δικό σου ιστορικό'}),h('span',{class:'mono',text:P.n+' τσιμπήματα'}),h('span',{class:'fxc '+(!P.on?'mid':c.pmAdj>=2?'good':c.pmAdj<=-3?'bad':'mid'),text:P.on?(c.pmAdj>0?'+':'')+c.pmAdj:'Κλειστό'})),
      h('div',{class:'note',text:(window.LANG==='en'?'Bites per hour fished in each condition (light, moon, pressure, wind), counting trips with no fish; travel above '+window.PP.MOVE_KN+' kn does not count. ':'Τσιμπήματα ανά ώρα ψαρέματος σε κάθε συνθήκη (φως, σελήνη, πίεση, άνεμος), μαζί με τις εξόδους χωρίς ψάρι· η πλεύση πάνω από '+window.PP.MOVE_KN+' κόμβους δεν μετρά. ')+(P.model&&P.model.valid?(P.model.valid.gain>0?(window.LANG==='en'?'Checked on trips it had not seen: '+Math.round(P.model.valid.gain*100)+'% better than your average.':'Έλεγχος σε εξόδους που δεν είδε: '+Math.round(P.model.valid.gain*100)+'% καλύτερο από τον μέσο όρο σου.'):(window.LANG==='en'?'Checked on trips it had not seen: not better than your average yet, so it is off.':'Έλεγχος σε εξόδους που δεν είδε: δεν είναι ακόμα καλύτερο από τον μέσο όρο σου, γι’ αυτό είναι κλειστό.')):(window.LANG==='en'?'Not yet checked (needs 10 trips).':'Δεν έχει ελεγχθεί ακόμα (χρειάζονται 10 έξοδοι).'))}));
    const cb=h('input',{type:'checkbox',id:'pmOn'}); cb.checked=P.on; cb.addEventListener('change',()=>{lsSet('alkyon-pm',cb.checked);renderToday();});
    row.append(h('label',{class:'chk',style:'border:0'},cb,h('span',{text:'Χρήση του ιστορικού μου στον βαθμό'})));
    fx.insertBefore(row,dt);
  } else if(P.model){ const pg=P.model.progress, nd=pg.need; fx.insertBefore(h('p',{class:'note',text:window.LANG==='en'?'The score will adapt to your own history once you have '+nd.hours+' fishing hours, '+nd.sessions+' trips and '+nd.catches+' fish, counting trips with no fish too (now: '+Math.round(pg.hours)+' h, '+pg.sessions+' trips, '+pg.catches+' fish). Use Start/End trip even when you catch nothing.':'Ο βαθμός θα προσαρμόζεται στο δικό σου ιστορικό όταν έχεις '+nd.hours+' ώρες ψαρέματος, '+nd.sessions+' εξόδους και '+nd.catches+' ψάρια, μαζί με τις εξόδους χωρίς ψάρι (τώρα: '+Math.round(pg.hours)+' ώρες, '+pg.sessions+' έξοδοι, '+pg.catches+' ψάρια). Χρησιμοποίησε την Έναρξη/Τέλος εξόδου ακόμα κι όταν δεν πιάνεις.'}),dt); }
  renderTiles(c); renderSea(); renderBest(c);
  drawHours(c);
  const sm=c.sm;
  $('moonName').textContent=moonName(sm.f);
  $('moonSub').textContent='Φωτισμός '+Math.round(sm.illum*100)+'% · ηλικία '+sm.age.toFixed(1)+' ημέρες';
  drawMoon(sm.f);
  $('illumBar').style.width=Math.round(sm.illum*100)+'%';
  const toNew=((1-sm.f)%1)*SYN, toFull=((0.5-sm.f+1)%1)*SYN, addD=n=>{const [y,m,d]=c.date.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d+Math.round(n)));return pad(dt.getUTCDate())+'/'+pad(dt.getUTCMonth()+1);};
  $('moonNext').textContent=(window.LANG==='en'?'Next full moon: '+addD(toFull)+' · new moon: '+addD(toNew):'Επόμενη πανσέληνος: '+addD(toFull)+' · νέα σελήνη: '+addD(toNew));
  renderStrip(c);
  drawSun(sm,c.date);
  const st=$('sunTimes'); st.replaceChildren();
  for(const [a,b] of [['Ανατολή ηλίου',fmt(sm.rise)],['Δύση ηλίου',fmt(sm.set)],['Ανατολή σελήνης',fmt(sm.mrise)],['Δύση σελήνης',fmt(sm.mset)],['Σελήνη στο ζενίθ',fmt(sm.transit)],['Σελήνη στο ναδίρ',fmt(sm.anti)]]){
    st.append(h('span',{class:'muted',text:a}),h('span',{text:b}));
  }
}
function drawHours(c){
  const svg=$('hourChart'); svg.replaceChildren();
  const W=480,H=150,L=8,R=8,T=14,B=22, bw=(W-L-R)/24, ch=H-T-B;
  const mx=Math.max(...c.hours);
  c.hours.forEach((v,i)=>{
    const hgt=Math.max(2,v/100*ch), x=L+i*bw+1.5;
    const cls=v>=mx-6?'b-hi':v>=mx-18?'b-mid':'b-lo';
    svg.append(s('rect',{x:x,y:T+ch-hgt,width:bw-3,height:hgt,rx:1.5,class:cls}));
  });
  const xm=m=>L+(m/1440)*(W-L-R);
  for(const [m,l] of [[c.sm.rise,'↑ '+fmt(c.sm.rise)],[c.sm.set,'↓ '+fmt(c.sm.set)]]){
    svg.append(s('line',{x1:xm(m),x2:xm(m),y1:T-4,y2:T+ch,stroke:'var(--accent)','stroke-width':1.2,'stroke-dasharray':'3 3'}));
    svg.append(s('text',{x:xm(m),y:10,'text-anchor':'middle'},l));
  }
  if(c.date===nicosiaToday()){
    const n=nicosiaNowMin();
    svg.append(s('line',{x1:xm(n),x2:xm(n),y1:T,y2:T+ch,stroke:'var(--ink)','stroke-width':1.5}));
  }
  for(const hr of [0,6,12,18,24]) svg.append(s('text',{x:L+hr*bw,y:H-6,'text-anchor':hr===0?'start':hr===24?'end':'middle'},pad(hr%24)+':00'));
  const thr=mx-6, groups=[]; let cur=null;
  c.hours.forEach((v,i)=>{ if(v>=thr){ if(cur&&cur.e===i-1){cur.e=i;cur.m=Math.max(cur.m,v);} else {cur={s:i,e:i,m:v};groups.push(cur);} } });
  groups.sort((a,b)=>b.m-a.m);
  const w=$('windows'); w.replaceChildren();
  groups.slice(0,3).sort((a,b)=>a.s-b.s).forEach(g=>w.append(h('span',{text:pad(g.s)+':00 – '+pad((g.e+1)%24)+':00'})));
}

/* ---------- Store (this device, localStorage) ---------- */
const Store=(function(){
  const cache={spots:[],trips:[],bites:[],tackle:[]}, subs={spots:[],trips:[],bites:[],tackle:[]}, hooks=[];
  let tombs=[];
  const emit=k=>subs[k].forEach(f=>{ try{ f(cache[k]); }catch(e){ try{ console.error('store subscriber',e); }catch(x){} } });
  const persist=k=>lsSet('alkyon-'+k,cache[k]);
  const ptomb=()=>lsSet('alkyon-tomb',tombs);
  const changed=(k,id)=>hooks.forEach(f=>{try{f(k,id);}catch(e){}});
  async function init(){
    for(const k in cache){cache[k]=lsGet('alkyon-'+k,[]);} for(const k in cache) emit(k);
    tombs=lsGet('alkyon-tomb',[]);
    try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
  }
  async function save(k,obj){
    const id=obj.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6));
    const data=Object.assign({},obj,{id:id,_u:Date.now()});
    if(!obj.id&&!data.prof&&(k==='trips'||k==='bites')){ try{ data.prof=localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){} }
    cache[k]=cache[k].filter(x=>x.id!==id).concat([data]); tombs=tombs.filter(t=>!(t.k===k&&t.id===id)); persist(k); ptomb(); emit(k); changed(k,id); return id;
  }
  async function remove(k,id){cache[k]=cache[k].filter(x=>x.id!==id);tombs=tombs.filter(t=>!(t.k===k&&t.id===id)).concat([{k:k,id:id,u:Date.now()}]);persist(k);ptomb();emit(k);changed(k,id);}
  /* Συγχρονισμός: ενσωμάτωση από τον server (το πιο πρόσφατο κερδίζει) */
  function mergeIn(k,id,data,deleted,u){
    const cur=cache[k].find(x=>x.id===id), t=tombs.find(x=>x.k===k&&x.id===id);
    const lu=Math.max(cur?(cur._u||0):0,t?t.u:0);
    if(u<=lu) return false;
    if(deleted){ cache[k]=cache[k].filter(x=>x.id!==id); tombs=tombs.filter(x=>!(x.k===k&&x.id===id)).concat([{k:k,id:id,u:u}]); }
    else { cache[k]=cache[k].filter(x=>x.id!==id).concat([Object.assign({},data,{id:id,_u:u})]); tombs=tombs.filter(x=>!(x.k===k&&x.id===id)); }
    return true;
  }
  function flush(){ for(const k in cache){persist(k);emit(k);} ptomb(); }
  function wipe(){ for(const k in cache){cache[k]=[];} tombs=[]; flush(); }
  return {init,save,remove,mergeIn,flush,wipe,tombs:()=>tombs,hook:f=>hooks.push(f),on:(k,f)=>{subs[k].push(f);f(cache[k]);},get:k=>k==='bites'?cache.bites.filter(b=>!b.miss):cache[k],raw:k=>cache[k],misses:()=>cache.bites.filter(b=>b.miss),act:()=>cache.bites.filter(b=>!b.miss&&!b.gear),pas:()=>cache.bites.filter(b=>!b.miss&&!!b.gear)};
})();

/* ---------- Photos (IndexedDB) ---------- */
const Photos=(function(){
  let dbp=null;
  const db=()=>window.alkyonPhotoDB?window.alkyonPhotoDB():dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('alkyon',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));
  async function tx(mode,fn){const d=await db();return new Promise((res,rej)=>{const t=d.transaction('photos',mode);const rq=fn(t.objectStore('photos'));t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});}
  return {put:(id,b)=>tx('readwrite',s=>s.put(b,id)),get:id=>tx('readonly',s=>s.get(id)),del:id=>tx('readwrite',s=>s.delete(id))};
})();
window.AlkyonCore={Store:Store,Photos:Photos,toast:null,bc:function(b){ return Math.max(1,Math.floor(+b.cnt)||1); }};
window.addEventListener('alkyon-pickfc',()=>startPick('fc'));
window.addEventListener('alkyon-picktoday',()=>startPick('today'));
window.addEventListener('alkyon-pickplace',()=>startPick('place'));
async function resizeImage(file){
  let bmp;
  try{ bmp=await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch(e){ bmp=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(file);}); }
  const w=bmp.width||bmp.naturalWidth, hh=bmp.height||bmp.naturalHeight, k=Math.min(1,1280/Math.max(w,hh));
  const cv=document.createElement('canvas'); cv.width=Math.round(w*k); cv.height=Math.round(hh*k);
  cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
  return new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('blob')),'image/jpeg',0.78));
}
const toast=(m)=>{const e=$('toast');m=String(m==null?'':m); m=m.charAt(0).toUpperCase()+m.slice(1); e.textContent=m;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3500);};
window.AlkyonCore.toast=toast; window.AlkyonCore.Photos=Photos; window.AlkyonCore.biteMs=biteMs;

/* ---------- Map (Leaflet, world) ---------- */
const REFS=[['Πάφος',32.41,34.75],['Λατσί',32.43,35.04],['Λεμεσός',33.04,34.67],['Ακρ. Γάτα',33.03,34.56],['Ζύγι',33.34,34.72],['Λάρνακα',33.63,34.91],['Κάβο Γκρέκο',34.08,34.96]];
const TILES={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
let map=null,baseSat,baseOsm,seaL,youM=null,pendM=null,spotsG,bitesG,popup=null;
const markerById={};
let selSpot=null,pending=null,pick=null,pickedPt=null;
const purl=new Map();
async function loadPhoto(id,img,tries){
  try{
    let u=purl.get(id);
    if(!u){const bl=await Photos.get(id); if(!bl){ /* η φωτογραφία μπορεί να γράφεται ακόμα: ξαναδοκιμάζουμε λίγο αργότερα */ if((tries||0)<4&&img.isConnected!==false) setTimeout(()=>loadPhoto(id,img,(tries||0)+1),700); return; } u=URL.createObjectURL(bl); purl.set(id,u);}
    img.src=u; img.hidden=false;
  }catch(e){}
}
/* Πολλές φωτογραφίες ανά ψάρι: η πρώτη έχει το id του ψαριού, οι επιπλέον id+'~1', id+'~2'… (b.xph = πλήθος επιπλέον) */
const MAXPH=8;
function phKeys(b){ const k=[]; if(!b) return k; if(b.photo) k.push(b.id); for(let i=1;i<=(+b.xph||0);i++) k.push(b.id+'~'+i); return k; }
function phGallery(b,cls){
  const ks=phKeys(b); if(!ks.length) return null;
  const w=h('div',{class:cls||'bph'});
  ks.forEach((k,i)=>{ const im=h('img',{class:'thumb',alt:(b.species||'')+' '+(i+1),loading:'lazy',decoding:'async'}); im.hidden=true; im.addEventListener('click',()=>{ if(im.src) openPhotoView(ks,i); }); w.append(im); loadPhoto(k,im); });
  return w;
}
function openPhotoView(ks,i){
  const ov=h('div',{class:'phview',role:'dialog','aria-modal':'true','aria-label':window.LANG==='en'?'Photo':'Φωτογραφία'});
  const im=h('img',{alt:''}); const cnt=h('span',{class:'phc'}); const x=h('button',{class:'phx',type:'button','aria-label':window.LANG==='en'?'Close':'Κλείσιμο',text:'✕'});
  const prev=h('button',{class:'phn phl',type:'button','aria-label':'‹',text:'‹'}), next=h('button',{class:'phn phr',type:'button','aria-label':'›',text:'›'});
  function show(){ cnt.textContent=(i+1)+' / '+ks.length; prev.hidden=next.hidden=ks.length<2; loadPhoto(ks[i],im); }
  function close(){ ov.remove(); document.removeEventListener('keydown',key); }
  function key(e){ if(e.key==='Escape') close(); else if(e.key==='ArrowLeft'){ i=(i+ks.length-1)%ks.length; show(); } else if(e.key==='ArrowRight'){ i=(i+1)%ks.length; show(); } }
  prev.addEventListener('click',e=>{ e.stopPropagation(); i=(i+ks.length-1)%ks.length; show(); });
  next.addEventListener('click',e=>{ e.stopPropagation(); i=(i+1)%ks.length; show(); });
  x.addEventListener('click',close); ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  ov.append(im,cnt,x,prev,next); document.body.append(ov); document.addEventListener('keydown',key); show(); try{ x.focus(); }catch(e){}
}
/* ---------- Restricted fishing areas ---------- */
const ZONES=window.ZONES||[];
function inRing(lat,lon,r){
  let c=false;
  for(let i=0,j=r.length-1;i<r.length;j=i++){
    const yi=r[i][0],xi=r[i][1],yj=r[j][0],xj=r[j][1];
    if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) c=!c;
  }
  return c;
}
function zonesAt(lat,lon){
  if(lat==null||lon==null) return [];
  return ZONES.filter(z=>{ let n=0; for(const r of z.p) if(inRing(lat,lon,r)) n++; return n%2===1; });
}
let zonesG=null;
function zoneText(z){ return z.n+': '+z.d; }
function checkZoneHere(){
  const w=$('zoneWarn'); if(!w) return;
  const z=cond&&cond.lat!=null?zonesAt(cond.lat,cond.lon):[];
  if(z.length){ w.textContent='⚠ Είσαι μέσα σε περιοχή απαγόρευσης. '+z.map(zoneText).join(' | '); w.hidden=false; } else w.hidden=true;
}
function showZone(z){
  switchTab('map'); if(!map) return;
  map.fitBounds(L.polygon(z.p[0]).getBounds(),{maxZoom:15,padding:[30,30]});
}
function initMap(){
  if(typeof L==='undefined'){ $('lmap').textContent='Ο χάρτης δεν φόρτωσε.'; return; }
  const last=lsGet('alkyon-view',null), c=cond&&cond.lat!=null?[cond.lat,cond.lon]:null;
  L.Popup.mergeOptions({maxWidth:Math.max(200,Math.min(320,innerWidth-190)),minWidth:150,autoPan:false});
  map=L.map('lmap',{minZoom:2,worldCopyJump:true,zoomControl:false}).setView(last?[last.lat,last.lon]:(c||[34.9,33.2]),last?last.z:(c?10:8));
  L.control.zoom({position:'topleft'}).addTo(map);
  baseSat=L.tileLayer(TILES.sat,{maxZoom:18,attribution:'Esri'});
  baseOsm=L.tileLayer(TILES.osm,{maxZoom:19,attribution:'© OpenStreetMap'});
  seaL=L.tileLayer(TILES.sea,{maxZoom:18,attribution:'OpenSeaMap'});
  let lay=lsGet('alkyon-layer','sat'); (lay==='osm'?baseOsm:baseSat).addTo(map);
  $('bLayer').addEventListener('click',()=>{
    if(lay==='sat'){map.removeLayer(baseSat);baseOsm.addTo(map);lay='osm';} else {map.removeLayer(baseOsm);baseSat.addTo(map);lay='sat';}
    lsSet('alkyon-layer',lay); if(map.hasLayer(seaL)) seaL.bringToFront();
  });
  const wmsU='https://ows.emodnet-bathymetry.eu/wms', depthC=L.tileLayer.wms(wmsU,{layers:'emodnet:mean_multicolour',format:'image/png',transparent:true,opacity:.6,version:'1.3.0',attribution:'EMODnet Bathymetry'}), depthK=L.tileLayer.wms(wmsU,{layers:'emodnet:contours',format:'image/png',transparent:true,version:'1.3.0',attribution:'EMODnet Bathymetry'});
  let dm=+lsGet('alkyon-depth',0)||0;
  const applyDepth=()=>{ [depthC,depthK].forEach(l=>{ if(map.hasLayer(l)) map.removeLayer(l); }); if(dm===1) depthC.addTo(map); if(dm===2&&!(window.AlkyonDense&&window.AlkyonDense.on())) depthK.addTo(map); if(map.hasLayer(seaL)) seaL.bringToFront(); $('bDepthMap').setAttribute('aria-pressed',String(dm!==0)); $('bDepthMap').title=['Βάθη θάλασσας: κλειστά','Βάθη θάλασσας: χρώματα','Βάθη θάλασσας: γραμμές βάθους'][dm]; try{ window.dispatchEvent(new CustomEvent('alkyon-depthmode',{detail:{dm:dm}})); }catch(e){} };
  window.AlkyonDepthRefresh=applyDepth; window.AlkyonDepthMode=()=>dm; window.AlkyonDepthLayers={c:depthC,k:depthK};
  applyDepth();
  const DSTEP=['std','5','10','20'], DNAME=(window.LANG==='en')?['Depth: off','Depth: colour shading','Depth: contour lines (standard)','Depth: contour lines every 5 m','Depth: contour lines every 10 m','Depth: contour lines every 20 m']:['Βάθη: κλειστά','Βάθη: χρώματα','Βάθη: γραμμές (στάνταρ)','Βάθη: γραμμές κάθε 5 m','Βάθη: γραμμές κάθε 10 m','Βάθη: γραμμές κάθε 20 m'];
  $('bDepthMap').addEventListener('click',()=>{
    const D=window.AlkyonDense, cur=dm===0?0:dm===1?1:2+Math.max(0,DSTEP.indexOf(D?D.mode():'std')), s=(cur+1)%6;
    dm=s===0?0:s===1?1:2; lsSet('alkyon-depth',dm);
    if(s>=2&&D&&D.setMode) D.setMode(DSTEP[s-2]); else applyDepth();
    toast(DNAME[s]);
  });
  $('bSea').addEventListener('click',()=>{
    const on=!map.hasLayer(seaL); if(on) seaL.addTo(map); else map.removeLayer(seaL);
    $('bSea').setAttribute('aria-pressed',String(on));
  });
  $('bLoc').addEventListener('click',async()=>{ const c2=await refreshConditions(); if(c2&&c2.lat!=null) map.flyTo([c2.lat,c2.lon],Math.max(map.getZoom(),12)); });
  $('bSpotPick').addEventListener('click',()=>{
    const en=window.LANG==='en', b=$('bSpotPick'); if(b.dataset.busy==='1') return; b.dataset.busy='1';
    const done=()=>{ b.dataset.busy=''; };
    if(!navigator.geolocation){ done(); toast(en?'No GPS on this device.':'Δεν υπάρχει GPS σε αυτή τη συσκευή.'); return; }
    toast(en?'Getting your position…':'Παίρνω τη θέση σου…');
    navigator.geolocation.getCurrentPosition(async p=>{
      const lat=+p.coords.latitude.toFixed(5), lon=+p.coords.longitude.toFixed(5), d=new Date();
      const nm=(en?'Spot ':'Σημείο ')+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
      try{ const id=await Store.save('spots',{name:nm,type:$('sType').options[0].value,lat:lat,lon:lon,depth:null,notes:''}); selSpot=id; setYou(lat,lon); map.flyTo([lat,lon],Math.max(map.getZoom(),14)); toast(en?'Spot saved at your position. Tap it to edit.':'Αποθηκεύτηκε το σημείο στη θέση σου. Πάτα πάνω του για επεξεργασία.'); }
      catch(e){ toast(en?'Not saved. Try again.':'Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'); }
      done();
    },()=>{ done(); toast(en?'Could not get your position. Turn on location.':'Δεν πήρα θέση. Άνοιξε την τοποθεσία (GPS).'); },{enableHighAccuracy:true,timeout:10000,maximumAge:3000});
  });
  $('mapHintX').addEventListener('click',()=>{const was=pick; endPick(); if(was==='bite') openSheet(); if(was==='fc') switchTab('fc'); if(was==='today') switchTab('today');});
  zonesG=L.layerGroup();
  for(const z of ZONES){
    const zs=zoneStyle(z);
    L.polygon(z.p,{color:zs.c,weight:zs.w,dashArray:zs.dash||null,fillColor:zs.c,fillOpacity:zs.fo,interactive:false}).addTo(zonesG); /* οι ζώνες δεν «κλέβουν» το πάτημα: οι πληροφορίες τους εμφανίζονται στο μενού του σημείου */
  }
  const zOn=lsGet('alkyon-zones',true); if(zOn) zonesG.addTo(map); $('bZones').setAttribute('aria-pressed',String(!!zOn));
  $('bZones').addEventListener('click',()=>{
    const on=!map.hasLayer(zonesG); if(on) zonesG.addTo(map); else map.removeLayer(zonesG);
    $('bZones').setAttribute('aria-pressed',String(on)); lsSet('alkyon-zones',on);
  });
  spotsG=L.layerGroup().addTo(map); bitesG=L.layerGroup();
  const bitesVis=()=>{ if(!map||!bitesG) return; const on=!!reviewSet||!!focusId||lsGet('alkyon-showbites',true)!==false; /* v31z351: ο διακόπτης «Ψάρια» ισχύει και κατά την έξοδο */ bitesVisRef=bitesVis; window.AlkyonCore.bitesVis=bitesVis; if(on&&!map.hasLayer(bitesG)) bitesG.addTo(map); if(!on&&map.hasLayer(bitesG)){ map.closePopup(); map.removeLayer(bitesG); } };
  const spotsVis=()=>{ if(!map||!spotsG) return; const on=lsGet('alkyon-showspots',true)!==false||!!pick||!!focusId; window.AlkyonCore.spotsVis=spotsVis; if(on&&!map.hasLayer(spotsG)) spotsG.addTo(map); if(!on&&map.hasLayer(spotsG)){ map.closePopup(); map.removeLayer(spotsG); } };
  setTimeout(spotsVis,100); setInterval(function(){ if(!document.hidden) spotsVis(); },2000);
  window.addEventListener('alkyon-sess',bitesVis); setTimeout(bitesVis,300); setTimeout(bitesVis,1500); setInterval(function(){ if(!document.hidden) bitesVis(); },3000);
  map.on('moveend',()=>{const p=map.getCenter(); lsSet('alkyon-view',{lat:+p.lat.toFixed(4),lon:+p.lng.toFixed(4),z:map.getZoom()});});
  let tapM=null, tapPop=null;
  map.on('click',e=>{
    const ll=e.latlng.wrap(), lat=+ll.lat.toFixed(5), lon=+ll.lng.toFixed(5);
    if(pick==='fc'){ endPick(); switchTab('fc'); window.dispatchEvent(new CustomEvent('alkyon-fcpick',{detail:{lat:lat,lon:lon}})); return; }
    if(pick==='today'){ endPick(); switchTab('today'); window.dispatchEvent(new CustomEvent('alkyon-todaypick',{detail:{lat:lat,lon:lon}})); return; }
    if(pick==='place'){ endPick(); window.dispatchEvent(new CustomEvent('alkyon-placepicked',{detail:{lat:lat,lon:lon}})); return; }
    if(pick==='spot'){ endPick(); openSpotForm({lat:lat,lon:lon}); return; }
    if(pick==='bite'){ endPick(); pickedPt={lat:lat,lon:lon}; $('bLocMode').value='pick'; syncLoc(); openSheet(); return; }
    const ic=d=>{const n='http://www.w3.org/2000/svg',s=document.createElementNS(n,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','pi');const p=document.createElementNS(n,'path');p.setAttribute('d',d);s.append(p);return s;};
    const act=(cls,d,txt,fn)=>h('button',{class:'pact '+cls,type:'button',onclick:fn},ic(d),h('span',{text:txt}));
    const zin=(zonesG&&map.hasLayer(zonesG))?zonesAt(lat,lon):[];
    const zbox=zin.length?h('div',{class:'note',style:'color:#d33;margin:2px 0 6px',text:'⚠ '+zin.map(zoneText).join(' | ')+' · '+(window.LANG==='en'?'Check Cy-FIS and the law.':'Επιβεβαίωσε στο Cy-FIS και στον νόμο.')}):null;
    const en2=window.LANG==='en', depthEl=h('span',{class:'pdepth',text:(en2?'Depth: …':'Βάθος: …')});
    depthLookup(lat,lon).then(d=>{ if(!depthEl.isConnected&&!depthEl.parentNode) return; depthEl.textContent=d!=null?((en2?'Depth: ≈ ':'Βάθος: ≈ ')+d+' m'):(en2?'Depth: not available':'Βάθος: δεν βρέθηκε'); if(d==null) depthEl.style.opacity='.6'; });
    const nbox=window.AlkyonNavInfo?window.AlkyonNavInfo(lat,lon,()=>map.closePopup()):null;
    const wxBox=h('div',{class:'pwx',text:en2?'Weather: …':'Καιρός: …'});
    const box=h('div',{class:'pop pmap'},h('div',{class:'pcoord'},ic('M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'),h('div',{},h('span',{class:'mono',text:AlkyonCoord.fmt(lat,lon)}),depthEl)),
      wxBox,
      zbox,
      nbox,
      act('','M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z M12 7v6 M9 10h6','Νέο σημείο',()=>{map.closePopup();openSpotForm({lat:lat,lon:lon});}),
      act('','M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9.5H7z','Πρόγνωση εδώ',()=>{map.closePopup();switchTab('today');window.dispatchEvent(new CustomEvent('alkyon-todaypick',{detail:{lat:lat,lon:lon}}));}),
      true?act('acc','M3 12c3-5.5 10-6 14-1.5l4-3.5v10l-4-3.5C13 17.5 6 17.5 3 12z','Τσίμπημα εδώ',()=>{map.closePopup();pickedPt={lat:lat,lon:lon};$('bLocMode').value='pick';syncLoc();openSheet();}):null);
    if(tapM){ map.removeLayer(tapM); tapM=null; }
    const pop=L.popup({className:'pmapw',minWidth:200,maxWidth:260,maxHeight:Math.max(220,Math.min(440,window.innerHeight-210)),autoPan:false}).setLatLng(ll).setContent(box); tapPop=pop; pop.openOn(map);
    const fit=()=>{ try{ const el=pop.getElement(); if(!el||!map.hasLayer(pop)) return; const w=el.querySelector('.leaflet-popup-content-wrapper').getBoundingClientRect(), m=map.getContainer().getBoundingClientRect(); let dx=0,dy=0; if(w.right>m.right-84) dx=(m.right-84)-w.right; if(w.left+dx<m.left+8) dx=m.left+8-w.left; if(w.top<m.top+84) dy=m.top+84-w.top; else if(w.bottom+24>m.bottom-112) dy=(m.bottom-112)-(w.bottom+24); if(dx||dy) map.panBy([-dx,-dy],{duration:.3}); }catch(e){} };
    setTimeout(fit,60);
    tapM=L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="tapdot"></div>',iconSize:[22,22]}),interactive:false,keyboard:false,zIndexOffset:1500}).addTo(map);
    fetchConditions(lat,lon).then(c=>{
      if(tapPop!==pop||!map.hasLayer(tapM)) return;
      const cell=(l,v)=>h('div',{},h('span',{class:'wl',text:l}),h('b',{text:v}));
      const dash='–';
      wxBox.replaceChildren(h('div',{class:'pwxg'},
        cell(en2?'Wind':'Άνεμος',c.wind!=null?PU.wind(c.wind)+(wdir(c)?' '+wdir(c):''):dash),cell(en2?'Waves':'Κύμα',c.wave!=null?PU.wave(c.wave):dash),
        cell(en2?'Air':'Αέρας',c.temp!=null?PU.temp(c.temp):dash),cell(en2?'Sea':'Θάλασσα',c.sst!=null?PU.temp(c.sst):dash),
        cell(en2?'Pressure':'Πίεση',c.press!=null?PU.press(c.press):dash),cell(en2?'Clouds':'Σύννεφα',c.cloud?({clear:en2?'Clear':'Καθαρός',part:en2?'Partly cloudy':'Μερικά',over:en2?'Overcast':'Συννεφιά'})[c.cloud]:dash)));
      pop.update(); setTimeout(fit,60);
    }).catch(()=>{ if(tapPop===pop) wxBox.textContent=en2?'Weather did not load':'Ο καιρός δεν φορτώθηκε'; });
  });
  map.on('popupclose',e=>{ if(e.popup===tapPop&&tapM){ map.removeLayer(tapM); tapM=null; } });
  /* v31z352: παρατεταμένο πάτημα στον χάρτη = γρήγορη καταγραφή σε εκείνο το σημείο (και από στεριά, χωρίς έξοδο) */
  map.on('contextmenu',e=>{
    if(pick) return; try{ if(e.originalEvent) e.originalEvent.preventDefault(); }catch(x){}
    const ll=e.latlng.wrap(), lat=+ll.lat.toFixed(5), lon=+ll.lng.toFixed(5), en=window.LANG==='en';
    try{ if(navigator.vibrate) navigator.vibrate(25); }catch(x){}
    const ic=d=>{const n='http://www.w3.org/2000/svg',sv=document.createElementNS(n,'svg');sv.setAttribute('viewBox','0 0 24 24');sv.setAttribute('class','pi');const pa=document.createElementNS(n,'path');pa.setAttribute('d',d);sv.append(pa);return sv;};
    const act=(cls,d,txt,fn)=>h('button',{class:'pact '+cls,type:'button',onclick:()=>{ map.closePopup(); fn(); }},ic(d),h('span',{text:txt}));
    const FISH='M3 12c3-5.5 10-6 14-1.5l4-3.5v10l-4-3.5C13 17.5 6 17.5 3 12z', PIN='M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z M12 7v6 M9 10h6';
    const box=h('div',{class:'pop pmap'},
      h('div',{class:'pcoord'},ic('M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'),h('div',{},h('span',{class:'mono',text:AlkyonCoord.fmt(lat,lon)}),h('span',{class:'pdepth',text:en?'Quick save here':'Γρήγορη καταγραφή εδώ'}))),
      act('acc',FISH,en?'Fish here':'Ψάρι εδώ',()=>quickAt(lat,lon,false)),
      act('',FISH,en?'Lost fish here':'Χαμένο εδώ',()=>quickAt(lat,lon,true)),
      act('',PIN,en?'Save spot here':'Σημείο εδώ',()=>spotAt(lat,lon)),
      act('','M4 6h16M4 12h16M4 18h10',en?'Full bite form':'Πλήρης καταγραφή',()=>{ pickedPt={lat:lat,lon:lon}; $('bLocMode').value='pick'; syncLoc(); openSheet(); }));
    if(tapM){ map.removeLayer(tapM); tapM=null; }
    const pop=L.popup({className:'pmapw',minWidth:200,maxWidth:260,autoPan:false}).setLatLng(ll).setContent(box); tapPop=pop; pop.openOn(map);
    tapM=L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="tapdot"></div>',iconSize:[22,22]}),interactive:false,keyboard:false,zIndexOffset:1500}).addTo(map);
  });
  try{ map.getContainer().addEventListener('pointerdown',()=>{ followPause=Date.now()+20000; },{passive:true,capture:true}); }catch(e){}
  if(cond&&cond.lat!=null) setYou(cond.lat,cond.lon);
  checkZoneHere();
}
let youHead=null, youPrev=null;
/* Πορεία: από το GPS αν κινείσαι (>~1,5 kn), αλλιώς από τη μετατόπιση ανάμεσα σε δύο θέσεις. Όταν στέκεσαι, κρατά την τελευταία πορεία. */
let navPrev=null, navSpd=null;
function navFix(c){
  try{
    const t=Date.now(); let v=(c.speed!=null&&isFinite(c.speed))?c.speed:null;
    if(v==null&&navPrev&&t-navPrev.t>=1500){ const R=6371000, dy=(c.latitude-navPrev.lat)*Math.PI/180*R, dx=(c.longitude-navPrev.lon)*Math.PI/180*R*Math.cos(c.latitude*Math.PI/180); v=Math.hypot(dx,dy)/((t-navPrev.t)/1000); }
    if(v!=null) navSpd=navSpd==null?v:navSpd*0.6+v*0.4;
    if(!navPrev||t-navPrev.t>=1500) navPrev={lat:c.latitude,lon:c.longitude,t:t};
    window.AlkyonNav={lat:c.latitude,lon:c.longitude,kn:navSpd==null?null:navSpd*1.94384,head:(typeof youHead!=='undefined'&&youHead!=null)?youHead:null,t:t};
  }catch(e){}
}
function headFix(lat,lon,gh,gs){
  try{
    if(gh!=null&&isFinite(gh)&&gs!=null&&isFinite(gs)&&gs>0.8){ youHead=gh; }
    else if(youPrev){ const R=6371000, dy=(lat-youPrev[0])*Math.PI/180*R, dx=(lon-youPrev[1])*Math.PI/180*R*Math.cos(lat*Math.PI/180), d=Math.hypot(dx,dy); if(d>15){ youHead=(Math.atan2(dx,dy)*180/Math.PI+360)%360; youPrev=[lat,lon]; } }
    if(!youPrev) youPrev=[lat,lon];
  }catch(e){}
}
function applyHead(){ try{ if(youHead!=null) window.dispatchEvent(new CustomEvent('alkyon-head',{detail:{head:youHead}})); }catch(e){} try{ const el=youM&&youM.getElement&&youM.getElement(), d=el&&el.firstChild; if(d) d.style.transform=(youHead==null?'':'rotate('+Math.round(youHead)+'deg)'); }catch(e){} }
function setYou(lat,lon){
  if(!map) return;
  try{ window.dispatchEvent(new CustomEvent('alkyon-pos',{detail:{lat:lat,lon:lon}})); }catch(e){}
  if(youM) youM.setLatLng([lat,lon]); else youM=L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="you"></div>',iconSize:[18,18]}),interactive:false,zIndexOffset:-100}).addTo(map);
  applyHead();
}
/* Ζωντανή θέση: η μπλε τελεία ακολουθεί το GPS όσο η εφαρμογή είναι ανοιχτή */
let youW=null;
/* Όσο είσαι σε έξοδο, ο χάρτης κρατά τη θέση σου στο κέντρο. Αν τον σύρεις ή τον πατήσεις, η παρακολούθηση σταματά για 20 δευτερόλεπτα και μετά συνεχίζει. */
let followPause=0; window.AlkyonFollowReset=function(){ followPause=0; };
function followMe(lat,lon){ try{ if(!map||!(document.body.classList.contains('ontrip')||(window.AlkyonOrient&&window.AlkyonOrient.mode()!=='NU'))||$('tab-map').hidden||Date.now()<followPause) return; map.panTo([lat,lon],{animate:true,duration:.6}); }catch(e){} }
function youStart(){
  if(youW!=null||!navigator.geolocation) return;
  try{ youW=navigator.geolocation.watchPosition(p=>{ const c=p.coords; if(c.accuracy&&c.accuracy>150) return; headFix(c.latitude,c.longitude,c.heading,c.speed); navFix(c); setYou(c.latitude,c.longitude); followMe(c.latitude,c.longitude); },()=>{},{enableHighAccuracy:true,maximumAge:2000,timeout:30000}); }catch(e){ youW=null; }
}
function youStop(){ if(youW!=null){ try{ navigator.geolocation.clearWatch(youW); }catch(e){} youW=null; } }
document.addEventListener('visibilitychange',()=>{ if(document.hidden) youStop(); else youStart(); });
setTimeout(youStart,1500);
function startPick(mode){
  pick=mode; $('mapHint').hidden=false; document.body.classList.add('picking');
  $('mapHintTxt').textContent=mode==='fc'?'Πάτα στον χάρτη για πρόγνωση σε αυτό το σημείο':mode==='today'?'Πάτα στον χάρτη για τον καιρό σε αυτό το σημείο':mode==='place'?(window.LANG==='en'?'Tap the map to choose where you will fish':'Πάτα στον χάρτη εκεί που θα ψαρέψεις'):mode==='spot'?'Πάτα στον χάρτη για το νέο σημείο':'Πάτα στον χάρτη εκεί που έπιασες';
  switchTab('map');
  /* v31z370: ο χάρτης ανοίγει στο σημείο της τρέχουσας πρόγνωσης (ή στη θέση σου), όχι όπου είχε μείνει */
  setTimeout(()=>{ try{ const c=window.AlkyonCore&&window.AlkyonCore.getCond&&window.AlkyonCore.getCond(), N=window.AlkyonNav;
    const ll=c&&c.lat!=null?[+c.lat,+c.lon]:(N&&N.lat!=null?[+N.lat,+N.lon]:null);
    if(map&&ll){ map.invalidateSize(); map.setView(ll,Math.max(10,Math.min(map.getZoom(),13))); } }catch(e){} },120);
}
function endPick(){ pick=null; $('mapHint').hidden=true; document.body.classList.remove('picking'); }
/* v31z351: χρώμα ζώνης ανάλογα με τον περιορισμό (από το κείμενο του διατάγματος).
   Σκούρο κόκκινο: απαγορεύεται και η διέλευση σκαφών · κόκκινο: απαγορεύεται η αλιεία · πορτοκαλί: εποχικός περιορισμός. */
const ZONE_COL={noentry:'#9f1239',nofish:'#e02020',season:'#e8890c'};
function zoneKind(z){ const d=(z&&z.d)||''; if(/\d{1,2}\/\d{1,2}\s*(μέχρι|έως|-)\s*\d{1,2}\/\d{1,2}/.test(d)&&!/ολόχρονα/.test(d)) return 'season'; if(/διέλευση/.test(d)&&!/διέλευση σκαφών επιτρέπεται/.test(d)) return 'noentry'; return 'nofish'; }
function zoneStyle(z){ const k=zoneKind(z); return {k:k,c:ZONE_COL[k],w:k==='noentry'?2.6:2,fo:k==='noentry'?.30:k==='season'?.18:.22,dash:k==='season'?'6 5':null}; }
window.AlkyonZoneStyle=zoneStyle; window.AlkyonZoneCols=ZONE_COL;
/* v31z351: «Στον χάρτη» από λίστα (έξοδοι, ψάρια, σημεία): το ✕ γυρίζει στην ίδια καρτέλα και στο ίδιο σημείο της λίστας */
let retTo=null;
function markReturn(){ const cur=['today','fc','log','guide'].find(n=>{ const e=$('tab-'+n); return e&&!e.hidden; }); const pr=$('profile'), prOpen=!!(pr&&!pr.hidden); retTo=cur||prOpen?{tab:cur||null,y:window.scrollY,prof:prOpen?{y:(pr.querySelector('.pbody,.sheet-in,.pbox')||pr).scrollTop}:null}:null; if(prOpen) pr.hidden=true; }
function goBack(){ const r=retTo; retTo=null; if(!r) return false; if(r.tab) switchTab(r.tab); const go=()=>{ window.scrollTo(0,r.y); if(r.prof){ const pr=$('profile'); if(pr){ pr.hidden=false; const sc=pr.querySelector('.pbody,.sheet-in,.pbox')||pr; sc.scrollTop=r.prof.y; } } }; requestAnimationFrame(go); setTimeout(go,150); return true; }
function backBar(text){ const en=window.LANG==='en'; let bar=$('reviewBar');
  if(!bar){ bar=h('div',{id:'reviewBar',class:'rvbar'},h('span',{class:'rvtx'}),h('button',{type:'button',class:'rvx','aria-label':en?'Close':'Κλείσιμο',text:'✕',onclick:endReview})); document.querySelector('.mapbox').appendChild(bar); }
  bar.querySelector('.rvtx').textContent=text; bar.hidden=false; return bar; }
function showOnMap(lat,lon,id){
  const fromList=!!(document.querySelector('#tab-map[hidden]'))||!!($('profile')&&!$('profile').hidden);
  if(fromList){ markReturn(); backOnly=true; const b=Store.get('bites').find(x=>x.id===id)||(Store.misses?Store.misses().find(x=>x.id===id):null), sp=Store.get('spots').find(x=>x.id===id), en=window.LANG==='en'; backBar(b?((b.n?'#'+b.n+' ':'')+(b.species||(en?'Fish':'Ψάρι'))+(b.date?' · '+b.date.slice(8,10)+'/'+b.date.slice(5,7):'')):sp?sp.name||(en?'Spot':'Σημείο'):(en?'On the map':'Στον χάρτη')); }
  return showOnMap0(lat,lon,id);
}
function showOnMap0(lat,lon,id){
  switchTab('map'); if(!map) return;
  if(id) setFocus(id);
  followPause=Date.now()+5*60000; /* κατά την έξοδο ο χάρτης δεν γυρίζει αμέσως στη βάρκα */
  setTimeout(()=>map.flyTo([lat,lon],Math.max(map.getZoom(),15)),120);
  setTimeout(()=>{ const m=markerById[id]; if(m) m.openPopup(); },800);
}
function sharePlace(name,lat,lon){
  const en=window.LANG==='en', txt=(name||'')+'\n'+AlkyonCoord.fmt(lat,lon)+'\nhttps://maps.google.com/?q='+lat.toFixed(5)+','+lon.toFixed(5);
  if(navigator.share) navigator.share({title:name||'Alkyon',text:txt}).catch(()=>{});
  else if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(()=>toast(en?'Copied.':'Αντιγράφηκε.'));
  else window.prompt(en?'Copy':'Αντίγραψε',txt);
}
async function toggleRel(b){
  const en=window.LANG==='en';
  try{ const nb=Object.assign({},b); if(nb.rel) delete nb.rel; else nb.rel=true; await Store.save('bites',nb); if(b.trip) await recountTrip(b.trip); map&&map.closePopup(); toast(nb.rel?(en?'Marked as catch & release.':'Σημειώθηκε ως catch & release.'):(en?'Release mark removed.':'Αφαιρέθηκε η ένδειξη catch & release.')); }
  catch(e){ toast(en?'Not saved. Try again.':'Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'); }
}
function setsOf(b){ try{ if(!b||!b.tk||!b.tk.length||!window.AlkyonTackle) return []; return AlkyonTackle.all().filter(x=>x.type==='set'&&(x.members||[]).length&&x.members.every(i=>b.tk.indexOf(i)>=0)).map(x=>x.name||'—'); }catch(e){ return []; } }
function setsUsed(list){ const m=new Map(); (list||[]).forEach(b=>setsOf(b).forEach(n=>m.set(n,(m.get(n)||0)+1))); return [...m.entries()].sort((x,y)=>y[1]-x[1]); }
function tkLine(b){ try{ if(!b||!b.tk||!b.tk.length||!window.AlkyonTackle) return ''; const nm=AlkyonTackle.names(); const parts=b.tk.map(id=>{ const n=nm[id]; if(!n) return null; const w=b.tkw&&b.tkw[id]; return n+(w?' '+w+' g':''); }).filter(Boolean); return parts.length?'🧰 '+parts.join(' · '):''; }catch(e){ return ''; } }
/* v31z363: «ξεκούραση» σημείου. Μελέτες: τα ψάρια όπου ψαρεύεται πολύ μαθαίνουν να αποφεύγουν το αγκίστρι (Alós κ.ά. 2015, Μαγιόρκα),
   και όσο περισσότερο ψαρεύτηκε ένα νερό τις 2 προηγούμενες μέρες, τόσο λιγότερα έπιαναν (Kuparinen κ.ά. 2010). Μετρά τις μέρες που ψάρεψες σε ακτίνα 300 μ. τις τελευταίες 3 μέρες. */
const REST_R=0.3, REST_D=3;
function restDays(lat,lon){
  if(typeof lat!=='number'||typeof lon!=='number') return [];
  const today=nicosiaToday(), lo=new Date(Date.parse(today+'T12:00:00Z')-(REST_D-1)*86400000).toISOString().slice(0,10), days=new Set();
  const near=(a,b)=>typeof a==='number'&&typeof b==='number'&&haversine(lat,lon,a,b)<=REST_R;
  (Store.raw?Store.raw('bites'):Store.get('bites')).forEach(b=>{ if(b.date&&b.date>=lo&&b.date<=today&&near(b.lat,b.lon)) days.add(b.date); });
  (Store.get('trips')||[]).forEach(t=>{ if(!t.date||t.date<lo||t.date>today) return; if(near(t.lat,t.lon)||(Array.isArray(t.track)&&t.track.some(q=>near(q[0],q[1])))) days.add(t.date); });
  return [...days].sort();
}
function restAlt(lat,lon){
  const en=window.LANG==='en', c=[];
  Store.get('spots').forEach(sp=>{ if(typeof sp.lat==='number'&&haversine(lat,lon,sp.lat,sp.lon)>REST_R*2&&restDays(sp.lat,sp.lon).length<2) c.push({name:sp.name||(en?'Spot':'Σημείο'),lat:sp.lat,lon:sp.lon,d:haversine(lat,lon,sp.lat,sp.lon)}); });
  return c.sort((a,b)=>a.d-b.d)[0]||null;
}
function restNode(lat,lon){
  const ds=restDays(lat,lon); if(ds.length<2) return null;
  const en=window.LANG==='en', alt=restAlt(lat,lon);
  const box=h('div',{class:'meta restnote',style:'margin-top:6px;padding:6px 8px;border-radius:10px;background:rgba(232,84,30,.12);color:inherit'},
    h('div',{text:(en?'🔁 Fished here on ':'🔁 Ψάρεψες εδώ ')+ds.length+(en?' of the last ':' από τις τελευταίες ')+REST_D+(en?' days. Fish in heavily fished spots learn to avoid hooks. Give it a rest and try another spot.':' μέρες. Τα ψάρια σε σημεία που ψαρεύονται συχνά μαθαίνουν να αποφεύγουν το αγκίστρι. Άφησέ το να ξεκουραστεί και δοκίμασε άλλο σημείο.')}));
  if(alt){ box.append(h('div',{style:'margin-top:4px',text:(en?'Nearest rested spot: ':'Πιο κοντινό ξεκούραστο σημείο: ')+alt.name+' · '+(alt.d<10?alt.d.toFixed(1):Math.round(alt.d))+' km'}));
    if(window.AlkyonDirect) box.append(h('button',{class:'btn ghost sm',type:'button',style:'margin-top:4px',text:en?'Go there':'Πηγαίνω εκεί',onclick:()=>{ try{ map&&map.closePopup(); window.AlkyonSheet&&window.AlkyonSheet.close(); }catch(e){} window.AlkyonDirect.go(alt.lat,alt.lon,alt.name); }})); }
  return box;
}
window.AlkyonRest={days:restDays,node:restNode};
function catchPopup(b){
  const nn=bc(b);
  const img=h('img',{class:'pimg',alt:'Φωτογραφία ψαριού'}); img.hidden=true;
  const cd=[b.wind!=null?PU.wind(b.wind)+wdTxt(b):null,b.wave!=null?PU.wave(b.wave)+(window.LANG==='en'?' wave':' κύμα'):null,b.press!=null?PU.press(b.press):null,b.sst!=null?PU.temp(b.sst)+(window.LANG==='en'?' sea':' θάλασσα'):null,MOON_LBL[biteMoon(b)],b.hist?(window.LANG==='en'?'estimate':'εκτίμηση'):null].filter(Boolean).join(' · ');
  const size=[b.kg?b.kg+' kg':null,b.len?b.len+' cm':null].filter(Boolean).join(' · ');
  return h('div',{class:'pop fishpop'},img,h('b',{text:(b.n?'#'+b.n+' · ':'')+(b.species||'Άγνωστο')+(nn>1?' ×'+nn:'')}),b.latin?h('div',{class:'meta',text:b.latin}):null,
    h('div',{class:'meta mono',text:(b.date||'')+' '+(b.time||'')}),
    size?h('div',{text:size}):null,
    b.rel?h('div',{class:'meta',style:'color:#2e9e5b;font-weight:700',text:(window.LANG==='en'?'↩ Catch & release':'↩ Αφέθηκε')}):null,
    (b.bait||b.tech)?h('div',{class:'meta',text:[b.bait,b.tech].filter(Boolean).join(' · ')}):null,
    tkLine(b)?h('div',{class:'meta',text:tkLine(b)}):null,
    cd?h('div',{class:'meta',text:cd}):null,b.notes?h('div',{class:'meta',text:b.notes}):null,
    typeof b.lat==='number'?h('div',{class:'meta mono',text:AlkyonCoord.fmt(b.lat,b.lon)}):null,
    restNode(b.lat,b.lon),
    h('div',{class:'row pbtns',style:'margin-top:6px'},
      h('button',{class:'btn sm ghost',type:'button',text:window.LANG==='en'?'✎ Edit':'✎ Επεξεργασία',onclick:()=>{ if(map) map.closePopup(); editBite(b); }}),
      typeof b.lat==='number'?h('button',{class:'btn sm',type:'button',text:window.LANG==='en'?'Send':'Στείλε',onclick:()=>sharePlace((b.species||'')+(b.kg?' · '+b.kg+' kg':''),b.lat,b.lon)}):null));
}
function spFilt(){ try{ return lsGet('alkyon-spf','')||''; }catch(e){ return ''; } }
document.addEventListener('alkyon-spfilter',function(){ try{ drawMap(); }catch(e){} });

/* v31z354: σύμβολα ανά ομάδα ψαριών και ανά τύπο σημείου */
const SYM_SVG={fish:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12c3-5 10-5.5 13.5-1.2L21 7v10l-5-3.8C12.5 17.5 5.5 17 2.5 12z"/><circle cx="7.2" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>',
  ceph:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 0 5 2.4 5 5.5V13H7V8.5C7 5.4 9 3 12 3z"/><path d="M8 13c0 3-1.5 5-3 7M10.5 13c0 3-.5 5.5-1.5 7.5M13.5 13c0 3 .5 5.5 1.5 7.5M16 13c0 3 1.5 5 3 7"/></svg>'};
const FISH_GROUPS=[
  ['ceph',/^(loligo|sepia|octopus|sepioteuthis|illex|todarodes|alloteuthis|eledone)\b/i,/καλαμ|σουπι|χταπ|θράψαλ|squid|cuttle|octopus/i],
  ['grouper',/^(epinephelus|mycteroperca|cephalopholis|polyprion)\b/i,/σφυρίδ|ροφ|στήρα|βλάχ|grouper|wreckfish/i],
  ['bass',/^(dicentrarchus)\b/i,/λαβρ|seabass|sea bass/i],
  ['pelagic',/^(thunnus|euthynnus|sarda|seriola|lichia|coryphaena|scomber|auxis|pomatomus|sphyraena|trachinotus|scomberomorus|katsuwonus|xiphias)\b/i,/τόνο|παλαμ|μαγιάτικ|λίτσα|λύτσα|κυνηγ|σκουμπρ|κολι|γοφάρ|λούτζ|ξιφί|tuna|bonito|amberjack|leerfish|dolphinfish|mackerel|bluefish|barracuda|swordfish/i],
  ['sparid',/^(diplodus|sparus|pagrus|pagellus|dentex|oblada|lithognathus|spondyliosoma|sarpa|boops|crenidens)\b/i,/σαργ|τσιπούρ|φαγκρ|λυθρίν|μουρμ|συναγρίδ|μελανούρ|σκαθάρ|σάλπα|γόπα|bream|dentex|pandora|porgy/i],
  ['mullet',/^(mullus)\b/i,/μπαρμπούν|κουτσομούρ|red mullet|goatfish/i]];
function fishGroup(b){ const la=(b.latin||'').trim(), nm=((b.species||'')+' '+(b.en||'')).trim(); for(const g of FISH_GROUPS){ if((la&&g[1].test(la))||(nm&&g[2].test(nm))) return g[0]; } return 'other'; }
function spotKind(sp){ const t=(sp.type||''); return /ναυάγ|wreck/i.test(t)?'wreck':/άμμο|sand/i.test(t)?'sand':/ταμπλ|κατωφλ|drop|ledge|step/i.test(t)?'ledge':/ρεύμ|ανοιχτ|current|open/i.test(t)?'current':/λιμάν|μώλ|port|jetty|pier|harbo/i.test(t)?'port':/βράχ|ύφαλ|rock|reef/i.test(t)?'reef':'other'; }
window.AlkyonSym={fishGroup:fishGroup,spotKind:spotKind,svg:SYM_SVG};
function drawMap(){
  if(!map) return;
  spotsG.clearLayers(); bitesG.clearLayers();
  for(const k in markerById) delete markerById[k];
  for(const sp of Store.get('spots')){
    if(typeof sp.lat!=='number'||typeof sp.lon!=='number') continue;
    if(lsGet('alkyon-showspots',true)===false&&!pick&&sp.id!==focusId) continue;
    const m=L.marker([sp.lat,sp.lon],{icon:L.divIcon({className:'',html:'<div class="mk-spot sym t-'+spotKind(sp)+(sp.id===selSpot?' sel':'')+'"></div>',iconSize:[22,22]}),title:sp.name});
    m.bindTooltip(sp.name||'',{direction:'right',offset:[10,0],className:'lbl'});
    m.bindPopup(()=>h('div',{class:'pop'},h('b',{text:sp.name||'Χωρίς όνομα'}),h('div',{class:'meta',text:[sp.type,sp.depth!=null?sp.depth+' m':null].filter(Boolean).join(' · ')}),sp.notes?h('div',{class:'meta',text:sp.notes}):null,
      h('div',{class:'meta mono',text:AlkyonCoord.fmt(sp.lat,sp.lon)}),
      restNode(sp.lat,sp.lon),
      h('div',{class:'row',style:'margin-top:6px'},h('button',{class:'btn acc sm',type:'button',text:'Τσίμπημα εδώ',onclick:()=>{map.closePopup();pickedPt=null;$('bLocMode').value='spot';syncLoc();$('bSpot').value=sp.id;openSheet();}})),
      h('div',{class:'row',style:'margin-top:6px'},
        h('button',{class:'btn sm',type:'button',text:'Επεξεργασία',onclick:()=>{map.closePopup();openSpotForm({lat:sp.lat,lon:sp.lon},sp);}}),
        h('button',{class:'btn sm',type:'button',text:window.LANG==='en'?'Send':'Στείλε',onclick:()=>sharePlace(sp.name,sp.lat,sp.lon)}),
        h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή',onclick:()=>{ const en=window.LANG==='en'; map.closePopup();
          window.AlkyonAsk(sp.name||'',{title:en?'Delete this spot?':'Διαγραφή σημείου',ok:en?'Delete':'Διαγραφή',cancel:en?'Cancel':'Άκυρο',danger:true}).then(ok=>{ if(ok){ Store.remove('spots',sp.id).catch(()=>{}); toast(en?'Deleted.':'Διαγράφηκε.'); } }); }}))));
    m.addTo(spotsG); markerById[sp.id]=m;
  }
  const visB=[];
  for(const b of Store.get('bites')){
    if(spFilt()&&b.species!==spFilt()) continue;
    if(typeof b.lat!=='number'||typeof b.lon!=='number') continue;
    if(reviewSet&&!tripActive()&&!reviewSet.has(b.id)) continue;
    if(lsGet('alkyon-showbites',true)===false&&!reviewSet&&b.id!==focusId) continue;
    visB.push(b);
  }
  hotDraw(visB);
  /* Χαμένα ψάρια (αστοχίες): μικρό ✕ στη θέση που τσίμπησαν */
  for(const b of (Store.misses?Store.misses():[])){
    if(spFilt()||(lsGet('alkyon-showmiss',true)===false&&b.id!==focusId)) continue;
    if(typeof b.lat!=='number'||typeof b.lon!=='number') continue;
    if(reviewSet&&!tripActive()) continue;
    const en=window.LANG==='en';
    const mm=L.marker([b.lat,b.lon],{icon:L.divIcon({className:'',html:'<div class="mk-fish mk-miss">✕</div>',iconSize:[26,26]}),title:en?'Lost bite':'Χάθηκε'});
    mm.bindPopup(()=>h('div',{class:'pop'},h('b',{text:en?'Lost bite ✕':'Χάθηκε ✕'}),h('div',{class:'meta mono',text:(b.date||'')+' '+(b.time||'')}),(b.bait||b.tech)?h('div',{class:'meta',text:[b.bait,b.tech].filter(Boolean).join(' · ')}):null,tkLine(b)?h('div',{class:'meta',text:tkLine(b)}):null,h('div',{class:'meta mono',text:AlkyonCoord.fmt(b.lat,b.lon)}),missCond(b)?h('div',{class:'meta',text:missCond(b)}):null,window.AlkyonBiteWx?window.AlkyonBiteWx.slot(b):null,h('div',{class:'row pbtns',style:'margin-top:6px'},h('button',{class:'btn sm ghost',type:'button',text:en?'Delete':'Διαγραφή',onclick:()=>{ window.AlkyonAsk(en?'Delete this lost bite?':'Να διαγραφεί αυτή η αστοχία;',{title:en?'Delete lost bite':'Διαγραφή αστοχίας',ok:en?'Delete':'Διαγραφή',cancel:en?'Cancel':'Άκυρο',danger:true}).then(ok=>{ if(!ok) return; Store.remove('bites',b.id).then(()=>{ try{ map.closePopup(); }catch(e){} toast(en?'Deleted.':'Διαγράφηκε.'); }).catch(()=>{}); }); }}))),{minWidth:150,maxWidth:230});
    mm.addTo(bitesG); markerById[b.id]=mm;
  }
  if(pendM){map.removeLayer(pendM);pendM=null;}
  if(pending) pendM=L.circleMarker([pending.lat,pending.lon],{radius:10,color:'#d8431c',weight:3,fillOpacity:.15}).addTo(map);
}
function fishMarker(b){
    const m=L.marker([b.lat,b.lon],{icon:L.divIcon({className:'',html:'<div class="mk-fish sym g-'+fishGroup(b)+(b.photo?' ph':'')+(b.rel?' rel':'')+(b.prof==='lake'?' src-lake':b.prof==='spear'?' src-spear':'')+'">'+SYM_SVG[fishGroup(b)==='ceph'?'ceph':'fish']+'</div>',iconSize:[30,30]}),title:b.species||''});
    m.bindPopup(()=>catchPopup(b),{minWidth:200,maxWidth:250,className:'fishpopw'});
    m.on('popupopen',e=>{const pu=e.popup, im=pu.getElement().querySelector('img.pimg');
      /* το παράθυρο ψαριού μπαίνει στο κέντρο του χάρτη, και ξανά όταν φορτώσει η φωτογραφία */
      const center=()=>{ const el=pu.getElement(); if(!el||!map||!map.hasLayer(pu)) return; const pr=el.getBoundingClientRect(), cr=map.getContainer().getBoundingClientRect(); const dx=(pr.left+pr.width/2)-(cr.left+cr.width/2), dy=(pr.top+pr.height/2)-(cr.top+cr.height/2); if(Math.abs(dx)>4||Math.abs(dy)>4) map.panBy([dx,dy],{animate:true,duration:.25}); };
      setTimeout(center,90);
      if(im){ im.addEventListener('load',()=>setTimeout(center,60)); if(b.photo) loadPhoto(b.id,im); }});
    m.on('add',()=>{
      const el=m.getElement(); if(!el||el.dataset.lp) return; el.dataset.lp='1';
      let t=null,held=false,x0=0,y0=0;
      el.addEventListener('pointerdown',e=>{ held=false; x0=e.clientX; y0=e.clientY; clearTimeout(t); t=setTimeout(()=>{ held=true; try{ if(navigator.vibrate) navigator.vibrate(30); }catch(x){}
        const en=window.LANG==='en', name=(b.n?'#'+b.n+' ':'')+(b.species||(en?'fish':'ψάρι'))+(b.kg?' · '+b.kg+' kg':'');
        window.AlkyonAsk(name,{title:en?'Delete this fish?':'Διαγραφή ψαριού',ok:en?'Delete':'Διαγραφή',cancel:en?'Cancel':'Άκυρο',danger:true}).then(ok=>{ if(!ok) return; Store.remove('bites',b.id).then(()=>Promise.all(phKeys(b).map(k=>Photos.del(k)))).catch(()=>{}); toast(en?'Deleted.':'Διαγράφηκε.'); });
      },500); });
      el.addEventListener('pointermove',e=>{ if(Math.abs(e.clientX-x0)+Math.abs(e.clientY-y0)>12) clearTimeout(t); });
      ['pointerup','pointercancel','pointerleave'].forEach(ev=>el.addEventListener(ev,()=>clearTimeout(t)));
      el.addEventListener('contextmenu',e=>e.preventDefault());
      el.addEventListener('click',e=>{ if(held){ held=false; e.stopPropagation(); e.preventDefault(); } },true);
    });
    m.addTo(bitesG); markerById[b.id]=m;
    return m;
}
/* ---------- v31z400: ψαρότοποι (hotspots) ----------
   Ψάρια με το ίδιο όνομα σημείου (σε απόσταση έως 1 km) γίνονται πάντα μία ομάδα. Τα υπόλοιπα ενώνονται όταν
   πέφτουν το ένα πάνω στο άλλο στην οθόνη (≤ 30 px στο τρέχον zoom). Ομάδα: μεγαλύτερο/σκουρότερο σημάδι με αριθμό,
   ★ αν υπάρχει ψάρι τις τελευταίες 30 μέρες. Πάτημα: κάρτα σημείου (Ψάρια · Πότε · Τώρα). Παρατεταμένο: άπλωμα. */
let spiderG=null, hotWired=false;
function hotWire(){ if(hotWired||!map) return; hotWired=true; let t=null;
  map.on('zoomend',()=>{ clearTimeout(t); t=setTimeout(()=>{ try{ if(!map._popup||!map.hasLayer(map._popup)) drawMap(); }catch(e){} },80); });
  map.on('click',()=>unspider()); }
function unspider(){ if(spiderG&&map){ map.removeLayer(spiderG); spiderG=null; } }
function hotDraw(list){
  hotWire(); unspider();
  const solo=[], G=[], z=map.getZoom(), px=b=>map.project([b.lat,b.lon],z);
  for(const b of list){
    if(b.id===focusId){ solo.push(b); continue; }
    let g=null;
    if(b.place){ g=G.find(x=>x.name===b.place&&haversine(x.lat0,x.lon0,b.lat,b.lon)<=1); }
    if(!g){ const p=px(b); g=G.find(x=>{ const q=map.project([x.lat0,x.lon0],z); return Math.hypot(q.x-p.x,q.y-p.y)<=30&&(!x.name||!b.place||x.name===b.place); }); }
    if(!g){ g={name:b.place||'',lat0:b.lat,lon0:b.lon,bs:[]}; G.push(g); }
    if(!g.name&&b.place) g.name=b.place; g.bs.push(b);
  }
  solo.forEach(fishMarker);
  for(const g of G){ if(g.bs.length===1){ fishMarker(g.bs[0]); continue; }
    /* όνομα μόνο αν όλα τα ψάρια είναι στο ίδιο σημείο· αλλιώς «Περιοχή» με τα ονόματα */
    const nm=[...new Set(g.bs.map(b=>b.place||''))]; g.mixed=nm.length>1; g.places=nm.filter(Boolean); if(g.mixed) g.name='';
    hotMarker(g); }
}
function bCount(bs){ return bs.reduce((a,b)=>a+(bc(b)||1),0); }
function hotMarker(g){
  const bs=g.bs, n=bCount(bs), lat=bs.reduce((a,b)=>a+b.lat,0)/bs.length, lon=bs.reduce((a,b)=>a+b.lon,0)/bs.length;
  g.lat=lat; g.lon=lon;
  const gc={}; bs.forEach(b=>{ const k=fishGroup(b); gc[k]=(gc[k]||0)+1; }); const top=Object.keys(gc).sort((a,b)=>gc[b]-gc[a])[0];
  const recent=bs.some(b=>Date.now()-biteMs(b)<30*86400000), lv=n>=20?4:n>=10?3:n>=5?2:1, sz=Math.round(32+Math.min(18,6*Math.log2(n)));
  const html='<div class="mk-hot lv'+lv+'" style="width:'+sz+'px;height:'+sz+'px">'+(SYM_SVG[top]||SYM_SVG.fish)+'<b>'+n+'</b>'+(recent?'<i>★</i>':'')+'</div>';
  const m=L.marker([lat,lon],{icon:L.divIcon({className:'',html:html,iconSize:[sz,sz]}),title:(g.name?g.name+' · ':'')+n,zIndexOffset:100+n});
  m.bindTooltip((g.name?g.name+' · ':'')+n+(window.LANG==='en'?' fish':' ψάρια'),{direction:'right',offset:[sz/2,0],className:'lbl'});
  m.bindPopup(()=>hotCard(g),{minWidth:260,maxWidth:320,className:'fishpopw hotpopw'});
  m.on('add',()=>{ const el=m.getElement(); if(!el||el.dataset.lp) return; el.dataset.lp='1'; let t=null,held=false,x0=0,y0=0;
    el.addEventListener('pointerdown',e=>{ held=false; x0=e.clientX; y0=e.clientY; clearTimeout(t); t=setTimeout(()=>{ held=true; try{ if(navigator.vibrate) navigator.vibrate(25); }catch(x){} spider(g); },450); });
    el.addEventListener('pointermove',e=>{ if(Math.abs(e.clientX-x0)+Math.abs(e.clientY-y0)>12) clearTimeout(t); });
    ['pointerup','pointercancel','pointerleave'].forEach(ev=>el.addEventListener(ev,()=>clearTimeout(t)));
    el.addEventListener('contextmenu',e=>e.preventDefault());
    el.addEventListener('click',e=>{ if(held){ held=false; e.stopPropagation(); e.preventDefault(); } },true); });
  m.addTo(bitesG); bs.forEach(b=>{ markerById[b.id]=m; });
  return m;
}
/* άπλωμα: τα ψάρια της ομάδας σε κύκλο γύρω της */
function spider(g){
  unspider(); map.closePopup(); spiderG=L.layerGroup().addTo(map);
  const z=map.getZoom(), c=map.project([g.lat,g.lon],z), bs=g.bs.slice().sort((a,b)=>biteMs(b)-biteMs(a)).slice(0,24), N=bs.length, R=Math.max(46,N*7);
  bs.forEach((b,i)=>{ const an=-Math.PI/2+i*2*Math.PI/N, p=L.point(c.x+R*Math.cos(an),c.y+R*Math.sin(an)), ll=map.unproject(p,z);
    L.polyline([[g.lat,g.lon],ll],{color:'#fff',weight:1.5,opacity:.85,interactive:false}).addTo(spiderG);
    const m=fishMarker(Object.assign({},b,{lat:ll.lat,lon:ll.lng})); bitesG.removeLayer(m); m.addTo(spiderG); markerById[b.id]=m; });
}
const DNs=()=>window.LANG==='en'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρι','Τετ','Πέμ','Παρ','Σάβ'];
function bLabel(b){ const d=new Date((b.date||'2000-01-01')+'T12:00:00Z'); return DNs()[d.getUTCDay()]+' '+d.getUTCDate()+'/'+(d.getUTCMonth()+1)+'/'+String(d.getUTCFullYear()).slice(2)+(b.time?' '+b.time:''); }
function openBite(b){
  if(!map) return; map.closePopup();
  const p=L.popup({minWidth:200,maxWidth:250,className:'fishpopw'}).setLatLng([b.lat,b.lon]).setContent(catchPopup(b)).openOn(map);
  setTimeout(()=>{ try{ const im=p.getElement().querySelector('img.pimg'); if(im&&b.photo) loadPhoto(b.id,im); }catch(e){} },30);
}
function hotCard(g){
  const en=window.LANG==='en', T2=(a,b)=>en?b:a, bs=g.bs.slice().sort((a,b)=>biteMs(b)-biteMs(a)), n=bCount(bs);
  const kg=Math.round(bs.reduce((a,b)=>a+(+b.kg||0),0)*10)/10, sp={}; bs.forEach(b=>{ const k=b.species||T2('Άγνωστο','Unknown'); sp[k]=(sp[k]||0)+(bc(b)||1); });
  const spT=Object.keys(sp).sort((a,b)=>sp[b]-sp[a]).slice(0,4).map(k=>k+' ×'+sp[k]).join(', ');
  const box=h('div',{class:'pop hotcard'});
  box.append(h('b',{text:(g.name||(g.mixed?T2('Περιοχή','Area'):T2('Ψαρότοπος','Fishing spot')))+' · '+n+T2(' ψάρια',' fish')}),h('div',{class:'meta',text:[kg?T2('Σύνολο ','Total ')+kg+' kg':null,spT].filter(Boolean).join(' · ')}));
  if(g.mixed) box.append(h('div',{class:'meta',text:(g.places.length?g.places.join(', ')+' '+T2('και άλλα σημεία','and other spots'):T2('Διάφορα σημεία','Several spots'))+' · '+T2('μεγέθυνε για να χωρίσουν','zoom in to separate them')}));
  const tabs=h('div',{class:'hottabs',role:'tablist'}), body=h('div',{class:'hotbody'});
  const TB=[['fish',T2('Ψάρια','Fish')],['when',T2('Πότε','When')],['now',T2('Τώρα','Now')]];
  /* v31z404: προαιρετικά και τα ψάρια των φίλων σε 500 m (Φίλοι → «Να μετράνε…») */
  const frb=(window.AlkyonFriends&&window.AlkyonFriends.bitesNear)?window.AlkyonFriends.bitesNear(g.lat,g.lon,0.5).filter(b=>b.date):[], all=bs.concat(frb).sort((a,b)=>biteMs(b)-biteMs(a));
  if(frb.length) box.append(h('div',{class:'meta',text:T2('+ ',' + ')+frb.length+T2(' ψάρια φίλων (',' friends’ fish (')+[...new Set(frb.map(b=>b._fr))].join(', ')+')'}));
  const show=k=>{ [].forEach.call(tabs.children,x=>x.setAttribute('aria-selected',String(x.dataset.k===k))); body.replaceChildren(); if(k==='fish') hotFish(body,all); else if(k==='when') hotWhen(body,all); else hotNow(body,g,all); };
  TB.forEach(t=>{ const b=h('button',{type:'button',role:'tab',text:t[1]}); b.dataset.k=t[0]; b.addEventListener('click',e=>{ e.stopPropagation(); show(t[0]); }); tabs.append(b); });
  box.append(tabs,body); show('fish');
  const sp0=g.mixed?null:Store.get('spots').find(x=>x.name&&x.name===g.name&&haversine(x.lat,x.lon,g.lat,g.lon)<=1);
  box.append(h('div',{class:'row pbtns',style:'margin-top:8px'},
    h('button',{class:'btn acc sm',type:'button',text:T2('Τσίμπημα εδώ','Bite here'),onclick:()=>{ map.closePopup(); if(sp0){ pickedPt=null; $('bLocMode').value='spot'; syncLoc(); $('bSpot').value=sp0.id; } else { pickedPt={lat:g.lat,lon:g.lon}; $('bLocMode').value='pick'; syncLoc(); } openSheet(); }}),
    h('button',{class:'btn sm',type:'button',text:T2('Στείλε','Send'),onclick:()=>sharePlace(g.name||'',g.lat,g.lon)})));
  return box;
}
function hotFish(body,bs){
  const en=window.LANG==='en', ls=h('div',{class:'hotlist'});
  bs.slice(0,60).forEach(b=>{
    const nn=bc(b), row=h('button',{type:'button',class:'hotrow'});
    if(b.photo&&!b._fr){ const im=h('img',{class:'hotth',alt:''}); im.hidden=true; row.append(im); setTimeout(()=>{ try{ loadPhoto(b.id,im); }catch(e){} },20); } else { const ic=h('span',{class:'hotth hotsym'}); ic.innerHTML=SYM_SVG[fishGroup(b)]||SYM_SVG.fish; row.append(ic); }
    row.append(h('span',{class:'hottx'},h('b',{text:(b.species||(en?'Unknown':'Άγνωστο'))+(nn>1?' ×'+nn:'')+(b.kg?' · '+b.kg+' kg':'')+(b.rel?' ↩':'')}),h('small',{text:bLabel(b)+(b.bait?' · '+b.bait:'')+(b._fr?' · '+b._fr:'')})));
    if(b._fr) row.classList.add('hotfr'); else row.addEventListener('click',e=>{ e.stopPropagation(); openBite(b); }); ls.append(row); });
  if(bs.length>60) ls.append(h('div',{class:'meta',text:'+'+(bs.length-60)}));
  body.append(ls);
}
function bars(vals,labels,hl){
  const mx=Math.max(1,...vals), w=h('div',{class:'hotbars'});
  vals.forEach((v,i)=>{ const c=h('div',{class:'hb'+(hl===i?' on':'')}); const f=h('i'); f.style.height=Math.round(v/mx*100)+'%'; c.append(f,h('span',{text:labels[i]||''})); c.title=(labels[i]||i)+': '+v; w.append(c); });
  return w;
}
function hotWhen(body,bs){
  const en=window.LANG==='en', T2=(a,b)=>en?b:a, M=new Array(12).fill(0), H=new Array(8).fill(0), tot=bs.length;
  bs.forEach(b=>{ const w=bc(b)||1; if(b.date) M[+b.date.slice(5,7)-1]+=w; if(b.time) H[Math.floor(+b.time.slice(0,2)/3)]+=w; });
  const ML=en?['J','F','M','A','M','J','J','A','S','O','N','D']:['Ι','Φ','Μ','Α','Μ','Ι','Ι','Α','Σ','Ο','Ν','Δ'];
  body.append(h('div',{class:'ds-over hoth',text:T2('Μήνες','Months')}),bars(M,ML,new Date().getMonth()));
  body.append(h('div',{class:'ds-over hoth',text:T2('Ώρες','Hours')}),bars(H,['00','03','06','09','12','15','18','21'],Math.floor(new Date().getHours()/3)));
  const cnt=(f)=>{ const o={}; let k=0; bs.forEach(b=>{ const v=f(b); if(v==null||v==='') return; k++; o[v]=(o[v]||0)+1; }); const top=Object.keys(o).sort((a,b)=>o[b]-o[a])[0]; return top==null?null:{v:top,n:o[top],k:k}; };
  const L2=[];
  const pt=cnt(b=>b.ptrend); if(pt&&pt.k>=2) L2.push(T2('Πίεση: ','Pressure: ')+(PT[pt.v]||pt.v).toLowerCase()+' ('+pt.n+'/'+pt.k+')');
  const mo=cnt(b=>b.date?biteMoon(b):null); if(mo&&mo.k>=2) L2.push(T2('Σελήνη: ','Moon: ')+MOON_LBL[mo.v].toLowerCase()+' ('+mo.n+'/'+mo.k+')');
  const ws=bs.filter(b=>b.wind!=null).map(b=>PU&&PU.bft?PU.bft(b.wind):bft(b.wind)); if(ws.length>=2){ ws.sort((a,b)=>a-b); L2.push(T2('Άνεμος: ','Wind: ')+(ws[0]===ws[ws.length-1]?ws[0]:ws[0]+'–'+ws[ws.length-1])+' Bft'); }
  const D8=en?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'], wd=cnt(b=>b.wdeg!=null?D8[Math.round(b.wdeg/45)%8]:null); if(wd&&wd.k>=2) L2.push(T2('Διεύθυνση: ','Direction: ')+wd.v+' ('+wd.n+'/'+wd.k+')');
  const wv=bs.filter(b=>b.wave!=null).map(b=>+b.wave); if(wv.length>=2){ wv.sort((a,b)=>a-b); L2.push(T2('Κύμα: ','Waves: ')+PU.wave(wv[0])+(wv[wv.length-1]!==wv[0]?' – '+PU.wave(wv[wv.length-1]):'')); }
  const ss=bs.filter(b=>b.sst!=null).map(b=>+b.sst); if(ss.length>=2){ ss.sort((a,b)=>a-b); L2.push(T2('Νερό: ','Water: ')+PU.temp(ss[0])+(Math.round(ss[ss.length-1])!==Math.round(ss[0])?' – '+PU.temp(ss[ss.length-1]):'')); }
  const bt=cnt(b=>(b.bait||'').trim()||null); if(bt&&bt.k>=2) L2.push(T2('Δόλωμα: ','Bait: ')+bt.v+' ('+bt.n+'/'+bt.k+')');
  body.append(h('div',{class:'ds-over hoth',text:T2('Συνθήκες που επαναλαμβάνονται','Recurring conditions')}));
  if(L2.length) L2.forEach(t=>body.append(h('div',{class:'hotln',text:t}))); else body.append(h('div',{class:'meta',text:T2('Χρειάζονται τουλάχιστον 2 ψάρια με καταγεγραμμένες συνθήκες.','At least 2 fish with recorded conditions are needed.')}));
}
async function hotNow(body,g,bs){
  const en=window.LANG==='en', T2=(a,b)=>en?b:a;
  body.append(h('div',{class:'meta',text:T2('Φόρτωση πρόγνωσης…','Loading forecast…')}));
  let fc=null; try{ fc=await window.PF.getForecast(g.lat,g.lon,undefined,{days:7}); }catch(e){}
  body.replaceChildren(); if(!fc||!fc.days){ body.append(h('div',{class:'meta',text:T2('Η πρόγνωση δεν φορτώθηκε.','The forecast did not load.')})); return; }
  const cand=bs.filter(b=>b.wind!=null||b.wave!=null||b.ptrend), sim=window.AlkyonSim&&window.AlkyonSim.score;
  const hr=b=>{ const m=/^(\d{1,2})/.exec(b.time||''); return m?Math.min(23,+m[1]):7; };
  body.append(h('div',{class:'ds-over hoth',text:T2('Επόμενες μέρες','Next days')}));
  const ls=h('div',{class:'hotdays'}), DN=DNs();
  ls.append(h('div',{class:'hotday hothead'},h('span',{text:''}),h('span',{class:'hds',text:T2('βαθμός','score')}),h('span',{class:'hdm',text:T2('ομοιότ.','similar')})));
  fc.days.slice(0,7).forEach((d,i)=>{
    let best=null; if(sim) cand.forEach(b=>{ const hh=d.hours&&d.hours.find(x=>x.hr===hr(b)); if(!hh) return; const s=sim(b,hh,d.f); if(s!=null&&(!best||s>best.s)) best={s:s,b:b,h:hr(b)}; });
    const dt=new Date(d.date+'T12:00:00Z'), nm=i===0?T2('Σήμερα','Today'):i===1?T2('Αύριο','Tomorrow'):DN[dt.getUTCDay()]+' '+dt.getUTCDate()+'/'+(dt.getUTCMonth()+1);
    const smin=(+lsGet('alkyon-simmin',80)||80)/100, r=h('div',{class:'hotday'+(best&&best.s>=smin?' good':'')+(d.safe===false?' unsafe':'')});
    r.append(h('span',{class:'hdn',text:nm}),h('span',{class:'hds',text:d.safe===false?T2('επικίνδυνο','unsafe'):String(d.best!=null?d.best:'–')}),h('span',{class:'hdm',text:best?Math.round(best.s*100)+'%':'–'}),
      h('small',{text:best?T2('σαν ','like ')+bLabel(best.b).split(' ').slice(0,2).join(' ')+' '+String(best.h).padStart(2,'0')+':00':''}));
    ls.append(r); });
  body.append(ls);
  if(!cand.length) body.append(h('div',{class:'meta',text:T2('Για ομοιότητα χρειάζονται ψάρια με καταγεγραμμένες συνθήκες (άνεμος, κύμα, πίεση).','Similarity needs fish with recorded conditions (wind, waves, pressure).')}));
  else body.append(h('div',{class:'meta',text:T2('Ομοιότητα: σελήνη, άνεμος, διεύθυνση, κύμα, πίεση, νερό, την ίδια ώρα. Πράσινο = ','Similarity: moon, wind, direction, waves, pressure, water, same hour. Green = ')+(+lsGet('alkyon-simmin',80)||80)+T2('% και πάνω.','% or more.')}));
}
let editSpot=null;
function openSpotForm(p,sp){
  editSpot=sp||null;
  pending=(p&&typeof p.lat==='number')?{lat:p.lat,lon:p.lon}:null;
  switchTab('map');
  $('spotForm').hidden=false;
  AlkyonCoord.set($('sLat'),$('sLon'),p&&p.lat!=null?p.lat:null,p&&p.lon!=null?p.lon:null);
  if(sp){ $('sName').value=sp.name||''; $('sType').value=sp.type||$('sType').value; $('sDepth').value=sp.depth==null?'':sp.depth; $('sNotes').value=sp.notes||''; }
  if($('sPriv')) $('sPriv').checked=!!(sp&&sp.priv);
  $('sErr').textContent=''; drawMap();
  $('spotForm').scrollIntoView({behavior:'smooth',block:'center'});
  $('sName').focus({preventScroll:true});
}
function closeSpotForm(){ editSpot=null; pending=null; $('spotForm').hidden=true; $('spotForm').reset(); drawMap(); }
$('sNew').addEventListener('click',()=>openSpotForm({}));
/* Κοντινά μαγαζιά ψαρικής: ανοίγει αναζήτηση Google Maps γύρω από τη θέση (χωρίς κλειδί API, τίποτα δεν αποθηκεύεται) */
$('sShops').addEventListener('click',()=>{
  const go=(la,lo,z)=>{ const q='fishing+tackle+store'; window.open('https://www.google.com/maps/search/'+q+(la!=null?'/@'+la.toFixed(5)+','+lo.toFixed(5)+','+z+'z':''),'_blank','noopener'); };
  const fallback=()=>{ try{ const c=map.getCenter(); go(c.lat,c.lng,13); }catch(e){ go(null,null,0); } };
  if(!navigator.geolocation){ fallback(); return; }
  navigator.geolocation.getCurrentPosition(p=>go(p.coords.latitude,p.coords.longitude,14),fallback,{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
});
$('sCancel').addEventListener('click',closeSpotForm);
$('sClose').addEventListener('click',closeSpotForm);
AlkyonCoord.bind($('sLat'),$('sLon'),(la,lo)=>{ pending=(la!=null&&lo!=null)?{lat:la,lon:lo}:null; drawMap(); });
$('spotForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const cp=AlkyonCoord.get($('sLat'),$('sLon')); const la=cp&&cp.lat,lo=cp&&cp.lon;
  if(!cp){$('sErr').textContent='Γράψε έγκυρο πλάτος και μήκος, π.χ. N 35°03.602′ και E 32°23.856′, ή πάτα στον χάρτη.';return;}
  const depth=$('sDepth').value===''?null:+$('sDepth').value;
  try{
    const spRec=Object.assign({},editSpot||{},{name:$('sName').value.trim(),type:$('sType').value,lat:la,lon:lo,depth:depth,notes:$('sNotes').value.trim()}); if($('sPriv')){ if($('sPriv').checked) spRec.priv=true; else delete spRec.priv; }
    const id=await Store.save('spots',spRec);
    selSpot=id; closeSpotForm();
  }catch(err){$('sErr').textContent='Δεν αποθηκεύτηκε. Δοκίμασε ξανά.';}
});
function copyText(t,btn){
  const done=()=>{const o=btn.textContent;btn.textContent='Αντιγράφηκε';setTimeout(()=>btn.textContent=o,1200);};
  try{ navigator.clipboard.writeText(t).then(done,()=>{}); }catch(e){}
}
function renderSpots(){
  const L=$('spotList'); L.replaceChildren();
  const spots=Store.get('spots').slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','el'));
  if(!spots.length){ L.append(h('div',{class:'empty',text:'Δεν έχεις αποθηκεύσει σημεία ακόμα. Πάτα πάνω στον χάρτη ή στο κουμπί «Νέο σημείο με συντεταγμένες».'})); }
  for(const sp of spots){
    const coord=(typeof sp.lat==='number'&&typeof sp.lon==='number')?AlkyonCoord.fmt(sp.lat,sp.lon):'?';
    const cb=h('button',{class:'btn ghost sm',type:'button',text:'Αντιγραφή'});
    cb.addEventListener('click',()=>copyText(coord,cb));
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('spots',sp.id);}catch(e){}
    });
    const it=h('div',{class:'item'+(sp.id===selSpot?' sel':''),'data-sid':sp.id},
      h('div',{},h('b',{text:sp.name||'Χωρίς όνομα'}),h('div',{class:'meta',text:[sp.type,sp.depth!=null?sp.depth+' m':null].filter(Boolean).join(' · ')}),h('div',{class:'meta mono',text:coord}),sp.notes?h('div',{class:'meta',text:sp.notes}):null),
      h('div',{class:'acts'},cb,del));
    it.firstChild.addEventListener('click',()=>{selSpot=sp.id;drawMap();renderSpots();if(typeof sp.lat==='number') showOnMap(sp.lat,sp.lon,sp.id);});
    L.append(it);
  }
  const dl=$('spotNames'); dl.replaceChildren(); for(const sp of spots) dl.append(h('option',{value:sp.name}));
  const bs=$('bSpot'), cur=bs.value; bs.replaceChildren(h('option',{value:'',text:'Χωρίς σημείο'}));
  for(const sp of spots) bs.append(h('option',{value:sp.id,text:sp.name}));
  bs.value=spots.some(x=>x.id===cur)?cur:'';
}

/* ---------- Log ---------- */
/* Έξοδοι από το κουμπί «Έξοδος» (με startMs): τα ψάρια/kg υπολογίζονται ζωντανά από τα τσιμπήματα, ώστε οι αλλαγές στα bites να φαίνονται εδώ. */
const bc=b=>Math.max(1,Math.floor(+b.cnt)||1);
function multiSync(){ const on=$('bMulti').checked, en=window.LANG==='en'; $('bMultiBox').hidden=!on; const k=$('bKg').parentNode.firstChild, l=$('bLen').parentNode.firstChild; if(k) k.nodeValue=on?(en?'Total weight (kg)':'Συνολικό βάρος (kg)'):(en?'Weight (kg)':'Βάρος (kg)'); if(l) l.nodeValue=on?(en?'Average length (cm)':'Μέσο μήκος (cm)'):(en?'Length (cm)':'Μήκος (cm)'); }
function tripEff(t,all){
  if(!t.startMs||!t.endMs||t.manual) return {count:+t.count||0,kg:+t.kg||0,species:t.species||'',miss:+t.miss||0,pn:+t.pn||0,pkg:+t.pkg||0};
  const lo=Math.floor(t.startMs/60000)*60000, prev=(all||[]).filter(x=>x.id!==t.id&&x.startMs&&x.endMs&&x.startMs<t.startMs);
  const known=new Set(); (all||[]).forEach(x=>{ known.add(x.id); if(x.sid) known.add(x.sid); });
  let n=0,kg=0,pn=0,pkg=0; const sp={};
  Store.get('bites').forEach(b=>{
    if(!b.date||!b.time) return; const ms=biteMs(b); if(isNaN(ms)) return;
    if(b.trip&&known.has(b.trip)){ if(b.trip!==t.id&&b.trip!==t.sid) return; } else { if(prev.some(x=>ms>=Math.floor(x.startMs/60000)*60000&&ms<=x.endMs)) return; if(!(ms>=lo&&ms<=t.endMs)) return; }
    if(b.gear){ pn+=bc(b); pkg+=b.rel?0:(+b.kg||0); return; }
    { n+=bc(b); kg+=b.rel?0:(+b.kg||0); if(b.species) sp[b.species]=(sp[b.species]||0)+bc(b); }
  });
  let mi=0;
  Store.misses().forEach(b=>{
    if(!b.date||!b.time) return; const ms=biteMs(b); if(isNaN(ms)) return;
    if(b.trip&&known.has(b.trip)){ if(b.trip===t.id||b.trip===t.sid) mi++; return; }
    if(prev.some(x=>ms>=Math.floor(x.startMs/60000)*60000&&ms<=x.endMs)) return;
    if(ms>=lo&&ms<=t.endMs) mi++;
  });
  return {count:n,kg:Math.round(kg*10)/10,species:Object.keys(sp).sort((a,b)=>sp[b]-sp[a])[0]||'',miss:mi,pn:pn,pkg:Math.round(pkg*10)/10};
}
let reviewSet=null, bitesVisRef=null, backOnly=false, focusId=null; /* v31z353: το ψάρι/σημείο που άνοιξες από τη λίστα φαίνεται ακόμα κι αν είναι κρυμμένα τα υπόλοιπα */
function setFocus(id){ focusId=id||null; try{ drawMap(); if(bitesVisRef) bitesVisRef(); if(window.AlkyonCore.spotsVis) window.AlkyonCore.spotsVis(); }catch(e){} }
/* v31z356: «Πηγαίνω εκεί» από ψάρι που ανοίχτηκε από λίστα: σβήνει η μπάρα επιστροφής, μένει μόνο η μπάρα πλοήγησης */
function dropBack(){ if(!backOnly||reviewSet) return; backOnly=false; retTo=null; followPause=0; const rb=$('reviewBar'); if(rb) rb.hidden=true; }
window.addEventListener('alkyon-bsx',()=>{ if(backOnly&&!reviewSet&&retTo) endReview(); }); /* v31z351: το ✕ του φύλλου γυρίζει κι αυτό στη λίστα */
function tripBitesOf(t){
  const all=Store.get('trips');
  if(!t.startMs||!t.endMs||t.manual) return Store.get('bites').filter(b=>b.date===t.date&&(!b.trip||b.trip===t.id||b.trip===t.sid));
  const lo=Math.floor(t.startMs/60000)*60000, prev=all.filter(x=>x.id!==t.id&&x.startMs&&x.endMs&&x.startMs<t.startMs);
  const known=new Set(); all.forEach(x=>{ known.add(x.id); if(x.sid) known.add(x.sid); });
  return Store.get('bites').filter(b=>{
    if(!b.date||!b.time) return false; const ms=biteMs(b); if(isNaN(ms)) return false;
    if(b.trip&&known.has(b.trip)) return b.trip===t.id||b.trip===t.sid;
    if(prev.some(x=>ms>=Math.floor(x.startMs/60000)*60000&&ms<=x.endMs)) return false;
    return ms>=lo&&ms<=t.endMs;
  });
}
function endReview(){
  if(backOnly&&!reviewSet){ backOnly=false; followPause=0; const b0=$('reviewBar'); if(b0) b0.hidden=true; setFocus(null); if(map) map.closePopup(); try{ if(window.AlkyonSheet&&window.AlkyonSheet.close) window.AlkyonSheet.close(); }catch(e){} goBack(); return; }
  if(!reviewSet) return; reviewSet=null; backOnly=false; const bar=$('reviewBar'); if(bar) bar.hidden=true;
  try{ if(window.AlkyonTrack&&window.AlkyonTrack.hide) window.AlkyonTrack.hide(); }catch(e){}
  if(map) map.closePopup(); drawMap(); if(bitesVisRef) bitesVisRef();
  goBack();
}
function reviewTrip(t){
  const en=window.LANG==='en', list=tripBitesOf(t).filter(b=>typeof b.lat==='number'&&typeof b.lon==='number');
  if(!tripActive()) markReturn(); switchTab('map'); if(!map) return;
  if(tripActive()){ toast(en?'A trip is in progress. All your fish are already shown.':'Έξοδος σε εξέλιξη. Τα ψάρια σου φαίνονται ήδη όλα.'); return; }
  reviewSet=new Set(list.map(b=>b.id)); drawMap(); if(bitesVisRef) bitesVisRef(); else if(!map.hasLayer(bitesG)) bitesG.addTo(map);
  const hasTrack=t.track&&t.track.length>1; try{ if(window.AlkyonTrack&&window.AlkyonTrack.hide) window.AlkyonTrack.hide(); }catch(e){}
  if(hasTrack&&window.AlkyonTrack) window.AlkyonTrack.show(t.track,true);
  const pts=list.map(b=>[b.lat,b.lon]); if(hasTrack) t.track.forEach(p=>pts.push(p));
  let bar=$('reviewBar');
  if(!bar){ bar=h('div',{id:'reviewBar',class:'rvbar'},h('span',{class:'rvtx'}),h('button',{type:'button',class:'rvx','aria-label':en?'Close':'Κλείσιμο',text:'✕',onclick:endReview})); document.querySelector('.mapbox').appendChild(bar); }
  bar.querySelector('.rvtx').textContent=(t.date?t.date.slice(8,10)+'/'+t.date.slice(5,7)+' · ':'')+(t.spot?t.spot+' · ':'')+list.length+(en?' fish on the map':' ψάρια στον χάρτη'); bar.hidden=false;
  if(pts.length) setTimeout(()=>map.fitBounds(L.latLngBounds(pts),{padding:[70,70],maxZoom:16}),350);
  else toast(en?'No fish with a location on this trip.':'Δεν υπάρχουν ψάρια με θέση σε αυτή την έξοδο.');
}
function reviewBites(list,text){
  const en=window.LANG==='en'; list=list.filter(b=>typeof b.lat==='number'&&typeof b.lon==='number');
  if(!tripActive()&&list.length) markReturn(); switchTab('map'); if(!map) return;
  if(tripActive()){ toast(en?'A trip is in progress. All your fish are already shown.':'Έξοδος σε εξέλιξη. Τα ψάρια σου φαίνονται ήδη όλα.'); return; }
  if(!list.length){ toast(en?'No fish with a location match these filters.':'Κανένα ψάρι με θέση δεν ταιριάζει με αυτά τα φίλτρα.'); return; }
  reviewSet=new Set(list.map(b=>b.id)); drawMap(); if(bitesVisRef) bitesVisRef(); else if(!map.hasLayer(bitesG)) bitesG.addTo(map);
  try{ if(window.AlkyonTrack&&window.AlkyonTrack.hide) window.AlkyonTrack.hide(); }catch(e){}
  let bar=$('reviewBar');
  if(!bar){ bar=h('div',{id:'reviewBar',class:'rvbar'},h('span',{class:'rvtx'}),h('button',{type:'button',class:'rvx','aria-label':en?'Close':'Κλείσιμο',text:'✕',onclick:endReview})); document.querySelector('.mapbox').appendChild(bar); }
  bar.querySelector('.rvtx').textContent=text(list.length); bar.hidden=false;
  setTimeout(()=>map.fitBounds(L.latLngBounds(list.map(b=>[b.lat,b.lon])),{padding:[70,70],maxZoom:16}),350);
}
window.addEventListener('alkyon-sess',()=>{ if(tripActive()&&reviewSet) endReview(); });
const fmtDur=ms=>{const m=Math.max(0,Math.round(ms/60000)),hh=Math.floor(m/60),en=window.LANG==='en';return hh?hh+(en?'h ':'ω ')+('0'+(m%60)).slice(-2)+(en?'m':'λ'):m+(en?'m':'λ');};
/* Ταξινόμηση λιστών (θυμάται την επιλογή ανά λίστα) */
function sortSel(key,opts,def,onChange,before){
  const en=window.LANG==='en'; const wrap=h('label',{class:'f sortsel',style:'margin:6px 0'}); wrap.append(document.createTextNode(en?'Sort by':'Ταξινόμηση'));
  const s=h('select',{}); opts.forEach(o=>s.append(h('option',{value:o[0],text:o[1]}))); let v=lsGet('alkyon-sort-'+key,def); if(!opts.some(o=>o[0]===v)) v=def; s.value=v;
  s.addEventListener('change',()=>{ lsSet('alkyon-sort-'+key,s.value); onChange(); }); wrap.append(s); before.parentNode.insertBefore(wrap,before);
  return ()=>{ let c=lsGet('alkyon-sort-'+key,def); return opts.some(o=>o[0]===c)?c:def; };
}
const T2=(el,en)=>window.LANG==='en'?en:el;
const tripSortGet=sortSel('trips',[['new',T2('Νεότερες πρώτα','Newest first')],['old',T2('Παλαιότερες πρώτα','Oldest first')],['fish',T2('Περισσότερα ψάρια','Most fish')],['kg',T2('Περισσότερα κιλά','Most kg')],['dur',T2('Μεγαλύτερη διάρκεια','Longest')],['km',T2('Μεγαλύτερη απόσταση','Longest distance')]],'new',()=>renderTrips(),$('tripList'));
function photoStrip(dayB){
  const ph=dayB.filter(b=>b.photo); if(!ph.length) return null;
  const w=h('div',{class:'trph'});
  for(const b of ph.slice(0,5)){ const im=h('img',{alt:b.species||'',loading:'lazy',decoding:'async'}); im.hidden=true; w.append(im); loadPhoto(b.id,im); }
  if(ph.length>5) w.append(h('span',{class:'trphm',text:'+'+(ph.length-5)}));
  return w;
}
function renderTrips(){
  const all=Store.get('trips'), trips=all.filter(t=>AlkyonRange.inR('log',t)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const eff=new Map(trips.map(t=>[t.id,tripEff(t,all)]));
  { const k=tripSortGet(), dur=t=>(t.startMs&&t.endMs)?Math.max(0,t.endMs-t.startMs-(t.pauseMs||0)):0, dd=(a,b)=>(b.date||'').localeCompare(a.date||'');
    const cmp={new:dd,old:(a,b)=>-dd(a,b),fish:(a,b)=>eff.get(b.id).count-eff.get(a.id).count||dd(a,b),kg:(a,b)=>eff.get(b.id).kg-eff.get(a.id).kg||dd(a,b),dur:(a,b)=>dur(b)-dur(a)||dd(a,b),km:(a,b)=>(+b.km||0)-(+a.km||0)||dd(a,b)}[k]; if(cmp) trips.sort(cmp); }
  let n=trips.length, fish=trips.reduce((a,t)=>a+eff.get(t.id).count,0), kg=trips.reduce((a,t)=>a+eff.get(t.id).kg,0), pfish=trips.reduce((a,t)=>a+(eff.get(t.id).pn||0),0), pkgT=trips.reduce((a,t)=>a+(eff.get(t.id).pkg||0),0);
  /* Έξοδος σε εξέλιξη: μετράει ήδη στα σύνολα */
  try{ const ts=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); if(ts&&ts.active&&AlkyonRange.inR('log',{date:nicosiaToday()})){ const ac=window.AlkyonTrip.counts(); n++; fish+=+ac.n||0; kg+=+ac.kg||0; } }catch(e){}
  kg=Math.round(kg*10)/10;
  const by={}; trips.forEach(t=>{if(t.spot)by[t.spot]=(by[t.spot]||0)+eff.get(t.id).count;});
  const best=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
  const st=$('stats'); st.replaceChildren();
  for(const [lab,val] of [['Έξοδοι',n],['Ψάρια',fish],['Kg',kg.toFixed(1)]]) st.append(h('div',{},h('b',{text:val}),h('span',{class:'label',text:lab})));
  if(pfish>0) st.append(h('div',{class:'gearsum',style:'grid-column:1/-1;margin-top:6px;font-size:13px;color:var(--muted)',text:(window.LANG==='en'?'Gear (net, longline, pots): ':'Εργαλεία (δίχτυ, παραγάδι, κλούβες): ')+pfish+(window.LANG==='en'?' fish · ':' ψάρια · ')+(Math.round(pkgT*10)/10).toFixed(1)+' kg'}));
  const L=$('tripList'); L.replaceChildren();
  if(best&&best[1]>0) L.append(h('p',{class:'muted bestnote',text:'Πιο παραγωγικό σημείο: '+best[0]+' ('+best[1]+' ψάρια)'}));
  if(!n) L.append(h('div',{class:'empty',text:'Καμία έξοδος καταγεγραμμένη. Συμπλήρωσε τη φόρμα πάνω μετά το επόμενο ψάρεμα.'}));
  for(const t of trips){
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('trips',t.id);}catch(e){}
    });
    const dayB=Store.get('bites').filter(b=>b.date===t.date);
    let det=null;
    if(dayB.length){
      const kgT=dayB.reduce((s,b)=>s+(b.rel?0:(+b.kg||0)),0), by=(f)=>{const o={}; dayB.forEach(b=>{const k=(b[f]||'').trim(); if(k) o[k]=(o[k]||0)+1;}); return Object.entries(o).sort((x,y)=>y[1]-x[1]);};
      const hrs=new Array(24).fill(0); dayB.forEach(b=>{if(b.time) hrs[+b.time.slice(0,2)]++;}); const mx=Math.max(1,...hrs);
      const times=dayB.filter(b=>b.time).map(b=>b.time).sort();
      const bars=h('div',{class:'minibars'}); hrs.forEach((n,k)=>bars.append(h('i',{style:'height:'+Math.round(n/mx*100)+'%;'+(n?'':'opacity:.15'),title:pad(k)+':00 · '+n})));
      det=h('details',{class:'trdet'},h('summary',{text:'Τσιμπήματα εκείνης της ημέρας'}),
        h('div',{class:'tr'},h('span',{text:'Τσιμπήματα'}),h('b',{text:String(dayB.length)})),
        h('div',{class:'tr'},h('span',{text:'Συνολικό βάρος'}),h('b',{text:kgT.toFixed(1)+' kg'})),
        times.length?h('div',{class:'tr'},h('span',{text:'Πρώτο και τελευταίο'}),h('b',{text:times[0]+' – '+times[times.length-1]})):null,
        by('species').length?h('div',{class:'tr'},h('span',{text:'Είδη'}),h('b',{text:by('species').map(e=>e[0]+' ×'+e[1]).join(', ')})):null,
        by('bait').length?h('div',{class:'tr'},h('span',{text:'Δολώματα'}),h('b',{text:by('bait').map(e=>e[0]+' ×'+e[1]).join(', ')})):null,
        by('tech').length?h('div',{class:'tr'},h('span',{text:'Τεχνικές'}),h('b',{text:by('tech').map(e=>e[0]+' ×'+e[1]).join(', ')})):null,
        h('div',{class:'label',style:'margin-top:6px',text:'Ώρες που τσίμπησε (00 → 23)'}),bars);
    }
    L.append(h('div',{class:'item','data-tid':t.id},
      h('div',{},h('b',{text:(t.date||'')+(t.spot?' · '+t.spot:'')}),
        h('div',{class:'meta',text:[t.tech,eff.get(t.id).count+(eff.get(t.id).pn?(window.LANG==='en'?' on rod/line':' με καλάμι/πετονιά'):' ψάρια'),eff.get(t.id).miss?'✕ '+eff.get(t.id).miss+(window.LANG==='en'?' miss':' χαμένα'):null,eff.get(t.id).kg.toFixed(1)+' kg',(eff.get(t.id).pn?'🪢 '+eff.get(t.id).pn+' '+(window.LANG==='en'?'from gear':'από εργαλεία')+' · '+(eff.get(t.id).pkg||0).toFixed(1)+' kg':null),(eff.get(t.id).pn?(window.LANG==='en'?'total ':'σύνολο ')+(eff.get(t.id).count+eff.get(t.id).pn)+(window.LANG==='en'?' fish':' ψάρια'):null),eff.get(t.id).species,(t.startMs&&t.endMs)?fmtDur(t.endMs-t.startMs):null,t.km>0?PU.dist(t.km):null].filter(Boolean).join(' · ')}),
        (()=>{ try{ const u=setsUsed(tripBitesOf(t)); return u.length?h('div',{class:'meta',text:'🧰 '+(window.LANG==='en'?'Sets: ':'Σετ: ')+u.map(e=>e[0]+' ×'+e[1]).join(', ')}):null; }catch(e){ return null; } })(),
        t.notes?h('div',{class:'meta',text:(window.LANG!=='en'?String(t.notes).replace(/^Recorded from Start\/End trip \((.*)\)$/,'Καταγραφή από Έναρξη/Τέλος εξόδου ($1)'):t.notes)}):null,
        (t.gear&&t.gear.length)?h('div',{class:'meta',text:(window.LANG==='en'?'Gear: ':'Εργαλεία: ')+t.gear.map(g=>g.name+' ('+(g.n||0)+(window.LANG==='en'?' fish':' ψάρια')+')').join(', ')}):null,(()=>{ try{ return photoStrip(tripBitesOf(t)); }catch(e){ return null; } })(),det),
      h('div',{class:'acts'},(t.track&&t.track.length>1)?h('button',{class:'btn ghost sm',type:'button',text:window.LANG==='en'?'Route':'Διαδρομή',onclick:()=>{ if(window.AlkyonTrack) window.AlkyonTrack.show(t.track); }}):null,(t.gear&&t.gear.length&&window.AlkyonGear)?h('button',{class:'btn ghost sm',type:'button',text:window.LANG==='en'?'Gear':'Εργαλεία',onclick:()=>window.AlkyonGear.show(t.gear)}):null,del)));
  }
}
$('tNew').addEventListener('click',()=>{ const f=$('tripForm'); f.hidden=!f.hidden; if(!f.hidden){ $('tDate').value=nicosiaToday(); try{ f.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} } });
$('tCancel').addEventListener('click',()=>{ $('tripForm').hidden=true; });
$('tripForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    await Store.save('trips',{date:$('tDate').value,spot:$('tSpot').value.trim(),tech:$('tTech').value,species:$('tSpecies').value.trim(),count:+$('tCount').value||0,kg:+$('tKg').value||0,notes:$('tNotes').value.trim()});
    $('tSpot').value='';$('tSpecies').value='';$('tCount').value='0';$('tKg').value='0';$('tNotes').value=''; $('tripForm').hidden=true;
  }catch(err){}
});

/* ---------- Guide ---------- */
const SPECIES=[
 {n:'Λαυράκι',l:'Dicentrarchus labrax',w:'Κοντά στην ακτή, σε βράχια, λιμάνια και εκβολές.',m:'Spinning με τεχνητά, ζωντανό δόλωμα.',t:'Συχνά τα χαράματα και το σούρουπο.'},
 {n:'Τσιπούρα',l:'Sparus aurata',w:'Αμμώδεις και λασπώδεις πυθμένες, περίπου 5–30 m.',m:'Βυθού με οστρακοειδή.',t:'Πίεση που πέφτει αργά βοηθά.'},
 {n:'Σαργός',l:'Diplodus sargus',w:'Βραχώδεις ακτές και ρηχά.',m:'Βυθού με ελαφρύ μολύβι και κατάλληλο δόλωμα.',t:'Δουλεύει με λίγο κύμα που ανακατεύει τον πυθμένα.'},
 {n:'Λιθρίνι',l:'Pagellus erythrinus',w:'Αμμώδεις και λασπώδεις πυθμένες, περίπου 20–100 m.',m:'Βυθού με πολλά αγκίστρια.',t:'Συχνά σε βαθύτερα νερά.'},
 {n:'Συναγρίδα',l:'Dentex dentex',w:'Βραχώδεις πυθμένες και ύφαλοι, περίπου 20–100 m.',m:'Ζωντανό δόλωμα, jigging.',t:'Επιθετικό αρπακτικό. Θέλει γερό εξοπλισμό.'},
 {n:'Φαγκρί',l:'Pagrus pagrus',w:'Βραχώδεις και μικτοί πυθμένες, περίπου 20–100 m.',m:'Βυθού, jigging.',t:'Ψάρι βάθους, συνήθως πάνω από ύφαλο.'},
 {n:'Σφυρίδα',l:'Epinephelus marginatus',w:'Βράχια και σπηλιές.',m:'Βυθού με γερή πετονιά.',t:'Απειλούμενο είδος σε πολλές περιοχές. Έλεγξε τα ισχύοντα μέτρα προστασίας πριν κρατήσεις ψάρι.',warn:'Προστασία'},
 {n:'Μαγιάτικο',l:'Seriola dumerili',w:'Ανοιχτά, γύρω από υφάλους και υποβρύχια ανάγλυφα.',m:'Jigging, ζωντανό δόλωμα.',t:'Δυνατός αγώνας. Χρειάζεται βαρύς εξοπλισμός.'},
 {n:'Κυνηγός',l:'Coryphaena hippurus',w:'Ανοιχτή θάλασσα, κοντά σε πλωτά αντικείμενα.',m:'Τρόλινγκ.',t:'Στη Μεσόγειο εμφανίζεται συνήθως από το τέλος του καλοκαιριού ως το φθινόπωρο.'},
 {n:'Λούτσος',l:'Sphyraena sphyraena',w:'Επιφάνεια ως μέσα νερά, κοντά σε ακτή και υφάλους.',m:'Τρόλινγκ, spinning.',t:'Κοφτερά δόντια. Χρησιμοποίησε ατσαλένιο ή fluorocarbon ηγέτη.'},
 {n:'Λαγοκέφαλος',l:'Lagocephalus sceleratus',w:'Εισβλητικό είδος σε όλα τα βάθη κοντά στην ακτή.',m:'Πιάνεται τυχαία σε διάφορες τεχνικές.',t:'Δηλητηριώδης. Περιέχει τετροδοτοξίνη. Δεν τρώγεται, δεν δίνεται και δεν πωλείται. Κόβει πετονιές και δαγκώνει.',warn:'Τοξικό'},
 {n:'Λεοντόψαρο',l:'Pterois miles',w:'Βράχια και ύφαλοι, σε μικρά και μεσαία βάθη.',m:'Πιάνεται τυχαία στον πυθμένα.',t:'Εισβλητικό. Τα αγκάθια είναι δηλητηριώδη. Χειρίσου με γάντια και τσιμπίδα.',warn:'Αγκάθια'},
 {n:"Χταπόδι",l:"Octopus vulgaris",e:"Common octopus",w:"Βραχώδεις και αμμώδεις πυθμένες, από τα ρηχά μέχρι περίπου 100 m. Κρύβεται σε τρύπες και κενά.",m:"Χταποδιέρα (octopus jig), κάθετη ρίψη με δόλωμα καβούρι, κιούπια. Συλλέγεται και με ψαροντούφεκο.",t:"Δυνατό και έξυπνο· αρπάζει και τραβά μέσα στη φωλιά. Μετά το πιάσιμο χρειάζεται χτύπημα και καθάρισμα πριν το μαγείρεμα.",mol:1},
 {n:"Καλαμάρι",l:"Loligo vulgaris",e:"European squid",w:"Ανοιχτά νερά και κοντά σε λιμάνια, συχνά γύρω από φώτα τη νύχτα. Βάθη από λίγα μέτρα μέχρι περίπου 100 m.",m:"Καλαμαριέρα (squid jig), ελαφριά ρίψη το σούρουπο και τη νύχτα, συχνά με φως.",t:"Εκτοξεύει μελάνι· πρόσεχε τα ρούχα και το κατάστρωμα. Καλύτερα τους ψυχρότερους μήνες.",mol:1},
 {n:"Σουπιά",l:"Sepia officinalis",e:"Common cuttlefish",w:"Αμμώδεις και λασπώδεις πυθμένες και λιβάδια ποσειδωνίας, ρηχά κοντά στην ακτή την άνοιξη.",m:"Καλαμαριέρα ή εγκι (egi) κοντά στον πυθμένα, κάθετα ή με ρίψη, τη νύχτα και την αυγή.",t:"Εκτοξεύει μελάνι. Την άνοιξη μπαίνει ρηχά για αναπαραγωγή· ελέγξτε τα ισχύοντα μέτρα και ελάχιστα μεγέθη.",mol:1},
 {n:"Μοσχιός",l:"Eledone moschata",e:"Musky octopus",w:"Αμμώδεις και λασπώδεις πυθμένες, συνήθως βαθύτερα από το χταπόδι.",m:"Συνήθως τυχαίο αλίευμα με βυθού ή από δίχτυα· δεν στοχεύεται συχνά με καλάμι.",t:"Μικρότερο από το χταπόδι, με έντονη μυρωδιά μόσχου. Έχει μία σειρά βεντούζες σε κάθε πλοκάμι.",mol:1},
 {n:"Μύδι",l:"Mytilus galloprovincialis",e:"Mediterranean mussel",w:"Βράχια, λιμάνια, πασσάλους και σχοινιά σε προστατευμένα νερά, κοντά στην επιφάνεια.",m:"Δεν ψαρεύεται με καλάμι. Συλλέγεται με το χέρι. Χρησιμοποιείται και ως δόλωμα.",t:"Μη τα συλλέγεις από λιμάνια ή βρώμικα νερά. Ρωτά για τοπικούς περιορισμούς υγιεινής και αλιείας.",mol:1},
 {n:"Πεταλίδα",l:"Patella caerulea",e:"Limpet",w:"Βράχια στη ζώνη των κυμάτων, κολλημένη στην πέτρα.",m:"Συλλέγεται με το χέρι ή με μαχαίρι από βράχια· χρησιμοποιείται και ως δόλωμα.",t:"Κρατά πολύ σφιχτά· γρήγορη κίνηση του μαχαιριού. Ελέγξτε τοπικούς κανονισμούς πριν τη συλλογή για κατανάλωση.",mol:1},
 {n:"Πίνα",l:"Pinna nobilis",e:"Noble pen shell",w:"Λιβάδια ποσειδωνίας και αμμώδεις πυθμένες, σε ρηχά βάθη.",m:"Δεν επιτρέπεται η συλλογή.",t:"Κρισίμως απειλούμενο και αυστηρά προστατευόμενο είδος. Μην το αγγίζεις ούτε να το μαζεύεις. Αν δεις ζωντανή πίνα, άφησέ την.",warn:"Προστατευόμενο",mol:1},
 {n:"Θαλάσσιος χουρμάς",l:"Lithophaga lithophaga",e:"Date mussel",w:"Ανοίγει τρύπες μέσα σε ασβεστολιθικούς βράχους κοντά στην επιφάνεια.",m:"Δεν επιτρέπεται η συλλογή.",t:"Η συλλογή του καταστρέφει τον βράχο και είναι απαγορευμένη. Μην το αγοράζεις και μην το συλλέγεις.",warn:"Απαγορευμένο",mol:1},
 {n:"Σουπιοκαλάμαρο",l:"Sepioteuthis lessoniana",e:"Bigfin reef squid",w:"Εισβλητικό είδος της Ανατολικής Μεσογείου, κοντά στην ακτή, πάνω από λιβάδια ποσειδωνίας και ρηχούς υφάλους.",m:"Καλαμαριέρα ή egi, ρίψη κοντά στην ακτή την αυγή, το σούρουπο και τη νύχτα.",t:"Μοιάζει με καλαμάρι αλλά με πλατύ πτερύγιο που τρέχει σχεδόν σε όλο το μήκος του σώματος. Εκτοξεύει μελάνι.",mol:1},
 {n:"Θράψαλο",l:"Todarodes sagittatus",e:"European flying squid",w:"Βαθύτερα νερά, συνήθως πάνω από 100 m, πάνω από ανοιχτούς πυθμένες.",m:"Σπάνια στοχεύεται από σκάφος με βαθιά καλαμαριέρα ή με πολύ βαθύ βυθού.",t:"Μεγαλύτερο από το καλαμάρι, με ρομβοειδές πτερύγιο στην ουρά.",mol:1},
 {n:"Στρείδι",l:"Ostrea edulis",e:"European flat oyster",w:"Ρηχά, προστατευμένα νερά με σκληρό πυθμένα και βράχια.",m:"Δεν ψαρεύεται με καλάμι. Συλλέγεται με το χέρι ή ψαροντούφεκο.",t:"Ελέγξε τοπικούς κανονισμούς και υγιεινή πριν από κάθε κατανάλωση. Μη συλλέγεις από ρυπασμένα νερά.",mol:1},
 {n:"Αχιβάδα",l:"Venus verrucosa",e:"Warty venus",w:"Αμμώδεις και αμμοβραχώδεις πυθμένες, σε ρηχά μέχρι μέτρια βάθη.",m:"Δεν ψαρεύεται με καλάμι. Συλλέγεται με το χέρι ή με εργαλείο στον πυθμένα.",t:"Ελέγξε τοπικούς κανονισμούς και υγιεινή πριν από κάθε κατανάλωση.",mol:1},
 {n:"Χτένι",l:"Pecten jacobaeus",e:"Great Mediterranean scallop",w:"Αμμώδεις και αμμοβραχώδεις πυθμένες, συνήθως 10–100 m.",m:"Δεν ψαρεύεται με καλάμι. Συλλέγεται με κατάδυση ή εργαλεία πυθμένα.",t:"Ελέγξε τοπικούς κανονισμούς και υγιεινή. Μη συλλέγεις από ρυπασμένα νερά.",mol:1},
 {n:"Μούρεξ",l:"Hexaplex trunculus",e:"Banded dye-murex",w:"Αμμώδεις, λασπώδεις και βραχώδεις πυθμένες, ρηχά ως μέτρια βάθη.",m:"Τυχαίο αλίευμα με κιούπια ή βυθού. Συλλέγεται και με το χέρι.",t:"Ελέγξε τοπικούς κανονισμούς και υγιεινή πριν από κάθε κατανάλωση.",mol:1},
 {n:"Τρίτωνας",l:"Charonia seguenzae",e:"Mediterranean triton",w:"Βραχώδεις πυθμένες και λιβάδια ποσειδωνίας.",m:"Δεν επιτρέπεται η συλλογή.",t:"Μεγάλο όστρακο και προστατευόμενο είδος. Μην το συλλέγεις ούτε να το αγοράζεις.",warn:"Προστατευόμενο",mol:1},
 {n:"Καραβίδα",l:"Palinurus elephas",e:"Common spiny lobster",w:"Βραχώδεις πυθμένες και ύφαλοι, από μέτρια μέχρι μεγάλα βάθη.",m:"Κιούπια και δίχτυα. Δεν στοχεύεται με καλάμι.",t:"Συχνά με ελάχιστο μέγεθος και απαγορευμένη περίοδο. Έλεγξε τα ισχύοντα μέτρα πριν από κάθε αλιεία.",cr:1},
 {n:"Αστακός",l:"Homarus gammarus",e:"European lobster",w:"Βραχώδεις πυθμένες με σπηλιές, σε μέτρια βάθη. Σπάνιος στη Μεσόγειο.",m:"Κιούπια. Δεν στοχεύεται με καλάμι.",t:"Σπάνιο και προστατευόμενο είδος σε πολλές περιοχές. Έλεγξε τα ισχύοντα μέτρα.",cr:1},
 {n:"Αρκούδα",l:"Scyllarides latus",e:"Mediterranean slipper lobster",w:"Βραχώδεις πυθμένες και ύφαλοι, ρηχά μέχρι μέτρια βάθη, συχνά τη νύχτα.",m:"Κιούπια ή βουτιά. Δεν στοχεύεται με καλάμι.",t:"Σε πολλές χώρες είναι προστατευόμενο είδος ή έχει απαγόρευση. Έλεγξε τα ισχύοντα μέτρα πριν πιάσεις.",warn:"Προστατευόμενο",cr:1},
 {n:"Γαρίδα",l:"Melicertus kerathurus",e:"Caramote prawn",w:"Αμμώδεις και λασπώδεις πυθμένες, ρηχά ως μέτρια βάθη.",m:"Συνήθως με δίχτυα και συρόμενα εργαλεία· εφαρμόζεται και ως δόλωμα.",t:"Ελέγξε τοπικούς κανονισμούς πριν από την αλιεία.",cr:1},
 {n:"Καβούρι πέτρας",l:"Eriphia verrucosa",e:"Warty crab",w:"Βράχια και ρηχά κοντά στην ακτή, κρυμμένο σε τρύπες.",m:"Συλλέγεται με το χέρι ή με κιούπι. Πολύ καλό δόλωμα για χταπόδι.",t:"Έχει δυνατές δαγκάνες· πρόσεχε τα δάχτυλα. Ελέγξε τοπικούς κανονισμούς.",cr:1},
 {n:"Γαλάζιο καβούρι",l:"Portunus segnis",e:"Blue swimmer crab",w:"Αμμώδεις πυθμένες, λιμάνια και εκβολές, ρηχά.",m:"Κιούπια, μικρά δίχτυα, και τυχαία με βυθού.",t:"Εισβλητικό είδος της Ανατολικής Μεσογείου. Πρόσεχε τις δαγκάνες και μην το ξαναρίξεις στη θάλασσα αν υπάρχει σχετική οδηγία.",cr:1},
 {n:"Αράχνη (καβούρι)",l:"Maja squinado",e:"Spiny spider crab",w:"Βραχώδεις και αμμώδεις πυθμένες, ρηχά ως μέτρια βάθη, ειδικά κατά την αναπαραγωγή.",m:"Κιούπια ή συλλογή με κατάδυση. Δεν στοχεύεται με καλάμι.",t:"Ελέγξε τοπικούς κανονισμούς, μεγέθη και απαγορευμένες περιόδους.",cr:1}
];
const SPEN={
"sepioteuthis lessoniana":{w:"Non-native species in the eastern Mediterranean, close to the coast over seagrass and shallow reefs.",m:"Squid jig or egi, cast near the coast at dawn, dusk and at night.",t:"Looks like a squid but with a broad fin running nearly the full length of the body. It squirts ink."},
"todarodes sagittatus":{w:"Deeper water, usually below 100 m, over open bottoms.",m:"Rarely targeted from a boat with a deep squid jig or very deep bottom fishing.",t:"Larger than the common squid, with a diamond-shaped tail fin."},
"ostrea edulis":{w:"Shallow sheltered water with hard bottom and rocks.",m:"Not caught with a rod. Collected by hand or spearfishing.",t:"Check local rules and hygiene before eating. Do not collect from polluted water."},
"venus verrucosa":{w:"Sandy and sandy-rocky bottoms, in shallow to moderate depths.",m:"Not caught with a rod. Collected by hand or with a bottom tool.",t:"Check local rules and hygiene before eating."},
"pecten jacobaeus":{w:"Sandy and sandy-rocky bottoms, usually 10–100 m.",m:"Not caught with a rod. Collected by diving or bottom tools.",t:"Check local rules and hygiene. Do not collect from polluted water."},
"hexaplex trunculus":{w:"Sandy, muddy and rocky bottoms, shallow to moderate depths.",m:"Incidental catch in pots or bottom fishing. Also collected by hand.",t:"Check local rules and hygiene before eating."},
"charonia seguenzae":{w:"Rocky bottoms and seagrass meadows.",m:"Collecting is not allowed.",t:"A large shell and a protected species. Do not collect or buy it.",warn:"Protected"},
"palinurus elephas":{w:"Rocky bottoms and reefs, from moderate to deeper water.",m:"Pots and nets. Not targeted with a rod.",t:"Often has a minimum size and closed season. Check current rules before fishing."},
"homarus gammarus":{w:"Rocky bottoms with caves, in moderate depths. Rare in the Mediterranean.",m:"Pots. Not targeted with a rod.",t:"Rare and protected in many areas. Check current rules."},
"scyllarides latus":{w:"Rocky bottoms and reefs, shallow to moderate depths, often at night.",m:"Pots or diving. Not targeted with a rod.",t:"Protected or banned in many countries. Check current rules before catching.",warn:"Protected"},
"melicertus kerathurus":{w:"Sandy and muddy bottoms, shallow to moderate depths.",m:"Usually with nets and trawls; also used as bait.",t:"Check local rules before fishing."},
"eriphia verrucosa":{w:"Rocks and shallows close to shore, hiding in holes.",m:"Collected by hand or with a pot. Very good bait for octopus.",t:"Strong claws: mind your fingers. Check local rules."},
"portunus segnis":{w:"Sandy bottoms, harbours and estuaries, shallow.",m:"Pots, small nets, and incidentally on bottom fishing.",t:"Non-native in the eastern Mediterranean. Mind the claws and follow local advice on release."},
"maja squinado":{w:"Rocky and sandy bottoms, shallow to moderate depths, especially when breeding.",m:"Pots or collecting by diving. Not targeted with a rod.",t:"Check local rules, sizes and closed seasons."},
"octopus vulgaris":{w:"Rocky and sandy bottoms, from shallows to about 100 m. Hides in holes and crevices.",m:"Octopus jig, vertical drop with crab bait, pots. Also taken by spearfishing.",t:"Strong and clever: it grabs and pulls into its den. Needs tenderising and cleaning before cooking."},
"loligo vulgaris":{w:"Open water and near harbours, often around lights at night. From a few metres to about 100 m.",m:"Squid jig, light casting at dusk and at night, often with a light.",t:"It squirts ink: mind your clothes and the deck. Best in the cooler months."},
"sepia officinalis":{w:"Sandy and muddy bottoms and seagrass meadows; shallow near the coast in spring.",m:"Squid jig or egi near the bottom, vertical or cast, at night and dawn.",t:"It squirts ink. It comes in shallow to breed in spring; check current rules and minimum sizes."},
"eledone moschata":{w:"Sandy and muddy bottoms, usually deeper than the common octopus.",m:"Usually an incidental catch on bottom fishing or in nets; rarely targeted with a rod.",t:"Smaller than the common octopus, with a musky smell. One row of suckers on each arm."},
"mytilus galloprovincialis":{w:"Rocks, harbours, piles and ropes in sheltered water, near the surface.",m:"Not caught with a rod. Collected by hand. Also used as bait.",t:"Do not collect from harbours or polluted water. Check local hygiene and fishing restrictions."},
"patella caerulea":{w:"Rocks in the wave zone, stuck to the stone.",m:"Collected by hand or with a knife from rocks; also used as bait.",t:"Holds very tight; use a quick knife motion. Check local rules before collecting for eating."},
"pinna nobilis":{w:"Seagrass meadows and sandy bottoms in shallow water.",m:"Collecting is not allowed.",t:"Critically endangered and strictly protected. Do not touch or collect it. If you see a living one, leave it alone.",warn:"Protected"},
"lithophaga lithophaga":{w:"Bores into limestone rock close to the surface.",m:"Collecting is not allowed.",t:"Collecting destroys the rock and is prohibited. Do not buy or collect it.",warn:"Prohibited"},
'dicentrarchus labrax':{w:'Close to shore, on rocks, in harbours and estuaries.',m:'Spinning with lures, live bait.',t:'Often at dawn and dusk.'},
'sparus aurata':{w:'Sandy and muddy bottoms, roughly 5–30 m.',m:'Bottom fishing with shellfish.',t:'Slowly falling pressure helps.'},
'diplodus sargus':{w:'Rocky shores and shallows.',m:'Bottom fishing with a light sinker and suitable bait.',t:'Works well with a little swell stirring up the bottom.'},
'pagellus erythrinus':{w:'Sandy and muddy bottoms, roughly 20–100 m.',m:'Bottom fishing with multiple hooks.',t:'Often in deeper water.'},
'dentex dentex':{w:'Rocky bottoms and reefs, roughly 20–100 m.',m:'Live bait, jigging.',t:'Aggressive predator. Needs strong tackle.'},
'pagrus pagrus':{w:'Rocky and mixed bottoms, roughly 20–100 m.',m:'Bottom fishing, jigging.',t:'Deep-water fish, usually over a reef.'},
'epinephelus marginatus':{w:'Rocks and caves.',m:'Bottom fishing with strong line.',t:'Endangered in many areas. Check the current protection rules before keeping a fish.',warn:'Protected'},
'seriola dumerili':{w:'Open water, around reefs and underwater structures.',m:'Jigging, live bait.',t:'Powerful fight. Needs heavy tackle.'},
'coryphaena hippurus':{w:'Open sea, near floating objects.',m:'Trolling.',t:'In the Mediterranean usually from late summer to autumn.'},
'sphyraena sphyraena':{w:'Surface to mid-water, near the coast and reefs.',m:'Trolling, spinning.',t:'Sharp teeth. Use a steel or fluorocarbon leader.'},
'lagocephalus sceleratus':{w:'Invasive species at all depths near the coast.',m:'Caught by accident with various techniques.',t:'Poisonous. Contains tetrodotoxin. Do not eat, give away or sell. It cuts lines and bites.',warn:'Toxic'},
'pterois miles':{w:'Rocks and reefs, in shallow and medium depths.',m:'Caught by accident on the bottom.',t:'Invasive. The spines are venomous. Handle with gloves and pliers.',warn:'Spines'}
};
const strip=x=>(x||'').toLowerCase().replace(/ς/g,'σ').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const CY=(window.CY100||[]);
const CYL={}; CY.forEach(c=>{const k=c.l.toLowerCase(); if(!CYL[k]) CYL[k]=c;});
const DB=(window.SPECIES_DB||[]).map(r=>({el:r[0],en:r[1],la:r[2],k:''}));
for(const c of CY){
  const row=DB.find(x=>x.la.toLowerCase()===c.l.toLowerCase());
  if(row){ if(!row.el) row.el=c.n; if(!row.en) row.en=c.e; row.alt=(row.alt||'')+' '+c.n; }
  else DB.push({el:c.n,en:c.e,la:c.l,k:''});
}
const MOLL=SPECIES.filter(x=>x.mol), CRUS=SPECIES.filter(x=>x.cr);
for(const x of MOLL.concat(CRUS)){ if(!DB.some(r=>r.la.toLowerCase()===x.l.toLowerCase())) DB.push({el:x.n,en:x.e||'',la:x.l,k:''}); }
DB.forEach(x=>{x.k=strip((x.el||'')+' '+(x.en||'')+' '+x.la+' '+(x.alt||''));});
const DETAIL={}; SPECIES.forEach(x=>DETAIL[x.l.toLowerCase()]=x);
function searchDB(q,max){
  q=strip(q.trim()); if(!q) return [];
  const out=[];
  for(const sp of DB){ const i=sp.k.indexOf(q); if(i<0) continue; const w=i===0||/[ \/]/.test(sp.k[i-1]); out.push([w?0:1,sp]); }
  out.sort((a,b)=>a[0]-b[0]);
  return out.slice(0,max).map(x=>x[1]);
}
const dispName=sp=>sp.el||sp.en;
const shownName=sp=>window.LANG==='en'?(sp.en||sp.el):(sp.el||sp.en);
const matchSp=txt=>{ const n=strip((txt||'').trim()); if(!n) return null; return DB.find(d=>(d.el&&strip(d.el)===n)||(d.en&&strip(d.en)===n))||DB.find(d=>d.alt&&strip(d.alt).split(/[\/,;]/).some(w=>w.trim()===n))||null; };
let gbifSeen=[];
async function gbifSearch(q){
  const j=await fetchJson('https://api.gbif.org/v1/species/search?q='+encodeURIComponent(q)+'&rank=SPECIES&status=ACCEPTED&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&limit=15');
  const FISH=['Actinopterygii','Elasmobranchii','Holocephali','Petromyzonti','Cephalaspidomorphi','Sarcopterygii','Chondrichthyes'];
  return (j.results||[]).filter(r=>FISH.includes(r.class)&&(r.canonicalName||r.scientificName)).map(r=>{
    const v=(r.vernacularNames||[]).find(x=>x.language==='eng'); 
    return {el:null,en:v?v.vernacularName:(r.canonicalName||r.scientificName),la:r.canonicalName||r.scientificName,k:''};
  });
}
let imgP=null;
function loadFishImgs(){ if(window.FISH_IMG) return Promise.resolve(); if(!imgP) imgP=new Promise(r=>{const s=document.createElement('script');s.src='fish-photos.js';s.onload=()=>r();s.onerror=()=>{imgP=null;r();};document.head.append(s);}); return imgP; }

/* Φωτογραφίες ειδών που δεν είναι στο βιβλίο του Τμήματος Αλιείας: από Wikipedia/Wikimedia Commons, φορτώνονται online όταν ανοίγεις το είδος και αποθηκεύονται στο κινητό */
const WP_KEY='alkyon-wikipic';
function wikiPic(la){
  const k=(la||'').trim(); if(!k) return Promise.resolve(null);
  let c={}; try{ c=JSON.parse(localStorage.getItem(WP_KEY)||'{}'); }catch(e){}
  if(c[k]!==undefined) return Promise.resolve(c[k]||null);
  if(!navigator.onLine) return Promise.resolve(null);
  return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(k.replace(/\s+/g,'_')),{headers:{'Accept':'application/json'}})
    .then(r=>r.ok?r.json():null).then(j=>{
      const src=j&&j.thumbnail&&j.thumbnail.source, page=j&&j.content_urls&&j.content_urls.desktop&&j.content_urls.desktop.page;
      const v=src&&j.type!=='disambiguation'?{src:src,page:page||''}:0;
      try{ c[k]=v; localStorage.setItem(WP_KEY,JSON.stringify(c)); }catch(e){}
      return v||null;
    }).catch(()=>null);
}
function spItem(sp){
  const d0=DETAIL[(sp.la||'').toLowerCase()], d=d0&&window.LANG==='en'&&SPEN[d0.l.toLowerCase()]?Object.assign({},d0,SPEN[d0.l.toLowerCase()]):d0, cy=CYL[(sp.la||'').toLowerCase()];
  const slug=(sp.la||'').trim().replace(/\s+/g,'-');
  const fb=h('a',{href:'https://www.fishbase.se/summary/'+encodeURIComponent(slug)+'.html',target:'_blank',rel:'noopener',text:'FishBase'});
  const body=d?h('dl',{class:'dl'},h('dt',{text:'Πού'}),h('dd',{text:d.w}),h('dt',{text:'Πώς'}),h('dd',{text:d.m}),h('dt',{text:'Σημείωση'}),h('dd',{text:d.t}))
    :h('p',{class:'muted',text:'Δεν υπάρχει αναλυτική περιγραφή στην εφαρμογή. Δες περισσότερα στο '}) ;
  if(!d&&!cy) body.append(fb);
  const ci=cy?CY.indexOf(cy):-1; const pic=h('img',{class:'spimg',alt:cy?cy.n:'',hidden:true});
  const det=h('details',{class:'sp'},
    h('summary',{},h('span',{},h('b',{text:cy?((window.LANG==='en'&&cy.e)?cy.e:cy.n):(d?((window.LANG==='en'&&(d.mol||d.cr)&&sp.en)?sp.en:d.n):(window.LANG==='en'?(sp.en||dispName(sp)):dispName(sp)))}),d&&d.warn?h('span',{class:'tag',text:d.warn}):null,(sp.el&&sp.en&&!d&&!cy&&window.LANG!=='en')?h('span',{class:'muted',text:' · '+sp.en}):null),h('span',{class:'lat',text:sp.la})),
    h('div',{class:'body'},cy?h('p',{text:(window.LANG==='en'&&window.CY100EN&&window.CY100EN[cy.l])||cy.t}):null,cy?h('p',{class:'note',text:'Πηγή: «Τα 100 σημαντικότερα είδη ψαριών των κυπριακών θαλασσών», Τμήμα Αλιείας και Θαλασσίων Ερευνών, Κύπρος.'}):null,(d&&cy)?h('h3',{text:'Πρακτικά για το ψάρεμα',style:'margin-top:10px'}):null,d?body:(cy?null:body)));
  det.querySelector('.body').prepend(pic);
  if(ci<0&&sp.la) det.addEventListener('toggle',()=>{ if(!det.open||pic.src||pic._w) return; pic._w=1; wikiPic(sp.la).then(r=>{ if(r&&r.src){ pic.src=r.src; pic.hidden=false; if(r.page&&!det.querySelector('.spcr')){ const c=h('p',{class:'note spcr'}); const en=window.LANG==='en'; c.append(en?'Photo: ':'Φωτογραφία: ',h('a',{href:r.page,target:'_blank',rel:'noopener',text:'Wikipedia / Wikimedia Commons'}),en?' (author and licence on the page).':' (δημιουργός και άδεια στη σελίδα).'); pic.after(c); } } }); });
  if(ci>=0) det.addEventListener('toggle',()=>{ if(!det.open||pic.src) return; loadFishImgs().then(()=>{const u=(window.FISH_IMG||[])[ci]; if(u){pic.src=u;pic.hidden=false;}}); });
  return det;
}
let enP=null;
function loadEN(){ if(window.LANG!=='en'||window.CY100EN) return Promise.resolve(); if(!enP) enP=new Promise(r=>{const s=document.createElement('script');s.src='cy100-en.js';s.onload=()=>r(true);s.onerror=()=>{enP=null;r(false);};document.head.append(s);}); return enP; }
let spReg='cy';
function spRegBar(){
  const en=window.LANG==='en'; let bar=$('spRegs'); if(!bar){ bar=h('div',{class:'spregs',id:'spRegs',role:'group','aria-label':en?'Region':'Περιοχή'}); $('spQ').after(bar); }
  bar.replaceChildren();
  [['cy',en?'Cyprus (Dept. of Fisheries)':'Κύπρος (Τμήμα Αλιείας)'],['mol',en?'Molluscs':'Μαλάκια'],['cr',en?'Crustaceans':'Καρκινοειδή'],['*',en?'All':'Όλα']].concat((window.SPECIES_REGIONS||[]).map(r=>[r[0],en?r[2]:r[1]])).forEach(([k,t])=>{
    bar.append(h('button',{type:'button',class:'chip','aria-pressed':String(spReg===k),text:t,onclick:()=>{ spReg=k; renderSpecies(); }}));
  });
  try{ const on=bar.querySelector('[aria-pressed=true]'); if(on) bar.scrollLeft=Math.max(0,on.offsetLeft-12); }catch(e){}
}
function renderSpecies(extra){
  spRegBar();
  if(window.LANG==='en'&&!window.CY100EN&&!renderSpecies._w){ renderSpecies._w=1; loadEN().then(()=>{ renderSpecies._w=0; renderSpecies(extra); }); }
  const q=$('spQ').value.trim(); const L=$('spList'); L.replaceChildren();
  $('spCount').textContent=(q?'':'Τα 100 είδη των κυπριακών θαλασσών (Τμήμα Αλιείας). ')+'Στη βάση: '+DB.length+' είδη, ενδεικτική λίστα.';
  let list;
  if(!q&&(spReg==='mol'||spReg==='cr')){
    const en=window.LANG==='en'; list=(spReg==='mol'?MOLL:CRUS).map(x=>({el:x.n,en:x.e||'',la:x.l}));
    $('spCount').textContent=(spReg==='mol'?(en?'Molluscs · ':'Μαλάκια · '):(en?'Crustaceans · ':'Καρκινοειδή · '))+list.length+(en?' species. General guidance only: check local rules, sizes and closed seasons.':' είδη. Γενική καθοδήγηση: έλεγξε τοπικούς κανονισμούς, μεγέθη και απαγορευμένες περιόδους.');
  }
  else if(!q&&spReg!=='cy'){
    const rg=window.SPECIES_REG||{}, en=window.LANG==='en';
    list=DB.filter(sp=>spReg==='*'||(rg[(sp.la||'').toLowerCase()]||'m').indexOf(spReg)>=0).sort((a,b)=>strip(shownName(a)).localeCompare(strip(shownName(b)),en?'en':'el')).map(sp=>({el:sp.el,en:sp.en||'',la:sp.la}));
    const rn=spReg==='*'?(en?'All species':'Όλα τα είδη'):(((window.SPECIES_REGIONS||[]).find(r=>r[0]===spReg)||[])[en?2:1]||'');
    $('spCount').textContent=rn+' · '+list.length+(en?' species. Regions are indicative; it does not mean fishing the species is allowed there.':' είδη. Οι περιοχές είναι ενδεικτικές· δεν σημαίνει ότι επιτρέπεται η αλιεία του είδους εκεί.');
  }
  else if(!q){
    list=CY.slice().sort((x,y)=>x.n.localeCompare(y.n,'el')).map(c=>({el:c.n,en:c.e,la:c.l}));
    SPECIES.forEach(x=>{ if(!CYL[x.l.toLowerCase()])list.push({el:x.n,en:x.e||'',la:x.l}); });
  }
  else list=searchDB(q,60).concat(Array.isArray(extra)?extra.filter(e=>!DB.some(d=>d.la.toLowerCase()===e.la.toLowerCase())):[]);
  for(const sp of list) L.append(spItem(sp));
  if(!L.children.length) L.append(h('div',{class:'empty',text:'Κανένα είδος δεν ταιριάζει. Δοκίμασε αναζήτηση online.'}));
  $('spOnline').hidden=q.length<3;
}
$('spOnline').addEventListener('click',async()=>{
  const b=$('spOnline'); b.disabled=true; b.textContent='Αναζήτηση…';
  try{ const r=await gbifSearch($('spQ').value.trim()); renderSpecies(r); if(!r.length) toast('Δεν βρέθηκαν ψάρια online.'); }
  catch(e){ toast('Η online αναζήτηση δεν δούλεψε.'); }
  b.disabled=false; b.textContent='Αναζήτηση online (GBIF)';
});
$('spQ').addEventListener('input',()=>renderSpecies());
const TECH=[
 {n:'Βυθού',d:'Καλάμι με μολύβι και ένα ή περισσότερα αγκίστρια κοντά στον πυθμένα. Κατάλληλο για σαργούς, τσιπούρες, λιθρίνια.',g:'Καλάμι 2,4–3 m, πετονιά 0,25–0,35 mm, μολύβι ανάλογα με το ρεύμα.'},
 {n:'Jigging',d:'Κάθετη κίνηση μεταλλικού τεχνητού κοντά σε ύφαλο ή κατωφλι. Καλό για συναγρίδες και μαγιάτικα.',g:'Κοντό καλάμι jigging, μηχανισμός με καλή τριβή, braid, jigs 60–200 g.'},
 {n:'Τρόλινγκ',d:'Τράβηγμα τεχνητών πίσω από το σκάφος με σταθερή ταχύτητα. Για κυνηγούς, λούτσους και άλλα επιφανειακά.',g:'Ταχύτητα περίπου 4–7 κόμβοι, ηγέτες ανθεκτικοί στα δόντια.'},
 {n:'Spinning',d:'Ρίψη και μάζεμα τεχνητών κοντά στη ακτογραμμή ή πάνω από ρηχούς υφάλους. Για λαυράκια και λούτσους.',g:'Καλάμι 2,1–2,7 m, braid 0,15–0,25 mm, ηγέτης fluorocarbon.'},
 {n:'Ζωντανό δόλωμα',d:'Ζωντανό ψαράκι σε αγκίστρι, ελεύθερο ή στον πυθμένα. Για μεγάλα αρπακτικά.',g:'Δυνατό καλάμι, ηγέτης ανάλογα με το είδος, καλή φροντίδα του δολώματος.'}
];
function renderTech(){
  const L=$('g-tech'); L.replaceChildren();
  for(const t of TECH) L.append(h('div',{class:'card'},h('h3',{text:t.n}),h('p',{text:t.d}),h('div',{class:'note',text:'Εξοπλισμός: '+t.g})));
  L.append(h('p',{class:'note',text:'Οι τιμές είναι ενδεικτικές. Προσάρμοσέ τες στο σημείο, το ψάρι-στόχο και το ρεύμα.'}));
}
const CHECKS=['Σωσίβια για όλους στο σκάφος','VHF και φορτισμένο κινητό','Φάρμακα και κουτί πρώτων βοηθειών','Πυρσοί και σήμα κινδύνου','Άγκυρα και αρκετό σχοινί','Καύσιμο με εφεδρεία','Νερό και προστασία από τον ήλιο','Τσιμπίδα και γάντια για αγκάθια','Πρόγνωση καιρού ελεγμένη','Ενημέρωση κάποιου στη στεριά για τη διαδρομή'];
function renderChecks(){
  const saved=lsGet('alkyon-checks',{}); const C=$('checks'); C.replaceChildren();
  CHECKS.forEach((t,i)=>{
    const id='ck'+i, cb=h('input',{type:'checkbox',id:id});
    cb.checked=!!saved[i];
    cb.addEventListener('change',()=>{const s2=lsGet('alkyon-checks',{});s2[i]=cb.checked;lsSet('alkyon-checks',s2);});
    C.append(h('div',{class:'chk'},cb,h('label',{for:id,text:t})));
  });
}
document.querySelectorAll('#tab-guide .seg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#tab-guide .seg button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  for(const g of ['species','tech','law','safety','shops']) $('g-'+g).hidden=(g!==b.dataset.g);
}));

/* ---------- Bites and statistics ---------- */
document.querySelectorAll('#logSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#logSeg button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  for(const g of ['trips','bites','stats']) $('l-'+g).hidden=(g!==b.dataset.l);
}));
const nowLocalInput=()=>nicosiaToday()+'T'+fmt(nicosiaNowMin());
const PT=window.LANG==='en'?{slow:'Falling slowly',stable:'Steady',rise:'Rising',fast:'Falling fast'}:{slow:'Πέφτει αργά',stable:'Σταθερή',rise:'Ανεβαίνει',fast:'Πέφτει απότομα'};
const MOON_LBL=['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα','Πανσέληνος','Φθίνουσα','Τελευταίο τέταρτο','Φθίνων μηνίσκος'];
function biteMs(b){
  const [y,m,d]=(b.date||nicosiaToday()).split('-').map(Number), [hh,mm]=(b.time||'12:00').split(':').map(Number);
  const off=b.tz!=null?b.tz:tzOffsetMin(new Date(Date.UTC(y,m-1,d,12)));
  return Date.UTC(y,m-1,d,hh,mm)-off*60000;
}
function biteMoon(b){let a=((biteMs(b)-REF)/86400000)%SYN; if(a<0)a+=SYN; return Math.floor(a/SYN*8+0.5)%8;}
const norm=t=>(t||'').trim().toLowerCase();

/* quick-log sheet */
let photoBlob=null, photoBlobs=[], phDirty=false, curLatin='', sheetFresh=true, editRec=null, pressTouched=false;
$('bPress').addEventListener('input',()=>{ pressTouched=true; });
/* v31z399: ψαριά κοντά (≤300 m) σε αποθηκευμένο σημείο ή σε παλιά ψαριά με όνομα → παίρνει αυτόματα το ίδιο όνομα σημείου */
const NEAR_KM=0.3;
function nearPlace(lat,lon){
  if(typeof lat!=='number'||typeof lon!=='number') return null; let best=null;
  Store.get('spots').forEach(s=>{ if(typeof s.lat!=='number'||!s.name) return; const d=haversine(lat,lon,s.lat,s.lon); if(d<=NEAR_KM&&(!best||d<best.d)) best={name:s.name,d:d,spot:s.id}; });
  if(best) return best;
  Store.get('bites').forEach(b=>{ if(typeof b.lat!=='number'||!b.place||(editRec&&b.id===editRec.id)) return; const d=haversine(lat,lon,b.lat,b.lon); if(d<=NEAR_KM&&(!best||d<best.d)) best={name:b.place,d:d}; });
  return best;
}
function locNow(){ const m=$('bLocMode').value; if(m==='auto') return cond&&cond.lat!=null?{lat:cond.lat,lon:cond.lon}:null; if(m==='pick'||m==='coords') return pickedPt; return null; }
function nearHint(){
  let h=$('bNearHint'); if(!h){ h=document.createElement('p'); h.id='bNearHint'; h.className='note'; h.style.margin='4px 0 0'; const w=$('bSpotWrap'); if(!w) return; w.parentNode.insertBefore(h,w); }
  const q=locNow(), np=q&&nearPlace(q.lat,q.lon), en=window.LANG==='en';
  h.hidden=!np; if(np) h.textContent='📍 '+(en?'Near «'+np.name+'» ('+Math.round(np.d*1000)+' m): the catch will be grouped under this spot.':'Κοντά στο «'+np.name+'» ('+Math.round(np.d*1000)+' m): η ψαριά θα μπει σε αυτό το σημείο.');
}
function syncLoc(){
  const m=$('bLocMode').value;
  try{ setTimeout(nearHint,0); }catch(e){}
  $('bSpotWrap').hidden=m!=='spot'; $('bPickWrap').hidden=m!=='pick'; $('bCoordWrap').hidden=m!=='coords';
  if(m==='coords'&&!$('bLat').value&&!$('bLon').value){ const q=pickedPt||(editRec&&typeof editRec.lat==='number'?{lat:editRec.lat,lon:editRec.lon}:null); if(q){ AlkyonCoord.set($('bLat'),$('bLon'),q.lat,q.lon); pickedPt={lat:q.lat,lon:q.lon}; } }
  $('bPickTxt').textContent=pickedPt?AlkyonCoord.fmt(pickedPt.lat,pickedPt.lon):'Δεν έχει επιλεγεί θέση.';
}
AlkyonCoord.bind($('bLat'),$('bLon'),(la,lo)=>{ pickedPt=(la!=null&&lo!=null)?{lat:la,lon:lo}:null; if($('bLocMode').value==='coords'){ syncLoc(); updateLaw(); } });
function tripActive(){ const ts=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); return !!(ts&&ts.active); }
function needTrip(){
  const en=window.LANG==='en';
  window.AlkyonAsk(en?'To record a fish correctly (time, position, conditions and numbering) start a trip first.':'Για να καταγραφεί σωστά το ψάρι (ώρα, θέση, συνθήκες και αρίθμηση) ξεκίνα πρώτα έξοδο.',{title:en?'Start a trip first':'Ξεκίνα πρώτα έξοδο',ok:en?'Start trip':'Έναρξη εξόδου',cancel:en?'Cancel':'Άκυρο'}).then(y=>{ if(y) $('tripBtn').click(); });
}
/* v31z12: σε ποια έξοδο ανήκει το ψάρι (και αλλαγή εκ των υστέρων) */
function fillTripSel(cur){
  const s=$('bTrip'); if(!s) return; const en=window.LANG==='en';
  const ts=Store.get('trips').filter(t=>t.sid).sort((x,y)=>(y.startMs||0)-(x.startMs||0)||String(y.date||'').localeCompare(String(x.date||''))).slice(0,40);
  s.replaceChildren(new Option(en?'No trip':'Καμία έξοδος',''));
  ts.forEach(t=>s.add(new Option((t.date||'')+' · '+(t.spot||(en?'trip':'έξοδος'))+' ('+(t.count||0)+')',t.sid)));
  s.value=cur||'';
  if(cur&&s.value!==cur){ s.add(new Option(en?'Current trip':'Τρέχουσα έξοδος',cur)); s.value=cur; }
}
function nextN(sid){ return Store.raw('bites').filter(b=>b.trip===sid&&!b.miss).reduce((m,b)=>Math.max(m,+b.n||0),0)+1; }
async function recountTrip(sid){
  if(!sid) return; const t=Store.get('trips').find(x=>x.sid===sid); if(!t) return;
  const bs=Store.raw('bites').filter(b=>b.trip===sid&&!b.miss), kg=Math.round(bs.reduce((s,b)=>s+(b.rel?0:(+b.kg||0)),0)*10)/10;
  await Store.save('trips',Object.assign({},t,{count:bs.reduce((s,b)=>s+bc(b),0),kg:kg}));
}
function openSheet(){
  try{ if(window.AlkyonTackle) AlkyonTackle.mount($('bTackle'),sheetFresh?'last':AlkyonTackle.sel(),AlkyonTackle.selW(),AlkyonTackle.selH(),AlkyonTackle.selS()); }catch(e){}
  if(sheetFresh){
    $('bWhen').value=nowLocalInput();
    if(cond&&cond.press!=null) $('bPress').value=cond.press;
    sheetFresh=false; fillTripSel('');
    Promise.resolve(refreshConditions()).then(()=>{ try{ nearHint(); }catch(e){} });
  }
  renderChips(); syncLoc(); updateLaw();
  $('sheet').hidden=false;
}
function closeSheet(keep){ $('sheet').hidden=true; $('bSug').hidden=true; if(editRec&&keep!==true) resetSheet(); }
function resetSheet(){
  if($('bPriv')) $('bPriv').checked=false;
  $('biteForm').reset(); photoBlob=null; photoBlobs=[]; phDirty=false; renderPrevs(); curLatin=''; pickedPt=null; sheetFresh=true; editRec=null; window.AlkyonEditRec=null; pressTouched=false;
  $('bPrev').hidden=true; $('bPrevX').hidden=true; $('bAI').hidden=true; $('bAIOut').replaceChildren(); $('bAIMsg').textContent=''; $('bLaw').textContent=''; $('bErr').textContent=''; multiSync();
  try{ if(window.AlkyonTackle) AlkyonTackle.mount($('bTackle'),'last'); }catch(e){}
}
$('bMulti').addEventListener('change',()=>{ multiSync(); if($('bMulti').checked){ try{ $('bCnt').focus(); }catch(e){} } });
const fabOpen=()=>{ try{ if(window.AlkyonGear&&window.AlkyonGear.catchIfHauling&&window.AlkyonGear.catchIfHauling()) return; }catch(e){} openSheet(); };
$('fab').addEventListener('click',fabOpen);
$('bNew').addEventListener('click',fabOpen);
$('bClose').addEventListener('click',()=>closeSheet());
$('sheet').addEventListener('click',e=>{ if(e.target===$('sheet')) closeSheet(); });
$('bLocMode').addEventListener('change',()=>{syncLoc();updateLaw();});
$('bPickBtn').addEventListener('click',()=>{ closeSheet(true); startPick('bite'); });
function renderPrevs(){
  const box=$('bPrevs'); if(box){
    box.replaceChildren();
    photoBlobs.forEach((bl,i)=>{
      const u=URL.createObjectURL(bl);
      const w=h('div',{class:'pvw'},h('img',{src:u,alt:'',class:'thumb',onload:()=>setTimeout(()=>URL.revokeObjectURL(u),3000)}),
        h('button',{class:'pvx',type:'button','aria-label':window.LANG==='en'?'Remove photo':'Αφαίρεση φωτογραφίας',text:'✕',onclick:()=>{ photoBlobs.splice(i,1); phDirty=true; syncPhotos(); }}));
      box.append(w);
    });
    box.hidden=!photoBlobs.length;
  }
  const cnt=$('bPhCnt'); if(cnt){ cnt.textContent=photoBlobs.length?photoBlobs.length+'/'+MAXPH:''; cnt.hidden=!photoBlobs.length; }
}
function syncPhotos(){
  photoBlob=photoBlobs[0]||null; renderPrevs();
  const has=!!photoBlob; $('bPrev').hidden=true; $('bPrevX').hidden=!has; $('bAI').hidden=!has;
  if(!has){ $('bAIOut').replaceChildren(); $('bAIMsg').textContent=''; }
}
['bFile','bCam'].forEach(id=>$(id).addEventListener('change',async e=>{
  const fs=[...e.target.files]; if(!fs.length) return;
  const room=MAXPH-photoBlobs.length;
  if(room<=0){ toast(window.LANG==='en'?'Maximum '+MAXPH+' photos per fish.':'Έως '+MAXPH+' φωτογραφίες ανά ψάρι.'); e.target.value=''; return; }
  let bad=0;
  for(const f of fs.slice(0,room)){ try{ photoBlobs.push(await resizeImage(f)); }catch(err){ bad++; } }
  if(fs.length>room) toast(window.LANG==='en'?'Maximum '+MAXPH+' photos per fish.':'Έως '+MAXPH+' φωτογραφίες ανά ψάρι.');
  else if(bad) toast('Η φωτογραφία δεν διαβάστηκε.');
  $('bAIOut').replaceChildren(); $('bAIMsg').textContent='';
  phDirty=true; syncPhotos(); e.target.value='';
}));
$('bPrevX').addEventListener('click',()=>{ photoBlobs=[]; phDirty=true; syncPhotos(); });
function renderChips(){
  const bites=Store.get('bites').slice().sort((a,b)=>biteMs(b)-biteMs(a));
  const uniq=(arr,n)=>[...new Set(arr.map(x=>(x||'').trim()).filter(Boolean))].slice(0,n);
  const fill=(el,items,input)=>{el.replaceChildren(); items.forEach(x=>{ const lbl=(input===$('bSpecies')&&window.LANG==='en'&&window.spName)?window.spName(x):x; el.append(h('button',{type:'button',class:'chip',text:lbl,onclick:()=>{input.value=lbl; if(input===$('bSpecies')){const m=DB.find(d=>dispName(d)===x); curLatin=m?m.la:(bites.find(b=>b.species===x)||{}).latin||''; updateLaw();}}})); });};
  /* v31z404: λίμνη/φράγμα → προτάσεις από τα ψάρια λίμνης και δολώματα γλυκού νερού */
  let lake=false; try{ lake=localStorage.getItem('alkyon-fprof')==='lake'; }catch(e){}
  let fp='boat'; try{ fp=localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){}
  const famOf=p=>p==='spear'?'spear':p==='lake'?'lake':'sea', pool=bites.filter(b=>famOf(b.prof||'boat')===famOf(fp)); /* v31z409: προτάσεις μόνο από ψάρια του ίδιου τύπου ψαρέματος */
  const LB=window.LANG==='en'?['Sweetcorn','Boilies','Worms','Bread / paste','Pellets','Soft plastic','Spinner']:['Καλαμπόκι','Boilies','Σκουλήκι','Ψωμί / ζύμη','Pellets','Σιλικονούχο τεχνητό','Spinner'];
  fill($('bChipsSp'),uniq(pool.map(b=>b.species),6),$('bSpecies'));
  fill($('bChipsBait'),uniq(pool.map(b=>b.bait).concat(lake?LB:[]),lake?8:6),$('bBait'));
  /* οι τεχνικές λίμνης τις ορίζει ήδη το προφίλ ψαρέματος (redesign.js) */
}
/* species suggestions */
let sugT=null, sugSeq=0;
function showSug(items){
  const box=$('bSug'); box.replaceChildren();
  items.forEach(sp=>box.append(h('button',{type:'button',class:'sugi',onclick:()=>{ $('bSpecies').value=shownName(sp); curLatin=sp.la; box.hidden=true; updateLaw(); }},h('b',{text:shownName(sp)}),h('span',{class:'lat',text:(sp.el&&sp.en?(window.LANG==='en'?sp.el:sp.en)+' · ':'')+sp.la}))));
  box.hidden=!items.length;
}
$('bSpecies').addEventListener('input',()=>{
  curLatin=''; const q=$('bSpecies').value.trim();
  clearTimeout(sugT);
  if(q.length<2){ $('bSug').hidden=true; return; }
  const local=searchDB(q,8); showSug(local);
  if(q.length>=4&&local.length<4){
    const seq=++sugSeq;
    sugT=setTimeout(async()=>{
      try{ const r=await gbifSearch(q); if(seq!==sugSeq||$('bSpecies').value.trim()!==q) return;
        showSug(local.concat(r.filter(e=>!local.some(d=>d.la.toLowerCase()===e.la.toLowerCase())).slice(0,6))); }catch(e){}
    },500);
  }
});
$('bSpecies').addEventListener('focus',()=>setTimeout(()=>{ try{ $('bSpecies').scrollIntoView({block:'start',behavior:'smooth'}); }catch(e){} },300));
$('bSpecies').addEventListener('blur',()=>setTimeout(()=>{ $('bSug').hidden=true; const m=matchSp($('bSpecies').value); if(m){ $('bSpecies').value=shownName(m); curLatin=m.la; try{ updateLaw(); }catch(e){} } },200));
$('biteForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=$('biteForm').querySelector('button[type=submit]'); btn.disabled=true; btn.textContent='Αποθήκευση…';
  $('bErr').textContent='';
  if($('bLocMode').value==='coords'&&!AlkyonCoord.get($('bLat'),$('bLon'))){ $('bErr').textContent='Γράψε έγκυρες συντεταγμένες, π.χ. N 35°03.602′ και E 32°23.856′.'; btn.disabled=false; btn.textContent='Αποθήκευση'; return; }
  try{
    const [date,time]=$('bWhen').value.split('T');
    const mode=$('bLocMode').value;
    const editing=editRec;
    const isNow=!editing&&Math.abs(biteMs({date:date,time:time,tz:utcOff()})-Date.now())<90*60000;
    let c=cond;
    if(isNow||(mode==='auto'&&!cond)) c=await refreshConditions();
    let lat=null,lon=null,place='';
    if(mode==='auto'&&c&&c.lat!=null){lat=c.lat;lon=c.lon;}
    else if(mode==='spot'){const sp=Store.get('spots').find(x=>x.id===$('bSpot').value); if(sp){lat=sp.lat;lon=sp.lon;place=sp.name;}}
    else if((mode==='pick'||mode==='coords')&&pickedPt){lat=pickedPt.lat;lon=pickedPt.lon;}
    else if(mode==='keep'&&editing){lat=editing.lat;lon=editing.lon;place=editing.place||'';}
    if(!place&&lat!=null&&(mode==='auto'||mode==='pick'||mode==='coords')){ const np=nearPlace(lat,lon); if(np) place=np.name; }
    const num=id=>$(id).value===''?null:+$(id).value;
    let sName=$('bSpecies').value.trim(); { const mm=matchSp(sName); if(mm){ sName=dispName(mm); if(!curLatin) curLatin=mm.la; } }
    let rec={date:date,time:(time||'12:00').slice(0,5),tz:utcOff(),species:sName,latin:curLatin||'',bait:$('bBait').value.trim(),tech:$('bTech').value,
      depth:num('bDepth'),kg:num('bKg'),len:num('bLen'),press:(isNow||pressTouched||editing)?num('bPress'):null,notes:$('bNotes').value.trim(),
      ptrend:isNow?$('dPress').value:null,wind:isNow?+$('dWind').value:null,wdeg:isNow&&c&&c.windDeg!=null?Math.round(c.windDeg):null,wave:isNow?+$('dWave').value:null,cloud:isNow?$('dCloud').value:null,
      cur:isNow&&c&&c.cur!=null?c.cur:null,tide:isNow&&c&&c.tide?c.tide.st:null,temp:isNow&&c&&c.temp!=null?c.temp:null,sst:isNow&&c&&c.sst!=null?c.sst:null,
      place:place,lat:lat,lon:lon,photo:false,src:'app'};
    { const tks=(window.AlkyonTackle&&$('bTackle'))?AlkyonTackle.sel():[]; if(tks.length){ rec.tk=tks; const tw=AlkyonTackle.selW(); if(Object.keys(tw).length) rec.tkw=tw; const th=AlkyonTackle.selH(); if(Object.keys(th).length) rec.tkh=th; const ts_=AlkyonTackle.selS(); if(Object.keys(ts_).length) rec.tks=ts_; } }
    let cntV=0; if($('bMulti').checked){ const cn=Math.floor(+$('bCnt').value); if(!(cn>=2)){ $('bErr').textContent=window.LANG==='en'?'Enter how many fish (2 or more).':'Γράψε πόσα ψάρια έπιασες (2 ή περισσότερα).'; btn.disabled=false; btn.textContent='Αποθήκευση'; return; } cntV=Math.min(9999,cn); }
    if($('bRel').checked) rec.rel=true;
    if(editing){ const tks2=rec.tk, tkw2=rec.tkw, tkh2=rec.tkh, tks3=rec.tks; rec=Object.assign({},editing,{tk:tks2,tkw:tkw2,tkh:tkh2,tks:tks3,date:rec.date,time:rec.time,species:rec.species,latin:rec.latin,bait:rec.bait,tech:rec.tech,depth:rec.depth,kg:rec.kg,len:rec.len,press:rec.press,notes:rec.notes,photo:!!editing.photo,lat:lat,lon:lon,place:place}); if($('bRel').checked) rec.rel=true; else delete rec.rel; if(!(rec.tk&&rec.tk.length)) delete rec.tk; if(!rec.tkw) delete rec.tkw; if(!rec.tkh) delete rec.tkh; if(!rec.tks) delete rec.tks; }
    if(cntV) rec.cnt=cntV; else delete rec.cnt;
    if(lat!=null&&window.AlkyonHist){
      const tms=biteMs({date:date,time:rec.time,tz:rec.tz!=null?rec.tz:utcOff()});
      const chg=!!editing&&((editing.hist&&(editing.date!==date||editing.time!==rec.time||editing.lat!==lat||editing.lon!==lon))||(!editing.hist&&Math.abs(tms-biteMs(editing))>90*60000));
      const need=tms<Date.now()-90*60000&&(!editing?!isNow:(AlkyonHist.empty(editing)||chg));
      if(need){
        btn.textContent=window.LANG==='en'?'Looking up weather…':'Αναζήτηση καιρού…';
        const hc=await AlkyonHist.fetch(lat,lon,tms);
        if(hc){ AlkyonHist.keys.forEach(k=>{ if(hc[k]!=null&&(chg||rec[k]==null||rec[k]==='')) rec[k]=hc[k]; }); if(hc.wavePeriod!=null) rec.wavePeriod=hc.wavePeriod; rec.hist=true; }
        else { if(chg){ AlkyonHist.keys.forEach(k=>{ rec[k]=null; }); rec.wavePeriod=null; delete rec.hist; } toast(window.LANG==='en'?'Historical weather not found. Left blank.':'Δεν βρέθηκε ιστορικός καιρός. Έμεινε κενό.'); }
      }
    }
    { const wm=$('bWindM').value, wd=$('bWdirM').value, KN=[0,2,5,8.5,13.5,19,24.5,30.5,37,44,52];
      if(wm!==''){ rec.wind=KN[+wm]; rec.wman=true; } else if(editing&&editing.wman) { delete rec.wman; }
      if(wd!==''){ rec.wdeg=+wd*45; rec.wman=true; } }
    if(!editing) tripStamp(rec,false);
    if(phDirty||!editing){ const n=photoBlobs.length; rec.photo=n>0; if(n>1) rec.xph=n-1; else delete rec.xph; }
    const tsel=$('bTrip')?$('bTrip').value:'';
    if(editing){ if(tsel!==(editing.trip||'')){ if(tsel){ rec.trip=tsel; rec.n=nextN(tsel); } else { delete rec.trip; delete rec.n; } } }
    else if(tsel){ rec.trip=tsel; rec.n=nextN(tsel); }
    if($('bPriv')){ if($('bPriv').checked) rec.priv=true; else delete rec.priv; } /* v31z401: ιδιωτικό, δεν το βλέπουν οι φίλοι */
    const id=await Store.save('bites',rec);
    try{ if(window.AlkyonBiteWx) window.AlkyonBiteWx.ensure(Object.assign({},rec,{id:id})); }catch(e){} /* v31z352: και τα χαμένα κρατούν πίεση/άνεμο ±30 λεπτά */
    try{ if(editing&&(editing.trip||'')!==(rec.trip||'')){ await recountTrip(editing.trip); await recountTrip(rec.trip); } else if(!editing&&tsel) await recountTrip(tsel); else if(editing&&rec.trip&&(!!editing.rel!==!!rec.rel||editing.kg!==rec.kg)) await recountTrip(rec.trip); }catch(e){}
    if(phDirty){ try{ const oldKeys=editing?phKeys(editing):[]; const n=photoBlobs.length; for(let pi=0;pi<n;pi++) await Photos.put(pi===0?id:id+'~'+pi,photoBlobs[pi]); for(const k of oldKeys){ const m=k.indexOf('~'); const idx=m<0?0:+k.slice(m+1); if(idx>=n) await Photos.del(k); } }catch(err){ await Store.save('bites',Object.assign({},rec,{id:id,photo:!!(editing&&editing.photo),xph:editing?editing.xph:undefined})); toast('Η φωτογραφία δεν αποθηκεύτηκε.'); } }
    resetSheet(); closeSheet();
    try{ const lw=latinForName(rec.species), mn=lw&&minOf(lw); if(mn&&rec.len&&rec.len<mn) setTimeout(()=>toast('⚠ '+(window.LANG==='en'?'Under the minimum size (':'Κάτω από το ελάχιστο μέγεθος (')+mn+' cm)'),600); if(lw==='Lagocephalus sceleratus') setTimeout(()=>toast('⚠ '+(window.LANG==='en'?'Toxic species. Do not eat it.':'Τοξικό είδος. Μην το φας.')),600); }catch(e){}
    if(editing){ toast('Αποθηκεύτηκε.'); }
    else if(lat!=null){ toast(window.LANG==='en'?'Saved on the map':'Αποθηκεύτηκε στον χάρτη'); if(!document.body.classList.contains('ontrip')) showOnMap(lat,lon,id); }
    else { toast(mode==='auto'?'Αποθηκεύτηκε, αλλά δεν βρέθηκε θέση.':'Αποθηκεύτηκε χωρίς θέση.'); }
  }catch(err){ $('bErr').textContent='Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'; }
  btn.disabled=false; btn.textContent='Αποθήκευση';
});
function editBite(b){
  resetSheet(); editRec=b; window.AlkyonEditRec=b; sheetFresh=false;
  $('bWhen').value=(b.date||nicosiaToday())+'T'+(b.time||'12:00');
  $('bSpecies').value=(window.LANG==='en'&&window.spName)?window.spName(b.species||''):(b.species||''); curLatin=b.latin||'';
  $('bBait').value=b.bait||''; $('bTech').value=b.tech||''; try{ if(window.AlkyonTackle) AlkyonTackle.mount($('bTackle'),b.tk||[],b.tkw||{},b.tkh||{},b.tks||{}); }catch(e){}
  for(const [id,k] of [['bDepth','depth'],['bKg','kg'],['bLen','len'],['bPress','press']]) $(id).value=b[k]==null?'':b[k];
  $('bWindM').value=(b.wman&&b.wind!=null)?String(Math.min(10,bft(b.wind))):''; $('bWdirM').value=(b.wman&&b.wdeg!=null)?String(Math.round((((b.wdeg%360)+360)%360)/45)%8):'';
  $('bNotes').value=b.notes||''; $('bRel').checked=!!b.rel; if($('bPriv')) $('bPriv').checked=!!b.priv; $('bMulti').checked=bc(b)>1; $('bCnt').value=bc(b)>1?bc(b):''; multiSync();
  $('bLocMode').value=(typeof b.lat==='number')?'keep':'none';
  fillTripSel(b.trip||'');
  renderChips(); syncLoc(); updateLaw(); $('sheet').hidden=false;
  const ks=phKeys(b); if(ks.length){ Promise.all(ks.map(k=>Photos.get(k).catch(()=>null))).then(bl=>{ if(editRec!==b) return; photoBlobs=bl.filter(Boolean).concat(photoBlobs); syncPhotos(); }); }
}
function tripStamp(rec,miss){
  try{ if(window.AlkyonGear&&!miss) window.AlkyonGear.tag(rec); }catch(e){}
  const s=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state();
  if(!s||!s.active) return rec;
  const mx=Store.raw('bites').filter(b=>b.trip===s.id&&!!b.miss===!!miss).reduce((m,b)=>Math.max(m,+b.n||0),0);
  rec.trip=s.id; rec.n=mx+1; return rec;
}
let quickBusy=false;
async function quickRec(miss){
  if(quickBusy) return; quickBusy=true;
  const btn=$('bQuick'); btn.disabled=true; const en=window.LANG==='en';
  try{
    let c=null; const fx=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix();
    if(fx&&Date.now()-fx.t<120000&&cond) c=Object.assign({},cond,{lat:fx.lat,lon:fx.lon});
    else { try{ c=await refreshConditions(); }catch(e){} }
    c=c||cond||{};
    const has=c.lat!=null;
    const rec={date:nicosiaToday(),time:fmt(nicosiaNowMin()),tz:utcOff(),species:'',latin:'',bait:'',tech:'',depth:null,kg:null,len:null,press:c.press!=null?c.press:null,notes:'',
      ptrend:$('dPress').value,wind:+$('dWind').value,wdeg:c.windDeg!=null?Math.round(c.windDeg):null,wave:+$('dWave').value,cloud:$('dCloud').value,temp:c.temp!=null?c.temp:null,sst:c.sst!=null?c.sst:null,tide:c.tide?c.tide.st:null,
      place:has?((nearPlace(c.lat,c.lon)||{}).name||''):'',lat:has?c.lat:null,lon:has?c.lon:null,photo:false,src:miss?'miss':'quick'};
    if(miss) rec.miss=true;
    try{ if(window.AlkyonTackle){ const L=AlkyonTackle.last(); if(L.ids.length){ rec.tk=L.ids; if(Object.keys(L.w).length) rec.tkw=L.w; if(Object.keys(L.h).length) rec.tkh=L.h; if(Object.keys(L.s).length) rec.tks=L.s; } } }catch(e){}
    tripStamp(rec,!!miss);
    const id=await Store.save('bites',rec);
    try{ if(window.AlkyonBiteWx) window.AlkyonBiteWx.ensure(Object.assign({},rec,{id:id})); }catch(e){} /* v31z352: και τα χαμένα κρατούν πίεση/άνεμο ±30 λεπτά */
    const live=document.body.classList.contains('ontrip');
    if(miss) toast(en?'Miss logged ✕':'Καταγράφηκε αστοχία ✕');
    else { toast(en?'Fish logged 🐟 Add the species later from Log → Bites → Edit.':'Ψάρι καταγράφηκε 🐟 Πρόσθεσε είδος αργότερα από Ημερολόγιο → Τσιμπήματα → Επεξεργασία.'); if(has&&!live&&$('tab-map').hidden===false) showOnMap(c.lat,c.lon,id); }
  }catch(e){ toast(en?'Not saved. Try again.':'Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'); }
  finally{ btn.disabled=false; quickBusy=false; }
}
/* v31z352: γρήγορο ψάρι/χαμένο σε σημείο του χάρτη, με καιρό εκείνου του σημείου */
async function quickAt(lat,lon,miss){
  const en=window.LANG==='en'; let c={};
  try{ c=await fetchConditions(lat,lon)||{}; }catch(e){ c={}; }
  try{
    const rec={date:nicosiaToday(),time:fmt(nicosiaNowMin()),tz:utcOff(),species:'',latin:'',bait:'',tech:'',depth:null,kg:null,len:null,press:c.press!=null?c.press:null,notes:'',
      ptrend:c.ptrend||null,wind:c.wind!=null?c.wind:null,wdeg:c.windDeg!=null?Math.round(c.windDeg):null,wave:c.wave!=null?Math.round(c.wave*10)/10:null,cloud:c.cloud||null,temp:c.temp!=null?c.temp:null,sst:c.sst!=null?c.sst:null,tide:c.tide?c.tide.st:null,
      place:(nearPlace(lat,lon)||{}).name||'',lat:lat,lon:lon,photo:false,src:miss?'miss-map':'map'};
    if(miss) rec.miss=true;
    try{ if(window.AlkyonTackle){ const Lt=AlkyonTackle.last(); if(Lt.ids.length){ rec.tk=Lt.ids; if(Object.keys(Lt.w).length) rec.tkw=Lt.w; if(Object.keys(Lt.h).length) rec.tkh=Lt.h; if(Object.keys(Lt.s).length) rec.tks=Lt.s; } } }catch(e){}
    tripStamp(rec,!!miss);
    const id=await Store.save('bites',rec);
    try{ if(window.AlkyonBiteWx) window.AlkyonBiteWx.ensure(Object.assign({},rec,{id:id})); }catch(e){}
    toast(miss?(en?'Lost fish logged here ✕':'Καταγράφηκε χαμένο εδώ ✕'):(en?'Fish logged here 🐟 Add the species later from Log → Bites.':'Ψάρι καταγράφηκε εδώ 🐟 Βάλε είδος αργότερα από Ημερολόγιο → Τσιμπήματα.'));
  }catch(e){ toast(en?'Not saved. Try again.':'Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'); }
}
async function spotAt(lat,lon){
  const en=window.LANG==='en', d=new Date(), nm=(en?'Spot ':'Σημείο ')+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
  try{ const id=await Store.save('spots',{name:nm,type:$('sType').options[0].value,lat:lat,lon:lon,depth:null,notes:''}); selSpot=id; toast(en?'Spot saved. Tap it to rename.':'Αποθηκεύτηκε σημείο. Πάτα πάνω του για όνομα.'); }
  catch(e){ toast(en?'Not saved. Try again.':'Δεν αποθηκεύτηκε. Δοκίμασε ξανά.'); }
}
const quickBite=()=>quickRec(false);
$('bQuick').addEventListener('click',quickBite);
function updateSuggest(){
  const bites=Store.get('bites');
  const sel=$('stSpecies'), cur=sel.value; sel.replaceChildren(h('option',{value:'',text:'Όλα τα είδη'}));
  [...new Set(bites.map(b=>(b.species||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')).forEach(n=>sel.append(h('option',{value:n,text:n})));
  sel.value=[...sel.options].some(o=>o.value===cur)?cur:'';
  const ls=$('logSp'); if(ls){ const cnt={}; bites.forEach(b=>{ const n=(b.species||'').trim(); if(n&&!b.gear) cnt[n]=(cnt[n]||0)+(window.AlkyonCore&&AlkyonCore.bc?AlkyonCore.bc(b):1); });
    ls.replaceChildren(h('option',{value:'',text:T2('Όλα τα είδη','All species')})); Object.keys(cnt).sort((x,y)=>x.localeCompare(y,'el')).forEach(n=>ls.append(h('option',{value:n,text:n+' ('+cnt[n]+')'}))); }
  syncSpf();
}
function spfGet(){ return lsGet('alkyon-spf','')||''; }
function syncSpf(){ const v=spfGet(); [$('stSpecies'),$('logSp')].forEach(s=>{ if(!s) return; if(v&&![...s.options].some(o=>o.value===v)) s.append(h('option',{value:v,text:v})); s.value=v; }); const w=$('logSpWrap'); if(w) w.classList.toggle('on',!!v); }
function spfSet(v){ lsSet('alkyon-spf',v||''); syncSpf(); try{ renderBites(); renderStats(); }catch(e){} document.dispatchEvent(new Event('alkyon-spfilter')); }
window.addEventListener('storage',e=>{ if(e.key==='alkyon-spf') syncSpf(); });
window.AlkyonSpf={get:spfGet,set:v=>spfSet(v)};
const biteSortGet=sortSel('bites',[['new',T2('Νεότερα πρώτα','Newest first')],['old',T2('Παλαιότερα πρώτα','Oldest first')],['kg',T2('Βαρύτερα','Heaviest')],['len',T2('Μεγαλύτερο μήκος','Longest')],['sp',T2('Είδος (Α–Ω)','Species (A–Z)')]],'new',()=>renderBites(),$('biteList'));
function missCond(b){ const en=window.LANG==='en'; return [b.wind!=null?PU.wind(b.wind)+wdTxt(b):null,b.wave!=null?PU.wave(b.wave)+(en?' wave':' κύμα'):null,b.press!=null?PU.press(b.press):null,b.ptrend?PT[b.ptrend]:null,MOON_LBL[biteMoon(b)]].filter(Boolean).join(' · '); }
function renderMisses(){
  const L=$('missList'); if(!L) return; L.replaceChildren();
  const en=window.LANG==='en';
  const ms=(Store.misses?Store.misses():[]).filter(b=>AlkyonRange.inR('log',b)).sort((a,b)=>biteMs(b)-biteMs(a));
  if(!ms.length) return;
  L.append(h('h3',{text:'✕ '+T2('Χαμένα τσιμπήματα','Lost bites')+' ('+ms.length+')',style:'margin:18px 0 8px'}));
  for(const b of ms){
    const del=h('button',{class:'btn ghost sm',type:'button',text:T2('Διαγραφή','Delete')});
    del.addEventListener('click',()=>{ window.AlkyonAsk(T2('Να διαγραφεί αυτή η αστοχία;','Delete this lost bite?'),{title:T2('Διαγραφή αστοχίας','Delete lost bite'),ok:T2('Διαγραφή','Delete'),cancel:T2('Άκυρο','Cancel'),danger:true}).then(ok=>{ if(ok) Store.remove('bites',b.id).catch(()=>{}); }); });
    const acts=[del];
    if(typeof b.lat==='number') acts.unshift(h('button',{class:'btn ghost sm',type:'button',text:T2('Χάρτης','Map'),onclick:()=>showOnMap(b.lat,b.lon,b.id)}));
    const cd=[b.wind!=null?PU.wind(b.wind)+wdTxt(b):null,b.wave!=null?PU.wave(b.wave)+(en?' wave':' κύμα'):null,b.press!=null?PU.press(b.press):null,b.ptrend?PT[b.ptrend]:null,MOON_LBL[biteMoon(b)],b.temp!=null?Math.round(b.temp)+'°C':null,b.sst!=null?(en?'sea ':'θάλασσα ')+Math.round(b.sst)+'°C':null,b.hist?(en?'estimate':'εκτίμηση'):null].filter(Boolean).join(' · ');
    const td=nicosiaToday(), dd=b.date===td?T2('Σήμερα','Today'):(b.date?b.date.slice(8,10)+'/'+b.date.slice(5,7):'');
    L.append(h('div',{class:'item bite'},
      h('div',{class:'ihead'},h('b',{class:'ititle',text:'✕ '+T2('Χάθηκε','Lost')}),h('span',{class:'when mono',text:[dd,b.time].filter(Boolean).join(' · ')})),
      h('div',{class:'meta',text:[b.bait,b.tech,b.depth!=null&&b.depth!==''?b.depth+' m':null,(typeof b.lat==='number'?AlkyonCoord.fmt(b.lat,b.lon):null)].filter(Boolean).join(' · ')||'—'}),
      tkLine(b)?h('div',{class:'meta',text:tkLine(b)}):null,
      cd?h('div',{class:'meta',text:cd}):null,
      window.AlkyonBiteWx?window.AlkyonBiteWx.slot(b):null,
      h('div',{class:'acts'},acts)));
  }
}
function renderBites(){
  updateSuggest();
  const L=$('biteList'); L.replaceChildren();
  const spf=spfGet(), list=Store.get('bites').filter(b=>!b.gear&&AlkyonRange.inR('log',b)&&(!spf||(b.species||'').trim()===spf)).sort({new:(a,b)=>biteMs(b)-biteMs(a),old:(a,b)=>biteMs(a)-biteMs(b),kg:(a,b)=>(+b.kg||0)-(+a.kg||0)||biteMs(b)-biteMs(a),len:(a,b)=>(+b.len||0)-(+a.len||0)||biteMs(b)-biteMs(a),sp:(a,b)=>(a.species||'￿').localeCompare(b.species||'￿','el')||biteMs(b)-biteMs(a)}[biteSortGet()]);
  if(list.length){ const en=window.LANG==='en', withPos=list.filter(b=>typeof b.lat==='number'&&typeof b.lon==='number');
    L.append(h('button',{class:'btn sm',type:'button',style:'margin:0 0 10px',disabled:!withPos.length,text:(en?'Show all on map':'Όλα στον χάρτη')+' ('+withPos.length+')',onclick:()=>reviewBites(list,n=>{ let p=''; try{ p=AlkyonRange.active('log')?AlkyonRange.label('log'):''; }catch(e){} return n+(en?' fish on the map':' ψάρια στον χάρτη')+(spf?' · '+spf:'')+(p?' · '+p:''); })})); }
  if(!list.length) L.append(h('div',{class:'empty',text:AlkyonRange.active('log')?(window.LANG==='en'?'No bites in this period.':'Κανένα τσίμπημα σε αυτό το διάστημα.'):'Κανένα τσίμπημα ακόμα. Πάτα το + για να καταγράψεις το πρώτο.'}));
  for(const b of list){
    const del=h('button',{class:'btn ghost sm',type:'button',text:'Διαγραφή'});
    del.addEventListener('click',async()=>{
      if(del.dataset.armed!=='1'){del.dataset.armed='1';del.textContent='Σίγουρα;';setTimeout(()=>{del.dataset.armed='';del.textContent='Διαγραφή';},2500);return;}
      try{await Store.remove('bites',b.id); for(const k of phKeys(b)) await Photos.del(k);}catch(e){}
    });
    const acts=[del];
    if(!b.miss) acts.unshift(h('button',{class:'btn ghost sm',type:'button',text:b.rel?(window.LANG==='en'?'Not released':'Δεν αφέθηκε'):(window.LANG==='en'?'↩ Released':'↩ Αφέθηκε'),onclick:()=>toggleRel(b)}));
    acts.unshift(h('button',{class:'btn ghost sm',type:'button',text:'Επεξεργασία',onclick:()=>editBite(b)}));
    if(typeof b.lat==='number') acts.unshift(h('button',{class:'btn ghost sm',type:'button',text:'Χάρτης',onclick:()=>showOnMap(b.lat,b.lon,b.id)}));
    const cd=[b.wind!=null?PU.wind(b.wind)+wdTxt(b):null,b.wave!=null?PU.wave(b.wave)+' κύμα':null,b.press!=null?PU.press(b.press):null,b.ptrend?PT[b.ptrend]:null,MOON_LBL[biteMoon(b)],b.hist?(window.LANG==='en'?'estimate':'εκτίμηση'):null].filter(Boolean).join(' · ');
    const where=b.place||(typeof b.lat==='number'?AlkyonCoord.fmt(b.lat,b.lon):'');
    const img=phGallery(b);
    const td=nicosiaToday(), [ty,tm,tdd]=td.split('-').map(Number), yd=new Date(Date.UTC(ty,tm-1,tdd-1)).toISOString().slice(0,10);
    const dd=b.date===td?(window.LANG==='en'?'Today':'Σήμερα'):b.date===yd?(window.LANG==='en'?'Yesterday':'Χθες'):(b.date?b.date.slice(8,10)+'/'+b.date.slice(5,7):'');
    const when=[dd,b.time].filter(Boolean).join(' · ');
    const en0=window.LANG==='en', nn=bc(b), avg=(nn>1&&+b.kg>0)?Math.round(+b.kg/nn*1000)/1000:null, sz=[b.kg?b.kg+' kg'+(nn>1?(en0?' total':' σύνολο'):''):null,avg?(en0?'avg ':'μέσο ')+avg+' kg':null,b.len?b.len+' cm'+(nn>1?(en0?' avg':' μέσο'):''):null].filter(Boolean).join(' · ');
    L.append(h('div',{class:'item bite','data-bid':b.id},
      h('div',{class:'ihead'},h('b',{class:'ititle',text:(b.n?'#'+b.n+' · ':'')+(b.species||'Άγνωστο')+(nn>1?' ×'+nn:'')}),h('span',{class:'when mono',text:when})),
      sz?h('div',{class:'isz',text:sz+(b.rel?(window.LANG==='en'?' · ↩ Catch & release':' · ↩ Αφέθηκε'):'')}):(b.rel?h('div',{class:'isz',text:(window.LANG==='en'?'↩ Catch & release':'↩ Αφέθηκε')}):null),
      h('div',{class:'meta',text:[b.gearName,b.bait,b.tech,b.depth!=null?b.depth+' m βάθος':null,where].filter(Boolean).join(' · ')}),
      tkLine(b)?h('div',{class:'meta',text:tkLine(b)}):null,
      h('div',{class:'meta',text:cd}),window.AlkyonBiteWx?window.AlkyonBiteWx.slot(b):null,img,
      h('div',{class:'acts'},acts)));
  }
  try{ renderMisses(); }catch(e){}
  renderChips(); drawMap(); renderReco(); if(typeof renderTrips==='function') renderTrips(); if(typeof renderToday==='function') renderToday();
}
/* recommendation */
function renderReco(){
  const card=$('recoCard'); if(!card) return;
  const all=Store.act().filter(b=>norm(b.bait));
  const body=$('recoBody'); body.replaceChildren();
  if(all.length<5){ card.hidden=false; body.append(h('p',{class:'muted',text:'Μετά από 5 τσιμπήματα με καταγεγραμμένο δόλωμα θα σου προτείνω τι να βάλεις, με βάση σελήνη, πίεση, άνεμο και ώρα. Έχεις '+all.length+'.'})); return; }
  const sm=sunMoon(nicosiaToday()), mi=Math.floor(sm.f*8+0.5)%8, pt=$('dPress').value, wb=w=>w<=5?0:w<=12?1:w<=18?2:3, wnow=wb(+$('dWind').value), blk=Math.floor(nicosiaNowMin()/180);
  const sc=new Map(), sp=new Map();
  for(const b of all){
    const md=Math.abs(biteMoon(b)-mi), mdist=Math.min(md,8-md);
    let w=1+(mdist<=1?1:0)+(b.ptrend===pt?1:0)+(b.wind!=null&&wb(b.wind)===wnow?1:0)+(Math.floor(parseInt((b.time||'12:00').slice(0,2),10)/3)===blk?1:0);
    const k=norm(b.bait); const e=sc.get(k)||{n:b.bait.trim(),w:0,c:0,sp:new Map()};
    e.w+=w; e.c++; if(b.species) e.sp.set(b.species.trim(),(e.sp.get(b.species.trim())||0)+1); sc.set(k,e);
  }
  const top=[...sc.values()].sort((a,b)=>b.w-a.w).slice(0,3);
  card.hidden=false;
  top.forEach((e,i)=>{
    const spc=[...e.sp.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(', ');
    body.append(h('div',{class:'bar',style:'grid-template-columns:auto 1fr'},h('b',{text:(i+1)+'.'}),h('span',{},h('b',{text:e.n}),h('span',{class:'muted',text:' · '+e.c+' τσιμπήματα'+(spc?' · '+spc:'')}))));
  });
  body.append(h('p',{class:'note',style:'margin:8px 0 0',text:'Βασίζεται στο δικό σου ιστορικό και στις τωρινές συνθήκες. Με λίγα δεδομένα είναι ένδειξη, όχι κανόνας.'}));
}
function tally(list,fn,wt){const m=new Map();for(const b of list){const k=fn(b);if(k==null)continue;m.set(k,(m.get(k)||0)+(wt?bc(b):1));}return m;}
function barsCard(title,rows){
  const mxv=Math.max(1,...rows.map(r=>r[1]));
  return h('div',{class:'card'},h('h3',{text:title}),rows.map(r=>{
    const i=h('i'); i.style.width=(r[1]/mxv*100)+'%';
    return h('div',{class:'bar'},h('span',{text:r[0]}),h('span',{class:'t'},i),h('span',{class:'n',text:r[1]}));
  }));
}
function renderStats(){
  const all=Store.act().filter(b=>AlkyonRange.inR('log',b)), sel=$('stSpecies').value;
  const bs=sel?all.filter(b=>norm(b.species)===norm(sel)):all;
  const B=$('stBody'); B.replaceChildren();
  if(!all.length){B.append(h('div',{class:'empty',text:'Τα στατιστικά εμφανίζονται μόλις καταγράψεις ψάρια στην καρτέλα «Ψάρια».'}));return;}
  B.append(h('p',{class:'muted',text:bs.length+' τσιμπήματα'+(bs.length<15?'. Λίγα δεδομένα, δες τα ως ένδειξη και όχι ως κανόνα.':'')}));
  const sorted=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]);
  if(!sel){
    const m=tally(bs,b=>(b.species||'').trim()||null,true);
    B.append(barsCard('Ανά είδος',sorted(m).slice(0,10)));
  }
  const first=new Map(); bs.forEach(b=>{const k=norm(b.bait); if(k&&!first.has(k)) first.set(k,b.bait.trim());});
  const bm=tally(bs,b=>norm(b.bait)||'—');
  const baitRows=sorted(bm).slice(0,8).map(([k,v])=>[k==='—'?'Χωρίς καταγραφή':first.get(k),v]);
  B.append(barsCard('Με τι τσίμπησε',baitRows));
  const tm=tally(bs,b=>(b.tech||'').trim()||'—',true);
  B.append(barsCard('Ανά τεχνική',sorted(tm).slice(0,10).map(([k,v])=>[k==='—'?'Χωρίς καταγραφή':k,v])));
  if(window.AlkyonTackle){ const tkm=new Map(), tkt=new Map(), inf=AlkyonTackle.info();
    bs.forEach(b=>{ (b.tk||[]).forEach(id=>{ const x=inf[id]; if(!x) return; if(x.type==='lure'||x.type==='hook'||x.type==='other'){ const g=b.tkw&&b.tkw[id], hk=x.type==='lure'&&b.tkh&&b.tkh[id]&&inf[b.tkh[id]], hs=hk&&b.tks&&b.tks[b.tkh[id]], sz=x.type==='hook'&&b.tks&&b.tks[id]; const key=x.name+(g?' · '+g+' g':'')+(hk?' + '+hk.name.replace(/^\S+\s/,'')+(hs?' '+hs:''):'')+(sz?' · '+sz:''); tkt.set(key,(tkt.get(key)||0)+bc(b)); } else tkm.set(x.name,(tkm.get(x.name)||0)+bc(b)); }); });
    { const sm=new Map(); bs.forEach(b=>setsOf(b).forEach(n=>sm.set(n,(sm.get(n)||0)+bc(b)))); if(sm.size) B.append(barsCard(T2('Ανά σετ (ψάρια)','Per set (fish)'),sorted(sm).slice(0,10))); }
    if(tkt.size) B.append(barsCard('Ανά τερματικό',sorted(tkt).slice(0,10)));
    const kdm=new Map(); bs.forEach(b=>(b.tk||[]).forEach(id=>{ const x=inf[id]; if(x&&x.type==='lure'&&x.kind) kdm.set(x.kind,(kdm.get(x.kind)||0)+bc(b)); }));
    if(kdm.size) B.append(barsCard('Ανά είδος τεχνητού',sorted(kdm).slice(0,10)));
    const kt=(b,f)=>(b.tk||[]).forEach(id=>{ const x=inf[id]; if(x&&(x.type==='lure'||x.type==='hook')) f(x.name); });
    const wm=new Map(); bs.forEach(b=>{ if(b.wave==null) return; const en_=window.LANG==='en', lab=b.wave>=0.6?(en_?'waves ≥0.6 m':'κύμα ≥0.6 m'):(en_?'calm sea':'ήρεμη θάλασσα'); kt(b,n=>wm.set(n+' · '+lab,(wm.get(n+' · '+lab)||0)+bc(b))); });
    if(wm.size) B.append(barsCard('Τερματικό ανά κύμα',sorted(wm).slice(0,10)));
    const tdm=new Map(), part=h=>window.LANG==='en'?(h<9?'morning':h<15?'midday':h<20?'afternoon':'night'):(h<9?'πρωί':h<15?'μεσημέρι':h<20?'απόγευμα':'νύχτα'); bs.forEach(b=>{ const lab=part(parseInt((b.time||'12:00').slice(0,2),10)); kt(b,n=>tdm.set(n+' · '+lab,(tdm.get(n+' · '+lab)||0)+bc(b))); });
    if(tdm.size) B.append(barsCard('Τερματικό ανά ώρα',sorted(tdm).slice(0,10)));
    const lm=new Map(); Store.misses().filter(b=>AlkyonRange.inR('log',b)).forEach(b=>kt(b,n=>lm.set(n,(lm.get(n)||0)+1)));
    if(lm.size) B.append(barsCard('Χαμένα ανά τερματικό',sorted(lm).slice(0,10)));
    if(tkm.size) B.append(barsCard('Ανά εξοπλισμό',sorted(tkm).slice(0,10))); }
  const hm=tally(bs,b=>Math.floor(parseInt((b.time||'12:00').slice(0,2),10)/3));
  B.append(barsCard('Ώρα ημέρας',Array.from({length:8},(_,i)=>[pad(i*3)+'–'+pad((i*3+3)%24),hm.get(i)||0])));
  const mm=tally(bs,b=>biteMoon(b));
  B.append(barsCard('Φάση σελήνης',MOON_LBL.map((l,i)=>[l,mm.get(i)||0])));
  const pm=tally(bs,b=>b.ptrend||null);
  if(pm.size) B.append(barsCard('Τάση πίεσης',Object.keys(PT).map(k=>[PT[k],pm.get(k)||0])));
  const tdl=tally(bs,b=>b.tide||null);
  if(tdl.size) B.append(barsCard('Στάθμη θάλασσας',[['up',window.LANG==='en'?'Rising ↑':'Ανεβαίνει ↑'],['down',window.LANG==='en'?'Falling ↓':'Κατεβαίνει ↓'],['slack',window.LANG==='en'?'Slack →':'Σταθερή →']].map(x=>[x[1],tdl.get(x[0])||0])));
  const wm=tally(bs,b=>b.wind==null?null:bft(b.wind)<=2?0:bft(b.wind)===3?1:bft(b.wind)===4?2:3);
  if(wm.size) B.append(barsCard('Άνεμος',['Bft 0–2','Bft 3','Bft 4','Bft 5+'].map((l,i)=>[l,wm.get(i)||0])));
  { const dm=tally(bs,b=>b.wdeg==null?null:Math.round((((b.wdeg%360)+360)%360)/45)%8);
    const miss=bs.filter(b=>b.wdeg==null&&typeof b.lat==='number').length;
    if(dm.size) B.append(barsCard(window.LANG==='en'?'Wind direction':'Διεύθυνση ανέμου',COMPASS.map((l,i)=>[l,dm.get(i)||0])));
    if(miss&&window.AlkyonHist){ const bb=h('button',{class:'btn ghost sm',type:'button',text:(window.LANG==='en'?'Fill in wind direction for ':'Συμπλήρωσε τη διεύθυνση ανέμου για ')+miss+(window.LANG==='en'?' fish':' ψάρια')});
      const nt=h('p',{class:'note',text:window.LANG==='en'?'Uses the weather model for the time and place of each fish (approximate, about 25 km).':'Από το μοντέλο καιρού για την ώρα και το σημείο κάθε ψαριού (εκτίμηση, περίπου 25 km).'});
      bb.addEventListener('click',()=>backfillWdeg(bb)); B.append(h('div',{class:'card'},bb,nt)); } }
  if(!sel){ try{ lostAnalysis(B,bs); }catch(e){} }
}

/* Συμπλήρωση διεύθυνσης ανέμου σε παλιά ψάρια (μοντέλο Open-Meteo, εκτίμηση) */
async function backfillWdeg(btn){
  const en=window.LANG==='en', list=Store.get('bites').filter(b=>b.wdeg==null&&typeof b.lat==='number'&&typeof b.lon==='number'&&b.date&&b.time);
  if(!list.length||!window.AlkyonHist) return;
  btn.disabled=true; let done=0, ok=0;
  for(const b of list.slice(0,300)){
    btn.textContent=(en?'Working… ':'Επεξεργασία… ')+done+'/'+Math.min(list.length,300);
    try{ const r=await AlkyonHist.fetch(b.lat,b.lon,biteMs(b)); if(r&&r.wdeg!=null){ await Store.save('bites',Object.assign({},b,{wdeg:r.wdeg})); ok++; } }catch(e){}
    done++;
  }
  toast(en?('Wind direction added to '+ok+' fish.'):('Προστέθηκε διεύθυνση ανέμου σε '+ok+' ψάρια.'));
  btn.disabled=false; try{ renderStats(); }catch(e){}
}
/* Ανάλυση: πότε και πού χάνονται ψάρια σε σχέση με όσα πιάνονται */
function lostAnalysis(B,bs){
  const ms=(Store.misses?Store.misses():[]).filter(b=>AlkyonRange.inR('log',b));
  if(!ms.length) return;
  const en=window.LANG==='en', inf=window.AlkyonTackle?AlkyonTackle.info():{};
  const lureNames=b=>(b.tk||[]).map(id=>inf[id]).filter(x=>x&&(x.type==='lure'||x.type==='hook')).map(x=>x.name);
  const lureKinds=b=>(b.tk||[]).map(id=>inf[id]).filter(x=>x&&x.type==='lure'&&x.kind).map(x=>x.kind);
  const hrOf=b=>{ const h0=parseInt((b.time||'').slice(0,2),10); return isNaN(h0)?null:h0; };
  const dims=[
    [T2('Ώρα ημέρας','Time of day'),b=>{ const h0=hrOf(b); if(h0==null) return null; const i=Math.floor(h0/3); return pad(i*3)+'–'+pad((i*3+3)%24); },Array.from({length:8},(_,i)=>pad(i*3)+'–'+pad((i*3+3)%24))],
    [T2('Άνεμος','Wind'),b=>b.wind==null?null:(bft(b.wind)<=2?'Bft 0–2':bft(b.wind)===3?'Bft 3':bft(b.wind)===4?'Bft 4':'Bft 5+'),['Bft 0–2','Bft 3','Bft 4','Bft 5+']],
    [T2('Διεύθυνση ανέμου','Wind direction'),b=>b.wdeg==null?null:COMPASS[Math.round((((b.wdeg%360)+360)%360)/45)%8],COMPASS.slice()],
    [T2('Κύμα','Waves'),b=>b.wave==null?null:(b.wave<0.3?'< 0.3 m':b.wave<0.6?'0.3–0.6 m':b.wave<1?'0.6–1 m':'≥ 1 m'),['< 0.3 m','0.3–0.6 m','0.6–1 m','≥ 1 m']],
    [T2('Τάση πίεσης','Pressure trend'),b=>b.ptrend&&PT[b.ptrend]?PT[b.ptrend]:null,Object.keys(PT).map(k=>PT[k])],
    [T2('Βάθος','Depth'),b=>(b.depth==null||b.depth==='')?null:(b.depth<10?'0–10 m':b.depth<30?'10–30 m':b.depth<60?'30–60 m':'60+ m'),['0–10 m','10–30 m','30–60 m','60+ m']],
    [T2('Δόλωμα','Bait'),b=>norm(b.bait)?b.bait.trim():null,null],
    [T2('Τεχνική','Technique'),b=>(b.tech||'').trim()||null,null],
    [T2('Είδος τεχνητού','Lure type'),lureKinds,null],
    [T2('Σετ','Set'),setsOf,null],
    [T2('Τερματικό','Terminal tackle'),lureNames,null]
  ];
  const wrap=h('div',{class:'card'},h('h3',{text:T2('Χαμένα vs επιτυχίες','Lost vs caught')}));
  const total=bs.length+ms.length;
  wrap.append(h('p',{class:'muted',text:T2('Πόσα τσιμπήματα κατέληξαν σε ψάρι και πόσα χάθηκαν, ανά συνθήκη. Πράσινο = έπιασα, κόκκινο = χάθηκε.','How many bites ended in a fish and how many were lost, per condition. Green = caught, red = lost.')+(total<20?T2(' Λίγα δεδομένα: δες τα ως ένδειξη και όχι ως κανόνα.',' Few data points: treat as a hint, not a rule.'):'')}));
  let shown=0;
  for(const [title,fn,ord] of dims){
    const map=new Map(); const add=(b,k)=>{ const ks=Array.isArray(k)?k:[k]; [...new Set(ks)].forEach(x=>{ if(x==null) return; const r=map.get(x)||[0,0]; r[b.miss?1:0]++; map.set(x,r); }); };
    bs.forEach(b=>add(b,fn(b))); ms.forEach(b=>add(b,fn(b)));
    let rows=[...map.entries()].filter(([k,v])=>v[0]+v[1]>0);
    if(ord) rows=ord.map(k=>[k,map.get(k)]).filter(r=>r[1]); else rows.sort((a,b)=>(b[1][0]+b[1][1])-(a[1][0]+a[1][1])||b[1][1]-a[1][1]);
    rows=rows.slice(0,8);
    if(!rows.length||!rows.some(r=>r[1][1]>0)) continue;
    const mx=Math.max(...rows.map(r=>r[1][0]+r[1][1]));
    wrap.append(h('h4',{text:title,style:'margin:14px 0 4px;font-size:13px'}));
    rows.forEach(([k,v])=>{
      const c=v[0], l=v[1], pct=Math.round(c/(c+l)*100);
      const bar=h('span',{class:'t',style:'display:flex;background:var(--line)'}); 
      const g=h('i',{style:'display:block;height:100%;background:#2e9e5b;width:'+(c/mx*100)+'%'}), r2=h('i',{style:'display:block;height:100%;background:#d8431c;width:'+(l/mx*100)+'%'}); bar.append(g,r2);
      wrap.append(h('div',{class:'bar'},h('span',{text:k}),bar,h('span',{class:'n',text:c+' / '+l+' · '+pct+'%'})));
    });
    shown++;
  }
  if(!shown) return;
  B.append(wrap);
}
$('stSpecies').addEventListener('input',()=>spfSet($('stSpecies').value));
{ const ls=$('logSp'); if(ls) ls.addEventListener('change',()=>spfSet(ls.value)); }
syncSpf();

/* ---------- Live weather and location ---------- */
const COMPASS=window.LANG==='en'?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
const dirName=d=>COMPASS[Math.round((((d%360)+360)%360)/45)%8];
const wdTxt=b=>(b&&b.wdeg!=null&&isFinite(b.wdeg))?' '+dirName(b.wdeg):'';
const wdir=c=>c&&c.windDeg!=null?dirName(c.windDeg):((c&&c.windDir)||'');
const numOrNull=v=>typeof v==='number'&&isFinite(v)?v:null;
function getPosition(){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation){rej(new Error('no geolocation'));return;}
    navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}),rej,{enableHighAccuracy:true,timeout:8000,maximumAge:120000});
  });
}
function nearestRef(lat,lon){
  let best=null; const k=Math.cos(lat*Math.PI/180);
  for(const [n,lo,la] of REFS){const d=Math.hypot((lo-lon)*k*111.32,(la-lat)*110.57); if(!best||d<best.d) best={n:n,d:d};}
  return best&&best.d<40?best.n:null;
}
async function fetchJson(url){
  const ac=new AbortController(), t=setTimeout(()=>ac.abort(),9000);
  try{ const r=await fetch(url,{signal:ac.signal}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}
/* Στάθμη θάλασσας (παλίρροια + μετεωρολογική) από ωριαία δεδομένα Open-Meteo Marine. Στην Κύπρο το εύρος είναι μικρό (περίπου 10–30 cm). */
function tideFrom(mv){
  try{
    const hh=mv&&mv.hourly, tm=hh&&hh.time, lv=hh&&hh.sea_level_height_msl, cur=mv.current&&mv.current.time; if(!tm||!lv||!cur) return null;
    const i=tm.indexOf(cur.slice(0,13)+':00'); if(i<1||i>=tm.length-1) return null;
    const a=lv[i-1], b=lv[i], c=lv[i+1]; if(![a,b,c].every(v=>typeof v==='number')) return null;
    const d=c-a, st=d>0.01?'up':d<-0.01?'down':'slack';
    let nx=null, mn=b, mx=b;
    for(let j=i+1;j<Math.min(tm.length,i+25);j++){ const v=lv[j]; if(typeof v!=='number') break; if(v<mn) mn=v; if(v>mx) mx=v; }
    for(let j=i+1;j<tm.length-1&&j<i+13;j++){ const p=lv[j-1], q=lv[j], r=lv[j+1]; if(![p,q,r].every(v=>typeof v==='number')) break; if(q>p&&q>=r){ nx={type:'high',at:tm[j].slice(11,16)}; break; } if(q<p&&q<=r){ nx={type:'low',at:tm[j].slice(11,16)}; break; } }
    return {st:st,lvl:Math.round(b*100),range:Math.round((mx-mn)*100),next:nx};
  }catch(e){ return null; }
}
async function fetchConditions(lat,lon){
  const q='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4);
  const [w,m]=await Promise.allSettled([
    fetchJson('https://api.open-meteo.com/v1/forecast?'+q+'&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover&hourly=pressure_msl&past_hours=3&forecast_hours=1&wind_speed_unit=kn&timezone=auto'),
    fetchJson('https://marine-api.open-meteo.com/v1/marine?'+q+'&current=wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction&hourly=sea_level_height_msl&past_days=1&forecast_days=2&timezone=auto')
  ]);
  if(w.status!=='fulfilled') throw new Error('weather');
  const c=w.value.current||{}, hp=(w.value.hourly&&w.value.hourly.pressure_msl)||[];
  const press=numOrNull(c.pressure_msl), old=numOrNull(hp[0]);
  let ptrend=null;
  let pd3=null;
  if(press!=null&&old!=null&&hp.length>=3){const d=press-old; pd3=Math.round(d*10)/10; ptrend=d<=-3?'fast':d<=-1?'slow':d>=1?'rise':'stable';}
  const cc=numOrNull(c.cloud_cover), ws=numOrNull(c.wind_speed_10m), wd=numOrNull(c.wind_direction_10m);
  const mc=m.status==='fulfilled'?(m.value.current||{}):{};
  const uo=numOrNull(w.value.utc_offset_seconds);
  const tide=m.status==='fulfilled'?tideFrom(m.value):null;
  return {tide:tide,lat:lat,lon:lon,utc:uo==null?null:Math.round(uo/60),tzn:(typeof w.value.timezone==='string'&&/^[A-Za-z_]+\/[A-Za-z_\/+-]+$/.test(w.value.timezone))?w.value.timezone:null,temp:numOrNull(c.temperature_2m),press:press==null?null:Math.round(press),ptrend:ptrend,pd3:pd3,
    wind:ws==null?null:Math.round(ws),windDir:wd==null?null:dirName(wd),windDeg:wd,
    cur:numOrNull(mc.ocean_current_velocity)==null?null:Math.round(mc.ocean_current_velocity*0.539957*100)/100,curDir:numOrNull(mc.ocean_current_direction),waveDir:numOrNull(mc.wave_direction),
    cloud:cc==null?null:cc<20?'clear':cc<70?'part':'over',
    wave:numOrNull(mc.wave_height),wavePeriod:numOrNull(mc.wave_period),sst:numOrNull(mc.sea_surface_temperature)};
}
function setLive(msg){ $('liveSub').textContent=msg; }
function applyConditions(c){
  if(!c) return;
  if(c.press!=null) $('bPress').value=c.press;
  if(!viewing){ /* αν βλέπεις καιρό άλλης τοποθεσίας, δεν τον αντικαθιστούμε με τον GPS */
  if(c.wind!=null) $('dWind').value=clamp(c.wind,0,40);
  if(c.wave!=null) $('dWave').value=clamp(Math.round(c.wave*10)/10,0,3);
  if(c.cloud) $('dCloud').value=c.cloud;
  if(c.ptrend&&PT[c.ptrend]) $('dPress').value=c.ptrend;
  const near=nearestRef(c.lat,c.lon);
  const parts=condParts(c);
  $('liveMain').textContent=parts.join(' · ');
  setLive('Ενημερώθηκε '+(c.date?c.date.split('-').reverse().join('/')+' ':'')+(c.at||'')+' · θέση '+AlkyonCoord.fmt(c.lat,c.lon)+(near?' · κοντά σε '+near:''));
  }
  setYou(c.lat,c.lon); renderWx(); checkZoneHere(); document.dispatchEvent(new Event('alkyon-cond'));
  renderToday();
}
function tideTxt(t){
  if(!t) return null; const en=window.LANG==='en';
  const ar=t.st==='up'?'↑':t.st==='down'?'↓':'→';
  return (en?'sea level ':'στάθμη ')+ar+(t.next?' '+(t.next.type==='high'?(en?'high ':'υψηλή '):(en?'low ':'χαμηλή '))+t.next.at:'')+(t.range!=null?' ('+(en?'range ':'εύρος ')+t.range+' cm)':'');
}
function condParts(c){
  return [c.wind!=null?PU.wind(c.wind)+(wdir(c)?' '+wdir(c):''):null,c.wave!=null?'κύμα '+PU.wave(c.wave)+(c.wavePeriod?' · '+Math.round(c.wavePeriod)+' s':''):'κύμα μη διαθέσιμο',
    c.temp!=null?PU.temp(c.temp)+(window.LANG==='en'?' air':' αέρας'):null,c.sst!=null?PU.temp(c.sst)+(window.LANG==='en'?' sea':' θάλασσα'):null,c.press!=null?PU.press(c.press)+(c.ptrend?' · '+PT[c.ptrend].toLowerCase():''):null,tideTxt(c.tide)].filter(Boolean);
}
function applyView(c,name){
  if(!c) return; viewCond=c;
  if(c.wind!=null) $('dWind').value=clamp(c.wind,0,40);
  if(c.wave!=null) $('dWave').value=clamp(Math.round(c.wave*10)/10,0,3);
  if(c.cloud) $('dCloud').value=c.cloud;
  if(c.ptrend&&PT[c.ptrend]) $('dPress').value=c.ptrend;
  $('liveMain').textContent=condParts(c).join(' · ');
  setLive((window.LANG==='en'?'Weather for ':'Καιρός για ')+name+' · '+fmt(nicosiaNowMin())+' · '+AlkyonCoord.fmt(c.lat,c.lon));
  renderToday(); document.dispatchEvent(new Event('alkyon-view'));
}
window.AlkyonCore.viewPlace=async function(p){
  if(!p||p.gps){ viewing=null; viewCond=null; await refreshConditions(); renderToday(); document.dispatchEvent(new Event('alkyon-view')); return; }
  viewing=p; viewCond=null; renderToday(); setLive(window.LANG==='en'?'Loading weather…':'Ανανέωση καιρού…');
  try{ const c=await fetchConditions(p.lat,p.lon); if(viewing===p) applyView(c,p.name); }
  catch(e){ setLive(window.LANG==='en'?'Weather did not load. Check your connection.':'Ο καιρός δεν φορτώθηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.'); }
};
window.AlkyonCore.viewRefresh=function(){ if(!viewing) return false; window.AlkyonCore.viewPlace(viewing); return true; };
function renderWx(){
  const el=$('wx'); if(!el) return; el.replaceChildren();
  const sm=sunMoon(nicosiaToday());
  const cell=(l,v)=>h('div',{},h('span',{class:'wl',text:l}),h('b',{text:v}));
  const c=(viewCond||cond)||{};
  const dash='–';
  el.append(h('div',{class:'wxg'},
    cell('Σελήνη',Math.round(sm.illum*100)+'%'),cell('Πίεση',c.press!=null?PU.press(c.press):dash),cell('Αέρας',c.temp!=null?PU.temp(c.temp):dash),
    cell('Θάλασσα',c.sst!=null?PU.temp(c.sst):dash),cell('Άνεμος',c.wind!=null?PU.wind(c.wind)+(wdir(c)?' '+wdir(c):''):dash),cell('Κύμα',c.wave!=null?PU.wave(c.wave):dash)));
}
function refreshConditions(){
  if(refreshing) return refreshing;
  refreshing=(async()=>{
    $('liveRefresh').disabled=true; setLive('Ανανέωση καιρού…');
    try{
      let pos=null; try{ pos=await getPosition(); }catch(e){ if(cond&&cond.lat!=null) pos={lat:cond.lat,lon:cond.lon}; }
      if(!pos){ setLive('Δεν βρέθηκε τοποθεσία. Επίτρεψε την τοποθεσία στον browser και πάτα ανανέωση.'); return cond; }
      const c=await fetchConditions(pos.lat,pos.lon);
      c.at=fmt(nicosiaNowMin()); c.date=nicosiaToday(); cond=c; lsSet('alkyon-cond',c); applyConditions(c); return c;
    }catch(e){
      if(cond&&cond.at){ const when=(cond.date?cond.date.split('-').reverse().join('/')+' ':'')+cond.at; setLive(window.LANG==='en'?'No connection. Showing the last data from '+when+'. Do not rely on it at sea.':'Χωρίς σύνδεση. Εμφανίζονται τα τελευταία δεδομένα από '+when+'. Μην βασίζεσαι σε αυτά στη θάλασσα.'); }
      else setLive('Ο καιρός δεν φορτώθηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.'); return cond;
    }finally{ $('liveRefresh').disabled=false; refreshing=null; }
  })();
  return refreshing;
}
$('liveRefresh').addEventListener('click',()=>{ if(window.AlkyonCore.viewRefresh&&window.AlkyonCore.viewRefresh()) return; refreshConditions(); });

/* ---------- Law (Cyprus) ---------- */
const MIN=window.MIN_SIZES||{};
function minOf(la){ if(!la) return 0; if(MIN[la]) return MIN[la]; const g=la.split(' ')[0]; if(g==='Chelon'||g==='Liza'||g==='Oedalechilus') return MIN['Mugil spp.']||0; return MIN[g+' spp.']||MIN[g+' sp.']||0; }
function lnk(href,text){return h('a',{href:href,target:'_blank',rel:'noopener',text:text});}
function lawCard(title,items,src){
  return h('div',{class:'card'},h('h3',{text:title}),h('ul',{class:'law'},items.map(x=>h('li',{},x))),src?h('div',{class:'note',style:'margin-top:8px'},'Πηγή: ',src):null);
}
function renderLaw(){
  const L=$('g-law'); L.replaceChildren();
  L.append(h('div',{class:'card'},h('p',{text:'Περίληψη για ερασιτεχνικό ψάρεμα από σκάφος στη Δημοκρατία της Κύπρου, ελεγμένη στις 15/10/2026. Δεν αποτελεί νομική συμβουλή. Οι κανονισμοί αλλάζουν και ισχύει πάντα το κείμενο του νόμου και ό,τι ανακοινώνει το Τμήμα Αλιείας και Θαλασσίων Ερευνών (ΤΑΘΕ). Όπου η πηγή είναι δευτερογενής, το γράφει.'})));
  L.append(lawCard('Πώς βγάζω ή ανανεώνω άδεια',[
    'Από στεριά με καλάμι δεν χρειάζεται άδεια. Άδεια χρειάζεται για ψάρεμα με σκάφος, ψαροντούφεκο, δεξαμενές και ψαροπαγίδες.',
    'Αίτηση ηλεκτρονικά, με δύο τρόπους: με CY Login (τα στοιχεία συμπληρώνονται και δεν χρειάζεται αντίγραφο ταυτότητας) ή με τη φόρμα του ΤΑΘΕ (ανεβάζεις αντίγραφο ταυτότητας).',
    'Τέλος άδειας 35 €.',
    'Η φόρμα δέχεται έως 3 σκάφη. Ο έλεγχος γίνεται σε 2 εργάσιμες και ειδοποιείσαι με SMS και email.',
    'Κάθε άδεια λήγει 31 Δεκεμβρίου του έτους έκδοσης. Αν είχες ενεργή άδεια από το 2022, η φόρμα συμπληρώνει τα στοιχεία σου με ταυτότητα/διαβατήριο και ημερομηνία γέννησης.',
    'Υπενθύμιση λήξης: Ρυθμίσεις, «Άδεια και λίστα».',
    'Επικοινωνία ΤΑΘΕ: 22 807 818, 22 807 829, licenses@dfmr.moa.gov.cy.'
  ],['licence.dfmr.moa.gov.cy, ελέγχθηκε 23/10/2026 · ',lnk('https://licence.dfmr.moa.gov.cy/licence-application','Αίτηση με φόρμα'),' · ',lnk('https://cge.cyprus.gov.cy/cylogin/core/login?signin=324f639347ffadbdd621f920d2c6bf09','Αίτηση με CY Login'),' · ',lnk('https://licence.dfmr.moa.gov.cy/','Σελίδα αδειών')]));
  L.append(lawCard('Όρια ποσότητας (ανά έξοδο και ανά 24ωρο)',[
    'Από σκάφος: 10 kg συνολικά και 1 ψάρι οποιουδήποτε βάρους, ανεξάρτητα από τον αριθμό των αδειούχων.',
    'Μακρύπτερος τόνος (Thunnus alalunga) από σκάφος: 3 ψάρια ανά αδειούχο επιβαίνοντα, μέχρι 9 ανά σκάφος. Μαζί με άλλα είδη: 3 μακρύπτερους και 5 kg άλλων ειδών ανά σκάφος.',
    'Ψαροντούφεκο: 5 kg και 1 ψάρι οποιουδήποτε βάρους.',
    'Το ΤΑΘΕ μπορεί να αλλάξει το όριο μόνο για διαγωνισμούς ή τουριστική δραστηριότητα, και μόνο για μακρύπτερο τόνο και λαγοκέφαλο.'
  ],['ΚΔΠ 416/2019, Κανονισμός 17Β(1)(ε) · ',lnk('https://www.cylaw.org/KDP/data/2019_1_416.pdf','κείμενο (cylaw)')]));
  L.append(lawCard('Άδεια και εργαλεία',[
    'Ερασιτεχνική αλιεία με σκάφος απαγορεύεται χωρίς άδεια του ΤΑΘΕ. Η άδεια είναι ατομική και δεν δένεται με συγκεκριμένο σκάφος. Τέλος 35 € (το ίδιο και για ψαροντούφεκο).',
    'Κάθε εργαλείο ή μέθοδος που δεν προβλέπεται από τον νόμο και τους όρους της άδειας απαγορεύεται.',
    'Ψαροπαγίδες: έως 4 στον βυθό, χωρίς σκάφος, εκτός προστατευόμενων περιοχών και περιοχών λουομένων, με ειδική γραπτή άδεια.',
    'Ψαροντούφεκο: άνω των 15 ετών με άδεια (15–17 με συνοδεία ενήλικου κατόχου). Όχι από τη δύση ως την ανατολή του ηλίου, όχι με φωτεινή πηγή, όχι με αναπνευστική συσκευή εκτός των περιοχών του Παραρτήματος VI.',
    'Οι έξοδοι πρέπει να καταγράφονται στην εφαρμογή Cy-FIS του ΤΑΘΕ (δευτερογενής πηγή).'
  ],['ΚΔΠ 416/2019, Κανονισμοί 17, 17Α, 19Α, Παράρτημα IV · ',lnk('https://www.gov.cy/en/service/issue-of-fishing-licence/','gov.cy: άδεια αλιείας'),' · ',lnk('https://cyprus-faq.com/en/south/entertainment/pravila-rybnoi-lovli-na-kipre/','cyprus-faq.com (δευτ.)')]));
  L.append(lawCard('Χειρισμός αλιεύματος',[
    'Απαγορεύεται η πώληση ή εμπορική εκμετάλλευση ερασιτεχνικού αλιεύματος.',
    'Δεν επιτρέπεται να κρατάς ψάρι χωρίς κομμένο το πάνω τμήμα του ουραίου πτερυγίου.',
    'Στο σκάφος επιτρέπεται μόνο εκσπλάχνιση και απολέπιση. Όχι φιλεταρισμός, αποκεφαλισμός ή άλλος καθαρισμός.',
    'Διαγωνισμοί και τουριστική δραστηριότητα απαιτούν γραπτή άδεια.'
  ],['ΚΔΠ 416/2019, Κανονισμός 17Β']));
  const rows=Object.keys(MIN).map(la=>{const c=CYL[la.toLowerCase()]; return [c?c.n:la,la,MIN[la]];}).sort((a,b)=>a[0].localeCompare(b[0],'el'));
  L.append(h('div',{class:'card'},h('h3',{text:'Ελάχιστα μεγέθη (ολικό μήκος)'}),
    h('div',{class:'bar',style:'grid-template-columns:1fr auto;font-weight:600'},h('span',{text:'Είδος'}),h('span',{text:'cm'})),
    rows.map(r=>h('div',{class:'bar',style:'grid-template-columns:1fr auto'},h('span',{},r[0],' ',h('i',{class:'muted',text:r[1]})),h('span',{class:'n',text:String(r[2])}))),
    h('div',{class:'note',style:'margin-top:8px'},'Πηγή: πίνακας ελάχιστων μεγεθών του Τμήματος Αλιείας και Θαλασσίων Ερευνών (gov.cy), ελεγμένος στις 23/10/2026. Τα όρια ισχύουν και για τα είδη του ίδιου γένους (π.χ. κέφαλοι, σαφρίδια, ορφοί). Δεν περιλαμβάνονται ακόμα όλα τα είδη του πίνακα. Για όσα δεν αναγράφονται, ρώτα το ΤΑΘΕ.')));
  L.append(lawCard('Ειδικά είδη (δευτερογενής πηγή, επιβεβαίωσε)',[
    'Κόκκινος τόνος (Thunnus thynnus): απαγορεύεται η αλιεία, η διατήρηση και η εκφόρτωση όλο τον χρόνο. Ελευθέρωση αμέσως.',
    'Μακρύπτερος τόνος: κλειστή περίοδος 1–31 Μαρτίου και 1 Οκτωβρίου–30 Νοεμβρίου, και ως τυχαίο αλίευμα.',
    'Ξιφίας, καρχαρίες και σελάχια: δεν επιτρέπονται ως ερασιτεχνικό αλίευμα. Ελευθέρωση.',
    'Ένας ορφός (ή συναγρίδα) το πολύ ανά έξοδο ή 24ωρο, ανά αλιέα ή σκάφος.',
    'Λαγοκέφαλος (Lagocephalus sceleratus): τοξικός, δεν τρώγεται, δεν δίνεται και δεν πωλείται (ΤΑΘΕ).'
  ],[lnk('https://cyprus-faq.com/en/south/entertainment/pravila-rybnoi-lovli-na-kipre/','cyprus-faq.com'),' · βιβλίο ΤΑΘΕ για τον λαγοκέφαλο']));
  L.append(h('div',{class:'card'},h('h3',{text:'Περιοχές απαγόρευσης ('+ZONES.length+')'}),
    h('p',{class:'note',text:'Τα όρια είναι από το αρχείο «Fishing_restricted_areas» (KMZ) του Cy-FIS και φαίνονται κόκκινα στον χάρτη. Οι ημερομηνίες ισχύος του αρχείου δεν είναι γνωστές και τα διατάγματα αλλάζουν. Πριν ψαρέψεις κοντά σε προστατευόμενη περιοχή, έλεγξε το Cy-FIS και τον νόμο που αναγράφεται.'}),
    ZONES.slice().sort((x,y)=>x.n.localeCompare(y.n,'el')).map(z=>h('div',{class:'item',style:'margin-top:8px'},h('div',{},h('b',{text:z.n}),h('div',{class:'meta',text:z.d})),h('div',{class:'acts'},h('button',{class:'btn ghost sm',type:'button',text:'Χάρτης',onclick:()=>showZone(z)})))),
    h('div',{class:'note',style:'margin-top:8px'},lnk('https://apps.apple.com/app/id1510935028','Cy-FIS (iPhone)'),' · ',lnk('https://play.google.com/store/apps/details?id=cyprus.dfmr.fishing','Cy-FIS (Android)'))));
  L.append(lawCard('Άλλοι περιορισμοί',[
    'Περιοχές λουομένων: όχι ψαροπαγίδες ή δίχτυα.',
    'Έξι θαλάσσιες προστατευόμενες περιοχές με τεχνητούς υφάλους: καμία αλιεία (δευτερογενής πηγή, ελέγξτε με τη λίστα πάνω).',
    'Πόλις–Γιαλιά (Ειδική Ζώνη Διατήρησης CY4000001): από 15 Μαΐου έως 30 Σεπτεμβρίου, από 0 έως 10 μέτρα ισοβαθή, απαγορεύεται η διέλευση και η αγκυροβόληση μηχανοκίνητων σκαφών (εξαιρούνται σκάφη επαγγελματικής παράκτιας αλιείας μικρής κλίμακας). Τα ακριβή όρια της ζώνης δεν είναι στο αρχείο και δεν σχεδιάζονται στον χάρτη.',
    'Απαγορεύεται η είσοδος στα θαλάσσια σπήλαια των Θαλασσινών Σπηλιών Πέγειας και Αγίας Νάπας, του Αγίου Γεωργίου Αλαμάνου και του Χάλαβρου, χωρίς γραπτή άδεια του Διευθυντή.',
    'Απαγορεύεται η παρενόχληση και η σίτιση προστατευόμενων ειδών (κητώδη, θαλάσσιες χελώνες κ.ά.) και η απόρριψη απορριμμάτων στη θάλασσα.',
    'Ποινές: παράβαση διατάγματος απαγόρευσης (π.χ. αλιεία σε προστατευόμενη περιοχή) επισύρει φυλάκιση έως 2 έτη ή πρόστιμο έως €20.000, ή και τα δύο.',
    'Ποινές: παράβαση των Κανονισμών (π.χ. όρια ποσότητας, εργαλεία, άδεια) επισύρει φυλάκιση έως 1 έτος ή πρόστιμο έως €20.000, ή και τα δύο.',
    'Μπορεί να υπάρχουν και άλλοι μόνιμοι ή εποχικοί περιορισμοί που δεν είναι στο αρχείο.'
  ],['ΚΔΠ 139/2026, Κανονισμοί 14Α, 14Β και 15 · Ν. 78(Ι)/2024, άρθρα 5Α(6) και 6(3)']));
  L.append(h('div',{class:'card'},h('h3',{text:'Πηγές'}),h('ul',{class:'law'},
    [['https://www.cylaw.org/KDP/data/2019_1_416.pdf','Κ.Δ.Π. 416/2019, Αλιεία (Τροποποιητικοί) Κανονισμοί'],['https://www.cylaw.org/KDP/data/2024_1_256.pdf','Κ.Δ.Π. 256/2024, Αλιεία (Τροποποιητικοί) Κανονισμοί'],['https://www.gov.cy/en/service/issue-of-fishing-licence/','gov.cy: άδεια ερασιτεχνικής αλιείας'],['https://www.gov.cy/moa-dfmr/en/','Τμήμα Αλιείας και Θαλασσίων Ερευνών']].map(x=>h('li',{},lnk(x[0],x[1]))))));
}
function latinForName(name){
  if(curLatin) return curLatin;
  const n=strip(name).trim(); if(!n) return '';
  const m=DB.find(d=>strip(dispName(d))===n||(d.el&&strip(d.el)===n)||(d.alt&&strip(d.alt).split(' ').join(' ').includes(n)&&n.length>3));
  return m?m.la:'';
}
function updateLaw(){
  const out=$('bLaw'); const msgs=[];
  const lat=latinForName($('bSpecies').value), len=+$('bLen').value||0, mn=lat&&minOf(lat);
  { const nt=$('bMinNote'); if(nt){ const en=window.LANG==='en'; let t='', warn=false;
    if(lat==='Thunnus thynnus'||lat==='Xiphias gladius'){ t=en?'Not allowed to keep (recreational).':'Απαγορεύεται η κράτηση (ερασιτεχνική αλιεία).'; warn=true; }
    else if(mn){ t=(en?'Minimum legal size: ':'Ελάχιστο επιτρεπόμενο μέγεθος: ')+mn+' cm'; if(len&&len<mn){ t='⚠ '+t+(en?' – under the limit, release it.':' – κάτω από το όριο, ελευθέρωσέ το.'); warn=true; } }
    else if(lat){ t=en?'No minimum size on file for this species.':'Δεν υπάρχει καταχωρημένο ελάχιστο όριο για αυτό το είδος.'; }
    nt.textContent=t; nt.hidden=!t; nt.style.color=warn?'#e5533d':''; nt.style.fontWeight=warn?'700':''; } }
  if(mn&&len&&len<mn) msgs.push('⚠ Κάτω από το ελάχιστο μέγεθος ('+mn+' cm). Ελευθέρωσέ το.');
  else if(mn) msgs.push('Ελάχιστο μέγεθος: '+mn+' cm.');
  if(lat==='Thunnus thynnus') msgs.push('⚠ Ο κόκκινος τόνος απαγορεύεται να κρατηθεί. Ελευθέρωσέ τον (δευτερογενής πηγή).');
  if(lat==='Xiphias gladius') msgs.push('⚠ Ο ξιφίας δεν επιτρέπεται ως ερασιτεχνικό αλίευμα (δευτερογενής πηγή).');
  if(lat==='Lagocephalus sceleratus') msgs.push('⚠ Τοξικός. Μην τον φας και μην τον δώσεις.');
  /* v31z375: ψαροντούφεκο. Μόνο ό,τι βρέθηκε σε δημοσιευμένες πηγές· οι λεπτομέρειες πρέπει να ελέγχονται στο ΤΑΘΕ. */
  const spf=(()=>{ try{ return localStorage.getItem('alkyon-fprof')==='spear'; }catch(e){ return false; } })(), en0=window.LANG==='en', spn=strip($('bSpecies').value||'');
  if(/καρχαρ|γαλεο|σκυλοψαρ|σαλαχ|τρυγον|βατοσ|shark|\bray\b|skate|stingray/i.test(spn)) msgs.push(en0?'⚠ Sharks and rays are not allowed as recreational catch: release them (secondary source).':'⚠ Καρχαρίες και σαλάχια δεν επιτρέπονται ως ερασιτεχνικό αλίευμα: ελευθέρωσέ τα (δευτερογενής πηγή).');
  if(lat==='Thunnus alalunga'){ const mo=+(($('bWhen').value||'').slice(5,7)); if(mo===3||mo===10||mo===11) msgs.push('⚠ Πιθανή κλειστή περίοδος μακρύπτερου (1–31 Μαρτίου, 1 Οκτ.–30 Νοεμβρίου). Έλεγξε με το ΤΑΘΕ.'); }
  { const m=$('bLocMode').value; let p=null;
    if(m==='auto'&&cond&&cond.lat!=null) p=[cond.lat,cond.lon];
    else if((m==='pick'||m==='coords')&&pickedPt) p=[pickedPt.lat,pickedPt.lon];
    else if(m==='spot'){ const sp=Store.get('spots').find(x=>x.id===$('bSpot').value); if(sp) p=[sp.lat,sp.lon]; }
    else if(m==='keep'&&editRec&&typeof editRec.lat==='number'){ p=[editRec.lat,editRec.lon]; }
    if(p){ const zz=zonesAt(p[0],p[1]); if(zz.length) msgs.push('⚠ Η θέση είναι μέσα σε περιοχή απαγόρευσης: '+zz.map(zoneText).join(' | ')); } }
  let kg=$('bRel').checked?0:(+$('bKg').value||0); const since=Date.now()-86400000;
  for(const b of Store.get('bites')) if(b.kg&&!b.rel&&!(editRec&&b.id===editRec.id)&&biteMs(b)>=since) kg+=+b.kg;
  if($('bRel').checked) msgs.push('Catch & release: δεν μετράει στο όριο των κιλών.');
  if(kg>0) msgs.push('Καταγεγραμμένα τις τελευταίες 24 ώρες: '+kg.toFixed(1)+' kg. '+(spf?'Το όριο των 10 kg ανά 24 ώρες ισχύει για ψάρεμα από σκάφος· για ψαροντούφεκο έλεγξε το ισχύον όριο με το ΤΑΘΕ.':'Όριο από σκάφος: 10 kg και 1 ψάρι οποιουδήποτε βάρους.'+(kg>10?' ⚠ Πάνω από το όριο, αν τα κρατάς όλα.':'')));
  if(spf) msgs.push('Ψαροντούφεκο: χρειάζεται άδεια σε ισχύ (λήγει 31/12). Όχι μέσα σε περιοχές κολύμβησης (κόκκινες σημαδούρες) και θαλάσσιες προστατευόμενες περιοχές.');
  out.textContent=msgs.join(' ');
}
$('biteForm').addEventListener('input',updateLaw);
/* Το πλήκτρο Enter/«Εντάξει» του πληκτρολογίου δεν υποβάλλει τη φόρμα (πριν αποθήκευε και έκλεινε το φύλλο): κλείνει μόνο το πληκτρολόγιο. */
$('biteForm').addEventListener('keydown',e=>{ const t=e.target; if(e.key==='Enter'&&t&&t.tagName==='INPUT'&&t.type!=='submit'&&t.type!=='button'){ e.preventDefault(); try{ t.blur(); }catch(x){} } });
['bKg','bLen','bDepth','bCnt','bPress'].forEach(id=>{ const n=$(id); if(n) n.setAttribute('enterkeyhint','done'); });

/* ---------- AI fish identification (own API key) ---------- */
const AI_PROMPT='You are helping an angler in Cyprus (eastern Mediterranean). Identify the fish in the photo. Reply with ONLY a JSON array of up to 3 candidates, best first: [{"el":"Greek common name or null","en":"English common name","latin":"Latin name","confidence":0.0-1.0}]. If the photo does not show a fish, reply []. Be honest about uncertainty; do not guess a rare species when a common look-alike fits. Output the JSON array immediately with no explanation, no markdown and no text before or after it.';
async function identifyFish(blob){
  const key=lsGet('alkyon-akey',''); if(!key) throw new Error('nokey');
  const b64=(await blobToDataUrl(blob)).split(',')[1];
  const ac=new AbortController(), tm=setTimeout(()=>ac.abort(),45000);
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ac.signal,
      headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-5-5',max_tokens:4000,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},{type:'text',text:AI_PROMPT}]}]})});
    if(!r.ok){ const e=new Error('http'); e.status=r.status; try{ const jj=await r.json(); e.api=(jj&&jj.error&&jj.error.message)||''; e.apitype=(jj&&jj.error&&jj.error.type)||''; }catch(x){} throw e; }
    const j=await r.json();
    const txt=(j.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
    let arr=null; const m=/\[[\s\S]*\]/.exec(txt);
    if(m){ try{ arr=JSON.parse(m[0]); }catch(e){ arr=null; } }
    if(!arr){ /* κομμένη ή ακατάστατη απάντηση: μαζεύουμε τα ολόκληρα αντικείμενα {...} */
      arr=[]; (txt.match(/\{[^{}]*\}/g)||[]).forEach(o=>{ try{ const x=JSON.parse(o); if(x&&x.latin) arr.push(x); }catch(e){} });
      if(!arr.length){ const e=new Error('parse'); e.stop=j.stop_reason||''; throw e; }
    }
    return Array.isArray(arr)?arr.filter(x=>x&&x.latin).slice(0,3):[];
  } finally { clearTimeout(tm); }
}
$('bAI').addEventListener('click',async()=>{
  const out=$('bAIOut'), msg=$('bAIMsg'), b=$('bAI'); out.replaceChildren(); msg.textContent='';
  if(!photoBlob) return;
  if(!lsGet('alkyon-akey','')){ msg.textContent='Βάλε πρώτα το κλειδί API στο Ημερολόγιο → Αναγνώριση ψαριού με AI.'; return; }
  b.disabled=true; b.textContent='Αναγνώριση…';
  try{
    const res=await identifyFish(photoBlob);
    if(!res.length) msg.textContent='Δεν αναγνωρίστηκε ψάρι στη φωτογραφία.';
    else{
      res.forEach(x=>{
        const row=DB.find(d=>d.la.toLowerCase()===String(x.latin).toLowerCase());
        const name=row?dispName(row):(x.el||x.en||x.latin);
        const pct=typeof x.confidence==='number'?' '+Math.round(x.confidence*100)+'%':'';
        out.append(h('button',{type:'button',class:'chip',text:name+' ('+x.latin+')'+pct,onclick:()=>{$('bSpecies').value=name;curLatin=x.latin;updateLaw();}}));
      });
      msg.textContent='Πρόταση AI, μπορεί να είναι λάθος. Μη βασίζεσαι σε αυτήν για το αν επιτρέπεται ή αν τρώγεται ένα ψάρι.';
    }
  }catch(e){
    { const en=window.LANG==='en', st=e.status, am=(e.api||'').slice(0,160);
      let t;
      if(e.message==='nokey') t=en?'API key missing.':'Λείπει το κλειδί API.';
      else if(st===401) t=en?'The API key was not accepted.':'Το κλειδί API δεν έγινε δεκτό.';
      else if(/credit balance|billing/i.test(am)) t=en?'No credit on the API account. Add credit at console.anthropic.com → Plans & Billing.':'Δεν υπάρχει υπόλοιπο στον λογαριασμό API. Πρόσθεσε πίστωση στο console.anthropic.com → Plans & Billing.';
      else if(st===429||st===402) t=en?'Usage limit or account balance: check console.anthropic.com.':'Όριο χρήσης ή υπόλοιπο λογαριασμού: έλεγξε το console.anthropic.com.';
      else if(st===403) t=en?'The key has no permission for this request.':'Το κλειδί δεν έχει άδεια για αυτό το αίτημα.';
      else if(st===404) t=en?'Model not found for this key.':'Το μοντέλο δεν βρέθηκε για αυτό το κλειδί.';
      else if(st===529||st>=500) t=en?'The AI service is busy. Try again in a minute.':'Η υπηρεσία AI είναι φορτωμένη. Δοκίμασε ξανά σε λίγο.';
      else if(e.name==='AbortError') t=en?'Identification took too long. Try again.':'Η αναγνώριση άργησε. Δοκίμασε ξανά.';
      else if(e.message==='parse') t=en?'The answer could not be read. Try again.':'Δεν διαβάστηκε η απάντηση. Δοκίμασε ξανά.';
      else if(!st) t=en?'Could not reach api.anthropic.com (network, VPN/ad-blocker or browser).':'Δεν έφτασε στο api.anthropic.com (δίκτυο, VPN/adblock ή browser).';
      else t=en?'Identification failed.':'Η αναγνώριση δεν δούλεψε.';
      msg.textContent=t+(st?' ['+st+(am?': '+am:'')+']':(e.name&&e.name!=='Error'?' ['+e.name+']':''));
    }
  }
  b.disabled=false; b.textContent='🔍 Αναγνώριση με AI';
});
$('aiSave').addEventListener('click',()=>{
  const k=$('aiKey').value.trim();
  if(!/^sk-ant-/.test(k)){ $('aiMsg').textContent='Το κλειδί πρέπει να ξεκινά με sk-ant-.'; return; }
  lsSet('alkyon-akey',k); $('aiKey').value=''; $('aiMsg').textContent='Το κλειδί αποθηκεύτηκε σε αυτή τη συσκευή.';
});
$('aiClear').addEventListener('click',()=>{ try{localStorage.removeItem('alkyon-akey');}catch(e){} $('aiMsg').textContent='Το κλειδί διαγράφηκε.'; });
if(lsGet('alkyon-akey','')) $('aiMsg').textContent='Υπάρχει αποθηκευμένο κλειδί.';

/* ---------- CSV ---------- */
function csvDownload(name,head,rows){
  const q=v=>{v=v==null?'':String(v); return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  const txt='\ufeff'+[head].concat(rows).map(r=>r.map(q).join(';')).join('\r\n');
  const a=h('a',{href:URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})),download:name});
  document.body.append(a); a.click(); a.remove();
}
$('csvBites').addEventListener('click',()=>{
  const L=Store.get('bites').filter(b=>AlkyonRange.inR('log',b)).sort((a,b)=>biteMs(a)-biteMs(b));
  csvDownload('alkyon-bites-'+nicosiaToday()+'.csv',(window.LANG==='en'?['Date','Time','Species','Latin','Bait','Technique','Depth m','Count','Weight kg','Length cm','Pressure hPa','Pressure trend','Wind Bft','Wind dir','Wave m','Sea °C','Air °C','Moon','Sea level','Location','Latitude','Longitude','Notes']:['Ημερομηνία','Ώρα','Είδος','Λατινικό','Δόλωμα','Τεχνική','Βάθος m','Πλήθος','Βάρος kg','Μήκος cm','Πίεση hPa','Τάση πίεσης','Άνεμος Bft','Διεύθ. ανέμου','Κύμα m','Θάλασσα °C','Αέρας °C','Σελήνη','Στάθμη','Τοποθεσία','Πλάτος','Μήκος','Σημειώσεις']),
    L.map(b=>[b.date,b.time,b.species,b.latin,b.bait,b.tech,b.depth,bc(b),b.kg,b.len,b.press,b.ptrend?PT[b.ptrend]:'',b.wind==null?'':bft(b.wind),b.wdeg==null?'':dirName(b.wdeg),b.wave,b.sst!=null?Math.round(b.sst*10)/10:'',b.temp!=null?Math.round(b.temp*10)/10:'',MOON_LBL[biteMoon(b)],b.tide==='up'?(window.LANG==='en'?'rising':'ανεβαίνει'):b.tide==='down'?(window.LANG==='en'?'falling':'κατεβαίνει'):b.tide==='slack'?(window.LANG==='en'?'slack':'σταθερή'):'',b.place,b.lat,b.lon,b.notes]));
});
$('csvTrips').addEventListener('click',()=>{
  const L=Store.get('trips').filter(t=>AlkyonRange.inR('log',t)).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  csvDownload('alkyon-trips-'+nicosiaToday()+'.csv',(window.LANG==='en'?['Date','Spot','Technique','Species','Fish','Weight kg','Notes']:['Ημερομηνία','Σημείο','Τεχνική','Είδη','Ψάρια','Βάρος kg','Σημειώσεις']),L.map(t=>{const e=tripEff(t,L);return [t.date,t.spot,t.tech,e.species,e.count,e.kg,t.notes];}));
});

/* ---------- Backup ---------- */
const blobToDataUrl=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b);});
$('expBtn').addEventListener('click',async()=>{
  const btn=$('expBtn'); btn.disabled=true;
  try{
    const bites=Store.raw('bites'), photos={};
    for(const b of bites) for(const k of phKeys(b)){ try{const bl=await Photos.get(k); if(bl) photos[k]=await blobToDataUrl(bl);}catch(e){} }
    for(const tk of Store.raw('tackle')) if(tk.photo){ try{ const bl=await Photos.get('tk-'+tk.id); if(bl) photos['tk-'+tk.id]=await blobToDataUrl(bl); }catch(e){} }
    const data={app:'alkyon',v:2,spots:Store.get('spots'),trips:Store.get('trips'),bites:bites,tackle:Store.raw('tackle'),gear:(window.AlkyonGear?window.AlkyonGear.state().items:[]),boat:(window.AlkyonBoat?window.AlkyonBoat.data():null),photos:photos};
    const a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),download:'alkyon-'+nicosiaToday()+'.json'});
    document.body.append(a); a.click(); a.remove(); try{ window.AlkyonCore.lsSet('alkyon-lastbackup',Date.now()); }catch(e){}
  }catch(e){ $('impMsg').textContent='Η εξαγωγή απέτυχε.'; }
  btn.disabled=false;
});
$('impFile').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    const d=JSON.parse(await f.text()); let n=0;
    for(const k of ['spots','trips','bites','tackle']) for(const it of (Array.isArray(d[k])?d[k]:[])) if(it&&typeof it==='object'){await Store.save(k,it);n++;}
    if(Array.isArray(d.gear)&&window.AlkyonGear) n+=window.AlkyonGear.import(d.gear);
    if(d.boat&&typeof d.boat==='object'&&window.AlkyonBoat){ window.AlkyonBoat.load(d.boat); n++; }
    const ph=d.photos&&typeof d.photos==='object'?d.photos:{};
    for(const id in ph){ try{ const bl=await (await fetch(ph[id])).blob(); await Photos.put(id,bl); }catch(err){} }
    $('impMsg').textContent=n+' εγγραφές εισήχθησαν.'; try{ toast(window.LANG==='en'?'Restored '+n+' records.':'Επαναφέρθηκαν '+n+' εγγραφές.'); }catch(e2){}
  }catch(err){ $('impMsg').textContent='Το αρχείο δεν διαβάστηκε.'; try{ toast(window.LANG==='en'?'The file could not be read.':'Το αρχείο δεν διαβάστηκε.'); }catch(e2){} }
  e.target.value='';
});

/* ---------- Tabs and init ---------- */
(function(){const ls=document.getElementById('langSel'); if(ls){ try{ const t0=ls.parentNode.firstChild; if(t0&&t0.nodeType===3) t0.nodeValue=window.LANG==='en'?'Language':'Γλώσσα / Language'; }catch(e){} ls.value=window.LANG||'el'; ls.addEventListener('change',()=>window.setLang(ls.value)); }})();
function fitMap(){
  const mb=document.querySelector('.mapbox'); if(!mb||mb.offsetParent===null) return;
  const nav=document.querySelector('nav.tabs'), top=mb.getBoundingClientRect().top, nt=nav.getBoundingClientRect().top;
  document.documentElement.style.setProperty('--navh',nav.offsetHeight+'px');
  const hgt=Math.max(300,Math.floor(nt-top-10)); mb.style.height=hgt+'px'; mb.style.minHeight='0';
  if(map) map.invalidateSize();
}
window.fitMap=fitMap;
function switchTab(t2){
  if(t2!=='guide') window.__lastTab=t2;
  const navT=(t2==='today')?'fc':t2;
  document.querySelectorAll('nav.tabs button[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.tab===navT)));
  document.querySelectorAll('.tabseg button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.go===t2)));
  for(const n of ['today','fc','map','log','guide']) $('tab-'+n).hidden=(n!==t2);
  window.scrollTo(0,0);
  document.body.classList.toggle('mapfull',t2==='map');
  if(t2==='map'){ const nv=document.querySelector('nav.tabs'); if(nv) document.documentElement.style.setProperty('--navh',nv.offsetHeight+'px'); if(map) setTimeout(()=>{ map.invalidateSize(); fitMap(); },60); }
}
document.querySelectorAll('nav.tabs button[data-tab]').forEach(b=>b.addEventListener('click',()=>{ if(retTo||focusId){ retTo=null; backOnly=false; const rb=$('reviewBar'); if(rb&&!reviewSet) rb.hidden=true; if(focusId) setFocus(null); } let t=b.dataset.tab; if(t==='fc'&&(!$('tab-today').hidden||!$('tab-fc').hidden)) return; if(t==='fc'&&lsGet('alkyon-wxsub','today')==='today') t='today'; switchTab(t); }));
document.querySelectorAll('.tabseg button').forEach(b=>b.addEventListener('click',()=>{ lsSet('alkyon-wxsub',b.dataset.go); switchTab(b.dataset.go); }));
document.body.classList.toggle('mapfull',!$('tab-map').hidden);
const today=nicosiaToday();
$('dDate').value=today; $('tDate').value=today;
['dDate','dWind','dWave','dPress','dCloud'].forEach(id=>$(id).addEventListener('input',()=>{renderToday();renderReco();}));
{const tg=$('hdrToggle'), mo=$('hdrMore');
  tg.addEventListener('click',()=>{const o=mo.hidden; mo.hidden=!o; tg.setAttribute('aria-expanded',String(o)); tg.textContent=o?'Όλα ▴':'Όλα ▾';});}
initMap();
window.addEventListener('resize',fitMap); window.addEventListener('orientationchange',()=>setTimeout(fitMap,300));
try{ new ResizeObserver(fitMap).observe(document.querySelector('header.top')); new MutationObserver(()=>setTimeout(fitMap,0)).observe(document.querySelector('.wrap').parentNode,{childList:true}); }catch(e){}
/* Ειδοποίηση πτώσης πίεσης όσο η εφαρμογή είναι ανοιχτή σε έξοδο (ενδεικτικό, από μοντέλο Open-Meteo). Ο server στέλνει push/Telegram όταν η εφαρμογή είναι κλειστή. */
const PA={key:'alkyon-pa',cool:3*3600e3,drop:3.0,every:10*60000};
function paShow(drop,now){
  const en=window.LANG==='en', txt=en?('Pressure is falling fast: '+drop.toFixed(1)+' hPa in 3 hours (now '+Math.round(now)+' hPa). Often a sign of changing weather. Check the horizon and the forecast. Indicative, from a forecast model.'):('Η πίεση πέφτει γρήγορα: '+drop.toFixed(1)+' hPa σε 3 ώρες (τώρα '+Math.round(now)+' hPa). Συχνά σημαίνει αλλαγή καιρού. Κοίταξε τον ορίζοντα και την πρόγνωση. Ενδεικτικό, από μοντέλο.');
  let bar=$('paBar'); if(bar) bar.remove();
  bar=h('div',{id:'paBar',role:'alert'},h('span',{style:'flex:1',text:'⚠ '+txt}),h('button',{class:'btn sm ghost',type:'button',style:'color:#fff;border-color:#fff',text:'OK',onclick:()=>bar.remove()}));
  document.body.append(bar);
  try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){}
  try{ if('Notification' in window&&Notification.permission==='granted'&&navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(r=>{ if(r) r.showNotification('Alkyon: '+(en?'pressure falling':'πτώση πίεσης'),{body:txt,tag:'alkyon-pa'}); }).catch(()=>{}); }catch(e){}
}
async function paCheck(){
  try{
    if(!document.body.classList.contains('ontrip')||document.hidden) return;
    if(Date.now()-(+lsGet(PA.key,0)||0)<PA.cool) return;
    const fx=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix(), la=fx?fx.lat:(cond&&cond.lat), lo=fx?fx.lon:(cond&&cond.lon);
    if(la==null||lo==null) return;
    const j=await fetchJson('https://api.open-meteo.com/v1/forecast?latitude='+(+la).toFixed(3)+'&longitude='+(+lo).toFixed(3)+'&hourly=pressure_msl&past_hours=4&forecast_hours=1&timezone=UTC');
    const ts=(j.hourly&&j.hourly.time)||[], ps=(j.hourly&&j.hourly.pressure_msl)||[]; let i=-1;
    for(let k=0;k<ts.length;k++) if(Date.parse(ts[k]+'Z')<=Date.now()&&typeof ps[k]==='number') i=k;
    if(i<3||typeof ps[i-3]!=='number') return;
    const drop=ps[i]-ps[i-3];
    if(drop<=-PA.drop){ lsSet(PA.key,Date.now()); paShow(drop,ps[i]); }
  }catch(e){}
}
window.paCheck=paCheck;
setInterval(paCheck,PA.every); setTimeout(paCheck,20000);
window.addEventListener('alkyon-sess',()=>setTimeout(paCheck,3000));
/* v31z357: στην έναρξη εξόδου, μία ειδοποίηση με την εικόνα της πίεσης: ανεβαίνει/πέφτει/σταθερή και πότε αναμένεται η επόμενη κορυφή ή κοιλάδα (μοντέλο Open-Meteo, όχι μέτρηση). */
async function tripPressBrief(){
  try{
    const st=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); if(!st||!st.active||!st.id) return;
    if(lsGet('alkyon-tpb','')===st.id) return;
    if(Date.now()-(+lsGet('alkyon-tpb-at',0)||0)<20*60000){ lsSet('alkyon-tpb',st.id); return; } /* v31z360: όχι δεύτερη φορά αν τερμάτισες και ξεκίνησες ξανά σε λίγα λεπτά */
    if(st.start&&Date.now()-st.start>30*60000) { lsSet('alkyon-tpb',st.id); return; } /* μόνο στην αρχή της εξόδου */
    const PFx=window.PF; if(!PFx||!PFx.getForecast||!PFx.pressureOutlook) return;
    const fx=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix(), la=fx?fx.lat:(cond&&cond.lat), lo=fx?fx.lon:(cond&&cond.lon);
    if(la==null||lo==null) return;
    const fc=await PFx.getForecast(+la,+lo,undefined,{days:2}), o=PFx.pressureOutlook(fc); if(!o) return;
    lsSet('alkyon-tpb',st.id); lsSet('alkyon-tpb-at',Date.now());
    const en=window.LANG==='en', T2=(a,b)=>en?b:a, num=v=>String(Math.round(v*10)/10).replace('.',en?'.':','), sg=v=>(v>0?'+':v<0?'−':'±')+num(Math.abs(v));
    /* επόμενες 3 ώρες από την πρόγνωση */
    const hs=[]; fc.days.forEach(d=>d.hours.forEach(x=>{ if(x.p!=null) hs.push(x); })); hs.sort((a,b)=>a.t<b.t?-1:1);
    const now=fc.nowLocal.slice(0,13); let n0=-1; hs.forEach((x,i)=>{ if(x.t.slice(0,13)<=now) n0=i; });
    const f3=n0>=0&&hs[n0+3]?hs[n0+3].p-hs[n0].p:null;
    const rising=(o.d3!=null&&o.d3>=0.5)||(f3!=null&&f3>=0.5&&!(o.d3!=null&&o.d3<=-0.5)), falling=!rising&&((o.d3!=null&&o.d3<=-0.5)||(f3!=null&&f3<=-0.5));
    const hhOf=t=>t.slice(11,16), dayOf=t=>t.slice(0,10)===fc.nowLocal.slice(0,10)?'':T2('αύριο ','tomorrow ');
    let head=rising?T2('📈 Η πίεση ανεβαίνει','📈 Pressure is rising'):falling?T2('📉 Η πίεση πέφτει','📉 Pressure is falling'):T2('➖ Η πίεση είναι σταθερή','➖ Pressure is steady');
    const parts=[T2('Τώρα ','Now ')+num(o.now)+' hPa'];
    if(o.d3!=null) parts.push(T2('τελευταίες 3 ώρες ','last 3 h ')+sg(o.d3)+' hPa');
    if(f3!=null) parts.push(T2('επόμενες 3 ώρες ','next 3 h ')+sg(f3)+' hPa');
    let line2='';
    if(o.last&&rising&&o.last.kind==='trough') line2+=T2('Η άνοδος ξεκίνησε μετά την κοιλάδα των ','The rise began after the low of ')+num(o.last.p)+T2(' hPa στις ',' hPa at ')+hhOf(o.last.t)+'. ';
    if(o.last&&falling&&o.last.kind==='peak') line2+=T2('Η πτώση ξεκίνησε μετά την κορυφή των ','The fall began after the peak of ')+num(o.last.p)+T2(' hPa στις ',' hPa at ')+hhOf(o.last.t)+'. ';
    if(o.next) line2+=(o.next.kind==='peak'?T2('Αναμένεται κορυφή ','Peak expected ')+num(o.next.p)+T2(' hPa ',' hPa '):T2('Αναμένεται κοιλάδα ','Low expected ')+num(o.next.p)+T2(' hPa ',' hPa '))+dayOf(o.next.t)+T2('γύρω στις ','around ')+hhOf(o.next.t)+T2(' (σε ~',' (in ~')+o.next.hours+T2(' ώρ.)',' h)')+(o.next.kind==='peak'?T2(', μετά αρχίζει να πέφτει.',', then it starts falling.'):T2(', μετά αρχίζει να ανεβαίνει.',', then it starts rising.'));
    else line2+=T2('Δεν φαίνεται καμπή στις επόμενες ώρες της πρόγνωσης.','No turning point in the coming forecast hours.');
    const body=parts.join(' · ')+'. '+line2, full=body+T2(' Πρόγνωση μοντέλου (Open-Meteo), όχι μέτρηση.',' Model forecast (Open-Meteo), not a measurement.');
    toast(head+'. '+line2);
    if('Notification' in window&&Notification.permission==='granted'&&navigator.serviceWorker){ const r=await navigator.serviceWorker.getRegistration(); if(r) r.showNotification(head+T2(' · έναρξη εξόδου',' · trip start'),{body,tag:'alk-tpb-'+st.id,data:{bc:{id:'tpb-'+st.id,kind:'turn',full,place:{name:T2('Έξοδος','Trip'),lat:+la,lon:+lo},t:fc.nowLocal}}}); }
  }catch(e){}
}
window.addEventListener('alkyon-sess',()=>setTimeout(tripPressBrief,2500)); setTimeout(tripPressBrief,6000);
/* v31z366: ο γενικός βαθμός που έδινε η εφαρμογή για κάθε ώρα, κρατημένος στην αρχή της εξόδου (scoreH=[[ώρα UTC/3600000, βαθμός]]).
   Μετά συγκρίνεται με τα τσιμπήματα ανά ώρα ψαρέματος (PP.calib), για να φαίνεται αν ο βαθμός βοηθά πραγματικά. */
async function tripScoreSnap(){
  try{
    const st=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); if(!st||!st.active||!st.id) return;
    const cur=lsGet('alkyon-tscore',null); if(cur&&cur.id===st.id) return;
    const fx=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix(), la=fx?fx.lat:(cond&&cond.lat), lo=fx?fx.lon:(cond&&cond.lon); if(la==null||lo==null||!window.PF) return;
    const fc=await window.PF.getForecast(+la,+lo,undefined,{days:2}), out=[];
    fc.days.forEach(d=>d.hours.forEach(x=>{ const hu=Math.floor((Date.parse(x.t+':00Z')-fc.tz*60000)/3600000); if(x.score!=null) out.push([hu,x.score]); }));
    lsSet('alkyon-tscore',{id:st.id,h:out,sp:lsGet('alkyon-advsp','')||''});
  }catch(e){}
}
window.addEventListener('alkyon-sess',()=>setTimeout(tripScoreSnap,4000)); setTimeout(tripScoreSnap,8000);
window.addEventListener('alkyon-tripend',e=>{ setTimeout(()=>{ try{ const id=e.detail&&e.detail.id, t=id&&Store.get('trips').find(x=>x.id===id), sc=lsGet('alkyon-tscore',null);
  if(t&&sc&&Array.isArray(sc.h)&&(t.sid===sc.id||!t.sid)){ const lo=Math.floor(t.startMs/3600000), hi=Math.floor(t.endMs/3600000); const h=sc.h.filter(r=>r[0]>=lo&&r[0]<=hi);
    if(h.length) Store.save('trips',Object.assign({},t,{scoreH:h,scoreSp:sc.sp||undefined})); lsSet('alkyon-tscore',null); } }catch(x){} },2500); });
/* v31z366: βάθος από τον χάρτη (EMODnet) σε κάθε ψάρι ή χαμένο τσίμπημα με θέση και χωρίς βάθος. Στο παρασκήνιο, λίγα κάθε φορά. depthSrc:'chart' = από χάρτη, όχι από βυθόμετρο. */
let depthBusy=false, depthTm=null; const depthTried=new Set(); /* χωρίς απάντηση: ξαναδοκιμάζει σε επόμενο άνοιγμα, όχι αμέσως */
async function fillDepths(){
  if(depthBusy||!navigator.onLine) return; depthBusy=true;
  try{ const list=(Store.raw?Store.raw('bites'):Store.get('bites')).filter(b=>typeof b.lat==='number'&&typeof b.lon==='number'&&(b.depth==null||b.depth==='')&&!depthTried.has(b.id)).slice(0,12);
    for(const b of list){ let d=null; try{ d=await depthLookup(b.lat,b.lon); }catch(e){}
      const cur=(Store.raw?Store.raw('bites'):Store.get('bites')).find(x=>x.id===b.id); if(!cur||(cur.depth!=null&&cur.depth!=='')) continue;
      depthTried.add(b.id); if(d!=null&&d>0) await Store.save('bites',Object.assign({},cur,{depth:d,depthSrc:'chart'})); await new Promise(r=>setTimeout(r,1200)); } }
  catch(e){} finally{ depthBusy=false; }
}
setTimeout(fillDepths,25000); Store.on('bites',()=>{ clearTimeout(depthTm); depthTm=setTimeout(fillDepths,8000); });
/* v31z364: πίεση και άνεμος ώρα με ώρα για κάθε έξοδο (Open-Meteo, για τη θέση και το διάστημα της εξόδου), ώστε το προσωπικό μοντέλο
   να μετρά τις ώρες ψαρέματος με τις πραγματικές συνθήκες κάθε ώρας και όχι μόνο της αρχής. Αποθηκεύεται στην έξοδο ως condH=[[ώρα UTC/3600000, τάση 0–3, άνεμος kn]].
   Τάση πίεσης όπως παντού: αλλαγή 3 ωρών, ≤−3 απότομη πτώση, ≤−1 αργή πτώση, ≥+1 άνοδος, αλλιώς σταθερή. Μόνο για εξόδους των τελευταίων ~85 ημερών (όριο του Open-Meteo). */
async function tripCondH(t){
  if(!t||!t.startMs||!t.endMs||t.manual||Array.isArray(t.condH)) return false;
  if(Date.now()-t.endMs>85*86400000||t.endMs-t.startMs>16*3600000) return false;
  const la=t.lat!=null?t.lat:(t.cond0&&t.cond0.lat), lo=t.lon!=null?t.lon:(t.cond0&&t.cond0.lon); if(la==null||lo==null) return false;
  const d0=new Date(t.startMs-4*3600000).toISOString().slice(0,10), d1=new Date(t.endMs).toISOString().slice(0,10);
  const j=await fetchJson('https://api.open-meteo.com/v1/forecast?latitude='+(+la).toFixed(3)+'&longitude='+(+lo).toFixed(3)+'&hourly=pressure_msl,wind_speed_10m&wind_speed_unit=kn&timezone=UTC&start_date='+d0+'&end_date='+d1);
  const ts=(j.hourly&&j.hourly.time)||[], ps=j.hourly.pressure_msl||[], ws=j.hourly.wind_speed_10m||[], byH={};
  ts.forEach((x,i)=>{ byH[Math.floor(Date.parse(x+'Z')/3600000)]={p:ps[i],w:ws[i]}; });
  const out=[], PT=['fast','slow','stable','rise'];
  for(let hh=Math.floor(t.startMs/3600000);hh<=Math.floor((t.endMs-1)/3600000);hh++){ const a=byH[hh], b=byH[hh-3]; if(!a||typeof a.p!=='number') continue;
    const d=b&&typeof b.p==='number'?a.p-b.p:null, pt=d==null?2:d<=-3?0:d<=-1?1:d>=1?3:2; out.push([hh,pt,typeof a.w==='number'?Math.round(a.w*10)/10:null]); }
  if(!out.length) return false;
  const cur=Store.get('trips').find(x=>x.id===t.id); if(!cur) return false;
  await Store.save('trips',Object.assign({},cur,{condH:out})); return true;
}
window.addEventListener('alkyon-tripend',e=>{ setTimeout(()=>{ const id=e.detail&&e.detail.id, t=id&&Store.get('trips').find(x=>x.id===id); if(t) tripCondH(t).catch(()=>{}); },5000); });
/* παλιότερες έξοδοι χωρίς condH: συμπλήρωση στο παρασκήνιο, λίγες κάθε φορά */
setTimeout(async()=>{ try{ const list=(Store.get('trips')||[]).filter(t=>t.startMs&&t.endMs&&!t.manual&&!Array.isArray(t.condH)&&Date.now()-t.endMs<85*86400000).slice(0,8);
  for(const t of list){ try{ await tripCondH(t); }catch(e){} await new Promise(r=>setTimeout(r,1500)); } }catch(e){} },20000);
/* v31z363: λίγα λεπτά μετά την έναρξη εξόδου, αν το σημείο ψαρεύτηκε τις 2 από τις 3 τελευταίες μέρες, μια υπενθύμιση για ξεκούραση σημείου (μία φορά ανά έξοδο) */
function tripRestCheck(){
  try{ const st=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); if(!st||!st.active||!st.id||lsGet('alkyon-rest-trip','')===st.id) return;
    const fx=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix(); if(!fx) return;
    lsSet('alkyon-rest-trip',st.id); const ds=restDays(fx.lat,fx.lon), en=window.LANG==='en'; if(ds.length<2) return;
    const alt=restAlt(fx.lat,fx.lon);
    toast((en?'🔁 You fished this area on '+ds.length+' of the last 3 days. A rested spot may bite better':'🔁 Ψάρεψες σε αυτή την περιοχή '+ds.length+' από τις 3 τελευταίες μέρες. Ένα ξεκούραστο σημείο ίσως δώσει περισσότερα')+(alt?(en?': ':': ')+alt.name+' ('+(alt.d<10?alt.d.toFixed(1):Math.round(alt.d))+' km).':'.'));
  }catch(e){}
}
window.addEventListener('alkyon-sess',()=>setTimeout(tripRestCheck,4*60000)); setInterval(tripRestCheck,5*60000);
setTimeout(fitMap,100); setTimeout(fitMap,1500);
renderToday(); renderSpecies(); renderTech(); renderChecks(); renderLaw(); renderSpots(); renderTrips(); renderWx();
Store.on('spots',()=>{drawMap();renderSpots();});
Store.on('trips',renderTrips);
window.addEventListener('alkyon-tackle-ready',()=>{ try{ renderBites(); }catch(e){} });
Store.on('tackle',()=>{ try{ renderBites(); }catch(e){} });
Store.on('bites',()=>{renderBites();renderStats();renderTrips();});
window.addEventListener('alkyon-range',e=>{ if(e.detail&&e.detail.key==='log'){ renderBites();renderStats();renderTrips(); } });
AlkyonRange.ui('log',$('logRange'),true);
/* η περίοδος δεν ισχύει στην Κοινότητα: κρύβεται εκεί */
/* η μπάρα περιόδου μπαίνει ακριβώς πάνω από την ταξινόμηση (Έξοδοι/Τσιμπήματα) ή στην κορυφή (Στατιστικά/Εργαλεία) */
function placeRange(l){
  const r=$('logRange'); if(!r) return; r.hidden=(l==='comm');
  const sel=l==='trips'?document.querySelector('#l-trips .sortsel'):l==='bites'?document.querySelector('#l-bites .sortsel'):null;
  if(sel&&sel.parentNode) sel.parentNode.insertBefore(r,sel);
  else { const t=$('l-trips'); if(t&&t.parentNode&&r.nextElementSibling!==t) t.parentNode.insertBefore(r,t); }
}
{ const seg=$('logSeg'); if(seg){ seg.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('button'); if(b) setTimeout(()=>placeRange(b.dataset.l),0); }); placeRange('trips'); } }
window.addEventListener('alkyon-sess',()=>{try{renderTrips();}catch(e){}});
/* Βάθος από τον χάρτη βαθών EMODnet (καλύπτει και την Κύπρο). Ό,τι αποτύχει αφήνει το πεδίο όπως ήταν. */
async function emodDepth(lat,lon){
  const to=ms=>{ try{ return AbortSignal.timeout(ms); }catch(e){ return undefined; } };
  const num=v=>{ v=+v; return isFinite(v)?v:null; };
  try{
    const r=await fetch('https://rest.emodnet-bathymetry.eu/depth_sample?geom='+encodeURIComponent('POINT('+lon.toFixed(5)+' '+lat.toFixed(5)+')'),{signal:to(9000)});
    if(r.ok){ let j=await r.json(); if(Array.isArray(j)) j=j[0]; const v=j&&num(j.avg!=null?j.avg:(j.depth!=null?j.depth:j.value)); if(v!=null&&v>0) return Math.round(v); } /* η υπηρεσία depth_sample δίνει θετικό βάθος σε μέτρα (δοκιμή: 254 m στη θάλασσα νότια της Κύπρου) */
  }catch(e){}
  try{
    const d=0.004, q='SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=emodnet:mean&QUERY_LAYERS=emodnet:mean&STYLES=&INFO_FORMAT='+encodeURIComponent('application/json')+'&CRS=EPSG:4326&BBOX='+[lat-d,lon-d,lat+d,lon+d].join(',')+'&WIDTH=101&HEIGHT=101&I=50&J=50';
    const r=await fetch('https://ows.emodnet-bathymetry.eu/wms?'+q,{signal:to(9000)});
    if(r.ok){ const j=await r.json(); const p=j&&j.features&&j.features[0]&&j.features[0].properties; if(p){ for(const k in p){ const v=num(p[k]); if(v!=null&&v<0) return Math.round(-v); } } }
  }catch(e){}
  return null;
}
const depthCache=new Map();
function depthLookup(lat,lon){
  const k=lat.toFixed(4)+','+lon.toFixed(4);
  if(depthCache.has(k)) return Promise.resolve(depthCache.get(k));
  return emodDepth(lat,lon).then(d=>{ if(d!=null) depthCache.set(k,d); return d; }).catch(()=>null);
}
async function biteLL(){
  const mode=$('bLocMode').value;
  if(mode==='spot'){ const sp=Store.get('spots').find(x=>x.id===$('bSpot').value); if(sp) return {lat:sp.lat,lon:sp.lon}; }
  if(mode==='pick'&&pickedPt) return pickedPt;
  if(mode==='coords'){ try{ const q=AlkyonCoord.get($('bLat'),$('bLon')); if(q) return q; }catch(e){} if(pickedPt) return pickedPt; }
  if(mode==='keep'&&editRec&&typeof editRec.lat==='number') return {lat:editRec.lat,lon:editRec.lon};
  if(mode==='auto'){ let c=cond; if(!c||c.lat==null){ try{ c=await refreshConditions(); }catch(e){} } if(c&&c.lat!=null) return {lat:c.lat,lon:c.lon}; }
  return null;
}
async function autoDepth(silent){
  const inp=document.querySelector('input#bDepth'), en=window.LANG==='en', b=$('bDepthAuto'); if(!inp) return;
  if(b){ b.disabled=true; }
  try{
    const ll=await biteLL(); if(!ll){ if(!silent) toast(en?'No location yet.':'Δεν υπάρχει ακόμα θέση.'); return; }
    const d=await emodDepth(ll.lat,ll.lon);
    if(d&&d>0){ if(!silent||inp.value===''){ inp.value=d; inp.dispatchEvent(new Event('input',{bubbles:true})); if(!silent) toast((en?'Depth from chart: ':'Βάθος από χάρτη: ')+d+' m'); } }
    else if(!silent) toast(en?'No depth found for this spot.':'Δεν βρέθηκε βάθος για αυτό το σημείο.');
  } finally { if(b) b.disabled=false; }
}
(function(){ const inp=document.querySelector('input#bDepth'); if(!inp||$('bDepthAuto')) return;
  const lab=inp.closest('label'), b=h('button',{class:'btn ghost sm',type:'button',id:'bDepthAuto',text:window.LANG==='en'?'📍 Depth from chart':'📍 Βάθος από χάρτη'});
  b.style.margin='6px 0'; b.addEventListener('click',()=>autoDepth(false));
  lab.parentNode.insertBefore(b,lab.nextSibling);
  window.addEventListener('alkyon-needdepth',()=>{ if(inp.value==='') autoDepth(true); });
  /* v31z370: το βάθος συμπληρώνεται μόνο του όταν ανοίγει η φόρμα ψαριού (το κουμπί δεν χρειάζεται πια) */
  b.hidden=true;
  const sh=$('sheet'); if(sh) new MutationObserver(()=>{ if(!sh.hidden&&inp.value==='') setTimeout(()=>{ if(inp.value==='') autoDepth(true); },400); }).observe(sh,{attributes:true,attributeFilter:['hidden']});
})();

window.addEventListener('alkyon-fprof',()=>{ try{ renderToday(); }catch(e){} });
Object.assign(window.AlkyonCore,{tripEff:tripEff,fmtDur:fmtDur,resizeImage:resizeImage,biteMs:biteMs,quick:()=>quickRec(false),quickMiss:()=>quickRec(true),map:()=>map,h:h,$:$,fmt:fmt,pad:pad,nicosiaToday:nicosiaToday,nicosiaNowMin:nicosiaNowMin,getPosition:getPosition,getCond:()=>cond,depthAt:(la,lo)=>depthLookup(la,lo),getViewCond:()=>viewCond||cond,compute:()=>compute(),showOnMap:showOnMap,lsGet:lsGet,lsSet:lsSet,switchTab:switchTab,utcMin:()=>utcOff()});
Store.init();
if(cond){ applyConditions(cond); } else { $('liveMain').textContent='Δεν υπάρχουν δεδομένα καιρού ακόμα.'; }
refreshConditions();
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&(!cond||cond.date!==nicosiaToday()||Math.abs(nicosiaNowMin()-(parseInt((cond.at||'00:00').slice(0,2),10)*60+parseInt((cond.at||'00:00').slice(3,5),10)))>10)) refreshConditions();
});
setInterval(()=>{ if(document.visibilityState==='visible'&&navigator.onLine!==false) refreshConditions(); },10*60*1000);
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
Object.assign(window.AlkyonCore,{dropBack:dropBack,openSpotForm:(p,sp)=>openSpotForm(p||{},sp),tripStamp:tripStamp,utcOff:utcOff,matchSp:matchSp,dispName:dispName,shownName:shownName,openRodSheet:()=>openSheet(),reviewTrip:reviewTrip,endReview:endReview,speciesDB:()=>DB,pickSpecies:sp=>{ $('bSpecies').value=shownName(sp); curLatin=sp.la; try{updateLaw();}catch(e){} $('bSpecies').dispatchEvent(new Event('change',{bubbles:true})); }});
})();
