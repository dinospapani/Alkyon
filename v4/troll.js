/* Alkyon 1.6.0 · Συρτή (trolling)
   - Ταχύτητα-στόχος: μεγάλη ένδειξη στον χάρτη (πράσινο μέσα στο εύρος, πορτοκαλί/κόκκινο έξω) και δόνηση όταν μένεις έξω > 20″.
   - Τεχνητά στο νερό: διαλέγεις από τον Εξοπλισμό· μπαίνουν αυτόματα σε κάθε ψάρι.
   - Θέση του ψαριού: το δόλωμα είναι πίσω από τη βάρκα. Η θέση υπολογίζεται πάνω στη διαδρομή, τόσα μέτρα πίσω όσο είναι το δόλωμα:
       αφρού: τα μέτρα πετονιάς έξω
       βυθού: από το βάθος, το μολύβι και την ταχύτητα (ή από τα μέτρα πετονιάς, αν τα ξέρεις) + το παράμαλλο μετά το μολύβι
   - Στο ψάρι γράφονται ταχύτητα, πορεία, απόσταση δολώματος και η θέση της βάρκας (boatLat/boatLon). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls;
var K='alkyon-troll', DEF={on:false,mode:'surface',min:5,max:7,line:40,lead:300,leader:10,lineB:null,lures:[]};
var KLEAD=60; /* tan(γωνία πετονιάς από την κατακόρυφο) ≈ KLEAD·v²/μολύβι(g)· π.χ. 300 g στα 2,5 kn → ~52° */
function cfg(){ return Object.assign({},DEF,ls.get(K,{})||{}); }
function put(c){ ls.set(K,c); B.emit('troll'); paint(); }
function tripOn(){ return !!(B.trip&&B.trip.active&&B.trip.active()); }
function on(){ return cfg().on&&tripOn(); }
function R(){ return Math.PI/180; }
function dist(a,b){ var r=R(), dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r, x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)*Math.sin(dLo/2); return 2*6371000*Math.asin(Math.min(1,Math.sqrt(x))); }
function dest(lat,lon,brg,m){ var r=R(), d=m/6371000, a=lat*r, o=lon*r, b=brg*r, a2=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(b)), o2=o+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(a2)); return [a2/r,o2/r]; }
function brg(a,b){ var r=R(), y=Math.sin((b[1]-a[1])*r)*Math.cos(b[0]*r), x=Math.cos(a[0]*r)*Math.sin(b[0]*r)-Math.sin(a[0]*r)*Math.cos(b[0]*r)*Math.cos((b[1]-a[1])*r); return (Math.atan2(y,x)/r+360)%360; }
function pts(){ var t=B.trip&&B.trip.track&&B.trip.track(); return t&&Array.isArray(t.pts)?t.pts:[]; }

/* ---------- ταχύτητα και πορεία ---------- */
var spd=null, hdg=null, outSince=0, lastAlarm=0, depth=null, depthAt=0;
function measure(){ var f=B.trip&&B.trip.fix&&B.trip.fix(), p=pts(), now=Date.now(), s=null, hd=null;
  if(f&&f.spd!=null&&f.spd>=0&&now-f.t<15000){ s=f.spd*1.94384; if(f.hd!=null&&f.spd>0.6) hd=f.hd; }
  if(p.length>1){ var last=p[p.length-1], i=p.length-2; while(i>0&&last[2]-p[i][2]<25000) i--; var a=p[i], dt=(last[2]-a[2])/1000;
    if(dt>=4&&now-last[2]<30000){ var d=dist(a,last); if(s==null) s=d/dt*1.94384; if(hd==null&&d>8) hd=brg(a,last); } }
  if(s!=null) spd=spd==null?s:spd*0.5+s*0.5; else if(p.length&&now-p[p.length-1][2]>60000) spd=0;
  if(hd!=null) hdg=hd; }
function check(){ if(!on()){ outSince=0; return; } measure(); var c=cfg(), now=Date.now();
  if(spd!=null&&(spd<c.min||spd>c.max)){ if(!outSince) outSince=now; if(now-outSince>20000&&now-lastAlarm>60000){ lastAlarm=now;
      try{ navigator.vibrate&&navigator.vibrate(spd<c.min?[400,150,400]:[150,100,150,100,150]); }catch(e){}
      B.toast((spd<c.min?T('Συρτή: πολύ αργά · ','Trolling: too slow · '):T('Συρτή: πολύ γρήγορα · ','Trolling: too fast · '))+B.num(spd,1)+' kn ('+c.min+'–'+c.max+')',5000); } }
  else outSince=0;
  if(c.mode==='bottom'&&B.depthAt&&now-depthAt>30000){ var f=B.trip.fix&&B.trip.fix()||B.lastPos(); if(f){ depthAt=now; B.depthAt(f.lat,f.lon).then(function(d){ if(d!=null&&d>0) depth=d; paint(); }).catch(function(){}); } }
  paint(); }

/* ---------- πόσο πίσω είναι το δόλωμα ---------- */
function layback(c,kn,dep){ c=c||cfg(); if(c.mode!=='bottom') return Math.max(0,+c.line||0);
  var D=dep!=null?dep:depth, lead=+c.lead||0, ld=+c.leader||0;
  if(c.lineB&&D!=null&&+c.lineB>D) return Math.sqrt(c.lineB*c.lineB-D*D)*0.92+ld;   /* πετονιά έξω γνωστή: κάθετη πλευρά = βάθος (λίγη καμπύλη) */
  if(D==null||!lead) return c.lineB?+c.lineB*0.7+ld:null;
  var v=kn!=null&&kn>0.3?kn:((+c.min+ +c.max)/2), tn=Math.min(6,KLEAD*v*v/lead); return D*tn+ld; }
/* σημείο πάνω στη διαδρομή, m μέτρα πίσω από τη βάρκα */
function behind(boat,m){ var p=pts(), cur=[boat.lat,boat.lon], left=m;
  for(var i=p.length-1;i>=0&&left>0;i--){ var q=[p[i][0],p[i][1]], d=dist(cur,q); if(d<0.5) continue;
    if(d>=left){ var f=left/d; return {lat:cur[0]+(q[0]-cur[0])*f,lon:cur[1]+(q[1]-cur[1])*f,on:true}; } left-=d; cur=q; }
  if(left<=0) return {lat:cur[0],lon:cur[1],on:true};
  if(hdg==null) return null; var e=dest(cur[0],cur[1],(hdg+180)%360,left); return {lat:e[0],lon:e[1],on:false}; }
function techName(c){ return c.mode==='bottom'?T('Συρτή βυθού','Deep / bottom trolling'):T('Συρτή αφρού','Surface trolling'); }
/* καλείται από τη φόρμα ψαριού και την γρήγορη καταγραφή: rec.lat/lon = θέση της βάρκας → γίνεται θέση του δολώματος */
function adjust(rec){ if(!on()||!rec||typeof rec.lat!=='number'||rec.gear) return false; measure(); var c=cfg(), lb=layback(c,spd);
  rec.troll={m:c.mode,kn:spd!=null?+spd.toFixed(1):null,hd:hdg!=null?Math.round(hdg):null,lead:c.mode==='bottom'?+c.lead||null:null,line:c.mode==='bottom'?(c.lineB||null):+c.line||null};
  if(!rec.tech) rec.tech=techName(c);
  if(c.lures&&c.lures.length){ var tk=(rec.tk||[]).slice(); c.lures.forEach(function(id){ if(tk.indexOf(id)<0) tk.push(id); }); rec.tk=tk; }
  if(lb!=null&&lb>3){ var q=behind({lat:rec.lat,lon:rec.lon},lb); if(q){ rec.boatLat=rec.lat; rec.boatLon=rec.lon; rec.lat=+q.lat.toFixed(5); rec.lon=+q.lon.toFixed(5); rec.troll.lb=Math.round(lb); if(!q.on) rec.troll.est=1; } }
  if(c.mode==='bottom'&&depth!=null&&(rec.depth==null||rec.depth==='')){ rec.depth=Math.round(depth); rec.depthSrc='chart'; }
  return true; }

/* ---------- ένδειξη στον χάρτη ---------- */
var pill=null;
function paint(){ var c=cfg(), show=on();
  if(!pill){ if(!show) return; pill=h('button',{class:'trpill',type:'button','aria-live':'polite',onclick:function(){ sheet(); }}); document.body.append(pill); }
  pill.hidden=!show; document.body.classList.toggle('trolling',show); if(!show) return;
  var st=spd==null?'na':spd<c.min?'lo':spd>c.max?'hi':'ok', lb=layback(c,spd);
  pill.className='trpill '+st;
  pill.replaceChildren(h('small',{text:techName(c)}),h('b',{text:spd==null?'–':B.num(spd,1)}),h('em',{text:'kn · '+c.min+'–'+c.max}),
    h('i',{text:lb!=null?T('δόλωμα ~','lure ~')+Math.round(lb)+T(' m πίσω',' m back'):(c.mode==='bottom'?T('βάθος…','depth…'):'')}));
}

/* ---------- ρυθμίσεις ---------- */
function lures(){ var S=B.store; return S?S.raw('tackle').filter(function(x){ return !x.deleted&&(x.type==='lure'||x.type==='set'); }):[]; }
function sheet(){ var c=cfg(), sh;
  var num=function(v,min,max,step){ return h('input',{type:'number',inputmode:'decimal',min:String(min),max:String(max),step:String(step||1),value:v!=null?String(v):''}); };
  var mn=num(c.min,0.5,20,0.5), mx=num(c.max,0.5,25,0.5), ln=num(c.line,5,300), ld=num(c.lead,20,3000,10), lr=num(c.leader,0,60), lb=num(c.lineB,0,500);
  var mode=c.mode, mc=h('div',{class:'chips'}), est=h('p',{class:'trest'}), sur=h('div'), bot=h('div');
  function M(v,lab){ var b=h('button',{type:'button',class:'chip','aria-pressed':String(mode===v),text:lab,onclick:function(){ mode=v; if(v==='bottom'&&+mn.value>=4.5){ mn.value='2'; mx.value='3.5'; } if(v==='surface'&&+mx.value<=4){ mn.value='5'; mx.value='7'; } [].forEach.call(mc.children,function(x){ x.setAttribute('aria-pressed',String(x===b)); }); draw(); }}); return b; }
  mc.append(M('surface',T('Αφρού','Surface')),M('bottom',T('Βυθού (με μολύβι)','Bottom (with lead)')));
  var leadChips=h('div',{class:'chips'}); [100,200,300,500,800,1000].forEach(function(g){ leadChips.append(h('button',{type:'button',class:'chip sm',text:g+' g',onclick:function(){ ld.value=String(g); draw(); }})); });
  sur.append(h('label',{class:'fld'},h('span',{text:T('Πετονιά έξω (m), πόσο πίσω είναι το τεχνητό','Line out (m), how far back the lure is')}),ln));
  bot.append(h('label',{class:'fld'},h('span',{text:T('Μολύβι (g, όλα μαζί)','Lead (g, total)')}),ld,leadChips),
    h('label',{class:'fld'},h('span',{text:T('Παράμαλλο μετά το μολύβι (m)','Leader after the lead (m)')}),lr),
    h('label',{class:'fld'},h('span',{text:T('Πετονιά έξω (m), αν την ξέρεις (προαιρετικό)','Line out (m), if you know it (optional)')}),lb,h('small',{text:T('Αν τη βάλεις, υπολογίζεται από αυτήν και το βάθος· αλλιώς από το μολύβι και την ταχύτητα.','If set, it is used with the depth; otherwise the lead and speed are used.')})));
  var sel=(c.lures||[]).slice(), lc=h('div',{class:'chips trlures'}), L=lures();
  L.forEach(function(x){ var b=h('button',{type:'button',class:'chip sm','aria-pressed':String(sel.indexOf(x.id)>=0),text:x.name||'?',onclick:function(){ var i=sel.indexOf(x.id); if(i<0) sel.push(x.id); else sel.splice(i,1); b.setAttribute('aria-pressed',String(i<0)); }}); lc.append(b); });
  function cur(){ return {on:true,mode:mode,min:+mn.value||DEF.min,max:+mx.value||DEF.max,line:+ln.value||DEF.line,lead:+ld.value||DEF.lead,leader:lr.value===''?0:+lr.value,lineB:+lb.value||null,lures:sel}; }
  function draw(){ sur.hidden=mode!=='surface'; bot.hidden=mode!=='bottom'; var q=cur(), v=(q.min+q.max)/2, l=layback(q,v);
    est.textContent=l!=null?T('Με ','At ')+B.num(v,1)+T(' kn το δόλωμα είναι ~',' kn the lure is ~')+Math.round(l)+T(' m πίσω από τη βάρκα','m behind the boat')+(mode==='bottom'&&depth!=null?T(' (βάθος ~',' (depth ~')+Math.round(depth)+' m)':'')+T('. Τα ψάρια μπαίνουν εκεί, πάνω στη διαδρομή σου.','. Catches are placed there, on your track.'):T('Το βάθος θα βρεθεί από τον χάρτη βαθών όταν ξεκινήσεις.','The depth will be read from the depth chart once you start.'); }
  [mn,mx,ln,ld,lr,lb].forEach(function(i){ i.addEventListener('input',draw); });
  var go=h('button',{class:'btn pri full',type:'button',text:c.on?T('Αποθήκευση','Save'):'▶ '+T('Έναρξη συρτής','Start trolling'),onclick:function(){ var q=cur(); if(q.min>=q.max){ B.toast(T('Η ελάχιστη ταχύτητα πρέπει να είναι μικρότερη από τη μέγιστη.','Minimum speed must be below maximum.')); return; }
    if(!tripOn()){ sh.close(); put(q); B.toast(T('Ξεκίνα πρώτα έξοδο: η συρτή δουλεύει μέσα στην έξοδο.','Start a trip first: trolling works within a trip.')); if(B.tripStart) B.tripStart(); return; }
    outSince=0; put(q); sh.close(); check(); B.toast(T('Συρτή: ','Trolling: ')+techName(q)+' · '+q.min+'–'+q.max+' kn'); }});
  var stop=c.on?h('button',{class:'btn full',type:'button',text:T('Τέλος συρτής','Stop trolling'),onclick:function(){ var q=cfg(); q.on=false; put(q); sh.close(); }}):null;
  sh=B.sheet({title:T('Συρτή','Trolling'),body:h('div',{class:'bform trsheet'},h('div',{class:'fld'},h('span',{text:T('Είδος','Type')}),mc),
    h('div',{class:'cprow'},h('label',{class:'fld'},h('span',{text:T('Ταχύτητα από (kn)','Speed from (kn)')}),mn),h('label',{class:'fld'},h('span',{text:T('έως (kn)','to (kn)')}),mx)),
    sur,bot,h('div',{class:'fld'},h('span',{text:T('Τεχνητά στο νερό','Lures in the water')}),L.length?lc:h('small',{text:T('Πρόσθεσε τεχνητά στον Εξοπλισμό για να τα διαλέγεις εδώ.','Add lures in Tackle to pick them here.')})),
    est,go,stop,h('p',{class:'foot',text:T('Δονείται αν μείνεις έξω από την ταχύτητα για 20″. Η θέση του δολώματος είναι εκτίμηση· το βάθος από τον χάρτη βαθών EMODnet.','Vibrates if you stay outside the speed range for 20 s. The lure position is an estimate; depth from the EMODnet chart.')}))});
  draw(); }
B.trollBtn=function(){ return h('button',{class:'iconbtn trbtn',type:'button','aria-label':T('Συρτή','Trolling'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h10l-2 3H5z"/><path d="M8 15V7l5 8"/><path d="M13 9c3 1 5 3 8 8"/><circle cx="21" cy="18" r="1.3"/></svg>',onclick:sheet}); };
B.troll={on:on,cfg:cfg,sheet:sheet,adjust:adjust,layback:layback,speed:function(){ return spd; }};
B.on('track',check);
B.on('trip',function(){ if(!tripOn()&&cfg().on){ var q=cfg(); q.on=false; ls.set(K,q); } paint(); });
setInterval(function(){ if(on()) check(); },10000);
setTimeout(paint,1500);
})();
