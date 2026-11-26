/* Alkyon 4 · Ρολόι: Garmin (v31z552), Apple Watch και Wear OS (Samsung Galaxy Watch, Pixel Watch).
   - Apple Watch / Wear OS: ίδιος κωδικός· μέσα στην εφαρμογή του κινητού στέλνεται μόνος του στο ρολόι (AKN.watch, native.js),
     αλλιώς γράφεται στο ρολόι (Μενού › Ρυθμίσεις › Γράψε τον κωδικό).
   - Προφίλ › Ρολόι Garmin: φτιάχνει κωδικό σύνδεσης (πίνακας watch_links, βλ. watch-link.sql). Τον γράφεις στο Garmin Connect ›
     Alkyon › Ρυθμίσεις, και από εκεί το ρολόι στέλνει τα ψάρια στο Ημερολόγιό σου (συνάρτηση «watch»).
   - Τα ψάρια από το ρολόι (src:'watch') έρχονται με τον συγχρονισμό· εδώ μπαίνουν στην έξοδο που έτρεχε εκείνη την ώρα
     και παίρνουν τις συνθήκες της ώρας (όπως τα ψάρια από το κουμπί του χάρτη). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, K='alkyon-v4-watch';
function C(){ return B.cloud&&B.cloud.session&&B.cloud.session()?B.cloud:null; }
function S(){ return B.store; }
function mk(){ var a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s=''; var r=new Uint8Array(8); try{ crypto.getRandomValues(r); }catch(e){ for(var i=0;i<8;i++) r[i]=Math.random()*256; } for(var j=0;j<8;j++) s+=a[r[j]%a.length]; return s; }
function create(){ var cl=C(); if(!cl) return Promise.reject(new Error('nosess')); var code=mk(), s=cl.session();
  return cl.rest('watch_links',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({code:code,user_id:s.uid,lang:B.LANG,name:'Garmin'})}).then(function(r){
    if(r&&r.ok===false) return r.text().then(function(t){ throw new Error(/PGRST205|42P01|not find|relation/i.test(t)||r.status===404?'notable':'http '+r.status); });
    ls.set(K,{code:code,at:Date.now()}); push(code); return code; },function(e){ var m=String(e&&e.message||e); throw new Error(/404|PGRST205|42P01|relation/.test(m)?'notable':m); }); }
/* Apple Watch / Wear OS: ο κωδικός πηγαίνει στο ρολόι μέσω της εφαρμογής του κινητού (WatchConnectivity / Wearable Data Layer) */
function W(){ return window.AKN&&window.AKN.watch; }
function push(code){ var w=W(); if(!w||!code) return Promise.resolve(null); return w.link({code:code,lang:B.LANG}).then(function(r){ return r&&r.ok; },function(){ return null; }); }
function wstat(){ var w=W(); if(!w) return Promise.resolve(null); return w.status().catch(function(){ return null; }); }
/* 21/11/2026: «Στείλε στο ρολόι»: πρώτα ποιο ρολόι υπάρχει, μετά το μήνυμα. Στο Android το link() απαντά ok όταν ο κωδικός γραφτεί στο ΚΙΝΗΤΟ
   (Wearable Data Layer), όχι όταν φτάσει στο ρολόι· έτσι έγραφε «Στάλθηκε στο ρολόι» και χωρίς ρολόι. */
function sendMsg(r,ok){ if(r&&r.app>0) return ok!==true?T('Βρέθηκε ρολόι με το Alkyon, αλλά ο κωδικός δεν στάλθηκε. Γράψε τον στο ρολόι: Μενού (≡) › Ρυθμίσεις.','A watch with Alkyon was found, but the code was not sent. Type it on the watch: Menu (≡) › Settings.'):T('Στάλθηκε στο ρολόι.','Sent to the watch.');
  if(r&&r.watches>0) return T('Βρέθηκε ρολόι, αλλά χωρίς το Alkyon. Εγκατέστησέ το και πάτα ξανά «Στείλε στο ρολόι».','A watch was found, but without Alkyon. Install it and tap «Send to watch» again.');
  if(r) return T('Δεν βρέθηκε ρολόι με το Alkyon. Όταν συνδεθεί, πάτα ξανά «Στείλε στο ρολόι» ή γράψε τον κωδικό στο ρολόι.','No watch with Alkyon found. When it is connected, tap «Send to watch» again or type the code on the watch.');
  return ok?T('Στάλθηκε στο ρολόι.','Sent to the watch.'):T('Δεν μπόρεσα να ελέγξω για ρολόι. Γράψε τον κωδικό στο ρολόι: Μενού (≡) › Ρυθμίσεις.','Could not check for a watch. Type the code on the watch: Menu (≡) › Settings.'); }
function sendNow(code){ return wstat().then(function(r){ return push(code).then(function(ok){ var m=sendMsg(r,ok); B.toast(m); return m; }); }); }
B.garminSendMsg=sendMsg;
/* 21/11/2026: «Νέος κωδικός» δεν ξαναπατιέται όσο φτιάχνεται ο προηγούμενος (διπλό πάτημα = δύο κωδικοί, ο πρώτος σβήνεται αμέσως). */
var newBusy=false;
function disconnect(code){ var cl=C(); if(!cl||!code) return Promise.reject(new Error('nosess')); return cl.rest('watch_links?code=eq.'+encodeURIComponent(code),{method:'DELETE'}).then(function(r){ if(r&&r.ok===false) throw new Error('http '+r.status); }); }
function drop(code){ var cl=C(); if(!cl||!code) return Promise.resolve(); return cl.rest('watch_links?code=eq.'+code,{method:'DELETE'}).catch(function(){}); }
/* 26/11/2026: αναδιάρθρωση της οθόνης. Καρτέλες ανά ρολόι: στο iPhone Apple Watch | Garmin, στο Android Wear OS | Garmin, στο web και τα τρία.
   Πρώτα η κατάσταση του ρολογιού και η αποστολή, μετά ο κωδικός, μετά τα βήματα ΜΟΝΟ του ρολογιού που διάλεξες· «Νέος κωδικός» και «Αποσύνδεση» στο τέλος.
   Οι επιβεβαιώσεις ανοίγουν ΠΑΝΩ από την οθόνη (stack), ώστε μετά το «Νέος κωδικός» να φαίνεται ο νέος κωδικός (πριν η οθόνη έκλεινε). */
var KT='alkyon-v4-watch-tab';
function plat(){ var a=window.AKN; return a&&a.platform||'web'; }
function tabs(){ var p=plat(); return p==='ios'?['apple','garmin']:p==='android'?['wear','garmin']:['apple','wear','garmin']; }
function tabName(k){ return k==='apple'?'Apple Watch':k==='wear'?'Wear OS':'Garmin'; }
function stText(r){ var p=plat();
  if(!r) return T('Δεν μπόρεσα να ελέγξω για ρολόι. Γράψε τον κωδικό στο ρολόι: Μενού (≡) › Ρυθμίσεις › Γράψε τον κωδικό.','Could not check for a watch. Type the code on the watch: Menu (≡) › Settings › Type the code.');
  if(r.app>0) return T('Βρέθηκε ρολόι με το Alkyon ✓ · ο κωδικός στάλθηκε.','Watch with Alkyon found ✓ · code sent.');
  if(r.watches>0) return T('Βρέθηκε ρολόι, αλλά χωρίς το Alkyon. Εγκατέστησέ το και άνοιξε ξανά αυτή την οθόνη.','A watch was found, but without Alkyon. Install it and open this screen again.')+(p==='ios'?T(' Στο iPhone: εφαρμογή Watch › Το ρολόι μου › Alkyon › Εγκατάσταση. Αν το ρολόι είναι κλειστό ή χωρίς μπαταρία, άνοιξέ το πρώτα.',' On the iPhone: Watch app › My Watch › Alkyon › Install. If the watch is off or out of battery, turn it on first.'):'');
  return p==='ios'?T('Δεν βρέθηκε Apple Watch συνδεδεμένο με το iPhone.','No Apple Watch connected to this iPhone.'):p==='android'?T('Δεν βρέθηκε ρολόι Wear OS συνδεδεμένο με το κινητό.','No Wear OS watch connected to this phone.'):T('Δεν βρέθηκε Apple Watch / Wear OS συνδεδεμένο με το κινητό.','No Apple Watch / Wear OS watch connected to this phone.'); }
function stCls(r){ return !r?'warn':r.app>0?'ok':r.watches>0?'warn':'bad'; }
function steps(k){
  if(k==='garmin') return [T('Εγκατέστησε το Alkyon στο ρολόι από το Connect IQ Store (ή την εφαρμογή Connect IQ στο κινητό).','Install Alkyon on the watch from the Connect IQ Store (or the Connect IQ app on your phone).'),
    T('Στο κινητό: Garmin Connect › η συσκευή σου › Εφαρμογές Connect IQ › Alkyon › Ρυθμίσεις.','On the phone: Garmin Connect › your device › Connect IQ apps › Alkyon › Settings.'),
    T('Στο «Κωδικός σύνδεσης» γράψε τον κωδικό χωρίς κενό και αποθήκευσε.','In “Link code” type the code without the space and save.')];
  var inst=k==='apple'?T('Εγκατέστησε το Alkyon στο Apple Watch: στο iPhone εφαρμογή Watch › Το ρολόι μου › Alkyon › Εγκατάσταση (ή από το App Store του ρολογιού).','Install Alkyon on the Apple Watch: on the iPhone, Watch app › My Watch › Alkyon › Install (or from the watch’s App Store).')
    :T('Εγκατέστησε το Alkyon στο ρολόι από το Play Store του ρολογιού.','Install Alkyon on the watch from the watch’s Play Store.');
  return [inst,T('Άνοιξε το Alkyon στο ρολόι μία φορά.','Open Alkyon on the watch once.'),
    W()?T('Ο κωδικός πηγαίνει μόνος του στο ρολόι όταν ανοίγεις αυτή την οθόνη. Αλλιώς πάτα «Στείλε στο ρολόι».','The code goes to the watch by itself when you open this screen. Otherwise tap “Send to watch”.')
      :T('Στο ρολόι: Μενού (≡) › Ρυθμίσεις › Γράψε τον κωδικό. Με την εφαρμογή Alkyon στο κινητό ο κωδικός πηγαίνει μόνος του.','On the watch: Menu (≡) › Settings › Type the code. With the Alkyon phone app the code is sent by itself.')]; }
function sheet(){ var body=h('div',{class:'bform gmn'}), sh=B.sheet({title:T('Ρολόι','Watch'),body:body});
  function paint(err){ var st=ls.get(K,null); body.replaceChildren();
    var tl=tabs(), tab=ls.get(KT,null); if(tl.indexOf(tab)<0) tab=tl[0];
    if(!C()){ body.append(h('p',{class:'sub',text:T('Με την εφαρμογή Alkyon στο ρολόι: πρόγνωση και βαθμός της ημέρας, ειδοποίηση όταν αλλάζει η πίεση, καταγραφή ψαριού με ώρα και θέση, και έξοδος με διαδρομή GPS.','With the Alkyon app on your watch: the day’s forecast and score, a pressure-change alert, catch logging with time and position, and trips with a GPS track.')}),
      h('p',{class:'wn',text:T('Το ρολόι παίρνει την πρόγνωση και στέλνει τα ψάρια μέσω του λογαριασμού σου.','The watch gets the forecast and sends catches through your account.')}),B.accountBtn?B.accountBtn(T('Για το ρολόι Garmin χρειάζεται λογαριασμός.','The Garmin watch needs an account.')):null); return; }
    if(err) body.append(h('p',{class:'wn',text:err==='notable'?T('Η σύνδεση ρολογιού δεν είναι διαθέσιμη ακόμα.','Watch linking is not available yet.'):T('Δεν έγινε. Έλεγξε τη σύνδεση και ξαναδοκίμασε.','Failed. Check your connection and try again.')}));
    if(!(st&&st.code)){
      body.append(h('p',{class:'sub',text:T('Με την εφαρμογή Alkyon στο ρολόι: πρόγνωση και βαθμός της ημέρας, ειδοποίηση όταν αλλάζει η πίεση, καταγραφή ψαριού με ώρα και θέση, και έξοδος με διαδρομή GPS. Όλα έρχονται στο Ημερολόγιο.','With the Alkyon app on your watch: the day’s forecast and score, a pressure-change alert, catch logging with time and position, and trips with a GPS track. Everything arrives in your Logbook.')}),
        h('button',{class:'btn pri full',type:'button',text:T('Φτιάξε κωδικό σύνδεσης','Create a link code'),onclick:function(ev){ ev.currentTarget.disabled=true; create().then(function(){ paint(); },function(e){ paint(String(e.message)); }); }}));
      return; }
    if(tl.length>1) body.append(B.seg(tl.map(function(k){ return [k,tabName(k)]; }),tab,function(k){ ls.set(KT,k); paint(); },T('Τύπος ρολογιού','Watch type')));
    var native=tab!=='garmin'&&W();
    /* 1. κατάσταση και αποστολή (Apple Watch / Wear OS μέσα στην εφαρμογή του κινητού) */
    if(native) body.append(h('div',{class:'gmst'},
      h('div',{class:'gmstl'},h('span',{class:'sdot warn',id:'gmdot'}),h('p',{class:'note',id:'gmwst',text:T('Ψάχνω ρολόι…','Looking for a watch…')})),
      h('button',{class:'btn pri full',type:'button',text:T('Στείλε στο ρολόι','Send to watch'),onclick:function(){ sendNow(st.code); }})));
    /* 2. κωδικός */
    body.append(h('div',{class:'gmcode'},h('small',{text:T('Κωδικός σύνδεσης','Link code')}),h('b',{text:st.code.slice(0,4)+' '+st.code.slice(4)}),
      h('button',{class:'btn sm',type:'button',text:T('Αντιγραφή','Copy'),onclick:function(){ try{ navigator.clipboard.writeText(st.code).then(function(){ B.toast(T('Αντιγράφηκε.','Copied.')); }); }catch(e){} }})));
    /* 3. βήματα μόνο για το ρολόι που διάλεξες */
    body.append(h('h3',{text:T('Πώς συνδέεται','How to link')}),h('ol',{class:'gmsteps'},steps(tab).map(function(x){ return h('li',{text:x}); })));
    if(tab!=='garmin') body.append(h('p',{class:'note',text:T('Σε δοκιμαστική φάση: αν δεν βρίσκεις το Alkyon στο store του ρολογιού, δεν έχει εγκριθεί ακόμα.','In testing: if you cannot find Alkyon in the watch’s store, it has not been approved yet.')}));
    body.append(h('p',{class:'note',text:T('Τα ψάρια από το ρολόι στέλνονται μέσω του κινητού (ή με WiFi/LTE στο Apple Watch και στο Wear OS)· αν δεν υπάρχει σύνδεση, το ρολόι τα κρατά και τα στέλνει αργότερα. Είδος, βάρος και φωτογραφία τα συμπληρώνεις μετά στο Ημερολόγιο.','Catches from the watch go through your phone (or WiFi/LTE on Apple Watch and Wear OS); without a connection the watch keeps them and sends them later. Add species, weight and photo in the Logbook afterwards.')}));
    /* 4. διαχείριση */
    body.append(h('h3',{text:T('Διαχείριση','Manage')}),h('div',{class:'acts gmman'},
          h('button',{class:'btn',type:'button',text:T('Νέος κωδικός','New code'),onclick:function(ev){ var btn=ev&&ev.currentTarget; if(newBusy) return; newBusy=true; if(btn) btn.disabled=true; var done=function(){ newBusy=false; if(btn) btn.disabled=false; };
            B.ask(T('Ο παλιός κωδικός θα σταματήσει να δουλεύει. Συνέχεια;','The old code will stop working. Continue?'),T('Νέος κωδικός','New code'),0,1).then(function(y){ if(!y){ done(); return; } drop(st.code).then(create).then(function(){ done(); paint(); },function(e){ done(); paint(String(e.message)); }); },done); }}),
          /* 1.14.83 (P0.5): αποσύνδεση ρολογιού: ο κωδικός σβήνει από τον server και το ρολόι σταματά να γράφει στο ημερολόγιο (μέσα σε ~1 λεπτό) */
          h('button',{class:'btn',type:'button',style:{color:'var(--poor)'},text:T('Αποσύνδεση ρολογιού','Disconnect watch'),onclick:function(){ B.ask(T('Το ρολόι θα σταματήσει να στέλνει ψάρια και να παίρνει πρόγνωση από τον λογαριασμό σου. Συνέχεια;','The watch will stop sending catches and getting the forecast from your account. Continue?'),T('Αποσύνδεση','Disconnect'),1,1).then(function(y){ if(!y) return;
            disconnect(st.code).then(function(){ ls.set(K,null); B.toast(T('Το ρολόι αποσυνδέθηκε.','The watch was disconnected.')); paint(); },function(){ paint('net'); }); }); }})));
    if(st&&st.code&&W()){ push(st.code); if(native) wstat().then(function(r){ var el=body.querySelector('#gmwst'); if(!el) return;
      /* 1.14.96: αν η σύνδεση με το ρολόι δεν απαντήσει, η οθόνη δεν μένει στο «Ψάχνω ρολόι…» */
      var d=body.querySelector('#gmdot'); if(d) d.className='sdot '+stCls(r);
      if(!r){ el.textContent=T('Δεν μπόρεσα να ελέγξω για ρολόι. Γράψε τον κωδικό στο ρολόι: Μενού (≡) › Ρυθμίσεις › Γράψε τον κωδικό.','Could not check for a watch. Type the code on the watch: Menu (≡) › Settings › Type the code.'); return; }
      el.textContent=stText(r); }); } }
  paint(); }
B.garmin={sheet:sheet,code:function(){ var s=ls.get(K,null); return s&&s.code; }};
/* ψάρια από το ρολόι: έξοδος και συνθήκες (μία φορά για το καθένα) */
function fix(){ try{
  var st=S(); if(!st||!st.raw) return;
  /* 1.1.0: έξοδοι από το ρολόι (δραστηριότητα «Ψάρεμα»): προφίλ ψαρέματος και μήνυμα, μία φορά */
  var wt=st.raw('trips').filter(function(t){ return t&&t.src==='watch'&&!t.deleted&&!t._wfix; });
  wt.forEach(function(t){ st.save('trips',Object.assign({},t,{_wfix:1,prof:t.prof||B.prof()})); });
  if(wt.length){ B.emit('store','alkyon-trips'); B.toast(wt.length===1?T('1 έξοδος από το ρολόι, με διαδρομή.','1 trip from the watch, with track.'):wt.length+T(' έξοδοι από το ρολόι.',' trips from the watch.')); }
  var bs=st.raw('bites').filter(function(b){ return b&&b.src==='watch'&&!b.deleted&&!b._wfix; }); if(!bs.length) return;
  var trips=st.raw('trips').filter(function(t){ return !t.deleted&&t.startMs; }), act=ls.get('alkyon-safe',{})||{};
  bs.forEach(function(b){ var p=b.date.split('-').map(Number), q=(b.time||'00:00').split(':').map(Number), ms=new Date(p[0],p[1]-1,p[2],q[0],q[1]).getTime(), o=Object.assign({},b,{_wfix:1});
    if(!o.trip){ if(act.active&&act.id&&act.start&&ms>=act.start-600000) o.trip=act.id; else { var t=trips.filter(function(x){ return ms>=x.startMs-600000&&ms<=(x.endMs||x.startMs)+600000; })[0]; if(t) o.trip=t.sid||t.id; } }
    o.prof=o.prof||B.prof();
    st.save('bites',o); try{ if(window.AlkyonBiteWx) AlkyonBiteWx.ensure(o); }catch(e){}
    /* 1.6.4: συρτή από το ρολόι: το ψάρι πηγαίνει εκεί που ήταν το δόλωμα */
    if(o.wtr&&B.troll&&B.troll.fromWatch) B.troll.fromWatch(o,ms).then(function(x){ if(!x) return; var cur=st.get('bites',o.id); if(!cur||cur.troll) return; st.save('bites',Object.assign({},cur,{lat:x.lat,lon:x.lon,boatLat:x.boatLat,boatLon:x.boatLon,troll:x.troll,tech:cur.tech||x.tech},cur.depth==null&&x.depth!=null?{depth:x.depth,depthSrc:x.depthSrc}:{})); B.emit('store','alkyon-bites'); }); });
  B.emit('store','alkyon-bites'); B.emit('trip');
  if(bs.length) B.toast((bs.length===1?T('1 ψάρι από το ρολόι','1 catch from the watch'):bs.length+T(' ψάρια από το ρολόι',' catches from the watch'))+T(' · συμπλήρωσε είδος στο Ημερολόγιο.',' · add the species in the Logbook.'));
}catch(e){} }
B.on&&B.on('sync',function(s){ if(s&&!/…$/.test(s.msg||'')) setTimeout(fix,300); });
/* κατά την έξοδο: συχνότερος συγχρονισμός για να φαίνονται γρήγορα τα ψάρια του ρολογιού */
setInterval(function(){ try{ var a=ls.get('alkyon-safe',{})||{}; if(a.active&&B.garmin.code()&&!document.hidden&&C()&&C().sync) C().sync(); }catch(e){} },120000);
setTimeout(fix,4000);
/* Apple Watch / Wear OS: σε κάθε άνοιγμα της εφαρμογής του κινητού ο κωδικός ξαναστέλνεται (π.χ. νέο ή επανεγκατεστημένο ρολόι) */
setTimeout(function(){ var c=B.garmin.code(); if(c) push(c); },6000);
})();
