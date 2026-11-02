/* Διαδρομή GPS κατά τη διάρκεια της εξόδου: χάρτης, χιλιόμετρα, αποθήκευση στην έξοδο. Προαιρετικό (κοστίζει μπαταρία). */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-track', ON='alkyon-gps';
var wid=null, layer=null, line=null, dot=null;

function st(){ return (window.AlkyonTrip&&window.AlkyonTrip.state)?window.AlkyonTrip.state():{}; }
function enabled(){ return C.lsGet(ON,'1')!=='0'; }
function load(){ var t=C.lsGet(KEY,null); return t&&Array.isArray(t.pts)?t:null; }
function store(t){ try{ C.lsSet(KEY,t); }catch(e){} }
function dist(a,b){ /* μέτρα, haversine */
  var R=6371000, r=Math.PI/180, dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r;
  var x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)*Math.sin(dLo/2);
  return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));
}
function cur(){
  var s=st(); if(!s.active) return null;
  var t=load();
  if(!t||t.id!==s.id){ t={id:s.id,pts:[],m:0}; store(t); }
  return t;
}
function km(){ var s=st(), t=s.active?load():null; return t&&t.id===s.id?t.m/1000:0; }

var fixP=null;
function onPos(p){
  var t=cur(); if(!t) return;
  var c=p.coords; if(c.accuracy&&c.accuracy>60) return;
  fixP={lat:c.latitude,lon:c.longitude,t:Date.now()};
  var pt=[+c.latitude.toFixed(6),+c.longitude.toFixed(6),Date.now()];
  var last=t.pts[t.pts.length-1];
  if(last){ var d=dist(last,pt); if(d<12){ draw(); return; } if(d>2000&&pt[2]-last[2]<20000) return; t.m+=d; }
  t.pts.push(pt);
  if(t.pts.length>3000){ t.pts=t.pts.filter(function(_,i){ return i%2===0||i===t.pts.length-1; }); }
  store(t); draw(); window.dispatchEvent(new Event('alkyon-track'));
}
function onErr(e){
  if(e&&e.code===1){ C.lsSet(ON,'0'); stop(); try{ C.toast(T('Δεν δόθηκε άδεια θέσης. Η διαδρομή απενεργοποιήθηκε.','Location permission denied. Route recording is off.')); }catch(x){} window.dispatchEvent(new Event('alkyon-track')); }
}
function begin(){
  if(wid!=null||!navigator.geolocation) return;
  if(!st().active||!enabled()) return;
  cur();
  try{ wid=navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:5000,timeout:30000}); }catch(e){ wid=null; }
}
function stop(){ if(wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } }

function draw(){
  var map=C.map&&C.map(); if(!map||typeof L==='undefined') return;
  var t=st().active?load():null;
  if(!t||!t.pts.length){ if(layer){ layer.clearLayers(); line=dot=null; } return; }
  if(!layer) layer=L.layerGroup().addTo(map); else if(!map.hasLayer(layer)) layer.addTo(map);
  var ll=t.pts.map(function(p){ return [p[0],p[1]]; });
  if(fixP&&Date.now()-fixP.t<60000){ var lp=ll[ll.length-1]; if(!lp||dist(lp,[fixP.lat,fixP.lon])>1) ll.push([fixP.lat,fixP.lon]); }
  if(!line){ line=L.polyline(ll,{color:'#ff8a50',weight:4,opacity:.9}).addTo(layer); }
  else line.setLatLngs(ll);
  var e=ll[ll.length-1];
  if(!dot){ dot=L.circleMarker(e,{radius:6,color:'#fff',weight:2,fillColor:'#ff5a2a',fillOpacity:1}).addTo(layer); }
  else dot.setLatLng(e);
}

/* Απλοποίηση (Douglas-Peucker) ώστε να αποθηκεύεται ελαφριά στην έξοδο */
function simplify(pts,eps){
  if(pts.length<3) return pts;
  var r=Math.PI/180, k=111320, la0=pts[0][0]*r, xs=pts.map(function(p){ return [(p[1])*k*Math.cos(la0),p[0]*k]; });
  var keep=new Array(pts.length).fill(false); keep[0]=keep[pts.length-1]=true;
  var stack=[[0,pts.length-1]];
  while(stack.length){
    var s=stack.pop(), a=xs[s[0]], b=xs[s[1]], mx=0, mi=-1;
    var dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy;
    for(var i=s[0]+1;i<s[1];i++){
      var p=xs[i], u=L2?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2:0; u=Math.max(0,Math.min(1,u));
      var d=Math.hypot(p[0]-(a[0]+u*dx),p[1]-(a[1]+u*dy));
      if(d>mx){ mx=d; mi=i; }
    }
    if(mx>eps&&mi>0){ keep[mi]=true; stack.push([s[0],mi],[mi,s[1]]); }
  }
  return pts.filter(function(_,i){ return keep[i]; });
}
/* Καλείται από το «Τέλος εξόδου»: επιστρέφει {km,track} και καθαρίζει */
function take(){
  var s=st(), t=load(), out=null;
  if(t&&t.id===s.id&&t.pts.length>1&&t.m>=100){
    var tr=simplify(t.pts.map(function(p){ return [p[0],p[1]]; }),6), eps=6;
    while(tr.length>400&&eps<400){ eps*=1.6; tr=simplify(tr,eps); }
    out={km:Math.round(t.m/100)/10,moving:(window.PP&&window.PP.movingFrom?window.PP.movingFrom(t.pts):undefined),track:tr.map(function(p){ return [+p[0].toFixed(5),+p[1].toFixed(5)]; })};
  }
  stop(); store(null);
  if(layer){ layer.clearLayers(); line=dot=null; }
  setTimeout(function(){ window.dispatchEvent(new Event('alkyon-track')); },0);
  return out;
}
/* Εμφάνιση αποθηκευμένης διαδρομής στον χάρτη (από τη λίστα εξόδων) */
var showL=null;
function hide(){ var map=C.map&&C.map(); if(showL&&map){ try{ map.removeLayer(showL); }catch(e){} } showL=null; }
function show(track,nofit){
  C.switchTab('map');
  setTimeout(function(){
    var map=C.map&&C.map(); if(!map||!track||track.length<2) return;
    if(showL) map.removeLayer(showL);
    var pl=L.polyline(track,{color:'#ff8a50',weight:4,opacity:.95});
    var a=L.circleMarker(track[0],{radius:6,color:'#fff',weight:2,fillColor:'#2e9e5b',fillOpacity:1});
    var b=L.circleMarker(track[track.length-1],{radius:6,color:'#fff',weight:2,fillColor:'#d33',fillOpacity:1});
    showL=L.layerGroup([pl,a,b]).addTo(map);
    if(!nofit) map.fitBounds(pl.getBounds(),{padding:[40,40],maxZoom:16});
  },250);
}
function setEnabled(v){
  C.lsSet(ON,v?'1':'0');
  if(v){ if(st().active) begin(); try{ C.toast(T('Διαδρομή GPS ενεργή. Καταναλώνει περισσότερη μπαταρία.','GPS route on. It uses more battery.')); }catch(e){} }
  else { stop(); var t=cur(); if(t) store(null); if(layer){ layer.clearLayers(); line=dot=null; } }
  window.dispatchEvent(new Event('alkyon-track'));
}

window.AlkyonTrack={hide:hide,fix:function(){ return fixP; },enabled:enabled,setEnabled:setEnabled,km:km,take:take,show:show,draw:draw,active:function(){ return wid!=null; }};
window.addEventListener('alkyon-sess',function(){
  var s=st();
  if(!s.active){ stop(); if(layer){ layer.clearLayers(); line=dot=null; } return; }
  begin(); draw();
});
document.addEventListener('visibilitychange',function(){ if(!document.hidden&&st().active&&enabled()){ stop(); begin(); draw(); } });
setTimeout(function(){ begin(); draw(); },1200);
setInterval(draw,15000);
})();
