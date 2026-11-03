/* Alkyon 1.4.0 · λογαριασμός: σύνδεση, εγγραφή, κωδικός από το email, «Ξέχασα τον κωδικό», σύνδεσμοι από email.
   · B.authForm(o) → φόρμα (για το Προφίλ) · B.authSheet(o) → η ίδια φόρμα σε παράθυρο
     o.mode 'in' | 'up', o.reason: γιατί χρειάζεται (π.χ. «Οι φίλοι βλέπουν…»), o.done(): μετά τη σύνδεση
   · B.accountBtn(reason, label) → κουμπί που ανοίγει το παράθυρο (για Φίλους, Κοινότητα, ρολόι, ασφάλεια)
   · B.needAccount(reason, then) → αν είσαι συνδεδεμένος τρέχει το then, αλλιώς ζητά σύνδεση και μετά το τρέχει
   · σύνδεσμοι από email (#access_token=…&type=signup|recovery ή #error=…): τους χειρίζεται εδώ, όχι η κλασική
   · πρόταση λογαριασμού: μία φορά μετά το πρώτο ψάρι (αν δεν έχεις λογαριασμό) */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls;
function C(){ return B.cloud; }
function logged(){ return !!(C()&&C().session()); }

/* ---------- σύνδεσμος από email: διαβάζεται πριν ανοίξει η πρώτη σελίδα ---------- */
var link=null;
(function(){ var hs=location.hash||''; if(!/(^#|&)(access_token|error|error_description)=/.test(hs)) return;
  var p={}; hs.slice(1).split('&').forEach(function(kv){ var i=kv.indexOf('='); if(i>0) p[decodeURIComponent(kv.slice(0,i))]=decodeURIComponent(kv.slice(i+1).replace(/\+/g,' ')); });
  link=p; try{ history.replaceState(null,'',location.pathname+location.search+'#profile'); }catch(e){} })();
function doLink(){ if(!link) return; var p=link; link=null;
  if(p.error||p.error_description||!p.access_token){ msgSheet(T('Ο σύνδεσμος δεν δούλεψε','The link did not work'),T('Ο σύνδεσμος έληξε ή έχει ήδη χρησιμοποιηθεί. Πάτα «Σύνδεση» και, αν χρειάζεται, «Ξέχασα τον κωδικό» για νέο email.','The link has expired or was already used. Tap “Sign in” and, if needed, “Forgot password” for a new email.'),true); return; }
  var viaG=!p.type||p.type==='oauth'||!!p.provider_token||!!ls.get('alkyon-v4-oauth',0); try{ ls.set('alkyon-v4-oauth',0); }catch(e){}
  C().fromLink(p).then(function(){ remount(); /* πρώτα ξαναζωγραφίζεται το Προφίλ (κλείνει ό,τι παράθυρο είναι ανοιχτό), μετά το μήνυμα */ if(p.type==='recovery') newPassSheet(); else B.toast(viaG&&p.type!=='signup'?T('Συνδέθηκες με Google.','Signed in with Google.'):T('Το email επιβεβαιώθηκε. Είσαι συνδεδεμένος.','Email confirmed. You are signed in.'),5000); })
    .catch(function(e){ msgSheet(T('Ο σύνδεσμος δεν δούλεψε','The link did not work'),err(e),true); }); }
function remount(){ if(B.remount) B.remount(); }
function msgSheet(title,text,withSignIn){ var sh=B.sheet({title:title,body:h('div',{class:'bform'},h('p',{class:'sub',text:text}),
  withSignIn?h('button',{class:'btn pri full',type:'button',text:T('Σύνδεση','Sign in'),onclick:function(){ sh.close(); B.authSheet({mode:'in'}); }}):null)}); }

/* ---------- μηνύματα σφάλματος ---------- */
function err(e){ var m=String(e&&e.message||e);
  if(/expired|invalid.*(otp|token)|token.*(expired|invalid)|otp/i.test(m)) return T('Λάθος ή ληγμένος κωδικός. Πάτα «Νέος κωδικός».','Wrong or expired code. Tap “Resend code”.');
  if(/same.*password|different from the old/i.test(m)) return T('Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον παλιό.','The new password must be different from the old one.');
  return C().errText(e); }

/* ---------- φόρμα ---------- */
/* 1.4.4: κουμπί «ματάκι» στο πεδίο κωδικού */
var EYE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    EYEX='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function pwField(attrs){ var inp=h('input',Object.assign({type:'password'},attrs)), b=h('button',{type:'button',class:'eye','aria-label':T('Εμφάνιση κωδικού','Show password'),html:EYE});
  b.addEventListener('click',function(){ var show=inp.type==='password'; inp.type=show?'text':'password'; b.innerHTML=show?EYEX:EYE; b.setAttribute('aria-label',show?T('Απόκρυψη κωδικού','Hide password'):T('Εμφάνιση κωδικού','Show password')); try{ inp.focus(); }catch(e){} });
  return {input:inp,el:h('div',{class:'pwwrap'},inp,b)}; }
/* 1.4.4: ο κωδικός που περιμένουμε από το email κρατιέται (30′), ώστε αν πας στο email και γυρίσεις, η φόρμα να είναι εκεί που την άφησες */
var PK='alkyon-v4-pendcode';
function pend(){ var p=ls.get(PK,null); return p&&p.email&&Date.now()-p.t<30*60000?p:null; }
function setPend(v){ ls.set(PK,v); }
B.authForm=function(o){ o=o||{}; var mode=o.mode==='up'?'up':'in', codeType='signup', codeEmail='';
  var em=h('input',{type:'email',autocomplete:'email',inputmode:'email',placeholder:'email','aria-label':'Email'});
  var P=pwField({autocomplete:'current-password',placeholder:T('Κωδικός','Password'),'aria-label':T('Κωδικός','Password')}), pw=P.input;
  var msg=h('p',{class:'err',role:'alert'}), go=h('button',{class:'btn pri full',type:'submit'}), sw=h('button',{class:'link swm',type:'button'});
  var fg=h('button',{class:'link fgt',type:'button',text:T('Ξέχασα τον κωδικό','Forgot password')});
  var ttl=h('h2'), sub=h('p',{class:'sub',text:o.reason||T('Με λογαριασμό τα ψάρια, οι έξοδοι και οι φωτογραφίες σου κρατιούνται και σε άλλο κινητό.','With an account your catches, trips and photos are kept on any phone.')});
  /* 1.5.0: «Συνέχεια με Google» (μόνο αν είναι ενεργό στο Supabase) */
  var G='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  var gbtn=h('button',{class:'btn full gbtn',type:'button',html:G+'<span>'+T('Συνέχεια με Google','Continue with Google')+'</span>',onclick:function(){ try{ ls.set('alkyon-v4-oauth',Date.now()); }catch(e){} location.href=C().oauthUrl('google'); }});
  var gbox=h('div',{class:'gbox',hidden:true},gbtn,h('div',{class:'orline'},h('span',{text:T('ή με email','or with email')})));
  if(C().providers) C().providers().then(function(p){ if(p&&p.google) gbox.hidden=false; });
  var main=h('div',{class:'authmain'},ttl,sub,gbox,h('label',{class:'fld'},h('span',{text:'Email'}),em),h('label',{class:'fld'},h('span',{text:T('Κωδικός','Password')}),P.el));
  /* βήμα κωδικού: δουλεύει και μέσα στην εγκατεστημένη εφαρμογή, χωρίς να ανοίξει ο σύνδεσμος στον browser */
  var ci=h('input',{type:'text',inputmode:'numeric',autocomplete:'one-time-code',maxlength:'10',class:'codein',placeholder:'••••••','aria-label':T('Κωδικός από το email','Code from the email')});
  var cttl=h('h2'), cinfo=h('p',{class:'sub'});
  var cok=h('button',{class:'btn pri full',type:'button',text:T('Επιβεβαίωση','Confirm')});
  var cps=navigator.clipboard&&navigator.clipboard.readText?h('button',{class:'btn',type:'button',text:'📋 '+T('Επικόλληση','Paste')}):null;
  var crs=h('button',{class:'btn',type:'button',text:T('Νέος κωδικός','Resend code')});
  var cbk=h('button',{class:'link',type:'button',text:T('‹ Άλλο email','‹ Different email')});
  var cbox=h('div',{class:'codebox',hidden:true},cttl,cinfo,h('label',{class:'fld'},h('span',{text:T('Κωδικός από το email','Code from the email')}),ci),cok,h('div',{class:'inrow'},cps,crs),cbk);
  function say(t,good){ msg.textContent=t||''; msg.style.color=good?'var(--good)':''; }
  function paint(){ ttl.textContent=mode==='in'?T('Σύνδεση','Sign in'):T('Νέος λογαριασμός','New account');
    go.textContent=mode==='in'?T('Σύνδεση','Sign in'):T('Δημιουργία λογαριασμού','Create account');
    sw.textContent=mode==='in'?T('Δεν έχεις λογαριασμό; Δημιούργησε έναν','No account? Create one'):T('Έχεις ήδη λογαριασμό; Σύνδεση','Already have an account? Sign in');
    pw.autocomplete=mode==='in'?'current-password':'new-password'; fg.hidden=mode!=='in'; }
  function step(code){ main.hidden=code; go.hidden=code; sw.hidden=code; fg.hidden=code||mode!=='in'; cbox.hidden=!code; if(!code) paint(); }
  function ok(t){ setPend(null); B.toast(t||T('Συνδέθηκες.','Signed in.')); if(o.close) o.close(); if(o.done) o.done(); else remount(); }
  function showCode(type,email,text,keepT){ codeType=type; codeEmail=email; if(!keepT) setPend({type:type,email:email,t:Date.now()});
    cttl.textContent=type==='recovery'?T('Νέος κωδικός πρόσβασης','Reset password'):T('Επιβεβαίωση email','Confirm your email');
    cinfo.textContent=(type==='recovery'?T('Στείλαμε κωδικό στο ','We sent a code to '):T('Στείλαμε κωδικό επιβεβαίωσης στο ','We sent a confirmation code to '))+email+T('. Γράψ\' τον εδώ (ή πάτα τον σύνδεσμο στο email). Δες και τα ανεπιθύμητα.','. Enter it here (or tap the link in the email). Check spam too.');
    ci.value=''; step(true); say(text||'',true); try{ ci.focus(); }catch(e){} }
  sw.addEventListener('click',function(){ mode=mode==='in'?'up':'in'; say(''); paint(); });
  cbk.addEventListener('click',function(){ setPend(null); say(''); em.value=codeEmail||em.value; step(false); });
  fg.addEventListener('click',function(){ var a=em.value.trim(); if(!a){ say(T('Γράψε πρώτα το email σου.','Enter your email first.')); em.focus(); return; }
    fg.disabled=true; C().recover(a).then(function(){ fg.disabled=false; showCode('recovery',a); }).catch(function(e){ fg.disabled=false; say(err(e)); }); });
  function verify(){ var code=(ci.value||'').replace(/\D+/g,''); if(!/^\d{6,10}$/.test(code)){ say(T('Γράψε τον αριθμητικό κωδικό από το email.','Enter the numeric code from the email.')); return; }
    cok.disabled=true; say(T('Έλεγχος…','Checking…'),true);
    C().verify(codeType,codeEmail,code).then(function(){ cok.disabled=false; setPend(null); if(codeType==='recovery'){ if(o.close) o.close(); newPassSheet(o.done); } else ok(T('Το email επιβεβαιώθηκε. Είσαι συνδεδεμένος.','Email confirmed. You are signed in.')); })
      .catch(function(e){ cok.disabled=false; say(err(e)); }); }
  cok.addEventListener('click',verify); ci.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); verify(); } });
  /* επικόλληση: από το κουμπί ή με παρατεταμένο πάτημα στο πεδίο· μετά επιβεβαιώνει αμέσως */
  ci.addEventListener('paste',function(){ setTimeout(function(){ ci.value=(ci.value||'').replace(/\D+/g,'').slice(0,10); if(/^\d{6,10}$/.test(ci.value)) verify(); },0); });
  if(cps) cps.addEventListener('click',function(){ navigator.clipboard.readText().then(function(x){ var d=String(x||'').replace(/\D+/g,'').slice(0,10); if(!d){ say(T('Δεν βρέθηκε κωδικός στο πρόχειρο. Αντέγραψε πρώτα τον κωδικό από το email.','No code in the clipboard. Copy the code from the email first.')); return; } ci.value=d; verify(); }).catch(function(){ try{ ci.focus(); }catch(e){} say(T('Κράτα πατημένο το πεδίο και διάλεξε «Επικόλληση».','Long-press the field and choose “Paste”.')); }); });
  crs.addEventListener('click',function(){ crs.disabled=true; setTimeout(function(){ crs.disabled=false; },30000);
    (codeType==='recovery'?C().recover(codeEmail):C().resend(codeEmail)).then(function(){ setPend({type:codeType,email:codeEmail,t:Date.now()}); say(T('Στάλθηκε νέος κωδικός. Δες και τα ανεπιθύμητα.','A new code was sent. Check spam too.'),true); }).catch(function(e){ say(err(e)); }); });
  var f=h('form',{class:'bform authf',novalidate:true},main,cbox,msg,go,sw,fg);
  f.addEventListener('submit',function(e){ e.preventDefault(); if(!cbox.hidden){ verify(); return; } say(''); var a=em.value.trim(), b=pw.value; if(!a||!b){ say(T('Συμπλήρωσε email και κωδικό.','Fill in email and password.')); return; }
    go.disabled=true; (mode==='in'?C().signIn(a,b):C().signUp(a,b)).then(function(r){ go.disabled=false;
      if(r==='confirm'){ showCode('signup',a); return; }
      ok(); })
    .catch(function(e2){ go.disabled=false; if(/Email not confirmed/i.test(String(e2&&e2.message))){ C().resend(a).catch(function(){}); showCode('signup',a,T('Το email δεν είχε επιβεβαιωθεί, οπότε στείλαμε νέο κωδικό.','Your email was not confirmed yet, so we sent a new code.')); return; } say(err(e2)); }); });
  paint();
  /* αν περιμέναμε κωδικό (π.χ. πήγες στο email και γύρισες), η φόρμα ανοίγει κατευθείαν στο βήμα του κωδικού */
  var pd=!logged()&&pend(); if(pd) showCode(pd.type,pd.email,'',true);
  return f; };
B.authSheet=function(o){ o=Object.assign({},o||{}); var sh; o.close=function(){ sh&&sh.close(); }; sh=B.sheet({title:T('Λογαριασμός','Account'),body:B.authForm(o)}); return sh; };
B.accountBtn=function(reason,label){ return h('button',{class:'btn pri',type:'button',text:label||T('Σύνδεση ή νέος λογαριασμός','Sign in or create account'),onclick:function(){ B.authSheet({reason:reason}); }}); };
B.needAccount=function(reason,then){ if(logged()){ then&&then(); return; } B.authSheet({mode:'up',reason:reason,done:function(){ remount(); then&&then(); }}); };

/* ---------- νέος κωδικός (μετά από «Ξέχασα τον κωδικό») ---------- */
function newPassSheet(after){ var sh, NP=pwField({autocomplete:'new-password','aria-label':T('Νέος κωδικός','New password')}), pw=NP.input, msg=h('p',{class:'err',role:'alert'});
  var go=h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ var v=pw.value; if(v.length<6){ msg.textContent=T('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.','The password needs at least 6 characters.'); return; }
    go.disabled=true; C().setPassword(v).then(function(){ sh.close(); B.toast(T('Ο νέος κωδικός αποθηκεύτηκε. Είσαι συνδεδεμένος.','New password saved. You are signed in.'),5000); if(after) after(); else remount(); }).catch(function(e){ go.disabled=false; msg.textContent=err(e); }); }});
  sh=B.sheet({title:T('Νέος κωδικός','New password'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Γράψε νέο κωδικό (τουλάχιστον 6 χαρακτήρες).','Enter a new password (at least 6 characters).')}),h('label',{class:'fld'},h('span',{text:T('Νέος κωδικός','New password')}),NP.el),msg,go)});
  setTimeout(function(){ try{ pw.focus(); }catch(e){} },300); }
B.newPassSheet=newPassSheet;

/* ---------- πρόταση λογαριασμού μία φορά, μετά το πρώτο ψάρι ---------- */
var ASK='alkyon-v4-acctask';
function nBites(){ try{ return B.store.raw('bites').filter(function(b){ return !b.deleted; }).length; }catch(e){ return 0; } }
B.on('store',function(k){ if(k!=='alkyon-bites'||logged()||ls.get(ASK,0)) return; if(nBites()<1) return;
  ls.set(ASK,Date.now());
  setTimeout(function(){ if(logged()||document.querySelector('.sheet')){ if(!logged()) ls.set(ASK,0); return; }
    var sh=B.sheet({title:T('Να κρατήσουμε αντίγραφο;','Keep a backup?'),body:h('div',{class:'bform'},
      h('p',{class:'sub',text:T('Το πρώτο σου ψάρι είναι μόνο σε αυτό το κινητό. Με δωρεάν λογαριασμό κρατιέται και στο cloud, ώστε να μη χαθεί αν αλλάξεις ή χάσεις το κινητό, και το βλέπεις και σε άλλη συσκευή.','Your first catch is only on this phone. With a free account it is also kept in the cloud, so it is not lost if you change or lose your phone, and you can see it on other devices.')}),
      h('button',{class:'btn pri full',type:'button',text:T('Δημιουργία λογαριασμού','Create account'),onclick:function(){ sh.close(); B.authSheet({mode:'up'}); }}),
      h('button',{class:'btn full',type:'button',text:T('Όχι τώρα','Not now'),onclick:function(){ sh.close(); }}))}); },1800); });

/* ---------- 1.4.5: δεδομένα άλλου λογαριασμού στο κινητό ---------- */
var askOpen=false;
B.on('owner-ask',function(ow){ if(askOpen) return; askOpen=true; var s=C().session()||{}, n=C().localCount(), old=(ow&&ow.email)||T('άλλο λογαριασμό','another account'), sh;
  function go(ch){ sh.close(); C().ownerChoice(ch).then(function(){ B.toast(ch==='separate'?T('Φορτώθηκαν τα δεδομένα του ','Loaded the data of ')+(s.email||''):T('Τα δεδομένα μπήκαν και σε αυτόν τον λογαριασμό.','The data was added to this account too.'),5000); remount(); }); }
  setTimeout(function(){ sh=B.sheet({title:T('Δεδομένα άλλου λογαριασμού','Data from another account'),body:h('div',{class:'bform'},
    h('p',{class:'sub',text:T('Σε αυτό το κινητό υπάρχουν '+n+' εγγραφές (ψάρια, έξοδοι, σημεία, εξοπλισμός) του λογαριασμού ','This phone has '+n+' records (catches, trips, spots, tackle) from the account ')+old+T('. Τώρα συνδέθηκες ως ','. You are now signed in as ')+(s.email||'')+'.'}),
    h('button',{class:'btn pri full',type:'button',text:T('Κράτα τα χωριστά','Keep them separate'),onclick:function(){ go('separate'); }}),
    h('p',{class:'foot',text:T('Σβήνονται από το κινητό και φορτώνονται τα δεδομένα του ','They are removed from this phone and the data of ')+(s.email||'')+T('. Μένουν στον λογαριασμό ',' is loaded. They stay in the account ')+old+T(' και επιστρέφουν αν ξανασυνδεθείς με αυτόν.',' and come back if you sign in with it again.')}),
    h('button',{class:'btn full',type:'button',text:T('Πρόσθεσέ τα και σε αυτόν τον λογαριασμό','Add them to this account too'),onclick:function(){ go('merge'); }}),
    h('p',{class:'foot',text:T('Π.χ. αν είναι δικά σου και άλλαξες λογαριασμό.','E.g. if they are yours and you changed account.')}),
    h('button',{class:'linkbtn',type:'button',text:T('Αποσύνδεση','Sign out'),onclick:function(){ sh.close(); C().signOut({}).then(function(){ remount(); }); }})),onclose:function(){ askOpen=false; }}); },400); });

/* ---------- εκκίνηση ---------- */
setTimeout(doLink,400);
})();
