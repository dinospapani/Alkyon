/* Alkyon 4 · Εισαγωγή από plotter, GPS και ρολόι κατάδυσης.
   - GPX (Garmin, Lowrance, Simrad, Raymarine, Humminbird, Navionics, OpenCPN): waypoints → σημεία (με βάθος αν υπάρχει), tracks → έξοδοι με διαδρομή
   - KML (Google Earth / My Maps): Placemark σημεία → σημεία, γραμμές → διαδρομές
   - CSV: στήλες γεωγραφικό πλάτος / μήκος / όνομα / βάθος (αναγνωρίζονται αυτόματα)
   - FIT / UDDF (Garmin Descent, Suunto, Shearwater κ.ά.): καταδύσεις, με τον κοινό κώδικα της κλασικής (../divelog.js, alkyon-dives)
   Όλα γίνονται στο κινητό, τίποτα δεν στέλνεται. Πριν την αποθήκευση δείχνει προεπισκόπηση και παραλείπει διπλά. */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
function S(){ return B.store; }
function num(v){ v=parseFloat(String(v).replace(',','.')); return isFinite(v)?v:null; }
function km(a,b,c,d){ var R=Math.PI/180, dl=(c-a)*R, dn=(d-b)*R, x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a*R)*Math.cos(c*R)*Math.sin(dn/2)*Math.sin(dn/2); return 12742*Math.asin(Math.min(1,Math.sqrt(x))); }
function ok(la,lo){ return la!=null&&lo!=null&&Math.abs(la)<=90&&Math.abs(lo)<=180&&!(la===0&&lo===0); }
function kids(el,name){ return [].slice.call(el.getElementsByTagName('*')).filter(function(n){ return (n.localName||n.nodeName).toLowerCase()===name; }); }
function txt(el,name){ var n=kids(el,name)[0]; return n?(n.textContent||'').trim():''; }
/* βάθος σε waypoint: Garmin gpxx:Depth, Lowrance/Humminbird *depth*, ή αρνητικό ύψος (ele) */
function depthOf(el){ var d=null; [].slice.call(el.getElementsByTagName('*')).some(function(n){ var nm=(n.localName||n.nodeName).toLowerCase(); if(/depth/.test(nm)){ var v=num(n.textContent); if(v!=null){ d=Math.abs(v); return true; } } return false; });
  if(d==null){ var e=num(txt(el,'ele')); if(e!=null&&e<0) d=Math.abs(e); } return d!=null&&d>0&&d<3000?Math.round(d*10)/10:null; }
function thin(pts){ if(pts.length<=400) return pts; var k=Math.ceil(pts.length/400); return pts.filter(function(_,i){ return i%k===0||i===pts.length-1; }); }
function trackOf(name,pts){ var m=0; for(var i=1;i<pts.length;i++) m+=km(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]);
  var ts=pts.map(function(p){ return p[2]; }).filter(Boolean); return {name:name||'',pts:thin(pts.map(function(p){ return [+p[0].toFixed(5),+p[1].toFixed(5)]; })),km:Math.round(m*10)/10,t0:ts.length?Math.min.apply(null,ts):null,t1:ts.length?Math.max.apply(null,ts):null,n:pts.length}; }

function parseGpx(text){ var x=new DOMParser().parseFromString(text,'application/xml'); if(x.getElementsByTagName('parsererror').length) throw new Error('xml');
  var out={wp:[],tr:[]};
  kids(x,'wpt').forEach(function(w){ var la=num(w.getAttribute('lat')), lo=num(w.getAttribute('lon')); if(!ok(la,lo)) return; out.wp.push({name:txt(w,'name')||txt(w,'desc')||'',notes:txt(w,'desc')||txt(w,'cmt')||'',lat:la,lon:lo,depth:depthOf(w),sym:txt(w,'sym')}); });
  kids(x,'trk').forEach(function(t){ var pts=[]; kids(t,'trkpt').forEach(function(p){ var la=num(p.getAttribute('lat')), lo=num(p.getAttribute('lon')), tm=Date.parse(txt(p,'time'))||null; if(ok(la,lo)) pts.push([la,lo,tm]); }); if(pts.length>1) out.tr.push(trackOf(txt(t,'name'),pts)); });
  kids(x,'rte').forEach(function(r){ var pts=[]; kids(r,'rtept').forEach(function(p){ var la=num(p.getAttribute('lat')), lo=num(p.getAttribute('lon')); if(ok(la,lo)) pts.push([la,lo,null]); }); if(pts.length>1) out.tr.push(trackOf(txt(r,'name')||T('Πορεία','Route'),pts)); });
  return out; }
function parseKml(text){ var x=new DOMParser().parseFromString(text,'application/xml'); if(x.getElementsByTagName('parsererror').length) throw new Error('xml');
  var out={wp:[],tr:[]};
  kids(x,'placemark').forEach(function(pm){ var nm=txt(pm,'name'), ds=txt(pm,'description').replace(/<[^>]+>/g,' ').trim();
    kids(pm,'point').forEach(function(pt){ var c=txt(pt,'coordinates').split(','); var lo=num(c[0]), la=num(c[1]), al=num(c[2]); if(ok(la,lo)) out.wp.push({name:nm,notes:ds,lat:la,lon:lo,depth:al!=null&&al<0?Math.abs(al):null}); });
    kids(pm,'linestring').forEach(function(ln){ var pts=txt(ln,'coordinates').split(/\s+/).map(function(s){ var c=s.split(','); return [num(c[1]),num(c[0]),null]; }).filter(function(p){ return ok(p[0],p[1]); }); if(pts.length>1) out.tr.push(trackOf(nm,pts)); }); });
  return out; }
function parseCsv(text){ var lines=text.replace(/^﻿/,'').split(/\r?\n/).filter(function(l){ return l.trim(); }); if(!lines.length) throw new Error('empty');
  var sep=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?';':lines[0].indexOf('\t')>=0?'\t':',';
  function cells(l){ var o=[], cur='', q=false; for(var i=0;i<l.length;i++){ var ch=l[i]; if(ch==='"'){ if(q&&l[i+1]==='"'){ cur+='"'; i++; } else q=!q; } else if(ch===sep&&!q){ o.push(cur); cur=''; } else cur+=ch; } o.push(cur); return o.map(function(s){ return s.trim(); }); }
  var hd=cells(lines[0]).map(function(s){ return s.toLowerCase(); }), find=function(re){ for(var i=0;i<hd.length;i++) if(re.test(hd[i])) return i; return -1; };
  var iLa=find(/^(lat|latitude|πλάτος|y)$|lat/), iLo=find(/^(lon|lng|long|longitude|μήκος|x)$|lon|lng/), iN=find(/name|όνομα|title|label|ident/), iD=find(/depth|βάθος/), iNo=find(/note|desc|comment|σημείωσ|σχόλ/), start=1;
  if(iLa<0||iLo<0){ iLa=0; iLo=1; iN=2; iD=-1; iNo=-1; start=num(cells(lines[0])[0])!=null?0:1; }
  var out={wp:[],tr:[]}, P=window.AlkyonCoord;
  lines.slice(start).forEach(function(l){ var c=cells(l), la=num(c[iLa]), lo=num(c[iLo]);
    if((la==null||lo==null)&&P&&P.parse){ try{ var pp=P.parse((c[iLa]||'')+' '+(c[iLo]||'')); if(pp){ la=pp.lat; lo=pp.lon; } }catch(e){} }
    if(ok(la,lo)) out.wp.push({name:iN>=0?c[iN]||'':'',notes:iNo>=0?c[iNo]||'':'',lat:la,lon:lo,depth:iD>=0&&num(c[iD])!=null?Math.abs(num(c[iD])):null}); });
  return out; }

/* ---------- αποθήκευση ---------- */
function existsSpot(w){ return S().raw('spots').some(function(s){ return !s.deleted&&typeof s.lat==='number'&&km(s.lat,s.lon,w.lat,w.lon)<0.03&&(!w.name||!s.name||String(s.name).toLowerCase()===String(w.name).toLowerCase()); }); }
function existsTrip(t){ return S().raw('trips').some(function(x){ return !x.deleted&&t.t0&&x.startMs&&Math.abs(x.startMs-t.t0)<60000; }); }
function day(ms){ var d=new Date(ms); return d.getFullYear()+'-'+B.pad(d.getMonth()+1)+'-'+B.pad(d.getDate()); }
function saveAll(res,sel,src){ var ns=0, nt=0;
  res.wp.forEach(function(w,i){ if(!sel.wp[i]) return; var o={name:(w.name||T('Σημείο','Spot')+' '+(i+1)).slice(0,60),lat:+w.lat.toFixed(6),lon:+w.lon.toFixed(6),type:'',notes:[w.notes,src?T('Εισαγωγή: ','Imported: ')+src:''].filter(Boolean).join(' · ').slice(0,300)}; if(w.depth!=null) o.depth=w.depth; S().save('spots',o); ns++; });
  res.tr.forEach(function(t,i){ if(!sel.tr[i]) return; var t0=t.t0||Date.now(), t1=t.t1||t0, mid=t.pts[Math.floor(t.pts.length/2)];
    S().save('trips',{date:day(t0),spot:(t.name||T('Διαδρομή','Track')).slice(0,60),startMs:t.t0||undefined,endMs:t.t1||undefined,manual:!t.t0,count:0,kg:0,km:t.km,track:t.pts,lat:mid[0],lon:mid[1],notes:T('Εισαγωγή διαδρομής','Imported track')+(src?': '+src:'')}); nt++; });
  return {ns:ns,nt:nt}; }

/* ---------- προεπισκόπηση ---------- */
function preview(res,file,sh0){
  var sel={wp:res.wp.map(function(w){ return !existsSpot(w); }),tr:res.tr.map(function(t){ return !existsTrip(t); })}, body=h('div',{class:'bform'}), sh;
  var dupW=sel.wp.filter(function(v){ return !v; }).length, dupT=sel.tr.filter(function(v){ return !v; }).length;
  function line(on,title,sub,fn){ var cb=h('input',{type:'checkbox',checked:on}); cb.addEventListener('change',function(){ fn(cb.checked); count(); }); return h('label',{class:'imrow'},cb,h('span',{class:'tx'},h('b',{text:title}),h('small',{text:sub}))); }
  var go=h('button',{class:'btn pri full',type:'button'});
  function count(){ var a=sel.wp.filter(Boolean).length, b=sel.tr.filter(Boolean).length; go.textContent=T('Εισαγωγή ','Import ')+[a?a+' '+T(a===1?'σημείου':'σημείων',a===1?'spot':'spots'):'',b?b+' '+T(b===1?'διαδρομής':'διαδρομών',b===1?'track':'tracks'):''].filter(Boolean).join(T(' και ',' and ')); go.disabled=!a&&!b; }
  body.append(h('p',{class:'sub',text:file.name+' · '+res.wp.length+' '+T('σημεία','waypoints')+' · '+res.tr.length+' '+T('διαδρομές','tracks')+((dupW||dupT)?' · '+(dupW+dupT)+T(' υπάρχουν ήδη (δεν επιλέχθηκαν)',' already exist (not selected)'):'')}));
  if(res.wp.length){ var l1=h('div',{class:'imlist'}); res.wp.slice(0,300).forEach(function(w,i){ l1.append(line(sel.wp[i],w.name||T('Σημείο ','Spot ')+(i+1),(window.AlkyonCoord?AlkyonCoord.fmt(w.lat,w.lon):w.lat.toFixed(5)+', '+w.lon.toFixed(5))+(w.depth!=null?' · '+w.depth+' m':'')+(sel.wp[i]?'':' · '+T('υπάρχει ήδη','already exists')),function(v){ sel.wp[i]=v; })); });
    body.append(h('h3',{class:'h3',text:T('Σημεία (waypoints)','Waypoints')}),l1); }
  if(res.tr.length){ var l2=h('div',{class:'imlist'}); res.tr.forEach(function(t,i){ l2.append(line(sel.tr[i],t.name||T('Διαδρομή ','Track ')+(i+1),(t.t0?new Date(t.t0).toLocaleString(EN?'en-GB':'el-GR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' · ':'')+t.km+' km · '+t.n+T(' σημεία',' points'),function(v){ sel.tr[i]=v; })); });
    body.append(h('h3',{class:'h3',text:T('Διαδρομές → έξοδοι','Tracks → trips')}),l2); }
  go.addEventListener('click',function(){ var r=saveAll(res,sel,file.name); sh.close(); if(sh0) sh0.close(true); B.toast(T('Εισήχθησαν ','Imported ')+r.ns+T(' σημεία και ',' spots and ')+r.nt+T(' διαδρομές.',' tracks.')); if(r.ns&&B.mapGo){ var w=res.wp.filter(function(_,i){ return sel.wp[i]; })[0]; if(w) setTimeout(function(){ B.mapGo(w.lat,w.lon,12); },400); } });
  count(); body.append(go); sh=B.sheet({title:T('Προεπισκόπηση εισαγωγής','Import preview'),body:body,stack:true});
}
function handle(file,msg,sh0){
  var n=(file.name||'').toLowerCase(); msg.textContent=T('Ανάγνωση…','Reading…');
  if(/\.(fit|uddf|udcf|xml)$/.test(n)&&!/\.gpx$/.test(n)&&window.AlkyonDiveLog&&(/\.fit$/.test(n)||/\.uddf$/.test(n))){
    var r=new FileReader(), fit=/\.fit$/.test(n); r.onerror=function(){ msg.textContent=T('Δεν διαβάστηκε το αρχείο.','Could not read the file.'); };
    r.onload=function(){ try{ var res=fit?AlkyonDiveLog.parseFit(r.result):AlkyonDiveLog.parseUddf(r.result), a=ls.get('alkyon-dives',[])||[], id=String(res.start)+'-'+res.dives.length;
        if(a.some(function(s){ return s.id===id; })){ msg.textContent=T('Αυτό το αρχείο έχει ήδη εισαχθεί.','This file was already imported.'); return; }
        res.id=id; res.src=fit?'fit':'uddf'; res.name=(file.name||'').slice(0,60); a.push(res); ls.set('alkyon-dives',a);
        msg.textContent=T('Εισήχθησαν ','Imported ')+res.dives.length+T(' καταδύσεις. Φαίνονται στο Ημερολόγιο › Έξοδοι, με τύπο ψαρέματος «Ψαροντούφεκο».',' dives. They show in Logbook › Trips with the Spearfishing type.'); }
      catch(e){ msg.textContent=(e&&e.message==='nodives')?T('Δεν βρέθηκαν καταδύσεις (χρειάζονται δεδομένα βάθους). Αν είναι διαδρομή GPS από ρολόι, εξήγαγέ την ως GPX.','No dives found (depth data needed). If it is a GPS route from a watch, export it as GPX.'):T('Το αρχείο δεν αναγνωρίστηκε.','The file was not recognised.'); } };
    if(fit) r.readAsArrayBuffer(file); else r.readAsText(file); return; }
  if(/\.(kmz|usr|adm|fsh|gdb)$/.test(n)){ msg.textContent=T('Αυτή η μορφή είναι κλειστή του κατασκευαστή. Από το plotter ή την εφαρμογή του κάνε εξαγωγή σε GPX και φέρε αυτό το αρχείο.','This is a closed manufacturer format. Export to GPX from the plotter or its app and import that file.'); return; }
  file.text().then(function(t){ var res=/\.kml$/.test(n)||/<kml[\s>]/i.test(t.slice(0,500))?parseKml(t):/\.csv$|\.txt$/.test(n)?parseCsv(t):parseGpx(t);
    if(!res.wp.length&&!res.tr.length){ msg.textContent=T('Δεν βρέθηκαν σημεία ή διαδρομές στο αρχείο.','No waypoints or tracks found in the file.'); return; }
    msg.textContent=''; preview(res,file,sh0); }).catch(function(){ msg.textContent=T('Το αρχείο δεν διαβάστηκε. Υποστηρίζονται GPX, KML, CSV, FIT και UDDF.','The file could not be read. GPX, KML, CSV, FIT and UDDF are supported.'); });
}
B.importSheet=function(){
  var msg=h('p',{class:'sub',role:'status'}), sh, f=h('input',{type:'file',accept:'.gpx,.kml,.kmz,.csv,.txt,.fit,.uddf,.usr,.adm,application/gpx+xml,application/vnd.google-earth.kml+xml,text/csv',hidden:true});
  f.addEventListener('change',function(){ var x=f.files&&f.files[0]; f.value=''; if(x) handle(x,msg,sh); });
  function src(ic,t,d){ return h('div',{class:'imsrc'},h('span',{class:'imi',html:'<svg viewBox="0 0 24 24" aria-hidden="true">'+ic+'</svg>'}),h('span',{class:'tx'},h('b',{text:t}),h('small',{text:d}))); }
  var PL='<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 21h10M12 17v4M7 12l3-3 3 2 4-4"/>', WA='<circle cx="12" cy="12" r="6"/><path d="M9 3h6l1 3H8zM9 21h6l1-3H8zM12 9v3l2 1"/>', MP='<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', TB='<path d="M4 5h16v14H4zM4 10h16M10 5v14"/>';
  sh=B.sheet({title:T('Εισαγωγή από plotter ή ρολόι','Import from plotter or watch'),body:h('div',{class:'bform'},
    src(PL,T('Plotter / GPS · GPX','Plotter / GPS · GPX'),T('Garmin, Lowrance, Simrad, Raymarine, Humminbird, Navionics. Σημεία → Τα σημεία μου, διαδρομές → Έξοδοι.','Garmin, Lowrance, Simrad, Raymarine, Humminbird, Navionics. Waypoints → My spots, tracks → Trips.')),
    src(WA,T('Ρολόι κατάδυσης · FIT, UDDF','Dive watch · FIT, UDDF'),T('Garmin Descent, Suunto, Shearwater, Mares κ.ά. Βάθος και χρόνος κάθε κατάδυσης.','Garmin Descent, Suunto, Shearwater, Mares and others. Depth and time of each dive.')),
    src(MP,T('Google Earth / My Maps · KML','Google Earth / My Maps · KML'),T('Σημεία και γραμμές.','Points and lines.')),
    src(TB,T('Πίνακας · CSV','Spreadsheet · CSV'),T('Στήλες: πλάτος, μήκος, όνομα, βάθος (σε οποιαδήποτε σειρά).','Columns: latitude, longitude, name, depth (any order).')),
    h('label',{class:'btn pri full'},T('Διάλεξε αρχείο','Choose a file'),f),msg,
    B.plotterScan?h('button',{class:'btn full',type:'button',text:T('Φωτογραφία οθόνης plotter (AI)','Photo of a plotter screen (AI)'),onclick:function(){ sh.close(true); B.plotterScan(); }}):null,
    h('p',{class:'foot',text:T('Τα αρχεία διαβάζονται μόνο στο κινητό σου. Αν το plotter σώζει σε δική του μορφή (π.χ. Lowrance .usr, Garmin .adm), κάνε εξαγωγή σε GPX από το μενού του ή από την εφαρμογή του (ActiveCaptain, Navico, RayConnect).','Files are read only on your phone. If the plotter saves its own format (e.g. Lowrance .usr, Garmin .adm), export to GPX from its menu or app (ActiveCaptain, Navico, RayConnect).')}))});
};
B.importParse={gpx:parseGpx,kml:parseKml,csv:parseCsv};
})();
