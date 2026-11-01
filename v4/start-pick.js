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
setTimeout(function(){ if(wanted()) B.startPick(); },700);
})();
