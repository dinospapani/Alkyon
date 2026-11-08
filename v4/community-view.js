/* Alkyon 4 · Κοινότητα (#community): ίδιοι πίνακες με την κλασική community.js (community_posts, community_likes,
   community_comments, community_reports, φάκελος community στο storage) και ίδια κλειδιά (alkyon-comm-shared, alkyon-comm-ok, alkyon-comm-block).
   Μοιράζεσαι ένα ψάρι ΧΩΡΙΣ θέση ή όνομα σημείου. Η φωτογραφία ξαναφτιάχνεται από την αρχή (χωρίς EXIF/GPS). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, root=null, PAGE=15;
var SUPA='https://sgfohmqwdwtkhtrebnix.supabase.co';
function C(){ return B.cloud; }
function sess(){ return C()&&C().session(); }
function uid(){ var s=sess(); return s&&s.uid; }
function rest(p,o){ return C().rest(p,o); }
function esc(s){ return encodeURIComponent(s); }
function blocked(){ var a=ls.get('alkyon-comm-block',[]); return Array.isArray(a)?a:[]; }
function author(){ var s=sess(); return ((s&&s.name)||T('Ψαράς','Angler')).trim().slice(0,40)||T('Ψαράς','Angler'); }
var F={items:[],offset:0,end:false,loading:false,mine:false,liked:{},open:{},err:''};

function load(reset){
  if(!sess()||F.loading) return; if(reset){ F.items=[]; F.offset=0; F.end=false; } if(F.end) return; F.loading=true; F.err=''; draw();
  rest('community_posts?select=*,likes:community_likes(count),comments:community_comments(count)&order=created_at.desc&limit='+PAGE+'&offset='+F.offset+(F.mine?'&user_id=eq.'+esc(uid()):'')).then(function(r){ return r.json(); }).then(function(arr){
    if(arr.length<PAGE) F.end=true; F.offset+=arr.length; F.items=F.items.concat(arr); var ids=arr.map(function(p){ return p.id; });
    if(!ids.length) return; return rest('community_likes?select=post_id&user_id=eq.'+esc(uid())+'&post_id=in.('+ids.join(',')+')').then(function(r){ return r.json(); }).then(function(l){ l.forEach(function(x){ F.liked[x.post_id]=1; }); }).catch(function(){}); })
    .catch(function(e){ F.err=/HTTP 404|relation|does not exist/i.test(String(e&&e.message))?T('Η Κοινότητα ανοίγει σύντομα. Μέχρι τότε μοιράσου ψάρια και σημεία με τους Φίλους σου.','Community is opening soon. Until then, share catches and spots with your Friends.'):T('Δεν φόρτωσε. Έλεγξε τη σύνδεση.','Could not load. Check your connection.'); })
    .then(function(){ F.loading=false; draw(); });
}
function cnt(p,k){ return (p[k]&&p[k][0]&&p[k][0].count)||0; }
function like(p){ var on=!!F.liked[p.id], n=cnt(p,'likes'); F.liked[p.id]=on?0:1; p.likes=[{count:Math.max(0,n+(on?-1:1))}]; draw();
  (on?rest('community_likes?post_id=eq.'+p.id+'&user_id=eq.'+esc(uid()),{method:'DELETE'}):rest('community_likes',{method:'POST',body:JSON.stringify({post_id:p.id}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}))
    .catch(function(){ F.liked[p.id]=on?1:0; p.likes=[{count:n}]; draw(); B.toast(T('Δεν έγινε. Δοκίμασε ξανά.','Failed. Try again.')); }); }
function comments(p){ return rest('community_comments?select=*&post_id=eq.'+p.id+'&order=created_at.asc&limit=100').then(function(r){ return r.json(); }).then(function(c){ p._c=c; p._cerr=0; }).catch(function(){ p._c=[]; p._cerr=1; }).then(draw); }
function comment(p,txt){ txt=(txt||'').trim(); if(!txt) return;
  rest('community_comments',{method:'POST',body:JSON.stringify({post_id:p.id,author:author(),body:txt.slice(0,300)}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(){ p.comments=[{count:cnt(p,'comments')+1}]; return comments(p); })
    .catch(function(e){ B.toast(/rate/i.test(String(e&&e.message))?T('Πολλά σχόλια σήμερα.','Too many comments today.'):T('Το σχόλιο δεν στάλθηκε.','Comment not sent.')); }); }
function report(kind,id){ B.ask(T('Να αναφερθεί αυτό το περιεχόμενο ως ακατάλληλο;','Report this content as inappropriate?'),T('Αναφορά','Report')).then(function(y){ if(!y) return;
  rest('community_reports',{method:'POST',body:JSON.stringify(kind==='post'?{post_id:id}:{comment_id:id}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(){ B.toast(T('Ευχαριστούμε. Θα ελεγχθεί.','Thanks. It will be reviewed.')); },function(){ B.toast(T('Δεν στάλθηκε η αναφορά.','Report not sent.')); }); }); }
function delPost(p){ B.ask(T('Να διαγραφεί η ανάρτηση από την κοινότητα;','Delete this post from the community?'),T('Διαγραφή','Delete'),true).then(function(y){ if(!y) return;
  rest('community_posts?id=eq.'+p.id,{method:'DELETE'}).then(function(){ if(p.photo) C().storage('DELETE','community/'+p.photo).catch(function(){});
    F.items=F.items.filter(function(x){ return x!==p; }); var sh=ls.get('alkyon-comm-shared',{})||{}; Object.keys(sh).forEach(function(k){ if(sh[k]===p.id) delete sh[k]; }); ls.set('alkyon-comm-shared',sh); draw(); },function(){ B.toast(T('Δεν διαγράφηκε.','Not deleted.')); }); }); }
function delComment(p,c){ rest('community_comments?id=eq.'+c.id,{method:'DELETE'}).then(function(){ p._c=(p._c||[]).filter(function(x){ return x!==c; }); p.comments=[{count:Math.max(0,cnt(p,'comments')-1)}]; draw(); },function(){ B.toast(T('Δεν διαγράφηκε.','Not deleted.')); }); }

var MOON=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
function ago(ts){ var m=Math.round((Date.now()-Date.parse(ts))/60000); if(m<2) return T('τώρα','now'); if(m<60) return m+T('′',' min'); var hh=Math.round(m/60); if(hh<24) return hh+T(' ώρ.',' h'); return Math.round(hh/24)+T(' ημ.',' d'); }
function chips(c){ var a=[]; c=c||{}; if(c.wind!=null) a.push('💨 '+Math.round(c.wind)+' kn'); if(c.wave!=null) a.push('🌊 '+B.num(c.wave,1)+' m'); if(c.press!=null) a.push(Math.round(c.press)+' hPa'); if(c.sst!=null) a.push('🌡 '+Math.round(c.sst)+'°'); if(c.moon!=null&&MOON[c.moon]) a.push(MOON[c.moon]); return a; }
function post(p){
  var mine=p.user_id===uid(), card=h('article',{class:'card cmpost'});
  var more=h('button',{class:'iconbtn sm',type:'button','aria-label':T('Περισσότερα','More'),text:'⋯',onclick:function(){ var body=h('div',{class:'bform'}), sh;
    if(mine) body.append(h('button',{class:'btn full del',type:'button',text:T('Διαγραφή ανάρτησης','Delete post'),onclick:function(){ sh.close(true); delPost(p); }}));
    else body.append(h('button',{class:'btn full',type:'button',text:T('Αναφορά','Report'),onclick:function(){ sh.close(true); report('post',p.id); }}),h('button',{class:'btn full',type:'button',text:T('Απόκρυψη χρήστη','Hide this user'),onclick:function(){ var b=blocked(); b.push(p.user_id); ls.set('alkyon-comm-block',b); sh.close(); draw(); }}));
    sh=B.sheet({title:p.species||T('Ανάρτηση','Post'),body:body}); }});
  card.append(h('div',{class:'cmhd'},h('span',{class:'cmav',text:(p.author||'?').charAt(0).toUpperCase()}),h('span',{class:'cmwho'},h('b',{text:p.author||T('Ψαράς','Angler')}),h('small',{text:ago(p.created_at)})),more));
  if(p.photo) card.append(h('img',{class:'cmimg',loading:'lazy',alt:p.species||'',src:SUPA+'/storage/v1/object/public/community/'+p.photo}));
  var sz=[]; if(p.kg!=null) sz.push(String(+p.kg).replace('.',EN?'.':',')+' kg'); if(p.len!=null) sz.push(+p.len+' cm');
  card.append(h('div',{class:'cmtitle'},h('b',{text:p.species||''}),sz.length?h('span',{text:sz.join(' · ')}):null));
  var meta=[p.tech,p.bait,p.day?p.day.split('-').reverse().join('/'):''].filter(Boolean); if(meta.length) card.append(h('p',{class:'sub',style:{margin:'2px 0 0'},text:meta.join(' · ')}));
  var ch=chips(p.cond); if(ch.length){ var cr=h('div',{class:'chips',style:{margin:'8px 0 0'}}); ch.forEach(function(x){ cr.append(h('span',{class:'chip sm',text:x})); }); card.append(cr); }
  var lk=!!F.liked[p.id];
  card.append(h('div',{class:'cmact'},h('button',{type:'button',class:'cmbtn'+(lk?' on':''),'aria-pressed':String(lk),onclick:function(){ like(p); }},(lk?'♥ ':'♡ ')+cnt(p,'likes')),
    h('button',{type:'button',class:'cmbtn','aria-expanded':String(!!F.open[p.id]),onclick:function(){ F.open[p.id]=!F.open[p.id]; if(F.open[p.id]&&!p._c) comments(p); else draw(); }},'💬 '+cnt(p,'comments'))));
  if(F.open[p.id]){ var cm=h('div',{class:'cmcom'});
    (p._c||[]).forEach(function(c){ cm.append(h('div',{class:'cmc'},h('p',null,h('b',{text:(c.author||'')+' '}),c.body),h('button',{type:'button',class:'linkbtn',text:c.user_id===uid()?T('Διαγραφή','Delete'):T('Αναφορά','Report'),onclick:function(){ if(c.user_id===uid()) delComment(p,c); else report('comment',c.id); }}))); });
    if(p._cerr) cm.append(h('p',{class:'sub',text:T('Τα σχόλια δεν φόρτωσαν.','Comments did not load.')}));
    var ci=h('input',{type:'text',maxlength:'300',placeholder:T('Γράψε σχόλιο…','Write a comment…'),enterkeyhint:'send'}), f=h('form',{class:'inrow'},ci,h('button',{class:'btn sm pri',type:'submit',text:T('Αποστολή','Send')}));
    f.addEventListener('submit',function(ev){ ev.preventDefault(); var v=ci.value; ci.value=''; comment(p,v); }); cm.append(f); card.append(cm); }
  return card;
}
function draw(){
  if(!root) return; var page=h('div',{class:'page'});
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω στο Προφίλ','Back to Profile'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Κοινότητα','Community')})),
    sess()?h('button',{class:'iconbtn',type:'button','aria-label':T('Ανανέωση','Refresh'),html:B.iconSvg('refresh'),onclick:function(){ load(true); }}):null));
  if(!sess()){ page.append(h('div',{class:'card empty'},h('h3',{text:T('Χρειάζεται λογαριασμός','An account is needed')}),h('p',{text:T('Συνδέσου στο Προφίλ για να δεις και να μοιραστείς ψάρια με άλλους ψαράδες. Δεν φαίνεται ποτέ θέση.','Sign in from Profile to see and share catches with other anglers. A location is never shown.')}),B.accountBtn(T('Με λογαριασμό βλέπεις και μοιράζεσαι ψάρια με άλλους ψαράδες. Δεν φαίνεται ποτέ θέση.','With an account you see and share catches with other anglers. A location is never shown.')))); root.replaceChildren(page); return; }
  /* 1.9.56: αν αυτό το κινητό δεν θα πάρει ειδοποιήσεις (κλειστές, χωρίς άδεια ή χωρίς συνδρομή στον server), το λέει εδώ */
  (function(){ var n=ls.get('alkyon-notify',{})||{}, perm=('Notification' in window)?Notification.permission:'unsupported', off=!n.on||perm!=='granted'||n.server===false;
    if(!off) return;
    var why=perm==='denied'?T('Οι ειδοποιήσεις είναι μπλοκαρισμένες στις ρυθμίσεις του κινητού για την εφαρμογή.','Notifications are blocked in the phone settings for the app.'):perm==='unsupported'?T('Στο iPhone οι ειδοποιήσεις δουλεύουν μόνο αν η εφαρμογή είναι στην αρχική οθόνη (Κοινή χρήση › Προσθήκη στην οθόνη Αφετηρίας).','On iPhone, notifications only work when the app is on the Home Screen (Share › Add to Home Screen).'):T('Άνοιξε τις ειδοποιήσεις για να μαθαίνεις για νέα ψάρια, likes και σχόλια.','Turn on notifications to hear about new catches, likes and comments.');
    page.append(h('a',{class:'card ibon',href:'#alerts'},h('span',{class:'tx'},h('b',{text:T('Δεν θα σου έρχονται ειδοποιήσεις της Κοινότητας σε αυτό το κινητό','You will not get Community alerts on this phone')}),h('small',{text:why})))); })();
  page.append(B.seg([['all',T('Όλα','All')],['mine',T('Δικά μου','Mine')]],F.mine?'mine':'all',function(v){ var m=v==='mine'; if(m===F.mine) return; F.mine=m; load(true); },T('Αναρτήσεις','Posts')));
  page.append(h('p',{class:'sub',style:{margin:'10px 4px'},text:T('Οι αναρτήσεις δεν δείχνουν ποτέ θέση ή όνομα σημείου. Μοιράζεσαι ένα ψάρι από το Ημερολόγιο: πάτα το ψάρι › Κοινότητα.','Posts never show a location or spot name. Share a catch from the Log: tap the catch › Community.')}));
  var bl=blocked(), shown=F.items.filter(function(p){ return bl.indexOf(p.user_id)<0; });
  shown.forEach(function(p){ page.append(post(p)); });
  if(F.err) page.append(h('div',{class:'card empty'},h('p',{text:F.err})));
  else if(!shown.length&&!F.loading) page.append(h('div',{class:'card empty'},h('p',{text:F.mine?T('Δεν έχεις μοιραστεί ακόμη κάτι.','You have not shared anything yet.'):T('Δεν υπάρχουν αναρτήσεις ακόμη. Ανέβασε το πρώτο ψάρι!','No posts yet. Share the first catch!')})));
  if(F.loading) page.append(h('div',{class:'sk',style:{height:'220px',marginTop:'12px'}}));
  else if(!F.end&&shown.length) page.append(h('button',{class:'btn full',type:'button',text:T('Περισσότερα','More'),onclick:function(){ load(false); }}));
  root.replaceChildren(page);
}
B.view('community',{title:T('Κοινότητα','Community'),mount:function(el){ root=el; if(sess()&&!F.items.length&&!F.loading) load(true); else draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});

/* ---------- μοίρασμα ενός ψαριού ---------- */
function jpeg(blob){ return new Promise(function(res,rej){ var u=URL.createObjectURL(blob), im=new Image(); im.onload=function(){ var s=Math.min(1,1280/Math.max(im.width,im.height)), cv=document.createElement('canvas'); cv.width=Math.round(im.width*s); cv.height=Math.round(im.height*s);
  cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height); URL.revokeObjectURL(u); cv.toBlob(function(b){ if(b) res(b); else rej(new Error('jpeg')); },'image/jpeg',0.82); }; im.onerror=function(){ URL.revokeObjectURL(u); rej(new Error('img')); }; im.src=u; }); }
function moonIdx(b){ try{ return Math.round(PF.moonPhase(B.biteMs(b)).f*8)%8; }catch(e){ return null; } }
function uuid(){ return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
B.commShared=function(id){ var s=ls.get('alkyon-comm-shared',{})||{}; return !!s[id]; };
B.commShare=function(b){
  if(!sess()){ B.authSheet({reason:T('Για να μοιραστείς ψάρι στην Κοινότητα χρειάζεται λογαριασμός.','Sharing a catch to the Community needs an account.')}); return; }
  if(B.commShared(b.id)){ B.toast(T('Έχει ήδη μοιραστεί.','Already shared.')); return; }
  if(!b.species){ B.toast(T('Λείπει το είδος.','Species is missing.')); return; }
  var blob=null, body=h('div',{class:'bform cmshare'}), prev=h('div'), withCond=false, sh;
  (b.photo?B.store.Photos.get(b.id).catch(function(){ return null; }):Promise.resolve(null)).then(function(bl){ blob=bl; if(bl) prev.append(h('img',{class:'cmimg',alt:'',src:URL.createObjectURL(bl)})); });
  var sz=[]; if(b.kg!=null&&b.kg!=='') sz.push(b.kg+' kg'); if(b.len!=null&&b.len!=='') sz.push(b.len+' cm');
  body.append(prev,h('div',{class:'cmtitle'},h('b',{text:b.species}),sz.length?h('span',{text:sz.join(' · ')}):null));
  var ch=chips({wind:b.wind,wave:b.wave,press:b.press,sst:b.sst,moon:moonIdx(b)});
  if(ch.length){ var cr=h('div',{class:'chips',hidden:true}); ch.forEach(function(x){ cr.append(h('span',{class:'chip sm',text:x})); }); var cb=h('input',{type:'checkbox'}); cb.addEventListener('change',function(){ withCond=cb.checked; cr.hidden=!withCond; });
    body.append(h('label',{class:'tg'},cb,h('span',{text:T('Να φαίνονται και οι συνθήκες (άνεμος, κύμα, πίεση)','Also show conditions (wind, waves, pressure)')})),cr); }
  body.append(h('p',{class:'sub',text:T('Θα φαίνονται: το όνομά σου, είδος, βάρος, δόλωμα και τεχνική, ημερομηνία και η φωτογραφία (και οι συνθήκες, μόνο αν το επιλέξεις). ΔΕΝ θα φαίνεται θέση ή όνομα σημείου. Πρόσεξε να μη δείχνει η φωτογραφία χαρακτηριστικό τοπίο.','Visible: your name, species, weight, bait and technique, date and the photo (conditions only if you tick the option). NO location or spot name is shared. Make sure the photo does not show a recognisable landmark.')}));
  var go=h('button',{class:'btn pri full',type:'button',text:T('Δημοσίευση','Publish'),onclick:function(){
    (ls.get('alkyon-comm-ok',false)?Promise.resolve(true):B.ask(T('Η ανάρτηση θα είναι ορατή σε όλους τους χρήστες του Alkyon. Δεν περιλαμβάνει θέση. Μπορείς να τη διαγράψεις όποτε θέλεις. Συνέχεια;','The post will be visible to all Alkyon users. It does not include a location. You can delete it any time. Continue?'),T('Συνέχεια','Continue'))).then(function(y){ if(!y) return; ls.set('alkyon-comm-ok',true);
      go.disabled=true; go.textContent=T('Αποστολή…','Sending…'); var path=null;
      rest('community_posts?select=id&limit=1').then(function(){ if(!blob) return; return jpeg(blob).then(function(jb){ path=uid()+'/'+uuid()+'.jpg'; return C().storage('POST','community/'+path,jb,'image/jpeg'); }).then(function(r){ if(!r.ok) throw new Error('photo '+r.status); }); })
        .then(function(){ var cond=withCond?{wind:b.wind,wave:b.wave,press:b.press,ptrend:b.ptrend,sst:b.sst,temp:b.temp,moon:moonIdx(b)}:{}; Object.keys(cond).forEach(function(k){ if(cond[k]==null||cond[k]==='') delete cond[k]; else if(typeof cond[k]==='number') cond[k]=Math.round(cond[k]*10)/10; });
          return rest('community_posts',{method:'POST',body:JSON.stringify({src:b.id,author:author(),species:b.species,latin:b.latin||null,kg:b.kg!=null&&b.kg!==''?+b.kg:null,len:b.len!=null&&b.len!==''?+b.len:null,bait:b.bait||null,tech:b.tech||null,day:b.date||null,cond:cond,photo:path}),headers:{'Content-Type':'application/json',Prefer:'return=representation'}}).then(function(r){ return r.json(); }); })
        .then(function(rows){ var s=ls.get('alkyon-comm-shared',{})||{}; s[b.id]=(rows&&rows[0]&&rows[0].id)||1; ls.set('alkyon-comm-shared',s); sh.close(); B.toast(T('Δημοσιεύτηκε στην κοινότητα.','Shared to the community.')); F.items=[]; F.end=false; F.offset=0; })
        .catch(function(e){ if(path) C().storage('DELETE','community/'+path).catch(function(){}); var m=String(e&&e.message||e); go.disabled=false; go.textContent=T('Δημοσίευση','Publish');
          B.toast(/409|duplicate/i.test(m)?T('Έχει ήδη μοιραστεί.','Already shared.'):/rate/i.test(m)?T('Πολλές αναρτήσεις σήμερα.','Too many posts today.'):/404|relation|does not exist/i.test(m)?T('Η κοινότητα δεν έχει ενεργοποιηθεί ακόμη.','Community is not enabled yet.'):T('Δεν στάλθηκε. Έλεγξε τη σύνδεση.','Not sent. Check your connection.')); }); }); }});
  body.append(go); sh=B.sheet({title:T('Μοίρασμα στην κοινότητα','Share to the community'),body:body});
};
})();
