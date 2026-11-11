/* Κόμποι: 3D βίντεο βήμα-βήμα (Blender, tools/alkyon_knots.py) για 11 κόμπους, και σχηματικό SVG για το dropper loop.
   Βίντεο, εικόνες και χρόνοι βημάτων: ../knots/ (index.json). Ενδεικτικά, δεν αντικαθιστούν δοκιμή με πραγματική πετονιά. */
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

/* ---------- 3D βίντεο (1.12.26) ---------- */
var KB=(function(){ var s=document.currentScript&&document.currentScript.src; return s?s.replace(/knots\.js(\?.*)?$/,'knots/'):'../knots/'; })();
var VK=[
 {g:'hook', id:'clinch', alt:'clinch_hook', name:T('Βελτιωμένος Clinch','Improved Clinch'), use:T('Για αγκίστρι, στριφτάρι ή τεχνητό. Καλός γενικός κόμπος για μονόκλωνη και fluorocarbon.','For hook, swivel or lure. A good all-round knot for mono and fluorocarbon.')},
 {g:'hook', id:'uni', alt:'uni_hook', name:'Uni', use:T('Απλός και γενικός. Ταιριάζει σε αγκίστρι ή στριφτάρι και ρυθμίζεται εύκολα.','Simple and versatile for hooks and swivels, and easy to adjust.')},
 {g:'hook', id:'palomar', name:'Palomar', use:T('Πολύ γερός, ταιριάζει και σε πλεκτό νήμα. Η θηλιά πρέπει να περάσει πάνω από όλο το αγκίστρι ή το τεχνητό.','Very strong and works with braid. The loop must go over the whole hook or lure.')},
 {g:'hook', id:'snell', name:'Snell', use:T('Στο σώμα του αγκιστριού: η πετονιά βγαίνει ευθεία από το σώμα και το αγκίστρι καρφώνει καλύτερα. Για δόλωμα.','On the hook shank: the line pulls straight along the shank so the hook sets better. For bait.')},
 {g:'hook', id:'rapala', name:T('Θηλιά Rapala','Rapala loop'), use:T('Αφήνει μια μικρή θηλιά στο μάτι, ώστε το τεχνητό να κουνιέται ελεύθερα.','Leaves a small loop at the eye so the lure can swing freely.')},
 {g:'join', id:'fg', name:'FG', use:T('Ο πιο λεπτός και γερός κόμπος για νήμα με παράμαλλο fluorocarbon. Περνάει άνετα από τους οδηγούς.','The slimmest, strongest braid-to-fluorocarbon join. Slides easily through the guides.')},
 {g:'join', id:'double_uni', name:T('Διπλός Uni','Double Uni'), use:T('Εύκολη ένωση για κάθε συνδυασμό: νήμα με μονόκλωνη, μονόκλωνη με fluorocarbon.','An easy join for any pair: braid to mono, mono to fluorocarbon.')},
 {g:'join', id:'albright', name:'Albright', use:T('Για λεπτή πετονιά πάνω σε πολύ πιο χοντρή ή σε παράμαλλο.','For a thin line onto a much thicker line or leader.')},
 {g:'join', id:'blood', name:'Blood', use:T('Για δύο πετονιές με παρόμοια διάμετρο.','For two lines of similar diameter.')}
];
var IDX=null;
function idx(){ if(IDX) return IDX; IDX=fetch(KB+'index.json').then(function(r){ return r.json(); }).catch(function(){ IDX=null; return {}; }); return IDX; }
function fmt(s){ var m=Math.floor(s/60), x=Math.round(s%60); return m+':'+(x<10?'0':'')+x; }
function vcard(k){
  var c=mk('div','card kn kv'); c.appendChild(mk('h3',null,k.name)); c.appendChild(mk('p','note',k.use));
  var cur=k.id, seg2=null;
  if(k.alt){ seg2=mk('div','seg kvar'); [[k.id,T('Στριφτάρι','Swivel')],[k.alt,T('Αγκίστρι','Hook')]].forEach(function(v,j){ var b=mk('button',null,v[1]); b.type='button'; b.setAttribute('aria-pressed',String(j===0)); b.addEventListener('click',function(){ Array.prototype.forEach.call(seg2.children,function(x){ x.setAttribute('aria-pressed',String(x===b)); }); load(v[0]); }); seg2.appendChild(b); }); c.appendChild(seg2); }
  var v=document.createElement('video'); v.setAttribute('playsinline',''); v.muted=true; v.preload='none'; v.className='kvid'; c.appendChild(v);
  var cap=mk('div','kcap'), cb=mk('b'), cd=mk('span','note'); cap.appendChild(cb); cap.appendChild(cd); c.appendChild(cap);
  var list=mk('ol','ksteps'); c.appendChild(list);
  var ctl=mk('div','kctl'), prev=mk('button','btn ghost sm','◀'), play=mk('button','btn acc sm',T('▶ Παίξε','▶ Play')), next=mk('button','btn sm','▶▶'), loop=mk('button','btn ghost sm',T('⟳ Επανάληψη βήματος','⟳ Repeat step'));
  [prev,play,next,loop].forEach(function(b){ b.type='button'; ctl.appendChild(b); }); c.appendChild(ctl);
  var D=null, si=-1, rep=false;
  function stepAt(t){ var r=-1; if(D) D.steps.forEach(function(s,j){ if(t>=s.start-0.05) r=j; }); return r; }
  function show(j){ if(j===si) return; si=j; var s=D&&D.steps[j];
    cb.textContent=s?(j+1)+'/'+D.steps.length+' · '+(EN?s.en:s.el):(D?(EN?D.title_en:D.title_el):''); cd.textContent=s?'':T('Πάτα «Παίξε» ή διάλεξε βήμα.','Tap «Play» or pick a step.');
    Array.prototype.forEach.call(list.children,function(li,n){ li.className=n===j?'on':''; }); }
  function go(j,pl){ if(!D) return; j=Math.max(0,Math.min(D.steps.length-1,j)); try{ v.currentTime=D.steps[j].start+0.01; }catch(e){} show(j); if(pl) v.play().catch(function(){}); }
  function load(id){ cur=id; si=-1; v.pause(); idx().then(function(I){ D=I[id]||null; v.poster=KB+'knot_'+id+'_poster.webp'; v.src=KB+'knot_'+id+'.mp4';
      list.replaceChildren(); if(D) D.steps.forEach(function(s,j){ var li=mk('li',null,EN?s.en:s.el); li.addEventListener('click',function(){ go(j,true); }); list.appendChild(li); }); show(-1); }); }
  v.addEventListener('timeupdate',function(){ if(!D) return; if(rep&&si>=0&&v.currentTime>D.steps[si].end+0.4){ v.currentTime=D.steps[si].start+0.01; return; } show(stepAt(v.currentTime)); });
  v.addEventListener('play',function(){ play.textContent=T('❚❚ Παύση','❚❚ Pause'); });
  v.addEventListener('pause',function(){ play.textContent=T('▶ Παίξε','▶ Play'); });
  v.addEventListener('ended',function(){ play.textContent=T('▶ Ξανά','▶ Again'); });
  v.addEventListener('click',function(){ play.click(); });
  play.addEventListener('click',function(){ if(v.paused){ if(v.ended) v.currentTime=0; v.play().catch(function(){}); } else v.pause(); });
  prev.addEventListener('click',function(){ go(si<=0?0:si-1,true); });
  next.addEventListener('click',function(){ go(si+1,true); });
  loop.addEventListener('click',function(){ rep=!rep; loop.className='btn sm '+(rep?'acc':'ghost'); if(rep&&si<0) go(0,true); });
  c.stopKnot=function(){ try{ v.pause(); }catch(e){} };
  load(cur); return c;
}
/* CSS */
var st=document.createElement('style');
st.textContent='.kn svg{display:block;width:100%;height:auto;border-radius:12px;background:rgba(127,150,160,.1)}.kn path{fill:none;stroke-linecap:round;stroke-linejoin:round}.kn .m{stroke:currentColor}.kn .tag{stroke:#E8743B}.kn .hi{stroke:#2FA7B8}.kn .hook{stroke:#8C9BA3}.kn .dr{stroke-dasharray:1;stroke-dashoffset:1;animation:kndraw .8s ease forwards}.kn .fd{animation:knfade .6s ease both}@keyframes kndraw{to{stroke-dashoffset:0}}.kn .kvid{display:block;width:100%;aspect-ratio:1;border-radius:12px;background:#0B1620;margin-top:8px}.kn .kvar{margin:6px 0 2px}.kn .ksteps{margin:6px 0 0;padding-left:22px}.kn .ksteps li{padding:5px 0;opacity:.6;cursor:pointer}.kn .ksteps li.on{opacity:1;font-weight:600;color:#E8743B}.kn h4{margin:14px 4px 2px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;opacity:.7}@keyframes knfade{from{opacity:0}to{opacity:1}}@media(prefers-reduced-motion:reduce){.kn .dr{animation:none;stroke-dashoffset:0}.kn .fd{animation:none}}.kn .kcap{margin:10px 0 2px}.kn .kcap b{display:block;font-size:15px}.kn .kctl{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.kn .kctl .btn{min-height:40px}.kn .kdots{display:flex;gap:6px;margin-top:8px}.kn .kdots i{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.25}.kn .kdots i.on{opacity:1;background:#E8743B}';
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
intro.appendChild(mk('p','note',T('3D βίντεο βήμα-βήμα: γκρι η κύρια πετονιά, πορτοκαλί η άκρη που δένει, πράσινο το νήμα, μπλε το παράμαλλο. Πάτα ένα βήμα για να το δεις ξανά. Βρέξε πάντα τον κόμπο πριν τον σφίξεις και δοκίμασέ τον με πραγματική πετονιά πριν βασιστείς πάνω του.','Step-by-step 3D videos: grey is the main line, orange the tag end, green braid, blue leader. Tap a step to watch it again. Always wet the knot before tightening and test it on real line before relying on it.')));
var native=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
if(!native&&'caches' in window){
  var ob=mk('button','btn sm',''), os=mk('span','note',''); ob.type='button'; intro.appendChild(ob); intro.appendChild(os);
  var files=function(I){ var f=[KB+'index.json']; Object.keys(I).forEach(function(id){ f.push(KB+'knot_'+id+'.mp4', KB+'knot_'+id+'_poster.webp'); }); return f; };
  var state=function(){ return idx().then(function(I){ var f=files(I); return caches.open('alkyon-knots').then(function(c){ return Promise.all(f.map(function(u){ return c.match(u); })); }).then(function(r){ return r.filter(Boolean).length===f.length&&f.length>1; }); }); };
  var label=function(ok){ ob.textContent=ok?T('✓ Αποθηκευμένα για χρήση χωρίς σήμα','✓ Saved for use without signal'):T('⬇ Αποθήκευση για χωρίς σήμα (περίπου 15 MB)','⬇ Save for use without signal (about 15 MB)'); ob.disabled=!!ok; };
  state().then(label);
  ob.addEventListener('click',function(){ ob.disabled=true; idx().then(function(I){ var f=files(I), n=0; return caches.open('alkyon-knots').then(function(c){ return Promise.all(f.map(function(u){ return fetch(u,{cache:'reload'}).then(function(r){ if(!r.ok) throw new Error(r.status); return c.put(u,r); }).then(function(){ n++; os.textContent=' '+n+'/'+f.length; }); })); }); }).then(function(){ os.textContent=''; label(true); },function(){ os.textContent=T(' Απέτυχε, δοκίμασε ξανά με σήμα.',' Failed, try again with signal.'); ob.disabled=false; }); });
}
box.appendChild(intro);
var cards=[];
[['hook',T('Σε αγκίστρι, στριφτάρι, τεχνητό','To hook, swivel, lure')],['join',T('Ένωση πετονιών (νήμα με παράμαλλο)','Line to line (braid to leader)')]].forEach(function(gr){
  box.appendChild(mk('h4',null,gr[1]));
  VK.filter(function(k){ return k.g===gr[0]; }).forEach(function(k){ var c=vcard(k); box.appendChild(c); cards.push(c); });
});
box.appendChild(mk('h4',null,T('Θηλιά στη μέση της πετονιάς','Loop in the middle of the line')));
KNOTS.forEach(function(k){ var c=card(k); box.appendChild(c); cards.push(c); });
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
