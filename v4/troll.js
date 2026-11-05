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
function tripOn(){ return !!(B.trip&&B.trip.active&&B.trip.active()); }
function on(){ return cfg().on&&tripOn(); }
function R(){ return Math.PI/180; }
function dist(a,b){ var r=R(), dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r, x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)*Math.sin(dLo/2); return 2*6371000*Math.asin(Math.min(1,Math.sqrt(x))); }
function dest(lat,lon,brg,m){ var r=R(), d=m/6371000, a=lat*r, o=lon*r, b=brg*r, a2=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(b)), o2=o+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(a2)); return [a2/r,o2/r]; }
function brg(a,b){ var r=R(), y=Math.sin((b[1]-a[1])*r)*Math.cos(b[0]*r), x=Math.cos(a[0]*r)*Math.sin(b[0]*r)-Math.sin(a[0]*r)*Math.cos(b[0]*r)*Math.cos((b[1]-a[1])*r); return (Math.atan2(y,x)/r+360)%360; }
function pts(){ var t=B.trip&&B.trip.track&&B.trip.track(); return t&&Array.isArray(t.pts)?t.pts:[]; }

/* ---------- ταχύτητα και πορεία ---------- */
var spd=null, hdg=null, outSince=0, lastAlarm=0, depth=null, depthL=null, depthAt=0;
/* 1.6.3: στο βυθόμετρο το βάθος είναι σε οργιές· «32 οργιές → 31 μολύβια». Στην εφαρμογή: βάθη σε οργιές, απόσταση πίσω σε μέτρα */
function fa(m){ return m==null?null:Math.round(m/FATH); }
function faTxt(m){ return fa(m)+T(' οργ.',' fm'); }
function faM(m){ return fa(m)+T(' οργ.',' fm')+' · '+Math.round(m)+' m'; }
function measure(){ var f=B.trip&&B.trip.fix&&B.trip.fix(), p=pts(), now=Date.now(), s=null, hd=null;
  if(f&&f.spd!=null&&f.spd>=0&&now-f.t<15000){ s=f.spd*1.94384; if(f.hd!=null&&f.spd>0.6) hd=f.hd; }
  if(p.length>1){ var last=p[p.length-1], i=p.length-2; while(i>0&&last[2]-p[i][2]<25000) i--; var a=p[i], dt=(last[2]-a[2])/1000;
    if(dt>=4&&now-last[2]<30000){ var d=dist(a,last); if(s==null) s=d/dt*1.94384; if(hd==null&&d>8) hd=brg(a,last); } }
  if(s!=null) spd=spd==null?s:spd*0.5+s*0.5; else if(p.length&&now-p[p.length-1][2]>60000) spd=0;
  if(hd!=null) hdg=hd; }
function check(){ if(!on()){ outSince=0; return; } measure(); var c=cfg(), now=Date.now();
  if(spd!=null&&(spd<c.min||spd>c.max)){ if(!outSince) outSince=now; if(now-outSince>20000&&now-lastAlarm>60000){ lastAlarm=now;
      try{ navigator.vibrate&&navigator.vibrate(spd<c.min?[400,150,400]:[150,100,150,100,150]); }catch(e){}
      B.toast((spd<c.min?T('Συρτή: πολύ αργά · ','Trolling: too slow · '):T('Συρτή: πολύ γρήγορα · ','Trolling: too fast · '))+B.num(spd,1)+' kn ('+c.min+'–'+c.max+')',5000); if(B.say) B.say(T('Ταχύτητα ','Speed ')+B.sayNum(spd)+(spd<c.min?T(', ανέβασε',', speed up'):T(', κατέβασε',', slow down')),'speed','sp',55000); } }
  else outSince=0;
  var dc=c.dep, dropping=c.mode==='bottom'&&dc&&dc.st==='drop';
  if(B.depthAt&&now-depthAt>(dropping?8000:15000)){ var f=B.trip.fix&&B.trip.fix()||B.lastPos(); if(f){ depthAt=now;
      dAt(f.lat,f.lon).then(function(d){ if(d!=null&&d>0) depth=d; if(dropping) return recommend(f); var lb=layback(cfg(),spd), q=lb?behind({lat:f.lat,lon:f.lon},lb):null;
        return q?dAt(q.lat,q.lon).then(function(d2){ if(d2!=null&&d2>0) depthL=d2; }):null; }).catch(function(){}).then(function(){ bottomCheck(); sample(); paint(); }); } }
  if(dropping) dropAuto(c,now);
  paint(); }

/* ---------- πόσο πίσω είναι το δόλωμα ---------- */
/* μολύβια: αυτόματα = οργιές βυθού στο σημείο του δολώματος − 1 (αλλιώς κάτω από τη βάρκα), ή ο αριθμός που έβαλες */
function nLeads(c,dep){ c=c||cfg(); if(dep==null&&c.dep&&c.dep.st==='drop'&&recN!=null) return recN; if(c.auto!==false){ var D=dep!=null?dep:(depthL!=null?depthL:depth); if(D!=null) return Math.max(1,fa(D)-1); } return Math.max(0,Math.round(+c.leads||0)); }
/* 1.6.5: αρματωσιές (alkyon-rigs): από το δόλωμα προς τη βάρκα: παράμαλλο (m) → κενό πριν το 1ο μολύβι (οργιές) → μολύβια ανά «απόσταση» οργιές,
   στριφτάρι ανά Χ μολύβια, έως «max» μολύβια. Προεπιλογή: Deep Fishing (Σ. Πάτσης): 12–15 m fluorocarbon, 5 οργιές κενό, μολύβι 160 g ανά 5 οργιές, στριφτάρι ανά 4. */
var RK='alkyon-rigs', PRESET={id:'deep5',name:T('Deep Fishing (5 οργιές)','Deep Fishing (5 fathoms)'),leader:13.5,blank:5,gap:5,lead:160,swivel:4,max:30,v0:3};
function rigs(){ var a=ls.get(RK,null); return Array.isArray(a)&&a.length?a:[PRESET]; }
function rigOf(c){ c=c||cfg(); var a=rigs(); return a.filter(function(r){ return r.id===c.rig; })[0]||a[0]; }
function geo(c,kn,dep){ c=c||cfg(); var r=rigOf(c), n0=nLeads(c,dep), n=Math.min(n0,+r.max||80), gap=(+r.gap||5)*FATH; if(!n) return null;
  /* πετονιά από το κοντινότερο στη βάρκα μολύβι ως το 1ο (πιο βαθύ): (n−1) αποστάσεις, + ~1 οργιά ως την κορυφή του καλαμιού */
  var L=+c.lineB||Math.max(1,n-1)*gap+FATH, v=kn!=null&&kn>0.3?kn:(+r.v0||+c.v0||3), v0=+r.v0||+c.v0||3, cos0=Math.min(0.98,Math.max(0.05,n*FATH/L)), t0=Math.sqrt(1-cos0*cos0)/cos0, th=Math.atan(t0*(v/v0)*(v/v0));
  var tail=(+r.leader||0)+(+r.blank||0)*FATH;   /* παράμαλλο + κενό: πίσω από το 1ο μολύβι */
  return {dl:L*Math.cos(th)*Math.max(0.6,Math.min(1.6,+r.kD||1)),lb:L*Math.sin(th)+tail,L:L,n:n,short:n0>n,rig:r}; }
function layback(c,kn,dep){ c=c||cfg(); var v; if(c.mode!=='bottom') v=Math.max(0,+c.line||0); else { var g=geo(c,kn,dep); v=g?g.lb:null; } return v==null?null:v*(+(c.mode==='bottom'?c.calB:c.calS)||1); }
function lureDepth(c,kn){ c=c||cfg(); if(c.mode!=='bottom') return null; var g=geo(c,kn); return g?g.dl:null; }
/* 1.6.2: ο βυθός μπροστά (κάτω από τη βάρκα, εκεί που θα περάσει το δόλωμα) πιο ρηχός από το δόλωμα: δόνηση και πόσα μολύβια να μαζέψεις */
var lastBot=0;
/* 1.6.3: αυτόματα: ο βυθός κάτω από τη βάρκα (εκεί που θα περάσει το δόλωμα) ανεβαίνει ≥ 2 οργιές σε σχέση με το δόλωμα → μάζεψε μολύβια.
   Με δικό σου αριθμό: ο βυθός μπροστά είναι πιο ρηχός από τα μολύβια + 1 οργιά. */
function bottomCheck(){ var c=cfg(); if(c.mode!=='bottom'||depth==null) return; var now=Date.now(), k=0, msg='';
  if(c.dep&&c.dep.st==='drop') return;
  if(c.dep&&c.dep.st==='set'&&depthL!=null){ var g1=geo(c,spd); if(!g1) return; var cl=clear(c); if(cl!=null&&cl<-0.5*FATH){ k=Math.max(1,Math.ceil(-cl/FATH)); msg=T('⚠ Βαράει βυθό: ~','⚠ Hitting bottom: ~')+faTxt(depthL)+T(' στο δόλωμα, η αρματωσιά ~',' at the lure, rig at ~')+faTxt(g1.dl)+T(': μάζεψε ~',': bring in ~')+k+T(k===1?' μολύβι':' μολύβια',k===1?' lead':' leads'); }
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
function dAt(lat,lon){ var gd=typeof gD==='function'&&SV&&SV.grid?gD(lat,lon):null; if(gd!=null) return Promise.resolve(gd); /* 1.8.7: από το πλέγμα γύρω σου, χωρίς αίτημα */ return B.depthAt(lat,lon).then(function(d){ if(d==null||d<=0) return d; return Math.max(1,d+corrAt(lat,lon)); }); }
/* πόσο πάνω από τον βυθό (m) είναι η αρματωσιά στο σημείο του δολώματος· αρνητικό = σέρνει/βαράει */
function clear(c){ c=c||cfg(); if(depthL==null) return null; var g=geo(c,spd,depthL); return g?depthL-g.dl:null; }
/* μολύβια ώστε η αρματωσιά να είναι ~½ οργιά πάνω από βυθό D */
function bestN(c,kn,D){ var r=rigOf(c), mx=+r.max||80, best=1; for(var n=1;n<=mx;n++){ var g=geo(Object.assign({},c,{auto:false,leads:n,dep:null}),kn); if(!g) continue; if(g.dl<=D-tgt()*FATH) best=n; else break; } return best; }
function recommend(f){ var c=cfg(), boat={lat:f.lat,lon:f.lon}, D=depth, n=bestN(c,spd,D), r=0;
  function step(){ var g=geo(Object.assign({},c,{auto:false,leads:n,dep:null}),spd); if(!g) return null; var lb=g.lb*(+c.calB||1), q=behind(boat,lb); if(!q) return null; recLb=lb;
    return dAt(q.lat,q.lon).then(function(d){ if(d==null||d<=0) return; D=d; var n2=bestN(c,spd,d); if(n2!==n&&++r<3){ n=n2; return step(); } n=n2; }); }
  return Promise.resolve(step()).catch(function(){}).then(function(){ var ch=recN!==n; recN=n; recD=D; depthL=D; if(B.say&&ch) B.say(T('Σταμάτα στα ','Stop at ')+n+T(' μολύβια',' leads'),'troll','rec'+n,60000); }); }
function startDrop(sounderFa){ var c=cfg(), f=B.trip&&B.trip.fix&&B.trip.fix()||B.lastPos(); c.mode='bottom'; c.dep={st:'drop',t:Date.now(),lat:f?f.lat:null,lon:f?f.lon:null}; recN=null; recD=null; recLb=null; stillSince=0; depthAt=0; put(c); metStart(); if(f) gridFor(f);
  if(sounderFa>0&&f&&B.depthAt){ B.depthAt(f.lat,f.lon).then(function(d){ if(d==null||d<=0) return; var off=sounderFa*FATH-d; addCorr(f.lat,f.lon,off); depthAt=0; check();
      B.toast(T('Βυθόμετρο ','Sounder ')+sounderFa+T(' οργ. · χάρτης ',' fm · chart ')+faTxt(d)+(Math.abs(off)>=FATH?T(' · διόρθωση ',' · correction ')+(off>0?'+':'')+fa(off)+T(' οργ. γύρω από εδώ',' fm around here'):T(' · συμφωνούν',' · they agree')),5000); }).catch(function(){}); }
  else check(); }
function setDown(n,why){ var c=cfg(); if(!c.dep) c.dep={}; var nn=n!=null?n:(recN!=null?recN:nLeads(c)); c.auto=false; c.leads=Math.max(1,Math.min(80,nn)); c.dep.st='set'; c.dep.set=Date.now(); if(!c.isoFix){ var bd=recD!=null?recD:depthL; if(bd) c.iso=Math.round(bd/FATH); } put(c); depthAt=0; metStop(); /* 1.8.7: η ισοβαθής που κρατάς = ο βυθός στο δόλωμα τώρα */
  try{ navigator.vibrate&&navigator.vibrate([80,60,80]); }catch(e){} if(B.say) B.say(T('Στον βυθό. ','On the bottom. ')+c.leads+T(' μολύβια',' leads'),'troll','set',5000); B.toast((why==='auto'?T('Στον βυθό (αυτόματα, 2′ σταθερή ταχύτητα): ','On the bottom (auto, 2′ steady speed): '):T('Στον βυθό: ','On the bottom: '))+c.leads+T(' μολύβια',' leads'),4000); check(); }
function dropAuto(c,now){ if(spd!=null&&spd>=c.min&&spd<=c.max){ if(!stillSince) stillSince=now; } else stillSince=0;
  if(stillSince&&now-stillSince>120000&&now-c.dep.t>120000&&recN!=null) setDown(recN,'auto'); }
function cancelDrop(){ var c=cfg(); c.dep=null; c.auto=true; recN=null; put(c); metStop(); }
/* ακούμπησε βυθό: η αρματωσιά είναι στο βάθος του βυθού στο σημείο του δολώματος → συντελεστής βάθους της αρματωσιάς */
function touched(){ var c=cfg(); if(c.mode!=='bottom'){ return; } if(depthL==null){ B.toast(T('Περιμένω βάθος για το σημείο του δολώματος…','Waiting for the depth at the lure…')); return; }
  var r=rigOf(c), g=geo(c,spd,depthL); if(!g) return; var raw=g.dl/Math.max(0.6,Math.min(1.6,+r.kD||1)), ratio=Math.max(0.75,Math.min(1.35,depthL/raw)), old=+r.kD||1, nw=+Math.max(0.6,Math.min(1.6,old*0.6+old*ratio*0.4)).toFixed(3);
  var a=rigs().slice(), i=a.map(function(x){ return x.id; }).indexOf(r.id), nr=Object.assign({},r,{kD:nw,kN:(+r.kN||0)+1}); if(i<0) a.push(nr); else a[i]=nr; ls.set(RK,a);
  c.auto=false; c.leads=Math.max(1,g.n-1); if(c.dep) c.dep.st='set'; else c.dep={st:'set',t:Date.now()}; put(c); lastBot=Date.now();
  try{ navigator.vibrate&&navigator.vibrate(30); }catch(e){}
  B.toast(T('Σημείωσα: ακούμπησε στα ~','Noted: touched at ~')+faTxt(depthL)+T(' με ',' with ')+g.n+T(' μολύβια. Η αρματωσιά «','  leads. Rig “')+r.name+T('» διορθώθηκε ×','” adjusted ×')+B.num(nw,2)+T(' · μάζεψε 1 → ',' · bring in 1 → ')+c.leads,7000); }
function dropSheet(){ var sh, inp=h('input',{type:'number',inputmode:'numeric',min:'1',max:'200',placeholder:T('π.χ. 32','e.g. 32')});
  var body=h('div',{class:'bform'},h('p',{class:'sub',text:T('Πάτα «Ξεκινώ» μόλις πέσει το πρώτο μολύβι. Όσο ρίχνεις, η εφαρμογή σου λέει σε ποιο μολύβι να σταματήσεις, από το βάθος εκεί που θα καταλήξει το δόλωμα.','Tap “Start” as the first lead goes in. While you let out, the app tells you at which lead to stop, from the depth where the lure will end up.')}),
    h('label',{class:'fld'},h('span',{text:T('Τι δείχνει το βυθόμετρο τώρα (οργιές) · προαιρετικό','Sounder now (fathoms) · optional')}),inp),
    h('p',{class:'foot',text:T('Με το βυθόμετρο διορθώνεται ο χάρτης βυθού εδώ γύρω, και κρατιέται για την επόμενη φορά.','With the sounder reading the depth chart is corrected around here, and kept for next time.')}),
    h('button',{class:'btn pri full',type:'button',text:T('Ξεκινώ να ρίχνω','Start letting out'),onclick:function(){ var v=+inp.value||0; sh&&sh.close&&sh.close(true); B.closeSheet&&B.closeSheet(); startDrop(v); }}));
  sh=B.sheet({title:T('Ρίχνω την αρματωσιά','Letting out the rig'),body:body,stack:true}); }
/* − / +: από εκεί και πέρα ο δικός σου αριθμός, μέχρι το τέλος της εξόδου (ή μέχρι να ξαναβάλεις «Αυτόματα») */
function setLeads(d){ var c=cfg(), n=nLeads(c); if(c.dep&&c.dep.st==='drop'){ recN=Math.max(1,Math.min(80,n+d)); paint(); return; } c.auto=false; c.leads=Math.max(0,Math.min(80,n+d)); put(c); try{ navigator.vibrate&&navigator.vibrate(20); }catch(e){} bottomCheck(); }
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
function adjust(rec){ if(!on()||!rec||typeof rec.lat!=='number'||rec.gear) return false; measure(); var c=cfg(), lb=layback(c,spd);
  var gg=c.mode==='bottom'?geo(c,spd):null; rec.troll={rig:gg&&gg.rig?gg.rig.name:undefined,m:c.mode,kn:spd!=null?+spd.toFixed(1):null,hd:hdg!=null?Math.round(hdg):null,leads:gg?gg.n:null,dl:gg?Math.round(gg.dl):null,line:c.mode==='bottom'?(gg?Math.round(gg.L):null):+c.line||null,auto:c.mode==='bottom'&&c.auto!==false?1:0}; if(SV.stw!=null) rec.troll.stw=+SV.stw.toFixed(1); if(gg) rec.troll.fath=+(gg.dl/FATH).toFixed(1); if(c.iso) rec.troll.iso=+c.iso; /* 1.8.7: για το «Τι δούλεψε» */
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
function trackM(){ var t=B.trip&&B.trip.track&&B.trip.track(); return t&&t.m!=null?+t.m:null; }
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
function paint(){ var c=cfg(), show=on();
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
  sur.append(h('label',{class:'fld'},h('span',{text:T('Πετονιά έξω (m), πόσο πίσω είναι το τεχνητό','Line out (m), how far back the lure is')}),ln));
  var rigId=rigOf(c).id, rigSel=h('select',{class:'select','aria-label':T('Αρματωσιά','Rig')}), rigSum=h('small',{class:'note'});
  function fillRigs(){ rigSel.replaceChildren(); rigs().forEach(function(r){ rigSel.append(h('option',{value:r.id,text:r.name})); }); rigSel.value=rigId; var r=rigs().filter(function(x){ return x.id===rigId; })[0]||rigs()[0]; rigSum.textContent=rigText(r); }
  rigSel.addEventListener('change',function(){ rigId=rigSel.value; fillRigs(); draw(); });
  var rigRow=h('div',{class:'fld'},h('span',{text:T('Αρματωσιά','Rig')}),rigSel,rigSum,h('div',{class:'chips'},
    h('button',{type:'button',class:'chip sm',text:'✎ '+T('Επεξεργασία','Edit'),onclick:function(){ rigEdit(rigs().filter(function(x){ return x.id===rigId; })[0]||rigs()[0],function(id){ if(id) rigId=id; fillRigs(); draw(); }); }}),
    h('button',{type:'button',class:'chip sm',text:'+ '+T('Νέα αρματωσιά','New rig'),onclick:function(){ rigEdit(null,function(id){ if(id) rigId=id; fillRigs(); draw(); }); }})));
  fillRigs();
  var au=h('input',{type:'checkbox',checked:c.auto!==false}), ldBox=h('div',{hidden:c.auto!==false},h('label',{class:'fld'},h('span',{text:T('Μολύβια έξω (1 μολύβι = 1 οργιά βάθος)','Leads out (1 lead = 1 fathom deep)')}),ld,leadChips));
  au.addEventListener('change',function(){ ldBox.hidden=au.checked; draw(); });
  bot.append(h('label',{class:'tg'},au,h('span',{text:T('Μολύβια αυτόματα από τον βυθό (οργιές βυθού − 1, όπως 32 οργιές → 31 μολύβια)','Leads automatically from the bottom (bottom fathoms − 1, e.g. 32 fathoms → 31 leads)')})),ldBox,
    h('small',{class:'note',text:T('Αν αλλάξεις μολύβια με − / + στον χάρτη, κρατιέται ο δικός σου αριθμός μέχρι το τέλος της εξόδου.','If you change leads with − / + on the map, your number is kept until the end of the trip.')}),
    h('p',{class:'trhint',html:T('<b>Στη θάλασσα:</b> πάτα <b>«Ρίχνω»</b> στον χάρτη μόλις πέσει το πρώτο μολύβι. Η εφαρμογή σού λέει <b>σε ποιο μολύβι να σταματήσεις</b>, μετά «Στον βυθό ✓». Αν νιώσεις τον βυθό, «Ακούμπησε»: έτσι μαθαίνει την αρματωσιά σου.','<b>At sea:</b> tap <b>“Let out”</b> on the map as the first lead goes in. The app tells you <b>at which lead to stop</b>, then “On the bottom ✓”. If you feel the bottom, “Touched”: that is how it learns your rig.')}),
    rigRow,
    h('details',{class:'tmore'},h('summary',{text:T('Όλη η πετονιά έξω, αν την ξέρεις','All line out, if you know it')}),
      h('label',{class:'fld'},h('span',{text:T('Όλη η πετονιά έξω (m)','All line out (m)')}),lb)));
  /* 1.8.7: πόσο πάνω από τον βυθό, μετρονόμος, ισοβαθής, τι δούλεψε */
  var tg=h('select',{class:'select'}); [0.5,1,1.5,2,3].forEach(function(v){ tg.append(h('option',{value:String(v),text:B.num(v,1)+T(' οργ.',' fm')})); }); tg.value=String(+c.tgt||1);
  var me=h('input',{type:'checkbox',checked:c.met!==false}), mi=num(+c.metIv||3,1.5,10,0.5), isoA=h('input',{type:'checkbox',checked:!c.isoFix}), isoN=num(c.iso||'',3,200,1); isoN.disabled=isoA.checked; isoA.addEventListener('change',function(){ isoN.disabled=isoA.checked; });
  var wk=worked(), wkTxt=wk?T('Από ','From ')+wk.n+T(' ψάρια σου στη συρτή βυθού: ',' of your bottom-trolling catches: ')+(wk.fath?T('βάθος δολώματος ','lure depth ')+Math.round(wk.fath[0])+'–'+Math.round(wk.fath[1])+T(' οργ.',' fm'):'')+(wk.leads?' · '+wk.leads[0]+'–'+wk.leads[1]+T(' μολύβια',' leads'):'')+(wk.kn?' · '+B.num(wk.kn[0],1)+'–'+B.num(wk.kn[1],1)+' kn':''):T('Μόλις γράψεις 2+ ψάρια στη συρτή βυθού, εδώ θα βλέπεις σε ποιο βάθος, με πόσα μολύβια και με τι ταχύτητα πιάνεις.','Once you log 2+ bottom-trolling catches you will see here at which depth, with how many leads and at what speed you catch.');
  bot.append(h('details',{class:'tmore',open:true},h('summary',{text:T('Πλάγια όψη και ειδοποιήσεις','Side view and alerts')}),
    h('label',{class:'fld'},h('span',{text:T('Το δόλωμα πάνω από τον βυθό','Lure above the bottom')}),tg),
    h('label',{class:'tg'},me,h('span',{text:T('Μετρονόμος όταν ρίχνω: η φωνή μετράει «ένα, δύο, τρία…», ένα μολύβι σε κάθε μέτρημα','Metronome when letting out: the voice counts “one, two, three…”, one lead per count')})),
    h('label',{class:'fld'},h('span',{text:T('Δευτερόλεπτα ανά μολύβι','Seconds per lead')}),mi),
    h('label',{class:'tg'},isoA,h('span',{text:T('Ισοβαθής αυτόματα: το βάθος όταν πατάς «Στον βυθό ✓»','Contour automatically: the depth when you tap “On the bottom ✓”')})),
    h('label',{class:'fld'},h('span',{text:T('ή σταθερή ισοβαθής (οργιές)','or a fixed contour (fathoms)')}),isoN),
    h('p',{class:'trhint',text:'📊 '+wkTxt}),
    h('button',{type:'button',class:'btn full',text:SIM?T('■ Τέλος δοκιμής','■ Stop the test'):T('▶ Δοκιμή: συρτή βυθού στο Λατσί (6 km)','▶ Test: bottom trolling at Latchi (6 km)'),onclick:function(){ sh.close(); if(SIM) simStop(false); else setTimeout(simStart,250); }}),
    h('p',{class:'trhint',text:T('Ψεύτικη βάρκα με 3 kn πάνω στον πραγματικό βυθό. Δεν γράφει έξοδο. Ό,τι ψάρι πατήσεις στη δοκιμή, σβήσ’ το μετά.','A fake boat at 3 kn over the real seabed. It does not record a trip. Delete any catch you log during the test.')})));
  var sel=(c.lures||[]).slice(), lc=h('div',{class:'chips trlures'}), L=lures();
  L.forEach(function(x){ var b=h('button',{type:'button',class:'chip sm','aria-pressed':String(sel.indexOf(x.id)>=0),text:x.name||'?',onclick:function(){ var i=sel.indexOf(x.id); if(i<0) sel.push(x.id); else sel.splice(i,1); b.setAttribute('aria-pressed',String(i<0)); }}); lc.append(b); });
  function cur(){ return {calS:c.calS,calB:c.calB,on:true,mode:mode,min:+mn.value||DEF.min,max:+mx.value||DEF.max,line:+ln.value||DEF.line,auto:au.checked,leads:ld.value===''?DEF.leads:+ld.value,rig:rigId,lineB:+lb.value||null,lures:sel,dep:c.on?c.dep:null,tgt:+tg.value||1,met:me.checked,metIv:+mi.value||3,isoFix:!isoA.checked,iso:!isoA.checked?(+isoN.value||null):c.iso}; }
  function draw(){ sur.hidden=mode!=='surface'; bot.hidden=mode!=='bottom'; var q=cur(), v=(q.min+q.max)/2, l=layback(q,v);
    if(mode==='bottom'){ var ex=q.auto?25*FATH:null, g=geo(q,v,ex), g2=geo(q,v+0.5,ex), lq=g?g.lb*(+q.calB||1):null;
      est.textContent=g?(q.auto?T('Παράδειγμα: βυθός 25 οργιές → ','Example: bottom 25 fathoms → ')+g.n+T(' μολύβια. ',' leads. '):'')+T('Στα ','At ')+B.num(v,1)+T(' kn το δόλωμα είναι ~',' kn the lure is ~')+faTxt(g.dl)+T(' βάθος και ~',' deep and ~')+Math.round(lq)+T(' m πίσω από τη βάρκα.',' m behind the boat.')+(g2?T(' Στα ',' At ')+B.num(v+0.5,1)+T(' kn ανεβαίνει στις ~',' kn it rises to ~')+faTxt(g2.dl):'')+(g.short?T(' (Όλα τα ',' (All ')+g.n+T(' μολύβια· ο βυθός είναι πιο βαθύς.)',' leads; the bottom is deeper.)'):''):T('Βάλε πόσα μολύβια έχεις έξω.','Enter how many leads are out.'); return; }
    est.textContent=l!=null?T('Με ','At ')+B.num(v,1)+T(' kn το δόλωμα είναι ~',' kn the lure is ~')+Math.round(l)+T(' m πίσω από τη βάρκα',' m behind the boat')+T('. Τα ψάρια μπαίνουν εκεί, πάνω στη διαδρομή σου.','. Catches are placed there, on your track.'):''; }
  [mn,mx,ln,ld,lb].forEach(function(i){ i.addEventListener('input',draw); });
  var go=h('button',{class:'btn pri full',type:'button',text:c.on?T('Αποθήκευση','Save'):'▶ '+T('Έναρξη συρτής','Start trolling'),onclick:function(){ var q=cur(); if(q.min>=q.max){ B.toast(T('Η ελάχιστη ταχύτητα πρέπει να είναι μικρότερη από τη μέγιστη.','Minimum speed must be below maximum.')); return; }
    if(!tripOn()){ sh.close(); put(q); B.toast(T('Ξεκίνα πρώτα έξοδο: η συρτή δουλεύει μέσα στην έξοδο.','Start a trip first: trolling works within a trip.')); if(B.tripStart) B.tripStart(); return; }
    outSince=0; put(q); sh.close(); check(); B.toast(T('Συρτή: ','Trolling: ')+techName(q)+' · '+q.min+'–'+q.max+' kn'); }});
  var stop=c.on?h('button',{class:'btn full',type:'button',text:T('Τέλος συρτής','Stop trolling'),onclick:function(){ var q=cfg(); q.on=false; put(q); sh.close(); }}):null;
  sh=B.sheet({title:T('Συρτή','Trolling'),body:h('div',{class:'bform trsheet'},h('div',{class:'fld'},h('span',{text:T('Είδος','Type')}),mc),
    h('div',{class:'cprow'},h('label',{class:'fld'},h('span',{text:T('Ταχύτητα από (kn)','Speed from (kn)')}),mn),h('label',{class:'fld'},h('span',{text:T('έως (kn)','to (kn)')}),mx)),
    sur,bot,h('div',{class:'fld'},h('span',{text:T('Τεχνητά στο νερό','Lures in the water')}),L.length?lc:h('small',{text:T('Πρόσθεσε τεχνητά στον Εξοπλισμό για να τα διαλέγεις εδώ.','Add lures in Tackle to pick them here.')})),
    est,go,stop,c.on?h('button',{class:'btn full',type:'button',text:'📈 '+T('Προφίλ βυθού και δολώματος','Seabed and lure profile'),onclick:function(){ sh.close(); B.trollProfile(null); }}):null,h('p',{class:'foot',text:T('Δονείται αν μείνεις έξω από την ταχύτητα για 20″. Στον βυθό δονείται και όταν ο χάρτης βαθών (EMODnet) δείχνει βυθό πιο ρηχό από το δόλωμα. Η θέση και το βάθος του δολώματος είναι εκτίμηση.','Vibrates if you stay outside the speed range for 20 s. On the bottom it also vibrates when the depth chart (EMODnet) shows the bottom shallower than the lure. Lure position and depth are estimates.')}))});
  draw(); }
function rigText(r){ var n=+r.max||0, kg=n*(+r.lead||0)/1000, sw=r.swivel?Math.floor(n/r.swivel):0, ln=Math.max(0,n-1)*(+r.gap||0)*FATH;
  return n+' × '+(r.lead||'?')+' g = '+B.num(kg,1)+' kg · '+T('μολύβι ανά ','a lead every ')+r.gap+T(' οργ.',' fm')+(sw?T(' · στριφτάρια: ',' · swivels: ')+sw:'')+' · '+T('πετονιά με μολύβια ~','leaded line ~')+Math.round(ln)+' m · '+T('δόλωμα ~','lure ~')+Math.round((+r.leader||0)+(+r.blank||0)*FATH)+T(' m πίσω από το 1ο μολύβι',' m behind the first lead'); }
function rigEdit(r,done){ var isNew=!r; r=Object.assign({},r||{id:'rig'+Date.now().toString(36),name:'',leader:13.5,blank:5,gap:5,lead:160,swivel:4,max:30,v0:3}); var sh;
  var f=function(k,lab,min,max,step,hint){ var i=h('input',{type:'number',inputmode:'decimal',min:String(min),max:String(max),step:String(step),value:r[k]!=null?String(r[k]):''}); i.addEventListener('input',function(){ r[k]=i.value===''?null:+i.value; sum.textContent=rigText(r); }); return h('label',{class:'fld'},h('span',{text:lab}),i,hint?h('small',{text:hint}):null); };
  var nm=h('input',{type:'text',maxlength:'40',value:r.name||'',placeholder:T('π.χ. Βαθιά 160 g','e.g. Deep 160 g')}); nm.addEventListener('input',function(){ r.name=nm.value; });
  var sum=h('p',{class:'trest',text:rigText(r)});
  var save=h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ if(!r.gap||!r.max){ B.toast(T('Βάλε απόσταση μολυβιών και πόσα μολύβια.','Enter lead spacing and how many leads.')); return; }
    r.name=(r.name||'').trim()||(r.max+' × '+(r.lead||'?')+' g / '+r.gap+T(' οργ.',' fm')); var a=rigs().filter(function(x){ return x.id!==r.id; }); a.push(r); ls.set(RK,a); sh.close(); done&&done(r.id); }});
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
    sum,save,del)}); }
B.rigsSheet=function(){ rigEdit(rigOf(),null); };

/* ================= 1.8.7: πλάγια όψη, μετρονόμος, «πότε να μαζέψω/αφήσω», ταχύτητα στο νερό, στροφές, ισοβαθής =================
   Πλέγμα βάθους EMODnet (~115 m) γύρω από τη βάρκα (AlkyonDense.area) + οι δικές σου διορθώσεις (alkyon-dcorr).
   Το δόλωμα ακολουθεί τη διαδρομή της βάρκας lb μέτρα πίσω: ο βυθός που περνάς ΤΩΡΑ είναι ο βυθός του δολώματος σε lb/v δευτερόλεπτα. */
var SV={grid:null,at:0,prof:null,adv:null,iso:null,stw:null,cur:null,turn:0,hh:[],lastAdv:'',lastAdvT:0,gridErr:0};
function tgt(){ var c=cfg(); return Math.max(0.5,Math.min(4,+c.tgt||1)); }   /* οργιές πάνω από τον βυθό (προεπιλογή 1) */
function gD(lat,lon){ var A=window.AlkyonDense; if(!SV.grid||!A||!A.at) return null; var d=A.at(SV.grid,lat,lon); if(d==null||d<=0) return null; return Math.max(1,d+corrAt(lat,lon)); }
function gridFor(f){ var A=window.AlkyonDense; if(!A||!A.area||!f) return; if(Date.now()-SV.gridErr<60000) return;
  A.area(f.lat,f.lon,2600).then(function(g){ SV.grid=g; }).catch(function(){ SV.gridErr=Date.now(); }); }
/* ταχύτητα στο νερό: διανυσματικά, ταχύτητα GPS − ρεύμα (το ρεύμα από τον χάρτη ρευμάτων, όταν είναι ανοιχτός) */
function stwOf(f){ SV.cur=null; if(spd==null||hdg==null||!B.curNear||!f) return null; var cu=B.curNear(f.lat,f.lon); if(!cu||!(cu.kn>=0)) return null; SV.cur=cu;
  var r=Math.PI/180, gx=spd*Math.sin(hdg*r), gy=spd*Math.cos(hdg*r), cx=cu.kn*Math.sin(cu.dir*r), cy=cu.kn*Math.cos(cu.dir*r); return Math.sqrt((gx-cx)*(gx-cx)+(gy-cy)*(gy-cy)); }
function vEff(){ return SV.stw!=null?SV.stw:spd; }
/* στροφές: αλλαγή πορείας > 25° μέσα σε 12″ */
function turnCheck(){ var now=Date.now(); if(hdg==null) return; SV.hh.push([now,hdg]); SV.hh=SV.hh.filter(function(q){ return now-q[0]<12000; }); if(SV.hh.length<2) return;
  var d=Math.abs(((SV.hh[SV.hh.length-1][1]-SV.hh[0][1])+540)%360-180); SV.turn=d; var c=cfg();
  if(d>25&&c.mode==='bottom'&&c.dep&&c.dep.st==='set'&&now-(SV.turnT||0)>60000){ SV.turnT=now; if(B.say) B.say(T('Στροφή. Το δόλωμα κατεβαίνει','Turning. The lure is sinking'),'troll','turn',60000); try{ navigator.vibrate&&navigator.vibrate([120,80,120]); }catch(e){} } }
/* μολύβια ώστε το δόλωμα να είναι tgt οργιές πάνω από βυθό D (στην ταχύτητα v) */
function needN(c,v,D){ var r=rigOf(c), mx=+r.max||80, best=1; for(var n=1;n<=mx;n++){ var g=geo(Object.assign({},c,{auto:false,leads:n,dep:null}),v); if(!g) continue; if(g.dl<=D-tgt()*FATH) best=n; else break; } return best; }
/* το μονοπάτι του δολώματος: από εκεί που είναι τώρα (lb πίσω στη διαδρομή) → βάρκα → μπροστά (πορεία) */
function lurePath(f,lb){ var out=[], step=15; if(!f||lb==null) return out;
  for(var m=Math.round(lb/step)*step;m>0;m-=step){ var q=behind({lat:f.lat,lon:f.lon},m); if(q) out.push({x:-m,lat:q.lat,lon:q.lon}); }
  out.push({x:0,lat:f.lat,lon:f.lon});
  if(hdg!=null) for(var a=step;a<=300;a+=step){ var p=dest(f.lat,f.lon,hdg,a); out.push({x:a,lat:p[0],lon:p[1]}); }
  out.forEach(function(q){ q.d=gD(q.lat,q.lon); }); return out; }
var PULL=5, SETTLE=15;   /* ″ ανά μολύβι όταν μαζεύεις/αφήνεις · ″ μέχρι να «κάτσει» η πετονιά */
function advise(c,f){ SV.adv=null; if(c.mode!=='bottom'||!c.dep||c.dep.st!=='set'||!f) return; var v=vEff();
  if(v==null||v<0.8){ var vr=+rigOf(c).v0||+c.v0||3, gw=geo(c,vr); SV.prof=gw?{P:lurePath(f,gw.lb*(+c.calB||1)),lb:gw.lb,dl:gw.dl,n:nLeads(c),v:vr,pre:1}:null; SV.adv={act:'wait'}; return; } /* 1.8.8: χωρίς ταχύτητα: διάγραμμα με την ταχύτητα της αρματωσιάς, χωρίς συμβουλές */
  var n=nLeads(c), g=geo(c,v); if(!g) return; var lb=g.lb*(+c.calB||1), P=lurePath(f,lb); SV.prof={P:P,lb:lb,dl:g.dl,n:n,v:v}; if(!P.length) return;
  if(spd!=null&&(spd>c.max||spd<c.min)){ SV.adv={act:'spd',hi:spd>c.max}; return; } /* 1.8.8: πρώτα η ταχύτητα· τα μολύβια μετά, όταν μπεις στα όρια */
  var vms=v*0.514, lureX=-lb, worst=null, deeper=null;
  P.forEach(function(q){ if(q.d==null||q.x<lureX-1) return; var s=q.x-lureX, tReach=s/vms, need=needN(c,v,q.d);
    if(need<n&&(!worst||need<worst.need||(need===worst.need&&tReach<worst.t))){ if(tReach<=150) worst={need:need,t:tReach,d:q.d,x:q.x}; }
    if(s<40&&need>n+1) deeper={need:need,d:q.d}; });
  if(worst){ var k=n-worst.need, lead=k*PULL+SETTLE, tStart=Math.round(worst.t-lead); SV.adv={k:k,act:'up',t:Math.max(0,tStart),d:worst.d}; }
  else if(deeper){ SV.adv={k:deeper.need-n,act:'down',t:0,d:deeper.d}; }
  else SV.adv={act:'ok'};
  var a=SV.adv, key=a.act+(a.k||'')+(a.t<=0?'now':''), now=Date.now();
  if(a.act==='up'&&a.t<=0&&(key!==SV.lastAdv||now-SV.lastAdvT>45000)){ SV.lastAdv=key; SV.lastAdvT=now; if(B.say) B.say(T('Μάζεψε ','Bring in ')+a.k+T(' τώρα',' now'),'troll','adv',0); try{ navigator.vibrate&&navigator.vibrate([400,150,400]); }catch(e){} }
  else if(a.act==='up'&&a.t>0&&a.t<=45&&key!==SV.lastAdv){ SV.lastAdv=key; SV.lastAdvT=now; if(B.say) B.say(T('Ο βυθός ανεβαίνει. Μάζεψε ','Bottom rising. Bring in ')+a.k+T(' σε ',' in ')+Math.round(a.t/5)*5+T(' δευτερόλεπτα',' seconds'),'troll','adv',0); }
  else if(a.act==='down'&&(key!==SV.lastAdv||now-SV.lastAdvT>90000)){ SV.lastAdv=key; SV.lastAdvT=now; if(B.say) B.say(T('Βαθαίνει. Άφησε ','Getting deeper. Let out ')+a.k,'troll','adv',0); } }
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
function svgSide(){ var p=SV.prof, c=cfg(), W=360,H=150, x0=6,x1=W-26, y0=18, y1=H-14; if(!p||!p.P.length) return '';
  var xs=p.P.map(function(q){ return q.x; }), xmin=Math.min.apply(null,xs), xmax=Math.max.apply(null,xs), ds=p.P.filter(function(q){ return q.d!=null; }).map(function(q){ return q.d; });
  if(!ds.length) return ''; var zmax=Math.max(Math.max.apply(null,ds),p.dl)*1.1+2, X=function(x){ return x0+(x1-x0)*(x-xmin)/Math.max(1,xmax-xmin); }, Y=function(z){ return y0+(y1-y0)*z/zmax; };
  var g='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="'+T('Πλάγια όψη: βυθός, πετονιά και δόλωμα','Side view: bottom, line and lure')+'"><defs><linearGradient id="trw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe9f7"/><stop offset="1" stop-color="#3f84b5"/></linearGradient></defs>';
  g+='<rect x="'+x0+'" y="'+y0+'" width="'+(x1-x0)+'" height="'+(y1-y0)+'" rx="8" fill="url(#trw)"/>';
  var path='M'+X(xmin).toFixed(1)+','+y1, tl='';
  p.P.forEach(function(q){ if(q.d==null) return; path+=' L'+X(q.x).toFixed(1)+','+Y(q.d).toFixed(1); tl+=(tl?' L':'M')+X(q.x).toFixed(1)+','+Y(Math.max(0,q.d-tgt()*FATH)).toFixed(1); });
  path+=' L'+X(xmax).toFixed(1)+','+y1+' Z'; g+='<path d="'+path+'" fill="#7a6a55"/>';
  if(tl) g+='<path d="'+tl+'" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>';
  g+='<rect x="'+X(0).toFixed(1)+'" y="'+y0+'" width="'+(x1-X(0)).toFixed(1)+'" height="'+(y1-y0)+'" fill="#fff" opacity=".10"/>';
  /* πετονιά: καμπύλη από τη βάρκα ως το δόλωμα, με τα μολύβια */
  var bx=X(0), by=Y(0), lx=X(-p.lb), ly=Y(p.dl), cx=X(-p.lb*0.25), cy=Y(p.dl*0.75);
  g+='<path d="M'+bx.toFixed(1)+','+by.toFixed(1)+' Q'+cx.toFixed(1)+','+cy.toFixed(1)+' '+lx.toFixed(1)+','+ly.toFixed(1)+'" stroke="#0b1f2a" stroke-width="1.6" fill="none"/>';
  var nl=Math.min(p.n,12); for(var i=1;i<=nl;i++){ var t=i/(nl+1.5), qx=(1-t)*(1-t)*bx+2*(1-t)*t*cx+t*t*lx, qy=(1-t)*(1-t)*by+2*(1-t)*t*cy+t*t*ly; g+='<circle cx="'+qx.toFixed(1)+'" cy="'+qy.toFixed(1)+'" r="2.2" fill="#0b1f2a"/>'; }
  g+='<path d="M'+(bx-11)+','+(y0-1)+' L'+(bx+11)+','+(y0-1)+' L'+(bx+7)+','+(y0+5)+' L'+(bx-7)+','+(y0+5)+' Z" fill="#e8743b"/>';
  g+='<circle cx="'+lx.toFixed(1)+'" cy="'+ly.toFixed(1)+'" r="5" fill="#ffd23f" stroke="#0b1f2a" stroke-width="1.5"/>';
  var a=SV.adv; if(a&&a.act==='up'&&a.d!=null){ var hit=p.P.filter(function(q){ return q.d!=null&&Math.abs(q.d-a.d)<0.01; })[0]; if(hit) g+='<circle cx="'+X(hit.x).toFixed(1)+'" cy="'+Y(hit.d).toFixed(1)+'" r="7" fill="none" stroke="#ff7a3d" stroke-width="2.5"/>'; }
  for(var z=0;z<=zmax;z+=(zmax>60?20:10)) g+='<text x="'+(W-2)+'" y="'+(Y(z)+3).toFixed(1)+'" font-size="9" text-anchor="end" fill="currentColor" opacity=".6">'+Math.round(z/FATH)+'</text>';
  g+='<text x="'+(W-2)+'" y="10" font-size="8.5" text-anchor="end" fill="currentColor" opacity=".6">'+T('οργ.','fm')+'</text>';
  g+='<text x="'+(X(xmin)+4).toFixed(1)+'" y="'+(y1-4)+'" font-size="9" fill="#fff">'+Math.round(xmin)+' m</text><text x="'+(X(xmax)-4).toFixed(1)+'" y="'+(y1-4)+'" font-size="9" text-anchor="end" fill="#fff">+'+Math.round(xmax)+' m</text></svg>';
  return g; }
/* 1.8.8: ΔΟΚΙΜΗ (simulation) συρτής βυθού: ψεύτικη βάρκα 6 km στο Λατσί με 3 kn, πάνω στον πραγματικό βυθό (EMODnet από το κινητό).
   Δεν γράφει έξοδο· αλλάζει προσωρινά μόνο τη θέση/πορεία που βλέπει η συρτή. */
var SIM=null;
var SIM_WP=[[35.058,32.392],[35.068,32.376],[35.064,32.360],[35.074,32.350],[35.080,32.338]];
function simOn(){ return !!SIM; }
function simStart(){ if(SIM) return; if(tripOn()){ B.toast(T('Η δοκιμή γίνεται μόνο όταν δεν είσαι σε έξοδο.','The test runs only when you are not on a trip.')); return; }
  var wp=SIM_WP.map(function(q){ var a=q.slice(), k=0; while(k<6&&B.landExact&&B.landExact(a[0],a[1])){ a[0]+=0.004; k++; } return a; });
  var L=[0]; for(var i=1;i<wp.length;i++) L.push(L[i-1]+dist(wp[i-1],wp[i]));
  SIM={wp:wp,L:L,tot:L[L.length-1],s:0,kn:3,warp:1,trk:[],old:{a:B.trip.active,f:B.trip.fix,t:B.trip.track},cfg:JSON.stringify(cfg()),fix:null,mk:null,ln:null,iv:0,id:'sim-'+Date.now()};
  var c=cfg(); c.on=true; c.mode='bottom'; c.dep=null; c.auto=true; if(c.min>=3||c.max<=3){ c.min=2.5; c.max=3.5; } put(c);
  simPos(); B.trip.active=function(){ return true; }; B.trip.fix=function(){ return SIM&&SIM.fix; }; B.trip.track=function(){ return SIM?{id:SIM.id,pts:SIM.trk}:null; };
  document.body.classList.add('ontrip','trsim'); SV.grid=null; SV.at=0;
  B.mapGo(wp[0][0],wp[0][1],14); SIM.iv=setInterval(simTick,1000); setTimeout(function(){ sideTick(); },800);
  if(B.say) B.say(T('Δοκιμή συρτής βυθού στο Λατσί. Πάτα Ρίχνω.','Bottom trolling test at Latchi. Tap Let out.'),null,'sim',0);
  B.toast(T('▶ Δοκιμή: η βάρκα κινείται 6 km με 3 kn. Πάτα «Ρίχνω» για να δεις όλη τη διαδικασία.','▶ Test: the boat moves 6 km at 3 kn. Tap “Let out” to see the whole process.'),7000); }
function simPos(){ var S=SIM, s=Math.min(S.s,S.tot-0.1), i=1; while(i<S.L.length-1&&S.L[i]<s) i++; var a=S.wp[i-1], b=S.wp[i], f=(s-S.L[i-1])/Math.max(1,S.L[i]-S.L[i-1]), hd=brg(a,b);
  var la=a[0]+(b[0]-a[0])*f, lo=a[1]+(b[1]-a[1])*f, now=Date.now(); S.fix={lat:la,lon:lo,t:now,spd:S.kn*0.51444,hd:hd,acc:4,sim:1};
  var lp=S.trk[S.trk.length-1]; if(!lp||dist([lp[0],lp[1]],[la,lo])>=6) S.trk.push([la,lo,now]); if(S.trk.length>3000) S.trk.shift();
  var Lf=window.L, m=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); if(Lf&&m){ try{
    if(!S.ln||!m.hasLayer(S.ln)) S.ln=Lf.polyline(S.wp,{color:'#ffd23f',weight:2,dashArray:'4 6',opacity:.8,interactive:false}).addTo(m);
    if(!S.mk||!m.hasLayer(S.mk)) S.mk=Lf.circleMarker([la,lo],{radius:9,color:'#fff',weight:3,fillColor:'#d84315',fillOpacity:1,interactive:false}).addTo(m); else S.mk.setLatLng([la,lo]);
    if(!S.pan||now-S.pan>4000){ S.pan=now; m.panTo([la,lo],{animate:true}); } }catch(e){} } }
function simTick(){ var S=SIM; if(!S) return; S.s+=S.kn*0.51444*S.warp; simPos(); if(S.s>=S.tot){ simStop(true); } }
function simWarp(){ if(!SIM) return; SIM.warp=SIM.warp===1?4:1; B.toast(SIM.warp>1?T('⏩ ×4 πιο γρήγορα (οι χρόνοι «σε N″» είναι για κανονική ταχύτητα)','⏩ ×4 faster (the “in N″” times are for real speed)'):T('▶ Κανονική ταχύτητα','▶ Normal speed'),5000); paintSide(); }
function simStop(done){ var S=SIM; if(!S) return; clearInterval(S.iv); metStop(); B.trip.active=S.old.a; B.trip.fix=S.old.f; B.trip.track=S.old.t;
  var m=window.AlkyonCore&&AlkyonCore.map&&AlkyonCore.map(); try{ if(m){ if(S.mk) m.removeLayer(S.mk); if(S.ln) m.removeLayer(S.ln); } }catch(e){}
  try{ localStorage.setItem(K,S.cfg); }catch(e){} SIM=null; SV.prof=null; SV.adv=null; spd=null; hdg=null; document.body.classList.remove('trsim'); if(!tripOn()) document.body.classList.remove('ontrip');
  paintSide(); lureMark(); B.toast(done?T('■ Τέλος δοκιμής: 6 km.','■ Test finished: 6 km.'):T('■ Η δοκιμή σταμάτησε.','■ Test stopped.'),5000); }
function micB(){ var V=B.voiceCmd; if(!V||!V.ok) return null; var on=V.wanted(); return h('button',{type:'button',class:'btn sm '+(on?'pri':'ghost'),text:on?'🎤 ON':'🎤',title:T('Φωνή: «ψάρι» / «τσίμπησε» γράφει αμέσως','Voice: “fish” / “bite” logs at once'),onclick:function(){ V.set(!V.wanted()); B.toast(V.wanted()?T('🎤 Ακούω: πες «ψάρι» ή «τσίμπησε»','🎤 Listening: say “fish” or “bite”'):T('🎤 Κλειστό','🎤 Off'),4000); paintSide(); }}); }
function paintSide(){ var c=cfg(), show=on()&&c.mode==='bottom'&&document.body.classList.contains('mapon'); /* 1.8.8: και στον κλασικό χάρτη */
  if(!show){ if(side) side.hidden=true; document.body.classList.remove('trside-on'); return; }
  if(!side){ side=h('div',{class:'trside',role:'status','aria-live':'polite'}); document.body.append(side); } side.hidden=false; document.body.classList.add('trside-on');
  var dst=c.dep?c.dep.st:null, v=vEff(), kids=[];
  kids.push(h('div',{class:'tsh'},h('b',{text:T('ΣΥΡΤΗ ΒΥΘΟΥ','BOTTOM TROLLING')+(dst==='drop'?T(' · ΡΙΧΝΩ',' · LETTING OUT'):'')}),
    h('span',{class:'tsk'+(spd!=null&&spd>c.max?' hi':spd!=null&&spd<c.min?' lo':''),text:(spd!=null?B.num(spd,1)+' kn':'– kn')+(SV.stw!=null?T(' · στο νερό ',' · through water ')+B.num(SV.stw,1):'')})));
  /* 1.8.8: ταχύτητα εκτός ορίων φαίνεται και στην κάρτα (όχι μόνο φωνή/δόνηση/μήνυμα) */
  if(spd!=null&&(spd>c.max||spd<c.min)) kids.push(h('div',{class:'tsspd '+(spd>c.max?'hi':'lo'),text:(spd>c.max?T('⚠ Πολύ γρήγορα · όριο ','⚠ Too fast · limit '):T('⚠ Πολύ αργά · όριο ','⚠ Too slow · limit '))+B.num(c.min,1)+'–'+B.num(c.max,1)+' kn'}));
  if(dst==='drop'){ if(SV.prof&&MET.n) kids.push(h('div',{class:'tsv',html:svgSide()})); var gd=MET.n?geo(Object.assign({},c,{auto:false,leads:MET.n,dep:null}),v):null;
    kids.push(h('div',{class:'tsg'},cellS(T('ΕΞΩ','OUT'),String(MET.n),T('μολύβια','leads')),cellS(T('ΔΟΛΩΜΑ','LURE'),gd?'~'+fa(gd.dl):'–',T('οργ.','fm')),cellS(T('ΣΤΑΜΑΤΑ ΣΤΑ','STOP AT'),recN!=null?String(recN):'…','',recD!=null?T('βυθός εκεί ','bottom there ')+faTxt(recD):'')));
    kids.push(h('div',{class:'tsm'},h('button',{type:'button',class:'btn sm',text:MET.paused?'▶':'⏸',onclick:function(){ MET.paused=!MET.paused; if(!MET.tm&&!MET.paused) metStart(); paintSide(); }}),
      h('button',{type:'button',class:'btn sm ghost',text:T('πιο αργά','slower'),onclick:function(){ metPace(0.5); }}),h('span',{text:'⏱ '+B.num(metIv(),1)+'″/'+T('μολύβι','lead')}),h('button',{type:'button',class:'btn sm ghost',text:T('πιο γρήγορα','faster'),onclick:function(){ metPace(-0.5); }})));
    kids.push(h('div',{class:'tsb'},h('button',{type:'button',class:'btn sm ghost',text:'−',onclick:function(){ setLeads(-1); paintSide(); }}),h('button',{type:'button',class:'btn sm ghost',text:'+',onclick:function(){ setLeads(1); paintSide(); }}),h('button',{type:'button',class:'btn pri sm',text:T('Στον βυθό ✓','On the bottom ✓'),onclick:function(){ setDown(recN!=null?recN:MET.n||null); }}),h('button',{type:'button',class:'btn ghost sm',text:T('Άκυρο','Cancel'),onclick:cancelDrop})));
  } else if(dst==='set'){ var p=SV.prof, a=SV.adv, n=nLeads(c);
    var sv=p?svgSide():''; if(sv) kids.push(h('div',{class:'tsv',html:sv})); else kids.push(h('p',{class:'tsn',text:!SV.grid?T('Φορτώνω τον βυθό γύρω σου… (στη στεριά δεν υπάρχει βυθός)','Loading the depth around you… (no seabed on land)'):T('Δεν βρίσκω βυθό εδώ: είσαι στη στεριά ή πολύ κοντά στην ακτή.','No seabed here: you are on land or very close to shore.')}));
    if(p&&p.pre&&sv) kids.push(h('p',{class:'tsn',text:T('Χωρίς ταχύτητα (GPS): το διάγραμμα δείχνει την αρματωσιά στα ','No speed (GPS): the diagram shows the rig at ')+B.num(p.v,1)+T(' kn. Ζωντανά μόλις κινηθείς πάνω από 0,8 kn.',' kn. Live once you move above 0.8 kn.')}));
    var nxt=a&&a.act==='wait'?cellS(T('ΜΠΡΟΣΤΑ','AHEAD'),'–','',T('περιμένω ταχύτητα','waiting for speed')):!a?cellS(T('ΜΠΡΟΣΤΑ','AHEAD'),'–','',T('περιμένω βυθό','waiting for depth')):a.act==='spd'?cellS(T('ΠΡΩΤΑ','FIRST'),a.hi?'↓ kn':'↑ kn','',a.hi?T('κατέβασε ταχύτητα','slow down'):T('ανέβασε ταχύτητα','speed up'),'warn'):a&&a.act==='up'?cellS(a.t<=0?T('ΤΩΡΑ','NOW'):T('ΣΕ ','IN ')+a.t+'″','↑ −'+a.k,T('μολύβια','leads'),'','warn'):a&&a.act==='down'?cellS(T('ΒΑΘΑΙΝΕΙ','DEEPER'),'↓ +'+a.k,T('μολύβια','leads'),'','deep'):cellS(T('ΜΠΡΟΣΤΑ','AHEAD'),'✓','',T('κράτα','hold'),'ok');
    kids.push(h('div',{class:'tsg'},cellS(T('ΜΟΛΥΒΙΑ','LEADS'),String(n),''),cellS(T('ΔΟΛΩΜΑ','LURE'),p?'~'+fa(p.dl):'–',T('οργ.','fm'),p&&p.P.length?(function(){ var q=p.P[0]; return q&&q.d!=null?T('βυθός ','bottom ')+faTxt(q.d):''; })():''),nxt));
    var iso=SV.iso; if(iso) kids.push(h('div',{class:'tsiso'},h('span',{text:T('Ισοβαθής ','Contour ')+iso.iso+T(' οργ. · τώρα ~',' fm · now ~')+Math.round(iso.now)}),h('b',{text:iso.side==='L'?T('↰ λίγο αριστερά','↰ a little left'):iso.side==='R'?T('λίγο δεξιά ↱','a little right ↱'):T('πάνω της ✓','on it ✓')})));
    kids.push(h('div',{class:'tsb'},h('button',{type:'button',class:'btn sm ghost',text:'− 1',onclick:function(){ setLeads(-1); sideTick(); }}),h('button',{type:'button',class:'btn sm ghost',text:'+ 1',onclick:function(){ setLeads(1); sideTick(); }}),h('button',{type:'button',class:'btn sm',text:T('Ακούμπησε','Touched'),onclick:function(){ touched(); sideTick(); }}),micB(),h('button',{type:'button',class:'btn ghost sm',text:'⚙',title:T('Ρυθμίσεις συρτής','Trolling settings'),onclick:sheet})));
    if(SV.turn>25) kids.push(h('p',{class:'tsn warn',text:T('Στροφή: το δόλωμα κατεβαίνει','Turning: the lure is sinking')}));
  } else { if(SV.prof&&SV.prof.pre) kids.push(h('div',{class:'tsv',html:svgSide()}),h('p',{class:'tsn',text:T('Προεπισκόπηση με ','Preview with ')+SV.prof.n+T(' μολύβια. Ζωντανά μόλις ρίξεις.',' leads. Live once you let out.')})); else kids.push(h('p',{class:'tsn',text:T('Το διάγραμμα βγαίνει όταν κινείσαι (πάνω από 0,8 kn) και φορτώσει ο βυθός.','The diagram shows once you are moving (above 0.8 kn) and the depth chart loads.')}));
    kids.push(h('div',{class:'tsb'},h('p',{class:'tsn',text:T('Πάτα «Ρίχνω» μόλις πέσει το πρώτο μολύβι.','Tap “Let out” as the first lead goes in.')}),h('button',{type:'button',class:'btn pri sm',text:T('Ρίχνω','Let out'),onclick:dropSheet}),micB(),h('button',{type:'button',class:'btn ghost sm',text:'⚙',onclick:sheet}))); }
  if(SIM) kids.unshift(h('div',{class:'tssim'},h('b',{text:T('ΔΟΚΙΜΗ · ','TEST · ')+B.num(SIM.s/1000,1)+' / '+B.num(SIM.tot/1000,1)+' km'}),h('button',{type:'button',class:'btn sm ghost',text:SIM.warp>1?'×4':'×1',onclick:simWarp}),h('button',{type:'button',class:'btn sm ghost',text:T('■ Τέλος','■ Stop'),onclick:function(){ simStop(false); }})));
  side.replaceChildren.apply(side,kids); }
function cellS(lab,big,unit,sub,cls){ return h('div',{class:'tsc'+(cls?' '+cls:'')},h('small',{text:lab}),h('b',null,big,unit?h('em',{text:' '+unit}):null),sub?h('i',{text:sub}):null); }
/* σημάδι «δόλωμα» στον χάρτη, πάνω στη διαδρομή πίσω σου */
var lureMk=null;
function lureMark(){ var L=window.L, C=window.AlkyonCore, m=C&&C.map&&C.map(); if(!L||!m) return; var p=SV.prof, c=cfg(), q=p&&p.P&&p.P[0];
  if(!on()||c.mode!=='bottom'||!q||!c.dep){ if(lureMk){ try{ m.removeLayer(lureMk); }catch(e){} lureMk=null; } return; }
  if(!lureMk) lureMk=L.circleMarker([q.lat,q.lon],{radius:7,color:'#0b1f2a',weight:2,fillColor:'#ffd23f',fillOpacity:1,interactive:false}).addTo(m); else lureMk.setLatLng([q.lat,q.lon]); }
function sideTick(){ if(!on()){ paintSide(); return; } var c=cfg(), f=B.trip&&B.trip.fix&&B.trip.fix(); if(!f){ paintSide(); return; }
  measure(); gridFor(f); SV.stw=stwOf(f); turnCheck(); advise(c,f); isoGuide(c,f); if(c.dep&&c.dep.st==='drop'&&f){ var gl=geo(Object.assign({},c,{auto:false,leads:Math.max(1,MET.n),dep:null}),vEff()); if(gl){ var lp=lurePath(f,gl.lb*(+c.calB||1)); SV.prof={P:lp,lb:gl.lb,dl:gl.dl,n:MET.n,v:vEff()}; } } if(!c.dep&&c.mode==='bottom'){ var v0=vEff(), gi=v0!=null&&v0>=0.8?geo(c,v0):null; SV.prof=gi?{P:lurePath(f,gi.lb*(+c.calB||1)),lb:gi.lb,dl:gi.dl,n:gi.n,v:v0,pre:1}:null; } /* 1.8.8: προεπισκόπηση πριν ρίξεις */
  paintSide(); lureMark(); }
/* «Τι δούλεψε» στη συρτή βυθού: από τα ψάρια σου, σε ποια βάθη/μολύβια/ταχύτητες πιάνεις */
function worked(){ var S=B.store; if(!S) return null; var b=S.raw('bites').filter(function(x){ return !x.deleted&&x.troll&&x.troll.m==='bottom'&&x.troll.leads; }); if(b.length<2) return null;
  function rng(a){ a=a.filter(function(v){ return v!=null&&isFinite(v); }).sort(function(x,y){ return x-y; }); if(!a.length) return null; var lo=a[Math.floor(a.length*0.2)], hi=a[Math.min(a.length-1,Math.ceil(a.length*0.8)-1)]; return [lo,hi]; }
  var L=rng(b.map(function(x){ return +x.troll.leads; })), F=rng(b.map(function(x){ return x.troll.fath!=null?+x.troll.fath:(x.depth?x.depth/FATH:null); })), V=rng(b.map(function(x){ return x.troll.stw!=null?+x.troll.stw:+x.troll.kn; }));
  return {n:b.length,leads:L,fath:F,kn:V}; }
B.trollBtn=function(){ return h('button',{class:'iconbtn trbtn',type:'button','aria-label':T('Συρτή','Trolling'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h10l-2 3H5z"/><path d="M8 15V7l5 8"/><path d="M13 9c3 1 5 3 8 8"/><circle cx="21" cy="18" r="1.3"/></svg>',onclick:sheet}); };
B.troll={startDrop:startDrop,setDown:setDown,touched:touched,cancelDrop:cancelDrop,recommend:function(){ return {n:recN,d:recD,lb:recLb}; },corrAt:corrAt,addCorr:addCorr,bestN:bestN,dropSheet:dropSheet,on:on,cfg:cfg,sheet:sheet,adjust:adjust,layback:layback,geo:geo,lureDepth:lureDepth,setLeads:setLeads,fromWatch:fromWatch,setAuto:setAuto,nLeads:nLeads,calibrate:calibrate,speed:function(){ return spd; },sim:{start:simStart,stop:simStop,on:simOn,warp:simWarp,state:function(){ return SIM?{s:SIM.s,tot:SIM.tot,wp:SIM.wp}:null; }},side:function(){ return {prof:SV.prof,adv:SV.adv,iso:SV.iso,stw:SV.stw,met:MET.n,grid:!!SV.grid}; },sideTick:sideTick,metPace:metPace,worked:worked};
B.on('track',check);
B.on('trip',function(){ if(!tripOn()&&cfg().on){ var q=cfg(); q.on=false; q.auto=true; q.dep=null; recN=null; ls.set(K,q); depth=null; depthL=null; } paint(); }); /* 1.6.3: στο τέλος της εξόδου ξανά «αυτόματα» */
setInterval(function(){ if(on()) check(); },10000);
setInterval(function(){ if(on()&&cfg().mode==='bottom') sideTick(); else { paintSide(); lureMark(); } },2000); /* 1.8.7 */
setTimeout(paint,1500);
})();
