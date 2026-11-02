/* v31z404: Διόρθωση κύματος από τις δικές σου παρατηρήσεις.
   Στο τέλος κάθε εξόδου (θάλασσα): «Πώς ήταν η θάλασσα σε σχέση με την πρόγνωση;» Πιο ήρεμη / Όπως έλεγε / Πιο άγρια.
   Για κάθε περιοχή (15 km) υπολογίζεται συντελεστής (0,6–1,5) από τουλάχιστον 2 παρατηρήσεις, με βάρος στις πρόσφατες
   και συντηρητική προσέγγιση προς το 1. Εφαρμόζεται στο ύψος κύματος της πρόγνωσης (βαθμός, ασφάλεια, εμφάνιση).
   Ο χάρτης κατάστασης θάλασσας μένει όπως τον δίνουν τα μοντέλα. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var KEY='alkyon-seaobs', V={'-1':0.75,'0':1,'1':1.3};
function obs(){ var a=C.lsGet(KEY,[]); return Array.isArray(a)?a:[]; }
function km(a,b,c,d){ var dy=(a-c)*111.2, dx=(b-d)*111.2*Math.cos(a*Math.PI/180); return Math.sqrt(dx*dx+dy*dy); }
function factor(lat,lon){
  if(typeof lat!=='number'||typeof lon!=='number') return null;
  var now=Date.now(), sw=0, sv=0, n=0;
  obs().forEach(function(o){ if(km(lat,lon,o.lat,o.lon)>15) return; var w=Math.pow(0.5,(now-o.t)/(180*86400000)); sw+=w; sv+=w*(V[String(o.f)]||1); n++; });
  if(n<2||!sw) return n?{f:1,n:n}:null;
  var avg=sv/sw, f=1+(avg-1)*n/(n+2); f=Math.max(0.6,Math.min(1.5,f));
  return {f:Math.round(f*100)/100,n:n};
}
/* η πρόγνωση στη σελίδα: το ύψος κύματος από το marine API πολλαπλασιάζεται με τον συντελεστή της περιοχής */
function wrap(){
  var PF=window.PF; if(!PF||!PF.getForecast||PF.getForecast._sc) return;
  var orig=PF.getForecast;
  var g=async function(lat,lon,fetchFn,opt){
    var fc0=factor(lat,lon);
    if(fetchFn||!fc0||Math.abs(fc0.f-1)<0.03) return orig.apply(this,arguments);
    var ff=function(url,o){ return fetch(url,o).then(function(r){
      if(!/marine-api/.test(url)||!r.ok) return r;
      return r.json().then(function(j){ try{ var h=j.hourly; if(h&&h.wave_height) h.wave_height=h.wave_height.map(function(v){ return typeof v==='number'?Math.round(v*fc0.f*100)/100:v; }); }catch(e){}
        return {ok:true,status:200,json:function(){ return Promise.resolve(j); }}; }); }); };
    var fc=await orig.call(this,lat,lon,ff,opt); try{ fc.waveCorr=fc0; }catch(e){} return fc;
  };
  g._sc=1; PF.getForecast=g;
}
wrap(); setTimeout(wrap,1500);

/* ερώτηση στο τέλος εξόδου, μέσα στην κάρτα «Τέλος εξόδου» */
function tripPos(t){
  if(Array.isArray(t.track)&&t.track.length){ var la=0,lo=0,n=0; t.track.forEach(function(p){ var a=Array.isArray(p)?p[0]:p.lat, b=Array.isArray(p)?p[1]:p.lon; if(typeof a==='number'&&typeof b==='number'){ la+=a; lo+=b; n++; } }); if(n) return {lat:la/n,lon:lo/n}; }
  if(typeof t.lat==='number'&&typeof t.lon==='number') return {lat:t.lat,lon:t.lon};
  var c=C.getCond&&C.getCond(); return c&&c.lat!=null?{lat:c.lat,lon:c.lon}:null;
}
function ask(id){
  var prof=''; try{ prof=localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){} if(prof==='lake') return;
  var t=(C.Store.raw('trips')||[]).find(function(x){ return x.id===id; }); if(!t) return;
  var pos=tripPos(t); if(!pos) return;
  var card=document.querySelector('.sumcard'), bt=card&&card.querySelector('.cdbtn'); if(!card||!bt||card.querySelector('.seaq')) return;
  var w=document.createElement('div'); w.className='seaq';
  var lab=document.createElement('div'); lab.className='sumlab'; lab.textContent=T('Πώς ήταν η θάλασσα σε σχέση με την πρόγνωση;','How was the sea compared with the forecast?');
  var row=document.createElement('div'); row.className='seaqb'; var note=document.createElement('p'); note.className='note';
  [[-1,T('Πιο ήρεμη','Calmer')],[0,T('Όπως έλεγε','As forecast')],[1,T('Πιο άγρια','Rougher')]].forEach(function(o){
    var b=document.createElement('button'); b.type='button'; b.textContent=o[1];
    b.addEventListener('click',function(){
      var a=obs().filter(function(x){ return x.trip!==id; }); a.push({t:Date.now(),lat:+pos.lat.toFixed(4),lon:+pos.lon.toFixed(4),f:o[0],trip:id}); C.lsSet(KEY,a.slice(-200));
      [].forEach.call(row.children,function(x){ x.setAttribute('aria-pressed',String(x===b)); });
      var fc=factor(pos.lat,pos.lon);
      note.textContent=!fc||fc.n<2?T('Ευχαριστώ. Μετά από 2 εξόδους στην περιοχή, η πρόγνωση κύματος θα προσαρμόζεται.','Thanks. After 2 trips in this area the wave forecast will adjust.')
        :Math.abs(fc.f-1)<0.03?T('Η πρόγνωση κύματος εδώ ταιριάζει με όσα βλέπεις ('+fc.n+' έξοδοι).','The wave forecast here matches what you see ('+fc.n+' trips).')
        :T('Η πρόγνωση κύματος σε αυτή την περιοχή θα ','The wave forecast in this area will ')+(fc.f<1?T('μειώνεται ','be lowered by '):T('αυξάνεται ','be raised by '))+Math.round(Math.abs(fc.f-1)*100)+'% ('+fc.n+T(' έξοδοι).',' trips).');
    });
    row.append(b);
  });
  w.append(lab,row,note); card.insertBefore(w,bt);
}
window.addEventListener('alkyon-tripend',function(e){ var id=e.detail&&e.detail.id; if(!id) return; [900,1600,2600].forEach(function(ms){ setTimeout(function(){ ask(id); },ms); }); });
var st=document.createElement('style');
st.textContent='.seaq{margin:8px 0}.seaqb{display:flex;gap:6px}.seaqb button{flex:1;min-height:40px;border-radius:10px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font:600 13px system-ui,sans-serif;cursor:pointer}.seaqb button[aria-pressed=true]{background:var(--accent,#c4401c);border-color:transparent;color:#fff}';
document.head.appendChild(st);
window.AlkyonSeaCorr={factor:factor,list:obs,clear:function(){ C.lsSet(KEY,[]); }};
})();
