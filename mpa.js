/* Προστατευόμενες θαλάσσιες περιοχές Ευρώπης (EMODnet Human Activities, CC BY 4.0 – Cogea Srl / EEA). Επίπεδο WMS, χωρίς δικά μας δεδομένα. */
(function(){
'use strict';
var C=window.AlkyonCore, EN=window.LANG==='en', T=function(el,en){ return EN?en:el; };
var bz=document.getElementById('bZones'); if(!C||!bz||typeof L==='undefined') return;
var map=C.map&&C.map(); if(!map) return;
var URL='https://ows.emodnet-humanactivities.eu/wms', LAYER='nationallydesignatedareas', KEY='alkyon-mpa';
try{ map.attributionControl.setPrefix(T('Όχι για ναυσιπλοΐα','Not for navigation')+' · <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>'); }catch(e){}
var lay=L.tileLayer.wms(URL,{layers:LAYER,format:'image/png',transparent:true,version:'1.3.0',opacity:.6,attribution:'Protected areas © <a href="https://emodnet.ec.europa.eu" target="_blank" rel="noopener">EMODnet</a>/EEA, CC BY 4.0',maxZoom:19});
var b=document.createElement('button'); b.type='button'; b.className='mbtn'; b.id='bMpa';
b.setAttribute('aria-label',T('Προστατευόμενες περιοχές Ευρώπης','European protected areas')); b.title=T('Προστατευόμενες περιοχές (Ευρώπη, EMODnet) – χρειάζεται ίντερνετ','Protected areas (Europe, EMODnet) – needs internet');
b.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>';
bz.parentNode.insertBefore(b,bz.nextSibling);
function set(on){ if(on&&!map.hasLayer(lay)) lay.addTo(map); if(!on&&map.hasLayer(lay)) map.removeLayer(lay); b.setAttribute('aria-pressed',String(!!on)); C.lsSet(KEY,!!on); }
set(!!C.lsGet(KEY,false));
b.addEventListener('click',function(){ var on=!map.hasLayer(lay); set(on); if(on) try{ C.toast(T('Προστατευόμενες περιοχές: πάτα στον χάρτη για όνομα περιοχής','Protected areas: tap the map for the area name')); }catch(e){} });
/* Όνομα περιοχής με πάτημα (GetFeatureInfo) */
map.on('click',function(e){
  if(!map.hasLayer(lay)||document.body.classList.contains('picking')) return;
  var s=map.getSize(), bb=map.getBounds(), sw=map.options.crs.project(bb.getSouthWest()), ne=map.options.crs.project(bb.getNorthEast()), p=map.latLngToContainerPoint(e.latlng);
  var q='service=WMS&version=1.1.1&request=GetFeatureInfo&layers='+LAYER+'&query_layers='+LAYER+'&styles=&srs=EPSG:3857&bbox='+[sw.x,sw.y,ne.x,ne.y].join(',')+'&width='+s.x+'&height='+s.y+'&x='+Math.round(p.x)+'&y='+Math.round(p.y)+'&info_format=application/json&feature_count=5';
  fetch(URL+'?'+q).then(function(r){ return r.json(); }).then(function(j){
    var f=(j.features||[]).map(function(x){ return x.properties||{}; }); if(!f.length) return;
    var d=document.createElement('div'); d.className='pop';
    f.forEach(function(p){ var n=document.createElement('b'); n.textContent=p.SITE_NAME||p.site_name||p.NAME||'–'; var m=document.createElement('div'); m.className='meta'; m.textContent=[p.DESIG_ENG||p.desig_eng||p.DESIG,p.IUCN_CAT||p.iucn_cat?'IUCN '+(p.IUCN_CAT||p.iucn_cat):null,p.COUNTRY||p.country].filter(Boolean).join(' · '); d.append(n,m); });
    var nt=document.createElement('div'); nt.className='note'; nt.textContent=T('Δεν σημαίνει απαραίτητα απαγόρευση αλιείας. Έλεγξε τους τοπικούς κανονισμούς.','Not necessarily a fishing ban. Check local rules.'); d.append(nt);
    L.popup().setLatLng(e.latlng).setContent(d).openOn(map);
  }).catch(function(){});
});
})();
