/* BiteCast 4 · Οδηγός (#guide): είδη (τα 100 είδη της Κύπρου με φωτογραφίες, μαλάκια, καρκινοειδή, περιοχές, GBIF), τεχνικές, νόμοι,
   λίστα ασφαλείας, μαγαζιά και κόμποι. Ίδιο περιεχόμενο με την κλασική: ο κώδικας είναι κοινός (guide-core.js, ../knots.js).
   Στα αγγλικά η μετάφραση γίνεται με το ίδιο λεξικό της κλασικής (../i18n.js), μόνο μέσα στον Οδηγό. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN;
var page=null, ready=null, core=null;
function load(src){ return new Promise(function(res){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
var HTML='<div class="seg gseg" role="group" aria-label="Ενότητα οδηγού">'+
  '<button type="button" data-g="species" aria-pressed="true">Είδη</button><button type="button" data-g="tech" aria-pressed="false">Τεχνικές</button>'+
  '<button type="button" data-g="law" aria-pressed="false">Νόμοι</button><button type="button" data-g="safety" aria-pressed="false">Ασφάλεια</button>'+
  '<button type="button" data-g="shops" aria-pressed="false">Μαγαζιά</button></div>'+
  '<div id="g-species" class="list"><input type="text" id="spQ" class="search-in" placeholder="Αναζήτηση είδους (ελληνικά, αγγλικά, λατινικά)" aria-label="Αναζήτηση είδους"><div class="note" id="spCount"></div><div class="list" id="spList"></div><button class="btn ghost" type="button" id="spOnline" hidden>Αναζήτηση online (GBIF)</button></div>'+
  '<div id="g-tech" class="list" hidden></div><div id="g-law" class="list" hidden></div>'+
  '<div id="g-shops" class="list" hidden><div class="card"><h3>Κοντινά μαγαζιά ψαρικής</h3><p class="note">Ανοίγει το Google Maps με αναζήτηση γύρω από τη θέση σου, με ώρες, τηλέφωνα και οδηγίες. Η θέση δεν αποθηκεύεται στην εφαρμογή.</p><div class="row" style="margin-top:8px"><button class="btn acc" type="button" id="sShops">Άνοιγμα στο Google Maps</button></div></div></div>'+
  '<div id="g-safety" hidden><div class="card"><h3>Λίστα πριν την έξοδο</h3><div id="checks"></div><p class="note" style="margin:10px 0 0">Γενική λίστα. Έλεγξε τις υποχρεώσεις που ισχύουν για το σκάφος και την άδεια ψαρέματος σου.</p></div>'+
  '<div class="card" style="margin-top:16px"><h3>Κανονισμοί</h3><p>Ελάχιστα μεγέθη, κλειστές περιόδοι, προστατευόμενα είδη και άδειες αλλάζουν. Επιβεβαίωσέ τα πάντα στο Τμήμα Αλιείας και Θαλασσίων Ερευνών πριν κρατήσεις ψάρι.</p></div></div>';
function build(){
  page=h('div',{class:'page guide'});
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω','Back'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Οδηγός','Guide')}))));
  var sec=h('section',{id:'tab-guide',class:'gbody'}); sec.innerHTML=HTML; page.append(sec);
  return sec;
}
/* τα δεδομένα των ειδών, των περιοχών και των μεγεθών φορτώνονται μόνο όταν ανοίξει ο Οδηγός */
function deps(){ var p=Promise.resolve(), L=['../cy100.js'].concat(window.SPECIES_REG?[]:['../regions.js']).concat(window.MIN_SIZES?[]:['../rules.js']);
  if(EN&&!window.PsaroTrWatch){ window.PSARO_NO_DOMTR=true; L.unshift('../i18n.js'); }
  L.forEach(function(f){ p=p.then(function(){ return load(f); }); }); return p; }
B.guideReady=function(){ if(ready) return ready;
  ready=deps().then(function(){ var tmp=null; if(!page.isConnected){ tmp=h('div',{hidden:true}); tmp.append(page); document.body.append(tmp); } var sec=page.querySelector('#tab-guide'); if(EN&&window.PsaroTrWatch) PsaroTrWatch(sec);
    try{ core=window.PsaroGuideCore(); }catch(e){ console.error(e); }
    return load('../knots.js').then(function(){ if(tmp){ tmp.remove(); } }); }).then(function(){ return core; });
  return ready; };
/* για τη φόρμα ψαριού: ελάχιστο μέγεθος από τους κανονισμούς (ίδιο με την κλασική) */
B.minSize=function(name){ if(!window.MIN_SIZES) return null; var c=core; if(!c) return null; var sp=c.matchSp(name); if(!sp) return null; return {la:sp.la,min:c.minOf(sp.la)}; };
B.view('guide',{title:T('Οδηγός','Guide'),mount:function(el){
  if(!page) build(); el.replaceChildren(page);
  if(!core){ var w=h('div',{class:'sk',style:{height:'120px',marginTop:'12px'}}); page.querySelector('#g-species').append(w); B.guideReady().then(function(){ w.remove(); }); }
},unmount:function(){}});
})();
