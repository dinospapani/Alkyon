/* Ειδοποίηση αλλαγής ανέμου: όσο η εφαρμογή είναι ανοιχτή, ελέγχει την ωριαία πρόγνωση για τις επόμενες ώρες
   και ειδοποιεί όταν αλλάζει η διεύθυνση ή η ένταση. Δεν τρέχει με κλειστή εφαρμογή (χρειάζεται server). */
(function(){
'use strict';
var C=window.PsaroCore; if(!C||!window.PF) return;
var T=function(a,b){ return window.LANG==='en'?b:a; };
var KEY='psaro-wwatch', SEEN='psaro-wwatch-seen';
var cfg=Object.assign({on:false,deg:60,kn:6,hours:6},C.lsGet(KEY,{})||{});
var COMP=window.LANG==='en'?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dn(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; }
function adiff(a,b){ var d=Math.abs(a-b)%360; return d>180?360-d:d; }
function save(){ C.lsSet(KEY,cfg); try{ window.dispatchEvent(new Event('psaro-wwatch')); }catch(e){} }
function place(){ var c=(C.getViewCond&&C.getViewCond())||(C.getCond&&C.getCond()); return c&&c.lat!=null?{lat:+c.lat,lon:+c.lon,name:c.name||''}:null; }
/* Βρίσκει την πρώτη ώρα στο παράθυρο όπου ο άνεμος διαφέρει αρκετά από τον τωρινό. Επιστρέφει null αν δεν υπάρχει. */
function detect(fc,deg,kn,hours){
  var now=fc.nowLocal.slice(0,13), hs=[];
  fc.days.forEach(function(d){ d.hours.forEach(function(h){ if(h.t.slice(0,13)>=now) hs.push(h); }); });
  hs.sort(function(a,b){ return a.t<b.t?-1:1; });
  if(hs.length<2) return null;
  var h0=hs[0], lim=hs.slice(1,hours+1);
  if(h0.wind==null) return null;
  for(var i=0;i<lim.length;i++){
    var h=lim[i]; if(h.wind==null) continue;
    var ds=Math.abs(h.wind-h0.wind), dd=(h0.dir!=null&&h.dir!=null&&h0.wind>=4&&h.wind>=4)?adiff(h.dir,h0.dir):0;
    if(dd>=deg||ds>=kn) return {from:h0,to:h,dd:dd,ds:ds,inH:i+1};
  }
  return null;
}
function describe(r){
  var f=r.from, t=r.to, PU=window.PsaroUnits, W=function(v){ try{ return PU.wind(v); }catch(e){ return Math.round(v)+' kn'; } };
  var a=(f.dir!=null?dn(f.dir)+' ':'')+W(f.wind), b=(t.dir!=null?dn(t.dir)+' ':'')+W(t.wind);
  var kind=r.dd>=1&&r.dd>=cfg.deg?(r.ds>=cfg.kn?T('Αλλαγή διεύθυνσης και έντασης','Wind direction and speed change'):T('Αλλαγή διεύθυνσης ανέμου','Wind direction change')):(t.wind>f.wind?T('Δυναμώνει ο άνεμος','Wind picking up'):T('Εξασθενεί ο άνεμος','Wind easing'));
  return {title:kind,body:T('Τώρα ','Now ')+a+' → '+t.t.slice(11,16)+' '+b+(t.gust!=null&&t.gust>=t.wind+6?' · '+T('ριπές ','gusts ')+W(t.gust):'')};
}
async function notify(title,body){
  try{ C.toast&&C.toast(title+': '+body); }catch(e){}
  try{
    if(!('Notification' in window)||Notification.permission!=='granted') return;
    var reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();
    if(reg) await reg.showNotification(title,{body:body,tag:'psaro-wind',icon:'icon-192.png',badge:'icon-192.png',data:{url:reg.scope}});
    else new Notification(title,{body:body});
  }catch(e){}
}
var busy=false;
async function check(manual){
  cfg=Object.assign({on:false,deg:60,kn:6,hours:6},C.lsGet(KEY,{})||{}); /* v31z506: η ρύθμιση μπορεί να άλλαξε από τη νέα έκδοση */
  if(busy||(!cfg.on&&!manual)) return null;
  var p=place(); if(!p){ return manual?{err:T('Δεν υπάρχει ακόμα θέση.','No position yet.')}:null; }
  busy=true;
  try{
    var fc=await window.PF.getForecast(p.lat,p.lon,undefined,{days:2});
    var r=detect(fc,cfg.deg,cfg.kn,cfg.hours);
    if(!r) return manual?{none:true,now:fc}:null;
    var d=describe(r), key=p.lat.toFixed(2)+','+p.lon.toFixed(2)+':'+r.to.t.slice(0,13)+':'+(r.to.dir!=null?dn(r.to.dir):'')+':'+Math.round(r.to.wind/3);
    var seen=C.lsGet(SEEN,{})||{}, nowK=Date.now(); Object.keys(seen).forEach(function(k){ if(nowK-seen[k]>36*3600000) delete seen[k]; });
    var fresh=!seen[key];
    if(fresh){ seen[key]=nowK; C.lsSet(SEEN,seen); if(cfg.on) await notify(d.title,d.body); }
    return {found:true,fresh:fresh,d:d};
  }catch(e){ return manual?{err:T('Η πρόγνωση δεν φορτώθηκε.','The forecast did not load.')}:null; }
  finally{ busy=false; }
}
/* Ρυθμίσεις μέσα στην κάρτα ειδοποιήσεων της Πρόγνωσης */
function ui(){
  var card=document.getElementById('ntCard'); if(!card||document.getElementById('wwBox')) return;
  var box=document.createElement('div'); box.id='wwBox'; box.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid var(--line,#8883)';
  var h=document.createElement('b'); h.textContent=T('Αλλαγή ανέμου','Wind change'); box.append(h);
  var lab=document.createElement('label'); lab.className='chk'; lab.style.border='0';
  var cb=document.createElement('input'); cb.type='checkbox'; cb.id='wwOn'; cb.checked=!!cfg.on;
  var sp=document.createElement('label'); sp.setAttribute('for','wwOn'); sp.textContent=T('Ειδοποίησέ με όταν αλλάζει ο άνεμος (διεύθυνση ή ένταση)','Notify me when the wind changes (direction or speed)');
  lab.append(cb,sp); box.append(lab);
  var sl=document.createElement('label'); sl.className='f'; sl.style.marginTop='8px'; sl.append(document.createTextNode(T('Ευαισθησία','Sensitivity')));
  var sel=document.createElement('select'); [['45',T('Μεγάλη (45° ή 4 kn)','High (45° or 4 kn)')],['60',T('Μέτρια (60° ή 6 kn)','Medium (60° or 6 kn)')],['90',T('Μικρή (90° ή 8 kn)','Low (90° or 8 kn)')]].forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; sel.append(op); });
  sel.value=String(cfg.deg); sl.append(sel); box.append(sl);
  var row=document.createElement('div'); row.className='row'; row.style.marginTop='8px';
  var now=document.createElement('button'); now.type='button'; now.className='btn sm ghost'; now.textContent=T('Έλεγχος τώρα','Check now'); row.append(now); box.append(row);
  var msg=document.createElement('p'); msg.className='note'; msg.setAttribute('role','status'); box.append(msg);
  var nt=document.createElement('p'); nt.className='note'; nt.textContent=T('Με ανοιχτή εφαρμογή ελέγχει κάθε ~20 λεπτά τη θέση που βλέπεις. Αν είναι ενεργές και οι ειδοποιήσεις πρόγνωσης παραπάνω, ο server ελέγχει τις αγαπημένες/παρακολουθούμενες τοποθεσίες σου περίπου κάθε 3 ώρες και σε ειδοποιεί (για τις επόμενες 6 ώρες) ακόμα και με κλειστή εφαρμογή. Δεν είναι ωριαίος έλεγχος.','With the app open it checks the place you are viewing every ~20 minutes. If forecast notifications above are also on, the server checks your watched places about every 3 hours and notifies you (for the next 6 hours) even with the app closed. It is not an hourly check.');
  card.append(box);
  function params(){ var v=+sel.value; cfg.deg=v; cfg.kn=v===45?4:v===60?6:8; save(); }
  sel.addEventListener('change',params);
  cb.addEventListener('change',async function(){
    if(cb.checked){
      if('Notification' in window&&Notification.permission==='default'){ try{ await Notification.requestPermission(); }catch(e){} }
      cfg.on=true; params(); msg.textContent=(('Notification' in window)&&Notification.permission==='granted')?T('Ενεργό.','Active.'):T('Ενεργό μόνο μέσα στην εφαρμογή (δεν δόθηκε άδεια ειδοποιήσεων του browser).','Active inside the app only (browser notification permission was not granted).');
      check(false);
    } else { cfg.on=false; save(); msg.textContent=T('Κλειστό.','Off.'); }
  });
  now.addEventListener('click',async function(){
    msg.textContent=T('Έλεγχος…','Checking…'); params();
    var r=await check(true);
    if(!r) msg.textContent=T('Δεν έγινε έλεγχος.','No check made.');
    else if(r.err) msg.textContent=r.err;
    else if(r.none) msg.textContent=T('Καμία σημαντική αλλαγή ανέμου στις επόμενες ώρες.','No significant wind change in the next hours.');
    else msg.textContent=r.d.title+': '+r.d.body;
  });
  if(cfg.on) msg.textContent=T('Ενεργό.','Active.');
}
var n=0, iv=setInterval(function(){ n++; if(document.getElementById('ntCard')){ clearInterval(iv); ui(); } else if(n>40) clearInterval(iv); },500);
setInterval(function(){ if(!document.hidden) check(false); },20*60000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden) setTimeout(function(){ check(false); },3000); });
setTimeout(function(){ check(false); },12000);
window.PsaroWindWatch={check:check,detect:detect};
})();
