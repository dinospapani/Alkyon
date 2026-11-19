/* Alkyon · score-config: τα ΒΑΡΗ και τα ΟΡΙΑ του βαθμού ψαρέματος. ΜΟΝΟ δεδομένα, καθόλου λογική.
   Η λογική είναι στο score-core.js. Φορτώνεται πριν από το score-core.js και το forecast.js (σελίδα, service worker, server, ρολόι).

   ΕΚΔΟΣΗ: κάθε αλλαγή αριθμού εδώ αλλάζει τον βαθμό που βλέπει ο χρήστης. Γι' αυτό:
   - αλλάζει ΚΑΙ το «version» (π.χ. '2026.12-1'), ώστε κάθε αποθηκευμένη πρόβλεψη να ξέρει με ποια βάρη βγήκε·
   - η προηγούμενη έκδοση μένει ως αναφορά στα tests (tests/unit/golden) και η διαφορά τεκμηριώνεται (τι, γιατί, bug ή πρόθεση).
   Η έκδοση 2026.11-1 έχει ΑΚΡΙΒΩΣ τους αριθμούς που είχε το forecast.js στην 1.14.83 (έλεγχος ισοτιμίας: tests/unit/score-parity.test.mjs).

   Κανόνες βημάτων: λίστα που διαβάζεται με τη σειρά· ισχύει ο πρώτος κανόνας που ταιριάζει.
   lt: <   le: ≤   gt: >   ge: ≥   (χωρίς συνθήκη = «αλλιώς»)   d: πόσους βαθμούς προσθέτει.
   Μονάδες (ίδιες σε εφαρμογή και server): άνεμος/ριπή kn · κύμα m · πίεση hPa · θερμοκρασία °C · βροχή: πιθανότητα % ΚΑΙ mm/ώρα (δύο πεδία) · συννεφιά %. */
(function(g){
'use strict';
g.AlkyonScoreConfig={
  version:'2026.11-1',
  base:50,
  clamp:[5,98],
  /* «μόνο τσίμπημα» (bite): σαν να ήταν ήρεμη η θάλασσα */
  neutral:{wind:8,wave:0.3},
  /* όταν το κύμα λείπει (π.χ. λίμνη ή χωρίς θαλάσσιο μοντέλο) ο βαθμός υπολογίζεται με αυτή την τιμή· το data contract το σημειώνει ως «default» */
  waveDefault:0.5,
  /* τάση πίεσης 3 ωρών. Οι μελέτες δεν βρίσκουν σταθερή επίδραση (Stoner 2004)· μικρό + στην άνοδο (Guy 1992), μικρότερο στην απότομη πτώση */
  pressure:{slow:3,stable:3,rise:4,fast:1}, pressureDefault:'stable',
  cloud:{clear:0,part:2,over:4}, cloudDefault:'part',
  gust:[{ge:35,d:-10},{ge:28,d:-5},{d:0}],
  storm:{code:95,d:-15},
  rainProb:{from:70,d:-2},
  /* προφίλ ψαρέματος (εκτίμηση, όχι επικυρωμένη). Ό,τι άλλο εκτός από shore/lake/spear = boat */
  profiles:{
    boat:{ wind:[{lt:5,d:2},{le:12,d:4},{le:18,d:-3},{le:25,d:-12},{d:-25}],
           wave:[{le:0.5,d:3},{le:1,d:0},{le:1.5,d:-6},{le:2,d:-15},{d:-25}] },
    /* στεριά: αντέχει λίγο περισσότερο άνεμο, αλλά το δυνατό κύμα στην ακτή είναι επικίνδυνο */
    shore:{ wind:[{lt:5,d:2},{le:14,d:4},{le:20,d:-2},{le:27,d:-12},{d:-25}],
            wave:[{le:0.5,d:3},{le:1,d:1},{le:1.5,d:-5},{le:2,d:-16},{d:-28}] },
    /* λίμνη: δεν μετράει κύμα θάλασσας· θερμοκρασία αέρα ως ένδειξη για το ρηχό νερό· ελαφριά βροχή συχνά βοηθά */
    lake:{ wind:[{lt:5,d:3},{le:12,d:4},{le:18,d:-3},{le:25,d:-12},{d:-25}],
           wave:null,
           temp:[{lt:8,d:-4},{lt:14,d:-1},{le:27,d:3},{le:32,d:0},{d:-4}],
           rainProb:[{ge:40,lt:75,d:1},{d:0}] },
    /* ψαροντούφεκο: χαμηλό κύμα και ήπιος άνεμος μετράνε πολύ */
    spear:{ wind:[{lt:5,d:3},{le:10,d:4},{le:15,d:-6},{le:22,d:-16},{d:-28}],
            wave:[{le:0.3,d:4},{le:0.6,d:0},{le:1,d:-10},{le:1.5,d:-22},{d:-35}] }
  },
  /* φως: λυκαυγές/λυκόφως έως «window» λεπτά από ανατολή ή δύση (γραμμικά έως «max»)· μεσημέρι 11:00–15:00 */
  light:{ twilight:{window:75,max:14}, midday:{from:660,to:900,d:-4} },
  /* περίοδοι Knight από ακριβείς ώρες σελήνης: κύρια ±45′ +6 (μισό έως ±75′), δευτερεύουσα ±30′ +3 */
  solunar:{ major:{window:45,d:6,extra:30,dExtra:3}, minor:{window:30,d:3} },
  /* είδος-στόχος: θερμοκρασία θάλασσας ως προς το εύρος του είδους (knowledge.js)· ειδικοί κανόνες μόνο όπου υπάρχει μελέτη */
  species:{
    sst:{perDeg:2.5,max:10},
    order:['squid','sword'],
    kinds:{
      /* καλαμάρι (Cabanellas-Reboredo κ.ά. 2012): νέα σελήνη, λίγος άνεμος, χαμηλή πίεση, πιο κρύα θάλασσα, στενό παράθυρο στη δύση */
      squid:{ match:'loligo|καλαμάρ|squid', moonAmp:5, coldBonus:3, biteKeepsWind:true,
              wind:[{lt:8,d:3},{gt:14,d:-4},{d:0}], pres:[{lt:1012,d:3},{gt:1018,d:-2},{d:0}],
              dusk:{within:60,max:8,span:90} },
      /* ξιφίας (Ceyhan κ.ά. 2018, Αν. Μεσόγειος): καμία επίδραση σελήνης → χωρίς περιόδους solunar */
      sword:{ match:'xiphias|ξιφ|swordfish', noSolunar:true }
    }
  },
  /* «ο δείκτης μαθαίνει» (κοινά ευρήματα bite_stats): μόνο ισχυρά ευρήματα, συρρίκνωση n/(n+shrink), όριο πολλαπλασιαστή */
  learn:{shrink:60,min:0.85,max:1.15,minN:15},
  /* παράθυρο ημέρας: η μεγαλύτερη συνεχόμενη σειρά ωρών έως «within» βαθμούς κάτω από την καλύτερη· ώρες φωτός = ανατολή−pad έως δύση+pad (λεπτά) */
  window:{within:6,daylightPad:60},
  /* ΕΓΚΥΡΗ ΕΞΟΔΟΣ ΨΑΡΕΜΑΤΟΣ για την αξιολόγηση του βαθμού (ο κανόνας είναι στο score-core.js: session). Διάρκεια από minMin λεπτά έως maxHours ώρες. */
  session:{minMin:20,maxHours:16},
  /* 1.14.87 (P1.3a): πόσα πραγματικά δεδομένα χρειάζονται για να αξιολογηθεί ο βαθμός (και να ανοίξει το πλήρες P1.3). Ίδια όρια με το εργαλείο αξιολόγησης του P1.2.
     Μόνο πληροφορία: ο μετρητής ετοιμότητας τα δείχνει, ΔΕΝ ενεργοποιεί ούτε αλλάζει τίποτα στον βαθμό ή στη μάθηση. */
  evalGate:{minTrips:150,minUsers:10,minPos:30,minDelta:0.03},
  /* προεπιλεγμένα όρια «ασφαλούς» ώρας (ο χρήστης τα αλλάζει: alkyon-limits) */
  limits:{wind:14,wave:0.9,gust:24},
  /* κλάσεις συνθηκών (για τη μάθηση): όρια «μικρότερο από» με τη σειρά· κλάση = πόσα όρια ξεπερνά η τιμή */
  bins:{
    sun:{nightPad:60,edge:90,midHalf:120},
    presLevel:[1010,1015,1020], wind:[5,10,15], wave:[0.3,0.6,1],
    rainMm:0.2, afterSet:[60,180,360], preDawn:90, moonPhases:8,
    dark:{dayPad:90,cloudDefault:{clear:10,over:85,other:45},cloudDim:0.8,cuts:[0.05,0.25]},
    thermocline:[20,50], chl:[0.04,0.07,0.12], sst:[16,19,22,25]
  },
  /* επίπεδα για τις οθόνες και τις ειδοποιήσεις. ΔΕΝ χρησιμοποιούνται ακόμα από τον κώδικα (P1.2): καταγράφονται εδώ οι τιμές που είναι σήμερα διάσπαρτες */
  levels:{good:70,fair:50,dayExcellent:80,dayGood:70,alert:75,alertEve:-5,alertWorse:-8,nextGood:60},
  /* βεβαιότητα (Low / Medium / High): από την ποιότητα των δεδομένων, ΟΧΙ από τον βαθμό.
     Επίπεδο = το χαμηλότερο από «πληρότητα» και «ορίζοντας», μείον τις προσαρμογές.
     Οι προσαρμογές «τοπικότητα» και «τεκμήρια» έχουν βάρος 0 μέχρι να δείξει η αξιολόγηση (P1.2) ότι αξίζουν· καταγράφονται όμως στο αποτέλεσμα. */
  confidence:{
    levels:['low','medium','high'],
    /* πληρότητα: ποια δεδομένα είναι απαραίτητα (χωρίς αυτά: low) και ποια σημαντικά (λείπει ένα: έως medium· λείπουν ≥ 2: low) */
    required:['wind'], important:['wave','sst'],
    /* το κύμα δεν μετρά στη λίμνη */
    notNeeded:{lake:['wave','sst']},
    /* ορίζοντας σε ημέρες από σήμερα: έως highTo → high, έως mediumTo → medium, μετά low */
    horizon:{highTo:2,mediumTo:5},
    adjust:{modelDisagree:-1,noLocal:0,evidenceStrong:0}
  },
  /* data contract: μονάδα κάθε μεταβλητής. Ίδιο σε εφαρμογή και server. */
  units:{ wind:'kn',gust:'kn',windDir:'deg',wave:'m',wavePeriod:'s',current:'kn',currentDir:'deg',pressure:'hPa',pressureTrend:'class',
          sst:'°C',airTemp:'°C',rainProb:'%',rainMm:'mm/h',cloud:'%',moonPhase:'0-1',moonIllum:'0-1',moonAlt:'deg',
          tide:'class',seaLevel:'m',depth:'m',slope:'%',clarity:'m',chl:'mg/m3',thermocline:'m',frontChl:'log10/km',frontSst:'°C/km',
          minute:'min',month:'1-12',weatherCode:'wmo' },
  quality:['meas','model','est','default','missing']
};
/* τα βάρη δεν αλλάζουν την ώρα που τρέχει η εφαρμογή: κάθε αλλαγή γίνεται εδώ, με νέα έκδοση */
(function fr(o){ if(o&&typeof o==='object'&&!Object.isFrozen(o)){ Object.freeze(o); for(var k in o) fr(o[k]); } })(g.AlkyonScoreConfig);
})(typeof self!=='undefined'?self:this);
