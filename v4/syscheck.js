/* Alkyon 4 · Έλεγχος συστήματος (#check, v31z550).
   Με ένα πάτημα ελέγχει ό,τι εξαρτάται από εξωτερικές υπηρεσίες: ίντερνετ, καιρό, θάλασσα, λογαριασμό, ειδοποιήσεις,
   ορατότητα νερού και θερμοκλινές (Copernicus μέσω Supabase), κοινή έξοδο, αναφορά σφαλμάτων, αντίγραφο στο cloud,
   χάρτη χωρίς σήμα και χώρο αποθήκευσης. Πράσινο = εντάξει, πορτοκαλί = θέλει προσοχή, κόκκινο = δεν δουλεύει (με τι να κάνεις).
   Το «Αποστολή αναφοράς» μοιράζεται τα αποτελέσματα και τα πρόσφατα σφάλματα ως κείμενο. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, SB='https://sgfohmqwdwtkhtrebnix.supabase.co', KEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
var root=null, res={}, running=false;
function C(){ return B.cloud&&B.cloud.session&&B.cloud.session()?B.cloud:null; }
/* για δορυφόρο/μοντέλο θάλασσας: σημείο σίγουρα στη θάλασσα (η θέση του κινητού είναι συχνά στη στεριά) — ~10 km από την ακτή της Πάφου */
function seaPos(){ return {lat:34.72,lon:32.25}; }
function pos(){ var p=B.lastPos&&B.lastPos(); return p?{lat:+(+p.lat).toFixed(2),lon:+(+p.lon).toFixed(2)}:{lat:34.95,lon:32.33}; }
function tf(url,o,ms){ var ac=new AbortController(), t=setTimeout(function(){ ac.abort(); },ms||15000), t0=Date.now();
  return fetch(url,Object.assign({signal:ac.signal},o||{})).then(function(r){ clearTimeout(t); r.ms=Date.now()-t0; return r; },function(e){ clearTimeout(t); throw e; }); }
function R(lv,txt,fix,x){ return {lv:lv,txt:txt,fix:fix||'',x:x||null}; }
var CHECKS=[
 ['net',T('Ίντερνετ','Internet'),function(){ if(navigator.onLine===false) return Promise.resolve(R('bad',T('Χωρίς σύνδεση.','Offline.'),T('Η εφαρμογή δουλεύει με ό,τι έχει αποθηκευτεί.','The app works with what is saved.')));
   return tf('../version.js?c='+Date.now(),{cache:'no-store'},10000).then(function(r){ return r.ms<1500?R('ok',T('Σύνδεση εντάξει · ','Connected · ')+r.ms+' ms'):R('warn',T('Αργή σύνδεση · ','Slow connection · ')+r.ms+' ms',T('Η εφαρμογή ανοίγει από το αποθηκευμένο αντίγραφο αν το δίκτυο αργεί.','The app opens from its saved copy when the network is slow.')); },function(){ return R('bad',T('Δεν απαντά ο server της εφαρμογής.','The app server does not respond.')); }); }],
 ['wx',T('Πρόγνωση καιρού (Open-Meteo)','Weather forecast (Open-Meteo)'),function(){ var p=pos(); return tf('https://api.open-meteo.com/v1/forecast?latitude='+p.lat+'&longitude='+p.lon+'&hourly=wind_speed_10m&forecast_days=1').then(function(r){ return r.ok?R('ok',T('Λειτουργεί · ','Working · ')+r.ms+' ms'):R('bad','HTTP '+r.status,T('Προσωρινό πρόβλημα της υπηρεσίας· ξαναδοκίμασε σε λίγο.','Temporary service problem; try again later.')); },function(){ return R('bad',T('Δεν απαντά.','No response.')); }); }],
 ['sea',T('Θάλασσα: κύμα, θερμοκρασία νερού','Sea: waves, water temperature'),function(){ var p=pos(); return tf('https://marine-api.open-meteo.com/v1/marine?latitude='+p.lat+'&longitude='+p.lon+'&hourly=wave_height&forecast_days=1').then(function(r){ return r.ok?R('ok',T('Λειτουργεί · ','Working · ')+r.ms+' ms'):R('bad','HTTP '+r.status); },function(){ return R('bad',T('Δεν απαντά.','No response.')); }); }],
 ['acc',T('Λογαριασμός και συγχρονισμός','Account and sync'),function(){ var cl=C(); if(!cl) return Promise.resolve(R('off',T('Δεν έχεις συνδεθεί.','Not signed in.'),T('Προφίλ › Λογαριασμός, για αντίγραφο και κοινή χρήση με φίλους.','Profile › Account, for backups and sharing with friends.')));
   var st=cl.state&&cl.state()||{}; return cl.rest('records?select=id&limit=1').then(function(r){ return r.ok?R(st.err?'warn':'ok',(st.t?T('Τελευταίος συγχρονισμός: ','Last sync: ')+new Date(st.t).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):T('Συνδεδεμένος.','Signed in.'))+(st.err?' · '+(st.msg||''):'')):R('bad','HTTP '+r.status,T('Αποσυνδέσου και ξανασυνδέσου.','Sign out and in again.')); },function(e){ return R('bad',String(e&&e.message||e)); }); }],
 ['push',T('Ειδοποιήσεις στο κινητό','Phone notifications'),function(){ var n=ls.get('alkyon-notify',{})||{};
   if(!('Notification' in window)||!('serviceWorker' in navigator)) return Promise.resolve(R('off',T('Ο browser δεν υποστηρίζει ειδοποιήσεις. Στο iPhone: πρόσθεσε την εφαρμογή στην αρχική οθόνη.','This browser does not support notifications. On iPhone: add the app to the home screen.')));
   if(Notification.permission==='denied') return Promise.resolve(R('bad',T('Έχουν μπλοκαριστεί από τον browser.','Blocked by the browser.'),T('Ρυθμίσεις browser › Ιστότοποι › Ειδοποιήσεις › επίτρεψε το Alkyon.','Browser settings › Sites › Notifications › allow Alkyon.')));
   if(!n.on) return Promise.resolve(R('off',T('Κλειστές.','Off.'),T('Ειδοποιήσεις › άνοιξέ τες.','Notifications › turn them on.')));
   return navigator.serviceWorker.getRegistration(new URL('../',location.href).href).then(function(r){ if(!r||!r.pushManager) return R('warn',T('Ανοιχτές, χωρίς push (μόνο όταν είναι ανοιχτή η εφαρμογή).','On, without push (only while the app is open).'));
     return r.pushManager.getSubscription().then(function(s){ return s?R('ok',T('Ανοιχτές, και με κλειστή εφαρμογή.','On, even with the app closed.')+(n.server?'':T(' · μόνο από το κινητό',' · from the phone only'))):R('warn',T('Ανοιχτές, χωρίς εγγραφή push.','On, without a push subscription.'),T('Κλείσ’ τες και άνοιξέ τες ξανά στις Ειδοποιήσεις.','Turn them off and on again in Notifications.')); }); }); }],
 ['clar',T('Ορατότητα νερού (δορυφόρος)','Water visibility (satellite)'),function(){ var p=seaPos(); return tf(SB+'/functions/v1/water-clarity?lat='+p.lat+'&lon='+p.lon+'&debug=1&apikey='+KEY,null,40000).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){
     if(r.status===401) return R('bad',T('Άρνηση πρόσβασης (401).','Access denied (401).'),T('Supabase › Edge Functions › water-clarity › Settings: κλείσε το «Verify JWT».','Supabase › Edge Functions › water-clarity › Settings: turn off “Verify JWT”.'));
     if(r.status===404) return R('bad',T('Η συνάρτηση δεν υπάρχει.','The function does not exist.'),T('Ανέβασε το water-clarity-index.ts ως «water-clarity».','Deploy water-clarity-index.ts as “water-clarity”.'));
     if(j.zsd!=null) return R('ok',T('Λειτουργεί · ορατότητα ~','Working · visibility ~')+(j.zsd>35?'35+':Math.round(j.zsd))+' m · '+(j.date||'')+(j.filled?T(' (συμπληρωμένος χάρτης)',' (gap-filled map)'):''));
     if(j.err==='cloud') return R('ok',T('Λειτουργεί · σήμερα σύννεφα, η εφαρμογή δείχνει εκτίμηση.','Working · cloudy today, the app shows an estimate.'));
     if(j.err==='nolayer') return R('bad',T('Δεν βρέθηκε το επίπεδο του δορυφόρου.','Satellite layer not found.'),T('Πάτα «Αποστολή αναφοράς» για να διορθωθεί.','Tap “Send report” so it can be fixed.'),{caps:j.caps||null});
     return R('bad',(j.err||'')+' '+(j.error||'HTTP '+r.status)); }); },function(){ return R('bad',T('Δεν απαντά.','No response.')); }).then(function(x){ return x; }); }],
 ['thermo',T('Θερμοκρασία σε βάθος (θερμοκλινές)','Temperature at depth (thermocline)'),function(){ var p=seaPos(); return tf(SB+'/functions/v1/water-clarity?mode=profile&lat='+p.lat+'&lon='+p.lon+'&apikey='+KEY,null,40000).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){
     if(j.prof&&j.prof.length) return R('ok',T('Λειτουργεί · ','Working · ')+j.prof.length+T(' βάθη',' depths')+' · '+(j.date||''));
     if(r.status===401||r.status===404) return R('bad','HTTP '+r.status,T('Ίδια ρύθμιση με την ορατότητα νερού.','Same setup as water visibility.'));
     return R('warn',(j.err||'')+' '+(j.error||''),T('Ίσως σημείο στη στεριά· δοκίμασε από θάλασσα.','Perhaps a land point; try from the sea.')); }); },function(){ return R('bad',T('Δεν απαντά.','No response.')); }); }],
 ['live',T('Κοινή έξοδος με φίλους','Shared trips with friends'),function(){ var cl=C(); if(!cl) return Promise.resolve(R('off',T('Χρειάζεται λογαριασμό.','Needs an account.')));
   return cl.rest('trip_live?select=user_id&limit=1').then(function(r){ if(r.ok) return R('ok',T('Λειτουργεί.','Working.')); return r.text().then(function(t){ return /PGRST205|42P01|relation|not find/i.test(t)||r.status===404?R('bad',T('Λείπει ο πίνακας.','The table is missing.'),T('Supabase › SQL Editor: τρέξε το trip-live.sql.','Supabase › SQL Editor: run trip-live.sql.')):R('bad','HTTP '+r.status); }); },function(e){ var m=String(e&&e.message||e); return /404|PGRST205|42P01|relation/.test(m)?R('bad',T('Λείπει ο πίνακας.','The table is missing.'),T('Supabase › SQL Editor: τρέξε το trip-live.sql.','Supabase › SQL Editor: run trip-live.sql.')):R('bad',m); }); }],
 ['errs',T('Αναφορά σφαλμάτων','Error reporting'),function(){ if(!window.AlkyonErr) return Promise.resolve(R('off','–'));
   return AlkyonErr.test().then(function(code){ if(code>=200&&code<300){ AlkyonErr.flush(); var q=AlkyonErr.pending(); return R('ok',T('Λειτουργεί','Working')+(q?T(' · σε αναμονή: ',' · queued: ')+q:'')); }
     if(code===404) return R('bad',T('Λείπει ο πίνακας.','The table is missing.'),T('Supabase › SQL Editor: τρέξε το app-errors.sql.','Supabase › SQL Editor: run app-errors.sql.'));
     return R('bad','HTTP '+code); },function(){ return R('warn',T('Δεν στάλθηκε (χωρίς σύνδεση;).','Not sent (offline?).')); }); }],
 ['bk',T('Αντίγραφο ασφαλείας στο cloud','Cloud backup'),function(){ if(!C()||!B.cloudBackup) return Promise.resolve(R('off',T('Χρειάζεται λογαριασμό.','Needs an account.')));
   return B.cloudBackup.list().then(function(a){ var s=B.cloudBackup.status(); if(!a.length) return R('warn',T('Δεν υπάρχει ακόμα αντίγραφο.','No backup yet.'),T('Προφίλ › Λογαριασμός › «Αντίγραφο τώρα».','Profile › Account › “Back up now”.'));
     var last=a[0].name.replace('.json',''), old=Date.now()-Date.parse(last+'T12:00:00')>10*864e5; return R(old?'warn':'ok',a.length+T(' αντίγραφα · τελευταίο ',' backups · last ')+last); },function(e){ return String(e.message)==='nobucket'?R('bad',T('Δεν έχει στηθεί.','Not set up.'),T('Supabase › SQL Editor: τρέξε το backups.sql.','Supabase › SQL Editor: run backups.sql.')):R('bad',String(e.message)); }); }],
 ['watch',T('Ρολόι Garmin','Garmin watch'),function(){ var p=seaPos(); return tf(SB+'/functions/v1/watch?lat='+p.lat+'&lon='+p.lon+'&apikey='+KEY,null,30000).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){
     if(r.status===404) return R('off',T('Δεν έχει στηθεί η συνάρτηση «watch».','The “watch” function is not set up.'),T('Ανέβασε το watch-index.ts ως «watch» (Verify JWT off).','Deploy watch-index.ts as “watch” (Verify JWT off).'));
     if(r.status===401) return R('bad',T('Άρνηση πρόσβασης (401).','Access denied (401).'),T('Edge Functions › watch › Settings: κλείσε το «Verify JWT».','Edge Functions › watch › Settings: turn off “Verify JWT”.'));
     if(!j.ok) return R('bad',String(j.err||('HTTP '+r.status)));
     var cl=C(); if(!cl) return R('ok',T('Η πρόγνωση για το ρολόι λειτουργεί.','The watch forecast works.'));
     return cl.rest('watch_links?select=code&limit=1').then(function(r2){ if(r2.ok) return r2.json().then(function(a){ return a.length?R('ok',T('Λειτουργεί · ρολόι συνδεδεμένο','Working · watch linked')):R('ok',T('Λειτουργεί · δεν έχεις φτιάξει κωδικό ρολογιού','Working · no watch code yet')); });
       return R('warn',T('Λείπει ο πίνακας σύνδεσης.','The link table is missing.'),T('Supabase › SQL Editor: τρέξε το watch-link.sql.','Supabase › SQL Editor: run watch-link.sql.')); },function(e){ var m=String(e&&e.message||e); return /404|PGRST205|42P01/.test(m)?R('warn',T('Λείπει ο πίνακας σύνδεσης.','The link table is missing.'),T('Supabase › SQL Editor: τρέξε το watch-link.sql.','Supabase › SQL Editor: run watch-link.sql.')):R('warn',m); }); }); },function(){ return R('bad',T('Δεν απαντά.','No response.')); }); }],
 ['off',T('Χάρτης και πρόγνωση χωρίς σήμα','Map and forecast without signal'),function(){ var s=B.prefetch?B.prefetch.status():{}, rec=ls.get('alkyon-offl',[])||[], tiles=rec.reduce(function(a,r){ return a+(r.n||0); },0), m=B.prefetch?B.prefetch.mode():'all';
   var pl=B.prefetch&&B.prefetch.due(); var txt=(tiles?tiles+T(' πλακίδια χάρτη αποθηκευμένα',' map tiles saved'):T('Κανένας χάρτης αποθηκευμένος','No map saved'))+(s.at?T(' · πριν την έξοδο: ',' · before the trip: ')+(s.name||'')+' '+new Date(s.at).toLocaleDateString(EN?'en-GB':'el-GR',{day:'numeric',month:'short'}):'');
   return Promise.resolve(m==='off'?R('off',txt,T('Ειδοποιήσεις › Πριν την έξοδο.','Notifications › Before the trip.')):pl&&!(s.date===pl.date)?R('warn',txt,T('Έχεις πλάνο· ανοίγει μόνο του όταν υπάρχει σύνδεση.','You have a plan; it downloads by itself when online.')):R('ok',txt)); }],
 ['stor',T('Χώρος αποθήκευσης','Storage'),function(){ var S=navigator.storage; if(!S||!S.estimate) return Promise.resolve(R('off','–'));
   return Promise.all([S.estimate(),S.persisted?S.persisted():Promise.resolve(null)]).then(function(a){ var e=a[0], mb=function(x){ return Math.round((x||0)/1048576); };
     var txt=mb(e.usage)+' MB'+(e.quota?T(' από ~',' of ~')+(e.quota>1073741824?B.num(e.quota/1073741824,1)+' GB':mb(e.quota)+' MB'):'');
     return a[1]===false?R('warn',txt+T(' · μπορεί να σβηστεί αν γεμίσει το κινητό',' · may be cleared if the phone runs low'),T('Πάτα «Προστασία δεδομένων».','Tap “Protect data”.'),{persist:1}):R('ok',txt+(a[1]?T(' · προστατευμένα',' · protected'):'')); }); }],
 ['gps',T('Θέση (GPS)','Location (GPS)'),function(){ if(!navigator.permissions||!navigator.permissions.query) return Promise.resolve(R('off','–'));
   return navigator.permissions.query({name:'geolocation'}).then(function(p){ return p.state==='granted'?R('ok',T('Επιτρέπεται.','Allowed.')):p.state==='denied'?R('bad',T('Μπλοκαρισμένη.','Blocked.'),T('Ρυθμίσεις browser › Ιστότοποι › Τοποθεσία › επίτρεψε.','Browser settings › Sites › Location › allow.')):R('warn',T('Θα ρωτήσει την πρώτη φορά.','Will ask the first time.')); },function(){ return R('off','–'); }); }]
];
var ICON={ok:'✓',warn:'!',bad:'✕',off:'–',run:'…'};
function rowOf(c){ var r=res[c[0]]||{lv:'run',txt:T('Έλεγχος…','Checking…')};
  var el=h('div',{class:'ckrow '+r.lv,'data-ck':c[0]},h('i',{text:ICON[r.lv]}),h('span',{class:'tx'},h('b',{text:c[1]}),h('small',{text:r.txt}),r.fix?h('small',{class:'ckfix',text:r.fix}):null));
  if(r.x&&r.x.persist&&navigator.storage&&navigator.storage.persist) el.querySelector('.tx').append(h('button',{class:'btn sm',type:'button',text:T('Προστασία δεδομένων','Protect data'),onclick:function(){ navigator.storage.persist().then(function(ok){ B.toast(ok?T('Τα δεδομένα προστατεύονται.','Your data is protected.'):T('Ο browser δεν το επέτρεψε. Πρόσθεσε την εφαρμογή στην αρχική οθόνη και ξαναδοκίμασε.','The browser did not allow it. Add the app to the home screen and try again.')); runOne(c).then(paint); }); }}));
  return el; }
function runOne(c){ res[c[0]]={lv:'run',txt:T('Έλεγχος…','Checking…')}; var p; try{ p=c[2](); }catch(e){ p=Promise.reject(e); } return p.then(function(r){ return r; },function(e){ return R('bad',String(e&&e.message||e)); }).then(function(r){ res[c[0]]=r; }); }
function runAll(){ if(running) return; running=true; res={}; paint();
  /* παράλληλα σε ομάδες για να μην αργεί */
  var p=Promise.all(CHECKS.map(function(c){ return runOne(c).then(function(){ upd(c); }); }));
  p.then(function(){ running=false; ls.set('alkyon-v4-check',{t:Date.now(),r:res}); paint(); }); }
function report(){ var L=['Alkyon '+(window.ALKYON_VERSION||'')+' · '+new Date().toISOString().slice(0,16).replace('T',' ')+' · '+navigator.userAgent.slice(0,120)];
  CHECKS.forEach(function(c){ var r=res[c[0]]; if(r){ L.push(ICON[r.lv]+' '+c[1]+': '+r.txt+(r.fix?' → '+r.fix:'')); if(r.x&&r.x.caps) L.push('   caps: '+JSON.stringify(r.x.caps).slice(0,1500)); } });
  var E=(window.AlkyonErrLog?AlkyonErrLog.get():[]).slice(-12).reverse(); if(E.length){ L.push('','Σφάλματα:'); E.forEach(function(e){ L.push(new Date(e.t).toISOString().slice(5,16).replace('T',' ')+' '+(e.v||'')+' '+(e.p||'')+' '+e.m+(e.n>1?' ×'+e.n:'')+(e.w?' @ '+e.w:'')); }); }
  return L.join('\n'); }
function paint(){ if(!root) return; var page=h('div',{class:'page ckpage'});
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω','Back'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Έλεγχος συστήματος','System check')}))));
  var n={ok:0,warn:0,bad:0}; CHECKS.forEach(function(c){ var r=res[c[0]]; if(r&&n[r.lv]!=null) n[r.lv]++; });
  page.append(h('p',{class:'sub',text:running?T('Γίνεται έλεγχος…','Checking…'):n.bad?n.bad+T(' δεν δουλεύουν · ',' not working · ')+n.warn+T(' θέλουν προσοχή',' need attention'):n.warn?T('Όλα δουλεύουν· ','Everything works; ')+n.warn+T(' θέλουν προσοχή.',' need attention.'):T('Όλα δουλεύουν.','Everything works.')}));
  var card=h('section',{class:'card ckcard'}); CHECKS.forEach(function(c){ card.append(rowOf(c)); }); page.append(card);
  var E=window.AlkyonErrLog?AlkyonErrLog.get():[];
  page.append(h('section',{class:'card'},h('h2',{text:T('Πρόσφατα σφάλματα','Recent errors')}),
    h('p',{class:'sub',text:E.length?E.length+T(' καταγραφές στο κινητό. Στέλνονται αυτόματα για διόρθωση (χωρίς θέση ή ψάρια).',' entries on this phone. They are sent automatically for fixing (no location or catches).'):T('Κανένα σφάλμα. 👍','No errors. 👍')}),
    E.length?h('div',{class:'errl'},E.slice(-6).reverse().map(function(e){ return h('div',{class:'erri'},h('small',{text:new Date(e.t).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+(e.n>1?' · ×'+e.n:'')+(e.p?' · '+e.p:'')}),h('code',{text:e.m}),e.w?h('small',{class:'erw',text:e.w}):''); })):null));
  page.append(h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',disabled:running,text:T('Έλεγχος ξανά','Check again'),onclick:runAll}),
    h('button',{class:'btn',type:'button',disabled:running,text:navigator.share?T('Αποστολή αναφοράς','Send report'):T('Αντιγραφή αναφοράς','Copy report'),onclick:function(){ var t=report();
      if(navigator.share) navigator.share({title:'Alkyon check',text:t}).catch(function(){}); else if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){ B.toast(T('Αντιγράφηκε.','Copied.')); }); }})));
  root.replaceChildren(page); }
/* 1.0.0: όσο τρέχει ο έλεγχος αλλάζει μόνο η γραμμή που τελείωσε (πριν ξαναχτιζόταν όλη η σελίδα 14 φορές και «αναβόσβηνε») */
function upd(c){ if(!root) return; var old=root.querySelector('.ckrow[data-ck="'+c[0]+'"]'); if(!old) return paint(); old.replaceWith(rowOf(c)); }
B.sysCheck={report:report,results:function(){ return res; }};
B.view('check',{title:T('Έλεγχος συστήματος','System check'),mount:function(el){ root=el; var last=ls.get('alkyon-v4-check',null); if(last&&last.r&&Date.now()-last.t<120000){ res=last.r; paint(); } else runAll(); },unmount:function(){ root=null; }});
})();
