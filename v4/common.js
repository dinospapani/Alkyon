/* Alkyon 1.9.59 · «Τι κοινό είχαν τα ψαρέματά σου»
   Από τα ψάρια σου (και τις συνθήκες που κράτησε η εφαρμογή σε κάθε ψάρι) βρίσκει τι είχαν κοινό οι μέρες που έπιασες,
   χωριστά για τα μεγάλα (≥ 2 kg) και τα μικρά. Αν υπάρχουν έξοδοι χωρίς ψάρι, δείχνει και πώς ήταν εκείνες, για σύγκριση.
   Λέει τι ήταν κοινό, όχι γιατί τσίμπησαν: γράφει πάντα σε πόσες μέρες στηρίζεται κάθε γραμμή. */
(function(){
'use strict';
var B=window.AK; if(!B) return; var h=B.h, T=B.T, EN=B.EN;
function S(){ return B.store; }
var MN=EN?['January','February','March','April','May','June','July','August','September','October','November','December']:['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
var TECHN={'Βυθού':'Bottom fishing','Καθετή ρηχή':'Shallow vertical','Καθετή βαθιά':'Deep vertical','Τρόλινγκ':'Trolling','Συρτή αφρού':'Surface trolling','Συρτή βυθού':'Deep / bottom trolling','Δίχτυ':'Net','Παραγάδι':'Longline','Ζωντανό δόλωμα':'Live bait'};
function num(v){ var x=v==null||v===''?NaN:+v; return isNaN(x)?null:x; }
function med(a){ a=a.filter(function(x){ return x!=null; }).sort(function(x,y){ return x-y; }); if(!a.length) return null; var m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function mode(a){ var c={}, best=null; a.forEach(function(x){ if(x==null||x==='') return; c[x]=(c[x]||0)+1; if(best==null||c[x]>c[best]) best=x; }); return best==null?null:{v:best,n:c[best]}; }
function fmt(x,d){ return B.num?B.num(x,d):String(Math.round(x*Math.pow(10,d))/Math.pow(10,d)); }
function hm(m){ m=Math.round(m); return B.pad(Math.floor(m/60))+':'+B.pad(m%60); }
function tzAt(date){ try{ return -new Date(date+'T12:00:00').getTimezoneOffset(); }catch(e){ return 120; } }

/* μία εγγραφή ανά μέρα με ψάρια */
function days(){
  var by={};
  S().raw('bites').forEach(function(b){ if(!b||b.deleted||b.miss||(B.pest&&B.pest(b))||!b.date) return;
    var d=by[b.date]||(by[b.date]={date:b.date,b:[]}); d.b.push(b); });
  return Object.keys(by).sort().map(function(k){ var d=by[k], bs=d.b;
    var kg=bs.map(function(b){ return num(b.kg); }).filter(function(x){ return x!=null; });
    var tms=bs.map(function(b){ var p=String(b.time||'').split(':'); return p.length>1?(+p[0])*60+(+p[1]):null; }).filter(function(x){ return x!=null&&!isNaN(x); });
    var la=med(bs.map(function(b){ return num(b.lat); })), lo=med(bs.map(function(b){ return num(b.lon); }));
    var o={date:k,month:+k.slice(5,7)-1,n:bs.reduce(function(s,b){ return s+Math.max(1,Math.floor(+b.cnt)||1); },0),kgMax:kg.length?Math.max.apply(null,kg):null,
      sp:bs.map(function(b){ return b.species; }).filter(Boolean),
      sst:med(bs.map(function(b){ return num(b.sst); })),wind:med(bs.map(function(b){ return num(b.wind); })),wave:med(bs.map(function(b){ return num(b.wave); })),
      depth:med(bs.map(function(b){ return num(b.depth); })),pt:mode(bs.map(function(b){ return b.ptrend; })),tide:mode(bs.map(function(b){ return b.tide; })),
      bait:mode(bs.map(function(b){ return String(b.bait||'').trim(); })),tech:mode(bs.map(function(b){ return String(b.tech||'').trim(); })),t0:tms.length?Math.min.apply(null,tms):null,illum:null,afterRise:null};
    try{ if(window.PF&&o.t0!=null){ var tz=tzAt(k), ms=Date.parse(k+'T00:00:00Z')-tz*60000+o.t0*60000; o.illum=PF.moonPhase(ms).illum;
      if(la!=null&&lo!=null){ var sm=PF.sunMoon(k,la,lo,tz); if(sm&&sm.rise!=null) o.afterRise=(o.t0-sm.rise)/60; } } }catch(e){}
    return o; });
}
/* έξοδοι χωρίς ψάρι (με ώρα), για σύγκριση */
function emptyTrips(){
  var bs=S().raw('bites').filter(function(b){ return b&&!b.deleted&&!b.miss; });
  return S().raw('trips').filter(function(t){ if(!t||t.deleted||!t.startMs||!t.endMs) return false; if(+t.count>0) return false;
    return !bs.some(function(b){ var m=B.biteMs?B.biteMs(b):null; return (t.sid&&b.trip===t.sid)||(m!=null&&m>=t.startMs-600000&&m<=t.endMs+600000); }); });
}
var PT={fast:T('έπεφτε απότομα','falling fast'),slow:T('έπεφτε αργά','falling slowly'),stable:T('σταθερή','steady'),rise:T('ανέβαινε','rising')};
var TIDE={up:T('ανέβαινε','rising'),down:T('κατέβαινε','falling')};
/* οι γραμμές μιας ομάδας: [τίτλος, κείμενο, πόσες μέρες στηρίζουν / από πόσες] */
function traits(G){
  var N=G.length, out=[];
  function share(f){ var c=0, k=0; G.forEach(function(d){ var v=f(d); if(v==null) return; k++; if(v) c++; }); return {c:c,k:k}; }
  /* εποχή */
  var ms=G.map(function(d){ return d.month; }), set={}; ms.forEach(function(m){ set[m]=1; });
  var mk=Object.keys(set).map(Number).sort(function(a,b){ return a-b; });
  if(mk.length){ var span=mk.length===1?MN[mk[0]]:(mk[mk.length-1]-mk[0]<=4?MN[mk[0]]+'–'+MN[mk[mk.length-1]]:mk.map(function(m){ return MN[m]; }).join(', '));
    out.push([T('Εποχή','Season'),span,N,N]); }
  /* νερό */
  var ss=G.map(function(d){ return d.sst; }).filter(function(x){ return x!=null; });
  if(ss.length>=2) out.push([T('Θάλασσα','Sea temp'),(Math.abs(Math.max.apply(null,ss)-Math.min.apply(null,ss))<0.15?fmt(Math.max.apply(null,ss),1):fmt(Math.min.apply(null,ss),1)+'–'+fmt(Math.max.apply(null,ss),1))+' °C',ss.length,N]);
  /* πίεση */
  var p=mode(G.map(function(d){ return d.pt&&d.pt.v; })), pk=G.filter(function(d){ return d.pt; }).length;
  if(p&&pk>=2) out.push([T('Πίεση','Pressure'),p.n/pk>=0.6?PT[p.v]||p.v:T('διάφορη (χωρίς κάτι κοινό)','varied (no common pattern)'),p.n/pk>=0.6?p.n:pk,pk]);
  /* άνεμος, κύμα */
  var ws=G.map(function(d){ return d.wind; }).filter(function(x){ return x!=null; });
  if(ws.length>=2){ var wmx=Math.max.apply(null,ws), wmn=Math.min.apply(null,ws); out.push([T('Άνεμος','Wind'),(wmx<=8?T('λίγος, ','light, '):wmx>=15?T('δυνατός, ','strong, '):'')+(Math.round(wmn)===Math.round(wmx)?Math.round(wmx):Math.round(wmn)+'–'+Math.round(wmx))+' kn',ws.length,N]); }
  var vs=G.map(function(d){ return d.wave; }).filter(function(x){ return x!=null; });
  if(vs.length>=2){ var vsorted=vs.slice().sort(function(a,b){ return a-b; }), within=vs.filter(function(x){ return x<=0.7; }).length;
    out.push([T('Κύμα','Waves'),within===vs.length?T('ως ','up to ')+fmt(vsorted[vs.length-1],1)+' m':fmt(vsorted[0],1)+'–'+fmt(vsorted[vs.length-1],1)+' m'+(within/vs.length>=0.6?T(' (συνήθως ως 0,7)',' (usually up to 0.7)'):''),vs.length,N]); }
  /* ώρα */
  var ar=G.map(function(d){ return d.afterRise; }).filter(function(x){ return x!=null; });
  if(ar.length>=2){ var early=ar.filter(function(x){ return x<=1.5; }).length, mid=ar.filter(function(x){ return x>3&&x<=7; }).length, t0=G.map(function(d){ return d.t0; }).filter(function(x){ return x!=null; });
    var tx=early/ar.length>=0.6?T('πολύ νωρίς, μέσα στην πρώτη ώρα από την ανατολή','very early, within the first hour after sunrise'):mid/ar.length>=0.6?T('αργά το πρωί, 3–7 ώρες μετά την ανατολή','late morning, 3–7 hours after sunrise'):T('διάφορες ώρες','various times');
    out.push([T('Ώρα','Time'),tx+' ('+(Math.min.apply(null,t0)===Math.max.apply(null,t0)?hm(t0[0]):hm(Math.min.apply(null,t0))+'–'+hm(Math.max.apply(null,t0)))+')',early/ar.length>=0.6?early:mid/ar.length>=0.6?mid:ar.length,ar.length]); }
  /* σελήνη */
  var il=G.map(function(d){ return d.illum; }).filter(function(x){ return x!=null; });
  if(il.length>=2){ var nw=il.filter(function(x){ return x<0.15; }).length, fl=il.filter(function(x){ return x>0.85; }).length;
    out.push([T('Σελήνη','Moon'),nw/il.length>=0.6?T('κοντά στη νέα σελήνη','near the new moon'):fl/il.length>=0.6?T('κοντά στην πανσέληνο','near the full moon'):(nw?nw+T(' κοντά στη νέα σελήνη, οι άλλες σε άλλες φάσεις',' near the new moon, the rest in other phases'):T('διάφορες φάσεις (χωρίς κάτι κοινό)','various phases (no common pattern)')),nw/il.length>=0.6?nw:fl/il.length>=0.6?fl:il.length,il.length]); }
  /* παλίρροια */
  var td=mode(G.map(function(d){ return d.tide&&d.tide.v; })), tk=G.filter(function(d){ return d.tide; }).length;
  if(td&&tk>=3&&td.n/tk>=0.75) out.push([T('Στάθμη θάλασσας','Tide'),TIDE[td.v]||td.v,td.n,tk]);
  /* δόλωμα, τεχνική, βάθος */
  var bt=mode(G.map(function(d){ return d.bait&&d.bait.v; })), bk=G.filter(function(d){ return d.bait&&d.bait.v; }).length;
  if(bt&&bk>=2&&bt.n/bk>=0.5) out.push([T('Δόλωμα','Bait'),bt.v,bt.n,bk]);
  var tc=mode(G.map(function(d){ return d.tech&&d.tech.v; })), tck=G.filter(function(d){ return d.tech&&d.tech.v; }).length;
  if(tc&&tck>=2&&tc.n/tck>=0.5) out.push([T('Τεχνική','Technique'),EN&&TECHN[tc.v]?TECHN[tc.v]:tc.v,tc.n,tck]);
  var dp=G.map(function(d){ return d.depth; }).filter(function(x){ return x!=null; });
  if(dp.length>=2){ var U=window.AlkyonUnits, un='m', D=function(m){ try{ if(U&&U.depthOut){ un=U.depthUnit?U.depthUnit():'m'; return Math.round(U.depthOut(m)); } }catch(e){} return Math.round(m); };
    var d0=D(Math.min.apply(null,dp)), d1=D(Math.max.apply(null,dp)); out.push([T('Βάθος','Depth'),(d0===d1?d1:d0+'–'+d1)+' '+un,dp.length,N]); }
  return out;
}
function group(title,G){
  var spc={}; G.forEach(function(d){ (d.sp||[]).forEach(function(s){ spc[s]=(spc[s]||0)+1; }); });
  var sp=Object.keys(spc).sort(function(a,b){ return spc[b]-spc[a]; }).slice(0,4);
  var box=h('div',{class:'cmgrp'},h('h3',{class:'listh',text:title+' · '+G.length+(G.length===1?T(' μέρα',' day'):T(' μέρες',' days'))}),
    sp.length?h('p',{class:'sub',style:{margin:'-2px 0 6px'},text:sp.join(', ')}):null);
  traits(G).forEach(function(r){ box.append(h('div',{class:'lyrow'},h('b',{text:r[0]}),h('span',{class:'cmv',text:r[1]}),h('small',{class:'cmn',text:r[2]+'/'+r[3]}))); });
  return box;
}
B.commonCard=function(){
  var D=days(); if(D.length<2) return null;
  var big=D.filter(function(d){ return d.kgMax!=null&&d.kgMax>=2.5; }), small=D.filter(function(d){ return !(d.kgMax!=null&&d.kgMax>=2.5); });
  var c=h('section',{class:'card lycard cmcard'},h('h2',{text:T('Τι κοινό είχαν τα ψαρέματά σου','What your fishing days had in common')}),
    h('p',{class:'sub',text:T('Από τις συνθήκες που κράτησε η εφαρμογή σε κάθε ψάρι. Ο αριθμός δεξιά λέει σε πόσες μέρες ισχύει.','From the conditions the app saved with each catch. The number on the right says on how many days it holds.')}));
  if(big.length>=2&&small.length>=2){ c.append(group(T('Μεγάλα ψάρια (από 2,5 kg)','Big fish (2.5 kg and up)'),big)); c.append(group(T('Μικρότερα ψάρια','Smaller fish'),small)); }
  else c.append(group(T('Μέρες με ψάρια','Days with catches'),D));
  /* σύγκριση με εξόδους χωρίς ψάρι */
  var E=emptyTrips();
  if(E.length>=2){ var pt=mode(E.map(function(t){ return t.cond0&&t.cond0.ptrend; })), ws=E.map(function(t){ return t.cond0&&num(t.cond0.wind); }).filter(function(x){ return x!=null; });
    c.append(h('div',{class:'cmgrp'},h('h3',{class:'listh',text:T('Έξοδοι χωρίς ψάρι · ','Trips with no catch · ')+E.length}),
      pt?h('div',{class:'lyrow'},h('b',{text:T('Πίεση','Pressure')}),h('span',{class:'cmv',text:PT[pt.v]||pt.v}),h('small',{class:'cmn',text:pt.n+'/'+E.length})):null,
      ws.length?h('div',{class:'lyrow'},h('b',{text:T('Άνεμος','Wind')}),h('span',{class:'cmv',text:Math.round(Math.min.apply(null,ws))+'–'+Math.round(Math.max.apply(null,ws))+' kn'}),h('small',{class:'cmn',text:ws.length+'/'+E.length})):null)); }
  c.append(h('p',{class:'foot',text:T('Λέει τι είχαν κοινό οι μέρες που έπιασες, όχι γιατί τσίμπησαν. Για το «γιατί» χρειάζονται και οι έξοδοι χωρίς ψάρι','It says what your catch days had in common, not why fish bit. For the “why”, trips with no catch are needed too')+(E.length<2?T(' (καταγράφεις μία με «Ξεκινώ» και «Τέλος», ακόμα κι όταν δεν πιάσεις τίποτα).',' (log one with Start and End even when you catch nothing).'):'.')+' '+T('Με ','Based on ')+D.length+T(' μέρες: όσο περισσότερες, τόσο πιο σίγουρο.',' days: the more, the surer.')}));
  return c;
};
})();
