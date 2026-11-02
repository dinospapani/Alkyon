/* v31z380 · Νέα οθόνη «Πρόγνωση» (σύστημα σχεδίασης Alkyon).
   Μία σελίδα: τοποθεσία, βαθμός τώρα, καλύτερη ώρα, 24 ώρες, γράφημα πίεσης/ανέμου/σελήνης, γραμμές που ανοίγουν, 7 μέρες.
   Δεν αλλάζει υπολογισμούς: διαβάζει την ίδια πρόγνωση (alkyon-fcloaded) και μεταφέρει τις υπάρχουσες κάρτες μέσα στη νέα διάταξη.
   Επιστροφή στην παλιά εμφάνιση: localStorage alkyon-fc2 = "0". */
(function(){
'use strict';
var C=window.AlkyonCore, PU=window.AlkyonUnits; if(!C) return;
var on=true; try{ on=localStorage.getItem('alkyon-fc2')!=='0'; }catch(e){}
if(!on) return;
window.ndFC2=true;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var $=function(i){ return document.getElementById(i); };
function E(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function p2(n){ return (n<10?'0':'')+n; }
function u(fn,v){ try{ return PU&&PU[fn]?PU[fn](v):String(v); }catch(e){ return ''; } }
function isLake(){ try{ return localStorage.getItem('alkyon-fprof')==='lake'; }catch(e){ return false; } }
function lvl(v){ return v>=75?'good':v>=60?'ok':v>=45?'fair':'poor'; }
var DN=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
var DIRS=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dir(d){ return d==null?'':DIRS[Math.round(((d%360)+360)%360/45)%8]; }
function S(d,cls){ return '<svg viewBox="0 0 24 24" aria-hidden="true" class="'+(cls||'')+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'; }
var IC={
  pin:S('<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0113 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  radar:S('<path d="M7 16a4 4 0 01-.5-7.97A5.5 5.5 0 0117 9a3.5 3.5 0 01.5 7"/><path d="M9 19l1-2M13 20l1-2"/>'),
  bell:S('<path d="M6 17v-6a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>'),
  bellOff:S('<path d="M6 17v-6a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/><path d="M3 3l18 18"/>'),
  ref:S('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  chev:S('<path d="M9 6l6 6-6 6"/>'),
  why:S('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01"/>'),
  press:S('<circle cx="12" cy="13" r="8"/><path d="M12 13l3.5-3.5M12 5V3"/>'),
  drop:S('<path d="M12 3s6 6.4 6 11a6 6 0 01-12 0c0-4.6 6-11 6-11z"/><path d="M8.5 14.5a3.5 3.5 0 003.5 3.5"/>'),
  moon:S('<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>'),
  coast:S('<path d="M3 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2"/><path d="M4 12l4-6 4 4 3-3 5 5"/>'),
  sliders:S('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  fish:S('<path d="M2.5 12c3-5 10-5.5 13.5-1.2L21 7v10l-5-3.8C12.5 17.5 5.5 17 2.5 12z"/><circle cx="8" cy="11" r=".8" fill="currentColor"/>'),
  star:'<svg viewBox="0 0 24 24" aria-hidden="true" class="ds-star"><path fill="currentColor" d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/></svg>'
};
/* εικονίδια καιρού από τον κωδικό WMO */
function wx(code,night){
  var sun='<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>';
  var cloud='<path d="M7 18a4 4 0 01-.4-7.98A5.5 5.5 0 0117.3 9.6 3.6 3.6 0 0117.5 18z"/>';
  if(code==null||code<=1) return S(sun,'dswx sun');
  if(code===2) return S('<path d="M8.5 5.5V4M4.5 9.5H3M5.4 6.4l-1-1M12 7.6A3.6 3.6 0 005.6 10"/>'+'<path d="M8 19a3.5 3.5 0 01-.3-6.98 4.8 4.8 0 019.3-.6A3.1 3.1 0 0117 19z"/>','dswx part');
  if(code>=95) return S(cloud.replace('18z','15z').replace('a4 4','a3.4 3.4')+'<path d="M12 14l-2 4h3l-2 4"/>','dswx storm');
  if(code>=51) return S('<path d="M7 15a4 4 0 01-.4-7.98A5.5 5.5 0 0117.3 6.6 3.6 3.6 0 0117.5 15z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/>','dswx rain');
  if(code>=45) return S('<path d="M4 9h16M3 13h18M5 17h14"/>','dswx fog');
  return S(cloud,'dswx cloud');
}
/* σχέδιο σελήνης από τη φάση (f: 0 νέα, .5 πανσέληνος) */
function moonSVG(f,size){
  var r=10, k=Math.cos(2*Math.PI*f), wax=f<0.5, rx=Math.abs(k)*r;
  var lit='M12 2 A10 10 0 0 '+(wax?1:0)+' 12 22 A'+rx+' 10 0 0 '+((k>0)===wax?0:1)+' 12 2Z';
  return '<svg viewBox="0 0 24 24" width="'+(size||40)+'" height="'+(size||40)+'" aria-hidden="true" class="ds-moon"><circle cx="12" cy="12" r="10" class="dark"/><path d="'+lit+'" class="lit"/><circle cx="12" cy="12" r="10" class="ring"/></svg>';
}
var PHN=EN?['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent']:['Νέα σελήνη','Αύξουσα μηνίσκος','Α΄ τέταρτο','Αύξουσα κυρτή','Πανσέληνος','Φθίνουσα κυρτή','Δ΄ τέταρτο','Φθίνουσα μηνίσκος'];

var fc=null, place=null, selH=null, openRow={}, openDay={};
try{ var c0=JSON.parse(localStorage.getItem('alkyon-fc7')||'null'); if(c0&&c0.fc) fc=c0.fc; }catch(e){}
window.addEventListener('alkyon-fcloaded',function(e){ if(e.detail&&e.detail.fc){ fc=e.detail.fc; place=e.detail.place; selH=null; render(); } });

var root=null, segT=null, mode='today';
/* v31z381: «Σήμερα» και «7 μέρες» ως χωριστές καρτέλες της ίδιας σελίδας */
function setMode(m){ mode=m==='days'?'days':'today'; if(root){ root.dataset.mode=mode; segBuild(root.querySelector('.ds-seg'),mode==='days'?'days':'fc'); } setTimeout(render,0); }
/* ---------- βασική δομή ---------- */
function build(){
  var tab=$('tab-today'); if(!tab) return false; if(root) return true;
  document.body.classList.add('fc2');
  root=E('div','ds fc2'); root.id='fc2'; root.dataset.mode=mode;
  root.innerHTML=
    '<div class="ds-seg" role="tablist"></div>'+
    '<div class="fc2-head"><button type="button" class="ds-pill fc2-loc">'+IC.pin+'<span></span><i>▾</i></button><div class="fc2-acts"></div></div>'+
    '<div class="fc2-locbox" hidden></div>'+
    '<section class="ds-card fc2-hero"></section>'+
    '<section class="ds-card fc2-hours"><header class="ds-h"><h2></h2><span class="ds-sub"></span></header><div class="fc2-bars" role="listbox"></div><div class="fc2-axis"></div><div class="fc2-legend"></div><div class="fc2-hdet"></div></section>'+
    '<section class="ds-card fc2-chart"><header class="ds-h"><h2></h2></header><div class="fc2-chartbox"></div></section>'+
    '<section class="ds-list fc2-rows"></section>'+
    '<section class="ds-card fc2-days"><header class="ds-h"><h2></h2><span class="ds-sub"></span></header><div class="fc2-dlist"></div><p class="ds-foot"></p></section>'+
    '<p class="ds-src"></p>';
  tab.insertBefore(root,tab.firstChild);
  segBuild(root.querySelector('.ds-seg'),mode==='days'?'days':'fc');
  /* κάρτα με τοποθεσίες (η υπάρχουσα), ανοίγει από το κουμπί */
  var lb=root.querySelector('.fc2-locbox'), tl=$('tdLoc'); if(tl){ lb.appendChild(tl); tl.classList.remove('ndlocc'); }
  root.querySelector('.fc2-loc').addEventListener('click',function(){ lb.hidden=!lb.hidden; this.setAttribute('aria-expanded',String(!lb.hidden)); if(!lb.hidden){ var i=lb.querySelector('input'); if(i) setTimeout(function(){ try{ i.focus({preventScroll:true}); }catch(e){} },60); } });
  document.addEventListener('click',function(e){ if(e.target.closest&&e.target.closest('#fc2 .fc2-locbox .chip')) setTimeout(function(){ lb.hidden=true; },150); },true);
  /* ενέργειες: ραντάρ, ειδοποιήσεις, ανανέωση */
  var acts=root.querySelector('.fc2-acts');
  var ra=E('a','ds-ib'); ra.id='fc2Radar'; ra.target='_blank'; ra.rel='noopener'; ra.innerHTML=IC.radar; ra.setAttribute('aria-label',T('Ραντάρ βροχής (Windy)','Rain radar (Windy)')); ra.title=ra.getAttribute('aria-label');
  var be=E('button','ds-ib'); be.type='button'; be.id='fc2Bell'; be.addEventListener('click',function(){ var x=$('fcWatch'); if(x) x.click(); setTimeout(paintActs,100); });
  var rf=E('button','ds-ib'); rf.type='button'; rf.innerHTML=IC.ref; rf.setAttribute('aria-label',T('Ανανέωση','Refresh')); rf.title=rf.getAttribute('aria-label');
  rf.addEventListener('click',function(){ rf.classList.add('spin'); setTimeout(function(){ rf.classList.remove('spin'); },900); var a=$('liveRefresh'); if(a) a.click(); var b=$('fcRefresh'); if(b) b.click(); });
  acts.append(ra,be,rf);
  /* γράφημα: η υπάρχουσα κάρτα πίεσης/ανέμου/σελήνης */
  var tp=$('tdPress'); if(tp) root.querySelector('.fc2-chartbox').appendChild(tp);
  root.querySelector('.fc2-chart h2').textContent=T('Πίεση, άνεμος, σελήνη','Pressure, wind, moon');
  root.querySelector('.fc2-hours h2').textContent=T('Σήμερα ανά ώρα','Today by hour');
  root.querySelector('.fc2-days h2').textContent=T('7 μέρες','7 days');
  root.querySelector('.fc2-days .ds-foot').innerHTML='<span class="ds-conf" data-c="2"></span>'+T(' βεβαιότητα πρόγνωσης (γεμάτη = υψηλή) · ',' forecast confidence (full = high) · ')+IC.star+T(' η καλύτερη μέρα',' best day');
  root.querySelector('.ds-src').textContent=T('Καιρός και κύμα: Open-Meteo. Ενδεικτική πρόγνωση, όχι επίσημη.','Weather and waves: Open-Meteo. Indicative, not an official forecast.');
  legend();
  rowsBuild();
  return true;
}
/* καρτέλες: Πρόγνωση | Δικά μου | Τι να ψαρέψω */
function segBuild(box,act){
  box.replaceChildren();
  [['fc',T('Σήμερα','Today')],['days',T('7 μέρες','7 days')],['mine',T('Δικά μου','My data')],['adv',T('Τι να ψαρέψω','What to fish')]].forEach(function(x){
    var b=E('button','',x[1]); b.type='button'; b.setAttribute('role','tab'); b.setAttribute('aria-selected',String(x[0]===act)); b.dataset.k=x[0];
    b.addEventListener('click',function(){ go(x[0]); }); box.appendChild(b); });
}
function go(k){
  try{
    if(k==='fc'||k==='days'){ setMode(k==='days'?'days':'today'); C.lsSet('alkyon-wxsub','today'); C.switchTab('today'); window.scrollTo(0,0); return; }
    C.lsSet('alkyon-wxsub','fc'); C.switchTab('fc');
    setTimeout(function(){ var b=document.querySelector('#fcSeg button[data-s='+k+']'); if(b) b.click(); fcSeg(k); window.scrollTo(0,0); },30);
  }catch(e){}
}
function fcSeg(k){
  var tab=$('tab-fc'); if(!tab) return; var box=$('fc2SegFc');
  if(!box){ box=E('div','ds ds-seg'); box.id='fc2SegFc'; tab.insertBefore(box,tab.firstChild); }
  segBuild(box,k);
}
/* ---------- βαθμός τώρα και καλύτερη ώρα ---------- */
function bestWin(){
  var d=fc&&fc.days&&fc.days[0]; if(!d) return null; var now=fc.nowLocal?+fc.nowLocal.slice(11,13):new Date().getHours();
  var hs=d.hours.filter(function(h){ return h.hr>=now; }), best=null;
  for(var i=0;i<hs.length-1;i++){ if(hs[i+1].hr!==hs[i].hr+1) continue; var a=(hs[i].score+hs[i+1].score)/2; if(!best||a>best.a) best={h:hs[i].hr,a:a}; }
  return best;
}
function solToday(){ try{ var c=C.getCond&&C.getCond(), d0=new Date(); d0.setHours(0,0,0,0); return (window.ndSol||function(){ return []; })(d0.getTime(),d0.getTime()+86400000,c&&c.lat!=null?+c.lat:35,c&&c.lon!=null?+c.lon:33); }catch(e){ return []; } }
function hero(){
  var h=root.querySelector('.fc2-hero'); var sc=($('score')||{}).firstChild; var v=sc?parseInt(sc.textContent,10):NaN;
  var verdict=(($('scoreText')||{}).textContent||'').trim(), pill=$('safePill'), ptxt=pill?(pill.textContent||'').trim():'', pcls=pill?pill.className:'', stxt=(($('safeText')||{}).textContent||'').trim();
  var bw=bestWin(), why='';
  if(bw){ var d0=new Date(); d0.setHours(bw.h,0,0,0); var s0=d0.getTime(); var per=solToday().filter(function(p){ return p.s<s0+7200000&&p.e>s0; }); if(per.length) why=per.some(function(p){ return p.kind==='major'; })?T('κύρια περίοδος σελήνης','major moon period'):T('δευτερεύουσα περίοδος σελήνης','minor moon period'); }
  var sig=[v,verdict,ptxt,stxt,bw&&bw.h,bw&&Math.round(bw.a),why].join('|'); if(h.dataset.sig===sig) return; h.dataset.sig=sig;
  var lv=isNaN(v)?'none':lvl(v), pct=isNaN(v)?0:Math.max(0,Math.min(100,v));
  var R=44, L=2*Math.PI*R;
  h.innerHTML='<div class="fc2-score" data-lv="'+lv+'"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="'+R+'" class="trk"/><circle cx="50" cy="50" r="'+R+'" class="val" stroke-dasharray="'+(L*pct/100).toFixed(1)+' '+L.toFixed(1)+'" transform="rotate(-90 50 50)"/></svg><b></b><span>/100</span></div>'+
    '<div class="fc2-sum"><span class="ds-over"></span><b class="fc2-verd"></b><span class="ds-chip"></span><p></p></div>'+
    '<div class="fc2-best"><div><span class="ds-over"></span><b class="ds-num"></b></div><span class="fc2-why"></span></div>';
  h.querySelector('.fc2-score b').textContent=isNaN(v)?'–':String(v);
  h.querySelector('.fc2-sum .ds-over').textContent=T('Τώρα','Now')+(window.AlkyonFProf?' · '+window.AlkyonFProf.name():'');
  h.querySelector('.fc2-verd').textContent=verdict||'–';
  var ch=h.querySelector('.ds-chip'); ch.textContent=ptxt; ch.hidden=!ptxt; ch.dataset.t=/bad|danger|no\b/.test(pcls)?'poor':/warn|caution/.test(pcls)?'fair':'good';
  h.querySelector('.fc2-sum p').textContent=stxt;
  var b=h.querySelector('.fc2-best'); b.hidden=!bw;
  if(bw){ b.querySelector('.ds-over').textContent=T('Καλύτερη ώρα σήμερα','Best time today'); b.querySelector('.ds-num').textContent=p2(bw.h)+':00–'+p2((bw.h+2)%24)+':00'; var w=b.querySelector('.fc2-why'); w.innerHTML=why?IC.star+'<span></span>':''; if(why) w.lastChild.textContent=why; }
}
/* ---------- 24 ώρες ---------- */
function legend(){ var l=root.querySelector('.fc2-legend'); l.innerHTML=''; [['best',T('καλύτερες ώρες','best hours')],['moon',T('σελήνη','moon')],['bad',T('δύσκολες','poor')]].forEach(function(x){ var s=E('span'); s.append(E('i',x[0]),document.createTextNode(x[1])); l.appendChild(s); }); }
function hours(){
  var box=root.querySelector('.fc2-bars'), det=root.querySelector('.fc2-hdet'), d=fc&&fc.days&&fc.days[0];
  if(!d){ box.innerHTML='<div class="ndsk ndskbars" role="status" aria-label="'+T('Φόρτωση πρόγνωσης','Loading forecast')+'">'+new Array(25).join('<i></i>')+'</div>'; det.textContent=''; return; }
  var now=fc.nowLocal?+fc.nowLocal.slice(11,13):new Date().getHours(); if(selH==null) selH=now;
  var bw=bestWin(), per=solToday(), d0=new Date(); d0.setHours(0,0,0,0);
  var sig=d.date+'|'+selH+'|'+(bw&&bw.h)+'|'+d.hours.map(function(x){ return x.score; }).join(',');
  if(box.dataset.sig!==sig){ box.dataset.sig=sig; box.replaceChildren();
    d.hours.forEach(function(h){
      var t0=d0.getTime()+h.hr*3600000, m=per.some(function(p){ return p.s<t0+3600000&&p.e>t0; });
      var b=E('button','fc2-bar'); b.type='button'; b.setAttribute('role','option'); b.style.setProperty('--v',h.score);
      var k=!h.safe?'bad':(bw&&(h.hr===bw.h||h.hr===bw.h+1))?'best':m?'moon':'';
      if(k) b.dataset.k=k; if(h.hr<now) b.classList.add('past'); if(h.hr===selH) b.classList.add('sel');
      b.setAttribute('aria-label',p2(h.hr)+':00 · '+h.score); b.setAttribute('aria-selected',String(h.hr===selH));
      b.addEventListener('click',function(){ selH=h.hr; hours(); }); box.appendChild(b); });
    var ax=root.querySelector('.fc2-axis'); ax.innerHTML='';
    var sr=d.rise!=null?Math.floor(d.rise/60):null, ss=d.set!=null?Math.floor(d.set/60):null;
    ['00','06','12','18','23'].forEach(function(x){ ax.appendChild(E('span','',x)); });
    root.querySelector('.fc2-hours .ds-sub').textContent=(sr!=null?T('↑ ','↑ ')+p2(sr)+':'+p2(Math.round(d.rise%60)):'')+(ss!=null?'   ↓ '+p2(ss)+':'+p2(Math.round(d.set%60)):'');
  }
  var h=d.hours.filter(function(x){ return x.hr===selH; })[0]; if(!h){ det.textContent=''; return; }
  var cells=[[p2(h.hr)+':00',T('ώρα','time')],[String(h.score),T('βαθμός','score')],[u('wind',h.wind)+(h.dir!=null?' '+dir(h.dir):''),T('άνεμος','wind')+(h.gust!=null?' · '+T('ριπές ','gusts ')+u('wind',h.gust):'')]];
  if(h.wave!=null&&!isLake()){ var wc=fc&&fc.waveCorr; cells.push([u('wave',h.wave),T('κύμα','waves')+(h.period!=null?' · '+Math.round(h.period)+' s':'')+(wc&&Math.abs(wc.f-1)>=0.03?' · '+T('δική σου διόρθ. ','your adj. ')+(wc.f>1?'+':'−')+Math.round(Math.abs(wc.f-1)*100)+'%':'')]); }
  if(h.rain!=null) cells.push([Math.round(h.rain)+'%',T('βροχή','rain')]);
  var s2=JSON.stringify(cells); if(det.dataset.sig===s2) return; det.dataset.sig=s2; det.replaceChildren();
  cells.forEach(function(c,i){ var x=E('div','fc2-hc'+(i===1?' lv-'+lvl(h.score):'')); x.append(E('b','ds-num',c[0]),E('span','',c[1])); det.appendChild(x); });
}
/* ---------- γραμμές που ανοίγουν ---------- */
var ROWS=[
  {k:'why',ic:'why',t:function(){ var v=parseInt((($('score')||{}).firstChild||{}).textContent,10); return isNaN(v)?T('Γιατί αυτός ο βαθμός','Why this score'):T('Γιατί ','Why ')+v+';'; },s:function(){ return T('Σελήνη, πίεση, άνεμος, κύμα, ουρανός','Moon, pressure, wind, waves, sky'); },node:function(){ return $('factors'); }},
  {k:'press',ic:'press',t:function(){ return T('Πίεση','Pressure'); },s:function(){ var p=$('fcTurn'); var q=p&&p.querySelectorAll(':scope>p:not(.note)'); return q&&q[0]?q[0].textContent:''; },node:function(){ return $('fcTurn'); }},
  {k:'moon',ic:'moon',t:function(){ return T('Σελήνη','Moon'); },s:function(){ var m=moonNow(); return m?m.name+' · '+m.ill+'%':''; },build:moonBox},
  {k:'dam',ic:'drop',t:function(){ var n=damNear(); return n?n.name+T(' · πληρότητα',' · fullness'):T('Πληρότητα φράγματος','Reservoir level'); },s:function(){ var n=damNear(); return n?Math.round(n.lv.pct)+'%'+(n.lv.lyPct!=null?T(' · πέρσι ',' · last year ')+Math.round(n.lv.lyPct)+'%':''):''; },build:function(body){ var n=damNear(); if(!n){ body.textContent=''; return; } var sig=n.name+n.date+n.lv.pct; if(body.dataset.sig===sig) return; body.dataset.sig=sig; body.replaceChildren(window.AlkyonDams.box(n.lv,n.H)); }},
  {k:'lkw',ic:'coast',t:function(){ return T('Από ποια όχθη','Which bank'); },s:function(){ var x=lakeWind(); return x?x.short:''; },build:function(body){ var x=lakeWind(); if(!x){ body.textContent=''; return; } if(body.dataset.sig===x.long) return; body.dataset.sig=x.long; body.replaceChildren(E('p','',x.long),E('p','ds-note',T('Γενικός κανόνας ψαράδων λίμνης, όχι μέτρηση. Ο άνεμος σπρώχνει το ζεστό επιφανειακό νερό και την τροφή προς την όχθη που τον δέχεται.','A general lake-angling rule, not a measurement. Wind pushes warm surface water and food toward the bank it blows onto.'))); }},
  {k:'coast',ic:'coast',t:function(){ return T('Έκθεση ακτής','Coast exposure'); },s:function(){ var e=$('fcExposure'); if(!e) return ''; var p=[].slice.call(e.querySelectorAll(':scope>p:not(.note)')).filter(function(x){ return /^Τώρα|^Now/.test((x.textContent||'').trim()); })[0]; return p?p.textContent.replace(/^(Τώρα|Now):\s*/,''):''; },node:function(){ return $('fcExposure'); }},
  {k:'sp',ic:'fish',t:function(){ return T('Βαθμός για είδος','Score for a species'); },s:function(){ var s=document.querySelector('#fcSpPick select'); return s&&s.selectedOptions[0]?s.selectedOptions[0].textContent:T('Όλα τα είδη','All species'); },node:function(){ return $('fcSpPick'); }},
  {k:'scen',ic:'sliders',t:function(){ return T('Δοκίμασε σενάριο','Try a scenario'); },s:function(){ return T('Άλλη μέρα, άνεμος ή κύμα','Another day, wind or waves'); },node:function(){ return document.querySelector('#liveBox details.scen'); }}
];
function damNear(){
  if(!isLake()||!window.AlkyonDams||!window.AlkyonDams.near) return null;
  var c=C.getCond&&C.getCond(), ll=place&&place.lat!=null?[place.lat,place.lon]:(c&&c.lat!=null?[c.lat,c.lon]:null);
  return ll?window.AlkyonDams.near(+ll[0],+ll[1],5):null;
}
window.addEventListener('alkyon-dams',function(){ try{ if(root) rows(); }catch(e){} });
/* v31z404: λίμνη, άνεμος και όχθη (την τρέχουσα ώρα) */
function lakeWind(){
  if(!isLake()||!fc||!fc.days||!fc.days[0]||!fc.days[0].hours) return null;
  var hr=new Date().getHours(), h=fc.days[0].hours.filter(function(x){ return x.hr===hr; })[0]; if(!h||h.dir==null||h.wind==null) return null;
  var D8=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'], from=D8[Math.round(h.dir/45)%8], to=D8[Math.round(((h.dir+180)%360)/45)%8];
  if(h.wind<4) return {short:T('Άπνοια: όλες οι όχθες','Calm: any bank'),long:T('Σχεδόν άπνοια. Δεν έχει σημασία η όχθη· ψάξε δομές, βάθη και σκιά.','Almost calm. The bank does not matter much; look for structure, depth and shade.')};
  var cold=typeof h.temp==='number'&&h.temp<12, strong=h.wind>18;
  if(cold||strong) return {short:T('Προστατευμένη ','Sheltered ')+from+T(' όχθη',' bank'),long:T('Ο άνεμος ('+from+', '+u('wind',h.wind)+') φυσά προς την '+to+' όχθη. ','Wind ('+from+', '+u('wind',h.wind)+') is blowing onto the '+to+' bank. ')+(cold?T('Με κρύο, προτίμησε την προστατευμένη '+from+' όχθη, όπου το νερό μένει πιο ζεστό.','In the cold, prefer the sheltered '+from+' bank, where the water stays warmer.'):T('Με δυνατό αέρα, η προστατευμένη '+from+' όχθη είναι πιο εύκολη και ασφαλής.','In strong wind, the sheltered '+from+' bank is easier and safer.'))};
  return {short:T('Η ','The ')+to+T(' όχθη (δέχεται τον άνεμο)',' bank (wind blows onto it)'),long:T('Ο άνεμος ('+from+', '+u('wind',h.wind)+') φυσά προς την '+to+' όχθη. Εκεί μαζεύονται τροφή και ζεστό νερό, και συχνά τα ψάρια.','Wind ('+from+', '+u('wind',h.wind)+') is blowing onto the '+to+' bank. Food and warm water collect there, and often the fish too.')};
}
function rowsBuild(){
  var box=root.querySelector('.fc2-rows');
  ROWS.forEach(function(r){
    var w=E('div','ds-row'); w.dataset.k=r.k;
    var b=E('button','ds-rowb'); b.type='button'; b.setAttribute('aria-expanded','false');
    b.innerHTML='<span class="ds-ic">'+IC[r.ic]+'</span><span class="ds-rt"><b></b><small></small></span><span class="ds-chev">'+IC.chev+'</span>';
    var body=E('div','ds-rowc'); body.hidden=true;
    b.addEventListener('click',function(){ openRow[r.k]=!openRow[r.k]; body.hidden=!openRow[r.k]; b.setAttribute('aria-expanded',String(!!openRow[r.k])); fill(r,body); });
    w.append(b,body); box.appendChild(w);
  });
}
function fill(r,body){
  if(r.build){ r.build(body); return; }
  var n=r.node&&r.node(); if(n&&n.parentNode!==body){ body.appendChild(n); n.hidden=false; if(n.tagName==='DETAILS') n.open=true; }
}
function rows(){
  [].forEach.call(root.querySelectorAll('.ds-row'),function(w){
    var r=ROWS.filter(function(x){ return x.k===w.dataset.k; })[0]; if(!r) return;
    var hide=(r.node&&!r.node()&&!r.build)||(r.k==='coast'&&isLake())||(r.k==='dam'&&!damNear())||(r.k==='lkw'&&!lakeWind()); w.hidden=hide;
    var b=w.querySelector('.ds-rt b'), s=w.querySelector('.ds-rt small'), t=r.t(), st=(r.s()||'').trim();
    if(b.textContent!==t) b.textContent=t; if(s.textContent!==st) s.textContent=st;
    if(openRow[r.k]) fill(r,w.querySelector('.ds-rowc'));
  });
}
/* σελήνη: σχέδιο φάσης, ώρες, περίοδοι Knight σήμερα, 7 μέρες */
function moonNow(){ try{ var ph=window.PF.moonPhase(Date.now()); return {f:ph.f,ill:Math.round(ph.illum*100),name:PHN[Math.floor(ph.f*8+0.5)%8]}; }catch(e){ return null; } }
function moonBox(body){
  var m=moonNow(); if(!m){ body.textContent=''; return; }
  var per=solToday(), sig=m.ill+'|'+per.length; if(body.dataset.sig===sig) return; body.dataset.sig=sig; body.replaceChildren();
  var top=E('div','fc2-moon'); var g=E('div'); g.innerHTML=moonSVG(m.f,56); top.appendChild(g.firstChild);
  var tx=E('div'); tx.append(E('b','',m.name),E('span','',T('Φωτισμός ','Illumination ')+m.ill+'%'));
  var d=fc&&fc.days&&fc.days[0]; if(d&&d.rise!=null) tx.append(E('span','',T('Ήλιος ','Sun ')+'↑ '+p2(Math.floor(d.rise/60))+':'+p2(Math.round(d.rise%60))+'  ↓ '+p2(Math.floor(d.set/60))+':'+p2(Math.round(d.set%60))));
  top.appendChild(tx); body.appendChild(top);
  if(per.length){ var l=E('div','fc2-per'); l.appendChild(E('span','ds-over',T('Περίοδοι σελήνης σήμερα (Knight)','Moon periods today (Knight)')));
    per.slice().sort(function(a,b){ return a.s-b.s; }).forEach(function(p){ var a=new Date(p.s), z=new Date(p.e); var c=E('span','ds-chip',(p.kind==='major'?T('Κύρια ','Major '):T('Δευτερεύουσα ','Minor '))+p2(a.getHours())+':'+p2(a.getMinutes())+'–'+p2(z.getHours())+':'+p2(z.getMinutes())); c.dataset.t=p.kind==='major'?'moon':'plain'; l.appendChild(c); });
    body.appendChild(l); }
  var wk=E('div','fc2-mweek'); for(var i=0;i<7;i++){ var t=Date.now()+i*86400000, ph; try{ ph=window.PF.moonPhase(t); }catch(e){ break; } var dd=new Date(t), c2=E('div'); c2.appendChild(E('span','',i?DN[dd.getDay()]:T('Σήμ.','Today'))); var gg=E('div'); gg.innerHTML=moonSVG(ph.f,24); c2.appendChild(gg.firstChild); c2.appendChild(E('small','',Math.round(ph.illum*100)+'%')); wk.appendChild(c2); }
  body.appendChild(wk);
  body.appendChild(E('p','ds-note',T('Η θεωρία solunar είναι παράδοση· οι μελέτες βρίσκουν μικρή επίδραση, γι’ αυτό μετράει λίγο στον βαθμό.','Solunar theory is tradition; studies find a small effect, so it weighs little in the score.')));
}
/* ---------- 7 μέρες ---------- */
function days(){
  var box=root.querySelector('.fc2-dlist'); if(!fc||!fc.days){ box.innerHTML=''; return; }
  var best=-1, bv=-1; fc.days.forEach(function(d,i){ if(d.safe&&d.best>bv){ bv=d.best; best=i; } });
  var sig=fc.days.map(function(d){ return d.date+d.best+d.safe; }).join(',')+'|'+JSON.stringify(openDay); if(box.dataset.sig===sig) return; box.dataset.sig=sig; box.replaceChildren();
  root.querySelector('.fc2-days .ds-sub').textContent=place&&place.name?place.name:'';
  fc.days.forEach(function(d,i){
    var w=d.wx||{}, dt=new Date(d.date+'T12:00:00Z'), r=E('div','fc2-day'+(openDay[d.date]?' open':''));
    var b=E('button','fc2-dayb'); b.type='button'; b.setAttribute('aria-expanded',String(!!openDay[d.date]));
    var name=i===0?T('Σήμερα','Today'):i===1?T('Αύριο','Tomorrow'):DN[dt.getUTCDay()]+' '+d.date.slice(8);
    b.innerHTML='<span class="fc2-dn"><b></b><small></small></span><span class="fc2-wx"></span><span class="fc2-dw"></span><span class="ds-conf"></span><span class="ds-score"></span>';
    b.querySelector('.fc2-dn b').innerHTML=''; b.querySelector('.fc2-dn b').textContent=name; if(i===best) b.querySelector('.fc2-dn b').insertAdjacentHTML('beforeend',' '+IC.star);
    b.querySelector('.fc2-dn small').textContent=d.win&&d.safe?p2(d.win.s)+':00–'+p2((d.win.e+1)%24)+':00':(d.safe?'':T('χωρίς ασφαλές παράθυρο','no safe window'));
    b.querySelector('.fc2-wx').innerHTML=wx(w.code);
    b.querySelector('.fc2-dw').textContent=[d.avgWind!=null?u('wind',d.avgWind)+(w.windDir!=null?' '+dir(w.windDir):''):'',d.avgWave!=null&&!isLake()?u('wave',d.avgWave):''].filter(Boolean).join(' · ');
    var cf=b.querySelector('.ds-conf'); cf.dataset.c=i<=1?2:i<=3?1:0; cf.title=[T('χαμηλή βεβαιότητα','low confidence'),T('μέτρια βεβαιότητα','medium confidence'),T('υψηλή βεβαιότητα','high confidence')][cf.dataset.c];
    var sc=b.querySelector('.ds-score'); sc.textContent=d.safe?String(d.best):'–'; sc.dataset.lv=d.safe?lvl(d.best):'none';
    b.addEventListener('click',function(){ openDay[d.date]=!openDay[d.date]; days(); });
    r.appendChild(b);
    if(openDay[d.date]){ var c=E('div','fc2-dayc'); var bars=E('div','fc2-mini'); d.hours.forEach(function(h){ var x=E('i'); x.style.setProperty('--v',h.score); if(!h.safe) x.dataset.k='bad'; else if(d.win&&h.hr>=d.win.s&&h.hr<=d.win.e) x.dataset.k='best'; x.title=p2(h.hr)+':00 · '+h.score; bars.appendChild(x); }); c.appendChild(bars);
      var ax=E('div','fc2-axis'); ['00','06','12','18','23'].forEach(function(x){ ax.appendChild(E('span','',x)); }); c.appendChild(ax);
      var facts=[]; if(w.tmin!=null&&w.tmax!=null) facts.push(u('temp',w.tmin)+' – '+u('temp',w.tmax)); if(w.gustMax!=null) facts.push(T('ριπές έως ','gusts up to ')+u('wind',w.gustMax)); if(w.waveMax!=null&&!isLake()) facts.push(T('κύμα έως ','waves up to ')+u('wave',w.waveMax));
      c.appendChild(E('p','ds-note',facts.join(' · ')));
      if(!d.safe){ var why=[]; if(w.windMax!=null&&w.windMax>14) why.push(T('άνεμος έως ','wind up to ')+u('wind',w.windMax)); if(w.waveMax!=null&&w.waveMax>0.9) why.push(T('κύμα έως ','waves up to ')+u('wave',w.waveMax)); if(w.code!=null&&w.code>=95) why.push(T('καταιγίδα','thunderstorm')); c.appendChild(E('p','ds-warn',T('Δεν υπάρχει ασφαλές παράθυρο','No safe window')+(why.length?': '+why.join(', '):'.'))); }
      r.appendChild(c); }
    box.appendChild(r);
  });
}
function paintActs(){
  var ra=$('fc2Radar'), src=$('fcRadar'); if(ra){ var c=C.getCond&&C.getCond(), ll=place&&place.lat!=null?[place.lat,place.lon]:(c&&c.lat!=null?[c.lat,c.lon]:null); ra.hidden=!ll; if(ll) ra.href='https://www.windy.com/-Weather-radar-radar?radar,'+(+ll[0]).toFixed(3)+','+(+ll[1]).toFixed(3)+',9'; }
  var be=$('fc2Bell'), wt=$('fcWatch'); if(be){ var on=!!(wt&&wt.getAttribute('aria-pressed')==='true'); be.hidden=!wt||wt.hidden; if(be.dataset.on!==String(on)){ be.dataset.on=String(on); be.innerHTML=on?IC.bell:IC.bellOff; } be.setAttribute('aria-pressed',String(on)); be.title=on?T('Ειδοποιήσεις: ενεργές','Alerts: on'):T('Ειδοποιήσεις: ανενεργές','Alerts: off'); be.setAttribute('aria-label',be.title); }
  var lp=root.querySelector('.fc2-loc span'), ch=document.querySelector('#tdLoc .chip[aria-pressed=true]'), t=ch?(ch.textContent||'').trim():T('Η θέση μου','My location'); if(lp.textContent!==t) lp.textContent=t;
}
function render(){
  if(!root&&!build()) return;
  var tab=$('tab-today'); if(!tab||tab.hidden) return;
  var tp=$('tdPress'), cb=root.querySelector('.fc2-chartbox'); if(tp&&cb&&tp.parentNode!==cb) cb.appendChild(tp);
  if(tp&&cb){ var mb=cb.querySelector('.fc2-more'); if(!mb){ mb=E('button','fc2-more'); mb.type='button'; mb.addEventListener('click',function(){ cb.classList.toggle('open'); mb.textContent=cb.classList.contains('open')?T('Λιγότερα','Less'):T('Αριθμοί και υπόμνημα','Numbers and legend'); }); mb.textContent=T('Αριθμοί και υπόμνημα','Numbers and legend'); }
    if(mb.parentNode!==cb||cb.lastChild!==mb) cb.appendChild(mb);
    var mt=tp.querySelectorAll(':scope>.meta'); [].forEach.call(mt,function(m){ m.classList.toggle('fc2-x',!/Σελήνη|Moon/.test(m.textContent)); }); var nt=tp.querySelector(':scope>p.note'); if(nt) nt.classList.add('fc2-x'); var ob=tp.querySelector('.ndmoreb'); if(ob) ob.hidden=true;
    [].forEach.call(mt,function(m){ var t=m.firstChild; if(t&&t.nodeType===3&&/^[\u{1F311}-\u{1F318}\u{1F319}\u{1F31A}-\u{1F31D}]\s*/u.test(t.nodeValue)) t.nodeValue=t.nodeValue.replace(/^[\u{1F311}-\u{1F318}\u{1F319}\u{1F31A}-\u{1F31D}]\s*/u,''); }); }
  try{ paintActs(); }catch(e){} try{ hero(); }catch(e){} try{ hours(); }catch(e){} try{ rows(); }catch(e){} try{ days(); }catch(e){}
}
/* όταν ανοίγει η καρτέλα «Πρόγνωση», να υπάρχει πρόγνωση για 7 μέρες και ώρες */
function ensure(){ if(!fc&&window.AlkyonPlaces&&window.AlkyonPlaces.view) try{ window.AlkyonPlaces.view(); }catch(e){} }
var n=0, iv=setInterval(function(){ n++; if(build()||n>40){ clearInterval(iv); render(); } },300);
(window.ndEvery||function(f,m){ return setInterval(f,m); })(render,1000);
document.addEventListener('click',function(){ setTimeout(render,60); },true);
try{ var tf=$('tab-fc'); if(tf) new MutationObserver(function(){ if(!tf.hidden){ var s=document.querySelector('#fcSeg button[aria-pressed=true]'); fcSeg(s?s.dataset.s:'mine'); } }).observe(tf,{attributes:true,attributeFilter:['hidden']}); }catch(e){}
document.addEventListener('alkyon-cond',function(){ setTimeout(render,50); });
window.AlkyonFC2={render:render,go:go,mode:setMode};
})();

/* η καρτέλα «Πρόγνωση» της κάτω μπάρας ανοίγει πάντα στο «Σήμερα» */
(function(){ var nb=document.querySelector('nav.tabs button[data-tab=fc]'); if(nb) nb.addEventListener('click',function(){ var td=document.getElementById('tab-today'), tf=document.getElementById('tab-fc'); if(td&&tf&&td.hidden&&tf.hidden&&window.AlkyonFC2&&window.AlkyonFC2.mode) window.AlkyonFC2.mode('today'); },true); })();
