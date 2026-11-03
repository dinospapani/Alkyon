/* Alkyon 4 · Χάρτης: η θέση σου, τα σημεία σου, τα ψάρια σου, νέο σημείο, πρόγνωση εδώ, πλοήγηση.
   Η έξοδος (ίχνος, ασφάλεια, άγκυρα, MOB) μένει σε μία μόνο υλοποίηση, της κλασικής, γιατί αφορά την ασφάλεια στη θάλασσα. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var root=null, map=null, layers={}, base=null, sea=null, me=null, meAcc=null, watch=null, gSpots=null, gFish=null;
var TILES={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
B.tileTpl={sat:TILES.sat,sea:TILES.sea}; /* v31z550: για το κατέβασμα πριν την έξοδο (prefetch.js, sw.js) */
var cfg=Object.assign({base:'sat',sea:true,spots:true,fish:true,zones:true,depth:false,mpa:false,dams:B.prof()==='lake',wind:false},ls.get('alkyon-v4-map',{}));
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
function saveCfg(){ ls.set('alkyon-v4-map',cfg); }
function S(){ return B.store; }
var SPT=EN?['Rocks / reef','Sand','Wreck','Ledge / drop-off','Current / open water','Harbour / pier','Other']:['Βράχια / ύφαλος','Άμμος','Ναυάγιο','Ταμπλά / κατωφλι','Ρεύμα / ανοιχτά','Λιμάνι / μώλος','Άλλο'];

/* Leaflet φορτώνεται μόνο όταν ανοίξει ο χάρτης */
var lp=null;
function leaflet(){ if(window.L) return Promise.resolve(window.L); if(lp) return lp;
  lp=new Promise(function(res,rej){ var c=document.createElement('link'); c.rel='stylesheet'; c.href='../leaflet.css'; document.head.appendChild(c);
    var s=document.createElement('script'); s.src='../leaflet.js'; s.onload=function(){ res(window.L); }; s.onerror=rej; document.head.appendChild(s);
    if(!window.ZONES){ var z=document.createElement('script'); z.src='../zones.js'; z.onload=function(){ if(map) drawOverlays(); }; document.head.appendChild(z); } }); return lp; }

B.leaflet=leaflet; /* v31z532: και για τον μικρό χάρτη επιλογής σημείου (coordpick) */
function icon(cls,html){ return L.divIcon({className:'mk '+cls,html:html||'',iconSize:null}); }
function drawBase(){ if(base) map.removeLayer(base); base=L.tileLayer(TILES[cfg.base],{maxZoom:19,maxNativeZoom:cfg.base==='sat'?18:19,attribution:cfg.base==='sat'?'Esri':'© OpenStreetMap'}).addTo(map); base.bringToBack();
  if(sea){ map.removeLayer(sea); sea=null; } if(cfg.sea) sea=L.tileLayer(TILES.sea,{maxZoom:19,maxNativeZoom:18,opacity:.9}).addTo(map); }
/* ---------- «Πού πιάνω»: πυκνότητα των δικών σου ψαριών, με φίλτρο μήνα και είδους ---------- */
var gHeat=null, heatPill=null;
function hf(){ var f=ls.get('alkyon-v4-heatf',{})||{}; return {m:f.m==null?'all':f.m,sp:f.sp||''}; }
function heatList(){ var f=hf(), cm=new Date().getMonth()+1;
  return S().raw('bites').filter(function(b){ if(b.deleted||b.miss||B.pest(b)||typeof b.lat!=='number'||!b.date) return false; var m=+b.date.slice(5,7);
    if(f.m==='near'){ var d=Math.abs(m-cm); if(Math.min(d,12-d)>1) return false; } else if(f.m!=='all'&&+f.m!==m) return false;
    if(f.sp&&(b.species||'')!==f.sp) return false; return true; }); }
var MONS=EN?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']:['Ιαν','Φεβ','Μάρ','Απρ','Μάι','Ιούν','Ιούλ','Αύγ','Σεπ','Οκτ','Νοέ','Δεκ'];
function heatLabel(){ var f=hf(); return (f.m==='all'?T('Όλοι οι μήνες','All months'):f.m==='near'?T('Αυτή την εποχή','This season'):MONS[+f.m-1])+(f.sp?' · '+f.sp:''); }
function drawHeat(){ if(gHeat&&map){ map.removeLayer(gHeat); gHeat=null; } if(heatPill){ heatPill.hidden=!cfg.heat; } if(!map||!cfg.heat) return;
  var a=heatList(), cells={}, mx=1; a.forEach(function(b){ var k=Math.round(b.lat*220)+'_'+Math.round(b.lon*180); var c=cells[k]||(cells[k]={la:0,lo:0,n:0}); var w=Math.max(1,Math.floor(+b.cnt)||1); c.la+=b.lat*w; c.lo+=b.lon*w; c.n+=w; if(c.n>mx) mx=c.n; });
  gHeat=L.layerGroup(); Object.keys(cells).forEach(function(k){ var c=cells[k], r=c.n/mx, col=r>.66?'#e53935':r>.33?'#fb8c00':'#fdd835';
    L.circle([c.la/c.n,c.lo/c.n],{radius:260+340*r,stroke:false,fillColor:col,fillOpacity:.22+.38*r,interactive:false}).addTo(gHeat);
    L.circle([c.la/c.n,c.lo/c.n],{radius:90+110*r,stroke:false,fillColor:col,fillOpacity:.45+.3*r,interactive:false}).addTo(gHeat); });
  gHeat.addTo(map); try{ gHeat.eachLayer(function(l){ l.bringToBack&&l.bringToBack(); }); }catch(e){}
  if(heatPill){ heatPill.querySelector('b').textContent=heatLabel(); heatPill.querySelector('small').textContent=a.length+' '+T(a.length===1?'ψάρι':'ψάρια',a.length===1?'catch':'catches'); } }
function heatSheet(){ var f=hf(), body=h('div',{class:'bform'});
  var ms=h('select',{class:'select'}); [['all',T('Όλοι οι μήνες','All months')],['near',T('Αυτή την εποχή (±1 μήνας)','This season (±1 month)')]].concat(MONS.map(function(m,i){ return [String(i+1),m]; })).forEach(function(o){ ms.append(h('option',{value:o[0],text:o[1]})); }); ms.value=String(f.m);
  var cnt={}; S().raw('bites').forEach(function(b){ if(!b.deleted&&!b.miss&&!B.pest(b)&&b.species&&typeof b.lat==='number') cnt[b.species]=(cnt[b.species]||0)+1; });
  var ss=h('select',{class:'select'}); ss.append(h('option',{value:'',text:T('Όλα τα είδη','All species')})); Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }).forEach(function(k){ ss.append(h('option',{value:k,text:k+' ('+cnt[k]+')'})); }); ss.value=f.sp;
  function upd(){ ls.set('alkyon-v4-heatf',{m:ms.value,sp:ss.value}); drawHeat(); } ms.addEventListener('change',upd); ss.addEventListener('change',upd);
  body.append(h('p',{class:'sub',text:T('Χρώμα από τα δικά σου ψάρια: κίτρινο λίγα, πορτοκαλί αρκετά, κόκκινο τα περισσότερα.','Coloured from your own catches: yellow few, orange more, red the most.')}),h('label',{class:'fld'},h('span',{text:T('Μήνας','Month')}),ms),h('label',{class:'fld'},h('span',{text:T('Είδος','Species')}),ss),
    h('button',{class:'btn full',type:'button',text:T('Απόκρυψη','Hide'),onclick:function(){ cfg.heat=false; saveCfg(); drawHeat(); B.closeSheet(); }}));
  B.sheet({title:T('Πού πιάνω','Where I catch'),body:body}); }
/* χρώμα ανά είδος και τύπος σημείου (ίδια λογική με την κλασική app.js: FISH_GROUPS, spotKind) */
var FISH_GROUPS=[['ceph',/^(loligo|sepia|octopus|sepioteuthis|illex|todarodes|alloteuthis|eledone)\b/i,/καλαμ|σουπι|χταπ|θράψαλ|squid|cuttle|octopus/i],
  ['grouper',/^(epinephelus|mycteroperca|cephalopholis|polyprion)\b/i,/σφυρίδ|ροφ|στήρα|βλάχ|grouper|wreckfish/i],['bass',/^(dicentrarchus)\b/i,/λαβρ|seabass|sea bass/i],
  ['pelagic',/^(thunnus|euthynnus|sarda|seriola|lichia|coryphaena|scomber|auxis|pomatomus|sphyraena|trachinotus|scomberomorus|katsuwonus|xiphias)\b/i,/τόνο|παλαμ|μαγιάτικ|λίτσα|λύτσα|κυνηγ|σκουμπρ|κολι|γοφάρ|λούτζ|ξιφί|tuna|bonito|amberjack|leerfish|dolphinfish|mackerel|bluefish|barracuda|swordfish/i],
  ['sparid',/^(diplodus|sparus|pagrus|pagellus|dentex|oblada|lithognathus|spondyliosoma|sarpa|boops|crenidens)\b/i,/σαργ|τσιπούρ|φαγκρ|λυθρίν|μουρμ|συναγρίδ|μελανούρ|σκαθάρ|σάλπα|γόπα|bream|dentex|pandora|porgy/i],['mullet',/^(mullus)\b/i,/μπαρμπούν|κουτσομούρ|red mullet|goatfish/i]];
function fishGroup(b){ var la=(b.latin||'').trim(), nm=(b.species||'').trim(); for(var i=0;i<FISH_GROUPS.length;i++){ var g=FISH_GROUPS[i]; if((la&&g[1].test(la))||(nm&&g[2].test(nm))) return g[0]; } return 'other'; }
function spotKind(sp){ var t=(sp.type||''); return /ναυάγ|wreck/i.test(t)?'wreck':/άμμο|sand/i.test(t)?'sand':/ταμπλ|κατωφλ|drop|ledge|step/i.test(t)?'ledge':/ρεύμ|ανοιχτ|current|open/i.test(t)?'current':/λιμάν|μώλ|port|jetty|pier|harbo/i.test(t)?'port':/βράχ|ύφαλ|rock|reef/i.test(t)?'reef':'other'; }
var FSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12c3-5 10-5.5 13.5-1.2L21 7v10l-5-3.8C12.5 17.5 5.5 17 2.5 12z"/><circle cx="7.2" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>', CSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 0 5 2.4 5 5.5V13H7V8.5C7 5.4 9 3 12 3z"/><path d="M8 13c0 3-1.5 5-3 7M10.5 13c0 3-.5 5.5-1.5 7.5M13.5 13c0 3 .5 5.5 1.5 7.5M16 13c0 3 1.5 5 3 7"/></svg>';
B.fishGroup=fishGroup;
function drawData(){
  if(!map) return;
  if(gSpots) map.removeLayer(gSpots); if(gFish) map.removeLayer(gFish);
  gSpots=L.layerGroup(); gFish=L.layerGroup();
  /* ομαδοποίηση: ό,τι πέφτει πιο κοντά από ~36 pixel στην οθόνη γίνεται ένας δείκτης με αριθμό (αλλάζει με το ζουμ) */
  var z=map.getZoom(), R=36;
  function cluster(items,ll){ var out=[]; items.forEach(function(it){ var p=map.project(ll(it),z), hit=null;
      for(var i=0;i<out.length;i++){ var c=out[i]; if(Math.abs(c.x-p.x)<R&&Math.abs(c.y-p.y)<R){ hit=c; break; } }
      if(hit){ hit.a.push(it); hit.x=(hit.x*(hit.a.length-1)+p.x)/hit.a.length; hit.y=(hit.y*(hit.a.length-1)+p.y)/hit.a.length; } else out.push({x:p.x,y:p.y,a:[it]}); });
    return out.map(function(c){ return {ll:map.unproject(L.point(c.x,c.y),z),a:c.a}; }); }
  function spread(a,ll){ var b=L.latLngBounds(a.map(ll)); return b.getNorthEast().distanceTo(b.getSouthWest()); }
  if(cfg.spots){ var sps=S().raw('spots').filter(function(sp){ return !sp.deleted&&typeof sp.lat==='number'; }), sll=function(sp){ return L.latLng(sp.lat,sp.lon); };
    cluster(sps,sll).forEach(function(c){ if(c.a.length===1){ var sp=c.a[0]; L.marker([sp.lat,sp.lon],{icon:icon('spot k-'+spotKind(sp),'<i></i><b>'+esc(sp.name||'')+'</b>'),keyboard:true,title:sp.name||''}).on('click',function(){ spotSheet(sp); }).addTo(gSpots); return; }
      L.marker(c.ll,{icon:icon('spot grp','<i>'+c.a.length+'</i>'),title:c.a.map(function(x){ return x.name; }).join(', ')}).on('click',function(){ if(spread(c.a,sll)<120||map.getZoom()>=17) spotList(c.a); else map.fitBounds(L.latLngBounds(c.a.map(sll)).pad(0.5),{maxZoom:17}); }).addTo(gSpots); }); }
  if(cfg.fish){ var fs=S().raw('bites').filter(function(b){ return !b.deleted&&typeof b.lat==='number'&&(!b.miss||cfg.miss!==false); }), fll=function(b){ return L.latLng(b.lat,b.lon); };
    cluster(fs,fll).forEach(function(c){ var a=c.a, caught=a.filter(function(b){ return !b.miss; }), n=caught.reduce(function(s,b){ return s+Math.max(1,Math.floor(+b.cnt)||1); },0), cls, html;
      if(!caught.length){ cls='fish miss'; html=a.length>1?'<b>'+a.length+'</b>':'✕'; }
      else { var gc={}; caught.forEach(function(b){ var g=fishGroup(b); gc[g]=(gc[g]||0)+1; }); var g=Object.keys(gc).sort(function(x,y){ return gc[y]-gc[x]; })[0];
        if(n>1){ cls='fish many g-'+g; html='<b>'+n+'</b>'; } else { var b0=caught[0]; cls='fish sym g-'+g+(b0.photo?' ph':'')+(b0.rel?' rel':'')+(b0.prof==='spear'?' sp':b0.prof==='lake'?' lk':''); html=g==='ceph'?CSVG:FSVG; } }
      L.marker(c.ll,{icon:icon(cls,html),title:a.map(function(b){ return b.miss?T('Χαμένο','Lost'):b.species; }).join(', ')}).on('click',function(){ if(a.length===1||spread(a,fll)<150||map.getZoom()>=17) fishSheet(a); else map.fitBounds(L.latLngBounds(a.map(fll)).pad(0.5),{maxZoom:17}); }).addTo(gFish); }); }
  gFish.addTo(map); gSpots.addTo(map);
  drawGear(); drawSea(); drawHeat();
  if(typeof declutterSoon==='function') declutterSoon();
}
/* έξοδος: διαδρομή, άγκυρα, MOB */
var gSea=null;
function drawSea(){ if(!map) return; if(gSea) map.removeLayer(gSea); gSea=L.layerGroup().addTo(map);
  var t=B.trip&&B.trip.track(); if(t&&t.pts.length>1) L.polyline(t.pts.map(function(p){ return [p[0],p[1]]; }),{color:'#ff8a50',weight:4,opacity:.9}).addTo(gSea);
  var a=B.anchor&&B.anchor(); if(a){ L.circle([a.lat,a.lon],{radius:a.r,color:'#ffb020',weight:2,fillColor:'#ffb020',fillOpacity:.12,dashArray:'6 6'}).addTo(gSea); L.circleMarker([a.lat,a.lon],{radius:6,color:'#fff',weight:2,fillColor:'#ffb020',fillOpacity:1}).addTo(gSea); }
  var fx=(B.trip&&B.trip.fix())||B.lastPos();
  (B.mobs?B.mobs():[]).forEach(function(m){ L.marker([m.lat,m.lon],{icon:icon('mob','<b>MOB</b>')}).on('click',function(){ mobSheet(m); }).addTo(gSea); if(fx) L.polyline([[fx.lat,fx.lon],[m.lat,m.lon]],{color:'#ff3b30',weight:3,dashArray:'6 6'}).addTo(gSea); });
  var on=B.trip&&B.trip.active(); document.body.classList.toggle('maptrip',!!on); if(on) document.body.setAttribute('data-tprof',B.prof()); else document.body.removeAttribute('data-tprof'); var tb=root&&root.querySelector('.tripbtn'); if(tb) tb.hidden=!!on; }
function mobSheet(m){ var fx=(B.trip&&B.trip.fix())||B.lastPos(), rows=[[T('Ώρα','Time'),new Date(m.t).toTimeString().slice(0,5)],[T('Συντεταγμένες','Coordinates'),m.lat.toFixed(5)+', '+m.lon.toFixed(5)]];
  if(fx){ var R=6371000, r=Math.PI/180, dLa=(m.lat-fx.lat)*r, dLo=(m.lon-fx.lon)*r, x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(fx.lat*r)*Math.cos(m.lat*r)*Math.sin(dLo/2)*Math.sin(dLo/2), d=2*R*Math.asin(Math.min(1,Math.sqrt(x)));
    var y=Math.sin(dLo)*Math.cos(m.lat*r), xx=Math.cos(fx.lat*r)*Math.sin(m.lat*r)-Math.sin(fx.lat*r)*Math.cos(m.lat*r)*Math.cos(dLo), br=(Math.atan2(y,xx)/r+360)%360; rows.push([T('Απόσταση','Distance'),d<1000?Math.round(d)+' m':B.num(d/1852,2)+' nm'],[T('Πορεία','Bearing'),Math.round(br)+'°']); }
  var sh=B.sheet({title:'MOB',body:h('div',null,h('div',{class:'card'},h('div',{class:'rows one'},rows.map(function(q){ return h('div',{class:'row'},h('span',{text:q[0]}),h('b',{text:q[1]})); }))),h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Πήγαινε εκεί','Go there'),onclick:function(){ B.goTo(m.lat,m.lon,'MOB'); }}),h('button',{class:'btn del',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ B.mobDel(m.t); sh.close(); }})))}); }
var gGear=null, gShow=null;
/* v31z549: το εργαλείο από «Στον χάρτη» μένει ορατό (και αν έχει ανέβει) μέχρι να το κλείσεις από το ✕ */
function drawGear(){ if(!map||!B.gearLayers) return; if(gGear) map.removeLayer(gGear); var show=ls.get('alkyon-v4-gearshow',null), fit=false;
  if(show){ ls.set('alkyon-v4-gearshow',null); gShow=show; fit=true; }
  var lys=B.gearLayers(L,null); if(gShow) lys=lys.concat(B.gearLayers(L,[gShow]));
  gGear=L.layerGroup(lys).addTo(map);
  if(fit){ var g=B.gearFind?B.gearFind(gShow):B.gearOf(gShow), pts=B.gearPts?B.gearPts(g):[];
    if(pts.length){ setFollow(false); followPause=Date.now()+60000; map.fitBounds(L.latLngBounds(pts),{padding:[60,60],maxZoom:16});
      var id=gShow; revShow((g&&(g.name||''))||T('Εργαλείο','Gear'),null); revOnClear=function(){ if(gShow===id){ gShow=null; drawGear(); } }; }
    else { gShow=null; B.toast(T('Αυτό το εργαλείο δεν έχει θέση στον χάρτη.','This gear has no position on the map.')); } } }
function esc(s){ return String(s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* ---------- επιπλέον στρώματα ---------- */
/* 1.1.0: δορυφορικές στρώσεις Copernicus (χλωροφύλλη = τροφή, θερμοκρασία επιφάνειας 1 km). Η συνάρτηση water-clarity (mode=layers)
   δίνει τις διευθύνσεις των πλακιδίων με την πιο πρόσφατη μέρα· τα πλακίδια φορτώνονται απευθείας από τον Copernicus. */
var SATK='alkyon-v4-ovl';
function satInfo(){ var c=ls.get(SATK,null); if(c&&c.v&&Date.now()-c.at<6*3600000) return Promise.resolve(c.v);
  return fetch('https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/water-clarity?mode=layers',{headers:{apikey:'sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA',Authorization:'Bearer sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA'}})
    .then(function(r){ return r.ok?r.json():null; }).then(function(v){ if(v&&(v.chl||v.sst)) ls.set(SATK,{at:Date.now(),v:v}); return v; }).catch(function(){ return c&&c.v||null; }); }
function drawSat(){ ['chl','sats'].forEach(function(k){ if(ov[k]){ map.removeLayer(ov[k]); ov[k]=null; } });
  if(!cfg.chl&&!cfg.sats) return;
  satInfo().then(function(v){ if(!map) return;
    var add=function(k,d){ if(!d||!d.url||ov[k]) return;
      /* 1.2.2: στενή κλίμακα χρωμάτων (url2) για να φαίνονται οι διαφορές στη Μεσόγειο· αν δεν φορτώνει, γυρίζει στην προεπιλεγμένη */
      var u=d.url2||d.url, bad=0, ly=L.tileLayer(u,{opacity:k==='chl'?.75:.65,maxZoom:19,maxNativeZoom:10,attribution:'Copernicus Marine',zIndex:250,className:'sattile'});
      ly.on('tileerror',function(){ if(u!==d.url&&++bad>=3){ u=d.url; ly.setUrl(d.url); } }); ov[k]=ly.addTo(map); };
    if(cfg.chl) add('chl',v&&v.chl); if(cfg.sats) add('sats',v&&v.sst);
    if((cfg.chl&&!(v&&v.chl))||(cfg.sats&&!(v&&v.sst))) B.toast(T('Η δορυφορική στρώση δεν είναι διαθέσιμη τώρα. Δοκίμασε αργότερα.','The satellite layer isn’t available right now. Try later.')); }); }
function satNote(k){ var c=ls.get(SATK,null), d=c&&c.v&&c.v[k]; var day=d&&d.day?' · '+d.day.slice(8,10)+'/'+d.day.slice(5,7):'';
  B.toast(k==='chl'?T('Χλωροφύλλη (πλαγκτόν)','Chlorophyll (plankton)')+day+': '+T('ανοιχτό = λίγη τροφή, σκούρο πράσινο = πολλή. Εκεί που αλλάζει απότομα το χρώμα (μέτωπο) μαζεύεται η τροφή και τα ψάρια.','light = little food, dark green = a lot. Where the colour changes sharply (a front), food and fish gather.'):T('Θερμοκρασία νερού από δορυφόρο','Satellite water temperature')+day+': '+T('σκούρο = πιο κρύο, κίτρινο = πιο ζεστό','dark = colder, yellow = warmer')+(d&&d.range?' ('+d.range[0]+'–'+d.range[1]+'°C)':'')+T('. Ψάξε τα σημεία όπου αλλάζει απότομα το χρώμα (θερμικό μέτωπο).','. Look for places where the colour changes sharply (a thermal front).'),7000); }
function drawOverlays(){
  if(!map) return;
  Object.keys(ov).forEach(function(k){ if(ov[k]){ map.removeLayer(ov[k]); ov[k]=null; } });
  drawSat();
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
/* ---------- βάθη: ίδιες καταστάσεις με την κλασική (alkyon-depth 0 κλειστά / 1 χρώματα / 2 γραμμές, alkyon-dl πυκνότητα) ---------- */
var depthC=null, depthK=null;
function dmode(){ var v=+ls.get('alkyon-depth',0)||0; return v>=0&&v<=2?v:0; }
function applyDepth(){
  if(!map) return; var WM='https://ows.emodnet-bathymetry.eu/wms';
  if(!depthC){ depthC=L.tileLayer.wms(WM,{layers:'emodnet:mean_multicolour',format:'image/png',transparent:true,opacity:.6,version:'1.3.0',attribution:'EMODnet Bathymetry'}); depthK=L.tileLayer.wms(WM,{layers:'emodnet:contours',format:'image/png',transparent:true,version:'1.3.0',attribution:'EMODnet Bathymetry'}); }
  var dm=dmode(); [depthC,depthK].forEach(function(l){ if(map.hasLayer(l)) map.removeLayer(l); });
  if(dm===1) depthC.addTo(map); if(dm===2&&!(window.AlkyonDense&&AlkyonDense.on())) depthK.addTo(map); if(sea) sea.bringToFront();
  try{ window.dispatchEvent(new CustomEvent('alkyon-depthmode',{detail:{dm:dm}})); }catch(e){}
}
function setDepth(dm,dl){ ls.set('alkyon-depth',dm); if(dl&&window.AlkyonDense&&AlkyonDense.setMode){ applyDepth(); AlkyonDense.setMode(dl); } else applyDepth(); }

/* ---------- άνεμος (κινούμενος, 48 ώρες), σταθμοί ανέμου, κατάσταση θάλασσας, πυκνές γραμμές βάθους ----------
   Είναι οι ίδιες μονάδες με την κλασική (windmap.js, seastate.js, bathy-lines.js), ώστε να δουλεύουν ακριβώς όπως εκεί.
   Φορτώνονται μία φορά, όταν ανοίξει πρώτη φορά ο χάρτης, γιατί ο χάρτης μένει ζωντανός σε όλη την εφαρμογή. */
var mods=null, mbtns=null;
function loadScript(src){ return new Promise(function(res){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
function classicMods(){
  if(mods) return mods;
  window.AlkyonCore=Object.assign(window.AlkyonCore||{},{map:function(){ return map; },toast:B.toast,lsGet:ls.get,lsSet:ls.set});
  window.AlkyonDepthRefresh=applyDepth; window.AlkyonDepthMode=dmode;
  window.ALKYON_BASE='../'; if(mbtns&&!document.getElementById('bZones')) mbtns.append(h('span',{id:'bZones',hidden:true}));
  Object.defineProperty(window,'AlkyonDepthLayers',{configurable:true,get:function(){ applyDepthInit(); return {c:depthC,k:depthK}; }});
  var list=['../bathy-lines.js','../windmap.js','../windlocal.js','../seastate.js','../ruler.js','../ports.js','../orient.js','../navigator.js','../route.js'], p=Promise.resolve();
  list.forEach(function(f){ p=p.then(function(){ return loadScript(f); }); });
  mods=p.then(function(){ restoreWx(); }); return mods;
}
function applyDepthInit(){ if(!depthC&&map) applyDepth(); }
function cbtn(id){ return document.getElementById(id); }
function gearAtSea(){ var g=ls.get('alkyon-gear',null); return !!(g&&Array.isArray(g.items)&&g.items.some(function(i){ return i.state&&i.state!=='done'; })); }
function pressed(id){ var b=cbtn(id); return !!(b&&b.getAttribute('aria-pressed')==='true'); }
function windOn(){ var W=window.AlkyonWindMap; return !!(W&&W.shown&&W.shown()); }
function seaOn(){ return document.body.classList.contains('ndsea'); }
function setWind(v){ var W=window.AlkyonWindMap; if(!W) return; if(v){ if(!W.on()) W.start(); else W.show(true); } else if(W.on()){ if(seaOn()) W.show(false); else W.stop(); } saveWx(); }
function setSeaSt(v){ var S2=window.AlkyonSeaState; if(!S2||!S2.start) return; if(v&&!seaOn()) S2.start(); else if(!v&&seaOn()) S2.stop(); saveWx(); }
function setStations(v){ if(pressed('bWindSt')!==!!v){ var b=cbtn('bWindSt'); if(b) b.click(); } }
function saveWx(){ setTimeout(function(){ cfg.wind=windOn(); cfg.seast=seaOn(); saveCfg(); },50); }
/* v31z522: ένα χρωματιστό στρώμα τη φορά· αν είχαν μείνει και τα δύο, κρατάμε το κύμα */
function restoreWx(){ if(!map) return; var w=cfg.wind; if(cfg.seast) setSeaSt(true); if(w) setTimeout(function(){ setWind(true); },cfg.seast?900:0); setTimeout(function(){ if(window._qpaint) window._qpaint(); },1500); }
/* τα κουμπιά των μονάδων της κλασικής μπαίνουν στη δεξιά στήλη του χάρτη· η αλλαγή τους θυμάται */
function hookBtns(){ document.addEventListener('click',function(e){ var t=e.target; if(t&&t.closest&&t.closest('#bWind,#bSeaState,#ndMapDock')) saveWx(); }); }

/* η θέση μου */
function locate(fly){
  if(!navigator.geolocation) return;
  if(watch==null) watch=navigator.geolocation.watchPosition(function(p){ var ll=[p.coords.latitude,p.coords.longitude];
    ls.set('alkyon-v4-pos',{lat:+ll[0].toFixed(5),lon:+ll[1].toFixed(5),t:Date.now()});
    fixNow={lat:ll[0],lon:ll[1],t:Date.now(),spd:p.coords.speed,acc:p.coords.accuracy}; drawDirect();
    headFix(ll[0],ll[1],p.coords.heading,p.coords.speed); followMe(ll[0],ll[1]); try{ window.dispatchEvent(new CustomEvent('alkyon-pos',{detail:{lat:ll[0],lon:ll[1]}})); }catch(e){}
    if(!me){ me=L.marker(ll,{icon:icon('me','<i></i>'),interactive:false,zIndexOffset:1000}).addTo(map); meAcc=L.circle(ll,{radius:p.coords.accuracy,className:'meacc',interactive:false}).addTo(map); }
    else { me.setLatLng(ll); meAcc.setLatLng(ll).setRadius(p.coords.accuracy); }
    if(fly){ map.setView(ll,Math.max(map.getZoom(),14)); fly=false; } },function(){ if(fly) B.toast(T('Δεν βρέθηκε η θέση σου.','Your position was not found.')); },{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
  else { var p=B.lastPos(); if(p&&fly) map.setView([p.lat,p.lon],Math.max(map.getZoom(),14)); }
}

/* ---------- «Πήγαινε εκεί»: γραμμή, απόσταση, πορεία, ταχύτητα και ώρα άφιξης προς ένα σημείο (ίδιο κλειδί με την κλασική: alkyon-direct) ---------- */
var dtPlan={}, fixNow=null, gDt=null, dtBar=null, dtPrev=null, dtSpd=null, dtArr=false;
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function hav(a,b){ var R=6371000, r=Math.PI/180, dl=(b.lat-a.lat)*r, dn=(b.lon-a.lon)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
function brg(a,b){ var r=Math.PI/180, y=Math.sin((b.lon-a.lon)*r)*Math.cos(b.lat*r), x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lon-a.lon)*r); return (Math.atan2(y,x)/r+360)%360; }
function dtFmt(m){ var U=window.AlkyonUnits; if(U&&U.cfg&&U.cfg.dist&&U.cfg.dist!=='km'&&U.dist) try{ return U.dist(m/1000); }catch(e){} return m<1000?Math.round(m)+' m':B.num(m/1000,m<10000?2:1)+' km'; }
function dtTarget(){ return ls.get('alkyon-direct',null); }
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
  /* διαδρομή γύρω από στεριά (route.js της κλασικής, απόσταση από ακτή alkyon-route-clr, προεπιλογή 200 m) */
  var clr=+ls.get('alkyon-route-clr',200), key=t.lat+','+t.lon;
  if(clr&&window.AlkyonRoute&&!dtPlan.busy&&(dtPlan.key!==key||!dtPlan.from||hav(dtPlan.from,f)>300)){ dtPlan.busy=true; dtPlan.key=key; dtPlan.from={lat:f.lat,lon:f.lon};
    AlkyonRoute.plan({lat:f.lat,lon:f.lon},{lat:t.lat,lon:t.lon},clr).then(function(r){ dtPlan.r=(r&&r.pts)?r:null; }).catch(function(){ dtPlan.r=null; }).then(function(){ dtPlan.busy=false; drawDirect(); }); }
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
B.goTo=function(lat,lon,name){ ls.set('alkyon-direct',{lat:+lat,lon:+lon,name:String(name||'').slice(0,40)}); dtArr=false; dtSpd=null; dtPrev=null; B.closeSheet&&B.closeSheet();
  if(!map||!root){ location.hash='#map'; } else drawDirect(); setTimeout(function(){ if(map){ var f=fixNow||B.lastPos(); if(f) map.fitBounds(L.latLngBounds([[f.lat,f.lon],[+lat,+lon]]),{padding:[70,70],maxZoom:15}); else map.setView([+lat,+lon],14); } },400);
  B.toast(T('Πλοήγηση προς: ','Navigating to: ')+(name||T('σημείο','point'))); };
B.goClear=function(){ ls.set('alkyon-direct',null); drawDirect(); };
function dtBarEl(){ dtBar=h('div',{class:'dtbar',hidden:true,role:'status'},h('span',{class:'dtic',html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 19-7-4-7 4z"/></svg>'}),h('div',{class:'dtmain'},h('b',{class:'dtname'}),h('span',{class:'dtinfo'})),
  h('button',{class:'dtx',type:'button','aria-label':T('Τέλος πλοήγησης','Stop navigating'),text:'✕',onclick:function(){ B.goClear(); }})); return dtBar; }
function goBtn(lat,lon,name){ return h('button',{class:'btn',type:'button',text:T('Πήγαινε εκεί','Go there'),onclick:function(){ B.goTo(lat,lon,name); }}); }
B.goBtn=goBtn;

/* πορεία από το GPS (για το βέλος της θέσης σου και τον προσανατολισμό του χάρτη) και ακολουθία της θέσης κατά την έξοδο, όπως η κλασική */
var youHead=null, youPrev=null, followPause=0;
window.AlkyonFollowReset=function(){ followPause=0; };
/* v31z536: όταν μετακινείς τον χάρτη με το δάχτυλο, σταματά να σε ακολουθεί μέχρι να πατήσεις το κουμπί θέσης (όπως το Google Maps) */
var follow=true, gpsBtn=null;
function setFollow(v){ follow=!!v; if(gpsBtn){ gpsBtn.classList.toggle('fol',follow&&document.body.classList.contains('ontrip')); gpsBtn.setAttribute('aria-pressed',String(follow)); } }
window.AlkyonFollowStop=function(){ setFollow(false); };
try{ var wasTrip=document.body.classList.contains('ontrip'); new MutationObserver(function(){ var t=document.body.classList.contains('ontrip'); if(t&&!wasTrip) setFollow(true); wasTrip=t; setFollow(follow); }).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){}
function headFix(lat,lon,gh,gs){
  if(gh!=null&&isFinite(gh)&&gs!=null&&isFinite(gs)&&gs>0.8) youHead=gh;
  else if(youPrev){ var R6=6371000, dy=(lat-youPrev[0])*Math.PI/180*R6, dx=(lon-youPrev[1])*Math.PI/180*R6*Math.cos(lat*Math.PI/180), d=Math.hypot(dx,dy); if(d>15){ youHead=(Math.atan2(dx,dy)*180/Math.PI+360)%360; youPrev=[lat,lon]; } }
  if(!youPrev) youPrev=[lat,lon];
  if(youHead!=null){ try{ window.dispatchEvent(new CustomEvent('alkyon-head',{detail:{head:youHead}})); }catch(e){} var el=me&&me.getElement&&me.getElement(); if(el){ el.classList.add('hd'); el.style.setProperty('--hd',Math.round(youHead)+'deg'); } }
}
function followMe(lat,lon){ if(!map||!root||!follow||!document.body.classList.contains('ontrip')||Date.now()<followPause) return; try{ map.panTo([lat,lon],{animate:true,duration:.6}); }catch(e){} }

/* ---------- κάρτα καιρού πάνω στον χάρτη (ίδια στοιχεία με την κλασική mapwx.js, επιλογή στο alkyon-mapwx-items) ---------- */
var MWK='alkyon-mapwx-items', MWDEF=['wind','press','sst'], mwEl=null, mwEdit=false;
function nowCond(){ var fc=ls.get('alkyon-fc7',null); try{ var hr=new Date().getHours(), d=fc.fc.days.filter(function(x){ var t=new Date(); return x.date===t.getFullYear()+'-'+B.pad(t.getMonth()+1)+'-'+B.pad(t.getDate()); })[0]; var q=d&&d.hours.filter(function(x){ return x.hr===hr; })[0]; return q||null; }catch(e){ return null; } }
var MWI=[['wind',T('Άνεμος','Wind'),function(c){ if(c.wind==null) return null; var U=window.AlkyonUnits; return [(c.dir!=null?COMP[Math.round((((c.dir%360)+360)%360)/45)%8]+' ':'')+(U?U.wind(c.wind):Math.round(c.wind)+' kn'),c.gust!=null&&c.gust>=c.wind+5?T('ριπές ','gusts ')+(U?U.wind(c.gust):Math.round(c.gust)):T('άνεμος','wind')]; }],
  ['press',T('Πίεση','Pressure'),function(c){ if(c.pres==null) return null; var TR={fast:'↓↓',slow:'↓',stable:'→',rise:'↑'}, U=window.AlkyonUnits; return [(U?U.press(c.pres):Math.round(c.pres))+(c.ptrend?' '+TR[c.ptrend]:''),T('πίεση','pressure')]; }],
  ['sst',T('Θερμ. νερού','Water temp'),function(c){ if(c.sst==null) return null; var U=window.AlkyonUnits; return [U?U.temp(c.sst):Math.round(c.sst)+'°',T('νερό','water')]; }],
  ['air',T('Θερμ. αέρα','Air temp'),function(c){ if(c.temp==null) return null; var U=window.AlkyonUnits; return [U?U.temp(c.temp):Math.round(c.temp)+'°',T('αέρας','air')]; }],
  ['wave',T('Κύμα','Waves'),function(c){ if(c.wave==null) return null; var U=window.AlkyonUnits; return [U?U.wave(c.wave):B.num(c.wave,1)+' m',T('κύμα','waves')]; }],
  ['period',T('Περίοδος κύματος','Wave period'),function(c){ return c.period?[Math.round(c.period)+' s',T('περίοδος','period')]:null; }]];
function drawMw(){ if(!mwEl) return; var on=ls.get('alkyon-v4-mapwx',true)!==false, c=nowCond(); mwEl.hidden=!on||!c||B.prof()==='spear'&&false; if(mwEl.hidden) return; mwEl.replaceChildren();
  var sel=ls.get(MWK,null); if(!Array.isArray(sel)) sel=MWDEF.slice();
  if(mwEdit){ MWI.forEach(function(it){ mwEl.append(h('button',{type:'button',class:'mwopt','aria-pressed':String(sel.indexOf(it[0])>=0),text:it[1],onclick:function(ev){ ev.stopPropagation(); var i=sel.indexOf(it[0]); if(i>=0) sel.splice(i,1); else sel.push(it[0]); ls.set(MWK,sel); drawMw(); }})); }); mwEl.append(h('button',{type:'button',class:'mwopt ok',text:'✓',onclick:function(ev){ ev.stopPropagation(); mwEdit=false; drawMw(); }})); return; }
  MWI.forEach(function(it){ if(sel.indexOf(it[0])<0) return; var v=it[2](c); mwEl.append(h('div',{class:'mw'},h('b',{text:v?v[0]:'–'}),h('span',{text:v?v[1]:it[1]}))); });
  if(!mwEl.children.length) mwEl.append(h('span',{class:'mwempty',text:T('Πάτα για να διαλέξεις στοιχεία','Tap to choose items')})); }
function mwBox(){ mwEl=h('div',{class:'mapwx',role:'button','aria-label':T('Καιρός τώρα. Πάτα για να διαλέξεις τι φαίνεται.','Weather now. Tap to choose what is shown.'),onclick:function(){ mwEdit=!mwEdit; drawMw(); }}); setTimeout(drawMw,0); return mwEl; }

/* ---------- θαλάσσια ρεύματα (Open-Meteo Marine, μοντέλο ~8 km· ενδεικτικό, όχι μέτρηση) ---------- */
var curT=0, curKey='', curData=[];
function currents(force){
  clearTimeout(curT); if(!map) return;
  if(!cfg.cur){ if(ov.cur){ map.removeLayer(ov.cur); ov.cur=null; try{ window.dispatchEvent(new Event('alkyon-curs')); }catch(e){} } curKey=''; return; }
  curT=setTimeout(function(){ if(!map||!cfg.cur) return; var b=map.getBounds(), z=map.getZoom(), la=[], lo=[], NY=5, NX=4;
    var key=b.getSouth().toFixed(2)+b.getWest().toFixed(2)+b.getNorth().toFixed(2)+b.getEast().toFixed(2)+new Date().getHours(); if(key===curKey&&!force) return; curKey=key;
    /* v31z526: σημεία μόνο στον ελεύθερο χώρο του χάρτη (όχι κάτω από τα κουμπιά πάνω, τη στήλη δεξιά, τη μπάρα ώρας κάτω) */
    var sz=map.getSize(), dk=document.getElementById('ndMapDock'), x0=70, x1=sz.x-78, y0=Math.min(sz.y*0.3,175), y1=sz.y-((dk&&!dk.hidden&&dk.offsetHeight)?dk.offsetHeight+110:150);
    if(y1-y0<120){ y0=sz.y*0.2; y1=sz.y*0.8; }
    for(var i=0;i<NY;i++) for(var j=0;j<NX;j++){ var q=map.containerPointToLatLng([x0+(x1-x0)*(j+0.5)/NX,y0+(y1-y0)*(i+0.5)/NY]);
      /* 1.2.2: όχι βέλη πάνω στη στεριά: παραλείπονται τα σημεία της στεριάς, και το μοντέλο ρωτιέται για το κελί θάλασσας */
      var X=window.AlkyonExposure, ld=-1; try{ ld=X&&X.isLand?X.isLand(q.lat,q.lng):-1; }catch(e){} if(ld===1) continue; la.push(q.lat.toFixed(3)); lo.push(q.lng.toFixed(3)); }
    if(!la.length){ if(ov.cur){ map.removeLayer(ov.cur); ov.cur=null; } return; }
    /* 1.2.2: δύο μοντέλα: στη Μεσόγειο προτιμάται το Copernicus Μεσογείου (~4 km, με αφομοίωση μετρήσεων, πιο ακριβές εδώ)· όπου δεν έχει τιμή, το Open-Meteo (παγκόσμιο, ~8 km) */
    var med=la.some(function(x,i){ return +x>30&&+x<46.5&&+lo[i]>-6&&+lo[i]<37; }), SK='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
    var cmP=med?fetch('https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/water-clarity?mode=curgrid&pts='+la.map(function(x,i){ return x+','+lo[i]; }).join(';'),{headers:{apikey:SK,Authorization:'Bearer '+SK}}).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }):Promise.resolve(null);
    cmP=Promise.race([cmP,new Promise(function(res){ setTimeout(function(){ res(null); },7000); })]);   /* αν αργεί το Copernicus, δείχνει το Open-Meteo */
    var omP=fetch('https://marine-api.open-meteo.com/v1/marine?latitude='+la.join(',')+'&longitude='+lo.join(',')+'&current=ocean_current_velocity,ocean_current_direction&timezone=GMT&cell_selection=sea').then(function(r){ if(!r.ok) throw 0; return r.json(); }).catch(function(){ return null; });
    Promise.all([omP,cmP]).then(function(rr){ var j=rr[0], cm=rr[1]; if(!j&&!(cm&&cm.pts)) throw 0;
      if(!map||!cfg.cur) return; var a=j?(Array.isArray(j)?j:[j]):la.map(function(x,i){ return {latitude:+x,longitude:+lo[i]}; });
      a.forEach(function(q,qi){ var c2=cm&&cm.pts&&cm.pts[qi]; if(!q) return; if(c2&&c2.kn!=null){ q.current={ocean_current_velocity:c2.kn*1.852,ocean_current_direction:c2.dir}; q.src='cmems'; } else q.src='om'; }); if(ov.cur) map.removeLayer(ov.cur); ov.cur=L.layerGroup().addTo(map); var n=0; curData=a;
      a.forEach(function(q,qi){ var c=q&&q.current; if(!c||c.ocean_current_velocity==null||c.ocean_current_direction==null) return; var kn=c.ocean_current_velocity/1.852; if(kn<0.05) return; n++;
        if(la[qi]!=null){ q.latitude=+la[qi]; q.longitude=+lo[qi]; }   /* το βέλος στο σημείο της θάλασσας που ζητήθηκε, όχι στο κέντρο του κελιού του μοντέλου (~8 km, μπορεί να πέφτει στη στεριά) */
        var cls=kn>=1?'strong':kn>=0.4?'mid':'weak';
        L.marker([q.latitude,q.longitude],{interactive:false,keyboard:false,icon:L.divIcon({className:'mk cur '+cls,iconSize:null,html:'<div class="cw"><i style="transform:rotate('+Math.round(c.ocean_current_direction)+'deg)"><svg viewBox="0 0 24 24"><path d="M12 20V5M6 10l6-6 6 6"/></svg></i><b>'+B.num(kn,kn<1?1:0)+'<small> kn</small></b></div>'})}).addTo(ov.cur); });
      try{ window.dispatchEvent(new Event('alkyon-curs')); }catch(e){}
      if(!n&&force) B.toast(T('Δεν υπάρχουν δεδομένα ρευμάτων εδώ (μόνο ανοιχτή θάλασσα).','No current data here (open sea only).'));
    }).catch(function(){ curKey=''; if(force) B.toast(T('Τα ρεύματα δεν φορτώθηκαν. Χρειάζεται σύνδεση.','Currents did not load. Needs a connection.')); }); },force?0:500);
}


/* ---------- κάρτα σημείου: πατάς στον χάρτη με άνεμο ή κύμα ανοιχτό → άνεμος · κύμα · βάθος σε μία καθαρή κάρτα (v31z519) ---------- */
window.ALKYON_TAPCARD=true;
var wcLL=null, wcEl=null, wcHr=null, wcDep={};
function wcHour(){ var W=window.AlkyonWindMap, t=wcHr||(W&&W.hour&&W.hour()); if(!t) return T('τώρα','now'); try{ return new Date(Date.parse(t+(t.length<=16?':00Z':'Z'))).toLocaleString(EN?'en-GB':'el-GR',{weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}); }catch(e){ return ''; } }
var wcMk=null;
function wcClose(){ if(wcMk&&map){ map.removeLayer(wcMk); wcMk=null; } wcLL=null; if(wcEl){ wcEl.remove(); wcEl=null; } var W=window.AlkyonWindMap, S2=window.AlkyonSeaState; try{ W&&W.clearTap&&W.clearTap(); }catch(e){} try{ S2&&S2.clearTap&&S2.clearTap(); }catch(e){} var D=document.getElementById('ndMapDock'); if(D&&D._sync) D._sync(); }
function wcSea(){ var S2=window.AlkyonSeaState; if(!wcLL||!seaOn()||!S2||!S2.pointInfo) return null; try{ return S2.pointInfo(wcLL.lat,wcLL.lng); }catch(e){ return null; } }
function wcCur(){ if(!cfg.cur||!curData||!curData.length||!wcLL) return null; var best=null, bd=1e9; curData.forEach(function(q){ var c=q&&q.current; if(!c||c.ocean_current_velocity==null) return; var d=hav({lat:wcLL.lat,lon:wcLL.lng},{lat:q.latitude,lon:q.longitude}); if(d<bd){ bd=d; best=c; } }); return best&&bd<15000?best:null; }
function wcArrow(dir,color){ return '<svg viewBox="0 0 24 24" class="wcar" style="transform:rotate('+Math.round(dir)+'deg)"><path d="M12 3v16M6 13l6 6 6-6" stroke="'+color+'" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function wcDraw(){
  if(!wcLL){ if(wcEl){ wcEl.remove(); wcEl=null; } return; }
  if(!windOn()&&!seaOn()&&!(B.sst&&B.sst.on())){ wcClose(); return; }
  var D=window.AlkyonMapDock&&window.AlkyonMapDock(); if(!D) return;
  if(!wcEl||!wcEl.isConnected){ wcEl=h('div',{id:'wxCard',role:'region','aria-label':T('Καιρός στο σημείο','Weather at this point'),'aria-live':'polite'}); D.insertBefore(wcEl,D.firstChild); }
  var W=window.AlkyonWindMap, U=window.AlkyonUnits, v=W&&W.sample?W.sample(wcLL.lat,wcLL.lng):null, r=wcSea(), cur=wcCur();
  function cell(lab,ic,big,sub,sub2,color){ return h('div',{class:'wcc'},h('small',{text:lab}),h('div',{class:'wcv'},ic?h('span',{html:ic}):null,h('b',{text:big,style:color?'color:'+color:''})),sub?h('span',{class:'wcs',text:sub}):null,sub2?h('span',{class:'wcs',text:sub2}):null); }
  var cw;
  if(v){ var kn=v.sp, bf=U&&U.bft?U.bft(kn):null, main=U?U.wind(kn):Math.round(kn)+' kn', alt=(U&&U.cfg&&U.cfg.wind==='kn')?(bf!=null?bf+' Bft':''):Math.round(kn)+' kn', c=W.col?W.col(kn):'#4f9fd8';
    cw=cell(T('Άνεμος','Wind'),wcArrow(v.dir,c),main,COMP[Math.round((((v.dir%360)+360)%360)/45)%8]+' '+Math.round(v.dir)+'°'+(alt?' · '+alt:''),v.obs&&v.obs.near?T('με διόρθωση σταθμού','station-corrected'):''); }
  else cw=cell(T('Άνεμος','Wind'),'',' –',windOn()?T('εκτός περιοχής','outside the area'):'',null);
  if(!windOn()&&!v) cw=h('button',{type:'button',class:'wcc wcoff',onclick:function(){ setWind(true); setTimeout(wcDraw,1500); }},h('small',{text:T('Άνεμος','Wind')}),h('b',{text:'+'}),h('span',{class:'wcs',text:T('Άνοιξε τον άνεμο','Turn wind on')}));
  var cs;
  if(r&&r.hs>=0){ var LV=window.AlkyonSeaState.levels||[], lv=LV[r.level]||{}, g=window.AlkyonSeaState.grad?window.AlkyonSeaState.grad(r.hs):null, gc=g?'rgb('+g.map(Math.round).join(',')+')':'';
    cs=cell(T('Κύμα','Waves'),r.wdir!=null?wcArrow(r.wdir,'#4aa8e0'):'',(U&&U.wave?U.wave(r.hs):B.num(r.hs,1)+' m'),(EN?(lv.en||'').split(' /')[0]:(lv.el||'').split(' ')[0])||'',(r.period>0?Math.round(r.period)+' s':'')+(r.wdir!=null?(r.period>0?' · ':'')+T('από ','from ')+COMP[Math.round((((r.wdir%360)+360)%360)/45)%8]:''));
    var ln=cs.querySelector('.wcs'); if(ln&&gc){ ln.classList.add('wclv'); ln.style.setProperty('--lv',gc); } }
  else if(seaOn()){ var S3=window.AlkyonSeaState, mm=S3&&S3.modelAt?S3.modelAt(wcLL.lat,wcLL.lng):null;
    if(mm&&mm.h>=0){ var LV3=S3.levels||[], li=0; for(var q=0;q<LV3.length;q++){ if(mm.h<LV3[q].max){ li=q; break; } } var lv3=LV3[li]||{}, g3=S3.grad?S3.grad(mm.h):null;
      cs=cell(T('Κύμα','Waves'),mm.dir!=null?wcArrow(mm.dir,'#4aa8e0'):'',(U&&U.wave?U.wave(mm.h):B.num(mm.h,1)+' m'),(EN?(lv3.en||'').split(' /')[0]:(lv3.el||'').split(' ')[0])||'',(mm.tp>0?Math.round(mm.tp)+' s · ':'')+T('ανοιχτά','offshore'));
      var ln3=cs.querySelector('.wcs'); if(ln3&&g3){ ln3.classList.add('wclv'); ln3.style.setProperty('--lv','rgb('+g3.map(Math.round).join(',')+')'); } }
    else cs=cell(T('Κύμα','Waves'),'','–',T('χωρίς δεδομένα εδώ','no data here'),null); }
  else cs=h('button',{type:'button',class:'wcc wcoff',onclick:function(){ setSeaSt(true); setTimeout(wcDraw,2500); }},h('small',{text:T('Κύμα','Waves')}),h('b',{text:'+'}),h('span',{class:'wcs',text:T('Άνοιξε το κύμα','Turn waves on')}));
  var key=wcLL.lat.toFixed(4)+','+wcLL.lng.toFixed(4), dep=r&&isFinite(r.depth)?Math.round(r.depth):wcDep[key];
  if(dep===undefined&&B.depthAt){ wcDep[key]=null; B.depthAt(wcLL.lat,wcLL.lng).then(function(x){ wcDep[key]=x!=null?Math.round(x):'none'; if(wcLL&&wcLL.lat.toFixed(4)+','+wcLL.lng.toFixed(4)===key) wcDraw(); }).catch(function(){}); }
  var me=fixNow||B.lastPos(), fromMe=me?dtFmt(hav(me,{lat:wcLL.lat,lon:wcLL.lng})):'';
  var cd=cell(T('Βάθος','Depth'),'',dep==null?'…':dep==='none'?'–':'~'+dep+' m',r&&isFinite(r.distKm)?T('ακτή ','shore ')+(r.distKm<1?Math.round(r.distKm*1000)+' m':B.num(r.distKm,1)+' km'):'',fromMe?T('από εσένα ','from you ')+fromMe:'');
  var foot=h('div',{class:'wcf'});
  var sbd=B.seabedAt?B.seabedAt(wcLL.lat,wcLL.lng):null; if(sbd) foot.append(h('span',{class:'wcsst',html:'<i style="background:'+(sbd.slope>=25?'#d63a3a':sbd.slope>=12?'#f08c30':sbd.slope>=5?'#ffd23f':'#8a96a3')+'"></i><span>'+(sbd.slope>=5?T('Drop-off · ','Drop-off · '):T('Βυθός · ','Seabed · '))+Math.round(sbd.slope)+T(' m/100 m',' m/100 m')+'</span>'}));
  var sv=B.sstAt?B.sstAt(wcLL.lat,wcLL.lng):null; if(sv!=null){ var U2=window.AlkyonUnits; foot.append(h('span',{class:'wcsst',html:'<i style="background:rgb('+(B.sst.color?B.sst.color(0.5).map(Math.round).join(','):'64,182,180')+')"></i><span>'+T('Νερό ','Water ')+(U2&&U2.temp?U2.temp(sv,1):B.num(sv,1)+'°C')+'</span>'})); }
  if(cur){ var ck=cur.ocean_current_velocity/1.852; foot.append(h('span',{class:'wccur',html:wcArrow((cur.ocean_current_direction+180)%360,'#5bc0de')+'<span>'+T('Ρεύμα ','Current ')+B.num(ck,1)+' kn '+T('προς ','to ')+COMP[Math.round(cur.ocean_current_direction/45)%8]+'</span>'})); }
  wcEl.replaceChildren(
    h('div',{class:'wch'},h('b',{text:T('Σημείο','Point')}),h('span',{text:wcHour()}),h('button',{type:'button',class:'wcmore',text:T('Λεπτομέρειες ›','Details ›'),onclick:wcSheet}),h('button',{type:'button',class:'wcx','aria-label':T('Κλείσιμο','Close'),text:'✕',onclick:wcClose})),
    h('div',{class:'wcg'},cw,cs,cd)); if(foot.children.length) wcEl.append(foot);
  if(D._sync) D._sync();
}
function wcSheet(){
  if(!wcLL) return; var W=window.AlkyonWindMap, U=window.AlkyonUnits, v=W&&W.sample?W.sample(wcLL.lat,wcLL.lng):null, r=wcSea(), rows=[], f1=function(x){ return B.num(x,1); }, Wd=function(k){ return U?U.wind(k):Math.round(k)+' kn'; }, dn=function(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; };
  function row(a,b){ rows.push(h('div',{class:'wcr'},h('span',{text:a}),h('b',{text:b}))); }
  row(T('Ώρα','Time'),wcHour()); row(T('Θέση','Position'),wcLL.lat.toFixed(5)+', '+wcLL.lng.toFixed(5));
  if(v){ row(T('Άνεμος','Wind'),dn(v.dir)+' '+Math.round(v.dir)+'° · '+Wd(v.sp)+(U&&U.cfg&&U.cfg.wind!=='kn'?' ('+Math.round(v.sp)+' kn)':''));
    if(v.obs&&v.obs.near){ var ob=v.obs.near; row(T('Σταθμός','Station'),ob.name+' ('+Math.round(v.obs.dist)+' km) · '+T('μέτρηση ','observed ')+Wd(ob.obs)+' · '+T('μοντέλο ','model ')+Wd(ob.mod)); }
    var all=W.sampleAll?W.sampleAll(wcLL.lat,wcLL.lng):[]; if(all.length>1) row(T('Μοντέλα ανέμου','Wind models'),all.map(function(a){ return a.name+' '+Wd(a.sp!=null?a.sp:(a.v&&a.v.sp)||0); }).join(' · ')); }
  if(r&&r.hs>=0){ var lv=(window.AlkyonSeaState.levels||[])[r.level]||{};
    row(T('Κύμα','Waves'),'≈ '+f1(r.hs)+' m'+(r.hi-r.lo>=0.1?' ('+f1(r.lo)+'–'+f1(r.hi)+')':'')+' · '+((EN?lv.en:lv.el)||'')+(r.unc?T(' · αβέβαιο',' · uncertain'):''));
    if(r.period>0) row(T('Περίοδος','Period'),'~'+Math.round(r.period)+' s');
    if(r.wdir!=null) row(T('Κατεύθυνση κύματος','Wave direction'),T('από ','from ')+dn(r.wdir));
    if(isFinite(r.windSea)) row(T('Κύμα ανέμου','Wind sea'),f1(r.windSea)+' m'+(r.tWind>0?' / '+Math.round(r.tWind)+' s':'')+(isFinite(r.fetchKm)?' · fetch '+(r.fetchKm<10?f1(r.fetchKm):Math.round(r.fetchKm))+' km':'')+(isFinite(r.dur)?' · '+(r.dur>=24?'24+':Math.round(r.dur))+' h':''));
    if(r.swell) row('Swell',f1(r.swellEff)+' m'+(r.tSwell>0?' / '+Math.round(r.tSwell)+' s':'')+' · '+T('από ','from ')+dn(r.swell.dir)+(r.swell.h>r.swellEff+0.05?T(' (ανοιχτά ',' (offshore ')+f1(r.swell.h)+' m)':''));
    if(r.model&&r.model.length) row(T('Μοντέλα κύματος','Wave models'),r.model.map(function(m){ return f1(m.h); }).join(' / ')+' m · '+T('βάρος ','weight ')+Math.round(100*r.wModel)+'%');
    if(isFinite(r.depth)) row(T('Βάθος','Depth'),'~'+Math.round(r.depth)+' m'+(r.capped?T(' (περιορίζει το κύμα)',' (limits the waves)'):''));
    if(isFinite(r.distKm)) row(T('Απόσταση από ακτή','Distance to shore'),r.distKm<1?Math.round(r.distKm*1000)+' m':f1(r.distKm)+' km'); }
  var sv2=B.sstAt?B.sstAt(wcLL.lat,wcLL.lng):null; if(sv2!=null) row(T('Θερμοκρασία νερού','Water temperature'),B.num(sv2,1)+' °C'+T(' (μοντέλο, επιφάνεια)',' (model, surface)'));
  var cur=wcCur(); if(cur) row(T('Ρεύμα','Current'),f1(cur.ocean_current_velocity/1.852)+' kn '+T('προς ','to ')+dn(cur.ocean_current_direction)+(cur.src==='cmems'?T(' (Copernicus Μεσογείου, ~4 km)',' (Copernicus Mediterranean, ~4 km)'):T(' (Open-Meteo, ~8 km)',' (Open-Meteo, ~8 km)')));
  var LV=(window.AlkyonSeaState&&window.AlkyonSeaState.levels)||[], G=window.AlkyonSeaState&&window.AlkyonSeaState.grad;
  var leg=h('div',{class:'wcleg'},LV.map(function(l){ var hh=l.max>100?3:l.max*0.75, g=G?G(hh):[128,128,128]; return h('span',{},h('i',{style:'background:rgb('+g.map(Math.round).join(',')+')'}),h('b',{text:EN?l.en.split(' /')[0]:l.el.split(' ')[0]}),h('small',{text:EN?l.ren:l.r})); }));
  var bd=h('div',null,h('div',{class:'wcrows'},rows)); if(LV.length) bd.append(h('h4',{class:'wcsh',text:T('Κατηγορίες θάλασσας (WMO)','Sea categories (WMO)')}),leg);
  B.sheet({title:T('Καιρός στο σημείο','Weather at this point'),body:bd}); bd.append(
    h('p',{class:'note',text:T('Εκτίμηση από μοντέλα (Open-Meteo) και βάθη EMODnet, έως 10 km από την ακτή. Ενδεικτικό, δεν είναι ναυτικό όργανο.','Estimate from models (Open-Meteo) and EMODnet depths, up to 10 km offshore. Indicative, not a navigation instrument.')}));
}
window.addEventListener('alkyon-wxtap',function(e){ var d=e.detail||{}; if(d.clear){ setTimeout(wcDraw,60); return; } if(d.lat==null) return; var same=wcLL&&Math.abs(wcLL.lat-d.lat)<1e-9&&Math.abs(wcLL.lng-d.lng)<1e-9; wcLL={lat:d.lat,lng:d.lng}; if(wcMk&&map){ map.removeLayer(wcMk); wcMk=null; } if(!windOn()&&!seaOn()&&map) wcMk=L.marker([d.lat,d.lng],{icon:icon('tapdot','<i></i>'),interactive:false,keyboard:false,zIndexOffset:1500}).addTo(map); clearTimeout(wcDraw._t); wcDraw._t=setTimeout(wcDraw,same?120:30); });
window.addEventListener('alkyon-windhour',function(e){ wcHr=e.detail&&e.detail.t||null; if(wcLL){ clearTimeout(wcDraw._t); wcDraw._t=setTimeout(wcDraw,150); } });
window.addEventListener('alkyon-windstop',function(){ setTimeout(wcDraw,80); });

/* ---------- παρατεταμένο πάτημα στον χάρτη: ενέργειες για εκείνο το σημείο (όπως η κλασική) ---------- */
var tapMk=null;
function pointMenu(ll){
  if(!map) return; var lat=+ll.lat.toFixed(5), lon=+ll.lng.toFixed(5), PC=window.AlkyonCoord; try{ navigator.vibrate&&navigator.vibrate(25); }catch(e){}
  if(tapMk) map.removeLayer(tapMk); tapMk=L.marker([lat,lon],{icon:icon('tapdot','<i></i>'),interactive:false,keyboard:false,zIndexOffset:1500}).addTo(map);
  var me=fixNow||B.lastPos(), info=h('small',{class:'pmsub'}), dep=h('small',{class:'pmsub'});
  if(me){ var d=hav(me,{lat:lat,lon:lon}), bb=brg(me,{lat:lat,lon:lon}); info.textContent=T('Από εσένα: ','From you: ')+dtFmt(d)+' · '+Math.round(bb)+'° '+COMP[Math.round(bb/45)%8]; }
  if(B.depthAt){ dep.textContent=T('Βάθος: …','Depth: …'); B.depthAt(lat,lon).then(function(v){ dep.textContent=v!=null?T('Βάθος χάρτη: ~','Chart depth: ~')+v+' m (EMODnet)':T('Βάθος: δεν βρέθηκε (ξηρά ή χωρίς δεδομένα)','Depth: not found (land or no data)'); }); }
  var sh, at={lat:lat,lon:lon};
  function a(ic,lab,fn,cls){ return h('button',{type:'button',class:'ltile'+(cls?' '+cls:''),onclick:function(){ sh.close(true); fn(); }},h('span',{class:'lic',html:ic}),h('b',{text:lab})); }
  var FI='<svg viewBox="0 0 32 24"><path d="M3 12C8 4.5 17 4 22 12c-5 8-14 7.5-19 0z"/><path d="M22 12l7-6.5v13z"/></svg>', MI='<svg viewBox="0 0 32 24"><path d="M3 12C8 4.5 17 4 22 12c-5 8-14 7.5-19 0z"/><path d="M22 12l7-6.5v13z"/><path d="M5 22L27 2"/></svg>';
  var grid=h('div',{class:'lgrid pmgrid'},
    a(FI,T('Ψάρι εδώ','Catch here'),function(){ B.quickRec(false,at); },'go'),
    a(MI,T('Χαμένο εδώ','Lost here'),function(){ B.quickRec(true,at); },'bad'),
    a('<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',T('Πλήρης καταγραφή','Full catch form'),function(){ B.biteForm(null,{at:at}); }),
    a(LIC.spot,T('Σημείο εδώ','Spot here'),function(){ spotForm(null,{lat:lat,lng:lon}); }),
    a('<svg viewBox="0 0 24 24"><path d="M12 2l7 19-7-4-7 4z"/></svg>',T('Πήγαινε εκεί','Go there'),function(){ B.goTo(lat,lon,PC?PC.fmt(lat,lon):''); }),
    a('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',T('Πρόγνωση εδώ','Forecast here'),function(){ fcHere(T('Σημείο χάρτη','Map point'),lat,lon); }),
    window.AlkyonRuler?a('<svg viewBox="0 0 24 24"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>',T('Μέτρηση από εδώ','Measure from here'),function(){ map.setView([lat,lon],map.getZoom(),{animate:false}); if(!pressed('bRuler')) cbtn('bRuler').click(); setTimeout(function(){ var b=document.getElementById('ndRulAdd'); if(b) b.click(); },150); }):null,
    a('<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',T('Αντιγραφή θέσης','Copy position'),function(){ var t=(PC?PC.fmt(lat,lon):lat+', '+lon); try{ navigator.clipboard.writeText(t).then(function(){ B.toast(T('Αντιγράφηκε: ','Copied: ')+t); }); }catch(e){ B.toast(t); } }),
    B.gearPanel?a('<svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/></svg>',T('Εργαλείο','Gear'),function(){ B.gearPanel(); }):null);
  var head=h('div',{class:'pmhead'},h('b',{class:'pmc',text:PC?PC.fmt(lat,lon):lat.toFixed(5)+', '+lon.toFixed(5)}),info,dep);
  sh=B.sheet({title:T('Σε αυτό το σημείο','At this point'),body:h('div',{class:'lyr'},head,grid),onclose:function(){ if(tapMk&&map){ map.removeLayer(tapMk); tapMk=null; } }});
}

/* ---------- φύλλα ---------- */
function fishSheet(a){
  if(a.length===1&&B.biteDetail){ B.biteDetail(a[0]); return; }
  var l=h('div',{class:'list'}); a.sort(function(x,y){ return (y.date+y.time).localeCompare(x.date+x.time); }).forEach(function(b){
    var row=h('button',{class:'li',type:'button',onclick:function(){ sh.close(true); if(B.biteDetail) B.biteDetail(b); }},h('span',{class:'ic'},B.icon('fish')),h('span',{class:'tx'},h('b',{text:b.miss?T('Χαμένο','Lost'):(b.species||'')+(+b.cnt>1?' ×'+b.cnt:'')}),h('small',{text:[B.dateShort(b.date)+(b.time?', '+b.time:''),+b.kg?b.kg+' kg':''].filter(Boolean).join(' · ')})));
    l.append(B.swipeDel?B.swipeDel(row,function(){ S().delUndo('bites',b,T('Διαγράφηκε: ','Deleted: ')+(b.miss?T('χαμένο','lost fish'):(b.species||T('ψάρι','catch')))+'.'); if(!l.children.length) sh.close(true); }):row); });
  var sh=B.sheet({title:a.length+' '+T('ψάρια σε αυτό το σημείο','catches at this spot'),body:h('div',null,h('p',{class:'sum',text:T('Πάτα για λεπτομέρειες · σύρε αριστερά για διαγραφή','Tap for details · swipe left to delete')}),l)});
}
function spotList(a){ var l=h('div',{class:'list'}), sh; a.forEach(function(sp){ l.append(h('button',{class:'li',type:'button',onclick:function(){ sh.close(true); spotSheet(sp); }},h('span',{class:'ic'},B.icon('pin')),h('span',{class:'tx'},h('b',{text:sp.name||T('Σημείο','Spot')}),h('small',{text:[sp.type,sp.depth!=null&&sp.depth!==''?sp.depth+' m':''].filter(Boolean).join(' · ')||' '})),B.icon('chev'))); });
  sh=B.sheet({title:a.length+' '+T('σημεία εδώ','spots here'),body:l}); }
function spotSheet(sp){
  var n=S().raw('bites').filter(function(b){ return !b.miss&&!B.pest(b)&&typeof b.lat==='number'&&Math.abs(b.lat-sp.lat)<0.0008&&Math.abs(b.lon-sp.lon)<0.001; }).length;
  var body=h('div',{class:'det'},h('div',{class:'card'},h('div',{class:'rows one'},[[T('Τύπος','Type'),sp.type||'–'],[T('Βάθος','Depth'),sp.depth!=null&&sp.depth!==''?sp.depth+' m':'–'],[T('Ψάρια εδώ','Catches here'),String(n)],[T('Συντεταγμένες','Coordinates'),window.AlkyonCoord?AlkyonCoord.fmt(sp.lat,sp.lon):sp.lat.toFixed(5)+', '+sp.lon.toFixed(5)]].map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  if(sp.notes) body.append(h('div',{class:'card'},h('p',{class:'p',text:sp.notes})));
  var sum=B.spotSummary&&B.spotSummary(sp); if(sum) body.append(h('div',{class:'card'},h('h2',{text:T('Τι έπιασες εδώ','What you caught here')}),h('div',{class:'rows one'},sum.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  body.append(h('div',{class:'acts'},
    h('button',{class:'btn pri',type:'button',text:T('Πρόγνωση εδώ','Forecast here'),onclick:function(){ sh.close(true); fcHere(sp.name||T('Σημείο','Spot'),sp.lat,sp.lon); }}),
    goBtn(sp.lat,sp.lon,sp.name)),
    h('div',{class:'acts'},h('a',{class:'btn',href:'https://www.google.com/maps/dir/?api=1&destination='+sp.lat+','+sp.lon,target:'_blank',rel:'noopener',text:T('Οδηγίες με αυτοκίνητο','Driving directions')})),
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Επεξεργασία','Edit'),onclick:function(){ sh.close(true); spotForm(sp); }}),B.shareSpots?h('button',{class:'btn',type:'button',text:T('Στείλε σε φίλο','Send to a friend'),onclick:function(){ B.shareSpots([sp]); }}):null),
    /* v31z549: διαγραφή σημείου από τον χάρτη (τα ψάρια μένουν), με «Αναίρεση» */
    h('div',{class:'acts'},h('button',{class:'btn del',type:'button',text:T('Διαγραφή σημείου','Delete spot'),onclick:function(){ sh.close(true); S().delUndo('spots',sp,T('Διαγράφηκε το σημείο «','Deleted spot “')+(sp.name||'')+T('». Τα ψάρια μένουν.','”. Catches stay.')); }})));
  var sh=B.sheet({title:(sp.name||T('Σημείο','Spot'))+(sp.priv?' 🔒':''),body:body});
}
function fcHere(name,lat,lon){ var a=ls.get('alkyon-places',[])||[], id='p'+Math.round(lat*100)+'_'+Math.round(lon*100);
  if(!a.some(function(p){ return p.id===id; })){ a.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:false,map:1});   /* 1.2.2: χωρίς ειδοποιήσεις, εκτός αν τις ανοίξεις στις Ειδοποιήσεις */ ls.set('alkyon-places',a.slice(0,10)); }
  ls.set('alkyon-fcsel',id); location.hash='#forecast'; }
B.spotFormAt=function(lat,lon){ spotForm(null,{lat:lat,lng:lon}); };
function spotForm(sp,ll){
  var e=sp||null, nm=h('input',{type:'text',maxlength:'60',value:e?e.name||'':'',placeholder:T('π.χ. Ύφαλος Πωμού','e.g. Pomos reef')});
  var ty=h('select',{class:'select'}); SPT.forEach(function(t){ ty.append(h('option',{value:t,text:t})); }); if(e&&e.type) { if(SPT.indexOf(e.type)<0) ty.append(h('option',{value:e.type,text:e.type})); ty.value=e.type; }
  var dp=h('input',{type:'number',min:'0',max:'2000',step:'1',inputmode:'numeric',value:e&&e.depth!=null?e.depth:''}), nt=h('textarea',{rows:'2',maxlength:'400'}); nt.value=e?e.notes||'':'';
  var pv=h('input',{type:'checkbox',checked:!!(e&&e.priv)}), la=e?e.lat:ll.lat, lo=e?e.lon:ll.lng;
  var err=h('p',{class:'err',role:'alert'});
  /* συντεταγμένες: μοίρες και λεπτά όπως στο πλότερ (δέχεται και δεκαδικές, DMS, «35 03.602 N»…), ίδιο με την κλασική (coords.js) */
  var PC=window.AlkyonCoord, cLa=h('input',{type:'text',autocomplete:'off',autocapitalize:'characters',spellcheck:'false',value:PC?PC.fmtOne(+la,'lat'):(+la).toFixed(5),'aria-label':T('Γεωγραφικό πλάτος','Latitude')}), cLo=h('input',{type:'text',autocomplete:'off',autocapitalize:'characters',spellcheck:'false',value:PC?PC.fmtOne(+lo,'lon'):(+lo).toFixed(5),'aria-label':T('Γεωγραφικό μήκος','Longitude')});
  cLa.addEventListener('input',function(){ if(PC&&/[EW]/i.test(cLa.value)&&/[NS]/i.test(cLa.value)){ var pr=PC.parsePair(cLa.value); if(pr){ cLa.value=PC.fmtOne(pr[0],'lat'); cLo.value=PC.fmtOne(pr[1],'lon'); } } });
  var cbx=B.coordBox?B.coordBox(+la,+lo):null, cRow=cbx?h('div',{class:'fld'},h('span',{text:T('Θέση','Position')}),cbx.el):h('div',{class:'g2'},h('label',{class:'fld'},h('span',{text:T('Πλάτος','Latitude')}),cLa),h('label',{class:'fld'},h('span',{text:T('Μήκος','Longitude')}),cLo));
  var f=h('form',{class:'bform',novalidate:true},!e&&B.plotterScan&&B.aiOn&&B.aiOn()?h('button',{class:'btn full',type:'button',text:'📷 '+T('Συντεταγμένες από φωτογραφία plotter','Coordinates from a plotter photo'),onclick:function(){ sh.close(true); B.plotterScan(); }}):null,h('label',{class:'fld'},h('span',{text:T('Όνομα','Name')}),nm),h('label',{class:'fld'},h('span',{text:T('Τύπος','Type')}),ty),h('label',{class:'fld'},h('span',{text:T('Βάθος (m)','Depth (m)')}),dp),
    h('label',{class:'fld'},h('span',{text:T('Σημειώσεις','Notes')}),nt),h('label',{class:'tg'},pv,h('span',{text:T('Ιδιωτικό: δεν το βλέπουν οι φίλοι','Private: friends cannot see it')})),
    cRow,err,h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση σημείου','Save spot')}),
    e?h('button',{class:'btn full del',type:'button',text:T('Διαγραφή σημείου','Delete spot'),onclick:function(){ B.ask(T('Να διαγραφεί το σημείο «'+(e.name||'')+'»; Τα ψάρια μένουν.','Delete the spot “'+(e.name||'')+'”? Catches stay.'),T('Διαγραφή','Delete'),true).then(function(y){ if(y){ S().remove('spots',e.id); sh.close(); B.toast(T('Το σημείο διαγράφηκε.','Spot deleted.')); drawData(); } }); }}):null);
  f.addEventListener('submit',function(ev){ ev.preventDefault(); var name=nm.value.trim(); if(!name){ err.textContent=T('Γράψε όνομα.','Enter a name.'); nm.focus(); return; }
    if(cbx){ var gg=cbx.get(); if(!gg){ err.textContent=T('Οι συντεταγμένες δεν διαβάζονται. Π.χ. N 35°03.602′ και E 32°23.856′.','The coordinates cannot be read. E.g. N 35°03.602′ and E 32°23.856′.'); return; } la=gg.lat; lo=gg.lon; }
    else if(PC){ var pa=PC.parse(cLa.value,'lat'), po=PC.parse(cLo.value,'lon'); if(isNaN(pa)||isNaN(po)||Math.abs(pa)>90||Math.abs(po)>180){ err.textContent=T('Οι συντεταγμένες δεν διαβάζονται. Π.χ. N 35°03.602′ και E 32°23.856′.','The coordinates cannot be read. E.g. N 35°03.602′ and E 32°23.856′.'); return; } la=pa; lo=po; }
    var rec=Object.assign({},e||{},{name:name,type:ty.value,lat:+(+la).toFixed(6),lon:+(+lo).toFixed(6),depth:dp.value===''?null:+dp.value,notes:nt.value.trim()}); if(pv.checked) rec.priv=true; else delete rec.priv;
    S().save('spots',rec); sh.close(); drawData(); B.toast(e?T('Το σημείο ενημερώθηκε.','Spot updated.'):T('Το σημείο αποθηκεύτηκε.','Spot saved.')); });
  var sh=B.sheet({title:e?T('Επεξεργασία σημείου','Edit spot'):T('Νέο σημείο','New spot'),body:f,focus:e?null:'input'});
}
/* ---------- χάρτης εκτός σύνδεσης (ίδια μέθοδος και ίδια αποθήκη με την κλασική: cache alkyon-tiles, λίστα alkyon-offl) ---------- */
var R_=Math.PI/180, dl={run:false,cancel:false,done:0,total:0,fail:0}, dlBox=null;
function otx(lon,z){ return Math.floor((lon+180)/360*Math.pow(2,z)); }
function oty(lat,z){ var s2=Math.sin(Math.max(-85.05,Math.min(85.05,lat))*R_); return Math.floor((.5-Math.log((1+s2)/(1-s2))/(4*Math.PI))*Math.pow(2,z)); }
function ocnt(b,z){ return (otx(b.getEast(),z)-otx(b.getWest(),z)+1)*(oty(b.getSouth(),z)-oty(b.getNorth(),z)+1); }
function oplan(){ if(!map) return {ok:false}; var b=map.getBounds(), zc=Math.floor(map.getZoom()), z0=Math.max(6,zc-2), lay=cfg.base, seaOn=!!cfg.sea, cap=lay==='osm'?400:900, mul=seaOn?2:1, z1=Math.min(16,Math.max(z0,zc+3));
  for(;z1>=z0;z1--){ var n=0; for(var z=z0;z<=z1;z++) n+=ocnt(b,z)*mul; if(n<=cap) return {ok:true,b:b,z0:z0,z1:z1,n:n,lay:lay,sea:seaOn}; } return {ok:false,cap:cap}; }
/* v31z521: μαζί με τον χάρτη κατεβαίνουν και τα πλακίδια βάθους (χρώματα ή ισοβαθείς) που έχεις ανοιχτά */
function depthUrls(p){ var dm=dmode(), lay=dm===1?depthC:dm===2?depthK:null, out=[]; if(!lay||!map) return out; var was=map.hasLayer(lay);
  try{ if(!was){ lay.setOpacity(0); lay.addTo(map); }
    for(var z=p.z0;z<=p.z1;z++){ var x0=otx(p.b.getWest(),z), x1=otx(p.b.getEast(),z), y0=oty(p.b.getNorth(),z), y1=oty(p.b.getSouth(),z);
      for(var x=x0;x<=x1;x++) for(var y=y0;y<=y1;y++) out.push(lay.getTileUrl({x:x,y:y,z:z})); } }catch(e){}
  if(!was){ try{ map.removeLayer(lay); lay.setOpacity(.6); }catch(e){} } return out; }
function ourls(p){ var out=[], tpl=[TILES[p.lay]]; if(p.sea) tpl.push(TILES.sea);
  for(var z=p.z0;z<=p.z1;z++){ var x0=otx(p.b.getWest(),z), x1=otx(p.b.getEast(),z), y0=oty(p.b.getNorth(),z), y1=oty(p.b.getSouth(),z);
    for(var x=x0;x<=x1;x++) for(var y=y0;y<=y1;y++) for(var a=0;a<tpl.length;a++) out.push(tpl[a].replace('{z}',z).replace('{x}',x).replace('{y}',y)); } return out; }
function startDl(){
  if(!('caches' in window)){ B.toast(T('Ο browser δεν υποστηρίζει αποθήκευση χαρτών.','This browser cannot store maps.')); return; }
  var p=oplan(); if(!p.ok){ B.toast(T('Η περιοχή είναι πολύ μεγάλη. Κάνε μεγέθυνση στον χάρτη και ξαναδοκίμασε.','Area too large. Zoom in and try again.')); return; }
  var list=ourls(p).concat(depthUrls(p)); dl={run:true,cancel:false,done:0,total:list.length,fail:0}; paintDl();
  caches.open('alkyon-tiles').then(function(cache){ var i=0;
    function worker(){ if(dl.cancel||i>=list.length) return Promise.resolve(); var u=list[i++];
      return cache.match(u).then(function(hit){ if(hit) return; return fetch(u,{mode:'cors',credentials:'omit'}).then(function(r){ if(!r.ok) throw 0; return cache.put(u,r); }); }).catch(function(){ dl.fail++; }).then(function(){ dl.done++; if(dl.done%10===0||dl.done===dl.total) paintDl(); return worker(); }); }
    return Promise.all([worker(),worker(),worker(),worker()]);
  }).then(function(){ dl.run=false;
    var rec=ls.get('alkyon-offl',[])||[]; if(!dl.cancel&&dl.done-dl.fail>0){ rec.push({t:Date.now(),n:dl.done-dl.fail,lay:p.lay,s:p.b.getSouth(),w:p.b.getWest(),nn:p.b.getNorth(),e:p.b.getEast()}); ls.set('alkyon-offl',rec.slice(-20)); }
    paintDl(); B.toast(dl.cancel?T('Το κατέβασμα σταμάτησε.','Download stopped.'):(T('Χάρτης αποθηκεύτηκε: ','Map saved: ')+(dl.done-dl.fail)+T(' πλακίδια',' tiles')+(dl.fail?T(' · αποτυχίες: ',' · failed: ')+dl.fail:'')));
  }).catch(function(){ dl.run=false; paintDl(); B.toast(T('Το κατέβασμα απέτυχε.','Download failed.')); });
}
function clearDl(){ B.ask(T('Να διαγραφούν όλοι οι χάρτες που κατέβασες;','Delete all downloaded maps?'),T('Διαγραφή','Delete'),true).then(function(y){ if(!y) return; ls.set('alkyon-offl',[]); (window.caches?caches.delete('alkyon-tiles'):Promise.resolve()).then(function(){ paintDl(); B.toast(T('Διαγράφηκαν.','Deleted.')); }); }); }
function paintDl(){ if(!dlBox||!dlBox.isConnected) return; var rec=ls.get('alkyon-offl',[])||[], tiles=rec.reduce(function(a,r){ return a+(r.n||0); },0), p=oplan(); dlBox.replaceChildren();
  dlBox.append(h('p',{class:'sub',text:dl.run?T('Κατεβαίνει… ','Downloading… ')+dl.done+'/'+dl.total:(rec.length?rec.length+T(' περιοχές · ',' areas · ')+tiles+T(' πλακίδια',' tiles'):T('Κατέβασε την περιοχή που βλέπεις για να δουλεύει χωρίς σήμα.','Download the area you see so it works without signal.'))}));
  if(dl.run){ dlBox.append(h('div',{class:'dlpb'},h('i',{style:{width:Math.round(dl.done/Math.max(1,dl.total)*100)+'%'}})),h('div',{class:'acts'},h('button',{class:'btn del',type:'button',text:T('Ακύρωση','Cancel'),onclick:function(){ dl.cancel=true; }}))); return; }
  dlBox.append(h('small',{class:'wn',text:p.ok?T('Τώρα: ~','Now: ~')+p.n+T(' πλακίδια, ζουμ ',' tiles, zoom ')+p.z0+'–'+p.z1+' ('+(p.lay==='osm'?T('οδικός','street'):T('δορυφορικός','satellite'))+(p.sea?' + '+T('σήματα','marks'):'')+')':T('Η περιοχή είναι πολύ μεγάλη. Κάνε μεγέθυνση.','Area too large. Zoom in.')}),
    h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Κατέβασμα','Download'),disabled:!p.ok,onclick:startDl}),rec.length?h('button',{class:'btn',type:'button',text:T('Διαγραφή','Clear'),onclick:clearDl}):null)); }
function offlineSection(body){ dlBox=h('div',{class:'dlbox'}); body.append(h('h3',{class:'h3',text:T('Χάρτης εκτός σύνδεσης','Offline map')}),dlBox,h('p',{class:'note',text:T('Αποθηκεύονται ο χάρτης και τα βάθη που βλέπεις. Η πρόγνωση, τα σημεία, τα ψάρια και ό,τι καιρό είδες τελευταία (άνεμος, κύμα, θερμοκρασία νερού) μένουν και χωρίς σήμα. Για νέα δεδομένα καιρού χρειάζεται σύνδεση.','The map and depths you see are saved. The forecast, spots, catches and the last weather you viewed (wind, waves, water temperature) stay available without signal. New weather data needs a connection.')})); paintDl(); }

var LIC={best:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>',chl:'<svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="2.2"/><circle cx="15" cy="6" r="1.6"/><circle cx="12" cy="13" r="2.6"/><circle cx="18" cy="14" r="1.8"/><circle cx="8" cy="17" r="1.6"/></svg>',sats:'<svg viewBox="0 0 24 24"><path d="M4 18l4-4M10 8l6 6M7 11l6-6 6 6-6 6z"/><path d="M3 21c2 0 3-1 3-3"/></svg>',sst:'<svg viewBox="0 0 24 24"><path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z"/><path d="M17 7h3M17 11h3"/></svg>',heat:'<svg viewBox="0 0 24 24"><path d="M12 3c2 3.5 6 6.2 6 11a6 6 0 0 1-12 0c0-3 1.6-4.9 3-6.5.3 2 1.4 3.2 2.7 3.6C11.3 8.6 11 5.7 12 3z"/></svg>',gear:'<svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/></svg>',
  sat:'<svg viewBox="0 0 24 24"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/></svg>',
  wind:'<svg viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8a3 3 0 1 1-3 3"/></svg>',
  wave:'<svg viewBox="0 0 24 24"><path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/></svg>',
  cur:'<svg viewBox="0 0 24 24"><path d="M4 17c4-1 6-5 9-9"/><path d="M9 7h4v4"/><path d="M11 20c4-1 6-4 8-8"/><path d="M15 12h4v4"/></svg>',
  st:'<svg viewBox="0 0 24 24"><path d="M6 21V4"/><path d="M6 4h11l-3 3.5 3 3.5H6"/><path d="M3 21h6"/></svg>',
  card:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h4M7 14h7M15 10h2"/></svg>',
  depth:'<svg viewBox="0 0 24 24"><path d="M3 6c3 0 3 2 6 2s3-2 6-2 3 2 6 2"/><path d="M12 11v9M8 16l4 4 4-4"/></svg>',
  marks:'<svg viewBox="0 0 24 24"><path d="M12 3v14"/><path d="M8 7h8l-2 4h-4z"/><path d="M5 21h14"/></svg>',
  zone:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
  mpa:'<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/></svg>',
  nav:'<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  port:'<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M8 11h8"/><path d="M4 14c0 4 3.6 7 8 7s8-3 8-7"/></svg>',
  spot:'<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  fish:'<svg viewBox="0 0 32 24"><path d="M3 12C8 4.5 17 4 22 12c-5 8-14 7.5-19 0z"/><path d="M22 12l7-6.5v13z"/></svg>',
  dam:'<svg viewBox="0 0 24 24"><path d="M3 20h18"/><path d="M6 20V9l6-4 6 4v11"/><path d="M9 14c1 1 2 1 3 0s2-1 3 0"/></svg>',
  miss:'<svg viewBox="0 0 32 24"><path d="M3 12C8 4.5 17 4 22 12c-5 8-14 7.5-19 0z"/><path d="M22 12l7-6.5v13z"/><path d="M4 21L26 3"/></svg>',
  shop:'<svg viewBox="0 0 24 24"><path d="M4 9h16l-1.2 10.5a1.5 1.5 0 0 1-1.5 1.5H6.7a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2"/></svg>',
  imp:'<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6M9 14l3 3 3-3"/></svg>',
  off:'<svg viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z"/><path d="M12 9.5v6M9.5 13l2.5 2.5 2.5-2.5"/></svg>',
  dl:'<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 20h16"/></svg>',
  share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'};
function layersSheet(){
  var body=h('div',{class:'lyr'}), ready=!!window.AlkyonWindMap, tiles=[];
  /* πλακίδιο: icon, τίτλος, υπότιτλος, get() → ενεργό, set(v) */
  function tile(ic,lab,sub,get,set,dis){ var b=h('button',{type:'button',class:'ltile',disabled:!!dis,onclick:function(){ set(!get()); setTimeout(paint,60); setTimeout(paint,600); }},h('span',{class:'lic',html:LIC[ic]}),h('b',{text:lab}),sub?h('small',{text:sub}):null);
    var t={b:b,get:get}; tiles.push(t); return b; }
  function paint(){ tiles.forEach(function(t){ var on=false; try{ on=!!t.get(); }catch(e){} t.b.setAttribute('aria-pressed',String(on)); }); if(B.qpaint) B.qpaint(); }
  function grid(title,items){ body.append(h('h3',{class:'lyh',text:title}),h('div',{class:'lgrid'},items.filter(Boolean))); }
  /* χάρτης βάσης: δύο μεγάλα πλακίδια με προεπισκόπηση */
  var bases=h('div',{class:'lbase'});
  [['sat',T('Δορυφόρος','Satellite')],['osm',T('Δρόμοι','Streets')]].forEach(function(o){ bases.append(h('button',{type:'button',class:'lbt '+o[0],'aria-pressed':String(cfg.base===o[0]),onclick:function(){ cfg.base=o[0]; saveCfg(); drawBase(); applyDepth(); [].forEach.call(bases.children,function(x){ x.setAttribute('aria-pressed',String(x.classList.contains(o[0]))); }); }},h('span',{class:'lprev'}),h('b',{text:o[1]}))); });
  try{ var cc=map.getCenter(), zz=Math.max(3,Math.min(14,Math.round(map.getZoom())-1)), nz=Math.pow(2,zz), tx=Math.floor((cc.lng+180)/360*nz), lr=cc.lat*Math.PI/180, ty=Math.floor((1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*nz);
    [].forEach.call(bases.children,function(bt){ var k=bt.classList.contains('sat')?'sat':'osm', u=TILES[k].replace('{z}',zz).replace('{x}',tx).replace('{y}',ty).replace('{s}','a'), pv=bt.querySelector('.lprev'), im=new Image();
      im.onload=function(){ pv.style.backgroundImage='url("'+u+'")'; pv.classList.add('real'); }; im.src=u; }); }catch(e){}
  body.append(h('h3',{class:'lyh',text:T('Χάρτης','Map type')}),bases);
  /* 1.2.2: καλύτερα σημεία από όλα τα δεδομένα */
  if(B.bestSpots) grid(T('Πού να πάω','Where to go'),[tile('best',T('Καλύτερα σημεία','Best spots'),T('καιρός, τροφή, νερό, βυθός','weather, food, water, seabed'),function(){ return B.bestSpots.on(); },function(v){ B.bestSpots.set(v); })]);
  grid(T('Καιρός','Weather'),[
    tile('wind',T('Άνεμος','Wind'),T('ροή, 5 μέρες','flow, 5 days'),windOn,setWind,!ready),
    tile('wave',T('Κύμα','Waves'),T('ύψος, 5 μέρες','height, 5 days'),seaOn,setSeaSt,!ready),
    tile('cur',T('Ρεύματα','Currents'),T('τώρα, σε kn','now, in kn'),function(){ return !!cfg.cur; },function(v){ cfg.cur=v; saveCfg(); currents(true); }),
    tile('sst',T('Νερό','Water'),T('θερμοκρ., μέτωπα','temp., fronts'),function(){ return !!(B.sst&&B.sst.on()); },function(v){ if(B.sst) B.sst.set(v); }),
    tile('chl',T('Τροφή','Food'),T('χλωροφύλλη, δορυφόρος','chlorophyll, satellite'),function(){ return !!cfg.chl; },function(v){ cfg.chl=v; saveCfg(); drawSat(); if(v) setTimeout(function(){ satNote('chl'); },900); }),
    tile('sats',T('Νερό δορυφόρου','Satellite water'),T('θερμοκρ. 1 km, χθες','temp. 1 km, yesterday'),function(){ return !!cfg.sats; },function(v){ cfg.sats=v; saveCfg(); drawSat(); if(v) setTimeout(function(){ satNote('sst'); },900); }),
    tile('depth',T('Δομή βυθού','Seabed'),T('drop-offs, υψώματα','drop-offs, rises'),function(){ return !!(B.seabed&&B.seabed.on()); },function(v){ if(B.seabed) B.seabed.set(v); }),
    tile('st',T('Σταθμοί','Stations'),T('πραγματικές μετρήσεις','measured'),function(){ return pressed('bWindSt'); },setStations,!ready),
    tile('card',T('Κάρτα καιρού','Weather card'),T('πάνω στον χάρτη','on the map'),function(){ return ls.get('alkyon-v4-mapwx',true)!==false; },function(v){ ls.set('alkyon-v4-mapwx',v); drawMw(); })]);
  /* βάθη: πλακίδιο + επιλογή τρόπου */
  var dm=dmode(), dl=(window.AlkyonDense&&AlkyonDense.mode())||ls.get('alkyon-dl','std'), dbox=h('div',{class:'ldepth'});
  function dpaint(){ dbox.replaceChildren(B.seg([['0',T('Κλειστά','Off')],['1',T('Χρώματα','Colours')],['2',T('Γραμμές','Lines')]],String(dm),function(v){ dm=+v; setDepth(dm,dm===2?dl:null); dpaint(); paint(); },T('Βάθη θάλασσας','Sea depths')));
    if(dm===2) dbox.append(B.seg([['std',T('Στάνταρ','Standard')],['5','5 m'],['10','10 m'],['20','20 m']],dl,function(v){ dl=v; setDepth(2,v); },T('Πυκνότητα γραμμών','Line density')),h('small',{class:'wn',text:T('Οι γραμμές 5, 10 και 20 m φαίνονται από ζουμ 11 και πάνω.','The 5, 10 and 20 m lines show from zoom 11 up.')})); }
  dpaint();
  body.append(h('h3',{class:'lyh',text:T('Βάθη θάλασσας','Sea depths')}),dbox);
  grid(T('Θάλασσα και κανόνες','Sea and rules'),[
    tile('marks',T('Ναυτικά σήματα','Sea marks'),'OpenSeaMap',function(){ return !!cfg.sea; },function(v){ cfg.sea=v; saveCfg(); drawBase(); applyDepth(); }),
    tile('zone',T('Απαγόρευση','No fishing'),T('Τμήμα Αλιείας','Fisheries Dept'),function(){ return !!cfg.zones; },function(v){ cfg.zones=v; saveCfg(); drawOverlays(); }),
    tile('mpa',T('Προστατευόμενες','Protected'),'EMODnet',function(){ return !!cfg.mpa; },function(v){ cfg.mpa=v; saveCfg(); drawOverlays(); }),
    cbtn('bNav')?tile('nav',T('Περιορισμοί','Restrictions'),'ProtectedSeas',function(){ return pressed('bNav'); },function(v){ if(pressed('bNav')!==v){ var b=cbtn('bNav'); if(b) b.click(); } }):null,
    cbtn('bPorts')?tile('port',T('Λιμάνια','Ports'),T('και ράμπες','and ramps'),function(){ return pressed('bPorts'); },function(v){ if(pressed('bPorts')!==v){ var b=cbtn('bPorts'); if(b) b.click(); } }):null]);
  grid(T('Τα δικά μου','My data'),[
    tile('spot',T('Σημεία','Spots'),T('τα σημεία σου','your spots'),function(){ return !!cfg.spots; },function(v){ cfg.spots=v; saveCfg(); drawData(); }),
    tile('fish',T('Ψάρια','Catches'),T('ανά είδος','by species'),function(){ return !!cfg.fish; },function(v){ cfg.fish=v; saveCfg(); drawData(); }),
    tile('heat',T('Πού πιάνω','Where I catch'),T('ανά μήνα, είδος','by month, species'),function(){ return !!cfg.heat; },function(v){ cfg.heat=v; saveCfg(); drawHeat(); if(v) setTimeout(heatSheet,250); }),
    tile('miss',T('Χαμένα','Lost bites'),T('τσιμπήματα','missed fish'),function(){ return !!cfg.fish&&cfg.miss!==false; },function(v){ cfg.miss=v; if(v) cfg.fish=true; saveCfg(); drawData(); }),
    tile('dam',T('Φράγματα','Reservoirs'),T('πληρότητα','levels'),function(){ return !!cfg.dams; },function(v){ cfg.dams=v; saveCfg(); drawOverlays(); })]);
  /* ενέργειες */
  var acts=h('div',{class:'list lacts'});
  function act(ic,lab,sub,fn){ acts.append(h('button',{class:'li',type:'button',onclick:fn},h('span',{class:'ic lic',html:LIC[ic]}),h('span',{class:'tx'},h('b',{text:lab}),sub?h('small',{text:sub}):null),B.icon('chev'))); }
  if(B.nearShops) act('shop',T('Κοντινά μαγαζιά ψαρικής','Nearby tackle shops'),T('Ανοίγει το Google Maps γύρω από τη θέση σου','Opens Google Maps around your position'),function(){ B.closeSheet(); B.nearShops(); });
  if(B.importSheet) act('imp',T('Εισαγωγή από plotter ή ρολόι','Import from plotter or watch'),'GPX · KML · CSV · FIT',function(){ B.closeSheet(); B.importSheet(); });
  act('spot',T('Νέο σημείο στο κέντρο','New spot at the centre'),T('Ή κράτα πατημένο τον χάρτη','Or long-press the map'),function(){ B.closeSheet(); spotForm(null,map.getCenter()); });
  if(B.gearPanel) act('gear',T('Παραγάδι, δίχτυ, ζεμπίλι','Longline, net, pot'),T('Ρίψη και ανέβασμα εργαλείων','Set and haul gear'),function(){ B.closeSheet(); B.gearPanel(); });
  act('off',T('Χάρτης εκτός σύνδεσης','Offline map'),T('Κατέβασε την περιοχή που βλέπεις','Download the area you see'),function(){ var bx=h('div',{class:'bform'}); offlineSection(bx); B.sheet({title:T('Χάρτης εκτός σύνδεσης','Offline map'),body:bx,stack:true}); });
  if(window.AlkyonPorts) act('plus',T('Πρόσθεσε λιμάνι ή ράμπα','Add a port or ramp'),T('Πάτα μετά στον χάρτη','Then tap the map'),function(){ B.closeSheet(); B.closeSheet(); AlkyonPorts.startAdd(); });
  if(B.shareSpots) act('share',T('Στείλε τα σημεία μου','Send my spots'),T('Σύνδεσμος για φίλο','A link for a friend'),function(){ B.shareSpots(S().raw('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'; })); });
  body.append(h('h3',{class:'lyh',text:T('Εργαλεία','Tools')}),acts);
  /* υπόμνημα: σύμβολα και χρώματα περιοχών (όπως η κλασική) */
  var Z=window.AlkyonZoneCols||{noentry:'#9f1239',nofish:'#e02020',season:'#e8890c'}, leg=h('div',{class:'legend'});
  [['<span class="lg me"></span>',T('Η θέση σου','Your position')],['<span class="lg fish many">3</span>',T('Πολλά ψάρια μαζί','Several catches')],['<span class="lg fmiss">✕</span>',T('Χαμένο τσίμπημα','Lost bite')],
    ['<span class="lg fg" style="--g:#8d5a2b"></span>',T('Σφυρίδες, ροφοί','Groupers')],['<span class="lg fg" style="--g:#3f78a8"></span>',T('Λαβράκια','Sea bass')],['<span class="lg fg" style="--g:#c59a12"></span>',T('Σαργοί, φαγκριά, συναγρίδες','Breams, dentex')],
    ['<span class="lg fg" style="--g:#1d55c4"></span>',T('Πελαγικά (τόνος, μαγιάτικο)','Pelagics (tuna, amberjack)')],['<span class="lg fg" style="--g:#d9472b"></span>',T('Μπαρμπούνια','Red mullet')],['<span class="lg fg" style="--g:#8e44ad"></span>',T('Καλαμάρια, σουπιές, χταπόδια','Squid, cuttlefish, octopus')],['<span class="lg fg" style="--g:#2b8c7a"></span>',T('Άλλα ψάρια','Other fish')],
    ['<span class="lg spot" style="background:#b5532c"></span>',T('Σημείο: βράχια / ύφαλος','Spot: rocks / reef')],['<span class="lg spot" style="background:#d9b44a"></span>',T('Σημείο: άμμος','Spot: sand')],['<span class="lg spot" style="background:#37474f;border-radius:3px"></span>',T('Σημείο: ναυάγιο','Spot: wreck')],['<span class="lg spot" style="background:#6d4c9f"></span>',T('Σημείο: ταμπλάς','Spot: ledge')],['<span class="lg spot" style="background:#1e88c9"></span>',T('Σημείο: ρεύμα / ανοιχτά','Spot: current / open')],['<span class="lg spot" style="background:#2e7d4f"></span>',T('Σημείο: λιμάνι / μόλος','Spot: port / jetty')],['<span class="lg spot"></span>',T('Σημείο: άλλο','Spot: other')],
    ['<span class="lg mob">MOB</span>',T('Άνθρωπος στη θάλασσα','Man overboard')],['<span class="lg zn" style="--c:'+Z.nofish+'"></span>',T('Απαγόρευση αλιείας','No fishing')],['<span class="lg zn" style="--c:'+Z.noentry+'"></span>',T('Ούτε διέλευση σκαφών','No boats allowed')],['<span class="lg zn" style="--c:'+Z.season+'"></span>',T('Εποχικός περιορισμός','Seasonal limit')]]
    .forEach(function(r){ leg.append(h('div',{class:'lgrow'},h('span',{class:'lgs',html:r[0]}),h('span',{text:r[1]}))); });
  body.append(h('h3',{class:'lyh',text:T('Υπόμνημα','Legend')}),leg);
  if(!ready) body.append(h('p',{class:'sub',text:T('Τα στρώματα καιρού φορτώνουν…','Weather layers are loading…')}));
  body.append(h('p',{class:'foot',text:T('Κράτα πατημένο τον χάρτη για ψάρι, σημείο, πρόγνωση ή πλοήγηση σε εκείνο το σημείο. Βάθη, άνεμος, κύμα και ρεύματα είναι ενδεικτικά (μοντέλα και EMODnet), όχι ναυτικός χάρτης ή όργανο.','Long-press the map for a catch, spot, forecast or navigation at that point. Depths, wind, waves and currents are indicative (models and EMODnet), not a nautical chart or instrument.')}));
  paint();
  B.sheet({title:T('Στρώματα χάρτη','Map layers'),body:body});
}

/* ---------- σελίδα ---------- */
var box=null, lmEl=null, fishb=null, mapBell=null;
function fishCounts(){ if(!fishb||!B.tripCounts) return; var c=B.tripCounts(), b=fishb.querySelectorAll('b'); b[0].textContent=c.pest||0; b[1].textContent=c.miss; b[2].textContent=c.n; }
function mount(el){
  root=el; document.body.classList.add('mapon'); cfg=Object.assign({base:'sat',sea:true,spots:true,fish:true,zones:true,mpa:false,dams:B.prof()==='lake',wind:false,seast:false},ls.get('alkyon-v4-map',{}));
  if(!box){ lmEl=h('div',{class:'lmap',id:'lmap'}); box=h('div',{class:'mapbox',id:'v4map'},lmEl); }
  if(!mbtns){ mbtns=h('div',{class:'mapbtns'}); hookBtns(); }
  var bar=h('div',{class:'mapbar'},
    h('button',{class:'iconbtn',type:'button','aria-label':T('Στρώματα','Layers'),html:B.iconSvg('map'),onclick:layersSheet}),
    (gpsBtn=h('button',{class:'iconbtn gpsb',type:'button','aria-label':T('Η θέση μου','My position'),html:B.iconSvg('gps'),onclick:function(){ followPause=0; setFollow(true); locate(true); }})),
    h('button',{class:'iconbtn gearbtn',hidden:!gearAtSea(),type:'button','aria-label':T('Εργαλεία: παραγάδι, δίχτυ, ζεμπίλι','Gear: longline, net, pot'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/></svg>',onclick:function(){ if(B.gearPanel) B.gearPanel(); }}),
    mbtns,
    /* v31z531: ειδοποιήσεις και από τον χάρτη (κόκκινος αριθμός = αδιάβαστες) */
    (mapBell=h('a',{class:'iconbtn bellb',href:'#inbox','aria-label':T('Ειδοποιήσεις','Notifications'),html:B.iconSvg('bell')})));
  setFollow(follow);
  if(B.inboxUnread) B.inboxUnread().then(function(n){ var o=mapBell.querySelector('.bdg'); if(o) o.remove(); if(n>0) mapBell.append(h('i',{class:'bdg',text:n>9?'9+':String(n)})); });
  /* γρήγορα στρώματα: άνεμος, κύμα, ρεύματα, βάθη (τα υπόλοιπα στο μενού «Στρώματα») */
  var qc=h('div',{class:'mchips',role:'group','aria-label':T('Γρήγορα στρώματα','Quick layers')});
  function qchip(ic,lab,get,set){ var b=h('button',{type:'button',class:'mchip',onclick:function(){ set(!get()); setTimeout(qpaint,80); setTimeout(qpaint,900); }},h('span',{html:LIC[ic]}),h('b',{text:lab})); b._g=get; qc.append(b); }
  function qpaint(){ [].forEach.call(qc.children,function(b){ var on=false; try{ on=!!b._g(); }catch(e){} b.setAttribute('aria-pressed',String(on)); if(b._lab){ var t=b.querySelector('b'); if(t) t.textContent=b._lab(); } }); }
  if(!window._qpL){ window._qpL=1; ['alkyon-wxchange','alkyon-windstop'].forEach(function(ev){ window.addEventListener(ev,function(){ setTimeout(function(){ if(window._qpaint) window._qpaint(); },120); }); }); }
  window._qpaint=qpaint;
  /* v31z521: σαν το Windy, ένα χρωματιστό στρώμα τη φορά: Άνεμος ή Κύμα */
  /* v31z524: άνεμος και κύμα μαζί· χρώμα = κύμα (αν είναι ανοιχτό) αλλιώς άνεμος, σωματίδια = άνεμος, τιμές πάνω στον χάρτη */
  qchip('wind',T('Άνεμος','Wind'),windOn,setWind); qchip('wave',T('Κύμα','Waves'),seaOn,setSeaSt);
  qchip('cur',T('Ρεύματα','Currents'),function(){ return !!cfg.cur; },function(v){ cfg.cur=v; saveCfg(); currents(true); });
  qchip('sst',T('Νερό','Water'),function(){ return !!(B.sst&&B.sst.on()); },function(v){ if(B.sst) B.sst.set(v); });
  /* βάθη: κάθε πάτημα αλλάζει πυκνότητα γραμμών: Στάνταρ → 5 m → 10 m → 20 m → κλειστά (χρώματα από το μενού Στρωμάτων) */
  var DSEQ=['off','std','5','10','20'];
  function dcur(){ var m=dmode(); if(m===0) return 'off'; if(m===1) return 'col'; return String((window.AlkyonDense&&AlkyonDense.mode())||ls.get('alkyon-dl','std')); }
  var dchip=h('button',{type:'button',class:'mchip',onclick:function(){ var c=dcur(), i=DSEQ.indexOf(c), nx=DSEQ[(i<0?0:i+1)%DSEQ.length]; if(nx==='off') setDepth(0); else { ls.set('alkyon-dl',nx); setDepth(2,nx); }
      if(nx!=='off'&&+nx&&map&&map.getZoom()<11) B.toast(T('Οι γραμμές ','The ')+nx+T(' m φαίνονται από ζουμ 11 και πάνω.',' m lines show from zoom 11 up.'));
      setTimeout(qpaint,80); setTimeout(qpaint,900); }},h('span',{html:LIC.depth}),h('b',{text:T('Βάθη','Depths')}));
  dchip._g=function(){ return dmode()>0; }; dchip._lab=function(){ var c=dcur(); return c==='off'?T('Βάθη','Depths'):c==='col'?T('Χρώματα','Colours'):c==='std'?T('Βάθη','Depths'):c+' m'; }; qc.append(dchip);
  B.qpaint=qpaint; setTimeout(qpaint,400); setTimeout(qpaint,2500);
  heatPill=h('button',{class:'heatpill',type:'button',hidden:!cfg.heat,onclick:heatSheet},h('span',{class:'hpd'}),h('span',{class:'tx'},h('b',{text:''}),h('small',{text:''})));
  var trip=h('button',{class:'tripbtn',type:'button',onclick:function(){ B.tripStart(); }},h('span',{class:'tbic',html:B.profBadge?B.profBadge(B.prof()):'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h18l-2.5 4.5h-13z"/><path d="M12 3v12"/><path d="M12 4l6 9h-6"/></svg>'}),h('span',{text:B.prof()==='boat'||(B.fishSide&&B.fishSide()==='boat')?T('Έναρξη εξόδου','Start a trip'):T('Ξεκινάω ψάρεμα','Start fishing')}));
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
  /* v31z542: λαγοκέφαλος / έφαγε το δόλωμα (δεν μετράει στα ψάρια) */
  var bPest=h('button',{class:'fb fbp',type:'button','aria-label':T('Λαγοκέφαλος ή έφαγε το δόλωμα','Toadfish or bait taken'),onclick:function(){ if(B.pestSheet) B.pestSheet(); }},h('span',{class:'fbpi',text:'🐡'}),h('b',{text:'0'}));
  /* v31z545: μεγάλα κουμπιά (βρεγμένα χέρια, γάντια, κύμα) */
  var bBig=h('button',{class:'fb fbx',type:'button','aria-label':T('Μεγάλα κουμπιά','Big buttons'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',onclick:function(){ if(B.bigTrip) B.bigTrip.open(); }});
  fishb=h('div',{class:'fishbtns'},bPest,bMiss,bCatch,bBig); fishCounts();
  el.replaceChildren(box,cross,bar,qc,heatPill,trip,seab,dtBarEl(),fishb,mwBox());
  if(B.smartChip){ var rc=h('div',{class:'rtwrap'}); B.smartChip().forEach(function(n){ rc.append(n); }); el.append(rc); }
  if(map){ setTimeout(function(){ if(!map) return; map.invalidateSize(); drawData(); applyPend(); drawDirect(); },30); locate(false); return; }
  leaflet().then(function(){
    if(!root||map) return;
    var p=B.lastPos(), v=ls.get('alkyon-v4-mapview',null);
    map=L.map(lmEl,{zoomControl:false,attributionControl:true,tap:true}).setView(v?[v.lat,v.lon]:(p?[p.lat,p.lon]:[35.0,33.2]),v?v.z:(p?12:9));
    drawBase(); drawData(); drawOverlays(); applyDepth(); applyPend(); locate(false); drawDirect(); if(cfg.cur) currents(true);
    map.on('zoomend',function(){ drawData(); }); map.on('moveend',function(){ declutterSoon(); if(cfg.cur) currents(false); var c=map.getCenter(); ls.set('alkyon-v4-mapview',{lat:+c.lat.toFixed(5),lon:+c.lng.toFixed(5),z:map.getZoom()}); });
    map.on('contextmenu',function(e){ try{ e.originalEvent&&e.originalEvent.preventDefault(); }catch(x){} pointMenu(e.latlng); });
    map.on('dragstart',function(){ setFollow(false); }); map.on('popupopen',function(){ followPause=Date.now()+20000; });
    map.on('popupopen',function(e){ var c=e.popup.getContent(); if(c&&c.classList&&c.classList.contains('portpop')&&!c.querySelector('.pgo')){ var ll=e.popup.getLatLng(), nm=(c.querySelector('b')||{}).textContent||''; var r=c.querySelector('.pbtns')||c; var g=h('button',{class:'pb pgo',type:'button',text:T('Πήγαινε εκεί','Go there'),onclick:function(){ map.closePopup(); B.goTo(ll.lat,ll.lng,nm); }}); r.insertBefore(g,r.firstChild); e.popup.update(); } });
    setTimeout(function(){ map.invalidateSize(); },60);
    classicMods();
  }).catch(function(){ box.replaceChildren(h('div',{class:'card empty',style:{margin:'80px 16px'}},h('h3',{text:T('Ο χάρτης δεν φορτώθηκε','The map did not load')}),h('p',{text:T('Έλεγξε τη σύνδεση.','Check your connection.')}))); });
}
/* ο χάρτης δεν καταστρέφεται: μένει έτοιμος με τα στρώματά του για την επόμενη φορά· σταματά μόνο το GPS της σελίδας */
function unmount(){ replayStop(); gShow=null; revOnClear=null; document.body.classList.remove('mapon'); if(watch!=null){ try{ navigator.geolocation.clearWatch(watch); }catch(e){} watch=null; } document.body.classList.remove('maptrip'); root=null; }
/* μετάβαση στον χάρτη σε ένα σημείο (ψάρι, σημείο από φίλο) ή με μια διαδρομή εξόδου */
var pend=null, gRev=null;
/* ---------- επανάληψη εξόδου: η διαδρομή «παίζει» και τα ψάρια εμφανίζονται τη στιγμή που πιάστηκαν ---------- */
var rp=null;
function replayStop(){ if(!rp) return; clearInterval(rp.iv); if(rp.g&&map) map.removeLayer(rp.g); if(rp.bar) rp.bar.remove(); document.body.classList.remove('replaying'); rp=null; }
function bmsOf(b){ if(!b.date||!b.time) return null; var p=b.date.split('-').map(Number), q=b.time.split(':').map(Number); return new Date(p[0],p[1]-1,p[2],q[0],q[1]).getTime(); }
function replay(t){ replayStop(); if(!map||!t||!t.track||t.track.length<2) return;
  var pts=t.track.map(function(p){ return L.latLng(p[0],p[1]); }), t0=t.startMs||null, t1=t.endMs||null, seg=[0], tot=0;
  for(var i=1;i<pts.length;i++){ tot+=pts[i-1].distanceTo(pts[i]); seg.push(tot); }
  var fish=S().raw('bites').filter(function(b){ if(b.deleted||typeof b.lat!=='number') return false; if(t.sid&&b.trip===t.sid) return true; var m=bmsOf(b); return t0&&t1&&m!=null&&m>=t0-60000&&m<=t1+60000; })
    .map(function(b){ var m=bmsOf(b); return {b:b,f:t0&&t1&&m!=null?Math.max(0,Math.min(1,(m-t0)/(t1-t0))):null}; });
  /* ψάρια χωρίς ώρα: στο πιο κοντινό σημείο της διαδρομής */
  fish.forEach(function(x){ if(x.f!=null) return; var bi=0, bd=1e12, ll=L.latLng(x.b.lat,x.b.lon); pts.forEach(function(p,i){ var d=p.distanceTo(ll); if(d<bd){ bd=d; bi=i; } }); x.f=tot?seg[bi]/tot:0; });
  var g=L.layerGroup().addTo(map), full=L.polyline(pts,{color:'#ffffff',weight:3,opacity:.35,dashArray:'4 6'}).addTo(g), done=L.polyline([pts[0]],{color:'#ff8a50',weight:5,opacity:.95}).addTo(g);
  var boat=L.marker(pts[0],{icon:icon('rpboat','<i></i>'),interactive:false,zIndexOffset:1000}).addTo(g), fm={};
  map.fitBounds(L.latLngBounds(pts),{padding:[50,50]});
  var sl=h('input',{type:'range',min:'0',max:'1000',value:'0','aria-label':T('Χρόνος εξόδου','Trip time')}), lab=h('b',{class:'rptime'}), cnt=h('span',{class:'rpcnt'}), play=h('button',{class:'iconbtn',type:'button','aria-label':T('Αναπαραγωγή / παύση','Play / pause')});
  function setPlay(on){ play.innerHTML=on?'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>':'<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>'; }
  function at(f){ var d=f*tot, i=1; while(i<seg.length-1&&seg[i]<d) i++; var a=seg[i-1], b=seg[i], k=b>a?(d-a)/(b-a):0, p=L.latLng(pts[i-1].lat+(pts[i].lat-pts[i-1].lat)*k,pts[i-1].lng+(pts[i].lng-pts[i-1].lng)*k);
    var hd=Math.atan2(pts[i].lng-pts[i-1].lng,pts[i].lat-pts[i-1].lat)*180/Math.PI; return {p:p,i:i,hd:hd}; }
  function show(f){ var q=at(f); boat.setLatLng(q.p); var el=boat.getElement(); if(el) el.style.setProperty('--hd',q.hd+'deg'); done.setLatLngs(pts.slice(0,q.i).concat([q.p]));
    var n=0; fish.forEach(function(x,j){ var vis=x.f<=f+1e-6; if(vis&&!fm[j]){ fm[j]=L.marker([x.b.lat,x.b.lon],{icon:icon(x.b.miss?'fish miss':'fish sym g-'+fishGroup(x.b)+' pop',x.b.miss?'✕':(fishGroup(x.b)==='ceph'?CSVG:FSVG)),title:x.b.species||''}).on('click',function(){ fishSheet([x.b]); }).addTo(g); }
      else if(!vis&&fm[j]){ g.removeLayer(fm[j]); delete fm[j]; } if(vis&&!x.b.miss) n+=Math.max(1,Math.floor(+x.b.cnt)||1); });
    var ms=t0&&t1?t0+(t1-t0)*f:null; lab.textContent=ms?B.pad(new Date(ms).getHours())+':'+B.pad(new Date(ms).getMinutes()):Math.round(f*100)+'%'; cnt.textContent=n+' '+T(n===1?'ψάρι':'ψάρια',n===1?'catch':'catches')+' · '+B.num(f*tot/1000,1)+' km'; }
  var running=false, f=0, iv=null, DUR=15000, STEP=60;
  function tick(){ f=Math.min(1,f+STEP/DUR); sl.value=String(Math.round(f*1000)); show(f); if(f>=1){ running=false; clearInterval(iv); iv=null; setPlay(false); } }
  function start(){ if(f>=1) f=0; running=true; setPlay(true); clearInterval(iv); iv=setInterval(tick,STEP); rp.iv=iv; }
  play.addEventListener('click',function(){ if(running){ running=false; clearInterval(iv); iv=null; setPlay(false); } else start(); });
  sl.addEventListener('input',function(){ f=(+sl.value)/1000; show(f); });
  var bar=h('div',{class:'rpbar'},h('div',{class:'rph'},h('span',null,h('b',{text:(t.spot||T('Έξοδος','Trip'))}),h('small',{text:' · '+(t.date||'').split('-').reverse().join('/')})),h('button',{class:'iconbtn sm',type:'button','aria-label':T('Κλείσιμο','Close'),html:B.iconSvg('close'),onclick:replayStop})),
    h('div',{class:'rpc'},play,sl,lab),cnt);
  document.body.append(bar); document.body.classList.add('replaying'); rp={g:g,bar:bar,iv:null}; setPlay(false); show(0); setTimeout(start,700); }
B.replayTrip=function(t){ if(!t||!t.track||t.track.length<2) return; pend={lat:t.track[0][0],lon:t.track[0][1],z:13,tr:t.track,replay:t}; if(!/^#map/.test(location.hash||'')) location.hash='#map'; else if(map&&root) applyPend(); };
/* v31z520: η διαδρομή ή το σημείο που άνοιξες από το Ημερολόγιο μένει στον χάρτη με ένα κουμπί «✕» για να φύγει */
var revChip=null;
var revOnClear=null;
function revClear(){ if(gRev&&map){ map.removeLayer(gRev); } gRev=null; if(revChip){ revChip.remove(); revChip=null; } var f=revOnClear; revOnClear=null; if(f) f(); }
B.mapRevClear=revClear;
function revShow(lab,trip){ if(revChip) revChip.remove();
  revChip=h('div',{class:'revchip',role:'group'},h('span',{class:'rvt',text:lab}),
    trip?h('button',{type:'button',class:'rvp','aria-label':T('Επανάληψη εξόδου','Replay trip'),text:'▶',onclick:function(){ replay(trip); }}):null,
    h('button',{type:'button',class:'rvx','aria-label':T('Απόκρυψη από τον χάρτη','Hide from the map'),text:'✕',onclick:revClear}));
  document.body.append(revChip); }
function applyPend(){ if(!pend||!map) return false; var q=pend; pend=null;
  revClear();
  if(q.replay&&q.tr&&q.tr.length>1){ setTimeout(function(){ replay(q.replay); },300); }
  if(q.tr&&q.tr.length>1){ gRev=L.layerGroup([L.polyline(q.tr.map(function(p){ return [p[0],p[1]]; }),{color:'#ff8a50',weight:5,opacity:.95}),L.circleMarker(q.tr[0],{radius:7,color:'#fff',weight:3,fillColor:'#3ddc97',fillOpacity:1}),L.circleMarker(q.tr[q.tr.length-1],{radius:7,color:'#fff',weight:3,fillColor:'#ff4d4d',fillOpacity:1})]).addTo(map); map.fitBounds(L.latLngBounds(q.tr.map(function(p){ return [p[0],p[1]]; })),{padding:[40,40]}); revShow(q.lab||T('Διαδρομή εξόδου','Trip route'),q.trip||q.replay||null); }
  else { map.setView([q.lat,q.lon],q.z||15); gRev=L.layerGroup([L.circleMarker([q.lat,q.lon],{radius:11,color:'#E4572E',weight:3,fillOpacity:.15})]).addTo(map); revShow(q.lab||T('Σημείο από το Ημερολόγιο','Point from the logbook'),null); }
  return true; }
B.spotSheet=function(sp){ spotSheet(sp); };
/* ονόματα σημείων που πέφτουν το ένα πάνω στο άλλο: φαίνεται μόνο το πρώτο (τα υπόλοιπα με πάτημα στο σημείο) */
function declutter(){ var kept=[]; [].forEach.call(document.querySelectorAll('#lmap .mk.spot b'),function(b){ b.style.visibility=''; var r=b.getBoundingClientRect(); if(!r.width) return;
  var hit=kept.some(function(k){ return !(r.right<k.left-4||r.left>k.right+4||r.bottom<k.top-2||r.top>k.bottom+2); }); if(hit) b.style.visibility='hidden'; else kept.push(r); }); }
var dcT=null; function declutterSoon(){ clearTimeout(dcT); dcT=setTimeout(declutter,120); }
/* 1.2.2: πάντα μεταφέρει στον Χάρτη (πριν, αν ο χάρτης είχε ανοίξει μία φορά, μετακινούνταν μόνο ο κρυφός χάρτης και έμενες στην ίδια σελίδα) */
B.mapGo=function(lat,lon,z,tr){ pend={lat:lat,lon:lon,z:z,tr:tr}; if(!/^#map/.test(location.hash||'')) location.hash='#map'; else if(map&&root) applyPend(); };

B.view('map',{title:T('Χάρτης','Map'),mount:mount,unmount:unmount,resume:function(){ if(map&&root){ map.invalidateSize(); drawData(); applyPend(); } }});
var ddF=0; B.on('store',function(k){ if(map&&/^alkyon-(bites|spots|gear)$/.test(k)&&!ddF) ddF=requestAnimationFrame(function(){ ddF=0; if(map) drawData(); }); });
B.on('gear-pos',function(){ if(map) drawGear(); });
['track','anchor','mob','trip'].forEach(function(n){ B.on(n,function(){ if(map) drawSea(); fishCounts(); }); });
B.on('store',function(k){ if(k==='alkyon-bites') fishCounts(); if(k==='alkyon-fc7'||k==='alkyon-units') drawMw(); });
setInterval(function(){ if(root) drawMw(); },10*60000);
})();
