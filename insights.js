/* Αναλύσεις και αρχείο: σελήνη/ήλιος και solunar, «Μοιάζει με τις καλύτερες μέρες σου», σημειώσεις σημείου,
   συντήρηση σκάφους, κόστος ανά κιλό ανά σεζόν, εξαγωγή CSV/JSON.
   Τα solunar είναι παραδοσιακός δείκτης, όχι αποδεδειγμένος. Οι ώρες σελήνης/ήλιου είναι προσεγγίσεις (±5 λεπτά). */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var $=function(i){ return document.getElementById(i); };
var R=Math.PI/180;
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function btn(t,cls,fn){ var b=el('button','spb '+(cls||''),t); b.type='button'; b.addEventListener('click',fn); return b; }
function money(v){ return '€'+(Math.round(v*100)/100).toFixed(v%1?2:0); }
function distM(a,b,c,d){ var dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742000*Math.asin(Math.min(1,Math.sqrt(x))); }
function bites(){ return (C.Store.act?C.Store.act():C.Store.get('bites'))||[]; }
function trips(){ return C.Store.get('trips')||[]; }
function spots(){ return C.Store.get('spots')||[]; }
var fcLoc=null;
function loc(){ if(fcLoc) return fcLoc; var c=C.getCond&&C.getCond(); if(c&&c.lat!=null) return {lat:c.lat,lon:c.lon}; return {lat:34.75,lon:32.42}; }

/* ---------- αστρονομία (χαμηλής ακρίβειας) ---------- */
function jd(ms){ return ms/86400000+2440587.5; }
function sunPos(d){ var M=(357.529+0.98560028*d)*R, Cc=1.9148*Math.sin(M)+0.02*Math.sin(2*M), lam=(M/R+Cc+180+102.9372)*R, e=(23.4393-3.6e-7*d)*R;
  return {ra:Math.atan2(Math.sin(lam)*Math.cos(e),Math.cos(lam)),dec:Math.asin(Math.sin(e)*Math.sin(lam)),lam:lam}; }
function moonPos(d){ var T0=d/36525;
  var L=218.32+481267.881*T0+6.29*Math.sin((135.0+477198.87*T0)*R)-1.27*Math.sin((259.3-413335.36*T0)*R)+0.66*Math.sin((235.7+890534.22*T0)*R)+0.21*Math.sin((269.9+954397.74*T0)*R)-0.19*Math.sin((357.5+35999.05*T0)*R)-0.11*Math.sin((186.5+966404.03*T0)*R);
  var B=5.13*Math.sin((93.3+483202.02*T0)*R)+0.28*Math.sin((228.2+960400.89*T0)*R)-0.28*Math.sin((318.3+6003.15*T0)*R)-0.17*Math.sin((217.6-407332.21*T0)*R);
  var lam=L*R, b=B*R, e=(23.4393-3.6e-7*d)*R;
  return {ra:Math.atan2(Math.sin(lam)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(lam)),dec:Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(lam)),lam:lam}; }
function alt(pos,d,lat,lon){ var gm=(280.46061837+360.98564736629*d)*R, H=gm+lon*R-pos.ra; return Math.asin(Math.sin(lat*R)*Math.sin(pos.dec)+Math.cos(lat*R)*Math.cos(pos.dec)*Math.cos(H))/R; }
function phaseAt(ms){ var d=jd(ms)-2451545, ml=moonPos(d).lam, sl=sunPos(d).lam, el0=((ml-sl)/R%360+360)%360;
  return {ang:el0,illum:(1-Math.cos(el0*R))/2,idx:Math.round(el0/45)%8}; }
var EMO=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
var PHN=T(['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα κυρτή','Πανσέληνος','Φθίνουσα κυρτή','Τελευταίο τέταρτο','Φθίνων μηνίσκος'],['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent']);
function nicOff(ms){ try{ var f=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Nicosia',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(ms)), o={}; f.forEach(function(p){ o[p.type]=+p.value; });
  return Date.UTC(o.year,o.month-1,o.day,o.hour,o.minute,o.second)-Math.floor(ms/1000)*1000; }catch(e){ return 2*3600000; } }
function dayStart(dateStr){ var u=Date.parse(dateStr+'T00:00:00Z'); return u-nicOff(u-2*3600000); }
function hhmm(ms){ var t=new Date(ms+nicOff(ms)); return ('0'+t.getUTCHours()).slice(-2)+':'+('0'+t.getUTCMinutes()).slice(-2); }
function addDays(s,n){ return new Date(Date.parse(s+'T12:00:00Z')+n*86400000).toISOString().slice(0,10); }
/* ανατολή, δύση, μεσουράνημα ενός σώματος για μία ημέρα */
function events(which,ms0,lat,lon){
  var h0=which==='sun'?-0.833:0.125, step=10*60000, prev=null, out={rise:null,set:null,transit:null,under:null}, best=-99, worst=99;
  for(var t=ms0;t<=ms0+86400000+step;t+=step){ var d=jd(t)-2451545, a=alt(which==='sun'?sunPos(d):moonPos(d),d,lat,lon)-h0;
    if(prev){ if(prev.a<0&&a>=0&&!out.rise&&t-step<ms0+86400000) out.rise=prev.t+(t-prev.t)*(-prev.a)/(a-prev.a); if(prev.a>0&&a<=0&&!out.set&&t-step<ms0+86400000) out.set=prev.t+(t-prev.t)*prev.a/(prev.a-a); }
    if(t<ms0+86400000){ if(a>best){ best=a; out.transit=t; } if(a<worst){ worst=a; out.under=t; } }
    prev={t:t,a:a}; }
  return out;
}
function dayInfo(dateStr){
  var p=loc(), ms0=dayStart(dateStr), mid=ms0+12*3600000, ph=phaseAt(mid), sn=events('sun',ms0,p.lat,p.lon), mn=events('moon',ms0,p.lat,p.lon);
  var star=(ph.illum<0.08||ph.illum>0.92)?3:(ph.illum<0.2||ph.illum>0.8)?2:1;
  return {date:dateStr,ph:ph,sun:sn,moon:mn,star:star};
}
function rng(a,b,w){ return a&&b?hhmm(a)+'–'+hhmm(b):'—'; }
function solunar(info,day){
  /* v31z369: ίδιες περίοδοι με το γράφημα (PF.solunarPeriods: κύρια ±90′, δευτερεύουσα ±60′ από ακριβή υπολογισμό σελήνης) */
  var PFm=window.PF;
  if(day&&PFm&&PFm.solunarPeriods){ try{ var c=C.getCond&&C.getCond(), lat=c&&c.lat!=null?+c.lat:35, lon=c&&c.lon!=null?+c.lon:33, t0=new Date(day+'T00:00:00').getTime();
    var per=PFm.solunarPeriods(t0,t0+86400000,lat,lon).filter(function(p){ return p.t>=t0&&p.t<t0+86400000; });
    if(per.length) return per.map(function(p){ return {k:p.kind==='major'?T('Κύρια','Major'):T('Δευτερεύουσα','Minor'),s:p.s,e:p.e}; }).sort(function(a,b){ return a.s-b.s; }); }catch(e){} }
  var m=info.moon, out=[];
  if(m.transit) out.push({k:T('Κύρια','Major'),s:m.transit-3600000,e:m.transit+3600000});
  if(m.under) out.push({k:T('Κύρια','Major'),s:m.under-3600000,e:m.under+3600000});
  if(m.rise) out.push({k:T('Δευτερεύουσα','Minor'),s:m.rise-1800000,e:m.rise+1800000});
  if(m.set) out.push({k:T('Δευτερεύουσα','Minor'),s:m.set-1800000,e:m.set+1800000});
  return out.sort(function(a,b){ return a.s-b.s; });
}
function stars(n){ return '★★★'.slice(0,n)+'☆☆☆'.slice(0,3-n); }

/* ---------- κάρτα στην καρτέλα Ψάρεμα ---------- */
function moonCard(){
  var tab=$('tab-fc'); if(!tab) return; var card=$('moonCard');
  if(!card){ card=el('div','card mooncard'); card.id='moonCard'; var g=$('fcGen'), pl=$('plCard'); if(g){ var hd=$('fcHead'); g.insertBefore(card,hd?hd.nextSibling:g.firstChild); } else if(pl) tab.insertBefore(card,pl.nextSibling); else tab.appendChild(card); }
  var td=C.nicosiaToday(), i0=dayInfo(td); card.replaceChildren();
  var top=el('div','mcrow'); top.append(el('div','mcem',EMO[i0.ph.idx]));
  var tx=el('div','mctx'); tx.append(el('b','',PHN[i0.ph.idx]+' · '+Math.round(i0.ph.illum*100)+'%'));
  tx.append(el('span','',T('Ανατολή ','Sunrise ')+(i0.sun.rise?hhmm(i0.sun.rise):'—')+T('  ·  Δύση ',' · Sunset ')+(i0.sun.set?hhmm(i0.sun.set):'—')));
  tx.append(el('span','',T('Σελήνη: ανατολή ','Moon: rise ')+(i0.moon.rise?hhmm(i0.moon.rise):'—')+T('  ·  δύση ',' · set ')+(i0.moon.set?hhmm(i0.moon.set):'—')));
  top.append(tx); card.append(top);
  var sl=solunar(i0,td); if(sl.length){ var l=el('div','mcsl'); l.append(el('span','mclab',T('Παραδοσιακές ώρες δραστηριότητας (solunar)','Traditional activity windows (solunar)')));
    sl.forEach(function(x){ l.append(el('span','mcpill '+(x.k===T('Κύρια','Major')?'maj':''),x.k+' '+hhmm(x.s)+'–'+hhmm(x.e))); }); card.append(l); }
  var strip=el('div','mcstrip'); for(var n=0;n<7;n++){ var ds=addDays(td,n), inf=n?dayInfo(ds):i0, d=el('div','mcday'+(n===0?' now':'')); var dd=new Date(Date.parse(ds+'T12:00:00Z'));
    d.append(el('span','mcd',dd.toLocaleDateString(EN?'en-GB':'el-GR',{weekday:'short',timeZone:'UTC'})),el('span','mce',EMO[inf.ph.idx]),el('span','mcs',stars(inf.star))); strip.append(d); }
  card.append(strip);
  var f=el('div','mcfoot'); f.append(el('span','',T('Το solunar είναι παράδοση, όχι επιστημονική βεβαιότητα.','Solunar is tradition, not scientific proof.')),btn(T('Στατιστικά σου','Your stats'),'',function(){ openPanel('moon'); })); card.append(f);
}

/* ---------- στατιστικά ανά φάση σελήνης ---------- */
function moonStats(box){
  var bs=bites().filter(function(b){ return b.date; }); box.append(el('div','smsec',T('Τα ψάρια σου ανά φάση σελήνης','Your catches by moon phase')));
  if(bs.length<12){ box.append(el('div','sptx',T('Χρειάζονται τουλάχιστον 12 ψάρια για να βγει εικόνα. Έχεις ',' You need at least 12 catches. You have ')+bs.length+'.')); return; }
  var cnt=[0,0,0,0,0,0,0,0], days=[{},{},{},{},{},{},{},{}];
  bs.forEach(function(b){ var ms=Date.parse(b.date+'T'+(b.time||'12:00')+':00Z')-nicOff(Date.parse(b.date+'T12:00:00Z')); var i=phaseAt(ms).idx; cnt[i]++; days[i][b.date]=1; });
  var tot=bs.length, mx=Math.max.apply(null,cnt);
  cnt.forEach(function(n,i){ var r=el('div','mphrow'); r.append(el('span','mpe',EMO[i]),el('span','mpn',PHN[i]));
    var bar=el('span','mpbar'), fill=el('i'); fill.style.width=(mx?n/mx*100:0)+'%'; bar.append(fill); r.append(bar,el('span','mpv',n+' · '+Math.round(n/tot*100)+'%')); box.append(r); });
  var top=cnt.indexOf(mx); box.append(el('div','sptx',T('Περισσότερα ψάρια: ','Most catches: ')+PHN[top]+' ('+Math.round(mx/tot*100)+'%). '+T('Αν ήταν τυχαίο, κάθε φάση θα είχε περίπου 12%. Όσο πιο λίγα τα ψάρια, τόσο λιγότερο σίγουρο.','If random, each phase would be about 12%. Fewer catches means less certainty.')));
}

/* ---------- 4: μοιάζει με τις καλύτερες μέρες σου ---------- */
var VARS=[['press',6,'hPa'],['wind',8,'kn'],['wave',0.8,'m'],['sst',3,'°C'],['temp',5,'°C']];
function dayTable(){
  var D={}; bites().forEach(function(b){ if(!b.date) return; var o=D[b.date]||(D[b.date]={date:b.date,n:0,kg:0,v:{}}); o.n++; o.kg+=b.rel?0:(+b.kg||0);
    VARS.forEach(function(x){ var k=x[0]; if(b[k]!=null&&!isNaN(+b[k])){ (o.v[k]=o.v[k]||[]).push(+b[k]); } }); });
  return Object.keys(D).map(function(k){ var o=D[k], m={}; Object.keys(o.v).forEach(function(q){ m[q]=o.v[q].reduce(function(a,b){ return a+b; },0)/o.v[q].length; }); o.m=m; o.nv=Object.keys(m).length; o.score=o.n+o.kg*0.5; return o; }).filter(function(o){ return o.nv>=2; });
}
function simScore(now,m){ var s=0,n=0,diff=[]; VARS.forEach(function(x){ var k=x[0]; if(now[k]==null||m[k]==null) return; var d=Math.min(1,Math.abs(now[k]-m[k])/x[1]); s+=1-d; n++; diff.push({k:k,d:d,a:now[k],b:m[k],u:x[2]}); }); return n>=2?{p:s/n,diff:diff}:null; }
function simCard(){
  var tt=$('tab-today'); if(!tt) return; var card=$('simCard');
  if(!card){ card=el('div','card simcard'); card.id='simCard'; card.hidden=true; var ly=$('lyCard'), seg=tt.querySelector('.tabseg'); if(ly) tt.insertBefore(card,ly.nextSibling); else tt.insertBefore(card,seg?seg.nextSibling:tt.firstChild); }
  var c=C.getCond&&C.getCond(); var days=dayTable(); if(!c||days.length<5){ card.hidden=true; return; }
  var now={press:c.press,wind:c.wind,wave:c.wave,sst:c.sst,temp:c.temp};
  var sorted=days.slice().sort(function(a,b){ return b.score-a.score; }), good=sorted.slice(0,Math.max(3,Math.ceil(days.length*0.3)));
  var rows=good.map(function(g){ var r=simScore(now,g.m); return r?{g:g,r:r}:null; }).filter(Boolean); if(!rows.length){ card.hidden=true; return; }
  var avg=rows.reduce(function(a,x){ return a+x.r.p; },0)/rows.length; rows.sort(function(a,b){ return b.r.p-a.r.p; });
  card.hidden=false; card.replaceChildren();
  card.append(el('div','label',T('Σήμερα σε σχέση με τις καλύτερες μέρες σου','Today vs your best days')));
  var p=Math.round(avg*100), head=el('div','simhead'); head.append(el('b','',p+'%'),el('span','',p>=75?T('Πολύ κοντά στις συνθήκες των καλών ψαρεμάτων σου.','Very close to the conditions of your good days.'):p>=55?T('Μέτρια ομοιότητα με τις καλές σου μέρες.','Moderate similarity to your good days.'):T('Διαφορετικές συνθήκες από τις καλές σου μέρες.','Different from your good days.'))); card.append(head);
  var nm={press:T('πίεση','pressure'),wind:T('άνεμος','wind'),wave:T('κύμα','wave'),sst:T('νερό','sea temp'),temp:T('αέρας','air')};
  rows.slice(0,3).forEach(function(x){ var r=el('div','simrow'), g=x.g; r.append(el('b','',g.date.split('-').reverse().join('/')),el('span','',g.n+(g.n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish'))+(g.kg?' · '+Math.round(g.kg*10)/10+' kg':'')+' · '+Math.round(x.r.p*100)+'%'));
    var worst=x.r.diff.slice().sort(function(a,b){ return b.d-a.d; })[0]; if(worst&&worst.d>0.35) r.append(el('small','',nm[worst.k]+': '+Math.round(worst.b*10)/10+' → '+Math.round(worst.a*10)/10+' '+worst.u)); card.append(r); });
  card.append(el('small','simfoot',T('Από ',' From ')+days.length+T(' μέρες με καταγεγραμμένες συνθήκες. Ενδεικτικό, όχι εγγύηση.',' days with recorded conditions. Indicative only.')));
}

/* ---------- 5: σημειώσεις σημείου ---------- */
var snov=el('div'); snov.id='spNote'; snov.hidden=true; document.body.appendChild(snov);
snov.addEventListener('click',function(e){ if(e.target===snov) snov.hidden=true; });
function top(map,n){ return Object.keys(map).sort(function(a,b){ return map[b]-map[a]; }).slice(0,n); }
function spotSummary(sp){
  var arr=bites().filter(function(b){ return b.place===sp.name||(typeof b.lat==='number'&&typeof sp.lat==='number'&&distM(b.lat,b.lon,sp.lat,sp.lon)<=250); });
  var o={n:arr.length,kg:0,sp:{},bait:{},tech:{},dmin:null,dmax:null,hr:{}};
  arr.forEach(function(b){ o.kg+=b.rel?0:(+b.kg||0); if(b.species) o.sp[b.species]=(o.sp[b.species]||0)+1; if(b.bait) o.bait[b.bait]=(o.bait[b.bait]||0)+1; if(b.tech) o.tech[b.tech]=(o.tech[b.tech]||0)+1;
    if(b.depth!=null&&!isNaN(+b.depth)){ var d=+b.depth; o.dmin=o.dmin==null?d:Math.min(o.dmin,d); o.dmax=o.dmax==null?d:Math.max(o.dmax,d); } if(b.time){ var h=+b.time.slice(0,2); var k=h<10?T('πρωί','morning'):h<15?T('μεσημέρι','midday'):h<20?T('απόγευμα','evening'):T('νύχτα','night'); o.hr[k]=(o.hr[k]||0)+1; } });
  return o;
}
function openNote(sp){
  snov.replaceChildren(); var card=el('div','spcard'); var hd=el('div','sphead'); hd.append(el('b','',sp.name||'?'),btn('✕','spx',function(){ snov.hidden=true; })); card.append(hd);
  var o=spotSummary(sp), body=el('div','spbody');
  body.append(el('div','smsec',T('Τι έχεις πιάσει εδώ','What you caught here')));
  if(!o.n) body.append(el('div','sptx',T('Δεν υπάρχουν ψάρια καταγεγραμμένα σε αυτό το σημείο (έως 250 μ.).','No catches recorded at this spot (within 250 m).')));
  else {
    var li=[ [T('Ψάρια','Fish'),o.n+(o.kg?' · '+Math.round(o.kg*10)/10+' kg':'')], [T('Είδη','Species'),top(o.sp,4).map(function(k){ return k+' ×'+o.sp[k]; }).join(', ')], [T('Δολώματα','Baits'),top(o.bait,3).map(function(k){ return k+' ×'+o.bait[k]; }).join(', ')],
      [T('Τεχνική','Technique'),top(o.tech,3).map(function(k){ return k+' ×'+o.tech[k]; }).join(', ')], [T('Βάθος','Depth'),o.dmin!=null?(o.dmin===o.dmax?o.dmin+' m':o.dmin+'–'+o.dmax+' m'):''], [T('Ώρα που δουλεύει','Best time'),top(o.hr,2).join(', ')] ];
    li.forEach(function(x){ if(x[1]){ var r=el('div','nsrow'); r.append(el('span','',x[0]),el('b','',x[1])); body.append(r); } });
  }
  body.append(el('div','smsec',T('Οι σημειώσεις μου','My notes')));
  var ta=el('textarea','nsta'); ta.rows=5; ta.maxLength=800; ta.value=sp.tips||''; ta.placeholder=T('π.χ. Ρεύμα από βορρά, δουλεύει με ζωντανό καλαμάρι στα 25 μ., προσοχή στις πέτρες…','e.g. North current, works with live squid at 25 m, watch the rocks…'); body.append(ta);
  var row=el('div','sprow'); row.append(btn(T('Αποθήκευση','Save'),'acc',function(){ var nt=Object.assign({},sp,{tips:ta.value.trim()}); if(!nt.tips) delete nt.tips; Promise.resolve(C.Store.save('spots',nt)).then(function(){ snov.hidden=true; C.toast(T('Αποθηκεύτηκε.','Saved.')); }); })); body.append(row);
  card.append(body); snov.append(card); snov.hidden=false;
}
function decorate(){
  Array.prototype.forEach.call(document.querySelectorAll('#spotList .item[data-sid]'),function(it){
    var a=it.querySelector('.acts'); if(!a||a.dataset.nt) return; a.dataset.nt='1'; var id=it.getAttribute('data-sid'), sp=spots().find(function(x){ return x.id===id; }); if(!sp) return;
    var b=el('button','btn ghost sm',T('Σημειώσεις','Notes')); b.type='button'; b.addEventListener('click',function(e){ e.stopPropagation(); var cur=spots().find(function(x){ return x.id===id; }); if(cur) openNote(cur); }); a.insertBefore(b,a.firstChild);
    if(sp.tips){ var f=it.firstChild; if(f) f.append(el('div','meta',T('📝 ','📝 ')+sp.tips.slice(0,120))); }
  });
}
var dt=null; function later(){ clearTimeout(dt); dt=setTimeout(decorate,60); }
(function(){ var n=$('spotList'); if(n) new MutationObserver(later).observe(n,{childList:true}); later(); })();

/* ---------- 6: συντήρηση ---------- */
var MK='alkyon-maint', M=C.lsGet(MK,null); if(!M||!Array.isArray(M.items)) M={items:null,sent:{}};
if(!M.items) M.items=T([
  ['Λάδι κινητήρα',100,12],['Φίλτρο καυσίμου',100,12],['Λάδι ποδιού (gearcase)',100,12],['Πτερωτή νερού (impeller)',200,24],['Ανόδια',0,6],['Προπέλα (έλεγχος)',0,6],['Μπαταρία (έλεγχος)',0,6],['Αντλία σεντίνας (δοκιμή)',0,3]
],[
  ['Engine oil',100,12],['Fuel filter',100,12],['Gearcase oil',100,12],['Water impeller',200,24],['Anodes',0,6],['Propeller (inspect)',0,6],['Battery (inspect)',0,6],['Bilge pump (test)',0,3]
]).map(function(x,i){ return {id:'m'+i,name:x[0],h:x[1],mo:x[2],last:null}; });
function msave(){ C.lsSet(MK,M); }
function engH(){ var s=window.AlkyonSmart&&window.AlkyonSmart.state&&window.AlkyonSmart.state(); return s&&s.eng?+s.eng.h||0:0; }
function mstat(it){
  if(!it.last) return {lv:'n',tx:T('Δεν έχει καταγραφεί','Not logged yet')};
  var eh=engH(), dh=it.h>0?it.h-(eh-it.last.h):null, dm=it.mo>0?it.mo*30.4-(Date.now()-it.last.t)/86400000:null, parts=[], lv='ok';
  if(dh!=null){ parts.push(dh>=0?T('σε ','in ')+Math.round(dh)+' h':T('καθυστέρηση ','overdue ')+Math.round(-dh)+' h'); if(dh<0) lv='bad'; else if(dh<it.h*0.1) lv='warn'; }
  if(dm!=null){ parts.push(dm>=0?T('σε ','in ')+Math.round(dm)+T(' ημέρες',' days'):T('καθυστέρηση ','overdue ')+Math.round(-dm)+T(' ημέρες',' days')); if(dm<0) lv='bad'; else if(dm<14&&lv!=='bad') lv='warn'; }
  return {lv:lv,tx:parts.join(' · ')+' · '+T('τελευταίο ','last ')+new Date(it.last.t).toLocaleDateString(EN?'en-GB':'el-GR')};
}
function maintCheck(){
  var now=Date.now(); M.items.forEach(function(it){ var s=mstat(it); if(s.lv!=='bad'&&s.lv!=='warn') return; if(M.sent[it.id]&&now-M.sent[it.id]<7*86400000) return; M.sent[it.id]=now; msave();
    var t='🔧 '+it.name, b=s.lv==='bad'?T('Εκπρόθεσμο.','Overdue.'):T('Πλησιάζει η ώρα.','Coming due.'); try{ if(window.AlkyonSea&&window.AlkyonSea.notify) window.AlkyonSea.notify(t,b); else C.toast(t+' · '+b); }catch(e){} });
}
function maintUI(box,rr){
  var render=rr||render0;
  box.append(el('div','smsec',T('Συντήρηση σκάφους','Boat maintenance')));
  box.append(el('div','sptx',T('Ώρες κινητήρα: ','Engine hours: ')+Math.round(engH()*10)/10+' h '+T('(από τις εξόδους· διόρθωση στην καρτέλα Βάρκα)','(from your trips; edit in the Boat tab)')));
  M.items.forEach(function(it){
    var s=mstat(it), r=el('div','mtrow '+s.lv), x=el('div','sptx'); x.append(el('b','',it.name),el('span','',s.tx));
    var b=btn(T('Έγινε','Done'),'acc',function(){ it.last={h:engH(),t:Date.now()}; delete M.sent[it.id]; msave(); render(); });
    var d=el('details','mtdet'); var iv=[]; if(it.h) iv.push(it.h+' h'); if(it.mo) iv.push(it.mo+T(' μήνες',' months')); d.append(el('summary','',T('Διάστημα: ','Interval: ')+(iv.length?iv.join(T(' ή ',' or ')):T('δεν έχει οριστεί','not set'))));
    var h=el('input','sminp'); h.type='number'; h.min='0'; h.value=it.h||''; h.placeholder='h'; h.addEventListener('change',function(){ it.h=+h.value||0; msave(); render(); });
    var m=el('input','sminp'); m.type='number'; m.min='0'; m.value=it.mo||''; m.placeholder=T('μήνες','months'); m.addEventListener('change',function(){ it.mo=+m.value||0; msave(); render(); });
    var del=btn(T('Διαγραφή','Delete'),'',function(){ M.items=M.items.filter(function(q){ return q!==it; }); msave(); render(); });
    d.append(el('div','mtint',''),h,el('span','',' h  '),m,el('span','',T(' μήνες',' mo ')),del);
    r.append(x,b,d); box.append(r); });
  var add=el('div','sprow'); add.append(btn(T('+ Νέο στοιχείο','+ New item'),'',function(){ window.AlkyonAsk.prompt&&window.AlkyonAsk.prompt(T('Όνομα στοιχείου συντήρησης','Maintenance item name'),{title:T('Νέο στοιχείο','New item')}).then(function(v){ v=(v||'').trim(); if(!v) return; M.items.push({id:'m'+Date.now().toString(36),name:v.slice(0,60),h:0,mo:12,last:null}); msave(); render(); }); })); box.append(add);
}

window.AlkyonMaint={ui:function(box,rr){ maintUI(box,rr); },check:function(){ maintCheck(); },engH:function(){ return engH(); }};
/* ---------- 7: κόστος ανά σεζόν ---------- */
function costOf(t){ var c=t&&t.cost; return c?(+c.fuel||0)+(+c.bait||0)+(+c.other||0):0; }
function costUI(box){
  box.append(el('div','smsec',T('Κόστος ανά σεζόν','Cost per season')));
  var Y={}; trips().forEach(function(t){ var c=costOf(t); if(!(c>0)) return; var y=(t.date||'').slice(0,4); if(!y) return; var o=Y[y]||(Y[y]={y:y,n:0,c:0,kg:0,fish:0}); o.n++; o.c+=c; o.kg+=+t.kg||0; o.fish+=+t.count||0; });
  var ys=Object.keys(Y).sort().reverse(); if(!ys.length){ box.append(el('div','sptx',T('Καταχώρησε κόστος στο τέλος κάθε εξόδου (κάρτα «Κόστος») για να δεις €/κιλό.','Enter cost at the end of each trip to see €/kg.'))); return; }
  var all={n:0,c:0,kg:0,fish:0}; ys.forEach(function(y){ var o=Y[y]; all.n+=o.n; all.c+=o.c; all.kg+=o.kg; all.fish+=o.fish; });
  function line(lab,o){ var r=el('div','cstrow'); r.append(el('b','',lab)); var s=[money(o.c)+' · '+o.n+T(' έξοδοι',' trips'),money(o.c/o.n)+T(' ανά έξοδο',' per trip')];
    if(o.kg>0) s.push(money(o.c/o.kg)+T(' ανά κιλό',' per kg')); if(o.fish>0) s.push(money(o.c/o.fish)+T(' ανά ψάρι',' per fish')); r.append(el('span','',s.join('  ·  '))); box.append(r); }
  ys.forEach(function(y){ line(y,Y[y]); }); if(ys.length>1) line(T('Σύνολο','All time'),all);
  box.append(el('div','sptx',T('Μετρούν μόνο οι έξοδοι με καταγεγραμμένο κόστος.','Only trips with a recorded cost are counted.')));
}

/* ---------- 8: εξαγωγή ---------- */
function csvCell(v){ if(v==null) return ''; if(typeof v==='object') v=JSON.stringify(v); v=String(v); return /[",\n\r;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function toCsv(rows,cols){ return '﻿'+[cols.join(',')].concat(rows.map(function(r){ return cols.map(function(c){ return csvCell(typeof c==='function'?c(r):r[c]); }).join(','); })).join('\r\n'); }
function dl(name,text,mime){
  var blob=new Blob([text],{type:mime||'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },4000);
}
var BC=['date','time','species','latin','bait','tech','depth','kg','len','press','ptrend','wind','wave','cloud','temp','sst','tide','place','lat','lon','notes','tripId'];
function stamp(){ return C.nicosiaToday(); }
function exportBites(){ var rows=bites().slice().sort(function(a,b){ return ((a.date||'')+(a.time||'')).localeCompare((b.date||'')+(b.time||'')); }); var cols=BC.map(function(c){ return c==='tripId'?'trip':c; }); dl('alkyon-fish-'+stamp()+'.csv',toCsv(rows,cols)); }
function exportTrips(){
  var cols=['date','spot',function(t){ return t.startMs?new Date(t.startMs).toISOString():''; },function(t){ return t.endMs?new Date(t.endMs).toISOString():''; },function(t){ return t.startMs&&t.endMs?Math.round(Math.max(0,t.endMs-t.startMs-(t.pauseMs||0))/360000)/10:''; },'km','count','kg','miss',function(t){ return t.cost?t.cost.fuel:''; },function(t){ return t.cost?t.cost.bait:''; },function(t){ return t.cost?t.cost.other:''; },function(t){ return costOf(t)||''; }];
  var head=['date','route','start','end','hours','km','fish','kg','missed','fuel_eur','bait_eur','other_eur','total_eur'];
  var rows=trips().slice().sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
  dl('alkyon-trips-'+stamp()+'.csv','﻿'+[head.join(',')].concat(rows.map(function(r){ return cols.map(function(c){ return csvCell(typeof c==='function'?c(r):r[c]); }).join(','); })).join('\r\n'));
}
function exportGear(){
  var it=(window.AlkyonGear?window.AlkyonGear.state().items:[]).slice(), bs=bites();
  function iso(ms){ return ms?new Date(ms).toISOString():''; }
  function km(a){ if(!a||a.length<2) return ''; var m=0; for(var i=1;i<a.length;i++) m+=distM(a[i-1][0],a[i-1][1],a[i][0],a[i][1]); return Math.round(m/10)/100; }
  var cols=['name','type','state',function(g){ return iso(g.set&&g.set.ta); },function(g){ return iso(g.set&&g.set.tb); },function(g){ return g.set&&g.set.a?g.set.a[0]:''; },function(g){ return g.set&&g.set.a?g.set.a[1]:''; },function(g){ return g.set&&g.set.b?g.set.b[0]:''; },function(g){ return g.set&&g.set.b?g.set.b[1]:''; },function(g){ return km(g.set&&g.set.pts); },
    function(g){ return iso(g.haul&&g.haul.ta); },function(g){ return iso(g.haul&&g.haul.tb); },function(g){ return km(g.haul&&g.haul.pts); },function(g){ return bs.filter(function(b){ return b.gear===g.id; }).length; },function(g){ return Math.round(bs.filter(function(b){ return b.gear===g.id; }).reduce(function(s,b){ return s+(+b.kg||0); },0)*10)/10; }];
  var head=['name','type','state','set_start','set_end','set_start_lat','set_start_lon','set_end_lat','set_end_lon','set_km','haul_start','haul_end','haul_km','fish','kg'];
  dl('alkyon-gear-'+stamp()+'.csv','﻿'+[head.join(',')].concat(it.map(function(r){ return cols.map(function(c){ return csvCell(typeof c==='function'?c(r):r[c]); }).join(','); })).join('\r\n'));
}
function exportSpots(){ dl('alkyon-spots-'+stamp()+'.csv',toCsv(spots(),['name','type','lat','lon','depth','notes','tips'])); }
function exportAll(){
  var o={app:'Alkyon',exported:new Date().toISOString(),bites:bites(),trips:trips().map(function(t){ return t; }),spots:spots(),gear:(window.AlkyonGear?window.AlkyonGear.state().items:[]),smart:C.lsGet('alkyon-smart',null),maintenance:M};
  dl('alkyon-backup-'+stamp()+'.json',JSON.stringify(o),'application/json');
  C.lsSet('alkyon-lastbackup',Date.now());
}
function exportUI(box){
  box.append(el('div','smsec',T('Εξαγωγή δεδομένων','Export data')));
  box.append(el('div','sptx',T('Αρχεία CSV για Excel/Google Sheets και πλήρες αντίγραφο JSON. Οι φωτογραφίες δεν περιλαμβάνονται.','CSV files for Excel/Google Sheets and a full JSON copy. Photos are not included.')));
  var lb=+C.lsGet('alkyon-lastbackup',0)||0; box.append(el('div','sptx',T('Τελευταίο πλήρες αντίγραφο: ','Last full backup: ')+(lb?new Date(lb).toLocaleDateString():T('ποτέ','never'))));
  var r=el('div','sprow wrap'); r.append(btn(T('Ψάρια (CSV)','Catches (CSV)'),'',exportBites),btn(T('Έξοδοι (CSV)','Trips (CSV)'),'',exportTrips),btn(T('Σημεία (CSV)','Spots (CSV)'),'',exportSpots),btn(T('Εργαλεία (CSV)','Gear (CSV)'),'',exportGear),btn(T('Πλήρες αντίγραφο (JSON)','Full backup (JSON)'),'acc',exportAll)); box.append(r);
}

/* ---------- πίνακας ---------- */
var P=el('div'); P.id='inPanel'; P.hidden=true; P.innerHTML='<div class="spcard"><div class="sphead"><b></b><button type="button" class="spx" aria-label="✕">✕</button></div><div class="spbody"></div></div>';
P.querySelector('b').textContent=T('Αναλύσεις και αρχείο','Insights and archive'); document.body.appendChild(P);
var body=P.querySelector('.spbody'), card0=P.querySelector('.spcard');
P.querySelector('.spx').addEventListener('click',function(){ P.hidden=true; }); P.addEventListener('click',function(e){ if(e.target===P) P.hidden=true; });
var focus=null, view=null;
function render0(){ return render.apply(this,arguments); }
function render(showAll){ if(showAll===true) view=null; body.replaceChildren(); var sec={}, only=view; ['moon','cost','maint','export'].forEach(function(k){ if(only&&k!==only) return; sec[k]=el('div'); sec[k].dataset.k=k; body.append(sec[k]); });
  if(sec.moon) moonStats(sec.moon); if(sec.cost) costUI(sec.cost); if(sec.maint) maintUI(sec.maint); if(sec.export) exportUI(sec.export);
  if(only){ body.append(btn(T('Όλες οι αναλύσεις (κόστος, συντήρηση, εξαγωγή)','All insights (cost, maintenance, export)'),'',function(){ render(true); })); }
  focus=null; }
function openPanel(k){ focus=k||null; view=k||null; render(); P.hidden=false; }
window.AlkyonOpenExport=function(){ var sp=$('seaPanel'); if(sp) sp.hidden=true; openPanel('export'); };
(window.AlkyonSeaRows=window.AlkyonSeaRows||[]).push(function(){
  var r=el('div','sprow'), x=el('div','sptx'); x.append(el('b','',T('Αναλύσεις και αρχείο','Insights and archive')),el('span','',T('Σελήνη, κόστος ανά κιλό, συντήρηση, εξαγωγή δεδομένων','Moon, cost per kg, maintenance, data export')));
  r.append(x,btn(T('Άνοιγμα','Open'),'acc',function(){ var sp=$('seaPanel'); if(sp) sp.hidden=true; openPanel(); })); r.dataset.k='insights'; return r;
});

/* ---------- εκκίνηση ---------- */
function refresh(){ try{ moonCard(); }catch(e){} try{ simCard(); }catch(e){} }
refresh(); setTimeout(refresh,2500);
window.addEventListener('alkyon-fcloaded',function(e){ var p=e.detail&&e.detail.place; if(p&&p.lat!=null&&p.lon!=null){ fcLoc={lat:+p.lat,lon:+p.lon}; refresh(); } });
document.addEventListener('alkyon-cond',function(){ setTimeout(refresh,300); });
window.addEventListener('alkyon-tripend',function(){ setTimeout(function(){ refresh(); maintCheck(); },1500); });
var tabs=document.querySelector('nav[role=tablist],[role=tablist]'); if(tabs) tabs.addEventListener('click',function(){ setTimeout(refresh,200); });
try{ C.Store.on('bites',function(){ setTimeout(refresh,200); }); C.Store.on('trips',function(){ setTimeout(refresh,200); }); }catch(e){}
setTimeout(maintCheck,6000);
window.AlkyonInsights={dayInfo:dayInfo,phaseAt:phaseAt,open:openPanel,dayTable:dayTable,simScore:simScore,maint:function(){ return M; },exportBites:exportBites,exportTrips:exportTrips,exportSpots:exportSpots,exportAll:exportAll,spotSummary:spotSummary,maintCheck:maintCheck};

/* v31z12: υπενθύμιση αντιγράφου ασφαλείας κάθε 30 ημέρες (όχι σε ενεργή έξοδο· «Αργότερα» = 7 ημέρες) */
(function(){
  var DAY=86400000;
  function check(){
    try{
      var s=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); if(s&&s.active) return;
      var nb=bites().length, ns=spots().length; if(!nb&&!ns) return;
      var now=Date.now(), since=+C.lsGet('alkyon-backup-since',0)||0; if(!since){ C.lsSet('alkyon-backup-since',now); since=now; }
      var ref=Math.max(+C.lsGet('alkyon-lastbackup',0)||0,since);
      /* αν ο συγχρονισμός με τον λογαριασμό δουλεύει (τελευταίος πριν λιγότερο από 3 ημέρες) τα δεδομένα είναι ασφαλή: καμία υπενθύμιση. Αλλιώς κάθε 7 ημέρες */
      var lastSync=+C.lsGet('alkyon-last',0)||0; if(lastSync&&now-lastSync<3*DAY) return;
      if(now-ref<7*DAY) return;
      if(now<(+C.lsGet('alkyon-backup-snooze',0)||0)) return;
      window.AlkyonAsk(T('Έχεις '+nb+' ψάρια και '+ns+' σημεία. Δεν έχει γίνει πρόσφατος συγχρονισμός με τον λογαριασμό σου ούτε αντίγραφο ασφαλείας τις τελευταίες 7 ημέρες. Να το κάνω τώρα; Θα αποθηκευτεί ένα αρχείο στο κινητό.','You have '+nb+' catches and '+ns+' spots. Nothing has synced to your account and no backup was made in the last 7 days. Back up now? A file will be saved to your phone.'),{title:T('Αντίγραφο ασφαλείας','Backup'),ok:T('Αντίγραφο τώρα','Back up now'),cancel:T('Αργότερα','Later')}).then(function(ok){ if(ok) exportAll(); else C.lsSet('alkyon-backup-snooze',Date.now()+7*DAY); });
    }catch(e){}
  }
  setTimeout(check,9000);
})();
})();
