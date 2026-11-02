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
function rec(msg,src,line,col,stack,kind){
  msg=short(msg,500); if(!msg) return;
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
  /* έλεγχος ότι ο πίνακας δέχεται εγγραφές (από τη σελίδα «Έλεγχος συστήματος») */
  test:function(){ var s=sess(), hd={apikey:KEY,'Content-Type':'application/json',Prefer:'return=minimal'}; if(s) hd.Authorization='Bearer '+s.access_token;
    return fetch(URL_+'/rest/v1/app_errors',{method:'POST',headers:hd,body:JSON.stringify([{ver:window.ALKYON_VERSION||'',msg:'selftest',kind:'test',hash:'#check',ua:short(navigator.userAgent,200),n:1}])}).then(function(r){ return r.status; }); }};
setTimeout(flush,8000); window.addEventListener('online',function(){ soon(3000); });
})();
