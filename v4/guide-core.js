/* Alkyon 4 · Οδηγός (κοινός κώδικας με την κλασική έκδοση).
   Το περιεχόμενο (είδη, τεχνικές, νόμοι, λίστα ασφαλείας, μαγαζιά) αντιγράφεται αυτούσιο από το app.js της κλασικής,
   ώστε οι δύο εκδόσεις να λένε ακριβώς τα ίδια. Τρέχει μία φορά, όταν ανοίξει πρώτη φορά ο Οδηγός. */
window.AlkyonGuideCore=function(){
'use strict';
const $=id=>document.getElementById(id);
function h(tag,props,...kids){
  const e=document.createElement(tag);
  for(const k in (props||{})){
    const v=props[k]; if(v==null||v===false) continue;
    if(k==='class') e.className=v;
    else if(k==='text') e.textContent=v;
    else if(k.slice(0,2)==='on') e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat()){ if(c==null||c===false) continue; e.append(c.nodeType?c:document.createTextNode(String(c))); }
  return e;
}
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
const toast=m=>window.AK.toast(m);
async function fetchJson(url){
  const ac=new AbortController(), t=setTimeout(()=>ac.abort(),9000);
  try{ const r=await fetch(url,{signal:ac.signal}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}
const SPECIES=[
 {n:'Λαυράκι',l:'Dicentrarchus labrax',w:'Κοντά στην ακτή, σε βράχια, λιμάνια και εκβολές.',m:'Spinning με τεχνητά, ζωντανό δόλωμα.',t:'Συχνά τα χαράματα και το σούρουπο.'},
 {n:'Τσιπούρα',l:'Sparus aurata',w:'Αμμώδεις και λασπώδεις πυθμένες, περίπου 5–30 m.',m:'Βυθού με οστρακοειδή.',t:'Πίεση που πέφτει αργά βοηθά.'},
 {n:'Σαργός',l:'Diplodus sargus',w:'Βραχώδεις ακτές και ρηχά.',m:'Βυθού με ελαφρύ μολύβι και κατάλληλο δόλωμα.',t:'Δουλεύει με λίγο κύμα που ανακατεύει τον πυθμένα.'},
 {n:'Λιθρίνι',l:'Pagellus erythrinus',w:'Αμμώδεις και λασπώδεις πυθμένες, περίπου 20–100 m.',m:'Βυθού με πολλά αγκίστρια.',t:'Συχνά σε βαθύτερα νερά.'},
 {n:'Συναγρίδα',l:'Dentex dentex',w:'Βραχώδεις πυθμένες και ύφαλοι, περίπου 20–100 m.',m:'Ζωντανό δόλωμα, jigging.',t:'Επιθετικό αρπακτικό. Θέλει γερό εξοπλισμό.'},
 {n:'Φαγκρί',l:'Pagrus pagrus',w:'Βραχώδεις και μικτοί πυθμένες, περίπου 20–100 m.',m:'Βυθού, jigging.',t:'Ψάρι βάθους, συνήθως πάνω από ύφαλο.'},
 {n:'Ροφός (ορφός)',l:'Epinephelus marginatus',w:'Βράχια και σπηλιές.',m:'Βυθού με γερή πετονιά.',t:'Απειλούμενο είδος σε πολλές περιοχές. Έλεγξε τα ισχύοντα μέτρα προστασίας πριν κρατήσεις ψάρι.',warn:'Προστασία'},
 {n:'Μαγιάτικο',l:'Seriola dumerili',w:'Ανοιχτά, γύρω από υφάλους και υποβρύχια ανάγλυφα.',m:'Jigging, ζωντανό δόλωμα.',t:'Δυνατός αγώνας. Χρειάζεται βαρύς εξοπλισμός.'},
 {n:'Κυνηγός',l:'Coryphaena hippurus',w:'Ανοιχτή θάλασσα, κοντά σε πλωτά αντικείμενα.',m:'Τρόλινγκ.',t:'Στη Μεσόγειο εμφανίζεται συνήθως από το τέλος του καλοκαιριού ως το φθινόπωρο.'},
 {n:'Λούτσος',l:'Sphyraena sphyraena',w:'Επιφάνεια ως μέσα νερά, κοντά σε ακτή και υφάλους.',m:'Τρόλινγκ, spinning.',t:'Κοφτερά δόντια. Χρησιμοποίησε ατσαλένιο ή fluorocarbon ηγέτη.'},
 {n:'Λαγοκέφαλος',l:'Lagocephalus sceleratus',w:'Εισβλητικό είδος σε όλα τα βάθη κοντά στην ακτή.',m:'Πιάνεται τυχαία σε διάφορες τεχνικές.',t:'Δηλητηριώδης. Περιέχει τετροδοτοξίνη. Δεν τρώγεται, δεν δίνεται και δεν πωλείται. Κόβει πετονιές και δαγκώνει.',warn:'Τοξικό'},
 {n:'Λεοντόψαρο',l:'Pterois miles',w:'Βράχια και ύφαλοι, σε μικρά και μεσαία βάθη.',m:'Πιάνεται τυχαία στον πυθμένα.',t:'Εισβλητικό. Τα αγκάθια είναι δηλητηριώδη. Χειρίσου με γάντια και τσιμπίδα.',warn:'Αγκάθια'},
 {n:"Χταπόδι",l:"Octopus vulgaris",e:"Common octopus",w:"Βραχώδεις και αμμώδεις πυθμένες, από τα ρηχά μέχρι περίπου 100 m. Κρύβεται σε τρύπες και κενά.",m:"Χταποδιέρα (octopus jig), κάθετη ρίψη με δόλωμα καβούρι, κιούπια. Συλλέγεται και με ψαροντούφεκο.",t:"Δυνατό και έξυπνο· αρπάζει και τραβά μέσα στη φωλιά. Μετά το πιάσιμο χρειάζεται χτύπημα και καθάρισμα πριν το μαγείρεμα.",mol:1},
 {n:"Καλαμάρι",l:"Loligo vulgaris",e:"European squid",w:"Ανοιχτά νερά και κοντά σε λιμάνια, συχνά γύρω από φώτα τη νύχτα. Βάθη από λίγα μέτρα μέχρι περίπου 100 m.",m:"Καλαμαριέρα (squid jig), ελαφριά ρίψη το σούρουπο και τη νύχτα, συχνά με φως.",t:"Εκτοξεύει μελάνι· πρόσεχε τα ρούχα και το κατάστρωμα. Καλύτερα τους ψυχρότερους μήνες.",mol:1},
 {n:"Σουπιά",l:"Sepia officinalis",e:"Common cuttlefish",w:"Αμμώδεις και λασπώδεις πυθμένες και λιβάδια ποσειδωνίας, ρηχά κοντά στην ακτή την άνοιξη.",m:"Καλαμαριέρα ή εγκι (egi) κοντά στον πυθμένα, κάθετα ή με ρίψη, τη νύχτα και την αυγή.",t:"Εκτοξεύει μελάνι. Την άνοιξη μπαίνει ρηχά για αναπαραγωγή· ελέγξτε τα ισχύοντα μέτρα και ελάχιστα μεγέθη.",mol:1},
 {n:"Μοσχιός",l:"Eledone moschata",e:"Musky octopus",w:"Αμμώδεις και λασπώδεις πυθμένες, συνήθως βαθύτερα από το χταπόδι.",m:"Συνήθως τυχαίο αλίευμα με βυθού ή από δίχτυα· δεν στοχεύεται συχνά με καλάμι.",t:"Μικρότερο από το χταπόδι, με έντονη μυρωδιά μόσχου. Έχει μία σειρά βεντούζες σε κάθε πλοκάμι.",mol:1},
 {n:"Μύδι",l:"Mytilus galloprovincialis",e:"Mediterranean mussel",w:"Βράχια, λιμάνια, πασσάλους και σχοινιά σε προστατευμένα νερά, κοντά στην επιφάνεια.",m:"Δεν ψαρεύεται με καλάμι. Συλλέγεται με το χέρι. Χρησιμοποιείται και ως δόλωμα.",t:"Μη τα συλλέγεις από λιμάνια ή βρώμικα νερά. Ρωτά για τοπικούς περιορισμούς υγιεινής και αλιείας.",mol:1},
 {n:"Πεταλίδα",l:"Patella caerulea",e:"Limpet",w:"Βράχια στη ζώνη των κυμάτων, κολλημένη στην πέτρα.",m:"Συλλέγεται με το χέρι ή με μαχαίρι από βράχια· χρησιμοποιείται και ως δόλωμα.",t:"Κρατά πολύ σφιχτά· γρήγορη κίνηση του μαχαιριού. Ελέγξτε τοπικούς κανονισμούς πριν τη συλλογή για κατανάλωση.",mol:1},
 {n:"Πίνα",l:"Pinna nobilis",e:"Noble pen shell",w:"Λιβάδια ποσειδωνίας και αμμώδεις πυθμένες, σε ρηχά βάθη.",m:"Δεν επιτρέπεται η συλλογή.",t:"Κρισίμως απειλούμενο και αυστηρά προστατευόμενο είδος. Μην το αγγίζεις ούτε να το μαζεύεις. Αν δεις ζωντανή πίνα, άφησέ την.",warn:"Προστατευόμενο",mol:1},
 {n:"Θαλάσσιος χουρμάς",l:"Lithophaga lithophaga",e:"Date mussel",w:"Ανοίγει τρύπες μέσα σε ασβεστολιθικούς βράχους κοντά στην επιφάνεια.",m:"Δεν επιτρέπεται η συλλογή.",t:"Η συλλογή του καταστρέφει τον βράχο και είναι απαγορευμένη. Μην το αγοράζεις και μην το συλλέγεις.",warn:"Απαγορευμένο",mol:1},
 {n:"Σουπιοκαλάμαρο",l:"Sepioteuthis lessoniana",e:"Bigfin reef squid",w:"Εισβλητικό είδος της Ανατολικής Μεσογείου, κοντά στην ακτή, πάνω από λιβάδια ποσειδωνίας και ρηχούς υφάλους.",m:"Καλαμαριέρα ή egi, ρίψη κοντά στην ακτή την αυγή, το σούρουπο και τη νύχτα.",t:"Μοιάζει με καλαμάρι αλλά με πλατύ πτερύγιο που τρέχει σχεδόν σε όλο το μήκος του σώματος. Εκτοξεύει μελάνι.",mol:1},
 {n:"Θράψαλο",l:"Todarodes sagittatus",e:"European flying squid",w:"Βαθύτερα νερά, συνήθως πάνω από 100 m, πάνω από ανοιχτούς πυθμένες.",m:"Σπάνια στοχεύεται από σκάφος με βαθιά καλαμαριέρα ή με πολύ βαθύ βυθού.",t:"Μεγαλύτερο από το καλαμάρι, με ρομβοειδές πτερύγιο στην ουρά.",mol:1},
 {n:"Στρείδι",l:"Ostrea edulis",e:"European flat oyster",w:"Ρηχά, προστατευμένα νερά με σκληρό πυθμένα και βράχια.",m:"Δεν ψαρεύεται με καλάμι. Συλλέγεται με το χέρι ή ψαροντούφεκο.",t:"Ελέγξε τοπικούς κανονισμούς και υγιεινή πριν από κάθε κατανάλωση. Μη συλλέγεις από ρυπασμένα νερά.",mol:1},
 {n:"Αχιβάδα",l:"Venus verrucosa",e:"Warty venus",w:"Αμμώδεις και αμμοβραχώδεις πυθμένες, σε ρηχά μέχρι μέτρια βάθη.",m:"Δεν ψαρεύεται με καλάμι. Συλλέγεται με το χέρι ή με εργαλείο στον πυθμένα.",t:"Ελέγξε τοπικούς κανονισμούς και υγιεινή πριν από κάθε κατανάλωση.",mol:1},
 {n:"Χτένι",l:"Pecten jacobaeus",e:"Great Mediterranean scallop",w:"Αμμώδεις και αμμοβραχώδεις πυθμένες, συνήθως 10–100 m.",m:"Δεν ψαρεύεται με καλάμι. Συλλέγεται με κατάδυση ή εργαλεία πυθμένα.",t:"Ελέγξε τοπικούς κανονισμούς και υγιεινή. Μη συλλέγεις από ρυπασμένα νερά.",mol:1},
 {n:"Μούρεξ",l:"Hexaplex trunculus",e:"Banded dye-murex",w:"Αμμώδεις, λασπώδεις και βραχώδεις πυθμένες, ρηχά ως μέτρια βάθη.",m:"Τυχαίο αλίευμα με κιούπια ή βυθού. Συλλέγεται και με το χέρι.",t:"Ελέγξε τοπικούς κανονισμούς και υγιεινή πριν από κάθε κατανάλωση.",mol:1},
 {n:"Τρίτωνας",l:"Charonia seguenzae",e:"Mediterranean triton",w:"Βραχώδεις πυθμένες και λιβάδια ποσειδωνίας.",m:"Δεν επιτρέπεται η συλλογή.",t:"Μεγάλο όστρακο και προστατευόμενο είδος. Μην το συλλέγεις ούτε να το αγοράζεις.",warn:"Προστατευόμενο",mol:1},
 {n:"Καραβίδα",l:"Palinurus elephas",e:"Common spiny lobster",w:"Βραχώδεις πυθμένες και ύφαλοι, από μέτρια μέχρι μεγάλα βάθη.",m:"Κιούπια και δίχτυα. Δεν στοχεύεται με καλάμι.",t:"Συχνά με ελάχιστο μέγεθος και απαγορευμένη περίοδο. Έλεγξε τα ισχύοντα μέτρα πριν από κάθε αλιεία.",cr:1},
 {n:"Αστακός",l:"Homarus gammarus",e:"European lobster",w:"Βραχώδεις πυθμένες με σπηλιές, σε μέτρια βάθη. Σπάνιος στη Μεσόγειο.",m:"Κιούπια. Δεν στοχεύεται με καλάμι.",t:"Σπάνιο και προστατευόμενο είδος σε πολλές περιοχές. Έλεγξε τα ισχύοντα μέτρα.",cr:1},
 {n:"Αρκούδα",l:"Scyllarides latus",e:"Mediterranean slipper lobster",w:"Βραχώδεις πυθμένες και ύφαλοι, ρηχά μέχρι μέτρια βάθη, συχνά τη νύχτα.",m:"Κιούπια ή βουτιά. Δεν στοχεύεται με καλάμι.",t:"Σε πολλές χώρες είναι προστατευόμενο είδος ή έχει απαγόρευση. Έλεγξε τα ισχύοντα μέτρα πριν πιάσεις.",warn:"Προστατευόμενο",cr:1},
 {n:"Γαρίδα",l:"Melicertus kerathurus",e:"Caramote prawn",w:"Αμμώδεις και λασπώδεις πυθμένες, ρηχά ως μέτρια βάθη.",m:"Συνήθως με δίχτυα και συρόμενα εργαλεία· εφαρμόζεται και ως δόλωμα.",t:"Ελέγξε τοπικούς κανονισμούς πριν από την αλιεία.",cr:1},
 {n:"Καβούρι πέτρας",l:"Eriphia verrucosa",e:"Warty crab",w:"Βράχια και ρηχά κοντά στην ακτή, κρυμμένο σε τρύπες.",m:"Συλλέγεται με το χέρι ή με κιούπι. Πολύ καλό δόλωμα για χταπόδι.",t:"Έχει δυνατές δαγκάνες· πρόσεχε τα δάχτυλα. Ελέγξε τοπικούς κανονισμούς.",cr:1},
 {n:"Γαλάζιο καβούρι",l:"Portunus segnis",e:"Blue swimmer crab",w:"Αμμώδεις πυθμένες, λιμάνια και εκβολές, ρηχά.",m:"Κιούπια, μικρά δίχτυα, και τυχαία με βυθού.",t:"Εισβλητικό είδος της Ανατολικής Μεσογείου. Πρόσεχε τις δαγκάνες και μην το ξαναρίξεις στη θάλασσα αν υπάρχει σχετική οδηγία.",cr:1},
 {n:"Αράχνη (καβούρι)",l:"Maja squinado",e:"Spiny spider crab",w:"Βραχώδεις και αμμώδεις πυθμένες, ρηχά ως μέτρια βάθη, ειδικά κατά την αναπαραγωγή.",m:"Κιούπια ή συλλογή με κατάδυση. Δεν στοχεύεται με καλάμι.",t:"Ελέγξε τοπικούς κανονισμούς, μεγέθη και απαγορευμένες περιόδους.",cr:1}
];
const SPEN={
"sepioteuthis lessoniana":{w:"Non-native species in the eastern Mediterranean, close to the coast over seagrass and shallow reefs.",m:"Squid jig or egi, cast near the coast at dawn, dusk and at night.",t:"Looks like a squid but with a broad fin running nearly the full length of the body. It squirts ink."},
"todarodes sagittatus":{w:"Deeper water, usually below 100 m, over open bottoms.",m:"Rarely targeted from a boat with a deep squid jig or very deep bottom fishing.",t:"Larger than the common squid, with a diamond-shaped tail fin."},
"ostrea edulis":{w:"Shallow sheltered water with hard bottom and rocks.",m:"Not caught with a rod. Collected by hand or spearfishing.",t:"Check local rules and hygiene before eating. Do not collect from polluted water."},
"venus verrucosa":{w:"Sandy and sandy-rocky bottoms, in shallow to moderate depths.",m:"Not caught with a rod. Collected by hand or with a bottom tool.",t:"Check local rules and hygiene before eating."},
"pecten jacobaeus":{w:"Sandy and sandy-rocky bottoms, usually 10–100 m.",m:"Not caught with a rod. Collected by diving or bottom tools.",t:"Check local rules and hygiene. Do not collect from polluted water."},
"hexaplex trunculus":{w:"Sandy, muddy and rocky bottoms, shallow to moderate depths.",m:"Incidental catch in pots or bottom fishing. Also collected by hand.",t:"Check local rules and hygiene before eating."},
"charonia seguenzae":{w:"Rocky bottoms and seagrass meadows.",m:"Collecting is not allowed.",t:"A large shell and a protected species. Do not collect or buy it.",warn:"Protected"},
"palinurus elephas":{w:"Rocky bottoms and reefs, from moderate to deeper water.",m:"Pots and nets. Not targeted with a rod.",t:"Often has a minimum size and closed season. Check current rules before fishing."},
"homarus gammarus":{w:"Rocky bottoms with caves, in moderate depths. Rare in the Mediterranean.",m:"Pots. Not targeted with a rod.",t:"Rare and protected in many areas. Check current rules."},
"scyllarides latus":{w:"Rocky bottoms and reefs, shallow to moderate depths, often at night.",m:"Pots or diving. Not targeted with a rod.",t:"Protected or banned in many countries. Check current rules before catching.",warn:"Protected"},
"melicertus kerathurus":{w:"Sandy and muddy bottoms, shallow to moderate depths.",m:"Usually with nets and trawls; also used as bait.",t:"Check local rules before fishing."},
"eriphia verrucosa":{w:"Rocks and shallows close to shore, hiding in holes.",m:"Collected by hand or with a pot. Very good bait for octopus.",t:"Strong claws: mind your fingers. Check local rules."},
"portunus segnis":{w:"Sandy bottoms, harbours and estuaries, shallow.",m:"Pots, small nets, and incidentally on bottom fishing.",t:"Non-native in the eastern Mediterranean. Mind the claws and follow local advice on release."},
"maja squinado":{w:"Rocky and sandy bottoms, shallow to moderate depths, especially when breeding.",m:"Pots or collecting by diving. Not targeted with a rod.",t:"Check local rules, sizes and closed seasons."},
"octopus vulgaris":{w:"Rocky and sandy bottoms, from shallows to about 100 m. Hides in holes and crevices.",m:"Octopus jig, vertical drop with crab bait, pots. Also taken by spearfishing.",t:"Strong and clever: it grabs and pulls into its den. Needs tenderising and cleaning before cooking."},
"loligo vulgaris":{w:"Open water and near harbours, often around lights at night. From a few metres to about 100 m.",m:"Squid jig, light casting at dusk and at night, often with a light.",t:"It squirts ink: mind your clothes and the deck. Best in the cooler months."},
"sepia officinalis":{w:"Sandy and muddy bottoms and seagrass meadows; shallow near the coast in spring.",m:"Squid jig or egi near the bottom, vertical or cast, at night and dawn.",t:"It squirts ink. It comes in shallow to breed in spring; check current rules and minimum sizes."},
"eledone moschata":{w:"Sandy and muddy bottoms, usually deeper than the common octopus.",m:"Usually an incidental catch on bottom fishing or in nets; rarely targeted with a rod.",t:"Smaller than the common octopus, with a musky smell. One row of suckers on each arm."},
"mytilus galloprovincialis":{w:"Rocks, harbours, piles and ropes in sheltered water, near the surface.",m:"Not caught with a rod. Collected by hand. Also used as bait.",t:"Do not collect from harbours or polluted water. Check local hygiene and fishing restrictions."},
"patella caerulea":{w:"Rocks in the wave zone, stuck to the stone.",m:"Collected by hand or with a knife from rocks; also used as bait.",t:"Holds very tight; use a quick knife motion. Check local rules before collecting for eating."},
"pinna nobilis":{w:"Seagrass meadows and sandy bottoms in shallow water.",m:"Collecting is not allowed.",t:"Critically endangered and strictly protected. Do not touch or collect it. If you see a living one, leave it alone.",warn:"Protected"},
"lithophaga lithophaga":{w:"Bores into limestone rock close to the surface.",m:"Collecting is not allowed.",t:"Collecting destroys the rock and is prohibited. Do not buy or collect it.",warn:"Prohibited"},
'dicentrarchus labrax':{w:'Close to shore, on rocks, in harbours and estuaries.',m:'Spinning with lures, live bait.',t:'Often at dawn and dusk.'},
'sparus aurata':{w:'Sandy and muddy bottoms, roughly 5–30 m.',m:'Bottom fishing with shellfish.',t:'Slowly falling pressure helps.'},
'diplodus sargus':{w:'Rocky shores and shallows.',m:'Bottom fishing with a light sinker and suitable bait.',t:'Works well with a little swell stirring up the bottom.'},
'pagellus erythrinus':{w:'Sandy and muddy bottoms, roughly 20–100 m.',m:'Bottom fishing with multiple hooks.',t:'Often in deeper water.'},
'dentex dentex':{w:'Rocky bottoms and reefs, roughly 20–100 m.',m:'Live bait, jigging.',t:'Aggressive predator. Needs strong tackle.'},
'pagrus pagrus':{w:'Rocky and mixed bottoms, roughly 20–100 m.',m:'Bottom fishing, jigging.',t:'Deep-water fish, usually over a reef.'},
'epinephelus marginatus':{w:'Rocks and caves.',m:'Bottom fishing with strong line.',t:'Endangered in many areas. Check the current protection rules before keeping a fish.',warn:'Protected'},
'seriola dumerili':{w:'Open water, around reefs and underwater structures.',m:'Jigging, live bait.',t:'Powerful fight. Needs heavy tackle.'},
'coryphaena hippurus':{w:'Open sea, near floating objects.',m:'Trolling.',t:'In the Mediterranean usually from late summer to autumn.'},
'sphyraena sphyraena':{w:'Surface to mid-water, near the coast and reefs.',m:'Trolling, spinning.',t:'Sharp teeth. Use a steel or fluorocarbon leader.'},
'lagocephalus sceleratus':{w:'Invasive species at all depths near the coast.',m:'Caught by accident with various techniques.',t:'Poisonous. Contains tetrodotoxin. Do not eat, give away or sell. It cuts lines and bites.',warn:'Toxic'},
'pterois miles':{w:'Rocks and reefs, in shallow and medium depths.',m:'Caught by accident on the bottom.',t:'Invasive. The spines are venomous. Handle with gloves and pliers.',warn:'Spines'}
};
const strip=x=>(x||'').toLowerCase().replace(/ς/g,'σ').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const CY=(window.CY100||[]);
const CYL={}; CY.forEach(c=>{const k=c.l.toLowerCase(); if(!CYL[k]) CYL[k]=c;});
const DB=(window.SPECIES_DB||[]).map(r=>({el:r[0],en:r[1],la:r[2],k:''}));
for(const c of CY){
  const row=DB.find(x=>x.la.toLowerCase()===c.l.toLowerCase());
  if(row){ if(!row.el) row.el=c.n; if(!row.en) row.en=c.e; row.alt=(row.alt||'')+' '+c.n; }
  else DB.push({el:c.n,en:c.e,la:c.l,k:''});
}
const MOLL=SPECIES.filter(x=>x.mol), CRUS=SPECIES.filter(x=>x.cr);
for(const x of MOLL.concat(CRUS)){ if(!DB.some(r=>r.la.toLowerCase()===x.l.toLowerCase())) DB.push({el:x.n,en:x.e||'',la:x.l,k:''}); }
DB.forEach(x=>{x.k=strip((x.el||'')+' '+(x.en||'')+' '+x.la+' '+(x.alt||''));});
const DETAIL={}; SPECIES.forEach(x=>DETAIL[x.l.toLowerCase()]=x);
function searchDB(q,max){
  q=strip(q.trim()); if(!q) return [];
  const out=[];
  for(const sp of DB){ const i=sp.k.indexOf(q); if(i<0) continue; const w=i===0||/[ \/]/.test(sp.k[i-1]); out.push([w?0:1,sp]); }
  out.sort((a,b)=>a[0]-b[0]);
  return out.slice(0,max).map(x=>x[1]);
}
const dispName=sp=>sp.el||sp.en;
const shownName=sp=>window.LANG==='en'?(sp.en||sp.el):(sp.el||sp.en);
const matchSp=txt=>{ const n=strip((txt||'').trim()); if(!n) return null; return DB.find(d=>(d.el&&strip(d.el)===n)||(d.en&&strip(d.en)===n))||DB.find(d=>d.alt&&strip(d.alt).split(/[\/,;]/).some(w=>w.trim()===n))||null; };
let gbifSeen=[];
async function gbifSearch(q){
  const j=await fetchJson('https://api.gbif.org/v1/species/search?q='+encodeURIComponent(q)+'&rank=SPECIES&status=ACCEPTED&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&limit=15');
  const FISH=['Actinopterygii','Elasmobranchii','Holocephali','Petromyzonti','Cephalaspidomorphi','Sarcopterygii','Chondrichthyes'];
  return (j.results||[]).filter(r=>FISH.includes(r.class)&&(r.canonicalName||r.scientificName)).map(r=>{
    const v=(r.vernacularNames||[]).find(x=>x.language==='eng'); 
    return {el:null,en:v?v.vernacularName:(r.canonicalName||r.scientificName),la:r.canonicalName||r.scientificName,k:''};
  });
}
let imgP=null;
function loadFishImgs(){ if(window.FISH_IMG) return Promise.resolve(); if(!imgP) imgP=new Promise(r=>{const s=document.createElement('script');s.src='../fish-photos.js';s.onload=()=>r();s.onerror=()=>{imgP=null;r();};document.head.append(s);}); return imgP; }

/* Φωτογραφίες ειδών που δεν είναι στο βιβλίο του Τμήματος Αλιείας: από Wikipedia/Wikimedia Commons, φορτώνονται online όταν ανοίγεις το είδος και αποθηκεύονται στο κινητό */
const WP_KEY='alkyon-wikipic';
function wikiPic(la){
  const k=(la||'').trim(); if(!k) return Promise.resolve(null);
  let c={}; try{ c=JSON.parse(localStorage.getItem(WP_KEY)||'{}'); }catch(e){}
  if(c[k]!==undefined) return Promise.resolve(c[k]||null);
  if(!navigator.onLine) return Promise.resolve(null);
  return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(k.replace(/\s+/g,'_')),{headers:{'Accept':'application/json'}})
    .then(r=>r.ok?r.json():null).then(j=>{
      const src=j&&j.thumbnail&&j.thumbnail.source, page=j&&j.content_urls&&j.content_urls.desktop&&j.content_urls.desktop.page;
      const v=src&&j.type!=='disambiguation'?{src:src,page:page||''}:0;
      try{ c[k]=v; localStorage.setItem(WP_KEY,JSON.stringify(c)); }catch(e){}
      return v||null;
    }).catch(()=>null);
}
function spBadges(sp){ const en=window.LANG==='en', b=h('span',{class:'spbd'}), mn=minOf(sp.la), k=kbOf(sp.la);
  if(noKeep(sp)) b.append(h('i',{class:'bd no',text:en?'Release':'Ελευθέρωσε'}));
  else if(mn) b.append(h('i',{class:'bd mn',text:(en?'Min ':'Ελάχ. ')+mn+' cm'}));
  if(k&&k.m&&k.m[new Date().getMonth()]>=2) b.append(h('i',{class:'bd ss',text:en?'In season':'Εποχή του'}));
  if(k&&k.d) b.append(h('i',{class:'bd dp',text:k.d[0]+'–'+k.d[1]+' m'}));
  return b.children.length?b:null; }
function spItem(sp){
  const d0=DETAIL[(sp.la||'').toLowerCase()], d=d0&&window.LANG==='en'&&SPEN[d0.l.toLowerCase()]?Object.assign({},d0,SPEN[d0.l.toLowerCase()]):d0, cy=CYL[(sp.la||'').toLowerCase()];
  const slug=(sp.la||'').trim().replace(/\s+/g,'-');
  const fb=h('a',{href:'https://www.fishbase.se/summary/'+encodeURIComponent(slug)+'.html',target:'_blank',rel:'noopener',text:'FishBase'});
  const body=d?h('dl',{class:'dl'},h('dt',{text:'Πού'}),h('dd',{text:d.w}),h('dt',{text:'Πώς'}),h('dd',{text:d.m}),h('dt',{text:'Σημείωση'}),h('dd',{text:d.t}))
    :h('p',{class:'muted',text:'Δεν υπάρχει αναλυτική περιγραφή στην εφαρμογή. Δες περισσότερα στο '}) ;
  if(!d&&!cy) body.append(fb);
  const ci=cy?CY.indexOf(cy):-1; const pic=h('img',{class:'gdimg',alt:cy?cy.n:'',hidden:true});
  const det=h('details',{class:'sp'},
    h('summary',{},h('span',{class:'spn'},h('b',{text:cy?((window.LANG==='en'&&cy.e)?cy.e:cy.n):(d?((window.LANG==='en'&&(d.mol||d.cr)&&sp.en)?sp.en:d.n):(window.LANG==='en'?(sp.en||dispName(sp)):dispName(sp)))}),d&&d.warn?h('span',{class:'tag',text:d.warn}):null,(sp.el&&sp.en&&!d&&!cy&&window.LANG!=='en')?h('span',{class:'muted',text:' · '+sp.en}):null,spBadges(sp)),h('span',{class:'lat',text:sp.la})),
    h('div',{class:'body'},cy?h('p',{text:(window.LANG==='en'&&window.CY100EN&&window.CY100EN[cy.l])||cy.t}):null,cy?h('p',{class:'note',text:'Πηγή: «Τα 100 σημαντικότερα είδη ψαριών των κυπριακών θαλασσών», Τμήμα Αλιείας και Θαλασσίων Ερευνών, Κύπρος.'}):null,(d&&cy)?h('h3',{text:'Πρακτικά για το ψάρεμα',style:'margin-top:10px'}):null,d?body:(cy?null:body)));
  det.querySelector('.body').prepend(pic);
  if(ci<0&&sp.la) det.addEventListener('toggle',()=>{ if(!det.open||pic.src||pic._w) return; pic._w=1; wikiPic(sp.la).then(r=>{ if(r&&r.src){ pic.src=r.src; pic.hidden=false; if(r.page&&!det.querySelector('.spcr')){ const c=h('p',{class:'note spcr'}); const en=window.LANG==='en'; c.append(en?'Photo: ':'Φωτογραφία: ',h('a',{href:r.page,target:'_blank',rel:'noopener',text:'Wikipedia / Wikimedia Commons'}),en?' (author and licence on the page).':' (δημιουργός και άδεια στη σελίδα).'); pic.after(c); } } }); });
  if(ci>=0) det.addEventListener('toggle',()=>{ if(!det.open||pic.src) return; loadFishImgs().then(()=>{const u=(window.FISH_IMG||[])[ci]; if(u){pic.src=u;pic.hidden=false;}}); });
  return det;
}
let enP=null;
function loadEN(){ if(window.LANG!=='en'||window.CY100EN) return Promise.resolve(); if(!enP) enP=new Promise(r=>{const s=document.createElement('script');s.src='../cy100-en.js';s.onload=()=>r(true);s.onerror=()=>{enP=null;r(false);};document.head.append(s);}); return enP; }
let spReg='cy';
/* 1.12.15: φίλτρα και ετικέτες: ελάχιστο μέγεθος (rules.js), εποχή και βάθος (knowledge.js), δεν κρατιούνται */
let spF='all';
function kbOf(la){ const l=(la||'').toLowerCase(); return (window.SPKB||[]).find(k=>(k.l||'').toLowerCase()===l)||null; }
function noKeep(sp){ const la=(sp.la||'').toLowerCase(), n=((sp.el||'')+' '+(sp.en||'')).toLowerCase(); return /^(thunnus thynnus|xiphias gladius)$/.test(la)||/^(lagocephalus|torquigener|sphoeroides) /.test(la)||/καρχαρ|γαλεό|σκυλόψαρ|σαλάχ|τρυγόνα|shark|\bray\b|skate|stingray/.test(n)||/^(carcharhinus|prionace|isurus|mustelus|squalus|raja|dasyatis|myliobatis|torpedo|scyliorhinus|galeorhinus|hexanchus|alopias|sphyrna|lamna|rhinobatos|glaucostegus|pteroplatytrygon|gymnura|aetomylaeus) /.test(la); }
function inSeason(sp){ const k=kbOf(sp.la); return !!(k&&k.m&&k.m[new Date().getMonth()]>=2); }
function spFilter(list){ if(spF==='all') return list; return list.filter(sp=>spF==='season'?inSeason(sp):spF==='min'?minOf(sp.la)>0:spF==='nokeep'?noKeep(sp):true); }
function spFBar(){ const en=window.LANG==='en'; let bar=$('spFs'); if(!bar){ bar=h('div',{class:'spregs spfs',id:'spFs',role:'group','aria-label':en?'Filter':'Φίλτρο'}); $('spRegs').after(bar); }
  bar.replaceChildren(); const MN=en?['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']:['Ιαν','Φεβ','Μάρ','Απρ','Μάι','Ιούν','Ιούλ','Αύγ','Σεπ','Οκτ','Νοέ','Δεκ'];
  [['all',en?'All':'Όλα'],['season',(en?'In season · ':'Τώρα πιάνεται · ')+MN[new Date().getMonth()]],['min',en?'Minimum size':'Ελάχιστο μέγεθος'],['nokeep',en?'Not allowed to keep':'Δεν κρατιούνται']].forEach(([k,t])=>{
    bar.append(h('button',{type:'button',class:'chip sm','aria-pressed':String(spF===k),text:t,onclick:()=>{ spF=k; renderSpecies(); }})); }); }
function spRegBar(){
  const en=window.LANG==='en'; let bar=$('spRegs'); if(!bar){ bar=h('div',{class:'spregs',id:'spRegs',role:'group','aria-label':en?'Region':'Περιοχή'}); $('spQ').after(bar); }
  bar.replaceChildren();
  [['cy',en?'Cyprus (Dept. of Fisheries)':'Κύπρος (Τμήμα Αλιείας)'],['mol',en?'Molluscs':'Μαλάκια'],['cr',en?'Crustaceans':'Καρκινοειδή'],['*',en?'All':'Όλα']].concat((window.SPECIES_REGIONS||[]).map(r=>[r[0],en?r[2]:r[1]])).forEach(([k,t])=>{
    bar.append(h('button',{type:'button',class:'chip','aria-pressed':String(spReg===k),text:t,onclick:()=>{ spReg=k; renderSpecies(); }}));
  });
  try{ const on=bar.querySelector('[aria-pressed=true]'); if(on) bar.scrollLeft=Math.max(0,on.offsetLeft-12); }catch(e){}
}
function renderSpecies(extra){
  spRegBar();
  if(window.LANG==='en'&&!window.CY100EN&&!renderSpecies._w){ renderSpecies._w=1; loadEN().then(()=>{ renderSpecies._w=0; renderSpecies(extra); }); }
  const q=$('spQ').value.trim(); const L=$('spList'); L.replaceChildren();
  $('spCount').textContent=(q?'':'Τα 100 είδη των κυπριακών θαλασσών (Τμήμα Αλιείας). ')+'Στη βάση: '+DB.length+' είδη, ενδεικτική λίστα.';
  let list;
  if(!q&&(spReg==='mol'||spReg==='cr')){
    const en=window.LANG==='en'; list=(spReg==='mol'?MOLL:CRUS).map(x=>({el:x.n,en:x.e||'',la:x.l}));
    $('spCount').textContent=(spReg==='mol'?(en?'Molluscs · ':'Μαλάκια · '):(en?'Crustaceans · ':'Καρκινοειδή · '))+list.length+(en?' species. General guidance only: check local rules, sizes and closed seasons.':' είδη. Γενική καθοδήγηση: έλεγξε τοπικούς κανονισμούς, μεγέθη και απαγορευμένες περιόδους.');
  }
  else if(!q&&spReg!=='cy'){
    const rg=window.SPECIES_REG||{}, en=window.LANG==='en';
    list=DB.filter(sp=>spReg==='*'||(rg[(sp.la||'').toLowerCase()]||'m').indexOf(spReg)>=0).sort((a,b)=>strip(shownName(a)).localeCompare(strip(shownName(b)),en?'en':'el')).map(sp=>({el:sp.el,en:sp.en||'',la:sp.la}));
    const rn=spReg==='*'?(en?'All species':'Όλα τα είδη'):(((window.SPECIES_REGIONS||[]).find(r=>r[0]===spReg)||[])[en?2:1]||'');
    $('spCount').textContent=rn+' · '+list.length+(en?' species. Regions are indicative; it does not mean fishing the species is allowed there.':' είδη. Οι περιοχές είναι ενδεικτικές· δεν σημαίνει ότι επιτρέπεται η αλιεία του είδους εκεί.');
  }
  else if(!q){
    list=CY.slice().sort((x,y)=>x.n.localeCompare(y.n,'el')).map(c=>({el:c.n,en:c.e,la:c.l}));
    SPECIES.forEach(x=>{ if(!CYL[x.l.toLowerCase()])list.push({el:x.n,en:x.e||'',la:x.l}); });
  }
  else list=searchDB(q,60).concat(Array.isArray(extra)?extra.filter(e=>!DB.some(d=>d.la.toLowerCase()===e.la.toLowerCase())):[]);
  spFBar(); const tot=list.length; list=spFilter(list);
  if(spF!=='all') $('spCount').textContent=list.length+(window.LANG==='en'?' of ':' από ')+tot+(window.LANG==='en'?' species':' είδη')+(spF==='season'?(window.LANG==='en'?' usually caught this month (indicative, from general knowledge).':' που συνήθως πιάνονται αυτόν τον μήνα (ενδεικτικά, από γενική γνώση).'):spF==='min'?(window.LANG==='en'?' with a legal minimum size (Cyprus).':' με ελάχιστο νόμιμο μέγεθος (Κύπρος).'):(window.LANG==='en'?' that may not be kept: release them.':' που δεν επιτρέπεται να κρατήσεις: ελευθέρωσέ τα.'));
  for(const sp of list) L.append(spItem(sp));
  if(!L.children.length) L.append(h('div',{class:'empty',text:spF!=='all'?(window.LANG==='en'?'No species with this filter here.':'Κανένα είδος με αυτό το φίλτρο εδώ.'):'Κανένα είδος δεν ταιριάζει. Δοκίμασε αναζήτηση online.'}));
  $('spOnline').hidden=q.length<3;
}
$('spOnline').addEventListener('click',async()=>{
  const b=$('spOnline'); b.disabled=true; b.textContent='Αναζήτηση…';
  try{ const r=await gbifSearch($('spQ').value.trim()); renderSpecies(r); if(!r.length) toast('Δεν βρέθηκαν ψάρια online.'); }
  catch(e){ toast('Η online αναζήτηση δεν δούλεψε.'); }
  b.disabled=false; b.textContent='Αναζήτηση online (GBIF)';
});
$('spQ').addEventListener('input',()=>renderSpecies());
const TECH=[
 {n:'Βυθού',d:'Καλάμι με μολύβι και ένα ή περισσότερα αγκίστρια κοντά στον πυθμένα. Κατάλληλο για σαργούς, τσιπούρες, λιθρίνια.',g:'Καλάμι 2,4–3 m, πετονιά 0,25–0,35 mm, μολύβι ανάλογα με το ρεύμα.'},
 {n:'Jigging',d:'Κάθετη κίνηση μεταλλικού τεχνητού κοντά σε ύφαλο ή κατωφλι. Καλό για συναγρίδες και μαγιάτικα.',g:'Κοντό καλάμι jigging, μηχανισμός με καλή τριβή, braid, jigs 60–200 g.'},
 {n:'Τρόλινγκ',d:'Τράβηγμα τεχνητών πίσω από το σκάφος με σταθερή ταχύτητα. Για κυνηγούς, λούτσους και άλλα επιφανειακά.',g:'Ταχύτητα περίπου 4–7 κόμβοι, ηγέτες ανθεκτικοί στα δόντια.'},
 {n:'Spinning',d:'Ρίψη και μάζεμα τεχνητών κοντά στη ακτογραμμή ή πάνω από ρηχούς υφάλους. Για λαυράκια και λούτσους.',g:'Καλάμι 2,1–2,7 m, braid 0,15–0,25 mm, ηγέτης fluorocarbon.'},
 {n:'Ζωντανό δόλωμα',d:'Ζωντανό ψαράκι σε αγκίστρι, ελεύθερο ή στον πυθμένα. Για μεγάλα αρπακτικά.',g:'Δυνατό καλάμι, ηγέτης ανάλογα με το είδος, καλή φροντίδα του δολώματος.'}
];
function renderTech(){
  const L=$('g-tech'); L.replaceChildren();
  for(const t of TECH) L.append(h('div',{class:'card'},h('h3',{text:t.n}),h('p',{text:t.d}),h('div',{class:'note',text:'Εξοπλισμός: '+t.g})));
  L.append(h('p',{class:'note',text:'Οι τιμές είναι ενδεικτικές. Προσάρμοσέ τες στο σημείο, το ψάρι-στόχο και το ρεύμα.'}));
}
const CHECKS=['Σωσίβια για όλους στο σκάφος','VHF και φορτισμένο κινητό','Φάρμακα και κουτί πρώτων βοηθειών','Πυρσοί και σήμα κινδύνου','Άγκυρα και αρκετό σχοινί','Καύσιμο με εφεδρεία','Νερό και προστασία από τον ήλιο','Τσιμπίδα και γάντια για αγκάθια','Πρόγνωση καιρού ελεγμένη','Ενημέρωση κάποιου στη στεριά για τη διαδρομή'];
function renderChecks(){
  const saved=lsGet('alkyon-checks',{}); const C=$('checks'); C.replaceChildren();
  CHECKS.forEach((t,i)=>{
    const id='ck'+i, cb=h('input',{type:'checkbox',id:id});
    cb.checked=!!saved[i];
    cb.addEventListener('change',()=>{const s2=lsGet('alkyon-checks',{});s2[i]=cb.checked;lsSet('alkyon-checks',s2);});
    C.append(h('div',{class:'chk'},cb,h('label',{for:id,text:t})));
  });
}
document.querySelectorAll('#tab-guide .seg:not(.lawc) button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#tab-guide .seg:not(.lawc) button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  for(const g of ['species','tech','law','safety','shops']) $('g-'+g).hidden=(g!==b.dataset.g);
}));
/* ---------- Law (Cyprus) ---------- */
const MIN=window.MIN_SIZES||{};
function minOf(la){ if(!la) return 0; if(MIN[la]) return MIN[la]; const g=la.split(' ')[0]; if(g==='Chelon'||g==='Liza'||g==='Oedalechilus') return MIN['Mugil spp.']||0; return MIN[g+' spp.']||MIN[g+' sp.']||0; }
function lnk(href,text){return h('a',{href:href,target:'_blank',rel:'noopener',text:text});}
function lawCard(title,items,src){
  return h('div',{class:'card'},h('h3',{text:title}),h('ul',{class:'law'},items.map(x=>h('li',{},x))),src?h('div',{class:'note',style:'margin-top:8px'},'Πηγή: ',src):null);
}
/* 1.11.0: νόμοι για Κύπρο ή Ελλάδα (διαλέγεις πάνω· αρχικά η χώρα όπου βρίσκεσαι) */
let lawC=(window.AK&&AK.country)?AK.country():'cy';   /* 1.11.4: μπορεί να είναι και άλλη χώρα ή '' (άγνωστη) */
function lawSeg(L){
  /* 1.11.5: Κύπρος · Ελλάδα · (η άλλη χώρα που έχεις διαλέξει) + λίστα με όλες τις χώρες. Οι χώρες με οδηγό πρώτα. */
  const EN=window.LANG==='en', W=window.ALKYON_LAWS||{}, nm=c=>AK.countryName?AK.countryName(c):c.toUpperCase();
  const btns=[['cy',EN?'Cyprus':'Κύπρος'],['gr',EN?'Greece':'Ελλάδα']]; if(lawC&&lawC!=='cy'&&lawC!=='gr'&&lawC!=='xx') btns.push([lawC,nm(lawC)]);
  const sel=h('select',{class:'lawsel','aria-label':EN?'Other country':'Άλλη χώρα',onchange:e=>{ if(e.target.value){ lawC=e.target.value; renderLaw(); } }});
  sel.append(h('option',{value:'',text:EN?'Other country…':'Άλλη χώρα…'}));
  const all=(AK.COUNTRIES||[]).filter(c=>c!=='cy'&&c!=='gr').map(c=>[c,nm(c)]).sort((a,b)=>a[1].localeCompare(b[1],EN?'en':'el'));
  const g1=h('optgroup',{label:EN?'With a guide':'Με οδηγό'}), g2=h('optgroup',{label:EN?'All countries':'Όλες οι χώρες'});
  all.forEach(x=>{ (W[x[0]]&&!W[x[0]].part?g1:g2).append(h('option',{value:x[0],text:x[1]})); }); sel.append(g1,g2);
  L.append(h('div',{class:'lawbar'},h('div',{class:'seg lawc',role:'group','aria-label':EN?'Country':'Χώρα'},btns.map(x=>h('button',{type:'button','aria-pressed':String(lawC===x[0]),text:x[1],onclick:()=>{ lawC=x[0]; renderLaw(); }}))),sel));
  /* πάντα, για κάθε χώρα */
  L.append(h('div',{class:'card lawwarn'},h('p',{text:EN?'Always check the official websites and current regulations of the country before you fish. Rules change, have local exceptions, and this summary is only a guide, not legal advice.':'Πάντα να ελέγχεις τις επίσημες σελίδες και τους ισχύοντες κανονισμούς της χώρας πριν ψαρέψεις. Οι κανόνες αλλάζουν, έχουν τοπικές εξαιρέσεις, και αυτή η περίληψη είναι μόνο οδηγός, όχι νομική συμβουλή.'})));
}
/* 1.11.5: άλλες χώρες, από το laws-world.js */
function renderLawW(L,c){
  const EN=window.LANG==='en', t=x=>Array.isArray(x)?(EN?x[1]:x[0]):x, W=window.ALKYON_LAWS, nm=c&&c!=='xx'&&AK.countryName?AK.countryName(c):'';
  if(!W){ if(!renderLawW.ld){ renderLawW.ld=1; const s=document.createElement('script'); s.src='../laws-world.js'; s.onload=()=>renderLaw(); s.onerror=()=>{ renderLawW.ld=0; }; document.head.append(s); } L.append(h('p',{class:'note',text:'…'})); return; }
  const X=W[c], src=a=>(a||[]).flatMap((x,i)=>[i?' · ':'',lnk(x[0],x[1])]);
  if(!X||!X.cards.length){
    L.append(h('div',{class:'card'},h('p',{text:nm?(EN?'We do not have a checked guide for '+nm+' yet. We add countries one by one, only from official sources.':'Δεν έχουμε ακόμα ελεγμένο οδηγό για: '+nm+'. Προσθέτουμε χώρες σιγά σιγά, μόνο από επίσημες πηγές.'):(EN?'Choose a country above.':'Διάλεξε χώρα πάνω.')}),
      h('p',{text:EN?'Before fishing, ask the fisheries authority or the coast guard of the area.':'Πριν ψαρέψεις, ρώτα την αρχή αλιείας ή το λιμεναρχείο της περιοχής.'}),
      X&&X.off?h('p',{class:'note'},EN?'Official: ':'Επίσημα: ',...src(X.off)):null));
  } else {
    L.append(h('div',{class:'card'},h('p',{text:(EN?'Summary for recreational sea fishing in '+nm+', checked on ':'Περίληψη για ερασιτεχνικό ψάρεμα στη θάλασσα: '+nm+', ελεγμένη στις ')+X.ck.split('-').reverse().join('/')+(EN?'. Only what we found in official sources is listed; anything missing, check locally.':'. Γράφουμε μόνο ό,τι βρήκαμε σε επίσημες πηγές· ό,τι λείπει, έλεγξέ το τοπικά.')}),
      X.off?h('p',{class:'note'},EN?'Official: ':'Επίσημα: ',...src(X.off)):null));
    X.cards.forEach(k=>L.append(lawCard(t(k.t),k.i.map(t),k.src?src(k.src):null)));
  }
  if(X&&X.eu&&window.ALKYON_LAWS_EU){ const E=window.ALKYON_LAWS_EU; L.append(lawCard(t(E.t),E.i.map(t),src(E.src))); }
  L.append(lawCard(EN?'Emergency':'Έκτακτη ανάγκη',[X&&X.sos?t(X.sos):(EN?'112 works in most countries · VHF channel 16 at sea':'Το 112 λειτουργεί στις περισσότερες χώρες · VHF κανάλι 16 στη θάλασσα')]));
  L.append(h('div',{class:'card lawwarn'},h('p',{text:EN?'Always check the official websites and regulations before fishing.':'Πάντα να ελέγχεις τις επίσημες σελίδες και τους κανονισμούς πριν ψαρέψεις.'})));
}
const MIN_EU={'Dicentrarchus labrax':25,'Diplodus annularis':12,'Diplodus puntazzo':18,'Diplodus sargus':23,'Diplodus vulgaris':18,'Engraulis encrasicolus':9,'Epinephelus spp.':45,'Lithognathus mormyrus':20,'Merluccius merluccius':20,'Mullus spp.':11,'Pagellus acarne':17,'Pagellus bogaraveo':33,'Pagellus erythrinus':15,'Pagrus pagrus':18,'Polyprion americanus':45,'Sardina pilchardus':11,'Scomber spp.':18,'Solea vulgaris':20,'Sparus aurata':23,'Trachurus spp.':15};
function renderLawGR(L){
  L.append(h('div',{class:'card'},h('p',{text:'Περίληψη για ερασιτεχνικό ψάρεμα στη θάλασσα στην Ελλάδα, ελεγμένη στις 10/11/2026. Δεν αποτελεί νομική συμβουλή. Ισχύουν ο νόμος και οι οδηγίες του Λιμενικού Σώματος, που μπορεί να αλλάξουν.'})));
  L.append(lawCard('Άδεια',[
    'Σήμερα δεν χρειάζεται άδεια για ερασιτεχνικό ψάρεμα από στεριά, από σκάφος ή με ψαροντούφεκο. Οι περιορισμοί όμως ισχύουν κανονικά.',
    'Ερασιτεχνικό ψάρεμα στα χωρικά ύδατα επιτρέπεται μόνο από σκάφη με ελληνική σημαία (ΝΔ 420/1970, άρθρο 32· Καν. ΕΕ 1380/2013).',
    'Έχει ανακοινωθεί νέο σύστημα (μητρώο ερασιτεχνών, καταγραφή αλιευμάτων από εφαρμογή). Ο νέος κανονισμός ελέγχου της ΕΕ προβλέπει ψηφιακή καταγραφή ορισμένων ερασιτεχνικών αλιευμάτων. Πότε και πώς θα ισχύσει στην Ελλάδα το ανακοινώνουν το Λιμενικό και το Υπουργείο. Έλεγξε πριν βγεις.'
  ],[lnk('https://alieia.hcg.gr/faq/faq.php','Λιμενικό Σώμα, συχνές ερωτήσεις αλιείας'),', ελέγχθηκε 10/11/2026']));
  L.append(lawCard('Όρια ποσότητας (ανά άτομο και ανά 24ωρο)',[
    'Έως 5 kg ψάρια ή κεφαλόποδα. Με παραγάδι έως 10 kg.',
    'Εξαίρεση: ένα ψάρι που μόνο του ζυγίζει περισσότερο από το όριο.',
    'Ένα μόνο ροφοειδές (Epinephelus: σφυρίδα, ροφός, στήρα κ.ά.) ανά ψαρά.',
    'Αχινοί: έως 20 ανά άτομο χωρίς σκάφος, έως 30 συνολικά ανά σκάφος.',
    'Δολώματα (σκουλήκι άμμου, πεταλίδες, ερημίτες): έως 30 από κάθε είδος χωρίς σκάφος, έως 60 ανά σκάφος.'
  ],['ΠΔ 373/1985, άρθρο 2 παρ. 2 · ',lnk('https://alieia.hcg.gr/NOMOTHESIA/PD373-85_enop.pdf','ενοποιημένο κείμενο (Λιμενικό)')]));
  L.append(lawCard('Εργαλεία',[
    'Καθετή, συρτή, πεταχτάρι, τσαπαρί, καλάμι, πετονιά: χωρίς περιορισμό.',
    'Παραγάδι: έως 150 αγκίστρια ανά ψαρά και έως 300 ανά σκάφος. Όχι από τη στεριά.',
    'Κιούρτοι / κοφινέλα: έως 2 ανά ψαρά, μάτι πάνω από 40 mm. Πεζόβολος: ένας ανά ψαρά.',
    'Δίχτυα (απλάδια, μανωμένα), γρι-γρι, βολκοί, παραγάδια για τόνο: απαγορεύονται στους ερασιτέχνες (άρθρο 17 Καν. ΕΚ 1967/2006).',
    'Τον Μάιο απαγορεύεται το ψάρεμα με παραγάδι (και με δίχτυα).',
    'Όχι φως για προσέλκυση ψαριών (εξαίρεση: καμάκι με φανό έως 500 κεριά). Όχι τηλεκατευθυνόμενες συσκευές για αγκίστρια. Ηλεκτρικό καρούλι σε πετονιά χειρός επιτρέπεται προς το παρόν.'
  ],['ΠΔ 373/1985, άρθρα 1–2 · Λιμενικό, συχνές ερωτήσεις']));
  L.append(lawCard('Ψαροντούφεκο',[
    'Όχι κάτω από 16 ετών.',
    'Όχι από τη δύση ως την ανατολή του ηλίου. Όχι τον Μάιο.',
    'Όχι με οποιαδήποτε συσκευή παροχής αέρα, όχι με υποβρύχιο φως.',
    'Όχι ψάρια κάτω από 150 γραμμάρια.',
    'Τουλάχιστον 200 m από λουόμενους, λιμενικά έργα, αγκυροβολημένα πλοία, διαύλους και εισόδους λιμανιών.',
    'Σημαδούρα κίτρινη με κίτρινη σημαία με κόκκινη διαγώνια λωρίδα και «Υ.Δ.», ορατή από 300 m. Μένεις έως 50 m από τη σημαδούρα ή το σκάφος σου.',
    'Όχι δίχτυα, όχι ψάρια από ξένα εργαλεία.'
  ],['ΠΔ 373/1985, άρθρο 3']));
  L.append(lawCard('Χειρισμός αλιεύματος και ειδικά είδη',[
    'Απαγορεύεται η πώληση και κάθε εμπόριο ερασιτεχνικού αλιεύματος.',
    'Κόκκινος τόνος, μακρύπτερος τόνος και ξιφίας: μόνο από επαγγελματίες με ειδική άδεια. Αν πιαστεί ζωντανός, απελευθέρωση αμέσως. Αν πεθάνει, ενημερώνεις το Λιμενικό.',
    'Λαγοκέφαλος: τοξικός, δεν τρώγεται.'
  ],['ΠΔ 373/1985, άρθρο 1 παρ. 7 · Λιμενικό, συχνές ερωτήσεις']));
  const rows=Object.keys(MIN_EU).map(la=>{const c=CYL[la.toLowerCase()]; return [c?c.n:la,la,MIN_EU[la]];}).sort((a,b)=>a[0].localeCompare(b[0],'el'));
  L.append(h('div',{class:'card'},h('h3',{text:'Ελάχιστα μεγέθη (ολικό μήκος)'}),
    h('div',{class:'bar',style:'grid-template-columns:1fr auto;font-weight:600'},h('span',{text:'Είδος'}),h('span',{text:'cm'})),
    rows.map(r=>h('div',{class:'bar',style:'grid-template-columns:1fr auto'},h('span',{},r[0],' ',h('i',{class:'muted',text:r[1]})),h('span',{class:'n',text:String(r[2])}))),
    h('div',{class:'note',style:'margin-top:8px'},'Πηγή: Καν. (ΕΚ) 1967/2006, Παράρτημα III (ισχύει σε όλη την ΕΕ στη Μεσόγειο). Για το ψαροντούφεκο ισχύει και το όριο των 150 g. Μπορεί να υπάρχουν και εθνικά όρια για άλλα είδη: έλεγξε με το Λιμενικό.')));
  L.append(lawCard('Προστατευόμενες περιοχές',[
    'Εθνικό Θαλάσσιο Πάρκο Αλοννήσου Βορείων Σποράδων: στη ζώνη Α ερασιτεχνικό ψάρεμα μόνο στην περιοχή Α9 και μόνο με συρτή και καθετή. Στη ζώνη Β συρτή και καθετή παντού, ψαροντούφεκο μόνο σε συγκεκριμένες περιοχές. Γύρω από την Ψαθούρα (1,5 ναυτικά μίλια) καθόλου ψάρεμα.',
    'Θαλάσσιο Καταφύγιο Άγριας Ζωής Γυάρου: ψάρεμα απαγορεύεται στις ζώνες προστασίας.',
    'Εθνικό Θαλάσσιο Πάρκο Ζακύνθου (κόλπος Λαγανά, Στροφάδες) και περιοχές Natura: έχουν δικούς τους κανόνες, συχνά εποχικούς. Έλεγξε με τον φορέα διαχείρισης.',
    'Οι ζώνες των πάρκων Αλοννήσου και Ζακύνθου, η Γυάρος και άλλες περιοχές όπου απαγορεύεται το ψάρεμα αναψυχής φαίνονται στον χάρτη και δίνουν ειδοποίηση κατά την έξοδο (ProtectedSeas Navigator, ενδεικτικά).',
    'Νέα θαλάσσια πάρκα (Νότιες Κυκλάδες, Ιόνιο): το διάταγμα για τις Νότιες Κυκλάδες υπογράφηκε στις 15/7/2026 και περνά από το ΣτΕ. Δεν ισχύει ακόμα.',
    'Οι περιοχές του ProtectedSeas Navigator (και για την Ελλάδα) φαίνονται στον χάρτη, μαζί με τους περιορισμούς τους.'
  ],[lnk('https://alonissos-park.gr/wp-content/uploads/2016/07/flyer_GR_web-compressed.pdf','Φορέας Πάρκου Αλοννήσου'),' · ',lnk('https://www.naftemporiki.gr/politics/2138124/st-papastayroy-ypograftike-to-pd-gia-to-thalassio-parko-notioy-aigaioy-1-noties-kyklades/','Ναυτεμπορική, 15/7/2026')]));
  L.append(grLocalCard());
  L.append(lawCard('Έκτακτη ανάγκη',['112 (ευρωπαϊκός αριθμός) · 108 Λιμενικό Σώμα · VHF κανάλι 16'],[lnk('https://www.gov.gr/sdg/healthcare/national-emergency-numbers','gov.gr: αριθμοί έκτακτης ανάγκης')]));
}
/* 1.13.3: τοπικές απαγορεύσεις ανά Λιμενική Αρχή (gr-local.js), η πιο κοντινή πρώτη */
let grlLoading=false;
function grLocalCard(){
  const G=window.GR_LOCAL, box=h('div',{class:'card'},h('h3',{text:'Τοπικές απαγορεύσεις Λιμενικών Αρχών'}),
    h('p',{text:'Σε πολλά λιμάνια απαγορεύεται κάθε ψάρεμα, ή επιτρέπεται μόνο από συγκεκριμένα σημεία (π.χ. Καβάλα: μόνο ανάμεσα στην αποβάθρα Νο 1 και Νο 3 μπροστά από το Τελωνείο). Εδώ είναι ό,τι αφορά τον ερασιτέχνη από τις σελίδες του Λιμενικού. Στον χάρτη, με το επίπεδο «Απαγορεύσεις», τα λιμάνια έχουν σήμα ⚓ και οι περιοχές με συντεταγμένες φαίνονται με χρώμα· κατά την έξοδο έρχεται ειδοποίηση.'}));
  if(!G){ if(!grlLoading){ grlLoading=true; const sc=document.createElement('script'); sc.src='../gr-local.js'; sc.onload=()=>{ if(lawC==='gr') renderLaw(); }; document.head.append(sc); }
    box.append(h('p',{class:'muted',text:'Φόρτωση…'})); return box; }
  const p=window.AK&&AK.lastPos&&AK.lastPos(), dk=a=>p?Math.hypot((a.c[0]-p.lat)*111,(a.c[1]-p.lon)*111*Math.cos(p.lat*Math.PI/180)):0;
  const list=G.a.slice().sort((x,y)=>p?dk(x)-dk(y):x.n.localeCompare(y.n,'el'));
  const IC={x:'⛔',ok:'✅',s:'🤿',b:'🏖',o:'ℹ️'};
  list.forEach((a,i)=>box.append(h('details',{class:'sp',style:'margin-top:8px',open:(p&&i===0&&dk(a)<40)?'':null},
    h('summary',{},h('b',{text:a.n}),p?h('span',{class:'muted',text:Math.round(dk(a))+' km'}):null),
    h('div',{style:'padding:0 14px 12px'},h('ul',{class:'law'},a.r.map(r=>h('li',{},IC[r[0]]+' '+r[1]+' ',h('span',{class:'muted',text:'('+(r[2]&&r[2]!=='—'?r[2]+' · ':'')+r[3]+')'})))),
      h('p',{class:'note'},lnk('https://alieia.hcg.gr/prohibitions/local/'+a.k+'.php','Σελίδα Λιμενικού')))) ));
  box.append(h('div',{class:'note',style:'margin-top:10px'},(G.todo&&G.todo.length?'Δεν έχουμε ακόμα περάσει: '+G.todo.join(', ')+'. ':'Όλες οι Λιμενικές Αρχές του χάρτη του Λιμενικού ('+G.a.length+'). ')+'Ο ',lnk(G.idx,'χάρτης τοπικών απαγορεύσεων του Λιμενικού'),' έχει και τους κανόνες για επαγγελματικά εργαλεία.'));
  box.append(h('div',{class:'note',style:'margin-top:6px'},'Πηγή: Λιμενικό Σώμα, alieia.hcg.gr › Τοπικές απαγορεύσεις, ελέγχθηκε '+G.ck.split('-').reverse().join('/')+'. Σύντομη απόδοση· ισχύει η απόφαση της κάθε Λιμενικής Αρχής.'));
  return box;
}
function renderLaw(){
  const L=$('g-law'); L.replaceChildren(); lawSeg(L);
  if(lawC==='gr'){ renderLawGR(L); return; }
  if(lawC!=='cy'){ renderLawW(L,lawC); return; }   /* 1.11.5: άλλες χώρες */
  L.append(h('div',{class:'card'},h('p',{text:'Περίληψη για ερασιτεχνικό ψάρεμα από σκάφος στη Δημοκρατία της Κύπρου, ελεγμένη στις 11/11/2026 με τους Όρους ερασιτεχνικής άδειας αλιείας 2026 του ΤΑΘΕ. Δεν αποτελεί νομική συμβουλή. Οι κανονισμοί αλλάζουν και ισχύει πάντα το κείμενο του νόμου και ό,τι ανακοινώνει το Τμήμα Αλιείας και Θαλασσίων Ερευνών (ΤΑΘΕ). Όπου η πηγή είναι δευτερογενής, το γράφει.'})));
  L.append(lawCard('Πώς βγάζω ή ανανεώνω άδεια',[
    'Από στεριά με καλάμι δεν χρειάζεται άδεια. Άδεια χρειάζεται για ψάρεμα με σκάφος, ψαροντούφεκο, δεξαμενές και ψαροπαγίδες.',
    'Αίτηση ηλεκτρονικά, με δύο τρόπους: με CY Login (τα στοιχεία συμπληρώνονται και δεν χρειάζεται αντίγραφο ταυτότητας) ή με τη φόρμα του ΤΑΘΕ (ανεβάζεις αντίγραφο ταυτότητας).',
    'Τέλος άδειας 35 €.',
    'Η φόρμα δέχεται έως 3 σκάφη. Ο έλεγχος γίνεται σε 2 εργάσιμες και ειδοποιείσαι με SMS και email.',
    'Κάθε άδεια λήγει 31 Δεκεμβρίου του έτους έκδοσης. Αν είχες ενεργή άδεια από το 2022, η φόρμα συμπληρώνει τα στοιχεία σου με ταυτότητα/διαβατήριο και ημερομηνία γέννησης.',
    'Υπενθύμιση λήξης: Ρυθμίσεις, «Άδεια και λίστα».',
    'Επικοινωνία ΤΑΘΕ: 22 807 818, 22 807 829, licenses@dfmr.moa.gov.cy.'
  ],['licence.dfmr.moa.gov.cy, ελέγχθηκε 23/10/2026 · ',lnk('https://licence.dfmr.moa.gov.cy/licence-application','Αίτηση με φόρμα'),' · ',lnk('https://cge.cyprus.gov.cy/cylogin/core/login?signin=324f639347ffadbdd621f920d2c6bf09','Αίτηση με CY Login'),' · ',lnk('https://licence.dfmr.moa.gov.cy/','Σελίδα αδειών')]));
  L.append(lawCard('Όρια ποσότητας (ανά έξοδο και ανά 24ωρο)',[
    'Από σκάφος, ανά σκάφος (όσοι αδειούχοι κι αν είναι πάνω): είτε 10 kg συνολικά, είτε 5 kg και 1 ψάρι οποιουδήποτε βάρους, είτε 3 μακρύπτερους τόνους (Thunnus alalunga) και 5 kg άλλων ειδών.',
    'Ψαροντούφεκο: 5 kg και 1 ψάρι οποιουδήποτε βάρους ανά αλιέα. Αν ψαρεύεις με ψαροντούφεκο από σκάφος, ισχύει το όριο του σκάφους.',
    'Ψαροπαγίδες χωρίς σκάφος: 5 kg και 1 ψάρι οποιουδήποτε βάρους ανά αλιέα.',
    'Ορφός (Epinephelus marginatus) και συναγρίδα (Dentex dentex): το πολύ 1 από το καθένα, ανά αλιέα ή ανά σκάφος.'
  ],[lnk('https://www.gov.cy/moa-dfmr/documents/','ΤΑΘΕ: Όροι ερασιτεχνικής άδειας αλιείας 2026 (v3.0, 30/12/2025)'),' · §11, §20, §24, §28 · Καν. 17Β']));
  L.append(lawCard('Άδεια και εργαλεία',[
    'Ερασιτεχνική αλιεία με σκάφος απαγορεύεται χωρίς άδεια του ΤΑΘΕ. Ψαρεύεις μόνο από σκάφος που δήλωσε ο ιδιοκτήτης του κατά την έκδοση άδειας της χρονιάς. Η άδεια και η ταυτότητα πρέπει να είναι μαζί σου.',
    'Κάθε εργαλείο ή μέθοδος που δεν προβλέπεται απαγορεύεται (εξαίρεση: αγκίστρι και πετονιά από την ακτή).',
    'Στο σκάφος: όχι δίχτυα ή παραγάδια επιφανείας. Έως 2 παραγάδια βυθού με έως 200 αγκίστρια το καθένα, έως 4 ψαροπαγίδες, ηλεκτρικοί μηχανισμοί (καρούλια) έως 800 W. Παραγάδια και παγίδες με σήμανση (αριθμός νηολόγησης).',
    'Παραγάδι βυθού: μόνο από 12:00 Τρίτης, Παρασκευής, Σαββάτου και της παραμονής δημόσιας αργίας, έως 12:00 της επομένης. Ιούλιο και Αύγουστο χωρίς περιορισμό.',
    'Σαγλαντζιά (χταποδιέρα) και χταπόδι στο σκάφος: μόνο με μέρα, Δευτέρα, Τετάρτη, Σάββατο, Κυριακή και αργίες. Ιούλιο και Αύγουστο χωρίς περιορισμό.',
    'Όχι φωτεινές πηγές για ψάρεμα.',
    'Απαγορεύεται κάθε ψάρεμα, όλο το 24ωρο, σε περιοχές λουομένων.',
    'Ψαροπαγίδες χωρίς σκάφος: έως 4 στον βυθό, με σήμανση (αριθμός άδειας), εκτός περιοχών λουομένων, με σημαδούρα όπως στο ψαροντούφεκο.',
    'Ψαροντούφεκο: όχι από τη δύση ως την ανατολή, όχι με αναπνευστική συσκευή, όχι με φως, όχι σε περιοχές λουομένων, όχι κοντά σε αλιευτικά εργαλεία. Σημαδούρα κίτρινη, πορτοκαλί ή κόκκινη με κόκκινο σημαιάκι με λευκή διαγώνια γραμμή, ορατή από 300 m· μένεις έως 50 m από αυτήν ή το σκάφος.',
    'Στο σκάφος απαγορεύεται να έχεις μαζί αναπνευστική συσκευή και ψαροντούφεκο (ή καμάκι ή αλίευμα), και από τη δύση ως την ανατολή ψαροντούφεκο μαζί με αλίευμα.',
    'Cy-FIS υποχρεωτικό για κάθε έξοδο με άδεια (για ψάρεμα από ακτή προαιρετικό): έναρξη και λήξη τη στιγμή που γίνονται, και τα κιλά ανά είδος. Με πολλούς αδειούχους στο ίδιο σκάφος δηλώνει ένας, με τον αριθμό τους.'
  ],[lnk('https://www.gov.cy/moa-dfmr/documents/','ΤΑΘΕ: Όροι ερασιτεχνικής άδειας αλιείας 2026 (v3.0, 30/12/2025)'),' · §1–7, §14–19, §21–27']));
  L.append(lawCard('Χειρισμός αλιεύματος',[
    'Απαγορεύεται η πώληση ή εμπορική εκμετάλλευση ερασιτεχνικού αλιεύματος.',
    'Δεν επιτρέπεται να κρατάς ψάρι χωρίς κομμένο το πάνω τμήμα του ουραίου πτερυγίου.',
    'Στο σκάφος επιτρέπεται μόνο εκσπλάχνιση και απολέπιση. Όχι φιλεταρισμός, αποκεφαλισμός ή άλλος καθαρισμός.',
    'Διαγωνισμοί και τουριστική δραστηριότητα απαιτούν γραπτή άδεια.'
  ],['ΚΔΠ 416/2019, Κανονισμός 17Β']));
  const rows=Object.keys(MIN).map(la=>{const c=CYL[la.toLowerCase()]; return [c?c.n:la,la,MIN[la]];}).sort((a,b)=>a[0].localeCompare(b[0],'el'));
  L.append(h('div',{class:'card'},h('h3',{text:'Ελάχιστα μεγέθη (ολικό μήκος)'}),
    h('div',{class:'bar',style:'grid-template-columns:1fr auto;font-weight:600'},h('span',{text:'Είδος'}),h('span',{text:'cm'})),
    rows.map(r=>h('div',{class:'bar',style:'grid-template-columns:1fr auto'},h('span',{},r[0],' ',h('i',{class:'muted',text:r[1]})),h('span',{class:'n',text:String(r[2])}))),
    h('div',{class:'note',style:'margin-top:8px'},'Πηγή: πίνακας ελάχιστων μεγεθών του Τμήματος Αλιείας και Θαλασσίων Ερευνών (gov.cy), ελεγμένος στις 23/10/2026. Τα όρια ισχύουν και για τα είδη του ίδιου γένους (π.χ. κέφαλοι, σαφρίδια, ορφοί). Δεν περιλαμβάνονται ακόμα όλα τα είδη του πίνακα. Για όσα δεν αναγράφονται, ρώτα το ΤΑΘΕ.')));
  L.append(lawCard('Ειδικά είδη',[
    'Κόκκινος τόνος (Thunnus thynnus), ξιφίας και κάθε καρχαρίας ή σελάχι: απαγορεύονται η αλιεία και η κατοχή. Αν πιαστεί, ελευθέρωση αμέσως, με όσο το δυνατό λιγότερη ταλαιπωρία.',
    'Μακρύπτερος τόνος: κλειστός 1–31 Μαρτίου και 1 Οκτωβρίου–30 Νοεμβρίου (και ως τυχαίο αλίευμα). Απαγορεύεται επίσης σε σκάφη που δηλώθηκαν μετά την προθεσμία του ΤΑΘΕ.',
    'Θαλάσσια θηλαστικά, χελώνες και πουλιά: απαγορεύεται κάθε σύλληψη ή κατοχή. Τραυματισμένη χελώνα κρατιέται μόνο για διάσωση, αφού ενημερώσεις το ΤΑΘΕ.',
    'Ορφός και συναγρίδα: 1 το πολύ από το καθένα, ανά αλιέα ή σκάφος, ανά έξοδο και 24ωρο.',
    'Λαγοκέφαλος (Lagocephalus sceleratus): τοξικός, δεν τρώγεται, δεν δίνεται και δεν πωλείται.'
  ],[lnk('https://www.gov.cy/moa-dfmr/documents/','ΤΑΘΕ: Όροι ερασιτεχνικής άδειας αλιείας 2026 (v3.0, 30/12/2025)'),' · §8–11 · βιβλίο ΤΑΘΕ για τον λαγοκέφαλο']));
  L.append(lawCard('Υδατοφράκτες (φράγματα) 2026',[
    'Χρειάζεται ξεχωριστή άδεια υδατοφρακτών (από 12 ετών· 12–18 με γραπτή συγκατάθεση γονέα· κάτω των 12 μόνο γραμμένοι στην άδεια του γονέα, με απίκο έως 5 m και έως 5 m από τον γονέα, με σωσίβιο).',
    'Ώρες: από 1 ώρα πριν την ανατολή ως 1 ώρα μετά τη δύση. Μόνο από την όχθη, ένα καλάμι με ένα αγκίστρι (το τριπλό μετρά για ένα· στη συρτή με καλάμι για αρπακτικά επιτρέπονται τεχνητά με πολλά αγκίστρια). Όχι φώτα, δίχτυα, βάρκες, τηλεκατευθυνόμενα.',
    'Ανά ημέρα: έως 5 πέστροφες (≥ 20 cm), 2 λουτσιόπερκες, 1 οξύρυγχος (≥ 70 cm), όχι πάνω από 5 συνολικά. Κυπρίνος, λαυράκι, χέλι και κοκκινοφτέρα επιστρέφονται υποχρεωτικά· η τούρνα δεν επιστρέφεται. Απαγορεύεται η πώληση.',
    'Ανοιχτοί: Καφιζής, Λεύκα, Ταμασός, Κλήρου–Ακακίου–Μαλούντα, Γερμασόγεια, Πολεμίδια, Πρόδρομος, Κούρης, Ασπρόκρεμμος, Αγία Μαρίνα, Πώμος, Εύρετου, Αρμίνου, Κανναβιού, Άχνα, Διπόταμος, Αραδίππου, Καλαβασός, Λεύκαρα.',
    'Κλειστοί: Σολέας, Καλοπαναγιώτης, Παλαιχώρι, Ξυλιάτος, Λύμπια, Βυζακιά, Μαυροκόλυμπος, Αργάκα–Μακούντα.',
    'Άχνα: κλειστή 1 Ιανουαρίου–30 Ιουνίου. Άχνα και Πολεμίδια: τα ψάρια επιστρέφονται ζωντανά.',
    'Απαγορευμένα τμήματα κοντά στο φράγμα (Ασπρόκρεμμος, Κανναβιού, Λεύκα, Κλήρου, Άχνα, Ξυλιάτος): στον χάρτη, στρώμα «Απαγόρευση».',
    'Όχι στάθμευση πιο κοντά από 15 m από το νερό, όχι φωτιά, κατασκήνωση ή σκουπίδια. Ποινές έως 8.542 € ή 6 μήνες φυλάκιση.'
  ],[lnk('https://www.gov.cy/moa-dfmr/documents/','ΤΑΘΕ: Όροι άδειας υδατοφρακτών 2026 · Ψάρεμα στους υδατοφράκτες 2026 · Απαγορευμένες περιοχές σε υδατοφράκτες')]));
  const ZONES=window.ZONES||[]; if(!window.ZONES&&!renderLaw.zl){ renderLaw.zl=1; const zs=document.createElement('script'); zs.src='../zones.js'; zs.onload=()=>{ if(lawC==='cy') renderLaw(); }; document.head.append(zs); } /* 1.11.0: χωρίς να έχει ανοίξει πρώτα ο χάρτης */
  L.append(h('div',{class:'card'},h('h3',{text:'Περιοχές απαγόρευσης ('+ZONES.length+')'}),
    h('p',{class:'note',text:'Τα όρια είναι από το αρχείο «Fishing_restricted_areas» (KMZ) του Cy-FIS και φαίνονται κόκκινα στον χάρτη. Οι ημερομηνίες ισχύος του αρχείου δεν είναι γνωστές και τα διατάγματα αλλάζουν. Πριν ψαρέψεις κοντά σε προστατευόμενη περιοχή, έλεγξε το Cy-FIS και τον νόμο που αναγράφεται.'}),
    ZONES.slice().sort((x,y)=>x.n.localeCompare(y.n,'el')).map(z=>h('div',{class:'item',style:'margin-top:8px'},h('div',{},h('b',{text:z.n}),h('div',{class:'meta',text:z.d})),h('div',{class:'acts'},h('button',{class:'btn ghost sm',type:'button',text:'Χάρτης',onclick:()=>showZone(z)})))),
    h('div',{class:'note',style:'margin-top:8px'},lnk('https://apps.apple.com/app/id1510935028','Cy-FIS (iPhone)'),' · ',lnk('https://play.google.com/store/apps/details?id=cyprus.dfmr.fishing','Cy-FIS (Android)'))));
  L.append(lawCard('Άλλοι περιορισμοί',[
    'Περιοχές λουομένων: όχι ψαροπαγίδες ή δίχτυα.',
    'Έξι θαλάσσιες προστατευόμενες περιοχές με τεχνητούς υφάλους: καμία αλιεία (δευτερογενής πηγή, ελέγξτε με τη λίστα πάνω).',
    'Πόλις–Γιαλιά (Ειδική Ζώνη Διατήρησης CY4000001): από 15 Μαΐου έως 30 Σεπτεμβρίου, από 0 έως 10 μέτρα ισοβαθή, απαγορεύεται η διέλευση και η αγκυροβόληση μηχανοκίνητων σκαφών (εξαιρούνται σκάφη επαγγελματικής παράκτιας αλιείας μικρής κλίμακας). Τα ακριβή όρια της ζώνης δεν είναι στο αρχείο και δεν σχεδιάζονται στον χάρτη.',
    'Απαγορεύεται η είσοδος στα θαλάσσια σπήλαια των Θαλασσινών Σπηλιών Πέγειας και Αγίας Νάπας, του Αγίου Γεωργίου Αλαμάνου και του Χάλαβρου, χωρίς γραπτή άδεια του Διευθυντή.',
    'Απαγορεύεται η παρενόχληση και η σίτιση προστατευόμενων ειδών (κητώδη, θαλάσσιες χελώνες κ.ά.) και η απόρριψη απορριμμάτων στη θάλασσα.',
    'Ποινές: παράβαση διατάγματος απαγόρευσης (π.χ. αλιεία σε προστατευόμενη περιοχή) επισύρει φυλάκιση έως 2 έτη ή πρόστιμο έως €20.000, ή και τα δύο.',
    'Ποινές: παράβαση των Κανονισμών (π.χ. όρια ποσότητας, εργαλεία, άδεια) επισύρει φυλάκιση έως 1 έτος ή πρόστιμο έως €20.000, ή και τα δύο.',
    'Μπορεί να υπάρχουν και άλλοι μόνιμοι ή εποχικοί περιορισμοί που δεν είναι στο αρχείο.'
  ],['ΚΔΠ 139/2026, Κανονισμοί 14Α, 14Β και 15 · Ν. 78(Ι)/2024, άρθρα 5Α(6) και 6(3)']));
  L.append(h('div',{class:'card'},h('h3',{text:'Πηγές'}),h('ul',{class:'law'},
    [['https://www.cylaw.org/KDP/data/2019_1_416.pdf','Κ.Δ.Π. 416/2019, Αλιεία (Τροποποιητικοί) Κανονισμοί'],['https://www.cylaw.org/KDP/data/2024_1_256.pdf','Κ.Δ.Π. 256/2024, Αλιεία (Τροποποιητικοί) Κανονισμοί'],['https://www.gov.cy/en/service/issue-of-fishing-licence/','gov.cy: άδεια ερασιτεχνικής αλιείας'],['https://www.gov.cy/moa-dfmr/en/','Τμήμα Αλιείας και Θαλασσίων Ερευνών']].map(x=>h('li',{},lnk(x[0],x[1]))))));
}

/* μαγαζιά */
$('sShops').addEventListener('click',()=>{
  const go=(la,lo,z)=>{ const q='fishing+tackle+store'; window.open('https://www.google.com/maps/search/'+q+(la!=null?'/@'+la.toFixed(5)+','+lo.toFixed(5)+','+z+'z':''),'_blank','noopener'); };
  const fallback=()=>{ const c=window.AK&&AK.lastPos(); if(c) go(c.lat,c.lon,13); else go(null,null,0); };
  if(!navigator.geolocation){ fallback(); return; }
  navigator.geolocation.getCurrentPosition(p=>go(p.coords.latitude,p.coords.longitude,14),fallback,{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
});
renderSpecies(); renderTech(); renderChecks(); renderLaw();
return {renderSpecies:renderSpecies,minOf:minOf,matchSp:matchSp,DB:DB,shownName:shownName,strip:strip};
};
