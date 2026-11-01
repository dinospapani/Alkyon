/* BiteCast 4 · καιρός στον χάρτη σαν το Windy (v31z520)
   - Άνεμος: χρωματιστό πεδίο έντασης σε όλη την οθόνη, κάτω από τα λευκά σωματίδια (windmap.js).
   - Κύμα: πεδίο ύψους κύματος από τα μοντέλα για όλη τη θάλασσα (και πέρα από τα 10 km της «Κατάστασης θάλασσας»),
     με κινούμενες λευκές «κορυφές» στην κατεύθυνση που ταξιδεύει το κύμα.
   - Μπάρα ώρας: οι μέρες κάτω από το slider. */
(function(){
var B=window.BC, T=B.T, EN=B.EN;
window.PSARO_WINDY=true;
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
    map.on('move',function(){ if(fillCv) pin(fillCv); if(dashCv) pin(dashCv); });
    map.on('moveend zoomend resize',function(){ later(250); }); }
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
  if(!mode){ fillCv.style.opacity='0'; return; }
  var st=6, bw=Math.ceil(sz.x/st)+1, bh=Math.ceil(sz.y/st)+1, pc=document.createElement('canvas'); pc.width=bw; pc.height=bh;
  var px=pc.getContext('2d'), im=px.createImageData(bw,bh), d=im.data, any=false, lat=[], lon=[];
  for(var y=0;y<bh;y++) lat.push(map.containerPointToLatLng([0,y*st]).lat);
  for(var x=0;x<bw;x++) lon.push(map.containerPointToLatLng([x*st,0]).lng);
  var Sx=S(), Wx=W(), G=Sx&&Sx.grad;
  if(mode==='sea'&&!(Sx&&Sx.ready&&Sx.ready())){ fillCv.style.opacity='0'; clearTimeout(waitT); waitT=setTimeout(render,1500); return; }
  for(var yy=0;yy<bh;yy++) for(var xx=0;xx<bw;xx++){
    var la=lat[yy], lo=lon[xx], c=null, a=0, o=(yy*bw+xx)*4;
    if(mode==='sea'){ if(land(la,lo)===1) continue; var m=Sx.modelAt(la,lo); if(!m) continue; c=G?G(m.h):[52,168,120]; a=0.72; }
    else { var v=Wx.sample(la,lo); if(!v) continue; c=wcol(v.sp); a=0.62; }
    d[o]=c[0]; d[o+1]=c[1]; d[o+2]=c[2]; d[o+3]=Math.round(255*a); any=true;
  }
  px.putImageData(im,0,0);
  fx.imageSmoothingEnabled=true; try{ fx.imageSmoothingQuality='high'; }catch(e){}
  fx.drawImage(pc,0,0,bw,bh,0,0,bw*st*dpr,bh*st*dpr);
  fillCv.style.opacity=any?'1':'0';
  if(mode==='sea'&&any) startAnim();
}
/* κορυφές κύματος: κοντές λευκές γραμμές κάθετες στη διεύθυνση που ταξιδεύει το κύμα */
function np(sz){ return {x:Math.random()*sz.x,y:Math.random()*sz.y,age:0,life:50+Math.floor(Math.random()*70)}; }
function startAnim(){ if(!dashCv) return; var sz=map.getSize(), n=Math.min(700,Math.round(sz.x*sz.y/700)); parts=[]; for(var i=0;i<n;i++){ var p=np(sz); p.age=Math.floor(Math.random()*p.life); parts.push(p); } if(!raf) raf=requestAnimationFrame(loop); }
function stopAnim(){ if(raf){ cancelAnimationFrame(raf); raf=0; } }
function loop(ts){
  raf=0; if(!parts.length||!seaOn()||!mapOn()) return; raf=requestAnimationFrame(loop);
  if(document.hidden||ts-last<40) return; last=ts;
  var sz=map.getSize(), Sx=S(); dctx.clearRect(0,0,sz.x,sz.y); dctx.lineCap='round'; dctx.strokeStyle='#ffffff'; dctx.lineWidth=1.6;
  for(var i=0;i<parts.length;i++){ var p=parts[i];
    if(p.m===undefined||p.age%25===0){ var ll=map.containerPointToLatLng([p.x,p.y]); p.m=land(ll.lat,ll.lng)===1?null:Sx.modelAt(ll.lat,ll.lng); }
    var m=p.m; if(!m||m.dir==null||p.age++>p.life){ parts[i]=np(sz); continue; }
    var go=(m.dir+180)*Math.PI/180, sp=RM?0:(0.18+Math.min(10,m.tp||4)*0.045), dx=Math.sin(go), dy=-Math.cos(go);
    p.x+=dx*sp; p.y+=dy*sp; if(p.x<0||p.y<0||p.x>sz.x||p.y>sz.y){ parts[i]=np(sz); continue; }
    var f=p.age/p.life, al=Math.sin(Math.PI*f)*Math.min(0.85,0.35+m.h*0.5), len=4+Math.min(6,m.h*5);
    dctx.globalAlpha=al; dctx.beginPath(); dctx.moveTo(p.x-dy*len,p.y+dx*len); dctx.lineTo(p.x+dy*len,p.y-dx*len); dctx.stroke();
  }
  dctx.globalAlpha=1;
}
/* μέρες κάτω από τη μπάρα ώρας */
function days(){
  var sl=document.getElementById('ndWindSl'), Wx=W(); if(!sl||!Wx||!Wx.hours) return; var hs=Wx.hours()||[]; if(hs.length<2) return;
  var row=sl.parentNode, box=row.parentNode.querySelector('.wxdays'), key=hs[0]+hs.length;
  if(box&&box._k===key) return; if(box) box.remove();
  box=document.createElement('div'); box.className='wxdays'; box._k=key; box.setAttribute('aria-hidden','true');
  var prev='', tz='Asia/Nicosia', now=Date.now();
  hs.forEach(function(t,i){ var ms=Date.parse(t+(t.length<=16?':00Z':'Z')), dk;
    try{ dk=new Date(ms).toLocaleDateString(EN?'en-GB':'el-GR',{timeZone:tz,weekday:'short',day:'numeric'}); }catch(e){ dk=t.slice(0,10); }
    if(dk!==prev){ prev=dk; var pos=100*i/(hs.length-1), lastS=box.querySelector('span:last-of-type'); if(lastS&&pos-parseFloat(lastS.style.left)<14) lastS.remove(); var s=document.createElement('span'); s.textContent=dk; s.style.left=pos+'%'; if(i>0) s.className='tick'; box.append(s); }
    if(Math.abs(ms-now)<1800000){ var n=document.createElement('i'); n.className='now'; n.style.left=(100*i/(hs.length-1))+'%'; box.append(n); } });
  row.after(box);
}
function sync(){ var k=[mapOn(),seaOn(),windOn()].join(); if(k!==sig){ sig=k; later(80); } days(); }
window.addEventListener('psaro-windhour',function(){ later(60); });
window.addEventListener('psaro-windstop',function(){ later(60); });
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
var dkT=setInterval(function(){ var d=document.getElementById('ndMapDock'); if(!d) return; clearInterval(dkT); new MutationObserver(function(){ days(); }).observe(d,{childList:true,subtree:true}); days(); },1000);
setInterval(function(){ if(seaOn()&&mapOn()&&(!fillCv||fillCv.style.opacity==='0')) later(10); },4000);
})();
