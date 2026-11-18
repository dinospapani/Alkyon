/* 1.14.55: μικρές επικεφαλίδες ενότητας ανάμεσα στις κάρτες, για να φαίνεται η σελίδα οργανωμένη σε ομάδες
   (όπως «Πότε και πού» / «Με τι» στη φόρμα ψαριού). Μπαίνουν πριν από την πρώτη κάρτα κάθε ομάδας· αν μια ομάδα δεν έχει κάρτες, δεν μπαίνει τίποτα. */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var RULES={
  forecast:[
    [T('Συνθήκες','Conditions'),/^(Έκθεση ακτής|Coast exposure|Πίεση, άνεμος|Pressure, wind|Διαύγεια|Water clarity)/],
    [T('Από το ημερολόγιό σου','From your logbook'),/^(Τι δούλεψε|What worked|Πέρσι|Last year|Σε σχέση με τις καλύτερες|Compared with your best)/],
    [T('Προσωπική πρόγνωση','Personal forecast'),/^(Κάνε τα ψάρια σου|Make your catches count|Η προσωπική σου πρόγνωση|Your personal forecast)/],
    [T('Τι δείχνουν τα ψάρια σου','What your catches show'),/^(Τι κοινό είχαν|Your catches in common|Τα μοτίβα σου|Your patterns)/],
    [T('Έλεγχος και ιστορικό','Checks and history'),/^(Έλεγχος της πρόγνωσης|Checking the forecast|Πρόσφατες έξοδοι|Recent trips|Πόσο έπεσε μέσα|Ψάρια ανά ώρα)/],
    [T('Εποχές','Seasons'),/^(Εποχές ειδών|Species seasons)/]
  ],
  log:[
    [T('Τα δικά σου','Yours'),/^(Ρεκόρ ανά είδος|Records by species|Πότε πιάνεις|When you catch)/],
    [T('Από όλους τους ψαράδες','From all anglers'),/^(Πότε τσιμπάνε|When they bite)/],
    [T('Τι πιάνεις και με τι','What you catch and with what'),/^(Είδη|Species|Δολώματα|Baits|Τεχνικές|Techniques)$/],
    [T('Σύγκριση και στόχοι','Comparison and goals'),/^(Σύγκριση χρον|Year comparison|Στόχοι|Goals)/]
  ]
};
function titleOf(el){ var t=el.querySelector(':scope>h2, :scope>h3, :scope>summary b, :scope>summary, :scope>.gh h2, :scope>.oph h2, :scope>.pwh h2, :scope>.hch h2, :scope h2'); if(!t) return ''; var s=''; for(var n=t.firstChild;n;n=n.nextSibling){ if(n.nodeType===3) s+=n.textContent; else if(n.nodeType===1&&!/infob|pik/.test(n.className||'')&&n.tagName!=='BUTTON'&&n.tagName!=='SMALL') s+=n.textContent; } return s.replace(/^[^\wΑ-Ωα-ωά-ώ]+/,'').trim(); }
var busy=false;
function apply(){ if(busy) return; var view=document.documentElement.getAttribute('data-view'), R=RULES[view], page=document.querySelector('main .page'); if(!page) return; var dw=page.querySelector(':scope>.dwrap'); if(dw) page=dw;
  busy=true; try{
    var kids=[].filter.call(page.children,function(e){ return /(^| )(card|sfold)( |$)/.test(e.className)&&!e.hidden; }), want=[];
    if(R) R.forEach(function(r){ for(var i=0;i<kids.length;i++){ if(r[1].test(titleOf(kids[i]))){ want.push([kids[i],r[0]]); break; } } });
    var cur=[].slice.call(page.querySelectorAll(':scope>.pgsec')), same=cur.length===want.length&&want.every(function(w,i){ return cur[i].nextElementSibling===w[0]&&cur[i].textContent===w[1]; });
    if(!same){ cur.forEach(function(e){ e.remove(); }); want.forEach(function(w){ var p=document.createElement('p'); p.className='pgsec'; p.setAttribute('role','heading'); p.setAttribute('aria-level','2'); p.textContent=w[1]; w[0].before(p); }); }
  }catch(e){} busy=false; }
var tm=null; function later(){ clearTimeout(tm); tm=setTimeout(apply,120); }
function start(){ try{ new MutationObserver(function(ms){ if(busy) return; for(var i=0;i<ms.length;i++){ var m=ms[i]; if(m.target&&m.target.classList&&m.target.classList.contains('pgsec')) continue; later(); return; } }).observe(document.querySelector('main')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']}); }catch(e){} later(); }
if(document.readyState!=='loading') start(); else document.addEventListener('DOMContentLoaded',start);
(window.AK||{}).sectionsApply=apply;
})();
