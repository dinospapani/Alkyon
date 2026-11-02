/* Προσανατολισμός χάρτη: NU (βορράς πάνω), CU (πορεία GPS πάνω), HU (πυξίδα κινητού πάνω).
   Γυρίζει μόνο ο χάρτης (#lmap). Τα κουμπιά, τα ζουμ και οι κάρτες μένουν ακίνητα.
   Όσο ο χάρτης είναι γυρισμένος, ένα πάτημα πάνω του τον επιστρέφει προσωρινά σε NU (δεν εκτελεί την ενέργεια του πατήματος). */
(function(){
'use strict';
var C=window.AlkyonCore, lm=document.getElementById('lmap'), box=lm&&lm.parentNode;
if(!C||!lm||!box||document.getElementById('bOrient')) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-orient', MODES=['NU','CU','HU'];
var mode=(function(){ var v=C.lsGet(KEY,'NU'); return MODES.indexOf(v)>=0?v:'NU'; })();
var head=null, comp=null, rot=0, shown=0, paused=0, swallowUntil=0, lastApply=0;
var NAMES={NU:T('Βορράς πάνω','North up'),CU:T('Πορεία πάνω (GPS)','Course up (GPS)'),HU:T('Πυξίδα πάνω (κινητό)','Heading up (phone compass)')};
function getMap(){ try{ return C.map?C.map():null; }catch(e){ return null; } }
function norm(a){ return ((a%360)+360)%360; }
function delta(a,b){ var d=norm(a-b); return d>180?d-360:d; }

/* Τα χειριστήρια του Leaflet (ζουμ, πηγές) βγαίνουν έξω από τον χάρτη που γυρίζει */
var ov=null;
function hoist(){
  if(ov) return; var cc=lm.querySelector('.leaflet-control-container'); if(!cc) return;
  ov=document.createElement('div'); ov.className='leaflet-container leaflet-touch mo-ctl'; ov.style.cssText='position:absolute;left:0;top:0;right:0;bottom:0;background:transparent;pointer-events:none;overflow:visible;z-index:700';
  ov.appendChild(cc); box.insertBefore(ov,lm.nextSibling);
}

/* Μέγεθος: ο γυρισμένος χάρτης είναι τετράγωνο με πλευρά τη διαγώνιο, ώστε να μη φαίνονται γωνίες */
function layout(on){
  var w=box.clientWidth, h=box.clientHeight;
  if(on){ var D=Math.ceil(Math.hypot(w,h))+4; lm.style.inset='auto'; lm.style.width=D+'px'; lm.style.height=D+'px'; lm.style.left=Math.round((w-D)/2)+'px'; lm.style.top=Math.round((h-D)/2)+'px'; lm.style.transformOrigin='50% 50%'; }
  else { lm.style.inset=''; lm.style.width=''; lm.style.height=''; lm.style.left=''; lm.style.top=''; lm.style.transform=''; lm.style.transformOrigin=''; }
  try{ var m=getMap(); if(m) m.invalidateSize({animate:false}); }catch(e){}
}
var isOn=false, saved=null;
function setOn(on){
  if(on===isOn) return; isOn=on; hoist();
  box.classList.toggle('mrot',on); layout(on);
  try{ var m=getMap(); if(m){ if(on){ saved={t:m.options.touchZoom,w:m.options.scrollWheelZoom}; m.options.touchZoom='center'; m.options.scrollWheelZoom='center'; try{ m.dragging.disable(); }catch(e){} } else if(saved){ m.options.touchZoom=saved.t; m.options.scrollWheelZoom=saved.w; try{ m.dragging.enable(); }catch(e){} } } }catch(e){}
  lm.style.transition=on?'transform .35s linear':''; lm.style.touchAction=on?'none':''; if(!on) shown=0;
}
var man=null; /* v31z535: χειροκίνητη περιστροφή με δύο δάχτυλα (μοίρες που δείχνει η πάνω πλευρά), όπως στο Google Maps */
function autoT(){
  if(!document.body.classList.contains('ontrip')) return null; /* εκτός εξόδου δεν γυρίζει αυτόματα */
  if(Date.now()<paused||popHold) return null;
  if(mode==='CU') return head;
  if(mode==='HU') return comp!=null?comp:head;
  return null;
}
function target(){ var a=autoT(); return a!=null?a:man; }
function apply(){
  if(popOpen&&isOn&&mode!=='NU') return; /* όσο είναι ανοιχτό το μενού, ο χάρτης δεν γυρίζει */
  var t=target();
  if(t==null){ if(isOn) setOn(false); lm.style.removeProperty('--mc'); updBtn(); return; }
  if(!isOn){ setOn(true); shown=-t; }
  var want=-t; shown+=delta(want,shown); /* συνεχής γωνία, χωρίς άλματα στο 360° */
  lm.style.transform='rotate('+shown.toFixed(1)+'deg)'; lm.style.setProperty('--mc',(-shown).toFixed(1)+'deg'); updBtn();
}
var btn=document.createElement('button'); btn.type='button'; btn.id='bOrient'; btn.className='mo-btn';
btn.addEventListener('click',function(){ setMode(MODES[(MODES.indexOf(mode)+1)%3],true); });
box.appendChild(btn);
function updBtn(){
  var rt=isOn&&Date.now()>=paused; if(btn.getAttribute('data-m')!==mode){ btn.setAttribute('data-m',mode); btn.innerHTML='<svg class="moi" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="mon" d="M12 4.5l2.6 7.5h-5.2z"/><path d="M12 19.5l-2.6-7.5h5.2z"/></svg><b>'+mode+'</b>'; } btn.setAttribute('aria-label',T('Προσανατολισμός χάρτη: ','Map orientation: ')+NAMES[mode]); btn.title=NAMES[mode];
  btn.classList.toggle('on',mode!=='NU'); btn.classList.toggle('wait',mode!=='NU'&&!rt&&Date.now()>=paused);
  if(typeof updN==='function') try{ updN(); }catch(e){}
}
function setMode(m,user){
  mode=m; C.lsSet(KEY,m); paused=0;
  if(m==='HU') startCompass();
  if(user){ var msg=NAMES[m]; if(m!=='NU'&&target()==null) msg+=' · '+T('περιμένει πορεία ή πυξίδα','waiting for course or compass'); C.toast(msg); }
  apply();
}

/* Πυξίδα κινητού */
var compOn=false;
function onOri(e){
  var h=null; if(typeof e.webkitCompassHeading==='number') h=e.webkitCompassHeading; else if(e.absolute&&typeof e.alpha==='number') h=360-e.alpha; else return;
  comp=(comp==null)?h:norm(comp+0.25*delta(h,comp)); /* απαλό φίλτρο */
  var now=Date.now(); if(mode==='HU'&&now-lastApply>200){ lastApply=now; apply(); }
}
function startCompass(){
  if(compOn) return; var DO=window.DeviceOrientationEvent;
  function go(){ compOn=true; window.addEventListener('deviceorientationabsolute',onOri,true); window.addEventListener('deviceorientation',onOri,true); }
  try{ if(DO&&typeof DO.requestPermission==='function'){ DO.requestPermission().then(function(r){ if(r==='granted') go(); else C.toast(T('Δεν δόθηκε άδεια πυξίδας.','Compass permission denied.')); }).catch(function(){}); } else go(); }catch(e){}
}
window.addEventListener('alkyon-head',function(e){ var h=e.detail&&e.detail.head; if(h!=null){ head=h; } if(mode!=='NU') apply(); });

/* Όσο ο χάρτης είναι γυρισμένος: σύρσιμο με ένα δάχτυλο (δικός μας χειρισμός, γιατί το Leaflet δεν ξέρει για την περιστροφή)
   και σωστή θέση πατήματος (διόρθωση συντεταγμένων). Όταν ανοίγει μενού ή παράθυρο πάνω στον χάρτη, ο χάρτης γυρίζει προσωρινά σε NU ώστε να διαβάζεται. */
var popHold=false, popOpen=false, dragged=0, ptr={}, startPt=null, pinching=false;
function toLocal(cx,cy){ var r=lm.getBoundingClientRect(), mx=r.left+r.width/2, my=r.top+r.height/2, th=shown*Math.PI/180, dx=cx-mx, dy=cy-my, c=Math.cos(th), s=Math.sin(th);
  return {x:lm.clientWidth/2+c*dx+s*dy, y:lm.clientHeight/2-s*dx+c*dy, dx:c*dx+s*dy, dy:-s*dx+c*dy}; }
var patched=false;
function patch(){ var m=getMap(); if(patched||!m) return; patched=true;
  var orig=m.mouseEventToContainerPoint;
  m.mouseEventToContainerPoint=function(e){ if(!isOn) return orig.call(this,e); var t=e.touches&&e.touches[0]||e.changedTouches&&e.changedTouches[0]||e, p=toLocal(t.clientX,t.clientY); return L.point(p.x,p.y); };
  /* Το Leaflet τοποθετεί το παράθυρο με translate3d. Για να γυρίσει γύρω από το σημείο του (και όχι γύρω από τη γωνία του), η αρχή της περιστροφής είναι το σημείο + η μετατόπιση */
  function fixPop(){ try{ Array.prototype.forEach.call(lm.querySelectorAll('.leaflet-popup'),function(el){ var mt=/translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform||''); var tx=mt?+mt[1]:0, ty=mt?+mt[2]:0; el.style.transformOrigin=(el.offsetWidth/2+tx)+'px '+(el.offsetHeight+19+ty)+'px'; }); }catch(x){} }
  m.on('popupopen zoomend viewreset moveend resize',function(){ setTimeout(fixPop,0); });
  m.on('popupopen',function(e){ popOpen=true; fixPop(); setTimeout(function(){ try{ if(!isOn) return; var el=e.popup&&e.popup.getElement&&e.popup.getElement(); if(!el) return; var r=el.getBoundingClientRect(), br=box.getBoundingClientRect(), dx=0, dy=0;
    if(r.right>br.right-10) dx=r.right-(br.right-10); else if(r.left<br.left+10) dx=r.left-(br.left+10);
    if(r.top<br.top+90) dy=r.top-(br.top+90); else if(r.bottom>br.bottom-90) dy=r.bottom-(br.bottom-90);
    if(dx||dy){ var th=shown*Math.PI/180, c=Math.cos(th), s=Math.sin(th); m.panBy([c*dx+s*dy,-s*dx+c*dy],{animate:true}); } }catch(x){} },300); });
  m.on('popupclose',function(){ popOpen=false; apply(); });
}
function nPtr(){ return Object.keys(ptr).length; }
lm.addEventListener('pointerdown',function(e){ if(!isOn) return; ptr[e.pointerId]={x:e.clientX,y:e.clientY}; startPt=nPtr()===1?{x:e.clientX,y:e.clientY}:null; dragged=0; },true);
lm.addEventListener('pointermove',function(e){
  if(!isOn||!ptr[e.pointerId]||nPtr()!==1||pinching) return; var m=getMap(); if(!m) return;
  var p=ptr[e.pointerId], sx=e.clientX-p.x, sy=e.clientY-p.y;
  if(!dragged&&startPt&&Math.hypot(e.clientX-startPt.x,e.clientY-startPt.y)<7) return;
  if(!dragged&&window.AlkyonFollowStop) window.AlkyonFollowStop(); /* v31z536: σύρσιμο = σταματά να ακολουθεί */
  dragged=Date.now(); var th=shown*Math.PI/180, c=Math.cos(th), s=Math.sin(th);
  m.panBy([-(c*sx+s*sy),-(-s*sx+c*sy)],{animate:false}); p.x=e.clientX; p.y=e.clientY;
},true);
function pend(e){ delete ptr[e.pointerId]; }
lm.addEventListener('pointerup',pend,true); lm.addEventListener('pointercancel',pend,true);
/* μετά από σύρσιμο δεν πρέπει να εκτελεστεί «πάτημα» */
['click','dblclick'].forEach(function(t){ lm.addEventListener(t,function(e){ if(isOn&&dragged&&Date.now()-dragged<450){ e.stopPropagation(); e.preventDefault(); } },true); });
lm.addEventListener('touchstart',function(e){ if(e.touches&&e.touches.length>=2) pinching=true; },true);
function endT(e){ if(e.touches&&e.touches.length===0&&pinching){ pinching=false; ptr={}; if(isOn&&window.AlkyonFollowReset) window.AlkyonFollowReset(); } }
lm.addEventListener('touchend',endT,true); lm.addEventListener('touchcancel',endT,true);
/* v31z535: περιστροφή με δύο δάχτυλα. Ξεκινά όταν τα δάχτυλα στρίψουν πάνω από 15° (αλλιώς είναι μόνο ζουμ), μετά ακολουθεί τα δάχτυλα.
   Αν ήταν ενεργό CU/HU, γυρίζει σε NU (όπως το Google Maps βγαίνει από τη λειτουργία πυξίδας). Η πυξίδα «Β» επαναφέρει τον βορρά πάνω. */
var rg=null;
function tAng(e){ var a=e.touches[0], b=e.touches[1]; return Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX)*180/Math.PI; }
lm.addEventListener('touchstart',function(e){ if(e.touches&&e.touches.length===2){ var cur=isOn?norm(-shown):0; rg={a0:tAng(e),base:cur,on:false}; } else if(e.touches&&e.touches.length>2) rg=null; },true);
lm.addEventListener('touchmove',function(e){
  if(!rg||!e.touches||e.touches.length!==2) return; var d=delta(tAng(e),rg.a0);
  if(!rg.on){ if(Math.abs(d)<15) return; rg.on=true; rg.a0=tAng(e); d=0; if(autoT()!=null||mode!=='NU'){ mode='NU'; C.lsSet(KEY,'NU'); } }
  man=norm(rg.base-d); lm.style.transition='none'; apply(); lm.style.transition='none';
},true);
function rgEnd(e){ if(rg&&(!e.touches||e.touches.length<2)){ var was=rg.on; rg=null; if(was){ if(man!=null&&Math.abs(delta(man,0))<4){ man=null; } apply(); if(isOn) lm.style.transition='transform .35s linear'; } } }
lm.addEventListener('touchend',rgEnd,true); lm.addEventListener('touchcancel',rgEnd,true);
var nb=document.createElement('button'); nb.type='button'; nb.className='mo-n'; nb.hidden=true; nb.setAttribute('aria-label',T('Βορράς πάνω','North up'));
nb.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path class="nn" d="M12 3l3.2 9H8.8z"/><path class="ns" d="M12 21l-3.2-9h6.4z"/></svg><b>'+T('Β','N')+'</b>';
nb.addEventListener('click',function(){ if(man==null) return; lm.style.transition='transform .35s ease-out'; man=0; apply(); setTimeout(function(){ man=null; apply(); },380); });
box.appendChild(nb);
function updN(){ var on=isOn&&man!=null&&autoT()==null; nb.hidden=!on; if(!on) return; nb.style.setProperty('--nr',shown.toFixed(1)+'deg');
  /* θέση: κάτω από το κουμπί NU/CU/HU αν φαίνεται, αλλιώς κάτω από την αριστερή στήλη (άγκυρα κ.λπ.) */
  var y=0; [btn,document.querySelector('.seabar')].forEach(function(el){ if(!el) return; var r=el.getBoundingClientRect(); if(r.height>0&&getComputedStyle(el).display!=='none'&&r.bottom>y) y=r.bottom; });
  nb.style.top=Math.round((y||60)+10)+'px'; }
window.addEventListener('resize',function(){ if(isOn) layout(true); });
window.addEventListener('orientationchange',function(){ setTimeout(function(){ if(isOn) layout(true); },300); });

/* Δεν φορτώνει τίποτα ακόμα; ο χάρτης δημιουργείται από το app.js, οπότε περιμένουμε λίγο */
window.AlkyonOrient={mode:function(){ return document.body.classList.contains('ontrip')?mode:'NU'; }};
try{ new MutationObserver(function(){ apply(); }).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){}
var tries=0; (function wait(){ if(getMap()||tries++>40){ hoist(); patch(); if(mode==='HU') startCompass(); apply(); updBtn(); } else setTimeout(wait,250); })();
})();
