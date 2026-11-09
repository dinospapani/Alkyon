/* Alkyon 1.9.19 · Σημειώσεις λιμανιών και ραμπών (πίνακας port_notes· βλ. port-notes.sql).
   Στο αναδυόμενο ενός λιμανιού/ράμπας: οι εγκεκριμένες σημειώσεις των ψαράδων (ετικέτες + σύντομο κείμενο) και «+ Σημείωση».
   Κάθε νέα σημείωση πάει πρώτα στον διαχειριστή (Telegram ✅/❌ ή Προφίλ › έγκριση) και φαίνεται σε όλους μετά την έγκριση.
   Δεν φαίνεται όνομα. Φορτώνεται με τον χάρτη και από το Προφίλ (μόνο για διαχειριστές). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls;
var TAGS=[['shallow',T('Ρηχά','Shallow'),'bad'],['rocks',T('Βράχια','Rocks'),'bad'],['swell',T('Φουσκοθαλασσιά','Swell'),'bad'],['wind',T('Εκτεθειμένο στον άνεμο','Wind-exposed'),'bad'],['slippery',T('Γλιστερή ράμπα','Slippery ramp'),'bad'],['crowded',T('Πολύς κόσμος','Crowded'),'mid'],['night',T('Σκοτεινό τη νύχτα','Dark at night'),'mid'],['fee',T('Χρέωση','Fee'),'mid'],['parking',T('Πάρκινγκ','Parking'),'good'],['fuel',T('Καύσιμα','Fuel'),'good'],['water',T('Νερό','Water'),'good'],['good',T('Καλή ράμπα','Good ramp'),'good']];
var TL={}; TAGS.forEach(function(t){ TL[t[0]]=t; });
var cache={};
function C(){ return B.cloud; }
function sess(){ return C()&&C().session&&C().session(); }
function key(p){ return (+p.la).toFixed(3)+','+(+p.lo).toFixed(3); }
function missing(e){ return /HTTP 404|relation|does not exist|PGRST20/i.test(String(e&&e.message)); }
function dateS(t){ var d=new Date(t); return B.dateShort?B.dateShort(d.toISOString().slice(0,10)):d.toLocaleDateString(); }
function load(k,force){ var c=cache[k]; if(c&&!force&&Date.now()-c.t<10*60e3) return Promise.resolve(c.a);
  return C().rest('port_notes?select=id,tags,note,status,created_at,user_id&port_key=eq.'+encodeURIComponent(k)+'&status=neq.rejected&order=created_at.desc&limit=50').then(function(r){ return r.json(); })
    .then(function(a){ a=Array.isArray(a)?a:[]; cache[k]={t:Date.now(),a:a}; return a; }); }
function tagChips(tags,cls){ return h('div',{class:'pntags'+(cls?' '+cls:'')},(tags||[]).map(function(t){ var x=TL[t]; return x?h('span',{class:'pnt '+x[2],text:x[1]}):null; })); }
function summary(a){ var ok=a.filter(function(n){ return n.status==='ok'; }), cnt={}; ok.forEach(function(n){ (n.tags||[]).forEach(function(t){ cnt[t]=(cnt[t]||0)+1; }); });
  return {ok:ok,top:Object.keys(cnt).sort(function(x,y){ return cnt[y]-cnt[x]; }).slice(0,4)}; }

/* μέσα στο αναδυόμενο του λιμανιού (ports.js) */
function attach(w,p){ var box=h('div',{class:'pnpop'}); w.appendChild(box);
  var btn=h('button',{type:'button',class:'pb pnbtn',text:'📝 '+T('Σημειώσεις','Notes'),onclick:function(){ sheet(p); }}); box.append(btn);
  if(!sess()) return; load(key(p)).then(function(a){ var s=summary(a); if(s.ok.length){ btn.textContent='📝 '+T('Σημειώσεις','Notes')+' ('+s.ok.length+')'; if(s.top.length) box.insertBefore(tagChips(s.top,'sm'),btn); } }).catch(function(){}); }

function sheet(p){
  var name=p.n||(p.k==='ramp'?T('Ράμπα','Ramp'):T('Λιμάνι','Port')), k=key(p), list=h('div',{class:'pnlist'},h('p',{class:'sub',text:T('Φορτώνω…','Loading…')})), sh;
  function paint(a){ var s=summary(a), mine=a.filter(function(n){ return n.status==='pending'&&sess()&&n.user_id===sess().uid; });
    list.replaceChildren();
    if(s.top.length) list.append(h('h3',{class:'lyh',text:T('Τι λένε οι ψαράδες','What anglers say')}),tagChips(s.top));
    if(!s.ok.length&&!mine.length) list.append(h('p',{class:'sub',text:T('Δεν υπάρχουν σημειώσεις ακόμη. Γράψε πρώτος τι πρέπει να ξέρει κάποιος που έρχεται εδώ.','No notes yet. Be the first to say what someone coming here should know.')}));
    s.ok.concat(mine).forEach(function(n){ list.append(h('div',{class:'pnrow'+(n.status==='pending'?' pend':'')},tagChips(n.tags),n.note?h('p',{text:n.note}):null,h('small',{text:dateS(n.created_at)+(n.status==='pending'?T(' · δική σου, περιμένει έγκριση',' · yours, awaiting approval'):'')}))); }); }
  sh=B.sheet({title:name,body:h('div',null,list,h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:'+ '+T('Πρόσθεσε σημείωση','Add a note'),onclick:function(){ form(p,function(){ load(k,true).then(paint).catch(function(){}); }); }})),
    h('p',{class:'foot',text:T('Σημειώσεις από ψαράδες, μετά από έλεγχο. Οι συνθήκες αλλάζουν· έλεγξε επιτόπου.','Notes from anglers, after review. Conditions change; check on site.')}))});
  if(!sess()){ list.replaceChildren(h('p',{class:'sub',text:T('Συνδέσου στο Προφίλ για να βλέπεις και να γράφεις σημειώσεις.','Sign in from Profile to see and write notes.')})); return; }
  load(k).then(paint).catch(function(e){ list.replaceChildren(h('p',{class:'sub',text:missing(e)?T('Οι σημειώσεις λιμανιών δεν έχουν ενεργοποιηθεί ακόμη.','Port notes are not enabled yet.'):T('Δεν φόρτωσαν. Έλεγξε τη σύνδεση.','Did not load. Check the connection.')})); });
}
function form(p,after){
  if(!sess()){ B.toast(T('Χρειάζεται λογαριασμός (Προφίλ).','Needs an account (Profile).')); return; }
  var sel={}, note=h('textarea',{rows:'3',maxlength:'240',placeholder:T('π.χ. «Ρηχά στην είσοδο με νοτιά, πέρνα από δεξιά»','e.g. “Shallow at the entrance in southerly wind, keep right”')}), sh;
  var chips=h('div',{class:'pnpick'},TAGS.map(function(t){ return h('button',{type:'button',class:'chip pnt '+t[2],'aria-pressed':'false',text:t[1],onclick:function(){ sel[t[0]]=!sel[t[0]]; this.setAttribute('aria-pressed',String(!!sel[t[0]])); }}); }));
  var send=h('button',{class:'btn pri',type:'button',text:T('Αποστολή για έγκριση','Send for approval'),onclick:function(){
    var tags=Object.keys(sel).filter(function(x){ return sel[x]; }), tx=(note.value||'').trim().slice(0,240);
    if(!tags.length&&!tx){ B.toast(T('Διάλεξε μια ετικέτα ή γράψε κάτι.','Pick a tag or write something.')); return; }
    send.disabled=true;
    C().rest('port_notes',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({port_key:key(p),port_name:(p.n||'').slice(0,80)||null,lat:+(+p.la).toFixed(5),lon:+(+p.lo).toFixed(5),tags:tags,note:tx||null})})
      .then(function(){ sh.close(true); B.toast(T('Στάλθηκε. Θα φανεί σε όλους μόλις εγκριθεί.','Sent. It will show to everyone once approved.')); if(after) after(); })
      .catch(function(e){ send.disabled=false; B.toast(missing(e)?T('Οι σημειώσεις λιμανιών δεν έχουν ενεργοποιηθεί ακόμη.','Port notes are not enabled yet.'):/rate/i.test(String(e&&e.message))?T('Πολλές σημειώσεις σήμερα.','Too many notes today.'):T('Δεν στάλθηκε. Έλεγξε τη σύνδεση.','Not sent. Check the connection.')); }); }});
  sh=B.sheet({title:T('Σημείωση για ','Note for ')+(p.n||(p.k==='ramp'?T('τη ράμπα','the ramp'):T('το λιμάνι','the port'))),stack:true,body:h('div',{class:'pnform'},
    h('p',{class:'sub',text:T('Τι πρέπει να ξέρει κάποιος που έρχεται εδώ με βάρκα; Διάλεξε ό,τι ισχύει.','What should someone arriving by boat know? Pick what applies.')}),chips,note,
    h('p',{class:'foot',text:T('Θα ελεγχθεί πριν φανεί σε άλλους. Δεν φαίνεται το όνομά σου.','It will be reviewed before others see it. Your name is not shown.')}),h('div',{class:'acts'},send))});
}

/* διαχειριστής: έλεγχος και έγκριση μέσα στην εφαρμογή (εφεδρικά του Telegram) */
var admP=null;
function isAdmin(){ if(!sess()) return Promise.resolve(false); if(admP) return admP;
  admP=C().rest('app_admins?select=user_id&user_id=eq.'+encodeURIComponent(sess().uid)).then(function(r){ return r.json(); }).then(function(a){ return Array.isArray(a)&&a.length>0; }).catch(function(){ admP=null; return false; }); return admP; }
function pending(){ return C().rest('port_notes?select=*&status=eq.pending&order=created_at.asc&limit=100').then(function(r){ return r.json(); }); }
function review(){ var list=h('div',{class:'pnlist'},h('p',{class:'sub',text:T('Φορτώνω…','Loading…')})), sh=B.sheet({title:T('Σημειώσεις για έγκριση','Notes to review'),body:list});
  function draw(a){ list.replaceChildren(); if(!a.length){ list.append(h('p',{class:'sub',text:T('Δεν υπάρχει τίποτα σε αναμονή.','Nothing waiting.')})); return; }
    a.forEach(function(n){ var row=h('div',{class:'pnrow'},h('b',{text:n.port_name||T('Λιμάνι/ράμπα','Port/ramp')}),tagChips(n.tags),n.note?h('p',{text:n.note}):null,h('small',{text:dateS(n.created_at)+' · '+(+n.lat).toFixed(4)+', '+(+n.lon).toFixed(4)}));
      function dec(st){ C().rest('port_notes?id=eq.'+n.id,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({status:st})}).then(function(){ row.remove(); B.toast(st==='ok'?T('Εγκρίθηκε.','Approved.'):T('Απορρίφθηκε.','Rejected.')); if(!list.querySelector('.pnrow')) draw([]); }).catch(function(){ B.toast(T('Δεν έγινε.','Failed.')); }); }
      row.append(h('div',{class:'acts pnacts'},h('button',{class:'btn',type:'button',text:'❌ '+T('Απόρριψη','Reject'),onclick:function(){ dec('rejected'); }}),h('button',{class:'btn pri',type:'button',text:'✅ '+T('Έγκριση','Approve'),onclick:function(){ dec('ok'); }}),
        B.mapGo?h('button',{class:'btn',type:'button',text:'🗺',title:T('Στον χάρτη','On the map'),onclick:function(){ sh.close(true); B.mapGo(+n.lat,+n.lon,15); }}):null)); list.append(row); }); }
  pending().then(draw).catch(function(e){ list.replaceChildren(h('p',{class:'sub',text:missing(e)?T('Δεν είναι διαθέσιμο ακόμα.','Not available yet.'):T('Δεν φόρτωσαν.','Did not load.')})); }); }
/* γραμμή στο Προφίλ, μόνο για διαχειριστές */
function adminRow(into,mk){ isAdmin().then(function(y){ if(!y) return; pending().then(function(a){ into.append(mk(a.length)); }).catch(function(){ into.append(mk(null)); }); }); }
window.AlkyonPortNotes={attach:attach,sheet:sheet};
B.portNotes={attach:attach,sheet:sheet,form:form,review:review,isAdmin:isAdmin,adminRow:adminRow,key:key,TAGS:TAGS};
})();
