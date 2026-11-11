/* Alkyon 1.3.1 · φόρτωση κατά απαίτηση.
   Ο χάρτης (map-view, wxfx, seabed, bestspot) και οι σπάνιες σελίδες (Βοήθεια, Σκάφος, Φίλοι, Έλεγχος, Εξοπλισμός από 1.3.2) δεν φορτώνονται στο άνοιγμα.
   Φορτώνονται την πρώτη φορά που τις ανοίγεις ή που κάποιο κουμπί τις χρειάζεται.
   Οι «γέφυρες» παρακάτω έχουν το ίδιο όνομα με τις πραγματικές συναρτήσεις: φορτώνουν το αρχείο και καλούν την πραγματική,
   που αντικαθιστά τη γέφυρα μόλις φορτωθεί. Όλα τα αρχεία είναι στο cache του service worker, οπότε δουλεύουν και offline. */
(function(){
'use strict';
var B=window.AK, T=B.T;
var MAP=['worldland.js','medland.js','map-view.js','wxfx.js','seabed.js','bestspot.js','seareports.js','portnotes.js','mydepth.js']; /* 1.5.3: medland = στεριά σε όλη τη Μεσόγειο */
/* 1.5.2: το Leaflet κατεβαίνει μαζί με τα αρχεία του χάρτη, όχι μετά */
function loadMap(){ if(B.leaflet) B.leaflet().catch(function(){}); return B.loadScripts(MAP); }
B.loadMap=loadMap;
function fail(){ B.toast&&B.toast(T('Ο χάρτης δεν φορτώθηκε. Έλεγξε τη σύνδεση και ξαναδοκίμασε.','The map did not load. Check your connection and try again.')); }
/* γέφυρα: φορτώνει τον χάρτη και καλεί την πραγματική συνάρτηση (αν η γέφυρα δεν έχει αντικατασταθεί, δεν καλεί τον εαυτό της) */
function bridge(name){ var self=function(){ var a=arguments; loadMap().then(function(){ var f=B[name]; if(typeof f==='function'&&f!==self) f.apply(null,a); }).catch(fail); }; B[name]=self; }
['mapGo','goTo','replayTrip','spotSheet','spotFormAt','mapPick'].forEach(function(n){ if(!B[n]) bridge(n); });
/* μόνο το Leaflet (για τον μικρό χάρτη στην Πρόγνωση και στην επιλογή σημείου), χωρίς όλο τον χάρτη */
if(!B.leaflet){ var lp=null; B.leaflet=function(){ if(window.L) return Promise.resolve(window.L); if(lp) return lp;
  lp=new Promise(function(res,rej){ var c=document.createElement('link'); c.rel='stylesheet'; c.href='../leaflet.css'; document.head.appendChild(c);
    var s=document.createElement('script'); s.src='../leaflet.js'; s.onload=function(){ res(window.L); }; s.onerror=function(){ lp=null; rej(); }; document.head.appendChild(s); });
  return lp; }; }
/* καλύτερα σημεία: το κουμπί στο «Πού να πάω» */
if(!B.bestSpots){ var bs={ on:function(){ return false; }, go:function(){ var a=arguments; loadMap().then(function(){ if(B.bestSpots&&B.bestSpots!==bs) B.bestSpots.go.apply(null,a); }).catch(fail); } }; B.bestSpots=bs; }
/* ίδια διεύθυνση tiles με τον χάρτη: για το κατέβασμα χαρτών πριν την έξοδο (alerts-view, prefetch) */
if(!B.tileTpl) B.tileTpl={sat:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',sea:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'};
/* σελίδες */
B.lazyView('map',T('Χάρτης','Map'),MAP);
B.lazyView('help',T('Πώς δουλεύει','How it works'),['help.js']);
B.lazyView('boat',T('Σκάφος','Boat'),['boat-view.js']);
B.lazyView('friends',T('Φίλοι','Friends'),['friends-view.js']);
B.lazyView('tackle',T('Εξοπλισμός','Tackle'),['tackle-view.js']); /* 1.3.2: το backup και τα ονόματα/βάρη είναι στο tackle-core.js (φορτώνεται στο άνοιγμα) */
B.lazyView('check',T('Έλεγχος συστήματος','System check'),['syscheck.js']);
/* εργασίες που έτρεχαν στο άνοιγμα από αυτά τα αρχεία:
   · «Τι νέο υπάρχει» (help.js): φορτώνεται μόνο αν άλλαξε η έκδοση από την τελευταία φορά
   · υπενθυμίσεις συντήρησης σκάφους (boat-view.js): μόνο για το προφίλ «Βάρκα» */
function idle(f,ms){ setTimeout(function(){ (window.requestIdleCallback||function(cb){ cb(); })(f); },ms); }
idle(function(){ var seen=null; try{ seen=JSON.parse(localStorage.getItem('alkyon-v4-news')); }catch(e){}
  if(seen!==window.ALKYON_VERSION) B.loadScripts(['help.js']).catch(function(){}); },1500);
idle(function(){ if(B.prof&&B.prof()==='boat') B.loadScripts(['boat-view.js']).catch(function(){}); },2500);
/* ο χάρτης φορτώνεται και μόνος του λίγο μετά το άνοιγμα, όταν η εφαρμογή δεν κάνει τίποτα άλλο: έτσι ανοίγει αμέσως όταν τον πατήσεις,
   χωρίς να καθυστερεί την πρώτη οθόνη. Σε αργή σύνδεση (2g / εξοικονόμηση δεδομένων) περιμένει να τον ανοίξεις. */
idle(function(){ var cn=navigator.connection||{}; if(cn.saveData||/2g/.test(cn.effectiveType||'')) return; loadMap().catch(function(){}); },5000);
})();
