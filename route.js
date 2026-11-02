/* Ενδεικτική διαδρομή γύρω από στεριά: ψάχνει διαδρομή στη θάλασσα με ελάχιστη απόσταση από την ακτή.
   Χρησιμοποιεί το πλέγμα βαθών EMODnet (θάλασσα = θετικό βάθος, στεριά = όχι). ΔΕΝ είναι ναυτικός χάρτης:
   δεν ξέρει ξέρες (βράχια κάτω από το νερό), δίχτυα ή κυκλοφορία. Τα νησάκια και οι βράχοι πάνω από το νερό
   που υπάρχουν στο OpenStreetMap λαμβάνονται υπόψη (v31z390). */
(function(){
'use strict';
var MINDEPTH=1, MAXC=520, RES0=1/960, R=Math.PI/180;
var last=null;
function hav(a,b,c,d){ var dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742000*Math.asin(Math.min(1,Math.sqrt(x))); }
function bboxFor(a,b,mul){
  var s=Math.min(a.lat,b.lat), n=Math.max(a.lat,b.lat), w=Math.min(a.lon,b.lon), e=Math.max(a.lon,b.lon);
  var m=Math.max(0.05,Math.max(n-s,e-w)*0.6)*(mul||1); return {s:s-m,n:n+m,w:w-m,e:e+m};
}
function getGrid(bb){
  if(last&&bb.s>=last.s&&bb.n<=last.n&&bb.w>=last.w&&bb.e<=last.e&&Date.now()-last.t<600000) return Promise.resolve(last.g);
  var res=Math.max(RES0,Math.max(bb.n-bb.s,bb.e-bb.w)/MAXC);
  if(!window.AlkyonBathy||!window.AlkyonBathy.fetchGrid) return Promise.reject(new Error('nodata'));
  return window.AlkyonBathy.fetchGrid(bb,res).then(function(g){ last={s:bb.s,n:bb.n,w:bb.w,e:bb.e,t:Date.now(),g:g}; return g; });
}
/* grid → {w,h,sea,dist,mx,my,cell(lat,lon),pos(i,j)} */
function prep(g,rings){
  var w=g.w,h=g.h, N=w*h, sea=new Uint8Array(N), dist=new Float32Array(N);
  var latc=g.y0+g.dy*(h/2), mx=Math.abs(g.dx)*111320*Math.cos(latc*R), my=Math.abs(g.dy)*111320, md=Math.sqrt(mx*mx+my*my);
  for(var k=0;k<N;k++){ var v=g.data[k]; sea[k]=(v>=MINDEPTH)?1:0; }
  /* v31z390: νησάκια και βράχια από το OSM (ακρίβεια ~5 m) σημειώνονται ως στεριά, ακόμα κι αν είναι μικρότερα από ένα κελί του πλέγματος βαθών */
  if(rings&&rings.length){ var ci=function(lon){ return Math.floor((lon-g.x0)/g.dx); }, cj=function(lat){ return Math.floor((lat-g.y0)/g.dy); };
    rings.forEach(function(rg){ var b=rg.b; if((b[2]-b[0])>0.03||(b[3]-b[1])>0.03) return; /* μόνο μικρά νησιά· η μεγάλη στεριά υπάρχει ήδη στο πλέγμα βαθών */
      var xy=rg.xy, m=xy.length>>1;
      for(var q=0;q<m;q++){ var i0=ci(xy[2*q]), j0=cj(xy[2*q+1]); if(i0>=0&&j0>=0&&i0<w&&j0<h) sea[j0*w+i0]=0; }
      var ia=Math.max(0,Math.min(ci(b[0]),ci(b[2]))), ib=Math.min(w-1,Math.max(ci(b[0]),ci(b[2]))), ja=Math.max(0,Math.min(cj(b[1]),cj(b[3]))), jb=Math.min(h-1,Math.max(cj(b[1]),cj(b[3])));
      for(var jj=ja;jj<=jb;jj++) for(var ii=ia;ii<=ib;ii++){ var px=g.x0+g.dx*(ii+.5), py=g.y0+g.dy*(jj+.5), inn=false;
        for(var a2=0,b2=m-1;a2<m;b2=a2++){ var xa=xy[2*a2],ya=xy[2*a2+1],xb=xy[2*b2],yb=xy[2*b2+1]; if(((ya>py)!==(yb>py))&&(px<(xb-xa)*(py-ya)/(yb-ya)+xa)) inn=!inn; }
        if(inn) sea[jj*w+ii]=0; } }); }
  for(k=0;k<N;k++) dist[k]=sea[k]?1e9:0;
  for(var j=0;j<h;j++) for(var i=0;i<w;i++){ var k2=j*w+i; if(!sea[k2]) continue; var d=dist[k2];
    if(i>0&&dist[k2-1]+mx<d) d=dist[k2-1]+mx; if(j>0){ if(dist[k2-w]+my<d) d=dist[k2-w]+my; if(i>0&&dist[k2-w-1]+md<d) d=dist[k2-w-1]+md; if(i<w-1&&dist[k2-w+1]+md<d) d=dist[k2-w+1]+md; } dist[k2]=d; }
  for(j=h-1;j>=0;j--) for(i=w-1;i>=0;i--){ k2=j*w+i; if(!sea[k2]) continue; d=dist[k2];
    if(i<w-1&&dist[k2+1]+mx<d) d=dist[k2+1]+mx; if(j<h-1){ if(dist[k2+w]+my<d) d=dist[k2+w]+my; if(i<w-1&&dist[k2+w+1]+md<d) d=dist[k2+w+1]+md; if(i>0&&dist[k2+w-1]+md<d) d=dist[k2+w-1]+md; } dist[k2]=d; }
  return {g:g,w:w,h:h,sea:sea,dist:dist,mx:mx,my:my,md:md};
}
function toIJ(P,lat,lon){ var g=P.g; return [Math.floor((lon-g.x0)/g.dx),Math.floor((lat-g.y0)/g.dy)]; }
function toLL(P,i,j){ var g=P.g; return [g.y0+g.dy*(j+.5),g.x0+g.dx*(i+.5)]; }
function inside(P,i,j){ return i>=0&&j>=0&&i<P.w&&j<P.h; }
/* μια διαδρομή: from,to = {lat,lon}; clr σε μέτρα. Επιστρέφει {straight:true} | {pts:[[lat,lon],…],len(m)} | {err} */
function plan(from,to,clr,mul){
  clr=Math.max(0,+clr||0); mul=mul||1;
  var bb0=bboxFor(from,to,mul);
  return getGrid(bb0).then(function(g){
    var SS=window.AlkyonSeaState; if(!SS||!SS.landRings) return [g,[]];
    return SS.landRings(bb0).then(function(rs){ return [g,rs]; },function(){ return [g,[]]; });
  }).then(function(gr){ var g=gr[0];
    var P=prep(g,gr[1]), minClr=Math.max(clr,Math.min(P.mx,P.my)*1.2);
    var free=Math.min(3000,Math.max(clr*3,800)), A=toIJ(P,from.lat,from.lon), B=toIJ(P,to.lat,to.lon);
    if(!inside(P,A[0],A[1])||!inside(P,B[0],B[1])) return {err:'outside'};
    function nearSea(c){ /* πλησιέστερο κελί θάλασσας μέσα σε ~2 km */
      var rad=Math.ceil(2000/Math.min(P.mx,P.my)), best=null, bd=1e18;
      for(var dj=-rad;dj<=rad;dj++) for(var di=-rad;di<=rad;di++){ var i=c[0]+di,j=c[1]+dj; if(!inside(P,i,j)||!P.sea[j*P.w+i]) continue; var d=di*di*P.mx*P.mx+dj*dj*P.my*P.my; if(d<bd){ bd=d; best=[i,j]; } }
      return best; }
    var a=nearSea(A), b=nearSea(B); if(!a||!b) return {err:'nosea',which:a?'end':'start'};
    function ok(i,j){ if(!inside(P,i,j)) return false; var k=j*P.w+i; if(!P.sea[k]) return false;
      if(P.dist[k]>=minClr) return true;
      var dA=Math.hypot((i-a[0])*P.mx,(j-a[1])*P.my), dB=Math.hypot((i-b[0])*P.mx,(j-b[1])*P.my); return dA<=free||dB<=free; }
    function los(p,q){ var n=Math.max(1,Math.ceil(Math.max(Math.abs(q[0]-p[0]),Math.abs(q[1]-p[1]))*2));
      for(var s=0;s<=n;s++){ var i=Math.round(p[0]+(q[0]-p[0])*s/n), j=Math.round(p[1]+(q[1]-p[1])*s/n); if(!ok(i,j)) return false; } return true; }
    if(los(a,b)) return {straight:true};
    /* A* */
    var W=P.w, H=P.h, N=W*H, gs=new Float32Array(N).fill(1e30), came=new Int32Array(N).fill(-1), closed=new Uint8Array(N);
    var heap=[], hk=[]; function push(k,f){ heap.push(k); hk.push(f); var c=heap.length-1; while(c>0){ var p=(c-1)>>1; if(hk[p]<=hk[c]) break; var t=heap[p]; heap[p]=heap[c]; heap[c]=t; t=hk[p]; hk[p]=hk[c]; hk[c]=t; c=p; } }
    function pop(){ var top=heap[0], lk=heap.pop(), lf=hk.pop(); if(heap.length){ heap[0]=lk; hk[0]=lf; var c=0; for(;;){ var l=c*2+1,r=l+1,m=c; if(l<heap.length&&hk[l]<hk[m]) m=l; if(r<heap.length&&hk[r]<hk[m]) m=r; if(m===c) break; var t=heap[m]; heap[m]=heap[c]; heap[c]=t; t=hk[m]; hk[m]=hk[c]; hk[c]=t; c=m; } } return top; }
    function hh(i,j){ return Math.hypot((i-b[0])*P.mx,(j-b[1])*P.my); }
    var sk=a[1]*W+a[0], tk=b[1]*W+b[0]; gs[sk]=0; push(sk,hh(a[0],a[1]));
    var NB=[[1,0,P.mx],[-1,0,P.mx],[0,1,P.my],[0,-1,P.my],[1,1,P.md],[1,-1,P.md],[-1,1,P.md],[-1,-1,P.md]], found=false, iter=0;
    while(heap.length&&iter++<600000){ var cur=pop(); if(closed[cur]) continue; closed[cur]=1; if(cur===tk){ found=true; break; }
      var ci=cur%W, cj=(cur-ci)/W;
      for(var n=0;n<8;n++){ var ni=ci+NB[n][0], nj=cj+NB[n][1]; if(!ok(ni,nj)) continue;
        if(NB[n][0]&&NB[n][1]&&(!ok(ci+NB[n][0],cj)||!ok(ci,cj+NB[n][1]))) continue;
        var nk=nj*W+ni; if(closed[nk]) continue; var pen=P.dist[nk]<clr*2?1.25:1, ng=gs[cur]+NB[n][2]*pen;
        if(ng<gs[nk]){ gs[nk]=ng; came[nk]=cur; push(nk,ng+hh(ni,nj)); } } }
    if(!found){ if(mul<3) return plan(from,to,clr,mul*2.5); return {err:'nopath'}; }
    var cells=[], k3=tk; while(k3>=0){ var xi=k3%W; cells.push([xi,(k3-xi)/W]); k3=came[k3]; } cells.reverse();
    /* απλοποίηση με οπτική επαφή */
    var out=[cells[0]], anchor=0; for(var q=1;q<cells.length;q++){ if(!los(cells[anchor],cells[q])){ out.push(cells[q-1]); anchor=q-1; } } out.push(cells[cells.length-1]);
    var pts=[[from.lat,from.lon]]; out.forEach(function(c){ pts.push(toLL(P,c[0],c[1])); }); pts.push([to.lat,to.lon]);
    var len=0; for(var z=1;z<pts.length;z++) len+=hav(pts[z-1][0],pts[z-1][1],pts[z][0],pts[z][1]);
    return {pts:pts,len:len,direct:hav(from.lat,from.lon,to.lat,to.lon)};
  });
}
window.AlkyonRoute={plan:plan,_prep:prep};
})();
