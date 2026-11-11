/* Alkyon 4 · 1.12.15: Παλίρροια (στάθμη θάλασσας) στην Πρόγνωση.
   Ωριαία στάθμη από το Open-Meteo Marine (sea_level_height_msl), ψηλές/χαμηλές με παρεμβολή, και πώς πέφτει η καλύτερη ώρα σου.
   Στη Μεσόγειο η παλίρροια είναι μικρή· η στάθμη του μοντέλου περιλαμβάνει και την επίδραση πίεσης/ανέμου. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, HOUR=3600000, cache={};
function num(v){ return typeof v==='number'&&isFinite(v)?v:null; }
function pad(n){ return (n<10?'0':'')+n; }
/* ωριαία στάθμη για τη θέση (τοπική ώρα της τοποθεσίας, όπως η πρόγνωση) */
function load(lat,lon){ var k=lat.toFixed(2)+','+lon.toFixed(2), c=cache[k]; if(c&&Date.now()-c.t<3*HOUR) return c.p;
  var u='https://marine-api.open-meteo.com/v1/marine?latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&hourly=sea_level_height_msl&timezone=auto&past_days=1&forecast_days=8&cell_selection=sea';
  var p=fetch(u).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(j){ var hh=j&&j.hourly; if(!hh||!hh.time) return null;
    var t=hh.time, v=hh.sea_level_height_msl||[]; if(!v.some(function(x){ return num(x)!=null; })) return null; return {t:t,v:v}; });
  cache[k]={t:Date.now(),p:p}; p.catch(function(){ delete cache[k]; }); return p; }
/* ψηλές/χαμηλές μιας μέρας: τοπικά μέγιστα/ελάχιστα με παραβολική παρεμβολή (ώρα με λεπτά) */
function extrema(S,date){ var out=[], t=S.t, v=S.v;
  for(var i=1;i<t.length-1;i++){ if(t[i].slice(0,10)!==date) continue;
    var a=num(v[i-1]), b=num(v[i]), c=num(v[i+1]); if(a==null||b==null||c==null) continue;
    var hi=b>a&&b>=c, lo=b<a&&b<=c; if(!hi&&!lo) continue;
    var den=a-2*b+c, off=den?0.5*(a-c)/den:0; off=Math.max(-0.5,Math.min(0.5,off)); var lvl=b-0.25*(a-c)*off;
    var hr=+t[i].slice(11,13)+off, m=Math.round(hr*60); if(m<0||m>=1440) continue;
    out.push({hi:hi,m:m,lvl:lvl}); }
  return out; }
function dayVals(S,date){ var a=[]; S.t.forEach(function(ts,i){ if(ts.slice(0,10)===date&&num(S.v[i])!=null) a.push({h:+ts.slice(11,13),v:S.v[i]}); }); return a; }
function hm(m){ return pad(Math.floor(m/60))+':'+pad(m%60); }
function cm(x){ return Math.round(x*100); }
/* τάση μέσα στο παράθυρο s..e (ώρες) */
function trend(S,date,s,e){ var d=dayVals(S,date), at=function(hh){ var q=d.filter(function(x){ return x.h===hh; })[0]; return q?q.v:null; };
  var a=at(s), b=at(Math.min(23,e+1)); if(a==null||b==null) return null; var ex=extrema(S,date).filter(function(x){ return x.m>s*60+20&&x.m<(e+1)*60-20; });
  if(ex.length) return {k:'turn',x:ex[0]}; var dd=b-a; return {k:Math.abs(dd)<0.01?'slack':dd>0?'up':'down',d:dd}; }
function svg(S,date,ex,nowM,win){ var d=dayVals(S,date); if(d.length<6) return null; var W=320, H=96, P=8;
  var vs=d.map(function(x){ return x.v; }), mn=Math.min.apply(null,vs), mx=Math.max.apply(null,vs); if(mx-mn<0.02){ mx+=0.01; mn-=0.01; }
  var X=function(m){ return P+(W-2*P)*m/1440; }, Y=function(v){ return H-P-14-(H-2*P-14)*(v-mn)/(mx-mn); };
  var path=d.map(function(q,i){ return (i?'L':'M')+X(q.h*60).toFixed(1)+' '+Y(q.v).toFixed(1); }).join(' ');
  var s='<svg class="tdsvg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="'+T('Στάθμη θάλασσας μέσα στη μέρα','Sea level through the day')+'">';
  if(win) s+='<rect x="'+X(win.s*60)+'" y="'+P+'" width="'+(X((win.e+1)*60)-X(win.s*60))+'" height="'+(H-2*P-14)+'" fill="#3dbe85" opacity=".14"/>';
  s+='<path d="'+path+' L'+X(d[d.length-1].h*60)+' '+(H-P-14)+' L'+X(d[0].h*60)+' '+(H-P-14)+'Z" fill="var(--sea,#4FB3D9)" opacity=".18"/>';
  s+='<path d="'+path+'" fill="none" stroke="var(--sea,#4FB3D9)" stroke-width="2.4" stroke-linejoin="round"/>';
  ex.forEach(function(x){ s+='<circle cx="'+X(x.m)+'" cy="'+Y(x.lvl)+'" r="3.6" fill="'+(x.hi?'var(--sea,#4FB3D9)':'var(--surface,#fff)')+'" stroke="var(--sea,#4FB3D9)" stroke-width="2"/>'; });
  if(nowM!=null) s+='<line x1="'+X(nowM)+'" x2="'+X(nowM)+'" y1="'+P+'" y2="'+(H-P-14)+'" stroke="var(--ink-2,#666)" stroke-width="1.2" stroke-dasharray="3 3"/>';
  [0,6,12,18].forEach(function(hh){ s+='<text x="'+X(hh*60)+'" y="'+(H-2)+'" font-size="10" fill="var(--ink-3,#888)">'+pad(hh)+'</text>'; });
  return s+'</svg>'; }
/* κάρτα: επιστρέφει {el, hint(cb)} — το περιεχόμενο φορτώνει μόνο του */
B.tideCard=function(place,date,win,isToday,onHint){
  var box=h('div',{class:'tide'}); if(!place||typeof place.lat!=='number'){ return null; }
  box.append(h('p',{class:'sub',text:T('Φόρτωση…','Loading…')}));
  load(place.lat,place.lon).then(function(S){ box.replaceChildren(); if(!S){ box.append(h('p',{class:'sub',text:T('Δεν υπάρχουν δεδομένα στάθμης για αυτό το σημείο.','No sea-level data for this place.')})); if(onHint) onHint(''); return; }
    var ex=extrema(S,date), d=dayVals(S,date); if(!d.length){ box.append(h('p',{class:'sub',text:T('Δεν υπάρχουν δεδομένα για αυτή τη μέρα.','No data for this day.')})); return; }
    var vs=d.map(function(x){ return x.v; }), rng=cm(Math.max.apply(null,vs)-Math.min.apply(null,vs)), now=new Date(), nowM=isToday?now.getHours()*60+now.getMinutes():null;
    var sv=svg(S,date,ex,nowM,win); if(sv) box.append(h('div',{class:'tdch',html:sv}));
    var mean=vs.reduce(function(a,b){ return a+b; },0)/vs.length; /* οι τιμές φαίνονται σε σχέση με τη μέση στάθμη της μέρας */
    var row=h('div',{class:'tdx'}); ex.forEach(function(x){ row.append(h('span',{class:'tdi'+(x.hi?' hi':' lo')+(nowM!=null&&x.m<nowM?' past':'')},h('small',{text:x.hi?T('Ψηλή','High'):T('Χαμηλή','Low')}),h('b',{text:hm(x.m)}),h('small',{text:(cm(x.lvl-mean)>0?'+':'')+cm(x.lvl-mean)+' cm'}))); });
    if(ex.length) box.append(row);
    var tr=win?trend(S,date,win.s,win.e):null, wl=win?pad(win.s)+':00–'+pad((win.e+1)%24)+':00':'';
    if(tr) box.append(h('p',{class:'tdw'},h('b',{text:T('Καλύτερη ώρα ','Best time ')+wl+': '}),tr.k==='turn'?(tr.x.hi?T('η στάθμη φτάνει στο ψηλό της γύρω στις ','the level peaks around ')+hm(tr.x.m)+T(' (νεκρό νερό, μετά άμπωτη).',' (slack water, then falling).'):T('η στάθμη φτάνει στο χαμηλό της γύρω στις ','the level bottoms out around ')+hm(tr.x.m)+T(' (νεκρό νερό, μετά πλημμυρίδα).',' (slack water, then rising).'))
      :tr.k==='up'?T('η στάθμη ανεβαίνει (πλημμυρίδα).','the level is rising (flood).'):tr.k==='down'?T('η στάθμη πέφτει (άμπωτη).','the level is falling (ebb).'):T('η στάθμη σχεδόν δεν κινείται.','the level barely moves.')));
    box.append(h('p',{class:'foot',text:T('Διαφορά μέσα στη μέρα: ','Range during the day: ')+rng+' cm. '+T('Στη Μεσόγειο η παλίρροια είναι μικρή· η στάθμη του μοντέλου (Open-Meteo) περιλαμβάνει και την επίδραση πίεσης και ανέμου. Σημειώνεις στα ψάρια σου αν τσιμπούσαν σε άνοδο ή πτώση, και το Alkyon το λαμβάνει υπόψη.','Tides are small in the Mediterranean; the model level (Open-Meteo) also includes the effect of pressure and wind. Your catches record whether the level was rising or falling, and Alkyon takes that into account.')}));
    if(onHint){ var nx=ex.filter(function(x){ return nowM==null||x.m>=nowM; }).slice(0,2); onHint(nx.map(function(x){ return (x.hi?T('ψηλή ','high '):T('χαμηλή ','low '))+hm(x.m); }).join(' · ')+(nx.length?' · ':'')+rng+' cm'); }
  }).catch(function(){ box.replaceChildren(h('p',{class:'sub',text:T('Δεν φόρτωσε. Έλεγξε τη σύνδεση.','Could not load. Check your connection.')})); });
  return box; };
B.tideExtrema=extrema;
})();
