/* Καρτέλα «Πρόγνωση»: 7 ημέρες συνθηκών και δείκτη ψαρέματος, επιλογή τοποθεσίας, ειδοποιήσεις για καλές μέρες. */
(function(){
'use strict';
var PU=window.AlkyonUnits;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var C=window.AlkyonCore, PF=window.PF; if(!C||!PF||!document.getElementById('tab-fc')) return;
var $=C.$, h=C.h, pad=C.pad, lsGet=C.lsGet, lsSet=C.lsSet, toast=C.toast;
var Cl=function(){ return window.AlkyonCloud&&window.AlkyonCloud.logged()?window.AlkyonCloud:null; };
var places=lsGet('alkyon-places',[]); if(!Array.isArray(places)) places=[];
var sel=lsGet('alkyon-fcsel','gps');
function wwCfg(){ try{ var w=JSON.parse(localStorage.getItem('alkyon-wwatch')||'null'); return w&&w.on?{deg:w.deg||60,kn:w.kn||6,hours:w.hours||6}:null; }catch(e){ return null; } }
var nt=Object.assign({on:false,threshold:75,notified:{},server:false,gpsWatch:true,pressure:true,turn:false},lsGet('alkyon-notify',{}));
if(!nt.notified||typeof nt.notified!=='object') nt.notified={};
var fc=null, fcPlace=null, busy=false;
var EN=window.LANG==='en';
var DAYN=EN?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
var DAYS=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
function dl(date){ var dt=new Date(date+'T12:00:00Z'); return DAYS[dt.getUTCDay()]+' '+date.slice(8)+'/'+date.slice(5,7); }
var DIRS=window.LANG==='en'?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dirName(d){ return d==null?'':DIRS[Math.round(d/45)%8]; }
function wxIcon(c){ if(c==null) return '🌤️'; if(c>=95) return '⛈️'; if(c>=80) return '🌦️'; if(c>=61) return '🌧️'; if(c>=51) return '🌦️'; if(c>=45) return '🌫️'; if(c<=1) return '☀️'; if(c===2) return '🌤️'; return '☁️'; }
function wxText(c){ if(c==null) return ''; if(c>=95) return 'Καταιγίδα'; if(c>=80) return 'Μπόρες'; if(c>=61) return 'Βροχή'; if(c>=51) return 'Ψιχάλα'; if(c>=45) return 'Ομίχλη'; if(c<=1) return 'Καθαρός ουρανός'; if(c===2) return 'Λίγα σύννεφα'; return 'Συννεφιά'; }
function fmtMin(m){ m=((Math.round(m)%1440)+1440)%1440; return pad(Math.floor(m/60))+':'+pad(m%60); }
function save(){ lsSet('alkyon-places',places); lsSet('alkyon-fcsel',sel); lsSet('alkyon-notify',nt); }

/* ---------- τοποθεσίες ---------- */
function gps(){
  var c=C.getCond(); if(!c||c.lat==null) return null;
  return {id:'gps',name:EN?'My location':'Η θέση μου',lat:c.lat,lon:c.lon,watch:nt.gpsWatch!==false,gps:true};
}
function allPlaces(){ var g=gps(); return (g?[g]:[]).concat(places); }
function findPlace(id){ return allPlaces().filter(function(p){ return p.id===id; })[0]||null; }
function pid(lat,lon){ return 'p'+Math.round(lat*100)+'_'+Math.round(lon*100); }
/* νέα εμφάνιση: η επιλογή τοποθεσίας αλλάζει και τον καιρό στον χάρτη */
function viewSel(){ try{ if(!document.body.classList.contains('nd')||!C.viewPlace) return; var p=findPlace(sel); if(p){ C.viewPlace(p); if(window.AlkyonTodayLoc) AlkyonTodayLoc.sync(p); } }catch(e){} }
function addPlace(name,lat,lon){
  var id=pid(lat,lon), ex=places.filter(function(p){ return p.id===id; })[0];
  if(!ex){ places.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:true}); places=places.slice(0,10); }
  sel=id; save(); renderPlaces(); load(); syncNotify(); viewSel();
}
window.AlkyonPlaces={view:function(){ viewSel(); },pick:function(n,la,lo){ addPlace(n,la,lo); },selectGps:function(){ var ch=sel!=='gps'; sel='gps'; save(); renderPlaces(); if(ch) try{ load(); }catch(e){} },select:function(id){ if(id&&findPlace(id)){ var ch=sel!==id; sel=id; save(); renderPlaces(); if(ch) try{ load(); }catch(e){} } },rename:function(id,n){ var q=places.filter(function(x){ return x.id===id; })[0]; if(q){ q.name=n; q.auto=false; save(); renderPlaces(); } },remove:function(id){ var was=sel===id; places=places.filter(function(p){ return p.id!==id; }); if(was) sel='gps'; save(); renderPlaces(); if(was&&!document.getElementById('tab-fc').hidden) load(); syncNotify(); },list:function(){ return places.slice(); },add:function(name,lat,lon){ var id=pid(lat,lon), ex=places.filter(function(p){ return p.id===id; })[0]; if(!ex){ places.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:true}); places=places.slice(0,10); save(); renderPlaces(); ex=places[0]; } return ex; }};
function lpress(b,fn,tap){ /* παρατεταμένο πάτημα = διαγραφή, κανονικό = επιλογή */
  var tm=null, fired=false; function cancel(){ if(tm){ clearTimeout(tm); tm=null; } }
  b.addEventListener('pointerdown',function(){ fired=false; cancel(); tm=setTimeout(function(){ tm=null; fired=true; try{ if(navigator.vibrate) navigator.vibrate(30); }catch(e){} fn(); },650); });
  ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ b.addEventListener(ev,cancel); });
  b.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  b.addEventListener('click',function(e){ if(fired){ fired=false; e.preventDefault(); return; } tap(); });
}
async function delPlace(p){
  if(!p||p.gps) return;
  if(!(await window.AlkyonAsk((EN?'Delete ':'Διαγραφή ')+'«'+p.name+'»;',{title:EN?'Delete location':'Διαγραφή τοποθεσίας',ok:EN?'Delete':'Διαγραφή',danger:true}))) return;
  var was=sel===p.id; places=places.filter(function(x){ return x.id!==p.id; }); if(was) sel='gps'; save(); renderPlaces(); if(was){ load(); viewSel(); } syncNotify();
}
function renderPlaces(){
  var box=$('plChips'); box.replaceChildren();
  var list=allPlaces();
  if(!list.length) box.append(h('span',{class:'note',text:'Πάτα «Η θέση μου» στον χάρτη ή αναζήτησε μια τοποθεσία.'}));
  list.forEach(function(p){
    var b=h('button',{type:'button',class:'chip','aria-pressed':String(p.id===sel),text:p.name});
    if(p.gps) b.classList.add('gpschip');
    if(p.gps) b.addEventListener('click',function(){ sel=p.id; save(); renderPlaces(); load(); viewSel(); });
    else lpress(b,function(){ delPlace(p); },function(){ sel=p.id; save(); renderPlaces(); load(); viewSel(); });
    box.append(b);
  });
}
async function geocode(){
  var q=$('plQ').value.trim(), R=$('plRes'); R.replaceChildren(); if(q.length<2) return; try{ $('plQ').blur(); }catch(e){}
  R.append(h('div',{class:'note',text:'Αναζήτηση…'}));
  try{
    var r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=6&format=json&language='+(window.LANG==='en'?'en':'el'));
    var j=await r.json(); R.replaceChildren(); setTimeout(function(){ try{ R.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){} },250);
    var res=(j&&j.results)||[];
    if(!res.length){ R.append(h('div',{class:'note',text:'Δεν βρέθηκε τοποθεσία.'})); return; }
    res.forEach(function(x){
      var label=[x.name,x.admin1,x.country].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
      var it=h('button',{type:'button',class:'item plres'},h('b',{text:x.name}),h('span',{class:'meta',text:label}));
      it.addEventListener('click',function(){ R.replaceChildren(); $('plQ').value=''; addPlace(x.name,x.latitude,x.longitude); });
      R.append(it);
    });
  }catch(e){ R.replaceChildren(h('div',{class:'note',text:'Η αναζήτηση δεν δούλεψε. Έλεγξε τη σύνδεση.'})); }
}
function showSpots(){
  var box=$('plSpotList'); box.hidden=!box.hidden; if(box.hidden) return; box.replaceChildren();
  var sp=(C.Store.get('spots')||[]).filter(function(s){ return typeof s.lat==='number'&&typeof s.lon==='number'; });
  if(!sp.length) box.append(h('span',{class:'note',text:'Δεν έχεις αποθηκευμένα σημεία με συντεταγμένες.'}));
  sp.forEach(function(s){ var b=h('button',{type:'button',class:'chip',text:s.name||'Σημείο'}); b.addEventListener('click',function(){ box.hidden=true; addPlace(s.name||'Σημείο',s.lat,s.lon); }); box.append(b); });
}

/* ---------- πρόγνωση ---------- */
async function load(force){
  var p=findPlace(sel)||allPlaces()[0]; 
  if(!p){ renderFc(null,null,'Χρειάζεται τοποθεσία. Πάτα «Η θέση μου» στον χάρτη ή αναζήτησε μία.'); return; }
  if(p.id!==sel){ sel=p.id; renderPlaces(); }
  var cache=lsGet('alkyon-fc7',null);
  var spk=(spCfg()||{}).n||'';
  if(!force&&cache&&cache.id===p.id&&(cache.sp||'')===spk&&Date.now()-cache.t<3600e3&&cache.fc){ renderFc(p,cache.fc,'',cache.t); return; }
  if(busy) return; busy=true; $('fcSub').textContent='Φόρτωση…';
  try{
    var f=await PF.getForecast(p.lat,p.lon,null,{days:7,sp:spCfg()});
    lsSet('alkyon-fc7',{id:p.id,sp:spk,t:Date.now(),fc:f}); renderFc(p,f,'',Date.now());
  }catch(e){
    try{ console.error('forecast',e); }catch(e0){}
    if(cache&&cache.id===p.id&&cache.fc) renderFc(p,cache.fc,'Δεν φορτώθηκε νέα πρόγνωση. Δείχνω την τελευταία αποθηκευμένη.',cache.t);
    else renderFc(p,null,'Η πρόγνωση δεν φορτώθηκε. Έλεγξε τη σύνδεση.');
  }finally{ busy=false; }
}
function tileEl(l,v){ return h('div',{class:'ft'},h('i',{text:l}),h('b',{text:v})); }
function reason(d){
  if(d.safe) return '';
  var w=d.wx||{}, r=[];
  if(d.why==='night') return 'Δεν απομένει φως.';
  if(w.windMax!=null&&w.windMax>14) r.push((EN?'wind up to ':'άνεμος έως ')+PU.wind(w.windMax));
  if(w.waveMax!=null&&w.waveMax>0.9) r.push((EN?'waves up to ':'κύμα έως ')+PU.wave(w.waveMax));
  if(w.gustMax!=null&&w.gustMax>24) r.push((EN?'gusts up to ':'ριπές έως ')+PU.wind(w.gustMax));
  if(w.code!=null&&w.code>=95) r.push(T('καταιγίδα','thunderstorm'));
  return 'Δεν υπάρχει ασφαλές παράθυρο'+(r.length?': '+r.join(', '):'')+'.';
}
function renderFc(p,f,note,t){
  fc=f; fcPlace=p; try{ window.dispatchEvent(new CustomEvent('alkyon-fcloaded',{detail:{place:p,fc:f}})); }catch(e){}
  var D=$('fcDays'), W=$('fcWeek'); D.replaceChildren(); W.replaceChildren();
  $('fcName').textContent=p?p.name:'';
  $('fcSub').textContent=p&&f?('Ενημερώθηκε '+new Date(t||Date.now()).toLocaleTimeString(EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'})+' · '+AlkyonCoord.fmt(p.lat,p.lon)):'';
  $('fcNote').textContent=note||'';
  try{ var ra=$('fcRadar'), sb=$('fcSub'); if(!ra&&sb){ ra=h('a',{id:'fcRadar',class:'note',target:'_blank',rel:'noopener',style:'display:block;margin:4px 0;text-decoration:underline'}); sb.after(ra); }
    if(ra){ ra.hidden=!(p&&f); if(p) { ra.href='https://www.windy.com/-Weather-radar-radar?radar,'+(+p.lat).toFixed(3)+','+(+p.lon).toFixed(3)+',9'; ra.textContent=EN?'🌧 Live rain radar (Windy)':'🌧 Ζωντανό ραντάρ βροχής (Windy)'; } } }catch(e){}
  try{ spPick(p&&f); }catch(e){}
  try{ pressCard(p&&f?p:null); }catch(e){}
  try{ turnCard(p&&f?f:null); }catch(e){}
  var wb=$('fcWatch'), delBtn=$('plDel');
  wb.hidden=!p; delBtn.hidden=!p||!!(p&&p.gps); $('plRen').hidden=delBtn.hidden;
  if(p){ var on=p.watch!==false; wb.setAttribute('aria-pressed',String(on)); wb.textContent=on?'🔔 Ειδοποιήσεις: ναι':'🔕 Ειδοποιήσεις: όχι'; }
  if(!f){ $('fcBest').replaceChildren(); if(note) D.append(h('div',{class:'empty',text:note})); $('fcNote').textContent=''; return; }
  var today=f.nowLocal.slice(0,10), bestD=null;
  f.days.forEach(function(d){ if(d.safe&&(!bestD||d.best>bestD.best)) bestD=d; });
  (function(){ var bx=$('fcBest'); bx.replaceChildren();
    if(!bestD){ bx.classList.add('none'); bx.append(h('span',{class:'fcbn',text:'Καμία ασφαλής μέρα στο εύρος της πρόγνωσης.'})); return; }
    bx.classList.remove('none'); bx.style.flexWrap='wrap';
    var tone=bestD.best>=75?'good':bestD.best>=60?'warn':'bad';
    bx.append(h('div',{class:'fcbtx'},h('span',{class:'fcbl',text:'Καλύτερη μέρα'}),h('b',{class:'fcbd',text:dl(bestD.date)}),bestD.win?h('span',{class:'fcbw',text:pad(bestD.win.s)+':00–'+pad((bestD.win.e+1)%24)+':00'}):null),
      h('div',{class:'fcbs '+tone},h('b',{text:String(bestD.best)}),h('span',{text:'Δείκτης'})),
      h('span',{class:'fcbconf',style:'flex-basis:100%;font-size:12px;opacity:.8',text:T('Βεβαιότητα: ','Confidence: ')+(function(){ var q=confOf(bestD,today); return q.txt+(q.why?' · '+q.why:''); })()}));
  })();
  f.days.forEach(function(d){
    var dt=new Date(d.date+'T12:00:00Z'), w=d.wx||{};
    var good=d.safe&&d.best>=75, mid=d.safe&&d.best>=60, cls=!d.safe?'none':good?'good':mid?'mid':'bad';
    var col=h('button',{type:'button',class:'wkc','aria-label':dl(d.date)},h('span',{class:'wkv',text:d.safe?String(d.best):'–'}),h('span',{class:'wkbar '+cls,style:'height:'+(d.safe?Math.max(8,d.best):8)+'%'}),h('span',{class:'wkl',text:dl(d.date).split(' ')[0]}));
    col.addEventListener('click',function(){ var el=document.getElementById('fd-'+d.date); if(el){ el.open=true; el.scrollIntoView({behavior:'smooth',block:'start'}); } });
    var lab=(d.date===today?(EN?'Today':'Σήμερα'):DAYN[dt.getUTCDay()])+' '+d.date.slice(8)+'/'+d.date.slice(5,7);
    var sum=h('summary',{},
      h('span',{class:'fdi',text:wxIcon(w.code)}),
      h('span',{class:'fdt'},h('b',{text:lab}),h('span',{class:'meta',text:[w.tmax!=null?PU.tempP(w.tmin)[0]+'–'+PU.temp(w.tmax):null,w.windAvg!=null?PU.wind(w.windAvg)+' '+dirName(w.windDir):null,w.waveAvg!=null?PU.wave(w.waveAvg):null].filter(Boolean).join(' · ')})),
      h('span',{class:'pill '+(d.safe?(good?'good':mid?'warn':'bad'):'bad'),text:d.safe?String(d.best):'–'}),
      h('span',{class:'fdbar '+cls,title:EN?'Fishing index':'Δείκτης ψαρέματος'},h('i',{style:'width:'+(d.safe?Math.max(4,d.best):0)+'%'})));
    var tiles=h('div',{class:'ftiles'},
      tileEl('Καιρός',wxText(w.code)||'–'),
      tileEl('Θερμοκρασία',w.tmax!=null?PU.tempP(w.tmin)[0]+'–'+PU.temp(w.tmax):'–'),
      tileEl('Άνεμος',w.windMax!=null?PU.wind(w.windAvg)+' ('+(EN?'up to ':'έως ')+PU.wind(w.windMax)+')':'–'),
      tileEl('Ριπές',w.gustMax!=null?PU.wind(w.gustMax):'–'),
      tileEl('Βροχή',w.rainMax!=null?w.rainMax+'%'+(w.rainMm>=0.1?' · '+w.rainMm.toFixed(1)+' mm':''):'–'),
      tileEl('Σύννεφα',w.cloudAvg!=null?Math.round(w.cloudAvg)+'%':'–'),
      tileEl('Πίεση',w.pStart!=null?PU.press(w.pEnd)+' '+(w.pEnd-w.pStart>=1.5?'↑':w.pEnd-w.pStart<=-1.5?'↓':'→'):'–'),
      tileEl('Κύμα',w.waveMax!=null?PU.wave(w.waveAvg)+' ('+(EN?'up to ':'έως ')+PU.wave(w.waveMax)+')'+(w.period?' · '+Math.round(w.period)+' s':''):'–'),
      tileEl('Θάλασσα',w.sst!=null?PU.temp(w.sst,1):'–'),
      tileEl(T('Βεβαιότητα','Confidence'),(function(){ var q=confOf(d,today); return q.txt+(q.why?' ('+q.why+')':''); })()),
      tileEl('Σελήνη',Math.round(w.illum*100)+'%'),
      tileEl('Ανατολή / Δύση',fmtMin(w.rise)+' / '+fmtMin(w.set)),
      tileEl('Καλύτερο παράθυρο',d.safe&&d.win?pad(d.win.s)+':00–'+pad((d.win.e+1)%24)+':00':'–'));
    var mx=Math.max.apply(null,d.hours.map(function(x){ return x.score; }).concat([1]));
    var bars=h('div',{class:'minibars'}); var byHr={}; d.hours.forEach(function(x){ byHr[x.hr]=x; });
    for(var k=0;k<24;k++){ var x=byHr[k]; bars.append(h('i',{style:'height:'+(x?Math.round(x.score/mx*100):0)+'%;'+(x&&x.safe?'':'opacity:.25'),title:pad(k)+':00'+(x?' · '+x.score:'')})); }
    var det=h('details',{class:'fday',id:'fd-'+d.date},sum,tiles,
      d.safe?null:h('p',{class:'note sfwarn',text:reason(d)}),
      h('div',{class:'label',style:'margin-top:8px',text:'Δείκτης ανά ώρα (00 → 23, αχνές οι ώρες με ανασφαλείς συνθήκες)'}),bars);
    D.append(det);
  });
  $('fcNote').textContent=note||(EN?'Index 0–100 from wind, gusts, waves, pressure, clouds, storms, light and moon. Only hours with wind up to 4 Bft, gusts up to 6 Bft and waves up to 0.9 m count. Local times.':'Δείκτης 0–100 από άνεμο, ριπές, κύμα, πίεση, σύννεφα, καταιγίδες, φως και σελήνη. Μετράνε μόνο ώρες με άνεμο ως 4 Bft, ριπές ως 6 Bft και κύμα ως 0,9 m. Ώρες τοπικές.')
}

/* ---------- γράφημα πίεσης 24 ωρών (ενδεικτικό, μοντέλο Open-Meteo) ---------- */
/* v31z354: εύρος γραφήματος πίεσης/ανέμου: 24 ώρες, 3 ή 7 ημέρες */
var PRANGE={d1:{past:24,fut:25,lbl:['24 ώρες','24 h']},d3:{past:24,fut:72,lbl:['3 ημέρες','3 days']},d7:{past:24,fut:168,lbl:['7 ημέρες','7 days']}};
function prKey(){ var k=lsGet('alkyon-pwrange','d1'); return PRANGE[k]?k:'d1'; }
function pressSeries(p,key0){
  var rk=prKey(), RG=PRANGE[rk], key=(key0||'alkyon-fcpress2')+(rk==='d1'?'':'-'+rk), c=lsGet(key,null);
  if(c&&c.id===p.id&&Date.now()-c.t<30*60000&&c.v) return Promise.resolve(c.v);
  var url='https://api.open-meteo.com/v1/forecast?latitude='+(+p.lat).toFixed(3)+'&longitude='+(+p.lon).toFixed(3)+'&hourly=pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&past_hours='+RG.past+'&forecast_hours='+RG.fut+'&timezone=UTC';
  var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },10000);
  return fetch(url,{signal:ac.signal}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }).then(function(j){
    clearTimeout(tm); var H=j.hourly||{}, ts=H.time||[], out=[], now=-1;
    var nn=function(a,i){ return a&&typeof a[i]==='number'?a[i]:null; };
    for(var i=0;i<ts.length;i++){ var pr=nn(H.pressure_msl,i); if(pr==null) continue; var ms=Date.parse(ts[i]+'Z'); out.push({t:ms,p:pr,w:nn(H.wind_speed_10m,i),g:nn(H.wind_gusts_10m,i),d:nn(H.wind_direction_10m,i)}); if(ms<=Date.now()) now=out.length-1; }
    var v={pts:out,now:now}; lsSet(key,{id:p.id,t:Date.now(),v:v}); return v;
  }).catch(function(e){ clearTimeout(tm); if(c&&c.id===p.id&&c.v) return c.v; throw e; });
}
var pressPlace=null, pressTd=null;
window.addEventListener('alkyon-units',function(){ if(pressPlace) { try{ pressCard(pressPlace); }catch(e){} } if(pressTd) { try{ pressCard(pressTd,{td:1}); }catch(e){} } });
/* μετρημένη πίεση από σταθμό (METAR ή DoM) κοντά στη θέση, για σύγκριση με το μοντέλο· δεν δείχνει τίποτα αν δεν υπάρχει πρόσφατη μέτρηση κοντά */
function measured(box,p,modelNow){
  var SUPA='https://sgfohmqwdwtkhtrebnix.supabase.co', SKEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
  function pick(list){
    var best=null, bd=1e9; (list||[]).forEach(function(s){
      if(s.pres==null||!isFinite(s.lat)||!isFinite(s.lon)||Date.now()-Date.parse(s.t||0)>2*3600000) return;
      var dx=(s.lon-p.lon)*Math.cos(p.lat*Math.PI/180)*111.2, dy=(s.lat-p.lat)*111.2, d=Math.sqrt(dx*dx+dy*dy); if(d<bd){ bd=d; best=s; } });
    return best&&bd<=60?{s:best,d:bd}:null;
  }
  function show(r){
    if(!r||!box.isConnected) return; var s=r.s, PU=window.AlkyonUnits;
    var dif=modelNow!=null?Math.round((s.pres-modelNow)*10)/10:null;
    box.append(h('p',{class:'note',text:T('Μετρημένη πίεση: ','Measured pressure: ')+(PU&&PU.press?PU.press(s.pres):Math.round(s.pres)+' hPa')+' · '+(s.name||s.id)+' ('+s.src+', '+String(s.t).slice(11,16)+'Z, '+Math.round(r.d)+' '+T('χλμ.','km')+')'+(dif!=null?' · '+T('μοντέλο τώρα: ','model now: ')+(PU&&PU.press?PU.press(modelNow):Math.round(modelNow))+' ('+(dif>0?'+':'')+dif+' hPa)':'')}));
  }
  var c=lsGet('alkyon-obsp',null); if(c&&Date.now()-c.t<10*60000&&c.v){ show(pick(c.v)); return; }
  var ac=('AbortController' in window)?new AbortController():null, tm=setTimeout(function(){ if(ac) ac.abort(); },10000);
  fetch(SUPA+'/functions/v1/smart-api',{signal:ac?ac.signal:undefined,headers:{apikey:SKEY,Authorization:'Bearer '+SKEY}}).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){
    var l=Array.isArray(j)?j:[]; lsSet('alkyon-obsp',{t:Date.now(),v:l}); show(pick(l));
  }).catch(function(){}).then(function(){ clearTimeout(tm); });
}
function turnCard(f){
  var D=$('fcDays'); if(!D) return;
  var box=$('fcTurn');
  if(!box){ box=h('div',{id:'fcTurn',class:'card',style:'margin:10px 0'}); var pr=$('fcPress'); if(pr&&pr.parentNode) pr.parentNode.insertBefore(box,pr); else D.parentNode.insertBefore(box,D); }
  box.replaceChildren(); var o=f&&PF.pressureOutlook?PF.pressureOutlook(f):null;
  if(!o){ box.hidden=true; return; } box.hidden=false;
  var hh=function(t){ return t.slice(11,16); }, hrs=function(n){ return n===1?T('1 ώρα','1 hour'):n+T(' ώρες',' hours'); };
  var tr=o.trend==='fall'?T('πέφτει','falling'):o.trend==='rise'?T('ανεβαίνει','rising'):o.trend==='steady'?T('σταθερή','steady'):'';
  var sg=function(v){ return (v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(1).replace('.',EN?'.':','); };
  box.append(h('h3',{text:T('Τάση πίεσης και καμπές','Pressure trend and turning points')}));
  box.append(h('p',{style:'margin:4px 0;font-weight:600',text:PU.press(o.now)+(tr?' · '+tr:'')+(o.d3!=null?' ('+sg(o.d3)+' hPa / 3 '+T('ώρες','h')+')':'')}));
  if(o.last) box.append(h('p',{style:'margin:3px 0;font-size:13px',text:T('Πριν ','')+(EN?'':hrs(o.last.hours)+': ')+(o.last.kind==='peak'?T('κορυφή ','peak '):T('κοιλάδα ','trough '))+PU.press(o.last.p)+' ('+hh(o.last.t)+') → '+(o.last.kind==='peak'?T('ξεκίνησε πτώση','falling since'):T('ξεκίνησε άνοδος','rising since'))+(EN?', '+hrs(o.last.hours)+' ago':'')}));
  if(o.next) box.append(h('p',{style:'margin:3px 0;font-size:13px',text:T('Επόμενη καμπή: ','Next turning point: ')+(o.next.kind==='peak'?T('κορυφή ','peak '):T('κοιλάδα ','trough '))+PU.press(o.next.p)+' '+T('στις ','at ')+hh(o.next.t)+' ('+T('σε ','in ')+hrs(o.next.hours)+') → '+(o.next.kind==='peak'?T('μετά ξεκινά πτώση','then falling'):T('μετά ξεκινά άνοδος','then rising'))}));
  else box.append(h('p',{style:'margin:3px 0;font-size:13px',text:T('Δεν προβλέπεται καμπή στην πρόγνωση που φορτώθηκε.','No turning point in the loaded forecast.')}));
  /* v31z355: έναρξη ανόδου (σε λίγο ή μόλις ξεκίνησε) */
  try{ var rz=PF.pressureRise?PF.pressureRise(f):[]; rz.forEach(function(e){ box.append(h('p',{style:'margin:6px 0 0;font-size:14px;font-weight:600',text:e.kind==='rise-soon'?T('🔔 Η άνοδος ξεκινά γύρω στις ','🔔 The rise starts around ')+hh(e.t)+' ('+T('σε ','in ')+hrs(e.h)+')':T('📈 Ξεκίνησε άνοδος στις ','📈 Rise started at ')+hh(e.t)+' (+'+String(e.rate).replace('.',EN?'.':',')+T(' hPa σε 3 ώρες)',' hPa in 3 h)')})); }); }catch(e){}
  /* v31z351: πότε να περιμένεις ειδοποίηση καμπής */
  if(o.next){ var ah=new Date(Date.parse(o.next.t)-3*3600e3), pre=('0'+ah.getHours()).slice(-2)+':'+('0'+ah.getMinutes()).slice(-2);
    var on2=nt.on&&nt.turn; box.append(h('p',{class:'note',style:'margin:4px 0 0;font-weight:600',text:on2?T('🔔 Ειδοποίηση καμπής: από ~','🔔 Turning-point alert: from ~')+pre+T(' (έως 3 ώρες πριν) και ξανά μόλις αρχίσει η αλλαγή (έως 6 ώρες μετά).',' (up to 3 hours before) and again as soon as the change starts (up to 6 hours after).'):T('🔕 Οι ειδοποιήσεις καμπής είναι κλειστές. Άνοιξε «Ειδοποίησέ με για καλές μέρες» και «…στις καμπές της πίεσης» πιο κάτω.','🔕 Turning-point alerts are off. Turn on "Notify me about good days" and "…at pressure turning points" below.')})); }
  box.append(h('p',{class:'note',text:T('Εκτίμηση από το μοντέλο πρόγνωσης (λειασμένη), όχι μέτρηση. Καμπή = πορεία τουλάχιστον 0,3 hPa και μετά αντιστροφή από 0,1 hPa.','Model estimate (smoothed), not a measurement. Turn = a move of at least 0.3 hPa, then a reversal from 0.1 hPa.')}));
}
function pressCard(p,o){
  o=o||{}; if(o.td) pressTd=p||null; else pressPlace=p||null;
  var bid=o.td?'tdPress':'fcPress', box=$(bid);
  if(!box){
    if(o.td){ var lb=$('liveBox'); if(!lb||!lb.parentNode) return; box=h('div',{id:bid,class:'card',style:'margin:10px 0'}); lb.parentNode.insertBefore(box,lb.nextSibling); }
    else { var D=$('fcDays'); if(!D) return; box=h('div',{id:bid,class:'card',style:'margin:10px 0'}); D.parentNode.insertBefore(box,D); }
  }
  box.replaceChildren(); if(!p) { box.hidden=true; return; } box.hidden=false;
  var rk=prKey(), TT=(window.PF&&window.PF.moonAlt)?T('Πίεση, άνεμος και σελήνη','Pressure, wind and moon'):T('Πίεση και άνεμος','Pressure and wind');
  function rangeBar(){ var bar=h('div',{class:'prange',role:'group','aria-label':T('Εύρος','Range')}); Object.keys(PRANGE).forEach(function(k){ var b=h('button',{type:'button','aria-pressed':String(k===rk),text:T(PRANGE[k].lbl[0],PRANGE[k].lbl[1])}); b.addEventListener('click',function(){ lsSet('alkyon-pwrange',k); pressCard(p,o); }); bar.append(b); }); return bar; }
  function head(){ var hd=h('div',{class:'prhead'}); hd.append(h('h3',{text:TT}),rangeBar()); return hd; }
  var sk=h('div',{class:'ndsk ndskchart',role:'status','aria-label':T('Φόρτωση','Loading')}); box.append(head(),sk);
  pressSeries(p,o.td?'alkyon-fcpress2t':null).then(function(v){
    var pts=v.pts, n=v.now; if(!pts.length||n<3){ throw new Error('nodata'); }
    var hasW=pts.some(function(q){ return q.w!=null; });
    /* v31z361: τρίτο κομμάτι, σελήνη: ύψος της (πάνω από τον ορίζοντα), κύριες και δευτερεύουσες περίοδοι (Knight) */
    var PFm=window.PF, hasM=!!(PFm&&PFm.moonAlt&&PFm.solunarPeriods&&p.lat!=null&&p.lon!=null), MG=hasM?20:0, H3=hasM?40:0;
    var ns='http://www.w3.org/2000/svg', W=320, L=6, R=26, TP=8, H1=84, GAP=22, H2=hasW?78:0, AR=hasW?14:0, BT=16, Ht=TP+H1+(hasW?GAP+H2+AR:0)+MG+H3+BT;
    var mk=function(tag,attrs){ var e=document.createElementNS(ns,tag); Object.keys(attrs).forEach(function(k){ e.setAttribute(k,attrs[k]); }); return e; };
    var cs=getComputedStyle(document.documentElement), line=(cs.getPropertyValue('--sea')||'#2b7a8c').trim()||'#2b7a8c', mut=(cs.getPropertyValue('--muted')||'#6b7c86').trim()||'#6b7c86', ink=(cs.getPropertyValue('--ink')||'#0c2b3a').trim()||'#0c2b3a', wcol='#e8743b';
    var N=pts.length, X=function(i){ return L+(W-L-R)*i/(N-1); };
    var pv=pts.map(function(q){ return q.p; }), pmn=Math.min.apply(null,pv), pmx=Math.max.apply(null,pv); if(pmx-pmn<4){ var m=(pmx+pmn)/2; pmn=m-2; pmx=m+2; }
    var Y1=function(x){ return TP+H1*(1-(x-pmn)/(pmx-pmn)); };
    var wTop=TP+H1+GAP, wv=pts.map(function(q){ return Math.max(q.w||0,q.g||0); }), wmx=Math.max(10,Math.ceil(Math.max.apply(null,wv)/5)*5);
    var Y2=function(x){ return wTop+H2*(1-x/wmx); };
    var svg=document.createElementNS(ns,'svg'); svg.setAttribute('viewBox','0 0 '+W+' '+Ht); svg.setAttribute('role','img'); svg.setAttribute('aria-label',TT); svg.style.cssText='width:100%;height:auto;display:block;touch-action:none;cursor:crosshair';
    var txt=function(x,y,t,anc,sz,fill){ var e=mk('text',{x:x,y:y,'text-anchor':anc||'end','font-size':sz||8,fill:fill||mut}); e.textContent=t; svg.append(e); return e; };
    var PU2=window.AlkyonUnits, wl=function(k){ try{ return PU2.windP(k)[0]; }catch(e){ return Math.round(k); } }, wu=function(){ try{ return PU2.windP(1)[1]; }catch(e){ return 'kn'; } };
    txt(L,TP-1,'hPa','start',8); [pmn,(pmn+pmx)/2,pmx].forEach(function(g){ svg.append(mk('line',{x1:L,x2:W-R,y1:Y1(g),y2:Y1(g),stroke:mut,'stroke-opacity':.25,'stroke-width':1})); txt(W-R+2,Y1(g)+3,String(Math.round(g)),'start'); });
    var path=function(f,i0,i1){ var d=''; for(var i=i0;i<=i1;i++){ d+=(i===i0?'M':'L')+X(i).toFixed(1)+' '+f(pts[i]).toFixed(1)+' '; } return d; };
    svg.append(mk('path',{d:path(function(q){ return Y1(q.p); },0,n),fill:'none',stroke:line,'stroke-width':2.2,'stroke-linejoin':'round'}),mk('path',{d:path(function(q){ return Y1(q.p); },n,N-1),fill:'none',stroke:line,'stroke-width':2.2,'stroke-dasharray':'4 3','stroke-linejoin':'round'}));
    var iHi=pv.indexOf(Math.max.apply(null,pv)), iLo=pv.indexOf(Math.min.apply(null,pv));
    [[iHi,'▲',-5],[iLo,'▼',11]].forEach(function(q){ txt(X(q[0]),Y1(pv[q[0]])+q[2],q[1],'middle',9,ink); });
    var iW=-1;
    if(hasW){
      txt(L,wTop-4,wu(),'start',8,wcol); [0,wmx/2,wmx].forEach(function(g){ svg.append(mk('line',{x1:L,x2:W-R,y1:Y2(g),y2:Y2(g),stroke:mut,'stroke-opacity':.25,'stroke-width':1})); txt(W-R+2,Y2(g)+3,String(wl(g)),'start'); });
      var wd=path(function(q){ return Y2(q.w||0); },0,N-1);
      svg.append(mk('path',{d:wd+'L'+X(N-1).toFixed(1)+' '+Y2(0)+' L'+X(0).toFixed(1)+' '+Y2(0)+' Z',fill:wcol,'fill-opacity':.15,stroke:'none'}));
      if(pts.some(function(q){ return q.g!=null; })) svg.append(mk('path',{d:path(function(q){ return Y2(q.g!=null?q.g:(q.w||0)); },0,N-1),fill:'none',stroke:wcol,'stroke-width':1,'stroke-dasharray':'1.5 2.5','stroke-opacity':.8}));
      svg.append(mk('path',{d:path(function(q){ return Y2(q.w||0); },0,n),fill:'none',stroke:wcol,'stroke-width':2.2,'stroke-linejoin':'round'}),mk('path',{d:path(function(q){ return Y2(q.w||0); },n,N-1),fill:'none',stroke:wcol,'stroke-width':2.2,'stroke-dasharray':'4 3','stroke-linejoin':'round'}));
      var ww=pts.map(function(q){ return q.w||0; }); iW=ww.indexOf(Math.max.apply(null,ww)); txt(X(iW),Y2(ww[iW])-4,'▲','middle',9,wcol);
      var AST=N>100?12:N>60?6:3; for(var i=1;i<N-1;i+=AST){ var q=pts[i]; if(q.d==null||(q.w||0)<2) continue; var g=mk('g',{transform:'translate('+X(i).toFixed(1)+' '+(wTop+H2+8)+') rotate('+Math.round(q.d)+')'}); g.append(mk('path',{d:'M0 5 L0 -5 M-3 2 L0 5 L3 2',fill:'none',stroke:wcol,'stroke-width':1.4,'stroke-linecap':'round','stroke-linejoin':'round'})); svg.append(g); }
    }
    var mcol='#d6a93a', MPER=[], mTop=TP+H1+(hasW?GAP+H2+AR:0)+MG, mBot=mTop+H3;
    var tw=null; /* σούρουπο/αυγή για «σύμπτωση» */
    if(hasM){
      var t0=pts[0].t, t1=pts[N-1].t, Xt=function(ms){ return L+(W-L-R)*(ms-t0)/(t1-t0); }, clipX=function(x){ return Math.max(L,Math.min(W-R,x)); };
      MPER=PFm.solunarPeriods(t0,t1,+p.lat,+p.lon);
      txt(L,mTop-4,T('Σελήνη','Moon'),'start',8,mcol);
      svg.append(mk('line',{x1:L,x2:W-R,y1:mBot,y2:mBot,stroke:mut,'stroke-opacity':.35,'stroke-width':1}));
      MPER.forEach(function(q){ var x0=clipX(Xt(q.s)), x1=clipX(Xt(q.e)); if(x1-x0<0.5) return;
        svg.append(mk('rect',{x:x0.toFixed(1),y:mTop,width:(x1-x0).toFixed(1),height:H3,fill:mcol,'fill-opacity':q.kind==='major'?.38:.17,rx:2})); });
      /* ύψος σελήνης: 0° στη βάση, 90° στην κορυφή του κομματιού· κάτω από τον ορίζοντα δεν σχεδιάζεται */
      var steps=Math.min(240,(N-1)*2), dM='', on=false;
      for(var k=0;k<=steps;k++){ var ms=t0+(t1-t0)*k/steps, a=PFm.moonAlt(ms,+p.lat,+p.lon), xx=Xt(ms).toFixed(1);
        if(a>0){ var yy=(mBot-H3*Math.min(1,a/90)).toFixed(1); dM+=(on?'L':'M'+xx+' '+mBot+' L')+xx+' '+yy+' '; on=true; } else if(on){ dM+='L'+xx+' '+mBot+' '; on=false; } }
      if(on) dM+='L'+Xt(t1).toFixed(1)+' '+mBot;
      if(dM) svg.append(mk('path',{d:dM,fill:mcol,'fill-opacity':.12,stroke:mcol,'stroke-width':1.4,'stroke-linejoin':'round'}));
      MPER.forEach(function(q){ var x=Xt(q.t); if(x<L||x>W-R) return; txt(x,mTop+(q.kind==='major'?9:H3-3),q.ev==='upper'?'▲':q.ev==='lower'?'▼':q.ev==='rise'?'↑':'↓','middle',8,mcol); });
      try{ tw=[]; var dd={}; var tzOf=function(ms){ try{ var o=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Nicosia',timeZoneName:'shortOffset'}).formatToParts(new Date(ms)).find(function(x){ return x.type==='timeZoneName'; }).value, m=/GMT([+-]\d+)(?::(\d+))?/.exec(o); return m?(+m[1])*60+(m[2]?(m[1][0]==='-'?-1:1)*(+m[2]):0):120; }catch(e){ return 120; } };
        pts.forEach(function(q){ var tz=tzOf(q.t), ds=new Date(q.t+tz*60000).toISOString().slice(0,10); if(dd[ds]) return; dd[ds]=1; var sm=PFm.sunMoon(ds,+p.lat,+p.lon,tz); var b0=Date.parse(ds+'T00:00:00Z')-tz*60000; tw.push(b0+sm.rise*60000,b0+sm.set*60000); }); }catch(e){ tw=null; }
    }
    var moonAt=function(ms){ if(!hasM) return null; var best=null; MPER.forEach(function(q){ if(ms>=q.s&&ms<=q.e&&(!best||q.kind==='major')) best=q; }); return best; };
    var twNear=function(q){ return !!(tw&&tw.some(function(x){ return Math.abs(x-q.t)<=90*60000; })); };
    var mLbl=function(q){ return (q.kind==='major'?T('κύρια','major'):T('δευτερεύουσα','minor'))+' ('+(q.ev==='upper'?T('σελήνη από πάνω','moon overhead'):q.ev==='lower'?T('σελήνη από κάτω','moon underfoot'):q.ev==='rise'?T('ανατολή σελήνης','moonrise'):T('δύση σελήνης','moonset'))+')'; };
    svg.append(mk('line',{x1:X(n),x2:X(n),y1:TP-2,y2:Ht-BT,stroke:ink,'stroke-width':1,'stroke-dasharray':'2 2'}),mk('circle',{cx:X(n),cy:Y1(pts[n].p),r:3.2,fill:ink}));
    var hrOf=function(ms){ try{ return +new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hour12:false,timeZone:'Asia/Nicosia'}).format(new Date(ms))%24; }catch(e){ return new Date(ms).getUTCHours(); } };
    txt(X(n),Ht-3,T('τώρα','now'),'middle',8);
    var multi=N>60, dayLbl=function(ms){ try{ return new Date(ms).toLocaleDateString(window.LANG==='en'?'en-GB':'el-GR',{weekday:'short',timeZone:'Asia/Nicosia'}); }catch(e){ return ''; } };
    pts.forEach(function(q,i){ var hr=hrOf(q.t)%24;
      if(multi){ if(hr!==0||i<2||i>N-3) return; svg.append(mk('line',{x1:X(i),x2:X(i),y1:TP,y2:Ht-BT,stroke:mut,'stroke-opacity':.25,'stroke-width':1})); if(Math.abs(i-n)>=4) txt(X(i)+ (N>100?11:16),Ht-3,dayLbl(q.t+12*3600000),'middle',8); return; }
      if(hr%6!==0||Math.abs(i-n)<3||i<2||i>N-3) return; svg.append(mk('line',{x1:X(i),x2:X(i),y1:Ht-BT,y2:Ht-BT+3,stroke:mut,'stroke-width':1})); txt(X(i),Ht-3,(hr<10?'0':'')+hr+':00','middle',8); });
    var pick=mk('line',{x1:0,x2:0,y1:TP-2,y2:Ht-BT,stroke:ink,'stroke-width':1.5,'stroke-opacity':.7,visibility:'hidden'}), pd1=mk('circle',{cx:0,cy:0,r:4,fill:line,stroke:'#fff','stroke-width':1.5,visibility:'hidden'}), pd2=mk('circle',{cx:0,cy:0,r:4,fill:wcol,stroke:'#fff','stroke-width':1.5,visibility:'hidden'});
    svg.append(pick,pd1,pd2);
    var fmt=function(d){ return (d>0?'+':d<0?'−':'')+Math.abs(d).toFixed(1)+' hPa'; };
    var verdict=function(d){ return d<=-3.6?T('πέφτει πολύ γρήγορα','falling very fast'):d<=-2?T('πέφτει γρήγορα','falling fast'):d<=-0.8?T('πέφτει','falling'):d>=2?T('ανεβαίνει γρήγορα','rising fast'):d>=0.8?T('ανεβαίνει','rising'):T('σταθερή','steady'); };
    var hhmm=function(ms){ try{ return new Date(ms).toLocaleString(window.LANG==='en'?'en-GB':'el-GR',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Nicosia'}); }catch(e){ return new Date(ms).toISOString().slice(11,16)+'Z'; } };
    var wtxt=function(q){ if(q.w==null) return ''; return ' · '+T('άνεμος ','wind ')+(q.d!=null&&q.w>=1?dirName(q.d)+' ':'')+PU.wind(q.w)+(q.g!=null&&q.g>q.w+3?' ('+T('ριπές ','gusts ')+PU.wind(q.g)+')':''); };
    var out=h('div',{class:'meta',role:'status','aria-live':'polite',style:'margin-top:6px;font-weight:600',text:T('Άγγιξε το γράφημα για να δεις πίεση και άνεμο σε κάθε ώρα. ▲ υψηλότερη/ισχυρότερος, ▼ χαμηλότερη: ','Touch the chart to see pressure and wind at any hour. ▲ highest/strongest, ▼ lowest: ')+hhmm(pts[iHi].t)+' '+PU.press(pv[iHi])+' / '+hhmm(pts[iLo].t)+' '+PU.press(pv[iLo])});
    function at(ev){
      var r=svg.getBoundingClientRect(); if(!r.width) return;
      var i=Math.round(((ev.clientX-r.left)/r.width*W-L)/(W-L-R)*(N-1)); i=Math.max(0,Math.min(N-1,i));
      pick.setAttribute('x1',X(i)); pick.setAttribute('x2',X(i)); pick.setAttribute('visibility','visible');
      pd1.setAttribute('cx',X(i)); pd1.setAttribute('cy',Y1(pv[i])); pd1.setAttribute('visibility','visible');
      if(hasW&&pts[i].w!=null){ pd2.setAttribute('cx',X(i)); pd2.setAttribute('cy',Y2(pts[i].w)); pd2.setAttribute('visibility','visible'); } else pd2.setAttribute('visibility','hidden');
      var a=Math.max(0,i-3), b=Math.min(N-1,i+3), tl=(b>a)?(pv[b]-pv[a])/(b-a)*3:0;
      var mq=moonAt(pts[i].t+1800000);
      out.textContent=hhmm(pts[i].t)+(i>n?' ('+T('πρόγνωση','forecast')+')':'')+' · '+PU.press(pv[i])+' · '+T('τάση ','trend ')+fmt(tl)+T('/3ω','/3h')+' ('+verdict(tl)+')'+wtxt(pts[i])+(i===iHi?' ▲':i===iLo?' ▼':'')+(hasM?' · '+T('σελήνη: ','moon: ')+(mq?mLbl(mq)+(twNear(mq)?T(', μαζί με αυγή/σούρουπο ★',', with dawn/dusk ★'):''):T('εκτός περιόδου','no period')):'');
    }
    var drag=false;
    svg.addEventListener('pointerdown',function(e){ drag=true; try{ svg.setPointerCapture(e.pointerId); }catch(x){} at(e); });
    svg.addEventListener('pointermove',function(e){ if(drag||e.pointerType==='mouse') at(e); });
    svg.addEventListener('pointerup',function(){ drag=false; }); svg.addEventListener('pointercancel',function(){ drag=false; });
    var dlt=function(a,b){ return pv[b]-pv[a]; }, back=dlt(Math.max(0,n-3),n), f3=n+3<N?dlt(n,n+3):null, f6=n+6<N?dlt(n,n+6):null;
    function moonLine(){
      if(!hasM) return null;
      var ph=PFm.moonPhase(pts[n].t), EM=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'], idx=Math.round(ph.f*8)%8;
      var strong=ph.illum<0.1||ph.illum>0.9, now=pts[n].t;
      var up=MPER.filter(function(q){ return q.e>=now; }).slice(0,4);
      var hm=function(ms){ try{ return new Date(ms).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Nicosia'}); }catch(e){ return ''; } };
      var dk=function(ms){ try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Nicosia'}).format(new Date(ms)); }catch(e){ return new Date(ms).toISOString().slice(0,10); } }, dl=function(ms){ return dk(ms)===dk(now)?'':T('αύριο ','tomorrow '); };
      var parts=up.map(function(q){ return dl(q.s)+hm(q.s)+'–'+hm(q.e)+' '+(q.kind==='major'?T('κύρια','major'):T('δευτ.','minor'))+(twNear(q)?' ★':''); });
      var cur=moonAt(now);
      return h('div',{class:'meta',style:'margin-top:6px',text:EM[idx]+' '+T('Σελήνη ','Moon ')+Math.round(ph.illum*100)+'%'+(strong?T(' (κοντά σε νέα σελήνη/πανσέληνο: ισχυρότερες μέρες κατά τη θεωρία)',' (near new/full moon: stronger days per the theory)'):'')+' · '+(cur?T('Τώρα: ','Now: ')+mLbl(cur)+' · ':'')+T('Επόμενες ώρες σελήνης: ','Next moon times: ')+(parts.join(', ')||'—')+(parts.some(function(x){ return /★/.test(x); })?T(' · ★ = μαζί με αυγή ή σούρουπο (η καλύτερη ώρα)',' · ★ = together with dawn or dusk (best time)'):'')});
    }
    var wnote='';
    if(hasW&&pts[n].w!=null&&n+3<N&&pts[n+3].w!=null){ var dw=pts[n+3].w-pts[n].w; wnote=' · '+T('άνεμος: ','wind: ')+PU.wind(pts[n].w)+(Math.abs(dw)>=2?' → '+PU.wind(pts[n+3].w)+' '+T('σε 3 ώρες','in 3 h'):T(' σταθερός τις επόμενες 3 ώρες',' steady for the next 3 h')); }
    box.replaceChildren(head(),svg,out,
      h('div',{class:'meta',style:'margin-top:6px',text:T('Πίεση, τελευταίες 3 ώρες: ','Pressure, last 3 h: ')+fmt(back)+' ('+verdict(back)+')'+(f3!=null?' · '+T('επόμενες 3 ώρες: ','next 3 h: ')+fmt(f3):'')+(f6!=null?' · '+T('επόμενες 6 ώρες: ','next 6 h: ')+fmt(f6):'')+wnote}),
      moonLine(),
      h('p',{class:'note',text:T('Πάνω: πίεση (μπλε). Κάτω: άνεμος (πορτοκαλί, διακεκομμένη κουκκίδα = ριπές, βέλη = προς πού πηγαίνει ο άνεμος). Συνεχής γραμμή = παρελθόν, διακεκομμένη = πρόγνωση. Ενδεικτικό, από μοντέλο, όχι από όργανο.','Top: pressure (blue). Bottom: wind (orange, dotted = gusts, arrows = where the wind is going). Solid = past, dashed = forecast. Indicative, from a model, not an instrument.')+(hasM?T(' Σελήνη (χρυσό): καμπύλη = ύψος της πάνω από τον ορίζοντα, σκούρα ζώνη = κύρια περίοδος (σελήνη από πάνω ▲ ή από κάτω ▼, ±45′), ανοιχτή ζώνη = δευτερεύουσα (ανατολή ↑ ή δύση ↓, ±30′), κατά τη θεωρία Solunar του J. A. Knight. Η θεωρία δεν έχει επιβεβαιωθεί επιστημονικά· οι μελέτες βρίσκουν μικρή ή καμία επίδραση, γι’ αυτό στον δείκτη μετρά λίγο.',' Moon (gold): curve = its height above the horizon, dark band = major period (moon overhead ▲ or underfoot ▼, ±45′), light band = minor (moonrise ↑ or moonset ↓, ±30′), per J. A. Knight’s Solunar theory. The theory is not scientifically confirmed; studies find small or no effect, so it counts little in the score.'):'')}));
    try{ measured(box,p,pts[n].p); }catch(e){}
  }).catch(function(){ box.replaceChildren(head(),h('p',{class:'note',text:T('Δεν φορτώθηκαν δεδομένα πίεσης και ανέμου.','Pressure and wind data did not load.')})); });
}
/* Το ίδιο γράφημα (πίεση και άνεμος) στην καρτέλα «Σήμερα», για τη θέση που δείχνει η Σήμερα */
var tdBusy=null;
function todayPress(){
  var tab=$('tab-today'); if(!tab||!$('liveBox')||tab.hidden) return;
  clearTimeout(tdBusy); tdBusy=setTimeout(function(){
    var c=null; try{ c=(C.getViewCond&&C.getViewCond())||(C.getCond&&C.getCond()); }catch(e){}
    if(!c||c.lat==null||c.lon==null){ try{ pressCard(null,{td:1}); }catch(e){} return; }
    var lat=+c.lat, lon=+c.lon, p={id:'td:'+lat.toFixed(2)+','+lon.toFixed(2),lat:lat,lon:lon,name:c.name||''};
    if(pressTd&&pressTd.id===p.id&&$('tdPress')&&!$('tdPress').hidden) return;
    try{ pressCard(p,{td:1}); }catch(e){}
  },400);
}
(function(){
  var tab=$('tab-today'); if(!tab) return;
  try{ new MutationObserver(function(){ todayPress(); }).observe(tab,{attributes:true,attributeFilter:['hidden']}); }catch(e){}
  document.addEventListener('alkyon-view',todayPress);
  setTimeout(todayPress,2500); setInterval(function(){ if(!document.hidden) todayPress(); },60000);
})();
/* ---------- ειδοποιήσεις ---------- */
/* v31z366: πόσο να εμπιστεύεσαι τον βαθμό μιας μέρας. Η πρόγνωση καιρού χάνει ακρίβεια με τις μέρες (σήμερα/αύριο: υψηλή, 2–3 μέρες: μέτρια, 4+: χαμηλή),
   και πέφτει ένα επίπεδο όταν ο άνεμος ή το κύμα είναι κοντά στο όριο ασφάλειας (μικρή αλλαγή της πρόγνωσης αλλάζει το αν βγαίνεις). */
function confOf(d,today){
  var lead=Math.round((Date.parse(d.date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000), lv=lead<=1?2:lead<=3?1:0, w=d.wx||{};
  var edge=(w.windMax!=null&&Math.abs(w.windMax-14)<=2)||(w.waveMax!=null&&Math.abs(w.waveMax-0.9)<=0.15); if(edge&&lv>0) lv--;
  return {lv:lv,txt:[T('χαμηλή','low'),T('μέτρια','medium'),T('υψηλή','high')][lv],why:(lead<=1?'':lead<=3?T('πρόγνωση 2–3 ημερών','2–3 days ahead'):T('πρόγνωση 4+ ημερών','4+ days ahead'))+(edge?((lead>1?' · ':'')+T('άνεμος ή κύμα κοντά στο όριο','wind or waves near the limit')):'')};
}
/* v31z363: επιλογή είδους-στόχου πάνω από τις μέρες: ο βαθμός προσαρμόζεται στο είδος (θερμοκρασία θάλασσας, και για καλαμάρι/ξιφία κανόνες από μελέτες) */
function spPick(show){
  var D=$('fcDays'); if(!D) return; var box=$('fcSpPick');
  if(!box){ box=h('div',{id:'fcSpPick',class:'meta',style:'margin:8px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap'}); D.parentNode.insertBefore(box,D); }
  box.hidden=!show; if(!show) return; box.replaceChildren();
  var s=h('select',{'aria-label':T('Είδος για τον βαθμό','Species for the score'),style:'min-height:40px;max-width:60%'}), cur=lsGet('alkyon-advsp','');
  s.append(h('option',{value:'',text:T('Όλα τα είδη (γενικός)','All species (general)')}));
  (window.SPKB||[]).slice().sort(function(a,b){ return (EN?a.en:a.n).localeCompare(EN?b.en:b.n,EN?'en':'el'); }).forEach(function(e){ s.append(h('option',{value:e.n,text:EN&&e.en?e.en:e.n})); });
  /* και τα είδη από τα δικά σου ψάρια που δεν είναι στη λίστα (π.χ. ξιφίας) */
  try{ var kn={}; (window.SPKB||[]).forEach(function(e){ kn[e.n]=1; }); var own={}; ((C.Store.act?C.Store.act():C.Store.get('bites'))||[]).forEach(function(b){ var n=String(b.species||'').replace(/\s*\(.*$/,'').trim(); if(n&&!kn[n]) own[n]=1; });
    Object.keys(own).sort().forEach(function(n){ s.append(h('option',{value:n,text:n})); }); if(cur&&!kn[cur]&&!own[cur]) s.append(h('option',{value:cur,text:cur})); }catch(e){}
  s.value=cur;
  s.addEventListener('change',function(){ lsSet('alkyon-advsp',s.value); try{ window.dispatchEvent(new Event('alkyon-advsp')); }catch(e){} });
  var k=spCfg(), sk=window.PF&&k?((k.l||'')+' '+k.n).toLowerCase():'';
  var why=!k?T('Γενικός βαθμός. Διάλεξε είδος για να μετρήσει και η θερμοκρασία θάλασσας.','General score. Choose a species so sea temperature counts too.')
    :/loligo|καλαμάρ/.test(sk)?T('Καλαμάρι: καλύτερα κοντά στη νέα σελήνη, γύρω από τη δύση, με λίγο άνεμο, πιο κρύα θάλασσα και χαμηλή πίεση (μελέτη στη Μαγιόρκα, 2012).','Squid: better near new moon, around sunset, with light wind, cooler sea and low pressure (Mallorca study, 2012).')
    :/xiphias|ξιφ/.test(sk)?T('Ξιφίας: η σελήνη δεν μετρά (μελέτη στην Ανατολική Μεσόγειο, 2018).','Swordfish: the moon does not count (Eastern Mediterranean study, 2018).')
    :T('Μετρά η θερμοκρασία θάλασσας για το είδος','Sea temperature for the species counts')+(k.sst?' ('+k.sst[0]+'–'+k.sst[1]+' °C).':'.');
  box.append(h('span',{text:T('Βαθμός για:','Score for:')}),s,h('span',{class:'note',style:'flex-basis:100%;margin:0',text:why}));
}
/* v31z363: είδος-στόχος (από «Τι να ψαρέψω») για τον βαθμό, και για τον server/service worker */
function spCfg(){ var n=lsGet('alkyon-advsp',''); if(!n) return null; var e=(window.SPKB||[]).filter(function(k){ return k.n===n; })[0]; return e?{n:e.n,l:e.l,sst:e.sst}:{n:n}; }
function cfgPlaces(){ return allPlaces().map(function(p){ return {id:p.id,name:p.name,lat:+p.lat.toFixed(3),lon:+p.lon.toFixed(3),watch:p.watch!==false}; }); }
async function writeCfg(){
  var cfg={sp:spCfg(),lang:window.LANG||'el',on:nt.on,threshold:nt.threshold,pressure:nt.pressure!==false,turn:!!nt.turn,wind:wwCfg(),notified:nt.notified,server:!!nt.server,places:cfgPlaces()};
  try{ var c=await caches.open('alkyon-cfg'); await c.put(new URL('__cfg',location.href).href,new Response(JSON.stringify(cfg))); }catch(e){}
}
var b64u=function(s){ var p='='.repeat((4-s.length%4)%4), r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(r,function(c){ return c.charCodeAt(0); }); };
async function subId(sub){
  var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub.endpoint));
  return Array.prototype.map.call(new Uint8Array(buf),function(b){ return ('0'+b.toString(16)).slice(-2); }).join('').slice(0,40);
}
async function getSub(create){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!window.VAPID_PUBLIC) return null;
  var reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription();
  /* αν η συνδρομή φτιάχτηκε με άλλο κλειδί VAPID, δεν θα δεχτεί ειδοποιήσεις (403): σβήσ' την και φτιάξε νέα */
  if(sub&&create){ try{ var k=sub.options&&sub.options.applicationServerKey, want=b64u(window.VAPID_PUBLIC);
    if(k){ var a=new Uint8Array(k), same=a.length===want.length; for(var i=0;same&&i<a.length;i++) if(a[i]!==want[i]) same=false;
      if(!same){ try{ var cl=Cl(), oid=await subId(sub); if(cl) await cl.rest('push_subs?id=eq.'+oid,{method:'DELETE'}); }catch(e0){} await sub.unsubscribe(); sub=null; } } }catch(e){} }
  if(!sub&&create) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(window.VAPID_PUBLIC)});
  return sub;
}
async function pushServer(){
  var cl=Cl(); if(!cl) return false;
  try{
    var sub=await getSub(true); if(!sub) return false;
    var lg=window.LANG==='en'?'en':'el', body={id:await subId(sub),sub:sub.toJSON(),places:cfgPlaces().map(function(p){ p.lang=lg; var sc=spCfg(); if(sc) p.sp=sc; return p; }),threshold:nt.threshold,checked_at:null,updated_at:new Date().toISOString()};
    var H={Prefer:'resolution=merge-duplicates,return=minimal'};
    var ww=wwCfg(), tn=!!nt.turn;
    try{ await cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:nt.pressure!==false,wind:ww,turn:tn},body))}); nt.turnSrv=tn; }
    catch(eT){ nt.turnSrv=false; if(tn) setTimeout(function(){ try{ ntStatus(T('⚠ Ο server δεν δέχτηκε τη ρύθμιση «καμπή πίεσης». Τρέξε το safety-upgrade.sql στη Supabase.','⚠ The server did not accept the pressure-turn setting. Run safety-upgrade.sql in Supabase.')); }catch(x){} },400); try{ await cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:nt.pressure!==false,wind:ww},body))}); }catch(e0){
      try{ await cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(Object.assign({pressure:nt.pressure!==false},body))}); }
      catch(e1){ await cl.rest('push_subs',{method:'POST',headers:H,body:JSON.stringify(body)}); }
    } }
    return true;
  }catch(e){ return false; }
}
async function dropServer(){
  var cl=Cl(); if(!cl) return;
  try{ var sub=await getSub(false); if(sub) await cl.rest('push_subs?id=eq.'+(await subId(sub)),{method:'DELETE'}); }catch(e){}
}
function ntStatus(t){ $('ntMsg').textContent=t; }
function sigOf(){ return JSON.stringify([nt.threshold,allPlaces().map(function(p){ return [p.id,+p.lat.toFixed(2),+p.lon.toFixed(2),p.watch!==false]; })]); }
async function syncNotify(onlyIfChanged){
  save();
  if(!nt.on){ await writeCfg(); return; }
  var sg=sigOf()+(nt.pressure!==false)+JSON.stringify(wwCfg())+!!nt.turn+'|L'+(window.LANG||'el')+'|S'+((spCfg()||{}).n||''); if(onlyIfChanged&&nt.sig===sg&&nt.server) return; nt.sig=sg;
  var ok=await pushServer(); nt.server=ok; save(); await writeCfg();
  ntStatus(ok?'Ενεργό. Ο server ελέγχει την πρόγνωση περίπου κάθε 3 ώρες και σου στέλνει ειδοποίηση, ακόμα και με κλειστή εφαρμογή.':'Ενεργό μόνο όταν ανοίγεις την εφαρμογή (ή περιοδικά στο παρασκήνιο, αν το επιτρέπει το Android). Για ειδοποιήσεις με κλειστή εφαρμογή χρειάζεται η ρύθμιση του server.');
}
async function showNote(title,body,m){
  m=m||{};
  try{
    var reg=await navigator.serviceWorker.getRegistration();
    if(reg) await reg.showNotification(title,{body:body,tag:'alk-'+(m.kind||'info')+'-'+String(m.key||Date.now()).slice(-40),renotify:true,icon:'icon-192.png',badge:'icon-192.png',data:{url:reg.scope,bc:{kind:m.kind||'info',id:m.key,full:m.full||body,place:m.place||null,t:m.t||null}}});
    else new Notification(title,{body:body});
  }catch(e){ try{ new Notification(title,{body:body}); }catch(e2){} }
}
async function localCheck(){
  if(!nt.on||nt.server||!('Notification' in window)||Notification.permission!=='granted') return;
  try{
    var r=await PF.checkPlaces({lang:window.LANG||'el',places:cfgPlaces(),threshold:nt.threshold,pressure:nt.pressure!==false,turn:!!nt.turn,wind:wwCfg(),notified:nt.notified});
    nt.notified=r.notified; save(); await writeCfg();
    if(r.msgs&&r.msgs.length){ for(var i=0;i<r.msgs.length;i++){ var m=r.msgs[i]; await showNote(m.title,m.body,m); } }
    else if(r.items.length) showNote(r.title,r.body);
  }catch(e){}
}
async function periodic(on){
  try{ var reg=await navigator.serviceWorker.ready; if(!reg.periodicSync) return false;
    if(on) await reg.periodicSync.register('alkyon-forecast',{minInterval:12*3600*1000}); else await reg.periodicSync.unregister('alkyon-forecast'); return true;
  }catch(e){ return false; }
}
$('ntPress').checked=nt.pressure!==false; $('ntTurn').checked=!!nt.turn;
$('ntTurn').addEventListener('change',function(){ nt.turn=$('ntTurn').checked; nt.notified={}; save(); if(nt.on){ syncNotify(); localCheck(); } });
$('ntOn').checked=!!nt.on; $('ntThr').value=String(nt.threshold);
$('ntOn').addEventListener('change',async function(){
  if($('ntOn').checked){
    if(!('Notification' in window)){ $('ntOn').checked=false; ntStatus('Ο browser δεν υποστηρίζει ειδοποιήσεις.'); return; }
    var p=await Notification.requestPermission();
    if(p!=='granted'){ $('ntOn').checked=false; ntStatus('Δεν δόθηκε άδεια ειδοποιήσεων. Επίτρεψέ τες στις ρυθμίσεις του browser.'); return; }
    nt.on=true; nt.notified={}; await syncNotify(); await periodic(true); localCheck();
  } else { nt.on=false; save(); await writeCfg(); await dropServer(); await periodic(false); nt.server=false; save(); ntStatus('Οι ειδοποιήσεις έκλεισαν.'); }
});
$('ntThr').addEventListener('change',async function(){ nt.threshold=+$('ntThr').value; nt.notified={}; save(); if(nt.on){ await syncNotify(); localCheck(); } });
window.addEventListener('alkyon-wwatch',function(){ if(nt.on) syncNotify(); });
/* v31z363: όταν αλλάζει το είδος-στόχος, ξαναϋπολογίζεται ο βαθμός και ενημερώνεται ο server */
window.addEventListener('alkyon-advsp',function(){ try{ load(true); }catch(e){} if(nt.on) syncNotify(true); });
/* v31z409: αλλαγή τύπου ψαρέματος → νέος υπολογισμός πρόγνωσης (τα βάρη του βαθμού και οι ετικέτες εξαρτώνται από τον τύπο) */
window.addEventListener('alkyon-fprof',function(){ clearTimeout(window.__fpRe); window.__fpRe=setTimeout(function(){ try{ load(true); }catch(e){} },300); });
/* v31z358: μία φορά στο άνοιγμα, αν άλλαξε κάτι (π.χ. γλώσσα), ενημερώνει τον server */
setTimeout(function(){ try{ if(nt.on) syncNotify(true); }catch(e){} },5000);
$('ntPress').addEventListener('change',function(){ nt.pressure=$('ntPress').checked; save(); if(nt.on){ syncNotify(); } });
$('ntTest').addEventListener('click',async function(){
  if(!('Notification' in window)){ ntStatus('Ο browser δεν υποστηρίζει ειδοποιήσεις.'); return; }
  var p=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(p!=='granted'){ ntStatus('Δεν δόθηκε άδεια ειδοποιήσεων.'); return; }
  await showNote(T('Δοκιμή ειδοποίησης','Test notification'),T('Οι ειδοποιήσεις του Alkyon δουλεύουν σε αυτό το κινητό.','Alkyon notifications work on this phone.')); ntStatus(T('Στάλθηκε τοπική δοκιμή. Έλεγχος server…','Local test sent. Checking the server…'));
  /* v31z351: και δοκιμή από τον server (ίδιος δρόμος με τις ειδοποιήσεις πίεσης/ανέμου) */
  var cl=Cl(); if(!cl||!cl.fn){ ntStatus(T('Τοπική δοκιμή OK. Για δοκιμή server χρειάζεται σύνδεση λογαριασμού.','Local test OK. A server test needs you to be signed in.')); return; }
  try{
    var r=await cl.fn('quick-processor',{action:'test',lang:EN?'en':'el'});
    if(!r||!r.ok){ ntStatus(T('Server: ','Server: ')+((r&&r.error)||'?')); return; }
    var lc=r.last_check?new Date(r.last_check).toLocaleTimeString(EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'}):T('ποτέ','never');
    ntStatus(r.subs?(T('Server: στάλθηκε σε ','Server: sent to ')+r.sent+'/'+r.subs+T(' συσκευές',' devices')+(r.err?' ('+r.err+')':'')+T(' · τελευταίος έλεγχος ',' · last check ')+lc+T(' · καμπές πίεσης: ',' · pressure turns: ')+(r.turn?T('ναι','on'):T('όχι','off'))):T('Server: δεν υπάρχει εγγραφή ειδοποιήσεων για αυτόν τον λογαριασμό. Άνοιξε «Ειδοποίησέ με για καλές μέρες».','Server: no notification subscription for this account. Turn on "Notify me about good days".'));
  }catch(e){ ntStatus(/400/.test(String(e&&e.message))?T('Τοπική δοκιμή OK. Η δοκιμή server θέλει νέα έκδοση της συνάρτησης quick-processor.','Local test OK. The server test needs the updated quick-processor function.'):T('Τοπική δοκιμή OK. Ο server δεν απάντησε: ','Local test OK. The server did not answer: ')+(e&&e.message||'')); }
});
if(nt.on) ntStatus(nt.server?T('Ενεργό (server).','Active (server).'):T('Ενεργό.','Active.'));

/* ---------- events ---------- */
$('plGo').addEventListener('click',geocode);
$('plQ').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); geocode(); } });
$('plSpots').addEventListener('click',showSpots);
$('plMap').addEventListener('click',function(){ window.dispatchEvent(new Event('alkyon-pickfc')); });
async function revName(lat,lon){
  var pts=[[0,0],[.03,0],[-.03,0],[0,.03],[0,-.03]];
  for(var i=0;i<pts.length;i++){
    try{
      var r=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language='+(EN?'en':'el')+'&lat='+(lat+pts[i][0])+'&lon='+(lon+pts[i][1]));
      if(!r.ok) continue; var j=await r.json(); if(!j||j.error) continue;
      var a=j.address||{}, n=a.suburb||a.village||a.town||a.city||a.hamlet||a.neighbourhood||a.municipality||j.name||'';
      if(n) return (i?(EN?'Near ':'Κοντά: '):'')+n;
    }catch(e){ return ''; }
  }
  return '';
}
window.addEventListener('alkyon-fcpick',function(e){
  var d=e.detail, id=pid(d.lat,d.lon), had=places.some(function(p){ return p.id===id; });
  addPlace((EN?'Point ':'Σημείο ')+AlkyonCoord.fmt(d.lat,d.lon),d.lat,d.lon);
  if(had) return;
  var p=places.filter(function(x){ return x.id===id; })[0]; if(p) p.auto=true;
  revName(d.lat,d.lon).then(function(n){
    var q=places.filter(function(x){ return x.id===id; })[0];
    if(n&&q&&q.auto){ q.name=n; save(); renderPlaces(); if(sel===id) renderFc(fcPlace&&findPlace(sel),fc,'',Date.now()); syncNotify(); }
  });
});
$('fcRefresh').addEventListener('click',function(){ load(true); });
$('fcWatch').addEventListener('click',function(){
  var p=findPlace(sel); if(!p) return;
  if(p.gps) nt.gpsWatch=!(nt.gpsWatch!==false); else p.watch=!(p.watch!==false);
  save(); renderPlaces(); renderFc(fcPlace&&findPlace(sel),fc,'',Date.now()); syncNotify();
});
$('plRen').addEventListener('click',async function(){
  var p=places.filter(function(x){ return x.id===sel; })[0]; if(!p) return;
  var n=await window.AlkyonAsk.prompt(EN?'Location name':'Όνομα τοποθεσίας',{value:p.name,title:EN?'Rename location':'Μετονομασία τοποθεσίας',ok:EN?'Save':'Αποθήκευση',max:40}); if(n==null) return; n=n.trim().slice(0,40); if(!n) return;
  p.name=n; p.auto=false; save(); renderPlaces(); renderFc(fcPlace&&findPlace(sel),fc,'',Date.now()); syncNotify();
});
$('plDel').addEventListener('click',async function(){
  var p=findPlace(sel); if(p&&!(await window.AlkyonAsk((EN?'Delete ':'Διαγραφή ')+'«'+p.name+'»;',{title:EN?'Delete location':'Διαγραφή τοποθεσίας',ok:EN?'Delete':'Διαγραφή',danger:true}))) return;
  places=places.filter(function(p){ return p.id!==sel; }); sel='gps'; save(); renderPlaces(); load(); syncNotify(); viewSel();
});
document.querySelectorAll('nav.tabs button[data-tab="fc"]').forEach(function(b){ b.addEventListener('click',function(){ renderPlaces(); load(); }); });
try{ var fcT=document.getElementById('tab-fc'), fcWas=fcT.hidden; new MutationObserver(function(){ if(fcWas&&!fcT.hidden){ renderPlaces(); load(); } fcWas=fcT.hidden; }).observe(fcT,{attributes:true,attributeFilter:['hidden']}); }catch(e){}
document.addEventListener('alkyon-cond',function(){ renderPlaces(); if(!document.getElementById('tab-fc').hidden) load(); else if(sel==='gps') { /* θα φορτώσει όταν ανοίξει */ } if(nt.on) syncNotify(true); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden) localCheck(); });
renderPlaces(); 
setTimeout(function(){ if(nt.on) { writeCfg(); localCheck(); } },3000);
})();
