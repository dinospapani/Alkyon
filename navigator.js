/* Περιορισμοί ψαρέματος και προστατευόμενες περιοχές (Κύπρος και Ανατολική Μεσόγειος).
   Δεδομένα: ProtectedSeas Navigator, άδεια CC BY 4.0, βάσει έργου στο https://map.navigatormap.org/ (εξαγωγή 27/08/2026).
   Ενδεικτικά δεδομένα, όχι νομική πληροφορία: ισχύει ο επίσημος κανονισμός. Τα όρια είναι απλοποιημένα. */
(function(){
'use strict';
var C=window.AlkyonCore, bz=document.getElementById('bZones'), map=C&&C.map&&C.map();
if(!C||!bz||!map||typeof L==='undefined') return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-nav', FILE='navigator-mpa.json', MAIL='support@protectedseas.net';
var ATTR='Protected areas: <a href="https://map.navigatormap.org/" target="_blank" rel="noopener">ProtectedSeas Navigator</a> (CC BY 4.0)';
var DATA=null, loading=null, group=null, rend=null, on=!!C.lsGet(KEY,false), inside={}, lastAlert={}, hideT=null, firstFix=true;

/* ---------- δεδομένα ---------- */
function load(){
  if(DATA) return Promise.resolve(DATA);
  if(loading) return loading;
  loading=fetch((window.ALKYON_BASE||'')+FILE).then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); }).then(function(j){
    DATA=((j&&j.f)||[]).filter(relevant); DATA.forEach(function(f){ f._s=sev(f); }); return DATA;
  }).catch(function(e){ loading=null; throw e; });
  return loading;
}
/* Κρατάμε μόνο ό,τι αφορά ψάρεμα ή άγκυρα: αν όλα τα στοιχεία ψαρέματος είναι άγνωστα (π.χ. περιοχές μόνο για πουλιά ή δάση), η περιοχή δεν χρειάζεται. */
function relevant(f){
  var k=['rf','hl','tr','sp'];
  for(var i=0;i<k.length;i++){ var v=f[k[i]]; if(v===0||v===1||v===2) return true; }
  return f.an===1||f.an===2;
}
var FISHTXT=/\b(fish\w*|angl\w*|rod|hook\w*|line|nets?|trawl\w*|troll\w*|spear\w*|anchor\w*|vessels?|boats?|div(e|es|ing))\b|ψάρ|αλιε|δίχτ|άγκυρ|σκάφ|κατάδυ/i;
/* 0 = χωρίς γνωστό περιορισμό για καλάμι, 1 = περιορισμοί, 2 = απαγορεύεται (ψάρεμα αναψυχής ή καλάμι) */
function sev(f){
  if(f.rf===1||f.hl===1) return 2;
  if(f.rf===2||f.hl===2||f.tr===1||f.tr===2) return 1;
  return 0;
}
var COL=['#4f86b5','#e8861e','#d33'];
/* Χρώματα Navigator ανά LFP: 5 κόκκινο, 4 κίτρινο, 3 γαλάζιο, 2 σκούρο γκρι (Less), 1 ανοιχτό γκρι (Least). Οι αποχρώσεις είναι προσεγγιστικές, από screenshots. */
var LFPCOL={5:{f:'#f06a6a',o:'#c04646'},4:{f:'#f5d33f',o:'#b8962a'},3:{f:'#8fc1d6',o:'#4f86b5'},2:{f:'#7f7f7f',o:'#5f5f5f'},1:{f:'#bcc2c3',o:'#939a9b'}};

/* ---------- έλεγχος θέσης ---------- */
function inPoly(lat,lon,poly){
  var c=false;
  for(var k=0;k<poly.length;k++){
    var r=poly[k];
    for(var i=0,j=r.length-1;i<r.length;j=i++){
      var yi=r[i][0],xi=r[i][1],yj=r[j][0],xj=r[j][1];
      if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)) c=!c;
    }
  }
  return c;
}
function hits(lat,lon){
  var out=[]; if(!DATA||lat==null||lon==null) return out;
  for(var i=0;i<DATA.length;i++){
    var f=DATA[i], b=f.b;
    if(lat<b[0]||lat>b[2]||lon<b[1]||lon>b[3]) continue;
    for(var p=0;p<f.g.length;p++){ if(inPoly(lat,lon,f.g[p])){ out.push(f); break; } }
  }
  return out;
}

/* ---------- κείμενα ---------- */
var LV=[T('Επιτρέπεται','Allowed'),T('Απαγορεύεται','Prohibited'),T('Περιορισμένο','Restricted'),T('Άγνωστο','Unknown')];
function lv(n){ return LV[n==null?3:n]||LV[3]; }
function title(f){
  var n=f.n||'', m=/^(.*?)\s*\(([^)]+)\)\s*$/.exec(n);
  if(m&&/[Ͱ-Ͽ]/.test(m[1])) return EN?m[2]:m[1]; /* ελληνικό όνομα + αγγλική εκδοχή σε παρένθεση */
  return n;
}
function el(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function row(label,val,col){
  var d=el('div','meta'); var b=el('b',null,label+': '); d.appendChild(b); var s=el('span',null,val); if(col) s.style.color=col; d.appendChild(s); return d;
}
function lvCol(n){ return n===1?'#d33':n===2?'#e8861e':n===0?'#2e9e5b':null; }
function mailLink(f){
  var sub='Navigator data correction: '+(f.i||'')+' '+(f.n||'');
  var body='Site: '+(f.n||'')+'\nSite ID: '+(f.i||'')+'\nCountry: '+(f.c||'')+'\n\nWhat looks wrong:\n';
  return 'mailto:'+MAIL+'?subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body);
}
function details(f){
  var d=el('div','pop');
  var h=el('b',null,title(f)); d.appendChild(h);
  d.appendChild(el('div','meta',[f.c,f.d,'LFP '+f.l+'/5'].filter(Boolean).join(' · ')));
  function known(n){ return n===0||n===1||n===2; }
  if(known(f.rf)) d.appendChild(row(T('Ψάρεμα αναψυχής','Recreational fishing'),lv(f.rf),lvCol(f.rf)));
  if(known(f.hl)) d.appendChild(row(T('Καλάμι / πετονιά','Rod & line'),lv(f.hl),lvCol(f.hl)));
  if(known(f.tr)) d.appendChild(row(T('Συρτή','Trolling'),lv(f.tr),lvCol(f.tr)));
  if(known(f.sp)) d.appendChild(row(T('Υποβρύχιο ψάρεμα','Spearfishing'),lv(f.sp),lvCol(f.sp)));
  if(f.an===1||f.an===2) d.appendChild(row(T('Άγκυρα','Anchoring'),lv(f.an),lvCol(f.an)));
  if(f.en===1||f.en===2) d.appendChild(row(T('Είσοδος','Entry'),lv(f.en),lvCol(f.en)));
  if(f.dv===1||f.dv===2) d.appendChild(row(T('Κατάδυση','Diving'),lv(f.dv),lvCol(f.dv)));
  if(f.se&&f.se!=='Year-round') d.appendChild(row(T('Περίοδος','Season'),f.se));
  if(f.re&&FISHTXT.test(f.re)) d.appendChild(el('div','meta',f.re));
  else if(f.pu&&FISHTXT.test(f.pu)) d.appendChild(el('div','meta',f.pu));
  if(f.ma) d.appendChild(el('div','meta',T('Αρχή: ','Authority: ')+f.ma));
  if(f.rn||f.rs){
    var r=el('div','meta',(f.rn||'')+' ');
    if(/^https?:\/\//i.test(f.rs||'')){ var a=el('a',null,T('Κανονισμός','Regulation')); a.href=f.rs; a.target='_blank'; a.rel='noopener'; r.appendChild(a); }
    d.appendChild(r);
  }
  d.appendChild(el('div','note',T('Ενδεικτικά, όχι νομική πληροφορία. Ισχύει ο επίσημος κανονισμός και ο νόμος. Τα όρια είναι απλοποιημένα και οι κανόνες μπορεί να έχουν εποχές ή εξαιρέσεις.','Indicative only, not legal information. The official regulation applies. Boundaries are simplified and rules may have seasons or exceptions.')));
  var row2=el('div','row'); row2.style.marginTop='6px';
  var a2=el('a','btn sm ghost',T('Αναφορά λάθους','Report an error')); a2.href=mailLink(f); row2.appendChild(a2); d.appendChild(row2);
  d.appendChild(el('div','note','ProtectedSeas Navigator · CC BY 4.0 · '+(f.u||'')));
  return d;
}

/* ---------- επίπεδο ---------- */
function build(){
  if(group) return;
  rend=L.canvas({padding:.3});
  group=L.layerGroup();
  DATA.forEach(function(f){
    /* Γέμισμα = επίπεδο προστασίας (LFP) με τα χρώματα του Navigator. Περίγραμμα = τι ισχύει για καλάμι: κόκκινο απαγορεύεται, πορτοκαλί περιορισμοί. */
    var fc=LFPCOL[f.l]||LFPCOL[1], c=f._s?COL[f._s]:fc.o, p=L.polygon(f.g,{renderer:rend,color:c,weight:f._s?2.2:1,opacity:f._s?.95:.6,fillColor:fc.f,fillOpacity:.32,interactive:false});
    p.addTo(group);
  });
}
function show(){ return load().then(function(){ build(); if(!map.hasLayer(group)) group.addTo(map); try{ map.attributionControl.addAttribution(ATTR); }catch(e){} }); }
function hide(){ if(group&&map.hasLayer(group)) map.removeLayer(group); try{ map.attributionControl.removeAttribution(ATTR); }catch(e){} }
function set(v){
  on=!!v; b.setAttribute('aria-pressed',String(on)); C.lsSet(KEY,on);
  if(on) show().catch(function(){ on=false; b.setAttribute('aria-pressed','false'); C.lsSet(KEY,false); try{ C.toast(T('Δεν φορτώθηκαν οι περιοχές. Χρειάζεται ίντερνετ την πρώτη φορά.','Could not load the areas. Internet is needed the first time.')); }catch(e){} });
  else hide();
}

var b=document.createElement('button'); b.type='button'; b.className='mbtn'; b.id='bNav';
b.setAttribute('aria-label',T('Περιορισμοί ψαρέματος (Navigator)','Fishing restrictions (Navigator)'));
b.title=T('Περιορισμοί ψαρέματος: Κύπρος και Ανατολική Μεσόγειος (ProtectedSeas Navigator)','Fishing restrictions: Cyprus and Eastern Mediterranean (ProtectedSeas Navigator)');
b.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>';
var anchor=document.getElementById('bMpa')||bz; anchor.parentNode.insertBefore(b,anchor.nextSibling);
b.addEventListener('click',function(){
  var willOn=!on; set(willOn);
  if(willOn) try{ C.toast(T('Πάτα στον χάρτη για λεπτομέρειες. Γέμισμα: προστασία (κόκκινο πολύ αυστηρή, κίτρινο αυστηρή, γαλάζιο μέτρια). Περίγραμμα: κόκκινο απαγορεύεται το ψάρεμα, πορτοκαλί περιορισμοί.','Tap the map for details. Fill: protection level (red very strict, yellow strict, blue moderate). Outline: red fishing prohibited, orange restricted.')); }catch(e){}
});
b.setAttribute('aria-pressed',String(on));
if(on) set(true);

/* ---------- πληροφορίες στο popup του χάρτη ---------- */
window.AlkyonNavInfo=function(lat,lon,closeFn){
  if(!on||!DATA) return null;
  var hs=hits(lat,lon).filter(function(f){ return true; }); if(!hs.length) return null;
  hs.sort(function(a,c){ return c._s-a._s; });
  var box=el('div','navbox'); box.style.margin='2px 0 6px';
  hs.slice(0,3).forEach(function(f){
    var line=el('div','note'); line.style.color=COL[f._s]; line.style.fontWeight='700';
    line.textContent=(f._s===2?'⛔ ':f._s===1?'⚠ ':'ℹ ')+title(f)+(f._s?' · '+T('ψάρεμα: ','fishing: ')+lv(f.rf):'');
    var more=el('button','btn sm ghost',T('Λεπτομέρειες','Details')); more.type='button'; more.style.marginLeft='6px';
    /* v31z391: οι λεπτομέρειες ανοίγουν μέσα στο ίδιο φύλλο (πριν άνοιγε νέο παράθυρο στον χάρτη, που έκλεινε αμέσως μαζί με το φύλλο) */
    var det=el('div','navdet'); det.hidden=true; det.style.cssText='margin:8px 0 4px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);font-weight:400;color:var(--ink);font-size:13px;line-height:1.45';
    more.setAttribute('aria-expanded','false');
    more.addEventListener('click',function(e){ e.stopPropagation(); var open=det.hidden; if(open&&!det.firstChild){ var c=details(f); if(typeof c==='string') det.innerHTML=c; else det.appendChild(c); } det.hidden=!open; more.textContent=open?T('Απόκρυψη','Hide'):T('Λεπτομέρειες','Details'); more.setAttribute('aria-expanded',String(open)); });
    line.appendChild(more); box.appendChild(line); box.appendChild(det);
  });
  return box;
};

/* ---------- προειδοποίηση εισόδου (μόνο σε έξοδο) ---------- */
var warn=el('div','zonewarn navwarn'); warn.id='navWarn'; warn.hidden=true; warn.setAttribute('role','alert');
var mapbox=document.querySelector('.mapbox'); (mapbox||document.body).appendChild(warn);
function say(f){
  clearTimeout(hideT); warn.textContent='';
  var s=f._s;
  warn.style.background=s===2?'#c0281c':'#b86a10';
  var t=el('div',null,(s===2?'⛔ '+T('Μπήκες σε περιοχή όπου απαγορεύεται το ψάρεμα: ','You entered an area where fishing is prohibited: '):'⚠ '+T('Μπήκες σε περιοχή με περιορισμούς: ','You entered a restricted area: '))+title(f));
  var t2=el('div',null,T('Ψάρεμα αναψυχής: ','Recreational fishing: ')+lv(f.rf)+' · '+T('Καλάμι: ','Rod & line: ')+lv(f.hl)+(f.se&&f.se!=='Year-round'?' · '+f.se:'')+'. '+T('Πάτα για λεπτομέρειες.','Tap for details.'));
  t2.style.fontWeight='500'; t2.style.fontSize='12px';
  warn.appendChild(t); warn.appendChild(t2); warn.hidden=false;
  warn.onclick=function(){ warn.hidden=true; var c=map.getCenter(); L.popup({minWidth:200,maxWidth:300,maxHeight:Math.max(180,Math.round(window.innerHeight*.48)),className:'navpopw',autoPanPaddingTopLeft:[10,130],autoPanPaddingBottomRight:[84,110]}).setLatLng(f._ll||c).setContent(details(f)).openOn(map); };
  hideT=setTimeout(function(){ warn.hidden=true; },25000);
  try{ if(navigator.vibrate) navigator.vibrate(s===2?[250,120,250,120,250]:[150]); }catch(e){}
}
function onPos(lat,lon){
  if(!document.body.classList.contains('ontrip')){ inside={}; firstFix=true; return; }
  load().then(function(){
    var hs=hits(lat,lon).filter(function(f){ return f._s>0; }), now=Date.now(), cur={}, worst=null;
    hs.forEach(function(f){
      cur[f.i+'|'+f.n]=1;
      var key=f.i+'|'+f.n;
      if(!inside[key]&&(!lastAlert[key]||now-lastAlert[key]>20*60000)){ lastAlert[key]=now; f._ll=[lat,lon]; if(!worst||f._s>worst._s) worst=f; }
    });
    inside=cur; firstFix=false;
    if(worst) say(worst);
  }).catch(function(){});
}
window.addEventListener('alkyon-pos',function(e){ var d=e&&e.detail; if(d) onPos(d.lat,d.lon); });
window.AlkyonNav={hits:hits,load:load,on:function(){ return on; },data:function(){ return DATA; }};
})();
