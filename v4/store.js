/* BiteCast 4 · δεδομένα και συγχρονισμός.
   Ίδια μορφή με την κλασική: εγγραφές σε localStorage (psaro-bites/trips/spots/tackle, με _u = χρόνος αλλαγής),
   διαγραφές στο psaro-tomb, φωτογραφίες στη βάση IndexedDB «psarovarka». Ο συγχρονισμός με το Supabase
   ακολουθεί τον ίδιο κανόνα: κερδίζει η πιο πρόσφατη αλλαγή. Έτσι οι δύο εκδόσεις μπορούν να δουλεύουν μαζί. */
(function(){
'use strict';
var B=window.BC, T=B.T, ls=B.ls;
var URL_='https://sgfohmqwdwtkhtrebnix.supabase.co', KEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
var KINDS=['spots','trips','bites','tackle'];

/* ---------- εγγραφές ---------- */
function raw(k){ var a=ls.get('psaro-'+k,[]); return Array.isArray(a)?a:[]; }
function put(k,a){ ls.set('psaro-'+k,a); }
function tombs(){ var a=ls.get('psaro-tomb',[]); return Array.isArray(a)?a:[]; }
function newId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function save(k,obj){
  var id=obj.id||newId(), data=Object.assign({},obj,{id:id,_u:Date.now()});
  if(!obj.id&&!data.prof&&(k==='trips'||k==='bites')) data.prof=B.prof();
  put(k,raw(k).filter(function(x){ return x.id!==id; }).concat([data]));
  ls.set('psaro-tomb',tombs().filter(function(t){ return !(t.k===k&&t.id===id); }));
  B.emit('store','psaro-'+k); sched(); return id;
}
function remove(k,id){
  put(k,raw(k).filter(function(x){ return x.id!==id; }));
  ls.set('psaro-tomb',tombs().filter(function(t){ return !(t.k===k&&t.id===id); }).concat([{k:k,id:id,u:Date.now()}]));
  if(k==='bites'&&S()){ storage('DELETE','photos/'+S().uid+'/'+id+'.jpg').catch(function(){}); }
  B.emit('store','psaro-'+k); sched();
}
function get(k,id){ return raw(k).filter(function(x){ return x.id===id; })[0]||null; }

/* ---------- φωτογραφίες ---------- */
var dbp=null;
function db(){ return dbp||(dbp=new Promise(function(res,rej){ var r=indexedDB.open('psarovarka',1); r.onupgradeneeded=function(){ r.result.createObjectStore('photos'); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; })); }
function tx(mode,fn){ return db().then(function(d){ return new Promise(function(res,rej){ var t=d.transaction('photos',mode), rq=fn(t.objectStore('photos')); t.oncomplete=function(){ res(rq&&rq.result); }; t.onerror=function(){ rej(t.error); }; t.onabort=function(){ rej(t.error); }; }); }); }
var Photos={put:function(id,b){ return tx('readwrite',function(s){ return s.put(b,id); }); },get:function(id){ return tx('readonly',function(s){ return s.get(id); }); },del:function(id){ return tx('readwrite',function(s){ return s.delete(id); }); }};
function phKeys(b){ var a=[]; if(b&&b.photo){ a.push(b.id); for(var i=1;i<=(+b.xph||0);i++) a.push(b.id+'~'+i); } return a; }
/* μικραίνει τη φωτογραφία στα 1280 px (όπως η κλασική) */
function resize(file){
  return (window.createImageBitmap?createImageBitmap(file,{imageOrientation:'from-image'}):Promise.reject()).catch(function(){
    return new Promise(function(res,rej){ var im=new Image(); im.onload=function(){ res(im); }; im.onerror=rej; im.src=URL.createObjectURL(file); }); }).then(function(bmp){
    var w=bmp.width||bmp.naturalWidth, hh=bmp.height||bmp.naturalHeight, k=Math.min(1,1280/Math.max(w,hh)), c=document.createElement('canvas');
    c.width=Math.round(w*k); c.height=Math.round(hh*k); c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    return new Promise(function(res){ c.toBlob(function(b){ res(b); },'image/jpeg',0.82); }); });
}

/* ---------- λογαριασμός ---------- */
function S(){ var s=ls.get('psaro-sess',null); return s&&s.access_token?s:null; }
function setSess(j,prev){
  var s={access_token:j.access_token,refresh_token:j.refresh_token,exp:Date.now()+((j.expires_in||3600)-60)*1000,uid:(j.user&&j.user.id)||(prev&&prev.uid),email:(j.user&&j.user.email)||(prev&&prev.email),
    name:(j.user&&j.user.user_metadata&&j.user.user_metadata.name)||(prev&&prev.name)||''};
  ls.set('psaro-sess',s); B.emit('store','psaro-sess'); return s;
}
function auth(path,body){ return fetch(URL_+'/auth/v1/'+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok) throw new Error(j.msg||j.error_description||j.message||j.error||('HTTP '+r.status)); return j; }); }); }
function ensure(){ var s=S(); if(!s) return Promise.reject(new Error('no session')); if(Date.now()<s.exp) return Promise.resolve(s);
  return auth('token?grant_type=refresh_token',{refresh_token:s.refresh_token}).then(function(j){ return setSess(j,s); }); }
function H(s,extra){ var h={apikey:KEY,'Content-Type':'application/json',Authorization:'Bearer '+(s?s.access_token:KEY)}; for(var k in (extra||{})) h[k]=extra[k]; return h; }
function rest(path,opt){ opt=opt||{}; return ensure().then(function(s){ var o=Object.assign({},opt,{headers:H(s,opt.headers)}); return fetch(URL_+'/rest/v1/'+path,o).then(function(r){
  if(r.status===401) return auth('token?grant_type=refresh_token',{refresh_token:s.refresh_token}).then(function(j){ var s2=setSess(j,s); o.headers=H(s2,opt.headers); return fetch(URL_+'/rest/v1/'+path,o); });
  return r; }).then(function(r){ if(!r.ok) return r.text().then(function(t){ throw new Error('HTTP '+r.status+' '+t.slice(0,120)); }); return r; }); }); }
function storage(method,path,body,type){ return ensure().then(function(s){ var h={apikey:KEY,Authorization:'Bearer '+s.access_token}; if(type){ h['Content-Type']=type; h['x-upsert']='true'; } return fetch(URL_+'/storage/v1/object/'+path,{method:method,headers:h,body:body}); }); }
function errText(e){
  var m=String(e&&e.message||e);
  if(/Invalid login/i.test(m)) return T('Λάθος email ή κωδικός.','Wrong email or password.');
  if(/already registered/i.test(m)) return T('Αυτό το email είναι ήδη εγγεγραμμένο. Πάτα «Σύνδεση».','This email is already registered. Tap “Sign in”.');
  if(/Email not confirmed/i.test(m)) return T('Επιβεβαίωσε πρώτα το email σου (δες τα εισερχόμενα).','Confirm your email first (check your inbox).');
  if(/least 6|weak|Password should/i.test(m)) return T('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.','The password needs at least 6 characters.');
  if(/valid email|invalid format/i.test(m)) return T('Γράψε έγκυρο email.','Enter a valid email.');
  if(/rate limit|too many/i.test(m)) return T('Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.','Too many attempts. Try again shortly.');
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return T('Δεν υπάρχει σύνδεση στο διαδίκτυο.','No internet connection.');
  return T('Σφάλμα: ','Error: ')+m;
}
function signIn(email,pw){ return auth('token?grant_type=password',{email:email,password:pw}).then(function(j){ setSess(j,null); return sync(true); }); }
function signUp(email,pw){ return auth('signup',{email:email,password:pw,options:{email_redirect_to:location.origin+location.pathname.replace(/v4\/.*$/,'')}}).then(function(j){ if(j.access_token){ setSess(j,null); return sync(true).then(function(){ return 'in'; }); } return 'confirm'; }); }
function signOut(){ var s=S(); var done=function(){ ls.set('psaro-sess',null); try{ localStorage.removeItem('psaro-sess'); localStorage.removeItem('psaro-last'); }catch(e){} B.emit('store','psaro-sess'); };
  return sync(true).catch(function(){}).then(function(){ if(!s) return; return fetch(URL_+'/auth/v1/logout',{method:'POST',headers:H(s)}).catch(function(){}); }).then(done); }
function setName(n){ return ensure().then(function(s){ return fetch(URL_+'/auth/v1/user',{method:'PUT',headers:H(s),body:JSON.stringify({data:{name:n}})}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); s.name=n; ls.set('psaro-sess',s); B.emit('store','psaro-sess'); }); }); }

/* ---------- συγχρονισμός ---------- */
var busy=null, again=false, timer=0, state={t:ls.get('psaro-last',0),msg:'',err:false};
function iso(ms){ return new Date(ms).toISOString(); }
function sched(){ if(!S()) return; clearTimeout(timer); timer=setTimeout(function(){ sync(false); },2500); }
function sync(manual){
  if(!S()) return Promise.resolve();
  if(busy){ again=true; return busy; }
  if(navigator.onLine===false){ state.msg=T('Χωρίς σύνδεση. Θα γίνει όταν συνδεθείς.','Offline. It will run when you are online.'); B.emit('sync',state); return Promise.resolve(); }
  state.msg=T('Συγχρονισμός…','Syncing…'); state.err=false; B.emit('sync',state);
  var s0=S(), got=0, sent=0, needPh=[], pup=ls.get('psaro-pup',{})||{};
  busy=rest('records?select=kind,id,data,deleted,updated_at&user_id=eq.'+encodeURIComponent(s0.uid)+'&order=updated_at.asc&limit=10000').then(function(r){ return r.json(); }).then(function(rows){
    /* 1) λήψη: ό,τι είναι νεότερο στον server */
    var remote={}, cache={}, tb=tombs(); KINDS.forEach(function(k){ cache[k]=raw(k); });
    rows.forEach(function(x){ remote[x.kind+'/'+x.id]=x; if(!cache[x.kind]) return;
      var u=(x.data&&x.data._u)||Date.parse(x.updated_at)||0, cur=cache[x.kind].filter(function(o){ return o.id===x.id; })[0], t=tb.filter(function(o){ return o.k===x.kind&&o.id===x.id; })[0];
      var lu=Math.max(cur?(cur._u||0):0,t?t.u:0); if(u<=lu) return;
      if(x.deleted){ cache[x.kind]=cache[x.kind].filter(function(o){ return o.id!==x.id; }); tb=tb.filter(function(o){ return !(o.k===x.kind&&o.id===x.id); }).concat([{k:x.kind,id:x.id,u:u}]); }
      else { cache[x.kind]=cache[x.kind].filter(function(o){ return o.id!==x.id; }).concat([Object.assign({},x.data||{},{id:x.id,_u:u})]); tb=tb.filter(function(o){ return !(o.k===x.kind&&o.id===x.id); });
        if(x.kind==='bites'&&x.data&&x.data.photo){ needPh.push(x.id); for(var i=1;i<=(+x.data.xph||0);i++) needPh.push(x.id+'~'+i); } }
      got++; });
    if(got){ KINDS.forEach(function(k){ put(k,cache[k]); }); ls.set('psaro-tomb',tb); }
    /* 2) αποστολή: ό,τι είναι νεότερο εδώ */
    var out=[];
    KINDS.forEach(function(k){ cache[k].forEach(function(o){ var rm=remote[k+'/'+o.id], ru=rm?((rm.data&&rm.data._u)||Date.parse(rm.updated_at)||0):0; if(!rm||(o._u||0)>ru) out.push({kind:k,id:o.id,data:o,deleted:false,updated_at:iso(o._u||Date.now())}); }); });
    tb.forEach(function(t){ var rm=remote[t.k+'/'+t.id], ru=rm?((rm.data&&rm.data._u)||Date.parse(rm.updated_at)||0):0; if(!rm||(!rm.deleted&&t.u>ru)) out.push({kind:t.k,id:t.id,data:{_u:t.u},deleted:true,updated_at:iso(t.u)}); });
    sent=out.length; var p=Promise.resolve();
    for(var i=0;i<out.length;i+=200)(function(ch){ p=p.then(function(){ return rest('records',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(ch)}); }); })(out.slice(i,i+200));
    return p.then(function(){
      /* 3) φωτογραφίες: ανέβασμα όσων λείπουν, κατέβασμα όσων ήρθαν */
      var pl=[]; raw('bites').forEach(function(b){ phKeys(b).forEach(function(k){ pl.push(k); }); });
      var q=Promise.resolve();
      pl.forEach(function(pk){ if(pup[pk]) return; q=q.then(function(){ return Photos.get(pk).then(function(bl){ if(!bl) return; return storage('POST','photos/'+s0.uid+'/'+pk+'.jpg',bl,'image/jpeg').then(function(rr){ if(rr.ok) pup[pk]=1; }); }).catch(function(){}); }); });
      needPh.forEach(function(id){ q=q.then(function(){ return Photos.get(id).then(function(have){ if(have){ pup[id]=1; return; } return storage('GET','authenticated/photos/'+s0.uid+'/'+id+'.jpg').then(function(rs){ if(rs.ok) return rs.blob().then(function(b){ pup[id]=1; return Photos.put(id,b); }); }); }).catch(function(){}); }); });
      return q;
    });
  }).then(function(){
    ls.set('psaro-pup',pup); state.t=Date.now(); ls.set('psaro-last',state.t); state.err=false;
    state.msg=T('Συγχρονίστηκε ','Synced ')+new Date().toLocaleTimeString(B.EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'})+(got?T(', ήρθαν ',', received ')+got:'')+(sent?T(', στάλθηκαν ',', sent ')+sent:'');
    if(got) KINDS.forEach(function(k){ B.emit('store','psaro-'+k); });
  }).catch(function(e){
    var m=String(e&&e.message||e); state.err=true;
    if(/HTTP 4(01|03)|JWT|refresh_token|Refresh Token|invalid_grant/i.test(m)){ ls.set('psaro-sess',null); try{ localStorage.removeItem('psaro-sess'); }catch(x){} state.msg=T('Η σύνδεση έληξε. Συνδέσου ξανά.','Your session expired. Sign in again.'); B.emit('store','psaro-sess'); }
    else state.msg=errText(e);
  }).then(function(){ B.emit('sync',state); busy=null; if(again){ again=false; sched(); } });
  return busy;
}
window.addEventListener('online',sched);
document.addEventListener('visibilitychange',function(){ if(!document.hidden) sched(); });
setTimeout(function(){ if(S()) sync(false); },1500);

B.store={raw:raw,get:get,save:save,remove:remove,tombs:tombs,Photos:Photos,phKeys:phKeys,resize:resize,

  bites:function(){ return raw('bites').filter(function(b){ return !b.miss; }); }, misses:function(){ return raw('bites').filter(function(b){ return b.miss; }); }};
/* διαγραφή με «Αναίρεση» (σύρσιμο στις λίστες): οι φωτογραφίες στο κινητό σβήνουν μόνο αφού περάσει η ευκαιρία αναίρεσης */
function recountTrip(sid){ if(!sid) return; var t=raw('trips').filter(function(x){ return x.sid===sid; })[0]; if(!t) return;
  var bs=raw('bites').filter(function(b){ return b.trip===sid&&!b.miss; }); save('trips',Object.assign({},t,{count:bs.reduce(function(s,b){ return s+Math.max(1,Math.floor(+b.cnt)||1); },0),kg:Math.round(bs.reduce(function(s,b){ return s+(b.rel?0:(+b.kg||0)); },0)*10)/10})); }
B.store.delUndo=function(k,rec,msg){
  if(!rec||!rec.id) return; var undone=false, keys=k==='bites'?phKeys(rec):k==='tackle'&&rec.photo?['tk-'+rec.id]:[];
  remove(k,rec.id); if(k==='bites') recountTrip(rec.trip);
  var t=setTimeout(function(){ if(!undone) keys.forEach(function(x){ Photos.del(x).catch(function(){}); }); },9000);
  B.toast(msg||T('Διαγράφηκε.','Deleted.'),7000,{label:T('Αναίρεση','Undo'),fn:function(){ undone=true; clearTimeout(t); var r=Object.assign({},rec); delete r.deleted; save(k,r);
    if(k==='bites'){ var pup=ls.get('psaro-pup',{})||{}; keys.forEach(function(x){ delete pup[x]; }); ls.set('psaro-pup',pup); recountTrip(rec.trip); } B.toast(T('Επαναφέρθηκε.','Restored.')); }});
};
B.cloud={rest:rest,storage:storage,session:S,signIn:signIn,signUp:signUp,signOut:signOut,setName:setName,sync:sync,state:function(){ return state; },errText:errText};
})();
