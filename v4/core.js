/* BiteCast 4 · πυρήνας: γλώσσα, αποθήκευση, γεγονότα, δημιουργία στοιχείων, θέση.
   Τα δεδομένα είναι κοινά με την κλασική έκδοση (ίδια κλειδιά localStorage, ίδια μορφή εγγραφών). */
(function(){
'use strict';

/* ---------- γλώσσα ---------- */
var LANG='el';
try{ LANG=localStorage.getItem('psaro-lang')||((navigator.language||'el').slice(0,2)==='el'?'el':'en'); }catch(e){}
if(LANG!=='el'&&LANG!=='en') LANG='el';
window.LANG=LANG;
document.documentElement.lang=LANG;
var EN=LANG==='en';
function T(el,en){ return EN?en:el; }

/* ---------- αποθήκευση ---------- */
var ls={
  get:function(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set:function(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
  raw:function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
};
/* εγγραφές (ψάρια, έξοδοι, σημεία, εξοπλισμός): μόνο ανάγνωση σε αυτή τη φάση· η κλασική έκδοση κάνει τον συγχρονισμό */
var KINDS=['bites','trips','spots','tackle'];
function records(kind){ var a=ls.get('psaro-'+kind,[]); return Array.isArray(a)?a:[]; }

/* ---------- γεγονότα ---------- */
var bus=document.createElement('i');
function on(n,f){ bus.addEventListener(n,function(e){ f(e.detail); }); }
function emit(n,d){ bus.dispatchEvent(new CustomEvent(n,{detail:d})); }
/* αλλαγές από την κλασική έκδοση σε άλλη καρτέλα του browser */
window.addEventListener('storage',function(e){ if(!e.key) return; emit('store',e.key); });

/* ---------- στοιχεία ---------- */
var SVGNS='http://www.w3.org/2000/svg';
function h(tag,props){
  var el=document.createElement(tag);
  if(props) for(var k in props){ var v=props[k]; if(v==null||v===false) continue;
    if(k==='class') el.className=v;
    else if(k==='text') el.textContent=v;
    else if(k==='html') el.innerHTML=v;
    else if(k.slice(0,2)==='on'&&typeof v==='function') el.addEventListener(k.slice(2),v);
    else if(k==='style'&&typeof v==='object') Object.assign(el.style,v);
    else if(k==='data') for(var d in v) el.dataset[d]=v[d];
    else el.setAttribute(k,v===true?'':v); }
  for(var i=2;i<arguments.length;i++) add(el,arguments[i]);
  return el;
}
function add(el,c){ if(c==null||c===false) return; if(Array.isArray(c)){ c.forEach(function(x){ add(el,x); }); return; } el.appendChild(typeof c==='object'?c:document.createTextNode(String(c))); }
function s(tag,attrs){ var el=document.createElementNS(SVGNS,tag); for(var k in attrs||{}) el.setAttribute(k,attrs[k]); for(var i=2;i<arguments.length;i++) add(el,arguments[i]); return el; }

/* ---------- μορφοποίηση ---------- */
function pad(n){ return (n<10?'0':'')+n; }
function hm(min){ min=((Math.round(min)%1440)+1440)%1440; return pad(Math.floor(min/60))+':'+pad(min%60); }
var DAYS=EN?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
var DAYS3=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
var MONTHS=EN?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']:['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
function dateParts(iso){ var d=new Date(iso+'T12:00:00Z'); return {dow:d.getUTCDay(),day:d.getUTCDate(),mon:d.getUTCMonth()}; }
function dayName(iso,today){
  if(today){ if(iso===today) return T('Σήμερα','Today'); var t=new Date(today+'T12:00:00Z'); t.setUTCDate(t.getUTCDate()+1); if(iso===t.toISOString().slice(0,10)) return T('Αύριο','Tomorrow'); }
  return DAYS[dateParts(iso).dow];
}
function dateShort(iso){ var p=dateParts(iso); return p.day+' '+MONTHS[p.mon]; }
function num(v,d){ if(v==null||isNaN(v)) return '–'; var r=(+v).toFixed(d==null?0:d); return EN?r:r.replace('.',','); }

/* ---------- θέση ---------- */
/* η τελευταία γνωστή θέση: πρώτα από αυτή την έκδοση, μετά από την κλασική (psaro-cond) */
function lastPos(){
  var a=ls.get('psaro-v4-pos',null); if(a&&typeof a.lat==='number') return a;
  var c=ls.get('psaro-cond',null); if(c&&typeof c.lat==='number') return {lat:c.lat,lon:c.lon,t:0};
  return null;
}
function locate(timeout){
  return new Promise(function(res){
    if(!navigator.geolocation){ res(lastPos()); return; }
    var done=false, fin=function(p){ if(done) return; done=true; res(p); };
    setTimeout(function(){ fin(lastPos()); },(timeout||9000)+500);
    navigator.geolocation.getCurrentPosition(function(p){
      var v={lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),t:Date.now()}; ls.set('psaro-v4-pos',v); fin(v);
    },function(){ fin(lastPos()); },{enableHighAccuracy:false,maximumAge:10*60000,timeout:timeout||9000});
  });
}

/* ---------- προφίλ ψαρέματος ---------- */
var PROF={boat:T('Βάρκα','Offshore'),shore:T('Στεριά','Shore'),lake:T('Λίμνη','Lake'),spear:T('Ψαροντούφεκο','Spearfishing')};
function prof(){ var p=ls.raw('psaro-fprof'); return PROF[p]?p:'boat'; }

window.BC={LANG:LANG,EN:EN,T:T,ls:ls,records:records,KINDS:KINDS,on:on,emit:emit,h:h,s:s,pad:pad,hm:hm,dayName:dayName,dateShort:dateShort,DAYS3:DAYS3,num:num,lastPos:lastPos,locate:locate,prof:prof,PROF:PROF,
  classic:function(q){ return '../classic.html'+(q||''); }};
/* v31z542: χωροκατακτητικά τοξικά (λαγοκέφαλοι) και «έφαγε το δόλωμα / έκοψε»: καταγράφονται, αλλά δεν μετράνε ως ψάρια */
var PEST_L=['Lagocephalus sceleratus','Lagocephalus lagocephalus','Lagocephalus suezensis','Lagocephalus spadiceus','Torquigener flavimaculosus','Sphoeroides pachygaster'];
window.BC.PEST_L=PEST_L;
window.BC.pest=function(b){ if(!b) return false; if(b.pest) return true; if(b.latin&&PEST_L.indexOf(b.latin)>=0) return true; return /λαγοκ[εέ]φαλ|κουνελ[οό]ψαρ|toadfish|puffer ?fish|lagocephalus|torquigener/i.test(b.species||''); };
})();
