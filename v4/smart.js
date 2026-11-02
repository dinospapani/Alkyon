/* BiteCast 4 · Έξυπνα εργαλεία (ίδια λογική και ίδια δεδομένα με την κλασική smart.js, psaro-smart):
   - λιμάνι (home), γραμμή επιστροφής στην έξοδο: απόσταση, ώρα, καύσιμο, «Πότε να γυρίσω» με βάση τον καιρό, δαχτυλίδι αυτονομίας
   - αυτόματη πρόταση έναρξης (φεύγεις από λιμάνι) και λήξης (γύρισες στο λιμάνι)
   - λίστα ελέγχου πριν την έξοδο, λιμάνι αναχώρησης στη φόρμα εξόδου
   - ώρες κινητήρα και υπενθύμιση service, λήξη άδειας, εβδομαδιαία περίληψη
   - «Πέρσι τέτοια μέρα», ειδοποίηση πριν από επετείους ψαρέματος, «ίδιες συνθήκες με παλιά ψαριά» */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls, U=window.PsaroUnits;
var KEY='psaro-smart', R=Math.PI/180, ROOT=new URL('../',location.href).href;
function load(){ var S=ls.get(KEY,{}); if(!S||typeof S!=='object'||Array.isArray(S)) S={};
  S.cruise=+S.cruise>0?+S.cruise:15; S.reserve=S.reserve!=null?+S.reserve:20; S.auto=S.auto!==false; S.ring=S.ring!==false; S.eng=S.eng||{h:0,every:100,last:0};
  S.cl=S.cl||{items:null,done:{}}; if(!Array.isArray(S.cl.items)) S.cl.items=T(['Σωσίβια για όλους','Καύσιμα επαρκή','Δολώματα και εξοπλισμός','Άδεια ψαρέματος','Φορτισμένο κινητό','Νερό και φαγητό','Φαρμακείο πρώτων βοηθειών','Φακός / VHF'],['Lifejackets for everyone','Enough fuel','Bait and tackle','Fishing licence','Phone charged','Water and food','First aid kit','Torch / VHF']); if(!S.cl.done) S.cl.done={};
  return S; }
var S=load();
function save(){ ls.set(KEY,S); }
B.on('store',function(k){ if(k===KEY) S=load(); });
window.addEventListener('storage',function(e){ if(e.key===KEY) S=load(); });
function distKm(a,b,c,d){ var dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742*Math.asin(Math.min(1,Math.sqrt(x))); }
function tripOn(){ return !!(B.trip&&B.trip.active&&B.trip.active()); }
function dist(km){ return U?U.dist(km,km<10?(km<1?2:1):0):B.num(km,1)+' km'; }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function fixNow(cb,fail){ var fx=B.trip&&B.trip.fix&&B.trip.fix(); if(fx&&fx.lat!=null&&Date.now()-(fx.t||0)<60000){ cb({lat:fx.lat,lon:fx.lon}); return; }
  if(!navigator.geolocation){ fail&&fail(); return; }
  navigator.geolocation.getCurrentPosition(function(p){ cb({lat:p.coords.latitude,lon:p.coords.longitude}); },function(){ fail&&fail(); },{enableHighAccuracy:true,timeout:9000,maximumAge:30000}); }
function notify(title,body){ try{ if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){ navigator.serviceWorker.getRegistration(ROOT).then(function(r){ if(r) r.showNotification(title,{body:body,icon:'../icon-192.png',tag:'psaro-smart',vibrate:[200,100,200]}); }); return; } }catch(e){} B.toast(title+(body?' · '+body:'')); }
function note(title,body,key,gap){ var sent=ls.get('psaro-smart-sent',{})||{}, now=Date.now(); if(key){ if(sent[key]&&now-sent[key]<gap) return; sent[key]=now; ls.set('psaro-smart-sent',sent); }
  if(B.inboxAdd) B.inboxAdd(title,body,'smart'); notify(title,body); try{ navigator.vibrate&&navigator.vibrate([200,100,200]); }catch(e){} }

/* ---------- γραμμή επιστροφής: λιμάνι, ώρα, καύσιμο ---------- */
var chip=null, ringL=null, rtState={level:'',msg:'',txt:''};
function badIn(){
  var c=ls.get('psaro-wxa',null); if(!c||!c.f||!c.f.nowLocal||!c.f.days||Date.now()-c.t>4*3600000) return null;
  var base=Date.parse(c.f.nowLocal.slice(0,16)+':00Z'), el0=(Date.now()-c.t)/60000, best=null;
  c.f.days.forEach(function(d){ (d.hours||[]).forEach(function(x){ if(!x.t||best) return; var tm=Date.parse(x.t.slice(0,13)+':00:00Z'); if(isNaN(tm)||tm<base-3600000) return;
    if((x.wind||0)>=20||(x.gust||0)>=28||(x.wave||0)>=1.5) best={mins:Math.max(0,(tm-base)/60000-el0),wind:x.wind,wave:x.wave}; }); });
  return best;
}
var atHome=0, endAsked=false;
function rt(){
  if(!tripOn()){ rtState={level:'',msg:'',txt:''}; paintChip(); drawRing(); return; }
  fixNow(function(p){
    S=load(); var now=Date.now(), parts=[], level='', msg='';
    if(S.tank>0&&S.burn>0){ if(!S.fuel||S.fuel.L==null) S.fuel={L:S.tank,t:now}; var dt=(now-(S.fuel.t||now))/3600000; if(dt>0&&dt<1) S.fuel.L=Math.max(0,S.fuel.L-S.burn*dt); S.fuel.t=now; save(); }
    var d=null, eta=null;
    if(S.home){ d=distKm(p.lat,p.lon,S.home.lat,S.home.lon)*1.1; eta=d/1.852/S.cruise*60; parts.push('🏠 '+dist(d)+' · ~'+Math.max(1,Math.round(eta))+(EN?' min':'λ')); }
    if(S.fuel&&S.tank>0){ parts.push('⛽ ~'+Math.round(S.fuel.L)+' L');
      if(d!=null){ var need=d/1.852/S.cruise*S.burn, rsv=S.tank*S.reserve/100;
        if(S.fuel.L-need<rsv*0.5){ level='bad'; msg=T('Καύσιμο: χρειάζεσαι ~','Fuel: you need ~')+Math.ceil(need)+T(' L για να γυρίσεις και έχεις ~',' L to get home and have ~')+Math.round(S.fuel.L)+' L'; note('⛽ '+T('Χαμηλά καύσιμα','Low fuel'),msg,'fuel',25*60000); }
        else if(S.fuel.L-need<rsv){ level='warn'; msg=T('Το καύσιμο πλησιάζει την εφεδρεία','Fuel is close to the reserve'); note('⛽ '+T('Καύσιμο','Fuel'),msg+' (~'+Math.round(S.fuel.L)+' L)','fuelw',40*60000); } } }
    if(eta!=null){ var b=badIn();
      if(b){ var margin=b.mins-eta;
        if(margin<=20){ level='bad'; msg=T('Ώρα να γυρίσεις: χρειάζεσαι ~','Time to head back: you need ~')+Math.round(eta)+T('′ και ο καιρός χειροτερεύει σε ~',' min and the weather worsens in ~')+Math.round(b.mins)+(EN?' min':'′'); note('🏠 '+T('Πότε να γυρίσεις','When to head back'),msg,'back',25*60000); }
        else if(margin<=60&&!level){ level='warn'; msg=T('Ο καιρός χειροτερεύει σε ~','Weather worsens in ~')+Math.round(b.mins)+T('′. Η επιστροφή θέλει ~',' min. The trip home takes ~')+Math.round(eta)+(EN?' min':'′'); note('🏠 '+T('Προσοχή στον καιρό','Weather watch'),msg,'backw',40*60000); } }
      /* v31z543: δύση και ώρα επιστροφής που δήλωσες (όταν δεν υπάρχει ήδη ειδοποίηση καιρού) */
      if(!level&&d!=null&&d/1.1>=0.9){ var hmT=function(ms){ var x=new Date(ms); return B.pad(x.getHours())+':'+B.pad(x.getMinutes()); }, ts=null; try{ ts=B.trip&&B.trip.state(); }catch(e){}
        if(ts&&ts.due&&ts.due>now&&ts.due-now<=(eta+10)*60000){ level='warn'; msg=T('Για να είσαι πίσω στις ','To be back by ')+hmT(ts.due)+T(', ξεκίνα τώρα (~',', leave now (~')+Math.round(eta)+(EN?' min)':'′)'); note('🏠 '+T('Ώρα να γυρίσεις','Time to head back'),msg,'due'+ts.due,6*3600000); }
        else if(window.PF&&PF.sunMoon){ try{ var dd=new Date(), ds=dd.getFullYear()+'-'+B.pad(dd.getMonth()+1)+'-'+B.pad(dd.getDate()), tz=-dd.getTimezoneOffset(), sm=PF.sunMoon(ds,p.lat,p.lon,tz), set=new Date(dd.getFullYear(),dd.getMonth(),dd.getDate()).getTime()+sm.set*60000;
          if(set>now&&set-now<=(eta+15)*60000){ level='warn'; msg=T('Δύση στις ','Sunset at ')+hmT(set)+T('. Η επιστροφή θέλει ~','. The trip home takes ~')+Math.round(eta)+(EN?' min':'′'); note('🌅 '+T('Η δύση πλησιάζει','Sunset is near'),msg,'sunset'+ds,12*3600000); } }catch(e){} } }
      if(S.auto&&d!=null&&d/1.1<0.2){ atHome=atHome||now; if(now-atHome>120000&&!endAsked){ endAsked=true; B.ask(T('Φαίνεται ότι γύρισες στο λιμάνι. Να τελειώσει η έξοδος;','You seem to be back at the port. End the trip?'),T('Τέλος εξόδου','End trip')).then(function(y){ if(y&&B.trip) B.trip.back(); }); } } else atHome=0; }
    rtState={level:level,msg:msg,txt:parts.join('  ·  ')}; paintChip(); drawRing();
  },function(){});
}
function paintChip(){ if(!chip||!chip.isConnected) return; chip.hidden=!rtState.txt||S.chip===false||!tripOn(); chip.textContent=rtState.txt; chip.className='rtchip '+rtState.level; chip.title=rtState.msg;
  var m=chip.nextSibling; if(m&&m.classList&&m.classList.contains('rtmsg')){ m.textContent=rtState.msg; m.hidden=chip.hidden||!rtState.msg; } }
function mapRef(){ var C=window.PsaroCore; return C&&C.map&&C.map(); }
function drawRing(){ var map=mapRef(); if(!map||!window.L) return; if(!ringL) ringL=L.layerGroup().addTo(map); ringL.clearLayers();
  if(!tripOn()||!S.ring||!S.home||!(S.tank>0&&S.burn>0)||!S.fuel) return;
  var usable=Math.max(0,S.fuel.L-S.tank*S.reserve/100), rKm=usable/S.burn*S.cruise*1.852/2; if(rKm<0.3) return;
  L.circle([S.home.lat,S.home.lon],{radius:rKm*1000,color:'#e8a317',weight:2,dashArray:'8 8',fill:false,interactive:false}).addTo(ringL); }
/* το κουμπί μπαίνει στον χάρτη (καλείται από τη σελίδα του χάρτη) */
B.smartChip=function(){ chip=h('button',{class:'rtchip',type:'button',hidden:true,onclick:function(){ if(S.home&&B.goTo) B.goTo(S.home.lat,S.home.lon,S.home.name||T('Λιμάνι','Home')); else location.hash='#boat'; }});
  var msg=h('div',{class:'rtmsg',hidden:true,role:'status'}); setTimeout(function(){ paintChip(); drawRing(); },30); return [chip,msg]; };
setInterval(rt,60000); setTimeout(rt,3000);
B.on('tripstart',function(){ S=load(); endAsked=false; atHome=0; if(S.fuel) S.fuel.t=Date.now(); S.cl.done={}; save(); autoStop(); setTimeout(rt,800); homeAtStart(); });
B.on('trip',function(){ if(!tripOn()){ paintChip(); drawRing(); } });

/* ---------- αυτόματη πρόταση έναρξης ---------- */
var aw=null, aPrev=null, aHits=0, aRest=null;
function autoStop(){ if(aw!=null){ try{ navigator.geolocation.clearWatch(aw); }catch(e){} aw=null; } aPrev=null; aHits=0; aRest=null; }
function autoStart(){
  S=load(); if(aw!=null||!S.auto||tripOn()||!navigator.geolocation||!S.home) return;
  try{ aw=navigator.geolocation.watchPosition(function(p){
    if(tripOn()){ autoStop(); return; }
    var c=p.coords, t=Date.now(), v=(c.speed!=null&&!isNaN(c.speed))?c.speed:null;
    if(v==null&&aPrev&&t-aPrev.t>=2000) v=distKm(aPrev.lat,aPrev.lon,c.latitude,c.longitude)*1000/((t-aPrev.t)/1000);
    aPrev={lat:c.latitude,lon:c.longitude,t:t};
    if(v!=null&&v<1){ if(!aRest||distKm(aRest.lat,aRest.lon,c.latitude,c.longitude)*1000>80) aRest={lat:c.latitude,lon:c.longitude,since:t,port:undefined};
      else if(t-aRest.since>=60000&&aRest.port===undefined){ var r0=aRest; r0.port=null; if(S.home&&distKm(S.home.lat,S.home.lon,r0.lat,r0.lon)<=0.5) r0.port={name:S.home.name||''}; } }
    var away=S.home&&distKm(c.latitude,c.longitude,S.home.lat,S.home.lon)*1000>400, fromPort=aRest&&aRest.port&&distKm(aRest.lat,aRest.lon,c.latitude,c.longitude)*1000>400;
    aHits=(v!=null&&v>=2.5&&(fromPort||(!aRest&&away)))?aHits+1:0;
    var pname=aRest&&aRest.port&&aRest.port.name||'';
    if(aHits>=4){ aHits=0; var sent=ls.get('psaro-smart-sent',{})||{}; if(sent.autoStart&&t-sent.autoStart<3*3600000) return; sent.autoStart=t; ls.set('psaro-smart-sent',sent);
      B.ask((pname?T('Φαίνεται ότι ξεκίνησες από «','You seem to have left “')+pname+T('». ','”. '):T('Φαίνεται ότι ξεκίνησες από το λιμάνι. ','You seem to have left the port. '))+T('Να ξεκινήσεις έξοδο, ώστε να καταγράφονται τα ψάρια;','Start a trip so catches get recorded?'),T('Έναρξη','Start')).then(function(y){ if(y&&B.tripStart) B.tripStart(); }); }
  },function(){},{enableHighAccuracy:true,maximumAge:5000,timeout:30000}); }catch(e){ aw=null; }
}
B.on('tripend',function(){ setTimeout(autoStart,4000); });
setTimeout(autoStart,6000);

/* ---------- λιμάνι: εύρεση από OpenStreetMap ---------- */
var OVP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
function portsNear(lat,lon,rad){ rad=rad||3000;
  var ck=ls.get('psaro-port-cache2',null); if(ck&&Math.abs(ck.lat-lat)<0.002&&Math.abs(ck.lon-lon)<0.002&&Date.now()-ck.t<30*86400000&&ck.rad>=rad) return Promise.resolve(ck.list);
  var a='(around:'+rad+','+lat+','+lon+')', q='[out:json][timeout:15];(nwr'+a+'["leisure"="marina"];nwr'+a+'["harbour"="yes"];nwr'+a+'["seamark:type"~"^(harbour|harbour_basin|small_craft_facility)$"];nwr'+a+'["leisure"="slipway"]["name"];);out center tags 60;';
  function ask(i){ if(i>=OVP.length) return Promise.reject(new Error('net')); var ctl=window.AbortController?new AbortController():null, tm=setTimeout(function(){ if(ctl) ctl.abort(); },8000);
    return fetch(OVP[i],{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ctl?ctl.signal:undefined}).then(function(r){ clearTimeout(tm); if(!r.ok) throw 0; return r.json(); }).catch(function(){ clearTimeout(tm); return ask(i+1); }); }
  return ask(0).then(function(j){ var list=[], seen={};
    (j.elements||[]).forEach(function(e){ var la=e.lat!=null?e.lat:(e.center&&e.center.lat), lo=e.lon!=null?e.lon:(e.center&&e.center.lon); if(la==null||lo==null) return;
      var tg=e.tags||{}, nm=tg['name:el']||tg.name||tg['name:en']||tg['seamark:name']||'', d=distKm(lat,lon,la,lo), sc=d+(nm?0:0.8)+(tg.leisure==='marina'||tg.harbour==='yes'?0:0.4), key=(nm||'?')+'|'+la.toFixed(3)+'|'+lo.toFixed(3);
      if(seen[key]) return; seen[key]=1; list.push({sc:sc,d:d,lat:la,lon:lo,name:nm||T('Λιμάνι','Port'),named:!!nm}); });
    list.sort(function(a2,b2){ return a2.sc-b2.sc; }); ls.set('psaro-port-cache2',{lat:lat,lon:lon,t:Date.now(),rad:rad,list:list}); return list; });
}
function findPort(lat,lon){ return portsNear(lat,lon,3000).then(function(l){ return l.length?l[0]:null; }); }
function setHome(hm){ S=load(); S.home=hm?{lat:hm.lat,lon:hm.lon,name:hm.name}:null; delete S.homeNo; delete S.homeBack; save(); autoStop(); autoStart(); rt(); }
function offerHome(p,why){
  return findPort(p.lat,p.lon).catch(function(){ return undefined; }).then(function(r){ var cand=r&&r.d<=1.5?r:null;
    var msg=cand?T('Βρήκα το λιμάνι «','I found the port “')+cand.name+T('» ','” ')+Math.round(cand.d*1000)+T(' μ. από εσένα. Να οριστεί ως το λιμάνι σου;',' m from you. Set it as your home port?'):(r===undefined?T('Δεν έχω ίντερνετ για να βρω όνομα λιμανιού. Να οριστεί η τωρινή θέση ως λιμάνι σου;','No internet to look up a port name. Set your current position as home port?'):T('Δεν βρέθηκε γνωστό λιμάνι κοντά. Να οριστεί η τωρινή θέση ως λιμάνι σου;','No known port nearby. Set your current position as home port?'));
    return B.ask((why||'')+msg,T('Ναι','Yes')).then(function(y){ if(y){ setHome(cand?{lat:cand.lat,lon:cand.lon,name:cand.name}:{lat:p.lat,lon:p.lon,name:T('Λιμάνι','Port')}); B.toast(T('Λιμάνι: ','Home port: ')+S.home.name); } else { S=load(); S.homeNo=Date.now(); save(); } return !!y; }); });
}
function homeCanAsk(){ S=load(); return B.prof()==='boat'&&!S.home&&!(S.homeNo&&Date.now()-S.homeNo<7*86400000); }
function homeAtStart(){ if(!homeCanAsk()) return; var tries=0; (function go(){ fixNow(function(p){ if(homeCanAsk()&&tripOn()) offerHome(p,''); },function(){ if(++tries<3) setTimeout(go,15000); }); })(); }
B.on('tripend',function(e){
  /* ώρες κινητήρα και service */
  S=load(); if(e&&e.startMs&&e.endMs&&e.id){ S.eng.h=Math.round(((+S.eng.h||0)+Math.max(0,e.endMs-e.startMs)/3600000)*10)/10; save();
    if(S.eng.every>0&&S.eng.h-(+S.eng.last||0)>=S.eng.every) setTimeout(function(){ note('🔧 '+T('Service κινητήρα','Engine service'),T('Πέρασαν ','It has been ')+Math.round(S.eng.h-(+S.eng.last||0))+T(' ώρες από το τελευταίο service.',' h since the last service.')); },4000); }
  if(S.homeBack!==undefined){ S.home=S.homeBack||null; delete S.homeBack; save(); }
  /* ίδιο σημείο εκκίνησης ≥2 φορές: πρόταση λιμανιού */
  if(!homeCanAsk()) return; var pts=B.store.raw('trips').map(function(t){ return t.cond0&&t.cond0.lat!=null?{lat:t.cond0.lat,lon:t.cond0.lon}:null; }).filter(Boolean);
  for(var i=0;i<pts.length;i++){ var cl=pts.filter(function(q){ return distKm(pts[i].lat,pts[i].lon,q.lat,q.lon)*1000<=300; }); if(cl.length>=2){
    var la=cl.reduce(function(a,q){ return a+q.lat; },0)/cl.length, lo=cl.reduce(function(a,q){ return a+q.lon; },0)/cl.length;
    setTimeout(function(){ if(homeCanAsk()) offerHome({lat:la,lon:lo},T('Ξεκινάς συχνά από το ίδιο σημείο. ','You often start from the same spot. ')); },5000); break; } }
});

/* ---------- λίστα ελέγχου ---------- */
function clCount(){ var n=0; S.cl.items.forEach(function(i){ if(S.cl.done[i]) n++; }); return n; }
function openCl(onClose){ S=load(); var body=h('div',{class:'bform'}), sh;
  function draw(){ body.replaceChildren(); S.cl.items.forEach(function(it,i){ var cb=h('input',{type:'checkbox',checked:!!S.cl.done[it],onchange:function(ev){ S.cl.done[it]=ev.target.checked; save(); }});
      body.append(h('div',{class:'clrow'},h('label',{class:'chkrow'},cb,h('span',{text:it})),h('button',{class:'clx',type:'button','aria-label':T('Διαγραφή','Delete'),text:'✕',onclick:function(){ S.cl.items.splice(i,1); save(); draw(); }}))); });
    var inp=h('input',{type:'text',maxlength:'50',placeholder:T('Νέο στοιχείο στη λίστα','New checklist item')});
    body.append(h('div',{class:'inrow'},inp,h('button',{class:'btn',type:'button',text:T('Προσθήκη','Add'),onclick:function(){ var v=inp.value.trim(); if(v&&S.cl.items.indexOf(v)<0){ S.cl.items.push(v); save(); draw(); } }})),
      h('button',{class:'btn pri full',type:'button',text:T('Έτοιμος','Done'),onclick:function(){ sh.close(); }})); }
  draw(); sh=B.sheet({title:T('Λίστα ελέγχου πριν βγεις','Pre-departure checklist'),body:body,onclose:onClose}); }
B.checklist=openCl;

/* ---------- στη φόρμα έναρξης εξόδου: λιμάνι αναχώρησης και λίστα ελέγχου ---------- */
B.tripStartExtras=function(routeInput){
  S=load(); var fp=B.prof(), lab=fp==='lake'?T('Σημείο εκκίνησης','Starting point'):(fp==='spear'||fp==='shore')?T('Λιμάνι ή σημείο εκκίνησης','Departure port or point'):T('Λιμάνι αναχώρησης','Departure port');
  var opts=[]; if(S.home) opts.push({k:'home',name:S.home.name||T('Λιμάνι','Port'),lat:S.home.lat,lon:S.home.lon,sub:T('το λιμάνι σου','your port')});
  ((window.PsaroPorts&&PsaroPorts.mine())||[]).forEach(function(x){ opts.push({name:x.name,lat:x.lat,lon:x.lon,sub:T('δικό σου','yours')}); });
  B.store.raw('spots').forEach(function(x){ if(!x.deleted&&typeof x.lat==='number'&&x.name) opts.push({name:x.name,lat:x.lat,lon:x.lon,sub:T('σημείο σου','your spot')}); });
  var sel=h('select',{class:'select'}); sel.append(h('option',{value:'',text:T('— Χωρίς —','— None —')})); opts.forEach(function(o,i){ sel.append(h('option',{value:String(i),text:o.name+' · '+o.sub})); }); sel.value=S.home?'0':'';
  var hint=h('small',{class:'wn'});
  var find=h('button',{class:'btn',type:'button',text:T('Βρες λιμάνι κοντά μου','Find a port near me'),onclick:function(){ hint.textContent=T('Αναζήτηση λιμανιών…','Looking for ports…');
    fixNow(function(p){ portsNear(p.lat,p.lon,8000).then(function(l){ l=l.filter(function(x){ return x.named; }).slice(0,8); if(!l.length){ hint.textContent=T('Δεν βρέθηκαν λιμάνια κοντά.','No ports found nearby.'); return; }
      l.forEach(function(x){ opts.push({name:x.name,lat:x.lat,lon:x.lon,sub:B.num(x.d,1)+' km'}); sel.append(h('option',{value:String(opts.length-1),text:x.name+' · '+B.num(x.d,1)+' km'})); }); sel.value=String(opts.length-l.length); hint.textContent=T('Βρέθηκαν ','Found ')+l.length+'.'; })
      .catch(function(){ hint.textContent=T('Δεν φορτώθηκαν λιμάνια. Χρειάζεται σύνδεση.','Ports did not load. Needs a connection.'); }); },function(){ hint.textContent=T('Δεν βρέθηκε θέση GPS.','No GPS fix.'); }); }});
  var clb=h('button',{class:'btn full',type:'button'}); function clTxt(){ S=load(); clb.textContent='✓ '+T('Λίστα ελέγχου','Checklist')+' ('+clCount()+'/'+S.cl.items.length+')'; } clTxt(); clb.addEventListener('click',function(){ openCl(function(){ setTimeout(function(){ B.tripStart(); },50); }); });
  var nodes=[h('label',{class:'fld'},h('span',{text:lab}),sel,hint),h('div',{class:'acts',style:{marginTop:'-4px'}},find)];
  if(fp==='boat') nodes.push(clb);
  /* προτάσεις προορισμού από προηγούμενες εξόδους και σημεία */
  if(routeInput){ var seen={}, dl=h('datalist',{id:'tripRouteDl'}); B.store.raw('trips').slice().reverse().forEach(function(t){ var r=(t.spot||'').trim(); if(r&&!seen[r.toLowerCase()]){ seen[r.toLowerCase()]=1; dl.append(h('option',{value:r})); } });
    B.store.raw('spots').forEach(function(x){ var r=(x.name||'').trim(); if(r&&!seen[r.toLowerCase()]){ seen[r.toLowerCase()]=1; dl.append(h('option',{value:r})); } }); routeInput.setAttribute('list','tripRouteDl'); nodes.push(dl); }
  return {nodes:nodes,apply:function(){ var o=opts[+sel.value]; if(!sel.value||!o||o.k==='home') return; S=load(); var old=S.home;
    setTimeout(function(){ B.ask(T('Λιμάνι αναχώρησης: «','Departure port: “')+o.name+T('». Να γίνει και το μόνιμο λιμάνι σου; (Αλλιώς μόνο για αυτή την έξοδο.)','”. Make it your permanent home port too? (Otherwise only for this trip.)'),T('Μόνιμο','Permanent')).then(function(y){ S=load(); if(!y) S.homeBack=old||null; S.home={lat:o.lat,lon:o.lon,name:o.name}; if(y) delete S.homeBack; save(); rt(); }); },900); }};
};

/* ---------- άδεια, εβδομαδιαία περίληψη ---------- */
function licCheck(){ S=load(); if(!S.lic) return; var td=today(), days=Math.round((Date.parse(S.lic+'T12:00:00Z')-Date.parse(td+'T12:00:00Z'))/86400000), sent=ls.get('psaro-smart-sent',{})||{};
  if(sent.lic===td) return; if(days<0||days<=14){ sent.lic=td; ls.set('psaro-smart-sent',sent); note('🪪 '+T('Άδεια ψαρέματος','Fishing licence'),days<0?T('Η άδεια έχει λήξει.','The licence has expired.'):T('Λήγει σε ','Expires in ')+days+T(' ημέρες.',' days.')); } }
function busy(){ return !!document.querySelector('.sheet,.scrim')||document.hidden; }
function weekly(){ S=load(); var now=Date.now(); if(S.weekly&&now-S.weekly<7*86400000) return; if(tripOn()) return; if(busy()){ setTimeout(weekly,60000); return; }
  var all=B.store.bites().filter(function(x){ return !x.deleted; }), tr=B.store.raw('trips').filter(function(x){ return !x.deleted; }); if(!all.length&&!tr.length) return;
  var d=new Date(now-7*86400000), lo=d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()), b=all.filter(function(x){ return (x.date||'')>=lo; }), t=tr.filter(function(x){ return (x.date||'')>=lo; });
  S.weekly=now; save(); if(!b.length&&!t.length) return;
  var kg=b.reduce(function(a,x){ return a+(+x.kg||0); },0), sp={}; b.forEach(function(x){ if(x.species) sp[x.species]=(sp[x.species]||0)+1; }); var top=Object.keys(sp).sort(function(a,c){ return sp[c]-sp[a]; })[0];
  /* v31z542: και λαγοκέφαλοι (χωριστά), καλύτερη μέρα, επόμενη καλή μέρα από την πρόγνωση */
  var nf=b.reduce(function(a2,x){ return a2+Math.max(1,Math.floor(+x.cnt)||1); },0), pc=(B.store.pests?B.store.pests():[]).filter(function(x){ return (x.date||'')>=lo; }).length;
  var byD={}; b.forEach(function(x){ byD[x.date]=(byD[x.date]||0)+Math.max(1,Math.floor(+x.cnt)||1); }); var bd=Object.keys(byD).sort(function(a2,c){ return byD[c]-byD[a2]; })[0];
  var ng=null; try{ var fc=(ls.get('psaro-fc7',null)||{}).fc, thr=(ls.get('psaro-notify',{})||{}).threshold||75; (fc&&fc.days||[]).forEach(function(dd){ if(!ng&&dd.date>today()&&dd.safe&&dd.win&&dd.best>=thr) ng=dd; }); }catch(e){}
  var rows=[[T('Έξοδοι','Trips'),String(t.length)],[T('Ψάρια','Catches'),String(nf)],[T('Κιλά','Kilos'),B.num(kg,1)],top?[T('Συχνότερο','Most frequent'),top]:null,bd&&nf>1?[T('Καλύτερη μέρα','Best day'),B.dayName(bd)+' ('+byD[bd]+')']:null,pc?['🐡 '+T('Λαγοκέφαλοι','Toadfish'),pc+T(' (δεν μετράνε)',' (not counted)')]:null,
    ng?[T('Επόμενη καλή μέρα','Next good day'),B.dayName(ng.date)+' '+B.pad(ng.win.s)+':00–'+B.pad((ng.win.e+1)%24)+':00 · '+ng.best]:null].filter(Boolean);
  if(B.inboxAdd) try{ B.inboxAdd('📅 '+T('Η εβδομάδα σου','Your week'),rows.map(function(r){ return r[0]+': '+r[1]; }).join(' · '),'info'); }catch(e){}
  B.sheet({title:T('Η εβδομάδα σου','Your week'),body:h('div',{class:'card'},h('div',{class:'rows one'},rows.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); })))}); }
setTimeout(licCheck,5000); setTimeout(weekly,8000);

/* ---------- «Πέρσι τέτοια μέρα» (για την Πρόγνωση) ---------- */
B.lastYearCard=function(){
  var td=today(), y0=+td.slice(0,4), tm=Date.UTC(2000,+td.slice(5,7)-1,+td.slice(8,10)), Y={};
  B.store.bites().forEach(function(b){ if(b.deleted||!b.date) return; var y=+b.date.slice(0,4); if(y>=y0) return; var d=Date.UTC(2000,+b.date.slice(5,7)-1,+b.date.slice(8,10)); if(Math.abs(d-tm)>7*86400000) return;
    var o=Y[y]||(Y[y]={n:0,kg:0,sp:{},w:[]}); o.n++; o.kg+=+b.kg||0; if(b.species) o.sp[b.species]=(o.sp[b.species]||0)+1; if(b.wind!=null) o.w.push(b.wind); });
  var ys=Object.keys(Y).sort(function(a,b){ return b-a; }); if(!ys.length) return null;
  var c=h('section',{class:'card lycard'},h('h2',{text:T('Πέρσι τέτοια μέρα (±7 ημέρες)','Around this date in past years (±7 days)')}));
  ys.forEach(function(y){ var o=Y[y], sp=Object.keys(o.sp).sort(function(a,b){ return o.sp[b]-o.sp[a]; }).slice(0,3).map(function(s){ return s+' ×'+o.sp[s]; }).join(', '), w=o.w.length?(U?U.wind(o.w.reduce(function(a,b){ return a+b; },0)/o.w.length):''):'';
    c.append(h('div',{class:'lyrow'},h('b',{text:y}),h('span',{text:o.n+T(' ψάρια',' catches')+(o.kg?' · '+B.num(o.kg,1)+' kg':'')+(sp?' · '+sp:'')+(w?' · '+T('άνεμος ','wind ')+w:'')}))); });
  return c;
};

/* ---------- επέτειοι: ειδοποίηση 7 μέρες πριν (ο service worker της ρίζας τη στέλνει, και με κλειστή εφαρμογή) ---------- */
var AN_DAYS=7;
function annivOn(){ return ls.get('psaro-anniv',true)!==false; }
function annivList(){
  var DN=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρι','Τετ','Πέμ','Παρ','Σάβ'], td=today(), y0=+td.slice(0,4), t0=Date.UTC(y0,+td.slice(5,7)-1,+td.slice(8,10)), W={}, thisMon=t0-((new Date(t0).getUTCDay()+6)%7)*86400000;
  B.store.bites().forEach(function(b){ if(!b||b.deleted||!b.date) return; var y=+b.date.slice(0,4), mo=+b.date.slice(5,7), d=+b.date.slice(8,10); if(!y||y>y0) return;
    var a=Date.UTC(y0,mo-1,d); if(a<thisMon) a=Date.UTC(y0+1,mo-1,d); if(new Date(a).getUTCFullYear()<=y) return; var mon=a-((new Date(a).getUTCDay()+6)%7)*86400000; if(mon-t0>60*86400000) return;
    var wk=W[mon]||(W[mon]={mon:mon,Y:{}}), o=wk.Y[y]||(wk.Y[y]={n:0,kg:0,D:{}}), dk=b.date.slice(0,10), dd=o.D[dk]||(o.D[dk]={n:0,sp:{},pl:{}});
    o.n++; o.kg+=+b.kg||0; dd.n++; if(b.species) dd.sp[b.species]=(dd.sp[b.species]||0)+1; if(b.place) dd.pl[b.place]=1;
    if(typeof b.lat==='number'&&typeof b.lon==='number'){ var L0=wk.L||(wk.L=[]), q=null; for(var i=0;i<L0.length;i++){ var dy=(L0[i].lat-b.lat)*111, dx=(L0[i].lon-b.lon)*111*Math.cos(b.lat*Math.PI/180); if(dx*dx+dy*dy<0.25){ q=L0[i]; break; } }
      if(!q){ q={lat:+b.lat.toFixed(5),lon:+b.lon.toFixed(5),name:b.place||'',n:0,d:{}}; L0.push(q); } q.n++; if(!q.name&&b.place) q.name=b.place; var qd=q.d[dk]||(q.d[dk]={n:0,kg:0,sp:{}}); qd.n++; qd.kg+=+b.kg||0; if(b.species) qd.sp[b.species]=(qd.sp[b.species]||0)+1; } });
  function dm(t){ var x=new Date(t); return x.getUTCDate()+'/'+(x.getUTCMonth()+1); }
  function iso(t){ return new Date(t).toISOString().slice(0,10); }
  function nf(n){ return n+(n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish')); }
  return Object.keys(W).sort().map(function(k){ var wk=W[k], sun=wk.mon+6*86400000, lines=[];
    Object.keys(wk.Y).sort(function(a,b){ return b-a; }).forEach(function(y){ var o=wk.Y[y], days=Object.keys(o.D).sort().map(function(dk){ var dd=o.D[dk], t=Date.UTC(+dk.slice(0,4),+dk.slice(5,7)-1,+dk.slice(8,10)), sp=Object.keys(dd.sp).sort(function(a,b){ return dd.sp[b]-dd.sp[a]; }).slice(0,3).map(function(x){ return x+(dd.sp[x]>1?' ×'+dd.sp[x]:''); }).join(', '), pl=Object.keys(dd.pl)[0]||'';
        return DN[new Date(t).getUTCDay()]+' '+dm(t)+': '+(sp||nf(dd.n))+(pl?' ('+pl+')':''); });
      lines.push(y+' · '+nf(o.n)+(o.kg?', '+(Math.round(o.kg*10)/10)+' kg':'')+'\n  '+days.join('\n  ')); });
    var locs=(wk.L||[]).sort(function(a,b){ return b.n-a.n; }).slice(0,6).map(function(q){ var ds=Object.keys(q.d).sort().reverse().slice(0,2).map(function(dk){ var t=Date.UTC(+dk.slice(0,4),+dk.slice(5,7)-1,+dk.slice(8,10)); return DN[new Date(t).getUTCDay()]+' '+dm(t)+'/'+dk.slice(2,4); }).join(', ');
      var det=Object.keys(q.d).sort().reverse().map(function(dk){ var x=q.d[dk], t=Date.UTC(+dk.slice(0,4),+dk.slice(5,7)-1,+dk.slice(8,10)), sp=Object.keys(x.sp).sort(function(a,b){ return x.sp[b]-x.sp[a]; }).map(function(z){ return z+(x.sp[z]>1?' ×'+x.sp[z]:''); }).join(', ');
        return DN[new Date(t).getUTCDay()]+' '+dm(t)+'/'+dk.slice(0,4)+' · '+nf(x.n)+(x.kg?', '+(Math.round(x.kg*10)/10)+' kg':'')+(sp?' · '+sp:''); });
      return {det:det,lat:q.lat,lon:q.lon,name:q.name,label:(q.name||T('Σημείο','Spot'))+' · '+ds+' · '+nf(q.n)}; });
    return {locs:locs,id:'annivw-'+iso(wk.mon),due:iso(wk.mon-AN_DAYS*86400000),ann:iso(wk.mon),end:iso(sun),title:T('η εβδομάδα ','the week of ')+DN[1]+' '+dm(wk.mon)+' – '+DN[0]+' '+dm(sun)+T(' τα προηγούμενα χρόνια',' in past years'),body:lines.join('\n')}; });
}
function annivSync(){ if(!('caches' in window)) return; caches.open('psaro-cfg').then(function(c){ return c.put(new URL('__anniv',ROOT).href,new Response(JSON.stringify({on:annivOn(),lang:EN?'en':'el',items:annivOn()?annivList():[]}))); })
  .then(function(){ return navigator.serviceWorker&&navigator.serviceWorker.getRegistration(ROOT); }).then(function(reg){ if(annivOn()&&reg&&reg.active&&('Notification' in window)&&Notification.permission==='granted') reg.active.postMessage({annivCheck:1}); }).catch(function(){}); }
var anT=null; B.on('store',function(k){ if(k==='psaro-bites'){ clearTimeout(anT); anT=setTimeout(annivSync,1500); } }); setTimeout(annivSync,4000);

/* ---------- «ίδιες συνθήκες με παλιά ψαριά» (ειδοποίηση μέσω του service worker της ρίζας) ---------- */
var SIM_KEY='psaro-simseen';
function simMin(){ var v=+ls.get('psaro-simmin',80); return (v>=60&&v<=95?v:80)/100; }
function simOn(){ return ls.get('psaro-simnote',true)!==false; }
var DIR8=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function d8(g){ return g==null?'':DIR8[Math.round(((g%360)+360)%360/45)%8]; }
var PTN={fast:T('πέφτει γρήγορα','falling fast'),slow:T('πέφτει αργά','falling slowly'),stable:T('σταθερή','steady'),rise:T('ανεβαίνει','rising')};
var MPH=EN?['new moon','waxing crescent','first quarter','waxing gibbous','full moon','waning gibbous','last quarter','waning crescent']:['νέα σελήνη','αύξων μηνίσκος','πρώτο τέταρτο','αύξουσα αμφίκυρτη','πανσέληνος','φθίνουσα αμφίκυρτη','τελευταίο τέταρτο','φθίνων μηνίσκος'];
function phName(f){ return MPH[Math.floor(((f%1)+1)%1*8+0.5)%8]; }
function bHour(b){ var m=/^(\d{1,2})/.exec(b.time||''); return m?Math.min(23,+m[1]):7; }
function bMs(b){ var hr=bHour(b); return Date.UTC(+b.date.slice(0,4),+b.date.slice(5,7)-1,+b.date.slice(8,10),hr-2); }
function circ(a,b,p){ var d=Math.abs(a-b)%p; return Math.min(d,p-d); }
function simScore(b,x,f){ var parts=[], add=function(w,v){ if(v!=null&&!isNaN(v)) parts.push([w,Math.max(0,Math.min(1,v))]); }, bf=null; try{ bf=PF.moonPhase(bMs(b)).f; }catch(e){}
  if(bf!=null&&f!=null) add(0.25,1-circ(bf,f,1)/0.125); if(b.wind!=null&&x.wind!=null) add(0.2,1-Math.abs(b.wind-x.wind)/6);
  if(b.wdeg!=null&&x.dir!=null&&(b.wind||0)>=4&&(x.wind||0)>=4) add(0.15,1-circ(b.wdeg,x.dir,360)/90); if(b.wave!=null&&x.wave!=null) add(0.15,1-Math.abs(b.wave-x.wave)/0.5);
  if(b.ptrend&&x.ptrend) add(0.15,b.ptrend===x.ptrend?1:((b.ptrend==='slow'||b.ptrend==='stable')&&(x.ptrend==='slow'||x.ptrend==='stable'))?0.6:0); if(b.sst!=null&&x.sst!=null) add(0.1,1-Math.abs(b.sst-x.sst)/2);
  var W=parts.reduce(function(a,q){ return a+q[0]; },0); if(W<0.55) return null; return parts.reduce(function(a,q){ return a+q[0]*q[1]; },0)/W; }
function simText(x){
  var b=x.b, hh0=x.h, DN=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρι','Τετ','Πέμ','Παρ','Σάβ'], dt=new Date(x.d.date+'T12:00:00Z'), bd=new Date(b.date+'T12:00:00Z');
  var dLab=DN[dt.getUTCDay()]+' '+dt.getUTCDate()+'/'+(dt.getUTCMonth()+1), bLab=DN[bd.getUTCDay()]+' '+bd.getUTCDate()+'/'+(bd.getUTCMonth()+1)+'/'+b.date.slice(0,4);
  var same=B.store.bites().filter(function(z){ return !z.deleted&&z.date===b.date&&typeof z.lat==='number'&&Math.abs(z.lat-b.lat)<0.02&&Math.abs(z.lon-b.lon)<0.02; }), sp={};
  same.forEach(function(z){ if(z.species) sp[z.species]=(sp[z.species]||0)+1; }); var spT=Object.keys(sp).map(function(k){ return k+(sp[k]>1?' ×'+sp[k]:''); }).join(', ');
  var hh=B.pad(bHour(b))+':00', bf=null; try{ bf=PF.moonPhase(bMs(b)).f; }catch(e){}
  var w=function(v){ return U&&U.wind?U.wind(v):Math.round(v)+' kn'; }, wv=function(v){ return U&&U.wave?U.wave(v):v.toFixed(1)+' m'; }, tp=function(v){ return U&&U.temp?U.temp(v):Math.round(v)+'°'; }, L2=[];
  if(bf!=null) L2.push(T('Σελήνη: ','Moon: ')+phName(x.d.f)+(phName(x.d.f)===phName(bf)?T(' (ίδια με τότε)',' (same as then)'):T(' (τότε ',' (then ')+phName(bf)+')'));
  if(b.wind!=null&&hh0.wind!=null) L2.push(T('Άνεμος: ','Wind: ')+d8(hh0.dir)+' '+w(hh0.wind)+T(' (τότε ',' (then ')+(b.wdeg!=null?d8(b.wdeg)+' ':'')+w(b.wind)+')');
  if(b.wave!=null&&hh0.wave!=null) L2.push(T('Κύμα: ','Waves: ')+wv(hh0.wave)+T(' (τότε ',' (then ')+wv(b.wave)+')');
  if(b.ptrend&&hh0.ptrend) L2.push(T('Πίεση: ','Pressure: ')+PTN[hh0.ptrend]+(hh0.ptrend===b.ptrend?T(' (όπως τότε)',' (as then)'):T(' (τότε ',' (then ')+PTN[b.ptrend]+')'));
  if(b.sst!=null&&hh0.sst!=null) L2.push(T('Νερό: ','Water: ')+tp(hh0.sst)+T(' (τότε ',' (then ')+tp(b.sst)+')');
  var pl=b.place||'', n=same.length||1, title=dLab+T(' μοιάζει με τη μέρα της ψαριάς ',' looks like your catch day ')+bLab+' · '+Math.round(x.sc*100)+'%';
  var body=T('Τότε: ','Then: ')+n+(n>1?T(' ψάρια',' fish'):T(' ψάρι',' fish'))+(spT?' ('+spT+')':'')+(pl?T(' στο ',' at ')+pl:'')+T(', γύρω στις ',', around ')+hh+'.\n'+T('Πρόγνωση για ','Forecast for ')+dLab+' '+hh+':\n'+L2.join('\n');
  var det=[bLab+' · '+n+(n>1?T(' ψάρια',' fish'):T(' ψάρι',' fish'))+(spT?' · '+spT:''),T('Ίδιες συνθήκες: ','Similar conditions: ')+dLab+' '+hh+' ('+Math.round(x.sc*100)+'%)'];
  return {title:title,body:body,locs:[{lat:+b.lat.toFixed(5),lon:+b.lon.toFixed(5),name:pl,label:(pl||T('Σημείο','Spot'))+' · '+bLab,det:det}]};
}
function simNotify(x){ var m=simText(x), id='sim-'+x.key.replace(/[^0-9|]/g,'').replace('|','-');
  return navigator.serviceWorker.getRegistration(ROOT).then(function(reg){ if(reg&&reg.active){ reg.active.postMessage({localMsg:{id:id,title:m.title,body:m.body,full:m.body,kind:'good',tag:id,locs:m.locs,notify:('Notification' in window)&&Notification.permission==='granted'}}); } else B.toast(m.title); }).catch(function(){ B.toast(m.title); }); }
var simBusy=false;
function simCheck(force){
  if(simBusy||!simOn()||!window.PF||!PF.getForecast) return Promise.resolve(null); var last=ls.get('psaro-simlast',0); if(!force&&Date.now()-last<6*3600000) return Promise.resolve(null);
  simBusy=true; ls.set('psaro-simlast',Date.now());
  var td=today(), y0=+td.slice(0,4), t0=Date.UTC(y0,+td.slice(5,7)-1,+td.slice(8,10));
  var cand=B.store.bites().filter(function(b){ if(!b||b.deleted||!b.date||typeof b.lat!=='number'||typeof b.lon!=='number'||+b.date.slice(0,4)>=y0) return false; if(b.wind==null&&b.wave==null&&!b.ptrend) return false;
    var a=Date.UTC(y0,+b.date.slice(5,7)-1,+b.date.slice(8,10)), dd=(a-t0)/86400000; if(dd<-180) dd+=365; if(dd>180) dd-=365; return dd>=-29&&dd<=36; });
  if(!cand.length){ simBusy=false; return Promise.resolve([]); }
  var G=[]; cand.forEach(function(b){ var g=null; for(var i=0;i<G.length;i++){ var dy=(G[i].lat-b.lat)*111, dx=(G[i].lon-b.lon)*111*Math.cos(b.lat*Math.PI/180); if(dx*dx+dy*dy<4){ g=G[i]; break; } } if(!g){ g={lat:b.lat,lon:b.lon,bs:[]}; G.push(g); } g.bs.push(b); });
  G.sort(function(a,b){ return b.bs.length-a.bs.length; }); G=G.slice(0,3);
  var best=[], seen=ls.get(SIM_KEY,{})||{}, p=Promise.resolve();
  G.forEach(function(g){ p=p.then(function(){ return PF.getForecast(g.lat,g.lon,undefined,{days:7}).then(function(fc){ if(!fc||!fc.days) return;
    fc.days.forEach(function(d,di){ if(di<1||!d.hours) return; var dt=Date.parse(d.date+'T00:00:00Z');
      g.bs.forEach(function(b){ var a=Date.UTC(+d.date.slice(0,4),+b.date.slice(5,7)-1,+b.date.slice(8,10)), dd=Math.abs(a-dt)/86400000; if(dd>182) dd=365-dd; if(dd>30) return;
        var hr=bHour(b), x=d.hours.filter(function(q){ return q.hr===hr; })[0]; if(!x||x.safe===false) return; var sc=simScore(b,x,d.f); if(sc==null||sc<simMin()) return;
        var key=d.date+'|'+b.date; if(seen[key]||Object.keys(seen).some(function(k){ return k.split('|')[1]===b.date&&Date.now()-seen[k]<14*86400000; })) return; best.push({sc:sc,d:d,h:x,b:b,key:key,g:g}); }); }); }).catch(function(){}); }); });
  return p.then(function(){ best.sort(function(a,b){ return b.sc-a.sc; }); var byDay={}, byB={}, out=[]; best.forEach(function(x){ if(!byDay[x.d.date]&&!byB[x.b.date]){ byDay[x.d.date]=1; byB[x.b.date]=1; out.push(x); } }); out=out.slice(0,2);
    var q=Promise.resolve(); out.forEach(function(x){ q=q.then(function(){ return simNotify(x); }); });
    return q.then(function(){ if(out.length){ out.forEach(function(x){ seen[x.key]=Date.now(); }); Object.keys(seen).forEach(function(k){ if(Date.now()-seen[k]>40*86400000) delete seen[k]; }); ls.set(SIM_KEY,seen); } simBusy=false; return out; }); }).catch(function(){ simBusy=false; return null; });
}
setTimeout(function(){ simCheck(); },9000); setInterval(function(){ if(!document.hidden) simCheck(); },3*3600000);

/* ---------- ρυθμίσεις (για τη σελίδα Ειδοποιήσεις και Σκάφος) ---------- */
B.smart={state:function(){ return load(); },save:function(s){ ls.set(KEY,s); S=load(); rt(); },setHome:setHome,offerHome:offerHome,fixNow:fixNow,findPort:findPort,rt:rt,checklist:openCl,clCount:function(){ S=load(); return clCount(); },
  annivOn:annivOn,setAnniv:function(v){ ls.set('psaro-anniv',!!v); annivSync(); },simOn:simOn,simMin:simMin,setSim:function(v){ ls.set('psaro-simnote',!!v); if(v) simCheck(true); },setSimMin:function(v){ ls.set('psaro-simmin',+v); simCheck(true); },autoStart:autoStart,autoStop:autoStop};
window.PsaroSmart={setHome:setHome,state:load,rt:rt};
})();
