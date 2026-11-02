/* Στατιστικά προφίλ: 28 ημέρες / φέτος / όλα. Ψάρια, miss, ποσοστό επιτυχίας, χρόνος ψαρέματος, ημέρες, είδη, kg, μεγαλύτερο ψάρι. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C||!document.getElementById('kpiCard')) return;
var $=C.$, h=C.h, EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, KEY='alkyon-kpi';
var range='all'; try{ range=localStorage.getItem(KEY)||'all'; }catch(e){}
if(['28','year','all'].indexOf(range)<0) range='all';
function cutoff(){
  if(range==='all') return '';
  var p=C.nicosiaToday().split('-').map(Number);
  if(range==='year') return p[0]+'-01-01';
  return new Date(Date.UTC(p[0],p[1]-1,p[2]-27)).toISOString().slice(0,10);
}
function compute(){
  var co=cutoff(), inR=function(d){ return !co||(!!d&&d>=co); };
  var bites=C.Store.get('bites').filter(function(b){ return inR(b.date); });
  var miss=C.Store.misses().filter(function(b){ return inR(b.date); });
  var allT=C.Store.get('trips'), trips=allT.filter(function(t){ return inR(t.date); });
  var ms=0, sessCatch=0, days={}, sp={}, kg=0, big=null;
  trips.forEach(function(t){
    if(t.date) days[t.date]=1;
    if(t.startMs&&t.endMs&&t.endMs>t.startMs&&!t.manual){ var d=t.endMs-t.startMs-(t.pauseMs||0); if(d>0){ ms+=d; sessCatch+=C.tripEff(t,allT).count; } }
  });
  bites.forEach(function(b){
    if(b.date) days[b.date]=1;
    if(b.species) sp[b.species.trim().toLowerCase()]=1;
    kg+=+b.kg||0;
    if(+b.kg>0&&(!big||+b.kg>+big.kg)) big=b;
  });
  /* έξοδοι που γράφτηκαν με το χέρι (χωρίς ώρες), μόνο όταν δεν υπάρχουν τσιμπήματα εκείνης της ημέρας, ώστε να μη μετράμε διπλά */
  var bd={}; bites.forEach(function(b){ if(b.date) bd[b.date]=1; });
  var extra=0, extraKg=0;
  trips.forEach(function(t){ if((!t.startMs||t.manual)&&t.date&&!bd[t.date]){ extra+=+t.count||0; extraKg+=+t.kg||0; } });
  kg+=extraKg;
  var nb=0; bites.forEach(function(b){ nb+=C.bc?C.bc(b):1; });   /* v31z370: ψάρια, όχι καταχωρίσεις (μια καταχώριση μπορεί να έχει πολλά ψάρια) */
  var c=nb+extra, m=miss.length;
  return {c:c,m:m,succ:m>0?Math.round(c/(c+m)*100):null,ms:ms,days:Object.keys(days).length,sp:Object.keys(sp).length,kg:Math.round(kg*10)/10,
    rate:ms>=1800000?Math.round(sessCatch/(ms/3600000)*10)/10:null,big:big};
}
function cell(v,l,sub){ return h('div',{class:'kc'},h('b',{text:String(v)}),h('span',{class:'label',text:l}),sub?h('small',{text:sub}):null); }
function render(){
  var g=$('kpiGrid'); if(!g) return; var k=compute(); g.replaceChildren();
  g.append(
    cell(k.c,T('Ψάρια','Catches')),
    cell(k.m,'Miss'),
    cell(k.succ==null?'–':k.succ+'%',T('Επιτυχία','Success')),
    cell(k.ms?C.fmtDur(k.ms):'–',T('Χρόνος','Time')),
    cell(k.days,T('Ημέρες','Days')),
    cell(k.sp,T('Είδη','Species')),
    cell(k.kg.toFixed(1),'kg'),
    cell(k.rate==null?'–':k.rate,T('Ψάρια/ώρα','Fish/hour')),
    cell(k.big?(+k.big.kg).toFixed(1)+' kg':'–',T('Μεγαλύτερο','Biggest'),k.big?(k.big.species||''):''));
  $('kpiNote').textContent=k.m===0?T('Η επιτυχία υπολογίζεται όταν καταγράφεις και miss (ψάρι που χάθηκε ή τσίμπημα χωρίς ψάρι) με το κουμπί ✕ στη διάρκεια της εξόδου.','Success is calculated once you log misses (a lost fish or a bite with no catch) with the ✕ button during a trip.'):'';
  Array.prototype.forEach.call(document.querySelectorAll('#kpiRange .chip'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.r===range)); });
}
$('kpiRange').addEventListener('click',function(e){
  var b=e.target.closest('.chip'); if(!b) return; range=b.dataset.r;
  try{ localStorage.setItem(KEY,range); }catch(x){}
  render();
});
C.Store.on('bites',render); C.Store.on('trips',render);
render();
})();
