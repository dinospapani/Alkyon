/* BiteCast 4 · Σκάφος (#boat): στοιχεία, κινητήρας και ώρες, καύσιμο, λήξεις, αντιρρυπαντική, μπαταρίες.
   Ίδια δεδομένα με την κλασική: psaro-boat και psaro-smart (ώρες κινητήρα, καύσιμο, άδεια ψαρέματος). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls, root=null, DAY=86400000;
var EXP_DEF=[['insp',T('Επιθεώρηση σκάφους','Boat inspection'),30],['ext',T('Πυροσβεστήρας','Fire extinguisher'),30],['vhf',T('Άδεια ασυρμάτου (VHF)','Radio licence (VHF)'),30],['ins',T('Ασφάλεια σκάφους','Boat insurance'),30],['flare',T('Φωτοβολίδες','Flares'),30],['epirb',T('EPIRB / PLB (μπαταρία)','EPIRB / PLB (battery)'),60],['raft',T('Σωσίβια σχεδία (σέρβις)','Liferaft (service)'),30]];
/* v31z549: προτεινόμενες λήξεις για «+ Νέα λήξη» [κλειδί, όνομα, ημέρες υπενθύμισης, συνήθης ισχύς σε μήνες] */
var EXP_SUG=[['skip',T('Δίπλωμα χειριστή','Skipper’s licence'),60,0],['reg',T('Άδεια / νηολόγηση σκάφους','Boat licence / registration'),30,12],['lj',T('Φουσκωτά σωσίβια (σέρβις)','Inflatable lifejackets (service)'),30,12],
  ['co2',T('Φιάλες CO2 σωσιβίων','Lifejacket CO2 cylinders'),30,12],['aid',T('Φαρμακείο πρώτων βοηθειών','First-aid kit'),30,12],['plb',T('PLB προσωπικό (μπαταρία)','Personal PLB (battery)'),60,0],
  ['hvhf',T('Ασύρματος χειρός (μπαταρία)','Handheld VHF (battery)'),30,0],['spear',T('Άδεια ψαροντουφέκου','Spearfishing licence'),14,12],['berth',T('Θέση στη μαρίνα','Marina berth'),30,12],
  ['ttax',T('Τέλη κυκλοφορίας τρέιλερ','Trailer road tax'),30,12],['tmot',T('MOT τρέιλερ','Trailer MOT'),30,24],['tins',T('Ασφάλεια τρέιλερ','Trailer insurance'),30,12],
  ['hydro',T('Υδροστατικός έλεγχος πυροσβεστήρα','Extinguisher pressure test'),30,60],['eng',T('Ασφάλεια / εγγύηση μηχανής','Engine warranty / cover'),30,12]];
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
  var M=Mload(), c=h('section',{class:'card'},h('h2',{text:T('Πρόγραμμα συντήρησης','Maintenance schedule')}),h('p',{class:'sub',style:{margin:'-4px 0 8px'},text:T('Με βάση τις ώρες κινητήρα (','Based on engine hours (')+B.num(engH(),1)+' h) '+T('και τον χρόνο. Πάτα ✓ όταν το κάνεις.','and time. Tap ✓ when you do it.')}));
  var l=h('div',{class:'mini-list'});
  M.items.forEach(function(it){ var st=mstat(it), iv=[]; if(it.h) iv.push(T('κάθε ','every ')+it.h+' h'); if(it.mo) iv.push(it.mo+T(' μήνες',' months'));
    l.append(h('div',{class:'mrow mtrow '+st.lv},h('button',{type:'button',class:'mtname',onclick:function(){ maintEdit(it); }},h('b',{text:it.name}),h('small',{text:(iv.join(T(' ή ',' or '))||T('χωρίς διάστημα','no interval'))+(st.lv==='n'?'':' · '+st.tx)})),
      h('button',{class:'mtdone'+(st.lv==='bad'||st.lv==='warn'?' due':''),type:'button','aria-label':T('Έγινε: ','Done: ')+it.name,title:T('Έγινε','Done'),html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',onclick:function(){ var X=Mload(); X.items.forEach(function(q){ if(q.id===it.id){ q.last={h:engH(),t:Date.now()}; delete X.sent[q.id]; } }); Msave(X); draw(); B.toast(T('Καταγράφηκε: ','Logged: ')+it.name); }}))); });
  c.append(l,h('button',{class:'btn',type:'button',text:T('+ Νέο στοιχείο','+ New item'),onclick:function(){ maintEdit(null); }}));
  return c; }
/* υπενθύμιση μία φορά την εβδομάδα για κάθε στοιχείο που πλησιάζει ή καθυστερεί */
setTimeout(function(){ if(B.prof()!=='boat') return; var M=Mload(), now=Date.now(), ch=false; M.items.forEach(function(it){ var st=mstat(it); if(st.lv!=='bad'&&st.lv!=='warn') return; if(M.sent[it.id]&&now-M.sent[it.id]<7*86400000) return; M.sent[it.id]=now; ch=true;
  B.toast('🔧 '+it.name+' · '+(st.lv==='bad'?T('Εκπρόθεσμο.','Overdue.'):T('Πλησιάζει η ώρα.','Coming due.')),6000); if(B.inboxAdd) B.inboxAdd('🔧 '+it.name,st.lv==='bad'?T('Εκπρόθεσμη συντήρηση.','Maintenance overdue.'):T('Πλησιάζει η ώρα για συντήρηση.','Maintenance coming due.'),'maint'); }); if(ch) Msave(M); },12000);
/* ---------- v31z530: νέα σελίδα σκάφους — κάρτα σκάφους, δείκτες κατάστασης, «θέλει προσοχή», χρονολόγιο λήξεων, συντήρηση με μπάρες, μπαταρίες σε κάρτες ---------- */
var PEN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>', CAM='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
function P(){ return B.store&&B.store.Photos; }
function bar(frac,cls){ var f=Math.max(0,Math.min(1,frac||0)), c=cls||(frac>=1?'bad':frac>=0.9?'warn':'ok'); return h('span',{class:'bbar '+c},h('i',{style:{width:Math.round(f*100)+'%'}})); }
function goTab(t){ ls.set('psaro-v4-btab',t); draw(); var sg=root&&root.querySelector('.bseg'); if(sg) try{ sg.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} }
function sheetForm(title,nodes,onSave,extra){ var sh, f=h('form',{class:'bform',novalidate:true}); nodes.forEach(function(n){ if(n) f.append(n); });
  f.append(h('button',{class:'btn pri full',type:'submit',text:T('Αποθήκευση','Save')})); if(extra) f.append(extra(function(){ sh.close(); }));
  f.addEventListener('submit',function(ev){ ev.preventDefault(); if(onSave()!==false){ sh.close(); draw(); } }); sh=B.sheet({title:title,body:f}); return sh; }
function vIn(type,val,ph){ var i=h('input',{type:type,value:val==null?'':val,placeholder:ph||null}); if(type==='number'){ i.inputMode='decimal'; i.step='any'; i.min='0'; } return i; }
function nv(i){ return i.value===''?null:+i.value; }
/* στοιχεία σκάφους και μηχανής σε φύλλο (όχι μόνιμα ανοιχτά πεδία) */
function editBoat(){ var b=D(), F={}, E={};
  var bf=[['name',T('Όνομα','Name'),'text'],['model',T('Κατασκευαστής / μοντέλο','Builder / model'),'text'],['len',T('Μήκος (m)','Length (m)'),'number'],['hull',T('Υλικό γάστρας','Hull material'),'text'],['reg',T('Αριθμός νηολογίου','Registration no.'),'text'],['year',T('Έτος','Year'),'number']];
  var ef=[['model',T('Μηχανή (μάρκα / μοντέλο)','Engine (make / model)'),'text'],['hp',T('Ίπποι','Horsepower'),'number'],['serial',T('Σειριακός αριθμός','Serial number'),'text'],['year',T('Έτος μηχανής','Engine year'),'number']];
  var g1=h('div',{class:'g2'}), g2=h('div',{class:'g2'});
  bf.forEach(function(f){ F[f[0]]=vIn(f[2],b.boat[f[0]]); g1.append(fld(f[1],F[f[0]])); }); ef.forEach(function(f){ E[f[0]]=vIn(f[2],b.eng[f[0]]); g2.append(fld(f[1],E[f[0]])); });
  var fi=h('input',{type:'file',accept:'image/*',hidden:true}), phMsg=h('small',{class:'sub'});
  fi.addEventListener('change',function(){ var fl=fi.files&&fi.files[0]; if(!fl||!P()) return; phMsg.textContent=T('Αποθήκευση φωτογραφίας…','Saving photo…');
    B.store.resize(fl).then(function(bl){ return P().put('boat-hero',bl); }).then(function(){ var x=D(); x.boat.photo=1; saveB(x); phMsg.textContent=T('Η φωτογραφία αποθηκεύτηκε.','Photo saved.'); draw(); }).catch(function(){ phMsg.textContent=T('Η φωτογραφία δεν αποθηκεύτηκε.','The photo was not saved.'); }); });
  var phRow=h('div',{class:'acts'},h('button',{class:'btn',type:'button',html:CAM+'<span>'+(b.boat.photo?T('Αλλαγή φωτογραφίας','Change photo'):T('Φωτογραφία σκάφους','Boat photo'))+'</span>',onclick:function(){ fi.click(); }}),
    b.boat.photo?h('button',{class:'btn',type:'button',text:T('Αφαίρεση','Remove'),onclick:function(){ if(P()) P().del('boat-hero').catch(function(){}); var x=D(); delete x.boat.photo; saveB(x); phMsg.textContent=T('Αφαιρέθηκε.','Removed.'); draw(); }}):null);
  sheetForm(T('Στοιχεία σκάφους','Boat details'),[h('h3',{class:'listh',text:T('Σκάφος','Boat')}),g1,h('h3',{class:'listh',text:T('Μηχανή','Engine')}),g2,h('h3',{class:'listh',text:T('Φωτογραφία','Photo')}),phRow,fi,phMsg],function(){
    var x=D(); bf.forEach(function(f){ var v=f[2]==='number'?nv(F[f[0]]):F[f[0]].value.trim(); if(v===''||v==null) delete x.boat[f[0]]; else x.boat[f[0]]=v; });
    ef.forEach(function(f){ var v=f[2]==='number'?nv(E[f[0]]):E[f[0]].value.trim(); if(v===''||v==null) delete x.eng[f[0]]; else x.eng[f[0]]=v; }); saveB(x); B.toast(T('Αποθηκεύτηκαν.','Saved.')); }); }
/* λήξη: επεξεργασία (κανονικές, άδεια ψαρέματος, αντιρρυπαντική) */
function expEdit(key){
  if(key==='lic'){ var s=Sm(), d=vIn('date',s.lic||''); return sheetForm(T('Άδεια ψαρέματος','Fishing licence'),[fld(T('Λήξη','Expiry'),d),h('small',{class:'sub',text:T('Υπενθύμιση 14 ημέρες πριν.','Reminder 14 days before.')})],function(){ var x=Sm(); x.lic=d.value||null; saveS(x); }); }
  if(key==='af'){ var b=D(), ad=vIn('date',b.af.date||''), mo=vIn('number',b.af.mo||12,'12'), pr=vIn('text',b.af.prod||'',T('π.χ. Hempel','e.g. Hempel'));
    return sheetForm(T('Αντιρρυπαντική (μουράβια)','Antifouling'),[h('div',{class:'g2'},fld(T('Ημερομηνία εφαρμογής','Date applied'),ad),fld(T('Επανάληψη κάθε (μήνες)','Reapply every (months)'),mo)),fld(T('Προϊόν','Product'),pr)],function(){ var x=D(); x.af.date=ad.value||''; x.af.mo=nv(mo)>0?nv(mo):12; x.af.prod=pr.value.trim(); saveB(x); }); }
  var b2=D(), it=key?b2.exp.filter(function(q){ return q.id===key; })[0]:null, nm=vIn('text',it?it.name:'',T('π.χ. Άδεια σκάφους','e.g. Boat licence')), dd=vIn('date',it?it.date:''), le=vIn('number',it?(it.lead||30):30,'30'), sugBox=null, pick=null;
  if(!it){ /* v31z549: λίστα με προτεινόμενα (όσα δεν έχεις ήδη) + δικό σου όνομα */
    var have={}; b2.exp.forEach(function(q){ have[q.id]=1; have[String(q.name||'').toLowerCase()]=1; });
    var sug=EXP_DEF.map(function(x){ return [x[0],x[1],x[2],0,1]; }).concat(EXP_SUG).filter(function(x){ return !have[x[0]]&&!have[String(x[1]).toLowerCase()]; });
    var hint=h('small',{class:'sub esghint'});
    sugBox=h('div',{class:'esg'},h('span',{class:'esgl',text:T('Προτεινόμενα','Suggested')}),h('div',{class:'chips esgc'},sug.map(function(x){ return h('button',{type:'button',class:'chip sm','aria-pressed':'false',text:x[1],onclick:function(ev){
      [].forEach.call(sugBox.querySelectorAll('.esgc .chip'),function(c){ c.setAttribute('aria-pressed','false'); }); ev.currentTarget.setAttribute('aria-pressed','true');
      pick=x; nm.value=x[1]; le.value=x[2]; hint.textContent=x[3]?T('Συνήθως ανανεώνεται κάθε ','Usually renewed every ')+(x[3]%12?x[3]+T(' μήνες',' months'):(x[3]/12)+T(x[3]===12?' χρόνο':' χρόνια',x[3]===12?' year':' years'))+'.':''; try{ dd.focus(); }catch(e){} }}); })),hint,
      h('span',{class:'esgl',text:sug.length?T('…ή γράψε δικό σου','…or type your own'):T('Γράψε όνομα','Type a name')}));
    nm.addEventListener('input',function(){ if(pick&&nm.value!==pick[1]){ pick=null; [].forEach.call(sugBox.querySelectorAll('.esgc .chip'),function(c){ c.setAttribute('aria-pressed','false'); }); hint.textContent=''; } }); }
  return sheetForm(it?it.name:T('Νέα λήξη','New expiry'),[sugBox,it&&it.std?null:fld(T('Όνομα','Name'),nm),h('div',{class:'g2'},fld(T('Ημερομηνία λήξης','Expiry date'),dd),fld(T('Υπενθύμιση (ημέρες πριν)','Remind (days before)'),le))],function(){
    var x=D(), o=it?x.exp.filter(function(q){ return q.id===it.id; })[0]:null; if(!o){ var v=nm.value.trim(); if(!v){ nm.focus(); return false; } o={id:(pick&&!x.exp.some(function(q){ return q.id===pick[0]; }))?pick[0]:uid(),name:'',date:'',lead:30}; if(pick&&pick[4]) o.std=1; x.exp.push(o); }
    if(nm.value.trim()&&(!o.std||!it)) o.name=nm.value.trim().slice(0,50); o.date=dd.value||''; o.lead=nv(le)==null?30:nv(le); saveB(x); },
    it?function(close){ return h('button',{class:'btn full del',type:'button',text:it.std?T('Αφαίρεση από τη λίστα','Remove from the list'):T('Διαγραφή','Delete'),onclick:function(){ var x=D(); x.exp=x.exp.filter(function(q){ return q.id!==it.id; }); saveB(x); close(); draw(); }}); }:null); }
/* μπαταρία: επεξεργασία */
function batEdit(id){ var b=D(), x=b.bat.filter(function(q){ return q.id===id; })[0]; if(!x) return;
  var nm=vIn('text',x.name,T('π.χ. Μίζα','e.g. Starter')), ty=h('select',{class:'select'}); BTYP.forEach(function(t){ ty.append(h('option',{value:t[0],text:t[1]})); }); ty.value=x.type||'agm';
  var ah=vIn('number',x.ah), ins=vIn('date',x.inst), ck=vIn('date',x.chk), vv=vIn('number',x.v,'12.6');
  sheetForm(x.name||T('Μπαταρία','Battery'),[h('div',{class:'g2'},fld(T('Όνομα','Name'),nm),fld(T('Τύπος','Type'),ty),fld('Ah',ah),fld(T('Τάση (V)','Voltage (V)'),vv),fld(T('Τοποθέτηση','Installed'),ins),fld(T('Τελευταίος έλεγχος','Last check'),ck))],function(){
    var X=D(); X.bat.forEach(function(q){ if(q.id!==id) return; q.name=nm.value.trim(); q.type=ty.value; q.ah=nv(ah); q.inst=ins.value||''; q.chk=ck.value||''; q.v=nv(vv); }); saveB(X); },
    function(close){ return h('button',{class:'btn full del',type:'button',text:T('Διαγραφή μπαταρίας','Delete battery'),onclick:function(){ var X=D(); X.bat=X.bat.filter(function(q){ return q.id!==id; }); saveB(X); close(); draw(); }}); }); }
function fuelEdit(){ var s=Sm(), fu=vIn('number',s.fuel?Math.round(s.fuel.L):''), tk=vIn('number',s.tank), cr=vIn('number',s.cruise,'15'), bu=vIn('number',s.burn), rs=vIn('number',s.reserve,'20');
  sheetForm(T('Καύσιμο και ταχύτητα','Fuel and speed'),[h('div',{class:'g2'},fld(T('Καύσιμο τώρα (L)','Fuel now (L)'),fu),fld(T('Ρεζερβουάρ (L)','Tank (L)'),tk),fld(T('Ταχύτητα πλεύσης (kn)','Cruise speed (kn)'),cr),fld(T('Κατανάλωση (L/ώρα)','Burn (L/h)'),bu),fld(T('Εφεδρεία (%)','Reserve (%)'),rs)),h('small',{class:'sub',text:T('Για την ώρα επιστροφής και την αυτονομία στον χάρτη.','Used for return time and range on the map.')})],function(){
    var x=Sm(); x.tank=nv(tk); x.cruise=nv(cr)>0?nv(cr):15; x.burn=nv(bu); x.reserve=nv(rs)==null?20:nv(rs); if(nv(fu)!=null) x.fuel={L:nv(fu),t:Date.now()}; else if(x.tank>0&&!x.fuel) x.fuel={L:x.tank,t:Date.now()}; saveS(x); }); }
function pickPhoto(){ var fi=h('input',{type:'file',accept:'image/*'}); fi.addEventListener('change',function(){ var fl=fi.files&&fi.files[0]; if(!fl||!P()) return; B.toast(T('Αποθήκευση φωτογραφίας…','Saving photo…'));
    B.store.resize(fl).then(function(bl){ return P().put('boat-hero',bl); }).then(function(){ var x=D(); x.boat.photo=1; saveB(x); draw(); }).catch(function(){ B.toast(T('Η φωτογραφία δεν αποθηκεύτηκε.','The photo was not saved.')); }); }); fi.click(); }
var ICAL='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>', IWR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5L17 4l3 3-2.5 2.5"/></svg>';
/* ουδέτερο σχέδιο σκάφους κέντρου κονσόλας (όχι φωτογραφία άλλης βάρκας) */
var BOAT_ILL='<svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="bsk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d5d7a"/><stop offset="1" stop-color="#0f3a4f"/></linearGradient><linearGradient id="bse" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d4a63"/><stop offset="1" stop-color="#062a39"/></linearGradient></defs>'
  +'<rect width="400" height="150" fill="url(#bsk)"/><rect y="98" width="400" height="52" fill="url(#bse)"/><path d="M0 104c40-5 80 5 120 0s80-5 120 0 80 5 160 0" stroke="#4fb3d6" stroke-opacity=".35" fill="none" stroke-width="2"/>'
  +'<g transform="translate(318 52) scale(.78)" fill="none" stroke="#e9f4f8" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" opacity=".92"><path d="M-80 58h150l22-20H-70z" fill="#e9f4f8" fill-opacity=".12"/><path d="M-70 38l8-6h126l28 6"/><path d="M-20 32V8h34l8 24"/><path d="M-26 8h48"/><path d="M-3 8V-6M-14 -6h22"/><path d="M-60 32v-8M70 32v-6"/><path d="M-78 58l-6 10h170l10-10" stroke-opacity=".6"/></g></svg>';
function mDone(it){ var X=Mload(); X.items.forEach(function(q){ if(q.id===it.id){ q.last={h:engH(),t:Date.now()}; delete X.sent[q.id]; } }); Msave(X); draw(); B.toast(T('Καταγράφηκε: ','Logged: ')+it.name); }
function srvDone(){ var x=Sm(), bb=D(); x.eng.last=x.eng.h; saveS(x); bb.log.unshift({id:uid(),date:today(),h:x.eng.h,note:'Service'}); saveB(bb); draw(); B.toast(T('Καταγράφηκε service.','Service logged.')); }
function mfrac(it){ if(!it.last) return null; var eh=engH(), fh=it.h>0?(eh-it.last.h)/it.h:0, fm=it.mo>0?((Date.now()-it.last.t)/86400000)/(it.mo*30.4):0; return Math.max(fh,fm); }
function tile(lbl,big,sub,fr,cls,fn){ return h('button',{type:'button',class:'bgt'+(cls?' '+cls:''),onclick:fn},h('small',{class:'bgl',text:lbl}),h('b',{text:big}),fr!=null?bar(fr,cls):h('span',{class:'bbar none'}),h('small',{class:'bgs',text:sub})); }
function checkBtn(lab,fn,due){ return h('button',{class:'mtdone'+(due?' due':''),type:'button','aria-label':lab,title:lab,html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',onclick:fn}); }
function draw(){
  if(!root) return;
  var b=D(), s=Sm(), page=h('div',{class:'page bpage'}), y=window.scrollY, BT=ls.get('psaro-v4-btab','gen'); if(['gen','eng','exp','bat'].indexOf(BT)<0) BT='gen';
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω στο Προφίλ','Back to Profile'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Σκάφος','Boat')})),
    h('button',{class:'iconbtn bedit',type:'button','aria-label':T('Επεξεργασία στοιχείων','Edit details'),html:PEN,onclick:editBoat})));
  /* κάρτα σκάφους */
  var sub=[b.boat.model,b.boat.len?B.num(+b.boat.len,1)+' m':'',b.eng.model?b.eng.model+(b.eng.hp?' · '+b.eng.hp+' hp':''):(b.eng.hp?b.eng.hp+' hp':'')].filter(Boolean).join(' · ');
  var cov=h('div',{class:'bcov'+(b.boat.photo?'':' ill'),html:b.boat.photo?'':BOAT_ILL}), hero=h('section',{class:'bhero'+(b.boat.photo?'':' noph')},cov,h('div',{class:'bht'},h('b',{text:b.boat.name||T('Η βάρκα μου','My boat')}),h('small',{text:sub||T('Πάτα ✎ για όνομα, μοντέλο και μηχανή','Tap ✎ for name, model and engine')}),b.boat.reg?h('span',{class:'breg',text:b.boat.reg}):null,b.boat.photo?null:h('button',{type:'button',class:'baddph',html:CAM+'<span>'+T('Πρόσθεσε φωτογραφία','Add a photo')+'</span>',onclick:pickPhoto})),
    h('button',{type:'button',class:'bhedit','aria-label':T('Επεξεργασία','Edit'),html:PEN,onclick:editBoat}));
  if(b.boat.photo&&P()) P().get('boat-hero').then(function(bl){ if(bl){ cov.style.backgroundImage='url('+URL.createObjectURL(bl)+')'; cov.classList.add('ph'); } }).catch(function(){});
  page.append(hero);
  /* δείκτες: service, καύσιμο, επόμενη λήξη */
  var eh=+s.eng.h||0, ev=+s.eng.every||0, used=eh-(+s.eng.last||0), due=dueList(b,s), nxt=due.filter(function(o){ return o.d!=null; })[0];
  var gs=h('div',{class:'bgauges'});
  if(eh>0&&ev>0){ var left=Math.round(ev-used), fr=used/ev; gs.append(tile('Service',Math.round(used)+' / '+ev+' h',left<0?T('εκπρόθεσμο ','overdue ')+(-left)+' h':T('σε ','in ')+left+' h',fr,fr>=1?'bad':fr>=0.9?'warn':'ok',function(){ if(fr>=0.9) B.ask(T('Έγινε service στις ','Service done at ')+Math.round(eh)+' h;'.replace(';',T(';','?')),T('Έγινε','Done')).then(function(y){ if(y) srvDone(); }); else goTab('eng'); })); }
  else gs.append(tile('Service','–',T('Όρισε ώρες μηχανής','Set engine hours'),null,'',function(){ goTab('eng'); }));
  if(s.tank>0&&s.fuel&&s.fuel.L!=null){ var ff=s.fuel.L/s.tank, usable=Math.max(0,s.fuel.L-s.tank*(+s.reserve||0)/100), hrs=s.burn>0?usable/s.burn:null;
    gs.append(tile(T('Καύσιμο','Fuel'),Math.round(s.fuel.L)+' / '+Math.round(s.tank)+' L',hrs!=null?'~'+B.num(hrs,1)+T(' ώρες πλεύσης',' h cruising'):T('βάλε κατανάλωση','add burn rate'),ff,ff<=((+s.reserve||20)/100)?'bad':ff<0.35?'warn':'ok',function(){ goTab('gen'); })); }
  else gs.append(tile(T('Καύσιμο','Fuel'),'–',T('Όρισε ρεζερβουάρ','Set tank size'),null,'',function(){ goTab('gen'); }));
  var xt=nxt?h('button',{type:'button',class:'bgx '+nxt.lv,onclick:function(){ goTab('exp'); }},h('span',{class:'bgxi',html:ICAL}),h('span',{class:'bgxt'},h('small',{text:T('Επόμενη λήξη','Next expiry')}),h('b',{text:nxt.name})),tag(nxt))
    :h('button',{type:'button',class:'bgx',onclick:function(){ goTab('exp'); }},h('span',{class:'bgxi',html:ICAL}),h('span',{class:'bgxt'},h('small',{text:T('Λήξεις','Expiries')}),h('b',{text:T('Πρόσθεσε ημερομηνίες','Add dates')})),B.icon('chev'));
  gs.append(xt);
  page.append(gs);
  /* θέλει προσοχή */
  /* το service φαίνεται ήδη στον δείκτη· εδώ μόνο συντήρηση και λήξεις, πρώτα τα εκπρόθεσμα */
  var att=[]; B.maintDue().forEach(function(it){ var st=mstat(it); att.push({ic:IWR,name:it.name,tx:st.tx.split(' · ').slice(0,1).join(''),lv:st.lv,act:checkBtn(T('Έγινε: ','Done: ')+it.name,function(){ mDone(it); },true)}); });
  due.forEach(function(o){ if(o.lv==='bad'||o.lv==='warn') att.push({ic:ICAL,name:o.name,tx:lvTxt(o),lv:o.lv,act:null,go:'exp'}); });
  att.sort(function(a,c){ return (a.lv==='bad'?0:1)-(c.lv==='bad'?0:1); });
  if(att.length){ var ac=h('section',{class:'card batt'},h('h2',null,T('Θέλει προσοχή','Needs attention'),h('span',{class:'bcnt',text:String(att.length)})));
    function arow(a){ return h('div',{class:'batr '+a.lv},h('span',{class:'bati',html:a.ic}),h('button',{type:'button',class:'batx',onclick:a.go?function(){ goTab(a.go); }:null},h('b',{text:a.name}),h('small',{text:a.tx})),a.act); }
    att.slice(0,3).forEach(function(a){ ac.append(arow(a)); });
    if(att.length>3){ var more=h('details',{class:'bmore'},h('summary',{text:'+'+(att.length-3)+T(' ακόμα',' more')})); att.slice(3).forEach(function(a){ more.append(arow(a)); }); ac.append(more); }
    page.append(ac); }
  page.append(h('div',{class:'bseg'},B.seg([['gen',T('Γενικά','General')],['eng',T('Μηχανή','Engine')],['exp',T('Λήξεις','Expiries')],['bat',T('Μπαταρίες','Batteries')]],BT,function(v){ ls.set('psaro-v4-btab',v); draw(); },T('Ενότητα σκάφους','Boat section'))));
  if(BT==='gen'){
    var sumF=[s.tank>0?T('Ρεζερβουάρ ','Tank ')+Math.round(s.tank)+' L':null,s.burn>0?B.num(+s.burn,1)+' L/h':null,s.cruise>0?s.cruise+' kn':null,T('εφεδρεία ','reserve ')+(s.reserve==null?20:s.reserve)+'%'].filter(Boolean);
    var c3=h('section',{class:'card'},h('div',{class:'bch'},h('h2',{text:T('Καύσιμο και ταχύτητα','Fuel and speed')}),h('button',{type:'button',class:'iconbtn bsm','aria-label':T('Επεξεργασία','Edit'),html:PEN,onclick:fuelEdit})),
      h('p',{class:'bfs',text:sumF.join(' · ')}),!(s.tank>0&&s.burn>0)?h('p',{class:'sub',text:T('Βάλε ρεζερβουάρ και κατανάλωση για αυτονομία και ώρα επιστροφής στον χάρτη.','Add tank size and burn rate for range and return time on the map.')}):null);
    if(s.tank>0) c3.append(h('div',{class:'chips bfq','data-l':T('Γρήγορα:','Quick:')},[[1,T('Γέμισα','Filled up')],[0.75,'¾'],[0.5,'½'],[0.25,'¼']].map(function(q){ return h('button',{type:'button',class:'chip sm',text:q[1],onclick:function(){ var x=Sm(); x.fuel={L:Math.round(x.tank*q[0]),t:Date.now()}; saveS(x); draw(); }}); })));
    page.append(c3);
    if(B.smart) page.append(portCard());
    if(B.limitsCard) page.append(B.limitsCard());
  }
  if(BT==='eng'){
    var c2=h('section',{class:'card'},h('h2',{text:T('Ώρες μηχανής','Engine hours')})), g2=h('div',{class:'g2'});
    g2.append(fld(T('Ώρες τώρα','Hours now'),inp('number',eh>0?eh:'','0',function(v){ var x=Sm(); x.eng.h=v||0; saveS(x); draw(); })),fld(T('Service κάθε (ώρες)','Service every (h)'),inp('number',ev>0?ev:'','100',function(v){ var x=Sm(); x.eng.every=v||0; saveS(x); draw(); })));
    c2.append(g2,h('div',{class:'acts'},h('span',{class:'sub',style:{flex:'2',alignSelf:'center'},text:+s.eng.last>0?T('Τελευταίο service στις ','Last service at ')+s.eng.last+' h':T('Δεν έχει καταγραφεί service.','No service logged yet.')}),h('button',{class:'btn'+(eh>0&&ev>0&&used>=ev?' pri':''),type:'button',text:T('Έγινε service','Service done'),onclick:srvDone})));
    page.append(c2);
    /* συντήρηση με μπάρες */
    var M=Mload(), mc=h('section',{class:'card'},h('h2',{text:T('Πρόγραμμα συντήρησης','Maintenance schedule')}),h('p',{class:'sub',style:{margin:'-4px 0 6px'},text:T('Η μπάρα δείχνει πόσο έχει περάσει από το διάστημα (ώρες μηχανής ή μήνες, ό,τι έρθει πρώτο). Πάτα ✓ όταν το κάνεις.','The bar shows how much of the interval has passed (engine hours or months, whichever comes first). Tap ✓ when you do it.')})), ml=h('div',{class:'bml'});
    M.items.forEach(function(it){ var st=mstat(it), fr=mfrac(it), iv=[]; if(it.h) iv.push(it.h+' h'); if(it.mo) iv.push(it.mo+T(' μήνες',' mo'));
      ml.append(h('div',{class:'bmr '+st.lv},h('button',{type:'button',class:'bmx',onclick:function(){ maintEdit(it); }},h('span',{class:'bmt'},h('b',{text:it.name}),h('small',{text:st.lv==='n'?T('κάθε ','every ')+iv.join(T(' ή ',' or ')):st.tx.split(' · ')[0]})),fr!=null?bar(fr):h('span',{class:'bbar none'})),
        checkBtn(T('Έγινε: ','Done: ')+it.name,function(){ mDone(it); },st.lv==='bad'||st.lv==='warn'))); });
    mc.append(ml,h('button',{class:'btn',type:'button',text:T('+ Νέο στοιχείο','+ New item'),onclick:function(){ maintEdit(null); }})); page.append(mc);
    /* ημερολόγιο ωρών */
    var c4=h('section',{class:'card'},h('h2',{text:T('Ημερολόγιο ωρών','Hours log')}));
    var ld=h('input',{type:'date',value:today(),'aria-label':T('Ημερομηνία','Date')}), lh=h('input',{type:'number',inputmode:'decimal',step:'any',min:'0',placeholder:T('ώρες','hours'),'aria-label':T('Ώρες','Hours')}), ln=h('input',{type:'text',maxlength:'80',placeholder:T('σημείωση (π.χ. λάδια)','note (e.g. oil change)'),'aria-label':T('Σημείωση','Note')});
    c4.append(h('div',{class:'logadd'},ld,lh,ln,h('button',{class:'btn',type:'button',text:T('Προσθήκη','Add'),onclick:function(){ var hv=lh.value===''?null:+lh.value; if(hv==null||!(hv>=0)){ B.toast(T('Γράψε τις ώρες.','Enter the hours.')); return; }
      var x=D(); x.log.unshift({id:uid(),date:ld.value||today(),h:hv,note:ln.value.trim().slice(0,80)}); x.log.sort(function(p,q){ return q.h-p.h; }); saveB(x); var sm=Sm(); if(hv>(+sm.eng.h||0)){ sm.eng.h=hv; saveS(sm); } draw(); }})));
    if(b.log.length){ var tl=h('div',{class:'mini-list'}); b.log.slice(0,30).forEach(function(r,i){ var nx=b.log[i+1];
      tl.append(h('div',{class:'mrow'},h('span',{text:dF(r.date)+(r.note?' · '+r.note:'')}),h('b',{text:r.h+' h'+(nx&&r.h>=nx.h?' (+'+B.num(r.h-nx.h,1)+')':'')}),h('button',{class:'del',type:'button','aria-label':T('Διαγραφή','Delete'),html:B.iconSvg('trash'),onclick:function(){ var x=D(); x.log=x.log.filter(function(q){ return q.id!==r.id; }); saveB(x); draw(); }}))); }); c4.append(tl); }
    page.append(c4);
  }
  if(BT==='exp'){
    /* χρονολόγιο: με ημερομηνία από την πιο κοντινή, χωρίς ημερομηνία μαζεμένες */
    var rows=b.exp.map(function(x){ var o=lv(x.date,x.lead||30); return {key:x.id,name:x.name,date:x.date,o:o}; });
    rows.push({key:'lic',name:T('Άδεια ψαρέματος','Fishing licence'),date:s.lic||'',o:lv(s.lic,14)});
    var afn=b.af.date?addM(b.af.date,b.af.mo||12):''; rows.push({key:'af',name:T('Αντιρρυπαντική','Antifouling'),date:afn||'',o:lv(afn,30),pre:b.af.date?T('επόμενη · ','next · '):''});
    var dated=rows.filter(function(r){ return r.date; }).sort(function(a,c){ return a.o.d-c.o.d; }), und=rows.filter(function(r){ return !r.date; });
    var ec=h('section',{class:'card'},h('h2',{text:T('Λήξεις και επιθεωρήσεις','Expiries and inspections')}));
    function erow(r){ return h('button',{type:'button',class:'btl '+r.o.lv,onclick:function(){ expEdit(r.key); }},h('i'),h('span',{class:'bttx'},h('b',{text:r.name}),h('small',{text:r.date?(r.pre||'')+dF(r.date):T('Πάτα για ημερομηνία','Tap to add a date')})),r.date?tag(r.o):null); }
    if(dated.length){ var dl=h('div',{class:'btline'}); dated.forEach(function(r){ dl.append(erow(r)); }); ec.append(dl); }
    else ec.append(h('p',{class:'sub',text:T('Δεν έχεις βάλει ημερομηνίες ακόμα. Πάτα μια γραμμή από κάτω.','No dates yet. Tap a row below.')}));
    if(und.length){ var ud=h('details',{class:'bund',open:!dated.length},h('summary',{text:T('Χωρίς ημερομηνία (','Without a date (')+und.length+')'})); und.forEach(function(r){ ud.append(erow(r)); }); ec.append(ud); }
    ec.append(h('button',{class:'btn',type:'button',text:T('+ Νέα λήξη','+ New expiry'),onclick:function(){ expEdit(null); }}));
    page.append(ec);
  }
  if(BT==='bat'){
    var c7=h('section',{class:'card'},h('h2',{text:T('Μπαταρίες','Batteries')}),h('p',{class:'sub',style:{margin:'-4px 0 8px'},text:T('Ενδεικτική αλλαγή: μολύβδου ~4 χρόνια, AGM/Gel ~5, λιθίου ~10.','Indicative replacement: lead-acid ~4 years, AGM/Gel ~5, lithium ~10.')})), bg=h('div',{class:'bbats'});
    b.bat.forEach(function(x){ var life=(BAT_LIFE[x.type]||4), nx=x.inst?addM(x.inst,life*12):null, o=lv(nx,60), age=x.inst?(Date.now()-dP(x.inst))/(365.25*DAY):null;
      var vs=null; if(x.v>0){ var full=x.type==='lith'?13.3:12.7, low=x.type==='lith'?12.9:12.2; vs=x.v>=full?['ok',T('γεμάτη','full')]:x.v>=low?['warn',T('μισή','partial')]:['bad',T('χαμηλή','low')]; }
      var tn=(BTYP.filter(function(t){ return t[0]===(x.type||'agm'); })[0]||[])[1]||'';
      bg.append(h('button',{type:'button',class:'bbat',onclick:function(){ batEdit(x.id); }},h('span',{class:'bbh'},h('b',{text:x.name||T('Μπαταρία','Battery')}),vs?h('span',{class:'bv '+vs[0],text:B.num(+x.v,1)+' V · '+vs[1]}):null),
        h('small',{text:[tn,x.ah?x.ah+' Ah':''].filter(Boolean).join(' · ')}),age!=null?bar(age/life,o.lv==='bad'?'bad':o.lv==='warn'?'warn':'ok'):h('span',{class:'bbar none'}),
        h('small',{class:'bbs',text:age!=null?B.num(age,1)+T(' χρόνια',' yr')+' · '+T('αλλαγή ','replace ')+dF(nx):T('Πάτα για ημερομηνία τοποθέτησης','Tap to add the install date')}))); });
    c7.append(bg,h('button',{class:'btn',type:'button',text:T('+ Μπαταρία','+ Battery'),onclick:function(){ var x=D(), id=uid(); x.bat.push({id:id,name:'',type:'agm',inst:today()}); saveB(x); draw(); batEdit(id); }}));
    page.append(c7);
  }
  page.append(h('p',{class:'foot',text:T('Τα στοιχεία μπαίνουν στο αντίγραφο ασφαλείας. Οι εκτιμήσεις (ώρα επιστροφής, καύσιμο) είναι ενδεικτικές και δεν αντικαθιστούν την κρίση σου.','The details are included in the backup. Estimates (return time, fuel) are indicative and do not replace your judgement.')}));
  root.replaceChildren(page); try{ window.scrollTo(0,y); }catch(e){}
}
B.view('boat',{title:T('Σκάφος','Boat'),mount:function(el){ root=el; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
})();
