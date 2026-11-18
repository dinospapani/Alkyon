/* Alkyon 4 · αναφορά σφαλμάτων (v31z550). Φορτώνεται πρώτο, χωρίς εξαρτήσεις.
   Κάθε σφάλμα JavaScript κρατιέται στο κινητό (τα τελευταία 30, alkyon-v4-errs) και στέλνεται στον πίνακα app_errors του Supabase
   (βλ. app-errors.sql), ώστε να φαίνονται τα πραγματικά προβλήματα χωρίς screenshots. Όριο: ίδιο μήνυμα μία φορά ανά 6 ώρες, ως 25 τη μέρα.
   Δεν στέλνει δεδομένα ψαρέματος ή θέση· μόνο το μήνυμα, το αρχείο/γραμμή, την έκδοση, τη σελίδα (#hash) και τον browser. */
(function(){
'use strict';
var K='alkyon-v4-errs', Q='alkyon-v4-errq', URL_='https://sgfohmqwdwtkhtrebnix.supabase.co', KEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
function get(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }
function set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
var busy=false, timer=null, missing=false;
function short(s,n){ s=String(s==null?'':s); return s.length>n?s.slice(0,n)+'…':s; }
function file(u){ u=String(u||''); var m=u.match(/[^\/?#]+(?=[?#]|$)/); return m?m[0]:u.slice(-60); }
/* 1.14.58: αυτο-επισκευή. Αν ένα δικό μας αρχείο .js ήρθε ως σελίδα HTML («Unexpected token '<'» στη γραμμή 1), η αποθήκη της εφαρμογής
   είναι χαλασμένη: σβήνονται οι αποθήκες alkyon4-*, αποσύρεται ο service worker και η σελίδα ξαναφορτώνει. Το πολύ μία φορά ανά 12 ώρες. Τα δεδομένα του χρήστη δεν αγγίζονται. */
function heal(msg,src,line){ try{
  if(!/Unexpected token '?<'?/.test(String(msg))||(+line||0)>1||!/\.js(\?|$)/.test(String(src||''))) return;
  var last=+get('alkyon-v4-heal',0)||0; if(Date.now()-last<12*3600e3) return; set('alkyon-v4-heal',Date.now());
  var p=[]; if(window.caches&&caches.keys) p.push(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k.indexOf('alkyon4-')===0; }).map(function(k){ return caches.delete(k); })); }));
  if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations) p.push(navigator.serviceWorker.getRegistrations().then(function(rs){ return Promise.all(rs.map(function(r){ return r.unregister(); })); }));
  Promise.all(p).then(function(){},function(){}).then(function(){ setTimeout(function(){ location.reload(); },400); });
}catch(e){} }
function rec(msg,src,line,col,stack,kind){
  msg=short(msg,500); if(!msg) return; heal(msg,src,line);
  /* θόρυβος που δεν βοηθά: σφάλματα από επεκτάσεις του browser, «Script error.» χωρίς στοιχεία, ακυρώσεις */
  if(/^Script error\.?$/.test(msg)||/ResizeObserver loop|AbortError|The user aborted|chrome-extension:|moz-extension:/.test(msg+' '+(src||''))) return;
  var now=Date.now(), all=get(K,[])||[], key=msg+'|'+file(src)+':'+(line||0);
  var last=all.filter(function(x){ return x.k===key; })[0];
  if(last&&now-last.t<6*3600e3){ last.n=(last.n||1)+1; last.t=now; set(K,all); return; }
  var day=new Date().toISOString().slice(0,10), sent=all.filter(function(x){ return x.d===day; }).length;
  var o={k:key,t:now,d:day,msg:msg,src:file(src),line:line||0,col:col||0,stack:short(stack,1500),kind:kind||'error',v:window.ALKYON_VERSION||'',h:short((location.hash||'').replace(/=.*/,'='),40),n:1};
  all.unshift(o); set(K,all.slice(0,30));
  if(sent>=25) return;
  var q=get(Q,[])||[]; q.push(o); set(Q,q.slice(-40)); soon(4000);
}
function soon(ms){ clearTimeout(timer); timer=setTimeout(flush,ms); }
function sess(){ var s=get('alkyon-sess',null); return s&&s.access_token&&Date.now()/1000<(s.exp||0)?s:null; }
function flush(){
  if(busy||missing) return; var q=get(Q,[])||[]; if(!q.length) return; if(navigator.onLine===false){ soon(60000); return; }
  busy=true; var s=sess(), batch=q.slice(0,10);
  var rows=batch.map(function(o){ return {ver:o.v,msg:o.msg,src:o.src,line:o.line,col:o.col,stack:o.stack,kind:o.kind,hash:o.h,ua:short(navigator.userAgent,200),n:o.n||1,at:new Date(o.t).toISOString()}; });
  var hd={apikey:KEY,'Content-Type':'application/json',Prefer:'return=minimal'}; if(s) hd.Authorization='Bearer '+s.access_token;
  fetch(URL_+'/rest/v1/app_errors',{method:'POST',headers:hd,body:JSON.stringify(rows)}).then(function(r){
    var st=get('alkyon-v4-errst',{})||{}; st.at=Date.now(); st.code=r.status; set('alkyon-v4-errst',st);
    if(r.ok){ var cur=get(Q,[])||[]; set(Q,cur.slice(batch.length)); if(cur.length>batch.length) soon(3000); }
    else if(r.status===404){ missing=true; }   /* ο πίνακας δεν υπάρχει ακόμα (δεν έτρεξε το app-errors.sql) */
  }).catch(function(){ soon(120000); }).then(function(){ busy=false; });
}
window.addEventListener('error',function(e){ if(e&&e.target&&e.target!==window&&e.target.tagName){ return; } rec(e.message,e.filename,e.lineno,e.colno,e.error&&e.error.stack); });
window.addEventListener('unhandledrejection',function(e){ var r=e&&e.reason; if(!r) return; var m=r.message||String(r); if(/no session|Failed to fetch|NetworkError|Load failed|network/i.test(m)) return; rec('Promise: '+m,(r.stack||'').split('\n')[1]||'',0,0,r.stack,'promise'); });
window.AlkyonErr={list:function(){ return get(K,[])||[]; },clear:function(){ set(K,[]); set(Q,[]); },pending:function(){ return (get(Q,[])||[]).length; },status:function(){ return get('alkyon-v4-errst',{})||{}; },flush:function(){ missing=false; flush(); },
  report:function(msg,extra){ rec(msg,extra&&extra.src||'manual',0,0,extra&&extra.stack||'','manual'); },
  /* 1.12.14: «Πες μας τη γνώμη σου»: το μήνυμα πάει στον ίδιο πίνακα (kind=feedback), με έκδοση, σελίδα και τύπο κινητού */
  feedback:function(text,contact,topic){ var s=sess(), hd={apikey:KEY,'Content-Type':'application/json',Prefer:'return=minimal'}; if(s) hd.Authorization='Bearer '+s.access_token;
    var meta=['topic: '+(topic||''),'contact: '+short(contact||'',120),'lang: '+(document.documentElement.lang||''),'screen: '+screen.width+'x'+screen.height,'native: '+(!!window.AKN)].join('\n');
    /* 1.14.70: όριο 15″ (πριν, με κακό σήμα έμενε για πάντα στο «Αποστολή…») και ο λόγος της αποτυχίας γυρίζει στη φόρμα */
    var ac=('AbortController' in window)?new AbortController():null, tm=setTimeout(function(){ if(ac) ac.abort(); },15000);
    return fetch(URL_+'/rest/v1/app_errors',{method:'POST',signal:ac?ac.signal:undefined,headers:hd,body:JSON.stringify([{ver:window.ALKYON_VERSION||'',msg:short(text,4000),kind:'feedback',hash:short((location.hash||'').replace(/=.*/,'='),40),stack:meta,ua:short(navigator.userAgent,200),n:1}])}).then(function(r){ clearTimeout(tm); if(!r.ok) throw new Error('HTTP '+r.status); /* 1.14.13: και στη συζήτηση του χρήστη με την Alkyon (για να βλέπει μήνυμα και απάντηση μαζί) */ if(s&&s.uid) try{ fetch(URL_+'/rest/v1/user_messages',{method:'POST',headers:hd,body:JSON.stringify({user_id:s.uid,from_admin:false,author:s.uid,body:short(text,4000),name:short(s.name||'',60)||null,ref:'fb'})}).catch(function(){}); }catch(e2){} /* 1.14.1: ειδοποίηση στον διαχειριστή */ try{ fetch(URL_+'/functions/v1/sos-alert',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',Authorization:'Bearer '+(s?s.access_token:KEY)},body:JSON.stringify({action:'fb'})}).catch(function(){}); }catch(x){} return r.status; }); },
  /* έλεγχος ότι ο πίνακας δέχεται εγγραφές (από τη σελίδα «Έλεγχος συστήματος») */
  test:function(){ var s=sess(), hd={apikey:KEY,'Content-Type':'application/json',Prefer:'return=minimal'}; if(s) hd.Authorization='Bearer '+s.access_token;
    return fetch(URL_+'/rest/v1/app_errors',{method:'POST',headers:hd,body:JSON.stringify([{ver:window.ALKYON_VERSION||'',msg:'selftest',kind:'test',hash:'#check',ua:short(navigator.userAgent,200),n:1}])}).then(function(r){ return r.status; }); }};
setTimeout(flush,8000); window.addEventListener('online',function(){ soon(3000); });
})();
