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
/* 1.9.61: άμεση ειδοποίηση των άλλων (αλλιώς ο server τη στέλνει στον επόμενο έλεγχο, έως 5′ μετά) */
function pingComm(){ try{ var s=B.cloud&&B.cloud.session&&B.cloud.session(); if(!s||!s.access_token) return;
  setTimeout(function(){ fetch('https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/quick-processor',{method:'POST',headers:{apikey:'sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA','Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({action:'comm'})}).catch(function(){}); },1500); }catch(e){} }
B.pingComm=pingComm;
function like(p){ var on=!!F.liked[p.id], n=cnt(p,'likes'); F.liked[p.id]=on?0:1; p.likes=[{count:Math.max(0,n+(on?-1:1))}]; draw();
  (on?rest('community_likes?post_id=eq.'+p.id+'&user_id=eq.'+esc(uid()),{method:'DELETE'}):rest('community_likes',{method:'POST',body:JSON.stringify({post_id:p.id}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(r){ pingComm(); return r; }))
    .catch(function(){ F.liked[p.id]=on?1:0; p.likes=[{count:n}]; draw(); B.toast(T('Δεν έγινε. Δοκίμασε ξανά.','Failed. Try again.')); }); }
function comments(p){ return rest('community_comments?select=*&post_id=eq.'+p.id+'&order=created_at.asc&limit=100').then(function(r){ return r.json(); }).then(function(c){ p._c=c; p._cerr=0; }).catch(function(){ p._c=[]; p._cerr=1; }).then(draw); }
function comment(p,txt){ txt=(txt||'').trim(); if(!txt) return;
  rest('community_comments',{method:'POST',body:JSON.stringify({post_id:p.id,author:author(),body:txt.slice(0,300)}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(){ pingComm(); p.comments=[{count:cnt(p,'comments')+1}]; return comments(p); })
    .catch(function(e){ B.toast(/rate/i.test(String(e&&e.message))?T('Πολλά σχόλια σήμερα.','Too many comments today.'):T('Το σχόλιο δεν στάλθηκε.','Comment not sent.')); }); }
function report(kind,id){ B.ask(T('Να αναφερθεί αυτό το περιεχόμενο ως ακατάλληλο;','Report this content as inappropriate?'),T('Αναφορά','Report')).then(function(y){ if(!y) return;
  rest('community_reports',{method:'POST',body:JSON.stringify(kind==='post'?{post_id:id}:{comment_id:id}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(){ B.toast(T('Ευχαριστούμε. Θα ελεγχθεί.','Thanks. It will be reviewed.')); },function(){ B.toast(T('Δεν στάλθηκε η αναφορά.','Report not sent.')); }); }); }
function delPost(p){ B.ask(T('Να διαγραφεί η ανάρτηση από την κοινότητα;','Delete this post from the community?'),T('Διαγραφή','Delete'),true).then(function(y){ if(!y) return;
  rest('community_posts?id=eq.'+p.id,{method:'DELETE'}).then(function(){ if(p.photo) C().storage('DELETE','community/'+p.photo).catch(function(){});
    F.items=F.items.filter(function(x){ return x!==p; }); var sh=ls.get('alkyon-comm-shared',{})||{}; Object.keys(sh).forEach(function(k){ if(sh[k]===p.id) delete sh[k]; }); ls.set('alkyon-comm-shared',sh); draw(); },function(){ B.toast(T('Δεν διαγράφηκε.','Not deleted.')); }); }); }
function delComment(p,c){ rest('community_comments?id=eq.'+c.id,{method:'DELETE'}).then(function(){ p._c=(p._c||[]).filter(function(x){ return x!==c; }); p.comments=[{count:Math.max(0,cnt(p,'comments')-1)}]; draw(); },function(){ B.toast(T('Δεν διαγράφηκε.','Not deleted.')); }); }

var MOON=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
function ago(ts){ var m=Math.round((Date.now()-Date.parse(ts))/60000); if(!(m>=0)) m=0; if(m<2) return T('μόλις τώρα','just now'); if(m<60) return T('πριν '+m+'′',m+' min ago'); var hh=Math.round(m/60); if(hh<24) return T('πριν '+hh+(hh===1?' ώρα':' ώρες'),hh+' h ago'); var d=Math.round(hh/24); if(d===1) return T('χθες','yesterday'); if(d<7) return T('πριν '+d+' μέρες',d+' days ago');
  var dt=new Date(ts); return dt.getDate()+'/'+(dt.getMonth()+1)+(dt.getFullYear()!==new Date().getFullYear()?'/'+dt.getFullYear():''); }
/* 1.9.62: άλλα ψάρια της ίδιας ανάρτησης και περιοχή (προαιρετική, χωρίς σημείο) */
function kgTxt(v){ return String(+v).replace('.',EN?'.':',')+' kg'; }
function moreTxt(m){ return (m||[]).map(function(x){ return (x.s||'')+(x.kg!=null?' '+kgTxt(x.kg):''); }).join(' · '); }
/* 1.9.62: φωτογραφία σε πλήρη οθόνη, με zoom (τσίμπημα με δύο δάχτυλα ή διπλό πάτημα) */
function viewer(src,alt){
  var ov=h('div',{class:'cmview',role:'dialog','aria-modal':'true','aria-label':alt||T('Φωτογραφία','Photo')}), im=h('img',{src:src,alt:alt||'',draggable:'false'});
  var x=h('button',{class:'cmvx',type:'button','aria-label':T('Κλείσιμο','Close'),text:'✕'});
  var S={s:1,x:0,y:0}, pts={}, g=null, lastTap=0, moved=false;
  function ap(){ im.style.transform='translate('+S.x+'px,'+S.y+'px) scale('+S.s+')'; }
  function close(){ document.removeEventListener('keydown',key); ov.remove(); }
  function key(e){ if(e.key==='Escape') close(); }
  function arr(){ return Object.keys(pts).map(function(k){ return pts[k]; }); }
  function start(){ var a=arr(); g={s:S.s,x:S.x,y:S.y}; if(a.length>1){ g.d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1; g.mx=(a[0].x+a[1].x)/2; g.my=(a[0].y+a[1].y)/2; } else if(a.length){ g.mx=a[0].x; g.my=a[0].y; } }
  ov.addEventListener('pointerdown',function(e){ if(e.target===x) return; pts[e.pointerId]={x:e.clientX,y:e.clientY}; moved=false; start(); try{ ov.setPointerCapture(e.pointerId); }catch(er){} });
  ov.addEventListener('pointermove',function(e){ if(!pts[e.pointerId]||!g) return; pts[e.pointerId]={x:e.clientX,y:e.clientY}; var a=arr();
    if(a.length>1){ var d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y), mx=(a[0].x+a[1].x)/2, my=(a[0].y+a[1].y)/2; S.s=Math.max(1,Math.min(5,g.s*d/g.d)); S.x=g.x+(mx-g.mx); S.y=g.y+(my-g.my); moved=true; ap(); }
    else if(a.length===1){ var dx=a[0].x-g.mx, dy=a[0].y-g.my; if(Math.abs(dx)+Math.abs(dy)>6) moved=true; if(S.s>1){ S.x=g.x+dx; S.y=g.y+dy; ap(); } } });
  function up(e){ if(!pts[e.pointerId]) return; delete pts[e.pointerId]; if(S.s<=1.02){ S.s=1; S.x=0; S.y=0; ap(); }
    if(!arr().length&&!moved){ var t=Date.now(); if(t-lastTap<300){ lastTap=0; if(S.s>1){ S.s=1; S.x=0; S.y=0; } else { var r=ov.getBoundingClientRect(); S.s=2.5; S.x=(r.width/2-e.clientX)*1.5; S.y=(r.height/2-e.clientY)*1.5; } ap(); } else lastTap=t; }
    start(); }
  ov.addEventListener('pointerup',up); ov.addEventListener('pointercancel',up);
  x.addEventListener('click',close); document.addEventListener('keydown',key);
  ov.append(im,x); document.body.append(ov); try{ x.focus(); }catch(e){}
  return ov;
}
B.commViewer=viewer;
function chips(c){ var a=[]; c=c||{}; if(c.wind!=null) a.push('💨 '+Math.round(c.wind)+' kn'); if(c.wave!=null) a.push('🌊 '+B.num(c.wave,1)+' m'); if(c.press!=null) a.push(Math.round(c.press)+' hPa'); if(c.sst!=null) a.push('🌡 '+Math.round(c.sst)+'°'); if(c.moon!=null&&MOON[c.moon]) a.push(MOON[c.moon]); return a; }
function post(p){
  var mine=p.user_id===uid(), card=h('article',{class:'card cmpost'});
  var more=h('button',{class:'iconbtn sm',type:'button','aria-label':T('Περισσότερα','More'),text:'⋯',onclick:function(){ var body=h('div',{class:'bform'}), sh;
    if(mine) body.append(h('button',{class:'btn full del',type:'button',text:T('Διαγραφή ανάρτησης','Delete post'),onclick:function(){ sh.close(true); delPost(p); }}));
    else body.append(h('button',{class:'btn full',type:'button',text:T('Αναφορά','Report'),onclick:function(){ sh.close(true); report('post',p.id); }}),h('button',{class:'btn full',type:'button',text:T('Απόκρυψη χρήστη','Hide this user'),onclick:function(){ var b=blocked(); b.push(p.user_id); ls.set('alkyon-comm-block',b); sh.close(); draw(); }}));
    sh=B.sheet({title:p.species||T('Ανάρτηση','Post'),body:body}); }});
  card.append(h('div',{class:'cmhd'},h('span',{class:'cmav',text:(p.author||'?').charAt(0).toUpperCase()}),h('span',{class:'cmwho'},h('b',{text:p.author||T('Ψαράς','Angler')}),h('small',{text:ago(p.created_at)})),more));
  if(p.photo){ var src=SUPA+'/storage/v1/object/public/community/'+p.photo, tapT=null, hrt=h('span',{class:'cmheart','aria-hidden':'true',text:'♥'});
    var ph=h('div',{class:'cmph',role:'button',tabindex:'0','aria-label':T('Φωτογραφία σε πλήρη οθόνη. Διπλό πάτημα για like.','Full-screen photo. Double tap to like.')},h('img',{class:'cmimg',loading:'lazy',alt:p.species||'',src:src}),hrt);
    ph.addEventListener('click',function(){ if(tapT){ clearTimeout(tapT); tapT=null; if(!F.liked[p.id]) like(p); hrt.classList.remove('go'); void hrt.offsetWidth; hrt.classList.add('go'); return; }
      tapT=setTimeout(function(){ tapT=null; viewer(src,p.species); },280); });
    ph.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); viewer(src,p.species); } });
    card.append(ph); }
  var c0=p.cond||{}, more=Array.isArray(c0.more)?c0.more.filter(function(x){ return x&&x.s; }).slice(0,8):[];
  var sz=[]; if(p.kg!=null) sz.push(kgTxt(p.kg)); if(p.len!=null) sz.push(+p.len+' cm');
  card.append(h('div',{class:'cmtitle'},h('b',{text:p.species||''}),sz.length?h('span',{text:sz.join(' · ')}):null));
  if(more.length){ var tot=(p.kg!=null?+p.kg:0), nk=p.kg!=null?1:0; more.forEach(function(x){ if(x.kg!=null){ tot+=+x.kg; nk++; } });
    card.append(h('p',{class:'cmmore'},h('span',{text:'+ '+moreTxt(more)}),nk>1?h('small',{text:T('Σύνολο ','Total ')+kgTxt(Math.round(tot*100)/100)}):null)); }
  var meta=[p.tech,p.bait,p.day?p.day.split('-').reverse().join('/'):''].filter(Boolean); if(meta.length) card.append(h('p',{class:'sub',style:{margin:'2px 0 0'},text:meta.join(' · ')}));
  if(c0.area) card.append(h('p',{class:'cmarea'},h('span',{'aria-hidden':'true',text:'📍 '}),String(c0.area).slice(0,40)));
  var ch=chips(p.cond); if(ch.length){ var cr=h('div',{class:'chips',style:{margin:'8px 0 0'}}); ch.forEach(function(x){ cr.append(h('span',{class:'chip sm',text:x})); }); card.append(cr); }
  var lk=!!F.liked[p.id];
  card.append(h('div',{class:'cmact'},h('button',{type:'button',class:'cmbtn'+(lk?' on':''),'aria-pressed':String(lk),onclick:function(){ like(p); }},(lk?'♥ ':'♡ ')+cnt(p,'likes')),
    h('button',{type:'button',class:'cmbtn','aria-expanded':String(!!F.open[p.id]),'aria-label':T('Σχόλια','Comments'),onclick:function(){ F.open[p.id]=!F.open[p.id]; if(F.open[p.id]&&!p._c) comments(p); else draw(); }},'💬 '+cnt(p,'comments'))));
  if(F.open[p.id]){ var cm=h('div',{class:'cmcom'}), ci=h('input',{type:'text',maxlength:'300',placeholder:T('Γράψε σχόλιο…','Write a comment…'),enterkeyhint:'send'});
    (p._c||[]).forEach(function(c){ var mineC=c.user_id===uid(), body=String(c.body||''), tx=h('p',{class:'noik'},h('b',{text:(c.author||T('Ψαράς','Angler'))+' '}));
      var mm=/^@(\S+(?: \S+)?)/.exec(body), who=null; if(mm){ (p._c||[]).concat([{author:p.author}]).forEach(function(o){ var a=o.author||''; if(a&&body.indexOf('@'+a)===0&&(!who||a.length>who.length)) who=a; }); }
      if(who){ tx.append(h('span',{class:'cmat',text:'@'+who}),body.slice(who.length+1)); } else tx.append(body);
      var acts=h('div',{class:'cma'},c.created_at?h('small',{text:ago(c.created_at)}):null);
      if(!mineC) acts.append(h('button',{type:'button',class:'linkbtn',text:T('Απάντηση','Reply'),onclick:function(){ ci.value='@'+(c.author||'')+' '; try{ ci.focus(); ci.setSelectionRange(ci.value.length,ci.value.length); }catch(e){} }}));
      acts.append(h('button',{type:'button',class:'linkbtn',text:mineC?T('Διαγραφή','Delete'):T('Αναφορά','Report'),onclick:function(){ if(mineC) delComment(p,c); else report('comment',c.id); }}));
      cm.append(h('div',{class:'cmc'},tx,acts)); });
    if(p._cerr) cm.append(h('p',{class:'sub',text:T('Τα σχόλια δεν φόρτωσαν.','Comments did not load.')}));
    var f=h('form',{class:'inrow'},ci,h('button',{class:'btn sm pri',type:'submit',text:T('Αποστολή','Send')}));
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
/* 1.9.62: περιοχή ψαρέματος. Μόνο αν το επιλέξει ο χρήστης· προτείνεται η πιο κοντινή γνωστή περιοχή (όχι το σημείο) και τη γράφει/αλλάζει όπως θέλει */
var AREAS=[['Λεμεσός','Limassol',34.675,33.04],['Λάρνακα','Larnaca',34.915,33.636],['Πάφος','Paphos',34.757,32.41],['Αγία Νάπα','Ayia Napa',34.982,34.0],['Πρωταράς','Protaras',35.012,34.058],
  ['Πόλις Χρυσοχούς','Polis Chrysochous',35.036,32.425],['Λατσί','Latchi',35.04,32.39],['Πισσούρι','Pissouri',34.66,32.70],['Ζύγι','Zygi',34.73,33.34],['Μαζωτός','Mazotos',34.80,33.49],
  ['Κάτω Πύργος','Kato Pyrgos',35.18,32.69],['Πωμός','Pomos',35.15,32.55],['Ακρωτήρι','Akrotiri',34.58,32.98],['Ορμήδεια','Ormideia',34.99,33.78],['Κόραλ Μπέι','Coral Bay',34.86,32.36],['Γκόβερνορς','Governor\'s Beach',34.71,33.27]];
function nearArea(b){ var la=+b.lat, lo=+b.lon; if(!isFinite(la)||!isFinite(lo)||b.lat==null) return ''; var best=null, bd=1e9;
  AREAS.forEach(function(a){ var dy=(a[2]-la)*111, dx=(a[3]-lo)*111*Math.cos(la*Math.PI/180), d=Math.hypot(dx,dy); if(d<bd){ bd=d; best=a; } });
  return best&&bd<30?(EN?best[1]:best[0]):''; }
B.commNearArea=nearArea;
/* 1.9.62: τα άλλα ψάρια της ίδιας μέρας (για να μπουν στην ίδια ανάρτηση) */
function sameDay(b){ try{ return B.store.raw('bites').filter(function(x){ return x&&x.id!==b.id&&!x.deleted&&!x.miss&&!x.gear&&x.species&&x.date===b.date&&!(B.pest&&B.pest(x)); }).sort(function(p,q){ return (+q.kg||0)-(+p.kg||0); }).slice(0,8); }catch(e){ return []; } }
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
  var others=b.date?sameDay(b):[], pick={};
  if(others.length){ var ob=h('div',{class:'cmpick'},h('b',{text:T('Και άλλα ψάρια της ίδιας μέρας','Other catches from the same day')}));
    others.forEach(function(x){ pick[x.id]=1; var c=h('input',{type:'checkbox',checked:true}); c.addEventListener('change',function(){ pick[x.id]=c.checked?1:0; });
      ob.append(h('label',{class:'tg'},c,h('span',{text:x.species+(x.kg!=null&&x.kg!==''?' '+kgTxt(x.kg):'')+(x.len!=null&&x.len!==''?' · '+x.len+' cm':'')}))); });
    body.append(ob); }
  var areaIn=h('input',{type:'text',maxlength:'40',placeholder:T('π.χ. Λεμεσός','e.g. Limassol'),value:nearArea(b),hidden:true,'aria-label':T('Περιοχή','Area')}), withArea=false, acb=h('input',{type:'checkbox'});
  acb.addEventListener('change',function(){ withArea=acb.checked; areaIn.hidden=!withArea; if(withArea) try{ areaIn.focus(); }catch(e){} });
  body.append(h('label',{class:'tg'},acb,h('span',{text:T('Να φαίνεται η περιοχή (π.χ. «Λεμεσός», ποτέ το σημείο)','Show the area (e.g. "Limassol", never the spot)')})),areaIn);
  if(ch.length){ var cr=h('div',{class:'chips',hidden:true}); ch.forEach(function(x){ cr.append(h('span',{class:'chip sm',text:x})); }); var cb=h('input',{type:'checkbox'}); cb.addEventListener('change',function(){ withCond=cb.checked; cr.hidden=!withCond; });
    body.append(h('label',{class:'tg'},cb,h('span',{text:T('Να φαίνονται και οι συνθήκες (άνεμος, κύμα, πίεση)','Also show conditions (wind, waves, pressure)')})),cr); }
  body.append(h('p',{class:'sub',text:T('Θα φαίνονται: το όνομά σου, είδος, βάρος, δόλωμα και τεχνική, ημερομηνία και η φωτογραφία (περιοχή και συνθήκες μόνο αν το επιλέξεις). ΔΕΝ θα φαίνεται θέση ή όνομα σημείου. Πρόσεξε να μη δείχνει η φωτογραφία χαρακτηριστικό τοπίο.','Visible: your name, species, weight, bait and technique, date and the photo (area and conditions only if you tick them). NO location or spot name is shared. Make sure the photo does not show a recognisable landmark.')}));
  var go=h('button',{class:'btn pri full',type:'button',text:T('Δημοσίευση','Publish'),onclick:function(){
    (ls.get('alkyon-comm-ok',false)?Promise.resolve(true):B.ask(T('Η ανάρτηση θα είναι ορατή σε όλους τους χρήστες του Alkyon. Δεν περιλαμβάνει θέση. Μπορείς να τη διαγράψεις όποτε θέλεις. Συνέχεια;','The post will be visible to all Alkyon users. It does not include a location. You can delete it any time. Continue?'),T('Συνέχεια','Continue'))).then(function(y){ if(!y) return; ls.set('alkyon-comm-ok',true);
      go.disabled=true; go.textContent=T('Αποστολή…','Sending…'); var path=null;
      rest('community_posts?select=id&limit=1').then(function(){ if(!blob) return; return jpeg(blob).then(function(jb){ path=uid()+'/'+uuid()+'.jpg'; return C().storage('POST','community/'+path,jb,'image/jpeg'); }).then(function(r){ if(!r.ok) throw new Error('photo '+r.status); }); })
        .then(function(){ var cond=withCond?{wind:b.wind,wave:b.wave,press:b.press,ptrend:b.ptrend,sst:b.sst,temp:b.temp,moon:moonIdx(b)}:{}; Object.keys(cond).forEach(function(k){ if(cond[k]==null||cond[k]==='') delete cond[k]; else if(typeof cond[k]==='number') cond[k]=Math.round(cond[k]*10)/10; });
          var mo=others.filter(function(x){ return pick[x.id]; }).map(function(x){ var o={s:String(x.species).slice(0,40)}; if(x.kg!=null&&x.kg!==''&&isFinite(+x.kg)) o.kg=+x.kg; if(x.len!=null&&x.len!==''&&isFinite(+x.len)) o.len=+x.len; return o; }); if(mo.length) cond.more=mo;
          var ar=withArea?areaIn.value.trim().slice(0,40):''; if(ar) cond.area=ar;
          return rest('community_posts',{method:'POST',body:JSON.stringify({src:b.id,author:author(),species:b.species,latin:b.latin||null,kg:b.kg!=null&&b.kg!==''?+b.kg:null,len:b.len!=null&&b.len!==''?+b.len:null,bait:b.bait||null,tech:b.tech||null,day:b.date||null,cond:cond,photo:path}),headers:{'Content-Type':'application/json',Prefer:'return=representation'}}).then(function(r){ return r.json(); }); })
        .then(function(rows){ pingComm(); var s=ls.get('alkyon-comm-shared',{})||{}; s[b.id]=(rows&&rows[0]&&rows[0].id)||1; ls.set('alkyon-comm-shared',s); sh.close(); B.toast(T('Δημοσιεύτηκε στην κοινότητα.','Shared to the community.')); F.items=[]; F.end=false; F.offset=0; })
        .catch(function(e){ if(path) C().storage('DELETE','community/'+path).catch(function(){}); var m=String(e&&e.message||e); go.disabled=false; go.textContent=T('Δημοσίευση','Publish');
          B.toast(/409|duplicate/i.test(m)?T('Έχει ήδη μοιραστεί.','Already shared.'):/rate/i.test(m)?T('Πολλές αναρτήσεις σήμερα.','Too many posts today.'):/404|relation|does not exist/i.test(m)?T('Η κοινότητα δεν έχει ενεργοποιηθεί ακόμη.','Community is not enabled yet.'):T('Δεν στάλθηκε. Έλεγξε τη σύνδεση.','Not sent. Check your connection.')); }); }); }});
  body.append(go); sh=B.sheet({title:T('Μοίρασμα στην κοινότητα','Share to the community'),body:body});
};
})();
