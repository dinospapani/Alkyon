/* BiteCast 4 · Εξοπλισμός (#tackle) και αντίγραφο ασφαλείας. Ίδια μορφή και ίδια λειτουργία με την κλασική tackle.js (psaro-tackle):
   στοιχεία ανά είδος (βάρος και PE καλαμιού, drag και χωρητικότητα μουλινέ, βάρη ζόκας, μεγέθη αγκιστριών…), σετ με έλεγχο
   καλάμι/μουλινέ/νήμα, προτάσεις μοντέλων από τη βιβλιοθήκη (../tackle-lib.js), «Τι να χρησιμοποιήσω για…» (../tackle-guide.js),
   υπενθυμίσεις αλλαγής/συντήρησης, λίστα αγορών (psaro-tk-shop), μονάδες (psaro-tk-units), φωτογραφία και αρχείο εξοπλισμού. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls, root=null, q='', fType='all';
function S(){ return B.store; }
var TY=[['rod',T('Καλάμια','Rods'),T('Καλάμι','Rod'),T('Μήκος · δράση (π.χ. 2,7 m · fast)','Length · action (e.g. 9 ft · fast)')],['reel',T('Μουλινέδες','Reels'),T('Μουλινέ','Reel'),T('Μέγεθος · σχέση (π.χ. 4000 · 5.2:1)','Size · ratio (e.g. 4000 · 5.2:1)')],['line',T('Νήματα','Main lines'),T('Νήμα','Main line'),T('Τύπος · πάχος (π.χ. πλεκτό PE 1.5)','Type · size (e.g. braid PE 1.5)')],['leader',T('Πετονιές (leader)','Leaders'),T('Πετονιά (leader)','Leader'),T('Τύπος · πάχος (π.χ. fluorocarbon 0,40 mm)','Type · size (e.g. fluorocarbon 0.40 mm)')],['hook',T('Αγκίστρια','Hooks'),T('Αγκίστρι','Hook'),T('Τύπος (π.χ. circle, assist)','Type (e.g. circle, assist)')],['lure',T('Ζόκες / τεχνητά','Jigs / lures'),T('Ζόκα / τεχνητό','Jig / lure'),T('Σχήμα, φινίρισμα','Shape, finish')],['acc',T('Αξεσουάρ','Accessories'),T('Αξεσουάρ','Accessory'),T('π.χ. glow 6×8 mm','e.g. glow 6×8 mm')],
  ['gun',T('Ψαροντούφεκα','Spearguns'),T('Ψαροντούφεκο','Speargun'),T('Μήκος · τύπος (π.χ. 90 cm · λάστιχο)','Length · type (e.g. 90 cm · band)')],['shaft',T('Ακόντια','Shafts'),T('Ακόντιο','Shaft'),T('Διάμετρος · μήκος · μύτη','Diameter · length · tip')],['band',T('Λάστιχα','Bands'),T('Λάστιχο','Band'),T('Διάμετρος · μήκος (π.χ. 16 mm · 60 cm)','Diameter · length (e.g. 16 mm · 60 cm)')],['float',T('Σημαδούρες','Floats'),T('Σημαδούρα','Float'),T('Τύπος · πετονιά (π.χ. torpedo · 20 m)','Type · line (e.g. torpedo · 20 m)')],['fins',T('Βατραχοπέδιλα','Fins'),T('Βατραχοπέδιλα','Fins'),T('Υλικό · μέγεθος','Material · size')],['mask',T('Μάσκες','Masks'),T('Μάσκα','Mask'),T('Τύπος (π.χ. χαμηλού όγκου)','Type (e.g. low volume)')],['suit',T('Στολές','Wetsuits'),T('Στολή','Wetsuit'),T('Πάχος · μέγεθος (π.χ. 5 mm · M)','Thickness · size (e.g. 5 mm · M)')],['weights',T('Βάρη','Weights'),T('Βάρη','Weights'),T('Σύνολο kg','Total kg')],['knife',T('Μαχαίρια','Knives'),T('Μαχαίρι','Knife'),T('Τύπος · τοποθέτηση','Type · mounting')],['watch',T('Ρολόγια','Watches'),T('Ρολόι','Watch'),T('Μοντέλο (π.χ. Garmin Descent)','Model (e.g. Garmin Descent)')],['set',T('Σετ','Sets'),T('Σετ','Set'),''],['other',T('Άλλα','Other'),T('Άλλο','Other'),T('Περιγραφή','Description')]];
function tyN(k,one){ for(var i=0;i<TY.length;i++) if(TY[i][0]===k) return TY[i][one?2:1]; return k; }
function tyPh(k){ for(var i=0;i<TY.length;i++) if(TY[i][0]===k) return TY[i][3]; return ''; }
var TKI={rod:'<path d="M3 21L19 5"/><path d="M19 5c1.5 0 2.5 1 2.5 2.5V11"/><circle cx="21.5" cy="13" r="1.3"/>',reel:'<circle cx="11" cy="12" r="6.5"/><circle cx="11" cy="12" r="2"/><path d="M17.5 12H21M11 5.5V3"/>',line:'<path d="M5 4c7 0 7 8 0 8s-2 8 8 8M16 4h3v4"/>',leader:'<path d="M3 8c4-4 6 4 9 0s5-4 9 0M3 16c4-4 6 4 9 0s5-4 9 0"/>',hook:'<path d="M12 3v11a4 4 0 01-8 0M4 14l-1.5-2.5M12 3a1.8 1.8 0 100 .01"/>',lure:'<path d="M2.5 12c2.8-4.2 7-5.5 11-3.2L19 6v12l-5.5-2.8c-4 2.3-8.2 1-11-3.2z"/><circle cx="8" cy="11" r=".7" fill="currentColor"/>',acc:'<path d="M12 3l8 9-8 9-8-9z"/>',set:'<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M9 8V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V8M3 13h18"/>',other:'<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9"/>'};
function tkIco(t){ return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(TKI[t]||TKI.other)+'</svg>'; }
var SPEARTY=['gun','shaft','band','float','fins','mask','suit','weights','knife','watch'];
var KINDS=[['jig',T('Μεταλλική ζόκα (jig)','Metal jig')],['slow',T('Slow pitch jig','Slow pitch jig')],['micro',T('Casting / micro jig','Casting / micro jig')],['minnow',T('Minnow','Minnow')],['popper',T('Popper (επιφάνειας)','Popper (surface)')],['pencil',T('Stickbait / pencil','Stickbait / pencil')],['crank',T('Crankbait / diving','Crankbait / diving')],['jerk',T('Jerkbait','Jerkbait')],['soft',T('Σιλικόνη (soft plastic)','Soft plastic')],['head',T('Jig head (κεφαλή)','Jig head')],['spoon',T('Κουτάλι (spoon)','Spoon')],['egi',T('Καλαμαριέρα (egi)','Squid jig (egi)')],['tai',T('Tai rubber / tenya','Tai rubber / tenya')],['inch',T('Inchiku','Inchiku')],['troll',T('Πλάνο / συρτής','Trolling lure')],['spin',T('Spinner / spinnerbait','Spinner / spinnerbait')],['vib',T('Vibration / blade','Vibration / blade')],['sabiki',T('Σαβίκι','Sabiki')],['other',T('Άλλο','Other')]];
var ACCK=[['swivel',T('Στριφτάρι (swivel)','Swivel')],['snap',T('Κλιπ / snap','Snap / clip')],['ring',T('Split ring / solid ring','Split / solid ring')],['sinker',T('Βαρίδι','Sinker')],['beads',T('Glow beads / χάντρες','Glow beads')],['led',T('Φωτάκι / λάμπα LED','LED light / lamp')],['rig',T('Έτοιμο rig / σύνδεσμος','Ready rig / connector')],['other',T('Άλλο','Other')]];
var TECH=[['slow',T('Slow pitch jigging','Slow pitch jigging'),['slow']],['jig',T('Jigging (μεταλλικές ζόκες)','Jigging (metal jigs)'),['jig','slow','inch','micro']],['cast',T('Casting / spinning','Casting / spinning'),['jig','micro','minnow','popper','pencil','crank','jerk','soft','head','spoon','spin','vib']],['pop',T('Popping / επιφάνεια','Popping / surface'),['popper','pencil']],['egi',T('Καλαμαριά (eging)','Squid (eging)'),['egi']],['bottom',T('Βυθός / tai rubber','Bottom / tai rubber'),['tai','inch','sabiki','soft','head']],['troll',T('Συρτή (trolling)','Trolling'),['troll','minnow','crank']],['any',T('Γενικό','General'),[]]];

var kname=function(k){ if(k&&k.indexOf('c:')===0) return k.slice(2); for(var i=0;i<KINDS.length;i++) if(KINDS[i][0]===k) return KINDS[i][1]; for(var j=0;j<ACCK.length;j++) if(ACCK[j][0]===k) return ACCK[j][1]; return ''; };
var tech=function(k){ for(var i=0;i<TECH.length;i++) if(TECH[i][0]===k) return TECH[i]; return null; };
function items(){ return S().raw('tackle').filter(function(x){ return !x.deleted; }); }
function byId(){ var m={}; items().forEach(function(x){ m[x.id]=x; }); return m; }
function bites(){ return S().raw('bites').filter(function(b){ return !b.deleted; }); }
function bc(b){ return Math.max(1,Math.floor(+b.cnt)||1); }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function days(a,b){ return Math.round((Date.parse(b)-Date.parse(a))/86400000); }
function put(o){ S().save('tackle',o); }
function load(src){ return new Promise(function(res){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
var libP=null; function lib(){ return libP||(libP=Promise.all([window.TACKLE_LIB?0:load('../tackle-lib.js'),window.TACKLE_GUIDE?0:load('../tackle-guide.js')])); }

/* ---------- μονάδες (αποθήκευση πάντα σε g / kg / m) ---------- */
var num=function(s){ var v=parseFloat(String(s).replace(',','.')); return isFinite(v)?v:null; };
function rng(s){ var m=String(s||'').replace(/[–—]/g,'-').match(/(\d+(?:[.,]\d+)?)\s*(?:-\s*(\d+(?:[.,]\d+)?))?/); if(!m) return null; var a=num(m[1]), b=m[2]!=null?num(m[2]):a; if(a==null||b==null) return null; return a<=b?[a,b]:[b,a]; }
function fr(r){ return r?(r[0]===r[1]?''+r[0]:r[0]+'–'+r[1]):''; }
function frd(r){ return r&&r[0]===0&&r[1]>0?T('έως ','max ')+r[1]:fr(r); }
function uget(){ var v=String(ls.get('psaro-tk-units','g|kg|m')||'').split('|'); return {w:v[0]==='oz'?'oz':'g',d:v[1]==='lb'?'lb':'kg',l:v[2]==='yd'?'yd':'m'}; }
function rnd(x,n){ var p=Math.pow(10,n); return Math.round(x*p)/p; }
function Wu(){ return uget().w; } function Du(){ return uget().d; } function Lu(){ return uget().l; }
function W(g){ g=+g; return Wu()==='oz'?rnd(g/28.3495,2):rnd(g,1); } function wIn(v){ return rnd(Wu()==='oz'?v*28.3495:v,1); }
function D(k){ k=+k; return Du()==='lb'?rnd(k*2.20462,1):rnd(k,1); } function dIn(v){ return rnd(Du()==='lb'?v/2.20462:v,2); }
function Lm(m){ m=+m; return Lu()==='yd'?Math.round(m*1.09361):Math.round(m); } function lIn(v){ return Math.round(Lu()==='yd'?v/1.09361:v); }
function wr(r){ return r?r.map(W):r; }
function pairs(s){ return String(s||'').split(/[,;]+/).map(function(x){ var m=x.replace(/[–—]/g,'-').match(/(\d+(?:[.,]\d+)?)\s*[-/@x×]\s*(\d+(?:[.,]\d+)?)/i); return m?[num(m[1]),num(m[2])]:null; }).filter(function(p){ return p&&p[0]>0&&p[1]>0; }); }
function pairStr(p){ return (p||[]).map(function(x){ return x[0]+'-'+x[1]; }).join(', '); }
function lpe(it){ var m=((it.spec||'')+' '+(it.name||'')+' '+(it.brand||'')).match(/PE\s*(\d+(?:[.,]\d+)?)/i); return m?num(m[1]):null; }
/* έλεγχος καλάμι / μουλινέ / νήμα (ίδιος με την κλασική) */
function compat(rod,reel,line){ var w=[], n=0, p=line?lpe(line):null;
  if(rod&&rod.pe&&p!=null){ if(p<rod.pe[0]-0.001||p>rod.pe[1]+0.001) w.push(T('Το νήμα PE ','Line PE ')+p+T(' είναι εκτός ορίων του καλαμιού (PE ',' is outside the rod range (PE ')+frd(rod.pe)+')'); else n++; }
  if(reel&&reel.cap&&reel.cap.length&&p!=null&&line&&line.qty>0){ var hit=reel.cap.filter(function(c){ return Math.abs(c[0]-p)<0.01; })[0], est=!hit, cm=hit?hit[1]:Math.round(reel.cap[0][1]*reel.cap[0][0]/p);
    if(line.qty>cm*1.05) w.push(T('Στο μουλινέ χωράνε ','The reel holds ')+(est?'~':'')+Lm(cm)+' '+Lu()+' PE '+p+T(', το νήμα έχει ',', the line has ')+Lm(line.qty)+' '+Lu()); else n++; }
  return {w:w,ok:n}; }
B.tackleCompat=compat; B.tackleKind=function(k){ return kname(k)||k; }; B.tackleW=function(g){ return W(g)+' '+Wu(); };

/* ---------- υπενθυμίσεις ---------- */
var FISH_LIM={reel:50,leader:10,line:100};
function fishWith(id,since){ return bites().filter(function(b){ return (!since||(b.date||'')>=since)&&b.tk&&b.tk.indexOf(id)>=0; }).reduce(function(n,b){ return n+bc(b); },0); }
function trips(){ return S().raw('trips').filter(function(t){ return !t.deleted; }); }
function remind(){ var out={low:[],svc:[],nodate:[]}, td=today(), tr=trips();
  items().forEach(function(it){
    if((it.type==='hook'||it.type==='lure'||it.type==='acc')&&it.qty!=null&&it.qty<=2) out.low.push(it);
    if(it.type==='reel'){ if(it.svc){ var sd=days(it.svc,td), fz=fishWith(it.id,it.svc); if(sd>90||fz>=FISH_LIM.reel) out.svc.push({it:it,txt:T('Συντηρήθηκε πριν ','Serviced ')+sd+T(' ημέρες',' days ago')+(fz?' · '+fz+T(' ψάρια από τότε',' fish since'):''),act:'svc'}); } else out.nodate.push(it); }
    if((it.type==='line'||it.type==='leader')&&it.since){ var nd=days(it.since,td), nt=tr.filter(function(x){ return (x.date||'')>=it.since; }).length, f2=fishWith(it.id,it.since), old=it.type==='leader'?(nd>60||nt>15||f2>=FISH_LIM.leader):(nd>180||f2>=FISH_LIM.line);
      if(old) out.svc.push({it:it,txt:T('Από την αλλαγή: ','Since change: ')+nd+T(' ημέρες · ',' days · ')+nt+T(' έξοδοι',' trips')+(f2?' · '+f2+T(' ψάρια',' fish'):''),act:'chg'}); } });
  return out; }
function remCount(){ try{ var r=remind(); return r.low.length+r.svc.length; }catch(e){ return 0; } }
B.tackleRemCount=remCount;
var SHOPK='psaro-tk-shop';
function shop(){ var a=ls.get(SHOPK,[]); return Array.isArray(a)?a.filter(function(x){ return x&&typeof x.t==='string'; }):[]; }
function shopSave(a){ ls.set(SHOPK,a.slice(0,200)); }

/* ---------- φωτογραφίες ---------- */
var urls={};
function thumb(id){ var k='tk-'+id; if(urls[k]) return Promise.resolve(urls[k]); return S().Photos.get(k).then(function(bl){ if(!bl) return null; urls[k]=URL.createObjectURL(bl); return urls[k]; }).catch(function(){ return null; }); }

/* ---------- λίστα ---------- */
function meta(it,mem){ var m=[]; if(it.brand) m.push(it.brand); if(it.spec) m.push(it.spec); if(it.qty!=null&&it.type!=='set') m.push((it.type==='line'||it.type==='leader')?Lm(it.qty)+' '+Lu():'×'+it.qty);
  if(it.type==='rod'){ if(it.lw) m.push(frd(wr(it.lw))+' '+Wu()); if(it.pe) m.push('PE '+frd(it.pe)); if(it.tech&&tech(it.tech)) m.push(tech(it.tech)[1]); }
  if(it.type==='reel'){ if(it.hand) m.push(it.hand==='L'?T('Αριστερό χέρι','Left-hand'):T('Δεξί χέρι','Right-hand')); if(it.drag) m.push('drag '+D(it.drag)+' '+Du()); if(it.cap&&it.cap.length) m.push(it.cap.map(function(c){ return 'PE '+c[0]+' – '+Lm(c[1])+' '+Lu(); }).join(' · ')); }
  if(it.w&&it.w.length) m.push(it.w.map(W).join('/')+' '+Wu()); if(it.kind) m.push(kname(it.kind)); if(it.color) m.push(it.color); if(it.sz&&it.sz.length) m.push(it.sz.join(', ')); if(it.cord) m.push(it.cord);
  if(it.water==='sea') m.push(T('θάλασσα','sea')); else if(it.water==='fresh') m.push(T('γλυκό νερό','fresh water'));
  if(it.type==='set') m.unshift(mem.length?mem.map(function(x){ return x.name||'—'; }).join(' + '):T('Κανένα στοιχείο','No items'));
  return m.join(' · '); }
function setMem(it,m){ return (it.members||[]).map(function(i){ return m[i]; }).filter(Boolean); }
function catches(it,mem){ var f=0,kg=0; bites().forEach(function(b){ if(b.miss||!b.tk) return; var hit=it.type==='set'?(mem.length&&mem.every(function(x){ return b.tk.indexOf(x.id)>=0; })):b.tk.indexOf(it.id)>=0; if(hit){ f+=bc(b); kg+=b.rel?0:(+b.kg||0); } }); return {f:f,kg:kg}; }
function draw(){
  if(!root) return;
  var page=h('div',{class:'page'}), all=items(), m=byId(), rc=remCount();
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω στο Προφίλ','Back to Profile'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Εξοπλισμός','Tackle')})),
    h('button',{class:'iconbtn',type:'button','aria-label':T('Νέο κομμάτι','New item'),html:B.iconSvg('plus'),onclick:function(){ form(null); }})));
  if(all.length) page.append(h('div',{class:'tktools'},
    h('button',{type:'button',class:'tkt',onclick:advisor},h('b',{text:T('Τι να χρησιμοποιήσω;','What should I use?')}),h('small',{text:T('Πρόταση για ένα ψάρι','Suggestion for a fish')})),
    h('button',{type:'button',class:'tkt'+(rc?' warn':''),onclick:listSheet},h('b',{text:T('Υπενθυμίσεις','Reminders')+(rc?' · '+rc:'')}),h('small',{text:T('Αλλαγή, συντήρηση, αγορές','Change, service, shopping')})),
    h('button',{type:'button',class:'tkt',onclick:moreSheet},h('b',{text:T('Μονάδες, αρχείο','Units, file')}),h('small',{text:Wu()+' · '+Du()+' · '+Lu()}))));
  var used={}; all.forEach(function(x){ used[x.type]=1; });
  var TYO=TY.filter(function(t){ return t[0]==='set'; }).concat(TY.filter(function(t){ return t[0]!=='set'; }));
  var chips=h('div',{class:'chips tkf'}); [['all',T('Όλα','All')]].concat(TYO.filter(function(t){ return used[t[0]]; }).map(function(t){ return [t[0],t[1]]; })).forEach(function(c){ var n=c[0]==='all'?all.length:all.filter(function(x){ return x.type===c[0]; }).length; chips.append(h('button',{type:'button',class:'chip','aria-pressed':String(fType===c[0]),text:c[1]+' '+n,onclick:function(){ var sx=chips.scrollLeft, y=window.scrollY; fType=c[0]; draw(); var nc=root&&root.querySelector('.chips.tkf'); if(nc) nc.scrollLeft=sx; try{ window.scrollTo(0,Math.min(y,(nc?nc.offsetTop-10:0))); }catch(e){} }})); });
  var qi=h('input',{type:'search',value:q,placeholder:T('Αναζήτηση','Search'),'aria-label':T('Αναζήτηση εξοπλισμού','Search tackle')}), box=h('div');
  qi.addEventListener('input',function(){ q=qi.value; fill(); });
  if(all.length) page.append(chips,h('div',{class:'search'},B.icon('search'),qi)); page.append(box);
  function fill(){
    var ql=q.toLowerCase(), a=all.filter(function(x){ return (fType==='all'||x.type===fType)&&(!ql||[x.name,x.brand,x.spec,x.notes,x.color].join(' ').toLowerCase().indexOf(ql)>=0); });
    if(!all.length){ box.replaceChildren(h('div',{class:'card empty'},h('h3',{text:T('Δεν έχεις καταχωρίσει εξοπλισμό','No tackle yet')}),h('p',{text:T('Πρόσθεσε καλάμια, μουλινέ, τεχνητά ή ψαροντούφεκα. Μετά τα διαλέγεις σε κάθε ψάρι και βλέπεις τι πιάνει.','Add rods, reels, lures or spearguns. Then pick them on each catch and see what works.')}),h('button',{class:'btn pri',type:'button',text:T('Νέο κομμάτι','New item'),onclick:function(){ form(null); }}))); return; }
    var groups={}; a.forEach(function(x){ (groups[x.type||'other']=groups[x.type||'other']||[]).push(x); });
    var out=[]; TYO.forEach(function(t){ var g=groups[t[0]]; if(!g) return; out.push(h('h3',{class:'listh',text:t[1]+' ('+g.length+')'}));
      var l=h('div',{class:'list'}); g.sort(function(x,y){ return String(x.name).localeCompare(String(y.name)); }).forEach(function(x){ var mem=x.type==='set'?setMem(x,m):[], c=catches(x,mem), warn='';
        if(x.type==='set'){ var bt={}; mem.forEach(function(y){ if(!bt[y.type]) bt[y.type]=y; }); var cp=compat(bt.rod,bt.reel,bt.line); if(cp.w.length) warn='⚠ '+cp.w[0]; else if(cp.ok) warn='✔ '+T('Καλάμι, μουλινέ και νήμα ταιριάζουν','Rod, reel and line match'); }
        if(x.qty!=null&&x.qty<=2&&(x.type==='hook'||x.type==='lure')) warn='⚠ '+T('Σου τελειώνουν','Running low');
        var ic=h('span',{class:'tkth',html:tkIco(x.type)}); if(x.photo) thumb(x.id).then(function(u){ if(u){ ic.style.backgroundImage='url('+u+')'; ic.innerHTML=''; } });
        var row=h('button',{class:'li',type:'button',onclick:function(){ form(x); }},ic,h('span',{class:'tx'},h('b',{text:x.name||''}),h('small',{text:meta(x,mem)||' '}),warn?h('small',{class:warn.charAt(0)==='⚠'?'tkw bad':'tkw ok',text:warn}):null),c.f?h('span',{class:'when',text:c.f+' '+T('ψάρια','catches')}):null,B.icon('chev')); l.append(B.swipeDel(row,function(){ S().delUndo('tackle',x,T('Διαγράφηκε: ','Deleted: ')+(x.name||'')); })); });
      out.push(l); });
    if(!out.length) out.push(h('p',{class:'sub',style:{margin:'12px 4px'},text:T('Δεν βρέθηκε κάτι.','Nothing found.')}));
    box.replaceChildren.apply(box,out);
  }
  fill(); root.replaceChildren(page);
}

/* ---------- φόρμα ---------- */
function fld(label,inp,hint){ return h('label',{class:'fld'},h('span',{text:label}),inp,hint?h('small',{text:hint}):null); }
function sel(opts,v){ var s=h('select',{class:'select'}); opts.forEach(function(o){ s.append(h('option',{value:o[0],text:o[1]})); }); s.value=v||''; return s; }
function form(it){
  var e=it||null, m=byId(), td=today();
  var ty=sel(TY.map(function(t){ return [t[0],t[2]]; }),e?e.type||'other':(fType!=='all'?fType:(B.prof()==='spear'?'gun':'rod')));
  var inp=function(v,ph,type){ return h('input',{type:type||'text',maxlength:'120',value:v==null?'':String(v),placeholder:ph||''}); };
  var nm=inp(e&&e.name,T('π.χ. Shimano Vanquish 4000','e.g. Shimano Vanquish 4000')), br=inp(e&&e.brand), sp=inp(e&&e.spec), nt=inp(e&&e.notes);
  var qt=inp(e&&e.qty!=null?((e.type==='line'||e.type==='leader')?Lm(e.qty):e.qty):'','', 'number'); qt.min='0'; qt.inputMode='numeric';
  var wt=inp(e&&e.w?e.w.map(W).join(', '):'','20, 30, 40, 60'), co=inp(e&&e.color,T('π.χ. ροζ, μπλε/ασημί','e.g. pink, blue/silver')), hs=inp(e&&e.sz?e.sz.join(', '):'','1/0, 2/0, 4/0'), hc=inp(e&&e.cord,T('π.χ. PE 3 · 4 cm','e.g. PE 3 · 4 cm'));
  var sn=inp(e&&e.since,'','date'), sv=inp(e&&e.svc,'','date');
  var kd=sel([['',T('— δεν ορίζω —','— not set —')]].concat(KINDS),e&&e.kind), ak=sel([['',T('— δεν ορίζω —','— not set —')]].concat(ACCK),e&&e.kind&&e.kind.indexOf('c:')!==0?e.kind:'');
  var rw=inp(e&&e.lw?fr(wr(e.lw)):'',T('π.χ. 150-250','e.g. 150-250')), rp=inp(e&&e.pe?fr(e.pe):'',T('π.χ. 2-3','e.g. 2-3')), rt=sel([['',T('— δεν ορίζω —','— not set —')]].concat(TECH.map(function(x){ return [x[0],x[1]]; })),e&&e.tech);
  var ha=sel([['',T('— δεν ορίζω —','— not set —')],['L',T('Αριστερό','Left-hand')],['R',T('Δεξί','Right-hand')]],e&&e.hand), dr=inp(e&&e.drag!=null?D(e.drag):'',T('π.χ. 10','e.g. 10')), cp=inp(e&&e.cap?pairStr(e.cap.map(function(c){ return [c[0],Lm(c[1])]; })):'',T('π.χ. 3-400, 4-300, 5-220','e.g. 3-400, 4-300, 5-220'));
  [rw,rp,dr,wt].forEach(function(x){ x.inputMode='decimal'; });
  var wa=sel([['',T('Θάλασσα και γλυκό νερό','Sea and fresh water')],['sea',T('Μόνο θάλασσα','Sea only')],['fresh',T('Μόνο γλυκό νερό (λίμνη)','Fresh water only (lake)')]],e&&e.water);
  var i0={dr:dr.value,cp:cp.value,rw:rw.value,wt:wt.value,qt:qt.value};
  /* σετ */
  var mem={}, memBox=h('div',{class:'bform'}), memObj=e?setMem(e,m):[];
  [['rod',T('Καλάμι','Rod')],['reel',T('Μουλινέ','Reel')],['line',T('Νήμα','Main line')],['leader',T('Πετονιά (leader)','Leader')]].forEach(function(t){
    var o=[['',t[0]==='rod'?T('— διάλεξε —','— choose —'):T('— κανένα —','— none —')]].concat(items().filter(function(x){ return x.type===t[0]; }).sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); }).map(function(x){ return [x.id,x.name||'—']; }));
    var cur=memObj.filter(function(x){ return x.type===t[0]; })[0]; mem[t[0]]=sel(o,cur?cur.id:''); memBox.append(fld(t[1],mem[t[0]])); mem[t[0]].addEventListener('change',chk); });
  var chkOut=h('p',{class:'sub'}); memBox.append(chkOut,h('small',{class:'sub',text:T('Το σετ παίρνει το όνομα του καλαμιού, αν δεν γράψεις άλλο. Πρόσθεσε πρώτα καλάμια, μουλινέδες και νήματα.','The set takes the rod name unless you type another. Add rods, reels and lines first.')}));
  function chk(){ var mm=byId(), cpx=compat(mm[mem.rod.value],mm[mem.reel.value],mm[mem.line.value]); chkOut.textContent=cpx.w.length?'⚠ '+cpx.w.join(' · '):cpx.ok?'✔ '+T('Καλάμι, μουλινέ και νήμα ταιριάζουν','Rod, reel and line match'):''; chkOut.className=cpx.w.length?'sub bad':'sub'; }
  /* φωτογραφία */
  var newBlob=null, rmPh=false, pv=h('img',{class:'tkimg',alt:'',hidden:true}), rmB=h('button',{type:'button',class:'btn sm',text:T('Αφαίρεση','Remove'),hidden:true,onclick:function(){ newBlob=null; rmPh=true; pv.hidden=true; rmB.hidden=true; }});
  function picker(label,cap){ var i=h('input',{type:'file',accept:'image/*',hidden:true}); if(cap) i.setAttribute('capture','environment');
    i.addEventListener('change',function(){ var f=i.files&&i.files[0]; if(!f) return; S().resize(f).then(function(bl){ newBlob=bl; rmPh=false; pv.src=URL.createObjectURL(bl); pv.hidden=false; rmB.hidden=false; }).catch(function(){ msg.textContent=T('Η φωτογραφία δεν διαβάστηκε.','Could not read the photo.'); }); i.value=''; });
    return h('label',{class:'btn sm'},label,i); }
  if(e&&e.photo) thumb(e.id).then(function(u){ if(u&&!newBlob){ pv.src=u; pv.hidden=false; rmB.hidden=false; } });
  var msg=h('p',{class:'sub',role:'status'}), err=h('p',{class:'err',role:'alert'});
  var dl=h('datalist',{id:'tkDL'}); nm.setAttribute('list','tkDL');
  function fillDL(){ dl.replaceChildren(); (window.TACKLE_LIB||[]).forEach(function(r){ if(r[0]===ty.value) dl.append(h('option',{value:(r[1]+' '+r[2]).trim()})); }); }
  lib().then(fillDL);
  nm.addEventListener('change',function(){ var v=nm.value.trim().toLowerCase(); (window.TACKLE_LIB||[]).some(function(r){ if(r[0]!==ty.value||(r[1]+' '+r[2]).trim().toLowerCase()!==v) return false; var d=r[3]||null; if(!br.value) br.value=(d&&d.model)||r[1];
    if(d){ var did=false, set=function(x,val){ if(val!=null&&val!==''&&!x.value){ x.value=val; did=true; } };
      set(sp,d.spec); if(r[0]==='line'||r[0]==='leader') set(qt,d.qty!=null?Lm(d.qty):null); if(r[0]==='acc') set(ak,d.kind); if(r[0]==='lure'){ set(kd,d.kind); if(d.w) set(wt,d.w.map(W).join(', ')); }
      if(r[0]==='hook'&&d.sz) set(hs,d.sz.join(', ')); if(r[0]==='rod'){ set(rw,fr(wr(d.lw))); set(rp,fr(d.pe)); set(rt,d.tech); } if(r[0]==='reel'){ set(ha,d.hand); set(dr,d.drag!=null?D(d.drag):null); set(cp,pairStr((d.cap||[]).map(function(c){ return [c[0],Lm(c[1])]; }))); }
      if(did) msg.textContent=T('Συμπληρώθηκαν τα στοιχεία του μοντέλου. Έλεγξέ τα πριν την αποθήκευση.','Model details filled in. Check them before saving.'); }
    return true; }); });
  var L={nm:fld(T('Όνομα','Name'),nm,T('Γράψε μάρκα και μοντέλο: θα σου προτείνει από τη βιβλιοθήκη.','Type brand and model: suggestions come from the library.')),br:fld(T('Μάρκα / μοντέλο','Brand / model'),br),sp:fld(T('Χαρακτηριστικά','Specs'),sp),
    rw:fld(T('Βάρος δολώματος καλαμιού (','Rod lure weight (')+Wu()+')',rw),rp:fld(T('PE καλαμιού','Rod PE rating'),rp),rt:fld(T('Τεχνική καλαμιού','Rod technique'),rt),
    ha:fld(T('Χέρι μουλινέ','Reel handle'),ha),dr:fld(T('Drag max (','Max drag (')+Du()+')',dr),cp:fld(T('Χωρητικότητα: PE-','Capacity: PE-')+(Lu()==='yd'?T('γιάρδες','yards'):T('μέτρα','metres')),cp),sv:fld(T('Τελευταία συντήρηση','Last service'),sv),
    qt:fld(T('Ποσότητα','Quantity'),qt),kd:fld(T('Είδος τεχνητού','Lure kind'),kd),ak:fld(T('Είδος αξεσουάρ','Accessory kind'),ak),wt:fld(T('Διαθέσιμα βάρη (','Available weights (')+Wu()+T('), με κόμμα','), comma separated'),wt),co:fld(T('Χρώμα','Colour'),co),
    hs:fld(T('Διαθέσιμα μεγέθη, με κόμμα','Available sizes, comma separated'),hs),hc:fld(T('Νήμα assist (προαιρετικό)','Assist cord (optional)'),hc),sn:fld(T('Τελευταία αλλαγή','Last changed'),sn),wa:fld(T('Νερό','Water'),wa),nt:fld(T('Σημειώσεις','Notes'),nt)};
  var phRow=h('div',{class:'fld'},h('span',{text:T('Φωτογραφία','Photo')}),pv,h('div',{class:'acts'},picker(T('Κάμερα','Camera'),true),picker(T('Συλλογή','Gallery'),false),rmB));
  function vis(){ var v=ty.value, s=v==='set', ln=v==='line'||v==='leader';
    L.br.hidden=L.sp.hidden=s; L.nm.querySelector('small').hidden=s||v==='set'; sp.placeholder=tyPh(v);
    L.qt.hidden=s; L.qt.firstChild.textContent=ln?(Lu()==='yd'?T('Γιάρδες (yd)','Yards (yd)'):T('Μέτρα (m)','Metres (m)')):T('Ποσότητα','Quantity');
    L.wt.hidden=L.co.hidden=L.kd.hidden=v!=='lure'; L.ak.hidden=v!=='acc'; L.hs.hidden=L.hc.hidden=v!=='hook'; L.sn.hidden=!ln; L.sv.hidden=L.ha.hidden=L.dr.hidden=L.cp.hidden=v!=='reel'; L.rw.hidden=L.rp.hidden=L.rt.hidden=v!=='rod';
    L.wa.hidden=s||SPEARTY.indexOf(v)>=0; memBox.hidden=!s; if(s) chk(); nm.placeholder=s?T('Όνομα σετ (προαιρετικό)','Set name (optional)'):T('π.χ. Shimano Vanquish 4000','e.g. Shimano Vanquish 4000'); }
  ty.addEventListener('change',function(){ vis(); fillDL(); }); 
  var quick=null; if(e){ var qa=[];
    if(e.type==='reel') qa.push(h('button',{class:'btn sm',type:'button',text:T('✔ Συντηρήθηκε σήμερα','✔ Serviced today'),onclick:function(){ put(Object.assign({},e,{svc:td})); sh.close(); draw(); B.toast(T('Καταγράφηκε.','Recorded.')); }}));
    if(e.type==='line'||e.type==='leader') qa.push(h('button',{class:'btn sm',type:'button',text:T('✔ Το άλλαξα σήμερα','✔ Changed today'),onclick:function(){ put(Object.assign({},e,{since:td})); sh.close(); draw(); B.toast(T('Καταγράφηκε.','Recorded.')); }}));
    if((e.type==='hook'||e.type==='lure')&&e.qty>0) qa.push(h('button',{class:'btn sm',type:'button',text:T('Χάθηκε ένα (−1)','Lost one (−1)'),onclick:function(){ put(Object.assign({},e,{qty:e.qty-1,lost:(e.lost||0)+1})); sh.close(); draw(); }}));
    var c=catches(e,setMem(e,m)), info=[]; if(c.f) info.push(T('Ψάρια με αυτό: ','Catches with it: ')+c.f+(c.kg?' · '+B.num(c.kg,1)+' kg':'')); if(e.lost) info.push(T('Χάθηκαν: ','Lost: ')+e.lost);
    if(e.since&&(e.type==='line'||e.type==='leader')) info.push(T('Από την αλλαγή: ','Since change: ')+days(e.since,td)+T(' ημέρες',' days')); if(e.svc&&e.type==='reel') info.push(T('Συντήρηση πριν ','Serviced ')+days(e.svc,td)+T(' ημέρες',' days ago'));
    if(qa.length||info.length) quick=h('div',{class:'card',style:{margin:'0'}},info.length?h('p',{class:'sub',style:{margin:'0 0 8px'},text:info.join(' · ')}):null,qa.length?h('div',{class:'acts'},qa):null); }
  var f=h('form',{class:'bform',novalidate:true},quick,fld(T('Είδος','Kind'),ty),L.nm,dl,memBox,L.br,L.sp,L.rw,L.rp,L.rt,L.ha,L.dr,L.cp,L.sv,L.qt,L.kd,L.ak,L.wt,L.co,L.hs,L.hc,L.sn,L.wa,L.nt,phRow,msg,err,
    h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση','Save')}),
    e?h('button',{class:'btn full del',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ B.ask(T('Να διαγραφεί «'+(e.name||'')+'»; Τα ψάρια μένουν.','Delete “'+(e.name||'')+'”? Catches stay.'),T('Διαγραφή','Delete'),true).then(function(y){ if(y){ S().remove('tackle',e.id); if(e.photo){ try{ S().Photos.del('tk-'+e.id); }catch(x){} } sh.close(); draw(); B.toast(T('Διαγράφηκε.','Deleted.')); } }); }}):null);
  vis();
  f.addEventListener('submit',function(ev){ ev.preventDefault(); var v=ty.value, isSet=v==='set', name=nm.value.trim(), mm=byId();
    if(isSet){ if(!mem.rod.value){ err.textContent=T('Διάλεξε καλάμι για το σετ.','Choose a rod for the set.'); return; } if(!name){ var r0=mm[mem.rod.value], r1=mm[mem.reel.value]; name=(r0&&r0.name||T('Σετ','Set'))+(r1?' + '+r1.name:''); } }
    else if(!name){ err.textContent=T('Γράψε όνομα.','Enter a name.'); nm.focus(); return; }
    var o={id:e?e.id:'tk'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),type:v,name:name.slice(0,120),brand:isSet?'':br.value.trim(),spec:isSet?'':sp.value.trim(),notes:nt.value.trim(),ts:(e&&e.ts)||Date.now()};
    var qn=parseInt(qt.value,10); if(!isSet&&qt.value!==''&&qn>=0) o.qty=(v==='line'||v==='leader')?((qt.value===i0.qt&&e&&e.qty!=null)?e.qty:lIn(qn)):qn;
    if(v==='lure'){ var ws=wt.value.split(/[,;\s]+/).map(function(x){ return wIn(parseFloat(x.replace(',','.'))); }).filter(function(x){ return x>0&&x<5000; }); ws=ws.filter(function(x,i){ return ws.indexOf(x)===i; }).sort(function(a,b){ return a-b; }); if(ws.length) o.w=(wt.value===i0.wt&&e&&e.w)?e.w:ws; if(co.value.trim()) o.color=co.value.trim(); if(kd.value) o.kind=kd.value; }
    if(v==='acc'){ if(ak.value) o.kind=ak.value; else if(e&&e.kind&&e.kind.indexOf('c:')===0) o.kind=e.kind; }
    if(v==='hook'){ var zs=hs.value.split(/[,;]+/).map(function(x){ return x.trim(); }).filter(Boolean); zs=zs.filter(function(x,i){ return zs.indexOf(x)===i; }); if(zs.length) o.sz=zs; if(hc.value.trim()) o.cord=hc.value.trim(); }
    if((v==='line'||v==='leader')&&sn.value) o.since=sn.value;
    if(v==='rod'){ var a1=rng(rw.value), a2=rng(rp.value); if(a1) o.lw=(rw.value===i0.rw&&e&&e.lw)?e.lw:a1.map(wIn); if(a2) o.pe=a2; if(rt.value) o.tech=rt.value; }
    if(v==='reel'){ if(ha.value) o.hand=ha.value; var dv=num(dr.value); if(dv>0) o.drag=(dr.value===i0.dr&&e&&e.drag)?e.drag:dIn(dv); var cc=pairs(cp.value).map(function(c){ return [c[0],lIn(c[1])]; }); if(cc.length) o.cap=(cp.value===i0.cp&&e&&e.cap)?e.cap:cc; if(sv.value) o.svc=sv.value; }
    if(wa.value&&!isSet&&SPEARTY.indexOf(v)<0) o.water=wa.value;
    if(e&&e.lost) o.lost=e.lost; if(isSet) o.members=['rod','reel','line','leader'].map(function(k){ return mem[k].value; }).filter(Boolean);
    var ph=Promise.resolve(); if(newBlob){ o.photo=true; ph=S().Photos.put('tk-'+o.id,newBlob).then(function(){ urls['tk-'+o.id]=null; }); } else if(rmPh){ ph=S().Photos.del('tk-'+o.id).catch(function(){}); } else if(e&&e.photo) o.photo=true;
    ph.catch(function(){}).then(function(){ put(o); sh.close(); draw(); B.toast(T('Αποθηκεύτηκε.','Saved.')); }); });
  var sh=B.sheet({title:e?T('Επεξεργασία','Edit'):T('Νέο κομμάτι','New item'),body:f,focus:e?null:'input'});
}

/* ---------- «Τι να χρησιμοποιήσω για…» ---------- */
function findSp(q){ q=(q||'').trim().toLowerCase(); if(!q) return null; var db=window.SPECIES_DB||[], r=null;
  db.some(function(d){ if((d[0]&&d[0].toLowerCase()===q)||(d[1]&&d[1].toLowerCase()===q)||(d[2]&&d[2].toLowerCase()===q)){ r=d; return true; } return false; });
  if(!r) db.some(function(d){ if((d[0]&&d[0].toLowerCase().indexOf(q)>=0)||(d[1]&&d[1].toLowerCase().indexOf(q)>=0)){ r=d; return true; } return false; }); return r; }
function advise(qs,out){
  out.replaceChildren(); var sp=findSp(qs); if(!sp){ out.append(h('p',{class:'sub',text:T('Δεν βρήκα αυτό το ψάρι. Δοκίμασε το όνομα όπως στη λίστα.','Fish not found. Try the name as in the list.')})); return; }
  var lat=sp[2], G=(window.TACKLE_GUIDE||{})[lat], inv=items(), info=byId(), sec=function(t,lines,note){ var c=h('div',{class:'card advc'},h('h3',{class:'h3',style:{marginTop:'0'},text:t})); lines.forEach(function(l){ c.append(h('div',{class:'lyrow'},h('span',{text:l}))); }); if(note) c.append(h('p',{class:'sub',style:{margin:'6px 0 0'},text:note})); out.append(c); };
  out.append(h('h3',{class:'h3',text:(EN?(sp[1]||sp[0]):(sp[0]||sp[1]))+' · '+lat}));
  var bs=bites().filter(function(b){ return !b.miss&&(b.latin===lat||(b.species&&((sp[0]&&b.species.toLowerCase()===sp[0].toLowerCase())||(sp[1]&&b.species.toLowerCase()===sp[1].toLowerCase())))); });
  var term={}, setup={}, n=0;
  bs.forEach(function(b){ if(!b.tk||!b.tk.length) return; n++; var c=bc(b);
    b.tk.forEach(function(id){ var x=info[id]; if(!x) return;
      if(x.type==='lure'){ var g=b.tkw&&b.tkw[id], hk=b.tkh&&b.tkh[id]&&info[b.tkh[id]], k=x.name+(g?' '+W(g)+' '+Wu():'')+(hk?' + '+hk.name+(b.tks&&b.tks[b.tkh[id]]?' '+b.tks[b.tkh[id]]:''):''); term[k]=(term[k]||0)+c; }
      else if(x.type==='rod'||x.type==='reel'){ var k2=tyN(x.type,true)+': '+x.name; setup[k2]=(setup[k2]||0)+c; } }); });
  var top=function(o){ return Object.keys(o).sort(function(a,b){ return o[b]-o[a]; }).slice(0,3); };
  if(n) sec(T('Από τα δικά σου ψάρια (','From your own catches (')+n+')',top(term).map(function(k){ return k+' · '+term[k]; }).concat(top(setup).map(function(k){ return k+' · '+setup[k]; })));
  else sec(T('Από τα δικά σου ψάρια','From your own catches'),[],T('Δεν έχεις ακόμα ψάρια αυτού του είδους με καταγεγραμμένο εξοπλισμό.','No catches of this fish with recorded tackle yet.'));
  if(G){ var cd=window.PsaroCore&&PsaroCore.getCond&&PsaroCore.getCond(), wave=cd&&cd.wave!=null?+cd.wave:null;
    var lures=inv.filter(function(x){ return x.type==='lure'&&x.kind&&G.k.indexOf(x.kind)>=0; }).sort(function(a,b){ return G.k.indexOf(a.kind)-G.k.indexOf(b.kind); });
    if(lures.length) sec(T('Από τον εξοπλισμό σου','From your tackle'),lures.map(function(x){ var ws=(x.w||[]).map(function(g){ return (G.w[1]>0&&g>=G.w[0]&&g<=G.w[1])?'✔'+W(g):''+W(g); }).join('/'); return x.name+' · '+kname(x.kind)+(ws?' · '+ws+' '+Wu():'')+((x.kind==='popper'||x.kind==='pencil')&&wave!=null&&wave>=0.8?T(' · μεγάλο κύμα σήμερα',' · rough sea today'):''); }));
    else sec(T('Από τον εξοπλισμό σου','From your tackle'),[],T('Δεν έχεις τεχνητό αυτού του είδους. Συνήθως: ','No lure of these kinds yet. Usually: ')+G.k.slice(0,4).map(kname).join(', ')+'.');
    sec(T('Γενικά για αυτό το ψάρι','In general'),[],G.r+(G.w[1]>0?T(' Συνηθισμένο βάρος τεχνητού: ',' Typical lure weight: ')+W(G.w[0])+'–'+W(G.w[1])+' '+Wu()+T(' (✔ στη λίστα).',' (✔ in the list).'):''));
  } else out.append(h('p',{class:'sub',text:T('Δεν υπάρχει γενικός οδηγός για αυτό το είδος, δείχνω μόνο το ιστορικό σου.','No general guide for this species; showing only your history.')}));
  out.append(h('p',{class:'foot',text:T('Ενδεικτικά: γενικές πρακτικές και τα δικά σου δεδομένα, όχι εγγύηση.','Indicative: general practice plus your data, not a guarantee.')}));
}
B.tackleAdvise=advise;
var advQ='';
function advisor(){ var qi=h('input',{type:'search',list:'tkSpDL',maxlength:'40',value:advQ,placeholder:T('π.χ. Παλαμίδα','e.g. Bonito'),enterkeyhint:'search'}), dl=h('datalist',{id:'tkSpDL'}), out=h('div');
  (window.SPECIES_DB||[]).forEach(function(r){ var n=EN?(r[1]||r[0]):(r[0]||r[1]); if(n) dl.append(h('option',{value:n})); });
  var run=function(){ advQ=qi.value; if(qi.value.trim().length>=2) lib().then(function(){ advise(qi.value,out); }); };
  qi.addEventListener('change',run); qi.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); run(); } });
  B.sheet({title:T('Τι να χρησιμοποιήσω για…','What should I use for…'),body:h('div',{class:'bform'},h('div',{class:'search'},B.icon('search'),qi),dl,h('button',{class:'btn pri full',type:'button',text:T('Πρότεινε','Suggest'),onclick:run}),out),focus:advQ?null:'input'});
  if(advQ) run(); }

/* ---------- υπενθυμίσεις και λίστα αγορών ---------- */
function listSheet(){ var body=h('div',{class:'bform'}), sh;
  function row(txt,sub,btn){ return h('div',{class:'lyrow tkrow'},h('span',null,h('b',{text:txt}),sub?h('small',{text:sub}):null),btn||null); }
  function paint(){ var R=remind(), td=today(); body.replaceChildren();
    var c1=h('section',{class:'card',style:{margin:'0'}},h('h3',{class:'h3',style:{marginTop:'0'},text:T('Σου τελειώνουν','Running low')}));
    if(!R.low.length) c1.append(h('p',{class:'sub',text:T('Τίποτα (δείχνει όσα έχουν ποσότητα 2 ή λιγότερο).','Nothing (shows items with quantity 2 or less).')}));
    R.low.forEach(function(it){ c1.append(row(it.name||'—',tyN(it.type,true)+' · ×'+it.qty)); });
    if(R.low.length) c1.append(h('button',{class:'btn sm',type:'button',text:T('+ Στη λίστα αγορών','+ Add to shopping list'),onclick:function(){ var a=shop(); R.low.forEach(function(it){ var t=(it.name||'—')+(it.brand?' ('+it.brand+')':''); if(!a.some(function(x){ return x.t===t; })) a.push({t:t,d:false}); }); shopSave(a); paint(); }}));
    var c2=h('section',{class:'card',style:{margin:'0'}},h('h3',{class:'h3',style:{marginTop:'0'},text:T('Συντήρηση και αλλαγή','Service and change')}));
    if(!R.svc.length) c2.append(h('p',{class:'sub',text:T('Όλα εντάξει με βάση τις ημερομηνίες που έχεις βάλει.','All fine based on the dates you entered.')}));
    R.svc.forEach(function(o){ var it=o.it; c2.append(row(it.name||'—',o.txt,h('button',{class:'btn sm',type:'button',text:o.act==='svc'?T('✔ Συντηρήθηκε','✔ Serviced'):T('✔ Άλλαξα','✔ Changed'),onclick:function(){ var x=Object.assign({},it); if(o.act==='svc') x.svc=td; else x.since=td; put(x); paint(); draw(); }}))); });
    if(R.nodate.length) c2.append(h('p',{class:'sub',text:T('Χωρίς ημερομηνία συντήρησης: ','No service date: ')+R.nodate.map(function(x){ return x.name||'—'; }).join(', ')}));
    c2.append(h('p',{class:'foot',text:T('Ενδεικτικά όρια: μουλινέ 90 ημέρες ή 50 ψάρια · leader 60 ημέρες, 15 έξοδοι ή 10 ψάρια · νήμα 180 ημέρες ή 100 ψάρια.','Rough limits: reel 90 days or 50 fish · leader 60 days, 15 trips or 10 fish · main line 180 days or 100 fish.')}));
    var c3=h('section',{class:'card',style:{margin:'0'}},h('h3',{class:'h3',style:{marginTop:'0'},text:T('Λίστα αγορών','Shopping list')})), a=shop();
    var ni=h('input',{type:'text',maxlength:'80',placeholder:T('π.χ. αγκίστρια 4/0','e.g. 4/0 hooks'),enterkeyhint:'done'}), add=function(){ var t=ni.value.trim(); if(!t) return; var l=shop(); l.push({t:t,d:false}); shopSave(l); paint(); };
    ni.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); add(); } });
    c3.append(h('div',{class:'row',style:{display:'flex',gap:'8px'}},ni,h('button',{class:'btn sm pri',type:'button',text:T('Πρόσθεσε','Add'),onclick:add})));
    if(!a.length) c3.append(h('p',{class:'sub',text:T('Η λίστα είναι άδεια.','The list is empty.')}));
    a.forEach(function(x,i){ var cb=h('input',{type:'checkbox',checked:!!x.d}); cb.addEventListener('change',function(){ var l=shop(); if(l[i]){ l[i].d=cb.checked; shopSave(l); paint(); } });
      c3.append(h('div',{class:'lyrow tkrow'},h('label',{class:'tg',style:{flex:'1',margin:'0'}},cb,h('span',{text:x.t,style:x.d?{textDecoration:'line-through',opacity:'.6'}:null})),h('button',{class:'iconbtn sm',type:'button','aria-label':T('Διαγραφή','Delete'),text:'✕',onclick:function(){ var l=shop(); l.splice(i,1); shopSave(l); paint(); }}))); });
    if(a.some(function(x){ return x.d; })) c3.append(h('button',{class:'btn sm',type:'button',text:T('Καθάρισε τα αγορασμένα','Clear bought items'),onclick:function(){ shopSave(shop().filter(function(x){ return !x.d; })); paint(); }}));
    body.append(c1,c2,c3); }
  paint(); sh=B.sheet({title:T('Υπενθυμίσεις και λίστα','Reminders and list'),body:body,onclose:draw}); }

/* ---------- μονάδες και αρχείο εξοπλισμού ---------- */
function moreSheet(){ var body=h('div',{class:'bform'}), msg=h('p',{class:'sub',role:'status'});
  function seg(label,key,opts){ var U=uget(), s=h('div',{class:'seg'}); opts.forEach(function(o){ s.append(h('button',{type:'button','aria-pressed':String(U[key]===o[0]),text:o[1],onclick:function(){ var u=uget(); u[key]=o[0]; ls.set('psaro-tk-units',u.w+'|'+u.d+'|'+u.l); paint(); draw(); }})); }); return h('div',{class:'fld'},h('span',{text:label}),s); }
  function paint(){ body.replaceChildren(
    h('h3',{class:'h3',style:{marginTop:'0'},text:T('Μονάδες μέτρησης','Units')}),
    seg(T('Βάρος (ζόκες, όρια καλαμιού)','Weight (lures, rod ratings)'),'w',[['g','g'],['oz','oz']]),seg(T('Drag μουλινέ','Reel drag'),'d',[['kg','kg'],['lb','lb']]),seg(T('Μήκος νήματος','Line length'),'l',[['m','m'],['yd','yd']]),
    h('p',{class:'foot',text:T('Τα δεδομένα αποθηκεύονται πάντα σε g, kg και m, οπότε μπορείς να αλλάζεις όποτε θες.','Data is always stored in g, kg and m, so you can switch any time.')}),
    h('h3',{class:'h3',text:T('Αρχείο εξοπλισμού','Tackle file')}),
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Αποθήκευση σε αρχείο','Save to file'),onclick:exp}),h('label',{class:'btn'},T('Επαναφορά από αρχείο','Restore from file'),imp)),msg,
    h('p',{class:'foot',text:T('Ο εξοπλισμός είναι και στο γενικό αντίγραφο ασφαλείας και συγχρονίζεται στον λογαριασμό σου.','Tackle is also in the full backup and syncs to your account.')})); }
  function exp(){ var it=items(), photos={}, p=Promise.resolve();
    it.forEach(function(t){ if(t.photo) p=p.then(function(){ return S().Photos.get('tk-'+t.id).then(function(bl){ if(bl) return b2u(bl).then(function(u){ photos['tk-'+t.id]=u; }); }).catch(function(){}); }); });
    p.then(function(){ var a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify({app:'psarovarka',v:2,tackle:it,photos:photos})],{type:'application/json'})),download:'bitecast-tackle-'+today()+'.json'}); document.body.append(a); a.click(); a.remove(); msg.textContent=T('Αποθηκεύτηκαν ','Saved ')+it.length+T(' κομμάτια.',' items.'); }).catch(function(){ msg.textContent=T('Η εξαγωγή απέτυχε.','Export failed.'); }); }
  var imp=h('input',{type:'file',accept:'application/json,.json',hidden:true});
  imp.addEventListener('change',function(){ var f=imp.files&&imp.files[0]; if(!f) return; f.text().then(function(t){ var j=JSON.parse(t), arr=Array.isArray(j.tackle)?j.tackle:null; if(!arr) throw 0; var n=0, known={}; TY.forEach(function(x){ known[x[0]]=1; });
      arr.forEach(function(it){ if(it&&typeof it==='object'&&typeof it.id==='string'&&known[it.type]){ put(it); n++; } });
      var ph=j.photos&&typeof j.photos==='object'?j.photos:{}, p=Promise.resolve(); Object.keys(ph).forEach(function(k){ if(k.indexOf('tk-')===0&&typeof ph[k]==='string') p=p.then(function(){ return fetch(ph[k]).then(function(r){ return r.blob(); }).then(function(bb){ urls[k]=null; return S().Photos.put(k,bb); }).catch(function(){}); }); });
      return p.then(function(){ msg.textContent=n+T(' κομμάτια επαναφέρθηκαν.',' items restored.'); draw(); }); }).catch(function(){ msg.textContent=T('Το αρχείο δεν διαβάστηκε.','The file could not be read.'); }); imp.value=''; });
  paint(); B.sheet({title:T('Μονάδες και αρχείο','Units and file'),body:body}); }

B.view('tackle',{title:T('Εξοπλισμός','Tackle'),mount:function(el){ root=el; draw(); lib(); },unmount:function(){ root=null; },resume:function(){ draw(); }});

/* ---------- αντίγραφο ασφαλείας (ίδια μορφή αρχείου με την κλασική) ---------- */
function b2u(bl){ return new Promise(function(res){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.readAsDataURL(bl); }); }
B.backup={
  exportAll:function(){
    var bites=S().raw('bites'), photos={}, keys=[]; bites.forEach(function(b){ S().phKeys(b).forEach(function(k){ keys.push(k); }); }); S().raw('tackle').forEach(function(t){ if(t.photo) keys.push('tk-'+t.id); });
    var p=Promise.resolve(); keys.forEach(function(k){ p=p.then(function(){ return S().Photos.get(k).then(function(bl){ if(bl) return b2u(bl).then(function(u){ photos[k]=u; }); }).catch(function(){}); }); });
    return p.then(function(){ var g=ls.get('psaro-gear',null);
      var data={app:'psarovarka',v:2,spots:S().raw('spots'),trips:S().raw('trips'),bites:bites,tackle:S().raw('tackle'),gear:g&&g.items?g.items:[],boat:ls.get('psaro-boat',null),photos:photos};
      var d=new Date(), name='psarovarka-'+d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate())+'.json';
      var a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),download:name}); document.body.append(a); a.click(); a.remove();
      ls.set('psaro-lastbackup',Date.now()); return keys.length; });
  },
  importFile:function(file){
    return file.text().then(function(t){ var d=JSON.parse(t), n=0;
      ['spots','trips','bites','tackle'].forEach(function(k){ (Array.isArray(d[k])?d[k]:[]).forEach(function(it){ if(it&&typeof it==='object'){ S().save(k,it); n++; } }); });
      if(Array.isArray(d.gear)&&d.gear.length){ var g=ls.get('psaro-gear',{})||{}, ex={}; g.items=Array.isArray(g.items)?g.items:[]; g.items.forEach(function(x){ ex[x.id]=1; }); d.gear.forEach(function(x){ if(x&&x.id&&!ex[x.id]){ g.items.push(x); n++; } }); ls.set('psaro-gear',g); }
      if(d.boat&&typeof d.boat==='object'){ ls.set('psaro-boat',d.boat); n++; }
      var ph=d.photos&&typeof d.photos==='object'?d.photos:{}, p=Promise.resolve();
      Object.keys(ph).forEach(function(id){ p=p.then(function(){ return fetch(ph[id]).then(function(r){ return r.blob(); }).then(function(bl){ return S().Photos.put(id,bl); }).catch(function(){}); }); });
      return p.then(function(){ return n; }); });
  }
};
})();
