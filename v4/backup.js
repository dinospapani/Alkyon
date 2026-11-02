/* Alkyon 4 · αυτόματο αντίγραφο ασφαλείας στο cloud (v31z550).
   Μία φορά την εβδομάδα (όταν ανοίγεις την εφαρμογή, με σύνδεση και λογαριασμό) ανεβαίνει ένα πλήρες αντίγραφο
   (ψάρια, έξοδοι, σημεία, εξοπλισμός, εργαλεία, σκάφος, ρυθμίσεις· όχι φωτογραφίες, που συγχρονίζονται χωριστά)
   στο Supabase Storage, φάκελος backups/<user id>/ΕΕΕΕ-ΜΜ-ΗΗ.json. Κρατιούνται τα 8 τελευταία. Χρειάζεται το backups.sql.
   Επαναφορά: Προφίλ › Λογαριασμός › Αντίγραφο ασφαλείας › «Επαναφορά από το cloud». */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, K='alkyon-v4-cbk', WEEK=7*86400000, KEEP=8, busy=false;
function C(){ return B.cloud&&B.cloud.session&&B.cloud.session()?B.cloud:null; }
function uid(){ var s=C()&&C().session(); return s&&s.uid; }
function st(){ return ls.get(K,{})||{}; }
function setSt(o){ ls.set(K,Object.assign(st(),o)); B.emit&&B.emit('store',K); }
function day(){ var d=new Date(); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function list(){ var u=uid(); if(!u) return Promise.reject(new Error('no session'));
  return C().storage('POST','list/backups',JSON.stringify({prefix:u+'/',limit:100,sortBy:{column:'name',order:'desc'}}),'application/json').then(function(r){
    if(r.status===400||r.status===404) return r.text().then(function(t){ var e=new Error(/bucket/i.test(t)?'nobucket':'list '+r.status); e.code=r.status; throw e; });
    if(!r.ok) throw new Error('list '+r.status); return r.json(); })
  .then(function(a){ return (Array.isArray(a)?a:[]).filter(function(x){ return /\.json$/.test(x.name); }).map(function(x){ return {name:x.name,path:u+'/'+x.name,size:x.metadata&&x.metadata.size||0,at:x.updated_at||x.created_at||null}; }).sort(function(a,b){ return a.name<b.name?1:-1; }); }); }
function prune(items){ var old=items.slice(KEEP); if(!old.length) return Promise.resolve();
  return C().storage('DELETE','backups',JSON.stringify({prefixes:old.map(function(x){ return x.path; })}),'application/json').catch(function(){}); }
function run(force){
  if(busy) return Promise.resolve(null); var u=uid(); if(!u||!B.backup||!B.backup.build) return Promise.resolve(null);
  if(!force&&(navigator.onLine===false||Date.now()-(st().at||0)<WEEK)) return Promise.resolve(null);
  busy=true; var name=day()+'.json', size=0;
  return B.backup.build(false).then(function(d){ delete d.photos; var body=JSON.stringify(d); size=body.length;
      return C().storage('POST','backups/'+u+'/'+name,new Blob([body],{type:'application/json'}),'application/json'); })
    .then(function(r){ if(!r.ok) return r.text().then(function(t){ var e=new Error(/bucket/i.test(t)||r.status===404?'nobucket':'upload '+r.status); throw e; });
      setSt({at:Date.now(),name:name,size:size,err:null}); return list().then(prune).catch(function(){}).then(function(){ return {name:name,size:size}; }); })
    .catch(function(e){ setSt({err:String(e&&e.message||e),errAt:Date.now()}); throw e; })
    .then(function(x){ busy=false; return x; },function(e){ busy=false; throw e; }); }
function restore(item){
  return C().storage('GET','backups/'+item.path).then(function(r){ if(!r.ok) throw new Error('get '+r.status); return r.json(); })
    .then(function(d){ if(!d||(d.app!=='alkyon'&&d.app!=='psa'+'rovarka')) throw new Error('format'); return B.backup.apply(d); }); }
function kb(n){ return n>1048576?B.num(n/1048576,1)+' MB':Math.max(1,Math.round(n/1024))+' KB'; }
function when(t){ return t?new Date(t).toLocaleDateString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',year:'numeric'}):'–'; }
/* κάρτα στο Προφίλ (μέσα στην κάρτα «Αντίγραφο ασφαλείας») */
B.cloudBackupRow=function(){
  var box=h('div',{class:'cbk'});
  function paint(){ var s=st(), on=!!uid();
    box.replaceChildren(h('h3',{class:'h3',text:T('Αυτόματα στο cloud','Automatic, in the cloud')}),
      h('p',{class:'sub',text:!on?T('Συνδέσου στον λογαριασμό σου για αυτόματο αντίγραφο κάθε εβδομάδα.','Sign in to your account for a weekly automatic backup.')
        :s.err==='nobucket'?T('Δεν έχει στηθεί ακόμα: τρέξε μία φορά το backups.sql στο Supabase.','Not set up yet: run backups.sql once in Supabase.')
        :(s.at?T('Κάθε εβδομάδα. Τελευταίο: ','Every week. Last: ')+when(s.at)+(s.size?' · '+kb(s.size):''):T('Κάθε εβδομάδα, μόλις ανοίξεις την εφαρμογή με σύνδεση.','Every week, when you open the app online.'))+(s.err&&s.err!=='nobucket'&&s.errAt>(s.at||0)?T(' · Η τελευταία προσπάθεια απέτυχε.',' · The last attempt failed.'):'')}));
    if(!on) return;
    var now=h('button',{class:'btn',type:'button',text:T('Αντίγραφο τώρα','Back up now'),onclick:function(){ now.disabled=true; run(true).then(function(x){ B.toast(x?T('Το αντίγραφο ανέβηκε στο cloud.','Backup uploaded to the cloud.'):T('Δεν έγινε.','Not done.')); },function(e){ B.toast(String(e.message)==='nobucket'?T('Τρέξε πρώτα το backups.sql στο Supabase.','Run backups.sql in Supabase first.'):T('Το αντίγραφο απέτυχε.','Backup failed.')); }).then(paint); }});
    var rs=h('button',{class:'btn',type:'button',text:T('Επαναφορά από το cloud','Restore from the cloud'),onclick:restoreSheet});
    box.append(h('div',{class:'acts'},now,rs)); }
  paint(); return box; };
function restoreSheet(){ var body=h('div',{class:'bform'},h('p',{class:'sub',text:T('Φόρτωση…','Loading…')})), sh=B.sheet({title:T('Επαναφορά από το cloud','Restore from the cloud'),body:body});
  list().then(function(a){ body.replaceChildren();
    if(!a.length){ body.append(h('p',{class:'sub',text:T('Δεν υπάρχει ακόμα αντίγραφο στο cloud.','No cloud backup yet.')})); return; }
    body.append(h('p',{class:'sub',text:T('Διάλεξε ημερομηνία. Τα ψάρια, οι έξοδοι και τα σημεία του αντιγράφου προστίθενται ή αντικαθιστούν τα ίδια· οι ρυθμίσεις αντικαθίστανται. Ό,τι έχεις προσθέσει μετά μένει.','Pick a date. The backup’s catches, trips and spots are added or replace the same ones; settings are replaced. Anything you added later stays.')}));
    var l=h('div',{class:'list'}); a.forEach(function(it){ l.append(h('button',{class:'li',type:'button',onclick:function(){
      B.ask(T('Επαναφορά του αντιγράφου ','Restore the backup of ')+it.name.replace('.json','')+';',T('Επαναφορά','Restore')).then(function(y){ if(!y) return; sh.close();
        B.toast(T('Επαναφορά…','Restoring…')); restore(it).then(function(n){ B.toast(T('Επαναφέρθηκαν ','Restored ')+n+T(' εγγραφές.',' records.')); setTimeout(function(){ location.reload(); },1500); },function(){ B.toast(T('Η επαναφορά απέτυχε.','Restore failed.')); }); }); }},
      h('span',{class:'tx'},h('b',{text:it.name.replace('.json','')}),h('small',{text:it.size?kb(it.size):''})),B.icon('chev'))); });
    body.append(l); },function(e){ body.replaceChildren(h('p',{class:'sub',text:String(e.message)==='nobucket'?T('Δεν έχει στηθεί: τρέξε το backups.sql στο Supabase.','Not set up: run backups.sql in Supabase.'):T('Δεν φορτώθηκε η λίστα. Έλεγξε τη σύνδεση.','Could not load the list. Check your connection.')})); }); }
B.cloudBackup={run:run,list:list,status:st};
/* αυτόματα: 25″ μετά το άνοιγμα και όταν ξαναγυρίζεις στην εφαρμογή */
function auto(){ if(document.hidden||!uid()) return; try{ if(B.trip&&B.trip.active&&B.trip.active()) return; }catch(e){} run(false).catch(function(){}); }
setTimeout(auto,25000); document.addEventListener('visibilitychange',function(){ if(!document.hidden) setTimeout(auto,8000); });
})();
