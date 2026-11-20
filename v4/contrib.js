/* Alkyon 1.14.21 · «Βοήθησε να γίνει πιο σωστή η πρόγνωση»
   Με τη συγκατάθεση του χρήστη (alkyon-contrib = true), στέλνει ανώνυμα στον πίνακα catch_obs:
   - κάθε ψάρι / χαμένο ψάρι: είδος, ώρα, περιοχή στρογγυλεμένη στο 0,1° (~10 km), τεχνική, πόσα, συνθήκες (άνεμος, κύμα, πίεση, τάση, νέφωση, θερμοκρασία, νερό, παλίρροια)
   - κάθε έξοδο: αρχή–τέλος, περιοχή, πόσα ψάρια (για να φαίνεται πότε ΔΕΝ τσιμπάνε)
   Ποτέ όνομα, σημειώσεις, φωτογραφίες ή ακριβές σημείο. Κλείνοντας τον διακόπτη σβήνονται όλα από τον server.
   Τα συγκεντρωτικά (bite_stats) τα φτιάχνει ο server κάθε βράδυ και τα δείχνει το B.biteStatsCard. */
(function(){ var B=window.AK, h=B.h, T=B.T, ls=B.ls;
var K='alkyon-contrib', SENT='alkyon-contrib-sent', ASKED='alkyon-contrib-asked';
function C(){ return B.cloud; }
function sess(){ try{ return C()&&C().session&&C().session(); }catch(e){ return null; } }
function on(){ return ls.get(K,null)===true; }
var CK=['wind','wdeg','gust','wave','wavePeriod','press','ptrend','cloud','temp','sst','tide']; /* 1.14.22: και ριπές, περίοδος κύματος, βαρόμετρο κινητού· ο server συμπληρώνει τα υπόλοιπα από το ιστορικό καιρού */
function r1(x){ return typeof x==='number'&&isFinite(x)?Math.round(x*10)/10:null; }
function msOf(date,time,tz){ if(!date) return null; var t=String(time||'12:00').slice(0,5), ms=Date.parse(date+'T'+t+':00Z'); if(!isFinite(ms)) return null; return ms-(typeof tz==='number'?tz:-new Date().getTimezoneOffset())*60000; }
function rowOf(kind,x){
  if(kind==='trip'){ if(!x.startMs||!x.endMs||x.endMs-x.startMs<20*60000) return null; var la=r1(x.lat), lo=r1(x.lon); if(la==null) return null;
    /* 1.14.78: όλοι οι στόχοι της εξόδου (έως 4) στο cond.tg· το sp μένει ο πρώτος, για συμβατότητα */
    var tgA=(Array.isArray(x.targets)?x.targets:[]).map(function(o){ return String((o&&(o.latin||o.name))||'').toLowerCase().slice(0,80); }).filter(Boolean).slice(0,4), cd=(x.rate===0||x.rate===1||x.rate===2)?{rt:x.rate}:null; if(tgA.length>1){ cd=cd||{}; cd.tg=tgA; }
    /* 1.14.86 (P1.2): τι είδους έξοδος είναι (cond.k), με τον ΕΝΑ κανόνα του AlkyonScore.session: 'l' καταγράφηκε ζωντανά · 'n' «Ψάρεψα, τίποτα» · 'm' με το χέρι ·
       'c' «από τα ψάρια της ημέρας» · 'x' άκυρη. Ο έλεγχος «πόσο έπεσε μέσα» στον server αφήνει έξω τις 'c' (έχουν πάντα ψάρια) και τις 'x'. */
    try{ var se=window.PF&&PF.session?PF.session(x):null; if(se&&se.k){ cd=cd||{}; cd.k=se.k; } }catch(e){}
    return {cond:cd,ref:'t:'+x.id,kind:'trip',sp:x.target?String(x.target.latin||x.target.name||'').toLowerCase().slice(0,80)||null:null,day:x.date||new Date(x.startMs).toISOString().slice(0,10),ms:x.startMs,ms2:x.endMs,lat:la,lon:lo,cnt:Math.min(999,(x.count|0)),tech:x.tech?String(x.tech).slice(0,40):null,prof:x.prof||null}; } /* 1.14.28: cond.rt = «Πώς ήταν το ψάρεμα;» */
  if(!x.date) return null; var la2=r1(x.lat), lo2=r1(x.lon); if(la2==null) return null;
  var c={}; CK.forEach(function(k){ var v=x[k]; if(typeof v==='number'&&isFinite(v)) c[k]=Math.round(v*10)/10; else if(typeof v==='string'&&v.length<=12) c[k]=v; });
  if(x.species) c.nm=String(x.species).trim().slice(0,40); /* 1.14.28: όνομα είδους για το «Τι πιάνεται τώρα» */
  if(typeof x.len==='number'&&x.len>0) c.len=Math.round(x.len); /* 1.14.25: μικρά/μεγάλα */
  /* 1.14.26: ποιο τεχνητό έπιασε (από τον Εξοπλισμό): χρώμα, μέγεθος, είδος, για το «Δούλεψε» */
  if(x.tk&&x.tk.length){ try{ var TK=B.store.raw('tackle'), lu=null; x.tk.some(function(id){ var it=TK.filter(function(y){ return y.id===id; })[0]; if(it&&it.type==='lure'){ lu=it; return true; } return false; });
    if(lu){ if(lu.color) c.lc=String(lu.color).trim().toLowerCase().slice(0,24); var lw=x.tkw&&x.tkw[lu.id]!=null?x.tkw[lu.id]:(lu.w&&lu.w.length===1?lu.w[0]:null); if(lw!=null) c.lw=lw; if(lu.kind) c.lk=String(lu.kind).slice(0,12); } }catch(e){} }
  if(x.bait) c.bait=String(x.bait).trim().slice(0,40); if(typeof x.depth==='number'&&isFinite(x.depth)) c.depth=Math.round(x.depth); /* 1.14.23: για το «τι δούλεψε» */
  if(x.pb&&typeof x.pb.hpa==='number'){ c.pb=x.pb.hpa; if(typeof x.pb.d3==='number') c.pbd3=Math.round(x.pb.d3*10)/10; }
  var sp=String(x.latin||x.species||'').trim().toLowerCase().slice(0,80)||null;
  if(!x.miss&&!sp) return null;
  return {ref:'b:'+x.id,kind:x.miss?'miss':'catch',sp:sp,day:x.date,ms:msOf(x.date,x.time,x.tz),ms2:null,lat:la2,lon:lo2,cnt:x.miss?0:Math.min(999,x.cnt>1?x.cnt:1),tech:x.tech?String(x.tech).slice(0,40):null,prof:x.prof||null,cond:Object.keys(c).length?c:null}; }
function sig(r){ return JSON.stringify(r); }
var busy=false;
function sync(){ if(busy||!on()) return Promise.resolve(); var s=sess(); if(!s) return Promise.resolve(); busy=true;
  var sent=ls.get(SENT,{})||{}, ups=[], dels=[], seen={};
  B.store.raw('bites').forEach(function(b){ if(!b||!b.id) return; var r=b.deleted?null:rowOf('b',b), k='b:'+b.id; if(r){ seen[k]=1; var g=sig(r); if(sent[k]!==g){ r._g=g; ups.push(r); } } });
  B.store.raw('trips').forEach(function(t){ if(!t||!t.id) return; var r=t.deleted?null:rowOf('trip',t), k='t:'+t.id; if(r){ seen[k]=1; var g=sig(r); if(sent[k]!==g){ r._g=g; ups.push(r); } } });
  Object.keys(sent).forEach(function(k){ if(!seen[k]) dels.push(k); });
  ups=ups.slice(0,300);
  var body=ups.map(function(r){ var o=Object.assign({},r); delete o._g; o.user_id=s.uid; o.updated_at=new Date().toISOString(); return o; });
  var p=body.length?C().rest('catch_obs?on_conflict=user_id,ref',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)}).then(function(r){ if(!r.ok) throw new Error('catch_obs '+r.status); ups.forEach(function(x){ sent[x.ref]=x._g; }); }):Promise.resolve();
  return p.then(function(){ if(!dels.length) return; var q=dels.slice(0,100).map(function(k){ return '"'+k.replace(/"/g,'')+'"'; }).join(',');
      return C().rest('catch_obs?ref=in.('+encodeURIComponent(q)+')',{method:'DELETE',headers:{Prefer:'return=minimal'}}).then(function(r){ if(r.ok) dels.slice(0,100).forEach(function(k){ delete sent[k]; }); }); })
    .then(function(){ ls.set(SENT,sent); }).catch(function(){}).then(function(){ busy=false; }); }
function wipe(){ var s=sess(); ls.set(SENT,{}); if(!s) return Promise.resolve(); return C().rest('catch_obs?user_id=eq.'+encodeURIComponent(s.uid),{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(function(){}); }
function set(v){ ls.set(K,!!v); ls.set(ASKED,1); if(v) sync(); else wipe(); }
function explain(){ return h('div',null,
  h('p',{text:T('Τα ψάρια σου (και οι έξοδοι χωρίς ψάρι) βοηθούν να μάθει η εφαρμογή πότε τσιμπάνε πραγματικά, ανά είδος και περιοχή. Όσο περισσότεροι συμμετέχουν, τόσο πιο σωστή γίνεται η πρόγνωση για όλους.','Your catches (and trips with no fish) help the app learn when fish really bite, by species and area. The more people take part, the better the forecast gets for everyone.')}),
  h('ul',{class:'sub',style:'margin:6px 0 0;padding-left:18px'},
    h('li',{text:T('Στέλνεται: είδος, ώρα, καιρός εκείνη την ώρα, τεχνική, πόσα ψάρια, και περιοχή στρογγυλεμένη στα ~10 km.','Sent: species, time, the weather at that time, technique, how many fish, and an area rounded to ~10 km.')}),
    h('li',{text:T('Ποτέ: όνομα, ακριβές σημείο, σημειώσεις, φωτογραφίες. Κανείς άλλος δεν βλέπει τα δικά σου.','Never: your name, exact spot, notes or photos. Nobody else sees yours.')}),
    h('li',{text:T('Το κλείνεις όποτε θέλεις από Προφίλ › Ρυθμίσεις· τότε σβήνονται όλα από τον server.','Turn it off any time in Profile › Settings; everything is then deleted from the server.')}))); }
/* 1.14.29: αν είπες «Όχι τώρα», ξαναρωτά ΜΙΑ φορά, όταν έχεις ≥ 5 ψάρια και έχει περάσει μήνας */
function again(){ var a=ls.get(ASKED,0); if(ls.get(K,null)!==false||ls.get(ASKED+'2',0)||!(a>1)||Date.now()-a<30*864e5) return false; var n=0; try{ n=B.store.raw('bites').filter(function(b){ return !b.deleted; }).length; }catch(e){} return n>=5; }
function ask(){ var re=again(); if(!re&&(ls.get(ASKED,0)||ls.get(K,null)!==null||!sess())) return; if(re&&!sess()) return; if(document.querySelector('.sheet.on,.sppage,.camov')||document.hidden){ setTimeout(ask,60000); return; } /* όχι πάνω σε άλλο φύλλο */ var n=0; try{ n=B.store.raw('bites').filter(function(b){ return !b.deleted; }).length; }catch(e){} if(n<1) return;
  if(re) ls.set(ASKED+'2',Date.now()); else ls.set(ASKED,Date.now());
  var imp=h('p',{class:'sub'}); try{ stats().then(function(S){ var a=S&&S.all; if(a&&a.n) imp.textContent=T('Τώρα ο δείκτης μαθαίνει από ','Right now the score learns from ')+a.n+T(' ψάρια',' catches')+(a.users>=3?T(' από ',' from ')+a.users+T(' ψαράδες',' anglers'):'')+T('· κάθε ψάρι σου μετρά.','; every catch of yours counts.'); }).catch(function(){}); }catch(e){}
  var sh=B.sheet({title:'🎣 '+T('Βοήθησε να γίνει πιο σωστή η πρόγνωση','Help make the forecast better'),body:h('div',{class:'bform'},explain(),imp,
    h('button',{class:'btn pri full',type:'button',text:T('Ναι, συμμετέχω','Yes, count me in'),onclick:function(){ set(true); sh.close(); B.toast(T('Ευχαριστούμε! 🐟','Thank you! 🐟')); }}),
    h('button',{class:'btn full',type:'button',text:T('Όχι τώρα','Not now'),onclick:function(){ set(false); sh.close(); }}))}); }
function sheet(){ var cb=h('input',{type:'checkbox',checked:on()}); cb.addEventListener('change',function(){ set(cb.checked); B.toast(cb.checked?T('Συμμετέχεις · ευχαριστούμε','You are taking part · thank you'):T('Σβήστηκαν τα στοιχεία σου από τον server','Your data was deleted from the server')); });
  B.sheet({title:T('Βοήθησε την πρόγνωση','Help the forecast'),body:h('div',{class:'bform'},explain(),h('label',{class:'tg',style:'padding:10px 4px'},cb,h('span',null,h('b',{text:T('Ανώνυμη συμμετοχή','Anonymous participation')}))))}); }
B.contrib={on:on,set:set,sync:sync,ask:ask,sheet:sheet,_rowOf:rowOf};
/* 1.14.60: ο σύνδεσμος της πρόσκλησης (?join=1) ανοίγει κατευθείαν το «Βοήθησε την πρόγνωση», μόλις τελειώσει η πρώτη ρύθμιση και δεν υπάρχει άλλο φύλλο ανοιχτό */
(function(){ var JK='alkyon-v4-joinlink'; try{ if(/[?&]join=1(&|$)/.test(location.search)){ ls.set(JK,Date.now()); history.replaceState(history.state,'',location.pathname+location.search.replace(/([?&])join=1(&|$)/,function(m,a,b){ return b?a:''; })+location.hash); } }catch(e){}
  var at=ls.get(JK,0); if(!at||Date.now()-at>864e5){ if(at) ls.set(JK,0); return; }
  var tries=0, iv=setInterval(function(){ if(++tries>400){ clearInterval(iv); return; }
    if(document.hidden||document.querySelector('.sheet.on,.sppage,.spk,.camov,.onb,.mcdrw.open')) return;
    clearInterval(iv); ls.set(JK,0); if(on()){ B.toast(T('Συμμετέχεις ήδη στο «Βοήθησε την πρόγνωση» · ευχαριστούμε','You already take part in “Help the forecast” · thank you')); return; }
    sheet(); if(!sess()) setTimeout(function(){ B.toast(T('Για να μετρήσουν τα ψάρια σου χρειάζεται δωρεάν λογαριασμός (Προφίλ).','A free account (Profile) is needed for your catches to count.')); },900); },1500); })();

/* ---------- «Πότε τσιμπάνε · από όλους» (bite_stats) ---------- */
var ST=null, stAt=0;
function stats(){ if(ST&&Date.now()-stAt<6*3600e3) return Promise.resolve(ST); return stats0().then(function(S){ setLearn(S); keepWorks(S); return S; }); }
/* 1.14.30: «Δοκίμασε»: ό,τι δουλεύει τώρα στην περιοχή σου (κρατιέται τοπικά για τη σύνοψη της πρόγνωσης) */
function keepWorks(S){ try{ var p=B.lastPos&&B.lastPos(); if(!p) return; var tr=S['trend:'+Math.floor(p.lat)+'_'+Math.floor(p.lon)], w=tr&&tr.data&&tr.data.works; ls.set('alkyon-works',w?{day:tr.data.day,w:w}:null); }catch(e){} }
function tryNow(){ try{ var o=ls.get('alkyon-works',null); if(o&&o.w&&o.day&&Date.now()-Date.parse(o.day)<=3*864e5){ var w=o.w, a=[].concat((w.lure||[]).map(function(x){ return x.v; }),(w.tech||[]).map(function(x){ return x.v; }),(w.bait||[]).map(function(x){ return x.v; })); if(a.length) return a.slice(0,2).join(', '); } }catch(e){}
  try{ var L=window.AlkyonLearn, ins=[]; if(L&&L.by) Object.keys(L.by).forEach(function(k){ ins=ins.concat((L.by[k]&&L.by[k].ins)||[]); }); else if(L&&L.ins) ins=L.ins; var x=ins.filter(function(i){ return i.w&&i.lift>1; }).sort(function(a,b){ return b.lift-a.lift; })[0]; if(x){ var b=[].concat(x.w.lure||[],x.w.tech||[],x.w.bait||[]); if(b.length) return b.slice(0,2).join(', '); } }catch(e){}
  return ''; }
function stats0(){
  var q='bite_stats?select=key,n,users,data,updated_at', p=sess()?C().rest(q):(C()&&C().pub?C().pub(q):Promise.reject());
  return p.then(function(r){ return r.ok?r.json():[]; }).then(function(a){ ST={}; a.forEach(function(x){ ST[x.key]=x; }); stAt=Date.now(); return ST; }).catch(function(){ return ST||{}; }); }
var MIN=20;
function bars(title,lab,vals,fmt){ var mx=Math.max.apply(null,vals.map(function(v){ return v||0; }))||1;
  return h('div',{class:'bsg'},h('b',{class:'bsgt',text:title}),h('div',{class:'bsrow'},vals.map(function(v,i){ return h('div',{class:'bsc'},h('i',{style:'height:'+Math.max(3,Math.round((v||0)/mx*56))+'px'+((v||0)===mx&&v?';background:var(--accent)':'')}),h('small',{text:lab[i]})); }))); }
var FL={
  sun:[T('Ώρα της μέρας','Time of day'),[T('νύχτα','night'),T('αυγή','dawn'),T('πρωί','morning'),T('μεσημ.','midday'),T('απόγ.','p.m.'),T('σούρουπο','dusk')]],
  pt:[T('Πίεση (3 ώρες)','Pressure (3 h)'),[T('πέφτει','falling'),T('σταθερή','steady'),T('ανεβαίνει','rising')]],
  sol:[T('Σεληνιακές περίοδοι','Solunar periods'),[T('κύρια','major'),T('δευτερεύουσα','minor'),T('εκτός','none')]],
  wind:[T('Άνεμος (kn)','Wind (kn)'),['0–4','5–9','10–14','15+']],
  moon:[T('Φάση σελήνης','Moon phase'),['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘']],
  tide:[T('Στάθμη θάλασσας','Sea level'),[T('ανεβαίνει','rising'),T('κατεβαίνει','falling'),T('στάσιμη','slack')]],
  wave:[T('Κύμα (m)','Waves (m)'),['<0,3','0,3–0,6','0,6–1','>1']],
  pl:[T('Πίεση (hPa)','Pressure (hPa)'),['<1010','1010–15','1015–20','>1020']],
  cloud:[T('Νέφωση','Cloud'),[T('καθαρός','clear'),T('λίγα','some'),T('συννεφιά','overcast')]],
  rain:[T('Βροχή','Rain'),[T('όχι','no'),T('ναι','yes')]],
  cur:[T('Ρεύμα (km/h)','Current (km/h)'),['<0,4','0,4–1','>1']],
  sstd:[T('Νερό (3 μέρες)','Water (3 days)'),[T('κρυώνει','cooling'),T('σταθερό','steady'),T('ζεσταίνει','warming')]],
  wv48:[T('Θάλασσα 2 προηγ. μέρες (θολούρα)','Sea, previous 2 days (murk)'),[T('ήρεμη','calm'),T('μέτρια','moderate'),T('φουρτούνα','rough')]],
  dark:[T('Σκοτάδι (σελήνη × σύννεφα)','Darkness (moon × cloud)'),[T('μέρα','day'),T('πολύ σκοτεινά','very dark'),T('μισοσκόταδο','dim'),T('φεγγαρόφωτο','moonlit')]],
  aft:[T('Ώρες μετά τη δύση','Hours after sunset'),[T('μέρα','day'),'0–1 h','1–3 h','3–6 h',T('αργά','late'),T('πριν την αυγή','pre-dawn')]],
  season:[T('Εποχή','Season'),[T('χειμώνας','winter'),T('άνοιξη','spring'),T('καλοκαίρι','summer'),T('φθινόπωρο','autumn')]],
  sstb:[T('Θερμοκρασία νερού','Water temperature'),['<16°','16–19°','19–22°','22–25°','>25°']],
  thc:[T('Θερμοκλινές (βάθος που αρχίζει)','Thermocline (depth where it starts)'),[T('ανακατεμένο νερό','mixed water'),'<20 m','20–50 m','>50 m']],
  chl:[T('Χλωροφύλλη νερού (δορυφόρος)','Water chlorophyll (satellite)'),['<0,04','0,04–0,07','0,07–0,12','>0,12 mg/m³']]};
var MAIN=['sun','pt','sol','wind'];
function mainF(g){ return g==='ceph'?['dark','aft','moon','wv48']:g==='spear'?['sun','wv48','wave','cur']:g==='lake'?['sun','pt','wind','cloud']:MAIN; }
/* 1.14.24: είδος ψαρέματος → ομάδα στατιστικών: θάλασσα με καλάμι (σκάφος/ακτή), ψαροντούφεκο, λίμνη/φράγμα */
function grp(){ var p=B.prof?B.prof():'boat'; return p==='spear'?'spear':p==='lake'?'lake':'sea'; }
function gkey(g,rest){ return g==='sea'?(rest||'all'):'g:'+g+(rest?'|'+rest:''); }
var GLAB={ceph:T('Κεφαλόποδα (καλαμάρι, θράψαλο, σουπιά…)','Cephalopods (squid, flying squid, cuttlefish…)'),sea:T('Θάλασσα με καλάμι','Sea, rod'),spear:T('Ψαροντούφεκο','Spearfishing'),lake:T('Λίμνη / φράγμα','Lake / reservoir')};
B.learnLabel=function(f,b){ var L=FL[f]; return L?L[0].replace(/ \(.*\)$/,'')+': '+L[1][b]:''; };
/* 1.14.23: τα ευρήματα πάνε στον δείκτη (forecast.js learnAdj) μέσω window.AlkyonLearn· κρατιούνται και τοπικά για να ισχύουν από την αρχή */
try{ var LR=ls.get('alkyon-learn',null); if(LR&&LR.ins) window.AlkyonLearn=LR; }catch(e){}
function setLearn(S){ try{ var by={}, any=false, spm={}; Object.keys(S).forEach(function(k){ var m=/(^|\|)sp:(.+)$/.exec(k), st=S[k]; if(m&&st&&st.n>=10&&st.data&&!st.data.learnOff&&st.data.ins&&st.data.ins.length){ spm[m[2]]={ins:st.data.ins,n:st.n}; any=true; } });
  ['sea','spear','lake','ceph'].forEach(function(g){ var rk=cellKey(), rkg=rk?gkey(g,rk):null, st=(rkg&&S[rkg]&&S[rkg].n>=MIN)?S[rkg]:S[gkey(g)]; if(st&&st.n>=MIN&&st.data&&!st.data.learnOff&&st.data.ins&&st.data.ins.length){ by[g]={ins:st.data.ins,n:st.n}; any=true; } });
  var L=any?{by:by,sp:spm,t:Date.now()}:null; window.AlkyonLearn=L; ls.set('alkyon-learn',L); }catch(e){} } /* 1.14.24: ανά είδος ψαρέματος· το forecast.js διαλέγει με το προφίλ */
function spLabel(sp){ var kb=(window.SPKB||[]).filter(function(k){ return String(k.l||'').toLowerCase()===sp; })[0]; return kb?(B.EN?(kb.en||kb.n):kb.n):sp.charAt(0).toUpperCase()+sp.slice(1); }
function fx(v,d){ return B.num?B.num(v,d):String(v); }
var MY=null, myAt=0;
function mine(){ if(MY&&Date.now()-myAt<6*3600e3) return Promise.resolve(MY); var se=sess(); if(!se) return Promise.resolve(null);
  return C().rest('user_bite_stats?select=n,data,updated_at&user_id=eq.'+encodeURIComponent(se.uid)).then(function(r){ return r.ok?r.json():[]; }).then(function(a){ MY=a[0]||null; myAt=Date.now(); return MY; }).catch(function(){ return null; }); }
function cellKey(){ var p=B.lastPos&&B.lastPos(); if(!p) return null; return 'r:'+(Math.floor(p.lat/2)*2)+'_'+(Math.floor(p.lon/2)*2); }
function insList(ins){ var ul=h('ul',{class:'bsins'}); (ins||[]).forEach(function(x){ var L=FL[x.f]; if(!L) return; var up=x.lift>=1;
    var src=x.src==='fit'?(x.n+T(' ώρες εξόδων (μοντέλο από τα στοιχεία)',' trip hours (model fitted from the data)')):x.src==='blend'?(Math.round(x.n)+T(' τσιμπήματα του είδους + ευρήματα της ομάδας του',' bites of the species + findings of its group')):x.src==='both'?T('ψάρια και ώρες εξόδων','catches and trip hours'):x.src==='trip'?(x.h?x.h+T(' ώρες εξόδων',' trip hours'):T('ώρες εξόδων','trip hours')):Math.round(x.n)+T(' τσιμπήματα, σε σύγκριση με τις ώρες της ίδιας μέρας',' bites vs the hours of the same day');
    var li=h('li',{class:(up?'up':'down')+(x.src==='both'?' strong':'')},h('b',{text:(up?'▲ ':'▼ ')+L[0]+': '+L[1][x.b]}),h('span',{text:' · ×'+fx(x.lift,1)+(up?T(' πιο συχνά ψάρια',' more fish'):T(' (λιγότερα)',' (fewer)'))}),h('small',{class:'bssrc',text:(x.src==='both'?'✓✓ ':'')+T('από ','from ')+src}));
    if(x.w){ var wk=[].concat(x.w.lure||[],(x.w.tech||[]).filter(function(t){ return !/^(δίχτυ|παραγάδι|κλουβί|net|longline|pot)$/i.test(String(t).trim()); }),x.w.bait||[],x.w.dep||[]);   /* 1.14.44: δίχτυ και παραγάδι δεν είναι τεχνική καλαμιού */ if(wk.length) li.append(h('small',{class:'bswk',text:T('Δούλεψε: ','Worked: ')+wk.join(' · ')})); }
    ul.append(li); }); return ul; }
function card(sp0){ var box=h('section',{class:'card bscard'},h('h3',{text:T('Πότε τσιμπάνε','When they bite')})), who=h('div',{class:'seg bswho'}), chips=h('div',{class:'chips bschips'}), body=h('div',null,h('p',{class:'sub',text:T('Φόρτωση…','Loading…')}));
  box.append(who,chips,body);
  var cur=sp0||'all', mode='all';
  Promise.all([stats(),mine()]).then(function(r){ var S=r[0]||{}, M=r[1];
    function seg(){ who.replaceChildren(); [['all',T('Όλοι','Everyone')],['crew',T('Παρέα','Crew')],['me',T('Για σένα','For you')]].forEach(function(x){ who.append(h('button',{type:'button','aria-pressed':String(mode===x[0]),text:x[1],onclick:function(){ mode=x[0]; seg(); draw(); }})); }); }
    function draw(){ body.replaceChildren(); chips.replaceChildren();
      if(mode==='crew'){ var cr=M&&M.data&&M.data.crew; if(!cr){ body.append(h('p',{class:'sub',text:T('«Η παρέα μου»: εσύ και οι φίλοι που μοιράζονται τα ψάρια τους μαζί σου (και συμμετέχουν). Θα φανεί όταν υπάρχουν τουλάχιστον 20 ψάρια από 2+ άτομα.','«My crew»: you and the friends who share their catches with you (and take part). Shows once there are at least 20 catches from 2+ people.')})); return; }
        render(cr.data,cr.n,cr.users,false); return; }
      if(mode==='me'){ if(!M||!M.data){ body.append(h('p',{class:'sub',text:on()?T('Θα φανεί όταν έχεις τουλάχιστον 10 ψάρια με θέση (ενημερώνεται κάθε βράδυ).','Shows once you have at least 10 catches with a position (updated every night).'):T('Τα προσωπικά ευρήματα βγαίνουν από τα στοιχεία που στέλνεις ανώνυμα.','Personal findings come from the data you share anonymously.')}));
          if(!on()) body.append(h('button',{class:'linkbtn',type:'button',text:T('Ενεργοποίηση ›','Turn on ›'),onclick:sheet})); return; }
        var g2=grp(), md=(M.data.by&&M.data.by[g2])?M.data.by[g2]:(!M.data.by||M.data.grp===g2||(!M.data.grp&&g2==='sea')?{n:M.n,data:M.data}:null);
        if(!md){ body.append(h('p',{class:'sub',text:T('Δεν έχεις ακόμα 10 ψάρια σε «','You do not have 10 catches yet in «')+GLAB[g2]+T('».','».')})); return; }
        render(md.data,md.n,0,true); return; }
      var g=grp(), base=gkey(g), spp=gkey(g,'sp:'), rk0=cellKey(), rk=rk0?gkey(g,rk0):null, useR=rk&&S[rk]&&S[rk].n>=MIN&&cur==='all';
      var sps=Object.keys(S).filter(function(k){ return k.indexOf(spp)===0&&S[k].n>=MIN; }).sort(function(a,b){ return S[b].n-S[a].n; }).slice(0,8);
      var szs=[['big',T('Μεγάλα','Big fish')],['small',T('Μικρά (γόπα, μαρίδα…)','Small (bogue, picarel…)')]].filter(function(x){ var k=gkey(g,x[0]); return S[k]&&S[k].n>=MIN; }).map(function(x){ return [gkey(g,x[0]),x[1]]; });
      /* 1.14.26: κεφαλόποδα: χωριστή ομάδα, με τα δικά τους είδη */ if(g!=='lake'&&S['g:ceph']&&S['g:ceph'].n>=MIN){ szs.push(['g:ceph','🦑 '+T('Κεφαλόποδα','Cephalopods')]); Object.keys(S).filter(function(k){ return k.indexOf('g:ceph|sp:')===0&&S[k].n>=MIN; }).forEach(function(k){ sps.push(k); }); }
      if(sps.length||szs.length){ [['all',T('Όλα','All')]].concat(szs,sps.map(function(k){ return [k,spLabel(k.indexOf('g:ceph|sp:')===0?k.slice(10):k.slice(spp.length))]; })).forEach(function(x){ chips.append(h('button',{type:'button',class:'chip sm'+(x[0]===cur?' on':''),text:x[1],onclick:function(){ cur=x[0]; draw(); }})); }); }
      var st=useR?S[rk]:(cur!=='all'&&S[cur])||S[base];
      if(!st||st.n<MIN){ body.append(h('p',{class:'sub',text:T('Μαζεύονται ακόμα στοιχεία','Still collecting data')+(st&&st.n?' · '+st.n+T(' ψάρια μέχρι τώρα',' fish so far'):'')+T('. Θα φανεί όταν υπάρχουν τουλάχιστον ','. It will show once there are at least ')+MIN+T(' ψάρια.',' fish.')}));
        if(!on()) body.append(h('button',{class:'linkbtn',type:'button',text:T('Βοήθησε με τα δικά σου ψάρια ›','Help with your own catches ›'),onclick:sheet})); return; }
      render(st.data||{},st.n,st.users,false,useR); }
    function trendBox(){ var p=B.lastPos&&B.lastPos(); if(!p) return null; var tk='trend:'+Math.floor(p.lat)+'_'+Math.floor(p.lon), tr=S[tk]; if(!tr||!tr.data||(tr.data.day&&Date.now()-Date.parse(tr.data.day)>3*864e5)) return null; var wk=tr.data.works; if(!(tr.data.items&&tr.data.items.length)&&!wk) return null;
      var ul=h('ul',{class:'bstr'}); (tr.data.items||[]).slice(0,5).forEach(function(x){ ul.append(h('li',{class:x.up?'up':''},h('b',{text:(x.g==='ceph'?'🦑 ':'🐟 ')+spLabel(x.sp||x.nm||'')}),h('span',{text:' · '+x.n7+T(' τσιμπήματα την εβδομάδα',' bites this week')+(x.fresh?T(' · νέο',' · new'):x.up?' · ▲ ×'+fx(x.ratio,1):'')}))); });
      /* 1.14.29: «Τι δουλεύει τώρα»: τεχνική, δόλωμα, τεχνητό της εβδομάδας (μόνο ό,τι έγραψαν 2+ ψαράδες) */
      var wl=null; if(wk){ var row=function(lab,a){ return a&&a.length?h('li',null,h('b',{text:lab+': '}),h('span',{text:a.map(function(x){ return x.v; }).join(' · ')})):null; };
        wl=h('ul',{class:'bstr bswork'},row(T('Τεχνική','Technique'),wk.tech),row(T('Δόλωμα','Bait'),wk.bait),row(T('Τεχνητό','Lure'),wk.lure)); }
      return h('div',{class:'bstrend'},(tr.data.items&&tr.data.items.length)?h('b',{class:'bsgt',text:T('Τι πιάνεται τώρα κοντά σου','What is biting near you now')}):null,(tr.data.items&&tr.data.items.length)?ul:null,wl?h('b',{class:'bsgt',text:T('Τι δουλεύει τώρα','What is working now')}):null,wl,h('small',{class:'sub',text:T('Τελευταίες 7 μέρες, από ','Last 7 days, from ')+tr.users+T('+ ψαράδες','+ anglers')})); }
    function render(d,n,users,me,reg){ if(!me){ var tb=trendBox(); if(tb) body.append(tb); }
      body.append(h('p',{class:'sub',text:n+T(' ψάρια',' fish')+(users>=3?T(' από ',' from ')+users+T(' ψαράδες',' anglers'):'')+(d.hrs?' · '+d.hrs+T(' ώρες εξόδων',' trip hours'):'')+' · '+GLAB[d.grp||grp()]+(d.size==='small'?T(' · μικρά',' · small fish'):d.size==='big'?T(' · μεγάλα',' · big fish'):'')+(reg?T(' · στην περιοχή σου',' · in your area'):'')+(d.tgt?T(' · έξοδοι με αυτόν τον στόχο',' · trips targeting it'):'')}));
      if(d.ins&&d.ins.length) body.append(insList(d.ins)); else body.append(h('p',{class:'sub',text:T('Κανένα δυνατό εύρημα ακόμα.','No strong findings yet.')}));
      if(d.fitted) body.append(h('p',{class:'bsbt',text:'⚖ '+T('Ο δείκτης ξαναζυγίστηκε από τα στοιχεία (','The score was re-weighted from the data (')+(d.trips||0)+T(' έξοδοι).',' trips).')}));
      else if(d.fitMin&&!me) body.append(h('small',{class:'sub bsfit',text:'⚖ '+T('Ο δείκτης θα ξαναζυγιστεί ολόκληρος από τα στοιχεία όταν υπάρξουν ','The whole score will be re-weighted from the data once there are ')+d.fitMin+T(' έξοδοι (τώρα ',' trips (now ')+(d.trips||0)+').'}));
      var ac=accBox(d.acc,me); if(ac) body.append(ac);
      var gd0=(S[gkey(d.grp||grp())]||{}).data; if(gd0&&gd0.mon===d.mon) gd0=(S.all||{}).data; var se=seasonBox(d.mon,gd0,cur); if(se&&!me) body.append(se);
      /* 1.14.86 (P1.2): οι αριθμοί του ελέγχου βγαίνουν από τις ΕΓΚΥΡΕΣ εξόδους (d.btv, κανόνας AlkyonScore.session)· αν δεν φτάνουν, το λέει αντί να δείξει αριθμό.
         Το αν η μάθηση είναι ενεργή (d.bt.on) κρίνεται ακόμα όπως πριν, ώστε να μην αλλάξει κανένας βαθμός. Χωρίς d.ses (παλιά στοιχεία server) όλα όπως ήταν. */
      if(d.bt){ var bv=d.ses?d.btv:d.bt, okN=d.ses?((d.ses.live||0)+(d.ses.nofish||0)+(d.ses.manual||0)):0;
        if(!d.bt.on) body.append(h('p',{class:'bsbt off',text:T('Η μάθηση δεν βελτίωσε ακόμα τον δείκτη (έλεγχος σε ','Learning has not improved the score yet (checked on ')+d.bt.n+T(' εξόδους), γι\'αυτό δεν εφαρμόζεται.',' trips), so it is not applied.')}));
        else if(bv) body.append(h('p',{class:'bsbt',text:'✓ '+T('Έλεγχος σε ','Checked on ')+bv.n+T(' εξόδους: ο δείκτης με τη μάθηση ξεχώρισε σωστά τις εξόδους με ψάρια στο ',' trips: with learning the score picked the trips with fish correctly ')+Math.round(bv.adj*100)+'%'+T(' (χωρίς μάθηση: ',' of the time (without: ')+Math.round(bv.base*100)+'%).'}));
        else body.append(h('small',{class:'sub bsfit',text:T('Ο έλεγχος της μάθησης χρειάζεται τουλάχιστον 8 εξόδους που καταγράφηκαν ανεξάρτητα από το αν είχαν ψάρια (τώρα ','The check of the learning needs at least 8 trips recorded regardless of whether they had fish (now ')+okN+').'})); }
      if(d.f){ mainF(d.grp||grp()).forEach(function(k){ var g=factor(k,d.f[k]); if(g) body.append(g); });
        var MF=mainF(d.grp||grp()), rest=Object.keys(FL).filter(function(k){ return MF.indexOf(k)<0&&d.f[k]; }); if(rest.length){ var det=h('details',{class:'bsmore'},h('summary',{text:T('Όλες οι συνθήκες','All conditions')})); rest.forEach(function(k){ var g=factor(k,d.f[k]); if(g) det.append(g); }); body.append(det); } }
      body.append(h('small',{class:'sub',text:me?T('Μόνο από τα δικά σου ψάρια. Τα βλέπεις μόνο εσύ.','Only from your own catches. Only you can see them.'):T('Ανώνυμα, από όσους συμμετέχουν. Καιρός κάθε ώρας από το ιστορικό του Open-Meteo· κάθε ψάρι συγκρίνεται με τις ώρες της ίδιας μέρας, και οι έξοδοι μετρούν και τις ώρες χωρίς ψάρι. ✓✓ = συμφωνούν και οι δύο μέθοδοι.','Anonymous, from those who take part. Hourly weather from Open-Meteo history; each catch is compared with the hours of the same day, and trips also count hours with no fish. ✓✓ = both methods agree.')})); }
    seg(); draw();
    /* 1.14.29: περισσότεροι ψαράδες = πιο σωστά στατιστικά */
    box.append(h('div',{class:'bsinv'},h('small',{class:'sub',text:T('Όσο περισσότεροι συμμετέχουν, τόσο πιο σωστή γίνεται η πρόγνωση για όλους.','The more people take part, the better the forecast gets for everyone.')}),
      h('button',{class:'btn sm',type:'button',text:'👥 '+T('Κάλεσε φίλους','Invite friends'),onclick:invite}),on()?null:h('button',{class:'btn sm pri',type:'button',text:T('Συμμετέχω','Take part'),onclick:sheet}))); });
  return box; }
function invite(){ var url='https://alkyonfishing.com/?join=1', tx=T('Ψαρεύω με το Alkyon: πρόγνωση για ψάρεμα, ημερολόγιο και πότε τσιμπάνε στην περιοχή μας. Έλα κι εσύ, όσο περισσότεροι τόσο πιο σωστή η πρόγνωση: ','I fish with Alkyon: fishing forecast, logbook and when fish bite in our area. Join in, the more of us the better the forecast: ');
  if(navigator.share) navigator.share({title:'Alkyon',text:tx,url:url}).catch(function(){}); else { try{ navigator.clipboard.writeText(tx+url); B.toast(T('Αντιγράφηκε ο σύνδεσμος','Link copied')); }catch(e){ location.hash='#friends'; } } }
/* 1.14.29: «Πόσο έπεσε μέσα η πρόγνωση»: ψάρια ανά ώρα ανά ζώνη βαθμού τσιμπήματος (με τον καιρό που έγινε) */
function accBox(a,me){ if(!a||!a.n||a.trips<5) return null; var lab=['<'+a.b[0],a.b[0]+'–'+(a.b[1]-1),a.b[1]+'–'+(a.b[2]-1),a.b[2]+'+'], ul=h('ul',{class:'bstr bsacc'}), ok=[];
  a.n.forEach(function(n,i){ if(!n) return; ok.push(i); ul.append(h('li',null,h('b',{text:T('Δείκτης ','Score ')+lab[i]+': '}),h('span',{text:(a.r[i]!=null?fx(a.r[i],2)+T(' ψάρια/ώρα',' fish/hour')+' · ':'')+a.hit[i]+'%'+T(' έξοδοι με ψάρι',' trips with fish')+' ('+n+')'}))); });
  if(!ok.length) return null; var lo=ok[0], hi=ok[ok.length-1], ratio=(ok.length>1&&a.r[lo]>0&&a.r[hi]!=null)?a.r[hi]/a.r[lo]:null;
  return h('div',{class:'bstrend bsaccb'},h('b',{class:'bsgt',text:T('Πόσο έπεσε μέσα η πρόγνωση','How right the forecast was')}),ul,h('small',{class:'sub',text:(ratio?(ratio>=1.2?T('Στις ώρες με ψηλό δείκτη πιάστηκαν ×','In high-score hours there were ×')+fx(ratio,1)+T(' περισσότερα ψάρια. ',' more fish. '):T('Ακόμα δεν φαίνεται διαφορά ανάμεσα σε ψηλό και χαμηλό δείκτη. ','No difference yet between high and low scores. ')):'')+(me?T('Από τις δικές σου εξόδους ','From your own trips ')+a.trips+'.':a.trips+T(' έξοδοι, με τον καιρό που έγινε.',' trips, with the weather that happened.'))})); }
/* 1.14.29: ημερολόγιο εποχής από τα στοιχεία: πόσο συχνό είναι το είδος κάθε μήνα (σε σχέση με όλα τα ψάρια του μήνα) */
var MON=B.EN?['J','F','M','A','M','J','J','A','S','O','N','D']:['Ι','Φ','Μ','Α','Μ','Ι','Ι','Α','Σ','Ο','Ν','Δ'];
function seasonBox(m,gd,cur){ if(!m||cur==='all') return null; var all=gd&&gd.mon, tot=m.reduce(function(a,b){ return a+b; },0); if(tot<5) return null;
  var share=m.map(function(v,i){ return all&&all[i]>0?v/all[i]:v/tot; }), mx=Math.max.apply(null,share)||1, now=new Date().getMonth(), months=m.filter(function(v){ return v>0; }).length;
  var row=h('div',{class:'bsmon'}); share.forEach(function(v,i){ row.append(h('div',{class:'bsm'+(i===now?' now':''),title:Math.round(m[i])+''},h('i',{style:'height:'+Math.max(2,Math.round(v/mx*36))+'px'+(m[i]?'':';opacity:.25')}),h('span',{text:MON[i]}))); });
  return h('div',{class:'bstrend'},h('b',{class:'bsgt',text:T('Εποχή από τα στοιχεία','Season from the data')}),row,h('small',{class:'sub',text:(months<4?T('Λίγοι μήνες με στοιχεία ακόμα· ','Only a few months of data so far; '):'')+T('ύψος = πόσο συχνό είναι το είδος εκείνο τον μήνα σε σχέση με όλα τα ψάρια.','height = how common the species is that month compared with all catches.')})); }
function factor(k,o){ var L=FL[k]; if(!L||!o) return null; var useR=!!(o.r&&o.r.filter(function(x){ return x!=null; }).length>=2), useC=!useR&&!!(o.cc&&o.cc.filter(function(x){ return x!=null; }).length>=2);
  var vals=useR?o.r.map(function(x){ return x||0; }):useC?o.cc.map(function(x){ return x||0; }):o.c;
  return bars(L[0]+(useR?T(' · ψάρια ανά ώρα',' · fish per hour'):useC?T(' · ×συχνότητα ψαριών',' · ×fish rate'):T(' · ψάρια',' · fish')),L[1],vals); }
B.biteStatsCard=card;

/* 1.14.25: «Ψάρεψες σήμερα; Τίποτα;»: αν ήσουν κοντά σε σημείο σου (≤ 1 km) και δεν έγραψες ψάρι ή έξοδο εκείνη τη μέρα,
   το βράδυ (μετά τις 18:00) ή το επόμενο πρωί ρωτά μία φορά. */
var NK='alkyon-nearspot';
function dstr(t){ var d=new Date(t); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function nearSpot(){ var p=B.lastPos&&B.lastPos(); if(!p) return; /* 1.14.26: και για νυχτερινό ψάρεμα (καλαμάρι) */
  var pts=(ls.get('alkyon-places',[])||[]).map(function(x){ return [+x.lat,+x.lon]; }); try{ B.store.raw('bites').slice(-300).forEach(function(b){ if(!b.deleted&&isFinite(+b.lat)&&b.lat) pts.push([+b.lat,+b.lon]); }); }catch(e){}
  var R=Math.PI/180, near=pts.some(function(q){ if(!isFinite(q[0])) return false; var dx=(q[1]-p.lon)*Math.cos(p.lat*R)*111.32, dy=(q[0]-p.lat)*110.57; return dx*dx+dy*dy<1; });
  if(!near) return; var n=ls.get(NK,null)||{}, td=dstr(Date.now()); if(n.d!==td) n={d:td,t0:Date.now(),lat:p.lat,lon:p.lon}; n.t1=Date.now(); ls.set(NK,n); }
function askNothing(){ var n=ls.get(NK,null); if(!n||n.asked||!n.d) return; var td=dstr(Date.now()), hr=new Date().getHours(); if(!(n.d<td||hr>=18)) return;
  if(document.querySelector('.sheet.on,.sppage,.camov')||document.hidden) return;
  var any=false; try{ any=B.store.raw('bites').some(function(b){ return !b.deleted&&b.date===n.d; })||B.store.raw('trips').some(function(t){ return !t.deleted&&t.date===n.d; }); }catch(e){}
  n.asked=1; ls.set(NK,n); if(any||(B.trip&&B.trip.active&&B.trip.active())) return;
  var sh=B.sheet({title:T('Ψάρεψες ','Did you fish ')+(n.d===td?T('σήμερα;','today?'):T('χθες;','yesterday?')),body:h('div',{class:'bform'},
    h('p',{class:'sub',text:T('Ήσουν κοντά σε σημείο σου. Αν ψάρεψες χωρίς να πιάσεις, γράψ\'το με ένα πάτημα: οι ώρες χωρίς τσίμπημα βοηθούν πολύ τα στατιστικά.','You were near one of your spots. If you fished and caught nothing, log it in one tap: hours with no bites help the stats a lot.')}),
    h('button',{class:'btn pri full',type:'button',text:T('Ψάρεψα, τίποτα','Fished, caught nothing'),onclick:function(){ sh.close(); setTimeout(function(){ B.nothingTrip&&B.nothingTrip({date:n.d,t0:n.t0,t1:Math.max(n.t1,n.t0+3600e3),lat:n.lat,lon:n.lon}); },200); }}),
    h('button',{class:'btn full',type:'button',text:T('Έπιασα, θα το γράψω','I caught, I will log it'),onclick:function(){ sh.close(); setTimeout(function(){ B.biteForm&&B.biteForm(); },200); }}),
    h('button',{class:'btn full',type:'button',text:T('Δεν ψάρεψα','I did not fish'),onclick:function(){ sh.close(); }}))}); }
B.contrib.tryNow=tryNow; B.contrib.nearSpot=nearSpot; B.contrib.askNothing=askNothing;
setTimeout(function(){ if(on()) sync(); else ask(); stats(); nearSpot(); askNothing(); },8000);
/* 1.14.29: ρωτά και αμέσως μετά από καταχώρηση ψαριού (όχι μόνο στην εκκίνηση) */
try{ B.on('store',function(e){ var k=e&&e.detail!=null?e.detail:e; if(k==='alkyon-bites'&&!on()) setTimeout(ask,2500); }); }catch(e){}
setInterval(nearSpot,10*60000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden){ nearSpot(); setTimeout(askNothing,3000); } });
B.on&&B.on('store',function(k){ if(k==='alkyon-fprof') return; clearTimeout(sync._t); sync._t=setTimeout(sync,4000); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden&&on()) sync(); });
})();
