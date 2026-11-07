/* Alkyon 4 · Ρεκόρ και στόχοι σεζόν (v31z545)
   - Ρεκόρ ανά είδος (βάρος, μήκος) και «πρώτο της χρονιάς». Όταν καταγράφεις ψάρι που σπάει ρεκόρ ή είναι το πρώτο του είδους φέτος, βγαίνει μήνυμα.
   - Στόχοι που βάζεις εσύ (έξοδοι / ψάρια / είδη, ανά μήνα ή χρονιά), με πρόοδο. Οι λαγοκέφαλοι δεν μετράνε.
   Κλειδί: alkyon-v4-goals. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls, GK='alkyon-v4-goals', seen=null;
function bc(b){ return +b.cnt>1?+b.cnt:1; }
function kgOf(b){ return +b.kg>0?(+b.kg)/bc(b):0; }
function bites(){ try{ return B.store.bites().filter(function(b){ return !b.deleted&&!b.gear&&b.species; }); }catch(e){ return []; } }
function norm(s){ return String(s||'').trim().toLowerCase(); }
function records(){ var R={}; bites().forEach(function(b){ var k=norm(b.species), r=R[k]||(R[k]={sp:b.species,n:0,kg:null,len:null,first:{}});
    r.n+=bc(b); var kg=kgOf(b); if(kg&&(!r.kg||kg>r.kg.v)) r.kg={v:kg,b:b}; if(+b.len>0&&(!r.len||+b.len>r.len.v)) r.len={v:+b.len,b:b};
    var y=(b.date||'').slice(0,4); if(y&&(!r.first[y]||b.date<r.first[y].date)) r.first[y]=b; });
  return R; }
/* νέα καταγραφή: ρεκόρ ή πρώτο της χρονιάς; */
function check(){ var all=bites(), ids={}; all.forEach(function(b){ ids[b.id]=1; });
  if(!seen){ seen=ids; return; } var nw=all.filter(function(b){ return !seen[b.id]; }); seen=ids; if(!nw.length||nw.length>3) return;
  nw.forEach(function(b){ var k=norm(b.species), y=(b.date||'').slice(0,4), others=all.filter(function(x){ return x.id!==b.id&&norm(x.species)===k; }), msg=null;
    var prevKg=others.reduce(function(m,x){ return Math.max(m,kgOf(x)); },0), kg=kgOf(b);
    if(kg&&prevKg&&kg>prevKg) msg='🏆 '+T('Νέο ρεκόρ: ','New record: ')+b.species+' '+B.num(kg,2)+' kg'+T(' (πριν ',' (was ')+B.num(prevKg,2)+' kg)';
    else if(!others.length) msg='🎉 '+T('Πρώτη φορά: ','First ever: ')+b.species+'!';
    else if(y&&!others.some(function(x){ return (x.date||'').slice(0,4)===y; })) msg='🎉 '+T('Το πρώτο ','The first ')+b.species+T(' του ',' of ')+y+'!';
    if(msg) setTimeout(function(){ B.toast(msg,6000); },900); });
  goalCheck(); }
/* ---------- στόχοι ---------- */
function goals(){ var a=ls.get(GK,[]); return Array.isArray(a)?a:[]; }
function period(g){ var d=new Date(), y=d.getFullYear(), m=B.pad(d.getMonth()+1); return g.per==='month'?[y+'-'+m+'-01',y+'-'+m+'-31']:[y+'-01-01',y+'-12-31']; }
function progress(g){ var p=period(g), v=0;
  if(g.type==='trips'){ try{ v=B.store.raw('trips').filter(function(t){ return !t.deleted&&t.date>=p[0]&&t.date<=p[1]; }).length; }catch(e){} }
  else { var bs=bites().filter(function(b){ return b.date>=p[0]&&b.date<=p[1]; });
    if(g.type==='fish') v=bs.reduce(function(s,b){ return s+bc(b); },0);
    else if(g.type==='species'){ var s={}; bs.forEach(function(b){ s[norm(b.species)]=1; }); v=Object.keys(s).length; }
    else if(g.type==='one') v=bs.filter(function(b){ return norm(b.species)===norm(g.sp); }).reduce(function(s,b){ return s+bc(b); },0); }
  return v; }
var TY={trips:T('Έξοδοι','Trips'),fish:T('Ψάρια','Fish'),species:T('Διαφορετικά είδη','Different species'),one:T('Ψάρια ενός είδους','Fish of one species')};
function gName(g){ return (g.type==='one'?(g.sp||'?'):TY[g.type])+' · '+(g.per==='month'?T('αυτόν τον μήνα','this month'):T('φέτος','this year')); }
function goalCheck(){ var a=goals(), ch=false, key=function(g){ return g.id+':'+period(g)[0]; };
  a.forEach(function(g){ if(progress(g)>=g.n&&g.done!==key(g)){ g.done=key(g); ch=true; setTimeout(function(){ B.toast('🎯 '+T('Στόχος: ','Goal: ')+gName(g)+' · '+g.n+' ✓',6000); },1600); } });
  if(ch) ls.set(GK,a); }
function addGoal(onDone){ var ty=h('select',{class:'select'}), pe=h('select',{class:'select'}), n=h('input',{type:'number',min:'1',max:'999',value:'10',inputmode:'numeric'}), sp=h('input',{type:'text',placeholder:T('π.χ. Λαβράκι','e.g. Sea bass'),hidden:true}), sh;
  Object.keys(TY).forEach(function(k){ ty.append(h('option',{value:k,text:TY[k]})); }); [['month',T('Αυτόν τον μήνα','This month')],['year',T('Φέτος','This year')]].forEach(function(o){ pe.append(h('option',{value:o[0],text:o[1]})); });
  ty.addEventListener('change',function(){ sp.hidden=ty.value!=='one'; });
  sh=B.sheet({title:T('Νέος στόχος','New goal'),body:h('div',{class:'bform'},h('label',{class:'fld'},h('span',{text:T('Τι','What')}),ty),sp,h('div',{class:'g2'},h('label',{class:'fld'},h('span',{text:T('Πόσα','How many')}),n),h('label',{class:'fld'},h('span',{text:T('Πότε','When')}),pe)),
    h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση','Save'),onclick:function(){ var v=Math.floor(+n.value); if(!(v>0)) return; if(ty.value==='one'&&!sp.value.trim()) { sp.focus(); return; }
      var a=goals(); a.push({id:Date.now().toString(36),type:ty.value,per:pe.value,n:v,sp:ty.value==='one'?sp.value.trim():''}); ls.set(GK,a); sh.close(); if(onDone) onDone(); }}))}); }
/* ---------- κάρτες για τα Στατιστικά ---------- */
B.recordsCards=function(page){
  var R=records(), keys=Object.keys(R).filter(function(k){ return R[k].kg||R[k].len; }).sort(function(a,b){ return (R[b].kg?R[b].kg.v:0)-(R[a].kg?R[a].kg.v:0); });
  /* στόχοι */
  var gc=h('section',{class:'card goals'}); function drawG(){ gc.replaceChildren(h('div',{class:'gh'},h('h2',{text:'🎯 '+T('Στόχοι','Goals')}),h('button',{class:'btn sm',type:'button',text:'+ '+T('Νέος','New'),onclick:function(){ addGoal(drawG); }})));
    var a=goals(); if(!a.length){ gc.append(h('p',{class:'sub',text:T('Βάλε έναν στόχο, π.χ. 6 έξοδοι αυτόν τον μήνα ή 10 διαφορετικά είδη φέτος.','Set a goal, e.g. 6 trips this month or 10 different species this year.')})); return; }
    a.forEach(function(g,i){ var v=progress(g), pc=Math.min(100,Math.round(v/g.n*100));
      gc.append(h('div',{class:'goal'+(v>=g.n?' done':'')},h('div',{class:'gt'},h('span',{text:gName(g)}),h('b',{text:v+' / '+g.n+(v>=g.n?' ✓':'')}),h('button',{class:'gx',type:'button','aria-label':T('Διαγραφή','Delete'),text:'×',onclick:function(){ var b=goals(); b.splice(i,1); ls.set(GK,b); drawG(); }})),h('div',{class:'gbar'},h('i',{style:{width:pc+'%'}})))); }); }
  drawG(); page.append(gc);
  if(!keys.length) return;
  var c=h('section',{class:'card recs'},h('h2',{text:'🏆 '+T('Ρεκόρ ανά είδος','Records by species')})), y=String(new Date().getFullYear());
  /* 1.9.16: τα 5 πρώτα· τα υπόλοιπα με «Όλα τα ρεκόρ»· κάθε γραμμή ανοίγει το ψάρι */
  keys.slice(0,12).forEach(function(k,i){ var r=R[k], rb=(r.kg||r.len).b;
    c.append(h('div',{class:'rec'+(i>=5?' rx':''),role:B.biteDetail?'button':null,tabindex:B.biteDetail?'0':null,onclick:B.biteDetail?function(){ B.biteDetail(rb); }:null},h('b',{text:r.sp}),h('span',{text:[r.kg?B.num(r.kg.v,2)+' kg':'',r.len?Math.round(r.len.v)+' cm':''].filter(Boolean).join(' · ')}),h('small',{text:(r.kg||r.len).b.date?B.dateShort((r.kg||r.len).b.date)+((r.kg||r.len).b.place?' · '+(r.kg||r.len).b.place:''):''}))); });
  var nk=Math.min(12,keys.length); if(nk>5){ var mb=h('button',{class:'btn sm recmore',type:'button',text:T('Όλα τα ρεκόρ (','All records (')+nk+') ›',onclick:function(){ c.classList.add('all'); mb.remove(); }}); c.append(mb); }
  var fy=Object.keys(R).filter(function(k){ return R[k].first[y]; }).length; if(fy) c.append(h('p',{class:'foot',text:T('Φέτος: ','This year: ')+fy+T(' διαφορετικά είδη.',' different species.')}));
  page.append(c); };
B.on('store',function(k){ if(k==='alkyon-bites'||k==='alkyon-trips') setTimeout(check,300); });
setTimeout(check,1500);
})();
