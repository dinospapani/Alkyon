/* Alkyon 1.0.0 · μεταφορά από τα παλιά ονόματα (BiteCast / Ψαρόβαρκα).
   Φορτώνεται ΠΡΩΤΟ, πριν από κάθε άλλο αρχείο, στο v4/index.html και στο classic.html.
   - localStorage: κάθε παλιό κλειδί (πρόθεμα psaro- ή psaro_) αντιγράφεται στο νέο (alkyon- / alkyon_), αν το νέο δεν υπάρχει.
     Τα παλιά κλειδιά ΔΕΝ σβήνονται (ασφάλεια: αν κάτι πάει στραβά, τα δεδομένα είναι ακόμα εκεί).
   - Φωτογραφίες (IndexedDB): η παλιά βάση «psarovarka» αντιγράφεται στη νέα «alkyon» την πρώτη φορά (window.alkyonPhotoDB).
   - Η διεύθυνση άλλαξε (/Pasrovarka → /Alkyon) αλλά ο «τόπος» (dinospapani.github.io) είναι ο ίδιος, άρα τα δεδομένα φαίνονται και εδώ. */
(function(){
'use strict';
var OLD='psa'+'ro', NEW='alkyon';
try{
  var L=window.localStorage;
  if(!L.getItem(NEW+'-migrated')){
    var ks=[], i, k, n;
    for(i=0;i<L.length;i++){ k=L.key(i); if(k&&(k.indexOf(OLD+'-')===0||k.indexOf(OLD+'_')===0)) ks.push(k); }
    for(i=0;i<ks.length;i++){ k=ks[i]; n=NEW+k.slice(OLD.length); if(L.getItem(n)===null) L.setItem(n,L.getItem(k)); }
    L.setItem(NEW+'-migrated',String(Date.now()));
  }
}catch(e){}

/* βάση φωτογραφιών: ανοίγει τη νέα και, την πρώτη φορά, αντιγράφει όσα υπάρχουν στην παλιά */
var dbp=null;
function open(name){ return new Promise(function(res,rej){ var r=indexedDB.open(name,1); r.onupgradeneeded=function(){ if(!r.result.objectStoreNames.contains('photos')) r.result.createObjectStore('photos'); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; }); }
function copyOld(db){
  var flag=NEW+'-idbmig';
  try{ if(localStorage.getItem(flag)) return Promise.resolve(db); }catch(e){ return Promise.resolve(db); }
  return open(OLD+'varka').then(function(old){
    return new Promise(function(res){
      var items=[], t;
      try{ t=old.transaction('photos','readonly'); }catch(e){ old.close(); return res(); }
      var cur=t.objectStore('photos').openCursor();
      cur.onsuccess=function(){ var c=cur.result; if(c){ items.push([c.key,c.value]); c.continue(); } };
      t.oncomplete=function(){ old.close();
        if(!items.length) return res();
        var w=db.transaction('photos','readwrite'), s=w.objectStore('photos');
        items.forEach(function(x){ var g=s.get(x[0]); g.onsuccess=function(){ if(g.result===undefined) s.put(x[1],x[0]); }; });
        w.oncomplete=function(){ res(); }; w.onerror=function(){ res(); }; w.onabort=function(){ res(); }; };
      t.onerror=function(){ old.close(); res(); };
    });
  }).catch(function(){}).then(function(){ try{ localStorage.setItem(flag,String(Date.now())); }catch(e){} return db; });
}
window.alkyonPhotoDB=function(){ return dbp||(dbp=open(NEW).then(copyOld)); };
})();
