/* Χάρακας χάρτη (1.7.1, νέος σχεδιασμός): πατάς πάνω στον χάρτη για σημεία, σέρνεις ένα σημείο για να το διορθώσεις,
   πατάς ξανά ένα σημείο για να το σβήσεις. Αρχή αυτόματα από τη θέση σου (αν υπάρχει). Μία μικρή μπάρα κάτω:
   συνολική απόσταση · πορεία του τελευταίου κομματιού · χρόνος με την ταχύτητά σου (ή 5 kn) · βάθος στο τελευταίο σημείο.
   Βάθη: EMODnet (πλέγμα ~100 m, ενδεικτικά κοντά στην ακτή). Όχι ναυτικό όργανο. */
(function(){
'use strict';
var C=window.AlkyonCore, mb=document.querySelector('.mapbtns'), L=window.L; if(!C||!mb||!L) return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var PU=window.AlkyonUnits;
var btn=document.createElement('button'); btn.type='button'; btn.id='bRuler'; btn.className='mbtn'; btn.setAttribute('aria-pressed','false');
btn.setAttribute('aria-label',T('Χάρακας (απόσταση, πορεία και βάθος)','Ruler (distance, heading and depth)')); btn.title=btn.getAttribute('aria-label');
btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>';
mb.appendChild(btn);

var on=false, P=[], dep=[], meStart=false, poly=null, mk=[], lb=[], panel=null, kn=null;
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dist(a,b){ var R=6371000, r=Math.PI/180, dl=(b.lat-a.lat)*r, dn=(b.lng-a.lng)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.sqrt(x)); }
function bearing(a,b){ var r=Math.PI/180, y=Math.sin((b.lng-a.lng)*r)*Math.cos(b.lat*r), x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lng-a.lng)*r); return (Math.atan2(y,x)/r+360)%360; }
function fmtD(m){ var cu=PU&&PU.cfg&&PU.cfg.dist; if(cu&&cu!=='km'&&PU.dist){ try{ return PU.dist(m/1000,2); }catch(e){} } return m<1000?Math.round(m)+' m':(m/1000).toFixed(m<10000?2:1)+' km'; }
function nm(m){ return (m/1852).toFixed(m<18520?2:1)+' nm'; }
function fmtDep(v){ if(v===undefined) return '…'; if(v===null) return navigator.onLine===false?T('χωρίς σήμα','offline'):'–'; return '≈ '+(PU&&PU.depth?PU.depth(v):v+' m'); }
function dirT(b){ return Math.round(b)+'° '+COMP[Math.round(b/45)%8]; }
function total(){ var s=0; for(var i=1;i<P.length;i++) s+=dist(P[i-1],P[i]); return s; }
function hm(min){ if(min<60) return Math.max(1,Math.round(min))+'′'; var hh=Math.floor(min/60), mm=Math.round(min%60); return hh+T('ω ','h ')+(mm<10?'0':'')+mm+'′'; }
function speed(){ try{ var f=window.AK&&AK.trip&&AK.trip.fix&&AK.trip.fix(); if(f&&f.spd!=null&&f.spd>0.8&&Date.now()-f.t<20000) return f.spd*1.94384; }catch(e){} return null; }

function dot(i,first){ return L.divIcon({className:'rulpt',iconSize:[30,30],iconAnchor:[15,15],html:'<div class="rp'+(first?' a':'')+'">'+(first&&meStart?'●':i+1)+'</div>'}); }
function tag(txt,cls){ return L.divIcon({className:'rultag',iconSize:[0,0],html:'<div class="rt'+(cls?' '+cls:'')+'">'+txt+'</div>'}); }
function drawAll(){
  [poly].concat(mk,lb).forEach(function(l){ if(l) try{ map.removeLayer(l); }catch(e){} }); poly=null; mk=[]; lb=[];
  if(P.length>1) poly=L.polyline(P,{color:'#E8743B',weight:4,interactive:false}).addTo(map);
  P.forEach(function(q,i){
    var m=L.marker(q,{icon:dot(i,i===0),draggable:true,keyboard:false,zIndexOffset:3000,bubblingMouseEvents:false}).addTo(map);
    m.on('drag',function(e){ P[i]=e.target.getLatLng(); if(poly) poly.setLatLngs(P); paint(); });
    m.on('dragend',function(){ if(i===0) meStart=false; dep[i]=undefined; fetchDep(i); drawAll(); paint(); });
    m.on('click',function(ev){ L.DomEvent.stop(ev); P.splice(i,1); dep.splice(i,1); if(i===0) meStart=false; drawAll(); paint(); });
    mk.push(m);
    if(i){ var a=P[i-1], mid=L.latLng((a.lat+q.lat)/2,(a.lng+q.lng)/2); lb.push(L.marker(mid,{icon:tag(fmtD(dist(a,q))+' · '+Math.round(bearing(a,q))+'°'),interactive:false,keyboard:false,zIndexOffset:2500}).addTo(map)); }
    if(dep[i]!==undefined&&dep[i]!==null&&i>0) lb.push(L.marker(q,{icon:tag(fmtDep(dep[i]),'d'),interactive:false,keyboard:false,zIndexOffset:2600}).addTo(map));
  });
}
function fetchDep(i){ var q=P[i]; if(!q||!C.depthAt) return; C.depthAt(q.lat,q.lng).then(function(v){ if(P[i]!==q) return; dep[i]=v==null?null:v; }).catch(function(){ if(P[i]===q) dep[i]=null; }).then(function(){ if(on&&P[i]===q){ drawAll(); paint(); } }); }
function add(ll){ P.push(L.latLng(ll.lat,ll.lng)); var i=P.length-1; dep[i]=undefined; drawAll(); paint(); fetchDep(i); try{ navigator.vibrate&&navigator.vibrate(12); }catch(e){} }

function ensurePanel(){ if(panel) return panel; panel=document.createElement('div'); panel.id='ndRuler'; panel.setAttribute('role','group'); panel.setAttribute('aria-label',T('Χάρακας','Ruler')); document.body.appendChild(panel); return panel; }
function b(txt,lab,fn,cls){ var x=document.createElement('button'); x.type='button'; x.className='rb'+(cls?' '+cls:''); x.textContent=txt; x.setAttribute('aria-label',lab); x.title=lab; x.addEventListener('click',fn); return x; }
function paint(){
  var p=ensurePanel(); p.replaceChildren();
  var t=total(), last=P.length>1?bearing(P[P.length-2],P[P.length-1]):null, v=speed()||kn||5, mins=t/1852/v*60;
  var main=document.createElement('div'); main.className='rmain';
  if(P.length<2){ var hint=document.createElement('div'); hint.className='rhint';
    hint.innerHTML='<b>'+(P.length?T('Πάτα στον χάρτη το επόμενο σημείο','Tap the next point on the map'):T('Πάτα στον χάρτη για να μετρήσεις','Tap the map to measure'))+'</b><small>'+
      (meStart?T('Αρχή: η θέση σου · ','Start: your position · '):T('◎ = αρχή από τη θέση σου · ','◎ = start from your position · '))+T('σέρνεις ένα σημείο για να το μετακινήσεις, το πατάς για να το σβήσεις','drag a point to move it, tap it to remove it')+'</small>';
    main.append(hint); }
  else { var d=document.createElement('div'); d.className='rnum'; d.setAttribute('aria-live','polite');
    d.innerHTML='<b>'+fmtD(t)+'</b><small>'+nm(t)+'</small>';
    var info=document.createElement('div'); info.className='rinfo';
    info.innerHTML='<span><i>'+T('Πορεία','Heading')+'</i>'+dirT(last)+'</span><span><i>'+(speed()?T('Χρόνος με '+speed().toFixed(1)+' kn','Time at '+speed().toFixed(1)+' kn'):T('Χρόνος με '+v+' kn','Time at '+v+' kn'))+'</i>'+hm(mins)+'</span><span><i>'+T('Βάθος','Depth')+'</i>'+fmtDep(dep[P.length-1])+'</span>';
    main.append(d,info); }
  var acts=document.createElement('div'); acts.className='racts';
  /* η ταχύτητα με την οποία υπολογίζεται ο χρόνος (όταν το GPS δεν δίνει δική σου ταχύτητα): πάτα για 3 → 5 → 8 → 12 → 20 kn */
  if(!speed()) acts.append(b('⏱ '+v+' kn',T('Ο χρόνος υπολογίζεται με '+v+' κόμβους. Πάτα για άλλη ταχύτητα.','Time is worked out at '+v+' knots. Tap for another speed.'),function(){ var L2=[3,5,8,12,20], k=L2.indexOf(+v); kn=L2[(k+1)%L2.length]; paint(); },'sp'));
  if(P.length) acts.append(b('↶',T('Αναίρεση τελευταίου σημείου','Undo last point'),function(){ P.pop(); dep.length=P.length; if(!P.length) meStart=false; drawAll(); paint(); }));
  if(!P.length||!meStart) acts.append(b('◎',T('Αρχή από τη θέση μου','Start from my position'),useMe));
  if(P.length) acts.append(b('⌫',T('Καθαρισμός','Clear'),function(){ P=[]; dep=[]; meStart=false; drawAll(); paint(); }));
  acts.append(b('✕',T('Κλείσιμο χάρακα','Close the ruler'),stop,'x'));
  p.append(main,acts);
}
function useMe(){
  var p=C.getPosition?C.getPosition():Promise.reject();
  Promise.resolve(p).then(function(q){ if(!q) throw 0; var ll=L.latLng(q.lat,q.lon); P.unshift(ll); dep.unshift(undefined); meStart=true; drawAll(); paint(); fetchDep(0); if(P.length===1&&!map.getBounds().contains(ll)) map.panTo(ll); })
    .catch(function(){ C.toast(T('Δεν βρέθηκε η θέση σου.','Could not get your position.')); });
}
function onClick(e){ if(!on) return; add(e.latlng); }
function start(){
  if(on) return; on=true; btn.setAttribute('aria-pressed','true'); btn.classList.add('on'); P=[]; dep=[]; meStart=false; kn=null;
  document.body.classList.add('ruling'); map.on('click',onClick); try{ map.closePopup(); }catch(e){} paint();
  /* 1.8.1: ξεκινά από το πρώτο σημείο που πατάς· από τη θέση σου μόνο με το κουμπί ◎ */
}
function stop(){
  on=false; btn.setAttribute('aria-pressed','false'); btn.classList.remove('on'); map.off('click',onClick); document.body.classList.remove('ruling');
  [poly].concat(mk,lb).forEach(function(l){ if(l) try{ map.removeLayer(l); }catch(e){} }); poly=null; mk=[]; lb=[]; P=[]; dep=[];
  if(panel){ panel.remove(); panel=null; }
}
btn.addEventListener('click',function(){ if(on) stop(); else start(); });
window.AlkyonRuler={start:start,stop:stop,add:function(lat,lng){ add({lat:lat,lng:lng}); },state:function(){ return {n:P.length,m:total(),me:meStart}; }};
})();
