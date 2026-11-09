/* Alkyon 1.9.17 · Αναφορές θάλασσας (πίνακας sea_reports, όψη sea_reports_pub· βλ. sea-reports.sql).
   «Πώς είναι η θάλασσα εδώ;»: ήρεμη / κυματάκι / ταραγμένη / επικίνδυνη, και προαιρετικά άνεμος και σύντομη σημείωση.
   Φαίνεται σε όλους τους χρήστες με λογαριασμό για 6 ώρες, χωρίς όνομα. Ο server στρογγυλεύει τη θέση στα ~1,5 km.
   Φορτώνεται μαζί με τον χάρτη. Ο χάρτης καλεί B.seaRep.draw(map,on) και B.seaRep.form(at). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, EN=B.EN, ls=B.ls;
var HRS=6, layer=null, timer=null, last=[], mapRef=null, busy=false;
var ST=[ ['calm',T('Ήρεμη','Calm'),T('λάδι, σχεδόν χωρίς κύμα','glassy, almost no waves')],
         ['ripple',T('Κυματάκι','Light chop'),T('μικρό κύμα, άνετα','small waves, comfortable')],
         ['rough',T('Ταραγμένη','Rough'),T('κύμα που κουνάει τη βάρκα','waves that rock the boat')],
         ['danger',T('Επικίνδυνη','Dangerous'),T('γύρνα πίσω / μη βγεις','head back / do not go out')] ];
var WD=[T('Χωρίς άνεμο','No wind'),T('Λίγος άνεμος','Light wind'),T('Μέτριος άνεμος','Moderate wind'),T('Δυνατός άνεμος','Strong wind')];
var WAVE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/></svg>';
function C(){ return B.cloud; }
function sess(){ return C()&&C().session&&C().session(); }
function ago(t){ var m=Math.max(0,Math.round((Date.now()-new Date(t).getTime())/60000)); if(m<2) return T('μόλις τώρα','just now'); if(m<60) return T('πριν ','')+m+T('′',' min ago'); var hh=Math.floor(m/60), mm=m%60; return T('πριν ','')+hh+T(' ώρ.',' h')+(mm>=10?' '+mm+'′':'')+T('',' ago'); }
function fresh(t){ return Date.now()-new Date(t).getTime()<HRS*3600e3; }
function needAcc(){ var sh=B.sheet({title:T('Χρειάζεται λογαριασμός','Account needed'),body:h('div',null,h('p',{class:'sub',text:T('Οι αναφορές θάλασσας φαίνονται σε όλους τους ψαράδες με λογαριασμό. Συνδέσου στο Προφίλ για να τις βλέπεις και να στέλνεις.','Sea reports are shared with all anglers who have an account. Sign in from Profile to see and send them.')}),
  h('div',{class:'acts'},h('button',{class:'btn pri',type:'button',text:T('Στο Προφίλ','Go to Profile'),onclick:function(){ sh.close(true); location.hash='#profile'; }})))}); }
function missing(e){ return /HTTP 404|relation|does not exist|PGRST20/i.test(String(e&&e.message)); }

/* ---------- φόρμα ---------- */
function form(at){
  if(!sess()){ needAcc(); return; }
  if(!at||at.lat==null){ var p=B.lastPos&&B.lastPos(); if(p) at={lat:p.lat,lon:p.lon,gps:true}; }
  if(!at||at.lat==null){ B.toast(T('Δεν βρέθηκε θέση. Άνοιξε το GPS ή πάτα παρατεταμένα στον χάρτη.','No position. Turn on GPS or long-press the map.')); return; }
  var sel=null, wind=null, note=h('input',{type:'text',maxlength:'80',placeholder:T('Σημείωση (προαιρετικά), π.χ. «ρεύμα προς δυτικά»','Note (optional), e.g. “current to the west”')}), sh;
  var send=h('button',{class:'btn pri',type:'button',disabled:true,text:T('Αποστολή','Send'),onclick:go});
  var opts=h('div',{class:'srst'},ST.map(function(s,i){ return h('button',{type:'button',class:'srb sr-'+s[0],'aria-pressed':'false',onclick:function(){ sel=i; [].forEach.call(opts.children,function(x,j){ x.setAttribute('aria-pressed',String(j===i)); }); send.disabled=false; }},h('i'),h('b',{text:s[1]}),h('small',{text:s[2]})); }));
  var wseg=h('div',{class:'srw'},WD.map(function(w,i){ return h('button',{type:'button',class:'chip','aria-pressed':'false',text:w,onclick:function(){ wind=wind===i?null:i; [].forEach.call(wseg.children,function(x,j){ x.setAttribute('aria-pressed',String(j===wind)); }); }}); }));
  function go(){ if(sel==null||busy) return; busy=true; send.disabled=true; send.textContent=T('Αποστολή…','Sending…');
    C().rest('sea_reports',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({lat:+(+at.lat).toFixed(5),lon:+(+at.lon).toFixed(5),state:sel,wind:wind,note:(note.value||'').trim().slice(0,80)||null})})
      .then(function(){ busy=false; sh.close(true); ls.set('alkyon-v4-srlast',Date.now()); B.toast(T('Ευχαριστούμε! Η αναφορά φαίνεται σε όλους για 6 ώρες.','Thanks! Your report is visible to everyone for 6 hours.'));
        if(!on()) set(true); else refresh(); })
      .catch(function(e){ busy=false; send.disabled=false; send.textContent=T('Αποστολή','Send'); var m=String(e&&e.message);
        B.toast(missing(e)?T('Οι αναφορές θάλασσας δεν έχουν ενεργοποιηθεί ακόμη.','Sea reports are not enabled yet.'):/wait a few/i.test(m)?T('Μόλις έστειλες αναφορά. Περίμενε λίγα λεπτά.','You just sent a report. Wait a few minutes.'):/rate/i.test(m)?T('Πολλές αναφορές σήμερα.','Too many reports today.'):T('Δεν στάλθηκε. Έλεγξε τη σύνδεση.','Not sent. Check the connection.')); }); }
  var PC=window.AlkyonCoord;
  sh=B.sheet({title:T('Πώς είναι η θάλασσα εδώ;','How is the sea here?'),body:h('div',{class:'srform'},
    h('p',{class:'sub',text:(at.gps?T('Στη θέση σου','At your position'):T('Στο σημείο','At')+' '+(PC?PC.fmt(at.lat,at.lon):(+at.lat).toFixed(3)+', '+(+at.lon).toFixed(3)))+T(' · φαίνεται σε όλους για 6 ώρες, χωρίς όνομα και με θέση στρογγυλεμένη στα ~1,5 km.',' · visible to everyone for 6 hours, without your name and with the position rounded to ~1.5 km.')}),
    opts,h('h3',{class:'lyh',text:T('Άνεμος (προαιρετικά)','Wind (optional)')}),wseg,note,h('div',{class:'acts'},send))});
}

/* ---------- στρώμα στον χάρτη ---------- */
function on(){ return !!ls.get('alkyon-v4-srep',false); }
function set(v){ ls.set('alkyon-v4-srep',!!v); draw(mapRef); if(v&&!sess()) needAcc(); }
function stop(){ clearInterval(timer); timer=null; if(layer&&mapRef){ try{ mapRef.removeLayer(layer); }catch(e){} } layer=null; }
function paint(){ if(!layer) return; layer.clearLayers(); var L=window.L;
  last.filter(function(r){ return fresh(r.created_at); }).forEach(function(r){ var s=ST[r.state]||ST[1], age=(Date.now()-new Date(r.created_at).getTime())/3600e3;
    var mk=L.marker([+r.lat,+r.lon],{icon:L.divIcon({className:'mk srmk sr-'+s[0]+(age>3?' old':''),html:'<i>'+WAVE+'</i>',iconSize:null}),zIndexOffset:400,keyboard:false});
    mk.on('click',function(){ detail(r); }); layer.addLayer(mk); }); }
function detail(r){ var s=ST[r.state]||ST[1], near=last.filter(function(x){ return x!==r&&fresh(x.created_at)&&Math.abs(x.lat-r.lat)<0.06&&Math.abs(x.lon-r.lon)<0.06; });
  var rows=[[T('Θάλασσα','Sea'),s[1]],[T('Πότε','When'),ago(r.created_at)]]; if(r.wind!=null) rows.push([T('Άνεμος','Wind'),WD[r.wind]]);
  var dsh=B.sheet({title:T('Αναφορά θάλασσας','Sea report'),body:h('div',null,
    h('div',{class:'srhead sr-'+s[0]},h('i',{html:WAVE}),h('div',null,h('b',{text:s[1]}),h('small',{text:s[2]}))),
    h('div',{class:'card',style:{marginTop:'12px'}},h('div',{class:'rows one'},rows.map(function(x){ return h('div',{class:'row'},h('span',{text:x[0]}),h('b',{text:x[1]})); }))),
    r.note?h('p',{class:'srnote',text:'«'+r.note+'»'}):null,
    near.length?h('p',{class:'sub',text:T('Κοντά (έως ~6 km), τις τελευταίες 6 ώρες: ','Nearby (up to ~6 km), last 6 hours: ')+near.map(function(x){ return (ST[x.state]||ST[1])[1]+' ('+ago(x.created_at)+')'; }).join(', ')}):null,
    h('div',{class:'acts'},r.mine?h('button',{class:'btn',type:'button',text:T('Διαγραφή της αναφοράς μου','Delete my report'),onclick:function(){ C().rest('sea_reports?id=eq.'+r.id,{method:'DELETE'}).then(function(){ last=last.filter(function(x){ return x!==r; }); paint(); dsh.close(true); B.toast(T('Διαγράφηκε.','Deleted.')); }).catch(function(){ B.toast(T('Δεν διαγράφηκε.','Not deleted.')); }); }}):null,
      h('button',{class:'btn pri',type:'button',text:T('Στείλε κι εσύ','Send yours'),onclick:function(){ dsh.close(true); setTimeout(function(){ form(null); },150); }})),
    h('p',{class:'foot',text:T('Αναφορά από άλλον ψαρά. Δείχνει πώς ήταν η θάλασσα τη στιγμή που στάλθηκε, όχι πρόγνωση. Η απόφαση να βγεις είναι πάντα δική σου.','Report from another angler. It shows how the sea was when it was sent, not a forecast. Deciding to go out is always your call.')}))}); }
function refresh(){ if(!layer||!sess()) return Promise.resolve();
  var since=new Date(Date.now()-HRS*3600e3).toISOString();
  return C().rest('sea_reports_pub?select=id,lat,lon,state,wind,note,created_at,mine&created_at=gt.'+encodeURIComponent(since)+'&order=created_at.desc&limit=400').then(function(r){ return r.json(); })
    .then(function(a){ last=Array.isArray(a)?a:[]; paint(); ls.set('alkyon-v4-srcache',{t:Date.now(),a:last}); })
    .catch(function(e){ if(missing(e)) B.toast(T('Οι αναφορές θάλασσας δεν έχουν ενεργοποιηθεί ακόμη.','Sea reports are not enabled yet.')); });
}
function draw(map){ if(map) mapRef=map; stop(); if(!on()||!mapRef||!window.L) return;
  layer=window.L.layerGroup().addTo(mapRef); var c=ls.get('alkyon-v4-srcache',null); if(c&&Array.isArray(c.a)){ last=c.a; paint(); }
  refresh(); timer=setInterval(function(){ if(document.visibilityState==='visible') refresh(); },5*60e3); }
B.seaRep={form:form,draw:draw,on:on,set:set,refresh:refresh,icon:WAVE,_data:function(){ return last; }};
})();
