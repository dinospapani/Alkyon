/* Εργαλεία: παραγάδια, δίχτυα, ζεμπίλια/παγίδες. Πολλά ταυτόχρονα στη θάλασσα.
   Ρίψη (διαδρομή από-έως) → «Στη θάλασσα» → Ανέβασμα (διαδρομή). Τα ψάρια που καταγράφονται στο ανέβασμα
   μαρκάρονται στη θέση τους και συνδέονται με το εργαλείο (bite.gear). Οι εγγραφές εργαλείων μένουν στη συσκευή και
   όταν ολοκληρωθούν μπαίνουν σύνοψη μέσα στην έξοδο (trip.gear), που συγχρονίζεται. Η νομιμότητα του εργαλείου είναι δική σου ευθύνη. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var $=function(i){ return document.getElementById(i); };
var KEY='alkyon-gear';
var TYPES={ll:{el:'Παραγάδι',en:'Longline',pt:false,c:'#3aa0ff'},net:{el:'Δίχτυ',en:'Net',pt:false,c:'#35c9a7'},trap:{el:'Ζεμπίλι / παγίδα',en:'Trap / pot',pt:true,c:'#b98cff'}};
function tn(t){ var x=TYPES[t]||TYPES.net; return EN?x.en:x.el; }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function btn(t,cls,fn){ var b=el('button','spb '+(cls||''),t); b.type='button'; b.addEventListener('click',fn); return b; }
function load(){ var g=C.lsGet(KEY,null); if(!g||!Array.isArray(g.items)) g={items:[],seq:{}}; if(!g.seq) g.seq={}; return g; }
var G=load();
function save(){ try{ C.lsSet(KEY,G); }catch(e){} try{ if(typeof renderLog==='function') renderLog(); }catch(e){} }
function R(x){ return Math.round(x*1e5)/1e5; }
function dist(a,b){ var r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)*Math.sin(dn/2); return 12742000*Math.asin(Math.min(1,Math.sqrt(x))); }
function len(pts){ var m=0; for(var i=1;i<pts.length;i++) m+=dist(pts[i-1],pts[i]); return m; }
function hm(ms){ var m=Math.max(0,Math.round(ms/60000)),h=Math.floor(m/60); return h?h+T('ω ','h ')+('0'+(m%60)).slice(-2)+T('λ','m'):m+T('λ','m'); }
function clock(ms){ var d=new Date(ms); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
function nm(it){ return it.name||tn(it.type); }
function active(){ return G.items.find(function(i){ return i.state==='setting'||i.state==='hauling'; })||null; }
function fishOf(it){ var n=0,kg=0; (C.Store.get('bites')||[]).forEach(function(b){ if(b.gear===it.id){ n+=C.bc(b); kg+=b.rel?0:(+b.kg||0); } }); return {n:n,kg:Math.round(kg*10)/10}; }

/* ---------- θέση ---------- */
function here(){
  return new Promise(function(res){
    var fx=window.AlkyonTrack&&window.AlkyonTrack.fix&&window.AlkyonTrack.fix();
    if(fx&&Date.now()-fx.t<60000){ res([R(fx.lat),R(fx.lon)]); return; }
    if(!navigator.geolocation){ res(null); return; }
    navigator.geolocation.getCurrentPosition(function(p){ res([R(p.coords.latitude),R(p.coords.longitude)]); },function(){ res(null); },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
  });
}
var wid=null, wl=null;
/* v31z6: η οθόνη μένει αναμμένη όσο τρέχει ρίψη ή ανέβασμα (ο browser σταματά το GPS όταν σβήνει η οθόνη) */
function unwake(){ if(wl){ try{ wl.release(); }catch(e){} wl=null; } }
function wake(){
  if(!active()){ unwake(); return; }
  if(wl||!navigator.wakeLock||document.hidden) return;
  try{ navigator.wakeLock.request('screen').then(function(l){ wl=l; l.addEventListener('release',function(){ wl=null; }); }).catch(function(){ wl=null; }); }catch(e){ wl=null; }
}
function watch(){
  wake();
  var it=active(); if(!it){ if(wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } return; }
  if(wid!=null||!navigator.geolocation) return;
  try{ wid=navigator.geolocation.watchPosition(function(p){
    var a=active(); if(!a) return; var c=p.coords; if(c.accuracy&&c.accuracy>60) return;
    var ph=a.state==='setting'?a.set:a.haul, pt=[R(c.latitude),R(c.longitude)], last=ph.pts[ph.pts.length-1];
    if(last){ var d=dist(last,pt); if(d<10||(d>3000&&Date.now()-(ph.lastT||0)<20000)) return; }
    ph.pts.push(pt); ph.lastT=Date.now(); if(ph.pts.length>1500) ph.pts=ph.pts.filter(function(_,i){ return i%2===0; });
    save(); draw(); if(!P.hidden) render();
  },function(){},{enableHighAccuracy:true,maximumAge:5000,timeout:30000}); }catch(e){ wid=null; }
}
function stopWatchIfIdle(){ if(!active()) unwake(); if(!active()&&wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } }

/* ---------- ενέργειες ---------- */
function startSet(type){
  if(active()){ C.toast(T('Τελείωσε πρώτα την τρέχουσα ρίψη ή ανέβασμα.','Finish the current set or haul first.')); return; }
  here().then(function(p){
    if(!p){ C.toast(T('Δεν βρέθηκε θέση GPS. Δοκίμασε ξανά.','No GPS fix. Try again.')); return; }
    G.seq[type]=(G.seq[type]||0)+1;
    var it={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),type:type,name:tn(type)+' '+G.seq[type],state:TYPES[type].pt?'out':'setting',set:{a:p,ta:Date.now(),pts:[p],b:TYPES[type].pt?p:null,tb:TYPES[type].pt?Date.now():null},haul:null};
    G.items.push(it); save(); watch(); draw(); render();
    C.toast(T('Ρίψη: '+nm(it),'Set: '+nm(it)));
  });
}
function startHaulNew(type){
  if(active()){ C.toast(T('Τελείωσε πρώτα την τρέχουσα ρίψη ή ανέβασμα.','Finish the current set or haul first.')); return; }
  here().then(function(p){
    if(!p){ C.toast(T('Δεν βρέθηκε θέση GPS. Δοκίμασε ξανά.','No GPS fix. Try again.')); return; }
    G.seq[type]=(G.seq[type]||0)+1;
    var it={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),type:type,name:tn(type)+' '+G.seq[type],state:'hauling',set:{a:null,ta:null,pts:[],b:null,tb:null,unknown:true},haul:{a:p,ta:Date.now(),pts:[p],b:null,tb:null}};
    G.items.push(it); save(); watch(); draw(); render();
    C.toast(T('Ανέβασμα: '+nm(it)+'. Τα ψάρια που καταγράφεις θα μαρκάρονται εδώ.','Hauling: '+nm(it)+'. Fish you log are marked here.'));
  });
}
function endSet(it){
  here().then(function(p){
    var pts=it.set.pts; if(p){ var l=pts[pts.length-1]; if(!l||dist(l,p)>3) pts.push(p); it.set.b=p; } else it.set.b=pts[pts.length-1]||it.set.a;
    it.set.tb=Date.now(); it.state='out'; save(); stopWatchIfIdle(); watch(); draw(); render();
    C.toast(T('Τέλος ρίψης: '+nm(it),'Set finished: '+nm(it)));
  });
}
function startHaul(it){
  if(active()){ C.toast(T('Τελείωσε πρώτα την τρέχουσα ρίψη ή ανέβασμα.','Finish the current set or haul first.')); return; }
  here().then(function(p){
    if(!p){ C.toast(T('Δεν βρέθηκε θέση GPS. Δοκίμασε ξανά.','No GPS fix. Try again.')); return; }
    it.haul={a:p,ta:Date.now(),pts:[p],b:null,tb:null}; it.state='hauling'; save(); watch(); draw(); render();
    C.toast(T('Ανέβασμα: '+nm(it)+'. Τα ψάρια που καταγράφεις θα μαρκάρονται εδώ.','Hauling: '+nm(it)+'. Fish you log are marked here.'));
  });
}
function endHaul(it){
  here().then(function(p){
    var pts=it.haul.pts; if(p){ var l=pts[pts.length-1]; if(!l||dist(l,p)>3) pts.push(p); it.haul.b=p; } else it.haul.b=pts[pts.length-1]||it.haul.a;
    it.haul.tb=Date.now(); it.state='done'; it.done=Date.now(); save(); stopWatchIfIdle(); draw(); render();
    var f=fishOf(it); C.toast(nm(it)+': '+f.n+T(f.n===1?' ψάρι':' ψάρια',f.n===1?' fish':' fish')+(f.kg?' · '+f.kg+' kg':''));
    attachDone();
  });
}
function remove(it){
  window.AlkyonAsk(nm(it),{title:T('Διαγραφή εργαλείου','Delete gear'),ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel'),danger:true}).then(function(ok){
    if(!ok) return; G.items=G.items.filter(function(x){ return x!==it&&x.id!==it.id; }); save(); stopWatchIfIdle(); draw(); render();
  });
}
function rename(it){
  window.AlkyonAsk.prompt(T('Όνομα εργαλείου','Gear name'),{title:T('Μετονομασία','Rename'),value:nm(it),ok:T('Αποθήκευση','Save'),cancel:T('Άκυρο','Cancel')}).then(function(v){
    if(v&&String(v).trim()){ it.name=String(v).trim().slice(0,40); save(); draw(); render(); }
  });
}

/* ---------- σήμανση ψαριών (καλείται από το app.js στο tripStamp) ---------- */
function tag(rec){
  var it=G.items.find(function(i){ return i.state==='hauling'; }); if(!it||rec.miss) return rec;
  rec.gear=it.id; rec.gearName=nm(it); if(!rec.tech) rec.tech=tn(it.type);
  return rec;
}

/* ---------- χάρτης ---------- */
var layer=null;
function line(ll,color,dash){ return L.polyline(ll,{color:color,weight:4,opacity:.9,dashArray:dash||null}); }
function dot(p,fill,lbl){ var m=L.circleMarker(p,{radius:7,color:'#fff',weight:2,fillColor:fill,fillOpacity:1}); if(lbl) m.bindTooltip(lbl,{direction:'top'}); return m; }
function layersFor(it){
  var out=[], c=(TYPES[it.type]||TYPES.net).c, s=it.set||{}, h=it.haul;
  if(s.pts&&s.pts.length>1) out.push(line(s.pts,c));
  if(s.a) out.push(dot(s.a,'#2e9e5b',nm(it)+' · '+T('ρίψη ','set ')+(s.ta?clock(s.ta):'')));
  if(s.b&&(!s.a||s.b[0]!==s.a[0]||s.b[1]!==s.a[1])) out.push(dot(s.b,'#d33',nm(it)+' · '+T('τέλος ρίψης','end of set')));
  if(h){ if(h.pts&&h.pts.length>1) out.push(line(h.pts,'#ffd23a','8 8')); if(h.a) out.push(dot(h.a,'#ffd23a',nm(it)+' · '+T('ανέβασμα ','haul ')+clock(h.ta))); }
  return out;
}
function draw(){
  var map=C.map&&C.map(); if(!map||typeof L==='undefined') return;
  if(!layer) layer=L.layerGroup().addTo(map); else { layer.clearLayers(); if(!map.hasLayer(layer)) layer.addTo(map); }
  G.items.forEach(function(it){ if(it.state!=='done') layersFor(it).forEach(function(l){ l.addTo(layer); }); });
  updateBtn();
}
var shown=null;
function showItems(list,fit){
  C.switchTab('map');
  setTimeout(function(){
    var map=C.map&&C.map(); if(!map) return; if(shown){ try{ map.removeLayer(shown); }catch(e){} }
    var ls=[], fp=[]; list.forEach(function(it){ ls=ls.concat(layersFor(it));
      (C.Store.get('bites')||[]).forEach(function(b){ if(it.id&&b.gear===it.id&&typeof b.lat==='number'&&typeof b.lon==='number'){
        var m=L.marker([b.lat,b.lon],{icon:L.divIcon({className:'',html:'<div class="mk-fish'+(b.photo?' ph':'')+'">🐟</div>',iconSize:[30,30]}),title:b.species||''});
        m.bindTooltip((b.species||T('Ψάρι','Fish'))+(b.kg?' · '+b.kg+' kg':'')+(b.time?' · '+b.time:''),{direction:'top'}); ls.push(m); fp.push([b.lat,b.lon]); } }); });
    if(!ls.length) return;
    shown=L.layerGroup(ls).addTo(map); var pts=fp.slice(); list.forEach(function(it){ [it.set&&it.set.pts,it.haul&&it.haul.pts].forEach(function(a){ if(a) pts=pts.concat(a); }); });
    if(fit!==false&&pts.length) map.fitBounds(L.latLngBounds(pts),{padding:[50,50],maxZoom:16});
  },250);
}
function hideShown(){ var map=C.map&&C.map(); if(shown&&map){ try{ map.removeLayer(shown); }catch(e){} } shown=null; }

/* ---------- κουμπί στον χάρτη ---------- */
var gb=null;
function updateBtn(){
  if(!gb) return; var n=G.items.filter(function(i){ return i.state!=='done'; }).length, a=active();
  gb.classList.toggle('on',!!a); var b=gb.querySelector('.gbadge'); b.textContent=String(n); b.hidden=!n;
}
(function(){
  var host=$('bQuick'); if(!host) return;
  gb=el('button','mbtn'); gb.id='bGear'; gb.type='button'; gb.title=T('Εργαλεία: παραγάδι, δίχτυ, ζεμπίλι','Gear: longline, net, pot'); gb.setAttribute('aria-label',gb.title);
  gb.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/></svg><span class="gbadge" hidden>0</span>';
  host.parentNode.insertBefore(gb,host); gb.addEventListener('click',function(){ openPanel(); });
})();

/* ---------- πίνακας ---------- */
var P=el('div'); P.id='gearPanel'; P.hidden=true; P.innerHTML='<div class="spcard"><div class="sphead"><b></b><button type="button" class="spx" aria-label="✕">✕</button></div><div class="spbody"></div></div>';
P.querySelector('b').textContent=T('Εργαλεία','Gear'); document.body.appendChild(P);
var body=P.querySelector('.spbody');
P.querySelector('.spx').addEventListener('click',function(){ P.hidden=true; }); P.addEventListener('click',function(e){ if(e.target===P) P.hidden=true; });
function openPanel(){ render(); P.hidden=false; }
function sec(t){ body.append(el('div','spsec',t)); }
function render(){
  body.replaceChildren(); var a=active();
  body.append(el('div','sptx gwarn',T('Δίχτυα και παραγάδια είναι συνήθως εργαλεία επαγγελματικής αλιείας. Η καταγραφή δεν νομιμοποιεί το εργαλείο: έλεγξε την άδειά σου.','Nets and longlines are usually professional-fishing gear. Logging does not make the gear legal: check your licence.')));
  if(a){
    var box=el('div','gact'), f=fishOf(a), ph=a.state==='setting'?a.set:a.haul;
    box.append(el('b','',(a.state==='setting'?T('Ρίχνεις: ','Setting: '):T('Ανεβάζεις: ','Hauling: '))+nm(a)));
    box.append(el('div','sptx',T('Διαδρομή ','Route ')+(Math.round(len(ph.pts)/10)/100)+' km · '+hm(Date.now()-(ph.ta||Date.now()))+(a.state==='hauling'?' · '+f.n+T(f.n===1?' ψάρι':' ψάρια',f.n===1?' fish':' fish')+(f.kg?' · '+f.kg+' kg':''):'')));
    if(a.state==='hauling') box.append(el('div','sptx',T('Καταγράφεις τα ψάρια με το πράσινο κουμπί στον χάρτη και μαρκάρονται εδώ.','Log fish with the green button on the map; they are marked here.')));
    box.append(el('div','sptx',T('Η οθόνη μένει αναμμένη για να συνεχίσει το GPS. Μην κλείσεις την εφαρμογή.','The screen stays on so GPS keeps running. Do not close the app.')));
    box.append(btn(a.state==='setting'?T('Τέλος ρίψης','End set'):T('Τέλος ανεβάσματος','End haul'),'acc',function(){ a.state==='setting'?endSet(a):endHaul(a); }));
    body.append(box);
  } else {
    sec(T('Νέα ρίψη','New set'));
    var row=el('div','sprow wrap'); Object.keys(TYPES).forEach(function(k){ row.append(btn(tn(k),'acc',function(){ startSet(k); })); }); body.append(row);
    body.append(el('div','sptx',T('Η ρίψη καταγράφει από πού ξεκινάς και τη διαδρομή μέχρι το «Τέλος ρίψης». Για ζεμπίλι αρκεί ένα πάτημα στο σημείο.','A set records where you start and the route until “End set”. For a pot one tap marks the spot.')));
    sec(T('Το εργαλείο είναι ήδη στη θάλασσα','Gear already at sea'));
    var row2=el('div','sprow wrap'); Object.keys(TYPES).forEach(function(k){ row2.append(btn(T('Ανέβασμα: ','Haul: ')+tn(k),'',function(){ startHaulNew(k); })); }); body.append(row2);
    body.append(el('div','sptx',T('Αν δεν κατέγραψες τη ρίψη, ξεκίνα κατευθείαν το ανέβασμα. Η θέση και η διαδρομή θα καταγράφονται από τώρα.','If you did not record the set, start the haul directly. Position and route are recorded from now on.')));
  }
  body.append(el('div','sptx',T('Πορεία από άλλη εφαρμογή (GPX): πάτα «GPX ρίψης» ή «GPX ανεβ.» στο εργαλείο και διάλεξε το αρχείο.','Track from another app (GPX): tap “GPX set” or “GPX haul” on the gear and pick the file.')));
  var out=G.items.filter(function(i){ return i.state==='out'||(i.state==='setting'&&i!==a)||(i.state==='hauling'&&i!==a); });
  sec(T('Στη θάλασσα ','At sea ')+'('+out.length+')');
  if(!out.length) body.append(el('div','sptx',T('Κανένα εργαλείο.','No gear.')));
  out.forEach(function(it){
    var r=el('div','sprow wrap'), x=el('div','sptx'); x.append(el('b','',nm(it)),el('span','',it.set.ta?T('Ρίχτηκε ','Set ')+clock(it.set.ta)+' · '+hm(Date.now()-it.set.ta):T('Ρίψη χωρίς καταγραφή','Set not recorded')));
    r.append(x);
    if(it.state==='out') r.append(btn(T('Ανέβασμα','Haul'),'acc',function(){ startHaul(it); }));
    r.append(btn(T('Χάρτης','Map'),'',function(){ P.hidden=true; showItems([it]); }),btn('GPX '+T('ρίψης','set'),'',function(){ pickGpx(it,'set'); }),btn('✎','',function(){ rename(it); }),btn('✕','danger',function(){ remove(it); }));
    body.append(r);
  });
  var done=G.items.filter(function(i){ return i.state==='done'; }).sort(function(p,q){ return (q.done||0)-(p.done||0); }).slice(0,12);
  if(done.length){ sec(T('Ολοκληρωμένα','Completed'));
    done.forEach(function(it){ var f=fishOf(it), r=el('div','sprow wrap'), x=el('div','sptx'); x.append(el('b','',nm(it)),el('span','',f.n+T(f.n===1?' ψάρι':' ψάρια',f.n===1?' fish':' fish')+(f.kg?' · '+f.kg+' kg':'')+(it.set.ta&&it.haul?' · '+T('μέσα ','soaked ')+hm(it.haul.ta-it.set.ta):'')));
      r.append(x,btn(T('Χάρτης','Map'),'',function(){ P.hidden=true; showItems([it]); }),btn('GPX '+T('ρίψης','set'),'',function(){ pickGpx(it,'set'); }),btn('GPX '+T('ανεβ.','haul'),'',function(){ pickGpx(it,'haul'); }),btn('✕','danger',function(){ remove(it); })); body.append(r); });
  }
}

/* ---------- εισαγωγή πορείας από GPX (άλλη εφαρμογή που καταγράφει στο παρασκήνιο) ---------- */
function parseGpx(txt){
  var doc=new DOMParser().parseFromString(txt,'application/xml'); if(doc.getElementsByTagName('parsererror').length) return null;
  var els=doc.getElementsByTagName('trkpt'); if(!els.length) els=doc.getElementsByTagName('rtept'); if(!els.length) els=doc.getElementsByTagName('wpt');
  var pts=[], t0=null, t1=null;
  for(var i=0;i<els.length;i++){
    var la=parseFloat(els[i].getAttribute('lat')), lo=parseFloat(els[i].getAttribute('lon')); if(!isFinite(la)||!isFinite(lo)) continue;
    pts.push([R(la),R(lo)]);
    var te=els[i].getElementsByTagName('time')[0]; if(te){ var ms=Date.parse(te.textContent); if(isFinite(ms)){ if(t0==null||ms<t0) t0=ms; if(t1==null||ms>t1) t1=ms; } }
  }
  return pts.length>=2?{pts:pts,t0:t0,t1:t1}:null;
}
function thinTo(pts,n){ if(pts.length<=n) return pts; var k=Math.ceil(pts.length/n), o=pts.filter(function(_,i){ return i%k===0; }), l=pts[pts.length-1]; if(o[o.length-1]!==l) o.push(l); return o; }
function applyTrack(it,phase,g){
  var pts=thinTo(g.pts,1500), old=it[phase]||{};
  var ph={a:pts[0],ta:g.t0||old.ta||null,pts:pts,b:pts[pts.length-1],tb:g.t1||old.tb||null};
  if(phase==='set'){ it.set=ph; } else { it.haul=ph; if(it.state==='out') it.state='out'; }
  save(); draw(); render();
  C.toast(T('Εισήχθη πορεία: ','Track imported: ')+pts.length+T(' σημεία · ',' points · ')+(Math.round(len(pts)/10)/100)+' km');
}
var gfile=document.createElement('input'); gfile.type='file'; gfile.hidden=true; document.body.appendChild(gfile);
var gTarget=null;
gfile.addEventListener('change',function(){
  var f=gfile.files&&gfile.files[0], tg=gTarget; gfile.value=''; if(!f||!tg) return;
  f.text().then(function(t){ var g=parseGpx(t); if(!g){ C.toast(T('Το αρχείο δεν έχει πορεία GPX με σημεία.','The file has no GPX track with points.')); return; } applyTrack(tg.it,tg.phase,g); }).catch(function(){ C.toast(T('Δεν διαβάστηκε το αρχείο.','Could not read the file.')); });
});
function pickGpx(it,phase){ gTarget={it:it,phase:phase}; gfile.click(); }

/* ---------- τμήμα «Εργαλεία» στο Log ---------- */
var seg=$('logSeg'), lbox=null, lbtn=null;
function dayOf(ms){ var d=new Date(ms); return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2); }

/* ---------- λεπτομέρειες και επεξεργασία εργαλείου ---------- */
var openIds={};
function fullTime(ms){ var d=new Date(ms); return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear()+' '+clock(ms); }
function kmOf(p){ return len(p||[])>20?(Math.round(len(p)/10)/100)+' km':null; }
function detailsOf(it){
  var box=el('div','gdet'), s=it.set||{}, h=it.haul, f=fishOf(it);
  function row(k,v){ if(v==null||v==='') return; var r=el('div','grow'); r.append(el('span','gk',k),el('span','gv',v)); box.append(r); }
  row(T('Τύπος','Type'),tn(it.type));
  row(T('Κατάσταση','Status'),it.state==='done'?T('Ολοκληρώθηκε','Completed'):it.state==='out'?T('Στη θάλασσα','At sea'):it.state==='setting'?T('Σε ρίψη','Setting'):T('Σε ανέβασμα','Hauling'));
  row(T('Ρίψη','Set'),s.ta?fullTime(s.ta)+(s.tb?' → '+clock(s.tb):'')+(kmOf(s.pts)?' · '+kmOf(s.pts):''):T('Δεν καταγράφηκε','Not recorded'));
  if(h&&h.ta) row(T('Ανέβασμα','Haul'),fullTime(h.ta)+(h.tb?' → '+clock(h.tb):'')+(kmOf(h.pts)?' · '+kmOf(h.pts):''));
  var soak=(s.ta&&h&&h.ta)?h.ta-s.ta:0;
  if(soak>0) row(T('Χρόνος στη θάλασσα','Time in water'),hm(soak));
  row(T('Ψάρια','Fish'),f.n+(f.kg?' · '+f.kg+' kg':''));
  if(soak>0&&f.n) row(T('Απόδοση','Catch rate'),(Math.round(f.n/(soak/3600000)*10)/10)+T(' ψάρια/ώρα',' fish/hour'));
  var sp={}; (C.Store.get('bites')||[]).forEach(function(b){ if(b.gear===it.id){ var k=b.species||'—'; sp[k]=sp[k]||{n:0,kg:0}; sp[k].n+=C.bc(b); sp[k].kg+=b.rel?0:(+b.kg||0); } });
  var ks=Object.keys(sp); if(ks.length) row(T('Είδη','Species'),ks.map(function(k){ return k+' ×'+sp[k].n+(sp[k].kg?' ('+Math.round(sp[k].kg*10)/10+' kg)':''); }).join(', '));
  row(T('Σημειώσεις','Notes'),it.notes);
  var cs=catchesOf(it);
  if(cs.length){ box.append(el('div','gk',T('Αλιεύματα','Catches')));
    cs.forEach(function(b){ var r=el('div','gcrow'); r.append(el('span','gcl',catchLine(b)),btn('✎','gci',function(){ openCatch(it,b,[it]); }),btn('✕','gci',function(){ delCatch(b); })); r.lastChild.setAttribute('aria-label',T('Διαγραφή','Delete')); r.children[1].setAttribute('aria-label',T('Επεξεργασία','Edit')); box.append(r); }); }
  return box;
}

/* ---------- αλιεύματα εργαλείου (δίχτυ / παραγάδι / ζεμπίλι): ξεχωριστά από τα τσιμπήματα του καλαμιού ---------- */
function catchesOf(it){ return (C.Store.get('bites')||[]).filter(function(b){ return b.gear===it.id; }).sort(function(a,b){ return String(a.date+a.time).localeCompare(String(b.date+b.time)); }); }
function catchLine(b){ var n=C.bc(b); return (b.species||T('Άγνωστο','Unknown'))+(n>1?' ×'+n:'')+(b.kg?' · '+b.kg+' kg':'')+(b.rel?' · ↩':''); }
var dlDone=false;
function fillDatalist(dl){ if(dlDone) return; dlDone=true; try{ (C.speciesDB()||[]).forEach(function(sp){ var o=document.createElement('option'); o.value=C.shownName(sp); dl.append(o); }); }catch(e){} }
function openCatch(it,rec,choices){
  var ov=el('div','askov'); ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
  var bx=el('div','askbox'); bx.style.maxHeight='90vh'; bx.style.overflow='auto'; ov.append(bx);
  bx.append(el('div','asktitle',rec?T('Αλίευμα εργαλείου','Gear catch'):T('Νέο αλίευμα εργαλείου','New gear catch')));
  function fld(lbl,inp){ var l=el('label','f',lbl); l.append(inp); bx.append(l); return inp; }
  var gsel=null;
  if(!rec&&choices&&choices.length>1){ gsel=fld(T('Εργαλείο','Gear'),document.createElement('select')); gsel.className='askin'; choices.forEach(function(g){ var o=document.createElement('option'); o.value=g.id; o.textContent=nm(g); gsel.append(o); }); }
  else bx.append(el('div','note',T('Εργαλείο: ','Gear: ')+nm(it)+' · '+tn(it.type)));
  var isp=fld(T('Είδος','Species'),document.createElement('input')); isp.type='text'; isp.maxLength=60; isp.className='askin'; isp.setAttribute('list','gcDL'); isp.autocomplete='off';
  var dl=document.getElementById('gcDL'); if(!dl){ dl=document.createElement('datalist'); dl.id='gcDL'; document.body.appendChild(dl); } fillDatalist(dl);
  var chips=el('div','chips'); var mix=el('button','chip',T('Διάφορα είδη','Mixed species')); mix.type='button'; mix.addEventListener('click',function(){ isp.value=T('Διάφορα είδη','Mixed species'); }); chips.append(mix); bx.append(chips);
  var g2=el('div','fgrid2'); bx.append(g2);
  function f2(lbl,inp){ var l=el('label','f',lbl); l.append(inp); g2.append(l); return inp; }
  var icnt=f2(T('Πλήθος ψαριών','Number of fish'),document.createElement('input')); icnt.type='number'; icnt.min='1'; icnt.max='9999'; icnt.step='1'; icnt.inputMode='numeric'; icnt.className='askin'; icnt.value='1';
  var ikg=f2(T('Συνολικό βάρος (kg)','Total weight (kg)'),document.createElement('input')); ikg.type='number'; ikg.min='0'; ikg.step='0.1'; ikg.inputMode='decimal'; ikg.className='askin';
  var irel=null; var rl=el('label','chk'); rl.style.cssText='display:flex;align-items:center;gap:10px;margin-top:6px;font-weight:600'; irel=document.createElement('input'); irel.type='checkbox'; irel.style.cssText='width:22px;height:22px'; rl.append(irel,el('span','',T('Ελευθερώθηκαν (δεν μετράνε στα κιλά)','Released (not counted in weight)'))); bx.append(rl);
  var err=el('div','note'); err.style.color='#d9534f'; bx.append(err);
  if(rec){ isp.value=(window.LANG==='en'&&window.spName)?window.spName(rec.species||''):(rec.species||''); icnt.value=C.bc(rec); ikg.value=rec.kg==null?'':rec.kg; irel.checked=!!rec.rel; }
  var bt=el('div','askbtns'), no=el('button','btn ghost',T('Άκυρο','Cancel')), yes=el('button','btn acc',T('Αποθήκευση','Save')); no.type=yes.type='button'; bt.append(no,yes); bx.append(bt);
  if(!rec){ var rod=el('button','btn ghost sm',T('Καλάμι →','Rod →')); rod.type='button'; rod.style.cssText='margin-top:8px;width:100%'; rod.addEventListener('click',function(){ close(); C.openRodSheet(); }); bx.append(rod); }
  function close(){ ov.remove(); }
  no.addEventListener('click',close); ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
  isp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); isp.blur(); } });
  yes.addEventListener('click',async function(){
    var name=isp.value.trim(), n=Math.max(1,Math.min(9999,Math.floor(+icnt.value)||1)), kg=ikg.value===''?null:+ikg.value, latin='';
    if(!name){ err.textContent=T('Γράψε είδος ή πάτα «Διάφορα είδη».','Enter a species or tap “Mixed species”.'); return; }
    var m=C.matchSp(name); if(m){ name=C.dispName(m); latin=m.la; }
    if(/^(mixed species|διάφορα είδη)$/i.test(name)) name='Διάφορα είδη';
    yes.disabled=true;
    try{
      if(rec){
        var u=Object.assign({},rec,{species:name,latin:latin||rec.latin||'',kg:kg}); if(n>1) u.cnt=n; else delete u.cnt; if(irel.checked) u.rel=true; else delete u.rel;
        await C.Store.save('bites',u);
      } else {
        var g=gsel?(G.items.find(function(x){ return x.id===gsel.value; })||it):it, pos=null; try{ pos=await here(); }catch(e){}
        var d=C.nicosiaToday(), rc={date:d,time:C.fmt(C.nicosiaNowMin()),tz:C.utcOff(),species:name,latin:latin,kg:kg,src:'gear',lat:pos?pos[0]:null,lon:pos?pos[1]:null,place:''};
        if(n>1) rc.cnt=n; if(irel.checked) rc.rel=true;
        C.tripStamp(rc,false); rc.gear=g.id; rc.gearName=nm(g); rc.tech=tn(g.type);
        await C.Store.save('bites',rc);
      }
      close(); try{ C.toast(T('Αποθηκεύτηκε.','Saved.')); }catch(e){}
    }catch(e){ err.textContent=T('Δεν αποθηκεύτηκε. Δοκίμασε ξανά.','Not saved. Try again.'); yes.disabled=false; }
  });
  document.body.appendChild(ov); try{ isp.focus(); }catch(e){}
}
function delCatch(b){
  window.AlkyonAsk(catchLine(b),{title:T('Διαγραφή αλιεύματος','Delete catch'),ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel'),danger:true}).then(function(ok){ if(ok) C.Store.remove('bites',b.id).catch(function(){}); });
}
function dtVal(ms){ if(!ms) return ''; var d=new Date(ms); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)+'T'+clock(ms); }
function editGear(it){
  var ov=el('div','askov'); ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true');
  var bx=el('div','askbox'); bx.style.maxHeight='88vh'; bx.style.overflow='auto'; ov.append(bx);
  bx.append(el('div','asktitle',T('Επεξεργασία εργαλείου','Edit gear')));
  function fld(lbl,inp){ var l=el('label','f',lbl); l.append(inp); bx.append(l); return inp; }
  var iname=fld(T('Όνομα','Name'),document.createElement('input')); iname.type='text'; iname.maxLength=40; iname.value=it.name||''; iname.placeholder=tn(it.type); iname.className='askin';
  var isel=fld(T('Τύπος','Type'),document.createElement('select')); Object.keys(TYPES).forEach(function(k){ var o=document.createElement('option'); o.value=k; o.textContent=tn(k); isel.append(o); }); isel.value=it.type; isel.className='askin';
  var s=it.set||{}, h=it.haul||null;
  var iset=fld(T('Ώρα ρίψης','Set time'),document.createElement('input')); iset.type='datetime-local'; iset.className='askin'; iset.value=dtVal(s.ta);
  var ihau=null; if(h&&h.ta){ ihau=fld(T('Ώρα ανεβάσματος','Haul time'),document.createElement('input')); ihau.type='datetime-local'; ihau.className='askin'; ihau.value=dtVal(h.ta); }
  var inot=fld(T('Σημειώσεις','Notes'),document.createElement('textarea')); inot.rows=3; inot.maxLength=300; inot.value=it.notes||''; inot.className='askin';
  var bt=el('div','askbtns'), no=el('button','btn ghost',T('Άκυρο','Cancel')), yes=el('button','btn acc',T('Αποθήκευση','Save')); no.type=yes.type='button'; bt.append(no,yes); bx.append(bt);
  function close(){ ov.remove(); }
  no.addEventListener('click',close); ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
  yes.addEventListener('click',function(){
    var n=iname.value.trim().slice(0,40); if(n) it.name=n; else delete it.name;
    if(TYPES[isel.value]) it.type=isel.value;
    var sv=iset.value?new Date(iset.value).getTime():0, hv=(ihau&&ihau.value)?new Date(ihau.value).getTime():0;
    if(hv&&sv&&hv<sv){ try{ C.toast(T('Το ανέβασμα δεν μπορεί να είναι πριν τη ρίψη.','Haul cannot be before the set.')); }catch(e){} return; }
    if(sv){ it.set=it.set||{}; it.set.ta=sv; delete it.set.unknown; }
    if(hv&&it.haul) it.haul.ta=hv;
    var nt=inot.value.trim().slice(0,300); if(nt) it.notes=nt; else delete it.notes;
    save(); draw(); render(); close();
    try{ C.toast(T('Αποθηκεύτηκε.','Saved.')); }catch(e){}
  });
  document.body.appendChild(ov); try{ iname.focus(); }catch(e){}
}
function renderLog(){
  try{ refreshStGear(); }catch(e){}
  if(!lbox) return; lbox.replaceChildren();
  var skey=C.lsGet('alkyon-sort-gear','new');
  function tOf(i){ return (i.set&&i.set.ta)||(i.haul&&i.haul.ta)||0; }
  function soakH(i){ return (i.set&&i.set.ta&&i.haul&&(i.haul.tb||i.haul.ta))?((i.haul.tb||i.haul.ta)-i.set.ta)/3600000:0; }
  var items=G.items.slice().sort(function(p,q){
    if(skey==='old') return tOf(p)-tOf(q);
    if(skey==='eff'){ var rp=soakH(p)>0?fishOf(p).n/soakH(p):-1, rq=soakH(q)>0?fishOf(q).n/soakH(q):-1; return (rq-rp)||(tOf(q)-tOf(p)); }
    if(skey==='hrs') return (soakH(q)-soakH(p))||(tOf(q)-tOf(p));
    return tOf(q)-tOf(p); });
  (function(){ var w=el('label','f sortsel',T('Ταξινόμηση','Sort by')); var s=document.createElement('select');
    [['new',T('Νεότερα πρώτα','Newest first')],['old',T('Παλαιότερα πρώτα','Oldest first')],['eff',T('Καλύτερη απόδοση (ψάρια/ώρα)','Best catch rate (fish/hour)')],['hrs',T('Περισσότερες ώρες μέσα','Most hours in water')]].forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; s.append(op); });
    s.value=skey; s.addEventListener('change',function(){ C.lsSet('alkyon-sort-gear',s.value); renderLog(); }); w.append(s); w.style.margin='6px 0'; lbox.append(w); })();
  var tot=items.filter(function(i){ return i.state==='done'; }), tn_=0, tk=0; tot.forEach(function(i){ var f=fishOf(i); tn_+=f.n; tk+=f.kg; });
  lbox.append(el('div',items.length?'muted':'muted empty',items.length?T(items.length+(items.length===1?' εργαλείο · ':' εργαλεία · ')+tn_+' ψάρια · '+(Math.round(tk*10)/10)+' kg (ολοκληρωμένα)',items.length+' gear · '+tn_+' fish · '+(Math.round(tk*10)/10)+' kg (completed)'):T('Δεν υπάρχουν εργαλεία ακόμα. Ξεκίνα από το κουμπί εργαλείων στον χάρτη.','No gear yet. Start from the gear button on the map.')));
  items.forEach(function(it){
    var f=fishOf(it), s=it.set||{}, h=it.haul, card=el('div','item'), head=el('div','ihead');
    var when=s.ta?dayOf(s.ta):(h&&h.ta?dayOf(h.ta):'');
    head.append(el('b','ititle',nm(it)),el('span','when mono',when)); card.append(head);
    var st=it.state==='done'?T('Ολοκληρώθηκε','Completed'):it.state==='out'?T('Στη θάλασσα','At sea'):it.state==='setting'?T('Σε ρίψη','Setting'):T('Σε ανέβασμα','Hauling');
    var l1=[tn(it.type),st]; if(f.n||it.state==='done') l1.push(f.n+T(f.n===1?' ψάρι':' ψάρια',f.n===1?' fish':' fish')+(f.kg?' · '+f.kg+' kg':'')); card.append(el('div','meta',l1.join(' · ')));
    var l2=[]; if(s.ta) l2.push(T('Ρίψη ','Set ')+clock(s.ta)+(s.tb?' → '+clock(s.tb):'')+(len(s.pts||[])>20?' · '+(Math.round(len(s.pts)/10)/100)+' km':'')); else if(s.unknown) l2.push(T('Ρίψη χωρίς καταγραφή','Set not recorded'));
    if(h&&h.ta) l2.push(T('Ανέβασμα ','Haul ')+dayOf(h.ta)+' '+clock(h.ta)+(h.tb?' → '+clock(h.tb):'')+(len(h.pts||[])>20?' · '+(Math.round(len(h.pts)/10)/100)+' km':''));
    if(s.ta&&h&&h.ta) l2.push(T('Μέσα ','Soaked ')+hm(h.ta-s.ta));
    if(l2.length) card.append(el('div','meta',l2.join(' · ')));
    if(it.notes) card.append(el('div','meta',it.notes));
    var det=detailsOf(it); det.hidden=!openIds[it.id]; card.append(det);
    var dbt=btn(openIds[it.id]?T('Απόκρυψη','Hide'):T('Λεπτομέρειες','Details'),'',function(){ openIds[it.id]=!openIds[it.id]; det.hidden=!openIds[it.id]; dbt.textContent=openIds[it.id]?T('Απόκρυψη','Hide'):T('Λεπτομέρειες','Details'); });
    var acts=el('div','acts'); acts.append(btn(T('Χάρτης','Map'),'',function(){ showItems([it]); }),dbt,btn(T('＋ Αλίευμα','＋ Catch'),'',function(){ openCatch(it,null,[it]); }),btn(T('Επεξεργασία','Edit'),'',function(){ editGear(it); }),btn(T('Διαγραφή','Delete'),'',function(){ remove(it); })); card.append(acts);
    lbox.append(card);
  });
}
if(seg&&$('l-stats')){
  lbtn=el('button','',T('Δίχτυα','Nets')); lbtn.type='button'; lbtn.dataset.l='gear'; lbtn.setAttribute('aria-pressed','false'); var stb=seg.querySelector('[data-l=stats]'); if(stb) seg.insertBefore(lbtn,stb); else seg.appendChild(lbtn);
  lbox=el('div','col'); lbox.id='l-gear'; lbox.hidden=true; $('l-stats').parentNode.insertBefore(lbox,$('l-stats').nextSibling);
  Array.prototype.forEach.call(seg.querySelectorAll('button'),function(b){ b.addEventListener('click',function(){
    var on=b===lbtn; lbox.hidden=!on;
    if(on){ Array.prototype.forEach.call(seg.querySelectorAll('button'),function(x){ x.setAttribute('aria-pressed',String(x===b)); }); ['l-trips','l-bites','l-stats','l-comm'].forEach(function(id){ var n=$(id); if(n) n.hidden=true; }); renderLog(); }
  }); });
  if(C.Store&&C.Store.on) C.Store.on('bites',function(){ renderLog(); });
}
function importItems(arr){ var n=0; (Array.isArray(arr)?arr:[]).forEach(function(it){ if(it&&it.id&&it.type&&it.set&&!G.items.some(function(x){ return x.id===it.id; })){ G.items.push(it); n++; } }); if(n){ save(); draw(); } return n; }

/* ---------- σύνοψη μέσα στην έξοδο ---------- */
function compact(it){ var f=fishOf(it); function thin(p){ if(!p||p.length<=120) return p||[]; var k=Math.ceil(p.length/120); return p.filter(function(_,i){ return i%k===0||i===p.length-1; }); }
  return {id:it.id,type:it.type,name:nm(it),set:{a:it.set.a||null,b:it.set.b,ta:it.set.ta,tb:it.set.tb,pts:thin(it.set.pts)},haul:it.haul?{a:it.haul.a,b:it.haul.b,ta:it.haul.ta,tb:it.haul.tb,pts:thin(it.haul.pts)}:null,n:f.n,kg:f.kg}; }
function attachDone(tripId){
  /* προσθέτει στην πιο πρόσφατη έξοδο τα ολοκληρωμένα εργαλεία που δεν έχουν συνδεθεί */
  var pend=G.items.filter(function(i){ return i.state==='done'&&!i.att; }); if(!pend.length) return;
  var trips=C.Store.raw('trips')||[], t=tripId?trips.find(function(x){ return x.id===tripId; }):null;
  if(!t) return;
  var cur=Array.isArray(t.gear)?t.gear.slice():[];
  pend.forEach(function(it){ cur=cur.filter(function(g){ return g.id!==it.id; }).concat([compact(it)]); it.att=t.id; });
  save(); C.Store.save('trips',Object.assign({},t,{gear:cur}));
}
window.addEventListener('alkyon-tripend',function(e){ var id=e&&e.detail&&e.detail.id; setTimeout(function(){ attachDone(id); },400); });

window.AlkyonGear={hauling:function(){ return G.items.filter(function(i){ return i.state==='hauling'; }); },catchIfHauling:function(){ var l=G.items.filter(function(i){ return i.state==='hauling'; }); if(!l.length) return false; openCatch(l[0],null,l); return true; },openCatch:function(it,rec){ openCatch(it,rec||null,[it]); },import:importItems,tag:tag,open:openPanel,state:function(){ return G; },show:function(list){ showItems((list||[]).map(function(g){ return {type:g.type,name:g.name,set:g.set,haul:g.haul}; })); },hide:hideShown,types:TYPES};
setTimeout(function(){ watch(); draw(); },1500); setInterval(function(){ draw(); },20000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ if(wid!=null){ try{ navigator.geolocation.clearWatch(wid); }catch(e){} wid=null; } wake(); watch(); draw(); } });

/* ---------- Στατιστικά → Εργαλεία (μεταφέρθηκαν από την καρτέλα Εργαλεία) ---------- */
function refreshStGear(){ var sg=$('stGear'); if(!sg||sg.hidden||!window.AlkyonGearStats) return; try{ sg.replaceChildren(window.AlkyonGearStats.build()); }catch(e){} }
(function(){
  var sseg=$('stSeg'); if(!sseg) return;
  function stView(v){
    if(v!=='gear') v='rod'; C.lsSet('alkyon-stview',v);
    Array.prototype.forEach.call(sseg.querySelectorAll('button'),function(x){ x.setAttribute('aria-pressed',String(x.dataset.st===v)); });
    var sp=$('stSpecies'), lab=sp&&sp.parentNode, bd=$('stBody'); if(lab) lab.hidden=(v==='gear'); if(bd) bd.hidden=(v==='gear'); $('stGear').hidden=(v!=='gear');
    if(v==='gear') refreshStGear();
  }
  Array.prototype.forEach.call(sseg.querySelectorAll('button'),function(b){ b.addEventListener('click',function(){ stView(b.dataset.st); }); });
  window.addEventListener('alkyon-range',function(e){ if(e.detail&&e.detail.key==='log') setTimeout(refreshStGear,0); });
  if(C.Store&&C.Store.on) C.Store.on('bites',function(){ setTimeout(refreshStGear,0); });
  stView(C.lsGet('alkyon-stview','rod'));
  window.AlkyonStView=stView;
})();
})();
