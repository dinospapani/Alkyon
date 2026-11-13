/* Alkyon 4 · Ευρετής δομής βυθού (v31z525)
   Από το πλέγμα βάθους EMODnet (ίδια πηγή με τις γραμμές βάθους, bathy-lines.js):
   - drop-offs: όπου το βάθος αλλάζει απότομα (κλίση σε m ανά 100 m), σε κίτρινο → πορτοκαλί → κόκκινο
   - υψώματα / κορυφές στον βυθό (ρηχότερα από τον γύρω βυθό), με ▲ και το βάθος της κορυφής
   Ενδεικτικό (ανάλυση ~115 m): δεν είναι βυθόμετρο. */
(function(){
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var GB=null, GZ=0, KEY='alkyon-v4-seabed', on=!!ls.get(KEY,false), map=null, cv=null, grp=null, G=null, A=null, busy=false, key='', mt=0, legEl=null;
function M(){ return window.AlkyonCore&&window.AlkyonCore.map&&window.AlkyonCore.map(); }
function pane(){ var p=map.getPane('sbPane')||map.createPane('sbPane'); p.style.zIndex='339'; p.style.pointerEvents='none'; return p; }
function pin(c){ try{ L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0])); }catch(e){} }
function loadBathy(){ return window.AlkyonBathy?Promise.resolve():new Promise(function(res){ var s=document.createElement('script'); s.src='../bathy-lines.js'; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
function ensure(){ var m=M(); if(!m) return false; if(m!==map){ map=m; cv=null;
    map.on('moveend zoomend',function(){ clearTimeout(mt); mt=setTimeout(refresh,400); }); }
  /* 1.14.5: πλακίδια που κινούνται μαζί με τον χάρτη */
  if(!cv){ pane(); cv=B.ovTiles(map,'sbPane',paintTile); }
  if(!grp){ grp=L.layerGroup(); } return true; }
/* ανάλυση πλέγματος: κλίση (m/100 m) και υψώματα */
function analyze(g){
  var w=g.w, hh=g.h, d=g.data, S=new Float32Array(w*hh), lat0=g.y0+g.dy*hh/2, dxm=Math.abs(g.dx)*111320*Math.cos(lat0*Math.PI/180), dym=Math.abs(g.dy)*111320, peaks=[];
  function D(x,y){ var v=d[y*w+x]; return v>2?v:NaN; }
  for(var y=1;y<hh-1;y++) for(var x=1;x<w-1;x++){ var c=D(x,y), l=D(x-1,y), r=D(x+1,y), u=D(x,y-1), b=D(x,y+1); if(isNaN(c)||isNaN(l)||isNaN(r)||isNaN(u)||isNaN(b)) continue;
    var gx=(r-l)/(2*dxm), gy=(b-u)/(2*dym); S[y*w+x]=Math.sqrt(gx*gx+gy*gy)*100; }
  var R=4;
  for(var y2=R;y2<hh-R;y2++) for(var x2=R;x2<w-R;x2++){ var c2=D(x2,y2); if(isNaN(c2)||c2<5||c2>250) continue; var isMin=true, ring=0, rn=0, bad=false;
    for(var dy=-R;dy<=R&&isMin;dy++) for(var dx=-R;dx<=R;dx++){ if(!dx&&!dy) continue; var v=D(x2+dx,y2+dy); if(isNaN(v)){ bad=true; continue; } if(v<c2){ isMin=false; break; } if(Math.max(Math.abs(dx),Math.abs(dy))===R){ ring+=v; rn++; } }
    if(!isMin||bad||!rn) continue; var prom=ring/rn-c2; if(prom>=Math.max(6,0.15*c2)) peaks.push({x:x2,y:y2,d:c2,p:prom}); }
  peaks.sort(function(a,b){ return b.p-a.p; }); var keep=[]; peaks.forEach(function(p){ if(keep.length<14&&!keep.some(function(k){ return Math.abs(k.x-p.x)<7&&Math.abs(k.y-p.y)<7; })) keep.push(p); });
  return {S:S,peaks:keep}; }
function ll(g,x,y){ return [g.y0+g.dy*(y+0.5),g.x0+g.dx*(x+0.5)]; }
function scol(s){ return s>=25?[214,58,58]:s>=12?[240,140,48]:[255,210,63]; }
var PC=null, PCg=null, PCn=0, visNow=false;
function gridImg(){ if(PC&&PCg===G) return PC; var g=G, pc=document.createElement('canvas'); pc.width=g.w; pc.height=g.h; var px=pc.getContext('2d'), im=px.createImageData(g.w,g.h), dd=im.data, n=0;
  for(var i=0;i<g.w*g.h;i++){ var s=A.S[i]; if(!(s>=5)) continue; var co=scol(s), o=i*4; dd[o]=co[0]; dd[o+1]=co[1]; dd[o+2]=co[2]; dd[o+3]=Math.round(255*Math.min(0.78,0.35+(s-5)/40)); n++; }
  px.putImageData(im,0,0); PC=pc; PCg=G; PCn=n; return pc; }
function paintTile(c,P){ if(!visNow||!G||!A) return; var g=G, p0=P(g.y0,g.x0), p1=P(g.y0+g.dy*g.h,g.x0+g.dx*g.w); c.imageSmoothingEnabled=true; c.drawImage(gridImg(),0,0,g.w,g.h,p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]); }
function draw(){
  if(!ensure()) return; grp.clearLayers();
  visNow=!!(on&&G&&A&&document.body.classList.contains('mapon'));
  if(!visNow){ cv.show(false); if(map&&map.hasLayer(grp)) map.removeLayer(grp); legend(null); return; }
  /* πλέγμα σε μικρό καμβά → τεντώνεται στις γωνίες του σε κάθε πλακίδιο (σε ζουμ ≥ 11 η παραμόρφωση Mercator είναι αμελητέα) */
  var g=G; gridImg(); var n=PCn;
  A.peaks.forEach(function(p){ var q=ll(g,p.x,p.y); L.marker(q,{interactive:true,keyboard:false,icon:L.divIcon({className:'mk peak',iconSize:null,html:'<i>▲</i><b>'+Math.round(p.d)+' m</b>'})})
    .on('click',function(){ B.toast(T('Ύψωμα στον βυθό: κορυφή ~','Seabed rise: top ~')+Math.round(p.d)+T(' m, ~',' m, ~')+Math.round(p.p)+T(' m ρηχότερα από τον γύρω βυθό.',' m shallower than the seabed around it.'),7000); }).addTo(grp); });
  if(!map.hasLayer(grp)) grp.addTo(map);
  if(cv.shown()) cv.repaint(); else cv.show(true); legend({n:n,peaks:A.peaks.length}); }
function legend(info){
  if(!info){ if(legEl) legEl.hidden=true; return; }
  if(!legEl){ legEl=h('div',{class:'sbleg',role:'note'}); document.body.append(legEl); }
  legEl.hidden=false; legEl.replaceChildren(h('b',{text:T('Δομή βυθού','Seabed structure')}),
    h('span',{class:'sbk'},h('i',{style:'background:#ffd23f'}),T('ήπιο','gentle')),h('span',{class:'sbk'},h('i',{style:'background:#f08c30'}),T('απότομο','steep')),h('span',{class:'sbk'},h('i',{style:'background:#d63a3a'}),T('πολύ απότομο','very steep')),
    h('span',{class:'sbk'},h('em',{text:'▲'}),T('ύψωμα','rise')),
    h('small',{hidden:!!(info.n||info.peaks),text:T('Επίπεδος βυθός σε αυτή την περιοχή.','Flat seabed in this area.')})); }
function msg(t){ if(!legEl){ legEl=h('div',{class:'sbleg',role:'note'}); document.body.append(legEl); } legEl.hidden=false; legEl.replaceChildren(h('b',{text:T('Δομή βυθού','Seabed structure')}),h('small',{text:t})); }
function refresh(){
  if(!on||!ensure()) { draw(); return; } if(!document.body.classList.contains('mapon')) return;
  if(map.getZoom()<11){ G=null; A=null; draw(); msg(T('Κάνε ζουμ (11+) για να δεις drop-offs και υψώματα.','Zoom in (11+) to see drop-offs and rises.')); return; }
  var b=map.getBounds(), pw=(b.getEast()-b.getWest())*0.5, ph=(b.getNorth()-b.getSouth())*0.5, /* 1.14.5: μισή οθόνη γύρω-γύρω, για να υπάρχει βυθός όταν σέρνεις */ bb={w:b.getWest()-pw,s:b.getSouth()-ph,e:b.getEast()+pw,n:b.getNorth()+ph};
  var k=[bb.w,bb.s,bb.e,bb.n].map(function(v){ return v.toFixed(3); }).join(','); if((k===key||(G&&GB&&b.getWest()-pw/2>=GB.w&&b.getEast()+pw/2<=GB.e&&b.getSouth()-ph/2>=GB.s&&b.getNorth()+ph/2<=GB.n&&map.getZoom()===GZ))&&G){ draw(); return; }
  if(busy) return; busy=true; msg(T('Φόρτωση βυθού…','Loading seabed…'));
  var res=Math.max(1/960,(bb.e-bb.w)/340);
  loadBathy().then(function(){ if(!window.AlkyonBathy) throw new Error('nobathy'); return window.AlkyonBathy.fetchGrid(bb,res); }).then(function(g){ key=k; G=g; GB=bb; GZ=map.getZoom(); A=analyze(g); draw(); })
    .catch(function(){ msg(T('Τα βάθη δεν φορτώθηκαν. Χρειάζεται σύνδεση.','Depths did not load. Needs a connection.')); }).then(function(){ busy=false; }); }
B.seabed={on:function(){ return on; },set:function(v){ on=!!v; ls.set(KEY,on); if(on) refresh(); else draw(); try{ window.dispatchEvent(new Event('alkyon-wxchange')); }catch(e){} },
  analyze:analyze,_inject:function(g){ key='inj'; G=g; A=analyze(g); draw(); }};
B.seabedAt=function(lat,lon){ if(!on||!G||!A) return null; var x=Math.floor((lon-G.x0)/G.dx), y=Math.floor((lat-G.y0)/G.dy); if(x<1||y<1||x>=G.w-1||y>=G.h-1) return null; var dpt=G.data[y*G.w+x]; return dpt>0?{depth:dpt,slope:A.S[y*G.w+x]||0}:null; };
new MutationObserver(function(){ if(on) setTimeout(refresh,300); }).observe(document.body,{attributes:true,attributeFilter:['class']});
setTimeout(function(){ if(on) refresh(); },3500);
})();
