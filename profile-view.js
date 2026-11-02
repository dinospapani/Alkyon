/* Προφίλ: κύρια όψη με στατιστικά (28 ημέρες / έτος / όλα) και κουμπί ρυθμίσεων (⚙) που ανοίγει τις παλιές ρυθμίσεις. */
(function(){
'use strict';
var C=window.AlkyonCore, $=function(i){ return document.getElementById(i); }; if(!C||!$('pMain')) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var range=C.lsGet('alkyon-prange','28');
var view='stats';
function setView(v){ view=v; $('pMain').hidden=v!=='stats'; $('pSettings').hidden=v!=='set'; var pt=$('pTackle'); if(pt) pt.hidden=v!=='tackle'; var gd=$('tab-guide'); if(gd){ var pg=$('pGuide'); if(pg&&gd.parentNode!==pg) pg.appendChild(gd); gd.hidden=v!=='guide'; if(pg) pg.hidden=v!=='guide'; }
  Array.prototype.forEach.call(document.querySelectorAll('#pSeg button'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.p===v)); });
  try{ $('profile').scrollTop=0; }catch(e){} try{ window.dispatchEvent(new CustomEvent('alkyon-pview',{detail:v})); }catch(e){} }
function showSet(on){ setView(on?'set':'stats'); }
window.AlkyonProfView={get:function(){ return view; },set:setView};
(function(){ var ph=document.querySelector('#profile .phead'); if(!ph||$('pSeg')) return;
  var sg=document.createElement('div'); sg.className='seg'; sg.id='pSeg'; sg.setAttribute('role','group'); sg.style.margin='8px 0';
  [['stats',T('Στατιστικά','Stats')],['tackle',T('Εξοπλισμός','Tackle')],['guide',T('Οδηγός','Guide')],['set',T('Ρυθμίσεις','Settings')]].forEach(function(x){ var b=document.createElement('button'); b.type='button'; b.dataset.p=x[0]; b.textContent=x[1]; b.setAttribute('aria-pressed',String(x[0]==='stats')); b.addEventListener('click',function(){ setView(x[0]); if(x[0]==='stats') draw(); }); sg.append(b); });
  ph.parentNode.insertBefore(sg,ph.nextSibling);
  var tk=document.createElement('div'); tk.id='pTackle'; tk.hidden=true; $('pMain').parentNode.insertBefore(tk,$('pSettings'));
  var gw=document.createElement('div'); gw.id='pGuide'; gw.hidden=true; $('pMain').parentNode.insertBefore(gw,$('pSettings')); var gd0=$('tab-guide'); if(gd0){ gw.appendChild(gd0); gd0.hidden=true; var gr=gd0.querySelector(':scope>.row'); if(gr) gr.style.display='none'; }
  var bk=$('pBackMain'); if(bk&&bk.parentNode) bk.parentNode.style.display='none';
})();
function hrs(ms){ return Math.round(ms/360000)/10; }
function draw(){
  var box=$('pStats'); if(!box) return; box.replaceChildren();
  Array.prototype.forEach.call(document.querySelectorAll('#pRange button'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.r===range)); });
  var now=C.nicosiaToday(), y=+now.slice(0,4), lim=null;
  if(range==='28'){ var d=new Date(Date.now()-27*86400000+C.utcMin()*60000); lim=d.toISOString().slice(0,10); }
  else if(range==='year') lim=y+'-01-01';
  var R=window.AlkyonRange, cust=R&&R.active('prof');
  if(cust) Array.prototype.forEach.call(document.querySelectorAll('#pRange button'),function(b){ b.setAttribute('aria-pressed','false'); });
  var inR=cust?function(x){ return R.inR('prof',x); }:function(x){ return !lim||((x.date||'')>=lim); };
  var bites=(C.Store.act?C.Store.act():(C.Store.get('bites')||[])).filter(inR), pbites=(C.Store.pas?C.Store.pas():[]).filter(inR), trips=(C.Store.get('trips')||[]).filter(inR);
  var days={}; bites.forEach(function(b){ if(b.date) days[b.date]=1; }); trips.forEach(function(t){ if(t.date) days[t.date]=1; });
  var ms=0; trips.forEach(function(t){ if(t.startMs&&t.endMs) ms+=Math.max(0,t.endMs-t.startMs-(t.pauseMs||0)); });
  var kg=0, big=0, bigS='', sp={}, nf=0; bites.forEach(function(b){ var w=+b.kg||0; nf+=C.bc(b); kg+=b.rel?0:w; if(w>big&&C.bc(b)===1){ big=w; bigS=b.species||''; } if(b.species) sp[b.species]=1; });
  var miss=(C.Store.misses?C.Store.misses():[]).filter(inR).length, km=0; trips.forEach(function(t){ km+=+t.km||0; });
  var succ=(nf+miss)?Math.round(nf/(nf+miss)*100)+'%':'–';
var SV=function(d){ return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'; };
  var ICO={'🐟':SV('<path d="M2.5 12c2.8-4.2 7-5.5 11-3.2L19 6v12l-5.5-2.8c-4 2.3-8.2 1-11-3.2z"/><circle cx="8" cy="11" r=".7" fill="currentColor"/>'),'✕':SV('<path d="M6 6l12 12M18 6L6 18"/>'),'🎯':SV('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),'🎣':SV('<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 13a7 7 0 0014 0M8.5 10.5h7"/>'),'📅':SV('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),'⏱':SV('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 3h5"/>'),'↔':SV('<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),'⚖':SV('<path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6.5a2.8 2.8 0 005 0zM19 7l-2.5 6.5a2.8 2.8 0 005 0z"/>')};
  var tiles=[
    ['🐟',nf,T('Ψάρια που έπιασα','Fish caught')],['✕',miss,T('Τσίμπησαν και χάθηκαν','Bites lost')],['🎯',succ,T('Ποσοστό επιτυχίας','Catch rate')],
    ['🎣',trips.length,T('Έξοδοι','Trips')],['📅',Object.keys(days).length,T('Μέρες ψαρέματος','Days fishing')],['⏱',ms?hrs(ms)+' h':'–',T('Ώρες στη θάλασσα','Hours at sea')],
    ['↔',km?AlkyonUnits.dist(km):'–',T('Απόσταση','Distance')],['⚖',Math.round(kg*10)/10+' kg',T('Συνολικό βάρος','Total weight')]
  ];
  tiles.forEach(function(t){ var d=document.createElement('div'); d.className='pst'; var i=document.createElement('i'); i.innerHTML=ICO[t[0]]||''; var b=document.createElement('b'); b.textContent=String(t[1]); var s=document.createElement('span'); s.textContent=t[2]; d.append(i,b,s); box.append(d); });
  if(pbites.length){ var pk=0, pn=0; pbites.forEach(function(b){ pn+=C.bc(b); pk+=b.rel?0:(+b.kg||0); }); var g=document.createElement('div'); g.className='pst pwide'; g.innerHTML='<i>'+SV('<path d="M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>')+'</i>'; g.append(document.createTextNode(T('Εργαλεία (δίχτυ, παραγάδι): ','Gear (net, longline): ')+pn+T(pn===1?' ψάρι · ':' ψάρια · ',' fish · ')+Math.round(pk*10)/10+' kg')); box.append(g); }
  if(big>0){ var r=document.createElement('div'); r.className='pst pwide'; r.innerHTML='<i>'+SV('<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a3 3 0 003 3M16 6h4v1a3 3 0 01-3 3M12 13v4M8 20h8"/>')+'</i>'; r.append(document.createTextNode(T('Μεγαλύτερο ψάρι: ','Biggest fish: ')+big+' kg'+(bigS?' · '+bigS:'')+' · '+Object.keys(sp).length+T(' είδη',' species'))); box.append(r); }
}
document.querySelectorAll('#pRange button').forEach(function(b){ b.addEventListener('click',function(){ range=b.dataset.r; C.lsSet('alkyon-prange',range); if(window.AlkyonRange&&AlkyonRange.active('prof')) AlkyonRange.set('prof','',''); else draw(); }); });
if(window.AlkyonRange){ AlkyonRange.ui('prof',$('pRng'),false); window.addEventListener('alkyon-range',function(e){ if(e.detail&&e.detail.key==='prof') draw(); }); }
$('pBackMain').addEventListener('click',function(){ showSet(false); draw(); });
var gear=document.createElement('button'); gear.type='button'; gear.className='btn ghost sm'; gear.id='pGear'; gear.textContent='⚙'; gear.setAttribute('aria-label',T('Ρυθμίσεις','Settings'));
gear.addEventListener('click',function(){ showSet(true); }); gear.style.display='none';
/* Οδηγός: μέσα στο Προφίλ, στην ίδια γραμμή με τη «Χρονιά μου» */
setTimeout(function(){
  var ps=$('pStats'); if(!ps||$('pActs')) return;
  var row=document.createElement('div'); row.id='pActs'; row.className='pacts'; ps.parentNode.insertBefore(row,ps.nextSibling);
  var y=document.querySelector('#pMain .yrbtn'); if(y) row.append(y);
},400);
var gbp=$('gBackProf'); if(gbp) gbp.addEventListener('click',function(){ var pb=$('profBtn'); if(pb) pb.click(); });
/* Αν ο Οδηγός είναι ανοιχτός πίσω από το Προφίλ, το ✕ γυρνάει στην καρτέλα που ήσουν πριν */
function leaveGuide(){}
function fixG(){ var g=$('tab-guide'); if(!$('profile').hidden&&view==='guide'&&g&&g.hidden) g.hidden=false; }
new MutationObserver(function(){ fixG(); setTimeout(fixG,120); setTimeout(fixG,400); }).observe($('profile'),{attributes:true,attributeFilter:['hidden']});
$('pClose').addEventListener('click',leaveGuide);
$('profile').addEventListener('click',function(e){ if(e.target===this) leaveGuide(); });
var cl=$('pClose'); cl.parentNode.insertBefore(gear,cl); gear.style.marginLeft='auto'; cl.style.marginLeft='0';
/* επαγγελματικά εικονίδια: γρανάζι και ✕ σε στρογγυλά κουμπιά */
gear.className='pibtn'; gear.textContent=''; gear.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
gear.title=T('Ρυθμίσεις','Settings');
cl.className='pibtn'; cl.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'; cl.setAttribute('aria-label',T('Κλείσιμο','Close')); cl.title=T('Κλείσιμο','Close'); cl.style.marginLeft='0';
var gc=document.createElement('div'); gc.className='card setcard'; gc.id='pGpsCard';
gc.innerHTML='<label class="chk"><input type="checkbox" id="pGpsChk"><span><b></b><span class="note" style="display:block"></span></span></label>';
gc.querySelector('b').textContent=T('Καταγραφή διαδρομής GPS στις εξόδους','Record GPS route during trips');
gc.querySelector('.note').textContent=T('Αποθηκεύει απόσταση και διαδρομή στο παρασκήνιο, χωρίς να φαίνονται κατά την έξοδο. Καταναλώνει περισσότερη μπαταρία και δουλεύει μόνο όσο η εφαρμογή είναι ανοιχτή.','Saves distance and route in the background, hidden during the trip. Uses more battery and only works while the app is open.');
var sc=$('pSettings'), dg=$('dgCard'); sc.insertBefore(gc,dg||sc.children[1]);
var chk=gc.querySelector('input'); chk.checked=!window.AlkyonTrack||window.AlkyonTrack.enabled();
chk.addEventListener('change',function(){ if(window.AlkyonTrack) window.AlkyonTrack.setEnabled(chk.checked); });
var uc=document.createElement('div'); uc.className='card setcard'; uc.id='unitsCard';
var uh=document.createElement('b'); uh.textContent=T('Μονάδες μέτρησης','Units'); uc.append(uh);
var UL={wind:T('Άνεμος','Wind'),temp:T('Θερμοκρασία','Temperature'),press:T('Πίεση','Pressure'),wave:T('Κύμα','Waves'),dist:T('Απόσταση','Distance'),coord:T('Συντεταγμένες','Coordinates')};
Object.keys(UL).forEach(function(k){
  var row=document.createElement('div'); row.className='unrow';
  var l=document.createElement('span'); l.textContent=UL[k]; row.append(l);
  var seg=document.createElement('div'); seg.className='unseg';
  AlkyonUnits.options[k].forEach(function(o){
    var b=document.createElement('button'); b.type='button'; b.textContent=o[1]; b.setAttribute('aria-pressed',String(AlkyonUnits.cfg[k]===o[0]));
    b.addEventListener('click',function(){ AlkyonUnits.set(k,o[0]); seg.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed','false'); }); b.setAttribute('aria-pressed','true'); setTimeout(function(){ location.reload(); },350); });
    seg.append(b);
  });
  row.append(seg); uc.append(row);
});
/* v31z413: οι μονάδες εξοπλισμού (πριν ήταν ξεχωριστά στον Εξοπλισμό) */
(function(){ var get=function(){ var v=String(C.lsGet('alkyon-tk-units','g|kg|m')||'').split('|'); return {w:v[0]==='oz'?'oz':'g',d:v[1]==='lb'?'lb':'kg',l:v[2]==='yd'?'yd':'m'}; };
  var hh=document.createElement('div'); hh.className='unsub'; hh.textContent=T('Εξοπλισμός','Tackle'); uc.append(hh);
  [['w',T('Βάρος (ζόκες, καλάμια)','Weight (lures, rods)'),[['g','g'],['oz','oz']]],['d',T('Drag μουλινέ','Reel drag'),[['kg','kg'],['lb','lb']]],['l',T('Μήκος νήματος','Line length'),[['m','m'],['yd','yd']]]].forEach(function(q){
    var row=document.createElement('div'); row.className='unrow'; var l=document.createElement('span'); l.textContent=q[1]; row.append(l); var seg=document.createElement('div'); seg.className='unseg';
    q[2].forEach(function(o){ var b=document.createElement('button'); b.type='button'; b.textContent=o[1]; b.setAttribute('aria-pressed',String(get()[q[0]]===o[0]));
      b.addEventListener('click',function(){ var u=get(); u[q[0]]=o[0]; C.lsSet('alkyon-tk-units',u.w+'|'+u.d+'|'+u.l); seg.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed','false'); }); b.setAttribute('aria-pressed','true'); }); seg.append(b); });
    row.append(seg); uc.append(row); }); })();
sc.insertBefore(uc,gc.nextSibling);
var wantSet=false;
$('sfGoProf').addEventListener('click',function(){ wantSet=true; },true);
$('profBtn').addEventListener('click',function(){ setView(wantSet?'set':'stats'); wantSet=false; draw(); });
draw();
})();
