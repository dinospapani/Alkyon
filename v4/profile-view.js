/* BiteCast 4 · Προφίλ: λογαριασμός, συγχρονισμός, τύπος ψαρέματος, γλώσσα, μονάδες */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls, U=window.PsaroUnits, root=null;
function C(){ return B.cloud; }

/* διαγραφή λογαριασμού (ίδια ροή με την κλασική: έλεγχος ότι η υπηρεσία υπάρχει, σβήσιμο cloud, μετά λογαριασμός) */
function delAccount(){ var word=T('ΔΙΑΓΡΑΦΗ','DELETE'), cl=B.cloud, inp=h('input',{type:'text',autocomplete:'off',autocapitalize:'characters',placeholder:word}), msg=h('p',{class:'err',role:'alert'}), sh;
  var go=h('button',{class:'btn full sos',type:'button',text:T('Οριστική διαγραφή','Delete permanently'),onclick:function(){
    if(inp.value.trim().toUpperCase()!==word){ msg.textContent=T('Γράψε ','Type ')+word+T(' για να συνεχίσεις.',' to continue.'); return; }
    go.disabled=true; msg.textContent=T('Διαγραφή…','Deleting…'); var J={'Content-Type':'application/json'};
    cl.rest('rpc/delete_my_account',{method:'POST',headers:J,body:JSON.stringify({dry:true})}).then(function(){
      var q=Promise.resolve(); ['records?id=not.is.null','safety_trips?id=not.is.null','safety_contacts?updated_at=not.is.null'].forEach(function(pth){ q=q.then(function(){ return cl.rest(pth,{method:'DELETE'}).catch(function(){}); }); });
      var uid=(cl.session()||{}).uid, pup=ls.get('psaro-pup',{})||{}; Object.keys(pup).forEach(function(k){ q=q.then(function(){ return cl.storage('DELETE','photos/'+uid+'/'+k+'.jpg').catch(function(){}); }); });
      return q.then(function(){ return cl.rest('rpc/delete_my_account',{method:'POST',headers:J,body:JSON.stringify({dry:false})}); }).then(function(){
        ['psaro-sess','psaro-last','psaro-pup'].forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} }); sh.close(); B.toast(T('Ο λογαριασμός διαγράφηκε.','Your account was deleted.')); setTimeout(function(){ location.reload(); },1200); })
        .catch(function(){ go.disabled=false; msg.textContent=T('Η διαγραφή απέτυχε. Δοκίμασε ξανά.','Deletion failed. Try again.'); }); },
      function(){ go.disabled=false; msg.textContent=T('Η διαγραφή λογαριασμού δεν έχει ενεργοποιηθεί ακόμα στον server. Δεν διαγράφηκε τίποτα.','Account deletion is not enabled on the server yet. Nothing was deleted.'); }); }});
  sh=B.sheet({title:T('Διαγραφή λογαριασμού','Delete account'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Θα διαγραφεί ο λογαριασμός σου και ό,τι έχει συγχρονιστεί στο cloud (ψάρια, σημεία, έξοδοι, φωτογραφίες, επαφή ασφαλείας). Δεν αναιρείται. Τα δεδομένα σε αυτό το κινητό μένουν.','Your account and everything synced to the cloud (catches, spots, trips, photos, safety contact) will be deleted. This cannot be undone. Data on this phone stays.')}),
    h('label',{class:'fld'},h('span',{text:T('Γράψε ','Type ')+word+T(' για επιβεβαίωση',' to confirm')}),inp),msg,go)}); }
function draw(){
  if(!root) return;
  var s=C().session(), page=h('div',{class:'page'});
  page.append(h('div',{class:'top'},h('h1',{class:'lt',text:T('Προφίλ','Profile')})));
  page.append(s?accountCard(s):signInCard());
  page.append(prefs());
  if(B.safetyCard) page.append(B.safetyCard());
  page.append(mine());
  page.append(backupCard());
  if(B.dataCards) B.dataCards().forEach(function(c){ page.append(c); });
  var dm=dataCard(); if(dm) page.append(dm);
  page.append(more());
  page.append(h('p',{class:'foot'},'BiteCast 4 ('+T('δοκιμαστικό','beta')+') · '+(window.PSARO_VERSION||'')+'. ',h('a',{href:B.classic(),text:T('Άνοιγμα της κλασικής έκδοσης','Open the classic version')}),'.'));
  root.replaceChildren(page);
}

/* ---------- λογαριασμός ---------- */
function accountCard(s){
  var c=h('section',{class:'card acc'}), st=C().state();
  var nm=(s.name||'').trim(), ch=(nm||s.email||'?').charAt(0).toUpperCase();
  c.append(h('div',{class:'idr'},h('span',{class:'av',text:ch}),h('div',{class:'tx'},h('b',{text:nm||T('Χωρίς όνομα','No name')}),h('small',{text:s.email||''}))));
  var ni=h('input',{type:'text',maxlength:'40',value:nm,placeholder:T('Το όνομά σου','Your name'),autocomplete:'name','aria-label':T('Όνομα','Name')});
  c.append(h('div',{class:'inrow'},ni,h('button',{class:'btn',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ C().setName(ni.value.trim()).then(function(){ B.toast(T('Το όνομα αποθηκεύτηκε.','Name saved.')); draw(); }).catch(function(e){ B.toast(C().errText(e)); }); }})));
  var sm=h('p',{class:'sub syncmsg'+(st.err?' bad':''),text:st.msg||(st.t?T('Τελευταίος συγχρονισμός: ','Last sync: ')+new Date(st.t).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'')});
  var sb=h('button',{class:'btn full',type:'button',html:B.iconSvg('refresh')+'<span>'+T('Συγχρονισμός τώρα','Sync now')+'</span>',onclick:function(){ sb.disabled=true; C().sync(true).then(function(){ sb.disabled=false; draw(); }); }});
  c.append(sm,sb);
  c.append(h('button',{class:'btn full out',type:'button',text:T('Αποσύνδεση','Sign out'),onclick:function(){ B.ask(T('Αποσύνδεση από τον λογαριασμό; Τα δεδομένα σου μένουν στο κινητό και στον λογαριασμό.','Sign out? Your data stays on this phone and in your account.'),T('Αποσύνδεση','Sign out'),true).then(function(y){ if(y) C().signOut().then(function(){ B.toast(T('Αποσυνδέθηκες.','Signed out.')); draw(); }); }); }}));
  c.append(h('button',{class:'linkbtn danger',type:'button',text:T('Διαγραφή λογαριασμού','Delete account'),onclick:delAccount}));
  return c;
}
function signInCard(){
  var c=h('section',{class:'card acc'}), mode='in';
  var em=h('input',{type:'email',autocomplete:'email',inputmode:'email',placeholder:'email','aria-label':'Email'}), pw=h('input',{type:'password',autocomplete:'current-password',placeholder:T('Κωδικός','Password'),'aria-label':T('Κωδικός','Password')});
  var msg=h('p',{class:'err',role:'alert'}), go=h('button',{class:'btn pri full',type:'submit'}), sw=h('button',{class:'link',type:'button'});
  var ttl=h('h2'), sub=h('p',{class:'sub',text:T('Με λογαριασμό τα ψάρια, οι έξοδοι και οι φωτογραφίες σου κρατιούνται και σε άλλο κινητό.','With an account your catches, trips and photos are kept on any phone.')});
  function paint(){ ttl.textContent=mode==='in'?T('Σύνδεση','Sign in'):T('Νέος λογαριασμός','New account'); go.textContent=mode==='in'?T('Σύνδεση','Sign in'):T('Δημιουργία λογαριασμού','Create account'); sw.textContent=mode==='in'?T('Δεν έχεις λογαριασμό; Δημιούργησε έναν','No account? Create one'):T('Έχεις ήδη λογαριασμό; Σύνδεση','Already have an account? Sign in'); pw.autocomplete=mode==='in'?'current-password':'new-password'; }
  sw.addEventListener('click',function(){ mode=mode==='in'?'up':'in'; msg.textContent=''; paint(); });
  var f=h('form',{class:'bform',novalidate:true},ttl,sub,h('label',{class:'fld'},h('span',{text:'Email'}),em),h('label',{class:'fld'},h('span',{text:T('Κωδικός','Password')}),pw),msg,go,sw);
  f.addEventListener('submit',function(e){ e.preventDefault(); msg.textContent=''; var a=em.value.trim(), b=pw.value; if(!a||!b){ msg.textContent=T('Συμπλήρωσε email και κωδικό.','Fill in email and password.'); return; }
    go.disabled=true; (mode==='in'?C().signIn(a,b):C().signUp(a,b)).then(function(r){ go.disabled=false; if(r==='confirm'){ msg.style.color='var(--good)'; msg.textContent=T('Σου στείλαμε email επιβεβαίωσης. Πάτα τον σύνδεσμο και μετά συνδέσου.','We sent you a confirmation email. Tap the link, then sign in.'); return; } B.toast(T('Συνδέθηκες.','Signed in.')); draw(); })
      .catch(function(err){ go.disabled=false; msg.textContent=C().errText(err); }); });
  paint(); c.append(f); return c;
}

/* ---------- προτιμήσεις ---------- */
function prefs(){
  var c=h('section',{class:'card'},h('h2',{text:T('Ρυθμίσεις','Settings')}));
  c.append(h('h3',{class:'h3',text:T('Τύπος ψαρέματος','Fishing type')}),B.seg(Object.keys(B.PROF).map(function(k){ return [k,B.PROF[k]]; }),B.prof(),function(v){ try{ localStorage.setItem('psaro-fprof',v); }catch(e){} B.emit('store','psaro-fprof'); B.toast(T('Ο βαθμός και οι προτάσεις προσαρμόστηκαν.','The score and suggestions were adjusted.')); },T('Τύπος ψαρέματος','Fishing type')));
  if(B.startPick) c.append(h('button',{class:'linkbtn',type:'button',text:T('Ακτή ή σκάφος, και ερώτηση στο άνοιγμα…','Shore or boat, and the question at start…'),onclick:function(){ B.startPick(); }}));
  c.append(h('h3',{class:'h3',text:T('Γλώσσα','Language')}),B.seg([['el','Ελληνικά'],['en','English']],B.LANG,function(v){ try{ localStorage.setItem('psaro-lang',v); }catch(e){} location.reload(); },T('Γλώσσα','Language')));
  if(U&&U.options){ var L={wind:T('Άνεμος','Wind'),temp:T('Θερμοκρασία','Temperature'),press:T('Πίεση','Pressure'),wave:T('Κύμα','Waves'),dist:T('Απόσταση','Distance'),coord:T('Συντεταγμένες','Coordinates')};
    Object.keys(L).forEach(function(k){ c.append(h('h3',{class:'h3',text:L[k]}),B.seg(U.options[k].map(function(o){ return [o[0],o[1]]; }),U.cfg[k],function(v){ U.set(k,v); B.emit('store','psaro-units'); },L[k])); }); }
  return c;
}
/* ---------- τα δικά μου ---------- */
function mine(){
  var n=B.store.raw('tackle').filter(function(x){ return !x.deleted; }).length, l=h('div',{class:'list'});
  var bt=ls.get('psaro-boat',null), bn=bt&&bt.boat&&bt.boat.name;
  l.append(h('a',{class:'li',href:'#boat'},h('span',{class:'ic'},B.icon('wave')),h('span',{class:'tx'},h('b',{text:T('Σκάφος','Boat')}),h('small',{text:bn||T('Κινητήρας, συντήρηση, λήξεις','Engine, maintenance, expiries')})),B.icon('chev')));
  l.append(h('a',{class:'li',href:'#community'},h('span',{class:'ic'},B.icon('fish')),h('span',{class:'tx'},h('b',{text:T('Κοινότητα','Community')}),h('small',{text:T('Ψάρια άλλων ψαράδων, χωρίς θέση','Other anglers’ catches, no locations')})),B.icon('chev')));
  l.append(h('a',{class:'li',href:'#friends'},h('span',{class:'ic'},B.icon('user')),h('span',{class:'tx'},h('b',{text:T('Φίλοι','Friends')}),h('small',{text:T('Κοινά ψάρια και σημεία με φίλους','Share catches and spots with friends')})),B.icon('chev')));
  l.append(h('a',{class:'li',href:'#guide'},h('span',{class:'ic'},B.icon('fish')),h('span',{class:'tx'},h('b',{text:T('Οδηγός','Guide')}),h('small',{text:T('Είδη, ελάχιστα μεγέθη, νόμοι, κόμποι, λίστα ασφαλείας','Species, minimum sizes, laws, knots, safety checklist')})),B.icon('chev')));
  l.append(h('a',{class:'li',href:'#tackle'},h('span',{class:'ic'},B.icon('fish')),h('span',{class:'tx'},h('b',{text:T('Εξοπλισμός','Tackle')}),h('small',{text:n?n+' '+T('κομμάτια','items'):T('Πρόσθεσε καλάμια, μουλινέ, τεχνητά','Add rods, reels, lures')})),B.icon('chev')));
  return h('div',null,h('h3',{class:'listh',text:T('Τα δικά μου','My stuff')}),l);
}
/* συμπλήρωση δεδομένων παλιών ψαριών (ίδιες λειτουργίες με την κλασική: ιστορικός καιρός, πίεση και άνεμος ±30′) */
function dataCard(){ var rows=(window.PsaroSeaRows||[]).map(function(f){ try{ return f(); }catch(e){ return null; } }).filter(Boolean); if(!rows.length) return null;
  var c=h('section',{class:'card seafill'},h('h2',{text:T('Συμπλήρωση δεδομένων','Fill in missing data')}),h('p',{class:'sub',style:{margin:'-4px 0 6px'},text:T('Για ψάρια με θέση που καταγράφηκαν χωρίς καιρό. Εκτίμηση μοντέλου (Open-Meteo), όχι μέτρηση.','For catches with a position that were logged without weather. A model estimate (Open-Meteo), not a measurement.')}));
  rows.forEach(function(r){ c.append(r); }); return c; }
function backupCard(){
  var lb=ls.get('psaro-lastbackup',0), c=h('section',{class:'card'},h('h2',{text:T('Αντίγραφο ασφαλείας','Backup')}),
    h('p',{class:'sub',style:{margin:'-4px 0 12px'},text:T('Όλα τα δεδομένα σου με τις φωτογραφίες σε ένα αρχείο, για επαναφορά σε άλλο κινητό. ','All your data and photos in one file, to restore on another phone. ')+(lb?T('Τελευταίο: ','Last: ')+new Date(lb).toLocaleDateString(EN?'en-GB':'el-GR'):T('Δεν έχεις κάνει ακόμα.','You have not made one yet.'))}));
  var file=h('input',{type:'file',accept:'application/json,.json',class:'vh'});
  var ex=h('button',{class:'btn pri',type:'button',text:T('Δημιουργία αντιγράφου','Create backup'),onclick:function(){ ex.disabled=true; B.backup.exportAll().then(function(){ ex.disabled=false; B.toast(T('Το αντίγραφο κατέβηκε.','Backup downloaded.')); draw(); }).catch(function(){ ex.disabled=false; B.toast(T('Το αντίγραφο απέτυχε.','Backup failed.')); }); }});
  var im=h('button',{class:'btn',type:'button',text:T('Επαναφορά από αρχείο','Restore from file'),onclick:function(){ file.click(); }});
  file.addEventListener('change',function(){ var f=file.files&&file.files[0]; file.value=''; if(!f) return; B.backup.importFile(f).then(function(n){ B.toast(T('Επαναφέρθηκαν ','Restored ')+n+T(' εγγραφές.',' records.')); }).catch(function(){ B.toast(T('Το αρχείο δεν διαβάστηκε.','The file could not be read.')); }); });
  c.append(h('div',{class:'acts'},ex,im),file);
  return c;
}
/* ---------- ειδοποιήσεις ---------- */
function more(){
  var n=Object.assign({on:false},ls.get('psaro-notify',{})), l=h('div',{class:'list'});
  l.append(h('a',{class:'li',href:'#alerts'},h('span',{class:'ic'},B.icon('bell')),h('span',{class:'tx'},h('b',{text:T('Ειδοποιήσεις πρόγνωσης','Forecast alerts')}),h('small',{text:n.on?T('Ενεργές','On'):T('Ανενεργές','Off')})),B.icon('chev')));
  return h('div',null,h('h3',{class:'listh',text:T('Ειδοποιήσεις','Notifications')}),l);
}

B.view('profile',{title:T('Προφίλ','Profile'),mount:function(el){ root=el; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
B.on('sync',function(){ if(root){ var m=root.querySelector('.syncmsg'); if(m){ var st=C().state(); m.textContent=st.msg; m.classList.toggle('bad',!!st.err); } } });
B.on('store',function(k){ if(root&&k==='psaro-sess') draw(); });
})();
