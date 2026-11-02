/* Εξοπλισμός / Tackle: καλάμια, μουλινέδες, πετονιές, αγκίστρια, τεχνητά. Αποθηκεύεται στη συσκευή (localStorage alkyon-tackle). */
(function(){
'use strict';
var C=window.AlkyonCore, box=document.getElementById('pTackle'); if(!C||!box) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var TYPES=[
  ['rod',T('Καλάμια','Rods'),T('Καλάμι','Rod'),'🎣',T('Μήκος · δράση · βάρος δολώματος (π.χ. 2,7 m · 20–50 g)','Length · action · lure weight (e.g. 9 ft · 20–50 g)')],
  ['reel',T('Μουλινέδες','Reels'),T('Μουλινέ','Reel'),'⚙️',T('Μέγεθος · σχέση (π.χ. 4000 · 5.2:1)','Size · ratio (e.g. 4000 · 5.2:1)')],
  ['line',T('Νήματα','Main lines'),T('Νήμα','Main line'),'🧵',T('Τύπος · πάχος/lb · μήκος (π.χ. πλεκτό PE 1.5 · 150 m)','Type · mm/lb · length (e.g. braid PE 1.5 · 150 m)')],
  ['leader',T('Πετονιές (leader)','Leaders'),T('Πετονιά (leader)','Leader'),'➰',T('Τύπος · πάχος · μήκος (π.χ. fluorocarbon 0,40 mm · 2 m)','Type · mm · length (e.g. fluorocarbon 0.40 mm · 2 m)')],
  ['hook',T('Αγκίστρια','Hooks'),T('Αγκίστρι','Hook'),'🪝',T('Μέγεθος · τύπος (π.χ. Νο 2/0 · circle)','Size · type (e.g. 2/0 · circle)')],
  ['lure',T('Ζόκες / τεχνητά','Jigs / lures'),T('Ζόκα / τεχνητό','Jig / lure'),'🐟',T('Είδος · βάρος · χρώμα (π.χ. jig 40 g · ροζ)','Kind · weight · colour (e.g. jig 40 g · pink)')],
  ['acc',T('Αξεσουάρ','Accessories'),T('Αξεσουάρ','Accessory'),'🔹',T('Beads, φωτάκια LED, στριφτάρια, κλιπ (π.χ. glow 6×8 mm)','Beads, LED lights, swivels, snaps (e.g. glow 6×8 mm)')],
  ['gun',T('Ψαροντούφεκα','Spearguns'),T('Ψαροντούφεκο','Speargun'),'🔱',T('Μήκος · τύπος (π.χ. 90 cm · λάστιχο / πνευματικό)','Length · type (e.g. 90 cm · band / pneumatic)')],
  ['shaft',T('Ακόντια / σαΐτες','Shafts'),T('Ακόντιο / σαΐτα','Shaft'),'➶',T('Διάμετρος · μήκος · μύτη (π.χ. 6,5 mm · 120 cm · flopper)','Diameter · length · tip (e.g. 6.5 mm · 120 cm · flopper)')],
  ['band',T('Λάστιχα','Bands'),T('Λάστιχο','Band'),'➰',T('Διάμετρος · μήκος (π.χ. 16 mm · 60 cm)','Diameter · length (e.g. 16 mm · 60 cm)')],
  ['float',T('Σημαδούρες / πλωτήρες','Floats'),T('Σημαδούρα / πλωτήρας','Float'),'🟠',T('Τύπος · πετονιά (π.χ. torpedo · 20 m)','Type · line (e.g. torpedo · 20 m)')],
  ['fins',T('Βατραχοπέδιλα','Fins'),T('Βατραχοπέδιλα','Fins'),'🦶',T('Υλικό · μέγεθος (π.χ. carbon · 42-43)','Material · size (e.g. carbon · 42-43)')],
  ['mask',T('Μάσκες / αναπνευστήρες','Masks & snorkels'),T('Μάσκα / αναπνευστήρας','Mask / snorkel'),'🥽',T('Τύπος (π.χ. χαμηλού όγκου)','Type (e.g. low volume)')],
  ['suit',T('Στολές','Wetsuits'),T('Στολή','Wetsuit'),'🧥',T('Πάχος · μέγεθος (π.χ. 5 mm · M)','Thickness · size (e.g. 5 mm · M)')],
  ['weights',T('Βάρη / ζώνη','Weights & belt'),T('Βάρη / ζώνη','Weights / belt'),'⚓',T('Σύνολο kg (π.χ. 4 kg)','Total kg (e.g. 4 kg)')],
  ['knife',T('Μαχαίρια','Knives'),T('Μαχαίρι','Knife'),'🔪',T('Τύπος · τοποθέτηση (π.χ. πόδι · ανοξείδωτο)','Type · mounting (e.g. leg · stainless)')],
  ['watch',T('Ρολόγια / όργανα','Watches & gauges'),T('Ρολόι / όργανο','Watch / gauge'),'⌚',T('Μοντέλο (π.χ. Garmin Descent)','Model (e.g. Garmin Descent)')],
  ['set',T('Σετ','Sets'),T('Σετ','Set'),'🧰',T('Σημείωση (π.χ. για ψάρεμα βυθού)','Note (e.g. for bottom fishing)')],
  ['other',T('Άλλα','Other'),T('Άλλο','Other'),'📦',T('Περιγραφή','Description')]
];

var TKI={rod:'<path d="M3 21L19 5"/><path d="M19 5c1.5 0 2.5 1 2.5 2.5V11"/><circle cx="21.5" cy="13" r="1.3"/>',reel:'<circle cx="11" cy="12" r="6.5"/><circle cx="11" cy="12" r="2"/><path d="M17.5 12H21M11 5.5V3"/>',line:'<path d="M5 4c7 0 7 8 0 8s-2 8 8 8M16 4h3v4"/>',leader:'<path d="M3 8c4-4 6 4 9 0s5-4 9 0M3 16c4-4 6 4 9 0s5-4 9 0"/>',hook:'<path d="M12 3v11a4 4 0 01-8 0M4 14l-1.5-2.5M12 3a1.8 1.8 0 100 .01"/>',lure:'<path d="M2.5 12c2.8-4.2 7-5.5 11-3.2L19 6v12l-5.5-2.8c-4 2.3-8.2 1-11-3.2z"/><circle cx="8" cy="11" r=".7" fill="currentColor"/>',acc:'<path d="M12 3l8 9-8 9-8-9z"/>',set:'<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M9 8V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V8M3 13h18"/>',other:'<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9"/>'};
function tkIco(t){ var s=el('span','tkico'); s.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(TKI[t]||TKI.other)+'</svg>'; return s; }
var tinfo=function(k){ for(var i=0;i<TYPES.length;i++) if(TYPES[i][0]===k) return TYPES[i]; return TYPES[TYPES.length-1]; };
var S=C.Store;
var SPEARTY=['gun','shaft','band','float','fins','mask','suit','weights','knife','watch'], ANGTY=['rod','reel','leader','lure','hook'];
function tprof(){ try{ return localStorage.getItem('alkyon-fprof')||'boat'; }catch(e){ return 'boat'; } }
function typeOn(k,keep){ var sp=tprof()==='spear'; if(SPEARTY.indexOf(k)>=0){ if(sp||k===keep) return true; return (S.raw('tackle')||[]).some(function(x){ return x.type===k; }); } if(ANGTY.indexOf(k)>=0){ if(!sp||k===keep) return true; return (S.raw('tackle')||[]).some(function(x){ return x.type===k; }); } return true; }
function load(){ return (S.raw('tackle')||[]).slice(); }
function put(o){ return S.save('tackle',o); }
function del(id){ return S.remove('tackle',id); }
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function btn(t,cls,fn){ var b=el('button','btn '+(cls||'')+' sm',t); b.type='button'; b.addEventListener('click',fn); return b; }
var KINDS=[['jig',T('Μεταλλική ζόκα (jig)','Metal jig')],['slow',T('Slow pitch jig','Slow pitch jig')],['micro',T('Casting / micro jig','Casting / micro jig')],['minnow',T('Minnow','Minnow')],['popper',T('Popper (επιφάνειας)','Popper (surface)')],['pencil',T('Stickbait / pencil','Stickbait / pencil')],['crank',T('Crankbait / diving','Crankbait / diving')],['jerk',T('Jerkbait','Jerkbait')],['soft',T('Σιλικόνη (soft plastic)','Soft plastic')],['head',T('Jig head (κεφαλή)','Jig head')],['spoon',T('Κουτάλι (spoon)','Spoon')],['egi',T('Καλαμαριέρα (egi)','Squid jig (egi)')],['tai',T('Tai rubber / tenya','Tai rubber / tenya')],['inch',T('Inchiku','Inchiku')],['troll',T('Πλάνο / συρτής','Trolling lure')],['spin',T('Spinner / spinnerbait','Spinner / spinnerbait')],['vib',T('Vibration / blade','Vibration / blade')],['sabiki',T('Σαβίκι','Sabiki')],['other',T('Άλλο','Other')]];
var ACCK=[['swivel',T('Στριφτάρι (swivel)','Swivel')],['snap',T('Κλιπ / snap','Snap / clip')],['ring',T('Split ring / solid ring','Split / solid ring')],['sinker',T('Βαρίδι','Sinker')],['beads',T('Glow beads / χάντρες','Glow beads')],['led',T('Φωτάκι / λάμπα LED','LED light / lamp')],['rig',T('Έτοιμο rig / σύνδεσμος','Ready rig / connector')],['other',T('Άλλο','Other')]];
var kname=function(k){ if(k&&k.indexOf('c:')===0) return k.slice(2); for(var i=0;i<KINDS.length;i++) if(KINDS[i][0]===k) return KINDS[i][1]; for(var j=0;j<ACCK.length;j++) if(ACCK[j][0]===k) return ACCK[j][1]; return ''; };
/* Τεχνική καλαμιού → ποια είδη τεχνητού ταιριάζουν */
var TECH=[['slow',T('Slow pitch jigging','Slow pitch jigging'),['slow']],['jig',T('Jigging (μεταλλικές ζόκες)','Jigging (metal jigs)'),['jig','slow','inch','micro']],['cast',T('Casting / spinning','Casting / spinning'),['jig','micro','minnow','popper','pencil','crank','jerk','soft','head','spoon','spin','vib']],['pop',T('Popping / επιφάνεια','Popping / surface'),['popper','pencil']],['egi',T('Καλαμαριά (eging)','Squid (eging)'),['egi']],['bottom',T('Βυθός / tai rubber','Bottom / tai rubber'),['tai','inch','sabiki','soft','head']],['troll',T('Συρτή (trolling)','Trolling'),['troll','minnow','crank']],['any',T('Γενικό','General'),[]]];
var tech=function(k){ for(var i=0;i<TECH.length;i++) if(TECH[i][0]===k) return TECH[i]; return null; };
var num=function(s){ var v=parseFloat(String(s).replace(',','.')); return isFinite(v)?v:null; };
/* «150-250» ή «2» → [min,max] */
function rng(s){ var m=String(s||'').replace(/[–—]/g,'-').match(/(\d+(?:[.,]\d+)?)\s*(?:-\s*(\d+(?:[.,]\d+)?))?/); if(!m) return null; var a=num(m[1]), b=m[2]!=null?num(m[2]):a; if(a==null||b==null) return null; return a<=b?[a,b]:[b,a]; }
function fr(r){ return r?(r[0]===r[1]?''+r[0]:r[0]+'–'+r[1]):''; }
function frd(r){ return r&&r[0]===0&&r[1]>0?T('έως ','max ')+r[1]:fr(r); }
/* Μονάδες εμφάνισης: αποθήκευση πάντα σε g / kg / m, εμφάνιση και πεδία στις μονάδες που διάλεξες */
function uget(){ var v=String(C.lsGet('alkyon-tk-units','g|kg|m')||'').split('|'); return {w:v[0]==='oz'?'oz':'g',d:v[1]==='lb'?'lb':'kg',l:v[2]==='yd'?'yd':'m'}; }
function rnd(x,n){ var p=Math.pow(10,n); return Math.round(x*p)/p; }
function Wu(){ return uget().w; } function Du(){ return uget().d; } function Lu(){ return uget().l; }
function W(g){ g=+g; return Wu()==='oz'?rnd(g/28.3495,2):rnd(g,1); } function wIn(v){ return rnd(Wu()==='oz'?v*28.3495:v,1); }
function D(k){ k=+k; return Du()==='lb'?rnd(k*2.20462,1):rnd(k,1); } function dIn(v){ return rnd(Du()==='lb'?v/2.20462:v,2); }
function Lm(m){ m=+m; return Lu()==='yd'?Math.round(m*1.09361):Math.round(m); } function lIn(v){ return Math.round(Lu()==='yd'?v/1.09361:v); }
function wr(r){ return r?r.map(W):r; }
function capL(c){ return (c||[]).map(function(x){ return [x[0],Lm(x[1])]; }); }
/* «3-400, 4-300» → [[3,400],[4,300]] (PE – μέτρα) */
function pairs(s){ return String(s||'').split(/[,;]+/).map(function(x){ var m=x.replace(/[–—]/g,'-').match(/(\d+(?:[.,]\d+)?)\s*[-/@x×]\s*(\d+(?:[.,]\d+)?)/i); return m?[num(m[1]),num(m[2])]:null; }).filter(function(p){ return p&&p[0]>0&&p[1]>0; }); }
function pairStr(p){ return (p||[]).map(function(x){ return x[0]+'-'+x[1]; }).join(', '); }
function lpe(it){ var m=((it.spec||'')+' '+(it.name||'')+' '+(it.brand||'')).match(/PE\s*(\d+(?:[.,]\d+)?)/i); return m?num(m[1]):null; }
/* έλεγχος καλάμι / μουλινέ / νήμα */
function compat(rod,reel,line){ var w=[], n=0, p=line?lpe(line):null;
  if(rod&&rod.pe&&p!=null){ if(p<rod.pe[0]-0.001||p>rod.pe[1]+0.001) w.push(T('⚠ Το νήμα PE ','⚠ Line PE ')+p+T(' είναι εκτός ορίων του καλαμιού (PE ',' is outside the rod range (PE ')+frd(rod.pe)+')'); else n++; }
  if(reel&&reel.cap&&reel.cap.length&&p!=null&&line&&line.qty>0){ var hit=reel.cap.filter(function(c){ return Math.abs(c[0]-p)<0.01; })[0], est=!hit, cm=hit?hit[1]:Math.round(reel.cap[0][1]*reel.cap[0][0]/p);
    if(line.qty>cm*1.05) w.push(T('⚠ Στο μουλινέ χωράνε ','⚠ The reel holds ')+(est?'~':'')+Lm(cm)+' '+Lu()+' PE '+p+T(', το νήμα έχει ',', the line has ')+Lm(line.qty)+' '+Lu()); else n++; }
  return {w:w,ok:n}; }
function rodW(rod,g){ return rod&&rod.lw&&g>0&&(g<rod.lw[0]-0.001||g>rod.lw[1]+0.001); }
var fType='all', editing=null, query='', urls={};
function thumbUrl(id){ var k='tk-'+id; if(urls[k]) return Promise.resolve(urls[k]); return C.Photos.get(k).then(function(bl){ if(!bl) return null; urls[k]=URL.createObjectURL(bl); return urls[k]; }).catch(function(){ return null; }); }
function viewer(u){ var o=el('div','tkview'); var i=el('img'); i.src=u; o.append(i); o.addEventListener('click',function(){ o.remove(); }); document.body.append(o); }
function sortKey(){ var v=C.lsGet('alkyon-sort-tackle','new'); return v; }

/* ---- Πρόταση εξοπλισμού για ψάρι ---- */
var advOpen=false, advQ='';
function findSp(q){ q=(q||'').trim().toLowerCase(); if(!q) return null; var db=window.SPECIES_DB||[]; var r=null;
  db.some(function(d){ if((d[0]&&d[0].toLowerCase()===q)||(d[1]&&d[1].toLowerCase()===q)||(d[2]&&d[2].toLowerCase()===q)){ r=d; return true; } return false; });
  if(!r) db.some(function(d){ if((d[0]&&d[0].toLowerCase().indexOf(q)>=0)||(d[1]&&d[1].toLowerCase().indexOf(q)>=0)){ r=d; return true; } return false; });
  return r; }
function advise(q,out){
  out.replaceChildren(); var sp=findSp(q); if(!sp){ out.append(el('p','note',T('Δεν βρήκα αυτό το ψάρι. Δοκίμασε το όνομα όπως στη λίστα.','Fish not found. Try the name as in the list.'))); return; }
  var lat=sp[2], G=(window.TACKLE_GUIDE||{})[lat], inv=load(), info={}; inv.forEach(function(x){ info[x.id]=x; });
  out.append(el('b',null,(sp[0]||sp[1])+' · '+lat));
  /* 1) δικό σου ιστορικό */
  var bs=(S.get('bites')||[]).filter(function(b){ return b.latin===lat||(b.species&&sp[0]&&b.species.toLowerCase()===sp[0].toLowerCase())||(b.species&&sp[1]&&b.species.toLowerCase()===sp[1].toLowerCase()); });
  var term={}, setup={}, n=0;
  bs.forEach(function(b){ if(!b.tk||!b.tk.length) return; n++; var c=C.bc(b);
    b.tk.forEach(function(id){ var x=info[id]; if(!x) return;
      if(x.type==='lure'){ var g=b.tkw&&b.tkw[id], hk=b.tkh&&b.tkh[id]&&info[b.tkh[id]], k=x.name+(g?' '+W(g)+' '+Wu():'')+(hk?' + '+hk.name+(b.tks&&b.tks[b.tkh[id]]?' '+b.tks[b.tkh[id]]:''):''); term[k]=(term[k]||0)+c; }
      else if(x.type==='rod'||x.type==='reel'){ var k2=tinfo(x.type)[3]+' '+x.name; setup[k2]=(setup[k2]||0)+c; } }); });
  var top=function(o){ return Object.keys(o).sort(function(a,b){ return o[b]-o[a]; }).slice(0,3); };
  var h1=el('div','meta'); h1.style.marginTop='8px';
  if(n){ h1.append(el('b',null,T('Από τα δικά σου αλιεύματα ('+n+')','From your own catches ('+n+')')));
    var l1=el('div','meta',top(term).map(function(k){ return '🐟 '+k+' · '+term[k]; }).concat(top(setup).map(function(k){ return k+' · '+setup[k]; })).join('\n')); l1.style.whiteSpace='pre-line'; h1.append(l1); }
  else h1.append(el('span','note',T('Δεν έχεις ακόμα αλιεύματα αυτού του ψαριού με καταγεγραμμένο εξοπλισμό.','No catches of this fish with recorded tackle yet.')));
  out.append(h1);
  /* 2) από τον εξοπλισμό σου */
  if(G){
    var cd=window.AlkyonCond&&AlkyonCond(), wave=cd&&cd.wave!=null?+cd.wave:null;
    var lures=inv.filter(function(x){ return x.type==='lure'&&x.kind&&G.k.indexOf(x.kind)>=0; }).sort(function(a,b){ return G.k.indexOf(a.kind)-G.k.indexOf(b.kind); });
    var h2=el('div','meta'); h2.style.marginTop='8px'; h2.append(el('b',null,T('Από τον εξοπλισμό σου','From your tackle')));
    if(lures.length){ var lines=lures.map(function(x){ var ws=(x.w||[]).map(function(g){ return (G.w[1]>0&&g>=G.w[0]&&g<=G.w[1])?'✔'+W(g):''+W(g); }).join('/'); var surf=(x.kind==='popper'||x.kind==='pencil')&&wave!=null&&wave>=0.8?T(' · μεγάλο κύμα σήμερα',' · rough sea today'):'';
        return '🐟 '+x.name+' · '+kname(x.kind)+(ws?' · '+ws+' '+Wu():'')+surf; });
      var l2=el('div','meta',lines.join('\n')); l2.style.whiteSpace='pre-line'; h2.append(l2); }
    else h2.append(el('div','note',T('Δεν έχεις τεχνητό αυτού του είδους. Συνήθως: ','No lure of these kinds yet. Usually: ')+G.k.slice(0,4).map(kname).join(', ')+'.'));
    out.append(h2);
    var h3=el('div','meta'); h3.style.marginTop='8px'; h3.append(el('b',null,T('Γενικά για αυτό το ψάρι','In general')));
    h3.append(el('div','meta',G.r+(G.w[1]>0?T(' Συνηθισμένο βάρος τεχνητού: ',' Typical lure weight: ')+W(G.w[0])+'–'+W(G.w[1])+' '+Wu()+' (✔ στη λίστα).':''))); out.append(h3);
  } else out.append(el('p','note',T('Δεν έχω γενικό οδηγό για αυτό το είδος, δείχνω μόνο το ιστορικό σου.','No general guide for this species; showing only your history.')));
  out.append(el('p','note',T('Ενδεικτικά: γενικές πρακτικές και τα δικά σου δεδομένα, όχι εγγύηση.','Indicative: general practice plus your data, not a guarantee.')));
}
function advisor(){
  var d=el('details','card'); d.open=advOpen; d.style.margin='8px 0'; d.addEventListener('toggle',function(){ advOpen=d.open; });
  d.append(el('summary',null,T('💡 Τι να χρησιμοποιήσω για… (πρόταση)','💡 What should I use for… (suggestion)')));
  var row=el('div','plsearch'); var inp=el('input'); inp.type='search'; inp.setAttribute('list','tkSpDL'); inp.placeholder=T('π.χ. Παλαμίδα','e.g. Bonito'); inp.value=advQ; inp.maxLength=40;
  var dl=el('datalist'); dl.id='tkSpDL'; (window.SPECIES_DB||[]).forEach(function(r){ if(r[0]){ var o=el('option'); o.value=r[0]; dl.append(o); } if(r[1]){ var o2=el('option'); o2.value=r[1]; dl.append(o2); } });
  var go=el('button','btn',T('Πρότεινε','Suggest')); go.type='button'; row.append(inp,go); d.append(row,dl);
  var out=el('div'); out.style.marginTop='8px'; d.append(out);
  var run=function(){ advQ=inp.value; if(inp.value.trim().length>=2) advise(inp.value,out); };
  go.addEventListener('click',run); inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); run(); } }); inp.addEventListener('change',run);
  if(advQ) run(); return d;
}
function unitsPanel(){
  var d=el('div','card'); d.style.margin='8px 0'; d.append(el('h3',null,T('Μονάδες μέτρησης','Units of measurement')));
  var U=uget(), save=function(k,v){ var u=uget(); u[k]=v; C.lsSet('alkyon-tk-units',u.w+'|'+u.d+'|'+u.l); render(); };
  var row=function(label,key,opts){ var r=el('div'); r.style.margin='8px 0'; r.append(el('div','note',label)); var sg=el('div','seg'); opts.forEach(function(o){ var b=el('button','',o[1]); b.type='button'; b.style.flex='1'; b.setAttribute('aria-pressed',String(U[key]===o[0])); b.addEventListener('click',function(){ save(key,o[0]); }); sg.append(b); }); r.append(sg); d.append(r); };
  row(T('Βάρος (ζόκες, όρια καλαμιού)','Weight (lures, rod ratings)'),'w',[['g','g (γραμμάρια)'],['oz','oz (ουγγιές)']]);
  row(T('Drag μουλινέ','Reel drag'),'d',[['kg','kg'],['lb','lb']]);
  row(T('Μήκος νήματος / χωρητικότητα','Line length / capacity'),'l',[['m',T('m (μέτρα)','m (metres)')],['yd',T('yd (γιάρδες)','yd (yards)')]]);
  var pr=el('div','acts'); pr.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:8px';
  pr.append(btn(T('Μετρικά (g · kg · m)','Metric (g · kg · m)'),'ghost',function(){ C.lsSet('alkyon-tk-units','g|kg|m'); render(); }),btn(T('Αμερικάνικα (oz · lb · yd)','US (oz · lb · yd)'),'ghost',function(){ C.lsSet('alkyon-tk-units','oz|lb|yd'); render(); })); d.append(pr);
  d.append(el('p','note',T('Αλλάζουν οι κάρτες, τα πεδία της φόρμας και οι προτάσεις. Τα δεδομένα αποθηκεύονται πάντα σε g, kg και m, οπότε μπορείς να αλλάζεις όποτε θες. Το πεδίο «Χαρακτηριστικά» είναι ελεύθερο κείμενο και δεν μετατρέπεται.','Cards, form fields and suggestions change. Data is always stored in g, kg and m, so you can switch at any time. The “Specs” field is free text and is not converted.')));
  return d;
}

/* ---- Υπενθυμίσεις, λίστα αγορών, αντίγραφο ασφαλείας ---- */
var SHOPK='alkyon-tk-shop';
function daysBetween(a,b){ return Math.round((Date.parse(b)-Date.parse(a))/86400000); }
var FISH_LIM={reel:50,leader:10,line:100};
function fishWith(id,since){ return (S.get('bites')||[]).filter(function(b){ return (!since||(b.date||'')>=since)&&b.tk&&b.tk.indexOf(id)>=0; }).reduce(function(n,b){ return n+C.bc(b); },0); }
function reminders(){
  var out={low:[],svc:[],nodate:[]}, today=C.nicosiaToday(), trips=S.get('trips')||[];
  load().forEach(function(it){
    if((it.type==='hook'||it.type==='lure'||it.type==='acc')&&it.qty!=null&&it.qty<=2) out.low.push(it);
    if(it.type==='reel'){ if(it.svc){ var sd=daysBetween(it.svc,today); var fz=fishWith(it.id,it.svc); if(sd>90||fz>=FISH_LIM.reel) out.svc.push({it:it,txt:T('Συντηρήθηκε πριν ','Serviced ')+sd+T(' ημέρες',' days ago')+(fz?' · '+fz+T(' ψάρια από τότε',' fish since'):''),act:'svc'}); } else out.nodate.push({it:it,txt:T('Δεν έχεις βάλει ημερομηνία συντήρησης','No service date set')}); }
    if((it.type==='line'||it.type==='leader')&&it.since){ var nd=daysBetween(it.since,today), nt=trips.filter(function(x){ return (x.date||'')>=it.since; }).length;
      var fz2=fishWith(it.id,it.since), old=it.type==='leader'?(nd>60||nt>15||fz2>=FISH_LIM.leader):(nd>180||fz2>=FISH_LIM.line); if(old) out.svc.push({it:it,txt:T('Από την αλλαγή: ','Since change: ')+nd+T(' ημέρες · ',' days · ')+nt+T(' έξοδοι',' trips')+(fz2?' · '+fz2+T(' ψάρια',' fish'):''),act:'chg'}); }
  });
  return out;
}
function remCount(){ try{ var r=reminders(); return r.low.length+r.svc.length; }catch(e){ return 0; } }
function shopLoad(){ var a=C.lsGet(SHOPK,[]); return Array.isArray(a)?a.filter(function(x){ return x&&typeof x.t==='string'; }):[]; }
function shopSave(a){ C.lsSet(SHOPK,a.slice(0,200)); }
function blobUrl(b){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=rej; r.readAsDataURL(b); }); }
function listPanel(){
  var d=el('div','card'); d.style.margin='8px 0'; d.append(el('h3',null,T('Υπενθυμίσεις και λίστα','Reminders and list')));
  var R=reminders(), today=C.nicosiaToday();
  var sec=function(title){ var h=el('b',null,title); h.style.cssText='display:block;margin:10px 0 4px'; d.append(h); };
  var row=function(txt,sub,actBtn){ var r=el('div','meta'); r.style.cssText='display:flex;gap:8px;align-items:center;justify-content:space-between;padding:3px 0'; var x=el('span',null,txt+(sub?' · '+sub:'')); x.style.flex='1'; r.append(x); if(actBtn) r.append(actBtn); d.append(r); };
  sec(T('⚠ Σου τελειώνουν','⚠ Running low'));
  if(!R.low.length) d.append(el('div','note',T('Τίποτα (δείχνει είδη με ποσότητα 2 ή λιγότερο).','Nothing (shows items with quantity 2 or less).')));
  R.low.forEach(function(it){ row(tinfo(it.type)[3]+' '+(it.name||'—'),'×'+it.qty); });
  if(R.low.length) d.append(btn(T('＋ Πρόσθεσε στη λίστα αγορών','＋ Add to shopping list'),'ghost',function(){ var a=shopLoad(); R.low.forEach(function(it){ var t=(it.name||'—')+(it.brand?' ('+it.brand+')':''); if(!a.some(function(x){ return x.t===t; })) a.push({t:t,d:false}); }); shopSave(a); render(); }));
  sec(T('🔧 Συντήρηση / αλλαγή','🔧 Service / change'));
  if(!R.svc.length) d.append(el('div','note',T('Όλα εντάξει με βάση τις ημερομηνίες που έχεις βάλει.','All fine based on the dates you entered.')));
  R.svc.forEach(function(o){ var it=o.it; row(tinfo(it.type)[3]+' '+(it.name||'—'),o.txt,btn(o.act==='svc'?T('✔ Συντηρήθηκε','✔ Serviced'):T('✔ Άλλαξα','✔ Changed'),'ghost',function(){ var c=JSON.parse(JSON.stringify(it)); if(o.act==='svc') c.svc=today; else c.since=today; put(c); render(); })); });
  if(R.nodate.length){ var nb=el('div','note',T('Χωρίς ημερομηνία συντήρησης: ','No service date: ')+R.nodate.map(function(o){ return o.it.name||'—'; }).join(', ')+T(' (πάτα «✔ Συντηρήθηκε» στην κάρτα όταν τα λιπάνεις).',' (tap “✔ Serviced” on the card when you service them).')); d.append(nb); }
  d.append(el('p','note',T('Ενδεικτικά όρια: μουλινέ 90 ημέρες ή 50 ψάρια · πετονιά (leader) 60 ημέρες, 15 έξοδοι ή 10 ψάρια · νήμα 180 ημέρες ή 100 ψάρια. Είναι γενικοί κανόνες, όχι οδηγία κατασκευαστή.','Rough limits: reel 90 days or 50 fish · leader 60 days, 15 trips or 10 fish · main line 180 days or 100 fish. General rules of thumb, not a manufacturer instruction.')));
  sec(T('🛒 Λίστα αγορών','🛒 Shopping list'));
  var a=shopLoad(), ad=el('div'); ad.style.cssText='display:flex;gap:6px;margin:4px 0';
  var inp=el('input'); inp.type='text'; inp.maxLength=80; inp.placeholder=T('π.χ. αγκίστρια 4/0','e.g. 4/0 hooks'); inp.style.flex='1';
  var addIt=function(){ var t=inp.value.trim(); if(!t) return; var l=shopLoad(); l.push({t:t.slice(0,80),d:false}); shopSave(l); render(); };
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); addIt(); } });
  ad.append(inp,btn(T('Πρόσθεσε','Add'),'',addIt)); d.append(ad);
  if(!a.length) d.append(el('div','note',T('Η λίστα είναι άδεια.','The list is empty.')));
  a.forEach(function(x,i){ var tb=btn(x.d?'☑':'☐','ghost',function(){ var l=shopLoad(); if(l[i]){ l[i].d=!l[i].d; shopSave(l); render(); } }); tb.setAttribute('aria-label',T('Σημείωση ως αγορασμένο','Mark as bought'));
    var rm=btn('✕','ghost',function(){ var l=shopLoad(); l.splice(i,1); shopSave(l); render(); }); rm.setAttribute('aria-label',T('Διαγραφή','Delete'));
    var r=el('div','meta'); r.style.cssText='display:flex;gap:6px;align-items:center;padding:2px 0'; var tx=el('span',null,x.t); tx.style.cssText='flex:1;'+(x.d?'text-decoration:line-through;opacity:.6':''); r.append(tb,tx,rm); d.append(r); });
  if(a.some(function(x){ return x.d; })) d.append(btn(T('Καθάρισε τα αγορασμένα','Clear bought items'),'ghost',function(){ shopSave(shopLoad().filter(function(x){ return !x.d; })); render(); }));
  d.append(el('p','note',T('Η λίστα αγορών αποθηκεύεται μόνο σε αυτή τη συσκευή.','The shopping list is stored on this device only.')));
  sec(T('💾 Αντίγραφο ασφαλείας εξοπλισμού','💾 Tackle backup'));
  var msg=el('p','note'); msg.setAttribute('role','status');
  var ex=btn(T('Αποθήκευση σε αρχείο','Save to file'),'ghost',async function(){
    try{ var items=load(), photos={}; for(var i=0;i<items.length;i++){ var tk=items[i]; if(tk.photo){ try{ var bl=await C.Photos.get('tk-'+tk.id); if(bl) photos['tk-'+tk.id]=await blobUrl(bl); }catch(e){} } }
      var data={app:'alkyon',v:2,tackle:items,photos:photos};
      var an=document.createElement('a'); an.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})); an.download='alkyon-tackle-'+C.nicosiaToday()+'.json'; document.body.append(an); an.click(); an.remove();
      msg.textContent=T('Αποθηκεύτηκαν ','Saved ')+items.length+T(' είδη.',' items.');
    }catch(e){ msg.textContent=T('Η εξαγωγή απέτυχε.','Export failed.'); } });
  var imL=el('label','btn ghost sm',T('Επαναφορά από αρχείο','Restore from file')); imL.style.cursor='pointer'; var imI=el('input'); imI.type='file'; imI.accept='application/json,.json'; imI.hidden=true;
  imI.addEventListener('change',async function(){ var f=imI.files&&imI.files[0]; if(!f) return;
    try{ var j=JSON.parse(await f.text()), arr=Array.isArray(j.tackle)?j.tackle:null; if(!arr) throw new Error('x'); var n=0, known={}; TYPES.forEach(function(t){ known[t[0]]=1; });
      for(var i=0;i<arr.length;i++){ var it=arr[i]; if(it&&typeof it==='object'&&typeof it.id==='string'&&known[it.type]){ await put(it); n++; } }
      var ph=j.photos&&typeof j.photos==='object'?j.photos:{}; for(var k in ph){ if(k.indexOf('tk-')===0&&typeof ph[k]==='string'){ try{ var bb=await (await fetch(ph[k])).blob(); await C.Photos.put(k,bb); urls[k]=null; }catch(e){} } }
      msg.textContent=n+T(' είδη επαναφέρθηκαν.',' items restored.'); setTimeout(render,600);
    }catch(e){ msg.textContent=T('Το αρχείο δεν διαβάστηκε.','The file could not be read.'); }
    imI.value=''; });
  imL.append(imI); var br2=el('div','acts'); br2.style.cssText='display:flex;gap:6px;flex-wrap:wrap'; br2.append(ex,imL); d.append(br2,msg);
  d.append(el('p','note',T('Ο εξοπλισμός περιλαμβάνεται και στο γενικό αντίγραφο (Ρυθμίσεις) και συγχρονίζεται στο λογαριασμό σου όταν είσαι συνδεδεμένος.','Tackle is also part of the general backup (Settings) and syncs to your account when you are signed in.')));
  return d;
}
var selMode=false, selSet={}, SELK={rod:1,reel:1,line:1,leader:1}, SELORD=['rod','reel','line','leader'];
function selPanel(){
  var pn=el('div','card'); pn.style.margin='8px 0'; pn.id='tkSelPanel';
  pn.append(el('h3',null,T('Βάλε είδη σε σετ','Put items into a setup')));
  var info=el('p','note'); info.setAttribute('role','status'); pn.append(info);
  var ls=el('label','f'); ls.append(document.createTextNode(T('Σετ','Setup')));
  var ts=el('select'); var o0=el('option',null,T('＋ Νέο σετ','＋ New setup')); o0.value='__new'; ts.append(o0);
  load().filter(function(x){ return x.type==='set'; }).forEach(function(x){ var o=el('option',null,x.name||'—'); o.value=x.id; ts.append(o); });
  ls.append(ts); pn.append(ls);
  var go=btn(T('Βάλε στο σετ','Add to setup'),'',function(){ apply(); }); go.id='tkSelGo'; pn.append(go);
  var items=function(){ var ex={}; load().forEach(function(x){ ex[x.id]=x; }); return Object.keys(selSet).map(function(i){ return ex[i]; }).filter(Boolean); };
  var upd=function(){ var it=items(); info.textContent=it.length?(T('Επιλέχθηκαν: ','Selected: ')+it.map(function(x){ return tinfo(x.type)[3]+' '+(x.name||'—'); }).join(' · ')):T('Τσέκαρε καλάμι, μουλινέ, πετονιά ή αρτάνα (ένα από κάθε είδος).','Tick a rod, reel, line or leader (one of each kind).'); go.disabled=!it.length; };
  pn._upd=upd; upd();
  function apply(){
    var it=items(), by={}, bad=false, dup=false;
    it.forEach(function(x){ if(!SELK[x.type]) bad=true; else if(by[x.type]) dup=true; else by[x.type]=x; });
    if(bad){ info.textContent=T('Σε σετ μπαίνουν μόνο καλάμι, μουλινέ, πετονιά και αρτάνα.','Only rod, reel, line and leader can go into a setup.'); return; }
    if(dup){ info.textContent=T('Διάλεξε ένα είδος από κάθε κατηγορία (π.χ. ένα καλάμι).','Pick one of each kind (e.g. one rod).'); return; }
    var finish=function(o){ put(o); selMode=false; selSet={}; render(); try{ C.toast(T('Το σετ αποθηκεύτηκε.','Setup saved.')); }catch(e){} };
    if(ts.value==='__new'){
      if(!by.rod){ info.textContent=T('Για νέο σετ διάλεξε τουλάχιστον ένα καλάμι.','For a new setup choose at least a rod.'); return; }
      var dn=(by.rod.name||'')+(by.reel?' + '+(by.reel.name||''):'');
      var mk=function(nm){ if(nm===null||nm===undefined) return; nm=String(nm).trim()||dn; finish({id:'tk'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),type:'set',name:nm.slice(0,120),brand:'',spec:'',notes:'',ts:Date.now(),members:SELORD.map(function(k){ return by[k]&&by[k].id; }).filter(Boolean)}); };
      if(window.AlkyonAsk&&AlkyonAsk.prompt) AlkyonAsk.prompt(T('Όνομα σετ','Setup name'),{value:dn,ok:T('Αποθήκευση','Save'),cancel:T('Άκυρο','Cancel'),max:120}).then(mk); else mk(dn);
    } else {
      var st=load().filter(function(x){ return x.id===ts.value; })[0]; if(!st){ info.textContent=T('Το σετ δεν βρέθηκε.','Setup not found.'); return; }
      var ex={}; load().forEach(function(x){ ex[x.id]=x; });
      var cur={}; (st.members||[]).forEach(function(i){ var x=ex[i]; if(x&&!cur[x.type]) cur[x.type]=i; });
      SELORD.forEach(function(k){ if(by[k]) cur[k]=by[k].id; });
      var o=JSON.parse(JSON.stringify(st)); o.members=SELORD.map(function(k){ return cur[k]; }).filter(Boolean); finish(o);
    }
  }
  return pn;
}
function render(){
  box.replaceChildren();
  var all=load();
  if(all.length&&!editing) box.append(advisor());
  var chips=el('div','seg'); chips.style.cssText='flex-wrap:wrap;margin:8px 0';
  [['all',T('Όλα','All')]].concat(TYPES.filter(function(t){ return typeOn(t[0],fType); }).map(function(t){ return [t[0],t[1]]; })).concat([['lst',T('Λίστα','List')]]).forEach(function(c){
    var n=c[0]==='all'?all.length:c[0]==='lst'?remCount():all.filter(function(x){ return x.type===c[0]; }).length;
    var b=el('button','',c[1]+(n?' '+n:'')); b.type='button'; b.style.flex='1 0 auto'; b.setAttribute('aria-pressed',String(fType===c[0]));
    b.addEventListener('click',function(){ fType=c[0]; editing=null; render(); }); chips.append(b);
  });
  box.append(chips);
  if(fType==='units'){ box.append(unitsPanel()); return; }
  if(fType==='lst'){ try{ box.append(listPanel()); }catch(e){ box.append(el('p','note',T('Η λίστα δεν φορτώθηκε.','The list could not be loaded.'))); } return; }
  var bar=el('div','row'); bar.style.cssText='display:flex;gap:8px;align-items:flex-end;margin:6px 0';
  var lab=el('label','f sortsel'); lab.style.cssText='margin:0;flex:1'; lab.append(document.createTextNode(T('Ταξινόμηση','Sort by')));
  var sel=el('select'); [['new',T('Πιο πρόσφατα','Newest')],['name',T('Όνομα','Name')],['type',T('Είδος','Type')]].forEach(function(o){ var op=el('option',null,o[1]); op.value=o[0]; sel.append(op); });
  sel.value=sortKey(); sel.addEventListener('change',function(){ C.lsSet('alkyon-sort-tackle',sel.value); render(); }); lab.append(sel);
  var add=btn(T('＋ Νέο','＋ New'),'',function(){ editing={id:null,type:(['all','lst','units'].indexOf(fType)>=0)?(tprof()==='spear'?'gun':'rod'):fType}; render(); }); add.id='tkNew';
  var selB=btn(selMode?T('✕ Τέλος επιλογής','✕ Done'):T('☑ Επιλογή','☑ Select'),'ghost',function(){ selMode=!selMode; selSet={}; render(); }); selB.id='tkSelBtn';
  bar.append(lab,add,selB); box.append(bar);
  if(editing) box.append(form(editing));
  var selP=null; if(selMode&&!editing){ selP=selPanel(); box.append(selP); }
  var qs=el('input'); qs.type='search'; qs.placeholder=T('Αναζήτηση…','Search…'); qs.value=query; qs.style.cssText='width:100%;margin:2px 0 8px'; qs.addEventListener('input',function(){ query=qs.value; var p=qs.selectionStart; render(); var n=box.querySelector('input[type=search]'); if(n){ n.focus(); try{ n.setSelectionRange(p,p); }catch(e){} } }); if(all.length>6) box.append(qs);
  var nmap=names();
  var ql=query.trim().toLowerCase();
  var list=all.filter(function(x){ return (fType==='all'||x.type===fType)&&(!ql||((x.name||'')+' '+(x.brand||'')+' '+(x.spec||'')).toLowerCase().indexOf(ql)>=0); });
  var k=sortKey();
  list.sort(function(a,b){ if(k==='name') return (a.name||'').localeCompare(b.name||'',EN?'en':'el'); if(k==='type') return (a.type||'').localeCompare(b.type||'')||(a.name||'').localeCompare(b.name||'',EN?'en':'el'); return (b.ts||0)-(a.ts||0); });
  if(!list.length&&!editing){ var e=el('p','note empty',T('Δεν έχεις προσθέσει εξοπλισμό ακόμα. Πάτα «＋ Νέο» για καλάμι, μουλινέ, πετονιά, αγκίστρια ή τεχνητά.','No tackle yet. Tap “＋ New” to add a rod, reel, line, hooks or lures.')); box.append(e); }
  list.forEach(function(it){
    var ti=tinfo(it.type), card=el('div','item'), head=el('div','ihead');
    var tb=el('b','ititle'); tb.append(tkIco(it.type),document.createTextNode(it.name||'—')); head.append(tb,el('span','when mono',ti[2])); card.append(head);
    if(selMode&&selP&&SELK[it.type]){ var cb=el('input'); cb.type='checkbox'; cb.className='tkcb'; cb.checked=!!selSet[it.id]; cb.setAttribute('aria-label',it.name||''); cb.style.cssText='width:24px;height:24px;margin:0 10px 0 0;flex:none'; cb.addEventListener('change',function(){ if(cb.checked) selSet[it.id]=1; else delete selSet[it.id]; selP._upd(); }); head.insertBefore(cb,head.firstChild); }
    if(it.photo){ var im=el('img','tkimg'); im.alt=''; im.hidden=true; card.append(im); thumbUrl(it.id).then(function(u){ if(u){ im.src=u; im.hidden=false; im.addEventListener('click',function(){ viewer(u); }); } }); }
    var mem=(it.type==='set')?(it.members||[]).filter(function(i){ return nmap[i]; }):[];
    if(it.type==='set') card.append(el('div','meta',mem.length?mem.map(function(i){ return nmap[i]; }).join(' · '):T('Κανένα στοιχείο','No items')));
    if(it.type==='set'){ var lk={}; load().forEach(function(x){ lk[x.id]=x; }); var bt={}; mem.forEach(function(i){ var x=lk[i]; if(x&&!bt[x.type]) bt[x.type]=x; }); var cp=compat(bt.rod,bt.reel,bt.line);
      if(cp.w.length||cp.ok){ var ce=el('div','meta',cp.w.length?cp.w.join('\n'):T('✔ Καλάμι, μουλινέ και νήμα ταιριάζουν','✔ Rod, reel and line match')); ce.style.whiteSpace='pre-line'; card.append(ce); } }
    var m=[]; if(it.brand) m.push(it.brand); if(it.spec) m.push(it.spec); if(it.qty) m.push((it.type==='line'||it.type==='leader')?Lm(it.qty)+' '+Lu():'×'+it.qty);
    if(it.type==='rod'){ if(it.lw) m.push(frd(wr(it.lw))+' '+Wu()); if(it.pe) m.push('PE '+frd(it.pe)); if(it.tech&&tech(it.tech)) m.push(tech(it.tech)[1]); }
    if(it.type==='reel'){ if(it.hand) m.push(it.hand==='L'?T('Αριστερό χέρι','Left-hand'):T('Δεξί χέρι','Right-hand')); if(it.drag) m.push('drag '+D(it.drag)+' '+Du()); if(it.cap&&it.cap.length) m.push(it.cap.map(function(c){ return 'PE '+c[0]+' – '+Lm(c[1])+' '+Lu(); }).join(' · ')); }
    if(it.w&&it.w.length) m.push(it.w.map(W).join('/')+' '+Wu()); if(it.kind) m.push(kname(it.kind)); if(it.color) m.push(it.color); if(it.sz&&it.sz.length) m.push(it.sz.join('/')); if(it.cord) m.push(it.cord);
    if(m.length) card.append(el('div','meta',m.join(' · ')));
    var ub=(S.get('bites')||[]).filter(function(b){ return it.type==='set'?(mem.length&&b.tk&&mem.every(function(i){ return b.tk.indexOf(i)>=0; })):(b.tk&&b.tk.indexOf(it.id)>=0); }), uf=0, ukg=0; ub.forEach(function(b){ uf+=C.bc(b); ukg+=b.rel?0:(+b.kg||0); });
    if(ub.length) card.append(el('div','meta',T('Αλιεύματα: ','Catches: ')+uf+(ukg?' · '+Math.round(ukg*10)/10+' kg':'')));
    if(it.notes) card.append(el('div','meta',it.notes));
    var today=C.nicosiaToday(), dd=function(a,b){ return Math.round((Date.parse(b)-Date.parse(a))/86400000); };
    if((it.type==='line'||it.type==='leader')&&it.since){ var nd=dd(it.since,today), nt=(S.get('trips')||[]).filter(function(x){ return (x.date||'')>=it.since; }).length, fz3=fishWith(it.id,it.since), old=it.type==='leader'?(nd>60||nt>15||fz3>=FISH_LIM.leader):(nd>180||fz3>=FISH_LIM.line);
      card.append(el('div','meta',T('Από την αλλαγή: ','Since change: ')+nd+T(' ημέρες · ',' days · ')+nt+T(' έξοδοι',' trips')+(fz3?' · '+fz3+T(' ψάρια',' fish'):'')+(old?T(' · 💡 ίσως ώρα για αλλαγή (ενδεικτικά)',' · 💡 may be time to change (rough guide)'):''))); }
    if(it.type==='reel'&&it.svc){ var sd=dd(it.svc,today), fz4=fishWith(it.id,it.svc); card.append(el('div','meta',T('Συντήρηση πριν ','Serviced ')+sd+T(' ημέρες',' days ago')+(fz4?' · '+fz4+T(' ψάρια από τότε',' fish since'):'')+((sd>90||fz4>=FISH_LIM.reel)?T(' · 💡 ίσως ώρα για λίπανση (ενδεικτικά)',' · 💡 may need servicing (rough guide)'):''))); }
    if(it.qty!=null&&it.qty<=2&&(it.type==='hook'||it.type==='lure')) card.append(el('div','meta',T('⚠ Σου τελειώνουν','⚠ Running low')));
    if(it.lost) card.append(el('div','meta',T('Χάθηκαν: ','Lost: ')+it.lost));
    var acts=el('div','acts');
    if((it.type==='hook'||it.type==='lure')&&it.qty>0) acts.append(btn(T('Χάθηκε −1','Lost −1'),'ghost',function(){ var o=JSON.parse(JSON.stringify(it)); o.qty=it.qty-1; o.lost=(it.lost||0)+1; put(o); render(); }));
    if(it.type==='reel') acts.append(btn(T('✔ Συντηρήθηκε','✔ Serviced'),'ghost',function(){ var o=JSON.parse(JSON.stringify(it)); o.svc=today; put(o); render(); }));
    if(it.type==='line'||it.type==='leader') acts.append(btn(T('✔ Άλλαξα','✔ Changed'),'ghost',function(){ var o=JSON.parse(JSON.stringify(it)); o.since=today; put(o); render(); }));
    acts.append(btn(T('Επεξεργασία','Edit'),'ghost',function(){ editing=JSON.parse(JSON.stringify(it)); render(); }),
      btn(T('Διαγραφή','Delete'),'ghost',function(){
        var go=function(){ del(it.id); if(it.photo){ try{ C.Photos.del('tk-'+it.id); }catch(e){} } render(); };
        if(window.AlkyonAsk) AlkyonAsk(T('Διαγραφή «','Delete “')+(it.name||ti[2])+T('»;','”?'),{danger:true,ok:T('Διαγραφή','Delete')}).then(function(ok){ if(ok) go(); }); else go();
      }));
    card.append(acts); box.append(card);
  });
}
function field(label,type,val,ph){ var l=el('label','f'); l.append(document.createTextNode(label)); var i=el('input'); i.type=type||'text'; i.value=val==null?'':val; if(ph) i.placeholder=ph; i.maxLength=120; l.append(i); return {l:l,i:i}; }
function form(it){
  var f=el('div','card'); f.style.margin='8px 0'; f.id='tkForm';
  f.append(el('h3',null,it.id?T('Επεξεργασία','Edit'):T('Νέος εξοπλισμός','New tackle')));
  var ls=el('label','f'); ls.append(document.createTextNode(T('Είδος','Type'))); var ts=el('select'); TYPES.forEach(function(t){ if(!typeOn(t[0],it.type)) return; var o=el('option',null,t[2]); o.value=t[0]; ts.append(o); }); ts.value=it.type; ls.append(ts); f.append(ls);
  var nm=field(T('Όνομα','Name'),'text',it.name,T('π.χ. Shimano Vanquish','e.g. Shimano Vanquish')), br=field(T('Μάρκα / μοντέλο','Brand / model'),'text',it.brand), sp=field(T('Χαρακτηριστικά','Specs'),'text',it.spec,tinfo(it.type)[4]),
      qt=field(T('Ποσότητα','Quantity'),'number',(it.type==='line'||it.type==='leader')&&it.qty!=null?Lm(it.qty):it.qty), nt=field(T('Σημειώσεις','Notes'),'text',it.notes),
      wt=field(T('Διαθέσιμα βάρη (','Available weights (')+Wu()+T('), χωρισμένα με κόμμα','), comma separated'),'text',(it.w||[]).map(W).join(', '),'20, 30, 40, 60'),
      co=field(T('Χρώμα','Colour'),'text',it.color,T('π.χ. ροζ, μπλε/ασημί','e.g. pink, blue/silver')),
      hs=field(T('Διαθέσιμα μεγέθη, χωρισμένα με κόμμα','Available sizes, comma separated'),'text',(it.sz||[]).join(', '),'1/0, 2/0, 4/0'), hc=field(T('Νήμα assist (προαιρετικό)','Assist cord (optional)'),'text',it.cord,T('π.χ. PE 3 · 4 cm','e.g. PE 3 · 4 cm')),
      sn=field(T('Τελευταία αλλαγή','Last changed'),'date',it.since),
      kd=(function(){ var l=el('label','f'); l.append(document.createTextNode(T('Είδος τεχνητού','Lure kind'))); var s=el('select'); var o0=el('option',null,T('— δεν ορίζω —','— not set —')); o0.value=''; s.append(o0); KINDS.forEach(function(k){ var o=el('option',null,k[1]); o.value=k[0]; s.append(o); }); s.value=it.kind||''; l.append(s); return {l:l,i:s}; })(), ak=(function(){ var l=el('label','f'); l.append(document.createTextNode(T('Είδος αξεσουάρ','Accessory kind'))); var s=el('select'); var o0=el('option',null,T('— δεν ορίζω —','— not set —')); o0.value=''; s.append(o0); ACCK.forEach(function(k){ var o=el('option',null,k[1]); o.value=k[0]; s.append(o); }); var cu=[]; load().forEach(function(x){ if(x.type==='acc'&&x.kind&&x.kind.indexOf('c:')===0&&cu.indexOf(x.kind)<0) cu.push(x.kind); }); if(it.kind&&it.kind.indexOf('c:')===0&&cu.indexOf(it.kind)<0) cu.push(it.kind); cu.forEach(function(k){ var o=el('option',null,k.slice(2)); o.value=k; s.append(o); }); var on=el('option',null,T('＋ Δικό μου είδος…','＋ My own kind…')); on.value='__new'; s.append(on); s.value=it.kind||''; l.append(s); var ci=el('input'); ci.type='text'; ci.maxLength=30; ci.placeholder=T('π.χ. γάντι, τσιμπίδα','e.g. glove, pliers'); ci.hidden=true; l.append(ci); s.addEventListener('change',function(){ ci.hidden=s.value!=='__new'; if(!ci.hidden) ci.focus(); }); return {l:l,i:s,c:ci}; })(), sv=field(T('Τελευταία συντήρηση','Last serviced'),'date',it.svc);
  var rw=field(T('Βάρος δολώματος καλαμιού (','Rod lure weight (')+Wu()+')','text',fr(wr(it.lw)),T('π.χ. 150-250','e.g. 150-250')), rp=field(T('PE καλαμιού','Rod PE rating'),'text',fr(it.pe),T('π.χ. 2-3','e.g. 2-3')),
      rt=(function(){ var l=el('label','f'); l.append(document.createTextNode(T('Τεχνική καλαμιού','Rod technique'))); var s=el('select'); var o0=el('option',null,T('— δεν ορίζω —','— not set —')); o0.value=''; s.append(o0); TECH.forEach(function(k){ var o=el('option',null,k[1]); o.value=k[0]; s.append(o); }); s.value=it.tech||''; l.append(s); return {l:l,i:s}; })(),
      ha=(function(){ var l=el('label','f'); l.append(document.createTextNode(T('Χέρι μουλινέ','Reel handle'))); var s=el('select'); [['',T('— δεν ορίζω —','— not set —')],['L',T('Αριστερό','Left-hand')],['R',T('Δεξί','Right-hand')]].forEach(function(k){ var o=el('option',null,k[1]); o.value=k[0]; s.append(o); }); s.value=it.hand||''; l.append(s); return {l:l,i:s}; })(),
      dr=field(T('Drag max (','Max drag (')+Du()+')','text',it.drag!=null?D(it.drag):'',T('π.χ. 10','e.g. 10')), cp=field(T('Χωρητικότητα νήματος: PE-','Line capacity: PE-')+(Lu()==='yd'?T('γιάρδες','yards'):T('μέτρα','metres')),'text',pairStr(capL(it.cap)),T('π.χ. 3-400, 4-300, 5-220','e.g. 3-400, 4-300, 5-220'));
  rw.i.inputMode=rp.i.inputMode=dr.i.inputMode='decimal';
  var i0={dr:dr.i.value,cp:cp.i.value,rw:rw.i.value,wt:wt.i.value,qt:qt.i.value};
  var dl=el('datalist'); dl.id='tkDL'; nm.i.setAttribute('list','tkDL'); nm.l.append(dl);
  var fillDL=function(){ dl.replaceChildren(); (window.TACKLE_LIB||[]).forEach(function(r){ if(r[0]!==ts.value) return; var o=el('option'); o.value=(r[1]+' '+r[2]).trim(); dl.append(o); }); };
  nm.i.addEventListener('change',function(){ var v=nm.i.value.trim().toLowerCase(); (window.TACKLE_LIB||[]).some(function(r){ if(r[0]===ts.value&&(r[1]+' '+r[2]).trim().toLowerCase()===v){ var d=r[3]||null; if(!br.i.value) br.i.value=(d&&d.model)||r[1];
      if(d){ var did=false, set=function(inp,val){ if(val!=null&&val!==''&&!inp.value){ inp.value=val; did=true; } };
        set(sp.i,d.spec); if(r[0]==='line'||r[0]==='leader') set(qt.i,d.qty!=null?Lm(d.qty):null);
        if(r[0]==='acc'){ set(ak.i,d.kind); }
        if(r[0]==='lure'){ set(kd.i,d.kind); if(d.w) set(wt.i,d.w.map(W).join(', ')); }
        if(r[0]==='hook'&&d.sz) set(hs.i,d.sz.join(', '));
        if(r[0]==='rod'){ set(rw.i,fr(wr(d.lw))); set(rp.i,fr(d.pe)); set(rt.i,d.tech); }
        if(r[0]==='reel'){ set(ha.i,d.hand); set(dr.i,d.drag!=null?D(d.drag):null); set(cp.i,pairStr(capL(d.cap))); }
        if(did) msg.textContent=T('Συμπληρώθηκαν αυτόματα τα στοιχεία του μοντέλου. Έλεγξέ τα πριν την αποθήκευση.','Model details filled in automatically. Check them before saving.'); }
      return true; } return false; }); });
  ts.addEventListener('change',function(){ sp.i.placeholder=tinfo(ts.value)[4]; vis(); fillDL(); });
  qt.i.min='0'; qt.i.inputMode='numeric'; wt.i.inputMode='decimal';
  var vis=function(){ var v=ts.value; qt.l.hidden=v==='set'; qt.l.firstChild.textContent=(v==='line'||v==='leader')?(Lu()==='yd'?T('Γιάρδες (yd)','Yards (yd)'):T('Μέτρα (m)','Metres (m)')):T('Ποσότητα','Quantity'); wt.l.hidden=v!=='lure'; co.l.hidden=v!=='lure'; hs.l.hidden=v!=='hook'; kd.l.hidden=v!=='lure'; ak.l.hidden=v!=='acc'; hc.l.hidden=v!=='hook'; sn.l.hidden=!(v==='line'||v==='leader'); sv.l.hidden=v!=='reel'; rw.l.hidden=rp.l.hidden=rt.l.hidden=v!=='rod'; ha.l.hidden=dr.l.hidden=cp.l.hidden=v!=='reel'; };
  vis(); fillDL();
  var memL=el('div','f'), memSel={}, memObj=(it.members||[]).map(function(i){ return load().filter(function(x){ return x.id===i; })[0]; }).filter(Boolean);
  [['rod',T('Καλάμι','Rod')],['reel',T('Μουλινέ','Reel')],['line',T('Νήμα','Main line')],['leader',T('Πετονιά (leader)','Leader')]].forEach(function(ty){
    var l=el('label','f'); l.append(document.createTextNode(ty[1])); var s=el('select'); var o0=el('option',null,ty[0]==='rod'?T('— διάλεξε —','— choose —'):T('— κανένα —','— none —')); o0.value=''; s.append(o0);
    load().filter(function(x){ return x.type===ty[0]; }).sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); }).forEach(function(x){ var o=el('option',null,x.name||'—'); o.value=x.id; s.append(o); });
    var cur=memObj.filter(function(x){ return x.type===ty[0]; })[0]; if(cur) s.value=cur.id; memSel[ty[0]]=s; l.append(s); memL.append(l); });
  var hint=el('p','note',T('Το σετ παίρνει το όνομα του καλαμιού. Πρόσθεσε πρώτα καλάμια, μουλινέδες και νήματα στις αντίστοιχες καρτέλες.','The setup is named after the rod. Add rods, reels and lines in their own tabs first.')); memL.append(hint);
  var setSync=function(){ var s=ts.value==='set'; memL.hidden=!s; br.l.hidden=s; nm.l.hidden=s; sp.l.hidden=s; };
  ts.addEventListener('change',setSync);
  /* v31z404: σε ποιο νερό χρησιμοποιείται (για φιλτράρισμα στη φόρμα ψαριού: λίμνη ή θάλασσα) */
  var wa=(function(){ var l=el('label','f'); l.append(document.createTextNode(T('Νερό','Water'))); var s2=el('select'); [['',T('Θάλασσα και γλυκό νερό','Sea and fresh water')],['sea',T('Μόνο θάλασσα','Sea only')],['fresh',T('Μόνο γλυκό νερό (λίμνη / φράγμα)','Fresh water only (lake / dam)')]].forEach(function(o){ var op=el('option',null,o[1]); op.value=o[0]; s2.append(op); }); s2.value=it.water||''; l.append(s2); return {l:l,i:s2}; })();
  var waSync=function(){ wa.l.hidden=ts.value==='set'||SPEARTY.indexOf(ts.value)>=0; }; ts.addEventListener('change',waSync); waSync();
  f.append(nm.l,br.l,sp.l,rw.l,rp.l,rt.l,ha.l,dr.l,cp.l,qt.l,kd.l,ak.l,wt.l,co.l,hs.l,hc.l,sn.l,sv.l,memL,wa.l,nt.l); setSync();
  var newBlob=null, rmPhoto=false, pv=el('img','tkimg'), pl=el('div','f'); pv.alt=''; pv.hidden=true;
  pl.append(el('span',null,T('Φωτογραφία','Photo')),pv);
  var prow=el('div','acts'); prow.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:4px';
  var mk=function(label,cap){ var l=el('label','btn ghost sm',label); l.style.cursor='pointer'; var i=el('input'); i.type='file'; i.accept='image/*'; if(cap) i.setAttribute('capture','environment'); i.hidden=true;
    i.addEventListener('change',function(){ var fl=i.files&&i.files[0]; if(!fl) return; (C.resizeImage?C.resizeImage(fl):Promise.resolve(fl)).then(function(bl){ newBlob=bl; rmPhoto=false; pv.src=URL.createObjectURL(bl); pv.hidden=false; rm.hidden=false; }).catch(function(){ msg.textContent=T('Η φωτογραφία δεν διαβάστηκε.','Could not read the photo.'); }); i.value=''; });
    l.append(i); return l; };
  var rm=btn(T('Αφαίρεση','Remove'),'ghost',function(){ newBlob=null; rmPhoto=true; pv.hidden=true; rm.hidden=true; });
  prow.append(mk(T('📷 Κάμερα','📷 Camera'),true),mk(T('🖼 Συλλογή','🖼 Gallery'),false),rm); pl.append(prow); rm.hidden=true;
  if(it.photo&&it.id){ thumbUrl(it.id).then(function(u){ if(u&&!newBlob){ pv.src=u; pv.hidden=false; rm.hidden=false; } }); }
  f.append(pl);
  var msg=el('p','note'); msg.setAttribute('role','status'); f.append(msg);
  var acts=el('div','acts');
  acts.append(btn(T('Αποθήκευση','Save'),'',async function(){
    var isSet=ts.value==='set', name=nm.i.value.trim();
    if(isSet){ var rid=memSel.rod.value; if(!rid){ msg.textContent=T('Διάλεξε καλάμι για το σετ.','Choose a rod for the setup.'); return; } name=(load().filter(function(x){ return x.id===rid; })[0]||{}).name||T('Σετ','Setup'); }
    else if(!name){ msg.textContent=T('Γράψε ένα όνομα.','Enter a name.'); nm.i.focus(); return; }
    var o={id:it.id||undefined,type:ts.value,name:name,brand:br.i.value.trim(),spec:sp.i.value.trim(),notes:nt.i.value.trim(),ts:it.ts||Date.now()};
    var q=parseInt(qt.i.value,10); if(!qt.l.hidden&&q>=0&&qt.i.value!==''){ o.qty=(o.type==='line'||o.type==='leader')?((qt.i.value===i0.qt&&it.qty!=null)?it.qty:lIn(q)):q; }
    if(o.type==='lure'){ var ws=wt.i.value.split(/[,;\s]+/).map(function(x){ return wIn(parseFloat(x.replace(',','.'))); }).filter(function(x){ return x>0&&x<5000; }); ws=ws.filter(function(x,i){ return ws.indexOf(x)===i; }).sort(function(a,b){ return a-b; }); if(ws.length) o.w=(wt.i.value===i0.wt&&it.w)?it.w:ws; }
    if(o.type==='lure'&&co.i.value.trim()) o.color=co.i.value.trim();
    if(wa.i.value&&!wa.l.hidden) o.water=wa.i.value;
    if(o.type==='lure'&&kd.i.value) o.kind=kd.i.value; if(o.type==='acc'&&ak.i.value){ if(ak.i.value==='__new'){ var cn=ak.c.value.trim().slice(0,30); if(cn) o.kind='c:'+cn; } else o.kind=ak.i.value; }
    if(o.type==='hook'){ var zs=hs.i.value.split(/[,;]+/).map(function(x){ return x.trim(); }).filter(Boolean); zs=zs.filter(function(x,i){ return zs.indexOf(x)===i; }); if(zs.length) o.sz=zs; if(hc.i.value.trim()) o.cord=hc.i.value.trim(); }
    if((o.type==='line'||o.type==='leader')&&sn.i.value) o.since=sn.i.value;
    if(o.type==='reel'&&sv.i.value) o.svc=sv.i.value;
    if(o.type==='rod'){ var r1=rng(rw.i.value), r2=rng(rp.i.value); if(r1) o.lw=(rw.i.value===i0.rw&&it.lw)?it.lw:r1.map(wIn); if(r2) o.pe=r2; if(rt.i.value) o.tech=rt.i.value; }
    if(o.type==='reel'){ if(ha.i.value) o.hand=ha.i.value; var dv=num(dr.i.value); if(dv>0) o.drag=(dr.i.value===i0.dr&&it.drag)?it.drag:dIn(dv); var cc=pairs(cp.i.value).map(function(c){ return [c[0],lIn(c[1])]; }); if(cc.length) o.cap=(cp.i.value===i0.cp&&it.cap)?it.cap:cc; }
    if(it.lost) o.lost=it.lost;
    if(o.type==='set'){ o.members=['rod','reel','line','leader'].map(function(k){ return memSel[k].value; }).filter(Boolean); o.brand=''; o.spec=''; }
    o.id=o.id||('tk'+Date.now().toString(36)+Math.random().toString(36).slice(2,5));
    try{
      if(newBlob){ await C.Photos.put('tk-'+o.id,newBlob); o.photo=true; urls['tk-'+o.id]=null; }
      else if(rmPhoto){ try{ await C.Photos.del('tk-'+o.id); }catch(e){} urls['tk-'+o.id]=null; }
      else if(it.photo) o.photo=true;
    }catch(e){ msg.textContent=T('Η φωτογραφία δεν αποθηκεύτηκε.','The photo was not saved.'); }
    put(o); editing=null; render();
  }),btn(T('Άκυρο','Cancel'),'ghost',function(){ editing=null; render(); }));
  f.append(acts); return f;
}
var picked=[], pw={}, ph={}, ps={}, TERM={hook:1,lure:1,other:1}, askedD=false;
function union(){ var u=picked.slice(); Object.keys(ph).forEach(function(l){ if(picked.indexOf(l)>=0&&ph[l]&&u.indexOf(ph[l])<0) u.push(ph[l]); }); return u; }
/* v31z407: οικογένεια ψαρέματος: ψαροντούφεκο / λίμνη / θάλασσα με καλάμι. Στην επεξεργασία μετράει ο τύπος του ψαριού. */
function famOf(p){ return p==='spear'?'spear':p==='lake'?'lake':'sea'; }
function curProf(){ var r=window.AlkyonEditRec; return r?(r.prof||'boat'):tprof(); }
function lastSel(){ var fm=famOf(tprof()), bs=(S.get('bites')||[]).filter(function(b){ return b.tk&&b.tk.length&&famOf(b.prof||'boat')===fm; }); if(!bs.length) return {ids:[],w:{},h:{},s:{}}; bs.sort(function(a,b){ return (b._u||0)-(a._u||0); }); var ex={}; load().forEach(function(x){ ex[x.id]=1; }); var b0=bs[0], w={}, h={}, s={}; Object.keys(b0.tkw||{}).forEach(function(k){ if(ex[k]) w[k]=b0.tkw[k]; }); Object.keys(b0.tkh||{}).forEach(function(k){ if(ex[k]&&ex[b0.tkh[k]]) h[k]=b0.tkh[k]; }); Object.keys(b0.tks||{}).forEach(function(k){ if(ex[k]) s[k]=b0.tks[k]; }); return {ids:b0.tk.filter(function(i){ return ex[i]; }),w:w,h:h,s:s}; }
function memHook(lureId){ var bs=(S.get('bites')||[]).filter(function(b){ return b.tkh&&b.tkh[lureId]; }); if(!bs.length) return null; bs.sort(function(a,b){ return (b._u||0)-(a._u||0); }); var hid=bs[0].tkh[lureId]; if(!load().some(function(x){ return x.id===hid; })) return null; return {h:hid,s:(bs[0].tks||{})[hid]}; }
function mount(div,ids,w,h,s){
  if(!div) return; askedD=false; var L=null; if(ids==='last'){ L=lastSel(); picked=L.ids; pw=L.w; ph=L.h; ps=L.s; var sp0=tprof()==='spear', fx0={}; load().forEach(function(x){ fx0[x.id]=x; }); picked=picked.filter(function(i){ var x=fx0[i]; if(!x) return false; if(x.type==='set'||x.type==='other') return !sp0; return (SPEARTY.indexOf(x.type)>=0)===sp0; }); } else { picked=(ids||[]).slice(); pw=Object.assign({},w||{}); ph=Object.assign({},h||{}); ps=Object.assign({},s||{}); }
  /* τα αγκίστρια που ανήκουν σε τεχνητό δεν μένουν και ως ξεχωριστή επιλογή */
  var hv={}; Object.keys(ph).forEach(function(l){ hv[ph[l]]=1; }); picked=picked.filter(function(i){ return !hv[i]; });
  var tdiv=document.getElementById('bTerm'), wdiv=document.getElementById('bTkW'), sg=document.getElementById('bTkSug'), wrap=document.getElementById('bTackleWrap');
  div.replaceChildren(); if(tdiv) tdiv.replaceChildren(); if(wdiv) wdiv.replaceChildren();
  /* v31z374: στη φόρμα ψαριού φαίνεται μόνο ο εξοπλισμός του τύπου ψαρέματος (ψαροντούφεκο ή καλάμι)· ό,τι είναι ήδη επιλεγμένο μένει */
  var full=load(), fx={}, spf=curProf()==='spear'; full.forEach(function(x){ fx[x.id]=x; });
  function fam(t){ return t==='other'?null:SPEARTY.indexOf(t)>=0; }
  var all=full.filter(function(x){ if(picked.indexOf(x.id)>=0) return true;
    if(x.type==='set'){ return (x.members||[]).some(function(i){ var m=fx[i]; return m&&fam(m.type)===spf; }); }
    var f=fam(x.type); if(!(f===null||f===spf)) return false;
    /* v31z404: λίμνη → όχι «μόνο θάλασσα»· θάλασσα → όχι «μόνο γλυκό νερό» */
    var tp=curProf(); if(tp==='lake'&&x.water==='sea') return false; if((tp==='boat'||tp==='shore')&&x.water==='fresh') return false; return true; });
  var order=TYPES.map(function(t){ return t[0]; }), ex={}; all.forEach(function(x){ ex[x.id]=x; });
  var emp=document.getElementById('bTkEmpty'); if(!emp&&wrap){ emp=el('div','note'); emp.id='bTkEmpty'; wrap.append(emp); }
  if(emp){ emp.replaceChildren(); emp.hidden=!!all.length; if(!all.length){ emp.append(document.createTextNode(T('Δεν έχεις εξοπλισμό ακόμα. ','No tackle yet. '))); var gb=el('button','btn ghost sm',T('Πρόσθεσε στο Προφίλ → Εξοπλισμός','Add in Profile → Tackle')); gb.type='button'; gb.addEventListener('click',function(){ var pb=document.getElementById('profBtn'); if(pb) pb.click(); setTimeout(function(){ if(window.AlkyonProfView) AlkyonProfView.set('tackle'); },80); }); emp.append(gb); } }
  if(wrap){ var sp=wrap.querySelectorAll(':scope>span'); if(sp[0]) sp[0].textContent=spf?T('Εξοπλισμός ψαροντουφέκου','Spearfishing gear'):curProf()==='lake'?T('Καλάμι / σετ (γλυκό νερό)','Rod / setup (fresh water)'):T('Καλάμι / σετ','Rod / setup'); if(sp[1]) sp[1].textContent=T('Τερματικό','Terminal tackle'); Array.prototype.forEach.call(sp,function(s2){ s2.hidden=!all.length; }); }
  var rank=function(x){ return x.type==='set'?-1:order.indexOf(x.type); };
  all.sort(function(a,b){ return rank(a)-rank(b)||(a.name||'').localeCompare(b.name||''); });
  var inSet={}; all.forEach(function(x){ if(x.type==='set') (x.members||[]).forEach(function(i){ inSet[i]=1; }); });
  var hooks=all.filter(function(x){ return x.type==='hook'; });
  var btns=[];
  var chipRow=function(label,opts,isOn,onClick){ var row=el('div','tkwrow'); row.append(el('span','note',label)); var cs=el('div','tkchips'); opts.forEach(function(o){ var b=el('button','',o[1]); b.type='button'; b.setAttribute('aria-pressed',String(isOn(o[0]))); b.addEventListener('click',function(){ onClick(o[0]); }); cs.append(b); }); row.append(cs); return row; };
  var refresh=function(){
    var U=union();
    btns.forEach(function(p){ var on=p.it.type==='set'?(p.mem.length>0&&p.mem.every(function(i){ return picked.indexOf(i)>=0; })):U.indexOf(p.it.id)>=0; p.b.setAttribute('aria-pressed',String(on)); });
    if(wdiv){ wdiv.replaceChildren();
      picked.forEach(function(id){ var it=ex[id]; if(!it||it.type!=='lure') return;
        if(it.w&&it.w.length) wdiv.append(chipRow((it.name||'')+' · '+Wu(),it.w.map(function(g){ return [g,W(g)+' '+Wu()]; }),function(g){ return pw[id]===g; },function(g){ if(pw[id]===g) delete pw[id]; else pw[id]=g; refresh(); }));
        if(hooks.length) wdiv.append(chipRow((it.name||'')+T(' · αγκίστρι',' · hook'),hooks.map(function(x){ return [x.id,x.name||'—']; }),function(h2){ return ph[id]===h2; },function(h2){ if(ph[id]===h2){ delete ph[id]; } else { ph[id]=h2; if(ex[h2].sz&&ex[h2].sz.length&&!ps[h2]){ var mm=memHook(id); if(mm&&mm.h===h2&&mm.s) ps[h2]=mm.s; } } refresh(); })); });
      union().forEach(function(id){ var it=ex[id]; if(!it||it.type!=='hook'||!it.sz||!it.sz.length) return; wdiv.append(chipRow((it.name||'')+T(' · μέγεθος',' · size'),it.sz.map(function(z){ return [z,z]; }),function(z){ return ps[id]===z; },function(z){ if(ps[id]===z) delete ps[id]; else ps[id]=z; refresh(); })); }); }
    suggest();
  };
  all.forEach(function(it){ var isSet=it.type==='set', mem=isSet?(it.members||[]).filter(function(i){ return ex[i]; }):[];
    if(isSet&&!mem.length) return;
    if(!isSet&&!TERM[it.type]&&inSet[it.id]) return;
    var term=!!TERM[it.type]; var host=term?tdiv:div; if(!host) return;
    var b=el('button','',tinfo(it.type)[3]+' '+(it.name||'—')); b.type='button'; if(isSet) b.className='tkset';
    b.addEventListener('click',function(){
      if(isSet){ var allOn=mem.every(function(i){ return picked.indexOf(i)>=0; });
        if(!allOn) picked=picked.filter(function(i){ return !ex[i]||TERM[ex[i].type]; });
        mem.forEach(function(i){ var k=picked.indexOf(i); if(allOn){ if(k>=0) picked.splice(k,1); } else if(k<0) picked.push(i); }); }
      else if(it.type==='hook'&&Object.keys(ph).some(function(l){ return ph[l]===it.id&&picked.indexOf(l)>=0; })){ Object.keys(ph).forEach(function(l){ if(ph[l]===it.id) delete ph[l]; }); }
      else { var k2=picked.indexOf(it.id);
        if(k2>=0){ picked.splice(k2,1); delete pw[it.id]; if(it.type==='lure') delete ph[it.id]; }
        else { picked.push(it.id); if(it.type==='lure'&&!ph[it.id]){ var mm2=memHook(it.id); if(mm2){ ph[it.id]=mm2.h; if(mm2.s) ps[mm2.h]=mm2.s; } } } }
      refresh(); });
    btns.push({it:it,b:b,mem:mem}); host.append(b); });
  if(tdiv){ var h2=tdiv.previousElementSibling; if(h2&&h2.tagName==='SPAN') h2.hidden=!tdiv.children.length||!all.length; }
  refresh();
}
/* Πρόταση βάρους: ενδεικτικός κανόνας από βάθος, κύμα και άνεμο + τα δικά σου αλιεύματα με κάθε βάρος */
function suggest(){
  var sg=document.getElementById('bTkSug'); if(!sg) return; var msg=[], ex={}, needD=false; load().forEach(function(x){ ex[x.id]=x; });
  var dEl=document.querySelector('input#bDepth'), depth=dEl&&dEl.value!==''?+dEl.value:null, wv=document.getElementById('dWave'), wd=document.getElementById('dWind'), wave=wv?+wv.value:0, wind=wd?+wd.value:0, cd=window.AlkyonCond&&AlkyonCond(), cur=cd&&cd.cur!=null?+cd.cur:null, dsrc='';
  if(cd&&cd.wave!=null) wave=+cd.wave; if(cd&&cd.wind!=null) wind=+cd.wind;
  if(!(depth>0)){ var lm=document.getElementById('bLocMode'), bs_=document.getElementById('bSpot'); if(lm&&lm.value==='spot'&&bs_){ var sp0=(S.get('spots')||[]).filter(function(x){ return x.id===bs_.value; })[0]; if(sp0&&+sp0.depth>0){ depth=+sp0.depth; dsrc=T(' (από το σημείο)',' (from spot)'); } } }
  var pk=function(t){ return picked.map(function(i){ return ex[i]; }).filter(function(x){ return x&&x.type===t; })[0]; }, rod=pk('rod'), rn=rod?(rod.name||''):'';
  if(rod||pk('reel')){ var cpk=compat(rod,pk('reel'),pk('line')); cpk.w.forEach(function(s){ msg.push(s); }); }
  picked.forEach(function(id){ var it=ex[id]; if(!it||it.type!=='lure') return;
    var tc=rod&&rod.tech&&tech(rod.tech), tk=tc&&tc[2].length&&it.kind&&tc[2].indexOf(it.kind)<0;
    if(tk) msg.push(T('⚠ «','⚠ “')+it.name+T('» (','” (')+kname(it.kind)+T(') δεν ταιριάζει με το καλάμι «',') does not suit the rod “')+rn+T('» (','” (')+tc[1]+')');
    var sel=pw[id]; if(sel&&rodW(rod,sel)) msg.push(T('⚠ Τα ','⚠ ')+W(sel)+' '+Wu()+T(' είναι εκτός ορίων του καλαμιού «',' is outside the rod range “')+rn+T('» (','” (')+frd(wr(rod.lw))+' '+Wu()+')');
    if(!it.w||it.w.length<2) { if(it.w&&it.w.length===1&&rodW(rod,it.w[0])&&!sel) msg.push(T('⚠ Τα ','⚠ ')+W(it.w[0])+' '+Wu()+T(' είναι εκτός ορίων του καλαμιού «',' is outside the rod range “')+rn+T('» (','” (')+frd(wr(rod.lw))+' '+Wu()+')'); return; }
    var line='', pool=it.w, inR=rod&&rod.lw?it.w.filter(function(g){ return !rodW(rod,g); }):it.w, lim=false; if(inR.length&&inR.length<it.w.length){ pool=inR; lim=true; } else if(rod&&rod.lw&&!inR.length) msg.push(T('⚠ Κανένα βάρος της «','⚠ None of the weights of “')+it.name+T('» δεν είναι εντός ορίων του καλαμιού (','” fit the rod range (')+frd(wr(rod.lw))+' '+Wu()+')');
    if(depth>0){ var f=1+(wave>=0.6?0.25:0)+(wind>=15?0.2:0)+(cur>=1?0.4:(cur>=0.5?0.2:0)), want=depth*1.2*f, best=pool.reduce(function(a,g){ return Math.abs(g-want)<Math.abs(a-want)?g:a; },pool[0]);
      line=T('💡 «','💡 “')+it.name+T('»: δοκίμασε ~','”: try ~')+W(best)+' '+Wu()+' ('+T('βάθος ','depth ')+depth+' m'+dsrc+(cur>=0.5?T(', ρεύμα ',', current ')+cur+' kn':'')+(wave>=0.6?T(', κύμα ',', waves ')+wave+' m':'')+(wind>=15?T(', άνεμος ',', wind ')+wind:'')+(lim?T(', εντός ορίων καλαμιού ',', within rod range ')+frd(wr(rod.lw))+' '+Wu():'')+'). '+T('Ενδεικτικός κανόνας.','Rule of thumb only.'); }
    else { line=T('💡 «','💡 “')+it.name+T('»: βάλε βάθος για πρόταση βάρους (συμπληρώνεται μόνο του από τον χάρτη βαθών όταν υπάρχει θέση).','”: enter depth for a weight suggestion (filled in from the depth chart when there is a position).'); needD=true; }
    var cnt={}; (S.get('bites')||[]).forEach(function(b){ if(b.tkw&&b.tkw[id]) cnt[b.tkw[id]]=(cnt[b.tkw[id]]||0)+C.bc(b); });
    var ks=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }); if(ks.length&&cnt[ks[0]]>=3) line+=' '+T('Στα δικά σου: ','Yours: ')+W(ks[0])+' '+Wu()+' ('+cnt[ks[0]]+T(' ψάρια).',' fish).');
    msg.push(line); });
  if(needD&&!askedD){ askedD=true; try{ window.dispatchEvent(new Event('alkyon-needdepth')); }catch(e){} }
  sg.hidden=!msg.length; sg.textContent=msg.join('\n'); sg.style.whiteSpace='pre-line';
}
['bLocMode','bSpot'].forEach(function(i){ var e=document.getElementById(i); if(e) e.addEventListener('change',suggest); });
['bDepth','dWave','dWind'].forEach(function(i){ var e=i==='bDepth'?document.querySelector('input#bDepth'):document.getElementById(i); if(e) e.addEventListener('input',suggest); });
function names(){ var m={}; load().forEach(function(x){ m[x.id]=tinfo(x.type)[3]+' '+(x.name||'—'); }); return m; }
function info(){ var m={}; load().forEach(function(x){ m[x.id]={type:x.type,name:tinfo(x.type)[3]+' '+(x.name||'—'),kind:kname(x.kind)}; }); return m; }
window.AlkyonTackle={all:load,last:lastSel,mount:mount,sel:function(){ return union(); },selW:function(){ var o={}; picked.forEach(function(i){ if(pw[i]) o[i]=pw[i]; }); return o; },selH:function(){ var o={}; picked.forEach(function(i){ if(ph[i]) o[i]=ph[i]; }); return o; },selS:function(){ var o={}; union().forEach(function(i){ if(ps[i]) o[i]=ps[i]; }); return o; },names:names,info:info};
/* v31z409: αλλαγή τύπου ψαρέματος → ο εξοπλισμός της φόρμας ξαναγεμίζει για τον νέο τύπο (όχι αν επεξεργάζεσαι ψάρι) */
window.addEventListener('alkyon-fprof',function(){ if(window.AlkyonEditRec) return; var d=document.getElementById('bTackle'); if(d) try{ mount(d,'last'); }catch(e){} });
try{ window.dispatchEvent(new Event('alkyon-tackle-ready')); }catch(e){}
window.addEventListener('alkyon-fprof',function(){ if(!box.hidden&&!editing){ if(!typeOn(fType)) fType='all'; render(); } });
window.addEventListener('alkyon-pview',function(e){ if(e.detail==='tackle'){ editing=null; render(); } });
S.on('tackle',function(){ if(!box.hidden&&!editing) render(); });
render();
})();
