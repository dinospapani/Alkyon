/* BiteCast 4 · Ημερολόγιο: ψάρια, έξοδοι, στατιστικά */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls, U=window.PsaroUnits;
var st={tab:ls.get('psaro-v4-logtab','fish'),range:ls.get('psaro-v4-logrange','30'),q:''}, root=null;
function S(){ return B.store; }
function bc(b){ return Math.max(1,Math.floor(+b.cnt)||1); }
function ms(b){ return Date.parse((b.date||'1970-01-01')+'T'+(b.time||'12:00')+':00'); }
function inRange(dateStr){ if(st.range==='all') return true; if(st.range==='custom'){ var cr=ls.get('psaro-v4-logcr',{})||{}; return (!cr.a||dateStr>=cr.a)&&(!cr.b||dateStr<=cr.b); } var d=Date.parse(dateStr+'T12:00:00'); if(st.range==='year') return dateStr.slice(0,4)===String(new Date().getFullYear()); return Date.now()-d<=(+st.range)*86400000; }
var RANGES=[['7',T('7 ημέρες','7 days')],['30',T('30 ημέρες','30 days')],['year',T('Φέτος','This year')],['all',T('Όλα','All')]];
function nrm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function when(b,long){ if(!b.date) return ''; var td=new Date(), t=td.getFullYear()+'-'+B.pad(td.getMonth()+1)+'-'+B.pad(td.getDate()), dn=B.dayName(b.date,t), rel=dn!==B.dayName(b.date);
  return (rel?dn:(long?dn+' ':'')+B.dateShort(b.date)+(long&&b.date.slice(0,4)!==t.slice(0,4)?' '+b.date.slice(0,4):''))+(b.time?', '+b.time:''); }
function thumb(b){ var w=h('span',{class:'th'}); if(b.photo){ S().Photos.get(b.id).then(function(bl){ if(bl) w.append(h('img',{src:URL.createObjectURL(bl),alt:''})); else w.append(B.icon('fish')); }).catch(function(){ w.append(B.icon('fish')); }); } else w.append(B.icon('fish')); return w; }
function sizeTxt(b){ var n=bc(b), a=[]; if(+b.kg) a.push(B.num(b.kg,+b.kg<10?2:1).replace(/([.,]\d)0$/,'$1')+' kg'+(n>1?T(' σύνολο',' total'):'')); if(+b.len) a.push(b.len+' cm'); return a.join(', '); }

function draw(){
  if(!root) return;
  var page=h('div',{class:'page'});
  page.append(h('div',{class:'top'},h('h1',{class:'lt',text:T('Ημερολόγιο','Logbook')}),syncBtn()));
  page.append(B.seg([['fish',T('Ψάρια','Catches')],['trips',T('Έξοδοι','Trips')],['gear',T('Εργαλεία','Gear')],['stats',T('Στατιστικά','Stats')]],st.tab,function(v){ st.tab=v; ls.set('psaro-v4-logtab',v); draw(); },T('Όψη ημερολογίου','Logbook view')));
  var chips=h('div',{class:'chips',role:'group','aria-label':T('Διάστημα','Period')});
  RANGES.forEach(function(r){ chips.append(h('button',{type:'button',class:'chip','aria-pressed':String(st.range===r[0]),text:r[1],onclick:function(){ st.range=r[0]; ls.set('psaro-v4-logrange',r[0]); draw(); }})); });
  chips.append(h('button',{type:'button',class:'chip','aria-pressed':String(st.range==='custom'),text:T('Από – Έως','From – To'),onclick:function(){ st.range='custom'; ls.set('psaro-v4-logrange','custom'); draw(); }}));
  page.append(chips);
  if(st.range==='custom'){ var cr=ls.get('psaro-v4-logcr',{})||{}, ia=h('input',{type:'date',value:cr.a||'','aria-label':T('Από','From')}), ib=h('input',{type:'date',value:cr.b||'','aria-label':T('Έως','To')});
    function upd(){ ls.set('psaro-v4-logcr',{a:ia.value||null,b:ib.value||null}); draw(); } ia.addEventListener('change',upd); ib.addEventListener('change',upd);
    page.append(h('div',{class:'g2 crange'},h('label',{class:'fld'},h('span',{text:T('Από','From')}),ia),h('label',{class:'fld'},h('span',{text:T('Έως','To')}),ib))); }
  if(st.tab==='fish') fish(page); else if(st.tab==='trips') trips(page); else if(st.tab==='gear'&&B.gearLog) B.gearLog(page,inRange); else stats(page);
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
  page.append(h('div',{class:'search'},B.icon('search'),q),list);
  function fill(){
    var qq=nrm(st.q), a=S().raw('bites').filter(function(b){ return !b.gear&&inRange(b.date||'')&&(!qq||nrm([b.species,b.bait,b.tech,b.place,b.notes].join(' ')).indexOf(qq)>=0); }).sort(function(a,b){ return ms(b)-ms(a); });
    if(!a.length){ list.replaceChildren(h('div',{class:'card empty'},h('h3',{text:st.q?T('Δεν βρέθηκε ψάρι','No catch found'):T('Κανένα ψάρι σε αυτό το διάστημα','No catches in this period')}),h('p',{text:T('Πάτα το + για να καταγράψεις ψάρι.','Tap + to log a catch.')}),h('button',{class:'btn pri',type:'button',text:T('Νέο ψάρι','New catch'),onclick:function(){ B.biteForm(); }}))); return; }
    var lost=a.filter(function(b){ return b.miss; }).length, a2=a.filter(function(b){ return !b.miss; }), n=a2.reduce(function(s,b){ return s+bc(b); },0), kg=a2.reduce(function(s,b){ return s+(+b.kg||0); },0);
    var l=h('div',{class:'list'});
    a.slice(0,300).forEach(function(b){
      var sub=[sizeTxt(b),b.place].filter(Boolean).join(' · ');
      l.append(h('button',{class:'li fishrow'+(b.miss?' miss':''),type:'button',onclick:function(){ detail(b); }},thumb(b),h('span',{class:'tx'},h('b',{text:b.miss?T('Χαμένο τσίμπημα','Lost bite')+(b.species?': '+b.species:''):(b.species||T('Άγνωστο','Unknown'))+(bc(b)>1?' ×'+bc(b):'')}),h('small',{text:sub||' '})),h('span',{class:'when',text:when(b)}),b.rel?h('span',{class:'relb',title:T('Αφέθηκε ελεύθερο','Released'),text:'↩'}):null));
    });
    list.replaceChildren(h('p',{class:'sum',text:n+' '+T(n===1?'ψάρι':'ψάρια',n===1?'catch':'catches')+(kg?', '+B.num(kg,1)+' kg':'')+(lost?', '+lost+' '+T(lost===1?'χαμένο':'χαμένα','lost'):'')}),l);
  }
  fill();
}
function detail(b){
  var body=h('div',{class:'det'});
  var keys=S().phKeys(b); if(keys.length){ var gal=h('div',{class:'gal'}); keys.forEach(function(k){ S().Photos.get(k).then(function(bl){ if(bl) gal.append(h('img',{src:URL.createObjectURL(bl),alt:b.species||''})); }).catch(function(){}); }); body.append(gal); }
  var rows=[[T('Πότε','When'),when(b,true)],[T('Μέγεθος','Size'),sizeTxt(b)||'–'],[T('Πού','Where'),b.place||(typeof b.lat==='number'?b.lat.toFixed(5)+', '+b.lon.toFixed(5):'–')],[T('Βάθος','Depth'),b.depth!=null?b.depth+' m':'–'],
    [T('Δόλωμα','Bait'),b.bait||'–'],[T('Τεχνική','Technique'),b.tech||'–'],
    [T('Άνεμος','Wind'),b.wind!=null?U.wind(b.wind)+(b.hist?' ('+T('εκτίμηση','estimate')+')':''):'–'],[T('Κύμα','Waves'),b.wave!=null?U.wave(b.wave):'–'],[T('Πίεση','Pressure'),b.press!=null?U.press(b.press):'–'],[T('Θάλασσα','Sea temp'),b.sst!=null?U.temp(b.sst):'–']];
  body.append(h('div',{class:'card'},h('div',{class:'rows one'},rows.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  if(b.tk&&b.tk.length){ var tkn=b.tk.map(function(id){ var x=S().get('tackle',id); return x?x.name:null; }).filter(Boolean); if(tkn.length) body.append(h('div',{class:'card'},h('h2',{text:T('Εξοπλισμός','Tackle')}),h('p',{class:'p',text:tkn.join(', ')}))); }
  if(b.notes) body.append(h('div',{class:'card'},h('p',{class:'p',text:b.notes})));
  if(window.PsaroBiteWx&&!b.gear){ var wx=h('div',{class:'card bwxcard'},h('h2',{text:T('Καιρός γύρω από το πιάσιμο','Weather around the catch')})); try{ wx.append(PsaroBiteWx.slot(b)); body.append(wx); }catch(e){} }
  var acts=h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Επεξεργασία','Edit'),onclick:function(){ sh.close(true); B.biteForm(b); }}));
  if(typeof b.lat==='number') acts.append(h('button',{class:'btn',type:'button',text:T('Στον χάρτη','On the map'),onclick:function(){ sh.close(true); B.mapGo(b.lat,b.lon,15); }}));
  if(typeof b.lat==='number'&&B.goTo) acts.append(h('button',{class:'btn',type:'button',text:T('Πήγαινε εκεί','Go there'),onclick:function(){ sh.close(true); B.goTo(b.lat,b.lon,b.species||b.place||''); }}));
  if(!b.miss&&B.cards) acts.append(h('button',{class:'btn',type:'button',text:T('Κάρτα','Card'),onclick:function(){ B.cards.fish(b); }}));
  body.append(acts);
  var sh=B.sheet({title:(b.species||T('Ψάρι','Catch'))+(bc(b)>1?' ×'+bc(b):''),body:body});
}

/* ---------- έξοδοι ---------- */
function dur(t){ return t.startMs&&t.endMs?(t.endMs-t.startMs-(t.pauseMs||0))/3600000:null; }
function trips(page){
  /* ψαροντούφεκο: καταδύσεις από ρολόι (FIT/UDDF), ίδια λειτουργία με την κλασική (divelog.js) */
  if(window.PsaroDiveLog&&B.prof()==='spear'){ page.append(h('div',{id:'l-trips',class:'dives'},h('div',{id:'tripList'}))); setTimeout(function(){ try{ PsaroDiveLog.render(); }catch(e){} },0); }
  var a=S().raw('trips').filter(function(t){ return inRange(t.date||''); }).sort(function(x,y){ return (y.startMs||Date.parse(y.date))-(x.startMs||Date.parse(x.date)); });
  if(!a.length){ page.append(h('div',{class:'card empty'},h('h3',{text:T('Καμία έξοδος σε αυτό το διάστημα','No trips in this period')}),h('p',{text:T('Οι έξοδοι ξεκινούν από τον χάρτη με «Έναρξη εξόδου».','Trips start from the map with “Start a trip”.')}),h('a',{class:'btn pri',href:B.classic('?a=trip'),text:T('Έναρξη εξόδου','Start a trip')}))); return; }
  var tot=a.reduce(function(s,t){ return s+(dur(t)||0); },0), n=a.reduce(function(s,t){ return s+(+t.count||0); },0);
  page.append(h('p',{class:'sum',text:a.length+' '+T(a.length===1?'έξοδος':'έξοδοι',a.length===1?'trip':'trips')+', '+B.num(tot,0)+T(' ώρες, ',' hours, ')+n+' '+T('ψάρια','catches')}));
  var l=h('div',{class:'list'});
  a.slice(0,200).forEach(function(t){ var d=dur(t), c=+t.count||0;
    l.append(h('button',{class:'li triprow',type:'button',onclick:function(){ tripDetail(t); }},h('span',{class:'tc'+(c?'':' z'),text:String(c)}),h('span',{class:'tx'},h('b',{text:(t.spot||B.PROF[t.prof||'boat']||'')+(t.priv?' 🔒':'')}),h('small',{text:[when(t),d!=null?B.num(d,1)+' h':'',+t.kg?B.num(t.kg,1)+' kg':''].filter(Boolean).join(' · ')})),B.icon('chev')));
  });
  page.append(l);
}
function tripDetail(t){
  var body=h('div',{class:'det'}), d=dur(t);
  var bs=S().bites().filter(function(b){ return (t.sid&&b.trip===t.sid)||(t.startMs&&ms(b)>=t.startMs-600000&&ms(b)<=t.endMs+600000); }).sort(function(a,b){ return ms(a)-ms(b); });
  var rows=[[T('Πότε','When'),when(t,true)+(t.startMs?' – '+new Date(t.endMs).toTimeString().slice(0,5):'')],[T('Διάρκεια','Duration'),d!=null?B.num(d,1)+' h':'–'],[T('Ψάρια','Catches'),String(+t.count||bs.reduce(function(s,b){ return s+bc(b); },0))],[T('Κιλά','Kilos'),+t.kg?B.num(t.kg,1)+' kg':'–'],[T('Τύπος','Type'),B.PROF[t.prof||'boat']||'']];
  if(+t.km) rows.push([T('Απόσταση','Distance'),window.PsaroUnits?PsaroUnits.dist(+t.km):B.num(t.km,1)+' km']);
  var cst=B.cards?B.cards.costOf(t):0, nf=+t.count||0; if(cst) rows.push([T('Κόστος','Cost'),'€'+B.num(cst,cst%1?2:0)+(nf?' · €'+B.num(cst/nf,2)+T(' ανά ψάρι',' per fish'):'')+(+t.kg?' · €'+B.num(cst/+t.kg,2)+'/kg':'')]);
  body.append(h('div',{class:'card'},h('div',{class:'rows one'},rows.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); }))));
  if(bs.length){ var l=h('div',{class:'list'}); bs.forEach(function(b){ l.append(h('button',{class:'li fishrow',type:'button',onclick:function(){ sh.close(true); detail(b); }},thumb(b),h('span',{class:'tx'},h('b',{text:(b.species||'')+(bc(b)>1?' ×'+bc(b):'')}),h('small',{text:[b.time,sizeTxt(b)].filter(Boolean).join(' · ')})))); }); body.append(h('h3',{class:'listh',text:T('Ψάρια της εξόδου','Catches on this trip')}),l); }
  var pv=h('label',{class:'tg'},h('input',{type:'checkbox',checked:!!t.priv,onchange:function(ev){ var nx=Object.assign({},t); if(ev.target.checked) nx.priv=true; else delete nx.priv; S().save('trips',nx); t=nx; B.toast(nx.priv?T('Η έξοδος είναι κρυφή από τους φίλους.','This trip is hidden from friends.'):T('Οι φίλοι βλέπουν ξανά την έξοδο.','Friends can see this trip again.')); }}),h('span',{text:T('Κρυφή από φίλους','Hidden from friends')}));
  if(B.cards) body.append(h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Κάρτα','Card'),onclick:function(){ B.cards.trip(t); }}),h('button',{class:'btn',type:'button',text:cst?T('Κόστος','Cost'):T('Πρόσθεσε κόστος','Add cost'),onclick:function(){ sh.close(true); B.cards.cost(t,function(nt){ tripDetail(nt); }); }})));
  if(t.track&&t.track.length>1) body.append(h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Η διαδρομή στον χάρτη','Route on the map'),onclick:function(){ sh.close(true); B.mapGo(t.track[0][0],t.track[0][1],13,t.track); }})));
  body.append(pv,h('div',{class:'acts'},h('button',{class:'btn del',type:'button',text:T('Διαγραφή εξόδου','Delete trip'),onclick:function(){ B.ask(T('Να διαγραφεί η έξοδος; Τα ψάρια της μένουν.','Delete this trip? Its catches stay.'),T('Διαγραφή','Delete'),true).then(function(y){ if(y){ S().remove('trips',t.id); sh.close(); B.toast(T('Η έξοδος διαγράφηκε.','Trip deleted.')); } }); }})));
  var sh=B.sheet({title:t.spot||T('Έξοδος','Trip'),body:body});
}

/* ---------- στατιστικά ---------- */
function bars(c,items,max,fmt){ items.forEach(function(x){ c.append(h('div',{class:'bar'},h('span',{class:'bl',text:x[0]}),h('span',{class:'bt'},h('i',{style:{width:Math.max(3,Math.round(x[1]/max*100))+'%'}})),h('span',{class:'bv',text:fmt?fmt(x[1]):String(x[1])}))); }); }
function stats(page){
  var bs=S().bites().filter(function(b){ return !b.gear&&inRange(b.date||''); }), ts=S().raw('trips').filter(function(t){ return inRange(t.date||''); });
  if(!bs.length&&!ts.length){ page.append(h('div',{class:'card empty'},h('h3',{text:T('Δεν υπάρχουν ακόμα στοιχεία','No data yet')}),h('p',{text:T('Τα στατιστικά εμφανίζονται μόλις καταγράψεις ψάρια.','Stats appear once you log catches.')}))); return; }
  var n=bs.reduce(function(s,b){ return s+bc(b); },0), kg=bs.reduce(function(s,b){ return s+(b.rel?0:(+b.kg||0)); },0), hrs=ts.reduce(function(s,t){ return s+(dur(t)||0); },0), rel=bs.filter(function(b){ return b.rel; }).reduce(function(s,b){ return s+bc(b); },0);
  var big=bs.filter(function(b){ return +b.kg; }).sort(function(a,b){ return (+b.kg/bc(b))-(+a.kg/bc(a)); })[0];
  page.append(h('div',{class:'kpis'},[[String(n),T('ψάρια','catches')],[B.num(kg,1),T('κιλά','kilos')],[String(ts.length),T('έξοδοι','trips')],[hrs?B.num(n/hrs,2):'–',T('ψάρια ανά ώρα','catches per hour')]].map(function(k){ return h('div',{class:'kpi'},h('b',{text:k[0]}),h('span',{text:k[1]})); })));
  if(big) page.append(h('section',{class:'card'},h('h2',{text:T('Το μεγαλύτερο','The biggest')}),h('p',{class:'p'},h('b',{text:big.species+', '+B.num(+big.kg/bc(big),2)+' kg'}),' · '+when(big)+(big.place?' · '+big.place:''))));
  var sp={}; bs.forEach(function(b){ var k=b.species||'?'; sp[k]=(sp[k]||0)+bc(b); });
  var top=Object.keys(sp).map(function(k){ return [k,sp[k]]; }).sort(function(a,b){ return b[1]-a[1]; }).slice(0,8);
  if(top.length){ var c=h('section',{class:'card'},h('h2',{text:T('Είδη','Species')})); bars(c,top,top[0][1]); page.append(c); }
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
  lostAnalysis(page,bs);
  if(B.moonCard) page.append(B.moonCard(bs)); if(B.costCard){ var cc=B.costCard(); if(cc) page.append(cc); }
  if(rel) page.append(h('p',{class:'foot',text:T('Αφέθηκαν ελεύθερα: ','Released: ')+rel+T('. Τα κιλά δεν τα μετράνε.','. They are not counted in the kilos.')}));
}

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
B.view('log',{title:T('Ημερολόγιο','Logbook'),mount:function(el){ root=el; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
B.on('store',function(k){ if(root&&/^psaro-(bites|trips|spots|sess|gear)$/.test(k)) draw(); });
})();
