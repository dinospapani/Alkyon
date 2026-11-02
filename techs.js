/* Τεχνικές ψαρέματος: λίστα angling + δικές σου τεχνικές */
(function(){
'use strict';
var EN=window.LANG==='en';
function T(el,en){ return EN?en:el; }
var ANG=[
 ['Καθετή / βυθός',[['Βυθού','Bottom fishing'],['Καθετή ρηχή','Shallow vertical'],['Καθετή βαθιά','Deep vertical']]],
 ['Συρτή',[['Τρόλινγκ','Trolling'],['Συρτή αφρού','Surface trolling'],['Συρτή βυθού','Deep / bottom trolling']]],
 ['Jigging',[['Jigging','Jigging'],['Slow jigging','Slow jigging']]],
 ['Ιαπωνικές',[['Tai Rubber','Tai Rubber'],['Tenya','Tenya'],['Ika Metal','Ika Metal']]],
 ['Άλλες',[['Καλαμαριέρα','Squid jigging'],['Spinning','Spinning'],['Ζωντανό δόλωμα','Live bait'],['Drifting','Drifting'],['Με πλωτήρα','Float fishing'],['Light / ultralight','Light / ultralight']]]
];
/* Ομάδες ανά τύπο ψαρέματος (προφίλ). Η επιλογή γίνεται στα Settings. */
var SHORE=['Από στεριά',[['Surf casting','Surf casting'],['Spinning από στεριά','Shore spinning'],['Βυθού από στεριά','Shore bottom fishing'],['Με πλωτήρα από στεριά','Shore float fishing'],['Καλαμαριέρα από στεριά','Shore squid jigging']]];
var LAKE=['Λίμνη / φράγμα',[['Με πλωτήρα','Float fishing'],['Βυθού με δόλωμα','Bottom with bait'],['Spinning','Spinning'],['Ζωντανό δόλωμα','Live bait'],['Fly fishing','Fly fishing'],['Feeder / ποντίκι','Feeder']]];
var SPEAR=['Ψαροντούφεκο',[['Αναμονή','Ambush (hovering)'],['Περιπλάνηση','Searching / roaming'],['Τρύπες και φωλιές','Holes and ledges'],['Βαθιά κατάδυση','Deep dive']]];
var PROFILES={
  boat:function(a){ return a; },
  shore:function(a){ return [SHORE].concat(a.filter(function(g){ return g[0]==='Άλλες'||g[0]==='Jigging'||g[0]==='Καθετή / βυθός'; })); },
  lake:function(a){ return [LAKE]; },
  spear:function(a){ return [SPEAR]; }
};
function prof(){ try{ var p=localStorage.getItem('alkyon-fprof'); return PROFILES[p]?p:'boat'; }catch(e){ return 'boat'; } }
var PAS=[['Δίχτυ','Net'],['Παραγάδι','Longline'],['Ζεμπίλι / παγίδα','Pot / trap']];
var KEY='alkyon-customtech', NEW='__new__';
function load(){ try{ var a=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function save(a){ try{ localStorage.setItem(KEY,JSON.stringify(a)); }catch(e){} }
function opt(v,t){ var o=document.createElement('option'); o.value=v; o.textContent=t||v; return o; }
function known(v){ var f=false; ANG.concat([SHORE,LAKE,SPEAR]).forEach(function(g){ g[1].forEach(function(x){ if(x[0]===v) f=true; }); }); PAS.forEach(function(x){ if(x[0]===v) f=true; }); return f||v==='Άλλο'||load().indexOf(v)>=0; }

function build(sel,passive){
  var cur=sel.value;
  sel.replaceChildren();
  PROFILES[prof()](ANG).forEach(function(g){
    var og=document.createElement('optgroup'); og.label=T(g[0],{'Καθετή / βυθός':'Vertical / bottom','Συρτή':'Trolling','Jigging':'Jigging','Ιαπωνικές':'Japanese','Άλλες':'Other','Από στεριά':'From shore','Λίμνη / φράγμα':'Lake / dam','Ψαροντούφεκο':'Spearfishing'}[g[0]]);
    g[1].forEach(function(x){ og.appendChild(opt(x[0],EN?x[1]:x[0])); });
    sel.appendChild(og);
  });
  var cu=load();
  if(cu.length){ var oc=document.createElement('optgroup'); oc.label=T('Δικές μου','My techniques'); cu.forEach(function(x){ oc.appendChild(opt(x)); }); sel.appendChild(oc); }
  if(passive){ var op=document.createElement('optgroup'); op.label=T('Στατικά εργαλεία','Passive gear'); PAS.forEach(function(x){ op.appendChild(opt(x[0],EN?x[1]:x[0])); }); sel.appendChild(op); }
  sel.appendChild(opt('Άλλο',T('Άλλο','Other')));
  sel.appendChild(opt(NEW,T('＋ Νέα τεχνική…','＋ New technique…')));
  if(cur&&known(cur)) sel.value=cur;
}
function wire(id,passive){
  var sel=document.getElementById(id); if(!sel) return;
  build(sel,passive);
  /* τιμές που δεν υπάρχουν στη λίστα (παλιές εγγραφές) προστίθενται, ώστε το edit να μην τις χάνει */
  var d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
  Object.defineProperty(sel,'value',{configurable:true,get:function(){ return d.get.call(sel); },set:function(v){
    if(v&&v!==NEW&&!Array.prototype.some.call(sel.options,function(o){ return o.value===v; })) sel.insertBefore(opt(v),sel.querySelector('option[value="Άλλο"]'));
    d.set.call(sel,v||'');
    if(!v) sel.selectedIndex=-1;
  }});
  var row=document.createElement('div'); row.className='row techadd'; row.hidden=true; row.style.cssText='margin-top:6px;gap:6px';
  var inp=document.createElement('input'); inp.type='text'; inp.maxLength=40; inp.placeholder=T('Όνομα τεχνικής','Technique name'); inp.style.flex='1';
  var ok=document.createElement('button'); ok.type='button'; ok.className='btn acc sm'; ok.textContent=T('Προσθήκη','Add');
  var no=document.createElement('button'); no.type='button'; no.className='btn ghost sm'; no.textContent='✕';
  row.append(inp,ok,no); sel.parentNode.appendChild(row);
  var prev=sel.value;
  function close(back){ row.hidden=true; inp.value=''; if(back){ d.set.call(sel,prev&&known(prev)?prev:'Βυθού'); } }
  function add(){
    var v=inp.value.trim().replace(/\s+/g,' ');
    if(!v){ inp.focus(); return; }
    var cu=load(); if(cu.map(function(x){return x.toLowerCase();}).indexOf(v.toLowerCase())<0&&!known(v)){ cu.push(v); save(cu); }
    ['bTech','tTech'].forEach(function(i){ var s=document.getElementById(i); if(s&&s!==sel){ var c=s.value; build(s,i==='tTech'); if(c&&known(c)) d.set.call(s,c); } });
    build(sel,passive);
    var m=Array.prototype.filter.call(sel.options,function(o){ return o.value.toLowerCase()===v.toLowerCase(); })[0];
    d.set.call(sel,m?m.value:v); prev=sel.value; close(false);
  }
  sel.addEventListener('change',function(){ if(sel.value===NEW){ row.hidden=false; setTimeout(function(){ inp.focus(); },30); } else { prev=sel.value; row.hidden=true; } });
  ok.addEventListener('click',add); no.addEventListener('click',function(){ close(true); });
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); add(); } else if(e.key==='Escape'){ e.stopPropagation(); close(true); } });
}
wire('bTech',false); wire('tTech',true);
function rebuildAll(){ [['bTech',false],['tTech',true]].forEach(function(p){ var s=document.getElementById(p[0]); if(!s) return; var c=s.value; build(s,p[1]); var d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
  /* v31z407: μετά την αλλαγή τύπου ψαρέματος κρατιέται η τεχνική μόνο αν ανήκει στον νέο τύπο (όχι «Βυθού» στο ψαροντούφεκο) */
  var mine=[]; PROFILES[prof()](ANG).forEach(function(g){ g[1].forEach(function(x){ mine.push(x[0]); }); }); mine=mine.concat(load()); if(p[1]) PAS.forEach(function(x){ mine.push(x[0]); });
  if(c&&mine.indexOf(c)>=0) d.set.call(s,c);
  else { Array.prototype.slice.call(s.options).forEach(function(o){ if(o.value===c&&mine.indexOf(c)<0&&c!=='Άλλο') o.remove(); }); s.selectedIndex=0; } }); }
window.addEventListener('alkyon-fprof',rebuildAll);
window.AlkyonTechs={custom:load,rebuild:rebuildAll};
})();
