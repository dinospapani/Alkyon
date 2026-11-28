/* Alkyon 4 · Φίλοι (#friends): κωδικός πρόσκλησης, προσθήκη φίλου, ποιος βλέπει τι, τα ψάρια του φίλου.
   Ίδια βάση με την κλασική (πίνακες friends, friend_invites, συνάρτηση redeem_friend). Τα «ιδιωτικά» δεν φαίνονται ποτέ. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls, root=null, list=null, err='', open=null, fdata={};
function C(){ return B.cloud; }
function me(){ var s=C().session(); return s&&s.uid; }
function code(){ var A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s='', a=new Uint32Array(8); try{ crypto.getRandomValues(a); }catch(e){ for(var i=0;i<8;i++) a[i]=Math.random()*1e9; } for(var j=0;j<8;j++) s+=A[a[j]%A.length]; return s; }

function load(){
  err=''; list=null; draw();
  C().rest('friends?select=owner,viewer,owner_name,viewer_name,share').then(function(r){ return r.json(); }).then(function(rows){
    var u=me(), M={};
    rows.forEach(function(x){
      if(x.viewer===u){ var f=M[x.owner]||(M[x.owner]={uid:x.owner}); f.name=x.owner_name||f.name; f.theyShare=!!x.share; }
      if(x.owner===u){ var g=M[x.viewer]||(M[x.viewer]={uid:x.viewer}); g.name=g.name||x.viewer_name; g.mine=!!x.share; }
    });
    var NK=ls.get('alkyon-fnick',{})||{}; /* 1.14.13: ψευδώνυμο που βάζεις εσύ (μόνο στο κινητό σου) */
    list=Object.keys(M).map(function(k){ var f=M[k]; f.real=f.name||''; if(NK[k]) f.name=NK[k]; if(!f.name) f.name=T('Φίλος','Friend'); if(f.mine==null) f.mine=true; return f; });
    draw();
  }).catch(function(e){ list=[]; err=/42P01|PGRST205|relation/.test(String(e.message))?T('Οι φίλοι δεν είναι διαθέσιμοι ακόμα.','Friends are not available yet.'):C().errText(e); draw(); });
}
/* v31z537: κωδικός που ήρθε από σύνδεσμο (#addfriend=…), ισχύει 48 ώρες */
function pend(){ var o=B.ls.get('alk-friend-code',null); if(!o||!o.c) return null; if(Date.now()-o.t>48*3600e3){ clearPend(); return null; } return o.c; }
function clearPend(){ try{ localStorage.removeItem('alk-friend-code'); }catch(e){} }
function nick(f){ var inp=h('input',{class:'input',type:'text',maxlength:'40',value:(ls.get('alkyon-fnick',{})||{})[f.uid]||f.real||'',placeholder:T('π.χ. Αντρέας – βάρκα','e.g. Andreas – boat')});
  var sh=B.sheet({title:T('Όνομα φίλου','Friend name'),body:h('div',{class:'bform'},h('p',{class:'sub',text:T('Το βλέπεις μόνο εσύ. Άφησέ το κενό για το όνομα του λογαριασμού του.','Only you see it. Leave it empty for their account name.')}),inp,
    h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ var m=ls.get('alkyon-fnick',{})||{}, v=inp.value.trim(); if(v&&v!==f.real) m[f.uid]=v; else delete m[f.uid]; ls.set('alkyon-fnick',m); sh.close(); load(); }}))}); }
function draw(){
  if(!root) return;
  var page=h('div',{class:'page'});
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω στο Προφίλ','Back to Profile'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Φίλοι','Friends')}))));
  if(!C().session()){ page.append(h('div',{class:'card empty isacct'},h('h3',{text:T('Χρειάζεται λογαριασμός','An account is needed')}),h('p',{text:T('Οι φίλοι βλέπουν ο ένας τα ψάρια του άλλου (είδος, βάρος, ημερομηνία), χωρίς θέσεις, μέσω του λογαριασμού.','Friends see each other’s catches (species, weight, date), without positions, through their accounts.')}),pend()?h('div',{class:'frinv'},h('b',{text:T('Πρόσκληση από φίλο','Invite from a friend')}),h('span',{text:T('Ο κωδικός κρατήθηκε. Μετά τη σύνδεση άνοιξε Προφίλ › Φίλοι και θα είναι ήδη συμπληρωμένος.','The code is saved. After signing in, open Profile › Friends and it will already be filled in.')})):null,B.accountBtn(T('Οι φίλοι βλέπουν ο ένας τα ψάρια του άλλου (είδος, βάρος, ημερομηνία), χωρίς θέσεις, μέσω του λογαριασμού.','Friends see each other’s catches (species, weight, date), without positions, through their accounts.')))); root.replaceChildren(page); return; }
  page.append(h('p',{class:'sub',style:{margin:'-6px 4px 14px'},text:T('Με έναν καλό φίλο που ψαρεύετε μαζί βλέπει ο ένας τα ψάρια του άλλου: είδος, πλήθος, βάρος, μήκος, ημερομηνία και ώρα, και πόσες εξόδους και σημεία έχει. Ποτέ θέσεις, ονόματα τόπων, διαδρομές, σημειώσεις ή φωτογραφίες. Τη ζωντανή θέση σου τη βλέπει μόνο όσο κρατά μια ζωντανή έξοδος. Ό,τι έχεις σημειώσει ως ιδιωτικό δεν φαίνεται. Αυτός που στέλνει τον κωδικό μοιράζεται αμέσως· αυτός που τον γράφει αποφασίζει μόνος του. Μπορείς να το κλείσεις για κάθε φίλο παρακάτω.','With a good fishing friend you see each other’s catches: species, number, weight, length, date and time, and how many trips and spots each has. Never positions, place names, tracks, notes or photos. Your live position is shown only while a live trip is on. Anything you marked private stays hidden. Whoever sends the code shares right away; whoever uses it decides for themselves. You can turn it off for each friend below.')}));
  /* πρόσκληση και προσθήκη */
  var inv=h('div'), c=h('section',{class:'card'},h('h2',{text:T('Πρόσθεσε φίλο','Add a friend')}));
  var ib=h('button',{class:'btn pri full',type:'button',text:T('Φτιάξε κωδικό πρόσκλησης','Create an invite code'),onclick:function(){ var k=code(); ib.disabled=true; inv.replaceChildren(h('p',{class:'sub',text:T('Δημιουργία…','Creating…')}));
    var s=C().session(); C().rest('friend_invites',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({code:k,name:(s&&s.name)||''})}).then(function(){ ib.disabled=false;
      var shown=k.slice(0,4)+'-'+k.slice(4), link=location.origin+location.pathname+'#addfriend='+shown, msg=T('Πρόσθεσέ με στο Alkyon με τον κωδικό ','Add me on Alkyon with the code ')+shown+'\n'+T('Πάτα εδώ: ','Tap here: ')+link;
      inv.replaceChildren(h('div',{class:'frcode',text:shown}),h('p',{class:'sub',text:T('Στείλε τον στον φίλο σου: πατά τον σύνδεσμο και ο κωδικός μπαίνει μόνος του. Ισχύει 48 ώρες και για μία σύνδεση.','Send it to your friend: they tap the link and the code fills in by itself. Valid for 48 hours and one connection.')}),
        h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Αποστολή','Share'),onclick:function(){ if(navigator.share) navigator.share({text:msg}).catch(function(){}); else { try{ navigator.clipboard.writeText(msg); B.toast(T('Αντιγράφηκε.','Copied.')); }catch(e){} } }}))); })
      .catch(function(e){ ib.disabled=false; inv.replaceChildren(h('p',{class:'err',text:C().errText(e)})); }); }});
  var ci=h('input',{type:'text',maxlength:'12',autocapitalize:'characters',autocomplete:'off',placeholder:'ABCD-1234','aria-label':T('Κωδικός φίλου','Friend’s code')});
  var rb=h('button',{class:'btn',type:'button',text:T('Σύνδεση','Connect'),onclick:function(){ var v=ci.value.replace(/[^A-Za-z0-9]/g,'').toUpperCase(); if(v.length<6){ ci.focus(); return; } rb.disabled=true; var s=C().session();
    C().rest('rpc/redeem_friend',{method:'POST',body:JSON.stringify({p_code:v,p_name:(s&&s.name)||''})}).then(function(r){ return r.json(); }).then(function(j){ rb.disabled=false; ci.value=''; clearPend(); B.toast(T('Συνδεθήκατε','You are connected')+(j&&j.name?T(' με τον/την ',' with ')+j.name:'')+'.'); load(); if(j&&j.friend&&j.mine===false) shareBack(j.friend,j.name); })
      .catch(function(e){ rb.disabled=false; var m=String(e.message); if(/έληξε|does not exist|δεν υπάρχει|δικός σου/i.test(m)) clearPend(); B.toast(/έληξε|does not exist|δεν υπάρχει/i.test(m)?T('Ο κωδικός δεν υπάρχει ή έληξε.','The code does not exist or has expired.'):/δικός σου/.test(m)?T('Αυτός είναι ο δικός σου κωδικός.','This is your own code.'):C().errText(e)); }); }});
  var pc=pend();
  if(pc){ ci.value=pc.slice(0,4)+'-'+pc.slice(4); c.append(h('div',{class:'frinv'},h('b',{text:T('Πρόσκληση από φίλο','Invite from a friend')}),h('span',{text:T('Ο κωδικός ','The code ')+ci.value+T(' μπήκε από τον σύνδεσμο. Πάτα «Σύνδεση».',' came from the link. Tap “Connect”.')}))); rb.classList.add('pri'); ib.classList.remove('pri'); }
  var gotH=h('h3',{class:'h3',text:T('Έχεις κωδικό από φίλο;','Got a code from a friend?')}), gotR=h('div',{class:'inrow'},ci,rb);
  /* 1.14.98 (απόρρητο): πριν από τη «Σύνδεση», ότι η κοινή χρήση ανοίγει και από τη δική σου μεριά */
  var gotN=h('p',{class:'sub',text:T('Με τη σύνδεση βλέπεις τα ψάρια του φίλου σου. Τα δικά σου τα βλέπει μόνο αν το ανοίξεις εσύ.','Connecting lets you see your friend’s catches. They see yours only if you turn it on.')});
  if(pc) c.append(gotR,gotN,h('h3',{class:'h3',text:T('Ή πρόσκαλεσε εσύ κάποιον','Or invite someone yourself')}),ib,inv); /* με κωδικό από σύνδεσμο: πρώτα η σύνδεση */
  else c.append(ib,inv,gotH,gotR,gotN);
  page.append(c);
  /* λίστα */
  if(err) page.append(h('p',{class:'err',text:err}));
  if(list==null) page.append(h('div',{class:'card'},h('div',{class:'sk',style:{height:'56px'}})));
  else if(list.length){ page.append(h('h3',{class:'listh',text:T('Οι φίλοι σου','Your friends')}));
    list.forEach(function(f){
      var sw=h('input',{type:'checkbox',checked:!!f.mine}); sw.addEventListener('change',function(){ var v=sw.checked;
        C().rest('friends?owner=eq.'+me()+'&viewer=eq.'+f.uid,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({share:v})}).then(function(){ f.mine=v; B.toast(v?f.name+T(' βλέπει ξανά τα δικά σου.',' can see yours again.'):f.name+T(' δεν βλέπει πια τα δικά σου.',' no longer sees yours.')); }).catch(function(e){ sw.checked=!v; B.toast(C().errText(e)); }); });
      var card=h('section',{class:'card fr'},h('div',{class:'idr'},h('span',{class:'av',text:(f.name||'?').charAt(0).toUpperCase()}),h('div',{class:'tx'},h('button',{class:'frname',type:'button',title:T('Άλλαξε το όνομα που βλέπεις','Change the name you see'),onclick:function(){ nick(f); }},h('b',{text:f.name}),h('span',{class:'frpen',text:' ✎'})),h('small',{text:f.theyShare?T('Μοιράζεται μαζί σου','Shares with you'):T('Δεν μοιράζεται μαζί σου','Not sharing with you')}))),
        h('label',{class:'tg'},sw,h('span',{text:T('Βλέπει τα ψάρια μου (είδος, βάρος, ημερομηνία· όχι θέσεις, διαδρομές, φωτογραφίες)','Can see my catches (species, weight, date; no positions, tracks or photos)')})),
        h('div',{class:'acts'},f.theyShare?h('button',{class:'btn pri',type:'button',text:T('Τα ψάρια του','Their catches'),onclick:function(){ showFriend(f); }}):null,
          h('button',{class:'btn del',type:'button',text:T('Αφαίρεση','Remove'),onclick:function(){ B.ask(T('Αφαίρεση του/της ','Remove ')+f.name+T(' από τους φίλους; Σταματάτε να βλέπετε ο ένας τα του άλλου.',' from friends? You both stop seeing each other’s data.'),T('Αφαίρεση','Remove'),true).then(function(y){ if(!y) return;
            C().rest('friends?owner=eq.'+me()+'&viewer=eq.'+f.uid,{method:'DELETE',headers:{Prefer:'return=minimal'}}).then(function(){ return C().rest('friends?owner=eq.'+f.uid+'&viewer=eq.'+me(),{method:'DELETE',headers:{Prefer:'return=minimal'}}); }).then(function(){ B.toast(T('Αφαιρέθηκε.','Removed.')); load(); }).catch(function(e){ B.toast(C().errText(e)); }); }); }})));
      page.append(card); });
  } else page.append(h('div',{class:'card empty'},h('h3',{text:T('Δεν έχεις φίλους ακόμα','No friends yet')}),h('p',{text:T('Φτιάξε κωδικό και στείλ’ τον, ή γράψε τον κωδικό που σου έστειλαν.','Create a code and send it, or enter the code you received.')})));
  root.replaceChildren(page);
}
/* stage2 (C): μετά τη σύνδεση με κωδικό, ο φίλος ΔΕΝ βλέπει τα δικά σου μέχρι να το ανοίξεις· ρωτά μία φορά */
function shareBack(uid,name){ var nm=name||T('ο φίλος σου','your friend');
  var sh=B.sheet({title:T('Να βλέπει τα δικά σου;','Share yours?'),body:h('div',{class:'bform'},
    h('p',{text:EN?'Can '+nm+' see your catches (species, weight, date; no positions, tracks or photos)?':'Να βλέπει ο/η '+nm+' τα ψάρια σου (είδος, βάρος, ημερομηνία· όχι θέσεις, διαδρομές, φωτογραφίες);'}),
    h('button',{class:'btn pri full',type:'button',text:T('Ναι','Yes'),onclick:function(){ C().rest('friends?owner=eq.'+me()+'&viewer=eq.'+uid,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({share:true})}).then(function(){ sh.close(); B.toast(nm+T(' βλέπει τα δικά σου.',' can see yours.')); load(); }).catch(function(e){ B.toast(C().errText(e)); }); }}),
    h('button',{class:'btn full',type:'button',text:T('Όχι τώρα','Not now'),onclick:function(){ sh.close(); }}))}); }
function showFriend(f){
  var body=h('div',null,h('div',{class:'sk',style:{height:'120px'}})), sh=B.sheet({title:f.name,body:body});
  /* stage2 (28/11/2026): η βάση δίνει στον φίλο μόνο είδος, πλήθος, κιλά, μήκος, ημερομηνία, ώρα και πλήθος εξόδων/σημείων (friend_view) */
  C().rest('rpc/friend_view',{method:'POST',body:JSON.stringify({p_owner:f.uid})}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }).then(function(fv){
    fv=fv||{}; var bites=(Array.isArray(fv.bites)?fv.bites:[]).slice().sort(function(a,b){ return ((b.date||'')+(b.time||'')).localeCompare((a.date||'')+(a.time||'')); });
    var spots=+fv.spots||0, trips=+fv.trips||0;
    var n=bites.reduce(function(s,b){ return s+Math.max(1,Math.floor(+b.cnt)||1); },0);
    var sp={}; bites.forEach(function(b){ var k=b.species||'?'; sp[k]=(sp[k]||0)+Math.max(1,Math.floor(+b.cnt)||1); });
    var top=Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; }).slice(0,5);
    var out=[h('div',{class:'kpis'},[[String(n),T('ψάρια','catches')],[String(trips),T('έξοδοι','trips')],[String(spots),T('σημεία','spots')],[top[0]||'–',T('συχνότερο','most common')]].map(function(k){ return h('div',{class:'kpi'},h('b',{text:k[0]}),h('span',{text:k[1]})); }))];
    if(bites.length){ var l=h('div',{class:'list'}); bites.slice(0,60).forEach(function(b){ l.append(h('div',{class:'li'},h('span',{class:'ic'},B.icon('fish')),h('span',{class:'tx'},h('b',{text:(b.species||'')+(+b.cnt>1?' ×'+b.cnt:'')}),h('small',{text:[+b.kg?String(b.kg).replace('.',EN?'.':',')+' kg':'',+b.len?b.len+' cm':''].filter(Boolean).join(' · ')||' '})),h('span',{class:'when',text:(b.date?B.dateShort(b.date):'')+(b.time?', '+b.time:'')}))); });
      out.push(h('h3',{class:'listh',text:T('Πρόσφατα ψάρια','Recent catches')}),l); }
    else out.push(h('p',{class:'sub',text:T('Δεν έχει κοινά ψάρια ακόμα.','No shared catches yet.')}));
    body.replaceChildren.apply(body,out);
  }).catch(function(e){ body.replaceChildren(h('p',{class:'err',text:C().errText(e)})); });
}
B.view('friends',{title:T('Φίλοι','Friends'),mount:function(el){ root=el; if(C().session()) load(); else draw(); },unmount:function(){ root=null; },resume:function(){ draw(); }});
})();
