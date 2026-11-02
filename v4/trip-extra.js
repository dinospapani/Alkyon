/* Alkyon 4 · ό,τι κάνει η κλασική στο παρασκήνιο κατά την έξοδο (app.js, redesign.js), με τα ίδια κλειδιά:
   - condH: πίεση και άνεμος ώρα με ώρα για κάθε έξοδο (Open-Meteo), για την προσωπική πρόγνωση (personal.js)
   - scoreH: ο βαθμός που έδινε η εφαρμογή για κάθε ώρα, κρατημένος στην αρχή της εξόδου (alkyon-tscore)
   - ειδοποίηση απότομης πτώσης πίεσης (alkyon-pa), εικόνα της πίεσης στην αρχή (alkyon-tpb)
   - χαμηλή μπαταρία (20% και 10%), «ψάρεψες εδώ 2 από τις 3 τελευταίες μέρες» (alkyon-rest-trip)
   - ψαροντούφεκο: χρονόμετρο κατάδυσης, σημαδούρα (alkyon-buoy-…), «Είσαι εντάξει;» (alkyon-divewatch) */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
function st(){ return B.trip&&B.trip.state?B.trip.state():{}; }
function on(){ return !!(B.trip&&B.trip.active&&B.trip.active()); }
function pos(){ var f=B.trip&&B.trip.fix&&B.trip.fix(); if(f&&f.lat!=null) return f; var s=st(); if(s.last&&s.last.lat!=null) return s.last; return B.lastPos(); }
function J(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
function num(v){ return String(Math.round(v*10)/10).replace('.',EN?'.':','); }
function sg(v){ return (v>0?'+':v<0?'−':'±')+num(Math.abs(v)); }
function notify(title,body,tag){ if(B.inboxAdd) B.inboxAdd(title,body,'trip');
  try{ if('Notification' in window&&Notification.permission==='granted'&&navigator.serviceWorker){ navigator.serviceWorker.getRegistration(new URL('../',location.href).href).then(function(r){ if(r) r.showNotification(title,{body:body,tag:tag||'alk-trip',icon:'../icon-192.png'}); }).catch(function(){}); } }catch(e){}
}
function trips(){ return B.store.raw('trips').filter(function(t){ return !t.deleted; }); }
function patchTrip(id,o){ var t=B.store.get('trips',id); if(t) B.store.save('trips',Object.assign({},t,o)); }

/* ---------- scoreH: βαθμός ανά ώρα στην αρχή της εξόδου ---------- */
function scoreSnap(){
  var s=st(); if(!s.active||!s.id||!window.PF) return; var cur=ls.get('alkyon-tscore',null); if(cur&&cur.id===s.id) return;
  var p=pos(); if(!p) return;
  PF.getForecast(+p.lat,+p.lon,undefined,{days:2}).then(function(fc){ var out=[];
    fc.days.forEach(function(d){ d.hours.forEach(function(x){ if(x.score==null) return; out.push([Math.floor((Date.parse(x.t+':00Z')-fc.tz*60000)/3600000),x.score]); }); });
    if(out.length) ls.set('alkyon-tscore',{id:s.id,h:out,sp:ls.get('alkyon-advsp','')||''}); }).catch(function(){});
}
/* ---------- condH: πίεση και άνεμος κάθε ώρας της εξόδου ---------- */
function condH(t){
  if(!t||!t.startMs||!t.endMs||t.manual||Array.isArray(t.condH)) return Promise.resolve(false);
  if(Date.now()-t.endMs>85*86400000||t.endMs-t.startMs>16*3600000) return Promise.resolve(false);
  var la=t.lat!=null?t.lat:(t.cond0&&t.cond0.lat), lo=t.lon!=null?t.lon:(t.cond0&&t.cond0.lon); if(la==null||lo==null) return Promise.resolve(false);
  var d0=new Date(t.startMs-4*3600000).toISOString().slice(0,10), d1=new Date(t.endMs).toISOString().slice(0,10);
  return J('https://api.open-meteo.com/v1/forecast?latitude='+(+la).toFixed(3)+'&longitude='+(+lo).toFixed(3)+'&hourly=pressure_msl,wind_speed_10m&wind_speed_unit=kn&timezone=UTC&start_date='+d0+'&end_date='+d1).then(function(j){
    var ts=(j.hourly&&j.hourly.time)||[], ps=(j.hourly&&j.hourly.pressure_msl)||[], ws=(j.hourly&&j.hourly.wind_speed_10m)||[], byH={};
    ts.forEach(function(x,i){ byH[Math.floor(Date.parse(x+'Z')/3600000)]={p:ps[i],w:ws[i]}; });
    var out=[]; for(var hh=Math.floor(t.startMs/3600000);hh<=Math.floor((t.endMs-1)/3600000);hh++){ var a=byH[hh], b=byH[hh-3]; if(!a||typeof a.p!=='number') continue;
      var d=b&&typeof b.p==='number'?a.p-b.p:null, pt=d==null?2:d<=-3?0:d<=-1?1:d>=1?3:2; out.push([hh,pt,typeof a.w==='number'?Math.round(a.w*10)/10:null]); }
    if(!out.length) return false; patchTrip(t.id,{condH:out}); return true; });
}
B.on('tripend',function(e){ var id=e&&e.id; if(!id) { ls.set('alkyon-tscore',null); return; }
  setTimeout(function(){ var t=B.store.get('trips',id), sc=ls.get('alkyon-tscore',null);
    if(t&&sc&&Array.isArray(sc.h)&&(t.sid===sc.id||!t.sid)){ var lo=Math.floor(t.startMs/3600000), hi=Math.floor(t.endMs/3600000), hs=sc.h.filter(function(r){ return r[0]>=lo&&r[0]<=hi; });
      if(hs.length) patchTrip(id,{scoreH:hs,scoreSp:sc.sp||undefined}); }
    ls.set('alkyon-tscore',null); },2500);
  setTimeout(function(){ condH(B.store.get('trips',id)).catch(function(){}); },5000); });
/* παλιότερες έξοδοι χωρίς condH: λίγες κάθε φορά, στο παρασκήνιο */
setTimeout(function(){ var list=trips().filter(function(t){ return t.startMs&&t.endMs&&!t.manual&&!Array.isArray(t.condH)&&Date.now()-t.endMs<85*86400000; }).slice(0,8), i=0;
  (function next(){ if(i>=list.length||navigator.onLine===false) return; condH(list[i++]).catch(function(){}).then(function(){ setTimeout(next,1500); }); })(); },20000);

/* ---------- πτώση πίεσης κατά την έξοδο ---------- */
var PA={key:'alkyon-pa',cool:3*3600e3,drop:3.0};
function banner(txt,cls){ var b=h('div',{class:'tripal'+(cls?' '+cls:''),role:'alert'},h('span',{text:txt}),h('button',{type:'button',class:'x','aria-label':T('Κλείσιμο','Close'),text:'✕',onclick:function(){ b.remove(); }}));
  [].forEach.call(document.querySelectorAll('.tripal'+(cls?'.'+cls:'')),function(x){ x.remove(); }); document.body.append(b); try{ navigator.vibrate&&navigator.vibrate([200,100,200]); }catch(e){} return b; }
function paCheck(){
  if(!on()||document.hidden) return; if(Date.now()-(+ls.get(PA.key,0)||0)<PA.cool) return; var p=pos(); if(!p) return;
  J('https://api.open-meteo.com/v1/forecast?latitude='+(+p.lat).toFixed(3)+'&longitude='+(+p.lon).toFixed(3)+'&hourly=pressure_msl&past_hours=4&forecast_hours=1&timezone=UTC').then(function(j){
    var ts=(j.hourly&&j.hourly.time)||[], ps=(j.hourly&&j.hourly.pressure_msl)||[], i=-1; for(var k=0;k<ts.length;k++) if(Date.parse(ts[k]+'Z')<=Date.now()&&typeof ps[k]==='number') i=k;
    if(i<3||typeof ps[i-3]!=='number') return; var drop=ps[i]-ps[i-3]; if(drop>-PA.drop) return; ls.set(PA.key,Date.now());
    var txt=T('Η πίεση πέφτει γρήγορα: ','Pressure is falling fast: ')+num(-drop)+T(' hPa σε 3 ώρες (τώρα ',' hPa in 3 hours (now ')+Math.round(ps[i])+T(' hPa). Συχνά σημάδι αλλαγής καιρού. Κοίτα τον ορίζοντα και την πρόγνωση. Ενδεικτικό, από μοντέλο πρόγνωσης.',' hPa). Often a sign of changing weather. Check the horizon and the forecast. Indicative, from a forecast model.');
    banner('⚠ '+txt,'pa'); notify('Alkyon: '+T('πτώση πίεσης','pressure falling'),txt,'alkyon-pa'); }).catch(function(){});
}
setInterval(paCheck,10*60000); setTimeout(paCheck,20000);

/* ---------- εικόνα της πίεσης στην αρχή της εξόδου ---------- */
function pressBrief(){
  var s=st(); if(!s.active||!s.id||ls.get('alkyon-tpb','')===s.id) return;
  if(Date.now()-(+ls.get('alkyon-tpb-at',0)||0)<20*60000){ ls.set('alkyon-tpb',s.id); return; }
  if(s.start&&Date.now()-s.start>30*60000){ ls.set('alkyon-tpb',s.id); return; }
  var PFx=window.PF, p=pos(); if(!PFx||!PFx.pressureOutlook||!p) return;
  PFx.getForecast(+p.lat,+p.lon,undefined,{days:2}).then(function(fc){ var o=PFx.pressureOutlook(fc); if(!o) return;
    ls.set('alkyon-tpb',s.id); ls.set('alkyon-tpb-at',Date.now());
    var hs=[]; fc.days.forEach(function(d){ d.hours.forEach(function(x){ if(x.p!=null) hs.push(x); }); }); hs.sort(function(a,b){ return a.t<b.t?-1:1; });
    var now=fc.nowLocal.slice(0,13), n0=-1; hs.forEach(function(x,i){ if(x.t.slice(0,13)<=now) n0=i; });
    var f3=n0>=0&&hs[n0+3]?hs[n0+3].p-hs[n0].p:null;
    var rising=(o.d3!=null&&o.d3>=0.5)||(f3!=null&&f3>=0.5&&!(o.d3!=null&&o.d3<=-0.5)), falling=!rising&&((o.d3!=null&&o.d3<=-0.5)||(f3!=null&&f3<=-0.5));
    var hh=function(t){ return t.slice(11,16); }, day=function(t){ return t.slice(0,10)===fc.nowLocal.slice(0,10)?'':T('αύριο ','tomorrow '); };
    var head=rising?T('📈 Η πίεση ανεβαίνει','📈 Pressure is rising'):falling?T('📉 Η πίεση πέφτει','📉 Pressure is falling'):T('➖ Η πίεση είναι σταθερή','➖ Pressure is steady');
    var parts=[T('Τώρα ','Now ')+num(o.now)+' hPa']; if(o.d3!=null) parts.push(T('τελευταίες 3 ώρες ','last 3 h ')+sg(o.d3)+' hPa'); if(f3!=null) parts.push(T('επόμενες 3 ώρες ','next 3 h ')+sg(f3)+' hPa');
    var l2='';
    if(o.last&&rising&&o.last.kind==='trough') l2+=T('Η άνοδος ξεκίνησε μετά την κοιλάδα των ','The rise began after the low of ')+num(o.last.p)+T(' hPa στις ',' hPa at ')+hh(o.last.t)+'. ';
    if(o.last&&falling&&o.last.kind==='peak') l2+=T('Η πτώση ξεκίνησε μετά την κορυφή των ','The fall began after the peak of ')+num(o.last.p)+T(' hPa στις ',' hPa at ')+hh(o.last.t)+'. ';
    if(o.next) l2+=(o.next.kind==='peak'?T('Αναμένεται κορυφή ','Peak expected '):T('Αναμένεται κοιλάδα ','Low expected '))+num(o.next.p)+' hPa '+day(o.next.t)+T('γύρω στις ','around ')+hh(o.next.t)+T(' (σε ~',' (in ~')+o.next.hours+T(' ώρ.)',' h)')+(o.next.kind==='peak'?T(', μετά αρχίζει να πέφτει.',', then it starts falling.'):T(', μετά αρχίζει να ανεβαίνει.',', then it starts rising.'));
    else l2+=T('Δεν φαίνεται καμπή στις επόμενες ώρες της πρόγνωσης.','No turning point in the coming forecast hours.');
    B.toast(head+'. '+parts.join(' · ')+'. '+l2,9000);
    notify(head+T(' · έναρξη εξόδου',' · trip start'),parts.join(' · ')+'. '+l2+T(' Πρόγνωση μοντέλου (Open-Meteo), όχι μέτρηση.',' Model forecast (Open-Meteo), not a measurement.'),'alk-tpb-'+s.id); }).catch(function(){});
}

/* ---------- «ψάρεψες εδώ πρόσφατα» ---------- */
var REST_R=0.3, REST_D=3;
function km(a,b,c,d){ var R=Math.PI/180, dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742*Math.asin(Math.min(1,Math.sqrt(x))); }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function restDays(lat,lon){ var td=today(), lo=new Date(Date.parse(td+'T12:00:00Z')-(REST_D-1)*86400000).toISOString().slice(0,10), days={};
  var near=function(a,b){ return typeof a==='number'&&typeof b==='number'&&km(lat,lon,a,b)<=REST_R; };
  B.store.raw('bites').forEach(function(b){ if(!b.deleted&&b.date&&b.date>=lo&&b.date<=td&&near(b.lat,b.lon)) days[b.date]=1; });
  trips().forEach(function(t){ if(!t.date||t.date<lo||t.date>td) return; if(near(t.lat,t.lon)||(Array.isArray(t.track)&&t.track.some(function(q){ return near(q[0],q[1]); }))) days[t.date]=1; });
  return Object.keys(days).sort(); }
B.restDays=restDays;
function restCheck(){ var s=st(); if(!s.active||!s.id||ls.get('alkyon-rest-trip','')===s.id) return; var f=B.trip.fix&&B.trip.fix(); if(!f) return;
  if(s.start&&Date.now()-s.start<4*60000) return; ls.set('alkyon-rest-trip',s.id); var ds=restDays(f.lat,f.lon); if(ds.length<2) return;
  var alt=null; B.store.raw('spots').forEach(function(sp){ if(sp.deleted||typeof sp.lat!=='number') return; var d=km(f.lat,f.lon,sp.lat,sp.lon); if(d>REST_R*2&&restDays(sp.lat,sp.lon).length<2&&(!alt||d<alt.d)) alt={name:sp.name||T('Σημείο','Spot'),d:d}; });
  B.toast('🔁 '+T('Ψάρεψες σε αυτή την περιοχή ','You fished this area on ')+ds.length+T(' από τις 3 τελευταίες μέρες. Ένα ξεκούραστο σημείο ίσως δώσει περισσότερα',' of the last 3 days. A rested spot may bite better')+(alt?': '+alt.name+' ('+(alt.d<10?num(alt.d):Math.round(alt.d))+' km).':'.'),9000); }
setInterval(restCheck,5*60000);

/* ---------- χαμηλή μπαταρία ---------- */
(function(){ if(!navigator.getBattery) return; var warned={20:false,10:false};
  function chk(b){ if(!on()) return; if(b.charging){ warned[20]=warned[10]=false; return; } var p=Math.round(b.level*100);
    if(p<=10&&!warned[10]){ warned[10]=warned[20]=true; banner(T('Μπαταρία ','Battery ')+p+T('%. Φόρτισε τώρα ή κλείσε ό,τι δεν χρειάζεσαι.','%. Charge now or close what you do not need.'),'bat'); }
    else if(p<=20&&p>10&&!warned[20]){ warned[20]=true; banner(T('Μπαταρία ','Battery ')+p+T('%. Η έξοδος συνεχίζει να καταγράφεται.','%. The trip keeps being recorded.'),'bat'); }
    if(p>25) warned[20]=warned[10]=false; }
  navigator.getBattery().then(function(b){ b.addEventListener('levelchange',function(){ chk(b); }); b.addEventListener('chargingchange',function(){ chk(b); }); setInterval(function(){ chk(b); },60000); }).catch(function(){}); })();

B.on('tripstart',function(){ setTimeout(pressBrief,2500); setTimeout(scoreSnap,4000); dv.on=false; dv.lastDive=0; dv.lastSurf=0; paintSp(); });
if(on()){ setTimeout(pressBrief,6000); setTimeout(scoreSnap,8000); }

/* ---------- ψαροντούφεκο ---------- */
var dv={on:false,t0:0,lastDive:0,lastSurf:0,warned:false,iv:null}; window.AlkyonDive=dv;
function spear(){ return B.prof()==='spear'; }
function lim(){ var v=+ls.get('alkyon-divelim',90); return v>=20&&v<=300?v:90; }
function fmt(s){ s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+B.pad(s%60); }
function buoyKey(){ return 'alkyon-buoy-'+(st().start||0); }
function buoyOk(){ try{ return localStorage.getItem(buoyKey())==='1'; }catch(e){ return false; } }
var dock=null, dBtn=null, bBtn=null;
function dive(){ var now=Date.now();
  if(!dv.on){ dv.on=true; dv.t0=now; dv.warned=false; try{ var k='alkyon-dives-'+(st().start||0); localStorage.setItem(k,String((+localStorage.getItem(k)||0)+1)); }catch(e){} }
  else { dv.on=false; dv.lastDive=(now-dv.t0)/1000; dv.lastSurf=now; }
  try{ navigator.vibrate&&navigator.vibrate(30); }catch(e){} if(!dv.iv) dv.iv=setInterval(tickSp,500); tickSp(); }
B.dive=dive;
function tickSp(){ if(!dock||dock.hidden){ return; } var now=Date.now(), s=dv.on?(now-dv.t0)/1000:0, over=dv.on&&s>=lim();
  dBtn.classList.toggle('on',dv.on); dBtn.classList.toggle('over',over);
  dBtn.querySelector('b').textContent=(dv.on?'▲ ':'▼ ')+(dv.on?fmt(s):dv.lastSurf?fmt((now-dv.lastSurf)/1000):'0:00');
  dBtn.querySelector('small').textContent=dv.on?T('Πάτα όταν βγεις','Tap when you surface'):dv.lastDive?T('Τελευταία ','Last ')+fmt(dv.lastDive)+T(' · επιφάνεια',' · surface'):T('Πάτα στην κατάδυση','Tap when you dive');
  if(over&&!dv.warned){ dv.warned=true; try{ navigator.vibrate&&navigator.vibrate([400,200,400]); }catch(e){} B.toast(T('Έφτασες το όριο κατάδυσης, ανέβα.','Dive limit reached, surface.')); } }
function paintSp(){
  var show=on()&&spear();
  if(!dock){ if(!show) return;
    dBtn=h('button',{type:'button',class:'spdive','aria-label':T('Κατάδυση / Επιφάνεια','Dive / Surfaced'),onclick:dive},h('b',null,'▼ 0:00'),h('small'));
    bBtn=h('button',{type:'button',class:'spbuoy',onclick:function(){ try{ localStorage.setItem(buoyKey(),buoyOk()?'0':'1'); }catch(e){} paintSp(); }});
    dock=h('div',{class:'spdock'},bBtn,dBtn); document.body.append(dock); }
  dock.hidden=!show; document.body.classList.toggle('spon',show); if(!show){ if(dv.iv){ clearInterval(dv.iv); dv.iv=null; } return; }
  var ok=buoyOk(); bBtn.classList.toggle('ok',ok); bBtn.setAttribute('aria-pressed',String(ok)); bBtn.textContent=ok?T('Σημαδούρα ✓','Float ✓'):T('Σημαδούρα;','Float?');
  if(!dv.iv) dv.iv=setInterval(tickSp,500); tickSp(); }
B.on('trip',paintSp); B.on('store',function(k){ if(k==='alkyon-fprof') paintSp(); }); setTimeout(paintSp,400);

/* «Είσαι εντάξει;» */
var WK='alkyon-divewatch', ov=null, cd=null, asked=0;
function wOn(){ try{ return localStorage.getItem(WK)==='1'; }catch(e){ return false; } }
function closeAsk(){ if(cd){ clearInterval(cd); cd=null; } if(ov){ ov.remove(); ov=null; } }
function fire(){ if(B.trip&&B.trip.sos) B.trip.sos(); }
function ask(){ if(ov) return; var left=30, p=h('p');
  function txt(){ p.textContent=T('SOS στην επαφή ασφαλείας σε ','SOS to your safety contact in ')+left+T(' δευτ.',' s'); } txt();
  ov=h('div',{class:'ruok',role:'alertdialog','aria-modal':'true'},h('div',{class:'ruc'},h('h2',{text:T('Είσαι εντάξει;','Are you OK?')}),p,
    h('button',{type:'button',class:'btn pri full big',text:T('Είμαι καλά','I am OK'),onclick:function(){ if(dv.on) dive(); closeAsk(); }}),
    h('button',{type:'button',class:'btn full sos',text:T('Στείλε SOS τώρα','Send SOS now'),onclick:function(){ closeAsk(); fire(); }})));
  document.body.append(ov); try{ navigator.vibrate&&navigator.vibrate([600,200,600,200,600]); }catch(e){}
  cd=setInterval(function(){ left--; txt(); if(left%5===0){ try{ navigator.vibrate&&navigator.vibrate([500,150,500]); }catch(e){} } if(left<=0){ closeAsk(); fire(); } },1000); }
setInterval(function(){ if(!wOn()||!spear()||!dv.on||!on()){ asked=0; if(ov&&!dv.on) closeAsk(); return; } var s=(Date.now()-dv.t0)/1000; if(s>=lim()+30&&asked!==dv.t0){ asked=dv.t0; ask(); } },1000);

/* ρυθμίσεις ψαροντούφεκου στο φύλλο της εξόδου */
B.tripSheetExtras=function(){ if(!spear()) return null;
  var l=h('input',{type:'number',min:'20',max:'300',step:'5',inputmode:'numeric',value:String(lim())}); l.addEventListener('change',function(){ var v=Math.max(20,Math.min(300,parseInt(l.value,10)||90)); l.value=v; ls.set('alkyon-divelim',v); });
  var w=h('input',{type:'checkbox',checked:wOn()}); w.addEventListener('change',function(){ try{ localStorage.setItem(WK,w.checked?'1':'0'); }catch(e){} });
  var n=0; try{ n=+localStorage.getItem('alkyon-dives-'+(st().start||0))||0; }catch(e){}
  return h('div',{class:'card',style:{margin:'0'}},h('h3',{class:'h3',style:{marginTop:'0'},text:T('Κατάδυση','Diving')+(n?' · '+n+(n===1?T(' κατάδυση',' dive'):T(' καταδύσεις',' dives')):'')}),
    h('label',{class:'fld'},h('span',{text:T('Όριο κατάδυσης (δευτ.)','Dive limit (s)')}),l),
    h('label',{class:'tg'},w,h('span',{text:T('«Είσαι εντάξει;» αν δεν ανέβεις','“Are you OK?” if you do not surface')})),
    h('small',{class:'sub',text:T('Αν το χρονόμετρο περάσει το όριο κατά 30 δευτ., το κινητό δονείται και ρωτά. Αν δεν απαντήσεις σε 30 δευτ., στέλνει SOS. Δουλεύει μόνο με ανοιχτή εφαρμογή και αν πατάς Κατάδυση/Επιφάνεια. Δεν αντικαθιστά τον συνοδό. Μη βουτάς μόνος.','If the timer passes the limit by 30 s, the phone vibrates and asks. If you do not answer within 30 s, it sends an SOS. Works only with the app open and if you use Dive/Surfaced. It does not replace a buddy. Never dive alone.')})); };
})();

/* ---------- v31z521: «Ψαρεύεις εδώ;» Κατά την έξοδο, όταν το σκάφος μένει ακίνητο ή κάνει drift ~10 λεπτά
   σε σημείο που δεν έχεις αποθηκεύσει, προτείνει να το σώσεις. Ρύθμιση: alkyon-v4-driftask (Ειδοποιήσεις). ---------- */
(function(){
var B=window.AK, ls=B.ls, T=B.T, buf=[], asked=[], tripId=null;
function on(){ return ls.get('alkyon-v4-driftask',true)!==false; }
B.driftAsk={on:on,set:function(v){ ls.set('alkyon-v4-driftask',!!v); }};
function hav(a,b){ var R=6371000, r=Math.PI/180, dl=(b.lat-a.lat)*r, dn=(b.lon-a.lon)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
function spots(){ try{ return B.store.raw('spots').filter(function(s){ return !s.deleted&&s.lat!=null; }); }catch(e){ return []; } }
function tick(){
  var tr=B.trip, act=tr&&tr.active&&tr.active();
  if(!act){ buf=[]; asked=[]; tripId=null; return; }
  var st=tr.state&&tr.state(), id=(st&&st.id)||'x'; if(id!==tripId){ tripId=id; buf=[]; asked=[]; }
  var f=tr.fix&&tr.fix(); if(!f||f.lat==null||Date.now()-(f.t||0)>90000) return;
  if(!buf.length||buf[buf.length-1].t!==f.t) buf.push({lat:f.lat,lon:f.lon,t:f.t||Date.now()});
  var now=Date.now(); buf=buf.filter(function(p){ return now-p.t<=13*60000; });
  if(!on()) return; check(now);
}
B.driftCheck=function(points,now){ buf=points.slice(); return check(now||Date.now()); };
function check(now){
  var w=buf.filter(function(p){ return now-p.t<=10*60000; }); if(w.length<5) return null;
  var dur=w[w.length-1].t-w[0].t; if(dur<9*60000) return null;
  var c={lat:0,lon:0}; w.forEach(function(p){ c.lat+=p.lat; c.lon+=p.lon; }); c.lat/=w.length; c.lon/=w.length;
  var maxR=Math.max.apply(null,w.map(function(p){ return hav(c,p); })), net=hav(w[0],w[w.length-1]), kn=net/(dur/1000)*1.94384;
  var still=maxR<=120, drift=!still&&kn<=1.2&&maxR<=450; if(!still&&!drift) return null;
  if(spots().some(function(s){ return hav(c,{lat:s.lat,lon:s.lon})<200; })) return null;
  if(asked.some(function(a){ return hav(c,a)<400; })) return null;
  var tk=B.trip.track&&B.trip.track(), p0=tk&&tk.pts&&tk.pts[0]; if(p0&&hav(c,{lat:p0[0],lon:p0[1]})<300) return null; /* λιμάνι / αφετηρία */
  asked.push(c);
  try{ navigator.vibrate&&navigator.vibrate([60,60,60]); }catch(e){}
  var msg=still?T('Είσαι ακίνητος εδώ ~10′. Ψαρεύεις; Να σωθεί το σημείο;','You have been still here ~10′. Fishing? Save this spot?'):T('Κάνεις drift εδώ ~10′. Να σωθεί το σημείο;','Drifting here ~10′. Save this spot?');
  if(B.inboxAdd) B.inboxAdd(T('Νέο σημείο;','New spot?'),msg,'trip');
  B.toast(msg,15000,{label:T('Σώσε','Save'),fn:function(){ if(B.spotFormAt) B.spotFormAt(c.lat,c.lon,still?'':T('Drift','Drift')); }});
  return {lat:c.lat,lon:c.lon,still:still,kn:kn};
}
setInterval(function(){ try{ tick(); }catch(e){} },30000);
})();

/* ---------- v31z521: κουμπιά στην ειδοποίηση εξόδου (και στο ρολόι). Ρύθμιση alkyon-v4-tripnotif ---------- */
(function(){
var B=window.AK, ls=B.ls, T=B.T;
function on(){ return ls.get('alkyon-v4-tripnotif',true)!==false; }
function reg(){ return navigator.serviceWorker?navigator.serviceWorker.getRegistration().then(function(r){ return r||null; }).catch(function(){ return null; }):Promise.resolve(null); }
function active(){ return !!(B.trip&&B.trip.active&&B.trip.active()); }
function count(){ try{ var sf=ls.get('alkyon-safe',{})||{}; return B.store.raw('bites').filter(function(b){ return b.trip===sf.id&&!b.miss&&!b.deleted&&!B.pest(b); }).length; }catch(e){ return 0; } }
function show(){
  if(!on()||!active()||!('Notification' in window)) return;
  if(Notification.permission==='default'){ Notification.requestPermission().then(function(p){ if(p==='granted') show(); }); return; }
  if(Notification.permission!=='granted') return;
  var n=count();
  reg().then(function(r){ if(!r) return; r.showNotification(T('Έξοδος σε εξέλιξη','Trip in progress'),{body:(n?n+(n===1?T(' ψάρι · ',' catch · '):T(' ψάρια · ',' catches · ')):'')+T('Πάτα «Ψάρι εδώ» και από το ρολόι σου.','Tap “Fish here”, also from your watch.'),
    tag:'alkyon-trip',renotify:false,silent:false,vibrate:[60],requireInteraction:true,icon:'../icon-192.png',badge:'../icon-192.png',data:{bc4trip:1,lang:B.LANG},
    actions:[{action:'fish',title:T('🐟 Ψάρι εδώ','🐟 Fish here')},{action:'lost',title:T('✕ Χάθηκε','✕ Lost')}]}).catch(function(){}); }); }
function hide(){ reg().then(function(r){ if(!r||!r.getNotifications) return; r.getNotifications({tag:'alkyon-trip'}).then(function(a){ a.forEach(function(x){ x.close(); }); }); }); }
B.tripNotif={on:on,set:function(v){ ls.set('alkyon-v4-tripnotif',!!v); if(v) show(); else hide(); },show:show};
/* ό,τι πατήθηκε στο ρολόι/ειδοποίηση → Ημερολόγιο */
function qdb(){ return new Promise(function(res,rej){ var r=indexedDB.open('bc4q',1); r.onupgradeneeded=function(){ r.result.createObjectStore('q',{autoIncrement:true}); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; }); }
var draining=false;
function drain(){ if(draining||!window.indexedDB||!B.quickRec) return; draining=true;
  qdb().then(function(db){ return new Promise(function(res){ var tx=db.transaction('q','readwrite'), st=tx.objectStore('q'), out=[]; st.openCursor().onsuccess=function(ev){ var c=ev.target.result; if(c){ out.push(c.value); c.delete(); c.continue(); } }; tx.oncomplete=function(){ res(out); }; tx.onerror=function(){ res([]); }; }); })
  .then(function(items){ draining=false; if(!items.length) return; var f=0, m=0;
    items.sort(function(a,b){ return a.t-b.t; }).forEach(function(it){ try{ B.quickRec(!!it.miss,null,it.t,true); if(it.miss) m++; else f++; }catch(e){} });
    B.toast((f?T('Από την ειδοποίηση/ρολόι: ','From the notification/watch: ')+f+(f===1?T(' ψάρι',' catch'):T(' ψάρια',' catches')):'')+(m?(f?' · ':'')+m+T(' χαμένα',' lost'):'')+T('. Πρόσθεσε το είδος από το Ημερολόγιο.','. Add the species from the Logbook.'),7000);
    setTimeout(show,800); })
  .catch(function(){ draining=false; }); }
B.watchDrain=drain;
if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('message',function(e){ if(e.data&&e.data.type==='bc4q') drain(); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ drain(); if(active()) show(); } });
var was=null; function sync(){ var a=active(); if(a!==was){ was=a; if(a) show(); else hide(); } }
B.on('trip',function(){ setTimeout(sync,300); }); setTimeout(function(){ drain(); sync(); },2500); setInterval(sync,30000);
})();

