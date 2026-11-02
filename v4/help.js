/* Alkyon 4 · «Πώς δουλεύει» (#help) και «Τι νέο υπάρχει» (v31z547)
   ΚΑΝΟΝΑΣ: σε κάθε νέα λειτουργία ενημερώνονται (α) η ενότητα της στο HELP και (β) μια γραμμή στο NEWS με την έκδοση.
   Το «Τι νέο» εμφανίζεται μία φορά στους χρήστες που είχαν ήδη την εφαρμογή (alkyon-v4-news = τελευταία έκδοση που είδαν). */
(function(){
'use strict';
var B=window.AK, h=B.h, T=B.T, ls=B.ls;
/* [τίτλος, [[κείμενο, σύνδεσμος (προαιρετικό), κείμενο συνδέσμου]]] */
var HELP=[
 [T('Πρώτα βήματα','First steps'),[
  [T('Το Alkyon (αλκυόνη) σου δείχνει τη σωστή στιγμή για ψάρεμα: ήλιος, φεγγάρι, πίεση, άνεμος και κύμα σε έναν βαθμό 0–100. Για να το έχεις σαν εφαρμογή, πρόσθεσέ το στην αρχική οθόνη του κινητού.','Alkyon (the kingfisher) shows you the right moment to fish: sun, moon, pressure, wind and waves in one 0–100 score. To use it like an app, add it to your phone’s home screen.')],
  [T('Άνοιξε τις ειδοποιήσεις: χωρίς αυτές δεν έρχονται καλές μέρες, πλάνο εξόδου, καιρός στην έξοδο και «ώρα να γυρίσεις».','Turn on alerts: without them you get no good days, trip plans, weather on trips or “time to head back”.'),'#alerts',T('Ειδοποιήσεις','Alerts')],
  [T('Βάλε όρια ασφαλείας (ή μήκος σκάφους για αυτόματη πρόταση) και λιμάνι: από αυτά βγαίνουν οι ώρες «πάνω από τα όρια» και ο χρόνος επιστροφής.','Set safety limits (or boat length for a suggestion) and a home port: they drive “over your limits” hours and the time home.'),'#boat',T('Σκάφος','Boat')],
  [T('Όρισε επαφή ασφαλείας: ειδοποιείται αν δεν γυρίσεις στην ώρα σου.','Set a safety contact: they are alerted if you are not back on time.'),'#profile',T('Προφίλ','Profile')],
  [T('Λογαριασμός: τα δεδομένα σου συγχρονίζονται και κάθε εβδομάδα κρατιέται αντίγραφο στο cloud (επαναφορά από Προφίλ › Λογαριασμός).','Account: your data syncs, and a weekly cloud backup is kept (restore from Profile › Account).'),'#profile',T('Λογαριασμός','Account')],
  [T('Κάτι δεν δουλεύει; Προφίλ › Έλεγχος συστήματος: δείχνει τι λειτουργεί και τι όχι, με τι να κάνεις. Τα σφάλματα στέλνονται αυτόματα για διόρθωση.','Something not working? Profile › System check shows what works and what doesn’t, and what to do. Errors are sent automatically for fixing.'),'#check',T('Έλεγχος','Check')]]],
 [T('Πρόγνωση','Forecast'),[
  [T('Κάθε μέρα έχει βαθμό 0–100 και καλύτερες ώρες. Πάτα μια μπάρα στο «Ανά ώρα» για τα στοιχεία της ώρας· κόκκινο = πάνω από τα όριά σου, με τον λόγο.','Each day has a 0–100 score and best hours. Tap a bar in “By hour” for details; red = over your limits, with the reason.'),'#forecast',T('Πρόγνωση','Forecast')],
  [T('«Για σένα»: όταν η προσωπική πρόγνωση (από τις δικές σου εξόδους) αποδειχθεί καλύτερη από τον μέσο όρο σου, η κάρτα της ημέρας δείχνει και τον δικό σου βαθμό. Λεπτομέρειες στην καρτέλα «Δικά μου».','“For you”: once your personal forecast (from your own trips) proves better than your average, the day card also shows your own score. Details in the “Mine” tab.')],
  [T('«Θα βγω αυτή τη μέρα»: υπενθύμιση το προηγούμενο βράδυ, ~1 ώρα πριν από την καλύτερη ώρα, και ειδοποίηση αν χαλάσει ο καιρός.','“I’ll go out this day”: reminder the evening before, ~1 hour before the best time, and an alert if the weather turns.')],
  [T('Με το «Θα βγω» κατεβαίνουν μόνα τους ο χάρτης και η πρόγνωση της περιοχής (με WiFi ή 4G/5G), για χρήση χωρίς σήμα στη θάλασσα. Ρύθμιση: Ειδοποιήσεις › Πριν την έξοδο.','With “I’ll go out” the area’s map and forecast download by themselves (WiFi or 4G/5G) for use without signal at sea. Setting: Notifications › Before the trip.'),'#alerts',T('Ρύθμιση','Setting')],
  [T('Τοποθεσία: αναζήτηση, «Διάλεξε στον χάρτη» (σταυρός στο κέντρο) ή συντεταγμένες.','Location: search, “Pick on the map” (crosshair) or coordinates.')],
  [T('«Τι δούλεψε σε παρόμοιες μέρες»: δόλωμα, τεχνική, βάθος και ώρα από τις δικές σου ψαριές σε παρόμοιες συνθήκες.','“What worked on similar days”: bait, technique, depth and time from your own catches in similar conditions.')],
  [T('Θερμοκρασία σε βάθος (σκάφος/ψαροντούφεκο): πού είναι το θερμοκλινές σήμερα. Ορατότητα νερού για ψαροντούφεκο: από δορυφόρο όταν δεν έχει σύννεφα, αλλιώς εκτίμηση από κύμα και βροχή.','Temperature at depth (boat/spearfishing): where today’s thermocline is. Water visibility for spearfishing: from satellite when there are no clouds, otherwise estimated from waves and rain.')],
  [T('Καρτέλα «Είδη»: ποιο ψάρι ταιριάζει σε ποια μέρα και η εποχή κάθε είδους μήνα με μήνα.','“Species” tab: which fish suits which day, and each species’ season month by month.')]]],
 [T('Χάρτης','Map'),[
  [T('Κουμπιά πάνω: άνεμος, κύμα, ρεύματα, νερό, βάθη. Η μπάρα ώρας κάτω: πάτα μια μέρα για να πας εκεί, «Τώρα» για επιστροφή.','Top buttons: wind, waves, currents, water, depths. Time bar at the bottom: tap a day to jump there, “Now” to return.'),'#map',T('Χάρτης','Map')],
  [T('Περιστροφή με δύο δάχτυλα· η πυξίδα πάνω αριστερά τον επαναφέρει με τον βορρά πάνω.','Rotate with two fingers; the compass at the top left resets north up.')],
  [T('Αν σύρεις τον χάρτη, σταματά να σε ακολουθεί· το κουμπί θέσης τον ξαναφέρει σε σένα.','Dragging the map stops following you; the position button brings it back.')],
  [T('Χάρτης χωρίς σήμα: κουμπί χάρτη (πάνω δεξιά) › «Χάρτης εκτός σύνδεσης» › Κατέβασμα.','Offline map: map button (top right) › “Offline map” › Download.')],
  [T('Πάτημα στη θάλασσα: κύμα, άνεμος και ρεύμα σε εκείνο το σημείο. Παρατεταμένο πάτημα: αποθήκευση σημείου.','Tap the sea: waves, wind and current there. Long press: save a spot.')],
  [T('Πάτα ένα ψάρι ή σημείο στον χάρτη για λεπτομέρειες· από εκεί και «Διαγραφή» (με «Αναίρεση» για λίγα δευτερόλεπτα). Σε ομάδα ψαριών, σύρε αριστερά.','Tap a catch or spot on the map for details; “Delete” is there too (with “Undo” for a few seconds). In a group of catches, swipe left.')]]],
 [T('Έξοδος','Trip'),[
  [T('Ξεκίνα από το κεντρικό κουμπί. Βάλε ώρα επιστροφής· αν δεν γυρίσεις, ειδοποιείται η επαφή σου.','Start from the centre button. Set a return time; if you are not back, your contact is alerted.')],
  [T('Πράσινο ψάρι = έπιασα, κόκκινο = χάθηκε, 🐡 = λαγοκέφαλος ή «έφαγε το δόλωμα» (δεν μετράνε ως ψάρια). Κράτα πατημένο για διαγραφή του τελευταίου.','Green fish = caught, red = lost, 🐡 = toadfish or “bait taken” (not counted as catches). Hold to delete the last one.')],
  [T('Μεγάλα κουμπιά (4 τετράγωνα): για βρεγμένα χέρια και κύμα. MOB με παρατεταμένο πάτημα.','Big buttons (4 squares): for wet hands and waves. MOB with a long press.')],
  [T('Φωνή 🎤: «τρία λαβράκια ενάμισι κιλό με γαρίδα», «σαργός 800 γραμμάρια το άφησα», «χάθηκε», «λαγοκέφαλος». Στον χάρτη, στα μεγάλα κουμπιά και στη φόρμα ψαριού. Χρειάζεται σήμα.','Voice 🎤: “three sea bass one and a half kilos with shrimp”, “bream 800 grams released”, “lost”, “toadfish”. On the map, the big buttons and the catch form. Needs signal.')],
  [T('Νυχτερινή λειτουργία 🌙: κόκκινη οθόνη, μόνη της μετά τη δύση.','Night mode 🌙: red screen, on by itself after sunset.')],
  [T('Με κλειστό κινητό σε ειδοποιεί για καταιγίδα, καιρό πάνω από τα όρια, δύση και ώρα επιστροφής, με βάση την απόσταση από το λιμάνι σου.','With the phone locked you are alerted to storms, weather over your limits, sunset and your return time, based on the distance to your port.')],
  [T('Κοινή έξοδος: στην έναρξη επίλεξε «Οι φίλοι μου βλέπουν τη θέση μου».','Shared trip: at the start choose “My friends see my position”.')],
  [T('Ρολόι Garmin: Προφίλ › Ρολόι Garmin › κωδικός σύνδεσης. Στο ρολόι: βαθμός και καλύτερη ώρα, πίεση (ειδοποίηση πριν την κορυφή ή τον πάτο, και όταν αρχίζει να πέφτει ή να ανεβαίνει, όπως στο κινητό) και SELECT για Ψάρι / Χάθηκε / Λαγοκέφαλος, με ώρα και θέση.','Garmin watch: Profile › Garmin watch › link code. On the watch: score and best time, pressure (alert before a peak or low, and when it starts to fall or rise, like on the phone) and SELECT for Fish / Lost / Toadfish, with time and position.')],
  [T('Ψάρεμα από ακτή: αν σταθείς σε σημείο σου, ρωτά «Ξεκινάς ψάρεμα;».','Shore fishing: if you stop at one of your spots it asks “Starting to fish?”.')]]],
 [T('Ημερολόγιο','Logbook'),[
  [T('Ψάρια, έξοδοι, σημεία, εργαλεία. Στα Στατιστικά: στόχοι, ρεκόρ ανά είδος, λαγοκέφαλοι χωριστά, σύγκριση χρονιών.','Catches, trips, spots, gear. In Stats: goals, records by species, toadfish separately, year comparison.'),'#log',T('Ημερολόγιο','Logbook')],
  [T('Στη φόρμα ψαριού: αν ο λαγοκέφαλος έκοψε αγκίστρι ή τεχνητό, πάτα το για −1 από τον εξοπλισμό.','In the catch form: if a toadfish cut a hook or lure, tap it for −1 from your tackle.')],
  [T('Εργαλεία (δίχτυα, παραγάδια): «Στον χάρτη» δείχνει τη ρίψη και το ανέβασμα, ακόμα κι αν έχει τελειώσει· το ✕ πάνω τα κρύβει.','Gear (nets, longlines): “On the map” shows the set and haul, even when finished; the ✕ at the top hides them.')],
  [T('Σκάφος › Λήξεις: «+ Νέα λήξη» προτείνει συνηθισμένα (δίπλωμα, σωσίβια, τρέιλερ, μαρίνα…) ή γράφεις δικό σου. Όσα δεν χρειάζεσαι τα αφαιρείς.','Boat › Expiries: “+ New expiry” suggests common ones (licence, lifejackets, trailer, marina…) or type your own. Remove the ones you don’t need.'),'#boat',T('Σκάφος','Boat')]]],
 [T('Ειδοποιήσεις','Alerts'),[
  [T('Καλές μέρες (με τον στόχο σου), αλλαγές πίεσης, μέτωπα θερμοκρασίας, εβδομαδιαία σύνοψη την Κυριακή. Ησυχία 23:00–07:00 εκτός από ασφάλεια και πλάνο.','Good days (your target), pressure changes, temperature fronts, a Sunday weekly summary. Quiet 23:00–07:00 except safety and plans.'),'#alerts',T('Ειδοποιήσεις','Alerts')]]],
 [T('Φίλοι','Friends'),[
  [T('Φτιάξε κωδικό και στείλε τον σύνδεσμο: ο φίλος τον πατά και ο κωδικός μπαίνει μόνος του.','Create a code and send the link: your friend taps it and the code fills in by itself.'),'#friends',T('Φίλοι','Friends')]]]
];
/* έκδοση → αλλαγές (νεότερες πρώτες). Προσθέτεις γραμμή εδώ σε κάθε νέα λειτουργία. */
var NEWS=[
 ['1.0.1',[T('Έλεγχος συστήματος: οι γραμμές αλλάζουν μία-μία όσο τελειώνει κάθε έλεγχος, χωρίς να «αναβοσβήνει» η σελίδα.','System check: rows update one by one as each check finishes, without the page flickering.')]],
 ['1.0.0',[T('Νέο όνομα και νέο logo: η εφαρμογή λέγεται πλέον Alkyon (αλκυόνη). Η αλκυόνη ξέρει ακριβώς τη στιγμή να βουτήξει, όπως η πρόγνωση σου λέει τη σωστή ώρα για ψάρεμα.','New name and logo: the app is now called Alkyon (the kingfisher). The kingfisher knows the exact moment to dive, just as the forecast tells you the right time to fish.'),T('Νέα διεύθυνση: dinospapani.github.io/Alkyon. Τα δεδομένα σου (ψάρια, σημεία, έξοδοι, φωτογραφίες, ρυθμίσεις) μεταφέρθηκαν αυτόματα. Πρόσθεσε τη νέα εφαρμογή στην αρχική οθόνη και σβήσε την παλιά.','New address: dinospapani.github.io/Alkyon. Your data (catches, spots, trips, photos, settings) moved over automatically. Add the new app to your home screen and remove the old one.'),T('Οι ειδοποιήσεις ξαναρυθμίζονται μόνες τους με τη νέα διεύθυνση. Αν δεν έρχονται, άνοιξε Προφίλ › Ειδοποιήσεις μία φορά.','Alerts set themselves up again at the new address. If they stop, open Profile › Alerts once.'),T('Νέο Telegram bot ασφαλείας: @AlkyonMaydayBot. Οι επαφές ασφαλείας πρέπει να ξανασυνδεθούν (Προφίλ › Επαφή ασφαλείας).','New safety Telegram bot: @AlkyonMaydayBot. Safety contacts need to link again (Profile › Safety contact).'),T('Οι εκδόσεις ξεκινούν από την αρχή: αυτή είναι η 1.0.0. Και η εφαρμογή του ρολογιού Garmin λέγεται πλέον Alkyon.','Versions start over: this is 1.0.0. The Garmin watch app is now called Alkyon too.')]],
 ['v31z554',[T('Διόρθωση: το κουμπί ⓘ (πηγές χάρτη) στον χάρτη','Fix: the ⓘ (map sources) button on the map')]],
 ['v31z553',[T('Ρολόι Garmin: ειδοποίηση πριν την κορυφή ή τον πάτο της πίεσης, και όταν αρχίζει να πέφτει ή να ανεβαίνει','Garmin watch: alert before a pressure peak or low, and when it starts to fall or rise')]],
 ['v31z552',[T('Ρολόι Garmin: πρόγνωση, ειδοποίηση πίεσης και καταγραφή ψαριού από το ρολόι (Προφίλ › Ρολόι Garmin)','Garmin watch: forecast, pressure alert and catch logging from the watch (Profile › Garmin watch)')]],
 ['v31z551',[T('Θερμοκλινές: δουλεύει και κοντά στην ακτή (βρίσκει την πλησιέστερη θάλασσα)','Thermocline: works near the coast too (finds the nearest sea)'),T('Έλεγχος συστήματος: σωστός έλεγχος λογαριασμού','System check: correct account check')]],
 ['v31z550',[T('Προφίλ › Έλεγχος συστήματος: τι δουλεύει και τι όχι, με ένα πάτημα','Profile › System check: what works and what doesn’t, in one tap'),T('«Θα βγω»: χάρτης και πρόγνωση κατεβαίνουν μόνα τους για χρήση χωρίς σήμα (WiFi ή 4G/5G)','“I’ll go out”: map and forecast download by themselves for use without signal (WiFi or 4G/5G)'),T('Αντίγραφο στο cloud κάθε εβδομάδα, με επαναφορά','Weekly cloud backup, with restore'),T('Φωνή: πόσα ψάρια, δόλωμα, απελευθέρωση, λαγοκέφαλος· και στα μεγάλα κουμπιά','Voice: how many, bait, released, toadfish; also on the big buttons'),T('«Για σένα»: ο δικός σου βαθμός στην κάρτα της ημέρας','“For you”: your own score on the day card'),T('Ανοίγει γρήγορα και με αδύναμο σήμα','Opens fast even with weak signal')]],
 ['v31z549',[T('Διαγραφή ψαριού ή σημείου κατευθείαν από τον χάρτη','Delete a catch or spot straight from the map'),T('Εργαλεία: το «Στον χάρτη» δείχνει και όσα έχουν ανέβει','Gear: “On the map” also shows finished sets'),T('Σκάφος: προτεινόμενες λήξεις (δίπλωμα, σωσίβια, τρέιλερ, μαρίνα…) ή δικές σου','Boat: suggested expiries (licence, lifejackets, trailer, marina…) or your own')]],
 ['v31z548',[T('Ορατότητα νερού: πιο αξιόπιστη λήψη από δορυφόρο','Water visibility: more reliable satellite data')]],
 ['v31z547',[T('Σελίδα «Πώς δουλεύει» στο Προφίλ › Γνώση','“How it works” page in Profile › Knowledge')]],
 ['v31z545',[T('«Θα βγω αυτή τη μέρα»: υπενθυμίσεις και ειδοποίηση αν χαλάσει','“I’ll go out this day”: reminders and an alert if it turns'),T('Στην έξοδο: καιρός, δύση και «ώρα να γυρίσεις», και με κλειστό κινητό','On trips: weather, sunset and “time to head back”, even with the phone locked'),
   T('Λαγοκέφαλοι: κουμπί 🐡, δεν μετράνε ως ψάρια','Toadfish: 🐡 button, not counted as catches'),T('Μεγάλα κουμπιά και νυχτερινή λειτουργία στην έξοδο','Big buttons and night mode on trips'),
   T('Στόχοι, ρεκόρ, σύγκριση χρονιών, εποχή ειδών','Goals, records, year comparison, species seasons'),T('Θερμοκλινές, μέτωπα θερμοκρασίας, «τι δούλεψε σε παρόμοιες μέρες»','Thermocline, temperature fronts, “what worked on similar days”'),
   T('Χάρτης: περιστροφή με δύο δάχτυλα, μέρες στη μπάρα ώρας, κοινή έξοδος με φίλους','Map: two-finger rotation, days on the time bar, shared trips with friends')]]
];
function verN(v){ var s=/^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(v||''); if(s) return 1e7+(+s[1])*1e4+(+s[2])*100+(+(s[3]||0)); var m=/v(\d+)z(\d+)/.exec(v||''); return m?+m[1]*1000+(+m[2]):0; }
/* ---------- σελίδα ---------- */
B.view('help',{title:T('Πώς δουλεύει','How it works'),mount:function(el){
  var page=h('div',{class:'page help'});
  page.append(h('div',{class:'top'},h('div',{style:{display:'flex',alignItems:'center',gap:'12px'}},h('a',{class:'iconbtn',href:'#profile','aria-label':T('Πίσω','Back'),html:B.iconSvg('back')}),h('h1',{class:'lt',text:T('Πώς δουλεύει','How it works')}))));
  HELP.forEach(function(sec,si){ var d=h('details',{class:'card hsec',open:si===0}); d.append(h('summary',null,h('b',{text:sec[0]})));
    var ul=h('ul',{class:'hlist'}); sec[1].forEach(function(it){ ul.append(h('li',null,h('span',{text:it[0]}),it[1]?h('a',{href:it[1],class:'hgo',text:it[2]+' ›'}):null)); }); d.append(ul); page.append(d); });
  page.append(h('section',{class:'card'},h('h2',{text:T('Τι νέο υπάρχει','What’s new')}),NEWS.slice(0,3).map(function(n){ return h('div',{class:'hnews'},h('small',{text:n[0]}),h('ul',{class:'hlist'},n[1].map(function(x){ return h('li',{text:x}); }))); })));
  page.append(h('p',{class:'foot',text:(window.ALKYON_VERSION||'')}));
  el.replaceChildren(page); }});
/* ---------- «Τι νέο» μία φορά μετά την ενημέρωση ---------- */
function whatsNew(){ var seen=ls.get('alkyon-v4-news',null), top=NEWS[0][0];
  var onb=false; try{ onb=!!localStorage.getItem('alkyon-onboard'); }catch(e){}
  if(!seen){ ls.set('alkyon-v4-news',onb&&hasHistory()?'v31z532':top); seen=ls.get('alkyon-v4-news',top); }
  var fresh=NEWS.filter(function(n){ return verN(n[0])>verN(seen); }); if(!fresh.length) return;
  if(document.querySelector('.sheet,.sppage,.bigtrip')){ setTimeout(whatsNew,4000); return; }
  /* v31z549: όχι στη μέση εξόδου· περιμένει να τελειώσει */
  var onTrip=false; try{ onTrip=document.body.classList.contains('ontrip')||!!(B.trip&&B.trip.active&&B.trip.active()); }catch(e){} if(onTrip){ setTimeout(whatsNew,120000); return; }
  ls.set('alkyon-v4-news',top);
  var items=[]; fresh.forEach(function(n){ items=items.concat(n[1]); }); items=items.slice(0,8);
  var sh=B.sheet({title:T('Τι νέο υπάρχει','What’s new'),body:h('div',{class:'bform'},h('ul',{class:'hlist hnew'},items.map(function(x){ return h('li',{text:x}); })),
    h('a',{class:'btn full',href:'#help',text:T('Όλα στο «Πώς δουλεύει»','All in “How it works”'),onclick:function(){ sh.close(); }}))}); }
/* χρήστης που είχε ήδη δεδομένα πριν από αυτή τη σελίδα = παλιός χρήστης */
function hasHistory(){ try{ return ['bites','trips','spots'].some(function(k){ return B.store.raw(k).length>0; })||!!localStorage.getItem('alkyon-notify'); }catch(e){ return false; } }
setTimeout(whatsNew,6000);
B.help={news:NEWS};
})();
