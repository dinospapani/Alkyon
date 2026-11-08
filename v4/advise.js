/* Alkyon 4 · μηχανή «Τι να ψαρέψω» και «Δικά μου» (χωρίς οθόνη).
   Ίδιοι κανόνες με την κλασική advisor.js / mine-tab.js: ξεκινά από γενική γνώση (../knowledge.js) και περνά στα δικά σου ψάρια
   όσο μαζεύονται (../personal.js). Τρέχει μόνο στη συσκευή. */
(function(){
'use strict';
var B=window.AK, PP=window.PP, KB=window.SPKB||[], T=B.T, EN=B.EN;
var K=4, NEED_A=8, PTS=['fast','slow','stable','rise'];
function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function windCls(w){ return w==null?null:w<8?0:w<=14?1:2; }
KB.forEach(function(e){ if(!e._a){ e._a=e.a.concat([norm(e.n),norm(e.en)]); } });
function kbOf(name,latin){ var s=norm(name+' '+(latin||'')); for(var i=0;i<KB.length;i++){ var e=KB[i]; for(var j=0;j<e._a.length;j++) if(s.indexOf(e._a[j])>=0) return e; } return null; }
function sName(e){ return EN&&e.en?e.en:e.n; }
function utcMin(){ return -new Date().getTimezoneOffset(); }

/* εγγραφές όπως στην κλασική: act = ψάρια (όχι χαμένα, όχι δίχτυα), misses = χαμένα */
function bitesAll(){ return B.records('bites').filter(function(b){ return !b.deleted&&!B.pest(b); }); }
function act(){ return bitesAll().filter(function(b){ return !b.miss&&!b.gear; }); }
function misses(){ return bitesAll().filter(function(b){ return b.miss; }); }
function trips(){ return B.records('trips').filter(function(t){ return !t.deleted; }); }
function model(){ return PP.build(trips(),act(),{utcMin:utcMin(),misses:misses()}); }
function calib(){ return PP.calib(trips(),act(),{utcMin:utcMin(),misses:misses()}); }
function vsMoon(){ return PP.vsMoon?PP.vsMoon(trips(),act(),{utcMin:utcMin(),misses:misses()}):null; }

function collect(){
  var bites=act(), utc=utcMin(), m=PP.build(trips(),bites,{utcMin:utc,misses:misses()}), by={}, total=0;
  bites.forEach(function(b){
    if(!b.species) return; var e=kbOf(b.species,b.latin), key=e?e.n:norm(b.species).replace(/\s*\(.*$/,'');
    var o=by[key]||(by[key]={key:key,kb:e,name:e?e.n:String(b.species).replace(/\s*\(.*$/,''),n:0,bites:[]});
    var ms=PP.biteMs(b,utc); o.n++; total++;
    o.bites.push({depth:b.depth,ph:(ms!=null?PP.phaseAt(ms,b.lat,b.lon,utc):null),hr:b.time?+b.time.slice(0,2):null,moon:ms!=null?PP.moonOf(ms):null,month:b.date?+b.date.slice(5,7)-1:null,pt:PTS.indexOf(b.ptrend),w:windCls(b.wind),tide:b.tide||null,sst:b.sst,tech:b.tech||'',bait:b.bait||'',lat:b.lat,lon:b.lon,kg:+b.kg||0});
  });
  /* δεδομένα φίλου (ext.js): ξεχωριστά, μόνο ως εποχιακή ένδειξη, όπως στην κλασική */
  var ext={}; try{ ((window.AlkyonExt&&window.AlkyonExt.use())||[]).forEach(function(r){ if(!r.sp) return; var e=kbOf(r.sp,''), key=e?e.n:norm(r.sp).replace(/\s*\(.*$/,''); var o=ext[key]||(ext[key]={n:0,m:[0,0,0,0,0,0,0,0,0,0,0,0]}); o.n++; if(r.month!=null) o.m[r.month]++; }); }catch(e){}
  return {model:m,by:by,ext:ext,total:total,H:m.H||0};
}
function lnTod(e,hr){ var w=e.tod[Math.floor(hr/3)]; return Math.log(0.4+1.2*w); }
function lnMonth(e,mo){ var w=e.m[mo]/3; return Math.log(0.4+1.2*w); }
function lnSst(e,sst){ if(sst==null) return 0; var lo=e.sst[0], hi=e.sst[1], d=sst<lo?lo-sst:sst>hi?sst-hi:0; var w=clamp(1-d/4,0,1); return Math.log(0.4+1.2*w); }
function lnWind(e,wc){ if(wc==null) return 0; return Math.log(0.4+1.2*e.w[wc]); }
function prior(e,x){ return lnTod(e,x.hr)+lnMonth(e,x.month)+lnSst(e,x.sst)+lnWind(e,x.wc); }
function dataL(D,o,x){
  if(!D.H||D.H<2||!o||o.n<2) return 0;
  var F=D.model.factors, r=o.n/D.H, L=0;
  function lv(k,i,get){ if(i==null||i<0||!F[k][i]) return; var c=0; o.bites.forEach(function(q){ if(get(q)===i) c++; }); var m=((c+K*r)/(F[k][i].h+K))/r; L+=Math.log(m); }
  lv('block',PP.phaseOf(x.hr*60+30,x.rise,x.set),function(q){ return q.ph; });
  lv('moon',x.moon,function(q){ return q.moon; });
  lv('ptrend',PTS.indexOf(x.pt),function(q){ return q.pt; });
  lv('wind',x.wc,function(q){ return q.w; });
  if(x.tide==='up'||x.tide==='down'){ var cu=0,cd=0; o.bites.forEach(function(q){ if(q.tide==='up') cu++; else if(q.tide==='down') cd++; });
    var n2=cu+cd; if(n2>=3){ var cc=x.tide==='up'?cu:cd; L+=Math.log(((cc+K*0.5)/(n2+K))/0.5); } }
  return clamp(L,-2,2);
}
function lscore(D,e,o,x){ var n=o?o.n:0, a=D.H>=2?n/(n+NEED_A):0, Lp=e?prior(e,x):0, Ld=dataL(D,o,x); return (1-a)*Lp+a*Ld; }
function kbFits(e,p){
  if(p==='boat') return true;
  if(p==='lake') return false;
  if(p==='spear') return e.d[0]<=25&&e.t.some(function(t){ return t!=='Τρόλινγκ'; });
  var land=e.t.some(function(t){ return t==='Βυθού'||t==='Spinning'||t==='Ζωντανό δόλωμα'||t==='Άλλο'; });
  return land&&e.d[0]<=30;
}
function rank(D,x){
  var out=[], seen={}, P=B.prof(), tot=0;
  KB.forEach(function(e){ seen[e.n]=1; if(!kbFits(e,P)) return; out.push({e:e,o:D.by[e.n],name:e.n,common:e.c}); });
  Object.keys(D.by).forEach(function(k){ if(!seen[k]){ seen[k]=1; out.push({e:null,o:D.by[k],name:D.by[k].name,common:1}); } });
  out.forEach(function(c){ var n=c.o?c.o.n:0; c.L=lscore(D,c.e,c.o,x); c.s=(n+0.6*c.common)*Math.exp(clamp(c.L,-2,2)); tot+=c.s; });
  out.forEach(function(c){ c.p=tot?c.s/tot:0; });
  return out.sort(function(a,b){ return b.s-a.s; });
}
function tally(c){ var t={}, bt={}; if(c.o&&c.o.n>=3) c.o.bites.forEach(function(q){ if(q.tech) t[q.tech]=(t[q.tech]||0)+1; if(q.bait) bt[q.bait]=(bt[q.bait]||0)+1; }); return {t:t,b:bt}; }
function topKeys(m,k){ return Object.keys(m).sort(function(a,b){ return m[b]-m[a]; }).slice(0,k); }
var KTR={'Βυθού':'Bottom fishing','Ζωντανό δόλωμα':'Live bait','Τρόλινγκ':'Trolling','Άλλο':'Other','γαρίδα':'shrimp','ζωντανή γαρίδα':'live shrimp','ζωντανή σαρδέλα':'live sardine','ζωντανό καλαμάρι':'live squid','Ζωντανό ψαράκι':'live baitfish','ζωντανό ψαράκι':'live baitfish','καλαμάρι':'squid','σαρδέλα':'sardine','σκουλήκι':'worm','χταπόδι':'octopus','ψωμί':'bread'};
function kt(a){ return EN?a.map(function(x){ return KTR[x]||x; }):a; }

/* συνθήκες μιας ώρας της πρόγνωσης για το μοντέλο */
function slot(d,q){ var wx=d.wx||{}; return {rise:d.rise,set:d.set,hr:q.hr,month:+d.date.slice(5,7)-1,moon:Math.floor(d.f*4+0.5)%4,mf:d.f,pt:q.ptrend,wc:windCls(q.wind),sst:wx.sst!=null?wx.sst:null,wind:q.wind,wave:q.wave,tide:q.tide||null}; }

/* τα πιο πιθανά είδη για μία ώρα, με τεχνική, δόλωμα, βάθος */
function suggest(D,x){
  var R=rank(D,x), top=R.slice(0,6), out=top.map(function(r){
    var e=r.e, tl=tally(r), tq=topKeys(tl.t,2), bq=topKeys(tl.b,2);
    var dv=r.o?r.o.bites.filter(function(q){ return q.depth!=null&&q.depth!==''; }).map(function(q){ return +q.depth; }):[];
    var depth=dv.length>=3?(window.AlkyonUnits&&AlkyonUnits.depth?AlkyonUnits.depth(Math.round(dv.reduce(function(a,b){ return a+b; },0)/dv.length)):Math.round(dv.reduce(function(a,b){ return a+b; },0)/dv.length)+' m'):(e&&e.d?(window.AlkyonUnits&&AlkyonUnits.depthRange?AlkyonUnits.depthRange(e.d[0],e.d[1]):e.d[0]+'–'+e.d[1]+' m'):'');
    return {name:e?sName(e):r.name,p:r.p,n:r.o?r.o.n:0,tech:kt(tq.length?tq:(e?e.t.slice(0,2):[])),bait:kt(bq.length?bq:(e?e.b.slice(0,2):[])),depth:depth,warn:e&&e.warn?(EN?e.warn[1]:e.warn[0]):''};
  });
  var tw={};
  R.slice(0,8).forEach(function(r){ var tl=tally(r), n=r.o?r.o.n:0, a=D.H>=2?n/(n+NEED_A):0, e=r.e, sum=0;
    Object.keys(tl.t).forEach(function(k){ sum+=tl.t[k]; });
    Object.keys(tl.t).forEach(function(k){ tw[k]=(tw[k]||0)+r.p*a*tl.t[k]/sum; });
    if(e) e.t.forEach(function(k,i){ tw[k]=(tw[k]||0)+r.p*(1-a)*[.5,.3,.2][i]; }); });
  var tk=Object.keys(tw).sort(function(a,b){ return tw[b]-tw[a]; }).slice(0,3), ts=0; tk.forEach(function(k){ ts+=tw[k]; });
  return {species:out,tech:tk.map(function(k){ return {name:kt([k])[0],p:ts?tw[k]/ts:0}; })};
}

/* για ένα είδος: καλύτερες ώρες της εβδομάδας, συνθήκες που δουλεύουν, βάθη, σημεία */
function species(D,key,fc){
  var e=KB.filter(function(k){ return k.n===key; })[0]||null, o=D.by[key]||null, res=[];
  if(fc&&fc.days) fc.days.forEach(function(d){
    var hrs=d.hours.filter(function(q){ return q.safe&&(d.date>fc.nowLocal.slice(0,10)||q.t>=fc.nowLocal.slice(0,13)+':00'); }).map(function(q){
      var L=lscore(D,e,o,slot(d,q)); return {hr:q.hr,idx:clamp(Math.round(50+38*Math.tanh(0.9*L)),5,95)}; });
    if(!hrs.length) return; var best=Math.max.apply(null,hrs.map(function(q){ return q.idx; })), thr=best-6, g=[], cur=null;
    hrs.forEach(function(q){ if(q.idx>=thr){ if(cur&&cur.e===q.hr-1) cur.e=q.hr; else { cur={s:q.hr,e:q.hr}; g.push(cur); } } });
    res.push({date:d.date,best:best,win:g.sort(function(a,b){ return (b.e-b.s)-(a.e-a.s); })[0]});
  });
  res.sort(function(a,b){ return b.best-a.best; });
  var works=[];
  if(o&&o.n>=4&&D.H>=2){ var F=D.model.factors, r0=o.n/D.H;
    var LB={block:function(i){ return (EN?PP.LIGHT_EN:PP.LIGHT_EL)[i]; },moon:function(i){ return [T('νέα σελήνη','new moon'),T('α΄ τέταρτο','first quarter'),T('πανσέληνος','full moon'),T('δ΄ τέταρτο','last quarter')][i]; },ptrend:function(i){ return [T('πίεση που πέφτει απότομα','pressure falling fast'),T('πίεση που πέφτει αργά','pressure falling slowly'),T('σταθερή πίεση','steady pressure'),T('πίεση που ανεβαίνει','rising pressure')][i]; },wind:function(i){ return [T('ήπιος άνεμος','light wind'),T('μέτριος άνεμος','moderate wind'),T('δυνατός άνεμος','strong wind')][i]; }};
    var G={block:function(q){ return q.ph; },moon:function(q){ return q.moon; },ptrend:function(q){ return q.pt; },wind:function(q){ return q.w; }};
    Object.keys(G).forEach(function(k){ var best=null; F[k].forEach(function(fx,i){ var cnt=0; o.bites.forEach(function(q){ if(G[k](q)===i) cnt++; }); if(!fx.h||cnt<2) return; var m=((cnt+K*r0)/(fx.h+K))/r0; if(m>=1.25&&(!best||m>best.m)) best={i:i,m:m}; }); if(best) works.push(LB[k](best.i)); }); }
  var depth=null; if(o){ var dA=o.bites.map(function(q){ return q.depth!=null&&q.depth!==''?+q.depth:null; }).filter(function(v){ return v>0; }).sort(function(a,b){ return a-b; });
    if(dA.length>=3) depth={lo:dA[Math.floor((dA.length-1)*0.25)],hi:dA[Math.ceil((dA.length-1)*0.75)],md:dA[Math.floor((dA.length-1)/2)],n:dA.length}; }
  var cells={}; if(o) o.bites.forEach(function(q){ if(typeof q.lat!=='number'||typeof q.lon!=='number') return; var k=q.lat.toFixed(2)+','+q.lon.toFixed(2), z=cells[k]||(cells[k]={n:0,la:0,lo:0,kg:0}); z.n++; z.la+=q.lat; z.lo+=q.lon; z.kg+=q.kg; });
  var spots=Object.keys(cells).map(function(k){ var z=cells[k]; return {n:z.n,lat:z.la/z.n,lon:z.lo/z.n,kg:z.kg}; }).sort(function(a,b){ return b.n-a.n; }).slice(0,3);
  return {e:e,n:o?o.n:0,days:res.slice(0,4),works:works,depth:depth,spots:spots,warn:e&&e.warn?(EN?e.warn[1]:e.warn[0]):''};
}
function speciesList(D){ var m={}; KB.forEach(function(e){ m[e.n]={v:e.n,t:sName(e)}; }); Object.keys(D.by).forEach(function(k){ if(!m[k]) m[k]={v:k,t:D.by[k].name}; });
  return Object.keys(m).map(function(k){ var o=m[k]; o.n=D.by[k]?D.by[k].n:0; return o; }).sort(function(a,b){ return (b.n-a.n)||a.t.localeCompare(b.t,EN?'en':'el'); }); }

B.adv={collect:collect,suggest:suggest,species:species,speciesList:speciesList,slot:slot,model:model,calib:calib,vsMoon:vsMoon,trips:trips,act:act,utcMin:utcMin,PTS:PTS};
})();
