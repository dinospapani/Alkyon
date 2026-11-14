/* Alkyon 4 · Ρηχά νερά και ξέρες (όπως η σκίαση ρηχών στους ναυτικούς χάρτες)
   1.13.4: από το πλέγμα βάθους EMODnet: σκίαση 0–2 / 2–5 / 5–10 m (κουκκίδες κάτω από 5 m) και ⚠ στις ξέρες ≤ 10 m που δεν ακουμπούν στην ακτή.
   1.13.6: σε σταθερά κομμάτια 0,25° που κρατιούνται στο κινητό (Cache Storage): δεν ξαναφορτώνει σε κάθε μετακίνηση και δουλεύει
           και χωρίς σύνδεση όπου έχεις ήδη δει. + ξέρες, βράχοι και ναυάγια από το OpenStreetMap (seamarks, shoals.js), με βάθος όπου υπάρχει.
   Ενδεικτικό: δεν είναι ναυτικός χάρτης και δεν αντικαθιστά βυθόμετρο. */
(function(){
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var KEY='alkyon-v4-shallow', on=!!ls.get(KEY,false), map=null, cv=null, grp=null, busy=0, mt=0, legEl=null;
var LIM=10, TS=0.25, RES=1/960, CN='alkyon-shallow-v1', TILES={}, PEND={}, SH=null, shP=null;
function M(){ return window.AlkyonCore&&window.AlkyonCore.map&&window.AlkyonCore.map(); }
function pane(){ var p=map.getPane('shPane')||map.createPane('shPane'); p.style.zIndex='338'; p.style.pointerEvents='none'; return p; }
function pin(c){ try{ L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0])); }catch(e){} }
function loadBathy(){ return window.AlkyonBathy?Promise.resolve():new Promise(function(res){ var s=document.createElement('script'); s.src='../bathy-lines.js'; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
function loadShoals(){ if(SH) return Promise.resolve(SH); if(shP) return shP; shP=(window.ALKYON_SHOALS?Promise.resolve():new Promise(function(res){ var s=document.createElement('script'); s.src='../shoals.js'; s.onload=res; s.onerror=res; document.head.appendChild(s); })).then(function(){ SH=window.ALKYON_SHOALS||[]; return SH; }); return shP; }
function ensure(){ var m=M(); if(!m) return false; if(m!==map){ map=m; cv=null;
    map.on('moveend zoomend',function(){ clearTimeout(mt); mt=setTimeout(refresh,250); }); }
  /* 1.14.5: πλακίδια που κινούνται μαζί με τον χάρτη (όχι ένας καμβάς στο μέγεθος της οθόνης) */
  if(!cv){ pane(); cv=B.ovTiles(map,'shPane',paintTile); }
  if(!grp) grp=L.layerGroup(); return true; }
/* ---------- ξέρες από το πλέγμα: ρηχά κελιά (≤ LIM) που δεν ακουμπούν σε ξηρά ή κενό ---------- */
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
/* ---------- κομμάτια 0,25° με μνήμη στο κινητό ---------- */
function tkey(i,j){ return i+'_'+j; }
function pack(g){ var q=new Int16Array(g.data.length); for(var i=0;i<q.length;i++){ var v=g.data[i]; q[i]=v>0?Math.min(32000,Math.round(v*10)):(v<0?-1:0); } return {w:g.w,h:g.h,x0:g.x0,y0:g.y0,dx:g.dx,dy:g.dy,q:q}; }
function unpack(o){ var d=new Float32Array(o.q.length); for(var i=0;i<d.length;i++) d[i]=o.q[i]>0?o.q[i]/10:(o.q[i]<0?-1:0); return {w:o.w,h:o.h,x0:o.x0,y0:o.y0,dx:o.dx,dy:o.dy,data:d}; }
function cacheGet(k){ try{ if(!window.caches) return Promise.resolve(null); return caches.open(CN).then(function(c){ return c.match('/__sh/'+k); }).then(function(r){ if(!r) return null; return r.arrayBuffer().then(function(b){ var hd=new Float64Array(b,0,6), q=new Int16Array(b.slice(48)); return unpack({w:hd[0],h:hd[1],x0:hd[2],y0:hd[3],dx:hd[4],dy:hd[5],q:q}); }); }).catch(function(){ return null; }); }catch(e){ return Promise.resolve(null); } }
function cachePut(k,g){ try{ if(!window.caches) return; var p=pack(g), b=new ArrayBuffer(48+p.q.byteLength); new Float64Array(b,0,6).set([p.w,p.h,p.x0,p.y0,p.dx,p.dy]); new Int16Array(b,48).set(p.q);
    caches.open(CN).then(function(c){ return c.put('/__sh/'+k,new Response(b,{headers:{'content-type':'application/octet-stream'}})); }).catch(function(){}); }catch(e){} }
function tile(i,j){ var k=tkey(i,j); if(TILES[k]) return Promise.resolve(TILES[k]); if(PEND[k]) return PEND[k];
  PEND[k]=cacheGet(k).then(function(g){ if(g) return g; var b={w:+(i*TS).toFixed(4),s:+(j*TS).toFixed(4),e:+((i+1)*TS).toFixed(4),n:+((j+1)*TS).toFixed(4)};
      return loadBathy().then(function(){ if(!window.AlkyonBathy) throw new Error('nobathy'); return window.AlkyonBathy.fetchGrid(b,RES); }).then(function(gg){ cachePut(k,gg); return gg; }); })
    .then(function(g){ var t={g:g,a:analyze(g),img:null}; TILES[k]=t; delete PEND[k]; return t; },function(e){ delete PEND[k]; throw e; });
  return PEND[k]; }
function need(){ var b=map.getBounds().pad(.35), out=[]; for(var i=Math.floor(b.getWest()/TS);i<=Math.floor(b.getEast()/TS);i++) for(var j=Math.floor(b.getSouth()/TS);j<=Math.floor(b.getNorth()/TS);j++) out.push([i,j]); return out; }
/* ---------- σχεδίαση ---------- */
function sat(){ var v=ls.get('alkyon-v4-map',null); return !v||v.base!=='osm'; }
function band(v){ return v<=2?0:v<=5?1:2; }
/* 1.13.8: με ανοιχτό χρώμα καιρού (κύμα, άνεμος) τα μπλε χάνονται μέσα στα χρώματα· τότε λευκά, πιο έντονα και με περίγραμμα */
function wxOn(){ return [].some.call(document.querySelectorAll('canvas.wxfill'),function(c){ return c.style.opacity!=='0'&&c.width>0; }); }
function tileImg(t,S){ var W=wxOn(), key=S+(W?'w':''); if(t.img&&t.imgS===key) return t.img; var g=t.g, col=W?[[255,255,255,.9],[230,242,255,.7],[205,225,250,.48]]:S?[[170,245,255,.74],[80,200,250,.56],[35,135,225,.40]]:[[20,95,195,.62],[45,125,210,.46],[95,160,225,.30]]; /* 1.14.8: πιο έντονα και πιο διακριτά */
  var pc=document.createElement('canvas'); pc.width=g.w; pc.height=g.h; var px=pc.getContext('2d'), im=px.createImageData(g.w,g.h), dd=im.data;
  for(var i=0;i<g.w*g.h;i++){ var v=g.data[i]; if(!(v>0&&v<=LIM)) continue; var k=col[band(v)], o=i*4; dd[o]=k[0]; dd[o+1]=k[1]; dd[o+2]=k[2]; dd[o+3]=Math.round(255*k[3]); }
  px.putImageData(im,0,0); t.img=pc; t.imgS=key; return pc; }
var KIND={r:T('βράχος κάτω από το νερό','submerged rock'),a:T('βράχος στην επιφάνεια','rock awash'),c:T('βράχος που σκεπάζεται','rock that covers'),R:T('βράχος','rock'),w:T('ναυάγιο','wreck'),o:T('εμπόδιο','obstruction'),f:T('ύφαλος','reef'),s:T('ξέρα','shoal')};
function kind(c){ return KIND[c]||T('ξέρα','shoal'); }
function shoalMk(lat,lon,dep,src,nm){ var lbl=dep!=null?((dep<1?'<1':Math.round(dep))+' m'):'';
  return L.marker([lat,lon],{keyboard:false,icon:L.divIcon({className:'mk shoal'+(src==='osm'?' osm':''),iconSize:null,html:'<i>⚠</i>'+(lbl?'<b>'+lbl.replace(/</g,'&lt;')+'</b>':'')})})
    .on('click',function(){ B.toast(src==='osm'?(T('Από το OpenStreetMap: ','From OpenStreetMap: ')+(nm||T('ξέρα / βράχος','shoal / rock'))+(dep!=null?T(' · βάθος ~',' · depth ~')+dep+' m':'')+T(' (σήμα χάρτη, ενδεικτικό).',' (chart mark, indicative).')):(T('Ξέρα μακριά από την ακτή: ελάχιστο βάθος ~','Offshore shoal: minimum depth ~')+(dep<1?'<1':Math.round(dep))+T(' m (EMODnet, ενδεικτικό· μπορεί να είναι πιο ρηχή).',' m (EMODnet, indicative; it may be shallower).')),8000); }); }
/* 1.14.8: ισοβαθείς 10 / 5 / 2 m (όπως οι γραμμές στους ναυτικούς χάρτες), από το ίδιο πλέγμα, σε ενιαίο πλέγμα όλου του χάρτη
   ώστε οι γραμμές να συνεχίζουν από πλακίδιο σε πλακίδιο. Στεριά = 0 m, άρα η γραμμή των 10 m κλείνει μέσα της τα ρηχά και τις ξέρες. */
function dAt(gx,gy){ var lon=(gx+0.5)*RES, lat=(gy+0.5)*RES, t=TILES[tkey(Math.floor(lon/TS),Math.floor(lat/TS))]; if(!t) return NaN; var g=t.g, x=Math.floor((lon-g.x0)/g.dx), y=Math.floor((lat-g.y0)/g.dy); if(x<0||y<0||x>=g.w||y>=g.h) return NaN; var v=g.data[y*g.w+x]; return v>0?v:0; }
var MS={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[0,2]],10:[[0,1],[2,3]],11:[[1,2]],12:[[3,1]],13:[[0,1]],14:[[3,0]]};
function contours(c,P,U,N,W,S){ var sw=U(0,N), ne=U(N,0), gx0=Math.floor(sw.lng/RES)-1, gx1=Math.ceil(ne.lng/RES)+1, gy0=Math.floor(sw.lat/RES)-1, gy1=Math.ceil(ne.lat/RES)+1, w=gx1-gx0+1, hh=gy1-gy0+1;
  if(w*hh>120000) return; var V=new Float32Array(w*hh), X=new Float64Array(w), Y=new Float64Array(hh), any=false;
  for(var j=0;j<hh;j++) for(var i=0;i<w;i++){ var v=dAt(gx0+i,gy0+j); V[j*w+i]=v; if(v>0&&v<=LIM) any=true; }
  if(!any) return; var la0=(gy0+0.5)*RES, lo0=(gx0+0.5)*RES;
  for(i=0;i<w;i++) X[i]=P(la0,(gx0+i+0.5)*RES)[0]; for(j=0;j<hh;j++) Y[j]=P((gy0+j+0.5)*RES,lo0)[1];
  var col=W?'10,40,80':S?'255,255,255':'15,60,130';
  [[10,1.7,.95,null],[5,1.15,.8,null],[2,1,.7,[3,3]]].forEach(function(LV){ var L0=LV[0]; c.beginPath();
    for(var j2=0;j2<hh-1;j2++) for(var i2=0;i2<w-1;i2++){ var a=V[j2*w+i2], b=V[j2*w+i2+1], cc=V[(j2+1)*w+i2+1], d=V[(j2+1)*w+i2]; if(a!==a||b!==b||cc!==cc||d!==d||!a||!b||!cc||!d) continue; /* όχι πάνω στην ακτή: εκεί θα έπεφταν και οι τρεις γραμμές μαζί */
      var k=(a<L0?1:0)|(b<L0?2:0)|(cc<L0?4:0)|(d<L0?8:0), sg=MS[k]; if(!sg) continue;
      for(var q=0;q<sg.length;q++){ var e=sg[q];
        for(var r=0;r<2;r++){ var ed=e[r], px, py, t;
          if(ed===0){ t=(L0-a)/(b-a); px=X[i2]+(X[i2+1]-X[i2])*t; py=Y[j2]; }
          else if(ed===1){ t=(L0-b)/(cc-b); px=X[i2+1]; py=Y[j2]+(Y[j2+1]-Y[j2])*t; }
          else if(ed===2){ t=(L0-d)/(cc-d); px=X[i2]+(X[i2+1]-X[i2])*t; py=Y[j2+1]; }
          else { t=(L0-a)/(d-a); px=X[i2]; py=Y[j2]+(Y[j2+1]-Y[j2])*t; }
          if(r===0) c.moveTo(px,py); else c.lineTo(px,py); } } }
    c.setLineDash(LV[3]||[]); c.lineWidth=LV[1]; c.lineJoin='round'; c.lineCap='round'; c.strokeStyle='rgba('+col+','+LV[2]+')';
    if(S&&!W){ c.save(); c.lineWidth=LV[1]+1.6; c.strokeStyle='rgba(0,30,60,.28)'; c.stroke(); c.restore(); }
    c.stroke(); }); c.setLineDash([]); }
var visNow=false;
function paintTile(c,P,U,N,co){
  if(!visNow) return; var S=sat(), sw=U(0,N), ne=U(N,0);
  for(var i=Math.floor(sw.lng/TS);i<=Math.floor(ne.lng/TS);i++) for(var j=Math.floor(sw.lat/TS);j<=Math.floor(ne.lat/TS);j++){ var t=TILES[tkey(i,j)]; if(!t) continue;
    var g=t.g, p0=P(g.y0,g.x0), p1=P(g.y0+g.dy*g.h,g.x0+g.dx*g.w); c.imageSmoothingEnabled=true; c.drawImage(tileImg(t,S),0,0,g.w,g.h,p0[0],p0[1],p1[0]-p0[0],p1[1]-p0[1]); }
  var WX=wxOn(); contours(c,P,U,N,WX,S);
  /* κουκκίδες στα 0–5 m (όπως οι ναυτικοί χάρτες), μία κάθε ~9 px, στοιχισμένες σε όλο τον χάρτη */
  c.fillStyle=WX?'rgba(10,40,80,.8)':S?'rgba(255,255,255,.75)':'rgba(10,50,110,.55)'; var step=9, ox=co.x*N, oy=co.y*N, y0=(step-oy%step)%step;
  for(var yy=y0;yy<N;yy+=step){ var row=Math.round((oy+yy)/step), off=row%2?step/2:0, x0=((off-ox)%step+step)%step;
    for(var xx=x0;xx<N;xx+=step){ var la=U(xx,yy), t2=TILES[tkey(Math.floor(la.lng/TS),Math.floor(la.lat/TS))]; if(!t2) continue; var g2=t2.g, gx=Math.floor((la.lng-g2.x0)/g2.dx), gy=Math.floor((la.lat-g2.y0)/g2.dy); if(gx<0||gy<0||gx>=g2.w||gy>=g2.h) continue; var vv=g2.data[gy*g2.w+gx]; if(vv>0&&vv<=5){ c.beginPath(); c.arc(xx,yy,1.1,0,6.283); c.fill(); } } } }
function draw(){
  if(!ensure()) return; grp.clearLayers();
  var vis=on&&document.body.classList.contains('mapon')&&map.getZoom()>=11, ts=vis?need().map(function(x){ return TILES[tkey(x[0],x[1])]; }).filter(Boolean):[];
  visNow=vis;
  if(!vis){ cv.show(false); if(map&&map.hasLayer(grp)) map.removeLayer(grp); if(!on||!document.body.classList.contains('mapon')) legend(null); return; }
  var n=0, placed=[];
  ts.forEach(function(t){ var g=t.g; n+=t.a.n; t.a.shoals.forEach(function(p){ var q=ll(g,p.x,p.y); placed.push(q); shoalMk(q[0],q[1],p.d,'emod').addTo(grp); }); });
  /* ξέρες, βράχοι, ναυάγια από το OpenStreetMap */
  var bd=map.getBounds().pad(.05); (SH||[]).forEach(function(s){ if(!bd.contains([s[0],s[1]])) return; if(placed.some(function(q){ return Math.abs(q[0]-s[0])<0.0015&&Math.abs(q[1]-s[1])<0.002; })) return; shoalMk(s[0],s[1],s[2],'osm',s[4]||kind(s[3])).addTo(grp); });
  names(bd);
  if(!map.hasLayer(grp)) grp.addTo(map);
  if(cv.shown()) cv.repaint(); else cv.show(true); legend({n:n}); }
/* 1.14.8: ονόματα της θάλασσας (νησάκια, βράχοι, ξέρες, κάβοι, κόλποι) από το OpenStreetMap (../sea-names.js) */
var SN=null, snP=null;
function loadNames(){ if(SN) return Promise.resolve(SN); if(snP) return snP; snP=(window.ALKYON_SEA_NAMES?Promise.resolve():new Promise(function(res){ var s2=document.createElement('script'); s2.src='../sea-names.js'; s2.onload=res; s2.onerror=res; document.head.appendChild(s2); })).then(function(){ SN=window.ALKYON_SEA_NAMES||[]; return SN; }); return snP; }
function nmZoom(k,e){ return k==='i'?(e>0.3?8:e>0.06?10:11):k==='l'?(e>0.01?11:12):k==='r'||k==='s'?13:k==='b'?(e>0.05?10:12):k==='t'?10:11; }
function names(bd){ if(!SN){ loadNames().then(function(){ if(SN&&SN.length) draw(); }); return; }
  var z=map.getZoom(), used={}, n=0;
  for(var i=0;i<SN.length&&n<70;i++){ var r=SN[i]; if(z<nmZoom(r[4],r[5])||!bd.contains([r[2],r[3]])) continue;
    var cp=map.latLngToContainerPoint([r[2],r[3]]), key=Math.floor(cp.x/110)+'_'+Math.floor(cp.y/26); if(used[key]) continue; used[key]=1; n++;
    var nm=EN&&r[1]?r[1]:r[0], big=r[4]==='i'&&r[5]>0.05;
    L.marker([r[2],r[3]],{interactive:false,keyboard:false,icon:L.divIcon({className:'snm k'+r[4]+(big?' big':''),iconSize:null,html:'<span>'+nm.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span>'})}).addTo(grp); } }
function legend(a){
  if(!a){ if(legEl) legEl.hidden=true; return; }
  if(!legEl){ legEl=h('div',{class:'sbleg shleg',role:'note'}); document.body.append(legEl); }
  var S=sat(), W=wxOn(); legEl.hidden=false; legEl.replaceChildren(h('b',{text:T('Ρηχά & ξέρες','Shallows & shoals')}),
    h('span',{class:'sbk'},h('i',{style:'background:'+(W?'#fff;outline:1px solid #0a2850':S?'#78dcff':'#1e6ec8')}),'0–2 m'),h('span',{class:'sbk'},h('i',{style:'background:'+(S?'#5abef0':'#3c8cd7')+';opacity:.75'}),'2–5 m'),h('span',{class:'sbk'},h('i',{style:'background:'+(S?'#46a0e6':'#6eafe6')+';opacity:.5'}),'5–10 m'),
    h('span',{class:'sbk'},h('em',{text:'⚠'}),T('ξέρα','shoal')),
    h('small',{text:busy?T('Φόρτωση βαθών… (μένουν στο κινητό)','Loading depths… (kept on your phone)'):a.n?T('Γραμμές: 10 m (έντονη), 5 m, 2 m (διακεκομμένη). Ενδεικτικά (EMODnet ~115 m, OpenStreetMap)· μικρές ξέρες μπορεί να λείπουν.','Lines: 10 m (bold), 5 m, 2 m (dashed). Indicative (EMODnet ~115 m, OpenStreetMap); small shoals may be missing.'):T('Δεν υπάρχουν ρηχά κάτω από 10 m εδώ.','No water shallower than 10 m here.')})); }
function msg(t){ if(!legEl){ legEl=h('div',{class:'sbleg shleg',role:'note'}); document.body.append(legEl); } legEl.hidden=false; legEl.replaceChildren(h('b',{text:T('Ρηχά & ξέρες','Shallows & shoals')}),h('small',{text:t})); }
var fails=0;
function refresh(){
  if(!on||!ensure()){ draw(); return; } if(!document.body.classList.contains('mapon')) return;
  loadShoals().then(function(){ draw(); });
  if(map.getZoom()<11){ draw(); msg(T('Κάνε ζουμ (11+) για να δεις τα ρηχά και τις ξέρες.','Zoom in (11+) to see shallows and shoals.')); return; }
  var miss=need().filter(function(x){ return !TILES[tkey(x[0],x[1])]; }).slice(0,24);
  draw(); if(!miss.length) return;
  busy++; legend({n:1});
  Promise.all(miss.map(function(x){ return tile(x[0],x[1]).then(draw).catch(function(){ fails++; }); })).then(function(){ busy--; draw();
    if(fails&&!Object.keys(TILES).length) msg(T('Τα βάθη δεν φορτώθηκαν. Χρειάζεται σύνδεση την πρώτη φορά.','Depths did not load. A connection is needed the first time.')); fails=0; }); }
B.shallows={on:function(){ return on; },set:function(v){ on=!!v; ls.set(KEY,on); if(on) refresh(); else draw(); try{ window.dispatchEvent(new Event('alkyon-wxchange')); }catch(e){} },
  analyze:analyze,_tiles:TILES,pack:pack,unpack:unpack,
  /* 1.13.8: για το seafloor.js (ανάγλυφο, ζώνη βάθους): ίδια κομμάτια και ίδια μνήμη */
  tile:tile,need:function(m){ var mm=map; map=m||map; try{ return need(); } finally{ map=mm||map; } }};
new MutationObserver(function(){ if(on) setTimeout(refresh,300); }).observe(document.body,{attributes:true,attributeFilter:['class']});
var wxLast=null; setInterval(function(){ if(!on) return; var w=wxOn(); if(w!==wxLast){ wxLast=w; draw(); } },1500);
setTimeout(function(){ if(on) refresh(); },3500);
})();
