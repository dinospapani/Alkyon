/* BiteCast 4 · κέλυφος: καρτέλες, πλοήγηση με #, κάτω μπάρα. Κάθε σελίδα δηλώνεται με BC.view(όνομα,{mount,unmount,resume}). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T;
var VIEWS={}, cur=null, main=null;
B.view=function(name,def){ VIEWS[name]=def; };

var TABS=[['forecast',T('Πρόγνωση','Forecast'),'forecast'],['map',T('Χάρτης','Map'),'map'],null,['log',T('Ημερολόγιο','Logbook'),'log'],['profile',T('Προφίλ','Profile'),'user']];
function nav(){
  var bar=h('div'); TABS.forEach(function(t){
    if(!t){ bar.append(h('button',{class:'fab',type:'button','aria-label':T('Νέο ψάρι','New catch'),html:B.iconSvg('plus'),onclick:function(){ if(B.biteForm) B.biteForm(); }})); return; }
    var a=h('a',{href:'#'+t[0],data:{v:t[0]}}); a.innerHTML=B.iconSvg(t[2]); a.append(h('span',{text:t[1]})); bar.append(a); });
  return h('nav',{class:'nav','aria-label':T('Κύρια πλοήγηση','Main navigation')},bar);
}
function route(){
  var name=(location.hash||'').slice(1)||'forecast';
  /* συντομεύσεις: #new = νέο ψάρι, #trip = έναρξη εξόδου */
  if(name==='new'||name==='trip'){ var act=name; history.replaceState(null,'',location.pathname+(act==='new'?'#log':'#map')); name=act==='new'?'log':'map'; setTimeout(function(){ if(act==='new'&&B.biteForm) B.biteForm(); else if(B.tripStart) B.tripStart(); },500); }
  if(/^share=/.test(name)) name='map';
  if(!VIEWS[name]) name='forecast';
  [].forEach.call(document.querySelectorAll('.nav a[data-v]'),function(a){ if(a.dataset.v===name) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  if(cur===name) return;
  if(B.closeSheet) B.closeSheet();
  if(cur&&VIEWS[cur].unmount) VIEWS[cur].unmount();
  cur=name; main.replaceChildren(); window.scrollTo(0,0);
  VIEWS[name].mount(main);
  document.title=(VIEWS[name].title||'BiteCast')+' · BiteCast';
}
function start(){
  main=h('main',{class:'app',id:'main'});
  document.body.append(main,nav());
  window.addEventListener('hashchange',route);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&cur&&VIEWS[cur].resume) VIEWS[cur].resume(); });
  route();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(function(){});
}
B.start=start;
})();
/* «Νέα έκδοση διαθέσιμη» (όπως η κλασική): ελέγχει το ../version.js και ανανεώνει όταν το πατήσεις, ποτέ μέσα σε έξοδο */
(function(){ var B=window.BC, T=B.T, bar=null, dis='';
  function num(v){ var m=/z(\d+)/.exec(v||''); return m?+m[1]:0; }
  function show(v){ if(bar||dis===v) return; bar=B.h('div',{class:'updbar',role:'status'},B.h('span',{text:T('Νέα έκδοση διαθέσιμη','A new version is available')}),
      B.h('button',{type:'button',class:'btn sm pri',text:T('Ανανέωση','Update'),onclick:function(){ var go=function(){ location.reload(); };
        try{ navigator.serviceWorker.getRegistration().then(function(r){ return r?r.update():0; }).catch(function(){}).then(go); }catch(e){ go(); } }}),
      B.h('button',{type:'button',class:'x','aria-label':T('Κλείσιμο','Close'),text:'✕',onclick:function(){ dis=v; bar.remove(); bar=null; }}));
    document.body.append(bar); }
  function check(){ if(navigator.onLine===false||!window.PSARO_VERSION||document.body.classList.contains('ontrip')) return;
    fetch('../version.js?_='+Date.now(),{cache:'no-store'}).then(function(r){ return r.ok?r.text():''; }).then(function(t){ var m=/PSARO_VERSION\s*=\s*'([^']+)'/.exec(t||''); if(m&&num(m[1])>num(window.PSARO_VERSION)) show(m[1]); }).catch(function(){}); }
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') check(); });
  setTimeout(check,8000); setInterval(check,15*60000); B.on('tripend',function(){ setTimeout(check,3000); });
})();
