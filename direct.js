/* «Πηγαίνω εκεί» (Direct to): γραμμή, απόσταση, πορεία, ταχύτητα και ώρα άφιξης προς ένα σημείο ή ψάρι. Δεν είναι ναυτικός χάρτης. */
(function(){
'use strict';
var C=window.AlkyonCore, box=document.querySelector('.mapbox'); if(!C||!box||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, U=window.AlkyonUnits;
var KEY='alkyon-direct';
var tgt=C.lsGet(KEY,null); if(tgt&&(typeof tgt.lat!=='number'||typeof tgt.lon!=='number')) tgt=null;
var pos=null, prev=null, spd=null, wid=null, lastZ=0, zNames=[], arrived=false;
var layer=L.layerGroup().addTo(map), line=null, tm=null;
var bar=document.createElement('div'); bar.id='dtBar'; bar.hidden=true;
bar.innerHTML='<div class="dtrow"><div class="dtmain"><b class="dtname"></b><span class="dtinfo"></span></div><button type="button" class="dtx" aria-label="'+T('Τέλος πλοήγησης','Stop navigation')+'">✕</button></div><div class="dtmsgs"><span class="dtwarn" hidden></span><span class="dtland" hidden></span></div><button type="button" class="dthide" aria-label="'+T('Μηνύματα','Messages')+'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>';
box.appendChild(bar);
var pill=document.createElement('button'); pill.type='button'; pill.id='dtShow'; pill.hidden=true; pill.setAttribute('aria-label',T('Εμφάνιση πορείας','Show course')); pill.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg><span></span>'; box.appendChild(pill);
var dmin=false, dseen={}, lk='', wasTrip=document.body.classList.contains('ontrip');
var nameEl=bar.querySelector('.dtname'), infoEl=bar.querySelector('.dtinfo'), warnEl=bar.querySelector('.dtwarn'), landEl=bar.querySelector('.dtland');
var rt=null, planning=false;

var R=Math.PI/180;
function distKm(a,b,c,d){ var dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742*Math.asin(Math.min(1,Math.sqrt(x))); }
function bearing(a,b,c,d){ var y=Math.sin((d-b)*R)*Math.cos(c*R), x=Math.cos(a*R)*Math.sin(c*R)-Math.sin(a*R)*Math.cos(c*R)*Math.cos((d-b)*R); return (Math.atan2(y,x)/R+360)%360; }
var DIRS=['N','NE','E','SE','S','SW','W','NW'];
function card(deg){ return DIRS[Math.round(deg/45)%8]; }
function inRing(lat,lon,r){ var ins=false; for(var i=0,j=r.length-1;i<r.length;j=i++){ var yi=r[i][0],xi=r[i][1],yj=r[j][0],xj=r[j][1]; if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) ins=!ins; } return ins; }
function crossed(a,b,c,d){
  var Z=window.ZONES||[], names={}, n=Math.max(2,Math.min(300,Math.ceil(distKm(a,b,c,d)*1000/40)));
  for(var k=0;k<=n;k++){ var f=k/n, la=a+(c-a)*f, lo=b+(d-b)*f;
    Z.forEach(function(z){ if(names[z.n]) return; var cnt=0; for(var r=0;r<z.p.length;r++) if(inRing(la,lo,z.p[r])) cnt++; if(cnt%2===1) names[z.n]=1; }); }
  return Object.keys(names);
}
function fmtEta(min){ if(min>=600) return '>10'+T('ω','h'); var h=Math.floor(min/60), m=Math.round(min%60); return h?h+T('ω ','h ')+m+T('λ','m'):Math.max(1,m)+T('λ','m'); }

function replan(){
  if(!tgt||!pos||planning||!window.AlkyonRoute) return;
  var clr=+C.lsGet('alkyon-route-clr',200); if(!clr){ rt=null; return; }
  planning=true; var key=tgt.lat+','+tgt.lon, t0=Date.now();
  window.AlkyonRoute.plan({lat:pos.lat,lon:pos.lon},{lat:tgt.lat,lon:tgt.lon},clr).then(function(r){
    if(!tgt||key!==tgt.lat+','+tgt.lon) return;
    rt=r.straight?{straight:1,t:t0}:r.err?{err:r.err,which:r.which,t:t0,clr:clr}:{pts:r.pts,len:r.len,direct:r.direct,k:0,t:t0,clr:clr};
  }).catch(function(){ if(tgt) rt={off:1,t:t0}; }).then(function(){ planning=false; render(); });
}
function applyMin(){
  var b=document.body.classList; b.toggle('dtmin',dmin); b.add('hasdt'); bar.classList.toggle('min',dmin);
  pill.hidden=true; setH();
}
function setH(){ document.documentElement.style.setProperty('--dth',(tgt&&document.body.classList.contains('ontrip')?'88px':'0px')); }
function keysNow(){ var o={}; if(zNames&&!warnEl.hidden) zNames.forEach(function(n){ o['z:'+n]=1; }); if(lk) o['l:'+lk]=1; return o; }
function render(){
  layer.clearLayers(); line=null; tm=null;
  if(!tgt){ window.AlkyonDirectInfo=null; bar.hidden=true; pill.hidden=true; dmin=false; dseen={}; document.body.classList.remove('hasdt','hasland','dtmin'); setH(); return; }
  bar.hidden=false; applyMin();
  tm=L.circleMarker([tgt.lat,tgt.lon],{radius:9,color:'#fff',weight:3,fillColor:'#e8541e',fillOpacity:1}).addTo(layer);
  nameEl.textContent='➤ '+(tgt.name||T('Σημείο','Point'));
  if(!pos){ window.AlkyonDirectInfo={wait:1,t:Date.now()}; warnEl.hidden=true; return; }
  var d=distKm(pos.lat,pos.lon,tgt.lat,tgt.lon), b=bearing(pos.lat,pos.lon,tgt.lat,tgt.lon), landTxt='';
  if(!planning&&(!rt||Date.now()-rt.t>60000)) setTimeout(replan,0);
  if(rt&&rt.pts){
    var k=rt.k||0; while(k<rt.pts.length-2&&distKm(pos.lat,pos.lon,rt.pts[k+1][0],rt.pts[k+1][1])<0.15) k++; rt.k=k;
    var seg=[[pos.lat,pos.lon]].concat(rt.pts.slice(k+1)); d=0; for(var s=1;s<seg.length;s++) d+=distKm(seg[s-1][0],seg[s-1][1],seg[s][0],seg[s][1]);
    b=bearing(pos.lat,pos.lon,seg[1][0],seg[1][1]);
    L.polyline([[pos.lat,pos.lon],[tgt.lat,tgt.lon]],{color:'#ff8a50',weight:2,dashArray:'2 9',opacity:.4,interactive:false}).addTo(layer);
    line=L.polyline(seg,{color:'#ffd166',weight:4,dashArray:'10 7',opacity:.98}).addTo(layer);
    landTxt='↪ '+T('Ενδεικτική διαδρομή γύρω από στεριά (+','Indicative route around land (+')+Math.max(0.1,Math.round((d-distKm(pos.lat,pos.lon,tgt.lat,tgt.lon))*10)/10)+' km). '+T('Όχι ναυτική πλοήγηση: κοίτα πάντα έξω.','Not marine navigation: always look outside.');
  } else {
    line=L.polyline([[pos.lat,pos.lon],[tgt.lat,tgt.lon]],{color:'#ff8a50',weight:3,dashArray:'8 8',opacity:.95}).addTo(layer);
    if(rt&&rt.err==='nopath') landTxt='⚠ '+T('Η ευθεία πορεία περνά από στεριά και δεν βρέθηκε ασφαλής διαδρομή με απόσταση ','The straight course crosses land and no safe route was found with ')+rt.clr+T(' μ. Πρόσεχε.',' m clearance. Be careful.');
    else if(rt&&rt.err==='nosea') landTxt='⚠ '+(rt.which==='start'?T('Βρίσκεσαι στη στεριά, μακριά από θάλασσα. Η διαδρομή στη θάλασσα υπολογίζεται όταν είσαι κοντά στην ακτή.','You are on land, away from the sea. The sea route is calculated when you are near the coast.'):T('Ο προορισμός είναι στη στεριά, μακριά από θάλασσα. Η γραμμή είναι ευθεία.','The destination is on land, away from the sea. The line is straight.'));
    else if(rt&&rt.err) landTxt='⚠ '+T('Δεν έγινε έλεγχος στεριάς για αυτή την πορεία.','Land was not checked for this course.');
    else if(rt&&rt.off) landTxt=T('Χωρίς σύνδεση: δεν ελέγχθηκε η στεριά στην πορεία.','Offline: land on the course was not checked.');
  }
  landEl.hidden=!landTxt; landEl.textContent=landTxt; document.body.classList.toggle('hasland',!!landTxt);
  var nm=d/1.852, kn=spd!=null?spd*1.94384:null;
  var cells=[[U?U.dist(d,d<10?(d<1?2:1):0):d.toFixed(1)+' km',T('Απόσταση','Distance')],[('00'+Math.round(b)).slice(-3)+'° '+card(b),T('Πορεία','Course')]];
  if(kn!=null&&kn>=0.8){ cells.push([kn.toFixed(1)+' kn',T('Ταχύτητα','Speed')]); cells.push([fmtEta(nm/kn*60).replace(/ /g,''),'ETA']); }
  infoEl.textContent=cells.map(function(c){ return c[0]; }).join(' · '); window.AlkyonDirectInfo={d:cells[0][0],b:cells[1][0],spd:cells[2]?cells[2][0]:null,eta:cells[3]?cells[3][0]:null,t:Date.now()};
  bar.classList.toggle('nomsg',warnEl.hidden&&landEl.hidden);
  var now=Date.now();
  if(now-lastZ>4000){ lastZ=now; zNames=crossed(pos.lat,pos.lon,tgt.lat,tgt.lon); }
  warnEl.hidden=!zNames.length; warnEl.textContent=zNames.length?'⚠ '+T('Περνά μέσα από απαγορευμένη περιοχή: ','Crosses a no-fishing zone: ')+zNames.join(', '):'';
  setH();
  lk=landTxt?(rt&&rt.err?'e:'+rt.err+(rt.which||''):(rt&&rt.pts?'route':'off')):'';
  var kn2=keysNow(), fresh=Object.keys(kn2).some(function(k){ return !dseen[k]; });
  if(dmin&&fresh){ dmin=false; applyMin(); try{ if(navigator.vibrate) navigator.vibrate(60); }catch(e){} }
  bar.classList.toggle('nomsg',warnEl.hidden&&landEl.hidden);
  if(d<0.05&&!arrived){ arrived=true; try{ if(navigator.vibrate) navigator.vibrate([120,80,120]); }catch(e){} try{ C.toast(T('Έφτασες στο σημείο','You have arrived')); }catch(e){} setTimeout(function(){ if(arrived) clear(); },4000); }
}
function onPos(p){
  var c=p.coords, t=Date.now(); if(c.accuracy&&c.accuracy>80) return;
  var np={lat:c.latitude,lon:c.longitude,t:t};
  var v=(c.speed!=null&&!isNaN(c.speed))?c.speed:null;
  if(v==null&&prev&&t-prev.t>=2000){ v=distKm(prev.lat,prev.lon,np.lat,np.lon)*1000/((t-prev.t)/1000); }
  if(v!=null) spd=spd==null?v:spd*0.6+v*0.4;
  if(!prev||t-prev.t>=2000) prev=np;
  pos=np; render();
}
function onErr(e){ if(e&&e.code===1){ try{ C.toast(T('Δεν δόθηκε άδεια θέσης. Χωρίς GPS δεν υπάρχει πορεία.','Location permission denied. No course without GPS.')); }catch(x){} } }
function begin(){ if(wid!=null||!navigator.geolocation) return; try{ wid=navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:3000,timeout:30000}); }catch(e){ wid=null; } }
function stop(){ if(wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } }
function go(lat,lon,name){ try{ if(C.dropBack) C.dropBack(); }catch(e){} rt=null; tgt={lat:+lat,lon:+lon,name:(name||'').slice(0,40)}; C.lsSet(KEY,tgt); arrived=false; spd=null; prev=null; lastZ=0; map.closePopup(); begin(); render(); try{ C.toast(T('Πλοήγηση προς ','Heading to ')+(tgt.name||T('σημείο','point'))); }catch(e){} }
function clear(){ rt=null; tgt=null; arrived=false; C.lsSet(KEY,null); stop(); render(); }
bar.querySelector('.dthide').addEventListener('click',function(e){ e.stopPropagation(); dmin=!dmin; if(dmin) dseen=keysNow(); applyMin(); });
pill.addEventListener('click',function(){ dmin=false; applyMin(); });
bar.querySelector('.dtx').addEventListener('click',function(e){ e.stopPropagation(); clear(); });
bar.querySelector('.dtmain').addEventListener('click',function(){ if(!tgt) return; var pts=[[tgt.lat,tgt.lon]]; if(pos) pts.push([pos.lat,pos.lon]); if(pts.length>1) map.fitBounds(L.latLngBounds(pts),{padding:[70,70],maxZoom:16}); else map.flyTo(pts[0],Math.max(map.getZoom(),14)); });

/* προορισμός στη στεριά: οδηγίες οδήγησης στην εφαρμογή χαρτών του τηλεφώνου (όχι ευθεία γραμμή) */
function navExt(la,lo){
  var ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var u=ios?'https://maps.apple.com/?daddr='+la+','+lo+'&dirflg=d':'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+la+','+lo;
  window.open(u,'_blank','noopener');
}

/* κουμπί «Πηγαίνω εκεί» σε κάθε παράθυρο πληροφοριών του χάρτη */
map.on('popupopen',function(e){
  var p=e.popup, el=p.getElement&&p.getElement(); if(!el) return;
  var pop=el.querySelector('.pop'); if(!pop||pop.querySelector('.pdirect')||pop.classList.contains('nodirect')) return;
  var ll=p.getLatLng&&p.getLatLng(); if(!ll) return;
  var nm=(pop.querySelector('b')||{}).textContent||'';
  var b=document.createElement('button'); b.type='button'; b.className='pact pdirect'+(pop.classList.contains('pmap')?'':' solo');
  b.innerHTML='<svg viewBox="0 0 24 24" class="pi"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg><span></span>'; b.querySelector('span').textContent=T('Πηγαίνω εκεί','Go there');
  var land=pop.classList.contains('land');
  b.addEventListener('click',function(){ if(land) navExt(ll.lat,ll.lng); else go(ll.lat,ll.lng,nm); });
  (pop.querySelector('.pbtns')||pop).appendChild(b);
});
try{ if(window.ResizeObserver) new ResizeObserver(setH).observe(bar); new MutationObserver(setH).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){}
try{ new MutationObserver(function(){ var on=document.body.classList.contains('ontrip'); if(wasTrip&&!on&&tgt) clear(); wasTrip=on; }).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){}
window.AlkyonDirect={navExt:navExt,go:go,clear:clear,target:function(){ return tgt; }};
if(tgt){ begin(); render(); }
})();
