/* Alkyon 4 · κέλυφος: καρτέλες, πλοήγηση με #, κάτω μπάρα. Κάθε σελίδα δηλώνεται με AK.view(όνομα,{mount,unmount,resume}). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T;
var VIEWS={}, cur=null, main=null;
B.view=function(name,def){ VIEWS[name]=def; };
/* v31z550: φόρτωση κατά απαίτηση για σπάνια κομμάτια (γρηγορότερο άνοιγμα). Τα αρχεία είναι στο cache του service worker, οπότε δουλεύουν και χωρίς σήμα. */
var LZ={};
/* 1.5.2: τα αρχεία κατεβαίνουν όλα μαζί (παράλληλα) και εκτελούνται με τη σειρά τους (async=false). Πριν κατέβαινε το ένα μετά το άλλο:
   με αδύναμο σήμα κάθε αρχείο περίμενε το προηγούμενο. */
B.loadScripts=function(files){ return Promise.all(files.map(function(f){ if(LZ[f]) return LZ[f]; LZ[f]=new Promise(function(res,rej){ var s=document.createElement('script'); s.async=false; s.src=f; s.onload=function(){ res(); }; s.onerror=function(){ delete LZ[f]; s.remove(); rej(new Error('load '+f)); }; document.head.appendChild(s); }); return LZ[f]; })).then(function(){}); };
B.lazyView=function(name,title,files){ if(VIEWS[name]) return; var stub={title:title,mount:function(el){ el.append(h('div',{class:'card empty lzload'},h('p',{class:'sub',text:T('Φόρτωση…','Loading…')})));
    B.loadScripts(files).then(function(){ if(cur!==name||VIEWS[name]===stub) return; el.replaceChildren(); VIEWS[name].mount(el); document.title=(VIEWS[name].title||'Alkyon')+' · Alkyon'; })
    .catch(function(){ if(cur!==name) return; el.replaceChildren(h('div',{class:'card empty'},h('p',{text:T('Δεν φορτώθηκε. Έλεγξε τη σύνδεση και ξαναδοκίμασε.','Could not load. Check your connection and try again.')}),h('button',{class:'btn',type:'button',text:T('Ξανά','Retry'),onclick:function(){ el.replaceChildren(); stub.mount(el); }}))); }); }};
  VIEWS[name]=stub; };
B.lazyView('guide',T('Οδηγός','Guide'),['guide-core.js','guide-view.js']);
/* σύγκριση χρονιών: κάρτα που φορτώνει το years.js όταν φανεί */
if(!B.yearsCard) B.yearsCard=function(){ var box=h('div',{class:'lzyears'}); B.loadScripts(['years.js']).then(function(){ if(B.yearsCard&&!B.yearsCard._stub&&box.isConnected) box.replaceWith(B.yearsCard()); }).catch(function(){}); return box; }; B.yearsCard._stub=1;
/* εισαγωγή από plotter/ρολόι: φορτώνει το import-view.js όταν το ζητήσεις */
if(!B.importSheet) B.importSheet=function(){ var a=arguments; B.loadScripts(['import-view.js']).then(function(){ if(!B.importSheet._stub) B.importSheet.apply(null,a); }).catch(function(){ B.toast(T('Δεν φορτώθηκε. Έλεγξε τη σύνδεση.','Could not load. Check your connection.')); }); }; B.importSheet._stub=1;

var TABS=[['forecast',T('Πρόγνωση','Forecast'),'forecast'],['map',T('Χάρτης','Map'),'map'],null,['log',T('Ημερολόγιο','Logbook'),'log'],['profile',T('Προφίλ','Profile'),'user']];
function nav(){
  var bar=h('div'); TABS.forEach(function(t){
    if(!t){ /* v31z525: το κεντρικό κουμπί ξεκινά έξοδο (με το εικονίδιο του τύπου σου)· κατά την έξοδο γίνεται «+» για νέο ψάρι.
               Παρατεταμένο πάτημα: νέο ψάρι χωρίς έξοδο ή καταγραφή με φωνή. */
      var lp=null, lpDone=false, fab=h('button',{class:'fab',type:'button',onclick:function(ev){ if(lpDone){ lpDone=false; ev.preventDefault(); return; }
        if(onTrip()){ if(B.biteForm) B.biteForm(); } else if(B.tripStart){ if((location.hash||'')!=='#map') location.hash='#map'; setTimeout(function(){ B.tripStart(); },location.hash==='#map'?0:350); } }});
      function onTrip(){ return !!(B.trip&&B.trip.active&&B.trip.active()); }
      function paint(){ var tr=onTrip(); fab.classList.toggle('fabtrip',!tr); fab.innerHTML=tr?B.iconSvg('plus'):(B.profIcon?B.profIcon(B.prof()):B.iconSvg('plus'));
        fab.setAttribute('aria-label',tr?T('Νέο ψάρι. Κράτα πατημένο για φωνή.','New catch. Long-press for voice.'):T('Έναρξη εξόδου. Κράτα πατημένο για νέο ψάρι ή φωνή.','Start a trip. Long-press for a new catch or voice.')); }
      paint(); B.on('trip',function(){ setTimeout(paint,50); }); B.on('store',function(k){ if(k==='alkyon-fprof') paint(); }); window.addEventListener('focus',paint);
      function menu(){ var body=h('div',{class:'fabmenu'},
          h('button',{type:'button',class:'li',onclick:function(){ B.closeSheet(); if(B.biteForm) B.biteForm(); }},h('span',{class:'ic',html:B.iconSvg('plus')}),h('span',{class:'tx'},h('b',{text:T('Νέο ψάρι','New catch')}),h('small',{text:T('Καταγραφή χωρίς έξοδο (ή για παλιό ψάρι)','Log without a trip (or a past catch)')}))),
          B.voice&&B.voice.ok?h('button',{type:'button',class:'li',onclick:function(){ B.closeSheet(); B.voice.log(); }},h('span',{class:'ic',html:B.voice.MIC}),h('span',{class:'tx'},h('b',{text:T('Πες το','Say it')}),h('small',{text:T('«λαβράκι δύο κιλά»','“sea bass two kilos”')}))):null,
          !onTrip()&&B.tripStart?h('button',{type:'button',class:'li',onclick:function(){ B.closeSheet(); fab.click(); }},h('span',{class:'ic',html:B.profIcon?B.profIcon(B.prof()):''}),h('span',{class:'tx'},h('b',{text:T('Έναρξη εξόδου','Start a trip')}))):null);
        B.sheet({title:T('Γρήγορες ενέργειες','Quick actions'),body:body}); }
      fab.addEventListener('pointerdown',function(){ lpDone=false; clearTimeout(lp); lp=setTimeout(function(){ lpDone=true; try{ navigator.vibrate&&navigator.vibrate(30); }catch(e){} if(onTrip()&&B.voice&&B.voice.ok) B.voice.log(); else menu(); },550); });
      ['pointerup','pointerleave','pointercancel'].forEach(function(n){ fab.addEventListener(n,function(){ clearTimeout(lp); }); });
      fab.addEventListener('contextmenu',function(ev){ ev.preventDefault(); });
      bar.append(fab); return; }
    var a=h('a',{href:'#'+t[0],data:{v:t[0]}}); a.innerHTML=B.iconSvg(t[2]); a.append(h('span',{text:t[1]})); bar.append(a); });
  return h('nav',{class:'nav','aria-label':T('Κύρια πλοήγηση','Main navigation')},bar);
}
function route(){
  var name=(location.hash||'').slice(1)||'forecast';
  /* συντομεύσεις: #new = νέο ψάρι, #trip = έναρξη εξόδου */
  if(name==='new'||name==='trip'){ var act=name; history.replaceState(null,'',location.pathname+(act==='new'?'#log':'#map')); name=act==='new'?'log':'map'; setTimeout(function(){ if(act==='new'&&B.biteForm) B.biteForm(); else if(B.tripStart) B.tripStart(); },500); }
  if(/^share=/.test(name)) name='map';
  /* v31z537: σύνδεσμος πρόσκλησης φίλου (#addfriend=ΚΩΔΙΚΟΣ): κρατά τον κωδικό και ανοίγει τους Φίλους με τον κωδικό συμπληρωμένο */
  if(/^addfriend=/.test(name)){ var fcd=decodeURIComponent(name.slice(10)).replace(/[^A-Za-z0-9]/g,'').toUpperCase(); try{ if(fcd.length>=6) localStorage.setItem('alk-friend-code',JSON.stringify({c:fcd,t:Date.now()})); }catch(e){} history.replaceState(null,'',location.pathname+'#friends'); name='friends'; }
  if(!VIEWS[name]) name='forecast';
  [].forEach.call(document.querySelectorAll('.nav a[data-v]'),function(a){ if(a.dataset.v===name) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  if(cur===name) return;
  if(B.closeSheet) B.closeSheet();
  if(cur&&VIEWS[cur].unmount) VIEWS[cur].unmount();
  cur=name; main.replaceChildren(); window.scrollTo(0,0);
  VIEWS[name].mount(main);
  document.title=(VIEWS[name].title||'Alkyon')+' · Alkyon';
}
B.remount=function(){ if(!cur||!main) return; if(VIEWS[cur].unmount) VIEWS[cur].unmount(); cur=null; route(); };
function start(){
  main=h('main',{class:'app',id:'main'});
  document.body.append(main,nav());
  /* v31z520: στα αγγλικά, ό,τι έμεινε ελληνικό (ονόματα ειδών, τεχνικές, δολώματα, συμβουλές της γνώσης) μεταφράζεται με το λεξικό της κλασικής */
  if(window.LANG==='en'&&window.AlkyonTrWatch){ window.ALKYON_TRBODY=true; try{ AlkyonTrWatch(document.body); }catch(e){} }
  /* στα αγγλικά: και η πλήρης λίστα ειδών Κύπρου (cy100), ώστε να μεταφράζονται και ονόματα όπως «Στήρα», «Πίγγα» */
  if(window.LANG==='en'&&!window.CY100) setTimeout(function(){ var sc=document.createElement('script'); sc.src='../cy100.js'; sc.onload=function(){ try{ var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT), n, G=/[\u0370-\u03FF]/; while((n=w.nextNode())){ if(G.test(n.nodeValue)&&window.AlkyonTr){ var v=window.spName?window.spName(n.nodeValue):n.nodeValue; if(v!==n.nodeValue) n.nodeValue=v; } } }catch(e){} }; document.head.appendChild(sc); },1500);
  window.addEventListener('hashchange',route);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&cur&&VIEWS[cur].resume) VIEWS[cur].resume(); });
  route();
  if('serviceWorker' in navigator) autoUpdate();
}
/* v31z530: η νέα έκδοση μπαίνει μόνη της. Έλεγχος όταν επιστρέφεις στην εφαρμογή και κάθε 30′· μόλις ο νέος service worker πάρει τον έλεγχο,
   ανανέωση της σελίδας, εκτός αν είναι ανοιχτό παράθυρο ή γράφεις κάτι: τότε μήνυμα με κουμπί «Ανανέωση» (για να μη χαθεί ό,τι έγραφες). */
function autoUpdate(){ var SW=navigator.serviceWorker, had=!!SW.controller, done=false, lastChk=0;
  function busy(){ var a=document.activeElement; return !!document.querySelector('.sheet.on')||!!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  function reload(){ if(done) return; done=true; try{ sessionStorage.setItem('alk-updated','1'); }catch(e){} location.reload(); }
  SW.addEventListener('controllerchange',function(){ if(!had){ had=true; return; } if(busy()){ B.toast(T('Νέα έκδοση της εφαρμογής.','New app version.'),12000,{label:T('Ανανέωση','Refresh'),fn:reload}); var w=setInterval(function(){ if(!busy()){ clearInterval(w); reload(); } },4000); } else reload(); });
  SW.register('sw.js',{scope:'./'}).then(function(reg){
    function chk(){ if(Date.now()-lastChk<60000) return; lastChk=Date.now(); try{ reg.update(); }catch(e){} }
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) chk(); });
    setInterval(function(){ if(!document.hidden) chk(); },30*60000);
  }).catch(function(){});
  try{ if(sessionStorage.getItem('alk-updated')){ sessionStorage.removeItem('alk-updated'); setTimeout(function(){ B.toast(T('Ενημερώθηκε στην ','Updated to ')+(window.ALKYON_VERSION||''),3500); },1200); } }catch(e){} }
B.start=start;
})();
/* «Νέα έκδοση διαθέσιμη» (όπως η κλασική): ελέγχει το ../version.js και ανανεώνει όταν το πατήσεις, ποτέ μέσα σε έξοδο */
(function(){ var B=window.AK, T=B.T, bar=null, dis='';
  function num(v){ var s=/^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(v||''); if(s) return 1e7+(+s[1])*1e4+(+s[2])*100+(+(s[3]||0)); var m=/v(\d+)z(\d+)/.exec(v||''); return m?+m[1]*1000+(+m[2]):0; }
  function show(v){ if(bar||dis===v) return; bar=B.h('div',{class:'updbar',role:'status'},B.h('span',{text:T('Νέα έκδοση διαθέσιμη','A new version is available')}),
      B.h('button',{type:'button',class:'btn sm pri',text:T('Ανανέωση','Update'),onclick:function(){ var go=function(){ location.reload(); };
        try{ navigator.serviceWorker.getRegistration().then(function(r){ return r?r.update():0; }).catch(function(){}).then(go); }catch(e){ go(); } }}),
      B.h('button',{type:'button',class:'x','aria-label':T('Κλείσιμο','Close'),text:'✕',onclick:function(){ dis=v; bar.remove(); bar=null; }}));
    document.body.append(bar); }
  function check(){ if(navigator.onLine===false||!window.ALKYON_VERSION||document.body.classList.contains('ontrip')) return;
    fetch('../version.js?_='+Date.now(),{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; }).then(function(t){ var m=/ALKYON_VERSION\s*=\s*'([^']+)'/.exec(t||''); if(m&&num(m[1])>num(window.ALKYON_VERSION)) show(m[1]); }).catch(function(){}); }
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') check(); });
  setTimeout(check,8000); setInterval(check,15*60000); B.on('tripend',function(){ setTimeout(check,3000); });
})();
