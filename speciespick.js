/* Επιλογή είδους ανά θαλάσσια περιοχή (Μεσόγειος, Ατλαντικός, Ειρηνικός, Ινδικός, Ερυθρά θάλασσα, Βαλτική, γλυκά νερά, Κόλπος του Μεξικού)
   και προτεινόμενα είδη για την τοποθεσία σου. Οι περιοχές είναι ενδεικτικές: δείχνουν πού συνήθως ζει ένα είδος, όχι ότι επιτρέπεται η αλιεία του. */
(function(){
'use strict';
var C=window.AlkyonCore; if(!C||!C.speciesDB||!window.SPECIES_REG) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var $=function(i){ return document.getElementById(i); };
var REG=window.SPECIES_REG, REGS=window.SPECIES_REGIONS;
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function strip(x){ return (x||'').toLowerCase().replace(/ς/g,'σ').normalize('NFD').replace(/[̀-ͯ]/g,''); }
function tagsOf(sp){ return REG[(sp.la||'').toLowerCase()]||'m'; }
function dispName(sp){ return sp.el||sp.en; }
function myPlace(){
  var c=C.getCond&&C.getCond(); if(c&&c.lat!=null) return {lat:c.lat,lon:c.lon};
  var b=(C.Store.get('bites')||[]).filter(function(x){ return typeof x.lat==='number'; }).slice(-1)[0]; if(b) return {lat:b.lat,lon:b.lon};
  return {lat:34.75,lon:32.42};
}
function autoRegion(){ var p=myPlace(); return window.regionAt(p.lat,p.lon); }
function monthIdx(){ return (+C.nicosiaToday().slice(5,7))-1; }
function history(){
  var h={}; (C.Store.get('bites')||[]).forEach(function(b){ var k=(b.latin||'').toLowerCase(); if(!k&&b.species){ var m=C.speciesDB().find(function(s){ return strip(dispName(s))===strip(b.species)||strip(s.en)===strip(b.species); }); if(m) k=m.la.toLowerCase(); } if(k) h[k]=(h[k]||0)+1; });
  return h;
}
function kbMonth(){ var o={}; (window.SPKB||[]).forEach(function(x){ if(x.l&&x.m) o[x.l.toLowerCase()]=x.m[monthIdx()]||0; }); return o; }
/* προτεινόμενα για μια περιοχή */
function suggestions(region,max){
  var db=C.speciesDB(), H=history(), K=kbMonth(), out=[];
  db.forEach(function(sp){ var k=(sp.la||'').toLowerCase(); var inReg=region==='*'||tagsOf(sp).indexOf(region)>=0; if(!inReg) return;
    var h=H[k]||0, kb=K[k]!=null?K[k]:null; var sc=(h?Math.min(h,6)*0.5:0)+(kb!=null&&kb>=2?kb:0); if(sc>0) out.push({sp:sp,sc:sc,h:h,kb:kb}); });
  out.sort(function(a,b){ return b.sc-a.sc; }); return out.slice(0,max||8);
}

/* ---------- πίνακας ---------- */
var P=el('div'); P.id='spPick'; P.hidden=true;
P.innerHTML='<div class="spcard"><div class="sphead"><b></b><button type="button" class="spx" aria-label="✕">✕</button></div><div class="spbody"></div></div>';
P.querySelector('b').textContent=T('Είδη ψαριών','Fish species'); document.body.appendChild(P);
var body=P.querySelector('.spbody'), cur='m', manual=false, query='', onPick=null;
P.querySelector('.spx').addEventListener('click',close); P.addEventListener('click',function(e){ if(e.target===P) close(); });
function close(){ P.hidden=true; }
function pick(sp){ if(onPick) onPick(sp); else C.pickSpecies(sp); close(); }
function item(sp,sub){
  var b=el('button','spitem'); b.type='button'; b.append(el('b','',dispName(sp)),el('small','',(sp.el&&sp.en&&!EN?sp.en+' · ':'')+sp.la+(sub?' · '+sub:'')));
  b.addEventListener('click',function(){ pick(sp); }); return b;
}
function render(){
  body.replaceChildren(); var auto=autoRegion();
  var chips=el('div','spchips'); [['*',T('Όλα','All')]].concat(REGS.map(function(r){ return [r[0],EN?r[2]:r[1]]; })).forEach(function(r){
    var b=el('button','spchip'+(cur===r[0]?' on':''),(r[0]===auto?'📍 ':'')+r[1]); b.type='button';
    b.addEventListener('click',function(){ cur=r[0]; manual=true; query=''; render(); }); chips.append(b); });
  body.append(chips);
  var q=el('input','sminp spq'); q.type='search'; q.placeholder=T('Αναζήτηση (όνομα ή λατινικό)','Search (name or Latin)'); q.value=query; q.autocomplete='off';
  body.append(q); var list=el('div','splist'); body.append(list);
  function fill(){
    list.replaceChildren(); var db=C.speciesDB(), qq=strip(query.trim());
    if(qq){ var res=db.filter(function(sp){ return strip((sp.el||'')+' '+(sp.en||'')+' '+sp.la+' '+(sp.alt||'')).indexOf(qq)>=0; }).slice(0,60);
      list.append(el('div','spsec',T('Αποτελέσματα σε όλες τις περιοχές','Results across all regions')));
      if(!res.length) list.append(el('div','sptx',T('Δεν βρέθηκε στη λίστα. Μπορείς να γράψεις το όνομα ελεύθερα στη φόρμα.','Not in the list. You can type the name freely in the form.')));
      res.forEach(function(sp){ list.append(item(sp)); }); return; }
    var sg=suggestions(cur,8);
    if(sg.length){ list.append(el('div','spsec',cur==='m'||cur==='*'?T('Προτεινόμενα τώρα','Suggested now'):T('Από όσα έχεις πιάσει','From your catches')));
      sg.forEach(function(x){ var tx=[]; if(x.h) tx.push(x.h+'×'); if(x.kb!=null&&x.kb>=2) tx.push(x.kb>=3?T('εποχή: κορυφή','season: peak'):T('εποχή: καλή','season: good')); list.append(item(x.sp,tx.join(' · '))); }); }
    var all=db.filter(function(sp){ return cur==='*'||tagsOf(sp).indexOf(cur)>=0; }).sort(function(a,b){ return strip(EN?(a.en||a.el):dispName(a)).localeCompare(strip(EN?(b.en||b.el):dispName(b))); });
    list.append(el('div','spsec',(cur==='*'?T('Όλα τα είδη','All species'):(REGS.filter(function(r){ return r[0]===cur; }).map(function(r){ return EN?r[2]:r[1]; })[0]))+' · '+all.length));
    all.forEach(function(sp){ list.append(item(sp)); });
    list.append(el('div','spnote',T('Οι περιοχές είναι ενδεικτικές. Δεν σημαίνει ότι επιτρέπεται η αλιεία του είδους εκεί.','Regions are indicative. It does not mean fishing the species is allowed there.')));
  }
  q.addEventListener('input',function(){ query=q.value; fill(); }); fill();
}
function open(cb){ onPick=cb||null; if(!manual){ var fpL=''; try{ fpL=localStorage.getItem('alkyon-fprof')||''; }catch(e){} cur=fpL==='lake'?'f':autoRegion(); } query=''; render(); P.hidden=false; }

window.AlkyonSpecies={open:open,suggestions:suggestions,autoRegion:autoRegion,tagsOf:tagsOf};
})();
