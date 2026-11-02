/* Κοινότητα: μοιράσου ένα ψάρι (φωτογραφία, είδος, βάρος, συνθήκες) ΧΩΡΙΣ θέση. Feed, «Μου αρέσει», σχόλια, αναφορές.
   Ποτέ δεν αποστέλλονται συντεταγμένες ή όνομα σημείου. Η φωτογραφία ξαναδημιουργείται από την αρχή (χωρίς EXIF/GPS). */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var $=function(i){ return document.getElementById(i); };
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function cloud(){ return window.AlkyonCloud; }
function logged(){ return cloud()&&cloud().logged(); }
var seg=$('logSeg'), tabLog=$('tab-log'); if(!seg||!tabLog) return;
var PAGE=15;

/* ---------- δομή: τέταρτο τμήμα στο Log ---------- */
var segBtn=el('button','',T('Κοινότητα','Community')); segBtn.type='button'; segBtn.dataset.l='comm'; segBtn.setAttribute('aria-pressed','false'); /* v31z55: το κουμπί «Κοινότητα» αφαιρέθηκε από το Ημερολόγιο (το feed δεν έχει πια είσοδο εδώ) */
var box=el('div','col'); box.id='l-comm'; box.hidden=true; var anchor=$('l-stats'); anchor.parentNode.insertBefore(box,anchor.nextSibling);
var feedState={items:[],offset:0,end:false,loading:false,mine:false,liked:{},open:{}};
Array.prototype.forEach.call(seg.querySelectorAll('button'),function(b){ b.addEventListener('click',function(){
  var on=b===segBtn; box.hidden=!on; if(on){ Array.prototype.forEach.call(seg.querySelectorAll('button'),function(x){ x.setAttribute('aria-pressed',String(x===b)); }); ['l-trips','l-bites','l-stats','l-gear'].forEach(function(id){ var n=$(id); if(n) n.hidden=true; }); if(!feedState.items.length&&!feedState.loading) load(true); render(); } }); });

/* ---------- δίκτυο ---------- */
async function rest(path,opt){ return cloud().rest(path,opt); }
function blocked(){ return C.lsGet('alkyon-comm-block',[])||[]; }
function esc(s){ return encodeURIComponent(s); }
async function load(reset){
  if(!logged()||feedState.loading) return; if(reset){ feedState.items=[]; feedState.offset=0; feedState.end=false; }
  if(feedState.end) return; feedState.loading=true; feedState.err=''; render();
  try{
    var q='community_posts?select=*,likes:community_likes(count),comments:community_comments(count)&order=created_at.desc&limit='+PAGE+'&offset='+feedState.offset+(feedState.mine?'&user_id=eq.'+esc(cloud().uid()):'');
    var r=await rest(q), arr=await r.json(); if(arr.length<PAGE) feedState.end=true; feedState.offset+=arr.length;
    var ids=arr.map(function(p){ return p.id; });
    if(ids.length){ try{ var lr=await rest('community_likes?select=post_id&user_id=eq.'+esc(cloud().uid())+'&post_id=in.('+ids.join(',')+')'); (await lr.json()).forEach(function(x){ feedState.liked[x.post_id]=1; }); }catch(e){} }
    feedState.items=feedState.items.concat(arr);
  }catch(e){ feedState.err=/HTTP 404|relation|does not exist/i.test(String(e.message))?T('Η κοινότητα δεν έχει ενεργοποιηθεί ακόμη στη βάση δεδομένων.','Community is not enabled yet in the database.'):T('Δεν φόρτωσε. Έλεγξε τη σύνδεση.','Could not load. Check your connection.'); }
  feedState.loading=false; render();
}
async function toggleLike(p){
  var on=!!feedState.liked[p.id], cnt=(p.likes&&p.likes[0]&&p.likes[0].count)||0;
  feedState.liked[p.id]=on?0:1; p.likes=[{count:Math.max(0,cnt+(on?-1:1))}]; render();
  try{ if(on) await rest('community_likes?post_id=eq.'+p.id+'&user_id=eq.'+esc(cloud().uid()),{method:'DELETE'}); else await rest('community_likes',{method:'POST',body:JSON.stringify({post_id:p.id}),headers:{Prefer:'return=minimal'}}); }
  catch(e){ feedState.liked[p.id]=on?1:0; p.likes=[{count:cnt}]; render(); C.toast(T('Δεν έγινε. Δοκίμασε ξανά.','Failed. Try again.')); }
}
async function loadComments(p){
  try{ var r=await rest('community_comments?select=*&post_id=eq.'+p.id+'&order=created_at.asc&limit=100'); p._c=await r.json(); }catch(e){ p._c=[]; p._cerr=1; }
  render();
}
async function sendComment(p,text){
  text=(text||'').trim(); if(!text) return;
  try{ await rest('community_comments',{method:'POST',body:JSON.stringify({post_id:p.id,author:authorName(),body:text.slice(0,300)}),headers:{Prefer:'return=minimal'}});
    p.comments=[{count:((p.comments&&p.comments[0]&&p.comments[0].count)||0)+1}]; await loadComments(p); }
  catch(e){ C.toast(/rate/i.test(String(e.message))?T('Πολλά σχόλια σήμερα.','Too many comments today.'):T('Το σχόλιο δεν στάλθηκε.','Comment not sent.')); }
}
function authorName(){ var n=(cloud().name()||'').trim(); return (n||T('Ψαράς','Angler')).slice(0,40); }
async function report(kind,id){
  var ok=await window.AlkyonAsk(T('Να αναφερθεί αυτό το περιεχόμενο ως ακατάλληλο;','Report this content as inappropriate?'),{title:T('Αναφορά','Report'),ok:T('Αναφορά','Report'),cancel:T('Άκυρο','Cancel')}); if(!ok) return;
  var body=kind==='post'?{post_id:id}:{comment_id:id};
  try{ await rest('community_reports',{method:'POST',body:JSON.stringify(body),headers:{Prefer:'return=minimal'}}); C.toast(T('Ευχαριστούμε. Θα ελεγχθεί.','Thanks. It will be reviewed.')); }catch(e){ C.toast(T('Δεν στάλθηκε η αναφορά.','Report not sent.')); }
}
async function delPost(p){
  var ok=await window.AlkyonAsk(T('Να διαγραφεί η ανάρτηση από την κοινότητα;','Delete this post from the community?'),{title:T('Διαγραφή','Delete'),ok:T('Διαγραφή','Delete'),cancel:T('Άκυρο','Cancel'),danger:true}); if(!ok) return;
  try{ await rest('community_posts?id=eq.'+p.id,{method:'DELETE'}); if(p.photo){ try{ await cloud().storage('DELETE','community/'+p.photo); }catch(e){} }
    feedState.items=feedState.items.filter(function(x){ return x!==p; }); var shared=C.lsGet('alkyon-comm-shared',{})||{}; Object.keys(shared).forEach(function(k){ if(shared[k]===p.id) delete shared[k]; }); C.lsSet('alkyon-comm-shared',shared); render(); decorate(); }
  catch(e){ C.toast(T('Δεν διαγράφηκε.','Not deleted.')); }
}
async function delComment(p,c){ try{ await rest('community_comments?id=eq.'+c.id,{method:'DELETE'}); p._c=(p._c||[]).filter(function(x){ return x!==c; }); p.comments=[{count:Math.max(0,((p.comments&&p.comments[0]&&p.comments[0].count)||1)-1)}]; render(); }catch(e){ C.toast(T('Δεν διαγράφηκε.','Not deleted.')); } }

/* ---------- εμφάνιση ---------- */
var MOON=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
function ago(ts){ var m=Math.round((Date.now()-Date.parse(ts))/60000); if(m<2) return T('τώρα','now'); if(m<60) return m+T('′',' min'); var h=Math.round(m/60); if(h<24) return h+T(' ώρ.',' h'); var d=Math.round(h/24); return d+T(' ημ.',' d'); }
function photoUrl(p){ return p.photo?cloud().url+'/storage/v1/object/public/community/'+p.photo:''; }
function condChips(c){
  var a=[]; c=c||{}; if(c.wind!=null) a.push('💨 '+Math.round(c.wind)+' kn'); if(c.wave!=null) a.push('🌊 '+(Math.round(c.wave*10)/10)+' m'); if(c.press!=null) a.push(Math.round(c.press)+' hPa'+(c.ptrend?' '+c.ptrend:''));
  if(c.sst!=null) a.push('🌡 '+Math.round(c.sst)+'°'); if(c.moon!=null&&MOON[c.moon]) a.push(MOON[c.moon]); return a;
}
function postEl(p){
  var mine=p.user_id===cloud().uid(), card=el('div','card cmpost');
  var hd=el('div','cmhd'); hd.append(el('b','',p.author||T('Ψαράς','Angler')),el('span','cmago',ago(p.created_at)));
  var menu=el('button','cmmore','⋯'); menu.type='button'; menu.setAttribute('aria-label',T('Περισσότερα','More')); menu.addEventListener('click',function(){
    var mi=el('div','cmmenu'); if(mine) mi.append(btn(T('Διαγραφή','Delete'),function(){ mi.remove(); delPost(p); })); else { mi.append(btn(T('Αναφορά','Report'),function(){ mi.remove(); report('post',p.id); })); mi.append(btn(T('Απόκρυψη χρήστη','Hide user'),function(){ mi.remove(); var b=blocked(); b.push(p.user_id); C.lsSet('alkyon-comm-block',b); render(); })); }
    card.appendChild(mi); }); hd.append(menu); card.append(hd);
  if(p.photo){ var im=el('img','cmimg'); im.loading='lazy'; im.alt=p.species; im.src=photoUrl(p); card.append(im); }
  var t=el('div','cmtitle'); t.append(el('b','',p.species)); var sz=[]; if(p.kg!=null) sz.push(+p.kg+' kg'); if(p.len!=null) sz.push(+p.len+' cm'); if(sz.length) t.append(el('span','cmsz',sz.join(' · '))); card.append(t);
  var meta=[]; if(p.tech) meta.push(p.tech); if(p.bait) meta.push(p.bait); if(p.day) meta.push(p.day.split('-').reverse().join('/')); if(meta.length) card.append(el('div','cmmeta',meta.join(' · ')));
  var ch=condChips(p.cond); if(ch.length){ var cr=el('div','cmchips'); ch.forEach(function(x){ cr.append(el('span','cmchip',x)); }); card.append(cr); }
  var lc=(p.likes&&p.likes[0]&&p.likes[0].count)||0, cc=(p.comments&&p.comments[0]&&p.comments[0].count)||0, act=el('div','cmact');
  var lb=el('button','cmbtn'+(feedState.liked[p.id]?' on':''),(feedState.liked[p.id]?'♥ ':'♡ ')+lc); lb.type='button'; lb.addEventListener('click',function(){ toggleLike(p); });
  var cb=el('button','cmbtn','💬 '+cc); cb.type='button'; cb.addEventListener('click',function(){ feedState.open[p.id]=!feedState.open[p.id]; if(feedState.open[p.id]&&!p._c) loadComments(p); else render(); });
  act.append(lb,cb); card.append(act);
  if(feedState.open[p.id]){
    var cm=el('div','cmcomments'); (p._c||[]).forEach(function(c){ var r=el('div','cmc'); r.append(el('b','',c.author||''),document.createTextNode(' '+c.body));
      var x=c.user_id===cloud().uid()?btn(T('Διαγραφή','Delete'),function(){ delComment(p,c); }):btn(T('Αναφορά','Report'),function(){ report('comment',c.id); }); x.className='cmlink'; r.append(x); cm.append(r); });
    if(p._cerr) cm.append(el('div','cmnote',T('Τα σχόλια δεν φόρτωσαν.','Comments did not load.')));
    var form=el('form','cmform'), inp=el('input'); inp.type='text'; inp.maxLength=300; inp.placeholder=T('Γράψε σχόλιο…','Write a comment…'); var go=el('button','btn sm',T('Αποστολή','Send')); go.type='submit'; form.append(inp,go);
    form.addEventListener('submit',function(e){ e.preventDefault(); var v=inp.value; inp.value=''; sendComment(p,v); }); cm.append(form); card.append(cm);
  }
  return card;
}
function btn(t,fn){ var b=el('button','cmitem',t); b.type='button'; b.addEventListener('click',fn); return b; }
function render(){
  if(box.hidden) return; box.replaceChildren();
  var hd=el('div','cmtop'); var h=el('div','cmseg');
  [[false,T('Όλα','All')],[true,T('Δικά μου','Mine')]].forEach(function(x){ var b=el('button','',x[1]); b.type='button'; b.setAttribute('aria-pressed',String(feedState.mine===x[0])); b.addEventListener('click',function(){ if(feedState.mine===x[0]) return; feedState.mine=x[0]; load(true); }); h.append(b); });
  var rf=el('button','btn ghost sm','↻'); rf.type='button'; rf.setAttribute('aria-label',T('Ανανέωση','Refresh')); rf.addEventListener('click',function(){ load(true); }); hd.append(h,rf); box.append(hd);
  box.append(el('div','cmnote',T('Οι αναρτήσεις δεν δείχνουν ποτέ θέση. Μοιράσου ένα ψάρι από το Log → Τσιμπήματα → «Κοινότητα».','Posts never show a location. Share a fish from Log → Bites → “Community”.')));
  if(!logged()){ box.append(el('div','empty',T('Συνδέσου στον λογαριασμό σου (εικονίδιο προφίλ) για να δεις και να μοιραστείς.','Sign in (profile icon) to view and share.'))); return; }
  var bl=blocked(), shown=feedState.items.filter(function(p){ return bl.indexOf(p.user_id)<0; });
  shown.forEach(function(p){ box.append(postEl(p)); });
  if(feedState.err) box.append(el('div','empty',feedState.err));
  else if(!shown.length&&!feedState.loading) box.append(el('div','empty',feedState.mine?T('Δεν έχεις μοιραστεί ακόμη κάτι.','You have not shared anything yet.'):T('Δεν υπάρχουν αναρτήσεις ακόμη. Ανέβασε το πρώτο ψάρι!','No posts yet. Share the first fish!')));
  if(feedState.loading) box.append(el('div','cmnote',T('Φόρτωση…','Loading…')));
  else if(!feedState.end&&shown.length){ var more=el('button','btn ghost',T('Περισσότερα','More')); more.type='button'; more.addEventListener('click',function(){ load(false); }); box.append(more); }
}

/* ---------- δημοσίευση από τα Τσιμπήματα ---------- */
function jpeg(blob){
  return new Promise(function(res,rej){
    var u=URL.createObjectURL(blob), im=new Image(); im.onload=function(){ var s=Math.min(1,1280/Math.max(im.width,im.height)), cv=document.createElement('canvas'); cv.width=Math.round(im.width*s); cv.height=Math.round(im.height*s);
      cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height); URL.revokeObjectURL(u); cv.toBlob(function(b){ b?res(b):rej(new Error('jpeg')); },'image/jpeg',0.82); }; im.onerror=function(){ URL.revokeObjectURL(u); rej(new Error('img')); }; im.src=u; });
}
function moonIdx(b){ try{ var ms=Date.parse((b.date||'')+'T'+(b.time||'12:00')+':00Z'); return window.AlkyonInsights?window.AlkyonInsights.phaseAt(ms).idx:null; }catch(e){ return null; } }
function uuid(){ return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
var ov=el('div'); ov.id='cmShare'; ov.hidden=true; document.body.appendChild(ov); ov.addEventListener('click',function(e){ if(e.target===ov) ov.hidden=true; });
async function openShare(b){
  if(!logged()){ C.toast(T('Συνδέσου πρώτα στον λογαριασμό σου.','Sign in first.')); return; }
  var shared=C.lsGet('alkyon-comm-shared',{})||{}; if(shared[b.id]){ C.toast(T('Έχει ήδη μοιραστεί.','Already shared.')); return; }
  var blob=null; if(b.photo){ try{ blob=await C.Photos.get(b.id); }catch(e){} }
  ov.replaceChildren(); var card=el('div','spcard'); var hd=el('div','sphead'); hd.append(el('b','',T('Μοίρασμα στην κοινότητα','Share to community')),(function(){ var x=el('button','spx','✕'); x.type='button'; x.addEventListener('click',function(){ ov.hidden=true; }); return x; })()); card.append(hd);
  var bd=el('div','spbody'); var inc=true;
  if(blob){ var im=el('img','cmprev'); im.src=URL.createObjectURL(blob); bd.append(im); }
  var sz=[]; if(b.kg!=null) sz.push(b.kg+' kg'); if(b.len!=null) sz.push(b.len+' cm');
  bd.append(el('div','cmtitle',(b.species||'?')+(sz.length?' · '+sz.join(' · '):'')));
  var withCond=false, ch=condChips({wind:b.wind,wave:b.wave,press:b.press,ptrend:b.ptrend,sst:b.sst,moon:moonIdx(b)});
  if(ch.length){ var cr=el('div','cmchips'); cr.hidden=true; ch.forEach(function(x){ cr.append(el('span','cmchip',x)); });
    var lb=el('label','cmcond'), cb=el('input'); cb.type='checkbox'; cb.addEventListener('change',function(){ withCond=cb.checked; cr.hidden=!withCond; }); lb.append(cb,document.createTextNode(' '+T('Να φαίνονται και οι συνθήκες (άνεμος, κύμα, πίεση)','Also show conditions (wind, waves, pressure)'))); bd.append(lb,cr); }
  bd.append(el('div','cmnote',T('Θα φαίνονται: το όνομά σου, είδος, βάρος, δόλωμα/τεχνική, ημερομηνία και η φωτογραφία (και οι συνθήκες, μόνο αν το επιλέξεις). ΔΕΝ θα φαίνεται θέση ή όνομα σημείου. Πρόσεξε να μη δείχνει η φωτογραφία χαρακτηριστικό τοπίο.','Visible: your name, species, weight, bait/technique, date and the photo (conditions only if you tick the option). NO location or spot name is shared. Make sure the photo does not show a recognisable landmark.')));
  var row=el('div','sprow'); var go=el('button','spb acc',T('Δημοσίευση','Publish')); go.type='button'; row.append(go); bd.append(row); card.append(bd); ov.append(card); ov.hidden=false;
  go.addEventListener('click',async function(){
    if(!b.species){ C.toast(T('Λείπει το είδος.','Species is missing.')); return; }
    if(!C.lsGet('alkyon-comm-ok',false)){ var ok=await window.AlkyonAsk(T('Η ανάρτηση θα είναι ορατή σε όλους τους χρήστες του Alkyon. Δεν περιλαμβάνει θέση. Μπορείς να τη διαγράψεις όποτε θέλεις. Συνέχεια;','The post will be visible to all Alkyon users. It does not include a location. You can delete it any time. Continue?'),{title:T('Δημόσια ανάρτηση','Public post'),ok:T('Συνέχεια','Continue'),cancel:T('Άκυρο','Cancel')}); if(!ok) return; C.lsSet('alkyon-comm-ok',true); }
    go.disabled=true; go.textContent=T('Αποστολή…','Sending…'); var path=null;
    try{
      await rest('community_posts?select=id&limit=1');
      if(blob){ var jb=await jpeg(blob); path=cloud().uid()+'/'+uuid()+'.jpg'; var r=await cloud().storage('POST','community/'+path,jb,'image/jpeg'); if(!r.ok) throw new Error('photo '+r.status); }
      var cond=withCond?{wind:b.wind,wave:b.wave,press:b.press,ptrend:b.ptrend,sst:b.sst,temp:b.temp,moon:moonIdx(b)}:{}; Object.keys(cond).forEach(function(k){ if(cond[k]==null||cond[k]==='') delete cond[k]; else if(typeof cond[k]==='number') cond[k]=Math.round(cond[k]*10)/10; });
      var body={src:b.id,author:authorName(),species:b.species,latin:b.latin||null,kg:b.kg!=null?b.kg:null,len:b.len!=null?b.len:null,bait:b.bait||null,tech:b.tech||null,day:b.date||null,cond:cond,photo:path};
      var pr=await rest('community_posts',{method:'POST',body:JSON.stringify(body),headers:{Prefer:'return=representation'}}), rows=await pr.json();
      shared[b.id]=(rows[0]&&rows[0].id)||1; C.lsSet('alkyon-comm-shared',shared); ov.hidden=true; C.toast(T('Δημοσιεύτηκε στην κοινότητα.','Shared to the community.')); decorate(); if(!box.hidden) load(true);
    }catch(e){
      if(path){ try{ await cloud().storage('DELETE','community/'+path); }catch(x){} }
      var m=String(e.message||e); go.disabled=false; go.textContent=T('Δημοσίευση','Publish');
      C.toast(/409|duplicate/i.test(m)?T('Έχει ήδη μοιραστεί.','Already shared.'):/rate/i.test(m)?T('Πολλές αναρτήσεις σήμερα.','Too many posts today.'):/404|relation|does not exist/i.test(m)?T('Η κοινότητα δεν έχει ενεργοποιηθεί ακόμη.','Community is not enabled yet.'):T('Δεν στάλθηκε. Έλεγξε τη σύνδεση.','Not sent. Check your connection.'));
    }
  });
}
function decorate(){
  var shared=C.lsGet('alkyon-comm-shared',{})||{};
  Array.prototype.forEach.call(document.querySelectorAll('#biteList .item[data-bid]'),function(it){
    var a=it.querySelector('.acts'); if(!a) return; var id=it.getAttribute('data-bid'), old=a.querySelector('.cmshare'); if(old) old.remove();
    var b=el('button','btn ghost sm cmshare',shared[id]?T('✓ Στην κοινότητα','✓ Shared'):T('Κοινότητα','Community')); b.type='button'; if(shared[id]) b.disabled=true;
    b.addEventListener('click',function(){ var rec=(C.Store.get('bites')||[]).find(function(x){ return x.id===id; }); if(rec) openShare(rec); }); a.insertBefore(b,a.firstChild);
  });
}
var dt=null; function later(){ clearTimeout(dt); dt=setTimeout(decorate,90); }
(function(){ var n=$('biteList'); if(n) new MutationObserver(function(){ if(!n.querySelector('.cmshare')||n.querySelector('.item[data-bid] .acts:not(:has(.cmshare))')) later(); }).observe(n,{childList:true}); later(); })();
window.AlkyonCommunity={load:load,render:render,openShare:openShare};
})();
