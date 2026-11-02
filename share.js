/* Κοινοποίηση εξόδου: δημιουργεί εικόνα (κάρτα) με τα αποτελέσματα και την στέλνει μέσω του μενού κοινοποίησης του κινητού. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var W=1080, H=1350, FONT='-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
function rr(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }
function fit(x,txt,max){ if(x.measureText(txt).width<=max) return txt; while(txt.length>1&&x.measureText(txt+'…').width>max) txt=txt.slice(0,-1); return txt+'…'; }
async function bestPhoto(t){
  if(!t.startMs||!t.endMs||!C.Photos) return null;
  var best=null;
  C.Store.get('bites').forEach(function(b){
    if(!b.photo) return; var ms=C.biteMs(b); if(isNaN(ms)||ms<t.startMs-60000||ms>t.endMs) return;
    if(!best||(+b.kg||0)>(+best.kg||0)) best=b;
  });
  if(!best) return null;
  try{ var bl=await C.Photos.get(best.id); if(!bl) return null; return {bmp:await createImageBitmap(bl),b:best}; }catch(e){ return null; }
}
async function speciesLines(t){
  if(!t.startMs||!t.endMs) return t.species?[t.species]:[];
  var n={}, lab={};
  C.Store.get('bites').forEach(function(b){ var ms=C.biteMs(b); if(isNaN(ms)||ms<t.startMs-60000||ms>t.endMs||!b.species) return; var k=b.species.trim().toLowerCase(); n[k]=(n[k]||0)+1; lab[k]=lab[k]||b.species.trim(); });
  return Object.keys(n).sort(function(a,b){ return n[b]-n[a]; }).map(function(k){ return lab[k]+' ×'+n[k]; });
}
async function draw(t,e){
  var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var x=cv.getContext('2d');
  var g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0a2a3d'); g.addColorStop(1,'#0b7285'); x.fillStyle=g; x.fillRect(0,0,W,H);
  x.globalAlpha=.10; x.strokeStyle='#fff'; x.lineWidth=3;
  for(var k=0;k<9;k++){ x.beginPath(); for(var px=0;px<=W;px+=20){ var py=H-330+k*46+Math.sin(px/90+k)*14; if(px===0) x.moveTo(px,py); else x.lineTo(px,py); } x.stroke(); }
  x.globalAlpha=1;
  var ph=await bestPhoto(t), top=60;
  x.fillStyle='#fff'; x.font='700 52px '+FONT; x.textBaseline='top'; x.fillText('Alkyon',60,top);
  x.font='400 30px '+FONT; x.globalAlpha=.8; x.textAlign='right'; x.fillText(t.date?t.date.split('-').reverse().join('/'):'',W-60,top+12); x.textAlign='left'; x.globalAlpha=1;
  var y=top+100;
  if(ph){
    var iw=W-120, ih=480; x.save(); rr(x,60,y,iw,ih,36); x.clip();
    var r=Math.max(iw/ph.bmp.width,ih/ph.bmp.height), dw=ph.bmp.width*r, dh=ph.bmp.height*r;
    x.drawImage(ph.bmp,60+(iw-dw)/2,y+(ih-dh)/2,dw,dh);
    var gg=x.createLinearGradient(0,y+ih-160,0,y+ih); gg.addColorStop(0,'rgba(0,0,0,0)'); gg.addColorStop(1,'rgba(0,0,0,.65)'); x.fillStyle=gg; x.fillRect(60,y+ih-160,iw,160); x.restore();
    var cap=[ph.b.species||'',ph.b.kg?ph.b.kg+' kg':'',ph.b.len?ph.b.len+' cm':''].filter(Boolean).join(' · ');
    if(cap){ x.fillStyle='#fff'; x.font='700 40px '+FONT; x.fillText(fit(x,cap,iw-60),90,y+ih-64); }
    y+=ih+40;
  } else {
    x.save(); x.translate(W/2-9*15,y+6); x.scale(15,15); x.lineWidth=1.1; x.lineCap='round'; x.lineJoin='round'; x.strokeStyle='rgba(255,255,255,.34)'; x.fillStyle='rgba(255,255,255,.34)';
    x.beginPath(); x.arc(12,4.6,1.7,0,Math.PI*2); x.stroke(); x.stroke(new Path2D('M12 6.3V15a4.2 4.2 0 01-8.4 0v-3M1.7 13.4l1.9-1.9 1.9 1.9')); x.restore(); y+=300;
  }
  x.fillStyle='#fff'; x.font='700 56px '+FONT; x.fillText(fit(x,t.spot||(t.prof==='spear'?T('Ψαροντούφεκο','Spearfishing'):T('Έξοδος για ψάρεμα','Fishing trip')),W-120),60,y); y+=84;
  var dur=(t.startMs&&t.endMs)?C.fmtDur(t.endMs-t.startMs-(t.pauseMs||0)):'';
  var tot=e.count+(e.miss||0), succ=e.miss>0?Math.round(e.count/tot*100)+'%':'';
  /* v31z375: έξοδος με ψαροντούφεκο: ψάρια, χαμένες βολές, «είδα», χρόνος στο νερό, βουτιές, σημαδούρα */
  var spear=t.prof==='spear', seenN=0, dives=0, buoy=false;
  if(spear){ try{ seenN=((window.AlkyonSeen&&window.AlkyonSeen.all())||[]).filter(function(q){ return q.start===t.startMs; }).length; dives=+localStorage.getItem('alkyon-dives-'+t.startMs)||0; buoy=localStorage.getItem('alkyon-buoy-'+t.startMs)==='1'; }catch(er){} }
  var cells=spear?[[String(e.count),T('Ψάρια','Fish')],[String(e.miss||0),T('Χαμένες βολές','Missed shots')],[String(seenN),T('Είδα','Seen')],[dur||'–',T('Στο νερό','In water')]]
    :[[String(e.count),T('Ψάρια','Catches')],[String(e.miss||0),'Miss'],[(e.kg||0).toFixed(1),'kg'],[dur||'–',T('Χρόνος','Time')]];
  var cw=(W-120-3*20)/4, spl=await speciesLines(t);
  cells.forEach(function(c,i){ var cx=60+i*(cw+20); x.fillStyle='rgba(255,255,255,.14)'; rr(x,cx,y,cw,150,26); x.fill();
    x.fillStyle='#fff'; x.textAlign='center'; x.font='700 56px '+FONT; x.fillText(fit(x,c[0],cw-16),cx+cw/2,y+22); x.font='400 26px '+FONT; x.globalAlpha=.8; x.fillText(c[1],cx+cw/2,y+100); x.globalAlpha=1; x.textAlign='left'; });
  y+=185;
  spl.slice(0,4).forEach(function(r){ x.fillStyle='#fff'; x.font='600 42px '+FONT; x.fillText(fit(x,r,W-120),60,y); y+=64; });
  if(spl.length) y+=12;
  var line2=(spear?[succ?T('Εύστοχες βολές ','Shots on target ')+succ:'',dives?dives+T(' βουτιές',' dives'):'',(e.kg?(e.kg).toFixed(1)+' kg':''),buoy?T('Σημαδούρα ✓','Float ✓'):'']:[succ?T('Επιτυχία ','Success ')+succ:'']).filter(Boolean).join('  ·  ');
  if(line2){ x.fillStyle='#fff'; x.font='500 34px '+FONT; x.fillText(fit(x,line2,W-120),60,y); y+=56; }
  var c0=t.cond0||{}, cd=[c0.wind!=null?c0.wind+' kn':'',c0.wave!=null?(+c0.wave).toFixed(1)+' m '+T('κύμα','wave'):'',c0.press!=null?c0.press+' hPa':'',c0.sst!=null?Math.round(c0.sst)+'°C '+T('θάλασσα','sea'):''].filter(Boolean).join('  ·  ');
  if(cd){ x.fillStyle='rgba(255,255,255,.78)'; x.font='400 30px '+FONT; x.fillText(fit(x,cd,W-120),60,y); }
  x.fillStyle='rgba(255,255,255,.55)'; x.font='400 26px '+FONT; x.textAlign='center'; x.fillText('Alkyon · '+T('το ημερολόγιο του ψαρά','the angler\'s logbook'),W/2,H-62); x.textAlign='left';
  return cv;
}
function blobOf(cv){ return new Promise(function(res){ cv.toBlob(function(b){ res(b); },'image/png'); }); }
async function trip(t,e){
  try{
    C.toast(T('Δημιουργία εικόνας…','Creating image…'));
    var cv=await draw(t,e||{count:+t.count||0,kg:+t.kg||0,species:t.species||'',miss:+t.miss||0}), bl=await blobOf(cv);
    if(!bl) throw new Error('blob');
    var f=new File([bl],'alkyon-'+(t.date||'trip')+'.png',{type:'image/png'});
    var txt=T('Η έξοδός μου με το Alkyon','My trip with Alkyon');
    if(navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],text:txt}); return; }
    var a=document.createElement('a'); a.href=URL.createObjectURL(bl); a.download=f.name; document.body.append(a); a.click(); a.remove();
    C.toast(T('Η εικόνα κατέβηκε.','Image downloaded.'));
  }catch(err){ if(err&&err.name==='AbortError') return; C.toast(T('Δεν δημιουργήθηκε η εικόνα.','Could not create the image.')); }
}
window.AlkyonShare={trip:trip,draw:draw};
})();
