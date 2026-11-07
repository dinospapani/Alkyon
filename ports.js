/* Λιμάνια, μαρίνες και ράμπες καθέλκυσης πάνω στον χάρτη (OpenStreetMap μέσω Overpass).
   Φορτώνει μόνο ό,τι φαίνεται στην οθόνη (ζουμ 10 και πάνω), κρατά αντίγραφο στη συσκευή και δουλεύει χωρίς σύνδεση για περιοχές που έχεις ήδη δει.
   Τα δεδομένα είναι εθελοντικά και μπορεί να λείπουν ή να είναι παλιά. Έλεγξε επιτόπου. */
(function(){
'use strict';
var C=window.AlkyonCore, mb=document.querySelector('.mapbtns'); if(!C||!mb||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-ports-on', TK='alkyon-ports-tiles', ZMIN=8, TILE=0.5, DAYS=30;
var OVP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.openstreetmap.fr/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
var on=C.lsGet(KEY,true)!==false;
var KM='alkyon-ports-mine', mine=C.lsGet(KM,[]); if(!Array.isArray(mine)) mine=[];
var layer=L.layerGroup(), tiles=C.lsGet(TK,{}), mem={}, shown={}, tm=null, warned=0;
if(!tiles||typeof tiles!=='object') tiles={};
var st=document.createElement('style');
st.textContent='.mk-port{width:30px;height:30px;border-radius:50%;background:#fff;border:2px solid #0b5a7a;color:#0b5a7a;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.35)}.mk-port.ramp{border-color:#d9441b;color:#d9441b}.mk-port svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.portpop .pbtns{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.portpop .pb{border:0;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;font-weight:700;background:var(--accent,#d9441b);color:var(--accent-ink,#fff);cursor:pointer;text-decoration:none}.portpop .pb.g{background:var(--line,#dde);color:var(--ink,#123)}.portpop .pk{font-size:12px;opacity:.75;margin-top:2px}';
st.textContent+='.leaflet-container.zlow .mk-port.ramp{display:none}.leaflet-container.zlow .mk-port{width:24px;height:24px}.leaflet-container.zlow .mk-port svg{width:14px;height:14px}';
document.head.appendChild(st);
var ICO={port:'<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M8 11h8"/><path d="M4 14c0 4 3.6 7 8 7s8-3 8-7"/></svg>',ramp:'<svg viewBox="0 0 24 24"><path d="M3 18c4 0 6-6 9-6s5 3 9 3"/><path d="M5 8h9l3 4"/><path d="M3 21c2-1 3.500-1 5.500 0s3.500 1 5.500 0 3.500-1 5.500 0"/></svg>'};
var KIND={marina:T('Μαρίνα','Marina'),port:T('Λιμάνι','Harbour'),ramp:T('Ράμπα καθέλκυσης','Boat ramp')};
function dist(a,b,c,d){ var R=6371,r=Math.PI/180,dl=(c-a)*r,dn=(d-b)*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.sqrt(x)); }
function key(i,j,t){ return (t||TILE)+':'+i+'_'+j; }
/* ρωτά όλους τους servers ταυτόχρονα και κρατά τον πρώτο που απαντά */
function race(q,ms){
  return new Promise(function(res,rej){
    var left=OVP.length, done=false;
    OVP.forEach(function(u){
      var ctl=window.AbortController?new AbortController():null, t=setTimeout(function(){ if(ctl) ctl.abort(); },ms||20000);
      fetch(u,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ctl?ctl.signal:undefined})
        .then(function(r){ clearTimeout(t); if(!r.ok) throw new Error('http'); return r.json(); })
        .then(function(j){ if(!done&&j&&j.elements){ done=true; res(j); } else if(--left<=0&&!done) rej(new Error('net')); })
        .catch(function(){ clearTimeout(t); if(--left<=0&&!done) rej(new Error('net')); });
    });
  });
}
var TAGS='["leisure"="marina"]|["harbour"="yes"]|["leisure"="slipway"]|["seamark:type"~"^(harbour|harbour_basin|slipway|small_craft_facility)$"]'.split('|');
function parse(j2){
  var out=[], seen={};
  (j2.elements||[]).forEach(function(x){
    var la=x.lat!=null?x.lat:(x.center&&x.center.lat), lo=x.lon!=null?x.lon:(x.center&&x.center.lon); if(la==null||lo==null) return;
    var tg=x.tags||{}, nm=tg['name:el']||tg.name||tg['name:en']||tg['seamark:name']||'';
    var kind=tg.leisure==='slipway'||tg['seamark:type']==='slipway'?'ramp':tg.leisure==='marina'?'marina':'port';
    var dk=(nm||kind)+'|'+la.toFixed(3)+'|'+lo.toFixed(3); if(seen[dk]) return; seen[dk]=1;
    out.push({n:nm,la:+la.toFixed(5),lo:+lo.toFixed(5),k:kind});
  });
  return out;
}
function loadBox(k,bb,limit,ms){
  var c=tiles[k]; if(mem[k]) return mem[k];
  if(c&&Date.now()-c.t<DAYS*86400000) return Promise.resolve(c.list);
  var q='[out:json][timeout:40];('+TAGS.map(function(t){ return 'nwr'+t+bb+';'; }).join('')+');out center tags '+limit+';';
  mem[k]=race(q,ms).then(function(j2){
    var out=parse(j2); tiles[k]={t:Date.now(),list:out};
    var ks=Object.keys(tiles).filter(function(x){ return x!=='CY'; }); if(ks.length>80){ ks.sort(function(a,b){ return tiles[a].t-tiles[b].t; }); ks.slice(0,ks.length-80).forEach(function(x){ delete tiles[x]; }); }
    C.lsSet(TK,tiles); delete mem[k]; return out;
  },function(err){ delete mem[k]; if(c) return c.list; throw err; });
  return mem[k];
}
var CYB={s:34.45,w:32.2,n:35.8,e:34.75};
function loadCY(){ return loadBox('CY','('+CYB.s+','+CYB.w+','+CYB.n+','+CYB.e+')',2000,30000); }
function load(i,j,t){
  var s=(i*t).toFixed(3), w=(j*t).toFixed(3), n=((i+1)*t).toFixed(3), e=((j+1)*t).toFixed(3);
  return loadBox(key(i,j,t),'('+s+','+w+','+n+','+e+')',800,25000);
}
function pop(p){
  var w=document.createElement('div'); w.className='pop portpop land';
  var b=document.createElement('b'); b.textContent=p.n||KIND[p.k]; w.appendChild(b);
  var k=document.createElement('div'); k.className='pk'; var me=C.getCond&&C.getCond();
  k.textContent=KIND[p.k]+(me&&me.lat!=null?' · '+(Math.round(dist(me.lat,me.lon,p.la,p.lo)*10)/10)+' km':''); w.appendChild(k);
  var r=document.createElement('div'); r.className='pbtns';
  var a=document.createElement('button'); a.type='button'; a.className='pb'; a.textContent=(function(){var f='boat';try{f=localStorage.getItem('alkyon-fprof')||'boat';}catch(e){} return f==='lake'?T('Σημείο εκκίνησης','Starting point'):(f==='spear'||f==='shore')?T('Λιμάνι ή σημείο εκκίνησης','Departure port or point'):T('Λιμάνι αναχώρησης','Departure port');})();
  a.addEventListener('click',function(){ var sm=window.AlkyonSmart; if(sm&&sm.setHome){ sm.setHome({lat:p.la,lon:p.lo,name:p.n||KIND[p.k]}); map.closePopup(); C.toast(T('Λιμάνι: ','Port: ')+(p.n||KIND[p.k])); } });
  r.append(a);
  if(p.mine){ k.textContent+=' · '+T('δικό σου','yours'); var x=document.createElement('button'); x.type='button'; x.className='pb g'; x.textContent=T('Διαγραφή','Delete');
    x.addEventListener('click',function(){ mine=mine.filter(function(q){ return !(q.la===p.la&&q.lo===p.lo); }); C.lsSet(KM,mine); var id=p.la+','+p.lo+(p.n||''); if(shown[id]){ layer.removeLayer(shown[id]); delete shown[id]; } map.closePopup(); C.toast(T('Διαγράφηκε.','Deleted.')); }); r.append(x); }
  w.appendChild(r);
  if(window.AlkyonPortNotes) try{ window.AlkyonPortNotes.attach(w,p); }catch(e){} /* Alkyon 1.9.19: σημειώσεις ψαράδων */
  return w;
}
function add(p){
  var id=p.la+','+p.lo+(p.n||''); if(shown[id]) return;
  var m=L.marker([p.la,p.lo],{icon:L.divIcon({className:'',html:'<div class="mk-port'+(p.k==='ramp'?' ramp':'')+'">'+(p.k==='ramp'?ICO.ramp:ICO.port)+'</div>',iconSize:[30,30]}),title:p.n||KIND[p.k]});
  if(p.n) m.bindTooltip(p.n,{direction:'right',offset:[14,0],className:'lbl'});
  m.bindPopup(function(){ return pop(p); }); m.addTo(layer); shown[id]=m;
}
function note(nIn,bad){
  var now=Date.now();
  if(bad&&nIn===0){ if(now-warned>60000){ warned=now; C.toast(T('Δεν φορτώθηκαν λιμάνια. Χρειάζεται σύνδεση.','Ports did not load. Needs a connection.')); } }
  else if(!bad&&nIn===0){ if(!note.emptySaid&&!document.body.classList.contains('ontrip')&&now-warned>60000){ note.emptySaid=1; warned=now; C.toast(T('Δεν υπάρχουν καταχωρισμένα λιμάνια ή ράμπες εδώ στο OpenStreetMap.','No ports or ramps are recorded here in OpenStreetMap.')); } }
  else if(!bad&&!note.said){ note.said=1; C.toast(T('Λιμάνια και ράμπες στην περιοχή: ','Ports and ramps here: ')+nIn); }
}
function inCY(b){ var c=b.getCenter(); return c.lat>=CYB.s&&c.lat<=CYB.n&&c.lng>=CYB.w&&c.lng<=CYB.e; }
function refresh(){
  if(!on||!map.hasLayer(layer)) return;
  var b=map.getBounds();
  if(inCY(b)){
    /* όλη η Κύπρος με ένα αίτημα, αποθηκεύεται στη συσκευή */
    loadCY().then(function(l){ var n=0; l.forEach(function(p){ add(p); if(b.contains([p.la,p.lo])) n++; }); note(n,false); },function(){ note(0,true); });
    return;
  }
  if(map.getZoom()<ZMIN) return;
  var t=map.getZoom()<10?1:TILE, i0=Math.floor(b.getSouth()/t), i1=Math.floor(b.getNorth()/t), j0=Math.floor(b.getWest()/t), j1=Math.floor(b.getEast()/t);
  if((i1-i0+1)*(j1-j0+1)>12) return;
  var jobs=[], nIn=0; for(var i=i0;i<=i1;i++) for(var j=j0;j<=j1;j++) jobs.push(load(i,j,t).then(function(l){ l.forEach(function(p){ add(p); if(b.contains([p.la,p.lo])) nIn++; }); return 'ok'; },function(){ return 'x'; }));
  Promise.all(jobs).then(function(r){ note(nIn,r.indexOf('x')>=0); });
}
function lowZoom(){ var el=map.getContainer(); el.classList.toggle('zlow',map.getZoom()<11); }
mine.forEach(function(q){ add({n:q.n,la:q.la,lo:q.lo,k:q.k,mine:1}); });
function openForm(ll){
  /* πάνελ στο πάνω μέρος της οθόνης: το πληκτρολόγιο και οι κάρτες δεν το καλύπτουν */
  var old=document.getElementById('portForm'); if(old) old.remove();
  var w=document.createElement('div'); w.id='portForm'; w.setAttribute('role','dialog');
  w.style.cssText='position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 12px);z-index:100000;background:#fff;color:#0E2A36;border:1px solid #9FB4BC;border-radius:16px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:inherit';
  var b=document.createElement('b'); b.textContent=T('Νέο σημείο','New point'); b.style.cssText='font-size:16px;color:#0E2A36'; w.appendChild(b);
  var inp=document.createElement('input'); inp.type='text'; inp.maxLength=60; inp.placeholder=T('Όνομα (π.χ. Ράμπα Λατσί)','Name (e.g. Latchi ramp)'); inp.setAttribute('aria-label',T('Όνομα','Name'));
  inp.style.cssText='width:100%;box-sizing:border-box;margin-top:10px;padding:12px;border:1px solid #9FB4BC;border-radius:12px;font:inherit;font-size:16px;background:#fff;color:#0E2A36';
  w.appendChild(inp);
  var r=document.createElement('div'); r.style.cssText='display:flex;gap:8px;margin-top:10px';
  function done(){ w.remove(); document.body.classList.remove('ndopen'); }
  function save(kind){ var q={n:inp.value.trim(),la:+ll.lat.toFixed(5),lo:+ll.lng.toFixed(5),k:kind}; mine.push(q); C.lsSet(KM,mine); add({n:q.n,la:q.la,lo:q.lo,k:q.k,mine:1}); done(); C.toast(T('Αποθηκεύτηκε.','Saved.')); }
  function mk(txt,fn,solid){ var a=document.createElement('button'); a.type='button'; a.textContent=txt; a.style.cssText='flex:1;min-height:44px;border-radius:12px;font:inherit;font-weight:700;border:1px solid #9FB4BC;'+(solid?'background:#E8743B;color:#fff;border-color:transparent':'background:#fff;color:#0E2A36'); a.addEventListener('click',fn); r.appendChild(a); }
  mk(T('Ράμπα','Ramp'),function(){ save('ramp'); },true);
  mk(T('Λιμάνι','Port'),function(){ save('port'); },true);
  mk(T('Άκυρο','Cancel'),done,false);
  w.appendChild(r); document.body.appendChild(w); document.body.classList.add('ndopen');
  var m=L.circleMarker(ll,{radius:9,color:'#fff',weight:3,fillColor:'#E8743B',fillOpacity:1}).addTo(map);
  var _d=done; done=function(){ try{map.removeLayer(m);}catch(e){} _d(); };
  setTimeout(function(){ try{ inp.focus(); }catch(e){} },100);
}
function startAdd(){
  if(!map.hasLayer(layer)){ on=true; layer.addTo(map); C.lsSet(KEY,true); var bb=document.getElementById('bPorts'); if(bb) bb.setAttribute('aria-pressed','true'); }
  C.toast(T('Πάτα στον χάρτη στη θέση της ράμπας ή του λιμανιού.','Tap the map where the ramp or port is.'));
  map.once('click',function(e){ map.closePopup(); setTimeout(function(){ map.closePopup(); },0); openForm(e.latlng); });
}
window.AlkyonPorts={startAdd:startAdd,mine:function(){ return mine.map(function(q){ return {name:q.n||(q.k==='ramp'?T('Ράμπα','Ramp'):T('Λιμάνι','Port')),lat:q.la,lon:q.lo}; }); }};
var btn=document.createElement('button'); btn.type='button'; btn.id='bPorts'; btn.className='mbtn'; btn.setAttribute('aria-pressed',String(on));
btn.setAttribute('aria-label',T('Λιμάνια και ράμπες','Ports and ramps')); btn.title=T('Λιμάνια, μαρίνες και ράμπες καθέλκυσης','Ports, marinas and boat ramps');
btn.innerHTML=ICO.port; mb.appendChild(btn);
if(on) layer.addTo(map);
btn.addEventListener('click',function(){
  on=!map.hasLayer(layer); if(on){ layer.addTo(map); refresh(); if(map.getZoom()<ZMIN) C.toast(T('Κάνε ζουμ πιο κοντά για να φανούν τα λιμάνια.','Zoom in to see ports.')); } else { map.closePopup(); map.removeLayer(layer); }
  btn.setAttribute('aria-pressed',String(on)); C.lsSet(KEY,on);
});
map.on('zoomend',lowZoom); lowZoom();
map.on('moveend zoomend',function(){ clearTimeout(tm); tm=setTimeout(refresh,350); });
setTimeout(refresh,600);
/* φόρτωση Κύπρου στο παρασκήνιο από την αρχή, ώστε να είναι έτοιμα όταν τα χρειαστείς */
setTimeout(function(){ if(!on||!inCY(map.getBounds())) return; if(on&&!(tiles.CY&&Date.now()-tiles.CY.t<DAYS*86400000)){ C.toast(T('Φορτώνω λιμάνια και ράμπες Κύπρου (μία φορά)…','Loading Cyprus ports and ramps (once)…')); } loadCY().then(function(l){ if(on) l.forEach(add); },function(){}); },900);
})();
