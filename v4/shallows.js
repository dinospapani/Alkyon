/* Alkyon 4 · 1.13.4: Ρηχά νερά και ξέρες (όπως η σκίαση ρηχών στους ναυτικούς χάρτες)
   Από το πλέγμα βάθους EMODnet (ίδια πηγή με τις γραμμές βάθους και τη «Δομή βυθού»):
   - σκίαση: 0–2 m σκούρο, 2–5 m μεσαίο, 5–10 m ανοιχτό (κουκκίδες στα 0–5 m, όπως στους χάρτες)
   - ξέρες: ρηχά σημεία (≤ 10 m) που δεν ακουμπούν στην ακτή, με ⚠ και το ελάχιστο βάθος
   Ενδεικτικό: το πλέγμα είναι μέσος όρος ~115 m, άρα μικρές ξέρες μπορεί να λείπουν ή να φαίνονται βαθύτερες.
   Δεν είναι ναυτικός χάρτης και δεν αντικαθιστά βυθόμετρο ή τα σήματα του OpenSeaMap. */
(function(){
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var KEY='alkyon-v4-shallow', on=!!ls.get(KEY,false), map=null, cv=null, grp=null, G=null, A=null, busy=false, key='', mt=0, legEl=null;
var LIM=10;
function M(){ return window.AlkyonCore&&window.AlkyonCore.map&&window.AlkyonCore.map(); }
function pane(){ var p=map.getPane('shPane')||map.createPane('shPane'); p.style.zIndex='338'; p.style.pointerEvents='none'; return p; }
function pin(c){ try{ L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0])); }catch(e){} }
function loadBathy(){ return window.AlkyonBathy?Promise.resolve():new Promise(function(res){ var s=document.createElement('script'); s.src='../bathy-lines.js'; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
function ensure(){ var m=M(); if(!m) return false; if(m!==map){ map=m; cv=null;
    map.on('movestart zoomstart',function(){ if(cv) cv.style.opacity='0'; });
    map.on('move',function(){ if(cv) pin(cv); });
    map.on('moveend zoomend',function(){ clearTimeout(mt); mt=setTimeout(refresh,400); }); }
  if(!cv){ cv=document.createElement('canvas'); cv.className='shcv'; cv.setAttribute('aria-hidden','true'); cv.style.cssText='position:absolute;left:0;top:0;pointer-events:none;transition:opacity .3s'; pane().appendChild(cv); }
  if(!grp) grp=L.layerGroup(); return true; }
/* ξέρες: ομάδες ρηχών κελιών (≤ LIM) που δεν ακουμπούν σε ξηρά ή κενό */
function analyze(g){
  var w=g.w, hh=g.h, d=g.data, seen=new Uint8Array(w*hh), shoals=[], n=0;
  function sh(i){ var v=d[i]; return v>0&&v<=LIM; }
  for(var s=0;s<w*hh;s++){ if(!sh(s)) continue; n++; if(seen[s]) continue;
    var st=[s], cells=0, coast=false, edge=false, mn=1e9, mi=s; seen[s]=1;
    while(st.length){ var i=st.pop(), x=i%w, y=(i-x)/w; cells++; if(d[i]<mn){ mn=d[i]; mi=i; }
      if(x===0||y===0||x===w-1||y===hh-1) edge=true;
      for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; var xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=w||yy>=hh) continue; var j=yy*w+xx, v=d[j];
        if(!(v>0)){ coast=true; continue; } if(v<=LIM&&!seen[j]){ seen[j]=1; st.push(j); } } }
    if(!coast&&!edge&&cells<=400) shoals.push({x:mi%w,y:Math.floor(mi/w),d:mn,c:cells}); }
  shoals.sort(function(a,b){ return a.d-b.d; });
  return {n:n,shoals:shoals.slice(0,40)}; }
function ll(g,x,y){ return [g.y0+g.dy*(y+0.5),g.x0+g.dx*(x+0.5)]; }
function sat(){ var v=ls.get('alkyon-v4-map',null); return !v||v.base!=='osm'; }
function band(v){ return v<=2?0:v<=5?1:2; }
function draw(){
  if(!ensure()) return; var sz=map.getSize(), dpr=Math.min(window.devicePixelRatio||1,2); cv.width=Math.round(sz.x*dpr); cv.height=Math.round(sz.y*dpr); cv.style.width=sz.x+'px'; cv.style.height=sz.y+'px'; pin(cv);
  var c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,sz.x,sz.y); grp.clearLayers();
  if(!on||!G||!A||!document.body.classList.contains('mapon')){ cv.style.opacity='0'; if(map&&map.hasLayer(grp)) map.removeLayer(grp); legend(null); return; }
  var g=G, S=sat(), col=S?[[120,220,255,.62],[90,190,240,.42],[70,160,230,.22]]:[[30,110,200,.55],[60,140,215,.38],[110,175,230,.22]];
  var pc=document.createElement('canvas'); pc.width=g.w; pc.height=g.h; var px=pc.getContext('2d'), im=px.createImageData(g.w,g.h), dd=im.data;
  for(var i=0;i<g.w*g.h;i++){ var v=g.data[i]; if(!(v>0&&v<=LIM)) continue; var k=col[band(v)], o=i*4; dd[o]=k[0]; dd[o+1]=k[1]; dd[o+2]=k[2]; dd[o+3]=Math.round(255*k[3]); }
  px.putImageData(im,0,0);
  var p0=map.latLngToContainerPoint([g.y0,g.x0]), p1=map.latLngToContainerPoint([g.y0+g.dy*g.h,g.x0+g.dx*g.w]), cw=(p1.x-p0.x)/g.w, ch=(p1.y-p0.y)/g.h;
  c.imageSmoothingEnabled=true; c.drawImage(pc,0,0,g.w,g.h,p0.x,p0.y,p1.x-p0.x,p1.y-p0.y);
  /* κουκκίδες στα 0–5 m (όπως οι ναυτικοί χάρτες), μία κάθε ~9 px */
  c.fillStyle=S?'rgba(255,255,255,.75)':'rgba(10,50,110,.55)'; var step=9;
  for(var yy=Math.max(0,Math.floor(p0.y/step)*step);yy<Math.min(sz.y,p1.y);yy+=step) for(var xx=Math.max(0,Math.floor(p0.x/step)*step)+((yy/step)%2?step/2:0);xx<Math.min(sz.x,p1.x);xx+=step){
    var gx=Math.floor((xx-p0.x)/cw), gy=Math.floor((yy-p0.y)/ch); if(gx<0||gy<0||gx>=g.w||gy>=g.h) continue; var vv=g.data[gy*g.w+gx]; if(vv>0&&vv<=5){ c.beginPath(); c.arc(xx,yy,1.1,0,6.283); c.fill(); } }
  A.shoals.forEach(function(p){ L.marker(ll(g,p.x,p.y),{keyboard:false,icon:L.divIcon({className:'mk shoal',iconSize:null,html:'<i>⚠</i><b>'+(p.d<1?'<1':Math.round(p.d))+' m</b>'})})
    .on('click',function(){ B.toast(T('Ξέρα μακριά από την ακτή: ελάχιστο βάθος ~','Offshore shoal: minimum depth ~')+(p.d<1?'<1':Math.round(p.d))+T(' m (EMODnet, ενδεικτικό· μπορεί να είναι πιο ρηχή).',' m (EMODnet, indicative; it may be shallower).'),8000); }).addTo(grp); });
  if(!map.hasLayer(grp)) grp.addTo(map);
  cv.style.opacity='1'; legend(A); }
function legend(a){
  if(!a){ if(legEl) legEl.hidden=true; return; }
  if(!legEl){ legEl=h('div',{class:'sbleg shleg',role:'note'}); document.body.append(legEl); }
  var S=sat(); legEl.hidden=false; legEl.replaceChildren(h('b',{text:T('Ρηχά & ξέρες','Shallows & shoals')}),
    h('span',{class:'sbk'},h('i',{style:'background:'+(S?'#78dcff':'#1e6ec8')}),'0–2 m'),h('span',{class:'sbk'},h('i',{style:'background:'+(S?'#5abef0':'#3c8cd7')+';opacity:.75'}),'2–5 m'),h('span',{class:'sbk'},h('i',{style:'background:'+(S?'#46a0e6':'#6eafe6')+';opacity:.5'}),'5–10 m'),
    h('span',{class:'sbk'},h('em',{text:'⚠'}),T('ξέρα','shoal')),
    h('small',{text:a.n?T('Ενδεικτικά (πλέγμα ~115 m)· μικρές ξέρες μπορεί να λείπουν. Δες και τα «Ναυτικά σήματα».','Indicative (~115 m grid); small shoals may be missing. See also “Sea marks”.'):T('Δεν υπάρχουν ρηχά κάτω από 10 m εδώ.','No water shallower than 10 m here.')})); }
function msg(t){ if(!legEl){ legEl=h('div',{class:'sbleg shleg',role:'note'}); document.body.append(legEl); } legEl.hidden=false; legEl.replaceChildren(h('b',{text:T('Ρηχά & ξέρες','Shallows & shoals')}),h('small',{text:t})); }
function refresh(){
  if(!on||!ensure()){ draw(); return; } if(!document.body.classList.contains('mapon')) return;
  if(map.getZoom()<11){ G=null; A=null; draw(); msg(T('Κάνε ζουμ (11+) για να δεις τα ρηχά και τις ξέρες.','Zoom in (11+) to see shallows and shoals.')); return; }
  var b=map.getBounds(), pw=(b.getEast()-b.getWest())*0.1, ph=(b.getNorth()-b.getSouth())*0.1, bb={w:b.getWest()-pw,s:b.getSouth()-ph,e:b.getEast()+pw,n:b.getNorth()+ph};
  var k=[bb.w,bb.s,bb.e,bb.n].map(function(v){ return v.toFixed(3); }).join(','); if(k===key&&G){ draw(); return; }
  if(busy) return; busy=true; msg(T('Φόρτωση βαθών…','Loading depths…'));
  var res=Math.max(1/960,(bb.e-bb.w)/300);
  loadBathy().then(function(){ if(!window.AlkyonBathy) throw new Error('nobathy'); return window.AlkyonBathy.fetchGrid(bb,res); }).then(function(g){ key=k; G=g; A=analyze(g); draw(); })
    .catch(function(){ msg(T('Τα βάθη δεν φορτώθηκαν. Χρειάζεται σύνδεση.','Depths did not load. Needs a connection.')); }).then(function(){ busy=false; }); }
B.shallows={on:function(){ return on; },set:function(v){ on=!!v; ls.set(KEY,on); if(on) refresh(); else draw(); try{ window.dispatchEvent(new Event('alkyon-wxchange')); }catch(e){} },
  analyze:analyze,_inject:function(g){ key='inj'; G=g; A=analyze(g); draw(); return A; }};
new MutationObserver(function(){ if(on) setTimeout(refresh,300); }).observe(document.body,{attributes:true,attributeFilter:['class']});
setTimeout(function(){ if(on) refresh(); },3500);
})();
