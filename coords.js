/* Συντεταγμένες σε μοίρες και δεκαδικά λεπτά (όπως στο GPS/πλότερ): N 35°03.602′  E 32°23.856′
   Δέχεται επίσης: 35 03.602 N · 35°03'36"N · 35.06715 · 3503.602 (NMEA) · ολόκληρο ζεύγος σε ένα πεδίο. */
(function(){
'use strict';
var P=window.AlkyonCoord={};
function hemi(v,axis){ return axis==='lat'?(v<0?'S':'N'):(v<0?'W':'E'); }
/* τιμή → «N 35°03.602′» */
var mode=function(){ return (window.AlkyonUnits&&window.AlkyonUnits.cfg&&window.AlkyonUnits.cfg.coord)||'dm'; };
var isDD=function(){ return mode()==='dd'; };
P.isDD=isDD; P.mode=mode;
P.fmtOne=function(v,axis){
  if(typeof v!=='number'||!isFinite(v)) return '';
  if(isDD()) return Math.abs(v).toFixed(5)+'° '+hemi(v,axis); /* δεκαδικές μοίρες: «35.43419° N» */
  if(mode()==='dms'){ /* μοίρες, λεπτά, δευτερόλεπτα: «N 35°26′03.1″» */
    var t=Math.round(Math.abs(v)*36000), dd=Math.floor(t/36000), rr=t-dd*36000, mi=Math.floor(rr/600), se=(rr-mi*600)/10;
    return hemi(v,axis)+' '+(axis==='lat'&&dd<10?'0'+dd:''+dd)+'°'+(mi<10?'0':'')+mi+'′'+(se<10?'0':'')+se.toFixed(1)+'″';
  }
  var a=Math.abs(v), d=Math.floor(a), m=(a-d)*60, ms=m.toFixed(3);
  if(parseFloat(ms)>=60){ d+=1; ms='0.000'; }
  var mm=(parseFloat(ms)<10?'0':'')+ms;
  return hemi(v,axis)+' '+(axis==='lat'&&d<10?'0'+d:''+d)+'°'+mm+'′';
};
/* ζεύγος → «N 35°03.602′ E 32°23.856′» */
P.fmt=function(lat,lon){
  if(typeof lat!=='number'||typeof lon!=='number') return '';
  return P.fmtOne(lat,'lat')+'  '+P.fmtOne(lon,'lon');
};
/* κείμενο → δεκαδικές μοίρες (NaN αν δεν είναι έγκυρο) */
P.parse=function(str,axis){
  if(str==null) return NaN;
  var s=String(str).trim().toUpperCase();
  if(!s) return NaN;
  var h=null, mt=s.match(/[NSEW]/g);
  if(mt){ if(mt.length>1) return NaN; h=mt[0]; s=s.replace(/[NSEW]/,' '); }
  if(h){ if(axis==='lat'&&(h==='E'||h==='W')) return NaN; if(axis==='lon'&&(h==='N'||h==='S')) return NaN; }
  var neg=/^\s*[-−–]/.test(s);
  s=s.replace(/,/g,'.').replace(/[°º˚'′’"″”`]/g,' ').replace(/[^0-9.\s]/g,' ');
  if(/\d\.\d+\.\d/.test(s)) return NaN; /* «35.05.18»: δύο υποδιαστολές στον ίδιο αριθμό */
  var nums=s.match(/\d+(?:\.\d+)?|\.\d+/g); if(!nums||nums.length>3) return NaN;
  nums=nums.map(parseFloat); var v;
  if(nums.length===1){
    var n=nums[0], ip=Math.floor(n), digs=String(ip).length;
    if(/^\s*\d+\.?\d*\s*$/.test(s)&&((axis==='lat'&&digs===4)||(axis==='lon'&&digs===5)||(axis==='lon'&&digs===4&&ip>=1000&&nums[0]>=1000))){ /* NMEA DDMM.mmm */
      var dd=Math.floor(n/100), mm=n-dd*100; if(mm>=60) return NaN; v=dd+mm/60;
    } else v=n;
  } else if(nums.length===2){ if(nums[1]>=60) return NaN; v=nums[0]+nums[1]/60; }
  else { if(nums[1]>=60||nums[2]>=60) return NaN; v=nums[0]+nums[1]/60+nums[2]/3600; }
  if(neg||h==='S'||h==='W') v=-v;
  var lim=axis==='lat'?90:180; if(!(Math.abs(v)<=lim)) return NaN;
  return v;
};
/* «N 35°03.602′ E 32°23.856′» σε ένα πεδίο → [lat,lon] ή null */
P.parsePair=function(str){
  var s=String(str||'').trim(); if(!s) return null;
  /* σύνδεσμοι Google Maps: @lat,lon · ?q=lat,lon · !3dLAT!4dLON */
  var gm=s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)||s.match(/[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i)||s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if(gm){ var gl=parseFloat(gm[1]), go=parseFloat(gm[2]); return (Math.abs(gl)<=90&&Math.abs(go)<=180)?[gl,go]:null; }
  s=s.replace(/^[\s(\[]+|[\s)\]]+$/g,'').replace(/\b(?:latitude|longitude|lat|lng|lon|long)\b\s*[:=]?/ig,' ').trim();
  var u=s.toUpperCase(), idx=[], i, a, b;
  for(i=0;i<u.length;i++) if('NSEW'.indexOf(u[i])>=0) idx.push(i);
  if(idx.length===2){
    var cut=/^[NSEW]/.test(u)?idx[1]:idx[0]+1; a=s.slice(0,cut); b=s.slice(cut);
    if(/[EW]/.test(u[idx[0]])){ var t=a; a=b; b=t; }
  } else if(!idx.length){
    var parts=null;
    if(/[;/]/.test(s)) parts=s.split(/[;/]/);
    else if(/,\s|\s,/.test(s)) parts=s.split(/\s*,\s+|\s+,\s*/);
    else if(/\./.test(s)&&/,/.test(s)) parts=s.split(',');
    else {
      /* μόνο κενά: «35.0518 32.385», «35,0518 32,385» (ελληνικό κόμμα), «35 03.602 32 23.856», «35 3 36 32 23 51» */
      var tk=s.split(/\s+/);
      if(tk.length===2&&/^[-−+]?\d+[.,]\d{2,}$/.test(tk[0])&&/^[-−+]?\d+[.,]\d{2,}$/.test(tk[1])) parts=tk;
      else if(tk.length===4) parts=[tk[0]+' '+tk[1],tk[2]+' '+tk[3]];
      else if(tk.length===6) parts=[tk.slice(0,3).join(' '),tk.slice(3).join(' ')];
    }
    if(!parts||parts.length!==2) return null; a=parts[0]; b=parts[1];
  }
  else return null;
  var la=P.parse(a,'lat'), lo=P.parse(b,'lon'); if(isNaN(la)||isNaN(lo)) return null; return [la,lo];
};

/* επικόλληση: ολόκληρη συντεταγμένη ή ζεύγος (κοινό για τις δύο μορφές) */
function bindPaste(w,el,axis,lat){
  w.addEventListener('paste',function(e){
    var t=(e.clipboardData||window.clipboardData); t=t?String(t.getData('text')).trim():''; if(!t||/^\d{1,3}$/.test(t)) return;
    var pr=el._pair&&P.parsePair(t);
    if(pr){ e.preventDefault(); var L=lat?el:el._pair, O=lat?el._pair:el; P.set(L,O,pr[0],pr[1]); L.dispatchEvent(new Event('input')); O.dispatchEvent(new Event('input')); return; }
    var one=P.parse(t,axis); if(!isNaN(one)){ e.preventDefault(); el.value=P.fmtOne(one,axis); el._cfSet(one); el.dispatchEvent(new Event('input')); }
  });
}
/* Δεκαδικές μοίρες: [N/S] [35.43419] ° — ένα κουτί */
function upgradeDD(el,axis){
  if(el._cf) return;
  var w=document.createElement('div'); w.className='cfield cfield-dd';
  var hb=document.createElement('button'); hb.type='button'; hb.className='cfh';
  var lat=axis==='lat', ip=document.createElement('input'), neg=false;
  ip.type='text'; ip.inputMode='decimal'; ip.maxLength=11; ip.placeholder=lat?'35.43419':'033.49663'; ip.className='cfdd'; ip.autocomplete='off'; ip.spellcheck=false;
  ip.setAttribute('autocapitalize','off'); ip.setAttribute('aria-label',lat?'Πλάτος σε δεκαδικές μοίρες':'Μήκος σε δεκαδικές μοίρες');
  function lab(){ hb.textContent=lat?(neg?'S':'N'):(neg?'W':'E'); }
  function clean(){ var v=ip.value.replace(/,/g,'.').replace(/[^0-9.]/g,''), i=v.indexOf('.'); if(i>=0) v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,''); if(v!==ip.value) ip.value=v; return v; }
  function push(){ var v=clean(); el.value=v?((lat?(neg?'S':'N'):(neg?'W':'E'))+' '+v+'°'):''; el.dispatchEvent(new Event('input',{bubbles:false})); }
  hb.addEventListener('click',function(){ neg=!neg; lab(); push(); });
  ip.addEventListener('input',push);
  ip.addEventListener('focus',function(){ try{ ip.select(); }catch(x){} });
  bindPaste(w,el,axis,lat);
  w.append(hb,ip,document.createTextNode('°'));
  el.style.display='none'; el.parentNode.insertBefore(w,el.nextSibling);
  el._cf=w;
  el._cfSet=function(v){ neg=v<0; lab(); ip.value=String(Math.round(Math.abs(v)*1e6)/1e6); };
  el._cfClear=function(){ neg=false; lab(); ip.value=''; };
  lab();
  var f=el.form; if(f) f.addEventListener('reset',function(){ setTimeout(function(){ el._cfClear(); },0); });
}
/* Μοίρες, λεπτά, δευτερόλεπτα: [N/S] [41]° [24]′ [12.2]″ */
function upgradeDMS(el,axis){
  if(el._cf) return;
  var w=document.createElement('div'); w.className='cfield cfield-dms';
  var hb=document.createElement('button'); hb.type='button'; hb.className='cfh';
  var lat=axis==='lat', dg=document.createElement('input'), mm=document.createElement('input'), ss=document.createElement('input'), neg=false;
  function cfg(i,cls,ph,ml,lab,im){ i.type='text'; i.inputMode=im||'numeric'; i.maxLength=ml; i.placeholder=ph; i.className=cls; i.autocomplete='off'; i.setAttribute('autocapitalize','off'); i.setAttribute('aria-label',lab); i.spellcheck=false; }
  cfg(dg,'cfd',lat?'35':'033',3,lat?'Μοίρες πλάτους':'Μοίρες μήκους'); cfg(mm,'cfm2','00',2,'Λεπτά'); cfg(ss,'cfs','00.0',5,'Δευτερόλεπτα','decimal');
  function lab(){ hb.textContent=lat?(neg?'S':'N'):(neg?'W':'E'); }
  function cleanSec(){ var v=ss.value.replace(/,/g,'.').replace(/[^0-9.]/g,'').replace(/^\.+/,''), i=v.indexOf('.'); if(i>=0) v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,''); if(v!==ss.value) ss.value=v; return v; }
  function push(){
    var d=dg.value, m=mm.value, s=cleanSec();
    el.value=(!d&&!m&&!s)?'':(lat?(neg?'S':'N'):(neg?'W':'E'))+' '+(d||'0')+'°'+(m||'0')+'′'+(s||'0')+'″';
    el.dispatchEvent(new Event('input',{bubbles:false}));
  }
  function digits(i,max){ var v=i.value.replace(/\D/g,'').slice(0,max); if(v!==i.value) i.value=v; return v; }
  function degFull(v){ return lat?v.length>=2:(v.length>=3||(v.length===2&&+v>=20)); }
  hb.addEventListener('click',function(){ neg=!neg; lab(); push(); });
  dg.addEventListener('input',function(){ var v=digits(dg,lat?2:3); push(); if(degFull(v)) mm.focus(); });
  mm.addEventListener('input',function(){ var v=digits(mm,2); push(); if(v.length>=2) ss.focus(); });
  ss.addEventListener('input',push);
  function dot(from,to){ from.addEventListener('keydown',function(e){ if(e.key==='.'||e.key===','){ e.preventDefault(); if(from.value) to.focus(); } }); }
  dot(dg,mm); dot(mm,ss);
  ss.addEventListener('keydown',function(e){ if((e.key==='.'||e.key===',')&&!ss.value) e.preventDefault(); });
  ss.addEventListener('keydown',function(e){ if(e.key==='Backspace'&&!ss.value){ e.preventDefault(); mm.focus(); var n=mm.value.length; try{ mm.setSelectionRange(n,n); }catch(x){} } });
  mm.addEventListener('keydown',function(e){ if(e.key==='Backspace'&&!mm.value){ e.preventDefault(); dg.focus(); var n=dg.value.length; try{ dg.setSelectionRange(n,n); }catch(x){} } });
  [dg,mm,ss].forEach(function(i){ i.addEventListener('focus',function(){ try{ i.select(); }catch(x){} }); });
  bindPaste(w,el,axis,lat);
  var tx=function(t){ return document.createTextNode(t); };
  w.append(hb,dg,tx('°'),mm,tx('′'),ss,tx('″'));
  el.style.display='none'; el.parentNode.insertBefore(w,el.nextSibling);
  el._cf=w;
  el._cfSet=function(v){
    var t=Math.round(Math.abs(v)*36000), d=Math.floor(t/36000), r=t-d*36000, m=Math.floor(r/600), s=(r-m*600)/10;
    neg=v<0; lab(); dg.value=String(d); mm.value=(m<10?'0':'')+m; ss.value=(s<10?'0':'')+s.toFixed(1);
  };
  el._cfClear=function(){ neg=false; lab(); dg.value=''; mm.value=''; ss.value=''; };
  lab();
  var f=el.form; if(f) f.addEventListener('reset',function(){ setTimeout(function(){ el._cfClear(); },0); });
}
/* Πεδίο με σταθερά σύμβολα: [N/S] [μοίρες]° [λεπτά]′. Το αρχικό input μένει κρυφό και κρατά την τιμή «N 35°05.529′». */
function upgrade(el,axis){
  if(el._cf) return;
  if(isDD()) return upgradeDD(el,axis);
  if(mode()==='dms') return upgradeDMS(el,axis);
  var w=document.createElement('div'); w.className='cfield';
  var hb=document.createElement('button'); hb.type='button'; hb.className='cfh';
  var lat=axis==='lat', dg=document.createElement('input'), mm=document.createElement('input'), mf=document.createElement('input');
  function cfg(i,cls,ph,ml,lab){ i.type='text'; i.inputMode='numeric'; i.maxLength=ml; i.placeholder=ph; i.className=cls; i.autocomplete='off'; i.setAttribute('autocapitalize','off'); i.setAttribute('aria-label',lab); i.spellcheck=false; }
  cfg(dg,'cfd',lat?'35':'032',3,lat?'Μοίρες πλάτους':'Μοίρες μήκους'); cfg(mm,'cfm2','00',2,'Λεπτά'); cfg(mf,'cff','000',3,'Δεκαδικά λεπτών');
  var neg=false;
  function lab(){ hb.textContent=lat?(neg?'S':'N'):(neg?'W':'E'); }
  function push(){
    var d=dg.value, m=mm.value, f=mf.value, mt=m||f?((m||'0')+(f?'.'+f:'')):'';
    el.value=(!d&&!mt)?'':(lat?(neg?'S':'N'):(neg?'W':'E'))+' '+(d||'0')+'°'+(mt||'0')+'′';
    el.dispatchEvent(new Event('input',{bubbles:false}));
  }
  function digits(i,max){ var v=i.value.replace(/\D/g,'').slice(0,max); if(v!==i.value) i.value=v; return v; }
  /* αυτόματη μετάβαση στο επόμενο κουτί όταν γεμίσει· Backspace σε κενό γυρνά στο προηγούμενο */
  function degFull(v){ return lat?v.length>=2:(v.length>=3||(v.length===2&&+v>=20)); }
  hb.addEventListener('click',function(){ neg=!neg; lab(); push(); });
  dg.addEventListener('input',function(){ var v=digits(dg,lat?2:3); push(); if(degFull(v)) mm.focus(); });
  mm.addEventListener('input',function(){ var v=digits(mm,2); push(); if(v.length>=2) mf.focus(); });
  mf.addEventListener('input',function(){ digits(mf,3); push(); });
  /* τελεία ή κόμμα = πήγαινε στο επόμενο κουτί */
  function dot(from,to){ from.addEventListener('keydown',function(e){ if(e.key==='.'||e.key===','){ e.preventDefault(); if(from.value) to.focus(); } }); }
  dot(dg,mm); dot(mm,mf);
  function back(from,to){ from.addEventListener('keydown',function(e){ if(e.key==='Backspace'&&!from.value){ e.preventDefault(); to.focus(); var n=to.value.length; try{ to.setSelectionRange(n,n); }catch(x){} } }); }
  back(mm,dg); back(mf,mm);
  [dg,mm,mf].forEach(function(i){ i.addEventListener('focus',function(){ try{ i.select(); }catch(x){} }); });
  bindPaste(w,el,axis,lat);
  var dotEl=function(){ var x=document.createElement('span'); x.className='cfdot'; x.textContent='.'; return x; };
  w.append(hb,dg,document.createTextNode('°'),mm,dotEl(),mf,document.createTextNode('′'));
  el.style.display='none'; el.parentNode.insertBefore(w,el.nextSibling);
  el._cf=w; el._cfSet=function(v){
    var a=Math.abs(v), d=Math.floor(a), m=((a-d)*60).toFixed(3); if(parseFloat(m)>=60){ d+=1; m='0.000'; }
    var pp=m.split('.'); neg=v<0; lab(); dg.value=String(d); mm.value=(pp[0].length<2?'0':'')+pp[0]; mf.value=pp[1]||'000';
  };
  el._cfClear=function(){ neg=false; lab(); dg.value=''; mm.value=''; mf.value=''; };
  lab();
  var f=el.form; if(f) f.addEventListener('reset',function(){ setTimeout(function(){ el._cfClear(); },0); });
}
/* δέσιμο δύο πεδίων κειμένου. Επικόλληση ζεύγους στο πρώτο πεδίο τα γεμίζει και τα δύο. onChange(lat|null,lon|null) */
var PAIRS=[];
var MODES=[['dm','35°26.052′'],['dd','35.43419°'],['dms','35°26′3.1″']];
function noteText(m){
  var en=window.LANG==='en';
  return {dm:en?'Degrees and minutes, as on the chartplotter.':'Μοίρες και λεπτά, όπως στο πλότερ.',dd:en?'Decimal degrees, as on iPhone and Google Maps.':'Δεκαδικές μοίρες, όπως στο iPhone και στο Google Maps.',dms:en?'Degrees, minutes and seconds.':'Μοίρες, λεπτά και δευτερόλεπτα.'}[m]+(en?' You can also paste the whole pair.':' Δέχεται και επικόλληση ολόκληρου του ζεύγους.');
}
function paintSwitch(pr){
  var m=mode(); if(!pr.sw) return;
  Array.prototype.forEach.call(pr.sw.querySelectorAll('button'),function(b){ b.setAttribute('aria-pressed',String(b.getAttribute('data-m')===m)); });
  var n=pr.note; if(n){ if(n.getAttribute('data-orig')==null) n.setAttribute('data-orig',n.textContent); n.textContent=m==='dm'?n.getAttribute('data-orig'):noteText(m); }
}
/* αλλαγή μορφής επιτόπου, χωρίς επανεκκίνηση: ξαναχτίζει όλα τα πεδία συντεταγμένων κρατώντας τις τιμές */
P.setMode=function(m){
  if(!MODES.some(function(x){ return x[0]===m; })) return;
  var vals=PAIRS.map(function(pr){ return [P.parse(pr.la.value,'lat'),P.parse(pr.lo.value,'lon')]; });
  if(window.AlkyonUnits&&window.AlkyonUnits.set) window.AlkyonUnits.set('coord',m);
  PAIRS.forEach(function(pr,i){
    [pr.la,pr.lo].forEach(function(el){ if(el._cf){ el._cf.remove(); el._cf=null; } el.style.display=''; });
    upgrade(pr.la,'lat'); upgrade(pr.lo,'lon');
    if(pr.sw&&pr.lo._cf) pr.lo._cf.after(pr.sw);
    var v=vals[i], a=isNaN(v[0])?null:v[0], o=isNaN(v[1])?null:v[1];
    P.set(pr.la,pr.lo,a==null?undefined:a,o==null?undefined:o);
    paintSwitch(pr);
    pr.la.dispatchEvent(new Event('input')); pr.lo.dispatchEvent(new Event('input'));
  });
};
function addSwitch(pr){
  var sw=document.createElement('div'); sw.className='cfmode'; sw.setAttribute('role','group'); sw.setAttribute('aria-label',window.LANG==='en'?'Coordinate format':'Μορφή συντεταγμένων');
  MODES.forEach(function(x){ var b=document.createElement('button'); b.type='button'; b.setAttribute('data-m',x[0]); b.textContent=x[1]; b.addEventListener('click',function(){ P.setMode(x[0]); }); sw.appendChild(b); });
  pr.sw=sw; if(pr.lo._cf) pr.lo._cf.after(sw);
  var box=pr.lo.closest('#bCoordWrap')||pr.lo.closest('form')||pr.lo.parentNode; pr.note=box&&box.querySelector('.note')||null;
  paintSwitch(pr);
}
P.bind=function(latEl,lonEl,onChange){
  upgrade(latEl,'lat'); upgrade(lonEl,'lon'); latEl._pair=lonEl; lonEl._pair=latEl;
  var pr={la:latEl,lo:lonEl,sw:null,note:null}; PAIRS.push(pr); addSwitch(pr);
  function state(){
    var la=P.parse(latEl.value,'lat'), lo=P.parse(lonEl.value,'lon');
    latEl._cf.classList.toggle('bad',!!latEl.value.trim()&&isNaN(la)); lonEl._cf.classList.toggle('bad',!!lonEl.value.trim()&&isNaN(lo));
    return {la:isNaN(la)?null:la,lo:isNaN(lo)?null:lo};
  }
  function emit(){ var s=state(); if(onChange) onChange(s.la,s.lo); }
  function pair(){ var pr=P.parsePair(latEl.value); if(pr){ latEl.value=P.fmtOne(pr[0],'lat'); lonEl.value=P.fmtOne(pr[1],'lon'); return true; } return false; }
  [latEl,lonEl].forEach(function(el){ el.setAttribute('autocomplete','off'); el.setAttribute('autocapitalize','characters'); el.setAttribute('spellcheck','false'); });
  latEl.addEventListener('input',function(){ if(/[EW]/i.test(latEl.value)&&/[NS]/i.test(latEl.value)) pair(); emit(); });
  lonEl.addEventListener('input',emit);
  latEl.addEventListener('blur',function(){ var v=P.parse(latEl.value,'lat'); if(!isNaN(v)) latEl.value=P.fmtOne(v,'lat'); emit(); });
  lonEl.addEventListener('blur',function(){ var v=P.parse(lonEl.value,'lon'); if(!isNaN(v)) lonEl.value=P.fmtOne(v,'lon'); emit(); });
};
P.set=function(latEl,lonEl,lat,lon){
  latEl.value=typeof lat==='number'?P.fmtOne(lat,'lat'):''; lonEl.value=typeof lon==='number'?P.fmtOne(lon,'lon'):'';
  if(latEl._cf){ if(typeof lat==='number') latEl._cfSet(lat); else latEl._cfClear(); latEl._cf.classList.remove('bad'); }
  if(lonEl&&lonEl._cf){ if(typeof lon==='number') lonEl._cfSet(lon); else lonEl._cfClear(); lonEl._cf.classList.remove('bad'); }
};
P.get=function(latEl,lonEl){ var la=P.parse(latEl.value,'lat'), lo=P.parse(lonEl.value,'lon'); return (isNaN(la)||isNaN(lo))?null:{lat:la,lon:lo}; };
})();
