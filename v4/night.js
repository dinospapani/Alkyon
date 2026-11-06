/* Alkyon 4 · Νυχτερινή λειτουργία (κόκκινη οθόνη) (v31z545)
   Όλη η εφαρμογή σε σκούρο κόκκινο, για να μη χάνουν τα μάτια την προσαρμογή στο σκοτάδι (όπως στα plotters).
   Ρύθμιση alkyon-v4-night: 'auto' (προεπιλογή: μόνο κατά την έξοδο, από τη δύση ως την ανατολή), 'on' (πάντα), 'off'.
   Το κουμπί 🌙 στον χάρτη την ανοίγει/κλείνει για την τρέχουσα έξοδο (alkyon-v4-nightovr). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls, K='alkyon-v4-night', OV='alkyon-v4-nightovr', root=document.documentElement, prevTheme=null, active=false, btn=null;
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
  paint(); if(typeof applySun==='function') try{ applySun(); }catch(e){} }
function paint(){ if(!btn) return; btn.hidden=!(tripId()||active); btn.setAttribute('aria-pressed',String(active)); btn.title=active?T('Κλείσιμο νυχτερινής λειτουργίας','Turn off night mode'):T('Νυχτερινή λειτουργία (κόκκινη οθόνη)','Night mode (red screen)'); }
function toggle(){ var v=!active; ls.set(OV,{k:tripId()||today(),v:v}); apply();
  B.toast(v?T('Νυχτερινή λειτουργία: κόκκινη οθόνη για τα μάτια στο σκοτάδι.','Night mode: red screen to keep your night vision.'):T('Νυχτερινή λειτουργία κλειστή.','Night mode off.')); }
/* κουμπί στη δεξιά στήλη του χάρτη (φαίνεται κατά την έξοδο ή όταν είναι ανοιχτή) */
function mountBtn(){ var bar=document.querySelector('.mapbar'); if(!bar) return; if(btn&&btn.isConnected) return;
  btn=h('button',{class:'iconbtn nightb',type:'button',html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',onclick:toggle});
  var bell=bar.querySelector('.bellb'); if(bell) bar.insertBefore(btn,bell); else bar.append(btn); paint(); }
/* 1.9.0: κουμπί οθόνης στον χάρτη: κανονική → ήλιος (μέγιστη αντίθεση) → νύχτα (κόκκινη) → κανονική */
var SK='alkyon-v4-sun', sbtn=null;
function sunOn(){ return !!ls.get(SK,false); }
function applySun(){ root.classList.toggle('sunv',sunOn()&&!active); paintS(); }
var IS={norm:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 1v3M12 20v3M3.5 3.5l2.1 2.1M18.4 18.4l2.1 2.1M1 12h3M20 12h3M3.5 20.5l2.1-2.1M18.4 5.6l2.1-2.1"/></svg>',
  night:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'};
function scr(){ return active?'night':sunOn()?'sun':'norm'; }
function paintS(){ if(!sbtn) return; var m=scr(); sbtn.innerHTML=IS[m]; sbtn.setAttribute('data-m',m);
  sbtn.setAttribute('aria-label',{norm:T('Οθόνη: κανονική (πάτα για ήλιο)','Screen: normal (tap for sun)'),sun:T('Οθόνη: ήλιος (πάτα για νύχτα)','Screen: sun (tap for night)'),night:T('Οθόνη: νύχτα (πάτα για κανονική)','Screen: night (tap for normal)')}[m]); }
function cycle(){ var m=scr();
  if(m==='norm'){ ls.set(SK,true); applySun(); B.toast(T('Οθόνη για ήλιο: μαύρο σε λευκό, μέγιστη αντίθεση.','Sun screen: black on white, maximum contrast.')); }
  else if(m==='sun'){ ls.set(SK,false); ls.set(OV,{k:tripId()||today(),v:true}); apply(); applySun(); B.toast(T('Νυχτερινή οθόνη: κόκκινη, για τα μάτια στο σκοτάδι.','Night screen: red, to keep your night vision.')); }
  else { ls.set(OV,{k:tripId()||today(),v:false}); apply(); applySun(); B.toast(T('Κανονική οθόνη.','Normal screen.')); } }
function mountS(){ if(sbtn&&sbtn.isConnected){ paintS(); return; } sbtn=h('button',{class:'scrmode',type:'button',onclick:cycle}); sbtn.style.top='calc(var(--safe-t,0px) + 222px)'; setTimeout(lay,50); document.body.append(sbtn); paintS(); }
B.screenMode={get:scr,cycle:cycle};
/* 1.9.3: τα κουμπιά δεξιά (Στρώματα, οθόνη) και η ετικέτα «Διαδρομή εξόδου» μπαίνουν κάτω από την κάρτα ΨΑΡΕΥΩ/ΣΕ ΚΙΝΗΣΗ, όχι από πάνω της */
function lay(){ if(!document.body.classList.contains('mapon')) return; var p=document.querySelector('.mcpanel'), pb=0;
  if(p){ var cs=getComputedStyle(p), r=p.getBoundingClientRect(); if(cs.display!=='none'&&cs.visibility!=='hidden'&&r.height>0) pb=Math.round(r.bottom); }
  var st=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-t'))||0, top1=Math.max(st+164,pb?pb+12:0);
  var ly=document.querySelector('.mclay'); if(ly) ly.style.top=top1+'px'; if(sbtn) sbtn.style.top=(ly&&getComputedStyle(ly).display!=='none'?top1+58:top1)+'px';
  var rc=document.querySelector('.revchip'); if(rc){ rc.style.top=''; if(pb){ var rr=rc.getBoundingClientRect(); if(rr.top<pb+6) rc.style.top=(pb+10)+'px'; } } }
setInterval(lay,600); window.addEventListener('resize',lay);
B.night={mode:mode,set:function(m){ ls.set(K,m); ls.set(OV,null); apply(); },active:function(){ return active; },apply:apply};
var deb=null; try{ new MutationObserver(function(){ clearTimeout(deb); deb=setTimeout(function(){ apply(); mountBtn(); mountS(); applySun(); },250); }).observe(document.body,{attributes:true,attributeFilter:['class'],childList:true}); }catch(e){}
window.addEventListener('hashchange',function(){ setTimeout(mountBtn,400); });
setInterval(apply,120000); document.addEventListener('visibilitychange',function(){ if(!document.hidden) apply(); });
setTimeout(function(){ apply(); mountBtn(); mountS(); applySun(); },500);
})();
