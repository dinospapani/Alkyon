/* v31z373 · Κοινός «χρονιστής»: σταματά όταν η εφαρμογή δεν φαίνεται (οθόνη κλειστή ή άλλη εφαρμογή) για λιγότερη μπαταρία.
   Και κοινή μνήμη για τις περιόδους σελήνης, ώστε να μην υπολογίζονται ξανά κάθε δευτερόλεπτο. */
window.ndEvery=function(fn,ms){ return setInterval(function(){ if(document.hidden) return; try{ fn(); }catch(e){} },ms); };
window.ndSol=(function(){ var cache={}; return function(t0,t1,lat,lon){ var k=Math.round(t0/600000)+'|'+Math.round(t1/600000)+'|'+(+lat).toFixed(2)+'|'+(+lon).toFixed(2); if(cache[k]) return cache[k];
  var r=[]; try{ r=window.PF&&window.PF.solunarPeriods?window.PF.solunarPeriods(t0,t1,lat,lon):[]; }catch(e){} var ks=Object.keys(cache); if(ks.length>40) cache={}; cache[k]=r; return r; }; })();
/* Νέα εμφάνιση: τα κουμπιά του χάρτη μαζεύονται σε 4 κουμπιά (Στρώματα, Ενέργειες, Ασφάλεια, Θέση μου) με φύλλα.
   Δεν αλλάζει λογική: μετακινεί τα ίδια τα υπάρχοντα κουμπιά, με τους ίδιους χειριστές.
   Διακόπτης: Προφίλ → Ρυθμίσεις → Εμφάνιση (κλειδί alkyon-ui: new ή old). */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, KEY='alkyon-ui';
var mode='new'; try{ if(C.lsGet(KEY,'new')==='old') C.lsSet(KEY,'new'); }catch(e){} /* μόνο η νέα εμφάνιση· ο διακόπτης αφαιρέθηκε */
function $(i){ return document.getElementById(i); }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
var SVG='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">';
var IC={
  layers:SVG+'<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/></svg>',
  actions:SVG+'<path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z"/></svg>',
  safety:SVG+'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/></svg>',
  me:SVG+'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  fish:SVG+'<path d="M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3Z"/><circle cx="8.5" cy="11" r="1"/></svg>',
  miss:SVG+'<path d="M6 6l12 12M18 6 6 18"/></svg>'
};

/* ---- διακόπτης εμφάνισης στις Ρυθμίσεις (υπάρχει και στις δύο καταστάσεις) ---- */
function addSwitch(){
  var ps=$('pSettings'); if(!ps||$('ndSw')) return;
  var card=el('div','card setcard'); card.id='ndSw';
  card.append(el('h3',null,T('Εμφάνιση','Appearance')));
  card.append(el('p','note',T('Η νέα εμφάνιση μαζεύει τα κουμπιά του χάρτη σε 4 με φύλλα. Όλες οι λειτουργίες μένουν ίδιες. Η αλλαγή ξαναφορτώνει την εφαρμογή.','The new look groups the map buttons into 4 with sheets. All functions stay the same. Changing reloads the app.')));
  var row=el('div','row'); row.style.marginTop='8px';
  [['new',T('Νέα εμφάνιση','New look')],['old',T('Παλιά εμφάνιση','Old look')]].forEach(function(x){
    var b=el('button','btn'+(mode===x[0]?' acc':' ghost'),x[1]); b.type='button'; b.setAttribute('aria-pressed',String(mode===x[0]));
    b.addEventListener('click',function(){ if(mode===x[0]) return; C.lsSet(KEY,x[0]); location.reload(); });
    row.append(b);
  });
  card.append(row); ps.append(card);
}
if(mode==='old') return;

/* ---- νέα εμφάνιση ---- */
var mb=document.querySelector('.mapbtns'), box=mb&&mb.parentNode; if(!mb||!box) return;
document.body.classList.add('nd');
var G={layers:['bLayer','bSea','bDepthMap','bSeaState','bWind','bWindSt','bZones','bNav','bMpa','bPorts','bDams','bHot','bOffline'],actions:['bQuick','bSpotPick','bScan','bGear','bTools']};
var TITLE={layers:T('Στρώματα','Layers'),actions:T('Ενέργειες','Actions'),safety:T('Ασφάλεια και θάλασσα','Safety and sea')};
var SUB={layers:T('Τι φαίνεται πάνω στο χάρτη','What shows on the map'),actions:T('Καταγραφή, εργαλεία και σημεία','Record, gear and spots'),safety:T('Λειτουργούν με GPS και ανοιχτή εφαρμογή. Δεν είναι ναυτικό όργανο.','Work with GPS and the app open. Not a navigation instrument.')};
function groupOf(id){ for(var k in G) if(G[k].indexOf(id)>=0) return k; return 'actions'; }

var sheet=el('div','ndsheet'); sheet.id='ndSheet'; sheet.hidden=true;
var back=el('div','ndback'), panel=el('div','ndpanel'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
var hand=el('span','ndhand'), head=el('div','ndhead'), ttl=el('h2',null,''), done=el('button','btn ghost sm','✕'); done.type='button'; done.setAttribute('aria-label',T('Τέλος','Done'));
var sub=el('p','note ndsub','');
head.append(ttl,done); panel.append(hand,head,sub);
var lists={};
Object.keys(G).forEach(function(g){ var l=el('div','ndlist'); l.dataset.g=g; l.hidden=true; lists[g]=l; panel.append(l); });
sheet.append(back,panel); document.body.append(sheet);

var secA=el('div','ndsec',T('Στρώματα χάρτη','Map layers')), secB=el('div','ndsec',T('Τι εμφανίζεται στον χάρτη','Shown on the map')); var tgRow=el('div','ndtogs'); lists.layers.append(tgRow);
var TG=[['alkyon-showbites',T('Ψάρια','Fish'),function(){ if(C.bitesVis) C.bitesVis(); }],['alkyon-showmiss',T('Χαμένα','Lost'),function(){ document.dispatchEvent(new Event('alkyon-spfilter')); }],['alkyon-showspots',T('Σημεία μου','My spots'),function(){ if(C.spotsVis) C.spotsVis(); }]];
TG.forEach(function(t){ var b=el('button','ndtog'); b.innerHTML='<i></i><span></span>'; b.lastChild.textContent=t[1]; b.type='button'; function sync(){ b.setAttribute('aria-pressed',String(C.lsGet(t[0],true)!==false)); } sync();
  b.addEventListener('click',function(){ C.lsSet(t[0],C.lsGet(t[0],true)===false); sync(); t[2](); }); b.dataset.k=t[0]; tgRow.append(b); });
/* v31z351: υπόμνημα για τα χρώματα των απαγορευμένων περιοχών */
var zl=null;
function zLeg(){
  if(zl) return zl; zl=el('div','ndzleg'); var Z=window.AlkyonZoneCols||{noentry:'#9f1239',nofish:'#e02020',season:'#e8890c'};
  [[Z.nofish,T('Απαγόρευση αλιείας','No fishing')],[Z.noentry,T('Ούτε διέλευση σκαφών','No boats allowed')],[Z.season,T('Εποχικός περιορισμός','Seasonal')]].forEach(function(x){ var sp=el('span'); var i=el('i'); i.style.color=x[0]; i.style.background=x[0]+'44'; sp.append(i,document.createTextNode(x[1])); zl.append(sp); });
  return zl;
}
/* v31z354: υπόμνημα συμβόλων ψαριών και σημείων */
var sl=null;
function symLeg(){
  if(sl) return sl; sl=el('div','ndsymleg');
  function grp(title,rows,sq){ var h=el('b',null,title); sl.append(h); rows.forEach(function(r){ var sp=el('span'), i=el('i',sq?'sq':''); i.style.color=r[0]; sp.append(i,document.createTextNode(r[1])); sl.append(sp); }); }
  grp(T('Ψάρια','Fish'),[['#8d5a2b',T('Σφυρίδες, ροφοί','Groupers')],['#3f78a8',T('Λαβράκια','Sea bass')],['#c59a12',T('Σαργοί, τσιπούρες, φαγκριά','Breams, dentex')],['#1d55c4',T('Πελαγικά (τόνος, μαγιάτικο, λίτσα)','Pelagics (tuna, amberjack)')],['#d9472b',T('Μπαρμπούνια','Red mullet')],['#8e44ad',T('Καλαμάρια, σουπιές, χταπόδια','Squid, cuttlefish, octopus')],['#2b8c7a',T('Άλλα','Other')]]);
  grp(T('Σημεία','Spots'),[['#b5532c',T('Βράχια / ύφαλος','Rocks / reef')],['#d9b44a',T('Άμμος','Sand')],['#37474f',T('Ναυάγιο','Wreck')],['#6d4c9f',T('Ταμπλά','Ledge')],['#1e88c9',T('Ρεύμα / ανοιχτά','Current / open')],['#2e7d4f',T('Λιμάνι / μώλος','Port / jetty')],['#e8743b',T('Άλλο','Other')]],true);
  return sl;
}
function syncTg(){ Array.prototype.forEach.call(tgRow.children,function(b){ b.setAttribute('aria-pressed',String(C.lsGet(b.dataset.k,true)!==false)); }); }
function open(g){
  if(g==='layers'){ lists.layers.insertBefore(secA,lists.layers.firstChild); lists.layers.append(secB); lists.layers.append(tgRow); lists.layers.append(zLeg()); lists.layers.append(symLeg()); syncTg(); }
  Object.keys(lists).forEach(function(k){ lists[k].hidden=(k!==g); });
  ttl.textContent=TITLE[g]; sub.textContent=SUB[g]; panel.setAttribute('aria-label',TITLE[g]);
  sheet.dataset.g=g; ed.hidden=(g==='safety'); sheet.hidden=false; document.body.classList.add('ndopen'); try{ done.focus({preventScroll:true}); }catch(e){}
}
function close(){ sheet.hidden=true; document.body.classList.remove('ndopen'); if(typeof setEdit==='function') setEdit(false); }
var ed=el('button','btn ghost sm ndedit','⚙'); ed.type='button'; ed.setAttribute('aria-pressed','false'); ed.setAttribute('aria-label',T('Προσαρμογή: διάλεξε ποια εργαλεία φαίνονται','Customize: choose which tools show'));
var editing=false, TKEY='alkyon-toolsoff';
function setEdit(v){ editing=v; sheet.classList.toggle('ndediting',v); ed.setAttribute('aria-pressed',String(v)); ed.textContent=v?'✓':'⚙'; sub.textContent=v?T('Πάτα ένα εργαλείο για να το κρύψεις ή να το εμφανίσεις.',''):SUB[sheet.dataset.g]||''; sub.style.display=v?'block':''; }
ed.addEventListener('click',function(){ setEdit(!editing); });
head.insertBefore(ed,done);
panel.addEventListener('click',function(e){
  if(!editing) return; var b=e.target.closest&&e.target.closest('.mbtn'); if(!b||b.id==='bQuick') return;
  e.stopPropagation(); e.preventDefault();
  var off=C.lsGet(TKEY,[]); if(!Array.isArray(off)) off=[]; var i=off.indexOf(b.id); if(i>=0) off.splice(i,1); else off.push(b.id);
  C.lsSet(TKEY,off); b.classList.toggle('tool-off',off.indexOf(b.id)>=0);
},true);
back.addEventListener('click',close); done.addEventListener('click',close);
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!sheet.hidden) close(); });
Object.keys(lists).forEach(function(g){
  lists[g].addEventListener('click',function(e){ if(g!=='layers'&&e.target.closest&&e.target.closest('.mbtn,.ndrow')) setTimeout(close,0); });
});

/* ενέργειες που δεν ήταν κουμπιά του χάρτη: ίδιες συναρτήσεις με πριν */
function proxy(g,label,icon,fn,first,tripHide){
  var b=el('button','ndrow'); if(tripHide) b.classList.add('ndnotrip'); b.type='button'; b.innerHTML=icon+'<span></span>'; b.lastChild.textContent=label; b.addEventListener('click',fn);
  if(first&&lists[g].firstChild) lists[g].insertBefore(b,lists[g].firstChild); else lists[g].append(b);
}

var SHOP='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9"/><path d="M5.5 12v8h13v-8"/></svg>';
proxy('actions',T('Κοντινά μαγαζιά ψαρικής','Nearby fishing stores'),SHOP,function(){ var b=$('sShops'); if(b) b.click(); },false);

proxy('actions',T('Πρόσθεσε ράμπα ή λιμάνι','Add a ramp or port'),SVG+'<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11Z"/><path d="M12 7.500v5M9.500 10h5"/></svg>',function(){ if(window.AlkyonPorts) AlkyonPorts.startAdd(); },false);

var KEEP={bLoc:1,bToolsCfg:1};
function adopt(b){
  if(!b||!b.classList||!b.classList.contains('mbtn')||KEEP[b.id]) return;
  var lab=b.getAttribute('aria-label')||b.title||b.id; try{ if(window.AlkyonTr) lab=window.AlkyonTr(lab); }catch(e){} b.dataset.nd=lab;
  var g=groupOf(b.id), ord=G[g]||[], i=ord.indexOf(b.id), lst=lists[g], nx=null;
  if(i>=0) nx=[].slice.call(lst.children).find(function(c){ return ord.indexOf(c.id)>i; })||null;
  if(nx) lst.insertBefore(b,nx); else lst.append(b); /* v31z351: σειρά όπως στη λίστα G */
}
Array.prototype.slice.call(mb.querySelectorAll('.mbtn')).forEach(adopt);
new MutationObserver(function(ms){ ms.forEach(function(m){ Array.prototype.forEach.call(m.addedNodes,adopt); }); }).observe(mb,{childList:true});

/* η δεξιά μπάρα: 4 κουμπιά */
var bar=el('div','ndbar'); bar.setAttribute('role','group'); bar.setAttribute('aria-label',T('Εργαλεία χάρτη','Map tools'));
var tools=el('div','ndtools'); tools.setAttribute('role','group'); tools.setAttribute('aria-label',T('Εργαλεία χάρτη','Map tools'));
function nb(label,icon,fn,host){ var b=el('button','ndb'); b.type='button'; b.innerHTML=icon+'<span></span>'; b.lastChild.textContent=label; b.addEventListener('click',fn); (host||bar).append(b); return b; }
nb(T('Στρώματα','Layers'),IC.layers,function(){ open('layers'); },tools);
nb(T('Ενέργειες','Actions'),IC.actions,function(){ open('actions'); },tools);
nb(T('Θέση','Position'),IC.me,function(){ var l=$('bLoc'); if(l) l.click(); },tools).classList.add('ndpos'); /* v31z351: χωρίς «Ασφάλεια»· τα εργαλεία της πήγαν σε Ενέργειες, Στρώματα και Ρυθμίσεις */
/* NU/CU/HU: ο προσανατολισμός του χάρτη ως εργαλείο της μπάρας (μόνο κατά την έξοδο), χρησιμοποιεί το ίδιο κουμπί #bOrient */
var orb=nb('NU',SVG+'<circle cx="12" cy="12" r="8.500"/><path d="m15.500 8.500-2 5-5 2 2-5z"/></svg>',function(){ var x=$('bOrient'); if(x) x.click(); });
orb.classList.add('ndorient'); orb.setAttribute('aria-label',T('Προσανατολισμός χάρτη','Map orientation'));
function orUpd(){ var x=$('bOrient'); if(!x) return; var m=x.textContent||'NU'; if(orb.lastChild.textContent!==m) orb.lastChild.textContent=m; orb.classList.toggle('on',x.classList.contains('on')); orb.title=x.title||''; }
window.ndEvery(orUpd,800); orUpd();
/* MOB και SOS μέσα στη μπάρα (μόνο κατά την έξοδο): χρησιμοποιούν τα ίδια κουμπιά και τις ίδιες λειτουργίες με πριν */
var sosb=nb('SOS',SVG+'<path d="M12 3.500 21.500 20h-19z"/><path d="M12 10v4.500M12 17.300v.01"/></svg>',function(){ var x=$('sosBtn'); if(x) x.click(); });
sosb.classList.add('ndsos'); sosb.setAttribute('aria-label',T('SOS: ειδοποίηση κινδύνου','SOS: distress alert'));
var mobb=nb('MOB',SVG+'<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3.500"/><path d="M6 6l3.500 3.500M14.500 14.500 18 18M18 6l-3.500 3.500M9.500 14.500 6 18"/></svg>',function(){});
mobb.classList.add('ndmob'); mobb.setAttribute('aria-label',T('Άνθρωπος στη θάλασσα (MOB)','Man overboard (MOB)')); bar.insertBefore(mobb,sosb); /* κάτω από «Θέση μου»: πρώτα MOB, μετά SOS */
/* MOB με παρατεταμένο πάτημα (1,5 δευτ.), ώστε να μη ενεργοποιείται κατά λάθος από κύμα ή βρεγμένα χέρια */
(function(){
  var HOLD=1500, tm=null, fired=false;
  mobb.setAttribute('aria-label',T('Άνθρωπος στη θάλασσα (MOB), κράτα πατημένο','Man overboard (MOB), press and hold'));
  function stop(){ clearTimeout(tm); tm=null; mobb.classList.remove('holding'); }
  function fire(){ fired=true; stop(); try{ navigator.vibrate&&navigator.vibrate([60,40,60]); }catch(e){} var x=$('bMob'); if(x) x.click(); }
  mobb.addEventListener('pointerdown',function(e){ fired=false; stop(); mobb.classList.add('holding'); tm=setTimeout(fire,HOLD); });
  ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ mobb.addEventListener(ev,function(){ if(tm){ stop(); if(ev==='pointerup'&&!fired) C.toast(T('Κράτα πατημένο το MOB 1,5 δευτ.','Hold MOB for 1.5 s')); } }); });
  mobb.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  /* το πληκτρολόγιο (Enter/Space) ενεργοποιεί αμέσως */
  mobb.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fire(); } });
})();
/* NU/CU/HU: μικρό κουμπί κάτω από το + / − του χάρτη (αριστερά), ώστε να μην πιάνει τη δεξιά πλευρά */
orb.classList.add('ndorin');
/* MOB και SOS: μικρά και διακριτικά, πάνω από τα «Χάρτης» (αριστερά) και «Προφίλ» (δεξιά), μόνο κατά την έξοδο */
mobb.classList.add('ndfloat','ndfl'); sosb.classList.add('ndfloat','ndfr'); box.append(mobb,sosb);
box.insertBefore(bar,mb.nextSibling);
/* τα υπόλοιπα εργαλεία σε πάνελ που κρύβεται δεξιά: λαβάκι, πάτημα ή σύρσιμο από τη δεξιά άκρη */
var hd=el('button','ndhandle'); hd.type='button'; hd.innerHTML=SVG+'<path d="m9 6 6 6-6 6"/></svg>'; tools.append(hd);
/* όργανα μέσα στο πάνελ: «Προορισμός» (όταν υπάρχει) και «Τώρα» (ταχύτητα, πορεία) */
(function(){
  var ins=el('div','ndins'), dg=el('div','ndgrp'), ng=el('div','ndgrp');
  function sec(t){ return el('div','ndsec',t); }
  function cell(l){ var c=el('div','ndc'); var b=document.createElement('b'); b.textContent='–'; var i=document.createElement('i'); i.textContent=l; c.append(b,i); c.v=b; return c; }
  var dd=cell(T('Απόσταση','Distance')), db=cell(T('Πορεία προς','Bearing to')), de=cell('ETA'), ns=cell(T('Ταχύτητα','Speed')), nc=cell(T('Πορεία','Course'));
  dd.classList.add('ndo'); db.classList.add('ndo'); de.classList.add('ndo');
  dg.append(sec(T('Προορισμός','Destination')),dd,db,de); ng.append(sec(T('Τώρα','Now')),ns,nc); ins.append(dg,ng);
  var DIRS=['N','NE','E','SE','S','SW','W','NW'];
  function upd(){
    var N=window.AlkyonNav, fresh=N&&Date.now()-N.t<20000, D=window.AlkyonDirectInfo;
    ns.v.textContent=(fresh&&N.kn!=null)?N.kn.toFixed(1)+' kn':'–';
    nc.v.textContent=(fresh&&N.head!=null&&N.kn!=null&&N.kn>=0.8)?('00'+Math.round(N.head)).slice(-3)+'° '+DIRS[Math.round(N.head/45)%8]:'–';
    dg.hidden=!D;
    if(D){ dd.v.textContent=D.wait?'…':D.d; db.v.textContent=D.wait?'…':D.b; de.v.textContent=D.eta||'–'; }
  }
  window.ndEvery(upd,1000); upd();
  tools.insertBefore(ins,tools.firstChild); tools.insertBefore(orb,tools.querySelector('.ndb'));
})();
box.insertBefore(tools,bar.nextSibling);
(function(){
  var KEY='alkyon_ndtools', shut=false, tm=null, was=null;
  function trip(){ return document.body.classList.contains('ontrip'); }
  function arm(){ clearTimeout(tm); if(!shut&&trip()) tm=setTimeout(function(){ set(true); },7000); }
  function set(sh,save){ shut=sh; document.body.classList.toggle('ndtoolsopen',!sh); tools.classList.toggle('shut',sh); hd.setAttribute('aria-expanded',String(!sh)); hd.setAttribute('aria-label',sh?T('Άνοιγμα εργαλείων','Open tools'):T('Κλείσιμο εργαλείων','Close tools')); arm(); if(save&&!trip()) C.lsSet(KEY,sh?1:0); }
  hd.addEventListener('click',function(e){ e.stopPropagation(); set(!shut,true); });
  tools.addEventListener('click',arm,true);
  function sync(){ var t=trip(); if(t===was) return; was=t; if(t) set(true); else set(!!C.lsGet(KEY,0)); }
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']}); sync();
  var sx=null, sy=null, inTools=false;
  document.addEventListener('touchstart',function(e){ var t=e.touches[0]; sx=t.clientX; sy=t.clientY; inTools=tools.contains(e.target); },{passive:true});
  document.addEventListener('touchend',function(e){ if(sx==null) return; var t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)>50&&Math.abs(dx)>2*Math.abs(dy)){ if(dx<0&&shut&&sx>window.innerWidth-44) set(false,true); else if(dx>0&&!shut&&inTools) set(true,true); } sx=null; },{passive:true});
  setTimeout(function(){ try{ var m=C.map&&C.map(); if(m) m.on('click',function(){ if(trip()&&!shut) set(true); }); }catch(e){} },1500);
})();

/* ---- αρχική οθόνη: αναζήτηση, κάρτα «Σήμερα», κάτω μενού με κεντρικό κουμπί ---- */
(function(){
  var NS='http://www.w3.org/2000/svg';
  function svgEl(n,a){ var e=document.createElementNS(NS,n); for(var k in a) e.setAttribute(k,a[k]); return e; }
  function pad(n){ return (n<10?'0':'')+n; }
  var tab=function(n){ if(C.switchTab) C.switchTab(n); };

  /* 1. γραμμή αναζήτησης: ανοίγει την πρόγνωση με το πεδίο τοποθεσίας έτοιμο */
  var sb=el('button','ndsearch'); sb.type='button';
  var lg=document.createElement('img'); lg.src='icon-192.png'; lg.alt=''; lg.width=40; lg.height=40;
  var st=el('span',null,T('Πού θα ψαρέψεις;','Where will you fish?'));
  var mg=svgEl('svg',{viewBox:'0 0 24 24','aria-hidden':'true'}); mg.setAttribute('fill','none'); mg.setAttribute('stroke','currentColor'); mg.setAttribute('stroke-width','2'); mg.setAttribute('stroke-linecap','round');
  mg.append(svgEl('circle',{cx:'11',cy:'11',r:'7'}),svgEl('path',{d:'m20 20-3.5-3.5'}));
  sb.append(lg,st,mg); sb.setAttribute('aria-label',T('Αναζήτηση τοποθεσίας','Search a place'));
  /* φύλλο αναζήτησης: βρίσκει τόπο και αλλάζει τον καιρό (κάρτα και Πρόγνωση). Η θέση μου είναι η προεπιλογή. */
  var fd=el('div','ndsheet ndfind'); fd.hidden=true;
  var fb=el('div','ndback'), fp=el('div','ndpanel'); fp.setAttribute('role','dialog'); fp.setAttribute('aria-modal','true'); fp.setAttribute('aria-label',T('Αναζήτηση τοποθεσίας','Search a place'));
  var fi=document.createElement('input'); fi.type='search'; fi.className='ndq'; fi.placeholder=T('Πού θα ψαρέψεις;','Where will you fish?'); fi.setAttribute('autocomplete','off'); fi.setAttribute('enterkeyhint','search');
  var fr=el('div','ndres'); fp.append(fi,fr); fd.append(fb,fp); document.body.append(fd);
  var label=null, tmr=null, seq=0;
  function setLabel(n){ label=n||null; st.textContent=label||T('Πού θα ψαρέψεις;','Where will you fish?'); sb.classList.toggle('ndset',!!label); }
  function row(txt,sub,fn,icon){ var b=el('button','ndrow'); b.type='button'; b.innerHTML=(icon||'')+'<span></span>'; b.lastChild.textContent=txt+(sub?' · '+sub:''); b.addEventListener('click',fn); fr.append(b); }
  var PIN=SVG+'<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  function showBase(){
    fr.replaceChildren();
    row(T('Η θέση μου','My location'),label?T('προεπιλογή','default'):'',function(){
      setLabel(null); closeF();
      if(window.AlkyonPlaces&&AlkyonPlaces.selectGps) AlkyonPlaces.selectGps();
      if(window.AlkyonPlaces&&AlkyonPlaces.view) AlkyonPlaces.view(); else if(C.viewPlace) C.viewPlace({gps:true});
    },IC.me);
    row(T('Επιλογή στον χάρτη','Choose on map'),'',function(){ closeF(); window.dispatchEvent(new CustomEvent('alkyon-pickplace')); },PIN);
  }
  window.addEventListener('alkyon-placepicked',function(e){
    var d=e.detail||{}, nm=T('Σημείο στον χάρτη','Map point');
    try{ if(window.AlkyonCoord&&AlkyonCoord.fmt) nm=AlkyonCoord.fmt(d.lat,d.lon); else nm=d.lat.toFixed(4)+', '+d.lon.toFixed(4); }catch(x){}
    setLabel(nm);
    if(window.AlkyonPlaces&&AlkyonPlaces.pick) AlkyonPlaces.pick(nm,d.lat,d.lon);
    else if(C.viewPlace) C.viewPlace({id:'s'+d.lat+','+d.lon,name:nm,lat:d.lat,lon:d.lon});
  });
  document.addEventListener('alkyon-viewname',function(e){ setLabel(e.detail); });
  function openF(){ fd.hidden=false; fi.value=''; showBase(); setTimeout(function(){ try{ fi.focus(); }catch(e){} },80); }
  function closeF(){ fd.hidden=true; try{ fi.blur(); }catch(e){} }
  fb.addEventListener('click',closeF);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!fd.hidden) closeF(); });
  var GR={'α':'a','β':'v','γ':'g','δ':'d','ε':'e','ζ':'z','η':'i','θ':'th','ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p','ρ':'r','σ':'s','ς':'s','τ':'t','υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o'};
  function plain(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,''); }
  function latin(s){ return plain(s).toLowerCase().replace(/[α-ως]/g,function(c){ return GR[c]||c; }); }
  function omSearch(q){
    return fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=12&format=json&language='+(EN?'en':'el'))
      .then(function(r){ return r.json(); }).then(function(j){ return ((j&&j.results)||[]).map(function(x){ return {name:x.name,lat:x.latitude,lon:x.longitude,sub:[x.admin1,x.country].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ')}; }); }).catch(function(){ return []; });
  }
  function osmSearch(q){
    return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language='+(EN?'en':'el')+'&viewbox=32.2,35.75,34.7,34.5&q='+encodeURIComponent(q))
      .then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){ return (j||[]).map(function(x){ var p=(x.display_name||'').split(',').map(function(s){ return s.trim(); }); return {name:(x.name||p[0]||'').trim(),lat:+x.lat,lon:+x.lon,sub:p.slice(1,3).join(', ')}; }).filter(function(x){ return x.name&&isFinite(x.lat)&&isFinite(x.lon); }); }).catch(function(){ return []; });
  }
  function find(){
    var q=fi.value.trim(), my=++seq; showBase(); if(q.length<2) return;
    var note=el('div','note',T('Αναζήτηση…','Searching…')); fr.append(note);
    var variants=[q]; var p1=plain(q), l1=latin(q); if(p1!==q) variants.push(p1); if(l1!==p1&&l1!==q) variants.push(l1);
    /* πρώτα Open-Meteo (με παραλλαγές γραφής), μετά και OpenStreetMap */
    var chain=Promise.resolve([]);
    variants.forEach(function(v){ chain=chain.then(function(acc){ return acc.length?acc:omSearch(v); }); });
    Promise.all([chain,osmSearch(variants[variants.length-1]===l1&&l1!==q?q:q)]).then(function(rs){
      if(my!==seq) return; note.remove();
      var seen={}, all=rs[0].concat(rs[1]).filter(function(x){ var k=x.lat.toFixed(2)+','+x.lon.toFixed(2); if(seen[k]) return false; seen[k]=1; return true; });
      /* ταξινόμηση: πιο κοντινά πρώτα (από το κέντρο του χάρτη, αλλιώς από το κέντρο της Κύπρου) */
      var ref=[35.0,33.2]; try{ var mm=C.map&&C.map(); if(mm){ var cc=mm.getCenter(); ref=[cc.lat,cc.lng]; } }catch(e){}
      var dist=function(x){ var dl=(x.lat-ref[0])*Math.PI/180, dn=(x.lon-ref[1])*Math.PI/180, a1=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(ref[0]*Math.PI/180)*Math.cos(x.lat*Math.PI/180)*Math.sin(dn/2)*Math.sin(dn/2); return 2*Math.asin(Math.min(1,Math.sqrt(a1))); };
      all.sort(function(x,y){ return dist(x)-dist(y); }); all=all.slice(0,8);
      if(!all.length){ fr.append(el('div','note',T('Δεν βρέθηκε τοποθεσία. Δοκίμασε άλλη γραφή ή λατινικούς χαρακτήρες.','No place found. Try another spelling.'))); return; }
      all.forEach(function(x){
        row(x.name,x.sub,function(){
          setLabel(x.name); closeF();
          if(window.AlkyonPlaces&&AlkyonPlaces.pick) AlkyonPlaces.pick(x.name,x.lat,x.lon);
          else if(C.viewPlace) C.viewPlace({id:'s'+x.lat+','+x.lon,name:x.name,lat:x.lat,lon:x.lon});
          try{ var m=C.map&&C.map(); if(m) m.setView([x.lat,x.lon],Math.max(m.getZoom(),11)); }catch(e){}
        },PIN);
      });
    }).catch(function(){ if(my!==seq) return; note.textContent=T('Η αναζήτηση δεν δούλεψε. Έλεγξε τη σύνδεση.','Search failed. Check your connection.'); });
  }
  fi.addEventListener('input',function(){ clearTimeout(tmr); tmr=setTimeout(find,400); });
  fi.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); clearTimeout(tmr); find(); } });
  sb.addEventListener('click',openF);
  if(window.AlkyonPlaces&&AlkyonPlaces.selectGps) AlkyonPlaces.selectGps();
  box.append(sb);

  /* 2. κάρτα «Σήμερα» */
  var card=el('div','ndcard'); card.hidden=true;
  var top=el('div','ndtop');
  var ring=svgEl('svg',{viewBox:'0 0 56 56',class:'ndring','aria-hidden':'true'});
  ring.append(svgEl('circle',{cx:'28',cy:'28',r:'23',class:'ndr0'}),svgEl('circle',{cx:'28',cy:'28',r:'23',class:'ndr1',transform:'rotate(-90 28 28)'}));
  var rn=el('span','ndrn','–'); var rw=el('div','ndringw'); rw.append(ring,rn);
  var tx=el('div','ndtx'); var h1=el('b',null,'…'); var h2=el('span',null,''); tx.append(h1,h2);
  var go=el('button','ndgo'); go.type='button'; go.setAttribute('aria-label',T('Άνοιγμα λεπτομερειών σήμερα','Open today details')); go.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  go.addEventListener('click',function(){ tab('today'); });
  top.append(rw,tx,go);
  var bars=el('div','ndbars'), lab=el('div','ndlab');
  var foot=el('div','ndfoot'); var wxslot=el('div','ndwx'); foot.append(wxslot);
  var shop=el('button','ndshop'); shop.type='button'; shop.innerHTML=SHOP+'<span></span>'; shop.lastChild.textContent=T('Μαγαζιά','Stores');
  shop.addEventListener('click',function(){ var b=$('sShops'); if(b) b.click(); });
  card.append(top,bars,lab,foot); box.append(card);
  /* κουμπί απόκρυψης της κάρτας (βελάκι προς τα κάτω) και μικρό κουμπί για να ξαναβγεί */
  var CHEV_D='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  var CHEV_U='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>';
  var hideb=el('button','ndhide'); hideb.type='button'; hideb.setAttribute('aria-label',T('Απόκρυψη κάρτας','Hide card')); hideb.innerHTML=CHEV_D;
  var showb=el('button','ndshowc'); showb.type='button'; showb.setAttribute('aria-label',T('Εμφάνιση κάρτας','Show card'));
  var shn=el('b',null,'–'); showb.innerHTML=CHEV_U; showb.append(shn);
  card.prepend(hideb); box.append(showb);
  function setMin(v){ document.body.classList.toggle('ndmin',!!v); try{ localStorage.setItem('alkyon_ndmin',v?'1':'0'); }catch(e){} }
  try{ if(localStorage.getItem('alkyon_ndmin')==='1') document.body.classList.add('ndmin'); }catch(e){}
  hideb.addEventListener('click',function(){ setMin(true); });
  showb.addEventListener('click',function(){ setMin(false); });
  var FR=0, TO=23;
  for(var h=FR;h<=TO;h++){ var bb=el('i'); bb.dataset.h=h; bars.append(bb); var lb=el('span',null,(h===0||h===6||h===12||h===18)?pad(h):''); lab.append(lb); }
  function draw(){
    var cc=C.getCond&&C.getCond(), c=null; try{ c=cc&&C.compute&&C.compute(); }catch(e){ c=null; }
    if(!c||!c.hours||c.day==null){ card.hidden=true; document.body.classList.remove('ndhascard'); return; }
    card.hidden=false; document.body.classList.add('ndhascard');
    var day=c.day, sc=Math.max(0,Math.min(100,Math.round(day)));
    rn.textContent=String(sc); shn.textContent=String(sc); ring.querySelector('.ndr1').style.strokeDasharray=(2*Math.PI*23*Math.max(sc,2)/100).toFixed(1)+' 999';
    h1.textContent=day>=75?'Πολύ καλές προϋποθέσεις':day>=60?'Καλές προϋποθέσεις':day>=45?'Μέτριες προϋποθέσεις':'Δύσκολη μέρα για ψάρεμα';
    var mx=Math.max.apply(null,c.hours), thr=mx-6, gs=[], cur=null;
    c.hours.forEach(function(v,i){ if(v>=thr){ if(cur&&cur.e===i-1){ cur.e=i; if(v>cur.m) cur.m=v; } else { cur={s:i,e:i,m:v}; gs.push(cur); } } });
    gs.sort(function(a,b){ return b.m-a.m; });
    h2.textContent=gs.length?T('Καλύτερα ','Best ')+pad(gs[0].s)+':00–'+pad((gs[0].e+1)%24)+':00':'';
    var lvl=function(v){ return v>=75?'g':v>=60?'l':v>=45?'w':'b'; };
    card.dataset.lv=lvl(day); showb.dataset.lv=lvl(day);
    Array.prototype.forEach.call(bars.children,function(b){ var v=c.hours[+b.dataset.h]||0; b.style.height=Math.max(8,Math.round(v/Math.max(mx,1)*100))+'%'; b.dataset.lv=lvl(v); b.className=v>=thr?'hi':''; b.title=pad(+b.dataset.h)+':00 · '+v+'%'; });
  }
  document.addEventListener('alkyon-cond',function(){ setTimeout(draw,80); });
  document.addEventListener('alkyon-view',function(){ setTimeout(draw,80); });
  setTimeout(draw,900); setTimeout(draw,3600); setInterval(draw,30000);

  /* τα στοιχεία καιρού που έχεις διαλέξει (⚙) μπαίνουν μέσα στην κάρτα, με την ίδια λογική */
  var mw=box.querySelector('.mapwx'); if(mw) wxslot.append(mw);
  var mo=new MutationObserver(function(){ var m=box.querySelector('.mapwx'); if(m) wxslot.append(m); });
  mo.observe(box,{childList:true});

  /* 3. κάτω μενού: «Πρόγνωση» και κεντρικό κουμπί ψαρέματος */
  var nav=document.querySelector('nav.tabs');
  if(nav){
    var fcb=nav.querySelector('[data-tab="fc"]');
    if(fcb){ for(var i=0;i<fcb.childNodes.length;i++){ var n=fcb.childNodes[i]; if(n.nodeType===3&&n.textContent.trim()){ n.textContent=T('Πρόγνωση','Forecast'); break; } } }
    var cb=el('button','ndfish'); cb.type='button'; cb.innerHTML=IC.fish;
    var STOP=SVG+'<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';
    /* κατά την έξοδο το κεντρικό κουμπί γίνεται «Τέλος εξόδου» (πάτημα = επιβεβαίωση, παρατεταμένο = λεπτομέρειες) */
    function fl(){
      var on=document.body.classList.contains('ontrip'), tb=$('tripBtn');
      cb.setAttribute('aria-label',on?T('Τέλος εξόδου','End trip'):T('Ξεκίνα έξοδο για ψάρεμα','Start a fishing trip'));
      cb.innerHTML=on?STOP:IC.fish; cb.classList.toggle('end',on); cb.classList.toggle('late',!!(on&&tb&&tb.classList.contains('late')));
    }
    fl(); new MutationObserver(fl).observe(document.body,{attributes:true,attributeFilter:['class']});
    var tbn=$('tripBtn'); if(tbn) new MutationObserver(fl).observe(tbn,{attributes:true,attributeFilter:['class']});
    var lt=null, lheld=false;
    cb.addEventListener('pointerdown',function(){ lheld=false; clearTimeout(lt); if(!document.body.classList.contains('ontrip')) return; lt=setTimeout(function(){ lheld=true; try{ navigator.vibrate&&navigator.vibrate(30); }catch(e){} if(window.AlkyonTrip&&window.AlkyonTrip.sheet) window.AlkyonTrip.sheet(); },450); });
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ cb.addEventListener(ev,function(){ clearTimeout(lt); }); });
    cb.addEventListener('contextmenu',function(e){ e.preventDefault(); });
    cb.addEventListener('click',function(){
      if(lheld){ lheld=false; return; }
      var t=$('tripBtn'); if(t) t.click();
    });
    var logb=nav.querySelector('[data-tab="log"]'); nav.insertBefore(cb,logb||null);
  }
  window.ndEvery(function(){ try{ var tb=document.querySelector('.ndbar'); if(!tb) return; document.documentElement.style.setProperty('--ndfixh',(tb.offsetHeight||0)+'px'); var br=tb.getBoundingClientRect(), cr=card.getBoundingClientRect(); var dtb=document.getElementById('dtBar'); if(dtb){ var dr=dtb.getBoundingClientRect(); dtb.classList.toggle('dtclear',dr.height>0&&br.height>0&&br.top<dr.bottom+16&&br.bottom>dr.top); } card.classList.toggle('ndclear',false&&!document.body.classList.contains('ontrip')&&br.height>0&&br.bottom>cr.top-6&&br.top<cr.bottom); }catch(e){} }, 400);
  window.ndEvery(function(){ var on=document.body.classList.contains('ontrip')&&!card.hidden; document.documentElement.style.setProperty('--ndwx',on?Math.max(0,card.offsetHeight-34)+'px':'0px'); document.documentElement.style.setProperty('--ndtop',(on?card.offsetTop+card.offsetHeight+8:72)+'px'); },700);
  window.ndEvery(function(){ box.style.setProperty('--ndch',(card.hidden||document.body.classList.contains('ontrip')?0:card.offsetHeight)+'px'); },700);
  window.ndEvery(function(){ var m=box.querySelector('.mapwx'); if(m){ m.style.removeProperty('left'); m.style.removeProperty('top'); } },500);
})();

/* κόκκινο χρώμα στα κουμπιά «Διαγραφή» των καρτών */
(function(){ var q=0; function mark(){ q=0; document.querySelectorAll('.card .btn,.acts .btn').forEach(function(b){ var t=(b.textContent||'').trim(); if(t==='Διαγραφή'||t==='Delete') b.classList.add('ndel'); }); }
  new MutationObserver(function(){ if(!q) q=requestAnimationFrame(mark); }).observe(document.body,{childList:true,subtree:true}); mark(); })();

/* Settings: επαγγελματική σειρά + επικεφαλίδες ενοτήτων */
(function(){
  var busy=false;
  function en(){ return window.LANG==='en'; }
  function title(c){ var h=c.querySelector('h3'); if(h) return (h.textContent||'').toLowerCase(); var b=c.querySelector('b'); return b?(b.textContent||'').toLowerCase():''; }
  function arrange(){
    var ps=document.getElementById('pSettings'); if(!ps||busy) return; busy=true;
    try{
      var OWN={ndExport:1,ndTour:1,ndDelAcc:1,ndAbout:1,ndFProf:1,ndVerCard:1};
      var kids=[].slice.call(ps.children).filter(function(c){ return !c.classList.contains('ndsech')&&!OWN[c.id]; });
      var g={back:[],acc:[],pref:[],safe:[],data:[],adv:[],about:[],out:[],ver:[]};
      kids.forEach(function(c,i){
        var id=c.id||'', t=title(c);
        if(id==='ntCard') g.pref.push(c);
        else if(c.querySelector('#pBackMain')) g.back.push(c);
        else if(c.querySelector('#acLogout')) g.out.push(c);
        else if(c.id==='appVer'||c.tagName==='P') g.ver.push(c);
        else if(id==='unitsCard'||c.querySelector('#pGpsChk')) g.pref.push(c);
        else if(id==='pContacts') g.safe.push(c);
        else if(id==='dgCard'||id==='seaDataCard') g.data.push(c);
        else if(id==='seaSetCard') g.pref.push(c);
        else if(t.indexOf('ai')===0||t.indexOf('fish')>-1||t.indexOf('claude')>-1||c.querySelector('input[type=password]')&&/api|key/i.test(c.textContent)&&!/account|λογαριασμ/i.test(t)) g.adv.push(c);
        else g.acc.push(c);
      });
      /* μέσα στο acc: Account, Sync, Password με αυτή τη σειρά */
      var rank=function(c){ var t=(c.textContent||'').toLowerCase(); return /sync|συγχρον/.test(t.slice(0,60))?1:/password|κωδικ/.test(t.slice(0,60))?2:0; };
      g.acc.sort(function(a,b){ return rank(a)-rank(b); });
      g.pref.sort(function(a,b){ return (a.id==='unitsCard'?0:1)-(b.id==='unitsCard'?0:1); });
      var fpc=document.getElementById('ndFProf'); if(!fpc&&window.AlkyonFProf) fpc=window.AlkyonFProf.card(); if(fpc) g.pref.unshift(fpc);
      var E=en();
      var ex=document.getElementById('ndExport');
      if(!ex){ ex=document.createElement('div'); ex.id='ndExport'; ex.className='card setcard';
        ex.innerHTML='<h3></h3><p class="note"></p><p class="note" id="ndExLast"></p><div class="row"><button class="btn sm" type="button" data-a="exp"></button><button class="btn sm ghost" type="button" data-a="imp"></button><button class="btn sm ghost" type="button" data-a="csv"></button></div>';
        ex.addEventListener('click',function(e){ var a=e.target.closest&&e.target.closest('button'); if(!a) return; var k=a.getAttribute('data-a');
          if(k==='exp'){ var x=document.getElementById('expBtn'); if(x) x.click(); setTimeout(upd,1500); }
          else if(k==='imp'){ var f=document.getElementById('impFile'); if(f) f.click(); }
          else if(k==='csv'&&window.AlkyonOpenExport) window.AlkyonOpenExport(); }); }
      function upd(){ try{ var lb=+localStorage.getItem('alkyon-lastbackup')||0; ex.querySelector('#ndExLast').textContent=(E?'Last backup: ':'Τελευταίο αντίγραφο: ')+(lb?new Date(lb).toLocaleDateString():(E?'never':'ποτέ')); }catch(e){} }
      ex.querySelector('h3').textContent=E?'Backup & export':'Αντίγραφο ασφαλείας και εξαγωγή';
      ex.querySelector('p').textContent=E?'Back up everything on this device, including photos, and restore it on another phone. CSV files are for Excel.':'Αντίγραφο όλων όσων έχεις στη συσκευή, μαζί με τις φωτογραφίες, και επαναφορά σε άλλο κινητό. Τα CSV είναι για Excel.';
      ex.querySelector('[data-a=exp]').textContent=E?'Back up':'Αντίγραφο'; ex.querySelector('[data-a=imp]').textContent=E?'Restore':'Επαναφορά'; ex.querySelector('[data-a=csv]').textContent=E?'CSV / more':'CSV και άλλα';
      upd();
      g.data.push(ex);
      var tr=document.getElementById('ndTour');
      if(!tr){ tr=document.createElement('div'); tr.id='ndTour'; tr.className='card setcard'; tr.innerHTML='<h3></h3><p class="note"></p><div class="row"><button class="btn sm ghost" type="button"></button></div>'; tr.querySelector('button').addEventListener('click',function(){ var p=document.getElementById('profile'); if(p) p.hidden=true; if(window.AlkyonTour) window.AlkyonTour(); }); }
      tr.querySelector('h3').textContent=E?'Welcome guide':'Οδηγός καλωσορίσματος'; tr.querySelector('p').textContent=E?'A quick tour of forecast, map and trip logging.':'Σύντομη περιήγηση σε πρόγνωση, χάρτη και καταγραφή εξόδων.'; tr.querySelector('button').textContent=E?'Show again':'Εμφάνιση ξανά';
      var da=document.getElementById('ndDelAcc');
      if(!da){ da=document.createElement('div'); da.id='ndDelAcc'; da.className='card setcard';
        da.innerHTML='<h3></h3><p class="note"></p><div class="row"><button class="btn sm ghost ndel" type="button"></button></div>';
        da.querySelector('button').addEventListener('click',function(){ if(window.AlkyonDeleteAccount) window.AlkyonDeleteAccount(); }); }
      da.querySelector('h3').textContent=E?'Delete account':'Διαγραφή λογαριασμού';
      da.querySelector('p').textContent=E?'Deletes your account and the data synced to the cloud. Data stored on this phone stays until you delete it here.':'Διαγράφει τον λογαριασμό σου και τα δεδομένα που έχουν συγχρονιστεί στο cloud. Τα δεδομένα που είναι στο κινητό μένουν μέχρι να τα σβήσεις εδώ.';
      da.querySelector('button').textContent=E?'Delete my account':'Διαγραφή λογαριασμού';
      da.hidden=!(window.AlkyonCloud&&window.AlkyonCloud.logged&&window.AlkyonCloud.logged());
      g.adv.push(da);
      var ab=document.getElementById('ndAbout');
      if(!ab){ ab=document.createElement('div'); ab.id='ndAbout'; ab.className='card setcard ndabout'; }
      ab.innerHTML=E
        ? '<h3>Privacy</h3><ul class="ndul"><li>Your catches, trips, spots, tackle and photos are stored on this phone.</li><li>If you sign in, they are also synced to your Alkyon account so you can restore them on another phone.</li><li>Your location is used on the phone and sent to weather and map services (Open-Meteo, OpenStreetMap, Esri) only to load forecasts, places and map tiles. Species photos are loaded from Wikipedia and only the species name is sent.</li><li>When trip safety monitoring is on, the route, last known position, battery level and your contact’s email are sent to the Alkyon server so an alert can be sent if you do not return.</li><li>If you use AI fish identification, the photo is sent to Anthropic with your own key.</li></ul><h3>Safety</h3><p class="note">Alkyon is a planning and logging aid. Forecasts are indicative and not an official forecast. It does not replace a VHF radio, lifejackets, flares or official weather warnings. Mobile coverage at sea is limited, so alerts can be delayed or fail.</p>'
        : '<h3>Απόρρητο</h3><ul class="ndul"><li>Τα ψάρια, οι έξοδοι, τα σημεία, ο εξοπλισμός και οι φωτογραφίες σου αποθηκεύονται στο κινητό.</li><li>Αν συνδεθείς, συγχρονίζονται και με τον λογαριασμό σου στο Alkyon, ώστε να τα επαναφέρεις σε άλλο κινητό.</li><li>Η τοποθεσία σου χρησιμοποιείται στο κινητό και στέλνεται σε υπηρεσίες καιρού και χαρτών (Open-Meteo, OpenStreetMap, Esri) μόνο για να φορτωθούν πρόγνωση, μέρη και χάρτης. Οι φωτογραφίες ειδών φορτώνονται από τη Wikipedia και στέλνεται μόνο το όνομα του είδους.</li><li>Όταν είναι ενεργή η παρακολούθηση ασφάλειας της εξόδου, στέλνονται στον διακομιστή του Alkyon η διαδρομή, η τελευταία γνωστή θέση, η μπαταρία και το email της επαφής σου, ώστε να σταλεί ειδοποίηση αν δεν γυρίσεις.</li><li>Αν χρησιμοποιήσεις αναγνώριση ψαριού με AI, η φωτογραφία στέλνεται στην Anthropic με το δικό σου κλειδί.</li></ul><h3>Ασφάλεια</h3><p class="note">Το Alkyon είναι βοήθημα προγραμματισμού και καταγραφής. Οι προγνώσεις είναι ενδεικτικές και όχι επίσημη πρόγνωση. Δεν αντικαθιστά VHF, σωσίβια, φωτοβολίδες ή επίσημες προειδοποιήσεις καιρού. Η κάλυψη κινητού στη θάλασσα είναι περιορισμένη, οπότε οι ειδοποιήσεις μπορεί να καθυστερήσουν ή να αποτύχουν.</p>';
      g.about.push(ab);
      g.adv.unshift(tr);
      var vcd=document.getElementById('ndVerCard'); if(vcd) g.adv.unshift(vcd);
      var H={acc:E?'Account & sync':'Λογαριασμός και συγχρονισμός',pref:E?'Preferences':'Προτιμήσεις',safe:E?'Safety':'Ασφάλεια',data:E?'Data':'Δεδομένα',adv:E?'Advanced':'Για προχωρημένους',about:E?'About':'Σχετικά'};
      var order=[];
      g.back.forEach(function(c){order.push(c)});
      ['acc','pref','safe','data','adv','about'].forEach(function(k){
        if(!g[k].length) return;
        var h=ps.querySelector('.ndsech[data-k="'+k+'"]');
        if(!h){ h=document.createElement('div'); h.className='ndsech'; h.setAttribute('data-k',k); }
        h.textContent=H[k]; order.push(h); g[k].forEach(function(c){order.push(c)});
      });
      g.out.concat(g.ver).forEach(function(c){order.push(c)});
      var seenO=[]; order=order.filter(function(c){ if(seenO.indexOf(c)>-1) return false; seenO.push(c); return true; });
      /* v31z409: σύγκριση μόνο της σειράς που θέλουμε· στοιχεία εκτός λίστας μένουν στο τέλος. Πριν, η διαφορά στο πλήθος έκανε ατελείωτη αναδιάταξη (κάθε 60 ms). */
      var cur=[].slice.call(ps.children), same=order.every(function(c,i){return c===cur[i];});
      if(!same) order.forEach(function(c){ ps.appendChild(c); });
    }catch(e){}
    busy=false;
  }
  var q=0; function sch(){ if(!q) q=setTimeout(function(){ q=0; arrange(); },60); }
  function init(){ var ps=document.getElementById('pSettings'); if(!ps){ setTimeout(init,500); return; }
    new MutationObserver(sch).observe(ps,{childList:true}); arrange(); }
  init();
})();

/* Εικονίδια γραμμής αντί για emoji: ενιαίο στυλ με τα υπόλοιπα εικονίδια (μονόχρωμα, ακολουθούν το χρώμα του κειμένου) */
(function(){
  var IC={"💡": "<path d=\"M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z\"/>", "📍": "<path d=\"M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z\"/><circle cx=\"12\" cy=\"10\" r=\"2.5\"/>", "🔧": "<path d=\"M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z\"/>", "🛒": "<circle cx=\"9\" cy=\"20\" r=\"1.3\"/><circle cx=\"18\" cy=\"20\" r=\"1.3\"/><path d=\"M3 4h2.5l2.2 11h10.6L20.5 8H6.2\"/>", "💾": "<path d=\"M5 4h11l3 3v13H5z\"/><path d=\"M8 4v5h7V4M8 20v-6h8v6\"/>", "📷": "<path d=\"M4 8h3l2-2h6l2 2h3v11H4z\"/><circle cx=\"12\" cy=\"13\" r=\"3.5\"/>", "🖼": "<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"1.6\"/><path d=\"M4 18l5-5 4 4 3-3 4 4\"/>", "🧰": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18\"/>", "📦": "<path d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9z\"/><path d=\"M4 7.5l8 4.5 8-4.5M12 12v9\"/>", "🏠": "<path d=\"M4 11l8-7 8 7v9H4z\"/><path d=\"M10 20v-6h4v6\"/>", "⛽": "<path d=\"M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11\"/><path d=\"M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V9l-3-3\"/><path d=\"M7 8h5\"/>", "⚓": "<circle cx=\"12\" cy=\"5\" r=\"2\"/><path d=\"M12 7v14M7 11h10M4 14a8 8 0 0 0 16 0\"/>", "📅": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10h16M8 3v4M16 3v4\"/>", "⚖": "<path d=\"M12 4v16M7 20h10M5 8h14\"/><path d=\"M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z\"/>", "🎯": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"12\" cy=\"12\" r=\".8\"/>", "🔒": "<rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>", "🔍": "<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"M20 20l-4.5-4.5\"/>", "📝": "<path d=\"M5 4h10l4 4v12H5z\"/><path d=\"M8 12h8M8 16h5\"/>", "🏆": "<path d=\"M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M10 17h4\"/>", "🪪": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><circle cx=\"9\" cy=\"11\" r=\"2\"/><path d=\"M6 16c.5-1.5 5.5-1.5 6 0M14 10h4M14 14h3\"/>", "🎣": "<path d=\"M6 3v10a5 5 0 0 0 10 0v-2M6 3l-2 2\"/><circle cx=\"16\" cy=\"9.5\" r=\"1.5\"/>", "🐟": "<path d=\"M2 12c3-5.5 10-7 15-3l5-3v12l-5-3c-5 4-12 2.5-15-3z\"/><circle cx=\"7.5\" cy=\"11\" r=\".8\"/>", "🔔": "<path d=\"M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4\"/>", "🔕": "<path d=\"M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4M3 3l18 18\"/>", "🧵": "<path d=\"M7 4h10M7 20h10M8 4v16M16 4v16M8 8h8M8 12h8M8 16h8\"/>", "➰": "<path d=\"M4 17c0-6 5-9 8-5s8 1 8-5\"/>", "🪝": "<circle cx=\"14\" cy=\"4\" r=\"1.5\"/><path d=\"M14 5.5V14a5 5 0 0 1-10 0M1.5 12l2.5 2.5L6.5 12\"/>", "🔹": "<path d=\"M12 4l7 8-7 8-7-8z\"/>", "🪢": "<path d=\"M5 8c4 0 4 8 8 8s4-8 8-8M5 16c4 0 4-8 8-8s4 8 8 8\"/>", "🗑": "<path d=\"M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6\"/>", "✏": "<path d=\"M4 20l1-4L16 5l3 3L8 19zM14 7l3 3\"/>", "💬": "<path d=\"M4 5h16v11H9l-5 4z\"/>"};
  var SKIP={OPTION:1,SCRIPT:1,STYLE:1,TEXTAREA:1,TITLE:1,INPUT:1,SELECT:1,svg:1,SVG:1,CODE:1};
  /* v31z406: σημαία u, αλλιώς ταίριαζε κάθε emoji με το ίδιο «μισό» (π.χ. 🌙) και ξαναέγραφε το κείμενο συνέχεια → blinking */
  var rx; try{ rx=new RegExp('(?:'+Object.keys(IC).join('|')+')','u'); }catch(e){ rx=new RegExp('(?:'+Object.keys(IC).join('|')+')'); }
  function mk(k,tail){ var i=document.createElement('i'); i.className='ndi'; i.setAttribute('aria-hidden','true');
    i.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+IC[k]+'</svg>';
    if(tail) i.classList.add('ndit'); return i; }
  function conv(t){
    var s=t.nodeValue; if(!s||!rx.test(s)) return;
    var p=t.parentNode; if(!p||SKIP[p.nodeName]||(p.closest&&p.closest('svg,[contenteditable=true],.leaflet-tooltip-pane'))) return;
    var cps=Array.from(s), f=document.createDocumentFragment(), buf='';
    if(!cps.some(function(ch){ return !!IC[ch]; })) return; /* κανένα γνωστό εικονίδιο: τίποτα δεν αλλάζει */
    for(var j=0;j<cps.length;j++){ var ch=cps[j];
      if(IC[ch]){ if(buf){ f.appendChild(document.createTextNode(buf)); buf=''; }
        var k=j+1; if(cps[k]==='\uFE0F') { j=k; k++; }
        var rest=cps.slice(k).join('').trim(); f.appendChild(mk(ch,!!rest)); }
      else if(ch!=='\uFE0F'||buf) buf+=ch; }
    if(buf) f.appendChild(document.createTextNode(buf));
    p.replaceChild(f,t);
  }
  function walk(n){
    if(n.nodeType===3){ conv(n); return; }
    if(n.nodeType!==1||SKIP[n.nodeName]) return;
    var c=[].slice.call(n.childNodes); for(var i=0;i<c.length;i++) walk(c[i]);
  }
  var q=0, pend=[];
  function flush(){ q=0; var a=pend; pend=[]; for(var i=0;i<a.length;i++){ try{ if(a[i].isConnected) walk(a[i]); }catch(e){} } }
  function sch(n){ pend.push(n); if(!q) q=setTimeout(flush,30); }
  new MutationObserver(function(ms){ for(var i=0;i<ms.length;i++){ var m=ms[i];
    if(m.type==='childList'){ for(var j=0;j<m.addedNodes.length;j++){ var n=m.addedNodes[j]; if(n.nodeType===1&&n.classList&&n.classList.contains('ndi')) continue; sch(n); } }
    else if(m.type==='characterData'){ sch(m.target); } } })
    .observe(document.body,{childList:true,subtree:true,characterData:true});
  setTimeout(function(){ walk(document.body); },200);
})();

/* Άδειες οθόνες (εικονίδιο, τίτλος, κουμπί) και καλωσόρισμα πρώτου ανοίγματος */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  var SV=function(p){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; };
  var P={anchor:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M7 11h10M4 14a8 8 0 0 0 16 0"/>',
    fish:'<path d="M2 12c3-5.5 10-7 15-3l5-3v12l-5-3c-5 4-12 2.5-15-3z"/><circle cx="7.5" cy="11" r=".8"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    pin:'<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    rod:'<path d="M6 3v10a5 5 0 0 0 10 0v-2M6 3l-2 2"/><circle cx="16" cy="9.5" r="1.5"/>',
    wave:'<path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
    shield:'<path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'};
  var KIND={
    tripList:{ic:'anchor',t:T('Ξεκίνα το ημερολόγιό σου','Start your logbook'),cta:T('Προσθήκη εξόδου','Add a trip'),btn:'tNew'},
    biteList:{ic:'fish',t:T('Κατέγραψε το πρώτο σου ψάρι','Log your first catch'),cta:T('Νέο ψάρι','New fish'),btn:'bNew',rng:'log',rt:T('Τίποτα σε αυτό το διάστημα','Nothing in this period')},
    stBody:{ic:'chart',t:T('Τα στατιστικά θα εμφανιστούν εδώ','Your statistics will appear here')},
    spotList:{ic:'pin',t:T('Αποθήκευσε το πρώτο σου σημείο','Save your first spot'),cta:T('Νέο σημείο','New spot'),btn:'sNew'}};
  function enhance(e){
    if(e.getAttribute('data-nd')) return; var host=e.parentElement; var k=host&&KIND[host.id];
    if(!k&&e.closest&&e.closest('#pTackle')){ k={ic:'rod',t:T('Πρόσθεσε τον εξοπλισμό σου','Add your tackle')}; }
    if(!k) return; e.setAttribute('data-nd','1'); e.classList.add('ndempty');
    var title=k.t, cta=k.cta, btn=k.btn;
    try{ if(k.rng&&window.AlkyonRange&&window.AlkyonRange.active(k.rng)){ title=k.rt; cta=null; } }catch(x){}
    var ic=document.createElement('div'); ic.className='ndeic'; ic.innerHTML=SV(P[k.ic]);
    var h=document.createElement('div'); h.className='ndet'; h.textContent=title;
    e.insertBefore(h,e.firstChild); e.insertBefore(ic,e.firstChild);
    if(cta&&btn){ var b=document.createElement('button'); b.type='button'; b.className='btn acc sm ndecta'; b.textContent=cta;
      b.addEventListener('click',function(){ var t=document.getElementById(btn); if(t) t.click(); }); e.appendChild(b); }
  }
  function scan(){ var l=document.querySelectorAll('.empty:not([data-nd])'); for(var i=0;i<l.length;i++){ try{ enhance(l[i]); }catch(x){} } }
  var q=0; new MutationObserver(function(){ if(!q) q=setTimeout(function(){ q=0; scan(); },40); }).observe(document.body,{childList:true,subtree:true});
  scan();

  /* Καλωσόρισμα πρώτου ανοίγματος */
  var OB='alkyon-onboard';
  function done(){ try{ localStorage.setItem(OB,'1'); }catch(x){} }
  function seen(){ try{ return !!localStorage.getItem(OB); }catch(x){ return true; } }
  function hasData(){ try{ var S=window.AlkyonCore&&window.AlkyonCore.Store; if(!S) return false; return ['bites','trips','spots','tackle'].some(function(k){ return (S.raw?S.raw(k):[]).length>0; }); }catch(x){ return false; } }
  var STEPS=[
    {ic:'fish',t:T('Καλώς ήρθες στο Alkyon','Welcome to Alkyon'),b:T('Πρόγνωση, χάρτης και ημερολόγιο για ψάρεμα με σκάφος στην Κύπρο. Τέσσερα γρήγορα βήματα για να ξεκινήσεις.','Forecast, map and logbook for boat fishing in Cyprus. Four quick steps to get started.')},
    {ic:'fish',pick:true,t:T('Πού ψαρεύεις συνήθως;','Where do you usually fish?'),b:T('Διάλεξε τον τύπο ψαρέματος. Προσαρμόζει τις τεχνικές και τα κουμπιά ασφαλείας. Μπορείς να το αλλάξεις αργότερα στο Profile.','Pick your fishing type. It adapts the techniques and safety buttons. You can change it later in Profile.')},
    {ic:'wave',t:T('Δες τη θάλασσα πριν φύγεις','Check the sea before you leave'),b:T('Στην Πρόγνωση βλέπεις βαθμό 0–100, τις καλύτερες ώρες, άνεμο και κύμα για το σημείο που διαλέγεις.','Forecast shows a 0–100 score, the best hours, wind and waves for the place you choose.')},
    {ic:'anchor',t:T('Κατέγραψε κάθε έξοδο','Log every outing'),b:T('Πάτα το κουμπί με το ψάρι για να ξεκινήσεις έξοδο και κατέγραψε ψάρια με ένα άγγιγμα. Αν ορίσεις επαφή ασφαλείας, η εφαρμογή την ειδοποιεί αν δεν γυρίσεις στην ώρα σου.','Tap the fish button to start a trip and log catches with one tap. If you set a safety contact, the app alerts them if you do not return on time.'),last:true}];
  var ov=null, step=0, prevFocus=null, ST=STEPS;
  function close(){ if(!ov) return; done(); ov.remove(); ov=null; document.removeEventListener('keydown',key); try{ if(prevFocus&&prevFocus.focus) prevFocus.focus(); }catch(x){} }
  function key(e){ if(e.key==='Escape') close(); }
  function draw(){
    var s=ST[step]; ov.querySelector('.ndobic').innerHTML=SV(P[s.ic]); ov.querySelector('.ndobt').textContent=s.t; ov.querySelector('.ndobb').textContent=s.b;
    var dots=ov.querySelector('.ndobd'); dots.innerHTML=''; ST.forEach(function(_,i){ var d=document.createElement('i'); if(i===step) d.className='on'; dots.appendChild(d); });
    var pk=ov.querySelector('.ndobp'); pk.hidden=!s.pick; if(s.pick&&window.AlkyonFProf){ var cur=window.AlkyonFProf.get(); [].forEach.call(pk.querySelectorAll('button[data-p]'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.p===cur)); }); }
    var nx=ov.querySelector('.ndobn'); nx.textContent=s.nosafe?T('Έτοιμο','Done'):s.last?T('Ξεκινάμε','Get started'):T('Επόμενο','Next');
    var sf=ov.querySelector('.ndobs'); sf.hidden=!s.last||!!s.nosafe; var sk=ov.querySelector('.ndobk'); sk.hidden=!!s.last;
  }
  function open(force,only){
    if(ov) return; ST=only?[Object.assign({},STEPS[1],{last:true,nosafe:true})]:STEPS; if(!force&&(seen()||hasData())){ if(!seen()&&hasData()) done(); return; }
    prevFocus=document.activeElement; step=0;
    ov=document.createElement('div'); ov.className='ndob'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label',T('Καλωσόρισμα','Welcome'));
    ov.innerHTML='<div class="ndobc"><div class="ndobic"></div><h2 class="ndobt"></h2><p class="ndobb"></p><div class="ndobp seg" role="group" hidden></div><div class="ndobd" aria-hidden="true"></div><button type="button" class="btn acc ndobn"></button><button type="button" class="btn ghost ndobs"></button><button type="button" class="ndobk"></button></div>';
    ov.querySelector('.ndobs').textContent=T('Ορισμός επαφής ασφαλείας','Set a safety contact'); ov.querySelector('.ndobk').textContent=T('Παράλειψη','Skip');
    ov.querySelector('.ndobn').addEventListener('click',function(){ if(step<ST.length-1){ step++; draw(); } else{ if(ST.length===1&&window.AlkyonFProf){ window.AlkyonFProf.set(window.AlkyonFProf.get()); try{ localStorage.setItem('alkyon-fprof-done','1'); }catch(e){} } close(); } });
    var pkb=ov.querySelector('.ndobp'), PN={boat:T('Βάρκα','Boat'),shore:T('Από στεριά','From shore'),lake:T('Λίμνη / φράγμα','Lake / dam'),spear:T('Ψαροντούφεκο','Spearfishing')};
    var PIC={"boat": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc0\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc0)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"48\" width=\"96\" height=\"14\" fill=\"#2b7893\"/><rect y=\"62\" width=\"96\" height=\"40\" fill=\"#0f5c76\"/><g transform=\"translate(5,3) scale(.93)\">\n<path d=\"M30 17L24 5M34 17L29 4M60 17V6\" stroke=\"#e8f2f5\" stroke-width=\"1.200\" stroke-linecap=\"round\"/>\n<path d=\"M41 45L43 22M52 45L50 22\" stroke=\"#e8f2f5\" stroke-width=\"2.400\" stroke-linecap=\"round\"/><path d=\"M43 36h8M42 30h8\" stroke=\"#e8f2f5\" stroke-width=\"1.200\" stroke-opacity=\".7\"/>\n<path d=\"M28 17.500h37l-2 4.500H30z\" fill=\"#e8f2f5\"/><rect x=\"44\" y=\"13\" width=\"9\" height=\"4.500\" rx=\"1\" fill=\"#8fb6c4\"/><rect x=\"55\" y=\"14.500\" width=\"3\" height=\"3\" rx=\".5\" fill=\"#8fb6c4\"/>\n<path d=\"M38 56V45h18l2 11z\" fill=\"#cfe0e6\"/><path d=\"M40 45l2.500-6h10l3 6z\" fill=\"#7fc6d8\"/>\n<path d=\"M64 56v-8h5l1 8z\" fill=\"#8fb6c4\"/><path d=\"M62 48h8\" stroke=\"#e8f2f5\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M22 56v-4h8v4z\" fill=\"#8fb6c4\"/>\n<path d=\"M82 45h6.500q2.500 0 2.500 3l-1 9-1.500 11q-.5 3-3 3h-3z\" fill=\"#08202b\"/>\n<path d=\"M4 56L22 54.500 82 54Q86 54 86 57L84.500 63Q83 68 77 68H28Q14 68 4 56Z\" fill=\"#e8f2f5\"/>\n<path d=\"M7 59.500L85.500 58.500 84.500 63Q83 68 77 68H28Q15 68 7 59.500Z\" fill=\"#2f9db8\"/><path d=\"M8 60L85 59\" stroke=\"#ff6a3d\" stroke-width=\"1.500\"/>\n</g>\n<path d=\"M0 70c8-3 14 3 22 0s14 3 22 0 14 3 22 0 14 3 22 0 6 2 8 0V96H0z\" fill=\"#0b475d\"/><path d=\"M0 70c8-3 14 3 22 0s14 3 22 0 14 3 22 0 14 3 22 0\" stroke=\"#e8f2f5\" stroke-opacity=\".5\" stroke-width=\"1.600\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#ff6a3d\" stroke-width=\"2.5\"/></svg>", "shore": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc1\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc1)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"50\" width=\"96\" height=\"14\" fill=\"#2b7893\"/><rect y=\"64\" width=\"96\" height=\"40\" fill=\"#0f5c76\"/>\n<path d=\"M33 49Q58 36 80 18\" stroke=\"#08202b\" stroke-width=\"1.900\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M80 18C84 28 83 48 76 71\" stroke=\"#e8f2f5\" stroke-opacity=\".85\" stroke-width=\".9\" fill=\"none\"/>\n<circle cx=\"76\" cy=\"71\" r=\"2.600\" fill=\"#ff6a3d\"/><ellipse cx=\"76\" cy=\"73\" rx=\"9\" ry=\"2.200\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".5\"/>\n<path d=\"M0 60Q14 54 30 60Q40 64 46 72L50 96H0z\" fill=\"#27495a\"/><path d=\"M0 60Q14 54 30 60Q36 62 40 66L44 74 0 74z\" fill=\"#2f5a6b\"/><path d=\"M0 60Q14 54 30 60Q36 62 40 66\" stroke=\"#6fb08a\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M20 60 22 50Q24 44 30 44L35 46 34 52 30 60z\" fill=\"#ff6a3d\"/>\n<path d=\"M16 60l4-1 9-1 8 2 1 3H18z\" fill=\"#08202b\"/><path d=\"M34 60l1 5\" stroke=\"#08202b\" stroke-width=\"2.600\" stroke-linecap=\"round\"/>\n<circle cx=\"26\" cy=\"39\" r=\"3.800\" fill=\"#f2c9a5\"/><path d=\"M20 37.500h13l-2-2.500a4 4 0 0 0-9 0z\" fill=\"#16384a\"/><path d=\"M18 38h17\" stroke=\"#16384a\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n<path d=\"M30 47Q34 48 34 49\" stroke=\"#f2c9a5\" stroke-width=\"2.200\" stroke-linecap=\"round\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>", "lake": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc2\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc2)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"0\" width=\"96\" height=\"26\" fill=\"#2b7893\"/>\n<path d=\"M0 22L22 12 42 30 0 44z\" fill=\"#2f6f52\"/><path d=\"M96 14L72 24 54 30 96 46z\" fill=\"#2f6f52\"/>\n<path d=\"M0 36L28 28 40 34 0 58z\" fill=\"#245a42\"/><path d=\"M96 40L68 30 54 34 96 62z\" fill=\"#245a42\"/>\n<rect x=\"30\" y=\"32\" width=\"36\" height=\"5\" fill=\"#2a8aa6\"/>\n<path d=\"M22 36H74L82 62H14z\" fill=\"#d6e2e5\"/><path d=\"M22 36H74\" stroke=\"#e8f2f5\" stroke-width=\"2.400\"/>\n<rect x=\"26\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"36\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"46\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"56\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"66\" y=\"38\" width=\"4\" height=\"9\" fill=\"#6f8f98\"/>\n<path d=\"M28 47l-2 15M38 47l-2 15M48 47l-1 15M58 47l1 15M68 47l2 15\" stroke=\"#e8f2f5\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\".85\"/>\n<path d=\"M0 62H96V96H0z\" fill=\"#0f5c76\"/><path d=\"M0 62C20 58 34 66 50 62S80 58 96 62V70C80 66 66 74 48 70S16 66 0 70z\" fill=\"#0b475d\"/>\n<path d=\"M0 62L14 62 6 96H0zM96 62L82 62 90 96H96z\" fill=\"#245a42\"/><path d=\"M30 70c6-2 10 2 16 0s10 2 16 0\" stroke=\"#e8f2f5\" stroke-opacity=\".5\" stroke-width=\"1.800\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>", "spear": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc3\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc3)\"><rect width=\"96\" height=\"96\" fill=\"#14627c\"/><rect y=\"46\" width=\"96\" height=\"50\" fill=\"#0e4d64\"/><rect y=\"74\" width=\"96\" height=\"22\" fill=\"#0a3548\"/>\n<path d=\"M14 0h12l14 80H24zM44 0h9l18 80H58z\" fill=\"#e8f2f5\" opacity=\".08\"/>\n<path d=\"M0 8c10-4 20 4 30 0s20 4 30 0 24 4 36 0\" stroke=\"#e8f2f5\" stroke-opacity=\".4\" stroke-width=\"1.800\" fill=\"none\"/>\n<path d=\"M0 86c14-8 26 2 42-2s26 4 40-2 10 0 14-2v18H0z\" fill=\"#06202b\"/>\n<path d=\"M72 30q6-6 14 0-8 6-14 0zM86 30l5-4v8z\" fill=\"#8fb6c4\"/><circle cx=\"76\" cy=\"29.500\" r=\"1\" fill=\"#08202b\"/>\n<g transform=\"translate(2,6) scale(.94)\"><g fill=\"#08202b\" stroke=\"#08202b\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n<ellipse cx=\"62\" cy=\"44\" rx=\"6.200\" ry=\"4.600\" stroke=\"none\"/>\n<path d=\"M57 42L52 40 40 44 28 51 25 55 31 58 44 53 56 49z\" stroke-width=\"1\"/>\n<path d=\"M58 47Q68 47 76 49.500\" fill=\"none\" stroke-width=\"4.600\"/>\n<path d=\"M28 53L16 59 8 58\" fill=\"none\" stroke-width=\"5.400\"/><path d=\"M30 56L20 63 12 66\" fill=\"none\" stroke-width=\"4.800\"/>\n<path d=\"M8 58L1 54 2 61 9 64z\" stroke-width=\"1\"/><path d=\"M12 66L5 64 4 71 12 70z\" stroke-width=\"1\"/>\n<path d=\"M65 40L63 31\" fill=\"none\" stroke-width=\"1.800\"/><path d=\"M63 31h-3\" fill=\"none\" stroke-width=\"1.800\"/></g>\n<rect x=\"62\" y=\"41.800\" width=\"5\" height=\"3.400\" rx=\"1.200\" fill=\"#8fd3e2\"/>\n<path d=\"M66 49.500L95 48.800\" stroke=\"#08202b\" stroke-width=\"2.200\" stroke-linecap=\"round\"/><path d=\"M95 48.800l-6.500-1.800 .2 3.200z\" fill=\"#ff6a3d\" stroke=\"none\"/></g>\n<circle cx=\"72\" cy=\"22\" r=\"2.200\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".6\"/><circle cx=\"76\" cy=\"14\" r=\"1.600\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".5\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>"};
    var PD={boat:T('Θάλασσα, κύμα, MOB και SOS','Sea, waves, MOB and SOS'),shore:T('Τεχνικές στεριάς, χωρίς MOB','Shore techniques, no MOB'),lake:T('Τεχνικές λίμνης, χωρίς κύμα','Lake techniques, no waves'),spear:T('Τεχνικές κατάδυσης, επαφή ασφαλείας','Diving techniques, safety contact')};
    ['boat','shore','lake','spear'].forEach(function(k){ var b=document.createElement('button'); b.type='button'; b.dataset.p=k;
      b.innerHTML='<i class="ndck" aria-hidden="true"></i><span class="ndpic" aria-hidden="true">'+PIC[k]+'</span><b></b><span class="ndpd"></span>'; b.querySelector('b').textContent=PN[k]; b.querySelector('.ndpd').textContent=PD[k];
      b.addEventListener('click',function(){ if(window.AlkyonFProf) window.AlkyonFProf.set(k); try{ localStorage.setItem('alkyon-fprof-done','1'); }catch(e){} draw(); }); pkb.appendChild(b); });
    if(window.AlkyonPicker){ pkb.classList.remove('seg'); pkb.removeAttribute('role'); window.AlkyonPicker.render(pkb,{instant:true}); }
    ov.querySelector('.ndobk').addEventListener('click',close);
    ov.querySelector('.ndobs').addEventListener('click',function(){ close(); var np=document.getElementById('navProf'); if(np) np.click(); setTimeout(function(){ if(window.AlkyonProfGo) window.AlkyonProfGo('safety'); else { var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){ return x.offsetParent&&/^(Settings|Ρυθμίσεις)$/.test(x.textContent.trim()); })[0]; if(b) b.click(); } var n=0, t=setInterval(function(){ n++; var c=document.getElementById('pContacts'), f=document.getElementById('sfName');
      if(c&&c.offsetParent&&f){ clearInterval(t); try{ c.scrollIntoView({block:'start',behavior:'smooth'}); }catch(e){ c.scrollIntoView(); }
        c.classList.add('ndflash'); setTimeout(function(){ c.classList.remove('ndflash'); },2200); setTimeout(function(){ try{ f.focus({preventScroll:true}); }catch(e){} },450); }
      else if(n>20) clearInterval(t); },150); },350); });
    document.body.appendChild(ov); document.addEventListener('keydown',key); draw(); try{ ov.querySelector('.ndobn').focus({preventScroll:true}); }catch(x){}
  }
  window.AlkyonTour=function(){ open(true); };
  window.AlkyonPickProfile=function(){ open(true,true); };
  /* υπάρχοντες χρήστες που δεν έχουν διαλέξει ακόμα τύπο ψαρέματος: μία φορά */
  function fpUnset(){ try{ return !localStorage.getItem('alkyon-fprof-done'); }catch(x){ return false; } }
  var decided=false, dtimer=null;
  function decide(){
    if(decided||ov) return;
    if(document.documentElement.classList.contains('gated')) return;
    if(!document.querySelector('.ndcard,.ndsearch')||!window.AlkyonFProf) return;
    decided=true; clearInterval(dtimer);
    var known=seen()||hasData();
    if(known){ if(!seen()) done(); }
    else setTimeout(function(){ if(!ov) open(false); },900);
  }
  /* ξεκινά και ξανά μετά από σύνδεση (όταν φεύγει η οθόνη εισόδου), χωρίς χρονικό όριο */
  function arm(){ if(decided) return; clearInterval(dtimer); dtimer=setInterval(decide,700); decide(); }
  arm();
  try{ new MutationObserver(function(){ if(!document.documentElement.classList.contains('gated')) arm(); }).observe(document.documentElement,{attributes:true,attributeFilter:['class']}); }catch(x){}
})();

/* Ειδοποίηση νέας έκδοσης: όταν ανεβαίνουν νέα αρχεία, ο χρήστης βλέπει «Νέα έκδοση» και ανανεώνει όταν θέλει (ποτέ μέσα σε έξοδο) */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  var bar_v='', bar=null, dismissedV='', had=!!(navigator.serviceWorker&&navigator.serviceWorker.controller);
  function show(v){
    if(bar||(v&&dismissedV===v)) return; bar_v=v;
    bar=document.createElement('div'); bar.className='ndupd'; bar.setAttribute('role','status');
    bar.innerHTML='<span></span><button type="button" class="ndupgo"></button><button type="button" class="ndupx" aria-label="✕">✕</button>';
    bar.querySelector('span').textContent=T('Νέα έκδοση διαθέσιμη','A new version is available');
    bar.querySelector('.ndupgo').textContent=T('Ανανέωση','Update');
    bar.querySelector('.ndupgo').addEventListener('click',function(){
      var go=function(){ location.reload(); };
      try{ if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function(rg){ return rg?rg.update():0; }).catch(function(){}).then(function(){ return window.caches?caches.keys():[]; }).then(function(ks){ return Promise.all((ks||[]).filter(function(k){ return /^alkyon-\d/.test(k)&&k!=='alkyon-'+window.ALKYON_VERSION; }).map(function(k){ return caches.delete(k); })); }).then(go,go); else go(); }catch(e){ go(); } });
    bar.querySelector('.ndupx').addEventListener('click',function(){ dismissedV=bar_v||'x'; bar.remove(); bar=null; });
    document.body.appendChild(bar);
  }
  function ready(){ return !document.body.classList.contains('ontrip'); }
  /* συγκρίνουμε αριθμητικά (v31z269 → 269): μια παλιά αντίγραφη του server δεν πρέπει να εμφανίζει «νέα έκδοση» */
  function num(v){ var s=/^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(v||''); if(s) return 1e7+(+s[1])*1e4+(+s[2])*100+(+(s[3]||0)); var m=/v(\d+)z(\d+)/.exec(v||''); return m?+m[1]*1000+(+m[2]):0; }
  function check(){
    if(!navigator.onLine||!window.ALKYON_VERSION) return;
    fetch('version.js?_='+Date.now(),{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; }).then(function(t){
      var m=/ALKYON_VERSION\s*=\s*'([^']+)'/.exec(t||''); if(m&&num(m[1])>num(window.ALKYON_VERSION)&&ready()) show(m[1]); }).catch(function(){});
  }
  if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange',function(){ setTimeout(check,1500); });
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') check(); });
  setTimeout(check,8000); setInterval(check,15*60*1000);
  /* μετά το τέλος εξόδου, αν περίμενε ενημέρωση */
  window.addEventListener('alkyon-tripend',function(){ setTimeout(check,3000); });
})();


/* Χειροκίνητος έλεγχος νέας έκδοσης (κουμπί κάτω από την έκδοση στα Settings) */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  function say(m){ try{ window.AlkyonCore.toast(m); }catch(e){} try{ window.dispatchEvent(new CustomEvent('alkyon-updmsg',{detail:m})); }catch(e){} }
  function num(v){ var s=/^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(v||''); if(s) return 1e7+(+s[1])*1e4+(+s[2])*100+(+(s[3]||0)); var m=/v(\d+)z(\d+)/.exec(v||''); return m?+m[1]*1000+(+m[2]):0; }
  function reload(){ var go=function(){ location.reload(); };
    try{ (navigator.serviceWorker&&navigator.serviceWorker.getRegistration?navigator.serviceWorker.getRegistration().then(function(rg){ return rg?rg.update():0; }):Promise.resolve()).catch(function(){}).then(function(){ return window.caches?caches.keys():[]; }).then(function(ks){ return Promise.all((ks||[]).filter(function(k){ return /^alkyon-\d/.test(k)&&k!=='alkyon-'+window.ALKYON_VERSION; }).map(function(k){ return caches.delete(k); })); }).then(go,go); }catch(e){ go(); } }
  function check(btn){
    if(!navigator.onLine){ say(T('Δεν υπάρχει σύνδεση στο ίντερνετ.','No internet connection.')); return; }
    btn.disabled=true; var old=btn.textContent; btn.textContent=T('Έλεγχος…','Checking…');
    fetch('version.js?_='+Date.now(),{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; }).then(function(t){
      var m=/ALKYON_VERSION\s*=\s*'([^']+)'/.exec(t||'');
      if(!m){ say(T('Δεν μπόρεσα να ελέγξω. Δοκίμασε ξανά.','Could not check. Try again.')); }
      else if(num(m[1])>num(window.ALKYON_VERSION)){ say(T('Νέα έκδοση '+m[1]+'. Ανανέωση…','New version '+m[1]+'. Updating…')); setTimeout(reload,700); return; }
      else say(T('Έχεις την τελευταία έκδοση ('+window.ALKYON_VERSION+').','You have the latest version ('+window.ALKYON_VERSION+').'));
    }).catch(function(){ say(T('Δεν μπόρεσα να ελέγξω. Δοκίμασε ξανά.','Could not check. Try again.')); }).then(function(){ btn.disabled=false; btn.textContent=old; });
  }
  function put(){
    var v=document.getElementById('appVer'); if(!v||document.getElementById('ndChkUpd')) return;
    var b=document.createElement('button'); b.type='button'; b.id='ndChkUpd'; b.className='btn ghost sm'; b.textContent=T('Έλεγχος για νέα έκδοση','Check for updates');
    b.style.cssText='display:block;margin:8px auto 0'; b.addEventListener('click',function(){ check(b); });
    v.after(b);
  }
  put(); window.ndEvery(put,5000);
})();

/* Διαγραφή λογαριασμού: πρώτα έλεγχος ότι η υπηρεσία υπάρχει στον διακομιστή, μετά σβήσιμο δεδομένων cloud και λογαριασμού */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  function say(m){ try{ window.AlkyonCore.toast(m); }catch(e){} }
  window.ndEvery(function(){ var d=document.getElementById('ndDelAcc'); if(d) d.hidden=!(window.AlkyonCloud&&window.AlkyonCloud.logged&&window.AlkyonCloud.logged()); },1500);
  window.AlkyonDeleteAccount=async function(){
    var C=window.AlkyonCloud, A=window.AlkyonAsk; if(!C||!C.logged()||!A) return;
    var word=T('ΔΙΑΓΡΑΦΗ','DELETE');
    var sure=await A(T('Σίγουρα θέλεις να διαγράψεις τον λογαριασμό σου; Θα χαθούν οριστικά τα δεδομένα σου στο cloud και δεν μπορεί να αναιρεθεί.','Are you sure you want to delete your account? Your cloud data will be permanently lost and this cannot be undone.'),{title:T('Διαγραφή λογαριασμού','Delete account'),ok:T('Ναι, συνέχεια','Yes, continue'),cancel:T('Άκυρο','Cancel'),danger:true});
    if(!sure) return;
    var v=await A.prompt(T('Θα διαγραφεί ο λογαριασμός σου και όσα δεδομένα έχουν συγχρονιστεί στο cloud. Δεν μπορεί να αναιρεθεί. Τα δεδομένα στο κινητό μένουν.\n\nΓράψε '+word+' για να συνεχίσεις.','Your account and everything synced to the cloud will be deleted. This cannot be undone. Data on this phone stays.\n\nType '+word+' to continue.'),{title:T('Διαγραφή λογαριασμού','Delete account'),ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel')});
    if(!v||v.trim().toUpperCase()!==word){ if(v!==null) say(T('Δεν έγινε διαγραφή.','Nothing was deleted.')); return; }
    try{
      try{ await C.rest('rpc/delete_my_account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dry:true})}); }
      catch(e){ say(T('Η διαγραφή λογαριασμού δεν έχει ενεργοποιηθεί ακόμα στον διακομιστή. Δεν διαγράφηκε τίποτα.','Account deletion is not enabled on the server yet. Nothing was deleted.')); return; }
      try{ await C.rest('records?id=not.is.null',{method:'DELETE'}); }catch(e){}
      try{ await C.rest('safety_trips?id=not.is.null',{method:'DELETE'}); }catch(e){}
      try{ await C.rest('safety_contacts?updated_at=not.is.null',{method:'DELETE'}); }catch(e){}
      try{ var pup=JSON.parse(localStorage.getItem('alkyon-pup')||'{}'), uid=C.uid(); for(var k in pup){ try{ await C.storage('DELETE','photos/'+uid+'/'+k+'.jpg'); }catch(e){} } }catch(e){}
      await C.rest('rpc/delete_my_account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dry:false})});
      try{ ['alkyon-sess','alkyon-last','alkyon-pup'].forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
      say(T('Ο λογαριασμός διαγράφηκε.','Your account was deleted.')); setTimeout(function(){ location.reload(); },1200);
    }catch(e){ say(T('Η διαγραφή απέτυχε. Δοκίμασε ξανά.','Deletion failed. Try again.')); }
  };
})();

/* Χαμηλή μπαταρία κατά την έξοδο (20% και 10%) */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  if(!navigator.getBattery) return;
  var warned={20:false,10:false}, bar=null;
  function show(txt){ if(bar) bar.remove(); bar=document.createElement('div'); bar.className='ndupd ndbat'; bar.setAttribute('role','alert');
    bar.innerHTML='<span></span><button type="button" class="ndupx" aria-label="✕">✕</button>'; bar.querySelector('span').textContent=txt;
    bar.querySelector('.ndupx').addEventListener('click',function(){ bar.remove(); bar=null; }); document.body.appendChild(bar);
    try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){} }
  function chk(b){ if(!document.body.classList.contains('ontrip')) return; if(b.charging){ warned[20]=warned[10]=false; return; }
    var p=Math.round(b.level*100);
    if(p<=10&&!warned[10]){ warned[10]=warned[20]=true; show(T('Μπαταρία '+p+'%. Φόρτισε τώρα ή κλείσε ό,τι δεν χρειάζεσαι.','Battery '+p+'%. Charge now or close what you do not need.')); }
    else if(p<=20&&p>10&&!warned[20]){ warned[20]=true; show(T('Μπαταρία '+p+'%. Η έξοδος συνεχίζει να καταγράφεται.','Battery '+p+'%. The trip keeps being recorded.')); }
    if(p>25){ warned[20]=warned[10]=false; } }
  navigator.getBattery().then(function(b){ b.addEventListener('levelchange',function(){ chk(b); }); b.addEventListener('chargingchange',function(){ chk(b); }); setInterval(function(){ chk(b); },60000); }).catch(function(){});
})();

/* Ζωντανή κατάσταση εξόδου: χρονόμετρο, ψάρια, χιλιόμετρα και ώρα επιστροφής πάνω από τον χάρτη */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  var pill=null, tmr=null;
  function p2(n){ return (n<10?'0':'')+n; }
  function hm(ms){ var d=new Date(ms); return p2(d.getHours())+':'+p2(d.getMinutes()); }
  /* v31z370: επόμενη περίοδος σελήνης (Knight) στη λωρίδα: «🌙 τώρα κύρια» ή «🌙 15:01 κύρια» */
  var mC={t:0,v:''};
  function moonNext(){
    var now=Date.now(); if(now-mC.t<60000) return mC.v; mC.t=now; mC.v='';
    try{ var PF=window.PF; if(!PF||!PF.solunarPeriods) return ''; var N=window.AlkyonNav, c=window.AlkyonCore.getCond&&window.AlkyonCore.getCond();
      var lat=N&&N.lat!=null?+N.lat:(c&&c.lat!=null?+c.lat:35), lon=N&&N.lon!=null?+N.lon:(c&&c.lon!=null?+c.lon:33);
      var per=window.ndSol(Math.floor(now/3600000)*3600000-3*3600000,Math.floor(now/3600000)*3600000+18*3600000,lat,lon).filter(function(p){ return p.e>now; }).sort(function(a,b){ return a.s-b.s; })[0];
      if(per){ var k=per.kind==='major'?T('κύρια','major'):T('δευτ.','minor'); mC.v='🌙 '+(per.s<=now?T('τώρα ','now ')+k:hm(per.s)+' '+k); } }catch(e){}
    return mC.v;
  }
  function build(){
    var host=document.querySelector('.ndsearch'); host=host&&host.parentNode; if(!host) return false;
    pill=document.createElement('div'); pill.className='ndlive'; pill.setAttribute('role','status'); pill.hidden=true;
    pill.innerHTML='<span class="ndld" aria-hidden="true"></span><b class="ndlt">00:00</b><span class="ndls"></span>';
    host.appendChild(pill); return true;
  }
  function tick(){
    var on=document.body.classList.contains('ontrip'); if(!pill&&!build()) return;
    var s=null; try{ s=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); }catch(e){}
    if(!on||!s||!s.active||!s.start){ pill.hidden=true; return; }
    pill.hidden=false;
    var sec=Math.max(0,Math.floor((Date.now()-s.start)/1000)), h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), x=sec%60;
    pill.querySelector('.ndlt').textContent=(h?h+':'+p2(m):p2(m))+':'+p2(x);
    var n=0, km=0; try{ n=window.AlkyonTrip.counts().n||0; }catch(e){} try{ km=window.AlkyonTrack&&window.AlkyonTrack.km?window.AlkyonTrack.km():0; }catch(e){}
    var parts=[n+' '+(n===1?T('ψάρι','fish'):T('ψάρια','fish'))];
    try{ if(window.ndLiveFirst){ var f0=window.ndLiveFirst(); if(f0) parts[0]=f0; } }catch(e){} /* ψαροντούφεκο: «στο νερό · 1 ψάρι · 3 είδα» */
    if(km>=0.05) parts.push(km.toFixed(1)+' km');
    var mn=moonNext(); if(mn) parts.push(mn);
    if(s.due) parts.push(T('επιστροφή ','back ')+hm(s.due));
    /* v31z406: αλλάζει μόνο ό,τι άλλαξε (πριν ξαναγραφόταν κάθε δευτερόλεπτο και έκανε blinking) */
    var ls=pill.querySelector('.ndls'), sig=parts.join('|');
    if(ls.dataset.sig!==sig){ ls.dataset.sig=sig; ls.textContent=''; var s1=document.createElement('span'); s1.textContent=parts[0]; ls.appendChild(s1);
      if(parts.length>1){ var s2=document.createElement('span'); s2.className='ndlx'; s2.textContent=' · '+parts.slice(1).join(' · '); ls.appendChild(s2); } }
    pill.classList.toggle('late',!!(s.due&&Date.now()>s.due));
  }
  tmr=setInterval(tick,1000); document.addEventListener('visibilitychange',tick);
})();

/* «pop» στο σήμα των κουμπιών ψαριού όταν αλλάζει ο αριθμός */
(function(){
  var last=new WeakMap();
  window.ndEvery(function(){
    [].forEach.call(document.querySelectorAll('#fbCatchN,#fbMissN'),function(b){
      var v=b.textContent; if(last.has(b)&&last.get(b)!==v){ b.classList.remove('ndpop'); void b.offsetWidth; b.classList.add('ndpop'); } last.set(b,v); });
  },500);
})();

/* Φύλλα (φόρμα ψαριού, έξοδος): κλείνουν σέρνοντας τη λαβή προς τα κάτω */
(function(){
  var PAIRS=[['#sheet .sheet-in','bClose'],['#tripSheet .pbox','tripClose']];
  function wire(pn,closeId){
    if(pn.querySelector(':scope>.ndgrab')) return;
    var cs=getComputedStyle(pn); if(cs.position==='static') pn.style.position='relative';
    var g=document.createElement('div'); g.className='ndgrab'; g.setAttribute('aria-hidden','true'); g.innerHTML='<i></i>'; pn.insertBefore(g,pn.firstChild);
    var y0=null, dy=0, t0=0;
    g.addEventListener('pointerdown',function(e){ y0=e.clientY; dy=0; t0=Date.now(); pn.style.transition='none'; try{ g.setPointerCapture(e.pointerId); }catch(x){} });
    g.addEventListener('pointermove',function(e){ if(y0==null) return; dy=Math.max(0,e.clientY-y0); pn.style.transform='translateY('+dy+'px)'; });
    function end(){ if(y0==null) return; var fast=dy/Math.max(1,Date.now()-t0)>0.6; var shut=dy>110||(fast&&dy>40); y0=null;
      pn.style.transition='transform .2s ease'; if(shut){ pn.style.transform='translateY(100%)'; setTimeout(function(){ var b=document.getElementById(closeId); if(b) b.click(); pn.style.transition='none'; pn.style.transform=''; },180); } else { pn.style.transform=''; setTimeout(function(){ pn.style.transition=''; },220); } }
    g.addEventListener('pointerup',end); g.addEventListener('pointercancel',end);
  }
  function run(){ PAIRS.forEach(function(p){ var pn=document.querySelector(p[0]); if(pn) wire(pn,p[1]); }); }
  run(); setTimeout(run,1500);
})();

/* Today: επιλογή συγκεκριμένης ημέρας και ώρας, με καιρό και bite forecast για εκείνη την ώρα */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore, PU=window.AlkyonUnits;
  if(!C) return;
  var host=document.getElementById('liveBox'); if(!host||!host.parentNode) return;
  function p2(n){ return (n<10?'0':'')+n; }
  var card=document.createElement('div'); card.className='card ndhr'; card.hidden=true;
  card.innerHTML='<h3></h3><p class="note ndhrp"></p><div class="ndhrd" role="tablist"></div><div class="ndhrh" role="listbox"></div><div class="ndhrr" aria-live="polite"></div><p class="note ndhrn"></p>';
  card.querySelector('h3').textContent=T('Καιρός και ψάρεμα ανά ώρα','Weather and fishing by hour');
  card.querySelector('.ndhrn').textContent=T('Η πρόγνωση ανά ώρα προέρχεται από το Open-Meteo και δεν αντικαθιστά επίσημη πρόγνωση. Ώρες τοπικές για το σημείο.','Hourly data from Open-Meteo. Not an official forecast. Times are local to the place.');
  host.parentNode.insertBefore(card,host.nextSibling);
  var dEl=card.querySelector('.ndhrd'), hEl=card.querySelector('.ndhrh'), rEl=card.querySelector('.ndhrr'), pEl=card.querySelector('.ndhrp');
  var fc=null, key='', at=0, selD=0, selH=null, busy=false;
  var DN=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
  function lvl(v){ return v>=75?'g':v>=60?'l':v>=45?'w':'b'; }
  function verdict(v){ return v>=75?T('Πολύ καλές προϋποθέσεις','Very good conditions'):v>=60?T('Καλές προϋποθέσεις','Good conditions'):v>=45?T('Μέτριες προϋποθέσεις','Fair conditions'):T('Δύσκολες προϋποθέσεις','Poor conditions'); }
  function dirTxt(d){ if(d==null) return ''; var N=['N','NE','E','SE','S','SW','W','NW']; return N[Math.round(((d%360)+360)%360/45)%8]; }
  function dayLab(date,i){ if(i===0) return T('Σήμερα','Today'); if(i===1) return T('Αύριο','Tomorrow'); var d=new Date(date+'T12:00:00Z'); return DN[d.getUTCDay()]+' '+date.slice(8)+'/'+date.slice(5,7); }
  function u(fn,v,a){ try{ return PU&&PU[fn]?PU[fn](v,a):''; }catch(e){ return ''; } }
  function tile(lab,val,sub){ var t=document.createElement('div'); t.className='ndhrt'; var b=document.createElement('b'); b.textContent=val; var l=document.createElement('span'); l.textContent=lab; t.append(b,l); if(sub){ var s=document.createElement('small'); s.textContent=sub; t.append(s); } return t; }
  var PT={slow:T('Πέφτει αργά','Falling slowly'),stable:T('Σταθερή','Steady'),rise:T('Ανεβαίνει','Rising'),fast:T('Πέφτει απότομα','Falling fast')};
  var CL={clear:T('Καθαρός','Clear'),part:T('Λίγα σύννεφα','Partly cloudy'),over:T('Συννεφιά','Overcast')};
  function makeView(hEl,rEl,getDay,getFc,labFn){
    var selH=null;
  function renderHours(){
    var d=getDay(), fc=getFc(); hEl.replaceChildren(); if(!d) return;
    var nowH=fc.nowLocal.slice(0,13), today=fc.nowLocal.slice(0,10);
    d.hours.forEach(function(h){
      var b=document.createElement('button'); b.type='button'; b.className='ndhc'; b.dataset.lv=lvl(h.score); b.dataset.h=h.hr; b.setAttribute('role','option');
      var past=d.date===today&&h.t.slice(0,13)<nowH; if(past) b.classList.add('past');
      var a=document.createElement('b'); a.textContent=p2(h.hr); var s=document.createElement('i'); s.textContent=h.score; b.append(a,s);
      if(h.rain!=null&&h.rain>=20){ var rn=document.createElement('small'); rn.textContent='💧'+Math.round(h.rain)+'%'; rn.style.cssText='display:block;font-size:10px;line-height:1.1;margin-top:2px;white-space:nowrap'; b.append(rn); }
      b.setAttribute('aria-label',p2(h.hr)+':00 · '+T('βαθμός ','score ')+h.score+(h.rain!=null&&h.rain>=20?' · '+T('βροχή ','rain ')+Math.round(h.rain)+'%':'')); b.setAttribute('aria-selected',h.hr===selH?'true':'false');
      if(h.hr===selH) b.classList.add('on');
      b.addEventListener('click',function(){ selH=h.hr; renderHours(); renderDetail(); });
      hEl.append(b);
    });
    var on=hEl.querySelector('.on'); if(on&&on.scrollIntoView){ try{ hEl.scrollLeft=Math.max(0,on.offsetLeft-hEl.clientWidth/2+on.offsetWidth/2); }catch(e){} }
  }
  function renderDetail(){
    var d=getDay(), h=d&&d.hours.filter(function(x){ return x.hr===selH; })[0]; rEl.replaceChildren(); if(!h) return;
    var top=document.createElement('div'); top.className='ndhrtop';
    var sc=document.createElement('div'); sc.className='ndhrsc'; sc.dataset.lv=lvl(h.score); sc.innerHTML='<b></b><span>/100</span>'; sc.firstChild.textContent=h.score;
    var tx=document.createElement('div'); tx.className='ndhrtx'; var t1=document.createElement('b'); t1.textContent=labFn(d)+' · '+p2(h.hr)+':00'; var t2=document.createElement('span'); t2.textContent=verdict(h.score);
    var fp=(window.AlkyonFProf&&window.AlkyonFProf.get())||'boat', okc=h.safe, msgOk, msgNo;
    var wv=h.wave==null?0:h.wave, gs=h.gust==null?0:h.gust, st=h.code!=null&&h.code>=95;   /* όρια ενδεικτικά, δική μου εκτίμηση */
    if(fp==='shore'){ okc=!(wv>=1.5||gs>=30||st); msgOk=T('Ήπιες συνθήκες για ψάρεμα από στεριά','Mild conditions for shore fishing'); msgNo=T('Προσοχή: δυνατό κύμα ή ριπές στην ακτή. Μην πλησιάζεις τους βράχους.','Caution: strong waves or gusts at the shore. Stay away from the rocks.'); }
    else if(fp==='lake'){ okc=!(h.wind>=20||gs>=28||st); msgOk=T('Ήπιες συνθήκες για ψάρεμα σε λίμνη','Mild conditions for lake fishing'); msgNo=T('Προσοχή: δυνατός άνεμος ή καταιγίδα','Caution: strong wind or storm'); }
    else if(fp==='spear'){ okc=!(wv>0.6||h.wind>=12||gs>=22||st); msgOk=T('Ήπιες συνθήκες για κατάδυση','Mild conditions for diving'); msgNo=T('Δύσκολες συνθήκες για κατάδυση: κύμα ή άνεμος','Difficult diving conditions: waves or wind'); }
    else { msgOk=T('Ασφαλές για μικρό σκάφος','Suitable for a small boat'); msgNo=T('Όχι ασφαλές για μικρό σκάφος','Not safe for a small boat'); }
    var pill=document.createElement('em'); pill.className='ndhrsf'+(okc?'':' no'); pill.textContent=okc?msgOk:msgNo;
    tx.append(t1,t2,pill); top.append(sc,tx); rEl.append(top);
    var g=document.createElement('div'); g.className='ndhrg';
    g.append(tile(T('Άνεμος','Wind'),u('wind',h.wind)+(h.dir!=null?' '+dirTxt(h.dir):''),h.gust!=null?T('Ριπές ','Gusts ')+u('wind',h.gust):''));
    var lakeP=window.AlkyonFProf&&window.AlkyonFProf.get()==='lake';
    if(h.wave!=null&&!lakeP) g.append(tile(T('Κύμα','Waves'),u('wave',h.wave),h.period!=null?Math.round(h.period)+' s':''));
    if(h.temp!=null) g.append(tile(T('Αέρας','Air'),u('temp',h.temp),CL[h.cloud]||''));
    if(h.sst!=null&&!lakeP) g.append(tile(T('Θάλασσα','Sea'),u('temp',h.sst),''));
    if(h.pres!=null) g.append(tile(T('Πίεση','Pressure'),u('press',h.pres),PT[h.ptrend]||''));
    if(h.rain!=null) g.append(tile(T('Βροχή','Rain'),Math.round(h.rain)+'%',h.mm!=null&&h.mm>0?(Math.round(h.mm*10)/10)+' mm':''));
    rEl.append(g);
  }
    function centerOn(){ var on=hEl.querySelector('.on'); if(on) hEl.scrollLeft=Math.max(0,on.offsetLeft-hEl.clientWidth/2+on.offsetWidth/2); }
    return {setH:function(v){ selH=v; },getH:function(){ return selH; },hours:renderHours,detail:renderDetail,center:centerOn};
  }
  var view=makeView(hEl,rEl,function(){ return fc.days[0]; },function(){ return fc; },function(){ return T('Σήμερα','Today'); });
  function renderHours(){ view.hours(); } function renderDetail(){ view.detail(); } function centerOn(){ view.center(); }

  function load(){
    var cc=C.getViewCond&&C.getViewCond(); if(!cc||cc.lat==null||!window.PF){ card.hidden=true; return; }
    var k=cc.lat.toFixed(3)+','+cc.lon.toFixed(3);
    if(fc&&k===key&&Date.now()-at<20*60000){ card.hidden=false; return; }
    if(busy) return; busy=true; var firstTime=!fc||k!==key;
    if(firstTime) card.hidden=true;
    window.PF.getForecast(+cc.lat,+cc.lon,undefined,{days:4}).then(function(r){
      fc=r; key=k; at=Date.now(); busy=false; if(!fc.days.length){ card.hidden=true; return; }
      selD=Math.min(selD,fc.days.length-1);
      var nh=+fc.nowLocal.slice(11,13); if(view.getH()==null||firstTime){ selD=0; var d0=fc.days[0]; var nx=d0.hours.filter(function(h){ return h.hr>nh; })[0]||d0.hours[d0.hours.length-1]; view.setH(nx&&nx.hr); }
      var nm=document.getElementById('liveSub'); pEl.textContent=T('Για: ','For: ')+((cc.name||'')||T('το επιλεγμένο σημείο','the selected place'));
      card.hidden=false; renderHours(); renderDetail(); setTimeout(centerOn,60);
    }).catch(function(){ busy=false; if(!fc) card.hidden=true; });
  }
  ['alkyon-view','alkyon-cond'].forEach(function(ev){ document.addEventListener(ev,function(){ setTimeout(load,300); }); });
  document.addEventListener('click',function(e){ if(e.target.closest&&e.target.closest('[data-tab],[data-go]')) setTimeout(function(){ if(!card.hidden) centerOn(); },200); });
  setTimeout(load,2500); setInterval(function(){ var t=document.getElementById('tab-today'); if(t&&!t.hidden) load(); },60000);
  window.addEventListener('alkyon-units',function(){ if(fc&&!card.hidden) renderDetail(); });
  /* Επόμενες μέρες: ώρα-προς-ώρα μέσα σε κάθε μέρα της καρτέλας Πρόγνωση */
  dEl.hidden=true;
  var more=document.createElement('button'); more.type='button'; more.className='btn ghost sm ndhmore'; more.textContent=T('Επόμενες μέρες ανά ώρα → Πρόγνωση','Next days by hour → Forecast');
  more.addEventListener('click',function(){ try{ C.lsSet('alkyon-wxsub','fc'); C.switchTab('fc'); }catch(e){} });
  card.querySelector('.ndhrn').insertAdjacentElement('beforebegin',more);
  var fcData=null, fvs=[];
  window.addEventListener('alkyon-fcloaded',function(ev){ fcData=ev&&ev.detail&&ev.detail.fc||null; });
  function enhance(){
    var D=document.getElementById('fcDays'); if(!D||!fcData) return;
    fvs=[];
    Array.prototype.forEach.call(D.querySelectorAll('details.fday'),function(det){
      if(det.querySelector('.ndfdh')) return;
      var date=(det.id||'').slice(3), day=null; fcData.days.forEach(function(x){ if(x.date===date) day=x; });
      if(!day||!day.hours||!day.hours.length) return;
      var box=document.createElement('div'); box.className='ndfdh';
      var lb=document.createElement('div'); lb.className='label'; lb.style.marginTop='10px'; lb.textContent=T('Ώρα προς ώρα (πάτα ώρα)','Hour by hour (tap an hour)');
      var h2=document.createElement('div'); h2.className='ndhrh'; h2.setAttribute('role','listbox'); var r2=document.createElement('div'); r2.className='ndhrr'; r2.setAttribute('aria-live','polite');
      box.append(lb,h2,r2); det.append(box);
      var v=makeView(h2,r2,function(){ return day; },function(){ return fcData; },function(d){ var dt=new Date(d.date+'T12:00:00Z'); return (d.date===fcData.nowLocal.slice(0,10)?T('Σήμερα','Today'):DN[dt.getUTCDay()])+' '+d.date.slice(8)+'/'+d.date.slice(5,7); });
      var nh=+fcData.nowLocal.slice(11,13), isT=date===fcData.nowLocal.slice(0,10), pick=null;
      if(isT) pick=day.hours.filter(function(h){ return h.hr>nh; })[0];
      if(!pick){ pick=day.hours[0]; day.hours.forEach(function(h){ if(h.score>pick.score) pick=h; }); }
      v.setH(pick.hr); v.hours(); v.detail(); fvs.push(v);
      det.addEventListener('toggle',function(){ if(det.open) setTimeout(v.center,30); });
    });
  }
  var fcBox=document.getElementById('fcDays'); if(fcBox) new MutationObserver(function(){ setTimeout(enhance,0); }).observe(fcBox,{childList:true});
  window.addEventListener('alkyon-fcloaded',function(){ setTimeout(enhance,60); });
  function refreshAll(){ fvs.forEach(function(v){ try{ v.detail(); }catch(e){} }); }
  window.addEventListener('alkyon-units',refreshAll); window.addEventListener('alkyon-fprof',refreshAll);
  window.addEventListener('alkyon-fprof',function(){ if(fc&&!card.hidden) renderDetail(); });
})();

/* Τύπος ψαρέματος (προφίλ): Βάρκα, Από στεριά, Λίμνη/φράγμα, Ψαροντούφεκο. Αλλάζει τις τεχνικές, τα κουμπιά ασφαλείας και τον καιρό που φαίνεται. */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore;
  var KEY='alkyon-fprof', LIST=['boat','shore','lake','spear'];
  var NAME={boat:T('Βάρκα','Boat'),shore:T('Από στεριά','From shore'),lake:T('Λίμνη / φράγμα','Lake / dam'),spear:T('Ψαροντούφεκο','Spearfishing')};
  var DESC={
    boat:T('Έξοδος με σκάφος στη θάλασσα: καιρός θάλασσας, κύμα, MOB και SOS.','Boat trips at sea: marine weather, waves, MOB and SOS.'),
    shore:T('Ψάρεμα από ακτή ή μόλο: τεχνικές στεριάς, χωρίς MOB.','Fishing from a beach or pier: shore techniques, no MOB.'),
    lake:T('Γλυκό νερό: τεχνικές λίμνης, χωρίς κύμα και θερμοκρασία θάλασσας.','Fresh water: lake techniques, no waves or sea temperature.'),
    spear:T('Κατάδυση και ψαροντούφεκο: τεχνικές κατάδυσης. Ορίσε επαφή ασφαλείας πριν βουτήξεις.','Freediving and spearfishing: diving techniques. Set a safety contact before you dive.')};
  function get(){ var v=null; try{ v=localStorage.getItem(KEY); }catch(e){} return LIST.indexOf(v)>-1?v:'boat'; }
  function apply(){ var p=get(); LIST.forEach(function(k){ document.body.classList.toggle('fp-'+k,k===p); }); }
  function set(p){ if(LIST.indexOf(p)<0) return; try{ localStorage.setItem(KEY,p); }catch(e){} apply(); try{ window.dispatchEvent(new Event('alkyon-fprof')); }catch(e){} paint(); }
  var card=null;
  function paint(){ if(!card) return; var p=get(); [].forEach.call(card.querySelectorAll('button[data-p]'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.p===p)); }); card.querySelector('.ndfpd').textContent=DESC[p]; if(window.AlkyonPicker&&card.querySelector('.ndpk')&&!card.contains(document.activeElement)) window.AlkyonPicker.render(card.querySelector('.ndpk'),{instant:true}); }
  function build(){
    if(card) return card;
    card=document.createElement('div'); card.id='ndFProf'; card.className='card setcard';
    card.innerHTML='<h3></h3><div class="seg ndfps" role="group"></div><p class="note ndfpd"></p><h3 class="ndvh"></h3><div class="seg ndvs" role="group"></div><p class="note ndvn"></p>';
    card.querySelector('h3').textContent=T('Τύπος ψαρέματος','Fishing type');
    var sg=card.querySelector('.seg');
    if(window.AlkyonPicker){ sg.className='ndpk'; sg.removeAttribute('role'); window.AlkyonPicker.render(sg,{instant:true}); }
    else LIST.forEach(function(k){ var b=document.createElement('button'); b.type='button'; b.dataset.p=k; b.textContent=NAME[k]; b.addEventListener('click',function(){ set(k); }); sg.append(b); });
    var ab=document.createElement('button'); ab.type='button'; ab.className='btn ghost sm ndaskb';
    function askOn(){ var v=null; try{ v=localStorage.getItem('alkyon-askfp'); }catch(e){} return v!=='0'; }
    function askPaint(){ ab.textContent=(askOn()?'✓ ':'')+T('Ρώτα στο άνοιγμα της εφαρμογής','Ask when the app opens'); ab.setAttribute('aria-pressed',String(askOn())); }
    ab.addEventListener('click',function(){ try{ localStorage.setItem('alkyon-askfp',askOn()?'0':'1'); }catch(e){} askPaint(); }); askPaint();
    card.querySelector('.ndfpd').after(ab);
    card.querySelector('.ndvh').textContent=T('Γλώσσα μικροφώνου (φωνητική καταγραφή)','Microphone language (voice input)');
    card.querySelector('.ndvn').textContent=T('Για το μικρόφωνο στον χάρτη (έξοδος) και το «Πες το» στη φόρμα ψαριού. Λέγε τα ονόματα των ψαριών στη γλώσσα που διαλέγεις.','For the map microphone (during a trip) and “Say it” in the catch form. Say fish names in the language you pick here.');
    var vs=card.querySelector('.ndvs');
    function vget(){ var v=null; try{ v=JSON.parse(localStorage.getItem('alkyon-vlang')); }catch(e){} return v==='en-US'?'en-US':'el-GR'; }
    function vpaint(){ [].forEach.call(vs.querySelectorAll('button'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.v===vget())); }); }
    [['el-GR','Ελληνικά'],['en-US','English']].forEach(function(o){ var b=document.createElement('button'); b.type='button'; b.dataset.v=o[0]; b.textContent=o[1]; b.addEventListener('click',function(){ try{ if(C&&C.lsSet) C.lsSet('alkyon-vlang',o[0]); else localStorage.setItem('alkyon-vlang',JSON.stringify(o[0])); }catch(e){} vpaint(); }); vs.append(b); });
    vpaint(); paint(); return card;
  }
  window.AlkyonFProf={get:get,set:set,card:build,name:function(){ return window.AlkyonPicker?window.AlkyonPicker.label():NAME[get()]; }};
  apply(); new MutationObserver(function(){ if(!document.body.classList.contains('fp-'+get())) apply(); }).observe(document.body,{attributes:true,attributeFilter:['class']});
})();

/* Φύλλο από κάτω (bottom sheet): τα παράθυρα σημείων, ψαριών και λιμανιών ανοίγουν ως φύλλο που σέρνεται (μισό ή σχεδόν πλήρες) αντί για μικρό παράθυρο πάνω στον χάρτη */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore;
  if(!C) return;
  var sheet=null, body=null, st={h:0}, map=null, wired=false;
  function isNarrow(){ return window.innerWidth<=700; }
  function navTop(){ var n=document.querySelector('nav.tabs'); var r=n&&n.getBoundingClientRect(); return r&&r.height?window.innerHeight-r.top+8:84; }
  function maxH(){ return Math.max(220,window.innerHeight-navTop()-76); }
  function peekH(){ return Math.min(maxH(),Math.round(window.innerHeight*.5)); }
  function build(){
    sheet=document.createElement('div'); sheet.className='ndbs'; sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','false'); sheet.hidden=true;
    sheet.innerHTML='<div class="ndbsg" aria-hidden="true"><i></i></div><button type="button" class="ndbsx" aria-label="'+T('Κλείσιμο','Close')+'">✕</button><div class="ndbsb"></div>';
    document.body.appendChild(sheet); body=sheet.querySelector('.ndbsb');
    sheet.querySelector('.ndbsx').addEventListener('click',function(){ close(); try{ window.dispatchEvent(new Event('alkyon-bsx')); }catch(e){} });
    var g=sheet.querySelector('.ndbsg'), y0=null, h0=0, moved=false;
    g.addEventListener('pointerdown',function(e){ y0=e.clientY; h0=sheet.getBoundingClientRect().height; moved=false; sheet.style.transition='none'; try{ g.setPointerCapture(e.pointerId); }catch(x){} });
    g.addEventListener('pointermove',function(e){ if(y0==null) return; var dy=y0-e.clientY; if(Math.abs(dy)>3) moved=true; sheet.style.height=Math.max(60,Math.min(maxH(),h0+dy))+'px'; });
    function end(){ if(y0==null) return; y0=null; sheet.style.transition=''; var h=sheet.getBoundingClientRect().height, mx=maxH(), pk=peekH();
      if(!moved){ sheet.style.height=(h>pk+30?pk:mx)+'px'; return; }
      if(h<pk*0.55){ close(); return; } sheet.style.height=((Math.abs(h-mx)<Math.abs(h-pk))?mx:pk)+'px'; }
    g.addEventListener('pointerup',end); g.addEventListener('pointercancel',end);
    body.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('button,a'); if(!b||b.tagName==='A') return; setTimeout(function(){ if(!body.querySelector('.pdepth')||true) close(); },80); });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!sheet.hidden) close(); });
    var nav=document.querySelector('nav.tabs'); if(nav) nav.addEventListener('click',close);
    window.addEventListener('resize',function(){ if(!sheet.hidden) sheet.style.height=Math.min(sheet.getBoundingClientRect().height,maxH())+'px'; });
  }
  function open(nodes){
    if(!sheet) build();
    body.replaceChildren.apply(body,nodes);
    sheet.hidden=false; sheet.style.height=''; sheet.style.maxHeight=peekH()+'px';
    var nat=sheet.getBoundingClientRect().height; sheet.style.maxHeight=''; sheet.style.height=Math.min(peekH(),Math.max(160,nat))+'px';
    document.body.classList.add('ndbsopen'); body.scrollTop=0;
  }
  function close(){ if(!sheet||sheet.hidden) return; sheet.hidden=true; body.replaceChildren(); document.body.classList.remove('ndbsopen'); }
  /* v31z356: το σημείο μπαίνει στο ορατό κομμάτι του χάρτη, πάνω από το φύλλο και κάτω από τις μπάρες, ώστε να μην κρύβεται */
  function keepAbove(ll){
    function place(){
      try{ if(!map||!sheet||sheet.hidden) return;
        var mr=map.getContainer().getBoundingClientRect(), sr=sheet.getBoundingClientRect();
        var top=mr.top+(document.body.classList.contains('ontrip')?165:105), bot=Math.min(mr.bottom,sr.top)-12; if(bot-top<60) top=mr.top+40;
        var p=map.latLngToContainerPoint(ll), wantY=((top+bot)/2)-mr.top, wantX=mr.width/2;
        var dx=p.x-wantX, dy=p.y-wantY; if(Math.abs(dx)>4||Math.abs(dy)>4) map.panBy([dx,dy],{animate:true,duration:.3});
      }catch(e){}
    }
    if(map._flyToFrame) map.once('moveend',function(){ setTimeout(place,40); }); else setTimeout(place,60);
  }
  function wire(){
    if(wired) return; try{ map=C.map&&C.map(); }catch(e){ map=null; } if(!map) return; wired=true;
    map.on('popupopen',function(e){
      if(!isNarrow()) return; var pu=e.popup, el=pu&&pu.getElement&&pu.getElement(); if(!el) return;
      var ct=el.querySelector('.leaflet-popup-content'); if(!ct||!ct.childNodes.length) return;
      if(pu.options&&pu.options.className&&/nobs/.test(pu.options.className)) return;
      setTimeout(function(){
        if(!ct.childNodes.length) return;
        var nodes=[].slice.call(ct.childNodes), ll=pu.getLatLng&&pu.getLatLng(); open(nodes);
        try{ map.closePopup(pu); }catch(x){}
        if(ll) keepAbove(ll);
      },30);
    });
    map.on('click',function(){ if(sheet&&!sheet.hidden&&!document.body.classList.contains('ndbsjust')) {} });
  }
  var tries=0, iv=setInterval(function(){ tries++; wire(); if(wired||tries>40) clearInterval(iv); },500);
  window.AlkyonSheet={open:open,close:close};
})();
})();

/* Προφίλ ψαρέματος → εργαλεία χάρτη: κρύβει όσα δεν ταιριάζουν και ρυθμίζει τα επίπεδα όταν αλλάζεις προφίλ (μπορείς να τα αλλάξεις μετά χειροκίνητα) */
(function(){
  var LAY={ /* επιθυμητή κατάσταση επιπέδων ανά προφίλ: true=ανοιχτό, false=κλειστό */
    boat:{bZones:true,bPorts:true,bDams:true},
    shore:{bZones:true,bNav:true,bPorts:true,bDams:false},
    lake:{bDams:true,bZones:false,bNav:false,bPorts:false,bSea:false,bDepthMap:false},
    spear:{bZones:true,bNav:true,bPorts:true,bDepthMap:true,bSea:false,bDams:false}
  };
  var KEY='alkyon-fprof-lay';
  function prof(){ try{ var v=localStorage.getItem('alkyon-fprof'); return LAY[v]?v:'boat'; }catch(e){ return 'boat'; } }
  function pressed(b){ return b.getAttribute('aria-pressed')==='true'; }
  function applyLayers(p){
    var want=LAY[p]||{}, did=0;
    Object.keys(want).forEach(function(id){ var b=document.getElementById(id); if(!b) return;
      if(id==='bDepthMap'&&window.AlkyonDepthMode){ /* τα βάθη έχουν κύκλο καταστάσεων */
        var g=0; if(want[id]){ if(window.AlkyonDepthMode()===0){ try{ b.click(); did++; }catch(e){} } }
        else while(window.AlkyonDepthMode()!==0&&g++<6){ try{ b.click(); did++; }catch(e){ break; } }
        return; }
      if(pressed(b)!==want[id]){ try{ b.click(); did++; }catch(e){} } });
    return did;
  }
  function run(force){
    var p=prof(), last=null; try{ last=localStorage.getItem(KEY); }catch(e){}
    if(!document.getElementById('bZones')) return false;               /* ο χάρτης δεν είναι έτοιμος */
    if(last===p) return true;
    if(last==null&&p==='boat'&&!force){ try{ localStorage.setItem(KEY,p); }catch(e){} return true; }   /* υπάρχων χρήστης με Βάρκα: δεν αλλάζουμε τα επίπεδά του */
    applyLayers(p); try{ localStorage.setItem(KEY,p); }catch(e){}
    return true;
  }
  window.addEventListener('alkyon-fprof',function(){ setTimeout(function(){ run(true); },150); });
  var n=0, iv=setInterval(function(){ n++; if(run(false)||n>40) clearInterval(iv); },700);
})();

/* ---- Ανά προφίλ: λίστα «Πριν φύγεις», χρονόμετρο κατάδυσης, στατιστικά ανά τύπο ---- */
(function(){
  var en=function(){return window.LANG==='en';};
  var T=function(a,b){return en()?b:a;};
  var prof=function(){try{return localStorage.getItem('alkyon-fprof')||'boat';}catch(e){return 'boat';}};
  var LIST={
    boat:[['Σωσίβια για όλους','Lifejackets for everyone'],['Φορτισμένο κινητό / VHF','Charged phone / VHF'],['Εφεδρικό καύσιμο','Spare fuel'],['Άγκυρα και σχοινί','Anchor and rope'],['Πυρσοί / φακός','Flares / torch'],['Φάρμακα και νερό','First aid and water']],
    shore:[['Παπούτσια με πρόσφυση','Non-slip shoes'],['Φορτισμένο κινητό','Charged phone'],['Έλεγχος κύματος στα βράχια','Check the swell on the rocks'],['Είπα σε κάποιον πού πάω','Told someone where I am going'],['Νερό και αντηλιακό','Water and sunscreen'],['Φακός','Torch']],
    lake:[['Φορτισμένο κινητό','Charged phone'],['Είπα σε κάποιον πού πάω','Told someone where I am going'],['Νερό και αντηλιακό','Water and sunscreen'],['Σωσίβιο αν βγαίνω με βάρκα','Lifejacket if on a boat'],['Έλεγξα τους κανονισμούς του φράγματος','Checked the dam rules']],
    spear:[['Άδεια ψαροντουφέκου σε ισχύ (λήγει 31/12)','Valid spearfishing licence (expires 31/12)'],['Μακριά από περιοχές κολύμβησης (κόκκινες σημαδούρες)','Away from swimming areas (red buoys)'],['Σημαδούρα / πλωτήρας με σημαία','Dive float with flag'],['Συνοδός ή ενημέρωση επαφής','Buddy or contact informed'],['Μαχαίρι','Knife'],['Ρολόι / χρονόμετρο','Watch / timer'],['Χωρίς υπεραερισμό, χωρίς μοναχική κατάδυση','No hyperventilation, never dive alone']]
  };
  function checklist(){
    var f=document.getElementById('sfForm'), b=document.getElementById('sfStart');
    if(!f||!b) return;
    var old=document.getElementById('ndPre'); if(old) old.remove();
    var d=document.createElement('div'); d.id='ndPre'; d.className='sfsec';
    var h='<div class="sflabel">'+T('Πριν φύγεις','Before you go')+'</div>';
    LIST[prof()].forEach(function(r,i){ h+='<label style="display:flex;gap:10px;align-items:center;padding:6px 0;font-size:14px"><input type="checkbox" style="width:20px;height:20px"> <span>'+T(r[0],r[1])+'</span></label>'; });
    h+='<p class="note">'+T('Υπενθύμιση μόνο· δεν εμποδίζει την έναρξη.','Reminder only; it does not block starting.')+'</p>';
    d.innerHTML=h; f.insertBefore(d,b);
  }
  /* Χρονόμετρο κατάδυσης (ψαροτούφεκο) */
  var tm={on:false,t0:0,lastDive:0,lastSurf:0,s0:0,iv:null,lim:90}; window.AlkyonDive=tm;
  function fmt(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2);}
  function timer(){
    var a=document.getElementById('safeActive'); if(!a) return;
    var el=document.getElementById('ndDive');
    if(prof()!=='spear'){ if(el) el.remove(); return; }
    if(el) return;
    el=document.createElement('div'); el.id='ndDive'; el.className='card'; el.style.margin='10px 0';
    el.innerHTML='<div class="sflabel">'+T('Χρονόμετρο κατάδυσης','Dive timer')+'</div><div id="ndDv" style="font-size:34px;font-weight:700;text-align:center">0:00</div><p class="note" id="ndDn"></p><div class="row"><button class="btn acc big" id="ndDb" type="button">'+T('▼ Κατάδυση','▼ Dive')+'</button></div><label class="f" style="margin-top:8px">'+T('Όριο κατάδυσης (δευτ.)','Dive limit (s)')+'<input type="number" id="ndDl" min="20" max="300" value="90"></label><p class="note">'+T('Βοηθητικό εργαλείο· δεν αντικαθιστά συνοδό ούτε κρίση. Μην βουτάς μόνος και μη σπρώχνεις τα όριά σου.','Aid only; it does not replace a buddy or judgement. Never dive alone and do not push your limits.')+'</p>';
    a.insertBefore(el,a.firstChild.nextSibling);
    var btn=el.querySelector('#ndDb');
    btn.onclick=function(){
      var now=Date.now(), lim=Math.max(20,+el.querySelector('#ndDl').value||90);
      tm.lim=lim;
      if(!tm.on){ tm.on=true; try{ var st0=(window.AlkyonTrip.state()||{}).start||0, dk='alkyon-dives-'+st0; localStorage.setItem(dk,String((+localStorage.getItem(dk)||0)+1)); }catch(e){} if(tm.lastSurf) tm.surfInt=(now-tm.lastSurf)/1000; tm.t0=now; tm.warned=false; btn.textContent=T('▲ Επιφάνεια','▲ Surfaced'); }
      else { tm.on=false; tm.lastDive=(now-tm.t0)/1000; tm.lastSurf=now; btn.textContent=T('▼ Κατάδυση','▼ Dive'); }
      if(!tm.iv) tm.iv=setInterval(tick,500); tick();
    };
    function tick(){
      var now=Date.now(), v=document.getElementById('ndDv'), n=document.getElementById('ndDn'); if(!v){clearInterval(tm.iv);tm.iv=null;return;}
      if(tm.on){ var s=(now-tm.t0)/1000; v.textContent=fmt(s); v.style.color=s>=tm.lim?'#d33':''; 
        if(s>=tm.lim&&!tm.warned){ tm.warned=true; try{navigator.vibrate&&navigator.vibrate([400,200,400]);}catch(e){} try{window.AlkyonCore.toast&&window.AlkyonCore.toast(T('Έφτασες το όριο κατάδυσης — ανέβα','Dive limit reached - surface'));}catch(e){} } }
      else { v.style.color=''; v.textContent=tm.lastSurf?fmt((now-tm.lastSurf)/1000):'0:00'; }
      n.textContent=tm.lastDive?T('Τελευταία κατάδυση: ','Last dive: ')+fmt(tm.lastDive)+(tm.on?'':T(' · ανάπαυση στην επιφάνεια','  · surface interval')):'';
    }
  }
  /* Στατιστικά ανά τύπο ψαρέματος */
  var NM={boat:['Βάρκα','Boat'],shore:['Από στεριά','Shore'],lake:['Λίμνη / φράγμα','Lake / dam'],spear:['Ψαροτούφεκο','Spearfishing']};
  function stats(){
    var st=document.getElementById('stats'), C=window.AlkyonCore; if(!st||!C||!C.Store) return;
    var old=document.getElementById('ndProfSt'); if(old) old.remove();
    var tr=C.Store.get('trips'), bi=C.Store.get('bites'), rows={};
    tr.forEach(function(t){ if(!t.prof) return; (rows[t.prof]=rows[t.prof]||{n:0,f:0}).n++; });
    bi.forEach(function(b){ if(!b.prof) return; var r=(rows[b.prof]=rows[b.prof]||{n:0,f:0}); r.f+=C.bc?C.bc(b):1; });
    var ks=Object.keys(rows).filter(function(k){return NM[k];}); if(!ks.length) return;
    var d=document.createElement('div'); d.id='ndProfSt'; d.style.cssText='grid-column:1/-1;margin-top:10px;font-size:13px';
    var h='<b>'+T('Ανά τύπο ψαρέματος','By fishing type')+'</b>';
    ks.forEach(function(k){ h+='<div style="display:flex;justify-content:space-between;padding:4px 0"><span>'+T(NM[k][0],NM[k][1])+'</span><span>'+rows[k].n+' '+(rows[k].n===1?T('έξοδος','trip'):T('έξοδοι','trips'))+' · '+rows[k].f+' '+(rows[k].f===1?T('ψάρι','fish'):T('ψάρια','fish'))+'</span></div>'; });
    h+='<p class="note">'+T('Μετράνε μόνο καταγραφές από αυτή την έκδοση και μετά.','Counts only records made since this version.')+'</p>';
    d.innerHTML=h; st.appendChild(d);
  }
  function all(){ try{checklist();timer();}catch(e){} }
  var busy=false;
  function sched(){ if(busy) return; busy=true; setTimeout(function(){ busy=false; try{stats();}catch(e){} },200); }
  function init(){
    all();
    var st=document.getElementById('stats'); if(st) new MutationObserver(function(m){ if(m.some(function(x){return !(x.target.id==='ndProfSt'||(x.addedNodes[0]&&x.addedNodes[0].id==='ndProfSt')||(x.removedNodes[0]&&x.removedNodes[0].id==='ndProfSt'));})) sched(); }).observe(st,{childList:true});
    sched();
  }
  window.addEventListener('alkyon-fprof',function(){ setTimeout(all,100); });
  var n=0, iv=setInterval(function(){ n++; if(document.getElementById('sfForm')&&document.getElementById('stats')){ clearInterval(iv); init(); } else if(n>40) clearInterval(iv); },500);
})();

/* v31z368 · Έξοδος: MOB και SOS σε ομάδα «Κίνδυνος» πάνω αριστερά, μακριά από τα κουμπιά ψαριού, και τα δύο με παρατεταμένο πάτημα.
   «Χάθηκε» σε ουδέτερο χρώμα. Ψαροντούφεκο: «Ψάρι / Χαμένη βολή / Είδα». */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore;
  var $=function(i){ return document.getElementById(i); };
  var HOLD=1500;
  function prof(){ try{ return localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){ return 'boat'; } }
  function trip(){ try{ return window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); }catch(e){ return null; } }
  function holdify(b,fire,msg){
    var tm=null, done=false;
    function stop(){ clearTimeout(tm); tm=null; b.classList.remove('holding'); }
    b.addEventListener('pointerdown',function(){ done=false; stop(); b.classList.add('holding'); tm=setTimeout(function(){ done=true; stop(); try{ navigator.vibrate&&navigator.vibrate([60,40,60]); }catch(e){} fire(); },HOLD); });
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ b.addEventListener(ev,function(){ if(tm){ stop(); if(ev==='pointerup'&&!done&&C&&C.toast) C.toast(msg); } }); });
    b.addEventListener('contextmenu',function(e){ e.preventDefault(); });
    b.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fire(); } });
  }
  function danger(){
    var box=document.querySelector('.mapbox'), mob=document.querySelector('.ndb.ndmob'), sos=document.querySelector('.ndb.ndsos');
    if(!box||!mob||!sos||$('ndDanger')) return !!$('ndDanger');
    /* SOS: αντικατάσταση με αντίγραφο χωρίς το απλό πάτημα, και ενεργοποίηση μόνο με κράτημα 1,5 δευτ. */
    var s2=sos.cloneNode(true); sos.replaceWith(s2); sos=s2;
    sos.setAttribute('aria-label',T('SOS: ειδοποίηση κινδύνου, κράτα πατημένο','SOS: distress alert, press and hold'));
    holdify(sos,function(){ var x=$('sosBtn'); if(x) x.click(); },T('Κράτα πατημένο το SOS 1,5 δευτ.','Hold SOS for 1.5 s'));
    var g=document.createElement('div'); g.id='ndDanger'; g.className='nddanger'; g.setAttribute('role','group'); g.setAttribute('aria-label',T('Κίνδυνος','Emergency'));
    var h=document.createElement('span'); h.className='nddh'; h.textContent=T('ΚΙΝΔΥΝΟΣ','EMERGENCY'); g.appendChild(h);
    [mob,sos].forEach(function(b){ b.classList.remove('ndfloat','ndfl','ndfr'); g.appendChild(b); });
    var n=document.createElement('span'); n.className='nddn'; n.textContent=T('κράτα','hold'); g.appendChild(n);
    box.appendChild(g); return true;
  }
  /* θέση: ακριβώς κάτω από τη λωρίδα της εξόδου (ή τη μπάρα καιρού) */
  function place(){
    var g=$('ndDanger'), box=document.querySelector('.mapbox'); if(!g||!box) return;
    var r0=box.getBoundingClientRect(), y=0;
    ['.ndlive:not([hidden])','.ndwx','.ndsearch'].some(function(q){ var e=document.querySelector(q); if(e&&e.offsetParent){ var r=e.getBoundingClientRect(); if(r.height){ y=r.bottom-r0.top; return true; } } return false; });
    g.style.top=Math.max(80,Math.round(y+12))+'px';
  }
  /* Ψαροντούφεκο: «Είδα» (ψάρι που είδες αλλά δεν χτύπησες), με θέση και ώρα */
  var SK='alkyon-seen';
  function seenAll(){ try{ return JSON.parse(localStorage.getItem(SK)||'[]')||[]; }catch(e){ return []; } }
  function seenN(){ var s=trip(); if(!s||!s.start) return 0; return seenAll().filter(function(x){ return x.start===s.start; }).length; }
  window.AlkyonSeen={count:seenN,all:seenAll};
  var EYE='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function seenBtn(){
    var w=$('fishBtns'); if(!w||$('fbSeen')) return;
    var b=document.createElement('button'); b.type='button'; b.id='fbSeen'; b.className='fb fbs';
    b.setAttribute('aria-label',T('Είδα ψάρι (χωρίς βολή)','Saw a fish (no shot)'));
    b.innerHTML=EYE+'<b id="fbSeenN">0</b>';
    b.addEventListener('click',function(){
      var s=trip(); if(!s||!s.start) return; var N=window.AlkyonNav, a=seenAll();
      a.push({u:Date.now(),start:s.start,lat:N&&N.lat!=null?+N.lat.toFixed(5):null,lon:N&&N.lon!=null?+N.lon.toFixed(5):null});
      if(a.length>2000) a=a.slice(-2000);
      try{ localStorage.setItem(SK,JSON.stringify(a)); }catch(e){}
      try{ navigator.vibrate&&navigator.vibrate(25); }catch(e){}
      upd(); if(C&&C.toast) C.toast(T('Καταγράφηκε: είδα ψάρι','Logged: fish seen'));
    });
    var bc=$('fbCatch'); if(bc) w.insertBefore(b,bc); else w.appendChild(b);
  }
  /* ετικέτες κάτω από τα κουμπιά ψαριού, ανάλογα με τον τύπο ψαρέματος */
  function cap(id,t){ var b=$(id); if(!b) return; var c=b.querySelector('.fbcap'); if(!c){ c=document.createElement('span'); c.className='fbcap'; b.appendChild(c); } if(c.textContent!==t) c.textContent=t; }
  window.ndLiveFirst=function(){ if(prof()!=='spear') return null; var k=0; try{ k=window.AlkyonTrip.counts().n||0; }catch(e){} return T('στο νερό · ','in water · ')+k+' '+(k===1?T('ψάρι','fish'):T('ψάρια','fish'))+' · '+seenN()+' '+T('είδα','seen'); };
  function upd(){
    if(!document.body.classList.contains('ontrip')) return;
    var sp=prof()==='spear';
    if(sp) seenBtn();
    var sb=$('fbSeen'); if(sb){ sb.hidden=!sp; var n=$('fbSeenN'); if(n) n.textContent=seenN(); }
    cap('fbCatch',sp?T('Ψάρι','Fish'):T('Έπιασα','Caught'));
    cap('fbMiss',sp?T('Χαμένη βολή','Missed shot'):T('Χάθηκε','Lost'));
    cap('fbSeen',T('Είδα','Seen'));
    var bc=$('fbCatch'), bm=$('fbMiss');
    if(bc) bc.setAttribute('aria-label',sp?T('Ψάρι (κράτα για διαγραφή του τελευταίου)','Fish (hold to delete the last one)'):T('Έπιασα ψάρι (κράτα για διαγραφή του τελευταίου)','Caught a fish (hold to delete the last one)'));
    if(bm) bm.setAttribute('aria-label',sp?T('Χαμένη βολή (κράτα για διαγραφή της τελευταίας)','Missed shot (hold to delete the last one)'):T('Τσίμπησε αλλά χάθηκε (κράτα για διαγραφή του τελευταίου)','Bite but lost (hold to delete the last one)'));
    /* λωρίδα εξόδου: «στο νερό · 1 ψάρι · 3 είδα» */
    /* το κείμενο της λωρίδας το γράφει μόνο ο χρονομετρητής της (ndLiveFirst), όχι δύο κώδικες μαζί */
    place();
  }
  var n=0, iv=setInterval(function(){ n++; if(danger()||n>60){ clearInterval(iv); upd(); } },500);
  window.ndEvery(upd,1000); window.addEventListener('resize',place); window.addEventListener('alkyon-fprof',upd);
})();

/* v31z369 · Πρόγνωση πιο καθαρή: ένας βαθμός, «Καλύτερη ώρα σήμερα» από τους ωριαίους βαθμούς, ένα γράφημα,
   οι εξηγήσεις σε γραμμές που ανοίγουν, οι ρυθμίσεις ειδοποιήσεων στο Profile. */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  var $=function(i){ return document.getElementById(i); };
  function p2(n){ return (n<10?'0':'')+n; }
  /* Κάρτα που διπλώνει: μένει μόνο μια γραμμή-κουμπί με τίτλο και σύνοψη. Ξαναμπαίνει αν η κάρτα ξαναζωγραφιστεί. */
  var OPEN={};
  function fold(card,key,title,sub){
    if(!card) return; card.classList.add('ndfold'); card.classList.toggle('open',!!OPEN[key]);
    var b=card.querySelector(':scope>.ndfoldb');
    if(!b){ b=document.createElement('button'); b.type='button'; b.className='ndfoldb'; b.innerHTML='<span class="ndft"><b></b><span></span></span><i aria-hidden="true">›</i>';
      b.addEventListener('click',function(){ OPEN[key]=!OPEN[key]; card.classList.toggle('open',OPEN[key]); b.setAttribute('aria-expanded',String(!!OPEN[key])); });
      card.insertBefore(b,card.firstChild); }
    b.setAttribute('aria-expanded',String(!!OPEN[key]));
    if(b.querySelector('b').textContent!==title) b.querySelector('b').textContent=title;
    var s=sub||''; if(b.querySelector('.ndft span').textContent!==s) b.querySelector('.ndft span').textContent=s;
  }
  function txt(e){ return e?(e.textContent||'').replace(/\s+/g,' ').trim():''; }
  function cut(s,n){ return s.length>n?s.slice(0,n-1)+'…':s; }
  /* Καλύτερη ώρα σήμερα: το καλύτερο δίωρο από τους ωριαίους βαθμούς που απομένουν (ίδιοι αριθμοί με τη λωρίδα ωρών) */
  function bestToday(){
    var live=$('liveBox'); if(!live) return;
    var day=document.querySelector('.ndhr .ndhrd [aria-selected=true]'), dIdx=day?[].indexOf.call(day.parentNode.children,day):0;
    var chips=[].slice.call(document.querySelectorAll('.ndhr > .ndhrh .ndhc'));
    var el=$('ndBestT'); if(!el){ el=document.createElement('div'); el.id='ndBestT'; el.className='ndbestt'; el.innerHTML='<span></span><b></b><small></small>'; var sc=live.querySelector('.h2score'); if(sc) sc.after(el); else live.appendChild(el); }
    if(dIdx>0&&el.dataset.ok) return;   /* ο χρήστης κοιτάει άλλη μέρα στη λωρίδα: κράτα την τελευταία τιμή για σήμερα */
    var hs=chips.filter(function(c){ return !c.classList.contains('past'); }).map(function(c){ return {h:+c.dataset.h,v:+(c.querySelector('i')||{}).textContent||0}; });
    if(hs.length<2){ el.hidden=true; return; }
    var best=null; for(var i=0;i<hs.length-1;i++){ if(hs[i+1].h!==hs[i].h+1) continue; var a=(hs[i].v+hs[i+1].v)/2; if(!best||a>best.a) best={h:hs[i].h,a:a}; }
    if(!best){ el.hidden=true; return; }
    el.hidden=false; el.dataset.ok='1';
    el.querySelector('span').textContent=T('Καλύτερη ώρα σήμερα','Best time today');
    var why='';
    try{ var PF=window.PF, c=window.AlkyonCore.getCond&&window.AlkyonCore.getCond(); if(PF&&PF.solunarPeriods){ var t0=new Date(); t0.setHours(best.h,0,0,0); var s0=t0.getTime(), s1=s0+7200000;
      var per=window.ndSol(s0-86400000,s1+86400000,c&&c.lat!=null?+c.lat:35,c&&c.lon!=null?+c.lon:33).filter(function(p){ return p.s<s1&&p.e>s0; });
      if(per.length) why=per.some(function(p){ return p.kind==='major'; })?T('★ κύρια περίοδος σελήνης','★ major moon period'):T('δευτερεύουσα περίοδος σελήνης','minor moon period'); } }catch(e){}
    el.querySelector('b').textContent=p2(best.h)+':00–'+p2((best.h+2)%24)+':00 · '+Math.round(best.a);
    el.querySelector('small').textContent=why;
  }
  function today(){
    if(window.ndFC2) return;
    var tab=$('tab-today'); if(!tab||tab.hidden) return;
    bestToday();
    var hr=document.querySelector('#tab-today > .ndhr'), tp=$('tdPress'); if(hr&&tp&&tp.parentNode===hr.parentNode&&(tp.compareDocumentPosition(hr)&Node.DOCUMENT_POSITION_FOLLOWING)) tp.parentNode.insertBefore(hr,tp);
    /* παλιά κάρτα «Ώρες της ημέρας»: είχε άλλα «καλύτερα παράθυρα» από τη λωρίδα ωρών → κρυφή */
    var hc=$('windows'); hc=hc&&hc.closest('.card'); if(hc) hc.classList.add('ndgone');
    /* «Γιατί αυτός ο βαθμός» → «Γιατί 60;» */
    var sc=txt(document.querySelector('#liveBox .h2score b, #liveBox .h2score .num'))||(txt(document.querySelector('#liveBox .h2score')).match(/\d+/)||[''])[0];
    var fc=$('factorsCard'); if(fc){ var rows=[].slice.call(fc.querySelectorAll('.fac,.frow,[class*=fac]')); fold(fc,'why',sc?T('Γιατί ','Why ')+sc+';':T('Γιατί αυτός ο βαθμός','Why this score'),T('Σελήνη, πίεση, άνεμος, κύμα, ουρανός','Moon, pressure, wind, waves, sky')); }
    /* γράφημα: μένει το γράφημα και η γραμμή της σελήνης· οι αριθμοί πίεσης και το υπόμνημα σε γραμμή που ανοίγει */
    var pr=$('tdPress'); if(pr){ var ms=[].slice.call(pr.querySelectorAll(':scope>.meta')), nt=pr.querySelector(':scope>p.note');
      ms.forEach(function(m){ m.classList.toggle('ndmore',!/Σελήνη|Moon|🌑|🌒|🌓|🌔|🌕|🌖|🌗|🌘/.test(m.textContent)&&!/^Άγγιξε|^Touch|^Tap/.test(txt(m))); });
      ms.forEach(function(m){ if(/^Άγγιξε|^Touch|^Tap/.test(txt(m))) m.classList.add('ndmore'); });
      if(nt) nt.classList.add('ndmore');
      var mb=pr.querySelector(':scope>.ndmoreb'); if(!mb){ mb=document.createElement('button'); mb.type='button'; mb.className='ndmoreb'; mb.addEventListener('click',function(){ OPEN.press=!OPEN.press; pr.classList.toggle('showmore',!!OPEN.press); mb.textContent=OPEN.press?T('Λιγότερα','Less'):T('Αριθμοί και υπόμνημα','Numbers and legend'); }); pr.appendChild(mb); }
      pr.classList.toggle('showmore',!!OPEN.press); mb.textContent=OPEN.press?T('Λιγότερα','Less'):T('Αριθμοί και υπόμνημα','Numbers and legend');
      if(mb!==pr.lastElementChild) pr.appendChild(mb); }
    /* «Πού να πας» / «Τι να βάλεις»: κρυφές όσο δεν έχουν ακόμα προτάσεις */
    ['bestCard','recoCard'].forEach(function(id){ var c=$(id); if(!c) return; var empty=!c.querySelector('button:not(.ndfoldb),li,.chip,.row')&&/Όταν καταγράψεις|Μετά από|When you|After \d|Once you/.test(c.textContent); c.classList.toggle('ndgone',empty); });
  }
  function fcTab(){
    if(window.ndFC2) return;
    var tab=$('tab-fc'); if(!tab||tab.hidden) return;
    var pr=$('fcPress'); if(pr) pr.classList.add('ndgone');   /* το ίδιο γράφημα υπάρχει στο «Σήμερα» */
    /* μία επιλογή τοποθεσίας: στο «Σήμερα». Εδώ μένει μόνο το όνομα και ένα κουμπί αλλαγής. */
    var gen=$('fcGen'), pl=$('plCard'); if(pl&&gen&&!gen.hidden) pl.classList.add('ndgone'); else if(pl) pl.classList.remove('ndgone');
    var fid=document.querySelector('#fcHead .fcid'); if(false&&fid&&!$('ndFcLoc')){ var cb=document.createElement('button'); cb.type='button'; cb.id='ndFcLoc'; cb.className='btn ghost sm'; cb.style.marginTop='6px'; cb.textContent=T('📍 Αλλαγή τοποθεσίας','📍 Change location');
      cb.addEventListener('click',function(){ try{ window.AlkyonCore.lsSet('alkyon-wxsub','today'); window.AlkyonCore.switchTab('today'); }catch(e){} setTimeout(function(){ var w=$('tdLoc'), lb=$('ndLocBtn'); if(w&&w.classList.contains('ndlocc')&&lb) lb.click(); setTimeout(function(){ if(w){ try{ w.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){} var i=w.querySelector('input'); if(i) try{ i.focus({preventScroll:true}); }catch(e){} } },80); },150); });
      fid.appendChild(cb); }
    var tc=$('fcTurn'); if(tc){ var ps=tc.querySelectorAll(':scope>p:not(.note)'); fold(tc,'turn',T('Πίεση','Pressure')+': '+cut(txt(ps[0]),44),cut(txt(ps[1]),70)); }
    var ex=$('fcExposure'); if(ex){ var now=[].slice.call(ex.querySelectorAll(':scope>p:not(.note)')).filter(function(p){ return /^Τώρα|^Now/.test(txt(p)); })[0]; fold(ex,'exp',T('Έκθεση ακτής','Coast exposure'),cut(txt(now).replace(/^Τώρα:\s*|^Now:\s*/,''),60)); }
    var nt=$('ntCard'); if(nt&&!nt.dataset.ndmoved){ var lk=$('ndNtLink'); if(!lk){ lk=document.createElement('button'); lk.type='button'; lk.id='ndNtLink'; lk.className='btn ghost sm ndntlink'; lk.textContent=T('🔔 Ειδοποιήσεις: Profile › Ειδοποιήσεις','🔔 Alerts: Profile › Alerts'); lk.addEventListener('click',function(){ if(window.AlkyonProfGo) window.AlkyonProfGo('alerts'); }); nt.parentNode.insertBefore(lk,nt); } }
  }
  function tick(){ try{ today(); }catch(e){} try{ fcTab(); }catch(e){} }
  window.ndEvery(tick,1500); document.addEventListener('click',function(){ setTimeout(tick,60); },true);
})();

/* v31z369 · Profile ως απλή λίστα: Τα δικά μου / Ρυθμίσεις / Δεδομένα και λογαριασμός. Κάθε γραμμή ανοίγει την υπάρχουσα ενότητα. */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore;
  var $=function(i){ return document.getElementById(i); };
  function ls(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function J(k,d){ try{ var v=JSON.parse(ls(k)); return v==null?d:v; }catch(e){ return d; } }
  var home=null, back=null;
  /* ειδοποιήσεις: η κάρτα μεταφέρεται από την Πρόγνωση στις ρυθμίσεις του Profile */
  function moveAlerts(){ var nt=$('ntCard'), ps=$('pSettings'); if(nt&&ps&&nt.parentNode!==ps){ nt.dataset.ndmoved='1'; ps.appendChild(nt); var lk=$('ndNtLink'); if(lk) lk.remove(); } }
  function sub(k){
    try{
      if(k==='stats'){ var tr=(C.Store.get('trips')||[]).length, f=0; (C.Store.act?C.Store.act():(C.Store.get('bites')||[])).forEach(function(b){ f+=C.bc?C.bc(b):1; }); return tr+' '+T('έξοδοι','trips')+' · '+f+' '+T('ψάρια','fish'); }
      if(k==='alerts'){ var n=J('alkyon-notify',{}), a=[]; if(n.on) a.push(T('Καλές μέρες ≥','Good days ≥')+(n.threshold||75)); if(n.pressure) a.push(T('πίεση','pressure')); if(n.turn) a.push(T('καμπή πίεσης','pressure turn')); var w=J('alkyon-wwatch',null); if(w&&w.on) a.push(T('άνεμος','wind')); if(a.length){ var s0=a.join(' · '); return s0.charAt(0).toUpperCase()+s0.slice(1); } return T('Κλειστές','Off'); }
      if(k==='fprof'){ var nm=window.AlkyonFProf?window.AlkyonFProf.name():''; return nm+(ls('alkyon-askfp')==='0'?'':T(' · ρωτά στο άνοιγμα',' · asks on open')); }
      if(k==='tackle'){ var tk=(C.Store.raw&&C.Store.raw('tackle'))||[]; return tk.length?tk.length+' '+T('κομμάτια','items')+' · '+T('καλάμια, μηχανισμοί, σετ, λίστα αγορών','rods, reels, sets, shopping list'):T('Πρόσθεσε καλάμια, μηχανισμούς, τεχνητά','Add rods, reels, lures'); }
      if(k==='units'){ var U2=window.AlkyonUnits; if(U2&&U2.label) return ['wind','temp','press','wave','dist'].map(function(x){ return U2.label(x); }).join(' · '); }
      if(k==='safety'){ var sd=J('alkyon-safe',{}), rd=safeItems().filter(function(x){ return x.ok; }).length; return T('Έτοιμο ','Ready ')+rd+'/'+safeItems().length+' · '+((sd.phone||sd.email||sd.tgLinked)?T('Επαφή: ','Contact: ')+(sd.name||sd.phone||sd.email||'Telegram'):T('χωρίς επαφή ασφαλείας','no safety contact')); }
      if(k==='ai'){ return ls('alkyon-akey')&&ls('alkyon-akey')!=='""'?T('Ενεργό: αναγνώριση από φωτογραφία','On: identify from a photo'):T('Ανενεργό · χρειάζεται κλειδί API','Off · needs an API key'); }
      if(k==='account'){ var se=J('alkyon-sess',null), lt=+ls('alkyon-last')||0; return se&&se.email?se.email+(lt?' · '+T('συγχρ. ','synced ')+new Date(lt).toLocaleTimeString(EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'}):''):T('Όνομα, γλώσσα, συγχρονισμός, κωδικός','Name, language, sync, password'); }
      if(k==='friends'){ var fr=J('alkyon-fr',{}), l=(fr&&fr.list)||[]; return l.length?l.map(function(f){ return f.name; }).slice(0,3).join(', ')+(l.length>3?' +'+(l.length-3):''):T('Κοινή χρήση ψαριών και σημείων με φίλους','Share fish and spots with friends'); }
      if(k==='backup'){ var lb=+ls('alkyon-lastbackup')||0; return lb?T('Τελευταίο: ','Last: ')+new Date(lb).toLocaleDateString(EN?'en-GB':'el-GR'):T('Δεν έχεις κάνει ακόμα αντίγραφο','No backup yet'); }
    }catch(e){}
    return '';
  }
  /* v31z411: οργάνωση Profile ανά χρήση· κάθε γραμμή δείχνει την κατάστασή της (τι λείπει φαίνεται με ●) */
  var GROUPS=[
    [T('ΤΑ ΔΙΚΑ ΜΟΥ','MY STUFF'),[
      ['tackle',T('Εξοπλισμός','Tackle'),null,'tackle'],
      ['boat',T('Σκάφος','Boat'),T('Μηχανή, συντήρηση, λήξεις','Engine, maintenance, expiries'),'boat'],
      ['friends',T('Φίλοι','Friends'),null,'set','frCard']]],
    [T('ΨΑΡΕΜΑ','FISHING'),[
      ['fprof',T('Τύπος ψαρέματος και φωνή','Fishing type and voice'),null,'set','ndFProf'],
      ['alerts',T('Ειδοποιήσεις','Alerts'),null,'set','ntCard,seaSetCard'],
      ['guide',T('Οδηγός','Guide'),T('Είδη, τεχνικές, κόμποι, νομοθεσία','Species, techniques, knots, rules'),'guide'],
      ['units',T('Μονάδες','Units'),null,'set','unitsCard']]],
    [T('ΑΣΦΑΛΕΙΑ','SAFETY'),[
      ['safety',T('Επαφή ασφαλείας και διαδρομή','Safety contact and track'),null,'set','ndSafeChk,pContacts,pGpsCard']]],
    [T('ΔΕΔΟΜΕΝΑ','DATA'),[
      ['backup',T('Αντίγραφο και εξαγωγή','Backup and export'),null,'set','ndExport'],
      ['data',T('Έλεγχος και συμπλήρωση','Check and fill in'),T('Διπλά, καιρός σε παλιά ψάρια','Duplicates, weather on old catches'),'set','dgCard,seaDataCard'],
      ['ai',T('Αναγνώριση ψαριού με AI','AI fish identification'),null,'set','pAICard']]],
    [T('ΛΟΓΑΡΙΑΣΜΟΣ','ACCOUNT'),[
      ['account',T('Λογαριασμός και γλώσσα','Account and language'),null,'set','pAccCard,pSyncCard,pPassCard,ndDelAcc'],
      ['about',T('Σχετικά','About'),T('Έκδοση και ενημέρωση, οδηγός, απόρρητο','Version and updates, tour, privacy'),'set','ndVerCard,ndTour,ndAbout']]]
  ];
  /* v31z412: ετοιμότητα ασφαλείας */
  function safeItems(){ var d=J('alkyon-safe',{}), gps=true; try{ gps=!window.AlkyonTrack||window.AlkyonTrack.enabled(); }catch(e){}
    return [{ok:!!(d.phone||d.email),t:T('Επαφή ασφαλείας (τηλέφωνο ή email)','Safety contact (phone or email)'),h:T('Παίρνει ειδοποίηση αν δεν γυρίσεις στην ώρα σου.','Gets alerted if you are not back on time.')},
      {ok:!!d.tgLinked,t:T('Telegram επαφής','Contact on Telegram'),h:T('Αυτόματη ειδοποίηση, δωρεάν, χωρίς να ανοίξει η εφαρμογή.','Automatic, free alert without the app being open.')},
      {ok:!!d.selfLinked,t:T('Το δικό σου Telegram','Your own Telegram'),h:T('Ο έλεγχος «Είσαι καλά;» στο κινητό σου.','The “Are you OK?” check on your phone.')},
      {ok:gps,t:T('Καταγραφή διαδρομής GPS','GPS track recording'),h:T('Η τελευταία γνωστή θέση σου στέλνεται στην επαφή.','Your last known position is sent to the contact.')}]; }
  function safeCard(){
    var ps=$('pSettings'); if(!ps) return; var c=$('ndSafeChk'); if(!c){ c=document.createElement('div'); c.id='ndSafeChk'; c.className='card setcard'; var pc=$('pContacts'); ps.insertBefore(c,pc||ps.firstChild); }
    var it=safeItems(), n=it.filter(function(x){ return x.ok; }).length; c.replaceChildren();
    var h=document.createElement('h3'); h.textContent=T('Ετοιμότητα πριν βγεις','Ready before you go')+' · '+n+'/'+it.length; c.appendChild(h);
    it.forEach(function(x){ var r=document.createElement('div'); r.className='ndsafr'+(x.ok?' ok':''); r.innerHTML='<i aria-hidden="true"></i><span><b></b><small></small></span>'; r.querySelector('i').textContent=x.ok?'✓':'!'; r.querySelector('b').textContent=x.t; r.querySelector('small').textContent=x.h; c.appendChild(r); });
    var p=document.createElement('p'); p.className='note'; p.textContent=T('Την ώρα επιστροφής την ορίζεις κάθε φορά στην «Έναρξη εξόδου».','You set the return time each time at “Start trip”.'); c.appendChild(p);
  }
  /* v31z412: Ειδοποιήσεις σε ομάδες, με κεντρικό διακόπτη πρώτο */
  function orgAlerts(){
    var nc=$('ntCard'); if(!nc) return;
    var row=function(id){ var e=$(id); return e?e.closest('label.chk')||e.closest('label'):null; };
    var on=$('ntOn'), thr=$('ntThr'), test=$('ntTest'), msg=$('ntMsg'), sim=$('ntSim');
    var simThr=sim&&row('ntSim')&&row('ntSim').nextElementSibling&&row('ntSim').nextElementSibling.querySelector('select')?row('ntSim').nextElementSibling:null;
    var G=[[T('Κεντρικός διακόπτης','Main switch'),[row('ntOn')]],[T('Καλές μέρες','Good days'),[thr&&thr.closest('label')]],[T('Πίεση και άνεμος','Pressure and wind'),[row('ntPress'),row('ntTurn'),$('wwBox')]],
      [T('Από τις ψαριές σου','From your catches'),[row('ntAnniv'),row('ntSim'),simThr]],[T('Δοκιμή','Test'),[test&&test.closest('.row'),msg]]];
    G.forEach(function(g,i){ var hid='ndAlH'+i, hh=$(hid); if(!hh){ hh=document.createElement('div'); hh.id=hid; hh.className='ndalh'; } hh.textContent=g[0]; nc.appendChild(hh); g[1].forEach(function(e){ if(e) nc.appendChild(e); }); });
    var lb=on&&on.parentNode.querySelector('label[for=ntOn]'); if(lb&&!lb.dataset.nd){ lb.dataset.nd='1'; lb.textContent=T('Ειδοποιήσεις πρόγνωσης στο κινητό','Forecast notifications on this phone'); var sm=document.createElement('small'); sm.className='ndalsm'; sm.textContent=T('Καλές μέρες, πίεση και άνεμος. Χωρίς αυτό δεν στέλνονται.','Good days, pressure and wind. Off = none of them is sent.'); lb.appendChild(sm); }
    nc.classList.toggle('ndaloff',!(on&&on.checked)); if(on&&!on.dataset.ndw){ on.dataset.ndw='1'; on.addEventListener('change',function(){ nc.classList.toggle('ndaloff',!on.checked); }); }
    var h3=nc.querySelector('h3'); if(h3&&!h3.dataset.nd){ h3.dataset.nd='1'; h3.textContent=T('Ειδοποιήσεις','Alerts'); }
    var sc=$('seaSetCard'), sh=sc&&sc.querySelector('h3'); if(sh) sh.textContent=T('Κατά την έξοδο: καιρός, φωνή, λιμάνι','During a trip: weather, voice, home port');
  }
  /* v31z413: εικονίδιο ανά γραμμή (χρωματιστό τετράγωνο, όπως στις Ρυθμίσεις του κινητού) */
  var ICO={
    tackle:['#d9772b','<path d="M5 19L19 5"/><path d="M15 5h4v4"/><circle cx="7" cy="17" r="2"/>'],
    boat:['#2b7fc4','<path d="M3 17l2 3h14l2-3z"/><path d="M12 4v10M12 4l6 8h-6"/>'],
    friends:['#8e44ad','<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.3 5 2.6 5 5.8"/>'],
    fprof:['#1f8a7a','<path d="M2.5 12c3-5 10-5.5 13.5-1.2L21 7v10l-5-3.8C12.5 17.5 5.5 17 2.5 12z"/>'],
    alerts:['#e04a3a','<path d="M6 17v-6a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>'],
    guide:['#3d6fd8','<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>'],
    units:['#6b7a86','<path d="M3 8h18v8H3z"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>'],
    safety:['#2e9e5b','<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'],
    backup:['#0f8fb3','<path d="M7 18a4 4 0 01-.5-8 5.5 5.5 0 0110.6-1.5A4 4 0 0117 18"/><path d="M12 12v8M9 15l3-3 3 3"/>'],
    data:['#c58a12','<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'],
    ai:['#b0469b','<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'],
    account:['#4b5563','<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'],
    about:['#7a8691','<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>']};
  /* γραμμές που χρειάζονται προσοχή: ● */
  function warnOf(k){ try{
    if(k==='safety'){ var d=J('alkyon-safe',{}); return !(d.phone||d.email||d.tgLinked); }
    if(k==='alerts'){ return !(J('alkyon-notify',{})||{}).on; }
    if(k==='backup'){ var lb=+ls('alkyon-lastbackup')||0; return !lb||Date.now()-lb>30*86400000; }
  }catch(e){} return false; }
  function build(){
    var pb=document.querySelector('#profile .pbox'), pm=$('pMain'); if(!pb||!pm) return false; if(home) return true;
    home=document.createElement('div'); home.id='pHome'; home.className='ndphome'; pm.parentNode.insertBefore(home,pm);
    back=document.createElement('button'); back.type='button'; back.id='pHomeBack'; back.className='ndphback'; back.hidden=true;
    back.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span></span>'; back.querySelector('span').textContent=T('Προφίλ','Profile');
    back.addEventListener('click',showHome); pm.parentNode.insertBefore(back,home);
    return true;
  }
  /* v31z412: αναζήτηση στις ρυθμίσεις (λέξεις-κλειδιά ανά γραμμή) */
  var KW={tackle:'καλάμι μηχανισμός μουλινέ νήμα τεχνητό αγκίστρι σετ λίστα αγορών rod reel lure line hook',boat:'μηχανή service λήξεις ασφάλεια σκάφους άδεια engine',friends:'φίλος κοινή χρήση πρόσκληση κωδικός friend share invite',
    fprof:'βάρκα ακτή στεριά λίμνη φράγμα ψαροντούφεκο φωνή μικρόφωνο boat shore lake spear voice',alerts:'ειδοποίηση πίεση άνεμος καμπή καλές μέρες ομοιότητα παλιές ψαριές άγκυρα λιμάνι notification pressure wind anchor',
    guide:'είδη τεχνικές κόμποι νόμοι νομοθεσία μαγαζιά species knots rules',units:'μονάδες κόμβοι bft km/h θερμοκρασία hpa πόδια μίλια συντεταγμένες units knots',
    safety:'επαφή ασφαλείας telegram sos gps διαδρομή επιστροφή contact track',backup:'αντίγραφο εξαγωγή επαναφορά csv excel backup export restore',data:'διπλά έλεγχος καιρός συμπλήρωση duplicates',
    ai:'κλειδί api claude φωτογραφία αναγνώριση key photo',account:'όνομα γλώσσα english συγχρονισμός κωδικός πρόσβασης password διαγραφή λογαριασμού email sync language delete',about:'απόρρητο έκδοση οδηγός καλωσορίσματος ενημέρωση privacy version update tour'};
  function nrm(x){ return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  var qv='';
  function filt(){
    var q=nrm(qv).trim(); if(!home) return;
    [].forEach.call(home.querySelectorAll('.ndphg'),function(g){ var any=false;
      [].forEach.call(g.querySelectorAll('.ndphr'),function(b){ var ok=!q||q.split(/\s+/).every(function(w){ return nrm(b.textContent+' '+(KW[b.dataset.k]||'')).indexOf(w)>=0; }); b.hidden=!ok; if(ok) any=true; });
      g.hidden=!any; var h=g.previousElementSibling; if(h&&h.classList.contains('ndphh')) h.hidden=!any; });
    var em=home.querySelector('.ndphnone'); if(em) em.hidden=!q||!!home.querySelector('.ndphr:not([hidden])');
  }
  function paint(){
    if(!home) return; home.replaceChildren();
    var lt=document.createElement('h2'); lt.className='ndphlt'; lt.textContent=T('Προφίλ','Profile'); home.appendChild(lt);
    var sw=document.createElement('div'); sw.className='ndphsrch'; sw.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" autocomplete="off">';
    var si=sw.querySelector('input'); si.placeholder=T('Αναζήτηση ρυθμίσεων (π.χ. άγκυρα, μονάδες)','Search settings (e.g. anchor, units)'); si.setAttribute('aria-label',T('Αναζήτηση ρυθμίσεων','Search settings')); si.value=qv;
    si.addEventListener('input',function(){ qv=si.value; filt(); }); home.appendChild(sw);
    var lb=+ls('alkyon-lastbackup')||0, old=!lb||Date.now()-lb>30*86400000;
    if(old){ var w=document.createElement('div'); w.className='ndphwarn'; w.innerHTML='<span></span><button type="button" class="btn sm"></button>';
      w.querySelector('span').textContent=lb?T('Το τελευταίο αντίγραφο είναι πάνω από 30 μέρες παλιό.','Your last backup is over 30 days old.'):T('Δεν έχεις κάνει ποτέ αντίγραφο ασφαλείας.','You have never made a backup.');
      w.querySelector('button').textContent=T('Τώρα','Now'); w.querySelector('button').addEventListener('click',function(){ go('backup'); }); home.appendChild(w); }
    GROUPS.forEach(function(g){
      var h=document.createElement('div'); h.className='ndphh'; h.textContent=g[0]; home.appendChild(h);
      var box=document.createElement('div'); box.className='ndphg'; home.appendChild(box);
      g[1].forEach(function(r){
        if(r[0]==='boat'&&!$('pBoat')) return;
        var b=document.createElement('button'); b.type='button'; b.className='ndphr'; b.dataset.k=r[0];
        var ic=ICO[r[0]]; b.innerHTML=(ic?'<em class="ndphi" style="--c:'+ic[0]+'" aria-hidden="true"><svg viewBox="0 0 24 24">'+ic[1]+'</svg></em>':'')+'<span><b></b><small></small></span><i aria-hidden="true">›</i>';
        b.querySelector('b').textContent=r[1]; b.querySelector('small').textContent=r[2]||sub(r[0]);
        if(warnOf(r[0])){ var wd=document.createElement('i'); wd.className='ndphw'; wd.setAttribute('aria-label',T('Χρειάζεται προσοχή','Needs attention')); b.querySelector('b').appendChild(wd); }
        if(r[0]==='boat'){ var bb=document.querySelector('#pSeg [data-p=boat]'); if(bb&&bb.dataset.badge){ var d=document.createElement('em'); d.textContent=bb.dataset.badge; b.querySelector('b').appendChild(d); } }
        b.addEventListener('click',function(){ go(r[0]); });
        box.appendChild(b);
      });
    });
    /* v31z414: Αποσύνδεση στο τέλος της λίστας (όπως στις ρυθμίσεις του κινητού)· η έκδοση μόνο ως κείμενο, ο έλεγχος για νέα έκδοση μόνο στα «Σχετικά» */
    var vf=document.createElement('div'); vf.className='ndphver';
    var lg=window.AlkyonCloud&&window.AlkyonCloud.logged&&window.AlkyonCloud.logged();
    if(lg&&$('acLogout')){ var ob=document.createElement('button'); ob.type='button'; ob.className='ndphout'; ob.textContent=T('Αποσύνδεση','Sign out');
      ob.addEventListener('click',function(){ var a=$('acLogout'); if(a) a.click(); }); vf.appendChild(ob); }
    var vt=document.createElement('span'); vt.textContent='Alkyon '+(window.ALKYON_VERSION||''); vf.appendChild(vt);
    home.appendChild(vf);
    var none=document.createElement('p'); none.className='note ndphnone'; none.hidden=true; none.textContent=T('Δεν βρέθηκε ρύθμιση.','No setting found.'); home.insertBefore(none,vf);
    filt();
  }
  var ROW={}; GROUPS.forEach(function(g){ g[1].forEach(function(r){ ROW[r[0]]=r; }); });
  /* v31z410: κάρτες χωρίς id παίρνουν id, ώστε κάθε γραμμή να δείχνει μόνο τις δικές της (πριν «Λογαριασμός» έδειχνε όλες τις ρυθμίσεις ξανά) */
  function tagCards(){ [['pName','pAccCard'],['acSync','pSyncCard'],['pPass','pPassCard']].forEach(function(p){ var e=$(p[0]), c=e&&e.closest('.card'); if(c&&!c.id) c.id=p[1]; });
    var ps=$('pSettings'); if(ps) [].forEach.call(ps.querySelectorAll('.card'),function(c){ if(!c.id&&/Αναγνώριση ψαριού με AI|AI fish (recognition|identification)/.test((c.querySelector('h3')||{}).textContent||'')) c.id='pAICard'; }); }
  /* v31z414: κάρτα «Έκδοση» στα Σχετικά: η μόνη θέση του ελέγχου για νέα έκδοση */
  function verCard(){ var ps=$('pSettings'); if(!ps) return; var c=$('ndVerCard');
    if(!c){ c=document.createElement('div'); c.id='ndVerCard'; c.className='card setcard ndver';
      c.innerHTML='<h3></h3><div class="ndverr"><div><b></b><small></small></div><button class="btn sm" type="button"></button></div><a class="btn sm ghost ndv4" href="v4/"></a>';
      c.querySelector('button').addEventListener('click',function(){ var u=$('ndChkUpd'), bt=this; if(!u) return; bt.disabled=true; bt.textContent=T('Έλεγχος…','Checking…'); u.click(); });
      window.addEventListener('alkyon-updmsg',function(e){ var sm=c.querySelector('small'), bt=c.querySelector('button'); sm.textContent=e.detail||''; sm.classList.add('ndvmsg'); bt.disabled=false; bt.textContent=T('Έλεγχος τώρα','Check now'); }); }
    c.querySelector('h3').textContent=T('Έκδοση','Version'); c.querySelector('b').textContent='Alkyon '+(window.ALKYON_VERSION||'');
    var sm=c.querySelector('small'); if(!sm.classList.contains('ndvmsg')) sm.textContent=T('Οι ενημερώσεις γίνονται αυτόματα όταν ανοίγεις την εφαρμογή.','Updates install automatically when you open the app.');
    var vb=c.querySelector('button'); if(!vb.disabled) vb.textContent=T('Έλεγχος τώρα','Check now');
    c.querySelector('.ndv4').textContent=T('Δοκίμασε το νέο Alkyon (δοκιμαστικό)','Try the new Alkyon (beta)');
    if(c.parentNode!==ps) ps.appendChild(c); }
  var inHome=false;
  function showHome(){
    if(!build()) return; moveAlerts(); inHome=true; paint();
    document.body.classList.add('ndphon'); home.hidden=false; back.hidden=true; var st0=$('ndPgTitle'); if(st0) st0.hidden=true;
    ['pMain','pSettings','pTackle','pGuide','pBoat'].forEach(function(i){ var x=$(i); if(x) x.hidden=true; });
    try{ $('profile').scrollTop=0; }catch(e){}
  }
  function go(k){
    if(k==='stats'&&window.AlkyonOpenStats){ window.AlkyonOpenStats(); return; }
    var r=ROW[k]; if(!r||!build()) return; moveAlerts();
    inHome=false; home.hidden=true; back.hidden=false; document.body.classList.add('ndphon');
    /* v31z413: μεγάλος τίτλος σελίδας και ομαλή μετάβαση */
    var st=$('ndPgTitle'); if(!st){ st=document.createElement('h2'); st.id='ndPgTitle'; st.className='ndphlt ndpgt'; back.parentNode.insertBefore(st,back.nextSibling); }
    st.textContent=r[1]; st.hidden=false; try{ var pf=$('profile'); pf.classList.remove('ndslide'); void pf.offsetWidth; pf.classList.add('ndslide'); }catch(e){}
    if(window.AlkyonProfView) window.AlkyonProfView.set(r[3]);
    home.hidden=true; back.hidden=false;
    document.body.classList.toggle('ndphone',!!r[4]);
    [].forEach.call(document.querySelectorAll('#pSettings .ndphsel'),function(x){ x.classList.remove('ndphsel'); });
    if(r[3]==='set'){
      setTimeout(function(){
        var pr=$('profile');
        tagCards(); if(k==='safety') safeCard(); if(k==='alerts') orgAlerts(); if(k==='about') verCard();
        var pt=nrm(r[1]); [].forEach.call(document.querySelectorAll('#pSettings .card>h3, #pSettings .card>b:first-child'),function(h){ var same=nrm(h.textContent).trim()===pt||(k==='units'&&/μοναδες|units/.test(nrm(h.textContent)))||(k==='alerts'&&/^ειδοποιησεις$|^alerts$/.test(nrm(h.textContent).trim())); h.classList.toggle('ndhdup',same); });
        (r[4]||'').split(',').forEach(function(id){ var t=id?$(id):null; if(t) t.classList.add('ndphsel'); });
        try{ pr.scrollTop=0; }catch(e){}
      },120);
    }
  }
  window.AlkyonProfGo=function(k){ var p=$('profile'), nb=$('navProf'); if(p&&p.hidden&&nb) nb.click(); setTimeout(function(){ go(k); },200); };
  /* άνοιγμα του Profile → λίστα. Αν κάποιος άλλος ανοίξει συγκεκριμένη ενότητα (π.χ. Σκάφος), φαίνεται το «‹ Profile». */
  var n=0, iv=setInterval(function(){ n++; var pbtn=$('profBtn');
    if(pbtn&&build()){ clearInterval(iv);
      pbtn.addEventListener('click',function(){ setTimeout(showHome,0); });
      /* v31z411: πάτημα στο όνομα/εικόνα πάνω → Λογαριασμός */
      try{ var ph=document.querySelector('#profile .phead'); if(ph&&!ph.dataset.ndgo){ ph.dataset.ndgo='1'; ph.style.cursor='pointer';
        ph.addEventListener('click',function(e){ if(e.target.closest('button')) return; if(inHome) go('account'); }); } }catch(e){}
      /* v31z403: αν το Profile ανοίξει από αλλού (π.χ. μετά από ενημέρωση ή επαναφόρτωση), δείχνει τη λίστα και όχι την παλιά όψη με καρτέλες */
      try{ var prf=$('profile'); if(prf){ var chk=function(){ if(!prf.hidden&&!document.body.classList.contains('ndphon')) setTimeout(function(){ if(!prf.hidden&&!document.body.classList.contains('ndphon')) showHome(); },60); };
        new MutationObserver(chk).observe(prf,{attributes:true,attributeFilter:['hidden']}); chk(); } }catch(e){}
      window.addEventListener('alkyon-pview',function(){ if(!home) return; inHome=false; home.hidden=true; back.hidden=false; });
      moveAlerts();
    } else if(n>40) clearInterval(iv); },500);
})();

/* v31z369 · Ημερολόγιο: έξοδοι σε σύντομη μορφή με «⋯» για τα υπόλοιπα· τα στατιστικά σε ένα σημείο (Ημερολόγιο › Στατιστικά)·
   το αντίγραφο ασφαλείας μόνο στο Profile. */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore;
  var $=function(i){ return document.getElementById(i); };
  function compact(){
    var L=$('tripList'); if(!L) return;
    [].forEach.call(L.querySelectorAll(':scope>.item[data-tid]'),function(it){
      seenTag(it); privTag(it);
      if(it.querySelector(':scope>.ndxb')) return;
      it.classList.add('ndcmp');
      var main=it.firstElementChild, extra=main?[].slice.call(main.children).slice(2):[], acts=it.querySelector(':scope>.acts');
      if(!extra.length&&!acts) return;
      var b=document.createElement('button'); b.type='button'; b.className='ndxb'; b.textContent='⋯'; b.setAttribute('aria-expanded','false');
      b.setAttribute('aria-label',T('Επιλογές εξόδου','Trip options'));
      b.addEventListener('click',function(){ var on=!it.classList.contains('ndx'); it.classList.toggle('ndx',on); b.setAttribute('aria-expanded',String(on)); });
      it.appendChild(b);
    });
  }
  /* v31z415: ιδιωτική έξοδος (δεν τη βλέπουν οι φίλοι), όπως ήδη τα ψάρια και τα σημεία */
  function privTag(it){
    var lg=window.AlkyonCloud&&window.AlkyonCloud.logged&&window.AlkyonCloud.logged(); if(!lg) return;
    var tr=null; try{ tr=(C.Store.get('trips')||[]).filter(function(t){ return t.id===it.dataset.tid; })[0]; }catch(e){} if(!tr) return;
    var acts=it.querySelector(':scope>.acts');
    if(acts&&!acts.querySelector('.ndpriv')){ var pb=document.createElement('button'); pb.type='button'; pb.className='btn ghost sm ndpriv';
      pb.textContent=tr.priv?T('Κρυφή από φίλους ✓','Hidden from friends ✓'):T('Κρύψε από φίλους','Hide from friends'); pb.setAttribute('aria-pressed',String(!!tr.priv));
      pb.addEventListener('click',function(){ var cur=(C.Store.get('trips')||[]).filter(function(t){ return t.id===tr.id; })[0]; if(!cur) return; var nx=Object.assign({},cur); if(nx.priv) delete nx.priv; else nx.priv=true;
        C.Store.save('trips',nx); C.toast(nx.priv?T('Η έξοδος είναι κρυφή από τους φίλους.','This trip is hidden from friends.'):T('Οι φίλοι βλέπουν ξανά την έξοδο.','Friends can see this trip again.')); });
      acts.appendChild(pb); }
    if(tr.priv&&!it.querySelector('.ndprivt')){ var m=it.querySelector(':scope>div:not(.ndth)>.meta'); if(m){ var sp=document.createElement('span'); sp.className='ndprivt'; sp.textContent=' · '+T('κρυφή','hidden'); m.appendChild(sp); } }
  }
  /* «Είδα» (ψαροντούφεκο): στη γραμμή της εξόδου και στα στατιστικά */
  function seenList(){ try{ return (window.AlkyonSeen&&window.AlkyonSeen.all())||[]; }catch(e){ return []; } }
  function seenTag(it){
    if(it.querySelector('.ndseen')) return; var tr=null; try{ tr=(C.Store.get('trips')||[]).filter(function(t){ return t.id===it.dataset.tid; })[0]; }catch(e){}
    if(!tr||!tr.startMs) return; var n=seenList().filter(function(x){ return x.start===tr.startMs; }).length; if(!n) return;
    var m=it.querySelector(':scope>div:not(.ndth)>.meta'); if(!m) return; var s=document.createElement('span'); s.className='ndseen'; s.textContent=' · 👁 '+n+' '+T('είδα','seen'); m.appendChild(s);
  }
  function seenStats(){
    var st=$('stats'); if(!st) return; var a=seenList(), el=$('ndSeenSt');
    if(!a.length){ if(el) el.remove(); return; }
    if(!el){ el=document.createElement('div'); el.id='ndSeenSt'; el.style.cssText='grid-column:1/-1;font-size:13px;padding:4px 0'; st.appendChild(el); }
    var tr={}; a.forEach(function(x){ tr[x.start]=1; }); var t=T('Ψαροντούφεκο: ','Spearfishing: ')+a.length+' '+T('ψάρια που είδες χωρίς βολή, σε ','fish seen without a shot, on ')+Object.keys(tr).length+' '+T('εξόδους','trips');
    if(el.textContent!==t) el.textContent=t;
  }
  function stats(){
    try{ seenStats(); }catch(e){}
    var st=$('stats'), ls=$('l-stats'); if(st&&ls&&st.parentNode!==ls) ls.insertBefore(st,ls.firstChild);
    var eb=$('expBtn'), card=eb&&eb.closest('.card'); if(card&&card.closest('#tab-log')) card.classList.add('ndgone');
    var bt=document.querySelector('#logSeg [data-l=bites]'); if(bt&&bt.textContent!==T('Ψάρια','Fish')) bt.textContent=T('Ψάρια','Fish');
  }
  /* Profile › Στατιστικά → Ημερολόγιο › Στατιστικά */
  window.AlkyonOpenStats=function(){ var pc=$('pClose'), p=$('profile'); if(p&&!p.hidden&&pc) pc.click(); try{ C.switchTab('log'); }catch(e){} setTimeout(function(){ var b=document.querySelector('#logSeg [data-l=stats]'); if(b) b.click(); try{ window.scrollTo(0,0); }catch(e){} },80); };
  function init(){ var L=$('tripList'); if(!L) return false; compact(); stats(); new MutationObserver(function(){ setTimeout(compact,0); }).observe(L,{childList:true}); return true; }
  var n=0, iv=setInterval(function(){ n++; if(init()||n>40) clearInterval(iv); },500);
  window.ndEvery(stats,3000);
})();

/* v31z370 · Μία φορά: (α) οι τεχνικές που γράφτηκαν στα αγγλικά γίνονται ίδιες με τις ελληνικές, ώστε να μη φαίνονται διπλές στα στατιστικά·
   (β) οι επιλογές τεχνικής κρατάνε πάντα την ελληνική τιμή· (γ) η διαδρομή GPS ανοίγει ξανά στο σκάφος. */
(function(){
  var MAP={'Bottom fishing':'Βυθού','Live bait':'Ζωντανό δόλωμα','Trolling':'Τρόλινγκ','Other':'Άλλο','Net':'Δίχτυ','Longline':'Παραγάδι'};
  function opts(){ ['tTech','bTech'].forEach(function(id){ var s=document.getElementById(id); if(!s) return; [].forEach.call(s.options,function(o){ var g=MAP[o.textContent.trim()]; if(g&&!o.hasAttribute('value')) o.value=g; }); }); }
  function migrate(){
    var C=window.AlkyonCore; if(!C||!C.Store||!C.Store.raw) return false;
    try{ if(localStorage.getItem('alkyon-mig-tech')) return true; }catch(e){ return true; }
    ['bites','trips'].forEach(function(k){ (C.Store.raw(k)||[]).forEach(function(x){ var g=x&&MAP[(x.tech||'').trim()]; if(g){ try{ C.Store.save(k,Object.assign({},x,{tech:g})); }catch(e){} } }); });
    try{ localStorage.setItem('alkyon-mig-tech','1'); }catch(e){}
    try{ if(!localStorage.getItem('alkyon-mig-gps')){ localStorage.setItem('alkyon-mig-gps','1'); var fp=localStorage.getItem('alkyon-fprof')||'boat'; if(fp==='boat'&&window.AlkyonTrack&&window.AlkyonTrack.setEnabled&&!window.AlkyonTrack.enabled()) window.AlkyonTrack.setEnabled(true); } }catch(e){}
    return true;
  }
  var n=0, iv=setInterval(function(){ n++; opts(); if(migrate()||n>40) clearInterval(iv); },1500);
})();

/* ===================== v31z371 · τα υπόλοιπα από τα σχέδια ===================== */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore, PU=window.AlkyonUnits;
  var $=function(i){ return document.getElementById(i); };
  function p2(n){ return (n<10?'0':'')+n; }
  function E(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
  function nf(v,d){ return (Math.round(v*Math.pow(10,d||0))/Math.pow(10,d||0)).toLocaleString(EN?'en-GB':'el-GR'); }
  function prof(){ try{ return localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){ return 'boat'; } }

  /* ---------- 1. Στατιστικά όπως στο σχέδιο (πάνω από τα αναλυτικά) ---------- */
  function inR(x){ try{ return window.AlkyonRange?window.AlkyonRange.inR('log',x):true; }catch(e){ return true; } }
  function bar(lab,val,pct,txt,cls){ var r=E('div','ndibar'+(cls?' '+cls:'')); r.append(E('span','',lab)); var t=E('div','ndit'); var i=E('i'); i.style.width=Math.max(0,Math.min(100,pct))+'%'; t.appendChild(i); r.append(t,E('b','',txt)); return r; }
  var insBusy=false, insSig='';
  function insights(){
    var ls=$('l-stats'); if(!ls||ls.hidden||!C||!C.Store||insBusy) return; insBusy=true;
    try{
      var fp0=prof(), fm=fp0==='spear'?'spear':fp0==='lake'?'lake':'rod', ff=function(x){ var p=x&&x.prof; return (p==='spear'?'spear':p==='lake'?'lake':'rod')===fm; };
      var allT=C.Store.get('trips')||[], trips=allT.filter(inR).filter(ff), bites=(C.Store.act?C.Store.act():C.Store.get('bites')).filter(inR).filter(ff), miss=(C.Store.misses?C.Store.misses():[]).filter(inR).filter(ff);
      var sig=[fm,trips.length,bites.length,miss.length,(window.AlkyonRange&&JSON.stringify(window.AlkyonRange.get&&window.AlkyonRange.get('log')))||'',(C.lsGet&&C.lsGet('alkyon-range-log',''))||''].join('|')+'|'+allT.length;
      var box=$('ndIns'); if(box&&sig===insSig&&box.parentNode===ls) return; insSig=sig;
      if(!box){ box=E('div','ndins'); box.id='ndIns'; } if(box.parentNode!==ls||ls.firstChild!==box) ls.insertBefore(box,ls.firstChild);
      box.replaceChildren();
      var ms=0, sess=0; trips.forEach(function(t){ if(t.startMs&&t.endMs&&t.endMs>t.startMs&&!t.manual){ var d=t.endMs-t.startMs-(t.pauseMs||0); if(d>0){ ms+=d; try{ sess+=C.tripEff(t,allT).count; }catch(e){} } } });
      var fish=0, kg=0, sp={}; bites.forEach(function(b){ var n=C.bc?C.bc(b):1; fish+=n; kg+=b.rel?0:(+b.kg||0); var s=(b.species||'').trim(); if(s) sp[s]=(sp[s]||0)+n; });
      var m=miss.length, hrs=ms/3600000, rate=hrs>=0.5?sess/hrs:null;
      var k=E('div','ndikpi');
      [[String(trips.length),T('έξοδοι','trips')+(hrs?' · '+nf(hrs,1)+(fm==='spear'?T(' ώρες στο νερό',' h in water'):T(' ώρες',' h')):'')],[String(fish),T('ψάρια','fish')+(kg?' · '+nf(kg,1)+' kg':'')],
       [String(m),(fm==='spear'?T('χαμένες βολές','missed shots'):T('χάθηκαν','lost'))+(fish+m?' · '+Math.round(fish/(fish+m)*100)+'% '+(fm==='spear'?T('εύστοχες','on target'):T('πιάστηκαν','landed')):'')],[rate==null?'–':nf(rate,2),fm==='spear'?T('ψάρια / ώρα στο νερό','fish / hour in water'):T('ψάρια / ώρα','fish / hour')]].forEach(function(x){ var c=E('div','ndik'); c.append(E('b','',x[0]),E('span','',x[1])); k.appendChild(c); });
      box.appendChild(k);
      var PP=window.PP, mdl=null; try{ if(PP) mdl=PP.build(allT,C.Store.act(),{utcMin:C.utcMin(),misses:(C.Store.misses?C.Store.misses():[])}); }catch(e){}
      if(mdl&&mdl.progress){
        var p=mdl.progress, N=p.need, f=Math.min(1,p.hours/N.hours,p.sessions/N.sessions,p.catches/N.catches), c=E('div','ndicard');
        var hd=E('div','ndih'); hd.append(E('b','',T('Η προσωπική σου πρόγνωση','Your personal forecast')),E('span',mdl.ready?'ok':'wait',mdl.ready?T('έτοιμη','ready'):T('μαθαίνει','learning'))); c.appendChild(hd);
        var pb=E('div','ndit big'), pi=E('i'); pi.style.width=Math.round(f*100)+'%'; pb.appendChild(pi); c.appendChild(pb);
        var miss3=[]; if(p.hours<N.hours) miss3.push(T('ώρες ψαρέματος ','fishing hours ')+nf(p.hours,1)+'/'+N.hours); if(p.sessions<N.sessions) miss3.push(T('έξοδοι ','trips ')+p.sessions+'/'+N.sessions); if(p.catches<N.catches) miss3.push(T('ψάρια μέσα σε έξοδο ','fish during a trip ')+p.catches+'/'+N.catches);
        c.appendChild(E('p','',mdl.ready?T('Έχει αρκετά δεδομένα. Βελτιώνεται όσο προσθέτεις εξόδους.','Enough data. It improves as you add trips.'):T('Λείπουν: ','Still needed: ')+miss3.join(' · ')));
        if(!mdl.ready) c.appendChild(E('small','',T('Πάτα «Έναρξη εξόδου» πριν ψαρέψεις, για να μετρήσουν τα ψάρια.','Tap “Start trip” before fishing so your catches count.')));
        box.appendChild(c);
        /* Τι λειτουργεί για σένα: το καλύτερο σε κάθε παράγοντα */
        var w=E('div','ndicard'); w.appendChild(E('b','ndit2',T('Τι λειτουργεί για σένα','What works for you')));
        w.appendChild(E('small','',T('Ψάρια ανά ώρα ψαρέματος, σε σχέση με τον μέσο όρο σου','Fish per hour fished, compared with your average')));
        var LAB={block:function(i){ return (EN?PP.LIGHT_EN:PP.LIGHT_EL)[i]; },moon:function(i){ return [T('Νέα σελήνη','New moon'),T('Α΄ τέταρτο','First quarter'),T('Πανσέληνος','Full moon'),T('Δ΄ τέταρτο','Last quarter')][i]; },
          ptrend:function(i){ return [T('Πέφτει απότομα','Falling fast'),T('Πέφτει αργά','Falling slowly'),T('Σταθερή','Steady'),T('Ανεβαίνει','Rising')][i]; },wind:function(i){ return [T('Ήπιος (έως 3 Bft)','Light (to 3 Bft)'),T('Μέτριος (3–4 Bft)','Moderate (3–4 Bft)'),T('Δυνατός (5+ Bft)','Strong (5+ Bft)')][i]; }};
        var TT={block:T('Φως','Light'),moon:T('Σελήνη','Moon'),ptrend:T('Πίεση','Pressure'),wind:T('Άνεμος','Wind')}, any=false;
        Object.keys(TT).forEach(function(key){ var fs=mdl.factors&&mdl.factors[key]; if(!fs) return; var best=-1; fs.forEach(function(x,i){ if(x.h>=1&&(best<0||x.m>fs[best].m)) best=i; }); if(best<0) return; any=true;
          var r=E('div','ndiw'); var mv=fs[best].m; r.append(E('span','',TT[key]),E('span','',LAB[key](best)),E('b',mv>=1.15?'up':mv<=0.87?'dn':'',('×'+mv.toFixed(1)).replace('.',EN?'.':','))); w.appendChild(r); });
        if(!any) w.appendChild(E('p','',T('Θα φανεί μόλις έχεις ώρες ψαρέματος από εξόδους με «Έναρξη».','Shows once you have fishing hours from started trips.')));
        else if(!mdl.ready) w.appendChild(E('small','',T('Λίγα δεδομένα ακόμα: ένδειξη, όχι κανόνας.','Little data yet: a hint, not a rule.')));
        box.appendChild(w);
      }
      try{ var cb=PP.calib(allT,C.Store.act(),{utcMin:C.utcMin(),misses:(C.Store.misses?C.Store.misses():[])}), cc=E('div','ndicard');
        cc.appendChild(E('b','ndit2',T('Ο βαθμός της εφαρμογής στην πράξη','The app’s score in practice')));
        var mx=Math.max.apply(null,cb.bins.map(function(b){ return b.rate||0; }).concat([0.01]));
        cb.bins.forEach(function(b,i){ cc.appendChild(bar([T('κάτω από 60','below 60'),'60–79','80+'][i],0,b.h>0?(b.rate||0)/mx*100:0,b.h>0?nf(b.rate,2)+T('/ώρα','/h'):'—')); });
        cc.appendChild(E('small','',cb.ok?(cb.ratio>=1.3||cb.ratio===Infinity?T('✓ Στις ώρες με υψηλό βαθμό έπιανες περισσότερα.','✓ You caught more at high-score hours.'):T('Δεν φαίνεται ακόμα ουσιαστική διαφορά.','No clear difference yet.')):T('Ξεκινά μετά από 6 εξόδους με «Έναρξη» (τώρα ','Starts after 6 started trips (now ')+(cb.n||0)+').'));
        box.appendChild(cc); }catch(e){}
      var spl=Object.keys(sp).map(function(s){ return [s,sp[s]]; }).sort(function(a,b){ return b[1]-a[1]; }).slice(0,8);
      if(spl.length){ var sc=E('div','ndicard'); sc.appendChild(E('b','ndit2',T('Είδη','Species'))); var top=spl[0][1]; spl.forEach(function(x){ sc.appendChild(bar(x[0],0,x[1]/top*100,String(x[1]),'sp')); }); box.appendChild(sc); }
      box.appendChild(E('div','ndisep',T('Αναλυτικά','In detail')));
    }finally{ insBusy=false; }
  }

  /* ---------- 2. «Σήμερα ανά ώρα» ως 24 μπάρες ---------- */
  function hourBars(){
    var strip=document.querySelector('.ndhr > .ndhrh'); if(!strip||!strip.offsetParent) return;
    strip.classList.add('ndbars');
    var chips=[].slice.call(strip.querySelectorAll('.ndhc')); if(!chips.length) return;
    var bt=$('ndBestT'), bw=bt&&bt.querySelector('b')?/^(\d\d):00/.exec(bt.querySelector('b').textContent):null, bh=bw?+bw[1]:-9;
    var per=[]; try{ var c=C.getCond&&C.getCond(), d0=new Date(); d0.setHours(0,0,0,0); per=window.ndSol(d0.getTime(),d0.getTime()+86400000,c&&c.lat!=null?+c.lat:35,c&&c.lon!=null?+c.lon:33); }catch(e){}
    var d0m=new Date(); d0m.setHours(0,0,0,0);
    chips.forEach(function(ch){
      var v=+((ch.querySelector('i')||{}).textContent)||0, hr=+ch.dataset.h; ch.style.setProperty('--sc',v);
      var t0=d0m.getTime()+hr*3600000, inMoon=per.some(function(p){ return p.s<t0+3600000&&p.e>t0; });
      ch.classList.toggle('best',hr===bh||hr===bh+1); ch.classList.toggle('moon',inMoon);
      ch.classList.toggle('bad',ch.dataset.lv==='b');
    });
    var ax=strip.nextElementSibling; if(!ax||!ax.classList.contains('ndbax')){ ax=E('div','ndbax'); strip.after(ax);
      var lg=E('div','ndblg'); [['best',T('καλύτερες ώρες','best hours')],['moon',T('σελήνη (Knight)','moon (Knight)')],['bad',T('δύσκολες','poor')]].forEach(function(x){ var s=E('span',''); s.append(E('i',x[0]),document.createTextNode(x[1])); lg.appendChild(s); }); ax.after(lg); }
    var lab=chips.length>=20?['00','06','12','18','23']:[]; if(ax.textContent!==lab.join('')){ ax.replaceChildren(); lab.forEach(function(l){ ax.appendChild(E('span','',l)); }); }
  }

  /* ---------- 3. 7 μέρες: βεβαιότητα και ★ στην καλύτερη ---------- */
  function days7(){
    var D=$('fcDays'); if(!D||!D.offsetParent) return;
    var rows=[].slice.call(D.querySelectorAll(':scope>.fday')); if(!rows.length) return;
    var best=-1, bv=-1; rows.forEach(function(r,i){ var p=r.querySelector('summary .pill'), v=p?parseInt(p.textContent,10):NaN; if(!isNaN(v)&&v>bv){ bv=v; best=i; } });
    rows.forEach(function(r,i){
      var sm=r.querySelector('summary'); if(!sm) return; var dot=sm.querySelector('.ndconf');
      if(!dot){ dot=E('span','ndconf'); var p=sm.querySelector('.pill'); if(p) p.before(dot); else sm.appendChild(dot); }
      var lv=i<=1?2:i<=3?1:0; dot.dataset.c=lv; dot.title=[T('χαμηλή βεβαιότητα','low confidence'),T('μέτρια βεβαιότητα','medium confidence'),T('υψηλή βεβαιότητα','high confidence')][lv]; dot.setAttribute('aria-label',dot.title);
      var b=sm.querySelector('.fdt b'); if(b){ var has=/ ★$/.test(b.textContent); if(i===best&&!has) b.textContent+=' ★'; else if(i!==best&&has) b.textContent=b.textContent.replace(/ ★$/,''); }
    });
    var nt=$('ndConfNote'); if(!nt){ nt=E('p','note',T('Τελεία: βεβαιότητα (γεμάτη = υψηλή) · ★ η καλύτερη μέρα','Dot: confidence (full = high) · ★ best day')); nt.id='ndConfNote'; D.after(nt); }
  }

  /* ---------- 4. Ημερολόγιο: τετράγωνο ανά έξοδο και φίλτρα σε λίστα ---------- */
  function logLook(){
    var L=$('tripList'); if(!L) return; var all=null;
    [].forEach.call(L.querySelectorAll(':scope>.item[data-tid]'),function(it){
      if(it.querySelector(':scope>.ndth')) return; if(!all) all=C.Store.get('trips')||[];
      var t=all.filter(function(x){ return x.id===it.dataset.tid; })[0]; if(!t) return; var n=0; try{ n=C.tripEff(t,all).count; }catch(e){ n=+t.count||0; }
      var fmT=t.prof==='spear'?'spear':t.prof==='lake'?'lake':'sea'; it.dataset.fam=fmT;
      var th=E('div','ndth'+(n>0?' got':'')+' fam-'+fmT); th.setAttribute('aria-hidden','true'); th.textContent=n>0?String(n):''; it.insertBefore(th,it.firstChild); it.classList.add('ndthi');
    });
    var R=$('logRange'); if(R&&!$('ndRngSel')){
      var chips=R.querySelector('.rngchips'), more=R.querySelector('.rngmore'); if(!chips) return;
      var sel=document.createElement('select'); sel.id='ndRngSel'; sel.className='ndpillsel'; sel.setAttribute('aria-label',T('Περίοδος','Period'));
      [].forEach.call(chips.querySelectorAll('button'),function(b,i){ var o=document.createElement('option'); o.value=String(i); o.textContent=b.textContent; sel.appendChild(o); });
      var oc=document.createElement('option'); oc.value='c'; oc.textContent=T('Άλλες ημερομηνίες…','Other dates…'); sel.appendChild(oc);
      function sync(){ var on=[].slice.call(chips.querySelectorAll('button')).findIndex(function(b){ return b.getAttribute('aria-pressed')==='true'||b.classList.contains('on')||b.classList.contains('acc'); }); sel.value=on>=0?String(on):(more&&more.open?'c':sel.value); }
      sel.addEventListener('change',function(){ if(sel.value==='c'){ if(more){ more.open=true; R.classList.add('ndcust'); } return; } R.classList.remove('ndcust'); if(more) more.open=false; var b=chips.querySelectorAll('button')[+sel.value]; if(b) b.click(); });
      var row=E('div','ndlrow'); row.appendChild(sel); R.insertBefore(row,R.firstChild); R.classList.add('ndrng');
      sync(); new MutationObserver(sync).observe(chips,{attributes:true,subtree:true});
    }
    var ss=document.querySelector('#l-trips > .sortsel'), row2=document.querySelector('#logRange .ndlrow');
    if(ss&&row2&&ss.parentNode!==row2){ var s=ss.querySelector('select'); if(s){ s.classList.add('ndpillsel'); s.setAttribute('aria-label',T('Ταξινόμηση','Sort')); row2.appendChild(s); ss.classList.add('ndgone'); } }
    /* v31z392: φίλτρο τύπου ψαρέματος στο Ημερολόγιο (όλα μαζί ή μόνο ένας τύπος) */
    if(row2&&!$('ndFamSel')){ var fs=document.createElement('select'); fs.id='ndFamSel'; fs.className='ndpillsel'; fs.setAttribute('aria-label',T('Τύπος ψαρέματος','Fishing type'));
      [['all',T('Όλοι οι τύποι','All types')],['sea',T('Θάλασσα (καλάμι)','Sea (rod)')],['lake',T('Φράγμα / λίμνη','Dam / lake')],['spear',T('Ψαροντούφεκο','Spearfishing')]].forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; fs.appendChild(op); });
      try{ fs.value=localStorage.getItem('alkyon-logfam')||'all'; }catch(e){}
      fs.addEventListener('change',function(){ try{ localStorage.setItem('alkyon-logfam',fs.value); }catch(e){} famPaint(); }); row2.appendChild(fs); }
    famPaint();
    var cnt=$('ndLogCnt'), st=$('stats'); if(row2&&!cnt){ cnt=E('span','ndlcnt'); cnt.id='ndLogCnt'; row2.appendChild(cnt); }
    if(cnt&&st){ var bs=st.querySelectorAll(':scope>div>b'); if(bs.length>=2){ var t=bs[0].textContent+' '+T('έξοδοι','trips')+' · '+bs[1].textContent+' '+T('ψάρια','fish'); if(cnt.textContent!==t) cnt.textContent=t; } }
  }

  function famPaint(){ var v='all'; try{ v=localStorage.getItem('alkyon-logfam')||'all'; }catch(e){} var L=$('tripList'); if(!L) return; L.dataset.fam=v; }
  /* ---------- 5. Ψαροντούφεκο στην έξοδο: συνθήκες, σημαδούρα, κατάδυση ---------- */
  function spearBar(){
    var on=document.body.classList.contains('ontrip')&&prof()==='spear', box=document.querySelector('.mapbox'), w=$('ndSpBar');
    if(!on||!box){ if(w) w.hidden=true; var pp=$('ndBuoy'), dv=$('ndDivePill'); if(pp) pp.hidden=true; if(dv) dv.hidden=true; return; }
    var s=null; try{ s=window.AlkyonTrip.state(); }catch(e){}
    if(!w){ w=E('div','ndspbar'); w.id='ndSpBar'; box.appendChild(w); }
    w.hidden=false;
    var c=C.getCond&&C.getCond()||{}, kn=function(v){ return v==null?null:v/1.852; };
    var wv=c.wave, wd=c.wind;
    var vis=null, hv=window.ndVis&&window.ndVis(); if(hv) vis=hv.lab; else if(wv!=null||wd!=null){ var sc=(wv||0)*2+(wd||0)/15; vis=sc<0.8?T('Καλή','Good'):sc<1.6?T('Μέτρια','Fair'):T('Κακή','Poor'); }
    var tiles=[[wv!=null?(PU&&PU.wave?PU.wave(wv):nf(wv,1)+' m'):'–',T('κύμα','waves')],[c.cur!=null?nf(kn(c.cur),1)+' kn':'–',T('ρεύμα','current')],[vis||'–',T('ορατότητα*','visibility*')]];
    var sig=JSON.stringify(tiles); if(w.dataset.sig!==sig){ w.dataset.sig=sig; w.replaceChildren(); var g=E('div','ndspg'); tiles.forEach(function(t){ var d=E('div',''); d.append(E('b','',t[0]),E('span','',t[1])); g.appendChild(d); }); w.append(g,E('small','',hv?T('* εκτίμηση από κύμα και άνεμο των 2 τελευταίων ημερών','* estimate from waves and wind over the last 2 days'):T('* εκτίμηση από κύμα και άνεμο','* estimate from waves and wind'))); }
    var live=document.querySelector('.ndlive:not([hidden])'), r0=box.getBoundingClientRect();
    if(live){ var r=live.getBoundingClientRect(); w.style.top=Math.round(r.bottom-r0.top+8)+'px'; }
    var dg=$('ndDanger'); if(dg){ var wr=w.getBoundingClientRect(); if(wr.height) dg.style.top=Math.round(wr.bottom-r0.top+10)+'px'; }
    /* σημαδούρα: πάτημα = ✓ */
    var key='alkyon-buoy-'+(s&&s.start||0), ok=false; try{ ok=localStorage.getItem(key)==='1'; }catch(e){}
    var bp=$('ndBuoy'); if(!bp){ bp=E('button','ndbuoy'); bp.type='button'; bp.id='ndBuoy'; bp.addEventListener('click',function(){ var k='alkyon-buoy-'+((window.AlkyonTrip.state()||{}).start||0), v=false; try{ v=localStorage.getItem(k)==='1'; localStorage.setItem(k,v?'0':'1'); }catch(e){} spearBar(); }); box.appendChild(bp); }
    bp.hidden=false; bp.classList.toggle('ok',ok); bp.textContent=ok?T('Σημαδούρα ✓','Float ✓'):T('Σημαδούρα;','Float?'); bp.setAttribute('aria-pressed',String(ok));
    if(dg){ bp.style.top=dg.style.top; }
    /* χρονόμετρο κατάδυσης στον χάρτη: χρησιμοποιεί το ίδιο χρονόμετρο με τη φόρμα της εξόδου */
    var dp=$('ndDivePill'); if(!dp){ dp=E('button','nddivep'); dp.type='button'; dp.id='ndDivePill'; dp.addEventListener('click',function(){ var b=$('ndDb'); if(b) b.click(); setTimeout(spearBar,50); }); box.appendChild(dp); }
    var db=$('ndDb'), dv2=$('ndDv'); dp.hidden=!db;
    if(db){ var diving=/Επιφάνεια|Surfaced/.test(db.textContent); dp.classList.toggle('on',diving); var tt=(diving?'▲ ':'▼ ')+(dv2?dv2.textContent:'0:00'); if(dp.textContent!==tt) dp.textContent=tt; dp.setAttribute('aria-label',diving?T('Βγήκα στην επιφάνεια','Surfaced'):T('Κατάδυση','Dive')); dp.style.color=dv2&&dv2.style.color?'#ff8a80':''; if(bp.style.top){ dp.style.top=(parseInt(bp.style.top,10)+48)+'px'; } }
  }

  /* ---------- 6. Κεφαλίδα του Profile: γράμμα, όνομα, συγχρονισμός, έκδοση ---------- */
  /* v31z412: κάρτα ψαρά: όνομα, συγχρονισμός με χρώμα, η χρονιά σου, «Όλα τα στατιστικά». Ξαναγράφεται μόνο όταν αλλάζει κάτι. */
  function profHead(){
    var home=$('pHome'); if(!home||home.hidden) return;
    var hd=$('ndPHead');
    if(!hd){ hd=E('div','ndpcard'); hd.id='ndPHead';
      hd.innerHTML='<button type="button" class="ndphead"><div class="ndpav"></div><div class="ndpnm"><b></b><span><i class="ndsy"></i><em></em></span></div><i class="ndpch" aria-hidden="true">›</i></button><div class="ndpyr"></div><button type="button" class="ndpall"></button>';
      hd.querySelector('.ndphead').addEventListener('click',function(){ if(window.AlkyonProfGo) window.AlkyonProfGo('account'); });
      hd.querySelector('.ndpall').addEventListener('click',function(){ if(window.AlkyonOpenStats) window.AlkyonOpenStats(); }); }
    var lt0=home.querySelector('.ndphlt'), want=lt0?lt0.nextSibling:home.firstChild; if(hd.previousSibling!==(lt0||null)||hd.parentNode!==home) home.insertBefore(hd,want);
    var nm=(($('pNameShow')||{}).textContent||'').trim(), last=0, sess=null; if(nm==='?') nm='';
    try{ last=+JSON.parse(localStorage.getItem('alkyon-last'))||0; }catch(e){ try{ last=+localStorage.getItem('alkyon-last')||0; }catch(x){} }
    try{ sess=JSON.parse(localStorage.getItem('alkyon-sess')||'null'); }catch(e){}
    var st=(($('acStatus')||{}).textContent||''), logged=!!(sess&&(sess.access_token||sess.email)), bad=/Σφάλμα|Error|έληξε|expired|Λείπει|missing/i.test(st);
    var cls=!logged?'off':bad?'bad':(last&&Date.now()-last<86400000)?'ok':'warn';
    var d=last?new Date(last):null, today=new Date().toDateString();
    var stT=!logged?T('Χωρίς λογαριασμό · μόνο σε αυτό το κινητό','No account · this phone only'):bad?T('Πρόβλημα συγχρονισμού','Sync problem'):d?T('Συγχρονίστηκε ','Synced ')+(d.toDateString()===today?p2(d.getHours())+':'+p2(d.getMinutes()):d.toLocaleDateString(EN?'en-GB':'el-GR')):T('Δεν έχει συγχρονιστεί','Not synced');
    var y=String(new Date().getFullYear()), bs=[], tr=[]; try{ bs=(C.Store.act?C.Store.act():C.Store.get('bites')).filter(function(b){ return (b.date||'').slice(0,4)===y; }); tr=(C.Store.get('trips')||[]).filter(function(t){ return (t.date||'').slice(0,4)===y; }); }catch(e){}
    var n=bs.reduce(function(a,b){ return a+(C.bc?C.bc(b):1); },0), best=null, pl={}; bs.forEach(function(b){ if(+b.kg>0&&(!best||+b.kg>+best.kg)) best=b; if(b.place) pl[b.place]=(pl[b.place]||0)+1; });
    var top=Object.keys(pl).sort(function(a,b){ return pl[b]-pl[a]; })[0];
    var cells=[[String(tr.length),T('έξοδοι ','trips ')+y],[String(n),T('ψάρια','fish')],[best?(String(Math.round(best.kg*10)/10).replace('.',EN?'.':',')+' kg'):'–',best?(best.species||T('καλύτερο','best')):T('καλύτερο ψάρι','best fish')],[top||'–',T('αγαπημένο σημείο','top spot')]];
    var sig=[nm,cls,stT,JSON.stringify(cells)].join('|'); if(hd.dataset.sig===sig) return; hd.dataset.sig=sig;
    hd.querySelector('.ndpav').textContent=(nm||'?').charAt(0).toUpperCase();
    hd.querySelector('.ndpnm b').textContent=nm||T('Πάτα για να βάλεις όνομα','Tap to add your name');
    hd.querySelector('.ndsy').className='ndsy '+cls; hd.querySelector('.ndpnm em').textContent=stT;
    var yr=hd.querySelector('.ndpyr'); yr.replaceChildren(); cells.forEach(function(c){ var x=E('div','ndpyc'); var b=E('b'); b.textContent=c[0]; var sp=E('span'); sp.textContent=c[1]; x.append(b,sp); yr.appendChild(x); });
    hd.querySelector('.ndpall').textContent=T('Όλα τα στατιστικά ›','All stats ›');
  }

  function tick(){ try{ insights(); }catch(e){} try{ hourBars(); }catch(e){} try{ days7(); }catch(e){} try{ logLook(); }catch(e){} try{ spearBar(); }catch(e){} try{ profHead(); }catch(e){} }
  window.ndEvery(tick,1000); document.addEventListener('click',function(){ setTimeout(tick,80); },true);
  if(C&&C.Store&&C.Store.on){ ['trips','bites'].forEach(function(k){ try{ C.Store.on(k,function(){ insSig=''; }); }catch(e){} }); }
  window.addEventListener('alkyon-range',function(){ insSig=''; setTimeout(tick,50); });
})();

/* ===================== v31z373 ===================== */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore;
  var $=function(i){ return document.getElementById(i); };
  function ls(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function prof(){ return ls('alkyon-fprof')||'boat'; }

  /* ---------- «Είδα» στον χάρτη ---------- */
  var KEY='alkyon-showseen', grp=null, sig='';
  function seen(){ try{ return (window.AlkyonSeen&&window.AlkyonSeen.all())||[]; }catch(e){ return []; } }
  function vis(){ var v=C&&C.lsGet?C.lsGet(KEY,true):true; return v!==false; }
  function draw(){
    var map=C&&C.map&&C.map(), L=window.L; if(!map||!L) return;
    var a=seen().filter(function(x){ return x.lat!=null&&x.lon!=null; }), s2=a.length+'|'+vis();
    if(s2===sig) return; sig=s2;
    if(grp){ grp.remove(); grp=null; }
    if(!vis()||!a.length) return;
    grp=L.layerGroup();
    var ic=L.divIcon({className:'ndseenm',html:'<span>👁</span>',iconSize:[26,26],iconAnchor:[13,13]});
    a.forEach(function(x){ var d=new Date(x.u); L.marker([x.lat,x.lon],{icon:ic,keyboard:false}).bindPopup(T('Είδα ψάρι','Fish seen')+' · '+d.toLocaleDateString(EN?'en-GB':'el-GR')+' '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)).addTo(grp); });
    grp.addTo(map);
  }
  function toggle(){
    var row=document.querySelector('.ndtogs'); if(!row||row.querySelector('[data-k="'+KEY+'"]')) return;
    if(!seen().length&&prof()!=='spear') return;
    var b=document.createElement('button'); b.type='button'; b.className='ndtog'; b.dataset.k=KEY; b.innerHTML='<i></i><span></span>'; b.lastChild.textContent=T('Είδα','Seen');
    function sync(){ b.setAttribute('aria-pressed',String(vis())); } sync();
    b.addEventListener('click',function(){ C.lsSet(KEY,!vis()); sync(); sig=''; draw(); }); row.appendChild(b);
  }

  /* ---------- Ορατότητα νερού από τον καιρό των 2 τελευταίων ημερών ---------- */
  var VK='alkyon-vis48', vbusy=false;
  function vget(){ try{ return JSON.parse(ls(VK)||'null'); }catch(e){ return null; } }
  window.ndVis=function(){
    var c=C&&C.getCond&&C.getCond(); if(!c||c.lat==null) return null;
    var v=vget(), key=(+c.lat).toFixed(2)+','+(+c.lon).toFixed(2);
    if(v&&v.key===key&&Date.now()-v.t<3*3600000) return v;
    if(!vbusy&&navigator.onLine!==false){ vbusy=true; fetchVis(+c.lat,+c.lon,key).then(function(){ vbusy=false; },function(){ vbusy=false; }); }
    return v&&v.key===key&&Date.now()-v.t<24*3600000?v:null;
  };
  function avg(a){ a=a.filter(function(x){ return x!=null; }); return a.length?a.reduce(function(s,x){ return s+x; },0)/a.length:null; }
  function fetchVis(lat,lon,key){
    var q='latitude='+lat.toFixed(3)+'&longitude='+lon.toFixed(3)+'&past_days=2&forecast_days=1&timezone=auto';
    return Promise.all([
      fetch('https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=wave_height').then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }),
      fetch('https://api.open-meteo.com/v1/forecast?'+q+'&hourly=wind_speed_10m').then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; })
    ]).then(function(rr){
      var now=Date.now(), w=rr[0]&&rr[0].hourly, f=rr[1]&&rr[1].hourly, off=((rr[0]||rr[1]||{}).utc_offset_seconds||0)*1000;
      function past(h,k){ if(!h||!h.time) return []; return h.time.map(function(t,i){ var ms=Date.parse(t+'Z')-off; return (ms<=now&&ms>=now-48*3600000)?h[k][i]:null; }); }
      var wv=past(w,'wave_height'), wn=past(f,'wind_speed_10m');
      var wvp=wv.filter(function(x){ return x!=null; }), wAvg=avg(wvp), wMax24=wvp.length?Math.max.apply(null,wvp.slice(-24)):null, kmh=avg(wn);
      if(wAvg==null&&kmh==null) return;
      /* ενδεικτική κλίμακα (δική μου εκτίμηση, όχι μέτρηση): μέσο κύμα 48 ωρών, μέγιστο κύμα 24 ωρών και μέσος άνεμος */
      var sc=(wAvg||0)*1.6+(wMax24||0)*0.8+(kmh||0)/30;
      var lab=sc<0.9?T('Καλή','Good'):sc<1.8?T('Μέτρια','Fair'):T('Κακή','Poor');
      try{ localStorage.setItem(VK,JSON.stringify({key:key,t:Date.now(),lab:lab,sc:Math.round(sc*100)/100})); }catch(e){}
    });
  }

  /* ---------- Ψαροντούφεκο: «Είσαι εντάξει;» αν μείνεις κάτω από το νερό πολύ ώρα ---------- */
  var WK='alkyon-divewatch', ov=null, cd=null;
  function wOn(){ return ls(WK)==='1'; }
  function card(){
    var pc=$('pContacts'); if(!pc||$('ndDiveW')) return;
    var d=document.createElement('div'); d.id='ndDiveW'; d.className='nddivew';
    d.innerHTML='<label class="chk"><input type="checkbox"><span><b></b><span class="note" style="display:block"></span></span></label>';
    d.querySelector('b').textContent=T('Ψαροντούφεκο: «Είσαι εντάξει;» αν δεν ανέβεις','Spearfishing: “Are you OK?” if you do not surface');
    d.querySelector('.note').textContent=T('Αν το χρονόμετρο κατάδυσης περάσει το όριο κατά 30 δευτ., το κινητό δονείται και ρωτά «Είσαι εντάξει;». Αν δεν απαντήσεις σε 30 δευτ., στέλνει SOS στην επαφή ασφαλείας. Δουλεύει μόνο όσο η εφαρμογή είναι ανοιχτή και η οθόνη αναμμένη, και μόνο αν πατάς «Κατάδυση/Επιφάνεια». Δεν αντικαθιστά τον συνοδό.','If the dive timer passes the limit by 30 s, the phone vibrates and asks “Are you OK?”. If you do not answer within 30 s, it sends an SOS to your safety contact. Works only while the app is open with the screen on, and only if you use Dive/Surfaced. It does not replace a buddy.');
    var i=d.querySelector('input'); i.checked=wOn(); i.addEventListener('change',function(){ try{ localStorage.setItem(WK,i.checked?'1':'0'); }catch(e){} });
    pc.appendChild(d);
  }
  function closeAsk(){ if(cd){ clearInterval(cd); cd=null; } if(ov){ ov.remove(); ov=null; } }
  function ask(){
    if(ov) return; var left=30;
    ov=document.createElement('div'); ov.className='ndruok'; ov.setAttribute('role','alertdialog'); ov.setAttribute('aria-modal','true');
    ov.innerHTML='<div class="ndruc"><h2></h2><p></p><button type="button" class="ndruy"></button><button type="button" class="ndrun"></button></div>';
    ov.querySelector('h2').textContent=T('Είσαι εντάξει;','Are you OK?');
    var p=ov.querySelector('p'); function txt(){ p.textContent=T('SOS στην επαφή ασφαλείας σε ','SOS to your safety contact in ')+left+T(' δευτ.',' s'); } txt();
    var y=ov.querySelector('.ndruy'); y.textContent=T('Είμαι καλά','I am OK');
    y.addEventListener('click',function(){ var D=window.AlkyonDive; if(D&&D.on){ var b=$('ndDb'); if(b) b.click(); } closeAsk(); });
    var n=ov.querySelector('.ndrun'); n.textContent=T('Στείλε SOS τώρα','Send SOS now'); n.addEventListener('click',function(){ closeAsk(); fire(); });
    document.body.appendChild(ov);
    try{ navigator.vibrate&&navigator.vibrate([600,200,600,200,600]); }catch(e){}
    cd=setInterval(function(){ left--; txt(); if(left%5===0){ try{ navigator.vibrate&&navigator.vibrate([500,150,500]); }catch(e){} } if(left<=0){ closeAsk(); fire(); } },1000);
  }
  function fire(){ try{ if(window.AlkyonTrip&&window.AlkyonTrip.sosNow) window.AlkyonTrip.sosNow(); else if(window.AlkyonTrip) window.AlkyonTrip.sos(); }catch(e){} }
  var asked=0;
  /* εδώ setInterval και όχι ndEvery: πρέπει να μετράει και όταν η οθόνη μόλις έσβησε (όσο το επιτρέπει το κινητό) */
  setInterval(function(){
    var D=window.AlkyonDive; if(!wOn()||prof()!=='spear'||!D||!D.on||!document.body.classList.contains('ontrip')){ asked=0; if(ov&&!(D&&D.on)) closeAsk(); return; }
    var s=(Date.now()-D.t0)/1000, lim=D.lim||90;
    if(s>=lim+30&&asked!==D.t0){ asked=D.t0; ask(); }
  },1000);

  /* ---------- Καθάρισμα: η παλιά σελίδα στατιστικών του Profile δεν ξαναζωγραφίζεται όσο φαίνεται η λίστα ---------- */
  function cleanup(){ var pm=$('pMain'); if(pm&&document.body.classList.contains('ndphon')) pm.hidden=true; }

  var n=0, iv=setInterval(function(){ n++; try{ toggle(); card(); }catch(e){} if(n>60) clearInterval(iv); },1000);
  window.ndEvery(function(){ try{ draw(); toggle(); card(); cleanup(); }catch(e){} },3000);
  setTimeout(draw,2500);
})();

/* v31z374 · Ψαροντούφεκο: όταν ανοίγει η φόρμα, το «Catch & release» και τα «πολλά μαζί» μένουν πάντα κλειστά */
(function(){
  var sh=document.getElementById('sheet'); if(!sh) return;
  function fix(){ var sp=false; try{ sp=localStorage.getItem('alkyon-fprof')==='spear'; }catch(e){} if(sh.hidden) return;
    /* v31z375: παλιό ψάρι από καλάμι που ανοίγει για αλλαγή: η φόρμα μένει όπως ήταν (δόλωμα, catch & release, τεχνική) */
    var rec=window.AlkyonEditRec, spForm=sp&&(!rec||rec.prof==='spear'); document.body.classList.toggle('ndspform',spForm);
    var tc0=document.getElementById('bTech'); if(rec&&rec.tech&&tc0&&tc0.value!==rec.tech){ var o=document.createElement('option'); o.value=rec.tech; o.textContent=rec.tech; tc0.appendChild(o); tc0.value=rec.tech; }
    if(!spForm) return;
    if(!rec) ['bRel','bMulti'].forEach(function(id){ var c=document.getElementById(id); if(c&&c.checked){ c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); } });
    var t=document.getElementById('bTitle'); if(t&&/τσίμπημα|bite/i.test(t.textContent)) t.textContent=window.LANG==='en'?'New fish':'Νέο ψάρι';
    var tc=document.getElementById('bTech'); if(tc&&!tc.value&&tc.options.length) tc.selectedIndex=0; }
  new MutationObserver(function(){ setTimeout(fix,50); }).observe(sh,{attributes:true,attributeFilter:['hidden']});
})();

/* ===================== v31z375 · Ψαροντούφεκο σε όλη την εφαρμογή ===================== */
(function(){
  var EN=window.LANG==='en';
  function prof(){ try{ return localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){ return 'boat'; } }
  function fam(p){ return p==='spear'?'spear':p==='lake'?'lake':'rod'; }
  /* 1. Η προσωπική πρόγνωση, ο σύμβουλος και ο έλεγχος του βαθμού μαθαίνουν χωριστά για ψαροντούφεκο και για καλάμι.
        Καταγραφές χωρίς τύπο (παλιές) μετράνε ως καλάμι. */
  function patch(){
    var PP=window.PP; if(!PP||PP._ndFam) return !!PP; PP._ndFam=true;
    function flt(list){ var f=fam(prof()); return (list||[]).filter(function(x){ return fam(x&&x.prof)===f; }); }
    function wrap(fn){ return function(trips,bites,opt){ var o=Object.assign({},opt||{}); if(o.misses) o.misses=flt(o.misses); return fn.call(PP,flt(trips),flt(bites),o); }; }
    if(PP.build) PP.build=wrap(PP.build); if(PP.calib) PP.calib=wrap(PP.calib);
    return true;
  }
  var n=0, iv=setInterval(function(){ n++; if(patch()||n>40) clearInterval(iv); },300); patch();
  window.addEventListener('alkyon-fprof',function(){ try{ window.dispatchEvent(new Event('alkyon-range')); }catch(e){} });

  /* 2. Λέξεις στο ψαροντούφεκο: «ψάρια» αντί για «τσιμπήματα», «χαμένες βολές» αντί για «χάθηκαν», «στο νερό» αντί για «στη θάλασσα» */
  var EL=[[/Τσιμπήματα εκείνης της ημέρας/g,'Ψάρια εκείνης της ημέρας'],[/Τσίμπησαν και χάθηκαν/g,'Χαμένες βολές'],[/Ώρες που τσίμπησε/g,'Ώρες που έπιασες'],
    [/τσιμπήματα ανά ώρα/g,'ψάρια ανά ώρα'],[/Τσιμπήματα/g,'Ψάρια'],[/τσιμπήματα/g,'ψάρια'],[/Τσίμπημα/g,'Ψάρι'],[/τσίμπημα/g,'ψάρι'],
    [/(\d+) χαμένα(?![α-ωά-ώ])/g,'$1 χαμένες βολές'],[/χάθηκαν/g,'χαμένες βολές'],[/Ώρες στη θάλασσα/g,'Ώρες στο νερό'],[/ώρες στη θάλασσα/g,'ώρες στο νερό']];
  var ENL=[[/Bites that day/g,'Fish that day'],[/Bites lost/g,'Missed shots'],[/\bbites\b/g,'fish'],[/\bBites\b/g,'Fish'],[/\bbite\b/g,'fish'],[/(\d+) miss\b/g,'$1 missed shots'],[/Hours at sea/g,'Hours in water']];
  function words(){
    if(prof()!=='spear') return; var R=EN?ENL:EL;
    ['tab-log','profile','fcMine','ndIns'].forEach(function(id){ var root=document.getElementById(id); if(!root||root.hidden||!root.offsetParent&&id!=='profile') return; if(id==='profile'&&root.hidden) return;
      var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(t){ var p=t.parentNode; if(!p) return 2; var tg=p.tagName; if(tg==='SCRIPT'||tg==='STYLE'||tg==='TEXTAREA'||tg==='OPTION'||p.isContentEditable) return 2; return /[Ττ]σίμπ|[Ττ]σιμπ|χαμένα|χάθηκαν|στη θάλασσα|[Bb]ite|miss\b|at sea/.test(t.nodeValue)?1:2; }}), t, list=[];
      while((t=w.nextNode())) list.push(t);
      list.forEach(function(t){ var v=t.nodeValue; R.forEach(function(r){ v=v.replace(r[0],r[1]); }); if(v!==t.nodeValue) t.nodeValue=v; });
    });
  }
  window.ndEvery(words,1500);

  /* 3. Στατιστικά: στο ψαροντούφεκο τα κουτιά λένε «χαμένες βολές», «ψάρια / ώρα στο νερό» και δείχνουν μόνο εξόδους με ψαροντούφεκο */
  function kpiWords(){
    var box=document.getElementById('ndIns'); if(!box) return; var sp=prof()==='spear';
    var t=box.querySelector('.ndkind'); if(!t){ t=document.createElement('div'); t.className='ndisep ndkind'; box.insertBefore(t,box.firstChild); }
    var pf=prof(), lab=sp?(EN?'Spearfishing':'Ψαροντούφεκο'):pf==='lake'?(EN?'Dam / lake':'Φράγμα / λίμνη'):(EN?'Sea, rod and line':'Θάλασσα, καλάμι'); if(t.textContent!==lab) t.textContent=lab;
  }
  window.ndEvery(kpiWords,1500);
})();

/* v31z376 · «Σήμερα»: μία τοποθεσία. Φαίνεται μόνο η επιλεγμένη («📍 Η θέση μου ▾»)· με πάτημα ανοίγουν οι υπόλοιπες και η αναζήτηση. */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
  var open=false, last='';
  function cur(w){ var c=w.querySelector('.chip[aria-pressed=true]'); return c?(c.textContent||'').trim():T('Η θέση μου','My location'); }
  function tick(){
    if(window.ndFC2) return;
    var w=document.getElementById('tdLoc'); if(!w||!w.offsetParent&&!w.classList.contains('ndlocc')) return;
    var b=document.getElementById('ndLocBtn');
    if(!b){ b=document.createElement('button'); b.type='button'; b.id='ndLocBtn'; b.className='ndlocb';
      /* v31z378: εικονίδιο SVG και ξεχωριστό κείμενο, ώστε να μην αναβοσβήνει (πριν το 📍 άλλαζε συνέχεια από άλλο κομμάτι της εφαρμογής) */
      b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0113 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg><span></span><i aria-hidden="true"></i>';
      b.addEventListener('click',function(){ open=!open; paint(); if(open){ var i=w.querySelector('input'); if(i) setTimeout(function(){ try{ i.focus({preventScroll:true}); }catch(e){} },50); } });
      w.parentNode.insertBefore(b,w); }
    var c=cur(w); if(last&&c!==last) open=false; last=c;
    paint();
    function paint(){ w.classList.toggle('ndlocc',!open); b.setAttribute('aria-expanded',String(open)); var sp=b.querySelector('span'), ar=b.querySelector('i'), t=cur(w), a2=open?'▴':'▾'; if(sp&&sp.textContent!==t) sp.textContent=t; if(ar&&ar.textContent!==a2) ar.textContent=a2; }
    /* σύντομη γραμμή ενημέρωσης: «Ενημερώθηκε 11:34» αντί για τις συντεταγμένες δύο φορές */
    var ls0=document.getElementById('liveSub'), ns=document.getElementById('ndLiveSub');
    if(ls0){ if(!ns){ ns=document.createElement('div'); ns.id='ndLiveSub'; ns.className='note'; ls0.after(ns); }
      var v=ls0.textContent||'', m, out=v;
      if((m=/^(Ενημερώθηκε|Updated)\s+([^·]+?)\s*·/.exec(v))) out=m[1]+' '+m[2].trim();
      else if((m=/^(Καιρός για|Weather for) .*? · (\d{1,2}:\d{2})/.exec(v))) out=(EN?'Updated ':'Ενημερώθηκε ')+m[2];
      if(ns.textContent!==out) ns.textContent=out; }
  }
  window.ndEvery(tick,700); setTimeout(tick,800);
  document.addEventListener('click',function(e){ if(e.target&&e.target.closest&&e.target.closest('#tdLoc .chip')){ open=false; setTimeout(tick,120); } },true);
})();

/* v31z379 · Πρόγνωση: καθαρή κεφαλίδα με εικονίδια (ραντάρ, ειδοποιήσεις, ανανέωση) και η καρτέλα «Πρόγνωση» ανοίγει πάντα στο «Σήμερα» */
(function(){
  var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, C=window.AlkyonCore;
  var $=function(i){ return document.getElementById(i); };
  var SV=function(d){ return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'; };
  var IC={radar:SV('<path d="M7 16a4 4 0 01-.5-7.97A5.5 5.5 0 0117 9a3.5 3.5 0 01.5 7"/><path d="M9 19l1-2M13 20l1-2M11 22l.5-1"/>'),
    bell:SV('<path d="M6 17v-6a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>'),bellOff:SV('<path d="M6 17v-6a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/><path d="M3 3l18 18"/>'),
    ref:SV('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>')};
  function ibtn(id,lab){ var b=document.createElement('button'); b.type='button'; b.id=id; b.className='ndib'; b.setAttribute('aria-label',lab); b.title=lab; return b; }
  function bar(){
    var head=$('fcHead'); if(!head||!head.offsetParent) return;
    var w=$('ndFcBar');
    if(!w){ w=document.createElement('div'); w.id='ndFcBar'; w.className='ndfcbar';
      w.innerHTML='<div class="ndfct"><b></b><span></span></div><div class="ndfca"></div>';
      w.querySelector('b').textContent=T('Επόμενες 7 μέρες','Next 7 days');
      var a=w.querySelector('.ndfca');
      var r=document.createElement('a'); r.id='ndFcRadar'; r.className='ndib'; r.target='_blank'; r.rel='noopener'; r.innerHTML=IC.radar; r.setAttribute('aria-label',T('Ραντάρ βροχής (Windy)','Rain radar (Windy)')); r.title=r.getAttribute('aria-label'); a.appendChild(r);
      var bl=ibtn('ndFcBell',T('Ειδοποιήσεις για αυτή την τοποθεσία','Alerts for this location')); bl.addEventListener('click',function(){ var x=$('fcWatch'); if(x) x.click(); setTimeout(bar,80); }); a.appendChild(bl);
      var rf=ibtn('ndFcRef',T('Ανανέωση','Refresh')); rf.innerHTML=IC.ref; rf.addEventListener('click',function(){ var x=$('fcRefresh'); if(x) x.click(); rf.classList.add('spin'); setTimeout(function(){ rf.classList.remove('spin'); },900); }); a.appendChild(rf);
      head.insertBefore(w,head.firstChild); }
    var rd=$('fcRadar'), r2=$('ndFcRadar'); if(rd&&r2){ r2.hidden=!!rd.hidden||!rd.href; if(rd.href&&r2.href!==rd.href) r2.href=rd.href; }
    var wt=$('fcWatch'), b2=$('ndFcBell'); if(wt&&b2){ b2.hidden=!!wt.hidden; var on=wt.getAttribute('aria-pressed')==='true'; if(b2.dataset.on!==String(on)){ b2.dataset.on=String(on); b2.innerHTML=on?IC.bell:IC.bellOff; } b2.setAttribute('aria-pressed',String(on)); b2.title=on?T('Ειδοποιήσεις: ενεργές','Alerts: on'):T('Ειδοποιήσεις: ανενεργές','Alerts: off'); b2.setAttribute('aria-label',b2.title); }
    var sb=$('fcSub'), sp=w.querySelector('.ndfct span'), m=sb&&/(\d{1,2}:\d{2}(?:\s?[πμ]\.?μ\.?|\s?[AP]M)?)/i.exec(sb.textContent||''), t=m?T('Ενημερώθηκε ','Updated ')+m[1]:''; if(sp.textContent!==t) sp.textContent=t;
    /* βεβαιότητα ως τελεία + κείμενο */
    var cf=document.querySelector('#fcBest .fcbconf'); if(cf){ var lv=/υψηλή|high/i.test(cf.textContent)?2:/μέτρια|medium/i.test(cf.textContent)?1:0; cf.dataset.c=lv; }
  }
  window.ndEvery(bar,1500); setTimeout(bar,600); document.addEventListener('click',function(){ setTimeout(bar,120); },true);
  /* η καρτέλα «Πρόγνωση» ανοίγει πάντα στο «Σήμερα» */
  function hook(){ var nb=document.querySelector('nav.tabs button[data-tab=fc]'); if(!nb||nb.dataset.ndToday) return !!nb; nb.dataset.ndToday='1';
    nb.addEventListener('click',function(){ var td=$('tab-today'), fc=$('tab-fc'); if(td&&fc&&td.hidden&&fc.hidden){ try{ C.lsSet('alkyon-wxsub','today'); }catch(e){ try{ localStorage.setItem('alkyon-wxsub','"today"'); }catch(x){} } } },true); return true; }
  var n=0, iv=setInterval(function(){ n++; if(hook()||n>40) clearInterval(iv); },500);
  try{ C.lsSet('alkyon-wxsub','today'); }catch(e){}
})();

/* v31z415: μεγάλος τίτλος σελίδας στην κορυφή (Πρόγνωση, Ημερολόγιο), όπως στο Προφίλ, αντί για το «BITECAST» */
(function(){
  var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
  var NAMES={today:T('Πρόγνωση','Forecast'),fc:T('Πρόγνωση','Forecast'),log:T('Ημερολόγιο','Logbook')};
  function cur(){ var ks=['today','fc','log','guide','map']; for(var i=0;i<ks.length;i++){ var t=document.getElementById('tab-'+ks[i]); if(t&&!t.hidden) return ks[i]; } return ''; }
  function upd(){
    var br=document.querySelector('header.top .brand'); if(!br) return;
    var sp=br.querySelector('.ndbt');
    if(!sp){ [].slice.call(br.childNodes).forEach(function(n){ if(n.nodeType===3&&n.nodeValue.trim()) n.remove(); }); sp=document.createElement('span'); sp.className='ndbt'; br.appendChild(sp); }
    var k=cur(), t=NAMES[k]||'Alkyon';
    if(sp.textContent!==t) sp.textContent=t;
    br.classList.toggle('ndbig',!!NAMES[k]);
    document.body.classList.toggle('ndlogt',k==='log');
  }
  document.addEventListener('click',function(){ setTimeout(upd,30); setTimeout(upd,400); },true);
  window.addEventListener('popstate',function(){ setTimeout(upd,60); });
  upd(); setTimeout(upd,1500); window.ndEvery(upd,4000);
})();

/* v31z415: ένδειξη «Χωρίς σύνδεση» (στη θάλασσα συμβαίνει συχνά) */
(function(){
  var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; }, bar=null, hideT=0;
  function mk(){ if(bar) return bar; bar=document.createElement('div'); bar.id='ndOff'; bar.setAttribute('role','status'); bar.hidden=true;
    bar.innerHTML='<i aria-hidden="true"></i><span></span><button type="button" aria-label="'+T('Κλείσιμο','Close')+'">✕</button>';
    bar.querySelector('button').addEventListener('click',function(){ bar.hidden=true; });
    document.body.appendChild(bar); return bar; }
  function show(on){
    var b=mk(); clearTimeout(hideT); b.classList.toggle('ok',!on);
    b.querySelector('span').textContent=on?T('Χωρίς σύνδεση. Ό,τι καταγράφεις μένει στο κινητό και συγχρονίζεται όταν επανέλθει το σήμα.','Offline. Everything you log stays on the phone and syncs when the signal returns.')
      :T('Ξανά σε σύνδεση.','Back online.');
    b.hidden=false; if(!on) hideT=setTimeout(function(){ b.hidden=true; },2500);
  }
  window.addEventListener('offline',function(){ show(true); });
  window.addEventListener('online',function(){ if(bar&&!bar.hidden) show(false); });
  if(navigator.onLine===false) setTimeout(function(){ show(true); },1500);
})();

/* v31z415: συντομεύσεις από το εικονίδιο της εφαρμογής (παρατεταμένο πάτημα): ?a=bite | trip | fc */
(function(){
  var a='', qs=null; try{ qs=new URLSearchParams(location.search); a=qs.get('a')||''; }catch(e){}
  if(!a) return;
  try{ history.replaceState(null,'',location.pathname+location.hash); }catch(e){}
  var n=0, iv=setInterval(function(){ n++;
    var ready=document.getElementById('fab')&&document.querySelector('nav.tabs [data-tab=fc]')&&!document.documentElement.classList.contains('gated');
    if(!ready){ if(n>40) clearInterval(iv); return; }
    clearInterval(iv);
    setTimeout(function(){
      if(a==='fc'){ var f=document.querySelector('nav.tabs [data-tab=fc]'); if(f) f.click(); }
      else if(a==='trip'){ var t=document.getElementById('tripBtn'); if(t&&!document.body.classList.contains('ontrip')) t.click(); }
      else if(a==='bite'){ var b=document.getElementById('fab'); if(b) b.click(); }
      else if(a==='log'){ var lg=document.querySelector('nav.tabs [data-tab=log]'); if(lg) lg.click(); }
      else if(a==='map'){ var mp=document.querySelector('nav.tabs [data-tab=map]'); if(mp) mp.click(); if(qs&&qs.get('lat')) setTimeout(function(){ try{ var M=window.AlkyonCore.map(); if(M) M.flyTo([+qs.get('lat'),+qs.get('lon')],14); }catch(e){} },600); }
      else if(a==='alerts'){ if(window.AlkyonProfGo) window.AlkyonProfGo('alerts'); }
      else if(a==='p'&&qs&&qs.get('k')){ if(window.AlkyonProfGo) window.AlkyonProfGo(qs.get('k')); }
      else if(a==='prof'){ var np=document.getElementById('navProf')||document.getElementById('profBtn'); if(np) np.click(); }
    },700);
  },300);
})();
