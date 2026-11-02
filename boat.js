/* v31z354: Καρτέλα «Βάρκα» στο Προφίλ.
   Στοιχεία σκάφους και κινητήρα, καύσιμο, ημερολόγιο ωρών μηχανής, λήξεις εγγράφων και εξοπλισμού με υπενθυμίσεις,
   αντιρρυπαντική, μπαταρίες και συντήρηση κινητήρα. Αποθηκεύονται στο κινητό (alkyon-boat) και μπαίνουν στο αντίγραφο ασφαλείας.
   Ώρες κινητήρα, καύσιμο και λήξη άδειας ψαρέματος είναι κοινά με το smart.js (ίδια δεδομένα, όχι αντίγραφο). */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var KEY='alkyon-boat', SENT='alkyon-boat-sent', DAY=86400000;
function $(i){ return document.getElementById(i); }
function el(t,c,x){ var e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
function today(){ try{ return C.nicosiaToday(); }catch(e){ return new Date().toISOString().slice(0,10); } }
function dParse(s){ if(!s) return null; var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m?Date.UTC(+m[1],+m[2]-1,+m[3]):null; }
function dFmt(s){ var t=dParse(s); if(t==null) return '–'; try{ return new Date(t).toLocaleDateString(EN?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}); }catch(e){ return s; } }
function addMonths(s,m){ var t=dParse(s); if(t==null||!(m>0)) return null; var d=new Date(t); d.setUTCMonth(d.getUTCMonth()+Math.round(m)); return d.toISOString().slice(0,10); }
function addYears(s,y){ return addMonths(s,y*12); }
function daysTo(s){ var t=dParse(s), n=dParse(today()); return (t==null||n==null)?null:Math.round((t-n)/DAY); }

/* ---------- δεδομένα ---------- */
var EXP_DEF=[
  ['insp',T('Επιθεώρηση σκάφους','Boat inspection'),30],
  ['ext',T('Πυροσβεστήρας','Fire extinguisher'),30],
  ['vhf',T('Άδεια ασυρμάτου (VHF)','Radio licence (VHF)'),30],
  ['ins',T('Ασφάλεια σκάφους','Boat insurance'),30],
  ['flare',T('Φωτοβολίδες','Flares'),30],
  ['epirb',T('EPIRB / PLB (μπαταρία)','EPIRB / PLB (battery)'),60],
  ['raft',T('Σωσίβια σχεδία (σέρβις)','Liferaft (service)'),30]
];
var B=C.lsGet(KEY,null); if(!B||typeof B!=='object') B={};
B.boat=B.boat||{}; B.eng=B.eng||{}; B.log=Array.isArray(B.log)?B.log:[]; B.bat=Array.isArray(B.bat)?B.bat:[]; B.af=B.af||{mo:12};
if(!Array.isArray(B.exp)) B.exp=EXP_DEF.map(function(x){ return {id:x[0],name:x[1],date:'',lead:x[2],std:1}; });
function save(){ C.lsSet(KEY,B); }
function S(){ var s=window.AlkyonSmart&&window.AlkyonSmart.state&&window.AlkyonSmart.state(); return s||null; }
function sSave(){ try{ if(window.AlkyonSmart&&window.AlkyonSmart.save) window.AlkyonSmart.save(); }catch(e){} }
function engH(){ var s=S(); return s&&s.eng?(+s.eng.h||0):0; }

/* λίστα όλων όσων έχουν ημερομηνία λήξης: έγγραφα, αντιρρυπαντική, μπαταρίες, άδεια ψαρέματος */
var BAT_LIFE={lead:4,agm:5,gel:5,lith:10};
function dueList(){
  var out=[];
  B.exp.forEach(function(x){ if(x.date) out.push({k:'exp:'+x.id,name:x.name,date:x.date,lead:x.lead||30}); });
  if(B.af.date){ var nx=addMonths(B.af.date,B.af.mo||12); if(nx) out.push({k:'af',name:T('Αντιρρυπαντική (νέα εφαρμογή)','Antifouling (reapply)'),date:nx,lead:30}); }
  B.bat.forEach(function(b){ if(b.inst){ var nx=addYears(b.inst,BAT_LIFE[b.type]||4); if(nx) out.push({k:'bat:'+b.id,name:T('Μπαταρία ','Battery ')+(b.name||''),date:nx,lead:60}); } });
  var s=S(); if(s&&s.lic) out.push({k:'lic',name:T('Άδεια ψαρέματος','Fishing licence'),date:s.lic,lead:14,ext:1});
  out.forEach(function(o){ o.d=daysTo(o.date); o.lv=o.d==null?'n':o.d<0?'bad':o.d<=o.lead?'warn':'ok'; });
  out.sort(function(a,b){ return (a.d==null?1e9:a.d)-(b.d==null?1e9:b.d); });
  return out;
}
function lvTxt(o){ if(o.d==null) return ''; if(o.d<0) return T('έληξε πριν ','expired ')+(-o.d)+T(' ημέρες',' days ago'); if(o.d===0) return T('λήγει σήμερα','expires today'); return T('σε ','in ')+o.d+T(' ημέρες',' days'); }

/* ---------- υπενθυμίσεις (με ανοιχτή εφαρμογή) ---------- */
function remind(){
  var sent=C.lsGet(SENT,{})||{}, now=Date.now(), ch=false;
  dueList().forEach(function(o){
    if(o.ext) return; /* η άδεια ψαρέματος έχει δική της υπενθύμιση */
    if(o.lv!=='warn'&&o.lv!=='bad') return;
    var k=o.k+':'+o.date, gap=o.lv==='bad'?7*DAY:14*DAY; if(sent[k]&&now-sent[k]<gap) return; sent[k]=now; ch=true;
    var t='🛥 '+o.name, b=(o.lv==='bad'?T('Έληξε: ','Expired: '):T('Λήγει: ','Due: '))+dFmt(o.date)+' ('+lvTxt(o)+')';
    try{ if(window.AlkyonSea&&window.AlkyonSea.notify) window.AlkyonSea.notify(t,b); else C.toast(t+' · '+b); }catch(e){}
  });
  if(ch) C.lsSet(SENT,sent);
  paintBadge();
}

/* ---------- εμφάνιση ---------- */
var host=null;
function card(title,sub){ var c=el('section','card btcard'), h=el('h3',null,title); c.append(h); if(sub) c.append(el('p','note btsub',sub)); host.append(c); return c; }
function field(parent,label,input){ var l=el('label','btf'); l.append(el('span',null,label),input); parent.append(l); return input; }
function inp(type,val,ph,on){ var i=el('input'); i.type=type; if(val!=null&&val!=='') i.value=val; if(ph) i.placeholder=ph; if(type==='number'){ i.inputMode='decimal'; i.step='any'; i.min='0'; } i.addEventListener('change',function(){ on(type==='number'?(i.value===''?null:+i.value):i.value.trim()); }); return i; }
function sel(opts,val,on){ var s=el('select'); opts.forEach(function(o){ var x=el('option',null,o[1]); x.value=o[0]; s.append(x); }); s.value=val||opts[0][0]; s.addEventListener('change',function(){ on(s.value); }); return s; }
function btn(txt,cls,fn){ var b=el('button','btn sm '+(cls||''),txt); b.type='button'; b.addEventListener('click',fn); return b; }
function grid(c){ var g=el('div','btgrid'); c.append(g); return g; }
function pill(o){ var p=el('span','btpill '+o.lv,o.lv==='n'?T('χωρίς ημερομηνία','no date'):lvTxt(o)); return p; }

function render(){
  if(!host) return; var y=0; try{ y=$('profile').scrollTop; }catch(e){}
  host.replaceChildren();
  var s=S();

  /* σύνοψη */
  var bn=(B.boat.name||'').trim(), sum=el('section','card btsum');
  var hd=el('div','bthd'); hd.append(el('div','btico'),(function(){ var d=el('div'); d.append(el('b',null,bn||T('Η βάρκα μου','My boat')),el('span','note',[B.boat.model,B.boat.len?B.boat.len+' m':'',B.eng.model?B.eng.model+(B.eng.hp?' '+B.eng.hp+' hp':''):''].filter(Boolean).join(' · ')||T('Συμπλήρωσε τα στοιχεία πιο κάτω.','Fill in the details below.'))); return d; })());
  sum.append(hd);
  var st=el('div','btstats'); [[Math.round(engH()*10)/10+' h',T('ώρες κινητήρα','engine hours')],[s&&s.eng&&s.eng.every?Math.max(0,Math.round(s.eng.every-(engH()-(s.eng.last||0))))+' h':'–',T('ως το service','to service')],[s&&s.fuel?Math.round(s.fuel.L)+' L':'–',T('καύσιμο (εκτίμηση)','fuel (estimate)')]].forEach(function(x){ var d=el('div'); d.append(el('b',null,x[0]),el('span',null,x[1])); st.append(d); });
  sum.append(st);
  var up=dueList().filter(function(o){ return o.lv==='bad'||o.lv==='warn'; });
  if(up.length){ var ul=el('div','btdue'); ul.append(el('div','btdueh',T('Χρειάζονται προσοχή','Needs attention'))); up.forEach(function(o){ var r=el('div','btduer '+o.lv); r.append(el('span',null,o.name),el('b',null,lvTxt(o))); ul.append(r); }); sum.append(ul); }
  else sum.append(el('p','note btok',T('✓ Καμία λήξη τις επόμενες εβδομάδες.','✓ Nothing expiring in the coming weeks.')));
  host.append(sum);

  /* v31z415: λιμάνι, καύσιμο, αυτόματη έναρξη/λήξη και πλοήγηση (πριν ήταν στις Ειδοποιήσεις) */
  if(window.AlkyonSmart&&window.AlkyonSmart.openPanel){ var SS=window.AlkyonSmart.state()||{}, cp=card(T('Λιμάνι, καύσιμο και πλοήγηση','Port, fuel and navigation'));
    var pr=el('div','btrow'); pr.append(el('span','note',SS.home?((SS.home.name||T('Λιμάνι ορισμένο','Port set'))+(SS.tank?' · '+T('δεξαμενή ','tank ')+SS.tank+' L':'')):T('Όρισε λιμάνι, καύσιμο, αυτόματη έναρξη/λήξη εξόδου και διαδρομή γύρω από στεριά.','Set your port, fuel, automatic trip start/end and route around land.')),
      btn(T('Ρυθμίσεις','Settings'),'acc',function(){ window.AlkyonSmart.openPanel(); })); cp.append(pr); }

  /* σκάφος */
  var c1=card(T('Σκάφος','Boat')), g1=grid(c1);
  [['name',T('Όνομα','Name'),'text'],['model',T('Κατασκευαστής / μοντέλο','Builder / model'),'text'],['len',T('Μήκος (m)','Length (m)'),'number'],['hull',T('Υλικό γάστρας','Hull material'),'text'],['reg',T('Αριθμός νηολογίου','Registration no.'),'text'],['port',T('Λιμάνι νηολόγησης','Port of registry'),'text'],['mmsi','MMSI','text'],['call',T('Διακριτικό κλήσης','Call sign'),'text']].forEach(function(f){
    field(g1,f[1],inp(f[2],B.boat[f[0]],'',function(v){ B.boat[f[0]]=v; save(); if(f[0]==='name'||f[0]==='model'||f[0]==='len') render(); })); });

  /* κινητήρας */
  var c2=card(T('Κινητήρας','Engine')), g2=grid(c2);
  [['model',T('Μάρκα / μοντέλο','Make / model'),'text'],['hp',T('Ίπποι','Horsepower'),'number'],['serial',T('Σειριακός αριθμός','Serial number'),'text'],['year',T('Έτος','Year'),'number']].forEach(function(f){
    field(g2,f[1],inp(f[2],B.eng[f[0]],'',function(v){ B.eng[f[0]]=v; save(); if(f[0]==='model'||f[0]==='hp') render(); })); });
  if(s){
    field(g2,T('Ώρες κινητήρα τώρα','Engine hours now'),inp('number',s.eng.h,'0',function(v){ s.eng.h=v||0; sSave(); render(); }));
    field(g2,T('Service κάθε (ώρες)','Service every (h)'),inp('number',s.eng.every,'100',function(v){ s.eng.every=v||0; sSave(); render(); }));
    var sr=el('div','btrow'); sr.append(el('span','note',T('Τελευταίο service στις ','Last service at ')+(s.eng.last||0)+' h'),btn(T('Έγινε service τώρα','Service done now'),'acc',function(){ s.eng.last=s.eng.h; sSave(); B.log.unshift({id:uid(),date:today(),h:s.eng.h,note:T('Service','Service')}); save(); render(); C.toast(T('Καταγράφηκε service.','Service logged.')); })); c2.append(sr);
  }

  /* καύσιμο */
  if(s){
    var c3=card(T('Καύσιμο και ταχύτητα','Fuel and speed'),T('Για την ώρα επιστροφής και την αυτονομία στον χάρτη.','Used for return time and range on the map.')), g3=grid(c3);
    field(g3,T('Ταχύτητα πλεύσης (kn)','Cruise speed (kn)'),inp('number',s.cruise,'15',function(v){ s.cruise=v>0?v:15; sSave(); }));
    field(g3,T('Ρεζερβουάρ (L)','Tank (L)'),inp('number',s.tank,'',function(v){ s.tank=v; if(v>0&&!s.fuel) s.fuel={L:v,t:Date.now()}; sSave(); render(); }));
    field(g3,T('Κατανάλωση (L/ώρα)','Burn (L/h)'),inp('number',s.burn,'',function(v){ s.burn=v; sSave(); }));
    field(g3,T('Εφεδρεία (%)','Reserve (%)'),inp('number',s.reserve,'20',function(v){ s.reserve=v==null?20:v; sSave(); }));
    field(g3,T('Καύσιμο τώρα (L)','Fuel now (L)'),inp('number',s.fuel?Math.round(s.fuel.L):'','',function(v){ if(v!=null){ s.fuel={L:v,t:Date.now()}; sSave(); render(); } }));
  }

  /* ημερολόγιο ωρών */
  var c4=card(T('Ημερολόγιο ωρών μηχανής','Engine hours log'),T('Γράψε τις ώρες από το ρολόι του κινητήρα. Οι ώρες κινητήρα ενημερώνονται αυτόματα.','Enter the hours from the engine hour meter. Engine hours update automatically.'));
  var lg=el('div','btlogadd'), ld=inp('date',today(),'',function(){}), lh=inp('number','',T('ώρες','hours'),function(){}), ln=inp('text','',T('σημείωση (π.χ. λάδια)','note (e.g. oil change)'),function(){});
  ln.maxLength=80; lg.append(ld,lh,ln,btn(T('Προσθήκη','Add'),'acc',function(){ var h=lh.value===''?null:+lh.value; if(h==null||!(h>=0)){ C.toast(T('Γράψε τις ώρες.','Enter the hours.')); return; } B.log.unshift({id:uid(),date:ld.value||today(),h:h,note:ln.value.trim().slice(0,80)}); B.log.sort(function(a,b){ return String(b.date).localeCompare(String(a.date))||b.h-a.h; }); save(); if(s&&h>s.eng.h){ s.eng.h=h; sSave(); } render(); }));
  c4.append(lg);
  if(B.log.length){ var tb=el('div','btlog'); B.log.slice(0,30).forEach(function(r,i){ var row=el('div','btlogr'); var nx=B.log[i+1]; row.append(el('span','mono',dFmt(r.date)),el('b',null,r.h+' h'+(nx&&r.h>=nx.h?' (+'+Math.round((r.h-nx.h)*10)/10+')':'')),el('span','note',r.note||''),btn('✕','ghost',function(){ B.log=B.log.filter(function(q){ return q.id!==r.id; }); save(); render(); })); tb.append(row); }); c4.append(tb); }
  else c4.append(el('p','note',T('Δεν υπάρχουν καταχωρήσεις ακόμα.','No entries yet.')));

  /* λήξεις */
  var c5=card(T('Λήξεις και υπενθυμίσεις','Expiry dates and reminders'),T('Βάλε την ημερομηνία λήξης ή της επόμενης επιθεώρησης. Ειδοποίηση πριν λήξει (με ανοιχτή εφαρμογή).','Enter the expiry or next inspection date. You get a reminder before it is due (with the app open).'));
  B.exp.forEach(function(x){
    var o={d:daysTo(x.date),lead:x.lead||30}; o.lv=!x.date?'n':o.d<0?'bad':o.d<=o.lead?'warn':'ok';
    var r=el('div','btexp '+o.lv), top=el('div','btexph'); top.append(el('b',null,x.name),pill(o)); r.append(top);
    var g=el('div','btexpg'); field(g,T('Ημερομηνία','Date'),inp('date',x.date,'',function(v){ x.date=v||''; save(); render(); }));
    field(g,T('Υπενθύμιση (ημέρες πριν)','Remind (days before)'),inp('number',x.lead,'30',function(v){ x.lead=v==null?30:v; save(); render(); }));
    r.append(g);
    if(!x.std) r.append(btn(T('Διαγραφή','Delete'),'ghost btdel',function(){ B.exp=B.exp.filter(function(q){ return q!==x; }); save(); render(); }));
    c5.append(r);
  });
  if(s){ var lo={d:daysTo(s.lic),lead:14}; lo.lv=!s.lic?'n':lo.d<0?'bad':lo.d<=14?'warn':'ok'; var lr=el('div','btexp '+lo.lv), lt=el('div','btexph'); lt.append(el('b',null,T('Άδεια ψαρέματος','Fishing licence')),pill(lo)); lr.append(lt); var lg2=el('div','btexpg'); field(lg2,T('Λήξη','Expiry'),inp('date',s.lic||'','',function(v){ s.lic=v||null; sSave(); var ss=C.lsGet('alkyon-smart-sent',{}); delete ss.lic; C.lsSet('alkyon-smart-sent',ss); render(); })); lr.append(lg2); c5.append(lr); }
  c5.append(btn(T('+ Νέα λήξη','+ New expiry item'),'',function(){ var go=function(v){ v=(v||'').trim(); if(!v) return; B.exp.push({id:uid(),name:v.slice(0,50),date:'',lead:30}); save(); render(); }; if(window.AlkyonAsk&&window.AlkyonAsk.prompt) window.AlkyonAsk.prompt(T('Τι λήγει; (π.χ. φαρμακείο, σωσίβια)','What expires? (e.g. first aid kit, lifejackets)'),{title:T('Νέα λήξη','New expiry item'),ok:T('Προσθήκη','Add'),max:50}).then(go); else go(window.prompt(T('Όνομα','Name'))); }));

  /* αντιρρυπαντική */
  var c6=card(T('Αντιρρυπαντική (μουράβια)','Antifouling'),T('Η προτεινόμενη επανάληψη βγαίνει από την ημερομηνία εφαρμογής και το διάστημα του προϊόντος.','The reapply date comes from the date applied and the product interval.')), g6=grid(c6);
  field(g6,T('Ημερομηνία εφαρμογής','Date applied'),inp('date',B.af.date,'',function(v){ B.af.date=v||''; save(); render(); }));
  field(g6,T('Προϊόν','Product'),inp('text',B.af.prod,T('π.χ. Hempel, Jotun','e.g. Hempel, Jotun'),function(v){ B.af.prod=v; save(); }));
  field(g6,T('Επανάληψη κάθε (μήνες)','Reapply every (months)'),inp('number',B.af.mo,'12',function(v){ B.af.mo=v>0?v:12; save(); render(); }));
  if(B.af.date){ var nx=addMonths(B.af.date,B.af.mo||12), ao={d:daysTo(nx),lead:30}; ao.lv=ao.d<0?'bad':ao.d<=30?'warn':'ok'; var ar=el('div','btrow'); ar.append(el('span',null,T('Προτεινόμενη νέα εφαρμογή: ','Recommended reapply: ')+dFmt(nx)),pill(ao)); c6.append(ar); }

  /* μπαταρίες */
  var c7=card(T('Μπαταρίες','Batteries'),T('Προτεινόμενη αλλαγή: μολύβδου ~4 χρόνια, AGM/Gel ~5, λιθίου ~10. Ενδεικτικά: εξαρτάται από τη χρήση και τη φόρτιση.','Suggested replacement: lead-acid ~4 years, AGM/Gel ~5, lithium ~10. Indicative: depends on use and charging.'));
  var TYP=[['lead',T('Μολύβδου (υγρή)','Lead-acid (flooded)')],['agm','AGM'],['gel','Gel'],['lith',T('Λιθίου (LiFePO4)','Lithium (LiFePO4)')]];
  B.bat.forEach(function(b){
    var nx=b.inst?addYears(b.inst,BAT_LIFE[b.type]||4):null, o={d:nx?daysTo(nx):null,lead:60}; o.lv=!nx?'n':o.d<0?'bad':o.d<=60?'warn':'ok';
    var r=el('div','btexp '+o.lv), top=el('div','btexph'); top.append(el('b',null,b.name||T('Μπαταρία','Battery')),pill(o)); r.append(top);
    var g=el('div','btexpg');
    field(g,T('Όνομα','Name'),inp('text',b.name,T('π.χ. Μίζα, Υπηρεσίας','e.g. Starter, House'),function(v){ b.name=v; save(); render(); }));
    field(g,T('Τύπος','Type'),sel(TYP,b.type,function(v){ b.type=v; save(); render(); }));
    field(g,'Ah',inp('number',b.ah,'',function(v){ b.ah=v; save(); }));
    field(g,T('Τοποθέτηση','Installed'),inp('date',b.inst,'',function(v){ b.inst=v||''; save(); render(); }));
    field(g,T('Τελευταίος έλεγχος','Last check'),inp('date',b.chk,'',function(v){ b.chk=v||''; save(); }));
    field(g,T('Τάση στον έλεγχο (V)','Voltage at check (V)'),inp('number',b.v,'12.6',function(v){ b.v=v; save(); render(); }));
    r.append(g);
    if(b.v!=null&&b.v>0){ var full=b.type==='lith'?13.3:12.7, low=b.type==='lith'?12.9:12.2; r.append(el('p','note',b.v>=full?T('Τάση: γεμάτη.','Voltage: full.'):b.v>=low?T('Τάση: μισοφορτισμένη. Φόρτισέ τη.','Voltage: partly charged. Charge it.'):T('Τάση χαμηλή: φόρτισε και ξαναμέτρησε μετά από ώρες ηρεμίας.','Voltage low: charge it and re-measure after it rests.'))); }
    r.append(btn(T('Διαγραφή','Delete'),'ghost btdel',function(){ B.bat=B.bat.filter(function(q){ return q!==b; }); save(); render(); }));
    if(nx) r.append(el('p','note',T('Προτεινόμενη αλλαγή: ','Suggested replacement: ')+dFmt(nx)));
    c7.append(r);
  });
  c7.append(btn(T('+ Μπαταρία','+ Battery'),'',function(){ B.bat.push({id:uid(),name:'',type:'agm',inst:today()}); save(); render(); }));

  /* συντήρηση κινητήρα (από το insights.js) */
  if(window.AlkyonMaint&&window.AlkyonMaint.ui){ var c8=card(T('Συντήρηση κινητήρα','Engine maintenance'),T('Πάτα «Έγινε» όταν κάνεις κάτι. Ειδοποίηση όταν πλησιάζει με βάση ώρες ή μήνες.','Tap Done when you do a job. You get a reminder by hours or months.')); var mb=el('div','btmaint'); c8.append(mb); try{ window.AlkyonMaint.ui(mb,render); var h0=mb.querySelector('.smsec'); if(h0) h0.remove(); }catch(e){} }

  host.append(el('p','note btfoot',T('Τα στοιχεία της βάρκας μένουν σε αυτό το κινητό και μπαίνουν στο αντίγραφο ασφαλείας (Ρυθμίσεις › Αντίγραφο). Οι υπενθυμίσεις έρχονται όταν ανοίγεις την εφαρμογή.','Boat details stay on this phone and are included in the backup (Settings › Backup). Reminders appear when you open the app.')));
  try{ $('profile').scrollTop=y; }catch(e){}
  paintBadge();
}

/* ---------- καρτέλα στο Προφίλ ---------- */
var segBtn=null;
function paintBadge(){ if(!segBtn) return; var n=dueList().filter(function(o){ return o.lv==='bad'||o.lv==='warn'; }).length; segBtn.dataset.badge=n?String(n):''; }
function setup(){
  var seg=$('pSeg'), pv=window.AlkyonProfView; if(!seg||!pv||!$('pTackle')) return false;
  if($('pBoat')) return true;
  host=el('div'); host.id='pBoat'; host.hidden=true; $('pTackle').parentNode.insertBefore(host,$('pTackle').nextSibling);
  segBtn=el('button',null,T('Βάρκα','Boat')); segBtn.type='button'; segBtn.dataset.p='boat'; segBtn.setAttribute('aria-pressed','false');
  var tk=seg.querySelector('[data-p=tackle]'); if(tk&&tk.nextSibling) seg.insertBefore(segBtn,tk.nextSibling); else seg.append(segBtn);
  segBtn.addEventListener('click',function(){ pv.set('boat'); });
  window.addEventListener('alkyon-pview',function(e){ var on=e.detail==='boat'; host.hidden=!on; segBtn.setAttribute('aria-pressed',String(on)); if(on){ ['pMain','pSettings','pTackle','pGuide'].forEach(function(i){ var x=$(i); if(x) x.hidden=true; }); render(); } });
  paintBadge(); return true;
}
var n=0, iv=setInterval(function(){ n++; if(setup()||n>40) clearInterval(iv); },500);
setTimeout(remind,15000); setInterval(function(){ if(!document.hidden) remind(); },6*3600000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden) setTimeout(remind,4000); });
window.AlkyonBoat={open:function(){ var p=$('profile'), nb=$('navProf'); if(p&&p.hidden&&nb) nb.click(); setTimeout(function(){ if(window.AlkyonProfView) window.AlkyonProfView.set('boat'); },150); },data:function(){ return B; },load:function(d){ if(d&&typeof d==='object'){ B=d; B.boat=B.boat||{}; B.eng=B.eng||{}; B.log=B.log||[]; B.bat=B.bat||[]; B.af=B.af||{mo:12}; if(!Array.isArray(B.exp)) B.exp=[]; save(); render(); } },due:dueList};
})();
