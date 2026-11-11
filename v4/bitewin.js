/* Alkyon 4 · «Παράθυρο τσιμπήματος» (1.11.6)
   Ο χρήστης γράφει στο ψάρι από–έως ποια ώρα τσιμπούσαν (b.win={a:'19:00',b:'21:00'}). Εδώ βρίσκουμε τι άλλαξε γύρω από την ώρα
   που σταμάτησαν: άνεμος (ένταση, κατεύθυνση, ριπές), πίεση, κύμα, στάθμη θάλασσας (παλίρροια), ρεύμα, θερμοκρασία νερού, συννεφιά,
   ήλιος (δύση/ανατολή, σούρουπο), σελήνη (ανατολή/δύση, μεσουράνημα) και αν άρχισε ή σταμάτησε να τσιμπά μέσα σε περίοδο solunar.
   Καιρός: Open-Meteo, ωριαίο μοντέλο (~10–25 km), όχι μέτρηση στο σημείο. Συσχέτιση, όχι απόδειξη.
   Το αποτέλεσμα (μόνο τα κλειδιά των αλλαγών) φυλάγεται στο ψάρι ως b.winx, ώστε με πολλά παράθυρα να φανεί μοτίβο. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, HOUR=3600000, MIN=60000, DAY=86400000;
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dn(d){ return COMP[Math.round((((d%360)+360)%360)/45)%8]; }
function num(v){ return (typeof v==='number'&&isFinite(v))?v:null; }
function W(kn){ try{ return window.AlkyonUnits.wind(kn); }catch(e){ return Math.round(kn)+' kn'; } }
function P(x){ try{ return window.AlkyonUnits.press(x); }catch(e){ return Math.round(x*10)/10+' hPa'; } }
function M(m){ try{ return window.AlkyonUnits.wave(m); }catch(e){ return (Math.round(m*10)/10)+' m'; } }
function tzOf(b){ return typeof b.tz==='number'?b.tz:-new Date().getTimezoneOffset(); }
/* «HH:MM» της ημέρας του ψαριού → UTC ms (αν το «έως» είναι πριν το «από», περνά τα μεσάνυχτα) */
function toMs(date,hm,tz){ var d=date.split('-').map(Number), t=hm.split(':').map(Number); return Date.UTC(d[0],d[1]-1,d[2],t[0],t[1])-tz*MIN; }
function span(b){ if(!b||!b.win||!b.win.a||!b.win.b||!b.date) return null; var tz=tzOf(b), a=toMs(b.date,b.win.a,tz), e=toMs(b.date,b.win.b,tz); if(e<=a) e+=DAY; return {a:a,e:e,tz:tz}; }
function hm(ms,tz){ return new Date(ms+tz*MIN).toISOString().slice(11,16); }
function iso(ms){ return new Date(ms).toISOString().slice(0,10); }
function getJson(u){ var ac=('AbortController' in window)?new AbortController():null, t=setTimeout(function(){ if(ac) ac.abort(); },15000);
  return fetch(u,ac?{signal:ac.signal}:{}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).finally(function(){ clearTimeout(t); }); }
/* ωριαία δεδομένα από 3 ώρες πριν το «από» ως 3 ώρες μετά το «έως» */
function fetchSeries(lat,lon,s){
  var t0=s.a-3*HOUR, t1=s.e+3*HOUR, recent=Date.now()-t0<85*DAY, past=Math.min(92,Math.ceil((Date.now()-t0)/DAY)+2), pos='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&timezone=GMT';
  var wv='wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover,temperature_2m', mv='wave_height,sea_level_height_msl,ocean_current_velocity,ocean_current_direction,sea_surface_temperature';
  var fut=t1>Date.now()-HOUR?'&forecast_days=2':'&forecast_days=1';
  var wu=recent?'https://api.open-meteo.com/v1/forecast?'+pos+'&hourly='+wv+'&past_days='+past+fut+'&wind_speed_unit=kn'
               :'https://archive-api.open-meteo.com/v1/archive?'+pos+'&hourly='+wv.replace(',wind_gusts_10m','')+'&start_date='+iso(t0)+'&end_date='+iso(t1)+'&wind_speed_unit=kn';
  var mu='https://marine-api.open-meteo.com/v1/marine?'+pos+'&hourly='+mv+'&cell_selection=sea'+(recent?'&past_days='+past+fut:'&start_date='+iso(t0)+'&end_date='+iso(t1));
  return Promise.allSettled([getJson(wu),getJson(mu)]).then(function(r){
    var out={t:[]}, add=function(j,keys){ var hh=j&&j.hourly; if(!hh||!hh.time) return; hh.time.forEach(function(ts,i){ var ms=Date.parse(ts+'Z'); if(ms<t0-HOUR||ms>t1+HOUR) return; var k=out.t.indexOf(ms); if(k<0){ out.t.push(ms); k=out.t.length-1; } keys.forEach(function(x){ (out[x]=out[x]||[])[k]=num(hh[x]&&hh[x][i]); }); }); };
    if(r[0].status==='fulfilled') add(r[0].value,wv.split(','));
    if(r[1].status==='fulfilled') add(r[1].value,mv.split(','));
    return out.t.length?out:null; }); }
/* τιμή στη στιγμή ms (γραμμική παρεμβολή) */
function at(S,key,ms){ var v=S[key]; if(!v) return null; var t=S.t, i=0; while(i<t.length-1&&t[i+1]<=ms) i++; var a=num(v[i]), b=num(v[i+1]); if(a==null) return b; if(b==null||t[i+1]==null||ms<=t[i]) return a; return a+(b-a)*(ms-t[i])/(t[i+1]-t[i]); }
function mean(S,key,m0,m1){ var v=S[key], s=0, n=0; if(!v) return null; S.t.forEach(function(t,i){ if(t>=m0&&t<=m1&&num(v[i])!=null){ s+=v[i]; n++; } }); if(!n){ var x=at(S,key,(m0+m1)/2); return x; } return s/n; }
function amean(S,key,m0,m1){ var v=S[key], x=0, y=0, n=0; if(!v) return null; S.t.forEach(function(t,i){ if(t>=m0&&t<=m1&&num(v[i])!=null){ x+=Math.cos(v[i]*Math.PI/180); y+=Math.sin(v[i]*Math.PI/180); n++; } }); if(!n) return null; return (Math.atan2(y,x)*180/Math.PI+360)%360; }
function turn(a,b){ return ((b-a+540)%360)-180; }

/* ---------- ανάλυση ---------- */
/* επιστρέφει [{k:κλειδί, t:κείμενο, w:βάρος 1–3}] με τις αλλαγές γύρω από το τέλος (και την αρχή) του παραθύρου */
/* edge: 'end' (προεπιλογή) = πριν/μετά το τέλος: κατά το παράθυρο σε σχέση με τις 2 ώρες μετά.
         'start' = γύρω από την αρχή: οι 2 ώρες πριν σε σχέση με το παράθυρο (1.11.7). */
function analyze(b,S,edge){
  var s=span(b), out=[]; if(!s) return out; var tz=s.tz, H2=2*HOUR, A, E;
  if(edge==='start'){ A=s.a-H2; E=s.a; } else { A=s.a; E=s.e; }   /* σε κάθε περίπτωση: [A,E] = «πριν», [E,E+2h] = «μετά» */
  var AF=edge==='start'?Math.max(s.a+HOUR,Math.min(s.e,s.a+H2)):E+H2;   /* τέλος του «μετά» */
  var end=hm(E,tz);
  function add(k,t,w){ out.push({k:k,t:t,w:w||1}); }
  if(S){
    /* άνεμος: κατά τη διάρκεια (από–έως) σε σχέση με τις 2 ώρες μετά */
    var w0=mean(S,'wind_speed_10m',A,E), w1=mean(S,'wind_speed_10m',E,AF);
    if(w0!=null&&w1!=null){ var dw=w1-w0; if(dw>=3) add('wind-up',T('Ο άνεμος δυνάμωσε: από ','The wind picked up: from ')+W(w0)+T(' σε ',' to ')+W(w1)+'.',dw>=6?3:2); else if(dw<=-3) add('wind-down',T('Ο άνεμος έπεσε: από ','The wind dropped: from ')+W(w0)+T(' σε ',' to ')+W(w1)+'.',2); }
    var d0=amean(S,'wind_direction_10m',A,E), d1=amean(S,'wind_direction_10m',E,AF);
    if(d0!=null&&d1!=null&&Math.max(w0||0,w1||0)>=4&&Math.abs(turn(d0,d1))>=45) add('wind-turn',T('Ο άνεμος γύρισε: από ','The wind shifted: from ')+dn(d0)+T(' σε ',' to ')+dn(d1)+'.',Math.abs(turn(d0,d1))>=90?3:2);
    var g0=mean(S,'wind_gusts_10m',A,E), g1=mean(S,'wind_gusts_10m',E,AF); if(g0!=null&&g1!=null&&g1-g0>=5) add('gust-up',T('Ανέβηκαν οι ριπές: ','Gusts rose: ')+W(g0)+' → '+W(g1)+'.',1);
    /* πίεση: τάση στις 3 ώρες πριν το τέλος και στις 2 μετά */
    var pA=at(S,'pressure_msl',E-3*HOUR), pE=at(S,'pressure_msl',E), pB=at(S,'pressure_msl',AF);
    if(pE!=null&&pB!=null){ var dp=pB-pE, dpre=pA!=null?pE-pA:null;
      if(dp<=-0.8) add('press-fall',T('Η πίεση άρχισε να πέφτει: ','Pressure began falling: ')+P(pE)+' → '+P(pB)+T(' σε 2 ώρες.',' in 2 hours.'),dp<=-1.5?3:2);
      else if(dp>=0.8) add('press-rise',T('Η πίεση άρχισε να ανεβαίνει: ','Pressure began rising: ')+P(pE)+' → '+P(pB)+T(' σε 2 ώρες.',' in 2 hours.'),2);
      else if(dpre!=null&&Math.abs(dpre)>=0.8&&Math.abs(dp)<0.4) add('press-flat',T('Η πίεση που άλλαζε σταμάτησε να αλλάζει.','Pressure that had been changing levelled off.'),1); }
    /* στάθμη θάλασσας (παλίρροια): αλλαγή κατεύθυνσης κοντά στο τέλος */
    var sl=S.sea_level_height_msl; if(sl){ var lv=function(ms){ return at(S,'sea_level_height_msl',ms); }, a1=lv(E-HOUR), a2=lv(E), a3=lv(E+HOUR), a4=lv(E+H2);
      if(a1!=null&&a2!=null&&a3!=null){ var up0=a2-a1, up1=(a4!=null?a4:a3)-a2;
        if(up0>0.005&&up1<-0.005) add('tide-turn',T('Γύρισε η παλίρροια γύρω στις ','The tide turned around ')+end+T(': από πλημμυρίδα σε άμπωτη.',': from rising to falling.'),3);
        else if(up0<-0.005&&up1>0.005) add('tide-turn',T('Γύρισε η παλίρροια γύρω στις ','The tide turned around ')+end+T(': από άμπωτη σε πλημμυρίδα.',': from falling to rising.'),3);
        else if(Math.abs(up0)>0.01&&Math.abs(up1)<0.004) add('tide-slack',T('Η στάθμη της θάλασσας σταμάτησε να κινείται (νεκρό νερό).','The sea level stopped moving (slack water).'),2); } }
    /* ρεύμα */
    var c0=mean(S,'ocean_current_velocity',A,E), c1=mean(S,'ocean_current_velocity',E,AF), cd0=amean(S,'ocean_current_direction',A,E), cd1=amean(S,'ocean_current_direction',E,AF);
    if(c0!=null&&c1!=null){ var ckn=function(v){ return (Math.round(v/1.852*10)/10)+' kn'; };   /* km/h → kn */
      if(c1-c0>=0.4) add('cur-up',T('Δυνάμωσε το ρεύμα: ','The current got stronger: ')+ckn(c0)+' → '+ckn(c1)+'.',2); else if(c0-c1>=0.4) add('cur-down',T('Έπεσε το ρεύμα: ','The current weakened: ')+ckn(c0)+' → '+ckn(c1)+'.',2);
      if(cd0!=null&&cd1!=null&&Math.max(c0,c1)>=0.3&&Math.abs(turn(cd0,cd1))>=60) add('cur-turn',T('Το ρεύμα άλλαξε κατεύθυνση: προς ','The current changed direction: towards ')+dn(cd0)+' → '+dn(cd1)+'.',2); }
    /* κύμα, νερό, συννεφιά */
    var v0=mean(S,'wave_height',A,E), v1=mean(S,'wave_height',E,AF); if(v0!=null&&v1!=null&&v1-v0>=0.2) add('wave-up',T('Ανέβηκε το κύμα: ','The waves grew: ')+M(v0)+' → '+M(v1)+'.',2);
    var s0=mean(S,'sea_surface_temperature',A,E), s1=mean(S,'sea_surface_temperature',E,AF); if(s0!=null&&s1!=null&&Math.abs(s1-s0)>=0.5) add('sst',T('Άλλαξε η θερμοκρασία του νερού: ','Water temperature changed: ')+s0.toFixed(1)+' → '+s1.toFixed(1)+' °C.',1);
    var k0=mean(S,'cloud_cover',A,E), k1=mean(S,'cloud_cover',E,AF); if(k0!=null&&k1!=null&&Math.abs(k1-k0)>=40) add(k1>k0?'cloud-up':'cloud-down',k1>k0?T('Συννέφιασε.','It clouded over.'):T('Καθάρισε ο ουρανός.','The sky cleared.'),1);
  }
  /* ήλιος και σελήνη (υπολογισμός, όχι μοντέλο) */
  var PF=window.PF, la=b.lat, lo=b.lon;
  if(PF&&PF.sunMoon&&typeof la==='number'){
    try{ var sm=PF.sunMoon(b.date,la,lo,tz), d0m=Date.UTC.apply(null,b.date.split('-').map(Number).map(function(x,i){ return i===1?x-1:x; }))-tz*MIN, near=function(min){ return min!=null&&Math.abs(d0m+min*MIN-E)<=40*MIN; };
      if(near(sm.set)) add('sunset',T('Συμπίπτει με τη δύση του ηλίου (','Around sunset (')+hm(d0m+sm.set*MIN,tz)+').',3);
      else if(sm.set!=null&&Math.abs(d0m+(sm.set+35)*MIN-E)<=25*MIN) add('dusk',T('Τέλος σούρουπου: σκοτείνιασε.','End of dusk: it got dark.'),2);
      if(near(sm.rise)) add('sunrise',T('Συμπίπτει με την ανατολή του ηλίου (','Around sunrise (')+hm(d0m+sm.rise*MIN,tz)+').',3);
      var ev=PF.moonEvents?PF.moonEvents(E-HOUR,E+HOUR,la,lo):[], ill=Math.round((sm.illum||0)*100);
      ev.forEach(function(x){ if(Math.abs(x.t-E)>45*MIN) return;
        if(x.type==='rise') add('moonrise',T('Ανέτειλε η σελήνη στις ','The moon rose at ')+hm(x.t,tz)+' ('+ill+'%'+T(' φωτισμένη',' lit')+').',ill>=30?3:1);
        else if(x.type==='set') add('moonset',T('Έδυσε η σελήνη στις ','The moon set at ')+hm(x.t,tz)+'.',ill>=30?2:1);
        else if(x.type==='upper') add('transit',T('Η σελήνη μεσουράνησε στις ','The moon was overhead at ')+hm(x.t,tz)+'.',1); });
      if(PF.solunarPeriods){ var per=PF.solunarPeriods(A,E+HOUR,la,lo).filter(function(p){ return Math.abs((edge==='start'?p.s:p.e)-E)<=30*MIN; })[0];
        if(per) if(edge==='start') add('solunar-start',T('Άρχισε μια ','A ')+(per.kind==='major'?T('κύρια','major'):T('δευτερεύουσα','minor'))+T(' περίοδος σελήνης (solunar) περίπου τότε.',' solunar period began about then.'),1); else add('solunar-end',T('Τελείωσε μια ','A ')+(per.kind==='major'?T('κύρια','major'):T('δευτερεύουσα','minor'))+T(' περίοδος σελήνης (solunar) περίπου τότε.',' solunar period ended about then.'),1); }
    }catch(e){}
  }
  out.sort(function(x,y){ return y.w-x.w; });
  return out;
}

/* 1.12.12: τι ίσχυε ΟΣΟ τσιμπούσαν (από–έως): άνεμος, πίεση, κύμα, στάθμη, ρεύμα, νερό, ουρανός, φως, σελήνη */
function during(b,S){
  var s=span(b), out=[]; if(!s) return out; var A=s.a, E=s.e, tz=s.tz;
  function add(t){ out.push({t:t,w:1}); }
  if(S){
    var w=mean(S,'wind_speed_10m',A,E), d=amean(S,'wind_direction_10m',A,E), g=mean(S,'wind_gusts_10m',A,E);
    if(w!=null) add(T('Άνεμος: ','Wind: ')+(w>=2&&d!=null?dn(d)+' ':'')+W(w)+(g!=null&&g-w>=4?T(', ριπές ',', gusts ')+W(g):'')+'.');
    var p0=at(S,'pressure_msl',A), p1=at(S,'pressure_msl',E);
    if(p0!=null&&p1!=null){ var dp=p1-p0; add(T('Πίεση: ','Pressure: ')+P(p0)+' → '+P(p1)+' ('+(Math.abs(dp)<0.4?T('σταθερή','steady'):dp>0?T('ανέβαινε','rising'):T('έπεφτε','falling'))+').'); }
    var v=mean(S,'wave_height',A,E); if(v!=null) add(T('Κύμα: ','Waves: ')+M(v)+'.');
    if(S.sea_level_height_msl){ var l0=at(S,'sea_level_height_msl',A), l1=at(S,'sea_level_height_msl',E), lm=at(S,'sea_level_height_msl',(A+E)/2);
      if(l0!=null&&l1!=null&&lm!=null){ var u1=lm-l0, u2=l1-lm, cm=function(x){ return (x>0?'+':'')+Math.round(x*100)+' cm'; };
        add(T('Στάθμη θάλασσας: ','Sea level: ')+(u1>0.004&&u2<-0.004?T('ανέβαινε και μετά κατέβαινε (γύρισε μέσα στο παράθυρο)','rose then fell (turned during the window)'):u1<-0.004&&u2>0.004?T('κατέβαινε και μετά ανέβαινε (γύρισε μέσα στο παράθυρο)','fell then rose (turned during the window)'):Math.abs(l1-l0)<0.006?T('σχεδόν ακίνητη (νεκρό νερό)','almost still (slack)'):l1>l0?T('ανέβαινε (πλημμυρίδα)','rising (flood)'):T('κατέβαινε (άμπωτη)','falling (ebb)'))+' · '+cm(l1-l0)+'.'); } }
    var c=mean(S,'ocean_current_velocity',A,E), cd=amean(S,'ocean_current_direction',A,E);
    if(c!=null) add(T('Ρεύμα: ','Current: ')+(Math.round(c/1.852*10)/10)+' kn'+(cd!=null&&c>=0.2?T(' προς ',' towards ')+dn(cd):'')+'.');
    var st=mean(S,'sea_surface_temperature',A,E); if(st!=null) add(T('Νερό: ','Water: ')+st.toFixed(1)+' °C.');
    var k=mean(S,'cloud_cover',A,E); if(k!=null) add(T('Ουρανός: ','Sky: ')+(k<20?T('καθαρός','clear'):k<60?T('λίγα σύννεφα','some clouds'):T('συννεφιά','cloudy'))+' ('+Math.round(k)+'%).');
  }
  var PF=window.PF, la=b.lat, lo=b.lon;
  if(PF&&PF.sunMoon&&typeof la==='number'){
    try{ var sm=PF.sunMoon(b.date,la,lo,tz), d0m=Date.UTC.apply(null,b.date.split('-').map(Number).map(function(x,i){ return i===1?x-1:x; }))-tz*MIN,
        ss=sm.set!=null?d0m+sm.set*MIN:null, sr=sm.rise!=null?d0m+sm.rise*MIN:null, dk=ss!=null?ss+35*MIN:null;
      var light=function(ms){ return (sr!=null&&ms<sr-30*MIN)||(dk!=null&&ms>=dk)?'night':(ss!=null&&ms>=ss&&ms<dk)||(sr!=null&&ms>=sr-30*MIN&&ms<sr+20*MIN)?'twi':'day'; },
          LN={day:T('μέρα','daylight'),twi:T('σούρουπο/χάραμα','twilight'),night:T('σκοτάδι','dark')}, la0=light(A), la1=light(E);
      add(T('Φως: ','Light: ')+(la0===la1?LN[la0]:LN[la0]+' → '+LN[la1])+(ss!=null?T(' · δύση ',' · sunset ')+hm(ss,tz):'')+'.');
      var ill=Math.round((sm.illum||0)*100), up0=PF.moonAlt?PF.moonAlt(A,la,lo)>0.125:null, up1=PF.moonAlt?PF.moonAlt(E,la,lo)>0.125:null;
      add(T('Σελήνη: ','Moon: ')+ill+'%'+T(' φωτισμένη',' lit')+(up0==null?'':' · '+(up0&&up1?T('πάνω από τον ορίζοντα','above the horizon'):!up0&&!up1?T('κάτω από τον ορίζοντα','below the horizon'):up1?T('ανέτειλε μέσα στο παράθυρο','rose during the window'):T('έδυσε μέσα στο παράθυρο','set during the window')))+'.');
      if(PF.solunarPeriods){ var per=PF.solunarPeriods(A-HOUR,E+HOUR,la,lo).filter(function(p){ return p.e>A&&p.s<E; });
        if(per.length) add(T('Περίοδος solunar μέσα στο παράθυρο: ','Solunar period inside the window: ')+per.map(function(p){ return (p.kind==='major'?T('κύρια','major'):T('δευτερεύουσα','minor'))+' '+hm(p.s,tz)+'–'+hm(p.e,tz); }).join(', ')+'.'); }
    }catch(e){}
  }
  return out;
}
/* ---------- εμφάνιση ---------- */
function pattern(edge){ var f=edge==='start'?'ks':'k', S=B.store, all=(S&&S.bites?S.bites():[]).filter(function(x){ return x.winx&&x.winx[f]; }), n=all.length; if(n<3) return null;
  var c={}; all.forEach(function(x){ x.winx[f].forEach(function(k){ c[k]=(c[k]||0)+1; }); });
  var top=Object.keys(c).sort(function(a,b){ return c[b]-c[a]; }).filter(function(k){ return c[k]>=2&&c[k]/n>=0.4; }).slice(0,3); if(!top.length) return null;
  var L={'tide-turn':T('γύρισε η παλίρροια','the tide turned'),'tide-slack':T('νεκρό νερό','slack water'),'wind-up':T('δυνάμωσε ο άνεμος','the wind picked up'),'wind-down':T('έπεσε ο άνεμος','the wind dropped'),'wind-turn':T('γύρισε ο άνεμος','the wind shifted'),
    'press-fall':T('έπεφτε η πίεση','pressure was falling'),'press-rise':T('ανέβαινε η πίεση','pressure was rising'),'press-flat':T('σταθεροποιήθηκε η πίεση','pressure levelled off'),'cur-up':T('δυνάμωσε το ρεύμα','the current got stronger'),'cur-down':T('έπεσε το ρεύμα','the current weakened'),
    'cur-turn':T('γύρισε το ρεύμα','the current turned'),'wave-up':T('ανέβηκε το κύμα','the waves grew'),sunset:T('έδυε ο ήλιος','sunset'),dusk:T('σκοτείνιασε','it got dark'),sunrise:T('ανέτειλε ο ήλιος','sunrise'),moonrise:T('ανέτειλε η σελήνη','moonrise'),moonset:T('έδυε η σελήνη','moonset'),
    transit:T('μεσουράνημα σελήνης','moon overhead'),'solunar-end':T('τέλος περιόδου solunar','end of a solunar period'),'solunar-start':T('αρχή περιόδου solunar','start of a solunar period'),'cloud-up':T('συννέφιασε','it clouded over'),'cloud-down':T('καθάρισε','it cleared'),sst:T('άλλαξε η θερμοκρασία νερού','water temperature changed'),'gust-up':T('ανέβηκαν οι ριπές','gusts rose')};
  return T('Στα ','In your ')+n+(edge==='start'?T(' παράθυρά σου άρχισαν πιο συχνά όταν: ',' windows they most often started when: '):T(' παράθυρά σου σταμάτησαν πιο συχνά όταν: ',' windows they most often stopped when: '))+top.map(function(k){ return (L[k]||k)+' ('+c[k]+'/'+n+')'; }).join(', ')+'.'; }
function card(b){
  var s=span(b); if(!s) return null; var box=h('div',{class:'card bwin'}), res=h('div',{class:'bwres'});
  var dur=Math.round((s.e-s.a)/MIN), dtx=dur>=60?(Math.floor(dur/60)+T(' ώρ.',' h')+(dur%60?' '+dur%60+T(' λ.',' min'):'')):dur+T(' λ.',' min');
  var go=h('button',{type:'button',class:'btn full',text:T('Τι άλλαξε όταν άρχισαν και όταν σταμάτησαν;','What changed when they started and stopped?'),onclick:function(){ run(); }});
  box.append(h('h2',{text:T('Τσιμπούσαν ','Biting ')+b.win.a+'–'+b.win.b+' ('+dtx+')'}),res,go);
  /* 1.12.12: η ανάλυση τρέχει μόνη της όταν ανοίγεις το ψάρι (αν έχει ίντερνετ)· το κουμπί μένει για νέα προσπάθεια */
  if(navigator.onLine!==false&&typeof b.lat==='number'&&s.e<=Date.now()+10*MIN) setTimeout(function(){ if(box.isConnected||true) run(); },50);
  function run(){ if(typeof b.lat!=='number'){ res.replaceChildren(h('p',{class:'sub',text:T('Χρειάζεται θέση στο ψάρι για τον καιρό.','The catch needs a position for the weather.')})); return; }
    if(s.e>Date.now()+10*MIN){ res.replaceChildren(h('p',{class:'sub',text:T('Το παράθυρο δεν έχει τελειώσει ακόμα.','The window has not ended yet.')})); return; }
    go.disabled=true; go.textContent=T('Αναζήτηση καιρού…','Looking up weather…');
    var net=navigator.onLine===false?Promise.resolve(null):fetchSeries(b.lat,b.lon,s).catch(function(){ return null; });
    net.then(function(S){ var c0=analyze(b,S,'start'), c1=analyze(b,S,'end'), cd=during(b,S); show(c0,c1,!!S,cd); go.dataset.ok=S?'1':'';
      try{ var St=B.store, cur=St&&St.get?St.get('bites',b.id):null; if(cur&&S){ St.save('bites',Object.assign({},cur,{winx:{v:2,k:c1.map(function(c){ return c.k; }),ks:c0.map(function(c){ return c.k; }),at:Date.now()}})); } }catch(e){} })
      .then(function(){ if(go.dataset.ok) go.hidden=true; else { go.disabled=false; go.textContent=T('Ξαναδοκίμασε με ίντερνετ','Try again with internet'); } }); }
  function part(title,ch,hasWx,edge){ var d=h('div',{class:'bwpart'}); d.append(h('h3',{text:title}));
    if(ch.length) d.append(h('ul',{class:'law'},ch.slice(0,6).map(function(c){ return h('li',{class:c.w>=3?'big':null,text:c.t}); })));
    else d.append(h('p',{class:'p',text:hasWx?T('Καμία μεγάλη αλλαγή σε άνεμο, πίεση, κύμα, στάθμη, ρεύμα, ήλιο ή σελήνη.','No big change in wind, pressure, waves, sea level, current, sun or moon.'):T('Καμία αλλαγή σε ήλιο ή σελήνη.','No change in sun or moon.')}));
    var pt=pattern(edge); if(pt) d.append(h('p',{class:'p bwpat',text:'📊 '+pt})); return d; }
  function show(c0,c1,hasWx,cd){ res.replaceChildren();
    if(!hasWx) res.append(h('p',{class:'sub',text:T('Δεν βρέθηκε καιρός για εκείνες τις ώρες (χρειάζεται ίντερνετ). Δείχνω μόνο ήλιο και σελήνη.','No weather found for those hours (needs internet). Showing only sun and moon.')}));
    /* 1.12.12: τρία κομμάτια: τι άλλαξε πριν αρχίσουν · τι ίσχυε όσο τσιμπούσαν · τι άλλαξε όταν σταμάτησαν */
    var dur=h('div',{class:'bwpart bwdur'},h('h3',{text:T('② Όσο τσιμπούσαν (','② While they were biting (')+b.win.a+'–'+b.win.b+')'}),cd&&cd.length?h('ul',{class:'law'},cd.map(function(c){ return h('li',{text:c.t}); })):h('p',{class:'p',text:'–'}));
    res.append(part(T('① Πριν αρχίσουν (','① Before they started (')+b.win.a+T('): τι άλλαξε σε σχέση με τις 2 ώρες πριν','): what changed compared with the 2 hours before'),c0,hasWx,'start'),dur,
      part(T('③ Όταν σταμάτησαν (','③ When they stopped (')+b.win.b+T('): τι άλλαξε τις 2 ώρες μετά','): what changed in the 2 hours after'),c1,hasWx,'end'));
    if(!c0.length&&!c1.length&&hasWx) res.append(h('p',{class:'p',text:T('Ίσως άλλαξε κάτι τοπικά (π.χ. το κοπάδι ήρθε ή έφυγε, θόρυβος, φώτα, άλλα σκάφη).','Something local may have changed (e.g. the school arrived or left, noise, lights, other boats).')}));
    res.append(h('p',{class:'note',text:T('Καιρός από μοντέλο (Open-Meteo), όχι μέτρηση στο σημείο· η στάθμη θάλασσας είναι εκτίμηση. Δείχνει τι συνέπεσε χρονικά, όχι σίγουρα την αιτία. Με περισσότερα παράθυρα φαίνεται μοτίβο.','Model weather (Open-Meteo), not a measurement at the spot; sea level is an estimate. It shows what coincided, not a sure cause. More windows reveal a pattern.')})); }
  return box; }
B.biteWin={span:span,analyze:analyze,during:during,card:card,fetch:fetchSeries,pattern:pattern};
})();
