/* Alkyon 4 · Ορατότητα νερού για ψαροντούφεκο (v31z531)
   1) Δορυφόρος: συνάρτηση Supabase «water-clarity» → Kd490 (Copernicus Marine, Μεσόγειος). Ορατότητα ≈ 1,5 / Kd490 (περίπου το βάθος Secchi).
      Όταν έχει σύννεφα (καμία τιμή) ή η τιμή είναι παλιά (> 2 ημέρες) ή η συνάρτηση δεν απαντά → πέφτει στο 2.
   2) Εκτίμηση από συνθήκες: κύμα τελευταίων 36 ωρών και βροχή τελευταίων 48 ωρών από την πρόγνωση,
      με διόρθωση από ό,τι έχεις γράψει εσύ κοντά (≥ 2 καταγραφές σε 3 km). Ενδεικτικό: όχι μέτρηση. */
(function(){
var B=window.AK, T=B.T, EN=B.EN, ls=B.ls, h=B.h;
var SUPA='https://sgfohmqwdwtkhtrebnix.supabase.co', SKEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA', BASE=20, CK='alkyon-v4-clar';
function lerp(tab,x){ if(x<=tab[0][0]) return tab[0][1]; for(var i=1;i<tab.length;i++){ if(x<=tab[i][0]){ var a=tab[i-1], b=tab[i], t=(x-a[0])/(b[0]-a[0]); return a[1]+(b[1]-a[1])*t; } } return tab[tab.length-1][1]; }
var WAVE=[[0.3,1],[0.6,0.85],[1.0,0.62],[1.5,0.45],[2.5,0.3],[4,0.2]], RAIN=[[2,1],[8,0.85],[20,0.65],[40,0.5],[80,0.4]];
function km(a,b,c,d){ var r=Math.PI/180, x=(d-b)*r*Math.cos((a+c)/2*r), y=(c-a)*r; return Math.sqrt(x*x+y*y)*6371; }
function level(m){ return m>=15?['ok',T('πολύ καλή','very good')]:m>=10?['ok',T('καλή','good')]:m>=6?['warn',T('μέτρια','fair')]:['bad',T('κακή','poor')]; }
/* ωριαία σειρά: fc.wl (2 προηγούμενες μέρες + πρόγνωση), αλλιώς οι ώρες των ημερών */
function series(fc){ var out=[];
  if(fc&&fc.wl&&fc.wl.length) fc.wl.forEach(function(x){ var t=Date.parse(x[0]+'Z'); if(!isNaN(t)) out.push({t:t,wave:x[1],mm:x[2]}); });
  else (fc&&fc.days||[]).forEach(function(d){ (d.hours||[]).forEach(function(x){ var t=Date.parse(x.t+'Z'); if(!isNaN(t)) out.push({t:t,wave:x.wave,mm:x.mm}); }); });
  return out.sort(function(a,b){ return a.t-b.t; }); }
/* διόρθωση από τις δικές σου καταγραφές (ορατότητα που έγραψες / εκτίμηση εκείνη τη στιγμή) */
function calib(lat,lon){ if(lat==null) return 1; var bs=[]; try{ bs=B.store.raw('bites').filter(function(b){ return !b.deleted&&+b.vis>0&&+b.visEst>0&&b.lat!=null&&km(lat,lon,b.lat,b.lon)<=3; }); }catch(e){}
  if(bs.length<2) return 1; var r=bs.slice(-12).map(function(b){ return Math.log(+b.vis/+b.visEst); }), m=r.reduce(function(a,c){ return a+c; },0)/r.length; return Math.max(0.5,Math.min(1.6,Math.exp(m))); }
/* εκτίμηση για συγκεκριμένη μέρα (ώρα 10:00 τοπικά) */
function estimate(fc,date,lat,lon,hr){ var S=series(fc); if(!S.length) return null; var tgt=Date.parse(date+'T'+B.pad(hr==null?10:hr)+':00Z');
  var w36=0, w12=0, rain=0, n=0; S.forEach(function(x){ var dt=(tgt-x.t)/3600000; if(dt<0||dt>48) return; n++; if(x.mm>0) rain+=x.mm; if(dt<=36&&x.wave!=null){ if(x.wave>w36) w36=x.wave; if(dt<=12&&x.wave>w12) w12=x.wave; } });
  if(!n) return null; var we=Math.max(w12,0.7*w36), fw=lerp(WAVE,we), fr=lerp(RAIN,rain), cal=calib(lat,lon), m=BASE*fw*fr*cal, why=[];
  if(we>=0.6) why.push(T('κύμα ','waves ')+B.num(w36,1)+T(' m τις τελευταίες ώρες',' m in the last hours')); else why.push(T('ήρεμη θάλασσα','calm sea'));
  if(rain>=8) why.push(T('βροχή ','rain ')+Math.round(rain)+T(' mm σε 2 μέρες',' mm in 2 days'));
  if(cal!==1) why.push(T('προσαρμοσμένο από τις καταγραφές σου','adjusted from your own logs'));
  var lv=level(m); return {m:Math.round(m),lv:lv[0],label:lv[1],why:why,src:'model'}; }
/* δορυφόρος (με μνήμη 6 ωρών ανά ~1 km) */
function sat(lat,lon){ var key=lat.toFixed(2)+','+lon.toFixed(2), c=ls.get(CK,{})||{}, hit=c[key];
  if(hit&&Date.now()-hit.at<(hit.v&&hit.v.err&&hit.v.err!=='cloud'?3600000:6*3600000)) return Promise.resolve(hit.v);
  var ac=window.AbortController?new AbortController():null, tm=setTimeout(function(){ if(ac) ac.abort(); },15000);
  return fetch(SUPA+'/functions/v1/water-clarity?lat='+lat.toFixed(4)+'&lon='+lon.toFixed(4),{headers:{apikey:SKEY,Authorization:'Bearer '+SKEY},signal:ac?ac.signal:undefined})
    .then(function(r){ clearTimeout(tm); if(r.status===404) return {err:'nofn'}; return r.json().catch(function(){ return {err:'HTTP '+r.status}; }); })
    .catch(function(e){ clearTimeout(tm); return {err:(e&&e.name==='AbortError')?'timeout':'net'}; })
    .then(function(v){ v=v||{err:'?'}; c=ls.get(CK,{})||{}; var ks=Object.keys(c); if(ks.length>40) ks.slice(0,ks.length-40).forEach(function(k){ delete c[k]; }); c[key]={at:Date.now(),v:v}; ls.set(CK,c); return v; }); }
function fromSat(v,date){ if(!v||v.err||!(+v.zsd>0||+v.kd490>0)) return null; var age=v.date?Math.round((Date.parse(date)-Date.parse(v.date.slice(0,10)))/86400000):99; if(age>2||age<-1) return null;
  var m=Math.max(1,Math.min(35,+v.zsd>0?+v.zsd:1.5/(+v.kd490))), lv=level(m); return {m:Math.round(m),lv:lv[0],label:lv[1],why:[T('δορυφόρος ','satellite ')+new Date(v.date).toLocaleDateString(EN?'en-GB':'el-GR',{day:'numeric',month:'short'})+(v.filled?T(' · συμπληρωμένος χάρτης (L4)',' · gap-filled map (L4)'):(v.n?' · '+v.n+T(' σημεία',' points'):''))],src:'sat'}; }
function why(v){ if(!v) return ''; if(v.err==='nofn') return T('δορυφόρος: δεν έχει ρυθμιστεί','satellite: not set up'); if(v.err==='cloud'||v.err==='nodata') return T('δορυφόρος: σύννεφα, χωρίς τιμή','satellite: clouds, no value');
  if(v.err==='area') return T('δορυφόρος: μόνο για Μεσόγειο','satellite: Mediterranean only');
  if(v.err) return T('δορυφόρος: μη διαθέσιμος τώρα','satellite: unavailable now'); if(v.date) return T('δορυφόρος: τελευταία τιμή ','satellite: last value ')+v.date.slice(0,10); return ''; }
/* κάρτα για την Πρόγνωση (ψαροντούφεκο): πρώτα η εκτίμηση αμέσως, μετά ο δορυφόρος αν έχει πρόσφατη τιμή για σήμερα/αύριο */
B.clarityCard=function(fc,d,p,isToday,hr){ var est=estimate(fc,d.date,p&&p.lat,p&&p.lon,hr!=null?Math.max(hr,8):null), box=h('section',{class:'card clar','aria-label':T('Ορατότητα νερού','Water visibility')});
  function paint(r,note){ box.replaceChildren(); if(!r){ box.hidden=true; return; } box.hidden=false;
    box.append(h('div',{class:'clh'},h('span',{class:'cli',html:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>'}),h('span',{class:'clt'},h('small',{text:T('Ορατότητα νερού','Water visibility')}),h('b',null,'~'+r.m+' m ',h('em',{class:'cll '+r.lv,text:r.label}))),
      h('span',{class:'clsrc '+r.src,text:r.src==='sat'?T('δορυφόρος','satellite'):T('εκτίμηση','estimate')})),
      h('small',{class:'clw',text:r.why.join(' · ')}),note?h('small',{class:'cln',text:note}):null); }
  paint(est,null);
  var dd=Math.round((Date.parse(d.date)-Date.parse(new Date().toISOString().slice(0,10)))/86400000);
  if(dd===0&&est&&B.dayNote) B.dayNote(p,{vis:est.m,vs:'model'});   /* 1.2.5: ιστορικό */
  if(p&&p.lat!=null&&dd>=0&&dd<=1) sat(+p.lat,+p.lon).then(function(v){ var s=fromSat(v,new Date().toISOString().slice(0,10)); if(s){ paint(s,est?T('Από τις συνθήκες: ~','From conditions: ~')+est.m+' m':null); if(dd===0&&B.dayNote) B.dayNote(p,{vis:s.m,vs:'sat'}); } else paint(est,why(v)); });
  return box; };
/* για καταγραφή: η εκτίμηση εκείνης της στιγμής (για να μαθαίνει από ό,τι γράφεις) */
B.clarityEst=function(lat,lon,date,time){ var c=ls.get('alkyon-fc7',null), fc=c&&c.fc; if(!fc) return null; var r=estimate(fc,date,lat,lon,parseInt((time||'10').slice(0,2),10)); return r?r.m:null; };
B.clarity={estimate:estimate,sat:sat,fromSat:fromSat,level:level};
/* v31z545: θερμοκρασία σε βάθος / θερμοκλινές (ίδια συνάρτηση Supabase, mode=profile, μοντέλο Copernicus Μεσογείου). Αν η συνάρτηση δεν απαντά, η κάρτα δεν εμφανίζεται. */
function prof(lat,lon){ var key='p'+lat.toFixed(2)+','+lon.toFixed(2), c=ls.get(CK,{})||{}, hit=c[key];
  if(hit&&Date.now()-hit.at<6*3600000) return Promise.resolve(hit.v);
  return fetch(SUPA+'/functions/v1/water-clarity?mode=profile&lat='+lat.toFixed(4)+'&lon='+lon.toFixed(4),{headers:{apikey:SKEY,Authorization:'Bearer '+SKEY}}).then(function(r){ return r.ok?r.json():{err:'HTTP '+r.status}; }).catch(function(){ return {err:'net'}; })
    .then(function(v){ if(v&&v.prof){ c=ls.get(CK,{})||{}; c[key]={at:Date.now(),v:v}; ls.set(CK,c); } return v; }); }
function thermo(P){ if(!P||P.length<3) return null; var best=null;
  for(var i=0;i<P.length-1;i++){ var g=(P[i].t-P[i+1].t)/Math.max(0.5,P[i+1].d-P[i].d); if(!best||g>best.g) best={g:g,i:i}; }
  if(!best||best.g<0.05||P[0].t-P[P.length-1].t<1) return null;
  var a=best.i, b=best.i+1; while(a>0&&(P[a-1].t-P[a].t)/Math.max(0.5,P[a].d-P[a-1].d)>=best.g*0.5) a--; while(b<P.length-1&&(P[b].t-P[b+1].t)/Math.max(0.5,P[b+1].d-P[b].d)>=best.g*0.5) b++;
  return {top:P[a].d,bot:P[b].d,t1:P[a].t,t2:P[b].t}; }
B.thermoCard=function(p){ if(!p||p.lat==null) return null; var box=h('section',{class:'card thermo',hidden:true});
  prof(+p.lat,+p.lon).then(function(v){ if(!v||!v.prof||v.prof.length<3) return; var P=v.prof.filter(function(x){ return x.d<=110; }), th=thermo(P), U=window.AlkyonUnits, f=function(t){ return U&&U.temp?U.temp(t,1):B.num(t,1)+'°'; };
    var lo=Math.min.apply(null,P.map(function(x){ return x.t; })), hi=Math.max.apply(null,P.map(function(x){ return x.t; }));
    var rows=h('div',{class:'thrs'}); P.forEach(function(x){ var inT=th&&x.d>=th.top&&x.d<=th.bot; rows.append(h('div',{class:'thr'+(inT?' thx':'')},h('span',{text:Math.round(x.d)+' m'}),h('i',null,h('b',{style:{width:Math.round(25+75*(x.t-lo)/Math.max(0.1,hi-lo))+'%'}})),h('em',{text:f(x.t)}))); });
    box.replaceChildren(h('h2',{text:T('Θερμοκρασία σε βάθος','Temperature at depth')}),
      h('p',{class:'thsum',text:th?T('Θερμοκλινές ~','Thermocline ~')+Math.round(th.top)+'–'+Math.round(th.bot)+' m: '+f(th.t1)+' → '+f(th.t2)+'.':T('Χωρίς έντονο θερμοκλινές ως τα ','No strong thermocline down to ')+Math.round(P[P.length-1].d)+' m ('+f(P[0].t)+' → '+f(P[P.length-1].t)+').'}),
      rows,h('p',{class:'foot',text:(th?T('Πολλά ψάρια κρατιούνται συχνά λίγο πάνω ή μέσα στο θερμοκλινές: δοκίμασε το jig ή το δόλωμα σε αυτό το βάθος. ','Fish often hold just above or within the thermocline: try your jig or bait at that depth. '):'')+T('Μοντέλο Copernicus Μεσογείου (ημερήσιος μέσος), όχι μέτρηση.','Copernicus Mediterranean model (daily mean), not a measurement.')}));
    if(B.dayNote) B.dayNote(p,{t0:P[0].t,tc:th?[Math.round(th.top),Math.round(th.bot),Math.round(th.t1*10)/10,Math.round(th.t2*10)/10]:null});   /* 1.2.5: ιστορικό */
    box.hidden=false; }); return box; };

/* 1.1.0: ρεύματα (ίδια συνάρτηση Supabase, mode=current, μοντέλο Copernicus Μεσογείου): τώρα, επόμενες 24 ώρες, και σε βάθος.
   Η κατεύθυνση είναι ΠΡΟΣ τα πού πάει το νερό. Αν η συνάρτηση δεν απαντά (π.χ. δεν έχει ενημερωθεί), η κάρτα δεν εμφανίζεται. */
function curGet(lat,lon){ var key='c'+lat.toFixed(2)+','+lon.toFixed(2), c=ls.get(CK,{})||{}, hit=c[key];
  if(hit&&Date.now()-hit.at<2*3600000) return Promise.resolve(hit.v);
  return fetch(SUPA+'/functions/v1/water-clarity?mode=current&lat='+lat.toFixed(4)+'&lon='+lon.toFixed(4),{headers:{apikey:SKEY,Authorization:'Bearer '+SKEY}}).then(function(r){ return r.ok?r.json():{err:'HTTP '+r.status}; }).catch(function(){ return {err:'net'}; })
    .then(function(v){ if(v&&v.now){ c=ls.get(CK,{})||{}; c[key]={at:Date.now(),v:v}; ls.set(CK,c); } return v; }); }
var DIRS_EL=['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'], DIRS_EN=['N','NE','E','SE','S','SW','W','NW'];
function dname(d){ return (EN?DIRS_EN:DIRS_EL)[Math.round(((d%360)+360)%360/45)%8]; }
function arrow(d,sz){ var s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('width',sz||18); s.setAttribute('height',sz||18); s.setAttribute('class','curar'); s.style.transform='rotate('+d+'deg)';
  s.innerHTML='<path d="M12 3l6 9h-4v9h-4v-9H6z" fill="currentColor"/>'; return s; }
function kn(x){ return B.num(x,x<1?2:1)+' kn'; }
function level(k){ return k<0.3?'lo':k<0.8?'mid':'hi'; }
B.currentGet=curGet;
B.currentCard=function(p){ if(!p||p.lat==null) return null; var box=h('section',{class:'card curcard',hidden:true});
  curGet(+p.lat,+p.lon).then(function(v){ if(!v||!v.now) return; var n=v.now, prof=B.prof?B.prof():'boat';
    if(B.dayNote) B.dayNote(p,{cu:[Math.round(n.kn*100)/100,n.dir],cz:v.deep&&v.deep.length?v.deep.map(function(z){ return [z.d,Math.round(z.kn*100)/100,z.dir]; }):null});   /* 1.2.5: ιστορικό */
    var head=h('div',{class:'curnow '+level(n.kn)},arrow(n.dir,34),h('div',null,h('b',{text:kn(n.kn)+' '+T('προς ','towards ')+dname(n.dir)}),h('small',{text:n.kn<0.3?T('Ήπιο ρεύμα','Gentle current'):n.kn<0.8?T('Μέτριο ρεύμα','Moderate current'):T('Δυνατό ρεύμα','Strong current')})));
    var strip=null; if(v.hrs&&v.hrs.length>1){ strip=h('div',{class:'curhrs'}); v.hrs.slice(0,9).forEach(function(x){ var d=new Date(x.t); strip.append(h('div',{class:'curh '+level(x.kn)},h('small',{text:B.pad(d.getHours())+':00'}),arrow(x.dir,16),h('em',{text:B.num(x.kn,1)}))); }); }
    var deep=null; if(v.deep&&v.deep.length>1){ deep=h('div',{class:'thrs'}); v.deep.forEach(function(x){ deep.append(h('div',{class:'thr curd'},h('span',{text:x.d+' m'}),h('i',null,arrow(x.dir,14),h('small',{text:' '+dname(x.dir)})),h('em',{text:kn(x.kn)}))); }); }
    var tip=[];
    if(prof==='boat') tip.push(n.kn>=0.5?T('Χωρίς αέρα, το σκάφος θα παρασύρεται προς ','With no wind, the boat will drift towards ')+dname(n.dir)+T('. Για βυθό ή jig χρειάζεσαι βαρύτερο βαρίδι.','. For bottom fishing or jigging you need a heavier weight.'):T('Ήπιο ρεύμα: καλό για κάθετο ψάρεμα και άγκυρα.','Gentle current: good for vertical fishing and anchoring.'));
    if(prof==='spear') tip.push(n.kn>=0.8?T('Προσοχή: δυνατό ρεύμα. Ξεκίνα κόντρα στο ρεύμα, για να γυρίσεις με αυτό.','Careful: strong current. Start against the current so you return with it.'):T('Βούτα κόντρα στο ρεύμα και άφησέ το να σε φέρει πίσω.','Dive against the current and let it bring you back.'));
    if(prof==='shore') tip.push(T('Ρίξε λίγο κόντρα στο ρεύμα, για να φτάσει το δόλωμα μπροστά σου.','Cast slightly up-current so the bait settles in front of you.'));
    box.replaceChildren(h('h2',{text:T('Ρεύμα θάλασσας','Sea current')}),head,strip,deep?h('p',{class:'sub',style:{margin:'10px 0 4px'},text:T('Σε βάθος (μέσος όρος ημέρας):','At depth (daily mean):')}):null,deep,
      h('p',{class:'foot',text:(tip.length?tip.join(' ')+' ':'')+T('Μοντέλο Copernicus Μεσογείου (κελί ~4 km), όχι μέτρηση. Τα βέλη δείχνουν προς τα πού πάει το νερό.','Copernicus Mediterranean model (~4 km cell), not a measurement. Arrows show where the water is going.')+(v.at?T(' Πλησιέστερη θάλασσα στο μοντέλο.',' Nearest sea cell in the model.'):'')}));
    box.hidden=false; }); return box; };
})();
