/* Alkyon 1.9.34 · Έξοδοι από τα ψάρια της ημέρας.
   Η προσωπική πρόγνωση και η σύγκριση «Alkyon ή μόνο σελήνη» μετρούν ψάρια ανά ώρα ψαρέματος, άρα χρειάζονται εξόδους με ώρα έναρξης και λήξης.
   Για τις μέρες που έχεις ψάρια με ώρα αλλά καμία έξοδο, προτείνει έξοδο (1 ώρα πριν το πρώτο ψάρι έως 1 ώρα μετά το τελευταίο)
   και σου ζητά να διορθώσεις τις ώρες στις πραγματικές. Τίποτα δεν αποθηκεύεται χωρίς το πάτημά σου. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN;
function S(){ return B.store; }
function bms(b){ return B.biteMs?B.biteMs(b):null; }
function hm(ms){ var d=new Date(ms); return B.pad(d.getHours())+':'+B.pad(d.getMinutes()); }
/* μέρες με ψάρια (με ώρα) που δεν πέφτουν μέσα σε καμία έξοδο */
function missing(){
  var trips=S().raw('trips').filter(function(t){ return !t.deleted&&t.startMs&&t.endMs; });
  var inTrip=function(ms){ return trips.some(function(t){ return ms>=t.startMs-600000&&ms<=t.endMs+600000; }); };
  var by={};
  S().raw('bites').forEach(function(b){ if(!b||b.deleted||b.gear||!b.date||!b.time) return; var ms=bms(b); if(ms==null||ms>Date.now()) return; if(inTrip(ms)) return;
    var o=by[b.date]||(by[b.date]={date:b.date,bites:[],first:ms,last:ms}); o.bites.push(b); if(ms<o.first) o.first=ms; if(ms>o.last) o.last=ms; });
  return Object.keys(by).sort().reverse().map(function(k){ var o=by[k], c=o.bites.filter(function(b){ return !b.miss&&!(B.pest&&B.pest(b)); });
    var ll=o.bites.filter(function(b){ return typeof b.lat==='number'&&typeof b.lon==='number'; });
    o.n=c.reduce(function(x,b){ return x+Math.max(1,Math.floor(+b.cnt)||1); },0);
    o.lat=ll.length?ll.reduce(function(x,b){ return x+b.lat; },0)/ll.length:null; o.lon=ll.length?ll.reduce(function(x,b){ return x+b.lon; },0)/ll.length:null;
    o.start=o.first-3600000; o.end=o.last+3600000; return o; });
}
function toMs(date,t){ var a=date.split('-').map(Number), p=String(t||'').split(':').map(Number); if(p.length<2||isNaN(p[0])) return null; return new Date(a[0],a[1]-1,a[2],p[0],p[1]).getTime(); }
function open(onDone){
  var M=missing().slice(0,40), rows=[], body=h('div',{class:'tfill'});
  if(!M.length){ B.toast(T('Όλα τα ψάρια σου ανήκουν ήδη σε έξοδο.','All your catches already belong to a trip.')); return; }
  body.append(h('p',{class:'sub',text:T('Για να μάθει η πρόγνωση πόσα ψάρια πιάνεις ανά ώρα, χρειάζεται και πόση ώρα ψάρευες. Διόρθωσε την ώρα που ξεκίνησες και σταμάτησες να ψαρεύεις. Αν δεν θυμάσαι, βγάλε το ✓ από τη μέρα.','To learn how many fish you catch per hour, the forecast needs how long you fished. Fix when you started and stopped fishing. If you do not remember, untick the day.')}));
  M.forEach(function(o){
    var on=h('input',{type:'checkbox',checked:true,'aria-label':T('Πρόσθεσε','Add')}), s0=h('input',{type:'time',value:hm(o.start)}), e0=h('input',{type:'time',value:hm(o.end)});
    var sp={}; o.bites.forEach(function(b){ if(b.species&&!b.miss) sp[b.species]=1; });
    body.append(h('label',{class:'tfr'},on,h('span',{class:'tfd'},h('b',{text:new Date(o.date+'T12:00:00').toLocaleDateString(EN?'en-GB':'el-GR',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}),
      h('small',{text:o.n+T(' ψάρια',' catches')+(Object.keys(sp).length?' · '+Object.keys(sp).slice(0,3).join(', '):'')+' · '+T('πρώτο ','first ')+hm(o.first)+', '+T('τελευταίο ','last ')+hm(o.last)})),
      h('span',{class:'tft'},s0,h('i',{text:'–'}),e0)));
    rows.push({o:o,on:on,s:s0,e:e0});
  });
  var save=h('button',{class:'btn pri',type:'button',text:T('Πρόσθεσε τις εξόδους','Add the trips'),onclick:function(){
    var n=0, bad=0;
    rows.forEach(function(r){ if(!r.on.checked) return; var st=toMs(r.o.date,r.s.value), en=toMs(r.o.date,r.e.value); if(st==null||en==null) { bad++; return; } if(en<=st) en+=86400000;
      if(st>r.o.first||en<r.o.last||en-st>16*3600000){ bad++; return; }
      var b0=r.o.bites[0]||{}, sp={}; r.o.bites.forEach(function(b){ if(b.species&&!b.miss) sp[b.species]=(sp[b.species]||0)+1; });
      S().save('trips',{date:r.o.date,spot:b0.place||'',species:Object.keys(sp).join(', '),count:r.o.n,startMs:st,endMs:en,lat:r.o.lat,lon:r.o.lon,
        cond0:{ptrend:b0.ptrend||null,wind:b0.wind!=null?+b0.wind:null,lat:r.o.lat,lon:r.o.lon},fromCatches:true,notes:T('Έξοδος από τα ψάρια της ημέρας (ώρες από σένα)','Trip from the day’s catches (times from you)')}); n++; });
    if(bad) B.toast(T('Κάποιες μέρες δεν μπήκαν: η έξοδος πρέπει να περιέχει όλα τα ψάρια της μέρας και να είναι έως 16 ώρες.','Some days were skipped: a trip must contain all of the day’s catches and be up to 16 hours.'));
    if(n) B.toast(T('Προστέθηκαν ','Added ')+n+T(' έξοδοι. Η προσωπική πρόγνωση τις μετρά από τώρα.',' trips. The personal forecast counts them from now.'));
    sh.close(true); if(onDone) onDone(n); }});
  body.append(h('div',{class:'acts'},save));
  var sh=B.sheet({title:T('Έξοδοι από τα ψάρια σου','Trips from your catches'),body:body});
}
/* μικρή κάρτα-πρόσκληση (για «Δικά μου» και το πλαίσιο της σελήνης) */
function card(onDone){ var M=missing(); if(!M.length) return null; var n=M.reduce(function(x,o){ return x+o.n; },0);
  return h('section',{class:'card tfcard'},h('h2',{text:T('Κάνε τα ψάρια σου να μετράνε','Make your catches count')}),
    h('p',{class:'sub',text:T('Έχεις ','You have ')+M.length+T(' μέρες με ',' days with ')+n+T(' ψάρια που δεν ανήκουν σε έξοδο. Πρόσθεσε πόση ώρα ψάρευες εκείνες τις μέρες και η προσωπική πρόγνωση θα μάθει από αυτά.',' catches that are not in a trip. Add how long you fished on those days and the personal forecast will learn from them.')}),
    h('button',{class:'btn pri',type:'button',text:T('Πρόσθεσε τις ώρες','Add the times'),onclick:function(){ open(onDone); }})); }
B.tripFill={missing:missing,open:open,card:card};
})();
