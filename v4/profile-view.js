/* Alkyon 4 · Προφίλ: λογαριασμός, συγχρονισμός, τύπος ψαρέματος, γλώσσα, μονάδες */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, U=window.AlkyonUnits, root=null;
function C(){ return B.cloud; }

/* διαγραφή λογαριασμού (ίδια ροή με την κλασική: έλεγχος ότι η υπηρεσία υπάρχει, σβήσιμο cloud, μετά λογαριασμός) */
function delAccount(){ var word=T('ΔΙΑΓΡΑΦΗ','DELETE'), cl=B.cloud, inp=h('input',{type:'text',autocomplete:'off',autocapitalize:'characters',placeholder:word}), msg=h('p',{class:'err',role:'alert'}), sh;
  var go=h('button',{class:'btn full sos',type:'button',text:T('Οριστική διαγραφή','Delete permanently'),onclick:function(){
    if(inp.value.trim().toUpperCase()!==word){ msg.textContent=T('Γράψε ','Type ')+word+T(' για να συνεχίσεις.',' to continue.'); return; }
    go.disabled=true; msg.textContent=T('Διαγραφή…','Deleting…'); var J={'Content-Type':'application/json'};
    cl.rest('rpc/delete_my_account',{method:'POST',headers:J,body:JSON.stringify({dry:true})}).then(function(){
      var q=Promise.resolve(); ['records?id=not.is.null','safety_trips?id=not.is.null','safety_contacts?updated_at=not.is.null'].forEach(function(pth){ q=q.then(function(){ return cl.rest(pth,{method:'DELETE'}).catch(function(){}); }); });
      var uid=(cl.session()||{}).uid, pup=ls.get('alkyon-pup',{})||{}; Object.keys(pup).forEach(function(k){ q=q.then(function(){ return cl.storage('DELETE','photos/'+uid+'/'+k+'.jpg').catch(function(){}); }); });
      return q.then(function(){ return cl.rest('rpc/delete_my_account',{method:'POST',headers:J,body:JSON.stringify({dry:false})}); }).then(function(){
        ['alkyon-sess','alkyon-last','alkyon-pup'].forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} }); sh.close(); B.toast(T('Ο λογαριασμός διαγράφηκε.','Your account was deleted.')); setTimeout(function(){ location.reload(); },1200); })
        .catch(function(){ go.disabled=false; msg.textContent=T('Η διαγραφή απέτυχε. Δοκίμασε ξανά.','Deletion failed. Try again.'); }); },
      function(){ go.disabled=false; msg.textContent=T('Η διαγραφή λογαριασμού δεν είναι διαθέσιμη ακόμα. Δεν διαγράφηκε τίποτα.','Account deletion is not available yet. Nothing was deleted.'); }); }});
  sh=B.sheet({title:T('Διαγραφή λογαριασμού','Delete account'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Θα διαγραφεί ο λογαριασμός σου και ό,τι έχει συγχρονιστεί στο cloud (ψάρια, σημεία, έξοδοι, φωτογραφίες, επαφή ασφαλείας). Δεν αναιρείται. Τα δεδομένα σε αυτό το κινητό μένουν.','Your account and everything synced to the cloud (catches, spots, trips, photos, safety contact) will be deleted. This cannot be undone. Data on this phone stays.')}),
    h('label',{class:'fld'},h('span',{text:T('Γράψε ','Type ')+word+T(' για επιβεβαίωση',' to confirm')}),inp),msg,go)}); }
/* εικονίδια γραμμής για τις λίστες του Προφίλ */
var PI={lim:'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8 12.5c1.3 0 1.3-1.2 2.7-1.2s1.3 1.2 2.6 1.2 1.3-1.2 2.7-1.2"/>',watch:'<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 10v2.5l1.5 1"/>',tackle:'<path d="M4 20L18.5 5.5"/><path d="M18.5 5.5c1.2-1.2 2.5-.4 2.5 1v5"/><circle cx="7.5" cy="16.5" r="2.2"/>',boat:'<path d="M3 15h18l-2.5 4.5h-13z"/><path d="M7 15V9h7l3 6"/><path d="M10 9V5"/>',
  spots:'<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',gear:'<path d="M3 7h18M3 12h18M3 17h18M7 4v16M12 4v16M17 4v16"/>',
  people:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',community:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  guide:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  type:'<path d="M3 17c2.2 0 2.2-1.5 4.5-1.5S9.8 17 12 17s2.2-1.5 4.5-1.5S19 17 21 17"/><path d="M12 3v10M8 7l4-4 4 4"/>',lang:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  units:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',safety:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  ai:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z"/>',
  voice:'<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',map:'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',backup:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',hist:'<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',stats:'<path d="M5 20V10M12 20V4M19 20v-7"/>',night:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17.2v.3"/>'};
function pic(k){ return h('span',{class:'ic pic',html:k==='type'&&B.profBadge?B.profBadge(B.prof()):'<svg viewBox="0 0 24 24" aria-hidden="true">'+(PI[k]||'')+'</svg>'}); }
function row(k,title,sub,href,fn){ var a=h(href?'a':'button',{class:'li',href:href||null,type:href?null:'button',onclick:fn||null},pic(k),h('span',{class:'tx'},h('b',{text:title}),sub?h('small',{text:sub}):null),B.icon('chev')); return a; }
function group(title,rows){ return h('div',{class:'pgrp'},title?h('h3',{class:'listh',text:title}):null,h('div',{class:'list'},rows.filter(Boolean))); }
var tab=ls.get('alkyon-v4-ptab','mine');
/* κεφαλίδα: όνομα, συγχρονισμός, η χρονιά σου */
function head(s){ var st=C().state(), nm=s?((s.name||'').trim()||s.email||''):'', y=String(new Date().getFullYear());
  var bs=B.store.raw('bites').filter(function(b){ return !b.deleted&&!b.miss&&!b.gear&&(b.date||'').slice(0,4)===y&&!B.pest(b); }), tr=B.store.raw('trips').filter(function(t){ return !t.deleted&&(t.date||'').slice(0,4)===y; });
  var n=bs.reduce(function(a,b){ return a+Math.max(1,Math.floor(+b.cnt)||1); },0), best=null, pl={}; var sps=B.store.raw('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'; });
  function nearSpot(b){ if(typeof b.lat!=='number'||!sps.length) return ''; var bn='', bd=1500; sps.forEach(function(x){ var dy=(x.lat-b.lat)*111320, dx=(x.lon-b.lon)*111320*Math.cos(b.lat*Math.PI/180), d=Math.sqrt(dx*dx+dy*dy); if(d<bd){ bd=d; bn=x.name||''; } }); return bn; }
  bs.forEach(function(b){ if(+b.kg>0&&(!best||+b.kg>+best.kg)) best=b; var pn=(b.place||'').trim()||nearSpot(b); if(pn) pl[pn]=(pl[pn]||0)+Math.max(1,Math.floor(+b.cnt)||1); });
  var top=Object.keys(pl).sort(function(a,b){ return pl[b]-pl[a]; })[0];
  var cls=!s?'off':st.err?'bad':(st.t&&Date.now()-st.t<86400000)?'ok':'warn', stx=!s?(function(){ var nn=0; try{ nn=B.store.raw('bites').filter(function(b){ return !b.deleted; }).length+B.store.raw('trips').filter(function(t){ return !t.deleted; }).length; }catch(e){} return nn>=3?T('Χωρίς λογαριασμό · '+nn+' ψάρια και έξοδοι μόνο σε αυτό το κινητό. Πάτα για να μη χαθούν.','No account · '+nn+' catches and trips on this phone only. Tap so they are never lost.'):T('Χωρίς λογαριασμό · μόνο σε αυτό το κινητό','No account · this phone only'); })():st.err?T('Πρόβλημα συγχρονισμού','Sync problem'):st.t?T('Συγχρονίστηκε ','Synced ')+new Date(st.t).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):T('Δεν έχει συγχρονιστεί ακόμα','Not synced yet');
  var c=h('section',{class:'card phead'});
  c.append(h('button',{type:'button',class:'phid','aria-label':T('Λογαριασμός και συγχρονισμός','Account and sync'),onclick:function(){ tab='acc'; ls.set('alkyon-v4-ptab',tab); draw(); setTimeout(function(){ var t=document.querySelector('.bseg,.seg'); if(t&&t.scrollIntoView) t.scrollIntoView({behavior:'smooth',block:'start'}); },60); }},(function(){ var av=h('span',{class:'av'}), u=s&&B.commAvatar?B.commAvatar():''; if(u) av.append(h('img',{src:u,alt:''})); else av.textContent=(nm||'?').charAt(0).toUpperCase(); return av; })(),h('span',{class:'tx'},h('b',{text:nm||T('Σύνδεση ή εγγραφή','Sign in or sign up')}),h('small',null,h('i',{class:'sdot '+cls}),stx)),(tab==='acc'||nm)?null:B.icon('chev'))); /* 1.9.8: συνδεδεμένος → χωρίς βελάκι (υπάρχει ήδη η καρτέλα «Λογαριασμός» από κάτω)· v31z545: το βελάκι ανοίγει τον Λογαριασμό· όταν είσαι ήδη εκεί, δεν φαίνεται */
  var cells=[[String(tr.length),T('Έξοδοι ','Trips ')+y,'boat'],[String(n),T('Ψάρια ','Fish ')+y,'tackle'],[best?B.num(+best.kg,1)+' kg':'–',best?(best.species||T('Καλύτερο','Best'))+' · '+y:T('Καλύτερο ','Best ')+y,'stats'],top?[top,T('Σημείο ','Top spot ')+y,'spots']:[B.num(bs.reduce(function(a,b){ return a+(+b.kg||0); },0),1)+' kg',T('Σύνολο ','Total ')+y,'stats']]; /* 1.9.11: χωρίς σημείο → σύνολο κιλών αντί για «–» */
  /* 1.9.15: τα κουτάκια ανοίγουν: έξοδοι/ψάρια της χρονιάς στο ημερολόγιο, το μεγαλύτερο ψάρι, το σημείο στον χάρτη */
  function toLog(tb){ ls.set('alkyon-v4-logtab',tb); ls.set('alkyon-v4-logrange','year'); location.hash='#log'; }
  var topSp=top?sps.filter(function(x){ return (x.name||'')===top; })[0]:null;
  if(top&&!topSp){ var tb2=bs.filter(function(b){ return ((b.place||'').trim()||nearSpot(b))===top&&typeof b.lat==='number'; })[0]; if(tb2) topSp={lat:tb2.lat,lon:tb2.lon,name:top}; }
  var acts=[function(){ toLog('trips'); },function(){ toLog('fish'); },best?function(){ if(B.biteDetail) B.biteDetail(best); }:null,top?(topSp?function(){ if(B.spotSheet&&topSp.id) B.spotSheet(topSp); else B.mapGo(topSp.lat,topSp.lon,15,null,{lab:top}); }:null):function(){ ls.set('alkyon-v4-logtab','stats'); ls.set('alkyon-v4-logrange','year'); location.hash='#log'; }];
  c.append(h('div',{class:'pstats'},cells.map(function(x,i){ var fn=acts[i]; return h(fn?'button':'div',{class:'pst'+(fn?' pgo':''),type:fn?'button':null,onclick:fn||null,title:x[0]+' · '+x[1]},h('span',{class:'psi',html:'<svg viewBox="0 0 24 24" aria-hidden="true">'+PI[x[2]]+'</svg>'}),h('b',{text:x[0],class:x[0].length>7?'lng':null}),h('small',{text:x[1]})); })));
  c.append(h('a',{class:'pall',href:'#log',onclick:function(){ ls.set('alkyon-v4-logtab','stats'); },text:T('Όλα τα στατιστικά ›','All statistics ›')}));
  return c; }
function draw(){
  if(!root) return;
  var s=C().session(), page=h('div',{class:'page'}), y=window.scrollY;
  page.append(h('div',{class:'top'},h('h1',{class:'lt',text:T('Προφίλ','Profile')})));
  page.append(head(s));
  /* 1.4.0: χωρίς λογαριασμό και με 3+ ψάρια ή εξόδους: μικρή υπενθύμιση, μέχρι να την κλείσεις */
  if(false&&!s&&tab!=='acc'&&!ls.get('alkyon-v4-acctip',0)){ /* 1.6.1: το μήνυμα μπήκε στην πάνω κάρτα (πριν υπήρχαν δύο κάρτες για λογαριασμό) */ var nn=0; try{ nn=B.store.raw('bites').filter(function(b){ return !b.deleted; }).length+B.store.raw('trips').filter(function(t){ return !t.deleted; }).length; }catch(e){}
    if(nn>=3){ var tip=h('section',{class:'card acctip'},h('p',{text:T('Έχεις '+nn+' ψάρια και εξόδους μόνο σε αυτό το κινητό. Με δωρεάν λογαριασμό δεν χάνονται.','You have '+nn+' catches and trips on this phone only. With a free account they are never lost.')}),
      h('div',{class:'inrow'},B.accountBtn?B.accountBtn(null,T('Δημιουργία λογαριασμού','Create account')):null,h('button',{class:'btn',type:'button',text:T('Όχι, ευχαριστώ','No thanks'),onclick:function(){ ls.set('alkyon-v4-acctip',Date.now()); tip.remove(); }})));
      page.append(tip); } }
  page.append(B.seg([['mine',T('Τα δικά μου','My stuff')],['set',T('Ρυθμίσεις','Settings')],['acc',T('Λογαριασμός','Account')]],tab,function(v){ tab=v; ls.set('alkyon-v4-ptab',v); draw(); },T('Ενότητα προφίλ','Profile section')));
  if(tab==='set') settingsTab(page); else if(tab==='acc') accountTab(page,s); else mineTab(page);
  var EL=window.AlkyonErrLog, ne=EL?EL.get().filter(function(e){ return !e.v||e.v===window.ALKYON_VERSION; }).length:0; /* 1.4.1: μόνο της τωρινής έκδοσης */
  page.append(h('p',{class:'foot'},'Alkyon · '+(window.ALKYON_VERSION||''),
    ne?' · ':'',ne?h('button',{type:'button',class:'linkbtn errlk',text:T('Αναφορά σφαλμάτων','Error report')+' ('+ne+')',onclick:function(){ location.hash='#check'; }}):''));
  root.replaceChildren(page); if(y) try{ window.scrollTo(0,y); }catch(e){}
}
/* αναφορά σφαλμάτων: τι κόλλησε στο κινητό, για να σταλεί και να διορθωθεί */
function errSheet(){ var EL=window.AlkyonErrLog, a=EL?EL.get():[], sh;
  function txt(){ return 'Alkyon '+(window.ALKYON_VERSION||'')+' · '+navigator.userAgent+'\n'+a.map(function(e){ return new Date(e.t).toISOString().slice(0,16).replace('T',' ')+' '+(e.v||'')+' '+(e.p||'')+'\n  '+e.m+(e.n>1?' (x'+e.n+')':'')+(e.w?'\n  @ '+e.w:''); }).join('\n'); }
  var list=h('div',{class:'errl'},a.slice().reverse().map(function(e){ return h('div',{class:'erri'},h('small',{text:new Date(e.t).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+(e.n>1?' · ×'+e.n:'')+(e.p?' · '+e.p:'')}),h('code',{text:e.m}),e.w?h('small',{class:'erw',text:e.w}):''); }));
  var send=h('button',{type:'button',class:'btn pri full',text:navigator.share?T('Αποστολή','Send'):T('Αντιγραφή','Copy'),onclick:function(){ var t=txt();
    if(navigator.share) navigator.share({title:'Alkyon errors',text:t}).catch(function(){});
    else if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){ B.toast(T('Αντιγράφηκε.','Copied.')); },function(){ B.toast(T('Δεν αντιγράφηκε.','Could not copy.')); }); }});
  var clr=h('button',{type:'button',class:'btn full',text:T('Καθάρισμα','Clear'),onclick:function(){ EL.clear(); sh.close(); draw(); }});
  sh=B.sheet({title:T('Αναφορά σφαλμάτων','Error report'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Σφάλματα που έγιναν σε αυτό το κινητό. Στείλ’ τα για να διορθωθούν. Δεν περιέχουν ψάρια, σημεία ή στοιχεία λογαριασμού.','Errors that happened on this phone. Send them so they can be fixed. They contain no catches, spots or account details.')}),list,send,clr)}); }
function mineTab(page){
  var n=B.store.raw('tackle').filter(function(x){ return !x.deleted; }).length, sp=B.store.raw('spots').filter(function(x){ return !x.deleted; }).length;
  var bt=ls.get('alkyon-boat',null), bn=bt&&bt.boat&&bt.boat.name, g=ls.get('alkyon-gear',null), gn=g&&Array.isArray(g.items)?g.items.length:0;
  page.append(group(T('Εξοπλισμός και σκάφος','Tackle and boat'),[
    row('tackle',T('Εξοπλισμός','Tackle'),n?n+' '+(n===1?T('κομμάτι','item'):T('κομμάτια','items')):T('Καλάμια, μουλινέ, τεχνητά, ψαροντούφεκα','Rods, reels, lures, spearguns'),'#tackle'),
    /* 1.6.9: τα παραγάδια/δίχτυα και τα σημεία είναι στο Ημερολόγιο (καρτέλες), όχι και εδώ */
    row('boat',T('Σκάφος','Boat'),bn||T('Κινητήρας, συντήρηση, λήξεις, μπαταρίες','Engine, maintenance, expiries, batteries'),'#boat'),
    /* v31z552 */ B.garmin?row('watch',T('Ρολόι Garmin','Garmin watch'),B.garmin.code()?T('Συνδεδεμένο ✓','Linked ✓'):T('Πρόγνωση, πίεση και καταγραφή ψαριού στο ρολόι','Forecast, pressure and catch logging on the watch'),null,function(){ B.garmin.sheet(); }):null].filter(Boolean)));
  /* v31z525: η εισαγωγή είναι δεδομένα σου, όχι ρύθμιση λογαριασμού */
  page.append(group(T('Εισαγωγή δεδομένων','Import data'),[row('backup',T('Από plotter, GPS ή ρολόι κατάδυσης','From a plotter, GPS or dive watch'),'GPX · KML · CSV · FIT · UDDF',null,function(){ if(B.importSheet) B.importSheet(); })]));
  page.append(group(T('Φίλοι και κοινότητα','Friends and community'),[
    (function(){ var r=row('community',T('Κοινότητα','Community'),T('Ψάρια άλλων ψαράδων, χωρίς θέση','Other anglers’ catches, no locations'),'#community'); /* 1.9.65: «Νέα» */
      if(B.commNewCount) B.commNewCount(function(n){ if(n){ var tx=r.querySelector('.tx b'); if(tx) tx.append(h('span',{class:'cmnew',text:n>=20?'20+':String(n)})); } }); return r; })(),
    row('people',T('Φίλοι','Friends'),T('Κοινά ψάρια και σημεία με φίλους','Share catches and spots with friends'),'#friends'),
    /* 1.9.65: φωτογραφία προφίλ (φαίνεται στην Κοινότητα) και πρόσκληση φίλου */
    (B.cloud&&B.cloud.session&&B.cloud.session()&&B.commAvatarPick)?row('people',T('Φωτογραφία προφίλ','Profile photo'),T('Φαίνεται στις αναρτήσεις και στα σχόλιά σου','Shown on your posts and comments'),null,function(){ B.commAvatarPick(); }):null,
    B.commInvite?row('community',T('Πρόσκληση φίλου','Invite a friend'),T('Στείλε τον σύνδεσμο του Alkyon','Send the Alkyon link'),null,function(){ B.commInvite(); }):null]));
  /* 1.9.19: διαχειριστής: σημειώσεις λιμανιών για έγκριση */
  if(B.cloud&&B.cloud.session&&B.cloud.session()){ var cg=page.lastChild.querySelector('.list'); B.loadScripts(['portnotes.js']).then(function(){ B.portNotes.adminRow(cg,function(n){ return row('community',T('Σημειώσεις λιμανιών για έγκριση','Port notes to review'),n==null?T('Διαχειριστής','Admin'):n?n+T(' σε αναμονή',' waiting'):T('Τίποτα σε αναμονή','Nothing waiting'),null,function(){ B.portNotes.review(); }); }); }).catch(function(){}); }
  page.append(group(T('Γνώση','Knowledge'),[
    row('help',T('Πώς δουλεύει','How it works'),T('Όλες οι λειτουργίες με λίγα λόγια','Every feature in a few words'),'#help'),
    row('guide',T('Οδηγός','Guide'),T('Είδη, μεγέθη, νόμοι, κόμποι','Species, sizes, laws, knots'),'#guide'),
    row('safety',T('Έλεγχος συστήματος','System check'),T('Δουλεύουν όλα; Καιρός, δορυφόρος, ειδοποιήσεις, αντίγραφο','Is everything working? Weather, satellite, alerts, backup'),'#check'),
    row('help',T('Επικοινωνία','Contact'),'alkyonfishingapp@gmail.com','mailto:alkyonfishingapp@gmail.com?subject='+encodeURIComponent('Alkyon '+(window.ALKYON_VERSION||'')))])); /* 1.9.24: email επικοινωνίας της εφαρμογής */
}
function sheetOf(title,body){ return B.sheet({title:title,body:body}); }
function settingsTab(page){
  var sf=ls.get('alkyon-safe',null)||{}, n=Object.assign({on:false},ls.get('alkyon-notify',{}));
  var uLab=function(k){ var v=U&&U.cfg&&U.cfg[k], o=U&&U.options&&U.options[k], m=o&&o.filter(function(x){ return x[0]===v; })[0]; return m?m[1]:v; }, uSum=U&&U.cfg?['wind','wave','depth','temp'].filter(function(k){ return k!=='depth'||U.cfg.depth!=='m'; }).map(uLab).filter(Boolean).join(' · '):'';
  page.append(group(T('Ψάρεμα','Fishing'),[
    row('type',T('Τύπος ψαρέματος','Fishing type'),(B.PROF[B.prof()]||'')+(ls.raw&&ls.raw('alkyon-askfp')==='"0"'?'':''),null,function(){ var body=h('div',{class:'bform'},
        h('div',{class:'ptiles',role:'group','aria-label':T('Τύπος ψαρέματος','Fishing type')},Object.keys(B.PROF).map(function(k){ return h('button',{type:'button',class:'ptile','aria-pressed':String(B.prof()===k),onclick:function(){ try{ localStorage.setItem('alkyon-fprof',k); }catch(e){} B.emit('store','alkyon-fprof'); B.toast(T('Ο βαθμός και οι προτάσεις προσαρμόστηκαν.','The score and suggestions were adjusted.')); B.closeSheet(); draw(); }},h('span',{class:'pti',html:B.profBadge?B.profBadge(k):''}),h('b',{text:B.PROF[k]})); })),
        h('button',{class:'btn full',type:'button',text:T('Ακτή ή σκάφος, και ερώτηση στο άνοιγμα','Shore or offshore, and the question at start'),onclick:function(){ B.closeSheet(); setTimeout(B.startPick,250); }}));
      sheetOf(T('Τύπος ψαρέματος','Fishing type'),body); }),
    row('safety',T('Επαφή ασφαλείας','Safety contact'),sf.name||sf.phone||sf.email||(sf.tgLinked?'Telegram':T('Δεν έχει οριστεί','Not set')),null,function(){ if(B.safetyCard) sheetOf(T('Επαφή ασφαλείας','Safety contact'),B.safetyCard()); }),
    /* 1.9.40: όρια ασφαλείας για όλους (ακτή, ψαροντούφεκο, σκάφος), όχι μόνο μέσα στο Σκάφος */
    B.limitsCard?row('lim',T('Όρια ασφαλείας','Safety limits'),(function(){ var L=B.limits?B.limits():{}, U=window.AlkyonUnits; return T('άνεμος ','wind ')+(U&&U.wind?U.wind(L.wind):Math.round(L.wind)+' kn')+' · '+T('κύμα ','waves ')+B.num(L.wave,1)+' m · '+T('ριπές ','gusts ')+(U&&U.wind?U.wind(L.gust):Math.round(L.gust)+' kn'); })(),null,function(){ var on=function(){ ch=true; }, ch=false; window.addEventListener('alkyon-limits',on); B.sheet({title:T('Όρια ασφαλείας','Safety limits'),body:h('div',null,B.limitsCard()),onclose:function(){ window.removeEventListener('alkyon-limits',on); if(ch) draw(); }}); }):null,
    row('bell',T('Ρυθμίσεις ειδοποιήσεων','Notification settings'),n.on?T('Ενεργές','On'):T('Ανενεργές','Off'),'#alerts'),
    row('hist',T('Ιστορικό ειδοποιήσεων','Notification history'),T('Ό,τι σου στάλθηκε','Everything sent to you'),'#inbox')]));
  page.append(group(T('Εφαρμογή','App'),[
    row('lang',T('Γλώσσα','Language'),B.LANG==='en'?'English':'Ελληνικά',null,function(){ sheetOf(T('Γλώσσα','Language'),h('div',{class:'bform'},B.seg([['el','Ελληνικά'],['en','English']],B.LANG,function(v){ try{ localStorage.setItem('alkyon-lang',v); }catch(e){} location.reload(); },T('Γλώσσα','Language')))); }),
    U&&U.options?row('units',T('Μονάδες','Units'),uSum,null,unitsSheet):null,
    B.saySheet?row('voice',T('Φωνή','Voice'),(B.sayCfg&&B.sayCfg().on)?T('Ανοιχτή · συρτή, ταχύτητα, άγκυρα, πλοήγηση','On · trolling, speed, anchor, navigation'):T('Κλειστή','Off'),null,B.saySheet):null,
    /* 1.7.2: χάρτης κλασικός ή καθαρός */
    row('map',T('Χάρτης','Map'),(ls.get('alkyon-v4-mapui','')==='clean')?T('Καθαρός · μπάρα και μενού που σέρνεις','Clean · bar and pull-down menu'):T('Κλασικός · όλα τα κουμπιά','Classic · all buttons'),null,function(){ var sh, cur=ls.get('alkyon-v4-mapui','')||'classic';
      function o(v,t,d){ return h('button',{type:'button',class:'li','aria-pressed':String(cur===v),onclick:function(){ if(B.setMapUI) B.setMapUI(v); else ls.set('alkyon-v4-mapui',v); sh.close(); B.render&&B.render(); }},h('span',{class:'tx'},h('b',{text:(cur===v?'✓ ':'')+t}),h('small',{text:d}))); }
      var am=h('input',{type:'checkbox',checked:ls.get('alkyon-v4-automode',true)!==false}); am.addEventListener('change',function(){ ls.set('alkyon-v4-automode',am.checked); });
      sh=B.sheet({title:T('Χάρτης','Map'),body:h('div',{class:'list'},h('label',{class:'tg',style:'padding:10px 14px'},am,h('span',null,h('b',{text:T('Η οθόνη αλλάζει μόνη της (Καθαρός)','Screen changes by itself (Clean)')}),h('small',{class:'tgs',text:T('Σε έξοδο: ΠΗΓΑΙΝΩ πάνω από 6 kn, ΨΑΡΕΥΩ αργά ή με συρτή, ΑΓΚΥΡΑ με συναγερμό άγκυρας','On a trip: UNDERWAY above 6 kn, FISHING slow or trolling, ANCHORED with the anchor alarm')}))),o('clean',T('Καθαρός','Clean'),T('Μία μπάρα πάνω· στρώματα και εργαλεία σε πλαϊνό μενού (πάτα ή σύρε)','One bar on top; layers and tools in a menu you pull down (or tap)')),o('classic',T('Κλασικός','Classic'),T('Όλα τα κουμπιά πάνω στον χάρτη','All buttons on the map')))}); }),
    B.night?row('night',T('Νυχτερινή λειτουργία','Night mode'),{auto:T('Αυτόματα στην έξοδο μετά τη δύση','Automatic on trips after sunset'),on:T('Πάντα','Always'),off:T('Ποτέ','Never')}[B.night.mode()],null,function(){ sheetOf(T('Νυχτερινή λειτουργία','Night mode'),h('div',{class:'bform'},
      h('p',{class:'sub',text:T('Κόκκινη οθόνη για το σκοτάδι: τα μάτια δεν χάνουν την προσαρμογή τους. Στον χάρτη, το κουμπί 🌙 την ανοίγει ή την κλείνει για την τρέχουσα έξοδο.','Red screen for the dark: your eyes keep their night vision. On the map, the 🌙 button turns it on or off for the current trip.')}),
      B.seg([['auto',T('Αυτόματα','Automatic')],['on',T('Πάντα','Always')],['off',T('Ποτέ','Never')]],B.night.mode(),function(v){ B.night.set(v); draw(); },T('Νυχτερινή λειτουργία','Night mode')))); }):null,
    B.dataCards?row('ai',T('Αναγνώριση ψαριού (AI)','Fish recognition (AI)'),T('Κλειδί και ρυθμίσεις','Key and settings'),null,function(){ sheetOf(T('Αναγνώριση ψαριού (AI)','Fish recognition (AI)'),B.dataCards()[1]); }):null]));
}
/* v31z545: αποσύνδεση με επιλογή: να μείνουν ή να σβηστούν τα δεδομένα από αυτό το κινητό (μένουν πάντα στον λογαριασμό) */
function signOutSheet(){ var sh, msg=h('p',{class:'sub',role:'status'});
  function go(wipe){ [].forEach.call(sh.el.querySelectorAll('button.btn'),function(b){ b.disabled=true; }); msg.textContent=T('Συγχρονισμός και αποσύνδεση…','Syncing and signing out…');
    C().signOut({wipe:wipe}).then(function(r){ sh.close(); B.toast(wipe&&!r.wiped?T('Αποσυνδέθηκες. Ο συγχρονισμός δεν ολοκληρώθηκε, οπότε τα δεδομένα έμειναν στο κινητό για να μη χαθούν.','Signed out. Sync did not finish, so your data stayed on this phone so nothing is lost.'):wipe?T('Αποσυνδέθηκες και τα δεδομένα σβήστηκαν από αυτό το κινητό. Είναι στον λογαριασμό σου.','Signed out and your data was removed from this phone. It is in your account.'):T('Αποσυνδέθηκες. Τα δεδομένα έμειναν σε αυτό το κινητό.','Signed out. Your data stayed on this phone.'),7000); draw(); }); }
  sh=B.sheet({title:T('Αποσύνδεση','Sign out'),body:h('div',{class:'bform'},
    h('p',{class:'sub',text:T('Πρώτα συγχρονίζονται όλα στον λογαριασμό σου. Μετά διάλεξε τι γίνεται σε αυτό το κινητό:','Everything is synced to your account first. Then choose what happens on this phone:')}),
    h('button',{class:'btn full',type:'button',text:T('Αποσύνδεση · κράτα τα δεδομένα εδώ','Sign out · keep data here'),onclick:function(){ go(false); }}),
    h('button',{class:'btn full del',type:'button',text:T('Αποσύνδεση και διαγραφή από αυτό το κινητό','Sign out and remove from this phone'),onclick:function(){ go(true); }}),
    h('p',{class:'foot',text:T('Η διαγραφή γίνεται μόνο αν ο συγχρονισμός πετύχει. Όταν ξανασυνδεθείς, τα δεδομένα επιστρέφουν από τον λογαριασμό.','Removal only happens if the sync succeeds. When you sign in again, your data comes back from the account.')}),msg)}); }
function unitsSheet(){ var body=h('div',{class:'bform'}), L={wind:T('Άνεμος','Wind'),wave:T('Κύμα','Waves'),depth:T('Βάθος','Depth'),temp:T('Θερμοκρασία','Temperature'),press:T('Πίεση','Pressure'),dist:T('Απόσταση','Distance'),coord:T('Συντεταγμένες','Coordinates')};
  Object.keys(L).forEach(function(k){ if(!U.options[k]) return; body.append(h('h3',{class:'h3',text:L[k]}),B.seg(U.options[k].map(function(o){ return [o[0],o[1]]; }),U.cfg[k],function(v){ U.set(k,v); B.emit('store','alkyon-units'); draw(); },L[k])); });
  sheetOf(T('Μονάδες','Units'),body); }
function accountTab(page,s){
  page.append(s?accountCard(s):signInCard());
  /* 1.9.6: πιο σύντομος «Λογαριασμός»: τα εργαλεία δεδομένων σε τρεις γραμμές που ανοίγουν φύλλο (ίδια κουμπιά μέσα) */
  var IC={bk:'<path d="M12 3v12m-4-4 4 4 4-4M5 21h14"/>',xl:'<path d="M4 4h16v16H4zM4 10h16M10 4v16"/>',ck:'<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>'};
  function row(ic,t,sub,fn){ return h('button',{class:'li',type:'button',onclick:fn},h('span',{class:'ic',html:'<svg viewBox="0 0 24 24" aria-hidden="true">'+IC[ic]+'</svg>'}),h('span',{class:'tx'},h('b',{text:t}),h('small',{text:sub})),B.icon('chev')); }
  var lb=ls.get('alkyon-lastbackup',0), dcs=B.dataCards?B.dataCards():null, dm=dataCard();
  page.append(group(T('Δεδομένα','Data'),[
    row('bk',T('Αντίγραφο ασφαλείας','Backup'),lb?T('Τελευταίο: ','Last: ')+new Date(lb).toLocaleDateString(EN?'en-GB':'el-GR'):T('Δεν έχει γίνει ακόμα','Not done yet'),function(){ sheetOf(T('Αντίγραφο ασφαλείας','Backup'),h('div',null,backupCard())); }),
    dcs&&dcs[0]?row('xl',T('Εξαγωγή σε Excel (CSV)','Export to Excel (CSV)'),T('Ψάρια ή έξοδοι σε αρχείο','Catches or trips in a file'),function(){ var d=B.dataCards(); sheetOf(T('Εξαγωγή σε Excel (CSV)','Export to Excel (CSV)'),h('div',null,d[0])); }):null,
    (dcs&&dcs[2])||dm?row('ck',T('Έλεγχος και συμπλήρωση δεδομένων','Check and fill in data'),T('Ασυνέπειες, καιρός σε παλιά ψάρια','Inconsistencies, weather for old catches'),function(){ var d=B.dataCards?B.dataCards():null, m=dataCard(); sheetOf(T('Έλεγχος και συμπλήρωση','Check and fill in'),h('div',null,d&&d[2]?d[2]:null,m||null)); }):null]));
  if(s) page.append(dangerCard());
}
/* ---------- λογαριασμός ---------- */
function accountCard(s){
  var c=h('section',{class:'card acc'}), st=C().state();
  var nm=(s.name||'').trim(), ch=(nm||s.email||'?').charAt(0).toUpperCase();
  c.append(h('h2',{text:T('Λογαριασμός','Account')}),h('p',{class:'sub accmail',text:s.email||''}));
  var ni=h('input',{type:'text',maxlength:'40',value:nm,placeholder:T('Το όνομά σου','Your name'),autocomplete:'name','aria-label':T('Όνομα','Name')});
  c.append(h('div',{class:'inrow'},ni,h('button',{class:'btn',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ C().setName(ni.value.trim()).then(function(){ B.toast(T('Το όνομα αποθηκεύτηκε.','Name saved.')); draw(); }).catch(function(e){ B.toast(C().errText(e)); }); }})));
  /* η ώρα συγχρονισμού φαίνεται ήδη στην κεφαλίδα· εδώ μόνο πρόοδος ή σφάλμα */
  var sm=h('p',{class:'sub syncmsg'+(st.err?' bad':''),hidden:!st.err,text:st.err?st.msg:''});
  var sb=h('button',{class:'btn full',type:'button',html:B.iconSvg('refresh')+'<span>'+T('Συγχρονισμός τώρα','Sync now')+'</span>',onclick:function(){ sb.disabled=true; C().sync(true).then(function(){ sb.disabled=false; draw(); }); }});
  c.append(sm,sb);
  return c;
}
/* αποσύνδεση και διαγραφή: χωριστά, στο τέλος της καρτέλας */
function dangerCard(){ var c=h('section',{class:'card accx'});
  c.append(h('button',{class:'btn full out',type:'button',text:T('Αποσύνδεση','Sign out'),onclick:signOutSheet}));
  c.append(h('button',{class:'linkbtn danger',type:'button',text:T('Διαγραφή λογαριασμού','Delete account'),onclick:delAccount}));
  return c;
}
function signInCard(){ var c=h('section',{class:'card acc'}); c.append(B.authForm({done:draw})); return c; } /* 1.4.0: account.js */

/* συμπλήρωση δεδομένων παλιών ψαριών (ίδιες λειτουργίες με την κλασική: ιστορικός καιρός, πίεση και άνεμος ±30′) */
function dataCard(){ var rows=(window.AlkyonSeaRows||[]).map(function(f){ try{ return f(); }catch(e){ return null; } }).filter(Boolean); if(!rows.length) return null;
  var c=h('section',{class:'card seafill'},h('h2',{text:T('Συμπλήρωση δεδομένων','Fill in missing data')}),h('p',{class:'sub',style:{margin:'-4px 0 6px'},text:T('Για ψάρια με θέση που καταγράφηκαν χωρίς καιρό. Εκτίμηση μοντέλου (Open-Meteo), όχι μέτρηση.','For catches with a position that were logged without weather. A model estimate (Open-Meteo), not a measurement.')}));
  rows.forEach(function(r){ c.append(r); }); return c; }
function backupCard(){
  var lb=ls.get('alkyon-lastbackup',0), c=h('section',{class:'card'},h('h2',{text:T('Αντίγραφο ασφαλείας','Backup')}),
    h('p',{class:'sub',style:{margin:'-4px 0 12px'},text:T('Όλα τα δεδομένα σου με τις φωτογραφίες σε ένα αρχείο, για επαναφορά σε άλλο κινητό. ','All your data and photos in one file, to restore on another phone. ')+(lb?T('Τελευταίο: ','Last: ')+new Date(lb).toLocaleDateString(EN?'en-GB':'el-GR'):T('Δεν έχεις κάνει ακόμα αντίγραφο.','You have not made one yet.'))}));
  var file=h('input',{type:'file',accept:'application/json,.json',class:'vh'});
  var ex=h('button',{class:'btn pri',type:'button',text:T('Δημιουργία αντιγράφου','Create backup'),onclick:function(){ ex.disabled=true; B.backup.exportAll().then(function(){ ex.disabled=false; B.toast(T('Το αντίγραφο κατέβηκε.','Backup downloaded.')); draw(); }).catch(function(){ ex.disabled=false; B.toast(T('Το αντίγραφο απέτυχε.','Backup failed.')); }); }});
  var im=h('button',{class:'btn',type:'button',text:T('Επαναφορά από αρχείο','Restore from file'),onclick:function(){ file.click(); }});
  file.addEventListener('change',function(){ var f=file.files&&file.files[0]; file.value=''; if(!f) return; B.backup.importFile(f).then(function(n){ B.toast(T('Επαναφέρθηκαν ','Restored ')+n+T(' εγγραφές.',' records.')); }).catch(function(){ B.toast(T('Το αρχείο δεν διαβάστηκε.','The file could not be read.')); }); });
  c.append(h('div',{class:'acts'},ex,im),file);
  if(B.cloudBackupRow) c.append(B.cloudBackupRow()); /* v31z550 */
  return c;
}
B.view('profile',{title:T('Προφίλ','Profile'),mount:function(el){ root=el; draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
B.on('sync',function(){ if(!root) return; var st=C().state(), busy=/…$/.test(st.msg||''), m=root.querySelector('.syncmsg');
  if(m){ m.hidden=!(busy||st.err); m.textContent=(busy||st.err)?st.msg:''; m.classList.toggle('bad',!!st.err); }
  if(!busy){ var hd=root.querySelector('.phead'); if(hd) try{ hd.replaceWith(head(C().session())); }catch(e){} } });
B.on('store',function(k){ if(root&&k==='alkyon-sess') draw(); });
})();
