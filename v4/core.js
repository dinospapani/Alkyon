/* Alkyon 4 · πυρήνας: γλώσσα, αποθήκευση, γεγονότα, δημιουργία στοιχείων, θέση.
   Τα δεδομένα είναι κοινά με την κλασική έκδοση (ίδια κλειδιά localStorage, ίδια μορφή εγγραφών). */
/* 1.8.33: append/prepend/replaceChildren αγνοούν null/undefined/false. Ο DOM γράφει αλλιώς «null» στην οθόνη
   (π.χ. «Όρια ασφαλείας: null», «Αναγνώριση ψαριού: null») όπου ένα προαιρετικό στοιχείο δεν υπάρχει. */
(function(){ ['append','prepend','replaceChildren'].forEach(function(m){ [Element.prototype,DocumentFragment.prototype].forEach(function(P){ var o=P[m]; if(!o||o.__alk) return;
  var f=function(){ var a=[]; for(var i=0;i<arguments.length;i++){ var x=arguments[i]; if(x!=null&&x!==false) a.push(x); } return o.apply(this,a); }; f.__alk=1; P[m]=f; }); }); })();
(function(){
'use strict';

/* ---------- γλώσσα ---------- */
var LANG='el';
try{ LANG=localStorage.getItem('alkyon-lang')||'el'; /* 1.6.6: πάντα Ελληνικά εκτός αν διαλέξεις English στο Προφίλ */ }catch(e){}
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
function records(kind){ var a=ls.get('alkyon-'+kind,[]); return Array.isArray(a)?a:[]; }

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
/* η τελευταία γνωστή θέση: πρώτα από αυτή την έκδοση, μετά από την κλασική (alkyon-cond) */
function lastPos(){
  var a=ls.get('alkyon-v4-pos',null); if(a&&typeof a.lat==='number') return a;
  var c=ls.get('alkyon-cond',null); if(c&&typeof c.lat==='number') return {lat:c.lat,lon:c.lon,t:0};
  return null;
}
function locate(timeout){
  return new Promise(function(res){
    if(!navigator.geolocation){ res(lastPos()); return; }
    var done=false, fin=function(p){ if(done) return; done=true; res(p); };
    setTimeout(function(){ fin(lastPos()); },(timeout||9000)+500);
    navigator.geolocation.getCurrentPosition(function(p){
      var v={lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),t:Date.now()}; ls.set('alkyon-v4-pos',v); fin(v);
    },function(){ fin(lastPos()); },{enableHighAccuracy:false,maximumAge:10*60000,timeout:timeout||9000});
  });
}

/* ---------- προφίλ ψαρέματος ---------- */
var PROF={boat:T('Βάρκα','Offshore'),shore:T('Στεριά','Shore'),lake:T('Λίμνη','Lake'),spear:T('Ψαροντούφεκο','Spearfishing')};
function prof(){ var p=ls.raw('alkyon-fprof'); return PROF[p]?p:'boat'; }

window.AK={LANG:LANG,EN:EN,T:T,ls:ls,records:records,KINDS:KINDS,on:on,emit:emit,h:h,s:s,pad:pad,hm:hm,dayName:dayName,dateShort:dateShort,DAYS3:DAYS3,num:num,lastPos:lastPos,locate:locate,prof:prof,PROF:PROF,
  classic:function(q){ return '../'+(q||''); }};   /* 1.10.11: το classic.html αφαιρέθηκε· η ρίζα κάνει την ίδια ανακατεύθυνση */
/* v31z542: χωροκατακτητικά τοξικά (λαγοκέφαλοι) και «έφαγε το δόλωμα / έκοψε»: καταγράφονται, αλλά δεν μετράνε ως ψάρια */
var PEST_L=['Lagocephalus sceleratus','Lagocephalus lagocephalus','Lagocephalus suezensis','Lagocephalus spadiceus','Torquigener flavimaculosus','Sphoeroides pachygaster'];
window.AK.PEST_L=PEST_L;
/* 1.11.0: χώρα από τη θέση: 'cy' Κύπρος, 'gr' Ελλάδα, αλλιώς null. Χοντρικά όρια· τα τουρκικά παράλια του Αιγαίου εξαιρούνται. */
window.AK.region=function(lat,lon){ if(lat==null||lon==null||isNaN(lat)||isNaN(lon)) return null; lat=+lat; lon=+lon;
  if(lat>34.4&&lat<35.8&&lon>32.1&&lon<34.7) return 'cy';
  if(lat<34.75||lat>41.8||lon<19.2||lon>29.8) return null;
  if(lat>40.6&&lon>26.65) return null;                          /* Ανατολική Θράκη */
  if(lat>38.45&&lat<=40.6&&lon>26.64) return null;              /* απέναντι από Λέσβο (Αϊβαλί) */
  if(lat>38.15&&lat<=38.45&&lon>26.24) return null;             /* Τσεσμέ, απέναντι από Χίο */
  if(lat>37.3&&lat<=38.15&&lon>27.15) return null;              /* απέναντι από Σάμο */
  if(lat>36.93&&lat<=37.3&&lon>27.38) return null;              /* Αλικαρνασσός (η Κως φτάνει ~27,36) */
  if(lat>36.68&&lat<=36.93&&lon>27.45) return null;             /* χερσόνησος Δάτσας, Μαρμαρίς (η Σύμη είναι νοτιότερα) */
  if(lat>36.0&&lat<=36.68&&lon>28.3&&!(lat<36.17&&lon>29.5&&lon<29.62)) return null;   /* νότια παράλια Τουρκίας, εκτός Καστελλόριζου */
  return 'gr'; };
/* η χώρα του χρήστη. 1.11.4: ρύθμιση alkyon-country = 'auto' ή κωδικός ISO (cy, gr, it, …) από όλες τις χώρες.
   «Αυτόματα»: από την τελευταία θέση (cy, gr ή 'xx' = άλλη χώρα), αλλιώς η τελευταία γνωστή, αλλιώς '' (άγνωστη: ο Οδηγός ρωτάει). */
window.AK.country=function(){ var c=ls.get('alkyon-country','auto'); if(c&&c!=='auto'&&/^[a-z]{2}$/.test(c)) return c; var p=lastPos(); if(p&&typeof p.lat==='number'){ var r=window.AK.region(p.lat,p.lon)||'xx'; ls.set('alkyon-country-last',r); return r; } return ls.get('alkyon-country-last','')||''; };
/* όλες οι χώρες (ISO 3166-1), με ονόματα από τον browser (Intl.DisplayNames) στη γλώσσα της εφαρμογής */
window.AK.COUNTRIES='ad ae af ag ai al am ao ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw'.split(' ');
window.AK.countryName=function(c){ if(!c) return ''; if(c==='xx') return EN?'Another country':'Άλλη χώρα'; if(c==='cy') return EN?'Cyprus':'Κύπρος'; if(c==='gr') return EN?'Greece':'Ελλάδα';
  try{ return new Intl.DisplayNames([EN?'en':'el'],{type:'region'}).of(c.toUpperCase())||c.toUpperCase(); }catch(e){ return c.toUpperCase(); } };
/* <select> με «Αυτόματα» και όλες τις χώρες, ταξινομημένες με το όνομα */
window.AK.countrySelect=function(cur,fn){ var A=window.AK, s=document.createElement('select'); s.className='ctrysel'; s.setAttribute('aria-label',EN?'Country':'Χώρα');
  var o=document.createElement('option'); o.value='auto'; o.textContent=EN?'Automatic (from your location)':'Αυτόματα (από τη θέση σου)'; s.appendChild(o);
  A.COUNTRIES.map(function(c){ return [c,A.countryName(c)]; }).sort(function(a,b){ return a[1].localeCompare(b[1],EN?'en':'el'); }).forEach(function(x){ var q=document.createElement('option'); q.value=x[0]; q.textContent=x[1]; s.appendChild(q); });
  s.value=cur&&cur!=='xx'?cur:'auto'; s.addEventListener('change',function(){ fn(s.value); }); return s; };
/* 1.10.11: υποδιαστολή στα ελληνικά. Ό,τι εμφανίζεται (κείμενο σελίδας και γραφήματα σε canvas) γράφει «1,5 m» αντί «1.5 m».
   Δεν αλλάζουν: αποθηκευμένα δεδομένα, πεδία που γράφεις (input/textarea), εκδόσεις (1.10.11), συντεταγμένες με 4+ δεκαδικά,
   λεπτά μοιρών (42.071′), ό,τι έχει κλάση .nodec. Τα αγγλικά μένουν με τελεία. */
var DEC=/(^|[^\d.,:\/\w])(\d+)\.(\d{1,3})(?![\d.'′°])/g;
function decEl(t){ return (t&&t.indexOf('.')>=0&&/\d\.\d/.test(t))?t.replace(DEC,'$1$2,$3'):t; }
window.AK.decEl=decEl;
if(!EN){
  var SKIP='input,textarea,select,script,style,code,pre,.nodec,[contenteditable],.leaflet-control-attribution';
  var fixNode=function(n){ if(n.nodeType===3){ var e=n.parentElement; if(!e||e.closest(SKIP)) return; var v=n.nodeValue, w=decEl(v); if(w!==v) n.nodeValue=w; return; }
    if(n.nodeType!==1||n.closest&&n.closest(SKIP)) return; var tw=document.createTreeWalker(n,NodeFilter.SHOW_TEXT), x; while((x=tw.nextNode())) fixNode(x); };
  var startDec=function(){ fixNode(document.body); try{ new MutationObserver(function(ms){ for(var i=0;i<ms.length;i++){ var m=ms[i]; if(m.type==='characterData') fixNode(m.target); else for(var j=0;j<m.addedNodes.length;j++) fixNode(m.addedNodes[j]); } }).observe(document.body,{childList:true,subtree:true,characterData:true}); }catch(e){} };
  if(document.body) startDec(); else document.addEventListener('DOMContentLoaded',startDec);
  try{ var CP=CanvasRenderingContext2D.prototype; ['fillText','strokeText'].forEach(function(k){ var o=CP[k]; CP[k]=function(t){ var a=[].slice.call(arguments); if(typeof t==='string') a[0]=decEl(t); else if(typeof t==='number') a[0]=decEl(String(t)); return o.apply(this,a); }; }); }catch(e){}
}
window.AK.pest=function(b){ if(!b) return false; if(b.pest) return true; if(b.latin&&PEST_L.indexOf(b.latin)>=0) return true; return /λαγοκ[εέ]φαλ|κουνελ[οό]ψαρ|toadfish|puffer ?fish|lagocephalus|torquigener/i.test(b.species||''); };
})();
