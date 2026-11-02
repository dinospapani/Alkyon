/* Alkyon 4 · Μεγάλα κουμπιά κατά την έξοδο (v31z545)
   Για βρεγμένα χέρια, γάντια και κύμα: μία οθόνη με 4 μεγάλα κουμπιά (Ψάρι, Χάθηκε, Λαγοκέφαλος, MOB) και τα βασικά
   (ώρα, ώρα επιστροφής, απόσταση από το λιμάνι, άνεμος). Το «Ψάρι» καταγράφεται αμέσως· το είδος συμπληρώνεται μετά από το Ημερολόγιο.
   Το MOB θέλει παρατεταμένο πάτημα (1 δευτ.), για να μη γίνεται κατά λάθος. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls, el=null, tm=null;
function tripOn(){ try{ return !!(B.trip&&B.trip.active()); }catch(e){ return false; } }
function hm(ms){ var d=new Date(ms); return B.pad(d.getHours())+':'+B.pad(d.getMinutes()); }
function km(a,b,c,d){ var r=Math.PI/180, x=(d-b)*r*Math.cos((a+c)/2*r), y=(c-a)*r; return Math.sqrt(x*x+y*y)*6371; }
function info(){ var out=[], now=Date.now(), s=null; try{ s=B.trip.state(); }catch(e){}
  out.push([hm(now),T('ώρα','time')]);
  if(s&&s.due){ var m=Math.round((s.due-now)/60000); out.push([hm(s.due),m>=0?T('επιστροφή · σε ','back · in ')+(m>=60?Math.floor(m/60)+T('ω ','h ')+(m%60)+'′':m+'′'):T('πέρασε η ώρα επιστροφής','past return time')]); }
  try{ var sm=B.smart&&B.smart.state(), p=B.lastPos(); if(sm&&sm.home&&p){ var d=km(p.lat,p.lon,sm.home.lat,sm.home.lon)*1.1, nm=d/1.852, eta=nm/(sm.cruise||15)*60; out.push([nm<10?B.num(nm,1)+' nm':Math.round(nm)+' nm',T('λιμάνι · ~','port · ~')+Math.max(1,Math.round(eta))+'′']); } }catch(e){}
  try{ var fc=(ls.get('alkyon-fc7',null)||{}).fc, d0=new Date(), td=d0.getFullYear()+'-'+B.pad(d0.getMonth()+1)+'-'+B.pad(d0.getDate()), q=null;
    (fc&&fc.days||[]).forEach(function(d){ if(d.date===td) (d.hours||[]).forEach(function(x){ if(x.hr===d0.getHours()) q=x; }); });
    if(q&&q.wind!=null){ var U=window.AlkyonUnits; out.push([U&&U.windP?U.windP(q.wind)[0]+' '+U.windP(q.wind)[1]:Math.round(q.wind)+' kn',T('άνεμος','wind')+(q.wave!=null?' · '+B.num(q.wave,1)+' m':'')]); } }catch(e){}
  return out; }
function counts(){ try{ return B.tripCounts(); }catch(e){ return {n:0,miss:0,pest:0}; } }
function hold(btn,ms,fn){ var t=null; btn.addEventListener('pointerdown',function(){ btn.classList.add('hold'); clearTimeout(t); t=setTimeout(function(){ btn.classList.remove('hold'); fn(); },ms); });
  ['pointerup','pointerleave','pointercancel'].forEach(function(e){ btn.addEventListener(e,function(){ clearTimeout(t); btn.classList.remove('hold'); }); }); btn.addEventListener('contextmenu',function(e){ e.preventDefault(); }); }
function paint(){ if(!el) return; var c=counts(), ib=el.querySelector('.btinfo'); ib.replaceChildren.apply(ib,info().map(function(x){ return h('div',null,h('b',{text:x[0]}),h('small',{text:x[1]})); }));
  el.querySelector('.bt-fish b').textContent=c.n; el.querySelector('.bt-miss b').textContent=c.miss; el.querySelector('.bt-pest b').textContent=c.pest||0; }
function flash(btn){ btn.classList.add('ok'); setTimeout(function(){ btn.classList.remove('ok'); },500); setTimeout(paint,300); }
function open(){
  if(el) return; if(!tripOn()){ B.toast(T('Ξεκίνα πρώτα έξοδο.','Start a trip first.')); return; }
  var X='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var fish=h('button',{type:'button',class:'btb bt-fish'},h('span',{class:'bti',text:'🐟'}),h('span',{text:T('Ψάρι','Fish')}),h('b',{text:'0'}));
  var miss=h('button',{type:'button',class:'btb bt-miss'},h('span',{class:'bti',text:'✕'}),h('span',{text:T('Χάθηκε','Lost')}),h('b',{text:'0'}));
  var pest=h('button',{type:'button',class:'btb bt-pest'},h('span',{class:'bti',text:'🐡'}),h('span',{text:T('Λαγοκέφαλος','Toadfish')}),h('b',{text:'0'}));
  var mob=h('button',{type:'button',class:'btb bt-mob'},h('span',{class:'bti',text:'MOB'}),h('span',{text:T('Κράτα πατημένο','Press and hold')}));
  fish.addEventListener('click',function(){ B.quickRec(false,null,null,true); try{ navigator.vibrate&&navigator.vibrate(40); }catch(e){} flash(fish); });
  miss.addEventListener('click',function(){ B.quickRec(true,null,null,true); try{ navigator.vibrate&&navigator.vibrate(40); }catch(e){} flash(miss); });
  pest.addEventListener('click',function(){ if(B.quickPest) B.quickPest('fish',null); flash(pest); });
  hold(mob,900,function(){ if(B.mob) B.mob(); flash(mob); });
  el=h('div',{class:'bigtrip',role:'dialog','aria-modal':'true','aria-label':T('Μεγάλα κουμπιά','Big buttons')},
    h('div',{class:'bthead'},h('b',{text:T('Έξοδος','Trip')}),h('button',{type:'button',class:'btx','aria-label':T('Κλείσιμο','Close'),html:X,onclick:close})),
    h('div',{class:'btinfo'}),h('div',{class:'btgrid'},fish,miss,pest,mob),
    /* v31z550: φωνή — «τρία λαβράκια ενάμισι κιλό με γαρίδα», «χάθηκε», «λαγοκέφαλος» */
    B.voice&&B.voice.ok?h('button',{type:'button',class:'btb bt-voice',onclick:function(){ B.voice.log(); }},h('span',{class:'bti',html:B.voice.MIC}),h('span',{text:T('Πες το: «λαβράκι δύο κιλά»','Say it: “sea bass two kilos”')})):null,
    h('p',{class:'btfoot',text:T('Το είδος και οι λεπτομέρειες συμπληρώνονται μετά από το Ημερολόγιο ή με τη φωνή. Κράτα πατημένο το MOB για 1 δευτερόλεπτο.','Species and details are added later from the Logbook or by voice. Hold MOB for 1 second.')}));
  document.body.append(el); document.body.classList.add('btopen'); paint(); tm=setInterval(paint,20000);
  B.on&&B.on('trip',paint); ls.set('alkyon-v4-bigtrip',true);
}
function close(){ if(!el) return; el.remove(); el=null; clearInterval(tm); document.body.classList.remove('btopen'); ls.set('alkyon-v4-bigtrip',false); }
B.bigTrip={open:open,close:close};
/* κλείνει μόνο του όταν τελειώσει η έξοδος */
try{ new MutationObserver(function(){ if(el&&!tripOn()) close(); }).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){}
})();
