/* Οθόνη επιλογής στο άνοιγμα: «Πού ψαρεύεις σήμερα;». Φορτώνεται πρώτη, αμέσως μετά το <body>, ώστε να εμφανίζεται πριν από οτιδήποτε άλλο. */
(function(){
  var EN=false; try{ EN=(localStorage.getItem('alkyon-lang')==='"en"')||(localStorage.getItem('alkyon-lang')==='en'); }catch(e){}
  if(!EN){ try{ var nl=(navigator.language||'').slice(0,2); if(!localStorage.getItem('alkyon-lang')&&nl&&nl!=='el') EN=true; }catch(e){} }
  var T=function(el,en){ return EN?en:el; };
  var PIC={"boat": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc0\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc0)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"48\" width=\"96\" height=\"14\" fill=\"#2b7893\"/><rect y=\"62\" width=\"96\" height=\"40\" fill=\"#0f5c76\"/><g transform=\"translate(5,3) scale(.93)\">\n<path d=\"M30 17L24 5M34 17L29 4M60 17V6\" stroke=\"#e8f2f5\" stroke-width=\"1.200\" stroke-linecap=\"round\"/>\n<path d=\"M41 45L43 22M52 45L50 22\" stroke=\"#e8f2f5\" stroke-width=\"2.400\" stroke-linecap=\"round\"/><path d=\"M43 36h8M42 30h8\" stroke=\"#e8f2f5\" stroke-width=\"1.200\" stroke-opacity=\".7\"/>\n<path d=\"M28 17.500h37l-2 4.500H30z\" fill=\"#e8f2f5\"/><rect x=\"44\" y=\"13\" width=\"9\" height=\"4.500\" rx=\"1\" fill=\"#8fb6c4\"/><rect x=\"55\" y=\"14.500\" width=\"3\" height=\"3\" rx=\".5\" fill=\"#8fb6c4\"/>\n<path d=\"M38 56V45h18l2 11z\" fill=\"#cfe0e6\"/><path d=\"M40 45l2.500-6h10l3 6z\" fill=\"#7fc6d8\"/>\n<path d=\"M64 56v-8h5l1 8z\" fill=\"#8fb6c4\"/><path d=\"M62 48h8\" stroke=\"#e8f2f5\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M22 56v-4h8v4z\" fill=\"#8fb6c4\"/>\n<path d=\"M82 45h6.500q2.500 0 2.500 3l-1 9-1.500 11q-.5 3-3 3h-3z\" fill=\"#08202b\"/>\n<path d=\"M4 56L22 54.500 82 54Q86 54 86 57L84.500 63Q83 68 77 68H28Q14 68 4 56Z\" fill=\"#e8f2f5\"/>\n<path d=\"M7 59.500L85.500 58.500 84.500 63Q83 68 77 68H28Q15 68 7 59.500Z\" fill=\"#2f9db8\"/><path d=\"M8 60L85 59\" stroke=\"#ff6a3d\" stroke-width=\"1.500\"/>\n</g>\n<path d=\"M0 70c8-3 14 3 22 0s14 3 22 0 14 3 22 0 14 3 22 0 6 2 8 0V96H0z\" fill=\"#0b475d\"/><path d=\"M0 70c8-3 14 3 22 0s14 3 22 0 14 3 22 0 14 3 22 0\" stroke=\"#e8f2f5\" stroke-opacity=\".5\" stroke-width=\"1.600\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#ff6a3d\" stroke-width=\"2.5\"/></svg>", "shore": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc1\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc1)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"50\" width=\"96\" height=\"14\" fill=\"#2b7893\"/><rect y=\"64\" width=\"96\" height=\"40\" fill=\"#0f5c76\"/>\n<path d=\"M33 49Q58 36 80 18\" stroke=\"#08202b\" stroke-width=\"1.900\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M80 18C84 28 83 48 76 71\" stroke=\"#e8f2f5\" stroke-opacity=\".85\" stroke-width=\".9\" fill=\"none\"/>\n<circle cx=\"76\" cy=\"71\" r=\"2.600\" fill=\"#ff6a3d\"/><ellipse cx=\"76\" cy=\"73\" rx=\"9\" ry=\"2.200\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".5\"/>\n<path d=\"M0 60Q14 54 30 60Q40 64 46 72L50 96H0z\" fill=\"#27495a\"/><path d=\"M0 60Q14 54 30 60Q36 62 40 66L44 74 0 74z\" fill=\"#2f5a6b\"/><path d=\"M0 60Q14 54 30 60Q36 62 40 66\" stroke=\"#6fb08a\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n<path d=\"M20 60 22 50Q24 44 30 44L35 46 34 52 30 60z\" fill=\"#ff6a3d\"/>\n<path d=\"M16 60l4-1 9-1 8 2 1 3H18z\" fill=\"#08202b\"/><path d=\"M34 60l1 5\" stroke=\"#08202b\" stroke-width=\"2.600\" stroke-linecap=\"round\"/>\n<circle cx=\"26\" cy=\"39\" r=\"3.800\" fill=\"#f2c9a5\"/><path d=\"M20 37.500h13l-2-2.500a4 4 0 0 0-9 0z\" fill=\"#16384a\"/><path d=\"M18 38h17\" stroke=\"#16384a\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n<path d=\"M30 47Q34 48 34 49\" stroke=\"#f2c9a5\" stroke-width=\"2.200\" stroke-linecap=\"round\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>", "lake": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc2\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc2)\"><rect width=\"96\" height=\"96\" fill=\"#1d5f7a\"/><rect y=\"0\" width=\"96\" height=\"26\" fill=\"#2b7893\"/>\n<path d=\"M0 22L22 12 42 30 0 44z\" fill=\"#2f6f52\"/><path d=\"M96 14L72 24 54 30 96 46z\" fill=\"#2f6f52\"/>\n<path d=\"M0 36L28 28 40 34 0 58z\" fill=\"#245a42\"/><path d=\"M96 40L68 30 54 34 96 62z\" fill=\"#245a42\"/>\n<rect x=\"30\" y=\"32\" width=\"36\" height=\"5\" fill=\"#2a8aa6\"/>\n<path d=\"M22 36H74L82 62H14z\" fill=\"#d6e2e5\"/><path d=\"M22 36H74\" stroke=\"#e8f2f5\" stroke-width=\"2.400\"/>\n<rect x=\"26\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"36\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"46\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"56\" y=\"38\" width=\"5\" height=\"9\" fill=\"#6f8f98\"/><rect x=\"66\" y=\"38\" width=\"4\" height=\"9\" fill=\"#6f8f98\"/>\n<path d=\"M28 47l-2 15M38 47l-2 15M48 47l-1 15M58 47l1 15M68 47l2 15\" stroke=\"#e8f2f5\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\".85\"/>\n<path d=\"M0 62H96V96H0z\" fill=\"#0f5c76\"/><path d=\"M0 62C20 58 34 66 50 62S80 58 96 62V70C80 66 66 74 48 70S16 66 0 70z\" fill=\"#0b475d\"/>\n<path d=\"M0 62L14 62 6 96H0zM96 62L82 62 90 96H96z\" fill=\"#245a42\"/><path d=\"M30 70c6-2 10 2 16 0s10 2 16 0\" stroke=\"#e8f2f5\" stroke-opacity=\".5\" stroke-width=\"1.800\" fill=\"none\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>", "spear": "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 96 96\" aria-hidden=\"true\"><defs><clipPath id=\"ndpc3\"><circle cx=\"48\" cy=\"48\" r=\"46\"/></clipPath></defs><g clip-path=\"url(#ndpc3)\"><rect width=\"96\" height=\"96\" fill=\"#14627c\"/><rect y=\"46\" width=\"96\" height=\"50\" fill=\"#0e4d64\"/><rect y=\"74\" width=\"96\" height=\"22\" fill=\"#0a3548\"/>\n<path d=\"M14 0h12l14 80H24zM44 0h9l18 80H58z\" fill=\"#e8f2f5\" opacity=\".08\"/>\n<path d=\"M0 8c10-4 20 4 30 0s20 4 30 0 24 4 36 0\" stroke=\"#e8f2f5\" stroke-opacity=\".4\" stroke-width=\"1.800\" fill=\"none\"/>\n<path d=\"M0 86c14-8 26 2 42-2s26 4 40-2 10 0 14-2v18H0z\" fill=\"#06202b\"/>\n<path d=\"M72 30q6-6 14 0-8 6-14 0zM86 30l5-4v8z\" fill=\"#8fb6c4\"/><circle cx=\"76\" cy=\"29.500\" r=\"1\" fill=\"#08202b\"/>\n<g transform=\"translate(2,6) scale(.94)\"><g fill=\"#08202b\" stroke=\"#08202b\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n<ellipse cx=\"62\" cy=\"44\" rx=\"6.200\" ry=\"4.600\" stroke=\"none\"/>\n<path d=\"M57 42L52 40 40 44 28 51 25 55 31 58 44 53 56 49z\" stroke-width=\"1\"/>\n<path d=\"M58 47Q68 47 76 49.500\" fill=\"none\" stroke-width=\"4.600\"/>\n<path d=\"M28 53L16 59 8 58\" fill=\"none\" stroke-width=\"5.400\"/><path d=\"M30 56L20 63 12 66\" fill=\"none\" stroke-width=\"4.800\"/>\n<path d=\"M8 58L1 54 2 61 9 64z\" stroke-width=\"1\"/><path d=\"M12 66L5 64 4 71 12 70z\" stroke-width=\"1\"/>\n<path d=\"M65 40L63 31\" fill=\"none\" stroke-width=\"1.800\"/><path d=\"M63 31h-3\" fill=\"none\" stroke-width=\"1.800\"/></g>\n<rect x=\"62\" y=\"41.800\" width=\"5\" height=\"3.400\" rx=\"1.200\" fill=\"#8fd3e2\"/>\n<path d=\"M66 49.500L95 48.800\" stroke=\"#08202b\" stroke-width=\"2.200\" stroke-linecap=\"round\"/><path d=\"M95 48.800l-6.500-1.800 .2 3.200z\" fill=\"#ff6a3d\" stroke=\"none\"/></g>\n<circle cx=\"72\" cy=\"22\" r=\"2.200\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".6\"/><circle cx=\"76\" cy=\"14\" r=\"1.600\" fill=\"none\" stroke=\"#e8f2f5\" stroke-opacity=\".5\"/></g><circle cx=\"48\" cy=\"48\" r=\"46\" fill=\"none\" stroke=\"#2c5163\" stroke-width=\"2.5\"/></svg>"};
  var KEYS=['boat','shore','lake','spear'];
  /* Δύο βήματα: πρώτα Ακτή ή Σκάφος, μετά με τι ψαρεύεις. Κάθε συνδυασμός αντιστοιχεί σε ένα από τα 4 προφίλ + την πλευρά (alkyon-fside). */
  var SIDE={shore:{n:T('Ακτή','Shore'),d:T('Ακτή, μόλος, βράχια, φράγμα','Beach, pier, rocks, dam'),pic:'shore'},
            boat:{n:T('Σκάφος','Boat'),d:T('Θάλασσα, κύμα, MOB και SOS','Sea, waves, MOB and SOS'),pic:'boat'}};
  var METH={
    shore:[{p:'shore',n:T('Θάλασσα με καλάμι','Sea, with a rod'),d:T('Ακτή, μόλος, βράχια','Beach, pier, rocks'),pic:'shore'},
           {p:'spear',n:T('Θάλασσα με ψαροντούφεκο','Sea, spearfishing'),d:T('Βουτιά από την ακτή · σημαδούρα','Dive from the shore · float'),pic:'spear'},
           {p:'lake', n:T('Φράγμα ή λίμνη','Dam or lake'),d:T('Γλυκό νερό, χωρίς κύμα','Fresh water, no waves'),pic:'lake'}],
    boat: [{p:'boat', n:T('Καλάμι','Rod'),d:T('Βυθός, τρόλινγκ, jigging…','Bottom, trolling, jigging…'),pic:'boat'},
           {p:'spear',n:T('Ψαροντούφεκο από σκάφος','Spearfishing from a boat'),d:T('Βουτιά από τη βάρκα · σημαδούρα','Dive from the boat · float'),pic:'spear'}]};
  function ls(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function cur(){ var v=ls('alkyon-fprof'); return KEYS.indexOf(v)>-1?v:'boat'; }
  function side(){ var p=cur(), s=ls('alkyon-fside'); if(p==='boat') return 'boat'; if(p==='shore'||p==='lake') return 'shore'; return s==='boat'?'boat':'shore'; }
  function paintSide(){ try{ var s=side(); document.body.classList.toggle('fs-boat',s==='boat'); document.body.classList.toggle('fs-shore',s==='shore'); }catch(e){} }
  function label(p,s){ p=p||cur(); s=s||side(); var m=(METH[s]||[]).filter(function(x){ return x.p===p; })[0];
    if(!m) return SIDE[s].n; return s==='boat'?(p==='boat'?T('Σκάφος, καλάμι','Boat, rod'):T('Σκάφος, ψαροντούφεκο','Boat, spearfishing')):(p==='lake'?T('Φράγμα ή λίμνη','Dam or lake'):p==='spear'?T('Ακτή, ψαροντούφεκο','Shore, spearfishing'):T('Ακτή, καλάμι','Shore, rod')); }
  function setProf(k,s){
    if(s) try{ localStorage.setItem('alkyon-fside',s); }catch(e){}
    try{ if(window.AlkyonFProf) window.AlkyonFProf.set(k); else localStorage.setItem('alkyon-fprof',k); }catch(e){ try{ localStorage.setItem('alkyon-fprof',k); }catch(x){} }
    try{ localStorage.setItem('alkyon-fprof-done','1'); }catch(e){}
    paintSide();
    try{ window.dispatchEvent(new Event('alkyon-fside')); }catch(e){}
  }
  /* Ο επιλογέας ως κομμάτι που μπαίνει οπουδήποτε (οθόνη έναρξης, καλωσόρισμα, ρυθμίσεις). opt.instant: αποθηκεύει με κάθε πάτημα. */
  function render(box,opt){
    opt=opt||{}; var st={s:side(),p:cur()};
    box.classList.add('ndpk'); box.innerHTML='<div class="ndpks" role="radiogroup"></div><div class="ndpkh"></div><div class="ndpkm" role="radiogroup"></div>';
    box.querySelector('.ndpks').setAttribute('aria-label',T('Από πού ψαρεύεις','Where you fish from'));
    var sh=box.querySelector('.ndpks'), mh=box.querySelector('.ndpkm'), hh=box.querySelector('.ndpkh');
    hh.textContent=T('Με τι ψαρεύεις;','How are you fishing?'); mh.setAttribute('aria-label',hh.textContent);
    ['shore','boat'].forEach(function(s){
      var b=document.createElement('button'); b.type='button'; b.dataset.side=s; b.setAttribute('role','radio');
      b.innerHTML='<span class="ndpic" aria-hidden="true">'+PIC[SIDE[s].pic]+'</span><span class="ndpkt"><b></b><span></span></span>';
      b.querySelector('b').textContent=SIDE[s].n; b.querySelector('.ndpkt span').textContent=SIDE[s].d;
      b.addEventListener('click',function(){ if(st.s===s) return; st.s=s; var ok=METH[s].some(function(m){ return m.p===st.p; }); if(!ok) st.p=METH[s][0].p; draw(); fire(); });
      sh.appendChild(b);
    });
    function draw(){
      [].forEach.call(sh.children,function(b){ b.setAttribute('aria-checked',String(b.dataset.side===st.s)); });
      mh.innerHTML='';
      METH[st.s].forEach(function(m){
        var b=document.createElement('button'); b.type='button'; b.dataset.m=m.p; b.setAttribute('role','radio'); b.setAttribute('aria-checked',String(m.p===st.p));
        b.innerHTML='<span class="ndpki" aria-hidden="true">'+PIC[m.pic]+'</span><span class="ndpkt"><b></b><span></span></span><i class="ndck" aria-hidden="true"></i>';
        b.querySelector('b').textContent=m.n; b.querySelector('.ndpkt span').textContent=m.d;
        b.addEventListener('click',function(){ st.p=m.p; draw(); fire(); });
        mh.appendChild(b);
      });
    }
    function fire(){ if(opt.instant) setProf(st.p,st.s); if(opt.onChange) opt.onChange(st.p,st.s); }
    draw();
    return {get:function(){ return {p:st.p,s:st.s}; }};
  }
  var el=null;
  function close(){ if(!el) return; el.remove(); el=null; document.body.classList.remove('ndstartopen'); }
  function show(){
    if(el||!document.body) return;
    document.body.classList.add('nd');
    el=document.createElement('div'); el.className='ndstart'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label',T('Τύπος ψαρέματος','Fishing type'));
    el.innerHTML='<div class="ndstc"><h1></h1><div class="ndstpk"></div><div class="ndstf"><label class="ndstask"><input type="checkbox"> <span></span></label><button type="button" class="btn acc ndstgo"></button><small></small></div></div>';
    el.querySelector('h1').textContent=T('Πού ψαρεύεις σήμερα;','Where are you fishing today?');
    el.querySelector('.ndstf small').textContent=T('Αλλαγή αργότερα: Profile › Τύπος ψαρέματος','Change later: Profile › Fishing type');
    el.querySelector('.ndstask span').textContent=T('Να μη ρωτάει κάθε φορά','Don’t ask every time');
    var ask=el.querySelector('.ndstask input'); ask.checked=ls('alkyon-askfp')==='0';
    var go=el.querySelector('.ndstgo');
    function goTxt(p,s){ go.textContent=T('Συνέχεια · ','Continue · ')+label(p,s); }
    var pk=render(el.querySelector('.ndstpk'),{onChange:goTxt});
    goTxt(cur(),side());
    go.addEventListener('click',function(){ var v=pk.get(); setProf(v.p,v.s); try{ localStorage.setItem('alkyon-askfp',ask.checked?'0':'1'); }catch(e){} close(); });
    document.body.appendChild(el); document.body.classList.add('ndstartopen');
    try{ go.focus({preventScroll:true}); }catch(e){}
  }
  window.AlkyonPicker={render:render,label:label,side:side,set:setProf};
  if(document.body) paintSide(); else document.addEventListener('DOMContentLoaded',paintSide);
  window.AlkyonStartPick=show;
  function onTrip(){ try{ var s=JSON.parse(ls('alkyon-safe')||'null'); return !!(s&&s.active); }catch(e){ return false; } }
  function wanted(){
    if(!ls('alkyon-onboard')) return false;                       /* νέος χρήστης: το βλέπει μέσα στο καλωσόρισμα */
    if(ls('alkyon-askfp')==='0'&&ls('alkyon-fprof-done')) return false;
    if(onTrip()) return false;
    return true;
  }
  var done=false;
  function go(){ if(done) return; if(document.documentElement.classList.contains('gated')) return; done=true; if(wanted()) show(); }
  go();
  if(!done){ try{ new MutationObserver(go).observe(document.documentElement,{attributes:true,attributeFilter:['class']}); }catch(e){} }
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') close(); });
})();
