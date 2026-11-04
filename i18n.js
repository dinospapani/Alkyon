/* Γλώσσα / Language. Ελληνικά είναι η βάση· τα Αγγλικά μεταφράζονται εδώ. Για νέα γλώσσα: πρόσθεσε ένα λεξικό στο I18N και μία επιλογή στο #langSel. */
/* 1.3.2: το λεξικό και η μετάφραση στα αγγλικά είναι στο i18n-en.js και φορτώνεται ΜΟΝΟ στα αγγλικά (≈80 KB λιγότερα στα ελληνικά).
   Στο v4 το i18n-en.js μπαίνει αμέσως μετά από αυτό το αρχείο (document.write κατά το φόρτωμα της σελίδας), οπότε τα επόμενα αρχεία βρίσκουν έτοιμο το AlkyonTr.
   Σελίδες που φορτώνουν τα αρχεία δυναμικά (κλασική) βάζουν το i18n-en.js στη λίστα τους. */
(function(){
var LANG='el';
try{ LANG=localStorage.getItem('alkyon-lang')||'el'; /* 1.6.6: πάντα Ελληνικά εκτός αν διαλέξεις English στο Προφίλ */ }catch(e){}
if(LANG!=='en') LANG='el'; /* μόνο ελληνικά (βάση) και αγγλικά (i18n-en.js) */
window.LANG=LANG;
window.spName=function(n){ return n; };
document.documentElement.lang=LANG;
if(LANG==='el') return;
if(window.AlkyonTr) return;
if(document.readyState==='loading'){ var src=(document.currentScript&&document.currentScript.src)||''; document.write('<script src="'+src.replace(/i18n\.js(\?.*)?$/,'')+'i18n-en.js"><\/script>'); }
})();
window.setLang=function(l){
  try{ localStorage.setItem('alkyon-lang',l); }catch(e){}
  /* Θυμάται πού ήσουν (καρτέλα, Προφίλ, Ρυθμίσεις) ώστε μετά την αλλαγή γλώσσας να μείνεις στο ίδιο σημείο */
  try{
    var g=function(i){ return document.getElementById(i); }, tab=null, nb=document.querySelector('nav.tabs button[aria-selected="true"]');
    if(nb) tab=nb.dataset.tab;
    var pr=g('profile'), ps=g('pSettings'), st=g('pSettings')&&!g('pSettings').hidden;
    sessionStorage.setItem('alkyon-restore',JSON.stringify({tab:tab,prof:!!(pr&&!pr.hidden),set:!!st,pv:(window.AlkyonProfView?AlkyonProfView.get():null),y:pr?pr.scrollTop:0,t:Date.now()}));
  }catch(e){}
  /* v31z71: κάλυμμα σκούρο με το λογότυπο (όχι λευκή οθόνη) όσο φορτώνει ξανά η εφαρμογή */
  try{
    var cv=document.createElement('div'); cv.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0c2b3a url(icon-192.png) center/84px no-repeat;opacity:0;transition:opacity .15s';
    document.body.appendChild(cv); void cv.offsetWidth; cv.style.opacity='1';
    document.documentElement.classList.add('rst');
  }catch(e){}
  setTimeout(function(){ location.reload(); },170);
};
window.addEventListener('load',function(){
  var root=document.documentElement, show=function(){ root.classList.remove('rst'); };
  var r=null; try{ r=JSON.parse(sessionStorage.getItem('alkyon-restore')||'null'); sessionStorage.removeItem('alkyon-restore'); }catch(e){}
  if(!r||Date.now()-r.t>20000){ show(); return; }
  setTimeout(show,3500);
  setTimeout(function(){
    try{
      var g=function(i){ return document.getElementById(i); };
      if(r.tab){ var b=document.querySelector('nav.tabs button[data-tab="'+r.tab+'"]'); if(b) b.click(); }
      if(r.prof&&g('profBtn')){ g('profBtn').click();
        if(r.pv&&window.AlkyonProfView) AlkyonProfView.set(r.pv); else if(r.set&&g('pGear')) g('pGear').click();
        try{ g('profile').scrollTop=r.y||0; }catch(e){} }
    }catch(e){}
    setTimeout(show,150);
  },350);
});
