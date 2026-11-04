/* Alkyon 4 · Ρολόι Garmin (v31z552).
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
    ls.set(K,{code:code,at:Date.now()}); return code; },function(e){ var m=String(e&&e.message||e); throw new Error(/404|PGRST205|42P01|relation/.test(m)?'notable':m); }); }
function drop(code){ var cl=C(); if(!cl||!code) return Promise.resolve(); return cl.rest('watch_links?code=eq.'+code,{method:'DELETE'}).catch(function(){}); }
function sheet(){ var body=h('div',{class:'bform gmn'}), sh=B.sheet({title:T('Ρολόι Garmin','Garmin watch'),body:body});
  function paint(err){ var st=ls.get(K,null); body.replaceChildren();
    body.append(h('p',{class:'sub',text:T('Με την εφαρμογή Alkyon στο ρολόι: πρόγνωση και βαθμός της ημέρας, ειδοποίηση όταν αλλάζει η πίεση, καταγραφή ψαριού (Ψάρι / Χάθηκε / Λαγοκέφαλος) με ώρα και θέση, και έξοδος με καταγραφή δραστηριότητας «Ψάρεμα» και διαδρομή GPS. Όλα έρχονται εδώ στο Ημερολόγιο.','With the Alkyon app on your watch: the day’s forecast and score, an alert when the pressure changes, catch logging (Fish / Lost / Toadfish) with time and position, and trips recorded as a «Fishing» activity with a GPS track. Everything arrives here in your Logbook.')}));
    if(!C()){ body.append(h('p',{class:'wn',text:T('Το ρολόι παίρνει την πρόγνωση και στέλνει τα ψάρια μέσω του λογαριασμού σου.','The watch gets the forecast and sends catches through your account.')}),B.accountBtn?B.accountBtn(T('Για το ρολόι Garmin χρειάζεται λογαριασμός.','The Garmin watch needs an account.')):null); return; }
    if(err) body.append(h('p',{class:'wn',text:err==='notable'?T('Δεν έχει στηθεί ακόμα: τρέξε μία φορά το watch-link.sql στο Supabase.','Not set up yet: run watch-link.sql once in Supabase.'):T('Δεν έγινε. Έλεγξε τη σύνδεση και ξαναδοκίμασε.','Failed. Check your connection and try again.')}));
    if(st&&st.code){
      body.append(h('div',{class:'gmcode'},h('small',{text:T('Κωδικός σύνδεσης','Link code')}),h('b',{text:st.code.slice(0,4)+' '+st.code.slice(4)})),
        h('ol',{class:'gmsteps'},
          h('li',{text:T('Εγκατέστησε το Alkyon στο ρολόι από το Connect IQ Store (ή την εφαρμογή Connect IQ στο κινητό).','Install Alkyon on the watch from the Connect IQ Store (or the Connect IQ app on your phone).')}),
          h('li',{text:T('Στο κινητό: Garmin Connect › η συσκευή σου › Εφαρμογές Connect IQ › Alkyon › Ρυθμίσεις.','On the phone: Garmin Connect › your device › Connect IQ apps › Alkyon › Settings.')}),
          h('li',{text:T('Στο «Κωδικός σύνδεσης» γράψε τον κωδικό χωρίς κενό και αποθήκευσε.','In “Link code” type the code without the space and save.')})),
        h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Αντιγραφή','Copy'),onclick:function(){ try{ navigator.clipboard.writeText(st.code).then(function(){ B.toast(T('Αντιγράφηκε.','Copied.')); }); }catch(e){} }}),
          h('button',{class:'btn',type:'button',text:T('Νέος κωδικός','New code'),onclick:function(){ B.ask(T('Ο παλιός κωδικός θα σταματήσει να δουλεύει. Συνέχεια;','The old code will stop working. Continue?'),T('Νέος κωδικός','New code')).then(function(y){ if(!y) return; drop(st.code).then(create).then(function(){ paint(); },function(e){ paint(String(e.message)); }); }); }})));
    } else body.append(h('button',{class:'btn pri full',type:'button',text:T('Φτιάξε κωδικό σύνδεσης','Create a link code'),onclick:function(ev){ ev.currentTarget.disabled=true; create().then(function(){ paint(); },function(e){ paint(String(e.message)); }); }}));
    body.append(h('p',{class:'note',text:T('Τα ψάρια από το ρολόι στέλνονται μέσω του κινητού (Garmin Connect)· αν δεν υπάρχει σύνδεση, το ρολόι τα κρατά και τα στέλνει αργότερα. Είδος, βάρος και φωτογραφία τα συμπληρώνεις μετά εδώ.','Catches from the watch go through your phone (Garmin Connect); without a connection the watch keeps them and sends them later. Add species, weight and photo here afterwards.')})); }
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
})();
