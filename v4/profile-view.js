/* Alkyon 4 · Προφίλ: λογαριασμός, συγχρονισμός, τύπος ψαρέματος, γλώσσα, μονάδες */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, U=window.AlkyonUnits, root=null;
function C(){ return B.cloud; }

/* διαγραφή λογαριασμού (ίδια ροή με την κλασική: έλεγχος ότι η υπηρεσία υπάρχει, σβήσιμο cloud, μετά λογαριασμός) */
function delAccount(){ var word=T('ΔΙΑΓΡΑΦΗ','DELETE'), cl=B.cloud, inp=h('input',{type:'text',autocomplete:'off',autocapitalize:'characters',placeholder:word}), msg=h('p',{class:'err',role:'alert'}), sh;
  var go=h('button',{class:'btn full sos',type:'button',text:T('Οριστική διαγραφή','Delete permanently'),onclick:function(){
    if(inp.value.trim().toUpperCase()!==word){ msg.textContent=T('Γράψε ','Type ')+word+T(' για να συνεχίσεις.',' to continue.'); return; }
    go.disabled=true; msg.textContent=T('Διαγραφή…','Deleting…'); var J={'Content-Type':'application/json'};
    cl.rest('rpc/delete_my_account',{method:'POST',headers:J,body:JSON.stringify({dry:true})}).then(function(){
      var q=Promise.resolve(); ['records?id=not.is.null','safety_trips?id=not.is.null','safety_contacts?updated_at=not.is.null'].forEach(function(pth){ q=q.then(function(){ return cl.rest(pth,{method:'DELETE'}).catch(function(){}); }); });
      var uid=(cl.session()||{}).uid, pup=ls.get('alkyon-pup',{})||{}; Object.keys(pup).forEach(function(k){ q=q.then(function(){ return cl.storage('DELETE','photos/'+uid+'/'+k+'.jpg').catch(function(){}); }); });
      return q.then(function(){ return cl.rest('rpc/delete_my_account',{method:'POST',headers:J,body:JSON.stringify({dry:false})}); }).then(function(){
        ['alkyon-sess','alkyon-last','alkyon-pup'].forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} }); sh.close(); B.toast(T('Ο λογαριασμός διαγράφηκε.','Your account was deleted.')); setTimeout(function(){ location.reload(); },1200); })
        .catch(function(){ go.disabled=false; msg.textContent=T('Η διαγραφή απέτυχε. Δοκίμασε ξανά.','Deletion failed. Try again.'); }); },
      function(){ go.disabled=false; msg.textContent=T('Η διαγραφή λογαριασμού δεν έχει ενεργοποιηθεί ακόμα στον server. Δεν διαγράφηκε τίποτα.','Account deletion is not enabled on the server yet. Nothing was deleted.'); }); }});
  sh=B.sheet({title:T('Διαγραφή λογαριασμού','Delete account'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Θα διαγραφεί ο λογαριασμός σου και ό,τι έχει συγχρονιστεί στο cloud (ψάρια, σημεία, έξοδοι, φωτογραφίες, επαφή ασφαλείας). Δεν αναιρείται. Τα δεδομένα σε αυτό το κινητό μένουν.','Your account and everything synced to the cloud (catches, spots, trips, photos, safety contact) will be deleted. This cannot be undone. Data on this phone stays.')}),
    h('label',{class:'fld'},h('span',{text:T('Γράψε ','Type ')+word+T(' για επιβεβαίωση',' to confirm')}),inp),msg,go)}); }
/* εικονίδια γραμμής για τις λίστες του Προφίλ */
var PI={watch:'<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 10v2.5l1.5 1"/>',tackle:'<path d="M4 20L18.5 5.5"/><path d="M18.5 5.5c1.2-1.2 2.5-.4 2.5 1v5"/><circle cx="7.5" cy="16.5" r="2.2"/>',boat:'<path d="M3 15h18l-2.5 4.5h-13z"/><path d="M7 15V9h7l3 6"/><path d="M10 9V5"/>',
  spots:'<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',gear:'<path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/>',
  people:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',community:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  guide:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  type:'<path d="M3 17c2.2 0 2.2-1.5 4.5-1.5S9.8 17 12 17s2.2-1.5 4.5-1.5S19 17 21 17"/><path d="M12 3v10M8 7l4-4 4 4"/>',lang:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  units:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',safety:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  ai:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z"/>',
  backup:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',hist:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',stats:'<path d="M5 20V10M12 20V4M19 20v-7"/>',night:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17.2v.3"/>'};
function pic(k){ return h('span',{class:'ic pic',html:k==='type'&&B.profBadge?B.profBadge(B.prof()):'<svg viewBox="0 0 24 24" aria-hidden="true">'+(PI[k]||'')+'</svg>'}); }
function row(k,title,sub,href,fn){ var a=h(href?'a':'button',{class:'li',href:href||null,type:href?null:'button',onclick:fn||null},pic(k),h('span',{class:'tx'},h('b',{text:title}),sub?h('small',{text:sub}):null),B.icon('chev')); return a; }
function group(title,rows){ return h('div',{class:'pgrp'},title?h('h3',{class:'listh',text:title}):null,h('div',{class:'list'},rows.filter(Boolean))); }
var tab=ls.get('alkyon-v4-ptab','mine');
/* κεφαλίδα: όνομα, συγχρονισμός, η χρονιά σου */
function head(s){ var st=C().state(), nm=s?((s.name||'').trim()||s.email||''):'', y=String(new Date().getFullYear());
  var bs=B.store.raw('bites').filter(function(b){ return !b.deleted&&!b.miss&&!b.gear&&(b.date||'').slice(0,4)===y&&!B.pest(b); }), tr=B.store.raw('trips').filter(function(t){ return !t.deleted&&(t.date||'').slice(0,4)===y; });
  var n=bs.reduce(function(a,b){ return a+Math.max(1,Math.floor(+b.cnt)||1); },0), best=null, pl={}; var sps=B.store.raw('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'; });
  function nearSpot(b){ if(typeof b.lat!=='number'||!sps.length) return ''; var bn='', bd=1500; sps.forEach(function(x){ var dy=(x.lat-b.lat)*111320, dx=(x.lon-b.lon)*111320*Math.cos(b.lat*Math.PI/180), d=Math.sqrt(dx*dx+dy*dy); if(d<bd){ bd=d; bn=x.name||''; } }); return bn; }
  bs.forEach(function(b){ if(+b.kg>0&&(!best||+b.kg>+best.kg)) best=b; var pn=(b.place||'').trim()||nearSpot(b); if(pn) pl[pn]=(pl[pn]||0)+Math.max(1,Math.floor(+b.cnt)||1); });
  var top=Object.keys(pl).sort(function(a,b){ return pl[b]-pl[a]; })[0];
  var cls=!s?'off':st.err?'bad':(st.t&&Date.now()-st.t<86400000)?'ok':'warn', stx=!s?T('Χωρίς λογαριασμό · μόνο σε αυτό το κινητό','No account · this phone only'):st.err?T('Πρόβλημα συγχρονισμού','Sync problem'):st.t?T('Συγχρονίστηκε ','Synced ')+new Date(st.t).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):T('Δεν έχει συγχρονιστεί ακόμα','Not synced yet');
  var c=h('section',{class:'card phead'});
  c.append(h('button',{type:'button',class:'phid','aria-label':T('Λογαριασμός και συγχρονισμός','Account and sync'),onclick:function(){ tab='acc'; ls.set('alkyon-v4-ptab',tab); draw(); setTimeout(function(){ var t=document.querySelector('.bseg,.seg'); if(t&&t.scrollIntoView) t.scrollIntoView({behavior:'smooth',block:'start'}); },60); }},h('span',{class:'av',text:(nm||'?').charAt(0).toUpperCase()}),h('span',{class:'tx'},h('b',{text:nm||T('Σύνδεση ή εγγραφή','Sign in or sign up')}),h('small',null,h('i',{class:'sdot '+cls}),stx)),tab==='acc'?null:B.icon('chev'))); /* v31z545: το βελάκι ανοίγει τον Λογαριασμό· όταν είσαι ήδη εκεί, δεν φαίνεται */
  var cells=[[String(tr.length),T('Έξοδοι ','Trips ')+y,'boat'],[String(n),T('Ψάρια','Fish'),'tackle'],[best?B.num(+best.kg,1)+' kg':'–',best?(best.species||T('Καλύτερο','Best')):T('Καλύτερο ψάρι','Best fish'),'stats'],[top||'–',T('Κορυφαίο σημείο','Top spot'),'spots']];
  c.append(h('div',{class:'pstats'},cells.map(function(x){ return h('div',{class:'pst'},h('span',{class:'psi',html:'<svg viewBox="0 0 24 24" aria-hidden="true">'+PI[x[2]]+'</svg>'}),h('b',{text:x[0]}),h('small',{text:x[1]})); })));
  c.append(h('a',{class:'pall',href:'#log',onclick:function(){ ls.set('alkyon-v4-logtab','stats'); },text:T('Όλα τα στατιστικά ›','All statistics ›')}));
  return c; }
function draw(){
  if(!root) return;
  var s=C().session(), page=h('div',{class:'page'}), y=window.scrollY;
  page.append(h('div',{class:'top'},h('h1',{class:'lt',text:T('Προφίλ','Profile')})));
  page.append(head(s));
  /* 1.4.0: χωρίς λογαριασμό και με 3+ ψάρια ή εξόδους: μικρή υπενθύμιση, μέχρι να την κλείσεις */
  if(!s&&tab!=='acc'&&!ls.get('alkyon-v4-acctip',0)){ var nn=0; try{ nn=B.store.raw('bites').filter(function(b){ return !b.deleted; }).length+B.store.raw('trips').filter(function(t){ return !t.deleted; }).length; }catch(e){}
    if(nn>=3){ var tip=h('section',{class:'card acctip'},h('p',{text:T('Έχεις '+nn+' ψάρια και εξόδους μόνο σε αυτό το κινητό. Με δωρεάν λογαριασμό δεν χάνονται.','You have '+nn+' catches and trips on this phone only. With a free account they are never lost.')}),
      h('div',{class:'inrow'},B.accountBtn?B.accountBtn(null,T('Δημιουργία λογαριασμού','Create account')):null,h('button',{class:'btn',type:'button',text:T('Όχι, ευχαριστώ','No thanks'),onclick:function(){ ls.set('alkyon-v4-acctip',Date.now()); tip.remove(); }})));
      page.append(tip); } }
  page.append(B.seg([['mine',T('Τα δικά μου','My stuff')],['set',T('Ρυθμίσεις','Settings')],['acc',T('Λογαριασμός','Account')]],tab,function(v){ tab=v; ls.set('alkyon-v4-ptab',v); draw(); },T('Ενότητα προφίλ','Profile section')));
  if(tab==='set') settingsTab(page); else if(tab==='acc') accountTab(page,s); else mineTab(page);
  var EL=window.AlkyonErrLog, ne=EL?EL.get().filter(function(e){ return !e.v||e.v===window.ALKYON_VERSION; }).length:0; /* 1.4.1: μόνο της τωρινής έκδοσης */
  page.append(h('p',{class:'foot'},'Alkyon · '+(window.ALKYON_VERSION||''),
    ne?' · ':'',ne?h('button',{type:'button',class:'linkbtn errlk',text:T('Αναφορά σφαλμάτων','Error report')+' ('+ne+')',onclick:function(){ location.hash='#check'; }}):''));
  root.replaceChildren(page); if(y) try{ window.scrollTo(0,y); }catch(e){}
}
/* αναφορά σφαλμάτων: τι κόλλησε στο κινητό, για να σταλεί και να διορθωθεί */
function errSheet(){ var EL=window.AlkyonErrLog, a=EL?EL.get():[], sh;
  function txt(){ return 'Alkyon '+(window.ALKYON_VERSION||'')+' · '+navigator.userAgent+'\n'+a.map(function(e){ return new Date(e.t).toISOString().slice(0,16).replace('T',' ')+' '+(e.v||'')+' '+(e.p||'')+'\n  '+e.m+(e.n>1?' (x'+e.n+')':'')+(e.w?'\n  @ '+e.w:''); }).join('\n'); }
  var list=h('div',{class:'errl'},a.slice().reverse().map(function(e){ return h('div',{class:'erri'},h('small',{text:new Date(e.t).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+(e.n>1?' · ×'+e.n:'')+(e.p?' · '+e.p:'')}),h('code',{text:e.m}),e.w?h('small',{class:'erw',text:e.w}):''); }));
  var send=h('button',{type:'button',class:'btn pri full',text:navigator.share?T('Αποστολή','Send'):T('Αντιγραφή','Copy'),onclick:function(){ var t=txt();
    if(navigator.share) navigator.share({title:'Alkyon errors',text:t}).catch(function(){});
    else if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){ B.toast(T('Αντιγράφηκε.','Copied.')); },function(){ B.toast(T('Δεν αντιγράφηκε.','Could not copy.')); }); }});
  var clr=h('button',{type:'button',class:'btn full',text:T('Καθάρισμα','Clear'),onclick:function(){ EL.clear(); sh.close(); draw(); }});
  sh=B.sheet({title:T('Αναφορά σφαλμάτων','Error report'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Σφάλματα που έγιναν σε αυτό το κινητό. Στείλ’ τα για να διορθωθούν. Δεν περιέχουν ψάρια, σημεία ή στοιχεία λογαριασμού.','Errors that happened on this phone. Send them so they can be fixed. They contain no catches, spots or account details.')}),list,send,clr)}); }
function mineTab(page){
  var n=B.store.raw('tackle').filter(function(x){ return !x.deleted; }).length, sp=B.store.raw('spots').filter(function(x){ return !x.deleted; }).length;
  var bt=ls.get('alkyon-boat',null), bn=bt&&bt.boat&&bt.boat.name, g=ls.get('alkyon-gear',null), gn=g&&Array.isArray(g.items)?g.items.length:0;
  page.append(group(T('Εξοπλισμός και σκάφος','Tackle and boat'),[
    row('tackle',T('Εξοπλισμός','Tackle'),n?n+' '+(n===1?T('κομμάτι','item'):T('κομμάτια','items')):T('Καλάμια, μουλινέ, τεχνητά, ψαροντούφεκα','Rods, reels, lures, spearguns'),'#tackle'),
    row('gear',T('Παραγάδια, δίχτυα, ζεμπίλια','Longlines, nets, pots'),gn?gn+' '+(gn===1?T('καταγραφή','record'):T('καταγραφές','records')):T('Ρίψη και ανέβασμα εργαλείων','Set and haul gear'),null,function(){ ls.set('alkyon-v4-logtab','gear'); location.hash='#log'; }),
    row('boat',T('Σκάφος','Boat'),bn||T('Κινητήρας, συντήρηση, λήξεις, μπαταρίες','Engine, maintenance, expiries, batteries'),'#boat'),
    /* v31z552 */ B.garmin?row('watch',T('Ρολόι Garmin','Garmin watch'),B.garmin.code()?T('Συνδεδεμένο · κωδικός ','Linked · code ')+B.garmin.code():T('Πρόγνωση, πίεση και καταγραφή ψαριού στο ρολόι','Forecast, pressure and catch logging on the watch'),null,function(){ B.garmin.sheet(); }):null].filter(Boolean)));
  /* v31z525: η εισαγωγή είναι δεδομένα σου, όχι ρύθμιση λογαριασμού */
  page.append(group(T('Σημεία και δεδομένα','Spots and data'),[row('spots',T('Τα σημεία μου','My spots'),sp?sp+' '+(sp===1?T('σημείο','spot'):T('σημεία','spots')):T('Δεν έχεις αποθηκεύσει σημεία','No saved spots yet'),null,function(){ ls.set('alkyon-v4-logtab','spots'); location.hash='#log'; }),row('backup',T('Από plotter, GPS ή ρολόι κατάδυσης','From a plotter, GPS or dive watch'),'GPX · KML · CSV · FIT · UDDF',null,function(){ if(B.importSheet) B.importSheet(); })]));
  page.append(group(T('Φίλοι και κοινότητα','Friends and community'),[
    row('community',T('Κοινότητα','Community'),T('Ψάρια άλλων ψαράδων, χωρίς θέση','Other anglers’ catches, no locations'),'#community'),
    row('people',T('Φίλοι','Friends'),T('Κοινά ψάρια και σημεία με φίλους','Share catches and spots with friends'),'#friends')]));
  page.append(group(T('Γνώση','Knowledge'),[
    row('help',T('Πώς δουλεύει','How it works'),T('Όλες οι λειτουργίες με λίγα λόγια','Every feature in a few words'),'#help'),
    row('guide',T('Οδηγός','Guide'),T('Είδη, μεγέθη, νόμοι, κόμποι','Species, sizes, laws, knots'),'#guide'),
    row('safety',T('Έλεγχος συστήματος','System check'),T('Δουλεύουν όλα; Καιρός, δορυφόρος, ειδοποιήσεις, αντίγραφο','Is everything working? Weather, satellite, alerts, backup'),'#check')]));
}
function sheetOf(title,body){ return B.sheet({title:title,body:body}); }
function settingsTab(page){
  var sf=ls.get('alkyon-safe',null)||{}, n=Object.assign({on:false},ls.get('alkyon-notify',{}));
  var uLab=function(k){ var v=U&&U.cfg&&U.cfg[k], o=U&&U.options&&U.options[k], m=o&&o.filter(function(x){ return x[0]===v; })[0]; return m?m[1]:v; }, uSum=U&&U.cfg?['wind','wave','temp'].map(uLab).filter(Boolean).join(' · '):'';
  page.append(group(T('Ψάρεμα','Fishing'),[
    row('type',T('Τύπος ψαρέματος','Fishing type'),(B.PROF[B.prof()]||'')+(ls.raw&&ls.raw('alkyon-askfp')==='"0"'?'':''),null,function(){ var body=h('div',{class:'bform'},
        h('div',{class:'ptiles',role:'group','aria-label':T('Τύπος ψαρέματος','Fishing type')},Object.keys(B.PROF).map(function(k){ return h('button',{type:'button',class:'ptile','aria-pressed':String(B.prof()===k),onclick:function(){ try{ localStorage.setItem('alkyon-fprof',k); }catch(e){} B.emit('store','alkyon-fprof'); B.toast(T('Ο βαθμός και οι προτάσεις προσαρμόστηκαν.','The score and suggestions were adjusted.')); B.closeSheet(); draw(); }},h('span',{class:'pti',html:B.profBadge?B.profBadge(k):''}),h('b',{text:B.PROF[k]})); })),
        h('button',{class:'btn full',type:'button',text:T('Ακτή ή σκάφος, και ερώτηση στο άνοιγμα','Shore or offshore, and the question at start'),onclick:function(){ B.closeSheet(); setTimeout(B.startPick,250); }}));
      sheetOf(T('Τύπος ψαρέματος','Fishing type'),body); }),
    row('safety',T('Επαφή ασφαλείας','Safety contact'),sf.name||sf.phone||sf.email||(sf.tgLinked?'Telegram':T('Δεν έχει οριστεί','Not set')),null,function(){ if(B.safetyCard) sheetOf(T('Επαφή ασφαλείας','Safety contact'),B.safetyCard()); }),
    row('bell',T('Ρυθμίσεις ειδοποιήσεων','Notification settings'),n.on?T('Ενεργές','On'):T('Ανενεργές','Off'),'#alerts'),
    row('hist',T('Ιστορικό ειδοποιήσεων','Notification history'),T('Ό,τι σου στάλθηκε','Everything sent to you'),'#inbox')]));
  page.append(group(T('Εφαρμογή','App'),[
    row('lang',T('Γλώσσα','Language'),B.LANG==='en'?'English':'Ελληνικά',null,function(){ sheetOf(T('Γλώσσα','Language'),h('div',{class:'bform'},B.seg([['el','Ελληνικά'],['en','English']],B.LANG,function(v){ try{ localStorage.setItem('alkyon-lang',v); }catch(e){} location.reload(); },T('Γλώσσα','Language')))); }),
    U&&U.options?row('units',T('Μονάδες','Units'),uSum,null,unitsSheet):null,
    B.night?row('night',T('Νυχτερινή λειτουργία','Night mode'),{auto:T('Αυτόματα στην έξοδο μετά τη δύση','Automatic on trips after sunset'),on:T('Πάντα','Always'),off:T('Ποτέ','Never')}[B.night.mode()],null,function(){ sheetOf(T('Νυχτερινή λειτουργία','Night mode'),h('div',{class:'bform'},
      h('p',{class:'sub',text:T('Κόκκινη οθόνη για το σκοτάδι: τα μάτια δεν χάνουν την προσαρμογή τους. Στον χάρτη, το κουμπί 🌙 την ανοίγει ή την κλείνει για την τρέχουσα έξοδο.','Red screen for the dark: your eyes keep their night vision. On the map, the 🌙 button turns it on or off for the current trip.')}),
      B.seg([['auto',T('Αυτόματα','Automatic')],['on',T('Πάντα','Always')],['off',T('Ποτέ','Never')]],B.night.mode(),function(v){ B.night.set(v); draw(); },T('Νυχτερινή λειτουργία','Night mode')))); }):null,
    B.dataCards?row('ai',T('Αναγνώριση ψαριού (AI)','Fish recognition (AI)'),T('Κλειδί και ρυθμίσεις','Key and settings'),null,function(){ sheetOf(T('Αναγνώριση ψαριού (AI)','Fish recognition (AI)'),B.dataCards()[1]); }):null]));
}
/* v31z545: αποσύνδεση με επιλογή: να μείνουν ή να σβηστούν τα δεδομένα από αυτό το κινητό (μένουν πάντα στον λογαριασμό) */
function signOutSheet(){ var sh, msg=h('p',{class:'sub',role:'status'});
  function go(wipe){ [].forEach.call(sh.el.querySelectorAll('button.btn'),function(b){ b.disabled=true; }); msg.textContent=T('Συγχρονισμός και αποσύνδεση…','Syncing and signing out…');
    C().signOut({wipe:wipe}).then(function(r){ sh.close(); B.toast(wipe&&!r.wiped?T('Αποσυνδέθηκες. Ο συγχρονισμός δεν ολοκληρώθηκε, οπότε τα δεδομένα έμειναν στο κινητό για να μη χαθούν.','Signed out. Sync did not finish, so your data stayed on this phone so nothing is lost.'):wipe?T('Αποσυνδέθηκες και τα δεδομένα σβήστηκαν από αυτό το κινητό. Είναι στον λογαριασμό σου.','Signed out and your data was removed from this phone. It is in your account.'):T('Αποσυνδέθηκες. Τα δεδομένα έμειναν σε αυτό το κινητό.','Signed out. Your data stayed on this phone.'),7000); draw(); }); }
  sh=B.sheet({title:T('Αποσύνδεση','Sign out'),body:h('div',{class:'bform'},
    h('p',{class:'sub',text:T('Πρώτα συγχρονίζονται όλα στον λογαριασμό σου. Μετά διάλεξε τι γίνεται σε αυτό το κινητό:','Everything is synced to your account first. Then choose what happens on this phone:')}),
    h('button',{class:'btn full',type:'button',text:T('Αποσύνδεση · κράτα τα δεδομένα εδώ','Sign out · keep data here'),onclick:function(){ go(false); }}),
    h('button',{class:'btn full del',type:'button',text:T('Αποσύνδεση και διαγραφή από αυτό το κινητό','Sign out and remove from this phone'),onclick:function(){ go(true); }}),
    h('p',{class:'foot',text:T('Η διαγραφή γίνεται μόνο αν ο συγχρονισμός πετύχει. Όταν ξανασυνδεθείς, τα δεδομένα επιστρέφουν από τον λογαριασμό.','Removal only happens if the sync succeeds. When you sign in again, your data comes back from the account.')}),msg)}); }
function unitsSheet(){ var body=h('div',{class:'bform'}), L={wind:T('Άνεμος','Wind'),wave:T('Κύμα','Waves'),temp:T('Θερμοκρασία','Temperature'),press:T('Πίεση','Pressure'),dist:T('Απόσταση','Distance'),coord:T('Συντεταγμένες','Coordinates')};
  Object.keys(L).forEach(function(k){ if(!U.options[k]) return; body.append(h('h3',{class:'h3',text:L[k]}),B.seg(U.options[k].map(function(o){ return [o[0],o[1]]; }),U.cfg[k],function(v){ U.set(k,v); B.emit('store','alkyon-units'); draw(); },L[k])); });
  sheetOf(T('Μονάδες','Units'),body); }
function accountTab(page,s){
  page.append(s?accountCard(s):signInCard());
  page.append(backupCard());
  if(B.dataCards){ var dc=B.dataCards(); page.append(dc[0]); page.append(dc[2]); }
  var dm=dataCard(); if(dm) page.append(dm);
  if(s) page.append(dangerCard());
}
/* ---------- λογαριασμός ---------- */
function accountCard(s){
  var c=h('section',{class:'card acc'}), st=C().state();
  var nm=(s.name||'').trim(), ch=(nm||s.email||'?').charAt(0).toUpperCase();
  c.append(h('h2',{text:T('Λογαριασμός','Account')}),h('p',{class:'sub accmail',text:s.email||''}));
  var ni=h('input',{type:'text',maxlength:'40',value:nm,placeholder:T('Το όνομά σου','Your name'),autocomplete:'name','aria-label':T('Όνομα','Name')});
  c.append(h('div',{class:'inrow'},ni,h('button',{class:'btn',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ C().setName(ni.value.trim()).then(function(){ B.toast(T('Το όνομα αποθηκεύτηκε.','Name saved.')); draw(); }).catch(function(e){ B.toast(C().errText(e)); }); }})));
  /* η ώρα συγχρονισμού φαίνεται ήδη στην κεφαλίδα· εδώ μόνο πρόοδος ή σφάλμα */
  var sm=h('p',{class:'sub syncmsg'+(st.err?' bad':''),hidden:!st.err,text:st.err?st.msg:''});
  var sb=h('button',{class:'btn full',type:'button',html:B.iconSvg('refresh')+'<span>'+T('Συγχρονισμός τώρα','Sync now')+'</span>',onclick:function(){ sb.disabled=true; C().sync(true).then(function(){ sb.disabled=false; draw(); }); }});
  c.append(sm,sb);
  return c;
}
/* αποσύνδεση και διαγραφή: χωριστά, στο τέλος της καρτέλας */
function dangerCard(){ var c=h('section',{class:'card accx'});
  c.append(h('button',{class:'btn full out',type:'button',text:T('Αποσύνδεση','Sign out'),onclick:signOutSheet}));
  c.append(h('button',{class:'linkbtn danger',type:'button',text:T('Διαγραφή λογαριασμού','Delete account'),onclick:delAccount}));
  return c;
}
function signInCard(){ var c=h('section',{class:'card acc'}); c.append(B.authForm({done:draw})); return c; } /* 1.4.0: account.js */

/* συμπλήρωση δεδομένων παλιών ψαριών (ίδιες λειτουργίες με την κλασική: ιστορικός καιρός, πίεση και άνεμος ±30′) */
function dataCard(){ var rows=(window.AlkyonSeaRows||[]).map(function(f){ try{ return f(); }catch(e){ return null; } }).filter(Boolean); if(!rows.length) return null;
  var c=h('section',{class:'card seafill'},h('h2',{text:T('Συμπλήρωση δεδομένων','Fill in missing data')}),h('p',{class:'sub',style:{margin:'-4px 0 6px'},text:T('Για ψάρια με θέση που καταγράφηκαν χωρίς καιρό. Εκτίμηση μοντέλου (Open-Meteo), όχι μέτρηση.','For catches with a position that were logged without weather. A model estimate (Open-Meteo), not a measurement.')}));
  rows.forEach(function(r){ c.append(r); }); return c; }
function backupCard(){
  var lb=ls.get('alkyon-lastbackup',0), c=h('section',{class:'card'},h('h2',{text:T('Αντίγραφο ασφαλείας','Backup')}),
    h('p',{class:'sub',style:{margin:'-4px 0 12px'},text:T('Όλα τα δεδομένα σου με τις φωτογραφίες σε ένα αρχείο, για επαναφορά σε άλλο κινητό. ','All your data and photos in one file, to restore on another phone. ')+(lb?T('Τελευταίο: ','Last: ')+new Date(lb).toLocaleDateString(EN?'en-GB':'el-GR'):T('Δεν έχεις κάνει ακόμα.','You have not made one yet.'))}));
  var file=h('input',{type:'file',accept:'application/json,.json',class:'vh'});
  var ex=h('button',{class:'btn pri',type:'button',text:T('Δημιουργία αντιγράφου','Create backup'),onclick:function(){ ex.disabled=true; B.backup.exportAll().then(function(){ ex.disabled=false; B.toast(T('Το αντίγραφο κατέβηκε.','Backup downloaded.')); draw(); }).catch(function(){ ex.disabled=false; B.toast(T('Το αντίγραφο απέτυχε.','Backup failed.')); }); }});
  var im=h('button',{class:'btn',type:'button',text:T('Επαναφορά από αρχείο','Restore from file'),onclick:function(){ file.click(); }});
  file.addEventListener('change',function(){ var f=file.files&&file.files[0]; file.value=''; if(!f) return; B.backup.importFile(f).then(function(n){ B.toast(T('Επαναφέρθηκαν ','Restored ')+n+T(' εγγραφές.',' records.')); }).catch(function(){ B.toast(T('Το αρχείο δεν διαβάστηκε.','The file could not be read.')); }); });
  c.append(h('div',{class:'acts'},ex,im),file);
  if(B.cloudBackupRow) c.append(B.cloudBackupRow()); /* v31z550 */
  return c;
}
B.view('profile',{title:T('Προφίλ','Profile'),mount:function(el){ root=el; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
B.on('sync',function(){ if(!root) return; var st=C().state(), busy=/…$/.test(st.msg||''), m=root.querySelector('.syncmsg');
  if(m){ m.hidden=!(busy||st.err); m.textContent=(busy||st.err)?st.msg:''; m.classList.toggle('bad',!!st.err); }
  if(!busy){ var hd=root.querySelector('.phead'); if(hd) try{ hd.replaceWith(head(C().session())); }catch(e){} } });
B.on('store',function(k){ if(root&&k==='alkyon-sess') draw(); });
})();
