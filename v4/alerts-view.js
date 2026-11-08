/* Alkyon 4 · Ειδοποιήσεις (#alerts): καλές μέρες, πίεση, καμπές πίεσης, τοποθεσίες, δοκιμή, ιστορικό.
   Η συνδρομή push ανήκει στον service worker της ρίζας (τον ίδιο με την κλασική), ώστε οι ειδοποιήσεις
   να έρχονται και με κλειστή εφαρμογή. Ίδιες ρυθμίσεις (alkyon-notify), ίδιος πίνακας (push_subs), ίδιο alkyon-cfg. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, root=null, msg='', hist=null;
var ROOT=new URL('../',location.href).href;
/* 1.2.2: τα «Σημείο χάρτη» (Πρόγνωση εδώ από τον χάρτη) έστελναν ειδοποιήσεις. Μία φορά: κλείνουν οι ειδοποιήσεις τους (ανοίγουν ξανά από εδώ) */
(function(){ try{ if(ls.get('alkyon-mpfix',0)) return; var a=ls.get('alkyon-places',[])||[], ch=false;
  a.forEach(function(p){ if(p&&/^p-?\d+_-?\d+$/.test(String(p.id))&&(p.name==='Σημείο χάρτη'||p.name==='Map point')&&p.watch!==false){ p.watch=false; p.map=1; ch=true; } });
  if(ch) ls.set('alkyon-places',a); ls.set('alkyon-mpfix',1); }catch(e){} })();
function nt(){ return Object.assign({on:false,threshold:75,notified:{},server:false,gpsWatch:true,pressure:true,turn:false},ls.get('alkyon-notify',{})); }
function setNt(o){ ls.set('alkyon-notify',o); }
function places(){ var g=B.lastPos(), a=(ls.get('alkyon-places',[])||[]).slice(); if(g) a.unshift({id:'gps',name:T('Η θέση μου','My location'),lat:g.lat,lon:g.lon,watch:nt().gpsWatch!==false}); return a; }
function cfgPlaces(){ return places().map(function(p){ return {id:p.id,name:p.name,lat:+(+p.lat).toFixed(3),lon:+(+p.lon).toFixed(3),watch:p.watch!==false}; }); }
function spCfg(){ var n=ls.get('alkyon-advsp',''); if(!n) return null; var e=(window.SPKB||[]).filter(function(k){ return k.n===n; })[0]; return e?{n:e.n,l:e.l,sst:e.sst}:{n:n}; }
function wwCfg(){ var w=ls.get('alkyon-wwatch',null); return w&&w.on?{deg:w.deg||60,kn:w.kn||6,hours:w.hours||6}:null; }
function reg(){ if(!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.getRegistration(ROOT).then(function(r){ return r||navigator.serviceWorker.register('../sw.js',{scope:'../'}).then(function(){ return navigator.serviceWorker.getRegistration(ROOT); }); }).catch(function(){ return null; }); }
function b64u(s){ var p='='.repeat((4-s.length%4)%4), r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(r,function(c){ return c.charCodeAt(0); }); }
function subId(sub){ return crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub.endpoint)).then(function(buf){ return Array.prototype.map.call(new Uint8Array(buf),function(b){ return ('0'+b.toString(16)).slice(-2); }).join('').slice(0,40); }); }
function vapid(){ if(window.VAPID_PUBLIC) return Promise.resolve(window.VAPID_PUBLIC); return new Promise(function(res){ var s=document.createElement('script'); s.src='../push-config.js'; s.onload=function(){ res(window.VAPID_PUBLIC||null); }; s.onerror=function(){ res(null); }; document.head.appendChild(s); }); }
function getSub(create){ return Promise.all([reg(),vapid()]).then(function(a){ var r=a[0], key=a[1]; if(!r||!r.pushManager||!key) return null;
  return r.pushManager.getSubscription().then(function(sub){ if(sub||!create) return sub; return r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)}); }); }); }
function writeCfg(){ var n=nt(), cfg={limits:ls.get('alkyon-limits',null)||undefined,sp:spCfg(),lang:B.LANG,on:n.on,threshold:n.threshold,pressure:n.pressure!==false,turn:!!n.turn,wind:wwCfg(),notified:n.notified,server:!!n.server,quiet:n.quiet!==false,front:n.front!==false&&B.prof()!=='lake',plans:B.plans?B.plans.list():[],places:cfgPlaces(),pf:ls.get('alkyon-v4-pf','all'),tiles:B.tileTpl||null};
  return caches.open('alkyon-cfg').then(function(c){ return c.put(new URL('__cfg',ROOT).href,new Response(JSON.stringify(cfg))); }).catch(function(){}); }
function pushServer(){ var cl=B.cloud&&B.cloud.session()?B.cloud:null; if(!cl) return Promise.resolve(false); var n=nt();
  return getSub(true).then(function(sub){ if(!sub) return false; return subId(sub).then(function(id){
    var body={id:id,sub:sub.toJSON(),places:cfgPlaces().map(function(p){ p.lang=B.LANG; p.quiet=n.quiet===false?'off':'on'; p.morning=n.morning===false?'off':(n.morning===true||n.morning==null)?'eve':n.morning; p.front=(n.front!==false&&B.prof()!=='lake')?'on':'off'; p.comm=n.comm===false?'off':'on'; p.commre=n.commre===false?'off':'on'; /* 1.9.25 */ p.squid=n.squid===true?'on':'off'; /* 1.9.44 */ var sc=spCfg(); if(sc) p.sp=sc; /* v31z543: όρια και λιμάνι για ειδοποιήσεις κατά την έξοδο με κλειστό κινητό */ var lm=ls.get('alkyon-limits',null); if(lm) p.lim=lm; if(B.plans) p.plans=B.plans.list(); try{ var sm=B.smart&&B.smart.state(); if(sm&&sm.home) p.home={lat:+(+sm.home.lat).toFixed(4),lon:+(+sm.home.lon).toFixed(4),name:sm.home.name||'',kn:sm.cruise||15}; }catch(e){} return p; }),threshold:n.threshold,checked_at:null,updated_at:new Date().toISOString()}, H={Prefer:'resolution=merge-duplicates,return=minimal'};
    return cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:n.pressure!==false,wind:wwCfg(),turn:!!n.turn},body))})
      .catch(function(){ return cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:n.pressure!==false},body))}); })
      .catch(function(){ return cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(body)}); }).then(function(){ return true; }); }); }).catch(function(){ return false; }); }
B.pushSync=function(){ var n=nt(); writeCfg(); return n.on?pushServer():Promise.resolve(false); };
/* 1.0.0: νέα διεύθυνση (/Alkyon) → νέα συνδρομή push, μία φορά. Η άδεια ειδοποιήσεων μένει (ίδιος τόπος dinospapani.github.io). */
setTimeout(function(){ try{ if(ls.get('alkyon-moved-push',0)) return; var n=nt(); writeCfg(); if(!n.on||!('Notification' in window)||Notification.permission!=='granted') return; periodic(true); pushServer().then(function(ok){ if(ok){ ls.set('alkyon-moved-push',Date.now()); var q=nt(); q.server=true; setNt(q); } }); }catch(e){} },6000);
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
  if(perm==='denied'&&n.on) c.append(h('p',{class:'err',text:T('Ο browser έχει μπλοκάρει τις ειδοποιήσεις για το Alkyon.','The browser has blocked notifications for Alkyon.')}));
  page.append(c);
  var c2=h('section',{class:'card'+(n.on?'':' dim')},h('h2',{text:T('Τι να σου στέλνει','What to send')}));
  var thr=h('select',{class:'select'}); [65,70,75,80,85].forEach(function(v){ thr.append(h('option',{value:String(v),text:String(v)})); }); thr.value=String(n.threshold||75);
  thr.addEventListener('change',function(){ var q=nt(); q.threshold=+thr.value; q.notified={}; setNt(q); sync(); });
  var pr=h('input',{type:'checkbox',checked:n.pressure!==false}); pr.addEventListener('change',function(){ var q=nt(); q.pressure=pr.checked; setNt(q); sync(); });
  /* v31z539: ώρες ησυχίας 23:00–07:00 (οι ειδοποιήσεις ασφαλείας και εξόδου έρχονται πάντα) */
  var qu=h('input',{type:'checkbox',checked:n.quiet!==false}); qu.addEventListener('change',function(){ var q=nt(); q.quiet=qu.checked; setNt(q); sync(); });
  var quL=h('label',{class:'tg'},qu,h('span',null,T('Ησυχία τη νύχτα (23:00–07:00)','Quiet at night (23:00–07:00)'),h('small',{class:'tgs',text:T('Οι ειδοποιήσεις πρόγνωσης έρχονται στις 07:00. Οι ειδοποιήσεις ασφαλείας και εξόδου έρχονται πάντα.','Forecast alerts arrive at 07:00. Safety and trip alerts always come through.')})));
  /* 1.1.0 / 1.1.2: «Καλό ψάρεμα αύριο/σήμερα»: το προηγούμενο βράδυ (προεπιλογή), το πρωί, και τα δύο ή κλειστό */
  var mv=n.morning===false?'off':n.morning===true||n.morning==null?'eve':n.morning;
  var moL=h('div',{class:'tg moseg'},h('span',null,T('Μήνυμα για καλή μέρα','Message for a good day'),h('small',{class:'tgs',text:T('Μόνο όταν κάποια τοποθεσία σου έχει καλό βαθμό: ποια και ποια ώρα. Βράδυ = 19:00–23:00 για την επόμενη μέρα. Πρωί = 07:00–10:00 για σήμερα.','Only when one of your places scores well: which and when. Evening = 19:00–23:00 for the next day. Morning = 07:00–10:00 for today.')})),
    B.seg([['eve',T('Βράδυ','Evening')],['morn',T('Πρωί','Morning')],['both',T('Και τα 2','Both')],['off',T('Όχι','Off')]],mv,function(v){ var q=nt(); q.morning=v; setNt(q); sync(); },T('Πότε','When')));
  /* v31z545: μέτωπα θερμοκρασίας κοντά στις τοποθεσίες */
  var fr=h('input',{type:'checkbox',checked:n.front!==false}); fr.addEventListener('change',function(){ var q=nt(); q.front=fr.checked; setNt(q); sync(); });
  var frL=B.prof()==='lake'?null:h('label',{class:'tg'},fr,h('span',null,T('Μέτωπα θερμοκρασίας νερού','Water temperature fronts'),h('small',{class:'tgs',text:T('Όταν σχηματίζεται απότομη αλλαγή θερμοκρασίας κοντά στις τοποθεσίες σου (εκεί συχνά μαζεύονται πελαγικά).','When a sharp temperature change forms near your places (pelagics often gather there).')})));
  var tu=h('input',{type:'checkbox',checked:!!n.turn}); tu.addEventListener('change',function(){ var q=nt(); q.turn=tu.checked; q.notified={}; setNt(q); sync(); });
  c2.append(h('label',{class:'fld'},h('span',{text:T('Καλή μέρα: ελάχιστος δείκτης','Good day: minimum index')}),thr),h('label',{class:'tg'},pr,h('span',{text:T('Απότομες αλλαγές πίεσης','Sharp pressure changes')})),h('label',{class:'tg'},tu,h('span',{text:T('Καμπές της πίεσης (πριν και μόλις αρχίσει άνοδος ή πτώση)','Pressure turning points (before and as a rise or fall starts)')})));
  c2.append(quL,moL); if(frL) c2.append(frL);
  /* v31z541: «Ξεκινάς ψάρεμα;» όταν σταθείς σε σημείο σου (ακτή) */
  var asCard=null; if(B.autoStart){ var as=h('input',{type:'checkbox',checked:B.autoStart.on()}); as.addEventListener('change',function(){ B.autoStart.set(as.checked); });
    asCard=(h('section',{class:'card'},h('h2',{text:T('Αυτόματη έναρξη','Auto start')}),h('label',{class:'tg'},as,h('span',null,T('Ρώτα με αν ξεκινάω ψάρεμα όταν σταθώ σε σημείο μου','Ask me if I am starting to fish when I stop at one of my spots'),h('small',{class:'tgs',text:T('Για ψάρεμα από ακτή. Όταν η εφαρμογή είναι ανοιχτή και μείνεις ~2 λεπτά σε απόσταση έως 150 m από σημείο σου ή από μέρος που έχεις πιάσει ψάρια.','For shore fishing. When the app is open and you stay ~2 minutes within 150 m of one of your spots or a place where you caught fish.')}))))); }
  page.append(c2);
  if(asCard) page.append(asCard);
  /* v31z550: κατέβασμα χάρτη και πρόγνωσης πριν από μια έξοδο που σχεδίασες */
  if(B.prefetchRow) page.append(h('section',{class:'card'},h('h2',{text:T('Πριν την έξοδο','Before the trip')}),B.prefetchRow()));
  /* τοποθεσίες */
  var c3=h('section',{class:'card'+(n.on?'':' dim')},h('h2',{text:T('Για ποιες τοποθεσίες','For which places')}),h('p',{class:'sub',style:{margin:'-4px 0 8px'},text:T('Προσθέτεις τοποθεσίες από την Πρόγνωση.','Add places from the Forecast.')}));
  places().forEach(function(p){ var sw=h('input',{type:'checkbox',checked:p.watch!==false}); sw.addEventListener('change',function(){ if(p.id==='gps'){ var q=nt(); q.gpsWatch=sw.checked; setNt(q); } else { var a=ls.get('alkyon-places',[])||[]; a.forEach(function(x){ if(x.id===p.id) x.watch=sw.checked; }); ls.set('alkyon-places',a); } sync(); });
    c3.append(h('label',{class:'tg'},sw,h('span',{text:(p.id!=='gps'&&B.placeName)?B.placeName(p):p.name}))); });
  page.append(c3);
  page.append(h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Δοκιμαστική ειδοποίηση','Test notification'),onclick:function(){ if(!('Notification' in window)||Notification.permission!=='granted'){ B.toast(T('Άνοιξε πρώτα τις ειδοποιήσεις.','Turn on notifications first.')); return; }
    reg().then(function(r){ var t=T('Δοκιμή Alkyon','Alkyon test'), b=T('Οι ειδοποιήσεις δουλεύουν.','Notifications work.'); if(r) r.showNotification(t,{body:b,icon:'../icon-192.png',tag:'alk-test',data:{url:ROOT,bc:{kind:'info',full:b}}}); else new Notification(t,{body:b}); }); }})));
  /* αλλαγή ανέμου (ίδια λειτουργία με την κλασική, windwatch.js) */
  if(window.AlkyonWindWatch){ var wcfg=Object.assign({on:false,deg:60,kn:6,hours:6},ls.get('alkyon-wwatch',{})||{}), wmsg=h('p',{class:'sub',role:'status',text:wcfg.on?T('Ενεργό.','Active.'):''});
    function wsave(){ ls.set('alkyon-wwatch',wcfg); writeCfg(); }
    var won=h('input',{type:'checkbox',checked:!!wcfg.on,onchange:function(ev){ wcfg.on=ev.target.checked; wsave(); if(wcfg.on){ try{ if('Notification' in window&&Notification.permission==='default') Notification.requestPermission(); }catch(e){} AlkyonWindWatch.check(false); } wmsg.textContent=wcfg.on?T('Ενεργό.','Active.'):T('Κλειστό.','Off.'); }});
    var wsel=h('select',{class:'select'}); [['45',T('Μεγάλη (45° ή 4 kn)','High (45° or 4 kn)')],['60',T('Μέτρια (60° ή 6 kn)','Medium (60° or 6 kn)')],['90',T('Μικρή (90° ή 8 kn)','Low (90° or 8 kn)')]].forEach(function(o){ wsel.append(h('option',{value:o[0],text:o[1]})); }); wsel.value=String(wcfg.deg);
    wsel.addEventListener('change',function(){ var v=+wsel.value; wcfg.deg=v; wcfg.kn=v===45?4:v===60?6:8; wsave(); });
    page.append(h('section',{class:'card'},h('h2',{text:T('Αλλαγή ανέμου','Wind change')}),h('label',{class:'tg'},won,h('span',{text:T('Ειδοποίησέ με όταν αλλάζει ο άνεμος (διεύθυνση ή ένταση)','Notify me when the wind changes (direction or speed)')})),
      h('label',{class:'fld'},h('span',{text:T('Ευαισθησία','Sensitivity')}),wsel),h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Έλεγχος τώρα','Check now'),onclick:function(){ wmsg.textContent=T('Έλεγχος…','Checking…'); AlkyonWindWatch.check(true).then(function(r){ wmsg.textContent=!r?T('Δεν έγινε έλεγχος.','No check made.'):r.err?r.err:r.none?T('Καμία σημαντική αλλαγή ανέμου στις επόμενες ώρες.','No significant wind change in the next hours.'):r.d.title+': '+r.d.body; }); }})),wmsg,
      h('p',{class:'sub',text:T('Με ανοιχτή εφαρμογή ελέγχει κάθε ~20 λεπτά. Με ενεργές τις ειδοποιήσεις πρόγνωσης, ο server ελέγχει και με κλειστή εφαρμογή.','While the app is open it checks every ~20 minutes. With forecast alerts on, the server also checks with the app closed.')}))); }
  /* επέτειοι και «ίδιες συνθήκες» (κοινές ρυθμίσεις με την κλασική) */
  if(B.smart){ var M=B.smart, an=h('input',{type:'checkbox',checked:M.annivOn(),onchange:function(ev){ M.setAnniv(ev.target.checked); }}), si=h('input',{type:'checkbox',checked:M.simOn(),onchange:function(ev){ M.setSim(ev.target.checked); sr.hidden=!ev.target.checked; }});
    var ss=h('select',{class:'select'}); [70,75,80,85,90].forEach(function(v){ ss.append(h('option',{value:String(v),text:v+'%'+(v===80?T(' (προτείνεται)',' (recommended)'):'')})); }); ss.value=String(Math.round(M.simMin()*100)); ss.addEventListener('change',function(){ M.setSimMin(+ss.value); });
    var sr=h('label',{class:'fld',hidden:!M.simOn()},h('span',{text:T('Ελάχιστη ομοιότητα','Minimum similarity')}),ss);
    page.append(h('section',{class:'card'},h('h2',{text:T('Από τα δικά σου ψάρια','From your own catches')}),
      h('label',{class:'tg'},an,h('span',{text:T('Ειδοποίησέ με 7 μέρες πριν από μέρες που είχα πιάσει ψάρια σε προηγούμενες χρονιές','Notify me 7 days before dates when I caught fish in past years')})),
      h('label',{class:'tg'},si,h('span',{text:T('Ειδοποίησέ με όταν έρχεται μέρα με ίδιες συνθήκες με παλιά ψαριά (σελήνη, άνεμος, κύμα, πίεση, νερό)','Notify me when a coming day has the same conditions as a past catch (moon, wind, waves, pressure, water)')})),sr)); }
  /* ειδοποιήσεις καιρού όσο είναι ανοιχτή η εφαρμογή (κοινή ρύθμιση με την κλασική) */
  if(B.limitsCard) page.append(B.limitsCard());
  if(B.zoneAlert){ var za=h('input',{type:'checkbox',checked:B.zoneAlert.on(),onchange:function(ev){ B.zoneAlert.set(ev.target.checked); }});
    page.append(h('section',{class:'card'},h('h2',{text:T('Απαγορευμένες περιοχές','Restricted areas')}),h('label',{class:'tg'},za,h('span',{text:T('Κατά την έξοδο, ειδοποίηση όταν πλησιάζεις (300 m) ή μπαίνεις σε περιοχή όπου απαγορεύεται η αλιεία','During a trip, alert when approaching (300 m) or entering an area where fishing is prohibited')})),h('p',{class:'sub',text:T('Περιοχές του Τμήματος Αλιείας (Κύπρος). Δεν αντικαθιστά τον επίσημο χάρτη.','Fisheries Department areas (Cyprus). Not a substitute for the official map.')}))); }
  if(B.wxAlerts){ var wa=h('input',{type:'checkbox',checked:B.wxAlerts.on(),onchange:function(ev){ B.wxAlerts.set(ev.target.checked); }});
    page.append(h('section',{class:'card'},h('h2',{text:T('Καιρός κατά το ψάρεμα','Weather while fishing')}),h('label',{class:'tg'},wa,h('span',{text:T('Ειδοποίηση όταν δυναμώνει ο άνεμος ή το κύμα, και πριν από καλή ώρα ψαρέματος','Alert when wind or waves pick up, and before a good fishing window')})),h('p',{class:'sub',text:T('Λειτουργεί όσο η εφαρμογή είναι ανοιχτή (και στο παρασκήνιο κατά την έξοδο).','Works while the app is open (and in the background during a trip).')}))); }
  /* 1.9.25: Κοινότητα: νέα ψάρια από άλλους, like/σχόλια στα δικά σου (push από τον server) */
  (function(){ function ck(k,lab){ return h('label',{class:'tg'},h('input',{type:'checkbox',checked:nt()[k]!==false,onchange:function(ev){ var q=nt(); q[k]=ev.target.checked; setNt(q); if(B.pushSync) B.pushSync(); }}),h('span',{text:lab})); }
    page.append(h('section',{class:'card'+(n.on?'':' dim')},h('h2',{text:T('Κοινότητα','Community')}),
      ck('comm',T('Νέο ψάρι από άλλον ψαρά','New catch from another angler')),
      ck('commre',T('Like ή σχόλιο σε δικό μου ψάρι','Like or comment on my catch')),
      h('p',{class:'sub',text:T('Όχι 23:00–07:00. Για τα νέα ψάρια, το πολύ μία ειδοποίηση ανά 30 λεπτά. Χρειάζεται λογαριασμός και ενεργές ειδοποιήσεις.','Not 23:00–07:00. For new catches, at most one alert every 30 minutes. Needs an account and alerts turned on.')}))); })();
  /* 1.9.44: καλαμάρια γύρω από τη νέα σελήνη (push από τον server· κλειστό μέχρι να το ανοίξεις) */
  (function(){ var nm=null; try{ nm=PF.nextMoon&&PF.nextMoon(Date.now()); }catch(e){}
    var c=h('input',{type:'checkbox',checked:nt().squid===true,onchange:function(ev){ var q=nt(); q.squid=ev.target.checked; setNt(q); if(B.pushSync) B.pushSync(); }});
    page.append(h('section',{class:'card'+(n.on?'':' dim')},h('h2',{text:T('Καλαμάρια και νέα σελήνη','Squid and the new moon')}),
      h('label',{class:'tg'},c,h('span',{text:T('Ειδοποίησέ με γύρω από τη νέα σελήνη, με το καλύτερο βράδυ και την καλύτερη ώρα για καλαμάρια (λίγος άνεμος, ήρεμη θάλασσα στο σούρουπο)','Notify me around the new moon, with the best evening and hour for squid (light wind, calm sea at dusk)')})),
      nm&&nm.nw?h('p',{class:'sub',text:T('Επόμενη νέα σελήνη: ','Next new moon: ')+new Date(nm.nw).toLocaleString(EN?'en-GB':'el-GR',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+(nm.full?' · '+T('πανσέληνος: ','full moon: ')+new Date(nm.full).toLocaleDateString(EN?'en-GB':'el-GR',{day:'numeric',month:'long'}):'')}):null,
      h('p',{class:'sub',text:T('Μία ειδοποίηση ανά σελήνη, στις 9:00 το πρωί, από 3 μέρες πριν έως 2 μέρες μετά τη νέα σελήνη, από Οκτώβριο έως Απρίλιο (η εποχή τους στην ακτή), για την πρώτη σου τοποθεσία. Δείχνει μόνο βράδια έως 3 μέρες από τη νέα σελήνη, πρώτο το καλύτερο. Μελέτη: τα καλαμάρια πιάνονται περισσότερο κοντά στη νέα σελήνη και γύρω από το σούρουπο.','One alert per moon, at 9:00 in the morning, from 3 days before to 2 days after the new moon, October to April (their inshore season), for your first place. It shows only evenings within 3 days of the new moon, best first. Study: squid are caught more near the new moon and around dusk.')}))); })();
  if(B.tripNotif){ var tn=h('input',{type:'checkbox',checked:B.tripNotif.on(),onchange:function(ev){ B.tripNotif.set(ev.target.checked); }});
    page.append(h('section',{class:'card'},h('h2',{text:T('Καταγραφή από το ρολόι','Logging from your watch')}),h('label',{class:'tg'},tn,h('span',{text:T('Κατά την έξοδο, ειδοποίηση με κουμπιά «🐟 Ψάρι εδώ» και «✕ Χάθηκε». Φαίνεται και στο ρολόι (Garmin, Wear OS) αν οι ειδοποιήσεις του Chrome πηγαίνουν στο ρολόι.','During a trip, a notification with “🐟 Fish here” and “✕ Lost” buttons. It also shows on your watch (Garmin, Wear OS) if Chrome notifications go to the watch.')})),
      h('p',{class:'sub',text:T('Η ώρα και η θέση γράφονται αυτόματα στο Ημερολόγιο. Το είδος το προσθέτεις μετά.','Time and position go straight into the Logbook. You add the species later.')}))); }
  if(B.driftAsk){ var da=h('input',{type:'checkbox',checked:B.driftAsk.on(),onchange:function(ev){ B.driftAsk.set(ev.target.checked); }});
    page.append(h('section',{class:'card'},h('h2',{text:T('Νέα σημεία κατά την έξοδο','New spots during a trip')}),h('label',{class:'tg'},da,h('span',{text:T('Όταν μένεις ακίνητος ή κάνεις drift ~10 λεπτά σε σημείο που δεν έχεις σώσει, ρώτα αν θέλω να το αποθηκεύσω','When I stay still or drift for ~10 minutes at a place I have not saved, ask whether to save it')})))); }
  page.append(h('a',{class:'btn full',href:'#inbox',style:{marginTop:'12px'},text:T('Ιστορικό ειδοποιήσεων','Notification history')}));
  root.replaceChildren(page);
}
function loadHist(){
  var loc=caches.open('alkyon-cfg').then(function(c){ return c.match(new URL('__inbox',ROOT).href); }).then(function(r){ return r?r.json():[]; }).catch(function(){ return []; });
  var cl=B.cloud&&B.cloud.session()?B.cloud:null, srv=cl?cl.rest('notif_log?select=id,at,kind,title,body,details,place,t&order=at.desc&limit=200').then(function(r){ return r.json(); }).then(function(a){ return (a||[]).map(function(x){ x.full=x.details||x.body; return x; }); }).catch(function(){ return []; }):Promise.resolve([]);
  Promise.all([loc,srv]).then(function(r){ var seen={}, all=[]; (Array.isArray(r[0])?r[0]:[]).concat(r[1]).concat(ls.get('alkyon-v4-inbox',[])||[]).forEach(function(x){ if(!x||!x.at) return; var k=(x.title||'')+String(x.at).slice(0,16); if(seen[k]) return; seen[k]=1; all.push(x); });
    hist=all.sort(function(a,b){ return String(b.at).localeCompare(String(a.at)); }); draw(); if(ib.root) ibDraw(); B.emit('inbox'); });
}
/* τοπικός έλεγχος όταν ανοίγει η εφαρμογή (όταν ο server δεν έχει τη συνδρομή) και περιοδικός στο παρασκήνιο, όπως η κλασική */
function note(title,body,m){ m=m||{}; return reg().then(function(r){ var o={body:body,tag:'alk-'+(m.kind||'info')+'-'+String(m.key||Date.now()).slice(-40),renotify:true,icon:'../icon-192.png',badge:'../icon-192.png',data:{url:ROOT,bc:{kind:m.kind||'info',id:m.key,full:m.full||body,place:m.place||null,t:m.t||null}}};
  if(r) return r.showNotification(title,o); new Notification(title,{body:body}); }).catch(function(){}); }
function localCheck(){ var n=nt(); if(!n.on||n.server||!('Notification' in window)||Notification.permission!=='granted'||!window.PF||!PF.checkPlaces) return;
  PF.checkPlaces({lang:B.LANG,places:cfgPlaces(),threshold:n.threshold,pressure:n.pressure!==false,turn:!!n.turn,wind:wwCfg(),notified:n.notified}).then(function(r){ var q=nt(); q.notified=r.notified; setNt(q); writeCfg();
    if(r.msgs&&r.msgs.length) r.msgs.forEach(function(m){ note(m.title,m.body,m); }); else if(r.items&&r.items.length) note(r.title,r.body); }).catch(function(){}); }
function periodic(on){ reg().then(function(r){ if(!r||!r.periodicSync) return; return on?r.periodicSync.register('alkyon-forecast',{minInterval:12*3600*1000}):r.periodicSync.unregister('alkyon-forecast'); }).catch(function(){}); }
function sig(){ var n=nt(); return JSON.stringify([n.threshold,n.pressure!==false,!!n.turn,wwCfg(),B.LANG,(spCfg()||{}).n||'',cfgPlaces().map(function(p){ return [p.id,+(+p.lat).toFixed(2),+(+p.lon).toFixed(2),p.watch!==false]; })]); }
function boot(){ var n=nt(); if(!n.on) return; writeCfg();
  if(B.cloud&&B.cloud.session()&&(n.sig!==sig()||!n.server)) pushServer().then(function(ok){ var q=nt(); q.server=ok; q.sig=sig(); setNt(q); writeCfg(); localCheck(); }); else localCheck(); }
setTimeout(boot,3000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden) localCheck(); });


/* ---------- εισερχόμενα: όλες οι ειδοποιήσεις (server, service worker και όσες έδειξε η εφαρμογή) ---------- */
B.inboxAdd=function(title,body,kind,extra){ try{ var a=ls.get('alkyon-v4-inbox',[])||[]; a.unshift(Object.assign({at:new Date().toISOString(),title:String(title||''),body:String(body||''),kind:kind||'app',local:1},extra&&extra.place&&extra.place.lat!=null?{place:{name:String(extra.place.name||''),lat:+extra.place.lat,lon:+extra.place.lon}}:{},extra&&extra.t?{t:extra.t}:{})); ls.set('alkyon-v4-inbox',a.slice(0,150)); hist=null; B.emit('inbox'); }catch(e){} };
function seenAt(){ return ls.get('alkyon-inbox-seen','')||''; }
B.inboxUnread=function(){ var s=seenAt(); return (hist?Promise.resolve(hist):new Promise(function(res){ var t=setInterval(function(){ if(hist){ clearInterval(t); res(hist); } },300); if(!hist) loadHistQuiet(); setTimeout(function(){ clearInterval(t); res(hist||[]); },8000); })).then(function(a){ return a.filter(function(x){ return String(x.at)>s; }).length; }); };
var quiet=false; function loadHistQuiet(){ if(quiet) return; quiet=true; var r0=root; root=null; try{ loadHist(); }catch(e){} root=r0; setTimeout(function(){ quiet=false; },3000); }
var ib={root:null,open:{}};
var KI={good:'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',press:'<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M8 5.5L6 3M16 5.5L18 3"/>',wind:'<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  sea:'<path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',trip:'<path d="M3 15h18l-2.5 4.5h-13z"/><path d="M7 15V9h7l3 6"/><path d="M10 9V5"/>',
  comm:'<path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z"/>',
  tool:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'};
function kindOf(x){ var k=(x.kind||'')+' '+(x.title||''); if(/^comm|κοινότητ|community|liked|άρεσε|σχόλι|comment|❤/i.test(k)) return 'comm'; if(/pressure|πίεσ|press|turn|καμπ/i.test(k)) return 'press'; if(/head back|γυρίσεις|δύση|sunset|καύσιμ|fuel|καιρός χαλάει|weather is getting|weather watch|καταιγίδα|thunderstorm/i.test(k)) return 'trip'; if(/\bwind\b|άνεμ|ανέμ/i.test(k)) return 'wind'; /* 1.9.52: «window» δεν είναι άνεμος */ if(/good|ideal|καλή|καλές|good day|window|sim|ίδιες/i.test(k)) return 'good';
  if(/trip|έξοδ|battery|μπαταρ|sos|mob/i.test(k)) return 'trip'; if(/maint|συντήρ|🔧|άδεια|licen|lic/i.test(k)) return 'tool'; if(/sea|κύμα|wave|θάλασσ|καιρ|weather/i.test(k)) return 'sea'; return 'bell'; }
/* 1.9.52: το εικονίδιο φαίνεται ήδη αριστερά· το emoji στην αρχή του τίτλου έβγαινε δεύτερο εικονίδιο */
function ibTitle(t){ return String(t||'').replace(/^(?:[\u2190-\u2BFF\u2600-\u27BF\uFE0F\u200D]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF]|\s)+/,''); }
function dayLab(iso){ var d=new Date(iso), t=new Date(), y=new Date(Date.now()-86400000); if(d.toDateString()===t.toDateString()) return T('Σήμερα','Today'); if(d.toDateString()===y.toDateString()) return T('Χθες','Yesterday'); return d.toLocaleDateString(EN?'en-GB':'el-GR',{weekday:'long',day:'numeric',month:'long'}); }
function fcAt(pl){ var a=ls.get('alkyon-places',[])||[], hit=a.filter(function(p){ return p&&p.lat!=null&&Math.abs(p.lat-pl.lat)<0.01&&Math.abs(p.lon-pl.lon)<0.01; })[0];
  if(!hit){ hit={id:'p'+Math.round(pl.lat*100)+'_'+Math.round(pl.lon*100),name:pl.name||T('Σημείο','Spot'),lat:+(+pl.lat).toFixed(4),lon:+(+pl.lon).toFixed(4),watch:false}; a.unshift(hit); ls.set('alkyon-places',a.slice(0,10)); }
  ls.set('alkyon-fcsel',hit.id); location.hash='#forecast'; }
/* 1.9.28: «Καλές μέρες για ψάρεμα» ανοιχτή: μία γραμμή ανά μέρα (μέρα, βαθμός, ώρα) και από κάτω οι συνθήκες, αντί για ένα συνεχές κείμενο.
   Το σημείο γράφεται μία φορά όταν είναι το ίδιο σε όλες. */
function goodRows(txt){
  var L=String(txt).split('\n'), rows=[], re=/^(.+?): (.+?) · (?:δείκτης|score) (\d+) · (\d\d:\d\d–\d\d:\d\d)$/;
  for(var i=0;i<L.length;i++){ var m=re.exec(L[i].trim()); if(m){ rows.push({pl:m[1],day:m[2],sc:+m[3],win:m[4],why:''}); } else if(rows.length&&/^\s+\S/.test(L[i])) rows[rows.length-1].why=L[i].trim(); else return null; }
  if(rows.length<1) return null;
  var one=rows.every(function(r){ return r.pl===rows[0].pl; }), gen=/^(Σημείο χάρτη|Map point|Η θέση μου|My location)$/;
  return h('span',{class:'ibgood'},one&&!gen.test(rows[0].pl)?h('small',{class:'ibpl',text:'📍 '+rows[0].pl}):null,rows.map(function(r){
    return h('span',{class:'ibday'},h('span',{class:'ibd1'},h('span',{class:'ibsc '+(r.sc>=70?'g':r.sc>=50?'m':'b'),text:String(r.sc)}),h('strong',{text:r.day}),h('span',{class:'ibw',text:r.win}),!one?h('small',{text:' · '+r.pl}):null),r.why?h('small',{class:'ibwhy',text:r.why.charAt(0).toUpperCase()+r.why.slice(1)}):null); })); }
function ibDraw(){ var r=ib.root; if(!r) return; var page=h('div',{class:'page'}), s0=ib.seen;
  page.append(h('div',{class:'top'},h('h1',{class:'lt',text:T('Ειδοποιήσεις','Notifications')}),h('a',{class:'iconbtn',href:'#alerts','aria-label':T('Ρυθμίσεις ειδοποιήσεων','Notification settings'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'})));
  var n=nt(); if(!n.on) page.append(h('a',{class:'card ibon',href:'#alerts'},h('span',{class:'ibic',html:'<svg viewBox="0 0 24 24">'+KI.bell+'</svg>'}),h('span',{class:'tx'},h('b',{text:T('Οι ειδοποιήσεις πρόγνωσης είναι κλειστές','Forecast alerts are off')}),h('small',{text:T('Πάτα για να τις ανοίξεις: καλές μέρες, αλλαγές πίεσης και ανέμου.','Tap to turn them on: good days, pressure and wind changes.')})),B.icon('chev')));
  if(hist==null){ page.append(h('div',{class:'sk',style:{height:'200px',marginTop:'8px'}})); r.replaceChildren(page); loadHist(); return; }
  if(!hist.length){ page.append(h('div',{class:'card empty'},h('h3',{text:T('Δεν υπάρχουν ειδοποιήσεις ακόμα','No notifications yet')}),h('p',{text:T('Εδώ θα βλέπεις κάθε ειδοποίηση: καλές μέρες για ψάρεμα, πίεση, άνεμο, καιρό στην έξοδο και υπενθυμίσεις.','Here you will see every notification: good fishing days, pressure, wind, weather on a trip and reminders.')}))); r.replaceChildren(page); return; }
  var last='', l=null;
  hist.slice(0,120).forEach(function(x,i){ var dl=dayLab(x.at); if(dl!==last){ last=dl; page.append(h('h3',{class:'listh',text:dl})); l=h('div',{class:'list'}); page.append(l); }
    var k=kindOf(x), id=String(x.at)+i, open=!!ib.open[id], unread=String(x.at)>s0, txt=x.full||x.body||'';
    l.append(h('button',{type:'button',class:'li ibrow'+(unread?' new':''),'aria-expanded':String(open),onclick:function(){ if(k==='comm'){ location.hash='#community'; return; } /* 1.9.39: like/σχόλιο → ανοίγει την Κοινότητα */ ib.open[id]=!open; ibDraw(); }},
      h('span',{class:'ibic k-'+k,html:'<svg viewBox="0 0 24 24" aria-hidden="true">'+KI[k]+'</svg>'}),
      h('span',{class:'tx'},h('b',{text:ibTitle(x.title)||T('Ειδοποίηση','Notification')}),txt?(open&&goodRows(txt)||h('small',{class:open?'full':'',text:txt})):null),
      h('span',{class:'when',text:new Date(x.at).toLocaleTimeString(EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'})})));
    /* 1.1.0: ανοιχτή ειδοποίηση με τοποθεσία → πρόγνωση εκεί ή χάρτης */
    var pl=x.place&&typeof x.place==='object'&&x.place.lat!=null?x.place:null;
    if(open&&pl) l.append(h('div',{class:'ibacts'},h('button',{class:'btn sm pri',type:'button',text:T('Πρόγνωση εκεί','Forecast there'),onclick:function(){ fcAt(pl); }}),h('button',{class:'btn sm',type:'button',text:T('Στον χάρτη','On the map'),onclick:function(){ if(B.mapGo) B.mapGo(+pl.lat,+pl.lon,12,null,{lab:pl.name||null,sea:true}); else location.hash='#map'; }})));
    else if(open&&!pl&&/good|καλ/i.test((x.kind||'')+(x.title||''))) l.append(h('div',{class:'ibacts'},h('a',{class:'btn sm pri',href:'#forecast',text:T('Άνοιγμα Πρόγνωσης','Open Forecast')})));
  });
  page.append(h('p',{class:'foot',text:T('Πάτα μια ειδοποίηση για όλο το κείμενο και για να δεις την πρόγνωση ή τον χάρτη εκεί.','Tap a notification for the full text and to see the forecast or map there.')}));
  r.replaceChildren(page); }
B.view('inbox',{title:T('Ειδοποιήσεις','Notifications'),mount:function(el){ ib.root=el; ib.seen=seenAt(); hist=null; ibDraw(); ls.set('alkyon-inbox-seen',new Date().toISOString()); B.emit('inbox'); },unmount:function(){ ib.root=null; },resume:function(){ ibDraw(); }});
B.view('alerts',{title:T('Ειδοποιήσεις','Alerts'),mount:function(el){ root=el; hist=null; msg=''; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
})();
