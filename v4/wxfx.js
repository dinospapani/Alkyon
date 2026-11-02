/* BiteCast 4 · καιρός στον χάρτη σαν το Windy (v31z520)
   - Άνεμος: χρωματιστό πεδίο έντασης σε όλη την οθόνη, κάτω από τα λευκά σωματίδια (windmap.js).
   - Κύμα: πεδίο ύψους κύματος από τα μοντέλα για όλη τη θάλασσα (και πέρα από τα 10 km της «Κατάστασης θάλασσας»),
     με κινούμενες λευκές «κορυφές» στην κατεύθυνση που ταξιδεύει το κύμα.
   - Μπάρα ώρας: οι μέρες κάτω από το slider. */
(function(){
var B=window.BC, T=B.T, EN=B.EN;
window.PSARO_WINDY=true;
/* κύμα: κλίμακα σαν το Windy, ανοιχτό γαλάζιο στην ήρεμη θάλασσα, σκουραίνει προς μπλε, μωβ και κόκκινο όσο δυναμώνει */
/* v31z526: πιο έντονη διαφορά στα 0–1,5 m (τα συνηθισμένα στη Μεσόγειο): πολύ ανοιχτό στο ήρεμο, καθαρά πιο σκούρο από το 1 m */
var WVC=[[0,[206,238,242]],[0.25,[160,216,232]],[0.5,[112,186,222]],[0.75,[78,154,208]],[1,[58,122,194]],[1.5,[50,90,172]],[2,[56,64,152]],[3,[96,58,140]],[4.5,[150,64,110]],[6,[176,72,96]],[9,[201,143,143]]];
function wvcol(h){ if(!(h>0)) return WVC[0][1].slice(); for(var i=1;i<WVC.length;i++){ if(h<=WVC[i][0]){ var a=WVC[i-1], b=WVC[i], t=(h-a[0])/(b[0]-a[0]); return [a[1][0]+(b[1][0]-a[1][0])*t,a[1][1]+(b[1][1]-a[1][1])*t,a[1][2]+(b[1][2]-a[1][2])*t]; } } return WVC[WVC.length-1][1].slice(); }
window.PSARO_WAVEGRAD=wvcol; B.waveColor=wvcol;
var map=null, fillCv=null, dashCv=null, dctx=null, parts=[], raf=0, last=0, rt=0, waitT=0, sig='';
var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function W(){ return window.PsaroWindMap; }
function S(){ return window.PsaroSeaState; }
function windOn(){ var w=W(); return !!(w&&w.shown&&w.shown()); }
function seaOn(){ return document.body.classList.contains('ndsea'); }
function mapOn(){ return document.body.classList.contains('mapon'); }
function land(lat,lon){ var X=window.PsaroExposure; try{ return X&&X.isLand?X.isLand(lat,lon):-1; }catch(e){ return -1; } }
/* χρώματα ανέμου (κόμβοι), κοντά στην κλίμακα του Windy */
var WC=[[0,[98,113,183]],[3,[57,97,159]],[6,[74,148,169]],[10,[77,141,123]],[14,[83,165,83]],[18,[53,159,53]],[22,[167,157,81]],[27,[159,127,58]],[33,[161,108,92]],[40,[129,58,78]],[48,[175,80,136]],[56,[117,74,147]]];
function wcol(kn){ if(!(kn>0)) return WC[0][1]; for(var i=1;i<WC.length;i++){ if(kn<=WC[i][0]){ var a=WC[i-1], b=WC[i], t=(kn-a[0])/(b[0]-a[0]); return [a[1][0]+(b[1][0]-a[1][0])*t,a[1][1]+(b[1][1]-a[1][1])*t,a[1][2]+(b[1][2]-a[1][2])*t]; } } return WC[WC.length-1][1]; }
B.windColor=wcol;
function pane(n,z){ var p=map.getPane(n)||map.createPane(n); p.style.zIndex=String(z); p.style.pointerEvents='none'; return p; }
function pin(c){ try{ L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0])); }catch(e){} }
function ensure(){
  var m=window.PsaroCore&&window.PsaroCore.map&&window.PsaroCore.map(); if(!m) return false;
  if(m!==map){ map=m; fillCv=null; dashCv=null;
    map.on('movestart zoomstart',function(){ if(fillCv) fillCv.style.opacity='0'; parts=[]; if(dctx){ var s=map.getSize(); dctx.clearRect(0,0,s.x,s.y); } });
    map.on('move',function(){ if(fillCv) pin(fillCv); if(dashCv) pin(dashCv); roLater(); });
    map.on('moveend zoomend resize',function(){ later(250); if(sstOn) setTimeout(function(){ sstLoad(false); },260); });
    map.on('movestart zoomstart',function(){ if(sstCv) sstCv.style.opacity='0'; });
    map.on('move',function(){ if(sstCv) pin(sstCv); }); }
  if(!fillCv){ fillCv=document.createElement('canvas'); fillCv.className='wxfill'; fillCv.setAttribute('aria-hidden','true'); fillCv.style.cssText='position:absolute;left:0;top:0;pointer-events:none;transition:opacity .35s'; pane('wxFillPane',336).appendChild(fillCv); }
  if(!dashCv){ dashCv=document.createElement('canvas'); dashCv.className='wxdash'; dashCv.setAttribute('aria-hidden','true'); dashCv.style.cssText='position:absolute;left:0;top:0;pointer-events:none'; pane('wxDashPane',350).appendChild(dashCv); dctx=dashCv.getContext('2d'); }
  return true;
}
function later(ms){ clearTimeout(rt); rt=setTimeout(render,ms||120); }
function render(){
  if(!ensure()) return; var sz=map.getSize(), dpr=Math.min(window.devicePixelRatio||1,2);
  var mode=!mapOn()?'':seaOn()?'sea':windOn()?'wind':'';
  [fillCv,dashCv].forEach(function(c){ c.width=Math.round(sz.x*dpr); c.height=Math.round(sz.y*dpr); c.style.width=sz.x+'px'; c.style.height=sz.y+'px'; pin(c); });
  dctx.setTransform(dpr,0,0,dpr,0,0);
  var fx=fillCv.getContext('2d'); fx.setTransform(1,0,0,1,0,0); fx.clearRect(0,0,fillCv.width,fillCv.height);
  parts=[]; stopAnim();
  var legs=[]; if(mode==='sea') legs.push('sea'); if(windOn()&&mode!=='sea') legs.push('wind'); wxLegend(mode?legs:[]);
  setTimeout(drawLabels,mode==='sea'?600:200);
  if(!mode){ fillCv.style.opacity='0'; return; }
  var st=6, bw=Math.ceil(sz.x/st)+1, bh=Math.ceil(sz.y/st)+1, pc=document.createElement('canvas'); pc.width=bw; pc.height=bh;
  var px=pc.getContext('2d'), im=px.createImageData(bw,bh), d=im.data, any=false, lat=[], lon=[];
  for(var y=0;y<bh;y++) lat.push(map.containerPointToLatLng([0,y*st]).lat);
  for(var x=0;x<bw;x++) lon.push(map.containerPointToLatLng([x*st,0]).lng);
  var Sx=S(), Wx=W(), G=Sx&&Sx.grad;
  if(mode==='sea'&&!(Sx&&Sx.ready&&Sx.ready())){ fillCv.style.opacity='0'; clearTimeout(waitT); waitT=setTimeout(render,1500); return; }
  for(var yy=0;yy<bh;yy++) for(var xx=0;xx<bw;xx++){
    var la=lat[yy], lo=lon[xx], c=null, a=0, o=(yy*bw+xx)*4;
    if(mode==='sea'){ if(land(la,lo)===1) continue; var m=Sx.modelAt(la,lo); if(!m) continue; c=wvcol(m.h); a=0.82; }
    else { var v=Wx.sample(la,lo); if(!v) continue; c=wcol(v.sp); a=0.62; }
    d[o]=c[0]; d[o+1]=c[1]; d[o+2]=c[2]; d[o+3]=Math.round(255*a); any=true;
  }
  px.putImageData(im,0,0);
  fx.imageSmoothingEnabled=true; try{ fx.imageSmoothingQuality='high'; }catch(e){}
  fx.drawImage(pc,0,0,bw,bh,0,0,bw*st*dpr,bh*st*dpr);
  fillCv.style.opacity=any?'1':'0';
  if(mode==='sea'&&any) startAnim();
}

/* κλίμακα σαν το Windy: τι σημαίνει κάθε χρώμα, στις μονάδες σου */
var wlEl=null;
function legRow(mode){
  var U=window.PsaroUnits, stops=[], ticks=[], ttl='';
  if(mode==='wind'){ ttl=T('Άνεμος','Wind'); var mx=44; for(var k=0;k<=mx;k+=2){ var c=wcol(k); stops.push('rgb('+c.map(Math.round).join(',')+') '+(100*k/mx).toFixed(1)+'%'); }
    var un='kn'; [0,7,11,17,22,28,34,41].forEach(function(kn){ var wp=U&&U.windP?U.windP(kn):[String(kn),'kn']; un=wp[1]; ticks.push([100*kn/mx,wp[0]]); }); ttl+=' ('+un+')'; }
  else { ttl=T('Κύμα (m)','Waves (m)'); var mxw=4; for(var h2=0;h2<=mxw;h2+=0.125){ var g=wvcol(h2); stops.push('rgb('+g.map(Math.round).join(',')+') '+(100*h2/mxw).toFixed(1)+'%'); }
    [[0,'0'],[0.5,'0.5'],[1,'1'],[1.5,'1.5'],[2,'2'],[3,'3']].forEach(function(t){ ticks.push([100*t[0]/mxw,EN?t[1]:t[1].replace('.',',')]); }); }
  var row=document.createElement('div'); row.className='wlr'; var tt=document.createElement('b'); tt.textContent=ttl; var bar=document.createElement('div'); bar.className='wlbar'; bar.style.background='linear-gradient(90deg,'+stops.join(',')+')';
  var tk=document.createElement('div'); tk.className='wltk'; ticks.forEach(function(t){ var sp=document.createElement('span'); sp.style.left=t[0]+'%'; sp.textContent=t[1]; tk.append(sp); });
  var wrap=document.createElement('div'); wrap.className='wlw'; wrap.append(bar,tk); row.append(tt,wrap); return row; }
/* κλίμακα: μία γραμμή για το χρώμα που βλέπεις (κύμα ή άνεμος)· όταν είναι ανοιχτά και τα δύο, ο άνεμος διαβάζεται από τις ετικέτες */
function wxLegend(list){
  var D=window.PsaroMapDock&&window.PsaroMapDock(); if(!D) return;
  if(!list||!list.length){ if(wlEl){ wlEl.remove(); wlEl=null; if(D._sync) D._sync(); } return; }
  if(!wlEl||!wlEl.isConnected){ wlEl=document.createElement('div'); wlEl.id='wxLeg'; wlEl.setAttribute('role','note'); }
  var wp=document.getElementById('ndWindPanel'); if(wp&&wp.parentNode===D) D.insertBefore(wlEl,wp); else D.appendChild(wlEl);
  wlEl.replaceChildren(); list.forEach(function(m){ wlEl.append(legRow(m)); }); if(D._sync) D._sync(); }
/* τιμές πάνω στον χάρτη (σαν τους αριθμούς του Windy): βελάκι + ένταση ανέμου και ύψος κύματος, σε πλέγμα */
var labCv=null;
function arrowPath(c,x,y,deg,r){ var a=deg*Math.PI/180, dx=Math.sin(a), dy=-Math.cos(a); c.beginPath(); c.moveTo(x-dx*r,y-dy*r); c.lineTo(x+dx*r,y+dy*r); c.moveTo(x+dx*r,y+dy*r); c.lineTo(x+dx*r-(dx*0.55-dy*0.45)*r,y+dy*r-(dy*0.55+dx*0.45)*r); c.moveTo(x+dx*r,y+dy*r); c.lineTo(x+dx*r-(dx*0.55+dy*0.45)*r,y+dy*r-(dy*0.55-dx*0.45)*r); c.stroke(); }
function rr(c,x,y,w,h2,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h2,r); c.arcTo(x+w,y+h2,x,y+h2,r); c.arcTo(x,y+h2,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
/* σαν το Windy: σταυρός στο κέντρο και μπάρα με ό,τι υπάρχει κάτω από αυτόν (αλλάζει καθώς κουνάς τον χάρτη) */
var roEl=null, crEl=null, roRaf=0;
function arrowSvg(deg,col,sz){ return '<svg viewBox="0 0 24 24" width="'+sz+'" height="'+sz+'" style="transform:rotate('+Math.round(deg)+'deg)"><path d="M12 20V4M6 10l6-6 6 6" stroke="'+col+'" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function COMPn(d){ var C=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ']; return C[Math.round((((d%360)+360)%360)/45)%8]; }
function readout(){
  var wOn=windOn(), sOn=seaOn(), show=mapOn()&&(wOn||sOn)&&!!map;
  document.body.classList.toggle('wxro',show);
  if(!show){ if(roEl) roEl.hidden=true; if(crEl) crEl.hidden=true; return; }
  if(!roEl){ roEl=document.createElement('div'); roEl.className='wxread'; roEl.setAttribute('aria-live','polite'); document.body.append(roEl); }
  var mc=map.getContainer(); mc=mc.parentNode&&mc.parentNode.classList.contains('mapbox')?mc.parentNode:mc; /* στο πλαίσιο, όχι στον χάρτη που γυρίζει σε CU/HU */ if(!crEl||crEl.parentNode!==mc){ crEl=document.createElement('div'); crEl.className='wxcross'; crEl.setAttribute('aria-hidden','true'); mc.append(crEl); }
  roEl.hidden=false; crEl.hidden=false;
  var c=map.getCenter(), U=window.PsaroUnits, Wx=W(), Sx=S(), parts2=[];
  if(wOn){ var v=Wx&&Wx.sample?Wx.sample(c.lat,c.lng):null; if(v){ var wp=U&&U.windP?U.windP(v.sp):[String(Math.round(v.sp)),'kn'], col='rgb('+wcol(v.sp).map(Math.round).join(',')+')';
    parts2.push('<span class="rgi"><small>'+T('Άνεμος','Wind')+'</small><span class="rv">'+arrowSvg((v.dir+180)%360,'#fff',18)+'<b>'+wp[0]+' '+wp[1]+'</b>'+(wp[1]!=='kn'?'<em>'+Math.round(v.sp)+' kn</em>':'')+'<em>'+COMPn(v.dir)+'</em><i style="background:'+col+'"></i></span></span>'); } }
  if(sOn){ var hh=null, dd=null, tp=null, r=null; try{ r=Sx&&Sx.pointInfo?Sx.pointInfo(c.lat,c.lng):null; }catch(e){} if(r&&r.hs>=0){ hh=r.hs; dd=r.wdir; tp=r.period; } else { var m=Sx&&Sx.modelAt?Sx.modelAt(c.lat,c.lng):null; if(m){ hh=m.h; dd=m.dir; tp=m.tp; } }
    if(hh!=null){ var gc='rgb('+wvcol(hh).map(Math.round).join(',')+')';
      parts2.push('<span class="rgi"><small>'+T('Κύμα','Waves')+'</small><span class="rv">'+(dd!=null?arrowSvg((dd+180)%360,'#9fdcff',18):'')+'<b>'+(U&&U.wave?U.wave(hh):B.num(hh,1)+' m')+'</b>'+(dd!=null?'<em>'+COMPn(dd)+'</em>':'')+(tp>0?'<em>'+Math.round(tp)+' s</em>':'')+'<i style="background:'+gc+'"></i></span></span>'); }
    else if(land(c.lat,c.lng)===1) parts2.push('<span class="rgi"><small>'+T('Κύμα','Waves')+'</small><span class="rv"><em>'+T('στεριά','land')+'</em></span></span>'); }
  var sv=B.sstAt?B.sstAt(c.lat,c.lng):null; if(sv!=null) parts2.push('<span class="rgi"><small>'+T('Νερό','Water')+'</small><span class="rv"><b>'+(U&&U.temp?U.temp(sv,1):B.num(sv,1)+'°')+'</b></span></span>');
  roEl.innerHTML=parts2.join('<span class="rsep"></span>')||'<span class="rgi"><em>'+T('Φόρτωση…','Loading…')+'</em></span>';
  var nb=document.createElement('button'); nb.type='button'; nb.className='rnum'; nb.setAttribute('aria-pressed',String(numsOn)); nb.setAttribute('aria-label',T('Αριθμοί πάνω στον χάρτη','Numbers on the map')); nb.textContent='123';
  nb.addEventListener('click',function(){ numsOn=!numsOn; B.ls.set('psaro-v4-wxnums',numsOn); drawLabels(); }); roEl.append(nb);
}
function roLater(){ if(roRaf) return; roRaf=requestAnimationFrame(function(){ roRaf=0; try{ readout(); }catch(e){} }); }
var numsOn=B.ls.get('psaro-v4-wxnums',false)===true;
function drawLabels(){
  if(!ensure()) return;
  if(!numsOn){ if(labCv){ var c0=labCv.getContext('2d'); c0.setTransform(1,0,0,1,0,0); c0.clearRect(0,0,labCv.width,labCv.height); labCv.style.opacity='0'; } readout(); return; } if(!labCv){ labCv=document.createElement('canvas'); labCv.className='wxlab'; labCv.setAttribute('aria-hidden','true'); labCv.style.cssText='position:absolute;left:0;top:0;pointer-events:none'; pane('wxLabPane',370).appendChild(labCv); map.on('movestart zoomstart',function(){ if(labCv) labCv.style.opacity='0'; }); map.on('move',function(){ if(labCv) pin(labCv); }); }
  var sz=map.getSize(), dpr=Math.min(window.devicePixelRatio||1,2); labCv.width=Math.round(sz.x*dpr); labCv.height=Math.round(sz.y*dpr); labCv.style.width=sz.x+'px'; labCv.style.height=sz.y+'px'; pin(labCv);
  var c=labCv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,sz.x,sz.y);
  var wOn=windOn(), sOn=seaOn(); if(!mapOn()||(!wOn&&!sOn)){ labCv.style.opacity='0'; return; }
  var Wx=W(), Sx=S(), U=window.PsaroUnits, dock=document.getElementById('ndMapDock'), bot=sz.y-(dock&&!dock.hidden?dock.getBoundingClientRect().height+40:40)-60, top=125;
  var gx=sz.x<500?118:140, gy=104, row=0; c.font='800 12.5px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'; c.textBaseline='middle'; c.lineCap='round'; c.lineJoin='round';
  /* v31z526: οι αριθμοί δεν μπαίνουν πάνω στα βελάκια των ρευμάτων */
  var mc0=map.getContainer(), mr=mc0.getBoundingClientRect(), avoid=[].map.call(document.querySelectorAll('.mk.cur .cw'),function(e){ var r=e.getBoundingClientRect(); return [r.left-mr.left,r.top-mr.top,r.right-mr.left,r.bottom-mr.top]; });
  for(var y=top;y<=bot;y+=gy,row++) for(var x=(row%2?gx*0.75:gx*0.25);x<sz.x-20;x+=gx){
    if(avoid.some(function(a){ return x+48>a[0]-6&&x-48<a[2]+6&&y+22>a[1]-6&&y-22<a[3]+6; })) continue;
    if([[-46,-20],[46,-20],[-46,20],[46,20],[0,0]].some(function(d){ var el=document.elementFromPoint(mr.left+x+d[0],mr.top+y+d[1]); return el&&(!mc0.contains(el)||!!el.closest('.leaflet-control,.wxread,.mapwx,button')); })) continue;
    var ll=map.containerPointToLatLng([x,y]), isL=land(ll.lat,ll.lng)===1, lines=[];
    if(wOn&&!(sOn&&isL)){ var v=Wx&&Wx.sample?Wx.sample(ll.lat,ll.lng):null; if(v){ var wp=U&&U.windP?U.windP(v.sp):[String(Math.round(v.sp)),'kn']; lines.push({deg:(v.dir+180)%360,txt:wp[0]+' '+wp[1],col:wcol(v.sp),r:4+Math.min(5,v.sp/5)}); } }
    if(sOn&&!isL){ var r=null; try{ r=Sx&&Sx.pointInfo?Sx.pointInfo(ll.lat,ll.lng):null; }catch(e){} var hh=r&&r.hs>=0?r.hs:null, dd=r?r.wdir:null; if(hh==null){ var m=Sx&&Sx.modelAt?Sx.modelAt(ll.lat,ll.lng):null; if(m){ hh=m.h; dd=m.dir; } }
      if(hh!=null){ var g=Sx.grad?Sx.grad(hh):[52,168,120]; lines.push({deg:dd!=null?(dd+180)%360:null,txt:(U&&U.wave?U.wave(hh):B.num(hh,1)+' m'),col:g,wave:1,r:4+Math.min(5,hh*3.5)}); } }
    if(!lines.length) continue;
    var w=0; lines.forEach(function(l){ w=Math.max(w,c.measureText(l.txt).width); }); var bw=w+34, bh=lines.length*19+8, bx=x-bw/2, by=y-bh/2;
    c.fillStyle='rgba(12,22,32,.78)'; rr(c,bx,by,bw,bh,9); c.fill();
    lines.forEach(function(l,i){ var cy=by+4+i*19+9.5, col='rgb('+l.col.map(Math.round).join(',')+')';
      c.strokeStyle=l.wave?'#7fd3ff':'#fff'; c.lineWidth=1.4+(l.r-4)*0.25; if(l.deg!=null) arrowPath(c,bx+12,cy,l.deg,l.r); else { c.fillStyle='#7fd3ff'; c.fillRect(bx+7,cy-1,10,2); }
      c.fillStyle='#fff'; c.textAlign='left'; c.fillText(l.txt,bx+23,cy+0.5);
      c.fillStyle=col; c.fillRect(bx+bw-5,cy-6,3,12); });
  }
  labCv.style.opacity='1'; readout();
}
/* κορυφές κύματος: κοντές λευκές γραμμές κάθετες στη διεύθυνση που ταξιδεύει το κύμα */
function np(sz){ return {x:Math.random()*sz.x,y:Math.random()*sz.y,age:0,life:50+Math.floor(Math.random()*70)}; }
function startAnim(){ if(!dashCv) return; var sz=map.getSize(), n=Math.min(1100,Math.round(sz.x*sz.y/420)); parts=[]; for(var i=0;i<n;i++){ var p=np(sz); p.age=Math.floor(Math.random()*p.life); parts.push(p); } if(!raf) raf=requestAnimationFrame(loop); }
function stopAnim(){ if(raf){ cancelAnimationFrame(raf); raf=0; } }
function loop(ts){
  raf=0; if(!parts.length||!seaOn()||!mapOn()) return; raf=requestAnimationFrame(loop);
  if(document.hidden||ts-last<40) return; last=ts;
  var sz=map.getSize(), Sx=S(); dctx.clearRect(0,0,sz.x,sz.y); dctx.lineCap='round'; dctx.strokeStyle='#ffffff'; dctx.lineWidth=1.6;
  for(var i=0;i<parts.length;i++){ var p=parts[i];
    if(p.m===undefined||p.age%25===0){ var ll=map.containerPointToLatLng([p.x,p.y]); p.m=land(ll.lat,ll.lng)===1?null:Sx.modelAt(ll.lat,ll.lng); }
    var m=p.m; if(!m||m.dir==null||p.age++>p.life){ parts[i]=np(sz); continue; }
    if(p.vis==null) p.vis=Math.random(); if(p.vis>Math.min(1,0.1+m.h/1.3)){ continue; }
    var go=(m.dir+180)*Math.PI/180, sp=RM?0:(0.18+Math.min(10,m.tp||4)*0.045), dx=Math.sin(go), dy=-Math.cos(go);
    p.x+=dx*sp; p.y+=dy*sp; if(p.x<0||p.y<0||p.x>sz.x||p.y>sz.y){ parts[i]=np(sz); continue; }
    var f=p.age/p.life, al=Math.sin(Math.PI*f)*Math.min(0.9,0.3+m.h*0.45), len=2.5+Math.min(9,m.h*6); dctx.lineWidth=1+Math.min(1.8,m.h*1.2);
    dctx.globalAlpha=al; dctx.beginPath(); dctx.moveTo(p.x-dy*len,p.y+dx*len); dctx.lineTo(p.x+dy*len,p.y-dx*len); dctx.stroke();
  }
  dctx.globalAlpha=1;
}

/* ---------- θερμοκρασία νερού και θερμικά μέτωπα (Open-Meteo Marine, ~5–8 km· ενδεικτικό) ----------
   Χρώμα ανά θερμοκρασία (κλίμακα της περιοχής που βλέπεις, ώστε να φαίνονται οι διαφορές), ισόθερμες ανά 0,5 °C
   και με έντονο κίτρινο τα «μέτωπα»: όπου η θερμοκρασία αλλάζει απότομα. Εκεί συχνά μαζεύονται τα πελαγικά (μαγιάτικα, τόνοι). */
var SK='psaro-v4-sst', sstOn=!!B.ls.get(SK,false), sstCv=null, sstG=null, sstKey='', sstBusy=false, sstHr=null;
function sstPane(){ return pane('wxSstPane',337); }
var SC=[[0,[43,76,155]],[0.2,[46,132,196]],[0.4,[64,182,180]],[0.55,[120,196,110]],[0.7,[226,214,88]],[0.85,[238,140,62]],[1,[205,58,62]]];
function scol(f){ f=Math.max(0,Math.min(1,f)); for(var i=1;i<SC.length;i++){ if(f<=SC[i][0]){ var a=SC[i-1], b=SC[i], t=(f-a[0])/(b[0]-a[0]); return [a[1][0]+(b[1][0]-a[1][0])*t,a[1][1]+(b[1][1]-a[1][1])*t,a[1][2]+(b[1][2]-a[1][2])*t]; } } return SC[SC.length-1][1]; }
function sstHour(){ var Wx=W(), t=(windOn()&&Wx&&Wx.hour)?Wx.hour():null; if(t) return t.slice(0,13); var d=new Date(); return d.toISOString().slice(0,13); }
function sstLoad(force){
  if(!sstOn||!ensure()||sstBusy) return; var b=map.getBounds(), padY=(b.getNorth()-b.getSouth())*0.15, padX=(b.getEast()-b.getWest())*0.15;
  var s=b.getSouth()-padY, n=b.getNorth()+padY, w=b.getWest()-padX, e=b.getEast()+padX, key=[s,n,w,e].map(function(x){ return x.toFixed(2); }).join(',');
  if(sstG&&!force&&sstG.s<=b.getSouth()&&sstG.n>=b.getNorth()&&sstG.w<=b.getWest()&&sstG.e>=b.getEast()&&Date.now()-sstG.at<3*3600000){ sstDraw(); return; }
  var NY=9, NX=8, la=[], lo=[]; for(var j=0;j<NY;j++) for(var i=0;i<NX;i++){ la.push((s+(n-s)*j/(NY-1)).toFixed(3)); lo.push((w+(e-w)*i/(NX-1)).toFixed(3)); }
  sstBusy=true; B.sstMsg&&B.sstMsg(T('Φόρτωση θερμοκρασίας νερού…','Loading water temperature…'));
  fetch('https://marine-api.open-meteo.com/v1/marine?latitude='+la.join(',')+'&longitude='+lo.join(',')+'&hourly=sea_surface_temperature&past_hours=1&forecast_hours=120&timezone=GMT&cell_selection=sea').then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }).then(function(j){
    var a=Array.isArray(j)?j:[j], tl=(a[0]&&a[0].hourly&&a[0].hourly.time)||[];
    sstG={s:s,n:n,w:w,e:e,NY:NY,NX:NX,t:tl,v:a.map(function(p){ return (p&&p.hourly&&p.hourly.sea_surface_temperature)||[]; }),at:Date.now()};
    /* v31z527: το μοντέλο έχει κελιά μερικών km· πολλά σημεία πέφτουν στο ίδιο κελί (ίδιες τιμές → «σκαλοπάτια» και ίσιες ισόθερμες).
       Κρατάμε τα μοναδικά κέντρα κελιών που επιστρέφει το Open-Meteo και κάνουμε ομαλή παρεμβολή ανάμεσά τους. */
    var seen={}, C=[]; a.forEach(function(p,k){ if(!p||p.latitude==null) return; var id=(+p.latitude).toFixed(3)+','+(+p.longitude).toFixed(3); if(seen[id]) return; seen[id]=1; C.push({la:+p.latitude,lo:+p.longitude,k:k}); });
    sstG.C=C; sstG.dup=C.length<a.length*0.85; sstDraw();
  }).catch(function(){ B.toast(T('Η θερμοκρασία νερού δεν φορτώθηκε. Χρειάζεται σύνδεση.','Water temperature did not load. Needs a connection.')); }).then(function(){ sstBusy=false; });
}
function sstIdx(){ if(!sstG) return -1; var h=sstHour(), i=sstG.t.findIndex(function(t){ return t.slice(0,13)===h; }); if(i<0){ var now=Date.now(); i=0; var bd=1e15; sstG.t.forEach(function(t,k){ var d=Math.abs(Date.parse(t+'Z')-now); if(d<bd){ bd=d; i=k; } }); } return i; }
/* θερμοκρασία σε σημείο: διγραμμική παρεμβολή, με τα σημεία στη στεριά (χωρίς τιμή) να συμπληρώνονται από τα γειτονικά */
function sstAt(lat,lon){ if(!sstG) return null; var g=sstG, ti=sstIdx(); if(ti<0) return null;
  var fy=(lat-g.s)/(g.n-g.s)*(g.NY-1), fx=(lon-g.w)/(g.e-g.w)*(g.NX-1); if(fy<0||fx<0||fy>g.NY-1||fx>g.NX-1) return null;
  if(g.dup&&g.C&&g.C.length){ var cl=Math.cos(lat*Math.PI/180), ac=0, ws=0, best=null, bd=1e9;
    g.C.forEach(function(c){ var v=g.v[c.k]; v=v&&v[ti]; if(v==null) return; var dy=lat-c.la, dx=(lon-c.lo)*cl, d2=dy*dy+dx*dx; if(d2<bd){ bd=d2; best=v; } var w=1/Math.pow(d2+1e-6,1.5); ac+=v*w; ws+=w; });
    return ws>0?ac/ws:best; }
  var j=Math.min(g.NY-2,Math.floor(fy)), i=Math.min(g.NX-2,Math.floor(fx)), ty=fy-j, tx=fx-i, acc=0, sw=0;
  [[j,i,(1-tx)*(1-ty)],[j,i+1,tx*(1-ty)],[j+1,i,(1-tx)*ty],[j+1,i+1,tx*ty]].forEach(function(q){ var v=g.v[q[0]*g.NX+q[1]]; v=v&&v[ti]; if(v!=null&&q[2]>0){ acc+=v*q[2]; sw+=q[2]; } });
  if(sw<0.15) return null; return acc/sw; }
B.sstAt=function(lat,lon){ return sstOn?sstAt(lat,lon):null; };
function sstDraw(){
  if(!ensure()) return; if(!sstCv){ sstCv=document.createElement('canvas'); sstCv.className='wxsst'; sstCv.setAttribute('aria-hidden','true'); sstCv.style.cssText='position:absolute;left:0;top:0;pointer-events:none;transition:opacity .35s'; sstPane().appendChild(sstCv); }
  var sz=map.getSize(), dpr=Math.min(window.devicePixelRatio||1,2); sstCv.width=Math.round(sz.x*dpr); sstCv.height=Math.round(sz.y*dpr); sstCv.style.width=sz.x+'px'; sstCv.style.height=sz.y+'px'; pin(sstCv);
  var cx=sstCv.getContext('2d'); cx.setTransform(dpr,0,0,dpr,0,0); cx.clearRect(0,0,sz.x,sz.y);
  if(!sstOn||!mapOn()||!sstG){ sstCv.style.opacity='0'; B.sstLegend&&B.sstLegend(null); return; }
  var st=8, gw=Math.ceil(sz.x/st)+1, gh=Math.ceil(sz.y/st)+1, V=new Float32Array(gw*gh), A=new Uint8Array(gw*gh), lo=1e9, hi=-1e9, lat=[], lon=[];
  for(var y=0;y<gh;y++) lat.push(map.containerPointToLatLng([0,y*st]).lat); for(var x=0;x<gw;x++) lon.push(map.containerPointToLatLng([x*st,0]).lng);
  for(var yy=0;yy<gh;yy++) for(var xx=0;xx<gw;xx++){ if(land(lat[yy],lon[xx])===1) continue; var v=sstAt(lat[yy],lon[xx]); if(v==null) continue; var q=yy*gw+xx; V[q]=v; A[q]=1; if(v<lo) lo=v; if(v>hi) hi=v; }
  if(hi<lo){ sstCv.style.opacity='0'; B.sstLegend&&B.sstLegend(null); return; }
  var mid=(lo+hi)/2, span=Math.max(2,hi-lo), l0=mid-span/2, pc=document.createElement('canvas'); pc.width=gw; pc.height=gh; var px=pc.getContext('2d'), im=px.createImageData(gw,gh), d=im.data;
  for(var k=0;k<gw*gh;k++){ if(!A[k]) continue; var c=scol((V[k]-l0)/span), o=k*4; d[o]=c[0]; d[o+1]=c[1]; d[o+2]=c[2]; d[o+3]=180; }
  px.putImageData(im,0,0); cx.imageSmoothingEnabled=true; try{ cx.imageSmoothingQuality='high'; }catch(e){} cx.drawImage(pc,0,0,gw,gh,0,0,gw*st,gh*st);
  /* ισόθερμες (marching squares) και μέτωπα */
  var step=(hi-lo)<1.6?0.25:0.5, kmPx=(function(){ var a=map.containerPointToLatLng([0,sz.y/2]), b2=map.containerPointToLatLng([100,sz.y/2]); return map.distance(a,b2)/100000; })();
  var segs=[], gmax=0;
  for(var lv=Math.ceil(lo/step)*step;lv<=hi;lv+=step){
    for(var y2=0;y2<gh-1;y2++) for(var x2=0;x2<gw-1;x2++){ var q0=y2*gw+x2, q1=q0+1, q2=q0+gw+1, q3=q0+gw; if(!A[q0]||!A[q1]||!A[q2]||!A[q3]) continue;
      var a0=V[q0], a1=V[q1], a2=V[q2], a3=V[q3], idx=(a0>lv?8:0)|(a1>lv?4:0)|(a2>lv?2:0)|(a3>lv?1:0); if(idx===0||idx===15) continue;
      var X=x2*st, Y=y2*st, P={t:[X+st*(lv-a0)/(a1-a0),Y],r:[X+st,Y+st*(lv-a1)/(a2-a1)],b:[X+st*(lv-a3)/(a2-a3),Y+st],l:[X,Y+st*(lv-a0)/(a3-a0)]};
      var M={1:[['l','b']],2:[['b','r']],3:[['l','r']],4:[['t','r']],5:[['l','t'],['b','r']],6:[['t','b']],7:[['l','t']],8:[['l','t']],9:[['t','b']],10:[['t','r'],['l','b']],11:[['t','r']],12:[['l','r']],13:[['b','r']],14:[['l','b']]}[idx];
      var gx=((a1+a2)-(a0+a3))/2/st, gy=((a3+a2)-(a0+a1))/2/st, gr=Math.sqrt(gx*gx+gy*gy)/kmPx; if(gr>gmax) gmax=gr;
      M.forEach(function(m){ segs.push([P[m[0]],P[m[1]],gr,lv]); }); }
  }
  cx.lineCap='round'; cx.strokeStyle='rgba(255,255,255,.55)'; cx.lineWidth=1; cx.beginPath(); segs.forEach(function(s2){ cx.moveTo(s2[0][0],s2[0][1]); cx.lineTo(s2[1][0],s2[1][1]); }); cx.stroke();
  var thr=Math.max(0.05,gmax*0.6), fr=segs.filter(function(s2){ return s2[2]>=thr; });
  if(fr.length){ cx.strokeStyle='rgba(20,20,20,.35)'; cx.lineWidth=5; cx.beginPath(); fr.forEach(function(s2){ cx.moveTo(s2[0][0],s2[0][1]); cx.lineTo(s2[1][0],s2[1][1]); }); cx.stroke();
    cx.strokeStyle='#ffd23f'; cx.lineWidth=2.6; cx.beginPath(); fr.forEach(function(s2){ cx.moveTo(s2[0][0],s2[0][1]); cx.lineTo(s2[1][0],s2[1][1]); }); cx.stroke(); }
  /* ετικέτες θερμοκρασίας */
  var labs=[]; cx.font='700 11px system-ui,sans-serif'; cx.textAlign='center'; cx.textBaseline='middle';
  for(var z=0;z<segs.length&&labs.length<6;z+=Math.max(1,Math.floor(segs.length/40))){ var sg=segs[z], mx=(sg[0][0]+sg[1][0])/2, my=(sg[0][1]+sg[1][1])/2; if(mx<30||my<120||mx>sz.x-30||my>sz.y-200) continue;
    if(labs.some(function(l){ return (l[0]-mx)*(l[0]-mx)+(l[1]-my)*(l[1]-my)<90*90; })) continue; labs.push([mx,my]);
    var tx2=B.num(sg[3],step<0.5?2:1)+'°'; cx.lineWidth=3; cx.strokeStyle='rgba(10,20,30,.7)'; cx.strokeText(tx2,mx,my); cx.fillStyle='#fff'; cx.fillText(tx2,mx,my); }
  sstCv.style.opacity='1';
  B.sstLegend&&B.sstLegend({lo:lo,hi:hi,l0:l0,span:span,fronts:fr.length>0,gmax:gmax});
}

/* υπόμνημα θερμοκρασίας νερού: κλίμακα της περιοχής και τι είναι το μέτωπο */
var legEl=null;
B.sstLegend=function(L2){ if(!L2){ if(legEl) legEl.hidden=true; return; }
  if(!legEl){ legEl=document.createElement('div'); legEl.className='sstleg'; legEl.setAttribute('role','note'); document.body.append(legEl); }
  var g=SC.map(function(c){ return 'rgb('+c[1].map(Math.round).join(',')+') '+Math.round(c[0]*100)+'%'; }).join(','), U=window.PsaroUnits, f=function(v){ return U&&U.temp?U.temp(v,1):B.num(v,1)+'°'; };
  legEl.hidden=false; legEl.replaceChildren();
  var top=document.createElement('div'); top.className='slt'; top.innerHTML='<b></b><span class="slb" style="background:linear-gradient(90deg,'+g+')"></span><b></b>'; top.children[0].textContent=f(L2.l0); top.children[2].textContent=f(L2.l0+L2.span); legEl.append(top);
  var nt=document.createElement('small'); nt.innerHTML='<i class="slf"></i>'; nt.append(document.createTextNode(L2.fronts?T('Μέτωπο: απότομη αλλαγή θερμοκρασίας. Εκεί συχνά μαζεύονται πελαγικά.','Front: sharp temperature change. Pelagics often gather there.'):T('Χωρίς έντονα μέτωπα σε αυτή την περιοχή.','No strong fronts in this area.'))); legEl.append(nt); };
B.sst={on:function(){ return sstOn; },set:function(v){ sstOn=!!v; B.ls.set(SK,sstOn); if(sstOn) sstLoad(true); else sstDraw(); try{ window.dispatchEvent(new Event('psaro-wxchange')); }catch(e){} },color:scol};
/* μέρες κάτω από τη μπάρα ώρας */
function days(){
  var sl=document.getElementById('ndWindSl'), Wx=W(); if(!sl||!Wx||!Wx.hours) return; var hs=Wx.hours()||[]; if(hs.length<2) return;
  var row=sl.parentNode, box=row.parentNode.querySelector('.wxdays'), key=hs[0]+hs.length;
  if(box&&box._k===key) return; if(box) box.remove();
  box=document.createElement('div'); box.className='wxdays'; box._k=key; box.setAttribute('role','group'); box.setAttribute('aria-label',T('Μέρες','Days'));
  var prev='', tz='Asia/Nicosia', now=Date.now();
  /* v31z534: πάτημα σε μέρα → η μπάρα πάει σε εκείνη τη μέρα, ίδια ώρα με αυτή που βλέπεις τώρα */
  var hod=function(ms){ try{ return +new Date(ms).toLocaleTimeString('en-GB',{timeZone:tz,hour:'2-digit',hour12:false}).slice(0,2)%24; }catch(e){ return new Date(ms).getHours(); } };
  var MS=hs.map(function(t){ return Date.parse(t+(t.length<=16?':00Z':'Z')); });
  function toNow(){ var bi=0, bd=1e15; MS.forEach(function(m,j){ var d=Math.abs(m-Date.now()); if(d<bd){ bd=d; bi=j; } }); sl.value=bi; sl.dispatchEvent(new Event('input',{bubbles:true})); }
  function jump(i0,dk){ if(i0===0&&box.querySelector('button')&&box.querySelector('button')._now){ toNow(); return; } var cur=MS[+sl.value]||MS[0], want=hod(cur), best=i0, bd=99;
    for(var j=i0;j<MS.length;j++){ var dj; try{ dj=new Date(MS[j]).toLocaleDateString(EN?'en-GB':'el-GR',{timeZone:tz,weekday:'short',day:'numeric'}); }catch(e){ dj=hs[j].slice(0,10); } if(dj!==dk) break; var dd=Math.abs(hod(MS[j])-want); if(dd<bd){ bd=dd; best=j; } }
    sl.value=best; sl.dispatchEvent(new Event('input',{bubbles:true})); }
  hs.forEach(function(t,i){ var ms=MS[i], dk;
    try{ dk=new Date(ms).toLocaleDateString(EN?'en-GB':'el-GR',{timeZone:tz,weekday:'short',day:'numeric'}); }catch(e){ dk=t.slice(0,10); }
    if(dk!==prev){ prev=dk; var pos=100*i/(hs.length-1), lastS=box.querySelector('button:last-of-type'); if(lastS&&pos-parseFloat(lastS.style.left)<14){ if(lastS._i===0&&pos>=8){ lastS.textContent=T('Τώρα','Now'); lastS._now=true; } else lastS.remove(); }
      var s=document.createElement('button'); s.type='button'; s.textContent=dk; s.style.left=pos+'%'; if(i>0) s.className='tick'; s._i=i; (function(i0,d0){ s.addEventListener('click',function(){ jump(i0,d0); }); })(i,dk); box.append(s); }
    if(Math.abs(ms-now)<1800000){ var n=document.createElement('i'); n.className='now'; n.style.left=(100*i/(hs.length-1))+'%'; box.append(n); } });
  row.after(box); markDay();
}
/* η μέρα που δείχνει η μπάρα τώρα, τονισμένη */
function markDay(){ var sl=document.getElementById('ndWindSl'), box=document.querySelector('.wxdays'); if(!sl||!box) return; var v=+sl.value, bs=box.querySelectorAll('button'), on=null; [].forEach.call(bs,function(b){ if(b._i<=v) on=b; }); [].forEach.call(bs,function(b){ b.classList.toggle('on',b===on); }); }
function sync(){ var k=[mapOn(),seaOn(),windOn()].join(); if(k!==sig){ sig=k; later(80); if(sstOn){ if(mapOn()) sstLoad(false); else sstDraw(); } } days(); }
window.addEventListener('psaro-windhour',function(){ markDay(); later(60); if(sstOn&&sstG){ var h=sstHour(); if(h!==sstHr){ sstHr=h; clearTimeout(sstDraw._t); sstDraw._t=setTimeout(sstDraw,150); } } });
window.addEventListener('psaro-windstop',function(){ later(60); });
window.addEventListener('psaro-seareg',function(){ later(60); roLater(); });
window.addEventListener('psaro-curs',function(){ if(numsOn) setTimeout(drawLabels,50); });
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
var dkT=setInterval(function(){ var d=document.getElementById('ndMapDock'); if(!d) return; clearInterval(dkT); new MutationObserver(function(){ days(); }).observe(d,{childList:true,subtree:true}); days(); },1000);
setInterval(function(){ if(seaOn()&&mapOn()&&(!fillCv||fillCv.style.opacity==='0')) later(10); },4000);
setTimeout(function(){ if(sstOn&&mapOn()) sstLoad(true); },3000);
/* χωρίς άνεμο ή κύμα, ένα πάτημα στον χάρτη δείχνει την κάρτα σημείου με τη θερμοκρασία νερού */
var tapHook=setInterval(function(){ if(!ensure()) return; clearInterval(tapHook); map.on('click',function(e){ if(!sstOn||windOn()||seaOn()) return; try{ window.dispatchEvent(new CustomEvent('psaro-wxtap',{detail:{lat:e.latlng.lat,lng:e.latlng.lng}})); }catch(x){} }); },1000);
/* αποδόσεις χάρτη (Leaflet, Esri, EMODnet…): αντί για τη λωρίδα κάτω δεξιά, ένα μικρό «ⓘ» που τις δείχνει όλες */
var atT=setInterval(function(){ if(!ensure()) return; clearInterval(atT); var b=document.createElement('button'); b.type='button'; b.className='attrbtn'; b.setAttribute('aria-label',T('Πηγές χάρτη','Map sources')); b.textContent='ⓘ';
  b.addEventListener('click',function(){ var src=map.attributionControl&&map.attributionControl.getContainer?map.attributionControl.getContainer().innerHTML:''; var bd=h('div',{class:'attrbody'}); bd.innerHTML=src; bd.querySelectorAll('a').forEach(function(a){ a.target='_blank'; a.rel='noopener'; });
    B.sheet({title:T('Πηγές χάρτη και δεδομένων','Map and data sources'),body:h('div',null,bd,h('p',{class:'note',text:T('Υπόβαθρο © Esri / OpenStreetMap, βάθη EMODnet Bathymetry, καιρός και κύμα Open-Meteo, σημάδια OpenSeaMap. Ενδεικτικά δεδομένα: δεν είναι ναυτικός χάρτης.','Basemap © Esri / OpenStreetMap, depths EMODnet Bathymetry, weather and waves Open-Meteo, marks OpenSeaMap. Indicative data: not a nautical chart.')}))}); });
  document.body.append(b); },1000);
})();

