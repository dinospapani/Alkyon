/* Alkyon 4 · κατέβασμα χάρτη και πρόγνωσης πριν την έξοδο (v31z550).
   Όταν πατάς «Θα βγω» για μια μέρα, και ξανά όταν ανοίγεις την εφαρμογή την προηγούμενη ή την ίδια μέρα, κατεβαίνουν:
   - ο δορυφορικός χάρτης με τα ναυτικά σήματα γύρω από το σημείο (πιο αναλυτικά κοντά, πιο αραιά μακριά, ~3–6 MB)
   - η πρόγνωση 7 ημερών (καιρός και θάλασσα) για το σημείο
   ώστε να δουλεύουν χωρίς σήμα στη θάλασσα. Με WiFi ή δεδομένα κινητής (4G/5G), εκτός αν διαλέξεις «Μόνο WiFi» ή «Όχι».
   Το ίδιο κάνει και ο service worker όταν έρθει η βραδινή ειδοποίηση του πλάνου, ακόμα και με κλειστή εφαρμογή (sw.js). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, K='alkyon-v4-pf', SK='alkyon-v4-pfst', busy=false;
var ZR=[[9,35],[10,25],[11,15],[12,10],[13,6],[14,3.5],[15,2]];   /* ζουμ → ακτίνα σε km */
function mode(){ var m=ls.get(K,'all'); return m==='wifi'||m==='off'?m:'all'; }
function st(){ return ls.get(SK,{})||{}; }
function tx(lon,z){ return Math.floor((lon+180)/360*Math.pow(2,z)); }
function ty(lat,z){ var r=Math.PI/180, s=Math.sin(Math.max(-85,Math.min(85,lat))*r); return Math.floor((.5-Math.log((1+s)/(1-s))/(4*Math.PI))*Math.pow(2,z)); }
function urls(lat,lon){ var tp=B.tileTpl||{sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'}, out=[];
  ZR.forEach(function(q){ var z=q[0], dLat=q[1]/111, dLon=q[1]/(111*Math.cos(lat*Math.PI/180)), x0=tx(lon-dLon,z), x1=tx(lon+dLon,z), y0=ty(lat+dLat,z), y1=ty(lat-dLat,z);
    for(var x=x0;x<=x1;x++) for(var y=y0;y<=y1;y++){ var f=function(t){ return t.replace('{z}',z).replace('{x}',x).replace('{y}',y); }; out.push(f(tp.sat)); if(z>=11) out.push(f(tp.sea)); } });
  return out; }
/* δίκτυο: «wifi» μόνο αν ο browser λέει ότι είναι WiFi/ethernet· αν δεν το ξέρει (π.χ. iPhone), το επιτρέπει */
function netOk(){ if(navigator.onLine===false) return false; var m=mode(); if(m==='off') return false; var c=navigator.connection; if(c&&c.saveData&&m!=='all') return false;
  if(m==='wifi'&&c&&c.type&&!/wifi|ethernet|wimax/.test(c.type)) return false; return true; }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function tomorrow(){ var d=new Date(Date.now()+864e5); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function run(pl,force){
  if(busy||!pl||pl.lat==null) return Promise.resolve(null); if(!force&&!netOk()) return Promise.resolve(null);
  var s=st(), key=pl.date+'|'+(+pl.lat).toFixed(3)+','+(+pl.lon).toFixed(3); if(!force&&s.key===key&&Date.now()-(s.at||0)<8*3600e3) return Promise.resolve(null);
  if(!('caches' in window)) return Promise.resolve(null);
  busy=true; var list=urls(+pl.lat,+pl.lon), ok=0, fail=0, i=0;
  var tiles=caches.open('alkyon-tiles').then(function(cache){
    function worker(){ if(i>=list.length) return Promise.resolve(); var u=list[i++];
      return cache.match(u).then(function(hit){ if(hit){ ok++; return; } return fetch(u,{mode:'cors',credentials:'omit'}).then(function(r){ if(!r.ok) throw 0; ok++; return cache.put(u,r); }); }).catch(function(){ fail++; }).then(worker); }
    return Promise.all([worker(),worker(),worker(),worker()]); });
  /* η πρόγνωση περνά από τον service worker και μένει στην αποθήκη alkyon-offdata (ίδια διεύθυνση = διαθέσιμη χωρίς σήμα) */
  var fc=(window.PF&&PF.getForecast?PF.getForecast(+pl.lat,+pl.lon,null,{days:7}).then(function(f){ ls.set('alkyon-v4-planfc',{key:key,lat:+pl.lat,lon:+pl.lon,t:Date.now(),fc:f}); return true; }):Promise.resolve(false)).catch(function(){ return false; });
  return Promise.all([tiles,fc]).then(function(r){ busy=false;
    var o={key:key,date:pl.date,name:pl.name||'',at:Date.now(),tiles:ok,fail:fail,fc:!!r[1]}; ls.set(SK,o);
    var rec=ls.get('alkyon-offl',[])||[]; rec=rec.filter(function(x){ return x.plan!==key; }); var dLat=35/111, dLon=35/(111*Math.cos(pl.lat*Math.PI/180));
    rec.push({t:Date.now(),n:ok,lay:'sat',plan:key,s:+pl.lat-dLat,w:+pl.lon-dLon,nn:+pl.lat+dLat,e:+pl.lon+dLon}); ls.set('alkyon-offl',rec.slice(-20));
    return o; },function(){ busy=false; return null; }); }
function due(){ var td=today(), tm=tomorrow(); return (B.plans?B.plans.list():[]).filter(function(p){ return p.date===td||p.date===tm; })[0]||null; }
function auto(){ if(document.hidden) return; try{ if(B.trip&&B.trip.active&&B.trip.active()) return; }catch(e){} var pl=due(); if(pl) run(pl,false).then(function(o){ if(o&&o.tiles) B.toast(T('Κατέβηκαν χάρτης και πρόγνωση για ','Map and forecast downloaded for ')+(o.name||T('την έξοδό σου','your trip'))+T(' · δουλεύουν και χωρίς σήμα.',' · they work without signal.')); }); }
/* όταν πατάς «Θα βγω»: αμέσως */
function hook(){ if(!B.plans||B.plans._pf) return; var set0=B.plans.set; B.plans.set=function(date,p){ var r=set0.apply(this,arguments); if(p){ var pl={date:date,lat:p.lat,lon:p.lon,name:p.name}; setTimeout(function(){ run(pl,false).then(function(o){ if(o&&o.tiles) B.toast(T('Χάρτης και πρόγνωση αποθηκεύτηκαν για χρήση χωρίς σήμα.','Map and forecast saved for use without signal.')); }); },1500); } return r; }; B.plans._pf=1; }
B.prefetch={run:run,mode:mode,set:function(m){ ls.set(K,m); try{ if(B.pushSync) B.pushSync(); }catch(e){} },status:st,urls:urls,due:due};
/* επιλογή (στις Ειδοποιήσεις, κάρτα πλάνων, και στον Έλεγχο συστήματος) */
B.prefetchRow=function(){ var sel=h('select',{class:'select','aria-label':T('Κατέβασμα πριν την έξοδο','Download before the trip')});
  [['all',T('Με WiFi ή 4G/5G','On WiFi or 4G/5G')],['wifi',T('Μόνο με WiFi','WiFi only')],['off',T('Όχι','Off')]].forEach(function(o){ sel.append(h('option',{value:o[0],text:o[1]})); }); sel.value=mode();
  sel.addEventListener('change',function(){ B.prefetch.set(sel.value); });
  var s=st(); return h('label',{class:'fld pfrow'},h('span',{text:T('Χάρτης και πρόγνωση πριν την έξοδο','Map and forecast before the trip')}),sel,
    h('small',{class:'sub',text:T('Όταν πατάς «Θα βγω», κατεβαίνουν ο χάρτης (~3–6 MB) και η πρόγνωση της περιοχής, για χρήση χωρίς σήμα.','When you tap “I’ll go out”, the area’s map (~3–6 MB) and forecast are downloaded for use without signal.')+(s.at?' '+T('Τελευταίο: ','Last: ')+(s.name||'')+' · '+new Date(s.at).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' · '+s.tiles+T(' πλακίδια',' tiles'):'')})); };
setTimeout(function(){ hook(); auto(); },12000); setTimeout(hook,0);
document.addEventListener('visibilitychange',function(){ if(!document.hidden) setTimeout(auto,6000); });
window.addEventListener('online',function(){ setTimeout(auto,5000); });
})();
