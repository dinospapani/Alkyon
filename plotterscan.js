/* v31z354: Συντεταγμένες από φωτογραφία της οθόνης του plotter (ή χαρτιού) → σημεία (waypoints).
   Η φωτογραφία διαβάζεται από το Claude με το δικό σου κλειδί (όπως η αναγνώριση ψαριού). Οι συντεταγμένες
   ελέγχονται από την εφαρμογή (AlkyonCoord.parse) και εμφανίζονται για επιβεβαίωση πριν αποθηκευτούν. */
(function(){
'use strict';
var C=window.AlkyonCore, mb=document.querySelector('.mapbtns'); if(!C||!mb||!window.AlkyonCoord) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; }, P=window.AlkyonCoord;
function el(t,c,x){ var e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; }
var PROMPT='This photo shows a marine chartplotter / GPS screen, a waypoint list, or a paper note with geographic coordinates. '+
 'Read every coordinate pair exactly as printed. Reply with ONLY a JSON array: [{"name":"waypoint name or null","lat":"latitude exactly as shown, including N/S","lon":"longitude exactly as shown, including E/W","depth":number or null}]. '+
 'Copy digits, degree/minute symbols and decimals exactly; do not convert formats. If a hemisphere letter is missing, leave it out. If no coordinates are readable, reply [].';

var btn=el('button','mbtn'); btn.type='button'; btn.id='bScan';
btn.setAttribute('aria-label',T('Συντεταγμένες από φωτογραφία','Coordinates from a photo')); btn.title=btn.getAttribute('aria-label');
btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 10h8M8 14h5"/></svg>';
mb.appendChild(btn);
var file=el('input'); file.type='file'; file.accept='image/*'; file.setAttribute('capture','environment'); file.hidden=true; document.body.appendChild(file);

var ov=null;
function close(){ if(ov){ ov.remove(); ov=null; } }
function sheet(title){
  close(); ov=el('div','psov'); ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label',title);
  var card=el('div','pscard'), hd=el('div','pshead'), h=el('h3',null,title), x=el('button','btn ghost sm','✕'); x.type='button'; x.setAttribute('aria-label',T('Κλείσιμο','Close')); x.addEventListener('click',close);
  hd.append(h,x); var body=el('div','psbody'); card.append(hd,body); ov.append(card);
  ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
  document.body.appendChild(ov); return body;
}
function blobB64(b){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){ res(String(r.result).split(',')[1]); }; r.onerror=rej; r.readAsDataURL(b); }); }

async function read(blob){
  var key=C.lsGet('alkyon-akey',''); if(!key) throw new Error('nokey');
  var b64=await blobB64(blob), ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },45000);
  try{
    var r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ac.signal,
      headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-5-5',max_tokens:2000,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},{type:'text',text:PROMPT}]}]})});
    if(!r.ok){ var e=new Error('http'); e.status=r.status; try{ var jj=await r.json(); e.api=jj&&jj.error&&jj.error.message||''; }catch(x){} throw e; }
    var j=await r.json(), txt=(j.content||[]).filter(function(x){ return x.type==='text'; }).map(function(x){ return x.text; }).join(''), m=/\[[\s\S]*\]/.exec(txt);
    var arr=[]; try{ arr=m?JSON.parse(m[0]):[]; }catch(x){ arr=[]; }
    return (Array.isArray(arr)?arr:[]).map(function(o){
      var la=P.parse(String(o.lat||''),'lat'), lo=P.parse(String(o.lon||''),'lon');
      return {name:o.name?String(o.name).slice(0,40):'',rawLat:String(o.lat||''),rawLon:String(o.lon||''),lat:la,lon:lo,depth:(typeof o.depth==='number'&&o.depth>0&&o.depth<3000)?Math.round(o.depth):null,ok:!isNaN(la)&&!isNaN(lo)&&Math.abs(la)<=90&&Math.abs(lo)<=180};
    });
  } finally { clearTimeout(tm); }
}

function noKey(){
  var b=sheet(T('Συντεταγμένες από φωτογραφία','Coordinates from a photo'));
  b.append(el('p','note',T('Για να διαβάζονται οι συντεταγμένες από φωτογραφία χρειάζεται το κλειδί Claude API (το ίδιο με την αναγνώριση ψαριού). Το βάζεις στο Προφίλ › Ρυθμίσεις › Αναγνώριση ψαριού με AI.','Reading coordinates from a photo needs your Claude API key (the same one used for fish identification). Add it in Profile › Settings › AI fish identification.')));
  var row=el('div','row'), k=el('button','btn acc',T('Άνοιγμα ρυθμίσεων','Open settings')), m=el('button','btn ghost',T('Πληκτρολόγηση συντεταγμένων','Type coordinates'));
  k.type=m.type='button';
  k.addEventListener('click',function(){ close(); var pb=document.getElementById('navProf'); if(pb) pb.click(); setTimeout(function(){ var s=document.querySelector('#profile button[data-p=set]'); if(s) s.click(); setTimeout(function(){ var a=document.getElementById('aiKey'); if(a){ a.scrollIntoView({block:'center'}); try{ a.focus(); }catch(e){} } },400); },400); });
  m.addEventListener('click',function(){ close(); if(C.openSpotForm) C.openSpotForm({}); });
  row.append(k,m); b.append(row);
}

function results(list,thumb){
  var b=sheet(T('Βρέθηκαν συντεταγμένες','Coordinates found'));
  if(thumb){ var im=el('img','psthumb'); im.alt=''; im.src=thumb; b.append(im); }
  if(!list.length){ b.append(el('p','note',T('Δεν διαβάστηκαν συντεταγμένες. Δοκίμασε πιο κοντινή, καθαρή φωτογραφία χωρίς αντανάκλαση.','No coordinates could be read. Try a closer, sharper photo without glare.'))); var again=el('button','btn acc',T('Νέα φωτογραφία','New photo')); again.type='button'; again.addEventListener('click',function(){ close(); file.click(); }); b.append(again); return; }
  b.append(el('p','note',T('Έλεγξε ότι οι αριθμοί είναι ίδιοι με την οθόνη. Μπορείς να τους διορθώσεις πριν την αποθήκευση.','Check the numbers match the screen. You can fix them before saving.')));
  var types=[].map.call((document.getElementById('sType')||{options:[]}).options,function(o){ return o.value||o.textContent; });
  var rows=[], d=new Date(), base=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
  list.forEach(function(it,i){
    var r=el('div','psrow'+(it.ok?'':' bad')), top=el('label','pstop'), cb=el('input'); cb.type='checkbox'; cb.checked=it.ok;
    var nm=el('input','psname'); nm.type='text'; nm.maxLength=40; nm.value=it.name||(T('Σημείο ','Spot ')+base+(list.length>1?' #'+(i+1):'')); nm.setAttribute('aria-label',T('Όνομα','Name'));
    top.append(cb,nm); r.append(top);
    var g=el('div','psgrid'), la=el('input','coordin'), lo=el('input','coordin'); la.type=lo.type='text';
    la.value=it.ok?P.fmtOne(it.lat,'lat'):it.rawLat; lo.value=it.ok?P.fmtOne(it.lon,'lon'):it.rawLon; la.setAttribute('aria-label',T('Γεωγραφικό πλάτος','Latitude')); lo.setAttribute('aria-label',T('Γεωγραφικό μήκος','Longitude'));
    g.append(la,lo); r.append(g);
    var ln=el('div','psline'), ty=el('select'); types.forEach(function(t){ var o=el('option',null,t); o.value=t; ty.append(o); });
    var dp=el('input'); dp.type='number'; dp.inputMode='numeric'; dp.min='0'; dp.placeholder=T('βάθος m','depth m'); if(it.depth!=null) dp.value=it.depth;
    ln.append(ty,dp); r.append(ln);
    var er=el('div','pserr'); r.append(er);
    function chk(){ var a=P.parse(la.value,'lat'), o=P.parse(lo.value,'lon'), ok=!isNaN(a)&&!isNaN(o); r.classList.toggle('bad',!ok); er.textContent=ok?'':T('Μη έγκυρες συντεταγμένες.','Invalid coordinates.'); return ok?{lat:a,lon:o}:null; }
    la.addEventListener('input',chk); lo.addEventListener('input',chk); chk();
    rows.push({cb:cb,nm:nm,ty:ty,dp:dp,chk:chk}); b.append(r);
  });
  var act=el('div','row psact'), sv=el('button','btn acc',''), ag=el('button','btn ghost',T('Νέα φωτογραφία','New photo')); sv.type=ag.type='button';
  function lbl(){ var n=rows.filter(function(x){ return x.cb.checked; }).length; sv.textContent=T('Αποθήκευση','Save')+(n?' ('+n+')':''); sv.disabled=false; }
  rows.forEach(function(x){ x.cb.addEventListener('change',lbl); }); lbl();
  ag.addEventListener('click',function(){ close(); file.click(); });
  sv.addEventListener('click',async function(){
    var sel=rows.filter(function(x){ return x.cb.checked; }); if(!sel.length){ C.toast(T('Διάλεξε τουλάχιστον ένα σημείο.','Pick at least one spot.')); return; }
    var bad=sel.filter(function(x){ return !x.chk(); }); if(bad.length){ C.toast(T('Διόρθωσε τις συντεταγμένες με κόκκινο.','Fix the coordinates marked in red.')); return; }
    var first=null, n=0;
    for(var i=0;i<sel.length;i++){ var x=sel[i], p=x.chk(); try{ var id=await C.Store.save('spots',{name:x.nm.value.trim()||T('Σημείο','Spot'),type:x.ty.value,lat:+p.lat.toFixed(6),lon:+p.lon.toFixed(6),depth:x.dp.value!==''?+x.dp.value:null,notes:T('Από φωτογραφία plotter','From plotter photo'),src:'scan'}); n++; if(!first) first=p; }catch(e){} }
    close(); C.toast(n+T(n===1?' σημείο αποθηκεύτηκε.':' σημεία αποθηκεύτηκαν.',n===1?' spot saved.':' spots saved.'));
    if(first){ try{ var map=C.map&&C.map(); if(C.switchTab) C.switchTab('map'); if(map) setTimeout(function(){ map.flyTo([first.lat,first.lon],Math.max(map.getZoom(),14)); },200); }catch(e){} }
  });
  act.append(sv,ag); b.append(act);
}

btn.addEventListener('click',function(){ if(!C.lsGet('alkyon-akey','')){ noKey(); return; } file.value=''; file.click(); });
file.addEventListener('change',async function(){
  var f=file.files&&file.files[0]; if(!f) return;
  var b=sheet(T('Ανάγνωση συντεταγμένων…','Reading coordinates…')); b.append(el('p','note',T('Διαβάζω τη φωτογραφία. Χρειάζεται σύνδεση στο ίντερνετ.','Reading the photo. This needs an internet connection.')));
  try{
    var blob=C.resizeImage?await C.resizeImage(f):f, th=URL.createObjectURL(blob);
    var list=await read(blob); results(list,th);
  }catch(e){
    var bb=sheet(T('Δεν διαβάστηκε','Could not read'));
    var msg=e&&e.message==='nokey'?T('Λείπει το κλειδί API.','The API key is missing.'):e&&e.status===401?T('Το κλειδί API δεν είναι σωστό.','The API key is not valid.'):e&&e.name==='AbortError'?T('Άργησε πολύ. Δοκίμασε ξανά.','It took too long. Try again.'):T('Δεν έγινε σύνδεση με το Claude. Έλεγξε το ίντερνετ.','Could not reach Claude. Check your connection.')+(e&&e.api?' ('+e.api+')':'');
    bb.append(el('p','note',msg)); var a=el('button','btn acc',T('Δοκίμασε ξανά','Try again')); a.type='button'; a.addEventListener('click',function(){ close(); file.click(); }); bb.append(a);
  }
});
window.AlkyonScan={open:function(){ btn.click(); },_results:results};
})();
