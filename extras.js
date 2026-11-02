/* Έξοδος και ασφάλεια: Έναρξη/Τέλος εξόδου, ώρα επιστροφής, έλεγχος σιωπής, SOS, επαφή ασφαλείας (στο προφίλ). */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C||!document.getElementById('safeCard')) return;
var $=C.$, h=C.h, toast=C.toast;
var KEY='alkyon-safe';
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var BOT='AlkyonMaydayBot';   /* όνομα του Telegram bot, χωρίς @ */
var Cl=function(){ return window.AlkyonCloud&&window.AlkyonCloud.logged()?window.AlkyonCloud:null; };
function load(){ return C.lsGet(KEY,null)||{}; }
function save(s){ C.lsSet(KEY,s); }
function srvMsg(m){ var x=$('sfSrv'); if(x) x.textContent=m||''; }
function hm(ms){ var d=new Date(ms+C.utcMin()*60000); return ('0'+d.getUTCHours()).slice(-2)+':'+('0'+d.getUTCMinutes()).slice(-2); }
function dur(ms){ var m=Math.max(0,Math.round(ms/60000)), hh=Math.floor(m/60), en=window.LANG==='en', H=en?'h':'ω', M=en?'m':'λ'; return hh?hh+H+' '+('0'+(m%60)).slice(-2)+M:m+M; }
function newCode(){ var a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',o=''; for(var i=0;i<10;i++) o+=a[Math.floor(Math.random()*a.length)]; return o; }
function localMinToMs(hhmm){
  var p=hhmm.split(':'), off=C.utcMin(), nowL=Date.now()+off*60000, d=new Date(nowL);
  var t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),+p[0],+p[1])-off*60000;
  if(t<Date.now()-60000) t+=86400000;
  return t;
}
function mapLink(p){ return p&&p.lat!=null?'https://maps.google.com/?q='+p.lat.toFixed(5)+','+p.lon.toFixed(5):''; }
var batt=null;
try{ if(navigator.getBattery) navigator.getBattery().then(function(b){ batt=b; }).catch(function(){}); }catch(e){}
function battPct(){ return batt&&typeof batt.level==='number'?Math.round(batt.level*100):null; }

/* ---------- επαφή ασφαλείας (προφίλ) ---------- */
function hasContact(d){ return !!(d.phone||d.email||d.tgLinked); }
function readContact(){
  var d=load();
  d.name=$('sfName').value.trim(); d.phone=$('sfPhone').value.trim(); d.email=$('sfEmail').value.trim();
  save(d); return d;
}
function fillContact(){
  var d=load(); $('sfName').value=d.name||''; $('sfPhone').value=d.phone||''; $('sfEmail').value=d.email||'';
}
async function pushContact(){
  var cl=Cl(); if(!cl) return;
  var d=load(), body={email:($('sfEmail').value||'').trim()||null,updated_at:new Date().toISOString()};
  if(d.tgCode) body.tg_code=d.tgCode;
  var full=Object.assign({},body); if(d.selfCode) full.self_code=d.selfCode;
  var H={Prefer:'resolution=merge-duplicates,return=minimal'};
  try{ await cl.rest('safety_contacts',{method:'POST',headers:H,body:JSON.stringify(full)}); }
  catch(err){ try{ await cl.rest('safety_contacts',{method:'POST',headers:H,body:JSON.stringify(body)}); }catch(e2){} }
}
async function pollTg(){
  var cl=Cl(); if(!cl||!BOT) return;
  var j=null;
  try{ var r=await cl.rest('safety_contacts?select=tg_chat_id,tg_name,self_chat_id'); j=await r.json(); }
  catch(err){ try{ var r2=await cl.rest('safety_contacts?select=tg_chat_id,tg_name'); j=await r2.json(); }catch(e2){ return; } }
  var c=j&&j[0], d=load(); d.tgLinked=!!(c&&c.tg_chat_id); d.selfLinked=!!(c&&c.self_chat_id); save(d);
  var st=$('sfTgState'), ss=$('selfTgState');
  if(st){ if(d.tgLinked) st.textContent=T('Συνδέθηκε στο Telegram: ','Connected on Telegram: ')+(c.tg_name||T('επαφή','contact'))+' ✓'; else if(d.tgCode) st.textContent=T('Περιμένουμε να πατήσει η επαφή τον σύνδεσμο και Start. Η σύνδεση ολοκληρώνεται μέσα σε λίγα λεπτά.','Waiting for the contact to tap the link and Start. Linking completes within a few minutes.'); }
  if(ss){ if(d.selfLinked) ss.textContent='Το Telegram σου είναι συνδεδεμένο ✓'; else if(d.selfCode) ss.textContent='Πάτα Start στο Telegram. Η σύνδεση ολοκληρώνεται μέσα σε λίγα λεπτά.'; }
  render();
}

/* ---------- server ---------- */
var extOK=true;
async function pushTrip(){
  var s=load(), cl=Cl(); if(!s.id||!cl) return;
  /* v31z352: έξοδος χωρίς ειδοποίηση επαφής: τίποτα στον server, εκτός αν πατηθεί SOS */
  if(s.noAlert&&!s.sosAt){ srvMsg(''); return; }
  var base={id:s.id,user_name:cl.name()||'',route:s.route||'',due_at:new Date(s.due).toISOString(),status:s.active?'active':'done',
    last_lat:s.last?s.last.lat:null,last_lon:s.last?s.last.lon:null,last_at:s.last?new Date(s.last.t).toISOString():null};
  if(s.noAlert&&s.sosAt){ base.start_sent=true; } /* με SOS σε έξοδο χωρίς ειδοποιήσεις: μόνο το SOS, όχι μήνυμα «ξεκίνησε» */
  var ext=Object.assign({},base,{battery:battPct(),hb_at:new Date().toISOString(),silence_min:s.noAlert?0:(s.sil||0)});
  var H={Prefer:'resolution=merge-duplicates,return=minimal'};
  try{
    try{ if(!extOK) throw new Error('base'); await cl.rest('safety_trips',{method:'POST',headers:H,body:JSON.stringify(ext)}); }
    catch(e1){ extOK=false; await cl.rest('safety_trips',{method:'POST',headers:H,body:JSON.stringify(base)}); }
    srvMsg(s.active?'Η δήλωση έφτασε στον server: η επαφή θα ειδοποιηθεί αυτόματα αν κάτι δεν πάει καλά.':'');
    s=load(); s.synced=true; save(s);
    /* άμεση ειδοποίηση επαφής (αλλιώς την στέλνει ο server στην επόμενη επανάληψη, έως 5 λεπτά αργότερα) */
    try{
      if(cl.fn){
        if(s.active&&!s.pgStart){ s.pgStart=1; save(s); cl.fn('quick-processor',{action:'trip',id:s.id,phase:'start'}).catch(function(){ var q=load(); if(q.id===s.id){ q.pgStart=0; save(q); } }); }
        else if(!s.active&&s.pgStart&&!s.pgEnd){ s.pgEnd=1; save(s); cl.fn('quick-processor',{action:'trip',id:s.id,phase:'end'}).catch(function(){ var q=load(); if(q.id===s.id){ q.pgEnd=0; save(q); } }); }
      }
    }catch(e3){}
  }catch(err){ var s2=load(); s2.synced=false; save(s2); srvMsg('Δεν έφτασε στον server (ελέγξτε internet ή αν έχει στηθεί ο server). Η υπενθύμιση στο κινητό δουλεύει κανονικά.'); }
}

/* ---------- μηνύματα ---------- */
function plan(s,kind){
  var link=mapLink(s.last), t;
  if(kind==='sos') t=T('ΒΟΗΘΕΙΑ (Alkyon): δεν έχω επιστρέψει ακόμα και είχα δηλώσει επιστροφή στις ','HELP (Alkyon): I have not returned yet and I had declared my return at ')+hm(s.due)+(s.route?T(' (διαδρομή: ',' (route: ')+s.route+')':'')+'.';
  else t=T('Σχέδιο εξόδου (Alkyon): ψαρεύω με το σκάφος','Trip plan (Alkyon): fishing by boat')+(s.route?' – '+s.route:'')+T('. Επιστροφή στις ','. Return at ')+hm(s.due)+'.';
  if(link) t+=T(' Τελευταία θέση',' Last position')+(s.last&&s.last.t?' ('+hm(s.last.t)+')':'')+': '+link;
  return t;
}
function send(s,kind,via){
  var text=plan(s,kind), phone=(s.phone||'').replace(/[^\d+]/g,''), digits=phone.replace(/^\+/,'');
  if(via==='wa'&&digits) window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(text),'_blank');
  else if(via==='sms'&&phone) window.location.href='sms:'+phone+'?&body='+encodeURIComponent(text);
  else if(navigator.share) navigator.share({text:text}).catch(function(){});
  else { try{ navigator.clipboard.writeText(text); toast('Αντιγράφηκε το μήνυμα.'); }catch(e){} }
}

/* ---------- κατάσταση εξόδου ---------- */
var timer=null, lastTrack=0;
async function trackPos(){
  var s=load(); if(!s.active) return;
  lastTrack=Date.now();
  try{ var p=await C.getPosition(); s=load(); s.last={lat:p.lat,lon:p.lon,t:Date.now()}; save(s); render(); pushTrip(); }catch(e){ pushTrip(); }
}
function late(s){ return s.active&&Date.now()>s.due; }
/* v31z72: όσο χρησιμοποιείς το κινητό, η ώρα επιστροφής ανανεώνεται μόνη της (+30′, μέχρι 3 ώρες συνολικά) ώστε να μη σε ρωτάει «είσαι καλά;» και να μη ειδοποιείται η επαφή. Όχι μετά από SOS. */
var contSince=0, lastAct=0, EXT_MIN=30, EXT_CAP=180;
function maybeAuto(){
  var s=load(); if(!late(s)||s.sosAt) return;
  if(document.visibilityState!=='visible'||Date.now()-lastAct>180000) return;
  if(contSince>s.due+300000) return;
  if((s.autoExt||0)>=EXT_CAP) return;
  s.due=Date.now()+EXT_MIN*60000; s.autoExt=(s.autoExt||0)+EXT_MIN; save(s);
  toast(T('Η ώρα επιστροφής ανανεώθηκε (+30 λεπτά) γιατί χρησιμοποιείς την εφαρμογή.','Return time extended by 30 minutes because you are using the app.'));
  render(); pushTrip();
}
function onAct(){ var now=Date.now(); if(now-lastAct>180000) contSince=now; lastAct=now; var s=load(); if(late(s)&&contSince<=s.due+300000) maybeAuto(); }
['pointerdown','touchstart','keydown'].forEach(function(ev){ document.addEventListener(ev,onAct,{passive:true,capture:true}); });
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') onAct(); });
function bar(){
  var s=load(), b=$('lateBar');
  if(!late(s)){ if(b) b.remove(); return; }
  if(!b){
    b=h('div',{id:'lateBar',role:'alert'},h('span',{id:'lateTxt',style:'flex:1;min-width:200px'}),
      h('button',{class:'btn sm',type:'button',id:'lbBack',text:'Γύρισα'}),
      h('button',{class:'btn sm ghost',type:'button',id:'lbExt',style:'color:#fff;border-color:#fff',text:'+30 λεπτά'}),
      h('button',{class:'btn sm ghost',type:'button',id:'lbSos',style:'color:#fff;border-color:#fff',text:'Στείλε SOS'}));
    document.body.prepend(b);
    $('lbBack').addEventListener('click',back); $('lbExt').addEventListener('click',ext); $('lbSos').addEventListener('click',function(){ trackPos().then(function(){ sos(); }); });
  }
  $('lateTxt').textContent=T('Πέρασε η ώρα επιστροφής (','Your return time has passed (')+hm(s.due)+T('). Είσαι καλά;','). Are you OK?');
}
function sessBar(s){
  var b=$('sessBar');
  if(!s.active||late(s)){ if(b) b.remove(); return; }
  if(!b){
    b=h('div',{id:'sessBar'},h('span',{id:'sessTxt'}),h('button',{class:'btn sm',type:'button',id:'sessBite','aria-label':window.LANG==='en'?'Quick bite':'Γρήγορο τσίμπημα',text:'🐟 +'}),h('button',{class:'btn sm dang',type:'button',id:'sessSos',text:'SOS'}),h('button',{class:'btn sm',type:'button',id:'sessEnd',text:'Τέλος εξόδου'}));
    var hd=document.querySelector('header.top'); hd.parentNode.insertBefore(b,hd.nextSibling);
    $('sessTxt').addEventListener('click',openSheet);
    $('sessEnd').addEventListener('click',back);
    $('sessBite').addEventListener('click',function(){ var q=$('bQuick'); if(q&&!q.disabled) q.click(); });
    $('sessSos').addEventListener('click',function(){ window.AlkyonAsk(window.LANG==='en'?'Send an SOS with your location to your safety contact?':'Να σταλεί SOS με τη θέση σου στην επαφή ασφαλείας;',{title:'SOS',ok:'SOS',danger:true}).then(function(y){ if(y) trackPos().then(function(){ sos(); }); }); });
  }
  $('sessTxt').textContent='● Σε έξοδο '+dur(Date.now()-s.start)+' · επιστροφή '+hm(s.due);
}
function wxWarn(s){
  var el=$('sfWx'), c=C.getCond()||{}, msg='';
  if(s.active){
    var w=c.wind, v=c.wave;
    if((w!=null&&w>=27)||(v!=null&&v>=2.5)) msg=T('Επικίνδυνες συνθήκες (','Dangerous conditions (')+(w!=null?window.AlkyonUnits.wind(w)+T(' άνεμος',' wind'):'')+(v!=null?(w!=null?', ':'')+window.AlkyonUnits.wave(v)+T(' κύμα',' waves'):'')+T('). Σκέψου να γυρίσεις.','). Consider heading back.');
    else if((w!=null&&w>=20)||(v!=null&&v>=1.5)) msg=T('Προσοχή: δυναμώνει ο καιρός (','Caution: weather is getting rougher (')+(w!=null?window.AlkyonUnits.wind(w)+T(' άνεμος',' wind'):'')+(v!=null?(w!=null?', ':'')+window.AlkyonUnits.wave(v)+T(' κύμα',' waves'):'')+').';
  }
  el.textContent=msg; el.hidden=!msg;
}
function silNote(d){
  var sel=$('sfSil'), n=$('sfSilNote'); if(!sel) return;
  if(!d.selfLinked){ sel.value='0'; sel.disabled=true; n.textContent=BOT?'Για να ενεργοποιηθεί, σύνδεσε το δικό σου Telegram στο προφίλ. Το Alkyon θα σε ρωτάει «είσαι καλά;» πριν ειδοποιήσει την επαφή σου.':''; }
  else { sel.disabled=false; if(sel.value==='0'&&!sel.dataset.touched) sel.value='60'; n.textContent='Αν δεν υπάρχει σήμα από το κινητό για τόσο, σε ρωτάμε στο Telegram. Αν δεν απαντήσεις σε 15 λεπτά, ειδοποιείται η επαφή σου.'; }
}
function render(){
  var s=load(), on=!!s.active, card=$('safeCard');
  $('safeIdle').hidden=on; $('safeActive').hidden=!on;
  card.classList.toggle('live',!!(on&&!late(s))); card.classList.toggle('late',!!late(s));
  var bd=$('sfBadge'); bd.hidden=!on; bd.className='pill '+(late(s)?'bad':'good'); bd.textContent=late(s)?'Καθυστερείς':'Σε έξοδο';
  if(on){
    $('sfInfo').textContent=(late(s)?'Η επιστροφή ήταν στις ':'Επιστροφή στις ')+hm(s.due)+' · διάρκεια '+dur(Date.now()-s.start);
    $('sfLast').textContent=s.last?('Τελευταία γνωστή θέση: '+hm(s.last.t)+' · '+AlkyonCoord.fmt(s.last.lat,s.last.lon)):'Δεν έχει καταγραφεί θέση ακόμα.';
    $('sfMon').textContent=s.noAlert?(window.LANG==='en'?'Your safety contact is not notified on this trip. The SOS button still sends your position.':'Η επαφή ασφαλείας δεν ειδοποιείται σε αυτή την έξοδο. Το SOS στέλνει κανονικά τη θέση σου.'):'Παρακολούθηση: '+(s.sil?'έλεγχος αν χαθεί το σήμα μετά από '+s.sil+' λεπτά, ':'')+'ειδοποίηση επαφής αν περάσει η ώρα επιστροφής, και αν η μπαταρία πέσει κάτω από 10%.';
  } else {
    var d=load(); $('sfNoC').hidden=hasContact(d); silNote(d);
    if(!$('sfTime').value){ var t=new Date(Date.now()+C.utcMin()*60000+4*3600000); $('sfTime').value=('0'+t.getUTCHours()).slice(-2)+':'+('0'+t.getUTCMinutes()).slice(-2); }
  }
  document.body.classList.toggle('ontrip',!!on);
  var tb=$('tripBtn'); tb.textContent=!on?'▶ Έξοδος':(late(s)?'⚠ Τέλος εξόδου':'■ Τέλος εξόδου'); var sb=$('sosBtn'); if(sb) sb.hidden=!on; tb.classList.toggle('on',!!on); tb.classList.toggle('late',!!late(s));
  wxWarn(s); bar(); sessBar(s);
  try{ window.dispatchEvent(new Event('alkyon-sess')); }catch(x){}
}
function openSheet(){ render(); $('tripSheet').hidden=false; }
function closeSheet(){ $('tripSheet').hidden=true; }
function openForm(){ $('sfMsg').textContent=''; setDur(4); }
function setDur(hrs){
  var t=new Date(Date.now()+C.utcMin()*60000+hrs*3600000);
  $('sfTime').value=('0'+t.getUTCHours()).slice(-2)+':'+('0'+t.getUTCMinutes()).slice(-2);
  Array.prototype.forEach.call(document.querySelectorAll('#sfDur .chip'),function(b){ b.setAttribute('aria-pressed',String(+b.dataset.h===hrs)); });
}
function snap0(){ var c=C.getCond(); return c?{lat:c.lat,lon:c.lon,press:c.press,ptrend:c.ptrend,wind:c.wind,wave:c.wave,cloud:c.cloud,sst:c.sst}:null; }
function start(){
  var d=load(), time=$('sfTime').value;
  if(!time){ $('sfMsg').textContent='Βάλε ώρα επιστροφής.'; return; }
  var s=Object.assign({},d,{active:true,id:'trip-'+Date.now().toString(36),route:$('sfRoute').value.trim(),due:localMinToMs(time),autoExt:0,sosAt:0,pgStart:0,pgEnd:0,last:null,start:Date.now(),startDate:C.nicosiaToday(),cond0:snap0(),sil:+$('sfSil').value||0,noAlert:!!($('sfNotify')&&!$('sfNotify').checked),synced:undefined});
  save(s); $('sfMsg').textContent=''; render(); closeSheet();
  pushContact().then(function(){ return trackPos(); }).then(function(){ pushTrip(); });
  clearInterval(timer); timer=setInterval(tick,60000);
  if(s.noAlert){ toast(window.LANG==='en'?'Have a good trip! Your contact will not be notified on this trip (SOS still works).':'Καλή έξοδος! Η επαφή σου δεν θα ειδοποιηθεί σε αυτή την έξοδο (το SOS λειτουργεί).'); return; }
  toast(window.LANG==='en'?(hasContact(d)?'Have a good trip! Your contact has been notified.':'Have a good trip! You have no safety contact, so you only get a reminder on your phone.'):(hasContact(d)?'Καλή έξοδος! Η επαφή σου ενημερώθηκε.':'Καλή έξοδος! Δεν έχεις επαφή ασφαλείας, θα έχεις μόνο υπενθύμιση στο κινητό.'));
}
function summary(s){
  /* Μετράμε μόνο τσιμπήματα με ώρα μέσα στο παράθυρο της εξόδου (από την έναρξη μέχρι τώρα), με σύγκριση χρονικών τιμών. */
  var n=0, kg=0, pn=0, pkg=0, sp={}, off=C.utcMin()*60000, lo=Math.floor((s.start||0)/60000)*60000, hi=Date.now()+10*60000, prev=(C.Store.get('trips')||[]).filter(function(t){ return t.startMs&&t.endMs&&t.startMs<(s.start||0); });
  if(!s.start) return {n:0,kg:0,species:'',miss:0};
  var mi=0;
  (C.Store.misses?C.Store.misses():[]).forEach(function(b){
    if(!b.date||!b.time) return;
    var p=b.date.split('-').map(Number), q=b.time.split(':').map(Number); if(p.length<3||q.length<2||isNaN(p[0])||isNaN(q[0])) return;
    var ms=Date.UTC(p[0],p[1]-1,p[2],q[0],q[1])-off;
    if(prev.some(function(t){ return ms>=Math.floor(t.startMs/60000)*60000&&ms<=t.endMs; })) return;
    if(ms>=lo&&ms<=hi) mi++;
  });
  (C.Store.get('bites')||[]).forEach(function(b){
    if(!b.date||!b.time) return;
    var p=b.date.split('-').map(Number), q=b.time.split(':').map(Number); if(p.length<3||q.length<2||isNaN(p[0])||isNaN(q[0])) return;
    var ms=Date.UTC(p[0],p[1]-1,p[2],q[0],q[1])-off;
    if(prev.some(function(t){ return ms>=Math.floor(t.startMs/60000)*60000&&ms<=t.endMs; })) return;   // ανήκει σε προηγούμενη έξοδο
    if(ms>=lo&&ms<=hi){ if(b.gear){ pn++; pkg+=b.rel?0:(+b.kg||0); return; } n++; kg+=b.rel?0:(+b.kg||0); if(b.species) sp[b.species]=(sp[b.species]||0)+1; }
  });
  var top=Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; })[0]||'';
  return {n:n,kg:Math.round(kg*10)/10,species:top,miss:mi,pn:pn,pkg:Math.round(pkg*10)/10};
}
function back(){
  var s=load(); if(!s.active) return;
  var d=Date.now()-s.start, sm=summary(s), en=window.LANG==='en';
  var tk=window.AlkyonTrack?window.AlkyonTrack.take():null;
  s.active=false; save(s); pushTrip(); clearInterval(timer);
  $('sfMsg').textContent=en?'Welcome back.':'Καλωσόρισες πίσω.'; render(); closeSheet();
  if(d>=20*60000||sm.n>0||sm.miss>0){
    var pos=s.last||(s.cond0&&s.cond0.lat!=null?{lat:s.cond0.lat,lon:s.cond0.lon}:null);
    C.Store.save('trips',{sid:s.id,date:s.startDate||C.nicosiaToday(),spot:s.route||'',tech:'',species:sm.species,count:sm.n,miss:sm.miss,kg:sm.kg,pn:sm.pn||0,pkg:sm.pkg||0,startMs:s.start,endMs:Date.now(),cond0:s.cond0||null,km:tk?tk.km:undefined,track:tk?tk.track:undefined,moving:tk&&tk.moving&&tk.moving.length?tk.moving:undefined,lat:pos?pos.lat:null,lon:pos?pos.lon:null,notes:(en?'Recorded from Start/End trip (':'Καταγραφή από Έναρξη/Τέλος εξόδου (')+dur(d)+')'}).then(function(id){ try{ window.dispatchEvent(new CustomEvent('alkyon-tripend',{detail:{id:id}})); }catch(x){} }).catch(function(){});
    toast((en?'Trip saved: ':'Η έξοδος καταχωρήθηκε: ')+dur(d)+' · '+(sm.n?sm.n+(en?' bites':' τσιμπήματα'):(en?'no bites (kept too: it helps your personal forecast learn)':'χωρίς τσιμπήματα (κρατήθηκε κι αυτή: βοηθά την προσωπική πρόγνωση να μάθει)')));
  } else toast(en?'Welcome back. The trip was under 20 minutes with no bites, so it was not saved.':'Καλωσόρισες πίσω. Η έξοδος ήταν κάτω από 20 λεπτά χωρίς τσιμπήματα, οπότε δεν καταχωρήθηκε.');
}
window.AlkyonTrip={back:back,sosNow:function(){ sos(); },sheet:function(){ openSheet(); },sos:function(){ var en=window.LANG==='en'; window.AlkyonAsk(en?'Send an SOS with your location to your safety contact?':'Να σταλεί SOS με τη θέση σου στην επαφή ασφαλείας;',{title:'SOS',ok:en?'Send SOS':'Αποστολή SOS',cancel:en?'Cancel':'Άκυρο',danger:true}).then(function(ok){ if(ok) trackPos().then(function(){ sos(); }); }); },counts:function(){ var s=load(); return s.active?summary(s):{n:0,kg:0,species:'',miss:0}; },endSilent:function(){ var s=load(); if(!s.active) return false; if(window.AlkyonTrack) window.AlkyonTrack.take(); s.active=false; save(s); pushTrip(); clearInterval(timer); render(); return true; },state:load};
function ext(){ var s=load(); s.due=Math.max(s.due,Date.now())+30*60000; save(s); render(); pushTrip(); }
function sos(){
  var s=load(); s.due=Date.now()-60000; s.sosAt=Date.now(); save(s);
  function manual(){
    window.AlkyonAsk(window.LANG==='en'?'Send a help message with your last position. Choose how to send it.':'Στείλε μήνυμα βοήθειας με την τελευταία σου θέση. Διάλεξε πώς θα σταλεί.',{title:'SOS',ok:'WhatsApp',cancel:'SMS',danger:false}).then(function(ok){ send(s,'sos',ok?'wa':'sms'); });
  }
  /* v31z70: αν η επαφή είναι συνδεδεμένη στο Telegram, το SOS φεύγει αυτόματα από τον server, χωρίς ερώτηση και χωρίς «Αποστολή». Αλλιώς (ή αν δεν έφτασε στον server) μένει η χειροκίνητη αποστολή SMS/WhatsApp. */
  Promise.resolve(pushTrip()).then(function(){
    var d=load();
    if(d.tgLinked&&d.synced!==false){ toast(T('SOS στάλθηκε. Η επαφή σου ειδοποιείται αυτόματα στο Telegram.','SOS sent. Your contact is being notified on Telegram.')); }
    else manual();
  },manual);
}
function tick(){
  var s=load(); if(!s.active){ clearInterval(timer); return; }
  maybeAuto(); s=load();
  if(s.synced===false) pushTrip();
  if(Date.now()-lastTrack>=180000) trackPos();
  render();
}

/* ---------- σύνδεση events ---------- */
if(BOT){ $('sfTgBox').hidden=false; $('selfTgBox').hidden=false; pollTg(); }
$('sfTgLink').addEventListener('click',async function(){
  var d=readContact(); if(!d.tgCode){ d.tgCode=newCode(); save(d); }
  await pushContact();
  var link='https://t.me/'+BOT+'?start='+d.tgCode;
  var txt=T('Θέλω να σε έχω επαφή ασφαλείας όταν βγαίνω για ψάρεμα. Πάτα τον σύνδεσμο και μετά Start στο Telegram: ','I would like you to be my safety contact when I go fishing. Tap the link and then Start in Telegram: ')+link;
  if(navigator.share){ navigator.share({text:txt}).catch(function(){}); } else { try{ navigator.clipboard.writeText(txt); toast('Αντιγράφηκε ο σύνδεσμος.'); }catch(err){} }
  $('sfTgState').textContent='Περιμένουμε να πατήσει η επαφή τον σύνδεσμο και Start.'; setTimeout(pollTg,20000); setTimeout(pollTg,90000);
});
$('selfTgLink').addEventListener('click',async function(){
  var d=load(); if(!d.selfCode){ d.selfCode='S'+newCode(); save(d); }
  await pushContact();
  window.open('https://t.me/'+BOT+'?start='+d.selfCode,'_blank');
  $('selfTgState').textContent='Πάτα Start στο Telegram. Η σύνδεση ολοκληρώνεται μέσα σε λίγα λεπτά.'; setTimeout(pollTg,30000); setTimeout(pollTg,120000);
});
['sfName','sfPhone','sfEmail'].forEach(function(id){ $(id).addEventListener('change',function(){ readContact(); pushContact(); render(); }); });
$('sfSave').addEventListener('click',function(){ readContact(); pushContact(); $('sfCMsg').textContent='Αποθηκεύτηκε.'; render(); setTimeout(function(){ $('sfCMsg').textContent=''; },2500); });
$('profBtn').addEventListener('click',function(){ pollTg(); });
$('sfGoProf').addEventListener('click',function(){ closeSheet(); $('profBtn').click(); });
$('tripBtn').addEventListener('click',function(){ if(load().active) openSheet(); else { openForm(); openSheet(); } });
$('tripClose').addEventListener('click',closeSheet);
$('tripSheet').addEventListener('click',function(e){ if(e.target===this) closeSheet(); });
$('sfDur').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(b) setDur(+b.dataset.h); });
$('sfTime').addEventListener('input',function(){ Array.prototype.forEach.call(document.querySelectorAll('#sfDur .chip'),function(b){ b.setAttribute('aria-pressed','false'); }); });
$('sfSil').addEventListener('change',function(){ this.dataset.touched='1'; });
window.addEventListener('online',function(){ if(load().active) pushTrip(); });
$('sfStart').addEventListener('click',start);
$('sfBack').addEventListener('click',back);
$('sfExt').addEventListener('click',ext);
$('sfShare').addEventListener('click',function(){ var s=load(); (s.phone?window.AlkyonAsk(window.LANG==='en'?'Send your trip plan to your contact. Choose how to send it.':'Στείλε το σχέδιο στην επαφή σου. Διάλεξε πώς θα σταλεί.',{title:window.LANG==='en'?'Trip plan':'Σχέδιο εξόδου',ok:'WhatsApp',cancel:'SMS'}):Promise.resolve(false)).then(function(ok){ send(s,'plan',ok?'wa':'sms'); }); });
$('sfSos').addEventListener('click',function(){ trackPos().then(sos); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ render(); if(load().active) trackPos(); } });
/* Όταν χρησιμοποιείς την εφαρμογή (πάτημα, γράψιμο), ανανεώνεται το σήμα ζωής στον server: δεν σε ρωτάει «είσαι καλά;» όσο είσαι ενεργός */
var lastAct=0;
function activity(){ var n=Date.now(); if(n-lastAct<60000) return; if(!load().active) return; lastAct=n; lastTrack=n; trackPos(); }
['pointerdown','keydown','touchstart'].forEach(function(ev){ document.addEventListener(ev,activity,{passive:true,capture:true}); });
if(load().active){ clearInterval(timer); timer=setInterval(tick,60000); }
fillContact(); render();
})();
