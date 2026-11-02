/* BiteCast 4 · Πρόγνωση
   Μία κατάσταση (state) και μία συνάρτηση σχεδίασης. Ξαναζωγραφίζει μόνο όταν αλλάζει κάτι (τοποθεσία, δεδομένα, επιλογή),
   χωρίς επαναλαμβανόμενους ελέγχους. Το μοντέλο βαθμού είναι το ίδιο με την κλασική έκδοση (../forecast.js). */
(function(){
'use strict';
var B=window.BC, h=B.h, s=B.s, T=B.T, EN=B.EN, ls=B.ls, U=window.PsaroUnits, PF=window.PF;

/* ---------- κατάσταση ---------- */
var st={view:'today',day:null,hour:null,fc:null,t:0,err:'',loading:false,place:null,note:''};
var root=null;

/* ---------- τοποθεσίες (κοινές με την κλασική: psaro-places, psaro-fcsel) ---------- */
function saved(){ var a=ls.get('psaro-places',[]); return Array.isArray(a)?a:[]; }
function gpsPlace(){ var p=B.lastPos(); return p?{id:'gps',name:T('Η θέση μου','My location'),lat:p.lat,lon:p.lon,gps:true}:{id:'gps',name:T('Η θέση μου','My location'),gps:true}; }
function allPlaces(){ return [gpsPlace()].concat(saved()); }
function current(){ var id=ls.get('psaro-fcsel','gps'), a=allPlaces(); return a.filter(function(p){ return p.id===id; })[0]||a[0]; }
function pid(lat,lon){ return 'p'+Math.round(lat*100)+'_'+Math.round(lon*100); }
function select(id){ ls.set('psaro-fcsel',id); st.day=null; st.hour=null; st.view='today'; load(false); }
function addPlace(name,lat,lon){
  var a=saved(), id=pid(lat,lon);
  if(!a.some(function(p){ return p.id===id; })){ a.unshift({id:id,name:name,lat:+(+lat).toFixed(4),lon:+(+lon).toFixed(4),watch:true}); ls.set('psaro-places',a.slice(0,10)); }
  select(id);
}
function delPlace(id){ ls.set('psaro-places',saved().filter(function(p){ return p.id!==id; })); if(ls.get('psaro-fcsel','gps')===id) select('gps'); }

/* είδος-στόχος από «Τι να ψαρέψω» της κλασικής έκδοσης */
function spCfg(){ var n=ls.get('psaro-advsp',''); if(!n) return null; var e=(window.SPKB||[]).filter(function(k){ return k.n===n; })[0]; return e?{n:e.n,l:e.l,sst:e.sst}:{n:n}; }

/* διόρθωση κύματος από τις δικές σου παρατηρήσεις (ίδιος κανόνας με την κλασική, psaro-seaobs) */
function waveFactor(lat,lon){
  var a=ls.get('psaro-seaobs',[]); if(!Array.isArray(a)) return 1;
  var V={'-1':0.75,'0':1,'1':1.3}, now=Date.now(), sw=0, sv=0, n=0;
  a.forEach(function(o){ var dy=(lat-o.lat)*111.2, dx=(lon-o.lon)*111.2*Math.cos(lat*Math.PI/180); if(Math.sqrt(dx*dx+dy*dy)>15) return;
    var w=Math.pow(0.5,(now-o.t)/(180*86400000)); sw+=w; sv+=w*(V[String(o.f)]||1); n++; });
  if(n<2||!sw) return 1; var avg=sv/sw, f=1+(avg-1)*n/(n+2); return Math.max(0.6,Math.min(1.5,f));
}

/* ---------- φόρτωση ---------- */
var busy=null;
function load(force){
  var p=current(); st.place=p; st.err=''; st.note='';
  if(p.gps&&p.lat==null){ st.fc=null; st.loading=true; draw(); B.locate().then(function(pos){ if(pos) load(force); else { st.loading=false; st.err='nopos'; draw(); } }); return; }
  var sp=spCfg(), spk=sp?sp.n:'', cache=ls.get('psaro-fc7',null);
  var fresh=cache&&cache.id===p.id&&(cache.sp||'')===spk&&cache.fc&&Date.now()-cache.t<3600e3;
  if(cache&&cache.id===p.id&&cache.fc){ st.fc=cache.fc; st.t=cache.t; } else { st.fc=null; }
  if(fresh&&!force){ st.loading=false; draw(); return; }
  st.loading=true; draw();
  var my=busy={};
  var f=waveFactor(p.lat,p.lon), ff=Math.abs(f-1)<0.03?null:function(url,o){ return fetch(url,o).then(function(r){
    if(!/marine-api/.test(url)||!r.ok) return r;
    return r.json().then(function(j){ try{ j.hourly.wave_height=j.hourly.wave_height.map(function(v){ return typeof v==='number'?Math.round(v*f*100)/100:v; }); }catch(e){} return {ok:true,status:200,json:function(){ return Promise.resolve(j); }}; }); }); };
  PF.getForecast(p.lat,p.lon,ff,{days:7,sp:sp}).then(function(fc){
    if(busy!==my) return; ls.set('psaro-fc7',{id:p.id,sp:spk,t:Date.now(),fc:fc}); st.fc=fc; st.t=Date.now(); st.loading=false; draw();
  }).catch(function(){
    if(busy!==my) return; st.loading=false;
    if(st.fc) st.note=T('Δεν φορτώθηκε νέα πρόγνωση. Βλέπεις την τελευταία που αποθηκεύτηκε.','No new forecast. Showing the last saved one.');
    else st.err='net';
    draw();
  });
}

/* ---------- βοηθητικά ---------- */
function lvl(sc){ return sc>=70?'good':sc>=50?'fair':'poor'; }
function verdict(d){
  if(!d.safe) return d.why==='night'?T('Δεν μένει φως σήμερα','No daylight left today'):T('Δεν συνιστάται έξοδος','Not a day to go out');
  return d.best>=80?T('Εξαιρετική μέρα για ψάρεμα','Excellent day for fishing'):d.best>=70?T('Καλή μέρα για ψάρεμα','Good day for fishing'):d.best>=50?T('Μέτρια μέρα','Fair day'):T('Δύσκολη μέρα','Tough day');
}
/* v31z539: τα όρια ασφαλείας του χρήστη (όχι σταθερά 14 kn / 0,9 m / 24 kn) */
function LIM(){ try{ return PF.lims(); }catch(e){ return {wind:14,wave:0.9,gust:24}; } }
/* γιατί μια ώρα είναι πάνω από τα όρια: «άνεμος 15 kn (όριό σου 14)» */
function overWhy(q){ var L=LIM(), r=[];
  if(q.code!=null&&q.code>=95) r.push(T('καταιγίδα','thunderstorm'));
  /* αν στρογγυλεμένα βγαίνουν ίδια (π.χ. 0,92 και 0,9 m), γράφει «λίγο πάνω από το όριό σου» */
  function one(lab,v,lim,f){ var a=f(v), b=f(lim); r.push(lab+(a===b?T('λίγο πάνω από το όριο (',' just over the limit (')+b+')':a+T(' (όριό σου ',' (your limit ')+b+')')); }
  if(q.wind!=null&&q.wind>L.wind) one(T('άνεμος ','wind '),q.wind,L.wind,U.wind);
  if(q.gust!=null&&q.gust>L.gust) one(T('ριπές ','gusts '),q.gust,L.gust,U.wind);
  if(q.wave!=null&&q.wave>L.wave&&B.prof()!=='lake') one(T('κύμα ','waves '),q.wave,L.wave,U.wave);
  return r.join(', '); }
function unsafeWhy(d){
  var w=d.wx||{}, r=[], L=LIM();
  if(w.windMax!=null&&w.windMax>L.wind) r.push(T('άνεμος έως ','wind up to ')+U.wind(w.windMax));
  if(w.waveMax!=null&&w.waveMax>L.wave&&B.prof()!=='lake') r.push(T('κύμα έως ','waves up to ')+U.wave(w.waveMax));
  if(w.gustMax!=null&&w.gustMax>L.gust) r.push(T('ριπές έως ','gusts up to ')+U.wind(w.gustMax));
  if(w.code!=null&&w.code>=95) r.push(T('καταιγίδα','thunderstorm'));
  return r.join(', ');
}
/* οι ώρες που μετράνε για την περιγραφή της μέρας: το καλύτερο παράθυρο, αλλιώς οι ώρες φωτός που απομένουν */
function focusHours(d){
  var hs=d.hours||[], td=today(), nh=nowHr();
  if(d.win) return hs.filter(function(q){ return q.hr>=d.win.s&&q.hr<=d.win.e; });
  var lt=hs.filter(function(q){ var t=q.hr*60+30; return t>=d.rise-60&&t<=d.set+60&&(d.date!==td||q.hr>=nh); });
  if(lt.length) return lt;
  return hs.filter(function(q){ var t=q.hr*60+30; return t>=d.rise-60&&t<=d.set+60; });
}
function avgOf(hs,k){ var a=hs.map(function(q){ return q[k]; }).filter(function(v){ return typeof v==='number'; }); return a.length?a.reduce(function(x,y){ return x+y; },0)/a.length:null; }
function seaTag(hr){
  if(B.prof()==='lake'){ var wl=hr&&hr.wind; return wl==null?null:wl<=10?['good',T('Ήπιος άνεμος','Light wind')]:wl<=16?['fair',T('Μέτριος άνεμος','Moderate wind')]:['poor',T('Δυνατός άνεμος','Strong wind')]; }
  var w=hr&&hr.wave; if(w==null) return null;
  return w<=0.3?['good',T('Ήρεμη θάλασσα','Calm sea')]:w<=0.6?['good',T('Ήπια θάλασσα','Slight sea')]:w<=1?['fair',T('Λίγο κύμα','Some waves')]:w<=1.5?['poor',T('Κυματισμός','Rough')]:['poor',T('Ταραγμένη θάλασσα','Very rough')];
}
var DIRS=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dirTxt(d){ return d==null?'':DIRS[Math.round(d/45)%8]; }
function sky(c){ if(c==null) return ''; return c>=95?T('Καταιγίδα','Thunderstorm'):c>=80?T('Μπόρες','Showers'):c>=61?T('Βροχή','Rain'):c>=51?T('Ψιχάλα','Drizzle'):c>=45?T('Ομίχλη','Fog'):c>=3?T('Συννεφιά','Overcast'):c>=1?T('Λίγα σύννεφα','Partly cloudy'):T('Καθαρός','Clear'); }
function trendTxt(t){ return {fast:T('πέφτει απότομα','falling fast'),slow:T('πέφτει αργά','falling'),rise:T('ανεβαίνει','rising'),stable:T('σταθερή','steady')}[t]||''; }
function moonName(f){ var i=Math.floor(f*8+0.5)%8; return (EN?['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent']:['Νέα σελήνη','Αύξουσα ημισέληνος','Πρώτο τέταρτο','Αύξων αμφίκυρτος','Πανσέληνος','Φθίνων αμφίκυρτος','Τελευταίο τέταρτο','Φθίνουσα ημισέληνος'])[i]; }
function win(d){ return d.win?B.pad(d.win.s)+':00–'+B.pad((d.win.e+1)%24)+':00':''; }
function today(){ return st.fc&&st.fc.nowLocal?st.fc.nowLocal.slice(0,10):null; }
function nowHr(){ return st.fc&&st.fc.nowLocal?+st.fc.nowLocal.slice(11,13):new Date().getHours(); }
function dayOf(date){ var a=(st.fc&&st.fc.days)||[]; return a.filter(function(d){ return d.date===date; })[0]||a[0]; }
function hourOf(d,hr){ return (d.hours||[]).filter(function(x){ return x.hr===hr; })[0]||null; }
function val(p){ return p?[p[0],h('small',{text:p[1]})]:'–'; }
function ago(t){ var m=Math.round((Date.now()-t)/60000); return m<2?T('μόλις τώρα','just now'):m<60?T('πριν ','')+m+T(' λεπτά',' min ago'):T('πριν ','')+Math.round(m/60)+T(' ώρες',' h ago'); }

/* ---------- καμπύλη ημέρας (το κεντρικό στοιχείο) ---------- */
function curve(d,opt){
  opt=opt||{}; var W=opt.w||340, H=opt.h||120, hs=d.hours||[], pad=opt.mini?2:8;
  var svg=s('svg',{viewBox:'0 0 '+W+' '+H,class:opt.mini?'mini':'curve',preserveAspectRatio:'none','aria-hidden':'true'});
  if(!hs.length) return svg;
  var x=function(hr){ return pad+(W-2*pad)*(hr+0.5)/24; }, lo=opt.lo!=null?opt.lo:0, hi=opt.hi!=null?opt.hi:100, y=function(sc){ return H-pad-(H-2*pad-(opt.mini?2:14))*Math.max(0,Math.min(1,(sc-lo)/Math.max(1,hi-lo))); };
  var gid='g'+Math.random().toString(36).slice(2,7);
  var grad=s('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1},s('stop',{offset:'0','stop-color':'var(--sea)','stop-opacity':opt.mini?.55:.45}),s('stop',{offset:'1','stop-color':'var(--sea)','stop-opacity':0}));
  svg.appendChild(s('defs',null,grad));
  if(!opt.mini){
    /* νύχτα: πιο σκούρο φόντο πριν τα χαράματα και μετά το σούρουπο */
    var r=(d.rise||360)/60, st2=(d.set||1080)/60;
    svg.append(s('rect',{x:0,y:0,width:x(r-0.5),height:H,class:'night'}),s('rect',{x:x(st2-0.5),y:0,width:W-x(st2-0.5),height:H,class:'night'}));
    if(d.win) svg.appendChild(s('rect',{x:x(d.win.s)-(W-2*pad)/48,y:0,width:(d.win.e-d.win.s+1)*(W-2*pad)/24,height:H,class:'band',rx:8}));
  }
  /* ομαλή καμπύλη (Catmull-Rom) */
  var pts=hs.map(function(q){ return [x(q.hr),y(q.score)]; }), dd='M'+pts[0][0]+','+pts[0][1];
  for(var i=0;i<pts.length-1;i++){ var p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    dd+=' C'+(p1[0]+(p2[0]-p0[0])/6)+','+(p1[1]+(p2[1]-p0[1])/6)+' '+(p2[0]-(p3[0]-p1[0])/6)+','+(p2[1]-(p3[1]-p1[1])/6)+' '+p2[0]+','+p2[1]; }
  svg.append(s('path',{d:dd+' L'+pts[pts.length-1][0]+','+H+' L'+pts[0][0]+','+H+' Z',fill:'url(#'+gid+')'}),s('path',{d:dd,class:'line'}));
  if(!opt.mini){
    /* μη ασφαλείς ώρες: κόκκινη γραμμή στη βάση */
    hs.forEach(function(q){ if(!q.safe) svg.appendChild(s('rect',{x:x(q.hr)-(W-2*pad)/48,y:H-4,width:(W-2*pad)/24,height:4,class:'unsafe'})); });
    if(opt.now!=null) svg.appendChild(s('line',{x1:x(opt.now),x2:x(opt.now),y1:4,y2:H,class:'now'}));
    if(opt.sel!=null){ var q=hs.filter(function(z){ return z.hr===opt.sel; })[0]; if(q) svg.append(s('line',{x1:x(q.hr),x2:x(q.hr),y1:0,y2:H,class:'sel'}),s('circle',{cx:x(q.hr),cy:y(q.score),r:5.5,class:'dot'})); }
  }
  svg._x=function(px,w){ var hr=Math.round((px/w*W-pad)/((W-2*pad)/24)-0.5); return Math.max(0,Math.min(23,hr)); };
  return svg;
}

/* ---------- σελίδα ---------- */
function draw(){
  if(!root) return;
  var p=st.place||current(), fc=st.fc, td=today();
  var page=h('div',{class:'page fcpage'});
  if(st.view==='day'||st.view==='week') st.view='today';
  var title=T('Πρόγνωση','Forecast');
  var top=h('div',{class:'top'});
  if(false){ var bk=h('button',{class:'iconbtn',type:'button','aria-label':T('Πίσω στις 7 ημέρες','Back to 7 days'),html:B.iconSvg('back'),onclick:function(){ st.view='week'; st.day=null; st.hour=null; draw(); }}); top.append(h('div',{style:{display:'flex',alignItems:'center',gap:'12px',minWidth:0}},bk,h('h1',{class:'lt',text:title}))); }
  else top.append(h('h1',{class:'lt',text:title}));
  var rf=h('button',{class:'iconbtn'+(st.loading&&fc?' spin':''),type:'button','aria-label':T('Ανανέωση πρόγνωσης','Refresh forecast'),html:B.iconSvg('refresh'),onclick:function(){ if(p.gps) B.locate(6000).then(function(){ load(true); }); else load(true); }});
  var bell=h('a',{class:'iconbtn bellb',href:'#inbox','aria-label':T('Ειδοποιήσεις','Notifications'),html:B.iconSvg('bell')}); if(B.inboxUnread) B.inboxUnread().then(function(n){ if(n>0) bell.append(h('i',{class:'bdg',text:n>9?'9+':String(n)})); });
  top.append(h('div',{style:{display:'flex',gap:'8px'}},bell,rf)); page.append(top);
  var pl=h('button',{class:'place',type:'button','aria-label':T('Αλλαγή τοποθεσίας','Change location'),onclick:placeSheet},B.icon(p.gps?'gps':'pin'),h('b',{text:p.name}),h('i',{text:'▾'}));
  page.append(pl);
  if(navigator.onLine===false) page.append(h('div',{class:'offline',text:T('Χωρίς σύνδεση. Βλέπεις την τελευταία πρόγνωση που αποθηκεύτηκε.','Offline. Showing the last saved forecast.')}));
  page.append(B.seg([['today',T('Ημέρες','Days')],['adv',T('Είδη','Species')],['mine',T('Δικά μου','Mine')]],st.view,function(v){ st.view=v; st.day=null; st.hour=null; draw(); },T('Όψη πρόγνωσης','Forecast view')));

  if(!fc){
    if(st.err==='nopos') page.append(emptyBox(T('Χρειάζεται τοποθεσία','A location is needed'),T('Επίτρεψε την πρόσβαση στη θέση σου ή διάλεξε μια τοποθεσία.','Allow location access or choose a place.'),T('Διάλεξε τοποθεσία','Choose a place'),placeSheet));
    else if(st.err==='net') page.append(emptyBox(T('Η πρόγνωση δεν φορτώθηκε','The forecast did not load'),T('Έλεγξε τη σύνδεση και δοκίμασε ξανά.','Check your connection and try again.'),T('Δοκίμασε ξανά','Try again'),function(){ load(true); }));
    else page.append(skeleton());
  } else if(st.view==='week') week(page,fc);
  else if(st.view==='adv') B.fcAdv(page,fc,{place:p,today:td,open:openDay,reload:function(){ load(false); }});
  else if(st.view==='mine'){ if(B.oppsCard) page.append(B.oppsCard(5)); B.fcMine(page,fc,{place:p,today:td}); }
  else { if(!st.day||st.day<td||!(fc.days||[]).some(function(x){ return x.date===st.day; })) st.day=td; if(!(fc.days||[]).some(function(x){ return x.date===st.day; })){ var fd=(fc.days||[]).filter(function(x){ return x.date>=td; })[0]||(fc.days||[])[fc.days.length-1]; if(fd) st.day=fd.date; } page.append(dayStrip(fc)); var dw=h('div',{class:'dwrap'}); dayView(dw,fc,dayOf(st.day)); page.append(dw); }

  if(st.note) page.append(h('p',{class:'foot',text:st.note}));
  if(fc) page.append(h('p',{class:'foot'},T('Ενημέρωση ','Updated ')+ago(st.t)+'. '+T('Καιρός και κύμα από ','Weather and waves from '),h('a',{href:'https://open-meteo.com',target:'_blank',rel:'noopener',text:'Open-Meteo'}),T('. Ενδεικτική πρόγνωση, όχι επίσημη.','. Indicative, not an official forecast.')));
  root.replaceChildren(page);
}
function emptyBox(t,p,btn,fn){ return h('div',{class:'card empty'},h('h3',{text:t}),h('p',{text:p}),h('button',{class:'btn pri',type:'button',text:btn,onclick:fn})); }
function skeleton(){ return h('div',{role:'status','aria-label':T('Φόρτωση πρόγνωσης','Loading forecast')},
  h('div',{class:'hero'},h('div',{class:'sk',style:{height:'22px',width:'60%',marginBottom:'12px'}}),h('div',{class:'sk',style:{height:'44px',width:'45%',marginBottom:'18px'}}),h('div',{class:'sk',style:{height:'120px'}})),
  h('div',{class:'card'},h('div',{class:'sk',style:{height:'150px'}}))); }

function openDay(date,hr){ st.view='today'; st.day=date; st.hour=hr==null?null:hr; draw(); try{ window.scrollTo(0,0); }catch(e){} }
/* ---------- οι 7 μέρες σε μία λωρίδα πάνω: πάτημα = λεπτομέρειες της μέρας από κάτω ---------- */
/* v31z525: αλλαγή ημέρας χωρίς να ξαναχτίζεται όλη η σελίδα (χωρίς «blink») */
function swapDay(bar,date){ [].forEach.call(bar.children,function(b){ var on=b._d===date; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on)); });
  var old=root&&root.querySelector('.dwrap'); if(!old||!st.fc){ draw(); return; } var nw=h('div',{class:'dwrap'}); dayView(nw,st.fc,dayOf(date)); old.replaceWith(nw); }
function dayStrip(fc){
  var td=today(), sel=st.day||td, bar=h('div',{class:'dstrip',role:'tablist','aria-label':T('Ημέρες','Days')}), selEl=null;
  (fc.days||[]).filter(function(d){ return d.date>=td; }).forEach(function(d){ var on=d.date===sel, lv=d.safe?lvl(d.best):'poor', dt=new Date(d.date+'T12:00:00');
    var nm=d.date===td?T('Σήμερα','Today'):dt.toLocaleDateString(EN?'en-GB':'el-GR',{weekday:'short'}).replace('.','');
    var b=h('button',{type:'button',role:'tab','aria-selected':String(on),class:'dtile lv-'+lv+(on?' on':''),onclick:function(){ if(st.day===d.date) return; st.day=d.date; st.hour=null; swapDay(bar,d.date); try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){ window.scrollTo(0,0); } }},
      h('span',{class:'dn',text:nm}),h('span',{class:'dd',text:String(dt.getDate())}),
      d.safe?h('b',{class:'dsc',text:String(d.best)}):h('b',{class:'dsc no',title:d.why==='night'?T('χωρίς φως','no light'):shortWhy(d),text:'—'}),
      h('small',{class:'dw',text:d.safe&&d.win?B.pad(d.win.s)+'–'+B.pad((d.win.e+1)%24):(d.why==='night'?T('νύχτα','night'):shortWhy(d).split(' ')[0])}));
    b._d=d.date; if(on) selEl=b; bar.append(b); });
  if(selEl) setTimeout(function(){ try{ var r=selEl.offsetLeft-bar.clientWidth/2+selEl.clientWidth/2; if(r>0&&bar.scrollLeft===0) bar.scrollLeft=r; }catch(e){} },0);
  return bar;
}
/* ---------- μία μέρα ---------- */
function dayView(page,fc,d){
  if(!d) return;
  var td=today(), isToday=d.date===td, nh=nowHr();
  var selH=st.hour!=null?st.hour:(isToday?nh:(d.win?d.win.s:12)), hr=hourOf(d,selH)||hourOf(d,12)||d.hours[0];
  /* κεντρικό: απόφαση, καλύτερη ώρα, καμπύλη της μέρας */
  var hero=h('section',{class:'hero lv-'+(d.safe?lvl(d.best):'poor'),'aria-label':T('Σύνοψη ημέρας','Day summary')});
  var fh=focusHours(d), tg=seaTag({wave:avgOf(fh,'wave'),wind:avgOf(fh,'wind')});
  hero.append(h('div',{class:'hv'},h('h2',{text:verdict(d)}),d.safe?h('span',{class:'score',title:T('Δείκτης ψαρέματος','Fishing index'),text:String(d.best)}):null));
  if(d.safe&&d.win) hero.append(h('div',{class:'hw'},h('span',{text:T('Καλύτερη ώρα','Best time')}),h('b',{text:win(d)})));
  else if(!d.safe){ var why=unsafeWhy(d); if(why) hero.append(h('p',{class:'hwhy',text:why.charAt(0).toUpperCase()+why.slice(1)+'.'})); }
  /* σήμερα δεν βγαίνει: δείξε την επόμενη καλή μέρα */
  if(isToday&&(!d.safe||(d.best<50))){ var nx=(fc.days||[]).filter(function(x){ return x.date>d.date&&x.safe&&x.best>=60; })[0];
    if(nx) hero.append(h('button',{class:'next',type:'button',onclick:function(){ st.view='today'; st.day=nx.date; st.hour=null; draw(); }},
      h('span',{text:T('Επόμενη καλή μέρα','Next good day')}),h('b',{text:B.dayName(nx.date,td)+', '+win(nx)}),h('i',{class:'sc',text:String(nx.best)}))); }
  if(tg) hero.append(h('span',{class:'tag '+tg[0],text:tg[1]}));
  page.append(hero);
  /* ψαροντούφεκο: ορατότητα νερού (δορυφόρος όταν υπάρχει, αλλιώς εκτίμηση από κύμα και βροχή) */
  if(B.prof()==='spear'&&B.clarityCard){ var cc=B.clarityCard(fc,d,st.place,isToday,isToday?nh:null); if(cc) page.append(cc); }
  /* «Σήμερα με μια ματιά»: ο καιρός αυτή την ώρα και γρήγορες ενέργειες */
  if(isToday){ var hn=hourOf(d,nh), lake=B.prof()==='lake', onTrip=!!(B.trip&&B.trip.active&&B.trip.active());
    if(hn){ var cells=[[U.windP(hn.wind)[0],U.windP(hn.wind)[1]+' '+dirTxt(hn.dir),T('άνεμος','wind')]];
      if(!lake&&hn.wave!=null) cells.push([U.waveP(hn.wave)[0],U.waveP(hn.wave)[1],T('κύμα','waves')]);
      if(hn.pres!=null) cells.push([String(Math.round(hn.pres)),({fast:'↓↓',slow:'↘',rise:'↗',stable:'→'}[hn.ptrend]||''),T('πίεση','pressure')]);
      cells.push([U.tempP(lake?hn.temp:(hn.sst!=null?hn.sst:hn.temp))[0],U.tempP(lake?hn.temp:(hn.sst!=null?hn.sst:hn.temp))[1],lake||hn.sst==null?T('αέρας','air'):T('νερό','water')]);
      var nc=h('section',{class:'card nowcard','aria-label':T('Τώρα','Now')},h('div',{class:'nwh'},h('b',{text:T('Τώρα','Now')+', '+B.pad(nh)+':00'}),h('span',{class:'sub',text:sky(hn.code)})),
        h('div',{class:'nwg'},cells.map(function(c){ return h('div',{class:'nwc'},h('b',null,c[0],h('small',{text:' '+c[1]})),h('span',{text:c[2]})); })),
        h('div',{class:'nwa'},onTrip?h('button',{class:'btn pri',type:'button',text:T('Ψάρι εδώ','Catch here'),onclick:function(){ B.quickRec&&B.quickRec(false); }}):h('a',{class:'btn pri',href:'#trip',text:'▶ '+T('Έναρξη εξόδου','Start trip')}),
          h('button',{class:'btn',type:'button',text:'+ '+T('Νέο ψάρι','New catch'),onclick:function(){ B.biteForm&&B.biteForm(); }})));
      page.append(nc); if(B.oppsCard) page.append(B.oppsCard(2,{hideEmpty:true})); } }

  /* ανά ώρα: μπάρες και λεπτομέρειες της ώρας (σύρε το δάχτυλο πάνω στις μπάρες) */
  if(hr) page.append(hourCard(fc,d,selH,isToday?nh:null));

  /* γιατί αυτός ο βαθμός */
  var why2=reasons(d); if(why2.length) page.append(h('section',{class:'card'},h('h2',{text:T('Γιατί','Why')}),h('ul',{class:'why'},why2.map(function(r){ return h('li',{class:r[0]},r[1]); }))));
  if(isToday&&B.lastYearCard){ var ly=B.lastYearCard(); if(ly) page.append(ly); }
  if(isToday&&B.bestDaysCard&&hr){ var bd=B.bestDaysCard({press:hr.pres,wind:hr.wind,wave:hr.wave,sst:hr.sst,temp:hr.temp}); if(bd) page.append(bd); }

  page.append(pwCard(fc,d));
  /* ήλιος και σελήνη */
  var p=st.place||current(), sm=null; try{ sm=PF.sunMoon(d.date,p.lat,p.lon,fc.tz); }catch(e){}
  var ms=h('section',{class:'card'},h('h2',{text:T('Ήλιος και σελήνη','Sun and moon')}));
  var rr=[[T('Ανατολή','Sunrise'),B.hm(d.rise)],[T('Δύση','Sunset'),B.hm(d.set)],[T('Σελήνη','Moon'),moonName(d.f)],[T('Φωτισμός','Illumination'),Math.round(((1-Math.cos(2*Math.PI*d.f))/2)*100)+'%']];
  if(sm){ var mj=(sm.maj||[]).filter(function(m){ return m>=0&&m<1440; }).map(B.hm), mn=(sm.min||[]).filter(function(m){ return m>=0&&m<1440; }).map(B.hm);
    if(mj.length) rr.push([T('Κύριες περίοδοι','Major periods'),mj.join(', ')]); if(mn.length) rr.push([T('Δευτερεύουσες','Minor periods'),mn.join(', ')]); }
  ms.append(h('div',{class:'rows one'},rr.map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',{text:r[1]})); })));
  page.append(ms);
  /* έκθεση της ακτής ανά κατεύθυνση ανέμου και swell (ίδιος υπολογισμός με την κλασική, exposure.js) — μόνο για σήμερα, θάλασσα */
  if(isToday&&B.prof()!=='lake'&&window.PsaroExposure){ var ex=h('div',{class:'expo'},h('div',{id:'fcDays',hidden:true})); page.append(ex); tidyExpo(ex);
    setTimeout(function(){ try{ window.dispatchEvent(new CustomEvent('psaro-fcloaded',{detail:{place:{lat:p.lat,lon:p.lon,name:p.name||''},fc:fc}})); }catch(e){} },0); }
}
/* 24 μπάρες: πάτημα = λεπτομέρειες της ώρας. Χρώμα: καλύτερο παράθυρο, περίοδος σελήνης, μη ασφαλής ώρα. */
function hourRows(hr){
  var lake=B.prof()==='lake', P=hr.pres!=null?U.pressP(hr.pres):null;
  return [
    [T('Άνεμος','Wind'),hr.wind!=null?[U.windP(hr.wind)[0]+' ',h('small',{text:U.windP(hr.wind)[1]+' '+dirTxt(hr.dir)})]:'–'],
    [T('Ριπές','Gusts'),val(U.windP(hr.gust))],
    lake?null:[T('Κύμα','Waves'),hr.wave!=null?[U.waveP(hr.wave)[0],h('small',{text:U.waveP(hr.wave)[1]+(hr.period?' · '+Math.round(hr.period)+' s':'')})]:'–'],
    lake?null:[T('Θάλασσα','Sea temp'),val(U.tempP(hr.sst))],
    [T('Πίεση','Pressure'),P?[(P[1]==='hPa'?String(Math.round(hr.pres)):P[0]),h('small',{text:(P[1]==='hPa'?'':P[1]+' ')+({fast:'↓↓',slow:'↘',rise:'↗',stable:'→'}[hr.ptrend]||''),title:trendTxt(hr.ptrend)})]:'–'],
    [T('Αέρας','Air temp'),val(U.tempP(hr.temp))],
    [T('Βροχή','Rain'),hr.rain!=null?[String(Math.round(hr.rain)),h('small',{text:'%'})]:'–'],
    [T('Ουρανός','Sky'),sky(hr.code)||'–']
  ].filter(Boolean);
}
/* 24 μπάρες. Πάτημα ή σύρσιμο του δαχτύλου = λεπτομέρειες κάθε ώρας, χωρίς να ξαναζωγραφίζεται η σελίδα.
   Χρώμα: καλύτερο παράθυρο, περίοδος σελήνης, μη ασφαλής ώρα. */
function hourCard(fc,d,selH,nh){
  var p=st.place||current(), tz=fc.tz||0, per=[]; try{ per=PF.sunMoon(d.date,p.lat,p.lon,tz).periods||[]; }catch(e){}
  var hs=d.hours||[], sc=hs.map(function(q){ return q.score; }), lo=Math.min.apply(null,sc)-8, hi=Math.max.apply(null,sc);
  var c=h('section',{class:'card hcard'},h('div',{class:'hch'},h('h2',{text:T('Ανά ώρα','By hour')}),h('span',{class:'sub',text:'↑ '+B.hm(d.rise)+'  ↓ '+B.hm(d.set)})));
  var box=h('div',{class:'hbars',role:'listbox',tabindex:'0','aria-label':T('Ώρες της ημέρας. Σύρε για να δεις κάθε ώρα.','Hours of the day. Drag to see each hour.')});
  var bars=hs.map(function(q){
    var t0=Date.parse(d.date+'T'+B.pad(q.hr)+':00:00Z')-tz*60000, moon=per.some(function(x){ return x.s<t0+3600000&&x.e>t0; });
    var k=!q.safe?'bad':(d.win&&q.hr>=d.win.s&&q.hr<=d.win.e)?'best':moon?'moon':'';
    var b=h('i',{role:'option',class:'hb'+(k?' '+k:'')+(nh!=null&&q.hr<nh?' past':''),'aria-label':B.pad(q.hr)+':00, '+T('δείκτης ','index ')+q.score,style:{height:Math.round(10+100*Math.max(0,(q.score-lo)/Math.max(1,hi-lo)))+'px'}});
    box.append(b); return b;
  });
  var head=h('div',{class:'hsel'}), huLine=h('p',{class:'hover',hidden:true}), rows=h('div',{class:'rows'}), cur=-1;
  function set(i){
    i=Math.max(0,Math.min(hs.length-1,i)); if(i===cur) return; cur=i; var q=hs[i]; st.hour=q.hr;
    bars.forEach(function(b,j){ b.classList.toggle('sel',j===i); b.setAttribute('aria-selected',String(j===i)); });
    head.className='hsel lv-'+(q.safe?lvl(q.score):'poor');
    head.replaceChildren.apply(head,[h('b',{text:(nh!=null&&q.hr===nh?T('Τώρα','Now')+', ':'')+B.pad(q.hr)+':00'}),h('span',{class:'hs',text:T('δείκτης ','index ')+q.score}),].filter(Boolean)); var ow=q.safe?'':overWhy(q);
    huLine.hidden=q.safe; huLine.replaceChildren(h('b',{text:T('Πάνω από τα όριά σου','Over your limits')}),h('span',{text:ow?': '+ow:''}),h('a',{href:'#',text:T('Αλλαγή ορίων','Change limits'),onclick:function(e){ e.preventDefault(); limSheet(); }}));
    rows.replaceChildren.apply(rows,hourRows(q).map(function(r){ return h('div',{class:'row'},h('span',{text:r[0]}),h('b',null,r[1])); }));
  }
  scrub(box,function(fx){ set(Math.floor(fx*hs.length)); });
  box.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft'){ set(cur-1); e.preventDefault(); } else if(e.key==='ArrowRight'){ set(cur+1); e.preventDefault(); } });
  var si=0; hs.forEach(function(q,j){ if(q.hr===selH) si=j; }); set(si);
  c.append(h('div',{class:'hbw'},box,h('div',{class:'axis'},['00','06','12','18','23'].map(function(t){ return h('span',{text:t}); }))),
    h('div',{class:'hleg'},h('span',{class:'k best',text:T('καλύτερες ώρες','best hours')}),h('span',{class:'k moon',text:T('σελήνη','moon')}),h('span',{class:'k bad',text:T('πάνω από τα όρια','over your limits')})),head,huLine,rows);
  return c;
}
/* σύρσιμο οριζόντια πάνω σε ένα στοιχείο: fn(θέση 0–1). Η κάθετη κύλιση της σελίδας δουλεύει κανονικά. */
function scrub(el,fn){
  var on=false;
  function at(e){ var r=el.getBoundingClientRect(); fn(Math.max(0,Math.min(0.9999,(e.clientX-r.left)/r.width))); }
  el.style.touchAction='pan-y';
  el.addEventListener('pointerdown',function(e){ on=true; try{ el.setPointerCapture(e.pointerId); }catch(x){} at(e); });
  el.addEventListener('pointermove',function(e){ if(on) at(e); });
  ['pointerup','pointercancel','lostpointercapture'].forEach(function(n){ el.addEventListener(n,function(){ on=false; }); });
}
/* όρια ασφαλείας σε παράθυρο, από την Πρόγνωση */
function limSheet(){ if(!B.limitsCard) return; var ch=false, on=function(){ ch=true; }; window.addEventListener('psaro-limits',on);
  B.sheet({title:T('Όρια ασφαλείας','Safety limits'),body:h('div',null,B.limitsCard()),onclose:function(){ window.removeEventListener('psaro-limits',on); if(ch) load(true); }}); }
function hourLine(hr,d){
  var bits=[B.pad(hr.hr)+':00', T('δείκτης ','index ')+hr.score];
  if(hr.wind!=null) bits.push(U.wind(hr.wind)); if(hr.wave!=null&&B.prof()!=='lake') bits.push(U.wave(hr.wave));
  return h('p',{class:'hline'+(hr.safe?'':' unsafe')},bits.join(' · ')+(hr.safe?'':' · '+T('πάνω από τα όρια','over your limits')));
}
/* τι βοηθά και τι δυσκολεύει, στις ώρες του καλύτερου παραθύρου */
function reasons(d){
  var hs=focusHours(d); if(!hs.length) return [];
  var av=function(k){ var a=hs.map(function(q){ return q[k]; }).filter(function(v){ return typeof v==='number'; }); return a.length?a.reduce(function(x,y){ return x+y; },0)/a.length:null; };
  var out=[], wd=av('wind'), wv=av('wave'), pf=B.prof();
  if(wd!=null) out.push(wd<=12?['up',T('Ήπιος άνεμος ('+U.wind(wd)+')','Light wind ('+U.wind(wd)+')')]:wd<=18?['mid',T('Μέτριος άνεμος ('+U.wind(wd)+')','Moderate wind ('+U.wind(wd)+')')]:['down',T('Δυνατός άνεμος ('+U.wind(wd)+')','Strong wind ('+U.wind(wd)+')')]);
  if(wv!=null&&pf!=='lake') out.push(wv<=(pf==='spear'?0.3:0.5)?['up',T('Χαμηλό κύμα ('+U.wave(wv)+')','Low waves ('+U.wave(wv)+')')]:wv<=1?['mid',T('Λίγο κύμα ('+U.wave(wv)+')','Some waves ('+U.wave(wv)+')')]:['down',T('Ψηλό κύμα ('+U.wave(wv)+')','High waves ('+U.wave(wv)+')')]);
  var tr=hs[0].ptrend; if(tr) out.push(tr==='fast'?['down',T('Η πίεση πέφτει απότομα','Pressure falling fast')]:tr==='rise'?['up',T('Η πίεση ανεβαίνει','Pressure rising')]:['up',T('Σταθερή πίεση','Steady pressure')]);
  if(d.win){ var s0=d.win.s*60, e0=(d.win.e+1)*60, near=function(m){ return m>=s0-60&&m<=e0+60; };
    if(near(d.rise)) out.push(['up',T('Χαράματα μέσα στο παράθυρο','Dawn falls in the window')]);
    if(near(d.set)) out.push(['up',T('Σούρουπο μέσα στο παράθυρο','Dusk falls in the window')]); }
  if(hs.some(function(q){ return q.code!=null&&q.code>=95; })) out.push(['down',T('Πιθανή καταιγίδα','Possible thunderstorm')]);
  return out;
}

/* πίεση, άνεμος και σελήνη: τελευταίες 24 ώρες (συνεχής γραμμή) και πρόγνωση (διακεκομμένη) για 24 ώρες, 3 ή 7 ημέρες.
   Ίδια πηγή και ίδια αποθήκευση (psaro-fcpress2) με την κλασική έκδοση. */
var PRG={d1:{past:24,fut:25,l:T('24 ώρες','24 h')},d3:{past:24,fut:72,l:T('3 ημέρες','3 days')},d7:{past:24,fut:168,l:T('7 ημέρες','7 days')}};
var pwMem={};
function pwKey(){ var k=ls.get('psaro-pwrange','d1'); return PRG[k]?k:'d1'; }
function pwSeries(p,rk){
  var key='psaro-fcpress2'+(rk==='d1'?'':'-'+rk), c=ls.get(key,null);
  if(c&&c.id===p.id&&Date.now()-c.t<30*60000&&c.v) return Promise.resolve(c.v);
  var mk=p.id+rk; if(pwMem[mk]) return pwMem[mk];
  var url='https://api.open-meteo.com/v1/forecast?latitude='+(+p.lat).toFixed(3)+'&longitude='+(+p.lon).toFixed(3)+'&hourly=pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&past_hours='+PRG[rk].past+'&forecast_hours='+PRG[rk].fut+'&timezone=UTC';
  return pwMem[mk]=fetch(url).then(function(r){ if(!r.ok) throw new Error('HTTP'); return r.json(); }).then(function(j){
    var H=j.hourly||{}, ts=H.time||[], out=[], now=-1, nn=function(a,i){ return a&&typeof a[i]==='number'?a[i]:null; };
    for(var i=0;i<ts.length;i++){ var pr=nn(H.pressure_msl,i); if(pr==null) continue; var ms=Date.parse(ts[i]+'Z'); out.push({t:ms,p:pr,w:nn(H.wind_speed_10m,i),g:nn(H.wind_gusts_10m,i),d:nn(H.wind_direction_10m,i)}); if(ms<=Date.now()) now=out.length-1; }
    var v={pts:out,now:now}; ls.set(key,{id:p.id,t:Date.now(),v:v}); delete pwMem[mk]; return v;
  }).catch(function(e){ delete pwMem[mk]; if(c&&c.id===p.id&&c.v) return c.v; throw e; });
}
/* η κάρτα «Έκθεση της ακτής» (κοινός κώδικας με την κλασική): κρατά ορατά τίτλο, «Τώρα» και μπάρες, τα υπόλοιπα κείμενα σε «Λεπτομέρειες» */
function tidyExpo(ex){ var busy=false;
  function fix(){ var c=ex.querySelector('#fcExposure'); if(!c||busy) return; var dd=c.querySelector(':scope>details.exmore'); if(dd){ var n=dd.nextElementSibling; if(n){ busy=true; while(n){ var nx=n.nextElementSibling; dd.append(n); n=nx; } busy=false; } return; } busy=true;
    try{ var kids=[].slice.call(c.children), h3=kids[0], bars=null; kids.forEach(function(k){ if(!bars&&k.tagName==='DIV'&&k.children.length>=8) bars=k; }); if(!h3||!bars){ busy=false; return; }
      var d=h('details',{class:'exmore'},h('summary',{text:T('Λεπτομέρειες · Πώς είναι η θάλασσα εδώ;','Details · How is the sea here?')})), now=null;
      kids.forEach(function(k){ if(k===h3||k===bars) return; if(!now&&k.tagName==='P'&&!k.classList.contains('note')){ now=k; k.classList.add('exnow'); return; } d.append(k); });
      c.append(d); }catch(e){} busy=false; }
  try{ new MutationObserver(function(){ setTimeout(fix,0); }).observe(ex,{childList:true,subtree:true}); }catch(e){} setTimeout(fix,300); }
/* μετρημένη πίεση από σταθμό (METAR ή Τμήμα Μετεωρολογίας) κοντά στο μέρος, για σύγκριση με το μοντέλο (όπως η κλασική, psaro-obsp) */
function measured(box,p,modelNow){
  var SUPA='https://sgfohmqwdwtkhtrebnix.supabase.co', SKEY='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
  function pick(list){ var best=null, bd=1e9; (list||[]).forEach(function(s){ if(s.pres==null||!isFinite(s.lat)||!isFinite(s.lon)||Date.now()-Date.parse(s.t||0)>2*3600000) return;
      var dx=(s.lon-p.lon)*Math.cos(p.lat*Math.PI/180)*111.2, dy=(s.lat-p.lat)*111.2, d=Math.sqrt(dx*dx+dy*dy); if(d<bd){ bd=d; best=s; } }); return best&&bd<=60?{s:best,d:bd}:null; }
  function show(r){ if(!r) return; var s=r.s, U=window.PsaroUnits, pf=function(v){ return U&&U.press?U.press(v):Math.round(v)+' hPa'; }, dif=modelNow!=null?Math.round((s.pres-modelNow)*10)/10:null;
    var old=box.querySelector('.measp'); if(old) old.remove();
    box.append(h('p',{class:'foot measp',text:T('Μετρημένη πίεση: ','Measured pressure: ')+pf(s.pres)+' · '+(s.name||s.id)+' ('+(s.src||'')+', '+String(s.t).slice(11,16)+'Z, '+Math.round(r.d)+' km)'+(dif!=null?' · '+T('μοντέλο τώρα: ','model now: ')+pf(modelNow)+' ('+(dif>0?'+':'')+B.num(dif,1)+' hPa)':'')})); }
  if(p.lat==null) return; var c=ls.get('psaro-obsp',null); if(c&&Date.now()-c.t<10*60000&&c.v){ show(pick(c.v)); return; }
  var to; try{ to=AbortSignal.timeout(10000); }catch(e){}
  fetch(SUPA+'/functions/v1/smart-api',{signal:to,headers:{apikey:SKEY,Authorization:'Bearer '+SKEY}}).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){ var l=Array.isArray(j)?j:[]; ls.set('psaro-obsp',{t:Date.now(),v:l}); show(pick(l)); }).catch(function(){});
}
function pwCard(fc,d){
  var rk=pwKey(), p=st.place||current(), c=h('section',{class:'card pw'});
  c.append(h('div',{class:'pwh'},h('h2',{text:T('Πίεση, άνεμος, σελήνη','Pressure, wind, moon')}),B.seg(Object.keys(PRG).map(function(k){ return [k,PRG[k].l]; }),rk,function(v){ ls.set('psaro-pwrange',v); st.pwi=null; draw(); },T('Εύρος','Range'))));
  var body=h('div',null,h('div',{class:'sk',style:{height:'200px'}})); c.append(body);
  if(p.lat==null) return c;
  pwSeries(p,rk).then(function(v){ if(body.isConnected||!root) pwFill(body,v,p,fc,rk); else setTimeout(function(){ pwFill(body,v,p,fc,rk); },0); var mn=v&&v.pts&&v.now!=null&&v.pts[v.now]?v.pts[v.now].p:null; measured(c,p,mn); })
    .catch(function(){ body.replaceChildren(h('p',{class:'sub',text:T('Τα δεδομένα πίεσης δεν φορτώθηκαν.','Pressure data did not load.')})); });
  return c;
}
function pwFill(body,v,p,fc,rk){
  var pts=v.pts||[], N=pts.length; if(N<6){ body.replaceChildren(h('p',{class:'sub',text:T('Δεν υπάρχουν δεδομένα πίεσης.','No pressure data.')})); return; }
  var nowI=-1; pts.forEach(function(q,i){ if(q.t<=Date.now()) nowI=i; });
  var tz=fc.tz||0, loc=function(ms){ return new Date(ms+tz*60000).toISOString(); }, td=today();
  var W=340, Lm=6, R=38, pT=14, pH=86, wT=pT+pH+22, wH=56, mT=wT+wH+34, mH=30, H=mT+mH+16, n=N;
  var ps=pts.map(function(q){ return q.p; }), pmin=Math.floor(Math.min.apply(null,ps)-0.5), pmax=Math.ceil(Math.max.apply(null,ps)+0.5); if(pmax-pmin<4){ pmin-=1; pmax+=1; }
  var wmaxKn=Math.max(30,Math.max.apply(null,pts.map(function(q){ return q.g||q.w||0; })));
  var X=function(i){ return Lm+(W-Lm-R)*i/(n-1); }, Y=function(pv){ return pT+pH-(pv-pmin)/(pmax-pmin)*pH; }, YW=function(kn){ return wT+wH-Math.min(1,kn/wmaxKn)*wH; };
  var svg=s('svg',{viewBox:'0 0 '+W+' '+H,class:'pwc',role:'img','aria-label':T('Πίεση, άνεμος και σελήνη ανά ώρα','Pressure, wind and moon by hour')});
  var tx=function(x,y,t,cls,anc){ var e=s('text',{x:x,y:y,class:cls||'ax','text-anchor':anc||'start'}); e.textContent=t; svg.appendChild(e); };
  /* πλέγμα πίεσης με τιμές δεξιά */
  var stp=Math.max(1,Math.round((pmax-pmin)/3));
  for(var g=pmin;g<=pmax;g+=stp){ svg.appendChild(s('line',{x1:Lm,x2:W-R,y1:Y(g),y2:Y(g),class:'gl'})); tx(W-R+4,Y(g)+3.5,String(g)); }
  tx(Lm,pT-4,'hPa','axh');
  /* άνεμος: κλίμακα Bft δεξιά */
  [[0,0],[11,4],[28,7]].forEach(function(b){ if(b[0]>wmaxKn) return; svg.appendChild(s('line',{x1:Lm,x2:W-R,y1:YW(b[0]),y2:YW(b[0]),class:'gl'})); tx(W-R+4,YW(b[0])+3.5,String(b[1])); });
  tx(Lm,wT-4,'Bft','axh wk');
  /* ετικέτες χρόνου */
  pts.forEach(function(q,i){ var lt=loc(q.t), hr=+lt.slice(11,13);
    if(hr===0&&i>0) svg.appendChild(s('line',{x1:X(i),x2:X(i),y1:pT,y2:mT+mH,class:'dl'}));
    if(rk==='d1'){ if(hr%6===0) tx(X(i),H-3,B.pad(hr),'dt','middle'); }
    else if(hr===12) tx(X(i),H-3,rk==='d3'?B.dayName(lt.slice(0,10),td):B.DAYS3[new Date(lt.slice(0,10)+'T12:00:00Z').getUTCDay()],'dt','middle'); });
  /* πίεση: συνεχής για το παρελθόν, διακεκομμένη για την πρόγνωση */
  var path=function(a,b,fy,cls){ var dd=''; for(var i=a;i<=b;i++){ var yv=fy(pts[i]); if(yv==null) continue; dd+=(dd?' L':'M')+X(i).toFixed(1)+','+yv.toFixed(1); } if(dd) svg.appendChild(s('path',{d:dd,class:cls})); };
  var ni=Math.max(0,nowI);
  path(0,ni,function(q){ return Y(q.p); },'pl'); path(ni,n-1,function(q){ return Y(q.p); },'pl fut');
  /* ψηλότερο και χαμηλότερο σημείο */
  var iHi=0,iLo=0; pts.forEach(function(q,i){ if(q.p>pts[iHi].p) iHi=i; if(q.p<pts[iLo].p) iLo=i; });
  tx(X(iHi),Y(pts[iHi].p)-6,'▲','hl','middle'); tx(X(iLo),Y(pts[iLo].p)+12,'▼','hl','middle');
  /* άνεμος: γραμμή με γέμισμα, ριπές με τελείες, βέλη κατεύθυνσης */
  var wd='M'+X(0)+','+YW(0); pts.forEach(function(q,i){ if(q.w!=null) wd+=' L'+X(i).toFixed(1)+','+YW(q.w).toFixed(1); }); wd+=' L'+X(n-1)+','+YW(0)+' Z';
  svg.appendChild(s('path',{d:wd,class:'wa'}));
  path(0,ni,function(q){ return q.w==null?null:YW(q.w); },'wl'); path(ni,n-1,function(q){ return q.w==null?null:YW(q.w); },'wl fut');
  path(0,n-1,function(q){ return q.g==null?null:YW(q.g); },'gl2');
  var every=Math.max(1,Math.round(n/18));
  pts.forEach(function(q,i){ if(i%every||q.d==null) return; var a=s('text',{x:X(i),y:wT+wH+14,class:'arr','text-anchor':'middle',transform:'rotate('+((q.d+180)%360)+' '+X(i).toFixed(1)+' '+(wT+wH+10)+')'}); a.textContent='↑'; svg.appendChild(a); });
  /* σελήνη */
  var per=[], hasM=PF.moonAlt&&PF.solunarPeriods, t0=pts[0].t, t1=pts[n-1].t, Xt=function(ms){ return Lm+(W-Lm-R)*(ms-t0)/(t1-t0); };
  if(hasM){
    tx(Lm,mT-4,T('σελήνη','moon'),'axh mk');
    svg.appendChild(s('line',{x1:Lm,x2:W-R,y1:mT+mH,y2:mT+mH,class:'gl'}));
    try{ per=PF.solunarPeriods(t0,t1,+p.lat,+p.lon); }catch(e){ per=[]; }
    per.forEach(function(q){ var a=Math.max(Lm,Xt(q.s)), b=Math.min(W-R,Xt(q.e)); if(b-a<0.5) return; svg.appendChild(s('rect',{x:a,y:mT,width:b-a,height:mH,rx:2,class:q.kind==='major'?'mp maj':'mp'})); });
    var steps=Math.min(240,n*2), dm='', on=false;
    for(var k=0;k<=steps;k++){ var ms=t0+(t1-t0)*k/steps, al=PF.moonAlt(ms,+p.lat,+p.lon), xx=Xt(ms).toFixed(1);
      if(al>0){ var yy=(mT+mH-mH*Math.min(1,al/90)).toFixed(1); dm+=(on?'L':'M'+xx+' '+(mT+mH)+' L')+xx+' '+yy+' '; on=true; } else if(on){ dm+='L'+xx+' '+(mT+mH)+' '; on=false; } }
    if(on) dm+='L'+Xt(t1).toFixed(1)+' '+(mT+mH);
    if(dm) svg.appendChild(s('path',{d:dm,class:'ma'}));
  }
  /* τώρα και επιλεγμένη ώρα */
  if(nowI>=0){ svg.appendChild(s('line',{x1:X(nowI),x2:X(nowI),y1:pT,y2:mT+mH,class:'now'})); svg.appendChild(s('circle',{cx:X(nowI),cy:Y(pts[nowI].p),r:3.5,class:'nd'})); }
  /* επιλεγμένη ώρα: γραμμή και σημεία που μετακινούνται με το δάχτυλο */
  var sl=s('line',{y1:pT,y2:mT+mH,class:'sel',visibility:'hidden'}), sd=s('circle',{r:4.5,class:'dot',visibility:'hidden'}), sw=s('circle',{r:4,class:'dot w',visibility:'hidden'});
  svg.append(sl,sd,sw);
  /* κείμενα */
  var moonAt=function(ms){ var b=null; per.forEach(function(q){ if(ms>=q.s&&ms<=q.e&&(!b||q.kind==='major')) b=q; }); return b; };
  var mLbl=function(q){ return (q.kind==='major'?T('κύρια περίοδος','major period'):T('δευτερεύουσα περίοδος','minor period'))+' ('+(q.ev==='upper'?T('σελήνη από πάνω','moon overhead'):q.ev==='lower'?T('σελήνη από κάτω','moon underfoot'):q.ev==='rise'?T('ανατολή σελήνης','moonrise'):T('δύση σελήνης','moonset'))+')'; };
  var rd=h('p',{class:'hline'});
  function setSel(ri,show){
    ri=Math.max(0,Math.min(n-1,ri)); var q=pts[ri], lt=loc(q.t), d3=ri>=3?q.p-pts[ri-3].p:null;
    if(show){ st.pwi=ri; [sl,sd,sw].forEach(function(e){ e.setAttribute('visibility','visible'); }); sl.setAttribute('x1',X(ri)); sl.setAttribute('x2',X(ri)); sd.setAttribute('cx',X(ri)); sd.setAttribute('cy',Y(q.p));
      if(q.w!=null){ sw.setAttribute('cx',X(ri)); sw.setAttribute('cy',YW(q.w)); } else sw.setAttribute('visibility','hidden'); }
    var bits=[(lt.slice(0,10)!==td?B.dayName(lt.slice(0,10),td)+' ':'')+lt.slice(11,16)+(ri>nowI?' ('+T('πρόγνωση','forecast')+')':ri<nowI?' ('+T('πριν','past')+')':' ('+T('τώρα','now')+')'),U.press(q.p)];
    if(d3!=null) bits.push(T('τάση ','trend ')+(d3>0?'+':'')+B.num(d3,1)+T(' /3ω',' /3h'));
    if(q.w!=null) bits.push(T('άνεμος ','wind ')+U.wind(q.w)+(q.d!=null?' '+dirTxt(q.d):'')+(q.g!=null?', '+T('ριπές ','gusts ')+U.wind(q.g):''));
    var mq=moonAt(q.t+1800000); if(mq) bits.push(mLbl(mq));
    rd.textContent=bits.join(' · ');
  }
  scrub(svg,function(fx){ var x=fx*W; setSel(Math.round((x-Lm)/((W-Lm-R)/(n-1))),true); });
  if(st.pwi!=null&&st.pwi<n) setSel(st.pwi,true); else setSel(Math.max(0,nowI),false);
  var out=[svg,rd];
  /* πώς αλλάζει η πίεση στις επόμενες 24 ώρες */
  if(nowI>=0&&nowI+24<n){ var dp=pts[nowI+24].p-pts[nowI].p, tt=Math.abs(dp)<1?T('Σταθερή πίεση τις επόμενες 24 ώρες','Steady pressure over the next 24 hours'):(dp>0?T('Ανεβαίνει ','Rising ')+Math.round(dp)+T(' hPa τις επόμενες 24 ώρες',' hPa over the next 24 hours'):T('Πέφτει ','Falling ')+Math.round(-dp)+T(' hPa τις επόμενες 24 ώρες',' hPa over the next 24 hours'));
    var past=nowI>=24?pts[nowI].p-pts[nowI-24].p:null;
    out.push(h('p',{class:'sub',style:{margin:'6px 0 0'},text:tt+(past!=null&&Math.abs(past)>=1?T(' (τις τελευταίες 24 ώρες ',' (last 24 hours ')+(past>0?'+':'')+Math.round(past)+' hPa)':'')+(dp<=-4?T('. Συνήθως έρχεται αλλαγή καιρού.','. A change in the weather usually follows.'):'.')})); }
  if(hasM&&per.length){
    var now=Date.now(), ph=PF.moonPhase(now), up=per.filter(function(x){ return x.e>=now; }).slice(0,4), days=fc.days||[];
    var hmm=function(ms){ return loc(ms).slice(11,16); };
    var twN=function(x){ var ds=loc(x.t).slice(0,10), dy=days.filter(function(z){ return z.date===ds; })[0]; if(!dy) return false; var m=(Date.parse(loc(x.t).slice(0,16)+':00Z')-Date.parse(ds+'T00:00:00Z'))/60000; return Math.abs(m-dy.rise)<=90||Math.abs(m-dy.set)<=90; };
    var parts=up.map(function(x){ var ds=loc(x.s).slice(0,10); return (ds!==td?B.dayName(ds,td).toLowerCase()+' ':'')+hmm(x.s)+'–'+hmm(x.e)+' '+(x.kind==='major'?T('κύρια','major'):T('δευτερεύουσα','minor'))+(twN(x)?' ★':''); });
    var cur=moonAt(now);
    out.push(h('p',{class:'sub',style:{margin:'6px 0 0'},text:T('Σελήνη ','Moon ')+Math.round(ph.illum*100)+'%'+(ph.illum<0.1||ph.illum>0.9?T(' (κοντά σε νέα σελήνη ή πανσέληνο)',' (near new or full moon)'):'')+'. '+(cur?T('Τώρα: ','Now: ')+mLbl(cur)+'. ':'')+T('Επόμενες: ','Next: ')+parts.join(', ')+'.'+(parts.some(function(x){ return /★/.test(x); })?T(' ★ = μαζί με αυγή ή σούρουπο.',' ★ = together with dawn or dusk.'):'')}));
  }
  out.push(h('div',{class:'pwl'},h('span',{class:'k1',text:T('Πίεση','Pressure')}),h('span',{class:'k2',text:T('Άνεμος, ριπές','Wind, gusts')}),hasM?h('span',{class:'k3',text:T('Σελήνη','Moon')}):null),
    h('p',{class:'foot',style:{margin:'8px 0 0'},text:T('Συνεχής γραμμή: τελευταίες 24 ώρες. Διακεκομμένη: πρόγνωση. Τα βέλη δείχνουν προς πού φυσά ο άνεμος. Σύρε το δάχτυλο πάνω στο γράφημα για κάθε ώρα.','Solid line: last 24 hours. Dashed: forecast. Arrows show where the wind blows to. Drag across the chart to see each hour.')}));
  body.replaceChildren.apply(body,out);
}
/* σύντομος λόγος για μη ασφαλή μέρα: το πιο σοβαρό */
function shortWhy(d){ var w=d.wx||{}, L=LIM();
  if(w.code!=null&&w.code>=95) return T('καταιγίδα','storm');
  if(w.waveMax!=null&&w.waveMax>L.wave&&B.prof()!=='lake') return T('κύμα ','waves ')+U.wave(w.waveMax);
  if(w.windMax!=null&&w.windMax>L.wind) return T('άνεμος ','wind ')+U.wind(w.windMax);
  if(w.gustMax!=null&&w.gustMax>L.gust) return T('ριπές ','gusts ')+U.wind(w.gustMax);
  return T('πάνω από τα όρια','over your limits'); }
/* ---------- 7 ημέρες ---------- */
function week(page,fc){
  var all=[]; (fc.days||[]).forEach(function(d){ (d.hours||[]).forEach(function(q){ all.push(q.score); }); });
  var wlo=Math.max(0,Math.min.apply(null,all.concat([50]))-4), whi=Math.min(100,Math.max.apply(null,all.concat([60]))+4);
  var td=today(), list=h('div',{class:'list week'});
  (fc.days||[]).forEach(function(d){
    var lv=d.safe?lvl(d.best):'poor';
    var b=h('button',{class:'li wk lv-'+lv,type:'button',onclick:function(){ st.view='day'; st.day=d.date; st.hour=null; draw(); try{ window.scrollTo(0,0); }catch(e){} }});
    b.append(h('div',{class:'wd'},h('b',{text:B.dayName(d.date,td)}),h('small',{text:B.dateShort(d.date)})));
    b.append(h('div',{class:'wc'},curve(d,{w:120,h:34,mini:true,lo:wlo,hi:whi})));
    var info=h('div',{class:'wi'});
    if(d.safe){ info.append(h('b',{class:'ws',text:String(d.best)}),h('small',{text:win(d)})); }
    else info.append(h('b',{class:'ws no',text:'—'}),h('small',{text:d.why==='night'?T('χωρίς φως','no light'):shortWhy(d)}));
    b.append(info,B.icon('chev'));
    list.append(b);
  });
  page.append(list);
  var best=(fc.days||[]).filter(function(d){ return d.safe; }).sort(function(a,b){ return b.best-a.best; })[0];
  if(best) page.append(h('p',{class:'foot',text:T('Η καλύτερη μέρα της εβδομάδας: ','Best day this week: ')+B.dayName(best.date,td).toLowerCase()+', '+win(best)+'.'}));
}

/* ---------- επιλογή τοποθεσίας ---------- */
function placeSheet(){
  var body=h('div'), cur=current(), sh;
  var q=h('input',{type:'search',placeholder:T('Αναζήτηση, π.χ. Λεμεσός','Search, e.g. Limassol'),'aria-label':T('Αναζήτηση τοποθεσίας','Search for a place'),enterkeyhint:'search',autocomplete:'off'});
  var res=h('div');
  body.append(h('div',{class:'search'},B.icon('search'),q),res);
  var tm=0; q.addEventListener('input',function(){ clearTimeout(tm); var v=q.value.trim(); if(v.length<2){ res.replaceChildren(); return; } tm=setTimeout(function(){ geo(v); },350); });
  function geo(v){
    res.replaceChildren(h('p',{class:'sub',style:{margin:'10px 4px'},text:T('Αναζήτηση…','Searching…')}));
    fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(v)+'&count=20&format=json&language='+(EN?'en':'el')).then(function(r){ return r.json(); }).then(function(j){
      if(q.value.trim()!==v) return; var a=(j&&j.results)||[];
      /* πρώτα τα πιο κοντινά σε σένα (θέση GPS ή η τοποθεσία που βλέπεις) */
      var me=B.lastPos()||(cur&&cur.lat!=null?cur:null)||{lat:35.0,lon:33.2};
      a.forEach(function(x){ var R=Math.PI/180, dl=(x.latitude-me.lat)*R, dn=(x.longitude-me.lon)*R, z=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(me.lat*R)*Math.cos(x.latitude*R)*Math.sin(dn/2)*Math.sin(dn/2); x._d=12742*Math.asin(Math.min(1,Math.sqrt(z))); });
      a.sort(function(x,y){ return x._d-y._d; }); a=a.slice(0,8);
      if(!a.length){ res.replaceChildren(h('p',{class:'sub',style:{margin:'10px 4px'},text:T('Δεν βρέθηκε τοποθεσία με αυτό το όνομα.','No place found with that name.')})); return; }
      var l=h('div',{class:'list',style:{marginTop:'8px'}});
      a.forEach(function(x){ var lab=[x.admin1,x.country].filter(Boolean).filter(function(v2,i,aa){ return aa.indexOf(v2)===i&&v2!==x.name; }).join(', ');
        l.append(h('button',{class:'li',type:'button',onclick:function(){ sh.close(); addPlace(x.name,x.latitude,x.longitude); }},h('span',{class:'ic'},B.icon('pin')),h('span',{class:'tx'},h('b',{text:x.name}),h('small',{text:lab+(x._d!=null?' · '+(x._d<10?B.num(x._d,1):Math.round(x._d))+' km':'')})))); });
      res.replaceChildren(l);
    }).catch(function(){ res.replaceChildren(h('p',{class:'sub',style:{margin:'10px 4px'},text:T('Η αναζήτηση χρειάζεται σύνδεση.','Search needs a connection.')})); });
  }
  /* v31z532: νέα τοποθεσία από τον χάρτη (μετακινείς τον χάρτη, το κέντρο είναι το σημείο) ή με συντεταγμένες */
  body.append(h('button',{class:'li pickmap',type:'button',onclick:function(){ sh.close(); setTimeout(mapPick,260); }},h('span',{class:'ic'},B.icon('map')),
    h('span',{class:'tx'},h('b',{text:T('Διάλεξε στον χάρτη','Pick on the map')}),h('small',{text:T('Ή γράψε συντεταγμένες','Or type coordinates')})),B.icon('chev')));
  body.append(h('h3',{class:'listh',text:T('Οι τοποθεσίες σου','Your places')}));
  var l=h('div',{class:'list'});
  allPlaces().forEach(function(p){
    var row=h('div',{class:'li',style:{padding:0}});
    var pick=h('button',{class:'li',type:'button',style:{borderBottom:0,flex:1},onclick:function(){ sh.close(); select(p.id); }},h('span',{class:'ic'},B.icon(p.gps?'gps':'pin')),h('span',{class:'tx'},h('b',{text:p.name}),h('small',{text:p.gps?T('Ακολουθεί το κινητό σου','Follows your phone'):(+p.lat).toFixed(3)+', '+(+p.lon).toFixed(3)})),p.id===cur.id?B.icon('check'):null);
    if(p.id===cur.id) pick.lastChild.setAttribute('class','ck');
    row.append(pick);
    if(!p.gps) row.append(h('button',{class:'del',type:'button','aria-label':T('Διαγραφή ','Delete ')+p.name,html:B.iconSvg('trash'),onclick:function(){ wrap.querySelector('.swbg').click(); }}));
    var wrap=p.gps?row:B.swipeDel(row,function(){ var before=saved(), wasSel=ls.get('psaro-fcsel','gps')===p.id; delPlace(p.id);
      B.toast(T('Η τοποθεσία «','Place “')+p.name+T('» διαγράφηκε.','” deleted.'),5000,{label:T('Αναίρεση','Undo'),fn:function(){ ls.set('psaro-places',before); if(wasSel) select(p.id); if(sh&&sh.el&&sh.el.isConnected) placeSheet(); B.toast(T('Επαναφέρθηκε.','Restored.')); }}); });
    l.append(wrap);
  });
  body.append(l);
  if(saved().length) body.append(h('p',{class:'foot',text:T('Σύρε μια τοποθεσία προς τα αριστερά για διαγραφή.','Swipe a place to the left to delete it.')}));
  var spots=B.records('spots').filter(function(x){ return !x.deleted&&typeof x.lat==='number'&&typeof x.lon==='number'; });
  if(spots.length){
    body.append(h('h3',{class:'listh',text:T('Από τα σημεία σου','From your spots')}));
    var l2=h('div',{class:'list'});
    spots.slice(0,30).forEach(function(x){ l2.append(h('button',{class:'li',type:'button',onclick:function(){ sh.close(); addPlace(x.name||T('Σημείο','Spot'),x.lat,x.lon); }},h('span',{class:'ic'},B.icon('star')),h('span',{class:'tx'},h('b',{text:x.name||T('Σημείο','Spot')}),h('small',{text:x.type||''})))); });
    body.append(l2);
  }
  sh=B.sheet({title:T('Τοποθεσία','Location'),body:body});
}

function mapPick(){
  var c=current(), st0=(c&&c.lat!=null)?c:(B.lastPos()||{lat:34.75,lon:32.42});
  var nm=h('input',{type:'text',maxlength:'40',placeholder:T('π.χ. Ξέρα Λατσιού','e.g. Latchi reef'),autocomplete:'off'});
  var cb=B.coordBox(+st0.lat,+st0.lon,{map:true}), err=h('small',{class:'wn'}), sh2;
  var save=h('button',{class:'btn pri full',type:'button',text:T('Αποθήκευση και πρόγνωση','Save and show forecast'),onclick:function(){ var g=cb.get(); if(!g){ err.textContent=T('Οι συντεταγμένες δεν διαβάζονται.','The coordinates cannot be read.'); return; }
    sh2.close(); addPlace(nm.value.trim()||T('Σημείο χάρτη','Map point'),g.lat,g.lon); }});
  sh2=B.sheet({title:T('Τοποθεσία από τον χάρτη','Place from the map'),body:h('div',{class:'bform'},
    h('p',{class:'sub',text:T('Μετακίνησε τον χάρτη· το σημείο είναι στο κέντρο.','Move the map; the point is at the centre.')}),cb.el,
    h('label',{class:'fld'},h('span',{text:T('Όνομα','Name')}),nm),err,save)});
}

/* ---------- σύνδεση με το κέλυφος ---------- */
B.view('forecast',{
  title:T('Πρόγνωση','Forecast'),
  mount:function(el){ root=el; st.view=st.view||'today'; load(false);
    /* η θέση: γρήγορα από την τελευταία γνωστή, μετά ανανέωση στο παρασκήνιο */
    var p=current(); if(p.gps){ var old=B.lastPos(); B.locate(8000).then(function(n){ if(!n) return; if(!old||Math.abs(n.lat-old.lat)+Math.abs(n.lon-old.lon)>0.02) load(true); }); } },
  unmount:function(){ root=null; },
  resume:function(){ if(st.t&&Date.now()-st.t>3600e3) load(true); else draw(); }
});
B.on('fc-redraw',function(){ if(root) draw(); });
B.on('store',function(k){ if(!root) return; if(k==='psaro-fcsel'||k==='psaro-places'||k==='psaro-fprof'||k==='psaro-units'){ if(k==='psaro-units'&&U.reload) U.reload(); load(false); } });
window.addEventListener('online',function(){ if(root) load(true); });
window.addEventListener('offline',function(){ if(root) draw(); });
})();
