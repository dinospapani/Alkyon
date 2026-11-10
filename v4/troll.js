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
var K='alkyon-troll', DEF={on:false,mode:'surface',min:5,max:7,line:40,auto:true,leads:10,gap:null,leader:10,v0:3,lineB:null,lures:[]};
/* 1.6.2: συρτή βυθού με μολύβια: κάθε μολύβι = 1 οργιά βάθος στην ταχύτητα αναφοράς v0 (συνήθως 3 kn).
   Πετονιά έξω L = μολύβια × απόσταση μεταξύ τους (αν δεν την ξέρεις: 2 οργιές). Στο v0: cosθ0 = 1 οργιά / απόσταση.
   Σε άλλη ταχύτητα η πετονιά γέρνει περισσότερο ή λιγότερο: tanθ = tanθ0·(v/v0)² (αντίσταση νερού ∝ v²).
   Βάθος δολώματος = L·cosθ, πόσο πίσω = L·sinθ + παράμαλλο. */
var FATH=1.83, GAP0=2*FATH;
function cfg(){ return Object.assign({},DEF,ls.get(K,{})||{}); }
function put(c){ ls.set(K,c); B.emit('troll'); paint(); }
function tripOn(){ return !!SIM||!!(B.trip&&B.trip.active&&B.trip.active()); }
function on(){ return cfg().on&&tripOn(); }
function R(){ return Math.PI/180; }
function dist(a,b){ var r=R(), dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r, x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)*Math.sin(dLo/2); return 2*6371000*Math.asin(Math.min(1,Math.sqrt(x))); }
function dest(lat,lon,brg,m){ var r=R(), d=m/6371000, a=lat*r, o=lon*r, b=brg*r, a2=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(b)), o2=o+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(a2)); return [a2/r,o2/r]; }
function brg(a,b){ var r=R(), y=Math.sin((b[1]-a[1])*r)*Math.cos(b[0]*r), x=Math.cos(a[0]*r)*Math.sin(b[0]*r)-Math.sin(a[0]*r)*Math.cos(b[0]*r)*Math.cos((b[1]-a[1])*r); return (Math.atan2(y,x)/r+360)%360; }
/* 1.8.30: η συρτή έχει δικό της GPS όσο είναι ανοιχτή. Αν στην έξοδο είναι κλειστή η «Καταγραφή διαδρομής GPS», η έξοδος δεν
   παρακολουθεί τη θέση, και η συρτή έμενε χωρίς ταχύτητα («– kn») ακόμα και με το αυτοκίνητο. Παίρνει την πιο πρόσφατη θέση από τις δύο. */
var OWN={wid:null,f:null};
function ownGps(need){ if(need&&OWN.wid==null&&navigator.geolocation){ try{ OWN.wid=navigator.geolocation.watchPosition(function(p){ var c=p.coords; OWN.f={lat:c.latitude,lon:c.longitude,t:Date.now(),spd:c.speed,hd:c.heading,acc:c.accuracy}; },function(){},{enableHighAccuracy:true,maximumAge:5000,timeout:30000}); }catch(e){} }
  if(!need&&OWN.wid!=null){ try{ navigator.geolocation.clearWatch(OWN.wid); }catch(e){} OWN.wid=null; OWN.f=null; } }
function tFix(){ if(SIM) return SIM.fix; var a=B.trip&&B.trip.fix&&B.trip.fix(), b=OWN.f; return b&&(!a||!a.t||b.t>a.t)?b:a; } /* 1.8.9: η δοκιμή αλλάζει μόνο ό,τι βλέπει η συρτή, όχι την έξοδο */
function tTrack(){ if(SIM) return {id:SIM.id,pts:SIM.trk}; return B.trip&&B.trip.track&&B.trip.track(); }
function pts(){ var t=tTrack(); return t&&Array.isArray(t.pts)?t.pts:[]; }

/* ---------- ταχύτητα και πορεία ---------- */
var spd=null, hdg=null, outSince=0, lastAlarm=0, depth=null, depthL=null, depthAt=0;
/* 1.6.3: στο βυθόμετρο το βάθος είναι σε οργιές· «32 οργιές → 31 μολύβια». Στην εφαρμογή: βάθη σε οργιές, απόσταση πίσω σε μέτρα */
function fa(m){ return m==null?null:Math.round(m/FATH); }
function faTxt(m){ return fa(m)+T(' οργ.',' fm'); }
function faM(m){ return fa(m)+T(' οργ.',' fm')+' · '+Math.round(m)+' m'; }
function measure(){ var f=tFix(), p=pts(), now=Date.now(), s=null, hd=null;
  if(f&&f.spd!=null&&f.spd>=0&&now-f.t<15000){ s=f.spd*1.94384; if(f.hd!=null&&f.spd>0.6) hd=f.hd; }
  if(p.length>1){ var last=p[p.length-1], i=p.length-2; while(i>0&&last[2]-p[i][2]<25000) i--; var a=p[i], dt=(last[2]-a[2])/1000;
    if(dt>=4&&now-last[2]<30000){ var d=dist(a,last); if(s==null) s=d/dt*1.94384; if(hd==null&&d>8) hd=brg(a,last); } }
  /* 1.8.29: σταματημένος: τα κινητά συνήθως δεν δίνουν ταχύτητα όταν δεν κινείσαι, και το ίχνος δεν παίρνει νέα σημεία → έδειχνε «– kn».
     Αν το GPS δουλεύει (πρόσφατη θέση) και δεν μετακινήθηκες πάνω από ~10 m σε 20″, η ταχύτητα είναι 0 */
  if(s==null&&f&&now-f.t<30000){ SV.fx=(SV.fx||[]).filter(function(q){ return now-q[2]<40000; }); var lf=SV.fx[SV.fx.length-1]; if(!lf||lf[2]!==f.t) SV.fx.push([f.lat,f.lon,f.t]);
    var o=SV.fx.filter(function(q){ return f.t-q[2]>=15000; }).pop(); if(o){ var dd=dist(o,[f.lat,f.lon]), dts=(f.t-o[2])/1000; s=dd<10?0:dd/dts*1.94384; } else if(SV.fx.length>=1&&spd==null) s=0; }
  if(s!=null) spd=spd==null?s:spd*0.5+s*0.5; else if(p.length&&now-p[p.length-1][2]>60000) spd=0;
  if(hd!=null) hdg=hd; }
/* 1.8.12: ειδοποίηση ταχύτητας πιο σίγουρη: μετά από 12″ εκτός ορίων (όχι 20″), δεν μηδενίζει από μια στιγμιαία μέτρηση μέσα στα όρια
   (θέλει 8″ μέσα), ελέγχεται κάθε 2″ (όχι 10″), ξανά κάθε 45″ όσο μένεις έξω */
var inSince=0;
/* 1.9.22: στη στεριά δεν υπάρχει βυθός (το EMODnet δίνει το υψόμετρο σαν «βάθος») ούτε ειδοποιήσεις· ακριβής ακτογραμμή γύρω από τη θέση σου */
var LR={bb:null,r:null,p:0};
function inRings(r,lat,lng){ var ins=false; r.forEach(function(q){ var b=q.b; if(b&&(lng<b[0]||lng>b[2]||lat<b[1]||lat>b[3])) return; var xy=q.xy, n=xy.length/2, c=false;
  for(var i=0,j=n-1;i<n;j=i++){ var xi=xy[2*i], yi=xy[2*i+1], xj=xy[2*j], yj=xy[2*j+1]; if(((yi>lat)!==(yj>lat))&&(lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)) c=!c; } if(c) ins=!ins; }); return ins; }
function landHere(lat,lon){ var e=null; try{ e=B.landExact?B.landExact(lat,lon):null; }catch(x){} if(e===true||e===false) return e;
  var bb=LR.bb; if(bb&&LR.r&&lat>bb[0]&&lat<bb[1]&&lon>bb[2]&&lon<bb[3]) return inRings(LR.r,lat,lon);
  var SS=window.AlkyonSeaState; if(SS&&SS.landRings&&Date.now()-LR.p>20000){ LR.p=Date.now(); var nb=[lat-0.2,lat+0.2,lon-0.25,lon+0.25];
    SS.landRings({s:nb[0],n:nb[1],w:nb[2],e:nb[3]}).then(function(r){ if(r&&r.length){ LR.bb=nb; LR.r=r; } }).catch(function(){}); }
  return null; }
function speedCheck(c,now){ c=c||cfg(); now=now||Date.now(); if(spd==null) return;
  if(SV.land||spd<0.8){ outSince=0; return; } /* 1.9.22: σταματημένος ή στη στεριά: όχι «πολύ αργά» */
  var out=spd<c.min||spd>c.max;
  if(out){ inSince=0; if(!outSince) outSince=now; }
  else { if(!inSince) inSince=now; if(now-inSince>8000) outSince=0; return; }
  if(now-outSince>12000&&now-lastAlarm>45000){ lastAlarm=now;
    try{ navigator.vibrate&&navigator.vibrate(spd<c.min?[400,150,400]:[150,100,150,100,150]); }catch(e){}
    B.toast((spd<c.min?T('Συρτή: πολύ αργά · ','Trolling: too slow · '):T('Συρτή: πολύ γρήγορα · ','Trolling: too fast · '))+B.num(spd,1)+' kn ('+c.min+'–'+c.max+')',6000);
    if(B.say) B.say(T('Ταχύτητα ','Speed ')+B.sayNum(spd)+(spd<c.min?T(', ανέβασε',', speed up'):T(', κατέβασε',', slow down')),'speed','sp',40000); notify((spd<c.min?T('Πολύ αργά ','Too slow '):T('Πολύ γρήγορα ','Too fast '))+B.num(spd,1)+' kn ('+c.min+'–'+c.max+')'); } }
function check(){ ownGps(on()&&!SIM&&!document.hidden); if(!on()){ outSince=0; return; } measure(); var c=cfg(), now=Date.now();
  speedCheck(c,now);
  var dc=c.dep, dropping=c.mode==='bottom'&&dc&&dc.st==='drop';
  var f0=tFix()||B.lastPos(); SV.land=!!(f0&&landHere(f0.lat,f0.lon)===true); if(SV.land){ depth=null; depthL=null; }
  if(B.depthAt&&!SV.land&&now-depthAt>(dropping?8000:15000)){ var f=tFix()||B.lastPos(); if(f){ depthAt=now;
      dAt(f.lat,f.lon).then(function(d){ if(d!=null&&d>0) depth=d; if(dropping) return recommend(f); var lb=layback(cfg(),vEff()), q=lb?behind({lat:f.lat,lon:f.lon},lb):null;
        return q?dAt(q.lat,q.lon).then(function(d2){ if(d2!=null&&d2>0) depthL=d2; }):null; }).catch(function(){}).then(function(){ bottomCheck(); sample(); paint(); }); } }
  if(dropping) dropAuto(c,now);
  paint(); }

/* ---------- πόσο πίσω είναι το δόλωμα ---------- */
/* μολύβια: αυτόματα = οργιές βυθού στο σημείο του δολώματος − 1 (αλλιώς κάτω από τη βάρκα), ή ο αριθμός που έβαλες */
function nLeads(c,dep){ c=c||cfg(); if(dep==null&&c.dep&&c.dep.st==='drop'&&recN!=null) return recN; if(c.auto!==false){ var D=dep!=null?dep:(depthL!=null?depthL:depth); if(D!=null){ var rr0=rigOf(c); if(isPhys(rr0)) return bestN(c,spd!=null&&spd>0.8?spd:(+rr0.v0||3),D); return Math.max(1,Math.min(+rr0.max||80,fa(D)-1)); } } return Math.max(0,Math.round(+c.leads||0)); }
/* 1.6.5: αρματωσιές (alkyon-rigs): από το δόλωμα προς τη βάρκα: παράμαλλο (m) → κενό πριν το 1ο μολύβι (οργιές) → μολύβια ανά «απόσταση» οργιές,
   στριφτάρι ανά Χ μολύβια, έως «max» μολύβια. Προεπιλογή: Deep Fishing (Σ. Πάτσης): 12–15 m fluorocarbon, 5 οργιές κενό, μολύβι 160 g ανά 5 οργιές, στριφτάρι ανά 4. */
var RK='alkyon-rigs', PRESET={id:'deep5',name:T('Deep Fishing (5 οργιές)','Deep Fishing (5 fathoms)'),leader:13.5,blank:5,gap:5,lead:160,swivel:4,max:30,v0:3};
function rigs(){ var a=ls.get(RK,null); return Array.isArray(a)&&a.length?a:[PRESET]; }
function rigOf(c){ c=c||cfg(); var a=rigs(); return a.filter(function(r){ return r.id===c.rig; })[0]||a[0]; }
/* 1.8.16: ΦΥΣΙΚΟΣ ΥΠΟΛΟΓΙΣΜΟΣ (όταν η αρματωσιά έχει νήμα): ισορροπία δυνάμεων κομμάτι-κομμάτι από το δόλωμα ως τη βάρκα.
   Πάνω σε κάθε κομμάτι πετονιάς: αντίσταση νερού κάθετα ½ρ·Cn·d·(v·sinφ)², κατά μήκος ½ρ·Ct·πd·(v·cosφ)², βάρος/άνωση νήματος.
   Σε κάθε μολύβι: βάρος στο νερό m·g·(1−ρ/ρ_μολ.) και αντίσταση ½ρ·Cd·A·v². Μία ολοκλήρωση δίνει βάθος και απόσταση για κάθε αριθμό μολυβιών. */
var LINES={braid:{rho:980,Cn:1.5},dacron:{rho:1380,Cn:1.4},mono:{rho:1140,Cn:1.2}}, CAB={};
function cable(r,kn){ var L=LINES[r.mline]; if(!L) return null; var d=Math.max(0.1,+r.md||0.5)/1000, v=Math.max(0.5,Math.round(kn*20)/20), key=[r.id,r.mline,d,r.gap,r.lead,r.blank,r.leader,r.max,v].join('|'); if(CAB[key]) return CAB[key];
  var RHO=1025, G=9.81, q=0.5*RHO*(v*0.51444)*(v*0.51444), k=q*L.Cn*d, kt=q*0.015*Math.PI*d, w=Math.PI*d*d/4*(L.rho-RHO)*G;
  var m=(+r.lead||160)/1000, Wl=m*G*(1-RHO/11340), dia=Math.cbrt(4*(m/11340)/(Math.PI*4.5)), Dl=q*0.4*Math.PI*dia*dia/4; /* 1.8.17: μολύβι-τορπίλη Deep Fishing (μήκος ≈ 4,5 × διάμετρος), Cd 0,4 */
  var gap=(+r.gap||5)*FATH, first=(+r.leader||0)+(+r.blank||0)*FATH, mx=+r.max||80, Px=0.3, Py=0, x=0, z=0, sp=0, ds=0.25, mi=0, Z=[0], X=[0], PX=[0], PZ=[0], PS=[0], LX=[0], LZ=[0], nk=0;
  var mk=function(i){ return first+i*gap; };
  while(mi<mx){ var nxt=mk(mi); while(sp<nxt){ var ph=Math.atan2(Py,Px), sn=Math.sin(ph), cs=Math.cos(ph), st=Math.min(ds,nxt-sp); Px+=(k*sn*sn*sn+kt*cs*cs*cs)*st; Py+=(-k*sn*sn*cs+kt*cs*cs*sn+w)*st; x+=cs*st; z+=sn*st; sp+=st; if(++nk%4===0){ PX.push(x); PZ.push(z); PS.push(sp); } }
    PX.push(x); PZ.push(z); PS.push(sp); LX.push(x); LZ.push(z); Px+=Dl; Py+=Wl; mi++; var ph2=Math.atan2(Py,Px); Z[mi]=z+Math.sin(ph2)*FATH; X[mi]=x+Math.cos(ph2)*FATH; } /* +1 οργιά ως την κορυφή του καλαμιού */
  CAB[key]={Z:Z,X:X,PX:PX,PZ:PZ,PS:PS,LX:LX,LZ:LZ,first:first,gap:gap}; var ks=Object.keys(CAB); if(ks.length>60) delete CAB[ks[0]]; return CAB[key]; }
function isPhys(r){ return !!(r&&LINES[r.mline]); }
/* 1.8.25: το σχήμα της πετονιάς για το διάγραμμα, κανονικοποιημένο: βάρκα (0,0) → δόλωμα (1,1).
   Φυσική αρματωσιά: η καμπύλη και τα μολύβια όπως βγαίνουν από τον υπολογισμό. Κανόνας: ευθεία ως το 1ο μολύβι + παράμαλλο. */
function lineShape(c,v,n){ var r=rigOf(c); if(!n) return null;
  if(isPhys(r)&&!+c.lineB){ var cb=cable(r,v!=null&&v>0.3?v:(+r.v0||3)); if(cb&&cb.Z[n]!=null&&cb.X[n]>0&&cb.Z[n]>0){ var Xn=cb.X[n], Zn=cb.Z[n], end=cb.first+(n-1)*cb.gap, pts=[[0,0]];
      for(var i=cb.PS.length-1;i>=0;i--){ if(cb.PS[i]>end+1e-6) continue; pts.push([(Xn-cb.PX[i])/Xn,(Zn-cb.PZ[i])/Zn]); }
      var ld=[]; for(var k=n;k>=1;k--) ld.push([(Xn-cb.LX[k])/Xn,(Zn-cb.LZ[k])/Zn]); return {pts:pts,leads:ld,phys:true}; } }
  var g=geo0(Object.assign({},c,{auto:false,leads:n,dep:null}),v); if(!g||!g.L||!(g.lb>0)) return null; var tail=(+r.leader||0)+(+r.blank||0)*FATH, ls=Math.max(0,g.lb-tail), gp=(+r.gap||5)*FATH, ld=[];
  for(var j=n;j>=1;j--){ var a=Math.min(1,(FATH+(n-j)*gp)/g.L); ld.push([a*ls/g.lb,a]); } return {pts:[[0,0],[ls/g.lb,1],[1,1]],leads:ld,phys:false}; }
function arch(x,y,op){ return '<g opacity="'+op+'"><path d="M'+(x-7).toFixed(1)+','+(y+3).toFixed(1)+' Q'+x.toFixed(1)+','+(y-7).toFixed(1)+' '+(x+7).toFixed(1)+','+(y+3).toFixed(1)+'" stroke="#ff2a14" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M'+(x-6).toFixed(1)+','+(y+2.4).toFixed(1)+' Q'+x.toFixed(1)+','+(y-5.6).toFixed(1)+' '+(x+6).toFixed(1)+','+(y+2.4).toFixed(1)+'" stroke="#ffe100" stroke-width="1.5" fill="none" stroke-linecap="round"/></g>'; }
/* 1.8.26: ομαλός βυθός: Catmull-Rom ανάμεσα στα σημεία του χάρτη (αντί για σπασμένη γραμμή) */
function crAt(P,x){ var n=P.length; if(!n) return null; if(x<=P[0][0]) return P[0][1]; if(x>=P[n-1][0]) return P[n-1][1]; var i=0; while(i<n-2&&P[i+1][0]<=x) i++;
  var p0=P[Math.max(0,i-1)][1], p1=P[i][1], p2=P[i+1][1], p3=P[Math.min(n-1,i+2)][1], t=(x-P[i][0])/Math.max(1e-6,P[i+1][0]-P[i][0]), t2=t*t, t3=t2*t;
  return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3); }
/* 1.8.30: το 1:1 είναι «ματιά»: δεν θυμάται τη ρύθμιση, κλείνει όταν αλλάζεις όψη, και μόνο στο Κανονικό */
var TRUE1=false; try{ localStorage.removeItem('alkyon-trtrue'); }catch(e){}
function trueOn(){ return TRUE1&&viewMode()==='side'; }
function vnz(x){ var i=Math.floor(x), f=x-i, a=hsh(i), b=hsh(i+1), u=f*f*(3-2*f); return a+(b-a)*u; } /* ομαλός θόρυβος 1D: «σκληρότητα» βυθού κατά μήκος */
function hsh2(a,b){ var x=Math.sin(a*127.1+b*311.7+74.7)*43758.5453; return x-Math.floor(x); }
var EPAL=[[.13,[10,26,85]],[.2,[18,44,160]],[.28,[31,111,255]],[.37,[25,195,255]],[.47,[47,224,122]],[.57,[255,225,0]],[.67,[255,154,0]],[.77,[255,58,20]],[.88,[196,20,30]],[9,[122,16,32]]];
/* 1.8.26: αληθινή όψη βυθομέτρου σε canvas: κάθε στήλη = ένα σημείο στο έδαφος (gx σε m), ηχώ από τον βυθό με «ουρά» που
   λεπταίνει στις κλίσεις και αλλάζει με τη σκληρότητα, δεύτερη ηχώ στο 2× βάθος, θόρυβος επιφάνειας, σωματίδια. Ο θόρυβος είναι
   «κολλημένος» στο έδαφος, οπότε όταν κυλάει η εικόνα, κυλάει μαζί του όπως σε πραγματικό βυθόμετρο. */
function echoCanvas(wpx,hpx,col){ try{ var cv=document.createElement('canvas'); cv.width=wpx; cv.height=hpx; var cx=cv.getContext('2d'); if(!cx) return null; var im=cx.createImageData(wpx,hpx), D=im.data;
  for(var px=0;px<wpx;px++){ var C=col(px); if(!C) continue; var hard=0.35+0.65*vnz(C.gx/55), L=Math.max(0.6,(2.2+4.5*hard)/(1+3*Math.min(1,C.sl||0))), cgx=Math.floor(C.gx/0.9);
    for(var py=0;py<hpx;py++){ var z=C.z(py), I=0.06, nz=hsh2(cgx,Math.floor(z/0.22));
      if(C.surf&&z<1.6) I=Math.max(I,0.62*Math.exp(-z/0.55));
      if(C.d!=null&&z>=C.d){ var dz=z-C.d; I=dz<(0.5+0.7*hard)/(1+2*Math.min(1,C.sl||0))?0.97:0.93*Math.exp(-dz/L); I=Math.max(I,0.13); var z2=z-2*C.d; if(C.d2&&z2>=0) I=Math.max(I,0.45*hard*Math.exp(-z2/(L*0.8))); }
      else if(nz>0.993) I=0.3+0.25*hsh2(cgx+7,py);
      I+=(nz-0.5)*(I>0.12?0.16:0.07); var k=0; while(EPAL[k][0]<I&&k<EPAL.length-1) k++; var c=EPAL[k][1], o=(py*wpx+px)*4; D[o]=c[0]; D[o+1]=c[1]; D[o+2]=c[2]; D[o+3]=255; } }
  cx.putImageData(im,0,0); return cv.toDataURL('image/jpeg',0.86); }catch(e){ return null; } }
/* 1.8.27: ο βυθός είναι πιο βαθύς απ' όσο φτάνει η αρματωσιά με όλα της τα μολύβια */
function tooDeep(c,v,D){ if(D==null||c.mode!=='bottom') return null; var r=rigOf(c), mx=+r.max||80, g=geo0(Object.assign({},c,{auto:false,leads:mx,dep:null}),v!=null&&v>0.8?v:(+r.v0||3)); if(!g) return null; return g.dl<D-tgt()*FATH-0.5*FATH?{mx:mx,dl:g.dl}:null; }
function echoOn(){ return ls.get('alkyon-trecho',false)===true; }
/* ηχώ βυθού σαν βυθόμετρο: κόκκινο (σκληρό) → κίτρινο → πράσινο → μπλε κάτω από τη γραμμή του βυθού */
var ECHO=[[30,'#0d2f8f',1],[22,'#1d63ff',.9],[15,'#19c3ff',.9],[10,'#39d353',.95],[6,'#ffe100',1],[3,'#ff8a00',1],[1.2,'#ff2a14',1]];
function hsh(i){ var x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x); }
/* 1.8.22: μετάβαση μετά από − / +: το δόλωμα δεν πηδάει ακαριαία στο νέο βάθος/απόσταση (ούτε πίσω σε σημείο που έχει ήδη περάσει).
   Για όσο θέλει το άφημα/μάζεμα + «να κάτσει», βάθος και απόσταση πάνε σταδιακά από το παλιό στο νέο → όχι ψεύτικο «βαράει βυθό» όταν αφήνεις */
var TR=null;
function trNote(n0,n1){ if(n0===n1) return; var now=Date.now(); if(TR&&now<TR.t0+TR.T) n0=TR.n0; else TR=null; if(n0===n1){ TR=null; return; }
  var w=(typeof SIM!=='undefined'&&SIM&&SIM.warp)||1, T=(Math.abs(n1-n0)*(n1>n0?tLet():tPull())+tSettle())*1000/w; TR={n0:n0,n1:n1,t0:TR?TR.t0:now,T:T}; }
function trF(){ if(!TR) return null; var f=(Date.now()-TR.t0)/TR.T; if(f>=1){ TR=null; return null; } return Math.max(0,f); }
function geo(c,kn,dep){ c=c||cfg(); var g=geo0(c,kn,dep); if(!g||!TR||!c.dep||c.dep.st!=='set'||c.auto!==false||g.n!==TR.n1) return g; var f=trF(); if(f==null) return g;
  var g0=geo0(Object.assign({},c,{leads:TR.n0,dep:null}),kn); if(!g0) return g; return Object.assign({},g,{dl:g0.dl+(g.dl-g0.dl)*f,lb:g0.lb+(g.lb-g0.lb)*f,tr:f}); }
function geo0(c,kn,dep){ c=c||cfg(); var r=rigOf(c), n0=nLeads(c,dep), n=Math.min(n0,+r.max||80), gap=(+r.gap||5)*FATH; if(!n) return null;
  /* πετονιά από το κοντινότερο στη βάρκα μολύβι ως το 1ο (πιο βαθύ): (n−1) αποστάσεις, + ~1 οργιά ως την κορυφή του καλαμιού */
  if(isPhys(r)&&!+c.lineB){ var vv=kn!=null&&kn>0.3?kn:(+r.v0||3), cb=cable(r,vv); if(cb&&cb.Z[n]!=null) return {dl:cb.Z[n]*Math.max(0.8,Math.min(1.25,+r.kD||1)),lb:cb.X[n],L:null,n:n,short:n0>n,rig:r,phys:true}; }
  var L=+c.lineB||Math.max(1,n-1)*gap+FATH, v=kn!=null&&kn>0.3?kn:(+r.v0||+c.v0||3), v0=+r.v0||+c.v0||3, cos0=Math.min(0.98,Math.max(0.05,n*FATH/L)), t0=Math.sqrt(1-cos0*cos0)/cos0, th=Math.atan(t0*(v/v0)*(v/v0));
  var tail=(+r.leader||0)+(+r.blank||0)*FATH;   /* παράμαλλο + κενό: πίσω από το 1ο μολύβι */
  return {dl:L*Math.cos(th)*Math.max(0.8,Math.min(1.25,+r.kD||1))*Math.max(0.3,Math.min(3,+r.fpl||1)),lb:L*Math.sin(th)+tail,L:L,n:n,short:n0>n,rig:r}; }
function layback(c,kn,dep){ c=c||cfg(); var v; if(c.mode!=='bottom') v=Math.max(0,+c.line||0); else { var g=geo(c,kn,dep); v=g?g.lb:null; } return v==null?null:v*(+(c.mode==='bottom'?c.calB:c.calS)||1); }
function lureDepth(c,kn){ c=c||cfg(); if(c.mode!=='bottom') return null; var g=geo(c,kn); return g?g.dl:null; }
/* 1.6.2: ο βυθός μπροστά (κάτω από τη βάρκα, εκεί που θα περάσει το δόλωμα) πιο ρηχός από το δόλωμα: δόνηση και πόσα μολύβια να μαζέψεις */
var lastBot=0;
/* 1.6.3: αυτόματα: ο βυθός κάτω από τη βάρκα (εκεί που θα περάσει το δόλωμα) ανεβαίνει ≥ 2 οργιές σε σχέση με το δόλωμα → μάζεψε μολύβια.
   Με δικό σου αριθμό: ο βυθός μπροστά είναι πιο ρηχός από τα μολύβια + 1 οργιά. */
function bottomCheck(){ var c=cfg(); if(c.mode!=='bottom'||depth==null) return; var now=Date.now(), k=0, msg='';
  if(c.dep&&c.dep.st==='drop') return;
  if(c.dep&&c.dep.st==='set'&&depthL!=null){ var g1=geo(c,vEff()); if(!g1) return; var cl=clear(c); if(cl!=null&&cl<-0.5*FATH){ k=Math.max(1,Math.ceil(-cl/FATH)); msg=T('⚠ Βαράει βυθό: ~','⚠ Hitting bottom: ~')+faTxt(depthL)+T(' στο δόλωμα, η αρματωσιά ~',' at the lure, rig at ~')+faTxt(g1.dl)+T(': μάζεψε ~',': bring in ~')+k+T(k===1?' μολύβι':' μολύβια',k===1?' lead':' leads'); }
    if(k>0&&now-lastBot>90000){ lastBot=now; try{ navigator.vibrate&&navigator.vibrate([600,200,600,200,600]); }catch(e){} B.toast(msg,8000); if(B.say) B.say(T('Βαράει βυθό, μάζεψε ','Hitting bottom, bring in ')+k,'troll','bot',80000); } return; }
  if(c.auto!==false){ if(depthL==null) return; var up=fa(depthL)-fa(depth); if(up>=2){ k=up; msg=T('⚠ Ο βυθός ανεβαίνει: ~','⚠ Bottom rising: ~')+faTxt(depth)+T(' μπροστά, ~',' ahead, ~')+faTxt(depthL)+T(' στο δόλωμα: μάζεψε ~',' at the lure: bring in ~')+k+T(k===1?' μολύβι':' μολύβια',k===1?' lead':' leads'); } }
  else { var n=nLeads(c); if(fa(depth)<n+1){ k=n+1-fa(depth); msg=T('⚠ Βυθός μπροστά ~','⚠ Bottom ahead ~')+faTxt(depth)+T(', έχεις ',', you have ')+n+T(' μολύβια: μάζεψε ',' leads: bring in ')+k; } }
  if(k>0&&now-lastBot>90000){ lastBot=now; try{ navigator.vibrate&&navigator.vibrate([600,200,600,200,600]); }catch(e){} B.toast(msg,8000); if(B.say) B.say(T('Βαράει βυθό, μάζεψε ','Hitting bottom, bring in ')+k,'troll','bot',80000); } }
/* ---------- 1.7.0: ρίξιμο συρτής βυθού ----------
   «Ρίχνω» (πρώτο μολύβι στο νερό, προαιρετικά τι δείχνει το βυθόμετρο) → όσο ρίχνεις: «Σταμάτα στα Ν» (πόσα μολύβια ώστε η αρματωσιά
   να φτάσει λίγο πάνω από τον βυθό στο σημείο όπου θα καταλήξει το δόλωμα) → «Στον βυθό ✓» κλειδώνει τα μολύβια. Αν ξεχαστεί: μόνο του
   μετά από 2′ σταθερής ταχύτητας. «Ακούμπησε βυθό»: η αρματωσιά πήγε βαθύτερα απ’ ό,τι υπολόγιζε → διορθώνεται ο συντελεστής της (kD).
   Διορθώσεις βάθους (alkyon-dcorr): βυθόμετρο − χάρτης σε σημεία, για τον δικό σου χάρτη βυθού. */
var CK='alkyon-dcorr', recN=null, recD=null, recLb=null, stillSince=0;
function corrs(){ var a=ls.get(CK,null); return Array.isArray(a)?a:[]; }
function corrAt(lat,lon){ var a=corrs(), sw=0, sv=0; for(var i=0;i<a.length;i++){ var d=dist([lat,lon],[a[i][0],a[i][1]]); if(d>2000) continue; var w=1/Math.pow(Math.max(d,60),2); sw+=w; sv+=w*a[i][2]; }
  if(!sw) return 0; var near=Math.min(1,sw*Math.pow(300,2)); return sv/sw*near; }   /* μακριά από τις μετρήσεις, η διόρθωση σβήνει */
function addCorr(lat,lon,off){ if(!isFinite(off)||Math.abs(off)>60) return; var a=corrs().filter(function(q){ return dist([lat,lon],[q[0],q[1]])>40; }); a.push([+lat.toFixed(5),+lon.toFixed(5),+off.toFixed(1),Date.now()]); if(a.length>400) a=a.slice(-400); ls.set(CK,a); }
function dAt(lat,lon){ if(B.sounder){ var lv=B.sounder.liveAt(lat,lon,40); if(lv==null) lv=B.sounder.nearSync(lat,lon,25); if(lv!=null) return Promise.resolve(lv); } /* 1.10.12: βυθόμετρο / «Ο βυθός μου» πρώτα, χωρίς διόρθωση */ var gd=typeof gD==='function'&&SV&&SV.grid?gD(lat,lon):null; if(gd!=null) return Promise.resolve(gd); /* 1.8.7: από το πλέγμα γύρω σου, χωρίς αίτημα */ return B.depthAt(lat,lon).then(function(d){ if(d==null||d<=0) return d; return Math.max(1,d+corrAt(lat,lon)); }); }
/* πόσο πάνω από τον βυθό (m) είναι η αρματωσιά στο σημείο του δολώματος· αρνητικό = σέρνει/βαράει */
function clear(c){ c=c||cfg(); if(depthL==null) return null; var g=geo(c,vEff(),depthL); return g?depthL-g.dl:null; }
/* μολύβια ώστε η αρματωσιά να είναι ~½ οργιά πάνω από βυθό D */
function bestN(c,kn,D){ var r=rigOf(c), mx=+r.max||80, best=1; for(var n=1;n<=mx;n++){ var g=geo(Object.assign({},c,{auto:false,leads:n,dep:null}),kn); if(!g) continue; if(g.dl<=D-tgt()*FATH+0.3) best=n; else break; /* 1.8.14: +0,3 m ώστε 20 οργ. → 19 μολύβια ακριβώς */ } return best; }
function recommend(f){ var c=cfg(), boat={lat:f.lat,lon:f.lon}, D=depth, n=bestN(c,spd,D), r=0;
  function step(){ var g=geo(Object.assign({},c,{auto:false,leads:n,dep:null}),spd); if(!g) return null; var lb=g.lb*(+c.calB||1), q=behind(boat,lb); if(!q) return null; recLb=lb;
    return dAt(q.lat,q.lon).then(function(d){ if(d==null||d<=0) return; D=d; var n2=bestN(c,spd,d); if(n2!==n&&++r<3){ n=n2; return step(); } n=n2; }); }
  return Promise.resolve(step()).catch(function(){}).then(function(){ var ch=recN!==n; recN=n; recD=D; depthL=D; if(B.say&&ch) B.say(T('Σταμάτα στα ','Stop at ')+n+T(' μολύβια',' leads'),'troll','rec'+n,60000); }); }
function startDrop(sounderFa){ var c=cfg(), f=tFix()||B.lastPos(); c.mode='bottom'; c.dep={st:'drop',t:Date.now(),lat:f?f.lat:null,lon:f?f.lon:null}; recN=null; recD=null; recLb=null; stillSince=0; depthAt=0; put(c); metStart(); if(f) gridFor(f);
  if(sounderFa>0&&f&&B.depthAt){ B.depthAt(f.lat,f.lon).then(function(d){ if(d==null||d<=0) return; var off=sounderFa*FATH-d; addCorr(f.lat,f.lon,off); depthAt=0; check();
      B.toast(T('Βυθόμετρο ','Sounder ')+sounderFa+T(' οργ. · χάρτης ',' fm · chart ')+faTxt(d)+(Math.abs(off)>=FATH?T(' · διόρθωση ',' · correction ')+(off>0?'+':'')+fa(off)+T(' οργ. γύρω από εδώ',' fm around here'):T(' · συμφωνούν',' · they agree')),5000); }).catch(function(){}); }
  else check(); }
function setDown(n,why){ var c=cfg(); if(!c.dep) c.dep={}; var nn=n!=null?n:(recN!=null?recN:nLeads(c)); c.auto=false; c.leads=Math.max(1,Math.min(80,nn)); c.dep.st='set'; c.dep.set=Date.now(); /* 1.8.14: η ισοβαθής μπαίνει μόνο όταν τη διαλέξεις («Κράτα αυτό το βάθος») */ put(c); depthAt=0; metStop(); /* 1.8.7: η ισοβαθής που κρατάς = ο βυθός στο δόλωμα τώρα */
  try{ navigator.vibrate&&navigator.vibrate([80,60,80]); }catch(e){} if(B.say) B.say(T('Στον βυθό. ','On the bottom. ')+c.leads+T(' μολύβια',' leads'),'troll','set',5000); B.toast((why==='auto'?T('Στον βυθό (αυτόματα, 2′ σταθερή ταχύτητα): ','On the bottom (auto, 2′ steady speed): '):T('Στον βυθό: ','On the bottom: '))+c.leads+T(' μολύβια',' leads'),4000); check(); }
function dropAuto(c,now){ if(spd!=null&&spd>=c.min&&spd<=c.max){ if(!stillSince) stillSince=now; } else stillSince=0;
  if(stillSince&&now-stillSince>120000&&now-c.dep.t>120000&&recN!=null) setDown(recN,'auto'); }
function cancelDrop(){ var c=cfg(); c.dep=null; c.auto=true; recN=null; put(c); metStop(); }
/* ακούμπησε βυθό: η αρματωσιά είναι στο βάθος του βυθού στο σημείο του δολώματος → συντελεστής βάθους της αρματωσιάς */
function touched(){ var c=cfg(); if(c.mode!=='bottom'){ return; } if(depthL==null){ B.toast(T('Περιμένω βάθος για το σημείο του δολώματος…','Waiting for the depth at the lure…')); return; }
  var r=rigOf(c), g=geo(c,vEff(),depthL); if(!g) return; var raw=g.dl/Math.max(0.8,Math.min(1.25,+r.kD||1)), ratio=Math.max(0.75,Math.min(1.35,depthL/raw)), old=+r.kD||1, nw=+Math.max(0.8,Math.min(1.25,old*0.6+old*ratio*0.4)).toFixed(3);
  var a=rigs().slice(), i=a.map(function(x){ return x.id; }).indexOf(r.id), nr=Object.assign({},r,{kD:nw,kN:(+r.kN||0)+1}); if(i<0) a.push(nr); else a[i]=nr; ls.set(RK,a);
  c.auto=false; c.leads=Math.max(1,g.n-1); if(c.dep&&c.dep.st==='set') trNote(g.n,c.leads); if(c.dep) c.dep.st='set'; else c.dep={st:'set',t:Date.now()}; put(c); lastBot=Date.now();
  try{ navigator.vibrate&&navigator.vibrate(30); }catch(e){}
  B.toast(T('Σημείωσα: ακούμπησε στα ~','Noted: touched at ~')+faTxt(depthL)+T(' με ',' with ')+g.n+T(' μολύβια. Η αρματωσιά «','  leads. Rig “')+r.name+T('» διορθώθηκε ×','” adjusted ×')+B.num(nw,2)+T(' · μάζεψε 1 → ',' · bring in 1 → ')+c.leads,7000); }
function dropSheet(){ var sh, inp=h('input',{type:'number',inputmode:'numeric',min:'1',max:'200',placeholder:T('π.χ. 32','e.g. 32')});
  var body=h('div',{class:'bform'},h('p',{class:'sub',text:T('Πάτα «Ξεκινώ» μόλις πέσει το πρώτο μολύβι. Όσο ρίχνεις, η εφαρμογή σου λέει σε ποιο μολύβι να σταματήσεις, από το βάθος εκεί που θα καταλήξει το δόλωμα.','Tap “Start” as the first lead goes in. While you let out, the app tells you at which lead to stop, from the depth where the lure will end up.')}),
    h('label',{class:'fld'},h('span',{text:T('Τι δείχνει το βυθόμετρο τώρα (οργιές) · προαιρετικό','Sounder now (fathoms) · optional')}),inp),
    h('p',{class:'foot',text:T('Με το βυθόμετρο διορθώνεται ο χάρτης βυθού εδώ γύρω, και κρατιέται για την επόμενη φορά.','With the sounder reading the depth chart is corrected around here, and kept for next time.')}),
    h('button',{class:'btn pri full',type:'button',text:T('Ξεκινώ να ρίχνω','Start letting out'),onclick:function(){ var v=+inp.value||0; sh&&sh.close&&sh.close(true); B.closeSheet&&B.closeSheet(); startDrop(v); }}));
  sh=B.sheet({title:T('Ρίχνω την αρματωσιά','Letting out the rig'),body:body,stack:true}); }
/* − / +: από εκεί και πέρα ο δικός σου αριθμός, μέχρι το τέλος της εξόδου (ή μέχρι να ξαναβάλεις «Αυτόματα») */
function setLeads(d){ var c=cfg(), n=nLeads(c); if(c.dep&&c.dep.st==='drop'){ recN=Math.max(1,Math.min(80,n+d)); paint(); return; } c.auto=false; var nn=Math.max(0,Math.min(80,n+d)); if(c.dep&&c.dep.st==='set') trNote(n,nn); c.leads=nn; put(c); try{ navigator.vibrate&&navigator.vibrate(20); }catch(e){} if(d<0) bottomCheck(); }
function setAuto(){ var c=cfg(); c.auto=true; c.dep=null; put(c); }
/* σημείο πάνω στη διαδρομή, m μέτρα πίσω από τη βάρκα */
function behind(boat,m){ var p=pts(), cur=[boat.lat,boat.lon], left=m;
  for(var i=p.length-1;i>=0&&left>0;i--){ var q=[p[i][0],p[i][1]], d=dist(cur,q); if(d<0.5) continue;
    if(d>=left){ var f=left/d; return {lat:cur[0]+(q[0]-cur[0])*f,lon:cur[1]+(q[1]-cur[1])*f,on:true}; } left-=d; cur=q; }
  if(left<=0) return {lat:cur[0],lon:cur[1],on:true};
  if(hdg==null) return null; var e=dest(cur[0],cur[1],(hdg+180)%360,left); return {lat:e[0],lon:e[1],on:false}; }
/* 1.6.1: διόρθωση από τον χρήστη: πραγματική απόσταση βάρκας → ψαριού / υπολογισμένη. Κρατιέται (κινητός μέσος) ξεχωριστά για αφρό και βυθό */
function calibrate(rec,la,lo){ if(!rec||!rec.troll||typeof rec.boatLat!=='number'||!rec.troll.lb) return null; var real=dist([rec.boatLat,rec.boatLon],[la,lo]); if(real<2) return null;
  var r=Math.max(0.3,Math.min(3,real/rec.troll.lb)), c=cfg(), k=rec.troll.m==='bottom'?'calB':'calS', old=+c[k]||1, nw=+(old*0.6+old*r*0.4).toFixed(3); c[k]=nw; ls.set(K,c);
  return T('Συρτή: το δόλωμα ήταν ~','Trolling: the lure was ~')+Math.round(real)+T(' m πίσω (υπολογισμός ',' m back (estimate ')+rec.troll.lb+T(' m). Από εδώ και πέρα ο υπολογισμός διορθώνεται ×',' m). Future estimates are adjusted ×')+B.num(nw,2)+'.'; }
function techName(c){ return c.mode==='bottom'?T('Συρτή βυθού','Deep / bottom trolling'):T('Συρτή αφρού','Surface trolling'); }
/* καλείται από τη φόρμα ψαριού και την γρήγορη καταγραφή: rec.lat/lon = θέση της βάρκας → γίνεται θέση του δολώματος */
function adjust(rec){ if(rec&&!rec.gear&&cfg().mode==='bottom'&&on()){ setTimeout(function(){ fishLog(rec); },0); markCatch(!!rec.miss); } if(SIM&&rec&&SIM.fix){ rec.lat=SIM.fix.lat; rec.lon=SIM.fix.lon; rec.sim=1; } if(!on()||!rec||typeof rec.lat!=='number'||rec.gear) return false; measure(); var c=cfg(), lb=layback(c,vEff());
  var gg=c.mode==='bottom'?geo(c,vEff()):null; rec.troll={rig:gg&&gg.rig?gg.rig.name:undefined,m:c.mode,kn:spd!=null?+spd.toFixed(1):null,hd:hdg!=null?Math.round(hdg):null,leads:gg?gg.n:null,dl:gg?Math.round(gg.dl):null,line:c.mode==='bottom'?(gg?Math.round(gg.L):null):+c.line||null,auto:c.mode==='bottom'&&c.auto!==false?1:0}; if(SV.stw!=null) rec.troll.stw=+SV.stw.toFixed(1); if(gg) rec.troll.fath=+(gg.dl/FATH).toFixed(1); if(c.iso) rec.troll.iso=+c.iso; /* 1.8.7: για το «Τι δούλεψε» */
  if(rec.troll.auto){ rec.troll.k=Date.now().toString(36)+Math.random().toString(36).slice(2,6); var kk=rec.troll.k, kn0=spd; setTimeout(function(){ refine(kk,kn0); },600); }
  if(!rec.tech) rec.tech=techName(c);
  if(c.lures&&c.lures.length){ var tk=(rec.tk||[]).slice(); c.lures.forEach(function(id){ if(tk.indexOf(id)<0) tk.push(id); }); rec.tk=tk; }
  if(lb!=null&&lb>3){ var q=behind({lat:rec.lat,lon:rec.lon},lb); if(q){ rec.boatLat=rec.lat; rec.boatLon=rec.lon; rec.lat=+q.lat.toFixed(5); rec.lon=+q.lon.toFixed(5); rec.troll.lb=Math.round(lb); if(!q.on) rec.troll.est=1; var xm=trackM(); if(xm!=null) rec.troll.x=Math.round(xm-lb); } }
  if(c.mode==='bottom'&&(rec.depth==null||rec.depth==='')){ if(gg){ rec.depth=Math.round(gg.dl); rec.depthSrc='leads'; } else if(depth!=null){ rec.depth=Math.round(depth); rec.depthSrc='chart'; } }
  return true; }

/* 1.6.3: αυτόματα: μετά την καταγραφή, το βάθος στο σημείο του δολώματος → μολύβια → πόσο πίσω → νέο σημείο (2 γύροι) */
function refine(k,kn){ var S=B.store; if(!S||!B.depthAt) return; var b=S.raw('bites').filter(function(x){ return x.troll&&x.troll.k===k; })[0]; if(!b||typeof b.boatLat!=='number') return;
  var c=cfg(), boat={lat:b.boatLat,lon:b.boatLon}, pos={lat:b.lat,lon:b.lon}, g=null, D=null, round=0;
  function step(){ return dAt(pos.lat,pos.lon).then(function(d){ if(d==null||d<=0) return; D=d; g=geo(c,kn,d); if(!g) return; var lb=g.lb*(+c.calB||1), q=behind(boat,lb); if(q) pos={lat:q.lat,lon:q.lon,lb:lb,on:q.on}; if(++round<2) return step(); }); }
  step().then(function(){ if(!g||D==null) return; var cur=S.get('bites',b.id); if(!cur||!cur.troll||cur.troll.fixed) return;
    var tr=Object.assign({},cur.troll,{leads:g.n,dl:Math.round(g.dl),line:Math.round(g.L),lb:Math.round(pos.lb||cur.troll.lb||0),fath:fa(D)}); delete tr.k; if(pos.on===false) tr.est=1;
    S.save('bites',Object.assign({},cur,{lat:+pos.lat.toFixed(5),lon:+pos.lon.toFixed(5),troll:tr},cur.depthSrc==='leads'||cur.depth==null?{depth:Math.round(g.dl),depthSrc:'leads'}:{})); B.emit('store','alkyon-bites'); }).catch(function(){}); }

/* 1.6.4: ψάρι από το ρολόι σε συρτή (wtr: {m, kn, hd, n, ln}): η θέση του ρολογιού είναι η βάρκα. Πίσω πάνω στη διαδρομή του κινητού,
   αν το κινητό κατέγραφε εκείνη την ώρα, αλλιώς σε ευθεία αντίθετα από την πορεία. Μολύβια: όσα έστειλε το ρολόι ή αυτόματα από τον βυθό. */
function backAlong(boat,m,ms,hd){ var t=ls.get('alkyon-track',null), p=(t&&Array.isArray(t.pts)?t.pts:[]).filter(function(q){ return q[2]<=ms+5000; });
  var cur=[boat.lat,boat.lon], left=m;
  if(p.length>1&&ms-p[p.length-1][2]<120000){ for(var i=p.length-1;i>=0&&left>0;i--){ var q=[p[i][0],p[i][1]], d=dist(cur,q); if(d<0.5) continue; if(d>=left){ var f=left/d; return {lat:cur[0]+(q[0]-cur[0])*f,lon:cur[1]+(q[1]-cur[1])*f,on:true}; } left-=d; cur=q; } if(left<=0) return {lat:cur[0],lon:cur[1],on:true}; }
  if(hd==null) return null; var e=dest(cur[0],cur[1],(hd+180)%360,left); return {lat:e[0],lon:e[1],on:false}; }
function fromWatch(o,ms){ var w=o&&o.wtr; if(!w||typeof o.lat!=='number'||o.troll) return Promise.resolve(null); var c=cfg(), boat={lat:o.lat,lon:o.lon};
  var cc=Object.assign({},c,{mode:w.m,auto:w.n==null,leads:w.n||c.leads,line:w.ln||c.line});
  var tr={m:w.m,kn:w.kn,hd:w.hd,src:'watch',auto:w.m==='bottom'&&w.n==null?1:0}, out=Object.assign({},o,{boatLat:o.lat,boatLon:o.lon,tech:o.tech||techName(cc)});
  function fin(lb,g,D){ var q=lb!=null&&lb>3?backAlong(boat,lb,ms,w.hd):null; if(q){ out.lat=+q.lat.toFixed(5); out.lon=+q.lon.toFixed(5); if(!q.on) tr.est=1; } tr.lb=lb!=null?Math.round(lb):null;
    if(g){ tr.leads=g.n; tr.dl=Math.round(g.dl); tr.line=Math.round(g.L); if(D!=null) tr.fath=fa(D); if(out.depth==null){ out.depth=Math.round(g.dl); out.depthSrc='leads'; } }
    out.troll=tr; return out; }
  if(w.m!=='bottom') return Promise.resolve(fin(Math.max(0,+cc.line||0)*(+c.calS||1),null,null));
  if(!cc.auto||!B.depthAt){ var g0=geo(cc,w.kn); return Promise.resolve(fin(g0?g0.lb*(+c.calB||1):null,g0,null)); }
  var pos=boat, g=null, D=null, r=0;
  function step(){ return dAt(pos.lat,pos.lon).then(function(d){ if(d==null||d<=0) return; D=d; g=geo(cc,w.kn,d); if(!g) return; var q=backAlong(boat,g.lb*(+c.calB||1),ms,w.hd); if(q) pos=q; if(++r<2) return step(); }); }
  return step().catch(function(){}).then(function(){ return fin(g?g.lb*(+c.calB||1):null,g,D); }); }

/* 1.6.5: κατακόρυφο προφίλ: βυθός κάτω από τη βάρκα και δόλωμα (βάθος, θέση πάνω στη διαδρομή) σε κάθε μέτρηση.
   x = μέτρα πάνω στη διαδρομή της εξόδου. Στο τέλος της εξόδου μπαίνει στην έξοδο (trprof). */
var PK='alkyon-trprof';
function trackM(){ var t=tTrack(); return t&&t.m!=null?+t.m:null; }
function sample(){ if(!on()||depth==null) return; var c=cfg(); if(c.mode==='bottom'&&c.dep&&c.dep.st==='drop') return; var x=trackM(); if(x==null) return; var s=B.trip.state(), sid=s&&s.id; if(!sid) return;
  var P=ls.get(PK,null); if(!P||P.id!==sid) P={id:sid,s:[]}; var lb=layback(c,spd), dl=lureDepth(c,spd), g=c.mode==='bottom'?geo(c,spd):null;
  var last=P.s[P.s.length-1]; if(last&&Math.abs(x-last[0])<8&&Date.now()-last[1]<60000) return;
  P.s.push([Math.round(x),Date.now(),+depth.toFixed(1),dl!=null?+dl.toFixed(1):null,lb!=null?Math.round(lb):null,g?g.n:null,spd!=null?+spd.toFixed(1):null,c.mode==='bottom'?1:0]);
  if(P.s.length>800) P.s=P.s.filter(function(_,i){ return i%2===0||i===P.s.length-1; }); ls.set(PK,P); }
function profOf(sid){ var P=ls.get(PK,null); return P&&P.id===sid?P.s:null; }
/* γράφημα: βυθός (γεμάτο), δόλωμα (πορτοκαλί γραμμή, μετατοπισμένη πίσω κατά την απόσταση του δολώματος), ψάρια (κουκκίδες) */
function profileSheet(s,fish,title){ if(!s||s.length<2){ B.toast(T('Δεν υπάρχουν ακόμα αρκετές μετρήσεις βάθους (κάθε 15″ στη συρτή).','Not enough depth readings yet (every 15 s while trolling).')); return; }
  var W=640, H=320, ml=70, mr=72, mt=16, mb=40, x0=s[0][0], x1=s[s.length-1][0], dmax=0;
  s.forEach(function(q){ dmax=Math.max(dmax,q[2]||0,q[3]||0); }); dmax=Math.ceil((dmax*1.1+2)/10)*10;
  var X=function(x){ return ml+(x-x0)/Math.max(1,x1-x0)*(W-ml-mr); }, Y=function(d){ return mt+d/dmax*(H-mt-mb); };
  var bed='M'+X(x0)+','+(H-mb)+s.map(function(q){ return ' L'+X(q[0]).toFixed(1)+','+Y(q[2]).toFixed(1); }).join('')+' L'+X(x1)+','+(H-mb)+' Z';
  var lure=''; s.forEach(function(q){ if(q[3]==null) return; var lx=q[0]-(q[4]||0); if(lx<x0) return; lure+=(lure?' L':'M')+X(lx).toFixed(1)+','+Y(q[3]).toFixed(1); });
  var g='', NS='http://www.w3.org/2000/svg';
  for(var k=0;k<=5;k++){ var d=dmax*k/5, y=Y(d); g+='<line x1="'+ml+'" x2="'+(W-mr)+'" y1="'+y+'" y2="'+y+'" class="pg"/><text x="'+(ml-6)+'" y="'+(y+4)+'" text-anchor="end" class="pt">'+Math.round(d)+' m</text><text x="'+(W-mr+6)+'" y="'+(y+4)+'" class="pt">'+fa(d)+T(' οργ',' fm')+'</text>'; }
  var km=(x1-x0)/1000; for(var j=0;j<=4;j++){ var xv=x0+(x1-x0)*j/4; g+='<text x="'+X(xv)+'" y="'+(H-12)+'" text-anchor="middle" class="pt">'+B.num((xv-x0)/1000,km<3?1:0)+' km</text>'; }
  var fd=''; (fish||[]).forEach(function(b){ var tr=b.troll; if(!tr||tr.x==null) return; var d=tr.dl!=null?tr.dl:(b.depth||null); if(d==null) return; fd+='<circle cx="'+X(tr.x)+'" cy="'+Y(d)+'" r="6" class="pf"/>'; });
  var svg='<svg viewBox="0 0 '+W+' '+H+'" class="tprof" role="img" aria-label="'+T('Προφίλ βυθού και δολώματος','Seabed and lure profile')+'">'+g+'<path d="'+bed+'" class="pb"/>'+(lure?'<path d="'+lure+'" class="pl"/>':'')+fd+'</svg>';
  var last=s[s.length-1], box=h('div',{class:'tprofw',html:svg});
  B.sheet({title:title||T('Προφίλ βυθού','Seabed profile'),body:h('div',null,box,
    h('div',{class:'tleg'},h('span',{class:'lb'},T('βυθός','seabed')),h('span',{class:'ll'},T('δόλωμα','lure')),fd?h('span',{class:'lf'},T('ψάρι','catch')):null),
    h('p',{class:'sub',text:B.num(km,1)+' km · '+s.length+T(' μετρήσεις · βυθός από ',' readings · seabed ')+faM(Math.min.apply(null,s.map(function(q){ return q[2]; })))+T(' έως ',' to ')+faM(Math.max.apply(null,s.map(function(q){ return q[2]; })))}),
    h('p',{class:'foot',text:T('Βυθός από τον χάρτη βαθών EMODnet κάτω από τη βάρκα. Το δόλωμα είναι εκτίμηση από την αρματωσιά και την ταχύτητα, στη θέση όπου ήταν (πίσω από τη βάρκα).','Seabed from the EMODnet depth chart under the boat. The lure is an estimate from the rig and speed, at the place it was (behind the boat).')}))}); }
B.trollProfile=function(t){ var sid=t?(t.sid||t.id):(B.trip.state()||{}).id, s=t&&t.trprof?t.trprof:profOf(sid), fish=B.store?B.store.raw('bites').filter(function(b){ return !b.deleted&&b.trip===sid&&b.troll; }):[]; profileSheet(s,fish,t?(t.spot||T('Έξοδος','Trip'))+T(' · προφίλ',' · profile'):null); };
/* στο τέλος της εξόδου: το προφίλ μπαίνει στην έξοδο */
B.on('tripend',function(e){ if(!e||!e.id||!B.store) return; var P=ls.get(PK,null); if(!P||!P.s||P.s.length<2) return; var t=B.store.get('trips',e.id); if(!t||(t.sid&&t.sid!==P.id)) return; B.store.save('trips',Object.assign({},t,{trprof:P.s})); ls.set(PK,null); });

/* ---------- ένδειξη στον χάρτη ---------- */
var pill=null;
function paint(){ var c=cfg(), show=on()&&!(c.mode==='bottom'&&document.body.classList.contains('mapon')); /* 1.8.14: στη συρτή βυθού στον χάρτη μόνο η νέα κάρτα */
  if(!pill){ if(!show) return; pill=h('div',{class:'trwrap'}); document.body.append(pill); }
  pill.hidden=!show; document.body.classList.toggle('trolling',show); if(!show) return;
  var st=spd==null?'na':spd<c.min?'lo':spd>c.max?'hi':'ok', lb=layback(c,spd), dl=lureDepth(c,spd);
  var main=h('button',{class:'trpill '+st,type:'button','aria-live':'polite',onclick:function(){ sheet(); }},h('small',{text:techName(c)}),h('b',{text:spd==null?'–':B.num(spd,1)}),h('em',{text:'kn · '+c.min+'–'+c.max}),
    depth!=null?h('span',{class:'trdep'+(c.mode==='bottom'&&depthL!=null&&fa(depthL)-fa(depth)>=2?' warn':'')},h('small',{text:T('ΒΥΘΟΣ','BOTTOM')}),h('b',{text:fa(depth)+T(' οργ.',' fm')}),h('em',{text:Math.round(depth)+' m'})):null,
    h('i',{text:(dl!=null?T('δόλωμα ~','lure ~')+faM(dl)+' · ':'')+(lb!=null?(dl!=null?'':T('δόλωμα ~','lure ~'))+Math.round(lb)+T(' m πίσω',' m back'):(c.mode==='bottom'?T('περιμένω βάθος…','waiting for depth…'):''))}));
  var kids=[main], dst=c.mode==='bottom'&&c.dep?c.dep.st:null;
  if(c.mode==='bottom'){ var minus=h('button',{type:'button','aria-label':T('Ένα μολύβι λιγότερο','One lead less'),text:'−',onclick:function(){ setLeads(-1); }}), plus=h('button',{type:'button','aria-label':T('Ένα μολύβι παραπάνω','One lead more'),text:'+',onclick:function(){ setLeads(1); }});
    if(dst==='drop'){ /* 1.7.0: όσο ρίχνεις: σε ποιο μολύβι να σταματήσεις */
      kids.push(h('div',{class:'trdrop'},h('small',{text:T('ΣΤΑΜΑΤΑ ΣΤΑ','STOP AT')}),h('div',{class:'trdn'},minus,h('b',{text:recN!=null?String(recN):'…'}),h('span',{text:T('μολύβια','leads')}),plus),
        h('em',{text:recN!=null?T('βυθός εκεί ~','bottom there ~')+(recD!=null?faTxt(recD):'–')+(recLb!=null?' · '+Math.round(recLb)+T(' m πίσω',' m back'):''):T('υπολογίζω από τον βυθό πίσω σου…','working it out from the bottom behind you…')}),
        h('div',{class:'trdb'},h('button',{class:'btn pri',type:'button',text:T('Στον βυθό ✓','On the bottom ✓'),onclick:function(){ setDown(recN); }}),h('button',{class:'btn ghost sm',type:'button',text:T('Άκυρο','Cancel'),onclick:cancelDrop})))); }
    else { var cl=dst==='set'?clear(c):null;
      kids.push(h('div',{class:'trleads'},minus,h('b',{text:(c.auto!==false&&depth==null&&depthL==null)?'–':String(nLeads(c))}),h('small',{text:c.auto!==false?T('μολύβια · αυτόματα','leads · auto'):(cl!=null?(cl<-0.5*FATH?T('βαράει βυθό!','hitting bottom!'):'~'+Math.max(0,fa(cl))+T(' οργ. πάνω από βυθό',' fm above bottom')):T('μολύβια','leads'))}),plus,
        dst==='set'?h('button',{class:'trtouch',type:'button',text:T('Ακούμπησε','Touched'),title:T('Ένιωσα ότι ακούμπησε/κόλλησε στον βυθό','I felt it touch the bottom'),onclick:touched}):h('button',{class:'trgo',type:'button',text:T('Ρίχνω','Let out'),onclick:dropSheet}))); } }
  pill.replaceChildren.apply(pill,kids);
}

/* ---------- ρυθμίσεις ---------- */
function lures(){ var S=B.store; return S?S.raw('tackle').filter(function(x){ return !x.deleted&&x.type==='lure'; }):[]; } /* 1.7.1: μόνο τεχνητά (όχι καλάμια/σετ) */
function sheet(){ var c=cfg(), sh;
  var num=function(v,min,max,step){ return h('input',{type:'number',inputmode:'decimal',min:String(min),max:String(max),step:String(step||1),value:v!=null?String(v):''}); };
  var mn=num(c.min,0.5,20,0.5), mx=num(c.max,0.5,25,0.5), ln=num(c.line,5,300), ld=num(c.leads,0,60,1), gp=num(c.gap,0.5,30,0.5), v0=num(c.v0,1,8,0.5), lr=num(c.leader,0,60), lb=num(c.lineB,0,500);
  var mode=c.mode, mc=h('div',{class:'chips'}), est=h('p',{class:'trest'}), sur=h('div'), bot=h('div');
  function M(v,lab){ var b=h('button',{type:'button',class:'chip','aria-pressed':String(mode===v),text:lab,onclick:function(){ mode=v; if(v==='bottom'&&+mn.value>=4.5){ mn.value='2.5'; mx.value='3.5'; } if(v==='surface'&&+mx.value<=4){ mn.value='5'; mx.value='7'; } [].forEach.call(mc.children,function(x){ x.setAttribute('aria-pressed',String(x===b)); }); draw(); }}); return b; }
  mc.append(M('surface',T('Αφρού','Surface')),M('bottom',T('Βυθού (με μολύβι)','Bottom (with lead)')));
  var leadChips=h('div',{class:'chips'}); [['−',-1],['+',1]].forEach(function(x){ leadChips.append(h('button',{type:'button',class:'chip',text:x[0],'aria-label':x[1]<0?T('Λιγότερα','Fewer'):T('Περισσότερα','More'),onclick:function(){ ld.value=String(Math.max(0,(+ld.value||0)+x[1])); draw(); }})); });
  sur.className='trln'; sur.append(h('label',{class:'fld',title:T('Πόσο πίσω από τη βάρκα είναι το τεχνητό','How far behind the boat the lure is')},h('span',{text:T('Πετονιά (m)','Line out (m)')}),ln)); /* 1.9.11: στην ίδια γραμμή με την ταχύτητα */
  var rigId=rigOf(c).id, rigSel=h('select',{class:'select','aria-label':T('Αρματωσιά','Rig')}), rigSum=h('small',{class:'note'});
  function fillRigs(){ rigSel.replaceChildren(); rigs().forEach(function(r){ rigSel.append(h('option',{value:r.id,text:r.name})); }); rigSel.value=rigId; var r=rigs().filter(function(x){ return x.id===rigId; })[0]||rigs()[0]; rigSum.textContent=rigText(r); }
  rigSel.addEventListener('change',function(){ rigId=rigSel.value; fillRigs(); draw(); });
  var rigRow=h('div',{class:'fld'},h('span',{text:T('Αρματωσιά','Rig')}),rigSel,rigSum,h('div',{class:'chips'},
    h('button',{type:'button',class:'chip sm',text:'✎ '+T('Επεξεργασία','Edit'),onclick:function(){ rigEdit(rigs().filter(function(x){ return x.id===rigId; })[0]||rigs()[0],function(id){ if(id) rigId=id; fillRigs(); draw(); }); }}),
    h('button',{type:'button',class:'chip sm',text:'+ '+T('Νέα αρματωσιά','New rig'),onclick:function(){ rigEdit(null,function(id){ if(id) rigId=id; fillRigs(); draw(); }); }})));
  fillRigs();
  var au=h('input',{type:'checkbox',checked:c.auto!==false}), ldBox=h('div',{hidden:c.auto!==false},h('label',{class:'fld ldfld'},h('span',{text:T('Μολύβια έξω (1 μολύβι = 1 οργιά βάθος)','Leads out (1 lead = 1 fathom deep)')}),ld,leadChips));
  au.addEventListener('change',function(){ ldBox.hidden=au.checked; draw(); });
  bot.append(h('label',{class:'tg'},au,h('span',{text:T('Μολύβια αυτόματα από τον βυθό (οργιές βυθού − 1, όπως 32 οργιές → 31 μολύβια)','Leads automatically from the bottom (bottom fathoms − 1, e.g. 32 fathoms → 31 leads)')})),ldBox,
    h('small',{class:'note',text:T('Αν αλλάξεις μολύβια με − / + στον χάρτη, κρατιέται ο δικός σου αριθμός μέχρι το τέλος της εξόδου.','If you change leads with − / + on the map, your number is kept until the end of the trip.')}),
    h('p',{class:'trhint',html:T('<b>Στη θάλασσα:</b> πάτα <b>«Ρίχνω»</b> στον χάρτη μόλις πέσει το πρώτο μολύβι. Η εφαρμογή σού λέει <b>σε ποιο μολύβι να σταματήσεις</b>, μετά «Στον βυθό ✓». Αν νιώσεις τον βυθό, «Ακούμπησε»: έτσι μαθαίνει την αρματωσιά σου.','<b>At sea:</b> tap <b>“Let out”</b> on the map as the first lead goes in. The app tells you <b>at which lead to stop</b>, then “On the bottom ✓”. If you feel the bottom, “Touched”: that is how it learns your rig.')}),
    rigRow,
    h('details',{class:'tmore'},h('summary',{text:T('Όλη η πετονιά έξω, αν την ξέρεις','All line out, if you know it')}),
      h('label',{class:'fld'},h('span',{text:T('Όλη η πετονιά έξω (m)','All line out (m)')}),lb)));
  /* 1.8.7: πόσο πάνω από τον βυθό, μετρονόμος, ισοβαθής, τι δούλεψε */
  var tg=h('select',{class:'select'}); [0.5,1,1.5,2,3].forEach(function(v){ tg.append(h('option',{value:String(v),text:B.num(v,1)+T(' οργ.',' fm')})); }); tg.value=String(+c.tgt||1);
  var wt=h('input',{type:'checkbox',checked:!!c.watch}); wt.addEventListener('change',function(){ if(wt.checked&&'Notification' in window&&Notification.permission!=='granted'){ try{ Notification.requestPermission().then(function(r){ if(r!=='granted'){ wt.checked=false; B.toast(T('Χρειάζεται άδεια για ειδοποιήσεις.','Notification permission is needed.')); } }); }catch(e){} } });
  var pS=num(+c.pullS||PULL,1,30,1), sS=num(c.settleS!=null?+c.settleS:SETTLE,0,60,1);
  var nc=h('input',{type:'checkbox',checked:!c.noCur}), me=h('input',{type:'checkbox',checked:c.met!==false}), mi=num(+c.metIv||3,1.5,10,0.5), isoA=h('input',{type:'checkbox',checked:!c.isoFix}), isoN=num(c.iso||'',3,200,1); isoN.disabled=isoA.checked; isoA.addEventListener('change',function(){ isoN.disabled=isoA.checked; });
  var wk=worked(), wkTxt=wk?T('Από ','From ')+wk.n+T(' ψάρια σου στη συρτή βυθού: ',' of your bottom-trolling catches: ')+(wk.fath?T('βάθος δολώματος ','lure depth ')+Math.round(wk.fath[0])+'–'+Math.round(wk.fath[1])+T(' οργ.',' fm'):'')+(wk.leads?' · '+wk.leads[0]+'–'+wk.leads[1]+T(' μολύβια',' leads'):'')+(wk.kn?' · '+B.num(wk.kn[0],1)+'–'+B.num(wk.kn[1],1)+' kn':''):T('Μόλις γράψεις 2+ ψάρια στη συρτή βυθού, εδώ θα βλέπεις σε ποιο βάθος, με πόσα μολύβια και με τι ταχύτητα πιάνεις.','Once you log 2+ bottom-trolling catches you will see here at which depth, with how many leads and at what speed you catch.');
  bot.append(h('details',{class:'tmore',open:true},h('summary',{text:T('Πλάγια όψη και ειδοποιήσεις','Side view and alerts')}),
    h('label',{class:'fld'},h('span',{text:T('Το δόλωμα πάνω από τον βυθό','Lure above the bottom')}),tg),
    h('label',{class:'fld'},h('span',{text:T('Χρόνος για να μαζέψεις 1 μολύβι (″)','Time to bring in 1 lead (″)')}),pS,h('small',{text:T('Με τον ηλεκτρικό μηχανισμό μέτρα με το ρολόι πόσα δευτερόλεπτα θέλει 1 μολύβι. Με αυτό υπολογίζεται πότε να ξεκινήσεις το μάζεμα.','With the electric reel, time how many seconds 1 lead takes. This sets when to start bringing in.')})),
    h('label',{class:'fld'},h('span',{text:T('Χρόνος να «κάτσει» το δόλωμα στο νέο βάθος (″)','Time for the lure to settle at the new depth (″)')}),sS,h('small',{text:T('Πόσο αργεί η αρματωσιά να ανέβει/κατέβει αφού αλλάξεις μολύβια. Προεπιλογή 15″.','How long the rig takes to rise/sink after you change leads. Default 15″.')})),
    h('label',{class:'tg'},nc,h('span',{text:T('Υπολόγισε με το ρεύμα (ταχύτητα στο νερό από την πρόγνωση ρεύματος). Κλείσ\' το αν ο δικός σου κανόνας βγαίνει πιο σωστός: τότε μετράει μόνο η ταχύτητα GPS.','Use the current (speed through water from the current forecast). Turn it off if your own rule comes out more right: then only the GPS speed counts.')})),
    h('label',{class:'tg'},me,h('span',{text:T('Μετρονόμος όταν ρίχνω: η φωνή μετράει «ένα, δύο, τρία…», ένα μολύβι σε κάθε μέτρημα','Metronome when letting out: the voice counts “one, two, three…”, one lead per count')})),
    h('label',{class:'fld'},h('span',{text:T('Χρόνος για να αφήσεις 1 μολύβι (″) = μετρονόμος','Time to let out 1 lead (″) = metronome')}),mi),
    h('label',{class:'tg'},wt,h('span',{text:T('Ειδοποιήσεις και στο ρολόι (Garmin/Wear): «μάζεψε/άφησε», ταχύτητα, σημεία με ψάρι. Στο Garmin Connect άνοιξε τις ειδοποιήσεις για το Chrome.','Alerts on the watch too (Garmin/Wear): “bring in/let out”, speed, fish spots. In Garmin Connect enable notifications for Chrome.')})),
    h('label',{class:'tg'},isoA,h('span',{text:T('Ισοβαθής αυτόματα: το βάθος όταν πατάς «Στον βυθό ✓»','Contour automatically: the depth when you tap “On the bottom ✓”')})),
    h('label',{class:'fld'},h('span',{text:T('ή σταθερή ισοβαθής (οργιές)','or a fixed contour (fathoms)')}),isoN),
    h('p',{class:'trhint',text:'📊 '+wkTxt}),
    (function(){ var r=rigOf(c), k=+r.kD||1; return h('div',{class:'trhint'},h('span',{text:T('Με την αρματωσιά σου στα ','With your rig at ')+B.num(+r.v0||3,1)+' kn: '+T('βυθός 20 οργ. → ','bottom 20 fm → ')+needN(c,+r.v0||3,20*FATH)+T(' μολύβια (δόλωμα ',' leads (lure ')+B.num(tgt(),1)+T(' οργ. πάνω). ',' fm above). ')+(Math.abs(k-1)>0.02?T('Τώρα η αρματωσιά έχει διόρθωση ×','The rig now has a correction ×')+B.num(k,2)+T(' από «Ακούμπησε». ',' from “Touched”. '):'')}),
      Math.abs(k-1)>0.02?h('button',{type:'button',class:'chip sm',text:T('Επαναφορά στον κανόνα (×1)','Reset to the rule (×1)'),onclick:function(){ var a=rigs().slice(), i=a.map(function(x){ return x.id; }).indexOf(r.id), nr=Object.assign({},r,{kD:1,kN:0}); if(i<0) a.push(nr); else a[i]=nr; ls.set(RK,a); B.toast(T('Έγινε: βυθός − 1 = μολύβια.','Done: bottom − 1 = leads.')); sh.close(); }}):null); })(),
    h('button',{type:'button',class:'btn full',text:SIM?T('■ Τέλος δοκιμής','■ Stop the test'):T('▶ Δοκιμή: συρτή βυθού στο Λατσί (6 km)','▶ Test: bottom trolling at Latchi (6 km)'),onclick:function(){ sh.close(); if(SIM) simStop(false); else setTimeout(simStart,250); }}),
    h('p',{class:'trhint',text:T('Ψεύτικη βάρκα με 3 kn πάνω στον πραγματικό βυθό. Δεν γράφει έξοδο. Τα ψάρια που πατάς στη δοκιμή σβήνονται στο τέλος.','A fake boat at 3 kn over the real seabed. It does not record a trip. Catches you tap during the test are removed at the end.')})));
  var sel=(c.lures||[]).slice(), lc=h('div',{class:'chips trlures'}), L=lures();
  L.forEach(function(x){ var b=h('button',{type:'button',class:'chip sm','aria-pressed':String(sel.indexOf(x.id)>=0),text:x.name||'?',onclick:function(){ var i=sel.indexOf(x.id); if(i<0) sel.push(x.id); else sel.splice(i,1); b.setAttribute('aria-pressed',String(i<0)); }}); lc.append(b); });
  function cur(){ return {calS:c.calS,calB:c.calB,on:true,mode:mode,min:+mn.value||DEF.min,max:+mx.value||DEF.max,line:+ln.value||DEF.line,auto:au.checked,leads:ld.value===''?DEF.leads:+ld.value,rig:rigId,lineB:+lb.value||null,lures:sel,dep:c.on?c.dep:null,tgt:+tg.value||1,watch:wt.checked,noCur:!nc.checked,met:me.checked,metIv:+mi.value||3,pullS:+pS.value||PULL,settleS:sS.value===''?SETTLE:+sS.value,isoFix:!isoA.checked,iso:!isoA.checked?(+isoN.value||null):c.iso}; }
  function draw(){ sur.hidden=mode!=='surface'; bot.hidden=mode!=='bottom'; var q=cur(), v=(q.min+q.max)/2, l=layback(q,v);
    if(mode==='bottom'){ var ex=q.auto?25*FATH:null, g=geo(q,v,ex), g2=geo(q,v+0.5,ex), lq=g?g.lb*(+q.calB||1):null;
      est.textContent=g?(q.auto?T('Παράδειγμα: βυθός 25 οργιές → ','Example: bottom 25 fathoms → ')+g.n+T(' μολύβια. ',' leads. '):'')+T('Στα ','At ')+B.num(v,1)+T(' kn το δόλωμα είναι ~',' kn the lure is ~')+faTxt(g.dl)+T(' βάθος και ~',' deep and ~')+Math.round(lq)+T(' m πίσω από τη βάρκα.',' m behind the boat.')+(g2?T(' Στα ',' At ')+B.num(v+0.5,1)+T(' kn ανεβαίνει στις ~',' kn it rises to ~')+faTxt(g2.dl):'')+(g.short?T(' (Όλα τα ',' (All ')+g.n+T(' μολύβια· ο βυθός είναι πιο βαθύς.)',' leads; the bottom is deeper.)'):''):T('Βάλε πόσα μολύβια έχεις έξω.','Enter how many leads are out.'); return; }
    est.textContent=l!=null?T('Με ','At ')+B.num(v,1)+T(' kn το δόλωμα είναι ~',' kn the lure is ~')+Math.round(l)+T(' m πίσω από τη βάρκα',' m behind the boat')+T('. Τα ψάρια μπαίνουν εκεί, πάνω στη διαδρομή σου.','. Catches are placed there, on your track.'):''; }
  [mn,mx,ln,ld,lb].forEach(function(i){ i.addEventListener('input',draw); });
  var go=h('button',{class:'btn pri full',type:'button',text:c.on?T('Αποθήκευση','Save'):'▶ '+T('Έναρξη συρτής','Start trolling'),onclick:function(){ var q=cur(); if(q.min>=q.max){ B.toast(T('Η ελάχιστη ταχύτητα πρέπει να είναι μικρότερη από τη μέγιστη.','Minimum speed must be below maximum.')); return; }
    if(!tripOn()){ sh.close(); put(q); B.toast(T('Ξεκίνα πρώτα έξοδο: η συρτή δουλεύει μέσα στην έξοδο.','Start a trip first: trolling works within a trip.')); if(B.tripStart) B.tripStart(); return; }
    outSince=0; put(q); sh.close(); check(); B.toast(T('Συρτή: ','Trolling: ')+techName(q)+' · '+q.min+'–'+q.max+' kn'); }});
  var stop=c.on?h('button',{class:'btn full',type:'button',text:T('Τέλος συρτής','Stop trolling'),onclick:function(){ var q=cfg(); q.on=false; put(q); sh.close(); }}):null;
  sh=B.sheet({title:T('Συρτή','Trolling'),body:h('div',{class:'bform trsheet'},h('div',{class:'fld trtype','aria-label':T('Είδος','Type')},mc),
    h('div',{class:'cprow'},h('label',{class:'fld'},h('span',{text:T('Ταχύτητα από','Speed from')+' (kn)'}),mn),h('label',{class:'fld'},h('span',{text:T('έως','to')+' (kn)'}),mx),sur),
    bot,h('div',{class:'fld'},h('span',{text:T('Τεχνητά στο νερό','Lures in the water')}),L.length?lc:h('small',{text:T('Πρόσθεσε τεχνητά στον Εξοπλισμό για να τα διαλέγεις εδώ.','Add lures in Tackle to pick them here.')})),
    est,go,stop,c.on?h('button',{class:'btn full',type:'button',text:'📈 '+T('Προφίλ βυθού και δολώματος','Seabed and lure profile'),onclick:function(){ sh.close(); B.trollProfile(null); }}):null,h('p',{class:'foot',text:T('Δονείται αν μείνεις έξω από την ταχύτητα για 20″. Στον βυθό δονείται και όταν ο χάρτης βαθών (EMODnet) δείχνει βυθό πιο ρηχό από το δόλωμα. Η θέση και το βάθος του δολώματος είναι εκτίμηση.','Vibrates if you stay outside the speed range for 20 s. On the bottom it also vibrates when the depth chart (EMODnet) shows the bottom shallower than the lure. Lure position and depth are estimates.')}))});
  draw(); }
function rigText(r){ var n=+r.max||0, kg=n*(+r.lead||0)/1000, sw=r.swivel?Math.floor(n/r.swivel):0, ln=Math.max(0,n-1)*(+r.gap||0)*FATH;
  return n+' × '+(r.lead||'?')+' g = '+B.num(kg,1)+' kg · '+T('μολύβι ανά ','a lead every ')+r.gap+T(' οργ.',' fm')+(sw?T(' · στριφτάρια: ',' · swivels: ')+sw:'')+' · '+T('πετονιά με μολύβια ~','leaded line ~')+Math.round(ln)+' m · '+T('δόλωμα ~','lure ~')+Math.round((+r.leader||0)+(+r.blank||0)*FATH)+T(' m πίσω από το 1ο μολύβι',' m behind the first lead'); }
function physTxt(r){ if(!isPhys(r)) return ''; var c=cfg(), out=[]; [10,20,30,40].forEach(function(D){ var best=1, mx=+r.max||80; for(var n=1;n<=mx;n++){ var cb=cable(r,+r.v0||3); if(!cb||cb.Z[n]==null) break; if(cb.Z[n]<=D*FATH-tgt()*FATH+0.3) best=n; else break; } out.push(D+'→'+best); }); var cb2=cable(r,+r.v0||3), n20=Math.min(20,+r.max||80);
  return ' · '+T('Φυσική στα ','Physics at ')+B.num(+r.v0||3,1)+' kn: '+T('βυθός→μολύβια ','bottom→leads ')+out.join(', ')+(cb2?' · '+n20+T(' μολύβια ≈ ',' leads ≈ ')+B.num(cb2.Z[n20]/FATH,1)+T(' οργ., ',' fm, ')+Math.round(cb2.X[n20])+T(' m πίσω',' m back'):''); }
function rigEdit(r,done){ var isNew=!r; r=Object.assign({},r||{id:'rig'+Date.now().toString(36),name:'',leader:13.5,blank:5,gap:5,lead:160,swivel:4,max:30,v0:3}); var sh;
  var f=function(k,lab,min,max,step,hint){ var i=h('input',{type:'number',inputmode:'decimal',min:String(min),max:String(max),step:String(step),value:r[k]!=null?String(r[k]):''}); i.addEventListener('input',function(){ r[k]=i.value===''?null:+i.value; sum.textContent=rigText(r)+physTxt(r); }); return h('label',{class:'fld','data-k':k,hidden:k==='fpl'&&isPhys(r)},h('span',{text:lab}),i,hint?h('small',{text:hint}):null); };
  var nm=h('input',{type:'text',maxlength:'40',value:r.name||'',placeholder:T('π.χ. Βαθιά 160 g','e.g. Deep 160 g')}); nm.addEventListener('input',function(){ r.name=nm.value; });
  var sum=h('p',{class:'trest',text:rigText(r)+physTxt(r)});
  var save=h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ if(!r.gap||!r.max){ B.toast(T('Βάλε απόσταση μολυβιών και πόσα μολύβια.','Enter lead spacing and how many leads.')); return; }
    r.name=(r.name||'').trim()||(r.max+' × '+(r.lead||'?')+' g / '+r.gap+T(' οργ.',' fm'));
    /* 1.8.14: άλλαξε η αρματωσιά → η παλιά διόρθωση από «Ακούμπησε» δεν ισχύει· ξαναμαθαίνει */
    var old0=rigs().filter(function(x){ return x.id===r.id; })[0], chg=old0&&((old0.mline||'')!==(r.mline||'')||['gap','lead','blank','leader','fpl','v0','md'].some(function(k){ return (+old0[k]||0)!==(+r[k]||0); }));
    if(chg&&Math.abs((+r.kD||1)-1)>0.001){ r.kD=1; r.kN=0; B.toast(T('Άλλαξε η αρματωσιά: η παλιά διόρθωση μηδενίστηκε. Με 1–2 «Ακούμπησε» ξαναμαθαίνει.','The rig changed: the old correction was reset. 1–2 “Touched” teach it again.'),7000); }
    var a=rigs().filter(function(x){ return x.id!==r.id; }); a.push(r); ls.set(RK,a); sh.close(); done&&done(r.id); }});
  var del=!isNew&&rigs().length>1?h('button',{class:'btn del full',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ ls.set(RK,rigs().filter(function(x){ return x.id!==r.id; })); sh.close(); done&&done(rigs()[0].id); }}):null;
  sh=B.sheet({title:isNew?T('Νέα αρματωσιά','New rig'):T('Αρματωσιά','Rig'),stack:true,body:h('div',{class:'bform'},
    h('label',{class:'fld'},h('span',{text:T('Όνομα','Name')}),nm),
    h('p',{class:'sub',text:T('Από το δόλωμα προς τη βάρκα:','From the lure towards the boat:')}),
    f('leader',T('Παράμαλλο (m)','Leader (m)'),0,60,0.5,T('π.χ. 12–15 m fluorocarbon','e.g. 12–15 m fluorocarbon')),
    f('blank',T('Κενό πριν το 1ο μολύβι (οργιές)','Gap before the first lead (fathoms)'),0,30,0.5,T('σκέτο νήμα, για να μη βλέπουν τα ψάρια το μολύβι','plain line, so fish do not see the lead')),
    f('gap',T('Απόσταση ανάμεσα στα μολύβια (οργιές)','Spacing between leads (fathoms)'),0.5,20,0.5),
    f('lead',T('Βάρος κάθε μολυβιού (g)','Weight of each lead (g)'),10,2000,10),
    f('swivel',T('Στριφτάρι κάθε (μολύβια)','A swivel every (leads)'),0,20,1),
    f('max',T('Μολύβια συνολικά','Leads in total'),1,80,1,T('το βαθύτερο που φτάνεις: 1 μολύβι = 1 οργιά','the deepest you can reach: 1 lead = 1 fathom')),
    f('v0',T('Ταχύτητα όπου ισχύει «1 μολύβι = 1 οργιά» (kn)','Speed where “1 lead = 1 fathom” holds (kn)'),1,8,0.5),
    (function(){ var sel=h('select',{class:'select'}); [['',T('Κανόνας: 1 μολύβι = 1 οργιά (χωρίς φυσική)','Rule: 1 lead = 1 fathom (no physics)')],['braid',T('Νήμα (braid, PE)','Braid (PE)')],['dacron','Dacron'],['mono',T('Νάιλον (μονόκλωνο)','Nylon (mono)')]].forEach(function(o){ sel.append(h('option',{value:o[0],text:o[1]})); }); sel.value=r.mline||'';
      sel.addEventListener('change',function(){ r.mline=sel.value||null; if(r.mline&&!r.md) { r.md=r.mline==='braid'?0.5:r.mline==='dacron'?1.7:1.0; dm.value=String(r.md); } dmw.hidden=!r.mline; var bf=sel.closest('.bform'), fw=bf&&bf.querySelector('[data-k=fpl]'); if(fw) fw.hidden=!!r.mline; sum.textContent=rigText(r)+physTxt(r); });
      var dm=h('input',{type:'number',inputmode:'decimal',min:'0.1',max:'4',step:'0.05',value:r.md!=null?String(r.md):''}); dm.addEventListener('input',function(){ r.md=dm.value===''?null:+dm.value; sum.textContent=rigText(r)+physTxt(r); });
      var dmw=h('label',{class:'fld',hidden:!r.mline},h('span',{text:T('Διάμετρος νήματος (mm)','Line diameter (mm)')}),dm,h('small',{text:T('Dacron Arcofil (Deep Fishing): 0,65 · 0,85 · 1,70 · 2,00 mm. Braid PE 8–10 = 0,45–0,55 mm.','Dacron Arcofil (Deep Fishing): 0.65 · 0.85 · 1.70 · 2.00 mm. Braid PE 8–10 = 0.45–0.55 mm.')}));
      return h('div',null,h('label',{class:'fld'},h('span',{text:T('Μάνα (από τα μολύβια ως τη βάρκα)','Main line (from the leads to the boat)')}),sel,h('small',{text:T('Με νήμα η εφαρμογή υπολογίζει με φυσική πόσο βάθος δίνει κάθε μολύβι σε κάθε ταχύτητα.','With a line type the app works out with physics how deep each lead goes at each speed.')})),dmw); })(),
    f('fpl',T('Οργιές βάθους ανά μολύβι (σε αυτή την ταχύτητα)','Fathoms of depth per lead (at that speed)'),0.3,3,0.1,T('1 = ο κανόνας σου (βυθός 20 → 19 μολύβια). Αν αλλάξεις απόσταση ή βάρος μολυβιών και δεν ξέρεις, άφησέ το 1: τα «Ακούμπησε» και το βυθόμετρο το διορθώνουν μόνα τους.','1 = your rule (bottom 20 → 19 leads). If you change the lead spacing or weight and do not know, leave 1: “Touched” and the sounder correct it by themselves.')),
    sum,save,del)}); }
B.rigsSheet=function(){ rigEdit(rigOf(),null); };

/* ================= 1.8.7: πλάγια όψη, μετρονόμος, «πότε να μαζέψω/αφήσω», ταχύτητα στο νερό, στροφές, ισοβαθής =================
   Πλέγμα βάθους EMODnet (~115 m) γύρω από τη βάρκα (AlkyonDense.area) + οι δικές σου διορθώσεις (alkyon-dcorr).
   Το δόλωμα ακολουθεί τη διαδρομή της βάρκας lb μέτρα πίσω: ο βυθός που περνάς ΤΩΡΑ είναι ο βυθός του δολώματος σε lb/v δευτερόλεπτα. */
var SV={grid:null,at:0,prof:null,adv:null,iso:null,stw:null,cur:null,turn:0,hh:[],lastAdv:'',lastAdvT:0,gridErr:0};
/* 1.8.15: μία φορά: μηδένισε τη διόρθωση αρματωσιάς (οι δοκιμές πριν την 1.8.14 την άλλαζαν, π.χ. 16 μολύβια → 27 οργ.) */
try{ if(!ls.get('alkyon-kdmig',false)){ var a0=ls.get(RK,null); if(a0&&a0.length){ ls.set(RK,a0.map(function(x){ return Object.assign({},x,{kD:1,kN:0}); })); } ls.set('alkyon-kdmig',true); } }catch(e){}
function tgt(){ var c=cfg(); return Math.max(0.5,Math.min(4,+c.tgt||1)); }   /* οργιές πάνω από τον βυθό (προεπιλογή 1) */
function gD(lat,lon){ var A=window.AlkyonDense; if(!SV.grid||!A||!A.at) return null; var d=A.at(SV.grid,lat,lon); if(d==null||d<=0) return null; return Math.max(1,d+corrAt(lat,lon)); }
function gridFor(f){ var A=window.AlkyonDense; if(!A||!A.area||!f) return; if(Date.now()-SV.gridErr<60000) return;
  A.area(f.lat,f.lon,2600).then(function(g){ SV.grid=g; }).catch(function(){ SV.gridErr=Date.now(); }); }
/* ταχύτητα στο νερό: διανυσματικά, ταχύτητα GPS − ρεύμα (το ρεύμα από τον χάρτη ρευμάτων, όταν είναι ανοιχτός) */
function stwOf(f){ SV.cur=null; if(cfg().noCur) return null; if(spd==null||hdg==null||!B.curNear||!f) return null; var cu=B.curNear(f.lat,f.lon); if(!cu||!(cu.kn>=0)) return null; SV.cur=cu;
  var r=Math.PI/180, gx=spd*Math.sin(hdg*r), gy=spd*Math.cos(hdg*r), cx=cu.kn*Math.sin(cu.dir*r), cy=cu.kn*Math.cos(cu.dir*r); return Math.sqrt((gx-cx)*(gx-cx)+(gy-cy)*(gy-cy)); }
function vEff(){ return SV.stw!=null?SV.stw:spd; }
/* στροφές: αλλαγή πορείας > 25° μέσα σε 12″ */
function turnCheck(){ var now=Date.now(); if(hdg==null) return; SV.hh.push([now,hdg]); SV.hh=SV.hh.filter(function(q){ return now-q[0]<12000; }); if(SV.hh.length<2) return;
  var d=Math.abs(((SV.hh[SV.hh.length-1][1]-SV.hh[0][1])+540)%360-180); SV.turn=d; var c=cfg();
  if(d>25&&c.mode==='bottom'&&c.dep&&c.dep.st==='set'&&now-(SV.turnT||0)>60000){ SV.turnT=now; if(B.say) B.say(T('Στροφή. Το δόλωμα κατεβαίνει','Turning. The lure is sinking'),'troll','turn',60000); try{ navigator.vibrate&&navigator.vibrate([120,80,120]); }catch(e){} } }
/* μολύβια ώστε το δόλωμα να είναι tgt οργιές πάνω από βυθό D (στην ταχύτητα v) */
function needN(c,v,D){ var r=rigOf(c), mx=+r.max||80, best=1; for(var n=1;n<=mx;n++){ var g=geo(Object.assign({},c,{auto:false,leads:n,dep:null}),v); if(!g) continue; if(g.dl<=D-tgt()*FATH+0.3) best=n; else break; /* 1.8.14: +0,3 m ώστε 20 οργ. → 19 μολύβια ακριβώς */ } return best; }
/* το μονοπάτι του δολώματος: από εκεί που είναι τώρα (lb πίσω στη διαδρομή) → βάρκα → μπροστά (πορεία) */
function lurePath(f,lb){ var out=[], step=15; if(!f||lb==null) return out;
  for(var m=Math.round(lb/step)*step;m>0;m-=step){ var q=behind({lat:f.lat,lon:f.lon},m); if(q) out.push({x:-m,lat:q.lat,lon:q.lon}); }
  out.push({x:0,lat:f.lat,lon:f.lon});
  if(hdg!=null) for(var a=step;a<=300;a+=step){ var p=dest(f.lat,f.lon,hdg,a); out.push({x:a,lat:p[0],lon:p[1]}); }
  out.forEach(function(q){ q.d=gD(q.lat,q.lon); }); return out; }
var PULL=5, SETTLE=15;   /* ″ ανά μολύβι όταν μαζεύεις/αφήνεις · ″ μέχρι να «κάτσει» η πετονιά */
/* 1.8.20: οι χρόνοι ρυθμίζονται: μάζεμα ανά μολύβι (ηλεκτρικός μηχανισμός ≠ χέρι), άφημα ανά μολύβι (= μετρονόμος), «να κάτσει» */
function tPull(){ var c=cfg(); return Math.max(1,Math.min(30,+c.pullS||PULL)); } function tLet(){ return metIv(); } function tSettle(){ var c=cfg(); return Math.max(0,Math.min(60,c.settleS!=null?+c.settleS:SETTLE)); }
function advise(c,f){ SV.adv=null; if(c.mode!=='bottom'||!c.dep||c.dep.st!=='set'||!f) return; var v=vEff();
  if(v==null||v<0.8){ var vr=+rigOf(c).v0||+c.v0||3, gw=geo(c,vr); SV.prof=gw?{P:lurePath(f,gw.lb*(+c.calB||1)),lb:gw.lb,dl:gw.dl,n:nLeads(c),v:vr,pre:1}:null; SV.adv={act:'wait'}; return; } /* 1.8.8: χωρίς ταχύτητα: διάγραμμα με την ταχύτητα της αρματωσιάς, χωρίς συμβουλές */
  var n=nLeads(c), g=geo(c,v); if(!g) return; var lb=g.lb*(+c.calB||1), P=lurePath(f,lb); SV.prof={P:P,lb:lb,dl:g.dl,n:n,v:v}; if(!P.length) return;
  if(spd!=null&&(spd>c.max||spd<c.min)){ SV.adv={act:'spd',hi:spd>c.max}; return; } /* 1.8.8: πρώτα η ταχύτητα· τα μολύβια μετά, όταν μπεις στα όρια */
  /* 1.8.13: ένα παράθυρο για όλα: ό,τι θα περάσει το δόλωμα στα επόμενα 150″. «Μάζεψε» αν κάπου μέσα θέλει λιγότερα μολύβια
     (με τον χρόνο που χρειάζεσαι), «Άφησε» μόνο αν σε όλο το παράθυρο θέλει περισσότερα· έτσι δεν πάει μπρος-πίσω */
  var vms=v*0.514, lureX=-lb, WIN=150, worst=null, minAhead=null, d0=null;
  P.forEach(function(q){ if(q.d==null||q.x<lureX-8) return; var s=Math.max(0,q.x-lureX), tReach=s/vms; if(tReach>WIN) return; if(d0==null) d0=q.d; var need=needN(c,v,q.d);
    if(minAhead==null||need<minAhead) minAhead=need;
    if(need<n&&(!worst||need<worst.need||(need===worst.need&&tReach<worst.t))) worst={need:need,t:tReach,d:q.d,x:q.x}; });
  var clr=d0!=null?(d0-g.dl)/FATH:null;
  if(worst){ var k=n-worst.need, lead=k*tPull()+tSettle(), tStart=Math.round(worst.t-lead); SV.adv={k:k,act:'up',t:Math.max(0,tStart),d:worst.d,clr:clr,need:worst.need,dur:Math.round(k*tPull()),late:tStart<0?-tStart:0}; }
  else if(minAhead!=null&&minAhead>n){ var kd=minAhead-n; SV.adv={k:kd,act:'down',t:0,d:d0,clr:clr,need:minAhead,dur:Math.round(kd*tLet())}; }
  else SV.adv={act:'ok',clr:clr,hold:clr!=null&&clr>tgt()+1.5};
  var a=SV.adv, key=a.act+(a.k||'')+(a.t<=0?'now':''), now=Date.now();
  if(a.act==='up'&&a.t<=0&&(key!==SV.lastAdv||now-SV.lastAdvT>45000)){ SV.lastAdv=key; SV.lastAdvT=now; if(B.say) B.say(T('Μάζεψε ','Bring in ')+a.k+T(' τώρα',' now'),'troll','adv',0); notify('↑ '+T('Μάζεψε ','Bring in ')+a.k+T(' μολύβια τώρα',' leads now')); try{ navigator.vibrate&&navigator.vibrate([400,150,400]); }catch(e){} }
  else if(a.act==='up'&&a.t>0&&a.t<=45&&key!==SV.lastAdv){ SV.lastAdv=key; SV.lastAdvT=now; if(B.say) B.say(T('Ο βυθός ανεβαίνει. Μάζεψε ','Bottom rising. Bring in ')+a.k+T(' σε ',' in ')+Math.round(a.t/5)*5+T(' δευτερόλεπτα',' seconds'),'troll','adv',0); notify('↑ '+T('Μάζεψε ','Bring in ')+a.k+T(' σε ',' in ')+Math.round(a.t/5)*5+'″'); }
  else if(a.act==='down'&&(key!==SV.lastAdv||now-SV.lastAdvT>90000)){ SV.lastAdv=key; SV.lastAdvT=now; if(B.say) B.say(T('Βαθαίνει. Άφησε ','Getting deeper. Let out ')+a.k,'troll','adv',0); notify('↓ '+T('Άφησε ','Let out ')+a.k+T(' μολύβια',' leads')); try{ navigator.vibrate&&navigator.vibrate([120,80,120]); }catch(e){} }
  /* 1.8.21: αντίστροφη μέτρηση με φωνή («σε 10… 5…») όπως τα callouts, και ενημέρωση ύψους κάθε ~1′ */
  if(a.act==='up'&&a.t>0){ var cd=a.t<=6?5:a.t<=11?10:0; if(cd&&SV.cdSaid!==a.k+'|'+cd){ SV.cdSaid=a.k+'|'+cd; if(B.say) B.say(cd===10?T('Μάζεψε σε δέκα','Bring in, ten'):T('πέντε','five'),'troll','cd'+cd,0); try{ navigator.vibrate&&navigator.vibrate(cd===5?[60,60,60]:[60]); }catch(e){} } } else SV.cdSaid='';
  if(a.clr!=null&&a.clr<0.4&&(!SV.dragT||now-SV.dragT>30000)){ SV.dragT=now; try{ navigator.vibrate&&navigator.vibrate([100,60,100,60,100]); }catch(e){} if(B.say) B.say(T('Σέρνεται','Dragging'),'troll','drag',30000); }
  if(a.act==='ok'&&a.clr!=null&&(!SV.hT||now-SV.hT>75000)){ SV.hT=now; var hr=Math.round(a.clr*2)/2; if(B.say) B.say((hr===1?T('Μία οργιά','One fathom'):B.sayNum(hr)+T(' οργιές',' fathoms'))+T(' πάνω',' above'),'trollh','h',70000); } }
/* ισοβαθής: η οργιά που κρατάς (αυτόματα το βάθος στο «Στον βυθό», ή όποια διαλέξεις) → «λίγο αριστερά / δεξιά» */
function isoGuide(c,f){ SV.iso=null; if(c.mode!=='bottom'||!c.dep||c.dep.st!=='set'||!f||hdg==null) return; var iso=+c.iso||0; if(!iso) return;
  var a=dest(f.lat,f.lon,hdg,80), dA=gD(a[0],a[1]), L=dest(a[0],a[1],hdg-90,60), Rt=dest(a[0],a[1],hdg+90,60), dL=gD(L[0],L[1]), dR=gD(Rt[0],Rt[1]); if(dA==null) return;
  var off=dA/FATH-iso, side=null; if(Math.abs(off)>=1&&dL!=null&&dR!=null){ var shallowL=dL<dR; side=off>0?(shallowL?'L':'R'):(shallowL?'R':'L'); }
  SV.iso={iso:iso,now:dA/FATH,off:off,side:side}; var now=Date.now();
  if(side&&now-(SV.isoT||0)>40000){ SV.isoT=now; if(B.say) B.say(side==='L'?T('Λίγο αριστερά, για τις ','A little left, for ')+iso:T('Λίγο δεξιά, για τις ','A little right, for ')+iso,'troll','iso',0); } }
/* μετρονόμος: όσο ρίχνεις, η φωνή μετράει ένα μολύβι ανά «iv» δευτερόλεπτα· έτσι η εφαρμογή ξέρει πόσα είναι έξω */
var MET={n:0,tm:null,paused:false};
function metIv(){ return Math.max(1.5,Math.min(10,+cfg().metIv||3)); }
function metStart(){ metStop(); MET.n=0; MET.paused=false; if(cfg().met===false) return; MET.tm=setInterval(metTick,metIv()*1000); }
function metStop(){ if(MET.tm){ clearInterval(MET.tm); MET.tm=null; } }
function metTick(){ var c=cfg(); if(!c.dep||c.dep.st!=='drop'){ metStop(); return; } if(MET.paused) return; MET.n++; var stop=recN!=null?recN:null;
  if(stop!=null&&MET.n>=stop){ if(B.say) B.say(T('Σταμάτα. ','Stop. ')+MET.n,'troll','met',0); metStop(); setDown(MET.n,'met'); return; }
  if(B.say) B.say(String(MET.n),'troll','met'+MET.n,0); paintSide(); }
function metPace(d){ var c=cfg(); c.metIv=Math.max(1.5,Math.min(10,(+c.metIv||3)+d)); ls.set(K,c); if(MET.tm){ clearInterval(MET.tm); MET.tm=setInterval(metTick,c.metIv*1000); } paintSide(); }
/* ---------- η κάρτα: πλάγια όψη + 3 αριθμοί + συμβουλή (στον καθαρό χάρτη, στη θέση της κάρτας ΨΑΡΕΥΩ) ---------- */
var side=null;
function svgNum(x,y,txt,bg,fg){ var w=txt.length*8+10; return '<rect x="'+(x-w/2).toFixed(1)+'" y="'+(y-9).toFixed(1)+'" width="'+w+'" height="17" rx="8.5" fill="'+bg+'" stroke="#0b1f2a" stroke-width=".8"/><text x="'+x.toFixed(1)+'" y="'+(y+4).toFixed(1)+'" font-size="13" font-weight="900" text-anchor="middle" fill="'+fg+'">'+txt+'</text>'; }
function svgLab(x,y,txt,anchor,col){ var w=txt.length*5.4+8, xx=anchor==='end'?x-w:anchor==='middle'?x-w/2:x; return '<rect x="'+xx.toFixed(1)+'" y="'+(y-10).toFixed(1)+'" width="'+w.toFixed(1)+'" height="14" rx="4" fill="'+(col||'#0b1f2a')+'" opacity=".85"/><text x="'+(xx+4).toFixed(1)+'" y="'+(y+0.5).toFixed(1)+'" font-size="9.5" font-weight="700" fill="#fff">'+txt+'</text>'; }
function svgSide(o){ o=o||{}; var SUN=!!o.sun&&!echoOn(); var p=SV.prof, W=o.W||360,H=o.H||164, x0=4,x1=W-30, y0=o.H?24:14, y1=H-16; if(!p||!p.P.length) return '';
  /* 1.8.14: όψη σαν βυθόμετρο: σκούρο νερό, πλέγμα βαθών, «ηχώ» βυθού, καθαρά σημάδια βάρκας και δολώματος */
  var xs=p.P.map(function(q){ return q.x; }), xmin=Math.min(Math.min.apply(null,xs),-p.lb-Math.max(25,p.lb*0.12)), xmax=Math.max.apply(null,xs), /* 1.8.25: λίγος χώρος πίσω από το δόλωμα */ ds=p.P.filter(function(q){ return q.d!=null; }).map(function(q){ return q.d; });
  if(!ds.length) return ''; var zoom=viewMode()==='zoom', dmn=Math.min(Math.min.apply(null,ds),p.dl), dmx=Math.max(Math.max.apply(null,ds),p.dl);
  var q0z=p.P[0]&&p.P[0].d!=null?p.P[0].d:dmn, dlz=Math.min(q0z,p.dl), bmx=Math.max.apply(null,p.P.filter(function(q){ return q.d!=null&&q.x>=-p.lb-30&&q.x<=60; }).map(function(q){ return q.d; }).concat([q0z])), z0=zoom?Math.max(0,dlz-3*FATH):0, zmax=zoom?Math.max(z0+10*FATH,bmx+1.5*FATH):Math.ceil((dmx*1.12+2)/(5*FATH))*5*FATH; var TS=trueOn(); if(TS){ var span=(xmax-xmin)*(y1-y0)/Math.max(1,(x1-x0)); if(zoom){ z0=Math.max(0,(dlz+bmx)/2-span/2); zmax=z0+span; } else { z0=0; zmax=Math.max(span,dmx*1.05); } } /* 1.8.26: πραγματική κλίμακα 1:1 */ /* 1.8.19: το zoom δείχνει πάντα και το δόλωμα και τον βυθό από κάτω του */
  var X=function(x){ return x0+(x1-x0)*(x-xmin)/Math.max(1,xmax-xmin); }, Y=function(z){ return y0+(y1-y0)*Math.min(1,Math.max(0,z-z0)/Math.max(1,zmax-z0)); };
  var id='s'+Math.random().toString(36).slice(2,7);
  var g='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" font-family="inherit" aria-label="'+T('Πλάγια όψη: βυθός, πετονιά και δόλωμα','Side view: bottom, line and lure')+'"><defs>'
   +'<linearGradient id="w'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(SUN?'#e6f3fa':'#0f3a55')+'"/><stop offset="1" stop-color="'+(SUN?'#bcdcee':'#06192a')+'"/></linearGradient>'
   +'<linearGradient id="b'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(SUN?'#d09a6c':'#b8743a')+'"/><stop offset=".18" stop-color="'+(SUN?'#b07c55':'#7a4a26')+'"/><stop offset="1" stop-color="'+(SUN?'#80583b':'#2b1a10')+'"/></linearGradient>'
   +'<clipPath id="c'+id+'"><rect x="'+x0+'" y="'+y0+'" width="'+(x1-x0)+'" height="'+(y1-y0)+'" rx="6"/></clipPath></defs>';
  var EC=echoOn(); if(EC) g=g.replace('<defs>','<defs><linearGradient id="e'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(SUN?'#1c4f93':'#0b2350')+'"/><stop offset="1" stop-color="'+(SUN?'#0f3166':'#050f26')+'"/></linearGradient>');
  g+='<rect x="'+x0+'" y="'+y0+'" width="'+(x1-x0)+'" height="'+(y1-y0)+'" rx="6" fill="url(#'+(EC?'e':'w')+id+')"/><g clip-path="url(#c'+id+')">';
  /* πλέγμα βαθών */
  var zst=zoom&&!TS?2*FATH:(zmax-z0>100*FATH?25*FATH:zmax-z0>40*FATH?10*FATH:5*FATH), zs=Math.ceil(z0/zst)*zst;
  for(var z=zs;z<=zmax+0.1;z+=zst) if(z>z0) g+='<line x1="'+x0+'" y1="'+Y(z).toFixed(1)+'" x2="'+x1+'" y2="'+Y(z).toFixed(1)+'" stroke="#7fb8d8" stroke-width=".6" stroke-dasharray="2 4" opacity=".35"/>';
  /* μπροστά (πρόβλεψη): ελαφρώς πιο ανοιχτό */
  g+='<rect x="'+X(0).toFixed(1)+'" y="'+y0+'" width="'+(x1-X(0)).toFixed(1)+'" height="'+(y1-y0)+'" fill="#ffffff" opacity=".05"/>';
  /* βυθός + ηχώ */
  /* ό,τι είναι «στο έδαφος» (βυθός, ψάρια, σημάδια) σε ομάδα που κυλάει ομαλά προς τα πίσω ανάμεσα στις ανανεώσεις */
  g+='<g class="gnd">';
  var BP=p.P.filter(function(q){ return q.d!=null; }).map(function(q){ return [q.x,q.d]; }).sort(function(a,b){ return a[0]-b[0]; }), mpx=(xmax-xmin)/Math.max(1,x1-x0), EXT=36;
  var path='M'+(x0-24)+','+(y1+40), edge='', tl='';
  for(var sx=x0-24;sx<=x1+EXT;sx+=3){ var dd=crAt(BP,xmin+(sx-x0)*mpx); if(dd==null) continue; var yy=Y(dd).toFixed(1); path+=' L'+sx+','+yy; edge+=(edge?' L':'M')+sx+','+yy; tl+=(tl?' L':'M')+sx+','+Y(Math.max(0,dd-tgt()*FATH)).toFixed(1); }
  path+=' L'+(x1+EXT)+','+(y1+40)+' Z';
  var img=null; if(EC){ var SC=1.5, wpx=Math.round((x1+EXT-x0)*SC), hpx=Math.round((y1-y0)*SC), gx0=rlX()||0;
      img=echoCanvas(wpx,hpx,function(px){ var xr=xmin+(px/SC)*mpx, d=crAt(BP,xr), d1=crAt(BP,xr+4); return {gx:gx0+xr,d:d,d2:true,surf:z0<0.5,sl:d!=null&&d1!=null?Math.abs(d1-d)/4:0,z:function(py){ return z0+(py/SC)/(y1-y0)*(zmax-z0); }}; });
      if(img) g+='<image href="'+img+'" x="'+x0+'" y="'+y0+'" width="'+(x1+EXT-x0)+'" height="'+(y1-y0)+'" preserveAspectRatio="none" style="image-rendering:pixelated"/>';
      else { g+='<path d="'+path+'" fill="#0a1d5c"/>'; ECHO.forEach(function(e){ g+='<path d="'+edge+'" transform="translate(0,'+(e[0]/2).toFixed(1)+')" fill="none" stroke="'+e[1]+'" stroke-width="'+e[0]+'" stroke-linejoin="round" opacity="'+e[2]+'"/>'; }); } }
  else { g+='<path d="'+path+'" fill="url(#b'+id+')"/>';
    if(edge) g+='<path d="'+edge+'" fill="none" stroke="#ff6a3d" stroke-width="2.2" stroke-linejoin="round"/><path d="'+edge+'" fill="none" stroke="#ffd0a0" stroke-width=".8" opacity=".8"/>'; }
  if(tl) g+='<path d="'+tl+'" fill="none" stroke="#5ff0a8" stroke-width="1.1" stroke-dasharray="4 3" opacity=".85"/>';
  g+='</g>';
  /* πετονιά και μολύβια */
  var lD0=p.P[0]&&p.P[0].d!=null?p.P[0].d:null, dlv=lD0!=null?Math.min(p.dl,lD0):p.dl;
  var bx=X(0), by=Y(0)+1, lx=X(-p.lb), ly=Y(dlv);
  var BK=o.sun?1.3:1, LW=o.sun?2:1.2, shp=lineShape(cfg(),p.v,p.n), LC=EC?'#e8f4fb':(SUN?'#0b1f2a':'#e8f4fb'), PT=function(u){ return [X(-u[0]*p.lb),Math.max(by,Y(u[1]*dlv))]; };
  if(shp){ var vis=shp.pts, kk=0; while(kk<shp.pts.length&&shp.pts[kk][1]*dlv<z0) kk++;
    if(kk>0&&kk<shp.pts.length){ var u1=shp.pts[kk-1], u2=shp.pts[kk], tt=(z0/dlv-u1[1])/Math.max(1e-6,u2[1]-u1[1]); vis=[[u1[0]+(u2[0]-u1[0])*tt,z0/dlv]].concat(shp.pts.slice(kk)); } /* 1.8.28: στο Zoom η γραμμή μπαίνει στο παράθυρο εκεί που μπαίνει στ' αλήθεια */
    if(vis[0]!==shp.pts[0]){ var a0=PT(vis[0]); g+='<line x1="'+bx.toFixed(1)+'" y1="'+by.toFixed(1)+'" x2="'+a0[0].toFixed(1)+'" y2="'+a0[1].toFixed(1)+'" stroke="'+LC+'" stroke-width="1" stroke-dasharray="2 4" opacity=".35"/>'; } /* zoom: προς τη βάρκα, πάνω από το παράθυρο */
    g+='<path d="'+vis.map(function(u,i){ var a=PT(u); return (i?'L':'M')+a[0].toFixed(1)+','+a[1].toFixed(1); }).join(' ')+'" stroke="'+LC+'" stroke-width="'+LW+'" fill="none" opacity=".95" stroke-linejoin="round"/>';
    /* μολύβια-τορπίλες στη θέση τους, γυρισμένα κατά τη γραμμή · πολλά → κάθε 2ο/3ο για να μη γίνονται κηλίδα */
    var stp=Math.max(1,Math.ceil(shp.leads.length/22)); shp.leads.forEach(function(u,i){ if((i%stp&&i!==shp.leads.length-1)||u[1]*dlv<z0) return; var a=PT(u), b=PT(shp.leads[Math.min(shp.leads.length-1,i+1)]||u), ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
      g+='<g transform="translate('+a[0].toFixed(1)+','+a[1].toFixed(1)+') rotate('+ang.toFixed(0)+') scale('+BK+')"><ellipse rx="3.4" ry="1.5" fill="'+(EC?'#d7e2ea':SUN?'#2b3a44':'#c9d6de')+'" stroke="'+(SUN&&!EC?'#0b1f2a':'#0b1f2a')+'" stroke-width=".5"/><ellipse cx="-.8" cy="-.5" rx="1.6" ry=".45" fill="#fff" opacity=".55"/></g>'; }); }
  else g+='<line x1="'+bx.toFixed(1)+'" y1="'+by.toFixed(1)+'" x2="'+lx.toFixed(1)+'" y2="'+ly.toFixed(1)+'" stroke="'+LC+'" stroke-width="1.2"/>';
  g+='<g class="gnd">';
  /* σημάδι «μαζεψε εδώ» */
  var a=SV.adv; if(a&&a.act==='up'&&a.d!=null){ var hit=p.P.filter(function(q){ return q.d!=null&&Math.abs(q.d-a.d)<0.01; })[0]; if(hit) g+='<circle cx="'+X(hit.x).toFixed(1)+'" cy="'+Y(hit.d).toFixed(1)+'" r="7" fill="none" stroke="#ffb020" stroke-width="2"/><circle cx="'+X(hit.x).toFixed(1)+'" cy="'+Y(hit.d).toFixed(1)+'" r="2" fill="#ffb020"/>'; }
  /* κάθετη από τη βάρκα στον βυθό */
  (SV.fishPts||[]).forEach(function(fp){ if(fp.x>=xmin&&fp.x<=xmax) g+=EC?arch(X(fp.x),Y(fp.d)-9,.8):'<g opacity=".75">'+mkIco(X(fp.x),Y(fp.d)-8,false,6.5)+'</g>'; });
  var nowX=rlX(); if(nowX!=null) SV.marks.forEach(function(m){ var rx=m.s-nowX; if(rx<xmin||rx>xmax) return; g+=EC&&!m.miss?arch(X(rx),Y(m.dl),1)+mkIco(X(rx),Y(m.dl)-14,false,5.5):mkIco(X(rx),Y(m.dl),m.miss); });
  g+='</g>';
  var bD=null; p.P.forEach(function(q){ if(q.x===0) bD=q.d; });
  if(bD!=null) g+='<line x1="'+bx.toFixed(1)+'" y1="'+by.toFixed(1)+'" x2="'+bx.toFixed(1)+'" y2="'+Y(bD).toFixed(1)+'" stroke="#ffffff" stroke-width=".8" stroke-dasharray="1.5 2.5" opacity=".7"/>';
  /* δόλωμα */
  g+='<circle cx="'+lx.toFixed(1)+'" cy="'+ly.toFixed(1)+'" r="9" fill="#ffd23f" opacity=".22"/><g transform="translate('+lx.toFixed(1)+','+ly.toFixed(1)+') scale('+BK+')"><path d="M-7.5 0 -11 -3.2v6.4Z" fill="#ffd23f" stroke="#1a1300" stroke-width=".8"/><ellipse rx="6" ry="3.1" fill="#ffd23f" stroke="#1a1300" stroke-width="1"/><path d="M-1 -3c1.6 1 1.6 5 0 6" stroke="#1a1300" stroke-width=".7" fill="none" opacity=".6"/><circle cx="3.3" cy="-.7" r=".9" fill="#1a1300"/><path d="M5.5 1.4l2.2 1.6-.6.8" stroke="#1a1300" stroke-width=".8" fill="none"/></g>';
  if(zoom&&!o.H) g+='<text x="'+(x0+6)+'" y="'+(y0+11)+'" font-size="10.5" font-weight="700" fill="'+(SUN?'#24404f':'#9fd3ef')+'" letter-spacing=".06em">ZOOM '+Math.round(z0/FATH)+'–'+Math.round(zmax/FATH)+T(' ΟΡΓ.',' FM')+'</text>';
  if(!o.H) g+='<text x="'+(X(0)+4).toFixed(1)+'" y="'+(y0+11)+'" font-size="10" font-weight="700" fill="'+(SUN?'#24404f':'#9fd3ef')+'" letter-spacing=".08em" opacity=".8">'+T('ΜΠΡΟΣΤΑ ▸','AHEAD ▸')+'</text>';
  g+='</g>';
  /* βάρκα */
  var B0=function(dx,dy){ return (bx+dx*BK).toFixed(1)+','+(y0+dy*BK).toFixed(1); };
  g+='<path d="M'+B0(-14,-4)+' L'+B0(11,-4)+' Q'+B0(15,-5)+' '+B0(17,-8)+' L'+B0(10,3)+' Q'+B0(0,4.5)+' '+B0(-13,2.5)+' Z" fill="#f2f5f7" stroke="#1a2b36" stroke-width=".9"/><path d="M'+B0(-13,0)+' L'+B0(13,-1)+'" stroke="#ff7a4d" stroke-width="1.6"/>'
    +'<rect x="'+(bx-3*BK).toFixed(1)+'" y="'+(y0-10*BK).toFixed(1)+'" width="'+(6.5*BK).toFixed(1)+'" height="'+(6*BK).toFixed(1)+'" rx="1.2" fill="#cfdde5" stroke="#1a2b36" stroke-width=".7"/><path d="M'+B0(-6,-13)+' L'+B0(5,-13)+' M'+B0(-5,-13)+' L'+B0(-4,-4)+' M'+B0(4,-13)+' L'+B0(4,-4)+'" stroke="#1a2b36" stroke-width="1"/>'
    +'<path d="M'+B0(-12,-4)+' L'+B0(-22,-15)+'" stroke="#1a2b36" stroke-width="1"/>';
  /* αριθμοί */
  if(bD!=null) g+=svgNum(bx,Math.min(y1-9,Y(bD)+12),String(fB(bD)),'#ffffff','#0b1f2a');
  /* 1.8.26: οι αριθμοί δεν σκεπάζουν το δόλωμα: πάνω ~20, κάτω από τον βυθό, και ποτέ στο ίδιο ύψος */
  var lxL=Math.max(x0+16,lx+2), yLu=ly-21*BK, yLb=lD0!=null?Math.max(Y(lD0)+15,ly+20*BK):null; if(yLu<y0+9) yLu=Math.min(ly+20*BK,y1-9); if(yLb!=null&&Math.abs(yLb-yLu)<20) yLb=yLu+20; if(yLb!=null) yLb=Math.min(y1-9,yLb);
  if(lD0!=null&&Math.abs(lx-bx)>34&&yLb!=null) g+=svgNum(lxL,yLb,String(fB(lD0)),'#3b2616','#ffd9b8');
  g+=svgNum(lxL,yLu,String(lD0!=null&&dlv>=lD0-0.01?fB(lD0):Math.round(dlv/FATH)),'#ffd23f','#1a1300');
  /* άξονες */
  for(var z2=zs;z2<=zmax+0.1;z2+=zst) g+='<text x="'+(W-3)+'" y="'+(Y(z2)+3).toFixed(1)+'" font-size="11" text-anchor="end" fill="currentColor" opacity=".7">'+Math.round(z2/FATH)+'</text>';
  g+='<text x="'+(W-3)+'" y="9" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">'+T('οργ.','fm')+'</text>';
  var ex=((xmax-xmin)/(x1-x0))/((zmax-z0)/(y1-y0)); if(TS) ex=1; if(ex>=1.5||TS) g+='<text x="'+(x1-4)+'" y="'+(y1-5)+'" font-size="9.5" font-weight="700" text-anchor="end" fill="#fff" stroke="#0b1f2a" stroke-width="2.4" paint-order="stroke" opacity=".9">'+(TS?T('κλίμακα 1:1','scale 1:1'):T('κάθετα ×','vertical ×')+Math.round(ex))+'</text>';
  SV.scr={kind:'side',pxm:(x1-x0)/Math.max(1,xmax-xmin)};
  g+='<text x="'+(x0+2)+'" y="'+(H-4)+'" font-size="10.5" fill="currentColor" opacity=".7">'+Math.round(xmin)+' m</text><text x="'+bx.toFixed(1)+'" y="'+(H-4)+'" font-size="10.5" text-anchor="middle" fill="currentColor" opacity=".7">0</text><text x="'+x1+'" y="'+(H-4)+'" font-size="10.5" text-anchor="end" fill="currentColor" opacity=".7">+'+Math.round(xmax)+' m</text></svg>';
  return g; }
/* 1.8.8: ΔΟΚΙΜΗ (simulation) συρτής βυθού: ψεύτικη βάρκα 6 km στο Λατσί με 3 kn, πάνω στον πραγματικό βυθό (EMODnet από το κινητό).
   Δεν γράφει έξοδο· αλλάζει προσωρινά μόνο τη θέση/πορεία που βλέπει η συρτή. */
var SIM=null, SIMBK=null;
var SIM_WP=[[35.058,32.392],[35.068,32.376],[35.064,32.360],[35.074,32.350],[35.080,32.338]];
function simOn(){ return !!SIM; }
function simStart(){ if(SIM) return; SV.marks=[]; FS.at=0; if(B.trip&&B.trip.active&&B.trip.active()){ B.toast(T('Η δοκιμή γίνεται μόνο όταν δεν είσαι σε έξοδο.','The test runs only when you are not on a trip.')); return; }
  var wp=SIM_WP.map(function(q){ var a=q.slice(), k=0; while(k<6&&B.landExact&&B.landExact(a[0],a[1])){ a[0]+=0.004; k++; } return a; });
  var L=[0]; for(var i=1;i<wp.length;i++) L.push(L[i-1]+dist(wp[i-1],wp[i]));
  SIM={wp:wp,L:L,tot:L[L.length-1],s:0,kn:3,warp:1,trk:[],cfg:JSON.stringify(cfg()),fix:null,mk:null,ln:null,iv:0,id:'sim-'+Date.now()};
  RL={pts:[],fish:[],ev:[],trk:[],id:null}; GH=[];
  SIMBK={rigs:localStorage.getItem(RK),corr:localStorage.getItem(CK)}; /* 1.8.14: η δοκιμή δεν αλλάζει την αρματωσιά ούτε τις διορθώσεις βυθού σου */
  var c=cfg(); c.on=true; c.mode='bottom'; c.dep=null; c.iso=null; c.isoFix=false; c.auto=true; if(c.min>=3||c.max<=3){ c.min=2.5; c.max=3.5; } put(c);
  simPos(); document.body.classList.add('trsim'); paint(); paintSide(); SV.grid=null; SV.at=0;
  var mm=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); if(mm&&/^#map/.test(location.hash||'')){ try{ mm.setView(wp[0],14); }catch(e){} } else B.mapGo(wp[0][0],wp[0][1],14); SIM.iv=setInterval(simTick,1000); setTimeout(function(){ sideTick(); },800);
  if(B.say) B.say(T('Δοκιμή συρτής βυθού στο Λατσί. Πάτα Ρίχνω.','Bottom trolling test at Latchi. Tap Let out.'),null,'sim',0);
  B.toast(T('▶ Δοκιμή: η βάρκα κινείται 6 km με 3 kn. Πάτα «Ρίχνω» για να δεις όλη τη διαδικασία.','▶ Test: the boat moves 6 km at 3 kn. Tap “Let out” to see the whole process.'),7000); }
function simPos(){ var S=SIM, s=Math.min(S.s,S.tot-0.1), i=1; while(i<S.L.length-1&&S.L[i]<s) i++; var a=S.wp[i-1], b=S.wp[i], f=(s-S.L[i-1])/Math.max(1,S.L[i]-S.L[i-1]), hd=brg(a,b);
  var la=a[0]+(b[0]-a[0])*f, lo=a[1]+(b[1]-a[1])*f, now=Date.now(); S.fix={lat:la,lon:lo,t:now,spd:S.kn*0.51444,hd:hd,acc:4,sim:1};
  var lp=S.trk[S.trk.length-1]; if(!lp||dist([lp[0],lp[1]],[la,lo])>=6) S.trk.push([la,lo,now]); if(S.trk.length>3000) S.trk.shift();
  var Lf=window.L, m=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); if(Lf&&m){ try{
    if(!S.ln||!m.hasLayer(S.ln)) S.ln=Lf.polyline(S.wp,{color:'#ffd23f',weight:2,dashArray:'4 6',opacity:.8,interactive:false}).addTo(m);
    if(!S.mk||!m.hasLayer(S.mk)) S.mk=Lf.circleMarker([la,lo],{radius:12,color:'#fff',weight:4,fillColor:'#d84315',fillOpacity:1,interactive:false}).addTo(m).bindTooltip(T('Βάρκα δοκιμής','Test boat'),{permanent:true,direction:'right',offset:[12,0],className:'simtip'}); else S.mk.setLatLng([la,lo]);
    if(!S.hk){ S.hk=1; m.on('dragstart',function(){ if(SIM) SIM.hold=Date.now()+25000; }); }
    if(S.mk.bringToFront) S.mk.bringToFront();
    if(now>(S.hold||0)&&(!S.pan||now-S.pan>4000)){ S.pan=now; var sz=m.getSize(), cd=document.querySelector('.trside'), top=cd&&!cd.hidden?cd.getBoundingClientRect().bottom:0, want=Lf.point(sz.x/2,top+(sz.y-top)*0.28), pt=m.latLngToContainerPoint([la,lo]); m.panBy(pt.subtract(want),{animate:true}); } /* η βάρκα κάτω από την κάρτα, όχι πίσω της */ }catch(e){} } }
function simTick(){ var S=SIM; if(!S) return; S.s+=S.kn*0.51444*S.warp; simPos(); if(S.s>=S.tot){ simStop(true); } }
function simWarp(){ if(!SIM) return; SIM.warp=SIM.warp===1?4:1; B.toast(SIM.warp>1?T('⏩ ×4 πιο γρήγορα (οι χρόνοι «σε N″» είναι για κανονική ταχύτητα)','⏩ ×4 faster (the “in N″” times are for real speed)'):T('▶ Κανονική ταχύτητα','▶ Normal speed'),5000); paintSide(); }
function simStop(done){ var S=SIM; if(!S) return; clearInterval(S.iv); metStop(); SV.marks=[]; FS.at=0;
  var m=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); try{ if(m){ if(S.mk) m.removeLayer(S.mk); if(S.ln) m.removeLayer(S.ln); } }catch(e){}
  SIM_LAST={trk:S.trk.slice()}; try{ localStorage.setItem(K,S.cfg); if(SIMBK){ if(SIMBK.rigs==null) localStorage.removeItem(RK); else localStorage.setItem(RK,SIMBK.rigs); if(SIMBK.corr==null) localStorage.removeItem(CK); else localStorage.setItem(CK,SIMBK.corr); } }catch(e){} SIMBK=null; SIM=null; var nx=0; try{ B.store.raw('bites').forEach(function(b){ if(b.sim&&!b.deleted&&b.id){ B.store.remove('bites',b.id); nx++; } }); }catch(e){} /* τα ψάρια της δοκιμής δεν μένουν στο ημερολόγιο */ SV.prof=null; SV.adv=null; spd=null; hdg=null; document.body.classList.remove('trsim');
  paintSide(); paint(); lureMark(); try{ var mm=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); if(mm){ if(LT.lay) mm.removeLayer(LT.lay); if(CT.lay) mm.removeLayer(CT.lay); } }catch(e){} LT={pts:[],lay:null,id:null}; CT={key:'',lay:null}; /* 1.8.9: κρύβει και την παλιά κάρτα συρτής */ B.toast((done?T('■ Τέλος δοκιμής: 6 km.','■ Test finished: 6 km.'):T('■ Η δοκιμή σταμάτησε.','■ Test stopped.'))+(nx?T(' Σβήστηκαν ',' Removed ')+nx+T(' ψάρια της δοκιμής.',' test catches.'):''),5000); var lg=RL; lg.sim=1; RL={pts:[],fish:[],ev:[],trk:[],id:null}; if(lg.pts.length>3) setTimeout(function(){ sumSheet(lg); },400); }
/* 1.8.11: καταγραφή της δοκιμής για τη σύνοψη στο τέλος: απόσταση βάρκας, βυθός στο δόλωμα, βάθος δολώματος, ψάρια */
var RL={pts:[],fish:[],ev:[],trk:[],id:null}, RLd=0, RLf=null;
/* 1.8.12: η ίδια καταγραφή και στην κανονική έξοδο: x = απόσταση που έκανε η βάρκα όσο είναι ανοιχτή η συρτή βυθού */
function rlId(){ if(SIM) return SIM.id; try{ var st=B.trip.state&&B.trip.state(); return st&&st.active&&st.id||null; }catch(e){ return null; } }
function rlX(){ return SIM?SIM.s:RLd; }
function recLog(c,f){ var id=rlId(); if(!id||c.mode!=='bottom'||!f) return;
  if(RL.id!==id){ var sv=!SIM&&ls.get('alkyon-trlog',null); RL=sv&&sv.id===id?sv:{pts:[],fish:[],ev:[],trk:[],id:id,sim:SIM?1:0}; RLd=RL.pts.length?RL.pts[RL.pts.length-1].x:0; RLf=null; }
  if(!SIM){ if(RLf){ var dd=dist([RLf.lat,RLf.lon],[f.lat,f.lon]); if(dd<500) RLd+=dd; } RLf={lat:f.lat,lon:f.lon}; }
  var p=SV.prof, q=p&&p.P&&p.P[0], st=c.dep?c.dep.st:null, x=rlX();
  var lp=RL.pts[RL.pts.length-1]; if(lp&&x-lp.x<8) return;
  RL.pts.push({x:Math.round(x),d:q&&q.d!=null?+q.d.toFixed(1):null,bd:depth!=null?+depth.toFixed(1):null,l:(st==='set'||st==='drop')&&p&&!p.pre?+p.dl.toFixed(1):null,n:st?nLeads(c):0});
  RL.trk.push([+f.lat.toFixed(5),+f.lon.toFixed(5)]); if(RL.pts.length>5000){ RL.pts.shift(); RL.trk.shift(); }
  if(!SIM&&RL.pts.length%10===0) ls.set('alkyon-trlog',RL); }
function fishLog(rec){ var id=rlId(); if(!id||RL.id!==id||typeof rec.lat!=='number') return; RL.fish.push({x:Math.round(rlX()),lat:rec.lat,lon:rec.lon,miss:!!rec.miss}); if(!SIM) ls.set('alkyon-trlog',RL); }
/* στο τέλος της πραγματικής εξόδου: φύλαξε τη σύνοψη για το ημερολόγιο και δείξ' την */
function rlFinish(){ var sv=ls.get('alkyon-trlog',null); if(RL.id&&RL.pts.length&&!RL.sim) sv=RL; if(!sv||!sv.id||!sv.pts||sv.pts.length<4){ ls.set('alkyon-trlog',null); return; }
  var all=ls.get('alkyon-trlogs',{})||{}; all[sv.id]=sv; var ks=Object.keys(all); if(ks.length>15){ ks.sort(); ks.slice(0,ks.length-15).forEach(function(k){ delete all[k]; }); }
  ls.set('alkyon-trlogs',all); ls.set('alkyon-trlog',null); RL={pts:[],fish:[],ev:[],trk:[],id:null}; setTimeout(function(){ sumSheet(sv); },900); }
function upLog(){ if(RL.id&&RL.id===rlId()){ RL.ev.push({x:Math.round(rlX()),t:'up'}); if(!SIM) ls.set('alkyon-trlog',RL); } }
function sumSheet(LG){ LG=LG||RL; var P=(LG.pts||[]).filter(function(q){ return q.d!=null||q.bd!=null; }); if(P.length<4){ return; }
  var W=360,H=190,ml=30,mr=8,mt=14,mb=22, x0=P[0].x, x1=P[P.length-1].x, dmax=0; P.forEach(function(q){ dmax=Math.max(dmax,q.d||0,q.bd||0,q.l||0); }); dmax=Math.ceil(dmax*1.1/5)*5||10;
  var X=function(x){ return ml+(x-x0)/Math.max(1,x1-x0)*(W-ml-mr); }, Y=function(d){ return mt+d/dmax*(H-mt-mb); };
  var g='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="'+T('Κατακόρυφο: βυθός και δόλωμα σε όλη τη διαδρομή','Profile: bottom and lure along the whole run')+'"><rect x="'+ml+'" y="'+mt+'" width="'+(W-ml-mr)+'" height="'+(H-mt-mb)+'" fill="#d6ecf8"/>';
  var bp='M'+X(x0)+','+(H-mb); P.forEach(function(q){ var d=q.d!=null?q.d:q.bd; bp+=' L'+X(q.x).toFixed(1)+','+Y(d).toFixed(1); }); bp+=' L'+X(x1)+','+(H-mb)+'Z'; g+='<path d="'+bp+'" fill="#8a7357"/>';
  var tl='', ll=''; P.forEach(function(q){ var d=q.d!=null?q.d:q.bd; tl+=(tl?' L':'M')+X(q.x).toFixed(1)+','+Y(Math.max(0,d-tgt()*FATH)).toFixed(1); });
  g+='<path d="'+tl+'" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="4 4" opacity=".9"/>';
  var seg=false; P.forEach(function(q){ if(q.l==null){ seg=false; return; } ll+=(seg?' L':' M')+X(q.x).toFixed(1)+','+Y(q.l).toFixed(1); seg=true; }); if(ll) g+='<path d="'+ll+'" fill="none" stroke="#ffd23f" stroke-width="2.6" stroke-linejoin="round"/>';
  var hit=0; P.forEach(function(q){ var d=q.d!=null?q.d:q.bd; if(q.l!=null&&d!=null&&q.l>d-0.3) { hit++; g+='<circle cx="'+X(q.x).toFixed(1)+'" cy="'+Y(d).toFixed(1)+'" r="2.4" fill="#e53935"/>'; } });
  (LG.ev||[]).forEach(function(e){ g+='<line x1="'+X(e.x)+'" y1="'+mt+'" x2="'+X(e.x)+'" y2="'+(H-mb)+'" stroke="#0b1f2a" stroke-width="1" stroke-dasharray="2 3" opacity=".5"/><text x="'+(X(e.x)+2)+'" y="'+(mt+10)+'" font-size="9" fill="#0b1f2a">'+T('μάζεψα','in')+'</text>'; });
  (LG.fish||[]).forEach(function(fi){ var cx=X(fi.x), q=P.reduce(function(a,b){ return Math.abs(b.x-fi.x)<Math.abs(a.x-fi.x)?b:a; }), cy=Y(q.l!=null?q.l:(q.d||0)); g+=mkIco(cx,cy,!!fi.miss); });
  var fmx=dmax/FATH, fst=fmx>40?10:fmx>15?5:2; for(var kf=0;kf<=fmx+0.01;kf+=fst){ var k=kf*FATH; g+='<line x1="'+ml+'" y1="'+Y(k).toFixed(1)+'" x2="'+(W-mr)+'" y2="'+Y(k).toFixed(1)+'" stroke="#fff" stroke-width=".5" opacity=".5"/><text x="'+(ml-4)+'" y="'+(Y(k)+3).toFixed(1)+'" font-size="9" text-anchor="end" fill="#456">'+kf+'</text>'; }
  var km=(x1-x0)/1000; for(var j=0;j<=Math.floor(km);j++) g+='<text x="'+X(x0+j*1000)+'" y="'+(H-8)+'" font-size="9" text-anchor="middle" fill="#456">'+j+' km</text>';
  g+='<text x="2" y="'+(mt+4)+'" font-size="9" fill="#456">'+T('οργ.','fm')+'</text></svg>';
  /* χάρτης διαδρομής */
  var tr=(LG.trk&&LG.trk.length>1?LG.trk:(SIM_LAST?SIM_LAST.trk:[])), mw=360, mh=200, la=tr.map(function(q){ return q[0]; }), lo=tr.map(function(q){ return q[1]; }), a0=Math.min.apply(null,la), a1=Math.max.apply(null,la), o0=Math.min.apply(null,lo), o1=Math.max.apply(null,lo), kx=Math.cos(a0*Math.PI/180), sc=Math.min((mw-24)/Math.max(1e-6,(o1-o0)*kx),(mh-24)/Math.max(1e-6,a1-a0));
  var ox=(mw-24-(o1-o0)*kx*sc)/2, oy=(mh-24-(a1-a0)*sc)/2, MX=function(o){ return 12+ox+(o-o0)*kx*sc; }, MY=function(a){ return mh-12-oy-(a-a0)*sc; };
  var m='<svg viewBox="0 0 '+mw+' '+mh+'" width="100%" role="img" aria-label="'+T('Διαδρομή','Route')+'"><rect width="'+mw+'" height="'+mh+'" rx="10" fill="#cfe6f3"/><path d="'+tr.map(function(q,i){ return (i?'L':'M')+MX(q[1]).toFixed(1)+','+MY(q[0]).toFixed(1); }).join(' ')+'" fill="none" stroke="#3d5566" stroke-width="2" stroke-dasharray="5 3" opacity=".8"/>';
  m+='<circle cx="'+MX(tr[0][1])+'" cy="'+MY(tr[0][0])+'" r="5" fill="#fff" stroke="#0b1f2a" stroke-width="2"/><text x="'+(MX(tr[0][1])+8)+'" y="'+(MY(tr[0][0])+4)+'" font-size="10">'+T('Αρχή','Start')+'</text>';
  var LTp=LG.lt||[]; for(var li=1;li<LTp.length;li++){ var u=LTp[li-1], w=LTp[li]; if(u[2]==='x'||w[2]==='x') continue; m+='<line x1="'+MX(u[1]).toFixed(1)+'" y1="'+MY(u[0]).toFixed(1)+'" x2="'+MX(w[1]).toFixed(1)+'" y2="'+MY(w[0]).toFixed(1)+'" stroke="'+(LTC[w[2]]||'#999')+'" stroke-width="4" stroke-linecap="round"/>'; }
  (LG.fish||[]).forEach(function(fi){ m+='<circle cx="'+MX(fi.lon).toFixed(1)+'" cy="'+MY(fi.lat).toFixed(1)+'" r="6" fill="'+(fi.miss?'#e65100':'#2e7d32')+'" stroke="#fff" stroke-width="2"/>'; });
  m+='</svg>';
  var FS=LG.fish||[], nF=FS.filter(function(x){ return !x.miss; }).length, nM=FS.length-nF;
  var body=h('div',{class:'simsum'},h('p',{class:'sub',text:B.num(km,1)+' km · '+nF+T(nF===1?' ψάρι':' ψάρια',nF===1?' catch':' catches')+(nM?' · '+nM+T(nM===1?' χαμένο':' χαμένα',' lost'):'')+' · '+T('μάζεψες ','brought in ')+(LG.ev||[]).length+T((LG.ev||[]).length===1?' φορά':' φορές',(LG.ev||[]).length===1?' time':' times')+(hit?' · '+T('⚠ το δόλωμα ακούμπησε βυθό σε ','⚠ lure touched bottom at ')+hit+T(' σημεία',' points'):'')}),
    h('h4',{text:T('Κατακόρυφο: βυθός (καφέ), δόλωμα (κίτρινο), «1 οργιά πάνω» (άσπρη διακεκομμένη)','Profile: bottom (brown), lure (yellow), “1 fm above” (white dashed)')}),h('div',{class:'simsv',html:g}),
    h('h4',{text:T('Διαδρομή βάρκας (γκρι διακεκομμένη) και δόλωμα: πράσινο σωστά, πορτοκαλί ψηλά, κόκκινο στον βυθό · ● ψάρι','Boat route (grey dashed) and lure: green right, orange high, red on the bottom · ● catch')}),h('div',{class:'simsv',html:m}),
    LG.sim?h('p',{class:'trhint',text:T('Τα ψάρια της δοκιμής δεν μένουν στο ημερολόγιο.','Test catches are not kept in the logbook.')}):h('p',{class:'trhint',text:T('Τη βρίσκεις ξανά στο Ημερολόγιο › Έξοδοι › η έξοδος › «📈 Κατακόρυφο συρτής».','Find it again in Logbook › Trips › the trip › “📈 Trolling profile”.')}));
  B.sheet({title:LG.sim?T('Σύνοψη δοκιμής','Test summary'):T('Συρτή βυθού: σύνοψη','Bottom trolling: summary'),body:body}); }
var SIM_LAST=null;
/* 1.8.13: βάθη σε οργιές ΚΑΙ μέτρα· η γραμμή «κάτω από τη βάρκα / στο δόλωμα» για σύγκριση με το βυθόμετρο */
function fB(m){ return Math.floor(m/FATH+0.16); } /* 1.8.14: οργιές βυθού όπως τις μετράει ο κανόνας (13,6 → 13), για να βγαίνει βυθός − 1 = μολύβια */
function fm2(m){ return m==null?'–':Math.round(m/FATH)+T(' οργ.',' fm')+' · '+Math.round(m)+' m'; }
function depRow(p){ if(!p||!p.P) return null; var b=null, l=null; p.P.forEach(function(q){ if(q.x===0) b=q.d; }); var q0=p.P[0]; l=q0?q0.d:null; if(b==null) b=depth;
  return h('div',{class:'tsdep'},h('span',null,h('small',{text:T('ΚΑΤΩ ΑΠΟ ΤΗ ΒΑΡΚΑ','UNDER THE BOAT')}),h('b',{text:fm2(b)})),h('span',null,h('small',{text:T('ΒΥΘΟΣ ΣΤΟ ΔΟΛΩΜΑ','BOTTOM AT THE LURE')}),h('b',{text:fm2(l)}))); }
/* ===== 1.8.13: βυθόμετρο, ισοβαθής στον χάρτη, χρωματιστό ίχνος δολώματος, σημεία με ψάρι, ταχύτητα αντί για μολύβι, ρολόι ===== */
/* (1) διόρθωση από το βυθόμετρο: γράφεις τι δείχνει, ο χάρτης γύρω σου διορθώνεται (ίδιες διορθώσεις με το «Ακούμπησε») */
function sounderSheet(){ var f=tFix(), A=window.AlkyonDense; if(!f){ B.toast(T('Περιμένω θέση…','Waiting for position…')); return; }
  var raw=SV.grid&&A&&A.at?A.at(SV.grid,f.lat,f.lon):null, cur=gD(f.lat,f.lon); if(raw==null||!(raw>0)){ B.toast(T('Δεν έχω ακόμα βυθό από τον χάρτη εδώ.','No chart depth here yet.')); return; }
  var unit=ls.get('alkyon-sndu','fm'), sh, inp=h('input',{type:'number',inputmode:'decimal',step:'1',min:'1',max:'400',value:String(unit==='m'?Math.round(cur):Math.round(cur/FATH))});
  var ub=h('div',{class:'chips'}); [['fm',T('οργιές','fathoms')],['m',T('μέτρα','metres')]].forEach(function(u){ ub.append(h('button',{type:'button',class:'chip sm','aria-pressed':String(unit===u[0]),text:u[1],onclick:function(){ var v=+inp.value||0; if(u[0]!==unit) inp.value=String(u[0]==='m'?Math.round(v*FATH):Math.round(v/FATH)); unit=u[0]; ls.set('alkyon-sndu',unit); [].forEach.call(ub.children,function(b,i){ b.setAttribute('aria-pressed',String(i===(unit==='fm'?0:1))); }); }})); });
  var body=h('div',{class:'bform'},h('p',{class:'sub',text:T('Ο χάρτης λέει εδώ ','The chart says here ')+fm2(cur)+T('. Τι δείχνει τώρα το βυθόμετρό σου;','. What does your sounder show now?')}),ub,h('label',{class:'fld'},h('span',{text:T('Βυθόμετρο','Sounder')}),inp),
    h('button',{type:'button',class:'btn pri full',text:T('Διόρθωσε τον χάρτη','Correct the chart'),onclick:function(){ var v=+inp.value; if(!(v>0)){ return; } var m=unit==='m'?v:v*FATH, off=m-raw; if(Math.abs(off)>60){ B.toast(T('Πολύ μεγάλη διαφορά: έλεγξε τον αριθμό.','Difference too large: check the number.')); return; }
      addCorr(f.lat,f.lon,off); depth=m; sh.close(); var dfa=Math.round((m-cur)/FATH); B.toast(dfa===0?T('✓ Ο χάρτης συμφωνεί με το βυθόμετρο.','✓ The chart matches your sounder.'):T('✓ Διορθώθηκε: ο χάρτης ήταν ','✓ Corrected: the chart was ')+Math.abs(dfa)+T(dfa>0?' οργ. πιο ρηχός':' οργ. πιο βαθύς',dfa>0?' fm too shallow':' fm too deep')+T(' εδώ.',' here.'),6000); CT.key=''; sideTick(); }}),
    h('p',{class:'trhint',text:T('Η διόρθωση ισχύει γύρω από αυτό το σημείο (μέχρι ~2 km) και κρατιέται για τις επόμενες φορές.','The correction applies around this spot (up to ~2 km) and is kept for next time.')}));
  sh=B.sheet({title:T('Βυθόμετρο','Sounder'),body:body,stack:true}); setTimeout(function(){ try{ inp.select(); }catch(e){} },300); }
/* (2) η ισοβαθής που κρατάς, ζωγραφισμένη στον χάρτη */
var CT={key:'',lay:null};
function contourDraw(c,f){ var Lf=window.L, m=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(), A=window.AlkyonDense; if(!Lf||!m) return;
  var want=on()&&c.mode==='bottom'&&c.iso&&SV.grid&&A&&A.contour&&f&&c.dep;
  if(!want){ if(CT.lay){ try{ m.removeLayer(CT.lay); }catch(e){} CT.lay=null; CT.key=''; } return; }
  var cr=corrAt(f.lat,f.lon), lv=c.iso*FATH-cr, key=c.iso+'|'+Math.round(cr)+'|'+SV.grid.x0+'|'+SV.grid.y0; if(key===CT.key&&CT.lay&&m.hasLayer(CT.lay)) return;
  var g=SV.grid, ch=[]; try{ ch=A.contour(g,lv)||[]; }catch(e){ ch=[]; }
  if(CT.lay){ try{ m.removeLayer(CT.lay); }catch(e){} } CT.lay=Lf.layerGroup(); CT.key=key;
  ch.forEach(function(cn){ if(cn.length<3) return; var ll=cn.map(function(q){ return [g.y0+g.dy*(q.y+0.5),g.x0+g.dx*(q.x+0.5)]; });
    Lf.polyline(ll,{color:'#00e5ff',weight:3.5,opacity:.95,dashArray:'10 6',interactive:false}).addTo(CT.lay); });
  if(ch.length){ var best=null, bd=1e9; ch.forEach(function(cn){ cn.forEach(function(q){ var la=g.y0+g.dy*(q.y+0.5), lo=g.x0+g.dx*(q.x+0.5), d=dist([f.lat,f.lon],[la,lo]); if(d<bd){ bd=d; best=[la,lo]; } }); });
    if(best) Lf.marker(best,{interactive:false,icon:Lf.divIcon({className:'isolab',html:'<span>'+c.iso+T(' οργ.',' fm')+'</span>',iconSize:null})}).addTo(CT.lay); }
  CT.lay.addTo(m); }
/* (3) ίχνος του δολώματος: πράσινο = σωστά (πάνω από τον βυθό έως στόχο+1½ οργ.), πορτοκαλί = ψηλά, κόκκινο = ακούμπησε */
var LT={pts:[],lay:null,id:null};
function lureCls(hh){ return hh==null?null:hh<0.4?'r':hh<=tgt()+1.5?'g':'o'; }
var LTC={g:'#2ecc71',o:'#ff9800',r:'#e53935'};
function lureTrail(c){ var Lf=window.L, m=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); if(!Lf||!m) return; var id=rlId();
  if(LT.id!==id){ LT.pts=[]; LT.id=id; if(LT.lay){ try{ m.removeLayer(LT.lay); }catch(e){} LT.lay=null; } }
  if(!id||c.mode!=='bottom'){ if(LT.lay){ try{ m.removeLayer(LT.lay); }catch(e){} LT.lay=null; } return; }
  var p=SV.prof, q=p&&p.P&&p.P[0], st=c.dep?c.dep.st:null;
  if(q&&q.d!=null&&p&&!p.pre&&(st==='set'||st==='drop')){ var hh=(q.d-p.dl)/FATH, k=st==='drop'?'o':lureCls(hh), lp=LT.pts[LT.pts.length-1];
    if(!lp||dist([lp[0],lp[1]],[q.lat,q.lon])>=8){ LT.pts.push([+q.lat.toFixed(5),+q.lon.toFixed(5),k]); if(LT.pts.length>4000) LT.pts.shift(); if(RL.id===id){ RL.lt=LT.pts; } } }
  else if(LT.pts.length&&LT.pts[LT.pts.length-1][2]!=='x') LT.pts.push([0,0,'x']); /* κενό όταν δεν ψαρεύει */
  if(!LT.lay){ LT.lay=Lf.layerGroup().addTo(m); LT.drawn=0; } else if(!m.hasLayer(LT.lay)){ LT.lay.addTo(m); }
  for(var i=Math.max(1,LT.drawn||1);i<LT.pts.length;i++){ var a=LT.pts[i-1], b=LT.pts[i]; if(a[2]==='x'||b[2]==='x') continue; Lf.polyline([[a[0],a[1]],[b[0],b[1]]],{color:LTC[b[2]]||'#999',weight:5,opacity:.9,interactive:false}).addTo(LT.lay); }
  LT.drawn=LT.pts.length; }
/* (4) σημεία όπου έπιασες ψάρι στη συρτή βυθού: «σε 40″ το δόλωμα περνάει από εκεί» */
var FS={list:null,at:0,said:{}};
/* 1.8.23: ψάρι / χαμένο που πατάς στη συρτή: σημάδι πάνω στο διάγραμμα (Κανονικό, Zoom, Lock), εκεί που ήταν το δόλωμα */
SV.marks=[];
function markCatch(miss){ var p=SV.prof, q=p&&p.P&&p.P[0]; FS.at=0; if(!p||p.pre||!q) return; var x=rlX(); if(x==null) return;
  SV.marks.push({x:x,s:x-p.lb,lat:q.lat,lon:q.lon,hh:q.d!=null?(q.d-p.dl)/FATH:null,dl:q.d!=null?Math.min(p.dl,q.d):p.dl,miss:miss,t:Date.now()}); if(SV.marks.length>40) SV.marks.shift(); setTimeout(sideTick,50); }
function mkIco(x,y,miss,r){ r=r||8; return miss?'<g transform="translate('+x.toFixed(1)+','+y.toFixed(1)+')"><circle r="'+(r-1)+'" fill="#e0662e" stroke="#fff" stroke-width="1.6"/><path d="M-3 -3L3 3M3 -3L-3 3" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></g>'
  :'<g transform="translate('+x.toFixed(1)+','+y.toFixed(1)+')"><circle r="'+r+'" fill="#1b8f4e" stroke="#fff" stroke-width="1.6"/><ellipse cx="1.2" cy="0" rx="4.3" ry="2.7" fill="#fff"/><path d="M-2.4 0-5.8-3.1v6.2Z" fill="#fff"/><circle cx="3.1" cy="-.6" r=".8" fill="#1b8f4e"/></g>'; }
function fishSpots(){ var now=Date.now(); if(FS.list&&now-FS.at<60000) return FS.list; FS.at=now; var S=B.store; FS.list=[]; if(!S) return FS.list;
  try{ S.raw('bites').forEach(function(b){ if(b.deleted||(b.sim&&!SIM)||b.miss||typeof b.lat!=='number'||!b.troll||b.troll.m!=='bottom') return; FS.list.push({lat:b.lat,lon:b.lon,date:b.date||'',sp:b.species||''}); }); }catch(e){}
  return FS.list; }
function fishAhead(c,f){ SV.fish=null; SV.fishPts=[]; var p=SV.prof; if(!p||!p.P||p.pre||!c.dep||c.dep.st!=='set') return; var L=fishSpots().filter(function(sp){ return !SV.marks.some(function(m){ return m.lat!=null&&dist([m.lat,m.lon],[sp.lat,sp.lon])<80; }); }); if(!L.length) return; /* 1.8.23: όχι «περνάς από ψάρι» για το ψάρι που μόλις έπιασες */
  var v=vEff(); if(!(v>0.8)) return; var vms=v*0.514, lureX=-p.lb, best=null, near={};
  p.P.forEach(function(q){ if(q.x<lureX-8) return; var t=Math.max(0,q.x-lureX)/vms; if(t>120) return; L.forEach(function(s,i){ var dd=dist([q.lat,q.lon],[s.lat,s.lon]); if(dd<60){ if(!best||t<best.t) best={t:t,s:s,i:i}; if(q.d!=null&&(!near[i]||dd<near[i].dd)) near[i]={x:q.x,t:t,d:q.d,dd:dd}; } }); });
  Object.keys(near).forEach(function(k){ SV.fishPts.push(near[k]); }); /* 1.8.28: ένα σημάδι ανά ψάρι, στο πιο κοντινό σημείο (όχι αλυσίδα) */
  if(!best) return; SV.fish={t:Math.round(best.t),s:best.s}; var k=best.s.lat.toFixed(4)+','+best.s.lon.toFixed(4), now=Date.now();
  if(best.t<=60&&now-(FS.said[k]||0)>600000){ FS.said[k]=now; var dd=best.s.date?best.s.date.slice(8,10)+'/'+best.s.date.slice(5,7):'';
    var msg=best.t<8?T('Το δόλωμα περνάει τώρα από σημείο που έπιασες ψάρι','The lure is passing a spot where you caught a fish'):T('Σε ','In ')+Math.round(best.t/5)*5+T(' δευτερόλεπτα το δόλωμα περνάει από σημείο που έπιασες ψάρι',' seconds the lure passes a spot where you caught a fish');
    if(B.say) B.say(msg,'troll','fish',0); notify('🐟 '+msg+(dd?' ('+dd+')':'')); try{ navigator.vibrate&&navigator.vibrate([120,80,120]); }catch(e){} } }
/* (5) μικρή διόρθωση με την ταχύτητα αντί για μολύβι: ποια ταχύτητα (μέσα στα όριά σου) δίνει το ίδιο αποτέλεσμα */
function speedAlt(c,a){ if(!a||(a.act!=='up'&&a.act!=='down')||a.k>2||a.d==null) return null; var n=nLeads(c), v=vEff(); if(!(v>0.8)) return null; var shown=spd!=null?spd:v; var want=a.d-tgt()*FATH;
  var step=a.act==='up'?0.1:-0.1, lo=+c.min||0.5, hi=+c.max||8;
  for(var vv=v+step;vv>=lo-1e-6&&vv<=hi+1e-6;vv+=step){ var g=geo(c,vv); if(!g) continue; if(a.act==='up'?g.dl<=want:g.dl>=want-0.5*FATH&&g.dl<=want){ var vr=Math.round(vv*10)/10; return Math.abs(vr-shown)>=0.2&&(a.act==='up'?vr>shown:vr<shown)?vr:null; } }
  return null; }
/* (6) ειδοποίηση συστήματος: φαίνεται και δονεί στο ρολόι (Garmin/Wear) αν το ρολόι δείχνει τις ειδοποιήσεις του κινητού */
function notify(text){ var c=cfg(); if(!c.watch||!('Notification' in window)||Notification.permission!=='granted') return; try{
  var o={body:text,tag:'alkyon-troll',renotify:true,vibrate:[300,120,300],icon:'icon-192.png',badge:'../badge-96.png',silent:false};
  if(navigator.serviceWorker&&navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function(r){ r.showNotification('Alkyon · '+T('Συρτή','Trolling'),o); }).catch(function(){ try{ new Notification('Alkyon',o); }catch(e){} });
  else new Notification('Alkyon',o); }catch(e){} }
/* 1.8.14: «glideslope»: πόσο ψηλά είναι το δόλωμα από τον βυθό (βυθός = ίσια γραμμή στο 0), πράσινη ζώνη-στόχος,
   τα τελευταία 60″ (συνεχής) και τα επόμενα 2′ αν δεν αλλάξεις τίποτα (διακεκομμένη) */
var GH=[];
function glideLog(c){ var p=SV.prof, q=p&&p.P&&p.P[0]; if(!p||p.pre||!q||q.d==null||!c.dep||c.dep.st!=='set'){ return; } var x=rlX()||0, v=vEff()||3;
  var lp=GH[GH.length-1]; if(lp&&Math.abs(x-lp[0])<3) return; GH.push([x,(q.d-p.dl)/FATH]); var keep=90*v*0.514; while(GH.length&&x-GH[0][0]>keep) GH.shift(); }
function svgGlide(o){ o=o||{}; var SUN=!!o.sun&&!echoOn(); var p=SV.prof; if(!p||!p.P) return ''; var v=Math.max(0.8,vEff()||3), vms=v*0.514, lureX=-p.lb, now=rlX()||0, tg=tgt();
  var fut=[]; p.P.forEach(function(q){ if(q.d==null||q.x<lureX-8) return; var t=Math.max(0,q.x-lureX)/vms; if(t<=125) fut.push([t,(q.d-p.dl)/FATH]); });
  var past=GH.map(function(g){ return [-(now-g[0])/vms,g[1]]; }).filter(function(g){ return g[0]>=-62; });
  if(!fut.length&&!past.length) return '';
  var W=360,H=o.H||128,ml=26,mr=6,mt=8,mb=18, top=Math.max(tg+3,4), bot=-2; [].concat(fut,past).forEach(function(g){ top=Math.max(top,Math.min(10,g[1]+1)); }); top=Math.ceil(top);
  var X=function(t){ return ml+(t+60)/180*(W-ml-mr); }, Y=function(hh){ hh=Math.max(bot,Math.min(top,hh)); return mt+(top-hh)/(top-bot)*(H-mt-mb); };
  var gid='g'+Math.random().toString(36).slice(2,7);
  var g='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="'+T('Ύψος δολώματος από τον βυθό','Lure height above the bottom')+'"><defs><linearGradient id="w'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(SUN?'#e6f3fa':'#0f3a55')+'"/><stop offset="1" stop-color="'+(SUN?'#cfe6f3':'#0a2a40')+'"/></linearGradient><linearGradient id="b'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(SUN?'#c4936a':'#9a5a2c')+'"/><stop offset="1" stop-color="'+(SUN?'#8a6346':'#2b1a10')+'"/></linearGradient></defs>';
  var EC=echoOn(); g+='<clipPath id="k'+gid+'"><rect x="'+ml+'" y="'+mt+'" width="'+(W-ml-mr)+'" height="'+(H-mb-mt)+'" rx="6"/></clipPath>';
  g+='<rect x="'+ml+'" y="'+mt+'" width="'+(W-ml-mr)+'" height="'+(H-mb-mt)+'" rx="6" fill="'+(EC?(SUN?'#173f7a':'#081b40'):'url(#w'+gid+')')+'"/>';
  if(!EC) g+='<rect x="'+ml+'" y="'+Y(0).toFixed(1)+'" width="'+(W-ml-mr)+'" height="'+(H-mb-Y(0)).toFixed(1)+'" fill="url(#b'+gid+')"/>';
  for(var gk=1;gk<=top;gk+=top>6?2:1) g+='<line x1="'+ml+'" y1="'+Y(gk).toFixed(1)+'" x2="'+(W-mr)+'" y2="'+Y(gk).toFixed(1)+'" stroke="#7fb8d8" stroke-width=".6" stroke-dasharray="2 4" opacity=".3"/>';
  g+='<rect x="'+ml+'" y="'+Y(tg+1).toFixed(1)+'" width="'+(W-ml-mr)+'" height="'+(Y(Math.max(0.5,tg-0.5))-Y(tg+1)).toFixed(1)+'" fill="#2ecc71" opacity=".22"/>';
  g+='<line x1="'+ml+'" y1="'+Y(tg).toFixed(1)+'" x2="'+(W-mr)+'" y2="'+Y(tg).toFixed(1)+'" stroke="'+(SUN?'#08804a':'#5ff0a8')+'" stroke-width="1.4" stroke-dasharray="4 3"/>';
  g+='<line x1="'+ml+'" y1="'+Y(0).toFixed(1)+'" x2="'+(W-mr)+'" y2="'+Y(0).toFixed(1)+'" stroke="#ff6a3d" stroke-width="2.2"/>';
  g+='<rect x="'+X(0).toFixed(1)+'" y="'+mt+'" width="'+(W-mr-X(0)).toFixed(1)+'" height="'+(H-mb-mt)+'" fill="#fff" opacity=".05"/><line x1="'+X(0).toFixed(1)+'" y1="'+mt+'" x2="'+X(0).toFixed(1)+'" y2="'+(H-mb)+'" stroke="#ffffff" stroke-width=".8" stroke-dasharray="1.5 2.5" opacity=".6"/>';
  g+='<g clip-path="url(#k'+gid+')"><g class="gnd">';
  if(EC){ var SC=1.5, EXT=30, pw=W-ml-mr+EXT, ph=H-mb-mt, gl=(rlX()||0)-p.lb, tpp=180/(W-ml-mr);
    var im=echoCanvas(Math.round(pw*SC),Math.round(ph*SC),function(px){ var t=-60+(px/SC)*tpp; return {gx:gl+t*vms,d:0,d2:false,surf:false,sl:0,z:function(py){ var hh=top-(py/SC)/ph*(top-bot); return -hh*FATH; }}; });
    if(im) g+='<image href="'+im+'" x="'+ml+'" y="'+mt+'" width="'+pw+'" height="'+ph+'" preserveAspectRatio="none" style="image-rendering:pixelated"/>'; }
  if(past.length>1) g+='<path d="'+past.map(function(q,i){ return (i?'L':'M')+X(q[0]).toFixed(1)+','+Y(q[1]).toFixed(1); }).join(' ')+'" fill="none" stroke="#ffd23f" stroke-width="3" stroke-linejoin="round"/>';
  if(fut.length>1) g+='<path d="'+fut.map(function(q,i){ return (i?'L':'M')+X(q[0]).toFixed(1)+','+Y(q[1]).toFixed(1); }).join(' ')+'" fill="none" stroke="#ffd23f" stroke-width="2.2" stroke-dasharray="5 4" opacity=".85"/>';
  fut.forEach(function(q){ if(q[1]<0.4) g+='<circle cx="'+X(q[0]).toFixed(1)+'" cy="'+Y(Math.max(0,q[1])).toFixed(1)+'" r="2.6" fill="#e53935"/>'; });
  (SV.fishPts||[]).forEach(function(fp){ if(fp.t<=125) g+=EC?arch(X(fp.t),Y(Math.max(0,(fp.d-p.dl)/FATH))-8,.8):'<g opacity=".75">'+mkIco(X(fp.t),Y(Math.max(0,(fp.d-p.dl)/FATH)),false,6.5)+'</g>'; });
  SV.marks.forEach(function(m){ var tm=-(now-m.x)/vms; if(tm<-62||tm>1||m.hh==null) return; g+='<line x1="'+X(tm).toFixed(1)+'" y1="'+mt+'" x2="'+X(tm).toFixed(1)+'" y2="'+(H-mb)+'" stroke="'+(m.miss?'#e0662e':'#1b8f4e')+'" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>'+mkIco(X(tm),Y(m.hh),m.miss); });
  g+='</g></g>'; SV.scr={kind:'glide',pxs:(W-ml-mr)/180};
  var bD=null; p.P.forEach(function(q){ if(q.x===0) bD=q.d; }); var lD=p.P[0]?p.P[0].d:null;
  var h0=fut.length?fut[0][1]:past[past.length-1][1];
 g+='<circle cx="'+X(0).toFixed(1)+'" cy="'+Y(h0).toFixed(1)+'" r="9" fill="#ffd23f" opacity=".25"/><circle cx="'+X(0).toFixed(1)+'" cy="'+Y(h0).toFixed(1)+'" r="5" fill="#ffd23f" stroke="#1a1300" stroke-width="1.2"/>';
  for(var k=0;k<=top;k+=top>6?2:1) g+='<text x="'+(ml-4)+'" y="'+(Y(k)+3).toFixed(1)+'" font-size="11" text-anchor="end" fill="currentColor">'+k+'</text>';
  if(!o.H) g+='<text x="'+(ml+5)+'" y="'+(mt+11)+'" font-size="10" font-weight="700" letter-spacing=".06em" fill="'+(SUN?'#24404f':'#9fd3ef')+'">'+T('BOTTOM LOCK · ΟΡΓ. ΠΑΝΩ ΑΠΟ ΒΥΘΟ','BOTTOM LOCK · FM ABOVE BOTTOM')+'</text>';
  [[-60,'−60″'],[0,T('τώρα','now')],[60,'+1′'],[120,'+2′']].forEach(function(a){ g+='<text x="'+X(a[0]).toFixed(1)+'" y="'+(H-5)+'" font-size="11" text-anchor="middle" fill="currentColor">'+a[1]+'</text>'; });
  g+='<text x="'+(W-mr-3)+'" y="'+(Y(0)+11).toFixed(1)+'" font-size="10.5" font-weight="700" text-anchor="end" fill="'+(EC?'#fff':'#ffd9b8')+'"'+(EC?' stroke="#061634" stroke-width="2.5" paint-order="stroke"':'')+'>'+(o.H?T('ΒΥΘΟΣ','BOTTOM'):T('βυθός · κάτω από εδώ = σέρνεται','bottom · below = dragging'))+'</text>';
  g+='<text x="'+(W-mr-3)+'" y="'+(Y(tg+1)+10).toFixed(1)+'" font-size="'+(o.H?13:11)+'" font-weight="900" text-anchor="end" fill="'+(SUN?'#08804a':'#5ff0a8')+'">'+(o.H?T('ΣΤΟΧΟΣ ','TARGET ')+B.num(tg,1):T('στόχος','target'))+'</text></svg>';
  return g; }
function viewMode(){ return ls.get('alkyon-trview','glide'); }
/* ===== 1.8.18: ΟΘΟΝΗ «ΣΥΡΤΗ ΒΥΘΟΥ» (σαν chartplotter / PFD): διάγραμμα, 3 μεγάλα νούμερα, μία εντολή, μεγάλα κουμπιά ===== */
var ICO={stop:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>',
 mic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
 iso:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/></svg>',
 up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M6 11l6-6 6 6"/></svg>',
 fish:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 12c2.6-3.6 6-5.5 9.6-5.5 3.3 0 5.6 2.1 6.4 5.5-.8 3.4-3.1 5.5-6.4 5.5-3.6 0-7-1.9-9.6-5.5Z"/><path d="M3.6 12 .8 8.2v7.6L3.6 12Z"/><circle cx="15.6" cy="10.8" r="1.1" fill="#000" opacity=".55"/></svg>'};
function icoB(name,title,fn,cls){ return h('button',{type:'button',class:'ckib'+(cls?' '+cls:''),title:title,'aria-label':title,html:ICO[name],onclick:fn}); }
function cockOn(){ return ls.get('alkyon-trcock',true)!==false; }
function ckRing(frac,txt){ var r=26,cc=2*Math.PI*r; return '<svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="'+r+'" stroke="rgba(255,255,255,.35)" stroke-width="6" fill="none"/><circle cx="32" cy="32" r="'+r+'" stroke="#fff" stroke-width="6" fill="none" stroke-dasharray="'+(cc*Math.max(0,Math.min(1,frac))).toFixed(1)+' '+cc.toFixed(1)+'" transform="rotate(-90 32 32)" stroke-linecap="round"/><text x="32" y="38" text-anchor="middle" font-size="17" font-weight="900" fill="#fff">'+txt+'</text></svg>'; }
function ckNum(lab,big,sub,cls,fn){ return h(fn?'button':'div',{type:fn?'button':null,class:'cknum'+(cls?' '+cls:''),onclick:fn||null},h('small',{text:lab}),h('b',{text:big}),sub?(sub.nodeType?sub:h('i',{text:sub})):null); }
function tgtPick(){ var c=cfg(), sh, cur=tgt(); var row=h('div',{class:'ckopts'},[0.5,1,1.5,2,3].map(function(v){ return h('button',{type:'button',class:'ckopt'+(Math.abs(v-cur)<0.01?' on':''),text:B.num(v,1),onclick:function(){ var q=cfg(); q.tgt=v; put(q); sh.close(); sideTick(); B.toast(T('Στόχος: ','Target: ')+B.num(v,1)+T(' οργ. πάνω από τον βυθό',' fm above the bottom'),3500); }}); }));
  sh=B.sheet({title:T('Πόσο πάνω από τον βυθό;','How high above the bottom?'),body:h('div',{class:'bform'},row,h('p',{class:'trhint',text:T('Σε οργιές. Αλλάζουν αμέσως η πράσινη ζώνη, τα «Μάζεψε/Άφησε» και το «Σταμάτα στα».','In fathoms. The green band, “bring in / let out” and “stop at” change at once.')}))}); }
/* 1.8.19: μικρός χάρτης μέσα στην οθόνη συρτής: η βάρκα στο κέντρο με την πλώρη πάνω, το ίχνος πίσω, το δόλωμα, σημεία με ψάρι, βόρειο βέλος */
var MMC={key:'',ch:[]};
function ckMini(big){ var f=tFix(); if(!f) return null; var W=360,H=big?260:150, R=Math.max(250,Math.min(900,(SV.prof&&SV.prof.lb||200)*1.6)), sc=(H/2-12)/R, hd=(hdg!=null?hdg:(f.hd||0))*Math.PI/180;
  var P=function(la,lo){ var dx=(lo-f.lon)*111320*Math.cos(f.lat*Math.PI/180), dy=(la-f.lat)*110540, x=dx*Math.cos(hd)-dy*Math.sin(hd), y=dx*Math.sin(hd)+dy*Math.cos(hd); return [W/2+x*sc,H/2-y*sc]; };
  var g='<svg viewBox="0 0 '+W+' '+H+'" width="100%" class="ckmm" role="img" aria-label="'+T('Μικρός χάρτης','Mini map')+'">';
  g+='<circle cx="'+W/2+'" cy="'+H/2+'" r="'+(H/2-12)+'" fill="none" stroke="currentColor" opacity=".18" stroke-dasharray="3 4"/><circle cx="'+W/2+'" cy="'+H/2+'" r="'+((H/2-12)/2)+'" fill="none" stroke="currentColor" opacity=".12" stroke-dasharray="3 4"/>';
  /* 1.8.20: ισοβαθείς (κάθε 5 οργιές γύρω από το βάθος σου) από το πλέγμα βυθού */
  var A=window.AlkyonDense, gr=SV.grid, bd0=gD(f.lat,f.lon); if(gr&&A&&A.contour&&bd0!=null){ var cf=bd0/FATH, cr=corrAt(f.lat,f.lon), st=cf>60?10:5, lv=[]; for(var L=Math.max(st,Math.floor((cf-15)/st)*st);L<=cf+15;L+=st) lv.push(L);
    var key=gr.x0+'|'+gr.y0+'|'+Math.round(cr)+'|'+lv.join(','); if(MMC.key!==key){ MMC.key=key; MMC.ch=lv.map(function(L){ var ch=[]; try{ ch=A.contour(gr,L*FATH-cr)||[]; }catch(e){} return {L:L,ch:ch}; }); }
    var isoL=cfg().iso; MMC.ch.forEach(function(o){ var best=null, bdist=1e9, hot=isoL&&Math.abs(o.L-isoL)<0.5; o.ch.forEach(function(cn){ var d='', on=false; cn.forEach(function(q){ var la=gr.y0+gr.dy*(q.y+0.5), lo=gr.x0+gr.dx*(q.x+0.5), xy=P(la,lo), inn=xy[0]>-20&&xy[0]<W+20&&xy[1]>-20&&xy[1]<H+20; if(inn){ d+=(on?'L':'M')+xy[0].toFixed(1)+','+xy[1].toFixed(1); on=true; var dd=Math.abs(xy[0]-W/2)+Math.abs(xy[1]-H/2); if(xy[0]>24&&xy[0]<W-24&&xy[1]>14&&xy[1]<H-14&&dd<bdist){ bdist=dd; best=xy; } } else on=false; });
        if(d) g+='<path d="'+d+'" fill="none" stroke="'+(hot?'#00e5ff':'currentColor')+'" stroke-width="'+(hot?2.4:1.1)+'" opacity="'+(hot?.95:.45)+'"'+(hot?' stroke-dasharray="7 4"':'')+'/>'; });
      if(best) g+='<text x="'+best[0].toFixed(1)+'" y="'+(best[1]+4).toFixed(1)+'" font-size="11" font-weight="900" text-anchor="middle" fill="'+(hot?'#00e5ff':'currentColor')+'" style="stroke:var(--ck-pn,#0e2230)" stroke-width="3" paint-order="stroke">'+o.L+'</text>'; }); }
  var tr=tTrack(), pts=tr&&tr.pts?tr.pts.slice(-400):[]; if(pts.length>1){ var d=''; pts.forEach(function(q,i){ var xy=P(q[0],q[1]); d+=(i?'L':'M')+xy[0].toFixed(1)+','+xy[1].toFixed(1); }); g+='<path d="'+d+'" fill="none" stroke="#ff7a4d" stroke-width="2.5" stroke-linejoin="round" opacity=".85"/>'; }
  if(LT.pts&&LT.pts.length>1){ for(var i=1;i<LT.pts.length;i++){ var a=LT.pts[i-1], b=LT.pts[i]; if(a[2]==='x'||b[2]==='x') continue; var A=P(a[0],a[1]), Bp=P(b[0],b[1]); if(Math.abs(A[0]-W/2)>W||Math.abs(A[1]-H/2)>H) continue; g+='<line x1="'+A[0].toFixed(1)+'" y1="'+A[1].toFixed(1)+'" x2="'+Bp[0].toFixed(1)+'" y2="'+Bp[1].toFixed(1)+'" stroke="'+(LTC[b[2]]||'#999')+'" stroke-width="4" stroke-linecap="round"/>'; } }
  fishSpots().forEach(function(sp){ var xy=P(sp.lat,sp.lon); if(xy[0]<6||xy[0]>W-6||xy[1]<6||xy[1]>H-6) return; g+='<circle cx="'+xy[0].toFixed(1)+'" cy="'+xy[1].toFixed(1)+'" r="6" fill="#1b8f4e" stroke="#fff" stroke-width="1.5"/>'; });
  var q0=SV.prof&&SV.prof.P&&SV.prof.P[0]; if(q0){ var L0=P(q0.lat,q0.lon); g+='<circle cx="'+L0[0].toFixed(1)+'" cy="'+L0[1].toFixed(1)+'" r="9" fill="#ffd23f" opacity=".3"/><circle cx="'+L0[0].toFixed(1)+'" cy="'+L0[1].toFixed(1)+'" r="5" fill="#ffd23f" stroke="#1a1300" stroke-width="1.2"/>'; }
  g+='<path d="M'+W/2+','+(H/2-10)+' L'+(W/2+7)+','+(H/2+8)+' L'+W/2+','+(H/2+4)+' L'+(W/2-7)+','+(H/2+8)+' Z" fill="#ff7a4d" stroke="#fff" stroke-width="1.5"/>';
  var nx=W-22, ny=20, na=-hd; g+='<g transform="translate('+nx+','+ny+') rotate('+(na*180/Math.PI).toFixed(1)+')"><path d="M0,-11 L5,4 L0,1 L-5,4 Z" fill="#e53935"/><text x="0" y="14" text-anchor="middle" font-size="10" font-weight="900" fill="currentColor" transform="rotate('+(-na*180/Math.PI).toFixed(1)+' 0 10)">N</text></g>';
  g+='<text x="8" y="'+(H-8)+'" font-size="11" font-weight="800" fill="currentColor" opacity=".75">'+Math.round(R)+' m</text></svg>';
  return h('button',{type:'button',class:'ckmini'+(big?' big':''),title:T('Άνοιξε τον μεγάλο χάρτη','Open the big map'),html:g,onclick:function(){ ls.set('alkyon-trcock',false); document.body.classList.remove('trck'); paintSide(); }}); }
function sunElev(lat,lon,d){ d=d||new Date(); var rad=Math.PI/180, n=(d-Date.UTC(d.getUTCFullYear(),0,1))/864e5, decl=-23.44*Math.cos(rad*360/365*(n+10)), ut=d.getUTCHours()+d.getUTCMinutes()/60, ha=(ut-12)*15+lon;
  var el=Math.asin(Math.sin(lat*rad)*Math.sin(decl*rad)+Math.cos(lat*rad)*Math.cos(decl*rad)*Math.cos(ha*rad))/rad; return el; }
function sunMode(){ var m=ls.get('alkyon-trsun','auto'); if(m===true||m===false) return m; var f=tFix()||B.lastPos(); if(!f) return false; return sunElev(f.lat,f.lon)>12; } /* 1.8.21: αυτόματα ήλιος όταν ο ήλιος είναι ψηλά */
function paintCock(c,dst,v){ var sm=ls.get('alkyon-trsun','auto'), night=document.documentElement.classList.contains('night'), sun=!night&&sunMode(); side.className='trside ck'+(sun?' sun':'')+(night?' red':''); document.body.classList.add('trck');
  var K2=[], p=SV.prof, a=SV.adv, n=nLeads(c);
  K2.push(h('div',{class:'cktop'},icoB('menu',T('Ρυθμίσεις συρτής','Trolling settings'),sheet),h('b',{text:T('ΣΥΡΤΗ ΒΥΘΟΥ','BOTTOM TROLLING')}),
    h('button',{type:'button',class:'cksp'+(spd!=null&&(spd>c.max||spd<c.min)?' bad':''),title:T('GPS · στο νερό (από το ρεύμα): με αυτή υπολογίζεται το βάθος. Πάτα: με / χωρίς ρεύμα','GPS · through water (from the current): the depth uses this. Tap: with / without current'),onclick:function(){ var q=cfg(); q.noCur=!q.noCur; put(q); SV.stw=null; B.toast(q.noCur?T('Χωρίς ρεύμα: το βάθος από την ταχύτητα GPS','Without current: depth from the GPS speed'):T('Με ρεύμα: το βάθος από την ταχύτητα στο νερό','With current: depth from the speed through water'),3500); sideTick(); }},spd!=null?B.num(spd,1)+' kn':'– kn',c.noCur?h('small',{text:T('χωρίς ρεύμα','no current')}):SV.stw!=null&&spd!=null&&Math.abs(SV.stw-spd)>=0.1?h('small',{text:T('νερό ','water ')+B.num(SV.stw,1)}):null),
    icoB('map',T('Χάρτης (μικρή κάρτα)','Map (small card)'),function(){ ls.set('alkyon-trcock',false); document.body.classList.remove('trck'); paintSide(); }),
    /* 1.9.13: «Τέλος συρτής» πάνω, ένα πάτημα (με επιβεβαίωση), όχι στο τέλος των ρυθμίσεων */
    icoB('stop',T('Τέλος συρτής','Stop trolling'),function(){ (B.ask?B.ask(T('Τέλος συρτής;','Stop trolling?'),T('Τέλος','Stop'),true):Promise.resolve(true)).then(function(y){ if(!y) return; var q=cfg(); q.on=false; put(q); B.toast(T('Η συρτή σταμάτησε. Η έξοδος συνεχίζεται.','Trolling stopped. The trip continues.'),4000); }); },'ckstop'),
    (function(){ var b=icoB(sm==='auto'?(sun?'sun':'moon'):sm?'sun':'moon',T('Φωτεινότητα: αυτόματα → ήλιος → νύχτα','Brightness: auto → sun → night'),function(){ ls.set('alkyon-trsun',sm==='auto'?true:sm===true?false:'auto'); paintSide(); B.toast(sm==='auto'?T('☀ Ήλιος','☀ Sun'):sm===true?T('🌙 Νύχτα','🌙 Night'):T('Αυτόματα (από τη θέση του ήλιου)','Auto (from the sun position)'),2500); },sm==='auto'?'auto':''); return b; })()));
  if(SIM) K2.push(h('div',{class:'cksim'},h('span',{text:B.num(SIM.s/1000,1)+' / '+B.num(SIM.tot/1000,1)+' km'}),h('button',{type:'button',class:'chip sm',text:SIM.warp>1?'×4':'×1',onclick:simWarp}),h('button',{type:'button',class:'chip sm',text:T('■ Τέλος','■ Stop'),onclick:function(){ simStop(false); }})));
  if(SV.land) K2.push(h('div',{class:'ckland',text:T('🏝 Είσαι στη στεριά · βυθός και ειδοποιήσεις ξεκινούν μόλις μπεις στη θάλασσα','🏝 You are on land · depth and alerts start once you are on the water')}));
  if(!SV.land&&spd!=null&&(spd>c.max||(spd<c.min&&spd>=0.8))) K2.push(h('div',{class:'ckwarn',text:(spd>c.max?T('⚠ ΠΟΛΥ ΓΡΗΓΟΡΑ · όριο ','⚠ TOO FAST · limit '):T('⚠ ΠΟΛΥ ΑΡΓΑ · όριο ','⚠ TOO SLOW · limit '))+B.num(c.min,1)+'–'+B.num(c.max,1)+' kn'}));
  var tdD=depthL!=null?depthL:depth, td=tooDeep(c,vEff(),tdD); if(td) K2.push(h('div',{class:'ckwarn',text:T('⚠ ΠΟΛΥ ΒΑΘΙΑ για την αρματωσιά: βυθός ','⚠ TOO DEEP for the rig: bottom ')+fB(tdD)+T(' οργ., με όλα τα ',' fm, with all ')+td.mx+T(' μολύβια φτάνει ~',' leads it reaches ~')+Math.round(td.dl/FATH)+T(' οργ.',' fm')}));
  /* διάγραμμα */
  /* 1.9.22: το διάγραμμα γεμίζει όλο το πλάτος: το πλάτος του σχεδίου ακολουθεί το σχήμα του κουτιού (όχι σταθερό 360×240, που άφηνε κενά δεξιά-αριστερά) */
  var dv0=side.querySelector('.ckdv'), dw0=dv0&&dv0.clientWidth, dh0=dv0&&dv0.clientHeight;
  var vm=viewMode(), DO={H:vm==='glide'?230:240,sun:sun}; if(vm!=='glide'&&dw0>50&&dh0>50) DO.W=Math.max(300,Math.min(900,Math.round(DO.H*dw0/dh0)));
  var sv=vm==='map'?null:(p?(vm==='glide'?(svgGlide(DO)||svgSide(DO)):svgSide(DO)):''), mapEl=vm==='map'?ckMini(true):null;
  K2.push(h('div',{class:'ckdia'},sv&&!mapEl?h('div',{class:'ckopt2'},vm==='side'?h('button',{type:'button',class:'ckecho one'+(trueOn()?' on':''),title:T('Πραγματική κλίμακα (ύψος = μήκος)','True scale (height = length)'),text:'1:1',onclick:function(){ TRUE1=!TRUE1; paintSide(); }}):null,h('button',{type:'button',class:'ckecho'+(echoOn()?' on':''),title:T('Όψη βυθομέτρου (ηχώ)','Sounder look (echo)'),text:T('ΗΧΩ','ECHO'),onclick:function(){ ls.set('alkyon-trecho',!echoOn()); paintSide(); }})):null,mapEl?mapEl:sv?h('div',{class:'ckdv',html:sv}):h('div',{class:'ckdv ckempty',text:!SV.grid?T('Φορτώνω τον βυθό γύρω σου…','Loading the depth around you…'):T('Το διάγραμμα βγαίνει όταν κινείσαι (πάνω από 0,8 kn).','The diagram shows once you move (above 0.8 kn).')}),
    h('div',{class:'ckseg'},[['side',T('Κανονικό','Normal')],['zoom','Zoom'],['glide','Lock'],['map',T('Χάρτης','Map')]].map(function(o){ return h('button',{type:'button',class:vm===o[0]?'on':'',text:o[1],onclick:function(){ TRUE1=false; ls.set('alkyon-trview',o[0]); paintSide(); }}); }))));
  var q0=p&&p.P&&p.P[0], bl=q0?q0.d:null, bb=null; if(p&&p.P) p.P.forEach(function(q){ if(q.x===0) bb=q.d; }); if(bb==null) bb=depth;
  var hh=p&&bl!=null?(bl-p.dl)/FATH:null, tg=tgt();
  if(dst==='drop'){ var gd=MET.n?geo(Object.assign({},c,{auto:false,leads:MET.n,dep:null}),v):null;
    K2.push(h('div',{class:'cknums'},ckNum(T('ΕΞΩ','OUT'),String(MET.n),T('μολύβια','leads')),ckNum(T('ΣΤΑΜΑΤΑ ΣΤΑ','STOP AT'),recN!=null?String(recN):'…',recD!=null?T('βυθός εκεί ','bottom there ')+fB(recD)+T(' οργ.',' fm'):'','hl'),ckNum(T('ΒΥΘΟΣ','BOTTOM'),bb!=null?String(fB(bb)):'–',bb!=null?T('οργ. · ','fm · ')+Math.round(bb)+' m':'',null,sounderSheet)));
    K2.push(h('div',{class:'ckcmd dn'},h('div',{class:'ckct'},h('b',null,T('↓ ΑΦΗΝΩ ','↓ OUT '),h('span',{class:'ckbig2',text:MET.n+(recN?' / '+recN:'')})),h('i',{text:(gd?T('δόλωμα ~','lure ~')+Math.round(gd.dl/FATH)+T(' οργ. · ',' fm · '):'')+B.num(metIv(),1)+T('″ ανά μολύβι','″ per lead')}))));
    K2.push(h('div',{class:'ckrow'},h('button',{type:'button',class:'ckc',text:MET.paused?T('▶ Συνέχεια','▶ Resume'):T('❚❚ Παύση','❚❚ Pause'),onclick:function(){ MET.paused=!MET.paused; if(!MET.tm&&!MET.paused) metStart(); paintSide(); }}),h('button',{type:'button',class:'ckc',text:T('Πιο γρήγορα','Faster'),onclick:function(){ metPace(-0.5); }}),h('button',{type:'button',class:'ckc',text:T('Πιο αργά','Slower'),onclick:function(){ metPace(0.5); }})));
    K2.push(h('div',{class:'ckbtn'},h('button',{type:'button',class:'ckb',text:'−',onclick:function(){ setLeads(-1); paintSide(); }}),h('button',{type:'button',class:'ckb main',text:T('Στον βυθό ✓','On the bottom ✓'),onclick:function(){ setDown(recN!=null?recN:MET.n||null); }}),h('button',{type:'button',class:'ckb',text:'+',onclick:function(){ setLeads(1); paintSide(); }})));
    K2.push(h('div',{class:'ckrow'},h('button',{type:'button',class:'ckc',text:T('Άκυρο','Cancel'),onclick:cancelDrop})));
  } else if(dst==='set'){
    K2.push(h('div',{class:'cknums'},ckNum(T('ΜΟΛΥΒΙΑ','LEADS'),String(n),T('κάθε ','every ')+B.num(+rigOf(c).gap||5,0)+T(' οργ.',' fm')),
      ckNum(T('ΔΟΛΩΜΑ ↑ ΒΥΘΟ','LURE ↑ BOTTOM'),hh==null?'–':hh<0.4?T('ΒΥΘΟΣ','BOTTOM'):B.num(Math.round(hh*10)/10,1),h('i',{class:'cktg'},T('στόχος ','target '),h('u',{text:B.num(tg,1)+T(' οργ.',' fm')}),' ▾'),hh!=null&&hh<0.4?'bad':hh!=null&&hh<=tg+1.5?'hl':'hi',tgtPick),
      ckNum(T('ΒΥΘΟΣ','BOTTOM'),bb!=null?String(fB(bb)):'–',bb!=null?T('οργ. · ','fm · ')+Math.round(bb)+' m ✎':'',null,sounderSheet)));
    var cls='ok', big, sub='', ring=null;
    if(!a||a.act==='wait'){ cls='na'; big=!a?T('Περιμένω βυθό…','Waiting for depth…'):spd==null?T('Περιμένω GPS…','Waiting for GPS…'):T('Σταματημένος','Stopped'); if(a&&spd!=null) sub=T('Ξεκινάει όταν πας πάνω από 0,8 kn','Starts once you go above 0.8 kn'); }
    else if(a.act==='spd'){ cls='up'; big=a.hi?T('↓ ΚΟΨΕ ΤΑΧΥΤΗΤΑ','↓ SLOW DOWN'):T('↑ ΑΝΕΒΑΣΕ ΤΑΧΥΤΗΤΑ','↑ SPEED UP'); sub=B.num(c.min,1)+'–'+B.num(c.max,1)+' kn'; }
    else if(a.act==='up'){ cls='up'; big=T('↑ ΜΑΖΕΨΕ ','↑ BRING IN ')+a.k; sub=(a.need?'→ '+a.need+T(' μολύβια',' leads'):'')+(a.d!=null?T(' · βυθός ',' · bottom ')+fB(a.d)+T(' οργ.',' fm'):'')+(a.t>0?T(' · ξεκίνα σε ',' · start in ')+a.t+'″':'')+(a.dur?T(' · θέλει ~',' · takes ~')+(a.dur+Math.round(tSettle()))+'″':'')+(a.late?T(' · ⚠ αργείς ',' · ⚠ late by ')+a.late+'″':''); ring=a.t>0?[Math.min(1,a.t/90),a.t+'″']:[1,T('ΤΩΡΑ','NOW')]; }
    else if(a.act==='down'){ cls='dn'; big=T('↓ ΑΦΗΣΕ ','↓ LET OUT ')+a.k+T(' ΤΩΡΑ',' NOW'); sub=(a.need?'→ '+a.need+T(' μολύβια',' leads'):'')+(a.d!=null?T(' · βυθός ',' · bottom ')+fB(a.d)+T(' οργ.',' fm'):'')+(a.dur?T(' · ~',' · ~')+a.dur+T('″ να τα αφήσεις','″ to let them out'):''); }
    else { big=a.hold?T('✓ ΚΡΑΤΑ · ρηχαίνει μπροστά','✓ HOLD · shallower ahead'):T('✓ ΚΡΑΤΑ','✓ HOLD'); }
    var sa=speedAlt(c,a); if(sa) sub+=(sub?' · ':'')+T('ή ','or ')+B.num(sa,1)+' kn';
    var short=a&&a.act==='up'?(a.late?T('⚠ αργείς ','⚠ late ')+a.late+'″':a.t>0?T('ξεκίνα σε ','start in ')+a.t+'″':T('ξεκίνα τώρα','start now'))+(a.need?' → '+a.need:''):a&&a.act==='down'?(a.need?'→ '+a.need+T(' μολύβια',' leads'):''):(a&&a.act==='ok'&&a.clr!=null?'~'+B.num(Math.round(a.clr*10)/10,1)+T(' οργ. πάνω από βυθό',' fm above bottom'):sub);
    K2.push(h('button',{type:'button',class:'ckcmd '+cls+(ring&&a.t<=10?' pulse':''),title:T('Πάτα για λεπτομέρειες','Tap for details'),onclick:function(){ SV.cmdMore=!SV.cmdMore; paintSide(); }},h('div',{class:'ckct'},h('b',{text:big}),(SV.cmdMore?sub:short)?h('i',{text:SV.cmdMore?sub:short}):null),ring?h('div',{class:'ckring',html:ckRing(ring[0],ring[1])}):null));
    var rr=rigOf(c), kk=Math.max(0.8,Math.min(1.25,+rr.kD||1))*(isPhys(rr)?1:(+rr.fpl||1)); if(Math.abs(kk-1)>0.03) K2.push(h('div',{class:'ckwarn soft'},h('span',{text:'⚠ '+T('1 μολύβι = ','1 lead = ')+B.num(kk,2)+T(' οργ. από «Ακούμπησε»',' fm from “Touched”')}),h('button',{type:'button',class:'chip sm',text:T('↺ ×1','↺ ×1'),onclick:function(){ var aa=rigs().slice(), i=aa.map(function(x){ return x.id; }).indexOf(rr.id), nr=Object.assign({},rr,{kD:1,kN:0}); if(i<0) aa.push(nr); else aa[i]=nr; ls.set(RK,aa); sideTick(); }})));
    if(SV.fish) K2.push(h('div',{class:'ckfish'},h('span',{class:'ico',html:ICO.fish}),h('span',{text:SV.fish.t<8?T('Το δόλωμα περνάει ΤΩΡΑ από σημείο με ψάρι','The lure is passing a fish spot NOW'):T('Σε ','In ')+SV.fish.t+T('″ περνάς από σημείο με ψάρι','″ you pass a fish spot')+(SV.fish.s.date?' · '+SV.fish.s.date.slice(8,10)+'/'+SV.fish.s.date.slice(5,7):'')})));
    K2.push(h('div',{class:'ckbtn'},h('button',{type:'button',class:'ckb',text:'−',title:T('Ένα μολύβι λιγότερο','One lead less'),onclick:function(){ setLeads(-1); sideTick(); }}),h('button',{type:'button',class:'ckb main',text:T('Ακούμπησε','Touched'),onclick:function(){ touched(); sideTick(); }}),h('button',{type:'button',class:'ckb',text:'+',title:T('Ένα μολύβι περισσότερο','One lead more'),onclick:function(){ setLeads(1); sideTick(); }})));
    K2.push(h('div',{class:'ckfb'},h('button',{type:'button',class:'ckf ok',onclick:function(){ B.quickRec(false,null,null,true); B.toast(T('🐟 Το ψάρι γράφτηκε στη θέση του δολώματος','🐟 Catch logged where the lure is'),5000); try{ navigator.vibrate&&navigator.vibrate(80); }catch(e){} sideTick(); }},h('span',{class:'ico',html:ICO.fish}),h('span',{text:T('ΨΑΡΙ','FISH')})),
      h('button',{type:'button',class:'ckf miss',onclick:function(){ B.quickRec(true,null,null,true); B.toast(T('Γράφτηκε χαμένο τσίμπημα','Lost bite logged'),4000); sideTick(); }},h('span',{text:T('✕ Χάθηκε','✕ Lost')}))));
    var V=B.voiceCmd, von=V&&V.ok&&V.wanted();
    K2.push(h('div',{class:'ckrow'},V&&V.ok?h('button',{type:'button',class:'ckc'+(von?' on':''),onclick:function(){ V.set(!V.wanted()); paintSide(); }},h('span',{class:'ico',html:ICO.mic}),h('span',{text:von?T('Φωνή ανοιχτή','Voice on'):T('Φωνή','Voice')})):null,
      h('button',{type:'button',class:'ckc'+(c.iso?' on':''),onclick:function(){ var q=cfg(); if(q.iso){ q.iso=null; q.isoFix=false; } else if(bl!=null){ q.iso=fB(bl); q.isoFix=true; } put(q); CT.key=''; sideTick(); }},h('span',{class:'ico',html:ICO.iso}),h('span',{text:c.iso?T('Ισοβαθής ','Contour ')+c.iso:T('Κράτα βάθος','Keep depth')})),
      h('button',{type:'button',class:'ckc',onclick:function(){ cancelDrop(); upLog(); B.toast(T('Μαζεμένη. Πάτα «Ρίχνω» όταν ξαναρίχνεις.','Brought in. Tap “Let out” when you let out again.'),5000); sideTick(); }},h('span',{class:'ico',html:ICO.up}),h('span',{text:T('Μάζεψα','Brought in')}))));
    if(SV.iso) K2.push(h('div',{class:'ckiso',text:T('Ισοβαθής ','Contour ')+c.iso+T(' οργ. · τώρα ',' fm · now ')+(SV.iso.now!=null?Math.round(SV.iso.now):'–')+' · '+(SV.iso.side==='L'?T('↰ αριστερά','↰ left'):SV.iso.side==='R'?T('δεξιά ↱','right ↱'):T('πάνω της ✓','on it ✓'))}));
  } else {
    K2.push(h('div',{class:'cknums'},ckNum(T('ΜΟΛΥΒΙΑ','LEADS'),bb!=null?String(n):'–',T('θα θέλεις','you need')),ckNum(T('ΣΤΟΧΟΣ','TARGET'),B.num(tg,1),T('οργ. πάνω ▾','fm above ▾'),'hl',tgtPick),ckNum(T('ΒΥΘΟΣ','BOTTOM'),bb!=null?String(fB(bb)):'–',bb!=null?T('οργ. · ','fm · ')+Math.round(bb)+' m ✎':'',null,sounderSheet)));
    K2.push(h('button',{type:'button',class:'ckgo',onclick:dropSheet},h('b',{text:T('↓ ΡΙΧΝΩ','↓ LET OUT')}),h('i',{text:T('πάτα μόλις πέσει το πρώτο μολύβι','tap as soon as the first lead goes in')})));
  }
  side.replaceChildren.apply(side,K2); }
function micB(){ var V=B.voiceCmd; if(!V||!V.ok) return null; var on=V.wanted(); return h('button',{type:'button',class:'btn sm '+(on?'pri':'ghost'),text:on?'🎤 ON':'🎤',title:T('Φωνή: «ψάρι» / «τσίμπησε» γράφει αμέσως','Voice: “fish” / “bite” logs at once'),onclick:function(){ V.set(!V.wanted()); B.toast(V.wanted()?T('🎤 Ακούω: πες «ψάρι» ή «τσίμπησε»','🎤 Listening: say “fish” or “bite”'):T('🎤 Κλειστό','🎤 Off'),4000); paintSide(); }}); }
function paintSide(){ var c=cfg(), show=on()&&c.mode==='bottom'&&document.body.classList.contains('mapon'); /* 1.8.8: και στον κλασικό χάρτη */
  if(!show){ if(side) side.hidden=true; document.body.classList.remove('trside-on','trck'); return; }
  if(!side){ side=h('div',{class:'trside',role:'status','aria-live':'polite'}); document.body.append(side); } side.hidden=false; document.body.classList.add('trside-on');
  var dst=c.dep?c.dep.st:null, v=vEff(), kids=[];
  if(cockOn()) return paintCock(c,dst,v); side.className='trside'; document.body.classList.remove('trck');
  var mini=!!ls.get('alkyon-trmini',false); side.classList.toggle('mini',mini); /* 1.8.13: μικρή κάρτα για να φαίνεται ο χάρτης */
  kids.push(h('div',{class:'tsh'},h('button',{type:'button',class:'tsmin',title:mini?T('Μεγάλη κάρτα','Full card'):T('Μικρή κάρτα (να φαίνεται ο χάρτης)','Small card (to see the map)'),text:mini?'▾':'▴',onclick:function(){ ls.set('alkyon-trmini',!mini); if(SIM) SIM.pan=0; paintSide(); }}),h('b',{text:T('ΣΥΡΤΗ ΒΥΘΟΥ','BOTTOM TROLLING')+(dst==='drop'?T(' · ΡΙΧΝΩ',' · LETTING OUT'):'')}),h('button',{type:'button',class:'tsmin tsfull',title:T('Μεγάλη οθόνη συρτής','Full trolling screen'),text:'⤢',onclick:function(){ ls.set('alkyon-trcock',true); paintSide(); }}),
    h('span',{class:'tsk'+(spd!=null&&spd>c.max?' hi':spd!=null&&spd<c.min?' lo':''),text:(spd!=null?B.num(spd,1)+' kn':'– kn')+(SV.stw!=null?T(' · στο νερό ',' · through water ')+B.num(SV.stw,1):'')})));
  /* 1.8.8: ταχύτητα εκτός ορίων φαίνεται και στην κάρτα (όχι μόνο φωνή/δόνηση/μήνυμα) */
  if(!SV.land&&spd!=null&&(spd>c.max||(spd<c.min&&spd>=0.8))) kids.push(h('div',{class:'tsspd '+(spd>c.max?'hi':'lo'),text:(spd>c.max?T('⚠ Πολύ γρήγορα · όριο ','⚠ Too fast · limit '):T('⚠ Πολύ αργά · όριο ','⚠ Too slow · limit '))+B.num(c.min,1)+'–'+B.num(c.max,1)+' kn'}));
  if(dst==='drop'){ if(SV.prof&&MET.n) kids.push(h('div',{class:'tsv',html:svgSide()})); var gd=MET.n?geo(Object.assign({},c,{auto:false,leads:MET.n,dep:null}),v):null;
    var dr2=depRow(SV.prof); if(dr2) kids.push(dr2);
    kids.push(h('div',{class:'tsg'},cellS(T('ΕΞΩ','OUT'),String(MET.n),T('μολύβια','leads')),cellS(T('ΔΟΛΩΜΑ','LURE'),gd?'~'+fa(gd.dl):'–',T('οργ.','fm'),gd?'~'+Math.round(gd.dl)+' m':''),cellS(T('ΣΤΑΜΑΤΑ ΣΤΑ','STOP AT'),recN!=null?String(recN):'…','',recD!=null?T('βυθός εκεί ','bottom there ')+faTxt(recD):'')));
    kids.push(h('div',{class:'tsm'},h('button',{type:'button',class:'btn sm',text:MET.paused?'▶':'⏸',onclick:function(){ MET.paused=!MET.paused; if(!MET.tm&&!MET.paused) metStart(); paintSide(); }}),
      h('button',{type:'button',class:'btn sm ghost',text:T('πιο αργά','slower'),onclick:function(){ metPace(0.5); }}),h('span',{text:'⏱ '+B.num(metIv(),1)+'″/'+T('μολύβι','lead')}),h('button',{type:'button',class:'btn sm ghost',text:T('πιο γρήγορα','faster'),onclick:function(){ metPace(-0.5); }})));
    kids.push(h('div',{class:'tsb'},h('button',{type:'button',class:'btn sm ghost',text:'−',onclick:function(){ setLeads(-1); paintSide(); }}),h('button',{type:'button',class:'btn sm ghost',text:'+',onclick:function(){ setLeads(1); paintSide(); }}),h('button',{type:'button',class:'btn pri sm',text:T('Στον βυθό ✓','On the bottom ✓'),onclick:function(){ setDown(recN!=null?recN:MET.n||null); }}),h('button',{type:'button',class:'btn ghost sm',text:T('Άκυρο','Cancel'),onclick:cancelDrop})));
  } else if(dst==='set'){ var p=SV.prof, a=SV.adv, n=nLeads(c);
    var vm=viewMode(), sv=p?(vm==='glide'?(svgGlide()||svgSide()):svgSide()):''; if(sv) kids.push(h('div',{class:'tsv',html:sv}));
    if(sv) kids.push(h('div',{class:'tsvw'},[['side',T('Κανονικό','Normal')],['zoom','Bottom zoom'],['glide','Bottom lock']].map(function(o){ return h('button',{type:'button',class:'chip sm','aria-pressed':String(vm===o[0]),text:o[1],onclick:function(){ ls.set('alkyon-trview',o[0]); paintSide(); }}); }))); else kids.push(h('p',{class:'tsn',text:!SV.grid?T('Φορτώνω τον βυθό γύρω σου… (στη στεριά δεν υπάρχει βυθός)','Loading the depth around you… (no seabed on land)'):T('Δεν βρίσκω βυθό εδώ: είσαι στη στεριά ή πολύ κοντά στην ακτή.','No seabed here: you are on land or very close to shore.')}));
    if(p&&p.pre&&sv) kids.push(h('p',{class:'tsn',text:T('Χωρίς ταχύτητα (GPS): το διάγραμμα δείχνει την αρματωσιά στα ','No speed (GPS): the diagram shows the rig at ')+B.num(p.v,1)+T(' kn. Ζωντανά μόλις κινηθείς πάνω από 0,8 kn.',' kn. Live once you move above 0.8 kn.')}));
    /* 1.8.13: απλή κάρτα: μία μεγάλη εντολή, δύο καθαροί αριθμοί, μολύβια στα κουμπιά */
    var q0=p&&p.P&&p.P[0], bl=q0?q0.d:null, bb=null; if(p&&p.P) p.P.forEach(function(q){ if(q.x===0) bb=q.d; }); if(bb==null) bb=depth;
    var hh=p&&bl!=null?(bl-p.dl)/FATH:null;
    var act, cls;
    if(!a||a.act==='wait'){ act=!a?T('Περιμένω βυθό…','Waiting for depth…'):T('Περιμένω ταχύτητα (GPS)…','Waiting for speed (GPS)…'); cls='na'; }
    else if(a.act==='spd'){ act=a.hi?T('↓ ΚΑΤΕΒΑΣΕ ΤΑΧΥΤΗΤΑ','↓ SLOW DOWN'):T('↑ ΑΝΕΒΑΣΕ ΤΑΧΥΤΗΤΑ','↑ SPEED UP'); cls='warn'; }
    else if(a.act==='up') { act=T('↑ ΜΑΖΕΨΕ ','↑ BRING IN ')+a.k+T(a.k===1?' μολύβι':' μολύβια',a.k===1?' lead':' leads')+(a.t>0?T(' σε ',' in ')+a.t+'″':T(' ΤΩΡΑ',' NOW')); cls='warn'; }
    else if(a.act==='down'){ act=T('↓ ΑΦΗΣΕ ','↓ LET OUT ')+a.k+T(a.k===1?' μολύβι':' μολύβια',a.k===1?' lead':' leads'); cls='deep'; }
    else { act=a.hold?T('✓ ΚΡΑΤΑ (ρηχαίνει μπροστά)','✓ HOLD (shallower ahead)'):T('✓ ΚΡΑΤΑ','✓ HOLD'); cls='ok'; }
    var sa=speedAlt(c,a), why=null; if(a&&(a.act==='up'||a.act==='down')&&a.need&&a.d!=null) why=T('→ ','→ ')+a.need+T(' μολύβια, γιατί ',' leads, because ')+(a.act==='up'?T('ο βυθός ανεβαίνει στις ','the bottom rises to '):T('ο βυθός είναι ','the bottom is '))+fB(a.d)+T(' οργ.',' fm');
    else if(a&&a.act==='ok'&&bl!=null) why=T('βυθός ','bottom ')+fB(bl)+T(' οργ. → ',' fm → ')+n+T(' μολύβια',' leads');
    kids.push(h('div',{class:'tsact '+cls},h('span',{text:act}),why?h('small',{text:why}):null,sa?h('small',{text:T('ή χωρίς μολύβι: ','or without a lead: ')+(a.act==='up'?T('ανέβασε σε ','speed up to '):T('κατέβασε σε ','slow down to '))+B.num(sa,1)+' kn'}):null));
    if(SV.fish) kids.push(h('div',{class:'tsfish',text:'🐟 '+(SV.fish.t<8?T('Το δόλωμα περνάει ΤΩΡΑ από σημείο με ψάρι','The lure is passing a fish spot NOW'):T('Σε ','In ')+SV.fish.t+T('″ το δόλωμα περνάει από σημείο με ψάρι','″ the lure passes a fish spot'))+(SV.fish.s.date?' ('+SV.fish.s.date.slice(8,10)+'/'+SV.fish.s.date.slice(5,7)+')':'')}));
    kids.push(h('div',{class:'tsbig'},
      h('button',{type:'button',class:'tsbt',title:T('Πάτα για διόρθωση από το βυθόμετρο','Tap to correct from your sounder'),onclick:sounderSheet},h('small',{text:T('ΒΥΘΟΣ ΚΑΤΩ ΑΠΟ ΤΗ ΒΑΡΚΑ','DEPTH UNDER THE BOAT')}),h('b',{text:bb!=null?Math.round(bb/FATH)+T(' οργ.',' fm'):'–'}),h('i',{text:bb!=null?Math.round(bb)+T(' m · ✎ βυθόμετρο',' m · ✎ sounder'):''})),
      h('div',{class:hh!=null&&hh<0.4?'bad':''},h('small',{text:T('ΤΟ ΔΟΛΩΜΑ','THE LURE')}),h('b',{text:hh==null?'–':hh<0.4?T('στον βυθό!','on the bottom!'):Math.round(hh)+T(' οργ. πάνω',' fm above')}),h('i',{text:!p?'':(hh!=null&&hh<0.4&&bl!=null)?T('σέρνεται: με ','dragging: with ')+n+T(' μολύβια πάει για ',' leads it would reach ')+Math.round(p.dl/FATH)+T(' οργ., ο βυθός εκεί είναι ',' fm, the bottom there is ')+fB(bl):T('στις ','at ')+Math.round(p.dl/FATH)+T(' οργ. (',' fm (')+Math.round(p.dl)+' m)'+(bl!=null?T(' · βυθός εκεί ',' · bottom there ')+fB(bl)+T(' οργ.',' fm'):'')}))));
    if(!c.iso) kids.push(h('button',{type:'button',class:'tsup tsisoset',text:T('〰 Κράτα αυτό το βάθος (ισοβαθής ','〰 Keep this depth (contour ')+(bl!=null?Math.round(bl/FATH):'–')+T(' οργ.)',' fm)'),onclick:function(){ if(bl==null) return; var q=cfg(); q.iso=Math.round(bl/FATH); q.isoFix=true; put(q); CT.key=''; sideTick(); }}));
    else if(!SV.iso) kids.push(h('button',{type:'button',class:'tsup tsisoset',text:T('〰 Ισοβαθής ','〰 Contour ')+c.iso+T(' οργ. · πάτα για να τη σβήσεις',' fm · tap to clear'),onclick:function(){ var q=cfg(); q.iso=null; q.isoFix=false; put(q); sideTick(); }}));
    var iso=SV.iso; if(iso) kids.push(h('div',{class:'tsiso',onclick:function(){ var q=cfg(); q.iso=null; q.isoFix=false; put(q); sideTick(); },title:T('Πάτα για να σβήσεις την ισοβαθή','Tap to clear the contour')},h('span',{text:T('Ισοβαθής ','Contour ')+iso.iso+T(' οργ. · τώρα ~',' fm · now ~')+Math.round(iso.now)}),h('b',{text:(function(){ var far=Math.abs(iso.off)>3, sh=iso.off>0; if(iso.side==='L') return far?(sh?T('↰ πιο ρηχά: αριστερά','↰ shallower: left'):T('↰ πιο βαθιά: αριστερά','↰ deeper: left')):T('↰ λίγο αριστερά','↰ a little left'); if(iso.side==='R') return far?(sh?T('πιο ρηχά: δεξιά ↱','shallower: right ↱'):T('πιο βαθιά: δεξιά ↱','deeper: right ↱')):T('λίγο δεξιά ↱','a little right ↱'); return T('πάνω της ✓','on it ✓'); })()})));
    kids.push(h('button',{type:'button',class:'tsup',text:T('⤴ Μάζεψα την αρματωσιά (για να ξαναρίξω)','⤴ I brought the rig in (to let out again)'),onclick:function(){ cancelDrop(); upLog(); B.toast(T('Μαζεμένη. Πάτα «Ρίχνω» όταν ξαναρίχνεις: η συρτή μένει ανοιχτή.','Brought in. Tap “Let out” when you let out again: trolling stays on.'),6000); sideTick(); }}));
    var rr=rigOf(c), kk=Math.max(0.8,Math.min(1.25,+rr.kD||1))*(isPhys(rr)?1:(+rr.fpl||1)); if(Math.abs(kk-1)>0.03) kids.push(h('div',{class:'tsrule'},h('span',{text:'⚠ '+T('1 μολύβι = ','1 lead = ')+B.num(kk,2)+T(' οργ. (όχι 1) από ',' fm (not 1) from ')+(Math.abs((+rr.kD||1)-1)>0.03?T('«Ακούμπησε»','“Touched”'):T('τη φόρμα αρματωσιάς','the rig form'))}),Math.abs((+rr.kD||1)-1)>0.03?h('button',{type:'button',class:'chip sm',text:T('↺ Κανόνας ×1','↺ Rule ×1'),onclick:function(){ var a=rigs().slice(), i=a.map(function(x){ return x.id; }).indexOf(rr.id), nr=Object.assign({},rr,{kD:1,kN:0}); if(i<0) a.push(nr); else a[i]=nr; ls.set(RK,a); B.toast(T('Έγινε: βυθός − 1 = μολύβια.','Done: bottom − 1 = leads.')); sideTick(); }}):null));
    kids.push(h('div',{class:'tsb'},h('button',{type:'button',class:'btn sm ghost',text:'−',title:T('Ένα μολύβι λιγότερο','One lead less'),onclick:function(){ setLeads(-1); sideTick(); }}),h('div',{class:'tsn2'},h('b',{text:String(n)}),h('small',{text:T('μολύβια','leads')})),h('button',{type:'button',class:'btn sm ghost',text:'+',title:T('Ένα μολύβι περισσότερο','One lead more'),onclick:function(){ setLeads(1); sideTick(); }}),h('button',{type:'button',class:'btn sm',text:T('Ακούμπησε','Touched'),onclick:function(){ touched(); sideTick(); }}),micB(),h('button',{type:'button',class:'btn ghost sm',text:'⚙',title:T('Ρυθμίσεις συρτής','Trolling settings'),onclick:sheet})));
    if(SV.turn>25) kids.push(h('p',{class:'tsn warn',text:T('Στροφή: το δόλωμα κατεβαίνει','Turning: the lure is sinking')}));
  } else { if(SV.prof&&SV.prof.pre) kids.push(h('div',{class:'tsv',html:svgSide()}),depRow(SV.prof)||'',h('p',{class:'tsn',text:T('Προεπισκόπηση με ','Preview with ')+SV.prof.n+T(' μολύβια. Ζωντανά μόλις ρίξεις.',' leads. Live once you let out.')})); else kids.push(h('p',{class:'tsn',text:T('Το διάγραμμα βγαίνει όταν κινείσαι (πάνω από 0,8 kn) και φορτώσει ο βυθός.','The diagram shows once you are moving (above 0.8 kn) and the depth chart loads.')}));
    kids.push(h('div',{class:'tsb'},h('p',{class:'tsn',text:T('Πάτα «Ρίχνω» μόλις πέσει το πρώτο μολύβι.','Tap “Let out” as the first lead goes in.')}),h('button',{type:'button',class:'btn pri sm',text:T('Ρίχνω','Let out'),onclick:dropSheet}),micB(),h('button',{type:'button',class:'btn ghost sm',text:'⚙',onclick:sheet}))); }
  if(SIM) kids.unshift(h('div',{class:'tssim'},h('b',{text:T('ΔΟΚΙΜΗ · ','TEST · ')+B.num(SIM.s/1000,1)+' / '+B.num(SIM.tot/1000,1)+' km'}),h('button',{type:'button',class:'btn sm ghost',text:SIM.warp>1?'×4':'×1',onclick:simWarp}),h('button',{type:'button',class:'btn sm ghost',text:T('■ Τέλος','■ Stop'),onclick:function(){ simStop(false); }})));
  side.replaceChildren.apply(side,kids); }
function cellS(lab,big,unit,sub,cls){ return h('div',{class:'tsc'+(cls?' '+cls:'')},h('small',{text:lab}),h('b',null,big,unit?h('em',{text:' '+unit}):null),sub?h('i',{text:sub}):null); }
/* σημάδι «δόλωμα» στον χάρτη, πάνω στη διαδρομή πίσω σου */
var lureMk=null;
function lureMark(){ var L=window.L, C=window.AlkyonCore, m=C&&C.map&&C.map(); if(!L||!m) return; var p=SV.prof, c=cfg(), q=p&&p.P&&p.P[0];
  if(!on()||c.mode!=='bottom'||!q||!c.dep){ if(lureMk){ try{ m.removeLayer(lureMk); }catch(e){} lureMk=null; } return; }
  if(!lureMk) lureMk=L.circleMarker([q.lat,q.lon],{radius:7,color:'#0b1f2a',weight:2,fillColor:'#ffd23f',fillOpacity:1,interactive:false}).addTo(m); else lureMk.setLatLng([q.lat,q.lon]); }
/* 1.8.25: ομαλή κίνηση: ανάμεσα σε δύο ανανεώσεις το «έδαφος» κυλάει προς τα πίσω με την ταχύτητα της βάρκας (όπως στα plotters) */
var SMO={t:0,dt:1000};
function smoothGnd(){ var now=Date.now(); if(SMO.t){ var d=now-SMO.t; if(d>200&&d<3000) SMO.dt=SMO.dt*0.7+d*0.3; } SMO.t=now; var sc=SV.scr; if(!sc||!side||!side.querySelectorAll) return;
  var gms=SIM?SIM.kn*0.51444*SIM.warp:(spd||0)*0.51444; if(!(gms>0.05)) return; var dur=Math.max(300,Math.min(1600,SMO.dt)), px;
  if(sc.kind==='side') px=gms*sc.pxm*dur/1000; else { var v=Math.max(0.8,vEff()||3); px=gms/(v*0.51444)*sc.pxs*dur/1000; } if(!(px>0.05)||px>40) return;
  var L=side.querySelectorAll('.ckdv svg g.gnd'); for(var i=0;i<L.length;i++){ try{ L[i].animate([{transform:'translateX(0px)'},{transform:'translateX('+(-px).toFixed(2)+'px)'}],{duration:dur,easing:'linear',fill:'forwards'}); }catch(e){} } }
function sideTick(){ if(!on()){ paintSide(); return; } var c=cfg(), f=tFix(); if(!f){ paintSide(); return; }
  measure(); gridFor(f); SV.stw=stwOf(f); turnCheck(); advise(c,f); isoGuide(c,f); if(c.dep&&c.dep.st==='drop'&&f){ var gl=geo(Object.assign({},c,{auto:false,leads:Math.max(1,MET.n),dep:null}),vEff()); if(gl){ var lp=lurePath(f,gl.lb*(+c.calB||1)); SV.prof={P:lp,lb:gl.lb,dl:gl.dl,n:MET.n,v:vEff()}; } } if(!c.dep&&c.mode==='bottom'){ var v0=vEff(), gi=v0!=null&&v0>=0.8?geo(c,v0):null; SV.prof=gi?{P:lurePath(f,gi.lb*(+c.calB||1)),lb:gi.lb,dl:gi.dl,n:gi.n,v:v0,pre:1}:null; } /* 1.8.8: προεπισκόπηση πριν ρίξεις */
  fishAhead(c,f); glideLog(c); recLog(c,f); SV.scr=null; paintSide(); smoothGnd(); lureMark(); lureTrail(c); contourDraw(c,f); }
/* «Τι δούλεψε» στη συρτή βυθού: από τα ψάρια σου, σε ποια βάθη/μολύβια/ταχύτητες πιάνεις */
function worked(){ var S=B.store; if(!S) return null; var b=S.raw('bites').filter(function(x){ return !x.deleted&&x.troll&&x.troll.m==='bottom'&&x.troll.leads; }); if(b.length<2) return null;
  function rng(a){ a=a.filter(function(v){ return v!=null&&isFinite(v); }).sort(function(x,y){ return x-y; }); if(!a.length) return null; var lo=a[Math.floor(a.length*0.2)], hi=a[Math.min(a.length-1,Math.ceil(a.length*0.8)-1)]; return [lo,hi]; }
  var L=rng(b.map(function(x){ return +x.troll.leads; })), F=rng(b.map(function(x){ return x.troll.fath!=null?+x.troll.fath:(x.depth?x.depth/FATH:null); })), V=rng(b.map(function(x){ return x.troll.stw!=null?+x.troll.stw:+x.troll.kn; }));
  return {n:b.length,leads:L,fath:F,kn:V}; }
B.trollBtn=function(){ return h('button',{class:'iconbtn trbtn',type:'button','aria-label':T('Συρτή','Trolling'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h10l-2 3H5z"/><path d="M8 15V7l5 8"/><path d="M13 9c3 1 5 3 8 8"/><circle cx="21" cy="18" r="1.3"/></svg>',onclick:sheet}); };
B.troll={landHere:landHere,startDrop:startDrop,setDown:setDown,touched:touched,cancelDrop:cancelDrop,recommend:function(){ return {n:recN,d:recD,lb:recLb}; },corrAt:corrAt,addCorr:addCorr,bestN:bestN,dropSheet:dropSheet,on:on,cfg:cfg,sheet:sheet,adjust:adjust,layback:layback,geo:geo,lureDepth:lureDepth,setLeads:setLeads,fromWatch:fromWatch,setAuto:setAuto,nLeads:nLeads,calibrate:calibrate,speed:function(){ return spd; },sim:{start:simStart,stop:simStop,on:simOn,fix:function(){ return SIM&&SIM.fix; },follow:function(){ if(SIM){ SIM.hold=0; SIM.pan=0; } },summary:sumSheet,log:function(){ return RL; },_w:function(n){ if(SIM) SIM.warp=n; },warp:simWarp,state:function(){ return SIM?{s:SIM.s,tot:SIM.tot,wp:SIM.wp}:null; }},side:function(){ return {fishPts:SV.fishPts,prof:SV.prof,adv:SV.adv,iso:SV.iso,stw:SV.stw,met:MET.n,grid:!!SV.grid}; },sideTick:sideTick,profileOf:function(sid){ var a=ls.get('alkyon-trlogs',{})||{}; return a[sid]||null; },showProfile:function(sid){ var a=ls.get('alkyon-trlogs',{})||{}; if(a[sid]) sumSheet(a[sid]); },metPace:metPace,worked:worked};
B.on('track',check);
B.on('trip',function(){ if(!tripOn()&&!SIM) rlFinish(); }); /* 1.8.12 */
B.on('trip',function(){ if(!tripOn()&&cfg().on){ var q=cfg(); q.on=false; q.auto=true; q.dep=null; q.iso=null; q.isoFix=false; recN=null; ls.set(K,q); depth=null; depthL=null; } paint(); }); /* 1.6.3: στο τέλος της εξόδου ξανά «αυτόματα» */
setInterval(function(){ if(on()) check(); },10000);
setInterval(function(){ ownGps(on()&&!SIM&&!document.hidden); },4000); /* 1.8.30: δικό της GPS μόνο όσο είναι ανοιχτή η συρτή */
setInterval(function(){ if(!(side&&!side.hidden&&cockOn())) return; if(on()&&cfg().mode==='bottom'&&cfg().dep&&cfg().dep.st==='set'){ measure(); sideTick(); } },1000); /* 1.8.19: πιο ομαλή ανανέωση στην οθόνη συρτής */
setInterval(function(){ if(on()){ measure(); speedCheck(); } if(on()&&cfg().mode==='bottom') sideTick(); else { paintSide(); lureMark(); try{ lureTrail(cfg()); contourDraw(cfg(),null); }catch(e){} } },2000); /* 1.8.7 · 1.8.12: και ταχύτητα κάθε 2″ */
setTimeout(paint,1500);
})();
