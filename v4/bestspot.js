/* Alkyon 1.2.2 · «Καλύτερα σημεία»: πού να πας, από όλα τα δεδομένα μαζί.
   1) Ο server (water-clarity, mode=scan) σαρώνει ένα πλέγμα σημείων γύρω από το κέντρο του χάρτη (ακτίνα ανάλογα με το ζουμ):
      άνεμος, ριπή, κύμα (μέγιστα 06–18), θερμοκρασία επιφάνειας, ρεύμα (Open-Meteo) και χλωροφύλλη (Copernicus, δορυφόρος).
   2) Εδώ προστίθενται: βάθος και κλίση βυθού (EMODnet, ίδιο πλέγμα με τη «Δομή βυθού»), μέτωπα (απότομη αλλαγή χλωροφύλλης / θερμοκρασίας
      ανάμεσα σε γειτονικά σημεία), τα δικά σου ψάρια εκεί, και τα όρια ασφαλείας σου.
   3) Τα 5 καλύτερα, με απόσταση μεταξύ τους, εμφανίζονται στον χάρτη με αριθμό και εξήγηση.
   Ενδεικτικό: συνδυάζει γνωστές ενδείξεις (μέτωπα, τροφή, δομή βυθού, ήρεμη θάλασσα). Δεν είναι εγγύηση ότι υπάρχει ψάρι. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var FN='https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/water-clarity', SK='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
var grp=null, last=null, busy=false, dayIx=null, active=false, hooked=null, mvT=0, lastC=null, pill=null, lastRes=null;
function M(){ return window.AlkyonCore&&window.AlkyonCore.map&&window.AlkyonCore.map(); }
function km(a,b,c,d){ var R=6371, r=Math.PI/180, dl=(c-a)*r, dn=(d-b)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }
function pct(arr){ var s=arr.filter(function(v){ return v!=null&&isFinite(v); }).sort(function(a,b){ return a-b; }); return function(v){ if(v==null||!s.length) return 0; var i=0; while(i<s.length&&s[i]<v) i++; return s.length>1?i/(s.length-1):0.5; }; }
function lims(){ var PF=window.PF; try{ return PF&&PF.lims?PF.lims():{wind:14,wave:0.9,gust:24}; }catch(e){ return {wind:14,wave:0.9,gust:24}; } }
function bites(){ try{ return B.store.raw('bites').filter(function(b){ return !b.deleted&&!b.miss&&b.lat!=null&&!(B.pest&&B.pest(b)); }); }catch(e){ return []; } }
function loadBathy(){ return window.AlkyonBathy?Promise.resolve():new Promise(function(res){ var s=document.createElement('script'); s.src='../bathy-lines.js'; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }

/* βυθός για όλη την περιοχή (ένα πλέγμα): βάθος και η μεγαλύτερη κλίση σε ~600 m γύρω από κάθε σημείο */
function seabed(bb){
  return loadBathy().then(function(){ if(!window.AlkyonBathy||!B.seabed||!B.seabed.analyze) return null;
    var res=Math.max(1/960,(bb.e-bb.w)/170); return window.AlkyonBathy.fetchGrid(bb,res).then(function(g){ return {g:g,a:B.seabed.analyze(g)}; }); }).catch(function(){ return null; }); }
function bedAt(sb,lat,lon){ if(!sb) return null; var g=sb.g, x=Math.floor((lon-g.x0)/g.dx), y=Math.floor((lat-g.y0)/g.dy); if(x<1||y<1||x>=g.w-1||y>=g.h-1) return null;
  var dpt=g.data[y*g.w+x]; if(!(dpt>0)) return {land:true};
  var cell=Math.abs(g.dy)*111, R=Math.max(1,Math.ceil(0.6/cell)), mx=0;
  for(var dy=-R;dy<=R;dy++) for(var dx=-R;dx<=R;dx++){ var xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=g.w||yy>=g.h) continue; var s=sb.a.S[yy*g.w+xx]; if(s>mx) mx=s; }
  return {depth:dpt,slope:mx}; }

function score(data,sb,di,center){
  var L=lims(), X=window.AlkyonExposure, bs=bites(), pts=[], unsafe=0, sp=data.sp||4;
  data.pts.forEach(function(p){ var d=p.d&&p.d[di]; if(!d||d.w==null) return;
    try{ if(X&&X.isLand&&X.isLand(p.la,p.lo)===1) return; }catch(e){}
    var bed=bedAt(sb,p.la,p.lo); if(bed&&bed.land) return;
    if(d.w>L.wind||(d.v!=null&&d.v>L.wave)||(d.g!=null&&L.gust&&d.g>L.gust)){ unsafe++; return; }
    pts.push({p:p,d:d,bed:bed}); });
  /* μέτωπα: η μεγαλύτερη αλλαγή ανά km προς τους γείτονες */
  pts.forEach(function(a){ var gc=0, gs=0; pts.forEach(function(b){ if(a===b) return; var k=km(a.p.la,a.p.lo,b.p.la,b.p.lo); if(k>sp*1.6||k<0.1) return;
      if(a.p.chl>0&&b.p.chl>0){ var v=Math.abs(Math.log(a.p.chl)/Math.LN10-Math.log(b.p.chl)/Math.LN10)/k; if(v>gc) gc=v; }
      if(a.p.sst!=null&&b.p.sst!=null){ var w=Math.abs(a.p.sst-b.p.sst)/k; if(w>gs) gs=w; } });
    a.gc=gc; a.gs=gs; });
  var pGc=pct(pts.map(function(x){ return x.gc; })), pGs=pct(pts.map(function(x){ return x.gs; })), pChl=pct(pts.map(function(x){ return x.p.chl>0?Math.log(x.p.chl):null; }));
  pts.forEach(function(a){ var p=a.p, d=a.d, why=[], s=0, part;
    part=15*clamp(1-Math.max(d.w/L.wind,(d.v||0)/L.wave),0,1); s+=part; if(part>=10) why.push([part,T('ήρεμη θάλασσα','calm sea')+' ('+Math.round(d.w)+' kn, '+B.num(d.v||0,1)+' m)']);
    if(p.chl>0){ part=a.gc>0.02?25*pGc(a.gc):0; s+=part; if(part>=14) why.push([part,T('μέτωπο χλωροφύλλης: εδώ μαζεύεται η τροφή','chlorophyll front: food gathers here')]);
      part=10*pChl(Math.log(p.chl)); s+=part; if(part>=7) why.push([part,T('περισσότερη τροφή από τη γύρω θάλασσα','more food than the sea around')]); }
    part=a.gs>0.03?15*pGs(a.gs):0; s+=part; if(part>=9) why.push([part,T('θερμικό μέτωπο','thermal front')+' ('+B.num(a.gs,2)+' °C/km)']);
    if(p.ck!=null){ part=p.ck>=0.15&&p.ck<=0.8?8:(p.ck>=0.05&&p.ck<=1.2?4:0); s+=part; if(part>=8) why.push([part,T('ήπιο ρεύμα ','gentle current ')+B.num(p.ck,1)+' kn']); }
    var bed=a.bed; if(bed){ part=bed.slope>=12?20:bed.slope>=5?10:0; s+=part; if(part>=10) why.push([part,(bed.slope>=12?T('απότομος βυθός (drop-off)','steep seabed (drop-off)'):T('κλίση βυθού','sloping seabed'))+' · '+Math.round(bed.depth)+' m']);
      part=bed.depth>=10&&bed.depth<=150?10:bed.depth>150&&bed.depth<=300?4:bed.depth<10?3:0; s+=part; if(part>=10&&!(bed.slope>=5)) why.push([part,T('βάθος ','depth ')+Math.round(bed.depth)+' m']); }
    var n=bs.filter(function(b){ return km(b.lat,b.lon,p.la,p.lo)<1.5; }).length; part=Math.min(15,5*n); s+=part; if(n) why.push([part+5,T('εδώ έχεις πιάσει ','you’ve caught here ')+n+(n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish'))]);
    var dk=km(center.lat,center.lon,p.la,p.lo); s-=Math.min(8,dk/5);
    a.score=Math.round(clamp(s/1.05,0,100)); a.dk=dk; a.why=why.sort(function(x,y){ return y[0]-x[0]; }).slice(0,3).map(function(x){ return x[1]; }); });
  pts.sort(function(x,y){ return y.score-x.score; });
  var top=[]; pts.forEach(function(a){ if(top.length<5&&!top.some(function(t){ return km(t.p.la,t.p.lo,a.p.la,a.p.lo)<Math.max(3,sp*0.9); })) top.push(a); });
  return {top:top,n:pts.length,unsafe:unsafe,hasBed:!!sb,hasChl:data.pts.some(function(p){ return p.chl>0; })};
}

function clear(){ var m=M(); if(grp&&m) m.removeLayer(grp); grp=null; }
function draw(res){ var m=M(); if(!m) return; clear(); grp=L.layerGroup().addTo(m);
  res.top.forEach(function(a,i){ L.marker([a.p.la,a.p.lo],{icon:L.divIcon({className:'mk best',iconSize:null,html:'<i>'+(i+1)+'</i><b>'+a.score+'</b>'})}).on('click',function(){ detail(a,i); }).addTo(grp); }); }
function dayName(ds){ try{ return new Date(ds+'T12:00:00').toLocaleDateString(EN?'en-GB':'el-GR',{weekday:'long',day:'numeric',month:'short'}); }catch(e){ return ds; } }
function detail(a,i){ var p=a.p, d=a.d, body=h('div',null,
    h('p',{class:'sub',text:T('Βαθμός ','Score ')+a.score+' · '+B.num(a.dk,1)+T(' km από το κέντρο',' km from the centre')}),
    h('ul',{class:'bsw'},a.why.map(function(w){ return h('li',{text:w}); })),
    h('p',{class:'sub',text:[T('Άνεμος έως ','Wind up to ')+Math.round(d.w)+' kn',d.v!=null?T('κύμα έως ','waves up to ')+B.num(d.v,1)+' m':'',p.sst!=null?B.num(p.sst,1)+' °C':'',p.chl>0?T('χλωροφύλλη ','chlorophyll ')+B.num(p.chl,2)+' mg/m³':''].filter(Boolean).join(' · ')}),
    h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Πρόγνωση εδώ','Forecast here'),onclick:function(){ sh.close(); fcAt(p.la,p.lo,T('Πρόταση ','Suggestion ')+(i+1)); }}),
      B.spotFormAt?h('button',{class:'btn',type:'button',text:T('Αποθήκευση σημείου','Save spot'),onclick:function(){ sh.close(); B.spotFormAt(p.la,p.lo); }}):null),
    h('p',{class:'sub',text:T('Ενδεικτικό: συνδυασμός γνωστών ενδείξεων, όχι εγγύηση.','Indicative: a combination of known signs, not a guarantee.')}));
  var sh=B.sheet({title:'#'+(i+1)+' · '+dayName(d.date),body:body}); }
function fcAt(lat,lon,name){ var a=ls.get('alkyon-places',[])||[], id='p'+Math.round(lat*100)+'_'+Math.round(lon*100);
  if(!a.some(function(p){ return p.id===id; })){ a.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:false,map:1}); ls.set('alkyon-places',a.slice(0,10)); }
  ls.set('alkyon-fcsel',id); location.hash='#forecast'; }

function summary(res,data){ var body=h('div',{class:'opps'}), list=h('div',{class:'opl'});   /* ίδια εμφάνιση με τη λίστα «Πού να πάω» */
  var seg=B.seg([['0',T('Σήμερα','Today')],['1',T('Αύριο','Tomorrow')]],String(dayIx),function(v){ dayIx=+v; sh.close(); show(); },T('Μέρα','Day'));
  body.append(seg);
  if(!res.top.length) body.append(h('p',{class:'sub',text:res.unsafe?T('Όλα τα σημεία εδώ είναι πάνω από τα όρια ασφαλείας σου αυτή τη μέρα.','All spots here are over your safety limits that day.'):T('Δεν βρέθηκαν σημεία θάλασσας εδώ. Μετακίνησε τον χάρτη πάνω από θάλασσα.','No sea points found here. Move the map over the sea.')}));
  body.append(list);
  res.top.forEach(function(a,i){ list.append(h('button',{type:'button',class:'opr',onclick:function(){ sh.close(); var m=M(); if(m) m.setView([a.p.la,a.p.lo],Math.max(m.getZoom(),12)); detail(a,i); }},
    h('span',{class:'ops '+(a.score>=70?'hi':a.score>=50?'mid':'lo'),text:String(a.score)}),h('span',{class:'opt'},h('b',{text:'#'+(i+1)+' · '+B.num(a.dk,1)+' km'}),h('small',{text:a.why.join(' · ')||T('Καλές συνθήκες','Good conditions')})),B.icon?B.icon('chev'):null)); });
  var notes=[]; if(!res.hasChl) notes.push(T('χωρίς χλωροφύλλη (δεν υπάρχει δορυφορική εικόνα εδώ)','no chlorophyll (no satellite image here)')); if(!res.hasBed) notes.push(T('χωρίς βυθό (χρειάζεται σύνδεση)','no seabed (needs a connection)'));
  body.append(h('p',{class:'sub',text:T('Έλεγξα ','Checked ')+res.n+T(' σημεία θάλασσας σε ακτίνα ',' sea points within ')+data.r+' km'+(res.unsafe?T(' · ',' · ')+res.unsafe+T(' πάνω από τα όρια ασφαλείας σου',' over your safety limits'):'')+(notes.length?' · '+notes.join(' · '):'')+'.'}),
    h('p',{class:'sub',text:T('Από: καιρό και κύμα (Open-Meteo), χλωροφύλλη (Copernicus, δορυφόρος ','From: weather and waves (Open-Meteo), chlorophyll (Copernicus satellite ')+(data.chlDay||'')+T('), θερμοκρασία και ρεύματα, βυθό (EMODnet), τα ψάρια σου.','), temperature and currents, seabed (EMODnet), your catches.')}),
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Ψάξε εδώ ξανά','Search here again'),onclick:function(){ sh.close(); run(true); }}),h('button',{class:'btn',type:'button',text:T('Κλείσιμο προτάσεων','Hide suggestions'),onclick:function(){ sh.close(); set(false); }})));
  var sh=B.sheet({title:T('Καλύτερα σημεία','Best spots'),body:body}); }
function show(quiet){ if(!last) return; var res=score(last.data,last.sb,dayIx,last.c); lastRes=res; draw(res); paintPill(res); if(!quiet) summary(res,last.data); }
/* 1.2.6: μικρό κουμπί στον χάρτη όσο είναι ανοιχτό: πόσα σημεία, και πάτημα για τη λίστα */
function paintPill(res){ if(!active){ if(pill) pill.hidden=true; return; }
  if(!pill){ pill=h('button',{type:'button',class:'bsPill',onclick:function(){ if(last&&lastRes) summary(lastRes,last.data); }}); document.body.append(pill); }
  pill.hidden=false; pill.textContent=busy?'🎯 '+T('Ψάχνω…','Searching…'):'🎯 '+(res&&res.top.length?res.top.length+T(' καλύτερα σημεία · λίστα',' best spots · list'):T('Κανένα σημείο εδώ','No spot here')); }
/* όταν μετακινείς τον χάρτη: νέα αναζήτηση για την περιοχή που βλέπεις (αν πήγες αρκετά μακριά ή άλλαξες ζουμ) */
function hook(){ var m=M(); if(!m||hooked===m) return; hooked=m;
  m.on('moveend',function(){ if(!active) return; clearTimeout(mvT); mvT=setTimeout(function(){ if(!active||!/^#map/.test(location.hash||'')) return; var c=m.getCenter(), z=m.getZoom();
    if(lastC&&z===lastC.z&&km(lastC.lat,lastC.lon,c.lat,c.lng)<lastC.r*0.4) return; run(true,true); },1500); }); }

function run(force,quiet){ var m=M(); if(!m){ return; } if(busy) return; hook();
  var c=m.getCenter(), z=m.getZoom(), r=z>=12?10:z>=11?15:z>=10?25:z>=9?40:60;
  if(dayIx==null) dayIx=new Date().getHours()>=15?1:0;
  busy=true; lastC={lat:c.lat,lon:c.lng,r:r,z:z}; if(quiet) paintPill(lastRes); else B.toast(T('Ψάχνω τα καλύτερα σημεία σε ακτίνα ','Searching the best spots within ')+r+' km…',4000);
  var dLa=r/111*1.15, dLo=dLa/Math.cos(c.lat*Math.PI/180), bb={w:c.lng-dLo,e:c.lng+dLo,s:c.lat-dLa,n:c.lat+dLa};
  var url=FN+'?mode=scan&lat='+c.lat.toFixed(3)+'&lon='+c.lng.toFixed(3)+'&r='+r;
  Promise.all([fetch(url,{headers:{apikey:SK,Authorization:'Bearer '+SK}}).then(function(x){ return x.ok?x.json():null; }).catch(function(){ return null; }),seabed(bb)]).then(function(rr){ busy=false; var data=rr[0];
    if(!data||!data.pts){ paintPill(lastRes); if(quiet) return; B.toast(T('Η αναζήτηση δεν έγινε. Χρειάζεται σύνδεση (και η νέα έκδοση της συνάρτησης water-clarity).','The search failed. Needs a connection (and the new water-clarity function).'),7000); return; }
    last={data:data,sb:rr[1],c:{lat:c.lat,lon:c.lng}}; show(quiet); });
}
function isOn(){ return active; }
function set(v){ active=!!v; if(active) run(true); else { clear(); last=null; lastC=null; lastRes=null; paintPill(null); } }
/* από την Πρόγνωση («Πού να πάω»): άνοιγμα του Χάρτη στη θέση και αναζήτηση */
function go(lat,lon){ var first=!/^#map/.test(location.hash||'');
  if(lat!=null&&B.mapGo) B.mapGo(lat,lon,11,null,{lab:T('Κέντρο αναζήτησης','Search centre'),sea:true}); else if(first) location.hash='#map';
  active=true; setTimeout(function(){ run(true); },first?1500:200); }
B.bestSpots={on:isOn,set:set,run:run,go:go,_score:score};
})();
