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
var PUBK='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
/* 1.9.65: χωρίς λογαριασμό διαβάζεις (μόνο ανάγνωση) με το δημόσιο κλειδί */
function rest(p,o){ if(sess()) return C().rest(p,o); if(o&&o.method&&o.method!=='GET') return Promise.reject(new Error('no session'));
  return fetch(SUPA+'/rest/v1/'+p,{headers:{apikey:PUBK}}).then(function(r){ if(!r.ok) return r.text().then(function(t){ throw new Error('HTTP '+r.status+' '+t.slice(0,120)); }); return r; }); }
function needAcc(why){ B.authSheet({reason:why||T('Για like, σχόλια και μοίρασμα χρειάζεται λογαριασμός.','Likes, comments and sharing need an account.')}); }
function esc(s){ return encodeURIComponent(s); }
function blocked(){ var a=ls.get('alkyon-comm-block',[]); return Array.isArray(a)?a:[]; }
function author(){ var s=sess(); return ((s&&s.name)||T('Ψαράς','Angler')).trim().slice(0,40)||T('Ψαράς','Angler'); }
var F={pname:{},lk:{},prof:{},admin:null,clk:{},cliked:{},reports:null,items:[],offset:0,end:false,loading:false,mode:'all',sp:'',tech:'',user:null,liked:{},open:{},err:'',all:null,allT:0,allBusy:0,ans:{},top:{week:true}};
/* 1.9.63: ακόλουθοι (συγχρονίζεται με τον λογαριασμό και στέλνεται στον server για τις ειδοποιήσεις «μόνο όσους ακολουθώ») */
function fl(){ var a=ls.get('alkyon-comm-follow',[]); return Array.isArray(a)?a.filter(function(x){ return x&&x.u; }):[]; }
function follows(){ return fl().map(function(x){ return x.u; }); }
function isF(u){ return follows().indexOf(u)>=0; }
function toggleFollow(u,name){ var a=fl(), on=isF(u); a=on?a.filter(function(x){ return x.u!==u; }):a.concat([{u:u,n:String(name||'').slice(0,40)}]); ls.set('alkyon-comm-follow',a);
  B.toast(on?T('Δεν ακολουθείς πια: ','Unfollowed: ')+(name||''):T('Ακολουθείς: ','Following: ')+(name||'')); try{ if(B.pushSync) B.pushSync(); }catch(e){} draw(); }
B.commFollows=follows;
function isQ(p){ var c=p&&p.cond; return !!(c&&(c.k==='q'||c.k==='id')); }
/* 1.9.64: είδος → κλειδί (λατινικό από το SPKB, ώστε «Καλαμάρι» και «European squid» να είναι το ίδιο) */
function spEnt(name,la){ var K=window.SPKB||[]; if(la){ var l=String(la).toLowerCase(), e=K.filter(function(k){ return k.l.toLowerCase()===l; })[0]; if(e) return e; }
  var n=String(name||'').trim().toLowerCase(); if(!n) return null; return K.filter(function(k){ return k.n.toLowerCase()===n||(k.en||'').toLowerCase()===n||(k.a||[]).some(function(a){ return String(a).toLowerCase()===n; }); })[0]||null; }
function spKey(name,la){ var e=spEnt(name,la); return e?e.l.toLowerCase():String(name||'').trim().toLowerCase(); }
function spShow(e){ return e?(EN?(e.en||e.n):e.n):''; }
B.commSpEnt=spEnt;
/* 1.9.64: αποθηκευμένες αναρτήσεις */
function saved(){ var a=ls.get('alkyon-comm-saved',[]); return Array.isArray(a)?a:[]; }
function toggleSave(p){ var a=saved(), on=a.indexOf(p.id)>=0; a=on?a.filter(function(x){ return x!==p.id; }):[p.id].concat(a).slice(0,200); ls.set('alkyon-comm-saved',a); B.toast(on?T('Αφαιρέθηκε από τα σωσμένα.','Removed from saved.'):T('Σώθηκε. Θα τη βρεις στα «Σωσμένα».','Saved. Find it under "Saved".')); draw(); }
/* 1.9.64: μηνιαία πρόκληση (ένα είδος κάθε μήνα, ίδιο για όλους) */
var CHAL=['Dicentrarchus labrax','Sparus aurata','Diplodus sargus','Dentex dentex','Pagrus pagrus','Lichia amia','Seriola dumerili','Epinephelus marginatus','Pomatomus saltatrix','Sphyraena viridensis','Loligo vulgaris','Sepia officinalis'];
var CHAL_N={'dicentrarchus labrax':['Λαβράκι','Sea bass'],'sparus aurata':['Τσιπούρα','Gilthead seabream'],'diplodus sargus':['Σαργός','White seabream'],'dentex dentex':['Συναγρίδα','Common dentex'],'pagrus pagrus':['Φαγκρί','Red porgy'],'lichia amia':['Λίτσα','Leerfish'],'seriola dumerili':['Μαγιάτικο','Amberjack'],'epinephelus marginatus':['Ροφός','Dusky grouper'],'pomatomus saltatrix':['Γοφάρι','Bluefish'],'sphyraena viridensis':['Λούτσος','Barracuda'],'loligo vulgaris':['Καλαμάρι','Squid'],'sepia officinalis':['Σουπιά','Cuttlefish']};
function chalOf(y,m){ var l=CHAL[m].toLowerCase(); return {l:l,name:CHAL_N[l]?CHAL_N[l][EN?1:0]:CHAL[m],y:y,m:m,ym:y+'-'+String(m+1).padStart(2,'0')}; }
function chalRank(c){ var best={}; fishAll().forEach(function(p){ var mo=(p.day||String(p.created_at||'').slice(0,10)).slice(0,7); if(mo!==c.ym) return;
  [{s:p.species,la:p.latin,kg:p.kg}].concat((p.cond&&Array.isArray(p.cond.more)?p.cond.more:[]).map(function(x){ return {s:x.s,kg:x.kg}; })).forEach(function(x){ if(!(+x.kg>0)||spKey(x.s,x.la)!==c.l) return; var b=best[p.user_id]; if(!b||+x.kg>b.kg) best[p.user_id]={kg:+x.kg,a:p.author,u:p.user_id}; }); });
  return Object.keys(best).map(function(k){ return best[k]; }).sort(function(a,b){ return b.kg-a.kg; }); }
function chalWins(u){ var n=0, d=new Date(); for(var i=1;i<=24;i++){ var dt=new Date(d.getFullYear(),d.getMonth()-i,1), r=chalRank(chalOf(dt.getFullYear(),dt.getMonth())); if(r[0]&&r[0].u===u) n++; } return n; }
function chalCard(){ var d=new Date(), c=chalOf(d.getFullYear(),d.getMonth()), r=chalRank(c), pd=new Date(d.getFullYear(),d.getMonth()-1,1), pc=chalOf(pd.getFullYear(),pd.getMonth()), pr=chalRank(pc);
  var body=h('div',{class:'cmtopb'}); if(!r.length) body.append(h('p',{class:'sub',text:T('Κανείς ακόμη. Μοιράσου το πρώτο '+c.name.toLowerCase()+' του μήνα!','No one yet. Share the first '+c.name.toLowerCase()+' of the month!')}));
  r.slice(0,5).forEach(function(b,i){ body.append(h('div',{class:'cmlb'},h('span',{class:'cmlbn',text:String(i+1)}),h('b',{text:b.a||T('Ψαράς','Angler')}),h('span',{text:kgTxt(b.kg)}),h('button',{type:'button',class:'linkbtn',text:T('Προφίλ','Profile'),onclick:function(){ profile(b.u,b.a); }}))); });
  if(pr[0]) body.append(h('p',{class:'sub cmwl'},h('b',{text:'🏆 '+T('Νικητής ','Winner ')+(EN?MON_EN:MON_EL)[pc.m]+': '}),(pr[0].a||'')+' · '+pc.name+' '+kgTxt(pr[0].kg)));
  return fold('chal','🎯 '+T('Πρόκληση ','Challenge · ')+(EN?MON_EN:MON_EL)[c.m]+': '+c.name,T('Το μεγαλύτερο '+c.name.toLowerCase()+' του μήνα κερδίζει σήμα στο προφίλ','The biggest '+c.name.toLowerCase()+' of the month wins a profile badge'),body); }
B.commChal=function(){ var d=new Date(); return chalOf(d.getFullYear(),d.getMonth()); };

function load(reset){
  if(F.loading) return; var keep=reset&&F.cached; if(reset){ if(!keep) F.items=[]; F.offset=0; F.end=false; } if(F.end) return;
  if(F.mode!=='all'&&!sess()){ F.mode='all'; }
  var q='community_posts?select=*,likes:community_likes(count),comments:community_comments(count)&order=created_at.desc&limit='+PAGE+'&offset='+F.offset;
  var plain=F.mode==='all'&&!F.user&&!F.sp&&!F.tech&&!F.offset;
  if(F.mode==='mine') q+='&user_id=eq.'+esc(uid());
  else if(F.mode==='saved'){ var sv=saved(); if(!sv.length){ F.end=true; draw(); return; } q+='&id=in.('+sv.slice(0,100).join(',')+')'; }
  else if(F.mode==='follow'){ var fw=follows(); if(!fw.length){ F.end=true; draw(); return; } q+='&user_id=in.('+fw.map(esc).join(',')+')'; }
  if(F.user) q+='&user_id=eq.'+esc(F.user.u);
  if(F.sp) q+='&species=eq.'+esc(F.sp);
  if(F.tech) q+='&tech=eq.'+esc(F.tech);
  F.loading=true; F.err=''; draw();
  rest(q).then(function(r){ return r.json(); }).then(function(arr){
    if(keep){ F.items=[]; F.cached=false; } if(arr.length<PAGE) F.end=true; F.offset+=arr.length; F.items=F.items.concat(arr); var ids=arr.map(function(p){ return p.id; });
    if(plain) try{ ls.set('alkyon-comm-cache',{t:Date.now(),items:arr.slice(0,PAGE).map(function(p){ var o=Object.assign({},p); delete o._c; return o; })}); }catch(e){}
    if(!ids.length) return; profs(arr.map(function(p){ return p.user_id; })); likers(ids).then(draw);
    if(!sess()) return;
    /* 1.9.63: «Τι ψάρι είναι;» → η απάντηση που διάλεξε ο κάτοχος (σχόλιο του κατόχου που αρχίζει με ✓) */
    var qi=arr.filter(function(p){ return p.cond&&p.cond.k==='id'; }).map(function(p){ return p.id; });
    var pa=qi.length?rest('community_comments?select=post_id,user_id,body&post_id=in.('+qi.join(',')+')&body=like.'+esc('✓*')+'&order=created_at.asc').then(function(r){ return r.json(); }).then(function(c){ c.forEach(function(x){ var p=arr.filter(function(y){ return y.id===x.post_id; })[0]; if(p&&x.user_id===p.user_id) F.ans[p.id]=String(x.body).replace(/^✓\s*/,'').slice(0,60); }); }).catch(function(){}):null;
    return Promise.all([pa,rest('community_likes?select=post_id&user_id=eq.'+esc(uid())+'&post_id=in.('+ids.join(',')+')').then(function(r){ return r.json(); }).then(function(l){ l.forEach(function(x){ F.liked[x.post_id]=1; }); }).catch(function(){})]); })
    .catch(function(e){ F.err=/HTTP 404|relation|does not exist/i.test(String(e&&e.message))?T('Η Κοινότητα ανοίγει σύντομα. Μέχρι τότε μοιράσου ψάρια και σημεία με τους Φίλους σου.','Community is opening soon. Until then, share catches and spots with your Friends.'):T('Δεν φόρτωσαν οι αναρτήσεις. Έλεγξε τη σύνδεση.','Posts did not load. Check your connection.'); })
    .then(function(){ F.loading=false; draw(); });
}
function cnt(p,k){ return (p[k]&&p[k][0]&&p[k][0].count)||0; }
/* 1.9.65: τελευταία λίστα από την αποθήκη, για να ανοίγει αμέσως (και χωρίς σήμα) */
function fromCache(){ var c=ls.get('alkyon-comm-cache',null); if(c&&Array.isArray(c.items)&&c.items.length&&!F.items.length){ F.items=c.items.slice(); F.cached=true; } }
/* 1.9.65: φωτογραφίες προφίλ */
var NAMECOL=true; /* 1.9.67: όνομα στο community_profiles (αν δεν υπάρχει ακόμη η στήλη, συνεχίζει χωρίς) */
function profs(ids){ var need=[]; ids.forEach(function(u){ if(u&&F.prof[u]===undefined&&need.indexOf(u)<0) need.push(u); }); if(!need.length) return; need.forEach(function(u){ F.prof[u]=null; });
  var q=function(c){ return rest('community_profiles?select=user_id,avatar'+(c?',name':'')+'&user_id=in.('+need.map(esc).join(',')+')').then(function(r){ return r.json(); }); };
  (NAMECOL?q(true).catch(function(){ NAMECOL=false; return q(false); }):q(false)).then(function(a){ var ch=0; (a||[]).forEach(function(x){ if(x.avatar){ F.prof[x.user_id]=x.avatar; ch=1; } if(x.name){ F.pname[x.user_id]=x.name; ch=1; } }); if(ch) draw(); }).catch(function(){}); }
/* το όνομά σου στο προφίλ της Κοινότητας (μία φορά ανά άνοιγμα), για να φαίνεται στη λίστα «Άρεσε σε» */
function myProfile(){ if(!sess()||F.myp||!NAMECOL) return; F.myp=1; var o={user_id:uid(),name:author(),updated_at:new Date().toISOString()};
  rest('community_profiles',{method:'POST',body:JSON.stringify(o),headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'}}).then(function(){ F.pname[uid()]=o.name; }).catch(function(){ F.myp=0; }); }
/* ποιος έκανε like: όνομα από το προφίλ, αλλιώς από αναρτήσεις/σχόλια του */
function nameOf(u){ if(F.pname[u]) return F.pname[u]; if(u===uid()) return author(); var p=(F.all||[]).concat(F.items).filter(function(x){ return x.user_id===u&&x.author; })[0]; if(p) return p.author;
  var c=null; F.items.forEach(function(x){ (x._c||[]).forEach(function(y){ if(!c&&y.user_id===u&&y.author) c=y.author; }); }); return c||T('Ψαράς','Angler'); }
function likers(ids){ if(!ids.length) return Promise.resolve(); return rest('community_likes?select=post_id,user_id,created_at&post_id=in.('+ids.join(',')+')&order=created_at.desc').then(function(r){ return r.json(); }).then(function(a){ ids.forEach(function(id){ F.lk[id]=[]; }); (a||[]).forEach(function(x){ (F.lk[x.post_id]=F.lk[x.post_id]||[]).push(x.user_id); }); profs((a||[]).map(function(x){ return x.user_id; })); }).catch(function(){}); }
function likersLine(p){ var a=F.lk[p.id]; if(!a||!a.length) return null; var names=a.slice(0,2).map(nameOf), more=a.length-names.length;
  return h('button',{type:'button',class:'cmlkl',onclick:function(){ likersSheet(p); }},h('span',{class:'cmlkh','aria-hidden':'true',text:'♥'}),T('Άρεσε σε ','Liked by ')+names.join(', ')+(more>0?T(' και '+more+(more===1?' ακόμα':' ακόμα'),' and '+more+' more'):'')); }
function likersSheet(p){ var a=F.lk[p.id]||[], body=h('div',{class:'bform cmlks'}), sh;
  a.forEach(function(u){ body.append(h('button',{type:'button',class:'cmlkr',onclick:function(){ sh.close(); profile(u,nameOf(u)); }},avEl(u,nameOf(u),'sm'),h('b',{text:nameOf(u)+(u===uid()?T(' (εσύ)',' (you)'):'')}),isF(u)?h('small',{text:T('ακολουθείς','following')}):null)); });
  sh=B.sheet({title:T('Άρεσε σε ','Liked by ')+a.length,body:body}); }
B.commLikers=likersSheet;
function avUrl(path){ return SUPA+'/storage/v1/object/public/community/'+path; }
function avEl(u,name,cls){ var a=F.prof[u]; var el=h('span',{class:'cmav'+(cls?' '+cls:'')}); if(a) el.append(h('img',{src:avUrl(a),alt:'',loading:'lazy'})); else el.textContent=(name||'?').charAt(0).toUpperCase(); return el; }
B.commAvatar=function(){ var u=uid(); return u&&F.prof[u]?avUrl(F.prof[u]):(ls.get('alkyon-comm-avatar','')?avUrl(ls.get('alkyon-comm-avatar','')):''); };
function pickAvatar(){ if(!sess()){ needAcc(); return; } var fi=h('input',{type:'file',accept:'image/*'}); fi.addEventListener('change',function(){ var f=fi.files&&fi.files[0]; if(!f) return; B.toast(T('Ανεβαίνει…','Uploading…'));
    squareJpeg(f,320).then(function(jb){ var path=uid()+'/avatar-'+Date.now().toString(36)+'.jpg', old=F.prof[uid()]||ls.get('alkyon-comm-avatar','');
      return C().storage('POST','community/'+path,jb,'image/jpeg').then(function(r){ if(!r.ok) throw new Error('photo '+r.status); return rest('community_profiles',{method:'POST',body:JSON.stringify(Object.assign({user_id:uid(),avatar:path,updated_at:new Date().toISOString()},NAMECOL?{name:author()}:{})),headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'}}); })
        .then(function(){ F.prof[uid()]=path; ls.set('alkyon-comm-avatar',path); if(old&&old!==path) C().storage('DELETE','community/'+old).catch(function(){}); B.toast(T('Η φωτογραφία προφίλ άλλαξε.','Profile photo updated.')); draw(); try{ B.emit('store','alkyon-comm-avatar'); }catch(e){} }); })
    .catch(function(){ B.toast(T('Δεν ανέβηκε η φωτογραφία.','Photo upload failed.')); }); }); fi.click(); }
function removeAvatar(){ var old=F.prof[uid()]||ls.get('alkyon-comm-avatar',''); rest('community_profiles?user_id=eq.'+esc(uid()),{method:'DELETE'}).then(function(){ if(old) C().storage('DELETE','community/'+old).catch(function(){}); F.prof[uid()]=undefined; ls.set('alkyon-comm-avatar',''); draw(); try{ B.emit('store','alkyon-comm-avatar'); }catch(e){} B.toast(T('Αφαιρέθηκε.','Removed.')); }).catch(function(){ B.toast(T('Δεν έγινε.','Failed.')); }); }
B.commAvatarPick=pickAvatar;
/* νέο κινητό: φέρνει τη δική σου φωτογραφία προφίλ μία φορά */
setTimeout(function(){ try{ if(!sess()||ls.get('alkyon-comm-avatar',null)!==null) return; rest('community_profiles?select=avatar&user_id=eq.'+esc(uid())).then(function(r){ return r.json(); }).then(function(a){ var v=(a&&a[0]&&a[0].avatar)||''; ls.set('alkyon-comm-avatar',v); if(v){ F.prof[uid()]=v; try{ B.emit('store','alkyon-comm-avatar'); }catch(e){} } }).catch(function(){}); }catch(e){} },4000);
function squareJpeg(blob,S){ return new Promise(function(res,rej){ var u=URL.createObjectURL(blob), im=new Image(); im.onload=function(){ var m=Math.min(im.width,im.height), cv=document.createElement('canvas'); cv.width=S; cv.height=S;
  cv.getContext('2d').drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,S,S); URL.revokeObjectURL(u); cv.toBlob(function(b){ if(b) res(b); else rej(new Error('jpeg')); },'image/jpeg',0.85); }; im.onerror=function(){ URL.revokeObjectURL(u); rej(new Error('img')); }; im.src=u; }); }
/* 1.9.65: διαχειριστής (app_admins): αναφορές, απόκρυψη */
function checkAdmin(){ if(!sess()||F.admin!==null) return; F.admin=false; rest('rpc/community_is_admin',{method:'POST',body:'{}'}).then(function(r){ return r.json(); }).then(function(v){ F.admin=v===true; if(F.admin) loadReports(); }).catch(function(){}); }
function loadReports(){ rest('rpc/community_reports_list',{method:'POST',body:'{}'}).then(function(r){ return r.json(); }).then(function(a){ F.reports=Array.isArray(a)?a:[]; draw(); }).catch(function(){}); }
function hide(kind,id,on){ return rest('rpc/community_hide',{method:'POST',body:JSON.stringify({kind:kind,target:id,hide:on})}).then(function(){ B.toast(on?T('Κρύφτηκε.','Hidden.'):T('Επανήλθε.','Restored.')); if(kind==='post'&&on) F.items=F.items.filter(function(x){ return x.id!==id; }); F.items.forEach(function(p){ if(p._c) p._c=p._c.filter(function(c){ return !(kind==='comment'&&on&&c.id===id); }); }); loadReports(); draw(); }).catch(function(){ B.toast(T('Δεν έγινε.','Failed.')); }); }
function reportsSheet(){ var body=h('div',{class:'bform cmreps'}), sh;
  function paint(){ body.replaceChildren(); var a=F.reports||[]; if(!a.length){ body.append(h('p',{class:'sub',text:T('Δεν υπάρχουν αναφορές.','No reports.')})); return; }
    a.forEach(function(r){ var c=h('div',{class:'cmrep'+(r.hidden?' hid':'')}); if(r.photo) c.append(h('img',{src:avUrl(r.photo),alt:'',class:'cmrepi'}));
      c.append(h('div',{class:'cmrept'},h('b',{text:(r.kind==='post'?T('Ανάρτηση','Post'):T('Σχόλιο','Comment'))+' · '+(r.author||'')}),h('p',{class:'noik',text:r.body||r.species||''}),h('small',{text:r.reporters+T(' αναφορές · ',' reports · ')+ago(r.created_at)+(r.hidden?T(' · κρυμμένο',' · hidden'):'')}),
        h('div',{class:'cmrepa'},h('button',{class:'btn sm'+(r.hidden?'':' del'),type:'button',text:r.hidden?T('Επαναφορά','Restore'):T('Απόκρυψη','Hide'),onclick:function(){ hide(r.kind,r.target,!r.hidden).then(function(){ setTimeout(paint,600); }); }}),
          h('button',{class:'btn sm',type:'button',text:T('Απόρριψη αναφοράς','Dismiss'),onclick:function(){ rest('rpc/community_report_dismiss',{method:'POST',body:JSON.stringify({kind:r.kind,target:r.target})}).then(function(){ F.reports=F.reports.filter(function(x){ return x!==r; }); paint(); draw(); }).catch(function(){ B.toast(T('Δεν έγινε.','Failed.')); }); }})))); body.append(c); }); }
  paint(); sh=B.sheet({title:T('Αναφορές','Reports'),body:body}); }
B.commReports=reportsSheet;
/* 1.9.65: επεξεργασία δικής σου ανάρτησης */
function editPost(p){ var body=h('div',{class:'bform'}), sh; function fld(lab,el){ return h('label',{class:'fld'},h('span',{text:lab}),el); }
  var sp=h('input',{type:'text',maxlength:'60',value:p.species||''}), kg=h('input',{type:'number',step:'0.01',min:'0',inputmode:'decimal',value:p.kg!=null?p.kg:''}), ln=h('input',{type:'number',step:'1',min:'0',inputmode:'numeric',value:p.len!=null?p.len:''}),
      ba=h('input',{type:'text',maxlength:'60',value:p.bait||''}), te=h('input',{type:'text',maxlength:'40',value:p.tech||''}), q=isQ(p)?h('textarea',{rows:'3',maxlength:'300'}):null; if(q) q.value=(p.cond&&p.cond.q)||'';
  if(q) body.append(fld(T('Κείμενο','Text'),q)); else body.append(fld(T('Είδος','Species'),sp),h('div',{class:'row2'},fld('kg',kg),fld('cm',ln)),fld(T('Δόλωμα','Bait'),ba),fld(T('Τεχνική','Technique'),te));
  body.append(h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ var o; if(q){ o={cond:Object.assign({},p.cond||{},{q:q.value.trim().slice(0,300)})}; } else { if(!sp.value.trim()){ B.toast(T('Λείπει το είδος.','Species is missing.')); return; }
      o={species:sp.value.trim().slice(0,60),kg:kg.value!==''&&isFinite(+kg.value)?Math.min(2000,Math.max(0,+kg.value)):null,len:ln.value!==''&&isFinite(+ln.value)?Math.min(1000,Math.max(0,+ln.value)):null,bait:ba.value.trim().slice(0,60)||null,tech:te.value.trim().slice(0,40)||null}; if(o.species!==p.species) o.latin=null; }
    rest('community_posts?id=eq.'+p.id,{method:'PATCH',body:JSON.stringify(o),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(){ Object.assign(p,o); (F.all||[]).forEach(function(x){ if(x.id===p.id) Object.assign(x,o); }); sh.close(); B.toast(T('Αποθηκεύτηκε.','Saved.')); draw(); })
      .catch(function(){ B.toast(T('Δεν αποθηκεύτηκε.','Not saved.')); }); }}));
  sh=B.sheet({title:T('Επεξεργασία ανάρτησης','Edit post'),body:body}); }
B.commEdit=editPost;
/* 1.9.65: like σε σχόλια */
function likeC(c){ if(!sess()){ needAcc(); return; } var on=!!F.cliked[c.id], n=F.clk[c.id]||0; F.cliked[c.id]=on?0:1; F.clk[c.id]=Math.max(0,n+(on?-1:1)); draw();
  (on?rest('community_comment_likes?comment_id=eq.'+c.id+'&user_id=eq.'+esc(uid()),{method:'DELETE'}):rest('community_comment_likes',{method:'POST',body:JSON.stringify({comment_id:c.id}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}))
    .catch(function(){ F.cliked[c.id]=on?1:0; F.clk[c.id]=n; draw(); B.toast(T('Δεν έγινε.','Failed.')); }); }
/* 1.9.65: πρόσκληση φίλου */
var APPURL=(window.AKN||/(^|\.)alkyonfishing\.com$/.test(location.hostname)?'https://alkyonfishing.com':'https://dinospapani.github.io/Alkyon')+'/v4/?inv=1#community'; /* 1.12.0: νέο domain */
function invite(){ var txt=T('Έλα στο Alkyon: πρόγνωση για ψάρεμα, ημερολόγιο και Κοινότητα ψαράδων σε Κύπρο και Ελλάδα. Δωρεάν.','Join me on Alkyon: fishing forecast, logbook and an anglers’ Community in Cyprus and Greece. Free.');
  if(navigator.share) return navigator.share({title:'Alkyon',text:txt,url:APPURL}).then(function(){ return 'shared'; }).catch(function(){ return 'cancel'; });
  var all=txt+' '+APPURL, done=function(ok){ B.toast(ok?T('Ο σύνδεσμος αντιγράφηκε. Στείλ’ τον σε φίλο.','Link copied. Send it to a friend.'):all); return 'copied'; };
  try{ return navigator.clipboard.writeText(all).then(function(){ return done(true); },function(){ return done(false); }); }catch(e){ return Promise.resolve(done(false)); } }
B.commInvite=invite;
/* 1.9.65: όποιος ανοίγει τον σύνδεσμο πρόσκλησης στον browser βλέπει πώς να την εγκαταστήσει (μία φορά) */
var BIP=null; window.addEventListener('beforeinstallprompt',function(e){ e.preventDefault(); BIP=e; });
function installSheet(){ var ios=/iphone|ipad|ipod/i.test(navigator.userAgent), body=h('div',{class:'bform'}), sh;
  body.append(h('p',{text:T('Το Alkyon είναι δωρεάν εφαρμογή για ψάρεμα σε Κύπρο και Ελλάδα: πρόγνωση, ημερολόγιο, χάρτης και Κοινότητα.','Alkyon is a free fishing app for Cyprus and Greece: forecast, logbook, map and Community.')}));
  if(BIP) body.append(h('button',{class:'btn pri full',type:'button',text:T('Εγκατάσταση','Install'),onclick:function(){ try{ BIP.prompt(); }catch(e){} sh.close(); }}));
  body.append(h('p',{class:'sub',text:ios?T('iPhone: πάτα Κοινή χρήση (το τετράγωνο με το βέλος) › «Προσθήκη στην οθόνη Αφετηρίας». Έτσι δουλεύουν και οι ειδοποιήσεις.','iPhone: tap Share (the square with the arrow) › "Add to Home Screen". Notifications work only this way.'):T('Android: μενού ⋮ του Chrome › «Εγκατάσταση εφαρμογής» ή «Προσθήκη στην αρχική οθόνη».','Android: Chrome menu ⋮ › "Install app" or "Add to Home screen".')}));
  body.append(h('button',{class:'btn full',type:'button',text:T('Συνέχεια στον browser','Continue in the browser'),onclick:function(){ sh.close(); }}));
  sh=B.sheet({title:T('Καλώς ήρθες στο Alkyon','Welcome to Alkyon'),body:body}); }
B.commInstall=installSheet;
try{ if(/[?&]inv=1/.test(location.search)&&!(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)&&!navigator.standalone&&!ls.get('alkyon-inv-seen',0)){ ls.set('alkyon-inv-seen',1); setTimeout(installSheet,2500); } }catch(e){}
/* 1.9.63: όλες οι αναρτήσεις (μόνο τα στοιχεία, έως 1000) για εβδομάδα, κατάταξη, ρεκόρ, φίλτρα και προφίλ */
function loadAll(force){ if(F.allBusy||(!force&&F.all&&Date.now()-F.allT<120000)) return; F.allBusy=1;
  rest('community_posts?select=id,user_id,author,species,latin,kg,len,tech,bait,day,cond,created_at&order=created_at.asc&limit=1000').then(function(r){ return r.json(); }).then(function(a){ if(Array.isArray(a)){ F.all=a; F.allT=Date.now(); } }).catch(function(){}).then(function(){ F.allBusy=0; draw(); }); }
function fishAll(){ var bl=blocked(); return (F.all||[]).filter(function(p){ return !isQ(p)&&bl.indexOf(p.user_id)<0&&p.species; }); }
function catches(p){ var a=[{s:p.species,kg:p.kg!=null?+p.kg:null}]; var m=p.cond&&Array.isArray(p.cond.more)?p.cond.more:[]; m.forEach(function(x){ if(x&&x.s) a.push({s:x.s,kg:x.kg!=null?+x.kg:null}); }); return a; }
/* ρεκόρ Κοινότητας ανά είδος: η πρώτη ανάρτηση με το μεγαλύτερο βάρος (μόνο το κύριο ψάρι, που έχει φωτογραφία) */
function records(){ var r={}, n={}; fishAll().forEach(function(p){ var k=p.kg!=null?+p.kg:0; if(!(k>0)) return; n[p.species]=(n[p.species]||0)+1; var c=r[p.species]; if(!c||k>c.kg) r[p.species]={kg:k,id:p.id,author:p.author,u:p.user_id}; });
  Object.keys(r).forEach(function(k){ if(n[k]<2) delete r[k]; }); return r; } /* ρεκόρ μόνο όταν υπάρχουν τουλάχιστον 2 αναρτήσεις του είδους (όπως και ο server) */
function top(obj,n){ return Object.keys(obj).sort(function(a,b){ return obj[b]-obj[a]||a.localeCompare(b); }).slice(0,n); }
var MON_EL=['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου','Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'], MON_EN=['January','February','March','April','May','June','July','August','September','October','November','December'];
/* 1.9.66: «αυτή την εβδομάδα» = ψάρια που ΠΙΑΣΤΗΚΑΝ τις τελευταίες 7 μέρες (ημερομηνία ψαριού), όχι παλιά ψάρια που μοιράστηκαν τώρα */
function caughtMs(p){ var d=p.day?Date.parse(p.day+'T12:00:00'):NaN; return isFinite(d)?d:Date.parse(p.created_at); }
function weekCard(){ var since=Date.now()-7.5*864e5, ps=fishAll().filter(function(p){ return caughtMs(p)>=since; }); if(!ps.length) return null;
  var sp={}, te={}, ba={}, ar={}, who={}; ps.forEach(function(p){ who[p.user_id]=1; catches(p).forEach(function(c){ sp[c.s]=(sp[c.s]||0)+1; }); if(p.tech) te[p.tech]=(te[p.tech]||0)+1; if(p.bait) ba[p.bait]=(ba[p.bait]||0)+1; if(p.cond&&p.cond.area) ar[p.cond.area]=(ar[p.cond.area]||0)+1; });
  var body=h('div',{class:'cmtopb'}), cr=h('div',{class:'chips'}); top(sp,6).forEach(function(k){ cr.append(h('button',{type:'button',class:'chip sm'+(F.sp===k?' on':''),text:k+' '+sp[k],onclick:function(){ setFilter('sp',F.sp===k?'':k); }})); }); body.append(cr);
  function line(lab,o){ var k=top(o,3); if(k.length) body.append(h('p',{class:'sub cmwl'},h('b',{text:lab+' '}),k.join(' · '))); }
  line(T('Τεχνική:','Technique:'),te); line(T('Δόλωμα:','Bait:'),ba); line(T('Περιοχή:','Area:'),ar);
  return fold('week',T('Τι πιάνεται αυτή την εβδομάδα','What is biting this week'),ps.length+T(' αναρτήσεις · ',' posts · ')+Object.keys(who).length+T(' ψαράδες',' anglers'),body); }
function boardCard(){ var d=new Date(), ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), best={};
  fishAll().forEach(function(p){ var m=(p.day||String(p.created_at||'').slice(0,10)).slice(0,7); if(m!==ym) return; catches(p).forEach(function(c){ if(!(c.kg>0)) return; var b=best[c.s]; if(!b||c.kg>b.kg) best[c.s]={kg:c.kg,a:p.author,u:p.user_id}; }); });
  var ks=Object.keys(best).sort(function(a,b){ return best[b].kg-best[a].kg; }).slice(0,10); if(!ks.length) return null;
  var body=h('div',{class:'cmtopb'}); ks.forEach(function(k,i){ var b=best[k]; body.append(h('div',{class:'cmlb'},h('span',{class:'cmlbn',text:String(i+1)}),h('b',{text:k}),h('span',{text:kgTxt(b.kg)}),h('button',{type:'button',class:'linkbtn',text:b.a||T('Ψαράς','Angler'),onclick:function(){ profile(b.u,b.a); }}))); });
  return fold('board',T('Κατάταξη ','Leaderboard · ')+(EN?MON_EN:MON_EL)[d.getMonth()],T('Το μεγαλύτερο ψάρι ανά είδος αυτόν τον μήνα','Biggest fish per species this month'),body); }
function fold(k,title,sub,body){ var open=!!F.top[k], c=h('section',{class:'card cmtop'+(open?' open':'')});
  c.append(h('button',{type:'button',class:'cmtoph','aria-expanded':String(open),onclick:function(){ F.top[k]=!F.top[k]; draw(); }},h('span',null,h('b',{text:title}),h('small',{text:sub})),h('span',{class:'cmchev','aria-hidden':'true',text:open?'▴':'▾'})));
  if(open) c.append(body); return c; }
function setFilter(k,v){ F[k]=v; load(true); }
function filters(){ var fa=fishAll(); if(fa.length<3&&!F.sp&&!F.tech&&!F.user) return null; var sp={}, te={}; fa.forEach(function(p){ sp[p.species]=(sp[p.species]||0)+1; if(p.tech) te[p.tech]=(te[p.tech]||0)+1; });
  var w=h('div',{class:'cmflt'}), r1=h('div',{class:'chips cmscroll'}), r2=h('div',{class:'chips cmscroll'});
  if(F.user) r1.append(h('button',{type:'button',class:'chip sm on',text:(F.user.n||T('Ψαράς','Angler'))+' ✕',onclick:function(){ F.user=null; load(true); }}));
  r1.append(h('button',{type:'button',class:'chip sm'+(!F.sp?' on':''),text:T('Όλα τα είδη','All species'),onclick:function(){ setFilter('sp',''); }}));
  var ks=top(sp,10); if(F.sp&&ks.indexOf(F.sp)<0) ks.unshift(F.sp); ks.forEach(function(k){ r1.append(h('button',{type:'button',class:'chip sm'+(F.sp===k?' on':''),text:k,onclick:function(){ setFilter('sp',F.sp===k?'':k); }})); });
  var kt=top(te,6); if(F.tech&&kt.indexOf(F.tech)<0) kt.unshift(F.tech);
  if(kt.length){ r2.append(h('button',{type:'button',class:'chip sm'+(!F.tech?' on':''),text:T('Όλες οι τεχνικές','All techniques'),onclick:function(){ setFilter('tech',''); }})); kt.forEach(function(k){ r2.append(h('button',{type:'button',class:'chip sm'+(F.tech===k?' on':''),text:k,onclick:function(){ setFilter('tech',F.tech===k?'':k); }})); }); }
  w.append(r1); if(kt.length) w.append(r2); return w; }
/* 1.9.63: προφίλ ψαρά */
function profile(u,name){ if(!u) return; var ps=(F.all||[]).filter(function(p){ return p.user_id===u; }), fish=ps.filter(function(p){ return !isQ(p); }), body=h('div',{class:'bform cmprof'}), sh;
  name=name||(ps[0]&&ps[0].author)||T('Ψαράς','Angler');
  var sp={}, te={}, rel=0, n=0, best={}; fish.forEach(function(p){ if(p.cond&&p.cond.rel) rel++; if(p.tech) te[p.tech]=(te[p.tech]||0)+1; catches(p).forEach(function(c){ n++; sp[c.s]=(sp[c.s]||0)+1; if(c.kg>0&&(!best[c.s]||c.kg>best[c.s])) best[c.s]=c.kg; }); });
  var rec=records(), mineRec=Object.keys(rec).filter(function(k){ return rec[k].u===u; });
  profs([u]);
  body.append(h('div',{class:'cmphd'},avEl(u,name,'big'),h('div',null,h('b',{text:name}),h('small',{text:fish.length+T(' αναρτήσεις · ',' posts · ')+n+T(' ψάρια',' fish')+(rel?' · '+rel+T(' απελευθερώθηκαν',' released'):'')}))));
  var st=h('div',{class:'cmstats'}); function cell(v,l){ st.append(h('div',null,h('b',{text:String(v)}),h('small',{text:l}))); }
  cell(Object.keys(sp).length,T('είδη','species')); cell(rel,T('απελευθερώθηκαν','released')); cell(mineRec.length,T('ρεκόρ Κοινότητας','Community records')); body.append(st);
  body.append(badgesEl(badges(u)));
  var bk=Object.keys(best).sort(function(a,b){ return best[b]-best[a]; }).slice(0,6);
  if(bk.length){ body.append(h('h3',{text:T('Μεγαλύτερα ψάρια','Biggest fish')})); bk.forEach(function(k){ body.append(h('div',{class:'mrow'},h('span',{text:(mineRec.indexOf(k)>=0?'🏆 ':'')+k}),h('b',{text:kgTxt(best[k])}))); }); }
  /* 1.9.67: «Πιάνει συχνότερα» μόνο για είδη με 2+ ψάρια (αλλιώς είναι απλώς αλφαβητική λίστα) */
  var tk=top(sp,3).filter(function(k){ return sp[k]>=2; }), tt=top(te,2); if(tk.length) body.append(h('p',{class:'sub',text:T('Πιάνει συχνότερα: ','Catches most: ')+tk.join(', ')+(tt.length?T(' · Τεχνική: ',' · Technique: ')+tt.join(', '):'')}));
  if(u===uid()&&sess()) body.append(h('div',{class:'row2'},h('button',{class:'btn pri',type:'button',text:F.prof[u]?T('Άλλαξε φωτογραφία','Change photo'):T('Βάλε φωτογραφία','Add photo'),onclick:function(){ sh.close(); pickAvatar(); }}),F.prof[u]?h('button',{class:'btn',type:'button',text:T('Αφαίρεση','Remove'),onclick:function(){ sh.close(); removeAvatar(); }}):null));
  if(u!==uid()&&sess()) body.append(h('button',{class:'btn full'+(isF(u)?'':' pri'),type:'button',text:isF(u)?T('✓ Ακολουθείς','✓ Following'):T('Ακολούθησε','Follow'),onclick:function(){ toggleFollow(u,name); sh.close(); }}));
  body.append(h('button',{class:'btn full',type:'button',text:u===uid()?T('Οι αναρτήσεις μου','My posts'):T('Οι αναρτήσεις του','Their posts'),onclick:function(){ sh.close(); F.user={u:u,n:name}; F.mode='all'; load(true); }}));
  sh=B.sheet({title:u===uid()?T('Το προφίλ μου','My profile'):T('Προφίλ ψαρά','Angler profile'),body:body}); }
B.commProfile=profile;
/* 1.9.64: σήματα επιτευγμάτων (υπολογίζονται από τις αναρτήσεις του, ίδια για όλους) */
function badges(u){ var fish=(F.all||[]).filter(function(p){ return p.user_id===u&&!isQ(p)&&p.species; }), keys={}, rel=0, big=0, sq=false;
  fish.forEach(function(p){ if(p.cond&&p.cond.rel) rel++; [{s:p.species,la:p.latin,kg:p.kg}].concat((p.cond&&Array.isArray(p.cond.more)?p.cond.more:[]).map(function(x){ return {s:x.s,kg:x.kg}; })).forEach(function(x){ var k=spKey(x.s,x.la); keys[k]=1; if(+x.kg>=5) big=1; if(k==='loligo vulgaris') sq=true; }); });
  var nsp=Object.keys(keys).length, rc=records(), nrec=Object.keys(rc).filter(function(k){ return rc[k].u===u; }).length, wins=chalWins(u);
  return [[fish.length>=1,'🐟',T('Πρώτη ανάρτηση','First post')],[fish.length>=10,'⭐',T('10 αναρτήσεις','10 posts')],[nsp>=5,'🌊',T('5 είδη','5 species')],[nsp>=10,'🏝',T('10 είδη','10 species')],
    [sq,'🌙',T('Πρώτο καλαμάρι','First squid')],[rel>=5,'❤',T('5 απελευθερώσεις','5 releases')],[big,'⚓',T('Ψάρι 5+ kg','5+ kg fish')],[nrec>0,'🏆',T('Ρεκόρ Κοινότητας','Community record')],[wins>0,'🎯',T('Νικητής πρόκλησης','Challenge winner')+(wins>1?' ×'+wins:'')]]; }
function badgesEl(bs){ var n=bs.filter(function(b){ return b[0]; }).length, w=h('div',{class:'cmbadges'},h('h3',{text:T('Σήματα ','Badges ')+n+'/'+bs.length})), g=h('div',{class:'cmbg'});
  bs.forEach(function(b){ g.append(h('span',{class:'cmbadge'+(b[0]?' on':''),title:b[2]},h('span',{class:'cmbi','aria-hidden':'true',text:b[1]}),h('small',{text:b[2]}))); }); w.append(g); return w; }
B.commBadges=badges;
/* 1.9.64: η ανάρτηση σαν εικόνα (φωτογραφία, είδος, βάρος, όνομα, logo) για WhatsApp/Instagram */
function loadImg(src){ return fetch(src).then(function(r){ if(!r.ok) throw new Error('img'); return r.blob(); }).then(function(b){ return createImageBitmap(b); }); }
function shareImg(p){ var W=1080, H=1350, cv=document.createElement('canvas'); cv.width=W; cv.height=H; var g=cv.getContext('2d');
  var ph=p.photo?loadImg(SUPA+'/storage/v1/object/public/community/'+p.photo).catch(function(){ return null; }):Promise.resolve(null), lg=loadImg('../icon-192.png').catch(function(){ return null; });
  B.toast(T('Ετοιμάζεται η εικόνα…','Preparing the image…'));
  return Promise.all([ph,lg]).then(function(r){ var im=r[0], logo=r[1];
    var gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'#0e3a4a'); gr.addColorStop(1,'#071c25'); g.fillStyle=gr; g.fillRect(0,0,W,H);
    if(im){ var s=Math.max(W/im.width,1080/im.height), w=im.width*s, hh=im.height*s; g.save(); g.beginPath(); g.rect(0,0,W,1080); g.clip(); g.drawImage(im,(W-w)/2,(1080-hh)/2,w,hh); g.restore(); }
    g.fillStyle='#071c25'; g.fillRect(0,1080,W,270);
    var sz=[]; if(p.kg!=null) sz.push(kgTxt(p.kg)); if(p.len!=null) sz.push(+p.len+' cm'); var more=p.cond&&Array.isArray(p.cond.more)?p.cond.more:[];
    g.fillStyle='#fff'; g.font='800 64px system-ui,sans-serif'; g.textBaseline='alphabetic'; g.fillText(String(p.species||'').slice(0,24),56,1170);
    g.fillStyle='#ff8a5c'; g.font='700 52px system-ui,sans-serif'; g.fillText(sz.join(' · ')+(more.length?'  +'+more.length:''),56,1240);
    g.fillStyle='#9fb6bf'; g.font='500 34px system-ui,sans-serif'; g.fillText([p.author,p.day?p.day.split('-').reverse().join('/'):''].filter(Boolean).join(' · ').slice(0,44),56,1300);
    if(logo) g.drawImage(logo,W-56-110,1110,110,110); g.fillStyle='#fff'; g.font='800 34px system-ui,sans-serif'; g.textAlign='right'; g.fillText('Alkyon',W-56,1270); g.fillStyle='#9fb6bf'; g.font='500 24px system-ui,sans-serif'; g.fillText(B.country&&B.country()==='gr'?T('Ψάρεμα στην Ελλάδα','Fishing in Greece'):T('Ψάρεμα στην Κύπρο','Fishing in Cyprus'),W-56,1305); g.textAlign='left';
    return new Promise(function(res){ cv.toBlob(res,'image/jpeg',0.9); }); }).then(function(blob){ if(!blob) throw new Error('blob');
    var name='alkyon-'+String(p.species||'catch').replace(/\s+/g,'-').toLowerCase()+'.jpg', file=null; try{ file=new File([blob],name,{type:'image/jpeg'}); }catch(e){}
    if(file&&navigator.canShare&&navigator.canShare({files:[file]})) return navigator.share({files:[file],title:'Alkyon',text:(p.species||'')+(p.kg!=null?' '+kgTxt(p.kg):'')}).catch(function(){});
    var a=document.createElement('a'), u=URL.createObjectURL(blob); a.href=u; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(u); },4000); B.toast(T('Η εικόνα αποθηκεύτηκε.','Image saved.')); return 'dl'; })
    .catch(function(){ B.toast(T('Δεν έγινε η εικόνα.','Could not make the image.')); }); }
B.commShareImg=shareImg;
/* 1.9.64: «Οι συνθήκες τότε και αύριο» (στο μέρος που έχεις επιλέξει στην Πρόγνωση) */
function fcPlace(){ var id=ls.get('alkyon-fcsel','gps'), a=ls.get('alkyon-places',[]); a=Array.isArray(a)?a:[]; var p=a.filter(function(x){ return x.id===id; })[0];
  if(p&&p.lat!=null) return p; var g=B.lastPos&&B.lastPos(); if(g) return {name:T('Η θέση μου','My location'),lat:g.lat,lon:g.lon}; return a[0]||{name:'Λεμεσός',lat:34.66,lon:33.04}; }
function compare(p){ var c=p.cond||{}, pl=fcPlace(), body=h('div',{class:'bform cmcmp'}), sh; body.append(h('p',{class:'sub',text:T('Αύριο στο: ','Tomorrow at: ')+(pl.name||'')+' · '+T('μέση τιμή της ημέρας','daytime average')})); var tb=h('div',{class:'cmcmpt'},h('div',{class:'sk',style:{height:'160px'}})); body.append(tb);
  sh=B.sheet({title:T('Οι συνθήκες τότε και αύριο','Conditions then and tomorrow'),body:body});
  PF.getForecast(+pl.lat,+pl.lon,null,{days:3}).then(function(fc){ var today=fc.nowLocal.slice(0,10), d=fc.days.filter(function(x){ return x.date>today; })[0]; if(!d) throw new Error('no day');
    var hrs=d.hours.filter(function(x){ return x.hr>=6&&x.hr<=20; }), av=function(k){ var a=hrs.map(function(x){ return x[k]; }).filter(function(v){ return typeof v==='number'; }); return a.length?a.reduce(function(x,y){ return x+y; },0)/a.length:null; };
    var tm={wind:av('wind'),wave:av('wave'),press:av('pres'),sst:av('sst'),moon:Math.round(d.f*8)%8};
    var R=[['wind',T('Άνεμος','Wind'),function(v){ return Math.round(v)+' kn'; },4],['wave',T('Κύμα','Waves'),function(v){ return B.num(v,1)+' m'; },0.3],['press',T('Πίεση','Pressure'),function(v){ return Math.round(v)+' hPa'; },4],['sst',T('Νερό','Water'),function(v){ return Math.round(v)+'°'; },1.5],['moon',T('Σελήνη','Moon'),function(v){ return MOON[v]||''; },1]];
    var n=0, ok=0, t=h('div',{class:'cmcmpt'}); t.append(h('div',{class:'cmcr hd'},h('span'),h('b',{text:T('Τότε','Then')}),h('b',{text:T('Αύριο','Tomorrow')})));
    R.forEach(function(r){ var a=c[r[0]], b=tm[r[0]]; if(a==null||b==null) return; n++; var dv=r[0]==='moon'?Math.min(Math.abs(a-b),8-Math.abs(a-b)):Math.abs(a-b), same=dv<=r[3]; if(same) ok++;
      t.append(h('div',{class:'cmcr'+(same?' ok':'')},h('span',{text:r[1]}),h('b',{text:r[2](a)}),h('b',{text:r[2](b)+(same?' ✓':'')}))); });
    if(!n) throw new Error('no cond');
    tb.replaceWith(t); t.after(h('p',{class:'cmverd'+(ok/n>=0.75?' good':''),text:ok/n>=0.75?T('Αύριο μοιάζει πολύ με τότε ('+ok+'/'+n+').','Tomorrow looks a lot like then ('+ok+'/'+n+').'):T('Ίδια σε '+ok+' από '+n+'.','Similar in '+ok+' of '+n+'.')})); })
    .catch(function(){ tb.replaceChildren(h('p',{class:'sub',text:T('Δεν φόρτωσε η πρόγνωση.','Could not load the forecast.')})); }); }
B.commCompare=compare;
/* 1.9.61: άμεση ειδοποίηση των άλλων (αλλιώς ο server τη στέλνει στον επόμενο έλεγχο, έως 5′ μετά) */
function pingComm(){ try{ var s=B.cloud&&B.cloud.session&&B.cloud.session(); if(!s||!s.access_token) return;
  setTimeout(function(){ fetch('https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/quick-processor',{method:'POST',headers:{apikey:'sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA','Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({action:'comm'})}).catch(function(){}); },1500); }catch(e){} }
B.pingComm=pingComm;
function like(p){ if(!sess()){ needAcc(); return; } myProfile(); var on=!!F.liked[p.id], n=cnt(p,'likes'); F.liked[p.id]=on?0:1;
  var L=F.lk[p.id]||[]; F.lk[p.id]=on?L.filter(function(u){ return u!==uid(); }):[uid()].concat(L.filter(function(u){ return u!==uid(); })); p.likes=[{count:Math.max(0,n+(on?-1:1))}]; draw();
  (on?rest('community_likes?post_id=eq.'+p.id+'&user_id=eq.'+esc(uid()),{method:'DELETE'}):rest('community_likes',{method:'POST',body:JSON.stringify({post_id:p.id}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(r){ pingComm(); return r; }))
    .catch(function(){ F.liked[p.id]=on?1:0; p.likes=[{count:n}]; draw(); B.toast(T('Δεν έγινε. Δοκίμασε ξανά.','Failed. Try again.')); }); }
function comments(p){ return rest('community_comments?select=*,likes:community_comment_likes(count)&post_id=eq.'+p.id+'&order=created_at.asc&limit=100').then(function(r){ return r.json(); }).then(function(c){ p._c=c; p._cerr=0; c.forEach(function(x){ F.clk[x.id]=cnt(x,'likes'); }); profs(c.map(function(x){ return x.user_id; }));
    if(sess()&&c.length) return rest('community_comment_likes?select=comment_id&user_id=eq.'+esc(uid())+'&comment_id=in.('+c.map(function(x){ return x.id; }).join(',')+')').then(function(r){ return r.json(); }).then(function(l){ l.forEach(function(x){ F.cliked[x.comment_id]=1; }); }).catch(function(){}); })
  .catch(function(){ p._c=[]; p._cerr=1; }).then(draw); }
function comment(p,txt){ txt=(txt||'').trim(); if(!txt) return;
  rest('community_comments',{method:'POST',body:JSON.stringify({post_id:p.id,author:author(),body:txt.slice(0,300)}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(){ pingComm(); p.comments=[{count:cnt(p,'comments')+1}]; return comments(p); })
    .catch(function(e){ B.toast(/rate/i.test(String(e&&e.message))?T('Πολλά σχόλια σήμερα.','Too many comments today.'):T('Το σχόλιο δεν στάλθηκε.','Comment not sent.')); }); }
function report(kind,id){ B.ask(T('Να αναφερθεί αυτό το περιεχόμενο ως ακατάλληλο;','Report this content as inappropriate?'),T('Αναφορά','Report')).then(function(y){ if(!y) return;
  rest('community_reports',{method:'POST',body:JSON.stringify(kind==='post'?{post_id:id}:{comment_id:id}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}).then(function(){ B.toast(T('Ευχαριστούμε. Θα ελεγχθεί.','Thanks. It will be reviewed.')); },function(){ B.toast(T('Δεν στάλθηκε η αναφορά.','Report not sent.')); }); }); }
function delPost(p){ B.ask(T('Να διαγραφεί η ανάρτηση από την κοινότητα;','Delete this post from the community?'),T('Διαγραφή','Delete'),true).then(function(y){ if(!y) return;
  rest('community_posts?id=eq.'+p.id,{method:'DELETE'}).then(function(){ if(p.photo){ C().storage('DELETE','community/'+p.photo).catch(function(){}); if(p.cond&&p.cond.th) C().storage('DELETE','community/'+p.photo.replace(/\.jpg$/,'_t.jpg')).catch(function(){}); }
    F.items=F.items.filter(function(x){ return x!==p; }); var sh=ls.get('alkyon-comm-shared',{})||{}; Object.keys(sh).forEach(function(k){ if(sh[k]===p.id) delete sh[k]; }); ls.set('alkyon-comm-shared',sh); draw(); },function(){ B.toast(T('Δεν διαγράφηκε.','Not deleted.')); }); }); }
function delComment(p,c){ rest('community_comments?id=eq.'+c.id,{method:'DELETE'}).then(function(){ p._c=(p._c||[]).filter(function(x){ return x!==c; }); p.comments=[{count:Math.max(0,cnt(p,'comments')-1)}]; draw(); },function(){ B.toast(T('Δεν διαγράφηκε.','Not deleted.')); }); }

/* 1.9.63: ο κάτοχος διαλέγει το σωστό είδος· γράφεται σαν σχόλιο «✓ Είδος» και, αν η ερώτηση ήρθε από ψάρι του Ημερολογίου, μπαίνει και εκεί */
function accept(p,txt){ var body=h('div',{class:'bform'}), sh, inp=h('input',{type:'text',maxlength:'60',value:String(txt||'').replace(/^@\S+\s*/,'').replace(/[.!;?]+$/,'').trim().slice(0,60),'aria-label':T('Είδος','Species')});
  body.append(h('p',{class:'sub',text:T('Γράψε το είδος όπως θα μπει (μπορείς να το διορθώσεις).','Type the species as it will be saved (you can correct it).')}),inp,
    h('button',{class:'btn pri full',type:'button',text:T('Επιβεβαίωση','Confirm'),onclick:function(){ var sp=inp.value.trim(); if(!sp) return; sh.close(); F.ans[p.id]=sp; comment(p,'✓ '+sp);
      try{ var bt=B.store.raw('bites').filter(function(x){ return x.id===p.src&&!x.deleted; })[0]; if(bt){ B.store.save('bites',Object.assign({},bt,{species:sp,_u:Date.now()})); B.toast(T('Μπήκε στο Ημερολόγιο: ','Saved to your Log: ')+sp); } }catch(e){} }}));
  sh=B.sheet({title:T('Τι ψάρι είναι','What fish it is'),body:body}); }
B.commAccept=accept;
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
    if(!sess()){ needAcc(); return; }
    if(mine) body.append(h('button',{class:'btn full',type:'button',text:T('Επεξεργασία','Edit'),onclick:function(){ sh.close(true); editPost(p); }}),h('button',{class:'btn full del',type:'button',text:T('Διαγραφή ανάρτησης','Delete post'),onclick:function(){ sh.close(true); delPost(p); }}));
    else if(F.admin) body.append(h('button',{class:'btn full del',type:'button',text:T('Απόκρυψη (διαχειριστής)','Hide (admin)'),onclick:function(){ sh.close(true); hide('post',p.id,true); }}));
    else body.append(h('button',{class:'btn full',type:'button',text:isF(p.user_id)?T('Να μην ακολουθώ','Unfollow'):T('Ακολούθησε','Follow'),onclick:function(){ sh.close(); toggleFollow(p.user_id,p.author); }}),h('button',{class:'btn full',type:'button',text:T('Αναφορά','Report'),onclick:function(){ sh.close(true); report('post',p.id); }}),h('button',{class:'btn full',type:'button',text:T('Απόκρυψη χρήστη','Hide this user'),onclick:function(){ var b=blocked(); b.push(p.user_id); ls.set('alkyon-comm-block',b); sh.close(); draw(); }}));
    sh=B.sheet({title:p.species||T('Ανάρτηση','Post'),body:body}); }});
  var fw=!mine&&isF(p.user_id);
  card.append(h('div',{class:'cmhd'},h('button',{type:'button',class:'cmwhob','aria-label':T('Προφίλ: ','Profile: ')+(p.author||''),onclick:function(){ profile(p.user_id,p.author); }},avEl(p.user_id,p.author),h('span',{class:'cmwho'},h('b',{text:(p.author||T('Ψαράς','Angler'))+(fw?' ✓':'')}),h('small',{text:ago(p.created_at)}))),more));
  var c0=p.cond||{}, qk=isQ(p)?c0.k:'';
  if(qk){ card.classList.add('cmqpost'); card.append(h('span',{class:'cmqk',text:qk==='id'?T('Τι ψάρι είναι;','What fish is this?'):T('Ερώτηση','Question')}));
    if(c0.q) card.append(h('p',{class:'cmq noik',text:String(c0.q).slice(0,300)})); }
  if(p.photo){ var src=SUPA+'/storage/v1/object/public/community/'+p.photo, thumb=(p.cond&&p.cond.th)?src.replace(/\.jpg$/,'_t.jpg'):src, tapT=null, hrt=h('span',{class:'cmheart','aria-hidden':'true',text:'♥'});
    var ph=h('div',{class:'cmph',role:'button',tabindex:'0','aria-label':T('Φωτογραφία σε πλήρη οθόνη. Διπλό πάτημα για like.','Full-screen photo. Double tap to like.')},h('img',{class:'cmimg',loading:'lazy',decoding:'async',alt:p.species||'',src:thumb,onerror:function(){ if(this.src!==src) this.src=src; }}),hrt);
    ph.addEventListener('click',function(){ if(tapT){ clearTimeout(tapT); tapT=null; if(!F.liked[p.id]) like(p); hrt.classList.remove('go'); void hrt.offsetWidth; hrt.classList.add('go'); return; }
      tapT=setTimeout(function(){ tapT=null; viewer(src,p.species); },280); });
    ph.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); viewer(src,p.species); } });
    card.append(ph); }
  var more=Array.isArray(c0.more)?c0.more.filter(function(x){ return x&&x.s; }).slice(0,8):[];
  var sz=[]; if(p.kg!=null) sz.push(kgTxt(p.kg)); if(p.len!=null) sz.push(+p.len+' cm');
  if(qk==='id'){ if(F.ans[p.id]) card.append(h('div',{class:'cmtitle cmans'},h('b',{text:'✓ '+F.ans[p.id]}),h('span',{text:T('αναγνωρίστηκε','identified')}))); }
  else if(!qk){ var rc=records()[p.species], isRec=rc&&rc.id===p.id;
    card.append(h('div',{class:'cmtitle'},h('b',{text:p.species||''}),sz.length?h('span',{text:sz.join(' · ')}):null,isRec?h('span',{class:'cmrec',text:'🏆 '+T('Ρεκόρ Κοινότητας','Community record')}):null,c0.rel?h('span',{class:'cmrel',text:T('Απελευθερώθηκε','Released')}):null)); }
  if(more.length){ var tot=(p.kg!=null?+p.kg:0), nk=p.kg!=null?1:0; more.forEach(function(x){ if(x.kg!=null){ tot+=+x.kg; nk++; } });
    card.append(h('p',{class:'cmmore'},h('span',{text:'+ '+moreTxt(more)}),nk>1?h('small',{text:T('Σύνολο ','Total ')+kgTxt(Math.round(tot*100)/100)}):null)); }
  var meta=[p.tech,p.bait,p.day?p.day.split('-').reverse().join('/'):''].filter(Boolean); if(meta.length) card.append(h('p',{class:'sub',style:{margin:'2px 0 0'},text:meta.join(' · ')}));
  if(c0.area) card.append(h('p',{class:'cmarea'},h('span',{'aria-hidden':'true',text:'📍 '}),String(c0.area).slice(0,40)));
  var ch=chips(p.cond); if(ch.length){ var cr=h('div',{class:'chips',style:{margin:'8px 0 0'}}); ch.forEach(function(x){ cr.append(h('span',{class:'chip sm',text:x})); }); card.append(cr); }
  var lk=!!F.liked[p.id];
  card.append(h('div',{class:'cmact'},h('button',{type:'button',class:'cmbtn'+(lk?' on':''),'aria-pressed':String(lk),onclick:function(){ like(p); }},(lk?'♥ ':'♡ ')+cnt(p,'likes')),
    h('button',{type:'button',class:'cmbtn','aria-expanded':String(!!F.open[p.id]),'aria-label':T('Σχόλια','Comments'),onclick:function(){ F.open[p.id]=!F.open[p.id]; if(F.open[p.id]&&!p._c) comments(p); else draw(); }},'💬 '+cnt(p,'comments')),
    (!qk&&(['wind','wave','press','sst','moon'].filter(function(k){ return c0[k]!=null; }).length>=2))?h('button',{type:'button',class:'cmbtn cmcmpb',text:T('Σύγκρινε','Compare'),'aria-label':T('Σύγκρινε τις συνθήκες με αύριο','Compare conditions with tomorrow'),onclick:function(){ compare(p); }}):null,
    h('span',{class:'cmsp'}),
    !qk?h('button',{type:'button',class:'cmbtn cmic','aria-label':T('Κοινοποίηση ως εικόνα','Share as image'),html:B.iconSvg('share')||'⤴',onclick:function(){ shareImg(p); }}):null,
    h('button',{type:'button',class:'cmbtn cmic'+(saved().indexOf(p.id)>=0?' on':''),'aria-pressed':String(saved().indexOf(p.id)>=0),'aria-label':T('Αποθήκευση','Save'),text:saved().indexOf(p.id)>=0?'★':'☆',onclick:function(){ toggleSave(p); }})));
  var ll=likersLine(p); if(ll) card.append(ll);
  if(F.open[p.id]){ var cm=h('div',{class:'cmcom'}), ci=h('input',{type:'text',maxlength:'300',placeholder:T('Γράψε σχόλιο…','Write a comment…'),enterkeyhint:'send'});
    (p._c||[]).forEach(function(c){ var mineC=c.user_id===uid(), body=String(c.body||''), tx=h('p',{class:'noik'},h('b',{text:(c.author||T('Ψαράς','Angler'))+' '}));
      var mm=/^@(\S+(?: \S+)?)/.exec(body), who=null; if(mm){ (p._c||[]).concat([{author:p.author}]).forEach(function(o){ var a=o.author||''; if(a&&body.indexOf('@'+a)===0&&(!who||a.length>who.length)) who=a; }); }
      if(who){ tx.append(h('span',{class:'cmat',text:'@'+who}),body.slice(who.length+1)); } else tx.append(body);
      if(c.user_id===p.user_id&&/^✓/.test(body)){ tx.replaceChildren(h('b',{text:(c.author||'')+' '}),h('span',{class:'cmat',text:'✓ '+T('Είναι: ','It is: ')}),body.replace(/^✓\s*/,'')); }
      var acts=h('div',{class:'cma'},c.created_at?h('small',{text:ago(c.created_at)}):null);
      acts.append(h('button',{type:'button',class:'linkbtn cmcl'+(F.cliked[c.id]?' on':''),'aria-pressed':String(!!F.cliked[c.id]),'aria-label':T('Like στο σχόλιο','Like comment'),text:(F.cliked[c.id]?'♥':'♡')+(F.clk[c.id]?' '+F.clk[c.id]:''),onclick:function(){ likeC(c); }}));
      if(qk==='id'&&mine&&!mineC&&!F.ans[p.id]) acts.append(h('button',{type:'button',class:'linkbtn cmok',text:T('✓ Αυτό είναι','✓ That is it'),onclick:function(){ accept(p,body); }}));
      if(!mineC&&sess()) acts.append(h('button',{type:'button',class:'linkbtn',text:T('Απάντηση','Reply'),onclick:function(){ ci.value='@'+(c.author||'')+' '; try{ ci.focus(); ci.setSelectionRange(ci.value.length,ci.value.length); }catch(e){} }}));
      if(sess()) acts.append(h('button',{type:'button',class:'linkbtn',text:mineC?T('Διαγραφή','Delete'):T('Αναφορά','Report'),onclick:function(){ if(mineC) delComment(p,c); else report('comment',c.id); }}));
      if(F.admin&&!mineC) acts.append(h('button',{type:'button',class:'linkbtn',text:T('Απόκρυψη','Hide'),onclick:function(){ hide('comment',c.id,true); }}));
      cm.append(h('div',{class:'cmc'},avEl(c.user_id,c.author,'sm'),h('div',{class:'cmcb'},tx,acts))); });
    if(p._cerr) cm.append(h('p',{class:'sub',text:T('Τα σχόλια δεν φόρτωσαν.','Comments did not load.')}));
    if(qk==='id') ci.placeholder=T('Πρότεινε είδος…','Suggest a species…'); else if(qk) ci.placeholder=T('Γράψε απάντηση…','Write an answer…');
    var f=h('form',{class:'inrow'},ci,h('button',{class:'btn sm pri',type:'submit',text:T('Αποστολή','Send')}));
    f.addEventListener('submit',function(ev){ ev.preventDefault(); var v=ci.value; ci.value=''; comment(p,v); }); cm.append(sess()?f:h('button',{class:'btn full',type:'button',text:T('Συνδέσου για να σχολιάσεις','Sign in to comment'),onclick:function(){ needAcc(); }})); card.append(cm); }
  return card;
}
function draw(){
  if(!root) return; var page=h('div',{class:'page'});
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω στο Προφίλ','Back to Profile'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Κοινότητα','Community')})),
    h('div',{class:'cmtopr'},(sess()&&F.admin)?h('button',{class:'iconbtn cmrepb',type:'button','aria-label':T('Αναφορές','Reports'),onclick:function(){ reportsSheet(); }},h('span',{text:'🚩'}),(F.reports&&F.reports.filter(function(r){ return !r.hidden; }).length)?h('span',{class:'cmdot',text:String(F.reports.filter(function(r){ return !r.hidden; }).length)}):null):null,
      h('button',{class:'iconbtn',type:'button','aria-label':T('Ανανέωση','Refresh'),html:B.iconSvg('refresh'),onclick:function(){ load(true); loadAll(true); if(F.admin) loadReports(); }}))));
  /* 1.9.65: χωρίς λογαριασμό: διαβάζεις τις αναρτήσεις· για like, σχόλια και μοίρασμα χρειάζεται λογαριασμός */
  if(!sess()) page.append(h('div',{class:'card cmanon'},h('b',{text:T('Δες τι πιάνουν οι ψαράδες σε Κύπρο και Ελλάδα','See what anglers in Cyprus and Greece are catching')}),h('p',{class:'sub',text:T('Με δωρεάν λογαριασμό κάνεις like, σχολιάζεις, ρωτάς και μοιράζεσαι τα δικά σου ψάρια. Δεν φαίνεται ποτέ θέση.','With a free account you can like, comment, ask and share your own catches. A location is never shown.')}),h('button',{class:'btn pri full',type:'button',text:T('Σύνδεση ή εγγραφή','Sign in or sign up'),onclick:function(){ needAcc(); }})));
  /* 1.9.56: αν αυτό το κινητό δεν θα πάρει ειδοποιήσεις (κλειστές, χωρίς άδεια ή χωρίς συνδρομή στον server), το λέει εδώ */
  if(sess()) (function(){ var n=ls.get('alkyon-notify',{})||{}, perm=('Notification' in window)?Notification.permission:'unsupported', off=!n.on||perm!=='granted'||n.server===false;
    if(!off) return;
    var why=perm==='denied'?T('Οι ειδοποιήσεις είναι μπλοκαρισμένες στις ρυθμίσεις του κινητού για την εφαρμογή.','Notifications are blocked in the phone settings for the app.'):perm==='unsupported'?T('Στο iPhone οι ειδοποιήσεις δουλεύουν μόνο αν η εφαρμογή είναι στην αρχική οθόνη (Κοινή χρήση › Προσθήκη στην οθόνη Αφετηρίας).','On iPhone, notifications only work when the app is on the Home Screen (Share › Add to Home Screen).'):T('Άνοιξε τις ειδοποιήσεις για να μαθαίνεις για νέα ψάρια, likes και σχόλια.','Turn on notifications to hear about new catches, likes and comments.');
    page.append(h('a',{class:'card ibon',href:'#alerts'},h('span',{class:'tx'},h('b',{text:T('Δεν θα σου έρχονται ειδοποιήσεις της Κοινότητας σε αυτό το κινητό','You will not get Community alerts on this phone')}),h('small',{text:why})))); })();
  if(sess()) page.append(h('div',{class:'cmme'},h('button',{type:'button',class:'cmmeb',onclick:function(){ profile(uid(),author()); }},avEl(uid(),author()),h('span',null,h('b',{text:author()}),h('small',{text:T('Το προφίλ μου · φωτογραφία','My profile · photo')}))),h('button',{class:'btn sm',type:'button',text:T('Πρόσκληση φίλου','Invite a friend'),onclick:function(){ invite(); }})));
  if(sess()) page.append(B.seg([['all',T('Όλα','All')],['follow',T('Ακολουθώ','Following')],['saved',T('Σωσμένα','Saved')],['mine',T('Δικά μου','Mine')]],F.mode,function(v){ if(v===F.mode) return; F.mode=v; F.user=null; load(true); },T('Αναρτήσεις','Posts')));
  if(sess()) page.append(h('div',{class:'cmask'},h('button',{class:'btn sm',type:'button',text:T('Ρώτα την Κοινότητα','Ask the Community'),onclick:function(){ ask({k:'q'}); }}),h('button',{class:'btn sm',type:'button',text:T('Τι ψάρι είναι;','What fish is this?'),onclick:function(){ ask({k:'id'}); }})));
  if(F.mode==='all'&&!F.user){ var wk=weekCard(), ch=F.all?chalCard():null, bd=boardCard(); if(wk) page.append(wk); if(ch) page.append(ch); if(bd) page.append(bd); }
  /* 1.10.6: τα φίλτρα πάνω, το «δεν έχεις σώσει» από κάτω (και χωρίς φίλτρα όταν δεν υπάρχει τίποτα να φιλτράρεις) */
  var noSaved=F.mode==='saved'&&!saved().length, flt=noSaved?null:filters(); if(flt) page.append(flt);
  if(noSaved) page.append(h('div',{class:'card empty'},h('p',{text:T('Δεν έχεις σώσει ακόμη αναρτήσεις. Πάτα ☆ σε μια ανάρτηση για να τη βρίσκεις εδώ.','No saved posts yet. Tap ☆ on a post to find it here.')})));
  if(F.mode==='follow'&&!follows().length) page.append(h('div',{class:'card empty'},h('p',{text:T('Δεν ακολουθείς ακόμη κανέναν. Πάτα το όνομα ενός ψαρά › Ακολούθησε. Στις Ειδοποιήσεις μπορείς να διαλέξεις να ειδοποιείσαι μόνο για όσους ακολουθείς.','You do not follow anyone yet. Tap an angler’s name › Follow. In Alerts you can choose to be notified only about people you follow.')})));
  page.append(h('p',{class:'sub',style:{margin:'10px 4px'},text:T('Οι αναρτήσεις δεν δείχνουν ποτέ θέση ή όνομα σημείου. Μοιράζεσαι ένα ψάρι από το Ημερολόγιο: πάτα το ψάρι › Κοινότητα.','Posts never show a location or spot name. Share a catch from the Log: tap the catch › Community.')}));
  var bl=blocked(), shown=F.items.filter(function(p){ return bl.indexOf(p.user_id)<0; });
  shown.forEach(function(p){ page.append(post(p)); });
  if(F.err) page.append(h('div',{class:'card empty'},h('p',{text:F.err})));
  else if(!shown.length&&!F.loading&&!(F.mode==='follow'&&!follows().length)&&!(F.mode==='saved'&&!saved().length)) page.append(h('div',{class:'card empty'},h('p',{text:F.mode==='mine'?T('Δεν έχεις μοιραστεί ακόμη κάτι.','You have not shared anything yet.'):(F.sp||F.tech||F.user)?T('Δεν υπάρχουν αναρτήσεις με αυτό το φίλτρο.','No posts match this filter.'):T('Δεν υπάρχουν αναρτήσεις ακόμη. Ανέβασε το πρώτο ψάρι!','No posts yet. Share the first catch!')})));
  if(F.loading) page.append(h('div',{class:'sk',style:{height:'220px',marginTop:'12px'}}));
  else if(!F.end&&shown.length) page.append(h('button',{class:'btn full',type:'button',text:T('Περισσότερα','More'),onclick:function(){ load(false); }}));
  root.replaceChildren(page);
}
B.view('community',{title:T('Κοινότητα','Community'),mount:function(el){ root=el; checkAdmin(); myProfile(); if(sess()) profs([uid()]); fromCache(); loadAll(); if((F.cached||!F.items.length)&&!F.loading) load(true); else draw(); seen(); },unmount:function(){ root=null; },resume:function(){ draw(); }});

/* ---------- μοίρασμα ενός ψαριού ---------- */
function jpeg(blob,mx,qq){ mx=mx||1280; qq=qq||0.82; return new Promise(function(res,rej){ var u=URL.createObjectURL(blob), im=new Image(); im.onload=function(){ var s=Math.min(1,mx/Math.max(im.width,im.height)), cv=document.createElement('canvas'); cv.width=Math.round(im.width*s); cv.height=Math.round(im.height*s);
  cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height); URL.revokeObjectURL(u); cv.toBlob(function(b){ if(b) res(b); else rej(new Error('jpeg')); },'image/jpeg',qq); }; im.onerror=function(){ URL.revokeObjectURL(u); rej(new Error('img')); }; im.src=u; }); }
function moonIdx(b){ try{ return Math.round(PF.moonPhase(B.biteMs(b)).f*8)%8; }catch(e){ return null; } }
/* 1.9.62: περιοχή ψαρέματος. Μόνο αν το επιλέξει ο χρήστης· προτείνεται η πιο κοντινή γνωστή περιοχή (όχι το σημείο) και τη γράφει/αλλάζει όπως θέλει */
var AREAS=[['Λεμεσός','Limassol',34.675,33.04],['Λάρνακα','Larnaca',34.915,33.636],['Πάφος','Paphos',34.757,32.41],['Αγία Νάπα','Ayia Napa',34.982,34.0],['Πρωταράς','Protaras',35.012,34.058],
  ['Πόλις Χρυσοχούς','Polis Chrysochous',35.036,32.425],['Λατσί','Latchi',35.04,32.39],['Πισσούρι','Pissouri',34.66,32.70],['Ζύγι','Zygi',34.73,33.34],['Μαζωτός','Mazotos',34.80,33.49],
  ['Κάτω Πύργος','Kato Pyrgos',35.18,32.69],['Πωμός','Pomos',35.15,32.55],['Ακρωτήρι','Akrotiri',34.58,32.98],['Ορμήδεια','Ormideia',34.99,33.78],['Κόραλ Μπέι','Coral Bay',34.86,32.36],['Γκόβερνορς','Governor\'s Beach',34.71,33.27]];
function nearArea(b){ var la=+b.lat, lo=+b.lon; if(!isFinite(la)||!isFinite(lo)||b.lat==null) return ''; var best=null, bd=1e9;
  AREAS.forEach(function(a){ var dy=(a[2]-la)*111, dx=(a[3]-lo)*111*Math.cos(la*Math.PI/180), d=Math.hypot(dx,dy); if(d<bd){ bd=d; best=a; } });
  return best&&bd<30?(EN?best[1]:best[0]):''; }
B.commNearArea=nearArea;
/* 1.9.65: «Νέα» στο Προφίλ: αναρτήσεις άλλων μετά την τελευταία φορά που άνοιξες την Κοινότητα */
function seen(){ ls.set('alkyon-comm-seen',new Date().toISOString()); }
B.commNewCount=function(cb){ var t=ls.get('alkyon-comm-seen',''); if(!t){ cb(0); return; } var q='community_posts?select=id&created_at=gt.'+esc(t)+'&limit=20'+(uid()?'&user_id=neq.'+esc(uid()):'');
  rest(q).then(function(r){ return r.json(); }).then(function(a){ cb(Array.isArray(a)?a.length:0); }).catch(function(){ cb(0); }); };
/* 1.9.62: τα άλλα ψάρια της ίδιας μέρας (για να μπουν στην ίδια ανάρτηση) */
function sameDay(b){ try{ return B.store.raw('bites').filter(function(x){ return x&&x.id!==b.id&&!x.deleted&&!x.miss&&!x.gear&&x.species&&x.date===b.date&&!(B.pest&&B.pest(x)); }).sort(function(p,q){ return (+q.kg||0)-(+p.kg||0); }).slice(0,8); }catch(e){ return []; } }
/* 1.9.65: μικρό αντίγραφο (640 px) για τη λίστα· η μεγάλη φωτογραφία ανοίγει μόνο σε πλήρη οθόνη */
function upThumb(blob,path){ return jpeg(blob,640,0.75).then(function(tb){ return C().storage('POST','community/'+path.replace(/\.jpg$/,'_t.jpg'),tb,'image/jpeg'); }).then(function(r){ return !!(r&&r.ok); }).catch(function(){ return false; }); }
function uuid(){ return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
/* 1.9.63: ερώτηση ή «Τι ψάρι είναι;» (με φωτογραφία). Πάει στους ίδιους πίνακες: species «?»/«Ερώτηση» και cond.k = 'q' | 'id', cond.q = το κείμενο */
function ask(o){ o=o||{};
  if(!sess()){ B.authSheet({reason:T('Για να ρωτήσεις την Κοινότητα χρειάζεται λογαριασμός.','Asking the Community needs an account.')}); return; }
  var k=o.k||'q', blob=null, body=h('div',{class:'bform cmshare'}), prev=h('div'), sh;
  var ta=h('textarea',{rows:'3',maxlength:'300','aria-label':T('Κείμενο','Text'),placeholder:T('π.χ. Ποια καλαμαριέρα δουλεύει τώρα στη Λεμεσό;','e.g. Which squid jig works in Limassol right now?')});
  var fi=h('input',{type:'file',accept:'image/*',hidden:true}), pick=h('button',{class:'btn full',type:'button',text:T('Φωτογραφία','Photo'),onclick:function(){ fi.click(); }});
  function setBlob(bl){ blob=bl; prev.replaceChildren(); if(bl) prev.append(h('img',{class:'cmimg',alt:'',src:URL.createObjectURL(bl)})); pick.textContent=bl?T('Άλλη φωτογραφία','Change photo'):T('Φωτογραφία','Photo'); }
  fi.addEventListener('change',function(){ if(fi.files&&fi.files[0]) setBlob(fi.files[0]); });
  function paint(){ ta.placeholder=k==='id'?T('Προαιρετικά: πού/πώς πιάστηκε, μέγεθος…','Optional: how it was caught, size…'):T('π.χ. Ποια καλαμαριέρα δουλεύει τώρα στη Λεμεσό;','e.g. Which squid jig works in Limassol right now?'); }
  if(!o.src) body.append(B.seg([['q',T('Ερώτηση','Question')],['id',T('Τι ψάρι είναι;','What fish is this?')]],k,function(v){ k=v; paint(); },T('Είδος ανάρτησης','Post type')));
  if(o.bite&&o.bite.photo) B.store.Photos.get(o.bite.id).then(function(bl){ if(bl) setBlob(bl); }).catch(function(){});
  body.append(prev,ta,fi,o.src?null:pick,h('p',{class:'sub',text:T('Δεν φαίνεται θέση. Οι άλλοι απαντούν με σχόλιο· στο «Τι ψάρι είναι;» πατάς «✓ Αυτό είναι» στη σωστή απάντηση και μπαίνει στο Ημερολόγιό σου.','No location is shown. Others answer with a comment; on "What fish is this?" tap "✓ That is it" on the right answer and it goes into your Log.')}));
  paint();
  var go=h('button',{class:'btn pri full',type:'button',text:T('Δημοσίευση','Publish'),onclick:function(){ var txt=ta.value.trim();
    if(k==='id'&&!blob){ B.toast(T('Χρειάζεται φωτογραφία του ψαριού.','A photo of the fish is needed.')); return; }
    if(k==='q'&&!txt){ B.toast(T('Γράψε την ερώτηση.','Write your question.')); return; }
    go.disabled=true; go.textContent=T('Αποστολή…','Sending…'); var path=null;
    var th=false;
    (blob?jpeg(blob).then(function(jb){ path=uid()+'/'+uuid()+'.jpg'; return C().storage('POST','community/'+path,jb,'image/jpeg'); }).then(function(r){ if(!r.ok) throw new Error('photo '+r.status); return upThumb(blob,path).then(function(ok){ th=ok; }); }):Promise.resolve())
      .then(function(){ var cond={k:k}; if(txt) cond.q=txt.slice(0,300); if(th) cond.th=1;
        return rest('community_posts',{method:'POST',body:JSON.stringify({src:o.src||('q-'+uuid()),author:author(),species:k==='id'?'?':T('Ερώτηση','Question'),cond:cond,photo:path}),headers:{'Content-Type':'application/json',Prefer:'return=minimal'}}); })
      .then(function(){ pingComm(); sh.close(); B.toast(T('Δημοσιεύτηκε. Θα ειδοποιηθείς για τις απαντήσεις.','Posted. You will be notified about answers.')); F.mode='all'; F.user=null; F.sp=''; F.tech=''; load(true); })
      .catch(function(e){ if(path) C().storage('DELETE','community/'+path).catch(function(){}); go.disabled=false; go.textContent=T('Δημοσίευση','Publish'); var m=String(e&&e.message||e);
        B.toast(/409|duplicate/i.test(m)?T('Έχει ήδη σταλεί.','Already posted.'):/rate/i.test(m)?T('Πολλές αναρτήσεις σήμερα.','Too many posts today.'):T('Δεν στάλθηκε. Έλεγξε τη σύνδεση.','Not sent. Check your connection.')); }); }});
  body.append(go); sh=B.sheet({title:k==='id'&&o.src?T('Τι ψάρι είναι;','What fish is this?'):T('Ρώτα την Κοινότητα','Ask the Community'),body:body}); }
B.commAsk=ask;
B.commShared=function(id){ var s=ls.get('alkyon-comm-shared',{})||{}; return !!s[id]; };
B.commShare=function(b){
  if(!sess()){ B.authSheet({reason:T('Για να μοιραστείς ψάρι στην Κοινότητα χρειάζεται λογαριασμός.','Sharing a catch to the Community needs an account.')}); return; }
  if(B.commShared(b.id)){ B.toast(T('Έχει ήδη μοιραστεί.','Already shared.')); return; }
  if(!b.species){ if(b.photo) ask({k:'id',src:b.id,bite:b}); else B.toast(T('Λείπει το είδος.','Species is missing.')); return; }
  var blob=null, body=h('div',{class:'bform cmshare'}), prev=h('div'), withCond=false, sh;
  (b.photo?B.store.Photos.get(b.id).catch(function(){ return null; }):Promise.resolve(null)).then(function(bl){ blob=bl; if(bl) prev.append(h('img',{class:'cmimg',alt:'',src:URL.createObjectURL(bl)})); });
  var sz=[]; if(b.kg!=null&&b.kg!=='') sz.push(b.kg+' kg'); if(b.len!=null&&b.len!=='') sz.push(b.len+' cm');
  /* 1.10.6: τίτλος της ανάρτησης = το πιο βαρύ ψάρι από όσα στέλνεις (το ίδιο ή τα άλλα της μέρας) */
  var tB=h('b',{text:b.species}), tS=h('span',{text:sz.join(' · '),hidden:!sz.length});
  body.append(prev,h('div',{class:'cmtitle'},tB,tS));
  function mainOf(){ var c=[b].concat((others||[]).filter(function(x){ return pick[x.id]; })), m=b; c.forEach(function(x){ if(x.kg!=null&&x.kg!==''&&isFinite(+x.kg)&&(m.kg==null||m.kg===''||!isFinite(+m.kg)||+x.kg>+m.kg)) m=x; }); return m; }
  function retitle(){ var m=mainOf(), z=[]; if(m.kg!=null&&m.kg!=='') z.push(m.kg+' kg'); if(m.len!=null&&m.len!=='') z.push(m.len+' cm'); tB.textContent=m.species; tS.textContent=z.join(' · '); tS.hidden=!z.length; }
  var ch=chips({wind:b.wind,wave:b.wave,press:b.press,sst:b.sst,moon:moonIdx(b)});
  var others=b.date?sameDay(b):[], pick={};
  if(others.length){ var ob=h('div',{class:'cmpick'},h('b',{text:T('Και άλλα ψάρια της ίδιας μέρας','Other catches from the same day')}));
    others.forEach(function(x){ pick[x.id]=1; var c=h('input',{type:'checkbox',checked:true}); c.addEventListener('change',function(){ pick[x.id]=c.checked?1:0; retitle(); });
      ob.append(h('label',{class:'tg'},c,h('span',{text:x.species+(x.kg!=null&&x.kg!==''?' '+kgTxt(x.kg):'')+(x.len!=null&&x.len!==''?' · '+x.len+' cm':'')}))); });
    body.append(ob); retitle(); }
  var areaIn=h('input',{type:'text',maxlength:'40',placeholder:T('π.χ. Λεμεσός','e.g. Limassol'),value:nearArea(b),hidden:true,'aria-label':T('Περιοχή','Area')}), withArea=false, acb=h('input',{type:'checkbox'});
  acb.addEventListener('change',function(){ withArea=acb.checked; areaIn.hidden=!withArea; if(withArea) try{ areaIn.focus(); }catch(e){} });
  body.append(h('label',{class:'tg'},acb,h('span',{text:T('Να φαίνεται η περιοχή (π.χ. «Λεμεσός», ποτέ το σημείο)','Show the area (e.g. "Limassol", never the spot)')})),areaIn);
  if(ch.length){ var cr=h('div',{class:'chips',hidden:true}); ch.forEach(function(x){ cr.append(h('span',{class:'chip sm',text:x})); }); var cb=h('input',{type:'checkbox'}); cb.addEventListener('change',function(){ withCond=cb.checked; cr.hidden=!withCond; });
    body.append(h('label',{class:'tg'},cb,h('span',{text:T('Να φαίνονται και οι συνθήκες (άνεμος, κύμα, πίεση)','Also show conditions (wind, waves, pressure)')})),cr); }
  body.append(h('p',{class:'sub',text:T('Θα φαίνονται: το όνομά σου, είδος, βάρος, δόλωμα και τεχνική, ημερομηνία και η φωτογραφία (περιοχή και συνθήκες μόνο αν το επιλέξεις). ΔΕΝ θα φαίνεται θέση ή όνομα σημείου. Πρόσεξε να μη δείχνει η φωτογραφία χαρακτηριστικό τοπίο.','Visible: your name, species, weight, bait and technique, date and the photo (area and conditions only if you tick them). NO location or spot name is shared. Make sure the photo does not show a recognisable landmark.')}));
  var go=h('button',{class:'btn pri full',type:'button',text:T('Δημοσίευση','Publish'),onclick:function(){
    (ls.get('alkyon-comm-ok',false)?Promise.resolve(true):B.ask(T('Η ανάρτηση θα είναι ορατή σε όλους τους χρήστες του Alkyon. Δεν περιλαμβάνει θέση. Μπορείς να τη διαγράψεις όποτε θέλεις. Συνέχεια;','The post will be visible to all Alkyon users. It does not include a location. You can delete it any time. Continue?'),T('Συνέχεια','Continue'))).then(function(y){ if(!y) return; ls.set('alkyon-comm-ok',true);
      go.disabled=true; go.textContent=T('Αποστολή…','Sending…'); var path=null;
      var th=false;
      rest('community_posts?select=id&limit=1').then(function(){ if(!blob) return; return jpeg(blob).then(function(jb){ path=uid()+'/'+uuid()+'.jpg'; return C().storage('POST','community/'+path,jb,'image/jpeg'); }).then(function(r){ if(!r.ok) throw new Error('photo '+r.status); return upThumb(blob,path).then(function(ok){ th=ok; }); }); })
        .then(function(){ var cond=withCond?{wind:b.wind,wave:b.wave,press:b.press,ptrend:b.ptrend,sst:b.sst,temp:b.temp,moon:moonIdx(b)}:{}; Object.keys(cond).forEach(function(k){ if(cond[k]==null||cond[k]==='') delete cond[k]; else if(typeof cond[k]==='number') cond[k]=Math.round(cond[k]*10)/10; });
          var M=mainOf(), mo=[b].concat(others.filter(function(x){ return pick[x.id]; })).filter(function(x){ return x!==M; }).map(function(x){ var o={s:String(x.species).slice(0,40)}; if(x.kg!=null&&x.kg!==''&&isFinite(+x.kg)) o.kg=+x.kg; if(x.len!=null&&x.len!==''&&isFinite(+x.len)) o.len=+x.len; return o; }); if(mo.length) cond.more=mo;
          var ar=withArea?areaIn.value.trim().slice(0,40):''; if(ar) cond.area=ar; if(b.rel) cond.rel=true; if(th) cond.th=1;
          return rest('community_posts',{method:'POST',body:JSON.stringify({src:b.id,author:author(),species:M.species,latin:M.latin||null,kg:M.kg!=null&&M.kg!==''?+M.kg:null,len:M.len!=null&&M.len!==''?+M.len:null,bait:M.bait||b.bait||null,tech:M.tech||b.tech||null,day:b.date||null,cond:cond,photo:path}),headers:{'Content-Type':'application/json',Prefer:'return=representation'}}).then(function(r){ return r.json(); }); })
        .then(function(rows){ pingComm(); var s=ls.get('alkyon-comm-shared',{})||{}; s[b.id]=(rows&&rows[0]&&rows[0].id)||1; ls.set('alkyon-comm-shared',s); sh.close(); B.toast(T('Δημοσιεύτηκε στην κοινότητα.','Shared to the community.')); F.items=[]; F.end=false; F.offset=0; F.all=null; })
        .catch(function(e){ if(path) C().storage('DELETE','community/'+path).catch(function(){}); var m=String(e&&e.message||e); go.disabled=false; go.textContent=T('Δημοσίευση','Publish');
          B.toast(/409|duplicate/i.test(m)?T('Έχει ήδη μοιραστεί.','Already shared.'):/rate/i.test(m)?T('Πολλές αναρτήσεις σήμερα.','Too many posts today.'):/404|relation|does not exist/i.test(m)?T('Η κοινότητα δεν έχει ενεργοποιηθεί ακόμη.','Community is not enabled yet.'):T('Δεν στάλθηκε. Έλεγξε τη σύνδεση.','Not sent. Check your connection.')); }); }); }});
  body.append(go); sh=B.sheet({title:T('Μοίρασμα στην κοινότητα','Share to the community'),body:body});
};
})();
