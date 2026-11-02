/* Κάτω δεξιά του χάρτη: μεγάλο «Start Fishing» και, μέσα σε έξοδο, Catch / Miss / Παύση. Επίσης κάρτα συνθηκών πάνω στον χάρτη. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C||!document.getElementById('dock')) return;
var $=C.$, h=C.h, EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var box=document.querySelector('.mapbox');
function st(){ return (window.AlkyonTrip&&window.AlkyonTrip.state)?window.AlkyonTrip.state():{}; }
function hm(ms){ var d=new Date(ms+C.utcMin()*60000); return ('0'+d.getUTCHours()).slice(-2)+':'+('0'+d.getUTCMinutes()).slice(-2); }
function gearNow(){ return (C.lsGet('alkyon-gear-now','')||'').trim(); }
function clock(ms){ var t=Math.floor(ms/1000), hh=Math.floor(t/3600), mm=Math.floor(t%3600/60), ss=t%60; return ('0'+hh).slice(-2)+':'+('0'+mm).slice(-2)+':'+('0'+ss).slice(-2); }
function topSpecies(){
  var m={}, bs=C.Store.get('bites')||[];
  bs.forEach(function(b){ var n=(b.species||'').trim(); if(!n) return; var o=m[n]||(m[n]={n:n,c:0,last:0,la:''}); o.c++; var t=(b.date||'')+' '+(b.time||''); if(t>=o.last){ o.last=t; } if(b.latin) o.la=b.latin; });
  return Object.keys(m).map(function(k){ return m[k]; }).sort(function(a,b){ return b.c-a.c||(a.last<b.last?1:-1); }).slice(0,3);
}
function short(n){ return n.split(' / ')[0].split(' (')[0].slice(0,14); }
var spKey='';
function drawSp(){
  var box=$('dkSp'), list=topSpecies(), key=list.map(function(x){ return x.n; }).join('|');
  box.hidden=!list.length; if(key===spKey) return; spKey=key; box.replaceChildren();
  list.forEach(function(x){
    var b=h('button',{type:'button',text:short(x.n),title:x.n}), t=null, held=false;
    b.addEventListener('pointerdown',function(){ held=false; clearTimeout(t); t=setTimeout(function(){ held=true; buzz(); var v=prompt(x.n+' — '+T('βάρος σε kg (άφησε κενό για χωρίς βάρος):','weight in kg (leave empty for none):'),''); if(v===null) return; var kg=parseFloat(String(v).replace(',','.')); C.quick({species:x.n,latin:x.la,kg:kg>0&&kg<1000?kg:0}); },650); });
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ b.addEventListener(ev,function(){ clearTimeout(t); }); });
    b.addEventListener('contextmenu',function(e){ e.preventDefault(); });
    b.addEventListener('click',function(){ if(held){ held=false; return; } buzz(); C.quick({species:x.n,latin:x.la}); });
    box.append(b);
  });
}
function tick(){
  var s=st(); if(!s.active) return;
  var ms=window.AlkyonTrip.effMs(s), c=clock(ms);
  $('dkClock').textContent=c; if(!$('lockOv').hidden) $('lkClock').textContent=c;
}
function info(){
  var s=st(); if(!s.active) return;
  var c=window.AlkyonTrip.counts(), k=window.AlkyonTrack?window.AlkyonTrack.km():0, g=window.AlkyonTrack&&window.AlkyonTrack.enabled();
  $('dkInfo').textContent=(s.pausedAt?'⏸ ':'')+(c.kg?c.kg+' kg · ':'')+(g?k.toFixed(2)+' km · ':'')+T('επιστροφή ','back ')+hm(s.due)+(gearNow()?' · '+gearNow().slice(0,22):'');
  $('dkGps').setAttribute('aria-pressed',String(!!g));
  if(!$('lockOv').hidden) lockStats(c,k,g);
}
function upd(){
  var s=st(), on=!!s.active, dk=$('dock');
  document.body.classList.toggle('live',on);
  $('dkStart').hidden=on; $('dkLive').hidden=!on; dk.classList.toggle('paused',on&&!!s.pausedAt);
  if(on){
    var c=window.AlkyonTrip.counts();
    $('dkN').textContent=c.n; $('dkM').textContent=c.miss;
    $('dkPause').textContent=s.pausedAt?'▶':'⏸';
    drawSp(); info(); tick();
  } else if(!$('lockOv').hidden) unlock();
  if(box) box.style.setProperty('--dockh',dk.offsetHeight+'px');
}
function buzz(){ try{ if(navigator.vibrate) navigator.vibrate(25); }catch(e){} }
$('dkStart').addEventListener('click',function(){ buzz(); $('tripBtn').click(); });
$('dkMiss').addEventListener('click',function(){ buzz(); C.quickMiss(); });
$('dkPause').addEventListener('click',function(){ buzz(); if(window.AlkyonTrip) window.AlkyonTrip.toggle(); });
var cb=$('dkCatch'), lp=null, held=false;
cb.addEventListener('pointerdown',function(){ held=false; clearTimeout(lp); lp=setTimeout(function(){ held=true; buzz(); $('fab').click(); },650); });
['pointerup','pointerleave','pointercancel'].forEach(function(ev){ cb.addEventListener(ev,function(){ clearTimeout(lp); }); });
cb.addEventListener('contextmenu',function(e){ e.preventDefault(); });
cb.addEventListener('click',function(){ if(held){ held=false; return; } buzz(); C.quick(); });
$('dkGps').addEventListener('click',function(){ if(!window.AlkyonTrack) return; buzz(); window.AlkyonTrack.setEnabled(!window.AlkyonTrack.enabled()); });
$('dkGps').title=T('Διαδρομή GPS και χιλιόμετρα','GPS route and distance'); $('dkLock').title=T('Κλείδωμα οθόνης','Lock screen');
/* ---------- κλείδωμα οθόνης ---------- */
function lockStats(c,k,g){
  var st2=$('lkStats'); st2.replaceChildren();
  [[c.n,'🐟 Catch'],[c.miss,'✕ Miss']].concat(g?[[k.toFixed(2),'km']]:[]).forEach(function(x){ st2.append(h('div',{},h('b',{text:String(x[0])}),h('span',{text:x[1]}))); });
}
function lock(){ var ov=$('lockOv'); ov.hidden=false; $('lkTxt').textContent=T('Κράτα 1″ για ξεκλείδωμα','Hold 1 s to unlock'); upd(); tick(); try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').then(function(l){ wl=l; }).catch(function(){}); }catch(e){} }
var wl=null;
function unlock(){ $('lockOv').hidden=true; $('lkHold').classList.remove('go'); try{ if(wl){ wl.release(); wl=null; } }catch(e){} }
$('dkLock').addEventListener('click',function(){ buzz(); lock(); });
var ut=null, hb=$('lkHold');
function holdStart(e){ e.preventDefault(); clearTimeout(ut); hb.classList.remove('go'); void hb.offsetWidth; hb.classList.add('go'); ut=setTimeout(function(){ buzz(); unlock(); },1000); }
function holdEnd(){ clearTimeout(ut); hb.classList.remove('go'); }
hb.addEventListener('pointerdown',holdStart);
['pointerup','pointerleave','pointercancel'].forEach(function(ev){ hb.addEventListener(ev,holdEnd); });
hb.addEventListener('contextmenu',function(e){ e.preventDefault(); });
$('lockOv').addEventListener('touchmove',function(e){ e.preventDefault(); },{passive:false});
$('dkCatch').querySelector('small').textContent=T('κράτα = είδος','hold = species');
$('dkStart').textContent=T('▶ Start Fishing','▶ Start Fishing');
window.addEventListener('alkyon-sess',upd);
C.Store.on('bites',upd);
setInterval(upd,30000);
setInterval(function(){ if(!document.hidden) tick(); },1000);
window.addEventListener('alkyon-track',function(){ info(); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden) upd(); });

/* ---------- κάρτα συνθηκών πάνω στον χάρτη ---------- */
var wx=$('mapWx'), open=true;
try{ open=localStorage.getItem('alkyon-mapwx')!=='0'; }catch(e){}
var TR={fast:'↓↓',slow:'↓',stable:'→',rise:'↑'};
function cell(ic,v,l){ return h('div',{class:'mw'},h('i',{text:ic}),h('b',{text:v}),h('span',{text:l})); }
function drawWx(){
  var c=C.getCond(); if(!wx) return;
  if(!c){ wx.hidden=true; return; }
  wx.hidden=false; wx.replaceChildren(); wx.classList.toggle('min',!open);
  var moon=document.getElementById('moonSvg'), mh=h('div',{class:'mwm'});
  if(moon&&moon.childNodes.length){ var cl=moon.cloneNode(true); cl.removeAttribute('id'); cl.setAttribute('width','40'); cl.setAttribute('height','40'); mh.append(cl); }
  var dash='–', dirs=['N','NE','E','SE','S','SW','W','NW'];
  var wd=c.windDeg!=null?dirs[Math.round((((c.windDeg%360)+360)%360)/45)%8]:'';
  var items=[
    cell('☁',c.press!=null?c.press+'':dash,'hPa '+(TR[c.ptrend]||'')),
    cell('🌡',c.temp!=null?Math.round(c.temp)+'°':dash,T('αέρας','air')),
    cell('➤',c.wind!=null?c.wind+'':dash,'kn '+wd),
    cell('〰',c.wave!=null?c.wave.toFixed(1):dash,T('κύμα m','wave m'))
  ];
  wx.append(h('div',{class:'mwg'},items));
}
wx.addEventListener('click',function(){ open=!open; try{ localStorage.setItem('alkyon-mapwx',open?'1':'0'); }catch(e){} drawWx(); });
document.addEventListener('alkyon-cond',function(){ setTimeout(drawWx,50); });
setTimeout(drawWx,900); setTimeout(drawWx,3500);
upd();
})();
