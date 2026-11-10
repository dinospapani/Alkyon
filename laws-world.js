/* Alkyon 1.11.5: νόμοι για ερασιτεχνικό ψάρεμα στη θάλασσα, χώρα με χώρα (Οδηγός › Νόμοι).
   Προστίθενται σιγά σιγά, μόνο από επίσημες πηγές, με ημερομηνία ελέγχου. Κύπρος και Ελλάδα είναι στο guide-core.js.
   Μορφή: κωδικός ISO → {ck: ημερομηνία ελέγχου, eu: κράτος μέλος ΕΕ, part: μόνο λίγα ελεγμένα στοιχεία,
     cards:[{t:[el,en], i:[[el,en],...], src:[[url, όνομα]]}], sos:[el,en], off:[[url, όνομα]] (επίσημες σελίδες)}.
   Ό,τι δεν βρέθηκε σε επίσημη πηγή ΔΕΝ γράφεται: η εφαρμογή λέει «έλεγξε», δεν μαντεύει. */
window.ALKYON_LAWS = {
  hr: {
    ck: '2026-11-10', eu: true,
    off: [['https://www.gov.hr/en/marine-recreational-and-sport-fisheries/1542', 'gov.hr: Marine recreational and sport fisheries']],
    cards: [
      { t: ['Άδεια', 'Licence'], i: [
        ['Χρειάζεται άδεια για ψάρεμα αναψυχής ή αθλητικό στη θάλασσα, είτε από την ακτή είτε από σκάφος.', 'A licence is needed for recreational or sport sea fishing, from the shore or from a boat.'],
        ['Εξαίρεση: κάτω των 14 ετών, με μία πετονιά χειρός ή χωρίς καλάμι.', 'Exception: under 14, with one handline or without a rod.'],
        ['Άδειες: ετήσια (ημερολογιακό έτος, αγορά μόνο 1 Δεκεμβρίου – 1 Μαρτίου), ημερήσια, πολυήμερη. Από το Υπουργείο Γεωργίας, εξουσιοδοτημένους πωλητές ή online.', 'Licences: annual (calendar year, sold only 1 December – 1 March), one-day, multi-day. From the Ministry of Agriculture, authorised sellers or online.']],
        src: [['https://www.gov.hr/en/marine-recreational-and-sport-fisheries/1542', 'gov.hr']] },
      { t: ['Εργαλεία', 'Gear'], i: [
        ['Έως δύο από κάθε εργαλείο: πετονιά χειρός, συρτή, καλαμαριέρα. Από σκάφος καλάμι έως 30 lb.', 'Up to two of each: handline, trolling line, squid jig. From a boat, rod and reel up to 30 lb.'],
        ['Ψαροντούφεκο (έως δύο): μόνο με αθλητική άδεια.', 'Speargun (up to two): sport licence only.'],
        ['Με ειδική άδεια: καμάκι, έως 3 κιούρτοι, παραγάδι έως 100 αγκίστρια συνολικά, φώτα.', 'With a special licence: harpoon, up to 3 pots, longline up to 100 hooks in total, lights.']],
        src: [['https://www.gov.hr/en/marine-recreational-and-sport-fisheries/1542', 'Pravilnik o športskom i rekreacijskom ribolovu na moru']] },
      { t: ['Προστατευόμενες περιοχές', 'Protected areas'], i: [
        ['Σε εθνικά πάρκα, ειδικά καταφύγια και πάρκα φύσης ισχύουν ειδικές άδειες ή περιορισμοί από τον φορέα της περιοχής.', 'In national parks, special reserves and nature parks, special licences or restrictions from the managing body apply.']] }
    ],
    sos: ['112 · 195 Κέντρο έρευνας και διάσωσης (MRCC Rijeka) · VHF 16', '112 · 195 Search and rescue (MRCC Rijeka) · VHF 16']
  },
  si: {
    ck: '2026-11-10', eu: true,
    off: [['https://spot.gov.si/en/activities-and-professions/activities/recreational-marine-fishing', 'SPOT (gov.si): Recreational marine fishing'], ['https://www.zsrm-slo.org/', 'Ομοσπονδία θαλάσσιου αθλητικού ψαρέματος (άδειες)']],
    cards: [
      { t: ['Άδεια', 'Licence'], i: [
        ['Από σκάφος: ημερήσια ή εβδομαδιαία άδεια, προσωπική. Online τουλάχιστον μία ώρα πριν ψαρέψεις.', 'From a boat: daily or weekly permit, personal. Online at least one hour before fishing.'],
        ['Από την ακτή δεν χρειάζεται άδεια.', 'No permit needed from the shore.']] },
      { t: ['Όριο ποσότητας', 'Catch limit'], i: [
        ['Έως 5 kg την ημέρα, ή ένα ψάρι πάνω από 5 kg, ή δύο ψάρια με σύνολο πάνω από 5 kg.', 'Up to 5 kg per day, or one fish over 5 kg, or two fish totalling over 5 kg.']] },
      { t: ['Εργαλεία και απαγορεύσεις', 'Gear and prohibitions'], i: [
        ['Έως δύο πετονιές με έως τρία αγκίστρια συνολικά. Για κεφαλόποδα έως τρία.', 'Up to two lines with up to three hooks in total. For cephalopods up to three.'],
        ['Απαγορεύονται: πώληση, ανώριμα ψάρια, συλλογή μαλακίων, τριπλό αγκίστρι για τράβηγμα, συσκευή υποβρύχιας αναπνοής, ζωντανά σπονδυλωτά για δόλωμα.', 'Prohibited: selling, immature fish, harvesting molluscs, snagging with a treble hook, underwater breathing devices, live vertebrates as bait.'],
        ['Όχι σε λιμάνια, όχι σε παραλίες κολύμβησης 1 Μαΐου – 30 Οκτωβρίου, 200 m από ιχθυοκαλλιέργειες, 50 m από δίχτυα ή άλλο σκάφος που ψαρεύει, 300 m από αλιευτικό με φώτα ή γρι-γρι.', 'Not in ports, not at bathing beaches 1 May – 30 October, 200 m from fish farms, 50 m from nets or another boat fishing, 300 m from a fishing vessel with lights or a purse seine.']],
        src: [['https://spot.gov.si/en/activities-and-professions/activities/recreational-marine-fishing', 'SPOT · ZMR-2 · Pravilnik o rekreacijskem morskem ribolovu']] }
    ],
    sos: ['112 · VHF 16', '112 · VHF 16']
  },
  es: {
    ck: '2026-11-10', eu: true,
    off: [['https://www.mapa.gob.es/en/pesca/temas/pesca-maritima-de-recreo/preguntas-frecuentes', 'MAPA: Pesca marítima de recreo'], ['https://www.boe.es/eli/es/rd/2011/03/11/347', 'Real Decreto 347/2011']],
    cards: [
      { t: ['Άδεια', 'Licence'], i: [
        ['Για ψάρεμα από την ακτή, από σκάφος ή με ψαροντούφεκο χρειάζεται άδεια (licencia) από την αυτόνομη κοινότητα της ακτής. Για σκάφος, της κοινότητας του λιμανιού βάσης.', 'Shore, boat and spearfishing all need a licence from the coastal autonomous community. For a boat, from the community of its home port.'],
        ['Όρια ποσότητας, μεγέθη και εργαλεία τα ορίζει κυρίως η κάθε κοινότητα (π.χ. Βαλεαρίδες, Καταλονία, Βαλένθια, Ανδαλουσία). Έλεγξε τους κανόνες της περιοχής σου.', 'Catch limits, sizes and gear are set mainly by each community (e.g. Balearics, Catalonia, Valencia, Andalusia). Check your region’s rules.']] },
      { t: ['Τόνοι και ξιφίας', 'Tuna and swordfish'], i: [
        ['Είδη του Παραρτήματος II (π.χ. τόνοι): χρειάζεται επιπλέον άδεια του κράτους για το σκάφος, πάνω στο σκάφος.', 'Annex II species (e.g. tunas): an extra state authorisation for the boat, kept on board.'],
        ['Μακρύπτερος τόνος, Μεσόγειος: έως 3 ανά σκάφος την ημέρα.', 'Albacore, Mediterranean: up to 3 per boat per day.'],
        ['Ερυθρός τόνος: απαγορεύεται να τον κρατήσεις. 15 Οκτ – 15 Ιουν πίσω στη θάλασσα· 16 Ιουν – 14 Οκτ μόνο πιάσε-άφησε.', 'Bluefin tuna: may not be kept. 15 Oct – 15 Jun back to the sea; 16 Jun – 14 Oct catch and release only.'],
        ['Ξιφίας: απαγορεύεται το ψάρεμα, η κράτηση και η πώληση.', 'Swordfish: catching, keeping and selling are prohibited.']],
        src: [['https://www.mapa.gob.es/en/pesca/temas/pesca-maritima-de-recreo/preguntas-frecuentes', 'MAPA, συχνές ερωτήσεις']] }
    ],
    sos: ['112 · Salvamento Marítimo 900 202 202 · VHF 16', '112 · Salvamento Marítimo 900 202 202 · VHF 16']
  },
  it: {
    ck: '2026-11-10', eu: true, part: true,
    off: [['https://www.guardiacostiera.gov.it/', 'Guardia Costiera'], ['https://www.masaf.gov.it/', 'MASAF (Υπουργείο Γεωργίας, Αλιείας)']],
    cards: [],
    sos: ['112 · 1530 Guardia Costiera · VHF 16', '112 · 1530 Coast Guard · VHF 16']
  },
  fr: {
    ck: '2026-11-10', eu: true, part: true,
    off: [['https://www.mer.gouv.fr/', 'Ministère de la Mer'], ['https://www.legifrance.gouv.fr/', 'Légifrance']],
    cards: [],
    sos: ['112 · 196 CROSS (διάσωση στη θάλασσα) · VHF 16', '112 · 196 CROSS (sea rescue) · VHF 16']
  },
  mt: {
    ck: '2026-11-10', eu: true, part: true,
    off: [['https://dfa.gov.mt/', 'Department of Fisheries and Aquaculture']],
    cards: [],
    sos: ['112 · VHF 16', '112 · VHF 16']
  }
};
/* κοινά για όλα τα κράτη μέλη της ΕΕ στη Μεσόγειο */
window.ALKYON_LAWS_EU = { t: ['Κανόνες της ΕΕ (ισχύουν και εδώ)', 'EU rules (also apply here)'], i: [
  ['Ψαροντούφεκο: απαγορεύεται με συσκευή υποβρύχιας αναπνοής και τη νύχτα (Καν. ΕΕ 2019/1241).', 'Spearfishing: prohibited with underwater breathing apparatus and at night (Reg. (EU) 2019/1241).'],
  ['Ερασιτέχνες: απαγορεύονται συρόμενα δίχτυα, γρι-γρι, δράγες, απλάδια, μανωμένα· η πώληση του αλιεύματος απαγορεύεται (Καν. ΕΚ 1967/2006, άρθρο 17).', 'Recreational fishers: no towed nets, purse seines, dredges, gillnets or trammel nets; selling the catch is prohibited (Reg. (EC) 1967/2006, Art. 17).'],
  ['Ελάχιστα μεγέθη για τη Μεσόγειο: Καν. ΕΚ 1967/2006, Παράρτημα III (τα βλέπεις και στα είδη του Οδηγού). Η χώρα μπορεί να έχει μεγαλύτερα.', 'Mediterranean minimum sizes: Reg. (EC) 1967/2006, Annex III (also shown on the Guide species). The country may set larger ones.'],
  ['Ο νέος κανονισμός ελέγχου της ΕΕ (2023/2842) προβλέπει καταγραφή ορισμένων ερασιτεχνικών αλιευμάτων. Έλεγξε πώς και από πότε ισχύει στη χώρα.', 'The new EU control regulation (2023/2842) provides for recording some recreational catches. Check how and when it applies in the country.']],
  src: [['https://eur-lex.europa.eu/eli/reg/2019/1241/oj', 'EUR-Lex 2019/1241'], ['https://eur-lex.europa.eu/eli/reg/2006/1967/oj', 'EUR-Lex 1967/2006']] };
