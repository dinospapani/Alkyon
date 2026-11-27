/* Alkyon · είσοδος στην εφαρμογή από τη ρίζα (alkyonfishing.com/). Τη φορτώνει το index.html για όσους πάνε στην εφαρμογή,
   μετά το migrate.js. Ίδιος κώδικας με το launcher.html (που γίνεται index.html στις εφαρμογές Android/iOS). */
/* Alkyon: η εφαρμογή είναι στο v4/. Η κλασική έκδοση αποσύρθηκε στην 1.4.0 και το classic.html αφαιρέθηκε στην 1.10.11
   (οι παλιοί σύνδεσμοι classic.html περνούν από το 404.html εδώ). Οι συντομεύσεις (?a=bite|trip|fc|map) περνούν στη νέα
   εφαρμογή. Ο service worker της ρίζας μένει για τις ειδοποιήσεις. */
(function(){
  var q={}; try{ new URLSearchParams(location.search).forEach(function(v,k){ q[k]=v; }); }catch(e){}
  var fq=q.from==='gh'?'?from=gh'+(q.hl?'&hl='+encodeURIComponent(q.hl):''):''; /* 1.12.6: από την παλιά διεύθυνση (github.io) → κρατά το σημάδι για την πρόταση «Μεταφορά» */
  if(q.join==='1') fq+=(fq?'&':'?')+'join=1'; /* 1.14.60: πρόσκληση → «Βοήθησε την πρόγνωση» */
  var a=q.a||'', M={bite:'#new',trip:'#trip',fc:'#forecast',log:'#log',map:'#map',prof:'#profile'};
  if(a==='map'&&q.lat&&q.lon&&isFinite(+q.lat)&&isFinite(+q.lon)){ location.replace('v4/'+fq+'#share='+(+q.lat).toFixed(5)+','+(+q.lon).toFixed(5)); return; }
  /* 1.4.0: σύνδεσμοι από email (επιβεβαίωση, νέος κωδικός): τους χειρίζεται πλέον η νέα εφαρμογή (v4/account.js) */
  if(/access_token|type=recovery|error_description/.test(location.hash)){ location.replace('v4/'+location.search+location.hash); return; }
  if(/^#inbox/.test(location.hash)){ location.replace('v4/'+fq+'#inbox'); return; }
  try{ if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){}); }catch(e){}
  location.replace('v4/'+fq+(M[a]||location.hash||''));
})();
