/* Χάρτης ανέμου (κινούμενα σωματίδια, τύπου Windy): πλέγμα ανέμου από Open-Meteo για την περιοχή που βλέπεις,
   ωριαίο, 48 ώρες μπροστά. Ενδεικτικό (μοντέλο, χοντρό πλέγμα), όχι μέτρηση στο σημείο. */
(function(){
'use strict';
var C=window.PsaroCore, mb=document.querySelector('.mapbtns'), L=window.L; if(!C||!mb||!L) return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var btn=document.createElement('button'); btn.type='button'; btn.id='bWind'; btn.className='mbtn'; btn.setAttribute('aria-pressed','false');
btn.setAttribute('aria-label',T('Άνεμος στον χάρτη','Wind on the map')); btn.title=btn.getAttribute('aria-label');
btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8a3 3 0 1 1-3 3"/></svg>';
mb.appendChild(btn);
var N=11, MODELS=[['ecmwf_ifs025','ECMWF'],['icon_global','ICON'],['gfs_global','GFS']], SEL=0, nowIdx=0, stations=null, stLayer=null, stErr=null, grid=null, hours=[], hi=0, on=false, cv=null, ctx=null, panel=null, parts=[], raf=0, loadId=0, mvT=null, last=0;
var wxSrc='', wxAt=null, shown=false, stOn=false; /* από πού ήρθε το πλέγμα: live (νέο από την πηγή), cache (κοινή μνήμη), stale (παλαιότερο, η πηγή δεν απαντούσε), direct (απευθείας) */
var COLS=[[0,'#6c78d8'],[3,'#4f9fd8'],[7,'#3fc4a6'],[11,'#66d46a'],[16,'#c9dc4a'],[22,'#f2b134'],[28,'#ec6a3c'],[34,'#d6394f'],[41,'#a62a8a']];
function col(kn){ var c=COLS[0][1]; for(var i=0;i<COLS.length;i++){ if(kn>=COLS[i][0]) c=COLS[i][1]; } return c; }
function unit(){ try{ return window.PsaroUnits.wind(1)!==undefined; }catch(e){ return false; } }
function W(kn){ try{ return window.PsaroUnits.wind(kn); }catch(e){ return Math.round(kn)+' kn'; } }
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dn(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; }
/* v31z351: οι καμβάδες καιρού μπαίνουν σε δικό τους «pane» του Leaflet, κάτω από τις περιοχές, τα ψάρια, τα σημεία και τους σταθμούς.
   Σειρά (κάτω → πάνω): χάρτης, βάθη (χρώματα), κατάσταση θάλασσας (340), γραμμές βάθους πάνω από τη θάλασσα (345), άνεμος (360), περιοχές (400), σημάδια (600). */
function wxPane(name,z){ var p=map.getPane(name)||map.createPane(name); p.style.zIndex=String(z); p.style.pointerEvents='none'; return p; }
function pin(c){ try{ L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0])); }catch(e){} }
/* Ένα κοινό κάτω πλαίσιο για «Κατάσταση θάλασσας» και «Άνεμο», αντί για δύο κάρτες τη μία πάνω στην άλλη */
function dock(){
  var d=document.getElementById('ndMapDock'); if(d) return d;
  d=document.createElement('div'); d.id='ndMapDock'; d.hidden=true;
  d.style.cssText='position:fixed;left:8px;right:8px;bottom:calc(var(--navh,64px) + 30px + env(safe-area-inset-bottom,0px));z-index:900;background:var(--card,var(--bg,#fff));color:var(--ink,#111);border:1px solid var(--line,#8886);border-radius:14px;box-shadow:0 4px 18px #0004;max-height:52vh;overflow:auto';
  document.body.appendChild(d);
  function sync(){ var any=[].some.call(d.children,function(c){ return !c.hidden; }); d.hidden=!any; [].forEach.call(d.children,function(c,i){ c.style.borderTop=(i>0&&!c.hidden&&[].slice.call(d.children,0,i).some(function(x){ return !x.hidden; }))?'1px solid var(--line,#8883)':'0'; });
    document.documentElement.style.setProperty('--ndwh',any?Math.round(d.getBoundingClientRect().height)+'px':'0px'); }
  try{ new MutationObserver(function(ms){ if(ms.some(function(m){ return m.type==='childList'||m.target.parentNode===d; })) sync(); }).observe(d,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']}); }catch(e){}
  try{ if(window.ResizeObserver) new ResizeObserver(sync).observe(d); }catch(e){}
  d._sync=sync; return d;
}
window.PsaroMapDock=dock;
function ensure(){
  if(!cv){
    cv=document.createElement('canvas'); cv.id='ndWindCv'; cv.setAttribute('aria-hidden','true');
    cv.style.cssText='position:absolute;left:0;top:0;pointer-events:none';
    wxPane('ndWindPane',360).appendChild(cv); ctx=cv.getContext('2d'); fit();
    map.on('move zoomend viewreset resize',function(){ if(cv) pin(cv); });
  }
  if(panel&&panel.isConnected) return;
  panel=document.createElement('div'); panel.id='ndWindPanel'; panel.setAttribute('role','group'); panel.setAttribute('aria-label',T('Άνεμος','Wind'));
  panel.style.cssText='padding:8px 10px';
  var D=dock(); D.appendChild(panel); if(D._sync) D._sync();
}
function fit(){ var s=map.getSize(), r=Math.min(window.devicePixelRatio||1,2); cv.width=s.x*r; cv.height=s.y*r; cv.style.width=s.x+'px'; cv.style.height=s.y+'px'; ctx.setTransform(r,0,0,r,0,0); pin(cv); }
function clear(){ if(ctx){ var s=map.getSize(); ctx.clearRect(0,0,s.x,s.y); } }
var detOpen=false, tapLL=null, tapPop=null;
function pu(){ return window.PsaroUnits; }
function diffTxt(d){ var p=pu(), c=p&&p.cfg&&p.cfg.wind; var sg=d>0?'+':d<0?'−':''; var a=Math.abs(d);
  if(c==='kmh') return sg+Math.round(a*1.852)+' km/h'; if(c==='ms') return sg+(Math.round(a*0.514444*10)/10)+' m/s'; if(c==='mph') return sg+Math.round(a*1.15078)+' mph';
  return sg+Math.round(a)+' kn'; }
function drawPanel(msg){
  if(!panel) return; var sc=panel.scrollTop; panel.replaceChildren();
  var top=document.createElement('div'); top.style.cssText='display:flex;align-items:center;gap:8px';
  var pb=document.createElement('button'); pb.type='button'; pb.id='ndWindPlay'; pb.className='btn sm'; pb.style.cssText='min-width:40px;min-height:40px;flex:none;font-size:16px;padding:0'; pb.textContent=playing?'⏸':'▶'; pb.setAttribute('aria-label',playing?T('Παύση','Pause'):T('Αναπαραγωγή','Play')); pb.setAttribute('aria-pressed',String(!!playing));
  var sl=document.createElement('input'); sl.type='range'; sl.id='ndWindSl'; sl.min=0; sl.max=Math.max(0,hours.length-1); sl.value=hi; sl.style.cssText='flex:1;min-width:0'; sl.setAttribute('aria-label',T('Ώρα','Hour')); if(msg||!hours.length){ sl.disabled=true; pb.disabled=true; }
  sl.addEventListener('input',function(){ hi=+sl.value; pause(); label(); seed(); });
  pb.addEventListener('click',function(){ playing?pause():play(); });
  var tg=document.createElement('button'); tg.type='button'; tg.className='btn ghost sm'; tg.style.cssText='min-width:40px;min-height:40px;flex:none;padding:0'; tg.textContent=detOpen?'▾':'▴'; tg.setAttribute('aria-expanded',String(detOpen)); tg.setAttribute('aria-label',T('Λεπτομέρειες','Details')); tg.addEventListener('click',function(){ detOpen=!detOpen; drawPanel(); });
  var x=document.createElement('button'); x.type='button'; x.className='btn ghost sm'; x.style.cssText='min-width:40px;min-height:40px;flex:none;padding:0'; x.textContent='✕'; x.setAttribute('aria-label',seaOn()?T('Απόκρυψη ανέμου (η κατάσταση θάλασσας μένει)','Hide wind (sea state stays on)'):T('Κλείσιμο','Close')); x.addEventListener('click',function(){ if(seaOn()) show(false); else stop(); });
  top.append(pb,sl,tg); if(!seaOn()||shown) top.append(x); panel.append(top);
  var lab=document.createElement('div'); lab.id='ndWindLab'; lab.style.cssText='font-weight:600;font-size:13px;margin-top:4px'; lab.setAttribute('aria-live','polite'); panel.append(lab);
  if(msg){ lab.textContent=msg; return; }
  var hint=document.createElement('div'); hint.className='note'; hint.style.cssText='font-size:11px'; hint.hidden=seaOn()&&!detOpen; hint.textContent=T('Πάτα στον χάρτη για να δεις κατεύθυνση και ένταση σε οποιοδήποτε σημείο.','Tap the map to see direction and strength at any point.'); panel.append(hint);
  if(wxSrc&&(!seaOn()||detOpen)){ var sr=document.createElement('div'); sr.className='note'; sr.style.cssText='font-size:11px';
    var hhmm=wxAt?new Date(wxAt).toLocaleTimeString(EN?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'}):'';
    sr.textContent=wxSrc==='stale'?T('Πρόγνωση από κοινή μνήμη, ώρα λήψης '+hhmm+'. Η πηγή δεν απαντούσε, τα δεδομένα μπορεί να είναι παλιά.','Forecast from shared cache, fetched '+hhmm+'. The source was not responding; data may be old.'):wxSrc==='direct'?T('Πρόγνωση απευθείας από την πηγή (η κοινή μνήμη δεν απάντησε).','Forecast straight from the source (shared cache did not respond).'):T('Πρόγνωση από κοινή μνήμη, ώρα λήψης '+hhmm+'.','Forecast from shared cache, fetched '+hhmm+'.');
    panel.append(sr); }
  if(detOpen){
    var d=document.createElement('div'); d.style.cssText='margin-top:6px;border-top:1px solid var(--line,#8883);padding-top:6px';
    var rw=document.createElement('div'); rw.style.cssText='display:flex;gap:8px';
    function sel(labTxt,opts,val,fn){ var l=document.createElement('label'); l.className='f'; l.style.cssText='flex:1;margin:0'; l.append(document.createTextNode(labTxt)); var s=document.createElement('select'); opts.forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; s.append(op); }); s.value=String(val); s.addEventListener('change',function(){ fn(s.value); }); l.append(s); return l; }
    var mo=[[0,(grid&&grid.m.length>1?T('Μέσος όρος μοντέλων','Model average'):grid.m[0].name)]]; if(grid.m.length>1) grid.m.forEach(function(m,i){ mo.push([i+1,m.name]); });
    rw.append(sel(T('Μοντέλο','Model'),mo,SEL,function(v){ SEL=+v; label(); seed(); }));
    var P=pu(); if(P&&P.options&&P.options.wind) rw.append(sel(T('Μονάδα ανέμου','Wind unit'),P.options.wind,P.cfg.wind,function(v){ P.set('wind',v); }));
    d.append(rw);
    var lg=document.createElement('div'); lg.style.cssText='display:flex;height:8px;border-radius:4px;overflow:hidden;margin:8px 0 2px'; COLS.forEach(function(c){ var s=document.createElement('span'); s.style.cssText='flex:1;background:'+c[1]; lg.append(s); }); d.append(lg);
    var lt=document.createElement('div'); lt.className='note'; lt.style.cssText='display:flex;justify-content:space-between;font-size:11px'; [0,7,16,28,41].forEach(function(k,i){ var s=document.createElement('span'); s.textContent=W(k)+(i===4?'+':''); lt.append(s); }); d.append(lt);
    var ag=document.createElement('div'); ag.id='ndWindAg'; ag.style.cssText='margin-top:8px;font-size:13px'; d.append(ag);
    var lo=document.createElement('div'); lo.id='ndWindLocal'; lo.style.cssText='margin-top:10px;font-size:13px;border-top:1px solid var(--line,#8883);padding-top:8px'; d.append(lo);
    var st=document.createElement('div'); st.id='ndWindSt'; st.style.cssText='margin-top:8px;font-size:13px'; d.append(st);
    var nt=document.createElement('p'); nt.className='note'; nt.style.marginTop='6px'; nt.textContent=T('Μοντέλα (Open-Meteo): ανάλυση περίπου 7–25 km, πλέγμα 11×11 για την περιοχή που βλέπεις. Ενδεικτικό: δεν δείχνει τοπικά φαινόμενα κοντά στην ακτή (π.χ. θαλάσσια αύρα). Οι μετρήσεις σταθμών είναι το μόνο πραγματικό στοιχείο.','Models (Open-Meteo): roughly 7–25 km resolution, 11×11 grid for the area in view. Indicative: it does not show local effects near the coast (e.g. sea breeze). Station observations are the only real measurements.'); d.append(nt);
    panel.append(d);
  }
  label(); panel.scrollTop=sc;
}
function tapData(ll){
  var v=sample(ll.lat,ll.lng); if(!v) return null;
  var P=pu(), kn=Math.round(v.sp), bf=P&&P.bft?P.bft(v.sp):'', main=W(v.sp), alt=(P&&P.cfg.wind==='kn')?(bf!==''?bf+' Bft':''):kn+' kn';
  /* ύψος κύματος στο σημείο, όταν είναι ανοιχτό το επίπεδο «Κατάσταση θάλασσας» */
  var wv=''; try{ var S=window.PsaroSeaState; if(S&&S.pointInfo&&document.body.classList.contains('ndsea')){ var r=S.pointInfo(ll.lat,ll.lng); if(r&&r.hs>=0){ var f1=function(x){ var q=x.toFixed(1); return EN?q:q.replace('.',','); };
    wv='🌊 ≈'+f1(r.hs)+' m'+(r.wdir!=null?' '+dn(r.wdir)+' <svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px;transform:rotate('+Math.round(r.wdir)+'deg)"><path d="M12 4v15M7 14l5 5 5-5" stroke="#7fd3ff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+(r.period>0?' · '+Math.round(r.period)+' s':'')+(isFinite(r.distKm)?' · '+T('ακτή ','shore ')+(r.distKm<1?Math.round(r.distKm*1000)+' m':f1(r.distKm)+' km'):''); } } }catch(e){}
  return {v:v,txt:dn(v.dir)+' '+Math.round(v.dir)+'° · '+main+(alt?' ('+alt+')':''),sea:wv};
}
function tapIcon(ll){
  var d=tapData(ll), body;
  /* v31z519: στη v4 τα στοιχεία του σημείου φαίνονται σε κάρτα στο κάτω πλαίσιο· στον χάρτη μένει μόνο η κουκκίδα */
  if(window.PSARO_TAPCARD){ try{ window.dispatchEvent(new CustomEvent('psaro-wxtap',{detail:{lat:ll.lat,lng:ll.lng}})); }catch(e){} return L.divIcon({className:'',iconSize:[0,0],html:'<div style="position:absolute;left:-8px;top:-8px;width:16px;height:16px;border-radius:50%;background:#fff;border:4px solid '+(d?col(d.v.sp):'#888')+';box-shadow:0 1px 5px #0009"></div>'}); }
  if(!d) body='<span>'+T('Εκτός περιοχής δεδομένων','Outside the data area')+'</span>';
  else body='<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px;margin-right:5px;transform:rotate('+Math.round(d.v.dir)+'deg)"><path d="M12 3v16M6 13l6 6 6-6" stroke="'+col(d.v.sp)+'" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><span>'+d.txt+'</span>'+(d.sea?'<div style="font-weight:600;font-size:12px;opacity:.95;margin-top:2px">'+d.sea+'</div>':'');
  return L.divIcon({className:'',iconSize:[0,0],html:'<div style="position:relative"><div style="position:absolute;left:-7px;top:-7px;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid '+(d?col(d.v.sp):'#888')+';box-shadow:0 1px 4px #0008"></div><div style="position:absolute;bottom:12px;left:0;transform:translateX(-50%);background:rgba(10,20,30,.93);color:#fff;border-radius:10px;padding:5px 10px;font:600 13px system-ui;white-space:nowrap;box-shadow:0 2px 8px #0008">'+body+'</div></div>'});
}
function clearTap(q){ if(tapPop){ try{ map.removeLayer(tapPop); }catch(e){} tapPop=null; } tapLL=null; if(window.PSARO_TAPCARD&&!q) try{ window.dispatchEvent(new CustomEvent('psaro-wxtap',{detail:{clear:true}})); }catch(e){} }
function onTap(e){
  if(!on||!grid||(!shown&&!seaOn())) return;
  var t=e.target; if(t&&t.closest&&(t.closest('.mapbtns')||t.closest('#ndMapDock')||t.closest('#ndRuler')||t.closest('.leaflet-marker-icon')||t.closest('.leaflet-control')||t.closest('.ndbar')||t.closest('.ndsheet')||t.closest('.ndsb')||t.closest('button,a,input,select'))) return;
  if(document.getElementById('ndRuler')) return;
  e.stopPropagation(); e.preventDefault();
  var ll=map.mouseEventToLatLng(e); tapLL=ll;
  if(tapPop) try{ map.removeLayer(tapPop); }catch(x){}
  tapPop=L.marker(ll,{icon:tapIcon(ll),interactive:false,keyboard:false,zIndexOffset:3000}).addTo(map);
}
function refreshTap(){ if(tapPop&&tapLL) tapPop.setIcon(tapIcon(tapLL)); }
var playing=false, ptm=null;
function sync(){ var sl=document.getElementById('ndWindSl'), pb=document.getElementById('ndWindPlay'); if(sl) sl.value=hi; if(pb){ pb.textContent=playing?'⏸':'▶'; pb.setAttribute('aria-label',playing?T('Παύση','Pause'):T('Αναπαραγωγή','Play')); pb.setAttribute('aria-pressed',String(!!playing)); } }
function pause(){ playing=false; clearInterval(ptm); ptm=null; sync(); }
function play(){
  if(!hours.length) return; playing=true; clearInterval(ptm); sync();
  ptm=setInterval(function(){ if(!on||!grid){ pause(); return; } if(document.hidden) return; hi=hi>=hours.length-1?Math.max(0,nowIdx):hi+1; sync(); label(); },700);
}
function label(){
  try{ window.dispatchEvent(new CustomEvent('psaro-windhour',{detail:{t:hours[hi]||null}})); }catch(e){}
  var el=document.getElementById('ndWindLab'); if(!el||!hours.length) return; refreshTap();
  var t=hours[hi], ms=Date.parse(t+'Z'), s;
  try{ s=new Date(ms).toLocaleString(EN?'en-GB':'el-GR',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Nicosia'}); }catch(e){ s=t.slice(11,16)+'Z'; }
  var c=map.getCenter(), v=sample(c.lat,c.lng);
  el.textContent=s+(v?' · '+T('κέντρο χάρτη: ','map centre: ')+dn(v.dir)+' '+W(v.sp):'');
  var ag=document.getElementById('ndWindAg'); if(ag){ var a=agree(c.lat,c.lng); ag.replaceChildren();
    if(!a){ ag.textContent=grid&&grid.m.length<2?T('Διαθέσιμο μόνο ένα μοντέλο: δεν μπορεί να μετρηθεί η διαφωνία.','Only one model available: agreement cannot be measured.'):''; }
    else{ var lvTxt=[T('Τα μοντέλα συμφωνούν','Models agree'),T('Μέτρια διαφωνία μοντέλων','Moderate disagreement'),T('Μεγάλη διαφωνία: χαμηλή βεβαιότητα','Large disagreement: low confidence')][a.lv];
      var bd=document.createElement('b'); bd.textContent=(a.lv===0?'✅ ':a.lv===1?'⚠️ ':'🔴 ')+lvTxt; ag.append(bd,document.createElement('br'));
      ag.append(document.createTextNode(a.vs.map(function(x){ return x.n+' '+dn(x.v.dir)+' '+W(x.v.sp); }).join(' · ')+' ('+T('διαφορά ','spread ')+diffTxt(a.dsp).replace(/^[+−]/,'')+(a.dd?', '+Math.round(a.dd)+'°':'')+')')); } }
  var lo=document.getElementById('ndWindLocal'); if(lo&&window.PsaroWindLocal){ var kk=c.lat.toFixed(2)+','+c.lng.toFixed(2)+':'+(v?Math.round(v.dir/45):'-'); if(lo.dataset.k!==kk){ lo.dataset.k=kk; clearTimeout(lo._t); lo._t=setTimeout(function(){ window.PsaroWindLocal.render(lo,c.lat,c.lng,v); },700); } }
  var sd=document.getElementById('ndWindSt'); if(sd){ sd.replaceChildren(); var cp=compare();
    if(cp.length){ var b2=document.createElement('b'); b2.textContent=T('Μετρήσεις τώρα vs μοντέλο (σταθμοί στην περιοχή)','Observed now vs model (stations in view)'); sd.append(b2); cp.forEach(function(x){ var d=document.createElement('div'); d.textContent=(x.st.name||x.st.id||'').split(',')[0]+': '+W(x.st.spd)+' '+T('μετρήθηκε','observed')+' · '+W(x.mod)+' '+T('μοντέλο','model')+' ('+diffTxt(x.d)+')'; sd.append(d); }); }
    else if(stErr==='nofn') sd.textContent=T('Σταθμοί: δεν έχει ενεργοποιηθεί ακόμα η συνάρτηση «metar» στο Supabase.','Stations: the "metar" Supabase function is not set up yet.');
    else if(stErr) sd.textContent=T('Οι μετρήσεις σταθμών δεν φορτώθηκαν.','Station observations did not load.'); }
}
/* πλέγμα: g.lat[j], g.lon[i], g.m[k]={name,u[h],v[h]} (kn, προς τα πού πάει ο αέρας) · g.mean = μέσος όρος μοντέλων */
function bil(A,lat,lon){
  var g=grid, fy=(lat-g.lat[0])/(g.lat[N-1]-g.lat[0])*(N-1), fx=(lon-g.lon[0])/(g.lon[N-1]-g.lon[0])*(N-1);
  if(!(fx>=0&&fx<=N-1&&fy>=0&&fy<=N-1)) return null;
  var i=Math.min(N-2,Math.floor(fx)), j=Math.min(N-2,Math.floor(fy)), a=fx-i, bb=fy-j;
  return A[j*N+i]*(1-a)*(1-bb)+A[j*N+i+1]*a*(1-bb)+A[(j+1)*N+i]*(1-a)*bb+A[(j+1)*N+i+1]*a*bb;
}
function vec(u,v){ var sp=Math.sqrt(u*u+v*v); return isFinite(sp)?{u:u,v:v,sp:sp,dir:(Math.atan2(-u,-v)*180/Math.PI+360)%360}:null; }
function sampleSrc(src,h,lat,lon){ if(!grid) return null; var u=bil(src.u[h],lat,lon), v=bil(src.v[h],lat,lon); if(u==null||v==null) return null; return vec(u,v); }
/* v31z385 · Διόρθωση από σταθμούς: κοντά σε σταθμό που μετρά τώρα, ο άνεμος του μοντέλου μετακινείται προς τη μέτρηση.
   Η μέτρηση περιέχει ό,τι κάνουν τα βουνά γύρω από τον σταθμό (επιτάχυνση, σκιά), που το μοντέλο των 7–9 km δεν βλέπει.
   Βάρος: γκαουσιανό με απόσταση (σ = 8 km, έως 20 km) και με τον χρόνο (πλήρες τώρα, μηδέν σε ±3 ώρες). Μόνο μετρήσεις έως 90′. */
var OBS_S=8, OBS_MAX=20, OBS_H=3, obsCache=null;
function obsList(){
  if(!stations||!stations.length||!grid) return [];
  if(obsCache&&obsCache.st===stations&&obsCache.g===grid&&obsCache.n===nowIdx) return obsCache.l;
  var now=Date.now(), l=[];
  dedupe(stations.filter(function(x){ return now-Date.parse(x.t||0)<90*60000; })).forEach(function(st){
    var m=sampleSrc(grid.mean,nowIdx,st.lat,st.lon); if(!m) return;
    var ou,ov; if(st.dir!=null&&st.spd>=1){ var r=st.dir*Math.PI/180; ou=-st.spd*Math.sin(r); ov=-st.spd*Math.cos(r); } else { var k=m.sp>0.1?st.spd/m.sp:0; ou=m.u*k; ov=m.v*k; }
    l.push({lat:st.lat,lon:st.lon,du:ou-m.u,dv:ov-m.v,name:st.name||st.id||'',obs:st.spd,mod:m.sp});
  });
  obsCache={st:stations,g:grid,n:nowIdx,l:l}; return l;
}
function obsAdj(lat,lon,h){
  var l=obsList(); if(!l.length) return null; var dt=Math.abs((h==null?hi:h)-nowIdx); if(dt>=OBS_H) return null;
  var tw=1-dt/OBS_H, su=0, sv=0, sw=0, near=null, nd=1e9;
  l.forEach(function(o){ var dx=(o.lon-lon)*Math.cos(lat*Math.PI/180)*111.2, dy=(o.lat-lat)*111.2, d=Math.sqrt(dx*dx+dy*dy); if(d>OBS_MAX) return; var w=Math.exp(-(d*d)/(2*OBS_S*OBS_S)); su+=w*o.du; sv+=w*o.dv; sw+=w; if(d<nd){ nd=d; near=o; } });
  if(!sw) return null; var f=Math.min(1,sw)*tw/sw;
  return {du:su*f,dv:sv*f,w:Math.min(1,sw)*tw,near:near,dist:nd};
}
function sample(lat,lon,h){ if(!grid) return null; var src=SEL===0||!grid.m[SEL-1]?grid.mean:grid.m[SEL-1]; var v=sampleSrc(src,h==null?hi:h,lat,lon); if(!v) return null;
  var a=obsAdj(lat,lon,h); if(!a||a.w<0.02) return v; var r=vec(v.u+a.du,v.v+a.dv); if(!r) return v; r.obs=a; r.model=v; return r; }
function adiff(a,b){ var d=Math.abs(a-b)%360; return d>180?360-d:d; }
function agree(lat,lon){
  if(!grid||grid.m.length<2) return null;
  var vs=grid.m.map(function(m){ var v=sampleSrc(m,hi,lat,lon); return v&&{n:m.name,v:v}; }).filter(Boolean); if(vs.length<2) return null;
  var sp=vs.map(function(x){ return x.v.sp; }), dsp=Math.max.apply(null,sp)-Math.min.apply(null,sp), dd=0, mean=sp.reduce(function(a,b){return a+b;},0)/sp.length;
  if(mean>=4) for(var i=0;i<vs.length;i++) for(var j=i+1;j<vs.length;j++) dd=Math.max(dd,adiff(vs[i].v.dir,vs[j].v.dir));
  var lv=(dsp>=6||dd>=60)?2:(dsp>=3||dd>=30)?1:0;
  return {vs:vs,dsp:dsp,dd:dd,lv:lv};
}
async function fetchGrid(url){
  var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },20000);
  try{ var r=await fetch(url,{signal:ac.signal}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); } finally{ clearTimeout(tm); }
}
/* Μοντέλα: δοκιμάζει σετ από πιο λεπτομερή σε πιο απλά. Τα ονόματα προέρχονται από τα κλειδιά της απάντησης, όχι από το αίτημα. */
var SETS=[['ecmwf_ifs','icon_eu','icon_global','gfs_global'],['ecmwf_ifs025','icon_global','gfs_global'],[]];
var LABEL={ecmwf_ifs:'ECMWF 9 km',ecmwf_ifs025:'ECMWF 25 km',icon_eu:'ICON-EU 7 km',icon_global:'ICON 11 km',gfs_global:'GFS 25 km',dwd_icon_eu:'ICON-EU 7 km'};
/* Κοινή μνήμη στο Supabase (συνάρτηση wind-grid): το πλέγμα έρχεται από εκεί, όχι από το Open-Meteo απευθείας, ώστε να μη γεμίζει το όριο αιτημάτων. */
async function fetchPx(px,set){
  var u=(window.PSARO_WIND_URL||(SUPA+'/functions/v1/wind-grid'))+'?s='+px.s.toFixed(3)+'&n='+px.n.toFixed(3)+'&w='+px.w.toFixed(3)+'&e='+px.e.toFixed(3)+'&N='+N+'&models='+set.join(',');
  var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },30000);
  try{ var r=await fetch(u,{signal:ac.signal,headers:{apikey:SKEY,Authorization:'Bearer '+SKEY}}); if(!r.ok) throw new Error('HTTP '+r.status); var j=await r.json(); if(!j||!Array.isArray(j.data)||!Array.isArray(j.lat)||!Array.isArray(j.lon)||j.N!==N) throw new Error('badproxy'); return j; } finally{ clearTimeout(tm); }
}
async function modelFetch(base,px){
  var err=null;
  for(var i=0;i<SETS.length;i++){
    try{
      var arr; if(px){ var pj=await fetchPx(px,SETS[i]); arr=pj.data; px.meta=pj; } else { var url=SETS[i].length?base+'&models='+SETS[i].join(','):base; arr=await fetchGrid(url); }
      arr=Array.isArray(arr)?arr:[arr];
      var H=arr[0]&&arr[0].hourly; if(!H) throw new Error('nodata');
      var names=[]; Object.keys(H).forEach(function(k){ var m=k.match(/^wind_speed_10m_(.+)$/); if(m&&H['wind_direction_10m_'+m[1]]){ var ok=arr.every(function(p){ var a=p.hourly['wind_speed_10m_'+m[1]]; return a&&a.some(function(x){ return typeof x==='number'; }); }); if(ok) names.push({id:m[1],name:LABEL[m[1]]||m[1],sfx:'_'+m[1]}); } });
      if(!names.length){ if(H.wind_speed_10m) names=[{id:'auto',name:T('Μοντέλο','Model'),sfx:''}]; else throw new Error('nodata'); }
      return {arr:arr,names:names};
    }catch(e){ err=e; if(/429/.test(String(e&&e.message))) break; }
  }
  throw err||new Error('fail');
}
async function load(){
  var id=++loadId, b=map.getBounds().pad(0.05), s=b.getSouth(), n=b.getNorth(), w=b.getWest(), e=b.getEast();
  var lat=[], lon=[]; for(var k=0;k<N;k++){ lat.push(s+(n-s)*k/(N-1)); lon.push(w+(e-w)*k/(N-1)); }
  var la=[], lo=[]; for(var j=0;j<N;j++) for(var i=0;i<N;i++){ la.push(lat[j].toFixed(3)); lo.push(lon[i].toFixed(3)); }
  var base='https://api.open-meteo.com/v1/forecast?latitude='+la.join(',')+'&longitude='+lo.join(',')+'&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&past_hours=1&forecast_hours=48&timezone=UTC';
  var keepT=hours.length?hours[hi]:null, keepSc=panel?panel.scrollTop:0;
  if(!grid) drawPanel(T('Φόρτωση ανέμου…','Loading wind…'));
  try{
    var px={s:s,n:n,w:w,e:e,meta:null}, mf=null, viaPx=false;
    try{ mf=await modelFetch(base,px); viaPx=true; }catch(pe){ try{ console.warn('wind-grid',pe&&pe.message); }catch(e0){} if(/429/.test(String(pe&&pe.message))) throw pe; px=null; }
    if(id!==loadId||!on) return;
    if(!mf) mf=await modelFetch(base);
    if(id!==loadId||!on) return;
    if(viaPx&&px&&px.meta){ lat=px.meta.lat; lon=px.meta.lon; wxSrc=px.meta.cached?(px.meta.stale?'stale':'cache'):'live'; wxAt=px.meta.fetched_at; } else { wxSrc='direct'; wxAt=null; }
    var arr=mf.arr, names=mf.names; if(arr.length<N*N) throw new Error('short');
    var T0=arr[0].hourly.time, H=T0.length;
    var ms=names.map(function(nm){
      var U=[],V=[]; for(var h=0;h<H;h++){ var uu=new Float32Array(N*N), vv=new Float32Array(N*N);
        for(var q=0;q<N*N;q++){ var sp=arr[q].hourly['wind_speed_10m'+nm.sfx][h], d=arr[q].hourly['wind_direction_10m'+nm.sfx][h]*Math.PI/180; if(sp==null||d!=d){ sp=NaN; d=0; } uu[q]=-sp*Math.sin(d); vv[q]=-sp*Math.cos(d); }
        U.push(uu); V.push(vv); }
      return {name:nm.name,u:U,v:V};
    });
    /* μέσος όρος διανυσμάτων μόνο από τα μοντέλα που έχουν τιμή */
    var MU=[],MV=[]; for(var h2=0;h2<H;h2++){ var mu=new Float32Array(N*N), mv=new Float32Array(N*N);
      for(var q2=0;q2<N*N;q2++){ var su=0,sv=0,c=0; ms.forEach(function(m){ var x=m.u[h2][q2]; if(x===x){ su+=x; sv+=m.v[h2][q2]; c++; } }); mu[q2]=c?su/c:0; mv[q2]=c?sv/c:0; }
      MU.push(mu); MV.push(mv); }
    ms.forEach(function(m){ m.u.forEach(function(a){ for(var z=0;z<a.length;z++) if(a[z]!==a[z]) a[z]=0; }); m.v.forEach(function(a){ for(var z=0;z<a.length;z++) if(a[z]!==a[z]) a[z]=0; }); });
    grid={lat:lat,lon:lon,m:ms,mean:{name:T('Μέσος όρος','Average'),u:MU,v:MV}}; hours=T0;
    if(SEL>ms.length) SEL=0;
    var nowK=new Date().toISOString().slice(0,13); hi=0; for(var z2=0;z2<hours.length;z2++){ if(hours[z2].slice(0,13)<=nowK) hi=z2; } nowIdx=hi;
    if(keepT){ var ki=hours.indexOf(keepT); if(ki>=0) hi=ki; }
    drawPanel(); if(panel&&keepSc) panel.scrollTop=keepSc; seed(); if(!raf) loop(0); loadStations();
  }catch(err){ if(id===loadId&&on){
    if(N>7&&!(err&&err.message==='nodata')){ N=7; grid=null; loadId++; return load(); }
    var m=String(err&&err.message||''), lim=/429/.test(m), why=lim?T(' Το όριο της πηγής (Open-Meteo) εξαντλήθηκε, δοκίμασε ξανά σε λίγα λεπτά.',' The data source (Open-Meteo) rate limit was reached. Try again in a few minutes.'):(/abort/i.test(m)?T(' Η πηγή άργησε να απαντήσει.',' The source was too slow.'):(m?' ('+m+')':''));
    grid=null; drawPanel(T('Ο άνεμος δεν φορτώθηκε.','Wind did not load.')+why); clear(); } }
}
/* Μετρήσεις σταθμών (METAR αεροδρομίων): περνούν από συνάρτηση στο Supabase, γιατί η πηγή δεν επιτρέπει κλήση απευθείας από browser. */
var SUPA='https://sgfohmqwdwtkhtrebnix.supabase.co', SKEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
async function loadStations(){
  stErr=null;
  try{
    var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },10000);
    var r=await fetch((window.PSARO_OBS_URL||SUPA+'/functions/v1/smart-api'),{signal:ac.signal,headers:{apikey:SKEY,Authorization:'Bearer '+SKEY}}); clearTimeout(tm);
    if(r.status===404) throw new Error('nofn'); if(!r.ok) throw new Error('HTTP '+r.status);
    var j=await r.json(); stations=(Array.isArray(j)?j:(j.stations||[])).filter(function(x){ return x&&isFinite(x.lat)&&isFinite(x.lon)&&x.spd!=null; });
  }catch(e){ stations=null; stErr=(e&&e.message==='nofn')?'nofn':'err'; }
  drawStations(); label();
}
function drawStations(){
  if(stLayer){ map.removeLayer(stLayer); stLayer=null; }
  if(!stOn||!stations||!stations.length) return; stLayer=L.layerGroup().addTo(map);
  var b=map.getBounds(), c0=map.getCenter(), vis=stations.filter(function(x){ return b.contains([x.lat,x.lon])&&Date.now()-Date.parse(x.t||0)<3*3600000; });
  vis=dedupe(vis); vis.sort(function(p,q){ return dist2(p,c0)-dist2(q,c0); }); vis=vis.slice(0,30);
  vis.forEach(function(st){
    var rot=(st.dir==null?0:st.dir)%360, c=col(st.spd);
    var ic=L.divIcon({className:'',iconSize:[46,46],iconAnchor:[23,23],html:'<div style="width:46px;text-align:center;font:700 11px system-ui;color:#fff;text-shadow:0 1px 3px #000"><div style="width:26px;height:26px;margin:0 auto;border-radius:50%;background:'+c+';border:2px solid #fff;box-shadow:0 1px 5px #0008;display:flex;align-items:center;justify-content:center">'+((st.dir==null||!(st.spd>=1))?'<span style="font-size:16px;line-height:1">•</span>':'<svg viewBox="0 0 24 24" width="16" height="16" style="transform:rotate('+rot+'deg)"><path d="M12 3v16M6 13l6 6 6-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>')+'</div>'+W(st.spd)+'</div>'});
    var m=L.marker([st.lat,st.lon],{icon:ic,keyboard:false,interactive:true,title:(st.name||st.id)+' '+W(st.spd)}).addTo(stLayer);
    m.bindPopup('<b>'+(st.name||st.id||'')+'</b>'+(st.src?' <small>('+st.src+')</small>':'')+'<br>'+T('Μέτρηση','Observed')+': '+((st.dir!=null&&st.spd>=1)?dn(st.dir)+' '+W(st.spd):(st.spd>=1?W(st.spd)+' · '+T('μεταβλητή κατεύθυνση','variable direction'):T('άπνοια (0 κόμβοι) ή δεν δίνεται κατεύθυνση','calm (0 kn) or no direction reported')))+(st.gust?' · '+T('ριπές ','gusts ')+W(st.gust):'')+(st.pres!=null&&pu()&&pu().press?'<br>'+T('Πίεση','Pressure')+': '+pu().press(st.pres):'')+(st.t?'<br>'+String(st.t).slice(11,16)+'Z':''));
  });
}
function dedupe(list){ /* ίδιος τόπος από δύο πηγές (π.χ. METAR και DoM στο αεροδρόμιο): κρατά την πιο πρόσφατη παρατήρηση */
  var out=[]; list.slice().sort(function(a,b){ return (Date.parse(b.t||0)||0)-(Date.parse(a.t||0)||0); }).forEach(function(st){
    var dup=out.some(function(o){ var dx=(o.lon-st.lon)*Math.cos(st.lat*Math.PI/180)*111.2, dy=(o.lat-st.lat)*111.2; return dx*dx+dy*dy<1; });
    if(!dup) out.push(st); });
  return out; }
function dist2(p,c){ var dx=(p.lon-(c.lng!=null?c.lng:c.lon))*Math.cos(c.lat*Math.PI/180), dy=p.lat-c.lat; return dx*dx+dy*dy; }
function compare(){
  if(!stations||!stations.length||!grid) return [];
  var b=map.getBounds(), c=map.getCenter();
  return dedupe(stations.filter(function(x){ return b.contains([x.lat,x.lon])&&Date.now()-Date.parse(x.t||0)<3*3600000; })).sort(function(p,q){ return dist2(p,c)-dist2(q,c); }).slice(0,8)
    .map(function(st){ var v=sampleSrc(grid.mean,nowIdx,st.lat,st.lon); return v?{st:st,mod:v.sp,d:st.spd-v.sp}:null; }).filter(Boolean);
}
function seed(){
  var s=map.getSize(), cnt=Math.min(1600,Math.round(s.x*s.y/520)); parts=[];
  for(var i=0;i<cnt;i++) parts.push(np());
  clear();
}
function np(){ var s=map.getSize(); return {x:Math.random()*s.x,y:Math.random()*s.y,age:Math.floor(Math.random()*40)}; }
var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop(ts){
  raf=0; if(!on||!grid||!shown||document.hidden){ if(on&&grid&&shown) raf=requestAnimationFrame(loop); return; }
  raf=requestAnimationFrame(loop); if(ts-last<33) return; last=ts;
  var s=map.getSize(); ctx.globalCompositeOperation='destination-out'; ctx.fillStyle='rgba(0,0,0,'+(RM?1:0.08)+')'; ctx.fillRect(0,0,s.x,s.y); ctx.globalCompositeOperation='source-over'; ctx.lineWidth=1.6; ctx.lineCap='round';
  var sc=0.12*Math.pow(2,(map.getZoom()-8)*0.35);
  for(var i=0;i<parts.length;i++){
    var p=parts[i], ll=map.containerPointToLatLng([p.x,p.y]), v=sample(ll.lat,ll.lng);
    if(!v||p.age--<=0){ parts[i]=np(); parts[i].age=40+Math.floor(Math.random()*30); continue; }
    var nx=p.x+v.u*sc, ny=p.y-v.v*sc;
    var sea=seaOn(); ctx.strokeStyle=sea?'#ffffff':col(v.sp); ctx.globalAlpha=sea?0.7:0.9; ctx.lineWidth=sea?1.3:1.6; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(nx,ny); ctx.stroke();
    p.x=nx; p.y=ny; if(nx<0||ny<0||nx>s.x||ny>s.y){ parts[i]=np(); parts[i].age=40+Math.floor(Math.random()*30); }
  }
  ctx.globalAlpha=1;
}
function moved(){ if(!on) return; clear(); clearTimeout(mvT); mvT=setTimeout(function(){ if(!on) return; var b=map.getBounds(); if(!grid||!(b.getSouth()>=grid.lat[0]-0.001&&b.getNorth()<=grid.lat[N-1]+0.001&&b.getWest()>=grid.lon[0]-0.001&&b.getEast()<=grid.lon[N-1]+0.001)||map.getBounds().getNorth()-map.getBounds().getSouth()<(grid.lat[N-1]-grid.lat[0])/3) load(); else{ seed(); label(); } },600); }
function onUnits(){ if(!on) return; drawPanel(); drawStations(); label(); }
function start(opt){ if(on) return; on=true; shown=!(opt&&opt.hidden); document.body.classList.add('ndwind'); ensure(); cv.style.display=shown?'block':'none'; btn.setAttribute('aria-pressed',String(shown)); btn.classList.toggle('on',shown); fit(); map.on('moveend zoomend resize',moved); map.getContainer().addEventListener('click',onTap,true); window.addEventListener('psaro-units',onUnits); window.addEventListener('resize',fit); load(); }
function stop(){ pause(); on=false; try{ window.dispatchEvent(new Event('psaro-windstop')); }catch(e){} document.body.classList.remove('ndwind'); document.documentElement.style.removeProperty('--ndwh'); loadId++; btn.setAttribute('aria-pressed','false'); btn.classList.remove('on'); map.off('moveend zoomend resize',moved); try{ map.getContainer().removeEventListener('click',onTap,true); }catch(e){} window.removeEventListener('psaro-units',onUnits); clearTap(); if(raf){ cancelAnimationFrame(raf); raf=0; } if(cv) cv.style.display='none'; if(panel){ panel.remove(); panel=null; } shown=false; clear(); parts=[]; var D=document.getElementById('ndMapDock'); if(D&&D._sync) D._sync(); }
/* Κουμπί «Άνεμος στον χάρτη»: ανοίγει/κλείνει τα βελάκια. Αν είναι ανοιχτή η κατάσταση θάλασσας, ο άνεμος συνεχίζει να υπολογίζεται για αυτήν. */
function seaOn(){ return document.body.classList.contains('ndsea'); }
function show(v){ if(!on) return; shown=!!v; if(cv){ cv.style.display=shown?'block':'none'; if(!shown) clear(); } btn.setAttribute('aria-pressed',String(shown)); btn.classList.toggle('on',shown); if(!shown) clearTap(); if(shown){ seed(); if(!raf) loop(0); } drawPanel(); }
btn.addEventListener('click',function(){ if(!on) start(); else if(!shown) show(true); else if(seaOn()) show(false); else stop(); });
/* Σταθμοί με μετρήσεις ανέμου (ανεμούρια): δικό τους κουμπί, ανεξάρτητα από τα βελάκια */
var stBtn=document.createElement('button'); stBtn.type='button'; stBtn.id='bWindSt'; stBtn.className='mbtn';
stBtn.setAttribute('aria-label',T('Σταθμοί ανέμου (μετρήσεις τώρα)','Wind stations (live)')); stBtn.title=stBtn.getAttribute('aria-label');
stBtn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-3 3.5 3 3.5H6"/><path d="M3 21h6"/></svg>';
mb.appendChild(stBtn);
var stTm=null;
function stSet(v){ stOn=!!v; try{ localStorage.setItem('psaro-wst',stOn?'1':'0'); }catch(e){} stBtn.setAttribute('aria-pressed',String(stOn)); stBtn.classList.toggle('on',stOn); clearInterval(stTm); stTm=null;
  if(stOn){ loadStations(); stTm=setInterval(function(){ if(!document.hidden) loadStations(); },10*60000); } else drawStations(); }
stBtn.addEventListener('click',function(){ stSet(!stOn); if(stOn) try{ C.toast(T('Σταθμοί ανέμου: μετρήσεις των τελευταίων 3 ωρών','Wind stations: observations from the last 3 hours')); }catch(e){} });
map.on('moveend',function(){ if(stOn) drawStations(); });
setTimeout(function(){ var v=null; try{ v=localStorage.getItem('psaro-wst'); }catch(e){} stSet(v==='1'); },1500);
function sampleAll(lat,lon){ if(!grid) return []; var o=[]; grid.m.forEach(function(m){ var v=sampleSrc(m,hi,lat,lon); if(v) o.push({name:m.name,v:v}); }); return o; }
window.PsaroWindMap={start:start,stop:stop,show:show,shown:function(){ return on&&shown; },on:function(){ return on; },sample:sample,sampleAll:sampleAll,obs:function(lat,lon){ return obsAdj(lat,lon,hi); },clearTap:function(){ clearTap(true); },col:col,hour:function(){ return hours[hi]||null; },modelFetch:modelFetch,diffTxt:diffTxt};
})();
