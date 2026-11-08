/* Alkyon 4 · επιλογή θέσης με συντεταγμένες ή στον χάρτη (v31z521)
   Ίδια πεδία με την κλασική (AlkyonCoord: DD / DMS / DDM, επικόλληση συνδέσμου Google Maps),
   κουμπιά «Επικόλληση» και «Η θέση μου», και μικρός χάρτης με σταυρό για να το διαλέγεις με το δάχτυλο. */
(function(){
var B=window.AK, h=B.h, T=B.T;
var SAT='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
B.coordBox=function(lat,lon,opt){ opt=opt||{};
  var PC=window.AlkyonCoord, la=h('input',{type:'text',inputmode:'text','aria-label':T('Γεωγραφικό πλάτος','Latitude')}), lo=h('input',{type:'text',inputmode:'text','aria-label':T('Γεωγραφικό μήκος','Longitude')});
  var mapBox=h('div',{class:'cpmap',hidden:!opt.map}), mm=null, mk=null, quiet=false, msg=h('small',{class:'wn cpmsg'});
  var row=h('div',{class:'cprow'},h('label',{class:'fld'},h('span',{text:T('Πλάτος','Latitude')}),la),h('label',{class:'fld'},h('span',{text:T('Μήκος','Longitude')}),lo));
  function get(){ if(PC&&PC.get) return PC.get(la,lo); var a=parseFloat(la.value), b=parseFloat(lo.value); return isNaN(a)||isNaN(b)?null:{lat:a,lon:b}; }
  function set(a,b,fromMap){ if(typeof a!=='number'||typeof b!=='number') return; if(PC&&PC.set) PC.set(la,lo,a,b); else { la.value=a.toFixed(5); lo.value=b.toFixed(5); } if(mm&&!fromMap){ quiet=true; mm.setView([a,b],Math.max(mm.getZoom(),13)); setTimeout(function(){ quiet=false; },400); } if(opt.onChange) opt.onChange(a,b); }
  function changed(){ var g=get(); if(g){ msg.textContent=''; if(mm){ quiet=true; mm.panTo([g.lat,g.lon]); setTimeout(function(){ quiet=false; },400); } if(opt.onChange) opt.onChange(g.lat,g.lon); } }
  if(PC&&PC.bind) PC.bind(la,lo,function(){ changed(); }); else { la.addEventListener('change',changed); lo.addEventListener('change',changed); }
  function openMap(){ mapBox.hidden=false; mb.setAttribute('aria-pressed','true'); if(mbl) mbl.textContent=mbT(); if(mm){ setTimeout(function(){ mm.invalidateSize(); },60); return; }
    var g=get()||B.lastPos()||{lat:35.0,lon:33.2}, el=h('div',{class:'cpmm'});
    mapBox.append(el,h('i',{class:'cpx','aria-hidden':'true'}),h('small',{class:'cphint',text:T('Μετακίνησε τον χάρτη: η θέση είναι στο κέντρο','Move the map: the position is at the centre')}));
    /* v31z532: φόρτωσε το Leaflet αν δεν έχει ανοίξει ακόμα ο Χάρτης */
    (window.L?Promise.resolve():(B.leaflet?B.leaflet():Promise.resolve())).catch(function(){}).then(function(){ setTimeout(function(){ if(!window.L||mm) return; mm=L.map(el,{zoomControl:false,attributionControl:false}).setView([g.lat,g.lon],13); L.tileLayer(SAT,{maxZoom:18}).addTo(mm);
      mm.on('moveend',function(){ if(quiet) return; var c=mm.getCenter(); set(+c.lat.toFixed(5),+c.lng.toFixed(5),true); });
      setTimeout(function(){ mm.invalidateSize(); },300); },50); }); }
  /* 1.9.44: ο χάρτης είναι ξεχωριστό, μεγάλο κουμπί (όχι κρυμμένος στο τέλος της σειράς) */
  var mbT=function(){ return mapBox.hidden?T('Διάλεξε στον χάρτη','Pick on the map'):T('Κλείσε τον χάρτη','Close the map'); };
  var mb=h('button',{type:'button',class:'btn cpmapb','aria-pressed':String(!!opt.map),onclick:function(){ if(mapBox.hidden) openMap(); else { mapBox.hidden=true; mb.setAttribute('aria-pressed','false'); } mbl.textContent=mbT(); }},h('i',{class:'cpmi',html:B.iconSvg?B.iconSvg('map'):''})), mbl=h('span',{text:T('Διάλεξε στον χάρτη','Pick on the map')}); mb.append(mbl);
  var tools=h('div',{class:'chips cptools'},
    h('button',{type:'button',class:'chip sm',text:'📋 '+T('Επικόλληση','Paste'),onclick:function(){ if(!navigator.clipboard||!navigator.clipboard.readText){ msg.textContent=T('Κράτα πατημένο το πεδίο «Πλάτος» και επικόλλησε εκεί.','Long-press the Latitude field and paste there.'); return; }
      navigator.clipboard.readText().then(function(t){ var p=PC&&PC.parsePair?PC.parsePair(t):null; if(p){ set(p[0],p[1]); msg.textContent=''; } else msg.textContent=T('Δεν βρήκα συντεταγμένες στο πρόχειρο.','No coordinates found on the clipboard.'); }).catch(function(){ msg.textContent=T('Δεν δόθηκε πρόσβαση στο πρόχειρο. Επικόλλησε στο πεδίο «Πλάτος».','No clipboard access. Paste into the Latitude field.'); }); }}),
    h('button',{type:'button',class:'chip sm',text:'📍 '+T('Η θέση μου','My position'),onclick:function(){ msg.textContent=T('Βρίσκω τη θέση σου…','Finding your position…'); B.locate(8000).then(function(p){ if(p){ set(+p.lat.toFixed(5),+p.lon.toFixed(5)); msg.textContent=''; } else msg.textContent=T('Δεν βρέθηκε θέση.','No position found.'); }); }}),
    h('button',{type:'button',class:'chip sm',text:'📷 '+T('Από εικόνα','From image'),title:T('Screenshot ή φωτογραφία του plotter','Plotter screenshot or photo'),onclick:function(){ /* 1.9.18 */
      msg.textContent=''; B.loadScripts(['coordscan.js']).then(function(){ return B.coordScan.pick(); }).then(function(p){ if(p){ set(p.lat,p.lon); changed(); } }).catch(function(){ msg.textContent=T('Δεν φόρτωσε. Έλεγξε τη σύνδεση.','Did not load. Check the connection.'); }); }}),
    null);
  var el=h('div',{class:'cpbox'},row,opt.noMap?null:mb,tools,h('small',{class:'note cpnote',text:T('Διάλεξε μορφή (όπως στο plotter σου) ή πάτα «Επικόλληση» για συντεταγμένες ή σύνδεσμο Google Maps από το πρόχειρο.','Pick the format (as on your plotter), or tap “Paste” for coordinates or a Google Maps link from the clipboard.')}),msg,mapBox);
  /* 1.9.55: η αρχική θέση μπαίνει μόνο αν στο μεταξύ δεν έχει δοθεί άλλη (αλλιώς έσβηνε το σημείο που διάλεξες στον μεγάλο χάρτη) */
  var setN=0, set0=set; set=function(){ setN++; return set0.apply(null,arguments); };
  if(typeof lat==='number'&&typeof lon==='number'){ var n0=setN; setTimeout(function(){ if(setN===n0) set0(lat,lon); },0); }
  if(opt.map) setTimeout(openMap,0);
  return {el:el,get:get,set:set,openMap:openMap};
};
/* κοντινά μαγαζιά ψαρικής: Google Maps γύρω από τη θέση σου (τίποτα δεν αποθηκεύεται), ίδιο με τον Οδηγό */
B.nearShops=function(){ var go=function(la,lo,z){ window.open('https://www.google.com/maps/search/fishing+tackle+store'+(la!=null?'/@'+la.toFixed(5)+','+lo.toFixed(5)+','+z+'z':''),'_blank','noopener'); };
  var fb=function(){ var c=B.lastPos(); if(c) go(c.lat,c.lon,13); else go(null,null,0); };
  if(!navigator.geolocation){ fb(); return; } navigator.geolocation.getCurrentPosition(function(p){ go(p.coords.latitude,p.coords.longitude,14); },fb,{enableHighAccuracy:false,timeout:8000,maximumAge:300000}); };
})();
