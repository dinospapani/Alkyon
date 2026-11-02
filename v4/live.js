/* Alkyon 4 · Κοινή έξοδος με φίλους (v31z545)
   Αν το επιλέξεις στην έναρξη εξόδου, η θέση σου και πόσα ψάρια έπιασες ανεβαίνουν κάθε ~2 λεπτά (πίνακας trip_live, βλ. trip-live.sql)
   και φαίνονται στον χάρτη των φίλων σου που μοιράζεσαι μαζί τους. Στον δικό σου χάρτη βλέπεις όσους φίλους είναι αυτή τη στιγμή σε έξοδο.
   Χωρίς τον πίνακα στη βάση, η λειτουργία μένει σιωπηλά ανενεργή. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls, K='alkyon-v4-live', up=null, poll=null, layer=null, missing=false, last=0;
function C(){ return B.cloud&&B.cloud.session&&B.cloud.session()?B.cloud:null; }
function me(){ var s=C()&&C().session(); return s&&s.uid; }
function tripOn(){ try{ return !!(B.trip&&B.trip.active()); }catch(e){ return false; } }
function on(){ return ls.get(K,false)===true; }
function gone(e){ if(/404|PGRST205|42P01|relation/.test(String(e&&e.message||e))){ missing=true; stop(); } }
/* ---------- ανέβασμα της δικής μου θέσης ---------- */
function push(force){ var cl=C(); if(!cl||missing||!on()||!tripOn()) return; var now=Date.now(); if(now-last<(force?15000:100000)) return; var p=null;
  try{ p=(B.trip.fix&&B.trip.fix())||B.lastPos(); }catch(e){} if(!p) return; last=now;
  var s=cl.session(), n=0; try{ n=B.tripCounts().n; }catch(e){}
  cl.rest('trip_live',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:s.uid,name:s.name||'',lat:+(+p.lat).toFixed(5),lon:+(+p.lon).toFixed(5),catches:n,active:true,at:new Date().toISOString()})}).catch(gone); }
function end(){ var cl=C(); if(!cl||missing) return; cl.rest('trip_live?user_id=eq.'+me(),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:false,at:new Date().toISOString()})}).catch(function(){}); }
var wasTrip=tripOn();
function sync(){ var t=tripOn(); if(t&&on()){ if(!up){ push(true); up=setInterval(function(){ if(!document.hidden) push(false); },30000); } } else { if(up){ clearInterval(up); up=null; } }
  if(wasTrip&&!t&&on()) end(); wasTrip=t; }
/* ---------- οι φίλοι στον χάρτη ---------- */
function mapRef(){ try{ return window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); }catch(e){ return null; } }
function ago(ms){ var m=Math.round((Date.now()-ms)/60000); return m<1?T('τώρα','now'):m<60?m+'′':Math.floor(m/60)+T('ω','h'); }
function draw(rows,tries){ var map=mapRef(); if(!map||!window.L){ if((tries||0)<10) setTimeout(function(){ draw(rows,(tries||0)+1); },1000); return; } if(layer&&layer._map!==map) layer=null; if(!layer) layer=L.layerGroup().addTo(map); layer.clearLayers();
  rows.forEach(function(r){ if(r.lat==null) return; var nm=r.name||T('Φίλος','Friend'), ini=nm.charAt(0).toUpperCase(), t=Date.parse(r.at);
    var ic=L.divIcon({className:'mk frlive',html:'<i>'+ini.replace(/[<>&]/g,'')+'</i><b></b>',iconSize:null});
    var m=L.marker([r.lat,r.lon],{icon:ic,zIndexOffset:800}).addTo(layer); var el=m.getElement&&m.getElement(); if(el){ var b=el.querySelector('b'); if(b) b.textContent=nm+(r.catches?' · '+r.catches+' 🐟':''); }
    m.bindPopup(function(){ return h('div',{class:'frpop'},h('b',{text:nm}),h('div',{text:(r.catches||0)+T(' ψάρια σε αυτή την έξοδο',' fish this trip')}),h('small',{text:T('Θέση πριν ','Position ')+ago(t)+(B.EN?' ago':'')})); }); }); }
function fetchFriends(){ var cl=C(); if(!cl||missing||document.hidden||!document.body.classList.contains('mapon')) return;
  var since=new Date(Date.now()-45*60000).toISOString();
  cl.rest('trip_live?select=user_id,name,lat,lon,catches,at&active=eq.true&at=gt.'+encodeURIComponent(since)+'&user_id=neq.'+me()).then(function(r){ return r.json(); }).then(function(a){ draw(Array.isArray(a)?a:[]); }).catch(gone); }
function startPoll(){ if(poll||missing) return; fetchFriends(); poll=setInterval(fetchFriends,60000); }
function stop(){ if(poll){ clearInterval(poll); poll=null; } if(up){ clearInterval(up); up=null; } if(layer){ try{ layer.clearLayers(); }catch(e){} } }
/* ---------- επιλογή στην έναρξη εξόδου ---------- */
B.liveToggle=function(){ if(!C()||missing) return null; var cb=h('input',{type:'checkbox',checked:on()}); cb.addEventListener('change',function(){ ls.set(K,cb.checked); });
  return h('label',{class:'tg'},cb,h('span',null,T('Οι φίλοι μου βλέπουν τη θέση μου','My friends see my position'),h('small',{class:'tgs',text:T('Κοινή έξοδος: η θέση και τα ψάρια σου φαίνονται στον χάρτη των φίλων που μοιράζεσαι μαζί τους.','Shared trip: your position and catches show on the map of friends you share with.')}))); };
B.live={on:on,set:function(v){ ls.set(K,!!v); sync(); },push:push};
try{ new MutationObserver(function(){ sync(); if(document.body.classList.contains('mapon')&&C()) startPoll(); }).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){}
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ push(true); fetchFriends(); } });
B.on&&B.on('trip',function(){ push(true); });
setTimeout(function(){ sync(); if(document.body.classList.contains('mapon')&&C()) startPoll(); },2000);
})();
