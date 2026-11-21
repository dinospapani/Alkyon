package com.alkyonfishing.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/* Alkyon 1.14.95 · ο κανόνας «πότε το 404 του παλμού σταματά την καταγραφή» (AlkHbRule).
   Το σφάλμα που δεν πρέπει να ξαναγυρίσει: έξοδος που ο server δεν γνωρίζει (ειδοποίηση επαφής κλειστή, χωρίς λογαριασμό,
   έναρξη χωρίς σήμα) έπαιρνε 404 στον πρώτο παλμό και η υπηρεσία σταματούσε σε 0,12″ — χωρίς διαδρομή. */
public class AlkHbRuleTest {
    private static final String OURS = "{\"ok\":false,\"error\":\"no active trip\"}";

    private static AlkHbRule.Step run(boolean acked, int... codes) {
        AlkHbRule.Step s = new AlkHbRule.Step(acked, 0, false);
        for (int c : codes) { s = AlkHbRule.next(s.acked, s.n404, c, c == 404 ? OURS : ""); if (s.stop) break; }
        return s;
    }

    @Test public void tripTheServerNeverKnew_keepsRecording_howeverMany404() {
        AlkHbRule.Step s = new AlkHbRule.Step(false, 0, false);
        for (int i = 0; i < 500; i++) { s = AlkHbRule.next(s.acked, s.n404, 404, OURS); assertFalse("404 #" + (i + 1) + " must not stop a trip the server never acknowledged", s.stop); }
        assertFalse(s.acked); assertEquals(0, s.n404);
    }

    @Test public void tripRegisteredLate_isAcknowledgedByTheFirst200() {
        AlkHbRule.Step s = run(false, 404, 404, 404, 404, 200);
        assertTrue(s.acked); assertEquals(0, s.n404); assertFalse(s.stop);
    }

    @Test public void normalTrip_neverStopsOn200() {
        AlkHbRule.Step s = run(false, 200, 200, 200, 200, 200, 200);
        assertTrue(s.acked); assertFalse(s.stop);
    }

    @Test public void closedElsewhere_stopsOnTheThirdConsecutive404_notBefore() {
        assertFalse(run(false, 200, 404).stop);
        assertFalse(run(false, 200, 404, 404).stop);
        assertTrue(run(false, 200, 404, 404, 404).stop);
        assertEquals(AlkHbRule.STOP_AFTER, run(false, 200, 404, 404, 404).n404);
    }

    @Test public void oneOrTwoStray404_areForgivenByThenext200() {
        AlkHbRule.Step s = run(false, 200, 404, 404, 200, 404, 404, 200, 404, 404);
        assertFalse("a momentary server/database error must not end the recording", s.stop);
        assertEquals(2, s.n404);
    }

    @Test public void noAnswerAndServerErrors_changeNothing() {
        for (int code : new int[] { 0, -1, 400, 401, 403, 429, 500, 502, 503 }) {
            AlkHbRule.Step s = AlkHbRule.next(true, 2, code, "");
            assertTrue("code " + code, s.acked); assertEquals("code " + code, 2, s.n404); assertFalse("code " + code, s.stop);
            s = AlkHbRule.next(false, 0, code, "");
            assertFalse("code " + code, s.acked); assertFalse("code " + code, s.stop);
        }
    }

    @Test public void a404ThatIsNotOurs_neverCounts() {
        for (String body : new String[] { null, "", "<html>404 Not Found</html>", "{\"code\":\"NOT_FOUND\",\"message\":\"Requested function was not found\"}" }) {
            assertFalse(AlkHbRule.ours404(404, body));
            AlkHbRule.Step s = AlkHbRule.next(true, 2, 404, body);
            assertFalse("a wrong address or a badly deployed server must not stop every phone", s.stop); assertEquals(2, s.n404);
        }
        assertTrue(AlkHbRule.ours404(404, OURS));
        assertFalse("only a 404 carries this meaning", AlkHbRule.ours404(200, OURS));
    }

    @Test public void stateSurvivesARestartOfTheService() {
        /* το Android μπορεί να ξαναξεκινήσει την υπηρεσία: acked και n404 διαβάζονται από τα prefs και ο κανόνας συνεχίζει από εκεί */
        AlkHbRule.Step s = AlkHbRule.next(true, 2, 404, OURS);
        assertTrue(s.stop);
    }

    @Test public void batteryNet_onlyForATripTheServerNeverKnew_andOnlyAfter24h() {
        long born = 1_000_000L, h = 3600_000L;
        assertFalse(AlkHbRule.expired(false, born, born + 23 * h + 59 * 60_000L));
        assertTrue(AlkHbRule.expired(false, born, born + 24 * h));
        assertFalse("an acknowledged trip is never cut by the clock", AlkHbRule.expired(true, born, born + 1000 * h));
        assertFalse("unknown start time: do not cut", AlkHbRule.expired(false, 0, born + 1000 * h));
        assertEquals(24L * 3600L * 1000L, AlkHbRule.MAX_UNACKED_MS);
    }
}
