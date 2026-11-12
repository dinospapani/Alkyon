/* Alkyon · κόλλα για τις εφαρμογές Android και iOS (Capacitor).
   Φορτώνεται ΜΟΝΟ μέσα στην εφαρμογή: το tools/build-web.mjs --native το βάζει στο index.html και στο v4/index.html, μετά το
   capacitor.js. Στον browser (alkyonfishing.com) δεν φορτώνεται καθόλου, άρα window.AKN δεν υπάρχει εκεί.
   - window.AKN: σημάδι «τρέχω σε εφαρμογή» και βοηθητικά (site, oauthReturn, openExternal)
   - κουμπί «πίσω» του Android: πίσω στο ιστορικό, αλλιώς η εφαρμογή πάει στο παρασκήνιο (όχι κλείσιμο: μια έξοδος μπορεί να τρέχει)
   - σύνδεσμοι που ανοίγουν την εφαρμογή (https://alkyonfishing.com/... και com.alkyonfishing.app://auth/#access_token=...)
   - εξωτερικοί σύνδεσμοι (window.open): σε Chrome Custom Tab, όχι μέσα στην εφαρμογή
   ΠΡΟΣΟΧΗ: ο τοπικός server του Capacitor (html5mode) δίνει το index.html της ρίζας για κάθε διαδρομή χωρίς τελεία, π.χ. «v4/».
   Γι' αυτό μέσα στην εφαρμογή οι μεταβάσεις πάνε πάντα σε ρητό αρχείο («v4/index.html»). Το build-web.mjs --native διορθώνει και το index.html. */
(function(){
'use strict';
var C=window.Capacitor;
if(!C||typeof C.isNativePlatform!=='function'||!C.isNativePlatform()) return;
var reg=function(n){ try{ return C.registerPlugin(n); }catch(e){ return null; } };
var App=reg('App'), Browser=reg('Browser'), SB=reg('StatusBar');
var SITE='https://alkyonfishing.com/', SCHEME='com.alkyonfishing.app';
var IOS=C.getPlatform()==='ios';
var ROOT=location.origin+'/';   /* https://localhost/ : τα αρχεία της εφαρμογής, μέσα στο κινητό */

function isLocal(u){ try{ return new URL(u,location.href).origin===location.origin; }catch(e){ return true; } }
function openExternal(u){
  if(Browser) return Browser.open({url:u,toolbarColor:'#06171F'}).catch(function(){ location.href=u; });
  location.href=u; return Promise.resolve();
}

window.AKN={
  platform:C.getPlatform(),
  site:SITE,                                 /* διεύθυνση επιστροφής στα email (επιβεβαίωση, νέος κωδικός) */
  oauthReturn:SCHEME+'://auth/',             /* επιστροφή από Google: ανοίγει ξανά την εφαρμογή */
  openExternal:openExternal,
  version:function(){ return App?App.getInfo().then(function(i){ return i.version+' ('+i.build+')'; }):Promise.resolve(''); },
  /* 1.13.1: «Δίκτυο σκάφους» (UDP/TCP προς plotter ή πύλη NMEA). Προς το παρόν μόνο Android. */
  net:IOS?null:reg('AlkNet')
};
try{ document.documentElement.classList.add('native','native-'+window.AKN.platform); }catch(e){}

/* εξωτερικοί σύνδεσμοι από window.open (χάρτες, Telegram, οδηγοί, νόμοι): Custom Tab· οι εσωτερικοί μένουν ως έχουν */
var wopen=window.open;
window.open=function(u,t,f){
  if(u&&/^https?:/i.test(String(u))&&!isLocal(u)){ openExternal(String(u)); return null; }
  return wopen.apply(window,arguments);
};
/* <a target="_blank" href="https://..."> */
document.addEventListener('click',function(e){
  var a=e.target&&e.target.closest?e.target.closest('a[href]'):null; if(!a) return;
  var h=a.getAttribute('href')||''; if(!/^https?:/i.test(h)||isLocal(h)) return;
  e.preventDefault(); openExternal(a.href);
},true);

/* δεδομένα (.json: φράγματα, περιοχές Navigator, ακτογραμμή, ...): ενημερώνονται στο alkyonfishing.com από τα workflows του GitHub,
   ενώ η εφαρμογή έχει το αντίγραφο της ημέρας που χτίστηκε. Πρώτα το φρέσκο από το site (έως 4″), αλλιώς το αντίγραφο της εφαρμογής. */
var nfetch=window.fetch;
if(nfetch) window.fetch=function(input,init){
  try{
    var url=typeof input==='string'?input:(input&&input.url);
    var m=(init&&init.method)||(input&&input.method)||'GET';
    if(url&&String(m).toUpperCase()==='GET'){
      var u=new URL(url,location.href);
      if(u.origin===location.origin&&/\.json$/i.test(u.pathname)&&!/build-info\.json$/.test(u.pathname)){
        var remote=SITE+u.pathname.replace(/^\/+/,'')+u.search;
        var ctl=window.AbortController?new AbortController():null, t=setTimeout(function(){ if(ctl) ctl.abort(); },4000);
        return nfetch(remote,{cache:'no-cache',signal:ctl?ctl.signal:undefined}).then(function(r){ clearTimeout(t); if(r.ok) return r; throw new Error('http '+r.status); })
          .catch(function(){ clearTimeout(t); return nfetch(input,init); });
      }
    }
  }catch(e){}
  return nfetch.apply(window,arguments);
};

/* ---------- 1.12.4: ειδοποιήσεις (Firebase Cloud Messaging + τοπικές) ----------
   Το WebView του Android δεν έχει Notification / Push API. Αντί να αλλάξουμε όλο τον κώδικα των ειδοποιήσεων, δίνουμε εδώ τα ίδια
   αντικείμενα με native υλοποίηση, ώστε ο υπάρχων κώδικας (alerts-view.js, trip.js, troll.js, smart.js…) να δουλεύει όπως στο web:
   - window.Notification: permission / requestPermission (άδεια POST_NOTIFICATIONS του Android) και new Notification(…) → τοπική ειδοποίηση
   - ServiceWorkerRegistration.showNotification(…) → τοπική ειδοποίηση
   - registration.pushManager: «συνδρομή» με token του Firebase. Γράφεται στον ίδιο πίνακα push_subs ως {endpoint:'fcm:…', fcm:'…'}
     και η quick-processor τη στέλνει μέσω Firebase αντί για web-push. */
/* το build-web.mjs --native το κάνει true όταν υπάρχει android/app/google-services.json (χωρίς Firebase το register() ρίχνει την εφαρμογή) */
var FCM_ON=false;
/* 1.13.0: στο iOS οι ειδοποιήσεις έρχονται κατευθείαν από την Apple (APNs): το token είναι της Apple, όχι του Firebase.
   Η συνδρομή γράφεται ως {endpoint:'apns:…', apns:'<token>', apns_env} και η quick-processor τη στέλνει στο APNs. */
var APNS_ENV='production';
var Push=(FCM_ON||IOS)?reg('PushNotifications'):null, LN=reg('LocalNotifications'), PK='alkyon-native-perm', FK='alkyon-fcm';
function permStr(v){ return v==='granted'?'granted':v==='denied'?'denied':'default'; }
var perm=permStr(localStorage.getItem(PK));
function setPerm(v){ perm=permStr(v); try{ localStorage.setItem(PK,perm); }catch(e){} return perm; }
if(Push) Push.checkPermissions().then(function(r){ setPerm(r&&r.receive); }).catch(function(){});
else if(LN) LN.checkPermissions().then(function(r){ setPerm(r&&r.display); }).catch(function(){});
var chanP=null;
function channel(){ if(chanP) return chanP; var c={id:'alkyon',name:'Alkyon',description:'Alkyon',importance:4,visibility:1,vibration:true};
  chanP=Promise.all([Push?Push.createChannel(c).catch(function(){}):null,LN?LN.createChannel(c).catch(function(){}):null]); return chanP; }
var nid=Math.floor(Date.now()/1000)%100000;
function show(title,body,data){ if(!LN||perm!=='granted') return Promise.resolve();
  return channel().then(function(){ return LN.schedule({notifications:[{id:(++nid)%2147483000,title:String(title||'Alkyon'),body:String(body||''),channelId:'alkyon',smallIcon:'ic_stat_alkyon',iconColor:'#FF7A4D',extra:data||null}]}); }).catch(function(){}); }
function NativeNotification(title,o){ show(title,o&&o.body,o&&o.data); }
Object.defineProperty(NativeNotification,'permission',{get:function(){ return perm; }});
NativeNotification.requestPermission=function(cb){
  var p=Push?Push.requestPermissions().then(function(r){ return setPerm(r&&r.receive); }).catch(function(){ return perm; })
    :LN?LN.requestPermissions().then(function(r){ return setPerm(r&&r.display); }).catch(function(){ return perm; }):Promise.resolve('denied');
  p=p.then(function(v){ if(v==='granted'&&LN) return LN.requestPermissions().catch(function(){}).then(function(){ return v; }); return v; });
  if(typeof cb==='function') p.then(cb); return p; };
try{ window.Notification=NativeNotification; }catch(e){}
/* token του Firebase: μία εγγραφή listener, πολλές αναμονές */
var tokW=[], tokBusy=false;
if(Push){
  Push.addListener('registration',function(t){ try{ localStorage.setItem(FK,t.value); }catch(e){} var w=tokW; tokW=[]; tokBusy=false; w.forEach(function(x){ x[0](t.value); }); });
  Push.addListener('registrationError',function(e){ var w=tokW; tokW=[]; tokBusy=false; w.forEach(function(x){ x[1](new Error((e&&e.error)||'fcm')); }); });
  /* ειδοποίηση ενώ η εφαρμογή είναι ανοιχτή: το Android δεν τη δείχνει μόνο του, άρα τοπική + στο Ιστορικό */
  Push.addListener('pushNotificationReceived',function(n){ var d=(n&&n.data)||{}; if(!IOS) show(n.title||d.title,n.body||d.body,d);   /* στο iOS τη δείχνει το ίδιο το σύστημα (presentationOptions) */
    try{ var a=JSON.parse(localStorage.getItem('alkyon-v4-inbox')||'[]'); a.unshift({at:new Date().toISOString(),title:String(n.title||d.title||''),body:String(n.body||d.body||''),kind:d.kind||'info',local:1}); localStorage.setItem('alkyon-v4-inbox',JSON.stringify(a.slice(0,150))); }catch(e){} });
  Push.addListener('pushNotificationActionPerformed',function(a){ openFrom(a&&a.notification&&a.notification.data); });
}
if(LN) LN.addListener('localNotificationActionPerformed',function(a){ openFrom(a&&a.notification&&a.notification.extra); });
function openFrom(d){ var u=d&&(d.hash||d.url)||''; var m=/#[a-z]+(=[^&\s]*)?$/i.exec(String(u)); var h=m?m[0]:'#inbox';
  if(/\/v4\/index\.html$/.test(location.pathname)) location.hash=h; else location.replace(ROOT+'v4/index.html'+h); }
function token(){ if(!Push) return Promise.reject(new Error('no push'));
  return new Promise(function(res,rej){ tokW.push([res,rej]); if(tokBusy) return; tokBusy=true;
    channel().then(function(){ return Push.register(); }).catch(function(e){ var w=tokW; tokW=[]; tokBusy=false; w.forEach(function(x){ x[1](e); }); });
    setTimeout(function(){ if(!tokBusy) return; var w=tokW; tokW=[]; tokBusy=false; w.forEach(function(x){ x[1](new Error('fcm timeout')); }); },20000); }); }
function mkSub(tk){ var ep=(IOS?'apns:':'fcm:')+tk, js=IOS?{endpoint:ep,apns:tk,apns_env:APNS_ENV,keys:{}}:{endpoint:ep,fcm:tk,keys:{}};
  return {endpoint:ep,fcm:IOS?undefined:tk,apns:IOS?tk:undefined,expirationTime:null,options:{},
  toJSON:function(){ return js; },
  getKey:function(){ return null; },
  unsubscribe:function(){ try{ localStorage.removeItem(FK); }catch(e){} return (Push?Push.unregister():Promise.resolve()).then(function(){ return true; },function(){ return true; }); }}; }
var PM={
  getSubscription:function(){ var tk=localStorage.getItem(FK); if(!tk||perm!=='granted') return Promise.resolve(null);
    return token().then(mkSub,function(){ return mkSub(tk); }); },   /* το token μπορεί να αλλάξει: ανανεώνεται σε κάθε άνοιγμα */
  subscribe:function(){ if(perm!=='granted') return Promise.reject(new Error('permission')); return token().then(mkSub); },
  permissionState:function(){ return Promise.resolve(perm==='default'?'prompt':perm); }
};
if(window.ServiceWorkerRegistration&&Push){ var SWR=ServiceWorkerRegistration.prototype;
  try{ Object.defineProperty(SWR,'pushManager',{configurable:true,get:function(){ return PM; }}); }catch(e){}
  try{ SWR.showNotification=function(t,o){ return show(t,o&&o.body,o&&o.data); }; SWR.getNotifications=function(){ return Promise.resolve([]); }; }catch(e){} }
window.AKN.push={token:token,permission:function(){ return perm; },show:show};

/* 1.13.0 · iOS: το WKWebView με τη διεύθυνση capacitor:// δεν έχει service worker ούτε (πάντα) Cache Storage.
   Δίνουμε μια ελάχιστη «εγγραφή» με τα ίδια ονόματα, ώστε ο κώδικας των ειδοποιήσεων (alerts-view, smart, trip, troll…) να δουλεύει όπως
   στο Android: showNotification → τοπική ειδοποίηση, pushManager → APNs, active.postMessage({localMsg}) → ειδοποίηση / Ιστορικό.
   Οι χάρτες εκτός σύνδεσης (cache του service worker) δεν υπάρχουν στο iOS. */
function inboxAdd(t,b,k){ try{ var a=JSON.parse(localStorage.getItem('alkyon-v4-inbox')||'[]'); a.unshift({at:new Date().toISOString(),title:String(t||''),body:String(b||''),kind:k||'info',local:1}); localStorage.setItem('alkyon-v4-inbox',JSON.stringify(a.slice(0,150))); }catch(e){} }
if(IOS&&!('caches' in window)){ var CS={};
  var mkC=function(){ var m={}; var k=function(r){ return typeof r==='string'?new URL(r,location.href).href:r.url; };
    return {match:function(r){ var v=m[k(r)]; return Promise.resolve(v?v.clone():undefined); },
      put:function(r,res){ return Promise.resolve(res&&res.clone?res.clone():res).then(function(x){ m[k(r)]=x; }); },
      add:function(r){ return fetch(r).then(function(x){ m[k(r)]=x; }); },
      addAll:function(a){ return Promise.all((a||[]).map(this.add)); },
      delete:function(r){ var h=k(r) in m; delete m[k(r)]; return Promise.resolve(h); },
      keys:function(){ return Promise.resolve(Object.keys(m).map(function(u){ return new Request(u); })); }}; };
  try{ window.caches={open:function(n){ return Promise.resolve(CS[n]||(CS[n]=mkC())); },has:function(n){ return Promise.resolve(n in CS); },
    delete:function(n){ var h=n in CS; delete CS[n]; return Promise.resolve(h); },keys:function(){ return Promise.resolve(Object.keys(CS)); },
    match:function(r){ var ns=Object.keys(CS); return ns.reduce(function(p,n){ return p.then(function(v){ return v||CS[n].match(r); }); },Promise.resolve(undefined)); }}; }catch(e){}
}
if(IOS&&!('serviceWorker' in navigator)){
  var FREG={scope:ROOT,pushManager:PM,update:function(){ return Promise.resolve(); },unregister:function(){ return Promise.resolve(true); },
    showNotification:function(t,o){ return show(t,o&&o.body,o&&o.data); },getNotifications:function(){ return Promise.resolve([]); },
    active:{state:'activated',postMessage:function(d){ var m=d&&d.localMsg; if(!m) return; if(m.notify===false) inboxAdd(m.title,m.full||m.body,m.kind); else { show(m.title,m.body,{hash:'#inbox'}); inboxAdd(m.title,m.full||m.body,m.kind); } }},
    addEventListener:function(){},removeEventListener:function(){}};
  if(!Push) FREG.pushManager=undefined;
  var FSW={controller:null,ready:Promise.resolve(FREG),
    register:function(){ return Promise.resolve(FREG); },getRegistration:function(){ return Promise.resolve(FREG); },getRegistrations:function(){ return Promise.resolve([FREG]); },
    addEventListener:function(){},removeEventListener:function(){},startMessages:function(){}};
  try{ Object.defineProperty(navigator,'serviceWorker',{configurable:true,get:function(){ return FSW; }}); }catch(e){}
}

/* σύνδεσμος που άνοιξε την εφαρμογή */
function handleUrl(url){
  if(!url) return;
  var u; try{ u=new URL(url); }catch(e){ return; }
  if(u.protocol===SCHEME+':'){
    /* επιστροφή από τη σύνδεση με Google: το v4/account.js διαβάζει το #access_token=… όταν ανοίγει η σελίδα */
    try{ if(Browser) Browser.close().catch(function(){}); }catch(e){}
    location.replace(ROOT+'v4/index.html?auth='+Date.now()+(u.hash||''));
    return;
  }
  if(/(^|\.)alkyonfishing\.com$/.test(u.hostname)){
    /* ίδια αρχεία υπάρχουν και μέσα στην εφαρμογή: η ρίζα (index.html) περνά τα ?a= και #… στη v4 */
    var p=u.pathname.replace(/^\/+/,'');
    /* ο τοπικός server του Capacitor σερβίρει το index.html της ΡΙΖΑΣ για κάθε διαδρομή χωρίς τελεία (π.χ. v4/), άρα πάντα ρητό αρχείο */
    if(p===''||/\/$/.test(p)) p+='index.html'; else if(!/\.[a-z0-9]+$/i.test(p)) p+='.html';
    location.replace(ROOT+p+(u.search?u.search+'&':'?')+'r='+Date.now()+u.hash);
  }
}
if(App){
  App.addListener('appUrlOpen',function(ev){ handleUrl(ev&&ev.url); });
  /* πίσω: πρώτα ό,τι είναι ανοιχτό (sheet, σελίδα) μέσω ιστορικού· αλλιώς η εφαρμογή στο παρασκήνιο */
  App.addListener('backButton',function(ev){
    /* 1.12.22: πρώτα ρωτάμε την εφαρμογή (π.χ. καλωσόρισμα: ένα βήμα πίσω) */
    try{ if(window.AK&&AK.backHook&&AK.backHook()) return; }catch(e){}
    if(ev&&ev.canGoBack) history.back();
    else App.minimizeApp().catch(function(){});
  });
}
try{ if(SB) SB.setBackgroundColor({color:'#06171F'}).catch(function(){}); }catch(e){}
})();
