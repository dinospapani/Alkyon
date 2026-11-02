/* Φράγματα της Κύπρου (Δημοκρατία της Κύπρου). Θέσεις: κατά προσέγγιση, από τη Wikipedia («List of dams and reservoirs in Cyprus»).
   Όροι: «Conditions for recreational fishing licences in reservoirs» (2023, cyprusfaa.com, βάσει ΚΕΦ. 135). Η κατάσταση ανοιχτό/κλειστό αλλάζει: επιβεβαίωσε στο Τμήμα Αλιείας. */
(function(){
'use strict';
var C=window.AlkyonCore, mb=document.querySelector('.mapbtns'); if(!C||!mb||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
/* st: closed = κλειστό, seasonal = εποχιακό, cr = μόνο ελευθέρωση, check = άγνωστη κατάσταση */
var D=[
['Κούρης','Kouris',34.7278,32.9178,'check',110],['Ασπρόκρεμμος','Asprokremmos',34.7259,32.5543,'check',53],['Εύρετου','Evretou',34.9757,32.4727,'check',70],
['Κανναβιού','Kannaviou',34.9277,32.5878,'check',75],['Καλαβασός','Kalavasos',34.803972,33.260517,'check',60],['Λεύκαρα','Lefkara',34.8944,33.2956,'check',71],
['Διπόταμος','Dipotamos',34.851618,33.359274,'check',60],['Γερμασόγεια','Germasogeia',34.7439,33.0843,'check',49],['Άχνα','Achna',35.055321,33.814307,'seasonal',16],
['Κούκλια','Kouklia',35.1207,33.7606,'check',6],['Αρμίνου','Arminou',34.8752,32.7371,'check',45],['Πολεμίδια','Polemidia',34.7187,32.9888,'cr',45],
['Ταμασός','Tamasos',35.0167,33.2479,'check',34],['Μαυροκόλυμπος','Mavrokolympos',34.8565,32.4058,'closed',45],['Αργάκα','Argaka',35.0486,32.5022,'closed',41],
['Πώμος','Pomos',35.1449,32.5762,'check',38],['Αγία Μαρίνα','Agia Marina',35.1170,32.5410,'check',33],['Βυζακιά','Vyzakia',35.0615,33.0272,'check',37],
['Ξυλιάτος','Xyliatos',35.0089,33.0372,'closed',42],['Καλοπαναγιώτης','Kalopanagiotis',35.0061,32.8254,'closed',40],['Λύμπια','Lympia',34.97518,33.41907,'closed',12],['Κλήρου-Μαλούντα','Klirou-Malounta',35.0318,33.1727,'check',38],
['Σολέα','Solea',35.06836,32.90120,'check',0]
];
var layer=L.layerGroup(), on=C.lsGet('alkyon-dams',true)!==false;
var ST={
  closed:[T('Κλειστό για ψάρεμα','Closed to fishing'),'bad'],
  seasonal:[T('Κλειστό 1 Ιαν – 30 Ιουν. Μετά, μόνο ελευθέρωση των ψαριών ζωντανών.','Closed 1 Jan – 30 Jun. Otherwise catch and release only.'),'warn'],
  cr:[T('Μόνο ελευθέρωση: τα ψάρια δεν σκοτώνονται ούτε παίρνονται ζωντανά.','Catch and release only: fish must not be killed or taken away alive.'),'warn'],
  check:[T('Η άδεια ισχύει μόνο αν το φράγμα έχει δηλωθεί ανοιχτό. Επιβεβαίωσε.','The licence is valid only if the reservoir is declared open. Please confirm.'),'warn']
};
/* Πληρότητα: dams_levels.json, που ενημερώνει αυτόματα το GitHub Action από το Excel του Τμήματος Αναπτύξεως Υδάτων */
var LV=null, lvWait=[];
function nrm(x){ return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-zα-ω]/g,''); }
function lvOf(d){ if(!LV||!LV.dams) return null; var k=nrm(d[0]); for(var n in LV.dams){ if(nrm(n)===k) return LV.dams[n]; } return null; }
function dmy(iso){ var m=/^(\d{4})-(\d\d)-(\d\d)/.exec(iso||''); return m?(+m[3])+'/'+(+m[2])+'/'+m[1]:''; }
function n2(v,dg){ return v==null?'–':(+v).toFixed(dg==null?(v<10?2:1):dg).replace('.',EN?'.':','); }
function lvLoad(){
  fetch('dams_levels.json',{cache:'no-cache'}).then(function(r){ return r.ok?r.json():null; }).then(function(j){
    if(!j||!j.dams) return; LV=j; window.AlkyonDams.data=j;
    markers.forEach(function(x){ var l=lvOf(x.d); if(l) x.m.setTooltipContent((EN?x.d[1]:x.d[0])+' · '+Math.round(l.pct)+'%'); badge(x.m,l); });
    var w=lvWait; lvWait=[]; w.forEach(function(f){ try{ f(); }catch(e){} });
    try{ window.dispatchEvent(new CustomEvent('alkyon-dams')); }catch(e){}
  }).catch(function(){});
}
function badge(m,l){ var el=m.getElement&&m.getElement(), b=el&&el.querySelector('.mk-dam'); if(!b||!l) return; var t=b.querySelector('.mk-dpct'); if(!t){ t=document.createElement('small'); t.className='mk-dpct'; b.appendChild(t); } t.textContent=Math.round(l.pct)+'%'; }
/* στάθμη: εκτίμηση από το ύψος του φράγματος (ΤΑΥ, «Dams of Cyprus») και την πληρότητα. Όγκος ≈ βάθος^n (n 2–3, κοιλάδα),
   μέγιστο βάθος ≈ 90% του ύψους. Δεν είναι μέτρηση: το ΤΑΥ δεν δημοσιεύει στάθμη σε μέτρα. */
function lvDrop(l,Hm){ if(!Hm||l.pct==null||l.pct>=98) return null; var p=Math.max(0.005,l.pct/100), D=0.9*Hm, a=D*(1-Math.pow(p,1/3)), b=D*(1-Math.pow(p,1/2)), r=function(x){ return x<10?Math.round(x):Math.round(x/5)*5; }; return [r(a),r(b)]; }
function lvBox(l,Hm){
  var w=document.createElement('div'); w.className='damlv';
  var h=document.createElement('div'); h.className='damlv-h';
  var b=document.createElement('b'); b.textContent=Math.round(l.pct)+'%'; var sp=document.createElement('span'); sp.textContent=T('πληρότητα','full'); h.append(b,sp);
  var bar=document.createElement('div'); bar.className='damlv-bar'; var f=document.createElement('i'); f.style.width=Math.max(0,Math.min(100,l.pct))+'%'; bar.appendChild(f);
  if(l.lyPct!=null){ var ly=document.createElement('u'); ly.style.left=Math.max(0,Math.min(100,l.lyPct))+'%'; ly.title=T('Πέρσι','Last year'); bar.appendChild(ly); }
  w.append(h,bar);
  var rows=[[T('Νερό','Water'),n2(l.stor)+' / '+n2(l.cap)+T(' εκ. m³',' million m³')]];
  var dr=lvDrop(l,Hm); if(dr) rows.push([T('Στάθμη (εκτίμηση)','Level (estimate)'),(dr[0]===dr[1]?'≈ '+dr[0]:'≈ '+dr[0]+'–'+dr[1])+T(' m κάτω από το γεμάτο',' m below full')]);
  if(l.lyPct!=null) rows.push([T('Πέρσι, ίδια μέρα','Same day last year'),Math.round(l.lyPct)+'%'+(l.pct>l.lyPct?' ↑':l.pct<l.lyPct?' ↓':'')]);
  if(l.in24!=null) rows.push([T('Εισροή 24ώρου','Inflow, last 24 h'),n2(l.in24*1000,0)+T(' χιλ. m³',' thousand m³')]);
  if(l.max!=null&&l.cap) rows.push([T('Μέγιστο φέτος','Highest this year'),Math.round(l.max/l.cap*100)+'%'+(l.maxDate?' ('+l.maxDate+')':'')]);
  rows.forEach(function(r){ var m=document.createElement('div'); m.className='damlv-r'; var a=document.createElement('span'); a.textContent=r[0]; var c=document.createElement('b'); c.textContent=r[1]; m.append(a,c); w.appendChild(m); });
  var n=document.createElement('div'); n.className='note'; n.textContent=T('Τμήμα Αναπτύξεως Υδάτων · ','Water Development Dept · ')+dmy(LV.date)+(dr?T(' · Η στάθμη είναι εκτίμηση από το ύψος του φράγματος, όχι μέτρηση.',' · The level is estimated from the dam height, not measured.'):''); w.appendChild(n);
  return w;
}
function pop(d){
  var s=ST[d[4]], w=document.createElement('div'); w.className='pop dampop land';
  var b=document.createElement('b'); b.textContent=(EN?d[1]:d[0])+T(' · Φράγμα',' Dam'); w.appendChild(b);
  var lv=lvOf(d); if(lv) w.appendChild(lvBox(lv,d[5]));
  var st=document.createElement('div'); st.className='damst '+s[1]; st.textContent=s[0]; w.appendChild(st);
  [T('Μόνο από την όχθη. 1 καλάμι, 1 αγκίστρι.','Bank only. 1 rod, 1 hook.'),T('1 ώρα πριν την ανατολή έως 1 ώρα μετά τη δύση.','1 h before sunrise to 1 h after sunset.'),
   T('Λαβράκι, κυπρίνος, ζαντέρ: 2 ανά είδος (30 cm). Πέστροφα 5 (20 cm). Οξύρρυγχος 1 (70 cm). Σύνολο 10.','Bass, carp, zander: 2 each (30 cm). Trout 5 (20 cm). Sturgeon 1 (70 cm). Max 10 in total.')].forEach(function(t){ var m=document.createElement('div'); m.className='meta'; m.textContent=t; w.appendChild(m); });
  var n=document.createElement('div'); n.className='note'; n.textContent=T('Όροι αδειών 2023 (cyprusfaa.com). Θέση κατά προσέγγιση. Επιβεβαίωσε στο Τμήμα Αλιείας.','2023 licence conditions (cyprusfaa.com). Approximate position. Confirm with the Fisheries Department.'); w.appendChild(n);
  return w;
}
var markers=[];
D.forEach(function(d){
  var cls='mk-dam '+(d[4]==='closed'?'bad':d[4]==='check'?'':'warn');
  var m=L.marker([d[2],d[3]],{icon:L.divIcon({className:'',html:'<div class="'+cls+'"><svg viewBox="0 0 24 24"><path d="M4 6h16l-2 9H6L4 6z"/><path d="M4 19c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5-1"/></svg></div>',iconSize:[28,28]}),title:EN?d[1]:d[0]});
  m.bindTooltip((EN?d[1]:d[0]),{direction:'right',offset:[12,0],className:'lbl'}); m.bindPopup(function(){ return pop(d); }); m.addTo(layer); markers.push({d:d,m:m});
  m.on('add',function(){ badge(m,lvOf(d)); });
});
var b=document.createElement('button'); b.type='button'; b.id='bDams'; b.className='mbtn'; b.setAttribute('aria-pressed',String(on));
b.setAttribute('aria-label',T('Φράγματα','Dams')); b.title=T('Φράγματα και όροι ψαρέματος','Dams and fishing rules');
b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 5h16l-2 11H6L4 5z"/><path d="M3 20c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0"/></svg>';
var cfg=document.getElementById('bToolsCfg'); if(cfg) mb.insertBefore(b,cfg); else mb.appendChild(b);
if(on) layer.addTo(map);
b.addEventListener('click',function(){
  var v=!map.hasLayer(layer); if(v) layer.addTo(map); else { map.closePopup(); map.removeLayer(layer); }
  b.setAttribute('aria-pressed',String(v)); C.lsSet('alkyon-dams',v);
});
/* κοντινότερο φράγμα με δεδομένα (για την Πρόγνωση σε λίμνη) */
function near(lat,lon,maxKm){
  var best=null; D.forEach(function(d){ var l=lvOf(d); if(!l) return; var dy=(d[2]-lat)*111, dx=(d[3]-lon)*111*Math.cos(lat*Math.PI/180), k=Math.sqrt(dx*dx+dy*dy);
    if(k<=(maxKm||5)&&(!best||k<best.km)) best={name:EN?d[1]:d[0],km:k,lv:l,date:LV.date,st:d[4],H:d[5]}; });
  return best;
}
window.AlkyonDams={list:D,data:null,near:near,box:function(l,Hm){ return lvBox(l,Hm); },ready:function(f){ if(LV) f(); else lvWait.push(f); }};
function zc(){ var c=map.getContainer(); if(c) c.classList.toggle('dam-z',map.getZoom()>=10); } map.on('zoomend',zc); zc();
lvLoad(); if(window.ndEvery) window.ndEvery(lvLoad,3*3600*1000);
})();
