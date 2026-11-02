/* BiteCast 4 · «Ευκαιρίες για τα σημεία σου» (v31z521)
   Για τις τοποθεσίες που παρακολουθείς και τα σημεία όπου έχεις πιάσει ψάρια: η πρόγνωση των επόμενων ημερών
   (δείκτης, ασφαλές παράθυρο), μαζί με τα δικά σου μοτίβα εκεί (ψάρια την ίδια εποχή, ώρες που πιάνεις, είδη).
   Ειδοποίηση μία φορά τη μέρα για την καλύτερη ευκαιρία σήμερα ή αύριο. */
(function(){
var B=window.BC, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var KEY='psaro-v4-opps', SENT='psaro-v4-opps-sent', busy=null;
function hav(a,b){ var R=6371000, r=Math.PI/180, dl=(b.lat-a.lat)*r, dn=(b.lon-a.lon)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
function bites(){ try{ return B.store.raw('bites').filter(function(b){ return !b.deleted&&!b.miss&&b.lat!=null&&b.date&&!B.pest(b); }); }catch(e){ return []; } }
function spName(n){ return n&&window.spName?window.spName(n):n; }
/* υποψήφια σημεία: πρώτα όσα παρακολουθείς, μετά τα σημεία με τα περισσότερα ψάρια */
function cands(){
  var out=[], bs=bites();
  (ls.get('psaro-places',[])||[]).forEach(function(p){ if(p&&p.lat!=null&&p.watch!==false) out.push({name:p.name||T('Τοποθεσία','Place'),lat:+p.lat,lon:+p.lon,w:2}); });
  var sp=[]; try{ sp=B.store.raw('spots').filter(function(s){ return !s.deleted&&s.lat!=null; }); }catch(e){}
  sp.forEach(function(s){ var n=bs.filter(function(b){ return hav(s,b)<1500; }).length; if(n) out.push({name:s.name||T('Σημείο','Spot'),lat:s.lat,lon:s.lon,w:1,n:n}); });
  out.sort(function(a,b){ return (b.w-a.w)||((b.n||0)-(a.n||0)); });
  var keep=[]; out.forEach(function(c){ if(keep.length<4&&!keep.some(function(k){ return hav(k,c)<1200; })) keep.push(c); });
  return keep;
}
/* τα δικά σου στοιχεία κοντά στο σημείο: ψάρια σε αυτή την εποχή, συνήθεις ώρες, συχνότερο είδος */
function mine(c,month){
  var near=bites().filter(function(b){ return hav(c,b)<1500; }), seas=near.filter(function(b){ var m=+b.date.slice(5,7); var d=Math.abs(m-month); return Math.min(d,12-d)<=1; });
  var hrs={}, sp={}; seas.forEach(function(b){ var hh=parseInt((b.time||'').slice(0,2),10); if(hh>=0) hrs[hh]=(hrs[hh]||0)+1; if(b.species) sp[b.species]=(sp[b.species]||0)+1; });
  var hk=Object.keys(hrs).map(Number).sort(function(a,b){ return hrs[b]-hrs[a]; }), top=Object.keys(sp).sort(function(a,b){ return sp[b]-sp[a]; })[0]||'';
  var core=hk.slice(0,3).sort(function(a,b){ return a-b; });
  return {all:near.length,season:seas.length,sp:top,h0:core.length?core[0]:null,h1:core.length?core[core.length-1]:null};
}
function score(d,m){ var s=d.best||0, why=[];
  if(m.season){ s+=Math.min(12,m.season*3); }
  if(m.h0!=null&&d.win&&!(d.win.e<m.h0-1||d.win.s>m.h1+1)) s+=6;
  return Math.min(100,Math.round(s)); }
function compute(force){
  var c=ls.get(KEY,null); if(!force&&c&&Date.now()-c.t<3*3600000) return Promise.resolve(c.items);
  if(busy) return busy; var PF=window.PF; if(!PF||!PF.getForecast) return Promise.resolve([]);
  var cs=cands(); if(!cs.length){ ls.set(KEY,{t:Date.now(),items:[]}); return Promise.resolve([]); }
  var items=[];
  busy=cs.reduce(function(pr,cd){ return pr.then(function(){ return PF.getForecast(cd.lat,cd.lon,null,{days:4}).then(function(fc){
      (fc.days||[]).slice(0,4).forEach(function(d){ if(!d.safe||!d.win) return; var m=mine(cd,+d.date.slice(5,7)), sc=score(d,m);
        items.push({name:cd.name,lat:cd.lat,lon:cd.lon,date:d.date,s:d.win.s,e:d.win.e,base:d.best,score:sc,wind:d.avgWind,wave:d.avgWave,m:m}); });
    }).catch(function(){}); }); },Promise.resolve()).then(function(){
    items.sort(function(a,b){ return b.score-a.score; }); var top=[], seen={};
    items.forEach(function(it){ var k=it.name+it.date; if(top.length<5&&!seen[k]){ seen[k]=1; top.push(it); } });
    ls.set(KEY,{t:Date.now(),items:top}); busy=null; notifyBest(top); return top; });
  return busy;
}
B.opps={compute:compute,mine:mine};
function dayLbl(ds){ var t=new Date(), td=t.getFullYear()+'-'+B.pad(t.getMonth()+1)+'-'+B.pad(t.getDate()), tm=new Date(Date.now()+86400000), tmr=tm.getFullYear()+'-'+B.pad(tm.getMonth()+1)+'-'+B.pad(tm.getDate());
  if(ds===td) return T('Σήμερα','Today'); if(ds===tmr) return T('Αύριο','Tomorrow'); try{ return new Date(ds+'T12:00:00').toLocaleDateString(EN?'en-GB':'el-GR',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return ds; } }
function whyTxt(it){ var m=it.m||{}, out=[];
  if(m.season) out.push(T('εδώ ','here ')+m.season+(m.season===1?T(' ψάρι',' catch'):T(' ψάρια',' catches'))+T(' αυτή την εποχή',' this season')+(m.sp?' ('+spName(m.sp)+')':''));
  else if(m.all) out.push(T('εδώ ','here ')+m.all+(m.all===1?T(' ψάρι συνολικά',' catch in total'):T(' ψάρια συνολικά',' catches in total')));
  if(m.h0!=null) out.push(T('συνήθως ','usually ')+B.pad(m.h0)+':00–'+B.pad((m.h1+1)%24)+':00');
  var U=window.PsaroUnits; if(it.wind!=null) out.push((U?U.wind(it.wind):Math.round(it.wind)+' kn')+(it.wave!=null?' · '+(U?U.wave(it.wave):B.num(it.wave,1)+' m'):''));
  return out.join(' · '); }
function notifyBest(top){
  var best=top[0]; if(!best||best.score<70) return; var lbl=dayLbl(best.date); if(lbl!==T('Σήμερα','Today')&&lbl!==T('Αύριο','Tomorrow')) return;
  var today=new Date().toISOString().slice(0,10), sent=ls.get(SENT,null); if(sent===today) return; ls.set(SENT,today);
  var title=T('Καλή ευκαιρία: ','Good chance: ')+best.name, body=lbl+' '+B.pad(best.s)+':00–'+B.pad((best.e+1)%24)+':00 · '+T('δείκτης ','score ')+best.score+(whyTxt(best)?' · '+whyTxt(best):'');
  if(B.inboxAdd) B.inboxAdd(title,body,'good');
  try{ if(document.hidden&&'Notification' in window&&Notification.permission==='granted'&&navigator.serviceWorker){ navigator.serviceWorker.getRegistration().then(function(r){ if(r) r.showNotification(title,{body:body,icon:'../icon-192.png',tag:'psaro-opps'}); }); return; } }catch(e){}
  B.toast(title+' · '+body,9000);
}
/* κάρτα για την Πρόγνωση */
B.oppsCard=function(max,opt){ opt=opt||{};
  var box=h('section',{class:'card opps','aria-label':T('Ευκαιρίες για τα σημεία σου','Chances at your spots')}), list=h('div',{class:'opl'});
  box.append(h('div',{class:'oph'},h('h2',{text:T('Ευκαιρίες για τα σημεία σου','Chances at your spots')}),h('button',{class:'linkbtn',type:'button',text:T('Ανανέωση','Refresh'),onclick:function(){ list.replaceChildren(h('p',{class:'sub',text:T('Υπολογισμός…','Calculating…')})); compute(true).then(paint); }})),list);
  function paint(items){ list.replaceChildren(); items=(items||[]).slice(0,max||3);
    if(!items.length){ if(opt.hideEmpty){ box.hidden=true; return; } list.append(h('p',{class:'sub',text:cands().length?T('Καμία καλή και ασφαλής ευκαιρία τις επόμενες μέρες.','No good, safe chance in the coming days.'):T('Πρόσθεσε τοποθεσίες στις Ειδοποιήσεις ή σημεία με ψάρια για να βλέπεις ευκαιρίες εδώ.','Add places in Alerts or spots with catches to see chances here.')})); return; }
    box.hidden=false;
    items.forEach(function(it){ var cls=it.score>=80?'hi':it.score>=65?'mid':'lo';
      list.append(h('button',{type:'button',class:'opr',onclick:function(){ if(B.mapGo) B.mapGo(it.lat,it.lon,13); }},
        h('span',{class:'ops '+cls,text:String(it.score)}),
        h('span',{class:'opt'},h('b',{text:dayLbl(it.date)+' '+B.pad(it.s)+':00–'+B.pad((it.e+1)%24)+':00 · '+it.name}),h('small',{text:whyTxt(it)||T('Καλές συνθήκες','Good conditions')})),B.icon?B.icon('chev'):null)); }); }
  var c=ls.get(KEY,null); if(c&&c.items) paint(c.items); else list.append(h('p',{class:'sub',text:T('Υπολογισμός…','Calculating…')}));
  compute(false).then(paint);
  return box; };
setTimeout(function(){ compute(false); },12000);
setInterval(function(){ if(!document.hidden) compute(false); },60*60000);
})();
