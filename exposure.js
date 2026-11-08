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
  box.appendChild(el('h3',null,T('Έκθεση της ακτής ανά κατεύθυνση ανέμου','Coast exposure by wind direction')));
  box.appendChild(el('p',{'class':'note'},T('Προσωρινός δείκτης. Δείχνει πόση ανοιχτή θάλασσα υπάρχει ΠΡΙΝ από εσένα για κάθε κατεύθυνση από την οποία φυσάει. Περισσότερα km = ευκολότερη δημιουργία κύματος. Δεν είναι πρόγνωση.','Provisional index. Shows how much open sea lies upwind of you for each wind direction. More km = waves build more easily. Not a forecast.')));
  if(cd){
    var L=level(r.dirs[cur].km);
    box.appendChild(el('p',{style:'margin:6px 0;font-weight:600'},
      T('Τώρα: άνεμος από ','Now: wind from ')+names[cur]+' · '+(EN?L.en:L.el)+' ('+fmtKm(r.dirs[cur].km)+')'));
  }
  var sw=el('p',{style:'margin:6px 0;font-size:13px'}); sw.hidden=true; box.appendChild(sw);
  var wrap=el('div',{style:'display:grid;gap:3px;margin:6px 0'});
  var mx=Math.max.apply(null,r.dirs.map(function(d){ return d.km; }));
  var cols=['#3f9d6b','#c9a227','#d9731f','#c93a14'];
  r.dirs.forEach(function(d){
    var L=level(d.km), row=el('div',{style:'display:flex;align-items:center;gap:6px;font-size:12px'+(d.i===cur?';font-weight:700':'')});
    row.appendChild(el('span',{style:'width:34px;flex:none'},names[d.i]+(d.i===cur?' ◀':'')));
    var bar=el('div',{style:'flex:1;height:9px;background:var(--line);border-radius:5px;overflow:hidden'});
    var fill=el('div',{style:'height:100%;width:'+Math.max(2,Math.round(100*Math.sqrt(d.km/Math.max(mx,1))))+'%;background:'+cols[L.k]});
    bar.appendChild(fill); row.appendChild(bar);
    row.appendChild(el('span',{style:'width:84px;flex:none;text-align:right'},fmtKm(d.km)));
    wrap.appendChild(row);
  });
  /* 1.8.6: ροδέλα (σαν ανεμολόγιο): κάθε κομμάτι = πόσο ανοιχτή είναι η θάλασσα από εκεί. Η λίστα μένει από κάτω, κλειστή. */
  var Rr=104, cx=150, cy=128, sv='<svg viewBox="0 0 300 258" width="100%" style="max-width:340px;display:block;margin:4px auto 0" role="img" aria-label="'+T('Έκθεση ανά κατεύθυνση','Exposure by direction')+'"><circle cx="'+cx+'" cy="'+cy+'" r="'+Rr+'" fill="currentColor" opacity=".05"/><circle cx="'+cx+'" cy="'+cy+'" r="'+(Rr/2)+'" fill="none" stroke="currentColor" opacity=".12"/>';
  r.dirs.forEach(function(d){ var L=level(d.km), a0=(d.i*22.5-11.25-90)*Math.PI/180, a1=(d.i*22.5+11.25-90)*Math.PI/180, rr=Math.max(9,Rr*Math.sqrt(d.km/Math.max(mx,1)));
    sv+='<path d="M'+cx+','+cy+' L'+(cx+rr*Math.cos(a0)).toFixed(1)+','+(cy+rr*Math.sin(a0)).toFixed(1)+' A'+rr.toFixed(1)+','+rr.toFixed(1)+' 0 0 1 '+(cx+rr*Math.cos(a1)).toFixed(1)+','+(cy+rr*Math.sin(a1)).toFixed(1)+' Z" fill="'+cols[L.k]+'" opacity="'+(d.i===cur?1:.8)+'" stroke="'+(d.i===cur?'#0b1f2a':'#fff')+'" stroke-width="'+(d.i===cur?2.5:1.5)+'"><title>'+names[d.i]+' · '+fmtKm(d.km)+'</title></path>'; });
  [0,4,8,12].forEach(function(i){ var am=(i*22.5-90)*Math.PI/180; sv+='<text x="'+(cx+(Rr+15)*Math.cos(am)).toFixed(1)+'" y="'+(cy+(Rr+15)*Math.sin(am)+5).toFixed(1)+'" font-size="14" font-weight="800" text-anchor="middle" fill="currentColor">'+names[i]+'</text>'; });
  if(cd){ var ac=(cur*22.5-90)*Math.PI/180; sv+='<path d="M'+(cx+(Rr+2)*Math.cos(ac)).toFixed(1)+','+(cy+(Rr+2)*Math.sin(ac)).toFixed(1)+' L'+(cx+(Rr-14)*Math.cos(ac-0.08)).toFixed(1)+','+(cy+(Rr-14)*Math.sin(ac-0.08)).toFixed(1)+' L'+(cx+(Rr-14)*Math.cos(ac+0.08)).toFixed(1)+','+(cy+(Rr-14)*Math.sin(ac+0.08)).toFixed(1)+' Z" fill="#0b1f2a"/>'; }
  sv+='<circle cx="'+cx+'" cy="'+cy+'" r="4" fill="currentColor"/></svg>';
  var rose=el('div'); rose.innerHTML=sv; box.appendChild(rose);
  box.appendChild(el('p',{style:'margin:2px 0 6px;font-size:12px;opacity:.75;text-align:center'},T('Κόκκινο = ανοιχτό (κύμα από εκεί) · πράσινο = προστατευμένο · ▲ ο άνεμος τώρα','Red = open (waves from there) · green = sheltered · ▲ the wind now')));
  var dl=el('details'); dl.appendChild(el('summary',{style:'cursor:pointer;font-size:13px;font-weight:600;margin:2px 0 4px'},T('Αριθμοί ανά κατεύθυνση','Numbers by direction'))); dl.appendChild(wrap); box.appendChild(dl);
  var warn=[];
  if(r.coastKm<1.5) warn.push(T('Είσαι πολύ κοντά στην ακτή (<1,5 km): εκεί το ενεργό fetch είναι αναξιόπιστο.','You are very close to shore (<1.5 km): effective fetch is unreliable there.'));
  if(r.moved>0) warn.push(T('Το σημείο ήταν στην ξηρά, χρησιμοποιήθηκε η κοντινότερη θάλασσα ('+r.moved.toFixed(1)+' km).','The point was on land; nearest sea used ('+r.moved.toFixed(1)+' km).'));
  warn.push(T('Δεν περιλαμβάνει βουνά (επιτάχυνση ή σκιά ανέμου), swell από μακριά, διάθλαση/περίθλαση. Αν ο άνεμος της πρόγνωσης είναι λάθος, λάθος είναι και εδώ το συμπέρασμα.','Does not include mountains (wind acceleration/shadow), distant swell, refraction/diffraction. If the forecast wind is wrong, so is the conclusion here.'));
  box.appendChild(el('p',{'class':'note'},warn.join(' ')));
  box.appendChild(el('p',{'class':'note',style:'margin:2px 0 0;font-size:11px'},T('Ακτογραμμή: © OpenStreetMap contributors (ODbL)','Coastline: © OpenStreetMap contributors (ODbL)')));
  marine(p).then(function(m){ if(m) showSwell(sw,m,r); try{ logCard(box,p,r,cd,cur,m); }catch(e){} }).catch(function(){ try{ logCard(box,p,r,cd,cur,null); }catch(e){} });
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
window.AlkyonExposure={compute:compute,logGet:logGet,level:level,hs:hs,ready:function(){ return decode(); },isLand:function(lat,lon){ return decode()?isLand(lat,lon):-1; },seaPoint:function(lat,lon){ return decode()?seaPoint(lat,lon):null; }};
})();
