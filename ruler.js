/* Χάρακας χάρτη: απόσταση από την ακτή (ή τη θέση σου) και βάθος στο σημείο και κατά μήκος της γραμμής.
   Βάθη: EMODnet (πλέγμα ~100 m, ενδεικτικά κοντά στην ακτή). Όχι ναυτικό όργανο. */
(function(){
'use strict';
var C=window.AlkyonCore, mb=document.querySelector('.mapbtns'), L=window.L; if(!C||!mb||!L) return;
var map=C.map&&C.map(); if(!map) return;
var EN=window.LANG==='en', T=function(a,b){ return EN?b:a; };
var PU=window.AlkyonUnits;
var btn=document.createElement('button'); btn.type='button'; btn.id='bRuler'; btn.className='mbtn'; btn.setAttribute('aria-pressed','false');
btn.setAttribute('aria-label',T('Χάρακας (απόσταση και βάθος)','Ruler (distance and depth)')); btn.title=btn.getAttribute('aria-label');
btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>';
mb.appendChild(btn);

var on=false, P=[], dep=[], poly=null, live=null, mk=[], lb=[], cross=null, panel=null, seq=0, tmr=null, cdep=null, cseq=0;
var COMP=EN?['N','NE','E','SE','S','SW','W','NW']:['Β','ΒΑ','Α','ΝΑ','Ν','ΝΔ','Δ','ΒΔ'];
function dist(a,b){ var R=6371000, r=Math.PI/180, dl=(b.lat-a.lat)*r, dn=(b.lng-a.lng)*r, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)*Math.sin(dn/2); return 2*R*Math.asin(Math.sqrt(x)); }
function bearing(a,b){ var r=Math.PI/180, y=Math.sin((b.lng-a.lng)*r)*Math.cos(b.lat*r), x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lng-a.lng)*r); return (Math.atan2(y,x)/r+360)%360; }
function fmtD(m){ var cu=PU&&PU.cfg&&PU.cfg.dist; if(!cu||cu==='km'){ return m<1000?(m<100?m.toFixed(1):Math.round(m))+' m':(m/1000).toFixed(2)+' km'; } if(PU&&PU.dist){ try{ return PU.dist(m/1000,2); }catch(e){} } return m<1000?Math.round(m)+' m':(m/1000).toFixed(2)+' km'; }
function dirT(b){ return Math.round(b)+'° '+COMP[Math.round(b/45)%8]; }
function total(){ var s=0; for(var i=1;i<P.length;i++) s+=dist(P[i-1],P[i]); return s; }
function dot(color,txt){ return L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:50%;background:'+color+';border:3px solid #fff;box-shadow:0 1px 6px #0007;color:#fff;font:700 11px system-ui;display:flex;align-items:center;justify-content:center">'+txt+'</div>',iconSize:[22,22],iconAnchor:[11,11]}); }
function tag(txt){ return L.divIcon({className:'',html:'<div style="transform:translate(-50%,-50%);background:#3b2a12;color:#ffd27a;border-radius:8px;padding:2px 7px;font:700 12px system-ui;white-space:nowrap;box-shadow:0 1px 4px #0008">'+txt+'</div>',iconSize:[0,0]}); }
function ensureCross(){
  if(cross) return; cross=document.createElement('div'); cross.id='ndRulX'; cross.setAttribute('aria-hidden','true');
  cross.style.cssText='position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;pointer-events:none;z-index:470';
  cross.innerHTML='<svg viewBox="0 0 44 44" width="44" height="44"><circle cx="22" cy="22" r="9" fill="none" stroke="#fff" stroke-width="3"/><circle cx="22" cy="22" r="9" fill="none" stroke="#E8743B" stroke-width="1.5"/><path d="M22 2v10M22 32v10M2 22h10M32 22h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M22 2v10M22 32v10M2 22h10M32 22h10" stroke="#E8743B" stroke-width="1.5" stroke-linecap="round"/></svg>';
  map.getContainer().appendChild(cross);
}
function ensurePanel(){
  if(panel) return panel;
  panel=document.createElement('div'); panel.id='ndRuler'; panel.setAttribute('role','group'); panel.setAttribute('aria-label',T('Χάρακας','Ruler'));
  panel.style.cssText='position:fixed;left:10px;right:10px;bottom:calc(var(--navh,64px) + 14px);z-index:900;background:var(--card,var(--bg,#fff));color:var(--ink,#111);border:1px solid var(--line,#8886);border-radius:14px;padding:10px 12px;box-shadow:0 4px 18px #0004;max-height:36vh;overflow:auto';
  document.body.appendChild(panel); return panel;
}
function btnEl(txt,cls,fn,id){ var b=document.createElement('button'); b.type='button'; b.className='btn '+cls; if(id) b.id=id; b.textContent=txt; b.style.minHeight='44px'; b.addEventListener('click',fn); return b; }
function render(){
  var p=ensurePanel(); var sc=p.scrollTop; p.replaceChildren();
  var top=document.createElement('div'); top.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:8px';
  var h=document.createElement('b'); h.textContent=T('Χάρακας','Ruler'); top.append(h,btnEl('✕','ghost sm',stop)); p.append(top);
  var big=document.createElement('div'); big.id='ndRulBig'; big.style.cssText='font-size:26px;font-weight:700;margin:4px 0'; big.setAttribute('aria-live','polite'); p.append(big);
  var row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:6px 0';
  row.append(btnEl(T('＋ Προσθήκη σημείου','＋ Add point'),'',addPoint,'ndRulAdd'));
  if(P.length) row.append(btnEl(T('↶ Αναίρεση','↶ Undo'),'ghost',undo));
  if(P.length) row.append(btnEl(T('Νέα μέτρηση','New'),'ghost',reset));
  if(!P.length) row.append(btnEl(T('Αρχή = η θέση μου','Start = my position'),'ghost',useMe));
  p.append(row);
  var seg=document.createElement('div'); seg.id='ndRulSeg'; seg.style.cssText='font-size:14px;margin:4px 0'; p.append(seg);
  var cd=document.createElement('div'); cd.id='ndRulC'; cd.style.cssText='font-size:14px;margin:4px 0'; p.append(cd);
  if(P.length){ var ls=document.createElement('div'); ls.style.marginTop='6px'; var cum=0;
    P.forEach(function(q,i){ if(i) cum+=dist(P[i-1],q); var r=document.createElement('div'); r.style.cssText='display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:2px 0;border-top:1px solid var(--line,#8883)';
      var a=document.createElement('span'); a.textContent='#'+(i+1)+' · '+fmtD(cum); var b=document.createElement('span'); b.textContent=T('βάθος ','depth ')+(dep[i]===undefined?'…':dep[i]===null?'–':'≈ '+dep[i]+' m'); r.append(a,b); ls.append(r); });
    p.append(ls); }
  var nt=document.createElement('p'); nt.className='note'; nt.style.marginTop='8px';
  nt.textContent=P.length?T('Κούνα τον χάρτη ώστε ο σταυρός να πέσει στο επόμενο σημείο και πάτα «Προσθήκη σημείου». Τα βάθη είναι από το EMODnet (πλέγμα περίπου 100 m): κοντά στην ακτή ενδεικτικά, όχι ναυτικό όργανο.','Move the map so the cross sits on the next point and tap "Add point". Depths are from EMODnet (about 100 m grid): indicative near the coast, not a navigation instrument.'):T('Κούνα τον χάρτη ώστε ο σταυρός να πέσει στο σημείο εκκίνησης (π.χ. την ακτή) και πάτα «Προσθήκη σημείου».','Move the map so the cross sits on the start point (e.g. the shore) and tap "Add point".');
  p.append(nt); p.scrollTop=sc; live_(); depthC();
}
function live_(){
  var big=document.getElementById('ndRulBig'), seg=document.getElementById('ndRulSeg'); if(!big) return;
  var c=map.getCenter(), t=total(), l=null;
  if(P.length){ l=dist(P[P.length-1],c); }
  big.textContent=fmtD(t+(l||0));
  if(P.length){ var br=bearing(P[P.length-1],c); seg.textContent=T('Από το τελευταίο σημείο μέχρι τον σταυρό: ','From the last point to the cross: ')+fmtD(l)+' · '+T('πορεία ','heading ')+dirT(br); }
  else seg.textContent='';
  if(live){ map.removeLayer(live); live=null; }
  if(P.length) live=L.polyline([P[P.length-1],c],{color:'#E8743B',weight:3,dashArray:'4 8',interactive:false}).addTo(map);
}
function depthC(){
  clearTimeout(tmr); var el=document.getElementById('ndRulC'); if(el) el.textContent=T('Βάθος στον σταυρό: …','Depth at the cross: …');
  var id=++cseq; tmr=setTimeout(function(){ var c=map.getCenter(); C.depthAt(c.lat,c.lng).then(function(v){ if(id!==cseq) return; var e=document.getElementById('ndRulC'); if(e) e.textContent=T('Βάθος στον σταυρό: ','Depth at the cross: ')+(v!=null?'≈ '+v+' m':T('δεν βρέθηκε','not available')); }).catch(function(){ if(id!==cseq) return; var e=document.getElementById('ndRulC'); if(e) e.textContent=T('Βάθος στον σταυρό: δεν βρέθηκε','Depth at the cross: not available'); }); },500);
}
function drawAll(){
  [poly].concat(mk,lb).forEach(function(l){ if(l) try{ map.removeLayer(l); }catch(e){} }); poly=null; mk=[]; lb=[];
  if(P.length>1) poly=L.polyline(P,{color:'#E8743B',weight:4,interactive:false}).addTo(map);
  P.forEach(function(q,i){ mk.push(L.marker(q,{icon:dot(i?'#E8743B':'#2a7de1',i+1),interactive:false,keyboard:false,zIndexOffset:2000}).addTo(map)); if(i){ var m=L.latLng((P[i-1].lat+q.lat)/2,(P[i-1].lng+q.lng)/2); lb.push(L.marker(m,{icon:tag(fmtD(dist(P[i-1],q))),interactive:false,keyboard:false,zIndexOffset:1500}).addTo(map)); } });
}
function addPoint(){
  var c=map.getCenter(); var q=L.latLng(c.lat,c.lng); P.push(q); var i=P.length-1; dep[i]=undefined; drawAll(); render();
  C.depthAt(q.lat,q.lng).then(function(v){ dep[i]=v==null?null:v; }).catch(function(){ dep[i]=null; }).then(function(){ if(on&&P[i]===q) render(); });
}
function undo(){ P.pop(); dep.length=P.length; drawAll(); render(); }
function reset(){ P=[]; dep=[]; drawAll(); render(); }
function useMe(){
  var p=C.getPosition?C.getPosition():Promise.reject();
  Promise.resolve(p).then(function(q){ if(!q) throw 0; map.setView([q.lat,q.lon],Math.max(map.getZoom(),16)); setTimeout(function(){ if(on) addPoint(); },450); }).catch(function(){ C.toast(T('Δεν βρέθηκε η θέση σου.','Could not get your position.')); });
}
function onMove(){ live_(); }
function onEnd(){ depthC(); }
function start(){
  if(on) return; on=true; btn.setAttribute('aria-pressed','true'); btn.classList.add('on'); P=[]; dep=[]; ensureCross(); cross.style.display='block';
  map.on('move',onMove); map.on('moveend',onEnd); try{ map.closePopup(); }catch(e){} render();
}
function stop(){
  on=false; btn.setAttribute('aria-pressed','false'); btn.classList.remove('on'); map.off('move',onMove); map.off('moveend',onEnd);
  [poly,live].concat(mk,lb).forEach(function(l){ if(l) try{ map.removeLayer(l); }catch(e){} }); poly=live=null; mk=[]; lb=[]; P=[]; dep=[]; clearTimeout(tmr); cseq++;
  if(cross) cross.style.display='none'; if(panel){ panel.remove(); panel=null; }
}
btn.addEventListener('click',function(){ if(on) stop(); else start(); });
window.AlkyonRuler={start:start,stop:stop};
})();
