/* Υποκαρτέλα «Τι να ψαρέψω»: κατάταξη ειδών και τεχνικών για τις συνθήκες μιας ώρας, και «πότε και πού» για ένα είδος.
   Αρχίζει από γενική γνώση (knowledge.js) και περνά σταδιακά στα δικά σου ψάρια, όσο μαζεύονται. Τρέχει στη συσκευή, χωρίς AI υπηρεσία. */
(function(){
'use strict';
var C=window.AlkyonCore, PP=window.PP, KB=window.SPKB||[]; var root=document.getElementById('fcAdv'); if(!C||!PP||!root) return;
var h=C.h, $=C.$, pad=C.pad, EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var last={place:null,fc:null}, sel={day:0,hr:null}, spSel=C.lsGet('alkyon-advsp','');
var DAYS=EN?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'];
var MOON=[T('Νέα σελήνη','New moon'),T('Α΄ τέταρτο','First quarter'),T('Πανσέληνος','Full moon'),T('Δ΄ τέταρτο','Last quarter')];
var PTL={fast:T('πέφτει απότομα','falling fast'),slow:T('πέφτει αργά','falling slowly'),stable:T('σταθερή','steady'),rise:T('ανεβαίνει','rising')};
var PTS=['fast','slow','stable','rise'];
var K=4, NEED_A=8;
function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function windCls(w){ return w==null?null:w<8?0:w<=14?1:2; }
function bftOf(w){ return [1,4,7,11,17,22,28,34,41,48,56,64].filter(function(x){ return x<=w; }).length; }
KB.forEach(function(e){ e.a=e.a.concat([norm(e.n),norm(e.en)]); });
function kbOf(name,latin){ var s=norm(name+' '+(latin||'')); for(var i=0;i<KB.length;i++){ var e=KB[i]; for(var j=0;j<e.a.length;j++) if(s.indexOf(e.a[j])>=0) return e; } return null; }
function sName(e){ return EN&&e.en?e.en:e.n; }

/* ---------- δεδομένα ---------- */
function collect(){
  var bites=(C.Store.act?C.Store.act():C.Store.get('bites'))||[], trips=C.Store.get('trips')||[], utc=C.utcMin();
  var model=PP.build(trips,bites,{utcMin:utc,misses:(C.Store.misses?C.Store.misses():[])}), by={}, total=0;
  bites.forEach(function(b){
    if(!b.species) return; var e=kbOf(b.species,b.latin), key=e?e.n:norm(b.species).replace(/\s*\(.*$/,'');
    var o=by[key]||(by[key]={key:key,kb:e,name:e?e.n:String(b.species).replace(/\s*\(.*$/,''),n:0,bites:[]});
    var ms=PP.biteMs(b,utc); o.n++; total++;
    o.bites.push({depth:b.depth,b:b,ph:(ms!=null?PP.phaseAt(ms,b.lat,b.lon,utc):null),hr:b.time?+b.time.slice(0,2):null,moon:ms!=null?PP.moonOf(ms):null,month:b.date?+b.date.slice(5,7)-1:null,pt:PTS.indexOf(b.ptrend),w:windCls(b.wind),tide:b.tide||null,sst:b.sst,tech:b.tech||'',bait:b.bait||'',depth:b.depth,lat:b.lat,lon:b.lon,kg:+b.kg||0});
  });
  /* Δεδομένα φίλου: ξεχωριστά, χωρίς χρόνο προσπάθειας, μόνο ως εποχιακή ένδειξη. */
  var ext={}; try{ ((window.AlkyonExt&&window.AlkyonExt.use())||[]).forEach(function(r){ if(!r.sp) return; var e=kbOf(r.sp,''), key=e?e.n:norm(r.sp).replace(/\s*\(.*$/,''); var o=ext[key]||(ext[key]={n:0,m:[0,0,0,0,0,0,0,0,0,0,0,0]}); o.n++; if(r.month!=null) o.m[r.month]++; }); }catch(e){}
  return {model:model,by:by,ext:ext,total:total,H:model.H||0};
}
/* ---------- μοντέλο ---------- */
function lnTod(e,hr){ var w=e.tod[Math.floor(hr/3)]; return Math.log(0.4+1.2*w); }
function lnMonth(e,mo){ var w=e.m[mo]/3; return Math.log(0.4+1.2*w); }
function lnSst(e,sst){ if(sst==null) return 0; var lo=e.sst[0], hi=e.sst[1], d=sst<lo?lo-sst:sst>hi?sst-hi:0; var w=clamp(1-d/4,0,1); return Math.log(0.4+1.2*w); }
function lnWind(e,wc){ if(wc==null) return 0; return Math.log(0.4+1.2*e.w[wc]); }
function prior(e,x){ return lnTod(e,x.hr)+lnMonth(e,x.month)+lnSst(e,x.sst)+lnWind(e,x.wc); }
function dataL(D,o,x){
  if(!D.H||D.H<2||!o||o.n<2) return 0;
  var F=D.model.factors, r=o.n/D.H, L=0;
  function lv(k,i,get){ if(i==null||i<0||!F[k][i]) return; var c=0; o.bites.forEach(function(q){ if(get(q)===i) c++; }); var m=((c+K*r)/(F[k][i].h+K))/r; L+=Math.log(m); }
  lv('block',PP.phaseOf(x.hr*60+30,x.rise,x.set),function(q){ return q.ph; }); /* v31z365: φως, όχι ρολόι */
  lv('moon',x.moon,function(q){ return q.moon; });
  lv('ptrend',PTS.indexOf(x.pt),function(q){ return q.pt; });
  lv('wind',x.wc,function(q){ return q.w; });
  if(x.tide==='up'||x.tide==='down'){ /* στάθμη: σύγκριση ανεβαίνει/κατεβαίνει, αναμενόμενο 50/50 */
    var cu=0,cd=0; o.bites.forEach(function(q){ if(q.tide==='up') cu++; else if(q.tide==='down') cd++; });
    var n2=cu+cd; if(n2>=3){ var cc=x.tide==='up'?cu:cd; L+=Math.log(((cc+K*0.5)/(n2+K))/0.5); }
  }
  return clamp(L,-2,2);
}
function lscore(D,e,o,x){
  var n=o?o.n:0, a=D.H>=2?n/(n+NEED_A):0, Lp=e?prior(e,x):0, Ld=dataL(D,o,x);
  return (1-a)*Lp+a*Ld;
}
/* Εποχιακή ένδειξη από τα ψάρια του φίλου: ο μήνας και οι διπλανοί του, με ομαλοποίηση και μικρό βάρος (ελάχιστο 3 ψάρια). */
function extL(xo,mo){
  if(!xo||xo.n<3||mo==null) return 0;
  var m=xo.m, cm=m[mo]+0.5*(m[(mo+11)%12]+m[(mo+1)%12]), share=2/12, N=xo.n;
  var ratio=((cm/2+K*share/2)/(N+K))/(share/2);
  return clamp(Math.log(ratio),-1,1)*N/(N+NEED_A);
}
/* προφίλ ψαρέματος: ποια είδη της γενικής γνώσης έχουν νόημα (εκτίμηση, όχι επικυρωμένη). Τα δικά σου ψάρια μένουν πάντα. */
function profOf(){ try{ var v=localStorage.getItem('alkyon-fprof'); return v==='shore'||v==='lake'||v==='spear'?v:'boat'; }catch(e){ return 'boat'; } }
function kbFits(e,p){
  if(p==='boat') return true;
  if(p==='lake') return false;                                  /* η γενική γνώση είναι για θάλασσα */
  if(p==='spear') return e.d[0]<=25&&e.t.some(function(t){ return t!=='Τρόλινγκ'; });
  var land=e.t.some(function(t){ return t==='Βυθού'||t==='Spinning'||t==='Ζωντανό δόλωμα'||t==='Άλλο'; });
  return land&&e.d[0]<=30;                                      /* στεριά */
}
function candidates(D){
  var out=[], seen={}, P=profOf();
  KB.forEach(function(e){ seen[e.n]=1; if(!kbFits(e,P)) return; var o=D.by[e.n]; out.push({e:e,o:o,x:D.ext[e.n],name:e.n,common:e.c}); });
  Object.keys(D.by).forEach(function(k){ if(!seen[k]){ seen[k]=1; out.push({e:null,o:D.by[k],x:D.ext[k],name:D.by[k].name,common:1}); } });
  Object.keys(D.ext).forEach(function(k){ if(!seen[k]) out.push({e:null,o:null,x:D.ext[k],name:k,common:0.5}); });
  return out;
}
function rank(D,x){
  var cs=candidates(D), tot=0;
  cs.forEach(function(c){ var n=c.o?c.o.n:0, ne=c.x?c.x.n:0; c.L=lscore(D,c.e,c.o,x)+extL(c.x,x.month); c.s=(n+0.6*c.common+0.15*Math.min(ne,12))*Math.exp(clamp(c.L,-2,2)); tot+=c.s; });
  cs.forEach(function(c){ c.p=tot?c.s/tot:0; });
  return cs.sort(function(a,b){ return b.s-a.s; });
}
function techTally(c){
  var t={}, bt={};
  if(c.o&&c.o.n>=3) c.o.bites.forEach(function(q){ if(q.tech) t[q.tech]=(t[q.tech]||0)+1; if(q.bait) bt[q.bait]=(bt[q.bait]||0)+1; });
  return {t:t,b:bt};
}
function topKeys(m,k){ return Object.keys(m).sort(function(a,b){ return m[b]-m[a]; }).slice(0,k); }

/* ---------- συνθήκες επιλεγμένης ώρας ---------- */
function slotX(){
  var f=last.fc; if(!f||!f.days||!f.days.length) return null;
  var d=f.days[Math.min(sel.day,f.days.length-1)], hr=sel.hr;
  var hs=d.hours.filter(function(q){ return q.hr===hr; })[0]||d.hours[0]; if(!hs) return null;
  var wx=d.wx||{};
  return {d:d,h:hs,x:{rise:d.rise,set:d.set,hr:hs.hr,month:+d.date.slice(5,7)-1,moon:Math.floor(d.f*4+0.5)%4,mf:d.f,pt:hs.ptrend,wc:windCls(hs.wind),sst:wx.sst!=null?wx.sst:null,wind:hs.wind,wave:hs.wave,tide:hs.tide||null}};
}
function defaultHr(f){
  if(!f||!f.nowLocal) return 17; var n=+f.nowLocal.slice(11,13); return sel.day===0?Math.min(23,n+1):17;
}
function pickRow(f){
  var row=h('div',{class:'advpick'});
  var ds=h('select',{'aria-label':T('Ημέρα','Day')}); f.days.forEach(function(d,i){ var dt=new Date(d.date+'T12:00:00Z'); ds.append(h('option',{value:String(i),text:(i===0?T('Σήμερα','Today'):i===1?T('Αύριο','Tomorrow'):DAYS[dt.getUTCDay()])+' '+d.date.slice(8)+'/'+d.date.slice(5,7)})); });
  ds.value=String(sel.day);
  var hs=h('select',{'aria-label':T('Ώρα','Hour')}); for(var i=0;i<24;i++) hs.append(h('option',{value:String(i),text:pad(i)+':00'})); hs.value=String(sel.hr);
  ds.addEventListener('change',function(){ sel.day=+ds.value; render(); });
  hs.addEventListener('change',function(){ sel.hr=+hs.value; render(); });
  row.append(ds,hs); return row;
}
function condLine(S){
  var x=S.x, p=[];
  p.push(T('Άνεμος ','Wind ')+(x.wind!=null?bftOf(x.wind)+' Bft':'–'));
  if(x.wave!=null) p.push(T('κύμα ','wave ')+x.wave.toFixed(1)+' m');
  p.push(T('πίεση ','pressure ')+(PTL[x.pt]||'–'));
  if(x.sst!=null) p.push(T('θάλασσα ','sea ')+Math.round(x.sst)+'°C');
  /* v31z370: η ετικέτα από την ακριβή φάση (8 φάσεις + φωτισμός), όχι από την ομάδα των 4 που χρησιμοποιεί η στατιστική */
  if(x.mf!=null){ var PH8=[T('Νέα σελήνη','New moon'),T('Αύξουσα μηνίσκος','Waxing crescent'),T('Α΄ τέταρτο','First quarter'),T('Αύξουσα κυρτή','Waxing gibbous'),T('Πανσέληνος','Full moon'),T('Φθίνουσα κυρτή','Waning gibbous'),T('Δ΄ τέταρτο','Last quarter'),T('Φθίνουσα μηνίσκος','Waning crescent')];
    p.push(T('σελήνη ','moon ')+PH8[Math.floor(x.mf*8+0.5)%8].toLowerCase()+' '+Math.round((1-Math.cos(2*Math.PI*x.mf))/2*100)+'%'); }
  else p.push(MOON[x.moon]);
  return p.join(' · ');
}
var KTR={'Βυθού':'Bottom fishing','Ζωντανό δόλωμα':'Live bait','Τρόλινγκ':'Trolling','Άλλο':'Other','γαρίδα':'shrimp','ζωντανή γαρίδα':'live shrimp','ζωντανή σαρδέλα':'live sardine','ζωντανό καλαμάρι':'live squid','ζωντανό σκαθάρι':'live beetle','ζωντανό ψαράκι':'live small fish','κάβουρας':'crab','καλαμάρι':'squid','καλαμαριέρα':'squid jig','καλαμαριέρα (ζαλάκι)':'squid jig (zalaki)','κολιός':'chub mackerel','μικρό ψάρι':'small fish','μπουκιά':'chum ball','μύδι':'mussel','πάστα':'paste','πράσινα φύκια':'green algae','σαμπίκι':'sabiki','σαρδέλα':'sardine','σκουλήκι':'worm','σουπιά':'cuttlefish','τεχνητό':'artificial lure','ψωμί':'bread'};
function kt(a){ return EN?a.map(function(x){ return KTR[x]||x; }):a; }
function confText(c){ var n=c.o?c.o.n:0, ne=c.x?c.x.n:0; var t=n===0?T('γενική γνώση','general knowledge'):n<8?T('αρχικά δεδομένα · ','early data · ')+n+T(' ψάρια',' fish'):T('από τα ψάρια σου · ','from your fish · ')+n; if(ne) t+=' · '+T('φίλος: ','friend: ')+ne+T(' ψάρια',' fish'); return t; }

/* ---------- κάρτα 1: τι να ψαρέψω ---------- */
function whatCard(D){
  var c=h('div',{class:'card'}); c.append(h('h3',{text:T('Τι να ψαρέψω','What to fish for')}));
  var f=last.fc, pl=last.place;
  if(!f||!pl||!f.days||!f.days.length){ c.append(h('p',{class:'note',text:T('Διάλεξε τοποθεσία στη «Γενική πρόγνωση» και περίμενε να φορτώσει η πρόγνωση.','Pick a location in "General forecast" and wait for the forecast to load.')})); return c; }
  if(sel.hr==null) sel.hr=defaultHr(f);
  c.append(h('p',{class:'note',style:'margin:0 0 8px',text:pl.name}));
  c.append(pickRow(f));
  var S=slotX(); if(!S) return c;
  c.append(h('p',{class:'note',style:'margin:8px 0',text:condLine(S)}));
  var R=rank(D,S.x), top=R.slice(0,6), mx=top[0]?top[0].p:1;
  var P=profOf(), PN={shore:T('Από στεριά','From shore'),lake:T('Λίμνη / φράγμα','Lake / dam'),spear:T('Ψαροντούφεκο','Spearfishing')};
  if(P!=='boat') c.append(h('p',{class:'note',style:'margin:4px 0',text:T('Προφίλ: ','Profile: ')+PN[P]+T('. Οι προτάσεις προσαρμόζονται σε αυτό.','. The suggestions are adapted to it.')+(P==='lake'?T(' Δεν υπάρχουν ακόμα είδη γλυκού νερού στη γενική γνώση· φαίνονται μόνο τα δικά σου ψάρια.',' There are no freshwater species in the general knowledge yet; only your own catches show.'):'')}));
  if(!top.length){ c.append(h('p',{class:'note',text:T('Δεν υπάρχουν ακόμα προτάσεις για αυτό το προφίλ. Καταγράφοντας ψάρια θα εμφανιστούν.','No suggestions for this profile yet. They will appear as you log catches.')})); return c; }
  c.append(h('div',{class:'label',style:'margin-top:6px',text:T('Πιο πιθανά είδη','Most likely species')}));
  top.forEach(function(r,i){
    var e=r.e, tl=techTally(r), tq=topKeys(tl.t,2), bq=topKeys(tl.b,2);
    var tech=tq.length?tq:(e?e.t.slice(0,2):[]), bait=bq.length?bq:(e?e.b.slice(0,2):[]);
    var depth=r.o&&r.o.bites.filter(function(q){ return q.depth!=null; }).length>=3?(function(){ var v=r.o.bites.filter(function(q){ return q.depth!=null; }).map(function(q){ return +q.depth; }); return Math.round(v.reduce(function(a,b){return a+b;},0)/v.length)+' m'; })():(e?e.d[0]+'–'+e.d[1]+' m':'');
    var box=h('div',{class:'advsp'},
      h('div',{class:'bar'},h('span',{text:(e?sName(e):r.name)}),h('div',{class:'t'},h('i',{style:'width:'+Math.round(r.p/mx*100)+'%'})),h('span',{class:'n',text:Math.round(r.p*100)+'%'})),
      h('div',{class:'meta advmeta',text:[tech.length?T('Τεχνική: ','Technique: ')+kt(tech).join(', '):null,bait.length?T('Δόλωμα: ','Bait: ')+kt(bait).join(', '):null,depth?T('Βάθος: ','Depth: ')+depth:null].filter(Boolean).join(' · ')}),
      h('div',{class:'meta advmeta',text:confText(r)+(e&&e.warn?' · ⚠ '+(EN?e.warn[1]:e.warn[0]):'')}));
    c.append(box);
  });
  /* προτεινόμενη τεχνική (σταθμισμένη) */
  var tw={};
  R.slice(0,8).forEach(function(r){ var tl=techTally(r), n=r.o?r.o.n:0, a=D.H>=2?n/(n+NEED_A):0, e=r.e;
    var sum=0; Object.keys(tl.t).forEach(function(k){ sum+=tl.t[k]; });
    Object.keys(tl.t).forEach(function(k){ tw[k]=(tw[k]||0)+r.p*a*tl.t[k]/sum; });
    if(e) e.t.forEach(function(k,i){ tw[k]=(tw[k]||0)+r.p*(1-a)*[.5,.3,.2][i]; }); });
  var tk=Object.keys(tw).sort(function(a,b){ return tw[b]-tw[a]; }).slice(0,3), ts=0; tk.forEach(function(k){ ts+=tw[k]; });
  if(tk.length){
    c.append(h('div',{class:'label',style:'margin-top:12px',text:T('Προτεινόμενη τεχνική','Suggested technique')}));
    tk.forEach(function(k){ c.append(h('div',{class:'bar'},h('span',{text:k}),h('div',{class:'t'},h('i',{style:'width:'+Math.round(tw[k]/tw[tk[0]]*100)+'%'})),h('span',{class:'n',text:Math.round(tw[k]/ts*100)+'%'}))); });
  }
  c.append(h('p',{class:'note',style:'margin:10px 0 0',text:T('Ενδεικτικό. Τα ποσοστά δείχνουν σχετική πιθανότητα ανάμεσα στα είδη της λίστας, όχι σίγουρο αποτέλεσμα.','Indicative. Percentages are relative likelihoods among the listed species, not a guarantee.')}));
  return c;
}

/* ---------- κάρτα 2: πότε και πού για ένα είδος ---------- */
function speciesOptions(D){
  var m={}; KB.forEach(function(e){ m[e.n]={v:e.n,t:sName(e)}; }); Object.keys(D.by).forEach(function(k){ if(!m[k]) m[k]={v:k,t:D.by[k].name}; });
  return Object.keys(m).map(function(k){ return m[k]; }).sort(function(a,b){ return a.t.localeCompare(b.t,EN?'en':'el'); });
}
function winTxt(w){ return pad(w.s)+':00–'+pad((w.e+1)%24)+':00'; }
function whenWhere(D){
  var c=h('div',{class:'card'}); c.append(h('h3',{text:T('Πότε και πού για ένα είδος','When and where for a species')}));
  var opts=speciesOptions(D), s=h('select',{'aria-label':T('Είδος','Species')},h('option',{value:'',text:T('— διάλεξε είδος —','— choose a species —')}));
  opts.forEach(function(o){ s.append(h('option',{value:o.v,text:o.t+(D.by[o.v]?' ('+D.by[o.v].n+')':'')})); });
  s.value=spSel; s.addEventListener('change',function(){ spSel=s.value; C.lsSet('alkyon-advsp',spSel); render(); try{ window.dispatchEvent(new Event('alkyon-advsp')); }catch(e){} });
  c.append(s);
  if(!spSel) { c.append(h('p',{class:'note',text:T('Διάλεξε είδος για να δεις τις καλύτερες μέρες και ώρες της εβδομάδας και τα σημεία όπου το έπιασες.','Choose a species to see the best days and hours this week and where you caught it.')})); return c; }
  var e=KB.filter(function(k){ return k.n===spSel; })[0]||null, o=D.by[spSel]||null, f=last.fc;
  c.append(h('p',{class:'note',style:'margin:8px 0 0',text:confText({o:o})+(e&&e.warn?' · ⚠ '+(EN?e.warn[1]:e.warn[0]):'')}));
  /* καλύτερες ώρες */
  if(!f||!f.days||!f.days.length){ c.append(h('p',{class:'note',text:T('Η πρόγνωση δεν έχει φορτώσει ακόμη.','The forecast has not loaded yet.')})); }
  else {
    var res=[];
    f.days.forEach(function(d){
      var wx=d.wx||{}, base={month:+d.date.slice(5,7)-1,moon:Math.floor(d.f*4+0.5)%4,sst:wx.sst!=null?wx.sst:null};
      var hrs=d.hours.filter(function(q){ return q.safe&&(d.date>f.nowLocal.slice(0,10)||q.t>=f.nowLocal.slice(0,13)+':00'); }).map(function(q){
        var x={rise:d.rise,set:d.set,hr:q.hr,month:base.month,moon:base.moon,sst:base.sst,pt:q.ptrend,wc:windCls(q.wind)}; var L=lscore(D,e,o,x); return {hr:q.hr,L:L,idx:clamp(Math.round(50+38*Math.tanh(0.9*L)),5,95)}; });
      if(!hrs.length) return; var best=Math.max.apply(null,hrs.map(function(q){ return q.idx; })), thr=best-6, g=[],cur=null;
      hrs.forEach(function(q){ if(q.idx>=thr){ if(cur&&cur.e===q.hr-1) cur.e=q.hr; else { cur={s:q.hr,e:q.hr}; g.push(cur); } } });
      var win=g.sort(function(a,b){ return (b.e-b.s)-(a.e-a.s); })[0]; res.push({d:d,best:best,win:win});
    });
    res.sort(function(a,b){ return b.best-a.best; });
    c.append(h('div',{class:'label',style:'margin-top:12px',text:T('Καλύτερες ώρες αυτή την εβδομάδα','Best times this week')}));
    if(!res.length) c.append(h('p',{class:'note',text:T('Δεν υπάρχουν ασφαλείς ώρες στην πρόγνωση.','No safe hours in the forecast.')}));
    res.slice(0,4).forEach(function(r){ var dt=new Date(r.d.date+'T12:00:00Z');
      c.append(h('div',{class:'bar'},h('span',{text:DAYS[dt.getUTCDay()]+' '+r.d.date.slice(8)+'/'+r.d.date.slice(5,7)}),h('div',{class:'t'},h('i',{style:'width:'+r.best+'%'})),h('span',{class:'n',text:winTxt(r.win)+' · '+r.best}))); });
  }
  /* συνθήκες που δουλεύουν */
  if(o&&o.n>=4&&D.H>=2){
    var F=D.model.factors, r0=o.n/D.H, lines=[];
    var LB={block:function(i){ return (EN?PP.LIGHT_EN:PP.LIGHT_EL)[i]; },moon:function(i){ return MOON[i]; },ptrend:function(i){ return PTL[PTS[i]]; },wind:function(i){ return [T('ήπιος άνεμος','light wind'),T('μέτριος άνεμος','moderate wind'),T('δυνατός άνεμος','strong wind')][i]; }};
    var G={block:function(q){ return q.ph; },moon:function(q){ return q.moon; },ptrend:function(q){ return q.pt; },wind:function(q){ return q.w; }};
    Object.keys(G).forEach(function(k){ var best=null; F[k].forEach(function(fx,i){ var cnt=0; o.bites.forEach(function(q){ if(G[k](q)===i) cnt++; }); if(!fx.h||cnt<2) return; var m=((cnt+K*r0)/(fx.h+K))/r0; if(m>=1.25&&(!best||m>best.m)) best={i:i,m:m}; }); if(best) lines.push(LB[k](best.i)); });
    if(lines.length){ c.append(h('div',{class:'label',style:'margin-top:12px',text:T('Οι συνθήκες που σου δουλεύουν','Conditions that work for you')})); c.append(h('p',{style:'margin:4px 0 0',text:lines.join(' · ')})); }
  }
  /* v31z366: βάθη όπου το πιάνεις (όλη τη χρονιά και αυτή την εποχή, ±1 μήνας). Βάθη από βυθόμετρο ή από τον χάρτη EMODnet. */
  if(o){ var mo=+C.nicosiaToday().slice(5,7)-1, dAll=[], dSea=[]; o.bites.forEach(function(q){ var dv=q.depth!=null&&q.depth!==''?+q.depth:null; if(dv==null||!(dv>0)) return; dAll.push(dv); if(q.month!=null&&Math.min((q.month-mo+12)%12,(mo-q.month+12)%12)<=1) dSea.push(dv); });
    var rng=function(a){ a=a.slice().sort(function(x,y){ return x-y; }); var q1=a[Math.floor((a.length-1)*0.25)], q3=a[Math.ceil((a.length-1)*0.75)], md=a[Math.floor((a.length-1)/2)]; return q1+'–'+q3+' m ('+T('συνήθως ','typically ')+md+' m, '+a.length+T(' ψάρια',' fish')+')'; };
    if(dAll.length>=3){ c.append(h('div',{class:'label',style:'margin-top:12px',text:T('Βάθη όπου το πιάνεις','Depths where you catch it')}));
      c.append(h('p',{style:'margin:4px 0 0',text:T('Όλη τη χρονιά: ','All year: ')+rng(dAll)+(dSea.length>=3?' · '+T('Αυτή την εποχή: ','This season: ')+rng(dSea):'')}));
      c.append(h('p',{class:'note',style:'margin:2px 0 0',text:T('Από βυθόμετρο ή από τον χάρτη βαθών EMODnet (ενδεικτικό κοντά στην ακτή).','From your sounder or the EMODnet depth chart (indicative near the coast).')})); } }
  /* σημεία */
  var cells={};
  if(o) o.bites.forEach(function(q){ if(typeof q.lat!=='number'||typeof q.lon!=='number') return; var k=q.lat.toFixed(2)+','+q.lon.toFixed(2), z=cells[k]||(cells[k]={n:0,la:0,lo:0,kg:0}); z.n++; z.la+=q.lat; z.lo+=q.lon; z.kg+=q.kg; });
  var cl=Object.keys(cells).map(function(k){ var z=cells[k]; return {n:z.n,lat:z.la/z.n,lon:z.lo/z.n,kg:z.kg}; }).sort(function(a,b){ return b.n-a.n; }).slice(0,3);
  c.append(h('div',{class:'label',style:'margin-top:12px',text:T('Τα σημεία σου','Your spots')}));
  if(!cl.length) c.append(h('p',{class:'note',text:T('Δεν έχεις ακόμα ψάρι αυτού του είδους με θέση. Μόλις προστεθεί, θα φανούν εδώ.','No catches of this species with a position yet. They will show here once added.')}));
  cl.forEach(function(z){
    var go=h('button',{class:'btn ghost sm',type:'button',text:T('Χάρτης','Map'),onclick:function(){ C.switchTab('map'); setTimeout(function(){ var m=C.map(); if(m) m.flyTo([z.lat,z.lon],14); },350); }});
    var dir=window.AlkyonDirect?h('button',{class:'btn ghost sm',type:'button',text:T('Πηγαίνω εκεί','Go there'),onclick:function(){ C.switchTab('map'); setTimeout(function(){ window.AlkyonDirect.go(z.lat,z.lon,(e?sName(e):spSel)); var m=C.map(); if(m) m.flyTo([z.lat,z.lon],13); },350); }}):null;
    c.append(h('div',{class:'item advspot'},h('div',{},h('b',{text:z.n+' '+T('ψάρια','fish')+(z.kg?' · '+Math.round(z.kg*10)/10+' kg':'')}),h('div',{class:'meta mono',text:AlkyonCoord.fmt(z.lat,z.lon)}),(window.AlkyonRest?window.AlkyonRest.node(z.lat,z.lon):null)),h('div',{class:'acts'},go,dir)));
  });
  return c;
}
function statusCard(D){
  var c=h('div',{class:'card'}), n=D.total;
  c.append(h('h3',{text:T('Πώς μαθαίνει','How it learns')}));
  c.append(h('p',{class:'note',style:'margin:0',text:n<10?T('Έχεις ',"You have ")+n+T(' ψάρια. Μέχρι να μαζευτούν περισσότερα, οι προτάσεις βασίζονται κυρίως σε γενική γνώση για τα είδη. Κάθε ψάρι που καταγράφεις με συνθήκες τις κάνει πιο προσωπικές.',' fish. Until more are logged, suggestions rely mainly on general species knowledge. Each fish you log with its conditions makes them more personal.'):T('Έχεις ',"You have ")+n+T(' ψάρια και '+Math.round(D.H)+' ώρες ψαρέματος. Οι προτάσεις ζυγίζουν όλο και περισσότερο τα δικά σου δεδομένα, ανά είδος.',' fish and '+Math.round(D.H)+' fishing hours. Suggestions weigh your own data more and more, per species.')}));
  c.append(h('p',{class:'note',style:'margin:8px 0 0',text:T('Τρέχει εξ ολοκλήρου στη συσκευή σου. Δεν στέλνει δεδομένα πουθενά και δεν είναι εγγύηση ότι θα τσιμπήσουν ψάρια.','Runs entirely on your device. It does not send data anywhere and is no guarantee that fish will bite.')}));
  return c;
}
function render(){
  root.replaceChildren(); var D=collect();
  root.append(whatCard(D),whenWhere(D),statusCard(D)); try{ if(window.AlkyonExt) root.append(window.AlkyonExt.card(render)); }catch(e){}
}
window.AlkyonAdv={render:function(){ if(!root.hidden) render(); }};
window.addEventListener('alkyon-fcloaded',function(e){ last=e.detail||last; if(!root.hidden&&!document.activeElement.closest('#fcAdv')) render(); });
['trips','bites'].forEach(function(k){ C.Store.on(k,function(){ if(!root.hidden&&!document.activeElement.closest('#fcAdv')) render(); }); });
})();
