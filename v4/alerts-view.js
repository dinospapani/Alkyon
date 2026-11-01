/* BiteCast 4 · Ειδοποιήσεις (#alerts): καλές μέρες, πίεση, καμπές πίεσης, τοποθεσίες, δοκιμή, ιστορικό.
   Η συνδρομή push ανήκει στον service worker της ρίζας (τον ίδιο με την κλασική), ώστε οι ειδοποιήσεις
   να έρχονται και με κλειστή εφαρμογή. Ίδιες ρυθμίσεις (psaro-notify), ίδιος πίνακας (push_subs), ίδιο psaro-cfg. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls, root=null, msg='', hist=null;
var ROOT=new URL('../',location.href).href;
function nt(){ return Object.assign({on:false,threshold:75,notified:{},server:false,gpsWatch:true,pressure:true,turn:false},ls.get('psaro-notify',{})); }
function setNt(o){ ls.set('psaro-notify',o); }
function places(){ var g=B.lastPos(), a=(ls.get('psaro-places',[])||[]).slice(); if(g) a.unshift({id:'gps',name:T('Η θέση μου','My location'),lat:g.lat,lon:g.lon,watch:nt().gpsWatch!==false}); return a; }
function cfgPlaces(){ return places().map(function(p){ return {id:p.id,name:p.name,lat:+(+p.lat).toFixed(3),lon:+(+p.lon).toFixed(3),watch:p.watch!==false}; }); }
function spCfg(){ var n=ls.get('psaro-advsp',''); if(!n) return null; var e=(window.SPKB||[]).filter(function(k){ return k.n===n; })[0]; return e?{n:e.n,l:e.l,sst:e.sst}:{n:n}; }
function wwCfg(){ var w=ls.get('psaro-wwatch',null); return w&&w.on?{deg:w.deg||60,kn:w.kn||6,hours:w.hours||6}:null; }
function reg(){ if(!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.getRegistration(ROOT).then(function(r){ return r||navigator.serviceWorker.register('../sw.js',{scope:'../'}).then(function(){ return navigator.serviceWorker.getRegistration(ROOT); }); }).catch(function(){ return null; }); }
function b64u(s){ var p='='.repeat((4-s.length%4)%4), r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(r,function(c){ return c.charCodeAt(0); }); }
function subId(sub){ return crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub.endpoint)).then(function(buf){ return Array.prototype.map.call(new Uint8Array(buf),function(b){ return ('0'+b.toString(16)).slice(-2); }).join('').slice(0,40); }); }
function vapid(){ if(window.VAPID_PUBLIC) return Promise.resolve(window.VAPID_PUBLIC); return new Promise(function(res){ var s=document.createElement('script'); s.src='../push-config.js'; s.onload=function(){ res(window.VAPID_PUBLIC||null); }; s.onerror=function(){ res(null); }; document.head.appendChild(s); }); }
function getSub(create){ return Promise.all([reg(),vapid()]).then(function(a){ var r=a[0], key=a[1]; if(!r||!r.pushManager||!key) return null;
  return r.pushManager.getSubscription().then(function(sub){ if(sub||!create) return sub; return r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)}); }); }); }
function writeCfg(){ var n=nt(), cfg={sp:spCfg(),lang:B.LANG,on:n.on,threshold:n.threshold,pressure:n.pressure!==false,turn:!!n.turn,wind:wwCfg(),notified:n.notified,server:!!n.server,places:cfgPlaces()};
  return caches.open('psaro-cfg').then(function(c){ return c.put(new URL('__cfg',ROOT).href,new Response(JSON.stringify(cfg))); }).catch(function(){}); }
function pushServer(){ var cl=B.cloud&&B.cloud.session()?B.cloud:null; if(!cl) return Promise.resolve(false); var n=nt();
  return getSub(true).then(function(sub){ if(!sub) return false; return subId(sub).then(function(id){
    var body={id:id,sub:sub.toJSON(),places:cfgPlaces().map(function(p){ p.lang=B.LANG; var sc=spCfg(); if(sc) p.sp=sc; return p; }),threshold:n.threshold,checked_at:null,updated_at:new Date().toISOString()}, H={Prefer:'resolution=merge-duplicates,return=minimal'};
    return cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:n.pressure!==false,wind:wwCfg(),turn:!!n.turn},body))})
      .catch(function(){ return cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:n.pressure!==false},body))}); })
      .catch(function(){ return cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(body)}); }).then(function(){ return true; }); }); }).catch(function(){ return false; }); }
function dropServer(){ var cl=B.cloud&&B.cloud.session()?B.cloud:null; if(!cl) return Promise.resolve();
  return getSub(false).then(function(sub){ if(!sub) return; return subId(sub).then(function(id){ return cl.rest('push_subs?id=eq.'+id,{method:'DELETE'}); }); }).catch(function(){}); }
function sync(){ var n=nt(); if(!n.on){ return writeCfg(); } msg=T('Ενημέρωση…','Updating…'); draw();
  return pushServer().then(function(ok){ var q=nt(); q.server=ok; q.sig=sig(); setNt(q); return writeCfg().then(function(){ msg=ok?T('Ενεργό. Ο server ελέγχει την πρόγνωση περίπου κάθε 3 ώρες και σου στέλνει ειδοποίηση ακόμα και με κλειστή εφαρμογή.','On. The server checks the forecast about every 3 hours and notifies you even with the app closed.')
    :(B.cloud&&B.cloud.session()?T('Ενεργό μόνο όταν ανοίγεις την εφαρμογή. Ο server δεν δέχτηκε τη συνδρομή.','On only when you open the app. The server did not accept the subscription.'):T('Ενεργό μόνο όταν ανοίγεις την εφαρμογή. Συνδέσου για ειδοποιήσεις με κλειστή εφαρμογή.','On only when you open the app. Sign in for alerts with the app closed.')); draw(); }); }); }

function draw(){
  if(!root) return;
  var n=nt(), page=h('div',{class:'page'});
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω','Back'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Ειδοποιήσεις','Alerts')}))));
  var c=h('section',{class:'card'}), perm=('Notification' in window)?Notification.permission:'denied';
  var on=h('input',{type:'checkbox',checked:!!n.on}); on.addEventListener('change',function(){ var q=nt();
    if(on.checked){ if(!('Notification' in window)){ on.checked=false; B.toast(T('Αυτός ο browser δεν υποστηρίζει ειδοποιήσεις.','This browser does not support notifications.')); return; }
      Notification.requestPermission().then(function(p){ if(p!=='granted'){ on.checked=false; B.toast(T('Δεν δόθηκε άδεια για ειδοποιήσεις. Άλλαξέ το από τις ρυθμίσεις του browser.','Notification permission was denied. Change it in the browser settings.')); return; } q.on=true; q.notified={}; setNt(q); periodic(true); sync().then(localCheck); }); }
    else { q.on=false; q.server=false; setNt(q); periodic(false); dropServer().then(writeCfg); msg=''; draw(); } });
  c.append(h('label',{class:'tg'},on,h('span',{text:T('Ειδοποιήσεις πρόγνωσης σε αυτό το κινητό','Forecast alerts on this phone')})),h('p',{class:'sub',text:msg||(n.on?(n.server?T('Ενεργό, και με κλειστή εφαρμογή.','On, even with the app closed.'):T('Ενεργό όταν ανοίγεις την εφαρμογή.','On when you open the app.')):T('Καλές μέρες, απότομες αλλαγές πίεσης και καμπές. Όταν είναι κλειστό, δεν στέλνεται καμία.','Good days, sharp pressure changes and turning points. When off, none are sent.'))}));
  if(perm==='denied'&&n.on) c.append(h('p',{class:'err',text:T('Ο browser έχει μπλοκάρει τις ειδοποιήσεις για το BiteCast.','The browser has blocked notifications for BiteCast.')}));
  page.append(c);
  var c2=h('section',{class:'card'+(n.on?'':' dim')},h('h2',{text:T('Τι να σου στέλνει','What to send')}));
  var thr=h('select',{class:'select'}); [65,70,75,80,85].forEach(function(v){ thr.append(h('option',{value:String(v),text:String(v)})); }); thr.value=String(n.threshold||75);
  thr.addEventListener('change',function(){ var q=nt(); q.threshold=+thr.value; q.notified={}; setNt(q); sync(); });
  var pr=h('input',{type:'checkbox',checked:n.pressure!==false}); pr.addEventListener('change',function(){ var q=nt(); q.pressure=pr.checked; setNt(q); sync(); });
  var tu=h('input',{type:'checkbox',checked:!!n.turn}); tu.addEventListener('change',function(){ var q=nt(); q.turn=tu.checked; q.notified={}; setNt(q); sync(); });
  c2.append(h('label',{class:'fld'},h('span',{text:T('Καλή μέρα: ελάχιστος δείκτης','Good day: minimum index')}),thr),h('label',{class:'tg'},pr,h('span',{text:T('Απότομες αλλαγές πίεσης','Sharp pressure changes')})),h('label',{class:'tg'},tu,h('span',{text:T('Καμπές της πίεσης (πριν και μόλις αρχίσει άνοδος ή πτώση)','Pressure turning points (before and as a rise or fall starts)')})));
  page.append(c2);
  /* τοποθεσίες */
  var c3=h('section',{class:'card'+(n.on?'':' dim')},h('h2',{text:T('Για ποιες τοποθεσίες','For which places')}),h('p',{class:'sub',style:{margin:'-4px 0 8px'},text:T('Προσθέτεις τοποθεσίες από την Πρόγνωση.','Add places from the Forecast.')}));
  places().forEach(function(p){ var sw=h('input',{type:'checkbox',checked:p.watch!==false}); sw.addEventListener('change',function(){ if(p.id==='gps'){ var q=nt(); q.gpsWatch=sw.checked; setNt(q); } else { var a=ls.get('psaro-places',[])||[]; a.forEach(function(x){ if(x.id===p.id) x.watch=sw.checked; }); ls.set('psaro-places',a); } sync(); });
    c3.append(h('label',{class:'tg'},sw,h('span',{text:p.name}))); });
  page.append(c3);
  page.append(h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Δοκιμαστική ειδοποίηση','Test notification'),onclick:function(){ if(!('Notification' in window)||Notification.permission!=='granted'){ B.toast(T('Άνοιξε πρώτα τις ειδοποιήσεις.','Turn on notifications first.')); return; }
    reg().then(function(r){ var t=T('Δοκιμή BiteCast','BiteCast test'), b=T('Οι ειδοποιήσεις δουλεύουν.','Notifications work.'); if(r) r.showNotification(t,{body:b,icon:'../icon-192.png',tag:'bc-test',data:{url:ROOT,bc:{kind:'info',full:b}}}); else new Notification(t,{body:b}); }); }})));
  /* αλλαγή ανέμου (ίδια λειτουργία με την κλασική, windwatch.js) */
  if(window.PsaroWindWatch){ var wcfg=Object.assign({on:false,deg:60,kn:6,hours:6},ls.get('psaro-wwatch',{})||{}), wmsg=h('p',{class:'sub',role:'status',text:wcfg.on?T('Ενεργό.','Active.'):''});
    function wsave(){ ls.set('psaro-wwatch',wcfg); writeCfg(); }
    var won=h('input',{type:'checkbox',checked:!!wcfg.on,onchange:function(ev){ wcfg.on=ev.target.checked; wsave(); if(wcfg.on){ try{ if('Notification' in window&&Notification.permission==='default') Notification.requestPermission(); }catch(e){} PsaroWindWatch.check(false); } wmsg.textContent=wcfg.on?T('Ενεργό.','Active.'):T('Κλειστό.','Off.'); }});
    var wsel=h('select',{class:'select'}); [['45',T('Μεγάλη (45° ή 4 kn)','High (45° or 4 kn)')],['60',T('Μέτρια (60° ή 6 kn)','Medium (60° or 6 kn)')],['90',T('Μικρή (90° ή 8 kn)','Low (90° or 8 kn)')]].forEach(function(o){ wsel.append(h('option',{value:o[0],text:o[1]})); }); wsel.value=String(wcfg.deg);
    wsel.addEventListener('change',function(){ var v=+wsel.value; wcfg.deg=v; wcfg.kn=v===45?4:v===60?6:8; wsave(); });
    page.append(h('section',{class:'card'},h('h2',{text:T('Αλλαγή ανέμου','Wind change')}),h('label',{class:'tg'},won,h('span',{text:T('Ειδοποίησέ με όταν αλλάζει ο άνεμος (διεύθυνση ή ένταση)','Notify me when the wind changes (direction or speed)')})),
      h('label',{class:'fld'},h('span',{text:T('Ευαισθησία','Sensitivity')}),wsel),h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Έλεγχος τώρα','Check now'),onclick:function(){ wmsg.textContent=T('Έλεγχος…','Checking…'); PsaroWindWatch.check(true).then(function(r){ wmsg.textContent=!r?T('Δεν έγινε έλεγχος.','No check made.'):r.err?r.err:r.none?T('Καμία σημαντική αλλαγή ανέμου στις επόμενες ώρες.','No significant wind change in the next hours.'):r.d.title+': '+r.d.body; }); }})),wmsg,
      h('p',{class:'sub',text:T('Με ανοιχτή εφαρμογή ελέγχει κάθε ~20 λεπτά. Με ενεργές τις ειδοποιήσεις πρόγνωσης, ο server ελέγχει και με κλειστή εφαρμογή.','While the app is open it checks every ~20 minutes. With forecast alerts on, the server also checks with the app closed.')}))); }
  /* επέτειοι και «ίδιες συνθήκες» (κοινές ρυθμίσεις με την κλασική) */
  if(B.smart){ var M=B.smart, an=h('input',{type:'checkbox',checked:M.annivOn(),onchange:function(ev){ M.setAnniv(ev.target.checked); }}), si=h('input',{type:'checkbox',checked:M.simOn(),onchange:function(ev){ M.setSim(ev.target.checked); sr.hidden=!ev.target.checked; }});
    var ss=h('select',{class:'select'}); [70,75,80,85,90].forEach(function(v){ ss.append(h('option',{value:String(v),text:v+'%'+(v===80?T(' (προτείνεται)',' (recommended)'):'')})); }); ss.value=String(Math.round(M.simMin()*100)); ss.addEventListener('change',function(){ M.setSimMin(+ss.value); });
    var sr=h('label',{class:'fld',hidden:!M.simOn()},h('span',{text:T('Ελάχιστη ομοιότητα','Minimum similarity')}),ss);
    page.append(h('section',{class:'card'},h('h2',{text:T('Από τα δικά σου ψάρια','From your own catches')}),
      h('label',{class:'tg'},an,h('span',{text:T('Ειδοποίησέ με 7 μέρες πριν από μέρες που είχα πιάσει ψάρια σε προηγούμενες χρονιές','Notify me 7 days before dates when I caught fish in past years')})),
      h('label',{class:'tg'},si,h('span',{text:T('Ειδοποίησέ με όταν έρχεται μέρα με ίδιες συνθήκες με παλιά ψαριά (σελήνη, άνεμος, κύμα, πίεση, νερό)','Notify me when a coming day has the same conditions as a past catch (moon, wind, waves, pressure, water)')})),sr)); }
  /* ειδοποιήσεις καιρού όσο είναι ανοιχτή η εφαρμογή (κοινή ρύθμιση με την κλασική) */
  if(B.wxAlerts){ var wa=h('input',{type:'checkbox',checked:B.wxAlerts.on(),onchange:function(ev){ B.wxAlerts.set(ev.target.checked); }});
    page.append(h('section',{class:'card'},h('h2',{text:T('Καιρός κατά το ψάρεμα','Weather while fishing')}),h('label',{class:'tg'},wa,h('span',{text:T('Ειδοποίηση όταν δυναμώνει ο άνεμος ή το κύμα, και πριν από καλή ώρα ψαρέματος','Alert when wind or waves pick up, and before a good fishing window')})),h('p',{class:'sub',text:T('Λειτουργεί όσο η εφαρμογή είναι ανοιχτή (και στο παρασκήνιο κατά την έξοδο).','Works while the app is open (and in the background during a trip).')}))); }
  /* ιστορικό */
  var c4=h('section',{class:'card'},h('h2',{text:T('Ιστορικό','History')}));
  if(hist==null){ c4.append(h('div',{class:'sk',style:{height:'60px'}})); loadHist(); }
  else if(!hist.length) c4.append(h('p',{class:'sub',text:T('Δεν υπάρχουν ειδοποιήσεις ακόμα.','No notifications yet.')}));
  else { var l=h('div',{class:'mini-list'}); hist.slice(0,60).forEach(function(x){ l.append(h('div',{class:'nrow'},h('b',{text:x.title||''}),h('span',{class:'sub',text:new Date(x.at).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}),h('p',{text:x.full||x.body||''}))); }); c4.append(l); }
  page.append(c4);
  root.replaceChildren(page);
}
function loadHist(){
  var loc=caches.open('psaro-cfg').then(function(c){ return c.match(new URL('__inbox',ROOT).href); }).then(function(r){ return r?r.json():[]; }).catch(function(){ return []; });
  var cl=B.cloud&&B.cloud.session()?B.cloud:null, srv=cl?cl.rest('notif_log?select=id,at,kind,title,body,details,place,t&order=at.desc&limit=200').then(function(r){ return r.json(); }).then(function(a){ return (a||[]).map(function(x){ x.full=x.details||x.body; return x; }); }).catch(function(){ return []; }):Promise.resolve([]);
  Promise.all([loc,srv]).then(function(r){ var seen={}, all=[]; (Array.isArray(r[0])?r[0]:[]).concat(r[1]).forEach(function(x){ if(!x||!x.at) return; var k=(x.title||'')+String(x.at).slice(0,16); if(seen[k]) return; seen[k]=1; all.push(x); });
    hist=all.sort(function(a,b){ return String(b.at).localeCompare(String(a.at)); }); draw(); });
}
/* τοπικός έλεγχος όταν ανοίγει η εφαρμογή (όταν ο server δεν έχει τη συνδρομή) και περιοδικός στο παρασκήνιο, όπως η κλασική */
function note(title,body,m){ m=m||{}; return reg().then(function(r){ var o={body:body,tag:'bc-'+(m.kind||'info')+'-'+String(m.key||Date.now()).slice(-40),renotify:true,icon:'../icon-192.png',badge:'../icon-192.png',data:{url:ROOT,bc:{kind:m.kind||'info',id:m.key,full:m.full||body,place:m.place||null,t:m.t||null}}};
  if(r) return r.showNotification(title,o); new Notification(title,{body:body}); }).catch(function(){}); }
function localCheck(){ var n=nt(); if(!n.on||n.server||!('Notification' in window)||Notification.permission!=='granted'||!window.PF||!PF.checkPlaces) return;
  PF.checkPlaces({lang:B.LANG,places:cfgPlaces(),threshold:n.threshold,pressure:n.pressure!==false,turn:!!n.turn,wind:wwCfg(),notified:n.notified}).then(function(r){ var q=nt(); q.notified=r.notified; setNt(q); writeCfg();
    if(r.msgs&&r.msgs.length) r.msgs.forEach(function(m){ note(m.title,m.body,m); }); else if(r.items&&r.items.length) note(r.title,r.body); }).catch(function(){}); }
function periodic(on){ reg().then(function(r){ if(!r||!r.periodicSync) return; return on?r.periodicSync.register('psaro-forecast',{minInterval:12*3600*1000}):r.periodicSync.unregister('psaro-forecast'); }).catch(function(){}); }
function sig(){ var n=nt(); return JSON.stringify([n.threshold,n.pressure!==false,!!n.turn,wwCfg(),B.LANG,(spCfg()||{}).n||'',cfgPlaces().map(function(p){ return [p.id,+(+p.lat).toFixed(2),+(+p.lon).toFixed(2),p.watch!==false]; })]); }
function boot(){ var n=nt(); if(!n.on) return; writeCfg();
  if(B.cloud&&B.cloud.session()&&(n.sig!==sig()||!n.server)) pushServer().then(function(ok){ var q=nt(); q.server=ok; q.sig=sig(); setNt(q); writeCfg(); localCheck(); }); else localCheck(); }
setTimeout(boot,3000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden) localCheck(); });

B.view('alerts',{title:T('Ειδοποιήσεις','Alerts'),mount:function(el){ root=el; hist=null; msg=''; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
})();
