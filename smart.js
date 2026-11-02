/* Έξυπνα εργαλεία: λιμάνι και σκάφος, «Πότε να γυρίσω», αυτονομία καυσίμου, θερμά σημεία, αυτόματη έναρξη/λήξη εξόδου,
   «Πέρσι τέτοια μέρα», λίστα ελέγχου, ώρες κινητήρα, υπενθύμιση άδειας, εβδομαδιαία περίληψη.
   Οι εκτιμήσεις είναι ενδεικτικές και δουλεύουν μόνο με ανοιχτή εφαρμογή και GPS. Δεν είναι ναυτικό όργανο. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, U=window.AlkyonUnits;
var $=function(i){ return document.getElementById(i); };
var KEY='alkyon-smart', R=Math.PI/180;
var S=C.lsGet(KEY,{}); if(!S||typeof S!=='object'||Array.isArray(S)) S={};
S.cruise=+S.cruise>0?+S.cruise:15; S.reserve=S.reserve!=null?+S.reserve:20; S.auto=S.auto!==false; S.ring=S.ring!==false;
S.hot=S.hot||{on:false,sp:'',per:'all'}; S.hot.on=false; /* η επικάλυψη «θερμά σημεία» αφαιρέθηκε· μένει το φίλτρο ειδών */ S.eng=S.eng||{h:0,every:100,last:0};
S.cl=S.cl||{items:null,done:{}}; if(!Array.isArray(S.cl.items)) S.cl.items=T(['Σωσίβια για όλους','Καύσιμα επαρκή','Δολώματα και εξοπλισμός','Άδεια ψαρέματος','Φορτισμένο κινητό','Νερό και φαγητό','Φαρμακείο πρώτων βοηθειών','Φακός / VHF'],['Lifejackets for everyone','Enough fuel','Bait and tackle','Fishing licence','Phone charged','Water and food','First aid kit','Torch / VHF']);
function save(){ C.lsSet(KEY,S); }
function distKm(a,b,c,d){ var dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742*Math.asin(Math.min(1,Math.sqrt(x))); }
function tripOn(){ var s=window.AlkyonTrip&&window.AlkyonTrip.state&&window.AlkyonTrip.state(); return !!(s&&s.active); }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function dist(km){ return U?U.dist(km,km<10?(km<1?2:1):0):km.toFixed(1)+' km'; }
function fixNow(cb,fail){
  var fx=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix();
  if(fx&&fx.lat!=null&&Date.now()-fx.t<60000){ cb({lat:fx.lat,lon:fx.lon}); return; }
  if(!navigator.geolocation){ fail&&fail(); return; }
  navigator.geolocation.getCurrentPosition(function(p){ cb({lat:p.coords.latitude,lon:p.coords.longitude}); },function(){ fail&&fail(); },{enableHighAccuracy:true,timeout:9000,maximumAge:30000});
}
function note(title,body,key,gap){
  var sent=C.lsGet('alkyon-smart-sent',{}), now=Date.now(); if(key){ if(sent[key]&&now-sent[key]<gap) return; sent[key]=now; C.lsSet('alkyon-smart-sent',sent); }
  try{ if(window.AlkyonSea&&window.AlkyonSea.notify) window.AlkyonSea.notify(title,body); else C.toast(title+(body?' · '+body:'')); }catch(e){ C.toast(title); }
  try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){}
}

/* ---------- ζωνη πληροφοριών εξόδου: λιμάνι, ETA, καύσιμο ---------- */
var box=document.querySelector('.mapbox');
var chip=el('button','rtchip'); chip.type='button'; chip.id='rtChip'; chip.hidden=true; box.appendChild(chip);
var lpT=null, lpDone=false;
function lpStart(){ lpDone=false; clearTimeout(lpT); lpT=setTimeout(function(){ lpDone=true; S.chip=false; save(); chip.hidden=true; C.toast(T('Η γραμμή επιστροφής κρύφτηκε. Επαναφορά: ⚓ → Λιμάνι και σκάφος.','Return strip hidden. Restore it in ⚓ → Port and boat.')); try{ if(navigator.vibrate) navigator.vibrate(40); }catch(e){} },700); }
function lpEnd(){ clearTimeout(lpT); }
chip.addEventListener('touchstart',lpStart,{passive:true}); chip.addEventListener('touchend',lpEnd); chip.addEventListener('touchmove',lpEnd); chip.addEventListener('touchcancel',lpEnd);
chip.addEventListener('contextmenu',function(e){ e.preventDefault(); });
chip.addEventListener('click',function(e){ if(lpDone){ lpDone=false; e.preventDefault(); return; }  if(S.home&&window.AlkyonDirect) window.AlkyonDirect.go(S.home.lat,S.home.lon,S.home.name||T('Λιμάνι','Home')); else openPanel(); });
var ringL=L.layerGroup().addTo(map);
function badIn(){
  var c=C.lsGet('alkyon-wxa',null); if(!c||!c.f||!c.f.nowLocal||!c.f.days||Date.now()-c.t>4*3600000) return null;
  var base=Date.parse(c.f.nowLocal.slice(0,16)+':00Z'), el0=(Date.now()-c.t)/60000, best=null;
  c.f.days.forEach(function(d){ (d.hours||[]).forEach(function(h){
    if(!h.t||best) return; var tm=Date.parse(h.t.slice(0,13)+':00:00Z'); if(isNaN(tm)||tm<base-3600000) return;
    if((h.wind||0)>=20||(h.gust||0)>=28||(h.wave||0)>=1.5) best={mins:Math.max(0,(tm-base)/60000-el0),wind:h.wind,wave:h.wave};
  }); });
  return best;
}
var atHome=0, endAsked=false;
function rt(){
  if(!tripOn()){ chip.hidden=true; ringL.clearLayers(); return; }
  fixNow(function(p){
    var now=Date.now(), parts=[], level='', msg='';
    if(S.tank>0&&S.burn>0){
      if(!S.fuel||S.fuel.L==null) S.fuel={L:S.tank,t:now};
      var dt=(now-(S.fuel.t||now))/3600000; if(dt>0&&dt<1) S.fuel.L=Math.max(0,S.fuel.L-S.burn*dt); S.fuel.t=now; save();
    }
    var d=null, eta=null;
    if(S.home){ d=distKm(p.lat,p.lon,S.home.lat,S.home.lon)*1.1; eta=d/1.852/S.cruise*60; parts.push('🏠 '+dist(d)+' · ~'+Math.max(1,Math.round(eta))+(EN?' min':'λ')); }
    if(S.fuel&&S.tank>0){
      parts.push('⛽ ~'+Math.round(S.fuel.L)+' L');
      if(d!=null){
        var need=d/1.852/S.cruise*S.burn, rsv=S.tank*S.reserve/100;
        if(S.fuel.L-need<rsv*0.5){ level='bad'; msg=T('Καύσιμο: χρειάζεσαι ~','Fuel: you need ~')+Math.ceil(need)+T(' L για να γυρίσεις και έχεις ~',' L to get home and have ~')+Math.round(S.fuel.L)+' L'; note('⛽ '+T('Χαμηλά καύσιμα','Low fuel'),msg,'fuel',25*60000); }
        else if(S.fuel.L-need<rsv){ level='warn'; msg=T('Το καύσιμο πλησιάζει την εφεδρεία','Fuel is close to the reserve'); note('⛽ '+T('Καύσιμο','Fuel'),msg+' (~'+Math.round(S.fuel.L)+' L)','fuelw',40*60000); }
      }
    }
    if(eta!=null){
      var b=badIn();
      if(b){
        var margin=b.mins-eta;
        if(margin<=20){ level='bad'; msg=T('Ώρα να γυρίσεις: χρειάζεσαι ~','Time to head back: you need ~')+Math.round(eta)+T('′ και ο καιρός χειροτερεύει σε ~',' min and the weather worsens in ~')+Math.round(b.mins)+(EN?' min':'′'); note('🏠 '+T('Πότε να γυρίσεις','When to head back'),msg,'back',25*60000); }
        else if(margin<=60&&!level){ level='warn'; msg=T('Ο καιρός χειροτερεύει σε ~','Weather worsens in ~')+Math.round(b.mins)+T('′. Η επιστροφή θέλει ~',' min. The trip home takes ~')+Math.round(eta)+(EN?' min':'′'); note('🏠 '+T('Προσοχή στον καιρό','Weather watch'),msg,'backw',40*60000); }
      }
      /* αυτόματη πρόταση λήξης: ήσυχος στο λιμάνι */
      if(S.auto&&d!=null&&d/1.1<0.2){ atHome=atHome||now; if(now-atHome>120000&&!endAsked){ endAsked=true; window.AlkyonAsk(T('Φαίνεται ότι γύρισες στο λιμάνι. Να τελειώσει η έξοδος;','You seem to be back at the port. End the trip?'),{title:T('Τέλος εξόδου','End trip'),ok:T('Τέλος εξόδου','End trip'),cancel:T('Όχι ακόμα','Not yet')}).then(function(ok){ if(ok) $('tripBtn').click(); }); } } else atHome=0;
    }
    chip.hidden=!parts.length||S.chip===false; chip.textContent=parts.join('  ·  '); chip.className='rtchip '+level; chip.title=msg;
    drawRing(p);
  },function(){});
}
function drawRing(){
  ringL.clearLayers(); if(!S.ring||!S.home||!(S.tank>0&&S.burn>0)||!S.fuel) return;
  var usable=Math.max(0,S.fuel.L-S.tank*S.reserve/100), rKm=usable/S.burn*S.cruise*1.852/2; if(rKm<0.3) return;
  L.circle([S.home.lat,S.home.lon],{radius:rKm*1000,color:'#e8a317',weight:2,dashArray:'8 8',fill:false}).bindTooltip(T('Όριο επιστροφής με εφεδρεία ','Point-of-no-return with ')+S.reserve+'%',{sticky:true}).addTo(ringL);
}
setInterval(rt,60000); window.addEventListener('alkyon-sess',function(){ if(tripOn()){ endAsked=false; atHome=0; if(S.fuel) S.fuel.t=Date.now(); S.cl.done={}; save(); clBtnUpd(); autoStop(); } else autoStart(); setTimeout(rt,800); });
setTimeout(rt,3000);

/* ---------- αυτόματη πρόταση έναρξης ---------- */
var aw=null, aPrev=null, aHits=0, aRest=null;
function autoStop(){ if(aw!=null){ try{ navigator.geolocation.clearWatch(aw); }catch(e){} aw=null; } aPrev=null; aHits=0; aRest=null; }
function autoStart(){
  if(aw!=null||!S.auto||tripOn()||!navigator.geolocation) return;
  try{ aw=navigator.geolocation.watchPosition(function(p){
    if(tripOn()){ autoStop(); return; }
    var c=p.coords, t=Date.now(), v=(c.speed!=null&&!isNaN(c.speed))?c.speed:null;
    if(v==null&&aPrev&&t-aPrev.t>=2000) v=distKm(aPrev.lat,aPrev.lon,c.latitude,c.longitude)*1000/((t-aPrev.t)/1000);
    aPrev={lat:c.latitude,lon:c.longitude,t:t};
    /* v31z17: σημείο ηρεμίας (≥60 s με ταχύτητα <1 m/s). Αν εκεί κοντά υπάρχει λιμάνι (το δικό σου ή άλλο), η κίνηση από εκεί μετράει ως αναχώρηση. */
    if(v!=null&&v<1){
      if(!aRest||distKm(aRest.lat,aRest.lon,c.latitude,c.longitude)*1000>80) aRest={lat:c.latitude,lon:c.longitude,since:t,port:undefined};
      else if(t-aRest.since>=60000&&aRest.port===undefined){ var r0=aRest; r0.port=null;
        if(S.home&&distKm(S.home.lat,S.home.lon,r0.lat,r0.lon)<=0.5) r0.port={name:S.home.name||''};
        else findPort(r0.lat,r0.lon).then(function(r){ if(r&&r.d<=0.6) r0.port={name:r.name||''}; }).catch(function(){}); }
    }
    var away=S.home&&distKm(c.latitude,c.longitude,S.home.lat,S.home.lon)*1000>400;
    var fromPort=aRest&&aRest.port&&distKm(aRest.lat,aRest.lon,c.latitude,c.longitude)*1000>400;
    aHits=(v!=null&&v>=2.5&&(fromPort||(!aRest&&away)))?aHits+1:0;
    var pname=aRest&&aRest.port&&aRest.port.name||'';
    if(aHits>=4){ aHits=0; var sent=C.lsGet('alkyon-smart-sent',{}); if(sent.autoStart&&t-sent.autoStart<3*3600000) return; sent.autoStart=t; C.lsSet('alkyon-smart-sent',sent);
      window.AlkyonAsk((pname?T('Φαίνεται ότι ξεκίνησες από «','You seem to have left “')+pname+T('». ','”. '):T('Φαίνεται ότι ξεκίνησες από το λιμάνι. ','You seem to have left the port. '))+T('Να ξεκινήσεις έξοδο, ώστε να καταγράφονται τα ψάρια;','Start a trip so catches get recorded?'),{title:T('Έναρξη εξόδου','Start trip'),ok:T('Έναρξη','Start'),cancel:T('Όχι τώρα','Not now')}).then(function(ok){ if(ok&&window.AlkyonTrip) window.AlkyonTrip.sheet(); }); }
  },function(){},{enableHighAccuracy:true,maximumAge:5000,timeout:30000}); }catch(e){ aw=null; }
}

/* ---------- θερμά σημεία ---------- */
var hotL=L.layerGroup(), bH=el('button','mbtn'); bH.type='button'; bH.id='bHot'; bH.setAttribute('aria-label',T('Θερμά σημεία ψαρέματος','Catch hotspots')); bH.title=T('Θερμά σημεία από τα ψάρια σου','Hotspots from your catches');
bH.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3c1 3.2 4.5 4.8 4.5 9.2a4.5 4.5 0 01-9 0c0-2.2 1.1-3.5 2.3-4.6.1 1.9.9 2.6 1.9 2.4-.4-2.2-.6-4.4.3-7z"/></svg>';
var mbEl=document.querySelector('.mapbtns'), cfgBtn=$('bToolsCfg'); if(cfgBtn) mbEl.insertBefore(bH,cfgBtn); else mbEl.appendChild(bH);
function inPeriod(b){
  if(S.hot.per==='all') return true; if(!b.date) return false; var ms=Date.parse(b.date+'T12:00:00Z'), now=Date.now();
  if(S.hot.per==='90') return now-ms<=90*86400000;
  var m=+b.date.slice(5,7), cm=+C.nicosiaToday().slice(5,7), dm=Math.abs(m-cm); return Math.min(dm,12-dm)<=1;
}
function heat(){
  hotL.clearLayers(); bH.setAttribute('aria-pressed',String(!!S.hot.on)); if(!S.hot.on){ if(map.hasLayer(hotL)) map.removeLayer(hotL); return; } if(!map.hasLayer(hotL)) hotL.addTo(map);
  var z=map.getZoom(), cell=z>=14?0.002:z>=12?0.005:z>=10?0.02:0.08, B={}, mx=1;
  (C.Store.get('bites')||[]).forEach(function(b){
    if(typeof b.lat!=='number'||typeof b.lon!=='number'||!inPeriod(b)) return; if(S.hot.sp&&b.species!==S.hot.sp) return;
    var k=Math.floor(b.lat/cell)+'|'+Math.floor(b.lon/cell), o=B[k]||(B[k]={sla:0,slo:0,la:0,lo:0,n:0,kg:0,sp:{}});
    o.n++; o.sla+=b.lat; o.slo+=b.lon; o.la=o.sla/o.n; o.lo=o.slo/o.n; o.kg+=+b.kg||0; if(b.species) o.sp[b.species]=(o.sp[b.species]||0)+1; mx=Math.max(mx,o.n);
  });
  Object.keys(B).forEach(function(k){
    var o=B[k], f=o.n/mx, col='hsl('+Math.round(55-55*f)+',95%,50%)';
    L.circle([o.la,o.lo],{radius:cell*111000*(0.55+0.35*Math.sqrt(f)),color:col,weight:1,fillColor:col,fillOpacity:.22+.45*f}).bindPopup(function(){
      var d=el('div','pop'); d.append(el('b','',o.n+T(' ψάρια εδώ',' fish here'))); var sp=Object.keys(o.sp).sort(function(a,b){ return o.sp[b]-o.sp[a]; }).slice(0,4).map(function(s){ return s+' ×'+o.sp[s]; }).join(', ');
      if(sp) d.append(el('div','meta',sp)); if(o.kg) d.append(el('div','meta',(Math.round(o.kg*10)/10)+' kg')); return d;
    }).addTo(hotL);
  });
}
bH.addEventListener('click',function(){ S.hot.on=!S.hot.on; save(); heat(); if(S.hot.on&&!hotL.getLayers().length) C.toast(T('Δεν υπάρχουν ψάρια με θέση για αυτά τα φίλτρα.','No located catches for these filters.')); });
map.on('zoomend moveend',function(){ if(S.hot.on) heat(); }); C.Store.on('bites',function(){ if(S.hot.on) heat(); });
heat();

/* ένδειξη ενεργού φίλτρου είδους πάνω στον χάρτη (το φίλτρο ορίζεται στο Ημερολόγιο) */
(function(){
  var Ctl=L.Control.extend({options:{position:'topleft'},onAdd:function(){
    var d=L.DomUtil.create('div','spfilt'); L.DomEvent.disableClickPropagation(d);
    var bt=el('button','spchip'); bt.type='button'; d.append(bt);
    function fill(){ var v=C.lsGet('alkyon-spf','')||''; d.hidden=!v; bt.replaceChildren(); if(!v) return; bt.append(el('span','',T('Φίλτρο: ','Filter: ')+v),el('b','','✕')); bt.setAttribute('aria-label',T('Αφαίρεση φίλτρου είδους ','Clear species filter ')+v); }
    bt.addEventListener('click',function(){ if(window.AlkyonSpf) window.AlkyonSpf.set(''); });
    document.addEventListener('alkyon-spfilter',fill); fill(); return d; }});
  map.addControl(new Ctl());
  var st=document.createElement('style'); st.textContent='.spfilt[hidden]{display:none}.spchip{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border:0;border-radius:17px;background:#123;color:#fff;font:600 13px system-ui;box-shadow:0 2px 10px rgba(0,0,0,.3);cursor:pointer;max-width:70vw}.spchip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.spchip b{opacity:.75;font-size:12px}';
  document.head.appendChild(st);
})();

/* ---------- «Πέρσι τέτοια μέρα» ---------- */
function lastYear(){
  var tt=$('tab-today'); if(!tt) return; var card=$('lyCard');
  if(!card){ card=el('div','card lycard'); card.id='lyCard'; card.hidden=true; var seg=tt.querySelector('.tabseg'); tt.insertBefore(card,seg?seg.nextSibling:tt.firstChild); }
  var td=C.nicosiaToday(), y0=+td.slice(0,4), tm=Date.UTC(2000,+td.slice(5,7)-1,+td.slice(8,10)), Y={};
  (C.Store.get('bites')||[]).forEach(function(b){
    if(!b.date) return; var y=+b.date.slice(0,4); if(y>=y0) return; var d=Date.UTC(2000,+b.date.slice(5,7)-1,+b.date.slice(8,10)); if(Math.abs(d-tm)>7*86400000) return;
    var o=Y[y]||(Y[y]={n:0,kg:0,sp:{},w:[]}); o.n++; o.kg+=+b.kg||0; if(b.species) o.sp[b.species]=(o.sp[b.species]||0)+1; if(b.wind!=null) o.w.push(b.wind);
  });
  var ys=Object.keys(Y).sort(function(a,b){ return b-a; });
  card.hidden=!ys.length; if(!ys.length) return; card.replaceChildren();
  card.append(el('div','label',T('Πέρσι τέτοια μέρα (±7 ημέρες)','Around this date in past years (±7 days)')));
  ys.forEach(function(y){
    var o=Y[y], sp=Object.keys(o.sp).sort(function(a,b){ return o.sp[b]-o.sp[a]; }).slice(0,3).map(function(s){ return s+' ×'+o.sp[s]; }).join(', ');
    var w=o.w.length?(U?U.wind(o.w.reduce(function(a,b){ return a+b; },0)/o.w.length):''):'';
    var r=el('div','lyrow'); r.append(el('b','',y),el('span','',o.n+T(' ψάρια',' fish')+(o.kg?' · '+(Math.round(o.kg*10)/10)+' kg':'')+(sp?' · '+sp:'')+(w?' · '+T('άνεμος ','wind ')+w:''))); card.append(r);
  });
}
C.Store.on('bites',lastYear); lastYear();

/* ---------- v31z394: ειδοποίηση 7 μέρες πριν την επέτειο ψαρέματος ----------
   Η σελίδα φτιάχνει τη λίστα (επόμενες 60 μέρες) και τη γράφει στη μνήμη του service worker (alkyon-cfg/__anniv).
   Ο service worker στέλνει την ειδοποίηση όταν ανοίγει η εφαρμογή ή στον περιοδικό έλεγχο (και με κλειστή εφαρμογή). */
var AN_DAYS=7;
function annivOn(){ return C.lsGet('alkyon-anniv',true)!==false; }
function annivList(){
  /* v31z395: εβδομαδιαία σύνοψη. Κάθε παλιά ψαριά πέφτει στην εβδομάδα (Δευ–Κυρ) της ίδιας ημερομηνίας φέτος.
     Μία ειδοποίηση 7 μέρες πριν τη Δευτέρα της εβδομάδας, με σύνολο ανά χρονιά και τις μέρες (με ημέρα εβδομάδας). */
  var DN=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρι','Τετ','Πέμ','Παρ','Σάβ'];
  var td=C.nicosiaToday(), y0=+td.slice(0,4), t0=Date.UTC(y0,+td.slice(5,7)-1,+td.slice(8,10)), W={};
  var thisMon=t0-((new Date(t0).getUTCDay()+6)%7)*86400000;
  (C.Store.get('bites')||[]).forEach(function(b){
    if(!b||!b.date) return; var y=+b.date.slice(0,4), mo=+b.date.slice(5,7), d=+b.date.slice(8,10); if(!y||y>y0) return;
    var a=Date.UTC(y0,mo-1,d); if(a<thisMon) a=Date.UTC(y0+1,mo-1,d); if(new Date(a).getUTCFullYear()<=y) return;
    var mon=a-((new Date(a).getUTCDay()+6)%7)*86400000; if(mon-t0>60*86400000) return;
    var wk=W[mon]||(W[mon]={mon:mon,Y:{}}), o=wk.Y[y]||(wk.Y[y]={n:0,kg:0,D:{}}), dk=b.date.slice(0,10), dd=o.D[dk]||(o.D[dk]={n:0,sp:{},pl:{}});
    o.n++; o.kg+=+b.kg||0; dd.n++; if(b.species) dd.sp[b.species]=(dd.sp[b.species]||0)+1; if(b.place) dd.pl[b.place]=1;
    if(typeof b.lat==='number'&&typeof b.lon==='number'){ /* σημεία για «Δες στον χάρτη» (ομαδοποίηση ~500 m) */
      var L0=wk.L||(wk.L=[]), q=null; for(var i=0;i<L0.length;i++){ var dy=(L0[i].lat-b.lat)*111, dx=(L0[i].lon-b.lon)*111*Math.cos(b.lat*Math.PI/180); if(dx*dx+dy*dy<0.25){ q=L0[i]; break; } }
      if(!q){ q={lat:+b.lat.toFixed(5),lon:+b.lon.toFixed(5),name:b.place||'',n:0,d:{}}; L0.push(q); } q.n++; if(!q.name&&b.place) q.name=b.place;
      var qd=q.d[dk]||(q.d[dk]={n:0,kg:0,sp:{}}); qd.n++; qd.kg+=+b.kg||0; if(b.species) qd.sp[b.species]=(qd.sp[b.species]||0)+1;
    }
  });
  function dm(t){ var x=new Date(t); return x.getUTCDate()+'/'+(x.getUTCMonth()+1); }
  return Object.keys(W).sort().map(function(k){
    var wk=W[k], sun=wk.mon+6*86400000, lines=[];
    Object.keys(wk.Y).sort(function(a,b){ return b-a; }).forEach(function(y){
      var o=wk.Y[y], days=Object.keys(o.D).sort().map(function(dk){
        var dd=o.D[dk], t=Date.UTC(+dk.slice(0,4),+dk.slice(5,7)-1,+dk.slice(8,10));
        var sp=Object.keys(dd.sp).sort(function(a,b){ return dd.sp[b]-dd.sp[a]; }).slice(0,3).map(function(x){ return x+(dd.sp[x]>1?' ×'+dd.sp[x]:''); }).join(', ');
        var pl=Object.keys(dd.pl)[0]||'';
        return DN[new Date(t).getUTCDay()]+' '+dm(t)+': '+(sp||dd.n+(dd.n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish')))+(pl?' ('+pl+')':'');
      });
      lines.push(y+' · '+o.n+(o.n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish'))+(o.kg?', '+(Math.round(o.kg*10)/10)+' kg':'')+'\n  '+days.join('\n  '));
    });
    var iso=function(t){ return new Date(t).toISOString().slice(0,10); };
    var locs=(wk.L||[]).sort(function(a,b){ return b.n-a.n; }).slice(0,6).map(function(q){
      var ds=Object.keys(q.d).sort().reverse().slice(0,2).map(function(dk){ var t=Date.UTC(+dk.slice(0,4),+dk.slice(5,7)-1,+dk.slice(8,10)); return DN[new Date(t).getUTCDay()]+' '+dm(t)+'/'+dk.slice(2,4); }).join(', ');
      var det=Object.keys(q.d).sort().reverse().map(function(dk){ var x=q.d[dk], t=Date.UTC(+dk.slice(0,4),+dk.slice(5,7)-1,+dk.slice(8,10));
        var sp=Object.keys(x.sp).sort(function(a,b){ return x.sp[b]-x.sp[a]; }).map(function(z){ return z+(x.sp[z]>1?' ×'+x.sp[z]:''); }).join(', ');
        return DN[new Date(t).getUTCDay()]+' '+dm(t)+'/'+dk.slice(0,4)+' · '+x.n+(x.n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish'))+(x.kg?', '+(Math.round(x.kg*10)/10)+' kg':'')+(sp?' · '+sp:''); });
      return {det:det,lat:q.lat,lon:q.lon,name:q.name,label:(q.name||T('Σημείο','Spot'))+' · '+ds+' · '+q.n+(q.n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish'))};
    });
    return {locs:locs,id:'annivw-'+iso(wk.mon),due:iso(wk.mon-AN_DAYS*86400000),ann:iso(wk.mon),end:iso(sun),
      title:T('η εβδομάδα ','the week of ')+DN[1]+' '+dm(wk.mon)+' – '+DN[0]+' '+dm(sun)+T(' τα προηγούμενα χρόνια',' in past years'),
      body:lines.join('\n')};
  });
}
async function annivSync(){
  try{
    if(!('caches' in window)) return;
    var c=await caches.open('alkyon-cfg'), u=new URL('__anniv',(navigator.serviceWorker&&navigator.serviceWorker.controller?location.href:location.href)).href;
    var reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration(); if(reg) u=new URL('__anniv',reg.scope).href;
    await c.put(u,new Response(JSON.stringify({on:annivOn(),lang:EN?'en':'el',items:annivOn()?annivList():[]})));
    if(annivOn()&&reg&&reg.active&&('Notification' in window)&&Notification.permission==='granted') reg.active.postMessage({annivCheck:1});
  }catch(e){}
}
C.Store.on('bites',function(){ clearTimeout(annivSync.t); annivSync.t=setTimeout(annivSync,1500); });
setTimeout(annivSync,4000); if(window.ndEvery) window.ndEvery(annivSync,6*3600000);
(function(){ /* διακόπτης στις ρυθμίσεις ειδοποιήσεων της Πρόγνωσης */
  var t=$('ntTurn'), row=t&&t.closest('label.chk'); if(!row||$('ntAnniv')) return;
  var w=el('label','chk'); w.style.border='0'; var cb=el('input'); cb.type='checkbox'; cb.id='ntAnniv'; cb.checked=annivOn();
  var lb=el('label','',T('Ειδοποίησέ με 7 μέρες πριν από μέρες που είχα πιάσει ψάρια σε προηγούμενες χρονιές','Notify me 7 days before dates when I caught fish in past years')); lb.htmlFor='ntAnniv';
  w.append(cb,lb); row.parentNode.insertBefore(w,row.nextSibling);
  cb.addEventListener('change',async function(){
    if(cb.checked&&('Notification' in window)&&Notification.permission!=='granted'){ var p=await Notification.requestPermission(); if(p!=='granted'){ cb.checked=false; return; } }
    C.lsSet('alkyon-anniv',cb.checked); annivSync();
  });
})();
window.AlkyonAnniv={list:annivList,sync:annivSync};

/* ---------- v31z398: «ίδιες συνθήκες με παλιά ψαριά» ----------
   Για παλιές ψαριές (προηγούμενες χρονιές, ±30 μέρες από την ίδια ημερομηνία φέτος) που έχουν καταγεγραμμένες συνθήκες,
   συγκρίνει την πρόγνωση των επόμενων 6 ημερών στο ίδιο σημείο, την ίδια ώρα: σελήνη, άνεμος, διεύθυνση, κύμα, πίεση, νερό.
   Αν μια μέρα μοιάζει ≥ 80%, στέλνει μία ειδοποίηση (μία ανά μέρα-στόχο και ψαριά). */
var SIM_KEY='alkyon-simseen';
function simMin(){ var v=+C.lsGet('alkyon-simmin',80); return (v>=60&&v<=95?v:80)/100; }
function simOn(){ return C.lsGet('alkyon-simnote',true)!==false; }
var DIR8=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function d8(g){ return g==null?'':DIR8[Math.round(((g%360)+360)%360/45)%8]; }
var PTN={fast:T('πέφτει γρήγορα','falling fast'),slow:T('πέφτει αργά','falling slowly'),stable:T('σταθερή','steady'),rise:T('ανεβαίνει','rising')};
var MPH=EN?['new moon','waxing crescent','first quarter','waxing gibbous','full moon','waning gibbous','last quarter','waning crescent']:['νέα σελήνη','αύξων μηνίσκος','πρώτο τέταρτο','αύξουσα αμφίκυρτη','πανσέληνος','φθίνουσα αμφίκυρτη','τελευταίο τέταρτο','φθίνων μηνίσκος'];
function phName(f){ return MPH[Math.floor(((f%1)+1)%1*8+0.5)%8]; }
function bHour(b){ var m=/^(\d{1,2})/.exec(b.time||''); return m?Math.min(23,+m[1]):7; }
function bMs(b){ var h=bHour(b); return Date.UTC(+b.date.slice(0,4),+b.date.slice(5,7)-1,+b.date.slice(8,10),h-2); }
function circ(a,b,p){ var d=Math.abs(a-b)%p; return Math.min(d,p-d); }
function simScore(b,h,f){
  var parts=[], add=function(w,v){ if(v!=null&&!isNaN(v)) parts.push([w,Math.max(0,Math.min(1,v))]); };
  var bf=null; try{ bf=window.PF.moonPhase(bMs(b)).f; }catch(e){}
  if(bf!=null&&f!=null) add(0.25,1-circ(bf,f,1)/0.125);
  if(b.wind!=null&&h.wind!=null) add(0.2,1-Math.abs(b.wind-h.wind)/6);
  if(b.wdeg!=null&&h.dir!=null&&(b.wind||0)>=4&&(h.wind||0)>=4) add(0.15,1-circ(b.wdeg,h.dir,360)/90);
  if(b.wave!=null&&h.wave!=null) add(0.15,1-Math.abs(b.wave-h.wave)/0.5);
  if(b.ptrend&&h.ptrend) add(0.15,b.ptrend===h.ptrend?1:((b.ptrend==='slow'||b.ptrend==='stable')&&(h.ptrend==='slow'||h.ptrend==='stable'))?0.6:0);
  if(b.sst!=null&&h.sst!=null) add(0.1,1-Math.abs(b.sst-h.sst)/2);
  var W=parts.reduce(function(a,x){ return a+x[0]; },0); if(W<0.55) return null; /* χρειάζονται αρκετές συνθήκες */
  return parts.reduce(function(a,x){ return a+x[0]*x[1]; },0)/W;
}
var simBusy=false;
async function simCheck(force){
  if(simBusy||!simOn()||!window.PF||!window.PF.getForecast) return null; simBusy=true;
  try{
    var last=C.lsGet('alkyon-simlast',0); if(!force&&Date.now()-last<6*3600000) return null; C.lsSet('alkyon-simlast',Date.now());
    var td=C.nicosiaToday(), y0=+td.slice(0,4), t0=Date.UTC(y0,+td.slice(5,7)-1,+td.slice(8,10));
    var cand=(C.Store.get('bites')||[]).filter(function(b){
      if(!b||!b.date||typeof b.lat!=='number'||typeof b.lon!=='number'||+b.date.slice(0,4)>=y0) return false;
      if(b.wind==null&&b.wave==null&&!b.ptrend) return false;
      var a=Date.UTC(y0,+b.date.slice(5,7)-1,+b.date.slice(8,10)), dd=(a-t0)/86400000; if(dd<-180) dd+=365; if(dd>180) dd-=365; return dd>=-29&&dd<=36;
    });
    /* v31z404: και ψάρια φίλων, αν το έχεις ενεργοποιήσει (Φίλοι → «Να μετράνε…») */
    try{ if(window.AlkyonFriends&&window.AlkyonFriends.useOn&&window.AlkyonFriends.useOn()) window.AlkyonFriends.bitesNear(null,null,0).forEach(function(b){
      if(!b.date||typeof b.lat!=='number'||+b.date.slice(0,4)>=y0||(b.wind==null&&b.wave==null&&!b.ptrend)) return;
      var a=Date.UTC(y0,+b.date.slice(5,7)-1,+b.date.slice(8,10)), dd=(a-t0)/86400000; if(dd<-180) dd+=365; if(dd>180) dd-=365; if(dd>=-29&&dd<=36) cand.push(b); }); }catch(e){}
    if(!cand.length) return [];
    var G=[]; cand.forEach(function(b){ var g=null; for(var i=0;i<G.length;i++){ var dy=(G[i].lat-b.lat)*111, dx=(G[i].lon-b.lon)*111*Math.cos(b.lat*Math.PI/180); if(dx*dx+dy*dy<4){ g=G[i]; break; } } if(!g){ g={lat:b.lat,lon:b.lon,bs:[]}; G.push(g); } g.bs.push(b); });
    G.sort(function(a,b){ return b.bs.length-a.bs.length; }); G=G.slice(0,3);
    var best=[], seen=C.lsGet(SIM_KEY,{})||{};
    for(var gi=0;gi<G.length;gi++){
      var g=G[gi], fc; try{ fc=await window.PF.getForecast(g.lat,g.lon,undefined,{days:7}); }catch(e){ continue; }
      if(!fc||!fc.days) continue;
      fc.days.forEach(function(d,di){
        if(di<1||!d.hours) return; var dt=Date.parse(d.date+'T00:00:00Z');
        g.bs.forEach(function(b){
          var a=Date.UTC(+d.date.slice(0,4),+b.date.slice(5,7)-1,+b.date.slice(8,10)), dd=Math.abs(a-dt)/86400000; if(dd>182) dd=365-dd; if(dd>30) return;
          var hr=bHour(b), h=d.hours.filter(function(x){ return x.hr===hr; })[0]; if(!h||h.safe===false) return;
          var sc=simScore(b,h,d.f); if(sc==null||sc<simMin()) return;
          var key=d.date+'|'+b.date+(b._fu?'|'+b._fu.slice(0,6):''); if(seen[key]||Object.keys(seen).some(function(k){ return k.split('|')[1]===b.date&&Date.now()-seen[k]<14*86400000; })) return;
          best.push({sc:sc,d:d,h:h,b:b,key:key,g:g});
        });
      });
    }
    best.sort(function(a,b){ return b.sc-a.sc; });
    var byDay={}, byB={}, out=[]; best.forEach(function(x){ if(!byDay[x.d.date]&&!byB[x.b.date]){ byDay[x.d.date]=1; byB[x.b.date]=1; out.push(x); } }); /* μία ανά μέρα-στόχο και μία ανά παλιά ψαριά (η καλύτερη) */
    out=out.slice(0,2);
    for(var i=0;i<out.length;i++) await simNotify(out[i]);
    if(out.length){ out.forEach(function(x){ seen[x.key]=Date.now(); }); Object.keys(seen).forEach(function(k){ if(Date.now()-seen[k]>40*86400000) delete seen[k]; }); C.lsSet(SIM_KEY,seen); }
    return out;
  }catch(e){ return null; } finally{ simBusy=false; }
}
function simText(x){
  var b=x.b, h=x.h, DN=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρι','Τετ','Πέμ','Παρ','Σάβ'];
  var dt=new Date(x.d.date+'T12:00:00Z'), bd=new Date(b.date+'T12:00:00Z');
  var dLab=DN[dt.getUTCDay()]+' '+dt.getUTCDate()+'/'+(dt.getUTCMonth()+1), bLab=DN[bd.getUTCDay()]+' '+bd.getUTCDate()+'/'+(bd.getUTCMonth()+1)+'/'+b.date.slice(0,4);
  var same=b._fr?[b]:(C.Store.get('bites')||[]).filter(function(z){ return z.date===b.date&&typeof z.lat==='number'&&Math.abs(z.lat-b.lat)<0.02&&Math.abs(z.lon-b.lon)<0.02; });
  var sp={}; same.forEach(function(z){ if(z.species) sp[z.species]=(sp[z.species]||0)+1; });
  var spT=Object.keys(sp).map(function(k){ return k+(sp[k]>1?' ×'+sp[k]:''); }).join(', ');
  var hh=('0'+bHour(b)).slice(-2)+':00', bf=null; try{ bf=window.PF.moonPhase(bMs(b)).f; }catch(e){}
  var w=function(v){ return U&&U.wind?U.wind(v):Math.round(v)+' kn'; }, wv=function(v){ return U&&U.wave?U.wave(v):v.toFixed(1)+' m'; }, tp=function(v){ return U&&U.temp?U.temp(v):Math.round(v)+'°'; };
  var L2=[];
  if(bf!=null) L2.push(T('Σελήνη: ','Moon: ')+phName(x.d.f)+(phName(x.d.f)===phName(bf)?T(' (ίδια με τότε)',' (same as then)'):T(' (τότε ',' (then ')+phName(bf)+')'));
  if(b.wind!=null&&h.wind!=null) L2.push(T('Άνεμος: ','Wind: ')+d8(h.dir)+' '+w(h.wind)+T(' (τότε ',' (then ')+(b.wdeg!=null?d8(b.wdeg)+' ':'')+w(b.wind)+')');
  if(b.wave!=null&&h.wave!=null) L2.push(T('Κύμα: ','Waves: ')+wv(h.wave)+T(' (τότε ',' (then ')+wv(b.wave)+')');
  if(b.ptrend&&h.ptrend) L2.push(T('Πίεση: ','Pressure: ')+PTN[h.ptrend]+(h.ptrend===b.ptrend?T(' (όπως τότε)',' (as then)'):T(' (τότε ',' (then ')+PTN[b.ptrend]+')'));
  if(b.sst!=null&&h.sst!=null) L2.push(T('Νερό: ','Water: ')+tp(h.sst)+T(' (τότε ',' (then ')+tp(b.sst)+')');
  var pl=b.place||'';
  var title=dLab+(b._fr?T(' μοιάζει με την ψαριά του '+b._fr+' ',' looks like '+b._fr+'’s catch day '):T(' μοιάζει με τη μέρα της ψαριάς ',' looks like your catch day '))+bLab+' · '+Math.round(x.sc*100)+'%';
  var body=T('Τότε: ','Then: ')+(same.length||1)+(same.length>1?T(' ψάρια',' fish'):T(' ψάρι',' fish'))+(spT?' ('+spT+')':'')+(pl?T(' στο ',' at ')+pl:'')+T(', γύρω στις ',', around ')+hh+'.\n'+T('Πρόγνωση για ','Forecast for ')+dLab+' '+hh+':\n'+L2.join('\n');
  var det=[bLab+' · '+(same.length||1)+(same.length>1?T(' ψάρια',' fish'):T(' ψάρι',' fish'))+(spT?' · '+spT:''),T('Ίδιες συνθήκες: ','Similar conditions: ')+dLab+' '+hh+' ('+Math.round(x.sc*100)+'%)'];
  return {title:title,body:body,locs:[{lat:+b.lat.toFixed(5),lon:+b.lon.toFixed(5),name:pl,label:(pl||T('Σημείο','Spot'))+' · '+bLab,det:det}]};
}
async function simNotify(x){
  var m=simText(x), id='sim-'+x.key.replace(/[^0-9|]/g,'').replace('|','-');
  try{
    var reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();
    if(reg&&reg.active){ reg.active.postMessage({localMsg:{id:id,title:m.title,body:m.body,full:m.body,kind:'good',tag:id,locs:m.locs,notify:('Notification' in window)&&Notification.permission==='granted'}}); return; }
  }catch(e){}
  try{ C.toast&&C.toast(m.title); }catch(e){}
}
setTimeout(function(){ simCheck(); },9000); if(window.ndEvery) window.ndEvery(function(){ simCheck(); },3*3600000);
(function(){
  var t=$('ntAnniv'), row=t&&t.closest('label.chk'); if(!row||$('ntSim')) return;
  var w=el('label','chk'); w.style.border='0'; var cb=el('input'); cb.type='checkbox'; cb.id='ntSim'; cb.checked=simOn();
  var lb=el('label','',T('Ειδοποίησέ με όταν έρχεται μέρα με ίδιες συνθήκες με παλιά ψαριά (σελήνη, άνεμος, κύμα, πίεση, νερό)','Notify me when a coming day has the same conditions as a past catch (moon, wind, waves, pressure, water)')); lb.htmlFor='ntSim';
  var thr=el('label','f'); thr.style.margin='2px 0 6px 34px'; thr.append(document.createTextNode(T('Ελάχιστη ομοιότητα','Minimum similarity')));
  var sel=el('select'); [70,75,80,85,90].forEach(function(v){ var o=el('option','',v+'%'+(v===80?T(' (προτείνεται)',' (recommended)'):'')); o.value=String(v); sel.append(o); }); sel.value=String(Math.round(simMin()*100));
  sel.addEventListener('change',function(){ C.lsSet('alkyon-simmin',+sel.value); simCheck(true); }); thr.append(sel); thr.hidden=!cb.checked;
  w.append(cb,lb); row.parentNode.insertBefore(w,row.nextSibling); w.parentNode.insertBefore(thr,w.nextSibling);
  cb.addEventListener('change',function(){ C.lsSet('alkyon-simnote',cb.checked); thr.hidden=!cb.checked; if(cb.checked) simCheck(true); });
})();
window.AlkyonSim={check:simCheck,score:simScore,text:simText};

/* ---------- λίστα ελέγχου ---------- */
var clOv=el('div','cdov'); clOv.hidden=true; clOv.style.zIndex=4750; document.body.appendChild(clOv);
function clCount(){ var n=0; S.cl.items.forEach(function(i){ if(S.cl.done[i]) n++; }); return n; }
function clRender(){
  clOv.replaceChildren(); var card=el('div','cdcard clcard'); card.append(el('h3','',T('Λίστα ελέγχου πριν βγεις','Pre-departure checklist')));
  S.cl.items.forEach(function(it,i){
    var r=el('label','clrow'), c=el('input'); c.type='checkbox'; c.checked=!!S.cl.done[it]; c.addEventListener('change',function(){ S.cl.done[it]=c.checked; save(); clBtnUpd(); });
    var s=el('span','',it), x=el('button','clx','✕'); x.type='button'; x.setAttribute('aria-label',T('Διαγραφή','Delete')); x.addEventListener('click',function(e){ e.preventDefault(); S.cl.items.splice(i,1); save(); clRender(); clBtnUpd(); });
    r.append(c,s,x); card.append(r);
  });
  var bt=el('div','cdbtn'), add=el('button','',T('+ Προσθήκη','+ Add')), ok=el('button','acc',T('Έτοιμος','Done')); add.type='button'; ok.type='button';
  add.addEventListener('click',function(){ window.AlkyonAsk.prompt(T('Νέο στοιχείο στη λίστα','New checklist item'),{title:T('Λίστα ελέγχου','Checklist'),ok:T('Προσθήκη','Add'),max:50}).then(function(v){ v=(v||'').trim(); if(v&&S.cl.items.indexOf(v)<0){ S.cl.items.push(v); save(); clRender(); clBtnUpd(); } }); });
  ok.addEventListener('click',function(){ clOv.hidden=true; });
  bt.append(add,ok); card.append(bt); clOv.append(card);
}
clOv.addEventListener('click',function(e){ if(e.target===clOv) clOv.hidden=true; });
function openCl(){ clRender(); clOv.hidden=false; }
var clBtn=null;
function clBtnUpd(){ if(clBtn) clBtn.textContent='✓ '+T('Λίστα ελέγχου','Checklist')+' ('+clCount()+'/'+S.cl.items.length+')'; }
(function(){ var go=$('sfStart'); if(!go) return; clBtn=el('button','btn ghost clbtn'); clBtn.type='button'; clBtn.addEventListener('click',openCl); go.parentNode.insertBefore(clBtn,go); clBtnUpd(); })();

/* ---------- ώρες κινητήρα, άδεια, εβδομαδιαία περίληψη ---------- */
window.addEventListener('alkyon-tripend',function(e){
  var t=(C.Store.raw('trips')||[]).find(function(x){ return e.detail&&x.id===e.detail.id; }); if(!t||!t.startMs||!t.endMs) return;
  S.eng.h=Math.round((S.eng.h+Math.max(0,t.endMs-t.startMs-(t.pauseMs||0))/3600000)*10)/10; save();
  if(S.eng.every>0&&S.eng.h-S.eng.last>=S.eng.every) setTimeout(function(){ note('🔧 '+T('Service κινητήρα','Engine service'),T('Πέρασαν ','It has been ')+Math.round(S.eng.h-S.eng.last)+T(' ώρες από το τελευταίο service.',' h since the last service.')); },4000);
});
function licCheck(){
  if(!S.lic) return; var today=C.nicosiaToday(), days=Math.round((Date.parse(S.lic+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000), sent=C.lsGet('alkyon-smart-sent',{});
  if(sent.lic===today) return; if(days<0||days<=14){ sent.lic=today; C.lsSet('alkyon-smart-sent',sent); note('🪪 '+T('Άδεια ψαρέματος','Fishing licence'),days<0?T('Η άδεια έχει λήξει.','The licence has expired.'):T('Λήγει σε ','Expires in ')+days+T(' ημέρες.',' days.')); }
}
function weekly(){
  var now=Date.now(); if(S.weekly&&now-S.weekly<7*86400000) return; if(tripOn()) return;
  var all=C.Store.act?C.Store.act():(C.Store.get('bites')||[]), tr=C.Store.get('trips')||[]; if(!all.length&&!tr.length){ return; }
  var lo=new Date(now-7*86400000+C.utcMin()*60000).toISOString().slice(0,10), b=all.filter(function(x){ return (x.date||'')>=lo; }), t=tr.filter(function(x){ return (x.date||'')>=lo; });
  S.weekly=now; save(); if(!b.length&&!t.length) return;
  var kg=b.reduce(function(a,x){ return a+(+x.kg||0); },0), sp={}; b.forEach(function(x){ if(x.species) sp[x.species]=(sp[x.species]||0)+1; });
  var top=Object.keys(sp).sort(function(a,c){ return sp[c]-sp[a]; })[0];
  window.AlkyonAsk(t.length+T(t.length===1?' έξοδος · ':' έξοδοι · ',t.length===1?' trip · ':' trips · ')+b.length+T(' ψάρια · ',' fish · ')+(Math.round(kg*10)/10)+' kg'+(top?'\n'+T('Συχνότερο: ','Most frequent: ')+top:''),{title:T('Η εβδομάδα σου','Your week'),ok:T('Εντάξει','OK'),cancel:false});
}
setTimeout(licCheck,5000); setTimeout(weekly,8000);

/* ---------- αυτόματη αναγνώριση λιμανιού ---------- */
var OVP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
function portsNear(lat,lon,rad){
  rad=rad||3000;
  var ck=C.lsGet('alkyon-port-cache2',null); if(ck&&Math.abs(ck.lat-lat)<0.002&&Math.abs(ck.lon-lon)<0.002&&Date.now()-ck.t<30*86400000&&ck.rad>=rad) return Promise.resolve(ck.list);
  var q='[out:json][timeout:15];(nwr(around:'+rad+','+lat+','+lon+')["leisure"="marina"];nwr(around:'+rad+','+lat+','+lon+')["harbour"="yes"];nwr(around:'+rad+','+lat+','+lon+')["seamark:type"~"^(harbour|harbour_basin|small_craft_facility)$"];nwr(around:'+rad+','+lat+','+lon+')["amenity"="boat_rental"]["name"];nwr(around:'+rad+','+lat+','+lon+')["leisure"="slipway"]["name"];);out center tags 60;';
  function ask(i){
    if(i>=OVP.length) return Promise.reject(new Error('net'));
    var ctl=window.AbortController?new AbortController():null, tm=setTimeout(function(){ if(ctl) ctl.abort(); },8000);
    return fetch(OVP[i],{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ctl?ctl.signal:undefined})
      .then(function(r){ clearTimeout(tm); if(!r.ok) throw new Error('http'); return r.json(); }).catch(function(){ clearTimeout(tm); return ask(i+1); });
  }
  return ask(0).then(function(j){
    var list=[], seen={};
    (j.elements||[]).forEach(function(e){
      var la=e.lat!=null?e.lat:(e.center&&e.center.lat), lo=e.lon!=null?e.lon:(e.center&&e.center.lon); if(la==null||lo==null) return;
      var tg=e.tags||{}, nm=tg['name:el']||tg.name||tg['name:en']||tg['seamark:name']||'';
      var d=distKm(lat,lon,la,lo), sc=d+(nm?0:0.8)+(tg.leisure==='marina'||tg.harbour==='yes'?0:0.4);
      var key=(nm||'?')+'|'+la.toFixed(3)+'|'+lo.toFixed(3); if(seen[key]) return; seen[key]=1;
      list.push({sc:sc,d:d,lat:la,lon:lo,name:nm||T('Λιμάνι','Port'),named:!!nm});
    });
    list.sort(function(a,b){ return a.sc-b.sc; });
    C.lsSet('alkyon-port-cache2',{lat:lat,lon:lon,t:Date.now(),rad:rad,list:list}); return list;
  });
}
function nomi(q,lat,lon,deg){
  var u='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=12&accept-language='+(EN?'en':'el')+'&q='+encodeURIComponent(q)+(lat!=null?'&viewbox='+(lon-deg)+','+(lat+deg)+','+(lon+deg)+','+(lat-deg)+'&bounded=1':'&viewbox=32.2,35.75,34.7,34.5');
  return fetch(u).then(function(r){ if(!r.ok) throw new Error('nominatim '+r.status); return r.json(); }).then(function(j){
    return (j||[]).map(function(x){ var nm=(x.name||(x.display_name||'').split(',')[0]||'').trim(); return {name:nm||T('Λιμάνι','Port'),lat:+x.lat,lon:+x.lon,d:lat!=null?distKm(lat,lon,+x.lat,+x.lon):null,named:!!nm,sc:0}; }).filter(function(x){ return !isNaN(x.lat); });
  });
}
function portsNearSafe(lat,lon,rad){
  var ck=C.lsGet('alkyon-port-cache3',null); if(ck&&Math.abs(ck.lat-lat)<0.01&&Math.abs(ck.lon-lon)<0.01&&Date.now()-ck.t<30*86400000&&ck.list&&ck.list.length) return Promise.resolve(ck.list);
  function nm(){ return Promise.all(['marina','harbour','port'].map(function(q){ return nomi(q,lat,lon,0.12).catch(function(){ return []; }); })).then(function(a){
    var seen={}, out=[]; [].concat.apply([],a).forEach(function(x){ var k=x.name+x.lat.toFixed(3); if(!seen[k]){ seen[k]=1; out.push(x); } }); out.sort(function(p,q){ return p.d-q.d; }); if(!out.length) throw new Error('empty'); return out; }); }
  return new Promise(function(res,rej){ var fails=0, done=false, last=null;
    function ok(l){ if(done) return; if(l&&l.length){ done=true; C.lsSet('alkyon-port-cache3',{lat:lat,lon:lon,t:Date.now(),list:l}); res(l); } else bad(new Error('empty')); }
    function bad(e){ last=e; if(++fails>=2&&!done){ done=true; rej(last); } }
    portsNear(lat,lon,rad).then(ok,bad); nm().then(ok,bad); });
}
function findPort(lat,lon,rad){ return portsNearSafe(lat,lon,rad).then(function(l){ return l.length?l[0]:null; }); }
function offerHome(p,why){
  return findPort(p.lat,p.lon).catch(function(){ return undefined; }).then(function(r){
    var cand=r&&r.d<=1.5?r:null;
    var msg=cand?T('Βρήκα το λιμάνι «','I found the port “')+cand.name+T('» ','” ')+Math.round(cand.d*1000)+T(' μ. από εσένα. Να οριστεί ως το λιμάνι σου;',' m from you. Set it as your home port?')
      :(r===undefined?T('Δεν έχω ίντερνετ για να βρω όνομα λιμανιού. Να οριστεί η τωρινή θέση ως λιμάνι σου;','No internet to look up a port name. Set your current position as home port?')
      :T('Δεν βρέθηκε γνωστό λιμάνι κοντά. Να οριστεί η τωρινή θέση ως λιμάνι σου;','No known port nearby. Set your current position as home port?'));
    return window.AlkyonAsk((why||'')+msg,{title:T('Λιμάνι','Home port'),ok:T('Ναι','Yes'),cancel:T('Όχι','No')}).then(function(ok){
      if(ok){ S.home=cand?{lat:cand.lat,lon:cand.lon,name:cand.name}:{lat:p.lat,lon:p.lon,name:T('Λιμάνι','Port')}; delete S.homeNo; save(); autoStop(); autoStart(); rt(); C.toast(T('Λιμάνι: ','Home port: ')+S.home.name); }
      else { S.homeNo=Date.now(); save(); }
      return !!ok;
    });
  });
}
function homeCanAsk(){ return !S.home&&!(S.homeNo&&Date.now()-S.homeNo<7*86400000); }
/* στην έναρξη εξόδου, όταν δεν υπάρχει λιμάνι */
window.addEventListener('alkyon-sess',function(){
  if(!tripOn()||!homeCanAsk()) return;
  var tries=0; (function go(){ fixNow(function(p){ if(homeCanAsk()&&tripOn()) offerHome(p,''); },function(){ if(++tries<3) setTimeout(go,15000); }); })();
});
/* μετά από εξόδους: ίδιο σημείο εκκίνησης ≥2 φορές */
window.addEventListener('alkyon-tripend',function(){
  if(!homeCanAsk()) return;
  var pts=(C.Store.raw('trips')||[]).map(function(t){ return t.cond0&&t.cond0.lat!=null?{lat:t.cond0.lat,lon:t.cond0.lon}:null; }).filter(Boolean);
  for(var i=0;i<pts.length;i++){ var cl=pts.filter(function(q){ return distKm(pts[i].lat,pts[i].lon,q.lat,q.lon)*1000<=300; }); if(cl.length>=2){
    var la=cl.reduce(function(a,q){ return a+q.lat; },0)/cl.length, lo=cl.reduce(function(a,q){ return a+q.lon; },0)/cl.length;
    setTimeout(function(){ if(homeCanAsk()) offerHome({lat:la,lon:lo},T('Ξεκινάς συχνά από το ίδιο σημείο. ','You often start from the same spot. ')); },5000); break; } }
});


/* ---------- πεδίο «Λιμάνι αναχώρησης» στη φόρμα εξόδου + προτάσεις προορισμού ---------- */
function norm(x){ return (x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ς/g,'σ'); }
function suggest(input,getItems,onPick,remote){
  var box=el('div','sgbox'); box.hidden=true; input.parentNode.appendChild(box); var items=[], tm=null, cur='', busy=false;
  function draw(){ box.replaceChildren(); var q=norm(input.value.trim()), n=0;
    items.forEach(function(x){ if(n>=30) return; if(q&&norm(x.name).indexOf(q)<0) return; n++;
      var b=el('button','sgitem'); b.type='button'; b.append(el('b','',x.name)); if(x.sub) b.append(el('small','',x.sub));
      b.addEventListener('mousedown',function(e){ e.preventDefault(); }); b.addEventListener('click',function(){ input.value=x.name; box.hidden=true; onPick&&onPick(x); }); box.append(b); });
    if(!n) box.append(el('div','sgempty',busy?T('Αναζήτηση…','Searching…'):(cur||T('Δεν βρέθηκε. Γράψε ελεύθερο κείμενο.','No match. Type free text.')))); box.hidden=false; place(); }
  function place(){ try{ if(getComputedStyle(box).position==='absolute'){ box.style.top=(input.offsetTop+input.offsetHeight+4)+'px'; } }catch(e){} }
  function refresh(){ items=getItems(); draw(); }
  input.addEventListener('focus',refresh);
  input.addEventListener('input',function(){ draw(); clearTimeout(tm); var v=input.value.trim(); if(remote&&v.length>=3) busy=true; draw(); tm=setTimeout(function(){ if(!remote) return; remote(v,function(extra,msg){ busy=false; cur=msg||''; if(extra&&extra.length){ var have={}; items.forEach(function(x){ have[norm(x.name)+(x.lat||'')]=1; }); extra.forEach(function(x){ if(!have[norm(x.name)+(x.lat||'')]) items.push(x); }); } draw(); }); },350); });
  input.addEventListener('blur',function(){ setTimeout(function(){ box.hidden=true; },200); });
  return {refresh:refresh,busy:function(v){ busy=v; if(!box.hidden) draw(); },set:function(a){ items=a; },get:function(){ return items; }};
}
(function(){
  var route=$('sfRoute'), go=$('sfStart'); if(!route||!go) return;
  var sec0=route.closest('.sfsec'), lab=route.closest('label');
  var ps=el('div','sfsec'), pl=el('label','f'); pl.append(document.createTextNode(T('Λιμάνι αναχώρησης','Departure port')));
  var pin=el('input'); pin.type='text'; pin.id='sfPort'; pin.maxLength=80; pin.autocomplete='off'; pin.placeholder=T('π.χ. Μαρίνα Λατσιού','e.g. Latchi marina');
  pl.append(pin); ps.append(pl); sec0.parentNode.insertBefore(ps,sec0);
  var hint=el('div','sfhint'); pl.append(hint);
  /* v31z294: ετικέτα ανά προφίλ — ψαροτούφεκο/στεριά: λιμάνι Ή σημείο εκκίνησης */
  function portLabels(){ var fp='boat'; try{ fp=localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){}
    var t=fp==='lake'?T('Σημείο εκκίνησης','Starting point'):(fp==='spear'||fp==='shore')?T('Λιμάνι ή σημείο εκκίνησης','Departure port or point'):T('Λιμάνι αναχώρησης','Departure port');
    if(pl.firstChild&&pl.firstChild.nodeType===3) pl.firstChild.nodeValue=t;
    pin.placeholder=fp==='boat'?T('π.χ. Μαρίνα Λατσιού','e.g. Latchi marina'):T('π.χ. Μαρίνα Λατσιού ή παραλία','e.g. Latchi marina or beach'); }
  portLabels(); window.addEventListener('alkyon-fprof',function(){ setTimeout(portLabels,50); });
  var list=[], remoteList=[], nearList=[], fixP=null;
  var picked=[];
  /* v31z295: επιλογή σημείου εκκίνησης από τον χάρτη */
  var mb=el('button','btn ghost sm'); mb.type='button'; mb.id='sfPortMap'; mb.style.marginTop='6px'; mb.textContent=T('📍 Επιλογή από τον χάρτη','📍 Pick on the map'); pl.append(mb);
  mb.addEventListener('click',function(){
    var map=C.map&&C.map(), sheet=$('tripSheet'), L=window.L; if(!map||!L){ C.toast(T('Ο χάρτης δεν είναι έτοιμος.','Map not ready.')); return; }
    var bar=el('div'); bar.style.cssText='position:fixed;left:12px;right:12px;top:12px;z-index:100000;background:#0d2230;color:#fff;border:1px solid #E8743B;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 6px 24px #0008;font-size:15px';
    var tx=el('span'); tx.style.flex='1'; tx.textContent=T('Πάτα στον χάρτη το σημείο εκκίνησης.','Tap the map at your starting point.');
    var cb=el('button','btn ghost sm'); cb.type='button'; cb.textContent=T('Άκυρο','Cancel'); bar.append(tx,cb); document.body.appendChild(bar);
    var tab=document.querySelector('[role=tab][data-tab=map]'); if(tab) tab.click(); sheet.hidden=true;
    function back(){ try{ bar.remove(); }catch(e){} map.off('click',onClick); sheet.hidden=false; }
    cb.addEventListener('click',back);
    function onClick(e){
      var la=e.latlng.lat, lo=e.latlng.lng, mk=L.circleMarker(e.latlng,{radius:9,color:'#fff',weight:3,fillColor:'#E8743B',fillOpacity:1}).addTo(map);
      tx.textContent=T('Βρίσκω όνομα…','Finding a name…');
      var fb=T('Σημείο ','Point ')+la.toFixed(4)+', '+lo.toFixed(4), done=false;
      function fin(nm){ if(done) return; done=true; try{ map.removeLayer(mk); }catch(x){}
        var it={name:nm,lat:la,lon:lo,sub:T('από τον χάρτη','from map')}; picked=picked.filter(function(q){ return norm(q.name)!==norm(nm); }); picked.push(it);
        pin.value=nm; pin.dataset.touched='1'; delete pin.dataset.auto; hint.textContent=T('Από τον χάρτη','From the map'); back(); }
      var t=setTimeout(function(){ fin(fb); },3500);
      fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language='+(EN?'en':'el')+'&lat='+la+'&lon='+lo).then(function(r){ return r.json(); }).then(function(j){
        var a=(j&&j.address)||{}, nm=(j&&j.name)||a.road||a.neighbourhood||a.suburb||a.village||a.town||a.city||''; clearTimeout(t); fin(nm?(nm+' · '+la.toFixed(3)+', '+lo.toFixed(3)):fb); }).catch(function(){ clearTimeout(t); fin(fb); });
    }
    map.off('click',onClick); setTimeout(function(){ map.once('click',onClick); },0);
  });
  function base(){ var a=[]; if(S.home) a.push({name:S.home.name||T('Λιμάνι','Port'),lat:S.home.lat,lon:S.home.lon,sub:T('το λιμάνι σου','your port')}); (C.Store.get('spots')||[]).forEach(function(x){ if(typeof x.lat==='number'&&x.name) a.push({name:x.name,lat:x.lat,lon:x.lon,sub:T('σημείο σου','your spot')}); }); ((window.AlkyonPorts&&AlkyonPorts.mine())||[]).forEach(function(x){ a.push({name:x.name,lat:x.lat,lon:x.lon,sub:T('δικό σου','yours')}); }); return a; }
  function all(){ var seen={}, out=[]; base().concat(picked,nearList,remoteList).forEach(function(x){ var k=norm(x.name)+x.lat.toFixed(3); if(!seen[k]){ seen[k]=1; out.push(x); } }); list=out; return out; }
  function fmt(x){ return x.d!=null?Object.assign({},x,{sub:Math.round(x.d*10)/10+' km'}):x; }
  var sg=suggest(pin,function(){ return all().map(fmt); },null,function(q,cb){ var p=fixP; nomi(q,p?p.lat:null,p?p.lon:null,0.6).then(function(r){ remoteList=r; cb(r.map(fmt)); }).catch(function(e){ cb([],T('Δεν υπάρχει ίντερνετ για αναζήτηση.','No internet for search.')); }); });
  function prefill(){ pin.value=S.home?(S.home.name||T('Λιμάνι','Port')):''; hint.textContent=''; delete pin.dataset.touched; delete pin.dataset.auto; }
  /* αυτόματη συμπλήρωση: το πλησιέστερο ονομασμένο λιμάνι/ράμπα σε 800 μ. από τη θέση σου, αν δεν έχεις γράψει εσύ κάτι */
  function autoFill(){
    if(!fixP||pin.dataset.touched==='1') return;
    var best=null; nearList.concat(((window.AlkyonPorts&&AlkyonPorts.mine())||[]).map(function(x){ return {name:x.name,lat:x.lat,lon:x.lon}; })).forEach(function(x){ if(typeof x.lat!=='number') return; var d=distKm(fixP.lat,fixP.lon,x.lat,x.lon); if(!best||d<best.d) best={x:x,d:d}; });
    if(best&&best.d<=0.8){ pin.value=best.x.name; pin.dataset.auto='1'; hint.textContent=T('Αυτόματα, ','Auto, ')+Math.round(best.d*1000)+T(' μ. από εσένα',' m from you'); try{ if(document.activeElement===pin) pin.blur(); }catch(e){} }
  }
  pin.addEventListener('input',function(){ pin.dataset.touched='1'; delete pin.dataset.auto; });
  var loaded=0;
  function load(force){
    if(!force&&Date.now()-loaded<120000) return; loaded=Date.now(); hint.textContent=T('Αναζήτηση λιμανιών…','Looking for ports…'); sg.busy(true);
    fixNow(function(p){ fixP=p; portsNearSafe(p.lat,p.lon,8000).then(function(l){ sg.busy(false); nearList=l.filter(function(x){ return x.named; }); hint.textContent=nearList.length?'':T('Δεν βρέθηκαν λιμάνια κοντά.','No ports found nearby.'); autoFill(); sg.refresh(); if(pin.dataset.auto==='1'&&document.activeElement!==pin){ var bx=pin.parentNode.querySelector('.sgbox'); if(bx) bx.hidden=true; } }).catch(function(e){ sg.busy(false); hint.textContent=T('Δεν φορτώθηκαν λιμάνια (','Ports did not load (')+((e&&e.message)||'net')+T('). Γράψε το όνομα.','). Type the name.'); loaded=0; autoFill(); }); },function(){ hint.textContent=T('Δεν βρέθηκε θέση GPS.','No GPS fix.'); loaded=0; });
  }
  pin.addEventListener('focus',load);
  var tb=$('tripBtn'); if(tb) tb.addEventListener('click',function(){ setTimeout(prefill,50); setTimeout(function(){ load(true); },300); });
  setTimeout(function(){ if(!C.lsGet('alkyon-port-cache3',null)&&navigator.onLine) load(); },5000);
  prefill();
  /* προτάσεις προορισμού */
  suggest(route,function(){ var seen={}, out=[]; (C.Store.get('trips')||[]).slice().reverse().forEach(function(t){ var r=(t.spot||'').trim(); if(r&&!seen[norm(r)]){ seen[norm(r)]=1; out.push({name:r,sub:T('προηγούμενη έξοδος','previous trip')}); } }); (C.Store.get('spots')||[]).forEach(function(x){ var r=(x.name||'').trim(); if(r&&!seen[norm(r)]){ seen[norm(r)]=1; out.push({name:r,sub:T('σημείο σου','your spot')}); } }); return out.slice(0,40); });
  /* επιλογή λιμανιού κατά την έναρξη */
  go.addEventListener('click',function(){
    var v=pin.value.trim(); if(!v) return;
    var cur=S.home&&(S.home.name||T('Λιμάνι','Port')); if(cur&&norm(v)===norm(cur)) return;
    var m=all().find(function(x){ return norm(x.name)===norm(v); }); if(!m) return;
    if(pin.dataset.auto==='1'){ var o2=S.home; S.home={lat:m.lat,lon:m.lon,name:m.name}; if(o2) S.homeBack=o2; else delete S.homeBack; save(); autoStop(); rt(); return; }
    var old=S.home; setTimeout(function(){
      window.AlkyonAsk(T('Λιμάνι αναχώρησης: «','Departure port: “')+m.name+T('». Να γίνει και το μόνιμο λιμάνι σου;','”. Make it your permanent home port too?'),{title:T('Λιμάνι','Home port'),ok:T('Μόνιμο','Permanent'),cancel:T('Μόνο αυτή την έξοδο','This trip only')}).then(function(ok){
        if(!ok&&old) S.homeBack=old; else if(!ok) S.homeBack=null;
        S.home={lat:m.lat,lon:m.lon,name:m.name}; if(ok) delete S.homeBack; save(); autoStop(); rt(); });
    },600);
  });
})();
window.addEventListener('alkyon-tripend',function(){ if(S.homeBack!==undefined){ S.home=S.homeBack||null; delete S.homeBack; save(); autoStop(); autoStart(); rt(); } });

/* ---------- πίνακας ρυθμίσεων ---------- */
var P=el('div'); P.id='smPanel'; P.hidden=true;
P.innerHTML='<div class="spcard"><div class="sphead"><b></b><button type="button" class="spx" aria-label="✕">✕</button></div><div class="spbody"></div></div>';
P.querySelector('b').textContent=T('Λιμάνι και σκάφος','Port and boat'); document.body.appendChild(P);
var body=P.querySelector('.spbody');
P.querySelector('.spx').addEventListener('click',function(){ P.hidden=true; }); P.addEventListener('click',function(e){ if(e.target===P) P.hidden=true; });
function sec(t){ body.append(el('div','smsec',t)); }
function row(t,d,ctl){ var r=el('div','sprow'), x=el('div','sptx'); x.append(el('b','',t)); if(d) x.append(el('span','',d)); r.append(x); if(ctl) r.append(ctl); body.append(r); return r; }
function btn(t,cls,fn){ var b=el('button','spb '+(cls||''),t); b.type='button'; b.addEventListener('click',fn); return b; }
function sw(on,fn){ var b=el('button','spsw'); b.type='button'; b.setAttribute('role','switch'); b.setAttribute('aria-checked',String(!!on)); b.addEventListener('click',fn); return b; }
function num(val,ph,fn,step){ var i=el('input','sminp'); i.type='number'; i.inputMode='decimal'; i.min='0'; i.step=step||'any'; i.placeholder=ph||''; if(val!=null&&val!=='') i.value=val; i.addEventListener('change',function(){ fn(i.value===''?null:+i.value); save(); }); return i; }
function render(){
  body.replaceChildren();
  sec(T('Λιμάνι','Port'));
  var spots=(C.Store.get('spots')||[]).filter(function(s){ return typeof s.lat==='number'; });
  var sel=el('select','sminp'); sel.append(new Option(T('Από τα σημεία μου…','From my spots…'),''));
  spots.forEach(function(s){ sel.append(new Option(s.name||'?',s.id)); });
  sel.addEventListener('change',function(){ var s=spots.find(function(x){ return x.id===sel.value; }); if(s){ S.home={lat:s.lat,lon:s.lon,name:s.name}; save(); autoStop(); autoStart(); render(); } });
  row(S.home?(S.home.name||T('Λιμάνι','Port'))+' ✓':T('Δεν έχει οριστεί','Not set'),S.home?AlkyonCoord.fmt(S.home.lat,S.home.lon):T('Χρειάζεται για «Πότε να γυρίσω», αυτονομία και αυτόματες προτάσεις.','Needed for “when to head back”, range and auto suggestions.'),null);
  var r2=el('div','sprow'); r2.append(sel,btn(T('Θέση μου τώρα','My position'),'acc',function(){ fixNow(function(p){ S.home={lat:p.lat,lon:p.lon,name:T('Λιμάνι','Port')}; save(); autoStop(); autoStart(); render(); C.toast(T('Το λιμάνι ορίστηκε στη θέση σου.','Port set to your position.')); },function(){ C.toast(T('Δεν βρέθηκε θέση GPS.','No GPS fix.')); }); }));
  r2.append(btn(T('Βρες λιμάνι','Find port'),'',function(){ fixNow(function(p){ offerHome(p,'').then(function(){ render(); }); },function(){ C.toast(T('Δεν βρέθηκε θέση GPS.','No GPS fix.')); }); }));
  if(S.home) r2.append(btn(T('Καθαρισμός','Clear'),'',function(){ S.home=null; save(); autoStop(); render(); rt(); })); body.append(r2);
  row(T('Γραμμή επιστροφής στον χάρτη','Return strip on map'),T('Η γραμμή «🏠 απόσταση · ώρα · ⛽» πάνω αριστερά κατά την έξοδο. Κράτα την πατημένη για να κρυφτεί. Οι ειδοποιήσεις μένουν ενεργές.','The “🏠 distance · time · ⛽” strip during a trip. Long-press it to hide. Alerts stay on.'),sw(S.chip!==false,function(){ S.chip=(S.chip===false); save(); render(); rt(); }));
  sec(T('Σκάφος','Boat'));
  /* v31z415: χωρίς γραμμή «Σκάφος…»: ο πίνακας ανοίγει πλέον μέσα από το Προφίλ › Σκάφος */
  row(T('Δαχτυλίδι αυτονομίας','Range ring'),T('Στον χάρτη, γύρω από το λιμάνι, κατά την έξοδο.','On the map around the port during a trip.'),sw(S.ring,function(){ S.ring=!S.ring; save(); render(); rt(); }));
  sec(T('Αυτόματα','Automatic'));
  row(T('Προτάσεις έναρξης και λήξης','Start and end suggestions'),T('Ρωτά όταν φεύγεις από το λιμάνι ή γυρίζεις. Χρησιμοποιεί GPS όσο η εφαρμογή είναι ανοιχτή.','Asks when you leave or return to the port. Uses GPS while the app is open.'),sw(S.auto,function(){ S.auto=!S.auto; save(); if(S.auto) autoStart(); else autoStop(); render(); }));
  sec(T('Πλοήγηση «Πηγαίνω εκεί»','“Go there” navigation'));
  var rs=el('select','sminp'); [['0',T('Ευθεία γραμμή (χωρίς έλεγχο στεριάς)','Straight line (no land check)')],['100','100 '+T('μ. από στεριά','m from land')],['200','200 '+T('μ. από στεριά (προεπιλογή)','m from land (default)')],['500','500 '+T('μ. από στεριά','m from land')],['1852','1 '+T('ν.μ. από στεριά','nm from land')]].forEach(function(o){ rs.append(new Option(o[1],o[0])); });
  rs.value=String(C.lsGet('alkyon-route-clr',200)); if(rs.selectedIndex<0) rs.value='200';
  rs.addEventListener('change',function(){ C.lsSet('alkyon-route-clr',+rs.value); });
  row(T('Διαδρομή γύρω από στεριά','Route around land'),T('Ενδεικτική διαδρομή που κρατά απόσταση από ακτές και νησιά. Δεν είναι ναυτικός χάρτης. Χρειάζεται σύνδεση.','Indicative route keeping a distance from coasts and islands. Not a nautical chart. Needs a connection.'),rs);
  sec(T('Άδεια και λίστα','Licence and checklist'));
  var li=el('input','sminp'); li.type='date'; if(S.lic) li.value=S.lic; li.addEventListener('change',function(){ S.lic=li.value||null; save(); var s=C.lsGet('alkyon-smart-sent',{}); delete s.lic; C.lsSet('alkyon-smart-sent',s); licCheck(); });
  row(T('Λήξη άδειας ψαρέματος','Licence expiry'),T('Υπενθύμιση 14 ημέρες πριν.','Reminder 14 days before.'),li);
  row(T('Λίστα ελέγχου','Checklist'),clCount()+'/'+S.cl.items.length,btn(T('Άνοιγμα','Open'),'',openCl));
  body.append(el('p','note',T('Οι εκτιμήσεις (ώρα επιστροφής, καύσιμο) είναι ενδεικτικές. Δεν αντικαθιστούν την κρίση σου ούτε τον κανονικό εξοπλισμό.','Estimates (return time, fuel) are indicative. They do not replace your judgement or proper equipment.')));
}
function openPanel(){ render(); P.hidden=false; }
(window.AlkyonSeaRows=window.AlkyonSeaRows||[]).push(function(){
  var r=el('div','sprow'), x=el('div','sptx'); x.append(el('b','',T('Λιμάνι και σκάφος','Port and boat')),el('span','',S.home?T('Λιμάνι ορισμένο','Port set')+(S.tank?' · '+S.tank+' L':''):T('Όρισε λιμάνι, καύσιμο και αυτόματες προτάσεις.','Set port, fuel and automatic suggestions.')));
  r.append(x,btn(T('Άνοιγμα','Open'),'acc',openPanel)); r.dataset.k='port'; return r;
});
window.AlkyonSmart={save:function(){ save(); rt(); },setHome:function(h){ S.home={lat:h.lat,lon:h.lon,name:h.name}; delete S.homeNo; delete S.homeBack; save(); autoStop(); autoStart(); rt(); },state:function(){ return S; },rt:rt,heat:heat,lastYear:lastYear,openPanel:openPanel,findPort:findPort,portsNear:portsNear,offerHome:offerHome,badIn:badIn,weekly:weekly};
autoStart();
})();
