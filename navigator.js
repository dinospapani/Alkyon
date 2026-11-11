/* Περιορισμοί ψαρέματος και προστατευόμενες περιοχές (Κύπρος και Ανατολική Μεσόγειος· από 1.11.3 και ο υπόλοιπος κόσμος, nav/).
   Δεδομένα: ProtectedSeas Navigator, άδεια CC BY 4.0, βάσει έργου στο https://map.navigatormap.org/ (εξαγωγή 27/08/2026).
   Ενδεικτικά δεδομένα, όχι νομική πληροφορία: ισχύει ο επίσημος κανονισμός. Τα όρια είναι απλοποιημένα. */
(function(){
'use strict';
var C=window.AlkyonCore, bz=document.getElementById('bZones'), map=C&&C.map&&C.map();
if(!C||!bz||!map||typeof L==='undefined') return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-nav', FILE='navigator-mpa.json', MAIL='support@protectedseas.net';
var ATTR='Protected areas: <a href="https://map.navigatormap.org/" target="_blank" rel="noopener">ProtectedSeas Navigator</a> (CC BY 4.0)';
var DATA=null, group=null, rend=null, on=!!C.lsGet(KEY,false), inside={}, lastAlert={}, hideT=null, firstFix=true;

/* ---------- δεδομένα ---------- */
/* 1.11.3: Ανατολική Μεσόγειος από το navigator-mpa.json (όλα τα επίπεδα)· ο υπόλοιπος κόσμος από κομμάτια 10°×10° (nav/, μόνο πολύ αυστηρή
   και πλήρης προστασία), που κατεβαίνουν μόνο εκεί όπου κοιτάς ή βρίσκεσαι. Κάθε περιοχή (ps_id) κρατιέται μία φορά. */
var SEEN={}, medP=null;
function inMed(lat,lon){ return lat==null||(lat>27&&lat<43&&lon>9&&lon<37.5); }
function add(list){ var fresh=[]; (list||[]).forEach(function(f){ if(!f||SEEN[f.i]||!relevant(f)) return; SEEN[f.i]=1; if(f._s==null) f._s=sev(f); DATA.push(f); fresh.push(f); }); if(fresh.length&&group) draw(fresh); return fresh; }
function loadMed(){
  if(medP) return medP;
  medP=fetch((window.ALKYON_BASE||'')+FILE).then(function(r){ if(!r.ok) throw new Error('http'); return r.json(); }).then(function(j){ add((j&&j.f)||[]); return DATA; })
    .catch(function(e){ medP=null; throw e; });
  return medP;
}
function center(){ try{ var c=map.getCenter(); return [c.lat,c.lng]; }catch(e){ return [null,null]; } }
function load(lat,lon){
  if(!DATA) DATA=[];
  if(lat==null){ var c=center(); lat=c[0]; lon=c[1]; }
  var A=window.AK, jobs=[];
  if(inMed(lat,lon)) jobs.push(loadMed());
  if(A&&A.navTiles&&lat!=null) jobs.push(A.navTiles(lat,lon,0.5).then(add).catch(function(){}));
  if(!jobs.length) return Promise.resolve(DATA);
  return Promise.all(jobs).then(function(){ return DATA; });
}
/* Κρατάμε μόνο ό,τι αφορά ψάρεμα ή άγκυρα (περιοχές μόνο για πουλιά, δάση ή χωρίς κανέναν περιορισμό για ψάρεμα δεν χρειάζονται). */
function relevant(f){
  /* 1.11.4: περιοχές σχεδόν όλες στη στεριά (κάτω από 5% θάλασσα, π.χ. κυνηγετικές ζώνες, δάση, αλυκές) δεν αφορούν το ψάρεμα στη θάλασσα, εκτός αν απαγορεύουν το ψάρεμα */
  if(typeof f.pm==='number'&&f.pm<5&&sev(f)<2) return false;
  /* 1.11.4: μόνο ό,τι αλλάζει κάτι για τον ψαρά: περιορισμός ή απαγόρευση σε ψάρεμα, καλάμι, συρτή, ψαροντούφεκο ή άγκυρα */
  return sev(f)>0||f.sp===1||f.sp===2||f.an===1||f.an===2;
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
/* 1.12.8: ακριβώς τα χρώματα του υπομνήματος του Navigator (map.navigatormap.org): περίγραμμα και γέμισμα στο ίδιο χρώμα ανά LFP */
var LFPCOL={5:{f:'#ed7173',o:'#ed7173'},4:{f:'#f7de5f',o:'#e8c832'},3:{f:'#90bece',o:'#6fa8bd'},2:{f:'#707070',o:'#707070'},1:{f:'#707070',o:'#707070'}};
var LFPNAME={5:T('Πλήρης προστασία (απαγορεύεται κάθε αλίευση)','Most restrictive (no-take)'),4:T('Πολύ αυστηρή προστασία','Heavily restrictive'),3:T('Μέτρια προστασία','Moderately restrictive'),2:T('Λίγη προστασία','Less restrictive'),1:T('Ελάχιστη προστασία','Least restrictive')};
function lfpCol(l){ return (LFPCOL[l]||LFPCOL[1]).o; }

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
  var lf=el('div','meta'); var sw=el('span'); sw.style.cssText='display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px;background:'+lfpCol(f.l); lf.appendChild(sw); lf.appendChild(document.createTextNode('LFP '+f.l+' · '+(LFPNAME[f.l]||''))); d.appendChild(lf);
  d.appendChild(el('div','meta',[f.c,f.d].filter(Boolean).join(' · ')));
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
function draw(list){
  list.slice().sort(function(a,c){ return (a.l||0)-(c.l||0); }).forEach(function(f){
    /* 1.12.8: όπως στο Navigator: περίγραμμα και γέμισμα με το χρώμα του επιπέδου προστασίας (LFP). Τι ισχύει για καλάμι φαίνεται με πάτημα. */
    var fc=LFPCOL[f.l]||LFPCOL[1], hi=f.l>=4, p=L.polygon(f.g,{renderer:rend,color:fc.o,weight:hi?2.2:1.4,opacity:.95,fillColor:fc.f,fillOpacity:hi?.42:.26,interactive:false});
    p.addTo(group);
  });
}
function build(){
  if(group) return;
  rend=L.canvas({padding:.3});
  group=L.layerGroup();
  draw(DATA);
}
map.on('moveend',function(){ if(on) load().catch(function(){}); });
function show(){ return load().then(function(){ build(); if(!map.hasLayer(group)) group.addTo(map); try{ map.attributionControl.addAttribution(ATTR); }catch(e){} }); }
function hide(){ if(group&&map.hasLayer(group)) map.removeLayer(group); try{ map.attributionControl.removeAttribution(ATTR); }catch(e){} }
function set(v){
  on=!!v; b.setAttribute('aria-pressed',String(on)); C.lsSet(KEY,on);
  if(on) show().catch(function(){ on=false; b.setAttribute('aria-pressed','false'); C.lsSet(KEY,false); try{ C.toast(T('Δεν φορτώθηκαν οι περιοχές. Χρειάζεται ίντερνετ την πρώτη φορά.','Could not load the areas. Internet is needed the first time.')); }catch(e){} });
  else hide();
}

var b=document.createElement('button'); b.type='button'; b.className='mbtn'; b.id='bNav';
b.setAttribute('aria-label',T('Περιορισμοί ψαρέματος (Navigator)','Fishing restrictions (Navigator)'));
b.title=T('Περιορισμοί ψαρέματος (ProtectedSeas Navigator)','Fishing restrictions (ProtectedSeas Navigator)');
b.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>';
var anchor=document.getElementById('bMpa')||bz; anchor.parentNode.insertBefore(b,anchor.nextSibling);
b.addEventListener('click',function(){
  var willOn=!on; set(willOn);
  if(willOn) try{ C.toast(T('Πάτα σε μια περιοχή για λεπτομέρειες. Κόκκινο: πλήρης προστασία · κίτρινο: πολύ αυστηρή · γαλάζιο: μέτρια · γκρι: λίγη.','Tap an area for details. Red: no-take · yellow: heavily restrictive · blue: moderate · grey: less restrictive.'),7000); }catch(e){}
});
b.setAttribute('aria-pressed',String(on));
if(on) set(true);

function known3(n){ return n===0||n===1||n===2; }
/* ---------- πληροφορίες στο popup του χάρτη ---------- */
window.AlkyonNavInfo=function(lat,lon,closeFn){
  if(!on||!DATA) return null;
  var hs=hits(lat,lon).filter(function(f){ return true; }); if(!hs.length) return null;
  hs.sort(function(a,c){ return (c.l||0)-(a.l||0)||c._s-a._s; });
  var box=el('div','navbox'); box.style.margin='2px 0 6px';
  /* 1.12.8: στην Κύπρο πρώτα το επίσημο κείμενο του Τμήματος Αλιείας (Cy-FIS), με την ΚΔΠ */
  (window.ZONES||[]).forEach(function(z){ if(z.p&&inPoly(lat,lon,z.p)){ var o=el('div','note'); o.style.cssText='margin:4px 0 8px;padding:8px 10px;border-radius:10px;background:rgba(237,113,115,.14);border-left:5px solid #ed7173;font-size:13px;line-height:1.4';
    var bb=el('b',null,z.n); o.appendChild(bb); o.appendChild(el('div',null,z.d||'')); var sm=el('small',null,T('Τμήμα Αλιείας (Cy-FIS)','Department of Fisheries (Cy-FIS)')); sm.style.opacity='.75'; o.appendChild(sm); box.appendChild(o); } });
  hs.slice(0,3).forEach(function(f){
    var line=el('div','note navln'); line.style.fontWeight='700'; line.style.borderLeft='5px solid '+lfpCol(f.l); line.style.paddingLeft='8px'; line.style.margin='6px 0';
    line.appendChild(document.createTextNode(title(f)));
    var sub=el('div',null,'LFP '+f.l+' · '+(LFPNAME[f.l]||'')+(known3(f.rf)?' · '+T('ψάρεμα αναψυχής: ','recreational fishing: ')+lv(f.rf):''));
    sub.style.cssText='font-weight:500;font-size:12.5px;color:var(--ink-2)'; line.appendChild(sub);
    var more=el('button','btn sm ghost',T('Λεπτομέρειες','Details')); more.type='button'; more.style.marginLeft='6px';
    /* v31z391: οι λεπτομέρειες ανοίγουν μέσα στο ίδιο φύλλο (πριν άνοιγε νέο παράθυρο στον χάρτη, που έκλεινε αμέσως μαζί με το φύλλο) */
    var det=el('div','navdet'); det.hidden=true; det.style.cssText='margin:8px 0 4px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);font-weight:400;color:var(--ink);font-size:13px;line-height:1.45';
    more.setAttribute('aria-expanded','false');
    more.addEventListener('click',function(e){ e.stopPropagation(); var open=det.hidden; if(open&&!det.firstChild){ var c=details(f); if(typeof c==='string') det.innerHTML=c; else det.appendChild(c); } det.hidden=!open; more.textContent=open?T('Απόκρυψη','Hide'):T('Λεπτομέρειες','Details'); more.setAttribute('aria-expanded',String(open)); });
    line.appendChild(more); box.appendChild(line); box.appendChild(det);
  });
  return box;
};

/* 1.11.4: πάτημα πάνω σε περιοχή (με τα «Περιορισμοί» ανοιχτά) → φύλλο με το τι είναι και τι ισχύει. Πριν φαινόταν μόνο με παρατεταμένο πάτημα σε παλιά έκδοση. */
var LEGEND=T('Χρώματα όπως στο ProtectedSeas Navigator: κόκκινο = πλήρης προστασία (LFP 5, απαγορεύεται κάθε αλίευση), κίτρινο = πολύ αυστηρή (LFP 4), γαλάζιο = μέτρια (LFP 3), γκρι = λίγη (LFP 1–2). Τι ισχύει για το καλάμι, στις Λεπτομέρειες.','Colours as in ProtectedSeas Navigator: red = most restrictive (LFP 5, no-take), yellow = heavily restrictive (LFP 4), blue = moderately restrictive (LFP 3), grey = less restrictive (LFP 1–2). What applies to rod fishing is under Details.');
/* 1.12.8: σημάδι στο σημείο που πάτησες, στο χρώμα της αυστηρότερης περιοχής (όπως η καρφίτσα του Navigator, αλλά χρωματιστή) */
var tapPin=null;
function pinAt(lat,lon,col){ if(tapPin){ try{ map.removeLayer(tapPin); }catch(e){} tapPin=null; } if(!col) return;
  tapPin=L.marker([lat,lon],{interactive:false,keyboard:false,zIndexOffset:900,icon:L.divIcon({className:'navpin',iconSize:[30,40],iconAnchor:[15,38],
    html:'<svg viewBox="0 0 30 40" width="30" height="40"><path d="M15 39C15 39 28 24 28 14A13 13 0 0 0 2 14C2 24 15 39 15 39Z" fill="'+col+'" stroke="#1d1d1d" stroke-opacity=".55" stroke-width="1.5"/><circle cx="15" cy="14" r="5" fill="#fff" fill-opacity=".9"/></svg>'})}).addTo(map); }
function tapSheet(lat,lon){
  var box=window.AlkyonNavInfo(lat,lon); if(!box) return false;
  var top=hits(lat,lon).sort(function(a,c){ return (c.l||0)-(a.l||0); })[0]; pinAt(lat,lon,top?lfpCol(top.l):null);
  var A=window.AK; box.appendChild(el('p','note',LEGEND));
  if(A&&A.sheet) A.sheet({title:T('Προστατευμένη περιοχή','Protected area'),body:box,onclose:function(){ pinAt(); }});
  else L.popup({maxWidth:300}).setLatLng([lat,lon]).setContent(box).openOn(map);
  return true;
}
map.on('click',function(e){ if(!on||!DATA||!e||!e.latlng) return; tapSheet(e.latlng.lat,e.latlng.lng); });

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
  load(lat,lon).then(function(){
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
window.AlkyonNav={hits:hits,load:load,tap:tapSheet,on:function(){ return on; },data:function(){ return DATA; }};
})();
