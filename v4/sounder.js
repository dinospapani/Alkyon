/* Alkyon 4 · Βυθόμετρο (1.10.12)
   Ο βυθός από το βυθόμετρο του σκάφους μέσα στην εφαρμογή, με δύο τρόπους που διαλέγεις στο Προφίλ › Ρυθμίσεις › Βυθόμετρο:
   1) Ζωντανά μέσω Signal K: ένας «γεφυρωτής» στο δίκτυο NMEA 2000 / 0183 του σκάφους (Victron Cerbo GX με Venus OS Large,
      Raspberry Pi με OpenPlotter, ή όποιος άλλος server Signal K) δίνει βάθος, θερμοκρασία νερού, θέση και ταχύτητα από WebSocket.
      Η εφαρμογή είναι σε https, οπότε η σύνδεση γίνεται με wss (πόρτα 3443 του Signal K, με SSL).
   1β) (1.13.1, μόνο εφαρμογή Android) «Δίκτυο σκάφους»: NMEA 0183 μέσω WiFi (UDP broadcast/multicast ή TCP) από plotter ή πύλη
      NMEA, με το πρόσθετο AlkNet (android/…/AlkNetPlugin.java). Δείχνει και ό,τι έρχεται από το δίκτυο, για διάγνωση.
   2) Από αρχείο: Lowrance/Simrad .sl2/.sl3, καταγραφή NMEA 0183, GPX με βάθος, CSV (Deeper κ.ά.) — v4/sounder-parse.js.
   Ό,τι μετριέται μπαίνει στον «Βυθό μου»: πλέγμα ~20 m στη συσκευή (IndexedDB alkyon-depth), με μέσο, ελάχιστο και μέγιστο βάθος.
   Η B.depthAt προτιμά: ζωντανό βυθόμετρο (κοντά στο σκάφος) → «Ο βυθός μου» → χάρτης βυθού (EMODnet). B.lastDepthSrc λέει από πού ήρθε. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var CFG='alkyon-sounder';
function cfg(){ var c=ls.get(CFG,null)||{}; return {src:c.src==='sk'||c.src==='net'?c.src:'off',tcp:String(c.tcp||''),scan:String(c.scan||''),host:String(c.host||''),demo:!!c.demo,rec:c.rec!==false,off:isFinite(+c.off)?+c.off:0}; }
function setCfg(p){ var c=Object.assign(cfg(),p); ls.set(CFG,c); return c; }
function emit(){ try{ window.dispatchEvent(new CustomEvent('alkyon-sounder',{detail:st})); }catch(e){} }
function hav(a,b,c,d){ var r=Math.PI/180, x=Math.sin((c-a)*r/2), y=Math.sin((d-b)*r/2), q=x*x+Math.cos(a*r)*Math.cos(c*r)*y*y; return 12742000*Math.asin(Math.min(1,Math.sqrt(q))); }

/* ---------- «Ο βυθός μου»: πλέγμα στη συσκευή ---------- */
var CELL=0.0002, TILE=0.02, dbP=null, tiles={}, dirty={}, saveTm=null;
function idb(){ if(dbP) return dbP; dbP=new Promise(function(res,rej){ try{ var r=indexedDB.open('alkyon-depth',1); r.onupgradeneeded=function(){ r.result.createObjectStore('tiles'); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; }catch(e){ rej(e); } }); dbP.catch(function(){ dbP=null; }); return dbP; }
function tk(lat,lon){ return Math.floor(lat/TILE)+':'+Math.floor(lon/TILE); }
function ck(lat,lon){ return Math.floor(lat/CELL)+':'+Math.floor(lon/CELL); }
function cellLL(k){ var p=k.split(':'); return [(+p[0]+0.5)*CELL,(+p[1]+0.5)*CELL]; }
function loadTile(k){ if(tiles[k]) return Promise.resolve(tiles[k]);
  return idb().then(function(db){ return new Promise(function(res){ var r=db.transaction('tiles').objectStore('tiles').get(k); r.onsuccess=function(){ if(!tiles[k]) tiles[k]=r.result||{}; res(tiles[k]); }; r.onerror=function(){ if(!tiles[k]) tiles[k]={}; res(tiles[k]); }; }); })
    .catch(function(){ if(!tiles[k]) tiles[k]={}; return tiles[k]; }); }
function saveSoon(){ clearTimeout(saveTm); saveTm=setTimeout(flush,4000); }
function flush(){ var ks=Object.keys(dirty); if(!ks.length) return Promise.resolve(); dirty={};
  return idb().then(function(db){ return new Promise(function(res){ var tx=db.transaction('tiles','readwrite'), os=tx.objectStore('tiles'); ks.forEach(function(k){ os.put(tiles[k],k); }); tx.oncomplete=res; tx.onerror=res; tx.onabort=res; }); }).catch(function(){}); }
/* κελί: [άθροισμα, πλήθος, ελάχιστο, μέγιστο, τελευταία φορά (ms), θερμοκρασία ή null] */
function add(pts){ if(!pts||!pts.length) return Promise.resolve({n:0,cells:0});
  var by={}; pts.forEach(function(p){ if(!(p&&isFinite(p.lat)&&isFinite(p.lon)&&p.d>0)) return; var k=tk(p.lat,p.lon); (by[k]=by[k]||[]).push(p); });
  var ks=Object.keys(by), n=0, nc=0;
  return Promise.all(ks.map(loadTile)).then(function(){ ks.forEach(function(k){ var t=tiles[k]; by[k].forEach(function(p){ var c=ck(p.lat,p.lon), v=t[c], d=Math.round(p.d*10)/10, tm=p.t||Date.now();
      if(!v){ v=t[c]=[0,0,d,d,0,null]; nc++; } v[0]=Math.round((v[0]+d)*10)/10; v[1]++; if(d<v[2]) v[2]=d; if(d>v[3]) v[3]=d; if(tm>v[4]) v[4]=tm; if(p.wt!=null&&isFinite(p.wt)) v[5]=Math.round(p.wt*10)/10; n++; }); dirty[k]=1; });
    saveSoon(); try{ window.dispatchEvent(new Event('alkyon-mydepth')); }catch(e){} return {n:n,cells:nc}; }); }
function cellD(v){ return v&&v[1]?v[0]/v[1]:null; }
/* το κοντινότερο κελί (ως ~35 m) από όσα πλακίδια είναι ήδη φορτωμένα — χωρίς αναμονή */
function nearSync(lat,lon,maxM){ maxM=maxM||35; var t=tiles[tk(lat,lon)]; if(!t) return null; var y=Math.floor(lat/CELL), x=Math.floor(lon/CELL), best=null, bd=1e9;
  for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++){ var k=(y+dy)+':'+(x+dx), tt=(dy||dx)?(tiles[tk((y+dy+0.5)*CELL,(x+dx+0.5)*CELL)]||t):t, v=tt[k]; if(!v) continue; var c=cellLL(k), m=hav(lat,lon,c[0],c[1]); if(m<bd){ bd=m; best=v; } }
  return best&&bd<=maxM?Math.round(cellD(best)*10)/10:null; }
function near(lat,lon,maxM){ var ks={}; [-1,0,1].forEach(function(a){ [-1,0,1].forEach(function(b){ ks[tk(lat+a*CELL*2,lon+b*CELL*2)]=1; }); });
  return Promise.all(Object.keys(ks).map(loadTile)).then(function(){ return nearSync(lat,lon,maxM); }); }
/* κελιά μέσα σε ένα πλαίσιο (για τον χάρτη) */
function cellsIn(s,w,n,e){ var ks=[]; for(var a=Math.floor(s/TILE);a<=Math.floor(n/TILE);a++) for(var b=Math.floor(w/TILE);b<=Math.floor(e/TILE);b++) ks.push(a+':'+b);
  if(ks.length>400) return Promise.resolve([]);
  return Promise.all(ks.map(loadTile)).then(function(){ var out=[]; ks.forEach(function(k){ var t=tiles[k]; for(var c in t){ var ll=cellLL(c); if(ll[0]>=s&&ll[0]<=n&&ll[1]>=w&&ll[1]<=e) out.push({lat:ll[0],lon:ll[1],d:cellD(t[c]),mn:t[c][2],mx:t[c][3],n:t[c][1],t:t[c][4],wt:t[c][5]}); } }); return out; }); }
function stats(){ return flush().then(idb).then(function(db){ return new Promise(function(res){ var o={cells:0,n:0,s:90,w:180,nn:-90,e:-180,last:0}, r=db.transaction('tiles').objectStore('tiles').openCursor();
    r.onsuccess=function(){ var cur=r.result; if(!cur){ res(o.cells?o:{cells:0,n:0}); return; } var t=cur.value||{}; for(var c in t){ var v=t[c], ll=cellLL(c); o.cells++; o.n+=v[1]; if(ll[0]<o.s) o.s=ll[0]; if(ll[0]>o.nn) o.nn=ll[0]; if(ll[1]<o.w) o.w=ll[1]; if(ll[1]>o.e) o.e=ll[1]; if(v[4]>o.last) o.last=v[4]; } cur.continue(); };
    r.onerror=function(){ res({cells:0,n:0}); }; }); }).catch(function(){ return {cells:0,n:0}; }); }
function clearAll(){ tiles={}; dirty={}; return idb().then(function(db){ return new Promise(function(res){ var tx=db.transaction('tiles','readwrite'); tx.objectStore('tiles').clear(); tx.oncomplete=res; tx.onerror=res; }); }).catch(function(){}).then(function(){ try{ window.dispatchEvent(new Event('alkyon-mydepth')); }catch(e){} }); }

/* ---------- ζωντανά: Signal K ---------- */
var ws=null, st={state:'off',d:null,dAt:0,wt:null,pos:null,posAt:0,sog:null,path:'',err:'',host:''}, retry=0, rtm=null, lastRec=null, want=false;
function url(c){ if(c.demo) return 'wss://demo.signalk.org/signalk/v1/stream?subscribe=none';
  var x=c.host.trim().replace(/\/+$/,''); if(!x) return null;
  if(/^wss?:\/\//i.test(x)) return x.replace(/\/signalk.*$/i,'')+'/signalk/v1/stream?subscribe=none';
  x=x.replace(/^https?:\/\//i,'').replace(/\/.*$/,''); var sec=location.protocol==='https:'; if(!/:\d+$/.test(x)) x+=sec?':3443':':3000';
  return (sec?'wss://':'ws://')+x+'/signalk/v1/stream?subscribe=none'; }
function pageUrl(c){ var u=url(c); return u?u.replace(/^ws/,'http').replace(/\/signalk\/v1\/stream.*$/,'/'):null; }
var PATHS=['environment.depth.belowSurface','environment.depth.belowTransducer','environment.depth.belowKeel'];
function onDelta(m){ if(!m||!m.updates) return; var now=Date.now(), got=false;
  m.updates.forEach(function(u){ (u.values||[]).forEach(function(v){ var p=v.path, x=v.value;
    if(PATHS.indexOf(p)>=0&&typeof x==='number'&&isFinite(x)){ var rank=PATHS.indexOf(p), cur=PATHS.indexOf(st.path);
      if(cur<0||rank<=cur||now-st.dAt>5000){ var c=cfg(), d=p==='environment.depth.belowSurface'?x:x+(c.off||0); if(d>0&&d<3000){ st.d=d; st.dAt=now; st.path=p; got=true; } } }
    else if(p==='environment.water.temperature'&&typeof x==='number') st.wt=x>200?x-273.15:x;
    else if(p==='navigation.position'&&x&&isFinite(x.latitude)&&isFinite(x.longitude)){ st.pos={lat:x.latitude,lon:x.longitude}; st.posAt=now; }
    else if(p==='navigation.speedOverGround'&&typeof x==='number') st.sog=x*1.943844; }); });
  if(st.state!=='live'){ st.state='live'; st.err=''; retry=0; }
  if(got) record(); emit(); }
function boatPos(){ var now=Date.now(); if(st.pos&&now-st.posAt<10000) return st.pos; var p=B.lastPos&&B.lastPos(); return p&&p.t&&now-p.t<15000?p:null; }
function record(){ var c=cfg(); if(c.demo||!c.rec||st.d==null) return; var p=boatPos(); if(!p) return; var now=Date.now();
  if(lastRec&&now-lastRec.t<2000) return; if(lastRec&&hav(lastRec.lat,lastRec.lon,p.lat,p.lon)<6&&Math.abs(lastRec.d-st.d)<0.3&&now-lastRec.t<15000) return;
  lastRec={lat:p.lat,lon:p.lon,d:st.d,t:now}; add([{lat:p.lat,lon:p.lon,d:st.d,t:now,wt:st.wt}]); }
function connect(){ var c=cfg(); want=c.src==='sk'; clearTimeout(rtm); if(ws){ try{ ws.onclose=null; ws.close(); }catch(e){} ws=null; }
  if(c.src==='net'){ netStart(); return; } netStop();
  if(!want){ st.state='off'; st.d=null; emit(); return; }
  var u=url(c); if(!u){ st.state='err'; st.err=T('Γράψε τη διεύθυνση του server','Enter the server address'); emit(); return; }
  st.state='connecting'; st.host=u; st.err=''; emit();
  try{ ws=new WebSocket(u); }catch(e){ st.state='err'; st.err=String(e&&e.message||e); emit(); again(); return; }
  var opened=false;
  ws.onopen=function(){ opened=true; try{ ws.send(JSON.stringify({context:'vessels.self',subscribe:PATHS.concat(['environment.water.temperature','navigation.position','navigation.speedOverGround']).map(function(p){ return {path:p,period:1000,policy:'instant',minPeriod:500}; })})); }catch(e){} st.state='open'; emit(); };
  ws.onmessage=function(ev){ var m; try{ m=JSON.parse(ev.data); }catch(e){ return; } onDelta(m); };
  ws.onerror=function(){ st.err=opened?T('Η σύνδεση κόπηκε','Connection dropped'):T('Δεν συνδέθηκε. Είσαι στο WiFi του σκάφους; Δέχτηκες το πιστοποιητικό του server;','Could not connect. Are you on the boat WiFi? Did you accept the server certificate?'); };
  ws.onclose=function(){ ws=null; if(!want) return; st.state='err'; if(!st.err) st.err=T('Η σύνδεση έκλεισε','Connection closed'); emit(); again(); }; }
function again(){ clearTimeout(rtm); if(!want) return; retry=Math.min(retry+1,6); rtm=setTimeout(function(){ if(want&&document.visibilityState!=='hidden') connect(); else again(); },[0,2,4,8,15,30,60][retry]*1000); }
document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible'&&want&&!ws) connect(); if(document.visibilityState==='hidden') flush(); });
window.addEventListener('pagehide',function(){ flush(); });
/* ---------- 1.13.1 · Δίκτυο σκάφους (NMEA 0183 μέσω WiFi, μόνο στην εφαρμογή Android) ---------- */
/* Συνηθισμένες πόρτες: 10110 (πρότυπο NMEA/IP), 2000/2002 (Yacht Devices, Digital Yacht), 11101 (PredictWind), 60001 (Quark-elec),
   10021–10040 (δίκτυο NavNet της Furuno), 50000, 4123, 1456. Multicast: 239.255.0.x (NavNet). */
var NET_UDP=[10110,2000,2002,11101,60001,50000,4123,1456,8888].concat((function(){ var a=[]; for(var p=10021;p<=10040;p++) a.push(p); return a; })());
var NET_GROUPS=(function(){ var a=[]; for(var i=1;i<=12;i++) a.push('239.255.0.'+i); return a; })();
var NET_SCAN=[10110,2000,2001,2002,2003,4123,1456,5000,6000,8000,8080,8888,9000,10000,10021,10110,11101,39150,50000,60001,3000,3443,80,443,23,7];
var diag={}, diagN=0, diagDrop=0, netL=null, netOn=false, netBuf={};
function NET(){ return window.AKN&&window.AKN.net||null; }
function tcpList(c){ return String(c.tcp||'').split(/[\s,;]+/).map(function(x){ var m=/^([^:\s]+):(\d{1,5})$/.exec(x.trim()); return m?{host:m[1],port:+m[2]}:null; }).filter(Boolean); }
function netStart(){ var P=NET(), c=cfg(); if(!P){ st.state='err'; st.err=T('Μόνο στην εφαρμογή Android','Only in the Android app'); emit(); return; }
  st.state='connecting'; st.err=''; st.host=T('δίκτυο σκάφους','boat network'); emit();
  var go=function(){ return P.start({udp:NET_UDP,groups:NET_GROUPS,tcp:tcpList(c)}).then(function(r){ netOn=true; st.state='open'; st.udp=(r&&r.udp)||[]; st.bad=(r&&r.bad)||[]; emit(); }); };
  (netL?Promise.resolve():Promise.resolve(P.addListener('data',onNet)).then(function(l){ netL=l; })).then(go).catch(function(e){ st.state='err'; st.err=String(e&&e.message||e); emit(); }); }
function netStop(){ var P=NET(); if(P&&netOn){ netOn=false; try{ P.stop(); }catch(e){} } }
function dkey(it){ return it.p+':'+it.port; }
function onNet(ev){ var items=(ev&&ev.items)||[]; diagDrop+=(ev&&ev.drop)||0; var now=Date.now();
  items.forEach(function(it){ var k=dkey(it), d=diag[k]||(diag[k]={p:it.p,port:it.port,n:0,bytes:0,from:{},lines:[],types:{},hex:'',err:'',at:0});
    if(it.err){ d.err=it.err; d.at=now; return; } d.n++; diagN++; d.bytes+=it.n||0; d.at=now; if(it.from) d.from[it.from]=1;
    if(it.hex){ d.hex=it.hex; return; }
    if(it.txt){ var buf=(netBuf[k+it.from]||'')+it.txt, parts=buf.split(/\r?\n/); netBuf[k+it.from]=parts.pop().slice(-300);
      if(it.p==='udp'&&parts.length===0&&/^[$!]/.test(buf)){ parts=[buf]; netBuf[k+it.from]=''; } /* ένα NMEA ανά πακέτο UDP χωρίς \n */
      parts.forEach(function(L){ L=L.trim(); if(!L) return; d.lines.push(L.slice(0,120)); if(d.lines.length>8) d.lines.shift();
        var m=/^[$!]([A-Z]{2})([A-Z]{3}),/.exec(L); if(m){ d.types[m[2]]=(d.types[m[2]]||0)+1; nmeaLine(L,m[2]); } }); } });
  if(items.length) emit(); }
function nmeaLine(L,ty){ var f=L.replace(/\*[0-9A-Fa-f]{2}\s*$/,'').split(','), now=Date.now(), c=cfg(), d=NaN;
  function ll(v,hm){ var x=parseFloat(v); if(!isFinite(x)) return NaN; var deg=Math.floor(x/100), r=deg+(x-deg*100)/60; return (hm==='S'||hm==='W')?-r:r; }
  if(ty==='DPT'){ var a=parseFloat(f[1]), off=parseFloat(f[2]); if(isFinite(a)) d=isFinite(off)&&off>0?a+off:a+(c.off||0); }
  else if(ty==='DBT'){ var mtr=parseFloat(f[3]), ft=parseFloat(f[1]); d=(isFinite(mtr)?mtr:(isFinite(ft)?ft*0.3048:NaN))+(c.off||0); }
  else if(ty==='DBS'){ var m2=parseFloat(f[3]), f2=parseFloat(f[1]); d=isFinite(m2)?m2:(isFinite(f2)?f2*0.3048:NaN); }
  else if(ty==='MTW'){ var t=parseFloat(f[1]); if(isFinite(t)) st.wt=t; }
  else if(ty==='GGA'&&f[6]&&f[6]!=='0'){ var la=ll(f[2],f[3]), lo=ll(f[4],f[5]); if(isFinite(la)&&isFinite(lo)){ st.pos={lat:la,lon:lo}; st.posAt=now; } }
  else if(ty==='RMC'&&f[2]==='A'){ var la2=ll(f[3],f[4]), lo2=ll(f[5],f[6]); if(isFinite(la2)&&isFinite(lo2)){ st.pos={lat:la2,lon:lo2}; st.posAt=now; } var k=parseFloat(f[7]); if(isFinite(k)) st.sog=k; }
  else if(ty==='GLL'&&f[6]!=='V'){ var la3=ll(f[1],f[2]), lo3=ll(f[3],f[4]); if(isFinite(la3)&&isFinite(lo3)){ st.pos={lat:la3,lon:lo3}; st.posAt=now; } }
  else if(ty==='VTG'){ var kn=parseFloat(f[5]); if(isFinite(kn)) st.sog=kn; }
  if(isFinite(d)&&d>0.2&&d<3000){ st.d=d; st.dAt=now; st.path='nmea:'+ty; st.state='live'; st.err=''; record(); } }
function diagText(){ var ks=Object.keys(diag).sort(); var out=['Alkyon '+(window.ALKYON_VERSION||'')+' · '+new Date().toISOString()+' · '+T('πακέτα','packets')+' '+diagN+(diagDrop?' (+'+diagDrop+' skip)':'')];
  if(st.ifs) out.push('phone: '+st.ifs.map(function(i){ return i.name+' '+i.ip+'/'+i.prefix; }).join(', '));
  if(st.bad&&st.bad.length) out.push('bad: '+st.bad.join('; '));
  ks.forEach(function(k){ var d=diag[k]; out.push(k+' · '+d.n+' pk · '+d.bytes+' B · from '+Object.keys(d.from).join(' ')+(d.err?' · '+d.err:'')+(Object.keys(d.types).length?' · '+Object.keys(d.types).map(function(t){ return t+'×'+d.types[t]; }).join(' '):''));
    d.lines.slice(-4).forEach(function(L){ out.push('   '+L); }); if(d.hex) out.push('   hex '+d.hex); });
  if(!ks.length) out.push(T('Δεν έχει έρθει τίποτα ακόμα.','Nothing received yet.')); return out.join('\n'); }

function live(){ return st.d!=null&&Date.now()-st.dAt<15000?st.d:null; }
/* ζωντανό βάθος, αν το σημείο είναι κοντά στο σκάφος */
function liveAt(lat,lon,maxM){ var d=live(); if(d==null) return null; var p=boatPos(); if(!p||lat==null) return d; return hav(lat,lon,p.lat,p.lon)<=(maxM||60)?Math.round(d*10)/10:null; }

/* ---------- B.depthAt: βυθόμετρο → ο βυθός μου → χάρτης ---------- */
function wrap(){ var base=B.depthAt; if(!base||base._snd) return; var f=function(lat,lon){ var lv=liveAt(lat,lon,60); if(lv!=null){ B.lastDepthSrc='sounder'; return Promise.resolve(lv); }
    return near(lat,lon,35).then(function(v){ if(v!=null){ B.lastDepthSrc='mine'; return v; } return base(lat,lon).then(function(x){ B.lastDepthSrc='chart'; return x; }); }); };
  f._snd=true; f._base=base; B.depthAt=f; }
wrap(); setTimeout(wrap,0); document.addEventListener('DOMContentLoaded',wrap);

/* ---------- εισαγωγή αρχείου ---------- */
function loadParser(){ return window.AlkSounderParse?Promise.resolve(window.AlkSounderParse):(B.loadScripts?B.loadScripts(['sounder-parse.js']):Promise.reject()).then(function(){ return window.AlkSounderParse; }); }
function readFile(f){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; r.readAsArrayBuffer(f); }); }
function importFile(f){ return importFiles([f]); }
/* 1.10.13: πολλά αρχεία μαζί (Humminbird: το .DAT και τα B00x.SON της καταγραφής) */
function importFiles(fs){ fs=[].slice.call(fs); return Promise.all([loadParser()].concat(fs.map(readFile))).then(function(a){ var P=a[0]; return P.parseMany(fs.map(function(f,i){ return {name:f.name,buf:a[i+1]}; })); }); }

/* ---------- ρυθμίσεις ---------- */
function fmtD(d){ var U=window.AlkyonUnits; return U&&U.depth?U.depth(d):(Math.round(d*10)/10+' m'); }
function stTxt(){ var c=cfg(); if(c.src==='off') return T('Ανενεργό','Off');
  if(c.src==='net'){ if(st.state==='err') return '⚠ '+(st.err||T('Σφάλμα','Error')); if(live()!=null) return '● '+T('Βάθος από το δίκτυο','Depth from the network')+' · '+fmtD(live())+(st.wt!=null?' · '+st.wt.toFixed(1)+' °C':'');
    if(st.state==='connecting') return T('Ξεκινά…','Starting…'); return '● '+T('Ακούει στο δίκτυο','Listening on the network')+' · '+diagN+T(' πακέτα',' packets')+(diagN?T(', χωρίς βάθος ακόμα',', no depth yet'):''); }
  if(st.state==='live'&&live()!=null) return '● '+T('Συνδεδεμένο','Connected')+' · '+fmtD(live())+(st.wt!=null?' · '+st.wt.toFixed(1)+' °C':'')+(c.demo?T(' (δοκιμή)',' (demo)'):'');
  if(st.state==='live'||st.state==='open') return '● '+T('Συνδεδεμένο, περιμένει βάθος…','Connected, waiting for depth…');
  if(st.state==='connecting') return T('Σύνδεση…','Connecting…'); if(st.state==='err') return '⚠ '+(st.err||T('Σφάλμα','Error')); return T('Αποσυνδεδεμένο','Disconnected'); }
function summary(){ var c=cfg(); if(c.src==='net') return T('Δίκτυο σκάφους (WiFi)','Boat network (WiFi)'); return c.src==='sk'?T('Signal K · ','Signal K · ')+(c.demo?T('δοκιμή','demo'):(c.host||'—')):T('Ανενεργό · και από αρχείο','Off · or from a file'); }
function sheet(){
  var c=cfg(), stEl=h('p',{class:'sndst',role:'status',text:stTxt()});
  var host=h('input',{type:'text',inputmode:'url',autocapitalize:'off',spellcheck:'false',placeholder:'venus.local',value:c.host,'aria-label':T('Διεύθυνση server Signal K','Signal K server address')});
  var off=h('input',{type:'number',inputmode:'decimal',step:'0.1',min:'0',max:'5',value:c.off?String(c.off):'',placeholder:'0','aria-label':T('Βάθος αισθητήρα (m)','Transducer depth (m)')});
  var rec=h('input',{type:'checkbox',checked:c.rec});
  function seg(v){ return h('button',{type:'button',class:'chip'+(cfg().src===v?' on':''),'aria-pressed':String(cfg().src===v),text:v==='sk'?'Signal K':v==='net'?T('Δίκτυο σκάφους (WiFi)','Boat network (WiFi)'):T('Ανενεργό','Off'),onclick:function(){ setCfg({src:v,demo:false,host:host.value.trim()}); connect(); paint(); }}); }
  function preset(lbl,val){ return h('button',{type:'button',class:'chip sm',text:lbl,onclick:function(){ host.value=val; setCfg({src:'sk',host:val,demo:false}); connect(); paint(); }}); }
  var segs=h('div',{class:'chips'}), box=h('div',{class:'sndsk'}), nbox=h('div',{class:'sndnet'}), mine=h('div',{class:'sndmine'}), imp=h('div',{class:'sndimp'});
  var file=h('input',{type:'file',accept:'.sl2,.sl3,.son,.dat,.rsd,.gpx,.csv,.nmea,.txt,.log,.nma',multiple:true,hidden:true});
  function paint(){ var c2=cfg(); segs.replaceChildren.apply(segs,[seg('off'),seg('sk')].concat(NET()||c2.src==='net'?[seg('net')]:[])); box.hidden=c2.src!=='sk'; nbox.hidden=c2.src!=='net'; stEl.textContent=stTxt(); paintDiag(); }
  /* «Δίκτυο σκάφους»: οδηγίες, TCP, σάρωση plotter, και ό,τι έρχεται από το δίκτυο */
  var tcpIn=h('input',{type:'text',inputmode:'url',autocapitalize:'off',spellcheck:'false',placeholder:'192.168.4.1:10110',value:c.tcp,'aria-label':T('Σύνδεση TCP','TCP connection')});
  var scanIn=h('input',{type:'text',inputmode:'decimal',autocapitalize:'off',spellcheck:'false',placeholder:'192.168.43.24',value:c.scan,'aria-label':T('Διεύθυνση plotter','Plotter address')});
  var scanOut=h('p',{class:'sub'}), ipEl=h('p',{class:'sub'}), diagEl=h('pre',{class:'snddiag'});
  tcpIn.addEventListener('change',function(){ setCfg({tcp:tcpIn.value.trim()}); connect(); paint(); });
  scanIn.addEventListener('change',function(){ setCfg({scan:scanIn.value.trim()}); });
  function paintDiag(){ if(nbox.hidden) return; diagEl.textContent=diagText(); }
  function showIps(){ var P=NET(); if(!P||!P.info) return; P.info().then(function(r){ st.ifs=(r&&r.ifs)||[]; ipEl.textContent=st.ifs.length?T('Το κινητό: ','This phone: ')+st.ifs.map(function(i){ return i.ip; }).join(', '):T('Το κινητό δεν είναι σε κανένα δίκτυο.','The phone is not on any network.'); }).catch(function(){}); }
  nbox.append(
    h('p',{class:'sub',text:T('Το Alkyon ακούει στο WiFi για NMEA 0183 (βάθος, θερμοκρασία νερού, θέση) από το plotter ή από πύλη NMEA (Yacht Devices, Digital Yacht, Quark-elec, PredictWind κ.ά.). Δείχνει και ό,τι άλλο έρχεται, για να δούμε τι στέλνει το plotter.','Alkyon listens on WiFi for NMEA 0183 (depth, water temperature, position) from the plotter or an NMEA gateway (Yacht Devices, Digital Yacht, Quark-elec, PredictWind etc.). It also shows anything else that arrives, so we can see what the plotter sends.')}),
    h('details',{class:'sndhow',open:true},h('summary',{text:T('Βήματα','Steps')}),
      h('p',{text:T('1. Άνοιξε το hotspot στο κινητό (ή μπες στο WiFi του σκάφους ή της πύλης).','1. Turn on the phone’s hotspot (or join the boat’s or gateway’s WiFi).')}),
      h('p',{text:T('2. Στο plotter: Ρυθμίσεις › Wireless LAN › σύνδεση στο hotspot του κινητού. Γράψε τη διεύθυνση IP που δείχνει.','2. On the plotter: Settings › Wireless LAN › join the phone’s hotspot. Note the IP address it shows.')}),
      h('p',{text:T('3. Άφησε αυτή τη σελίδα ανοιχτή 1–2 λεπτά. Αν φανεί βάθος πάνω, είσαι έτοιμος. Αλλιώς πάτα «Σάρωση» με τη διεύθυνση του plotter και στείλε μας την «Αναφορά».','3. Keep this page open for 1–2 minutes. If a depth shows above, you are done. Otherwise tap “Scan” with the plotter address and send us the “Report”.')})),
    ipEl,
    h('label',{class:'fld'},h('span',{text:T('Διεύθυνση plotter ή πύλης (για σάρωση)','Plotter or gateway address (to scan)')}),scanIn),
    h('div',{class:'row2'},h('button',{type:'button',class:'btn',text:T('Σάρωση πορτών TCP','Scan TCP ports'),onclick:function(ev){ var P=NET(), host=scanIn.value.trim(); if(!P||!host){ scanOut.textContent=T('Γράψε πρώτα τη διεύθυνση IP.','Enter the IP address first.'); return; }
        setCfg({scan:host}); ev.target.disabled=true; scanOut.textContent=T('Σάρωση…','Scanning…');
        P.scan({host:host,ports:NET_SCAN,timeout:800}).then(function(r){ var o=(r&&r.open)||[]; st.scanRes=host+': '+(o.length?o.join(', '):'—');
          scanOut.replaceChildren(h('span',{text:o.length?T('Ανοιχτές πόρτες: ','Open ports: '):T('Καμία ανοιχτή πόρτα από τη λίστα.','No open port from the list.')}),
            ...o.map(function(p){ return h('button',{type:'button',class:'chip sm',text:String(p),onclick:function(){ tcpIn.value=host+':'+p; setCfg({tcp:tcpIn.value}); connect(); paint(); }}); })); })
          .catch(function(e){ scanOut.textContent='⚠ '+String(e&&e.message||e); }).then(function(){ ev.target.disabled=false; }); }}),
      h('button',{type:'button',class:'btn',text:T('Αναφορά (αντιγραφή)','Report (copy)'),onclick:function(ev){ var t=diagText()+(st.scanRes?'\nscan '+st.scanRes:''); var b=ev.target;
        (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject()).then(function(){ b.textContent=T('Αντιγράφηκε ✓','Copied ✓'); },function(){ if(navigator.share) navigator.share({text:t}).catch(function(){}); }); }})),
    scanOut,
    h('label',{class:'fld'},h('span',{text:T('Σύνδεση TCP (προαιρετικά, διεύθυνση:πόρτα)','TCP connection (optional, address:port)')}),tcpIn),
    h('h3',{class:'listh',text:T('Τι έρχεται από το δίκτυο','What arrives from the network')}),diagEl);
  showIps();
  host.addEventListener('change',function(){ setCfg({host:host.value.trim(),demo:false}); connect(); paint(); });
  off.addEventListener('change',function(){ var v=parseFloat(String(off.value).replace(',','.')); setCfg({off:isFinite(v)&&v>=0&&v<=5?v:0}); });
  rec.addEventListener('change',function(){ setCfg({rec:rec.checked}); });
  box.append(
    h('label',{class:'fld'},h('span',{text:T('Διεύθυνση server','Server address')}),host),
    h('div',{class:'chips'},preset('Cerbo GX','venus.local'),preset('Raspberry Pi','openplotter.local'),
      h('button',{type:'button',class:'chip sm',text:T('Δοκιμή (demo)','Try (demo)'),onclick:function(){ setCfg({src:'sk',demo:true}); connect(); paint(); }})),
    h('label',{class:'fld'},h('span',{text:T('Βάθος αισθητήρα κάτω από την επιφάνεια (m)','Transducer depth below the surface (m)')}),off),
    h('label',{class:'tg'},rec,h('span',null,h('b',{text:T('Καταγραφή στον «Βυθό μου»','Record to “My depths”')}),h('small',{class:'tgs',text:T('Κάθε λίγα μέτρα κρατά το βάθος εκεί που περνάς. Μένει στο κινητό.','Keeps the depth every few metres along your track. Stays on the phone.')}))),
    h('div',{class:'row2'},h('button',{type:'button',class:'btn',text:T('Επανασύνδεση','Reconnect'),onclick:function(){ retry=0; connect(); }}),
      h('button',{type:'button',class:'btn',text:T('Σελίδα server (πιστοποιητικό)','Server page (certificate)'),onclick:function(){ var u=pageUrl(cfg()); if(u) window.open(u,'_blank','noopener'); }})),
    h('details',{class:'sndhow'},h('summary',{text:T('Πώς το στήνω','How to set it up')}),
      h('p',{text:T('Victron Cerbo GX: Ρυθμίσεις › Firmware › εγκατάσταση «Venus OS Large», μετά Ρυθμίσεις › Venus OS Large features › Signal K: Ενεργό. Το Furuno και ο Cerbo στο ίδιο δίκτυο NMEA 2000 (VE.Can).','Victron Cerbo GX: Settings › Firmware › install “Venus OS Large”, then Settings › Venus OS Large features › Signal K: Enabled. Furuno and the Cerbo on the same NMEA 2000 network (VE.Can).')}),
      h('p',{text:T('Raspberry Pi: OpenPlotter (με Signal K) και μετατροπέας NMEA 2000 (π.χ. PICAN-M ή Actisense NGT-1).','Raspberry Pi: OpenPlotter (with Signal K) and an NMEA 2000 adapter (e.g. PICAN-M or Actisense NGT-1).')}),
      h('p',{text:T('Και στα δύο: στον Signal K άνοιξε SSL (πόρτα 3443) και «Allow Readonly Access». Το κινητό στο WiFi του σκάφους. Την πρώτη φορά πάτα «Σελίδα server» και δέξου το πιστοποιητικό, μετά «Επανασύνδεση».','Both: in Signal K turn on SSL (port 3443) and “Allow Readonly Access”. Phone on the boat WiFi. The first time tap “Server page”, accept the certificate, then “Reconnect”.')}),
      h('p',{text:T('Αν δεν βρίσκει το «venus.local» ή το «openplotter.local», γράψε τη διεύθυνση IP (π.χ. 192.168.1.10), όπως φαίνεται στις ρυθμίσεις δικτύου του Cerbo ή του Pi. Αν ο Chrome ρωτήσει για «συσκευές στο τοπικό δίκτυο», πάτα «Να επιτρέπεται».','If it cannot find “venus.local” or “openplotter.local”, enter the IP address (e.g. 192.168.1.10) shown in the Cerbo’s or Pi’s network settings. If Chrome asks about “devices on your local network”, tap “Allow”.')}),
      h('p',{text:T('Το «Δοκιμή (demo)» συνδέεται στον δημόσιο server του Signal K για να δεις ότι δουλεύει. Δεν καταγράφει.','“Try (demo)” connects to the public Signal K server so you can see it working. It does not record.')})));
  imp.append(h('p',{class:'sub',text:T('Lowrance/Simrad (.sl2, .sl3), Garmin (.RSD), Humminbird (διάλεξε μαζί το .DAT και τα .SON της καταγραφής), καταγραφή NMEA 0183, GPX με βάθος, CSV (Deeper κ.ά.). Τα αρχεία διαβάζονται στο κινητό.','Lowrance/Simrad (.sl2, .sl3), Garmin (.RSD), Humminbird (pick the recording’s .DAT and .SON files together), NMEA 0183 log, GPX with depth, CSV (Deeper etc.). Files are read on the phone.')}),
    h('button',{type:'button',class:'btn',text:T('Διάλεξε αρχείο','Choose a file'),onclick:function(){ file.click(); }}),file);
  file.addEventListener('change',function(){ var fl=file.files?[].slice.call(file.files):[]; file.value=''; if(!fl.length) return; var out=h('p',{class:'sub',text:T('Ανάγνωση…','Reading…')}); imp.append(out);
    importFiles(fl).then(function(r){ var p=r.pts; if(!p.length){ out.textContent=T('Δεν βρέθηκαν βάθη με θέση σε αυτό το αρχείο.','No depths with a position were found in this file.'); return; }
      var mn=1e9, mx=0; p.forEach(function(x){ if(x.d<mn) mn=x.d; if(x.d>mx) mx=x.d; });
      out.replaceChildren(h('span',{text:p.length+T(' μετρήσεις · βάθη ',' readings · depths ')+fmtD(mn)+' – '+fmtD(mx)+' '}),
        h('button',{type:'button',class:'btn pri sm',text:T('Αποθήκευση στον «Βυθό μου»','Save to “My depths”'),onclick:function(ev){ ev.target.disabled=true; add(p).then(flush).then(function(){ out.textContent=T('Αποθηκεύτηκαν ','Saved ')+p.length+T(' μετρήσεις.',' readings.'); paintMine(); }); }})); })
      .catch(function(){ out.textContent=T('Το αρχείο δεν διαβάστηκε.','The file could not be read.'); }); });
  function paintMine(){ stats().then(function(s){ mine.replaceChildren(
      h('p',{class:'sub',text:s.cells?(s.cells+T(' σημεία βυθού (κελιά ~20 m) από ',' depth cells (~20 m) from ')+s.n+T(' μετρήσεις.',' readings.')):T('Άδειο ακόμα. Γεμίζει από το βυθόμετρο ή από αρχείο.','Empty so far. It fills from the sounder or from a file.')}),
      s.cells?h('div',{class:'row2'},h('button',{type:'button',class:'btn',text:T('Στον χάρτη','On the map'),onclick:function(){ ls.set('alkyon-v4-mydepth',true); if(api) api.close(); if(s.s<=s.nn) try{ ls.set('alkyon-v4-mydepth-fit',[s.s,s.w,s.nn,s.e]); }catch(e){} location.hash='#map'; }}),
        h('button',{type:'button',class:'btn',text:T('Διαγραφή όλων','Delete all'),onclick:function(ev){ var b=ev.target; if(b.dataset.ok){ clearAll().then(paintMine); } else { b.dataset.ok='1'; b.textContent=T('Σίγουρα; Πάτα ξανά','Sure? Tap again'); setTimeout(function(){ if(b.isConnected){ delete b.dataset.ok; b.textContent=T('Διαγραφή όλων','Delete all'); } },4000); } }})):null); }); }
  var dTm=0, tick=function(){ stEl.textContent=stTxt(); var n=Date.now(); if(n-dTm>800){ dTm=n; paintDiag(); } }; window.addEventListener('alkyon-sounder',tick);
  var body=h('div',{class:'sndsheet'},
    h('p',{class:'sub',text:T('Το βάθος από το βυθόμετρο του σκάφους στην εφαρμογή: στον χάρτη, στα ψάρια που γράφεις, στη συρτή βυθού και στον «Βυθό μου».','The depth from your boat’s sounder in the app: on the map, in the catches you log, in bottom trolling and in “My depths”.')}),
    stEl,h('h3',{class:'listh',text:T('Ζωντανή σύνδεση','Live connection')}),segs,box,nbox,
    h('h3',{class:'listh',text:T('Από αρχείο βυθομέτρου','From a sounder file')}),imp,
    h('h3',{class:'listh',text:T('Ο βυθός μου','My depths')}),mine);
  paint(); paintMine();
  var api=B.sheet({title:T('Βυθόμετρο','Sounder'),body:body,onclose:function(){ window.removeEventListener('alkyon-sounder',tick); }});
  return api; }

B.sounder={cfg:cfg,set:function(p){ setCfg(p); connect(); },connect:connect,state:function(){ return st; },live:live,liveAt:liveAt,near:near,nearSync:nearSync,cellsIn:cellsIn,
  add:add,flush:flush,stats:stats,clear:clearAll,_net:onNet,diag:diagText,importFile:importFile,importFiles:importFiles,sheet:sheet,summary:summary,url:url,_delta:onDelta,_tiles:function(){ return tiles; }};
if(cfg().src!=='off') setTimeout(connect,1200);
})();
