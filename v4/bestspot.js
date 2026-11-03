/* Alkyon 1.2.2 · «Καλύτερα σημεία»: πού να πας, από όλα τα δεδομένα μαζί.
   1) Ο server (water-clarity, mode=scan) σαρώνει ένα πλέγμα σημείων γύρω από το κέντρο του χάρτη (ακτίνα ανάλογα με το ζουμ):
      άνεμος, ριπή, κύμα (μέγιστα 06–18), θερμοκρασία επιφάνειας, ρεύμα (Open-Meteo) και χλωροφύλλη (Copernicus, δορυφόρος).
   2) Εδώ προστίθενται: βάθος και κλίση βυθού (EMODnet, ίδιο πλέγμα με τη «Δομή βυθού»), μέτωπα (απότομη αλλαγή χλωροφύλλης / θερμοκρασίας
      ανάμεσα σε γειτονικά σημεία), τα δικά σου ψάρια εκεί, και τα όρια ασφαλείας σου.
   3) Τα 5 καλύτερα, με απόσταση μεταξύ τους, εμφανίζονται στον χάρτη με αριθμό και εξήγηση.
   Ενδεικτικό: συνδυάζει γνωστές ενδείξεις (μέτωπα, τροφή, δομή βυθού, ήρεμη θάλασσα). Δεν είναι εγγύηση ότι υπάρχει ψάρι. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var FN='https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/water-clarity', SK='sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA';
var grp=null, last=null, busy=false, dayIx=null, active=false, hooked=null, mvT=0, lastC=null, pill=null, lastRes=null;
function M(){ return window.AlkyonCore&&window.AlkyonCore.map&&window.AlkyonCore.map(); }
function km(a,b,c,d){ var R=6371, r=Math.PI/180, dl=(c-a)*r, dn=(d-b)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.min(1,Math.sqrt(x))); }
function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }
function pct(arr){ var s=arr.filter(function(v){ return v!=null&&isFinite(v); }).sort(function(a,b){ return a-b; }); return function(v){ if(v==null||!s.length) return 0; var i=0; while(i<s.length&&s[i]<v) i++; return s.length>1?i/(s.length-1):0.5; }; }
function lims(){ var PF=window.PF; try{ return PF&&PF.lims?PF.lims():{wind:14,wave:0.9,gust:24}; }catch(e){ return {wind:14,wave:0.9,gust:24}; } }
function bites(){ try{ return B.store.raw('bites').filter(function(b){ return !b.deleted&&!b.miss&&b.lat!=null&&!(B.pest&&B.pest(b)); }); }catch(e){ return []; } }
function loadBathy(){ return window.AlkyonBathy?Promise.resolve():new Promise(function(res){ var s=document.createElement('script'); s.src='../bathy-lines.js'; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }

/* βυθός για όλη την περιοχή (ένα πλέγμα): βάθος και η μεγαλύτερη κλίση σε ~600 m γύρω από κάθε σημείο */
function seabed(bb){
  return loadBathy().then(function(){ if(!window.AlkyonBathy||!B.seabed||!B.seabed.analyze) return null;
    var res=Math.max(1/960,(bb.e-bb.w)/170); return window.AlkyonBathy.fetchGrid(bb,res).then(function(g){ return {g:g,a:B.seabed.analyze(g)}; }); }).catch(function(){ return null; }); }
function bedAt(sb,lat,lon){ if(!sb) return null; var g=sb.g, x=Math.floor((lon-g.x0)/g.dx), y=Math.floor((lat-g.y0)/g.dy); if(x<1||y<1||x>=g.w-1||y>=g.h-1) return null;
  var dpt=g.data[y*g.w+x]; if(!(dpt>0)) return {land:true};
  var cell=Math.abs(g.dy)*111, R=Math.max(1,Math.ceil(0.6/cell)), mx=0;
  for(var dy=-R;dy<=R;dy++) for(var dx=-R;dx<=R;dx++){ var xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=g.w||yy>=g.h) continue; var s=sb.a.S[yy*g.w+xx]; if(s>mx) mx=s; }
  return {depth:dpt,slope:mx}; }

/* 1.2.7: μέγιστο βάθος ανά τρόπο ψαρέματος (πάνω από αυτό το σημείο δεν προτείνεται): βάρκα 300 m, ψαροντούφεκο 30 m, ακτή 50 m */
/* 1.2.8: πόσο μακριά πας με τη βάρκα από εκεί που είσαι (ρύθμιση, 30 km). Χωρίς θέση GPS μετράει από το κέντρο του χάρτη. */
function range(){ var v=+ls.get('alkyon-v4-boatrange',30); return v>0?v:30; }
function home(c){ var g=null; try{ g=B.lastPos?B.lastPos():null; }catch(e){} return g&&g.lat!=null?{lat:+g.lat,lon:+g.lon,gps:true}:{lat:c.lat,lon:c.lon,gps:false}; }
function maxDepth(){ var pr=B.prof?B.prof():'boat'; return pr==='spear'?30:pr==='shore'?50:300; }
/* πιθανά ψάρια: βάθος, βυθός (δομή = κλίση / ύφαλος, επίπεδος = άμμος), θερμοκρασία νερού, εποχή, ανοιχτή θάλασσα (μέτωπα).
   Ενδεικτικά όρια για Κύπρο / ανατολική Μεσόγειο. Τα δικά σου ψάρια στο σημείο μετράνε περισσότερο από όλα. */
var SPP=[
 {el:'Συναγρίδα',en:'Common dentex',d:[15,120],b:'rock',t:[15,27]},
 {el:'Φαγκρί',en:'Red porgy',d:[20,150],b:'rock',t:[15,26]},
 {el:'Λιθρίνι',en:'Common pandora',d:[15,120],b:'sand',t:[15,27]},
 {el:'Σφυρίδα',en:'Dusky grouper',d:[10,150],b:'rock',t:[15,28]},
 {el:'Μαγιάτικο',en:'Amberjack',d:[20,200],b:'rock',t:[18,29],m:[6,11],cur:1},
 {el:'Λαβράκι',en:'Sea bass',d:[0,20],b:'any',t:[12,24],m:[10,4]},
 {el:'Τσιπούρα',en:'Gilthead seabream',d:[2,30],b:'sand',t:[13,26],m:[9,3]},
 {el:'Σαργός',en:'White seabream',d:[0,30],b:'rock',t:[13,28]},
 {el:'Λούτσος',en:'Barracuda',d:[5,60],b:'any',t:[19,30],m:[5,11]},
 {el:'Παλαμίδα',en:'Atlantic bonito',d:[20,300],b:'open',t:[16,25],m:[9,2]},
 {el:'Κυνηγός',en:'Mahi-mahi',d:[60,300],b:'open',t:[22,30],m:[8,11]},
 {el:'Καλαμάρι',en:'Squid',d:[10,100],b:'any',t:[14,24],m:[10,3]}];
function inMonth(m,r){ return !r||(r[0]<=r[1]?m>=r[0]&&m<=r[1]:m>=r[0]||m<=r[1]); }
function fishFor(a,date){ var p=a.p, bed=a.bed, mo=+(date||'').slice(5,7)||new Date().getMonth()+1, out=[];
  var own={}; bites().forEach(function(b){ if(b.species&&km(b.lat,b.lon,p.la,p.lo)<1.5){ var n=window.spName?window.spName(b.species):b.species; own[n]=(own[n]||0)+1; } });
  Object.keys(own).sort(function(x,y){ return own[y]-own[x]; }).slice(0,2).forEach(function(n){ out.push({n:n,s:100,own:own[n]}); });
  SPP.forEach(function(f){ var nm=EN?f.en:f.el; if(out.some(function(o){ return o.n===nm; })) return; var sc=0;
    if(a.deep){ if(f.b!=='open') return; sc+=20; } else if(bed&&bed.depth!=null){ if(bed.depth<f.d[0]-5||bed.depth>f.d[1]+20) return; sc+=30; } else sc+=10;
    if(!inMonth(mo,f.m)) return; sc+=f.m?15:5;
    if(p.sst!=null){ if(p.sst<f.t[0]-1||p.sst>f.t[1]+1) return; sc+=15; }
    var slope=bed?bed.slope:0;
    if(f.b==='rock') sc+=slope>=12?25:slope>=5?15:0; else if(f.b==='sand') sc+=bed&&slope<5?20:0; else if(f.b==='open') sc+=(a.gc>0.02?15:0)+(a.gs>0.1?10:0)+(bed&&bed.depth>=80?10:0); else sc+=8;
    if(f.cur&&p.ck!=null&&p.ck>=0.2) sc+=8;
    if(sc>=45) out.push({n:nm,s:sc}); });
  out.sort(function(x,y){ return y.s-x.s; }); return out.slice(0,3); }
/* 1.2.9: ψάρεμα από ακτή: τα σημεία είναι πάνω στην ακτογραμμή (κελί θάλασσας του βυθού δίπλα σε στεριά, ανά ~800 m), στην απόσταση της ρίψης.
   Οι συνθήκες (κύμα, άνεμος, νερό, τροφή) από το κοντινότερο σημείο της σάρωσης· ο βυθός (βάθος και κλίση στα πρώτα ~200 m) από το EMODnet. */
function shoreScore(data,sb,di,center){
  var L=lims(), bs=bites(), hm=home(center), rg=range(), unsafe=0, far=0, sp=data.sp||4, g=sb&&sb.g, S=sb&&sb.a&&sb.a.S, pts=[];
  if(!g||!S) return {top:[],n:0,unsafe:0,far:0,rg:rg,boat:false,shore:true,gps:hm.gps,hasBed:false,hasChl:false};
  /* μέτωπα στα σημεία της σάρωσης (όπως στη βάρκα) */
  var sc=data.pts.filter(function(p){ return p.d&&p.d[di]&&p.d[di].w!=null; });
  sc.forEach(function(a){ var gc=0, gs=0; sc.forEach(function(b){ if(a===b) return; var k=km(a.la,a.lo,b.la,b.lo); if(k>sp*1.6||k<0.1) return;
    if(a.chl>0&&b.chl>0){ var v=Math.abs(Math.log(a.chl)/Math.LN10-Math.log(b.chl)/Math.LN10)/k; if(v>gc) gc=v; }
    if(a.sst!=null&&b.sst!=null){ var w=Math.abs(a.sst-b.sst)/k; if(w>gs) gs=w; } }); a._gc=gc; a._gs=gs; });
  if(!sc.length) return {top:[],n:0,unsafe:0,far:0,rg:rg,boat:false,shore:true,gps:hm.gps,hasBed:true,hasChl:false};
  var cell=Math.abs(g.dy)*111, st=Math.max(1,Math.round(0.8/cell)), D=function(x,y){ return (x<0||y<0||x>=g.w||y>=g.h)?NaN:g.data[y*g.w+x]; };
  for(var y=1;y<g.h-1;y+=st) for(var x=1;x<g.w-1;x+=st){
    /* το κοντινότερο κελί ακτής μέσα στο τετράγωνο του βήματος */
    var best=null; for(var yy=y;yy<Math.min(g.h-1,y+st);yy++) for(var xx=x;xx<Math.min(g.w-1,x+st);xx++){ var dv=D(xx,yy); if(!(dv>0)) continue;
      if(D(xx-1,yy)>0&&D(xx+1,yy)>0&&D(xx,yy-1)>0&&D(xx,yy+1)>0) continue; best=[xx,yy]; break; }
    if(!best) continue;
    var la=g.y0+g.dy*(best[1]+0.5), lo=g.x0+g.dx*(best[0]+0.5);
    /* βάθος και κλίση στη ζώνη της ρίψης (~200 m προς τη θάλασσα) */
    var R2=Math.max(1,Math.round(0.2/cell)), dep=0, slope=0;
    for(var dy=-R2;dy<=R2;dy++) for(var dx=-R2;dx<=R2;dx++){ var v2=D(best[0]+dx,best[1]+dy); if(v2>dep) dep=v2; var s2=S[(best[1]+dy)*g.w+(best[0]+dx)]; if(s2>slope) slope=s2; }
    if(dep>maxDepth()) dep=maxDepth();
    if(km(hm.lat,hm.lon,la,lo)>rg){ far++; continue; }
    var near=null, nd=1e9; sc.forEach(function(p){ var k=km(la,lo,p.la,p.lo); if(k<nd){ nd=k; near=p; } }); if(!near) continue;
    var d=near.d[di]; if(d.w>L.wind||(d.v!=null&&d.v>L.wave)||(d.g!=null&&L.gust&&d.g>L.gust)){ unsafe++; continue; }
    pts.push({p:{la:la,lo:lo,sst:near.sst,chl:near.chl,ck:near.ck,cd:near.cd},d:d,bed:{depth:dep,slope:slope},gc:near._gc,gs:near._gs,deep:false}); }
  var pGc=pct(pts.map(function(x){ return x.gc; })), pGs=pct(pts.map(function(x){ return x.gs; }));
  pts.forEach(function(a){ var p=a.p, d=a.d, why=[], s=0, part, bed=a.bed;
    part=25*clamp(1-(d.v||0)/Math.max(0.3,L.wave),0,1); s+=part; if(part>=15) why.push([part,T('ήρεμο νερό στην ακτή','calm water at the shore')+' ('+B.num(d.v||0,1)+' m, '+Math.round(d.w)+' kn)']);
    part=bed.slope>=12?20:bed.slope>=5?12:0; s+=part; if(part>=12) why.push([part,(bed.slope>=12?T('βράχια με απότομο βυθό κοντά','rocks with a steep drop close in'):T('κλίση βυθού κοντά στην ακτή','sloping seabed close in'))+' · '+Math.round(bed.depth)+' m']);
    part=bed.depth>=3&&bed.depth<=25?15:bed.depth>25?8:4; s+=part; if(part>=15&&bed.slope<5) why.push([part,T('καλό βάθος στη ρίψη ','good depth in casting range ')+Math.round(bed.depth)+' m']);
    part=a.gc>0.02?15*pGc(a.gc):0; s+=part; if(part>=9) why.push([part,T('μέτωπο χλωροφύλλης κοντά: τροφή','chlorophyll front nearby: food')]);
    part=a.gs>=0.1?10*pGs(a.gs):0; s+=part; if(part>=6) why.push([part,T('θερμικό μέτωπο κοντά','thermal front nearby')]);
    var n=bs.filter(function(b){ return km(b.lat,b.lon,p.la,p.lo)<0.7; }).length; part=Math.min(15,5*n); s+=part; if(n) why.push([part+5,T('εδώ έχεις πιάσει ','you’ve caught here ')+n+(n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish'))]);
    var dk=km(hm.lat,hm.lon,p.la,p.lo); s-=Math.min(6,dk/6);
    a.score=Math.round(clamp(s,0,100)); a.dk=dk; a.why=why.sort(function(x,y){ return y[0]-x[0]; }).slice(0,3).map(function(x){ return x[1]; }); });
  pts.sort(function(x,y){ return y.score-x.score; });
  pts.slice(0,25).forEach(function(a){ a.fish=fishFor(a,a.d.date); });
  var top=[]; pts.forEach(function(a){ if(top.length<5&&!top.some(function(t){ return km(t.p.la,t.p.lo,a.p.la,a.p.lo)<1.5; })) top.push(a); });
  return {top:top,n:pts.length,unsafe:unsafe,far:far,rg:rg,boat:false,shore:true,gps:hm.gps,hasBed:true,hasChl:data.pts.some(function(p){ return p.chl>0; })};
}
function score(data,sb,di,center){
  if((B.prof?B.prof():'boat')==='shore') return shoreScore(data,sb,di,center);
  var L=lims(), X=window.AlkyonExposure, bs=bites(), pts=[], unsafe=0, far=0, sp=data.sp||4, boat=(B.prof?B.prof():'boat')==='boat', hm=home(center), rg=range();
  data.pts.forEach(function(p){ var d=p.d&&p.d[di]; if(!d||d.w==null) return;
    try{ if(X&&X.isLand&&X.isLand(p.la,p.lo)===1) return; }catch(e){}
    var bed=bedAt(sb,p.la,p.lo); if(bed&&bed.land) return;
    /* 1.2.7: όχι σημεία πολύ βαθιά για ψάρεμα βυθού. 1.2.8: με βάρκα, τα βαθιά νερά μένουν μόνο για τρόλινγκ (πελαγικά, από μέτωπα) */
    var deep=!!(bed&&bed.depth>maxDepth()); if(deep&&!boat) return;
    if(boat&&km(hm.lat,hm.lon,p.la,p.lo)>rg){ far++; return; }
    if(d.w>L.wind||(d.v!=null&&d.v>L.wave)||(d.g!=null&&L.gust&&d.g>L.gust)){ unsafe++; return; }
    pts.push({p:p,d:d,bed:bed,deep:deep}); });
  /* μέτωπα: η μεγαλύτερη αλλαγή ανά km προς τους γείτονες */
  pts.forEach(function(a){ var gc=0, gs=0; pts.forEach(function(b){ if(a===b) return; var k=km(a.p.la,a.p.lo,b.p.la,b.p.lo); if(k>sp*1.6||k<0.1) return;
      if(a.p.chl>0&&b.p.chl>0){ var v=Math.abs(Math.log(a.p.chl)/Math.LN10-Math.log(b.p.chl)/Math.LN10)/k; if(v>gc) gc=v; }
      if(a.p.sst!=null&&b.p.sst!=null){ var w=Math.abs(a.p.sst-b.p.sst)/k; if(w>gs) gs=w; } });
    a.gc=gc; a.gs=gs; });
  var pGc=pct(pts.map(function(x){ return x.gc; })), pGs=pct(pts.map(function(x){ return x.gs; })), pChl=pct(pts.map(function(x){ return x.p.chl>0?Math.log(x.p.chl):null; }));
  pts.forEach(function(a){ var p=a.p, d=a.d, why=[], s=0, part;
    part=15*clamp(1-Math.max(d.w/L.wind,(d.v||0)/L.wave),0,1); s+=part; if(part>=10) why.push([part,T('ήρεμη θάλασσα','calm sea')+' ('+Math.round(d.w)+' kn, '+B.num(d.v||0,1)+' m)']);
    if(p.chl>0){ part=a.gc>0.02?25*pGc(a.gc):0; s+=part; if(part>=14) why.push([part,T('μέτωπο χλωροφύλλης: εδώ μαζεύεται η τροφή','chlorophyll front: food gathers here')]);
      part=10*pChl(Math.log(p.chl)); s+=part; if(part>=7) why.push([part,T('περισσότερη τροφή από τη γύρω θάλασσα','more food than the sea around')]); }
    part=a.gs>=0.1?15*pGs(a.gs):0; s+=part; if(part>=9) why.push([part,T('θερμικό μέτωπο','thermal front')+' ('+B.num(a.gs,2)+' °C/km)']);
    if(p.ck!=null){ part=p.ck>=0.15&&p.ck<=0.8?8:(p.ck>=0.05&&p.ck<=1.2?4:0); s+=part; if(part>=8) why.push([part,T('ήπιο ρεύμα ','gentle current ')+B.num(p.ck,1)+' kn']); }
    var bed=a.bed; if(bed){ part=bed.depth>200?0:bed.slope>=12?20:bed.slope>=5?10:0; s+=part; if(part>=10) why.push([part,(bed.slope>=12?T('απότομος βυθός (drop-off)','steep seabed (drop-off)'):T('κλίση βυθού','sloping seabed'))+' · '+Math.round(bed.depth)+' m']);
      part=bed.depth>=10&&bed.depth<=150?10:bed.depth>150&&bed.depth<=300?4:bed.depth<10?3:0; s+=part; if(part>=10&&!(bed.slope>=5)) why.push([part,T('βάθος ','depth ')+Math.round(bed.depth)+' m']); }
    var n=bs.filter(function(b){ return km(b.lat,b.lon,p.la,p.lo)<1.5; }).length; part=Math.min(15,5*n); s+=part; if(n) why.push([part+5,T('εδώ έχεις πιάσει ','you’ve caught here ')+n+(n===1?T(' ψάρι',' fish'):T(' ψάρια',' fish'))]);
    if(a.deep) why.push([1,T('ανοιχτά βαθιά νερά: για τρόλινγκ','open deep water: for trolling')]);
    var dk=km(hm.lat,hm.lon,p.la,p.lo); s-=Math.min(8,dk/5);
    a.score=Math.round(clamp(s/1.05,0,100)); a.dk=dk; a.why=why.sort(function(x,y){ return y[0]-x[0]; }).slice(0,3).map(function(x){ return x[1]; }); });
  pts.sort(function(x,y){ return y.score-x.score; });
  pts.slice(0,25).forEach(function(a){ a.fish=fishFor(a,a.d.date); });
  var top=[]; pts.forEach(function(a){ if(top.length<5&&!top.some(function(t){ return km(t.p.la,t.p.lo,a.p.la,a.p.lo)<Math.max(3,sp*0.9); })) top.push(a); });
  return {top:top,n:pts.length,unsafe:unsafe,far:far,rg:rg,boat:boat,gps:hm.gps,hasBed:!!sb,hasChl:data.pts.some(function(p){ return p.chl>0; })};
}

function clear(){ var m=M(); if(grp&&m) m.removeLayer(grp); grp=null; }
function draw(res){ var m=M(); if(!m) return; clear(); grp=L.layerGroup().addTo(m);
  res.top.forEach(function(a,i){ L.marker([a.p.la,a.p.lo],{icon:L.divIcon({className:'mk best',iconSize:null,html:'<i>'+(i+1)+'</i><b>'+a.score+'</b>'})}).on('click',function(){ detail(a,i); }).addTo(grp); }); }
function dayName(ds){ try{ return new Date(ds+'T12:00:00').toLocaleDateString(EN?'en-GB':'el-GR',{weekday:'long',day:'numeric',month:'short'}); }catch(e){ return ds; } }
function detail(a,i){ var p=a.p, d=a.d, body=h('div',null,
    h('p',{class:'sub',text:T('Βαθμός ','Score ')+a.score+' · '+B.num(a.dk,1)+(last&&lastRes&&lastRes.gps?T(' km από σένα',' km from you'):T(' km από το κέντρο',' km from the centre'))}),
    h('ul',{class:'bsw'},a.why.map(function(w){ return h('li',{text:w}); })),
    a.fish&&a.fish.length?h('p',{class:'bsf'},h('b',{text:'🐟 '+T('Πιθανά ψάρια: ','Likely fish: ')}),a.fish.map(function(f){ return f.n+(f.own?T(' (έπιασες εδώ ',' (you caught ')+f.own+')':''); }).join(', ')):null,
    a.bed&&a.bed.depth?h('p',{class:'sub',text:T('Βάθος ~','Depth ~')+Math.round(a.bed.depth)+' m'}):null,
    h('p',{class:'sub',text:[T('Άνεμος έως ','Wind up to ')+Math.round(d.w)+' kn',d.v!=null?T('κύμα έως ','waves up to ')+B.num(d.v,1)+' m':'',p.sst!=null?B.num(p.sst,1)+' °C':'',p.chl>0?T('χλωροφύλλη ','chlorophyll ')+B.num(p.chl,2)+' mg/m³':''].filter(Boolean).join(' · ')}),
    h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Πρόγνωση εδώ','Forecast here'),onclick:function(){ sh.close(); fcAt(p.la,p.lo,T('Πρόταση ','Suggestion ')+(i+1)); }}),
      B.spotFormAt?h('button',{class:'btn',type:'button',text:T('Αποθήκευση σημείου','Save spot'),onclick:function(){ sh.close(); B.spotFormAt(p.la,p.lo); }}):null),
    h('p',{class:'sub',text:T('Ενδεικτικό: συνδυασμός γνωστών ενδείξεων, όχι εγγύηση.','Indicative: a combination of known signs, not a guarantee.')}));
  var sh=B.sheet({title:'#'+(i+1)+' · '+dayName(d.date),body:body}); }
function fcAt(lat,lon,name){ var a=ls.get('alkyon-places',[])||[], id='p'+Math.round(lat*100)+'_'+Math.round(lon*100);
  if(!a.some(function(p){ return p.id===id; })){ a.unshift({id:id,name:name,lat:+lat.toFixed(4),lon:+lon.toFixed(4),watch:false,map:1}); ls.set('alkyon-places',a.slice(0,10)); }
  ls.set('alkyon-fcsel',id); location.hash='#forecast'; }

function summary(res,data){ var body=h('div',{class:'opps'}), list=h('div',{class:'opl'});   /* ίδια εμφάνιση με τη λίστα «Πού να πάω» */
  var seg=B.seg([['0',T('Σήμερα','Today')],['1',T('Αύριο','Tomorrow')]],String(dayIx),function(v){ dayIx=+v; sh.close(); show(); },T('Μέρα','Day'));
  body.append(seg);
  if(res.boat||res.shore) body.append(B.seg([['10','10 km'],['20','20 km'],['30','30 km'],['50','50 km']],String(range()),function(v){ ls.set('alkyon-v4-boatrange',+v); sh.close(); show(); },T('Πόσο μακριά πας','How far you go')),
    h('p',{class:'sub',text:(res.shore?T('Πόσο μακριά πας με το αυτοκίνητο ','How far you drive '):T('Πόσο μακριά πας με τη βάρκα ','How far you go by boat '))+(res.gps?T('(από τη θέση σου)','(from your position)'):T('(από το κέντρο του χάρτη)','(from the map centre)'))}));
  if(res.shore&&!res.hasBed) body.append(h('p',{class:'sub',text:T('Για ψάρεμα από ακτή χρειάζεται ο βυθός (EMODnet). Δεν φορτώθηκε: έλεγξε τη σύνδεση και ξαναδοκίμασε.','Shore fishing needs the seabed (EMODnet). It did not load: check the connection and try again.')}));
  if(!res.top.length) body.append(h('p',{class:'sub',text:res.unsafe?T('Όλα τα σημεία εδώ είναι πάνω από τα όρια ασφαλείας σου αυτή τη μέρα.','All spots here are over your safety limits that day.'):T('Δεν βρέθηκαν σημεία θάλασσας εδώ. Μετακίνησε τον χάρτη πάνω από θάλασσα.','No sea points found here. Move the map over the sea.')}));
  body.append(list);
  res.top.forEach(function(a,i){ list.append(h('button',{type:'button',class:'opr',onclick:function(){ sh.close(); var m=M(); if(m) m.setView([a.p.la,a.p.lo],Math.max(m.getZoom(),12)); detail(a,i); }},
    h('span',{class:'ops '+(a.score>=70?'hi':a.score>=50?'mid':'lo'),text:String(a.score)}),h('span',{class:'opt'},h('b',{text:'#'+(i+1)+' · '+B.num(a.dk,1)+' km'}),h('small',{text:(a.why.join(' · ')||T('Καλές συνθήκες','Good conditions'))+(a.fish&&a.fish.length?' · 🐟 '+a.fish.map(function(f){ return f.n; }).join(', '):'')+(a.bed&&a.bed.depth?' · '+Math.round(a.bed.depth)+' m':'')})),B.icon?B.icon('chev'):null)); });
  var notes=[]; if(!res.hasChl) notes.push(T('χωρίς χλωροφύλλη (δεν υπάρχει δορυφορική εικόνα εδώ)','no chlorophyll (no satellite image here)')); if(!res.hasBed) notes.push(T('χωρίς βυθό (χρειάζεται σύνδεση)','no seabed (needs a connection)'));
  body.append(h('p',{class:'sub',text:T('Έλεγξα ','Checked ')+res.n+(res.shore?T(' σημεία ακτής σε ακτίνα ',' shore points within '):T(' σημεία θάλασσας σε ακτίνα ',' sea points within '))+data.r+' km'+(res.unsafe?T(' · ',' · ')+res.unsafe+T(' πάνω από τα όρια ασφαλείας σου',' over your safety limits'):'')+(res.far?' · '+res.far+T(' πιο μακριά από ',' further than ')+res.rg+' km':'')+(notes.length?' · '+notes.join(' · '):'')+'.'}),
    h('p',{class:'sub',text:T('Από: καιρό και κύμα (Open-Meteo), χλωροφύλλη (Copernicus, δορυφόρος ','From: weather and waves (Open-Meteo), chlorophyll (Copernicus satellite ')+(data.chlDay||'')+T('), θερμοκρασία και ρεύματα, βυθό (EMODnet), τα ψάρια σου.','), temperature and currents, seabed (EMODnet), your catches.')}),
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',text:T('Ψάξε εδώ ξανά','Search here again'),onclick:function(){ sh.close(); run(true); }}),h('button',{class:'btn',type:'button',text:T('Κλείσιμο προτάσεων','Hide suggestions'),onclick:function(){ sh.close(); set(false); }})));
  var sh=B.sheet({title:T('Καλύτερα σημεία','Best spots'),body:body}); }
function show(quiet){ if(!last) return; var res=score(last.data,last.sb,dayIx,last.c); lastRes=res; draw(res); paintPill(res); if(!quiet) summary(res,last.data); }
/* 1.2.6: μικρό κουμπί στον χάρτη όσο είναι ανοιχτό: πόσα σημεία, και πάτημα για τη λίστα */
function paintPill(res){ if(!active){ if(pill) pill.hidden=true; return; }
  if(!pill){ pill=h('button',{type:'button',class:'bsPill',onclick:function(){ if(last&&lastRes) summary(lastRes,last.data); }}); document.body.append(pill); }
  pill.hidden=false; pill.textContent=busy?'🎯 '+T('Ψάχνω…','Searching…'):'🎯 '+(res&&res.top.length?res.top.length+T(' καλύτερα σημεία · λίστα',' best spots · list'):T('Κανένα σημείο εδώ','No spot here')); }
/* όταν μετακινείς τον χάρτη: νέα αναζήτηση για την περιοχή που βλέπεις (αν πήγες αρκετά μακριά ή άλλαξες ζουμ) */
function hook(){ var m=M(); if(!m||hooked===m) return; hooked=m;
  m.on('moveend',function(){ if(!active) return; clearTimeout(mvT); mvT=setTimeout(function(){ if(!active||!/^#map/.test(location.hash||'')) return; var c=m.getCenter(), z=m.getZoom();
    if(lastC&&z===lastC.z&&km(lastC.lat,lastC.lon,c.lat,c.lng)<lastC.r*0.4) return; run(true,true); },1500); }); }

function run(force,quiet){ var m=M(); if(!m){ return; } if(busy) return; hook();
  var c=m.getCenter(), z=m.getZoom(), r=z>=12?10:z>=11?15:z>=10?25:z>=9?40:60;
  if(dayIx==null) dayIx=new Date().getHours()>=15?1:0;
  busy=true; lastC={lat:c.lat,lon:c.lng,r:r,z:z}; if(quiet) paintPill(lastRes); else B.toast(T('Ψάχνω τα καλύτερα σημεία σε ακτίνα ','Searching the best spots within ')+r+' km…',4000);
  var dLa=r/111*1.15, dLo=dLa/Math.cos(c.lat*Math.PI/180), bb={w:c.lng-dLo,e:c.lng+dLo,s:c.lat-dLa,n:c.lat+dLa};
  var url=FN+'?mode=scan&lat='+c.lat.toFixed(3)+'&lon='+c.lng.toFixed(3)+'&r='+r;
  Promise.all([fetch(url,{headers:{apikey:SK,Authorization:'Bearer '+SK}}).then(function(x){ return x.ok?x.json():null; }).catch(function(){ return null; }),seabed(bb)]).then(function(rr){ busy=false; var data=rr[0];
    if(!data||!data.pts){ paintPill(lastRes); if(quiet) return; B.toast(T('Η αναζήτηση δεν έγινε. Χρειάζεται σύνδεση (και η νέα έκδοση της συνάρτησης water-clarity).','The search failed. Needs a connection (and the new water-clarity function).'),7000); return; }
    last={data:data,sb:rr[1],c:{lat:c.lat,lon:c.lng}}; show(quiet); });
}
function isOn(){ return active; }
function set(v){ active=!!v; if(active) run(true); else { clear(); last=null; lastC=null; lastRes=null; paintPill(null); } }
/* από την Πρόγνωση («Πού να πάω»): άνοιγμα του Χάρτη στη θέση και αναζήτηση */
function go(lat,lon){ var first=!/^#map/.test(location.hash||'');
  if(lat!=null&&B.mapGo) B.mapGo(lat,lon,11,null,{lab:T('Κέντρο αναζήτησης','Search centre'),sea:true}); else if(first) location.hash='#map';
  active=true; setTimeout(function(){ run(true); },first?1500:200); }
B.bestSpots={on:isOn,set:set,run:run,go:go,_score:score};
})();
