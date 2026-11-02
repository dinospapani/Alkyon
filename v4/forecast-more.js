/* Alkyon 4 · Πρόγνωση: «Τι ψαρεύω» και «Δικά μου» */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, PP=window.PP, U=window.AlkyonUnits;
var A=function(){ return B.adv; };
var sel={di:0,hr:null};

function bar(label,v,max,right,cls){ return h('div',{class:'bar'+(cls?' '+cls:'')},h('span',{class:'bl',text:label}),h('span',{class:'bt'},h('i',{style:{width:Math.max(2,Math.min(100,Math.round(v/(max||1)*100)))+'%'}})),h('span',{class:'bv',text:right})); }
function card(title,sub){ var c=h('section',{class:'card'},h('h2',{text:title})); if(sub) c.append(h('p',{class:'sub',style:{margin:'-4px 0 12px'},text:sub})); return c; }
function rerender(){ B.emit('fc-redraw'); }
function moonTxt(f){ var i=Math.floor(f*8+0.5)%8; return (EN?['new moon','waxing crescent','first quarter','waxing gibbous','full moon','waning gibbous','last quarter','waning crescent']:['νέα σελήνη','αύξουσα ημισέληνος','πρώτο τέταρτο','αύξων αμφίκυρτος','πανσέληνος','φθίνων αμφίκυρτος','τελευταίο τέταρτο','φθίνουσα ημισέληνος'])[i]; }
function ptTxt(t){ return {fast:T('πίεση πέφτει απότομα','pressure falling fast'),slow:T('πίεση πέφτει αργά','pressure falling slowly'),stable:T('σταθερή πίεση','steady pressure'),rise:T('πίεση ανεβαίνει','pressure rising')}[t]||''; }

/* ---------- Τι ψαρεύω ---------- */
B.fcAdv=function(page,fc,ctx){
  var D=A().collect(), days=fc.days||[]; if(!days.length) return;
  if(sel.di>=days.length) sel.di=0;
  var d=days[sel.di], nh=+fc.nowLocal.slice(11,13);
  if(sel.hr==null) sel.hr=sel.di===0?Math.min(23,nh+1):(d.win?d.win.s:17);
  var q=(d.hours||[]).filter(function(x){ return x.hr===sel.hr; })[0]||d.hours[0];

  var c=card(T('Τι να ψαρέψω','What to fish for'));
  /* επιλογή ημέρας και ώρας */
  var chips=h('div',{class:'chips',role:'group','aria-label':T('Ημέρα','Day')});
  days.forEach(function(x,i){ chips.append(h('button',{type:'button',class:'chip','aria-pressed':String(i===sel.di),text:B.dayName(x.date,ctx.today),onclick:function(){ sel.di=i; sel.hr=null; rerender(); }})); });
  var step=function(dv){ return function(){ sel.hr=(sel.hr+dv+24)%24; rerender(); }; };
  var hp=h('div',{class:'hrpick'},h('button',{type:'button',class:'iconbtn sm','aria-label':T('Μία ώρα νωρίτερα','One hour earlier'),text:'−',onclick:step(-1)}),h('b',{'aria-live':'polite',text:B.pad(sel.hr)+':00'}),h('button',{type:'button',class:'iconbtn sm','aria-label':T('Μία ώρα αργότερα','One hour later'),text:'+',onclick:step(1)}));
  c.append(chips,hp);
  if(q){ var bits=[]; if(q.wind!=null) bits.push(T('άνεμος ','wind ')+U.wind(q.wind)); if(q.wave!=null&&B.prof()!=='lake') bits.push(T('κύμα ','waves ')+U.wave(q.wave)); if(q.ptrend) bits.push(ptTxt(q.ptrend)); bits.push(moonTxt(d.f));
    c.append(h('p',{class:'sub',style:{margin:'10px 0 4px'},text:bits.join(', ')+'.'})); }
  var S=q?A().suggest(D,A().slot(d,q)):{species:[],tech:[]};
  if(!S.species.length) c.append(h('p',{class:'sub',text:B.prof()==='lake'?T('Για λίμνη οι προτάσεις έρχονται από τα δικά σου ψάρια. Καταγράψε μερικά για να εμφανιστούν.','For lakes the suggestions come from your own catches. Log a few to see them.'):T('Δεν υπάρχουν ακόμα προτάσεις για αυτό το προφίλ.','No suggestions for this profile yet.')}));
  else {
    var mx=S.species[0].p, l=h('div',{class:'spl'});
    S.species.forEach(function(r){
      var det=[r.tech.length?T('Τεχνική: ','Technique: ')+r.tech.join(', '):'',r.bait.length?T('Δόλωμα: ','Bait: ')+r.bait.join(', '):'',r.depth?T('Βάθος: ','Depth: ')+r.depth:''].filter(Boolean);
      l.append(h('div',{class:'sp'},h('div',{class:'sph'},h('b',{text:r.name}),h('span',{text:Math.round(r.p*100)+'%'})),h('span',{class:'bt'},h('i',{style:{width:Math.max(3,Math.round(r.p/mx*100))+'%'}})),
        h('p',{class:'spd',text:det.join('. ')+(det.length?'. ':'')+(r.n?T('Από ','From ')+r.n+T(' δικά σου ψάρια.',' of your catches.'):T('Από γενική γνώση.','From general knowledge.'))}),
        r.warn?h('p',{class:'spw',text:r.warn}):null));
    });
    c.append(l);
    if(S.tech.length){ c.append(h('h3',{class:'h3',text:T('Προτεινόμενη τεχνική','Suggested technique')})); S.tech.forEach(function(t){ c.append(bar(t.name,t.p,S.tech[0].p,Math.round(t.p*100)+'%')); }); }
  }
  c.append(h('p',{class:'foot',style:{margin:'12px 0 0'},text:T('Τα ποσοστά δείχνουν σχετική πιθανότητα ανάμεσα στα είδη της λίστας, όχι σίγουρο αποτέλεσμα.','Percentages show relative likelihood among the listed species, not a certain result.')}));
  page.append(c);

  /* πότε και πού για ένα είδος */
  var key=B.ls.get('alkyon-advsp',''), c2=card(T('Πότε και πού','When and where'),T('Διάλεξε είδος. Ο βαθμός της πρόγνωσης προσαρμόζεται σε αυτό.','Choose a species. The forecast score adapts to it.'));
  var opts=A().speciesList(D), ss=h('select',{class:'select','aria-label':T('Είδος','Species')},h('option',{value:'',text:T('Όλα τα είδη','All species')}));
  opts.forEach(function(o){ ss.append(h('option',{value:o.v,text:o.t+(o.n?' ('+o.n+')':'')})); });
  ss.value=key; ss.addEventListener('change',function(){ B.ls.set('alkyon-advsp',ss.value); if(ctx.reload) ctx.reload(); });
  c2.append(ss);
  if(key){
    var R=A().species(D,key,fc);
    c2.append(h('p',{class:'sub',style:{margin:'10px 0 0'},text:R.n?T('Από ','From ')+R.n+T(' δικά σου ψάρια και γενική γνώση.',' of your catches and general knowledge.'):T('Από γενική γνώση. Θα γίνει πιο προσωπικό όσο καταγράφεις αυτό το είδος.','From general knowledge. It becomes more personal as you log this species.')}));
    if(R.warn) c2.append(h('p',{class:'spw',text:R.warn}));
    if(R.days.length){ c2.append(h('h3',{class:'h3',text:T('Καλύτερες ώρες αυτή την εβδομάδα','Best times this week')}));
      var l2=h('div',{class:'mini-list'});
      R.days.forEach(function(r){ l2.append(h('button',{type:'button',class:'mrow',onclick:function(){ ctx.open(r.date,r.win?r.win.s:null); }},h('span',{text:B.dayName(r.date,ctx.today)}),h('b',{text:r.win?B.pad(r.win.s)+':00–'+B.pad((r.win.e+1)%24)+':00':''}),h('i',{class:'sc',text:String(r.best)}))); });
      c2.append(l2); }
    if(R.works.length){ c2.append(h('h3',{class:'h3',text:T('Οι συνθήκες που σου δουλεύουν','Conditions that work for you')}),h('p',{class:'p',text:R.works.join(', ')+'.'})); }
    if(R.depth) c2.append(h('h3',{class:'h3',text:T('Βάθη όπου το πιάνεις','Depths where you catch it')}),h('p',{class:'p',text:R.depth.lo+'–'+R.depth.hi+' m, '+T('συνήθως ','typically ')+R.depth.md+' m ('+R.depth.n+T(' ψάρια',' fish')+').'}));
    c2.append(h('h3',{class:'h3',text:T('Τα σημεία σου','Your spots')}));
    if(!R.spots.length) c2.append(h('p',{class:'sub',text:T('Δεν έχεις ακόμα ψάρι αυτού του είδους με θέση.','No catch of this species with a position yet.')}));
    else { var l3=h('div',{class:'mini-list'}); R.spots.forEach(function(z){ l3.append(h('a',{class:'mrow',href:B.classic('?a=map&lat='+z.lat.toFixed(5)+'&lon='+z.lon.toFixed(5))},h('span',{text:z.lat.toFixed(4)+', '+z.lon.toFixed(4)}),h('b',{text:z.n+' '+T('ψάρια','fish')+(z.kg?', '+B.num(z.kg,1)+' kg':'')}),B.icon('chev'))); }); c2.append(l3); }
  }
  page.append(c2);
  page.append(h('p',{class:'foot',text:T('Τρέχει μόνο στο κινητό σου. Ξεκινά από γενική γνώση για τα είδη και περνά στα δικά σου ψάρια όσο τα καταγράφεις.','Runs only on your phone. It starts from general knowledge about the species and moves to your own catches as you log them.')}));
  if(window.AlkyonExt){ try{ var xc=AlkyonExt.card(function(){ B.emit('store','alkyon-fprof'); }); xc.classList.add('extcard'); page.append(xc); }catch(e){} }
};

/* ---------- Δικά μου ---------- */
var LAB={
  block:function(i){ return (EN?PP.LIGHT_EN:PP.LIGHT_EL)[i]; },
  moon:function(i){ return [T('Νέα σελήνη','New moon'),T('Α΄ τέταρτο','First quarter'),T('Πανσέληνος','Full moon'),T('Δ΄ τέταρτο','Last quarter')][i]; },
  ptrend:function(i){ return [T('Πέφτει απότομα','Falling fast'),T('Πέφτει αργά','Falling slowly'),T('Σταθερή','Steady'),T('Ανεβαίνει','Rising')][i]; },
  wind:function(i){ return [T('Ήπιος, έως 3 Bft','Light, up to 3 Bft'),T('Μέτριος, 3–4 Bft','Moderate, 3–4 Bft'),T('Δυνατός, 5+ Bft','Strong, 5+ Bft')][i]; }
};
var TITLE={block:T('Φως','Light'),moon:T('Σελήνη','Moon'),ptrend:T('Πίεση','Pressure'),wind:T('Άνεμος','Wind')};
B.fcMine=function(page,fc,ctx){
  var m=A().model(), p=m.progress, N=p.need;
  /* κατάσταση */
  var c=card(T('Η προσωπική σου πρόγνωση','Your personal forecast'),T('Μαθαίνει από τις εξόδους σου (πόσες ώρες ψάρευες) και από όσα έπιασες.','It learns from your trips (how long you fished) and what you caught.'));
  c.append(bar(T('Ώρες','Hours'),p.hours,N.hours,B.num(Math.min(p.hours,999),p.hours<10?1:0)+' / '+N.hours),bar(T('Έξοδοι','Trips'),p.sessions,N.sessions,p.sessions+' / '+N.sessions),bar(T('Ψάρια','Catches'),p.catches,N.catches,p.catches+' / '+N.catches));
  var v=m.valid, msg=!m.ready?T('Μόλις συμπληρωθούν όλα, ανοίγει η προσωπική πρόγνωση.','Once all three are complete, your personal forecast unlocks.')
    :!v?T('Έτοιμη. Για να ελεγχθεί αν προβλέπει καλύτερα από τον μέσο όρο σου χρειάζονται 10 έξοδοι.','Ready. To check whether it predicts better than your average, 10 trips are needed.')
    :v.gain>0?T('Ελέγχθηκε σε ','Checked on ')+v.n+T(' εξόδους που δεν είδε: προβλέπει ',' trips it had not seen: it predicts ')+Math.round(v.gain*100)+T('% καλύτερα από τον μέσο όρο σου.','% better than your average.')
    :T('Ελέγχθηκε σε ','Checked on ')+v.n+T(' εξόδους: δεν προβλέπει ακόμα καλύτερα από τον μέσο όρο σου. Συνέχισε να καταγράφεις.',' trips: it does not yet predict better than your average. Keep logging.');
  c.append(h('p',{class:'p',style:{margin:'10px 0 0',fontWeight:'600'},text:msg}));
  page.append(c);

  /* σύγκριση γενικής και προσωπικής */
  var c3=card(T('Γενική και προσωπική','General and personal'),m.ready?null:T('Η προσωπική στήλη ανοίγει όταν υπάρχουν αρκετά δεδομένα.','The personal column unlocks when there is enough data.'));
  var tb=h('div',{class:'cmp'},h('span'),h('span',{class:'ch',text:T('Γενική','General')}),h('span',{class:'ch',text:T('Προσωπική','Personal')}));
  var nk=fc.nowLocal.slice(0,13)+':00', ag=0, tot=0;
  (fc.days||[]).forEach(function(d){
    var pd=m.ready?PP.day(m,d,d.date===ctx.today?nk:null):null, g=d.safe?d.best:null, pe=pd&&pd.safe?pd.best:null;
    if(d.win&&pd&&pd.win){ tot++; if(d.win.s<=pd.win.e&&pd.win.s<=d.win.e) ag++; }
    var cell=function(val,w){ return h('span',{class:'cc'},h('b',{text:val==null?'–':String(val)}),h('small',{text:w?B.pad(w.s)+':00–'+B.pad((w.e+1)%24)+':00':''})); };
    tb.append(h('span',{class:'cd',text:B.dayName(d.date,ctx.today)}),cell(g,d.win),m.ready?cell(pe,pd&&pd.win):h('span',{class:'cc lock',text:'—'}));
  });
  c3.append(tb);
  if(m.ready&&tot) c3.append(h('p',{class:'sub',style:{margin:'10px 0 0'},text:T('Συμφωνούν στην ώρα ','They agree on the time ')+ag+T(' από ',' of ')+tot+T(' μέρες.',' days.')}));
  page.append(c3);

  /* μοτίβα */
  if(m.ready){ var c4=card(T('Τα μοτίβα σου','Your patterns'),T('Πόσο πάνω ή κάτω από τον μέσο όρο σου πιάνεις σε κάθε συνθήκη.','How far above or below your average you catch in each condition.'));
    Object.keys(TITLE).forEach(function(k){ var F=m.factors[k], mx=Math.max.apply(null,F.map(function(x){ return x.m; }));
      c4.append(h('h3',{class:'h3',text:TITLE[k]}));
      F.forEach(function(x,i){ if(!x.h) return; c4.append(bar(LAB[k](i),x.m,mx,'×'+B.num(x.m,1),x.m>=1.15?'up':x.m<=0.85?'down':'')); }); });
    page.append(c4); }

  /* ο βαθμός στην πράξη */
  var cb=A().calib(), c5=card(T('Ο βαθμός στην πράξη','The score in practice'),T('Ψάρια ανά ώρα ψαρέματος, ανάλογα με τον βαθμό που έδινε η εφαρμογή εκείνη την ώρα.','Catches per fishing hour, by the score the app gave at that hour.'));
  var cmx=Math.max.apply(null,cb.bins.map(function(b){ return b.rate||0; }).concat([0.01]));
  cb.bins.forEach(function(b,i){ c5.append(bar([T('Κάτω από 60','Below 60'),'60–79','80+'][i],b.rate||0,cmx,b.h>0?B.num(b.rate,2)+T(' /ώρα',' /h'):'—')); });
  c5.append(h('p',{class:'p',style:{margin:'10px 0 0',fontWeight:'600'},text:!cb.ok?T('Χρειάζονται τουλάχιστον 6 έξοδοι με καταγεγραμμένο βαθμό (τώρα ','Needs at least 6 trips with the score recorded (now ')+cb.n+').'
    :cb.ratio===Infinity||cb.ratio>=1.3?T('Ο βαθμός βοηθά: στις ώρες με υψηλό βαθμό πιάνεις περισσότερα.','The score helps: you catch more at well-scored hours.')
    :T('Δεν φαίνεται ακόμα διαφορά ανάμεσα σε υψηλό και χαμηλό βαθμό στα δικά σου νερά.','No clear difference between high and low scores in your waters yet.')}));
  page.append(c5);

  /* πρόσφατες έξοδοι */
  var S=PP.sessionsOf(A().trips()).sort(function(a,b){ return b.startMs-a.startMs; }).slice(0,6);
  if(S.length){ var bites=A().act(), utc=A().utcMin(), c6=card(T('Πρόσφατες έξοδοι','Recent trips')), l=h('div',{class:'mini-list'});
    S.forEach(function(s){ var hrs=(s.endMs-s.startMs)/3600000, n=s.manual?(+s.count||0):bites.filter(function(b){ var ms=PP.biteMs(b,utc); return ms!=null&&ms>=s.startMs-600000&&ms<=s.endMs+600000; }).length;
      l.append(h('div',{class:'mrow'},h('span',{text:s.date?B.dayName(s.date)+' '+B.dateShort(s.date):''}),h('b',{text:B.num(hrs,1)+' h, '+n+' '+T(n===1?'ψάρι':'ψάρια',n===1?'catch':'catches')}))); });
    c6.append(l); page.append(c6); }
  page.append(h('p',{class:'foot'},T('Για να προσθέσεις παλιά έξοδο, άνοιξε την ','To add a past trip, open the '),h('a',{href:B.classic('?a=fc'),text:T('κλασική έκδοση','classic version')}),'.'));
};
})();
