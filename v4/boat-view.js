/* BiteCast 4 · Σκάφος (#boat): στοιχεία, κινητήρας και ώρες, καύσιμο, λήξεις, αντιρρυπαντική, μπαταρίες.
   Ίδια δεδομένα με την κλασική: psaro-boat και psaro-smart (ώρες κινητήρα, καύσιμο, άδεια ψαρέματος). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls, root=null, DAY=86400000;
var EXP_DEF=[['insp',T('Επιθεώρηση σκάφους','Boat inspection'),30],['ext',T('Πυροσβεστήρας','Fire extinguisher'),30],['vhf',T('Άδεια ασυρμάτου (VHF)','Radio licence (VHF)'),30],['ins',T('Ασφάλεια σκάφους','Boat insurance'),30],['flare',T('Φωτοβολίδες','Flares'),30],['epirb',T('EPIRB / PLB (μπαταρία)','EPIRB / PLB (battery)'),60],['raft',T('Σωσίβια σχεδία (σέρβις)','Liferaft (service)'),30]];
var BAT_LIFE={lead:4,agm:5,gel:5,lith:10}, BTYP=[['lead',T('Μολύβδου (υγρή)','Lead-acid (flooded)')],['agm','AGM'],['gel','Gel'],['lith',T('Λιθίου (LiFePO4)','Lithium (LiFePO4)')]];
function D(){ var b=ls.get('psaro-boat',null); if(!b||typeof b!=='object') b={}; b.boat=b.boat||{}; b.eng=b.eng||{}; b.log=Array.isArray(b.log)?b.log:[]; b.bat=Array.isArray(b.bat)?b.bat:[]; b.af=b.af||{mo:12};
  if(!Array.isArray(b.exp)) b.exp=EXP_DEF.map(function(x){ return {id:x[0],name:x[1],date:'',lead:x[2],std:1}; }); return b; }
function Sm(){ var s=ls.get('psaro-smart',{}); if(!s||typeof s!=='object') s={}; s.eng=s.eng||{h:0,every:100,last:0}; if(!(+s.cruise>0)) s.cruise=15; if(s.reserve==null) s.reserve=20; return s; }
function today(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
function dP(s){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m?Date.UTC(+m[1],+m[2]-1,+m[3]):null; }
function dF(s){ var t=dP(s); return t==null?'–':new Date(t).toLocaleDateString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}); }
function addM(s,m){ var t=dP(s); if(t==null||!(m>0)) return null; var d=new Date(t); d.setUTCMonth(d.getUTCMonth()+Math.round(m)); return d.toISOString().slice(0,10); }
function daysTo(s){ var t=dP(s), n=dP(today()); return t==null?null:Math.round((t-n)/DAY); }
function lv(date,lead){ var d=daysTo(date); return {d:d,lv:!date?'n':d<0?'bad':d<=lead?'warn':'ok'}; }
function lvTxt(o){ if(o.mt) return o.lv==='bad'?T('εκπρόθεσμο','overdue'):T('σύντομα','due soon'); if(o.d==null) return T('χωρίς ημερομηνία','no date'); if(o.d<0) return T('έληξε πριν ','expired ')+(-o.d)+T(' ημέρες',' days ago'); if(o.d===0) return T('λήγει σήμερα','expires today'); return T('σε ','in ')+o.d+T(' ημέρες',' days'); }
function tag(o){ return h('span',{class:'tag '+(o.lv==='bad'?'poor':o.lv==='warn'?'fair':o.lv==='ok'?'good':''),text:lvTxt(o)}); }
function dueList(b,s){ var out=[];
  b.exp.forEach(function(x){ if(x.date) out.push({name:x.name,date:x.date,lead:x.lead||30}); });
  if(b.af.date){ var nx=addM(b.af.date,b.af.mo||12); if(nx) out.push({name:T('Αντιρρυπαντική','Antifouling'),date:nx,lead:30}); }
  b.bat.forEach(function(x){ if(x.inst){ var nx=addM(x.inst,(BAT_LIFE[x.type]||4)*12); if(nx) out.push({name:T('Μπαταρία ','Battery ')+(x.name||''),date:nx,lead:60}); } });
  if(s.lic) out.push({name:T('Άδεια ψαρέματος','Fishing licence'),date:s.lic,lead:14});
  out.forEach(function(o){ var r=lv(o.date,o.lead); o.d=r.d; o.lv=r.lv; }); return out.sort(function(a,c){ return a.d-c.d; }); }

/* πεδίο που αποθηκεύεται μόλις αλλάξει */
function inp(type,val,ph,on){ var i=h('input',{type:type,value:val==null?'':val,placeholder:ph||null}); if(type==='number'){ i.inputMode='decimal'; i.step='any'; i.min='0'; }
  i.addEventListener('change',function(){ on(type==='number'?(i.value===''?null:+i.value):i.value.trim()); }); return i; }
function fld(label,input){ return h('label',{class:'fld'},h('span',{text:label}),input); }
function saveB(b){ ls.set('psaro-boat',b); }
function saveS(s){ ls.set('psaro-smart',s); }

/* λιμάνι, γραμμή επιστροφής, αυτονομία, αυτόματες προτάσεις, λίστα ελέγχου (κοινά με την κλασική: psaro-smart) */
function portCard(){
  var M=B.smart, s=M.state(), c=h('section',{class:'card'},h('h2',{text:T('Λιμάνι και έξοδος','Port and trips')}));
  c.append(h('div',{class:'rows one'},h('div',{class:'row'},h('span',{text:T('Λιμάνι','Home port')}),h('b',{text:s.home?(s.home.name||T('Λιμάνι','Port')):T('Δεν έχει οριστεί','Not set')}))));
  if(!s.home) c.append(h('p',{class:'sub',text:T('Χρειάζεται για «Πότε να γυρίσω», αυτονομία καυσίμου και αυτόματες προτάσεις έναρξης/λήξης.','Needed for “when to head back”, fuel range and automatic start/end suggestions.')}));
  var spots=B.store.raw('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'; }), sel=h('select',{class:'select'}); sel.append(h('option',{value:'',text:T('Από τα σημεία μου…','From my spots…')}));
  spots.forEach(function(x){ sel.append(h('option',{value:x.id,text:x.name||'?'})); });
  sel.addEventListener('change',function(){ var x=spots.filter(function(q){ return q.id===sel.value; })[0]; if(x){ M.setHome({lat:x.lat,lon:x.lon,name:x.name}); draw(); } });
  c.append(sel,h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Θέση μου τώρα','My position'),onclick:function(){ M.fixNow(function(p){ M.setHome({lat:p.lat,lon:p.lon,name:T('Λιμάνι','Port')}); B.toast(T('Το λιμάνι ορίστηκε στη θέση σου.','Port set to your position.')); draw(); },function(){ B.toast(T('Δεν βρέθηκε θέση GPS.','No GPS fix.')); }); }}),
    h('button',{class:'btn',type:'button',text:T('Βρες λιμάνι','Find port'),onclick:function(){ M.fixNow(function(p){ M.offerHome(p,'').then(draw); },function(){ B.toast(T('Δεν βρέθηκε θέση GPS.','No GPS fix.')); }); }}),
    s.home?h('button',{class:'btn',type:'button',text:T('Καθαρισμός','Clear'),onclick:function(){ M.setHome(null); draw(); }}):null));
  function tg(lab,sub,on,fn){ return h('label',{class:'tg'},h('input',{type:'checkbox',checked:on,onchange:function(ev){ var x=M.state(); fn(x,ev.target.checked); M.save(x); }}),h('span',null,lab,h('small',{class:'tgsub',text:sub}))); }
  c.append(tg(T('Γραμμή επιστροφής στον χάρτη','Return strip on the map'),T('«🏠 απόσταση · ώρα · ⛽» κατά την έξοδο. Πάτα την για πλοήγηση προς το λιμάνι.','“🏠 distance · time · ⛽” during a trip. Tap it to navigate home.'),s.chip!==false,function(x,v){ x.chip=v; }),
    tg(T('Δαχτυλίδι αυτονομίας','Range ring'),T('Στον χάρτη, γύρω από το λιμάνι, με βάση το καύσιμο και την εφεδρεία.','On the map around the port, from fuel and reserve.'),s.ring!==false,function(x,v){ x.ring=v; }),
    tg(T('Προτάσεις έναρξης και λήξης','Start and end suggestions'),T('Ρωτά όταν φεύγεις από το λιμάνι ή γυρίζεις. Χρησιμοποιεί GPS όσο η εφαρμογή είναι ανοιχτή.','Asks when you leave or return to the port. Uses GPS while the app is open.'),s.auto!==false,function(x,v){ x.auto=v; if(v) setTimeout(M.autoStart,100); else M.autoStop(); }));
  var rs=h('select',{class:'select'}); [['0',T('Ευθεία γραμμή (χωρίς έλεγχο στεριάς)','Straight line (no land check)')],['100',T('100 μ. από στεριά','100 m from land')],['200',T('200 μ. από στεριά (προεπιλογή)','200 m from land (default)')],['500',T('500 μ. από στεριά','500 m from land')],['1852',T('1 ν.μ. από στεριά','1 nm from land')]].forEach(function(o){ rs.append(h('option',{value:o[0],text:o[1]})); });
  rs.value=String(ls.get('psaro-route-clr',200)); if(rs.selectedIndex<0) rs.value='200'; rs.addEventListener('change',function(){ ls.set('psaro-route-clr',+rs.value); });
  c.append(h('label',{class:'fld'},h('span',{text:T('«Πήγαινε εκεί»: διαδρομή γύρω από στεριά','“Go there”: route around land')}),rs,h('small',{class:'wn',text:T('Ενδεικτική διαδρομή που κρατά απόσταση από ακτές και νησιά. Δεν είναι ναυτικός χάρτης: δεν ξέρει ξέρες. Χρειάζεται σύνδεση.','Indicative route keeping a distance from coasts and islands. Not a nautical chart: it does not know shoals. Needs a connection.')})));
  c.append(h('button',{class:'btn full',type:'button',text:'✓ '+T('Λίστα ελέγχου πριν βγεις','Pre-departure checklist')+' ('+M.clCount()+'/'+s.cl.items.length+')',onclick:function(){ M.checklist(draw); }}));
  return c;
}

/* ---------- πρόγραμμα συντήρησης κινητήρα (ίδιο με την κλασική insights.js: psaro-maint) ---------- */
function Mload(){ var M=ls.get('psaro-maint',null); if(!M||!Array.isArray(M.items)) M={items:null,sent:{}}; M.sent=M.sent||{};
  if(!M.items) M.items=(EN?[['Engine oil',100,12],['Fuel filter',100,12],['Gearcase oil',100,12],['Water impeller',200,24],['Anodes',0,6],['Propeller (inspect)',0,6],['Battery (inspect)',0,6],['Bilge pump (test)',0,3]]
    :[['Λάδι κινητήρα',100,12],['Φίλτρο καυσίμου',100,12],['Λάδι ποδιού (gearcase)',100,12],['Πτερωτή νερού (impeller)',200,24],['Ανόδια',0,6],['Προπέλα (έλεγχος)',0,6],['Μπαταρία (έλεγχος)',0,6],['Αντλία σεντίνας (δοκιμή)',0,3]]).map(function(x,i){ return {id:'m'+i,name:x[0],h:x[1],mo:x[2],last:null}; });
  return M; }
function Msave(M){ ls.set('psaro-maint',M); }
function engH(){ return +Sm().eng.h||0; }
function mstat(it){
  if(!it.last) return {lv:'n',tx:T('Δεν έχει καταγραφεί','Not logged yet')};
  var eh=engH(), dh=it.h>0?it.h-(eh-it.last.h):null, dm=it.mo>0?it.mo*30.4-(Date.now()-it.last.t)/86400000:null, parts=[], l='ok';
  if(dh!=null){ parts.push(dh>=0?T('σε ','in ')+Math.round(dh)+' h':T('καθυστέρηση ','overdue ')+Math.round(-dh)+' h'); if(dh<0) l='bad'; else if(dh<it.h*0.1) l='warn'; }
  if(dm!=null){ parts.push(dm>=0?T('σε ','in ')+Math.round(dm)+T(' ημέρες',' days'):T('καθυστέρηση ','overdue ')+Math.round(-dm)+T(' ημέρες',' days')); if(dm<0) l='bad'; else if(dm<14&&l!=='bad') l='warn'; }
  return {lv:l,tx:parts.join(' · ')+' · '+T('τελευταίο ','last ')+new Date(it.last.t).toLocaleDateString(EN?'en-GB':'el-GR')}; }
B.maintDue=function(){ return Mload().items.filter(function(it){ var x=mstat(it).lv; return x==='bad'||x==='warn'; }); };
function maintEdit(it){ var M=Mload(), cur=it?M.items.filter(function(x){ return x.id===it.id; })[0]:null, sh;
  var nm=h('input',{type:'text',maxlength:'60',value:cur?cur.name:'',placeholder:T('π.χ. Μπουζί','e.g. Spark plugs')}), hh=h('input',{type:'number',min:'0',inputmode:'numeric',value:cur&&cur.h?cur.h:''}), mo=h('input',{type:'number',min:'0',inputmode:'numeric',value:cur?(cur.mo||''):'12'});
  var body=h('form',{class:'bform',novalidate:true},fld(T('Όνομα','Name'),nm),h('div',{class:'g2'},fld(T('Κάθε (ώρες μηχανής)','Every (engine hours)'),hh),fld(T('ή κάθε (μήνες)','or every (months)'),mo)),
    h('small',{class:'sub',text:T('Βάλε 0 ή άφησε κενό όποιο δεν ισχύει. Μετράει όποιο έρθει πρώτο.','Use 0 or leave empty for the one that does not apply. Whichever comes first counts.')}),
    h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση','Save')}),
    cur?h('button',{class:'btn full del',type:'button',text:T('Διαγραφή','Delete'),onclick:function(){ var X=Mload(); X.items=X.items.filter(function(q){ return q.id!==cur.id; }); Msave(X); sh.close(); draw(); }}):null);
  body.addEventListener('submit',function(ev){ ev.preventDefault(); var v=nm.value.trim(); if(!v){ nm.focus(); return; } var X=Mload(), o=cur?X.items.filter(function(q){ return q.id===cur.id; })[0]:null;
    if(!o){ o={id:'m'+uid(),last:null}; X.items.push(o); } o.name=v.slice(0,60); o.h=Math.max(0,+hh.value||0); o.mo=Math.max(0,+mo.value||0); Msave(X); sh.close(); draw(); });
  sh=B.sheet({title:cur?T('Στοιχείο συντήρησης','Maintenance item'):T('Νέο στοιχείο συντήρησης','New maintenance item'),body:body,focus:cur?null:'input'}); }
function maintCard(){
  var M=Mload(), c=h('section',{class:'card'},h('h2',{text:T('Πρόγραμμα συντήρησης','Maintenance schedule')}),h('p',{class:'sub',style:{margin:'-4px 0 8px'},text:T('Με βάση τις ώρες κινητήρα (','Based on engine hours (')+B.num(engH(),1)+' h) '+T('και τον χρόνο. Πάτα «Έγινε» όταν το κάνεις.','and time. Tap “Done” when you do it.')}));
  var l=h('div',{class:'mini-list'});
  M.items.forEach(function(it){ var st=mstat(it), iv=[]; if(it.h) iv.push(T('κάθε ','every ')+it.h+' h'); if(it.mo) iv.push(it.mo+T(' μήνες',' months'));
    l.append(h('div',{class:'mrow mtrow '+st.lv},h('button',{type:'button',class:'mtname',onclick:function(){ maintEdit(it); }},h('b',{text:it.name}),h('small',{text:(iv.join(T(' ή ',' or '))||T('χωρίς διάστημα','no interval'))+' · '+st.tx})),
      h('button',{class:'btn sm'+(st.lv==='bad'||st.lv==='warn'?' pri':''),type:'button',text:T('Έγινε','Done'),onclick:function(){ var X=Mload(); X.items.forEach(function(q){ if(q.id===it.id){ q.last={h:engH(),t:Date.now()}; delete X.sent[q.id]; } }); Msave(X); draw(); B.toast(T('Καταγράφηκε: ','Logged: ')+it.name); }}))); });
  c.append(l,h('button',{class:'btn',type:'button',text:T('+ Νέο στοιχείο','+ New item'),onclick:function(){ maintEdit(null); }}));
  return c; }
/* υπενθύμιση μία φορά την εβδομάδα για κάθε στοιχείο που πλησιάζει ή καθυστερεί */
setTimeout(function(){ if(B.prof()!=='boat') return; var M=Mload(), now=Date.now(), ch=false; M.items.forEach(function(it){ var st=mstat(it); if(st.lv!=='bad'&&st.lv!=='warn') return; if(M.sent[it.id]&&now-M.sent[it.id]<7*86400000) return; M.sent[it.id]=now; ch=true;
  B.toast('🔧 '+it.name+' · '+(st.lv==='bad'?T('Εκπρόθεσμο.','Overdue.'):T('Πλησιάζει η ώρα.','Coming due.')),6000); if(B.inboxAdd) B.inboxAdd('🔧 '+it.name,st.lv==='bad'?T('Εκπρόθεσμη συντήρηση.','Maintenance overdue.'):T('Πλησιάζει η ώρα για συντήρηση.','Maintenance coming due.'),'maint'); }); if(ch) Msave(M); },12000);
function draw(){
  if(!root) return;
  var b=D(), s=Sm(), page=h('div',{class:'page'}), y=window.scrollY;
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω στο Προφίλ','Back to Profile'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Σκάφος','Boat')}))));
  /* σύνοψη */
  var eh=+s.eng.h||0, toSrv=s.eng.every?Math.round(s.eng.every-(eh-(+s.eng.last||0))):null, due=dueList(b,s), attn=due.filter(function(o){ return o.lv==='bad'||o.lv==='warn'; }).concat(B.maintDue().map(function(it){ var st=mstat(it); return {name:'🔧 '+it.name,lv:st.lv,d:null,mt:st.tx}; }));
  var sum=h('section',{class:'card'},h('h2',{text:(b.boat.name||T('Η βάρκα μου','My boat'))}),h('p',{class:'sub',style:{margin:'-4px 0 12px'},text:[b.boat.model,b.boat.len?b.boat.len+' m':'',b.eng.model?b.eng.model+(b.eng.hp?' '+b.eng.hp+' hp':''):''].filter(Boolean).join(' · ')||T('Συμπλήρωσε τα στοιχεία πιο κάτω.','Fill in the details below.')}));
  sum.append(h('div',{class:'kpis'},[[B.num(eh,1)+' h',T('ώρες κινητήρα','engine hours')],[toSrv!=null?Math.max(0,toSrv)+' h':'–',T('ως το service','to service')],[s.fuel?Math.round(s.fuel.L)+' L':'–',T('καύσιμο','fuel')],[String(attn.length),T('θέλουν προσοχή','need attention')]].map(function(k){ return h('div',{class:'kpi'},h('b',{text:k[0]}),h('span',{text:k[1]})); })));
  if(attn.length){ var al=h('div',{class:'mini-list'}); attn.forEach(function(o){ al.append(h('div',{class:'mrow'},h('b',{text:o.name}),tag(o),h('span'))); }); sum.append(al); }
  else sum.append(h('p',{class:'sub',text:T('Καμία λήξη τις επόμενες εβδομάδες.','Nothing expiring in the coming weeks.')}));
  var limSlot=B.limitsCard?B.limitsCard():null; page.append(sum); var BT=ls.get('psaro-v4-btab','gen'); page.append(B.seg([['gen',T('Γενικά','General')],['eng',T('Κινητήρας','Engine')],['exp',T('Λήξεις','Expiries')],['bat',T('Μπαταρίες','Batteries')]],BT,function(v){ ls.set('psaro-v4-btab',v); draw(); },T('Ενότητα σκάφους','Boat section'))); function on(t){ return BT===t; } if(on('gen')&&limSlot) page.append(limSlot);
  /* σκάφος */
  var c1=h('section',{class:'card'},h('h2',{text:T('Στοιχεία σκάφους','Boat details')})), g1=h('div',{class:'g2'});
  [['name',T('Όνομα','Name'),'text'],['model',T('Κατασκευαστής / μοντέλο','Builder / model'),'text'],['len',T('Μήκος (m)','Length (m)'),'number'],['hull',T('Υλικό γάστρας','Hull material'),'text'],['reg',T('Αριθμός νηολογίου','Registration no.'),'text'],['year',T('Έτος','Year'),'number']].forEach(function(f){
    g1.append(fld(f[1],inp(f[2],b.boat[f[0]],'',function(v){ var x=D(); x.boat[f[0]]=v; saveB(x); if(f[0]==='name'||f[0]==='model'||f[0]==='len') draw(); }))); });
  c1.append(g1); if(on('gen')) page.append(c1);
  /* κινητήρας */
  var c2=h('section',{class:'card'},h('h2',{text:T('Κινητήρας','Engine')})), g2=h('div',{class:'g2'});
  [['model',T('Μάρκα / μοντέλο','Make / model'),'text'],['hp',T('Ίπποι','Horsepower'),'number'],['serial',T('Σειριακός αριθμός','Serial number'),'text'],['year',T('Έτος','Year'),'number']].forEach(function(f){
    g2.append(fld(f[1],inp(f[2],b.eng[f[0]],'',function(v){ var x=D(); x.eng[f[0]]=v; saveB(x); if(f[0]==='model'||f[0]==='hp') draw(); }))); });
  g2.append(fld(T('Ώρες κινητήρα τώρα','Engine hours now'),inp('number',s.eng.h,'0',function(v){ var x=Sm(); x.eng.h=v||0; saveS(x); draw(); })),fld(T('Service κάθε (ώρες)','Service every (h)'),inp('number',s.eng.every,'100',function(v){ var x=Sm(); x.eng.every=v||0; saveS(x); draw(); })));
  c2.append(g2,h('div',{class:'acts'},h('span',{class:'sub',style:{flex:'2',alignSelf:'center'},text:T('Τελευταίο service στις ','Last service at ')+(+s.eng.last||0)+' h'}),h('button',{class:'btn pri',type:'button',text:T('Έγινε service','Service done'),onclick:function(){ var x=Sm(), bb=D(); x.eng.last=x.eng.h; saveS(x); bb.log.unshift({id:uid(),date:today(),h:x.eng.h,note:'Service'}); saveB(bb); draw(); B.toast(T('Καταγράφηκε service.','Service logged.')); }})));
  if(on('eng')) page.append(c2);
  if(on('eng')) page.append(maintCard());
  /* καύσιμο */
  var c3=h('section',{class:'card'},h('h2',{text:T('Καύσιμο και ταχύτητα','Fuel and speed')}),h('p',{class:'sub',style:{margin:'-4px 0 12px'},text:T('Για την ώρα επιστροφής και την αυτονομία στον χάρτη.','Used for return time and range on the map.')})), g3=h('div',{class:'g2'});
  g3.append(fld(T('Ταχύτητα πλεύσης (kn)','Cruise speed (kn)'),inp('number',s.cruise,'15',function(v){ var x=Sm(); x.cruise=v>0?v:15; saveS(x); })),fld(T('Ρεζερβουάρ (L)','Tank (L)'),inp('number',s.tank,'',function(v){ var x=Sm(); x.tank=v; if(v>0&&!x.fuel) x.fuel={L:v,t:Date.now()}; saveS(x); draw(); })),
    fld(T('Κατανάλωση (L/ώρα)','Burn (L/h)'),inp('number',s.burn,'',function(v){ var x=Sm(); x.burn=v; saveS(x); })),fld(T('Εφεδρεία (%)','Reserve (%)'),inp('number',s.reserve,'20',function(v){ var x=Sm(); x.reserve=v==null?20:v; saveS(x); })),
    fld(T('Καύσιμο τώρα (L)','Fuel now (L)'),inp('number',s.fuel?Math.round(s.fuel.L):'','',function(v){ if(v==null) return; var x=Sm(); x.fuel={L:v,t:Date.now()}; saveS(x); draw(); })));
  c3.append(g3); if(on('gen')) page.append(c3);
  /* ημερολόγιο ωρών */
  var c4=h('section',{class:'card'},h('h2',{text:T('Ημερολόγιο ωρών μηχανής','Engine hours log')}));
  var ld=h('input',{type:'date',value:today(),'aria-label':T('Ημερομηνία','Date')}), lh=h('input',{type:'number',inputmode:'decimal',step:'any',min:'0',placeholder:T('ώρες','hours'),'aria-label':T('Ώρες','Hours')}), ln=h('input',{type:'text',maxlength:'80',placeholder:T('σημείωση (π.χ. λάδια)','note (e.g. oil change)'),'aria-label':T('Σημείωση','Note')});
  c4.append(h('div',{class:'logadd'},ld,lh,ln,h('button',{class:'btn pri',type:'button',text:T('Προσθήκη','Add'),onclick:function(){ var hv=lh.value===''?null:+lh.value; if(hv==null||!(hv>=0)){ B.toast(T('Γράψε τις ώρες.','Enter the hours.')); return; }
    var x=D(); x.log.unshift({id:uid(),date:ld.value||today(),h:hv,note:ln.value.trim().slice(0,80)}); x.log.sort(function(p,q){ return q.h-p.h; }); saveB(x); var sm=Sm(); if(hv>(+sm.eng.h||0)){ sm.eng.h=hv; saveS(sm); } draw(); }})));
  if(b.log.length){ var tl=h('div',{class:'mini-list'}); b.log.slice(0,30).forEach(function(r,i){ var nx=b.log[i+1];
    tl.append(h('div',{class:'mrow'},h('span',{text:dF(r.date)+(r.note?' · '+r.note:'')}),h('b',{text:r.h+' h'+(nx&&r.h>=nx.h?' (+'+B.num(r.h-nx.h,1)+')':'')}),h('button',{class:'del',type:'button','aria-label':T('Διαγραφή','Delete'),html:B.iconSvg('trash'),onclick:function(){ var x=D(); x.log=x.log.filter(function(q){ return q.id!==r.id; }); saveB(x); draw(); }}))); }); c4.append(tl); }
  if(on('eng')) page.append(c4);
  /* λήξεις */
  var c5=h('section',{class:'card'},h('h2',{text:T('Λήξεις','Expiry dates')}),h('p',{class:'sub',style:{margin:'-4px 0 8px'},text:T('Ημερομηνία λήξης ή επόμενης επιθεώρησης, και πόσες μέρες πριν να σου θυμίσει.','Expiry or next inspection date, and how many days before to remind you.')}));
  b.exp.forEach(function(x){ var o=lv(x.date,x.lead||30);
    c5.append(h('div',{class:'expr'},h('div',{class:'exph'},h('b',{text:x.name}),tag(o)),h('div',{class:'g2'},fld(T('Ημερομηνία','Date'),inp('date',x.date,'',function(v){ var bb=D(); bb.exp.forEach(function(q){ if(q.id===x.id) q.date=v||''; }); saveB(bb); draw(); })),fld(T('Υπενθύμιση (ημέρες πριν)','Remind (days before)'),inp('number',x.lead,'30',function(v){ var bb=D(); bb.exp.forEach(function(q){ if(q.id===x.id) q.lead=v==null?30:v; }); saveB(bb); draw(); }))),
      x.std?null:h('button',{class:'link',type:'button',style:{color:'var(--poor)'},text:T('Διαγραφή','Delete'),onclick:function(){ var bb=D(); bb.exp=bb.exp.filter(function(q){ return q.id!==x.id; }); saveB(bb); draw(); }}))); });
  var ln2=h('input',{type:'date',value:s.lic||''}); ln2.addEventListener('change',function(){ var x=Sm(); x.lic=ln2.value||null; saveS(x); draw(); });
  c5.append(h('div',{class:'expr'},h('div',{class:'exph'},h('b',{text:T('Άδεια ψαρέματος','Fishing licence')}),tag(lv(s.lic,14))),fld(T('Λήξη','Expiry'),ln2)));
  var nn=h('input',{type:'text',maxlength:'50',placeholder:T('π.χ. Άδεια σκάφους','e.g. Boat licence')});
  c5.append(h('div',{class:'inrow'},nn,h('button',{class:'btn',type:'button',text:T('+ Νέα λήξη','+ New item'),onclick:function(){ var v=nn.value.trim(); if(!v) { nn.focus(); return; } var x=D(); x.exp.push({id:uid(),name:v.slice(0,50),date:'',lead:30}); saveB(x); draw(); }})));
  if(on('exp')) page.append(c5);
  /* αντιρρυπαντική */
  var c6=h('section',{class:'card'},h('h2',{text:T('Αντιρρυπαντική (μουράβια)','Antifouling')})), g6=h('div',{class:'g2'});
  g6.append(fld(T('Ημερομηνία εφαρμογής','Date applied'),inp('date',b.af.date,'',function(v){ var x=D(); x.af.date=v||''; saveB(x); draw(); })),fld(T('Επανάληψη κάθε (μήνες)','Reapply every (months)'),inp('number',b.af.mo,'12',function(v){ var x=D(); x.af.mo=v>0?v:12; saveB(x); draw(); })),fld(T('Προϊόν','Product'),inp('text',b.af.prod,T('π.χ. Hempel','e.g. Hempel'),function(v){ var x=D(); x.af.prod=v; saveB(x); })));
  c6.append(g6); if(b.af.date){ var nx=addM(b.af.date,b.af.mo||12); c6.append(h('div',{class:'exph',style:{marginTop:'10px'}},h('span',{text:T('Νέα εφαρμογή: ','Reapply: ')+dF(nx)}),tag(lv(nx,30)))); }
  if(on('exp')) page.append(c6);
  /* μπαταρίες */
  var c7=h('section',{class:'card'},h('h2',{text:T('Μπαταρίες','Batteries')}),h('p',{class:'sub',style:{margin:'-4px 0 8px'},text:T('Ενδεικτική αλλαγή: μολύβδου ~4 χρόνια, AGM/Gel ~5, λιθίου ~10.','Indicative replacement: lead-acid ~4 years, AGM/Gel ~5, lithium ~10.')}));
  b.bat.forEach(function(x){ var nx=x.inst?addM(x.inst,(BAT_LIFE[x.type]||4)*12):null, o=lv(nx,60);
    var upd=function(k){ return function(v){ var bb=D(); bb.bat.forEach(function(q){ if(q.id===x.id) q[k]=v; }); saveB(bb); if(k!=='ah'&&k!=='chk') draw(); }; };
    var ty=h('select',{class:'select'}); BTYP.forEach(function(t){ ty.append(h('option',{value:t[0],text:t[1]})); }); ty.value=x.type||'agm'; ty.addEventListener('change',function(){ upd('type')(ty.value); });
    var vtxt=null; if(x.v>0){ var full=x.type==='lith'?13.3:12.7, low=x.type==='lith'?12.9:12.2; vtxt=x.v>=full?T('Τάση: γεμάτη.','Voltage: full.'):x.v>=low?T('Τάση: μισοφορτισμένη. Φόρτισέ τη.','Voltage: partly charged. Charge it.'):T('Τάση χαμηλή. Φόρτισέ τη και έλεγξέ τη.','Voltage low. Charge and test it.'); }
    c7.append(h('div',{class:'expr'},h('div',{class:'exph'},h('b',{text:x.name||T('Μπαταρία','Battery')}),nx?tag(o):null),
      h('div',{class:'g2'},fld(T('Όνομα','Name'),inp('text',x.name,T('π.χ. Μίζα','e.g. Starter'),upd('name'))),fld(T('Τύπος','Type'),ty),fld('Ah',inp('number',x.ah,'',upd('ah'))),fld(T('Τοποθέτηση','Installed'),inp('date',x.inst,'',upd('inst'))),fld(T('Τελευταίος έλεγχος','Last check'),inp('date',x.chk,'',upd('chk'))),fld(T('Τάση (V)','Voltage (V)'),inp('number',x.v,'12.6',upd('v')))),
      vtxt?h('p',{class:'sub',text:vtxt}):null,nx?h('p',{class:'sub',text:T('Προτεινόμενη αλλαγή: ','Suggested replacement: ')+dF(nx)}):null,
      h('button',{class:'link',type:'button',style:{color:'var(--poor)'},text:T('Διαγραφή μπαταρίας','Delete battery'),onclick:function(){ var bb=D(); bb.bat=bb.bat.filter(function(q){ return q.id!==x.id; }); saveB(bb); draw(); }}))); });
  c7.append(h('button',{class:'btn',type:'button',text:T('+ Μπαταρία','+ Battery'),onclick:function(){ var x=D(); x.bat.push({id:uid(),name:'',type:'agm',inst:today()}); saveB(x); draw(); }}));
  if(on('bat')) page.append(c7);
  if(B.smart&&on('gen')) page.append(portCard());
  page.append(h('p',{class:'foot',text:T('Τα στοιχεία μπαίνουν στο αντίγραφο ασφαλείας. Οι εκτιμήσεις (ώρα επιστροφής, καύσιμο) είναι ενδεικτικές και δεν αντικαθιστούν την κρίση σου.','The details are included in the backup. Estimates (return time, fuel) are indicative and do not replace your judgement.')}));
  root.replaceChildren(page); try{ window.scrollTo(0,y); }catch(e){}
}
B.view('boat',{title:T('Σκάφος','Boat'),mount:function(el){ root=el; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
})();
