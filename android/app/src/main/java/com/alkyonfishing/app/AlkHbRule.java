package com.alkyonfishing.app;

/* Alkyon 1.14.95 · πότε η απάντηση του server στον παλμό σταματά την καταγραφή της εξόδου.

   Ο server απαντά 404 «no active trip» σε τρεις διαφορετικές περιπτώσεις:
     α) η έξοδος δεν καταχωρήθηκε ποτέ (ειδοποίηση επαφής κλειστή, χωρίς λογαριασμό, έναρξη χωρίς σήμα, γραμμή χωρίς κλειδί παλμού),
     β) η έξοδος έκλεισε από αλλού,
     γ) στιγμιαίο σφάλμα ανάγνωσης της βάσης στον server.
   Πριν το 1.14.95 κάθε 404 σταματούσε την υπηρεσία, άρα στις (α) και (γ) χανόταν η διαδρομή.

   Κανόνας: σταματά ΜΟΝΟ όταν ο server έχει απαντήσει τουλάχιστον μία φορά 2xx για αυτή την έξοδο (την γνωρίζει)
   ΚΑΙ έρθουν STOP_AFTER συνεχόμενα 404 του δικού μας κώδικα. Ο παλμός δεν σταματά ποτέ εδώ: αν η έξοδος καταχωρηθεί
   αργότερα, ο επόμενος παλμός παίρνει 2xx και η ασφάλεια δουλεύει κανονικά.

   Ο ίδιος κανόνας, με τις ίδιες σταθερές, υπάρχει στο ios/App/App/AlkTripPlugin.swift (AlkHbRule).
   Καθαρή λογική χωρίς Android, ώστε να ελέγχεται με JUnit (AlkHbRuleTest). */
final class AlkHbRule {
    static final int STOP_AFTER = 3;
    static final long MAX_UNACKED_MS = 24L * 3600L * 1000L;
    static final String OURS = "no active trip";

    private AlkHbRule() { }

    /** Κατάσταση μετά από μία απάντηση. */
    static final class Step {
        final boolean acked; final int n404; final boolean stop;
        Step(boolean acked, int n404, boolean stop) { this.acked = acked; this.n404 = n404; this.stop = stop; }
    }

    /** 404 του δικού μας κώδικα (όχι π.χ. 404 από λάθος διεύθυνση ή λάθος ανεβασμένο server). */
    static boolean ours404(int code, String body) { return code == 404 && body != null && body.contains(OURS); }

    /** code ≤ 0 = δεν ήρθε απάντηση (χωρίς σήμα): δεν αλλάζει τίποτα. */
    static Step next(boolean acked, int n404, int code, String body) {
        if (code >= 200 && code < 300) return new Step(true, 0, false);
        if (ours404(code, body)) {
            if (!acked) return new Step(false, 0, false);
            int n = n404 + 1;
            return new Step(true, n, n >= STOP_AFTER);
        }
        return new Step(acked, n404, false);
    }

    /** Δίχτυ για τη μπαταρία: υπηρεσία που ο server δεν αναγνώρισε ποτέ δεν τρέχει πάνω από MAX_UNACKED_MS. */
    static boolean expired(boolean acked, long bornMs, long nowMs) { return !acked && bornMs > 0 && nowMs - bornMs >= MAX_UNACKED_MS; }
}
