/* Τοπικά φαινόμενα ανέμου: (1) ένδειξη θαλάσσιας αύρας, (2) προστασία/έκθεση ακτής ως προς τον άνεμο,
   (3) καταγραφή απόκλισης μοντέλου vs σταθμοί (METAR) για να φανεί με τον καιρό πόσο υποτιμά/υπερτιμά το μοντέλο.
   ΟΛΑ είναι εμπειρικοί κανόνες ή στατιστική, όχι μέτρηση ούτε μοντέλο υψηλής ανάλυσης. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C||!window.PF) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dn(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; }
function fd(d){ try{ return window.AlkyonWindMap.diffTxt(d); }catch(e){ return (d>0?'+':'')+d.toFixed(1)+' kn'; } }
function rng(a,b){ try{ var P=window.AlkyonUnits, x=P.windP(a), y=P.windP(b); return x[0]+'–'+y[0]+' '+x[1]; }catch(e){ return a+'–'+b+' kn'; } }
function adiff(a,b){ var d=Math.abs(a-b)%360; return d>180?360-d:d; }
var SUPA='https://sgfohmqwdwtkhtrebnix.supabase.co', SKEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
var LOGK='alkyon-windlog2', COASTK='alkyon-wl-coast';
function fetchJ(url,opt,ms){ var ac=new AbortController(), tm=setTimeout(function(){ ac.abort(); },ms||12000); opt=opt||{}; opt.signal=ac.signal; return fetch(url,opt).then(function(r){ clearTimeout(tm); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }

/* ---- 1. κατεύθυνση προς τη θάλασσα (πού βρίσκεται η θάλασσα από το σημείο) ----
   Δείγμα 8 σημείων γύρω (≈10 km): το θαλάσσιο μοντέλο δίνει τιμή μόνο πάνω στη θάλασσα. Χονδρικό: η ανάλυση είναι ~5–8 km. */
function seaDir(lat,lon){
  var key=lat.toFixed(1)+','+lon.toFixed(1), cache=C.lsGet(COASTK,{})||{};
  if(cache[key]!==undefined) return Promise.resolve(cache[key]);
  var R=0.09, la=[], lo=[], ang=[];
  for(var i=0;i<8;i++){ var a=i*45*Math.PI/180; ang.push(i*45); la.push((lat+R*Math.cos(a)).toFixed(3)); lo.push((lon+R*Math.sin(a)/Math.cos(lat*Math.PI/180)).toFixed(3)); }
  return fetchJ('https://marine-api.open-meteo.com/v1/marine?latitude='+la.join(',')+'&longitude='+lo.join(',')+'&hourly=wave_height&forecast_hours=1').then(function(j){
    var arr=Array.isArray(j)?j:[j], x=0, y=0, n=0;
    arr.forEach(function(p,i){ var v=p&&p.hourly&&p.hourly.wave_height&&p.hourly.wave_height[0]; if(typeof v==='number'){ x+=Math.sin(ang[i]*Math.PI/180); y+=Math.cos(ang[i]*Math.PI/180); n++; } });
    var res;
    if(n===0) res={sea:null,frac:0};
    else if(n===arr.length) res={sea:null,frac:1}; /* ανοιχτή θάλασσα γύρω */
    else { var m=Math.sqrt(x*x+y*y); res={sea:m<0.2?null:Math.round((Math.atan2(x,y)*180/Math.PI+360)%360),frac:n/arr.length}; }
    cache[key]=res; C.lsSet(COASTK,cache); return res;
  });
}

/* ---- 2. θαλάσσια αύρα: εμπειρικός κανόνας ---- */
function breezeWindow(fc,sd){
  var now=fc.nowLocal.slice(0,13), hrs=[], res=[], mon=+fc.nowLocal.slice(5,7);
  fc.days.forEach(function(d){ d.hours.forEach(function(h){ if(h.t.slice(0,13)>=now) hrs.push(h); }); });
  hrs=hrs.slice(0,30);
  var season=mon>=5&&mon<=9?2:(mon===4||mon===10)?1:0;
  var why=null;
  hrs.forEach(function(h){
    var ok=h.hr>=11&&h.hr<=19&&h.wind!=null&&h.wind<=12&&h.cloud!=='over'&&season>0;
    if(ok){ var dt=(h.temp!=null&&h.sst!=null)?h.temp-h.sst:null; ok=dt==null?(h.temp!=null&&h.temp>=24):dt>=(season===2?2:4); }
    h._sb=ok;
  });
  var best=null, cur=null;
  hrs.forEach(function(h){ if(h._sb){ if(!cur) cur={s:h,e:h,n:1}; else{ cur.e=h; cur.n++; } } else { if(cur&&(!best||cur.n>best.n)) best=cur; cur=null; } });
  if(cur&&(!best||cur.n>best.n)) best=cur;
  if(best&&best.n>=3) return {win:best};
  var day=hrs.filter(function(h){ return h.hr>=11&&h.hr<=19; });
  if(!season) why=T('εκτός εποχής (οι αύρες είναι ισχυρότερες Μάιο–Σεπτέμβριο)','out of season (breezes are strongest May–September)');
  else if(day.length&&day.filter(function(h){ return h.wind>12; }).length>day.length/2) why=T('ο γενικός άνεμος είναι ήδη δυνατός (πάνω από '+window.AlkyonUnits.wind(12)+')','the general wind is already strong (over '+window.AlkyonUnits.wind(12)+')');
  else if(day.length&&day.filter(function(h){ return h.cloud==='over'; }).length>day.length/2) why=T('πολλά σύννεφα, λιγότερη θέρμανση της ξηράς','cloudy, less heating of the land');
  else why=T('μικρή διαφορά θερμοκρασίας ξηράς–θάλασσας','small land–sea temperature difference');
  return {win:null,why:why};
}
function hh(h){ return (h.hr<10?'0':'')+h.hr+':00'; }

/* ---- 3. καταγραφή απόκλισης μοντέλου vs σταθμοί ----
   Κρατάμε μόνο σύνολα ανά σταθμό και τετράωρο της ημέρας: {n, άθροισμα (μετρημένο − μοντέλο)}. */
function mdlVec(hourly,sfx,i){ var s=hourly['wind_speed_10m'+sfx], d=hourly['wind_direction_10m'+sfx]; if(!s||!d||typeof s[i]!=='number'||typeof d[i]!=='number') return null; var r=d[i]*Math.PI/180; return {u:-s[i]*Math.sin(r),v:-s[i]*Math.cos(r)}; }
function bucket(h){ return h<6?0:h<12?1:h<18?2:3; }
async function logOnce(){
  if(!window.AlkyonWindMap||!window.AlkyonWindMap.modelFetch) return;
  try{
    var st=await fetchJ(window.ALKYON_OBS_URL||SUPA+'/functions/v1/smart-api',{headers:{apikey:SKEY,Authorization:'Bearer '+SKEY}},12000);
    st=(Array.isArray(st)?st:[]).filter(function(x){ return x&&x.spd!=null&&x.t&&isFinite(x.lat)&&isFinite(x.lon)&&Date.now()-Date.parse(x.t)<3*3600000; }); if(!st.length) return;
    st=st.slice(0,60);
    var base='https://api.open-meteo.com/v1/forecast?latitude='+st.map(function(x){ return (+x.lat).toFixed(3); }).join(',')+'&longitude='+st.map(function(x){ return (+x.lon).toFixed(3); }).join(',')+'&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&past_hours=3&forecast_hours=2&timezone=UTC';
    var mf=await window.AlkyonWindMap.modelFetch(base), j=mf.arr, sfxs=mf.names.map(function(x){ return x.sfx; });
    if(j.length<st.length) return;
    var db=C.lsGet(LOGK,null); if(!db||!db.agg||db.v!==2) db={v:2,agg:{},seen:[]};
    var seen={}, added=0; db.seen.forEach(function(k){ seen[k]=1; });
    st.forEach(function(s,i){
      var ot=Date.parse(s.t), k=s.id+'|'+new Date(ot).toISOString().slice(0,13)+'|'+new Date(ot).getUTCMinutes(); if(seen[k]) return;
      var H=j[i]&&j[i].hourly; if(!H||!H.time) return;
      var idx=-1; for(var q=0;q<H.time.length;q++){ if(Date.parse(H.time[q]+'Z')<=ot) idx=q; } if(idx<0||idx+1>=H.time.length) return;
      var f=(ot-Date.parse(H.time[idx]+'Z'))/3600000, su=0,sv=0,c=0;
      sfxs.forEach(function(sf){ var a=mdlVec(H,sf,idx), b=mdlVec(H,sf,idx+1); if(a&&b){ su+=a.u+(b.u-a.u)*f; sv+=a.v+(b.v-a.v)*f; c++; } });
      if(!c) return; var ms=Math.sqrt((su/c)*(su/c)+(sv/c)*(sv/c));
      var lh; try{ lh=+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hour12:false,timeZone:'Asia/Nicosia'}).format(new Date(ot))%24; }catch(e){ lh=(new Date(ot).getUTCHours()+2)%24; }
      var o=db.agg[s.id]||(db.agg[s.id]={nm:s.name||s.id,lat:+s.lat,lon:+s.lon,b:[[0,0],[0,0],[0,0],[0,0]]}); var bk=bucket(lh);
      o.b[bk][0]++; o.b[bk][1]+=s.spd-ms; seen[k]=1; db.seen.push(k); added++;
    });
    if(added){ if(db.seen.length>400) db.seen=db.seen.slice(-400); C.lsSet(LOGK,db); }
  }catch(e){}
}
var BN=[T('νύχτα (00–06)','night (00–06)'),T('πρωί (06–12)','morning (06–12)'),T('απόγευμα (12–18)','afternoon (12–18)'),T('βράδυ (18–24)','evening (18–24)')];
function biasTable(lat,lon){
  var db=C.lsGet(LOGK,null); if(!db||db.v!==2||!db.agg) return {n:0,rows:[]};
  var tot=0, rows=[];
  Object.keys(db.agg).forEach(function(k){ var o=db.agg[k]; o.b.forEach(function(x){ tot+=x[0]; }); var d=(lat!=null)?Math.sqrt(Math.pow((o.lat-lat)*111,2)+Math.pow((o.lon-lon)*91,2)):0; rows.push({id:k,nm:o.nm,d:d,b:o.b}); });
  rows.sort(function(a,b){ return a.d-b.d; });
  return {n:tot,rows:rows};
}
/* ---- εμφάνιση σε στοιχείο (πάνελ ανέμου) ---- */
var token=0;
async function render(el,lat,lon,cur){
  if(!el) return; var id=++token; el.replaceChildren();
  var h=document.createElement('b'); h.textContent=T('Τοπικά φαινόμενα (ενδείξεις)','Local effects (indications)'); el.append(h);
  var p1=document.createElement('div'); p1.style.cssText='margin-top:4px'; p1.textContent=T('Υπολογισμός…','Working…'); el.append(p1);
  var tb=biasTable(lat,lon), p3=document.createElement('div'); p3.style.cssText='margin-top:6px'; el.append(p3);
  if(!tb.n) p3.textContent=T('Απόκλιση μοντέλου: δεν υπάρχουν ακόμα καταγραφές σταθμών. Συλλέγονται μόνο όσο η εφαρμογή είναι ανοιχτή.','Model bias: no station records yet. They are collected only while the app is open.');
  else{
    var shown=0, hd=document.createElement('div'); hd.textContent=T('Απόκλιση μοντέλου από μετρήσεις (μετρημένο − μοντέλο), κοντινότεροι σταθμοί · '+tb.n+' καταγραφές','Model bias vs observations (observed − model), nearest stations · '+tb.n+' records'); p3.append(hd);
    tb.rows.forEach(function(r){ if(shown>=4) return; var parts=[]; r.b.forEach(function(x,i){ if(x[0]>=4) parts.push(BN[i]+': '+fd(x[1]/x[0])+' (n='+x[0]+')'); }); if(!parts.length) return; shown++; var d=document.createElement('div'); d.style.cssText='font-size:12px;margin-top:2px'; d.textContent=r.nm.split(',')[0]+' (~'+Math.round(r.d)+' km) → '+parts.join(' · '); p3.append(d); });
    if(!shown){ var d2=document.createElement('div'); d2.className='note'; d2.textContent=T('Χρειάζονται τουλάχιστον 4 καταγραφές ανά σταθμό και ώρα της ημέρας για να εμφανιστεί αριθμός.','At least 4 records per station and time of day are needed before a figure is shown.'); p3.append(d2); }
  }
  try{
    var r=await Promise.all([seaDir(lat,lon),window.PF.getForecast(lat,lon,undefined,{days:2})]); if(id!==token) return;
    var sd=r[0], fc=r[1], bw=breezeWindow(fc,sd), lines=[];
    if(bw.win){ lines.push('🌬️ '+T('Πιθανή θαλάσσια αύρα ','Possible sea breeze ')+hh(bw.win.s)+'–'+hh(bw.win.e)+(sd&&sd.sea!=null?T(', από ',', from ')+dn(sd.sea):'')+T(' (συνήθως '+rng(8,15)+' σε ευνοϊκές μέρες).',' (usually '+rng(8,15)+' on favourable days).')); }
    else lines.push('🌬️ '+T('Δεν αναμένεται καθαρή θαλάσσια αύρα: ','No clear sea breeze expected: ')+bw.why+'.');
    if(sd&&sd.sea!=null&&cur&&cur.dir!=null&&cur.sp>=4){
      var rel=adiff(cur.dir,sd.sea);
      lines.push(rel<=60?'⚠️ '+T('Ο άνεμος ('+dn(cur.dir)+') έρχεται από τη θάλασσα: ακτή εκτεθειμένη, περισσότερο κύμα και ανάδευση κοντά στην ακτή.','The wind ('+dn(cur.dir)+') blows from the sea: exposed shore, more swell and chop near the coast.'):rel>=120?'🛡️ '+T('Ο άνεμος ('+dn(cur.dir)+') έρχεται από την ξηρά: κοντά στην ακτή το κύμα είναι μικρότερο, αλλά ο άνεμος δυναμώνει όσο απομακρύνεσαι και μπορεί να σε παρασύρει προς ανοιχτή θάλασσα.','The wind ('+dn(cur.dir)+') blows from land: smaller waves near the shore, but the wind strengthens as you go out and can push you offshore.'):'ℹ️ '+T('Ο άνεμος ('+dn(cur.dir)+') είναι παράλληλος με την ακτή.','The wind ('+dn(cur.dir)+') runs roughly parallel to the coast.'));
    } else if(sd&&sd.sea==null&&sd.frac===1) lines.push('ℹ️ '+T('Ανοιχτή θάλασσα γύρω από το σημείο: δεν ισχύουν επιδράσεις ακτής.','Open sea around the point: no coastal effects apply.'));
    p1.replaceChildren(); lines.forEach(function(t){ var d=document.createElement('div'); d.style.cssText='margin-top:3px;font-size:13px'; d.textContent=t; p1.append(d); });
    var n=document.createElement('div'); n.className='note'; n.style.marginTop='4px'; n.textContent=T('Εμπειρικοί κανόνες: θέρμανση ξηράς, εποχή, νέφωση και γενικός άνεμος. Η κατεύθυνση της ακτής είναι χονδρική (ανάλυση περίπου 5–8 km). Δεν είναι μέτρηση.','Rules of thumb: land heating, season, cloud and general wind. Coast direction is approximate (about 5–8 km resolution). Not a measurement.'); p1.append(n);
  }catch(e){ if(id===token){ p1.textContent=T('Δεν φορτώθηκαν δεδομένα για τα τοπικά φαινόμενα.','Local-effect data did not load.'); } }
}
setTimeout(logOnce,15000); setInterval(function(){ if(!document.hidden) logOnce(); },30*60000);
window.AlkyonWindLocal={render:render,seaDir:seaDir,breeze:breezeWindow,biasTable:biasTable,logOnce:logOnce};
})();
