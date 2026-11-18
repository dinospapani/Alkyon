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

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

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
    private final Runnable beat = new Runnable() { @Override public void run() { sendHb(true); hd.postDelayed(this, intervalMs); } };

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
        Notification n = note(p.getString("title", "Alkyon"), p.getString("text", ""));
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTE_ID, n);
        } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }   // χωρίς άδεια θέσης: δεν τρέχει (η εφαρμογή συνεχίζει όπως πριν)
        if (lm == null) {
            lm = (LocationManager) getSystemService(LOCATION_SERVICE);
            try { lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000L, 10f, this, Looper.getMainLooper()); }
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
        if (l == null || (l.hasAccuracy() && l.getAccuracy() > 60)) return;
        boolean moved = last == null || last.distanceTo(l) >= 12 || l.getTime() - last.getTime() >= 60000;
        if (moved) { addFix(l); last = l; }
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
            if (a.length() > MAX_FIXES) { JSONArray b = new JSONArray(); for (int i = 0; i < a.length(); i++) if (i % 2 == 0 || i == a.length() - 1) b.put(a.get(i)); a = b; }
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
        try {
            b.put("action", "hb"); b.put("id", tripId); b.put("key", key);
            if (last != null && now - last.getTime() < 15 * 60000) { b.put("lat", last.getLatitude()); b.put("lon", last.getLongitude()); }
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
                int code = c.getResponseCode();
                if (code == 404) hd.post(new Runnable() { @Override public void run() { stopSelf(); } });   // η έξοδος έκλεισε στον server
            } catch (Exception e) { /* χωρίς σήμα: ο επόμενος παλμός θα ξαναδοκιμάσει */ }
            finally { if (c != null) c.disconnect(); }
        } }).start();
    }

    @Override public void onDestroy() {
        running = false; hd.removeCallbacks(beat);
        try { if (lm != null) lm.removeUpdates(this); } catch (Exception e) { }
        lm = null; super.onDestroy();
    }
}
