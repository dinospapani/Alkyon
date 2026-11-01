/* BiteCast 4 · Χάρτης: η θέση σου, τα σημεία σου, τα ψάρια σου, νέο σημείο, πρόγνωση εδώ, πλοήγηση.
   Η έξοδος (ίχνος, ασφάλεια, άγκυρα, MOB) μένει σε μία μόνο υλοποίηση, της κλασικής, γιατί αφορά την ασφάλεια στη θάλασσα. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var root=null, map=null, layers={}, base=null, sea=null, me=null, meAcc=null, watch=null, gSpots=null, gFish=null;
var TILES={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
var cfg=Object.assign({base:'sat',sea:true,spots:true,fish:true,zones:true,depth:false,mpa:false,dams:B.prof()==='lake',wind:false},ls.get('psaro-v4-map',{}));
var DAMS=[
['Κούρης','Kouris',34.7278,32.9178,'check',110],['Ασπρόκρεμμος','Asprokremmos',34.7259,32.5543,'check',53],['Εύρετου','Evretou',34.9757,32.4727,'check',70],
['Κανναβιού','Kannaviou',34.9277,32.5878,'check',75],['Καλαβασός','Kalavasos',34.803972,33.260517,'check',60],['Λεύκαρα','Lefkara',34.8944,33.2956,'check',71],
['Διπόταμος','Dipotamos',34.851618,33.359274,'check',60],['Γερμασόγεια','Germasogeia',34.7439,33.0843,'check',49],['Άχνα','Achna',35.055321,33.814307,'seasonal',16],
['Κούκλια','Kouklia',35.1207,33.7606,'check',6],['Αρμίνου','Arminou',34.8752,32.7371,'check',45],['Πολεμίδια','Polemidia',34.7187,32.9888,'cr',45],
['Ταμασός','Tamasos',35.0167,33.2479,'check',34],['Μαυροκόλυμπος','Mavrokolympos',34.8565,32.4058,'closed',45],['Αργάκα','Argaka',35.0486,32.5022,'closed',41],
['Πώμος','Pomos',35.1449,32.5762,'check',38],['Αγία Μαρίνα','Agia Marina',35.1170,32.5410,'check',33],['Βυζακιά','Vyzakia',35.0615,33.0272,'check',37],
['Ξυλιάτος','Xyliatos',35.0089,33.0372,'closed',42],['Καλοπαναγιώτης','Kalopanagiotis',35.0061,32.8254,'closed',40],['Λύμπια','Lympia',34.97518,33.41907,'closed',12],['Κλήρου-Μαλούντα','Klirou-Malounta',35.0318,33.1727,'check',38],
['Σολέα','Solea',35.06836,32.90120,'check',0]
];
var DST={closed:[T('Κλειστό για ψάρεμα','Closed to fishing'),'poor'],seasonal:[T('Κλειστό 1 Ιαν – 30 Ιουν, μετά μόνο ελευθέρωση.','Closed 1 Jan – 30 Jun, then catch and release only.'),'fair'],cr:[T('Μόνο ελευθέρωση των ψαριών.','Catch and release only.'),'fair'],check:[T('Η άδεια ισχύει μόνο αν το φράγμα έχει δηλωθεί ανοιχτό. Επιβεβαίωσε.','Valid only if the reservoir is declared open. Please confirm.'),'fair']};
var ov={}, LV=null;
function nrm(x){ return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-zα-ω]/g,''); }
function saveCfg(){ ls.set('psaro-v4-map',cfg); }
function S(){ return B.store; }
var SPT=EN?['Rocks / reef','Sand','Wreck','Ledge / drop-off','Current / open water','Harbour / pier','Other']:['Βράχια / ύφαλος','Άμμος','Ναυάγιο','Ταμπλά / κατωφλι','Ρεύμα / ανοιχτά','Λιμάνι / μώλος','Άλλο'];

/* Leaflet φορτώνεται μόνο όταν ανοίξει ο χάρτης */
var lp=null;
function leaflet(){ if(window.L) return Promise.resolve(window.L); if(lp) return lp;
  lp=new Promise(function(res,rej){ var c=document.createElement('link'); c.rel='stylesheet'; c.href='../leaflet.css'; document.head.appendChild(c);
    var s=document.createElement('script'); s.src='../leaflet.js'; s.onload=function(){ res(window.L); }; s.onerror=rej; document.head.appendChild(s);
    if(!window.ZONES){ var z=document.createElement('script'); z.src='../zones.js'; z.onload=function(){ if(map) drawOverlays(); }; document.head.appendChild(z); } }); return lp; }

function icon(cls,html){ return L.divIcon({className:'mk '+cls,html:html||'',iconSize:null}); }
function drawBase(){ if(base) map.removeLayer(base); base=L.tileLayer(TILES[cfg.base],{maxZoom:19,maxNativeZoom:cfg.base==='sat'?18:19,attribution:cfg.base==='sat'?'Esri':'© OpenStreetMap'}).addTo(map); base.bringToBack();
  if(sea){ map.removeLayer(sea); sea=null; } if(cfg.sea) sea=L.tileLayer(TILES.sea,{maxZoom:19,maxNativeZoom:18,opacity:.9}).addTo(map); }
function drawData(){
  if(!map) return;
  if(gSpots) map.removeLayer(gSpots); if(gFish) map.removeLayer(gFish);
  gSpots=L.layerGroup(); gFish=L.layerGroup();
  if(cfg.spots) S().raw('spots').forEach(function(sp){ if(typeof sp.lat!=='number') return;
    L.marker([sp.lat,sp.lon],{icon:icon('spot','<i></i><b>'+esc(sp.name||'')+'</b>'),keyboard:true,title:sp.name||''}).on('click',function(){ spotSheet(sp); }).addTo(gSpots); });
  if(cfg.fish){ /* ψάρια στο ίδιο σημείο (±60 m): ένας δείκτης με αριθμό */
    var cells={}; S().raw('bites').forEach(function(b){ if(b.miss||typeof b.lat!=='number') return; var k=Math.round(b.lat*1800)+'_'+Math.round(b.lon*1800); (cells[k]=cells[k]||[]).push(b); });
    Object.keys(cells).forEach(function(k){ var a=cells[k], n=a.reduce(function(s,b){ return s+Math.max(1,Math.floor(+b.cnt)||1); },0), la=0, lo=0; a.forEach(function(b){ la+=b.lat; lo+=b.lon; });
      L.marker([la/a.length,lo/a.length],{icon:icon('fish'+(n>1?' many':''),n>1?'<b>'+n+'</b>':''),title:a.map(function(b){ return b.species; }).join(', ')}).on('click',function(){ fishSheet(a); }).addTo(gFish); }); }
  gFish.addTo(map); gSpots.addTo(map);
  drawGear(); drawSea();
}
/* έξοδος: διαδρομή, άγκυρα, MOB */
var gSea=null;
function drawSea(){ if(!map) return; if(gSea) map.removeLayer(gSea); gSea=L.layerGroup().addTo(map);
  var t=B.trip&&B.trip.track(); if(t&&t.pts.length>1) L.polyline(t.pts.map(function(p){ return [p[0],p[1]]; }),{color:'#ff8a50',weight:4,opacity:.9}).addTo(gSea);
  var a=B.anchor&&B.anchor(); if(a){ L.circle([a.lat,a.lon],{radius:a.r,color:'#ffb020',weight:2,fillColor:'#ffb020',fillOpacity:.12,dashArray:'6 6'}).addTo(gSea); L.circleMarker([a.lat,a.lon],{radius:6,color:'#fff',weight:2,fillColor:'#ffb020',fillOpacity:1}).addTo(gSea); }
  var fx=(B.trip&&B.trip.fix())||B.lastPos();
  (B.mobs?B.mobs():[]).forEach(function(m){ L.marker([m.lat,m.lon],{icon:icon('mob','<b>MOB</b>')}).on('click',function(){ mobSheet(m); }).addTo(gSea); if(fx) L.polyline([[fx.lat,fx.lon],[m.lat,m.lon]],{color:'#ff3b30',weight:3,dashArray:'6 6'}).addTo(gSea); });
  var on=B.trip&&B.trip.active(); document.body.classList.toggle('maptrip',!!on); var tb=root&&root.querySelector('.tripbtn'); if(tb) tb.hidden=!!on; }
function mobSheet(m){ var fx=(B.trip&&B.trip.fix())||B.lastPos(), rows=[[T('Ώρα','Time'),new Date(m.t).toTimeString().slice(0,5)],[T('Συντεταγμένες','Coordinates'),m.lat.toFixed(5)+', '+m.lon.toFixed(5)]];
  if(fx){ var R=6371000, r=Math.PI/180, dLa=(m.lat-fx.lat)*r, dLo=(m.lon-fx.lon)*r, x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(fx.lat*r)*Math.cos(m.lat*r)*Math.sin(dLo/2)*Math.sin(dLo/2), d=2*R*Math.asin(Math.min(1,Math.sqrt(x)));
    var y=Math.sin(dLo)*Math.cos(m.lat*r), xx=Math.cos(fx.lat*r)*Math.sin(m.lat*r)-Math.sin(fx.lat*r)*Math.cos(m.lat*r)*Math.cos(dLo), br=(Math.atan2(y,xx)/r+360)%360; rows.push([T('Απόσταση','Distance'),d<1000?Math.round(d)+' m':B.num(d/1852,2)+' nm'],[T('Πορεία','Bearing'),Math.round(br)+'°']); }
  var sh=B.sheet({title:'MOB',body:h('div',null,h('div',{class:'card'},h('div',{class:'rows one'},rows.map(function(q){ return h('div',{class:'row'},h('span',{text:q[0]}),h('b',{text:q[1]})); }))),h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Πήγαινε εκεί','Go there'),onclick:function(){ B.goTo(m.lat,m.lon,'MOB'); }}),h('button',{class:'btn del',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ B.mobDel(m.t); sh.close(); }})))}); }
var gGear=null;
function drawGear(){ if(!map||!B.gearLayers) return; if(gGear) map.removeLayer(gGear); var show=ls.get('psaro-v4-gearshow',null);
  gGear=L.layerGroup(B.gearLayers(L,show?[show]:null)).addTo(map);
  if(show){ ls.set('psaro-v4-gearshow',null); var g=B.gearOf(show), pts=[]; if(g){ [g.set&&g.set.pts,g.haul&&g.haul.pts].forEach(function(a){ if(a) pts=pts.concat(a); }); } if(pts.length) map.fitBounds(L.latLngBounds(pts),{padding:[60,60],maxZoom:16}); } }
function esc(s){ return String(s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* ---------- επιπλέον στρώματα ---------- */
function drawOverlays(){
  if(!map) return;
  Object.keys(ov).forEach(function(k){ if(ov[k]){ map.removeLayer(ov[k]); ov[k]=null; } });
  if(cfg.mpa){ ov.mpa=L.tileLayer.wms('https://ows.emodnet-humanactivities.eu/wms',{layers:'nationallydesignatedareas',format:'image/png',transparent:true,opacity:.6,version:'1.3.0',attribution:'EMODnet Human Activities'}).addTo(map); }
  if(cfg.zones&&window.ZONES){ ov.zones=L.layerGroup(); window.ZONES.forEach(function(z){ L.polygon(z.p,{color:'#ff3b30',weight:2,fillColor:'#ff3b30',fillOpacity:.18}).on('click',function(){ B.sheet({title:z.n,body:h('div',null,h('p',{class:'p',text:z.d||''}),h('p',{class:'foot',text:T('Περιοχή όπου απαγορεύεται η αλιεία. Πηγή: Τμήμα Αλιείας. Επιβεβαίωνε πάντα την ισχύουσα νομοθεσία.','Area where fishing is prohibited. Source: Department of Fisheries. Always check the current regulations.')}))}); }).addTo(ov.zones); }); ov.zones.addTo(map); }
  if(cfg.dams){ ov.dams=L.layerGroup().addTo(map); var put=function(){ if(!ov.dams) return; ov.dams.clearLayers(); DAMS.forEach(function(d){ var lv=null; if(LV&&LV.dams) for(var n in LV.dams){ if(nrm(n)===nrm(d[0])) lv=LV.dams[n]; }
      L.marker([d[2],d[3]],{icon:icon('dam '+(DST[d[4]]||DST.check)[1],'<b>'+(lv?Math.round(lv.pct)+'%':'')+'</b><i>'+esc(EN?d[1]:d[0])+'</i>')}).on('click',function(){ damSheet(d,lv); }).addTo(ov.dams); }); };
    put(); if(!LV) fetch('../dams_levels.json').then(function(r){ return r.json(); }).then(function(j){ LV=j; put(); }).catch(function(){}); }
}
function damSheet(d,lv){
  var st=DST[d[4]]||DST.check, rows=[];
  if(lv){ rows.push([T('Πληρότητα','Fullness'),Math.round(lv.pct)+'%'],[T('Νερό','Water'),B.num(lv.stor,2)+' / '+B.num(lv.cap,2)+T(' εκ. m³',' million m³')]); if(lv.lyPct!=null) rows.push([T('Πέρσι, ίδια μέρα','Same day last year'),Math.round(lv.lyPct)+'%']); }
  B.sheet({title:EN?d[1]:d[0],body:h('div',null,h('p',{class:'tag '+st[1],text:st[0]}),rows.length?h('div',{class:'card',style:{marginTop:'12px'}},h('div',{class:'rows one'},rows.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))):null,
    h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Πρόγνωση εδώ','Forecast here'),onclick:function(){ fcHere(EN?d[1]:d[0],d[2],d[3]); }})),
    h('p',{class:'foot',text:(LV&&LV.date?T('Στάθμη: ','Level: ')+LV.date+T(', Τμήμα Αναπτύξεως Υδάτων. ',', Water Development Department. '):'')+T('Η κατάσταση ανοιχτό/κλειστό αλλάζει· επιβεβαίωσε στο Τμήμα Αλιείας.','Open/closed status changes; confirm with the Department of Fisheries.')}))});
}
/* ---------- βάθη: ίδιες καταστάσεις με την κλασική (psaro-depth 0 κλειστά / 1 χρώματα / 2 γραμμές, psaro-dl πυκνότητα) ---------- */
var depthC=null, depthK=null;
function dmode(){ var v=+ls.get('psaro-depth',0)||0; return v>=0&&v<=2?v:0; }
function applyDepth(){
  if(!map) return; var WM='https://ows.emodnet-bathymetry.eu/wms';
  if(!depthC){ depthC=L.tileLayer.wms(WM,{layers:'emodnet:mean_multicolour',format:'image/png',transparent:true,opacity:.6,version:'1.3.0',attribution:'EMODnet Bathymetry'}); depthK=L.tileLayer.wms(WM,{layers:'emodnet:contours',format:'image/png',transparent:true,version:'1.3.0',attribution:'EMODnet Bathymetry'}); }
  var dm=dmode(); [depthC,depthK].forEach(function(l){ if(map.hasLayer(l)) map.removeLayer(l); });
  if(dm===1) depthC.addTo(map); if(dm===2&&!(window.PsaroDense&&PsaroDense.on())) depthK.addTo(map); if(sea) sea.bringToFront();
  try{ window.dispatchEvent(new CustomEvent('psaro-depthmode',{detail:{dm:dm}})); }catch(e){}
}
function setDepth(dm,dl){ ls.set('psaro-depth',dm); if(dl&&window.PsaroDense&&PsaroDense.setMode){ applyDepth(); PsaroDense.setMode(dl); } else applyDepth(); }

/* ---------- άνεμος (κινούμενος, 48 ώρες), σταθμοί ανέμου, κατάσταση θάλασσας, πυκνές γραμμές βάθους ----------
   Είναι οι ίδιες μονάδες με την κλασική (windmap.js, seastate.js, bathy-lines.js), ώστε να δουλεύουν ακριβώς όπως εκεί.
   Φορτώνονται μία φορά, όταν ανοίξει πρώτη φορά ο χάρτης, γιατί ο χάρτης μένει ζωντανός σε όλη την εφαρμογή. */
var mods=null, mbtns=null;
function loadScript(src){ return new Promise(function(res){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
function classicMods(){
  if(mods) return mods;
  window.PsaroCore=Object.assign(window.PsaroCore||{},{map:function(){ return map; },toast:B.toast,lsGet:ls.get,lsSet:ls.set});
  window.PsaroDepthRefresh=applyDepth; window.PsaroDepthMode=dmode;
  window.PSARO_BASE='../'; if(mbtns&&!document.getElementById('bZones')) mbtns.append(h('span',{id:'bZones',hidden:true}));
  Object.defineProperty(window,'PsaroDepthLayers',{configurable:true,get:function(){ applyDepthInit(); return {c:depthC,k:depthK}; }});
  var list=['../bathy-lines.js','../windmap.js','../windlocal.js','../seastate.js','../ruler.js','../ports.js','../orient.js','../navigator.js','../route.js'], p=Promise.resolve();
  list.forEach(function(f){ p=p.then(function(){ return loadScript(f); }); });
  mods=p.then(function(){ restoreWx(); }); return mods;
}
function applyDepthInit(){ if(!depthC&&map) applyDepth(); }
function cbtn(id){ return document.getElementById(id); }
function pressed(id){ var b=cbtn(id); return !!(b&&b.getAttribute('aria-pressed')==='true'); }
function windOn(){ var W=window.PsaroWindMap; return !!(W&&W.shown&&W.shown()); }
function seaOn(){ return document.body.classList.contains('ndsea'); }
function setWind(v){ var W=window.PsaroWindMap; if(!W) return; if(v){ if(!W.on()) W.start(); else W.show(true); } else if(W.on()){ if(seaOn()) W.show(false); else W.stop(); } saveWx(); }
function setSeaSt(v){ var S2=window.PsaroSeaState; if(!S2||!S2.start) return; if(v&&!seaOn()) S2.start(); else if(!v&&seaOn()) S2.stop(); saveWx(); }
function setStations(v){ if(pressed('bWindSt')!==!!v){ var b=cbtn('bWindSt'); if(b) b.click(); } }
function saveWx(){ setTimeout(function(){ cfg.wind=windOn(); cfg.seast=seaOn(); saveCfg(); },50); }
function restoreWx(){ if(!map) return; if(cfg.seast) setSeaSt(true); if(cfg.wind) setTimeout(function(){ setWind(true); },cfg.seast?800:0); }
/* τα κουμπιά των μονάδων της κλασικής μπαίνουν στη δεξιά στήλη του χάρτη· η αλλαγή τους θυμάται */
function hookBtns(){ document.addEventListener('click',function(e){ var t=e.target; if(t&&t.closest&&t.closest('#bWind,#bSeaState,#ndMapDock')) saveWx(); }); }

/* η θέση μου */
function locate(fly){
  if(!navigator.geolocation) return;
  if(watch==null) watch=navigator.geolocation.watchPosition(function(p){ var ll=[p.coords.latitude,p.coords.longitude];
    ls.set('psaro-v4-pos',{lat:+ll[0].toFixed(5),lon:+ll[1].toFixed(5),t:Date.now()});
    fixNow={lat:ll[0],lon:ll[1],t:Date.now(),spd:p.coords.speed,acc:p.coords.accuracy}; drawDirect();
    headFix(ll[0],ll[1],p.coords.heading,p.coords.speed); followMe(ll[0],ll[1]); try{ window.dispatchEvent(new CustomEvent('psaro-pos',{detail:{lat:ll[0],lon:ll[1]}})); }catch(e){}
    if(!me){ me=L.marker(ll,{icon:icon('me','<i></i>'),interactive:false,zIndexOffset:1000}).addTo(map); meAcc=L.circle(ll,{radius:p.coords.accuracy,className:'meacc',interactive:false}).addTo(map); }
    else { me.setLatLng(ll); meAcc.setLatLng(ll).setRadius(p.coords.accuracy); }
    if(fly){ map.setView(ll,Math.max(map.getZoom(),14)); fly=false; } },function(){ if(fly) B.toast(T('Δεν βρέθηκε η θέση σου.','Your position was not found.')); },{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
  else { var p=B.lastPos(); if(p&&fly) map.setView([p.lat,p.lon],Math.max(map.getZoom(),14)); }
}

/* ---------- «Πήγαινε εκεί»: γραμμή, απόσταση, πορεία, ταχύτητα και ώρα άφιξης προς ένα σημείο (ίδιο κλειδί με την κλασική: psaro-direct) ---------- */
var dtPlan={}, fixNow=null, gDt=null, dtBar=null, dtPrev=null, dtSpd=null, dtArr=false;
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function hav(a,b){ var R=6371000, r=Math.PI/180, dl=(b.lat-a.lat)*r, dn=(b.lon-a.lon)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
function brg(a,b){ var r=Math.PI/180, y=Math.sin((b.lon-a.lon)*r)*Math.cos(b.lat*r), x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lon-a.lon)*r); return (Math.atan2(y,x)/r+360)%360; }
function dtFmt(m){ var U=window.PsaroUnits; if(U&&U.cfg&&U.cfg.dist&&U.cfg.dist!=='km'&&U.dist) try{ return U.dist(m/1000); }catch(e){} return m<1000?Math.round(m)+' m':B.num(m/1000,m<10000?2:1)+' km'; }
function dtTarget(){ return ls.get('psaro-direct',null); }
function drawDirect(){
  var t=dtTarget(); if(!map) return;
  if(gDt){ map.removeLayer(gDt); gDt=null; }
  if(!dtBar) return;
  if(!t){ dtBar.hidden=true; document.body.classList.remove('hasdt'); return; }
  dtBar.hidden=false; document.body.classList.add('hasdt');
  var f=fixNow||(B.trip&&B.trip.fix&&B.trip.fix())||B.lastPos(); gDt=L.layerGroup().addTo(map);
  L.marker([t.lat,t.lon],{icon:icon('dtgt','<i></i>'),interactive:false,zIndexOffset:900}).addTo(gDt);
  var nm=dtBar.querySelector('.dtname'), inf=dtBar.querySelector('.dtinfo');
  nm.textContent=(t.name||T('Σημείο','Point'));
  if(!f){ inf.textContent=T('Περιμένω θέση GPS…','Waiting for a GPS fix…'); return; }
  /* διαδρομή γύρω από στεριά (route.js της κλασικής, απόσταση από ακτή psaro-route-clr, προεπιλογή 200 m) */
  var clr=+ls.get('psaro-route-clr',200), key=t.lat+','+t.lon;
  if(clr&&window.PsaroRoute&&!dtPlan.busy&&(dtPlan.key!==key||!dtPlan.from||hav(dtPlan.from,f)>300)){ dtPlan.busy=true; dtPlan.key=key; dtPlan.from={lat:f.lat,lon:f.lon};
    PsaroRoute.plan({lat:f.lat,lon:f.lon},{lat:t.lat,lon:t.lon},clr).then(function(r){ dtPlan.r=(r&&r.pts)?r:null; }).catch(function(){ dtPlan.r=null; }).then(function(){ dtPlan.busy=false; drawDirect(); }); }
  var rp=dtPlan.key===key&&dtPlan.r?dtPlan.r:null;
  if(rp){ var pts=rp.pts.slice(); pts[0]=[f.lat,f.lon]; L.polyline(pts,{color:'#E4572E',weight:4,opacity:.95,interactive:false}).addTo(gDt); }
  else L.polyline([[f.lat,f.lon],[t.lat,t.lon]],{color:'#E4572E',weight:3,dashArray:'8 8',interactive:false}).addTo(gDt);
  var d=rp?rp.len*Math.max(0.2,hav(f,t)/Math.max(1,rp.direct)):hav(f,t), b=brg(f,t), sp=null;
  if(fixNow&&fixNow.spd!=null&&fixNow.spd>=0) sp=fixNow.spd; else if(dtPrev&&fixNow&&fixNow.t>dtPrev.t){ var dt=(fixNow.t-dtPrev.t)/1000; if(dt>=5) sp=hav(dtPrev,fixNow)/dt; }
  if(fixNow&&(!dtPrev||fixNow.t-dtPrev.t>=5000)) dtPrev=fixNow;
  if(sp!=null) dtSpd=dtSpd==null?sp:dtSpd*0.6+sp*0.4;
  var kn=dtSpd!=null?dtSpd*1.94384:null, eta='';
  if(kn!=null&&kn>=1){ var sec=d/dtSpd, at=new Date(Date.now()+sec*1000); eta=T(' · άφιξη ',' · ETA ')+B.pad(at.getHours())+':'+B.pad(at.getMinutes()); }
  inf.textContent=(rp?T('γύρω από στεριά ','around land ')+'· ':'')+dtFmt(d)+' · '+Math.round(b)+'° '+COMP[Math.round(b/45)%8]+(kn!=null&&kn>=1?' · '+B.num(kn,1)+' kn':'')+eta;
  if(d<40&&!dtArr){ dtArr=true; B.toast(T('Έφτασες: ','Arrived: ')+(t.name||'')); try{ navigator.vibrate&&navigator.vibrate([200,100,200]); }catch(e){} }
}
B.goTo=function(lat,lon,name){ ls.set('psaro-direct',{lat:+lat,lon:+lon,name:String(name||'').slice(0,40)}); dtArr=false; dtSpd=null; dtPrev=null; B.closeSheet&&B.closeSheet();
  if(!map||!root){ location.hash='#map'; } else drawDirect(); setTimeout(function(){ if(map){ var f=fixNow||B.lastPos(); if(f) map.fitBounds(L.latLngBounds([[f.lat,f.lon],[+lat,+lon]]),{padding:[70,70],maxZoom:15}); else map.setView([+lat,+lon],14); } },400);
  B.toast(T('Πλοήγηση προς: ','Navigating to: ')+(name||T('σημείο','point'))); };
B.goClear=function(){ ls.set('psaro-direct',null); drawDirect(); };
function dtBarEl(){ dtBar=h('div',{class:'dtbar',hidden:true,role:'status'},h('span',{class:'dtic',html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 19-7-4-7 4z"/></svg>'}),h('div',{class:'dtmain'},h('b',{class:'dtname'}),h('span',{class:'dtinfo'})),
  h('button',{class:'dtx',type:'button','aria-label':T('Τέλος πλοήγησης','Stop navigating'),text:'✕',onclick:function(){ B.goClear(); }})); return dtBar; }
function goBtn(lat,lon,name){ return h('button',{class:'btn',type:'button',text:T('Πήγαινε εκεί','Go there'),onclick:function(){ B.goTo(lat,lon,name); }}); }
B.goBtn=goBtn;

/* πορεία από το GPS (για το βέλος της θέσης σου και τον προσανατολισμό του χάρτη) και ακολουθία της θέσης κατά την έξοδο, όπως η κλασική */
var youHead=null, youPrev=null, followPause=0;
window.PsaroFollowReset=function(){ followPause=0; };
function headFix(lat,lon,gh,gs){
  if(gh!=null&&isFinite(gh)&&gs!=null&&isFinite(gs)&&gs>0.8) youHead=gh;
  else if(youPrev){ var R6=6371000, dy=(lat-youPrev[0])*Math.PI/180*R6, dx=(lon-youPrev[1])*Math.PI/180*R6*Math.cos(lat*Math.PI/180), d=Math.hypot(dx,dy); if(d>15){ youHead=(Math.atan2(dx,dy)*180/Math.PI+360)%360; youPrev=[lat,lon]; } }
  if(!youPrev) youPrev=[lat,lon];
  if(youHead!=null){ try{ window.dispatchEvent(new CustomEvent('psaro-head',{detail:{head:youHead}})); }catch(e){} var el=me&&me.getElement&&me.getElement(); if(el){ el.classList.add('hd'); el.style.setProperty('--hd',Math.round(youHead)+'deg'); } }
}
function followMe(lat,lon){ if(!map||!root||!document.body.classList.contains('ontrip')||Date.now()<followPause) return; try{ map.panTo([lat,lon],{animate:true,duration:.6}); }catch(e){} }

/* ---------- κάρτα καιρού πάνω στον χάρτη (ίδια στοιχεία με την κλασική mapwx.js, επιλογή στο psaro-mapwx-items) ---------- */
var MWK='psaro-mapwx-items', MWDEF=['wind','press','sst'], mwEl=null, mwEdit=false;
function nowCond(){ var fc=ls.get('psaro-fc7',null); try{ var hr=new Date().getHours(), d=fc.fc.days.filter(function(x){ var t=new Date(); return x.date===t.getFullYear()+'-'+B.pad(t.getMonth()+1)+'-'+B.pad(t.getDate()); })[0]; var q=d&&d.hours.filter(function(x){ return x.hr===hr; })[0]; return q||null; }catch(e){ return null; } }
var MWI=[['wind',T('Άνεμος','Wind'),function(c){ if(c.wind==null) return null; var U=window.PsaroUnits; return [(c.dir!=null?COMP[Math.round((((c.dir%360)+360)%360)/45)%8]+' ':'')+(U?U.wind(c.wind):Math.round(c.wind)+' kn'),c.gust!=null&&c.gust>=c.wind+5?T('ριπές ','gusts ')+(U?U.wind(c.gust):Math.round(c.gust)):T('άνεμος','wind')]; }],
  ['press',T('Πίεση','Pressure'),function(c){ if(c.pres==null) return null; var TR={fast:'↓↓',slow:'↓',stable:'→',rise:'↑'}, U=window.PsaroUnits; return [(U?U.press(c.pres):Math.round(c.pres))+(c.ptrend?' '+TR[c.ptrend]:''),T('πίεση','pressure')]; }],
  ['sst',T('Θερμ. νερού','Water temp'),function(c){ if(c.sst==null) return null; var U=window.PsaroUnits; return [U?U.temp(c.sst):Math.round(c.sst)+'°',T('νερό','water')]; }],
  ['air',T('Θερμ. αέρα','Air temp'),function(c){ if(c.temp==null) return null; var U=window.PsaroUnits; return [U?U.temp(c.temp):Math.round(c.temp)+'°',T('αέρας','air')]; }],
  ['wave',T('Κύμα','Waves'),function(c){ if(c.wave==null) return null; var U=window.PsaroUnits; return [U?U.wave(c.wave):B.num(c.wave,1)+' m',T('κύμα','waves')]; }],
  ['period',T('Περίοδος κύματος','Wave period'),function(c){ return c.period?[Math.round(c.period)+' s',T('περίοδος','period')]:null; }]];
function drawMw(){ if(!mwEl) return; var on=ls.get('psaro-v4-mapwx',true)!==false, c=nowCond(); mwEl.hidden=!on||!c||B.prof()==='spear'&&false; if(mwEl.hidden) return; mwEl.replaceChildren();
  var sel=ls.get(MWK,null); if(!Array.isArray(sel)) sel=MWDEF.slice();
  if(mwEdit){ MWI.forEach(function(it){ mwEl.append(h('button',{type:'button',class:'mwopt','aria-pressed':String(sel.indexOf(it[0])>=0),text:it[1],onclick:function(ev){ ev.stopPropagation(); var i=sel.indexOf(it[0]); if(i>=0) sel.splice(i,1); else sel.push(it[0]); ls.set(MWK,sel); drawMw(); }})); }); mwEl.append(h('button',{type:'button',class:'mwopt ok',text:'✓',onclick:function(ev){ ev.stopPropagation(); mwEdit=false; drawMw(); }})); return; }
  MWI.forEach(function(it){ if(sel.indexOf(it[0])<0) return; var v=it[2](c); mwEl.append(h('div',{class:'mw'},h('b',{text:v?v[0]:'–'}),h('span',{text:v?v[1]:it[1]}))); });
  if(!mwEl.children.length) mwEl.append(h('span',{class:'mwempty',text:T('Πάτα για να διαλέξεις στοιχεία','Tap to choose items')})); }
function mwBox(){ mwEl=h('div',{class:'mapwx',role:'button','aria-label':T('Καιρός τώρα. Πάτα για να διαλέξεις τι φαίνεται.','Weather now. Tap to choose what is shown.'),onclick:function(){ mwEdit=!mwEdit; drawMw(); }}); setTimeout(drawMw,0); return mwEl; }

/* ---------- φύλλα ---------- */
function fishSheet(a){
  if(a.length===1&&B.biteDetail){ B.biteDetail(a[0]); return; }
  var l=h('div',{class:'list'}); a.sort(function(x,y){ return (y.date+y.time).localeCompare(x.date+x.time); }).forEach(function(b){
    l.append(h('button',{class:'li',type:'button',onclick:function(){ sh.close(true); if(B.biteDetail) B.biteDetail(b); }},h('span',{class:'ic'},B.icon('fish')),h('span',{class:'tx'},h('b',{text:(b.species||'')+(+b.cnt>1?' ×'+b.cnt:'')}),h('small',{text:[B.dateShort(b.date)+(b.time?', '+b.time:''),+b.kg?b.kg+' kg':''].filter(Boolean).join(' · ')})))); });
  var sh=B.sheet({title:a.length+' '+T('ψάρια σε αυτό το σημείο','catches at this spot'),body:l});
}
function spotSheet(sp){
  var n=S().raw('bites').filter(function(b){ return !b.miss&&typeof b.lat==='number'&&Math.abs(b.lat-sp.lat)<0.0008&&Math.abs(b.lon-sp.lon)<0.001; }).length;
  var body=h('div',{class:'det'},h('div',{class:'card'},h('div',{class:'rows one'},[[T('Τύπος','Type'),sp.type||'–'],[T('Βάθος','Depth'),sp.depth!=null&&sp.depth!==''?sp.depth+' m':'–'],[T('Ψάρια εδώ','Catches here'),String(n)],[T('Συντεταγμένες','Coordinates'),window.PsaroCoord?PsaroCoord.fmt(sp.lat,sp.lon):sp.lat.toFixed(5)+', '+sp.lon.toFixed(5)]].map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  if(sp.notes) body.append(h('div',{class:'card'},h('p',{class:'p',text:sp.notes})));
  var sum=B.spotSummary&&B.spotSummary(sp); if(sum) body.append(h('div',{class:'card'},h('h2',{text:T('Τι έπιασες εδώ','What you caught here')}),h('div',{class:'rows one'},sum.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  body.append(h('div',{class:'acts'},
    h('button',{class:'btn pri',type:'button',text:T('Πρόγνωση εδώ','Forecast here'),onclick:function(){ sh.close(true); fcHere(sp.name||T('Σημείο','Spot'),sp.lat,sp.lon); }}),
    goBtn(sp.lat,sp.lon,sp.name)),
    h('div',{class:'acts'},h('a',{class:'btn',href:'https://www.google.com/maps/dir/?api=1&destination='+sp.lat+','+sp.lon,target:'_blank',rel:'noopener',text:T('Οδηγίες με αυτοκίνητο','Driving directions')})),
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Επεξεργασία','Edit'),onclick:function(){ sh.close(true); spotForm(sp); }}),B.shareSpots?h('button',{class:'btn',type:'button',text:T('Στείλε σε φίλο','Send to a friend'),onclick:function(){ B.shareSpots([sp]); }}):null));
  var sh=B.sheet({title:(sp.name||T('Σημείο','Spot'))+(sp.priv?' 🔒':''),body:body});
}
function fcHere(name,lat,lon){ var a=ls.get('psaro-places',[])||[], id='p'+Math.round(lat*100)+'_'+Math.round(lon*100);
  if(!a.some(function(p){ return p.id===id; })){ a.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:true}); ls.set('psaro-places',a.slice(0,10)); }
  ls.set('psaro-fcsel',id); location.hash='#forecast'; }
function spotForm(sp,ll){
  var e=sp||null, nm=h('input',{type:'text',maxlength:'60',value:e?e.name||'':'',placeholder:T('π.χ. Ύφαλος Πωμού','e.g. Pomos reef')});
  var ty=h('select',{class:'select'}); SPT.forEach(function(t){ ty.append(h('option',{value:t,text:t})); }); if(e&&e.type) { if(SPT.indexOf(e.type)<0) ty.append(h('option',{value:e.type,text:e.type})); ty.value=e.type; }
  var dp=h('input',{type:'number',min:'0',max:'2000',step:'1',inputmode:'numeric',value:e&&e.depth!=null?e.depth:''}), nt=h('textarea',{rows:'2',maxlength:'400'}); nt.value=e?e.notes||'':'';
  var pv=h('input',{type:'checkbox',checked:!!(e&&e.priv)}), la=e?e.lat:ll.lat, lo=e?e.lon:ll.lng;
  var err=h('p',{class:'err',role:'alert'});
  /* συντεταγμένες: μοίρες και λεπτά όπως στο πλότερ (δέχεται και δεκαδικές, DMS, «35 03.602 N»…), ίδιο με την κλασική (coords.js) */
  var PC=window.PsaroCoord, cLa=h('input',{type:'text',autocomplete:'off',autocapitalize:'characters',spellcheck:'false',value:PC?PC.fmtOne(+la,'lat'):(+la).toFixed(5),'aria-label':T('Γεωγραφικό πλάτος','Latitude')}), cLo=h('input',{type:'text',autocomplete:'off',autocapitalize:'characters',spellcheck:'false',value:PC?PC.fmtOne(+lo,'lon'):(+lo).toFixed(5),'aria-label':T('Γεωγραφικό μήκος','Longitude')});
  cLa.addEventListener('input',function(){ if(PC&&/[EW]/i.test(cLa.value)&&/[NS]/i.test(cLa.value)){ var pr=PC.parsePair(cLa.value); if(pr){ cLa.value=PC.fmtOne(pr[0],'lat'); cLo.value=PC.fmtOne(pr[1],'lon'); } } });
  var cRow=h('div',{class:'g2'},h('label',{class:'fld'},h('span',{text:T('Πλάτος','Latitude')}),cLa),h('label',{class:'fld'},h('span',{text:T('Μήκος','Longitude')}),cLo));
  var f=h('form',{class:'bform',novalidate:true},!e&&B.plotterScan&&B.aiOn&&B.aiOn()?h('button',{class:'btn full',type:'button',text:'📷 '+T('Συντεταγμένες από φωτογραφία plotter','Coordinates from a plotter photo'),onclick:function(){ sh.close(true); B.plotterScan(); }}):null,h('label',{class:'fld'},h('span',{text:T('Όνομα','Name')}),nm),h('label',{class:'fld'},h('span',{text:T('Τύπος','Type')}),ty),h('label',{class:'fld'},h('span',{text:T('Βάθος (m)','Depth (m)')}),dp),
    h('label',{class:'fld'},h('span',{text:T('Σημειώσεις','Notes')}),nt),h('label',{class:'tg'},pv,h('span',{text:T('Ιδιωτικό: δεν το βλέπουν οι φίλοι','Private: friends cannot see it')})),
    cRow,err,h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση σημείου','Save spot')}),
    e?h('button',{class:'btn full del',type:'button',text:T('Διαγραφή σημείου','Delete spot'),onclick:function(){ B.ask(T('Να διαγραφεί το σημείο «'+(e.name||'')+'»; Τα ψάρια μένουν.','Delete the spot “'+(e.name||'')+'”? Catches stay.'),T('Διαγραφή','Delete'),true).then(function(y){ if(y){ S().remove('spots',e.id); sh.close(); B.toast(T('Το σημείο διαγράφηκε.','Spot deleted.')); drawData(); } }); }}):null);
  f.addEventListener('submit',function(ev){ ev.preventDefault(); var name=nm.value.trim(); if(!name){ err.textContent=T('Γράψε όνομα.','Enter a name.'); nm.focus(); return; }
    if(PC){ var pa=PC.parse(cLa.value,'lat'), po=PC.parse(cLo.value,'lon'); if(isNaN(pa)||isNaN(po)||Math.abs(pa)>90||Math.abs(po)>180){ err.textContent=T('Οι συντεταγμένες δεν διαβάζονται. Π.χ. N 35°03.602′ και E 32°23.856′.','The coordinates cannot be read. E.g. N 35°03.602′ and E 32°23.856′.'); return; } la=pa; lo=po; }
    var rec=Object.assign({},e||{},{name:name,type:ty.value,lat:+(+la).toFixed(6),lon:+(+lo).toFixed(6),depth:dp.value===''?null:+dp.value,notes:nt.value.trim()}); if(pv.checked) rec.priv=true; else delete rec.priv;
    S().save('spots',rec); sh.close(); drawData(); B.toast(e?T('Το σημείο ενημερώθηκε.','Spot updated.'):T('Το σημείο αποθηκεύτηκε.','Spot saved.')); });
  var sh=B.sheet({title:e?T('Επεξεργασία σημείου','Edit spot'):T('Νέο σημείο','New spot'),body:f,focus:e?null:'input'});
}
/* ---------- χάρτης εκτός σύνδεσης (ίδια μέθοδος και ίδια αποθήκη με την κλασική: cache psaro-tiles, λίστα psaro-offl) ---------- */
var R_=Math.PI/180, dl={run:false,cancel:false,done:0,total:0,fail:0}, dlBox=null;
function otx(lon,z){ return Math.floor((lon+180)/360*Math.pow(2,z)); }
function oty(lat,z){ var s2=Math.sin(Math.max(-85.05,Math.min(85.05,lat))*R_); return Math.floor((.5-Math.log((1+s2)/(1-s2))/(4*Math.PI))*Math.pow(2,z)); }
function ocnt(b,z){ return (otx(b.getEast(),z)-otx(b.getWest(),z)+1)*(oty(b.getSouth(),z)-oty(b.getNorth(),z)+1); }
function oplan(){ if(!map) return {ok:false}; var b=map.getBounds(), zc=Math.floor(map.getZoom()), z0=Math.max(6,zc-2), lay=cfg.base, seaOn=!!cfg.sea, cap=lay==='osm'?400:900, mul=seaOn?2:1, z1=Math.min(16,Math.max(z0,zc+3));
  for(;z1>=z0;z1--){ var n=0; for(var z=z0;z<=z1;z++) n+=ocnt(b,z)*mul; if(n<=cap) return {ok:true,b:b,z0:z0,z1:z1,n:n,lay:lay,sea:seaOn}; } return {ok:false,cap:cap}; }
function ourls(p){ var out=[], tpl=[TILES[p.lay]]; if(p.sea) tpl.push(TILES.sea);
  for(var z=p.z0;z<=p.z1;z++){ var x0=otx(p.b.getWest(),z), x1=otx(p.b.getEast(),z), y0=oty(p.b.getNorth(),z), y1=oty(p.b.getSouth(),z);
    for(var x=x0;x<=x1;x++) for(var y=y0;y<=y1;y++) for(var a=0;a<tpl.length;a++) out.push(tpl[a].replace('{z}',z).replace('{x}',x).replace('{y}',y)); } return out; }
function startDl(){
  if(!('caches' in window)){ B.toast(T('Ο browser δεν υποστηρίζει αποθήκευση χαρτών.','This browser cannot store maps.')); return; }
  var p=oplan(); if(!p.ok){ B.toast(T('Η περιοχή είναι πολύ μεγάλη. Κάνε μεγέθυνση στον χάρτη και ξαναδοκίμασε.','Area too large. Zoom in and try again.')); return; }
  var list=ourls(p); dl={run:true,cancel:false,done:0,total:list.length,fail:0}; paintDl();
  caches.open('psaro-tiles').then(function(cache){ var i=0;
    function worker(){ if(dl.cancel||i>=list.length) return Promise.resolve(); var u=list[i++];
      return cache.match(u).then(function(hit){ if(hit) return; return fetch(u,{mode:'cors',credentials:'omit'}).then(function(r){ if(!r.ok) throw 0; return cache.put(u,r); }); }).catch(function(){ dl.fail++; }).then(function(){ dl.done++; if(dl.done%10===0||dl.done===dl.total) paintDl(); return worker(); }); }
    return Promise.all([worker(),worker(),worker(),worker()]);
  }).then(function(){ dl.run=false;
    var rec=ls.get('psaro-offl',[])||[]; if(!dl.cancel&&dl.done-dl.fail>0){ rec.push({t:Date.now(),n:dl.done-dl.fail,lay:p.lay,s:p.b.getSouth(),w:p.b.getWest(),nn:p.b.getNorth(),e:p.b.getEast()}); ls.set('psaro-offl',rec.slice(-20)); }
    paintDl(); B.toast(dl.cancel?T('Το κατέβασμα σταμάτησε.','Download stopped.'):(T('Χάρτης αποθηκεύτηκε: ','Map saved: ')+(dl.done-dl.fail)+T(' πλακίδια',' tiles')+(dl.fail?T(' · αποτυχίες: ',' · failed: ')+dl.fail:'')));
  }).catch(function(){ dl.run=false; paintDl(); B.toast(T('Το κατέβασμα απέτυχε.','Download failed.')); });
}
function clearDl(){ B.ask(T('Να διαγραφούν όλοι οι χάρτες που κατέβασες;','Delete all downloaded maps?'),T('Διαγραφή','Delete'),true).then(function(y){ if(!y) return; ls.set('psaro-offl',[]); (window.caches?caches.delete('psaro-tiles'):Promise.resolve()).then(function(){ paintDl(); B.toast(T('Διαγράφηκαν.','Deleted.')); }); }); }
function paintDl(){ if(!dlBox||!dlBox.isConnected) return; var rec=ls.get('psaro-offl',[])||[], tiles=rec.reduce(function(a,r){ return a+(r.n||0); },0), p=oplan(); dlBox.replaceChildren();
  dlBox.append(h('p',{class:'sub',text:dl.run?T('Κατεβαίνει… ','Downloading… ')+dl.done+'/'+dl.total:(rec.length?rec.length+T(' περιοχές · ',' areas · ')+tiles+T(' πλακίδια',' tiles'):T('Κατέβασε την περιοχή που βλέπεις για να δουλεύει χωρίς σήμα.','Download the area you see so it works without signal.'))}));
  if(dl.run){ dlBox.append(h('div',{class:'dlpb'},h('i',{style:{width:Math.round(dl.done/Math.max(1,dl.total)*100)+'%'}})),h('div',{class:'acts'},h('button',{class:'btn del',type:'button',text:T('Ακύρωση','Cancel'),onclick:function(){ dl.cancel=true; }}))); return; }
  dlBox.append(h('small',{class:'wn',text:p.ok?T('Τώρα: ~','Now: ~')+p.n+T(' πλακίδια, ζουμ ',' tiles, zoom ')+p.z0+'–'+p.z1+' ('+(p.lay==='osm'?T('οδικός','street'):T('δορυφορικός','satellite'))+(p.sea?' + '+T('σήματα','marks'):'')+')':T('Η περιοχή είναι πολύ μεγάλη. Κάνε μεγέθυνση.','Area too large. Zoom in.')}),
    h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Κατέβασμα','Download'),disabled:!p.ok,onclick:startDl}),rec.length?h('button',{class:'btn',type:'button',text:T('Διαγραφή','Clear'),onclick:clearDl}):null)); }
function offlineSection(body){ dlBox=h('div',{class:'dlbox'}); body.append(h('h3',{class:'h3',text:T('Χάρτης εκτός σύνδεσης','Offline map')}),dlBox); paintDl(); }

function layersSheet(){
  var body=h('div',{class:'bform'});
  body.append(h('div',{class:'fld'},h('span',{text:T('Χάρτης','Map')}),B.seg([['sat',T('Δορυφόρος','Satellite')],['osm',T('Δρόμοι','Streets')]],cfg.base,function(v){ cfg.base=v; saveCfg(); drawBase(); })));
  /* βάθη */
  var dm=dmode(), dl=(window.PsaroDense&&PsaroDense.mode())||ls.get('psaro-dl','std'), dlRow=h('div',{class:'fld',hidden:dm!==2});
  function dlSeg(){ dlRow.replaceChildren(h('span',{text:T('Γραμμές βάθους κάθε','Depth lines every')}),B.seg([['std',T('Στάνταρ','Standard')],['5','5 m'],['10','10 m'],['20','20 m']],dl,function(v){ dl=v; setDepth(2,v); },T('Πυκνότητα γραμμών','Line density')),h('small',{class:'wn',text:T('Οι γραμμές 5, 10 και 20 m φτιάχνονται από το πλέγμα βαθών EMODnet (~125 m) και φαίνονται από ζουμ 11 και πάνω.','The 5, 10 and 20 m lines are built from the EMODnet depth grid (~125 m) and show from zoom 11 up.')})); }
  dlSeg();
  body.append(h('div',{class:'fld'},h('span',{text:T('Βάθη θάλασσας','Sea depths')}),B.seg([['0',T('Κλειστά','Off')],['1',T('Χρώματα','Colours')],['2',T('Γραμμές','Lines')]],String(dm),function(v){ dm=+v; dlRow.hidden=dm!==2; setDepth(dm,dm===2?dl:null); },T('Βάθη θάλασσας','Sea depths'))),dlRow);
  /* καιρός στον χάρτη */
  var ready=!!window.PsaroWindMap;
  function wxTg(lab,sub,on,fn){ var i=h('input',{type:'checkbox',checked:on,disabled:!ready,onchange:function(ev){ fn(ev.target.checked); }}); return h('label',{class:'tg'},i,h('span',null,lab,sub?h('small',{class:'tgsub',text:sub}):null)); }
  body.append(h('h3',{class:'h3',text:T('Καιρός στον χάρτη','Weather on the map')}),
    wxTg(T('Άνεμος (κινούμενος, 48 ώρες)','Wind (animated, 48 hours)'),T('Μοντέλα ECMWF, ICON, GFS. Πάτα στον χάρτη για ένταση και κατεύθυνση.','ECMWF, ICON and GFS models. Tap the map for strength and direction.'),windOn(),setWind),
    wxTg(T('Κατάσταση θάλασσας (κύμα)','Sea state (waves)'),T('Χρώματα κατά ύψος κύματος, με την ώρα του ανέμου.','Colours by wave height, following the wind hour.'),seaOn(),setSeaSt),
    wxTg(T('Σταθμοί ανέμου (μετρήσεις τώρα)','Wind stations (live observations)'),'',pressed('bWindSt'),setStations));
  if(cbtn('bNav')) body.append(wxTg(T('Περιορισμοί ψαρέματος (ProtectedSeas)','Fishing restrictions (ProtectedSeas)'),T('Προστατευόμενες περιοχές και κανόνες στην Ανατολική Μεσόγειο. Κατά την έξοδο σε ειδοποιεί όταν μπαίνεις σε περιοχή με περιορισμούς.','Protected areas and rules in the eastern Mediterranean. During a trip it warns you when you enter a restricted area.'),pressed('bNav'),function(v){ if(pressed('bNav')!==v){ var b=cbtn('bNav'); if(b) b.click(); } }));
  body.append(h('h3',{class:'h3',text:T('Λιμάνια','Ports')}),wxTg(T('Λιμάνια, μαρίνες και ράμπες','Ports, marinas and boat ramps'),T('Από το OpenStreetMap. Μπορεί να λείπουν ή να είναι παλιά.','From OpenStreetMap. May be missing or out of date.'),pressed('bPorts'),function(v){ if(pressed('bPorts')!==v){ var b=cbtn('bPorts'); if(b) b.click(); } }),
    window.PsaroPorts?h('button',{class:'btn full',type:'button',text:T('Πρόσθεσε δικό σου λιμάνι ή ράμπα','Add your own port or ramp'),onclick:function(){ B.closeSheet(); PsaroPorts.startAdd(); }}):null);
  if(!ready) body.append(h('p',{class:'sub',text:T('Φορτώνει…','Loading…')}));
  body.append(h('h3',{class:'h3',text:T('Στον χάρτη','On the map')}));
  body.append(h('label',{class:'tg'},h('input',{type:'checkbox',checked:ls.get('psaro-v4-mapwx',true)!==false,onchange:function(ev){ ls.set('psaro-v4-mapwx',ev.target.checked); drawMw(); }}),h('span',{text:T('Κάρτα καιρού (άνεμος, πίεση, νερό…)','Weather card (wind, pressure, water…)')})));
  [['sea',T('Ναυτικά σήματα (OpenSeaMap)','Sea marks (OpenSeaMap)')],['spots',T('Τα σημεία μου','My spots')],['fish',T('Τα ψάρια μου','My catches')],['zones',T('Απαγόρευση αλιείας','No-fishing areas')],['mpa',T('Προστατευόμενες περιοχές','Protected areas')],['dams',T('Φράγματα και πληρότητα','Reservoirs and levels')]].forEach(function(o){
    body.append(h('label',{class:'tg'},h('input',{type:'checkbox',checked:!!cfg[o[0]],onchange:function(ev){ cfg[o[0]]=ev.target.checked; saveCfg(); if(o[0]==='sea'){ drawBase(); applyDepth(); } else if(o[0]==='spots'||o[0]==='fish') drawData(); else drawOverlays(); }}),h('span',{text:o[1]}))); });
  offlineSection(body);
  if(B.shareSpots) body.append(h('button',{class:'btn full',type:'button',text:T('Στείλε όλα τα σημεία μου σε φίλο','Send all my spots to a friend'),onclick:function(){ B.shareSpots(S().raw('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'; })); }}));
  body.append(h('p',{class:'foot',text:T('Νέο σημείο: πάτα παρατεταμένα στον χάρτη. Βάθη, άνεμος και κύμα είναι ενδεικτικά (μοντέλα και EMODnet), όχι ναυτικός χάρτης ή όργανο.','New spot: long-press on the map. Depths, wind and waves are indicative (models and EMODnet), not a nautical chart or instrument.')}));
  B.sheet({title:T('Στρώματα','Layers'),body:body});
}

/* ---------- σελίδα ---------- */
var box=null, lmEl=null, fishb=null;
function fishCounts(){ if(!fishb||!B.tripCounts) return; var c=B.tripCounts(), b=fishb.querySelectorAll('b'); b[0].textContent=c.miss; b[1].textContent=c.n; }
function mount(el){
  root=el; document.body.classList.add('mapon'); cfg=Object.assign({base:'sat',sea:true,spots:true,fish:true,zones:true,mpa:false,dams:B.prof()==='lake',wind:false,seast:false},ls.get('psaro-v4-map',{}));
  if(!box){ lmEl=h('div',{class:'lmap',id:'lmap'}); box=h('div',{class:'mapbox',id:'v4map'},lmEl); }
  if(!mbtns){ mbtns=h('div',{class:'mapbtns'}); hookBtns(); }
  var bar=h('div',{class:'mapbar'},
    h('button',{class:'iconbtn',type:'button','aria-label':T('Στρώματα','Layers'),html:B.iconSvg('map'),onclick:layersSheet}),
    h('button',{class:'iconbtn',type:'button','aria-label':T('Η θέση μου','My position'),html:B.iconSvg('gps'),onclick:function(){ locate(true); }}),
    h('button',{class:'iconbtn',type:'button','aria-label':T('Νέο σημείο εδώ','New spot here'),html:B.iconSvg('star'),onclick:function(){ spotForm(null,map.getCenter()); }}),
    h('button',{class:'iconbtn gearbtn',type:'button','aria-label':T('Εργαλεία: παραγάδι, δίχτυ, ζεμπίλι','Gear: longline, net, pot'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/></svg>',onclick:function(){ if(B.gearPanel) B.gearPanel(); }}),
    mbtns);
  var trip=h('button',{class:'tripbtn',type:'button',onclick:function(){ B.tripStart(); }},h('span',{text:T('Έναρξη εξόδου','Start a trip')}));
  var seab=h('div',{class:'seabar'},h('button',{class:'mobbtn',type:'button','aria-label':'MOB',text:'MOB',onclick:function(){ B.mob(); }}),B.voice&&B.voice.ok?h('button',{class:'iconbtn micmap',type:'button','aria-label':T('Φωνητική καταγραφή ψαριού','Voice catch log'),html:B.voice.MIC,onclick:function(){ B.voice.log(); }}):null,h('button',{class:'iconbtn ancbtn',type:'button','aria-label':T('Συναγερμός άγκυρας','Anchor alarm'),text:'⚓',onclick:function(){ if(B.anchor()) B.ask(T('Να σταματήσει ο συναγερμός άγκυρας;','Turn off the anchor alarm?'),T('Σταμάτημα','Turn off')).then(function(y){ if(y) B.anchorOff(); }); else B.anchorOn(); }}));
  var cross=h('div',{class:'cross','aria-hidden':'true'});
  /* κατά την έξοδο: πράσινο ψάρι = έπιασα (φόρμα), κόκκινο = τσίμπησε και χάθηκε (καταγράφεται αμέσως). Κράτα πατημένο = διαγραφή του τελευταίου. */
  var FB='<path d="M3 12C8 4.5 17 4 22 12c-5 8-14 7.5-19 0z"/><path d="M22 12l7-6.5v13z"/>';
  var bCatch=h('button',{class:'fb fbc',type:'button','aria-label':T('Έπιασα ψάρι (κράτα για διαγραφή του τελευταίου)','Caught a fish (hold to delete the last one)'),html:'<svg viewBox="0 0 32 24" aria-hidden="true" fill="currentColor">'+FB+'</svg><b>0</b>'});
  var bMiss=h('button',{class:'fb fbm',type:'button','aria-label':T('Τσίμπησε αλλά χάθηκε (κράτα για διαγραφή της τελευταίας)','Bite but lost (hold to delete the last one)'),html:'<svg viewBox="0 0 32 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">'+FB+'<path d="M5 22L27 2" stroke-width="2.6" stroke-linecap="round"/></svg><b>0</b>'});
  function hold(btn,miss){ var t=null, held=false; btn.addEventListener('pointerdown',function(){ held=false; clearTimeout(t); t=setTimeout(function(){ held=true; try{ navigator.vibrate&&navigator.vibrate(25); }catch(e){} B.quickUndo(miss); },550); });
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ btn.addEventListener(ev,function(){ clearTimeout(t); }); }); btn.addEventListener('contextmenu',function(e){ e.preventDefault(); });
    btn.addEventListener('click',function(){ if(held){ held=false; return; } if(miss) B.quickRec(true); else B.biteForm(); }); }
  hold(bCatch,false); hold(bMiss,true);
  fishb=h('div',{class:'fishbtns'},bMiss,bCatch); fishCounts();
  el.replaceChildren(box,cross,bar,trip,seab,dtBarEl(),fishb,mwBox());
  if(B.smartChip){ var rc=h('div',{class:'rtwrap'}); B.smartChip().forEach(function(n){ rc.append(n); }); el.append(rc); }
  if(map){ setTimeout(function(){ if(!map) return; map.invalidateSize(); drawData(); applyPend(); drawDirect(); },30); locate(false); return; }
  leaflet().then(function(){
    if(!root||map) return;
    var p=B.lastPos(), v=ls.get('psaro-v4-mapview',null);
    map=L.map(lmEl,{zoomControl:false,attributionControl:true,tap:true}).setView(v?[v.lat,v.lon]:(p?[p.lat,p.lon]:[35.0,33.2]),v?v.z:(p?12:9));
    drawBase(); drawData(); drawOverlays(); applyDepth(); applyPend(); locate(false); drawDirect();
    map.on('moveend',function(){ var c=map.getCenter(); ls.set('psaro-v4-mapview',{lat:+c.lat.toFixed(5),lon:+c.lng.toFixed(5),z:map.getZoom()}); });
    map.on('contextmenu',function(e){ spotForm(null,e.latlng); });
    map.on('dragstart zoomstart',function(){ followPause=Date.now()+20000; }); map.on('popupopen',function(){ followPause=Date.now()+20000; });
    map.on('popupopen',function(e){ var c=e.popup.getContent(); if(c&&c.classList&&c.classList.contains('portpop')&&!c.querySelector('.pgo')){ var ll=e.popup.getLatLng(), nm=(c.querySelector('b')||{}).textContent||''; var r=c.querySelector('.pbtns')||c; var g=h('button',{class:'pb pgo',type:'button',text:T('Πήγαινε εκεί','Go there'),onclick:function(){ map.closePopup(); B.goTo(ll.lat,ll.lng,nm); }}); r.insertBefore(g,r.firstChild); e.popup.update(); } });
    setTimeout(function(){ map.invalidateSize(); },60);
    classicMods();
  }).catch(function(){ box.replaceChildren(h('div',{class:'card empty',style:{margin:'80px 16px'}},h('h3',{text:T('Ο χάρτης δεν φορτώθηκε','The map did not load')}),h('p',{text:T('Έλεγξε τη σύνδεση.','Check your connection.')}))); });
}
/* ο χάρτης δεν καταστρέφεται: μένει έτοιμος με τα στρώματά του για την επόμενη φορά· σταματά μόνο το GPS της σελίδας */
function unmount(){ document.body.classList.remove('mapon'); if(watch!=null){ try{ navigator.geolocation.clearWatch(watch); }catch(e){} watch=null; } document.body.classList.remove('maptrip'); root=null; }
/* μετάβαση στον χάρτη σε ένα σημείο (ψάρι, σημείο από φίλο) ή με μια διαδρομή εξόδου */
var pend=null, gRev=null;
function applyPend(){ if(!pend||!map) return false; var q=pend; pend=null;
  if(gRev){ map.removeLayer(gRev); gRev=null; }
  if(q.tr&&q.tr.length>1){ gRev=L.layerGroup([L.polyline(q.tr.map(function(p){ return [p[0],p[1]]; }),{color:'#ff8a50',weight:5,opacity:.95}),L.circleMarker(q.tr[0],{radius:7,color:'#fff',weight:3,fillColor:'#3ddc97',fillOpacity:1}),L.circleMarker(q.tr[q.tr.length-1],{radius:7,color:'#fff',weight:3,fillColor:'#ff4d4d',fillOpacity:1})]).addTo(map); map.fitBounds(L.latLngBounds(q.tr.map(function(p){ return [p[0],p[1]]; })),{padding:[40,40]}); }
  else { map.setView([q.lat,q.lon],q.z||15); gRev=L.layerGroup([L.circleMarker([q.lat,q.lon],{radius:11,color:'#E4572E',weight:3,fillOpacity:.15})]).addTo(map); }
  return true; }
B.mapGo=function(lat,lon,z,tr){ pend={lat:lat,lon:lon,z:z,tr:tr}; if(map&&root) applyPend(); else location.hash='#map'; };

B.view('map',{title:T('Χάρτης','Map'),mount:mount,unmount:unmount,resume:function(){ if(map&&root){ map.invalidateSize(); drawData(); } }});
B.on('store',function(k){ if(map&&/^psaro-(bites|spots|gear)$/.test(k)) drawData(); });
B.on('gear-pos',function(){ if(map) drawGear(); });
['track','anchor','mob','trip'].forEach(function(n){ B.on(n,function(){ if(map) drawSea(); fishCounts(); }); });
B.on('store',function(k){ if(k==='psaro-bites') fishCounts(); if(k==='psaro-fc7'||k==='psaro-units') drawMw(); });
setInterval(function(){ if(root) drawMw(); },10*60000);
})();
