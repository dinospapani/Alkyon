/* Alkyon 4 · Έξοδος και ασφάλεια: έναρξη / τέλος εξόδου, ώρα επιστροφής, έλεγχος σιωπής, SOS, επαφή ασφαλείας,
   διαδρομή GPS, συναγερμός άγκυρας, MOB. Ακριβής μεταφορά της κλασικής (extras.js, track.js, sea.js):
   ίδια κλειδιά (alkyon-safe, alkyon-track, alkyon-gps, alkyon-anchor, alkyon-mob), ίδιοι πίνακες στον server
   (safety_trips, safety_contacts) και ίδια κλήση στο quick-processor, ώστε ο server να ειδοποιεί την επαφή όπως πριν. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var KEY='alkyon-safe', BOT='AlkyonMaydayBot';
function load(){ return ls.get(KEY,null)||{}; }
function save(s){ ls.set(KEY,s); B.emit('trip'); }
function Cl(){ return B.cloud&&B.cloud.session()?B.cloud:null; }
function off(){ return -new Date().getTimezoneOffset(); }
function hm(ms){ var d=new Date(ms); return B.pad(d.getHours())+':'+B.pad(d.getMinutes()); }
function dur(ms){ var m=Math.max(0,Math.round(ms/60000)), hh=Math.floor(m/60); return hh?hh+T('ω ','h ')+B.pad(m%60)+T('λ','m'):m+T('λ','m'); }
function newCode(){ var a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',o=''; for(var i=0;i<10;i++) o+=a[Math.floor(Math.random()*a.length)]; return o; }
function toMs(hhmm){ var p=hhmm.split(':'), d=new Date(); d.setHours(+p[0],+p[1],0,0); var t=d.getTime(); if(t<Date.now()-60000) t+=86400000; return t; }
function mapLink(p){ return p&&p.lat!=null?'https://maps.google.com/?q='+p.lat.toFixed(5)+','+p.lon.toFixed(5):''; }
var batt=null; try{ if(navigator.getBattery) navigator.getBattery().then(function(b){ batt=b; }).catch(function(){}); }catch(e){}
function battPct(){ return batt&&typeof batt.level==='number'?Math.round(batt.level*100):null; }
function hasContact(d){ return !!(d.phone||d.email||d.tgLinked); }
function vib(p){ try{ navigator.vibrate&&navigator.vibrate(p); }catch(e){} }

/* ---------- θέση ---------- */
var fixP=null;
function getPos(){ return new Promise(function(res,rej){ if(fixP&&Date.now()-fixP.t<60000){ res(fixP); return; }
  if(!navigator.geolocation){ rej(); return; } navigator.geolocation.getCurrentPosition(function(p){ fixP={lat:p.coords.latitude,lon:p.coords.longitude,t:Date.now()}; ls.set('alkyon-v4-pos',{lat:+fixP.lat.toFixed(5),lon:+fixP.lon.toFixed(5),t:fixP.t}); res(fixP); },rej,{enableHighAccuracy:true,timeout:15000,maximumAge:30000}); }); }

/* ---------- server (ίδιο με την κλασική) ---------- */
var extOK=true, srv='';
function pushContact(){ var cl=Cl(); if(!cl) return Promise.resolve();
  var d=load(), body={email:(d.email||'').trim()||null,updated_at:new Date().toISOString()}; if(d.tgCode) body.tg_code=d.tgCode;
  var full=Object.assign({},body); if(d.selfCode) full.self_code=d.selfCode; var H={Prefer:'resolution=merge-duplicates,return=minimal'};
  return cl.rest('safety_contacts',{method:'POST',headers:H,body:JSON.stringify(full)}).catch(function(){ return cl.rest('safety_contacts',{method:'POST',headers:H,body:JSON.stringify(body)}).catch(function(){}); }); }
function pollTg(){ var cl=Cl(); if(!cl) return Promise.resolve();
  return cl.rest('safety_contacts?select=tg_chat_id,tg_name,self_chat_id').then(function(r){ return r.json(); }).catch(function(){ return cl.rest('safety_contacts?select=tg_chat_id,tg_name').then(function(r){ return r.json(); }).catch(function(){ return null; }); })
    .then(function(j){ if(!j) return; var c=j[0], d=load(); d.tgLinked=!!(c&&c.tg_chat_id); d.tgName=c&&c.tg_name||''; d.selfLinked=!!(c&&c.self_chat_id); save(d); }); }
function pushTrip(){
  var s=load(), cl=Cl(); if(!s.id||!cl) return Promise.resolve();
  if(s.noAlert&&!s.sosAt){ srv=''; return Promise.resolve(); }
  var base={id:s.id,user_name:(cl.session().name)||'',route:s.route||'',due_at:new Date(s.due).toISOString(),status:s.active?'active':'done',
    last_lat:s.last?s.last.lat:null,last_lon:s.last?s.last.lon:null,last_at:s.last?new Date(s.last.t).toISOString():null};
  if(s.noAlert&&s.sosAt) base.start_sent=true;
  var ext=Object.assign({},base,{battery:battPct(),hb_at:new Date().toISOString(),silence_min:s.noAlert?0:(s.sil||0)}), H={Prefer:'resolution=merge-duplicates,return=minimal'};
  return (extOK?cl.rest('safety_trips',{method:'POST',headers:H,body:JSON.stringify(ext)}):Promise.reject()).catch(function(){ extOK=false; return cl.rest('safety_trips',{method:'POST',headers:H,body:JSON.stringify(base)}); })
    .then(function(){ srv=s.active?T('Η δήλωση έφτασε στον server: η επαφή θα ειδοποιηθεί αυτόματα αν κάτι δεν πάει καλά.','The plan reached the server: your contact will be alerted automatically if something goes wrong.'):'';
      var q=load(); q.synced=true;
      if(q.active&&!q.pgStart){ q.pgStart=1; save(q); fn('trip',q.id,'start').catch(function(){ var z=load(); if(z.id===q.id){ z.pgStart=0; save(z); } }); }
      else if(!q.active&&q.pgStart&&!q.pgEnd){ q.pgEnd=1; save(q); fn('trip',q.id,'end').catch(function(){ var z=load(); if(z.id===q.id){ z.pgEnd=0; save(z); } }); }
      else save(q); })
    .catch(function(){ var q=load(); q.synced=false; save(q); srv=T('Δεν έφτασε στον server (έλεγξε το internet). Η υπενθύμιση στο κινητό δουλεύει κανονικά.','It did not reach the server (check your internet). The reminder on your phone still works.'); });
}
/* άμεση ειδοποίηση επαφής μέσω του quick-processor (αλλιώς τη στέλνει ο server στην επόμενη επανάληψη) */
function fn(action,id,phase){ var s=B.cloud.session(); if(!s) return Promise.reject();
  return fetch('https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/quick-processor',{method:'POST',headers:{apikey:'sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA','Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({action:action,id:id,phase:phase})}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); }); }

/* ---------- μηνύματα (WhatsApp / SMS) ---------- */
function plan(s,kind){
  var link=mapLink(s.last), t;
  if(kind==='sos') t=T('ΒΟΗΘΕΙΑ (Alkyon): δεν έχω επιστρέψει ακόμα και είχα δηλώσει επιστροφή στις ','HELP (Alkyon): I have not returned yet and I had declared my return at ')+hm(s.due)+(s.route?T(' (διαδρομή: ',' (route: ')+s.route+')':'')+'.';
  else t=T('Σχέδιο εξόδου (Alkyon): ψαρεύω','Trip plan (Alkyon): fishing')+(s.route?' – '+s.route:'')+T('. Επιστροφή στις ','. Return at ')+hm(s.due)+'.';
  if(link) t+=T(' Τελευταία θέση',' Last position')+(s.last&&s.last.t?' ('+hm(s.last.t)+')':'')+': '+link;
  return t;
}
function send(s,kind,via){ var text=plan(s,kind), phone=(s.phone||'').replace(/[^\d+]/g,''), digits=phone.replace(/^\+/,'');
  if(via==='wa'&&digits) window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(text),'_blank');
  else if(via==='sms'&&phone) window.location.href='sms:'+phone+'?&body='+encodeURIComponent(text);
  else if(navigator.share) navigator.share({text:text}).catch(function(){});
  else { try{ navigator.clipboard.writeText(text); B.toast(T('Αντιγράφηκε το μήνυμα.','Message copied.')); }catch(e){} } }
function chooseSend(s,kind){ var body=h('div',{class:'bform'}), sh;
  body.append(h('button',{class:'btn pri full',type:'button',text:'WhatsApp',onclick:function(){ sh.close(); send(s,kind,'wa'); }}),h('button',{class:'btn full',type:'button',text:'SMS',onclick:function(){ sh.close(); send(s,kind,'sms'); }}),h('button',{class:'btn full',type:'button',text:T('Άλλος τρόπος','Other'),onclick:function(){ sh.close(); send(s,kind,''); }}));
  sh=B.sheet({title:kind==='sos'?'SOS':T('Σχέδιο εξόδου','Trip plan'),body:body}); }

/* ---------- διαδρομή GPS (alkyon-track, ίδια μορφή) ---------- */
var wid=null, wl=null;
function gpsOn(){ return (ls.raw('alkyon-gps')!=='"0"'&&ls.get('alkyon-gps','1')!=='0')||trollOn(); }
/* 1.9.8: με ανοιχτή συρτή η διαδρομή γράφεται πάντα, ακόμα κι αν το «Καταγραφή διαδρομής GPS» είναι κλειστό */
function trollOn(){ try{ return !!(B.troll&&B.troll.on&&B.troll.on()); }catch(e){ return false; } }
function dist(a,b){ var R=6371000, r=Math.PI/180, dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r, x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)*Math.sin(dLo/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
function track(){ var s=load(); if(!s.active) return null; var t=ls.get('alkyon-track',null); if(!t||!Array.isArray(t.pts)||t.id!==s.id){ t={id:s.id,pts:[],m:0}; ls.set('alkyon-track',t); } return t; }
function onPos(p){ var c=p.coords; fixP={lat:c.latitude,lon:c.longitude,t:Date.now(),spd:c.speed,hd:c.heading}; /* 1.6.0: ταχύτητα/πορεία για τη συρτή */ onAnchor(c); var t=track(); if(!t) return; if(c.accuracy&&c.accuracy>60) return;
  var pt=[+c.latitude.toFixed(6),+c.longitude.toFixed(6),Date.now()], last=t.pts[t.pts.length-1];
  if(last){ var d=dist(last,pt); if(d<12){ B.emit('track'); return; } if(d>2000&&pt[2]-last[2]<20000) return; t.m+=d; }
  t.pts.push(pt); if(t.pts.length>3000) t.pts=t.pts.filter(function(_,i){ return i%2===0||i===t.pts.length-1; });
  ls.set('alkyon-track',t); B.emit('track'); }
function watch(){
  var s=load(), need=(s.active&&gpsOn())||!!anc();
  if(need&&wid==null&&navigator.geolocation){ try{ wid=navigator.geolocation.watchPosition(onPos,function(e){ if(e&&e.code===1){ ls.set('alkyon-gps','0'); ls.set('alkyon-gps-auto','1'); /* 1.8.31: κλειστό από άρνηση άδειας, όχι από εσένα → ξαναρωτάει στην επόμενη έξοδο */ B.toast(T('Δεν δόθηκε άδεια θέσης. Η διαδρομή απενεργοποιήθηκε.','Location permission denied. Route recording is off.')); } },{enableHighAccuracy:true,maximumAge:5000,timeout:30000}); }catch(e){} }
  if(!need&&wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; }
  /* οθόνη αναμμένη κατά την έξοδο και με συναγερμό άγκυρας */
  var wake=(s.active||!!anc())&&ls.get('alkyon-wake',true)!==false;
  if(wake&&!wl&&navigator.wakeLock&&!document.hidden){ try{ navigator.wakeLock.request('screen').then(function(l){ wl=l; l.addEventListener('release',function(){ wl=null; }); }).catch(function(){}); }catch(e){} }
  if(!wake&&wl){ try{ wl.release(); }catch(e){} wl=null; }
}
function simplify(pts,eps){ if(pts.length<3) return pts; var r=Math.PI/180, k=111320, la0=pts[0][0]*r, xs=pts.map(function(p){ return [p[1]*k*Math.cos(la0),p[0]*k]; }), keep=new Array(pts.length).fill(false), stack=[[0,pts.length-1]]; keep[0]=keep[pts.length-1]=true;
  while(stack.length){ var q=stack.pop(), a=xs[q[0]], b=xs[q[1]], mx=0, mi=-1, dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy;
    for(var i=q[0]+1;i<q[1];i++){ var p=xs[i], u=L2?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2:0; u=Math.max(0,Math.min(1,u)); var d=Math.hypot(p[0]-(a[0]+u*dx),p[1]-(a[1]+u*dy)); if(d>mx){ mx=d; mi=i; } }
    if(mx>eps&&mi>0){ keep[mi]=true; stack.push([q[0],mi],[mi,q[1]]); } }
  return pts.filter(function(_,i){ return keep[i]; }); }
function takeTrack(){ var s=load(), t=ls.get('alkyon-track',null), out=null;
  if(t&&t.id===s.id&&t.pts&&t.pts.length>1&&t.m>=100){ var eps=6, tr=simplify(t.pts.map(function(p){ return [p[0],p[1]]; }),eps); while(tr.length>400&&eps<400){ eps*=1.6; tr=simplify(tr,eps); }
    out={km:Math.round(t.m/100)/10,moving:(window.PP&&window.PP.movingFrom?window.PP.movingFrom(t.pts):undefined),track:tr.map(function(p){ return [+p[0].toFixed(5),+p[1].toFixed(5)]; })}; }
  ls.set('alkyon-track',null); return out; }

/* ---------- έξοδος ---------- */
var timer=null, lastTrack=0, contSince=0, lastAct=0;
function trackPos(){ var s=load(); if(!s.active) return Promise.resolve(); lastTrack=Date.now();
  return getPos().then(function(p){ var q=load(); q.last={lat:p.lat,lon:p.lon,t:Date.now()}; save(q); return pushTrip(); },function(){ return pushTrip(); }); }
function late(s){ return s.active&&Date.now()>s.due; }
/* όσο χρησιμοποιείς το κινητό, η ώρα επιστροφής ανανεώνεται μόνη της (+30′, έως 3 ώρες συνολικά). Όχι μετά από SOS. */
function maybeAuto(){ var s=load(); if(!late(s)||s.sosAt) return; if(document.visibilityState!=='visible'||Date.now()-lastAct>180000) return; if(contSince>s.due+300000) return; if((s.autoExt||0)>=180) return;
  s.due=Date.now()+30*60000; s.autoExt=(s.autoExt||0)+30; save(s); B.toast(T('Η ώρα επιστροφής ανανεώθηκε (+30 λεπτά) γιατί χρησιμοποιείς την εφαρμογή.','Return time extended by 30 minutes because you are using the app.')); pushTrip(); }
function onAct(){ var now=Date.now(); if(now-lastAct>180000) contSince=now; var was=lastAct; lastAct=now; var s=load(); if(!s.active) return; if(late(s)&&contSince<=s.due+300000) maybeAuto();
  if(now-was>=60000){ lastTrack=now; trackPos(); } }
['pointerdown','touchstart','keydown'].forEach(function(ev){ document.addEventListener(ev,onAct,{passive:true,capture:true}); });
function tick(){ var s=load(); if(!s.active){ clearInterval(timer); timer=null; return; } maybeAuto(); s=load(); if(s.synced===false) pushTrip(); if(Date.now()-lastTrack>=180000) trackPos(); B.emit('trip'); }
function startTimer(){ clearInterval(timer); timer=setInterval(tick,60000); }

function start(o){
  var d=load(), s=Object.assign({},d,{active:true,id:'trip-'+Date.now().toString(36),route:o.route||'',due:o.due,autoExt:0,sosAt:0,pgStart:0,pgEnd:0,last:null,start:Date.now(),startDate:B.store?todayStr():'',cond0:cond0(),sil:o.sil||0,noAlert:!o.notify,synced:undefined});
  save(s); ls.set('alkyon-track',null); watch(); startTimer();
  /* 1.6.1: με την έναρξη κατεβαίνουν χάρτης και πρόγνωση γύρω από τη θέση σου (αν υπάρχει σήμα και το επιτρέπει η ρύθμιση), για να δουλεύουν χωρίς σήμα */
  try{ var pp=B.lastPos(); if(B.prefetch&&pp&&B.prefetch.mode()!=='off') B.prefetch.run({date:s.startDate||new Date().toISOString().slice(0,10),lat:pp.lat,lon:pp.lon}); }catch(e){}
  /* v31z543: στέλνει στον server όρια και λιμάνι, για ειδοποιήσεις καιρού / επιστροφής με κλειστό κινητό */
  try{ if(B.pushSync) B.pushSync(); }catch(e){}
  pushContact().then(trackPos).then(pushTrip);
  B.emit('tripstart',s);
  if(s.noAlert) B.toast(T('Καλή έξοδος! Η επαφή σου δεν θα ειδοποιηθεί σε αυτή την έξοδο (το SOS λειτουργεί).','Have a good trip! Your contact will not be notified on this trip (SOS still works).'));
  else B.toast(hasContact(d)?T('Καλή έξοδος! Η επαφή σου ενημερώθηκε.','Have a good trip! Your contact has been notified.'):T('Καλή έξοδος! Δεν έχεις επαφή ασφαλείας, θα έχεις μόνο υπενθύμιση στο κινητό.','Have a good trip! You have no safety contact, so you only get a reminder on your phone.'));
}
function todayStr(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function cond0(){ var p=B.lastPos(); if(!p) return null; var fc=ls.get('alkyon-fc7',null), o={lat:p.lat,lon:p.lon};
  try{ var d=fc.fc.days[0], q=d.hours.filter(function(x){ return x.hr===new Date().getHours(); })[0]; if(q){ o.press=q.pres; o.ptrend=q.ptrend; o.wind=q.wind; o.wave=q.wave; o.cloud=q.cloud; o.sst=q.sst; } }catch(e){} return o; }
function bms(b){ if(!b.date||!b.time) return null; var p=b.date.split('-').map(Number), q=b.time.split(':').map(Number); if(p.length<3||q.length<2||isNaN(p[0])||isNaN(q[0])) return null; return new Date(p[0],p[1]-1,p[2],q[0],q[1]).getTime(); }
function summary(s){
  var n=0,kg=0,pn=0,pkg=0,mi=0,sp={}, lo=Math.floor((s.start||0)/60000)*60000, hi=Date.now()+10*60000, prev=B.store.raw('trips').filter(function(t){ return t.startMs&&t.endMs&&t.startMs<(s.start||0); });
  if(!s.start) return {n:0,kg:0,species:'',miss:0};
  B.store.raw('bites').forEach(function(b){ var ms=bms(b); if(ms==null) return; if(prev.some(function(t){ return ms>=Math.floor(t.startMs/60000)*60000&&ms<=t.endMs; })) return; if(ms<lo||ms>hi) return;
    if(b.miss){ mi++; return; } if(b.gear){ pn++; pkg+=b.rel?0:(+b.kg||0); return; } n++; kg+=b.rel?0:(+b.kg||0); if(b.species) sp[b.species]=(sp[b.species]||0)+1; });
  return {n:n,kg:Math.round(kg*10)/10,species:Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; })[0]||'',miss:mi,pn:pn,pkg:Math.round(pkg*10)/10};
}
/* ολοκληρωμένα εργαλεία (δίχτυα κ.λπ.) μπαίνουν σύνοψη μέσα στην έξοδο, όπως στην κλασική */
function gearCompact(tid){ var g=ls.get('alkyon-gear',null); if(!g||!Array.isArray(g.items)) return null; var out=[];
  g.items.forEach(function(it){ if(it.state!=='done'||it.att) return; var n=0,kg=0; B.store.raw('bites').forEach(function(b){ if(b.gear===it.id&&!b.miss&&!B.pest(b)){ n+=Math.max(1,Math.floor(+b.cnt)||1); kg+=b.rel?0:(+b.kg||0); } });
    var thin=function(p){ if(!p||p.length<=120) return p||[]; var k=Math.ceil(p.length/120); return p.filter(function(_,i){ return i%k===0||i===p.length-1; }); };
    out.push({id:it.id,type:it.type,name:it.name||it.type,set:{a:it.set.a||null,b:it.set.b,ta:it.set.ta,tb:it.set.tb,pts:thin(it.set.pts)},haul:it.haul?{a:it.haul.a,b:it.haul.b,ta:it.haul.ta,tb:it.haul.tb,pts:thin(it.haul.pts)}:null,n:n,kg:Math.round(kg*10)/10}); it.att=tid; });
  if(out.length) ls.set('alkyon-gear',g); return out.length?out:null; }
function back(){
  var s=load(); if(!s.active) return; var d=Date.now()-s.start, sm=summary(s), tk=takeTrack();
  s.active=false; save(s); pushTrip(); clearInterval(timer); timer=null; watch();
  if(d>=20*60000||sm.n>0||sm.miss>0){
    var pos=s.last||(s.cond0&&s.cond0.lat!=null?{lat:s.cond0.lat,lon:s.cond0.lon}:null);
    var rec={sid:s.id,date:s.startDate||todayStr(),spot:s.route||'',tech:'',species:sm.species,count:sm.n,miss:sm.miss,kg:sm.kg,pn:sm.pn||0,pkg:sm.pkg||0,startMs:s.start,endMs:Date.now(),cond0:s.cond0||null,lat:pos?pos.lat:null,lon:pos?pos.lon:null,notes:T('Καταγράφηκε από Έναρξη/Τέλος εξόδου','Recorded from Start/End trip')};
    if(tk){ rec.km=tk.km; rec.track=tk.track; if(tk.moving&&tk.moving.length) rec.moving=tk.moving; }
    var id=B.store.save('trips',rec), gc=gearCompact(id); if(gc){ var t=B.store.get('trips',id); B.store.save('trips',Object.assign({},t,{gear:gc})); }
    B.toast(T('Η έξοδος καταχωρήθηκε: ','Trip saved: ')+dur(d)+', '+(sm.n?sm.n+' '+T('ψάρια','catches'):T('χωρίς ψάρια (κρατήθηκε: βοηθά την προσωπική πρόγνωση)','no catches (kept: it helps your personal forecast)')));
    /* 1.6.1: πρώτα τα ψάρια χωρίς είδος (ένα πάτημα το καθένα), μετά η ερώτηση για τη θάλασσα */
    if(B.speciesFill) B.speciesFill(s.id,function(){ seaQuestion(id,pos); }); else seaQuestion(id,pos);
    B.emit('tripend',{id:id,startMs:s.start,endMs:Date.now()});
  } else { B.emit('tripend',{id:null,startMs:s.start,endMs:Date.now()}); B.toast(T('Καλωσόρισες πίσω. Η έξοδος ήταν κάτω από 20 λεπτά χωρίς ψάρια, οπότε δεν καταχωρήθηκε.','Welcome back. The trip was under 20 minutes with no catches, so it was not saved.')); }
}
/* «Πώς ήταν η θάλασσα;» (διορθώνει την πρόγνωση κύματος της περιοχής, alkyon-seaobs) */
function seaQuestion(id,pos){ if(B.prof()==='lake'||!pos) return; var body=h('div',{class:'bform'}), sh;
  [[-1,T('Πιο ήρεμη','Calmer')],[0,T('Όπως έλεγε','As forecast')],[1,T('Πιο άγρια','Rougher')]].forEach(function(o){ body.append(h('button',{class:'btn full',type:'button',text:o[1],onclick:function(){
    var a=(ls.get('alkyon-seaobs',[])||[]).filter(function(x){ return x.trip!==id; }); a.push({t:Date.now(),lat:+pos.lat.toFixed(4),lon:+pos.lon.toFixed(4),f:o[0],trip:id}); ls.set('alkyon-seaobs',a.slice(-200)); sh.close(); B.toast(T('Ευχαριστώ. Η πρόγνωση κύματος εδώ θα προσαρμόζεται.','Thanks. The wave forecast here will adapt.')); }})); });
  sh=B.sheet({title:T('Πώς ήταν η θάλασσα σε σχέση με την πρόγνωση;','How was the sea compared with the forecast?'),body:body}); }
function ext(){ var s=load(); s.due=Math.max(s.due,Date.now())+30*60000; save(s); pushTrip(); B.toast(T('Η ώρα επιστροφής έγινε ','Return time is now ')+hm(s.due)+'.'); }
function sos(){
  var s=load(); s.due=Date.now()-60000; s.sosAt=Date.now(); save(s);
  var manual=function(){ chooseSend(load(),'sos'); };
  trackPos().then(function(){ var d=load(); if(d.tgLinked&&d.synced!==false) B.toast(T('SOS στάλθηκε. Η επαφή σου ειδοποιείται αυτόματα στο Telegram.','SOS sent. Your contact is being notified on Telegram.')); else manual(); },manual);
}

/* ---------- οθόνες ---------- */
B.trip={state:load,active:function(){ return !!load().active; },back:back,ext:ext,sos:sos,srv:function(){ return srv; },fix:function(){ return fixP; },track:function(){ var t=ls.get('alkyon-track',null), s=load(); return s.active&&t&&t.id===s.id?t:null; }};
B.tripStart=function(o){ o=o&&typeof o==='object'?o:null; /* v31z541: o.where = σημείο από την αυτόματη ερώτηση */
  var d=load();
  if(d.active){ B.tripSheet(); return; }
  var tm=h('input',{type:'time'}), chips=h('div',{class:'chips',style:{margin:'0'}});
  function setDur(hrs){ var t=new Date(Date.now()+hrs*3600000); tm.value=B.pad(t.getHours())+':'+B.pad(t.getMinutes()); [].forEach.call(chips.children,function(c){ c.setAttribute('aria-pressed',String(+c.dataset.h===hrs)); }); }
  [2,3,4,6,8].forEach(function(x){ chips.append(h('button',{type:'button',class:'chip',data:{h:x},text:x+T(' ώρες',' h'),onclick:function(){ setDur(x); }})); }); setDur(4);
  tm.addEventListener('input',function(){ [].forEach.call(chips.children,function(c){ c.setAttribute('aria-pressed','false'); }); });
  /* v31z530: χωρίς αυτόματη συμπλήρωση του browser (έβαζε το όνομα του χρήστη)· παλιά τιμή που είναι όνομα ανθρώπου αγνοείται */
  var rv=String((o&&o.where)||d.route||'').trim(), ses=(B.cloud&&B.cloud.session&&B.cloud.session())||{}, bad=[ses.name,ses.email,d.name,d.contactName,(d.contact&&d.contact.name)].filter(Boolean).map(function(x){ return String(x).trim().toLowerCase(); });
  if(rv&&bad.indexOf(rv.toLowerCase())>=0) rv='';
  var rt=h('input',{type:'text',maxlength:'80',value:rv,placeholder:T('Πού πας; (προαιρετικό) π.χ. Πωμός','Where? (optional) e.g. Pomos'),autocomplete:'off',autocapitalize:'sentences',name:'alk-trip-where',enterkeyhint:'done',spellcheck:'false'});
  var sil=h('select',{class:'select'}); [[0,T('Χωρίς','Off')],[30,T('Μετά από 30 λεπτά','After 30 minutes')],[60,T('Μετά από 60 λεπτά','After 60 minutes')],[90,T('Μετά από 90 λεπτά','After 90 minutes')]].forEach(function(o){ sil.append(h('option',{value:String(o[0]),text:o[1]})); }); sil.value=String(d.sil!=null?d.sil:60);
  var nt=h('input',{type:'checkbox',checked:true}), gpAuto=ls.get('alkyon-gps-auto','0')==='1', gp=h('input',{type:'checkbox',checked:gpsOn()||gpAuto});
  var c=hasContact(d), logged=!!Cl(), ex=B.tripStartExtras?B.tripStartExtras(rt):null;
  /* απλή μορφή: επαφή σε μία γραμμή, πότε γυρνάς, πού πας, ειδοποίηση· τα υπόλοιπα στο «Περισσότερα» */
  var SH='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>';
  var info=h('button',{type:'button',class:'tcontact'+(c&&logged?' ok':' warn'),onclick:function(){ if(B.safetyCard) B.sheet({title:T('Επαφή ασφαλείας','Safety contact'),body:B.safetyCard(),stack:true}); }},h('span',{class:'tci',html:SH}),
    h('span',{class:'tx'},h('b',{text:c?T('Επαφή ασφαλείας: ','Safety contact: ')+(d.name||d.phone||d.email||(d.tgLinked?'Telegram':'')):T('Χωρίς επαφή ασφαλείας','No safety contact')}),
      h('small',{text:!logged?T('Χωρίς λογαριασμό: μόνο υπενθύμιση στο κινητό','No account: phone reminder only'):c?T('Ειδοποιείται αν δεν γυρίσεις στην ώρα σου','Alerted if you are not back on time'):T('Πάτα για να ορίσεις','Tap to set one')})));
  var tmRow=h('label',{class:'ttime'},h('span',{text:T('Επιστροφή έως','Back by')}),tm);
  var more=h('details',{class:'tmore'},h('summary',{text:T('Περισσότερες ρυθμίσεις','More settings')}),
    h('label',{class:'fld'},h('span',{text:T('Αν χαθεί η επαφή με το κινητό','If contact with the phone is lost')}),sil,h('small',{text:T('Αν το κινητό σταματήσει να στέλνει σήμα για τόσο χρόνο, σε ρωτά στο Telegram και μετά ειδοποιεί την επαφή.','If the phone stops sending a signal this long, it asks you on Telegram, then alerts your contact.')})),
    ex?ex.nodes:null);
  /* 1.8.31: έξω από τις «Περισσότερες ρυθμίσεις», για να φαίνεται */
  var gpRow=h('div',null,h('label',{class:'tg'},gp,h('span',{text:T('Καταγραφή διαδρομής GPS (περισσότερη μπαταρία)','Record GPS route (uses more battery)')})),gpAuto?h('p',{class:'trhint warn',text:T('Την προηγούμενη φορά το κινητό δεν έδωσε άδεια θέσης και η καταγραφή έκλεισε. Ξανατσεκάρισμένη: αν σε ρωτήσει το κινητό, πάτα «Να επιτρέπεται».','Last time the phone did not allow location and recording turned off. Ticked again: if the phone asks, tap “Allow”.')}):null);
  var go=h('button',{class:'btn pri full tgo',type:'button',text:'▶ '+T('Έναρξη εξόδου','Start trip'),onclick:function(){ if(!tm.value){ B.toast(T('Βάλε ώρα επιστροφής.','Set a return time.')); return; }
    ls.set('alkyon-gps',gp.checked?'1':'0'); ls.set('alkyon-gps-auto','0'); if(ex&&ex.apply) ex.apply(); sh.close(); start({due:toMs(tm.value),route:rt.value.trim(),sil:+sil.value||0,notify:nt.checked}); }});
  var body=h('div',{class:'bform tstart'},info,h('div',{class:'fld'},h('span',{text:T('Πόση ώρα θα λείψεις;','How long will you be out?')}),chips,tmRow),h('label',{class:'fld twhere','aria-label':T('Πού πας (προαιρετικό)','Where (optional)')},rt),
    c?h('label',{class:'tg'},nt,h('span',{text:T('Ειδοποίηση της επαφής μου σε αυτή την έξοδο','Alert my contact on this trip')})):null,B.liveToggle?B.liveToggle():null,gpRow,more,go);
  /* v31z542: συχνοί λαγοκέφαλοι εδώ; (από τα δικά σου τσιμπήματα σε 400 m) */
  try{ var me=B.lastPos(), pn=B.pestHere&&me?B.pestHere(me.lat,me.lon):null; if(pn) body.insertBefore(h('p',{class:'pesthint',text:'🐡 '+T('Συχνοί λαγοκέφαλοι εδώ (','Toadfish are common here (')+pn[0]+T(' στα ',' of ')+pn[1]+T(' τσιμπήματά σου). Πάρε συρματόλινα ή χοντρό παράμαλλο και προτίμησε τεχνητά από μαλακό δόλωμα.',' of your bites). Bring wire or a heavy leader and prefer lures to soft bait.')}),go); }catch(e){}
  var sh=B.sheet({title:T('Έξοδος για ψάρεμα','Fishing trip'),body:body});
};
B.tripSheet=function(){
  var s=load(); if(!s.active){ B.tripStart(); return; }
  var t=B.trip.track(), sm=summary(s), lt=late(s), body=h('div',{class:'bform'}), sh;
  if(B.biteForm) body.append(h('button',{class:'btn pri full',type:'button',text:'+ '+T('Νέο ψάρι','New catch'),onclick:function(){ sh.close(); setTimeout(function(){ B.biteForm(); },120); }}));
  body.append(h('div',{class:'card tripcard'+(lt?' late':''),style:{margin:'0'}},h('b',{text:lt?T('Πέρασε η ώρα επιστροφής (','Past your return time (')+hm(s.due)+')':T('Επιστροφή στις ','Back at ')+hm(s.due)+' ('+T('σε ','in ')+dur(s.due-Date.now())+')'}),
    h('p',{class:'sub',style:{margin:'4px 0 0'},text:[T('Έξοδος ','Out ')+dur(Date.now()-s.start),t&&t.m>=100?B.num(t.m/1000,1)+' km':'',sm.n+' '+T('ψάρια','catches')+(sm.kg?', '+B.num(sm.kg,1)+' kg':'')].filter(Boolean).join(' · ')}),
    srv?h('p',{class:'sub',style:{margin:'6px 0 0'},text:srv}):null));
  var sx=B.tripSheetExtras&&B.tripSheetExtras(); if(sx) body.append(sx);
  body.append(h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('+30 λεπτά','+30 min'),onclick:function(){ ext(); sh.close(); }}),h('button',{class:'btn',type:'button',text:T('Στείλε το σχέδιο','Send the plan'),onclick:function(){ sh.close(); chooseSend(load(),'plan'); }})));
  body.append(h('button',{class:'btn pri full',type:'button',text:'■ '+T('Τέλος εξόδου','End trip'),onclick:function(){ sh.close(); back(); }}));
  body.append(h('button',{class:'btn full sos',type:'button',text:'SOS',onclick:function(){ B.ask(T('Να σταλεί SOS με τη θέση σου στην επαφή ασφαλείας;','Send an SOS with your location to your safety contact?'),T('Αποστολή SOS','Send SOS'),true).then(function(y){ if(y){ sh.close(); sos(); } }); }}));
  sh=B.sheet({title:T('Έξοδος σε εξέλιξη','Trip in progress'),body:body});
};
/* μπάρα εξόδου πάνω από την κάτω πλοήγηση, σε όλες τις σελίδες */
var bar=null;
function paintBar(){
  var s=load(); if(!bar){ bar=h('button',{class:'tripbar',type:'button',onclick:function(){ B.tripSheet(); }}); document.body.appendChild(bar); }
  document.body.classList.toggle('ontrip',!!s.active); bar.hidden=true; /* 1.7.6: η κατάσταση φαίνεται στο κεντρικό κουμπί */ if(!s.active) return;
  var lt=late(s); bar.classList.toggle('late',lt);
  bar.textContent=(lt?T('Πέρασε η ώρα επιστροφής ','Past return time ')+hm(s.due)+T(' · πάτα εδώ',' · tap here'):T('Σε έξοδο · επιστροφή ','On a trip · back at ')+hm(s.due)+' ('+dur(s.due-Date.now())+')');
}
B.on('trip',paintBar);
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ paintBar(); watch(); if(load().active) trackPos(); } });
window.addEventListener('online',function(){ if(load().active) pushTrip(); });

/* ---------- επαφή ασφαλείας (Προφίλ) ---------- */
B.safetyCard=function(){
  var d=load(), c=h('section',{class:'card'},h('h2',{text:T('Επαφή ασφαλείας','Safety contact')}),h('p',{class:'sub',style:{margin:'-4px 0 12px'},text:T('Το άτομο που ειδοποιείται αν δεν γυρίσεις στην ώρα σου ή αν χαθεί η επαφή μαζί σου. Δεν χρειάζεται να έχει την εφαρμογή.','The person alerted if you are not back on time or contact with you is lost. They do not need the app.')}));
  var nm=h('input',{type:'text',maxlength:'40',value:d.name||'',autocomplete:'off'}), ph=h('input',{type:'tel',value:d.phone||'',placeholder:'+357…',inputmode:'tel',autocomplete:'off'}), em=h('input',{type:'email',maxlength:'80',value:d.email||'',inputmode:'email',autocomplete:'off'});
  var sv=h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση επαφής','Save contact'),onclick:function(){ var x=load(); x.name=nm.value.trim(); x.phone=ph.value.trim(); x.email=em.value.trim(); save(x); pushContact(); B.toast(T('Αποθηκεύτηκε.','Saved.')); }});
  c.append(h('div',{class:'bform'},h('label',{class:'fld'},h('span',{text:T('Όνομα','Name')}),nm),h('label',{class:'fld'},h('span',{text:T('Τηλέφωνο (με κωδικό χώρας)','Phone (with country code)')}),ph),h('label',{class:'fld'},h('span',{text:T('Email (αυτόματη ειδοποίηση)','Email (automatic alert)')}),em),sv));
  if(Cl()){
    var tgs=h('p',{class:'sub',text:d.tgLinked?T('Η επαφή είναι συνδεδεμένη στο Telegram','Your contact is connected on Telegram')+(d.tgName?': '+d.tgName:'')+' ✓':d.tgCode?T('Περιμένουμε να πατήσει η επαφή τον σύνδεσμο και Start.','Waiting for your contact to tap the link and Start.'):T('Δωρεάν αυτόματη ειδοποίηση της επαφής στο Telegram.','Free automatic alert to your contact on Telegram.')});
    var me=h('p',{class:'sub',text:d.selfLinked?T('Το Telegram σου είναι συνδεδεμένο ✓','Your Telegram is connected ✓'):T('Αν χαθεί η επαφή με το κινητό σου, ο server σε ρωτά πρώτα εσένα στο Telegram και ειδοποιεί την επαφή μόνο αν δεν απαντήσεις.','If contact with your phone is lost, the server asks you first on Telegram and alerts your contact only if you do not reply.')});
    c.append(h('h3',{class:'h3',text:'Telegram'}),tgs,h('button',{class:'btn full',type:'button',text:T('Στείλε σύνδεσμο στην επαφή','Send a link to your contact'),onclick:function(){ var x=load(); if(!x.tgCode){ x.tgCode=newCode(); save(x); }
      pushContact().then(function(){ var link='https://t.me/'+BOT+'?start='+load().tgCode, txt=T('Θέλω να σε έχω επαφή ασφαλείας όταν βγαίνω για ψάρεμα. Πάτα τον σύνδεσμο και μετά Start στο Telegram: ','I would like you to be my safety contact when I go fishing. Tap the link and then Start in Telegram: ')+link;
        if(navigator.share) navigator.share({text:txt}).catch(function(){}); else { try{ navigator.clipboard.writeText(txt); B.toast(T('Αντιγράφηκε ο σύνδεσμος.','Link copied.')); }catch(e){} } setTimeout(pollTg,20000); setTimeout(pollTg,90000); }); }}),
      me,h('button',{class:'btn full',type:'button',text:T('Σύνδεση του δικού μου Telegram','Connect my own Telegram'),onclick:function(){ var x=load(); if(!x.selfCode){ x.selfCode='S'+newCode(); save(x); } pushContact().then(function(){ window.open('https://t.me/'+BOT+'?start='+load().selfCode,'_blank'); setTimeout(pollTg,30000); setTimeout(pollTg,120000); }); }}));
    pollTg();
  } else c.append(h('p',{class:'sub',text:T('Για αυτόματη ειδοποίηση της επαφής σου αν δεν γυρίσεις χρειάζεται λογαριασμός.','To alert your contact automatically if you are not back, an account is needed.')}),B.accountBtn?B.accountBtn(T('Η αυτόματη ειδοποίηση ασφαλείας στέλνεται από τον server μέσω του λογαριασμού σου, ακόμα κι αν το κινητό σου κλείσει.','The automatic safety alert is sent by the server through your account, even if your phone is off.')):null);
  return c;
};

/* ---------- συναγερμός άγκυρας ---------- */
function anc(){ var a=ls.get('alkyon-anchor',null); return a&&typeof a.lat==='number'&&typeof a.r==='number'?a:null; }
var over=0, alarmT=null, ac=null, lastAn=0, muted=0, abar=null;
function audio(){ try{ if(!ac){ var A=window.AudioContext||window.webkitAudioContext; if(A) ac=new A(); } if(ac&&ac.state==='suspended') ac.resume(); }catch(e){} }
function beep(){ if(!ac||Date.now()<muted) return; try{ var o=ac.createOscillator(), g=ac.createGain(); o.type='square'; o.frequency.value=(Math.floor(Date.now()/900)%2)?740:988; g.gain.value=.35; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+.35); }catch(e){} }
function alarm(txt,sub){
  if(!abar){ abar=h('div',{class:'ancalarm',role:'alert'}); document.body.appendChild(abar); }
  abar.replaceChildren(h('div',null,h('b',{text:txt}),h('span',{text:sub||''})),h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Σίγαση 2 λεπτά','Mute 2 min'),onclick:function(){ muted=Date.now()+120000; }}),h('button',{class:'btn pri',type:'button',text:T('Τέλος συναγερμού','Stop alarm'),onclick:function(){ silence(); B.anchorOff(); }})));
  abar.hidden=false; if(alarmT) return; alarmT=setInterval(function(){ beep(); if(Date.now()>=muted) vib([350,150,350]); },900); beep();
  try{ if(document.hidden&&'Notification' in window&&Notification.permission==='granted'&&navigator.serviceWorker) navigator.serviceWorker.ready.then(function(r){ r.showNotification('⚓ '+txt,{body:sub||'',icon:'../icon-192.png',tag:'alkyon-sea',vibrate:[200,100,200]}); }); }catch(e){}
}
function silence(){ if(alarmT){ clearInterval(alarmT); alarmT=null; } if(abar) abar.hidden=true; over=0; }
function onAnchor(c){ var a=anc(); if(!a) return; lastAn=Date.now(); if(c.accuracy&&c.accuracy>Math.max(30,a.r*0.7)) return;
  var d=dist([a.lat,a.lon],[c.latitude,c.longitude]); a.d=Math.round(d);
  if(d>a.r){ over++; if(over>=2&&B.say) B.say(T('Η άγκυρα σέρνει, ','Anchor dragging, ')+Math.round(d)+T(' μέτρα',' metres'),'anchor','drag',30000); if(over>=2) alarm(T('Η άγκυρα σέρνει!','Anchor dragging!'),T('Απόσταση ','Distance ')+Math.round(d)+' m · '+T('όριο ','limit ')+a.r+' m'); } else { over=0; if(alarmT&&d<a.r*0.85) silence(); }
  B.emit('anchor',a); }
setInterval(function(){ var a=anc(); if(a&&lastAn&&Date.now()-lastAn>120000&&!alarmT) alarm(T('Χάθηκε το GPS','GPS lost'),T('Ο συναγερμός άγκυρας δεν μπορεί να ελέγξει τη θέση.','The anchor alarm cannot check the position.')); },20000);
B.anchor=anc;
B.anchorOn=function(){ audio(); var r=h('input',{type:'number',min:'20',max:'500',step:'5',inputmode:'numeric',value:String(ls.get('alkyon-anr',50))}), sh;
  var go=h('button',{class:'btn pri full',type:'button',text:T('Ενεργοποίηση','Turn on'),onclick:function(){ var rr=Math.max(20,Math.min(500,parseInt(r.value,10)||50)); ls.set('alkyon-anr',rr); sh.close(); audio();
    getPos().then(function(p){ ls.set('alkyon-anchor',{lat:p.lat,lon:p.lon,r:rr,t:Date.now()}); over=0; lastAn=Date.now(); watch(); B.emit('anchor'); B.toast(T('Συναγερμός άγκυρας ενεργός (','Anchor alarm on (')+rr+' m)'); try{ if('Notification' in window&&Notification.permission==='default') Notification.requestPermission(); }catch(e){} },function(){ B.toast(T('Δεν βρέθηκε θέση GPS.','No GPS fix.')); }); }});
  sh=B.sheet({title:T('Συναγερμός άγκυρας','Anchor alarm'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Η θέση της άγκυρας σημειώνεται τώρα. Ηχεί αν το σκάφος απομακρυνθεί περισσότερο από την ακτίνα. Η οθόνη μένει αναμμένη.','The anchor position is marked now. It sounds if the boat moves beyond the radius. The screen stays on.')}),h('label',{class:'fld'},h('span',{text:T('Ακτίνα (μέτρα)','Radius (metres)')}),r),go)}); };
B.anchorOff=function(){ ls.set('alkyon-anchor',null); silence(); watch(); B.emit('anchor'); B.toast(T('Ο συναγερμός άγκυρας σταμάτησε.','Anchor alarm off.')); };

/* ---------- MOB ---------- */
B.mobs=function(){ var m=ls.get('alkyon-mob',[]); return Array.isArray(m)?m:[]; };
B.mob=function(){ vib([200,100,200]); getPos().then(function(p){ var m=B.mobs(); m.push({lat:p.lat,lon:p.lon,t:Date.now()}); ls.set('alkyon-mob',m.slice(-10)); B.emit('mob',m[m.length-1]); B.toast(T('MOB σημειώθηκε: ','MOB marked: ')+hm(Date.now())); },function(){ B.toast(T('Δεν βρέθηκε θέση GPS.','No GPS fix.')); }); };
B.mobDel=function(t){ ls.set('alkyon-mob',B.mobs().filter(function(x){ return x.t!==t; })); B.emit('mob'); };

/* εκκίνηση: αν υπάρχει ενεργή έξοδος ή άγκυρα, συνεχίζει */
if(load().active){ startTimer(); setTimeout(function(){ trackPos(); },2000); }
if(anc()) lastAn=Date.now();
setTimeout(function(){ watch(); paintBar(); },300);
setInterval(function(){ if(load().active) watch(); },10000);
})();
