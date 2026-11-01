/* BiteCast 4 · φόρμα ψαριού (νέο ή επεξεργασία). Γράφει στην ίδια μορφή με την κλασική και συγχρονίζεται. */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
function st(){ return B.store; }
function pad(n){ return B.pad(n); }
function nowLocal(){ var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes()); }
function km(a,b,c,d){ var dy=(a-c)*111.2, dx=(b-d)*111.2*Math.cos(a*Math.PI/180); return Math.sqrt(dx*dx+dy*dy); }
function nearSpot(lat,lon){ var best=null; st().raw('spots').forEach(function(s){ if(typeof s.lat!=='number') return; var k=km(lat,lon,s.lat,s.lon); if(k<=0.3&&(!best||k<best.k)) best={s:s,k:k}; }); return best&&best.s; }
function uniq(a){ var m={}, o=[]; a.forEach(function(x){ x=String(x||'').trim(); if(!x) return; var k=x.toLowerCase(); if(m[k]) { m[k].n++; return; } m[k]={v:x,n:1}; o.push(m[k]); }); return o.sort(function(a,b){ return b.n-a.n; }).map(function(x){ return x.v; }); }
/* τεχνικές: ίδια λίστα με την κλασική (techs.js) ανά τύπο ψαρέματος, και οι δικές σου (psaro-customtech). Αποθηκεύεται η ελληνική τιμή, όπως στην κλασική. */
var TECH={boat:[['Βυθού','Bottom fishing'],['Καθετή ρηχή','Shallow vertical'],['Καθετή βαθιά','Deep vertical'],['Τρόλινγκ','Trolling'],['Συρτή αφρού','Surface trolling'],['Συρτή βυθού','Deep / bottom trolling'],['Jigging','Jigging'],['Slow jigging','Slow jigging'],['Tai Rubber','Tai Rubber'],['Tenya','Tenya'],['Ika Metal','Ika Metal'],['Καλαμαριέρα','Squid jigging'],['Spinning','Spinning'],['Ζωντανό δόλωμα','Live bait'],['Drifting','Drifting'],['Με πλωτήρα','Float fishing'],['Light / ultralight','Light / ultralight']],
  shore:[['Surf casting','Surf casting'],['Spinning από στεριά','Shore spinning'],['Βυθού από στεριά','Shore bottom fishing'],['Με πλωτήρα από στεριά','Shore float fishing'],['Καλαμαριέρα','Squid jigging'],['Light / ultralight','Light / ultralight'],['Jigging','Jigging'],['Βυθού','Bottom fishing'],['Ζωντανό δόλωμα','Live bait']],
  lake:[['Με πλωτήρα','Float fishing'],['Βυθού με δόλωμα','Bottom with bait'],['Spinning','Spinning'],['Ζωντανό δόλωμα','Live bait'],['Fly fishing','Fly fishing']],
  spear:[['Αναμονή','Ambush (hovering)'],['Περιπλάνηση','Searching / roaming'],['Τρύπες και φωλιές','Holes and ledges'],['Βαθιά κατάδυση','Deep dive']]};
function techList(prof,used){ var d=h('datalist',{id:'bfTech'}), seen={}; function add(v,l){ if(!v||seen[v]) return; seen[v]=1; d.append(h('option',{value:v,label:l&&l!==v?l:null})); }
  (TECH[prof]||TECH.boat).forEach(function(x){ add(x[0],EN?x[1]:null); }); (ls.get('psaro-customtech',[])||[]).forEach(function(x){ add(x); }); used.slice(0,30).forEach(function(x){ add(x); }); return d; }
function rememberTech(v){ v=String(v||'').trim(); if(!v) return; var known=false; Object.keys(TECH).forEach(function(k){ TECH[k].forEach(function(x){ if(x[0]===v||x[1]===v) known=true; }); }); if(known) return;
  var a=ls.get('psaro-customtech',[])||[]; if(a.map(function(x){ return x.toLowerCase(); }).indexOf(v.toLowerCase())<0){ a.push(v.slice(0,40)); ls.set('psaro-customtech',a); } }
function datalist(id,items){ var d=h('datalist',{id:id}); items.slice(0,80).forEach(function(v){ d.append(h('option',{value:v})); }); return d; }
function field(label,input,hint){ return h('label',{class:'fld'},h('span',{text:label}),input,hint?h('small',{text:hint}):null); }

/* συνθήκες της ώρας (για ψάρι που καταγράφεται τώρα ή πριν λίγο): από την πρόγνωση που είναι ήδη αποθηκευμένη */
function condFor(lat,lon,date,time){
  var fc=ls.get('psaro-fc7',null), out={}; if(!fc||!fc.fc||!fc.fc.days) return out;
  var pl=(ls.get('psaro-places',[])||[]).concat([B.lastPos()?{id:'gps',lat:B.lastPos().lat,lon:B.lastPos().lon}:null]).filter(Boolean).filter(function(p){ return p.id===fc.id; })[0];
  if(pl&&lat!=null&&km(lat,lon,pl.lat,pl.lon)>30) return out;
  var d=fc.fc.days.filter(function(x){ return x.date===date; })[0]; if(!d) return out;
  var q=(d.hours||[]).filter(function(x){ return x.hr===+time.slice(0,2); })[0]; if(!q) return out;
  ['wind','wave','gust','temp','sst','ptrend','cloud'].forEach(function(k){ if(q[k]!=null) out[k]=q[k]; }); if(q.pres!=null) out.press=Math.round(q.pres*10)/10; if(q.dir!=null) out.wdeg=Math.round(q.dir); if(q.period!=null) out.wavePeriod=q.period;
  return out;
}

/* εξοπλισμός: ίδιοι τύποι και ίδιο φιλτράρισμα με την κλασική (ψαροντούφεκο / καλάμι, θάλασσα / λίμνη) */
var SPEARTY=['gun','shaft','band','float','fins','mask','suit','weights','knife','watch','set','other'], ANGTY=['rod','reel','line','leader','lure','hook','acc','set','other'];
var TYN={rod:T('Καλάμι','Rod'),reel:T('Μουλινέ','Reel'),line:T('Νήμα','Line'),leader:'Leader',lure:T('Τεχνητό','Lure'),hook:T('Αγκίστρι','Hook'),acc:T('Αξεσουάρ','Accessory'),gun:T('Ψαροντούφεκο','Speargun'),shaft:T('Ακόντιο','Shaft'),band:T('Λάστιχο','Band'),float:T('Σημαδούρα','Float'),fins:T('Πέδιλα','Fins'),mask:T('Μάσκα','Mask'),suit:T('Στολή','Wetsuit'),weights:T('Βάρη','Weights'),knife:T('Μαχαίρι','Knife'),watch:T('Ρολόι','Watch'),set:T('Σετ','Set'),other:T('Άλλο','Other')};
function famOf(p){ return p==='spear'?'spear':p==='lake'?'lake':'sea'; }
function tackleFor(prof){ var sp=prof==='spear', ty=sp?SPEARTY:ANGTY;
  return st().raw('tackle').filter(function(x){ if(x.deleted||ty.indexOf(x.type||'other')<0) return false; if(prof==='lake'&&x.water==='sea') return false; if((prof==='boat'||prof==='shore')&&x.water==='fresh') return false; return true; })
    .sort(function(a,b){ return ty.indexOf(a.type)-ty.indexOf(b.type)||String(a.name).localeCompare(String(b.name)); }); }
function lastTk(prof){ var fm=famOf(prof), bs=st().raw('bites').filter(function(b){ return b.tk&&b.tk.length&&famOf(b.prof||'boat')===fm; }).sort(function(a,b){ return (b._u||0)-(a._u||0); }); return bs[0]?bs[0].tk.slice():[]; }

B.biteForm=function(edit,opt){
  var S=st(), all=S.bites(), e=edit||null, photos=[], phDirty=false, prof=e&&e.prof||B.prof(), gearIt=opt&&opt.gear||(e&&e.gear&&B.gearOf?B.gearOf(e.gear):null);
  var miss=h('input',{type:'checkbox',checked:!!(e?e.miss:opt&&opt.miss)});
  /* εξοπλισμός */
  var tkItems=tackleFor(prof), tkSel=e?(e.tk||[]).slice():lastTk(prof), tkBox=h('div',{class:'tkchips'}), tkDet=h('div',{class:'tkdet'}), tkSug=h('small',{class:'wn tksug'});
  var tkw=Object.assign({},e&&e.tkw||{}), tks=Object.assign({},e&&e.tks||{});
  /* βάρος του τεχνητού και μέγεθος αγκιστριού που χρησιμοποίησες (ίδια πεδία με την κλασική: tkw, tks, tkh) */
  function drawDet(){ tkDet.replaceChildren(); var W=B.tackleW||function(g){ return g+' g'; };
    tkItems.forEach(function(x){ if(tkSel.indexOf(x.id)<0) return; var opts=x.type==='lure'&&x.w&&x.w.length>1?x.w:x.type==='hook'&&x.sz&&x.sz.length>1?x.sz:null; if(!opts) return; var map=x.type==='lure'?tkw:tks;
      var row=h('div',{class:'tkchips'},h('small',{class:'tkdl',text:x.name+':'})); opts.forEach(function(v){ row.append(h('button',{type:'button',class:'chip sm','aria-pressed':String(map[x.id]===v),text:x.type==='lure'?W(v):String(v),onclick:function(){ if(map[x.id]===v) delete map[x.id]; else map[x.id]=v; drawDet(); }})); }); tkDet.append(row); }); }
  function sugTk(){ var G=window.TACKLE_GUIDE, la=(typeof latinOf==='function')?latinOf(sp.value):null, g=G&&la&&G[la]; tkSug.textContent=''; if(!g||prof==='spear') return;
    var hits=tkItems.filter(function(x){ return x.type==='lure'&&x.kind&&g.k.indexOf(x.kind)>=0; }).slice(0,3).map(function(x){ return x.name; });
    tkSug.textContent='💡 '+(hits.length?T('Από τα δικά σου ταιριάζουν: ','From your tackle: ')+hits.join(', '):T('Συνήθως: ','Usually: ')+g.k.slice(0,3).map(B.tackleKind||String).join(', '))+(g.w&&g.w[1]>0?' · '+(B.tackleW?B.tackleW(g.w[0]).split(' ')[0]+'–'+B.tackleW(g.w[1]):g.w[0]+'–'+g.w[1]+' g'):''); }
  function drawTk(){ drawDet(); tkBox.replaceChildren(); if(!tkItems.length){ tkBox.append(h('small',{class:'wn',text:T('Δεν έχεις καταχωρίσει εξοπλισμό. Τον προσθέτεις στο Προφίλ › Εξοπλισμός.','You have not added any tackle. Add it in Profile › Tackle.')})); return; }
    tkItems.forEach(function(x){ var on=tkSel.indexOf(x.id)>=0; tkBox.append(h('button',{type:'button',class:'chip','aria-pressed':String(on),onclick:function(){ var i=tkSel.indexOf(x.id); if(i>=0) tkSel.splice(i,1); else tkSel.push(x.id); drawTk(); }},h('small',{text:(TYN[x.type]||'')+' '}),x.name||'')); }); }
  drawTk();
  var sp=h('input',{type:'text',list:'bfSp',required:true,autocomplete:'off',enterkeyhint:'next',placeholder:T('π.χ. Λαβράκι','e.g. Sea bass')});
  var many=h('input',{type:'checkbox'}), cnt=h('input',{type:'number',min:'2',max:'999',inputmode:'numeric',placeholder:'2'});
  var kg=h('input',{type:'number',step:'0.01',min:'0',inputmode:'decimal',placeholder:'0,0'}), len=h('input',{type:'number',step:'0.5',min:'0',inputmode:'decimal',placeholder:'cm'}), dep=h('input',{type:'number',step:'0.5',min:'0',inputmode:'decimal',placeholder:'m'});
  var when=h('input',{type:'datetime-local',value:nowLocal()});
  var bait=h('input',{type:'text',list:'bfBait',autocomplete:'off'}), tech=h('input',{type:'text',list:'bfTech',autocomplete:'off'});
  var notes=h('textarea',{rows:'2'}), rel=h('input',{type:'checkbox'}), priv=h('input',{type:'checkbox'});
  var where=h('select',{class:'select'}), whereNote=h('small',{class:'wn'});
  var pos=null;
  where.append(h('option',{value:'gps',text:T('Η θέση μου τώρα (GPS)','My position now (GPS)')}));
  if(e&&typeof e.lat==='number') where.append(h('option',{value:'keep',text:T('Όπως ήταν','As it was')+(e.place?': '+e.place:'')}));
  if(!e&&opt&&opt.at) where.append(h('option',{value:'at',text:T('Το σημείο που διάλεξες στον χάρτη','The point you picked on the map')}));
  where.append(h('option',{value:'none',text:T('Χωρίς θέση','No position')}));
  S.raw('spots').filter(function(x){ return typeof x.lat==='number'; }).forEach(function(x){ where.append(h('option',{value:'s:'+x.id,text:'★ '+(x.name||T('Σημείο','Spot'))})); });
  if(e) where.value=typeof e.lat==='number'?'keep':'none';
  function locNow(){ whereNote.textContent=T('Βρίσκω τη θέση σου…','Finding your position…'); return B.locate(8000).then(function(p){ pos=p; if(!p){ whereNote.textContent=T('Δεν βρέθηκε θέση. Διάλεξε σημείο ή «Χωρίς θέση».','No position found. Pick a spot or “No position”.'); return; }
    var ns=nearSpot(p.lat,p.lon); whereNote.textContent=ns?T('Κοντά στο σημείο σου «','Near your spot “')+ns.name+T('». Θα αποθηκευτεί εκεί.','”. It will be saved there.'):p.lat.toFixed(5)+', '+p.lon.toFixed(5); }); }
  where.addEventListener('change',function(){ if(where.value==='gps') locNow(); else whereNote.textContent=''; });
  if(!e&&opt&&opt.at){ where.value='at'; whereNote.textContent=window.PsaroCoord?PsaroCoord.fmt(opt.at.lat,opt.at.lon):opt.at.lat.toFixed(5)+', '+opt.at.lon.toFixed(5); }
  var locP=!e&&!(opt&&opt.at)?locNow():Promise.resolve();
  /* φωτογραφίες */
  var phBox=h('div',{class:'phs'}), file=h('input',{type:'file',accept:'image/*',multiple:true,class:'vh'});
  var addPh=h('button',{type:'button',class:'phadd','aria-label':T('Προσθήκη φωτογραφίας','Add photo'),html:B.iconSvg('plus'),onclick:function(){ file.click(); }});
  function drawPh(){ phBox.replaceChildren(); photos.forEach(function(b,i){ var u=URL.createObjectURL(b); phBox.append(h('div',{class:'ph'},h('img',{src:u,alt:''}),h('button',{type:'button',class:'phx','aria-label':T('Αφαίρεση φωτογραφίας','Remove photo'),text:'✕',onclick:function(){ photos.splice(i,1); phDirty=true; drawPh(); }}))); }); phBox.append(addPh); }
  file.addEventListener('change',function(){ var fs=[].slice.call(file.files||[]); file.value=''; Promise.all(fs.map(function(f){ return S.resize(f).catch(function(){ return null; }); })).then(function(bl){ bl.filter(Boolean).forEach(function(b){ photos.push(b); }); phDirty=true; drawPh(); }); });
  drawPh();
  /* επεξεργασία: γέμισμα */
  if(e){ sp.value=e.species||''; if(+e.cnt>1){ many.checked=true; cnt.value=e.cnt; } kg.value=e.kg!=null?e.kg:''; len.value=e.len!=null?e.len:''; dep.value=e.depth!=null?e.depth:'';
    when.value=(e.date||'')+'T'+(e.time||'12:00'); bait.value=e.bait||''; tech.value=e.tech||''; notes.value=e.notes||''; rel.checked=!!e.rel; priv.checked=!!e.priv;
    Promise.all(S.phKeys(e).map(function(k){ return S.Photos.get(k).catch(function(){ return null; }); })).then(function(bl){ photos=bl.filter(Boolean).concat(photos); drawPh(); }); }
  var cntRow=h('div',{class:'inl',hidden:!many.checked},field(T('Πόσα ψάρια','How many'),cnt));
  many.addEventListener('change',function(){ cntRow.hidden=!many.checked; if(many.checked) cnt.focus(); });
  var sizeRow=null; miss.addEventListener('change',function(){ if(sizeRow) sizeRow.hidden=miss.checked; });
  /* σε ποια έξοδο ανήκει (αλλαγή εκ των υστέρων, όπως στην κλασική) */
  var tripSel=null, tsel=null;
  if(e){ var trs=S.raw('trips').filter(function(t){ return !t.deleted&&t.sid; }).sort(function(a,b){ return (b.startMs||0)-(a.startMs||0); }).slice(0,40);
    tsel=h('select',{class:'select'}); tsel.append(h('option',{value:'',text:T('Καμία έξοδος','No trip')}));
    trs.forEach(function(t){ var d=t.startMs?new Date(t.startMs):null; tsel.append(h('option',{value:t.sid,text:(t.date||'')+(d?' '+B.pad(d.getHours())+':'+B.pad(d.getMinutes()):'')+(t.spot?' · '+t.spot:'')})); });
    if(e.trip&&!trs.some(function(t){ return t.sid===e.trip; })) tsel.append(h('option',{value:e.trip,text:T('Τρέχουσα / άλλη έξοδος','Current / other trip')}));
    tsel.value=e.trip||''; tripSel=field(T('Έξοδος','Trip'),tsel); }
  /* ελάχιστο νόμιμο μέγεθος και προειδοποιήσεις (ίδιοι κανόνες με την κλασική: rules.js, Τμήμα Αλιείας) */
  var lawNote=h('p',{class:'lawnote',hidden:true,role:'status'});
  function latinOf(name){ var n=String(name||'').trim().toLowerCase(); if(!n) return ''; var kb=(window.SPKB||[]).filter(function(k){ return k.n.toLowerCase()===n||(k.en||'').toLowerCase()===n; })[0]; if(kb) return kb.l;
    var r=(window.SPECIES_DB||[]).filter(function(x){ return (x[0]&&String(x[0]).toLowerCase().split(/\s*\/\s*/).indexOf(n)>=0)||(x[1]&&x[1].toLowerCase()===n); })[0]; return r?r[2]:''; }
  function minOf(la){ var M=window.MIN_SIZES||{}; if(!la) return 0; if(M[la]) return M[la]; var g=la.split(' ')[0]; if(g==='Chelon'||g==='Liza'||g==='Oedalechilus') return M['Mugil spp.']||0; return M[g+' spp.']||M[g+' sp.']||0; }
  function law(){ var la=latinOf(sp.value), L=+len.value||0, mn=minOf(la), t='', warn=false;
    if(la==='Thunnus thynnus'||la==='Xiphias gladius'){ t=T('Απαγορεύεται η κράτηση (ερασιτεχνική αλιεία).','Not allowed to keep (recreational).'); warn=true; }
    else if(la==='Lagocephalus sceleratus'){ t=T('⚠ Τοξικός. Μην τον φας και μην τον δώσεις.','⚠ Toxic. Do not eat it or give it away.'); warn=true; }
    else if(mn){ t=T('Ελάχιστο επιτρεπόμενο μέγεθος: ','Minimum legal size: ')+mn+' cm'; if(L&&L<mn){ t='⚠ '+t+T(' – κάτω από το όριο, ελευθέρωσέ το.',' – under the limit, release it.'); warn=true; } }
    if(/καρχαρ|γαλεο|σκυλοψαρ|σαλαχ|τρυγον|βατοσ|βατος|shark|\bray\b|skate|stingray/i.test(sp.value||'')){ t=T('⚠ Καρχαρίες και σαλάχια δεν επιτρέπονται ως ερασιτεχνικό αλίευμα: ελευθέρωσέ τα (δευτερογενής πηγή).','⚠ Sharks and rays are not allowed as recreational catch: release them (secondary source).'); warn=true; }
    lawNote.textContent=t; lawNote.hidden=!t||miss.checked; lawNote.classList.toggle('warn',warn); }
  sp.addEventListener('input',law); sp.addEventListener('change',sugTk); if(!window.TACKLE_GUIDE&&prof!=='spear'){ var gs=document.createElement('script'); gs.src='../tackle-guide.js'; gs.onload=sugTk; document.head.appendChild(gs); } len.addEventListener('input',law); miss.addEventListener('change',law);
  var err=h('p',{class:'err',role:'alert'});
  var save=h('button',{class:'btn pri full',type:'submit',text:e?T('Αποθήκευση αλλαγών','Save changes'):T('Αποθήκευση','Save')});
  var form=h('form',{class:'bform',novalidate:true},
    datalist('bfSp',uniq(all.map(function(b){ return b.species; }).concat((window.SPKB||[]).map(function(k){ return EN&&k.en?k.en:k.n; })))),
    datalist('bfBait',uniq(all.map(function(b){ return b.bait; }))),techList(prof,uniq(all.map(function(b){ return b.tech; }))),
    !e&&B.voice&&B.voice.ok?h('button',{class:'btn micbtn',type:'button',html:B.voice.MIC+'<span>'+T('Πες το','Say it')+'</span>',onclick:function(){ B.voice.fill(applyVoice); }}):null,
    gearIt?h('p',{class:'gearnote',text:T('Εργαλείο: ','Gear: ')+(gearIt.name||'')}):null,
    h('label',{class:'tg'},miss,h('span',{text:T('Χάθηκε: τσίμπησε αλλά δεν το έβγαλα','Lost: it bit but I did not land it')})),
    field(T('Είδος','Species'),sp,T('Για χαμένο ψάρι είναι προαιρετικό.','Optional for a lost fish.')),
    B.speciesPick?h('button',{class:'linkbtn',type:'button',text:'📖 '+T('Διάλεξε από τη λίστα ειδών','Pick from the species list'),onclick:function(){ B.speciesPick(function(nm){ sp.value=nm; law(); }); }}):null,
    lawNote,
    h('label',{class:'tg'},many,h('span',{text:T('Πολλά ψάρια μαζί (μία εγγραφή)','Several fish together (one entry)')})),cntRow,
    (sizeRow=h('div',{class:'g3',hidden:miss.checked},field(T('Βάρος (kg)','Weight (kg)'),kg),field(T('Μήκος (cm)','Length (cm)'),len),field(T('Βάθος (m)','Depth (m)'),dep))),
    field(T('Πότε','When'),when),
    h('label',{class:'fld'},h('span',{text:T('Πού','Where')}),where,whereNote),
    h('div',{class:'g2'},field(T('Δόλωμα','Bait'),bait),field(T('Τεχνική','Technique'),tech)),
    h('div',{class:'fld'},h('span',{text:T('Εξοπλισμός','Tackle')}),tkBox,tkDet,tkSug),
    h('div',{class:'fld'},h('span',{text:T('Φωτογραφίες','Photos')}),phBox,file),
    B.aiButton&&B.aiOn()?B.aiButton(function(){ return photos[0]||null; },function(nm){ sp.value=nm; law(); }):null,
    field(T('Σημειώσεις','Notes'),notes),
    tripSel,
    h('label',{class:'tg'},rel,h('span',{text:T('Το άφησα ελεύθερο','I released it')})),
    h('label',{class:'tg'},priv,h('span',{text:T('Ιδιωτικό: δεν το βλέπουν οι φίλοι','Private: friends cannot see it')})),
    err,save,
    e?h('button',{class:'btn full del',type:'button',text:T('Διαγραφή ψαριού','Delete catch'),onclick:function(){ B.ask(T('Να διαγραφεί αυτό το ψάρι;','Delete this catch?'),T('Διαγραφή','Delete'),true).then(function(y){ if(!y) return;
      S.phKeys(e).forEach(function(k){ S.Photos.del(k).catch(function(){}); }); S.remove('bites',e.id); recount(e.trip); sh.close(); B.toast(T('Το ψάρι διαγράφηκε.','Catch deleted.')); }); }}):null);
  form.addEventListener('submit',function(ev){ ev.preventDefault(); submit(); });
  function recount(sid){ if(!sid) return; var t=S.raw('trips').filter(function(x){ return x.sid===sid; })[0]; if(!t) return;
    var bs=S.raw('bites').filter(function(b){ return b.trip===sid&&!b.miss; }); S.save('trips',Object.assign({},t,{count:bs.reduce(function(s,b){ return s+Math.max(1,Math.floor(+b.cnt)||1); },0),kg:Math.round(bs.reduce(function(s,b){ return s+(b.rel?0:(+b.kg||0)); },0)*10)/10})); }
  function num(i){ return i.value===''?null:+i.value; }
  var rec=null;
  function submit(){
    err.textContent='';
    var name=sp.value.trim(); if(!name&&!miss.checked){ err.textContent=T('Γράψε το είδος.','Enter the species.'); sp.focus(); return; }
    if(many.checked&&!(Math.floor(+cnt.value)>=2)){ err.textContent=T('Γράψε πόσα ψάρια (2 ή περισσότερα).','Enter how many fish (2 or more).'); cnt.focus(); return; }
    var dt=when.value||nowLocal(), date=dt.slice(0,10), time=dt.slice(11,16);
    var lat=null, lon=null, place='', w=where.value;
    if(w==='gps'&&pos){ lat=pos.lat; lon=pos.lon; var ns=nearSpot(lat,lon); if(ns){ lat=ns.lat; lon=ns.lon; place=ns.name||''; } }
    else if(w==='at'&&opt&&opt.at){ lat=+opt.at.lat.toFixed(5); lon=+opt.at.lon.toFixed(5); var ns2=nearSpot(lat,lon); if(ns2){ lat=ns2.lat; lon=ns2.lon; place=ns2.name||''; } }
    else if(w==='keep'&&e){ lat=e.lat; lon=e.lon; place=e.place||''; }
    else if(w.slice(0,2)==='s:'){ var spt=S.get('spots',w.slice(2)); if(spt){ lat=spt.lat; lon=spt.lon; place=spt.name||''; } }
    var kb=(window.SPKB||[]).filter(function(k){ return k.n.toLowerCase()===name.toLowerCase()||(k.en||'').toLowerCase()===name.toLowerCase(); })[0];
    rememberTech(tech.value);
    rec=Object.assign({},e||{},{date:date,time:time,tz:-new Date().getTimezoneOffset(),species:name,latin:kb?kb.l:(e&&e.latin)||'',bait:bait.value.trim(),tech:tech.value.trim(),
      depth:num(dep),kg:num(kg),len:num(len),notes:notes.value.trim(),place:place,lat:lat,lon:lon,src:e?(e.src||'app'):'v4'});
    if(many.checked) rec.cnt=Math.floor(+cnt.value); else delete rec.cnt;
    if(miss.checked){ rec.miss=true; if(!e) rec.src='miss'; } else delete rec.miss;
    if(!e&&opt&&opt.gear){ rec.gear=opt.gear.id; rec.gearName=opt.gear.name||''; if(!rec.tech) rec.tech={ll:T('Παραγάδι','Longline'),net:T('Δίχτυ','Net'),trap:T('Ζεμπίλι / παγίδα','Trap / pot')}[opt.gear.type]||''; }
    else if(!e&&B.gearTag) B.gearTag(rec);
    var ex={}; tkItems.forEach(function(x){ ex[x.id]=1; }); var keepOther=(e&&e.tk||[]).filter(function(id){ return !ex[id]; });
    var tk=keepOther.concat(tkSel.filter(function(id){ return ex[id]; })); if(tk.length){ rec.tk=tk; var w2={},s2={},h2={}, lures=[], hooks=[]; tk.forEach(function(id){ var x=tkItems.filter(function(y){ return y.id===id; })[0]; if(!x) return; if(x.type==='lure'){ lures.push(id); if(tkw[id]!=null) w2[id]=tkw[id]; else if(x.w&&x.w.length===1) w2[id]=x.w[0]; } if(x.type==='hook'){ hooks.push(id); if(tks[id]!=null) s2[id]=tks[id]; else if(x.sz&&x.sz.length===1) s2[id]=x.sz[0]; } });
      if(lures.length&&hooks.length) lures.forEach(function(l){ h2[l]=(e&&e.tkh&&e.tkh[l]&&hooks.indexOf(e.tkh[l])>=0)?e.tkh[l]:hooks[0]; });
      if(Object.keys(w2).length) rec.tkw=w2; else delete rec.tkw; if(Object.keys(s2).length) rec.tks=s2; else delete rec.tks; if(Object.keys(h2).length) rec.tkh=h2; else delete rec.tkh; }
    else { delete rec.tk; delete rec.tkw; delete rec.tkh; delete rec.tks; }
    if(rel.checked) rec.rel=true; else delete rec.rel;
    if(priv.checked) rec.priv=true; else delete rec.priv;
    /* συνθήκες: για νέο ψάρι κοντά στην τρέχουσα ώρα */
    var ms=Date.parse(dt), recent=Math.abs(Date.now()-ms)<=90*60000, needHist=false;
    var HK=(window.PsaroHist&&window.PsaroHist.keys)||['wind','wdeg','wave','press','ptrend','cloud','temp','sst','tide'];
    var moved=e&&(e.date!==date||e.time!==time||e.lat!==lat||e.lon!==lon);
    if(!e&&recent){ var c=condFor(lat,lon,date,time); Object.keys(c).forEach(function(k){ rec[k]=c[k]; }); if(!Object.keys(c).length&&lat!=null) needHist=true; }
    else if(lat!=null&&(!e||moved||HK.every(function(k){ return e[k]==null||e[k]===''; }))) needHist=true;
    if(moved){ HK.forEach(function(k){ rec[k]=null; }); delete rec.wavePeriod; delete rec.hist; }
    /* ενεργή έξοδος (από την κλασική): σύνδεση με την έξοδο */
    if(!e){ var sf=ls.get('psaro-safe',{})||{}; if(sf.active&&sf.id){ rec.trip=sf.id; rec.n=S.raw('bites').filter(function(b){ return b.trip===sf.id&&!!b.miss===!!rec.miss; }).reduce(function(m,b){ return Math.max(m,+b.n||0); },0)+1; } }
    if(e&&tsel){ if(tsel.value&&tsel.value!==e.trip){ rec.trip=tsel.value; rec.n=S.raw('bites').filter(function(b){ return b.trip===tsel.value&&!!b.miss===!!rec.miss; }).reduce(function(m,b){ return Math.max(m,+b.n||0); },0)+1; } else if(!tsel.value){ delete rec.trip; delete rec.n; } }
    if(phDirty||!e){ rec.photo=photos.length>0; if(photos.length>1) rec.xph=photos.length-1; else delete rec.xph; }
    save.disabled=true;
    /* ιστορικός καιρός (ίδια πηγή με την κλασική: Open-Meteo, εκτίμηση μοντέλου ~25 km) */
    if(needHist&&window.PsaroHist&&navigator.onLine!==false){ save.textContent=T('Αναζήτηση καιρού…','Looking up weather…');
      window.PsaroHist.fetch(lat,lon,ms).then(function(hc){ if(hc){ HK.forEach(function(k){ if(hc[k]!=null) rec[k]=hc[k]; }); if(hc.wavePeriod!=null) rec.wavePeriod=hc.wavePeriod; if(!recent) rec.hist=true; }
        else if(!recent) B.toast(T('Δεν βρέθηκε καιρός για εκείνη την ώρα. Έμεινε κενό.','No weather found for that time. Left blank.')); }).catch(function(){}).then(store); return; }
    store();
  }
  function store(){
    var oldKeys=e?S.phKeys(e):[], id=S.save('bites',rec);
    try{ if(window.PsaroBiteWx&&!rec.gear) PsaroBiteWx.ensure(Object.assign({},rec,{id:id})); }catch(e2){}
    var p=Promise.resolve();
    if(phDirty){ photos.forEach(function(b,i){ p=p.then(function(){ return S.Photos.put(i===0?id:id+'~'+i,b); }); }); oldKeys.forEach(function(k){ var m=k.indexOf('~'), ix=m<0?0:+k.slice(m+1); if(ix>=photos.length) p=p.then(function(){ return S.Photos.del(k); }); });
      /* αλλαγμένες φωτογραφίες: να ξανανέβουν */
      var pup=ls.get('psaro-pup',{})||{}; photos.map(function(_,i){ return i===0?id:id+'~'+i; }).forEach(function(k){ delete pup[k]; }); ls.set('psaro-pup',pup); }
    p.catch(function(){}).then(function(){ recount(rec.trip); if(e&&e.trip!==rec.trip) recount(e.trip); sh.close(); B.emit('store','psaro-bites');
      B.toast(e?T('Οι αλλαγές αποθηκεύτηκαν.','Changes saved.'):rec.miss?T('Το χαμένο τσίμπημα καταγράφηκε.','Lost bite logged.'):T('Το ψάρι αποθηκεύτηκε.','Catch saved.'));
      if(B.cloud&&B.cloud.session()) B.cloud.sync(false); });
  }
  /* φωνή: συμπληρώνει είδος, κιλά, εκατοστά και την ώρα που πάτησες το μικρόφωνο */
  function applyVoice(r){ if(r.species) sp.value=r.species.disp; if(r.kg!=null) kg.value=r.kg; if(r.len!=null) len.value=r.len; law();
    if(r.t0&&Date.now()-r.t0<30*60000){ var d=new Date(r.t0); when.value=d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate())+'T'+B.pad(d.getHours())+':'+B.pad(d.getMinutes()); } }
  var sh=B.sheet({title:e?T('Επεξεργασία ψαριού','Edit catch'):T('Νέο ψάρι','New catch'),body:form,focus:e||(opt&&opt.auto)?null:'input[list=bfSp]'});
  law();
  if(!e&&opt&&opt.voice){ applyVoice(opt.voice); if(opt.auto) locP.then(function(){ submit(); }); }
};
/* γρήγορη καταγραφή κατά την έξοδο (κουμπιά στον χάρτη, όπως η κλασική): χωρίς φόρμα, με θέση, ώρα, συνθήκες και εξοπλισμό του τελευταίου ψαριού.
   Το είδος συμπληρώνεται αργότερα από το Ημερολόγιο. */
B.quickRec=function(miss,at){
  var S=st(), f=(B.trip&&B.trip.fix&&B.trip.fix())||null, p=at||(f&&Date.now()-(f.t||0)<180000?f:B.lastPos()), dt=nowLocal(), date=dt.slice(0,10), time=dt.slice(11,16);
  var rec={date:date,time:time,tz:-new Date().getTimezoneOffset(),species:'',latin:'',bait:'',tech:'',depth:null,kg:null,len:null,notes:'',place:'',lat:null,lon:null,photo:false,src:at?(miss?'miss-map':'map'):(miss?'miss':'quick'),prof:B.prof()};
  if(p){ rec.lat=+(+p.lat).toFixed(5); rec.lon=+(+p.lon).toFixed(5); var ns=nearSpot(rec.lat,rec.lon); if(ns){ rec.lat=ns.lat; rec.lon=ns.lon; rec.place=ns.name||''; } }
  if(miss) rec.miss=true;
  var tk=lastTk(B.prof()); if(tk.length&&!miss) rec.tk=tk;
  var c=condFor(rec.lat,rec.lon,date,time); Object.keys(c).forEach(function(k){ rec[k]=c[k]; });
  var sf=ls.get('psaro-safe',{})||{}; if(sf.active&&sf.id){ rec.trip=sf.id; rec.n=S.raw('bites').filter(function(b){ return b.trip===sf.id&&!!b.miss===!!miss; }).reduce(function(m,b){ return Math.max(m,+b.n||0); },0)+1; }
  if(!miss&&B.gearTag) B.gearTag(rec);
  var id=S.save('bites',rec); rec.id=id;
  try{ if(window.PsaroBiteWx) PsaroBiteWx.ensure(Object.assign({},rec,{id:id})); }catch(e){}
  if(rec.trip){ var t=S.raw('trips').filter(function(x){ return x.sid===rec.trip; })[0]; if(t){ var bs=S.raw('bites').filter(function(b){ return b.trip===rec.trip&&!b.miss&&!b.deleted; }); S.save('trips',Object.assign({},t,{count:bs.reduce(function(s2,b){ return s2+Math.max(1,Math.floor(+b.cnt)||1); },0)})); } }
  B.emit('store','psaro-bites'); B.emit('trip');
  try{ navigator.vibrate&&navigator.vibrate(25); }catch(e){}
  B.toast(miss?T('Καταγράφηκε αστοχία ✕','Miss logged ✕'):T('Ψάρι καταγράφηκε 🐟 Πρόσθεσε το είδος αργότερα από το Ημερολόγιο.','Catch logged 🐟 Add the species later from the Logbook.'));
  /* χωρίς συνθήκες από την πρόγνωση: ιστορικός καιρός στο παρασκήνιο */
  if(!Object.keys(c).length&&rec.lat!=null&&window.PsaroHist&&navigator.onLine!==false){ var HK=PsaroHist.keys||['wind','wdeg','wave','press','ptrend','cloud','temp','sst','tide'];
    PsaroHist.fetch(rec.lat,rec.lon,Date.now()).then(function(hc){ if(!hc) return; var cur=S.get('bites',id); if(!cur) return; var nx=Object.assign({},cur); HK.forEach(function(k){ if(hc[k]!=null&&nx[k]==null) nx[k]=hc[k]; }); S.save('bites',nx); }).catch(function(){}); }
  if(B.cloud&&B.cloud.session()) B.cloud.sync(false);
  return id;
};
/* η τελευταία καταγραφή αυτής της εξόδου (για διαγραφή με παρατεταμένο πάτημα) */
B.quickUndo=function(miss){
  var S=st(), sf=ls.get('psaro-safe',{})||{}; if(!sf.active) return;
  var b=S.raw('bites').filter(function(x){ return !x.deleted&&!!x.miss===!!miss&&(sf.id?x.trip===sf.id:(x._u||0)>=(sf.start||0)); }).sort(function(a,c){ return (c._u||0)-(a._u||0); })[0];
  if(!b){ B.toast(T('Δεν υπάρχει καταγραφή σε αυτή την έξοδο.','Nothing logged on this trip yet.')); return; }
  B.ask(miss?T('Να διαγραφεί η τελευταία αστοχία;','Delete the last miss?'):T('Να διαγραφεί το τελευταίο ψάρι','Delete the last catch')+(b.species?' ('+b.species+(b.kg?' '+b.kg+' kg':'')+')':'')+'?',T('Διαγραφή','Delete'),true).then(function(y){ if(!y) return;
    S.phKeys(b).forEach(function(k){ S.Photos.del(k).catch(function(){}); }); S.remove('bites',b.id); B.emit('store','psaro-bites'); B.emit('trip'); B.toast(T('Διαγράφηκε.','Deleted.')); });
};
B.tripCounts=function(){ var sf=ls.get('psaro-safe',{})||{}, n=0, m=0; if(!sf.active) return {n:0,miss:0}; st().raw('bites').forEach(function(b){ if(b.deleted||!(sf.id&&b.trip===sf.id)) return; if(b.miss) m++; else n+=Math.max(1,Math.floor(+b.cnt)||1); }); return {n:n,miss:m}; };
})();
