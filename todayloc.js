/* «Σήμερα»: επιλογή τοποθεσίας για τον καιρό και τον δείκτη, όπως στην Πρόγνωση. Δεν αλλάζει τη θέση που καταγράφεται στα τσιμπήματα. */
(function(){
'use strict';
var C=window.AlkyonCore, box=document.getElementById('liveBox'); if(!C||!box||!C.viewPlace) return;
var EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var sel='gps';
var top=box.querySelector('.h2top'); if(!top) return;
var lab=top.querySelector('.label'), baseLabel=lab?lab.textContent:'';
var wrap=document.createElement('div'); wrap.id='tdLoc'; top.parentNode.insertBefore(wrap,top.nextSibling);
function el(tag,cls,txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function places(){ try{ return window.AlkyonPlaces?AlkyonPlaces.list():JSON.parse(localStorage.getItem('alkyon-places')||'[]'); }catch(e){ return []; } }
function mark(p){ sel=p.gps?'gps':p.id; if(lab){ lab.textContent=p.gps?baseLabel:T('Καιρός για: ','Weather for: ')+p.name; lab.classList.toggle('viewing',!p.gps); } try{ document.dispatchEvent(new CustomEvent('alkyon-viewname',{detail:p.gps?null:p.name})); }catch(e){} }
function pick(p){ mark(p); C.viewPlace(p); render(); try{ if(window.AlkyonPlaces){ if(p.gps&&AlkyonPlaces.selectGps) AlkyonPlaces.selectGps(); else if(AlkyonPlaces.select) AlkyonPlaces.select(p.id); } }catch(e){} }
/* ώστε η αναζήτηση της αρχικής και η Πρόγνωση να δείχνουν εδώ την ίδια τοποθεσία */
window.AlkyonTodayLoc={sync:function(p){ if(!p) return; mark(p); render(); }};
function svg(d){ var w=document.createElement('span'); w.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>'; return w.firstChild; }
function lp(b,fn,tap){ /* παρατεταμένο πάτημα = διαγραφή, κανονικό = επιλογή */
  var tm=null, fired=false;
  function cancel(){ if(tm){ clearTimeout(tm); tm=null; } }
  b.addEventListener('pointerdown',function(){ fired=false; cancel(); tm=setTimeout(function(){ tm=null; fired=true; try{ if(navigator.vibrate) navigator.vibrate(30); }catch(e){} fn(); },650); });
  ['pointerup','pointerleave','pointercancel','pointermove'].forEach(function(ev){ b.addEventListener(ev,function(e){ if(ev==='pointermove'){ return; } cancel(); }); });
  b.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  b.addEventListener('click',function(e){ if(fired){ fired=false; e.preventDefault(); return; } tap(); });
}
async function del(p){
  var ok=true; try{ if(window.AlkyonAsk) ok=await window.AlkyonAsk((EN?'Delete ':'Διαγραφή ')+'«'+p.name+'»;',{title:EN?'Delete location':'Διαγραφή τοποθεσίας',ok:EN?'Delete':'Διαγραφή',danger:true}); }catch(e){}
  if(!ok) return;
  var was=sel===p.id; try{ if(window.AlkyonPlaces&&AlkyonPlaces.remove) AlkyonPlaces.remove(p.id); }catch(e){}
  if(was) pick({gps:true}); else render();
}
function render(){
  wrap.replaceChildren();
  var chips=el('div','chips tdchips');
  var g=el('button','chip gpschip',T('Η θέση μου','My location')); g.type='button'; g.setAttribute('aria-pressed',String(sel==='gps')); g.addEventListener('click',function(){ pick({gps:true}); }); chips.append(g);
  places().forEach(function(p){ var b=el('button','chip',p.name); b.type='button'; b.setAttribute('aria-pressed',String(sel===p.id)); lp(b,function(){ del(p); },function(){ pick(p); }); chips.append(b); });
  wrap.append(chips);
  if(places().length){ var hint=el('div','note',T('Παρατεταμένο πάτημα σε τοποθεσία = διαγραφή','Long-press a location to delete it')); hint.style.cssText='font-size:11px;opacity:.6;margin:4px 0 0'; wrap.append(hint); }
  /* ίδια μορφή με την Πρόγνωση: πεδίο αναζήτησης + εικονίδια */
  var bar=el('div','plbar'), s=el('div','plsearch'); var inp=el('input'); inp.type='search'; inp.maxLength=60; inp.placeholder=T('Αναζήτηση π.χ. Λεμεσός','Search e.g. Limassol'); inp.autocomplete='off'; inp.setAttribute('aria-label',T('Αναζήτηση τοποθεσίας','Search location'));
  var go=el('button','plgo'); go.type='button'; go.setAttribute('aria-label',T('Αναζήτηση','Search')); go.appendChild(svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>')); s.append(inp,go); bar.append(s);
  var spots=(C.Store.get('spots')||[]).filter(function(x){ return typeof x.lat==='number'&&typeof x.lon==='number'; });
  var res=el('div','list'); var sp=el('div','chips'); sp.hidden=true;
  if(spots.length){
    var sb=el('button','plic'); sb.type='button'; sb.setAttribute('aria-label',T('Από τα σημεία μου','From my spots')); sb.title=T('Από τα σημεία μου','From my spots'); sb.appendChild(svg('<path d="M12 21s-6-5.6-6-10.2A6 6 0 0 1 18 10.8C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>')); sb.addEventListener('click',function(){ sp.hidden=!sp.hidden; }); bar.append(sb);
    spots.forEach(function(x){ var b=el('button','chip',x.name||T('Σημείο','Spot')); b.type='button'; b.addEventListener('click',function(){ choose(x.name||T('Σημείο','Spot'),x.lat,x.lon); }); sp.append(b); });
  }
  var mb=el('button','plic'); mb.type='button'; mb.setAttribute('aria-label',T('Επιλογή στον χάρτη','Pick on map')); mb.title=T('Επιλογή στον χάρτη','Pick on map'); mb.appendChild(svg('<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14M15 6v14"/>')); mb.addEventListener('click',function(){ window.dispatchEvent(new Event('alkyon-picktoday')); }); bar.append(mb);
  wrap.append(bar,res,sp);
  var doSearch=function(){
    var q=inp.value.trim(); res.replaceChildren(); if(q.length<2) return; try{ inp.blur(); }catch(x){} /* κλείνει το πληκτρολόγιο ώστε να φαίνονται τα αποτελέσματα */ res.append(el('div','note',T('Αναζήτηση…','Searching…')));
    fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=6&format=json&language='+(EN?'en':'el')).then(function(r){ return r.json(); }).then(function(j){
      res.replaceChildren(); var rs=(j&&j.results)||[]; if(!rs.length){ res.append(el('div','note',T('Δεν βρέθηκε τοποθεσία.','No location found.'))); setTimeout(function(){ try{ res.scrollIntoView({behavior:'smooth',block:'center'}); }catch(x){} },150); return; }
      setTimeout(function(){ try{ res.scrollIntoView({behavior:'smooth',block:'center'}); }catch(x){} },250);
      rs.forEach(function(x){ var label=[x.name,x.admin1,x.country].filter(Boolean).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
        var it=el('button','item plres'); it.type='button'; it.append(el('b',null,x.name),el('span','meta',label)); it.addEventListener('click',function(){ choose(x.name,x.latitude,x.longitude); }); res.append(it); });
    }).catch(function(){ res.replaceChildren(el('div','note',T('Η αναζήτηση δεν δούλεψε. Έλεγξε τη σύνδεση.','Search failed. Check your connection.'))); });
  };
  go.addEventListener('click',doSearch); inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); doSearch(); } });
}
window.addEventListener('alkyon-todaypick',function(e){
  var d=e.detail; if(!d) return; var nm=(EN?'Point ':'Σημείο ')+(window.AlkyonCoord?AlkyonCoord.fmt(d.lat,d.lon):d.lat.toFixed(3)+', '+d.lon.toFixed(3));
  var p=null; try{ p=window.AlkyonPlaces?AlkyonPlaces.add(nm,d.lat,d.lon):null; }catch(x){}
  if(!p) p={id:'t'+Math.round(d.lat*100)+'_'+Math.round(d.lon*100),name:nm,lat:d.lat,lon:d.lon};
  pick(p);
  fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language='+(EN?'en':'el')+'&lat='+d.lat+'&lon='+d.lon).then(function(r){ return r.ok?r.json():null; }).then(function(j){
    var a=(j&&j.address)||{}, n=a.suburb||a.village||a.town||a.city||a.hamlet||a.neighbourhood||a.municipality||(j&&j.name)||''; if(!n||!window.AlkyonPlaces||!AlkyonPlaces.rename) return;
    AlkyonPlaces.rename(p.id,n); p.name=n; if(sel===p.id){ if(lab) lab.textContent=T('Καιρός για: ','Weather for: ')+n; try{ document.dispatchEvent(new CustomEvent('alkyon-viewname',{detail:n})); }catch(e){} render(); }
  }).catch(function(){});
});
function choose(name,lat,lon){
  var p=null; try{ p=window.AlkyonPlaces?AlkyonPlaces.add(name,lat,lon):null; }catch(e){}
  if(!p) p={id:'t'+Math.round(lat*100)+'_'+Math.round(lon*100),name:name,lat:lat,lon:lon};
  pick(p);
}
render();
try{ new MutationObserver(function(){ var t=document.getElementById('tab-today'); if(t&&!t.hidden&&!document.activeElement.matches('input')) render(); }).observe(document.getElementById('tab-today'),{attributes:true,attributeFilter:['hidden']}); }catch(e){}
})();
