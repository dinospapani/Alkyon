/* Υπο-καρτέλα «Δικά μου δεδομένα» της Πρόγνωσης: προσωπική πρόγνωση από τις έξοδοι και τα τσιμπήματα του χρήστη. */
(function(){
'use strict';
var C=window.AlkyonCore, PP=window.PP; var root=document.getElementById('fcMine'); if(!C||!PP||!root) return;
var h=C.h, $=C.$, pad=C.pad, EN=window.LANG==='en';
var T=function(el,en){ return EN?en:el; };
var last={place:null,fc:null}, seg='gen';
var DAYS=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
var LAB={
  block:function(i){ return (EN?PP.LIGHT_EN:PP.LIGHT_EL)[i]; }, /* v31z365: φως, σε σχέση με ανατολή/δύση */
  moon:function(i){ return [T('Νέα σελήνη','New moon'),T('Α΄ τέταρτο','First quarter'),T('Πανσέληνος','Full moon'),T('Δ΄ τέταρτο','Last quarter')][i]; },
  ptrend:function(i){ return [T('Πέφτει απότομα','Falling fast'),T('Πέφτει αργά','Falling slowly'),T('Σταθερή','Steady'),T('Ανεβαίνει','Rising')][i]; },
  wind:function(i){ return [T('Ήπιος (έως 3 Bft)','Light (up to 3 Bft)'),T('Μέτριος (3–4 Bft)','Moderate (3–4 Bft)'),T('Δυνατός (5+ Bft)','Strong (5+ Bft)')][i]; }
};
var TITLE={block:T('Φως (ανατολή/δύση)','Light (sunrise/sunset)'),moon:T('Φεγγάρι','Moon'),ptrend:T('Τάση πίεσης','Pressure trend'),wind:T('Άνεμος','Wind')};
function model(){ return PP.build(C.Store.get('trips'),C.Store.act(),{utcMin:C.utcMin(),misses:(C.Store.misses?C.Store.misses():[])}); }
function pct(v,n){ return Math.max(0,Math.min(100,Math.round(v/n*100))); }
function prog(label,v,n,unit){
  return h('div',{class:'bar'},h('span',{text:label}),h('div',{class:'t'},h('i',{style:'width:'+pct(v,n)+'%'})),h('span',{class:'n',text:(Math.round(v*10)/10)+'/'+n+(unit||'')}));
}
function statusCard(m){
  var p=m.progress, N=p.need, c=h('div',{class:'card'});
  c.append(h('h3',{text:T('Η προσωπική πρόγνωση','Your personal forecast')}));
  c.append(h('p',{class:'note',text:T('Μαθαίνει από τις εξόδους σου (ώρες που ψάρευες) και από όσα έπιασες, όχι μόνο από τα τσιμπήματα. Χωρίς τις ώρες που δεν έπιασες δεν μπορεί να ξέρει τι δουλεύει.','It learns from your trips (hours fished) and what you caught, not just the bites. Without the hours when you caught nothing it cannot know what works.')}));
  c.append(prog(T('Ώρες ψαρέματος','Hours fished'),p.hours,N.hours,' h'),prog(T('Έξοδοι','Trips'),p.sessions,N.sessions),prog(T('Τσιμπήματα','Bites'),p.catches,N.catches));
  /* v31z365: χρόνος πλεύσης που δεν μέτρησε, έλεγχος σε εξόδους που δεν είδε, και πότε έχει νόημα πιο προχωρημένη ανάλυση */
  if(p.moving>0.05) c.append(h('p',{class:'note',style:'margin:8px 0 0',text:T('Δεν μέτρησαν ως ψάρεμα ','Not counted as fishing: ')+(Math.round(p.moving*10)/10)+T(' ώρες πλεύσης (GPS πάνω από '+PP.MOVE_KN+' κόμβους). Το τρόλινγκ κάτω από αυτή την ταχύτητα μετρά.',' h of travel (GPS above '+PP.MOVE_KN+' kn). Trolling below that speed counts.')}));
  if(m.ready){ var v=m.valid; c.append(h('p',{class:'note',style:'margin:8px 0 0;font-weight:600',text:!v?T('Έλεγχος: χρειάζονται τουλάχιστον 10 έξοδοι για να ελεγχθεί αν προβλέπει καλύτερα από τον μέσο όρο σου.','Check: at least 10 trips are needed to test whether it predicts better than your average.')
    :v.gain>0?T('✓ Έλεγχος σε '+v.n+' εξόδους που δεν είδε: προβλέπει '+Math.round(v.gain*100)+'% καλύτερα από τον μέσο όρο σου. Χρησιμοποιείται στον βαθμό.','✓ Checked on '+v.n+' trips it had not seen: '+Math.round(v.gain*100)+'% better than your average. Used in the score.')
    :T('✗ Έλεγχος σε '+v.n+' εξόδους που δεν είδε: δεν προβλέπει καλύτερα από τον μέσο όρο σου ακόμα, γι’ αυτό δεν αλλάζει τον βαθμό. Συνέχισε να καταγράφεις εξόδους.','✗ Checked on '+v.n+' trips it had not seen: not better than your average yet, so it does not change the score. Keep logging trips.')})); }
  c.append(h('p',{class:'note',style:'margin:8px 0 0',text:m.advReady?T('📊 Έχεις '+p.sessions+' εξόδους: αρκετές για πιο προχωρημένη ανάλυση (Poisson regression, χωριστά ανά τεχνική και περιοχή). Ζήτα την όταν θέλεις.','📊 You have '+p.sessions+' trips: enough for a more advanced analysis (Poisson regression, separately per technique and area). Ask for it when you like.'):T('Πιο προχωρημένη ανάλυση (ανά τεχνική και περιοχή) θα έχει νόημα από '+PP.ADV.sessions+' εξόδους (τώρα '+p.sessions+').','A more advanced analysis (per technique and area) will make sense from '+PP.ADV.sessions+' trips (now '+p.sessions+').')}));
  c.append(h('p',{class:'note',style:'margin:8px 0 0',text:m.ready?T('Έτοιμη: υπάρχουν αρκετά δεδομένα. Παραμένει ενδεικτική και βελτιώνεται όσο προσθέτεις εξόδους.','Ready: there is enough data. It stays indicative and improves as you add trips.'):T('Δεν έχει αρκετά δεδομένα ακόμα. Ξεκίνα έξοδο με το «▶ Έξοδος» ή πρόσθεσε παλιές εξόδους παρακάτω.','Not enough data yet. Start a trip with “▶ Trip” or add past trips below.')}));
  return c;
}
function formCard(){
  var d=h('details',{class:'card'}); d.append(h('summary',{text:T('Πρόσθεσε παλιά έξοδο','Add a past trip')}));
  var f=h('div',{class:'grid2 stack',style:'margin-top:8px'});
  var inp=function(label,type,id,val,extra){ var i=h('input',Object.assign({type:type,id:id,value:val},extra||{})); return h('label',{class:'f'},label,i); };
  var wsel=h('select',{id:'mnWind'},h('option',{value:'',text:T('Άγνωστος','Unknown')}),h('option',{value:'5',text:LAB.wind(0)}),h('option',{value:'11',text:LAB.wind(1)}),h('option',{value:'18',text:LAB.wind(2)}));
  var psel=h('select',{id:'mnPress'},h('option',{value:'',text:T('Άγνωστη','Unknown')}),['fast','slow','stable','rise'].map(function(k,i){ return h('option',{value:k,text:LAB.ptrend(i)}); }));
  f.append(inp(T('Ημερομηνία','Date'),'date','mnDate',C.nicosiaToday()),inp(T('Από','From'),'time','mnFrom','06:00'),inp(T('Έως','To'),'time','mnTo','10:00'),inp(T('Τσιμπήματα (0 επιτρέπεται)','Bites (0 is fine)'),'number','mnCnt','0',{min:'0',max:'99'}),h('label',{class:'f'},T('Άνεμος','Wind'),wsel),h('label',{class:'f'},T('Τάση πίεσης','Pressure trend'),psel));
  d.append(f,h('div',{class:'row',style:'margin-top:8px'},h('button',{class:'btn sm',type:'button',text:T('Προσθήκη','Add'),onclick:addSession})),h('div',{class:'note',id:'mnMsg'}));
  return d;
}
function addSession(){
  var date=$('mnDate').value, a=$('mnFrom').value, b=$('mnTo').value, msg=$('mnMsg');
  if(!date||!a||!b){ msg.textContent=T('Συμπλήρωσε ημερομηνία και ώρες.','Fill in the date and times.'); return; }
  var y=+date.slice(0,4), mo=+date.slice(5,7), dd=+date.slice(8,10), off=C.utcMin()*60000;
  var st=Date.UTC(y,mo-1,dd,+a.slice(0,2),+a.slice(3,5))-off, en=Date.UTC(y,mo-1,dd,+b.slice(0,2),+b.slice(3,5))-off;
  if(en<=st) en+=86400000;
  if(en-st<10*60000||en-st>16*3600000){ msg.textContent=T('Η διάρκεια πρέπει να είναι από 10 λεπτά έως 16 ώρες.','Duration must be between 10 minutes and 16 hours.'); return; }
  var wv=$('mnWind').value, pv=$('mnPress').value;
  C.Store.save('trips',{date:date,spot:'',tech:'',species:'',count:Math.max(0,+$('mnCnt').value||0),kg:0,startMs:st,endMs:en,manual:true,cond0:{wind:wv?+wv:null,ptrend:pv||null},notes:T('Προστέθηκε χειροκίνητα','Added manually')});
  msg.textContent=T('Προστέθηκε.','Added.'); setTimeout(render,50);
}
function listCard(){
  var S=PP.sessionsOf(C.Store.get('trips')).sort(function(a,b){ return b.startMs-a.startMs; }).slice(0,8);
  if(!S.length) return null;
  var c=h('div',{class:'card'}); c.append(h('h3',{text:T('Πρόσφατες έξοδοι','Recent trips')}));
  var bites=C.Store.act();
  S.forEach(function(s){
    var hrs=(s.endMs-s.startMs)/3600000, n=s.manual?(+s.count||0):bites.filter(function(b){ var ms=PP.biteMs(b,C.utcMin()); return ms!=null&&ms>=s.startMs-600000&&ms<=s.endMs+600000; }).length;
    c.append(h('div',{class:'sessrow'},h('div',{style:'flex:1;min-width:0'},h('b',{text:s.date||''}),h('div',{class:'meta',text:(Math.round(hrs*10)/10)+' h · '+n+(EN?' bites':' τσιμπήματα')+(s.manual?' · '+T('χειροκίνητη','manual'):'')})),
      h('button',{class:'btn ghost sm',type:'button','aria-label':T('Διαγραφή','Delete'),text:'✕',onclick:function(){ window.AlkyonAsk(T('Να διαγραφεί η έξοδος;','Delete this trip?'),{title:T('Διαγραφή εξόδου','Delete trip'),ok:T('Διαγραφή','Delete'),danger:true}).then(function(y){ if(y) C.Store.remove('trips',s.id).then(render); }); }})));
  });
  return c;
}
function patternsCard(m){
  var c=h('div',{class:'card'}); c.append(h('h3',{text:T('Τα μοτίβα σου','Your patterns')}),h('p',{class:'note',text:T('Ρυθμός = τσιμπήματα ανά ώρα ψαρέματος. Το × δείχνει πόσο πάνω ή κάτω από τον μέσο όρο σου είναι (με διόρθωση όταν υπάρχουν λίγα δεδομένα).','Rate = bites per hour fished. × shows how far above or below your average it is (adjusted when data is thin).')}));
  Object.keys(TITLE).forEach(function(k){
    c.append(h('div',{class:'label',style:'margin-top:10px',text:TITLE[k]}));
    var mx=Math.max.apply(null,m.factors[k].map(function(x){ return x.m; }));
    m.factors[k].forEach(function(x,i){
      if(!x.h) return;
      c.append(h('div',{class:'bar'},h('span',{text:LAB[k](i)}),h('div',{class:'t'},h('i',{style:'width:'+Math.round(x.m/mx*100)+'%'})),h('span',{class:'n',text:'×'+x.m.toFixed(1)+' · '+(Math.round(x.h*10)/10)+'h/'+Math.round(x.c)})));
    });
  });
  return c;
}
function winTxt(w){ return w?pad(w.s)+':00–'+pad((w.e+1)%24)+':00':'–'; }
function compareCard(m){
  var c=h('div',{class:'card'}); c.append(h('h3',{text:T('Σύγκριση: γενική και προσωπική','Comparison: general vs personal')}));
  var f=last.fc, pl=last.place;
  if(!f||!pl){ c.append(h('p',{class:'note',text:T('Διάλεξε τοποθεσία και άνοιξε τη γενική πρόγνωση για να δεις τη σύγκριση.','Pick a location and open the general forecast to see the comparison.')})); return c; }
  c.append(h('p',{class:'note',text:pl.name+(m.ready?'':' · '+T('η προσωπική στήλη ξεκλειδώνει όταν υπάρχουν αρκετά δεδομένα','the personal column unlocks when there is enough data'))}));
  var head=h('div',{class:'cmp cmph'},h('span',{text:''}),h('span',{text:T('Γενική','General')}),h('span',{text:T('Προσωπική','Personal')})); c.append(head);
  var nowKey=f.nowLocal.slice(0,13)+':00', agree=0, tot=0;
  f.days.forEach(function(d){
    var p=m.ready?PP.day(m,d,d.date===f.nowLocal.slice(0,10)?nowKey:null):null, dt=new Date(d.date+'T12:00:00Z');
    var g=d.safe?d.best:null, pe=p&&p.safe?p.best:null;
    if(d.win&&p&&p.win){ tot++; if(d.win.s<=p.win.e&&p.win.s<=d.win.e) agree++; }
    var cell=function(v,w,cls){ return h('span',{class:'cmpc '+cls},h('b',{text:v==null?'–':String(v)}),h('small',{text:v==null?'':winTxt(w)})); };
    c.append(h('div',{class:'cmp'},h('span',{class:'cmpd',text:DAYS[dt.getUTCDay()]+' '+d.date.slice(8)+'/'+d.date.slice(5,7)}),cell(g,d.win,'g'),m.ready?cell(pe,p&&p.win,'p'):h('span',{class:'cmpc',text:'🔒'})));
  });
  if(m.ready) c.append(h('p',{class:'note',style:'margin:8px 0 0',text:(tot?T('Συμφωνούν στο παράθυρο ώρας σε ','They agree on the time window on ')+agree+'/'+tot+T(' ημέρες. ',' days. '):'')+T('Η προσωπική κλίμακα έχει μέσο όρο 50 (ο συνηθισμένος ρυθμός σου), οπότε δεν συγκρίνεται αριθμητικά με τη γενική: κοίτα τις ώρες. Όπου διαφωνούν, η προσωπική δείχνει ό,τι έχει πετύχει σε σένα.','The personal scale averages 50 (your usual rate), so it is not numerically comparable with the general one: compare the hours. Where they differ, the personal one shows what has worked for you.')}));
  return c;
}
/* v31z366: ο γενικός βαθμός της εφαρμογής στην πράξη: τσιμπήματα ανά ώρα ψαρέματος ανά ζώνη βαθμού */
function calibCard(){
  var cb=PP.calib(C.Store.get('trips'),C.Store.act(),{utcMin:C.utcMin(),misses:(C.Store.misses?C.Store.misses():[])}), c=h('div',{class:'card'});
  c.append(h('h3',{text:T('Ο βαθμός της εφαρμογής στην πράξη','The app’s score in practice')}));
  c.append(h('p',{class:'note',style:'margin:0 0 6px',text:T('Στην αρχή κάθε εξόδου κρατιέται ο βαθμός που έδινε η εφαρμογή για κάθε ώρα. Εδώ φαίνεται πόσα τσιμπήματα την ώρα είχες όταν ο βαθμός ήταν χαμηλός, μέτριος ή υψηλός.','At the start of each trip the app keeps the score it gave for each hour. Here you see your bites per hour when the score was low, medium or high.')}));
  var mx=Math.max.apply(null,cb.bins.map(function(b){ return b.rate||0; }).concat([0.01]));
  cb.bins.forEach(function(b,i){ var lb=[T('Βαθμός κάτω από 60','Score below 60'),T('Βαθμός 60–79','Score 60–79'),T('Βαθμός 80+','Score 80+')][i];
    c.append(h('div',{class:'bar'},h('span',{text:lb}),h('div',{class:'t'},h('i',{style:'width:'+Math.round((b.rate||0)/mx*100)+'%'})),h('span',{class:'n',text:b.h>0?(Math.round(b.rate*100)/100)+T('/ώρα','/h')+' · '+(Math.round(b.h*10)/10)+T(' ώρ.',' h'):'—'}))); });
  var v=!cb.ok?T('Χρειάζονται τουλάχιστον 6 έξοδοι με τον βαθμό καταγεγραμμένο και 5 ώρες ψαρέματος σε χαμηλό και σε υψηλό βαθμό (τώρα: ','Needs at least 6 trips with the score recorded and 5 fishing hours at both low and high scores (now: ')+cb.n+T(' έξοδοι).',' trips).')
    :cb.ratio===Infinity?'✓ '+T('Είχες τσιμπήματα μόνο στις ώρες με υψηλό βαθμό, καθόλου κάτω από 60. Ο βαθμός βοηθά.','You had bites only at well-scored hours, none below 60. The score helps.'):cb.ratio>=1.3?'✓ '+T('Στις ώρες με βαθμό 80+ είχες ','At hours scored 80+ you had ')+Math.round(cb.ratio*10)/10+T(' φορές τα τσιμπήματα των ωρών κάτω από 60. Ο βαθμός βοηθά.',' times the bites of hours below 60. The score helps.')
    :'✗ '+T('Δεν φαίνεται ουσιαστική διαφορά ανάμεσα σε υψηλό και χαμηλό βαθμό ακόμα. Για τα δικά σου νερά ο γενικός βαθμός ίσως δεν βοηθά· βασίσου περισσότερο στην προσωπική πρόγνωση.','No real difference between high and low scores yet. For your waters the general score may not help; rely more on your personal forecast.');
  c.append(h('p',{class:'note',style:'margin:8px 0 0;font-weight:600',text:v}));
  return c;
}
function render(){
  root.replaceChildren();
  var m=model();
  root.append(statusCard(m),calibCard(),compareCard(m));
  if(m.ready) root.append(patternsCard(m));
  var l=listCard(); if(l) root.append(l);
  root.append(formCard());
}
function setSeg(s){
  seg=s;
  var gen=$('fcGen'); if(gen) gen.hidden=s!=='gen'; root.hidden=s!=='mine'; var adv=$('fcAdv'); if(adv) adv.hidden=s!=='adv';
  Array.prototype.forEach.call(document.querySelectorAll('#fcSeg button'),function(b){ b.setAttribute('aria-pressed',String(b.dataset.s===s)); });
  if(s==='mine') render();
  if(s==='adv'&&window.AlkyonAdv) window.AlkyonAdv.render();
}
Array.prototype.forEach.call(document.querySelectorAll('#fcSeg button'),function(b){ b.addEventListener('click',function(){ setSeg(b.dataset.s); }); });
window.addEventListener('alkyon-fcloaded',function(e){ last=e.detail||last; if(seg==='mine'&&!root.hidden) render(); });
['trips','bites'].forEach(function(k){ C.Store.on(k,function(){ if(seg==='mine'&&!root.hidden&&!document.activeElement.closest('#fcMine')) render(); }); });
setSeg(seg==='mine'||seg==='adv'?seg:'gen');
})();
