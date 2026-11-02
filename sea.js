/* Εργαλεία θάλασσας: MOB, συναγερμός άγκυρας, οθόνη που μένει αναμμένη, χάρτης εκτός σύνδεσης, ειδοποιήσεις καιρού.
   Όλα δουλεύουν με GPS και μόνο όσο η εφαρμογή είναι ανοιχτή. Δεν είναι ναυτικό όργανο. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, U=window.AlkyonUnits;
var $=function(i){ return document.getElementById(i); };
var R=Math.PI/180, mb=document.querySelector('.mapbtns'); if(!mb) return;
function vib(p){ try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} }
function distM(a,b,c,d){ var dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742000*Math.asin(Math.min(1,Math.sqrt(x))); }
function hm(ms){ var d=new Date(ms+C.utcMin()*60000); return ('0'+d.getUTCHours()).slice(-2)+':'+('0'+d.getUTCMinutes()).slice(-2); }
function tripOn(){ var s=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); return !!(s&&s.active); }
function ic(path){ return '<svg viewBox="0 0 24 24">'+path+'</svg>'; }

/* ---------- θέση ---------- */
function getFix(cb,fail){
  var fx=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix();
  if(fx&&fx.lat!=null&&Date.now()-fx.t<15000){ cb({lat:fx.lat,lon:fx.lon,acc:fx.acc||0}); return; }
  if(!navigator.geolocation){ fail&&fail(); return; }
  navigator.geolocation.getCurrentPosition(function(p){ cb({lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy||0}); },function(){ fail&&fail(); },{enableHighAccuracy:true,timeout:9000,maximumAge:5000});
}

/* ---------- κουμπιά στον χάρτη ---------- */
var bMob=document.createElement('button'); bMob.type='button'; bMob.id='bMob'; bMob.className='mbtn mob'; bMob.setAttribute('aria-label',T('Άνθρωπος στη θάλασσα (MOB)','Man overboard (MOB)')); bMob.title=bMob.getAttribute('aria-label'); bMob.innerHTML='<b>MOB</b>';
var bTools=document.createElement('button'); bTools.type='button'; bTools.id='bTools'; bTools.className='mbtn'; bTools.setAttribute('aria-label',T('Άγκυρα και MOB','Anchor and MOB')); bTools.title=bTools.getAttribute('aria-label');
bTools.innerHTML=ic('<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M8 11h8"/><path d="M4 14c0 4 3.6 7 8 7s8-3 8-7"/>');
var bOff=document.createElement('button'); bOff.type='button'; bOff.id='bOffline'; bOff.className='mbtn'; bOff.setAttribute('aria-label',T('Χάρτης εκτός σύνδεσης','Offline map')); bOff.title=bOff.getAttribute('aria-label');
bOff.innerHTML=ic('<path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>');
(mb.parentNode||document.body).appendChild(bMob); mb.appendChild(bTools); mb.appendChild(bOff); /* v31z63: το MOB μένει σταθερά κάτω δεξιά, έξω από τη στήλη που σκρολάρει */

/* ---------- MOB ---------- */
var mobs=C.lsGet('alkyon-mob',[]); if(!Array.isArray(mobs)) mobs=[];
var mobL=L.layerGroup().addTo(map);
function drawMob(){
  mobL.clearLayers();
  mobs.forEach(function(m,i){
    var icon=L.divIcon({className:'mobic',html:'<span>MOB</span>',iconSize:[46,26],iconAnchor:[23,13]});
    L.marker([m.lat,m.lon],{icon:icon,zIndexOffset:900}).bindPopup(function(){
      var d=document.createElement('div'); d.className='pop';
      var b=document.createElement('b'); b.textContent='MOB '+hm(m.t); d.appendChild(b);
      var s=document.createElement('div'); s.className='note'; s.textContent=AlkyonCoord.fmt(m.lat,m.lon); d.appendChild(s);
      var x=document.createElement('button'); x.type='button'; x.className='pact solo'; x.textContent=T('Διαγραφή σημείου','Delete mark');
      x.addEventListener('click',function(){ mobs.splice(i,1); C.lsSet('alkyon-mob',mobs); drawMob(); map.closePopup(); });
      d.appendChild(x); return d;
    }).addTo(mobL);
  });
}
drawMob();
var mobBusy=false;
function doMob(){
  if(mobBusy) return; mobBusy=true; vib([200,100,200,100,400]);
  getFix(function(p){
    mobBusy=false; var m={lat:p.lat,lon:p.lon,t:Date.now()}; mobs.push(m); mobs=mobs.slice(-10); C.lsSet('alkyon-mob',mobs); drawMob();
    try{ map.flyTo([p.lat,p.lon],Math.max(map.getZoom(),16)); }catch(e){}
    if(window.AlkyonDirect) window.AlkyonDirect.go(p.lat,p.lon,'MOB '+hm(m.t));
    C.toast(T('MOB σημειώθηκε και ξεκίνησε η πλοήγηση προς το σημείο.','MOB marked, navigating to it.'));
  },function(){ mobBusy=false; C.toast(T('Δεν βρέθηκε θέση GPS. Άνοιξε τη θέση του κινητού και ξαναπάτησε.','No GPS fix. Turn on location and press again.')); });
}
bMob.addEventListener('click',doMob);

/* ---------- οθόνη αναμμένη ---------- */
var wl=null;
function wantWake(){ return !!C.lsGet('alkyon-wake',true)&&(tripOn()||!!an); }
function wlSync(){
  try{
    if(wantWake()){ if(!wl&&navigator.wakeLock&&!document.hidden){ navigator.wakeLock.request('screen').then(function(l){ wl=l; l.addEventListener('release',function(){ wl=null; }); }).catch(function(){ wl=null; }); } }
    else if(wl){ wl.release(); wl=null; }
  }catch(e){ wl=null; }
}
document.addEventListener('visibilitychange',function(){ if(!document.hidden) wlSync(); });
window.addEventListener('alkyon-sess',function(){ wlSync(); renderPanel(); });

/* ---------- συναγερμός άγκυρας ---------- */
var an=C.lsGet('alkyon-anchor',null); if(an&&(typeof an.lat!=='number'||typeof an.r!=='number')) an=null;
var anW=null, anL=L.layerGroup().addTo(map), over=0, alarmT=null, ac=null, lastAn=0, muted=0;
var bar=document.createElement('div'); bar.id='ancAlarm'; bar.hidden=true; bar.setAttribute('role','alert');
bar.innerHTML='<div class="amsg"><b></b><span></span></div><div class="abtn"><button type="button" class="amute"></button><button type="button" class="astop"></button></div>';
document.body.appendChild(bar);
bar.querySelector('.amute').textContent=T('Σίγαση 2 λεπτά','Mute 2 min'); bar.querySelector('.astop').textContent=T('Τέλος συναγερμού','Stop alarm');
function audio(){ try{ if(!ac){ var A=window.AudioContext||window.webkitAudioContext; if(A) ac=new A(); } if(ac&&ac.state==='suspended') ac.resume(); }catch(e){} }
function beep(){
  if(!ac||Date.now()<muted) return;
  try{ var o=ac.createOscillator(), g=ac.createGain(); o.type='square'; o.frequency.value=(Math.floor(Date.now()/900)%2)?740:988; g.gain.value=.35; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+.35); }catch(e){}
}
function alarm(txt,sub){
  bar.hidden=false; bar.querySelector('b').textContent=txt; bar.querySelector('span').textContent=sub||'';
  if(alarmT) return;
  alarmT=setInterval(function(){ beep(); if(Date.now()>=muted) vib([350,150,350]); },900); beep();
  try{ if('Notification' in window&&Notification.permission==='granted'&&document.hidden) notify('⚓ '+txt,sub||''); }catch(e){}
}
function silence(){ if(alarmT){ clearInterval(alarmT); alarmT=null; } bar.hidden=true; over=0; }
bar.querySelector('.amute').addEventListener('click',function(){ muted=Date.now()+120000; });
bar.querySelector('.astop').addEventListener('click',function(){ silence(); anOff(); });
function drawAn(){
  anL.clearLayers(); if(!an) return;
  L.circle([an.lat,an.lon],{radius:an.r,color:'#ffb020',weight:2,fillColor:'#ffb020',fillOpacity:.12,dashArray:'6 6'}).addTo(anL);
  L.circleMarker([an.lat,an.lon],{radius:6,color:'#fff',weight:2,fillColor:'#ffb020',fillOpacity:1}).addTo(anL);
}
function onAn(p){
  if(!an) return; var c=p.coords; lastAn=Date.now();
  if(c.accuracy&&c.accuracy>Math.max(30,an.r*0.7)) return;
  var d=distM(an.lat,an.lon,c.latitude,c.longitude);
  if(d>an.r){ over++; if(over>=2) alarm(T('Η άγκυρα σέρνει!','Anchor dragging!'),T('Απόσταση ','Distance ')+Math.round(d)+' m · '+T('όριο ','limit ')+an.r+' m'); }
  else { over=0; if(alarmT&&d<an.r*0.85) silence(); }
  renderPanel();
}
function anWatch(){
  if(anW!=null||!navigator.geolocation) return;
  try{ anW=navigator.geolocation.watchPosition(onAn,function(){},{enableHighAccuracy:true,maximumAge:2000,timeout:30000}); }catch(e){ anW=null; }
}
setInterval(function(){ if(an&&lastAn&&Date.now()-lastAn>120000&&!alarmT) alarm(T('Χάθηκε το GPS','GPS lost'),T('Ο συναγερμός άγκυρας δεν μπορεί να ελέγξει τη θέση.','The anchor alarm cannot check the position.')); },20000);
function anOn(){
  audio();
  window.AlkyonAsk.prompt(T('Ακτίνα συναγερμού σε μέτρα. Η θέση της άγκυρας σημειώνεται τώρα.','Alarm radius in metres. The anchor position is marked now.'),{value:String(C.lsGet('alkyon-anr',50)),title:T('Συναγερμός άγκυρας','Anchor alarm'),ok:T('Ενεργοποίηση','Start'),max:4}).then(function(v){
    if(v==null) return; var r=Math.max(20,Math.min(500,parseInt(v,10)||50)); C.lsSet('alkyon-anr',r);
    audio(); getFix(function(p){
      an={lat:p.lat,lon:p.lon,r:r,t:Date.now()}; C.lsSet('alkyon-anchor',an); over=0; lastAn=Date.now(); anWatch(); drawAn(); wlSync(); renderPanel();
      try{ map.flyTo([p.lat,p.lon],Math.max(map.getZoom(),16)); }catch(e){}
      C.toast(T('Συναγερμός άγκυρας ενεργός (','Anchor alarm on (')+r+' m)');
      askNotif();
    },function(){ C.toast(T('Δεν βρέθηκε θέση GPS.','No GPS fix.')); });
  });
}
function anOff(){
  an=null; C.lsSet('alkyon-anchor',null); if(anW!=null){ try{ navigator.geolocation.clearWatch(anW); }catch(e){} anW=null; } silence(); drawAn(); wlSync(); renderPanel();
}
if(an){ lastAn=Date.now(); anWatch(); drawAn(); }

/* ---------- ειδοποιήσεις ---------- */
function askNotif(){ try{ if('Notification' in window&&Notification.permission==='default') Notification.requestPermission(); }catch(e){} }
function notify(title,body){
  try{
    if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){
      if(navigator.serviceWorker&&navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function(r){ r.showNotification(title,{body:body,icon:'icon-192.png',tag:'alkyon-sea',vibrate:[200,100,200]}); }).catch(function(){ new Notification(title,{body:body}); });
      else new Notification(title,{body:body});
      return;
    }
  }catch(e){}
  C.toast(title+(body?' · '+body:''));
}
function alertsOn(){ return C.lsGet('alkyon-wxal',true)!==false; }
var wxBusy=false;
function wxTick(){
  var PF=window.PF; if(!PF||!alertsOn()||wxBusy) return;
  var c=C.getCond(); if(!c||c.lat==null) return; wxBusy=true;
  var cache=C.lsGet('alkyon-wxa',null), p=(cache&&cache.f&&Date.now()-cache.t<25*60000&&Math.abs(cache.lat-c.lat)<0.05&&Math.abs(cache.lon-c.lon)<0.05)?Promise.resolve(cache.f):PF.getForecast(c.lat,c.lon,null,{days:2}).then(function(f){ C.lsSet('alkyon-wxa',{t:Date.now(),lat:c.lat,lon:c.lon,f:f}); return f; });
  p.then(function(f){ wxCheck(f); }).catch(function(){}).then(function(){ wxBusy=false; });
}
function wxCheck(f){
  if(!f||!f.days||!f.nowLocal) return;
  var nowH=f.nowLocal.slice(0,13), hrs=[]; f.days.forEach(function(d){ (d.hours||[]).forEach(function(h){ if(h.t&&h.t.slice(0,13)>nowH) hrs.push(h); }); });
  var next=hrs.slice(0,4), sent=C.lsGet('alkyon-wxa-sent',{}), now=Date.now();
  function once(k,gap){ if(sent[k]&&now-sent[k]<gap) return false; sent[k]=now; C.lsSet('alkyon-wxa-sent',sent); return true; }
  var mxW=0, mxG=0, mxV=0, at=''; next.forEach(function(h){ if((h.wind||0)>mxW){ mxW=h.wind; at=h.t.slice(11,16); } mxG=Math.max(mxG,h.gust||0); mxV=Math.max(mxV,h.wave||0); });
  var cur=C.getCond()||{}, rising=(cur.wind!=null&&mxW-cur.wind>=7);
  var bad=mxW>=22||mxG>=30||mxV>=1.8, warn=!bad&&(mxW>=17||mxV>=1.2||rising);
  if(bad&&once('bad',3*3600000)) notify(T('⚠ Δυνατός καιρός σε λίγες ώρες','⚠ Rough weather within hours'),(T('Άνεμος έως ','Wind up to ')+U.wind(mxW)+(mxV?', '+T('κύμα ','waves ')+U.wave(mxV):'')+(at?' '+T('γύρω στις ','around ')+at:'')));
  else if(warn&&(tripOn()||an)&&once('warn',3*3600000)) notify(T('Ο καιρός δυναμώνει','Weather is picking up'),T('Άνεμος έως ','Wind up to ')+U.wind(mxW)+(mxV?', '+T('κύμα ','waves ')+U.wave(mxV):'')+(at?' '+T('γύρω στις ','around ')+at:''));
  var d0=f.days[0]; if(d0&&d0.win&&d0.safe){
    var m=parseInt(f.nowLocal.slice(11,13),10)*60+parseInt(f.nowLocal.slice(14,16)||'0',10), until=d0.win.s*60-m;
    if(until>=20&&until<=75&&once('win'+d0.date,20*3600000)) notify(T('Έρχεται καλή ώρα για ψάρεμα','A good fishing window is coming'),T('Ξεκινά σε ~','Starts in ~')+until+T(' λεπτά (',' min (')+('0'+d0.win.s).slice(-2)+':00–'+('0'+(d0.win.e+1)).slice(-2)+':00)');
  }
}
setTimeout(wxTick,9000); setInterval(wxTick,10*60000); document.addEventListener('visibilitychange',function(){ if(!document.hidden) setTimeout(wxTick,1500); });

/* ---------- χάρτης εκτός σύνδεσης ---------- */
var TC='alkyon-tiles', TURL={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
function tx(lon,z){ return Math.floor((lon+180)/360*Math.pow(2,z)); }
function ty(lat,z){ var s=Math.sin(Math.max(-85.05,Math.min(85.05,lat))*R); return Math.floor((.5-Math.log((1+s)/(1-s))/(4*Math.PI))*Math.pow(2,z)); }
function cnt(b,z){ return (tx(b.getEast(),z)-tx(b.getWest(),z)+1)*(ty(b.getSouth(),z)-ty(b.getNorth(),z)+1); }
function plan(){
  var b=map.getBounds(), zc=Math.floor(map.getZoom()), z0=Math.max(6,zc-2), lay=C.lsGet('alkyon-layer','sat'), seaOn=$('bSea')&&$('bSea').getAttribute('aria-pressed')==='true';
  var cap=lay==='osm'?400:900, mul=seaOn?2:1, z1=Math.min(16,Math.max(z0,zc+3));
  for(;z1>=z0;z1--){ var n=0; for(var z=z0;z<=z1;z++) n+=cnt(b,z)*mul; if(n<=cap) return {ok:true,b:b,z0:z0,z1:z1,n:n,lay:lay,sea:seaOn}; }
  return {ok:false,cap:cap};
}
function urls(p){
  var out=[], z, x, y, a, tpl=[TURL[p.lay]]; if(p.sea) tpl.push(TURL.sea);
  for(z=p.z0;z<=p.z1;z++){ var x0=tx(p.b.getWest(),z), x1=tx(p.b.getEast(),z), y0=ty(p.b.getNorth(),z), y1=ty(p.b.getSouth(),z);
    for(x=x0;x<=x1;x++) for(y=y0;y<=y1;y++) for(a=0;a<tpl.length;a++) out.push(tpl[a].replace('{z}',z).replace('{x}',x).replace('{y}',y)); }
  return out;
}
var dl={run:false,cancel:false,done:0,total:0,fail:0};
function startDl(){
  if(!('caches' in window)){ C.toast(T('Ο browser δεν υποστηρίζει αποθήκευση χαρτών.','This browser cannot store maps.')); return; }
  var p=plan(); if(!p.ok){ C.toast(T('Η περιοχή είναι πολύ μεγάλη. Κάνε μεγέθυνση στον χάρτη και ξαναδοκίμασε.','Area too large. Zoom in and try again.')); return; }
  var list=urls(p); dl={run:true,cancel:false,done:0,total:list.length,fail:0}; renderPanel();
  caches.open(TC).then(function(cache){
    var i=0;
    function worker(){
      if(dl.cancel||i>=list.length) return Promise.resolve();
      var u=list[i++];
      return cache.match(u).then(function(hit){ if(hit) return; return fetch(u,{mode:'cors',credentials:'omit'}).then(function(r){ if(!r.ok) throw 0; return cache.put(u,r); }); }).catch(function(){ dl.fail++; }).then(function(){ dl.done++; if(dl.done%10===0||dl.done===dl.total) renderPanel(); return worker(); });
    }
    return Promise.all([worker(),worker(),worker(),worker()]);
  }).then(function(){
    dl.run=false;
    var rec=C.lsGet('alkyon-offl',[]); if(!dl.cancel&&dl.done-dl.fail>0){ rec.push({t:Date.now(),n:dl.done-dl.fail,lay:p.lay,s:p.b.getSouth(),w:p.b.getWest(),nn:p.b.getNorth(),e:p.b.getEast()}); C.lsSet('alkyon-offl',rec.slice(-20)); }
    renderPanel(); C.toast(dl.cancel?T('Το κατέβασμα σταμάτησε.','Download stopped.'):(T('Χάρτης αποθηκεύτηκε: ','Map saved: ')+(dl.done-dl.fail)+T(' πλακίδια',' tiles')+(dl.fail?T(' · αποτυχίες: ',' · failed: ')+dl.fail:'')));
  }).catch(function(){ dl.run=false; renderPanel(); C.toast(T('Το κατέβασμα απέτυχε.','Download failed.')); });
}
function clearDl(){
  window.AlkyonAsk(T('Να διαγραφούν όλοι οι χάρτες που κατέβασες;','Delete all downloaded maps?'),{title:T('Χάρτες εκτός σύνδεσης','Offline maps'),ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel'),danger:true}).then(function(ok){
    if(!ok) return; C.lsSet('alkyon-offl',[]); (window.caches?caches.delete(TC):Promise.resolve()).then(function(){ renderPanel(); C.toast(T('Διαγράφηκαν.','Deleted.')); });
  });
}

/* ---------- πίνακας ---------- */
var panel=document.createElement('div'); panel.id='seaPanel'; panel.hidden=true;
panel.innerHTML='<div class="spcard" role="dialog" aria-label="'+T('Εργαλεία θάλασσας','Sea tools')+'"><div class="sphead"><b>'+T('Εργαλεία θάλασσας','Sea tools')+'</b><button type="button" class="spx" aria-label="'+T('Κλείσιμο','Close')+'">✕</button></div><div class="spbody"></div><p class="note">'+T('Λειτουργούν μόνο με ανοιχτή εφαρμογή και GPS. Δεν αντικαθιστούν τον κανονικό εξοπλισμό ασφαλείας.','They work only while the app is open with GPS. They do not replace proper safety equipment.')+'</p></div>';
document.body.appendChild(panel);
var body=panel.querySelector('.spbody');
function row(title,desc,ctl){ var r=document.createElement('div'); r.className='sprow'; var t=document.createElement('div'); t.className='sptx'; var b=document.createElement('b'); b.textContent=title; var s=document.createElement('span'); s.textContent=desc||''; t.append(b,s); r.append(t); if(ctl) r.append(ctl); return r; }
function btn(txt,cls,fn){ var b=document.createElement('button'); b.type='button'; b.className='spb '+(cls||''); b.textContent=txt; b.addEventListener('click',fn); return b; }
function sw(on,fn){ var b=document.createElement('button'); b.type='button'; b.className='spsw'; b.setAttribute('role','switch'); b.setAttribute('aria-checked',String(!!on)); b.addEventListener('click',fn); return b; }

/* v31z351: τα εργαλεία μοιράζονται εκεί που ανήκουν. «sea» = Ενέργειες (άγκυρα, οθόνη, MOB), «map» = Στρώματα (χάρτης εκτός σύνδεσης),
   «set»/«data» = κάρτες στις Ρυθμίσεις του Προφίλ. Τα «Ψάρια/Σημεία στον χάρτη» είναι μόνο στα Στρώματα (όχι διπλά). */
var MODES={sea:['anchor','wake','mob'],map:['offline'],set:['wxal','voice'],data:['wxold','wxfill','insights']};
var MTITLE={sea:T('Άγκυρα και MOB','Anchor and MOB'),map:T('Χάρτης εκτός σύνδεσης','Offline map')};
var cardSet=null, cardData=null;
function mkCard(id,title,note){
  var c=document.createElement('div'); c.id=id; c.className='card setcard seacard';
  var h=document.createElement('h3'); h.textContent=title; c.append(h);
  if(note){ var p=document.createElement('p'); p.className='note'; p.textContent=note; c.append(p); }
  var b=document.createElement('div'); b.className='spbody'; c.append(b); c._b=b; return c;
}
function setCardsLive(){
  var ps=$('pSettings'); if(!ps) return false;
  if(!cardSet){ cardSet=mkCard('seaSetCard',T('Καιρός και φωνή','Weather and voice')); cardData=mkCard('seaDataCard',T('Δεδομένα ψαριών','Catch data'),T('Συμπληρώνει καιρό, πίεση και άνεμο σε ψάρια που καταγράφηκαν χωρίς αυτά.','Fills in weather, pressure and wind for catches logged without them.')); }
  if(!cardSet.isConnected) ps.appendChild(cardSet); if(!cardData.isConnected) ps.appendChild(cardData);
  return !!(ps.getClientRects().length);
}
function putter(){
  var mode=panel.dataset.mode||'sea', want=MODES[mode]||MODES.sea, bufP=[], bufS=[], bufD=[];
  return function(k,r){
    if(k===null){
      if(!panel.hidden){ body.replaceChildren.apply(body,bufP); var tt=panel.querySelector('.sphead b'); if(tt) tt.textContent=MTITLE[mode]||MTITLE.sea; }
      if(cardSet){ cardSet._b.replaceChildren.apply(cardSet._b,bufS); cardData._b.replaceChildren.apply(cardData._b,bufD); cardData.hidden=!bufD.length; }
      return;
    }
    if(!r) return;
    if(want.indexOf(k)>=0) bufP.push(r);
    else if(MODES.set.indexOf(k)>=0) bufS.push(r);
    else if(MODES.data.indexOf(k)>=0) bufD.push(r);
  };
}
function renderPanel(){
  var cardsOn=setCardsLive(); if(panel.hidden&&!cardsOn) return; var put=putter();
  var d=null; if(an){ var f=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix(); if(f&&f.lat!=null) d=Math.round(distM(an.lat,an.lon,f.lat,f.lon)); }
  put('anchor',row(T('Συναγερμός άγκυρας','Anchor alarm'),an?(T('Ενεργός · ακτίνα ','On · radius ')+an.r+' m'+(d!=null?' · '+T('τώρα ','now ')+d+' m':'')):T('Ηχεί αν το σκάφος απομακρυνθεί από το σημείο που ρίχνεις άγκυρα.','Sounds if the boat drifts away from where you anchored.'),an?btn(T('Σταμάτημα','Stop'),'danger',anOff):btn(T('Ενεργοποίηση','Start'),'acc',anOn)));
  put('wake',row(T('Οθόνη αναμμένη','Keep screen on'),T('Κατά την έξοδο και με ενεργό συναγερμό άγκυρας.','During a trip and while the anchor alarm is on.'),sw(C.lsGet('alkyon-wake',true),function(){ C.lsSet('alkyon-wake',!C.lsGet('alkyon-wake',true)); wlSync(); renderPanel(); })));
  put('wxal',row(T('Ειδοποιήσεις καιρού','Weather alerts'),T('Όταν δυναμώνει ο άνεμος ή το κύμα, και πριν από καλή ώρα ψαρέματος.','When wind or waves pick up, and before a good fishing window.'),sw(alertsOn(),function(){ var v=!alertsOn(); C.lsSet('alkyon-wxal',v); if(v){ askNotif(); setTimeout(wxTick,500); } renderPanel(); })));
  var rec=C.lsGet('alkyon-offl',[]), tiles=rec.reduce(function(a,r){ return a+(r.n||0); },0), p=plan();
  var info=dl.run?(T('Κατεβαίνει… ','Downloading… ')+dl.done+'/'+dl.total):(rec.length?(rec.length+T(' περιοχές · ',' areas · ')+tiles+T(' πλακίδια',' tiles')):T('Κατέβασε την περιοχή που βλέπεις για να δουλεύει χωρίς σήμα.','Download the area you see so it works without signal.'));
  var ctl=document.createElement('div'); ctl.className='spctl';
  if(dl.run) ctl.append(btn(T('Ακύρωση','Cancel'),'danger',function(){ dl.cancel=true; }));
  else { ctl.append(btn(T('Κατέβασμα','Download'),'acc',startDl)); if(rec.length) ctl.append(btn(T('Διαγραφή','Clear'),'',clearDl)); }
  var r=row(T('Χάρτης εκτός σύνδεσης','Offline map'),info,ctl);
  if(!dl.run){ var s=document.createElement('span'); s.className='spest'; s.textContent=p.ok?(T('Τώρα: ~','Now: ~')+p.n+T(' πλακίδια, ζουμ ',' tiles, zoom ')+p.z0+'–'+p.z1+' ('+(p.lay==='osm'?T('οδικός','street'):T('δορυφορικός','satellite'))+(p.sea?' + '+T('σήματα','marks'):'')+')'):T('Η περιοχή είναι πολύ μεγάλη. Κάνε μεγέθυνση.','Area too large. Zoom in.'); r.querySelector('.sptx').append(s); }
  else { var pb=document.createElement('div'); pb.className='sppb'; var pi=document.createElement('i'); pi.style.width=Math.round(dl.done/Math.max(1,dl.total)*100)+'%'; pb.append(pi); r.querySelector('.sptx').append(pb); }
  put('offline',r);
  var mrow=row('MOB',mobs.length?(mobs.length+T(' σημ. στον χάρτη',' marks on the map')):T('Κουμπί MOB στον χάρτη κατά την έξοδο: ένα πάτημα σημειώνει τη θέση και ξεκινά πλοήγηση προς αυτήν.','MOB button on the map during a trip: one tap marks the spot and starts navigating to it.'),mobs.length?btn(T('Καθαρισμός','Clear'),'',function(){ mobs=[]; C.lsSet('alkyon-mob',mobs); drawMob(); renderPanel(); }):null);
  put('mob',mrow);
  (window.AlkyonSeaRows||[]).forEach(function(fn){ try{ var r=fn(); if(r&&r.dataset&&r.dataset.k) put(r.dataset.k,r); }catch(e){} });
  put(null);
}
function openP(mode){ panel.dataset.mode=(typeof mode==='string'&&MODES[mode])?mode:'sea'; panel.hidden=false; renderPanel(); }
bTools.addEventListener('click',function(){ openP('sea'); });
bOff.addEventListener('click',function(){ openP('map'); });
/* οι κάρτες στις Ρυθμίσεις ανανεώνονται όταν ανοίγει το Προφίλ */
setInterval(function(){ if(setCardsLive()&&panel.hidden&&!document.hidden){ var ps=$('pSettings'); if(ps&&ps.getClientRects().length&&!ps.contains(document.activeElement)) renderPanel(); } },4000);
setTimeout(function(){ if(setCardsLive()) renderPanel(); },3000);
panel.querySelector('.spx').addEventListener('click',function(){ panel.hidden=true; });
panel.addEventListener('click',function(e){ if(e.target===panel) panel.hidden=true; });
setInterval(function(){ if(!panel.hidden&&an) renderPanel(); },5000);
map.on('moveend',function(){ if(!panel.hidden&&!dl.run) renderPanel(); });
window.AlkyonSea={notify:notify,mob:doMob,anchor:function(){ return an; },plan:plan,wxCheck:wxCheck,open:openP,wake:function(){ return !!wl; }};
wlSync();
})();
