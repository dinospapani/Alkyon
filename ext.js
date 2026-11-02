/* Δεδομένα φίλου ψαρά (εισαγωγή CSV). Μένουν ΜΟΝΟ σε αυτή τη συσκευή (localStorage), δεν στέλνονται πουθενά και δεν αναμειγνύονται με τα δικά σου ψάρια.
   Για κάθε γραμμή (ημερομηνία, είδος, προαιρετικά ώρα, τρόπος, συντεταγμένες) υπολογίζεται η φάση του φεγγαριού και φέρνεται ο καιρός εκείνης της ώρας από το ιστορικό του Open-Meteo
   (εκτίμηση μοντέλου, όχι μέτρηση στο σημείο). Χρησιμοποιούνται μόνο ως εποχιακή ένδειξη στο «Τι να ψαρέψω», με μικρό βάρος, επειδή ο φίλος καταγράφει μόνο ό,τι έπιασε και όχι τις μέρες χωρίς ψάρια. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var h=C.h, EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-ext', LAND='alkyon-ext-land';
var DEF={lat:34.748,lon:32.402}; /* λίγο έξω από το λιμάνι της Πάφου */
var busy=false;

function load(){ var v=C.lsGet(KEY,[]); return Array.isArray(v)?v:[]; }
function save(a){ C.lsSet(KEY,a); }
function useLand(){ return C.lsGet(LAND,false)===true; }
/* Εγγραφές που μετράνε στο «Τι να ψαρέψω»: από σκάφος ή άγνωστο, και από στεριά μόνο αν το επιτρέψεις. */
function use(){ var l=useLand(); return load().filter(function(r){ return l||r.mode!=='land'; }); }

/* ---------- ώρα Κύπρου -> UTC ---------- */
function lastSun(y,m){ var d=new Date(Date.UTC(y,m+1,0)); return d.getUTCDate()-d.getUTCDay(); }
function cyOffset(y,m,d,hr){ /* EET=+2, EEST=+3: από την τελευταία Κυριακή του Μαρτίου 01:00 UTC ως την τελευταία Κυριακή του Οκτωβρίου 01:00 UTC */
  var a=Date.UTC(y,2,lastSun(y,2),1), b=Date.UTC(y,9,lastSun(y,9),1), t=Date.UTC(y,m,d,hr-2);
  return (t>=a&&t<b)?3:2;
}
function toMs(date,time){
  var p=date.split('-').map(Number), y=p[0], m=p[1]-1, d=p[2], hr=12, mi=0;
  if(time){ var q=time.split(':'); hr=+q[0]; mi=+(q[1]||0); }
  return Date.UTC(y,m,d,hr,mi)-cyOffset(y,m,d,hr)*3600000;
}

/* ---------- ανάγνωση CSV ---------- */
function splitLine(line,sep){
  var out=[], cur='', q=false;
  for(var i=0;i<line.length;i++){
    var ch=line[i];
    if(ch==='"'){ if(q&&line[i+1]==='"'){ cur+='"'; i++; } else q=!q; }
    else if(ch===sep&&!q){ out.push(cur); cur=''; }
    else cur+=ch;
  }
  out.push(cur); return out.map(function(s){ return s.trim(); });
}
function normDate(s){
  s=String(s||'').trim(); var m;
  if((m=/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) return fmt(+m[1],+m[2],+m[3]);
  if((m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(s))){ var y=+m[3]; if(y<100) y+=2000; return fmt(y,+m[2],+m[1]); }
  return null;
}
function fmt(y,m,d){
  if(m<1||m>12||d<1||d>31||y<2000||y>2100) return null;
  var t=new Date(Date.UTC(y,m-1,d)); if(t.getUTCMonth()!==m-1) return null;
  return y+'-'+('0'+m).slice(-2)+'-'+('0'+d).slice(-2);
}
function normTime(s){ var m=/^(\d{1,2})[:.](\d{2})/.exec(String(s||'').trim()); if(!m||+m[1]>23||+m[2]>59) return ''; return ('0'+m[1]).slice(-2)+':'+m[2]; }
function normMode(s){ s=String(s||'').toLowerCase(); if(/στερι|land|shore|βράχ|βραχ|μώλ|μωλ|pier/.test(s)) return 'land'; if(/σκάφ|σκαφ|βάρκ|βαρκ|boat|ship/.test(s)) return 'boat'; return ''; }
function num(s){ var v=parseFloat(String(s||'').replace(',','.')); return isFinite(v)?v:null; }
var HEAD={date:/^(date|ημερομην|ημ\.?)/i, sp:/^(species|είδος|ειδος|ψάρι|ψαρι|fish)/i, time:/^(time|ώρα|ωρα)/i, mode:/^(mode|τρόπος|τροπος|από|απο|type)/i, lat:/^(lat|πλάτος|πλατος)/i, lon:/^(lon|lng|μήκος|μηκος)/i, note:/^(note|σχόλιο|σχολιο|λεζάντα|λεζαντα|σημείωση|σημειωση)/i};
function parse(text){
  var lines=String(text||'').replace(/^﻿/,'').split(/\r?\n/).filter(function(l){ return l.trim(); });
  if(!lines.length) return {rows:[],bad:0};
  var first=lines[0], cnt={';':0,',':0,'\t':0}; Object.keys(cnt).forEach(function(k){ cnt[k]=first.split(k).length-1; });
  var sep=cnt[';']>=cnt[',']&&cnt[';']>=cnt['\t']&&cnt[';']>0?';':cnt['\t']>cnt[',']?'\t':',';
  var cols={date:0,sp:1,time:2,mode:3,lat:4,lon:5,note:6}, start=0, h0=splitLine(first,sep);
  var isHead=h0.some(function(c){ return HEAD.date.test(c)||HEAD.sp.test(c); }) && !normDate(h0[0]);
  if(isHead){
    start=1; cols={}; h0.forEach(function(c,i){ Object.keys(HEAD).forEach(function(k){ if(cols[k]==null&&HEAD[k].test(c)) cols[k]=i; }); });
    if(cols.date==null||cols.sp==null) return {rows:[],bad:lines.length-1,err:'header'};
  }
  var rows=[], bad=0;
  for(var i=start;i<lines.length;i++){
    var c=splitLine(lines[i],sep), d=normDate(c[cols.date]), sp=(c[cols.sp]||'').trim();
    if(!d||!sp){ bad++; continue; }
    rows.push({date:d,sp:sp,time:cols.time!=null?normTime(c[cols.time]):'',mode:cols.mode!=null?normMode(c[cols.mode]):'',
      lat:cols.lat!=null?num(c[cols.lat]):null,lon:cols.lon!=null?num(c[cols.lon]):null,note:cols.note!=null?(c[cols.note]||'').slice(0,120):''});
  }
  return {rows:rows,bad:bad};
}

/* ---------- εμπλουτισμός: φεγγάρι + καιρός ---------- */
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
async function enrich(rec,cache){
  var ms=toMs(rec.date,rec.time), lat=rec.lat!=null?rec.lat:DEF.lat, lon=rec.lon!=null?rec.lon:DEF.lon;
  var PP=window.PP; rec.moon=(PP&&PP.moonOf)?PP.moonOf(ms):null;
  rec.month=+rec.date.slice(5,7)-1; rec.hr=rec.time?+rec.time.slice(0,2):null; rec.nt=!rec.time;
  var H=window.AlkyonHist; if(!H||!H.fetch) return rec;
  var ck=Math.round(ms/3600000)+'|'+lat.toFixed(2)+'|'+lon.toFixed(2), w=cache[ck];
  if(w===undefined){ try{ w=await H.fetch(lat,lon,ms); }catch(e){ w=null; } cache[ck]=w; await sleep(700); }
  if(w){ rec.wind=w.wind; rec.ptrend=w.ptrend; rec.sst=w.sst; rec.wave=w.wave; rec.tide=w.tide||null; rec.wx=true; }
  return rec;
}
async function importText(text,progress){
  if(busy) return {err:'busy'}; busy=true;
  try{
    var P=parse(text); if(P.err) return {err:P.err,bad:P.bad};
    var cur=load(), seen={}; cur.forEach(function(r){ seen[r.date+'|'+r.sp+'|'+r.time+'|'+r.mode]=1; });
    var fresh=P.rows.filter(function(r){ var k=r.date+'|'+r.sp+'|'+r.time+'|'+r.mode; if(seen[k]) return false; seen[k]=1; return true; });
    var cache={}, done=0, wx=0, now=Date.now();
    for(var i=0;i<fresh.length;i++){
      var r=fresh[i]; r.id='x'+now.toString(36)+i;
      if(toMs(r.date,r.time)>now){ r.future=true; }
      await enrich(r,cache); if(r.wx) wx++; done++;
      if(progress) progress(done,fresh.length);
      if(done%10===0||done===fresh.length) save(cur.concat(fresh.slice(0,done).filter(function(q){ return !q.future; })));
    }
    var added=fresh.filter(function(q){ return !q.future; });
    save(cur.concat(added));
    return {added:added.length,dup:P.rows.length-fresh.length,bad:P.bad,wx:wx,future:fresh.length-added.length};
  } finally { busy=false; }
}

/* ---------- κάρτα ---------- */
function summary(){
  var a=load(), land=a.filter(function(r){ return r.mode==='land'; }).length, sp={}; a.forEach(function(r){ sp[r.sp.toLowerCase()]=1; });
  return {n:a.length,land:land,species:Object.keys(sp).length,from:a.length?a.map(function(r){ return r.date; }).sort()[0]:null,to:a.length?a.map(function(r){ return r.date; }).sort().slice(-1)[0]:null};
}
function card(onChange){
  var S=summary(), c=h('div',{class:'card'});
  c.append(h('h3',{text:T('Δεδομένα φίλου ψαρά','A friend’s catches')}));
  c.append(h('p',{class:'note',text:T('Φόρτωσε ένα αρχείο CSV με ημερομηνία και είδος (προαιρετικά ώρα, τρόπος, συντεταγμένες). Το φεγγάρι και ο καιρός συμπληρώνονται αυτόματα. Μένουν μόνο σε αυτή τη συσκευή και χρησιμοποιούνται ως εποχιακή ένδειξη με μικρό βάρος.','Load a CSV file with date and species (optionally time, mode, coordinates). Moon and weather are filled in automatically. Data stays on this device and is used only as a seasonal hint with a small weight.')}));
  if(S.n){
    c.append(h('p',{class:'meta',text:S.n+T(' ψάρια · ',' fish · ')+S.species+T(' είδη · ',' species · ')+S.from+' → '+S.to+(S.land?' · '+S.land+T(' από στεριά',' from shore'):'')}));
    var cb=h('input',{type:'checkbox',id:'extLand'}); cb.checked=useLand();
    cb.addEventListener('change',function(){ C.lsSet(LAND,cb.checked); if(onChange) onChange(); });
    c.append(h('label',{class:'meta',style:'display:flex;gap:6px;align-items:center;margin:6px 0'},cb,h('span',{text:T('Να μετράνε και τα ψάρια από στεριά','Also count catches from shore')})));
  }
  var st=h('div',{class:'meta',style:'margin:6px 0',role:'status'});
  var file=h('input',{type:'file',accept:'.csv,.txt,text/csv,text/plain',style:'display:none'});
  var pick=h('button',{class:'btn sm',type:'button',text:T('Εισαγωγή CSV','Import CSV')});
  pick.addEventListener('click',function(){ file.click(); });
  file.addEventListener('change',async function(){
    var f=file.files&&file.files[0]; if(!f) return; pick.disabled=true;
    try{
      var text=await f.text();
      var r=await importText(text,function(d,n){ st.textContent=T('Φέρνω καιρό και φεγγάρι: ','Fetching weather and moon: ')+d+'/'+n; });
      if(r.err==='header') st.textContent=T('Δεν βρήκα στήλες «ημερομηνία» και «είδος» στην πρώτη γραμμή.','Could not find "date" and "species" columns in the first line.');
      else if(r.err==='busy') st.textContent=T('Τρέχει ήδη εισαγωγή.','An import is already running.');
      else { st.textContent=T('Προστέθηκαν ','Added ')+r.added+T(' ψάρια','')+(r.wx<r.added?T(' (καιρός για ','; weather for ')+r.wx+(EN?')':')'):'')+(r.dup?T(' · διπλότυπα: ',' · duplicates: ')+r.dup:'')+(r.bad?T(' · άκυρες γραμμές: ',' · invalid lines: ')+r.bad:'')+(r.future?T(' · μελλοντικές: ',' · future: ')+r.future:''); if(onChange) setTimeout(onChange,1500); }
    }catch(e){ st.textContent=T('Δεν διαβάστηκε το αρχείο.','Could not read the file.'); }
    pick.disabled=false; file.value='';
  });
  var row=h('div',{class:'row',style:'gap:8px'},pick);
  if(S.n){
    var del=h('button',{class:'btn sm ghost',type:'button',text:T('Διαγραφή όλων','Delete all')});
    del.addEventListener('click',async function(){
      var ok=window.AlkyonAsk?await window.AlkyonAsk(T('Διαγραφή των ψαριών του φίλου από αυτή τη συσκευή;','Delete the friend’s catches from this device?'),{ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel'),danger:true}):false;
      if(ok){ save([]); if(onChange) onChange(); }
    });
    row.append(del);
  }
  c.append(row,st,file);
  c.append(h('p',{class:'note',style:'margin-top:8px',text:T('Στήλες: ημερομηνία (ΕΕΕΕ-ΜΜ-ΗΗ ή ΗΗ/ΜΜ/ΕΕΕΕ), είδος, ώρα (ΩΩ:ΛΛ), τρόπος (στεριά/σκάφος), πλάτος, μήκος, σχόλιο. Χωρίς συντεταγμένες χρησιμοποιείται το λιμάνι της Πάφου. Ο καιρός είναι εκτίμηση μοντέλου.','Columns: date (YYYY-MM-DD or DD/MM/YYYY), species, time (HH:MM), mode (shore/boat), latitude, longitude, note. Without coordinates, Paphos harbour is used. Weather is a model estimate.')}));
  return c;
}
window.AlkyonExt={list:load,use:use,card:card,parse:parse,importText:importText,summary:summary,toMs:toMs,useLand:useLand};
})();
