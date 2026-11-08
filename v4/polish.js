/* Alkyon 1.9.36 · πέρασμα εμφάνισης σε όλη την εφαρμογή
   1) Τα έγχρωμα emoji μέσα σε κείμενα της εφαρμογής γίνονται δικά μας γραμμικά εικονίδια (ίδια σε κάθε κινητό, παίρνουν το χρώμα του κειμένου).
   2) Μεγάλα επεξηγηματικά κείμενα (υπότιτλοι/σημειώσεις) δείχνουν 2 γραμμές και «Περισσότερα» για τα υπόλοιπα.
   Δεν αλλάζει δεδομένα ούτε συμπεριφορά. Δεν πειράζει πεδία κειμένου, καμβάδες, χάρτες ή ειδοποιήσεις του συστήματος. */
(function(){
'use strict';
var B=window.AK; if(!B) return; var T=B.T;
var P={
  fish:'<path d="M3 12c2.6-3.6 6.4-5.5 10-5 2.2.3 4 1.6 5.2 3.4L21.5 8v8l-3.3-2.4C17 15.4 15.2 16.7 13 17c-3.6.5-7.4-1.4-10-5z"/><circle cx="7.6" cy="11.2" r="1" fill="currentColor" stroke="none"/>',
  puffer:'<circle cx="11" cy="12" r="6.5"/><path d="M17.5 12l4-3v6zM11 3.5V5M11 19v1.5M5 6l1 1M5 18l1-1M16 6l-1 1M16 18l-1-1M3 12h1.5"/><circle cx="8.6" cy="10.8" r="1" fill="currentColor" stroke="none"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
  up:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down:'<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  pin:'<path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  inbox:'<path d="M4 13l2.5-8h11L20 13v6H4z"/><path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20"/>',
  map:'<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14M15 6v14"/>',
  camera:'<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
  anchor:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M4.5 14a7.5 7.5 0 0 0 15 0"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  clip:'<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  search:'<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  note:'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8.5 12h7M8.5 16h5"/>',
  x:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  ok:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 10"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  island:'<path d="M3 19c3-2 6-2 9 0s6 2 9 0"/><path d="M12 17V8M12 8c-2-3-5-3-7-1M12 8c2-3 5-3 7-1M12 8c-1-3 1-5 3-5"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  wave:'<path d="M2.5 9c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.8-2 2.4 2 4.7 2"/><path d="M2.5 15c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.8-2 2.4 2 4.7 2"/>',
  home:'<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  fuel:'<path d="M5 21V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v16M3.5 21h12M5 10h9"/><path d="M14 8l3.5 3v6.5a1.5 1.5 0 0 0 3 0V9l-2.5-2.5"/>',
  book:'<path d="M4 5.5A2 2 0 0 1 6 3.5h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20.5a2 2 0 0 0 2 1h13v-3"/>',
  trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5A3.5 3.5 0 0 1 16.5 11M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z"/>',
  wind:'<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  heart:'<path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z"/>',
  chat:'<path d="M4 5.5h16v10.5H10l-4.5 4v-4H4z"/>',
  star:'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'
};
var MAP={'🐟':'fish','🐠':'fish','🎣':'fish','🐡':'puffer','🎤':'mic','📈':'up','📉':'down','📊':'chart','📍':'pin','📥':'inbox','🗺':'map','📷':'camera','📸':'camera','⚓':'anchor','🌙':'moon','📋':'clip',
  '🎯':'target','🔍':'search','🔎':'search','📝':'note','❌':'x','✅':'ok','👍':'ok','☀':'sun','🏝':'island','🔔':'bell','🌊':'wave','🏠':'home','⛽':'fuel','📖':'book','⭐':'star','🏆':'trophy','🥇':'trophy','🌬':'wind','💨':'wind','❤':'heart','💬':'chat'};
var KEYS=Object.keys(MAP).sort(function(a,b){ return b.length-a.length; });
var RE=new RegExp('('+KEYS.map(function(k){ return k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }).join('|')+')\\uFE0F?\\s?','g');
var SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,INPUT:1,SELECT:1,OPTION:1,CANVAS:1,svg:1,SVG:1,TITLE:1,NOSCRIPT:1};
function icon(n){ var i=document.createElement('i'); i.className='ik pik pik-'+n; i.setAttribute('aria-hidden','true'); i.innerHTML='<svg viewBox="0 0 24 24">'+P[n]+'</svg>'; return i; }
function fixText(tn){
  var s=tn.data; RE.lastIndex=0; if(!RE.test(s)) return; RE.lastIndex=0;
  var p=tn.parentNode; if(!p||SKIP[p.nodeName]||(p.closest&&p.closest('.leaflet-container,[contenteditable],.noik'))) return;
  var frag=document.createDocumentFragment(), last=0, m;
  while((m=RE.exec(s))){ if(m.index>last) frag.appendChild(document.createTextNode(s.slice(last,m.index))); frag.appendChild(icon(MAP[m[1]])); last=m.index+m[0].length; }
  if(last<s.length) frag.appendChild(document.createTextNode(s.slice(last)));
  p.replaceChild(frag,tn);
}
function walk(root){
  if(!root) return; if(root.nodeType===3){ fixText(root); return; } if(root.nodeType!==1||SKIP[root.nodeName]) return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null), a=[], n; while((n=w.nextNode())) a.push(n); a.forEach(fixText);
  clampIn(root);
}
/* 2) μεγάλα επεξηγηματικά κείμενα: 2 γραμμές + «Περισσότερα» */
var CL='p.sub,p.foot,p.note,.card>small,.fold small.hint';
function clampIn(root){
  var els=[]; if(root.matches&&root.matches(CL)) els.push(root); if(root.querySelectorAll) els=els.concat([].slice.call(root.querySelectorAll(CL)));
  els.forEach(function(p){
    if(p.dataset.cl||p.closest('.hero,.sheet,.bsheet,.modal,dialog,.noclamp,.toast,form,.tfill,.calml')) return;
    var t=(p.textContent||'').trim(); if(t.length<190) return; p.dataset.cl='1';
    p.classList.add('clmp');
    var b=document.createElement('button'); b.type='button'; b.className='clmpb'; b.textContent=T('Περισσότερα','More');
    b.addEventListener('click',function(e){ e.stopPropagation(); var o=p.classList.toggle('open'); b.textContent=o?T('Λιγότερα','Less'):T('Περισσότερα','More'); });
    if(p.nextSibling) p.parentNode.insertBefore(b,p.nextSibling); else p.parentNode.appendChild(b);
  });
}
var q=[], sch=false;
function flush(){ sch=false; var a=q; q=[]; a.forEach(function(n){ if(n.isConnected) walk(n); }); }
var mo=new MutationObserver(function(ms){ ms.forEach(function(m){ m.addedNodes.forEach(function(n){ q.push(n); }); if(m.type==='characterData') q.push(m.target); }); if(!sch){ sch=true; requestAnimationFrame(flush); } });
function start(){ walk(document.body); mo.observe(document.body,{childList:true,subtree:true}); }
if(document.body) start(); else document.addEventListener('DOMContentLoaded',start);
B.polishIcon=icon;
})();
