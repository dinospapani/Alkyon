/* Alkyon 1.0.0 · μεταφορά από τα παλιά ονόματα (BiteCast / Ψαρόβαρκα).
   Φορτώνεται ΠΡΩΤΟ, πριν από κάθε άλλο αρχείο, στο v4/index.html, στο classic.html και στο index.html.
   Η διεύθυνση άλλαξε (/Pasrovarka → /Alkyon), αλλά ο «τόπος» (dinospapani.github.io) είναι ο ίδιος, άρα τα δεδομένα φαίνονται και εδώ.
   - localStorage: κάθε παλιό κλειδί (psaro- / psaro_) γράφεται στο νέο (alkyon- / alkyon_), αν το νέο δεν υπάρχει.
     Μετά ελέγχεται ότι γράφτηκε σωστά και ΜΟΝΟ τότε σβήνεται το παλιό. Αυτό κρατά ελεύθερο τον χώρο (όριο ~5 MB) και
     δεν αφήνει παλιά αντίγραφα μετά από «διαγραφή από αυτό το κινητό». Το σημάδι alkyon-migrated μπαίνει μόνο αν πέτυχαν όλα.
   - Φωτογραφίες (IndexedDB): η παλιά βάση «psarovarka» αντιγράφεται στη νέα «alkyon» μία-μία φωτογραφία. Το σημάδι
     alkyon-idbmig μπαίνει μόνο αν πέτυχαν όλες, και τότε σβήνεται η παλιά βάση. Μέχρι τότε, μια φωτογραφία που λείπει
     διαβάζεται από την παλιά (window.alkyonOldPhoto).
   - Cache (ρυθμίσεις ειδοποιήσεων, ιστορικό, χάρτες και πρόγνωση εκτός σύνδεσης): αντιγραφή όσων λείπουν, με τη
     διεύθυνση /Pasrovarka/ → /Alkyon/. Το ίδιο κάνει και ο service worker της ρίζας. */
/* 1.12.3: προεπιλεγμένη γλώσσα: Αγγλικά για όσους ανοίγουν το Alkyon πρώτη φορά. Όσοι το χρησιμοποιούν ήδη (υπάρχουν δεδομένα,
   αλλά δεν είχαν διαλέξει ποτέ γλώσσα, άρα έβλεπαν Ελληνικά) μένουν στα Ελληνικά. Αλλάζει όποτε θες: Προφίλ › Γλώσσα. */
(function(){ try{ var L=localStorage; if(L.getItem('alkyon-lang')) return; var old=false;
  for(var i=0;i<L.length;i++){ var k=L.key(i)||''; if(/^(alkyon|alk-|psaro|bc4|sb-)/.test(k)){ old=true; break; } }
  L.setItem('alkyon-lang',old?'el':'en'); }catch(e){} })();
(function(){
'use strict';
var OLD='psa'+'ro', NEW='alkyon';
var L=null; try{ L=window.localStorage; }catch(e){}

/* ---------- localStorage ---------- */
function moveKey(k,n){
  try{
    var v=L.getItem(k); if(v===null) return true;
    var cur=L.getItem(n);
    if(cur===null){
      try{ L.setItem(n,v); }
      catch(e){ /* γέμισε ο χώρος: σβήσε πρώτα το παλιό (η τιμή είναι στη μνήμη) και ξαναδοκίμασε */
        L.removeItem(k); try{ L.setItem(n,v); }catch(e2){ try{ L.setItem(k,v); }catch(e3){} return false; } return true; }
      cur=L.getItem(n);
    }
    if(cur===null) return false;
    L.removeItem(k); return true;
  }catch(e){ return false; }
}
if(L){
  try{
    var ks=[], i, k, all=true;
    for(i=0;i<L.length;i++){ k=L.key(i); if(k&&(k.indexOf(OLD+'-')===0||k.indexOf(OLD+'_')===0)) ks.push(k); }
    for(i=0;i<ks.length;i++){ if(!moveKey(ks[i],NEW+ks[i].slice(OLD.length))) all=false; }
    if(!moveKey('bc-friend-code','alk-friend-code')) all=false;   /* πρόσκληση φίλου σε αναμονή */
    if(all&&!L.getItem(NEW+'-migrated')) L.setItem(NEW+'-migrated',String(Date.now()));
  }catch(e){}
}

/* ---------- φωτογραφίες (IndexedDB) ---------- */
var OLDDB=OLD+'varka', FLAG=NEW+'-idbmig', dbp=null;
function flagged(){ try{ return !!L.getItem(FLAG); }catch(e){ return true; } }
function open(name){ return new Promise(function(res,rej){ var r=indexedDB.open(name,1); r.onupgradeneeded=function(){ if(!r.result.objectStoreNames.contains('photos')) r.result.createObjectStore('photos'); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; }); }
function req(db,mode,fn){ return new Promise(function(res,rej){ var t; try{ t=db.transaction('photos',mode); }catch(e){ return rej(e); } var q=fn(t.objectStore('photos')); t.oncomplete=function(){ res(q&&q.result); }; t.onerror=function(){ rej(t.error); }; t.onabort=function(){ rej(t.error||new Error('abort')); }; }); }
function oldKeys(old){ return req(old,'readonly',function(s){ return s.getAllKeys?s.getAllKeys():null; }).then(function(a){ if(a) return a;
  return new Promise(function(res){ var out=[], t=old.transaction('photos','readonly'), c=t.objectStore('photos').openKeyCursor?t.objectStore('photos').openKeyCursor():t.objectStore('photos').openCursor(); c.onsuccess=function(){ var x=c.result; if(x){ out.push(x.key); x.continue(); } }; t.oncomplete=function(){ res(out); }; t.onerror=function(){ res(out); }; }); }); }
function copyOld(db){
  if(flagged()) return Promise.resolve(db);
  return open(OLDDB).then(function(old){
    return oldKeys(old).then(function(keys){
      var i=0, okAll=true;
      function next(){ if(i>=keys.length) return Promise.resolve();
        var key=keys[i++];   /* μία-μία: λίγη μνήμη, και μια αποτυχία δεν χαλάει τις υπόλοιπες */
        return req(db,'readonly',function(s){ return s.get(key); }).then(function(have){ if(have!==undefined) return;
          return req(old,'readonly',function(s){ return s.get(key); }).then(function(v){ if(v===undefined) return; return req(db,'readwrite',function(s){ return s.put(v,key); }); });
        }).catch(function(){ okAll=false; }).then(next); }
      return next().then(function(){ old.close();
        if(!okAll) return;
        try{ L.setItem(FLAG,String(Date.now())); }catch(e){ return; }
        try{ indexedDB.deleteDatabase(OLDDB); }catch(e){} });
    }).catch(function(){ try{ old.close(); }catch(e){} });
  }).catch(function(){}).then(function(){ return db; });
}
window.alkyonPhotoDB=function(){ return dbp||(dbp=open(NEW).then(copyOld)); };
/* φωτογραφία που δεν έχει περάσει ακόμα στη νέα βάση */
window.alkyonOldPhoto=function(id){ if(flagged()) return Promise.resolve(undefined);
  return open(OLDDB).then(function(old){ return req(old,'readonly',function(s){ return s.get(id); }).then(function(v){ old.close(); return v; },function(){ old.close(); return undefined; }); }).catch(function(){ return undefined; }); };

/* ---------- cache ---------- */
(function(){
  if(!window.caches) return;
  try{ if(L.getItem(NEW+'-cachemig')) return; }catch(e){ return; }
  var names=['cfg','tiles','offdata'];
  caches.keys().then(function(ks){
    var jobs=names.filter(function(n){ return ks.indexOf(OLD+'-'+n)>=0; }).map(function(n){
      return Promise.all([caches.open(OLD+'-'+n),caches.open(NEW+'-'+n)]).then(function(c){
        return c[0].keys().then(function(rqs){
          return rqs.reduce(function(p,rq){ return p.then(function(){ var u=rq.url.replace(/\/[Pp]asrovarka\//,'/Alkyon/');
            return c[1].match(u,{ignoreVary:true}).then(function(hit){ if(hit) return; return c[0].match(rq).then(function(r){ if(r) return c[1].put(u,r); }); }); }); },Promise.resolve());
        }).then(function(){ return caches.delete(OLD+'-'+n); });
      });
    });
    return Promise.all(jobs);
  }).then(function(){ try{ L.setItem(NEW+'-cachemig',String(Date.now())); }catch(e){} }).catch(function(){});
})();

/* ---------- 1.12.0: νέο domain (dinospapani.github.io/Alkyon → alkyonfishing.com) ----------
   Ο browser κρατά χωριστά τα δεδομένα κάθε διεύθυνσης. Γι' αυτό:
   - Στην ΠΑΛΙΑ διεύθυνση: όταν το MOVE γίνει true, κάθε σελίδα πάει στην ίδια σελίδα του alkyonfishing.com με ?from=gh.
     (Εξαίρεση: handoff.html, που διαβάζει τα παλιά δεδομένα.) Μένει false μέχρι να επιβεβαιωθεί ότι το νέο site δουλεύει.
   - Στη ΝΕΑ διεύθυνση: με ?from=gh και χωρίς δικά της δεδομένα, προτείνει «Μεταφορά». Ανοίγει το handoff.html της παλιάς σε νέο
     παράθυρο, παίρνει localStorage + IndexedDB με postMessage (ελέγχοντας την προέλευση) και τα γράφει εδώ.
   window.alkyonHandoff() το ξεκινά και με το χέρι (π.χ. από την κονσόλα ή από κουμπί). */
(function(){
  var MOVE=false, OLDO='https://dinospapani.github.io', NEWO='https://alkyonfishing.com';
  var h=location.hostname;
  if(h==='dinospapani.github.io'){
    if(!MOVE||/handoff\.html$/.test(location.pathname)) return;
    var p=location.pathname.replace(/^\/alkyon\//i,'/');
    var q=location.search?location.search+'&from=gh':'?from=gh';
    location.replace(NEWO+p+q+location.hash);
    return;
  }
  if(h!=='alkyonfishing.com') return;
  var SKIP={'alkyon-lang':1,'alkyon-migrated':1,'alkyon-cachemig':1,'alkyon-idbmig':1};
  function hasData(){ try{ for(var i=0;i<L.length;i++){ var k=L.key(i); if(k&&/^(alkyon|alk-|sb-)/.test(k)&&!SKIP[k]) return true; } }catch(e){} return false; }
  function writeDB(d){ return new Promise(function(res){
    var r=indexedDB.open(d.name);
    r.onerror=function(){ res(false); };
    r.onsuccess=function(){ var db=r.result, miss=d.stores.filter(function(s){ return !db.objectStoreNames.contains(s.name); });
      if(miss.length){ var v=Math.max(db.version+1,d.version); db.close(); var r2=indexedDB.open(d.name,v);
        r2.onupgradeneeded=function(){ miss.forEach(function(s){ var st=r2.result.createObjectStore(s.name,{keyPath:s.keyPath||undefined,autoIncrement:!!s.autoIncrement});
          s.indexes.forEach(function(ix){ try{ st.createIndex(ix.name,ix.keyPath,{unique:ix.unique,multiEntry:ix.multiEntry}); }catch(e){} }); }); };
        r2.onerror=function(){ res(false); }; r2.onsuccess=function(){ put(r2.result); }; }
      else put(db); };
    function put(db){ try{ var names=d.stores.map(function(s){ return s.name; }), t=db.transaction(names,'readwrite');
        d.stores.forEach(function(s){ var st=t.objectStore(s.name); s.rows.forEach(function(row){ try{ if(st.keyPath!=null) st.put(row[1]); else st.put(row[1],row[0]); }catch(e){} }); });
        t.oncomplete=function(){ db.close(); res(true); }; t.onerror=function(){ db.close(); res(false); }; }catch(e){ try{ db.close(); }catch(e2){} res(false); } }
  }); }
  function apply(data){
    var ls=data&&data.ls||{}, n=0;
    Object.keys(ls).forEach(function(k){ try{ L.setItem(k,ls[k]); n++; }catch(e){} });
    /* ειδοποιήσεις: εδώ χρειάζονται νέα άδεια και νέα συνδρομή (ξανά αυτόματα μόλις δοθεί η άδεια) */
    ['alkyon-moved-push','alkyon-push-heal'].forEach(function(k){ try{ L.removeItem(k); }catch(e){} });
    try{ L.setItem('alkyon-handoff',String(Date.now())); }catch(e){}
    return Promise.all((data&&data.idb||[]).map(writeDB)).then(function(r){ return {keys:n,dbs:r.filter(Boolean).length}; });
  }
  var busy=false;
  window.alkyonHandoff=function(){
    if(busy) return Promise.resolve(null); busy=true;
    return new Promise(function(res,rej){
      var w=window.open(OLDO+'/Alkyon/handoff.html','alkhandoff');
      if(!w){ busy=false; return rej(new Error('popup')); }
      var to=setTimeout(function(){ done(); busy=false; rej(new Error('timeout')); },120000);
      function done(){ clearTimeout(to); window.removeEventListener('message',on); }
      function on(ev){
        if(ev.origin!==OLDO||!ev.data) return;
        if(ev.data.type==='alk-handoff-hello'){ ev.source.postMessage({type:'alk-handoff-ready'},OLDO); return; }
        if(ev.data.type==='alk-handoff'){ var src=ev.source;
          apply(ev.data.data).then(function(r){ try{ src.postMessage({type:'alk-handoff-done'},OLDO); }catch(e){} done(); busy=false; res(r); }); }
      }
      window.addEventListener('message',on);
    });
  };
  /* πρόταση μεταφοράς: μόνο αν ήρθες από την παλιά διεύθυνση και εδώ δεν υπάρχει τίποτα ακόμα */
  var fromGh=/[?&]from=gh(&|$)/.test(location.search);
  if(!fromGh||hasData()) return;
  function card(){
    if(!document.body) return document.addEventListener('DOMContentLoaded',card);
    var en=(function(){ try{ return L.getItem('alkyon-lang')==='en'; }catch(e){ return false; } })();
    var T=function(a,b){ return en?b:a; };
    var d=document.createElement('div');
    d.setAttribute('style','position:fixed;inset:0;z-index:2147483000;visibility:visible!important;background:rgba(3,10,14,.86);display:grid;place-items:center;padding:20px;font:16px system-ui,sans-serif;color:#E6F1F2');
    d.innerHTML='<div style="max-width:420px;background:#0B2230;border:1px solid #23404d;border-radius:16px;padding:20px;text-align:left">'
      +'<div style="font-weight:700;font-size:18px;margin-bottom:8px">'+T('Νέα διεύθυνση: alkyonfishing.com','New address: alkyonfishing.com')+'</div>'
      +'<div style="color:#B5C8CF;line-height:1.45;margin-bottom:16px">'+T('Το Alkyon μεταφέρθηκε. Πάτα «Μεταφορά» για να φέρεις εδώ το ημερολόγιο, τις φωτογραφίες και τις ρυθμίσεις σου από την παλιά διεύθυνση. Θα ανοίξει για λίγο ένα δεύτερο παράθυρο.','Alkyon has moved. Tap “Transfer” to bring your logbook, photos and settings from the old address. A second window opens briefly.')+'</div>'
      +'<div id="akhm" style="color:#FFB08F;min-height:1.2em;margin-bottom:12px"></div>'
      +'<button id="akhgo" style="width:100%;padding:13px;border:0;border-radius:12px;background:#FF7A4D;color:#06171F;font-weight:700;font-size:16px">'+T('Μεταφορά','Transfer')+'</button>'
      +'<button id="akhno" style="width:100%;padding:11px;margin-top:8px;border:0;background:none;color:#8FA9B3;font-size:15px">'+T('Όχι τώρα','Not now')+'</button></div>';
    document.body.appendChild(d);
    var m=d.querySelector('#akhm');
    d.querySelector('#akhno').onclick=function(){ d.remove(); };
    d.querySelector('#akhgo').onclick=function(){ m.textContent=T('Μεταφορά…','Transferring…');
      window.alkyonHandoff().then(function(r){ m.style.color='#9EE6B8';
        m.textContent=T('Έγινε ✓ ','Done ✓ ')+(r?r.keys:0)+T(' εγγραφές. Αν είχες ειδοποιήσεις, άνοιξέ τες ξανά στο Προφίλ › Ειδοποιήσεις.',' entries. If you had alerts on, turn them on again in Profile › Alerts.');
        setTimeout(function(){ location.replace(location.pathname+location.hash); },3500); })
      .catch(function(e){ m.textContent=(e&&e.message==='popup')?T('Ο browser μπλόκαρε το παράθυρο. Επέτρεψε τα αναδυόμενα και ξαναδοκίμασε.','The browser blocked the window. Allow pop-ups and try again.'):T('Δεν ολοκληρώθηκε. Ξαναδοκίμασε.','It did not finish. Try again.'); }); };
  }
  card();
})();
})();
