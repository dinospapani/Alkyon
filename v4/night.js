/* BiteCast 4 · Νυχτερινή λειτουργία (κόκκινη οθόνη) (v31z545)
   Όλη η εφαρμογή σε σκούρο κόκκινο, για να μη χάνουν τα μάτια την προσαρμογή στο σκοτάδι (όπως στα plotters).
   Ρύθμιση psaro-v4-night: 'auto' (προεπιλογή: μόνο κατά την έξοδο, από τη δύση ως την ανατολή), 'on' (πάντα), 'off'.
   Το κουμπί 🌙 στον χάρτη την ανοίγει/κλείνει για την τρέχουσα έξοδο (psaro-v4-nightovr). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, ls=B.ls, K='psaro-v4-night', OV='psaro-v4-nightovr', root=document.documentElement, prevTheme=null, active=false, btn=null;
function mode(){ var m=ls.get(K,'auto'); return m==='on'||m==='off'?m:'auto'; }
function tripId(){ try{ var s=B.trip&&B.trip.state(); return s&&s.active?s.id||'trip':''; }catch(e){ return ''; } }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function dark(){ var p=B.lastPos()||{lat:34.9,lon:33.0}, PF=window.PF; if(!PF||!PF.sunMoon) { var hr=new Date().getHours(); return hr>=18||hr<6; }
  try{ var d=new Date(), sm=PF.sunMoon(today(),p.lat,p.lon,-d.getTimezoneOffset()), m=d.getHours()*60+d.getMinutes(); return m>=sm.set+10||m<sm.rise-10; }catch(e){ return false; } }
function override(){ var o=ls.get(OV,null); if(!o) return null; var key=tripId()||today(); return o.k===key?!!o.v:null; }
function want(){ var o=override(); if(o!=null) return o; var m=mode(); if(m==='on') return true; if(m==='off') return false; return !!tripId()&&dark(); }
function apply(){ var w=want(); if(w===active){ paint(); return; } active=w;
  if(w){ prevTheme=root.getAttribute('data-theme'); root.setAttribute('data-theme','dark'); root.classList.add('night'); }
  else { root.classList.remove('night'); if(prevTheme==null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme',prevTheme); }
  try{ var mt=document.querySelector('meta[name=theme-color]'); if(mt) mt.setAttribute('content',w?'#1a0000':'#06171F'); }catch(e){}
  paint(); }
function paint(){ if(!btn) return; btn.hidden=!(tripId()||active); btn.setAttribute('aria-pressed',String(active)); btn.title=active?T('Κλείσιμο νυχτερινής λειτουργίας','Turn off night mode'):T('Νυχτερινή λειτουργία (κόκκινη οθόνη)','Night mode (red screen)'); }
function toggle(){ var v=!active; ls.set(OV,{k:tripId()||today(),v:v}); apply();
  B.toast(v?T('Νυχτερινή λειτουργία: κόκκινη οθόνη για τα μάτια στο σκοτάδι.','Night mode: red screen to keep your night vision.'):T('Νυχτερινή λειτουργία κλειστή.','Night mode off.')); }
/* κουμπί στη δεξιά στήλη του χάρτη (φαίνεται κατά την έξοδο ή όταν είναι ανοιχτή) */
function mountBtn(){ var bar=document.querySelector('.mapbar'); if(!bar) return; if(btn&&btn.isConnected) return;
  btn=h('button',{class:'iconbtn nightb',type:'button',html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',onclick:toggle});
  var bell=bar.querySelector('.bellb'); if(bell) bar.insertBefore(btn,bell); else bar.append(btn); paint(); }
B.night={mode:mode,set:function(m){ ls.set(K,m); ls.set(OV,null); apply(); },active:function(){ return active; },apply:apply};
var deb=null; try{ new MutationObserver(function(){ clearTimeout(deb); deb=setTimeout(function(){ apply(); mountBtn(); },250); }).observe(document.body,{attributes:true,attributeFilter:['class'],childList:true}); }catch(e){}
window.addEventListener('hashchange',function(){ setTimeout(mountBtn,400); });
setInterval(apply,120000); document.addEventListener('visibilitychange',function(){ if(!document.hidden) apply(); });
setTimeout(function(){ apply(); mountBtn(); },500);
})();
