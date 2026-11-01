/* BiteCast 4 · «Πού ψαρεύεις σήμερα;» στο άνοιγμα (όπως η κλασική startpick.js, ίδια κλειδιά: psaro-fprof, psaro-fside, psaro-askfp).
   Δύο βήματα: Ακτή ή Σκάφος, μετά με τι ψαρεύεις. Δεν εμφανίζεται κατά την έξοδο ή αν διάλεξες «Να μη ρωτάει κάθε φορά». */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, ls=B.ls;
function raw(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function put(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
var SIDE={shore:{n:T('Ακτή','Shore'),d:T('Ακτή, μόλος, βράχια, φράγμα','Beach, pier, rocks, dam'),i:'🏖️'},boat:{n:T('Σκάφος','Boat'),d:T('Θάλασσα, κύμα, MOB και SOS','Sea, waves, MOB and SOS'),i:'🚤'}};
var METH={shore:[{p:'shore',n:T('Θάλασσα με καλάμι','Sea, with a rod'),d:T('Ακτή, μόλος, βράχια','Beach, pier, rocks'),i:'🎣'},{p:'spear',n:T('Θάλασσα με ψαροντούφεκο','Sea, spearfishing'),d:T('Βουτιά από την ακτή · σημαδούρα','Dive from the shore · float'),i:'🤿'},{p:'lake',n:T('Φράγμα ή λίμνη','Dam or lake'),d:T('Γλυκό νερό, χωρίς κύμα','Fresh water, no waves'),i:'🏞️'}],
  boat:[{p:'boat',n:T('Καλάμι','Rod'),d:T('Βυθός, τρόλινγκ, jigging…','Bottom, trolling, jigging…'),i:'🎣'},{p:'spear',n:T('Ψαροντούφεκο από σκάφος','Spearfishing from a boat'),d:T('Βουτιά από τη βάρκα · σημαδούρα','Dive from the boat · float'),i:'🤿'}]};
function cur(){ return B.prof(); }
function side(){ var p=cur(), s=raw('psaro-fside'); if(p==='boat') return 'boat'; if(p==='shore'||p==='lake') return 'shore'; return s==='boat'?'boat':'shore'; }
function label(p,s){ return s==='boat'?(p==='boat'?T('Σκάφος, καλάμι','Boat, rod'):T('Σκάφος, ψαροντούφεκο','Boat, spearfishing')):(p==='lake'?T('Φράγμα ή λίμνη','Dam or lake'):p==='spear'?T('Ακτή, ψαροντούφεκο','Shore, spearfishing'):T('Ακτή, καλάμι','Shore, rod')); }
B.fishSide=side;
B.startPick=function(){
  var st={s:side(),p:cur()}, body=h('div',{class:'stpick'}), sides=h('div',{class:'stgrid'}), meths=h('div',{class:'stlist'}), sh;
  var ask=h('input',{type:'checkbox',checked:raw('psaro-askfp')==='0'}), go=h('button',{class:'btn pri full',type:'button'});
  function paint(){ sides.replaceChildren(); ['shore','boat'].forEach(function(k){ var x=SIDE[k]; sides.append(h('button',{type:'button',class:'stopt','aria-pressed':String(st.s===k),onclick:function(){ st.s=k; if(!METH[k].some(function(m){ return m.p===st.p; })) st.p=METH[k][0].p; paint(); }},h('span',{class:'sti',text:x.i}),h('b',{text:x.n}),h('small',{text:x.d}))); });
    meths.replaceChildren(); METH[st.s].forEach(function(m){ meths.append(h('button',{type:'button',class:'li stm','aria-pressed':String(st.p===m.p),onclick:function(){ st.p=m.p; paint(); }},h('span',{class:'sti',text:m.i}),h('span',{class:'tx'},h('b',{text:m.n}),h('small',{text:m.d})))); });
    go.textContent=T('Συνέχεια · ','Continue · ')+label(st.p,st.s); }
  go.addEventListener('click',function(){ put('psaro-fside',st.s); put('psaro-fprof',st.p); put('psaro-fprof-done','1'); put('psaro-askfp',ask.checked?'0':'1'); B.emit('store','psaro-fprof'); sh.close(); });
  paint();
  body.append(sides,h('h3',{class:'h3',text:T('Με τι ψαρεύεις;','How are you fishing?')}),meths,h('label',{class:'tg'},ask,h('span',{text:T('Να μη ρωτάει κάθε φορά','Don’t ask every time')})),go,h('p',{class:'foot',text:T('Αλλαγή αργότερα: Προφίλ › Τύπος ψαρέματος','Change later: Profile › Fishing type')}));
  sh=B.sheet({title:T('Πού ψαρεύεις σήμερα;','Where are you fishing today?'),body:body});
};
function wanted(){ if(!raw('psaro-onboard')) return false; if(raw('psaro-askfp')==='0'&&raw('psaro-fprof-done')) return false; var s=ls.get('psaro-safe',null); if(s&&s.active) return false; if(/#(new|trip)/.test(location.hash)) return false; return true; }
/* ---------- καλωσόρισμα πρώτου ανοίγματος (όπως η κλασική: psaro-onboard). Δεν εμφανίζεται αν υπάρχουν ήδη δεδομένα. ---------- */
function hasData(){ try{ return ['bites','trips','spots','tackle'].some(function(k){ return B.store.raw(k).length>0; }); }catch(e){ return false; } }
B.tour=function(){
  var st={s:side(),p:cur()}, step=0, ov, prev=document.activeElement;
  var STEPS=[{ic:'fish',t:T('Καλώς ήρθες στο BiteCast','Welcome to BiteCast'),b:T('Πρόγνωση, χάρτης και ημερολόγιο για ψάρεμα στην Κύπρο. Τέσσερα γρήγορα βήματα για να ξεκινήσεις.','Forecast, map and logbook for fishing in Cyprus. Four quick steps to get started.')},
    {ic:'user',pick:true,t:T('Πού ψαρεύεις συνήθως;','Where do you usually fish?'),b:T('Προσαρμόζει τις τεχνικές, τον εξοπλισμό και τα κουμπιά ασφαλείας. Το αλλάζεις όποτε θες στο Προφίλ.','It adapts techniques, tackle and safety buttons. Change it any time in Profile.')},
    {ic:'forecast',t:T('Δες τη θάλασσα πριν φύγεις','Check the sea before you leave'),b:T('Η Πρόγνωση δείχνει βαθμό 0–100, τις καλύτερες ώρες, άνεμο, κύμα και πίεση για το μέρος που διαλέγεις. Στον χάρτη βλέπεις κύμα, άνεμο, ρεύματα και βάθη.','Forecast shows a 0–100 score, the best hours, wind, waves and pressure for the place you choose. The map shows waves, wind, currents and depths.')},
    {ic:'log',t:T('Κατέγραψε κάθε έξοδο','Log every outing'),b:T('Ξεκίνα έξοδο από τον χάρτη και κατέγραψε ψάρια με ένα άγγιγμα. Αν ορίσεις επαφή ασφαλείας, ειδοποιείται αυτόματα αν δεν γυρίσεις στην ώρα σου.','Start a trip from the map and log catches with one tap. If you set a safety contact, they are alerted automatically if you are not back on time.'),last:true}];
  function finish(){ put('psaro-onboard','1'); try{ var sm=ls.get('psaro-smart',{})||{}; if(!sm.weekly){ sm.weekly=Date.now(); ls.set('psaro-smart',sm); B.emit('store','psaro-smart'); } }catch(e){} if(!raw('psaro-fprof-done')){ put('psaro-fside',st.s); put('psaro-fprof',st.p); put('psaro-fprof-done','1'); B.emit('store','psaro-fprof'); } ov.remove(); document.removeEventListener('keydown',key); try{ prev&&prev.focus&&prev.focus(); }catch(e){} }
  function key(e){ if(e.key==='Escape') finish(); }
  function paint(){ var x=STEPS[step], c=ov.querySelector('.obc'); c.replaceChildren();
    c.append(h('div',{class:'obic',html:B.iconSvg(x.ic)}),h('h2',{text:x.t}),h('p',{text:x.b}));
    if(x.pick){ var g=h('div',{class:'stgrid'}); ['shore','boat'].forEach(function(k){ var o=SIDE[k]; g.append(h('button',{type:'button',class:'stopt','aria-pressed':String(st.s===k),onclick:function(){ st.s=k; if(!METH[k].some(function(m){ return m.p===st.p; })) st.p=METH[k][0].p; paint(); }},h('span',{class:'sti',text:o.i}),h('b',{text:o.n}),h('small',{text:o.d}))); });
      var l=h('div',{class:'stlist'}); METH[st.s].forEach(function(m){ l.append(h('button',{type:'button',class:'li stm','aria-pressed':String(st.p===m.p),onclick:function(){ st.p=m.p; paint(); }},h('span',{class:'sti',text:m.i}),h('span',{class:'tx'},h('b',{text:m.n}),h('small',{text:m.d})))); });
      c.append(g,l); }
    var dots=h('div',{class:'obd','aria-hidden':'true'}); STEPS.forEach(function(_,i){ dots.append(h('i',{class:i===step?'on':null})); }); c.append(dots);
    c.append(h('button',{class:'btn pri full',type:'button',text:x.last?T('Ξεκινάμε','Get started'):T('Επόμενο','Next'),onclick:function(){ if(x.pick){ put('psaro-fside',st.s); put('psaro-fprof',st.p); put('psaro-fprof-done','1'); B.emit('store','psaro-fprof'); } if(x.last) finish(); else { step++; paint(); } }}));
    if(x.last) c.append(h('button',{class:'btn full',type:'button',text:T('Ορισμός επαφής ασφαλείας','Set a safety contact'),onclick:function(){ finish(); location.hash='#profile'; setTimeout(function(){ var cards=[].slice.call(document.querySelectorAll('section.card')).filter(function(c){ return /Επαφή ασφαλείας|Safety contact/.test(c.textContent); }); if(cards[0]) cards[0].scrollIntoView({block:'start',behavior:'smooth'}); },500); }}));
    else c.append(h('button',{class:'obskip',type:'button',text:T('Παράλειψη','Skip'),onclick:finish})); }
  ov=h('div',{class:'onb',role:'dialog','aria-modal':'true','aria-label':T('Καλωσόρισμα','Welcome')},h('div',{class:'obc'}));
  document.body.append(ov); document.addEventListener('keydown',key); paint();
};
setTimeout(function(){ if(!raw('psaro-onboard')){ if(hasData()) put('psaro-onboard','1'); else if(!document.querySelector('.onb')) { B.tour(); return; } } if(wanted()) B.startPick(); },700);
})();
