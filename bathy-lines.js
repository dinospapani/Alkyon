/* Πυκνές γραμμές βάθους (5, 10, 20 m) από το πλέγμα βαθών EMODnet (~125 m), φτιαγμένες μέσα στην εφαρμογή.
   Πηγή: EMODnet Bathymetry (https://emodnet.ec.europa.eu), μέσω WCS. Ενδεικτικά: δεν είναι ναυτικός χάρτης και δεν αντικαθιστά βυθόμετρο.
   Το πλέγμα είναι μέσος όρος ~125 m, άρα οι γραμμές είναι γενικευμένες και μπορεί να λείπουν μικρά ύφαλα. */
(function(){
'use strict';
var C=window.AlkyonCore, map=C&&C.map&&C.map();
if(!C||!map||typeof L==='undefined') return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-dl', WCS='https://ows.emodnet-bathymetry.eu/wcs', CELL=1/960, MAXCELLS=520, MINZOOM=11, MAXLEVELS=60;
var mode=String(C.lsGet(KEY,'std')); if(['std','5','10','20'].indexOf(mode)<0) mode='std';
var dm=0, group=L.layerGroup(), rend=L.canvas({padding:.2}), grid=null, cache=[], timer=null, ctl=null, seq=0, failedToast=0;

/* ---------- GeoTIFF (float32, χωρίς συμπίεση, tiles ή strips) ---------- */
function parseTiff(buf){
  var dv=new DataView(buf), le=dv.getUint16(0)===0x4949; if(!le&&dv.getUint16(0)!==0x4d4d) throw new Error('tiff');
  if(dv.getUint16(2,le)!==42) throw new Error('tiff magic');
  var ifd=dv.getUint32(4,le), n=dv.getUint16(ifd,le), tg={};
  var SZ={1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8,16:8};
  for(var i=0;i<n;i++){
    var o=ifd+2+i*12, tag=dv.getUint16(o,le), typ=dv.getUint16(o+2,le), cnt=dv.getUint32(o+4,le), size=(SZ[typ]||1)*cnt, p=size<=4?o+8:dv.getUint32(o+8,le), vals=[];
    if(typ===3) for(var k=0;k<cnt;k++) vals.push(dv.getUint16(p+k*2,le));
    else if(typ===4) for(k=0;k<cnt;k++) vals.push(dv.getUint32(p+k*4,le));
    else if(typ===12) for(k=0;k<cnt;k++) vals.push(dv.getFloat64(p+k*8,le));
    else if(typ===2){ var s=''; for(k=0;k<cnt;k++){ var ch=dv.getUint8(p+k); if(ch) s+=String.fromCharCode(ch); } vals=[s]; }
    else if(typ===16) for(k=0;k<cnt;k++) vals.push(Number(dv.getBigUint64(p+k*8,le)));
    tg[tag]=vals;
  }
  var w=tg[256][0], h=tg[257][0], bits=(tg[258]||[32])[0], comp=(tg[259]||[1])[0], fmt=(tg[339]||[3])[0];
  if(comp!==1||bits!==32||fmt!==3) throw new Error('tiff format');
  var data=new Float32Array(w*h);
  if(tg[324]){
    var tw=tg[322][0], th=tg[323][0], tx=Math.ceil(w/tw), offs=tg[324];
    for(var t=0;t<offs.length;t++){
      var ox=(t%tx)*tw, oy=Math.floor(t/tx)*th;
      for(var y=0;y<th&&oy+y<h;y++) for(var x=0;x<tw&&ox+x<w;x++) data[(oy+y)*w+ox+x]=dv.getFloat32(offs[t]+(y*tw+x)*4,le);
    }
  } else {
    var rps=(tg[278]||[h])[0], so=tg[273], row=0;
    for(var si=0;si<so.length;si++) for(var r=0;r<rps&&row<h;r++,row++) for(x=0;x<w;x++) data[row*w+x]=dv.getFloat32(so[si]+(r*w+x)*4,le);
  }
  var x0,y0,dx,dy, M=tg[34264], S=tg[33550], P=tg[33922];
  if(M&&M.length>=8){ dx=M[0]; x0=M[3]; dy=M[5]; y0=M[7]; }
  else if(S&&P){ dx=S[0]; dy=-S[1]; x0=P[3]; y0=P[4]; }
  else throw new Error('georef');
  var nod=tg[42113]?parseFloat(tg[42113][0]):null;
  return {w:w,h:h,data:data,x0:x0,y0:y0,dx:dx,dy:dy,nodata:nod};
}

/* ---------- ισοβαθείς (marching squares) ---------- */
function blur(g){
  var w=g.w,h=g.h,a=g.data,b=new Float32Array(a);
  for(var y=1;y<h-1;y++) for(var x=1;x<w-1;x++){
    var s=0,c=0,ok=true;
    for(var j=-1;j<=1&&ok;j++) for(var i=-1;i<=1;i++){ var v=a[(y+j)*w+x+i]; if(!(v>0)){ ok=false; break; } s+=v; c++; }
    if(ok) b[y*w+x]=s/c;
  }
  g.data=b;
}
function contour(g,lv){
  var w=g.w,h=g.h,z=g.data, segs=[];
  function ip(a,b){ return (lv-a)/(b-a); }
  for(var y=0;y<h-1;y++) for(var x=0;x<w-1;x++){
    var a=z[y*w+x], b=z[y*w+x+1], c=z[(y+1)*w+x+1], d=z[(y+1)*w+x];
    if(!(a>0)||!(b>0)||!(c>0)||!(d>0)) continue; /* δεν διασχίζουμε ξηρά ή κενά */
    var idx=(a>=lv?8:0)|(b>=lv?4:0)|(c>=lv?2:0)|(d>=lv?1:0);
    if(idx===0||idx===15) continue;
    /* ακμές: T (a-b), R (b-c), B (d-c), Lf (a-d) */
    var T_={k:(y*w+x)*2,   x:x+ip(a,b),y:y}, R_={k:(y*w+x+1)*2+1, x:x+1,y:y+ip(b,c)}, B_={k:((y+1)*w+x)*2, x:x+ip(d,c),y:y+1}, L_={k:(y*w+x)*2+1, x:x,y:y+ip(a,d)};
    var e=[];
    switch(idx){
      case 1: case 14: e=[[L_,B_]]; break;
      case 2: case 13: e=[[B_,R_]]; break;
      case 3: case 12: e=[[L_,R_]]; break;
      case 4: case 11: e=[[T_,R_]]; break;
      case 6: case 9: e=[[T_,B_]]; break;
      case 7: case 8: e=[[L_,T_]]; break;
      case 5: case 10: { var m=(a+b+c+d)/4; if((m>=lv)===(idx===5)) e=[[L_,T_],[B_,R_]]; else e=[[L_,B_],[T_,R_]]; } break;
    }
    for(var q=0;q<e.length;q++) segs.push(e[q]);
  }
  /* ένωση τμημάτων σε γραμμές */
  var map_={}, used=new Array(segs.length), chains=[];
  segs.forEach(function(s,i){ (map_[s[0].k]=map_[s[0].k]||[]).push(i); (map_[s[1].k]=map_[s[1].k]||[]).push(i); });
  function nextFrom(k){ var l=map_[k]; if(!l) return -1; for(var i=0;i<l.length;i++) if(!used[l[i]]) return l[i]; return -1; }
  for(var i=0;i<segs.length;i++){
    if(used[i]) continue; used[i]=1;
    var ch=[segs[i][0],segs[i][1]], endK=segs[i][1].k, nx;
    while((nx=nextFrom(endK))>=0){ used[nx]=1; var s=segs[nx], p=(s[0].k===endK)?s[1]:s[0]; ch.push(p); endK=p.k; }
    var startK=segs[i][0].k;
    while((nx=nextFrom(startK))>=0){ used[nx]=1; var s2=segs[nx], p2=(s2[0].k===startK)?s2[1]:s2[0]; ch.unshift(p2); startK=p2.k; }
    chains.push(ch);
  }
  return chains;
}
function chaikin(pts){
  if(pts.length<3) return pts;
  var o=[pts[0]];
  for(var i=0;i<pts.length-1;i++){ var a=pts[i], b=pts[i+1]; o.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]); }
  o.push(pts[pts.length-1]); return o;
}

/* ---------- δεδομένα ---------- */
function bboxKey(b){ return [b.w,b.s,b.e,b.n].map(function(v){ return v.toFixed(3); }).join(','); }
function covers(g,b){
  var gw=g.x0, ge=g.x0+g.dx*g.w, gn=g.y0, gs=g.y0+g.dy*g.h; /* dy<0 */
  return b.w>=gw&&b.e<=ge&&b.n<=gn&&b.s>=gs;
}
function fetchGrid(b,res,sig){
  var url=WCS+'?service=wcs&version=1.0.0&request=getcoverage&coverage=emodnet:mean&crs=EPSG:4326&bbox='+[b.w,b.s,b.e,b.n].join(',')+'&format=image/tiff&interpolation=bilinear&resx='+res+'&resy='+res;
  return ensureSign().then(function(sg){
    return fetch(url,{signal:sig}).then(function(r){ if(!r.ok) throw new Error('http '+r.status); return r.arrayBuffer(); }).then(function(buf){
      var g=parseTiff(buf); g.res=res;
      if(sg<0){ for(var i=0;i<g.data.length;i++) g.data[i]=-g.data[i]; }
      return g;
    });
  });
}
/* Το WCS μπορεί να δίνει υψόμετρο (θάλασσα αρνητική) ή βάθος (θάλασσα θετική).
   Ελέγχουμε ένα σημείο που είναι σίγουρα βαθιά θάλασσα (νότια της Κύπρου) και κανονικοποιούμε: θάλασσα = θετικό. */
var signP=null;
function ensureSign(){
  var st=+C.lsGet('alkyon-dsign',0); if(st===1||st===-1) return Promise.resolve(st);
  if(signP) return signP;
  var u=WCS+'?service=wcs&version=1.0.0&request=getcoverage&coverage=emodnet:mean&crs=EPSG:4326&bbox=33.19,34.19,33.21,34.21&format=image/tiff&interpolation=nearest&resx=0.00104166667&resy=0.00104166667';
  signP=fetch(u).then(function(r){ if(!r.ok) throw new Error('http'); return r.arrayBuffer(); }).then(function(b){
    var g=parseTiff(b), sum=0; for(var i=0;i<g.data.length;i++) sum+=g.data[i];
    var sg=sum<0?-1:1; C.lsSet('alkyon-dsign',sg); signP=null; return sg;
  }).catch(function(e){ signP=null; throw e; });
  return signP;
}

/* ---------- σχεδίαση ---------- */
function satBase(){ var l=C.lsGet('alkyon-layer','osm'); return l==='sat'||l==='satellite'||l==='esri'; }
function draw(g,step){
  group.clearLayers();
  var w=g.w,h=g.h, mx=0, mn=1e9;
  for(var i=0;i<g.data.length;i++){ var v=g.data[i]; if(v>0){ if(v>mx) mx=v; if(v<mn) mn=v; } }
  if(mx<=0) return 0;
  var cp=g.data; blur(g);
  var first=Math.max(step,Math.ceil(mn/step)*step), last=Math.min(Math.floor(mx/step)*step,step*MAXLEVELS), sat=satBase(), nlines=0, labels=0, placed=[];
  var minorC=sat?'#8fd8ff':'#2f7fc0', majorC=sat?'#ffffff':'#0a3a6a';
  for(var lv=first;lv<=last;lv+=step){
    var major=(lv/step)%5===0, chains=contour(g,lv);
    for(var c=0;c<chains.length;c++){
      var ch=chains[c]; if(ch.length<3) continue;
      var pts=ch.map(function(p){ return [g.y0+g.dy*(p.y+.5), g.x0+g.dx*(p.x+.5)]; }); /* κέντρο κελιού */
      pts=chaikin(pts);
      L.polyline(pts,{renderer:rend,color:major?majorC:minorC,weight:major?1.6:0.8,opacity:major?(sat?.8:.9):(sat?.4:.6), /* 1.8.6: πιο λεπτές, λιγότερο λευκό στον δορυφόρο */interactive:false,smoothFactor:1}).addTo(group); nlines++;
      if(major&&pts.length>14&&labels<40){
        var m=pts[Math.floor(pts.length/2)];
        /* 1.8.4: οι αριθμοί δεν μπαίνουν ο ένας πάνω στον άλλο (τουλάχιστον ~70 px μεταξύ τους) */
        var mp=null; try{ mp=map.latLngToContainerPoint(m); }catch(e){} if(mp&&placed.some(function(q){ return Math.abs(q.x-mp.x)<70&&Math.abs(q.y-mp.y)<26; })) continue; if(mp) placed.push(mp);
        L.marker(m,{interactive:false,keyboard:false,icon:L.divIcon({className:'dlbl'+(sat?' sat':''),html:'<span>'+lv+'</span>',iconSize:[26,14],iconAnchor:[13,7]})}).addTo(group); labels++;
      }
    }
  }
  g.data=cp;
  return nlines;
}
function active(){ return dm===2&&mode!=='std'; }
var lastSt='';
function status(t){ if(!t){ lastSt=''; return; } if(t===lastSt) return; lastSt=t; if(/Ζουμάρισε|Zoom in|Δεν υπάρχουν βάθη|No depths|Δεν φορτώθηκαν|not loaded/.test(t)){ try{ C.toast(t); }catch(e){} } }
function refresh(){
  clearTimeout(timer); timer=setTimeout(update,380);
}
var ATTR='Depth: <a href="https://emodnet.ec.europa.eu" target="_blank" rel="noopener">EMODnet Bathymetry</a>', attrOn=false;
function attr(on){ if(on===attrOn) return; attrOn=on; try{ if(on) map.attributionControl.addAttribution(ATTR); else map.attributionControl.removeAttribution(ATTR); }catch(e){} }
function update(){
  if(!active()){ group.clearLayers(); if(map.hasLayer(group)) map.removeLayer(group); status(''); attr(false); return; }
  attr(true);
  if(!map.hasLayer(group)) group.addTo(map);
  var z=map.getZoom(); if(z<MINZOOM){ group.clearLayers(); status(T('Ζουμάρισε πιο κοντά','Zoom in closer')); return; }
  var bd=map.getBounds().pad(.12), b={w:bd.getWest(),s:bd.getSouth(),e:bd.getEast(),n:bd.getNorth()}, step=+mode;
  var span=Math.max(b.e-b.w,b.n-b.s), res=Math.max(CELL,Math.max(b.e-b.w,b.n-b.s)/MAXCELLS);
  var vis=map.getBounds(), vb={w:vis.getWest(),s:vis.getSouth(),e:vis.getEast(),n:vis.getNorth()};
  var g=null;
  for(var i=0;i<cache.length;i++){ if(cache[i].res<=res*1.01&&covers(cache[i],vb)){ g=cache[i]; break; } }
  var my=++seq;
  if(g){ status(drawStatus(draw(g,step),step)); return; }
  status(T('Φόρτωση βαθών…','Loading depths…'));
  var ac=null; try{ ac=new AbortController(); }catch(e){}
  if(refresh.ac) try{ refresh.ac.abort(); }catch(e){}
  refresh.ac=ac;
  fetchGrid(b,res,ac?ac.signal:undefined).then(function(gg){
    if(my!==seq||!active()) return;
    cache.unshift(gg); cache=cache.slice(0,4);
    status(drawStatus(draw(gg,step),step));
  }).catch(function(e){
    if(e&&e.name==='AbortError') return;
    if(my!==seq) return;
    status(T('Δεν φορτώθηκαν τα βάθη','Depths not loaded'));
    if(Date.now()-failedToast>30000){ failedToast=Date.now(); try{ C.toast(T('Οι πυκνές γραμμές βάθους θέλουν ίντερνετ.','Dense depth lines need internet.')); }catch(x){} }
  });
}
function drawStatus(n,step){ return n?(T('Γραμμές κάθε ','Lines every ')+step+' m'+T(' · έως ',' · up to ')+(step*MAXLEVELS)+' m'):T('Δεν υπάρχουν βάθη εδώ','No depths here'); }

/* ---------- επιλογή πυκνότητας ---------- */
function buildUi(){
  var box=document.querySelector('.mapbox'); if(!box) return;
  var d=document.createElement('div'); d.id='dlChips'; d.hidden=true;
  var opts=[['std',T('Στάνταρ','Standard')],['5','5 m'],['10','10 m'],['20','20 m']], btns={};
  opts.forEach(function(o){
    var b=document.createElement('button'); b.type='button'; b.textContent=o[1]; b.setAttribute('data-m',o[0]);
    b.addEventListener('click',function(){ setMode(o[0]); });
    d.appendChild(b); btns[o[0]]=b;
  });
  var st=document.createElement('span'); st.className='dlst'; d.appendChild(st);
  box.appendChild(d); ctl={box:d,btns:btns,st:st};
}
function sync(){
  if(!ctl) return;
  ctl.box.hidden=(dm!==2);
  Object.keys(ctl.btns).forEach(function(k){ ctl.btns[k].setAttribute('aria-pressed',String(k===mode)); });
}
function setMode(m){
  mode=m; C.lsSet(KEY,m); sync();
  if(window.AlkyonDepthRefresh) window.AlkyonDepthRefresh(); else update();
}
window.addEventListener('alkyon-depthmode',function(e){ dm=e&&e.detail?e.detail.dm:0; sync(); update(); });
map.on('moveend',function(){ if(active()) refresh(); });
var bl=document.getElementById('bLayer'); if(bl) bl.addEventListener('click',function(){ setTimeout(function(){ if(active()&&cache.length) update(); },200); });
window.AlkyonBathy={fetchGrid:fetchGrid};
window.AlkyonDense={setMode:setMode,on:active,parse:parseTiff,contour:contour,mode:function(){ return mode; },update:update};
dm=window.AlkyonDepthMode?window.AlkyonDepthMode():(+C.lsGet('alkyon-depth',0)||0);
sync();
if(dm===2&&mode!=='std'&&window.AlkyonDepthRefresh) window.AlkyonDepthRefresh();
update();
})();
