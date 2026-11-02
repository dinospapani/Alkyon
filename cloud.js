/* Λογαριασμός και συγχρονισμός (Supabase). Χωρίς βιβλιοθήκη, μόνο REST. */
(function(){
'use strict';
var URL_='https://sgfohmqwdwtkhtrebnix.supabase.co', KEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
var C=window.AlkyonCore; if(!C) return;
var Store=C.Store, Photos=C.Photos, toast=function(m){ if(C.toast) C.toast(m); };
var $=function(id){return document.getElementById(id);};
var KINDS=['spots','trips','bites','tackle'];
var sess=null, busy=false, timer=null, again=false;
function ls(k,v){ try{ if(v===undefined) return JSON.parse(localStorage.getItem(k)); if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){ return null; } }
sess=ls('alkyon-sess');

function H(extra){ var h={apikey:KEY,'Content-Type':'application/json'}; if(sess&&sess.access_token) h.Authorization='Bearer '+sess.access_token; else h.Authorization='Bearer '+KEY; for(var k in (extra||{})) h[k]=extra[k]; return h; }
async function auth(path,body){
  var r=await fetch(URL_+'/auth/v1/'+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  var j={}; try{ j=await r.json(); }catch(e){}
  if(!r.ok) throw new Error(j.msg||j.error_description||j.message||j.error||('HTTP '+r.status));
  return j;
}
function setSess(j){
  sess={access_token:j.access_token,refresh_token:j.refresh_token,exp:Date.now()+((j.expires_in||3600)-60)*1000,uid:(j.user&&j.user.id)||(sess&&sess.uid),email:(j.user&&j.user.email)||(sess&&sess.email),name:(j.user&&j.user.user_metadata&&j.user.user_metadata.name)||(sess&&sess.name)||''};
  ls('alkyon-sess',sess);
}
async function ensure(){
  if(!sess) throw new Error('no session');
  if(Date.now()<sess.exp) return;
  var j=await auth('token?grant_type=refresh_token',{refresh_token:sess.refresh_token});
  setSess(j);
}
function errText(e){
  var m=String(e&&e.message||e);
  if(/Invalid login/i.test(m)) return 'Λάθος email ή κωδικός.';
  if(/already registered|already been registered/i.test(m)) return 'Αυτό το email είναι ήδη εγγεγραμμένο. Πάτα Σύνδεση.';
  if(/Email not confirmed/i.test(m)) return 'Επιβεβαίωσε πρώτα το email σου (δες τα εισερχόμενα).';
  if(/least 6|weak|Password should/i.test(m)) return 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.';
  if(/valid email|invalid format/i.test(m)) return 'Γράψε έγκυρο email.';
  if(/email rate limit/i.test(m)) return 'Έχουν σταλεί πολλά email επιβεβαίωσης τελευταία. Δοκίμασε ξανά σε περίπου 1 ώρα.';
  var sec=m.match(/after (\d+) seconds/i); if(sec) return 'Περίμενε '+sec[1]+' δευτερόλεπτα και δοκίμασε ξανά.';
  if(/rate limit|too many/i.test(m)) return 'Πολλές προσπάθειες. Περίμενε λίγο και δοκίμασε ξανά.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Δεν υπάρχει σύνδεση στο διαδίκτυο.';
  return 'Σφάλμα: '+m;
}

/* ---------- Συγχρονισμός ---------- */
var iso=function(ms){ return new Date(ms).toISOString(); };
async function rest(path,opt){
  await ensure(); opt=opt||{}; opt.headers=H(opt.headers);
  var r=await fetch(URL_+'/rest/v1/'+path,opt);
  if(r.status===401){ var j=await auth('token?grant_type=refresh_token',{refresh_token:sess.refresh_token}); setSess(j); opt.headers=H(opt.headers); r=await fetch(URL_+'/rest/v1/'+path,opt); }
  if(!r.ok) throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,120));
  return r;
}
async function fn(name,body){
  await ensure(); if(!sess||!sess.access_token) throw new Error('not logged in');
  var o={method:'POST',headers:H(),body:JSON.stringify(body||{})};
  var r=await fetch(URL_+'/functions/v1/'+name,o);
  if(r.status===401){ var j=await auth('token?grant_type=refresh_token',{refresh_token:sess.refresh_token}); setSess(j); o.headers=H(); r=await fetch(URL_+'/functions/v1/'+name,o); }
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
window.AlkyonCloud={logged:function(){return !!sess;},rest:function(p,o){return rest(p,o);},fn:fn,name:function(){return sess&&sess.name||'';},uid:function(){return sess&&sess.uid||'';},url:URL_,storage:async function(m,p,b,t){ return storage(m,p,b,t); }};
var pup=ls('alkyon-pup')||{};
async function storage(method,path,body,type){
  await ensure(); var h={apikey:KEY,Authorization:'Bearer '+sess.access_token}; if(type){ h['Content-Type']=type; h['x-upsert']='true'; }
  return fetch(URL_+'/storage/v1/object/'+path,{method:method,headers:h,body:body});
}
async function sync(manual){
  if(!sess){ return; }
  if(busy){ again=true; return; }
  if(!navigator.onLine){ if(manual) status('Χωρίς σύνδεση. Θα γίνει όταν συνδεθείς.'); return; }
  busy=true; status('Συγχρονισμός…');
  try{
    // 1) λήψη
    /* v31z401: μόνο τα δικά μου (με τους φίλους η βάση επιτρέπει να διαβάζω και δικά τους). Αν λείπει η στήλη user_id, χωρίς φίλτρο όπως πριν. */
    var r; try{ r=await rest('records?select=kind,id,data,deleted,updated_at&user_id=eq.'+encodeURIComponent(sess.uid)+'&order=updated_at.asc&limit=10000'); }
    catch(eu){ if(/HTTP 400|42703|PGRST/.test(String(eu.message))&&!ls('alkyon-fr-on')) r=await rest('records?select=kind,id,data,deleted,updated_at&order=updated_at.asc&limit=10000'); else throw eu; }
    var rows=await r.json(), remote={}, got=0, needPh=[];
    rows.forEach(function(x){ remote[x.kind+'/'+x.id]=x; var u=Date.parse(x.updated_at)||0; if(Store.mergeIn(x.kind,x.id,x.data||{},x.deleted,(x.data&&x.data._u)||u)){ got++; if(!x.deleted&&x.data&&x.data.photo){ if(x.kind==='bites'){ needPh.push(x.id); for(var xi=1;xi<=(+x.data.xph||0);xi++) needPh.push(x.id+'~'+xi); } else if(x.kind==='tackle') needPh.push('tk-'+x.id); } } });
    if(got) Store.flush();
    // 2) αποστολή όσων είναι νεότερα τοπικά
    var out=[];
    KINDS.forEach(function(k){ Store.raw(k).forEach(function(o){ var rm=remote[k+'/'+o.id]; var ru=rm?((rm.data&&rm.data._u)||Date.parse(rm.updated_at)||0):0; if(!rm||(o._u||0)>ru) out.push({kind:k,id:o.id,data:o,deleted:false,updated_at:iso(o._u||Date.now())}); }); });
    Store.tombs().forEach(function(t){ var rm=remote[t.k+'/'+t.id]; var ru=rm?((rm.data&&rm.data._u)||Date.parse(rm.updated_at)||0):0; if(!rm||(!rm.deleted&&t.u>ru)) out.push({kind:t.k,id:t.id,data:{_u:t.u},deleted:true,updated_at:iso(t.u)}); });
    for(var i=0;i<out.length;i+=200) await rest('records',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(out.slice(i,i+200))});
    // 3) φωτογραφίες
    var up=0;
    var pl=[]; Store.raw('bites').forEach(function(b){ if(b.photo) pl.push(b.id); for(var xi=1;xi<=(+b.xph||0);xi++) pl.push(b.id+'~'+xi); }); pl=pl.concat(Store.raw('tackle').filter(function(b){ return b.photo; }).map(function(b){ return 'tk-'+b.id; }));
    for(var bi=0;bi<pl.length;bi++){ var pk=pl[bi]; if(pup[pk]) continue; var bl=null; try{ bl=await Photos.get(pk); }catch(e){} if(!bl) continue; var rr=await storage('POST','photos/'+sess.uid+'/'+pk+'.jpg',bl,'image/jpeg'); if(rr.ok){ pup[pk]=1; up++; } }
    ls('alkyon-pup',pup);
    var dl=0;
    for(var j=0;j<needPh.length;j++){ var id=needPh[j]; var have=null; try{ have=await Photos.get(id); }catch(e){} if(have){ pup[id]=1; continue; } var rs=await storage('GET','authenticated/photos/'+sess.uid+'/'+id+'.jpg'); if(rs.ok){ await Photos.put(id,await rs.blob()); pup[id]=1; dl++; } }
    ls('alkyon-pup',pup);
    if(dl) Store.flush();
    ls('alkyon-last',Date.now());
    status('Συγχρονίστηκε '+new Date().toLocaleTimeString(window.LANG==='en'?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'})+(got?' · ήρθαν '+got:'')+(out.length?' · στάλθηκαν '+out.length:''));
  }catch(e){
    if(/HTTP 4(01|03)|JWT|refresh_token|Refresh Token|invalid_grant/i.test(String(e.message))){ signedOut(); msg('Η σύνδεση έληξε. Συνδέσου ξανά.',true); }
    else if(/relation .*records|PGRST205|HTTP 404/.test(String(e.message))) status('Λείπει η βάση δεδομένων στο Supabase (πίνακας records).');
    else { var lastOk=ls('alkyon-last'); status(errText(e)+(lastOk?' '+(window.LANG==='en'?'Last successful sync: ':'Τελευταίος επιτυχής συγχρονισμός: ')+new Date(lastOk).toLocaleString(window.LANG==='en'?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'.':'')); try{ window.dispatchEvent(new CustomEvent('alkyon-syncfail')); }catch(x){} }
  }
  busy=false;
  if(again){ again=false; sched(); }
}
function sched(){ if(!sess) return; clearTimeout(timer); timer=setTimeout(function(){ sync(false); },2500); }
Store.hook(function(k,id){
  if(!sess) return;
  if(k==='bites'){ var still=Store.raw('bites').some(function(b){return b.id===id;}); if(!still&&sess){ storage('DELETE','photos/'+sess.uid+'/'+id+'.jpg').catch(function(){}); delete pup[id]; ls('alkyon-pup',pup); } }
  if(k==='tackle'){ var st2=Store.raw('tackle').some(function(b){return b.id===id;}); if(!st2&&sess){ storage('DELETE','photos/'+sess.uid+'/tk-'+id+'.jpg').catch(function(){}); delete pup['tk-'+id]; ls('alkyon-pup',pup); } }
  sched();
});
window.addEventListener('online',function(){ sched(); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden) sched(); });

/* ---------- Οθόνη λογαριασμού ---------- */
function status(m){ var e=$('acStatus'); if(e) e.textContent=m||''; }
function msg(m,bad){ var e=$('gMsg'); if(e){ e.textContent=m||''; e.style.color=''; e.classList.toggle('bad',!!bad); e.setAttribute('role',bad?'alert':'status'); } }
function gate(on){ document.documentElement.classList.toggle('gated',!!on); if(!on){ try{ window.dispatchEvent(new Event('resize')); }catch(e){} } }
function render(){
  gate(!sess);
  var nm=sess?(sess.name||''):'', em=sess?(sess.email||''):'', ch=(nm||em||'?').trim().charAt(0).toUpperCase();
  if($('acWho')) $('acWho').textContent=em;
  if($('profBtn')) $('profBtn').textContent=ch;
  if($('pAvatar')) $('pAvatar').textContent=ch;
  if($('pNameShow')) $('pNameShow').textContent=nm||em;
  if($('pName')&&document.activeElement!==$('pName')) $('pName').value=nm;
  if($('pName')) $('pName').placeholder=window.LANG==='en'?'Your name':'Το όνομά σου';
  if(sess&&$('acStatus')&&!$('acStatus').textContent){ var l=ls('alkyon-last'); if(l) $('acStatus').textContent='Τελευταίος συγχρονισμός '+new Date(l).toLocaleString(window.LANG==='en'?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
}
function localCount(){ return Store.raw('spots').length+Store.raw('trips').length+Store.raw('bites').length; }
async function afterLogin(j){
  var prev=ls('alkyon-uid'); setSess(j);
  if(prev&&prev!==sess.uid&&localCount()>0){
    if(await window.AlkyonAsk(window.LANG==='en'?'This device holds data from another account. Delete it, or keep it and add it to the new account?':'Σε αυτή τη συσκευή υπάρχουν δεδομένα άλλου λογαριασμού. Να σβηστούν ή να προστεθούν και στον νέο λογαριασμό;',{title:window.LANG==='en'?'Another account':'Άλλος λογαριασμός',ok:window.LANG==='en'?'Delete data':'Σβήσιμο',cancel:window.LANG==='en'?'Keep and add':'Κράτα και πρόσθεσε',danger:true})){ Store.wipe(); pup={}; ls('alkyon-pup',pup); }
  }
  ls('alkyon-uid',sess.uid); msg(''); $('gPass').value=''; render();
  await sync(true);
}
async function doLogin(signup){
  var em=$('gEmail').value.trim(), pw=$('gPass').value;
  if(!em||!pw){ msg('Γράψε email και κωδικό.',true); return; }
  $('gLogin').disabled=$('gSignup').disabled=true; msg(signup?'Δημιουργία λογαριασμού…':'Σύνδεση…');
  try{
    if(signup){
      var j=await auth('signup?redirect_to='+encodeURIComponent(siteUrl()),{email:em,password:pw});
      if(j.access_token){ await afterLogin(j); }
      else showCode('signup',em);
    }else{
      await afterLogin(await auth('token?grant_type=password',{email:em,password:pw}));
    }
  }catch(e){ if(/Email not confirmed/i.test(String(e&&e.message))){ showCode('signup',em); msg(errText(e),true); } else msg(errText(e),true); }
  $('gLogin').disabled=$('gSignup').disabled=false;
}
function signedOut(){ sess=null; ls('alkyon-sess',null); ls('alkyon-last',null); if($('acStatus')) $('acStatus').textContent=''; render(); }

function siteUrl(){ try{ return location.origin+location.pathname; }catch(e){ return 'https://dinospapani.github.io/Alkyon/'; } }
/* Σύνδεσμοι από email (επιβεβαίωση εγγραφής, επαναφορά κωδικού): #access_token=...&type=signup|recovery */
function newPassDialog(){
  var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
  var ov=document.createElement('div'); ov.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:16px';
  var cd=document.createElement('div'); cd.className='card'; cd.style.cssText='width:100%;max-width:380px';
  var h=document.createElement('h3'); h.textContent=T('Νέος κωδικός','New password');
  var p=document.createElement('p'); p.className='note'; p.textContent=T('Γράψε νέο κωδικό (τουλάχιστον 6 χαρακτήρες).','Enter a new password (at least 6 characters).');
  var i=document.createElement('input'); i.type='password'; i.autocomplete='new-password'; i.setAttribute('aria-label',T('Νέος κωδικός','New password')); i.style.cssText='width:100%;margin:8px 0';
  var m=document.createElement('p'); m.className='note'; m.setAttribute('role','status');
  var row=document.createElement('div'); row.className='row';
  var b=document.createElement('button'); b.type='button'; b.className='btn acc'; b.textContent=T('Αποθήκευση','Save');
  var x=document.createElement('button'); x.type='button'; x.className='btn ghost'; x.textContent=T('Αργότερα','Later');
  row.append(b,x); cd.append(h,p,i,m,row); ov.append(cd); document.body.appendChild(ov); try{ i.focus(); }catch(e){}
  x.addEventListener('click',function(){ ov.remove(); });
  b.addEventListener('click',async function(){
    var pw=i.value; if(pw.length<6){ m.textContent=T('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.','The password must be at least 6 characters.'); return; }
    b.disabled=true;
    try{ await ensure(); var r=await fetch(URL_+'/auth/v1/user',{method:'PUT',headers:H(),body:JSON.stringify({password:pw})}); var jj={}; try{ jj=await r.json(); }catch(z){} if(!r.ok) throw new Error(jj.msg||jj.message||('HTTP '+r.status)); ov.remove(); toast(T('Ο κωδικός άλλαξε.','Password changed.')); }
    catch(e){ m.textContent=errText(e); b.disabled=false; }
  });
}
async function handleLink(){
  var hs=location.hash||''; if(hs.length<2||!/access_token=|error=/.test(hs)) return;
  var p=new URLSearchParams(hs.slice(1)), EN=window.LANG==='en';
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  if(p.get('error')){ msg(EN?'The link has expired or was already used. Request a new one.':'Ο σύνδεσμος έληξε ή έχει ήδη χρησιμοποιηθεί. Ζήτησε νέο.',true); return; }
  var tok=p.get('access_token'); if(!tok) return;
  try{
    var r=await fetch(URL_+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+tok}}); var u={}; try{ u=await r.json(); }catch(e){}
    if(!r.ok) throw new Error(u.msg||u.message||('HTTP '+r.status));
    await afterLogin({access_token:tok,refresh_token:p.get('refresh_token'),expires_in:+p.get('expires_in')||3600,user:u});
    if(p.get('type')==='recovery') newPassDialog(); else toast(EN?'Email confirmed. You are signed in.':'Το email επιβεβαιώθηκε. Είσαι συνδεδεμένος.');
  }catch(e){ msg(errText(e),true); }
}

/* Κωδικός από το email (6 ψηφία): δουλεύει και μέσα στην εγκατεστημένη εφαρμογή, χωρίς ανακατεύθυνση σε σύνδεσμο */
var codeBox=null, codeType='signup', codeEmail='';
function showCode(type,em){
  var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
  codeType=type; codeEmail=em;
  if(!codeBox){
    codeBox=document.createElement('div'); codeBox.id='gCodeBox'; codeBox.className='gcode';
    codeBox.style.cssText='margin-top:12px;padding-top:12px;border-top:1px solid rgba(128,150,170,.3)';
    var lb=document.createElement('label'); lb.className='f'; lb.id='gCodeLab';
    var inp=document.createElement('input'); inp.type='text'; inp.id='gCode'; inp.inputMode='numeric'; inp.autocomplete='one-time-code'; inp.maxLength=10; inp.style.cssText='text-align:center;letter-spacing:6px;font-size:22px';
    lb.append(document.createTextNode(''),inp);
    var row=document.createElement('div'); row.className='row';
    var ok=document.createElement('button'); ok.type='button'; ok.className='btn'; ok.id='gCodeOk';
    var rs=document.createElement('button'); rs.type='button'; rs.className='btn ghost'; rs.id='gCodeRs';
    row.append(ok,rs); codeBox.append(lb,row);
    var after=$('gForgot'); after.parentNode.insertBefore(codeBox,after.nextSibling);
    ok.addEventListener('click',verifyCode);
    inp.addEventListener('keydown',function(e){ if(e.key==='Enter') verifyCode(); });
    rs.addEventListener('click',async function(){
      var T2=function(a,b){ return window.LANG==='en'?b:a; };
      rs.disabled=true; setTimeout(function(){ rs.disabled=false; },30000);
      try{
        if(codeType==='recovery') await auth('recover?redirect_to='+encodeURIComponent(siteUrl()),{email:codeEmail});
        else await auth('resend',{type:'signup',email:codeEmail,options:{emailRedirectTo:siteUrl()}});
        msg(T2('Στάλθηκε νέος κωδικός. Έλεγξε και τα ανεπιθύμητα.','A new code was sent. Check spam too.'));
      }catch(e){ msg(errText(e),true); }
    });
  }
  codeBox.firstChild.firstChild.nodeValue=T('Κωδικός από το email','Code from the email');
  $('gCodeOk').textContent=T('Επιβεβαίωση','Confirm'); $('gCodeRs').textContent=T('Νέος κωδικός','Resend code');
  codeBox.hidden=false; $('gCode').value='';
  msg(type==='recovery'
    ?T('Στάλθηκε email. Γράψε τον κωδικό που περιέχει (ή πάτα τον σύνδεσμο).','We sent an email. Enter the code it contains (or tap the link).')
    :T('Στάλθηκε email επιβεβαίωσης. Γράψε τον κωδικό που περιέχει (ή πάτα τον σύνδεσμο) και θα συνδεθείς αυτόματα.','We sent a confirmation email. Enter the code it contains (or tap the link) and you will be signed in automatically.'));
  try{ $('gCode').focus(); }catch(e){}
}
async function verifyCode(){
  var EN=window.LANG==='en', code=($('gCode').value||'').replace(/\s+/g,'');
  if(!/^\d{6,10}$/.test(code)){ msg(EN?'Enter the numeric code from the email.':'Γράψε τον αριθμητικό κωδικό από το email.',true); return; }
  $('gCodeOk').disabled=true; msg(EN?'Checking…':'Έλεγχος…');
  try{
    var j=await auth('verify',{type:codeType,email:codeEmail,token:code});
    if(!j.access_token) throw new Error('Invalid');
    var t=codeType; codeBox.hidden=true;
    await afterLogin(j);
    if(t==='recovery') newPassDialog(); else toast(EN?'Email confirmed. You are signed in.':'Το email επιβεβαιώθηκε. Είσαι συνδεδεμένος.');
  }catch(e){ msg(/expired|invalid|Token/i.test(String(e&&e.message))?(EN?'Wrong or expired code. Tap “Resend code”.':'Λάθος ή ληγμένος κωδικός. Πάτα «Νέος κωδικός».'):errText(e),true); }
  $('gCodeOk').disabled=false;
}
function wire(){
  if(!$('gate')) return;
  $('gLogin').addEventListener('click',function(){ doLogin(false); });
  $('gSignup').addEventListener('click',function(){ doLogin(true); });
  $('gPass').addEventListener('keydown',function(e){ if(e.key==='Enter') doLogin(false); });
  $('gForgot').addEventListener('click',async function(){
    var em=$('gEmail').value.trim(); if(!em){ msg('Γράψε πρώτα το email σου.',true); return; }
    try{ await auth('recover?redirect_to='+encodeURIComponent(siteUrl()),{email:em}); showCode('recovery',em); }catch(e){ msg(errText(e),true); }
  });
  var l2=$('langSel2'); if(l2){ l2.value=window.LANG||'el'; l2.addEventListener('change',function(){ window.setLang(l2.value); }); }
  function pmsg(m,bad){ var e=$('pMsg'); if(e){ e.textContent=m||''; e.style.color=bad?'#ff8a80':''; } }
  function openP(on){ if($('profile')) $('profile').hidden=!on; if(on){ pmsg(''); render(); } }
  if($('profBtn')) $('profBtn').addEventListener('click',function(){ openP(true); });
  if($('pClose')) $('pClose').addEventListener('click',function(){ openP(false); });
  if($('profile')) $('profile').addEventListener('click',function(e){ if(e.target===$('profile')) openP(false); });
  if($('pNameSave')) $('pNameSave').addEventListener('click',async function(){
    var n=$('pName').value.trim();
    try{ await ensure(); var r=await fetch(URL_+'/auth/v1/user',{method:'PUT',headers:H(),body:JSON.stringify({data:{name:n}})}); if(!r.ok) throw new Error('HTTP '+r.status); sess.name=n; ls('alkyon-sess',sess); render(); pmsg('Το όνομα αποθηκεύτηκε.'); }catch(e){ pmsg(errText(e),true); }
  });
  if($('pPassSave')) $('pPassSave').addEventListener('click',async function(){
    var pw=$('pPass').value; if(pw.length<6){ pmsg('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.',true); return; }
    try{ await ensure(); var r=await fetch(URL_+'/auth/v1/user',{method:'PUT',headers:H(),body:JSON.stringify({password:pw})}); var jj={}; try{ jj=await r.json(); }catch(x){} if(!r.ok) throw new Error(jj.msg||jj.message||('HTTP '+r.status)); $('pPass').value=''; pmsg('Ο κωδικός άλλαξε.'); }catch(e){ pmsg(errText(e),true); }
  });
  if($('acSync')) $('acSync').addEventListener('click',function(){ sync(true); });
  if($('acLogout')) $('acLogout').addEventListener('click',async function(){
    if(busy) return;
    await sync(true);
    var en=window.LANG==='en';
    var okk=await window.AlkyonAsk(en?'Sign out of your account? Your data stays on this phone and in your account.':'Αποσύνδεση από τον λογαριασμό; Τα δεδομένα σου μένουν στο κινητό και στον λογαριασμό σου.',{title:en?'Sign out':'Αποσύνδεση',ok:en?'Sign out':'Αποσύνδεση',cancel:en?'Cancel':'Άκυρο'});
    if(!okk) return;
    try{ await fetch(URL_+'/auth/v1/logout',{method:'POST',headers:H()}); }catch(e){}
    openP(false); signedOut();
  });
  render();
  if(sess) setTimeout(function(){ sync(false); },1200);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ wire(); handleLink(); }); else { wire(); handleLink(); }
})();
