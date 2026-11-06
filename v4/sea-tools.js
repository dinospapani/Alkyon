/* Alkyon 4 · βοηθητικά θάλασσας κοινά με την κλασική:
   - βάθος από τον χάρτη βαθών EMODnet (B.depthAt) και συμπλήρωση βάθους στα ψάρια χωρίς βάθος (depthSrc:'chart'), όπως η κλασική
   - τα ονόματα που περιμένουν οι μονάδες χάρτη της κλασικής (AlkyonCore.getPosition, depthAt, getCond…)
   - η κλάση body.ontrip όσο είσαι σε έξοδο, που τη διαβάζουν οι μονάδες της κλασικής */
(function(){
'use strict';
var B=window.AK, ls=B.ls;

/* ---------- βάθος EMODnet (ίδιος κώδικας με την κλασική) ---------- */
function to(ms){ try{ return AbortSignal.timeout(ms); }catch(e){ return undefined; } }
function num(v){ v=+v; return isFinite(v)?v:null; }
function emodDepth(lat,lon){
  return fetch('https://rest.emodnet-bathymetry.eu/depth_sample?geom='+encodeURIComponent('POINT('+lon.toFixed(5)+' '+lat.toFixed(5)+')'),{signal:to(9000)})
    .then(function(r){ return r.ok?r.json():null; }).then(function(j){ if(Array.isArray(j)) j=j[0]; var v=j&&num(j.avg!=null?j.avg:(j.depth!=null?j.depth:j.value)); if(v!=null&&v>0) return Math.round(v); throw 0; })
    .catch(function(){ var d=0.004, q='SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=emodnet:mean&QUERY_LAYERS=emodnet:mean&STYLES=&INFO_FORMAT='+encodeURIComponent('application/json')+'&CRS=EPSG:4326&BBOX='+[lat-d,lon-d,lat+d,lon+d].join(',')+'&WIDTH=101&HEIGHT=101&I=50&J=50';
      return fetch('https://ows.emodnet-bathymetry.eu/wms?'+q,{signal:to(9000)}).then(function(r){ return r.ok?r.json():null; }).then(function(j){ var p=j&&j.features&&j.features[0]&&j.features[0].properties; if(p){ for(var k in p){ var v=num(p[k]); if(v!=null&&v<0) return Math.round(-v); } } return null; }).catch(function(){ return null; }); });
}
var dcache={};
B.depthAt=function(lat,lon){ /* 1.8.33: στη στεριά το EMODnet δίνει το υψόμετρο (π.χ. 150 στην Πάφο) σαν «βάθος» → κανένα βάθος */ try{ if(B.landExact&&B.landExact(lat,lon)===true) return Promise.resolve(null); }catch(e){} var k=lat.toFixed(4)+','+lon.toFixed(4); if(dcache[k]!=null) return Promise.resolve(dcache[k]); return emodDepth(lat,lon).then(function(d){ if(d!=null) dcache[k]=d; return d; }).catch(function(){ return null; }); };

/* βάθος στα ψάρια με θέση και χωρίς βάθος: στο παρασκήνιο, λίγα κάθε φορά */
var dBusy=false, dTm=null, tried={};
function fillDepths(){
  if(dBusy||navigator.onLine===false) return; dBusy=true;
  var list=B.store.raw('bites').filter(function(b){ return !b.deleted&&typeof b.lat==='number'&&typeof b.lon==='number'&&(b.depth==null||b.depth==='')&&!tried[b.id]; }).slice(0,12), i=0;
  (function next(){ if(i>=list.length){ dBusy=false; return; } var b=list[i++];
    B.depthAt(b.lat,b.lon).then(function(d){ tried[b.id]=1; var cur=B.store.get('bites',b.id); if(!cur||(cur.depth!=null&&cur.depth!=='')) return; if(d!=null&&d>0) B.store.save('bites',Object.assign({},cur,{depth:d,depthSrc:'chart'})); })
      .catch(function(){}).then(function(){ setTimeout(next,1200); }); })();
}
setTimeout(fillDepths,25000);
B.on('store',function(k){ if(k==='alkyon-bites'){ clearTimeout(dTm); dTm=setTimeout(fillDepths,8000); } });

/* ---------- ονόματα για τις μονάδες της κλασικής ---------- */
function getPosition(){ return new Promise(function(res,rej){ var f=B.trip&&B.trip.fix&&B.trip.fix(); if(f&&Date.now()-(f.t||0)<120000){ res({lat:f.lat,lon:f.lon}); return; }
  if(!navigator.geolocation){ rej(new Error('no geolocation')); return; }
  navigator.geolocation.getCurrentPosition(function(p){ res({lat:p.coords.latitude,lon:p.coords.longitude}); },rej,{enableHighAccuracy:true,timeout:8000,maximumAge:120000}); }); }
function utcMin(){ return -new Date().getTimezoneOffset(); }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function biteMs(b){ var a=(b.date||today()).split('-').map(Number), t=(b.time||'12:00').split(':').map(Number), off=b.tz!=null?b.tz:-new Date(a[0],a[1]-1,a[2],12).getTimezoneOffset(); return Date.UTC(a[0],a[1]-1,a[2],t[0],t[1])-off*60000; }
B.biteMs=biteMs;
var Store={get:function(k){ return B.store.raw(k).filter(function(x){ return !x.deleted; }); },raw:function(k){ return B.store.raw(k); },save:function(k,r){ var id=B.store.save(k,r); return Promise.resolve(id); },remove:function(k,id){ B.store.remove(k,id); return Promise.resolve(); },
  misses:function(){ return B.store.misses(); },on:function(k,f){ B.on('store',function(x){ if(x==='alkyon-'+k) f(); }); }};
window.AlkyonCore=Object.assign(window.AlkyonCore||{},{h:B.h,Store:Store,biteMs:biteMs,getPosition:getPosition,depthAt:B.depthAt,getCond:function(){ var p=B.lastPos(); return p?{lat:p.lat,lon:p.lon}:null; },
  utcMin:utcMin,utcOff:utcMin,nicosiaToday:today,lsGet:ls.get,lsSet:ls.set,toast:function(t){ B.toast(t); },bc:function(b){ return Math.max(1,Math.floor(+b.cnt)||1); }});

/* ---------- body.ontrip ---------- */
function syncTrip(){ var on=!!(B.trip&&B.trip.active&&B.trip.active()); document.body.classList.toggle('ontrip',on); }
B.on('trip',syncTrip); setTimeout(syncTrip,300);
/* ---------- ειδοποιήσεις καιρού όσο η εφαρμογή είναι ανοιχτή (ίδια λογική με την κλασική sea.js, ρύθμιση alkyon-wxal) ----------
   Δυνατός καιρός στις επόμενες ώρες, «ο καιρός δυναμώνει» κατά την έξοδο ή με άγκυρα, και «έρχεται καλή ώρα για ψάρεμα». */
var U=window.AlkyonUnits;
function T(a,b){ return B.EN?b:a; }
function wxOn(){ return ls.get('alkyon-wxal',true)!==false; }
B.wxAlerts={on:wxOn,set:function(v){ ls.set('alkyon-wxal',!!v); if(v){ try{ if('Notification' in window&&Notification.permission==='default') Notification.requestPermission(); }catch(e){} setTimeout(wxTick,500); } }};
function notify(title,body){ if(B.inboxAdd) B.inboxAdd(title,body,'sea');
  try{ if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){ navigator.serviceWorker.getRegistration(new URL('../',location.href).href).then(function(r){ if(r) r.showNotification(title,{body:body,icon:'../icon-192.png',tag:'alkyon-sea',vibrate:[200,100,200]}); else new Notification(title,{body:body}); }).catch(function(){ new Notification(title,{body:body}); }); return; } }catch(e){}
  B.toast(title+(body?' · '+body:''));
}
var wxBusy=false;
function tripOn(){ return !!(B.trip&&B.trip.active&&B.trip.active()); }
function wxTick(){
  var PF=window.PF; if(!PF||!wxOn()||wxBusy) return; var c=B.lastPos(); if(!c) return; wxBusy=true;
  var cache=ls.get('alkyon-wxa',null), p=(cache&&cache.f&&Date.now()-cache.t<25*60000&&Math.abs(cache.lat-c.lat)<0.05&&Math.abs(cache.lon-c.lon)<0.05)?Promise.resolve(cache.f):PF.getForecast(c.lat,c.lon,null,{days:2}).then(function(f){ ls.set('alkyon-wxa',{t:Date.now(),lat:c.lat,lon:c.lon,f:f}); return f; });
  p.then(wxCheck).catch(function(){}).then(function(){ wxBusy=false; });
}
function wxCheck(f){
  if(!f||!f.days||!f.nowLocal) return;
  var nowH=f.nowLocal.slice(0,13), hrs=[]; f.days.forEach(function(d){ (d.hours||[]).forEach(function(x){ if(x.t&&x.t.slice(0,13)>nowH) hrs.push(x); }); });
  var next=hrs.slice(0,4), sent=ls.get('alkyon-wxa-sent',{})||{}, now=Date.now();
  function once(k,gap){ if(sent[k]&&now-sent[k]<gap) return false; sent[k]=now; ls.set('alkyon-wxa-sent',sent); return true; }
  var mxW=0, mxG=0, mxV=0, at='', cur=null; (f.days[0].hours||[]).forEach(function(x){ if(x.t&&x.t.slice(0,13)===nowH) cur=x; });
  next.forEach(function(x){ if((x.wind||0)>mxW){ mxW=x.wind; at=x.t.slice(11,16); } mxG=Math.max(mxG,x.gust||0); mxV=Math.max(mxV,x.wave||0); });
  var LM=(window.PF&&PF.lims)?PF.lims():{wind:14,wave:0.9,gust:24};
  var rising=(cur&&cur.wind!=null&&mxW-cur.wind>=7), bad=mxW>=LM.wind+8||mxG>=LM.gust+6||mxV>=LM.wave*2, warn=!bad&&(mxW>LM.wind||mxV>LM.wave||mxG>LM.gust||rising), anc=!!ls.get('alkyon-anchor',null);
  var txt=T('Άνεμος έως ','Wind up to ')+(U?U.wind(mxW):Math.round(mxW)+' kn')+(mxV?', '+T('κύμα ','waves ')+(U?U.wave(mxV):mxV+' m'):'')+(at?' '+T('γύρω στις ','around ')+at:'');
  if(bad&&once('bad',3*3600000)) notify(T('⚠ Δυνατός καιρός σε λίγες ώρες','⚠ Rough weather within hours'),txt);
  else if(warn&&(tripOn()||anc)&&once('warn',3*3600000)) notify(T('Ο καιρός δυναμώνει','Weather is picking up'),txt);
  var d0=f.days[0]; if(d0&&d0.win&&d0.safe){ var m=parseInt(f.nowLocal.slice(11,13),10)*60+parseInt(f.nowLocal.slice(14,16)||'0',10), until=d0.win.s*60-m;
    if(until>=20&&until<=75&&once('win'+d0.date,20*3600000)) notify(T('Έρχεται καλή ώρα για ψάρεμα','A good fishing window is coming'),T('Ξεκινά σε ~','Starts in ~')+until+T(' λεπτά (',' min (')+B.pad(d0.win.s)+':00–'+B.pad(d0.win.e+1)+':00)'); }
}
setTimeout(wxTick,9000); setInterval(function(){ if(!document.hidden) wxTick(); },10*60000); document.addEventListener('visibilitychange',function(){ if(!document.hidden) setTimeout(wxTick,1500); });
})();
