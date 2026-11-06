/* Alkyon 4 · Σύγκριση χρονιών (v31z540)
   Οι τελευταίες 30 μέρες σε σχέση με τις ίδιες μέρες των προηγούμενων 10 χρόνων, για την τοποθεσία της Πρόγνωσης:
   νερό, αέρας, άνεμος, κύμα, βροχή. Τι ακολούθησε τις επόμενες 30 μέρες εκείνες τις χρονιές, ποια χρονιά μοιάζει περισσότερο,
   τα ψάρια σου ανά χρονιά και προτάσεις (εκτιμήσεις, όχι βεβαιότητα).
   Πηγές: Open-Meteo archive (ERA5, ιστορικός καιρός), Open-Meteo marine (κύμα και νερό, όσο πίσω φτάνει), Open-Meteo forecast (πρόσφατες μέρες). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var NY=10, WIN=30, CK='alkyon-v4-years';
/* [κλειδί, όνομα, σύντομο όνομα για τα κουμπιά] · «μέρες ανέμου» = μέρες με μέγιστο άνεμο πάνω από το όριό σου */
var MET=[['sst',T('Νερό','Water'),T('Νερό','Water')],['ta',T('Αέρας','Air'),T('Αέρας','Air')],['windy',T('Μέρες ανέμου','Windy days'),T('Άνεμος','Wind')],['wave',T('Κύμα (μέσο)','Waves (mean)'),T('Κύμα','Waves')],['rain',T('Βροχή','Rain'),T('Βροχή','Rain')]];
function d2s(d){ return d.toISOString().slice(0,10); }
function addD(s,n){ var d=new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d2s(d); }
function shiftY(s,k){ var d=new Date(s+'T12:00:00Z'); d.setUTCFullYear(d.getUTCFullYear()-k); return d2s(d); }
function lim(){ try{ return window.PF.lims(); }catch(e){ return {wind:14,wave:0.9}; } }
function place(){ var id=ls.get('alkyon-fcsel','gps'), a=ls.get('alkyon-places',[])||[], p=null;
  if(id!=='gps') p=a.filter(function(x){ return x.id===id; })[0]||null;
  if(!p){ var g=B.lastPos(); if(g) p={name:T('Η θέση μου','My location'),lat:g.lat,lon:g.lon}; }
  return p||a[0]||{name:'Πάφος',lat:34.75,lon:32.4}; }
function q(p){ return 'latitude='+(+p.lat).toFixed(3)+'&longitude='+(+p.lon).toFixed(3); }
function getJ(u){ return fetch(u).then(function(r){ return r.json().then(function(j){ if(!r.ok||j.error) throw new Error((j&&j.reason)||('HTTP '+r.status)); return j; }); }); }
/* «out of allowed range from 2022-06-08 to …» → η πρώτη επιτρεπτή μέρα */
function minDate(e){ var m=/from (\d{4}-\d\d-\d\d)/.exec(String(e&&e.message||'')); return m?m[1]:null; }

/* ημερήσιος καιρός: ιστορικό (ERA5) */
function archive(p,from,to){ var u='https://archive-api.open-meteo.com/v1/archive?'+q(p)+'&start_date='+from+'&end_date='+to+'&daily=temperature_2m_mean,wind_speed_10m_max,precipitation_sum&wind_speed_unit=kn&timezone=auto';
  return getJ(u).catch(function(e){ var m=/to (\d{4}-\d\d-\d\d)/.exec(String(e.message)); if(m&&m[1]<to) return getJ(u.replace('end_date='+to,'end_date='+m[1])); throw e; }); }
/* πρόσφατες μέρες (το ERA5 έχει καθυστέρηση ~5 ημερών) */
function recent(p){ return getJ('https://api.open-meteo.com/v1/forecast?'+q(p)+'&daily=temperature_2m_mean,wind_speed_10m_max,precipitation_sum&wind_speed_unit=kn&timezone=auto&past_days='+(WIN+1)+'&forecast_days=1'); }
/* θάλασσα ωριαία για ένα διάστημα: νερό και κύμα */
function marine(p,from,to){ return getJ('https://marine-api.open-meteo.com/v1/marine?'+q(p)+'&hourly=sea_surface_temperature,wave_height&start_date='+from+'&end_date='+to+'&timezone=auto&cell_selection=sea'); }
function marineRecent(p){ return getJ('https://marine-api.open-meteo.com/v1/marine?'+q(p)+'&hourly=sea_surface_temperature,wave_height&past_days='+(WIN+1)+'&forecast_days=1&timezone=auto&cell_selection=sea'); }

/* ημερήσιες τιμές σε έναν πίνακα ανά ημερομηνία */
function putDaily(D,j){ var d=j&&j.daily; if(!d||!d.time) return; d.time.forEach(function(t,i){ var o=D[t]||(D[t]={}); var a=d.temperature_2m_mean&&d.temperature_2m_mean[i], w=d.wind_speed_10m_max&&d.wind_speed_10m_max[i], r=d.precipitation_sum&&d.precipitation_sum[i];
  if(typeof a==='number') o.ta=a; if(typeof w==='number') o.wmax=w; if(typeof r==='number') o.rain=r; }); }
function putMarine(D,j){ var hh=j&&j.hourly; if(!hh||!hh.time) return; var acc={};
  hh.time.forEach(function(t,i){ var k=t.slice(0,10), a=acc[k]||(acc[k]={s:0,sn:0,w:0,wn:0,wx:null}), s=hh.sea_surface_temperature&&hh.sea_surface_temperature[i], w=hh.wave_height&&hh.wave_height[i];
    if(typeof s==='number'){ a.s+=s; a.sn++; } if(typeof w==='number'){ a.w+=w; a.wn++; a.wx=a.wx==null?w:Math.max(a.wx,w); } });
  Object.keys(acc).forEach(function(k){ var a=acc[k], o=D[k]||(D[k]={}); if(a.sn) o.sst=a.s/a.sn; if(a.wn){ o.wave=a.w/a.wn; o.wavex=a.wx; } }); }
/* σύνοψη ενός διαστήματος [from..to] */
function summ(D,from,to){ var L=lim(), n=0, s={sst:[],ta:[],wave:[],rain:0,rn:0,windy:0,wn:0,wavy:0};
  for(var d=from;d<=to;d=addD(d,1)){ var o=D[d]; if(!o) continue; n++;
    if(o.sst!=null) s.sst.push(o.sst); if(o.ta!=null) s.ta.push(o.ta); if(o.wave!=null) s.wave.push(o.wave);
    if(o.rain!=null){ s.rain+=o.rain; s.rn++; } if(o.wmax!=null){ s.wn++; if(o.wmax>L.wind) s.windy++; } if(o.wavex!=null&&o.wavex>L.wave) s.wavy++; }
  var av=function(a){ return a.length?a.reduce(function(x,y){ return x+y; },0)/a.length:null; };
  return {n:n,sst:s.sst.length>=WIN/3?av(s.sst):null,ta:s.ta.length>=WIN/3?av(s.ta):null,wave:s.wave.length>=WIN/3?av(s.wave):null,rain:s.rn>=WIN/3?s.rain*WIN/s.rn:null,windy:s.wn>=WIN/3?Math.round(s.windy*WIN/s.wn):null}; }

/* όλα μαζί: για κάθε χρονιά οι 30 μέρες «πριν» (ίδιες ημερομηνίες με τις τελευταίες 30) και οι 30 «μετά» */
function load(p){
  var today=d2s(new Date()), from=addD(today,-(WIN-1)), key=(+p.lat).toFixed(2)+','+(+p.lon).toFixed(2)+'|'+today+'|'+lim().wind+'|'+lim().wave, c=ls.get(CK,null);
  if(c&&c.k===key&&c.v) return Promise.resolve(c.v);
  var D={}, y0=new Date().getUTCFullYear()-NY, aFrom=shiftY(from,NY), aTo=addD(today,-6), errs=[];
  var pa=archive(p,aFrom,aTo).then(function(j){ putDaily(D,j); }).catch(function(e){ errs.push('archive: '+e.message); });
  var pr=recent(p).then(function(j){ putDaily(D,j); }).catch(function(e){ errs.push('recent: '+e.message); });
  var pm=marineRecent(p).then(function(j){ putMarine(D,j); }).catch(function(e){ errs.push('marine: '+e.message); });
  /* θάλασσα για παλιές χρονιές: ένα αίτημα ανά χρονιά (60 μέρες), όσο πίσω επιτρέπει η πηγή */
  var floor=null, ks=[]; for(var k=1;k<=NY;k++) ks.push(k);
  function one(k){ var f=shiftY(from,k), t=addD(shiftY(today,k),WIN); if(floor&&t<floor) return Promise.resolve(); if(floor&&f<floor) f=floor;
    return marine(p,f,t).then(function(j){ putMarine(D,j); }).catch(function(e){ var m=minDate(e); if(m){ floor=m; if(t>=m) return marine(p,m>f?m:f,t).then(function(j){ putMarine(D,j); }).catch(function(){}); } }); }
  var chain=Promise.resolve(); ks.forEach(function(k){ chain=chain.then(function(){ return one(k); }); });
  return Promise.all([pa,pr,pm,chain]).then(function(){
    var yrs=[]; for(var k=0;k<=NY;k++){ var f=shiftY(from,k), t=shiftY(today,k); yrs.push({y:new Date(t).getUTCFullYear(),k:k,cur:summ(D,f,t),nxt:k?summ(D,addD(t,1),addD(t,WIN)):null}); }
    var v={place:(B.placeName?B.placeName(p):'')||p.name||'',from:from,to:today,yrs:yrs,errs:errs,seaFrom:floor};
    if(yrs[0].cur.n||yrs[1].cur.n) ls.set(CK,{k:key,v:v}); return v; }); }

/* ---------- υπολογισμοί ---------- */
function mean(a){ a=a.filter(function(x){ return x!=null; }); return a.length?a.reduce(function(x,y){ return x+y; },0)/a.length:null; }
function sd(a){ a=a.filter(function(x){ return x!=null; }); if(a.length<3) return null; var m=mean(a); return Math.sqrt(a.reduce(function(s,x){ return s+(x-m)*(x-m); },0)/(a.length-1)); }
function similar(v){ var now=v.yrs[0].cur, best=null; var keys=['sst','ta','windy','wave','rain'], S={};
  keys.forEach(function(k){ S[k]=sd(v.yrs.slice(1).map(function(y){ return y.cur[k]; }))||null; });
  v.yrs.slice(1).forEach(function(y){ var d=0, n=0; keys.forEach(function(k){ if(now[k]==null||y.cur[k]==null||!S[k]) return; var z=(now[k]-y.cur[k])/S[k]; d+=z*z; n++; }); if(n>=2){ var sc=Math.sqrt(d/n); if(!best||sc<best.sc) best={y:y,sc:sc,n:n}; } });
  return best; }
function bc(b){ return +b.cnt>1?+b.cnt:1; }
function catches(from,to){ var bs=[], ts=[]; try{ bs=B.store.bites().filter(function(b){ return !b.deleted&&!b.gear&&b.date>=from&&b.date<=to; }); ts=B.store.raw('trips').filter(function(t){ return !t.deleted&&t.date>=from&&t.date<=to; }); }catch(e){}
  var sp={}; bs.forEach(function(b){ var k=b.species||'?'; sp[k]=(sp[k]||0)+bc(b); });
  var top=Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; });
  var wk={}; bs.forEach(function(b){ var d=new Date(b.date+'T12:00:00Z'), k=Math.floor((d-new Date(from+'T12:00:00Z'))/(7*864e5)); wk[k]=(wk[k]||0)+bc(b); });
  var bw=Object.keys(wk).sort(function(a,b){ return wk[b]-wk[a]; })[0];
  return {n:bs.reduce(function(s,b){ return s+bc(b); },0),trips:ts.length,top:top.slice(0,2),bestWk:bw!=null&&wk[bw]>=2?[addD(from,7*bw),addD(from,7*bw+6),wk[bw]]:null}; }
function fmt(k,x){ if(x==null) return '–'; var U=window.AlkyonUnits;
  if(k==='sst'||k==='ta') return U&&U.temp?U.temp(x,1):B.num(x,1)+'°'; if(k==='wave') return U&&U.wave?U.wave(x):B.num(x,1)+' m'; if(k==='rain') return Math.round(x)+' mm'; if(k==='windy') return String(Math.round(x)); return B.num(x,1); }
function diff(k,a,b){ if(a==null||b==null) return ''; var d=a-b, s=d>0?'+':d<0?'−':'±', ad=Math.abs(d);
  if(k==='sst'||k==='ta') return s+B.num(ad,1)+'°'; if(k==='wave') return s+B.num(ad,1)+' m'; if(k==='rain') return s+Math.round(ad)+' mm'; return s+Math.round(ad); }
function dm(s){ return new Date(s+'T12:00:00Z').toLocaleDateString(EN?'en-GB':'el-GR',{day:'numeric',month:'short'}); }

/* προτάσεις: απλοί κανόνες, πάντα με την ένδειξη «εκτίμηση» */
function advice(v,sim){ var now=v.yrs[0].cur, past=v.yrs.slice(1), out=[], avg={};
  MET.forEach(function(m){ avg[m[0]]=mean(past.map(function(y){ return y.cur[m[0]]; })); });
  if(now.sst!=null&&avg.sst!=null){ var ds=now.sst-avg.sst;
    if(ds>=1) out.push(T('Το νερό είναι ','The water is ')+B.num(ds,1)+T('° πιο ζεστό από τον μέσο όρο. Τα είδη που έρχονται με το κρύο νερό μάλλον θα αργήσουν· τα «ζεστά» είδη (π.χ. λίτσες, μαγιάτικα) μπορεί να μείνουν περισσότερο.','° warmer than average. Cold-water species will probably arrive later; warm-water species (e.g. leerfish, amberjack) may stay longer.'));
    else if(ds<=-1) out.push(T('Το νερό είναι ','The water is ')+B.num(-ds,1)+T('° πιο κρύο από τον μέσο όρο. Η σεζόν του χειμώνα μπορεί να ξεκινήσει νωρίτερα από ό,τι συνήθως.','° colder than average. The winter season may start earlier than usual.')); }
  if(now.windy!=null&&avg.windy!=null&&now.windy-avg.windy>=3) out.push(T('Είχε ','There were ')+Math.round(now.windy-avg.windy)+T(' μέρες με δυνατό άνεμο περισσότερες από το συνηθισμένο. Τα ήπια παράθυρα είναι πιο σπάνια: αξιοποίησέ τα.',' more windy days than usual. Calm windows are rarer: make the most of them.'));
  if(now.rain!=null&&avg.rain!=null&&now.rain-avg.rain>=25) out.push(T('Έβρεξε ','It rained ')+Math.round(now.rain-avg.rain)+T(' mm περισσότερο από το συνηθισμένο. Κοντά σε εκβολές και ρέματα το νερό μπορεί να είναι πιο θολό.',' mm more than usual. Near river mouths and streams the water may be murkier.'));
  /* τι ακολούθησε τα προηγούμενα χρόνια */
  var nd=past.map(function(y){ return y.nxt&&y.nxt.sst!=null&&y.cur.sst!=null?y.nxt.sst-y.cur.sst:null; }).filter(function(x){ return x!=null; });
  if(nd.length>=3){ var m=mean(nd); if(Math.abs(m)>=0.5) out.push(T('Τα προηγούμενα χρόνια, τις επόμενες 30 μέρες το νερό ','In past years, over the next 30 days the water ')+(m<0?T('έπεφτε','dropped'):T('ανέβαινε','rose'))+T(' κατά μέσο όρο ',' by ')+B.num(Math.abs(m),1)+'°.'); }
  var nw=mean(past.map(function(y){ return y.nxt&&y.nxt.windy; })); if(nw!=null&&nw>=8) out.push(T('Τις επόμενες 30 μέρες συνήθως έχει ~','The next 30 days usually bring ~')+Math.round(nw)+T(' μέρες με δυνατό άνεμο.',' windy days.'));
  /* από τα δικά σου ψάρια */
  var mine=past.map(function(y){ var f=addD(shiftY(v.to,y.k),1), t=addD(f,WIN-1); return {y:y.y,c:catches(f,t)}; }).filter(function(x){ return x.c.n>0; });
  var sc=sim&&sim.y?catches(addD(shiftY(v.to,sim.y.k),1),addD(shiftY(v.to,sim.y.k),WIN)):{n:0};
  if(sc.n){ out.push(T('Στην πιο παρόμοια χρονιά (','In the most similar year (')+sim.y.y+T('), τις επόμενες 30 μέρες έπιασες ','), over the next 30 days you caught ')+sc.n+(sc.top.length?T(', κυρίως ',', mostly ')+sc.top.join(T(' και ',' and ')):'')+(sc.bestWk?T('. Καλύτερη εβδομάδα: ','. Best week: ')+dm(sc.bestWk[0])+'–'+dm(sc.bestWk[1]):'')+'.'); }
  else if(mine.length){ var all={}; mine.forEach(function(x){ x.c.top.forEach(function(s){ all[s]=(all[s]||0)+1; }); }); var tp=Object.keys(all).sort(function(a,b){ return all[b]-all[a]; })[0];
    if(tp) out.push(T('Τα προηγούμενα χρόνια, τις επόμενες 30 μέρες έπιανες συχνότερα ','In past years, over the next 30 days you most often caught ')+tp+'.'); }
  return out; }

/* ---------- κάρτα ---------- */
B.yearsCard=function(){
  var p=place(), box=h('section',{class:'card yrs'}), met=ls.get('alkyon-v4-yrsmet','sst');
  box.append(h('h2',{text:T('Σύγκριση χρονιών','Year comparison')}),h('div',{class:'sk',style:{height:'180px'}}));
  load(p).then(function(v){ paint(v); }).catch(function(e){ box.replaceChildren(h('h2',{text:T('Σύγκριση χρονιών','Year comparison')}),h('p',{class:'sub',text:T('Δεν φορτώθηκαν τα ιστορικά δεδομένα. Χρειάζεται σύνδεση.','Could not load historical data. A connection is needed.')})); });
  function paint(v){
    var now=v.yrs[0].cur, past=v.yrs.slice(1); box.replaceChildren();
    box.append(h('h2',{text:T('Σύγκριση χρονιών','Year comparison')}),
      h('p',{class:'sub',text:T('Τελευταίες 30 μέρες (','Last 30 days (')+dm(v.from)+'–'+dm(v.to)+T(') σε σχέση με τις ίδιες μέρες ',') compared with the same days ')+T('των προηγούμενων ','of the previous ')+NY+T(' χρόνων · ',' years · ')+v.place}));
    if(!now.n&&!past.some(function(y){ return y.cur.n; })){ box.append(h('p',{class:'sub',text:T('Δεν υπάρχουν δεδομένα για αυτή την τοποθεσία.','No data for this place.')})); return; }
    /* επιλογή μεγέθους και γράφημα ανά χρονιά */
    var has=MET.filter(function(m){ return v.yrs.some(function(y){ return y.cur[m[0]]!=null; }); }); if(!has.some(function(m){ return m[0]===met; })) met=has[0]?has[0][0]:'ta';
    var chips=h('div',{class:'chips yrchips'}), chart=h('div',{class:'yrch'}), cap=h('p',{class:'yrcap'});
    has.forEach(function(m){ chips.append(h('button',{type:'button',class:'chip sm','aria-pressed':String(m[0]===met),text:m[2],onclick:function(){ met=m[0]; ls.set('alkyon-v4-yrsmet',met); [].forEach.call(chips.children,function(c){ c.setAttribute('aria-pressed',String(c===this)); },this); draw(); }})); });
    function draw(){ var vals=v.yrs.slice().reverse().map(function(y){ return [y.y,y.cur[met]]; }); while(vals.length>1&&vals[0][1]==null) vals.shift(); /* 1.8.33: χωρίς άδεια κουτάκια για χρονιές που δεν έχουν δεδομένα (π.χ. θερμοκρασία νερού πριν το 2023) */ var nums=vals.map(function(x){ return x[1]; }).filter(function(x){ return x!=null; });
      chart.replaceChildren(); if(!nums.length){ cap.textContent=''; return; }
      var lo=Math.min.apply(null,nums), hi=Math.max.apply(null,nums), base=(met==='windy'||met==='rain'||met==='wave')?0:lo-(hi-lo||1)*0.6, av=mean(past.map(function(y){ return y.cur[met]; }));
      vals.forEach(function(x){ var cur=x[0]===v.yrs[0].y, ht=x[1]==null?0:Math.max(4,Math.round(100*(x[1]-base)/Math.max(0.001,hi-base)));
        chart.append(h('div',{class:'yrb'+(cur?' cur':'')+(x[1]==null?' na':'')},h('small',{text:x[1]==null?'':fmt(met,x[1])}),h('i',{style:{height:ht+'%'}}),h('span',{text:"'"+String(x[0]).slice(2)}))); });
      if(av!=null){ var ap=Math.round(100*(av-base)/Math.max(0.001,hi-base)); chart.append(h('b',{class:'yrav',style:{bottom:'calc(18px + '+(ap*0.01)+' * (100% - 36px))'},title:T('μέσος όρος','average')})); }
      cap.textContent=now[met]!=null&&av!=null?T('Φέτος ','This year ')+fmt(met,now[met])+' · '+T('μέσος όρος ','average ')+fmt(met,av)+' ('+diff(met,now[met],av)+')':''; }
    draw();
    box.append(chips,chart,cap);
    /* φέτος σε σχέση με τον μέσο όρο */
    var tb=h('div',{class:'yrtab'});
    MET.forEach(function(m){ var av=mean(past.map(function(y){ return y.cur[m[0]]; })); if(now[m[0]]==null&&av==null) return; var dd=now[m[0]]!=null&&av!=null?now[m[0]]-av:0, big=Math.abs(dd)>=(m[0]==='sst'||m[0]==='ta'?1:m[0]==='wave'?0.2:m[0]==='rain'?20:3);
      tb.append(h('span',{text:m[1]}),h('b',{text:fmt(m[0],now[m[0]])}),h('small',{text:fmt(m[0],av)}),h('em',{class:big?(dd>0?'up':'dn'):'',text:diff(m[0],now[m[0]],av)})); });
    box.append(h('div',{class:'yrth'},h('span'),h('b',{text:T('φέτος','this year')}),h('small',{text:T('μ.ό.','avg')}),h('em',{text:T('διαφορά','diff')})),tb);
    /* η πιο παρόμοια χρονιά */
    var sim=similar(v);
    if(sim){ var sc=sim.y.cur, bits=[]; if(sc.sst!=null) bits.push(T('νερό ','water ')+fmt('sst',sc.sst)); if(sc.ta!=null) bits.push(T('αέρας ','air ')+fmt('ta',sc.ta)); if(sc.windy!=null) bits.push(fmt('windy',sc.windy)+T(' μέρες ανέμου',' windy days')); if(sc.rain!=null) bits.push(T('βροχή ','rain ')+fmt('rain',sc.rain));
      var after=sim.y.nxt&&sim.y.nxt.sst!=null&&sc.sst!=null?' '+T('Μετά από 30 μέρες το νερό ήταν ','30 days later the water was ')+fmt('sst',sim.y.nxt.sst)+'.':'';
      box.append(h('div',{class:'yrsim'},h('b',{text:T('Πιο παρόμοια χρονιά: ','Most similar year: ')+sim.y.y}),h('span',{text:T('Τις ίδιες μέρες: ','Same days: ')+bits.join(', ')+'.'+after}))); }
    /* τα ψάρια σου ανά χρονιά (ίδιες 30 μέρες + επόμενες 30) */
    var rows=v.yrs.map(function(y){ var f=shiftY(v.from,y.k), t=shiftY(v.to,y.k), a=catches(f,t), b=y.k?catches(addD(t,1),addD(t,WIN)):null; return {y:y.y,a:a,b:b}; }).filter(function(r){ return r.a.n||r.a.trips||(r.b&&(r.b.n||r.b.trips)); });
    if(rows.length){ var ct=h('div',{class:'yrfish'},h('span'),h('small',{text:T('ίδιες μέρες','same days')}),h('small',{text:T('επόμενες 30','next 30')}));
      rows.forEach(function(r){ var cell=function(c){ return c?(c.n+T(' ψάρια',' fish')+(c.trips?' · '+c.trips+T(' έξ.',c.trips===1?' trip':' trips'):'')+(c.top[0]?' · '+c.top[0]:'')):'–'; }; ct.append(h('b',{text:String(r.y)}),h('span',{text:cell(r.a)}),h('span',{text:r.b?cell(r.b):'—'})); });
      box.append(h('h3',{class:'h3',text:T('Τα ψάρια σου','Your catches')}),ct); }
    else box.append(h('p',{class:'foot',text:T('Όταν θα έχεις καταγραφές από περισσότερες χρονιές, εδώ θα φαίνονται τα ψάρια σου ανά χρονιά για τις ίδιες μέρες.','Once you have logs from more years, your catches for the same days will show here year by year.')}));
    /* προτάσεις */
    var adv=advice(v,sim); if(adv.length){ var ul=h('ul',{class:'yradv'}); adv.forEach(function(a){ ul.append(h('li',{text:a})); });
      box.append(h('h3',{class:'h3',text:T('Τι προτείνει','Suggestions')}),ul,h('p',{class:'foot',text:T('Εκτιμήσεις από τα δεδομένα των προηγούμενων χρόνων και τις καταγραφές σου, όχι βεβαιότητα.','Estimates from past years’ data and your logs, not certainty.')})); }
    var src=T('Πηγή: Open-Meteo (ιστορικό ERA5).','Source: Open-Meteo (ERA5 history).'); if(v.seaFrom) src+=' '+T('Νερό/κύμα διαθέσιμα από ','Water/waves available from ')+v.seaFrom.slice(0,4)+'.';
    box.append(h('p',{class:'foot',text:src}));
  }
  return box; };
})();
