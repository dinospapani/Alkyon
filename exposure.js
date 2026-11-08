/* Έκθεση ακτής ανά κατεύθυνση ανέμου (ενεργό fetch) — ενδεικτικό.
   Μέθοδος: SPM/CERC, ακτίνες ανά 6° στα ±42°, ζύγισμα cos, όριο 200 km, πάνω σε raster ξηράς/θάλασσας
   (OpenStreetMap land polygons, κελί 0,0025° ≈ 250 m — coastgrid.js, ενημερώνεται από το coastline-sync.yml).
   Δείχνει πόσο ανοιχτή είναι η θάλασσα για κάθε κατεύθυνση ανέμου.
   ΔΕΝ βλέπει βουνά (επιτάχυνση/σκιά ανέμου), swell, διάθλαση/περίθλαση. Σε απόσταση 1–3 km από την ακτή
   το ενεργό fetch είναι αναξιόπιστο. Η σχετική σειρά κατευθύνσεων είναι πιο αξιόπιστη από τις απόλυτες τιμές. */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var G=null, MASK=null;
var MAXKM=200, RAD_STEP=6, HALF=42, STEP_KM=0.25;
var NAMES_EL=['Β','ΒΒΑ','ΒΑ','ΑΒΑ','Α','ΑΝΑ','ΝΑ','ΝΝΑ','Ν','ΝΝΔ','ΝΔ','ΔΝΔ','Δ','ΔΒΔ','ΒΔ','ΒΒΔ'];
var NAMES_EN=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

function decode(){
  if(MASK) return true;
  G=window.ALKYON_COASTGRID; if(!G||!G.rle) return false;
  var s=atob(G.rle), n=G.w*G.h, m=new Uint8Array(n), i=0, pos=0, land=0;
  while(i<s.length&&pos<n){
    var v=0, sh=0, b;
    do{ b=s.charCodeAt(i++); v|=(b&127)<<sh; sh+=7; }while(b&128&&i<s.length);
    if(land) m.fill(1,pos,Math.min(n,pos+v));
    pos+=v; land^=1;
  }
  if(pos!==n) return false;
  MASK=m; return true;
}
function inGrid(lat,lon){ return G&&lon>=G.lon0&&lon<G.lon0+G.w*G.step&&lat<=G.lat1&&lat>G.lat1-G.h*G.step; }
function isLand(lat,lon){
  var c=Math.floor((lon-G.lon0)/G.step), r=Math.floor((G.lat1-lat)/G.step);
  if(c<0||r<0||c>=G.w||r>=G.h) return -1;
  return MASK[r*G.w+c];
}
var RE=6371.0088, D2R=Math.PI/180;
function dest(lat,lon,brg,km){
  var la=lat*D2R, lo=lon*D2R, b=brg*D2R, d=km/RE;
  var la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
  var lo2=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));
  return [la2/D2R,lo2/D2R];
}
/* απόσταση (km) ευθείας ακτίνας ως την πρώτη ξηρά· MAXKM αν δεν βρεθεί· null αν βγει εκτός raster */
function ray(lat,lon,brg,maxkm){
  var n=Math.round(maxkm/STEP_KM);
  for(var k=1;k<=n;k++){
    var q=dest(lat,lon,brg,k*STEP_KM), v=isLand(q[0],q[1]);
    if(v===1) return (k-1)*STEP_KM;
    if(v===-1) return null;
  }
  return maxkm;
}
function effective(lat,lon,from,maxkm){
  var num=0, den=0, cut=false;
  for(var k=-HALF/RAD_STEP;k<=HALF/RAD_STEP;k++){
    var a=k*RAD_STEP, f=ray(lat,lon,(from+a+360)%360,maxkm);
    if(f==null){ f=maxkm; cut=true; }
    var w=Math.cos(a*D2R); num+=f*w; den+=w;
  }
  return {km:num/den,cut:cut};
}
/* σημείο θάλασσας: αν το σημείο είναι σε ξηρά, κοντινότερο κελί νερού ≤3 km */
function seaPoint(lat,lon){
  var v=isLand(lat,lon); if(v===-1) return null;
  if(v===0) return {lat:lat,lon:lon,moved:0};
  for(var r=0.5;r<=3.01;r+=0.5){
    for(var b=0;b<360;b+=15){
      var q=dest(lat,lon,b,r); if(isLand(q[0],q[1])===0) return {lat:q[0],lon:q[1],moved:r};
    }
  }
  return null;
}
/* απόσταση από την πλησιέστερη ξηρά (km, έως 3) — για προειδοποίηση «πολύ κοντά στην ακτή» */
function landDist(lat,lon){
  var m=3;
  for(var b=0;b<360;b+=15){ var f=ray(lat,lon,b,3); if(f!=null&&f<m) m=f; }
  return m;
}
/* opts.shift=false: χωρίς μετακίνηση 1 km ανοιχτά (για έλεγχο) */
function compute(lat,lon,opts){
  opts=opts||{};
  if(!decode()||!inGrid(lat,lon)) return null;
  var sp=seaPoint(lat,lon); if(!sp) return null;
  var la=sp.lat, lo=sp.lon;
  if(opts.shift!==false&&landDist(la,lo)<1){
    var best=-1, bb=null;
    for(var b=0;b<360;b+=22.5){ var f=ray(la,lo,b,40); if(f!=null&&f>best){ best=f; bb=b; } }
    if(bb!=null&&best>=2){ var q=dest(la,lo,bb,1); if(isLand(q[0],q[1])===0){ la=q[0]; lo=q[1]; } }
  }
  var out=[];
  for(var i=0;i<16;i++){ var e=effective(la,lo,i*22.5,MAXKM); out.push({i:i,deg:i*22.5,km:e.km,cut:e.cut}); }
  return {lat:la,lon:lo,moved:sp.moved,coastKm:landDist(la,lo),dirs:out};
}
function level(km){
  if(km<5) return {k:0,el:'Προστατευμένο',en:'Sheltered'};
  if(km<20) return {k:1,el:'Περιορισμένο',en:'Limited'};
  if(km<60) return {k:2,el:'Εκτεθειμένο',en:'Exposed'};
  return {k:3,el:'Ανοιχτό',en:'Open'};
}
/* ενδεικτικό ύψος σημαντικού κύματος (m), JONSWAP fetch-limited, μόνο για έλεγχο/δοκιμές */
function hs(u10,fkm){
  var g=9.81, ua=0.71*Math.pow(u10,1.23), F=fkm*1000;
  var h=0.0016*ua*ua/g*Math.sqrt(g*F/(ua*ua)), cap=0.2433*ua*ua/g;
  return Math.min(h,cap);
}

/* ---------- κάρτα στο Forecast ---------- */
var cache={};
function el(tag,attrs,text){
  var e=document.createElement(tag); if(attrs) for(var k in attrs) e.setAttribute(k,attrs[k]); if(text!=null) e.textContent=text; return e;
}
function curDir(f){
  try{
    var now=f.nowLocal.slice(0,13), best=null;
    f.days.forEach(function(d){ (d.hours||[]).forEach(function(h){ if(h.t&&h.t.slice(0,13)===now) best=h; }); });
    return best&&best.dir!=null?{dir:best.dir,wind:best.wind,gust:best.gust,t:best.t}:null;
  }catch(e){ return null; }
}
/* 1.9.30: μικρός χάρτης έκθεσης: στεριά/θάλασσα από το ίδιο raster, φέτες ανά κατεύθυνση, βέλος ανέμου */
function drawMap(cv,r,cur,names,cols,mx){
  var S=cv.width, c=cv.getContext('2d'), RK=14, la0=r.lat, lo0=r.lon, kx=111.32*Math.cos(la0*D2R), ky=110.57, px=S/(2*RK);
  var bg=getComputedStyle(document.body).backgroundColor||'', m=/(\d+)\D+(\d+)\D+(\d+)/.exec(bg), dark=m?(+m[1]*0.3+ +m[2]*0.59+ +m[3]*0.11)<110:false;
  var LAND=dark?[58,56,46]:[230,220,195], SEA=dark?[20,44,58]:[206,230,240], OUT=dark?[30,34,38]:[236,238,240];
  var im=c.createImageData(S,S), d=im.data, st=3;
  for(var y=0;y<S;y+=st) for(var x=0;x<S;x+=st){ var lat=la0+(S/2-y-st/2)/px/ky, lon=lo0+(x+st/2-S/2)/px/kx, v=isLand(lat,lon), col=v===1?LAND:v===0?SEA:OUT;
    for(var yy=y;yy<Math.min(S,y+st);yy++) for(var xx=x;xx<Math.min(S,x+st);xx++){ var o=(yy*S+xx)*4; d[o]=col[0]; d[o+1]=col[1]; d[o+2]=col[2]; d[o+3]=255; } }
  c.putImageData(im,0,0);
  var cx=S/2, cy=S/2, R=S*0.46;
  c.save(); c.globalAlpha=dark?0.12:0.18; c.strokeStyle=dark?'#fff':'#0b1f2a'; c.lineWidth=2; c.beginPath(); c.arc(cx,cy,R*0.5,0,7); c.stroke(); c.beginPath(); c.arc(cx,cy,R,0,7); c.stroke(); c.restore();
  /* 1.9.31: φέτες σε πραγματική κλίμακα: κάθε φέτα σταματά εκεί που η ευθεία βρίσκει στεριά· όσες περνούν την άκρη του χάρτη συνεχίζουν ως την άκρη.
     Το χρώμα = πόσο κύμα σηκώνει ο άνεμος από εκεί (ενεργό fetch, ±42°) */
  var edge=RK*0.97, ext=[];
  r.dirs.forEach(function(dd){ var L=level(dd.km), a0=(dd.deg-11.25-90)*D2R, a1=(dd.deg+11.25-90)*D2R, st0=dd.ray==null?dd.km:dd.ray, km=Math.min(st0,edge), rr=Math.max(S*0.03,km*px);
    c.beginPath(); c.moveTo(cx,cy); c.arc(cx,cy,rr,a0,a1); c.closePath(); c.globalAlpha=dd.i===cur?0.85:0.55; c.fillStyle=cols[L.k]; c.fill(); c.globalAlpha=1; c.lineWidth=dd.i===cur?5:2; c.strokeStyle=dd.i===cur?(dark?'#fff':'#0b1f2a'):'rgba(255,255,255,.85)'; c.stroke();
    if(st0>edge) ext.push(dd); });
  /* οι πιο μακριές: αριθμός km στην άκρη */
  ext.sort(function(a,b){ return b.ray-a.ray; }); var lab=ext.filter(function(dd,k){ return dd.i===cur||k<3; });
  c.font='800 '+Math.round(S*0.034)+'px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle';
  lab.forEach(function(dd){ var am=(dd.deg-90)*D2R, tx=cx+Math.cos(am)*R*0.78, ty=cy+Math.sin(am)*R*0.78, t=(dd.ray>=MAXKM?'>':'')+Math.round(dd.ray)+' km';
    c.lineWidth=6; c.strokeStyle='rgba(255,255,255,.92)'; c.strokeText(t,tx,ty); c.fillStyle='#0b1f2a'; c.fillText(t,tx,ty); });
  /* βέλος ανέμου: έρχεται από την κατεύθυνση του ανέμου προς το σημείο */
  if(cur>=0){ var a=(cur*22.5-90)*D2R, ox=cx+Math.cos(a)*R*0.9, oy=cy+Math.sin(a)*R*0.9, ix=cx+Math.cos(a)*S*0.13, iy=cy+Math.sin(a)*S*0.13;
    var AF=dark?'#ffffff':'#0b1f2a', AS=dark?'#0b1f2a':'#ffffff'; c.lineCap='round'; c.strokeStyle=AS; c.lineWidth=16; c.beginPath(); c.moveTo(ox,oy); c.lineTo(ix,iy); c.stroke(); c.strokeStyle=AF; c.lineWidth=9; c.beginPath(); c.moveTo(ox,oy); c.lineTo(ix,iy); c.stroke();
    var b=Math.atan2(iy-oy,ix-ox), hl=S*0.055; c.beginPath(); c.moveTo(ix+Math.cos(b)*hl*0.6,iy+Math.sin(b)*hl*0.6); c.lineTo(ix-Math.cos(b-0.55)*hl,iy-Math.sin(b-0.55)*hl); c.lineTo(ix-Math.cos(b+0.55)*hl,iy-Math.sin(b+0.55)*hl); c.closePath(); c.fillStyle=AF; c.strokeStyle=AS; c.lineWidth=4; c.stroke(); c.fill(); }
  /* σημείο */
  c.beginPath(); c.arc(cx,cy,S*0.022,0,7); c.fillStyle='#d4502b'; c.fill(); c.lineWidth=5; c.strokeStyle='#fff'; c.stroke();
  /* σημεία του ορίζοντα */
  c.font='800 '+Math.round(S*0.05)+'px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle';
  [[0,cx,S*0.04],[4,S*0.96,cy],[8,cx,S*0.96],[12,S*0.04,cy]].forEach(function(t){ c.lineWidth=6; c.strokeStyle=dark?'rgba(0,0,0,.7)':'rgba(255,255,255,.9)'; c.strokeText(names[t[0]],t[1],t[2]); c.fillStyle=dark?'#fff':'#0b1f2a'; c.fillText(names[t[0]],t[1],t[2]); });
  /* κλίμακα 5 km */
  var sb=5*px, sx=S*0.05, sy=S*0.93; c.lineWidth=4; c.strokeStyle=dark?'#fff':'#0b1f2a'; c.beginPath(); c.moveTo(sx,sy); c.lineTo(sx+sb,sy); c.stroke();
  c.font='700 '+Math.round(S*0.036)+'px system-ui,sans-serif'; c.textAlign='left'; c.fillStyle=dark?'#fff':'#0b1f2a'; c.fillText('5 km',sx,sy-S*0.03);
}
function render(p,f){
  var box=document.getElementById('fcExposure'), D=document.getElementById('fcDays');
  if(!D) return;
  if(!box){ box=el('div',{id:'fcExposure','class':'card',style:'margin:10px 0'}); }
  var pr=document.getElementById('fcPress');
  if(pr&&pr.parentNode) pr.parentNode.insertBefore(box,pr.nextSibling); else D.parentNode.insertBefore(box,D);
  box.replaceChildren();
  if(!p||!f){ box.hidden=true; return; }
  var key=(+p.lat).toFixed(3)+','+(+p.lon).toFixed(3), r=cache[key];
  if(r===undefined){ try{ r=compute(+p.lat,+p.lon); }catch(e){ r=null; try{ console.error('exposure',e); }catch(e0){} } cache[key]=r; }
  if(!r){ box.hidden=true; return; }
  box.hidden=false;
  var names=EN?NAMES_EN:NAMES_EL, cd=curDir(f), cur=cd?Math.round(cd.dir/22.5)%16:-1;
  box.dataset.v='2';
  box.appendChild(el('h3',null,T('Έκθεση της ακτής ανά κατεύθυνση ανέμου','Coast exposure by wind direction')));
  var cols=['#3f9d6b','#c9a227','#d9731f','#c93a14'], mx=Math.max.apply(null,r.dirs.map(function(d){ return d.km; }));
  /* 1.9.30: πρώτα η απάντηση (τώρα + ποιοι άνεμοι είναι απάνεμοι εδώ), μετά ο χάρτης, στο τέλος οι λεπτομέρειες */
  var est=el('div',{'class':'exest'}); est.hidden=true; box.appendChild(est);
  if(cd){
    var L=level(r.dirs[cur].km), nw=el('div',{'class':'exv'});
    nw.appendChild(el('span',{'class':'exchip',style:'background:'+cols[L.k]},EN?L.en:L.el));
    nw.appendChild(el('span',null,T('Τώρα άνεμος από ','Now wind from ')+names[cur]+': '+(L.k>=2?T('το κύμα έρχεται ελεύθερα ('+fmtKm(r.dirs[cur].km)+' ανοιχτή θάλασσα).','waves come in freely ('+fmtKm(r.dirs[cur].km)+' of open sea).'):L.k===1?T('λίγη θάλασσα μπροστά σου ('+fmtKm(r.dirs[cur].km)+'), μικρό κύμα από τον άνεμο.','little sea upwind ('+fmtKm(r.dirs[cur].km)+'), small wind waves.'):T('ο άνεμος έρχεται από τη στεριά και δεν σηκώνει κύμα εδώ.','the wind comes off the land and builds no waves here.'))));
    box.appendChild(nw);
  }
  var shel=r.dirs.filter(function(d){ return level(d.km).k===0; }).map(function(d){ return names[d.i]; });
  box.appendChild(el('p',{'class':'exshel'},shel.length?T('Εδώ είσαι απάνεμα όταν ο άνεμος έρχεται από: ','Sheltered here when the wind comes from: ')+shel.join(', '):T('Δεν υπάρχει κατεύθυνση ανέμου που να είναι εντελώς απάνεμη εδώ.','No wind direction is fully sheltered here.')));
  var sw=el('p',{'class':'exsw'}); sw.hidden=true; box.appendChild(sw);
  /* χάρτης: η πραγματική ακτή γύρω σου, και από το σημείο σου «φέτες» προς κάθε κατεύθυνση: όσο πιο μακριά και κόκκινη, τόσο περισσότερη ανοιχτή θάλασσα από εκεί */
  var mapBox=el('div',{'class':'exmap'}), cv=el('canvas',{width:'600',height:'600','aria-label':T('Χάρτης έκθεσης της ακτής','Coast exposure map'),role:'img'}); mapBox.appendChild(cv); box.appendChild(mapBox);
  r.dirs.forEach(function(dd){ if(dd.ray===undefined){ var q=ray(r.lat,r.lon,dd.deg,MAXKM); dd.ray=q==null?MAXKM:q; } });
  try{ drawMap(cv,r,cd?cur:-1,names,cols,mx); }catch(e){ try{ console.error('expomap',e); }catch(e0){} }
  var lg=el('div',{'class':'exleg'}); [[0,T('Απάνεμο <5 km','Sheltered <5 km')],[1,T('Λίγο 5–20','Limited 5–20')],[2,T('Εκτεθειμένο 20–60','Exposed 20–60')],[3,T('Ανοιχτό >60 km','Open >60 km')]].forEach(function(x){ var it=el('span'); it.appendChild(el('i',{style:'background:'+cols[x[0]]})); it.appendChild(document.createTextNode(x[1])); lg.appendChild(it); }); box.appendChild(lg);
  box.appendChild(el('p',{'class':'note exhow'},T('Κάθε «φέτα» φτάνει ως την πρώτη στεριά προς εκείνη την κατεύθυνση, σε πραγματική κλίμακα (όσες βγαίνουν από τον χάρτη γράφουν τα km). Το χρώμα δείχνει πόσο κύμα σηκώνει ο άνεμος όταν έρχεται από εκεί: κόκκινο πολύ, πράσινο καθόλου. Το μαύρο βέλος είναι ο άνεμος τώρα.','Each slice reaches the first land in that direction, to real scale (those leaving the map show the km). The colour shows how much sea the wind builds when it comes from there: red a lot, green none. The black arrow is the wind now.')));
  var wrap=el('div',{style:'display:grid;gap:3px;margin:6px 0'});
  r.dirs.forEach(function(d){
    var L=level(d.km), row=el('div',{style:'display:flex;align-items:center;gap:6px;font-size:12px'+(d.i===cur?';font-weight:700':'')});
    row.appendChild(el('span',{style:'width:34px;flex:none'},names[d.i]+(d.i===cur?' ◀':'')));
    var bar=el('div',{style:'flex:1;height:9px;background:var(--line);border-radius:5px;overflow:hidden'});
    bar.appendChild(el('div',{style:'height:100%;width:'+Math.max(2,Math.round(100*Math.sqrt(d.km/Math.max(mx,1))))+'%;background:'+cols[L.k]})); row.appendChild(bar);
    row.appendChild(el('span',{style:'width:84px;flex:none;text-align:right'},fmtKm(d.km)));
    wrap.appendChild(row);
  });
  var dl=el('details',{'class':'exdet'}); dl.appendChild(el('summary',null,T('Αριθμοί ανά κατεύθυνση και σημειώσεις','Numbers by direction and notes'))); dl.appendChild(wrap);
  var warn=[T('Προσωρινός δείκτης, όχι πρόγνωση: δείχνει πόση ανοιχτή θάλασσα υπάρχει πριν από σένα για κάθε κατεύθυνση ανέμου.','Provisional index, not a forecast: it shows how much open sea lies upwind for each wind direction.')];
  if(r.coastKm<1.5) warn.push(T('Είσαι πολύ κοντά στην ακτή (<1,5 km): εκεί οι αριθμοί είναι λιγότερο ακριβείς.','You are very close to shore (<1.5 km): numbers are less precise there.'));
  if(r.moved>0) warn.push(T('Το σημείο ήταν στην ξηρά, χρησιμοποιήθηκε η κοντινότερη θάλασσα ('+r.moved.toFixed(1)+' km).','The point was on land; nearest sea used ('+r.moved.toFixed(1)+' km).'));
  warn.push(T('Δεν περιλαμβάνει βουνά (επιτάχυνση ή σκιά ανέμου), swell από μακριά, διάθλαση/περίθλαση.','Does not include mountains (wind acceleration/shadow), distant swell, refraction/diffraction.'));
  dl.appendChild(el('p',{'class':'note'},warn.join(' ')));
  dl.appendChild(el('p',{'class':'note',style:'margin:2px 0 0;font-size:11px'},T('Ακτογραμμή: © OpenStreetMap contributors (ODbL)','Coastline: © OpenStreetMap contributors (ODbL)')));
  box.appendChild(dl);
  marine(p).then(function(m){ if(m){ showSwell(sw,m,r); try{ estWave(est,m,r,cd,cur); }catch(e){} } try{ logCard(box,p,r,cd,cur,m); }catch(e){} }).catch(function(){ try{ logCard(box,p,r,cd,cur,null); }catch(e){} });
}
/* ---------- swell (Open-Meteo marine), μία μικρή κλήση ανά τόπο/ώρα ---------- */
var MC={};
function marine(p){
  var key=(+p.lat).toFixed(2)+','+(+p.lon).toFixed(2), hr=new Date().toISOString().slice(0,13), c=MC[key];
  if(c&&c.hr===hr) return c.pr;
  var u='https://marine-api.open-meteo.com/v1/marine?latitude='+(+p.lat).toFixed(3)+'&longitude='+(+p.lon).toFixed(3)+'&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period&timezone=GMT&forecast_days=1';
  var pr=fetch(u).then(function(r){ if(!r.ok) throw new Error('marine '+r.status); return r.json(); }).then(function(j){
    var H=j&&j.hourly; if(!H||!H.time) return null;
    var i=H.time.indexOf(hr+':00'); if(i<0) return null;
    function g(k){ var v=H[k]&&H[k][i]; return v==null?null:+v; }
    var m={wh:g('wave_height'),wd:g('wave_direction'),wp:g('wave_period'),sh:g('swell_wave_height'),sd:g('swell_wave_direction'),sp:g('swell_wave_period')};
    return (m.wh==null&&m.sh==null)?null:m;
  });
  MC[key]={hr:hr,pr:pr}; pr.catch(function(){ delete MC[key]; });
  return pr;
}
/* 1.9.31: εκτίμηση κύματος ΕΔΩ τώρα = κύμα από τον άνεμο (JONSWAP με το ενεργό fetch της κατεύθυνσης του ανέμου, όχι πάνω από το κύμα ανοιχτής θάλασσας)
   + swell (ολόκληρο αν μπαίνει ελεύθερα ≥60 km, μισό αν 20–60 km, λίγο αν λιγότερο). Συνδυασμός ενεργειακά: √(a²+b²). Ενδεικτικό ±25%. */
/* 1.9.34: ο υπολογισμός χωριστά, για να τον χρησιμοποιεί και το «Πού είναι ήρεμα» (wind σε kn, dir από πού φυσά) */
function estimate(r,wind,dir,m){
  var hw=0, hsw=0, si=-1, ci=dir!=null?Math.round(dir/22.5)%16:-1;
  if(ci>=0&&wind!=null){ hw=hs(wind*0.5144,Math.max(0.2,r.dirs[ci].km)); if(m&&m.wh!=null) hw=Math.min(hw,m.wh); }
  if(m&&m.sh!=null&&m.sd!=null&&m.sh>=0.1){ si=Math.round(m.sd/22.5)%16; var k=r.dirs[si].km, f=k>=60?1:k>=20?0.6:k>=5?0.3:0.1; hsw=m.sh*f; }
  return {tot:Math.sqrt(hw*hw+hsw*hsw),hw:hw,hsw:hsw,si:si,ci:ci,wl:ci>=0?level(r.dirs[ci].km).k:null};
}
function estWave(node,m,r,cd,cur){
  var names=EN?NAMES_EN:NAMES_EL, E=estimate(r,cd?cd.wind:null,cd&&cur>=0?cur*22.5:null,m), hw=E.hw, hsw=E.hsw, si=E.si, tot=E.tot; if(!(tot>=0)) return;
  var lo=Math.max(0,tot*0.75), hi=tot*1.25, fmt=function(v){ var x=v<0.1?0.1:Math.round(v*10)/10; return EN?x.toFixed(1):x.toFixed(1).replace('.',','); };
  var main=hsw>hw*1.2?T('κυρίως swell από ','mostly swell from ')+names[si]:hw>hsw*1.2?T('κυρίως από τον άνεμο','mostly from the wind'):T('άνεμος και swell μαζί','wind and swell together');
  var lv=tot<0.3?['g',T('Ήρεμα','Calm')]:tot<0.6?['y',T('Λίγο κύμα','Small waves')]:tot<1.1?['o',T('Κύμα','Waves')]:['r',T('Ψηλό κύμα','High waves')];
  node.replaceChildren(el('span',{'class':'exwc '+lv[0]},lv[1]),el('b',null,T('Εδώ τώρα περίπου ','Here now about ')+(tot<0.15?T('κάτω από 0,2 m','under 0.2 m'):fmt(lo)+'–'+fmt(hi)+' m')),el('small',null,main+T('. Εκτίμηση από τον άνεμο, την ακτή και το swell, όχι μέτρηση.','. Estimate from wind, coast and swell, not a measurement.')));
  node.hidden=false;
}
/* Το swell περνά αν η κατεύθυνσή του έχει ανοιχτή θάλασσα (≥60 km) προς το σημείο. Δεν υπολογίζει διάθλαση/περίθλαση. */
function showSwell(node,m,r){
  var names=EN?NAMES_EN:NAMES_EL, parts=[];
  if(m.sh!=null&&m.sd!=null&&m.sh>=0.15){
    var i=Math.round(m.sd/22.5)%16, d=r.dirs[i], L=level(d.km);
    var verdict=d.km>=60?T('μπαίνει ελεύθερα','enters freely'):d.km>=20?T('μπαίνει μερικώς','enters partly'):T('μάλλον μπλοκάρεται από την ακτή','mostly blocked by the coast');
    parts.push(T('Swell (κύμα από μακριά): από ','Swell (distant waves): from ')+names[i]+', '+m.sh.toFixed(1)+' m'+(m.sp?', '+Math.round(m.sp)+' s':'')+' → '+verdict+' ('+fmtKm(d.km)+T(' ανοιχτό)',' open)'));
  } else if(m.sh!=null){ parts.push(T('Swell: αμελητέο τώρα (<0,15 m).','Swell: negligible now (<0.15 m).')); }
  if(m.wh!=null) parts.push(T('Μοντέλο κύματος ανοιχτής θάλασσας: ','Open-sea wave model: ')+m.wh.toFixed(1)+' m'+(m.wd!=null?' '+T('από ','from ')+names[Math.round(m.wd/22.5)%16]:'')+T(' (στον κόλπο συνήθως μικρότερο, όχι πάντα).',' (inside a bay usually smaller, not always).'));
  node.textContent=parts.join(' · '); node.hidden=!parts.length;
}
/* ---------- καταγραφή «πώς είναι η θάλασσα» (τοπικά στη συσκευή) ---------- */
var LOGK='alkyon-sealog';
function logGet(){ try{ var v=JSON.parse(localStorage.getItem(LOGK)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
function logPut(a){ try{ localStorage.setItem(LOGK,JSON.stringify(a.slice(-600))); return true; }catch(e){ return false; } }
function logCard(box,p,r,cd,cur,m){
  var old=box.querySelector('.sealog'); if(old) old.remove();
  var w=el('div',{'class':'sealog',style:'margin-top:10px;padding-top:8px;border-top:1px solid var(--line)'});
  w.appendChild(el('b',null,T('Πώς είναι η θάλασσα εδώ τώρα;','How is the sea here right now?')));
  w.appendChild(el('p',{'class':'note',style:'margin:2px 0 6px'},T('Μόνο αν είσαι εκεί ή τη βλέπεις. Μένει στη συσκευή σου για να βαθμονομήσει τον δείκτη για τους κόλπους και, αν έχεις λογαριασμό, φαίνεται και στους άλλους στον χάρτη για 6 ώρες (χωρίς όνομα).','Only if you are there or can see it. It stays on your device to calibrate this index for bays and, if you have an account, others see it on the map for 6 hours (no name).')));
  var row=el('div',{style:'display:flex;gap:6px;flex-wrap:wrap'}), st=el('p',{'class':'note',style:'margin:6px 0 0'});
  var opts=[[0,'🟢',T('Ήρεμη','Calm')],[1,'🟡',T('Κυματάκι','Choppy')],[2,'🔴',T('Ταραγμένη','Rough')]];
  var key=(+p.lat).toFixed(3)+','+(+p.lon).toFixed(3), hr=new Date().toISOString().slice(0,13);
  function mine(){ return logGet().filter(function(e){ return e.k===key&&e.h===hr; })[0]; }
  function paint(){
    var cu=mine(), all=logGet();
    Array.prototype.forEach.call(row.children,function(b){ b.style.outline=cu&&String(cu.sea)===b.getAttribute('data-s')?'2px solid var(--accent)':'none'; });
    st.textContent=(cu?T('Καταγράφηκε για αυτή την ώρα. Πάτα άλλο για αλλαγή. ','Logged for this hour. Tap another to change. '):'')+T('Σύνολο καταγραφών στη συσκευή: ','Entries on this device: ')+all.length;
  }
  opts.forEach(function(o){
    var b=el('button',{type:'button','data-s':String(o[0]),'class':'ghost',style:'padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit'},o[1]+' '+o[2]);
    b.addEventListener('click',function(){
      var a=logGet().filter(function(e){ return !(e.k===key&&e.h===hr); });
      var rec={t:new Date().toISOString(),h:hr,k:key,lat:+p.lat,lon:+p.lon,place:p.name||'',sea:o[0],v:window.ALKYON_VERSION||'',
        wind:cd?{dir:cd.dir,spd:cd.wind,gust:cd.gust}:null,
        fetchKm:cur>=0?Math.round(r.dirs[cur].km*10)/10:null,coastKm:Math.round(r.coastKm*100)/100,
        model:m?{wh:m.wh,wd:m.wd,wp:m.wp,sh:m.sh,sd:m.sd,sp:m.sp}:null};
      a.push(rec);
      if(!logPut(a)) st.textContent=T('Δεν αποθηκεύτηκε (γεμάτος χώρος συσκευής).','Not saved (device storage full).'); else paint();
      /* 1.9.28: ένα πάτημα, δύο χρήσεις: μένει στη συσκευή (βαθμονόμηση κόλπων) και στέλνεται ως αναφορά θάλασσας σε όλους για 6 ώρες */
      var AK=window.AK, cl=AK&&AK.cloud, ses=cl&&cl.session&&cl.session(), toast=function(x){ try{ if(AK&&AK.toast) AK.toast(x); else if(window.AlkyonCore&&window.AlkyonCore.toast) window.AlkyonCore.toast(x); }catch(e){} };
      if(ses&&cl.rest) cl.rest('sea_reports',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({lat:+(+p.lat).toFixed(5),lon:+(+p.lon).toFixed(5),state:o[0],wind:null,note:null})})
        .then(function(){ toast(T('Καταγράφηκε και φαίνεται σε όλους στον χάρτη για 6 ώρες: ','Logged and shown to everyone on the map for 6 hours: ')+o[2]); try{ AK.ls.set('alkyon-v4-srlast',Date.now()); }catch(e){} })
        .catch(function(e){ toast(/wait a few/i.test(String(e&&e.message))?T('Καταγράφηκε στη συσκευή. Μόλις έστειλες αναφορά, η επόμενη σε λίγα λεπτά.','Logged on this device. You just sent a report; next one in a few minutes.'):T('Καταγράφηκε στη συσκευή: ','Logged on this device: ')+o[2]); });
      else toast(T('Καταγράφηκε: ','Logged: ')+o[2]);
    });
    row.appendChild(b);
  });
  w.appendChild(row); w.appendChild(st);
  var ex=el('button',{type:'button','class':'ghost',style:'margin-top:6px;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--muted);font:inherit;font-size:12px'},T('Αντιγραφή καταγραφών (JSON)','Copy entries (JSON)'));
  ex.addEventListener('click',function(){
    var txt=JSON.stringify(logGet(),null,1);
    function ok(){ ex.textContent=T('Αντιγράφηκε ✓','Copied ✓'); }
    try{ navigator.clipboard.writeText(txt).then(ok,function(){ ex.textContent=T('Αποτυχία αντιγραφής','Copy failed'); }); }catch(e){ ex.textContent=T('Αποτυχία αντιγραφής','Copy failed'); }
  });
  /* 1.8.33: το κουμπί JSON (εργαλείο ανάπτυξης) κρύβεται· εμφανίζεται μόνο με ?dev */
  if(/[?&]dev\b/.test(location.search)) w.appendChild(ex); box.appendChild(w); paint();
}
function fmtKm(k){ return k<10?k.toFixed(1)+' km':Math.round(k)+' km'; }
window.addEventListener('alkyon-fcloaded',function(ev){
  var d=ev.detail||{};
  setTimeout(function(){ try{ render(d.place,d.fc); }catch(e){ try{ console.error('exposure',e); }catch(e0){} } },60);
});
var CC={}; function computeCached(lat,lon){ var k=(+lat).toFixed(3)+','+(+lon).toFixed(3); if(CC[k]!==undefined) return CC[k]; var r=null; try{ r=compute(+lat,+lon); }catch(e){ r=null; } CC[k]=r; return r; }
window.AlkyonExposure={compute:compute,computeCached:computeCached,estimate:estimate,names:function(){ return EN?NAMES_EN:NAMES_EL; },logGet:logGet,level:level,hs:hs,ready:function(){ return decode(); },isLand:function(lat,lon){ return decode()?isLand(lat,lon):-1; },seaPoint:function(lat,lon){ return decode()?seaPoint(lat,lon):null; }};
})();
