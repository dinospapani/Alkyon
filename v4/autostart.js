/* BiteCast 4 · «Ξεκινάς ψάρεμα;» (v31z541)
   Για ψάρεμα από ακτή (και λίμνη / ψαροντούφεκο από ακτή): όσο η εφαρμογή είναι ανοιχτή, αν σταθείς ~2 λεπτά σε απόσταση έως 150 m
   από σημείο σου (τα «Σημεία» ή μέρος όπου έχεις πιάσει ψάρια 2+ φορές), ρωτά αν ξεκινάς έξοδο, με το σημείο συμπληρωμένο.
   Μία ερώτηση ανά σημείο τη μέρα. Δεν ρωτά κατά την έξοδο. Η θέση παρακολουθείται μόνο όσο η εφαρμογή είναι στην οθόνη
   (μια web εφαρμογή δεν μπορεί να το κάνει με κλειστή οθόνη). Ρύθμιση: psaro-v4-autostart (προεπιλογή ανοιχτό). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, ls=B.ls;
var R=150, DWELL=120000, MOVE=60, KEY='psaro-v4-autostart', ASK='psaro-v4-asked';
var watch=null, anchor=null, asking=false, last=null, tick=null;
function on(){ return ls.get(KEY,true)!==false; }
function eligible(){ var p=B.prof(); if(p==='shore'||p==='lake') return true; if(p==='spear') return (B.fishSide?B.fishSide():'shore')!=='boat'; return false; }
function onTrip(){ try{ return !!(B.trip&&B.trip.active()); }catch(e){ return false; } }
function km(a,b,c,d){ var r=Math.PI/180, x=(d-b)*r*Math.cos((a+c)/2*r), y=(c-a)*r; return Math.sqrt(x*x+y*y)*6371000; }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
/* τα σημεία: «Σημεία» + μέρη με 2+ ψαριές (σε ακτίνα 100 m) */
function spots(){ var out=[], S=B.store;
  try{ S.raw('spots').forEach(function(x){ if(!x.deleted&&typeof x.lat==='number'&&typeof x.lon==='number') out.push({id:'s:'+x.id,name:x.name||T('Σημείο','Spot'),lat:x.lat,lon:x.lon}); }); }catch(e){}
  try{ var cl=[]; S.bites().forEach(function(b){ if(b.deleted||b.gear||typeof b.lat!=='number'||typeof b.lon!=='number') return;
      var c=cl.filter(function(k){ return km(k.lat,k.lon,b.lat,b.lon)<=100; })[0]; if(c){ c.n++; if(!c.name&&b.place) c.name=b.place; } else cl.push({lat:b.lat,lon:b.lon,n:1,name:b.place||''}); });
    cl.forEach(function(c){ if(c.n<2) return; if(out.some(function(o){ return km(o.lat,o.lon,c.lat,c.lon)<=R; })) return; out.push({id:'c:'+c.lat.toFixed(4)+','+c.lon.toFixed(4),name:c.name||T('Το σημείο των ψαριών σου','Your catch spot'),lat:c.lat,lon:c.lon}); }); }catch(e){}
  return out; }
function near(lat,lon){ var best=null; spots().forEach(function(s){ var d=km(lat,lon,s.lat,s.lon); if(d<=R&&(!best||d<best.d)) best={s:s,d:d}; }); return best&&best.s; }
function asked(id){ var a=ls.get(ASK,{})||{}; return a[id]===today(); }
function markAsked(id){ var a=ls.get(ASK,{})||{}, t=today(); Object.keys(a).forEach(function(k){ if(a[k]!==t) delete a[k]; }); a[id]=t; ls.set(ASK,a); }
function busy(){ if(document.querySelector('.sheet,.sppage')) return true; var a=document.activeElement; return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
function prompt(s){
  if(asking) return; asking=true; markAsked(s.id);
  var sh=B.sheet({title:T('Ξεκινάς ψάρεμα;','Starting to fish?'),onclose:function(){ asking=false; },body:h('div',{style:{display:'grid',gap:'10px',paddingTop:'4px'}},
    h('p',{class:'sub',text:T('Είσαι στο «','You are at “')+s.name+T('». Να ξεκινήσει έξοδος; Καταγράφει τη διαδρομή και τα ψάρια, και ενημερώνει την επαφή ασφαλείας αν την έχεις ορίσει.','”. Start a trip? It logs your route and catches, and informs your safety contact if you have one.')}),
    h('button',{class:'btn pri full',type:'button',text:T('Έναρξη','Start'),onclick:function(){ sh.close(); setTimeout(function(){ if(B.tripStart) B.tripStart({where:s.name}); },280); }}),
    h('button',{class:'btn full',type:'button',text:T('Όχι τώρα','Not now'),onclick:function(){ sh.close(); }}),
    h('button',{class:'linkbtn',type:'button',text:T('Να μη ρωτάει ξανά','Don’t ask again'),onclick:function(){ ls.set(KEY,false); stop(); sh.close(); B.toast(T('Δεν θα ρωτάει. Το ξανανοίγεις από Προφίλ › Ειδοποιήσεις.','It will not ask. Turn it back on in Profile › Alerts.')); }}))});
  try{ if(navigator.vibrate) navigator.vibrate(60); }catch(e){}
}
function onFix(p){ last=p; var c=p.coords; if(!c||c.accuracy>120) return; if(onTrip()||!eligible()||!on()){ anchor=null; return; }
  var now=Date.now(), s=near(c.latitude,c.longitude);
  if(!s||asked(s.id)){ anchor=null; return; }
  if(!anchor||anchor.id!==s.id||km(anchor.lat,anchor.lon,c.latitude,c.longitude)>MOVE){ anchor={id:s.id,lat:c.latitude,lon:c.longitude,t:now}; return; }
  if(now-anchor.t>=DWELL&&!busy()){ anchor=null; prompt(s); } }
function start(){ if(watch!=null||!navigator.geolocation||document.hidden||!on()||!eligible()||onTrip()) return;
  if(!spots().length) return;
  watch=navigator.geolocation.watchPosition(onFix,function(){},{enableHighAccuracy:true,maximumAge:30000,timeout:60000});
  /* όταν στέκεσαι ακίνητος το κινητό συχνά δεν στέλνει νέα θέση: έλεγχος κάθε 20″ με την τελευταία */
  tick=setInterval(function(){ if(last&&anchor) onFix(last); },20000); }
function stop(){ if(watch!=null){ try{ navigator.geolocation.clearWatch(watch); }catch(e){} watch=null; } clearInterval(tick); tick=null; anchor=null; last=null; }
function sync(){ if(document.hidden||!on()||!eligible()||onTrip()) stop(); else start(); }
document.addEventListener('visibilitychange',sync);
try{ new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){}
B.on&&B.on('store',function(){ setTimeout(sync,50); });
setTimeout(sync,3000);
B.autoStart={on:on,set:function(v){ ls.set(KEY,!!v); sync(); },_fix:onFix,_spots:spots};
})();
