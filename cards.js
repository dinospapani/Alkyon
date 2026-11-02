/* Κάρτες κοινοποίησης (ψάρι, έξοδος, χρονιά), περίληψη εξόδου με κόστος, φωνητική καταγραφή και κοινοποίηση σημείων. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var SN=function(n){ return window.spName?window.spName(n):n; };
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; }, U=window.AlkyonUnits;
var $=function(i){ return document.getElementById(i); };
var FONT='-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', URLS='dinospapani.github.io/Alkyon';
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function pad(n){ return ('0'+n).slice(-2); }
function fmtDur(ms){ var m=Math.round(ms/60000), h=Math.floor(m/60); return h?h+T('ω ','h ')+pad(m%60)+T('λ','m'):m+T('λ','m'); }
function dmy(d){ return d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):''; }
function money(v){ return '€'+(Math.round(v*100)/100).toFixed(v%1?2:0); }
function costOf(t){ var c=t&&t.cost; return c?(+c.fuel||0)+(+c.bait||0)+(+c.other||0):0; }

/* ---------- καμβάς ---------- */
function mk(w,h){
  var c=document.createElement('canvas'); c.width=w; c.height=h; var x=c.getContext('2d');
  var g=x.createLinearGradient(0,0,w,h); g.addColorStop(0,'#0a2238'); g.addColorStop(1,'#0d6a6c'); x.fillStyle=g; x.fillRect(0,0,w,h);
  x.globalAlpha=.07; x.strokeStyle='#fff'; x.lineWidth=3;
  for(var i=0;i<16;i++){ x.beginPath(); for(var k=0;k<=w;k+=20){ var y=h*0.4+i*58+Math.sin(k/70+i)*14; if(k) x.lineTo(k,y); else x.moveTo(k,y); } x.stroke(); }
  x.globalAlpha=1; return {c:c,x:x,w:w,h:h};
}
function txt(cv,s,px,py,size,weight,color,align,maxW){
  var x=cv.x, sz=size; x.fillStyle=color||'#fff'; x.textAlign=align||'left'; x.textBaseline='alphabetic'; s=String(s);
  do{ x.font=weight+' '+sz+'px '+FONT; sz-=2; }while(maxW&&x.measureText(s).width>maxW&&sz>16);
  x.fillText(s,px,py);
}
function rr(x,a,b,w,h,r){ x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r); x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }
function brand(cv,sub){ txt(cv,'Alkyon',70,110,48,'800','#fff'); if(sub) txt(cv,sub,cv.w-70,108,30,'600','rgba(255,255,255,.78)','right',560); }
function foot(cv){ /* μόνο το όνομα της εφαρμογής στην κεφαλίδα, χωρίς διεύθυνση */ }
function stat(cv,a,b,w,h,val,lab){ var x=cv.x; x.fillStyle='rgba(255,255,255,.13)'; rr(x,a,b,w,h,26); x.fill(); txt(cv,val,a+w/2,b+h*0.56,Math.round(h*0.4),'800','#fff','center',w-28); txt(cv,lab,a+w/2,b+h*0.86,Math.round(h*0.19),'600','rgba(255,255,255,.72)','center',w-28); }
function fish(cv,cx,cy,s,color){ var x=cv.x; x.save(); x.translate(cx-16*s,cy-12*s); x.scale(s,s); x.fillStyle=color; x.fill(new Path2D('M3 12C8 4.5 17 4 22 12c-5 8-14 7.5-19 0z M22 12l7-6.5v13z')); x.restore(); }
function cover(cv,img,a,b,w,h,r){ var x=cv.x; x.save(); rr(x,a,b,w,h,r); x.clip(); var s=Math.max(w/img.width,h/img.height); x.drawImage(img,a+(w-img.width*s)/2,b+(h-img.height*s)/2,img.width*s,img.height*s); x.restore(); }
function fit(cv,img,a,b,w,h,r){ var x=cv.x; x.save(); rr(x,a,b,w,h,r); x.clip();
  var sc=Math.max(w/img.width,h/img.height);
  try{ x.filter='blur(28px)'; x.drawImage(img,a+(w-img.width*sc)/2-20,b+(h-img.height*sc)/2-20,img.width*sc+40,img.height*sc+40); x.filter='none'; }catch(e){ x.filter='none'; }
  x.fillStyle='rgba(0,0,0,.28)'; x.fillRect(a,b,w,h);
  var s2=Math.min(w/img.width,h/img.height); x.drawImage(img,a+(w-img.width*s2)/2,b+(h-img.height*s2)/2,img.width*s2,img.height*s2); x.restore(); }
function tackleLines(b){ try{ if(!b||!b.tk||!b.tk.length||!window.AlkyonTackle) return []; var nm=AlkyonTackle.names(), parts=[]; b.tk.forEach(function(id){ var n=nm[id]; if(!n) return; n=n.replace(/^[^\p{L}\p{N}]+/u,''); var w=b.tkw&&b.tkw[id]; parts.push(n+(w?' '+w+' g':'')); }); var lines=[], cur=''; parts.forEach(function(p){ var t=cur?cur+'  ·  '+p:p; if(t.length>46&&cur){ lines.push(cur); cur=p; } else cur=t; }); if(cur) lines.push(cur); return lines.slice(0,2); }catch(e){ return []; } }
function route(cv,tr,a,b,w,h){
  var x=cv.x; x.fillStyle='rgba(0,0,0,.22)'; rr(x,a,b,w,h,30); x.fill();
  if(!tr||tr.length<2){ fish(cv,a+w/2,b+h/2,9,'rgba(255,255,255,.35)'); return; }
  var la0=1e9,la1=-1e9,lo0=1e9,lo1=-1e9; tr.forEach(function(p){ la0=Math.min(la0,p[0]); la1=Math.max(la1,p[0]); lo0=Math.min(lo0,p[1]); lo1=Math.max(lo1,p[1]); });
  var k=Math.cos((la0+la1)/2*Math.PI/180), dw=Math.max(1e-5,(lo1-lo0)*k), dh=Math.max(1e-5,la1-la0), pd=60, s=Math.min((w-2*pd)/dw,(h-2*pd)/dh);
  var ox=a+w/2-dw*s/2, oy=b+h/2+dh*s/2;
  function P(p){ return [ox+(p[1]-lo0)*k*s, oy-(p[0]-la0)*s]; }
  x.lineJoin='round'; x.lineCap='round'; x.strokeStyle='#ff8a50'; x.lineWidth=9; x.beginPath(); tr.forEach(function(p,i){ var q=P(p); if(i) x.lineTo(q[0],q[1]); else x.moveTo(q[0],q[1]); }); x.stroke();
  [[tr[0],'#3ddc97'],[tr[tr.length-1],'#ff4d4d']].forEach(function(e){ var q=P(e[0]); x.fillStyle='#fff'; x.beginPath(); x.arc(q[0],q[1],17,0,7); x.fill(); x.fillStyle=e[1]; x.beginPath(); x.arc(q[0],q[1],11,0,7); x.fill(); });
}
function photoOf(b){
  if(!b||!b.photo||!C.Photos) return Promise.resolve(null);
  return C.Photos.get(b.id).then(function(bl){ return bl&&window.createImageBitmap?createImageBitmap(bl):null; }).catch(function(){ return null; });
}

/* ---------- κάρτες ---------- */
function fishCard(b){
  return photoOf(b).then(function(img){
    var cv=mk(1080,1350), x=cv.x; brand(cv,T('Ψάρι της εξόδου','Catch of the day'));
    if(img) fit(cv,img,70,150,940,640,36); else { x.fillStyle='rgba(0,0,0,.2)'; rr(x,70,150,940,640,36); x.fill(); fish(cv,540,470,17,'rgba(255,255,255,.38)'); }
    txt(cv,SN(b.species)||T('Ψάρι','Fish'),70,885,84,'800','#fff','left',940);
    var sz=[b.kg?b.kg+' kg':null,b.len?b.len+' cm':null].filter(Boolean).join('  ·  ');
    if(sz) txt(cv,sz,70,965,60,'700','#ffb27a','left',940);
    var when=dmy(b.date)+(b.time?'  ·  '+b.time:''), where=b.place||'';
    txt(cv,[when,where].filter(Boolean).join('  ·  '),70,1030,34,'500','rgba(255,255,255,.85)','left',940);
    var cd=[b.wind!=null&&U?U.wind(b.wind):null,b.wave!=null&&U?U.wave(b.wave):null,b.press!=null&&U?U.press(b.press):null,b.temp!=null&&U?U.temp(b.temp):null].filter(Boolean);
    if(cd.length) txt(cv,cd.join('  ·  '),70,1085,32,'500','rgba(255,255,255,.7)','left',940);
    var by=[b.bait,b.tech].filter(Boolean).join('  ·  '); if(by) txt(cv,by,70,1140,32,'500','rgba(255,255,255,.7)','left',940);
    tackleLines(b).forEach(function(l,i){ txt(cv,'🎣 '+l,70,1195+i*48,30,'500','rgba(255,255,255,.7)','left',940); });
    foot(cv); return cv;
  });
}
function tripStats(t){
  var ms=(t.startMs&&t.endMs)?Math.max(0,t.endMs-t.startMs-(t.pauseMs||0)):0;
  return {ms:ms,fish:+t.count||0,kg:+t.kg||0,miss:+t.miss||0,km:+t.km||0,cost:costOf(t)};
}
function tripCard(t){
  var s=tripStats(t), cv=mk(1080,1350); brand(cv,T('Η έξοδός μου','My trip'));
  txt(cv,[dmy(t.date),t.spot].filter(Boolean).join('  ·  '),70,185,40,'700','#fff','left',940);
  route(cv,t.track,70,225,940,560);
  var w=296, g=26, y0=830, h=190, X=[70,70+w+g,70+2*(w+g)];
  stat(cv,X[0],y0,w,h,s.ms?fmtDur(s.ms):'–',T('Διάρκεια','Duration'));
  stat(cv,X[1],y0,w,h,String(s.fish),T('Ψάρια','Fish'));
  stat(cv,X[2],y0,w,h,(Math.round(s.kg*10)/10)+' kg',T('Βάρος','Weight'));
  stat(cv,X[0],y0+h+g,w,h,String(s.miss),T('Χάθηκαν','Lost'));
  stat(cv,X[1],y0+h+g,w,h,s.km&&U?U.dist(s.km):'–',T('Απόσταση','Distance'));
  stat(cv,X[2],y0+h+g,w,h,SN(t.species)||'–',T('Κύριο είδος','Top species'));
  foot(cv); return Promise.resolve(cv);
}
function yearData(y){
  var inY=function(x){ return (x.date||'').slice(0,4)===String(y); };
  var bites=(C.Store.act?C.Store.act():(C.Store.get('bites')||[])).filter(inY), trips=(C.Store.get('trips')||[]).filter(inY), miss=(C.Store.misses?C.Store.misses():[]).filter(inY).length;
  var ms=0,km=0,cost=0,days={},sp={},mo={},big=null,kg=0,nf=0; trips.forEach(function(t){ if(t.startMs&&t.endMs) ms+=Math.max(0,t.endMs-t.startMs-(t.pauseMs||0)); km+=+t.km||0; cost+=costOf(t); if(t.date) days[t.date]=1; });
  bites.forEach(function(b){ if(b.date) days[b.date]=1; var w=+b.kg||0; kg+=b.rel?0:w; nf+=C.bc(b); if(b.species) sp[b.species]=(sp[b.species]||0)+C.bc(b); var m=b.date.slice(5,7); mo[m]=(mo[m]||0)+C.bc(b); if(w&&C.bc(b)===1&&(!big||w>+big.kg)) big=b; });
  var top=Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; }).slice(0,3).map(function(k){ return [k,sp[k]]; });
  var bm=Object.keys(mo).sort(function(a,b){ return mo[b]-mo[a]; })[0]||'';
  return {y:y,fish:nf,miss:miss,trips:trips.length,days:Object.keys(days).length,ms:ms,km:km,kg:Math.round(kg*10)/10,cost:cost,top:top,big:big,month:bm,species:Object.keys(sp).length};
}
var MON=EN?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']:['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
function yearCard(y){
  var d=yearData(y), cv=mk(1080,1350); brand(cv,String(y));
  txt(cv,T('Η χρονιά μου στο ψάρεμα','My fishing year'),70,200,64,'800','#fff','left',940);
  var w=296, g=26, y0=250, h=190, X=[70,70+w+g,70+2*(w+g)];
  stat(cv,X[0],y0,w,h,String(d.fish),T('Ψάρια','Fish')); stat(cv,X[1],y0,w,h,String(d.trips),T('Έξοδοι','Trips')); stat(cv,X[2],y0,w,h,String(d.days),T('Μέρες','Days'));
  stat(cv,X[0],y0+h+g,w,h,d.ms?(Math.round(d.ms/360000)/10)+' h':'–',T('Στη θάλασσα','At sea')); stat(cv,X[1],y0+h+g,w,h,d.kg+' kg',T('Βάρος','Weight')); stat(cv,X[2],y0+h+g,w,h,d.km&&U?U.dist(d.km):'–',T('Απόσταση','Distance'));
  var yy=y0+2*(h+g)+50;
  if(d.top.length){ txt(cv,T('Τα πιο συχνά είδη','Top species'),70,yy,34,'700','#ffb27a'); yy+=58; d.top.forEach(function(e,i){ txt(cv,(i+1)+'.  '+SN(e[0]),70,yy,44,'700','#fff','left',760); txt(cv,'×'+e[1],1010,yy,44,'700','rgba(255,255,255,.8)','right'); yy+=64; }); }
  yy+=14;
  if(d.big){ txt(cv,'🏆 '+T('Μεγαλύτερο: ','Biggest: ')+d.big.kg+' kg'+(d.big.species?' · '+SN(d.big.species):''),70,yy,36,'600','#fff','left',940); yy+=56; }
  if(d.month) txt(cv,T('Καλύτερος μήνας: ','Best month: ')+MON[+d.month-1],70,yy,34,'600','rgba(255,255,255,.85)','left',940), yy+=54;
  if(d.cost>0&&d.fish) txt(cv,T('Κόστος: ','Cost: ')+money(d.cost)+'  ·  '+money(d.cost/d.fish)+T(' ανά ψάρι',' per fish'),70,yy,32,'600','rgba(255,255,255,.75)','left',940);
  foot(cv); return Promise.resolve(cv);
}

/* ---------- προεπισκόπηση / κοινοποίηση ---------- */
var ov=el('div','cdov'); ov.hidden=true; document.body.appendChild(ov);
ov.innerHTML='<div class="cdcard"><div class="cdimg"></div><div class="cdbtn"><button type="button" class="cdsh"></button><button type="button" class="cdsv"></button><button type="button" class="cdx"></button></div></div>';
var cur=null;
ov.querySelector('.cdsh').textContent=T('Κοινοποίηση','Share'); ov.querySelector('.cdsv').textContent=T('Αποθήκευση','Save'); ov.querySelector('.cdx').textContent=T('Κλείσιμο','Close');
ov.querySelector('.cdx').addEventListener('click',function(){ ov.hidden=true; });
ov.addEventListener('click',function(e){ if(e.target===ov) ov.hidden=true; });
function blobOf(cv){ return new Promise(function(r){ cv.c.toBlob(r,'image/png'); }); }
ov.querySelector('.cdsv').addEventListener('click',function(){ if(!cur) return; blobOf(cur.cv).then(function(b){ var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=cur.name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500); }); });
ov.querySelector('.cdsh').addEventListener('click',function(){
  if(!cur) return; var c0=cur;
  blobOf(c0.cv).then(function(b){
    var f=new File([b],c0.name,{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[f]})) return navigator.share({files:[f],title:'Alkyon',text:c0.text}).catch(function(){});
    ov.querySelector('.cdsv').click(); C.toast(T('Η κοινοποίηση αρχείων δεν υποστηρίζεται εδώ. Η εικόνα αποθηκεύτηκε.','File sharing is not supported here. Image saved.'));
  });
});
function preview(p,name,text){
  Promise.resolve(p).then(function(cv){
    cur={cv:cv,name:name,text:text}; var box=ov.querySelector('.cdimg'); box.replaceChildren(); var im=new Image(); im.alt=''; im.src=cv.c.toDataURL('image/png'); box.appendChild(im); ov.hidden=false;
  }).catch(function(){ C.toast(T('Δεν δημιουργήθηκε η κάρτα.','Could not create the card.')); });
}

/* ---------- περίληψη εξόδου και κόστος ---------- */
var sov=el('div','cdov sumov'); sov.hidden=true; document.body.appendChild(sov);
function field(lab,id,val){ var l=el('label','sumf'); l.append(el('span','',lab)); var i=el('input'); i.type='number'; i.inputMode='decimal'; i.min='0'; i.step='0.01'; i.id=id; i.placeholder='0'; if(val) i.value=val; l.append(i); return l; }
function openSum(id,edit){
  var t=(C.Store.raw('trips')||[]).find(function(x){ return x.id===id; }); if(!t) return;
  var s=tripStats(t), c=t.cost||{}; sov.replaceChildren();
  var card=el('div','cdcard sumcard'); card.append(el('h3','',edit?T('Κόστος εξόδου','Trip cost'):T('Τέλος εξόδου','Trip finished')));
  card.append(el('p','sumsub',[dmy(t.date),t.spot].filter(Boolean).join(' · ')));
  var g=el('div','sumgrid');
  [[s.ms?fmtDur(s.ms):'–',T('Διάρκεια','Duration')],[String(s.fish),T('Ψάρια','Fish')],[(Math.round(s.kg*10)/10)+' kg',T('Βάρος','Weight')],[String(s.miss),T('Χάθηκαν','Lost')],[s.km&&U?U.dist(s.km):'–',T('Απόσταση','Distance')],[SN(t.species)||'–',T('Κύριο είδος','Top species')]].forEach(function(e){ var d=el('div','sumst'); d.append(el('b','',e[0]),el('span','',e[1])); g.append(d); });
  card.append(g);
  card.append(el('div','sumlab',T('Κόστος εξόδου (προαιρετικά)','Trip cost (optional)')));
  var fr=el('div','sumfs'); fr.append(field(T('Καύσιμα €','Fuel €'),'scFuel',c.fuel),field(T('Δολώματα €','Bait €'),'scBait',c.bait),field(T('Άλλα €','Other €'),'scOther',c.other)); card.append(fr);
  var ct=el('div','sumtot'); card.append(ct);
  function tot(){ var v=(+$('scFuel').value||0)+(+$('scBait').value||0)+(+$('scOther').value||0); ct.textContent=v>0?(T('Σύνολο ','Total ')+money(v)+(s.fish?' · '+money(v/s.fish)+T(' ανά ψάρι',' per fish'):'')):''; }
  fr.addEventListener('input',tot);
  var bt=el('div','cdbtn'); var bs=el('button','',T('Αποθήκευση','Save')); bs.type='button'; bs.className='acc';
  var bc=el('button','',T('Κάρτα εξόδου','Trip card')); bc.type='button';
  var bx=el('button','',T('Κλείσιμο','Close')); bx.type='button';
  function save(){ var f=+$('scFuel').value||0, b=+$('scBait').value||0, o=+$('scOther').value||0; var nt=Object.assign({},t,{cost:(f||b||o)?{fuel:f,bait:b,other:o}:undefined}); if(!(f||b||o)) delete nt.cost; return C.Store.save('trips',nt).then(function(){ t=nt; }); }
  bs.addEventListener('click',function(){ save().then(function(){ sov.hidden=true; C.toast(T('Αποθηκεύτηκε.','Saved.')); }); });
  bc.addEventListener('click',function(){ save().then(function(){ preview(tripCard(t),'alkyon-trip.png',T('Η έξοδός μου στο Alkyon','My trip on Alkyon')); }); });
  bx.addEventListener('click',function(){ sov.hidden=true; });
  bt.append(bs,bc,bx); card.append(bt); sov.append(card); tot(); sov.hidden=false;
}
window.addEventListener('alkyon-tripend',function(e){ if(e.detail&&e.detail.id) setTimeout(function(){ openSum(e.detail.id,false); },700); });

/* ---------- διακόσμηση λιστών (κουμπιά ανά στοιχείο) ---------- */
function addBtn(acts,txt,fn){ var b=el('button','btn ghost sm',txt); b.type='button'; b.addEventListener('click',fn); acts.insertBefore(b,acts.firstChild); }
function decorate(){
  Array.prototype.forEach.call(document.querySelectorAll('#biteList .item[data-bid]'),function(it){
    var a=it.querySelector('.acts'); if(!a||a.dataset.cx) return; a.dataset.cx='1'; var id=it.getAttribute('data-bid');
    addBtn(a,T('Κάρτα','Card'),function(){ var b=C.Store.get('bites').find(function(x){ return x.id===id; }); if(b) preview(fishCard(b),'alkyon-fish.png',(SN(b.species)||T('Ψάρι','Fish'))+(b.kg?' '+b.kg+' kg':'')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('#tripList .item[data-tid]'),function(it){
    var a=it.querySelector('.acts'); if(!a||a.dataset.cx) return; a.dataset.cx='1'; var id=it.getAttribute('data-tid');
    var t=(C.Store.raw('trips')||[]).find(function(x){ return x.id===id; }); if(!t) return;
    addBtn(a,T('Κόστος','Cost'),function(){ openSum(id,true); });
    Array.prototype.forEach.call(a.querySelectorAll('button'),function(x){ if(/^(Διαδρομή|Route)$/.test(x.textContent)) x.remove(); });
    addBtn(a,T('Στον χάρτη','Show on map'),function(){ var t3=(C.Store.raw('trips')||[]).find(function(x){ return x.id===id; }); if(t3&&C.reviewTrip) C.reviewTrip(t3); });
    addBtn(a,T('Κάρτα','Card'),function(){ var t2=(C.Store.raw('trips')||[]).find(function(x){ return x.id===id; }); if(t2) preview(tripCard(t2),'alkyon-trip.png',T('Η έξοδός μου στο Alkyon','My trip on Alkyon')); });
    var cs=costOf(t); if(cs>0){ var m=it.querySelector('.meta'); if(m){ var n=el('div','meta',T('Κόστος ','Cost ')+money(cs)+(+t.count?' · '+money(cs/+t.count)+T(' ανά ψάρι',' per fish'):'')); m.parentNode.insertBefore(n,m.nextSibling); } }
  });
  Array.prototype.forEach.call(document.querySelectorAll('#spotList .item[data-sid]'),function(it){
    var a=it.querySelector('.acts'); if(!a||a.dataset.cx) return; a.dataset.cx='1'; var id=it.getAttribute('data-sid');
    addBtn(a,T('Στείλε','Send'),function(){ var sp=C.Store.get('spots').find(function(x){ return x.id===id; }); if(sp) shareSpots([sp]); });
  });
}
var dt=null; function later(){ clearTimeout(dt); dt=setTimeout(decorate,30); }
['biteList','tripList','spotList'].forEach(function(id){ var n=$(id); if(n) new MutationObserver(later).observe(n,{childList:true}); });
decorate();

/* ---------- χρονιά ---------- */
(function(){
  var pm=$('pMain'), ps=$('pStats'); if(!pm||!ps) return;
  var b=el('button','btn sm yrbtn',T('Η χρονιά μου','My year')); b.type='button';
  b.addEventListener('click',function(){ var y=+C.nicosiaToday().slice(0,4); preview(yearCard(y),'alkyon-'+y+'.png',T('Η χρονιά μου στο ψάρεμα','My fishing year')+' '+y); });
  ps.parentNode.insertBefore(b,ps.nextSibling);
})();

/* ---------- φωνητική καταγραφή ---------- */
function nrm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ς/g,'σ').replace(/[^\p{L}\p{N}\s.,]/gu,' ').replace(/\s+/g,' ').trim(); }
var NUM={ενα:1,εναν:1,μια:1,μιαν:1,δυο:2,τρια:3,τρεις:3,τεσσερα:4,τεσσερις:4,πεντε:5,εξι:6,επτα:7,εφτα:7,οκτω:8,οχτω:8,εννια:9,εννεα:9,δεκα:10,ενδεκα:11,δωδεκα:12,δεκατρια:13,δεκατεσσερα:14,δεκαπεντε:15,δεκαεξι:16,δεκαεφτα:17,δεκαεπτα:17,δεκαοχτω:18,δεκαοκτω:18,δεκαεννια:19,εικοσι:20,τριαντα:30,σαραντα:40,πενηντα:50,εξηντα:60,εβδομηντα:70,ογδοντα:80,ενενηντα:90,εκατο:100,διακοσια:200,τριακοσια:300,τετρακοσια:400,πεντακοσια:500,εξακοσια:600,εφτακοσια:700,επτακοσια:700,οχτακοσια:800,οκτακοσια:800,εννιακοσια:900,
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twenty:20,thirty:30,forty:40,fifty:50};
var HALF={εναμισι:1.5,δυομισι:2.5,τρισημισι:3.5,τεσσεριμισι:4.5,πενταμισι:5.5,εξιμισι:6.5,εφταμισι:7.5,οχταμισι:8.5,εννιαμισι:9.5};
function parseNums(text){
  var tk=nrm(text).split(' '), out=[];
  for(var i=0;i<tk.length;i++){
    var w=tk[i], v=null;
    if(/^\d+([.,]\d+)?$/.test(w)) v=parseFloat(w.replace(',','.'));
    else if(HALF[w]!=null) v=HALF[w];
    else if(NUM[w]!=null){
      v=NUM[w];
      while(i+1<tk.length&&NUM[tk[i+1]]!=null){ var nx=NUM[tk[i+1]], lo=(v%100===0)?100:(v%10===0&&v>=20)?10:0; if(!lo||nx>=lo) break; v+=nx; i++; }
    } else if(w==='μισο'||w==='μιση'||w==='half') v=0.5;
    if(v==null) continue;
    var u=tk[i+1]||'', un=null, j=i+1;
    if(/^(κιλ|kg|kilo)/.test(u)) un='kg'; else if(/^(γραμ|gram)/.test(u)) un='g'; else if(/^(εκατοστ|ποντ|cm|centim)/.test(u)) un='cm';
    if(un==='kg'&&tk[i+2]==='και'&&/^μισ/.test(tk[i+3]||'')){ v+=0.5; j=i+3; }
    if(un){ out.push({v:v,u:un}); i=j; }
  }
  return out;
}
var spIdx=null;
function speciesIndex(){
  if(spIdx) return spIdx; spIdx=[];
  var seen={};
  (window.SPECIES_DB||[]).forEach(function(e){
    var names=[]; if(e[0]) String(e[0]).split(/[\/,]/).forEach(function(x){ names.push(x.trim()); }); if(e[1]) names.push(e[1]);
    var disp=e[0]?String(e[0]).split('/')[0].trim():e[1];
    names.forEach(function(n){ var k=nrm(n); if(k.length<4||seen[k+'|'+disp]) return; seen[k+'|'+disp]=1; spIdx.push({k:k,disp:disp,la:e[2]});
      if(n===e[1]&&k.indexOf(' ')>0){ var lw=k.split(' ').pop(); if(lw.length>=5&&!seen[lw+'|'+disp]){ seen[lw+'|'+disp]=1; spIdx.push({k:lw,disp:disp,la:e[2]}); } } });
  });
  return spIdx;
}
function findSpecies(text){
  var t=nrm(text), toks=t.split(' '), best=null;
  speciesIndex().forEach(function(e){
    var ok=false, score=0;
    if(e.k.indexOf(' ')>=0){ ok=(' '+t+' ').indexOf(' '+e.k+' ')>=0; score=e.k.length; }
    else { var st=e.k.length>5?e.k.slice(0,e.k.length-2):e.k; ok=toks.some(function(w){ return w.length>=st.length&&w.indexOf(st)===0&&w.length<=e.k.length+3; }); score=st.length; }
    if(ok&&(!best||score>best.score)) best={disp:e.disp,la:e.la,score:score};
  });
  if(!best){ /* προσεγγιστική αντιστοίχιση για λάθη αναγνώρισης φωνής */
    var bd=9;
    speciesIndex().forEach(function(e){ if(e.k.indexOf(' ')>=0||e.k.length<5) return; toks.forEach(function(w){ if(w.length<5||Math.abs(w.length-e.k.length)>2) return;
      var lim=e.k.length<8?1:2, d=lev(w,e.k); if(d<=lim&&d<bd){ bd=d; best={disp:e.disp,la:e.la,score:e.k.length-d*2,fuzzy:true}; } }); });
  }
  return best;
}
function lev(a,b){ var m=a.length,n=b.length,p=[],i,j; for(j=0;j<=n;j++) p[j]=j; for(i=1;i<=m;i++){ var prev=p[0]; p[0]=i; for(j=1;j<=n;j++){ var t=p[j]; p[j]=Math.min(p[j]+1,p[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=t; } } return p[n]; }
function parseVoice(text){
  var r={species:null,kg:null,len:null,text:text}, sp=findSpecies(text); if(sp) r.species=sp;
  parseNums(text).forEach(function(n){ if(n.u==='kg'&&r.kg==null) r.kg=Math.round(n.v*100)/100; else if(n.u==='g'&&r.kg==null) r.kg=Math.round(n.v)/1000; else if(n.u==='cm'&&r.len==null) r.len=Math.round(n.v); });
  return r;
}
var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function vlang(){ var v=C.lsGet('alkyon-vlang',null); return v==='en-US'?'en-US':'el-GR'; }
function listen(cb){
  if(!SR){ C.toast(T('Η φωνητική καταγραφή δεν υποστηρίζεται σε αυτόν τον browser.','Voice input is not supported in this browser.')); return; }
  var rec=new SR(); rec.lang=vlang(); rec.interimResults=false; rec.maxAlternatives=3; var got=false;
  C.toast(T('Μίλα τώρα… π.χ. «συναγρίδα τρία κιλά»','Speak now… e.g. “dentex three kilos”'));
  rec.onresult=function(e){ got=true; var alts=[]; for(var i=0;i<e.results[0].length;i++) alts.push(e.results[0][i].transcript); cb(alts); };
  rec.onerror=function(e){ if(e.error==='not-allowed') C.toast(T('Δεν δόθηκε άδεια μικροφώνου.','Microphone permission denied.')); else if(e.error==='network') C.toast(T('Χρειάζεται σύνδεση στο ίντερνετ για αναγνώριση φωνής.','Voice recognition needs an internet connection.')); else if(e.error!=='aborted'&&e.error!=='no-speech') C.toast(T('Δεν κατάλαβα. Δοκίμασε ξανά.','Did not catch that. Try again.')); };
  rec.onend=function(){ if(!got) {} };
  try{ rec.start(); }catch(e){}
}
function best(alts){ var r=null; alts.forEach(function(a){ var p=parseVoice(a); var sc=(p.species?2:0)+(p.kg!=null?1:0)+(p.len!=null?1:0); if(!r||sc>r.sc){ r=p; r.sc=sc; } }); return r; }
function applyForm(r){
  var f=$('bSpecies'); if(r.species){ f.value=r.species.disp; f.dispatchEvent(new Event('input',{bubbles:true})); var s=document.querySelector('#bSug .sugi'); if(s) s.click(); else f.dispatchEvent(new Event('input',{bubbles:true})); }
  if(r.kg!=null){ $('bKg').value=r.kg; } if(r.len!=null){ $('bLen').value=r.len; }
  $('biteForm').dispatchEvent(new Event('input',{bubbles:true}));
}
var MIC='<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>';
/* μέσα στη φόρμα τσιμπήματος */
(function(){
  var f=$('biteForm'); if(!f) return; var b=el('button','btn ghost sm micform'); b.type='button'; b.innerHTML=MIC+'<span>'+T('Πες το','Say it')+'</span>';
  b.addEventListener('click',function(){ listen(function(alts){ var r=best(alts); if(!r||r.sc===0){ C.toast(T('Δεν βρέθηκε είδος ή βάρος. Άκουσα: ','No species or weight found. Heard: ')+alts[0]); return; } applyForm(r); C.toast(T('Συμπληρώθηκε. Έλεγξε και πάτα Αποθήκευση.','Filled in. Check and press Save.')); }); });
  f.insertBefore(b,f.firstChild);
})();
/* στα κουμπιά του χάρτη κατά την έξοδο: φωνή και άμεση καταγραφή μετά από επιβεβαίωση */
(function(){
  var w=$('fishBtns'); if(!w) return; var b=el('button','fb fbmic'); b.type='button'; b.id='fbMic'; b.setAttribute('aria-label',T('Φωνητική καταγραφή ψαριού','Voice catch log')); b.innerHTML=MIC;
  w.insertBefore(b,w.children[1]||null);
  b.addEventListener('click',function(){
    var t0=Date.now(); /* v31z366: η στιγμή που πάτησες το μικρόφωνο είναι η ώρα του ψαριού */
    listen(function(alts){
      /* v31z366: «χάθηκε», «έφυγε», «lost» → καταγραφή χαμένου τσιμπήματος αμέσως */
      if(alts.some(function(a){ return /χάθηκ|χαθηκ|έφυγ|εφυγ|ξεκαρφ|\blost\b|got away|missed/i.test(a); })&&C.quickMiss){ C.quickMiss(); C.toast(T('Καταγράφηκε χαμένο τσίμπημα.','Lost bite logged.')); return; }
      var r=best(alts); if(!r||r.sc===0){ C.toast(T('Δεν βρέθηκε είδος ή βάρος. Άκουσα: ','No species or weight found. Heard: ')+alts[0]); return; }
      r.t0=t0;
      if(!r.species){ window.AlkyonAsk(T('Άκουσα: «','Heard: “')+alts[0]+T('». Δεν αναγνώρισα το είδος.','”. I did not recognise the species.')+' '+T('Να ξαναπείς;','Try again?'),{title:T('Φωνητική καταγραφή','Voice log'),ok:T('Ξανά','Again'),cancel:T('Άκυρο','Cancel')}).then(function(ok){ if(ok) b.click(); }); return; }
      var msg=[r.species?SN(r.species.disp):T('Άγνωστο είδος','Unknown species'),r.kg!=null?r.kg+' kg':null,r.len!=null?r.len+' cm':null].filter(Boolean).join(' · ');
      window.AlkyonAsk(msg+'\n'+T('Άκουσα: «','Heard: “')+alts[0]+'”\n\n'+T('Να καταγραφεί ως ψάρι;','Log as a catch?'),{title:T('Φωνητική καταγραφή','Voice log'),ok:T('Καταγραφή','Log'),cancel:T('Άκυρο','Cancel')}).then(function(ok){
        if(!ok) return; $('fab').click();
        setTimeout(function(){ applyForm(r); try{ var tm=$('bWhen'); if(tm&&r.t0&&Date.now()-r.t0<30*60000){ var dd=new Date(r.t0+C.utcMin()*60000); tm.value=dd.toISOString().slice(0,16); tm.dispatchEvent(new Event('input',{bubbles:true})); } }catch(x){} setTimeout(function(){ try{ $('biteForm').requestSubmit(); }catch(e){ $('biteForm').querySelector('button[type=submit]').click(); } },450); },250);
      });
    });
  });
})();

/* ---------- κοινοποίηση σημείων ---------- */
function b64u(buf){ var s=''; var a=new Uint8Array(buf); for(var i=0;i<a.length;i++) s+=String.fromCharCode(a[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function unb64u(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; var b=atob(s), a=new Uint8Array(b.length); for(var i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; }
function enc(obj){
  var raw=new TextEncoder().encode(JSON.stringify(obj));
  if(typeof CompressionStream==='function'){
    var cs=new CompressionStream('deflate-raw'), w=cs.writable.getWriter(); w.write(raw); w.close();
    return new Response(cs.readable).arrayBuffer().then(function(b){ return 'z.'+b64u(b); });
  }
  return Promise.resolve('j.'+b64u(raw));
}
function dec(code){ return new Promise(function(res){ res(dec0(code)); }); }
function dec0(code){
  var kind=code.slice(0,2), data=unb64u(code.slice(2));
  if(kind==='z.'&&typeof DecompressionStream==='function'){
    var ds=new DecompressionStream('deflate-raw'), w=ds.writable.getWriter(); w.write(data); w.close();
    return new Response(ds.readable).arrayBuffer().then(function(b){ return JSON.parse(new TextDecoder().decode(b)); });
  }
  if(kind==='j.') return Promise.resolve(JSON.parse(new TextDecoder().decode(data)));
  return Promise.reject(new Error('format'));
}
function shareSpots(list){
  if(!list.length){ C.toast(T('Δεν υπάρχουν σημεία.','No spots to send.')); return; }
  var pl={v:1,s:list.slice(0,150).map(function(s){ return {n:s.name,t:s.type,la:+s.lat.toFixed(5),lo:+s.lon.toFixed(5),d:s.depth,no:s.notes}; })};
  enc(pl).then(function(code){
    var url=location.origin+location.pathname+'#share='+code, title=list.length===1?list[0].name:list.length+T(' σημεία ψαρέματος',' fishing spots');
    var txt=T('Σημεία ψαρέματος από το Alkyon: ','Fishing spots from Alkyon: ')+title+'\n'+T('Άνοιξε τον σύνδεσμο για να τα προσθέσεις στην εφαρμογή σου.','Open the link to add them to your app.');
    if(navigator.share) navigator.share({title:'Alkyon',text:txt,url:url}).catch(function(){});
    else if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt+'\n'+url).then(function(){ C.toast(T('Ο σύνδεσμος αντιγράφηκε.','Link copied.')); });
    else window.prompt(T('Αντίγραψε τον σύνδεσμο','Copy the link'),url);
  }).catch(function(){ C.toast(T('Δεν δημιουργήθηκε σύνδεσμος.','Could not build the link.')); });
}
function clip(s,n){ return String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').slice(0,n); }
function importShare(){
  var m=/^#share=([A-Za-z0-9_.\-]+)$/.exec(location.hash||''); if(!m) return;
  var code=m[1]; try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  dec(code).then(function(pl){
    var list=(pl&&pl.v===1&&Array.isArray(pl.s)?pl.s:[]).slice(0,150).map(function(s){
      var la=+s.la, lo=+s.lo; if(!isFinite(la)||!isFinite(lo)||Math.abs(la)>90||Math.abs(lo)>180) return null;
      var d=s.d==null||s.d===''?null:+s.d; return {name:clip(s.n,60)||T('Σημείο','Spot'),type:clip(s.t,40),lat:la,lon:lo,depth:isFinite(d)?d:null,notes:clip(s.no,400)};
    }).filter(Boolean);
    if(!list.length){ C.toast(T('Ο σύνδεσμος δεν περιέχει σημεία.','The link has no spots.')); return; }
    var have=C.Store.get('spots'), fresh=list.filter(function(n){ return !have.some(function(h){ return Math.abs(h.lat-n.lat)<0.0003&&Math.abs(h.lon-n.lon)<0.0003; }); });
    if(!fresh.length){ C.toast(T('Έχεις ήδη αυτά τα σημεία.','You already have these spots.')); return; }
    var names=fresh.slice(0,6).map(function(s){ return '• '+s.name; }).join('\n')+(fresh.length>6?'\n…':'');
    window.AlkyonAsk(T('Κάποιος μοιράστηκε ','Someone shared ')+fresh.length+T(' σημεία μαζί σου:\n\n',' spots with you:\n\n')+names+'\n\n'+T('Να προστεθούν στα σημεία σου;','Add them to your spots?'),{title:T('Σημεία από φίλο','Spots from a friend'),ok:T('Προσθήκη','Add'),cancel:T('Όχι','No')}).then(function(ok){
      if(!ok) return; var p=Promise.resolve();
      fresh.forEach(function(s){ p=p.then(function(){ return C.Store.save('spots',Object.assign({},s,{notes:(s.notes?s.notes+' ':'')+T('(από φίλο)','(from a friend)')})); }); });
      p.then(function(){ C.toast(fresh.length+T(' σημεία προστέθηκαν.',' spots added.')); try{ C.switchTab('map'); }catch(e){} });
    });
  }).catch(function(){ C.toast(T('Ο σύνδεσμος δεν είναι έγκυρος.','The link is not valid.')); });
}
(function(){
  var sn=$('sNew'); if(!sn) return; var b=el('button','btn',T('Στείλε όλα τα σημεία','Send all spots')); b.type='button';
  b.addEventListener('click',function(){ shareSpots(C.Store.get('spots')); }); sn.parentNode.appendChild(b);
})();
setTimeout(importShare,1500); window.addEventListener('hashchange',function(){ setTimeout(importShare,300); });

/* v31z370: η γλώσσα φωνητικής καταγραφής ρυθμίζεται μόνο στο Profile › Τύπος ψαρέματος (ήταν διπλή εδώ). */
/* v31z351: «Ψάρια/Σημεία στον χάρτη» υπάρχουν μόνο στα Στρώματα (ήταν διπλά εδώ). */
window.AlkyonCards={fish:function(b){ preview(fishCard(b),'alkyon-fish.png',''); },trip:function(t){ preview(tripCard(t),'alkyon-trip.png',''); },year:function(y){ preview(yearCard(y),'alkyon-'+y+'.png',''); },sum:openSum,parse:parseVoice,yearData:yearData,enc:enc,dec:dec,importShare:importShare};
window.AlkyonVoice={parse:parseVoice};
})();
