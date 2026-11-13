/* Alkyon 4 · 1.14.0: SOS σε κοντινά σκάφη
   - Όταν πατάς SOS (στην έξοδο), εκτός από την επαφή ασφαλείας, η θέση σου γράφεται στο sos_alerts και ο server στέλνει push
     σε όσους είναι στη θάλασσα έως 10 ναυτικά μίλια (ζωντανή έξοδος ή έξοδος με ασφάλεια). Ανανεώνεται κάθε λεπτό όσο είναι ενεργό.
   - Όποιος έχει έξοδο σε εξέλιξη ή ανοιχτό χάρτη βλέπει τα ενεργά SOS (κόκκινο σημάδι) και, αν είναι κοντά, μεγάλη ειδοποίηση με «Πήγαινε εκεί».
   - Η θέση φαίνεται μόνο όσο είναι ενεργό το SOS (έως 6 ώρες). «Είμαι καλά» το σταματά και ειδοποιεί όσους ειδοποιήθηκαν.
   Δεν αντικαθιστά το 112 / VHF κανάλι 16. */
(function(){
var B=window.AK, h=B.h, T=B.T, ls=B.ls;
var FN='https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/sos-alert', KEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
var K='alkyon-sos-me', SEEN='alkyon-sos-seen', NEAR_KM=18.52, upT=0, pollT=0, LIST=[], bar=null;
function C(){ return B.cloud; } function sess(){ return C()&&C().session&&C().session(); }
function mine(){ return ls.get(K,null); }
function hav(a,b,c,d){ var R=Math.PI/180, x=Math.pow(Math.sin((c-a)*R/2),2)+Math.cos(a*R)*Math.cos(c*R)*Math.pow(Math.sin((d-b)*R/2),2); return 12742*Math.asin(Math.sqrt(x)); }
function brg(a,b,c,d){ var R=Math.PI/180, y=Math.sin((d-b)*R)*Math.cos(c*R), x=Math.cos(a*R)*Math.sin(c*R)-Math.sin(a*R)*Math.cos(c*R)*Math.cos((d-b)*R); return (Math.atan2(y,x)/R+360)%360; }
var CMP=B.EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function nm(km){ return B.num(km/1.852,1)+T(' ν.μ.',' nm'); }
function fix(){ try{ var f=B.trip&&B.trip.fix&&B.trip.fix(); if(f&&f.lat!=null) return f; }catch(e){} var p=ls.get('alkyon-v4-pos',null); return p&&typeof p.lat==='number'&&Date.now()-(p.t||0)<30*60000?p:null; }
function call(phase){ var s=sess(); if(!s) return Promise.resolve(null);
  return fetch(FN,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({action:'sos',phase:phase,lang:B.EN?'en':'el'})}).then(function(r){ return r.json(); }).catch(function(){ return null; }); }
function put(p,status,fresh){ var s=sess(); if(!s) return Promise.reject(new Error('nosess')); var m=mine()||{};
  var row={user_id:s.uid,id:m.id||('sos-'+Date.now().toString(36)),name:(s.name||'').slice(0,40)||null,lat:+(+p.lat).toFixed(5),lon:+(+p.lon).toFixed(5),status:status,at:new Date().toISOString()};
  if(fresh){ row.created_at=row.at; row.notified=0; }
  return C().rest('sos_alerts',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)}).then(function(r){ if(!r.ok) throw new Error(r.status); return row; }); }
/* ---------- αποστολή ---------- */
function start(o){ o=o||{}; var p=fix();
  if(!p){ B.toast(T('Δεν υπάρχει θέση GPS ακόμα. Κάλεσε 112 / VHF 16 και περιέγραψε πού είσαι.','No GPS position yet. Call 112 / VHF 16 and describe where you are.'),9000); if(!o.quiet) helpSheet(null); return Promise.resolve(false); }
  if(!sess()){ if(o.quiet) return Promise.resolve(false); helpSheet(p,T('Δεν είσαι συνδεδεμένος, οπότε δεν μπορεί να ειδοποιήσει τα κοντινά σκάφη. Ειδοποιείται μόνο η επαφή ασφαλείας.','You are not signed in, so nearby boats cannot be alerted. Only your safety contact is notified.')); return Promise.resolve(false); }
  var id='sos-'+Date.now().toString(36); ls.set(K,{id:id,t:Date.now(),lat:p.lat,lon:p.lon});
  return put(p,'active',true).then(function(){ paintBar(); keepUpdating(); if(!o.quiet) helpSheet(p); return call('start'); }).then(function(r){
      if(r&&r.ok){ var mm0=mine(); if(mm0){ mm0.sent=1; ls.set(K,mm0); } } if(r&&r.ok) B.toast(r.people?T('SOS στάλθηκε σε ','SOS sent to ')+r.people+T(' κοντινά σκάφη.',' nearby boats.'):T('SOS ενεργό. Δεν βρέθηκε άλλο σκάφος με Alkyon κοντά σου αυτή τη στιγμή· όσοι έρθουν θα το δουν. Κάλεσε 112 / VHF 16.','SOS active. No other boat with Alkyon is near you right now; anyone who comes will see it. Call 112 / VHF 16.'),10000); return true; })
    .catch(function(){ B.toast(T('Δεν στάλθηκε στα κοντινά σκάφη (σύνδεση). Ξαναδοκιμάζει. Κάλεσε 112 / VHF 16.','Could not reach nearby boats (connection). Retrying. Call 112 / VHF 16.'),9000); keepUpdating(); paintBar(); return false; }); }
function keepUpdating(){ clearInterval(upT); upT=setInterval(function(){ var m=mine(); if(!m){ clearInterval(upT); return; } var p=fix(); if(!p) return; put(p,'active',false).then(function(){ if(!m.sent) call('start').then(function(r){ if(r&&r.ok){ var mm=mine(); if(mm){ mm.sent=1; ls.set(K,mm); } } }); }).catch(function(){}); },60000); }
function ok(){ var m=mine(); if(!m) return Promise.resolve(); var p=fix()||{lat:m.lat,lon:m.lon}; clearInterval(upT); ls.set(K,null); paintBar();
  return put(p,'ok',false).then(function(){ return call('ok'); }).then(function(){ B.toast(T('SOS έληξε. Όσοι ειδοποιήθηκαν μαθαίνουν ότι είσαι καλά.','SOS ended. Those alerted are told you are OK.'),7000); }).catch(function(){}); }
function helpSheet(p,note){
  var body=h('div',{class:'bform sosh'},
    note?h('p',{class:'wn',text:note}):null,
    h('p',{class:'sosbig',text:T('Κάλεσε τώρα το 112 ή το Λιμενικό / JRCC στο VHF κανάλι 16.','Call 112 now, or the Coast Guard / JRCC on VHF channel 16.')}),
    h('a',{class:'btn pri full',href:'tel:112',text:'📞 112'}),
    p?h('p',{class:'sub',text:T('Η θέση σου: ','Your position: ')+(window.AlkyonCoords&&AlkyonCoords.fmt?AlkyonCoords.fmt(p.lat,p.lon):(B.num(p.lat,5)+', '+B.num(p.lon,5)))}):null,
    mine()?h('p',{class:'sub',text:T('Τα κοντινά σκάφη με Alkyon βλέπουν το SOS και τη θέση σου όσο είναι ενεργό.','Nearby boats with Alkyon see the SOS and your position while it is active.')}):null,
    mine()?h('button',{class:'btn full',type:'button',text:'✓ '+T('Είμαι καλά · Τέλος SOS','I am OK · End SOS'),onclick:function(){ sh.close(); ok(); }}):null);
  var sh=B.sheet({title:'SOS',body:body}); }
function paintBar(){ var m=mine();
  if(!m){ if(bar){ bar.remove(); bar=null; } document.body.classList.remove('sosme'); return; }
  if(!bar){ bar=h('div',{class:'sosbar',role:'alert'}); document.body.append(bar); }
  document.body.classList.add('sosme');
  bar.replaceChildren(h('b',{text:'SOS'}),h('span',{text:T(' ενεργό',' active')}),h('a',{class:'sosb',href:'tel:112',text:'112'}),h('button',{type:'button',class:'sosb',text:T('Είμαι καλά','I am OK'),onclick:function(){ B.ask(T('Να τελειώσει το SOS;','End the SOS?'),T('Είμαι καλά','I am OK')).then(function(y){ if(y) ok(); }); }})); }
/* ---------- λήψη: ενεργά SOS γύρω μου ---------- */
function poll(){ var s=sess(); if(!s) return Promise.resolve([]);
  var since=new Date(Date.now()-6*3600000).toISOString();
  return C().rest('sos_alerts?select=user_id,id,name,lat,lon,at,created_at&status=eq.active&at=gt.'+encodeURIComponent(since)+'&user_id=neq.'+encodeURIComponent(s.uid)).then(function(r){ return r.ok?r.json():[]; }).then(function(a){ LIST=Array.isArray(a)?a:[]; notifyNear(); try{ window.dispatchEvent(new Event('alkyon-sos')); }catch(e){} return LIST; }).catch(function(){ return LIST; }); }
function notifyNear(){ var f=fix(); if(!f) return; var seen=ls.get(SEEN,{})||{};
  LIST.forEach(function(x){ var km=hav(f.lat,f.lon,x.lat,x.lon); if(km>NEAR_KM||seen[x.id]) return; seen[x.id]=Date.now(); ls.set(SEEN,seen);
    try{ navigator.vibrate&&navigator.vibrate([400,200,400,200,800]); }catch(e){}
    var k=Math.round(brg(f.lat,f.lon,x.lat,x.lon)/45)%8;
    var sh=B.sheet({title:'🆘 '+T('SOS κοντά σου','SOS near you'),body:h('div',{class:'bform sosh'},
      h('p',{class:'sosbig',text:(x.name||T('Ένας ψαράς','An angler'))+T(' χρειάζεται βοήθεια, ',' needs help, ')+nm(km)+' '+CMP[k]+'.'}),
      h('p',{class:'sub',text:T('Αν μπορείς με ασφάλεια, πήγαινε. Ειδοποίησε και το 112 / VHF 16 με τη θέση του.','If you can do so safely, go. Also tell 112 / VHF 16 his position.')}),
      h('button',{class:'btn pri full',type:'button',text:'➜ '+T('Πήγαινε εκεί','Go there'),onclick:function(){ sh.close(); go(x); }}),
      h('a',{class:'btn full',href:'tel:112',text:'📞 112'}))}); }); }
function go(x){ try{ if(location.hash!=='#map') location.hash='#map'; setTimeout(function(){ B.goTo&&B.goTo(x.lat,x.lon,'SOS · '+(x.name||'')); },400); }catch(e){} }
function active(){ return LIST.slice(); }
function loop(){ clearTimeout(pollT); var on=(B.trip&&B.trip.active&&B.trip.active())||document.body.classList.contains('mapon');
  if(on&&document.visibilityState!=='hidden') poll(); pollT=setTimeout(loop,on?60000:180000); }
B.sosNear={start:start,ok:ok,mine:mine,poll:poll,active:active,helpSheet:helpSheet,_hav:hav,_notify:notifyNear,_set:function(a){ LIST=a; }};
paintBar(); if(mine()) keepUpdating();
setTimeout(loop,5000); document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') loop(); });
})();
