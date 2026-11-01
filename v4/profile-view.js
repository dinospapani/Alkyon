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
/* εικονίδια γραμμής για τις λίστες του Προφίλ */
var PI={tackle:'<path d="M4 20L18.5 5.5"/><path d="M18.5 5.5c1.2-1.2 2.5-.4 2.5 1v5"/><circle cx="7.5" cy="16.5" r="2.2"/>',boat:'<path d="M3 15h18l-2.5 4.5h-13z"/><path d="M7 15V9h7l3 6"/><path d="M10 9V5"/>',
  spots:'<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',gear:'<path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/>',
  people:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',community:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  guide:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  type:'<path d="M3 17c2.2 0 2.2-1.5 4.5-1.5S9.8 17 12 17s2.2-1.5 4.5-1.5S19 17 21 17"/><path d="M12 3v10M8 7l4-4 4 4"/>',lang:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  units:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',safety:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  ai:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z"/>',
  backup:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',stats:'<path d="M5 20V10M12 20V4M19 20v-7"/>'};
function pic(k){ return h('span',{class:'ic pic',html:'<svg viewBox="0 0 24 24" aria-hidden="true">'+(PI[k]||'')+'</svg>'}); }
function row(k,title,sub,href,fn){ var a=h(href?'a':'button',{class:'li',href:href||null,type:href?null:'button',onclick:fn||null},pic(k),h('span',{class:'tx'},h('b',{text:title}),sub?h('small',{text:sub}):null),B.icon('chev')); return a; }
function group(title,rows){ return h('div',{class:'pgrp'},title?h('h3',{class:'listh',text:title}):null,h('div',{class:'list'},rows.filter(Boolean))); }
var tab=ls.get('psaro-v4-ptab','mine');
/* κεφαλίδα: όνομα, συγχρονισμός, η χρονιά σου */
function head(s){ var st=C().state(), nm=s?((s.name||'').trim()||s.email||''):'', y=String(new Date().getFullYear());
  var bs=B.store.raw('bites').filter(function(b){ return !b.deleted&&!b.miss&&!b.gear&&(b.date||'').slice(0,4)===y; }), tr=B.store.raw('trips').filter(function(t){ return !t.deleted&&(t.date||'').slice(0,4)===y; });
  var n=bs.reduce(function(a,b){ return a+Math.max(1,Math.floor(+b.cnt)||1); },0), best=null, pl={}; bs.forEach(function(b){ if(+b.kg>0&&(!best||+b.kg>+best.kg)) best=b; if(b.place) pl[b.place]=(pl[b.place]||0)+1; });
  var top=Object.keys(pl).sort(function(a,b){ return pl[b]-pl[a]; })[0];
  var cls=!s?'off':st.err?'bad':(st.t&&Date.now()-st.t<86400000)?'ok':'warn', stx=!s?T('Χωρίς λογαριασμό · μόνο σε αυτό το κινητό','No account · this phone only'):st.err?T('Πρόβλημα συγχρονισμού','Sync problem'):st.t?T('Συγχρονίστηκε ','Synced ')+new Date(st.t).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):T('Δεν έχει συγχρονιστεί ακόμα','Not synced yet');
  var c=h('section',{class:'card phead'});
  c.append(h('button',{type:'button',class:'phid',onclick:function(){ tab='acc'; ls.set('psaro-v4-ptab',tab); draw(); }},h('span',{class:'av',text:(nm||'?').charAt(0).toUpperCase()}),h('span',{class:'tx'},h('b',{text:nm||T('Σύνδεση ή εγγραφή','Sign in or sign up')}),h('small',null,h('i',{class:'sdot '+cls}),stx)),B.icon('chev')));
  var cells=[[String(tr.length),T('Έξοδοι ','Trips ')+y,'boat'],[String(n),T('Ψάρια','Fish'),'tackle'],[best?B.num(+best.kg,1)+' kg':'–',best?(best.species||T('Καλύτερο','Best')):T('Καλύτερο ψάρι','Best fish'),'stats'],[top||'–',T('Κορυφαίο σημείο','Top spot'),'spots']];
  c.append(h('div',{class:'pstats'},cells.map(function(x){ return h('div',{class:'pst'},h('span',{class:'psi',html:'<svg viewBox="0 0 24 24" aria-hidden="true">'+PI[x[2]]+'</svg>'}),h('b',{text:x[0]}),h('small',{text:x[1]})); })));
  c.append(h('a',{class:'pall',href:'#log',onclick:function(){ ls.set('psaro-v4-logtab','stats'); },text:T('Όλα τα στατιστικά ›','All statistics ›')}));
  return c; }
function draw(){
  if(!root) return;
  var s=C().session(), page=h('div',{class:'page'}), y=window.scrollY;
  page.append(h('div',{class:'top'},h('h1',{class:'lt',text:T('Προφίλ','Profile')})));
  page.append(head(s));
  page.append(B.seg([['mine',T('Τα δικά μου','My stuff')],['set',T('Ρυθμίσεις','Settings')],['acc',T('Λογαριασμός','Account')]],tab,function(v){ tab=v; ls.set('psaro-v4-ptab',v); draw(); },T('Ενότητα προφίλ','Profile section')));
  if(tab==='set') settingsTab(page); else if(tab==='acc') accountTab(page,s); else mineTab(page);
  page.append(h('p',{class:'foot'},'BiteCast · '+(window.PSARO_VERSION||'')+' · ',h('a',{href:B.classic(),text:T('Κλασική έκδοση','Classic version')})));
  root.replaceChildren(page); if(y) try{ window.scrollTo(0,y); }catch(e){}
}
function mineTab(page){
  var n=B.store.raw('tackle').filter(function(x){ return !x.deleted; }).length, sp=B.store.raw('spots').filter(function(x){ return !x.deleted; }).length;
  var bt=ls.get('psaro-boat',null), bn=bt&&bt.boat&&bt.boat.name, g=ls.get('psaro-gear',null), gn=g&&Array.isArray(g.items)?g.items.length:0;
  page.append(group(T('Εξοπλισμός και σκάφος','Tackle and boat'),[
    row('tackle',T('Εξοπλισμός','Tackle'),n?n+' '+T('κομμάτια','items'):T('Καλάμια, μουλινέ, τεχνητά, ψαροντούφεκα','Rods, reels, lures, spearguns'),'#tackle'),
    row('boat',T('Σκάφος','Boat'),bn||T('Κινητήρας, συντήρηση, λήξεις, μπαταρίες','Engine, maintenance, expiries, batteries'),'#boat'),
    row('gear',T('Παραγάδια, δίχτυα, ζεμπίλια','Longlines, nets, pots'),gn?gn+' '+T('καταγραφές','records'):T('Ρίψη και ανέβασμα εργαλείων','Set and haul gear'),null,function(){ ls.set('psaro-v4-logtab','gear'); location.hash='#log'; }),
    row('spots',T('Τα σημεία μου','My spots'),sp?sp+' '+T('σημεία','spots'):T('Δεν έχεις αποθηκεύσει σημεία','No saved spots yet'),null,function(){ ls.set('psaro-v4-logtab','spots'); location.hash='#log'; })]));
  page.append(group(T('Κοινότητα','Community'),[
    row('community',T('Κοινότητα','Community'),T('Ψάρια άλλων ψαράδων, χωρίς θέση','Other anglers’ catches, no locations'),'#community'),
    row('people',T('Φίλοι','Friends'),T('Κοινά ψάρια και σημεία με φίλους','Share catches and spots with friends'),'#friends')]));
  page.append(group(T('Γνώση','Knowledge'),[
    row('guide',T('Οδηγός','Guide'),T('Είδη, ελάχιστα μεγέθη, νόμοι, κόμποι, ασφάλεια','Species, minimum sizes, laws, knots, safety'),'#guide')]));
}
function sheetOf(title,body){ return B.sheet({title:title,body:body}); }
function settingsTab(page){
  var sf=ls.get('psaro-safe',null)||{}, n=Object.assign({on:false},ls.get('psaro-notify',{}));
  var uSum=U&&U.cfg?[U.cfg.wind,U.cfg.wave,U.cfg.temp].filter(Boolean).join(' · '):'';
  page.append(group(T('Ψάρεμα','Fishing'),[
    row('type',T('Τύπος ψαρέματος','Fishing type'),(B.PROF[B.prof()]||'')+(ls.raw&&ls.raw('psaro-askfp')==='"0"'?'':''),null,function(){ var body=h('div',{class:'bform'},
        B.seg(Object.keys(B.PROF).map(function(k){ return [k,B.PROF[k]]; }),B.prof(),function(v){ try{ localStorage.setItem('psaro-fprof',v); }catch(e){} B.emit('store','psaro-fprof'); B.toast(T('Ο βαθμός και οι προτάσεις προσαρμόστηκαν.','The score and suggestions were adjusted.')); draw(); },T('Τύπος ψαρέματος','Fishing type')),
        h('button',{class:'btn full',type:'button',text:T('Ακτή ή σκάφος, και ερώτηση στο άνοιγμα','Shore or boat, and the question at start'),onclick:function(){ B.closeSheet(); setTimeout(B.startPick,250); }}));
      sheetOf(T('Τύπος ψαρέματος','Fishing type'),body); }),
    row('safety',T('Επαφή ασφαλείας','Safety contact'),sf.name||sf.phone||sf.email||(sf.tgLinked?'Telegram':T('Δεν έχει οριστεί','Not set')),null,function(){ if(B.safetyCard) sheetOf(T('Επαφή ασφαλείας','Safety contact'),B.safetyCard()); }),
    row('bell',T('Ρυθμίσεις ειδοποιήσεων','Notification settings'),n.on?T('Ενεργές','On'):T('Ανενεργές','Off'),'#alerts'),
    row('bell',T('Ιστορικό ειδοποιήσεων','Notification history'),T('Ό,τι σου στάλθηκε','Everything sent to you'),'#inbox')]));
  page.append(group(T('Εφαρμογή','App'),[
    row('lang',T('Γλώσσα','Language'),B.LANG==='en'?'English':'Ελληνικά',null,function(){ sheetOf(T('Γλώσσα','Language'),h('div',{class:'bform'},B.seg([['el','Ελληνικά'],['en','English']],B.LANG,function(v){ try{ localStorage.setItem('psaro-lang',v); }catch(e){} location.reload(); },T('Γλώσσα','Language')))); }),
    U&&U.options?row('units',T('Μονάδες','Units'),uSum,null,unitsSheet):null,
    B.dataCards?row('ai',T('Αναγνώριση ψαριού (AI)','Fish recognition (AI)'),T('Κλειδί και ρυθμίσεις','Key and settings'),null,function(){ sheetOf(T('Αναγνώριση ψαριού (AI)','Fish recognition (AI)'),B.dataCards()[1]); }):null]));
}
function unitsSheet(){ var body=h('div',{class:'bform'}), L={wind:T('Άνεμος','Wind'),wave:T('Κύμα','Waves'),temp:T('Θερμοκρασία','Temperature'),press:T('Πίεση','Pressure'),dist:T('Απόσταση','Distance'),coord:T('Συντεταγμένες','Coordinates')};
  Object.keys(L).forEach(function(k){ if(!U.options[k]) return; body.append(h('h3',{class:'h3',text:L[k]}),B.seg(U.options[k].map(function(o){ return [o[0],o[1]]; }),U.cfg[k],function(v){ U.set(k,v); B.emit('store','psaro-units'); draw(); },L[k])); });
  sheetOf(T('Μονάδες','Units'),body); }
function accountTab(page,s){
  page.append(group(T('Εισαγωγή','Import'),[row('backup',T('Από plotter, GPS ή ρολόι κατάδυσης','From a plotter, GPS or dive watch'),'GPX · KML · CSV · FIT · UDDF',null,function(){ if(B.importSheet) B.importSheet(); })]));
  page.append(s?accountCard(s):signInCard());
  page.append(backupCard());
  if(B.dataCards){ var dc=B.dataCards(); page.append(dc[0]); page.append(dc[2]); }
  var dm=dataCard(); if(dm) page.append(dm);
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
B.view('profile',{title:T('Προφίλ','Profile'),mount:function(el){ root=el; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
B.on('sync',function(){ if(root){ var m=root.querySelector('.syncmsg'); if(m){ var st=C().state(); m.textContent=st.msg; m.classList.toggle('bad',!!st.err); } } });
B.on('store',function(k){ if(root&&k==='psaro-sess') draw(); });
})();
