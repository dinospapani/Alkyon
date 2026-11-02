/* BiteCast 4 · «Πώς δουλεύει» (#help) και «Τι νέο υπάρχει» (v31z547)
   ΚΑΝΟΝΑΣ: σε κάθε νέα λειτουργία ενημερώνονται (α) η ενότητα της στο HELP και (β) μια γραμμή στο NEWS με την έκδοση.
   Το «Τι νέο» εμφανίζεται μία φορά στους χρήστες που είχαν ήδη την εφαρμογή (psaro-v4-news = τελευταία έκδοση που είδαν). */
(function(){
'use strict';
var B=window.BC, h=B.h, T=B.T, ls=B.ls;
/* [τίτλος, [[κείμενο, σύνδεσμος (προαιρετικό), κείμενο συνδέσμου]]] */
var HELP=[
 [T('Πρώτα βήματα','First steps'),[
  [T('Άνοιξε τις ειδοποιήσεις: χωρίς αυτές δεν έρχονται καλές μέρες, πλάνο εξόδου, καιρός στην έξοδο και «ώρα να γυρίσεις».','Turn on alerts: without them you get no good days, trip plans, weather on trips or “time to head back”.'),'#alerts',T('Ειδοποιήσεις','Alerts')],
  [T('Βάλε όρια ασφαλείας (ή μήκος σκάφους για αυτόματη πρόταση) και λιμάνι: από αυτά βγαίνουν οι ώρες «πάνω από τα όρια» και ο χρόνος επιστροφής.','Set safety limits (or boat length for a suggestion) and a home port: they drive “over your limits” hours and the time home.'),'#boat',T('Σκάφος','Boat')],
  [T('Όρισε επαφή ασφαλείας: ειδοποιείται αν δεν γυρίσεις στην ώρα σου.','Set a safety contact: they are alerted if you are not back on time.'),'#profile',T('Προφίλ','Profile')],
  [T('Λογαριασμός: τα δεδομένα σου συγχρονίζονται και δεν χάνονται αν αλλάξεις κινητό.','Account: your data syncs and is not lost if you change phone.'),'#profile',T('Λογαριασμός','Account')]]],
 [T('Πρόγνωση','Forecast'),[
  [T('Κάθε μέρα έχει βαθμό 0–100 και καλύτερες ώρες. Πάτα μια μπάρα στο «Ανά ώρα» για τα στοιχεία της ώρας· κόκκινο = πάνω από τα όριά σου, με τον λόγο.','Each day has a 0–100 score and best hours. Tap a bar in “By hour” for details; red = over your limits, with the reason.'),'#forecast',T('Πρόγνωση','Forecast')],
  [T('«Θα βγω αυτή τη μέρα»: υπενθύμιση το προηγούμενο βράδυ, ~1 ώρα πριν από την καλύτερη ώρα, και ειδοποίηση αν χαλάσει ο καιρός.','“I’ll go out this day”: reminder the evening before, ~1 hour before the best time, and an alert if the weather turns.')],
  [T('Τοποθεσία: αναζήτηση, «Διάλεξε στον χάρτη» (σταυρός στο κέντρο) ή συντεταγμένες.','Location: search, “Pick on the map” (crosshair) or coordinates.')],
  [T('«Τι δούλεψε σε παρόμοιες μέρες»: δόλωμα, τεχνική, βάθος και ώρα από τις δικές σου ψαριές σε παρόμοιες συνθήκες.','“What worked on similar days”: bait, technique, depth and time from your own catches in similar conditions.')],
  [T('Θερμοκρασία σε βάθος (σκάφος/ψαροντούφεκο): πού είναι το θερμοκλινές σήμερα. Ορατότητα νερού για ψαροντούφεκο.','Temperature at depth (boat/spearfishing): where today’s thermocline is. Water visibility for spearfishing.')],
  [T('Καρτέλα «Είδη»: ποιο ψάρι ταιριάζει σε ποια μέρα και η εποχή κάθε είδους μήνα με μήνα.','“Species” tab: which fish suits which day, and each species’ season month by month.')]]],
 [T('Χάρτης','Map'),[
  [T('Κουμπιά πάνω: άνεμος, κύμα, ρεύματα, νερό, βάθη. Η μπάρα ώρας κάτω: πάτα μια μέρα για να πας εκεί, «Τώρα» για επιστροφή.','Top buttons: wind, waves, currents, water, depths. Time bar at the bottom: tap a day to jump there, “Now” to return.'),'#map',T('Χάρτης','Map')],
  [T('Περιστροφή με δύο δάχτυλα· η πυξίδα πάνω αριστερά τον επαναφέρει με τον βορρά πάνω.','Rotate with two fingers; the compass at the top left resets north up.')],
  [T('Αν σύρεις τον χάρτη, σταματά να σε ακολουθεί· το κουμπί θέσης τον ξαναφέρει σε σένα.','Dragging the map stops following you; the position button brings it back.')],
  [T('Χάρτης χωρίς σήμα: κουμπί χάρτη (πάνω δεξιά) › «Χάρτης εκτός σύνδεσης» › Κατέβασμα.','Offline map: map button (top right) › “Offline map” › Download.')],
  [T('Πάτημα στη θάλασσα: κύμα, άνεμος και ρεύμα σε εκείνο το σημείο. Παρατεταμένο πάτημα: αποθήκευση σημείου.','Tap the sea: waves, wind and current there. Long press: save a spot.')]]],
 [T('Έξοδος','Trip'),[
  [T('Ξεκίνα από το κεντρικό κουμπί. Βάλε ώρα επιστροφής· αν δεν γυρίσεις, ειδοποιείται η επαφή σου.','Start from the centre button. Set a return time; if you are not back, your contact is alerted.')],
  [T('Πράσινο ψάρι = έπιασα, κόκκινο = χάθηκε, 🐡 = λαγοκέφαλος ή «έφαγε το δόλωμα» (δεν μετράνε ως ψάρια). Κράτα πατημένο για διαγραφή του τελευταίου.','Green fish = caught, red = lost, 🐡 = toadfish or “bait taken” (not counted as catches). Hold to delete the last one.')],
  [T('Μεγάλα κουμπιά (4 τετράγωνα): για βρεγμένα χέρια και κύμα. MOB με παρατεταμένο πάτημα.','Big buttons (4 squares): for wet hands and waves. MOB with a long press.')],
  [T('Νυχτερινή λειτουργία 🌙: κόκκινη οθόνη, μόνη της μετά τη δύση.','Night mode 🌙: red screen, on by itself after sunset.')],
  [T('Με κλειστό κινητό σε ειδοποιεί για καταιγίδα, καιρό πάνω από τα όρια, δύση και ώρα επιστροφής, με βάση την απόσταση από το λιμάνι σου.','With the phone locked you are alerted to storms, weather over your limits, sunset and your return time, based on the distance to your port.')],
  [T('Κοινή έξοδος: στην έναρξη επίλεξε «Οι φίλοι μου βλέπουν τη θέση μου».','Shared trip: at the start choose “My friends see my position”.')],
  [T('Ψάρεμα από ακτή: αν σταθείς σε σημείο σου, ρωτά «Ξεκινάς ψάρεμα;».','Shore fishing: if you stop at one of your spots it asks “Starting to fish?”.')]]],
 [T('Ημερολόγιο','Logbook'),[
  [T('Ψάρια, έξοδοι, σημεία, εργαλεία. Στα Στατιστικά: στόχοι, ρεκόρ ανά είδος, λαγοκέφαλοι χωριστά, σύγκριση χρονιών.','Catches, trips, spots, gear. In Stats: goals, records by species, toadfish separately, year comparison.'),'#log',T('Ημερολόγιο','Logbook')],
  [T('Στη φόρμα ψαριού: αν ο λαγοκέφαλος έκοψε αγκίστρι ή τεχνητό, πάτα το για −1 από τον εξοπλισμό.','In the catch form: if a toadfish cut a hook or lure, tap it for −1 from your tackle.')]]],
 [T('Ειδοποιήσεις','Alerts'),[
  [T('Καλές μέρες (με τον στόχο σου), αλλαγές πίεσης, μέτωπα θερμοκρασίας, εβδομαδιαία σύνοψη την Κυριακή. Ησυχία 23:00–07:00 εκτός από ασφάλεια και πλάνο.','Good days (your target), pressure changes, temperature fronts, a Sunday weekly summary. Quiet 23:00–07:00 except safety and plans.'),'#alerts',T('Ειδοποιήσεις','Alerts')]]],
 [T('Φίλοι','Friends'),[
  [T('Φτιάξε κωδικό και στείλε τον σύνδεσμο: ο φίλος τον πατά και ο κωδικός μπαίνει μόνος του.','Create a code and send the link: your friend taps it and the code fills in by itself.'),'#friends',T('Φίλοι','Friends')]]]
];
/* έκδοση → αλλαγές (νεότερες πρώτες). Προσθέτεις γραμμή εδώ σε κάθε νέα λειτουργία. */
var NEWS=[
 ['v31z547',[T('Σελίδα «Πώς δουλεύει» στο Προφίλ › Γνώση','“How it works” page in Profile › Knowledge')]],
 ['v31z545',[T('«Θα βγω αυτή τη μέρα»: υπενθυμίσεις και ειδοποίηση αν χαλάσει','“I’ll go out this day”: reminders and an alert if it turns'),T('Στην έξοδο: καιρός, δύση και «ώρα να γυρίσεις», και με κλειστό κινητό','On trips: weather, sunset and “time to head back”, even with the phone locked'),
   T('Λαγοκέφαλοι: κουμπί 🐡, δεν μετράνε ως ψάρια','Toadfish: 🐡 button, not counted as catches'),T('Μεγάλα κουμπιά και νυχτερινή λειτουργία στην έξοδο','Big buttons and night mode on trips'),
   T('Στόχοι, ρεκόρ, σύγκριση χρονιών, εποχή ειδών','Goals, records, year comparison, species seasons'),T('Θερμοκλινές, μέτωπα θερμοκρασίας, «τι δούλεψε σε παρόμοιες μέρες»','Thermocline, temperature fronts, “what worked on similar days”'),
   T('Χάρτης: περιστροφή με δύο δάχτυλα, μέρες στη μπάρα ώρας, κοινή έξοδος με φίλους','Map: two-finger rotation, days on the time bar, shared trips with friends')]]
];
function verN(v){ var m=/v(\d+)z(\d+)/.exec(v||''); return m?+m[1]*1000+(+m[2]):0; }
/* ---------- σελίδα ---------- */
B.view('help',{title:T('Πώς δουλεύει','How it works'),mount:function(el){
  var page=h('div',{class:'page help'});
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω','Back'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Πώς δουλεύει','How it works')}))));
  HELP.forEach(function(sec,si){ var d=h('details',{class:'card hsec',open:si===0}); d.append(h('summary',null,h('b',{text:sec[0]})));
    var ul=h('ul',{class:'hlist'}); sec[1].forEach(function(it){ ul.append(h('li',null,h('span',{text:it[0]}),it[1]?h('a',{href:it[1],class:'hgo',text:it[2]+' ›'}):null)); }); d.append(ul); page.append(d); });
  page.append(h('section',{class:'card'},h('h2',{text:T('Τι νέο υπάρχει','What’s new')}),NEWS.slice(0,3).map(function(n){ return h('div',{class:'hnews'},h('small',{text:n[0]}),h('ul',{class:'hlist'},n[1].map(function(x){ return h('li',{text:x}); }))); })));
  page.append(h('p',{class:'foot',text:(window.PSARO_VERSION||'')}));
  el.replaceChildren(page); }});
/* ---------- «Τι νέο» μία φορά μετά την ενημέρωση ---------- */
function whatsNew(){ var seen=ls.get('psaro-v4-news',null), top=NEWS[0][0];
  var onb=false; try{ onb=!!localStorage.getItem('psaro-onboard'); }catch(e){}
  if(!seen){ ls.set('psaro-v4-news',onb&&hasHistory()?'v31z532':top); seen=ls.get('psaro-v4-news',top); }
  var fresh=NEWS.filter(function(n){ return verN(n[0])>verN(seen); }); if(!fresh.length) return;
  if(document.querySelector('.sheet,.sppage,.bigtrip')){ setTimeout(whatsNew,4000); return; }
  ls.set('psaro-v4-news',top);
  var items=[]; fresh.forEach(function(n){ items=items.concat(n[1]); }); items=items.slice(0,8);
  var sh=B.sheet({title:T('Τι νέο υπάρχει','What’s new'),body:h('div',{class:'bform'},h('ul',{class:'hlist hnew'},items.map(function(x){ return h('li',{text:x}); })),
    h('a',{class:'btn full',href:'#help',text:T('Όλα στο «Πώς δουλεύει»','All in “How it works”'),onclick:function(){ sh.close(); }}))}); }
/* χρήστης που είχε ήδη δεδομένα πριν από αυτή τη σελίδα = παλιός χρήστης */
function hasHistory(){ try{ return ['bites','trips','spots'].some(function(k){ return B.store.raw(k).length>0; })||!!localStorage.getItem('psaro-notify'); }catch(e){ return false; } }
setTimeout(whatsNew,6000);
B.help={news:NEWS};
})();
