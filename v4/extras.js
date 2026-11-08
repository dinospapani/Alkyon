/* Alkyon 4 · v31z525
   - Όρια ασφαλείας (alkyon-limits): πότε μια ώρα θεωρείται «ασφαλής» στην Πρόγνωση, στις Ευκαιρίες και στις ειδοποιήσεις.
   - Ειδοποίηση απαγορευμένης περιοχής κατά την έξοδο (zones.js, Τμήμα Αλιείας).
   - Βάρος από το μήκος (σχέση W = a·L^b ανά είδος, ενδεικτικές τιμές βιβλιογραφίας). */
(function(){
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;

/* ---------- όρια ασφαλείας ---------- */
var LIMD={wind:14,wave:0.9,gust:24};
var PRE=[['small',T('Μικρό σκάφος (έως 6 m)','Small boat (up to 6 m)'),{wind:12,wave:0.6,gust:20}],
  ['mid',T('Μεσαίο (6–8 m)','Medium (6–8 m)'),{wind:16,wave:1.1,gust:26}],
  ['big',T('Μεγάλο (πάνω από 8 m)','Large (over 8 m)'),{wind:20,wave:1.6,gust:30}],
  ['shore',T('Από ακτή','From shore'),{wind:18,wave:1.3,gust:28}],
  ['spear',T('Ψαροντούφεκο','Spearfishing'),{wind:12,wave:0.5,gust:20}]];
function getL(){ var o=ls.get('alkyon-limits',null); return Object.assign({},LIMD,o&&typeof o==='object'?o:{}); }
function setL(o){ ls.set('alkyon-limits',o); if(navigator.onLine!==false){ ls.set('alkyon-fc7',null); ls.set('alkyon-v4-opps',null); } try{ window.dispatchEvent(new Event('alkyon-limits')); }catch(e){} }
B.limits=getL;
B.limitsCard=function(){
  var U=window.AlkyonUnits, L=getL(), card=h('section',{class:'card limc'});
  function wtxt(kn){ var p=U&&U.windP?U.windP(kn):[String(Math.round(kn)),'kn']; return p[0]+' '+p[1]+(p[1]!=='kn'?' ('+Math.round(kn)+' kn)':''); }
  function row(lab,key,min,max,step,fmt){ var out=h('b',{text:fmt(L[key])}), r=h('input',{type:'range',min:String(min),max:String(max),step:String(step),value:String(L[key]),'aria-label':lab});
    r.addEventListener('input',function(){ L[key]=+r.value; out.textContent=fmt(L[key]); pre.value='custom'; });
    r.addEventListener('change',function(){ setL(L); B.toast(T('Τα όρια αποθηκεύτηκαν. Η πρόγνωση θα ξαναϋπολογιστεί.','Limits saved. The forecast will be recalculated.')); });
    return h('div',{class:'limr'},h('div',{class:'limh'},h('span',{text:lab}),out),r); }
  var pre=h('select',{class:'select','aria-label':T('Προεπιλογή','Preset')}); pre.append(h('option',{value:'custom',text:T('Προσωπικά όρια','Personal limits')}));
  PRE.forEach(function(p){ pre.append(h('option',{value:p[0],text:p[1]})); });
  pre.value=(PRE.filter(function(p){ return p[2].wind===L.wind&&p[2].wave===L.wave&&p[2].gust===L.gust; })[0]||['custom'])[0];
  pre.addEventListener('change',function(){ var p=PRE.filter(function(x){ return x[0]===pre.value; })[0]; if(!p) return; setL(Object.assign({},p[2])); var nc=B.limitsCard(); card.replaceWith(nc); });
  /* v31z539: πρόταση από το μήκος του σκάφους (σελίδα Σκάφος) */
  var bl=0; try{ var bb=ls.get('alkyon-boat',null); bl=+(bb&&bb.boat&&bb.boat.len)||0; }catch(e){}
  var sg=bl>0?(bl<6?'small':bl<=8?'mid':'big'):null, sgP=sg&&PRE.filter(function(x){ return x[0]===sg; })[0], sug=null;
  /* 1.9.40: πρόταση και για ακτή/ψαροντούφεκο, από τον τύπο ψαρέματος */
  var pf=B.prof(); if(pf==='shore'||pf==='spear'){ sg=pf; sgP=PRE.filter(function(x){ return x[0]===pf; })[0]; }
  if(sgP&&pre.value!==sg&&pf!=='lake'&&(pf==='shore'||pf==='spear'||bl>0))
    sug=h('div',{class:'limsug'},h('span',{text:(pf==='shore'||pf==='spear'?T('Ψαρεύεις ','You fish ')+(pf==='shore'?T('από ακτή','from shore'):T('με ψαροντούφεκο','spearfishing'))+'. ':T('Το σκάφος σου είναι ','Your boat is ')+B.num(bl,1).replace(/[.,]0$/,'')+' m. ')+T('Ταιριάζει: ','Suggested: ')+sgP[1]+' ('+sgP[2].wind+' kn, '+B.num(sgP[2].wave,1)+' m, '+T('ριπές ','gusts ')+sgP[2].gust+' kn).'}),
      h('button',{class:'btn sm pri',type:'button',text:T('Εφαρμογή','Apply'),onclick:function(){ setL(Object.assign({},sgP[2])); B.toast(T('Τα όρια άλλαξαν σε «','Limits set to “')+sgP[1]+T('».','”.')); var nc=B.limitsCard(); card.replaceWith(nc); }}));
  card.append(h('h2',{text:T('Όρια ασφαλείας','Safety limits')}),sug,
    h('p',{class:'sub',text:T('Πάνω από αυτά η ώρα δεν θεωρείται ασφαλής: στην Πρόγνωση, στις Ευκαιρίες και στις ειδοποιήσεις καιρού.','Above these an hour is not considered safe: in the Forecast, the Chances and the weather alerts.')}),
    pre,
    row(T('Άνεμος έως','Wind up to'),'wind',6,30,1,wtxt),
    row(T('Ριπές έως','Gusts up to'),'gust',10,40,1,wtxt),
    row(T('Κύμα έως','Waves up to'),'wave',0.3,2.5,0.1,function(v){ return U&&U.wave?U.wave(v):B.num(v,1)+' m'; }),
    h('p',{class:'note',text:T('Ενδεικτικά. Η απόφαση να βγεις είναι πάντα δική σου: έλεγξε και τον επίσημο καιρό.','Indicative. The decision to go out is always yours: check the official forecast too.')}));
  return card; };

/* ---------- απαγορευμένες περιοχές κατά την έξοδο ---------- */
function rings(p){ if(!p||!p.length) return []; if(typeof p[0][0]==='number') return [p]; if(typeof p[0][0][0]==='number') return p; var o=[]; p.forEach(function(x){ o=o.concat(rings(x)); }); return o; }
function inRing(pt,r){ var x=pt[1], y=pt[0], ins=false; for(var i=0,j=r.length-1;i<r.length;j=i++){ var xi=r[i][1], yi=r[i][0], xj=r[j][1], yj=r[j][0]; if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi)) ins=!ins; } return ins; }
function segDist(p,a,b){ var k=Math.cos(p[0]*Math.PI/180)*111320, K=111320, ax=(a[1]-p[1])*k, ay=(a[0]-p[0])*K, bx=(b[1]-p[1])*k, by=(b[0]-p[0])*K, dx=bx-ax, dy=by-ay, t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/((dx*dx+dy*dy)||1))), cx=ax+t*dx, cy=ay+t*dy; return Math.sqrt(cx*cx+cy*cy); }
B.zoneCheck=function(lat,lon){ var Z=window.ZONES||[], pt=[lat,lon], best=null;
  Z.forEach(function(z){ var rs=rings(z.p), inside=rs.some(function(r){ return inRing(pt,r); }), d=1e9;
    if(!inside) rs.forEach(function(r){ for(var i=0;i<r.length;i++){ var dd=segDist(pt,r[i],r[(i+1)%r.length]); if(dd<d) d=dd; } });
    var o={z:z,inside:inside,d:inside?0:d}; if(!best||o.d<best.d) best=o; });
  return best; };
function zOn(){ return ls.get('alkyon-v4-zonealert',true)!==false; }
B.zoneAlert={on:zOn,set:function(v){ ls.set('alkyon-v4-zonealert',!!v); }};
var zState={};
function zNotify(title,body){ try{ navigator.vibrate&&navigator.vibrate([300,120,300]); }catch(e){} if(B.inboxAdd) B.inboxAdd(title,body,'zone');
  try{ if(document.hidden&&'Notification' in window&&Notification.permission==='granted'&&navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function(r){ if(r) r.showNotification(title,{body:body,icon:'../icon-192.png',tag:'alkyon-zone',renotify:true,vibrate:[300,120,300]}); }); }catch(e){}
  B.toast('⚠ '+title+' · '+body,12000); }
function loadZones(){ return window.ZONES?Promise.resolve():new Promise(function(res){ var s=document.createElement('script'); s.src='../zones.js'; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
function zTick(){
  var tr=B.trip, act=tr&&tr.active&&tr.active(); if(!act){ zState={}; return; } if(!zOn()) return;
  var f=tr.fix&&tr.fix(); if(!f||Date.now()-(f.t||0)>120000) return;
  loadZones().then(function(){ var r=B.zoneCheck(f.lat,f.lon); if(!r) return; var k=r.z.n, prev=zState[k]||'out', now=r.inside?'in':r.d<=300?'near':'out';
    if(now===prev) return; zState[k]=now;
    if(now==='in') zNotify(T('Μέσα σε απαγορευμένη περιοχή','Inside a restricted area'),r.z.n+(r.z.d?' · '+r.z.d:''));
    else if(now==='near'&&prev==='out') zNotify(T('Πλησιάζεις απαγορευμένη περιοχή','Approaching a restricted area'),r.z.n+' · '+Math.round(r.d)+' m');
    else if(now==='out'&&prev==='in') B.toast(T('Βγήκες από την περιοχή «','You left the area “')+r.z.n+T('».','”.'),6000); });
}
setInterval(function(){ try{ zTick(); }catch(e){} },20000);
B.on('trip',function(){ setTimeout(zTick,1500); });

/* ---------- βάρος από μήκος: W(g) = a · L(cm)^b (ενδεικτικές τιμές, ολικό μήκος) ---------- */
var LW={'Dicentrarchus labrax':[0.0099,3.03],'Sparus aurata':[0.0144,2.98],'Seriola dumerili':[0.0135,2.95],'Epinephelus marginatus':[0.0112,3.07],'Epinephelus costae':[0.0110,3.05],
  'Dentex dentex':[0.0123,3.0],'Dentex gibbosus':[0.0150,2.97],'Pagrus pagrus':[0.0164,2.95],'Diplodus sargus':[0.0157,3.03],'Diplodus vulgaris':[0.0170,2.98],'Thunnus thynnus':[0.0175,3.0],
  'Thunnus alalunga':[0.0137,3.07],'Euthynnus alletteratus':[0.0138,3.06],'Sarda sarda':[0.0068,3.18],'Sphyraena sphyraena':[0.0042,3.08],'Sphyraena viridensis':[0.0045,3.05],
  'Coryphaena hippurus':[0.0071,2.96],'Mullus surmuletus':[0.0089,3.11],'Mullus barbatus':[0.0090,3.10],'Pagellus erythrinus':[0.0112,3.03],'Oblada melanura':[0.0122,3.0],
  'Lithognathus mormyrus':[0.0098,3.06],'Spondyliosoma cantharus':[0.0146,2.98],'Sciaena umbra':[0.0115,3.05],'Lichia amia':[0.0119,3.0],'Pomatomus saltatrix':[0.0094,3.07],
  'Mugil cephalus':[0.0108,2.98],'Scorpaena scrofa':[0.0151,3.05],'Siganus rivulatus':[0.0105,3.04],'Lagocephalus sceleratus':[0.0099,3.0],'Seriola rivoliana':[0.0140,2.95],
  'Pagellus acarne':[0.0110,3.03],'Boops boops':[0.0080,3.08],'Scomber japonicus':[0.0068,3.17],'Trachurus mediterraneus':[0.0071,3.06],'Belone belone':[0.0012,3.1],
  'Serranus cabrilla':[0.0101,3.08],'Sargocentron rubrum':[0.0160,3.0],'Pterois miles':[0.0125,3.07],'Mycteroperca rubra':[0.0110,3.05]};
B.weightFromLen=function(latin,cm){ if(!(cm>0)) return null; var k=LW[latin]||(latin&&LW[Object.keys(LW).filter(function(x){ return x.split(' ')[0]===latin.split(' ')[0]; })[0]]); if(!k) return null; return k[0]*Math.pow(cm,k[1])/1000; };

/* ---------- εικονίδια τύπου ψαρέματος (v31z525) ---------- */
var PIC={
  boat:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 16.5h20l-2.8 4H5.2z"/><path d="M7 16.5v-4h5.5l2 4"/><path d="M13.5 12.5L21 3.5"/><path d="M21 3.5v6.5"/><path d="M21 10c-.9 0-1.2.9-.6 1.4"/></svg>',
  shore:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21l3.5-4.5 2.5 2 3-3.5 3.5 6"/><path d="M6.5 16L19 3.5"/><path d="M19 3.5c1.4 3 1.6 7.5.6 11"/><circle cx="19.4" cy="16.4" r="1.4"/><path d="M15 21c1.5-.8 3-.8 4.5 0s3 .8 4.5 0"/></svg>',
  lake:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 19c2-1.2 4-1.2 6 0s4 1.2 6 0 4-1.2 6 0"/><path d="M5 17V8M7.5 17v-5.5M5 8c1.2-.4 1.2-2.6 0-3"/><path d="M16 15.5a2 2 0 1 0 0-.1"/><path d="M16 13.5V9"/><path d="M16 9L21 4"/></svg>',
  spear:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 11h15"/><path d="M17 8.5l5 2.5-5 2.5"/><path d="M5 11v5.5h2.5L9 11"/><path d="M11 11v2.5"/><path d="M3 6.5c1.5-1.8 4.5-1.8 6 0"/><path d="M4 6.5h4"/></svg>'};
B.profBadges={"boat": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><clipPath id='cboat'><rect width='64' height='64' rx='16'/></clipPath></defs><g clip-path='url(#cboat)'><defs><linearGradient id='bS' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffb36b'/><stop offset='.55' stop-color='#ff7a59'/><stop offset='1' stop-color='#d9506a'/></linearGradient>\n<linearGradient id='bW' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2d6fa3'/><stop offset='1' stop-color='#123a63'/></linearGradient>\n<linearGradient id='bH' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='1' stop-color='#d7e2ea'/></linearGradient></defs>\n<rect width='64' height='64' fill='url(#bS)'/>\n<circle cx='46' cy='27' r='8' fill='#ffe3a3'/><circle cx='46' cy='27' r='12' fill='#ffe3a3' opacity='.25'/>\n<rect y='36' width='64' height='28' fill='url(#bW)'/>\n<path d='M0 36h64' stroke='#ffd59a' stroke-width='.8' opacity='.7'/>\n<path d='M30 37.5h14M34 40h8' stroke='#ffd59a' stroke-width='1' stroke-linecap='round' opacity='.6'/>\n<path d='M10 40.5c3-.6 6-.6 9 0M48 44c3-.6 6-.6 9 0M6 50c3-.6 6-.6 9 0M40 55c3-.6 6-.6 9 0' stroke='#6fa8d6' stroke-width='1.1' stroke-linecap='round' fill='none' opacity='.7'/>\n<path d='M7 33.5h42.5l-4.2 8.2H13.6z' fill='url(#bH)'/>\n<path d='M8.6 36.6h39.6' stroke='#e4572e' stroke-width='1.6'/>\n<path d='M7 33.5h42.5' stroke='#9fb3c2' stroke-width='.8'/>\n<path d='M22 33.5v-7.2h10.5l2.6 7.2z' fill='#eef3f7'/><path d='M24.2 28.4h7.6l1.5 4.2h-9.1z' fill='#2c5878'/>\n<path d='M21 26.3h15' stroke='#cfd9e1' stroke-width='1.4' stroke-linecap='round'/><path d='M23 26.3v-3.6h10.5v3.6' stroke='#cfd9e1' stroke-width='1.1' fill='none'/>\n<path d='M40 33.5L53 15' stroke='#3a2a1e' stroke-width='1.3' stroke-linecap='round'/><path d='M53 15c2.4 6 3 12 2 21' stroke='#fff' stroke-width='.5' fill='none' opacity='.9'/>\n<path d='M38 33.5L45 13.5' stroke='#3a2a1e' stroke-width='1.2' stroke-linecap='round'/>\n<path d='M41.8 41.7c4 .9 8 .4 12-1.4M41 43.5c5 1.3 10 .8 15-1.6' stroke='#cfe7ff' stroke-width='1' fill='none' stroke-linecap='round' opacity='.8'/></g></svg>", "shore": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><clipPath id='cshore'><rect width='64' height='64' rx='16'/></clipPath></defs><g clip-path='url(#cshore)'><defs><linearGradient id='sS' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#7cc7e8'/><stop offset='.6' stop-color='#b9e2ef'/><stop offset='1' stop-color='#ffe2b8'/></linearGradient>\n<linearGradient id='sW' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#3aa6b9'/><stop offset='1' stop-color='#1d6f8a'/></linearGradient>\n<linearGradient id='sR' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#6d7a83'/><stop offset='1' stop-color='#3a444b'/></linearGradient></defs>\n<rect width='64' height='64' fill='url(#sS)'/>\n<path d='M0 33c8-3 14-2 20 0s12 2 18-.5 14-3 26 .5V40H0z' fill='#8fb9a3' opacity='.55'/>\n<rect y='38' width='64' height='26' fill='url(#sW)'/>\n<path d='M4 44c3-.7 6-.7 9 0M26 48c3-.7 6-.7 9 0M10 55c3-.7 6-.7 9 0' stroke='#a8e3ef' stroke-width='1.1' stroke-linecap='round' fill='none' opacity='.8'/>\n<path d='M34 64l3-14 6-5 7 2 5-6 9 3v20z' fill='url(#sR)'/><path d='M37 50l6-5 7 2 5-6 9 3' stroke='#8a979f' stroke-width='1' fill='none' stroke-linejoin='round'/>\n<path d='M52 64c-1-6 1-11 6-13l6 2v11z' fill='#2e373d'/>\n<circle cx='48.6' cy='25.6' r='2.6' fill='#1f2a33'/>\n<path d='M47 28.5c-1.6.6-2.4 2-2.4 4l.3 6.5h3.6l.6 5.6h2l.2-5.8 1.4-.4-.4-6.8c-.2-2-1.5-3.3-3.3-3.4z' fill='#1f2a33'/>\n<path d='M45.4 41.6l-.6 4.8h1.8l1-4.6M49.6 41.6l.3 4.8h1.8l-.4-4.8' fill='#1f2a33'/>\n<path d='M47.3 31.8l-4.6 2.6' stroke='#1f2a33' stroke-width='1.8' stroke-linecap='round'/>\n<path d='M43.4 34.6Q30 12 14 9.5' stroke='#2b1d14' stroke-width='1.3' fill='none' stroke-linecap='round'/>\n<path d='M14 9.5c-2.6 8-3.5 18-3 28.8' stroke='#ffffff' stroke-width='.5' fill='none' opacity='.95'/>\n<circle cx='11' cy='38.6' r='1.5' fill='#ff5a3c'/><path d='M8.2 39.4c1.8-.5 3.6-.5 5.6 0' stroke='#d4f3f8' stroke-width='.8' fill='none'/></g></svg>", "lake": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><clipPath id='clake'><rect width='64' height='64' rx='16'/></clipPath></defs><g clip-path='url(#clake)'><defs><linearGradient id='lS' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#9fe0d6'/><stop offset='1' stop-color='#e7f7e9'/></linearGradient>\n<linearGradient id='lW' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#3cb4a8'/><stop offset='1' stop-color='#15707a'/></linearGradient></defs>\n<rect width='64' height='64' fill='url(#lS)'/>\n<path d='M0 30c7-6 14-8 22-4s12-5 20-4 14 6 22 3v9H0z' fill='#5aa883'/><path d='M0 33c10-3 18-2 26 0s16 1 24-1 10 0 14 1v3H0z' fill='#3f8f6d'/>\n<rect y='35' width='64' height='29' fill='url(#lW)'/>\n<ellipse cx='32' cy='47' rx='11' ry='3' fill='none' stroke='#bff0e6' stroke-width='1' opacity='.75'/>\n<ellipse cx='32' cy='47' rx='17' ry='4.8' fill='none' stroke='#bff0e6' stroke-width='.8' opacity='.45'/>\n<path d='M32 32v6' stroke='#2b2b2b' stroke-width='1.2' stroke-linecap='round'/>\n<path d='M32 37.4c3 0 4.6 2.6 4.6 5.4H27.4c0-2.8 1.6-5.4 4.6-5.4z' fill='#ff4b3e'/><path d='M27.4 42.8h9.2c0 2.6-2 4.4-4.6 4.4s-4.6-1.8-4.6-4.4z' fill='#ffffff'/>\n<path d='M32 32Q40 18 58 12' stroke='#2b1d14' stroke-width='.6' fill='none' opacity='.0'/>\n<path d='M6 64V40M9.5 64V44M3 64V47M58 64V42M61 64V46' stroke='#2f6b3f' stroke-width='1.6' stroke-linecap='round'/>\n<rect x='4.8' y='35' width='2.6' height='8' rx='1.3' fill='#6b4428'/><rect x='56.8' y='37' width='2.6' height='8' rx='1.3' fill='#6b4428'/>\n<path d='M9.5 44c2-3 4-4 6-4M3 47c-1-2-1-4 0-6M61 46c1.6-2.6 2-4.4 1.4-6.6' stroke='#3f8a4f' stroke-width='1.3' fill='none' stroke-linecap='round'/></g></svg>", "spear": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><clipPath id='cspear'><rect width='64' height='64' rx='16'/></clipPath></defs><g clip-path='url(#cspear)'><defs><linearGradient id='uW' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#3fb7e6'/><stop offset='.5' stop-color='#1b78b8'/><stop offset='1' stop-color='#0c3d6e'/></linearGradient>\n<linearGradient id='uR' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffffff' stop-opacity='.35'/><stop offset='1' stop-color='#ffffff' stop-opacity='0'/></linearGradient></defs>\n<rect width='64' height='64' fill='url(#uW)'/>\n<path d='M10 0l-6 40h6L18 0zM30 0l-4 44h5L37 0zM48 0l2 38h5L56 0z' fill='url(#uR)'/>\n<path d='M0 58c6-3 10-2 15 1s10 2 15 0 9-3 14 0 12 3 20 0v5H0z' fill='#0a2f52'/>\n<path d='M44 60c0-3 1-5 3-7M48 60c1-4 3-6 5-8' stroke='#1f8a5c' stroke-width='1.6' fill='none' stroke-linecap='round'/>\n<g transform='rotate(-8 32 32)'>\n<path d='M10.5 30.5c2.8-1.6 6-2 9.5-1.6l13 1.4c2 .2 3.2 1.4 3.4 3l-.4 1.4-15.8 .2-9.2-1.2z' fill='#1e2a36'/>\n<path d='M3 32.8l7.5-2.3.8 3.9L3 36.6z' fill='#2bd1c4'/><path d='M4.6 29.6l5.9 1 .4 2-6.6 0z' fill='#2bd1c4' opacity='.8'/>\n<circle cx='38.6' cy='31.6' r='3.4' fill='#1e2a36'/><rect x='38.8' y='29.6' width='4.4' height='2.8' rx='1' fill='#9fe7ff' stroke='#1e2a36' stroke-width='.8'/>\n<path d='M37 27.8c-.3-2.6.5-4.6 2.6-5.6' stroke='#ffcc33' stroke-width='1.3' fill='none' stroke-linecap='round'/>\n<path d='M34 33.6l4 1.6h2' stroke='#1e2a36' stroke-width='1.6' stroke-linecap='round'/>\n<path d='M38 35.6h20' stroke='#cfd8de' stroke-width='1.1'/><path d='M40 34.6h7v2.2h-7z' fill='#3a3a3a'/><path d='M58 35.6l3-1.3v2.6z' fill='#e9eef2'/>\n</g>\n<circle cx='44' cy='18' r='1.4' fill='none' stroke='#d8f6ff' stroke-width='.8'/><circle cx='46.5' cy='13' r='1' fill='none' stroke='#d8f6ff' stroke-width='.7'/><circle cx='43' cy='9' r='.8' fill='none' stroke='#d8f6ff' stroke-width='.6'/>\n<path d='M51 48.5c2-1.6 4.4-1.6 6.4 0-2 1.6-4.4 1.6-6.4 0zM57.2 48.5l2-1.4v2.8z' fill='#ffd166'/>\n<path d='M16 50.5c1.6-1.2 3.4-1.2 5 0-1.6 1.2-3.4 1.2-5 0zM21 50.5l1.6-1.1v2.2z' fill='#c9e9f5'/></g></svg>"};
var bdN=0;
/* κάθε αντίγραφο με δικά του id (αλλιώς, αν το πρώτο είναι κρυμμένο, τα gradient/clip χάνονται και στα υπόλοιπα) */
/* v31z525d: φωτογραφίες της αρχικής οθόνης για βάρκα, ακτή, ψαροντούφεκο (η λίμνη μένει εικονογράφηση μέχρι να μπει φωτογραφία) */
var PPH={boat:'alk-th-boatrod.jpg',shore:'alk-th-shorerod.jpg',spear:'alk-th-spear.jpg',lake:'alk-th-lake.jpg'};
B.profPhoto=function(p){ return PPH[p]||null; };
B.profBadge=function(p){ if(PPH[p]) return '<img class="pbph" src="'+PPH[p]+'" alt="" draggable="false">'; var svg=B.profBadges[p]||B.profBadges.boat, u='_'+(++bdN); return svg.replace(/id='([^']+)'/g,"id='$1"+u+"'").replace(/url\(#([^)]+)\)/g,'url(#$1'+u+')'); };
B.profIcon=function(p){ return PIC[p]||PIC.boat; };
B.profIcons=PIC;
})();
