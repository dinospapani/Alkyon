/* BiteCast 4 · «Πού ψαρεύεις σήμερα;»: ολόκληρη σελίδα που ανοίγει πρώτη (όπως η κλασική startpick.js, ίδια κλειδιά: psaro-fprof, psaro-fside, psaro-askfp).
   Ακτή ή Σκάφος (κάρτες με φωτογραφία), μετά με τι ψαρεύεις. Δεν εμφανίζεται κατά την έξοδο ή αν διάλεξες «Να μη ρωτάει κάθε φορά».
   Νέος χρήστης (χωρίς psaro-onboard και χωρίς δεδομένα): πρώτα το καλωσόρισμα, με την ίδια επιλογή μέσα. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, ls=B.ls;
function raw(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function put(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
var SIDE={shore:{n:T('Ακτή','Shore'),d:T('Παραλία · Μόλος · Βράχια · Φράγμα','Beach · Pier · Rocks · Dam'),img:'bc-card-shore.jpg'},
  boat:{n:T('Σκάφος','Offshore'),d:T('Θάλασσα · Κύμα · MOB · SOS','Open sea · Waves · MOB · SOS'),img:'bc-card-boat.jpg'}};
/* εικονίδια γραμμής (ίδιο στυλ με την υπόλοιπη εφαρμογή) */
var IC={rod:'<path d="M4 20L18.5 5.5"/><path d="M18.5 5.5c1.2-1.2 2.5-.4 2.5 1v5"/><circle cx="7.5" cy="16.5" r="2.2"/><path d="M21 11.5v2.5a1.5 1.5 0 0 1-3 0"/>',
  spear:'<path d="M2 14h13"/><path d="M15 12.5h3l4 1.5-4 1.5h-3z"/><path d="M5 14v3.5M8 14v2"/><path d="M2 11.5l2.5 2.5L2 16.5"/>',
  lake:'<path d="M3 18c2 0 2-1.4 4.5-1.4S9.5 18 12 18s2.5-1.4 4.5-1.4S19 18 21 18"/><path d="M4 14l4.5-6 3 4 2.5-3 6 5"/>',
  shore:'<path d="M3 17c2.2 0 2.2-1.5 4.5-1.5S9.8 17 12 17s2.2-1.5 4.5-1.5S19 17 21 17"/><path d="M5 13l5-8"/><path d="M10 5l8 4"/>',
  boat:'<path d="M3 15h18l-2.5 4.5h-13z"/><path d="M7 15V9h7l3 6"/><path d="M10 9V5"/>'};
function svg(k){ return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(IC[k]||'')+'</svg>'; }
var METH={shore:[{p:'shore',n:T('Καλάμι από την ακτή','Rod from the shore'),d:T('Βυθός · Spinning · Surfcasting','Bottom · Spinning · Surfcasting'),i:'rod',th:'bc-th-shorerod.jpg'},{p:'spear',n:T('Ψαροντούφεκο από την ακτή','Spearfishing from the shore'),d:T('Βουτιά · Σημαδούρα · Ασφάλεια','Dive · Float · Safety'),i:'spear',th:'bc-th-spear.jpg'},{p:'lake',n:T('Φράγμα ή λίμνη','Dam or lake'),d:T('Γλυκό νερό · Χωρίς κύμα','Fresh water · No waves'),i:'lake',th:'bc-th-lake.jpg'}],
  boat:[{p:'boat',n:T('Καλάμι','Rod'),d:T('Βυθός · Τρόλινγκ · Jigging · Casting','Bottom · Trolling · Jigging · Casting'),i:'rod',th:'bc-th-boatrod.jpg'},{p:'spear',n:T('Ψαροντούφεκο από σκάφος','Spearfishing from a boat'),d:T('Βουτιά · Ψαροντούφεκο · Σημαδούρα','Dive · Speargun · Float · Safety'),i:'spear',th:'bc-th-spear.jpg'}]};
function cur(){ return B.prof(); }
function side(){ var p=cur(), s=raw('psaro-fside'); if(p==='boat') return 'boat'; if(p==='shore'||p==='lake') return 'shore'; return s==='boat'?'boat':'shore'; }
function label(p,s){ return s==='boat'?(p==='boat'?T('Σκάφος, καλάμι','Offshore, rod'):T('Σκάφος, ψαροντούφεκο','Offshore, spearfishing')):(p==='lake'?T('Φράγμα ή λίμνη','Dam or lake'):p==='spear'?T('Ακτή, ψαροντούφεκο','Shore, spearfishing'):T('Ακτή, καλάμι','Shore, rod')); }
B.fishSide=side;
var CHK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', CHEV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/* η επιλογή (κάρτες + τρόποι): χρησιμοποιείται στη σελίδα και στο καλωσόρισμα */
function picker(st,onChange){
  var box=h('div',{class:'spk'});
  function paint(){ box.replaceChildren();
    var g=h('div',{class:'spcards',role:'radiogroup','aria-label':T('Περιβάλλον','Environment')});
    ['shore','boat'].forEach(function(k){ var x=SIDE[k], on=st.s===k;
      g.append(h('button',{type:'button',class:'spcard'+(on?' on':''),role:'radio','aria-checked':String(on),onclick:function(){ st.s=k; if(!METH[k].some(function(m){ return m.p===st.p; })) st.p=METH[k][0].p; paint(); onChange&&onChange(); }},
        h('span',{class:'spimg',style:{backgroundImage:'url('+x.img+')'}}),h('span',{class:'spshade'}),on?h('span',{class:'spchk',html:CHK}):null,
        h('span',{class:'spcap'},h('span',{class:'spic',html:svg(k)}),h('b',{text:x.n}),h('small',{text:x.d})))); });
    var l=h('div',{class:'spmeth',role:'radiogroup','aria-label':T('Με τι ψαρεύεις','How you fish')});
    METH[st.s].forEach(function(m){ var on=st.p===m.p;
      l.append(h('button',{type:'button',class:'sprow'+(on?' on':''),role:'radio','aria-checked':String(on),onclick:function(){ st.p=m.p; paint(); onChange&&onChange(); }},
        (m.th?h('span',{class:'spmi sph',style:{backgroundImage:'url('+m.th+')'}}):h('span',{class:'spmi',html:svg(m.i)})),h('span',{class:'tx'},h('b',{text:m.n}),h('small',{text:m.d})),h('span',{class:'sprad',html:on?CHK:''}))); });
    box.append(g,h('h3',{class:'sph3',text:T('Με τι ψαρεύεις;','How are you fishing?')}),l); }
  paint(); return box;
}
function brand(){ return h('div',{class:'spbrand'},h('img',{src:'../icon-192.png',alt:'',width:'44',height:'44'}),h('span',null,h('b',{text:'BiteCast'}),h('small',{text:T('ΨΑΡΕΜΑ ΣΤΗΝ ΚΥΠΡΟ','FISHING IN CYPRUS')}))); }
function cover(on){ document.documentElement.classList.toggle('pre-pick',!!on); document.documentElement.classList.toggle('pg-open',!!on); }

B.startPick=function(){
  if(document.querySelector('.sppage')) return;
  var st={s:side(),p:cur()}, prev=document.activeElement;
  var ask=h('input',{type:'checkbox',checked:raw('psaro-askfp')==='0'}), go=h('button',{class:'spgo',type:'button'});
  function lab(){ go.replaceChildren(h('span',{text:T('Συνέχεια · ','Continue · ')+label(st.p,st.s)}),h('i',{html:CHEV})); }
  function close(){ pg.classList.add('out'); cover(false); document.removeEventListener('keydown',key); setTimeout(function(){ pg.remove(); },260); try{ prev&&prev.focus&&prev.focus(); }catch(e){} }
  function key(e){ if(e.key==='Escape') close(); }
  go.addEventListener('click',function(){ put('psaro-fside',st.s); put('psaro-fprof',st.p); put('psaro-fprof-done','1'); put('psaro-askfp',ask.checked?'0':'1'); B.emit('store','psaro-fprof'); close(); });
  var pg=h('div',{class:'sppage',role:'dialog','aria-modal':'true','aria-label':T('Πού ψαρεύεις σήμερα;','Where are you fishing today?')},
    h('div',{class:'sphero',style:{backgroundImage:'url(bc-hero-boat.jpg)'}},h('span',{class:'spheroshade'}),
      h('button',{class:'spskip',type:'button',text:T('Αργότερα','Later'),onclick:close}),brand(),
      h('div',{class:'sptitle'},h('h1',{text:T('Πού ψαρεύεις σήμερα;','Where are you fishing today?')}),h('p',{text:T('Διάλεξε περιβάλλον και τρόπο ψαρέματος','Choose your setting and how you fish')}))),
    h('div',{class:'spbody'},picker(st,lab),
      h('label',{class:'spask'},ask,h('span',{class:'spbox',html:CHK}),h('span',{text:T('Να μη ρωτάει κάθε φορά','Don’t ask every time')})),
      go,h('p',{class:'spfoot',text:T('Αλλαγή αργότερα: Προφίλ › Τύπος ψαρέματος','Change later: Profile › Fishing type')})));
  lab(); cover(true); document.body.append(pg); document.addEventListener('keydown',key);
};
function wanted(){ if(!raw('psaro-onboard')) return false; if(raw('psaro-askfp')==='0'&&raw('psaro-fprof-done')) return false; var s=ls.get('psaro-safe',null); if(s&&s.active) return false; if(/#(new|trip|addfriend)/.test(location.hash)) return false; return true; }

/* ---------- καλωσόρισμα πρώτου ανοίγματος (όπως η κλασική: psaro-onboard). Δεν εμφανίζεται αν υπάρχουν ήδη δεδομένα. ---------- */
function hasData(){ try{ return ['bites','trips','spots','tackle'].some(function(k){ return B.store.raw(k).length>0; }); }catch(e){ return false; } }
B.tour=function(){
  if(document.querySelector('.sppage')) return;
  var st={s:side(),p:cur()}, step=0, pg, prev=document.activeElement;
  var STEPS=[{img:'bc-hero-boat.jpg',t:T('Καλώς ήρθες στο BiteCast','Welcome to BiteCast'),b:T('Πρόγνωση, χάρτης και ημερολόγιο για ψάρεμα στην Κύπρο. Τέσσερα γρήγορα βήματα για να ξεκινήσεις.','Forecast, map and logbook for fishing in Cyprus. Four quick steps to get started.')},
    {img:'bc-hero-boat.jpg',pick:true,t:T('Πού ψαρεύεις συνήθως;','Where do you usually fish?'),b:T('Προσαρμόζει τεχνικές, εξοπλισμό και κουμπιά ασφαλείας. Το αλλάζεις όποτε θες στο Προφίλ.','It adapts techniques, tackle and safety buttons. Change it any time in Profile.')},
    {img:'bc-card-boat.jpg',t:T('Δες τη θάλασσα πριν φύγεις','Check the sea before you leave'),b:T('Η Πρόγνωση δείχνει βαθμό 0–100, τις καλύτερες ώρες, άνεμο, κύμα και πίεση για το μέρος που διαλέγεις. Στον χάρτη βλέπεις κύμα, άνεμο, ρεύματα και βάθη.','Forecast shows a 0–100 score, the best hours, wind, waves and pressure for the place you choose. The map shows waves, wind, currents and depths.')},
    {img:'bc-hero-spear.jpg',t:T('Κατέγραψε κάθε έξοδο','Log every outing'),b:T('Ξεκίνα έξοδο από τον χάρτη και κατέγραψε ψάρια με ένα άγγιγμα. Αν ορίσεις επαφή ασφαλείας, ειδοποιείται αυτόματα αν δεν γυρίσεις στην ώρα σου.','Start a trip from the map and log catches with one tap. If you set a safety contact, they are alerted automatically if you are not back on time.'),last:true}];
  function save(){ put('psaro-fside',st.s); put('psaro-fprof',st.p); put('psaro-fprof-done','1'); B.emit('store','psaro-fprof'); }
  function finish(){ put('psaro-onboard','1'); try{ var sm=ls.get('psaro-smart',{})||{}; if(!sm.weekly){ sm.weekly=Date.now(); ls.set('psaro-smart',sm); B.emit('store','psaro-smart'); } }catch(e){} if(!raw('psaro-fprof-done')) save();
    pg.classList.add('out'); cover(false); setTimeout(function(){ pg.remove(); },260); document.removeEventListener('keydown',key); try{ prev&&prev.focus&&prev.focus(); }catch(e){} }
  function key(e){ if(e.key==='Escape') finish(); }
  function paint(){ var x=STEPS[step]; pg.replaceChildren();
    var dots=h('div',{class:'obd','aria-hidden':'true'}); STEPS.forEach(function(_,i){ dots.append(h('i',{class:i===step?'on':null})); });
    var hero=h('div',{class:'sphero'+(x.pick?'':' tall'),style:{backgroundImage:'url('+x.img+')'}},h('span',{class:'spheroshade'}),x.last?null:h('button',{class:'spskip',type:'button',text:T('Παράλειψη','Skip'),onclick:finish}),brand(),
      h('div',{class:'sptitle'},h('h1',{text:x.t}),h('p',{text:x.b})));
    var body=h('div',{class:'spbody'}); if(x.pick) body.append(picker(st,null));
    body.append(dots,h('button',{class:'spgo',type:'button',onclick:function(){ if(x.pick) save(); if(x.last) finish(); else { step++; paint(); pg.scrollTop=0; } }},h('span',{text:x.last?T('Ξεκινάμε','Get started'):T('Επόμενο','Next')}),h('i',{html:CHEV})));
    if(x.last) body.append(h('button',{class:'spsec',type:'button',text:T('Ορισμός επαφής ασφαλείας','Set a safety contact'),onclick:function(){ finish(); location.hash='#profile'; setTimeout(function(){ var c=[].slice.call(document.querySelectorAll('section.card')).filter(function(n){ return /Επαφή ασφαλείας|Safety contact/.test(n.textContent); }); if(c[0]) c[0].scrollIntoView({block:'start',behavior:'smooth'}); },500); }}));
    pg.append(hero,body); }
  pg=h('div',{class:'sppage tour',role:'dialog','aria-modal':'true','aria-label':T('Καλωσόρισμα','Welcome')}); cover(true); document.body.append(pg); document.addEventListener('keydown',key); paint();
};

/* ανοίγει αμέσως, πριν φανεί η εφαρμογή από πίσω (η κλάση pre-pick μπαίνει ήδη από το index.html) */
(function(){ var go=null;
  if(!raw('psaro-onboard')){ if(hasData()) put('psaro-onboard','1'); else go=B.tour; }
  if(!go&&wanted()) go=B.startPick;
  if(go) go(); else cover(false);
})();
/* v31z531: στο κινητό η εφαρμογή συνήθως «ξυπνά» από το παρασκήνιο χωρίς να ξαναφορτώσει, οπότε η ερώτηση δεν έβγαινε.
   Τώρα βγαίνει και όταν επιστρέφεις μετά από 3+ ώρες ή σε νέα μέρα (εκτός αν είναι επιλεγμένο «Να μη ρωτάει κάθε φορά»). */
(function(){ var away=0;
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){ away=Date.now(); return; }
    if(!away) return; var was=away; away=0;
    var newDay=new Date(was).toDateString()!==new Date().toDateString();
    if(!(newDay||Date.now()-was>=3*3600e3)||!wanted()) return;
    if(document.querySelector('.sppage,.sheet')) return; var a=document.activeElement; if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    B.startPick();
  });
})();
})();
