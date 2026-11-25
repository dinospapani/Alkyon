package com.alkyonfishing.app;

/* Alkyon 1.14.83 (P0.7) · GPS εξόδου με σβηστή οθόνη.
   Foreground service τύπου «location» (Android 14+: FOREGROUND_SERVICE_LOCATION), με μόνιμη ειδοποίηση όσο τρέχει η έξοδος.
   Ξεκινά ΜΟΝΟ από την εφαρμογή, όταν ο χρήστης ξεκινά έξοδο (η εφαρμογή είναι ανοιχτή), και σταματά στο «Τέλος εξόδου».
   Δεν χρειάζεται άδεια θέσης στο παρασκήνιο (ACCESS_BACKGROUND_LOCATION): η υπηρεσία ξεκινά με την εφαρμογή στο προσκήνιο.
   - Κρατά τα σημεία της διαδρομής (έως 4000) για να τα πάρει η εφαρμογή όταν ξανανοίξει (AlkTripPlugin.fixes).
   - Στέλνει παλμό (θέση, μπαταρία) στον server κάθε «interval» δευτερόλεπτα, και όταν το σκάφος δεν κινείται,
     με το κλειδί της εξόδου (hb_key) — όχι με token χρήστη. Ο server τον χρησιμοποιεί για τον έλεγχο σιωπής/επιστροφής και το SOS. */

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class AlkTripService extends Service implements LocationListener {
    static final String PREFS = "alk_trip", CH = "alkyon_trip";
    static final int NOTE_ID = 4207, MAX_FIXES = 4000;
    static volatile boolean running = false;

    private LocationManager lm;
    private final Handler hd = new Handler(Looper.getMainLooper());
    private String tripId = "", key = "", url = "", apikey = "";
    private long intervalMs = 180000, lastHb = 0;
    private Location last = null;
    /* 1.14.95: το 404 του παλμού σταματά την υπηρεσία μόνο με τον κανόνα του AlkHbRule (ο server γνωρίζει την έξοδο ΚΑΙ 3 συνεχόμενα δικά μας 404).
       acked / n404 / born κρατιούνται ανά έξοδο στα prefs, γιατί το Android μπορεί να ξαναξεκινήσει την υπηρεσία (START_REDELIVER_INTENT). */
    private boolean acked = false;
    private int n404 = 0;
    private long born = 0, dHb4 = 0;
    /* 1.14.88: διάγνωση διαδρομής. raw = θέσεις που έδωσε το GPS · acc = απορρίφθηκαν (ακρίβεια > 60 m) · near = πολύ κοντά στο προηγούμενο ·
       kept = γράφτηκαν · gaps60 / gapMax = κενά πάνω από 60″ ανάμεσα σε δύο θέσεις του GPS (το GPS ζητείται κάθε 5″, άρα κενό = το κινητό δεν έδινε θέση) */
    private long dRaw = 0, dAcc = 0, dNear = 0, dKept = 0, dGaps = 0, dGapMax = 0, dHalf = 0, dT0 = 0, dT1 = 0;
    private void loadDiag(SharedPreferences p) {
        try { JSONObject d = new JSONObject(p.getString("diag:" + tripId, "{}"));
            dRaw = d.optLong("raw"); dAcc = d.optLong("acc"); dNear = d.optLong("near"); dKept = d.optLong("kept"); dGaps = d.optLong("gaps60");
            dGapMax = d.optLong("gapMax"); dHalf = d.optLong("half"); dT0 = d.optLong("t0"); dT1 = d.optLong("t1"); dHb4 = d.optLong("hb4");
        } catch (Exception e) { }
        if (dT0 == 0) dT0 = System.currentTimeMillis();
    }
    private void saveDiag() {
        try { JSONObject d = new JSONObject();
            d.put("raw", dRaw); d.put("acc", dAcc); d.put("near", dNear); d.put("kept", dKept); d.put("gaps60", dGaps); d.put("gapMax", dGapMax);
            d.put("half", dHalf); d.put("t0", dT0); d.put("t1", dT1); d.put("every", 5);
            d.put("ack", acked ? 1 : 0); d.put("hb4", dHb4);   // 1.14.95: ο server γνωρίζει την έξοδο; · πόσα 404 «no active trip» ήρθαν
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("diag:" + tripId, d.toString()).apply();
        } catch (Exception e) { }
    }
    private final Runnable beat = new Runnable() { @Override public void run() {
        /* 1.14.95: υπηρεσία που ο server δεν αναγνώρισε ποτέ δεν τρέχει πάνω από 24 ώρες (δίχτυ για τη μπαταρία) */
        if (AlkHbRule.expired(acked, born, System.currentTimeMillis())) { stopSelf(); return; }
        sendHb(true); hd.postDelayed(this, intervalMs);
    } };

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences p = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (intent != null && intent.hasExtra("id")) {
            p.edit().putString("id", intent.getStringExtra("id")).putString("key", intent.getStringExtra("key"))
                .putString("url", intent.getStringExtra("url")).putString("apikey", intent.getStringExtra("apikey"))
                .putLong("interval", intent.getLongExtra("interval", 180000)).putString("title", intent.getStringExtra("title"))
                .putString("text", intent.getStringExtra("text")).apply();
        }
        tripId = p.getString("id", ""); key = p.getString("key", ""); url = p.getString("url", ""); apikey = p.getString("apikey", "");
        intervalMs = Math.max(60000, Math.min(900000, p.getLong("interval", 180000)));
        if (tripId.isEmpty()) { stopSelf(); return START_NOT_STICKY; }
        acked = p.getBoolean("ack:" + tripId, false); n404 = p.getInt("n404:" + tripId, 0); born = p.getLong("born:" + tripId, 0);
        if (born == 0) { born = System.currentTimeMillis(); p.edit().putLong("born:" + tripId, born).apply(); }
        Notification n = note(p.getString("title", "Alkyon"), p.getString("text", ""));
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTE_ID, n);
        } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }   // χωρίς άδεια θέσης: δεν τρέχει (η εφαρμογή συνεχίζει όπως πριν)
        if (lm == null) {
            lm = (LocationManager) getSystemService(LOCATION_SERVICE);
            loadDiag(p);
            /* 1.14.88: ελάχιστη απόσταση 0 (ήταν 10 m): το GPS δίνει θέση κάθε 5″ και όταν είσαι ακίνητος, ώστε η διάγνωση να ξεχωρίζει «δεν κινήθηκα» από «το κινητό δεν έδινε θέση».
               Το ποια σημεία γράφονται στη διαδρομή δεν αλλάζει (12 m ή 60″). */
            try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000L, 0f, this, Looper.getMainLooper()); }
            catch (SecurityException | IllegalArgumentException e) { stopSelf(); return START_NOT_STICKY; }
        }
        running = true;
        hd.removeCallbacks(beat); hd.postDelayed(beat, intervalMs);
        return START_REDELIVER_INTENT;
    }

    private Notification note(String title, String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null) {
            NotificationChannel c = new NotificationChannel(CH, "Alkyon · έξοδος / trip", NotificationManager.IMPORTANCE_LOW);
            c.setShowBadge(false); nm.createNotificationChannel(c);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = open == null ? null : PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH).setSmallIcon(R.drawable.ic_stat_alkyon)
            .setContentTitle(title == null || title.isEmpty() ? "Alkyon" : title).setContentText(text == null ? "" : text)
            .setOngoing(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_NAVIGATION).setPriority(NotificationCompat.PRIORITY_LOW);
        if (pi != null) b.setContentIntent(pi);
        return b.build();
    }

    @Override public void onLocationChanged(Location l) {
        if (l == null) return;
        long now = System.currentTimeMillis();
        if (dT1 > 0 && now - dT1 > 60000) { dGaps++; dGapMax = Math.max(dGapMax, (now - dT1) / 1000); }
        dRaw++; dT1 = now;
        if (l.hasAccuracy() && l.getAccuracy() > 60) { dAcc++; if (dRaw % 6 == 0) saveDiag(); return; }
        boolean moved = last == null || last.distanceTo(l) >= 12 || l.getTime() - last.getTime() >= 60000;
        if (moved) { addFix(l); last = l; dKept++; } else dNear++;
        if (moved || dRaw % 6 == 0) saveDiag();
        if (System.currentTimeMillis() - lastHb >= intervalMs) sendHb(false);
    }
    @Override public void onStatusChanged(String p, int s, Bundle b) { }
    @Override public void onProviderEnabled(String p) { }
    @Override public void onProviderDisabled(String p) { }

    private void addFix(Location l) {
        try {
            SharedPreferences p = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray a = new JSONArray(p.getString("fixes:" + tripId, "[]"));
            JSONArray f = new JSONArray(); f.put(l.getLatitude()); f.put(l.getLongitude()); f.put(l.getTime()); f.put(l.hasAccuracy() ? Math.round(l.getAccuracy()) : -1);
            a.put(f);
            if (a.length() > MAX_FIXES) { dHalf++; JSONArray b = new JSONArray(); for (int i = 0; i < a.length(); i++) if (i % 2 == 0 || i == a.length() - 1) b.put(a.get(i)); a = b; }
            p.edit().putString("fixes:" + tripId, a.toString()).apply();
        } catch (Exception e) { /* η διαδρομή είναι βοηθητική· ο παλμός συνεχίζει */ }
    }

    private int battery() {
        try { BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE); int v = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY); return v >= 0 && v <= 100 ? v : -1; }
        catch (Exception e) { return -1; }
    }

    private void sendHb(boolean timer) {
        if (url.isEmpty() || key.isEmpty()) return;
        long now = System.currentTimeMillis();
        if (timer && now - lastHb < intervalMs - 5000) return;
        lastHb = now;
        final JSONObject b = new JSONObject();
        final String sent = tripId;
        try {
            b.put("action", "hb"); b.put("id", tripId); b.put("key", key);
            if (last != null && now - last.getTime() < 15 * 60000) { b.put("lat", last.getLatitude()); b.put("lon", last.getLongitude());
                /* 1.14.98: πόσα δευτερόλεπτα πριν πάρθηκε η θέση (μονότονο ρολόι, ανεξάρτητο από την ώρα της συσκευής)· ο server γράφει
                   ως ώρα θέσης την ώρα λήψης, όχι την ώρα του παλμού. Χωρίς σήμα (κτίριο, καμπίνα) η παλιά θέση δεν φαίνεται πια φρέσκια. */
                long ageMs = (SystemClock.elapsedRealtimeNanos() - last.getElapsedRealtimeNanos()) / 1000000L;
                if (ageMs >= 0) b.put("age", Math.round(ageMs / 1000.0)); }
            int bat = battery(); if (bat >= 0) b.put("battery", bat);
        } catch (Exception e) { return; }
        new Thread(new Runnable() { @Override public void run() {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15000); c.setReadTimeout(15000); c.setRequestMethod("POST"); c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("apikey", apikey); c.setRequestProperty("Authorization", "Bearer " + apikey);
                byte[] out = b.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = c.getOutputStream()) { os.write(out); }
                final int code = c.getResponseCode();
                final String body = code == 404 ? readSmall(c.getErrorStream()) : "";
                hd.post(new Runnable() { @Override public void run() { onHb(sent, code, body); } });
            } catch (Exception e) { /* χωρίς σήμα: ο επόμενος παλμός θα ξαναδοκιμάσει */ }
            finally { if (c != null) c.disconnect(); }
        } }).start();
    }

    /* 1.14.95: η απάντηση του server στον παλμό. Πριν, κάθε 404 σταματούσε την υπηρεσία· τώρα αποφασίζει ο AlkHbRule. */
    private void onHb(String sent, int code, String body) {
        if (!sent.equals(tripId)) return;   // απάντηση για προηγούμενη έξοδο
        AlkHbRule.Step s = AlkHbRule.next(acked, n404, code, body);
        boolean ours = AlkHbRule.ours404(code, body);
        if (ours) dHb4++;
        if (s.acked != acked || s.n404 != n404) {
            acked = s.acked; n404 = s.n404;
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("ack:" + tripId, acked).putInt("n404:" + tripId, n404).apply();
        }
        if (ours || s.stop) saveDiag();
        if (s.stop) stopSelf();   // η έξοδος έκλεισε στον server
    }

    private static String readSmall(InputStream in) {
        if (in == null) return "";
        try { byte[] buf = new byte[512]; int n = 0, r; while (n < buf.length && (r = in.read(buf, n, buf.length - n)) > 0) n += r; return new String(buf, 0, n, StandardCharsets.UTF_8); }
        catch (Exception e) { return ""; }
        finally { try { in.close(); } catch (Exception e) { } }
    }

    @Override public void onDestroy() {
        running = false; hd.removeCallbacks(beat); saveDiag();
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception e) { }
        lm = null; super.onDestroy();
    }
}
