/* Alkyon 4 · αναλύσεις (ίδιοι υπολογισμοί με την κλασική insights.js):
   ψάρια ανά φάση σελήνης, κόστος ανά σεζόν, «σήμερα σε σχέση με τις καλύτερες μέρες σου», τι έπιασες σε κάθε σημείο. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN;
var EMO=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'], PHN=EN?['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent']:['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα','Πανσέληνος','Φθίνουσα','Τελευταίο τέταρτο','Φθίνων μηνίσκος'];
function bites(){ return B.store.bites().filter(function(b){ return !b.deleted&&!b.gear; }); }
function money(v){ return '€'+B.num(v,v%1?2:0); }
function phase(b){ try{ return Math.round(PF.moonPhase(B.biteMs(b)).f*8)%8; }catch(e){ return null; } }

B.moonCard=function(list){
  var bs=(list||bites()).filter(function(b){ return b.date; }), c=h('section',{class:'card'},h('h2',{text:T('Τα ψάρια σου ανά φάση σελήνης','Your catches by moon phase')}));
  if(bs.length<12){ c.append(h('p',{class:'sub',text:T('Χρειάζονται τουλάχιστον 12 ψάρια για να βγει εικόνα. Έχεις ','You need at least 12 catches. You have ')+bs.length+'.'})); return c; }
  var cnt=[0,0,0,0,0,0,0,0]; bs.forEach(function(b){ var i=phase(b); if(i!=null) cnt[i]++; }); var tot=bs.length, mx=Math.max.apply(null,cnt);
  cnt.forEach(function(n,i){ c.append(h('div',{class:'bar'},h('span',{class:'bl',text:EMO[i]+' '+PHN[i]}),h('span',{class:'bt'},h('i',{style:{width:(mx?n/mx*100:0)+'%'}})),h('span',{class:'bv',text:n+' · '+Math.round(n/tot*100)+'%'}))); });
  c.append(h('p',{class:'foot',text:T('Περισσότερα ψάρια: ','Most catches: ')+PHN[cnt.indexOf(mx)]+' ('+Math.round(mx/tot*100)+'%). '+T('Αν ήταν τυχαίο, κάθε φάση θα είχε περίπου 12%. Όσο πιο λίγα τα ψάρια, τόσο λιγότερο σίγουρο.','If random, each phase would be about 12%. Fewer catches means less certainty.')}));
  return c;
};
B.costCard=function(){
  var Y={}; B.store.raw('trips').forEach(function(t){ if(t.deleted) return; var c=t.cost?(+t.cost.fuel||0)+(+t.cost.bait||0)+(+t.cost.other||0):0; if(!(c>0)) return; var y=(t.date||'').slice(0,4); if(!y) return; var o=Y[y]||(Y[y]={n:0,c:0,kg:0,fish:0}); o.n++; o.c+=c; o.kg+=+t.kg||0; o.fish+=+t.count||0; });
  var ys=Object.keys(Y).sort().reverse(); if(!ys.length) return null;
  var c=h('section',{class:'card'},h('h2',{text:T('Κόστος ανά σεζόν','Cost per season')})), all={n:0,c:0,kg:0,fish:0};
  function line(lab,o){ var s=[money(o.c)+' · '+o.n+T(' έξοδοι',' trips'),money(o.c/o.n)+T(' ανά έξοδο',' per trip')]; if(o.kg>0) s.push(money(o.c/o.kg)+T(' ανά κιλό',' per kg')); if(o.fish>0) s.push(money(o.c/o.fish)+T(' ανά ψάρι',' per fish'));
    c.append(h('div',{class:'cstrow'},h('b',{text:lab}),h('span',{text:s.join('  ·  ')}))); }
  ys.forEach(function(y){ var o=Y[y]; all.n+=o.n; all.c+=o.c; all.kg+=o.kg; all.fish+=o.fish; line(y,o); }); if(ys.length>1) line(T('Σύνολο','All time'),all);
  c.append(h('p',{class:'foot',text:T('Μετρούν μόνο οι έξοδοι με καταγεγραμμένο κόστος.','Only trips with a recorded cost are counted.')})); return c;
};
var VARS=[['press',6,'hPa'],['wind',8,'kn'],['wave',0.8,'m'],['sst',3,'°C'],['temp',5,'°C']];
function dayTable(){ var D={}; bites().forEach(function(b){ if(!b.date||b.miss) return; var o=D[b.date]||(D[b.date]={date:b.date,n:0,kg:0,v:{}}); o.n++; o.kg+=b.rel?0:(+b.kg||0);
    VARS.forEach(function(x){ var k=x[0]; if(b[k]!=null&&!isNaN(+b[k])) (o.v[k]=o.v[k]||[]).push(+b[k]); }); });
  return Object.keys(D).map(function(k){ var o=D[k], m={}; Object.keys(o.v).forEach(function(q){ m[q]=o.v[q].reduce(function(a,b){ return a+b; },0)/o.v[q].length; }); o.m=m; o.nv=Object.keys(m).length; o.score=o.n+o.kg*0.5; return o; }).filter(function(o){ return o.nv>=2; }); }
function simScore(now,m){ var s=0,n=0,diff=[]; VARS.forEach(function(x){ var k=x[0]; if(now[k]==null||m[k]==null) return; var d=Math.min(1,Math.abs(now[k]-m[k])/x[1]); s+=1-d; n++; diff.push({k:k,d:d,a:now[k],b:m[k],u:x[2]}); }); return n>=2?{p:s/n,diff:diff}:null; }
/* now = {press,wind,wave,sst,temp} της ώρας που βλέπεις */
B.bestDaysCard=function(now){
  var days=dayTable(); if(!now||days.length<5) return null;
  var good=days.slice().sort(function(a,b){ return b.score-a.score; }).slice(0,Math.max(3,Math.ceil(days.length*0.3)));
  var rows=good.map(function(g){ var r=simScore(now,g.m); return r?{g:g,r:r}:null; }).filter(Boolean); if(!rows.length) return null;
  var avg=rows.reduce(function(a,x){ return a+x.r.p; },0)/rows.length, p=Math.round(avg*100); rows.sort(function(a,b){ return b.r.p-a.r.p; });
  var nm={press:T('πίεση','pressure'),wind:T('άνεμος','wind'),wave:T('κύμα','wave'),sst:T('νερό','sea temp'),temp:T('αέρας','air')};
  var c=h('section',{class:'card simcard'},h('h2',{text:T('Σε σχέση με τις καλύτερες μέρες σου','Compared with your best days')}),
    h('div',{class:'simhead'},h('b',{text:p+'%'}),h('span',{text:p>=75?T('Πολύ κοντά στις συνθήκες των καλών ψαρεμάτων σου.','Very close to the conditions of your good days.'):p>=55?T('Μέτρια ομοιότητα με τις καλές σου μέρες.','Moderate similarity to your good days.'):T('Διαφορετικές συνθήκες από τις καλές σου μέρες.','Different from your good days.')})));
  rows.slice(0,3).forEach(function(x){ var g=x.g, worst=x.r.diff.slice().sort(function(a,b){ return b.d-a.d; })[0];
    c.append(h('div',{class:'lyrow'},h('b',{text:g.date.split('-').reverse().join('/')}),h('span',{text:g.n+(g.n===1?T(' ψάρι',' catch'):T(' ψάρια',' catches'))+(g.kg?' · '+B.num(g.kg,1)+' kg':'')+' · '+Math.round(x.r.p*100)+'%'+(worst&&worst.d>0.35?' · '+nm[worst.k]+': '+B.num(worst.b,1)+' → '+B.num(worst.a,1)+' '+worst.u:'')}))); });
  c.append(h('p',{class:'foot',text:T('Από ','From ')+days.length+T(' μέρες με καταγεγραμμένες συνθήκες. Ενδεικτικό, όχι εγγύηση.',' days with recorded conditions. Indicative only.')})); return c;
};
/* τι έπιασες σε ένα σημείο (για το φύλλο του σημείου στον χάρτη) */
function distM(a,b,c,d){ var R=Math.PI/180, dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742000*Math.asin(Math.min(1,Math.sqrt(x))); }
function top(m,n){ return Object.keys(m).sort(function(a,b){ return m[b]-m[a]; }).slice(0,n); }
B.spotSummary=function(sp){
  var arr=bites().filter(function(b){ return !b.miss&&(b.place===sp.name||(typeof b.lat==='number'&&typeof sp.lat==='number'&&distM(b.lat,b.lon,sp.lat,sp.lon)<=250)); }); if(!arr.length) return null;
  var o={kg:0,sp:{},bait:{},tech:{},dmin:null,dmax:null,hr:{},mo:{}}, MON=EN?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']:['Ιαν','Φεβ','Μάρ','Απρ','Μάι','Ιούν','Ιούλ','Αύγ','Σεπ','Οκτ','Νοέ','Δεκ'];
  arr.forEach(function(b){ o.kg+=b.rel?0:(+b.kg||0); if(b.species) o.sp[b.species]=(o.sp[b.species]||0)+1; if(b.bait) o.bait[b.bait]=(o.bait[b.bait]||0)+1; if(b.tech) o.tech[b.tech]=(o.tech[b.tech]||0)+1;
    if(b.depth!=null&&b.depth!==''&&!isNaN(+b.depth)){ var d=+b.depth; o.dmin=o.dmin==null?d:Math.min(o.dmin,d); o.dmax=o.dmax==null?d:Math.max(o.dmax,d); }
    if(b.time){ var x=+b.time.slice(0,2), k=x<10?T('πρωί','morning'):x<15?T('μεσημέρι','midday'):x<20?T('απόγευμα','evening'):T('νύχτα','night'); o.hr[k]=(o.hr[k]||0)+1; } if(b.date){ var mm=MON[+b.date.slice(5,7)-1]; o.mo[mm]=(o.mo[mm]||0)+1; } });
  var rows=[[T('Ψάρια εδώ','Catches here'),arr.length+(o.kg?' · '+B.num(o.kg,1)+' kg':'')]], f=function(m){ return top(m,3).map(function(k){ return k+' ×'+m[k]; }).join(', '); };
  if(Object.keys(o.sp).length) rows.push([T('Είδη','Species'),f(o.sp)]); if(Object.keys(o.bait).length) rows.push([T('Δολώματα','Baits'),f(o.bait)]); if(Object.keys(o.tech).length) rows.push([T('Τεχνικές','Techniques'),f(o.tech)]);
  if(o.dmin!=null) rows.push([T('Βάθος','Depth'),(window.AlkyonUnits&&AlkyonUnits.depthRange?AlkyonUnits.depthRange(o.dmin,o.dmax):(o.dmin===o.dmax?o.dmin+' m':o.dmin+'–'+o.dmax+' m'))]); if(Object.keys(o.hr).length) rows.push([T('Ώρα','Time'),top(o.hr,2).join(', ')]); if(Object.keys(o.mo).length) rows.push([T('Μήνες','Months'),top(o.mo,3).join(', ')]);
  return rows;
};
})();
