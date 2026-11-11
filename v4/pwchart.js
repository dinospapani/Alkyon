/* Alkyon 4 · 1.12.19: κοινό γράφημα «Πίεση, άνεμος, σελήνη, παλίρροια».
   Το ίδιο γράφημα στην Πρόγνωση και στην κάρτα κάθε ψαριού.
   pts: [{t:ms UTC, p:hPa, w:kn, g:kn, d:°, l:στάθμη m}] ωριαία.
   cfg: {lat, lon, tz (λεπτά), rk:'d1'|'d3'|'d7'|'catch', nowI, good(q,mid,i) για «καλή» περίοδο σελήνης,
         timeLabel(ms,i,nowI), marks:[{t,cls,lbl}], shade:[{a,b,cls}], sel (αρχική θέση), onSel(i)}
   Επιστρέφει {svg, rd, per, moonAt, mLbl, setSel}. */
(function(){
'use strict';
var B=window.AK, h=B.h, s=B.s, T=B.T, PF=window.PF, U=window.AlkyonUnits;
var DIRS=B.EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dirTxt(d){ return d==null?'':DIRS[Math.round((((d%360)+360)%360)/45)%8]; }
function scrub(el,fn){ var on=false; function at(e){ var r=el.getBoundingClientRect(); fn(Math.max(0,Math.min(0.9999,(e.clientX-r.left)/r.width))); }
  el.style.touchAction='pan-y';
  el.addEventListener('pointerdown',function(e){ on=true; try{ el.setPointerCapture(e.pointerId); }catch(x){} at(e); });
  el.addEventListener('pointermove',function(e){ if(on) at(e); });
  ['pointerup','pointercancel','lostpointercapture'].forEach(function(n){ el.addEventListener(n,function(){ on=false; }); }); }
B.pwScrub=scrub;
B.pwChart=function(pts,cfg){
  cfg=cfg||{}; var n=pts.length, rk=cfg.rk||'d1', tz=cfg.tz||0, nowI=cfg.nowI!=null?cfg.nowI:-1, lat=+cfg.lat, lon=+cfg.lon;
  var loc=function(ms){ return new Date(ms+tz*60000).toISOString(); };
  var hasL=pts.filter(function(q){ return typeof q.l==='number'; }).length>=Math.min(6,n);
  var hasM=!!(PF&&PF.moonAlt&&PF.solunarPeriods&&isFinite(lat)&&isFinite(lon));
  var W=340, Lm=6, R=38, pT=14, pH=86, wT=pT+pH+22, wH=56, mT=wT+wH+34, mH=30, tT=mT+mH+(hasL?24:0), tH=hasL?34:0, bot=hasL?tT+tH:mT+mH, H=bot+(hasL?24:16);
  var ps=pts.map(function(q){ return q.p; }).filter(function(v){ return v!=null; }), pmin=Math.floor(Math.min.apply(null,ps)-0.5), pmax=Math.ceil(Math.max.apply(null,ps)+0.5); if(pmax-pmin<4){ pmin-=1; pmax+=1; }
  var wmaxKn=Math.max(rk==='catch'?16:30,Math.max.apply(null,pts.map(function(q){ return q.g||q.w||0; })));
  var X=function(i){ return Lm+(W-Lm-R)*i/(n-1); }, Y=function(pv){ return pT+pH-(pv-pmin)/(pmax-pmin)*pH; }, YW=function(kn){ return wT+wH-Math.min(1,kn/wmaxKn)*wH; };
  var svg=s('svg',{viewBox:'0 0 '+W+' '+H,class:'pwc',role:'img','aria-label':T('Πίεση, άνεμος, σελήνη και παλίρροια ανά ώρα','Pressure, wind, moon and tide by hour')});
  var tx=function(x,y,t,cls,anc){ var e=s('text',{x:x,y:y,class:cls||'ax','text-anchor':anc||'start'}); e.textContent=t; svg.appendChild(e); return e; };
  var t0=pts[0].t, t1=pts[n-1].t, Xt=function(ms){ return Lm+(W-Lm-R)*(ms-t0)/(t1-t0); };
  /* σκιασμένα διαστήματα (π.χ. όσο τσιμπούσαν) */
  (cfg.shade||[]).forEach(function(z){ var a=Math.max(Lm,Xt(z.a)), b=Math.min(W-R,Xt(z.b)); if(b>a) svg.appendChild(s('rect',{x:a,y:pT,width:b-a,height:bot-pT,class:'shd '+(z.cls||'')})); });
  /* πλέγμα πίεσης */
  var stp=Math.max(1,Math.round((pmax-pmin)/3));
  for(var g=pmin;g<=pmax;g+=stp){ svg.appendChild(s('line',{x1:Lm,x2:W-R,y1:Y(g),y2:Y(g),class:'gl'})); tx(W-R+4,Y(g)+3.5,String(g)); }
  tx(Lm,pT-4,'hPa','axh');
  [[0,0],[11,4],[28,7]].forEach(function(b){ if(b[0]>wmaxKn) return; svg.appendChild(s('line',{x1:Lm,x2:W-R,y1:YW(b[0]),y2:YW(b[0]),class:'gl'})); tx(W-R+4,YW(b[0])+3.5,String(b[1])); });
  tx(Lm,wT-4,'Bft','axh wk');
  /* χρόνος */
  pts.forEach(function(q,i){ var lt=loc(q.t), hr=+lt.slice(11,13);
    if(hr===0&&i>0) svg.appendChild(s('line',{x1:X(i),x2:X(i),y1:pT,y2:bot,class:'dl'}));
    if(rk==='d1'){ if(hr%6===0) tx(X(i),H-3,B.pad(hr),'dt','middle'); }
    else if(rk==='catch'){ if(hr%3===0) tx(X(i),H-3,B.pad(hr)+':00','dt','middle'); }
    else if(hr===12) tx(X(i),H-3,cfg.dayLabel?cfg.dayLabel(lt.slice(0,10)):lt.slice(5,10),'dt','middle'); });
  var path=function(a,b,fy,cls){ var dd=''; for(var i=a;i<=b;i++){ var yv=fy(pts[i]); if(yv==null) continue; dd+=(dd?' L':'M')+X(i).toFixed(1)+','+yv.toFixed(1); } if(dd) svg.appendChild(s('path',{d:dd,class:cls})); };
  var ni=nowI>=0?nowI:n-1;
  path(0,ni,function(q){ return q.p==null?null:Y(q.p); },'pl'); if(ni<n-1) path(ni,n-1,function(q){ return q.p==null?null:Y(q.p); },'pl fut');
  var iHi=0,iLo=0; pts.forEach(function(q,i){ if(q.p==null) return; if(pts[iHi].p==null||q.p>pts[iHi].p) iHi=i; if(pts[iLo].p==null||q.p<pts[iLo].p) iLo=i; });
  if(rk!=='catch'){ tx(X(iHi),Y(pts[iHi].p)-6,'▲','hl','middle'); tx(X(iLo),Y(pts[iLo].p)+12,'▼','hl','middle'); }
  var wd='M'+X(0)+','+YW(0); pts.forEach(function(q,i){ if(q.w!=null) wd+=' L'+X(i).toFixed(1)+','+YW(q.w).toFixed(1); }); wd+=' L'+X(n-1)+','+YW(0)+' Z';
  svg.appendChild(s('path',{d:wd,class:'wa'}));
  path(0,ni,function(q){ return q.w==null?null:YW(q.w); },'wl'); if(ni<n-1) path(ni,n-1,function(q){ return q.w==null?null:YW(q.w); },'wl fut');
  path(0,n-1,function(q){ return q.g==null?null:YW(q.g); },'gl2');
  var every=Math.max(1,Math.round(n/18));
  pts.forEach(function(q,i){ if(i%every||q.d==null) return; var a=s('text',{x:X(i),y:wT+wH+14,class:'arr','text-anchor':'middle',transform:'rotate('+((q.d+180)%360)+' '+X(i).toFixed(1)+' '+(wT+wH+10)+')'}); a.textContent='↑'; svg.appendChild(a); });
  /* σελήνη */
  var per=[];
  if(hasM){
    tx(Lm,mT-4,T('σελήνη','moon'),'axh mk');
    svg.appendChild(s('line',{x1:Lm,x2:W-R,y1:mT+mH,y2:mT+mH,class:'gl'}));
    try{ per=PF.solunarPeriods(t0,t1,lat,lon); }catch(e){ per=[]; }
    var iAt=function(ms){ var b=0; pts.forEach(function(q,i){ if(Math.abs(q.t-ms)<Math.abs(pts[b].t-ms)) b=i; }); return b; };
    per.forEach(function(q){ var mid=(q.s+q.e)/2; q.good=false; q.vOk=true; if(cfg.good) try{ cfg.good(q,mid,iAt(mid)); }catch(e){} });
    per.forEach(function(q){ var a=Math.max(Lm,Xt(q.s)), b=Math.min(W-R,Xt(q.e)); if(b-a<0.5) return; svg.appendChild(s('rect',{x:a,y:mT,width:b-a,height:mH,rx:2,class:(q.kind==='major'?'mp maj':'mp')+(q.good?' ok':'')}));
      if(q.good) svg.appendChild(s('rect',{x:a,y:mT-3,width:b-a,height:3,rx:1.5,class:q.vOk?'mg':'mg wv'})); });
    var steps=Math.min(240,n*4), dm='', on=false;
    for(var k=0;k<=steps;k++){ var ms=t0+(t1-t0)*k/steps, al=PF.moonAlt(ms,lat,lon), xx=Xt(ms).toFixed(1);
      if(al>0){ var yy=(mT+mH-mH*Math.min(1,al/90)).toFixed(1); dm+=(on?'L':'M'+xx+' '+(mT+mH)+' L')+xx+' '+yy+' '; on=true; } else if(on){ dm+='L'+xx+' '+(mT+mH)+' '; on=false; } }
    if(on) dm+='L'+Xt(t1).toFixed(1)+' '+(mT+mH);
    if(dm) svg.appendChild(s('path',{d:dm,class:'ma'}));
  }
  /* παλίρροια (στάθμη θάλασσας): καμπύλη, ψηλές (●) και χαμηλές (○) με ώρα */
  var lmean=null;
  if(hasL){
    var lv=pts.map(function(q){ return q.l; }).filter(function(v){ return typeof v==='number'; }), lmn=Math.min.apply(null,lv), lmx=Math.max.apply(null,lv); if(lmx-lmn<0.04){ lmx+=0.02; lmn-=0.02; }
    lmean=lv.reduce(function(a,b){ return a+b; },0)/lv.length;
    var YL=function(v){ return tT+tH-(v-lmn)/(lmx-lmn)*tH; };
    tx(Lm,tT-4,T('παλίρροια','tide'),'axh tk');
    svg.appendChild(s('line',{x1:Lm,x2:W-R,y1:tT+tH,y2:tT+tH,class:'gl'}));
    tx(W-R+4,YL(lmx)+3.5,'+'+Math.round((lmx-lmean)*100)); tx(W-R+4,YL(lmn)+3.5,String(Math.round((lmn-lmean)*100)));
    var ld='', la='M'+X(0)+','+(tT+tH); pts.forEach(function(q,i){ if(typeof q.l!=='number') return; var p0=X(i).toFixed(1)+','+YL(q.l).toFixed(1); ld+=(ld?' L':'M')+p0; la+=' L'+p0; }); la+=' L'+X(n-1)+','+(tT+tH)+' Z';
    svg.appendChild(s('path',{d:la,class:'ta'})); svg.appendChild(s('path',{d:ld,class:'tl'}));
    for(var i2=1;i2<n-1;i2++){ var a=pts[i2-1].l, b=pts[i2].l, c=pts[i2+1].l; if(typeof a!=='number'||typeof b!=='number'||typeof c!=='number') continue;
      var hi=b>a&&b>=c, lo=b<a&&b<=c; if(!hi&&!lo) continue;
      var den=a-2*b+c, off=den?Math.max(-0.5,Math.min(0.5,0.5*(a-c)/den)):0, xm=X(i2+off), ym=YL(b-0.25*(a-c)*off);
      svg.appendChild(s('circle',{cx:xm.toFixed(1),cy:ym.toFixed(1),r:3,class:hi?'th':'tlo'}));
      if(rk==='d1'||rk==='catch'){ var mm=Math.round((pts[i2].t+off*3600000)/60000)*60000; tx(xm,hi?ym-5:ym+11,loc(mm).slice(11,16),'tt','middle'); } }
  }
  /* σημάδια (π.χ. «πιάστηκε», «σταμάτησαν») */
  (cfg.marks||[]).forEach(function(m){ if(m.t<t0||m.t>t1) return; var x=Xt(m.t); svg.appendChild(s('line',{x1:x,x2:x,y1:pT-2,y2:bot,class:'pmk '+(m.cls||'')})); if(m.lbl) tx(Math.min(W-R-2,Math.max(Lm+2,x)),pT-4,m.lbl,'pmkl '+(m.cls||''),x>W-R-40?'end':x<Lm+40?'start':'middle'); });
  if(nowI>=0&&rk!=='catch'){ svg.appendChild(s('line',{x1:X(nowI),x2:X(nowI),y1:pT,y2:bot,class:'now'})); if(pts[nowI].p!=null) svg.appendChild(s('circle',{cx:X(nowI),cy:Y(pts[nowI].p),r:3.5,class:'nd'})); }
  var sl=s('line',{y1:pT,y2:bot,class:'sel',visibility:'hidden'}), sd=s('circle',{r:4.5,class:'dot',visibility:'hidden'}), sw=s('circle',{r:4,class:'dot w',visibility:'hidden'});
  svg.append(sl,sd,sw);
  var moonAt=function(ms){ var b=null; per.forEach(function(q){ if(ms>=q.s&&ms<=q.e&&(!b||q.kind==='major')) b=q; }); return b; };
  var mLbl=function(q){ return (q.kind==='major'?T('κύρια περίοδος','major period'):T('δευτερεύουσα περίοδος','minor period'))+' ('+(q.ev==='upper'?T('σελήνη από πάνω','moon overhead'):q.ev==='lower'?T('σελήνη από κάτω','moon underfoot'):q.ev==='rise'?T('ανατολή σελήνης','moonrise'):T('δύση σελήνης','moonset'))+')'; };
  var rd=h('p',{class:'hline'});
  function setSel(ri,show){
    ri=Math.max(0,Math.min(n-1,ri)); var q=pts[ri], d3=ri>=3&&q.p!=null&&pts[ri-3].p!=null?q.p-pts[ri-3].p:null;
    if(show){ [sl,sd,sw].forEach(function(e){ e.setAttribute('visibility','visible'); }); sl.setAttribute('x1',X(ri)); sl.setAttribute('x2',X(ri)); if(q.p!=null){ sd.setAttribute('cx',X(ri)); sd.setAttribute('cy',Y(q.p)); } else sd.setAttribute('visibility','hidden');
      if(q.w!=null){ sw.setAttribute('cx',X(ri)); sw.setAttribute('cy',YW(q.w)); } else sw.setAttribute('visibility','hidden'); if(cfg.onSel) cfg.onSel(ri); }
    var bits=[cfg.timeLabel?cfg.timeLabel(q.t,ri,nowI):loc(q.t).slice(11,16)]; if(q.p!=null) bits.push(U.press(q.p));
    if(d3!=null) bits.push(T('τάση ','trend ')+(d3>0?'+':'')+B.num(d3,1)+T(' /3ω',' /3h'));
    if(q.w!=null) bits.push(T('άνεμος ','wind ')+U.wind(q.w)+(q.d!=null?' '+dirTxt(q.d):'')+(q.g!=null?', '+T('ριπές ','gusts ')+U.wind(q.g):''));
    var mq=moonAt(q.t+1800000); if(mq) bits.push(mLbl(mq));
    if(lmean!=null&&typeof q.l==='number'){ var nx=pts[Math.min(n-1,ri+1)].l, pv=pts[Math.max(0,ri-1)].l, tr=typeof nx==='number'&&typeof pv==='number'?nx-pv:0, cmv=Math.round((q.l-lmean)*100);
      bits.push(T('στάθμη ','sea level ')+(cmv>0?'+':'')+cmv+' cm'+(Math.abs(tr)<0.006?T(' (νεκρό νερό)',' (slack)'):tr>0?' ↑':' ↓')); }
    rd.textContent=bits.join(' · ');
  }
  scrub(svg,function(fx){ var x=fx*W; setSel(Math.round((x-Lm)/((W-Lm-R)/(n-1))),true); });
  if(cfg.sel!=null&&cfg.sel<n) setSel(cfg.sel,true); else setSel(Math.max(0,nowI),false);
  return {svg:svg,rd:rd,per:per,moonAt:moonAt,mLbl:mLbl,setSel:setSel,hasTide:hasL};
};
})();
