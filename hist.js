/* Ιστορικός καιρός για καταγραφές εκ των υστέρων (Open-Meteo: ERA5 / αναλύσεις μοντέλου).
   Είναι εκτίμηση μοντέλου (~25 km), όχι μέτρηση στο σημείο. Σημειώνεται στο ψάρι ως hist:true. */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var HOUR=3600000, DAY=86400000;
function num(v){ return (typeof v==='number'&&isFinite(v))?v:null; }
function getJson(url,ms){
  var ac=('AbortController' in window)?new AbortController():null, t=setTimeout(function(){ if(ac) ac.abort(); },ms||12000);
  return fetch(url,ac?{signal:ac.signal}:{}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).finally(function(){ clearTimeout(t); });
}
function iso(ms){ return new Date(ms).toISOString().slice(0,10); }
/* ms = στιγμή του ψαριού (UTC ms). Επιστρέφει {wind,wave,press,ptrend,cloud,temp,sst,wavePeriod} ή null. */
function fetchHist(lat,lon,ms){
  var age=Date.now()-ms; if(!(age>0)||typeof lat!=='number'||typeof lon!=='number') return Promise.resolve(null);
  var recent=age<85*DAY, past=Math.min(92,Math.ceil(age/DAY)+2);
  var d1=iso(ms-DAY), d2=iso(ms+HOUR), pos='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&timezone=GMT';
  var wv='temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover', mv='wave_height,wave_period,sea_surface_temperature,sea_level_height_msl';
  var wu=recent?'https://api.open-meteo.com/v1/forecast?'+pos+'&hourly='+wv+'&past_days='+past+'&forecast_days=1&wind_speed_unit=kn'
               :'https://archive-api.open-meteo.com/v1/archive?'+pos+'&hourly='+wv+'&start_date='+d1+'&end_date='+d2+'&wind_speed_unit=kn';
  var mu='https://marine-api.open-meteo.com/v1/marine?'+pos+'&hourly='+mv+(recent?'&past_days='+past+'&forecast_days=1':'&start_date='+d1+'&end_date='+d2);
  return Promise.allSettled([getJson(wu),getJson(mu)]).then(function(r){
    if(r[0].status!=='fulfilled') return null;
    var h=(r[0].value&&r[0].value.hourly)||{}, tm=h.time||[]; if(!tm.length) return null;
    var want=new Date(Math.round(ms/HOUR)*HOUR).toISOString().slice(0,13)+':00', i=tm.indexOf(want); if(i<0) return null;
    var press=num(h.pressure_msl&&h.pressure_msl[i]), old=num(h.pressure_msl&&h.pressure_msl[i-3]), ptrend=null;
    if(press!=null&&old!=null){ var d=press-old; ptrend=d<=-3?'fast':d<=-1?'slow':d>=1?'rise':'stable'; }
    var ws=num(h.wind_speed_10m&&h.wind_speed_10m[i]), cc=num(h.cloud_cover&&h.cloud_cover[i]);
    var wd=num(h.wind_direction_10m&&h.wind_direction_10m[i]);
    var out={wdeg:wd==null?null:Math.round(wd),temp:num(h.temperature_2m&&h.temperature_2m[i]),press:press==null?null:Math.round(press),ptrend:ptrend,wind:ws==null?null:Math.round(ws),
      cloud:cc==null?null:cc<20?'clear':cc<70?'part':'over',wave:null,wavePeriod:null,sst:null};
    if(r[1].status==='fulfilled'){
      var m=(r[1].value&&r[1].value.hourly)||{}, mt=m.time||[], j=mt.indexOf(want);
      if(j>=0){ out.wave=num(m.wave_height&&m.wave_height[j]); out.wavePeriod=num(m.wave_period&&m.wave_period[j]); out.sst=num(m.sea_surface_temperature&&m.sea_surface_temperature[j]);
        var sl=m.sea_level_height_msl; if(sl&&j>0&&j<sl.length-1){ var da=num(sl[j+1])-num(sl[j-1]); if(!isNaN(da)) out.tide=da>0.01?'up':da<-0.01?'down':'slack'; } }
    }
    if(out.wave!=null) out.wave=Math.round(out.wave*10)/10;
    return out;
  }).catch(function(){ return null; });
}
/* Καιρός σε διάστημα [t0,t1] (UTC ms): μέσος/μέγιστος άνεμος (kn), μέγιστο κύμα (m), μέση πίεση και τάση πίεσης. */
function fetchRange(lat,lon,t0,t1){
  var age=Date.now()-t1; if(!(age>0)||!(t1>t0)||typeof lat!=='number'||typeof lon!=='number') return Promise.resolve(null);
  var recent=Date.now()-t0<85*DAY, past=Math.min(92,Math.ceil((Date.now()-t0)/DAY)+2);
  var d1=iso(t0-HOUR), d2=iso(t1+HOUR), pos='latitude='+lat.toFixed(4)+'&longitude='+lon.toFixed(4)+'&timezone=GMT';
  var wu=recent?'https://api.open-meteo.com/v1/forecast?'+pos+'&hourly=pressure_msl,wind_speed_10m&past_days='+past+'&forecast_days=1&wind_speed_unit=kn'
               :'https://archive-api.open-meteo.com/v1/archive?'+pos+'&hourly=pressure_msl,wind_speed_10m&start_date='+d1+'&end_date='+d2+'&wind_speed_unit=kn';
  var mu='https://marine-api.open-meteo.com/v1/marine?'+pos+'&hourly=wave_height'+(recent?'&past_days='+past+'&forecast_days=1':'&start_date='+d1+'&end_date='+d2);
  var a=new Date(Math.floor(t0/HOUR)*HOUR).toISOString().slice(0,13)+':00', b=new Date(Math.ceil(t1/HOUR)*HOUR).toISOString().slice(0,13)+':00';
  function pick(h,key){ var tm=h.time||[], v=h[key]||[], out=[]; for(var i=0;i<tm.length;i++){ if(tm[i]>=a&&tm[i]<=b&&num(v[i])!=null) out.push(v[i]); } return out; }
  return Promise.allSettled([getJson(wu),getJson(mu)]).then(function(r){
    if(r[0].status!=='fulfilled') return null;
    var h=(r[0].value&&r[0].value.hourly)||{}, ws=pick(h,'wind_speed_10m'), ps=pick(h,'pressure_msl'); if(!ws.length&&!ps.length) return null;
    var avg=function(x){ return x.length?x.reduce(function(s,y){ return s+y; },0)/x.length:null; };
    var out={w:ws.length?Math.round(avg(ws)*10)/10:null,wm:ws.length?Math.round(Math.max.apply(null,ws)):null,p:ps.length?Math.round(avg(ps)):null,pd:ps.length>1?Math.round((ps[ps.length-1]-ps[0])*10)/10:null,v:null};
    if(r[1].status==='fulfilled'){ var ms=pick((r[1].value&&r[1].value.hourly)||{},'wave_height'); if(ms.length) out.v=Math.round(Math.max.apply(null,ms)*10)/10; }
    return out;
  }).catch(function(){ return null; });
}
var KEYS=['wind','wdeg','wave','press','ptrend','cloud','temp','sst','tide'];
function empty(b){ return KEYS.every(function(k){ return b[k]==null||b[k]===''; }); }
/* καιρός που πιθανόν δεν αντιστοιχεί στην ώρα του ψαριού: η εγγραφή φτιάχτηκε πολύ μετά (ή πριν) την ώρα του ψαριού */
function created(b){ var n=parseInt(String(b.id||'').slice(0,8),36); return (n>1.6e12&&n<2.1e12)?n:null; }
function suspect(b,ms){ if(b.hist||empty(b)) return false; var c=created(b); return c!=null&&Math.abs(c-ms)>90*60000; }
window.AlkyonHist={fetch:fetchHist,range:fetchRange,keys:KEYS,empty:empty};

/* ---- μαζική συμπλήρωση παλιών ψαριών (ρυθμίσεις θάλασσας) ---- */
(window.AlkyonSeaRows=window.AlkyonSeaRows||[]).push(function(){
  var C=window.AlkyonCore; if(!C||!C.Store||!C.biteMs) return null;
  function todo(){ return ((C.Store.raw?C.Store.raw('bites'):C.Store.get('bites'))||[]).filter(function(b){ return typeof b.lat==='number'&&typeof b.lon==='number'&&(empty(b)||suspect(b,C.biteMs(b))||(b.tide==null&&!b.tideNA)||(b.wdeg==null&&!b.wdegNA))&&C.biteMs(b)<Date.now()-90*60000; }); }
  var r=document.createElement('div'); r.className='sprow'; var x=document.createElement('div'); x.className='sptx';
  var b1=document.createElement('b'); b1.textContent=T('Καιρός παλιών ψαριών','Weather for older catches');
  var sp=document.createElement('span'); function txt(){ var n=todo().length; if(typeof bt!=='undefined'&&bt) bt.hidden=!n; sp.textContent=n?T('Υπάρχουν '+n+' ψάρια με θέση που δεν έχουν καιρό ή έχουν καιρό άλλης ώρας. Θα ενημερωθούν με εκτίμηση ιστορικού (καιρός και στάθμη θάλασσας).','There are '+n+' catches with a position and no weather, or with weather from another time. They will be updated with a historical estimate.'):T('Όλα τα ψάρια με θέση έχουν καιρό.','All catches with a position already have weather.'); }
  txt(); x.append(b1,sp);
  var bt=document.createElement('button'); bt.type='button'; bt.className='spb acc'; bt.textContent=T('Συμπλήρωση','Fill in'); bt.hidden=!todo().length;
  bt.addEventListener('click',function(){
    var list=todo(); if(!list.length){ C.toast(T('Δεν υπάρχει κάτι να συμπληρωθεί.','Nothing to fill in.')); return; }
    bt.disabled=true; var done=0, i=0;
    (function next(){
      if(i>=list.length){ bt.disabled=false; bt.textContent=T('Συμπλήρωση','Fill in'); txt(); C.toast(T('Συμπληρώθηκαν '+done+' από '+list.length+'.','Filled '+done+' of '+list.length+'.')); return; }
      var b=list[i++]; bt.textContent=i+'/'+list.length+'…';
      fetchHist(b.lat,b.lon,C.biteMs(b)).then(function(h){
        if(h&&!empty(b)&&!suspect(b,C.biteMs(b))){ /* έχει ήδη καιρό: συμπληρώνεται μόνο η στάθμη */ var o2=Object.assign({},b), got=false; if(b.tide==null&&!b.tideNA){ if(h.tide!=null){ o2.tide=h.tide; got=true; } else o2.tideNA=true; } if(b.wdeg==null&&!b.wdegNA){ if(h.wdeg!=null){ o2.wdeg=h.wdeg; got=true; } else o2.wdegNA=true; } return C.Store.save('bites',o2).then(function(){ if(got) done++; }); }
        if(h){ var o=Object.assign({},b); var sus=suspect(b,C.biteMs(b)); KEYS.forEach(function(k){ if(h[k]!=null||sus) o[k]=h[k]==null?null:h[k]; }); if(h.wavePeriod!=null) o.wavePeriod=h.wavePeriod; o.hist=true; return C.Store.save('bites',o).then(function(){ done++; }); }
      }).catch(function(){}).then(function(){ setTimeout(next,350); });
    })();
  });
  r.append(x,bt); r.dataset.k='wxold'; return r;
});
})();
