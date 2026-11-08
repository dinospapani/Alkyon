/* Alkyon 4 · κάρτες κοινοποίησης (ψάρι, έξοδος, χρονιά), κόστος εξόδου, φωνητική καταγραφή, κοινοποίηση σημείων.
   Οι συναρτήσεις σχεδίασης και ανάλυσης φωνής είναι ίδιες με της κλασικής (cards.js). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, U=window.AlkyonUnits;
var SN=function(n){ return window.spName?window.spName(n):n; };
var FONT='-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
/* προσαρμογή στα ονόματα που περιμένει ο κώδικας της κλασικής */
var C={Photos:{get:function(id){ return B.store.Photos.get(id); }},
  Store:{get:function(k){ return B.store.raw(k).filter(function(x){ return !x.deleted; }); },act:function(){ return B.store.bites().filter(function(x){ return !x.deleted; }); }},
  bc:function(b){ return Math.max(1,Math.floor(+b.cnt)||1); }};
C.Store.misses=function(){ return B.store.misses(); };
window.AlkyonTackle=window.AlkyonTackle||{names:function(){ var o={}; B.store.raw('tackle').forEach(function(x){ o[x.id]=x.name||''; }); return o; }};
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
  /* v31z550: πόσα («τρία λαβράκια», «2 σαργοί», «ζευγάρι»), δόλωμα («με γαρίδα»), απελευθέρωση («το άφησα») */
  var c=voiceCount(text); if(c>1&&c<500) r.cnt=c;
  var bm=nrm(text).match(/(?:^| )(?:με|στο|στη|στην|with|on|using) (?:το |τη |την |ενα |μια |a |an |the )?([a-zα-ω]+(?: [a-zα-ω]+)?)/);
  if(bm){ var bw=bm[1].split(' ')[0]; if(BAITW.some(function(x){ return bw.indexOf(x)===0; })){ var want=bm[1].replace(/ (και|and|στα|στο|κιλ\S*|γραμ\S*)$/,'').trim().split(' '), orig=String(text).split(/\s+/), out=[];
      for(var oi=0;oi<orig.length&&out.length<want.length;oi++){ var on=nrm(orig[oi]); if(on===want[out.length]) out.push(orig[oi].replace(/[.,!?;]+$/,'')); else if(out.length) out=[]; }
      var bt=(out.length===want.length?out.join(' '):want.join(' ')); r.bait=bt.charAt(0).toUpperCase()+bt.slice(1); } }
  if(/αφησα|αφεθηκε|πισω στη θαλασσα|απελευθερ|released|let (it|him) go|catch and release/.test(nrm(text))) r.rel=true;
  return r;
}
var BAITW=['γαριδ','καλαμαρ','σουπι','χταπ','σκουληκ','σαρδελ','γαυρ','κουρκουρ','μαριδ','ζωντανο','ζωντανη','τεχνητ','τζιγκ','jig','ψαρακι','πλανο','καβουρ','μυδ','πεταλιδ','αχιβαδ','ψωμ','καλαμποκ','σιτ','κρεατ','σκουμπρ','κολι','λουκανικ','shrimp','squid','worm','sardine','lure','bread','corn','crab','pellet','bolentin','rapala','σιλικον','ψαλιδ','popper','πομπερ','minnow'];
function voiceCount(text){ var tk=nrm(text).split(' ');
  if(/ζευγαρι|ζευγος|couple of|pair of/.test(nrm(text))) return 2;
  for(var i=0;i<tk.length;i++){ var w=tk[i], v=null;
    if(/^\d+$/.test(w)) v=+w; else if(NUM[w]!=null&&NUM[w]>=2) v=NUM[w];
    if(v==null) continue; var nx=tk[i+1]||'';
    if(/^(κιλ|kg|kilo|γραμ|gram|εκατοστ|ποντ|cm|centim|και|and|μισ|half|μετρ|meter|οργι|λεπτ|minut|ωρ|hour)/.test(nx)) continue;
    return v; }
  return 0; }
var PESTV=/λαγοκεφαλ|λαγοκ|toadfish|pufferfish|puffer|εφαγε το δολωμα|φαγανε το δολωμα|μου φαγαν|bait stolen|took the bait|stole the bait|εκοψε|κοψανε|cut the line|bit off/;
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
  if(!list.length){ B.toast(T('Δεν υπάρχουν σημεία.','No spots to send.')); return; }
  var pl={v:1,s:list.slice(0,150).map(function(s){ return {n:s.name,t:s.type,la:+s.lat.toFixed(5),lo:+s.lon.toFixed(5),d:s.depth,no:s.notes}; })};
  enc(pl).then(function(code){
    var url=new URL('./',location.href).href+'#share='+code, title=list.length===1?list[0].name:list.length+T(' σημεία ψαρέματος',' fishing spots');
    var txt=T('Σημεία ψαρέματος από το Alkyon: ','Fishing spots from Alkyon: ')+title+'\n'+T('Άνοιξε τον σύνδεσμο για να τα προσθέσεις στην εφαρμογή σου.','Open the link to add them to your app.');
    if(navigator.share) navigator.share({title:'Alkyon',text:txt,url:url}).catch(function(){});
    else if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt+'\n'+url).then(function(){ B.toast(T('Ο σύνδεσμος αντιγράφηκε.','Link copied.')); });
    else window.prompt(T('Αντίγραψε τον σύνδεσμο','Copy the link'),url);
  }).catch(function(){ B.toast(T('Δεν δημιουργήθηκε σύνδεσμος.','Could not build the link.')); });
}
function clip(s,n){ return String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').slice(0,n); }

/* ---------- προεπισκόπηση / κοινοποίηση ---------- */
function blobOf(cv){ return new Promise(function(r){ cv.c.toBlob(r,'image/png'); }); }
function save(cv,name){ return blobOf(cv).then(function(b){ var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500); }); }
function preview(p,name,text){
  Promise.resolve(p).then(function(cv){
    var im=h('img',{class:'cdimg',alt:T('Προεπισκόπηση κάρτας','Card preview'),src:cv.c.toDataURL('image/png')});
    var body=h('div',{class:'det'},im,h('div',{class:'acts'},
      h('button',{class:'btn pri',type:'button',text:T('Κοινοποίηση','Share'),onclick:function(){ blobOf(cv).then(function(b){ var f=new File([b],name,{type:'image/png'});
        if(navigator.canShare&&navigator.canShare({files:[f]})) return navigator.share({files:[f],title:'Alkyon',text:text||''}).catch(function(){});
        return save(cv,name).then(function(){ B.toast(T('Η κοινοποίηση αρχείων δεν υποστηρίζεται εδώ. Η εικόνα αποθηκεύτηκε.','File sharing is not supported here. Image saved.')); }); }); }}),
      h('button',{class:'btn',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ save(cv,name); }})));
    B.sheet({title:T('Κάρτα','Card'),body:body});
  }).catch(function(){ B.toast(T('Δεν δημιουργήθηκε η κάρτα.','Could not create the card.')); });
}

/* ---------- κόστος εξόδου ---------- */
function costSheet(t,done){
  var c=t.cost||{}, F=[['fuel',T('Καύσιμα (€)','Fuel (€)')],['bait',T('Δολώματα (€)','Bait (€)')],['other',T('Άλλα (€)','Other (€)')]], ins={};
  var f=h('form',{class:'bform',novalidate:true});
  F.forEach(function(x){ ins[x[0]]=h('input',{type:'number',inputmode:'decimal',min:'0',step:'0.01',placeholder:'0',value:c[x[0]]?String(c[x[0]]):''}); f.append(h('label',{class:'fld'},h('span',{text:x[1]}),ins[x[0]])); });
  var s=tripStats(t); if(s.fish||s.kg) f.append(h('p',{class:'sub',text:T('Το κόστος ανά ψάρι και ανά κιλό φαίνεται στη λεπτομέρεια της εξόδου.','Cost per catch and per kilo shows in the trip details.')}));
  f.append(h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση','Save')}));
  f.addEventListener('submit',function(ev){ ev.preventDefault(); var v={fuel:+ins.fuel.value||0,bait:+ins.bait.value||0,other:+ins.other.value||0}, nt=Object.assign({},t);
    if(v.fuel||v.bait||v.other) nt.cost=v; else delete nt.cost; B.store.save('trips',nt); sh.close(); B.toast(T('Αποθηκεύτηκε.','Saved.')); if(done) done(nt); });
  var sh=B.sheet({title:T('Κόστος εξόδου','Trip cost'),body:f,focus:'input'});
}

/* ---------- φωνή ---------- */
var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function vlang(){ var v=B.ls.get('alkyon-vlang',null); return v==='en-US'||v==='el-GR'?v:(EN?'en-US':'el-GR'); }
/* 1.9.68: η αναγνώριση στο ίδιο το κινητό (SpeechRecognition.available/processLocally) ΔΕΝ χρησιμοποιείται: στη δοκιμή έριχνε
   ολόκληρη τη σελίδα του Chromium. Χωρίς σήμα → ψάρι + ηχογράφηση (offlineLog). */
var LOCAL=false; function localInstall(){}
function offline(){ return navigator.onLine===false; }
function listen(cb,fallback){ if(B.voiceCmd&&B.voiceCmd.pause) B.voiceCmd.pause(8000);
  if(!SR){ if(fallback){ fallback('nosr'); return; } B.toast(T('Η φωνητική καταγραφή δεν υποστηρίζεται σε αυτόν τον browser.','Voice input is not supported in this browser.')); return; }
  if(offline()&&!LOCAL&&fallback){ fallback('offline'); return; }
  var rec=new SR(); rec.lang=vlang(); rec.interimResults=false; rec.maxAlternatives=3; if(LOCAL) try{ rec.processLocally=true; }catch(e){}
  B.toast(T('Μίλα τώρα… π.χ. «συναγρίδα τρία κιλά»','Speak now… e.g. “dentex three kilos”'));
  rec.onresult=function(e){ var alts=[]; for(var i=0;i<e.results[0].length;i++) alts.push(e.results[0][i].transcript); cb(alts); };
  rec.onerror=function(e){ if(e.error==='not-allowed') B.toast(T('Δεν δόθηκε άδεια μικροφώνου.','Microphone permission denied.')); else if(e.error==='network'&&fallback) fallback('network'); else if(e.error==='language-not-supported'&&LOCAL){ LOCAL=false; B.toast(T('Δοκίμασε ξανά.','Try again.')); } else if(e.error==='network') B.toast(T('Χρειάζεται σύνδεση στο ίντερνετ για αναγνώριση φωνής.','Voice recognition needs an internet connection.')); else if(e.error!=='aborted'&&e.error!=='no-speech') B.toast(T('Δεν κατάλαβα. Δοκίμασε ξανά.','Did not catch that. Try again.')); };
  try{ rec.start(); }catch(e){}
}
function best(alts){ var r=null; alts.forEach(function(a){ var p=parseVoice(a); var sc=(p.species?2:0)+(p.kg!=null?1:0)+(p.len!=null?1:0); if(!r||sc>r.sc){ r=p; r.sc=sc; } }); return r; }
var LOST=/χάθηκ|χαθηκ|έφυγ|εφυγ|ξεκαρφ|\blost\b|got away|missed/i;
/* στη φόρμα: συμπληρώνει είδος, κιλά, εκατοστά */
function voiceFill(fill){ listen(function(alts){ var r=best(alts); if(!r||r.sc===0){ B.toast(T('Δεν βρέθηκε είδος ή βάρος. Άκουσα: ','No species or weight found. Heard: ')+alts[0]); return; } fill(r); B.toast(T('Συμπληρώθηκε. Έλεγξε και πάτα Αποθήκευση.','Filled in. Check and press Save.')); }); }
/* ---------- 1.9.68: φωνητική σημείωση χωρίς σήμα (το ψάρι γράφεται αμέσως, η ηχογράφηση μένει στο κινητό) ---------- */
var ADB=null;
function adb(){ return ADB||(ADB=new Promise(function(res,rej){ try{ var r=indexedDB.open('alkyon-audio',1); r.onupgradeneeded=function(){ r.result.createObjectStore('a'); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; }catch(e){ rej(e); } })); }
function aPut(id,blob){ return adb().then(function(db){ return new Promise(function(res,rej){ var t=db.transaction('a','readwrite'); t.objectStore('a').put(blob,id); t.oncomplete=function(){ res(true); }; t.onerror=function(){ rej(t.error); }; }); }); }
function aGet(id){ return adb().then(function(db){ return new Promise(function(res){ var t=db.transaction('a','readonly'), q=t.objectStore('a').get(id); q.onsuccess=function(){ res(q.result||null); }; q.onerror=function(){ res(null); }; }); }).catch(function(){ return null; }); }
function aDel(id){ return adb().then(function(db){ db.transaction('a','readwrite').objectStore('a').delete(id); }).catch(function(){}); }
B.vnote={get:aGet,put:aPut,del:aDel};
function recordNote(id,secs){ secs=secs||8; if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){ return; }
  var body=h('div',{class:'bform vnrec'}), lab=h('p',{class:'vnt',text:T('🎙 Μίλα τώρα: είδος, βάρος, δόλωμα…','🎙 Speak now: species, weight, bait…')}), cnt=h('b',{class:'vnc',text:String(secs)}), sh, mr=null, chunks=[], tm=null, left=secs, stream=null;
  function stop(){ clearInterval(tm); try{ if(mr&&mr.state!=='inactive') mr.stop(); }catch(e){} }
  body.append(lab,cnt,h('button',{class:'btn pri full',type:'button',text:T('Τέλος','Done'),onclick:stop}));
  sh=B.sheet({title:T('Φωνητική σημείωση','Voice note'),body:body});
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){ stream=st; try{ mr=new MediaRecorder(st); }catch(e){ sh.close(); return; }
    mr.ondataavailable=function(e){ if(e.data&&e.data.size) chunks.push(e.data); };
    mr.onstop=function(){ try{ stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} var blob=new Blob(chunks,{type:mr.mimeType||'audio/webm'}); if(!blob.size){ sh.close(); return; }
      aPut(id,blob).then(function(){ var S=B.store, cur=S.get('bites',id); if(cur){ S.save('bites',Object.assign({},cur,{vnote:1})); B.emit('store','alkyon-bites'); } B.toast(T('Η σημείωση κρατήθηκε. Άκουσέ την από το Ημερολόγιο και συμπλήρωσε το είδος.','Note saved. Play it from the Logbook and add the species.')); }).catch(function(){}); sh.close(); };
    mr.start(); tm=setInterval(function(){ left--; cnt.textContent=String(Math.max(0,left)); if(left<=0) stop(); },1000); })
    .catch(function(){ sh.close(); B.toast(T('Δεν δόθηκε άδεια μικροφώνου.','Microphone permission denied.')); }); }
B.vnoteRecord=recordNote;
/* χωρίς σήμα: γράφει αμέσως ψάρι (θέση, ώρα, συνθήκες) και ηχογράφηση για να το συμπληρώσεις μετά */
function offlineLog(why){ if(!B.quickRec) return; var id=B.quickRec(false,null,null,true); try{ if(B.say) B.say(T('Χωρίς σήμα. Έγραψα το ψάρι, πες μου τι είναι.','No signal. Catch logged, tell me what it is.'),null,'vno',0); }catch(e){}
  B.toast(T('Χωρίς σήμα: το ψάρι γράφτηκε. Πες είδος και βάρος για ηχογράφηση.','No signal: catch logged. Say species and weight to record a note.')); setTimeout(function(){ recordNote(id,8); },900); return id; }
B.voiceOffline=offlineLog;
/* ---------- 1.9.68: φωνητικές ερωτήσεις («πόσα ψάρια;», «πόσο αέρα;», «τι ώρα δύει;», «πόσο μακριά το λιμάνι;») ---------- */
function here(){ var f=(B.trip&&B.trip.fix&&B.trip.fix())||(B.lastPos&&B.lastPos()); return f&&f.lat!=null?f:null; }
function hm(min){ min=((Math.round(min)%1440)+1440)%1440; return B.pad(Math.floor(min/60))+':'+B.pad(min%60); }
function durTxt(m){ m=Math.max(0,Math.round(m)); var hh=Math.floor(m/60), mm=m%60; return EN?((hh?hh+' h ':'')+mm+' min'):((hh?hh+(hh===1?' ώρα':' ώρες')+(mm?' και ':''):'')+(mm||!hh?mm+' λεπτά':'')); }
function tripFish(){ var sf=B.ls.get('alkyon-safe',{})||{}, all=B.store.raw('bites').filter(function(b){ return !b.deleted; }), td=new Date(), d=td.getFullYear()+'-'+B.pad(td.getMonth()+1)+'-'+B.pad(td.getDate());
  var bs=sf.active&&sf.id?all.filter(function(b){ return b.trip===sf.id; }):all.filter(function(b){ return b.date===d; }); var f=bs.filter(function(b){ return !b.miss&&!(B.pest&&B.pest(b)); }), n=f.reduce(function(s2,b){ return s2+Math.max(1,Math.floor(+b.cnt)||1); },0), kg=f.reduce(function(s2,b){ return s2+(+b.kg||0); },0), mi=bs.filter(function(b){ return b.miss; }).length; return {n:n,kg:kg,miss:mi,trip:!!(sf.active&&sf.id)}; }
var Q=[
  ['sunset',/(δυει|δυση|βραδιαζει|σκοτειναζει|ηλιοβασιλεμα|sunset|dark)/],
  ['fish',/(ποσα ψαρια|ποσα εχουμε|ποσα πιασαμε|ποσα επιασα|how many fish|how many have)/],
  ['wind',/(ποσο αερα|ποσος αερας|τι αερα|τι αερας|αερα εχει|ανεμο|ποσα μποφορ|how much wind|what.?s the wind|wind)/],
  ['wave',/(ποσο κυμα|τι κυμα|κυμα εχει|θαλασσα εχει|how big are the waves|waves)/],
  ['water',/(θερμοκρασια νερου|ποσο ειναι το νερο|ζεστο το νερο|water temp)/],
  ['home',/(λιμανι|ποσο μακρια|ποσο απεχει|για σπιτι|how far|home|harbou?r|port)/],
  ['time',/(τι ωρα ειναι|τι ωρα εχουμε|what time is it)/]];
function qOf(t){ var x=nrm(t); for(var i=0;i<Q.length;i++) if(Q[i][1].test(x)) return Q[i][0]; return null; }
function fcNow(p){ if(!p||!window.PF||!PF.getForecast) return Promise.resolve(null); return PF.getForecast(+p.lat,+p.lon,null,{days:2}).then(function(fc){ var now=fc.nowLocal.slice(0,13), hs=[]; (fc.days||[]).forEach(function(d){ hs=hs.concat(d.hours||[]); }); return hs.filter(function(x){ return x.t.slice(0,13)===now; })[0]||null; }).catch(function(){ return null; }); }
function answer(kind){ var p=here(), say=function(txt){ B.toast('🔊 '+txt); try{ if(B.say) B.say(txt,null,'vq'+kind,0); }catch(e){} return txt; };
  if(kind==='time'){ var d=new Date(); return Promise.resolve(say(T('Η ώρα είναι ','It is ')+B.pad(d.getHours())+':'+B.pad(d.getMinutes()))); }
  if(kind==='fish'){ var f=tripFish(); return Promise.resolve(say(f.n?((f.trip?T('Σε αυτή την έξοδο: ','This trip: '):T('Σήμερα: ','Today: '))+f.n+T(f.n===1?' ψάρι':' ψάρια',f.n===1?' fish':' fish')+(f.kg?T(', ',', ')+(Math.abs(f.kg-Math.round(f.kg))<0.05?String(Math.round(f.kg)):B.num(f.kg,1))+T(' κιλά',' kg'):'')+(f.miss?T(' και ',' and ')+f.miss+T(' χαμένα',' lost'):'')):T('Κανένα ψάρι ακόμα.','No fish yet.'))); }
  if(kind==='sunset'){ if(!p||!window.PF||!PF.sunMoon) return Promise.resolve(say(T('Δεν ξέρω τη θέση σου.','I do not know your position.'))); var d2=new Date(), ds=d2.getFullYear()+'-'+B.pad(d2.getMonth()+1)+'-'+B.pad(d2.getDate()), sm=PF.sunMoon(ds,+p.lat,+p.lon,-d2.getTimezoneOffset()), nowM=d2.getHours()*60+d2.getMinutes();
    if(sm.set==null) return Promise.resolve(say(T('Δεν βρήκα ώρα δύσης.','No sunset time found.'))); return Promise.resolve(say(sm.set>nowM?T('Ο ήλιος δύει στις ','Sunset at ')+hm(sm.set)+T(', σε ',', in ')+durTxt(sm.set-nowM)+'.':T('Ο ήλιος έδυσε στις ','The sun set at ')+hm(sm.set)+'.')); }
  if(kind==='home'){ var sm2=B.smart&&B.smart.state&&B.smart.state(), hmz=sm2&&sm2.home; if(!hmz||hmz.lat==null) return Promise.resolve(say(T('Δεν έχεις ορίσει λιμάνι.','No home port set.'))); if(!p) return Promise.resolve(say(T('Δεν ξέρω τη θέση σου.','I do not know your position.')));
    var dy=(hmz.lat-p.lat)*60, dx=(hmz.lon-p.lon)*60*Math.cos(p.lat*Math.PI/180), nm=Math.sqrt(dx*dx+dy*dy), kn=+(sm2.cruise||hmz.kn)||15; return Promise.resolve(say((hmz.name||T('Το λιμάνι','The port'))+T(': ',': ')+B.num(nm,1)+T(' ναυτικά μίλια, περίπου ',' nautical miles, about ')+durTxt(nm/kn*60)+T(' με ',' at ')+Math.round(kn)+T(' κόμβους.',' knots.'))); }
  return fcNow(p).then(function(x){ if(!x) return say(T('Δεν έχω πρόγνωση για εδώ.','No forecast for here.'));
    if(kind==='wind') return say(T('Άνεμος ','Wind ')+Math.round(x.wind||0)+T(' κόμβοι',' knots')+(x.gust!=null?T(', ριπές ',', gusts ')+Math.round(x.gust):'')+(x.wave!=null?T(', κύμα ',', waves ')+B.num(x.wave,1)+T(' μέτρα',' metres'):'')+'.');
    if(kind==='wave') return say(x.wave!=null?T('Κύμα ','Waves ')+B.num(x.wave,1)+T(' μέτρα',' metres')+(x.period?T(', περίοδος ',', period ')+Math.round(x.period)+T(' δευτερόλεπτα',' seconds'):'')+'.':T('Δεν έχω κύμα για εδώ.','No wave data here.'));
    if(kind==='water') return say(x.sst!=null?T('Το νερό είναι ','Water is ')+Math.round(x.sst)+T(' βαθμούς.',' degrees.'):T('Δεν έχω θερμοκρασία νερού.','No water temperature.'));
    return null; }); }
B.voiceAsk=function(text){ var k=qOf(text); return k?answer(k):Promise.resolve(null); };
/* ---------- 1.9.68: ολόκληρη φράση → ψάρι με είδος/βάρος, χωρίς άγγιγμα· «ακύρωση» σβήνει το τελευταίο ---------- */
var VLAST={id:null,t:0}, UNDO=/(^| )(ακυρωση|ακυρο|ακυρωσε|λαθος|σβησε το|σβησ το|cancel|undo|delete (it|that|last))( |$)/;
function logParsed(r,miss){ var id=B.quickRec(!!miss,null,null,true); if(!id) return null; if(!miss&&r&&r.species){ var S=B.store, cur=S.get('bites',id); if(cur){ var nx=Object.assign({},cur,{species:r.species.disp||'',latin:r.species.la||''}); if(r.kg!=null) nx.kg=r.kg; if(r.len!=null) nx.len=r.len; if(r.cnt) nx.cnt=r.cnt; if(r.bait) nx.bait=r.bait; if(r.rel) nx.rel=true; S.save('bites',nx); B.emit('store','alkyon-bites'); } }
  VLAST={id:id,t:Date.now()}; return id; }
function spoken(r){ return [(r.cnt?r.cnt+' ':'')+SN(r.species.disp),r.kg!=null?(B.sayNum?B.sayNum(r.kg):r.kg)+T(' κιλά',' kilos'):null,r.len!=null?r.len+T(' εκατοστά',' centimetres'):null].filter(Boolean).join(', '); }
function undoLast(){ if(!VLAST.id||Date.now()-VLAST.t>180000){ if(B.say) B.say(T('Δεν έχω κάτι να σβήσω.','Nothing to undo.'),null,'vu',0); return false; } try{ B.store.remove('bites',VLAST.id); aDel(VLAST.id); B.emit('store','alkyon-bites'); B.emit('trip'); }catch(e){} VLAST={id:null,t:0}; if(B.say) B.say(T('Το έσβησα.','Deleted.'),null,'vu',0); B.toast(T('🎤 Σβήστηκε η τελευταία καταγραφή','🎤 Last entry deleted')); return true; }
B.voiceUndo=undoLast; B.voiceLogParsed=logParsed;
/* στον χάρτη κατά την έξοδο: η ώρα που πάτησες είναι η ώρα του ψαριού */
function voiceLog(){
  var t0=Date.now();
  listen(function(alts){
    var qk=null; alts.some(function(a){ qk=qOf(a); return !!qk; }); if(qk&&!(best(alts)||{}).species){ answer(qk); return; }
    if(alts.some(function(a){ return UNDO.test(nrm(a)); })){ undoLast(); return; }
    if(alts.some(function(a){ return PESTV.test(nrm(a)); })&&B.quickPest){ B.quickPest(/λαγοκ|toad|puffer/.test(nrm(alts.join(' ')))?'toad':'stolen',null); return; }
    if(alts.some(function(a){ return LOST.test(a); })){ if(B.quickRec) B.quickRec(true); return; }
    var r=best(alts); if(!r||!r.species){ B.ask(T('Άκουσα: «','Heard: “')+alts[0]+T('». Δεν αναγνώρισα το είδος. Να ξαναπείς;','”. I did not recognise the species. Try again?'),T('Ξανά','Again')).then(function(y){ if(y) voiceLog(); }); return; }
    r.t0=t0; var msg=[(r.cnt?r.cnt+' × ':'')+SN(r.species.disp),r.kg!=null?r.kg+' kg':null,r.len!=null?r.len+' cm':null,r.bait?T('δόλωμα: ','bait: ')+r.bait:null,r.rel?T('απελευθερώθηκε','released'):null].filter(Boolean).join(' · ');
    B.ask(msg+'\n'+T('Άκουσα: «','Heard: “')+alts[0]+T('»','”')+'\n\n'+T('Να καταγραφεί ως ψάρι;','Log as a catch?'),T('Καταγραφή','Log')).then(function(y){ if(y) B.biteForm(null,{voice:r,auto:true}); });
  },function(){ offlineLog(); });
}
var MIC='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>';

/* ---------- εισαγωγή σημείων από σύνδεσμο ---------- */
function importShare(){
  var m=/^#share=([A-Za-z0-9_.\-]+)$/.exec(location.hash||''); if(!m) return false;
  var code=m[1]; try{ history.replaceState(null,'',location.pathname+'#map'); }catch(e){}
  dec(code).then(function(pl){
    var list=(pl&&pl.v===1&&Array.isArray(pl.s)?pl.s:[]).slice(0,150).map(function(s){
      var la=+s.la, lo=+s.lo; if(!isFinite(la)||!isFinite(lo)||Math.abs(la)>90||Math.abs(lo)>180) return null;
      var d=s.d==null||s.d===''?null:+s.d; return {name:clip(s.n,60)||T('Σημείο','Spot'),type:clip(s.t,40),lat:la,lon:lo,depth:isFinite(d)?d:null,notes:clip(s.no,400)};
    }).filter(Boolean);
    if(!list.length){ B.toast(T('Ο σύνδεσμος δεν περιέχει σημεία.','The link has no spots.')); return; }
    var have=C.Store.get('spots'), fresh=list.filter(function(n){ return !have.some(function(x){ return Math.abs(x.lat-n.lat)<0.0003&&Math.abs(x.lon-n.lon)<0.0003; }); });
    if(!fresh.length){ B.toast(T('Έχεις ήδη αυτά τα σημεία.','You already have these spots.')); return; }
    var names=fresh.slice(0,6).map(function(s){ return '• '+s.name; }).join('\n')+(fresh.length>6?'\n…':'');
    B.ask(T('Κάποιος μοιράστηκε ','Someone shared ')+fresh.length+T(' σημεία μαζί σου:\n\n',' spots with you:\n\n')+names+'\n\n'+T('Να προστεθούν στα σημεία σου;','Add them to your spots?'),T('Προσθήκη','Add')).then(function(ok){
      if(!ok) return; fresh.forEach(function(s){ B.store.save('spots',Object.assign({},s,{notes:(s.notes?s.notes+' ':'')+T('(από φίλο)','(from a friend)')})); });
      B.toast(fresh.length+T(' σημεία προστέθηκαν.',' spots added.')); var f=fresh[0]; if(B.mapGo) B.mapGo(f.lat,f.lon,13); });
  }).catch(function(){ B.toast(T('Ο σύνδεσμος δεν είναι έγκυρος.','The link is not valid.')); });
  return true;
}
setTimeout(importShare,900); window.addEventListener('hashchange',function(){ setTimeout(importShare,200); });

B.cards={fish:function(b){ preview(fishCard(b),'alkyon-fish.png',(SN(b.species)||T('Ψάρι','Fish'))+(b.kg?' '+b.kg+' kg':'')); },
  trip:function(t){ if(!t.species&&t.sid){ var sp={}; C.Store.act().forEach(function(b){ if(b.trip===t.sid&&b.species) sp[b.species]=(sp[b.species]||0)+C.bc(b); }); var k=Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; })[0]; if(k) t=Object.assign({},t,{species:k}); } preview(tripCard(t),'alkyon-trip.png',T('Η έξοδός μου στο Alkyon','My trip on Alkyon')); },
  year:function(y){ preview(yearCard(y),'alkyon-'+y+'.png',T('Η χρονιά μου στο ψάρεμα','My fishing year')+' '+y); },
  cost:costSheet,costOf:costOf,yearData:yearData};
B.voice={ok:!!SR,fill:voiceFill,log:voiceLog,parse:parseVoice,MIC:MIC};
/* 1.8.7: φωνητικές εντολές σε έξοδο (alkyon-vcmd): το κινητό ακούει συνέχεια και με «ψάρι / έπιασα / catch» γράφει ψάρι,
   με «τσίμπησε / χάθηκε / bite / lost» τσίμπημα, αμέσως, στη θέση του δολώματος αν κάνεις συρτή. Ό,τι λέει η ίδια η εφαρμογή αγνοείται. */
var VC={on:false,rec:null,last:0,pauseTo:0,ok:!!SR};
var VC_CATCH=/(^|\s)(ψαρι|ψαρακι|επιασα|πιασαμε|πιασα|catch|caught|fish|got one)(\s|$)/, VC_MISS=/(^|\s)(τσιμπησε|τσιμπημα|χαθηκε|εφυγε|εφαγε|bite|lost it|lost|missed)(\s|$)/;
function vcN(t){ return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zα-ω0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }
function vcWanted(){ return !!B.ls.get('alkyon-vcmd',false)&&(!!(B.trip&&B.trip.active&&B.trip.active())||!!(B.troll&&B.troll.sim&&B.troll.sim.on())); }
function vcHandle(alts){ var now=Date.now(); if(now<VC.pauseTo||now-VC.last<4000) return; try{ if(window.speechSynthesis&&speechSynthesis.speaking) return; }catch(e){}
  var t=alts.map(vcN).join(' | ');
  /* 1.9.68: «ακύρωση» → σβήνει το τελευταίο· ερώτηση → απάντηση με φωνή· «συναγρίδα τρία κιλά» → ψάρι με είδος και βάρος */
  if(UNDO.test(t)){ VC.last=now; undoLast(); return; }
  var r=best(alts), q=null; alts.some(function(a){ q=qOf(a); return !!q; });
  if(q&&!(r&&r.species)){ VC.last=now; answer(q); return; }
  if(r&&r.species&&(r.kg!=null||r.len!=null||r.cnt||VC_CATCH.test(t))){ VC.last=now; logParsed(r,false); var sp=spoken(r); if(B.say) B.say(sp+T('. Το έγραψα.','. Logged.'),null,'vcs',0); B.toast('🎤 '+sp+T(' · γράφτηκε. Πες «ακύρωση» αν είναι λάθος.',' · logged. Say “cancel” if wrong.')); return; }
  if(VC_MISS.test(t)){ VC.last=now; VLAST={id:B.quickRec(true,null,null,true),t:now}; if(B.say) B.say(T('Χαμένο, το έγραψα','Lost one, logged'),null,'vcm',0); B.toast(T('🎤 Τσίμπημα γράφτηκε','🎤 Bite logged')); }
  else if(VC_CATCH.test(t)){ VC.last=now; VLAST={id:B.quickRec(false,null,null,true),t:now}; if(B.say) B.say(T('Το έγραψα','Logged'),null,'vcc',0); B.toast(T('🎤 Ψάρι γράφτηκε εκεί που είναι το δόλωμα','🎤 Catch logged where the lure is')); } }
function vcLoop(){ if(!VC.on||!SR) return; if(Date.now()<VC.pauseTo){ setTimeout(vcLoop,1000); return; }
  var r; try{ r=new SR(); }catch(e){ VC.on=false; return; } r.lang=vlang(); r.continuous=true; r.interimResults=false; r.maxAlternatives=3; if(LOCAL) try{ r.processLocally=true; }catch(e){}
  r.onresult=function(e){ for(var i=e.resultIndex;i<e.results.length;i++){ var res=e.results[i]; if(!res.isFinal) continue; var alts=[]; for(var k=0;k<res.length;k++) alts.push(res[k].transcript); vcHandle(alts); } };
  r.onerror=function(e){ if(e.error==='not-allowed'||e.error==='service-not-allowed'){ VC.on=false; B.ls.set('alkyon-vcmd',false); B.toast(T('Οι φωνητικές εντολές χρειάζονται άδεια μικροφώνου.','Voice commands need microphone permission.')); B.emit('vcmd'); }
    /* 1.9.68: χωρίς σήμα δεν ξαναδοκιμάζει συνέχεια (μπαταρία)· ξανά σε 30″ */
    else if(e.error==='network'){ VC.pauseTo=Date.now()+30000; if(!VC.netMsg||Date.now()-VC.netMsg>600000){ VC.netMsg=Date.now(); B.toast(T('Χωρίς σήμα: οι φωνητικές εντολές περιμένουν. Πάτα το 🎤 για ψάρι με ηχογράφηση.','No signal: voice commands are waiting. Tap 🎤 for a catch with a voice note.')); } } };
  r.onend=function(){ VC.rec=null; if(VC.on) setTimeout(vcLoop,350); };
  try{ r.start(); VC.rec=r; }catch(e){ VC.rec=null; setTimeout(vcLoop,2000); } }
function vcSync(){ var want=vcWanted()&&!document.hidden; if(want&&!VC.on){ VC.on=true; vcLoop(); } else if(!want&&VC.on){ VC.on=false; try{ VC.rec&&VC.rec.stop(); }catch(e){} } }
B.voiceCmd={ok:!!SR,on:function(){ return VC.on; },wanted:function(){ return !!B.ls.get('alkyon-vcmd',false); },set:function(v){ B.ls.set('alkyon-vcmd',!!v); if(v) localInstall(); vcSync(); B.emit('vcmd'); },
  pause:function(ms){ VC.pauseTo=Date.now()+(ms||6000); try{ VC.rec&&VC.rec.abort(); }catch(e){} },test:vcHandle};
B.on('trip',function(){ setTimeout(vcSync,300); }); document.addEventListener('visibilitychange',vcSync); setInterval(vcSync,15000); setTimeout(vcSync,2500);
B.shareSpots=shareSpots;
})();
