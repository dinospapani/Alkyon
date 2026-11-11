/* Πίεση και άνεμος γύρω από το πιάσιμο (±30 λεπτά, γράφημα ±3 ωρών) και σελήνη στην κάρτα κάθε ψαριού.
   Τα δεδομένα είναι ωριαία από μοντέλο (Open-Meteo), με παρεμβολή ανά 30 λεπτά. Δεν είναι μέτρηση στο σημείο.
   Αποθηκεύονται στο ψάρι ως b.wx. Η σελήνη υπολογίζεται από την ακριβή ώρα του ψαριού. */
(function(){
'use strict';
var C={get Store(){ return window.AlkyonCore&&window.AlkyonCore.Store; }, get toast(){ return (window.AlkyonCore&&window.AlkyonCore.toast)||function(){}; }, biteMs:function(b){ return window.AlkyonCore.biteMs(b); }};
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var HOUR=3600000, DAY=86400000, MIN=60000, K=6, N=2*K+1;
var SYN=29.530588853, REF=Date.UTC(2000,0,6,18,14);
var MOON=EN?['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent']
           :['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα','Πανσέληνος','Φθίνουσα','Τελευταίο τέταρτο','Φθίνων μηνίσκος'];
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dn(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; }
function num(v){ return (typeof v==='number'&&isFinite(v))?v:null; }
function r1(v){ return v==null?null:Math.round(v*10)/10; }
function moonAt(ms){ var a=((ms-REF)/DAY)%SYN; if(a<0) a+=SYN; var f=a/SYN; return {i:Math.floor(f*8+0.5)%8,illum:(1-Math.cos(2*Math.PI*f))/2,age:a}; }
function moonTxt(ms){ var m=moonAt(ms); return '🌙 '+MOON[m.i]+' · '+T('φωτισμός ','illumination ')+Math.round(m.illum*100)+'% · '+T('ηλικία ','age ')+m.age.toFixed(1)+T(' ημέρες',' days'); }

/* ---------- δεδομένα ---------- */
function getJson(url){
  var ac=('AbortController' in window)?new AbortController():null, t=setTimeout(function(){ if(ac) ac.abort(); },14000);
  return fetch(url,ac?{signal:ac.signal}:{}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).finally(function(){ clearTimeout(t); });
}
function iso(ms){ return new Date(ms).toISOString().slice(0,10); }
function lin(tm,arr,x){
  for(var i=0;i<tm.length-1;i++){ if(tm[i]<=x&&x<=tm[i+1]){ var a=num(arr[i]), b=num(arr[i+1]); if(a==null||b==null) return null; var f=(x-tm[i])/(tm[i+1]-tm[i]); return a+(b-a)*f; } }
  return null;
}
function ang(tm,arr,x){
  for(var i=0;i<tm.length-1;i++){ if(tm[i]<=x&&x<=tm[i+1]){ var a=num(arr[i]), b=num(arr[i+1]); if(a==null||b==null) return null; var f=(x-tm[i])/(tm[i+1]-tm[i]), r=Math.PI/180;
    var sx=Math.sin(a*r)*(1-f)+Math.sin(b*r)*f, cx=Math.cos(a*r)*(1-f)+Math.cos(b*r)*f; if(Math.abs(sx)+Math.abs(cx)<1e-6) return null; return ((Math.atan2(sx,cx)/r)+360)%360; } }
  return null;
}
/* Επιστρέφει Promise<wx|null>. Απορρίπτεται αν αποτύχει το δίκτυο, επιστρέφει null αν δεν υπάρχουν δεδομένα. */
function fetchWx(lat,lon,ms){
  if(typeof lat!=='number'||typeof lon!=='number'||!(ms>0)||ms>Date.now()+10*MIN) return Promise.resolve(null);
  var t0=ms-4*HOUR, t1=ms+4*HOUR, age=Date.now()-t0, recent=age<85*DAY, past=Math.min(92,Math.ceil(age/DAY)+1);
  var pos='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&timezone=GMT', hv='pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m';
  var url=recent?'https://api.open-meteo.com/v1/forecast?'+pos+'&hourly='+hv+'&past_days='+past+'&forecast_days=2&wind_speed_unit=kn'
                :'https://archive-api.open-meteo.com/v1/archive?'+pos+'&hourly='+hv+'&start_date='+iso(t0)+'&end_date='+iso(t1)+'&wind_speed_unit=kn';
  return getJson(url).then(function(j){
    var h=(j&&j.hourly)||{}, tm=(h.time||[]).map(function(t){ return Date.parse(t+'Z'); });
    if(!tm.length) return null;
    var P=[],W=[],G=[],D=[];
    for(var k=-K;k<=K;k++){ var x=ms+k*30*MIN;
      P.push(r1(lin(tm,h.pressure_msl||[],x))); W.push(r1(lin(tm,h.wind_speed_10m||[],x))); G.push(r1(lin(tm,h.wind_gusts_10m||[],x)));
      var d=ang(tm,h.wind_direction_10m||[],x); D.push(d==null?null:Math.round(d)); }
    if(P.every(function(v){ return v==null; })&&W.every(function(v){ return v==null; })) return null;
    return {v:1,t0:ms,la:Math.round(lat*1000)/1000,lo:Math.round(lon*1000)/1000,p:P,w:W,g:G,d:D,fc:ms+3*HOUR>Date.now()};
  });
}
function valid(b){ var w=b&&b.wx; return !!(w&&w.v===1&&w.t0===C.biteMs(b)&&typeof b.lat==='number'&&Math.abs(w.la-b.lat)<0.003&&Math.abs(w.lo-b.lon)<0.003); }

/* ---------- ουρά φόρτωσης ---------- */
var q=[], running=false, tried={};
function save(b,patch){
  var cur=(C.Store.get('bites')||[]).find(function(x){ return x.id===b.id; }); if(!cur) return Promise.resolve();
  return C.Store.save('bites',Object.assign({},cur,patch));
}
function pump(){
  if(running||!q.length) return; running=true; var b=q.shift();
  fetchWx(b.lat,b.lon,C.biteMs(b)).then(function(wx){
    if(wx) return save(b,{wx:wx,wxNA:false});
    return save(b,{wxNA:true});
  }).catch(function(){ tried[b.id]=0; }).then(function(){ running=false; setTimeout(pump,350); });
}
function enqueue(b,force){
  if(typeof b.lat!=='number'||typeof b.lon!=='number') return;
  if(tried[b.id]&&!force) return; tried[b.id]=1;
  if(!q.some(function(x){ return x.id===b.id; })) q.push(b); pump();
}
function eligible(b){ var ms=C.biteMs(b); return typeof b.lat==='number'&&typeof b.lon==='number'&&ms<=Date.now()+10*MIN; }

/* ---------- κείμενα ---------- */
function W(kn){ try{ return window.AlkyonUnits.wind(kn); }catch(e){ return Math.round(kn)+' kn'; } }
function PR(h){ try{ return window.AlkyonUnits.press(h); }catch(e){ return Math.round(h*10)/10+' hPa'; } }
function sgn(v){ return v>0?'+':v<0?'−':''; }
function dPress(a,b){ if(a==null||b==null) return null; var d=b-a; var c=window.AlkyonUnits&&window.AlkyonUnits.cfg&&window.AlkyonUnits.cfg.press, u='hPa', k=1; if(c==='inhg'){ u='inHg'; k=0.02953; } else if(c==='mmhg'){ u='mmHg'; k=0.750062; }
  var x=d*k, dec=c==='inhg'?2:1; return sgn(Math.round(x*Math.pow(10,dec))/Math.pow(10,dec))+Math.abs(x).toFixed(dec)+' '+u; }
function dWind(a,b){ if(a==null||b==null) return null; var c=window.AlkyonUnits&&window.AlkyonUnits.cfg&&window.AlkyonUnits.cfg.wind, d=b-a;
  if(c==='bft'){ var bf=window.AlkyonUnits.bft, x=bf(b)-bf(a); return (x===0?'±0':sgn(x)+Math.abs(x))+' Bft'; }
  var k=c==='kmh'?1.852:c==='ms'?0.514444:c==='mph'?1.15078:1, u=c==='kmh'?'km/h':c==='ms'?'m/s':c==='mph'?'mph':'kn', x2=Math.round(d*k*10)/10;
  return (x2===0?'±0':sgn(x2)+Math.abs(x2))+' '+u; }
function turn(a,b){ if(a==null||b==null) return null; var d=((b-a+540)%360)-180; return d; }
function pt(wx,i){ return {p:wx.p[i],w:wx.w[i],g:wx.g[i],d:wx.d[i]}; }
function lineAt(lbl,x){
  var s=[]; if(x.p!=null) s.push(PR(x.p)); if(x.w!=null) s.push((x.d!=null&&x.w>=2?dn(x.d)+' ':'')+W(x.w)+(x.g!=null&&x.g>=x.w+4?' ('+T('ριπές ','gusts ')+W(x.g)+')':'')); return lbl+' '+s.join(' · ');
}
function brief(wx){
  var a=pt(wx,K-1), b=pt(wx,K+1), s=[];
  var dp=dPress(a.p,b.p); if(dp) s.push(T('Πίεση ','Pressure ')+dp);
  var dw=dWind(a.w,b.w); if(dw) s.push(T('Άνεμος ','Wind ')+dw);
  var tr=(a.d!=null&&b.d!=null&&a.w>=3&&b.w>=3)?turn(a.d,b.d):null; if(tr!=null&&Math.abs(tr)>=20) s.push(T('στροφή ','shift ')+Math.abs(Math.round(tr))+'°');
  return s.join(' · ');
}
function hhmm(ms,b){ var off=b.tz!=null?b.tz:null; if(off==null) return new Date(ms).toISOString().slice(11,16); return new Date(ms+off*MIN).toISOString().slice(11,16); }

/* ---------- γράφημα ---------- */
function chart(wx,b){
  var ns='http://www.w3.org/2000/svg', Wd=320, L=6, R=28, TP=10, H1=64, GAP=18, H2=52, AR=16, BT=14, Ht=TP+H1+GAP+H2+AR+BT;
  var mk=function(tag,at){ var e=document.createElementNS(ns,tag); Object.keys(at).forEach(function(k){ e.setAttribute(k,at[k]); }); return e; };
  var cs=getComputedStyle(document.documentElement), line=(cs.getPropertyValue('--sea')||'#2b7a8c').trim()||'#2b7a8c', mut=(cs.getPropertyValue('--muted')||'#6b7c86').trim()||'#6b7c86', ink=(cs.getPropertyValue('--ink')||'#999').trim()||'#999', wcol='#e8743b';
  var X=function(i){ return L+(Wd-L-R)*i/(N-1); };
  var pv=wx.p.filter(function(v){ return v!=null; }), pmn=pv.length?Math.min.apply(null,pv):1013, pmx=pv.length?Math.max.apply(null,pv):1013;
  if(pmx-pmn<2){ var m=(pmx+pmn)/2; pmn=m-1; pmx=m+1; }
  var Y1=function(v){ return TP+H1*(1-(v-pmn)/(pmx-pmn)); };
  var wTop=TP+H1+GAP, wv=wx.w.concat(wx.g).filter(function(v){ return v!=null; }), wmx=Math.max(8,Math.ceil((wv.length?Math.max.apply(null,wv):8)/2)*2);
  var Y2=function(v){ return wTop+H2*(1-v/wmx); };
  var svg=document.createElementNS(ns,'svg'); svg.setAttribute('viewBox','0 0 '+Wd+' '+Ht); svg.setAttribute('role','img'); svg.setAttribute('aria-label',T('Πίεση και άνεμος γύρω από το πιάσιμο','Pressure and wind around the catch')); svg.style.cssText='width:100%;height:auto;display:block;margin-top:6px';
  var txt=function(x,y,t,anc,sz,fill){ var e=mk('text',{x:x,y:y,'text-anchor':anc||'end','font-size':sz||8,fill:fill||mut}); e.textContent=t; svg.append(e); };
  svg.append(mk('rect',{x:X(K-1),y:TP-4,width:X(K+1)-X(K-1),height:Ht-BT-TP+2,fill:ink,'fill-opacity':.12}));
  svg.append(mk('line',{x1:X(K),x2:X(K),y1:TP-4,y2:Ht-BT-2,stroke:ink,'stroke-width':1,'stroke-dasharray':'3 2'}));
  var PU=window.AlkyonUnits, pl=function(h){ try{ return PU.pressP(h)[0]; }catch(e){ return Math.round(h); } }, wl=function(k){ try{ return PU.windP(k)[0]; }catch(e){ return Math.round(k); } };
  txt(L,TP-2,(PU&&PU.label?PU.label('press'):'hPa'),'start',8);
  [pmn,pmx].forEach(function(g){ svg.append(mk('line',{x1:L,x2:Wd-R,y1:Y1(g),y2:Y1(g),stroke:mut,'stroke-opacity':.25,'stroke-width':.5})); txt(Wd-R+3,Y1(g)+3,String(pl(g)),'start',8); });
  var path=function(arr,f){ var d='',pen=false; for(var i=0;i<arr.length;i++){ if(arr[i]==null){ pen=false; continue; } d+=(pen?'L':'M')+X(i).toFixed(1)+' '+f(arr[i]).toFixed(1); pen=true; } return d; };
  svg.append(mk('path',{d:path(wx.p,Y1),fill:'none',stroke:line,'stroke-width':2.2,'stroke-linejoin':'round','stroke-linecap':'round'}));
  [K-1,K+1].forEach(function(i){ if(wx.p[i]!=null) svg.append(mk('circle',{cx:X(i),cy:Y1(wx.p[i]),r:3.2,fill:line,stroke:'#fff','stroke-width':1})); });
  txt(L,wTop-4,(PU&&PU.label?PU.label('wind'):'kn'),'start',8,wcol);
  [0,wmx/2,wmx].forEach(function(g){ svg.append(mk('line',{x1:L,x2:Wd-R,y1:Y2(g),y2:Y2(g),stroke:mut,'stroke-opacity':.25,'stroke-width':.5})); txt(Wd-R+3,Y2(g)+3,String(wl(g)),'start',8,wcol); });
  var wd=path(wx.w,Y2); if(wd) svg.append(mk('path',{d:wd,fill:'none',stroke:wcol,'stroke-width':2.2,'stroke-linejoin':'round','stroke-linecap':'round'}));
  if(wx.g.some(function(v){ return v!=null; })) svg.append(mk('path',{d:path(wx.g,Y2),fill:'none',stroke:wcol,'stroke-width':1.2,'stroke-dasharray':'1.5 2.5','stroke-opacity':.9}));
  [K-1,K+1].forEach(function(i){ if(wx.w[i]!=null) svg.append(mk('circle',{cx:X(i),cy:Y2(wx.w[i]),r:3.2,fill:wcol,stroke:'#fff','stroke-width':1})); });
  for(var i=0;i<N;i+=2){ if(wx.d[i]==null||(wx.w[i]||0)<2) continue; var g=mk('g',{transform:'translate('+X(i).toFixed(1)+','+(wTop+H2+9)+') rotate('+wx.d[i]+')'}); g.append(mk('path',{d:'M0,-5 L0,5 M-3,2 L0,5 L3,2',fill:'none',stroke:wcol,'stroke-width':1.4,'stroke-linecap':'round','stroke-linejoin':'round'})); svg.append(g); }
  [[0,'start'],[K,'middle'],[N-1,'end']].forEach(function(q2){ txt(q2[1]==='end'?Wd-R:X(q2[0]),Ht-3,hhmm(wx.t0+(q2[0]-K)*30*MIN,b),q2[1]==='end'?'end':q2[1],8); });
  txt(X(K),TP-3,'±30′','middle',8,ink);
  /* 1.12.12: με «Ώρες που τσιμπούσαν»: δεύτερη γραμμή εκεί που σταμάτησαν (και ελαφριά σκίαση για όλο το παράθυρο) */
  try{ var bw=window.AK&&window.AK.biteWin&&window.AK.biteWin.span?window.AK.biteWin.span(b):null;
    if(bw){ var xs=K+(bw.a-wx.t0)/(30*MIN), xe=K+(bw.e-wx.t0)/(30*MIN), stop='#d6453a';
      var cx=function(i){ return X(Math.max(0,Math.min(N-1,i))); };
      if(xe>0&&xs<N-1) svg.insertBefore(mk('rect',{x:cx(xs),y:TP-4,width:Math.max(0,cx(xe)-cx(xs)),height:Ht-BT-TP+2,fill:'#3dbe85','fill-opacity':.08}),svg.firstChild);
      if(xe>=0&&xe<=N-1){ svg.append(mk('line',{x1:X(xe),x2:X(xe),y1:TP-4,y2:Ht-BT-2,stroke:stop,'stroke-width':1.4,'stroke-dasharray':'4 2'}));
        txt(Math.min(X(xe),Wd-R-2),TP-3,T('σταμάτησαν ','stopped ')+hhmm(bw.e,b),xe>N-3?'end':'middle',8,stop); }
      else if(xe>N-1) txt(Wd-R,TP-3,T('σταμάτησαν ','stopped ')+hhmm(bw.e,b)+' →','end',8,stop); } }catch(e){}
  return svg;
}

/* ---------- κάρτα ---------- */
var openIds={};
var st=document.createElement('style'); st.textContent='.bwx{margin-top:6px}.bwx details>summary{cursor:pointer;font-size:13px;color:var(--muted,#6b7c86);padding:4px 0;list-style:none}.bwx details>summary::before{content:"▸ ";}.bwx details[open]>summary::before{content:"▾ ";}.bwx .bwl{font-size:13px;margin:2px 0}.bwx .bwn{font-size:11.5px;color:var(--muted,#6b7c86);margin-top:4px}';
document.head.appendChild(st);
function build(b,box){
  box.replaceChildren();
  var ms=C.biteMs(b), ok=valid(b), wx=ok?b.wx:null;
  var d=document.createElement('details'); if(openIds[b.id]) d.open=true;
  var sm=document.createElement('summary');
  var head=T('Πίεση και άνεμος ±30′','Pressure & wind ±30′');
  if(wx){ sm.textContent=head+': '+(brief(wx)||T('χωρίς αλλαγή','no change')); }
  else if(typeof b.lat!=='number') sm.textContent=T('Σελήνη','Moon')+': '+MOON[moonAt(ms).i];
  else if(b.wxNA) sm.textContent=head+': '+T('δεν βρέθηκαν δεδομένα','no data found');
  else if(tried[b.id]) sm.textContent=head+': '+T('φορτώνει…','loading…');
  else sm.textContent=head+' ('+T('πάτα για φόρτωση','tap to load')+')';
  d.append(sm);
  var body=document.createElement('div');
  if(wx){
    var a=pt(wx,K-1), c=pt(wx,K), e=pt(wx,K+1), f0=pt(wx,0), f1=pt(wx,N-1);
    body.append(line2(lineAt('−30′:',a)),line2(lineAt(T('Πιάσιμο:','Catch:'),c)),line2(lineAt('+30′:',e)));
    var tr=(a.d!=null&&e.d!=null&&a.w>=3&&e.w>=3)?turn(a.d,e.d):null;
    var ch=[]; var dp=dPress(a.p,e.p); if(dp) ch.push(T('πίεση ','pressure ')+dp); var dw=dWind(a.w,e.w); if(dw) ch.push(T('άνεμος ','wind ')+dw);
    if(tr!=null) ch.push(Math.abs(tr)<20?T('ίδια διεύθυνση','same direction'):T('διεύθυνση ','direction ')+dn(a.d)+' → '+dn(e.d)+' ('+Math.abs(Math.round(tr))+'° '+(tr>0?T('δεξιόστροφα','clockwise'):T('αριστερόστροφα','counter-clockwise'))+')');
    if(ch.length){ var l=line2(T('Αλλαγή: ','Change: ')+ch.join(' · ')); l.style.fontWeight='600'; body.append(l); }
    var p3=dPress(f0.p,c.p), p3b=dPress(c.p,f1.p);
    if(p3||p3b) body.append(line2(T('Πίεση: 3 ώρες πριν ','Pressure: 3 h before ')+(p3||'–')+T(' · 3 ώρες μετά ',' · 3 h after ')+(p3b||'–')));
    body.append(chart(wx,b));
    var n=document.createElement('div'); n.className='bwn'; n.textContent=T('Ωριαία δεδομένα μοντέλου με παρεμβολή ανά 30 λεπτά. Ενδεικτικά, όχι μέτρηση στο σημείο. Πάνω: πίεση. Κάτω: άνεμος (διακεκομμένη = ριπές, βέλη = προς πού πηγαίνει ο άνεμος). Η σκιασμένη ζώνη είναι ±30′ από το πιάσιμο.','Hourly model data interpolated every 30 minutes. Indicative, not measured on the spot. Top: pressure. Bottom: wind (dotted = gusts, arrows = where the wind goes). The shaded band is ±30′ around the catch.')+(wx.fc?T(' Περιλαμβάνει πρόγνωση, θα ανανεωθεί.',' Includes forecast, will refresh.'):''); body.append(n);
  } else if(b.wxNA){ body.append(line2(T('Δεν βρέθηκαν δεδομένα για αυτή την ώρα και θέση.','No data found for this time and place.'))); }
  var mo=line2(moonTxt(ms)); mo.style.marginTop='6px'; body.append(mo);
  d.append(body); box.append(d);
  d.addEventListener('toggle',function(){ if(d.open){ openIds[b.id]=1; if(!valid(b)&&eligible(b)&&!b.wxNA){ tried[b.id]=0; enqueue(b,true); sm.textContent=head+': '+T('φορτώνει…','loading…'); } } else delete openIds[b.id]; });
}
function line2(t){ var p=document.createElement('div'); p.className='bwl'; p.textContent=t; return p; }
function slot(b){
  var box=document.createElement('div'); box.className='bwx'; build(b,box);
  var ms=C.biteMs(b);
  if(!valid(b)&&eligible(b)&&!b.wxNA&&Date.now()-ms<36*HOUR) enqueue(b);
  else if(valid(b)&&b.wx.fc&&Date.now()>ms+4*HOUR&&!tried[b.id+'f']){ tried[b.id+'f']=1; enqueue(b,true); }
  return box;
}
function ensure(b){ if(b&&eligible(b)) enqueue(b,true); }

/* ---------- μαζική συμπλήρωση (ρυθμίσεις θάλασσας) ---------- */
(window.AlkyonSeaRows=window.AlkyonSeaRows||[]).push(function(){
  function todo(){ return ((C.Store.raw?C.Store.raw('bites'):C.Store.get('bites'))||[]).filter(function(b){ return eligible(b)&&!b.gear&&!valid(b)&&!b.wxNA; }); }
  var r=document.createElement('div'); r.className='sprow'; var x=document.createElement('div'); x.className='sptx';
  var b1=document.createElement('b'); b1.textContent=T('Πίεση και άνεμος γύρω από τα ψάρια','Pressure and wind around catches');
  var sp=document.createElement('span'); function txt(){ var n=todo().length; if(typeof bt!=='undefined'&&bt) bt.hidden=!n; sp.textContent=n?T('Υπάρχουν '+n+' ψάρια με θέση χωρίς γράφημα πίεσης και ανέμου ±30 λεπτά. Θα συμπληρωθούν με εκτίμηση μοντέλου.','There are '+n+' catches with a position but no pressure/wind chart (±30 min). They will be filled with a model estimate.'):T('Όλα τα ψάρια με θέση έχουν τα στοιχεία.','All catches with a position have the data.'); }
  txt(); x.append(b1,sp);
  var bt=document.createElement('button'); bt.type='button'; bt.className='spb acc'; bt.textContent=T('Συμπλήρωση','Fill in'); bt.hidden=!todo().length;
  bt.addEventListener('click',function(){
    var list=todo(); if(!list.length){ C.toast(T('Δεν υπάρχει κάτι να συμπληρωθεί.','Nothing to fill in.')); return; }
    bt.disabled=true; var done=0,i=0;
    (function next(){
      if(i>=list.length){ bt.disabled=false; bt.textContent=T('Συμπλήρωση','Fill in'); txt(); C.toast(T('Συμπληρώθηκαν '+done+' από '+list.length+'.','Filled '+done+' of '+list.length+'.')); return; }
      var b=list[i++]; bt.textContent=i+'/'+list.length+'…';
      fetchWx(b.lat,b.lon,C.biteMs(b)).then(function(wx){ return save(b,wx?{wx:wx,wxNA:false}:{wxNA:true}).then(function(){ if(wx) done++; }); }).catch(function(){}).then(function(){ setTimeout(next,400); });
    })();
  });
  r.append(x,bt); r.dataset.k='wxfill'; return r;
});

window.AlkyonBiteWx={slot:slot,ensure:ensure,fetch:fetchWx,moon:moonAt};
})();
