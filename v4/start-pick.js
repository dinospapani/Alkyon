/* Alkyon 4 · «Πού ψαρεύεις σήμερα;»: ολόκληρη σελίδα που ανοίγει πρώτη (όπως η κλασική startpick.js, ίδια κλειδιά: alkyon-fprof, alkyon-fside, alkyon-askfp).
   Ακτή ή Σκάφος (κάρτες με φωτογραφία), μετά με τι ψαρεύεις. Δεν εμφανίζεται κατά την έξοδο ή αν διάλεξες «Να μη ρωτάει κάθε φορά».
   Νέος χρήστης (χωρίς alkyon-onboard και χωρίς δεδομένα): πρώτα το καλωσόρισμα, με την ίδια επιλογή μέσα. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls;
function raw(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function put(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
var SIDE={shore:{n:T('Ακτή','Shore'),d:T('Μόλος · Βράχια · Λίμνη','Beach · Rocks · Dam'),img:'alk-card-shore.jpg'},
  boat:{n:T('Σκάφος','Offshore'),d:T('Ανοιχτή θάλασσα · Κουμπιά ασφαλείας','Open sea · Safety buttons'),img:'alk-card-boat.jpg'}};
/* εικονίδια γραμμής (ίδιο στυλ με την υπόλοιπη εφαρμογή) */
var IC={rod:'<path d="M4 20L18.5 5.5"/><path d="M18.5 5.5c1.2-1.2 2.5-.4 2.5 1v5"/><circle cx="7.5" cy="16.5" r="2.2"/><path d="M21 11.5v2.5a1.5 1.5 0 0 1-3 0"/>',
  spear:'<path d="M2 14h13"/><path d="M15 12.5h3l4 1.5-4 1.5h-3z"/><path d="M5 14v3.5M8 14v2"/><path d="M2 11.5l2.5 2.5L2 16.5"/>',
  lake:'<path d="M3 18c2 0 2-1.4 4.5-1.4S9.5 18 12 18s2.5-1.4 4.5-1.4S19 18 21 18"/><path d="M4 14l4.5-6 3 4 2.5-3 6 5"/>',
  shore:'<path d="M3 17c2.2 0 2.2-1.5 4.5-1.5S9.8 17 12 17s2.2-1.5 4.5-1.5S19 17 21 17"/><path d="M5 13l5-8"/><path d="M10 5l8 4"/>',
  boat:'<path d="M3 15h18l-2.5 4.5h-13z"/><path d="M7 15V9h7l3 6"/><path d="M10 9V5"/>'};
function svg(k){ return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(IC[k]||'')+'</svg>'; }
var METH={shore:[{p:'shore',n:T('Καλάμι από την ακτή','Rod from the shore'),d:T('Βυθός · Spinning · Surfcasting','Bottom · Spinning · Surfcasting'),i:'rod',th:'alk-th-shorerod.jpg'},{p:'spear',n:T('Ψαροντούφεκο από την ακτή','Spearfishing from the shore'),d:T('Βουτιά · Σημαδούρα · Ασφάλεια','Dive · Float · Safety'),i:'spear',th:'alk-th-spear.jpg'},{p:'lake',n:T('Φράγμα ή λίμνη','Dam or lake'),d:T('Γλυκό νερό · Χωρίς κύμα','Fresh water · No waves'),i:'lake',th:'alk-th-lake.jpg'}],
  boat:[{p:'boat',n:T('Καλάμι','Rod'),d:T('Βυθός · Συρτή · Jigging · Casting','Bottom · Trolling · Jigging · Casting'),i:'rod',th:'alk-th-boatrod.jpg'},{p:'spear',n:T('Ψαροντούφεκο από σκάφος','Spearfishing from a boat'),d:T('Βουτιά · Ψαροντούφεκο · Σημαδούρα','Dive · Speargun · Float · Safety'),i:'spear',th:'alk-th-spear.jpg'}]};
function cur(){ return B.prof(); }
function side(){ var p=cur(), s=raw('alkyon-fside'); if(p==='boat') return 'boat'; if(p==='shore'||p==='lake') return 'shore'; return s==='boat'?'boat':'shore'; }
function label(p,s){ return s==='boat'?(p==='boat'?T('Σκάφος, καλάμι','Offshore, rod'):T('Σκάφος, ψαροντούφεκο','Offshore, spearfishing')):(p==='lake'?T('Φράγμα ή λίμνη','Dam or lake'):p==='spear'?T('Ακτή, ψαροντούφεκο','Shore, spearfishing'):T('Ακτή, καλάμι','Shore, rod')); }
B.fishSide=side;
var CHK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', CHEV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/* η επιλογή (κάρτες + τρόποι): χρησιμοποιείται στη σελίδα και στο καλωσόρισμα */
function picker(st,onChange){
  var box=h('div',{class:'spk'});
  function paint(){ box.replaceChildren();
    var g=h('div',{class:'spcards',role:'radiogroup','aria-label':T('Περιβάλλον','Environment')});
    ['shore','boat'].forEach(function(k){ var x=SIDE[k], on=st.s===k;
      g.append(h('button',{type:'button',class:'spcard'+(on?' on':''),role:'radio','aria-checked':String(on),onclick:function(){ st.s=k; if(!METH[k].some(function(m){ return m.p===st.p; })) st.p=METH[k][0].p; paint(); onChange&&onChange(); }},
        h('span',{class:'spimg',style:{backgroundImage:'url('+x.img+')'}}),h('span',{class:'spshade'}),on?h('span',{class:'spchk',html:CHK}):null,
        h('span',{class:'spcap'},h('span',{class:'spic',html:svg(k)}),h('b',{text:x.n}),h('small',{text:x.d})))); });
    var l=h('div',{class:'spmeth',role:'radiogroup','aria-label':T('Με τι ψαρεύεις','How you fish')});
    METH[st.s].forEach(function(m){ var on=st.p===m.p;
      l.append(h('button',{type:'button',class:'sprow'+(on?' on':''),role:'radio','aria-checked':String(on),onclick:function(){ st.p=m.p; paint(); onChange&&onChange(); }},
        (m.th?h('span',{class:'spmi sph',style:{backgroundImage:'url('+m.th+')'}}):h('span',{class:'spmi',html:svg(m.i)})),h('span',{class:'tx'},h('b',{text:m.n}),h('small',{text:m.d})),h('span',{class:'sprad',html:on?CHK:''}))); });
    box.append(g,h('h3',{class:'sph3',text:T('Με τι ψαρεύεις;','How are you fishing?')}),l); }
  paint(); return box;
}
function brand(){ return h('div',{class:'spbrand'},h('img',{src:'../icon-192.png',alt:'',width:'44',height:'44'}),h('span',null,h('b',{text:'Alkyon'}),h('small',{text:T('ΨΑΡΕΜΑ ΣΤΗ ΣΩΣΤΗ ΣΤΙΓΜΗ','KNOW THE MOMENT')}))); }
function cover(on){ document.documentElement.classList.toggle('pre-pick',!!on); document.documentElement.classList.toggle('pg-open',!!on); }

B.startPick=function(){
  if(document.querySelector('.sppage')) return;
  var st={s:side(),p:cur()}, prev=document.activeElement;
  var ask=h('input',{type:'checkbox',checked:raw('alkyon-askfp')==='0'}), go=h('button',{class:'spgo',type:'button'});
  /* 1.12.15: η φωτογραφία ακολουθεί την επιλογή (ακτή / σκάφος / ψαροντούφεκο) */
  function heroImg(){ return st.p==='spear'?'alk-hero-spear.jpg':st.s==='shore'?'alk-card-shore.jpg':'alk-hero-boat.jpg'; }
  function lab(){ go.replaceChildren(h('span',{text:T('Συνέχεια · ','Continue · ')+label(st.p,st.s)}),h('i',{html:CHEV})); try{ var hi=pg&&pg.querySelector('.sphero'); if(hi) hi.style.backgroundImage='url('+heroImg()+')'; }catch(e){} }
  function close(){ pg.classList.add('out'); cover(false); document.removeEventListener('keydown',key); setTimeout(function(){ pg.remove(); },260); try{ prev&&prev.focus&&prev.focus(); }catch(e){} }
  function key(e){ if(e.key==='Escape') close(); }
  go.addEventListener('click',function(){ put('alkyon-fside',st.s); put('alkyon-fprof',st.p); put('alkyon-fprof-done','1'); put('alkyon-askfp',ask.checked?'0':'1'); B.emit('store','alkyon-fprof'); close(); });
  var pg=h('div',{class:'sppage',role:'dialog','aria-modal':'true','aria-label':T('Πού ψαρεύεις σήμερα;','Where are you fishing today?')},
    h('div',{class:'sphero',style:{backgroundImage:'url('+heroImg()+')'}},h('span',{class:'spheroshade'}),
      h('button',{class:'spskip',type:'button',text:T('Παράλειψη','Skip'),title:T('Κλείσιμο χωρίς αλλαγή: θα ξαναρωτήσει την επόμενη φορά','Close without changes: it will ask again next time'),onclick:close}),brand(),
      h('div',{class:'sptitle'},h('p',{class:'sphi',text:hello()}),h('h1',{text:T('Πού ψαρεύεις σήμερα;','Where are you fishing today?')}),todayChip()||h('p',{text:T('Διάλεξε πού και πώς ψαρεύεις','Choose where and how you fish')}))),
    h('div',{class:'spbody'},picker(st,lab),
      h('label',{class:'spask'},ask,h('span',{class:'spbox',html:CHK}),h('span',{text:T('Να μη ρωτάει κάθε φορά','Don’t ask every time')})),
      go,h('p',{class:'spfoot',text:T('Αλλαγή αργότερα: Προφίλ › Τύπος ψαρέματος','Change later: Profile › Fishing type')})));
  lab(); cover(true); document.body.append(pg); document.addEventListener('keydown',key);
};
/* 1.12.15: χαιρετισμός και «σήμερα» από την τελευταία πρόγνωση (χωρίς δίκτυο, από το κινητό) */
function hello(){ var hr=new Date().getHours(), g=hr<5?T('Καλή νύχτα','Good night'):hr<12?T('Καλημέρα','Good morning'):hr<18?T('Καλησπέρα','Good afternoon'):T('Καλό βράδυ','Good evening');
  var nm=''; try{ var s=B.cloud&&B.cloud.session&&B.cloud.session(); nm=s&&(s.name||'').trim().split(/\s+/)[0]||''; }catch(e){} return nm?g+', '+nm:g; }
function todayChip(){ try{ var c=ls.get('alkyon-fc7',null); if(!c||!c.fc||!c.fc.days||Date.now()-(c.t||0)>12*3600e3) return null;
  var d0=new Date(), td=d0.getFullYear()+'-'+B.pad(d0.getMonth()+1)+'-'+B.pad(d0.getDate()), d=c.fc.days.filter(function(x){ return x.date===td; })[0]; if(!d) return null;
  var pl=(ls.get('alkyon-places',[])||[]).filter(function(x){ return x&&x.id===c.id; })[0], nm=pl&&pl.name?pl.name:'', U=window.AlkyonUnits;
  var wx=[d.avgWind!=null?(U&&U.windP?U.windP(d.avgWind).join(' '):Math.round(d.avgWind)+' kn'):'',d.avgWave!=null?B.num(d.avgWave,1)+' m':''].filter(Boolean).join(' · ');
  var past=d.win&&d.win.e<d0.getHours(), ch=h('div',{class:'sptoday'+(d.safe?'':' bad')},
    h('span',{class:'stsc',text:d.safe&&d.best!=null?String(d.best):'!'}),
    h('span',{class:'sttx'},h('b',{text:T('Σήμερα','Today')+(nm?' · '+nm:'')}),h('small',{text:d.safe&&d.win?(past?T('η καλύτερη ώρα πέρασε','the best time has passed'):T('καλύτερη ώρα ','best time ')+B.pad(d.win.s)+':00–'+B.pad((d.win.e+1)%24)+':00')+(wx?' · '+wx:''):T('εκτός ορίων ασφαλείας σου','outside your safety limits')+(wx?' · '+wx:'')})));
  return ch; }catch(e){ return null; } }
function wanted(){ if(!raw('alkyon-onboard')) return false; if(raw('alkyon-askfp')==='0'&&raw('alkyon-fprof-done')) return false; var s=ls.get('alkyon-safe',null); if(s&&s.active) return false; if(/#(new|trip|addfriend)/.test(location.hash)) return false; return true; }

/* ---------- καλωσόρισμα πρώτου ανοίγματος (όπως η κλασική: alkyon-onboard). Δεν εμφανίζεται αν υπάρχουν ήδη δεδομένα. ---------- */
function hasData(){ try{ return ['bites','trips','spots','tackle'].some(function(k){ return B.store.raw(k).length>0; }); }catch(e){ return false; } }
/* 1.11.3/1.11.4: η χώρα στο καλωσόρισμα, χωρίς να μοιάζει η εφαρμογή «μόνο για Κύπρο και Ελλάδα».
   Αν η εφαρμογή ξέρει πού είσαι: «Χώρα: … (από τη θέση σου) · Αλλαγή». Αλλιώς: κουμπί «Χρήση της θέσης μου» ή λίστα με όλες τις χώρες.
   Η χώρα χρειάζεται μόνο για τους νόμους στον Οδηγό· οι ζώνες απαγόρευσης στον χάρτη ακολουθούν πάντα το μέρος που βλέπεις. */
/* 1.12.3: γλώσσα στην πρώτη οθόνη (η προεπιλογή για νέους είναι Αγγλικά)· η σελίδα ξαναφορτώνει και η υποδοχή ξεκινά στη νέα γλώσσα */
function langRow(){ var cur=B.LANG==='en'?'en':'el', box=h('div',{class:'splang',style:'margin:6px 4px 4px;color:rgba(255,255,255,.88);font:550 14.5px var(--font);display:flex;align-items:center;gap:6px;flex-wrap:wrap'});
  function b(v,t){ return h('button',{type:'button',class:'lnk','aria-pressed':String(cur===v),style:cur===v?'font-weight:700;text-decoration:none':null,text:t,onclick:function(){ if(v===cur) return; try{ localStorage.setItem('alkyon-lang',v); }catch(e){} location.reload(); }}); }
  box.append(h('span',{text:'🌐 '}),b('en','English'),h('span',{text:' · '}),b('el','Ελληνικά'));
  return box; }
function country(){
  var box=h('div',{class:'spctry'}), open=false, busy=false;
  function paint(){ var set=ls.get('alkyon-country','auto'), p=ls.get('alkyon-v4-pos',null), known=p&&typeof p.lat==='number', reg=known&&B.region?(B.region(p.lat,p.lon)||'xx'):null;
    box.replaceChildren();
    if(!open&&(set!=='auto'||known)){ var nm=set!=='auto'?B.countryName(set):reg==='xx'?T('αυτόματα, από τη θέση σου','automatic, from your location'):B.countryName(reg)+T(' (από τη θέση σου)',' (from your location)');
      box.append(h('span',{text:T('Χώρα: ','Country: ')+nm+' '}),h('button',{type:'button',class:'lnk',text:T('Αλλαγή','Change'),onclick:function(){ open=true; paint(); }})); return; }
    var row=h('div',{class:'row'});
    if(!known) row.append(h('button',{type:'button',class:'loc',disabled:busy,text:busy?T('Αναζήτηση θέσης…','Finding location…'):T('Χρήση της θέσης μου','Use my location'),onclick:function(){ busy=true; paint(); B.locate(9000).then(function(){ busy=false; open=false; ls.set('alkyon-country','auto'); paint(); }); }}));
    row.append(B.countrySelect(set,function(v){ ls.set('alkyon-country',v); }));
    box.append(h('span',{text:T('Σε ποια χώρα ψαρεύεις;','Which country do you fish in?')}),row,h('small',{text:T('Για τους νόμους στον Οδηγό. Οι ζώνες απαγόρευσης στον χάρτη ακολουθούν πάντα το μέρος που βλέπεις. Αλλαγή: Προφίλ › Ρυθμίσεις › Χώρα.','For the laws in the Guide. No-fishing zones on the map always follow the place you look at. Change: Profile › Settings › Country.')})); }
  paint(); return box; }
B.tour=function(){
  if(document.querySelector('.sppage')) return;
  var st={s:side(),p:cur()}, step=0, pg, prev=document.activeElement;
  var STEPS=[{img:'alk-hero.jpg',t:T('Καλώς ήρθες στο Alkyon','Welcome to Alkyon'),b:T('Πρόγνωση, χάρτης και ημερολόγιο ψαρέματος. Σε ένα λεπτό είσαι έτοιμος.','Forecast, map and fishing logbook. You will be ready in a minute.')},
    {img:'alk-hero-boat.jpg',pick:true,t:T('Πού ψαρεύεις συνήθως;','Where do you usually fish?'),b:T('Η εφαρμογή προσαρμόζει τις τεχνικές, τον εξοπλισμό και τα κουμπιά ασφαλείας σε αυτό που κάνεις. Μπορείς να το αλλάξεις όποτε θέλεις από το Προφίλ.','The app adapts techniques, tackle and safety buttons to how you fish. You can change it any time in Profile.')},
    {img:'alk-card-boat.jpg',t:T('Δες τη θάλασσα πριν φύγεις','Check the sea before you leave'),b:T('Στην Πρόγνωση βλέπεις πόσο καλή είναι η μέρα για ψάρεμα (από 0 έως 100), τις καλύτερες ώρες, τον άνεμο, το κύμα και την πίεση εκεί που θα πας. Πάτα «Θα βγω αυτή τη μέρα» και θα σου το θυμίσει. Στον Χάρτη βλέπεις κύμα, άνεμο, ρεύματα και βάθη.','Forecast shows a 0–100 score, the best hours, wind, waves and pressure for the place you choose. Tap “I’ll go out this day” for reminders. The map shows waves, wind, currents and depths.')},
    {img:'alk-hero-spear.jpg',t:T('Γράψε κάθε έξοδο','Log every outing'),b:T('Πάτα το κεντρικό κουμπί όταν ξεκινάς να ψαρεύεις. Κάθε ψάρι το γράφεις με ένα πάτημα ή με τη φωνή σου, π.χ. «τρία λαβράκια, ενάμισι κιλό». Αν ορίσεις επαφή ασφαλείας, θα ειδοποιηθεί αυτόματα αν δεν γυρίσεις στην ώρα σου.','Tap the centre button when you start fishing. Log each catch with one tap or by voice, e.g. “three sea bass, one and a half kilos”. If you set a safety contact, they are alerted automatically if you are not back on time.')},
    {img:'alk-card-boat.jpg',t:T('Ειδοποιήσεις και ασφάλεια','Alerts and safety'),b:T('Άνοιξε τις ειδοποιήσεις για να μαθαίνεις πότε έρχεται καλή μέρα, να έχεις υπενθυμίσεις και να σε προειδοποιεί αν χαλάσει ο καιρός ενώ είσαι έξω. Αν έχεις σκάφος, βάλε το μέγεθός του και το λιμάνι σου, για να ξέρει η εφαρμογή τα όρια ασφαλείας και πότε πρέπει να γυρίσεις.','Turn on alerts for good days, reminders and weather warnings on trips. With a boat, set its size and your home port for the right limits and “time to head back”.'),alerts:true},
    /* 1.4.0: τελευταίο βήμα: λογαριασμός (μόνο αν δεν είσαι ήδη συνδεδεμένος) */
    {img:'alk-hero.jpg',t:T('Μη χάσεις ποτέ τα ψάρια σου','Never lose your catches'),b:T('Με δωρεάν λογαριασμό τα ψάρια, οι έξοδοι και οι φωτογραφίες σου φυλάγονται με ασφάλεια και τα βλέπεις από κάθε κινητό. Ο λογαριασμός χρειάζεται επίσης για φίλους, κοινότητα, αυτόματη ειδοποίηση ασφαλείας και το ρολόι Garmin.','With a free account your catches, trips and photos are kept in the cloud and on any phone. It is also needed for friends, community, automatic safety alerts and the Garmin watch.'),last:true,acct:true}];
  if(B.cloud&&B.cloud.session()) STEPS=STEPS.filter(function(x){ return !x.acct; }).map(function(x){ return x.alerts?Object.assign({},x,{last:true}):x; });
  function save(){ put('alkyon-fside',st.s); put('alkyon-fprof',st.p); put('alkyon-fprof-done','1'); B.emit('store','alkyon-fprof'); }
  function finish(){ put('alkyon-onboard','1'); try{ var sm=ls.get('alkyon-smart',{})||{}; if(!sm.weekly){ sm.weekly=Date.now(); ls.set('alkyon-smart',sm); B.emit('store','alkyon-smart'); } }catch(e){} if(!raw('alkyon-fprof-done')) save();
    pg.classList.add('out'); cover(false); setTimeout(function(){ pg.remove(); },260); document.removeEventListener('keydown',key); try{ prev&&prev.focus&&prev.focus(); }catch(e){} }
  function key(e){ if(e.key==='Escape') finish(); else if(e.key==='ArrowLeft'&&step>0){ step--; paint(); } }
  function paint(){ var x=STEPS[step]; pg.replaceChildren();
    var dots=h('div',{class:'obd','aria-hidden':'true'}); STEPS.forEach(function(_,i){ dots.append(h('i',{class:i===step?'on':null})); });
    var hero=h('div',{class:'sphero'+(x.pick?'':' tall'),style:{backgroundImage:'url('+x.img+')'}},h('span',{class:'spheroshade'}),x.last?null:h('button',{class:'spskip',type:'button',text:T('Παράλειψη','Skip'),onclick:finish}),brand(),
      h('div',{class:'sptitle'},h('h1',{text:x.t}),h('p',{text:x.b})));
    var body=h('div',{class:'spbody'}); if(x.pick) body.append(picker(st,null)); if(step===0) body.append(langRow(),country());
    /* 1.9.38: και «Πίσω», όχι μόνο «Επόμενο» */
    var back=step>0?h('button',{class:'spback',type:'button','aria-label':T('Πίσω','Back'),onclick:function(){ step--; paint(); pg.scrollTop=0; }},h('i',{html:CHEV}),h('span',{text:T('Πίσω','Back')})):null;
    body.append(dots,h('div',{class:'spnav'},back,h('button',{class:'spgo',type:'button',onclick:function(){ if(x.pick) save(); if(x.acct){ finish(); setTimeout(function(){ B.authSheet&&B.authSheet({mode:'up'}); },300); return; } if(x.last) finish(); else { step++; paint(); pg.scrollTop=0; } }},h('span',{text:x.acct?T('Δημιουργία λογαριασμού','Create account'):x.last?T('Ξεκινάμε','Get started'):T('Επόμενο','Next')}),h('i',{html:CHEV}))));
    if(x.alerts){ body.append(h('button',{class:'spsec',type:'button',text:'🔔 '+T('Άνοιγμα ειδοποιήσεων','Turn on alerts'),onclick:function(){ finish(); location.hash='#alerts'; }}));
      if((B.fishSide?B.fishSide():side())==='boat') body.append(h('button',{class:'spsec',type:'button',text:'⚓ '+T('Στοιχεία σκάφους και λιμάνι','Boat details and port'),onclick:function(){ finish(); location.hash='#boat'; }})); }
    if(x.acct) body.append(h('button',{class:'spsec',type:'button',text:T('Συνέχεια χωρίς λογαριασμό','Continue without an account'),onclick:finish}),h('button',{class:'spsec',type:'button',text:T('Έχω ήδη λογαριασμό · Σύνδεση','I already have an account · Sign in'),onclick:function(){ finish(); setTimeout(function(){ B.authSheet&&B.authSheet({mode:'in'}); },300); }}));
    if(x.alerts) body.append(h('button',{class:'spsec',type:'button',text:T('Ορισμός επαφής ασφαλείας','Set a safety contact'),onclick:function(){ finish(); location.hash='#profile'; setTimeout(function(){ var c=[].slice.call(document.querySelectorAll('section.card')).filter(function(n){ return /Επαφή ασφαλείας|Safety contact/.test(n.textContent); }); if(c[0]) c[0].scrollIntoView({block:'start',behavior:'smooth'}); },500); }}));
    pg.append(hero,body); }
  pg=h('div',{class:'sppage tour',role:'dialog','aria-modal':'true','aria-label':T('Καλωσόρισμα','Welcome')}); cover(true); document.body.append(pg); document.addEventListener('keydown',key); paint();
};

/* ανοίγει αμέσως, πριν φανεί η εφαρμογή από πίσω (η κλάση pre-pick μπαίνει ήδη από το index.html) */
(function(){ var go=null;
  if(!raw('alkyon-onboard')){ if(hasData()) put('alkyon-onboard','1'); else go=B.tour; }
  if(!go&&wanted()) go=B.startPick;
  if(go) go(); else cover(false);
})();
/* v31z531: στο κινητό η εφαρμογή συνήθως «ξυπνά» από το παρασκήνιο χωρίς να ξαναφορτώσει, οπότε η ερώτηση δεν έβγαινε.
   Τώρα βγαίνει και όταν επιστρέφεις μετά από 3+ ώρες ή σε νέα μέρα (εκτός αν είναι επιλεγμένο «Να μη ρωτάει κάθε φορά»). */
(function(){ var away=0;
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){ away=Date.now(); return; }
    if(!away) return; var was=away; away=0;
    var newDay=new Date(was).toDateString()!==new Date().toDateString();
    if(!(newDay||Date.now()-was>=3*3600e3)||!wanted()) return;
    if(document.querySelector('.sppage,.sheet')) return; var a=document.activeElement; if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    B.startPick();
  });
})();
})();
