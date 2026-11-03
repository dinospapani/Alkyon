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
  C().fromLink(p).then(function(){ remount(); /* πρώτα ξαναζωγραφίζεται το Προφίλ (κλείνει ό,τι παράθυρο είναι ανοιχτό), μετά το μήνυμα */ if(p.type==='recovery') newPassSheet(); else B.toast(T('Το email επιβεβαιώθηκε. Είσαι συνδεδεμένος.','Email confirmed. You are signed in.'),5000); })
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
B.authForm=function(o){ o=o||{}; var mode=o.mode==='up'?'up':'in', codeType='signup', codeEmail='';
  var em=h('input',{type:'email',autocomplete:'email',inputmode:'email',placeholder:'email','aria-label':'Email'});
  var pw=h('input',{type:'password',autocomplete:'current-password',placeholder:T('Κωδικός','Password'),'aria-label':T('Κωδικός','Password')});
  var msg=h('p',{class:'err',role:'alert'}), go=h('button',{class:'btn pri full',type:'submit'}), sw=h('button',{class:'link',type:'button'});
  var fg=h('button',{class:'link',type:'button',text:T('Ξέχασα τον κωδικό','Forgot password')});
  var ttl=h('h2'), sub=h('p',{class:'sub',text:o.reason||T('Με λογαριασμό τα ψάρια, οι έξοδοι και οι φωτογραφίες σου κρατιούνται και σε άλλο κινητό.','With an account your catches, trips and photos are kept on any phone.')});
  var pwF=h('label',{class:'fld'},h('span',{text:T('Κωδικός','Password')}),pw);
  /* κωδικός από το email: δουλεύει και μέσα στην εγκατεστημένη εφαρμογή, χωρίς να ανοίξει ο σύνδεσμος στον browser */
  var ci=h('input',{type:'text',inputmode:'numeric',autocomplete:'one-time-code',maxlength:'10',class:'codein','aria-label':T('Κωδικός από το email','Code from the email')});
  var cok=h('button',{class:'btn pri',type:'button',text:T('Επιβεβαίωση','Confirm')}), crs=h('button',{class:'btn',type:'button',text:T('Νέος κωδικός','Resend code')});
  var cbox=h('div',{class:'codebox',hidden:true},h('label',{class:'fld'},h('span',{text:T('Κωδικός από το email','Code from the email')}),ci),h('div',{class:'inrow'},cok,crs));
  function say(t,good){ msg.textContent=t||''; msg.style.color=good?'var(--good)':''; }
  function paint(){ ttl.textContent=mode==='in'?T('Σύνδεση','Sign in'):T('Νέος λογαριασμός','New account');
    go.textContent=mode==='in'?T('Σύνδεση','Sign in'):T('Δημιουργία λογαριασμού','Create account');
    sw.textContent=mode==='in'?T('Δεν έχεις λογαριασμό; Δημιούργησε έναν','No account? Create one'):T('Έχεις ήδη λογαριασμό; Σύνδεση','Already have an account? Sign in');
    pw.autocomplete=mode==='in'?'current-password':'new-password'; fg.hidden=mode!=='in'; }
  function ok(t){ B.toast(t||T('Συνδέθηκες.','Signed in.')); if(o.close) o.close(); if(o.done) o.done(); else remount(); }
  function showCode(type,email,text){ codeType=type; codeEmail=email; cbox.hidden=false; ci.value=''; say(text,true); try{ ci.focus(); }catch(e){} }
  sw.addEventListener('click',function(){ mode=mode==='in'?'up':'in'; say(''); cbox.hidden=true; paint(); });
  fg.addEventListener('click',function(){ var a=em.value.trim(); if(!a){ say(T('Γράψε πρώτα το email σου.','Enter your email first.')); em.focus(); return; }
    fg.disabled=true; C().recover(a).then(function(){ fg.disabled=false; showCode('recovery',a,T('Σου στείλαμε email. Γράψε τον κωδικό που περιέχει (ή πάτα τον σύνδεσμο) για να βάλεις νέο κωδικό. Δες και τα ανεπιθύμητα.','We sent you an email. Enter the code it contains (or tap the link) to set a new password. Check spam too.')); })
      .catch(function(e){ fg.disabled=false; say(err(e)); }); });
  function verify(){ var code=(ci.value||'').replace(/\s+/g,''); if(!/^\d{6,10}$/.test(code)){ say(T('Γράψε τον αριθμητικό κωδικό από το email.','Enter the numeric code from the email.')); return; }
    cok.disabled=true; say(T('Έλεγχος…','Checking…'),true);
    C().verify(codeType,codeEmail,code).then(function(){ cok.disabled=false; if(codeType==='recovery'){ if(o.close) o.close(); newPassSheet(o.done); } else ok(T('Το email επιβεβαιώθηκε. Είσαι συνδεδεμένος.','Email confirmed. You are signed in.')); })
      .catch(function(e){ cok.disabled=false; say(err(e)); }); }
  cok.addEventListener('click',verify); ci.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); verify(); } });
  crs.addEventListener('click',function(){ crs.disabled=true; setTimeout(function(){ crs.disabled=false; },30000);
    (codeType==='recovery'?C().recover(codeEmail):C().resend(codeEmail)).then(function(){ say(T('Στάλθηκε νέος κωδικός. Δες και τα ανεπιθύμητα.','A new code was sent. Check spam too.'),true); }).catch(function(e){ say(err(e)); }); });
  var f=h('form',{class:'bform authf',novalidate:true},ttl,sub,h('label',{class:'fld'},h('span',{text:'Email'}),em),pwF,msg,go,cbox,sw,fg);
  f.addEventListener('submit',function(e){ e.preventDefault(); say(''); var a=em.value.trim(), b=pw.value; if(!a||!b){ say(T('Συμπλήρωσε email και κωδικό.','Fill in email and password.')); return; }
    go.disabled=true; (mode==='in'?C().signIn(a,b):C().signUp(a,b)).then(function(r){ go.disabled=false;
      if(r==='confirm'){ showCode('signup',a,T('Σου στείλαμε email επιβεβαίωσης. Γράψε εδώ τον κωδικό που περιέχει (ή πάτα τον σύνδεσμο) και θα συνδεθείς. Δες και τα ανεπιθύμητα.','We sent you a confirmation email. Enter the code it contains here (or tap the link) and you will be signed in. Check spam too.')); return; }
      ok(); })
    .catch(function(e2){ go.disabled=false; if(/Email not confirmed/i.test(String(e2&&e2.message))){ C().resend(a).catch(function(){}); showCode('signup',a,T('Το email δεν έχει επιβεβαιωθεί. Σου στείλαμε νέο κωδικό: γράψ\' τον εδώ.','Your email is not confirmed yet. We sent a new code: enter it here.')); return; } say(err(e2)); }); });
  paint(); return f; };
B.authSheet=function(o){ o=Object.assign({},o||{}); var sh; o.close=function(){ sh&&sh.close(); }; sh=B.sheet({title:T('Λογαριασμός','Account'),body:B.authForm(o)}); return sh; };
B.accountBtn=function(reason,label){ return h('button',{class:'btn pri',type:'button',text:label||T('Σύνδεση ή νέος λογαριασμός','Sign in or create account'),onclick:function(){ B.authSheet({reason:reason}); }}); };
B.needAccount=function(reason,then){ if(logged()){ then&&then(); return; } B.authSheet({mode:'up',reason:reason,done:function(){ remount(); then&&then(); }}); };

/* ---------- νέος κωδικός (μετά από «Ξέχασα τον κωδικό») ---------- */
function newPassSheet(after){ var sh, pw=h('input',{type:'password',autocomplete:'new-password','aria-label':T('Νέος κωδικός','New password')}), msg=h('p',{class:'err',role:'alert'});
  var go=h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ var v=pw.value; if(v.length<6){ msg.textContent=T('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.','The password needs at least 6 characters.'); return; }
    go.disabled=true; C().setPassword(v).then(function(){ sh.close(); B.toast(T('Ο νέος κωδικός αποθηκεύτηκε. Είσαι συνδεδεμένος.','New password saved. You are signed in.'),5000); if(after) after(); else remount(); }).catch(function(e){ go.disabled=false; msg.textContent=err(e); }); }});
  sh=B.sheet({title:T('Νέος κωδικός','New password'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Γράψε νέο κωδικό (τουλάχιστον 6 χαρακτήρες).','Enter a new password (at least 6 characters).')}),h('label',{class:'fld'},h('span',{text:T('Νέος κωδικός','New password')}),pw),msg,go)});
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

/* ---------- εκκίνηση ---------- */
setTimeout(doLink,400);
})();
