/* v31z352: Φόρμα έναρξης εξόδου, απλή και γρήγορη.
   Μπροστά: «Πού πας» (με πρόσφατα μέρη), «Επιστροφή σε», διακόπτης «Ειδοποίηση επαφής ασφαλείας» και «Έναρξη».
   Στο «Περισσότερα»: λιμάνι αναχώρησης (συμπληρώνεται αυτόματα από τη θέση), έλεγχος σήματος, λίστες πριν φύγεις.
   Δεν αλλάζει τη λογική της έξοδου (extras.js): μόνο ξαναβάζει τα ίδια πεδία σε καλύτερη σειρά. */
(function(){
'use strict';
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
function $(i){ return document.getElementById(i); }
function el(t,c,x){ var e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; }
function ls(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } }
function lss(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
var RK='alkyon-routes', built=false;

function recents(){
  var out=[], seen={};
  function add(n){ n=(n||'').trim(); var k=n.toLowerCase(); if(!n||seen[k]||n.length>40) return; seen[k]=1; out.push(n); }
  (ls(RK,[])||[]).forEach(add);
  try{ var C=window.AlkyonCore; (C.Store.get('trips')||[]).slice().sort(function(a,b){ return (b.startMs||0)-(a.startMs||0)||String(b.date).localeCompare(String(a.date)); }).forEach(function(t){ add(t.spot); }); }catch(e){}
  return out.slice(0,6);
}
function remember(n){ n=(n||'').trim(); if(!n) return; var l=(ls(RK,[])||[]).filter(function(x){ return x.toLowerCase()!==n.toLowerCase(); }); l.unshift(n); lss(RK,l.slice(0,10)); }
function contact(){ try{ var C=window.AlkyonCore; if(C&&C.lsGet) return C.lsGet('alkyon-safe',{})||{}; }catch(e){} return ls('alkyon-safe',{})||{}; }

function build(){
  var form=$('sfForm'), route=$('sfRoute'), go=$('sfStart'), time=$('sfTime'), dur=$('sfDur'), sil=$('sfSil');
  if(!form||!route||!go||!time||!dur||!sil||!$('sfPort')) return false;
  built=true; form.classList.add('tf');
  /* σύντομη εισαγωγή */
  var intro=document.querySelector('#safeIdle > p.note:not(.sfwarn)'); if(intro){ intro.classList.add('tfintro'); intro.textContent=T('Πες πού πας και πότε γυρίζεις. Η εφαρμογή παρακολουθεί την έξοδο όσο ψαρεύεις.','Say where you are going and when you will be back. The app watches over the trip while you fish.'); }

  /* 1) Πού πας + πρόσφατα */
  var rsec=route.closest('.sfsec'); rsec.classList.add('tfsec');
  var lab=route.closest('label'); if(lab&&lab.firstChild&&lab.firstChild.nodeType===3) lab.firstChild.nodeValue=T('Πού πας','Where are you going');
  route.placeholder=T('π.χ. Λατσί, ύφαλος βόρεια του φάρου','e.g. Latchi, reef north of the lighthouse');
  var chips=el('div','tfchips'); chips.id='tfRecent'; rsec.append(chips);
  function drawChips(){ chips.replaceChildren(); recents().forEach(function(n){ var b=el('button','tfchip',n); b.type='button'; b.setAttribute('aria-pressed',String(route.value.trim().toLowerCase()===n.toLowerCase())); b.addEventListener('click',function(){ route.value=n; var bx=route.parentNode.querySelector('.sgbox'); if(bx) bx.hidden=true; drawChips(); }); chips.append(b); }); chips.hidden=!chips.children.length; }
  route.addEventListener('input',function(){ [].forEach.call(chips.children,function(b){ b.setAttribute('aria-pressed',String(route.value.trim().toLowerCase()===b.textContent.toLowerCase())); }); });

  /* 2) Επιστροφή: κουμπιά ωρών + «Επιστροφή έως HH:MM · Αλλαγή ώρας» */
  var dsec=dur.closest('.sfsec'); dsec.classList.add('tfsec');
  var dl=dsec.querySelector('.sflabel'); if(dl) dl.textContent=T('Επιστροφή σε','Back in');
  var tl=time.closest('label'); if(tl) tl.classList.add('tftime');
  var sum=el('div','tfsum'), st=el('span'), ch=el('button','tflink',T('Αλλαγή ώρας','Change time')); ch.type='button'; sum.append(st,ch); dsec.insertBefore(sum,tl);
  var open=false; function syncTime(){ if(tl) tl.hidden=!open; st.textContent=T('Επιστροφή έως ','Back by ')+(time.value||'--:--'); ch.textContent=open?T('Έτοιμο','Done'):T('Αλλαγή ώρας','Change time'); }
  ch.addEventListener('click',function(){ open=!open; syncTime(); if(open) setTimeout(function(){ try{ time.focus(); if(time.showPicker) time.showPicker(); }catch(e){} },60); });
  time.addEventListener('input',syncTime); time.addEventListener('change',function(){ [].forEach.call(dur.querySelectorAll('.chip'),function(b){ b.setAttribute('aria-pressed','false'); }); syncTime(); });
  dur.addEventListener('click',function(){ setTimeout(syncTime,30); });

  /* 3) Ειδοποίηση επαφής ασφαλείας */
  var ncard=el('div','sfsec tfsec tfnotify'); ncard.id='tfNotify';
  var nt=el('div','tfntx'), nb=el('b',null,T('Ειδοποίηση επαφής ασφαλείας','Notify my safety contact')), ns=el('span'); nt.append(nb,ns);
  var sw=el('label','tfswitch'), cb=el('input'); cb.type='checkbox'; cb.id='sfNotify'; cb.checked=true; cb.setAttribute('role','switch');
  var knob=el('i'); knob.setAttribute('aria-hidden','true'); sw.append(cb,knob); sw.setAttribute('aria-label',T('Ειδοποίηση επαφής ασφαλείας','Notify my safety contact'));
  ncard.append(nt,sw);
  function syncN(){
    var d=contact(), has=!!(d.phone||d.email||d.tgLinked), nm=(d.name||'').trim();
    cb.disabled=!has; if(!has) cb.checked=false;
    ncard.classList.toggle('off',!cb.checked);
    ns.textContent=!has?T('Δεν έχεις ορίσει επαφή. Πρόσθεσέ την από το Προφίλ.','No contact set. Add one in your profile.')
      :cb.checked?((nm?nm+' · ':'')+T('αν δεν γυρίσεις στην ώρα, αν χαθεί το σήμα ή πέσει η μπαταρία','if you are late, lose signal or run low on battery'))
      :T('Δεν στέλνεται τίποτα σε αυτή την έξοδο. Το SOS λειτουργεί πάντα.','Nothing is sent on this trip. SOS always works.');
    var w=$('sfNoC'); if(w) w.hidden=true;
    if(!has){ ns.classList.add('tfwarn'); ns.onclick=function(){ var b=$('sfGoProf'); if(b) b.click(); }; } else { ns.classList.remove('tfwarn'); ns.onclick=null; }
  }
  cb.addEventListener('change',syncN);

  /* 4) Περισσότερα: λιμάνι, έλεγχος σήματος, λίστες */
  var more=el('details','tfmore'); more.id='tfMore';
  var ms=el('summary'), mt=el('span',null,T('Περισσότερα','More')), mx=el('small'); ms.append(mt,mx); more.append(ms);
  var mbody=el('div','tfbody'); more.append(mbody);
  var psec=$('sfPort').closest('.sfsec'), ssec=sil.closest('.sfsec');
  if(psec) mbody.append(psec); if(ssec){ var sl=ssec.querySelector('.sflabel'); if(sl) sl.textContent=T('Αν χαθεί το σήμα','If the signal is lost'); mbody.append(ssec); }
  form.insertBefore(ncard,go); form.insertBefore(more,go);
  function adoptExtras(){ /* οι λίστες ελέγχου μπαίνουν από άλλα αρχεία πριν από το «Έναρξη»: τις κρατάμε μέσα στο «Περισσότερα» */
    var c=form.querySelector(':scope > .clbtn'); if(c) mbody.append(c);
    var p=$('ndPre'); if(p&&p.parentNode!==mbody) mbody.append(p);
  }
  function syncMore(){
    var bits=[], pv=($('sfPort').value||'').trim(); if(pv) bits.push(pv);
    var sv=+sil.value||0; bits.push(sv?T('σήμα ','signal ')+sv+'′':T('χωρίς έλεγχο σήματος','no signal check'));
    var cl=form.querySelector('.clbtn'); if(cl){ var m=/\((\d+\/\d+)\)/.exec(cl.textContent||''); if(m) bits.push(T('λίστα ','list ')+m[1]); }
    var t=bits.join(' · '); if(mx.textContent!==t) mx.textContent=t;
  }
  new MutationObserver(function(){ adoptExtras(); }).observe(form,{childList:true});
  ['input','change'].forEach(function(ev){ $('sfPort').addEventListener(ev,syncMore); sil.addEventListener(ev,syncMore); });
  (window.ndEvery||setInterval)(function(){ if(!$('tripSheet').hidden) syncMore(); },1500);

  /* «Έναρξη» */
  go.classList.add('tfgo'); go.textContent=T('▶ Έναρξη εξόδου','▶ Start trip');
  go.addEventListener('click',function(){ remember(route.value); },true);

  /* κάθε φορά που ανοίγει η φόρμα: ο διακόπτης ξεκινά ενεργός (ασφάλεια πρώτα), ξαναζωγραφίζονται τα πρόσφατα */
  function onOpen(){ cb.checked=true; open=false; drawChips(); syncN(); syncTime(); adoptExtras(); syncMore(); more.open=false; }
  var sheet=$('tripSheet'), was=sheet.hidden;
  new MutationObserver(function(){ if(was&&!sheet.hidden) onOpen(); was=sheet.hidden; }).observe(sheet,{attributes:true,attributeFilter:['hidden']});
  onOpen();
  return true;
}
var n=0, iv=setInterval(function(){ n++; if(built||build()||n>60) clearInterval(iv); },500);
})();
