/* Κόμποι: σχηματικά animation βήμα-βήμα (SVG), δικά μας σχέδια. Ενδεικτικά, δεν αντικαθιστούν δοκιμή του κόμπου με πραγματική πετονιά. */
(function(){
'use strict';
var C=window.AlkyonCore, seg=document.querySelector('#tab-guide .seg'), tab=document.getElementById('tab-guide');
if(!C||!seg||!tab||document.getElementById('g-knots')) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var NS='http://www.w3.org/2000/svg';
function P(x,y){ return x.toFixed(1)+','+y.toFixed(1); }
var A=[10,150], B=[205,57];
function pt(t){ return [A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]; }
/* στροφές γύρω από τη γραμμή: n μικρές διαγώνιες γραμμές από t0 έως t1 */
function coils(t0,t1,n,c,delay){ var o=[]; for(var i=0;i<n;i++){ var t=t0+(t1-t0)*(n>1?i/(n-1):0), p=pt(t); o.push({d:'M'+P(p[0]+9,p[1]-15)+' Q'+P(p[0]+6,p[1]+1)+' '+P(p[0]-5,p[1]+16),c:c||'tag',w:3,delay:(delay||0)+i*0.22}); } return o; }
function arrow(x1,y1,x2,y2,delay){ var a=Math.atan2(y2-y1,x2-x1), h=8, l=a+2.65, r=a-2.65; return {d:'M'+P(x1,y1)+' L'+P(x2,y2)+' M'+P(x2+h*Math.cos(l),y2+h*Math.sin(l))+' L'+P(x2,y2)+' L'+P(x2+h*Math.cos(r),y2+h*Math.sin(r)),c:'hi',w:2.5,delay:delay||0}; }
var KNOTS=[
{ id:'clinch', hook:true, name:T('Improved clinch','Improved clinch'), use:T('Για αγκίστρι, στριφτάρι ή τεχνητό. Καλός γενικός κόμπος για μονόκλωνη και fluorocarbon.','For hook, swivel or lure. A good all-round knot for mono and fluorocarbon.'),
  steps:[
  { t:T('Πέρασε το άκρο από το μάτι','Pass the end through the eye'), d:T('Βάλε το άκρο της πετονιάς μέσα από το μάτι του αγκιστριού και άφησε λίγα εκατοστά.','Pass the end of the line through the hook eye and leave a few centimetres.'),
    add:[{d:'M10,150 L204,57',c:'m',w:3},{d:'M204,57 L246,38',c:'tag',w:3,delay:0.5}] },
  { t:T('Τύλιξε γύρω από τη γραμμή','Wrap around the standing line'), d:T('Τύλιξε το άκρο γύρω από την κύρια πετονιά τουλάχιστον 5 φορές. Για λεπτή πετονιά περισσότερες.','Wrap the end around the standing line at least 5 times. More wraps for thin line.'),
    add:[{d:'M246,38 C262,96 190,104 161,66',c:'tag',w:3}].concat(coils(0.74,0.46,5,'tag',0.6),[{d:'M94,123 L84,131',c:'tag',w:3,delay:2}]) },
  { t:T('Πέρασε από το μικρό βρόχο','Through the small loop'), d:T('Φέρε το άκρο πίσω προς το μάτι και πέρασέ το από τον μικρό βρόχο που σχηματίστηκε ακριβώς δίπλα στο μάτι.','Bring the end back toward the eye and pass it through the small loop formed right next to the eye.'),
    add:[{d:'M84,131 C120,142 172,120 192,68',c:'tag',w:3},{d:'M183,68 a9,6 0 1,0 18,0 a9,6 0 1,0 -18,0',c:'hi',w:2,dash:1,delay:0.7}] },
  { t:T('Πέρασε από το μεγάλο βρόχο','Through the big loop'), d:T('Πέρασε το άκρο και από τον μεγάλο βρόχο που σχηματίστηκε πάνω από τον πρώτο.','Then pass the end through the big loop formed above the first one.'),
    add:[{d:'M246,38 C262,96 190,104 161,66',c:'hi',w:2,dash:1},{d:'M192,68 C200,92 222,98 238,72',c:'tag',w:3,delay:0.4}] },
  { t:T('Βρέξε και σφίξε','Wet and tighten'), d:T('Βρέξε τον κόμπο, τράβηξε αργά το άκρο και την κύρια γραμμή μέχρι να σφίξει, και κόψε το άκρο κοντά στον κόμπο.','Wet the knot, pull the end and the main line slowly until it seats, then trim the tag close.'),
    clear:1, add:[{d:'M10,150 L204,57',c:'m',w:3}].concat(coils(0.8,0.94,6,'tag',0.5),[{d:'M204,57 L216,51',c:'tag',w:3,delay:1.8},arrow(60,126,30,141,2)]) }
  ]},
{ id:'palomar', hook:true, name:'Palomar', use:T('Πολύ γερός, ταιριάζει και σε πλεκτό νήμα. Ο βρόχος πρέπει να περάσει πάνω από το αγκίστρι ή το τεχνητό.','Very strong and works with braid. The loop must go over the hook or lure.'),
  steps:[
  { t:T('Δίπλωσε και πέρασε από το μάτι','Double the line through the eye'), d:T('Δίπλωσε την πετονιά και πέρασε τον βρόχο μέσα από το μάτι, χωρίς να διασταυρωθούν τα δύο σκέλη.','Double the line and pass the loop through the eye, keeping the two strands uncrossed.'),
    add:[{d:'M10,146 L204,55',c:'m',w:3},{d:'M10,158 L204,66',c:'m',w:3},{d:'M204,55 C262,30 282,70 250,86 C232,94 216,76 204,66',c:'m',w:3,delay:0.5}] },
  { t:T('Χαλαρός απλός κόμπος','Loose overhand knot'), d:T('Κάνε έναν χαλαρό απλό κόμπο με το διπλό σκέλος, χωρίς να σφίξεις και χωρίς να φτάσει στο μάτι.','Tie a loose overhand knot in the doubled line. Do not tighten it and keep it away from the eye.'),
    add:[{d:'M96,118 C86,86 134,78 132,98 C130,116 92,116 104,92',c:'tag',w:3}] },
  { t:T('Πέρασε το βρόχο πάνω από το αγκίστρι','Loop over the hook'), d:T('Πέρασε όλο το βρόχο πάνω από το αγκίστρι ή το τεχνητό και ανέβασέ τον πάνω από τη γραμμή.','Pass the whole loop over the hook or lure and lift it up past the line.'),
    clear:1, add:[{d:'M10,146 L204,55',c:'m',w:3},{d:'M10,158 L204,66',c:'m',w:3},{d:'M96,118 C86,86 134,78 132,98 C130,116 92,116 104,92',c:'tag',w:3},{d:'M204,55 C300,20 306,184 188,178 C150,174 168,110 204,66',c:'hi',w:3,delay:0.3}] },
  { t:T('Βρέξε και σφίξε','Wet and tighten'), d:T('Βρέξε τον κόμπο και τράβηξε αργά και τα δύο σκέλη μέχρι να σφίξει στο μάτι. Κόψε το άκρο.','Wet the knot and pull both strands slowly until it seats on the eye. Trim the tag.'),
    clear:1, add:[{d:'M10,152 L196,62',c:'m',w:3},{d:'M200,50 A14,14 0 1,1 200,72',c:'tag',w:3,delay:0.6},arrow(60,126,30,141,1.4)] }
  ]},
{ id:'uni', hook:true, name:'Uni', use:T('Απλός και γενικός. Ταιριάζει σε αγκίστρι ή στριφτάρι και ρυθμίζεται εύκολα.','Simple and versatile for hooks and swivels, and easy to adjust.'),
  steps:[
  { t:T('Πέρασε και δίπλωσε το άκρο','Pass the end through and fold back'), d:T('Πέρασε το άκρο από το μάτι και δίπλωσέ το να τρέχει παράλληλα με την κύρια γραμμή, περίπου 15 εκ.','Pass the end through the eye and fold it back alongside the standing line, about 15 cm.'),
    add:[{d:'M10,150 L204,57',c:'m',w:3},{d:'M204,57 C226,60 226,84 212,88 L100,132',c:'tag',w:3,delay:0.5}] },
  { t:T('Κάνε βρόχο','Make a loop'), d:T('Κάνε έναν βρόχο με το άκρο, πάνω από τα δύο σκέλη.','Make a loop with the end, over both strands.'),
    add:[{d:'M150,118 C110,100 150,62 178,78 C192,88 178,116 148,116',c:'hi',w:2,dash:1}] },
  { t:T('Τύλιξε μέσα στο βρόχο','Wrap through the loop'), d:T('Τύλιξε το άκρο 4 έως 6 φορές γύρω από τα δύο σκέλη και μέσα από το βρόχο.','Wrap the end 4 to 6 times around both strands and through the loop.'),
    add:coils(0.54,0.7,5,'tag',0) },
  { t:T('Βρέξε, σφίξε και σπρώξε','Wet, tighten and slide'), d:T('Βρέξε και τράβηξε το άκρο για να σφίξουν οι στροφές. Μετά τράβηξε την κύρια γραμμή και σπρώξε τον κόμπο μέχρι το μάτι. Κόψε το άκρο.','Wet, then pull the end to tighten the wraps. Pull the main line and slide the knot down to the eye. Trim the tag.'),
    add:[arrow(100,134,70,148,0),arrow(150,96,184,78,0.5)] }
  ]},
{ id:'dropper', hook:false, name:'Dropper loop', use:T('Φτιάχνει βρόχο στη μέση της πετονιάς, για δεύτερο αγκίστρι ή βαρίδι.','Makes a loop in the middle of the line, for a second hook or a sinker.'),
  steps:[
  { t:T('Κάνε βρόχο','Make a loop'), d:T('Σχημάτισε έναν βρόχο στο σημείο της πετονιάς που θες τον βρόχο.','Form a loop where you want the dropper.'),
    add:[{d:'M10,110 L120,110',c:'m',w:3},{d:'M180,110 L290,110',c:'m',w:3},{d:'M120,110 C108,36 192,36 180,110',c:'m',w:3,delay:0.3}] },
  { t:T('Στρίψε το βρόχο','Twist the loop'), d:T('Στρίψε τα δύο σκέλη του βρόχου γύρω από τον εαυτό τους περίπου 5 φορές. Δημιουργείται ένα στριφτό κομμάτι και ένας βρόχος πάνω του.','Twist the two sides of the loop around each other about 5 times. This leaves a twisted section with a loop on top.'),
    clear:1, add:[{d:'M10,110 L290,110',c:'m',w:3},{d:'M150,40 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0',c:'m',w:3,delay:0.2}].concat([100,90,80,70,60].reduce(function(a,y,i){ a.push({d:'M142,'+y+' L158,'+(y-9),c:'tag',w:3,delay:0.5+i*0.2}); a.push({d:'M158,'+y+' L142,'+(y-9),c:'tag',w:3,delay:0.6+i*0.2}); return a; },[])) },
  { t:T('Άνοιξε το κέντρο','Open the centre'), d:T('Άνοιξε το κέντρο του στριφτού κομματιού και πέρασε από μέσα τον πάνω βρόχο.','Open the centre of the twisted section and pass the top loop through it.'),
    add:[{d:'M143,84 a7,7 0 1,0 14,0 a7,7 0 1,0 -14,0',c:'hi',w:2,dash:1},arrow(150,10,150,76,0.4)] },
  { t:T('Βρέξε και σφίξε','Wet and tighten'), d:T('Κράτα το βρόχο, βρέξε και τράβηξε αργά τα δύο άκρα της πετονιάς μέχρι να σφίξει ο κόμπος.','Hold the loop, wet it and pull both ends of the line slowly until the knot seats.'),
    clear:1, add:[{d:'M10,110 L290,110',c:'m',w:3},{d:'M146,108 C122,30 178,30 154,108',c:'m',w:3,delay:0.3}].concat([100,106].map(function(y,i){ return {d:'M144,'+y+' L156,'+(y-6),c:'tag',w:3,delay:0.8+i*0.2}; }),[arrow(80,92,40,92,1.4),arrow(220,92,260,92,1.4)]) }
  ]}
];
/* CSS */
var st=document.createElement('style');
st.textContent='.kn svg{display:block;width:100%;height:auto;border-radius:12px;background:rgba(127,150,160,.1)}.kn path{fill:none;stroke-linecap:round;stroke-linejoin:round}.kn .m{stroke:currentColor}.kn .tag{stroke:#E8743B}.kn .hi{stroke:#2FA7B8}.kn .hook{stroke:#8C9BA3}.kn .dr{stroke-dasharray:1;stroke-dashoffset:1;animation:kndraw .8s ease forwards}.kn .fd{animation:knfade .6s ease both}@keyframes kndraw{to{stroke-dashoffset:0}}@keyframes knfade{from{opacity:0}to{opacity:1}}@media(prefers-reduced-motion:reduce){.kn .dr{animation:none;stroke-dashoffset:0}.kn .fd{animation:none}}.kn .kcap{margin:10px 0 2px}.kn .kcap b{display:block;font-size:15px}.kn .kctl{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.kn .kctl .btn{min-height:40px}.kn .kdots{display:flex;gap:6px;margin-top:8px}.kn .kdots i{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.25}.kn .kdots i.on{opacity:1;background:#E8743B}';
document.head.appendChild(st);
function mk(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function card(k){
  var c=mk('div','card kn'); c.appendChild(mk('h3',null,k.name)); c.appendChild(mk('p','note',k.use));
  var svg=document.createElementNS(NS,'svg'); svg.setAttribute('viewBox','0 0 300 180'); svg.setAttribute('role','img'); svg.setAttribute('aria-label',k.name);
  var gh=document.createElementNS(NS,'g'), g=document.createElementNS(NS,'g'); svg.appendChild(gh); svg.appendChild(g);
  if(k.hook){ [['M200,60 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0'],['M210,70 V138 Q210,168 182,162 L176,150']].forEach(function(d){ var p=document.createElementNS(NS,'path'); p.setAttribute('d',d[0]); p.setAttribute('class','hook'); p.setAttribute('stroke-width','4'); gh.appendChild(p); }); }
  c.appendChild(svg);
  var cap=mk('div','kcap'), cb=mk('b'), cd=mk('span','note'); cap.appendChild(cb); cap.appendChild(cd); c.appendChild(cap);
  var dots=mk('div','kdots'); k.steps.forEach(function(){ dots.appendChild(mk('i')); }); c.appendChild(dots);
  var ctl=mk('div','kctl'), prev=mk('button','btn ghost sm',T('Πίσω','Back')), play=mk('button','btn acc sm',T('Παίξε','Play')), next=mk('button','btn sm',T('Επόμενο','Next'));
  [prev,play,next].forEach(function(b){ b.type='button'; ctl.appendChild(b); }); c.appendChild(ctl);
  var i=0, tm=null;
  function stop(){ if(tm){ clearInterval(tm); tm=null; } play.textContent=T('Παίξε','Play'); }
  function paint(){
    g.replaceChildren(); var items=[];
    for(var s=0;s<=i;s++){ var stp=k.steps[s]; if(stp.clear) items=[]; stp.add.forEach(function(it){ items.push({it:it,cur:s===i}); }); }
    items.forEach(function(x){ var p=document.createElementNS(NS,'path'), it=x.it; p.setAttribute('d',it.d); p.setAttribute('stroke-width',it.w||3); var cls=it.c; if(x.cur){ if(it.dash){ cls+=' fd'; } else { cls+=' dr'; p.setAttribute('pathLength','1'); } p.style.animationDelay=(it.delay||0)+'s'; } if(it.dash) p.setAttribute('stroke-dasharray','4 4'); p.setAttribute('class',cls); g.appendChild(p); });
    cb.textContent=(i+1)+'/'+k.steps.length+' · '+k.steps[i].t; cd.textContent=k.steps[i].d;
    Array.prototype.forEach.call(dots.children,function(d,j){ d.className=j===i?'on':''; });
    prev.disabled=i===0; next.disabled=i===k.steps.length-1;
  }
  prev.addEventListener('click',function(){ stop(); if(i>0){ i--; paint(); } });
  next.addEventListener('click',function(){ stop(); if(i<k.steps.length-1){ i++; paint(); } });
  play.addEventListener('click',function(){ if(tm){ stop(); return; } if(i>=k.steps.length-1) i=0; paint(); play.textContent=T('Παύση','Pause');
    tm=setInterval(function(){ if(!c.offsetParent){ stop(); return; } if(i<k.steps.length-1){ i++; paint(); } else stop(); },2800); });
  c.stopKnot=stop; paint(); return c;
}
var box=mk('div','list'); box.id='g-knots'; box.hidden=true;
var intro=mk('div','card'); intro.appendChild(mk('h3',null,T('Κόμποι ψαρέματος','Fishing knots')));
intro.appendChild(mk('p','note',T('Σχηματικά σχέδια βήμα-βήμα. Δεν είναι ακριβής απεικόνιση της πετονιάς. Βρέξε πάντα τον κόμπο πριν τον σφίξεις και δοκίμασέ τον με πραγματική πετονιά πριν βασιστείς πάνω του.','Schematic step-by-step drawings, not an exact depiction of the line. Always wet the knot before tightening and test it on real line before relying on it.')));
box.appendChild(intro);
var cards=KNOTS.map(function(k){ var c=card(k); box.appendChild(c); return c; });
var anchor=document.getElementById('g-safety'); anchor.parentNode.insertBefore(box,anchor.nextSibling);
var kb=mk('button',null,T('Κόμποι','Knots')); kb.type='button'; kb.dataset.g='knots'; kb.setAttribute('aria-pressed','false'); seg.appendChild(kb);
function stopAll(){ cards.forEach(function(c){ c.stopKnot(); }); }
kb.addEventListener('click',function(){
  Array.prototype.forEach.call(seg.querySelectorAll('button'),function(x){ x.setAttribute('aria-pressed',String(x===kb)); });
  ['species','tech','law','safety','shops'].forEach(function(g){ var e=document.getElementById('g-'+g); if(e) e.hidden=true; });
  box.hidden=false;
});
Array.prototype.forEach.call(seg.querySelectorAll('button'),function(b){ if(b!==kb) b.addEventListener('click',function(){ box.hidden=true; stopAll(); }); });
})();
