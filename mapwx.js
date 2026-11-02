/* Κάρτα καιρού πάνω στον χάρτη, με επιλογή στοιχείων (πατάς την κάρτα για να διαλέξεις τι θα φαίνεται). */
(function(){
'use strict';
var C=window.AlkyonCore, box=document.querySelector('.mapbox'); if(!C||!box) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var KEY='alkyon-mapwx-items', DEF=['wind','press','sst'];
var TR={fast:'↓↓',slow:'↓',stable:'→',rise:'↑'};
var DIRS=['N','NE','E','SE','S','SW','W','NW'];
var ITEMS=[
  ['wind','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 6l6 6-6 6"/></svg>',T('Άνεμος','Wind'),function(c){ if(c.wind==null) return null; var wp=window.AlkyonUnits.windP(c.wind), d=c.windDeg!=null?DIRS[Math.round((((c.windDeg%360)+360)%360)/45)%8]:''; return [wp[0],(wp[1]+' '+d).trim()]; }],
  ['press','<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 12l4-4M8 4.5M12 5v1.5M5.5 8l1 .8M18.5 8l-1 .8"/></svg>',T('Πίεση','Pressure'),function(c){ if(c.press==null) return null; var pp=window.AlkyonUnits.pressP(c.press); return [pp[0],pp[1]+' '+(c.pd3!=null?(c.pd3<=-3?'↓↓':c.pd3<=-0.5?'↓':c.pd3>=3?'↑↑':c.pd3>=0.5?'↑':'→'):(TR[c.ptrend]||''))]; } /* v31z351: ίδιο όριο (±0,5 hPa/3h) με την κάρτα «Τάση πίεσης» */],
  ['sst','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9c3-3 5-3 7 0s4 3 7 0 3-2 4-1"/><path d="M3 15c3-3 5-3 7 0s4 3 7 0 3-2 4-1"/></svg>',T('Θερμ. νερού','Water temp'),function(c){ if(c.sst==null) return null; var t=window.AlkyonUnits.tempP(c.sst); return [t[0]+'°',T('θάλασσα','sea')]; }],
  ['air','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z"/></svg>',T('Θερμ. αέρα','Air temp'),function(c){ if(c.temp==null) return null; var t=window.AlkyonUnits.tempP(c.temp); return [t[0]+'°',T('αέρας','air')]; }],
  ['wave','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2.5-4 4.5-4 7 0s4.500 4 7 0 3.500-3 6-2"/></svg>',T('Κύμα','Wave'),function(c){ if(c.wave==null) return null; var wv=window.AlkyonUnits.waveP(c.wave); return [wv[0],T('κύμα ','wave ')+wv[1]]; }],
  ['period','<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.500 2M9.500 3h5"/></svg>',T('Περίοδος κύματος','Wave period'),function(c){ return c.wavePeriod?[Math.round(c.wavePeriod)+'',T('δευτ.','sec')]:null; }]
];
var el=document.createElement('div'); el.className='mapwx'; el.hidden=true; box.appendChild(el);
var editing=false;
function sel(){ var v=C.lsGet(KEY,null); return Array.isArray(v)?v:DEF.slice(); }
function draw(){
  var c=(C.getViewCond||C.getCond)(); if(!c){ el.hidden=true; document.body.classList.remove('hasmw'); return; }
  var on=sel(); el.hidden=false; document.body.classList.add('hasmw'); el.replaceChildren(); el.classList.toggle('edit',editing);
  var row=document.createElement('div'); row.className='mwrow';
  ITEMS.forEach(function(it){
    if(editing||on.indexOf(it[0])<0) return;
    var v=it[3](c), d=document.createElement('div'); d.className='mw'+(v?'':' na');
    var i=document.createElement('i'); i.innerHTML=it[1]; var b=document.createElement('b'); b.textContent=v?v[0]:'–'; var s=document.createElement('span'); s.textContent=v?v[1]:it[2];
    d.append(i,b,s); row.append(d);
  });
  if(!row.childNodes.length){ var m=document.createElement('span'); m.className='mwempty'; m.textContent=T('Πάτα για να διαλέξεις στοιχεία','Tap to choose items'); row.append(m); }
  el.dataset.n=editing?'0':String(Math.min(on.length,6)); document.body.classList.toggle('wxedit',editing);
  if(editing){ var ttl=document.createElement('div'); ttl.className='mwtitle'; ttl.textContent=T('Στοιχεία καιρού','Weather items'); row.append(ttl); }
  var g=document.createElement('button'); g.type='button'; g.className='mwgear'; g.textContent=editing?'✓':'⚙'; g.setAttribute('aria-label',T('Επιλογή στοιχείων καιρού','Choose weather items'));
  row.append(g); el.append(row);
  if(editing){
    var ch=document.createElement('div'); ch.className='mwchips';
    ITEMS.forEach(function(it){
      var b=document.createElement('button'); b.type='button'; b.className='mwchip'; b.setAttribute('aria-pressed',String(on.indexOf(it[0])>=0)); b.innerHTML=it[1]+'<span>'+it[2]+'</span>';
      b.addEventListener('click',function(e){ e.stopPropagation(); var cur=sel(), i=cur.indexOf(it[0]); if(i>=0) cur.splice(i,1); else cur.push(it[0]); cur=ITEMS.map(function(x){ return x[0]; }).filter(function(k){ return cur.indexOf(k)>=0; }); C.lsSet(KEY,cur); draw(); });
      ch.append(b);
    });
    el.append(ch);
  }
}
el.addEventListener('click',function(){ editing=!editing; draw(); });
document.addEventListener('alkyon-cond',function(){ setTimeout(draw,50); });
document.addEventListener('alkyon-view',function(){ setTimeout(draw,50); });
function place(){
  var sb=document.getElementById('sessBar'), full=document.body.classList.contains('mapfull');
  el.style.top=(sb&&full&&sb.offsetParent!==null)?Math.round(sb.getBoundingClientRect().bottom+8)+'px':'';
}
function row(){
  var b=document.body, line=false;
  if(b.classList.contains('mapfull')){
    var W=box.clientWidth, ww=el.offsetWidth, side=8;
    var lx=Math.max(Math.round((W-ww)/2),8);
    if(!el.hidden){ el.style.setProperty('left',lx+'px','important'); line=(lx>=side&&lx+ww<=W-side); }
  } else el.style.removeProperty('left');
  b.classList.toggle('wxline',line);
}
setInterval(function(){ place(); row(); },400);
setTimeout(draw,800); setTimeout(draw,3500);
})();

/* Παράθυρο πληροφοριών: κεντράρεται και φαίνεται ολόκληρο (και το ψάρι από κάτω) ανάμεσα στην κάρτα καιρού και τα κουμπιά */
(function(){
var Cc=window.AlkyonCore, map=Cc&&Cc.map&&Cc.map(); if(!map) return;
function fit(p){
  var el=p&&p.getElement&&p.getElement(); if(!el||!p._map) return;
  var mr=map.getContainer().getBoundingClientRect(), r=el.getBoundingClientRect();
  var topLim=mr.top+64, botLim=mr.bottom-70-38; /* χώρος για το εικονίδιο κάτω από το popup και τη γραμμή αναφορών */
  var dx=(mr.left+(112+(mr.width-58))/2)-(r.left+r.width/2), dy=0;
  if(r.bottom>botLim) dy=botLim-r.bottom;
  if(r.top+dy<topLim) dy=topLim-r.top;
  if(Math.abs(dx)>1||Math.abs(dy)>1) map.panBy([-dx,-dy],{animate:true,duration:.3});
}
map.on('popupopen',function(e){
  var p=e.popup; setTimeout(function(){ fit(p); },40);
  var im=p.getElement&&p.getElement()&&p.getElement().querySelector('img');
  if(im&&!im.complete) im.addEventListener('load',function(){ fit(p); },{once:true});
});
})();
