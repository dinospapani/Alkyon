/* Στατιστικά εργαλείων (δίχτυ, παραγάδι, κλούβες): απόδοση ανά ώρες που ήταν μέσα (ρίψη → ανέβασμα),
   φάση σελήνης στη ρίψη, καιρός όσο ήταν μέσα και μήνας. Ο καιρός είναι εκτίμηση μοντέλου (Open-Meteo). */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var WK='alkyon-gearwx', SK='alkyon-gearstat-type', HOUR=3600000;
var TYPES={net:T('Δίχτυ','Net'),ll:T('Παραγάδι','Longline'),trap:T('Κλούβες','Pots')};
var MOON=T(['Νέα σελήνη','Αύξων μηνίσκος','Πρώτο τέταρτο','Αύξουσα κυρτή','Πανσέληνος','Φθίνουσα κυρτή','Τελευταίο τέταρτο','Φθίνων μηνίσκος'],['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent']);
var MON=T(['Ιαν','Φεβ','Μαρ','Απρ','Μάι','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'],['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']);
var host=null, busy=false, sel=C.lsGet(SK,'all');
function el(t,c,x){ var e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; }
function wxLoad(){ var w=C.lsGet(WK,{}); return (w&&typeof w==='object')?w:{}; }
function wxSave(w){ try{ C.lsSet(WK,w); }catch(e){} }
function ldate(ms){ var d=new Date(ms); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function ptOf(g){ var s=g.set||{}, h=g.haul||{}; return s.a||s.b||h.a||h.b||null; }

/* όλα τα ολοκληρωμένα εργαλεία: τοπικά + από τις συνόψεις των εξόδων (συγχρονισμένα) */
function items(){
  var out=[], seen={}, G=window.AlkyonGear&&window.AlkyonGear.state?window.AlkyonGear.state():{items:[]};
  var bites=C.Store.get('bites')||[];
  function fish(id){ var n=0,kg=0; bites.forEach(function(b){ if(b.gear===id){ n++; kg+=b.rel?0:(+b.kg||0); } }); return {n:n,kg:Math.round(kg*10)/10}; }
  function add(g,f){
    if(!g||!g.id||seen[g.id]) return; var s=g.set||{}, h=g.haul||{};
    var t0=s.ta, t1=h.tb||h.ta; if(!t0||!t1||s.unknown||t1<=t0||t1-t0>96*HOUR) return;
    seen[g.id]=1; out.push({id:g.id,type:g.type,name:g.name,t0:t0,t1:t1,hrs:(t1-t0)/HOUR,n:f.n,kg:f.kg,pos:ptOf(g)});
  }
  (G.items||[]).forEach(function(g){ if(g.state==='done') add(g,fish(g.id)); });
  (C.Store.get('trips')||[]).forEach(function(t){ (t.gear||[]).forEach(function(g){ add(g,{n:+g.n||0,kg:+g.kg||0}); }); });
  return out;
}
function moonIdx(ms){ try{ return window.AlkyonInsights.phaseAt(ms).idx; }catch(e){ return null; } }

/* καιρός: φέρνει ό,τι λείπει, ένα-ένα, και ξαναζωγραφίζει */
function fillWx(list){
  var w=wxLoad(), todo=list.filter(function(g){ var c=w[g.id]; return g.pos&&(!c||(c.x===0&&Date.now()-(c.at||0)>6*HOUR)); });
  if(!todo.length||busy||!window.AlkyonHist||!window.AlkyonHist.range||navigator.onLine===false) return;
  busy=true; var i=0;
  (function next(){
    if(i>=todo.length||i>=12){ busy=false; paint(); return; }
    var g=todo[i++];
    window.AlkyonHist.range(g.pos[0],g.pos[1],g.t0,g.t1).then(function(r){
      var ww=wxLoad(); ww[g.id]=r?{x:1,w:r.w,wm:r.wm,v:r.v,p:r.p,pd:r.pd}:{x:0,at:Date.now()}; wxSave(ww);
      if(host) host.querySelector('.gsnote')&&(host.querySelector('.gsnote').textContent=T('Φέρνω καιρό… ','Fetching weather… ')+i+'/'+Math.min(todo.length,12));
      setTimeout(next,250);
    });
  })();
}
function group(list,keyFn,order){
  var m={}; list.forEach(function(g){ var k=keyFn(g); if(k==null) return; var o=m[k]||(m[k]={k:k,sets:0,n:0,kg:0,h:0}); o.sets++; o.n+=g.n; o.kg+=g.kg; o.h+=g.hrs; });
  return order.filter(function(k){ return m[k]; }).map(function(k){ return m[k]; });
}
function rate(o){ return o.h>0?Math.round(o.n/o.h*12*10)/10:0; }
function section(box,title,rows,labelOf){
  if(!rows.length) return; var c=el('div','gssec'); c.append(el('h4','',title));
  rows.forEach(function(o){ var r=el('div','tr'); r.append(el('span','',labelOf(o.k)+' · '+o.sets+T(' ριξ.',' sets')),el('b','',o.n+T(' ψάρια · ',' fish · ')+rate(o)+T(' /12ω',' /12h'))); c.append(r); });
  box.append(c);
}
function paint(){
  if(!host) return; host.replaceChildren();
  var R=window.AlkyonRange, all=items().filter(function(g){ return !R||R.inR('log',{date:ldate(g.t0)}); });
  var wx=wxLoad();
  host.append(el('h3','',T('Στατιστικά εργαλείων','Gear statistics')));
  var sg=el('div','seg gsseg'); [['all',T('Όλα','All')],['net',TYPES.net],['ll',TYPES.ll],['trap',TYPES.trap]].forEach(function(p){
    var b=el('button','',p[1]); b.type='button'; b.setAttribute('aria-pressed',String(sel===p[0]));
    b.addEventListener('click',function(){ sel=p[0]; C.lsSet(SK,sel); paint(); }); sg.append(b); }); host.append(sg);
  var list=all.filter(function(g){ return sel==='all'||g.type===sel; });
  if(!list.length){ host.append(el('div','muted',T('Δεν υπάρχουν ακόμα ολοκληρωμένες ριξιές με ώρα ρίψης και ανεβάσματος σε αυτό το διάστημα.','No completed sets with set and haul times in this period yet.'))); return; }
  var sets=list.length, n=0, kg=0, h=0; list.forEach(function(g){ n+=g.n; kg+=g.kg; h+=g.hrs; });
  var tiles=el('div','gstiles');
  [[sets,T('Ριξιές','Sets')],[n,T('Ψάρια','Fish')],[(Math.round(kg*10)/10).toFixed(1)+' kg',T('Βάρος','Weight')],[Math.round(h*10)/10+' h',T('Ώρες μέσα','Hours in water')],[Math.round(h/sets*10)/10+' h',T('Μέσος χρόνος','Avg soak')],[h>0?(Math.round(n/h*12*10)/10)+'':'–',T('Ψάρια / 12 ώρες','Fish / 12 h')]].forEach(function(t){
    var d=el('div','gst'); d.append(el('b','',String(t[0])),el('span','',t[1])); tiles.append(d); }); host.append(tiles);
  if(sets<10) host.append(el('div','note',T('Λίγες ριξιές ('+sets+'). Δες τα ως ένδειξη και όχι ως κανόνα.','Few sets ('+sets+'). Treat as a hint, not a rule.')));
  host.append(el('div','note',T('Ο χρόνος μετριέται από την ώρα ρίψης μέχρι την ώρα που τα έβγαλες από το νερό.','Time is measured from the set to the moment the gear came out of the water.')));
  var box=el('div','col');
  section(box,T('Ώρες μέσα στη θάλασσα','Time in the water'),group(list,function(g){ return g.hrs<6?'a':g.hrs<12?'b':'c'; },['a','b','c']),function(k){ return k==='a'?T('Κάτω από 6 ώρες','Under 6 h'):k==='b'?'6–12 '+T('ώρες','h'):T('Πάνω από 12 ώρες','Over 12 h'); });
  section(box,T('Σελήνη (στη ρίψη)','Moon (at set)'),group(list,function(g){ return moonIdx(g.t0); },[0,1,2,3,4,5,6,7]),function(k){ return MOON[k]; });
  /* καιρός όσο ήταν μέσα */
  var wl=list.filter(function(g){ return wx[g.id]&&wx[g.id].x===1; });
  if(wl.length){
    var wsec=function(title,fn,order,lab){ var rows=group(wl,function(g){ return fn(wx[g.id]); },order); section(box,title,rows,function(k){ return lab[k]; }); };
    wsec(T('Άνεμος όσο ήταν μέσα','Wind while in the water'),function(c){ return c.w==null?null:c.w<=6?'a':c.w<=16?'b':'c'; },['a','b','c'],{a:T('Ήρεμος (έως 2 Bft)','Calm (to 2 Bft)'),b:T('Μέτριος (3–4 Bft)','Moderate (3–4 Bft)'),c:T('Δυνατός (5+ Bft)','Strong (5+ Bft)')});
    wsec(T('Κύμα (μέγιστο)','Waves (max)'),function(c){ return c.v==null?null:c.v<0.5?'a':c.v<=1?'b':'c'; },['a','b','c'],{a:T('Κάτω από 0.5 m','Under 0.5 m'),b:'0.5–1 m',c:T('Πάνω από 1 m','Over 1 m')});
    wsec(T('Πίεση όσο ήταν μέσα','Pressure while in the water'),function(c){ return c.pd==null?null:c.pd<=-2?'a':c.pd>=2?'c':'b'; },['a','b','c'],{a:T('Πέφτει','Falling'),b:T('Σταθερή','Steady'),c:T('Ανεβαίνει','Rising')});
  }
  section(box,T('Μήνας','Month'),group(list,function(g){ return new Date(g.t0).getMonth(); },[0,1,2,3,4,5,6,7,8,9,10,11]),function(k){ return MON[k]; });
  host.append(box);
  var pend=list.filter(function(g){ return g.pos&&!wx[g.id]; }).length, failed=list.filter(function(g){ return wx[g.id]&&wx[g.id].x===0; }).length;
  var nt=el('div','note gsnote'); nt.textContent=wl.length?T('Ο καιρός είναι εκτίμηση μοντέλου και αφορά '+wl.length+' από '+list.length+' ριξιές.','Weather is a model estimate for '+wl.length+' of '+list.length+' sets.'):(pend?T('Φέρνω τον καιρό…','Fetching weather…'):(failed?T('Δεν βρέθηκε καιρός (χρειάζεται internet).','Weather not found (needs internet).'):''));
  host.append(nt);
  fillWx(list);
}
function build(){ host=el('div','card gearstats'); paint(); return host; }
window.AlkyonGearStats={build:build,items:items};
window.addEventListener('alkyon-range',function(e){ if(e.detail&&e.detail.key==='log'&&host&&host.isConnected) paint(); });
})();
