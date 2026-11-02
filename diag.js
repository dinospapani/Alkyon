/* Έλεγχος δεδομένων: βρίσκει ασυνέπειες στα τσιμπήματα και στις εξόδους και προσφέρει διόρθωση με ένα πάτημα. */
(function(){
'use strict';
var C=window.AlkyonCore, out=document.getElementById('dgOut'); if(!C||!out) return;
var h=C.h, $=C.$, EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var LEGACY=/Έναρξη\/Τέλος εξόδου|Start\/End trip/;
function bMs(b){ if(!b.date||!b.time) return null; var p=b.date.split('-').map(Number), q=b.time.split(':').map(Number); return Date.UTC(p[0],p[1]-1,p[2],q[0],q[1])-C.utcMin()*60000; }
function dayTotals(date,bites){ var n=0,kg=0,sp={}; bites.forEach(function(b){ if(b.date===date){ n++; kg+=+b.kg||0; if(b.species) sp[b.species]=(sp[b.species]||0)+1; } }); return {count:n,kg:Math.round(kg*10)/10,species:Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; })[0]||''}; }
function scan(){
  var bites=C.Store.get('bites')||[], trips=C.Store.get('trips')||[], issues=[], seen={};
  // 1. διπλά τσιμπήματα
  bites.slice().sort(function(a,b){ return (a._u||0)-(b._u||0); }).forEach(function(b){
    var k=[b.date,b.time,b.species||'',b.kg||'',typeof b.lat==='number'?b.lat.toFixed(3):'',typeof b.lon==='number'?b.lon.toFixed(3):''].join('|');
    if(seen[k]){ issues.push({txt:T('Διπλό τσίμπημα: ','Duplicate bite: ')+(b.date||'')+' '+(b.time||'')+' '+(b.species||'')+(b.kg?' '+b.kg+' kg':''),fix:T('Διαγραφή','Delete'),run:function(){ return C.Store.remove('bites',b.id); }}); } else seen[k]=1;
  });
  // 2. ενεργή έξοδος που ξεχάστηκε
  var st=window.AlkyonTrip&&window.AlkyonTrip.state(); 
  if(st&&st.active&&Date.now()-st.start>20*3600000) issues.push({txt:T('Η έξοδος είναι ενεργή εδώ και πάνω από 20 ώρες.','The trip has been active for over 20 hours.'),fix:T('Τέλος εξόδου','End trip'),run:function(){ return window.AlkyonTrip.endSilent(); }});
  // 3. έξοδοι με ώρες: υπερβολική διάρκεια ή επικάλυψη
  var S=trips.filter(function(t){ return t.startMs&&t.endMs; }).sort(function(a,b){ return a.startMs-b.startMs; });
  S.forEach(function(t,i){
    var hrs=(t.endMs-t.startMs)/3600000;
    if(hrs>16||hrs<=0) issues.push({txt:T('Έξοδος ','Trip ')+(t.date||'')+T(' με άκυρη διάρκεια (',' with invalid duration (')+Math.round(hrs*10)/10+' h)',fix:T('Διαγραφή','Delete'),run:function(){ return C.Store.remove('trips',t.id); }});
    else if(i>0&&S[i-1].endMs>t.startMs&&(S[i-1].endMs-S[i-1].startMs)/3600000<=16) issues.push({txt:T('Η έξοδος ','Trip ')+(t.date||'')+T(' επικαλύπτεται με την προηγούμενη.',' overlaps the previous one.'),fix:T('Διαγραφή της','Delete this one'),run:function(){ return C.Store.remove('trips',t.id); }});
  });
  // 4. παλιές αυτόματες έξοδοι (πριν το v25): διπλά ή λάθος σύνολα
  var legacy=trips.filter(function(t){ return !t.startMs&&LEGACY.test(t.notes||''); }), byDate={};
  legacy.forEach(function(t){ (byDate[t.date]=byDate[t.date]||[]).push(t); });
  Object.keys(byDate).forEach(function(d){
    var L=byDate[d].sort(function(a,b){ return (a._u||0)-(b._u||0); });
    L.slice(1).forEach(function(t){ issues.push({txt:T('Παλιά αυτόματη έξοδος ','Old automatic trip ')+d+T(' (πιθανό διπλότυπο, ',' (likely duplicate, ')+(t.count||0)+' / '+(+t.kg||0)+' kg)',fix:T('Διαγραφή','Delete'),run:function(){ return C.Store.remove('trips',t.id); }}); });
    var t0=L[0], tot=dayTotals(d,bites);
    if((+t0.count||0)!==tot.count||Math.abs((+t0.kg||0)-tot.kg)>0.05) issues.push({txt:T('Η έξοδος ','Trip ')+d+T(' γράφει ',' says ')+(t0.count||0)+' / '+(+t0.kg||0)+' kg, '+T('τα τσιμπήματα της ημέρας είναι ','the day\'s bites are ')+tot.count+' / '+tot.kg+' kg',fix:T('Διόρθωση σε ','Set to ')+tot.count+' / '+tot.kg+' kg',run:function(){ return C.Store.save('trips',Object.assign({},t0,{count:tot.count,kg:tot.kg,species:tot.species||t0.species})); }});
  });
  return issues;
}
function render(issues,ran){
  out.replaceChildren();
  if(!issues.length){ out.append(h('p',{class:'dgok',text:ran?T('Όλα εντάξει: δεν βρέθηκε κάτι.','All good: nothing found.'):''})); return; }
  out.append(h('p',{class:'note',text:T('Βρέθηκαν ','Found ')+issues.length+T(' θέματα.',' issue(s).')}));
  issues.forEach(function(it){
    var b=h('button',{class:'btn ghost sm',type:'button',text:it.fix});
    b.addEventListener('click',function(){ b.disabled=true; Promise.resolve(it.run()).then(function(){ render(scan(),true); }); });
    out.append(h('div',{class:'dgrow'},h('span',{text:it.txt}),b));
  });
  if(issues.length>1){ var all=h('button',{class:'btn sm',type:'button',style:'margin-top:8px',text:T('Διόρθωση όλων','Fix all')});
    all.addEventListener('click',async function(){ if(!(await window.AlkyonAsk(T('Να εφαρμοστούν όλες οι διορθώσεις;','Apply all fixes?'),{title:T('Διόρθωση όλων','Fix all'),ok:T('Εφαρμογή','Apply')}))) return; all.disabled=true;
      var pass=function(n){ var L=scan(); if(!L.length||n>3) return render(scan(),true); var chain=Promise.resolve(); L.forEach(function(it){ chain=chain.then(function(){ return it.run(); }); }); return chain.then(function(){ return pass(n+1); }); };
      pass(0); });
    out.append(all); }
}
$('dgRun').addEventListener('click',function(){ render(scan(),true); });
window.AlkyonDiag={scan:scan};
})();
