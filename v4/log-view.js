/* Alkyon 4 · Ημερολόγιο: ψάρια, έξοδοι, στατιστικά */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, U=window.AlkyonUnits;
var st={grid:!!ls.get('alkyon-v4-loggrid',false),tab:ls.get('alkyon-v4-logtab','fish'),range:ls.get('alkyon-v4-logrange','30'),q:''}, root=null;
function S(){ return B.store; }
function bc(b){ return Math.max(1,Math.floor(+b.cnt)||1); }
function ms(b){ return Date.parse((b.date||'1970-01-01')+'T'+(b.time||'12:00')+':00'); }
function inRange(dateStr){ if(st.range==='all') return true; if(st.range==='custom'&&st.tab!=='spots'){ var cr=ls.get('alkyon-v4-logcr',{})||{}; return (!cr.a||dateStr>=cr.a)&&(!cr.b||dateStr<=cr.b); } var d=Date.parse(dateStr+'T12:00:00'); if(st.range==='year') return dateStr.slice(0,4)===String(new Date().getFullYear()); return Date.now()-d<=(+st.range)*86400000; }
var RANGES=[['all',T('Όλα','All')],['7',T('7 μέρες','7 days')],['30',T('30 μέρες','30 days')],['year',T('Φέτος','This year')]];
function nrm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function when(b,long){ if(!b.date) return ''; var td=new Date(), t=td.getFullYear()+'-'+B.pad(td.getMonth()+1)+'-'+B.pad(td.getDate()), dn=B.dayName(b.date,t), rel=dn!==B.dayName(b.date);
  return (rel?dn:(long?dn+' ':'')+B.dateShort(b.date)+(long&&b.date.slice(0,4)!==t.slice(0,4)?' '+b.date.slice(0,4):''))+(b.time?', '+b.time:''); }
/* 1.1.1: οι μικρές φωτογραφίες κρατιούνται στη μνήμη, ώστε όταν ξαναζωγραφίζεται η λίστα (π.χ. μετά από διαγραφή) να μην «αναβοσβήνουν» */
var TH={};
function thumb(b){ var w=h('span',{class:'th'}), k=b.id+':'+(b._u||0);
  if(!b.photo){ w.append(B.icon('fish')); return w; }
  var c=TH[b.id]; if(c&&c.k===k){ if(c.u) w.append(h('img',{src:c.u,alt:'',decoding:'sync'})); else w.append(B.icon('fish')); return w; }
  S().Photos.get(b.id).then(function(bl){ if(TH[b.id]&&TH[b.id].u) try{ URL.revokeObjectURL(TH[b.id].u); }catch(e){} var u=bl?URL.createObjectURL(bl):null; TH[b.id]={k:k,u:u}; w.replaceChildren(u?h('img',{src:u,alt:''}):B.icon('fish')); }).catch(function(){ w.replaceChildren(B.icon('fish')); });
  return w; }
/* πολλές αλλαγές μαζί (διαγραφή + ενημέρωση εξόδου + συγχρονισμός) → μία ζωγραφική, χωρίς να χάνεται η θέση της λίστας */
var rdF=0; function redraw(){ if(rdF) return; rdF=requestAnimationFrame(function(){ rdF=0; var y=window.scrollY; draw(); if(Math.abs(window.scrollY-y)>2) window.scrollTo(0,y); }); }
function sizeTxt(b){ var n=bc(b), a=[]; if(+b.kg) a.push(B.num(b.kg,+b.kg<10?2:1).replace(/([.,]\d)0$/,'$1')+' kg'+(n>1?T(' σύνολο',' total'):'')); if(+b.len) a.push(b.len+' cm'); return a.join(', '); }

function draw(){
  if(!root) return;
  var page=h('div',{class:'page'});
  page.append(h('div',{class:'top'},h('h1',{class:'lt',text:T('Ημερολόγιο','Logbook')}),syncBtn()));
  page.append(B.seg([['trips',T('Έξοδοι','Trips')],['spots',T('Σημεία','Spots')],['fish',T('Ψάρια','Catches')],['gear',T('Εργαλεία','Gear')],['stats',T('Στατιστικά','Stats')]],st.tab,function(v){ st.tab=v; ls.set('alkyon-v4-logtab',v); draw(); },T('Όψη ημερολογίου','Logbook view')));
  var chips=h('div',{class:'chips rng',role:'group','aria-label':T('Διάστημα','Period')});
  RANGES.forEach(function(r){ chips.append(h('button',{type:'button',class:'chip','aria-pressed':String(st.range===r[0]),text:r[1],onclick:function(){ st.range=r[0]; ls.set('alkyon-v4-logrange',r[0]); draw(); }})); });
  chips.append(h('button',{type:'button',class:'chip','aria-pressed':String(st.range==='custom'),text:T('Από–Έως','From–To'),onclick:function(){ st.range='custom'; ls.set('alkyon-v4-logrange','custom'); draw(); }}));
  if(st.tab!=='spots') page.append(chips);
  if(st.range==='custom'){ var cr=ls.get('alkyon-v4-logcr',{})||{}, ia=h('input',{type:'date',value:cr.a||'','aria-label':T('Από','From')}), ib=h('input',{type:'date',value:cr.b||'','aria-label':T('Έως','To')});
    function upd(){ ls.set('alkyon-v4-logcr',{a:ia.value||null,b:ib.value||null}); draw(); } ia.addEventListener('change',upd); ib.addEventListener('change',upd);
    page.append(h('div',{class:'g2 crange'},h('label',{class:'fld'},h('span',{text:T('Από','From')}),ia),h('label',{class:'fld'},h('span',{text:T('Έως','To')}),ib))); }
  if(st.tab==='fish') fish(page); else if(st.tab==='trips') trips(page); else if(st.tab==='spots') spots(page); else if(st.tab==='gear'&&B.gearLog) B.gearLog(page,inRange); else stats(page);
  root.replaceChildren(page);
}
function syncBtn(){
  var c=B.cloud, s=c&&c.session(); if(!s) return h('a',{class:'iconbtn',href:'#profile','aria-label':T('Σύνδεση για συγχρονισμό','Sign in to sync'),html:B.iconSvg('user')});
  var b=h('button',{class:'iconbtn',type:'button','aria-label':T('Συγχρονισμός τώρα','Sync now'),html:B.iconSvg('refresh'),onclick:function(){ b.classList.add('spin'); c.sync(true).then(function(){ b.classList.remove('spin'); var x=c.state(); B.toast(x.msg); }); }});
  return b;
}

/* ---------- ψάρια ---------- */
function fish(page){
  var q=h('input',{type:'search',placeholder:T('Αναζήτηση είδους, δολώματος, σημείου','Search species, bait, spot'),'aria-label':T('Αναζήτηση','Search'),value:st.q});
  var list=h('div');
  q.addEventListener('input',function(){ st.q=q.value; fill(); });
  var vt=h('button',{class:'iconbtn sm vtog',type:'button','aria-pressed':String(!!st.grid),'aria-label':st.grid?T('Προβολή λίστας','List view'):T('Προβολή φωτογραφιών','Photo view'),html:st.grid?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',onclick:function(){ st.grid=!st.grid; ls.set('alkyon-v4-loggrid',st.grid); draw(); }});
  page.append(h('div',{class:'srow'},h('div',{class:'search'},B.icon('search'),q),vt),list);
  function fill(){
    var qq=nrm(st.q), a=S().raw('bites').filter(function(b){ return !b.gear&&inRange(b.date||'')&&(!qq||nrm([b.species,b.bait,b.tech,b.place,b.notes].join(' ')).indexOf(qq)>=0); }).sort(function(a,b){ return ms(b)-ms(a); });
    if(st.nosp){ st.nosp=false; var nsA=a.filter(function(b){ return !b.species&&!b.miss&&!B.pest(b); }); a=nsA.concat(a.filter(function(b){ return nsA.indexOf(b)<0; })); }
    if(!a.length){ list.replaceChildren(h('div',{class:'card empty'},h('h3',{text:st.q?T('Δεν βρέθηκε ψάρι','No catch found'):T('Κανένα ψάρι σε αυτό το διάστημα','No catches in this period')}),h('p',{text:T('Πάτα το + για να καταγράψεις ψάρι.','Tap + to log a catch.')}),h('button',{class:'btn pri',type:'button',text:T('Νέο ψάρι','New catch'),onclick:function(){ B.biteForm(); }}))); return; }
    var pst=a.filter(function(b){ return B.pest(b); }).length, lost=a.filter(function(b){ return b.miss&&!B.pest(b); }).length, a2=a.filter(function(b){ return !b.miss&&!B.pest(b); }), n=a2.reduce(function(s,b){ return s+bc(b); },0), kg=a2.reduce(function(s,b){ return s+(+b.kg||0); },0);
    if(st.grid){ var g=h('div',{class:'phgrid'}), ph=a.filter(function(b){ return b.photo&&!b.miss; });
      if(!ph.length) g.append(h('p',{class:'sub',style:{gridColumn:'1/-1',margin:'8px 4px'},text:T('Δεν υπάρχουν ψάρια με φωτογραφία σε αυτό το διάστημα.','No catches with a photo in this period.')}));
      ph.slice(0,300).forEach(function(b){ var c=h('button',{type:'button',class:'phcell','aria-label':(b.species||'')+' '+(b.date||''),onclick:function(){ detail(b); }},h('span',{class:'phcap',text:(b.species||'')+(+b.kg?' · '+B.num(b.kg,1)+' kg':'')}));
        S().Photos.get(b.id).then(function(bl){ if(bl) c.style.backgroundImage='url('+URL.createObjectURL(bl)+')'; }).catch(function(){}); g.append(c); });
      list.replaceChildren(h('p',{class:'sum',text:n+' '+T(n===1?'ψάρι':'ψάρια',n===1?'catch':'catches')+(kg?', '+B.num(kg,1)+' kg':'')+' · '+ph.length+T(' με φωτογραφία',' with a photo')}),g); return; }
    var l=h('div',{class:'list'});
    a.slice(0,300).forEach(function(b){
      var sub=[sizeTxt(b),b.place,b.troll&&b.troll.m==='bottom'?T('Συρτή βυθού','Bottom trolling')+(b.troll.leads?' '+b.troll.leads+T(' μολ.',' leads'):''):b.troll?T('Συρτή αφρού','Surface trolling'):''].filter(Boolean).join(' · '); /* 1.8.8 */
      var pz=B.pest(b), row=h('button',{class:'li fishrow'+(b.miss?' miss':'')+(pz?' pest':''),type:'button',onclick:function(){ detail(b); }},thumb(b),h('span',{class:'tx'},h('b',{class:(!pz&&!b.miss&&!b.species)?'nosp':'',text:pz?'🐡 '+(b.pest==='stolen'?T('Έφαγε το δόλωμα / έκοψε','Bait taken / cut'):(b.species||T('Λαγοκέφαλος','Toadfish'))):b.miss?T('Χαμένο τσίμπημα','Lost bite')+(b.species?': '+b.species:''):(b.species||T('+ Πρόσθεσε είδος','+ Add species'))+(bc(b)>1?' ×'+bc(b):'')}),h('small',{text:sub||' '})),h('span',{class:'when',text:when(b)}),b.rel?h('span',{class:'relb',title:T('Αφέθηκε ελεύθερο','Released'),text:'↩'}):null); l.append(B.swipeDel(row,function(){ S().delUndo('bites',b,b.miss?T('Το χαμένο τσίμπημα διαγράφηκε.','Lost bite deleted.'):T('Διαγράφηκε: ','Deleted: ')+(b.species||T('ψάρι','catch'))); }));
    });
    list.replaceChildren(h('p',{class:'sum',text:n+' '+T(n===1?'ψάρι':'ψάρια',n===1?'catch':'catches')+(kg?', '+B.num(kg,1)+' kg':'')+(lost?', '+lost+' '+T(lost===1?'χαμένο':'χαμένα','lost'):'')+(pst?' · 🐡 '+pst+T(' λαγοκέφαλοι',' toadfish'):'')}),l);
  }
  fill();
}
function detail(b){
  var body=h('div',{class:'det'});
  if(B.pest(b)) body.append(h('p',{class:'lawnote warn pestw',text:PEST_W()}));
  var keys=S().phKeys(b); if(keys.length){ var gal=h('div',{class:'gal'}); keys.forEach(function(k){ S().Photos.get(k).then(function(bl){ if(bl) gal.append(h('img',{src:URL.createObjectURL(bl),alt:b.species||''})); }).catch(function(){}); }); body.append(gal); }
  var rows=[[T('Πότε','When'),when(b,true)],[T('Μέγεθος','Size'),sizeTxt(b)||'–'],[T('Πού','Where'),b.place||(typeof b.lat==='number'?b.lat.toFixed(5)+', '+b.lon.toFixed(5):'–')],[T('Βάθος','Depth'),b.depth!=null?(window.AlkyonUnits&&AlkyonUnits.depth?AlkyonUnits.depth(b.depth):b.depth+' m'):'–'],
    [T('Δόλωμα','Bait'),b.bait||'–'],[T('Τεχνική','Technique'),b.tech||'–'],
    b.troll?[T('Συρτή','Trolling'),[b.troll.kn!=null?B.num(b.troll.kn,1)+' kn':'',b.troll.hd!=null?b.troll.hd+'°':'',b.troll.lead?b.troll.lead+' g':'',b.troll.leads?b.troll.leads+T(' μολύβια',' leads')+(b.troll.auto?T(' (αυτόματα)',' (auto)'):'')+(b.troll.dl!=null?' · ~'+Math.round(b.troll.dl/1.83)+T(' οργ.',' fm'):''):'',b.troll.lb!=null?T('δόλωμα ~','lure ~')+b.troll.lb+T(' m πίσω από τη βάρκα',' m behind the boat'):''].filter(Boolean).join(' · ')||'✓']:null,
    [T('Άνεμος','Wind'),b.wind!=null?U.wind(b.wind)+(b.hist?' ('+T('εκτίμηση','estimate')+')':''):'–'],[T('Κύμα','Waves'),b.wave!=null?U.wave(b.wave):'–'],[T('Πίεση','Pressure'),b.press!=null?U.press(b.press):'–'],[T('Θάλασσα','Sea temp'),b.sst!=null?U.temp(b.sst):'–']];
  body.append(h('div',{class:'card'},h('div',{class:'rows one'},rows.filter(function(r,i){ return r&&(i<3||r[1]!=='–'); }).map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  if(b.tk&&b.tk.length){ var tkn=b.tk.map(function(id){ var x=S().get('tackle',id); return x?x.name:null; }).filter(Boolean); if(tkn.length) body.append(h('div',{class:'card'},h('h2',{text:T('Εξοπλισμός','Tackle')}),h('p',{class:'p',text:tkn.join(', ')}))); }
  if(b.notes) body.append(h('div',{class:'card'},h('p',{class:'p',text:b.notes})));
  if(window.AlkyonBiteWx&&!b.gear){ var wx=h('div',{class:'card bwxcard'},h('h2',{text:T('Καιρός γύρω από το πιάσιμο','Weather around the catch')})); try{ wx.append(AlkyonBiteWx.slot(b)); body.append(wx); }catch(e){} }
  var acts=h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Επεξεργασία','Edit'),onclick:function(){ sh.close(true); B.biteForm(b); }}));
  if(typeof b.lat==='number') acts.append(h('button',{class:'btn',type:'button',text:T('Στον χάρτη','On the map'),onclick:function(){ sh.close(true); B.mapGo(b.lat,b.lon,15); }}));
  /* 1.6.1: διόρθωση του σημείου στον χάρτη· στη συρτή η εφαρμογή μαθαίνει πόσο πίσω πάει το δόλωμα */
  if(typeof b.lat==='number'&&B.mapPick) acts.append(h('button',{class:'btn',type:'button',text:T('Διόρθωση σημείου','Fix position'),onclick:function(){ sh.close(true); var back=location.hash||'#log';
    B.mapPick({lat:b.lat,lon:b.lon,z:16,back:back,title:T('Πού ήταν το ψάρι;','Where was the catch?'),saveLabel:T('Αποθήκευση','Save'),onPick:function(la,lo){ var cur=S().get('bites',b.id); if(!cur) return;
      var msg=B.troll&&B.troll.calibrate?B.troll.calibrate(cur,la,lo):null; S().save('bites',Object.assign({},cur,{lat:+la.toFixed(5),lon:+lo.toFixed(5)},cur.troll&&typeof cur.boatLat==='number'?{troll:Object.assign({},cur.troll,{fixed:1})}:{})); B.emit('store','alkyon-bites');
      B.toast(msg||T('Το σημείο διορθώθηκε.','Position fixed.')); }}); }}));
  if(typeof b.lat==='number'&&B.goTo) acts.append(h('button',{class:'btn',type:'button',text:T('Πήγαινε εκεί','Go there'),onclick:function(){ sh.close(true); B.goTo(b.lat,b.lon,b.species||b.place||''); }}));
  if(!b.miss&&B.cards) acts.append(h('button',{class:'btn',type:'button',text:T('Κάρτα','Card'),onclick:function(){ B.cards.fish(b); }}));
  if(!b.miss&&B.commShare) acts.append(h('button',{class:'btn',type:'button',disabled:B.commShared(b.id),text:B.commShared(b.id)?T('✓ Στην κοινότητα','✓ Shared'):T('Κοινότητα','Community'),onclick:function(){ sh.close(true); B.commShare(b); }}));
  body.append(acts);
  /* v31z549: διαγραφή και από εδώ (π.χ. πατώντας το ψάρι πάνω στον χάρτη), με «Αναίρεση» */
  body.append(h('div',{class:'acts'},h('button',{class:'btn del',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ sh.close(true); S().delUndo('bites',b,(b.miss?T('Διαγράφηκε το χαμένο.','Lost fish deleted.'):T('Διαγράφηκε: ','Deleted: ')+(b.species||T('ψάρι','catch'))+'.')); }})));
  var sh=B.sheet({title:(b.species||T('Ψάρι','Catch'))+(bc(b)>1?' ×'+bc(b):''),body:body});
}

/* ---------- έξοδοι ---------- */
function dur(t){ return t.startMs&&t.endMs?(t.endMs-t.startMs-(t.pauseMs||0))/3600000:null; }
/* 1.4.0: παλιά έξοδος (χωρίς καταγραφή GPS): ίδια στοιχεία με την κλασική, για εξόδους που έγιναν χωρίς την εφαρμογή */
function pastTrip(){ var sh, td=new Date(), today=td.getFullYear()+'-'+B.pad(td.getMonth()+1)+'-'+B.pad(td.getDate()), prof=B.prof?B.prof():'boat';
  var dt=h('input',{type:'date',value:today,max:today,'aria-label':T('Ημερομηνία','Date')});
  var sp=h('input',{type:'text',maxlength:'60',list:'ptSpots',placeholder:T('Επίλεξε ή γράψε','Pick or type')});
  var spl=h('datalist',{id:'ptSpots'}); S().raw('spots').concat(S().raw('trips')).forEach(function(x){ var n=(x.name||x.spot||'').trim(); if(n&&!spl.querySelector('option[value="'+n.replace(/"/g,'')+'"]')) spl.append(h('option',{value:n})); });
  var tc=h('input',{type:'text',maxlength:'40',list:'ptTech',placeholder:T('π.χ. Βυθού, Jigging, Συρτή','e.g. Bottom, Jigging, Trolling')});
  var tcl=h('datalist',{id:'ptTech'}); var seenT={}; S().raw('trips').concat(S().bites()).forEach(function(x){ var v=(x.tech||'').trim(); if(v&&!seenT[v]){ seenT[v]=1; tcl.append(h('option',{value:v})); } });
  var t0=h('input',{type:'time','aria-label':T('Ώρα έναρξης','Start time')}), t1=h('input',{type:'time','aria-label':T('Ώρα τέλους','End time')});
  var sps=h('input',{type:'text',maxlength:'80',placeholder:T('π.χ. σαργός, λιθρίνι','e.g. white bream, pandora')});
  var cn=h('input',{type:'number',min:'0',step:'1',inputmode:'numeric',value:'0'}), kg=h('input',{type:'number',min:'0',step:'0.1',inputmode:'decimal',value:'0'});
  var nt=h('textarea',{maxlength:'500',rows:'3',placeholder:T('Δόλωμα, άνεμος, τι δούλεψε','Bait, wind, what worked')}), msg=h('p',{class:'err',role:'alert'});
  var pseg=B.seg([['boat',T('Βάρκα','Boat')],['shore',T('Ακτή','Shore')],['spear',T('Τουφέκι','Spear')],['lake',T('Λίμνη','Lake')]],prof,function(v){ prof=v; },T('Τύπος','Type'));
  function f(l,el){ return h('label',{class:'fld'},h('span',{text:l}),el); }
  function save(){ msg.textContent=''; var d=dt.value; if(!/^\d{4}-\d\d-\d\d$/.test(d)){ msg.textContent=T('Διάλεξε ημερομηνία.','Pick a date.'); return; } if(d>today){ msg.textContent=T('Η ημερομηνία είναι στο μέλλον.','The date is in the future.'); return; }
    var rec={date:d,spot:sp.value.trim(),prof:prof,tech:tc.value.trim(),species:sps.value.trim(),count:Math.max(0,Math.round(+cn.value||0)),kg:Math.max(0,+kg.value||0),notes:nt.value.trim(),manual:true};
    if(t0.value&&t1.value){ var a=new Date(d+'T'+t0.value).getTime(), b=new Date(d+'T'+t1.value).getTime(); if(b<=a) b+=86400000; rec.startMs=a; rec.endMs=b; }
    S().save('trips',rec); sh.close(); B.toast(T('Η έξοδος αποθηκεύτηκε.','Trip saved.')); }
  sh=B.sheet({title:T('Παλιά έξοδος','Past trip'),body:h('div',{class:'bform pasttrip'},
    h('p',{class:'sub',text:T('Για έξοδο που έκανες χωρίς να την καταγράψεις στην εφαρμογή. Τα ψάρια μπορείς να τα προσθέσεις και ξεχωριστά με «Νέο ψάρι» και την ίδια ημερομηνία.','For a trip you made without logging it in the app. You can also add catches separately with “New catch” on the same date.')}),
    pseg,f(T('Ημερομηνία','Date'),dt),f(T('Σημείο','Spot'),sp),spl,h('div',{class:'inrow'},f(T('Από','From'),t0),f(T('Έως','To'),t1)),f(T('Τεχνική','Technique'),tc),tcl,f(T('Είδη','Species'),sps),
    h('div',{class:'inrow'},f(T('Ψάρια (τεμάχια)','Fish (count)'),cn),f(T('Βάρος (kg)','Weight (kg)'),kg)),f(T('Σημειώσεις','Notes'),nt),msg,
    h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση εξόδου','Save trip'),onclick:save}))}); }
B.pastTrip=pastTrip;
function pastBtn(){ return h('button',{class:'btn',type:'button',text:'+ '+T('Παλιά έξοδος','Past trip'),onclick:pastTrip}); }
/* 1.9.2: μικρός χάρτης εξόδου (διαδρομή + ψάρια), χωρίς πλακίδια: δουλεύει και χωρίς σήμα */
function tripBites(t){ return S().bites().filter(function(b){ return (t.sid&&b.trip===t.sid)||(t.startMs&&ms(b)>=t.startMs-600000&&ms(b)<=t.endMs+600000); }); }
function miniMap(t,bs,W,H){ var tr=(t.track||[]).filter(function(p){ return p&&isFinite(p[0])&&isFinite(p[1]); }), pts=tr.slice();
  bs.forEach(function(b){ if(isFinite(+b.lat)&&isFinite(+b.lon)&&b.lat) pts.push([+b.lat,+b.lon]); });
  var cv=h('canvas',{class:'tmap','aria-hidden':'true'}), dpr=Math.min(2,window.devicePixelRatio||1); cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px';
  var g=cv.getContext('2d'); if(!g) return cv; g.scale(dpr,dpr);
  var dark=document.documentElement.classList.contains('night')||matchMedia('(prefers-color-scheme: dark)').matches&&document.documentElement.getAttribute('data-theme')!=='light';
  var bg=g.createLinearGradient(0,0,W,H); bg.addColorStop(0,dark?'#0c3346':'#1d6a88'); bg.addColorStop(1,dark?'#06202d':'#0b3a52'); g.fillStyle=bg; g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(255,255,255,.07)'; g.lineWidth=1; for(var k=1;k<5;k++){ g.beginPath(); g.moveTo(0,H*k/5+Math.sin(k)*6); g.bezierCurveTo(W*.3,H*k/5-8,W*.6,H*k/5+8,W,H*k/5-4); g.stroke(); }
  if(!pts.length){ g.fillStyle='rgba(255,255,255,.55)'; g.font='600 11px '+getComputedStyle(document.body).fontFamily; g.textAlign='center'; g.fillText(T('χωρίς','no'),W/2,H/2-3); g.fillText(T('διαδρομή','route'),W/2,H/2+11); return cv; }
  var la=pts.map(function(p){ return p[0]; }), lo=pts.map(function(p){ return p[1]; }), a0=Math.min.apply(null,la), a1=Math.max.apply(null,la), o0=Math.min.apply(null,lo), o1=Math.max.apply(null,lo);
  var mn=0.012; if(a1-a0<mn){ var mc=(a0+a1)/2; a0=mc-mn/2; a1=mc+mn/2; } if(o1-o0<mn){ var oc=(o0+o1)/2; o0=oc-mn/2; o1=oc+mn/2; }
  var kx=Math.cos((a0+a1)/2*Math.PI/180), sw=Math.max((o1-o0)*kx,1e-3), shh=Math.max(a1-a0,1e-3), pad=12, sc=Math.min((W-2*pad)/sw,(H-2*pad)/shh);
  var X=function(p){ return W/2+((p[1]-(o0+o1)/2)*kx)*sc; }, Y=function(p){ return H/2-(p[0]-(a0+a1)/2)*sc; };
  /* 1.9.3: η στεριά από την ακτογραμμή που έχει ήδη η εφαρμογή (OSM, ~250 m) */
  var XL=window.AlkyonExposure; if(XL&&XL.isLand){ var st=3, cx=(o0+o1)/2, cy=(a0+a1)/2, lw=Math.ceil(W/st), lh=Math.ceil(H/st), lc=document.createElement('canvas'); lc.width=lw; lc.height=lh; var lg=lc.getContext('2d'), any=false;
    if(lg){ var im=lg.createImageData(lw,lh), col=dark?[59,52,38]:[216,201,163];
      for(var yy=0;yy<lh;yy++) for(var xx=0;xx<lw;xx++){ var la2=cy-((yy+.5)*st-H/2)/sc, lo2=cx+((xx+.5)*st-W/2)/sc/kx, v=-1; try{ v=XL.isLand(la2,lo2); }catch(e){} if(v===1){ var o=(yy*lw+xx)*4; im.data[o]=col[0]; im.data[o+1]=col[1]; im.data[o+2]=col[2]; im.data[o+3]=255; any=true; } }
      /* μικρή εικόνα, μεγεθυμένη με εξομάλυνση: η ακτή βγαίνει στρογγυλή, όχι σκαλοπάτια */
      /* 1.9.7: ομαλή ακτή: μεγέθυνση με θόλωμα και μετά «κατώφλι» στη διαφάνεια → στρογγυλές καμπύλες αντί για σκαλοπάτια */
      if(any){ lg.putImageData(im,0,0); var oc=document.createElement('canvas'), Wp=Math.round(W*dpr), Hp=Math.round(H*dpr); oc.width=Wp; oc.height=Hp; var og=oc.getContext('2d'), cp=0.0025*sc*dpr;
        if(og){ og.imageSmoothingEnabled=true; og.imageSmoothingQuality='high'; if('filter' in og) og.filter='blur('+Math.max(1.5,Math.min(14,cp*0.55)).toFixed(1)+'px)'; og.drawImage(lc,0,0,lw*st*dpr,lh*st*dpr); og.filter='none';
          try{ var od=og.getImageData(0,0,Wp,Hp), dd=od.data; for(var q=3;q<dd.length;q+=4){ var al=dd[q]; dd[q]=al>150?255:al>110?Math.round((al-110)*6.4):0; if(dd[q]){ dd[q-3]=col[0]; dd[q-2]=col[1]; dd[q-1]=col[2]; } } og.putImageData(od,0,0); }catch(e){}
          g.save(); g.setTransform(1,0,0,1,0,0); g.drawImage(oc,0,0); g.restore(); } } } }
  if(tr.length>1){ g.lineJoin='round'; g.lineCap='round'; g.strokeStyle='rgba(0,0,0,.35)'; g.lineWidth=4.5; g.beginPath(); tr.forEach(function(p,i){ i?g.lineTo(X(p),Y(p)):g.moveTo(X(p),Y(p)); }); g.stroke();
    g.strokeStyle='#FFD166'; g.lineWidth=2.4; g.beginPath(); tr.forEach(function(p,i){ i?g.lineTo(X(p),Y(p)):g.moveTo(X(p),Y(p)); }); g.stroke();
    g.fillStyle='#fff'; g.beginPath(); g.arc(X(tr[0]),Y(tr[0]),3.2,0,7); g.fill(); }
  bs.forEach(function(b){ if(!(isFinite(+b.lat)&&b.lat)) return; var p=[+b.lat,+b.lon]; g.fillStyle=b.miss?'#F06A55':b.pest?'#8C7BD9':'#3DBE85'; g.strokeStyle='#fff'; g.lineWidth=1.6; g.beginPath(); g.arc(X(p),Y(p),4.6,0,7); g.fill(); g.stroke(); });
  return cv; }
function trips(page){
  /* ψαροντούφεκο: καταδύσεις από ρολόι (FIT/UDDF), ίδια λειτουργία με την κλασική (divelog.js) */
  if(window.AlkyonDiveLog&&B.prof()==='spear'){ page.append(h('div',{id:'l-trips',class:'dives'},h('div',{id:'tripList'}))); setTimeout(function(){ try{ AlkyonDiveLog.render(); }catch(e){} },0); }
  var a=S().raw('trips').filter(function(t){ return inRange(t.date||''); }).sort(function(x,y){ return (y.startMs||Date.parse(y.date))-(x.startMs||Date.parse(x.date)); });
  if(!a.length){ page.append(h('div',{class:'card empty'},h('h3',{text:T('Καμία έξοδος σε αυτό το διάστημα','No trips in this period')}),h('p',{text:T('Οι έξοδοι ξεκινούν από τον χάρτη με «Έναρξη εξόδου».','Trips start from the map with “Start a trip”.')}),h('div',{class:'inrow'},h('a',{class:'btn pri',href:'#trip',text:T('Έναρξη εξόδου','Start a trip')}),pastBtn()))); return; }
  var tot=a.reduce(function(s,t){ return s+(dur(t)||0); },0), n=a.reduce(function(s,t){ return s+(+t.count||0); },0);
  page.append(h('p',{class:'sum',text:a.length+' '+T(a.length===1?'έξοδος':'έξοδοι',a.length===1?'trip':'trips')+', '+B.num(tot,0)+T(' ώρες, ',' hours, ')+n+' '+T('ψάρια','catches')+(function(){ /* 1.8.33: πόσα από αυτά με παραγάδι/δίχτυ/κιούρτο, για να συμφωνεί με «Ψάρια» */ var sid={}; a.forEach(function(t){ if(t.sid) sid[t.sid]=1; }); var g=S().raw('bites').filter(function(b){ return !b.deleted&&!b.miss&&b.gear&&sid[b.trip]; }).reduce(function(x,b){ return x+Math.max(1,Math.floor(+b.cnt)||1); },0); return g?T(' ('+g+' με εργαλεία)',' ('+g+' from gear)'):''; })()}));
  var l=h('div',{class:'list'});
  /* 1.9.7: έξοδοι κάτω από 5 λεπτά, χωρίς ψάρια και χωρίς διαδρομή (δοκιμές) μαζεύονται σε ένα κουμπί· δεν σβήνεται τίποτα */
  var isShort=function(t){ var d=dur(t); return d!=null&&d<5/60&&!(+t.count)&&!(t.track&&t.track.length>1)&&!tripBites(t).length; };
  var shorts=a.filter(isShort), shBox=null; if(shorts.length) a=a.filter(function(t){ return !isShort(t); });
  a.slice(0,200).forEach(function(t){ var d=dur(t), c=+t.count||0;
    /* 1.9.2: κάρτα εξόδου με μικρό χάρτη και τα είδη */
    var bs=tripBites(t), sp={}; bs.forEach(function(b){ if(b.species&&!b.miss) sp[b.species]=(sp[b.species]||0)+bc(b); });
    var chips=Object.keys(sp).sort(function(x,y){ return sp[y]-sp[x]; }).slice(0,3).map(function(k){ return h('span',{class:'tchip',text:k+(sp[k]>1?' ×'+sp[k]:'')}); });
    var row=h('button',{class:'li triprow tcard',type:'button',onclick:function(){ tripDetail(t); }},miniMap(t,bs,96,104),h('span',{class:'tx'},h('b',null,h('i',{class:'tpi',html:B.profBadge?B.profBadge(t.prof||'boat'):''}),document.createTextNode((t.spot||B.PROF[t.prof||'boat']||'')+(t.priv?' 🔒':''))),h('small',{text:[when(t),d!=null?B.num(d,1)+' h':'',+t.km?B.num(t.km,1)+' km':'',+t.kg?B.num(t.kg,1)+' kg':''].filter(Boolean).join(' · ')}),chips.length?h('span',{class:'tchips'},chips):null),h('span',{class:'tc'+(c?'':' z'),text:String(c)})); l.append(B.swipeDel(row,function(){ S().delUndo('trips',t,T('Η έξοδος διαγράφηκε. Τα ψάρια της μένουν.','Trip deleted. Its catches stay.')); })); l.append(B.swipeDel(row,function(){ S().delUndo('trips',t,T('Η έξοδος διαγράφηκε. Τα ψάρια της μένουν.','Trip deleted. Its catches stay.')); }));
  });
  page.append(l);
  if(shorts.length){ var sl=h('div',{class:'list',hidden:true}); shorts.forEach(function(t){ var r=h('button',{class:'li triprow',type:'button',onclick:function(){ tripDetail(t); }},h('span',{class:'tx'},h('b',{text:t.spot||B.PROF[t.prof||'boat']||''}),h('small',{text:when(t)+' · '+B.num((dur(t)||0)*60,0)+' min'})),B.icon('chev')); sl.append(B.swipeDel(r,function(){ S().delUndo('trips',t,T('Η έξοδος διαγράφηκε.','Trip deleted.')); })); });
    var sb=h('button',{class:'btn full shortbtn',type:'button',text:T('Μικρές έξοδοι (','Short trips (')+shorts.length+T(') · κάτω από 5 λεπτά, χωρίς ψάρια',') · under 5 min, no catches'),onclick:function(){ sl.hidden=!sl.hidden; }}); page.append(sb,sl); }
  page.append(h('div',{class:'inrow pastrow'},pastBtn()));
}

/* ---------- σημεία ---------- */
function spots(page){
  var q=h('input',{type:'search',placeholder:T('Αναζήτηση σημείου','Search spots'),'aria-label':T('Αναζήτηση','Search'),value:st.sq||''}), list=h('div');
  q.addEventListener('input',function(){ st.sq=q.value; fill(); });
  page.append(h('div',{class:'srow'},h('div',{class:'search'},B.icon('search'),q),B.importSheet?h('button',{class:'iconbtn sm vtog',type:'button','aria-label':T('Εισαγωγή από plotter','Import from plotter'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>',onclick:function(){ B.importSheet(); }}):null),list);
  function near(sp){ return S().raw('bites').filter(function(b){ return !b.miss&&!B.pest(b)&&(b.place===sp.name||(typeof b.lat==='number'&&Math.abs(b.lat-sp.lat)<0.0025&&Math.abs(b.lon-sp.lon)<0.003)); }).reduce(function(s,b){ return s+bc(b); },0); }
  function fill(){ var qq=nrm(st.sq||''), a=S().raw('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'&&(!qq||nrm([x.name,x.type,x.notes].join(' ')).indexOf(qq)>=0); });
    if(!a.length){ list.replaceChildren(h('div',{class:'card empty'},h('h3',{text:qq?T('Δεν βρέθηκε σημείο','No spot found'):T('Δεν έχεις αποθηκεύσει σημεία','No saved spots yet')}),h('p',{text:T('Κράτα πατημένο τον χάρτη και διάλεξε «Σημείο εδώ», ή πάτα το αστέρι στον χάρτη για τη θέση σου.','Long-press the map and choose “Spot here”, or tap the star on the map for your position.')}),h('a',{class:'btn pri',href:'#map',text:T('Στον χάρτη','Open the map')}))); return; }
    var me=B.lastPos(), D=function(x){ if(!me) return null; var R=Math.PI/180, dl=(x.lat-me.lat)*R, dn=(x.lon-me.lon)*R, y=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(me.lat*R)*Math.cos(x.lat*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742*Math.asin(Math.min(1,Math.sqrt(y))); };
    a=a.map(function(x){ return {x:x,d:D(x),n:near(x)}; }).sort(function(p,r){ return p.d!=null&&r.d!=null?p.d-r.d:String(p.x.name).localeCompare(String(r.x.name)); });
    var l=h('div',{class:'list'});
    a.forEach(function(o){ var x=o.x, row=h('button',{class:'li',type:'button',onclick:function(){ if(B.spotSheet) B.spotSheet(x); else B.mapGo(x.lat,x.lon,15); }},h('span',{class:'ic'},B.icon('pin')),h('span',{class:'tx'},h('b',{text:x.name||T('Σημείο','Spot')}),h('small',{text:[x.type,x.depth!=null&&x.depth!==''?x.depth+' m':'',o.n?o.n+' '+T(o.n===1?'ψάρι':'ψάρια',o.n===1?'catch':'catches'):''].filter(Boolean).join(' · ')||' '})),o.d!=null?h('span',{class:'when',text:o.d<10?B.num(o.d,1)+' km':Math.round(o.d)+' km'}):null,B.icon('chev'));
      l.append(B.swipeDel(row,function(){ S().delUndo('spots',x,T('Διαγράφηκε το σημείο «','Deleted spot “')+(x.name||'')+T('». Τα ψάρια μένουν.','”. Catches stay.')); })); });
    list.replaceChildren(h('p',{class:'sum',text:a.length+' '+T(a.length===1?'σημείο':'σημεία',a.length===1?'spot':'spots')+' · '+T('σύρε αριστερά για διαγραφή','swipe left to delete')}),l); }
  fill();
}
function tripDetail(t){
  var body=h('div',{class:'det'}), d=dur(t);
  var bs=S().bites().filter(function(b){ return (t.sid&&b.trip===t.sid)||(t.startMs&&ms(b)>=t.startMs-600000&&ms(b)<=t.endMs+600000); }).sort(function(a,b){ return ms(a)-ms(b); });
  var rows=[[T('Πότε','When'),when(t,true)+(t.startMs?' – '+new Date(t.endMs).toTimeString().slice(0,5):'')],[T('Διάρκεια','Duration'),d!=null?B.num(d,1)+' h':'–'],[T('Ψάρια','Catches'),String(+t.count||bs.reduce(function(s,b){ return s+bc(b); },0))],[T('Κιλά','Kilos'),+t.kg?B.num(t.kg,1)+' kg':'–'],[T('Τύπος','Type'),B.PROF[t.prof||'boat']||'']];
  /* 1.8.8: τεχνική της εξόδου (από την έξοδο ή από τα ψάρια της, π.χ. «Συρτή βυθού») */
  var tks=[]; [t.tech].concat(bs.map(function(b){ return b.tech||(b.troll?(b.troll.m==='bottom'?T('Συρτή βυθού','Deep / bottom trolling'):T('Συρτή αφρού','Surface trolling')):''); })).forEach(function(v){ v=(v||'').trim(); if(v&&tks.indexOf(v)<0) tks.push(v); }); if(tks.length) rows.splice(5,0,[T('Τεχνική','Technique'),tks.join(', ')]);
  if(+t.km) rows.push([T('Απόσταση','Distance'),window.AlkyonUnits?AlkyonUnits.dist(+t.km):B.num(t.km,1)+' km']);
  var cst=B.cards?B.cards.costOf(t):0, nf=+t.count||0; if(cst) rows.push([T('Κόστος','Cost'),'€'+B.num(cst,cst%1?2:0)+(nf?' · €'+B.num(cst/nf,2)+T(' ανά ψάρι',' per fish'):'')+(+t.kg?' · €'+B.num(cst/+t.kg,2)+'/kg':'')]);
  if((t.track&&t.track.length>1)||bs.some(function(b){ return b.lat; })){ var mw=Math.min(520,(window.innerWidth||390)-32); body.append(h('div',{class:'tstory'},miniMap(t,bs,mw,Math.round(mw*0.56)),h('div',{class:'tslg'},h('span',null,h('i',{style:{background:'#FFD166'}}),T('διαδρομή','route')),h('span',null,h('i',{style:{background:'#3DBE85'}}),T('ψάρι','fish')),h('span',null,h('i',{style:{background:'#F06A55'}}),T('χαμένο','lost')),h('span',null,h('i',{style:{background:'#8C7BD9'}}),T('λαγοκέφαλος','pufferfish'))))); }
  body.append(h('div',{class:'card'},h('div',{class:'rows one'},rows.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  if(bs.length){ var l=h('div',{class:'list'}); bs.forEach(function(b){ l.append(h('button',{class:'li fishrow',type:'button',onclick:function(){ sh.close(true); detail(b); }},thumb(b),h('span',{class:'tx'},h('b',{text:(b.species||(b.miss?T('Χαμένο τσίμπημα','Lost bite'):T('+ Πρόσθεσε είδος','+ Add species')))+(bc(b)>1?' ×'+bc(b):'')}),h('small',{text:[b.time,sizeTxt(b),b.tech||(b.troll?(b.troll.m==='bottom'?T('Συρτή βυθού','Bottom trolling'):T('Συρτή αφρού','Surface trolling')):''),b.troll&&b.troll.leads?b.troll.leads+T(' μολύβια',' leads'):'',b.troll&&b.troll.fath?'~'+Math.round(b.troll.fath)+T(' οργ.',' fm'):'',b.troll&&b.troll.kn?B.num(b.troll.kn,1)+' kn':''].filter(Boolean).join(' · ')})))); }); /* 1.9.3: η «ιστορία» της εξόδου σε χρονολόγιο: ξεκίνημα → ψάρια με την ώρα τους → επιστροφή */
    l.classList.add('tline'); [].forEach.call(l.children,function(r){ r.classList.add('tlr'); var b0=bs[[].indexOf.call(l.children,r)]; if(b0) r.classList.add(b0.miss?'tl-miss':b0.pest?'tl-pest':'tl-fish'); });
    if(t.startMs){ l.insertBefore(h('div',{class:'tlx'},h('b',{text:new Date(t.startMs).toTimeString().slice(0,5)}),h('span',{text:T('Ξεκίνησες','Set out')+(t.spot?' · '+t.spot:'')})),l.firstChild); }
    if(t.endMs){ l.append(h('div',{class:'tlx'},h('b',{text:new Date(t.endMs).toTimeString().slice(0,5)}),h('span',{text:T('Επιστροφή','Back')+(+t.km?' · '+B.num(t.km,1)+' km':'')}))); }
    body.append(h('h3',{class:'listh',text:T('Ψάρια της εξόδου','Catches on this trip')}),l); }
  else if(t.startMs){ body.append(h('div',{class:'list tline'},h('div',{class:'tlx'},h('b',{text:new Date(t.startMs).toTimeString().slice(0,5)}),h('span',{text:T('Ξεκίνησες','Set out')+(t.spot?' · '+t.spot:'')})),t.endMs?h('div',{class:'tlx'},h('b',{text:new Date(t.endMs).toTimeString().slice(0,5)}),h('span',{text:T('Επιστροφή','Back')+(+t.km?' · '+B.num(t.km,1)+' km':'')+' · '+T('χωρίς ψάρια','no catches')})):null)); }
  var pv=h('label',{class:'tg'},h('input',{type:'checkbox',checked:!!t.priv,onchange:function(ev){ var nx=Object.assign({},t); if(ev.target.checked) nx.priv=true; else delete nx.priv; S().save('trips',nx); t=nx; B.toast(nx.priv?T('Η έξοδος είναι κρυφή από τους φίλους.','This trip is hidden from friends.'):T('Οι φίλοι βλέπουν ξανά την έξοδο.','Friends can see this trip again.')); }}),h('span',{text:T('Κρυφή από φίλους','Hidden from friends')}));
  if(B.troll&&B.troll.profileOf&&t.sid&&B.troll.profileOf(t.sid)) body.append(h('button',{class:'btn full',type:'button',text:T('📈 Κατακόρυφο συρτής (βυθός, δόλωμα, ψάρια)','📈 Trolling profile (bottom, lure, catches)'),onclick:function(){ B.troll.showProfile(t.sid); }})); /* 1.8.12 */
  if(B.cards) body.append(h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Κάρτα','Card'),onclick:function(){ B.cards.trip(t); }}),h('button',{class:'btn',type:'button',text:cst?T('Κόστος','Cost'):T('Πρόσθεσε κόστος','Add cost'),onclick:function(){ sh.close(true); B.cards.cost(t,function(nt){ tripDetail(nt); }); }})));
  if(t.trprof&&t.trprof.length>1&&B.trollProfile) body.append(h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:'📈 '+T('Προφίλ βυθού (συρτή)','Seabed profile (trolling)'),onclick:function(){ B.trollProfile(t); }})));
  if(t.track&&t.track.length>1) body.append(h('div',{class:'acts'},B.replayTrip?h('button',{class:'btn pri',type:'button',text:'▶ '+T('Επανάληψη εξόδου','Replay trip'),onclick:function(){ sh.close(true); B.replayTrip(t); }}):null,h('button',{class:'btn',type:'button',text:T('Η διαδρομή στον χάρτη','Route on the map'),onclick:function(){ sh.close(true); B.mapGo(t.track[0][0],t.track[0][1],13,t.track); }})));
  body.append(pv,h('div',{class:'acts'},h('button',{class:'btn del',type:'button',text:T('Διαγραφή εξόδου','Delete trip'),onclick:function(){ B.ask(T('Να διαγραφεί η έξοδος; Τα ψάρια της μένουν.','Delete this trip? Its catches stay.'),T('Διαγραφή','Delete'),true).then(function(y){ if(y){ S().remove('trips',t.id); sh.close(); B.toast(T('Η έξοδος διαγράφηκε.','Trip deleted.')); } }); }})));
  var sh=B.sheet({title:t.spot||T('Έξοδος','Trip'),body:body});
}

/* ---------- στατιστικά ---------- */
function bars(c,items,max,fmt){ items.forEach(function(x){ c.append(h('div',{class:'bar'},h('span',{class:'bl',text:x[0]}),h('span',{class:'bt'},h('i',{style:{width:Math.max(3,Math.round(x[1]/max*100))+'%'}})),h('span',{class:'bv',text:fmt?fmt(x[1]):String(x[1])}))); }); }
function stats(page){
  var bs=S().bites().filter(function(b){ return !b.gear&&inRange(b.date||''); }), ts=S().raw('trips').filter(function(t){ return inRange(t.date||''); });
  if(!bs.length&&!ts.length){ page.append(h('div',{class:'card empty'},h('h3',{text:T('Δεν υπάρχουν ακόμα στοιχεία','No data yet')}),h('p',{text:T('Τα στατιστικά εμφανίζονται μόλις καταγράψεις ψάρια.','Stats appear once you log catches.')}))); pestCard(page); if(B.yearsCard) page.append(B.yearsCard()); return; }
  var n=bs.reduce(function(s,b){ return s+bc(b); },0), kg=bs.reduce(function(s,b){ return s+(b.rel?0:(+b.kg||0)); },0), hrs=ts.reduce(function(s,t){ return s+(dur(t)||0); },0), rel=bs.filter(function(b){ return b.rel; }).reduce(function(s,b){ return s+bc(b); },0);
  var big=bs.filter(function(b){ return +b.kg; }).sort(function(a,b){ return (+b.kg/bc(b))-(+a.kg/bc(a)); })[0];
  page.append(h('div',{class:'kpis'},[[String(n),T('ψάρια','catches')],[B.num(kg,1),T('κιλά','kilos')],[String(ts.length),T('έξοδοι','trips')],[hrs?B.num(n/hrs,2):'–',T('ψάρια ανά ώρα','catches per hour')]].map(function(k){ return h('div',{class:'kpi'},h('b',{text:k[0]}),h('span',{text:k[1]})); })));
  if(big) page.append(h('section',{class:'card'},h('h2',{text:T('Το μεγαλύτερο','The biggest')+(st.range==='all'?T(' (όλα τα χρόνια)',' (all years)'):'')}),h('p',{class:'p'},h('b',{text:big.species+', '+B.num(+big.kg/bc(big),2)+' kg'}),' · '+when(big)+(big.place?' · '+big.place:''))));
  var NOSP=T('Χωρίς είδος','No species'); var sp={}; bs.forEach(function(b){ var k=b.species||NOSP; sp[k]=(sp[k]||0)+bc(b); });
  var top=Object.keys(sp).map(function(k){ return [k,sp[k]]; }).sort(function(a,b){ return b[1]-a[1]; }).slice(0,8);
  if(top.length){ var c=h('section',{class:'card'},h('h2',{text:T('Είδη','Species')})); bars(c,top,top[0][1]); page.append(c);
    /* 1.9.7: «Χωρίς είδος» πατιέται: πάει στα Ψάρια με τα ψάρια χωρίς είδος πρώτα */
    [].forEach.call(c.querySelectorAll('.bar'),function(r){ var l=r.querySelector('.bl'); if(l&&l.textContent===NOSP){ r.classList.add('nosp'); r.setAttribute('role','button'); r.tabIndex=0; r.onclick=function(){ st.tab='fish'; st.q=''; st.nosp=true; draw(); }; } }); }
  var hr=new Array(8).fill(0); bs.forEach(function(b){ if(b.time) hr[Math.floor(+b.time.slice(0,2)/3)]+=bc(b); });
  var mh=Math.max.apply(null,hr); if(mh){ var c2=h('section',{class:'card'},h('h2',{text:T('Ώρα της ημέρας','Time of day')})); bars(c2,hr.map(function(v,i){ return [B.pad(i*3)+'–'+B.pad(i*3+3),v]; }),mh); page.append(c2); }
  var pl={}; bs.forEach(function(b){ if(!b.place) return; pl[b.place]=(pl[b.place]||0)+bc(b); });
  var tp=Object.keys(pl).map(function(k){ return [k,pl[k]]; }).sort(function(a,b){ return b[1]-a[1]; }).slice(0,6);
  if(tp.length){ var c3=h('section',{class:'card'},h('h2',{text:T('Σημεία','Spots')})); bars(c3,tp,tp[0][1]); page.append(c3); }
  var bt={}; bs.forEach(function(b){ if(!b.bait) return; bt[b.bait]=(bt[b.bait]||0)+bc(b); });
  var tb=Object.keys(bt).map(function(k){ return [k,bt[k]]; }).sort(function(a,b){ return b[1]-a[1]; }).slice(0,6);
  if(tb.length){ var c4=h('section',{class:'card'},h('h2',{text:T('Δολώματα','Baits')})); bars(c4,tb,tb[0][1]); page.append(c4); }
  if(st.range==='all'||st.range==='year'){ var mo=new Array(12).fill(0); bs.forEach(function(b){ if(b.date) mo[+b.date.slice(5,7)-1]+=bc(b); }); var mm=Math.max.apply(null,mo);
    if(mm){ var M=EN?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']:['Ιαν','Φεβ','Μάρ','Απρ','Μάι','Ιούν','Ιούλ','Αύγ','Σεπ','Οκτ','Νοέ','Δεκ'], c5=h('section',{class:'card'},h('h2',{text:T('Μήνες','Months')})); bars(c5,mo.map(function(v,i){ return [M[i],v]; }).filter(function(x){ return x[1]; }),mm); page.append(c5); } }
  var lostN=S().misses().filter(function(b){ return inRange(b.date||''); }).length; if(lostN) page.append(h('p',{class:'foot',text:T('Χαμένα τσιμπήματα: ','Lost bites: ')+lostN+T('. Επιτυχία ',' Success rate ')+Math.round(n/(n+lostN)*100)+'%.'}));
  if(B.cards){ var yr=new Date().getFullYear(); page.append(h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Κάρτα: η χρονιά μου ','Card: my year ')+yr,onclick:function(){ B.cards.year(yr); }}))); }
  if(B.recordsCards) B.recordsCards(page); /* v31z545: στόχοι και ρεκόρ */
  pestCard(page); /* v31z542 */
  if(B.yearsCard) page.append(B.yearsCard()); /* v31z540: σύγκριση χρονιών */
  lostAnalysis(page,bs);
  if(B.moonCard) page.append(B.moonCard(bs)); if(B.costCard){ var cc=B.costCard(); if(cc) page.append(cc); }
  if(rel) page.append(h('p',{class:'foot',text:T('Αφέθηκαν ελεύθερα: ','Released: ')+rel+T('. Τα κιλά δεν τα μετράνε.','. They are not counted in the kilos.')}));
}

/* v31z542: λαγοκέφαλοι χωριστά (δεν μετράνε στα ψάρια): πόσοι, πόσα «έφαγε το δόλωμα», πόσα αγκίστρια, και πού σε πειράζουν περισσότερο */
function PEST_W(){ return T('⚠ Τοξικός (τετροδοτοξίνη): δεν τρώγεται, δεν δίνεται, δεν πωλείται. Το μαγείρεμα δεν καταστρέφει την τοξίνη. Ξαγκίστρωνε με πένσα, προσοχή στα δόντια.','⚠ Toxic (tetrodotoxin): not to be eaten, given away or sold. Cooking does not destroy the toxin. Unhook with pliers and mind the teeth.'); }
B.pestWarn=PEST_W;
function pestCard(page){
  var ps=S().pests().filter(function(b){ return !b.gear&&inRange(b.date||''); }); if(!ps.length) return;
  var fish=ps.filter(function(b){ return b.pest!=='stolen'; }).reduce(function(s,b){ return s+bc(b); },0), st2=ps.filter(function(b){ return b.pest==='stolen'; }).length, cut=ps.reduce(function(s,b){ return s+((b.tkLost||[]).length); },0);
  var all=S().raw('bites').filter(function(b){ return !b.deleted&&!b.gear&&inRange(b.date||''); });
  var by={}; all.forEach(function(b){ var k=b.place||null; if(!k) return; var r=by[k]||(by[k]=[0,0]); r[0]++; if(B.pest(b)) r[1]++; });
  var hot=Object.keys(by).filter(function(k){ return by[k][1]>=2; }).map(function(k){ return [k,by[k][1],by[k][0]]; }).sort(function(a,b){ return b[1]/b[2]-a[1]/a[2]; }).slice(0,5);
  var c=h('section',{class:'card pestc'},h('h2',{text:'🐡 '+T('Λαγοκέφαλοι','Toadfish')}),
    h('p',{class:'sub',text:T('Τοξικό χωροκατακτητικό είδος. Καταγράφονται χωριστά και δεν μετράνε στα ψάρια σου.','Toxic invasive species. Logged separately and not counted in your catches.')}),
    h('div',{class:'kpis k6'},[[String(fish),T('έβγαλες','landed')],[String(st2),T('έφαγε δόλωμα / έκοψε','bait taken / cut')],[String(cut),T('χαμένα αγκίστρια / τεχνητά','hooks / lures lost')]].map(function(k){ return h('div',{class:'kpi'},h('b',{text:k[0]}),h('span',{text:k[1]})); })));
  if(hot.length){ c.append(h('h3',{class:'h3',text:T('Πού σε πειράζουν περισσότερο','Where they bother you most')}));
    hot.forEach(function(x){ c.append(h('div',{class:'bar'},h('span',{class:'bl',text:x[0]}),h('span',{class:'bt'},h('i',{style:{width:Math.round(x[1]/x[2]*100)+'%'}})),h('span',{class:'bv',text:x[1]+T(' στα ',' of ')+x[2]}))); }); }
  page.append(c); }
/* χαμένα σε σχέση με όσα πιάστηκαν, ανά συνθήκη (ίδια ανάλυση με την κλασική) */
function lostAnalysis(page,bs){
  var msx=S().misses().filter(function(b){ return !b.deleted&&inRange(b.date||''); }); if(!msx.length) return;
  var tk={}; S().raw('tackle').forEach(function(x){ tk[x.id]=x; });
  var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'], PT={fast:T('Πέφτει γρήγορα','Falling fast'),slow:T('Πέφτει αργά','Falling slowly'),stable:T('Σταθερή','Steady'),rise:T('Ανεβαίνει','Rising')};
  function bft(kn){ var L=[1,4,7,11,17,22,28,34,41,48,56,64]; for(var i=0;i<L.length;i++) if(kn<L[i]) return i; return 12; }
  function hr(b){ var x=parseInt((b.time||'').slice(0,2),10); return isNaN(x)?null:x; }
  var H8=[]; for(var i=0;i<8;i++) H8.push(B.pad(i*3)+'–'+B.pad((i*3+3)%24));
  var dims=[[T('Ώρα ημέρας','Time of day'),function(b){ var x=hr(b); return x==null?null:H8[Math.floor(x/3)]; },H8],
    [T('Άνεμος','Wind'),function(b){ if(b.wind==null) return null; var f=bft(b.wind); return f<=2?'Bft 0–2':f===3?'Bft 3':f===4?'Bft 4':'Bft 5+'; },['Bft 0–2','Bft 3','Bft 4','Bft 5+']],
    [T('Διεύθυνση ανέμου','Wind direction'),function(b){ return b.wdeg==null?null:COMP[Math.round((((b.wdeg%360)+360)%360)/45)%8]; },COMP],
    [T('Κύμα','Waves'),function(b){ return b.wave==null?null:(b.wave<0.3?'< 0.3 m':b.wave<0.6?'0.3–0.6 m':b.wave<1?'0.6–1 m':'≥ 1 m'); },['< 0.3 m','0.3–0.6 m','0.6–1 m','≥ 1 m']],
    [T('Τάση πίεσης','Pressure trend'),function(b){ return b.ptrend&&PT[b.ptrend]?PT[b.ptrend]:null; },Object.keys(PT).map(function(k){ return PT[k]; })],
    [T('Βάθος','Depth'),function(b){ return (b.depth==null||b.depth==='')?null:(b.depth<10?'0–10 m':b.depth<30?'10–30 m':b.depth<60?'30–60 m':'60+ m'); },['0–10 m','10–30 m','30–60 m','60+ m']],
    [T('Δόλωμα','Bait'),function(b){ return (b.bait||'').trim()||null; },null],[T('Τεχνική','Technique'),function(b){ return (b.tech||'').trim()||null; },null],
    [T('Τεχνητό / αγκίστρι','Lure / hook'),function(b){ return (b.tk||[]).map(function(id){ return tk[id]; }).filter(function(x){ return x&&(x.type==='lure'||x.type==='hook'); }).map(function(x){ return x.name; }); },null]];
  var total=bs.length+msx.length, c=h('section',{class:'card lost'},h('h2',{text:T('Χαμένα σε σχέση με όσα πιάστηκαν','Lost vs caught')}),
    h('p',{class:'sub',text:T('Πόσα τσιμπήματα κατέληξαν σε ψάρι και πόσα χάθηκαν, ανά συνθήκη. Πράσινο = έπιασα, κόκκινο = χάθηκε.','How many bites ended in a fish and how many were lost, per condition. Green = caught, red = lost.')+(total<20?T(' Λίγα δεδομένα: δες τα ως ένδειξη.',' Little data: treat as a hint.'):'')})), shown=0;
  dims.forEach(function(dm){ var m={}; function add(b,k){ var ks=Array.isArray(k)?k:[k], seen={}; ks.forEach(function(x){ if(x==null||seen[x]) return; seen[x]=1; var r=m[x]||(m[x]=[0,0]); r[b.miss?1:0]++; }); }
    bs.forEach(function(b){ add(b,dm[1](b)); }); msx.forEach(function(b){ add(b,dm[1](b)); });
    var rows=dm[2]?dm[2].filter(function(k){ return m[k]; }).map(function(k){ return [k,m[k]]; }):Object.keys(m).map(function(k){ return [k,m[k]]; }).sort(function(a,b){ return (b[1][0]+b[1][1])-(a[1][0]+a[1][1])||b[1][1]-a[1][1]; });
    rows=rows.slice(0,8); if(!rows.length||!rows.some(function(r){ return r[1][1]>0; })) return;
    var mx=Math.max.apply(null,rows.map(function(r){ return r[1][0]+r[1][1]; })); c.append(h('h3',{class:'h3',text:dm[0]}));
    rows.forEach(function(r){ var cc=r[1][0], l=r[1][1]; c.append(h('div',{class:'bar'},h('span',{class:'bl',text:r[0]}),h('span',{class:'bt lv'},h('i',{class:'g',style:{width:(cc/mx*100)+'%'}}),h('i',{class:'r',style:{width:(l/mx*100)+'%'}})),h('span',{class:'bv',text:cc+' / '+l+' · '+Math.round(cc/(cc+l)*100)+'%'}))); });
    shown++; });
  if(shown) page.append(c);
}
B.biteDetail=detail;
B.view('log',{title:T('Ημερολόγιο','Logbook'),mount:function(el){ root=el; st.tab=ls.get('alkyon-v4-logtab',st.tab)||st.tab; draw(); },unmount:function(){ root=null; },resume:function(){ st.tab=ls.get('alkyon-v4-logtab',st.tab)||st.tab; draw(); }});
B.on('store',function(k){ if(root&&/^alkyon-(bites|trips|spots|sess|gear)$/.test(k)) redraw(); });
})();
