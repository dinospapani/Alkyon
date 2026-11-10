/* Alkyon · κόλλα για την εφαρμογή Android (Capacitor).
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
  version:function(){ return App?App.getInfo().then(function(i){ return i.version+' ('+i.build+')'; }):Promise.resolve(''); }
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
    if(ev&&ev.canGoBack) history.back();
    else App.minimizeApp().catch(function(){});
  });
}
try{ if(SB) SB.setBackgroundColor({color:'#06171F'}).catch(function(){}); }catch(e){}
})();
