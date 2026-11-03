/* Alkyon 1.3.2 · κοινά του εξοπλισμού που χρειάζονται και έξω από τη σελίδα Εξοπλισμός:
   αντίγραφο ασφαλείας (B.backup: export / import / build / apply), ονόματα ειδών (B.tackleKind) και βάρη στις μονάδες του χρήστη (B.tackleW).
   Φορτώνεται στο άνοιγμα. Η σελίδα Εξοπλισμός (tackle-view.js) φορτώνεται όταν την ανοίξεις και χρησιμοποιεί τους ίδιους πίνακες (B.tkCore). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls;
function S(){ return B.store; }
var KINDS=[['jig',T('Μεταλλική ζόκα (jig)','Metal jig')],['slow',T('Slow pitch jig','Slow pitch jig')],['micro',T('Casting / micro jig','Casting / micro jig')],['minnow',T('Minnow','Minnow')],['popper',T('Popper (επιφάνειας)','Popper (surface)')],['pencil',T('Stickbait / pencil','Stickbait / pencil')],['crank',T('Crankbait / diving','Crankbait / diving')],['jerk',T('Jerkbait','Jerkbait')],['soft',T('Σιλικόνη (soft plastic)','Soft plastic')],['head',T('Jig head (κεφαλή)','Jig head')],['spoon',T('Κουτάλι (spoon)','Spoon')],['egi',T('Καλαμαριέρα (egi)','Squid jig (egi)')],['tai',T('Tai rubber / tenya','Tai rubber / tenya')],['inch',T('Inchiku','Inchiku')],['troll',T('Πλάνο / συρτής','Trolling lure')],['spin',T('Spinner / spinnerbait','Spinner / spinnerbait')],['vib',T('Vibration / blade','Vibration / blade')],['sabiki',T('Σαβίκι','Sabiki')],['other',T('Άλλο','Other')]];
var ACCK=[['swivel',T('Στριφτάρι (swivel)','Swivel')],['snap',T('Κλιπ / snap','Snap / clip')],['ring',T('Split ring / solid ring','Split / solid ring')],['sinker',T('Βαρίδι','Sinker')],['beads',T('Glow beads / χάντρες','Glow beads')],['led',T('Φωτάκι / λάμπα LED','LED light / lamp')],['rig',T('Έτοιμο rig / σύνδεσμος','Ready rig / connector')],['other',T('Άλλο','Other')]];
var kname=function(k){ if(k&&k.indexOf('c:')===0) return k.slice(2); for(var i=0;i<KINDS.length;i++) if(KINDS[i][0]===k) return KINDS[i][1]; for(var j=0;j<ACCK.length;j++) if(ACCK[j][0]===k) return ACCK[j][1]; return ''; };
function uget(){ var v=String(ls.get('alkyon-tk-units','g|kg|m')||'').split('|'); return {w:v[0]==='oz'?'oz':'g',d:v[1]==='lb'?'lb':'kg',l:v[2]==='yd'?'yd':'m'}; }
function rnd(x,n){ var p=Math.pow(10,n); return Math.round(x*p)/p; }
function Wu(){ return uget().w; } function W(g){ g=+g; return Wu()==='oz'?rnd(g/28.3495,2):rnd(g,1); }
B.tkCore={KINDS:KINDS,ACCK:ACCK,kname:kname,b2u:function(bl){ return b2u(bl); }};
B.tackleKind=function(k){ return kname(k)||k; }; B.tackleW=function(g){ return W(g)+' '+Wu(); };
/* ---------- αντίγραφο ασφαλείας (ίδια μορφή αρχείου με την κλασική) ---------- */
function b2u(bl){ return new Promise(function(res){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.readAsDataURL(bl); }); }
/* v31z550: και οι ρυθμίσεις (σκάφος, όρια, πλάνα, στόχοι, συντήρηση, τοποθεσίες, ειδοποιήσεις, ασφάλεια) */
var SETK=['alkyon-boat','alkyon-smart','alkyon-maint','alkyon-limits','alkyon-v4-plans','alkyon-v4-goals','alkyon-places','alkyon-notify','alkyon-safe','alkyon-units','alkyon-fprof','alkyon-lang','alkyon-v4-autostart','alkyon-v4-night','alkyon-mapwx-items','alkyon-gear'];
function settingsOf(){ var o={}; SETK.forEach(function(k){ var v=ls.get(k,undefined); if(v!==undefined&&v!==null) o[k]=v; }); return o; }
B.backup={
  build:function(withPhotos){
    var bites=S().raw('bites'), photos={}, keys=[]; if(withPhotos){ bites.forEach(function(b){ S().phKeys(b).forEach(function(k){ keys.push(k); }); }); S().raw('tackle').forEach(function(t){ if(t.photo) keys.push('tk-'+t.id); }); }
    var p=Promise.resolve(); keys.forEach(function(k){ p=p.then(function(){ return S().Photos.get(k).then(function(bl){ if(bl) return b2u(bl).then(function(u){ photos[k]=u; }); }).catch(function(){}); }); });
    return p.then(function(){ var g=ls.get('alkyon-gear',null);
      return {app:'alkyon',v:3,at:new Date().toISOString(),ver:window.ALKYON_VERSION||'',spots:S().raw('spots'),trips:S().raw('trips'),bites:bites,tackle:S().raw('tackle'),gear:g&&g.items?g.items:[],boat:ls.get('alkyon-boat',null),settings:settingsOf(),photos:photos,nphotos:keys.length}; }); },
  exportAll:function(){
    return B.backup.build(true).then(function(data){ var keys={length:data.nphotos};
      var d=new Date(), name='alkyon-'+d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate())+'.json';
      var a=h('a',{href:URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),download:name}); document.body.append(a); a.click(); a.remove();
      ls.set('alkyon-lastbackup',Date.now()); return keys.length; });
  },
  importFile:function(file){ return file.text().then(function(t){ return B.backup.apply(JSON.parse(t)); }); },
  apply:function(d){
    return Promise.resolve().then(function(){ var n=0;
      ['spots','trips','bites','tackle'].forEach(function(k){ (Array.isArray(d[k])?d[k]:[]).forEach(function(it){ if(it&&typeof it==='object'){ S().save(k,it); n++; } }); });
      if(Array.isArray(d.gear)&&d.gear.length){ var g=ls.get('alkyon-gear',{})||{}, ex={}; g.items=Array.isArray(g.items)?g.items:[]; g.items.forEach(function(x){ ex[x.id]=1; }); d.gear.forEach(function(x){ if(x&&x.id&&!ex[x.id]){ g.items.push(x); n++; } }); ls.set('alkyon-gear',g); }
      if(d.boat&&typeof d.boat==='object'){ ls.set('alkyon-boat',d.boat); n++; }
      /* v31z550: ρυθμίσεις (αν υπάρχουν στο αντίγραφο) */
      if(d.settings&&typeof d.settings==='object') Object.keys(d.settings).forEach(function(k0){ var k=k0.replace(/^psaro-/,'alkyon-'); d.settings[k]=d.settings[k0]; if(SETK.indexOf(k)>=0&&k!=='alkyon-gear'&&k!=='alkyon-boat'){ ls.set(k,d.settings[k]); n++; } });
      var ph=d.photos&&typeof d.photos==='object'?d.photos:{}, p=Promise.resolve();
      Object.keys(ph).forEach(function(id){ p=p.then(function(){ return fetch(ph[id]).then(function(r){ return r.blob(); }).then(function(bl){ return S().Photos.put(id,bl); }).catch(function(){}); }); });
      return p.then(function(){ return n; }); });
  }
};
})();
