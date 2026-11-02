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
})();
