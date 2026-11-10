/* Alkyon 4 · Χάρτης › «Ο βυθός μου» (1.10.12)
   Τα βάθη από το βυθόμετρό σου (ζωντανά μέσω Signal K ή από αρχείο, v4/sounder.js) σε χρωματιστά τετράγωνα ~20 m:
   ανοιχτό = ρηχά, σκούρο = βαθιά. Σε μεγάλο ζουμ γράφει και το βάθος. Πάτημα κοντά σε κελί: μέσο, ελάχιστο, μέγιστο, πόσες μετρήσεις.
   Όσο είναι συνδεδεμένο το βυθόμετρο, μια ετικέτα πάνω αριστερά δείχνει το βάθος τώρα. */
(function(){
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var KEY='alkyon-v4-mydepth', on=!!ls.get(KEY,false), map=null, cv=null, cells=[], busy=false, mt=0, legEl=null, chip=null, maxD=50, minD=0;
function M(){ return window.AlkyonCore&&window.AlkyonCore.map&&window.AlkyonCore.map(); }
function pane(){ var p=map.getPane('mdPane')||map.createPane('mdPane'); p.style.zIndex='341'; p.style.pointerEvents='none'; return p; }
function pin(c){ try{ L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0])); }catch(e){} }
function ensure(){ var m=M(); if(!m) return false; if(m!==map){ map=m; cv=null;
    map.on('movestart zoomstart',function(){ if(cv) cv.style.opacity='0'; });
    map.on('move',function(){ if(cv) pin(cv); });
    map.on('moveend zoomend',function(){ clearTimeout(mt); mt=setTimeout(refresh,300); });
    map.on('click',tap); fit(); }
  if(!cv){ cv=document.createElement('canvas'); cv.setAttribute('aria-hidden','true'); cv.style.cssText='position:absolute;left:0;top:0;pointer-events:none;transition:opacity .25s'; pane().appendChild(cv); }
  return true; }
function fit(){ var f=ls.get('alkyon-v4-mydepth-fit',null); if(!f||!map) return; ls.set('alkyon-v4-mydepth-fit',null); try{ map.fitBounds([[f[0],f[1]],[f[2],f[3]]],{padding:[40,40],maxZoom:16}); }catch(e){} }
/* ρηχά → βαθιά: γαλάζιο → μπλε → σκούρο μωβ */
var STOPS=[[0,[178,240,232]],[0.15,[94,205,214]],[0.35,[44,150,206]],[0.6,[38,88,178]],[0.85,[52,46,128]],[1,[30,20,70]]];
function col(d){ var x=maxD>minD?Math.max(0,Math.min(1,(d-minD)/(maxD-minD))):0.5; /* ανάμεσα στο ρηχότερο και το βαθύτερο που φαίνεται, για αντίθεση */ for(var i=1;i<STOPS.length;i++){ if(x<=STOPS[i][0]){ var a=STOPS[i-1], b=STOPS[i], k=(x-a[0])/(b[0]-a[0]); return [0,1,2].map(function(j){ return Math.round(a[1][j]+(b[1][j]-a[1][j])*k); }); } } return STOPS[STOPS.length-1][1]; }
function fmt(d){ var U=window.AlkyonUnits; return U&&U.depth?U.depth(d):(Math.round(d)+' m'); }
function short(d){ var U=window.AlkyonUnits, p=U&&U.depthP?U.depthP(Math.round(d)):null; return p?p[0]:String(Math.round(d)); }
function draw(){
  if(!ensure()) return; var sz=map.getSize(), dpr=Math.min(window.devicePixelRatio||1,2); cv.width=Math.round(sz.x*dpr); cv.height=Math.round(sz.y*dpr); cv.style.width=sz.x+'px'; cv.style.height=sz.y+'px'; pin(cv);
  var c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,sz.x,sz.y);
  if(!on||!document.body.classList.contains('mapon')){ cv.style.opacity='0'; legend(null); return; }
  if(map.getZoom()<12){ cv.style.opacity='0'; legend(cells.length?T('Κάνε ζουμ (12+) για τα βάθη σου.','Zoom in (12+) to see your depths.'):''); return; }
  var CELL=0.0002, z=map.getZoom(), labels=z>=17;
  cells.forEach(function(q){ var a=map.latLngToContainerPoint([q.lat-CELL/2,q.lon-CELL/2]), b=map.latLngToContainerPoint([q.lat+CELL/2,q.lon+CELL/2]);
    var x=Math.min(a.x,b.x), y=Math.min(a.y,b.y), w=Math.max(2,Math.abs(b.x-a.x)), hh=Math.max(2,Math.abs(b.y-a.y)); if(x>sz.x||y>sz.y||x+w<0||y+hh<0) return;
    var k=col(q.d); c.fillStyle='rgba('+k[0]+','+k[1]+','+k[2]+',0.82)'; c.fillRect(x,y,w+0.5,hh+0.5); });
  if(labels){ c.font='600 11px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; var used=[];
    cells.forEach(function(q){ var p=map.latLngToContainerPoint([q.lat,q.lon]); if(p.x<0||p.y<0||p.x>sz.x||p.y>sz.y) return; if(used.some(function(u){ return Math.abs(u[0]-p.x)<30&&Math.abs(u[1]-p.y)<16; })) return; used.push([p.x,p.y]);
      var t=short(q.d); c.lineWidth=3; c.strokeStyle='rgba(0,0,0,.55)'; c.strokeText(t,p.x,p.y); c.fillStyle='#fff'; c.fillText(t,p.x,p.y); }); }
  cv.style.opacity='1'; legend(cells.length?null:T('Δεν έχεις βάθη εδώ ακόμα.','No depths of yours here yet.'),true); }
function legend(msg,show){
  if(!on||!document.body.classList.contains('mapon')){ if(legEl) legEl.hidden=true; return; }
  if(!legEl){ legEl=h('div',{class:'sbleg mdleg',role:'note'}); document.body.append(legEl); }
  legEl.hidden=false; var g='linear-gradient(90deg,'+[0,0.15,0.35,0.6,0.85,1].map(function(x){ var k=col(minD+x*(maxD-minD)); return 'rgb('+k.join(',')+')'; }).join(',')+')';
  legEl.replaceChildren(h('b',{text:T('Ο βυθός μου','My depths')}),
    msg?h('small',{text:msg}):h('span',{class:'mdbar'},h('em',{text:short(minD)}),h('i',{style:'background:'+g}),h('em',{text:short(maxD)+' '+(window.AlkyonUnits&&window.AlkyonUnits.depthUnit?window.AlkyonUnits.depthUnit():'m')}))); }
function refresh(){ if(!on||!ensure()||!B.sounder){ draw(); return; } if(!document.body.classList.contains('mapon')) return; if(map.getZoom()<12){ draw(); return; }
  if(busy) return; busy=true; var b=map.getBounds();
  B.sounder.cellsIn(b.getSouth(),b.getWest(),b.getNorth(),b.getEast()).then(function(list){ cells=list; var ds=list.map(function(q){ return q.d; }).sort(function(a,b){ return a-b; }); minD=ds.length?ds[Math.floor(ds.length*0.03)]:0; maxD=ds.length?(ds[Math.floor(ds.length*0.97)]||ds[ds.length-1]):50; if(maxD-minD<4){ var mid=(maxD+minD)/2; minD=Math.max(0,mid-2); maxD=mid+2; } draw(); })
    .catch(function(){}).then(function(){ busy=false; }); }
function tap(e){ if(!on||!cells.length||map.getZoom()<12) return; var p=e.latlng, best=null, bd=1e9; cells.forEach(function(q){ var dy=(q.lat-p.lat)*111320, dx=(q.lon-p.lng)*111320*Math.cos(p.lat*Math.PI/180), m=dx*dx+dy*dy; if(m<bd){ bd=m; best=q; } });
  if(!best||bd>30*30) return; B.toast(T('Ο βυθός μου: ','My depths: ')+fmt(best.d)+(best.n>1?' ('+fmt(best.mn)+' – '+fmt(best.mx)+', '+best.n+T(' μετρήσεις)',' readings)'):'')+(best.wt!=null?' · '+String(best.wt)+' °C':''),6000); }
/* ζωντανό βάθος πάνω αριστερά στον χάρτη */
function paintChip(){ var s=B.sounder&&B.sounder.state(), d=B.sounder&&B.sounder.live(), show=d!=null&&document.body.classList.contains('mapon');
  if(!show){ if(chip) chip.hidden=true; return; } if(!chip){ chip=h('button',{type:'button',class:'sndchip','aria-live':'polite',onclick:function(){ if(B.sounder) B.sounder.sheet(); }}); document.body.append(chip); }
  chip.hidden=false; chip.replaceChildren(h('small',{text:T('Βυθός','Depth')}),h('b',{text:fmt(d)}),s.wt!=null?h('small',{text:s.wt.toFixed(1)+' °C'}):null); }
window.addEventListener('alkyon-sounder',paintChip);
window.addEventListener('alkyon-mydepth',function(){ if(on){ clearTimeout(mt); mt=setTimeout(refresh,800); } });
B.mydepth={on:function(){ return on; },set:function(v){ on=!!v; ls.set(KEY,on); if(on) refresh(); else draw(); try{ window.dispatchEvent(new Event('alkyon-wxchange')); }catch(e){} },col:col,_cells:function(){ return cells; }};
new MutationObserver(function(){ paintChip(); if(on) setTimeout(refresh,300); else if(legEl) legEl.hidden=true; }).observe(document.body,{attributes:true,attributeFilter:['class']});
setTimeout(function(){ paintChip(); if(on) refresh(); },3000);
})();
