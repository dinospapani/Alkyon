/* Alkyon 1.14.83 · P0.1/P0.2: καθαρή λογική συγχρονισμού (χωρίς DOM, χωρίς δίκτυο), ώστε να ελέγχεται με unit tests (tests/unit).
   Κανόνες:
   - Ο server είναι το ρολόι του συγχρονισμού: ο trigger records_touch βάζει updated_at = now() σε κάθε εγγραφή.
     Η λήψη είναι σταδιακή: updated_at > δείκτη (cursor), σε σελίδες, με σειρά (updated_at, kind, id) ώστε να μη χάνεται τίποτα.
   - Κάθε εγγραφή στο κινητό κρατά _u (πότε άλλαξε εδώ) και _su (το _u της έκδοσης που ξέρουμε ότι υπάρχει στον server).
     «Βρώμικη» = _su λείπει ή _u > _su → πρέπει να ανέβει. Το ίδιο για τις διαγραφές (tombstones: u / su).
   - Καθαρή εγγραφή: ό,τι έρθει από τον server κερδίζει (ο server είναι η αλήθεια).
     Βρώμικη εγγραφή που άλλαξε και στον server: σύγκρουση· κερδίζει το μεγαλύτερο _u. Το _u κάθε αλλαγής είναι πάντα > από το _u
     της έκδοσης πάνω στην οποία έγινε (save: max(τώρα, προηγούμενο+1)), οπότε διαδοχικές αλλαγές από διαφορετικά κινητά
     λύνονται σωστά ακόμα κι αν τα ρολόγια τους διαφέρουν.
   - Επαναφορά αντιγράφου: δεν ξαναζωντανεύει ό,τι σβήστηκε μετά το αντίγραφο, δεν πατά νεότερη έκδοση. */
(function(root,factory){ if(typeof module==='object'&&module.exports) module.exports=factory(); else root.AKSync=factory(); })(this,function(){
'use strict';
var KINDS=['spots','trips','bites','tackle'], PAGE=1000, OVERLAP_MS=120000;
function num(v){ v=+v; return isFinite(v)?v:0; }
function remoteU(x){ return num(x&&x.data&&x.data._u)||Date.parse(x&&x.updated_at)||0; }
function dirtyRec(o){ return !!o&&(o._su===undefined||o._su===null||num(o._u)>num(o._su)); }
function dirtyTomb(t){ return !!t&&(t.su===undefined||t.su===null||num(t.u)>num(t.su)); }
/* το _u μιας νέας αλλαγής: πάντα μεγαλύτερο από την έκδοση που αλλάζει (ανεξάρτητα από το ρολόι του κινητού) */
function nextU(prevU,now){ return Math.max(num(now),num(prevU)+1); }
function strip(o){ var c={}; for(var k in o) if(Object.prototype.hasOwnProperty.call(o,k)&&k!=='_su') c[k]=o[k]; return c; }
function key(k,id){ return k+'/'+id; }

/* state = {cache:{bites:[…],…}, tombs:[{k,id,u,su}]} — αλλάζει επιτόπου. Επιστρέφει true αν άλλαξε κάτι τοπικά. */
function idxOf(a,id){ for(var i=0;i<a.length;i++) if(a[i]&&a[i].id===id) return i; return -1; }
function tombIdx(tb,k,id){ for(var i=0;i<tb.length;i++) if(tb[i].k===k&&tb[i].id===id) return i; return -1; }
function takeRemote(st,x,ru){
  var k=x.kind, a=st.cache[k], i=idxOf(a,x.id), ti=tombIdx(st.tombs,k,x.id);
  if(x.deleted){ if(i>=0) a.splice(i,1); var t={k:k,id:x.id,u:ru,su:ru}; if(ti>=0) st.tombs[ti]=t; else st.tombs.push(t); }
  else { var rec=Object.assign({},x.data||{},{id:x.id,_u:ru,_su:ru}); if(i>=0) a[i]=rec; else a.push(rec); if(ti>=0) st.tombs.splice(ti,1); }
  return true;
}
/* μία γραμμή από τον server. opt.force: ο server απέρριψε τη δική μας (παλιότερη) έκδοση → κερδίζει ο server. */
function mergeRow(st,x,opt){
  if(!x||!st.cache[x.kind]||x.id==null) return {changed:false};
  var k=x.kind, a=st.cache[k], i=idxOf(a,x.id), cur=i>=0?a[i]:null, ti=tombIdx(st.tombs,k,x.id), t=ti>=0?st.tombs[ti]:null, ru=remoteU(x);
  if(opt&&opt.force){ /* ο server απέρριψε ό,τι στείλαμε: κερδίζει ο server, ΕΚΤΟΣ αν ο χρήστης άλλαξε ξανά την εγγραφή στο μεταξύ */
    var exp=opt.expect&&opt.expect[x.kind+'/'+x.id];
    if(exp!=null){ var nowU=cur?num(cur._u):t?num(t.u):null; if(nowU!==exp) return {changed:false}; }
    return {changed:takeRemote(st,x,ru),took:true}; }
  if(!cur&&!t) return {changed:takeRemote(st,x,ru),took:true};
  var localU=Math.max(cur?num(cur._u):0,t?num(t.u):0), localDel=!cur&&!!t, dirty=cur?dirtyRec(cur):dirtyTomb(t);
  if(!dirty){
    var same=cur?(num(cur._u)===ru&&!x.deleted):(num(t.u)===ru&&!!x.deleted);
    if(same) return {changed:false};
    return {changed:takeRemote(st,x,ru),took:true};
  }
  /* βρώμικη τοπική αλλαγή */
  if(ru>localU) return {changed:takeRemote(st,x,ru),took:true};
  if(ru===localU){
    if(!!x.deleted===localDel){ /* ίδια έκδοση και στις δύο πλευρές: σημειώνεται ως συγχρονισμένη */ if(cur) cur._su=ru; else t.su=ru; return {changed:true}; }
    return {changed:takeRemote(st,x,ru),took:true}; /* ίδιο _u αλλά ο server το έσβησε/επανέφερε (π.χ. «αναίρεση» από το ρολόι): κερδίζει ο server */
  }
  return {changed:false}; /* η τοπική είναι νεότερη: μένει βρώμικη και ανεβαίνει */
}
/* σελίδα γραμμών· γυρίζει {got, photos:[ids με φωτογραφία που ήρθαν]} */
function mergePage(st,rows,opt){
  var got=0, changed=false, photos=[];
  (rows||[]).forEach(function(x){ var r=mergeRow(st,x,opt); if(r.changed) changed=true;
    if(r.took){ got++; if(x.kind==='bites'&&!x.deleted&&x.data&&x.data.photo){ photos.push(x.id); for(var i=1;i<=(+x.data.xph||0);i++) photos.push(x.id+'~'+i); } } });
  return {got:got,changed:changed,photos:photos};
}
/* ό,τι πρέπει να ανέβει */
function collectOut(st,iso){
  iso=iso||function(ms){ return new Date(ms).toISOString(); };
  var out=[];
  KINDS.forEach(function(k){ (st.cache[k]||[]).forEach(function(o){ if(o&&o.id!=null&&dirtyRec(o)) out.push({kind:k,id:o.id,data:strip(o),deleted:false,updated_at:iso(num(o._u)||Date.now()),_pu:num(o._u)}); }); });
  st.tombs.forEach(function(t){ if(dirtyTomb(t)&&t.k&&t.id!=null) out.push({kind:t.k,id:t.id,data:{_u:num(t.u)},deleted:true,updated_at:iso(num(t.u)||Date.now()),_pu:num(t.u)}); });
  return out;
}
/* γραμμή για το POST (χωρίς τα εσωτερικά πεδία) */
function wire(r){ return {kind:r.kind,id:r.id,data:r.data,deleted:r.deleted,updated_at:r.updated_at}; }
/* μετά το ανέβασμα: ό,τι επιβεβαίωσε ο server γίνεται καθαρό (μόνο αν δεν άλλαξε στο μεταξύ τοπικά) */
function markPushed(st,sent,echo){
  var ok={}; (echo||[]).forEach(function(e){ ok[key(e.kind,e.id)]=1; });
  var rejected=[];
  sent.forEach(function(r){ var kk=key(r.kind,r.id);
    if(!ok[kk]){ rejected.push(r); return; }
    if(r.deleted){ var ti=tombIdx(st.tombs,r.kind,r.id); if(ti>=0&&num(st.tombs[ti].u)===r._pu) st.tombs[ti].su=r._pu; }
    else { var a=st.cache[r.kind]||[], i=idxOf(a,r.id); if(i>=0&&num(a[i]._u)===r._pu) a[i]._su=r._pu; } });
  return rejected;
}
/* επαναφορά αντιγράφου: μία εγγραφή. Γυρίζει 'new' | 'restored' | 'skip-deleted' | 'skip-newer'. */
function restoreRec(st,k,rec){
  if(!rec||typeof rec!=='object'||!st.cache[k]) return 'skip';
  if(rec.id==null) return 'new';
  var bu=num(rec._u), a=st.cache[k], i=idxOf(a,rec.id), ti=tombIdx(st.tombs,k,rec.id);
  if(ti>=0&&num(st.tombs[ti].u)>=bu) return 'skip-deleted';
  if(i>=0&&num(a[i]._u)>=bu) return 'skip-newer';
  var r=strip(rec); r._u=bu; /* κρατά το αρχικό _u· χωρίς _su = θα ανέβει, και ο server την απορρίπτει αν έχει νεότερη */
  if(i>=0) a[i]=r; else a.push(r);
  if(ti>=0) st.tombs.splice(ti,1);
  return 'restored';
}
/* πλήρης λήψη: ό,τι είναι «καθαρό» στο κινητό αλλά δεν υπάρχει πια στον server (π.χ. σβήστηκε από τη βάση) ξαναγίνεται βρώμικο και ξανανεβαίνει */
function markMissing(st,seen){ var n=0;
  KINDS.forEach(function(k){ (st.cache[k]||[]).forEach(function(o){ if(o&&o.id!=null&&o._su!=null&&!seen[key(k,o.id)]){ delete o._su; n++; } }); });
  st.tombs.forEach(function(t){ if(t.su!=null&&!seen[key(t.k,t.id)]){ delete t.su; n++; } });
  return {changed:n>0,n:n}; }
/* PostgREST: φίλτρο για τη σελίδα μετά από (ts, kind, id) — σειρά updated_at, kind, id */
function q(v){ return '"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'; }
function afterFilter(c){
  if(!c) return '';
  if(c.id==null) return 'updated_at=gt.'+encodeURIComponent(c.ts);
  var T=q(c.ts), K=q(c.kind), I=q(c.id);
  return 'or='+encodeURIComponent('(updated_at.gt.'+T+',and(updated_at.eq.'+T+',kind.gt.'+K+'),and(updated_at.eq.'+T+',kind.eq.'+K+',id.gt.'+I+'))');
}
/* Γραμμή που γράφτηκε λίγο πριν τον δείκτη μπορεί να ολοκληρωθεί (commit) λίγο αργότερα. Αν ο δείκτης ήταν λιγότερο από 30″ πριν την ώρα του server
   όταν διαβάστηκε, ο επόμενος συγχρονισμός ξεκινά 2′ νωρίτερα (επικάλυψη, αβλαβής). Αλλιώς συνεχίζει ακριβώς από τον δείκτη, χωρίς να ξαναδιαβάζει τίποτα. */
function safeCursor(ts,serverDate){ var a=Date.parse(ts), b=Date.parse(serverDate||''); return isFinite(a)&&isFinite(b)&&b-a>30000; }
function startCursor(saved,uid){
  if(!saved||saved.uid!==uid||!saved.ts) return null;
  if(saved.safe&&saved.id!=null) return {ts:saved.ts,kind:saved.kind,id:saved.id};
  var ms=Date.parse(saved.ts); if(!isFinite(ms)) return null;
  return {ts:new Date(ms-OVERLAP_MS).toISOString(),id:null};
}
function pagePath(uid,cur,limit){
  var f=afterFilter(cur);
  return 'records?select=kind,id,data,deleted,updated_at&user_id=eq.'+encodeURIComponent(uid)+(f?'&'+f:'')+'&order=updated_at.asc,kind.asc,id.asc&limit='+(limit||PAGE);
}
function lastOf(rows){ var x=rows[rows.length-1]; return x?{ts:x.updated_at,kind:x.kind,id:x.id}:null; }
return {KINDS:KINDS,PAGE:PAGE,OVERLAP_MS:OVERLAP_MS,remoteU:remoteU,dirtyRec:dirtyRec,dirtyTomb:dirtyTomb,nextU:nextU,strip:strip,mergeRow:mergeRow,mergePage:mergePage,
  collectOut:collectOut,markMissing:markMissing,wire:wire,markPushed:markPushed,restoreRec:restoreRec,afterFilter:afterFilter,startCursor:startCursor,safeCursor:safeCursor,pagePath:pagePath,lastOf:lastOf};
});
