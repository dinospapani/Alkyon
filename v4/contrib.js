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
    return {ref:'t:'+x.id,kind:'trip',sp:x.target?String(x.target.latin||x.target.name||'').toLowerCase().slice(0,80)||null:null,day:x.date||new Date(x.startMs).toISOString().slice(0,10),ms:x.startMs,ms2:x.endMs,lat:la,lon:lo,cnt:Math.min(999,(x.count|0)),tech:x.tech?String(x.tech).slice(0,40):null,prof:x.prof||null,cond:null}; }
  if(!x.date) return null; var la2=r1(x.lat), lo2=r1(x.lon); if(la2==null) return null;
  var c={}; CK.forEach(function(k){ var v=x[k]; if(typeof v==='number'&&isFinite(v)) c[k]=Math.round(v*10)/10; else if(typeof v==='string'&&v.length<=12) c[k]=v; });
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
function ask(){ if(ls.get(ASKED,0)||ls.get(K,null)!==null||!sess()) return; if(document.querySelector('.sheet.on,.sppage,.camov')||document.hidden){ setTimeout(ask,60000); return; } /* όχι πάνω σε άλλο φύλλο */ var n=0; try{ n=B.store.raw('bites').filter(function(b){ return !b.deleted; }).length; }catch(e){} if(n<1) return;
  ls.set(ASKED,1);
  var sh=B.sheet({title:'🎣 '+T('Βοήθησε να γίνει πιο σωστή η πρόγνωση','Help make the forecast better'),body:h('div',{class:'bform'},explain(),
    h('button',{class:'btn pri full',type:'button',text:T('Ναι, συμμετέχω','Yes, count me in'),onclick:function(){ set(true); sh.close(); B.toast(T('Ευχαριστούμε! 🐟','Thank you! 🐟')); }}),
    h('button',{class:'btn full',type:'button',text:T('Όχι τώρα','Not now'),onclick:function(){ set(false); sh.close(); }}))}); }
function sheet(){ var cb=h('input',{type:'checkbox',checked:on()}); cb.addEventListener('change',function(){ set(cb.checked); B.toast(cb.checked?T('Συμμετέχεις · ευχαριστούμε','You are taking part · thank you'):T('Σβήστηκαν τα στοιχεία σου από τον server','Your data was deleted from the server')); });
  B.sheet({title:T('Βοήθησε την πρόγνωση','Help the forecast'),body:h('div',{class:'bform'},explain(),h('label',{class:'tg',style:'padding:10px 4px'},cb,h('span',null,h('b',{text:T('Ανώνυμη συμμετοχή','Anonymous participation')}))))}); }
B.contrib={on:on,set:set,sync:sync,ask:ask,sheet:sheet,_rowOf:rowOf};

/* ---------- «Πότε τσιμπάνε · από όλους» (bite_stats) ---------- */
var ST=null, stAt=0;
function stats(){ if(ST&&Date.now()-stAt<6*3600e3) return Promise.resolve(ST); return stats0().then(function(S){ setLearn(S); return S; }); }
function stats0(){
  var q='bite_stats?select=key,n,users,data,updated_at', p=sess()?C().rest(q):(C()&&C().pub?C().pub(q):Promise.reject());
  return p.then(function(r){ return r.ok?r.json():[]; }).then(function(a){ ST={}; a.forEach(function(x){ ST[x.key]=x; }); stAt=Date.now(); return ST; }).catch(function(){ return ST||{}; }); }
var MIN=20;
function bars(title,lab,vals,fmt){ var mx=Math.max.apply(null,vals.map(function(v){ return v||0; }))||1;
  return h('div',{class:'bsg'},h('b',{class:'bsgt',text:title}),h('div',{class:'bsrow'},vals.map(function(v,i){ return h('div',{class:'bsc'},h('i',{style:'height:'+Math.max(3,Math.round((v||0)/mx*56))+'px'+((v||0)===mx&&v?';background:var(--accent)':'')}),h('small',{text:lab[i]})); }))); }
var FL={
  sun:[T('Ώρα της μέρας','Time of day'),[T('νύχτα','night'),T('αυγή','dawn'),T('πρωί','morning'),T('μεσημ.','midday'),T('απόγ.','afternoon'),T('σούρουπο','dusk')]],
  pt:[T('Πίεση (3 ώρες)','Pressure (3 h)'),[T('πέφτει','falling'),T('σταθερή','steady'),T('ανεβαίνει','rising')]],
  sol:[T('Σεληνιακές περίοδοι','Solunar periods'),[T('κύρια','major'),T('δευτερεύουσα','minor'),T('εκτός','none')]],
  wind:[T('Άνεμος (kn)','Wind (kn)'),['0–4','5–9','10–14','15+']],
  moon:[T('Φάση σελήνης','Moon phase'),['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘']],
  tide:[T('Στάθμη θάλασσας','Sea level'),[T('ανεβαίνει','rising'),T('κατεβαίνει','falling'),T('στάσιμη','slack')]],
  wave:[T('Κύμα (m)','Waves (m)'),['<0,3','0,3–0,6','0,6–1','>1']],
  pl:[T('Πίεση (hPa)','Pressure (hPa)'),['<1010','1010–15','1015–20','>1020']],
  cloud:[T('Νέφωση','Cloud'),[T('καθαρός','clear'),T('λίγα','some'),T('συννεφιά','overcast')]],
  rain:[T('Βροχή','Rain'),[T('όχι','no'),T('ναι','yes')]],
  cur:[T('Ρεύμα (km/h)','Current (km/h)'),['<0,4','0,4–1','>1']]};
var MAIN=['sun','pt','sol','wind'];
B.learnLabel=function(f,b){ var L=FL[f]; return L?L[0].replace(/ \(.*\)$/,'')+': '+L[1][b]:''; };
/* 1.14.23: τα ευρήματα πάνε στον δείκτη (forecast.js learnAdj) μέσω window.AlkyonLearn· κρατιούνται και τοπικά για να ισχύουν από την αρχή */
try{ var LR=ls.get('alkyon-learn',null); if(LR&&LR.ins) window.AlkyonLearn=LR; }catch(e){}
function setLearn(S){ try{ var rk=cellKey(), st=(rk&&S[rk]&&S[rk].n>=MIN)?S[rk]:S.all; var L=st&&st.n>=MIN&&st.data&&st.data.ins&&st.data.ins.length?{ins:st.data.ins,n:st.n,t:Date.now()}:null; window.AlkyonLearn=L; ls.set('alkyon-learn',L); }catch(e){} }
function spLabel(sp){ var kb=(window.SPKB||[]).filter(function(k){ return String(k.l||'').toLowerCase()===sp; })[0]; return kb?(B.EN?(kb.en||kb.n):kb.n):sp.charAt(0).toUpperCase()+sp.slice(1); }
function fx(v,d){ return B.num?B.num(v,d):String(v); }
var MY=null, myAt=0;
function mine(){ if(MY&&Date.now()-myAt<6*3600e3) return Promise.resolve(MY); var se=sess(); if(!se) return Promise.resolve(null);
  return C().rest('user_bite_stats?select=n,data,updated_at&user_id=eq.'+encodeURIComponent(se.uid)).then(function(r){ return r.ok?r.json():[]; }).then(function(a){ MY=a[0]||null; myAt=Date.now(); return MY; }).catch(function(){ return null; }); }
function cellKey(){ var p=B.lastPos&&B.lastPos(); if(!p) return null; return 'r:'+(Math.floor(p.lat/2)*2)+'_'+(Math.floor(p.lon/2)*2); }
function insList(ins){ var ul=h('ul',{class:'bsins'}); (ins||[]).forEach(function(x){ var L=FL[x.f]; if(!L) return; var up=x.lift>=1;
    var src=x.src==='both'?T('ψάρια και ώρες εξόδων','catches and trip hours'):x.src==='trip'?(x.h?x.h+T(' ώρες εξόδων',' trip hours'):T('ώρες εξόδων','trip hours')):x.n+T(' ψάρια, σε σύγκριση με τις ώρες της ίδιας μέρας',' catches vs the hours of the same day');
    var li=h('li',{class:(up?'up':'down')+(x.src==='both'?' strong':'')},h('b',{text:(up?'▲ ':'▼ ')+L[0]+': '+L[1][x.b]}),h('span',{text:' · ×'+fx(x.lift,1)+(up?T(' πιο συχνά ψάρια',' more fish'):T(' (λιγότερα)',' (fewer)'))}),h('small',{class:'bssrc',text:(x.src==='both'?'✓✓ ':'')+T('από ','from ')+src}));
    if(x.w){ var wk=[].concat(x.w.tech||[],x.w.bait||[],x.w.dep||[]); if(wk.length) li.append(h('small',{class:'bswk',text:T('Δούλεψε: ','Worked: ')+wk.join(' · ')})); }
    ul.append(li); }); return ul; }
function card(sp0){ var box=h('section',{class:'card bscard'},h('h3',{text:T('Πότε τσιμπάνε','When they bite')})), who=h('div',{class:'seg bswho'}), chips=h('div',{class:'chips bschips'}), body=h('div',null,h('p',{class:'sub',text:T('Φόρτωση…','Loading…')}));
  box.append(who,chips,body);
  var cur=sp0||'all', mode='all';
  Promise.all([stats(),mine()]).then(function(r){ var S=r[0]||{}, M=r[1];
    function seg(){ who.replaceChildren(); [['all',T('Όλοι','Everyone')],['me',T('Για σένα','For you')]].forEach(function(x){ who.append(h('button',{type:'button','aria-pressed':String(mode===x[0]),text:x[1],onclick:function(){ mode=x[0]; seg(); draw(); }})); }); }
    function draw(){ body.replaceChildren(); chips.replaceChildren();
      if(mode==='me'){ if(!M||!M.data){ body.append(h('p',{class:'sub',text:on()?T('Θα φανεί όταν έχεις τουλάχιστον 10 ψάρια με θέση (ενημερώνεται κάθε βράδυ).','Shows once you have at least 10 catches with a position (updated every night).'):T('Τα προσωπικά ευρήματα βγαίνουν από τα στοιχεία που στέλνεις ανώνυμα.','Personal findings come from the data you share anonymously.')}));
          if(!on()) body.append(h('button',{class:'linkbtn',type:'button',text:T('Ενεργοποίηση ›','Turn on ›'),onclick:sheet})); return; }
        render(M.data,M.n,0,true); return; }
      var rk=cellKey(), useR=rk&&S[rk]&&S[rk].n>=MIN&&cur==='all';
      var sps=Object.keys(S).filter(function(k){ return k.indexOf('sp:')===0&&S[k].n>=MIN; }).sort(function(a,b){ return S[b].n-S[a].n; }).slice(0,8);
      if(sps.length){ [['all',T('Όλα','All')]].concat(sps.map(function(k){ return [k,spLabel(k.slice(3))]; })).forEach(function(x){ chips.append(h('button',{type:'button',class:'chip sm'+(x[0]===cur?' on':''),text:x[1],onclick:function(){ cur=x[0]; draw(); }})); }); }
      var st=useR?S[rk]:(S[cur]||S.all);
      if(!st||st.n<MIN){ body.append(h('p',{class:'sub',text:T('Μαζεύονται ακόμα στοιχεία','Still collecting data')+(st&&st.n?' · '+st.n+T(' ψάρια μέχρι τώρα',' fish so far'):'')+T('. Θα φανεί όταν υπάρχουν τουλάχιστον ','. It will show once there are at least ')+MIN+T(' ψάρια.',' fish.')}));
        if(!on()) body.append(h('button',{class:'linkbtn',type:'button',text:T('Βοήθησε με τα δικά σου ψάρια ›','Help with your own catches ›'),onclick:sheet})); return; }
      render(st.data||{},st.n,st.users,false,useR); }
    function render(d,n,users,me,reg){
      body.append(h('p',{class:'sub',text:n+T(' ψάρια',' fish')+(users>=3?T(' από ',' from ')+users+T(' ψαράδες',' anglers'):'')+(d.hrs?' · '+d.hrs+T(' ώρες εξόδων',' trip hours'):'')+(reg?T(' · στην περιοχή σου',' · in your area'):'')+(d.tgt?T(' · έξοδοι με αυτόν τον στόχο',' · trips targeting it'):'')}));
      if(d.ins&&d.ins.length) body.append(insList(d.ins)); else body.append(h('p',{class:'sub',text:T('Κανένα δυνατό εύρημα ακόμα.','No strong findings yet.')}));
      if(d.f){ MAIN.forEach(function(k){ var g=factor(k,d.f[k]); if(g) body.append(g); });
        var rest=Object.keys(FL).filter(function(k){ return MAIN.indexOf(k)<0&&d.f[k]; }); if(rest.length){ var det=h('details',{class:'bsmore'},h('summary',{text:T('Όλες οι συνθήκες','All conditions')})); rest.forEach(function(k){ var g=factor(k,d.f[k]); if(g) det.append(g); }); body.append(det); } }
      body.append(h('small',{class:'sub',text:me?T('Μόνο από τα δικά σου ψάρια. Τα βλέπεις μόνο εσύ.','Only from your own catches. Only you can see them.'):T('Ανώνυμα, από όσους συμμετέχουν. Καιρός κάθε ώρας από το ιστορικό του Open-Meteo· κάθε ψάρι συγκρίνεται με τις ώρες της ίδιας μέρας, και οι έξοδοι μετρούν και τις ώρες χωρίς ψάρι. ✓✓ = συμφωνούν και οι δύο μέθοδοι.','Anonymous, from those who take part. Hourly weather from Open-Meteo history; each catch is compared with the hours of the same day, and trips also count hours with no fish. ✓✓ = both methods agree.')})); }
    seg(); draw(); });
  return box; }
function factor(k,o){ var L=FL[k]; if(!L||!o) return null; var useR=!!(o.r&&o.r.filter(function(x){ return x!=null; }).length>=2), useC=!useR&&!!(o.cc&&o.cc.filter(function(x){ return x!=null; }).length>=2);
  var vals=useR?o.r.map(function(x){ return x||0; }):useC?o.cc.map(function(x){ return x||0; }):o.c;
  return bars(L[0]+(useR?T(' · ψάρια ανά ώρα',' · fish per hour'):useC?T(' · ×συχνότητα ψαριών',' · ×fish rate'):T(' · ψάρια',' · fish')),L[1],vals); }
B.biteStatsCard=card;

setTimeout(function(){ if(on()) sync(); else ask(); stats(); },8000);
B.on&&B.on('store',function(){ clearTimeout(sync._t); sync._t=setTimeout(sync,4000); });
document.addEventListener('visibilitychange',function(){ if(!document.hidden&&on()) sync(); });
})();
