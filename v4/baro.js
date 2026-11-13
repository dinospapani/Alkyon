/* Alkyon 4 · 1.13.8: Βαρόμετρο του κινητού (μόνο στις εφαρμογές Android / iPhone· η ιστοσελίδα δεν έχει πρόσβαση στον αισθητήρα).
   - Μετρά κάθε 10′ όσο είναι ανοιχτό το app, κάθε 2′ σε έξοδο. Κρατά 48 ώρες (alkyon-v4-baro).
   - Η αλλαγή (τάση) είναι πολύ ακριβής· η απόλυτη τιμή διορθώνεται με σταθμό ή μοντέλο (offset, alkyon-v4-barooff).
   - Σε έξοδο: ειδοποίηση όταν πέφτει γρήγορα (≥ 1,5 hPa/ώρα).
   - Κάθε ψάρι παίρνει b.pb = {hpa, d1, d3} (διορθωμένη τιμή, αλλαγή 1 και 3 ωρών) όταν υπάρχει μέτρηση < 20′. */
(function(){
var B=window.AK, T=B.T, ls=B.ls, P=window.AKN&&window.AKN.baro;
var K='alkyon-v4-baro', KO='alkyon-v4-barooff', H=3600000, ok=null, tm=0, lastRead=0, warned=0;
function ser(){ return ls.get(K,[])||[]; }
function off(){ var o=ls.get(KO,null); return o&&typeof o.v==='number'?o.v:0; }
function save(p){ var s=ser(), now=Date.now(); s.push([p.t||now,Math.round(p.hpa*100)/100]); s=s.filter(function(x){ return now-x[0]<48*H; }); if(s.length>800) s=s.slice(-800); ls.set(K,s); }
function at(ms){ var s=ser(), best=null, bd=1e18; s.forEach(function(x){ var d=Math.abs(x[0]-ms); if(d<bd){ bd=d; best=x; } }); return best&&bd<=20*60000?best:null; }
function last(){ var s=ser(); return s.length?{t:s[s.length-1][0],raw:s[s.length-1][1],hpa:s[s.length-1][1]+off()}:null; }
/* αλλαγή στις τελευταίες hh ώρες: γραμμική προσαρμογή για να μη μετρά ένα «πεταχτό» σημείο */
function trend(hh,ms){ ms=ms||Date.now(); var s=ser().filter(function(x){ return x[0]<=ms+60000&&ms-x[0]<=hh*H+10*60000; }); if(s.length<3) return null;
  var span=s[s.length-1][0]-s[0][0]; if(span<hh*H*0.6) return null;
  var n=s.length, mx=0, my=0; s.forEach(function(x){ mx+=x[0]; my+=x[1]; }); mx/=n; my/=n; var sxy=0, sxx=0; s.forEach(function(x){ sxy+=(x[0]-mx)*(x[1]-my); sxx+=(x[0]-mx)*(x[0]-mx); });
  return sxx?Math.round(sxy/sxx*hh*H*10)/10:null; }
function read(){ if(!P||!P.read) return Promise.reject(new Error('no-baro')); return P.read().then(function(r){ if(!r||!(r.hpa>300)) throw new Error('bad'); lastRead=Date.now(); save(r); try{ window.dispatchEvent(new CustomEvent('alkyon-baro',{detail:r})); }catch(e){} return r; }); }
function inTrip(){ try{ return !!(B.trip&&B.trip.active&&B.trip.active()); }catch(e){ return false; } }
function tick(){ clearTimeout(tm); if(!ok) return; var every=inTrip()?2*60000:10*60000;
  if(document.visibilityState!=='hidden'&&Date.now()-lastRead>=every-15000) read().then(watch).catch(function(){});
  tm=setTimeout(tick,Math.min(every,60000)); }
function watch(){ if(!inTrip()) return; var d=trend(1); if(d!=null&&d<=-1.5&&Date.now()-warned>2*H){ warned=Date.now();
  B.toast(T('Η πίεση πέφτει γρήγορα: ','Pressure is falling fast: ')+String(d).replace('.',EN()?'.':',')+T(' hPa την τελευταία ώρα (βαρόμετρο κινητού). Πρόσεχε τον καιρό.',' hPa in the last hour (phone barometer). Watch the weather.'),9000); } }
function EN(){ return !!B.EN; }
/* διόρθωση με μετρημένη πίεση (σταθμός) ή μοντέλο, όταν υπάρχει μέτρηση κινητού μέσα σε 30′ */
function calib(ref,src){ var l=last(); if(!l||ref==null||Date.now()-l.t>30*60000) return; var v=Math.round((ref-l.raw)*10)/10; if(Math.abs(v)>25) return;
  var o=ls.get(KO,null); if(o&&o.src==='station'&&src!=='station'&&Date.now()-o.t<7*24*H) return; ls.set(KO,{v:o&&Math.abs(o.v-v)<3?Math.round((o.v*0.7+v*0.3)*10)/10:v,t:Date.now(),src:src||'model'}); }
/* για το ψάρι: τιμή και τάσεις τη στιγμή του πιασίματος */
function forCatch(ms){ var x=at(ms||Date.now()); if(!x) return null; return {hpa:Math.round((x[1]+off())*10)/10,d1:trend(1,ms),d3:trend(3,ms)}; }
B.baro={ok:function(){ return !!ok; },read:read,last:last,trend:trend,series:ser,offset:off,calib:calib,forCatch:forCatch,
  _save:save,_test:function(o){ ok=true; P=o; }};
if(P&&P.available) P.available().then(function(r){ ok=!!(r&&r.ok); if(ok){ setTimeout(tick,4000); document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') tick(); }); } }).catch(function(){ ok=false; });
})();
