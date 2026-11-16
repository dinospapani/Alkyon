/* Alkyon 4 · 1.14.31: όριο ποσότητας ανά έξοδο (Κύπρος, «Όροι Έκδοσης Ερασιτεχνικής Άδειας Αλιείας 2026»)
   Σκάφος/ακτή: 10 kg, ή 5 kg + 1 ψάρι (ένα μεγάλο ψάρι μπορεί να περάσει τα 10)· ψαροντούφεκο: 5 kg + 1· ορφός και συναγρίδα: 1 το καθένα.
   Μετρούν τα ψάρια που κράτησες σε αυτή την έξοδο (όχι όσα άφησες ελεύθερα, τα χαμένα και τους λαγοκέφαλους).
   Το όριο του σκάφους είναι για ΟΛΟΥΣ στο σκάφος· η εφαρμογή βλέπει μόνο τα δικά σου. Ενδεικτικό: ισχύει ό,τι λένε οι όροι της άδειας. */
(function(){
var B=window.AK, T=B.T;
var ONE=[[/^epinephelus marginatus$/,/ορφ[οό]ς|dusky grouper/i,T('ορφός','dusky grouper')],[/^dentex dentex$/,/συναγρ[ιί]δα|common dentex/i,T('συναγρίδα','common dentex')]];
function inCy(p){ return p&&typeof p.lat==='number'&&p.lat>34.4&&p.lat<35.8&&p.lon>32.1&&p.lon<34.7; }
function la(b){ return String(b.latin||'').toLowerCase(); }
function kept(b){ return b&&!b.miss&&!b.rel&&!b.deleted&&!b.gear&&!(B.pest&&B.pest(b)); }
/* tripId: η τρέχουσα έξοδος· extra: η καταχώρηση που γράφεις τώρα ({kg,latin,species,rel}), skip: id που αντικαθίσταται (επεξεργασία) */
function of(tripId,extra,skip){ if(!tripId) return null; var bs=[]; try{ bs=B.store.raw('bites').filter(function(b){ return b.trip===tripId&&b.id!==skip&&kept(b); }); }catch(e){}
  if(extra&&kept(extra)) bs.push(extra);
  var pos=null; for(var i=0;i<bs.length&&!pos;i++) if(typeof bs[i].lat==='number') pos=bs[i]; if(!pos&&B.lastPos) pos=B.lastPos(); if(!inCy(pos)) return null;
  var spear=(B.prof&&B.prof())==='spear', kgs=bs.map(function(b){ return +b.kg||0; }), tot=kgs.reduce(function(a,b){ return a+b; },0), mx=kgs.length?Math.max.apply(null,kgs):0;
  var cap=spear?5:10, over=spear?(tot-mx>5):(tot>10&&tot-mx>5), near=!over&&(spear?tot-mx>4:tot>8&&tot-mx>4);
  var one=ONE.map(function(o){ var n=bs.filter(function(b){ return o[0].test(la(b))||o[1].test(b.species||''); }).length; return {name:o[2],n:n}; }).filter(function(x){ return x.n>=1; });
  return {kg:Math.round(tot*10)/10,cap:cap,spear:spear,over:over,near:near,n:bs.length,one:one,oneOver:one.filter(function(x){ return x.n>1; })}; }
function text(r){ if(!r) return ''; var s=T('Κρατημένα σε αυτή την έξοδο: ','Kept on this trip: ')+B.num(r.kg,1)+' kg'+(r.spear?T(' (όριο 5 kg + 1 ψάρι)',' (limit 5 kg + 1 fish)'):T(' (όριο 10 kg, ή 5 kg + 1 ψάρι, ανά σκάφος)',' (limit 10 kg, or 5 kg + 1 fish, per boat)'));
  if(r.oneOver.length) return '⚠ '+r.oneOver.map(function(x){ return x.n+' '+x.name; }).join(', ')+T(': επιτρέπεται 1 ανά έξοδο. ',': only 1 allowed per trip. ')+s;
  if(r.over) return '⚠ '+T('Πέρασες το όριο ποσότητας. ','Over the bag limit. ')+s;
  if(r.near) return '⚠ '+T('Κοντά στο όριο. ','Close to the limit. ')+s;
  return s; }
B.bag={of:of,text:text};
/* 1.14.35: άνοιγμα του Οδηγού σε ενότητα / είδος από οπουδήποτε (ο Οδηγός φορτώνεται όταν ανοίξει) */
/* 1.14.37: (i) εξήγηση που ανοίγει με πάτημα, για να μένουν οι κάρτες καθαρές */
B.infoAdd=function(head,text){ if(!head||!text) return null; var panel=typeof text==='string'?B.h('p',{class:'sub infot',hidden:true,text:text}):text; panel.hidden=true; if(panel.classList) panel.classList.add('infot');
  var btn=B.h('button',{class:'infob',type:'button','aria-expanded':'false','aria-label':T('Τι δείχνει αυτό','What this shows'),title:T('Τι δείχνει αυτό','What this shows'),onclick:function(ev){ ev.stopPropagation(); ev.preventDefault(); /* 1.14.53: αν ο τίτλος είναι σε οριζόντια σειρά (τίτλος + κουμπί δεξιά), η επεξήγηση βγαίνει κάτω από τη σειρά, όχι δίπλα στον τίτλο */ try{ var par=panel.parentElement, cs=par&&getComputedStyle(par); if(cs&&/flex/.test(cs.display)&&!/column/.test(cs.flexDirection)&&!par.matches('summary')) par.after(panel); }catch(x){} panel.hidden=!panel.hidden; btn.setAttribute('aria-expanded',String(!panel.hidden)); }},B.h('span',{text:'i'}));
  head.append(btn); head.after(panel); return panel; };
B.guideGo=function(tab,q){ try{ B.ls.set('alkyon-v4-guidego',{tab:tab||'species',q:q||'',t:Date.now()}); }catch(e){} if(location.hash==='#guide'&&B.guideApply) B.guideApply(); else location.hash='#guide'; };
})();
