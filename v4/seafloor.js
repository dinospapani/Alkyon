/* Alkyon 4 · 1.13.8: Ανάγλυφο βυθού και Ζώνη βάθους (ιδέες της Navionics, με τα δικά μας δεδομένα EMODnet)
   - Ανάγλυφο: σκιές από το πλέγμα βάθους (φως από βορειοδυτικά), ώστε πρανή, τρύπες και υψώματα να φαίνονται με μια ματιά.
   - Ζώνη βάθους: βάφει μόνο το βάθος που διαλέγεις (π.χ. 20–60 m) ή το βάθος ενός ψαριού (από τα δικά σου ψάρια αν έχεις ≥ 3, αλλιώς από τη γενική γνώση).
   Τα κομμάτια 0,25° τα φέρνει και τα κρατά στο κινητό το shallows.js (ίδια μνήμη). Ενδεικτικό· EMODnet ~115 m. */
(function(){
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var KR='alkyon-v4-relief', KB='alkyon-v4-band', KBR='alkyon-v4-bandr';
var rel=!!ls.get(KR,false), bnd=!!ls.get(KB,false), BR=ls.get(KBR,null)||{a:20,b:60,sp:''};
var map=null, cv=null, mt=0, busy=0, legEl=null, IMG={};
function M(){ return window.AlkyonCore&&window.AlkyonCore.map&&window.AlkyonCore.map(); }
function S(){ return B.shallows&&B.shallows.tile?B.shallows:null; }
function any(){ return rel||bnd; }
function pane(){ var p=map.getPane('sfPane')||map.createPane('sfPane'); p.style.zIndex='336'; p.style.pointerEvents='none'; return p; }
function pin(c){ try{ L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0])); }catch(e){} }
function ensure(){ var m=M(); if(!m) return false; if(m!==map){ map=m; cv=null;
    map.on('movestart zoomstart',function(){ if(cv) cv.style.opacity='0'; });
    map.on('move',function(){ if(cv) pin(cv); });
    map.on('moveend zoomend',function(){ clearTimeout(mt); mt=setTimeout(refresh,250); }); }
  if(!cv){ cv=document.createElement('canvas'); cv.className='sfcv'; cv.setAttribute('aria-hidden','true'); cv.style.cssText='position:absolute;left:0;top:0;pointer-events:none;transition:opacity .25s'; pane().appendChild(cv); }
  return true; }
function sat(){ var v=ls.get('alkyon-v4-map',null); return !v||v.base!=='osm'; }
/* ---------- εικόνες ανά κομμάτι ---------- */
/* ανάγλυφο: κλίση από τα γειτονικά κελιά (Horn), φως αζιμούθιο 315°, ύψος 40°, μικρή υπερβολή για να φαίνονται τα 100 m κελιά */
function relief(g){ var w=g.w, hh=g.h, d=g.data, out=new Uint8ClampedArray(w*hh*4), cx=g.dx*111320*Math.cos(((g.y0+g.dy*hh/2))*Math.PI/180), cy=Math.abs(g.dy)*111320, EX=6;
  var az=315*Math.PI/180, al=40*Math.PI/180, zs=Math.sin(al), zc=Math.cos(al);
  function z(x,y){ x=x<0?0:x>=w?w-1:x; y=y<0?0:y>=hh?hh-1:y; var v=d[y*w+x]; return v>0?-v:0; }
  for(var y=0;y<hh;y++) for(var x=0;x<w;x++){ var i=y*w+x, v=d[i]; if(!(v>0)) continue;
    var dzdx=((z(x+1,y-1)+2*z(x+1,y)+z(x+1,y+1))-(z(x-1,y-1)+2*z(x-1,y)+z(x-1,y+1)))/(8*cx)*EX,
        dzdy=((z(x-1,y+1)+2*z(x,y+1)+z(x+1,y+1))-(z(x-1,y-1)+2*z(x,y-1)+z(x+1,y-1)))/(8*cy)*EX*(g.dy>0?-1:1),
        sl=Math.atan(Math.sqrt(dzdx*dzdx+dzdy*dzdy)), asp=Math.atan2(dzdy,-dzdx),
        hs=zs*Math.cos(sl)+zc*Math.sin(sl)*Math.cos(az-Math.PI/2-asp); hs=hs<0?0:hs>1?1:hs;
    var t=Math.min(1,Math.sqrt(v/600)), o=i*4;
    /* βαθύ μπλε για τα βαθιά, ανοιχτό για τα ρηχά· η σκιά σκουραίνει/φωτίζει */
    var r=40+120*(1-t), gg=110+120*(1-t), b=170+70*(1-t), k=0.35+0.9*hs;
    out[o]=r*k; out[o+1]=gg*k; out[o+2]=b*k; out[o+3]=200; }
  return out; }
function bandImg(g,a,b){ var n=g.w*g.h, out=new Uint8ClampedArray(n*4), d=g.data;
  for(var i=0;i<n;i++){ var v=d[i]; if(!(v>0)) continue; var o=i*4;
    if(v>=a&&v<=b){ out[o]=228; out[o+1]=87; out[o+2]=46; out[o+3]=150; }
    else if(!rel){ out[o]=20; out[o+1]=40; out[o+2]=60; out[o+3]=70; } }
  /* όρια της ζώνης πιο έντονα */
  for(var y=1;y<g.h-1;y++) for(var x=1;x<g.w-1;x++){ var j=y*g.w+x, vv=d[j]; if(!(vv>=a&&vv<=b)) continue;
    var e=[j-1,j+1,j-g.w,j+g.w].some(function(k){ var q=d[k]; return q>0&&(q<a||q>b); }); if(e){ var p=j*4; out[p]=255; out[p+1]=150; out[p+2]=90; out[p+3]=235; } }
  return out; }
function img(k,t,kind){ var g=t.g, key=k+'|'+kind+(kind==='b'?'|'+BR.a+'-'+BR.b+'|'+(rel?1:0):''); if(IMG[key]) return IMG[key];
  Object.keys(IMG).forEach(function(q){ if(q.indexOf(k+'|'+kind)===0) delete IMG[q]; });
  var px=kind==='r'?relief(g):bandImg(g,BR.a,BR.b), c=document.createElement('canvas'); c.width=g.w; c.height=g.h; c.getContext('2d').putImageData(new ImageData(px,g.w,g.h),0,0); IMG[key]=c; return c; }
function draw(){
  if(!ensure()) return; var sz=map.getSize(), dpr=Math.min(window.devicePixelRatio||1,2); cv.width=Math.round(sz.x*dpr); cv.height=Math.round(sz.y*dpr); cv.style.width=sz.x+'px'; cv.style.height=sz.y+'px'; pin(cv);
  var c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,sz.x,sz.y);
  var sh=S(), vis=any()&&sh&&document.body.classList.contains('mapon')&&map.getZoom()>=10;
  if(!vis){ cv.style.opacity='0'; legend(); return; }
  var tl=sh.need(map);
  tl.forEach(function(x){ var k=x[0]+'_'+x[1], t=sh._tiles[k]; if(!t) return; var g=t.g, p0=map.latLngToContainerPoint([g.y0,g.x0]), p1=map.latLngToContainerPoint([g.y0+g.dy*g.h,g.x0+g.dx*g.w]);
    c.imageSmoothingEnabled=true; if(rel) c.drawImage(img(k,t,'r'),0,0,g.w,g.h,p0.x,p0.y,p1.x-p0.x,p1.y-p0.y); if(bnd) c.drawImage(img(k,t,'b'),0,0,g.w,g.h,p0.x,p0.y,p1.x-p0.x,p1.y-p0.y); });
  cv.style.opacity='1'; legend(); }
function refresh(){
  if(!any()||!ensure()){ draw(); return; } if(!document.body.classList.contains('mapon')) return;
  var sh=S(); if(!sh) return; if(map.getZoom()<10){ draw(); legend(T('Κάνε ζουμ (10+) για να φανεί.','Zoom in (10+) to see it.')); return; }
  var miss=sh.need(map).filter(function(x){ return !sh._tiles[x[0]+'_'+x[1]]; }).slice(0,24); draw(); if(!miss.length) return;
  busy++; legend();
  Promise.all(miss.map(function(x){ return sh.tile(x[0],x[1]).then(draw).catch(function(){}); })).then(function(){ busy--; draw(); }); }
/* ---------- ζώνη: από ψάρι ---------- */
function nrm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function myDepths(sp){ var out=[]; try{ var all=(B.store&&B.store.bites?B.store.bites():[])||[]; all.forEach(function(r){ if(r&&r.depth>0&&nrm(r.species)===nrm(sp)) out.push(+r.depth); }); }catch(e){} return out.sort(function(a,b){ return a-b; }); }
function spRange(s){ var mine=myDepths(s.n).concat(s.en?myDepths(s.en):[]); mine.sort(function(a,b){ return a-b; });
  if(mine.length>=3){ var a=mine[Math.floor(mine.length*0.15)], b=mine[Math.ceil(mine.length*0.85)-1]; if(b-a<6){ a=Math.max(1,a-3); b=b+3; } return {a:Math.round(a),b:Math.round(b),mine:mine.length}; }
  return s.d?{a:s.d[0],b:s.d[1],mine:0}:null; }
function spList(){ return (window.SPKB||[]).filter(function(s){ return s.d&&s.d[1]>0; }).map(function(s){ var r=spRange(s); return {n:EN?(s.en||s.n):s.n,s:s,r:r}; }).filter(function(x){ return x.r; }).sort(function(a,b){ return (b.r.mine-a.r.mine)||a.n.localeCompare(b.n); }); }
function setBand(a,b,sp){ a=Math.max(0,Math.round(+a||0)); b=Math.max(a+1,Math.round(+b||0)); BR={a:a,b:b,sp:sp||''}; ls.set(KBR,BR); IMG={}; if(!bnd){ bnd=true; ls.set(KB,true); } refresh(); }
function pick(){ var fa=h('input',{type:'number',inputmode:'numeric',min:'0',max:'2000',value:String(BR.a),'aria-label':T('Από (m)','From (m)')}), fb=h('input',{type:'number',inputmode:'numeric',min:'1',max:'2000',value:String(BR.b),'aria-label':T('Έως (m)','To (m)')});
  var sh2, list=h('div',{class:'sfsp'}, spList().map(function(x){ return h('button',{type:'button',class:'chip'+(BR.sp===x.n?' on':''),onclick:function(){ setBand(x.r.a,x.r.b,x.n); sh2.close(); }},h('b',{text:x.n}),h('small',{text:' '+x.r.a+'–'+x.r.b+' m'+(x.r.mine?T(' · δικά σου',' · yours'):'')})); }));
  sh2=B.sheet({title:T('Ζώνη βάθους','Depth band'),body:h('div',{class:'sfpick'},
    h('p',{class:'wn',text:T('Ο χάρτης βάφει μόνο αυτά τα βάθη. Διάλεξε ψάρι (από τα δικά σου ψάρια όταν έχεις 3+, αλλιώς γενικά) ή γράψε όρια.','The map paints only these depths. Pick a fish (from your own catches when you have 3+, otherwise general) or type limits.')}),
    h('div',{class:'sfrow'},h('label',{},T('Από','From'),fa,'m'),h('label',{},T('Έως','To'),fb,'m'),h('button',{type:'button',class:'btn',text:T('Εφαρμογή','Apply'),onclick:function(){ setBand(fa.value,fb.value,''); sh2.close(); }})),
    h('h4',{text:T('Ψάρια','Fish')}),list)}); }
/* ---------- υπόμνημα ---------- */
function legend(note){
  var show=bnd&&document.body.classList.contains('mapon');
  if(!show){ if(legEl) legEl.hidden=true; return; }
  if(!legEl){ legEl=h('div',{class:'sbleg sfleg',role:'note'}); document.body.append(legEl); }
  legEl.hidden=false; placeSoon(); legEl.replaceChildren(h('b',{text:T('Ζώνη βάθους','Depth band')}),
    h('span',{class:'sbk'},h('i',{style:'background:#E4572E'}),(BR.sp?BR.sp+' ':'')+BR.a+'–'+BR.b+' m'),
    h('button',{type:'button',class:'sfed',text:T('Αλλαγή','Change'),onclick:pick}),
    (note||busy)?h('small',{text:note||T('Φόρτωση βαθών…','Loading depths…')}):null); }
/* 1.13.8: να μη μπαίνει πάνω σε άλλο υπόμνημα (ρηχά, βάθη, καιρός): μπαίνει ακριβώς πάνω από το ψηλότερο που φαίνεται */
var plT=0; function placeSoon(){ clearTimeout(plT); plT=setTimeout(place,60); }
function place(){ if(!legEl||legEl.hidden) return; legEl.style.bottom=''; var my=legEl.getBoundingClientRect(), top=1e9;
  document.querySelectorAll('.sbleg:not(.sfleg)').forEach(function(o){ if(o.hidden||getComputedStyle(o).display==='none') return; var r=o.getBoundingClientRect(); if(r.height&&r.top<top) top=r.top; });
  if(top<1e9&&my.bottom>top-6) legEl.style.bottom=Math.round(window.innerHeight-top+8)+'px'; }
setInterval(function(){ if(legEl&&!legEl.hidden) place(); },1200);
function setR(v){ rel=!!v; ls.set(KR,rel); IMG={}; refresh(); }
function setB(v){ bnd=!!v; ls.set(KB,bnd); IMG={}; refresh(); if(bnd&&!ls.get(KBR,null)) setTimeout(pick,250); }
B.seafloor={relief:function(){ return rel; },band:function(){ return bnd; },setRelief:setR,setBand:setB,range:function(){ return BR; },setRange:setBand,pick:pick,_relief:relief,_band:bandImg,_spRange:spRange};
new MutationObserver(function(){ if(any()) setTimeout(refresh,300); else legend(); }).observe(document.body,{attributes:true,attributeFilter:['class']});
setTimeout(function(){ if(any()) refresh(); },3600);
})();
