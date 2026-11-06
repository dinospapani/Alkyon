/* Κατάσταση θάλασσας στον χάρτη (χρώματα) — ΕΚΤΙΜΗΣΗ, όχι μέτρηση, όχι ναυτικό όργανο.
   Κύπρος και Ελλάδα (με Αιγαίο/Ιόνιο), κελιά ~1 km έως 10 km από την ακτή, σε πλακίδια 1°×1° (cx_*.json, φτιάχνονται
   από το coastline-sync.yml: ακτογραμμή OSM, βάθος EMODnet).
   Ανά κελί:
   A) «Δική μας» εκτίμηση κοντά στην ακτή:
      - Κύμα ανέμου: SPM 1984 με fetch (ενεργό, της κατεύθυνσης του ανέμου), διάρκεια ανέμου και, όπου υπάρχει, βάθος
        (εξίσωση ρηχών νερών SPM 3-39). Διάρκεια: συνεχόμενες ώρες με περίπου ίδιο άνεμο (±45°, ≥50%) από ιστορικό 24 h.
      - Swell: μέσος όρος μοντέλων κύματος (Open-Meteo: DWD EWAM, ECMWF WAM, MeteoFrance MFWAM), μειωμένο όταν η ακτή
        κλείνει την κατεύθυνσή του (fetch 5 km = 0 έως 60 km = 1).
      - Σύνολο √(κύμα ανέμου² + swell²).
   B) Μοντέλα κύματος (σύνολο, wave_height): πιο αξιόπιστα ανοιχτά.
   Μείξη: βάρος μοντέλων = [απόσταση από ακτή 2→8 km] × [ανοιχτό προς τον άνεμο: fetch 10→50 km].
   Όριο βάθους: Hs ≤ 0,55·βάθος.
   Βεβαιότητα: υπολογισμός με κάθε μοντέλο ανέμου και κάθε μοντέλο κύματος· αν το ελάχιστο και το μέγιστο πέφτουν
   σε διαφορετική κατηγορία WMO, η περιοχή διαγραμμίζεται.
   Περίθλαση/διάθλαση κατά προσέγγιση (βεντάλια κατευθύνσεων, v31z384). ΔΕΝ περιλαμβάνει ρεύματα, βουνά (επιτάχυνση/σκιά ανέμου). */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var STEP=0.01, LAT_TOP=42, LON_LEFT=19; /* κοινό πλέγμα όλων των πλακιδίων */

/* ---------- φυσική ---------- */
var g=9.81;
/* SPM 1984: fetch- και duration-limited· ρηχά νερά (εξ. 3-39) όταν το βάθος περιορίζει */
function hsWind(u10,fkm,durH,depth){
  if(!(u10>0.2)) return 0;
  var ua=0.71*Math.pow(u10,1.23), U2=ua*ua, F=fkm*1000;
  if(durH>0&&isFinite(durH)){ var t=durH*3600, Fd=(U2/g)*Math.pow((g*t/ua)/68.8,1.5); if(Fd<F) F=Fd; }
  var gF=g*F/U2, deep=Math.min(0.0016*Math.sqrt(gF),0.2433);
  if(depth>0&&isFinite(depth)){
    var A=Math.tanh(0.530*Math.pow(g*depth/U2,0.75));
    if(A<0.98){ var sh=0.283*A*Math.tanh(0.00565*Math.sqrt(gF)/A); return Math.min(sh,deep)*U2/g; }
  }
  return deep*U2/g;
}
/* SPM 1984 περίοδος κορυφής κύματος ανέμου (βαθιά: 3-34, ρηχά: 3-40), με το ίδιο ενεργό fetch/διάρκεια */
function tpWind(u10,fkm,durH,depth){
  if(!(u10>0.2)) return 0;
  var ua=0.71*Math.pow(u10,1.23), U2=ua*ua, F=fkm*1000;
  if(durH>0&&isFinite(durH)){ var t=durH*3600, Fd=(U2/g)*Math.pow((g*t/ua)/68.8,1.5); if(Fd<F) F=Fd; }
  var gF=g*F/U2, deep=Math.min(0.2857*Math.pow(gF,1/3),8.134);
  if(depth>0&&isFinite(depth)){ var B=Math.tanh(0.833*Math.pow(g*depth/U2,0.375)); if(B<0.98){ var sh=7.54*B*Math.tanh(0.0379*Math.pow(gF,1/3)/B); return Math.min(sh,deep)*ua/g; } }
  return deep*ua/g;
}
function swellOpen(fkm){ return Math.max(0,Math.min(1,(fkm-5)/55)); }
function clamp01(x){ return x<0?0:x>1?1:x; }
var LV=[
  {max:0.5, el:'Ήρεμη / λεία', en:'Calm / smooth', r:'< 0,5 m', ren:'< 0.5 m'},
  {max:1.25,el:'Ελαφρά κυματώδης', en:'Slight', r:'0,5–1,25 m', ren:'0.5–1.25 m'},
  {max:2.5, el:'Μέτρια', en:'Moderate', r:'1,25–2,5 m', ren:'1.25–2.5 m'},
  {max:1e9, el:'Ταραγμένη', en:'Rough', r:'≥ 2,5 m', ren:'≥ 2.5 m'}
];
var BOUNDS=[0.5,1.25,2.5];
var GS=[[0,[52,168,120]],[0.25,[52,168,120]],[0.875,[240,200,80]],[1.875,[238,136,62]],[3,[208,66,72]]];
function grad(h){
  if(window.ALKYON_WAVEGRAD) return window.ALKYON_WAVEGRAD(h); /* v31z525: η v4 χρησιμοποιεί την κλίμακα του Windy (γαλάζιο → μπλε → μωβ) */
  if(!(h>0)) return GS[0][1];
  for(var i=1;i<GS.length;i++){ if(h<=GS[i][0]){ var a=GS[i-1], b=GS[i], t=(h-a[0])/(b[0]-a[0]); return [a[1][0]+(b[1][0]-a[1][0])*t,a[1][1]+(b[1][1]-a[1][1])*t,a[1][2]+(b[1][2]-a[1][2])*t]; } }
  return GS[GS.length-1][1];
}
function levelOf(h){ for(var i=0;i<LV.length;i++) if(h<LV[i].max) return i; return LV.length-1; }
function adiff(a,b){ var d=Math.abs(a-b)%360; return d>180?360-d:d; }

/* ---------- πλακίδια ---------- */
var IDXJ=null, IDXP=null, TL={};
function pad(n,w){ var s=String(Math.abs(n)); while(s.length<w) s='0'+s; return s; }
function tkey(la,lo){ return 'N'+pad(la,2)+'E'+pad(lo,3); }
function loadIndex(){
  if(IDXP) return IDXP;
  IDXP=fetch((window.ALKYON_BASE||'')+'cx_index.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(j){ IDXJ=(j&&Array.isArray(j.tiles))?j:{tiles:[]}; return IDXJ; })
    .catch(function(){ IDXP=null; IDXJ=null; return null; });
  return IDXP;
}
function hasTile(key){ return !!(IDXJ&&IDXJ.tiles.indexOf('cx_'+key)>=0); }
function rle(s,n,cb){ var i=0,pos=0,on=0; while(i<s.length&&pos<n){ var v=0,sh=0,b; do{ b=s.charCodeAt(i++); v|=(b&127)<<sh; sh+=7; }while(b&128&&i<s.length); if(on) cb(pos,Math.min(n,pos+v)); pos+=v; on^=1; } return pos===n; }
function bytes(b64){ var s=atob(b64), a=new Uint8Array(s.length); for(var i=0;i<s.length;i++) a[i]=s.charCodeAt(i); return a; }
function decodeTile(j){
  try{
    var n=j.w*j.h, idx=new Int32Array(n).fill(-1), k=0;
    if(!rle(atob(j.cells),n,function(a,b){ for(var q=a;q<b;q++) idx[q]=k++; })||k!==j.n) return null;
    var f=bytes(j.f); if(f.length!==k*16) return null;
    var d=j.d?bytes(j.d):null, z=j.z?bytes(j.z):null;
    var rings=[];
    (j.land||[]).forEach(function(fl){
      var m=fl.length>>1, xy=new Float64Array(fl.length), x=0, y=0, mnx=1e9, mny=1e9, mxx=-1e9, mxy=-1e9;
      for(var i=0;i<m;i++){ x+=fl[2*i]; y+=fl[2*i+1]; var lo=x/1e5, la=y/1e5; xy[2*i]=lo; xy[2*i+1]=la; if(lo<mnx) mnx=lo; if(lo>mxx) mxx=lo; if(la<mny) mny=la; if(la>mxy) mxy=la; }
      rings.push({xy:xy,b:[mnx,mny,mxx,mxy]});
    });
    return {lat1:j.lat1,lon0:j.lon0,w:j.w,h:j.h,idx:idx,f:f,d:d,z:z,rings:rings,hasLand:Array.isArray(j.land)};
  }catch(e){ return null; }
}
function loadTile(key){
  var o=TL[key]; if(o) return o.p;
  o={st:'loading'}; TL[key]=o;
  o.p=fetch((window.ALKYON_BASE||'')+'cx_'+key+'.json').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(j){ o.t=decodeTile(j); o.st=o.t?'ok':'bad'; })
    .catch(function(){ o.st='bad'; setTimeout(function(){ if(TL[key]===o) delete TL[key]; },60000); });
  return o.p;
}
function tileAt(lat,lon){ var o=TL[tkey(Math.floor(lat),Math.floor(lon))]; return o&&o.st==='ok'?o.t:null; }
/* κελί: {t,k} */
function cellAt(lat,lon){
  var t=tileAt(lat,lon); if(!t) return null;
  var c=Math.floor((lon-t.lon0)/STEP), r=Math.floor((t.lat1-lat)/STEP); if(c<0||r<0||c>=t.w||r>=t.h) return null;
  var k=t.idx[r*t.w+c]; return k<0?null:{t:t,k:k};
}
function qkm(q){ return q<=200?q*0.25:50+(q-200)*3; }
function fetchKm(cl,dir){
  var x=((dir%360)+360)%360/22.5, i0=Math.floor(x)%16, i1=(i0+1)%16, t=x-Math.floor(x), F=cl.t.f, k=cl.k*16;
  return qkm(F[k+i0])*(1-t)+qkm(F[k+i1])*t;
}
/* v31z384 · Κύμα που «στρίβει» γύρω από ακρωτήρια (περίθλαση) και προς την ακτή στα ρηχά (διάθλαση), κατά προσέγγιση:
   αντί για μία μόνο κατεύθυνση, το κύμα έρχεται σε μια βεντάλια γύρω από την κύρια κατεύθυνση (κατανομή cos^2s).
   Πίσω από ακρωτήριο φτάνει μέρος της ενέργειας από τις γειτονικές κατευθύνσεις που είναι ανοιχτές.
   Στα ρηχά (βάθος < μισό μήκος κύματος) η βεντάλια ανοίγει, γιατί το κύμα στρέφεται προς την ακτή.
   Ύψος = ύψος ανοιχτά × √(μέση ενέργεια που περνά). Ενδεικτικό, όχι φασματικό μοντέλο (SWAN κ.λπ.). */
function swellExpo(cl,dir,depth,per){
  var L0=1.56*Math.pow(per>0?per:7,2), shallow=isFinite(depth)&&depth<L0/2;
  /* v31z387: πιο φαρδιά βεντάλια (±60°, ρηχά ±80°): σε κόλπους πίσω από ακρωτήρια έδειχνε λιγότερο κύμα απ' όσο βλέπει κανείς */
  var span=shallow?80:60, pw=shallow?1:2, sw=0, se=0;
  for(var d=-span;d<=span;d+=10){ var c=Math.cos(d*Math.PI/180); if(c<=0) continue; var w=Math.pow(c,pw), o=swellOpen(fetchKm(cl,dir+d)); sw+=w; se+=w*o*o; }
  return sw?Math.sqrt(se/sw):swellOpen(fetchKm(cl,dir));
}
/* ενεργό fetch για κύμα ανέμου (μέθοδος SPM: μέσος όρος ±45° με βάρος cos²), ώστε στενά ανοίγματα να μη μετρούν σαν ανοιχτή θάλασσα */
function fetchEff(cl,dir){ var sw=0, sf=0; for(var d=-45;d<=45;d+=15){ var c=Math.cos(d*Math.PI/180), w=c*c; sw+=w; sf+=w*fetchKm(cl,dir+d); } return sf/sw; }
function distKm(cl){ return cl.t.d?cl.t.d[cl.k]*0.05:5; }
function depthM(cl){ if(!cl.t.z) return Infinity; var z=cl.t.z[cl.k]; return (z>0&&z<255)?z:Infinity; }

/* ---------- εξωτερικά δεδομένα ανά περιοχή χάρτη: ιστορικό ανέμου (διάρκεια) και μοντέλα κύματος ---------- */
/* v31z382: ECMWF WAM λέγεται πλέον ecmwf_wam025 στο Open-Meteo· το EWAM απορρίπτει όλο το αίτημα αν έστω ένα σημείο είναι στη στεριά, γι' αυτό υπάρχει και το best_match ως εφεδρικό */
var WAVE_MODELS=[['ecmwf_wam025','ECMWF WAM'],['meteofrance_wave','MF MFWAM'],['ewam','DWD EWAM']];
var REG=null;
function getJ(u){
  var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },25000);
  return fetch(u,{signal:ac.signal}).then(function(r){ clearTimeout(tm); if(!r.ok) return r.text().then(function(t){ var m=''; try{ m=(JSON.parse(t).reason||'').slice(0,80); }catch(e){} throw new Error('HTTP '+r.status+(m?' · '+m:'')); }); return r.json(); },function(e){ clearTimeout(tm); throw e; });
}
function lattice(b,maxN){
  var sp=Math.max(0.1,Math.sqrt((b.n-b.s)*(b.e-b.w)/maxN));
  var nla=Math.max(2,Math.round((b.n-b.s)/sp)+1), nlo=Math.max(2,Math.round((b.e-b.w)/sp)+1);
  return {la0:b.s,la1:b.n,lo0:b.w,lo1:b.e,nla:nla,nlo:nlo};
}
function latQ(L){ var la=[], lo=[]; for(var j=0;j<L.nla;j++) for(var i=0;i<L.nlo;i++){ la.push((L.la0+(L.la1-L.la0)*j/(L.nla-1)).toFixed(3)); lo.push((L.lo0+(L.lo1-L.lo0)*i/(L.nlo-1)).toFixed(3)); } return 'latitude='+la.join(',')+'&longitude='+lo.join(','); }
function arrOf(j){ return j==null?null:(Array.isArray(j)?j:[j]); }
function regionFor(b){
  /* 1.9.12: μεγαλύτερο περιθώριο (μισό της οθόνης, τουλάχιστον 0,5°), για λιγότερα νέα αιτήματα όταν μετακινείς τον χάρτη */
  var p=Math.max(0.5,Math.min(1.5,Math.max(b.getNorth()-b.getSouth(),b.getEast()-b.getWest())*0.5)), s=Math.floor((b.getSouth()-p)*4)/4, n=Math.ceil((b.getNorth()+p)*4)/4, w=Math.floor((b.getWest()-p)*4)/4, e=Math.ceil((b.getEast()+p)*4)/4;
  return {s:s,n:n,w:w,e:e,key:[s,n,w,e].join(',')};
}
function covers(R,b){ return R&&b.getSouth()>=R.b.s&&b.getNorth()<=R.b.n&&b.getWest()>=R.b.w&&b.getEast()<=R.b.e; }
function loadRegion(bounds){
  if(REG&&covers(REG,bounds)&&Date.now()-REG.at<3600000&&!REG.retry) return REG.p;
  /* v31z388: οι τελευταίες περιοχές μένουν στη μνήμη, ώστε πήγαινε-έλα στον χάρτη να μην ξαναζητά από το Open-Meteo */
  var old=(window.__ndSeaRegs||[]).filter(function(x){ return covers(x,bounds)&&Date.now()-x.at<3600000&&!x.retry; })[0]; if(old){ REG=old; return old.p; }
  var b=regionFor(bounds), R={b:b,at:Date.now(),t0:Date.now(),done:false,wind:null,waves:[]}, NP=lattice(b,25), WP=lattice(b,Math.min(150,Math.max(49,Math.round((b.n-b.s)*(b.e-b.w)/3)))); /* 1.5.3: μεγαλύτερη περιοχή → περισσότερα σημεία (έως 150) */
  var pw=getJ('https://api.open-meteo.com/v1/forecast?'+latQ(NP)+'&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&past_hours=24&forecast_hours=121&timezone=UTC')
    .then(function(j){ var a=arrOf(j); if(!a||a.length!==NP.nla*NP.nlo||!a[0].hourly) return; R.wind={L:NP,t:a[0].hourly.time,sp:a.map(function(p){ return (p.hourly&&p.hourly.wind_speed_10m)||[]; }),dir:a.map(function(p){ return (p.hourly&&p.hourly.wind_direction_10m)||[]; })}; })
    .catch(function(){ R.retry=true; });
  /* v31z383: κάθε μοντέλο ζητιέται σε μικρά κομμάτια (20 σημεία), ώστε ένα σημείο στη στεριά ή ένα όριο να μη χαλάει όλο τον χάρτη.
     Τα σφάλματα κρατιούνται (R.err) και φαίνονται στις «Πληροφορίες». */
  R.err={};
  var pts=[]; for(var jj=0;jj<WP.nla;jj++) for(var ii=0;ii<WP.nlo;ii++) pts.push([(WP.la0+(WP.la1-WP.la0)*jj/(WP.nla-1)).toFixed(3),(WP.lo0+(WP.lo1-WP.lo0)*ii/(WP.nlo-1)).toFixed(3)]);
  function col(p,base){ var H=(p&&p.hourly)||{}; if(H[base]) return H[base]; for(var k in H) if(k.indexOf(base+'_')===0) return H[k]; return []; }
  function waveModel(model,name){
    var CH=25, chunks=[]; for(var c=0;c<pts.length;c+=CH) chunks.push(pts.slice(c,c+CH));
    var all=new Array(pts.length), okN=0, lastErr='';
    return chunks.reduce(function(pr,ch,ci){ return pr.then(function(){ return ci?new Promise(function(r){ setTimeout(r,400); }):null; }).then(function(){
      var q='latitude='+ch.map(function(x){ return x[0]; }).join(',')+'&longitude='+ch.map(function(x){ return x[1]; }).join(',');
      return getJ('https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_direction,swell_wave_period'+(model?'&models='+model:'')+'&past_hours=1&forecast_hours=121&timezone=UTC')
        .then(function(j){ var a=arrOf(j); if(!a) return; a.forEach(function(p,k){ all[ci*CH+k]=p; }); okN++; })
        .catch(function(e){ lastErr=(e&&e.message)||'error'; });
    }); },Promise.resolve()).then(function(){
      if(!okN){ R.err[name]=lastErr||'—'; if(/429/.test(lastErr)) R.retry=true; return; }
      var first=all.filter(function(p){ return p&&p.hourly&&p.hourly.time; })[0]; if(!first){ R.err[name]=T('χωρίς δεδομένα','no data'); return; }
      var any=all.some(function(p){ return p&&col(p,'wave_height').some(function(x){ return x!=null; }); }); if(!any){ R.err[name]=T('χωρίς δεδομένα','no data'); return; }
      var tl=first.hourly.time, nul=tl.map(function(){ return null; }), get=function(p,b){ var v=p?col(p,b):null; return v&&v.length?v:nul; };
      R.waves.push({id:model||'best',name:name,L:WP,t:tl,h:all.map(function(p){ return get(p,'wave_height'); }),tp:all.map(function(p){ return get(p,'wave_period'); }),wd:all.map(function(p){ return get(p,'wave_direction'); }),sh:all.map(function(p){ return get(p,'swell_wave_height'); }),sd:all.map(function(p){ return get(p,'swell_wave_direction'); }),st:all.map(function(p){ return get(p,'swell_wave_period'); })});
      if(lastErr) R.err[name]=T('μερικά: ','partial: ')+lastErr;
    });
  }
  /* ένα-ένα τα μοντέλα, για να μη χτυπάμε το όριο αιτημάτων ανά λεπτό */
  /* v31z386: το τρίτο μοντέλο (EWAM) ζητιέται μόνο αν δεν φόρτωσαν τα δύο πρώτα, για να μη χτυπάμε το όριο αιτημάτων ανά λεπτό (HTTP 429) */
  var pm=WAVE_MODELS.reduce(function(pr,m,i){ return pr.then(function(){ if(i>=2&&R.waves.length>=2) return; return waveModel(m[0],m[1]); }); },Promise.resolve());
  R.p=Promise.all([pw,pm]).then(function(){ if(!R.waves.length) return waveModel('',T('Open-Meteo (αυτόματο)','Open-Meteo (auto)')); }).then(function(){ if(R.retry) R.at=Date.now()-3300000; R.retry=false; R.waves.sort(function(x,y){ return WAVE_MODELS.findIndex(function(m){ return m[0]===x.id; })-WAVE_MODELS.findIndex(function(m){ return m[0]===y.id; }); }); R.done=true; return R; },function(){ R.done=true; return R; });
  REG=R; var rs=window.__ndSeaRegs=(window.__ndSeaRegs||[]).filter(function(x){ return x!==R; }); rs.unshift(R); if(rs.length>4) rs.length=4; return R.p;
}
/* IDW σε κόμβους πλέγματος με τιμή */
function latSample(L,lat,lon,fn){
  var fy=(lat-L.la0)/(L.la1-L.la0)*(L.nla-1), fx=(lon-L.lo0)/(L.lo1-L.lo0)*(L.nlo-1);
  var j0=Math.floor(fy), i0=Math.floor(fx), sw=0, acc=null;
  for(var R=1;R<=3&&sw===0;R++){
    for(var j=j0-R+1;j<=j0+R;j++) for(var i=i0-R+1;i<=i0+R;i++){
      if(j<0||i<0||j>=L.nla||i>=L.nlo) continue;
      var r=fn(j*L.nlo+i); if(r==null) continue;
      var dd=(fy-j)*(fy-j)+(fx-i)*(fx-i), w=1/(dd+0.05);
      if(!acc){ acc=[]; for(var z0=0;z0<r.length;z0++) acc.push(0); }
      for(var z=0;z<r.length;z++) acc[z]+=r[z]*w; sw+=w;
    }
  }
  if(!sw) return null; for(var z2=0;z2<acc.length;z2++) acc[z2]/=sw; return acc;
}
/* προετοιμασία για τη χρονική στιγμή t: διάρκειες ανά κόμβο, swell/κύμα ανά μοντέλο */
function prep(t,RG){ RG=RG||REG;
  var P={dur:null,waves:[]}; if(!RG||!t) return P;
  var W=RG.wind;
  if(W){ var ti=W.t.indexOf(t); if(ti>=0){ var NPn=W.L.nla*W.L.nlo, out=new Float32Array(NPn);
    for(var p=0;p<NPn;p++){ var sp=W.sp[p], dr=W.dir[p], s0=sp[ti], d0=dr[ti]; if(s0==null||d0==null){ out[p]=NaN; continue; }
      var D=1, k=ti-1; for(;k>=0;k--){ var s=sp[k], d=dr[k]; if(s==null||d==null) break; if(s>=Math.max(3,0.5*s0)&&adiff(d,d0)<=45) D++; else break; }
      out[p]=(k<0)?Math.max(D,24):D; }
    P.dur={L:W.L,v:out}; } }
  RG.waves.forEach(function(m){
    var ti=m.t.indexOf(t); if(ti<0) return; var NPn=m.L.nla*m.L.nlo, h=new Float32Array(NPn), sh=new Float32Array(NPn), su=new Float32Array(NPn), sv=new Float32Array(NPn), tp=new Float32Array(NPn), stp=new Float32Array(NPn), wu=new Float32Array(NPn), wv=new Float32Array(NPn), ok=new Uint8Array(NPn), any=false;
    for(var p=0;p<NPn;p++){ var a=m.h[p]&&m.h[p][ti], b=m.sh[p]&&m.sh[p][ti], d=m.sd[p]&&m.sd[p][ti]; if(a==null) continue; h[p]=a; var t1=m.tp&&m.tp[p]&&m.tp[p][ti], t2=m.st&&m.st[p]&&m.st[p][ti]; tp[p]=t1==null?0:t1; stp[p]=t2==null?0:t2; var w1=m.wd&&m.wd[p]&&m.wd[p][ti]; if(w1!=null){ wu[p]=Math.sin(w1*Math.PI/180)*a; wv[p]=Math.cos(w1*Math.PI/180)*a; } sh[p]=b==null?0:b; var dd=(d==null?0:d)*Math.PI/180; su[p]=Math.sin(dd)*sh[p]; sv[p]=Math.cos(dd)*sh[p]; ok[p]=1; any=true; }
    if(any) P.waves.push({name:m.name,L:m.L,h:h,sh:sh,su:su,sv:sv,tp:tp,stp:stp,wu:wu,wv:wv,ok:ok});
  });
  return P;
}
/* υπολογισμός σε ένα κελί. wind: επιλεγμένος {sp,dir}, winds: όλα τα μοντέλα [{name,v}] */
function calc(cl,lat,lon,wind,winds,P){
  var F=fetchKm(cl,wind.dir), dist=distKm(cl), dep=depthM(cl), dur=Infinity;
  if(P.dur){ var dd=latSample(P.dur.L,lat,lon,function(p){ var v=P.dur.v[p]; return v===v?[v]:null; }); if(dd) dur=dd[0]; }
  var mH=[], swx=0, swy=0, swh=0, swn=0, mT=0, mTn=0, sT=0, sTn=0, mWu=0, mWv=0;
  P.waves.forEach(function(m){ var s=latSample(m.L,lat,lon,function(p){ return m.ok[p]?[m.h[p],m.sh[p],m.su[p],m.sv[p],m.tp?m.tp[p]:0,m.stp?m.stp[p]:0,m.wu?m.wu[p]:0,m.wv?m.wv[p]:0]:null; }); if(s){ mWu+=s[6]; mWv+=s[7]; mH.push({name:m.name,h:s[0]}); swh+=s[1]; swx+=s[2]; swy+=s[3]; swn++; if(s[4]>0.5){ mT+=s[4]; mTn++; } if(s[5]>0.5){ sT+=s[5]; sTn++; } } });
  var swell=null, swE=0;
  if(!swn&&!P.waves.length){ try{ var cc=window.AlkyonCore&&window.AlkyonCore.getCond&&window.AlkyonCore.getCond(); if(cc&&cc.wave!=null&&cc.wave>0){ swh=+cc.wave; var dd0=cc.waveDir!=null?+cc.waveDir:(cc.windDeg!=null?+cc.windDeg:270); swx=Math.sin(dd0*Math.PI/180); swy=Math.cos(dd0*Math.PI/180); swn=1; P.pointFallback=true; if(cc.wavePeriod) { sT+=+cc.wavePeriod; sTn++; } } }catch(e){} }
  if(swn){ swh/=swn; var sdir=(Math.atan2(swx,swy)*180/Math.PI+360)%360; swell={h:swh,dir:sdir,fetchKm:fetchKm(cl,sdir)}; swE=swh*swellExpo(cl,sdir,dep,sTn?sT/sTn:0); }
  function ours(v){ var ws=hsWind(v.sp*0.514444,fetchEff(cl,v.dir),dur,dep); return {ws:ws,h:Math.sqrt(ws*ws+swE*swE)}; }
  var oc=ours(wind), olo=oc.h, ohi=oc.h;
  (winds||[]).forEach(function(x){ var o=ours(x.v); if(o.h<olo) olo=o.h; if(o.h>ohi) ohi=o.h; });
  var w=mH.length?clamp01((dist-2)/6)*clamp01((F-10)/40):0;
  var mm=0, mlo=1e9, mhi=-1e9; mH.forEach(function(x){ mm+=x.h; if(x.h<mlo) mlo=x.h; if(x.h>mhi) mhi=x.h; }); if(mH.length) mm/=mH.length; else { mlo=mhi=0; }
  var hc=w*mm+(1-w)*oc.h, hlo=w*mlo+(1-w)*olo, hhi=w*mhi+(1-w)*ohi;
  var cap=isFinite(dep)?0.55*dep:Infinity; hc=Math.min(hc,cap); hlo=Math.min(hlo,cap); hhi=Math.min(hhi,cap);
  /* περίοδος: ανοιχτά μετρά το μοντέλο κύματος· κοντά στην ακτή η περίοδος του κύματος που κυριαρχεί (ανέμου ή swell) */
  var tW=tpWind(wind.sp*0.514444,F,dur,dep), tS=sTn?sT/sTn:0, tM=mTn?mT/mTn:0, tNear=(swE>oc.ws&&tS>0)?tS:tW, per=(w>0.5&&tM>0)?tM:(w>0&&tM>0?w*tM+(1-w)*tNear:tNear);
  /* κατεύθυνση κύματος (από πού έρχεται): ανοιχτά του μοντέλου κύματος, κοντά στην ακτή του κύματος που κυριαρχεί (ανέμου ή swell) */
  var dNear=(swE>oc.ws&&swell)?swell.dir:wind.dir, dMod=(mWu||mWv)?(Math.atan2(mWu,mWv)*180/Math.PI+360)%360:null, wdir=dNear;
  if(dMod!=null&&w>0){ var a1=dNear*Math.PI/180, a2=dMod*Math.PI/180; wdir=(Math.atan2((1-w)*Math.sin(a1)+w*Math.sin(a2),(1-w)*Math.cos(a1)+w*Math.cos(a2))*180/Math.PI+360)%360; }
  return {hs:hc,lo:hlo,hi:hhi,unc:levelOf(hlo)!==levelOf(hhi),level:levelOf(hc),period:per,wdir:wdir,tWind:tW,tSwell:tS,fetchKm:F,distKm:dist,depth:dep,dur:dur,windSea:oc.ws,swell:swell,swellEff:swE,model:mH,modelMean:mm,wModel:w,capped:hc>=cap-1e-6};
}
window.AlkyonSeaState={levels:LV,grad:grad,hsWind:hsWind,calc:calc,decodeTile:decodeTile};
/* v31z390: τα ακριβή περιγράμματα ξηράς (OSM, ~5 m, και τα νησάκια) για μια περιοχή, ώστε η διαδρομή πλοήγησης να τα αποφεύγει */
window.AlkyonSeaState.landRings=function(bb){
  return loadIndex().then(function(){
    var ks=[]; for(var la=Math.floor(bb.s);la<=Math.floor(bb.n);la++) for(var lo=Math.floor(bb.w);lo<=Math.floor(bb.e);lo++){ var k=tkey(la,lo); if(hasTile(k)) ks.push(k); }
    return Promise.all(ks.map(loadTile)).then(function(){ var out=[]; ks.forEach(function(k){ var o=TL[k]; if(!o||o.st!=='ok'||!o.t) return; o.t.rings.forEach(function(r){ if(r.b[2]>=bb.w&&r.b[0]<=bb.e&&r.b[3]>=bb.s&&r.b[1]<=bb.n) out.push(r); }); }); return out; });
  });
};

/* ---------- χάρτης ---------- */
var C=window.AlkyonCore, mb=document.querySelector('.mapbtns'), Lf=window.L; if(!C||!mb||!Lf) return;
var map=C.map&&C.map(); if(!map) return;
(function(){ var st=document.createElement('style'); st.textContent='.ndseacv{position:absolute;left:0;top:0;pointer-events:none;transition:opacity .45s ease}.ndseacv.nt{transition:none}#ndSeaLeg .ndslx[hidden]{display:none}#ndSeaLeg .ndslh{display:flex;align-items:center;gap:8px}#ndSeaLeg .ndslh b{font-size:13px;flex:none}'; document.head.appendChild(st); })();
var on=false, ownWind=false, cvs=[], cur=0, leg=null, drawT=null, curT=null, tapLL=null, tapMk=null, PREP=null, PREPT=null;
var btn=document.createElement('button'); btn.type='button'; btn.id='bSeaState'; btn.className='mbtn'; btn.setAttribute('aria-pressed','false');
btn.setAttribute('aria-label',T('Κατάσταση θάλασσας (χρώματα)','Sea state (colours)')); btn.title=btn.getAttribute('aria-label');
btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/></svg>';
mb.appendChild(btn);

function windOn(){ var W=window.AlkyonWindMap; return !!(W&&W.on&&W.on()); }
function wxPane(name,z){ var p=map.getPane(name)||map.createPane(name); p.style.zIndex=String(z); p.style.pointerEvents='none'; return p; }
function pin(c){ try{ Lf.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0])); }catch(e){} }
function fmt(x,d){ var s=x.toFixed(d); return EN?s:s.replace('.',','); }
function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function ensure(){
  if(!cvs.length){
    for(var i=0;i<2;i++){ var c=document.createElement('canvas'); c.className='ndseacv'; c.setAttribute('aria-hidden','true'); c.style.opacity='0'; wxPane('ndSeaPane',340).appendChild(c); cvs.push(c); }
  }
  if(leg&&leg.isConnected) return;
  leg=document.createElement('div'); leg.id='ndSeaLeg'; leg.setAttribute('role','region'); leg.setAttribute('aria-label',T('Κατάσταση θάλασσας','Sea state'));
  leg.style.cssText='padding:8px 10px 6px;font-size:11px;line-height:1.35';
  var top=document.createElement('div'); top.className='ndslh';
  var ttl=document.createElement('b'); ttl.textContent=T('Θάλασσα','Sea state');
  var bar=document.createElement('div'); bar.style.cssText='flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,'+GS.map(function(g2){ return 'rgb('+g2[1].join(',')+') '+(100*g2[0]/3).toFixed(1)+'%'; }).join(',')+')';
  var tg=document.createElement('button'); tg.type='button'; tg.id='ndSeaTg'; tg.className='btn ghost sm'; tg.style.cssText='min-width:40px;min-height:36px;padding:0 8px;flex:none;font-size:12px';
  var sx=document.createElement('button'); sx.type='button'; sx.id='ndSeaX'; sx.className='btn ghost sm'; sx.style.cssText='min-width:40px;min-height:36px;padding:0;flex:none'; sx.textContent='✕'; sx.setAttribute('aria-label',T('Κλείσιμο κατάστασης θάλασσας','Close sea state')); sx.addEventListener('click',function(){ stop(); });
  top.append(ttl,bar,tg,sx);
  var x=document.createElement('div'); x.className='ndslx';
  var cols='16.7fr 25fr 41.6fr 16.7fr', nm=document.createElement('div'), rg=document.createElement('div');
  nm.style.cssText=rg.style.cssText='display:grid;grid-template-columns:'+cols+';gap:2px;margin-top:2px';
  LV.forEach(function(l){
    var a=document.createElement('span'); a.style.cssText='font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; a.textContent=EN?l.en.split(' /')[0]:l.el.split(' ')[0]; nm.append(a);
    var b=document.createElement('span'); b.className='note'; b.style.cssText='font-size:10px;white-space:nowrap'; b.textContent=EN?l.ren:l.r; rg.append(b);
  });
  var un=document.createElement('div'); un.style.cssText='display:flex;align-items:center;gap:6px;margin-top:4px';
  var us=document.createElement('span'); us.setAttribute('aria-hidden','true'); us.style.cssText='width:22px;height:12px;border-radius:3px;flex:none;background:repeating-linear-gradient(135deg,#f0c850 0 4px,#f7e3a8 4px 6px)';
  var ut=document.createElement('span'); ut.textContent=T('Διαγράμμιση: τα μοντέλα διαφωνούν για την κατηγορία','Hatched: models disagree on the category');
  un.append(us,ut);
  var src=document.createElement('div'); src.id='ndSeaSrc'; src.className='note'; src.style.cssText='font-size:10.5px;margin-top:3px';
  var nt=document.createElement('details'); nt.style.cssText='margin-top:2px';
  var sm=document.createElement('summary'); sm.className='note'; sm.style.cssText='font-size:11px;cursor:pointer;min-height:24px;display:list-item'; sm.textContent=T('Τι δείχνει αυτό','What this shows');
  var nb=document.createElement('p'); nb.className='note'; nb.style.cssText='font-size:11px;margin:2px 0 0';
  nb.textContent=T('Εκτίμηση σημαντικού ύψους κύματος, έως 10 km από την ακτή (Κύπρος, Ελλάδα). Κοντά στην ακτή: κύμα ανέμου με τη μέθοδο SPM (άνεμος, ανοιχτή θάλασσα προς τον άνεμο, διάρκεια, βάθος) και swell από τα μοντέλα κύματος, μειωμένο όπου η ακτή το κόβει. Ανοιχτά και σε εκτεθειμένα σημεία μετρούν περισσότερο τα μοντέλα κύματος (DWD EWAM, ECMWF WAM, MeteoFrance). Στα ρηχά το κύμα περιορίζεται από το βάθος (EMODnet). Κατηγορίες WMO, λευκές γραμμές στα όρια. Το κύμα που στρίβει γύρω από ακρωτήρια και προς την ακτή στα ρηχά υπολογίζεται κατά προσέγγιση. Δεν περιλαμβάνει ρεύματα και βουνά. Δεν είναι ναυτικό όργανο. Ακτογραμμή © OpenStreetMap contributors · Βάθος EMODnet Bathymetry · Καιρός και κύμα Open-Meteo.','Significant wave height estimate up to 10 km offshore (Cyprus, Greece). Near the coast: wind sea by the SPM method (wind, open sea upwind, duration, depth) plus swell from the wave models, reduced where the coast blocks it. Offshore and at exposed spots the wave models count more (DWD EWAM, ECMWF WAM, MeteoFrance). In shallow water waves are limited by depth (EMODnet). WMO categories, white lines at the boundaries. Waves bending around headlands and towards the shore in shallow water are approximated. Excludes currents and mountains. Not a navigation instrument. Coastline © OpenStreetMap contributors · Depth EMODnet Bathymetry · Weather and waves Open-Meteo.');
  nt.append(sm,nb);
  x.append(nm,rg,un,src,nt);
  var pt=document.createElement('div'); pt.id='ndSeaPt'; pt.style.cssText='margin-top:5px;padding:5px 7px;border-radius:8px;background:rgba(127,127,127,.14);font-size:12px'; pt.hidden=true; pt.setAttribute('aria-live','polite');
  var st=document.createElement('div'); st.id='ndSeaSt'; st.style.cssText='font-weight:600;margin-top:4px'; st.setAttribute('aria-live','polite');
  var dn2=document.createElement('div'); dn2.id='ndSeaDep'; dn2.className='note'; dn2.style.cssText='font-size:10.5px;margin-top:2px'; dn2.hidden=true;
  leg.append(top,x,pt,st,dn2);
  var D=window.AlkyonMapDock?window.AlkyonMapDock():null; if(D){ D.insertBefore(leg,D.firstChild); if(D._sync) D._sync(); } else { leg.style.cssText+=';position:fixed;left:8px;right:8px;bottom:calc(var(--navh,64px) + 38px + env(safe-area-inset-bottom,0px));z-index:899;background:var(--card,#fff);border-radius:12px'; document.body.appendChild(leg); }
  function syncTg(){ var open=!!lsGet('alkyon-sealeg',false); x.hidden=!open; tg.textContent=open?'▾':(EN?'Info ▴':'Πληρ. ▴'); tg.setAttribute('aria-expanded',String(open)); tg.setAttribute('aria-label',open?T('Λιγότερα','Less'):T('Περισσότερα για τα χρώματα','More about the colours')); }
  tg.addEventListener('click',function(){ lsSet('alkyon-sealeg',!lsGet('alkyon-sealeg',false)); syncTg(); showPoint(); });
  syncTg();
}
function status(txt){ var s=document.getElementById('ndSeaSt'); if(s) s.textContent=txt||''; }
function srcLine(){
  var el=document.getElementById('ndSeaSrc'); if(!el) return; var p=[];
  var wv=REG&&REG.waves.length?REG.waves.map(function(m){ return m.name; }).join(', '):T('κανένα (φόρτωση ή μη διαθέσιμα)','none (loading or unavailable)');
  p.push(T('Μοντέλα κύματος: ','Wave models: ')+wv);
  var WM=window.AlkyonWindMap, c=map.getCenter(), all=WM&&WM.sampleAll?WM.sampleAll(c.lat,c.lng):[];
  if(all.length) p.push(T('Μοντέλα ανέμου: ','Wind models: ')+all.map(function(a){ return a.name; }).join(', '));
  el.textContent=p.join(' · ');
}
function blur(V,cw,ch){
  var K=[1/16,4/16,6/16,4/16,1/16], t=new Float32Array(V.length), o=new Float32Array(V.length), x, y, k, a;
  for(y=0;y<ch;y++) for(x=0;x<cw;x++){ a=0; for(k=-2;k<=2;k++){ var xx=Math.min(cw-1,Math.max(0,x+k)); a+=V[y*cw+xx]*K[k+2]; } t[y*cw+x]=a; }
  for(y=0;y<ch;y++) for(x=0;x<cw;x++){ a=0; for(k=-2;k<=2;k++){ var yy=Math.min(ch-1,Math.max(0,y+k)); a+=t[yy*cw+x]*K[k+2]; } o[y*cw+x]=a; }
  return o;
}
/* 1.9.12: όσο φορτώνει (ή αν απέτυχε, π.χ. όριο αιτημάτων) η νέα περιοχή, χρησιμοποιείται η προηγούμενη που έχει μοντέλα κύματος,
   ώστε το χρώμα να μη σταματά σε ευθεία γραμμή */
function regs(){ var out=[]; if(REG) out.push(REG); (window.__ndSeaRegs||[]).forEach(function(r){ if(r!==REG&&r.waves&&r.waves.length) out.push(r); }); return out; }
function srcReg(){ var r=regs().filter(function(x){ return x.waves&&x.waves.length; })[0]; return r||REG; }
function prepFor(R){ if(!R) return {dur:null,waves:[]}; if(!R._pp||R._pp.t!==curT||R._pp.n!==R.waves.length){ R._pp={t:curT,n:R.waves.length,P:prep(curT,R)}; } return R._pp.P; }
function prepNow(){ var R=srcReg(); if(PREPT!==curT||!PREP||PREP.reg!==R||PREP.n!==(R&&R.waves?R.waves.length:0)){ PREP=prep(curT,R); PREP.reg=R; PREP.n=R&&R.waves?R.waves.length:0; PREPT=curT; } return PREP; }
function pointInfo(lat,lon){
  var cl=cellAt(lat,lon); if(!cl) return null;
  var W=window.AlkyonWindMap, v=W&&W.sample?W.sample(lat,lon):null; if(!v) return null;
  var r=calc(cl,lat,lon,v,W.sampleAll?W.sampleAll(lat,lon):[],prepNow()); r.wind=v; return r;
}
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dn(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; }
function W_(kn){ try{ return window.AlkyonUnits.wind(kn); }catch(e){ return Math.round(kn)+' kn'; } }
function showPoint(){
  var el=document.getElementById('ndSeaPt'); if(!el) return;
  if(!tapLL){ el.hidden=true; return; }
  var r=pointInfo(tapLL.lat,tapLL.lng); el.hidden=false;
  if(!r){ el.textContent=T('Εδώ δεν υπάρχει εκτίμηση (ξηρά, πάνω από 10 km από την ακτή ή εκτός Κύπρου/Ελλάδας).','No estimate here (land, more than 10 km offshore, or outside Cyprus/Greece).'); return; }
  var L=LV[r.level], rng=(r.hi-r.lo>=0.1)?' ('+fmt(r.lo,1)+'–'+fmt(r.hi,1)+')':'';
  /* v31z351: πρώτα τα βασικά (ύψος, περίοδος, ακτή, βάθος)· οι λεπτομέρειες μόνο όταν είναι ανοιχτό το «Πληροφορίες» */
  var main=['≈ '+fmt(r.hs,1)+' m'+rng+' · '+(EN?L.en:L.el)+(r.unc?T(' · αβέβαιο',' · uncertain'):'')];
  if(r.wdir!=null) main[0]=main[0].replace(' · ',T(' από ',' from ')+dn(r.wdir)+' · ');
  if(r.period>0) main.push(T('περίοδος ~','period ~')+Math.round(r.period)+' s');
  main.push(T('ακτή ','shore ')+(r.distKm<1?Math.round(r.distKm*1000)+' m':fmt(r.distKm,1)+' km'));
  if(isFinite(r.depth)) main.push(T('βάθος ~','depth ~')+Math.round(r.depth)+' m'+(r.capped?T(' (περιορίζει)',' (limits waves)'):''));
  var det=[T('άνεμος ','wind ')+dn(r.wind.dir)+' '+W_(r.wind.sp)+(isFinite(r.dur)?T(' επί ',' for ')+(r.dur>=24?'24+':Math.round(r.dur))+' h':'')];
  if(r.wind.obs&&r.wind.obs.near){ var ob=r.wind.obs.near; det.push(T('διόρθωση από σταθμό ','corrected by station ')+ob.name+' ('+Math.round(r.wind.obs.dist)+' km'+T(': μέτρηση ',': observed ')+W_(ob.obs)+T(', μοντέλο ',', model ')+W_(ob.mod)+T(', βάρος ',', weight ')+Math.round(100*r.wind.obs.w)+'%)'); }
  det.push(T('κύμα ανέμου ','wind sea ')+fmt(r.windSea,1)+' m'+(r.tWind>0?' / '+Math.round(r.tWind)+' s':'')+' (fetch '+(r.fetchKm<10?fmt(r.fetchKm,1):Math.round(r.fetchKm))+' km)');
  if(r.swell) det.push('swell '+fmt(r.swellEff,1)+' m'+(r.tSwell>0?' / '+Math.round(r.tSwell)+' s':'')+(r.swell.h>r.swellEff+0.05?T(' (ανοιχτά '+fmt(r.swell.h,1)+' m από '+dn(r.swell.dir)+')',' (offshore '+fmt(r.swell.h,1)+' m from '+dn(r.swell.dir)+')'):T(' από ',' from ')+dn(r.swell.dir)));
  if(r.model.length) det.push(T('μοντέλα κύματος ','wave models ')+r.model.map(function(m){ return fmt(m.h,1); }).join('/')+' m'+T(' (βάρος ',' (weight ')+Math.round(100*r.wModel)+'%)');
  el.replaceChildren(); var b=document.createElement('b'); b.textContent=main.join(' · '); el.append(b);
  if(lsGet('alkyon-sealeg',false)){ var d=document.createElement('div'); d.style.cssText='margin-top:2px;font-size:11px;opacity:.85'; d.textContent=det.join(' · '); el.append(d); }
}
function onTap(e){
  if(!on) return; var t=e.target;
  if(t&&t.closest&&(t.closest('.mapbtns')||t.closest('#ndMapDock')||t.closest('#ndSeaLeg')||t.closest('.leaflet-marker-icon')||t.closest('.leaflet-control')||t.closest('.ndbar')||t.closest('.ndsheet')||t.closest('button,a,input,select'))) return;
  tapLL=map.mouseEventToLatLng(e);
  if(tapMk) try{ map.removeLayer(tapMk); }catch(x){}
  tapMk=null; if(!windOn()) tapMk=Lf.circleMarker(tapLL,{radius:7,color:'#fff',weight:3,fillColor:'#13212e',fillOpacity:1,interactive:false}).addTo(map);
  showPoint();
  if(window.ALKYON_TAPCARD) try{ window.dispatchEvent(new CustomEvent('alkyon-wxtap',{detail:{lat:tapLL.lat,lng:tapLL.lng}})); }catch(x){}
}
var MS={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[2,0]],10:[[0,1],[2,3]],11:[[2,1]],12:[[1,3]],13:[[1,0]],14:[[0,3]]};
function contour(GH,GA,gw,gh,G,lv){
  var segs=[];
  for(var y=0;y<gh-1;y++) for(var x=0;x<gw-1;x++){
    var p0=y*gw+x, p1=p0+1, p2=p0+gw+1, p3=p0+gw;
    if(GA[p0]<0.35||GA[p1]<0.35||GA[p2]<0.35||GA[p3]<0.35) continue;
    var v0=GH[p0], v1=GH[p1], v2=GH[p2], v3=GH[p3];
    var m=(v0>=lv?1:0)|(v1>=lv?2:0)|(v2>=lv?4:0)|(v3>=lv?8:0); if(m===0||m===15) continue;
    var X0=x*G, Y0=y*G;
    var ed=[[X0+G*(lv-v0)/((v1-v0)||1e-9),Y0],[X0+G,Y0+G*(lv-v1)/((v2-v1)||1e-9)],[X0+G*(lv-v3)/((v2-v3)||1e-9),Y0+G],[X0,Y0+G*(lv-v0)/((v3-v0)||1e-9)]];
    MS[m].forEach(function(pr){ segs.push([ed[pr[0]],ed[pr[1]]]); });
  }
  return segs;
}
/* πλακίδια που χρειάζεται η τρέχουσα θέα· null αν χρειάζεται zoom */
function viewTiles(){
  var b=map.getBounds(); if(b.getNorth()-b.getSouth()>3.2||b.getEast()-b.getWest()>4.2) return null;
  var o=[]; for(var la=Math.floor(b.getSouth());la<=Math.floor(b.getNorth());la++) for(var lo=Math.floor(b.getWest());lo<=Math.floor(b.getEast());lo++){ var k=tkey(la,lo); if(hasTile(k)) o.push(k); }
  return o;
}

function draw(){
  if(!on||!cvs.length) return;
  /* v31z526: τα μοντέλα κύματος (για το πεδίο κύματος της v4) ζητιούνται για την περιοχή που βλέπεις και όταν είναι πολύ μακριά για τις γραμμές ακτής,
     αλλιώς το χρώμα σταματούσε στο όριο της προηγούμενης περιοχής */
  var bd0=map.getBounds(); if(bd0.getNorth()-bd0.getSouth()<=24&&bd0.getEast()-bd0.getWest()<=32&&(!covers(REG,bd0)||(REG&&Date.now()-REG.at>3600000)))
    loadRegion(bd0).then(function(){ PREP=null; later(); try{ window.dispatchEvent(new Event('alkyon-seareg')); }catch(e){} });
  var tgt=cvs[1-cur], sz=map.getSize(), dpr=Math.min(window.devicePixelRatio||1,2);
  tgt.width=Math.round(sz.x*dpr); tgt.height=Math.round(sz.y*dpr); tgt.style.width=sz.x+'px'; tgt.style.height=sz.y+'px'; pin(tgt);
  var ctx=tgt.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,sz.x,sz.y);
  if(!IDXJ){ status(IDXP?T('Φόρτωση…','Loading…'):T('Τα δεδομένα ακτής δεν φορτώθηκαν.','Coast data did not load.')); if(!IDXP) loadIndex().then(later); return; }
  var vt=viewTiles();
  if(vt===null){ swap(); status(T('Κάνε zoom για να δεις την κατάσταση θάλασσας.','Zoom in to see the sea state.')); return; }
  if(!vt.length){ swap(); status(T('Δεν υπάρχουν δεδομένα εδώ (μόνο Κύπρος και Ελλάδα).','No data here (Cyprus and Greece only).')); return; }
  var pend=vt.filter(function(k){ return !TL[k]||TL[k].st==='loading'; });
  if(pend.length){ status(T('Φόρτωση περιοχής…','Loading area…')); Promise.all(pend.map(loadTile)).then(later); if(vt.every(function(k){ return !TL[k]||TL[k].st!=='ok'; })) return; }
  var W=window.AlkyonWindMap; if(!W||!W.sample){ status(T('Ο χάρτης ανέμου δεν είναι διαθέσιμος.','The wind map is not available.')); return; }
  var bd=map.getBounds(); if(!covers(REG,bd)||(REG&&Date.now()-REG.at>3600000)) loadRegion(bd).then(function(){ PREP=null; later(); });
  /* v31z389: μέχρι να έρθουν τα μοντέλα κύματος (έως ~20″) δεν ζωγραφίζεται προσωρινή εικόνα, για να μην «πηδάει» ο χάρτης από τη μία στην άλλη */
  if(REG&&!REG.done&&!REG.waves.length&&Date.now()-REG.t0<20000){ status(T('Φόρτωση μοντέλων κύματος…','Loading wave models…')); setTimeout(later,1500); return; }
  var P=prepNow(), X=window.AlkyonExposure, land=(X&&X.isLand)?X.isLand:null;
  var s=bd.getSouth(), n=bd.getNorth(), w=bd.getWest(), e=bd.getEast(), M=4;
  var r0=Math.floor((LAT_TOP-n)/STEP)-M, r1=Math.floor((LAT_TOP-s)/STEP)+M, c0=Math.floor((w-LON_LEFT)/STEP)-M, c1=Math.floor((e-LON_LEFT)/STEP)+M;
  var cw=c1-c0+1, ch=r1-r0+1, N=cw*ch, H=new Float32Array(N), A=new Float32Array(N), U=new Float32Array(N);
  var cnt=[0,0,0,0], nowind=0, drawn=0, unc=0;
  for(var r=r0;r<=r1;r++){
    var lam=LAT_TOP-(r+0.5)*STEP;
    for(var c=c0;c<=c1;c++){
      var lom=LON_LEFT+(c+0.5)*STEP, cl=cellAt(lam,lom); if(!cl) continue;
      var v=W.sample(lam,lom); if(!v){ nowind++; continue; }
      var res=calc(cl,lam,lom,v,W.sampleAll?W.sampleAll(lam,lom):[],P), q=(r-r0)*cw+(c-c0);
      H[q]=res.hs; A[q]=1; U[q]=res.unc?1:0;
      if(lam>=s&&lam<=n&&lom>=w&&lom<=e){ cnt[res.level]++; drawn++; if(res.unc) unc++; }
    }
  }
  if(!drawn){ swap(); status(nowind?T('Περιμένω τον άνεμο…','Waiting for wind…'):T('Δεν υπάρχουν δεδομένα σε αυτή την περιοχή.','No data in this area.')); return; }
  var LAND=new Uint8Array(N);
  if(land) for(var y0=0;y0<ch;y0++) for(var x0=0;x0<cw;x0++) LAND[y0*cw+x0]=land(LAT_TOP-(r0+y0+0.5)*STEP,LON_LEFT+(c0+x0+0.5)*STEP)===1?1:0;
  [1,0.55,0.25].forEach(function(seaW){
    var nH=H.slice(), nA=A.slice(), nU=U.slice();
    for(var y=0;y<ch;y++) for(var x=0;x<cw;x++){
      var q=y*cw+x; if(A[q]>0) continue; var sh=0, su=0, sw=0;
      for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){ var xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=cw||yy>=ch) continue; var p=yy*cw+xx; if(A[p]>0){ sh+=H[p]*A[p]; su+=U[p]*A[p]; sw+=A[p]; } }
      if(sw>0){ nH[q]=sh/sw; nU[q]=su/sw; nA[q]=LAND[q]?1:Math.min(seaW,sw/3); }
    }
    H=nH; A=nA; U=nU;
  });
  var HA=new Float32Array(N), UA=new Float32Array(N); for(var i=0;i<N;i++){ HA[i]=H[i]*A[i]; UA[i]=U[i]*A[i]; }
  var bHA=blur(HA,cw,ch), bUA=blur(UA,cw,ch), bA=blur(A,cw,ch);
  for(var i2=0;i2<N;i2++){ var aa=bA[i2]; H[i2]=aa>1e-4?bHA[i2]/aa:0; U[i2]=aa>1e-4?bUA[i2]/aa:0; A[i2]=aa; }
  function field(lat,lon,out){
    var fy=(LAT_TOP-lat)/STEP-0.5-r0, fx=(lon-LON_LEFT)/STEP-0.5-c0;
    if(fy<0||fy>ch-1||fx<0||fx>cw-1) return false;
    var j=Math.min(ch-2,Math.floor(fy)), ty=fy-j, i3=Math.min(cw-2,Math.floor(fx)), tx=fx-i3, q0=j*cw+i3, q1=q0+1, q2=q0+cw, q3=q2+1;
    var w0=(1-tx)*(1-ty), w1=tx*(1-ty), w2=(1-tx)*ty, w3=tx*ty;
    out[0]=H[q0]*w0+H[q1]*w1+H[q2]*w2+H[q3]*w3; out[1]=A[q0]*w0+A[q1]*w1+A[q2]*w2+A[q3]*w3; out[2]=U[q0]*w0+U[q1]*w1+U[q2]*w2+U[q3]*w3; return true;
  }
  /* ακριβής ακτή (OSM, από τα πλακίδια) αν υπάρχει για όλη τη θέα, αλλιώς raster ~250 m */
  var vecOK=vt.every(function(k){ return TL[k]&&TL[k].st==='ok'&&TL[k].t.hasLand; });
  var bs=(sz.x*sz.y>600000)?2:1, bw=Math.ceil(sz.x/bs), bh=Math.ceil(sz.y/bs), LAT=new Float64Array(bh), LON=new Float64Array(bw);
  for(var y2=0;y2<bh;y2++) LAT[y2]=map.containerPointToLatLng([0,y2*bs+bs/2]).lat;
  for(var x2=0;x2<bw;x2++) LON[x2]=map.containerPointToLatLng([x2*bs+bs/2,0]).lng;
  var pc=document.createElement('canvas'); pc.width=bw; pc.height=bh;
  var px=pc.getContext('2d'), im=px.createImageData(bw,bh), d=im.data, mk=vecOK?null:new Uint8Array(bw*bh), ALPHA=0.74*255, fv=[0,0,0];
  for(var y3=0;y3<bh;y3++){
    for(var x3=0;x3<bw;x3++){
      if(!field(LAT[y3],LON[x3],fv)||fv[1]<0.03) continue;
      if(mk&&land&&land(LAT[y3],LON[x3])===1){ mk[y3*bw+x3]=1; continue; }
      var g2=grad(fv[0]), o=(y3*bw+x3)*4, R0=g2[0], G0=g2[1], B0=g2[2];
      if(fv[2]>0.5&&((x3*bs+y3*bs)%12)<2){ R0=R0*0.62+255*0.38; G0=G0*0.62+255*0.38; B0=B0*0.62+255*0.38; }
      d[o]=R0; d[o+1]=G0; d[o+2]=B0; d[o+3]=Math.round(ALPHA*Math.min(1,fv[1]*1.15));
    }
  }
  px.putImageData(im,0,0);
  ctx.imageSmoothingEnabled=true; try{ ctx.imageSmoothingQuality='high'; }catch(x4){}
  ctx.drawImage(pc,0,0,bw,bh,0,0,bw*bs,bh*bs);
  /* ισοϋψείς */
  var G=4, gw=Math.ceil(sz.x/G)+1, gh=Math.ceil(sz.y/G)+1, GH=new Float32Array(gw*gh), GA=new Float32Array(gw*gh), gLat=new Float64Array(gh), gLon=new Float64Array(gw);
  for(var a1=0;a1<gh;a1++) gLat[a1]=map.containerPointToLatLng([0,a1*G]).lat;
  for(var a2=0;a2<gw;a2++) gLon[a2]=map.containerPointToLatLng([a2*G,0]).lng;
  for(var gy=0;gy<gh;gy++) for(var gx=0;gx<gw;gx++){ if(field(gLat[gy],gLon[gx],fv)){ GH[gy*gw+gx]=fv[0]; GA[gy*gw+gx]=fv[1]; } }
  var labels=[];
  /* 1.6.8: οι ετικέτες κύματος δεν μπαίνουν πάνω στα βέλη των ρευμάτων ή στα σημάδια */
  var mcR=map.getContainer().getBoundingClientRect(), occ=[].map.call(document.querySelectorAll('#lmap .mk.cur .cw,#lmap .mk.fish,#lmap .mk.spot i'),function(e){ var r=e.getBoundingClientRect(); return [r.left-mcR.left,r.top-mcR.top,r.right-mcR.left,r.bottom-mcR.top]; });
  ctx.lineCap='round'; ctx.lineJoin='round';
  BOUNDS.forEach(function(lvB){
    var segs=contour(GH,GA,gw,gh,G,lvB); if(!segs.length) return;
    ctx.beginPath(); segs.forEach(function(sg2){ ctx.moveTo(sg2[0][0],sg2[0][1]); ctx.lineTo(sg2[1][0],sg2[1][1]); });
    ctx.strokeStyle='rgba(19,33,46,.20)'; ctx.lineWidth=3.2; ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=1.3; ctx.stroke();
    var nl=0;
    for(var z=Math.floor(segs.length/7);z<segs.length&&nl<3;z+=Math.max(7,Math.floor(segs.length/12))){
      var sgz=segs[z], cx=(sgz[0][0]+sgz[1][0])/2, cy=(sgz[0][1]+sgz[1][1])/2;
      if(cx<36||cy<70||cx>sz.x-36||cy>sz.y-70) continue;
      if(land){ var bad=false; [[0,0],[-26,-9],[26,-9],[-26,9],[26,9]].forEach(function(o3){ if(bad) return; var ll=map.containerPointToLatLng([cx+o3[0],cy+o3[1]]); if(land(ll.lat,ll.lng)!==0) bad=true; }); if(bad) continue; }
      if(labels.some(function(l){ return (l.x-cx)*(l.x-cx)+(l.y-cy)*(l.y-cy)<110*110; })) continue;
      if(occ.some(function(o){ return cx+32>o[0]-4&&cx-32<o[2]+4&&cy+10>o[1]-4&&cy-10<o[3]+4; })) continue;
      labels.push({x:cx,y:cy,v:lvB}); nl++;
    }
  });
  /* κόψιμο στην ακτή */
  ctx.save(); ctx.globalCompositeOperation='destination-out';
  if(vecOK){
    var path=new Path2D(), pb=bd.pad(0.05), bw2=pb.getWest(), be=pb.getEast(), bsth=pb.getSouth(), bn=pb.getNorth(), seen={};
    vt.forEach(function(k){ if(seen[k]) return; seen[k]=1; TL[k].t.rings.forEach(function(rg2){
      var bb=rg2.b; if(bb[2]<bw2||bb[0]>be||bb[3]<bsth||bb[1]>bn) return;
      var xy=rg2.xy, m2=xy.length>>1, lx=-1e9, ly=-1e9, first=true;
      for(var i5=0;i5<m2;i5++){ var p5=map.latLngToContainerPoint([xy[2*i5+1],xy[2*i5]]);
        if(first){ path.moveTo(p5.x,p5.y); first=false; lx=p5.x; ly=p5.y; continue; }
        if(i5<m2-1&&Math.abs(p5.x-lx)<0.7&&Math.abs(p5.y-ly)<0.7) continue;
        path.lineTo(p5.x,p5.y); lx=p5.x; ly=p5.y; }
      path.closePath(); }); });
    ctx.fillStyle='#000'; ctx.fill(path,'nonzero');
  } else if(mk){
    var mc=document.createElement('canvas'); mc.width=bw; mc.height=bh; var mx=mc.getContext('2d'), mi=mx.createImageData(bw,bh);
    for(var q4=0;q4<mk.length;q4++) if(mk[q4]) mi.data[q4*4+3]=255;
    mx.putImageData(mi,0,0); ctx.imageSmoothingEnabled=false; ctx.drawImage(mc,0,0,bw,bh,0,0,bw*bs,bh*bs);
  }
  ctx.restore();
  ctx.font='600 11px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  labels.forEach(function(l){
    var tx=fmt(l.v,l.v===1.25?2:1)+' m', tw=ctx.measureText(tx).width+10;
    ctx.fillStyle='rgba(255,255,255,.92)'; ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(l.x-tw/2,l.y-8,tw,16,8); else ctx.rect(l.x-tw/2,l.y-8,tw,16);
    ctx.fill(); ctx.fillStyle='#13212e'; ctx.fillText(tx,l.x,l.y+0.5);
  });
  swap();
  var tot=drawn, best=LV.map(function(l,ii){ return Math.round(100*cnt[ii]/tot)+'% '+(EN?l.en:l.el).toLowerCase(); }).filter(function(x5){ return x5.indexOf('0% ')!==0; });
  var miss=[]; if(!P.waves.length) miss.push(P.pointFallback?T('χάρτη μοντέλων κύματος· το swell είναι από την πρόγνωση του σημείου σου','wave model map; swell is from your point forecast'):T('μοντέλα κύματος','wave models')); if(!P.dur) miss.push(T('διάρκεια ανέμου','wind duration'));
  var errs=REG&&REG.err?Object.keys(REG.err).map(function(k){ var e=REG.err[k]; return k+': '+(/429/.test(e)?T('όριο αιτημάτων, ξαναδοκιμάζει σε λίγα λεπτά','rate limit, retrying in a few minutes'):e); }):[];
  status(T('Στη θέα: ','In view: ')+best.join(' · ')+(errs.length?' · '+T('Μοντέλα: ','Models: ')+errs.join(' | '):'')+(unc?T(' · αβέβαιο ',' · uncertain ')+Math.round(100*unc/tot)+'%':'')+(miss.length?T(' (χωρίς ',' (without ')+miss.join(T(' και ',' and '))+')':''));
  srcLine(); showPoint();
}
/* Βάθη με χρώματα κάτω από την κατάσταση θάλασσας μπερδεύονται (παρόμοια χρώματα). Όσο είναι ανοιχτή, τα βάθη φαίνονται ως γραμμές ΠΑΝΩ από τα χρώματα. */
var depTop=null;
function depthSync(){
  var DL=window.AlkyonDepthLayers, dm=window.AlkyonDepthMode?window.AlkyonDepthMode():0, dense=!!(window.AlkyonDense&&window.AlkyonDense.on&&window.AlkyonDense.on()), el=document.getElementById('ndSeaDep');
  var want=on&&dm>0&&!dense;
  if(DL){ try{ DL.c.setOpacity(on&&dm>0?0:0.6); DL.k.setOpacity(on&&dm>0?0:1); }catch(e){} }
  if(want&&!depTop){ depTop=Lf.tileLayer.wms('https://ows.emodnet-bathymetry.eu/wms',{layers:'emodnet:contours',format:'image/png',transparent:true,version:'1.3.0',pane:'ndDepthTop',attribution:'EMODnet Bathymetry'}); wxPane('ndDepthTop',345); }
  if(want&&depTop&&!map.hasLayer(depTop)) depTop.addTo(map);
  if(!want&&depTop&&map.hasLayer(depTop)) map.removeLayer(depTop);
  if(el){ el.hidden=!(on&&dm>0); el.textContent=T('Τα βάθη φαίνονται ως γραμμές όσο είναι ανοιχτή η κατάσταση θάλασσας.','Depths are shown as lines while sea state is on.'); }
}
function swap(){ var a=cvs[cur], b=cvs[1-cur]; a.classList.remove('nt'); b.classList.remove('nt'); b.style.opacity='1'; a.style.opacity='0'; cur=1-cur; }
window.addEventListener('alkyon-curs',function(){ later(); });
function later(ev){ if(ev&&ev.detail&&ev.detail.t) curT=ev.detail.t; clearTimeout(drawT); drawT=setTimeout(draw,60); }
function hide(){ clearTimeout(drawT); cvs.forEach(function(c){ c.classList.add('nt'); c.style.opacity='0'; }); }
function onWindStop(){ if(on){ ownWind=false; stop(); } }
function start(){
  if(on) return; on=true; ensure(); leg.hidden=false; document.body.classList.add('ndsea');
  btn.setAttribute('aria-pressed','true'); btn.classList.add('on');
  map.on('zoomstart',hide); map.on('moveend zoomend resize',later); window.addEventListener('alkyon-depthmode',depthSync); depthSync();
  window.addEventListener('alkyon-windhour',later); window.addEventListener('alkyon-windstop',onWindStop);
  map.getContainer().addEventListener('click',onTap,true);
  if(!windOn()&&window.AlkyonWindMap&&window.AlkyonWindMap.start){ ownWind=true; window.AlkyonWindMap.start(window.ALKYON_WINDY?{hidden:true}:undefined); }
  else if(window.AlkyonWindMap&&window.AlkyonWindMap.show){ /* ο άνεμος ήταν ήδη ανοιχτός: ξαναζωγραφίζεται το πλαίσιο με τα χρώματα πάνω */ try{ window.AlkyonWindMap.show(window.AlkyonWindMap.shown()); }catch(e){} }
  status(T('Φόρτωση…','Loading…'));
  loadIndex().then(function(){ if(on) later(); });
  later();
}
function stop(){
  on=false; clearTimeout(drawT); cvs.forEach(function(c){ c.style.opacity='0'; }); if(leg) leg.hidden=true; document.body.classList.remove('ndsea');
  btn.setAttribute('aria-pressed','false'); btn.classList.remove('on');
  map.off('zoomstart',hide); map.off('moveend zoomend resize',later); window.removeEventListener('alkyon-depthmode',depthSync);
  window.removeEventListener('alkyon-windhour',later); window.removeEventListener('alkyon-windstop',onWindStop);
  try{ map.getContainer().removeEventListener('click',onTap,true); }catch(e){}
  if(tapMk){ try{ map.removeLayer(tapMk); }catch(e){} tapMk=null; } tapLL=null; var pt=document.getElementById('ndSeaPt'); if(pt) pt.hidden=true;
  var W=window.AlkyonWindMap;
  if(windOn()&&W&&W.stop&&(ownWind||!(W.shown&&W.shown()))){ W.stop(); } else if(windOn()&&W&&W.show){ W.show(true); }
  ownWind=false; depthSync();
  var D=document.getElementById('ndMapDock'); if(D&&D._sync) D._sync();
}
btn.addEventListener('click',function(){ on?stop():start(); });
/* v31z520: ύψος και κατεύθυνση κύματος από τα μοντέλα, για όλη τη θάλασσα (και πέρα από τα 10 km). Για το πεδίο κύματος της v4. */
window.AlkyonSeaState.modelAt=function(lat,lon){ if(!on||!REG) return null; var RS=regs().filter(function(x){ return x.waves&&x.waves.length; });
  for(var ri=0;ri<RS.length;ri++){ var r=modelIn(RS[ri],lat,lon); if(r) return r; } return null; };
function modelIn(RG,lat,lon){ var b=RG.b; if(b&&(lat<b.s-0.05||lat>b.n+0.05||lon<b.w-0.05||lon>b.e+0.05)) return null; var P=prepFor(RG), hs=0, u=0, v=0, tp=0, n=0;
  P.waves.forEach(function(m){ var s=latSample(m.L,lat,lon,function(p){ return m.ok[p]?[m.h[p],m.wu[p],m.wv[p],m.tp[p]]:null; }); if(s){ hs+=s[0]; u+=s[1]; v+=s[2]; tp+=s[3]; n++; } });
  if(!n) return null; return {h:hs/n,dir:(u||v)?(Math.atan2(u,v)*180/Math.PI+360)%360:null,tp:tp/n}; }
window.AlkyonSeaState.ready=function(){ return !!(on&&REG&&regs().some(function(x){ return x.waves&&x.waves.length; })); };
window.AlkyonSeaState.start=start; window.AlkyonSeaState.stop=stop; window.AlkyonSeaState.pointInfo=pointInfo; window.AlkyonSeaState.clearTap=function(){ if(tapMk){ try{ map.removeLayer(tapMk); }catch(e){} tapMk=null; } tapLL=null; showPoint(); };
})();
