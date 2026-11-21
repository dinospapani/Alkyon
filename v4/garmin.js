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
function disconnect(code){ var cl=C(); if(!cl||!code) return Promise.reject(new Error('nosess')); return cl.rest('watch_links?code=eq.'+encodeURIComponent(code),{method:'DELETE'}).then(function(r){ if(r&&r.ok===false) throw new Error('http '+r.status); }); }
function drop(code){ var cl=C(); if(!cl||!code) return Promise.resolve(); return cl.rest('watch_links?code=eq.'+code,{method:'DELETE'}).catch(function(){}); }
function sheet(){ var body=h('div',{class:'bform gmn'}), sh=B.sheet({title:T('Ρολόι','Watch'),body:body});
  function paint(err){ var st=ls.get(K,null); body.replaceChildren();
    body.append(h('p',{class:'sub',text:T('Με την εφαρμογή Alkyon στο ρολόι: πρόγνωση και βαθμός της ημέρας, ειδοποίηση όταν αλλάζει η πίεση, καταγραφή ψαριού (Ψάρι / Χάθηκε / Λαγοκέφαλος) με ώρα και θέση, και έξοδος με καταγραφή δραστηριότητας «Ψάρεμα» και διαδρομή GPS. Όλα έρχονται εδώ στο Ημερολόγιο.','With the Alkyon app on your watch: the day’s forecast and score, an alert when the pressure changes, catch logging (Fish / Lost / Toadfish) with time and position, and trips recorded as a «Fishing» activity with a GPS track. Everything arrives here in your Logbook.')}));
    if(!C()){ body.append(h('p',{class:'wn',text:T('Το ρολόι παίρνει την πρόγνωση και στέλνει τα ψάρια μέσω του λογαριασμού σου.','The watch gets the forecast and sends catches through your account.')}),B.accountBtn?B.accountBtn(T('Για το ρολόι Garmin χρειάζεται λογαριασμός.','The Garmin watch needs an account.')):null); return; }
    if(err) body.append(h('p',{class:'wn',text:err==='notable'?T('Η σύνδεση ρολογιού δεν είναι διαθέσιμη ακόμα.','Watch linking is not available yet.'):T('Δεν έγινε. Έλεγξε τη σύνδεση και ξαναδοκίμασε.','Failed. Check your connection and try again.')}));
    if(st&&st.code){
      body.append(h('div',{class:'gmcode'},h('small',{text:T('Κωδικός σύνδεσης','Link code')}),h('b',{text:st.code.slice(0,4)+' '+st.code.slice(4)})),
        h('h3',{text:'Garmin'}),
        h('ol',{class:'gmsteps'},
          h('li',{text:T('Εγκατέστησε το Alkyon στο ρολόι από το Connect IQ Store (ή την εφαρμογή Connect IQ στο κινητό).','Install Alkyon on the watch from the Connect IQ Store (or the Connect IQ app on your phone).')}),
          h('li',{text:T('Στο κινητό: Garmin Connect › η συσκευή σου › Εφαρμογές Connect IQ › Alkyon › Ρυθμίσεις.','On the phone: Garmin Connect › your device › Connect IQ apps › Alkyon › Settings.')}),
          h('li',{text:T('Στο «Κωδικός σύνδεσης» γράψε τον κωδικό χωρίς κενό και αποθήκευσε.','In “Link code” type the code without the space and save.')})),
        h('h3',{text:'Apple Watch · Wear OS (Samsung, Pixel)'}),
        h('p',{class:'note',text:T('Νέο, σε δοκιμαστική φάση: η εφαρμογή ρολογιού εμφανίζεται στο store του ρολογιού μόλις εγκριθεί. Αν δεν τη βρίσκεις ακόμα, δεν έχει εγκριθεί.','New, in testing: the watch app appears in the watch’s store once it is approved. If you cannot find it yet, it has not been approved.')}),
        h('ol',{class:'gmsteps'},
          h('li',{text:T('Εγκατέστησε το Alkyon στο ρολόι: Apple Watch από το App Store του ρολογιού (ή την εφαρμογή Watch στο iPhone), Wear OS από το Play Store του ρολογιού.','Install Alkyon on the watch: Apple Watch from the watch’s App Store (or the Watch app on the iPhone), Wear OS from the watch’s Play Store.')}),
          h('li',{text:W()?T('Ο κωδικός πηγαίνει μόνος του στο ρολόι όταν ανοίγεις αυτή την οθόνη στην εφαρμογή Alkyon του κινητού.','The code goes to the watch by itself when you open this screen in the Alkyon phone app.'):T('Στο ρολόι: Μενού (≡) › Ρυθμίσεις › Γράψε τον κωδικό. Με την εφαρμογή Alkyon στο κινητό ο κωδικός πηγαίνει μόνος του.','On the watch: Menu (≡) › Settings › Type the code. With the Alkyon phone app the code is sent by itself.')})),
        W()?h('p',{class:'note',id:'gmwst',text:T('Ψάχνω ρολόι…','Looking for a watch…')}):null,
        h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Αντιγραφή','Copy'),onclick:function(){ try{ navigator.clipboard.writeText(st.code).then(function(){ B.toast(T('Αντιγράφηκε.','Copied.')); }); }catch(e){} }}),
          W()?h('button',{class:'btn',type:'button',text:T('Στείλε στο ρολόι','Send to watch'),onclick:function(){ push(st.code).then(function(ok){ B.toast(ok?T('Στάλθηκε στο ρολόι.','Sent to the watch.'):T('Δεν βρέθηκε ρολόι με το Alkyon.','No watch with Alkyon found.')); }); }}):null,
          h('button',{class:'btn',type:'button',text:T('Νέος κωδικός','New code'),onclick:function(){ B.ask(T('Ο παλιός κωδικός θα σταματήσει να δουλεύει. Συνέχεια;','The old code will stop working. Continue?'),T('Νέος κωδικός','New code')).then(function(y){ if(!y) return; drop(st.code).then(create).then(function(){ paint(); },function(e){ paint(String(e.message)); }); }); }}),
          /* 1.14.83 (P0.5): αποσύνδεση ρολογιού: ο κωδικός σβήνει από τον server και το ρολόι σταματά να γράφει στο ημερολόγιο (μέσα σε ~1 λεπτό) */
          h('button',{class:'btn',type:'button',text:T('Αποσύνδεση ρολογιού','Disconnect watch'),onclick:function(){ B.ask(T('Το ρολόι θα σταματήσει να στέλνει ψάρια και να παίρνει πρόγνωση από τον λογαριασμό σου. Συνέχεια;','The watch will stop sending catches and getting the forecast from your account. Continue?'),T('Αποσύνδεση','Disconnect')).then(function(y){ if(!y) return;
            disconnect(st.code).then(function(){ ls.set(K,null); B.toast(T('Το ρολόι αποσυνδέθηκε.','The watch was disconnected.')); paint(); },function(){ paint('net'); }); }); }})));
    } else body.append(h('button',{class:'btn pri full',type:'button',text:T('Φτιάξε κωδικό σύνδεσης','Create a link code'),onclick:function(ev){ ev.currentTarget.disabled=true; create().then(function(){ paint(); },function(e){ paint(String(e.message)); }); }}));
    if(st&&st.code&&W()){ push(st.code); wstat().then(function(r){ var el=body.querySelector('#gmwst'); if(!el) return;
      /* 1.14.96: αν η σύνδεση με το ρολόι δεν απαντήσει, η οθόνη δεν μένει στο «Ψάχνω ρολόι…» */
      if(!r){ el.textContent=T('Δεν μπόρεσα να ελέγξω για ρολόι. Γράψε τον κωδικό στο ρολόι: Μενού (≡) › Ρυθμίσεις › Γράψε τον κωδικό.','Could not check for a watch. Type the code on the watch: Menu (≡) › Settings › Type the code.'); return; }
      el.textContent=r.app>0?T('Βρέθηκε ρολόι με το Alkyon ✓ · ο κωδικός στάλθηκε.','Watch with Alkyon found ✓ · code sent.'):r.watches>0?T('Βρέθηκε ρολόι, αλλά χωρίς το Alkyon. Εγκατέστησέ το και άνοιξε ξανά αυτή την οθόνη.','A watch was found, but without Alkyon. Install it and open this screen again.'):T('Δεν βρέθηκε Apple Watch / Wear OS συνδεδεμένο με το κινητό.','No Apple Watch / Wear OS watch connected to this phone.'); }); }
    body.append(h('p',{class:'note',text:T('Τα ψάρια από το ρολόι στέλνονται μέσω του κινητού (ή με WiFi/LTE στο Apple Watch και στο Wear OS)· αν δεν υπάρχει σύνδεση, το ρολόι τα κρατά και τα στέλνει αργότερα. Είδος, βάρος και φωτογραφία τα συμπληρώνεις μετά εδώ.','Catches from the watch go through your phone (or WiFi/LTE on Apple Watch and Wear OS); without a connection the watch keeps them and sends them later. Add species, weight and photo here afterwards.')})); }
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
