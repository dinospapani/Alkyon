// Alkyon για Wear OS: GPS με σβηστή οθόνη, ειδοποιήσεις, παρασκήνιο (καμπές πίεσης, βαρόμετρο, καλύτερη ώρα),
// κωδικός από το κινητό, εφαρμογή.
package com.alkyonfishing.app.wear

import android.Manifest
import android.annotation.SuppressLint
import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.wear.ongoing.OngoingActivity
import androidx.wear.ongoing.Status
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.alkyonfishing.app.wear.ui.MainActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.math.abs

class AlkApp : Application() {
    override fun onCreate() {
        super.onCreate()
        P.init(this)
        Notify.channels(this)
        Engine.init(this)
        AlertWorker.schedule(this)
        Link.pull(this)
    }
}

/* ---------- ειδοποιήσεις ---------- */
object Notify {
    const val CH = "alkyon"
    const val CH_TRIP = "alkyon_trip"
    const val CH_ALARM = "alkyon_alarm"
    fun channels(c: Context) {
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH, L.t("ChMain"), NotificationManager.IMPORTANCE_HIGH).apply { enableVibration(true) })
        nm.createNotificationChannel(NotificationChannel(CH_TRIP, L.t("ChTrip"), NotificationManager.IMPORTANCE_LOW))
        nm.createNotificationChannel(NotificationChannel(CH_ALARM, L.t("AnchorU"), NotificationManager.IMPORTANCE_HIGH).apply { enableVibration(true); vibrationPattern = longArrayOf(0, 700, 300, 700, 300, 700) })
    }
    private fun open(c: Context): PendingIntent = PendingIntent.getActivity(c, 0, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
    fun allowed(c: Context) = c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    @SuppressLint("MissingPermission")
    fun show(c: Context, id: Int, text: String) {
        if (!allowed(c)) return
        val n = NotificationCompat.Builder(c, CH).setSmallIcon(R.drawable.ic_stat_alkyon).setContentTitle("Alkyon").setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text)).setAutoCancel(true).setContentIntent(open(c)).setPriority(NotificationCompat.PRIORITY_HIGH).build()
        c.getSystemService(NotificationManager::class.java).notify(id, n)
    }
    @SuppressLint("MissingPermission")
    fun alarm(c: Context, title: String, text: String) {
        if (!allowed(c)) return
        val n = NotificationCompat.Builder(c, CH_ALARM).setSmallIcon(R.drawable.ic_stat_alkyon).setContentTitle(title).setContentText(text)
            .setContentIntent(open(c)).setCategory(NotificationCompat.CATEGORY_ALARM).setPriority(NotificationCompat.PRIORITY_MAX).setFullScreenIntent(open(c), true).build()
        c.getSystemService(NotificationManager::class.java).notify(77, n)
    }
    fun cancelAlarm(c: Context) = c.getSystemService(NotificationManager::class.java).cancel(77)
    fun ongoing(c: Context): Notification {
        val t = if (Engine.trip.active) L.t("TripOngoing", Geo.hms(Engine.trip.secs()), Engine.trip.n)
                else if (Engine.anchor != null) L.t("AnchorOn") else if (Engine.gearSetting() != null) L.t("GearLive") else L.t("WaitGps")
        val b = NotificationCompat.Builder(c, CH_TRIP).setSmallIcon(R.drawable.ic_stat_alkyon).setContentTitle("Alkyon").setContentText(t)
            .setOngoing(true).setCategory(NotificationCompat.CATEGORY_WORKOUT).setContentIntent(open(c)).setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        // Wear OS: ένδειξη «σε εξέλιξη» στο watch face και στη λίστα εφαρμογών (επιστροφή με ένα πάτημα)
        OngoingActivity.Builder(c, 7, b).setStaticIcon(R.drawable.ic_stat_alkyon).setTouchIntent(open(c))
            .setStatus(Status.Builder().addTemplate(t).build()).build().apply(c)
        return b.build()
    }
}

/* ---------- GPS (έξοδος, «Σημείο», άγκυρα, ρίψη εργαλείου): foreground service, δουλεύει και με σβηστή οθόνη ---------- */
class GpsService : Service(), LocationListener {
    private var lm: LocationManager? = null
    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("MissingPermission")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try { startForeground(7, Notify.ongoing(this), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION) } catch (e: Exception) { stopSelf(); return START_NOT_STICKY }
        if (lm == null) {
            lm = getSystemService(LOCATION_SERVICE) as LocationManager
            try { lm?.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper()) } catch (e: Exception) {}
        }
        running = true
        return START_STICKY
    }
    override fun onLocationChanged(l: Location) {
        Engine.onPos(l.latitude, l.longitude, if (l.hasSpeed()) l.speed else null, if (l.hasBearing()) l.bearing else null, if (l.hasAccuracy()) l.accuracy else null)
    }
    override fun onDestroy() { try { lm?.removeUpdates(this) } catch (e: Exception) {}; lm = null; running = false; super.onDestroy() }

    companion object {
        var running = false
        private var lastNote = 0L
        fun refreshNote(c: Context) {
            if (!running) return
            val t = System.currentTimeMillis(); if (t - lastNote < 20000) return; lastNote = t
            try { c.getSystemService(NotificationManager::class.java).notify(7, Notify.ongoing(c)) } catch (e: Exception) {}
        }
    }
}

/* Wear OS: η έξοδος δεν γράφεται σε εφαρμογή υγείας (η διαδρομή πάει στο Alkyon, όπως και στο Garmin) */
object Health {
    fun start(c: Context) {}
    fun stop(c: Context, save: Boolean) {}
}

/* ---------- βαρόμετρο του ρολογιού: ιστορικό (t, hPa) για την αλλαγή σε 3 ώρες ---------- */
object Baro {
    fun has(c: Context) = (c.getSystemService(Context.SENSOR_SERVICE) as SensorManager).getDefaultSensor(Sensor.TYPE_PRESSURE) != null
    suspend fun read(c: Context): Double? {
        val sm = c.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val s = sm.getDefaultSensor(Sensor.TYPE_PRESSURE) ?: return null
        return withTimeoutOrNull(4000) {
            suspendCancellableCoroutine { cont ->
                val l = object : SensorEventListener {
                    override fun onSensorChanged(e: SensorEvent) { sm.unregisterListener(this); if (cont.isActive) cont.resume(e.values[0].toDouble()) }
                    override fun onAccuracyChanged(s: Sensor?, a: Int) {}
                }
                sm.registerListener(l, s, SensorManager.SENSOR_DELAY_NORMAL)
                cont.invokeOnCancellation { sm.unregisterListener(l) }
            }
        }
    }
    /** κρατά τις μετρήσεις των τελευταίων 5 ωρών */
    fun store(p: Double) {
        val now = nowS(); val a = P.arr("bh"); val o = JSONArray()
        for (i in 0 until a.length()) { val e = a.getJSONArray(i); if (now - e.getLong(0) < 5 * 3600) o.put(e) }
        o.put(JSONArray().put(now).put(p)); P.put("bh", o)
    }
    /** αλλαγή σε 3 ώρες (hPa) ή null */
    fun d3(): Pair<Double, Double>? {
        val a = P.arr("bh"); if (a.length() < 2) return null
        val now = nowS(); val last = a.getJSONArray(a.length() - 1)
        var p3: Double? = null
        for (i in a.length() - 1 downTo 0) { val e = a.getJSONArray(i); if (now - e.getLong(0) >= 10800) { p3 = e.getDouble(1); break } }
        val d = last.getDouble(1) - (p3 ?: return null)
        if (abs(d) > 15) return null   // όχι καιρός: αλλαγή υψομέτρου ή λάθος αισθητήρα
        return d to last.getDouble(1)
    }
}

/* ---------- παρασκήνιο κάθε ~30′ (AlkService.mc): καμπές πίεσης, καλύτερη ώρα σε ~30′, βαρόμετρο ---------- */
class AlertWorker(c: Context, p: WorkerParameters) : CoroutineWorker(c, p) {
    override suspend fun doWork(): Result {
        val c = applicationContext; P.init(c)
        val msgs = ArrayList<String>()
        val fired = P.obj("fired") ?: JSONObject()
        val now = nowS()
        // παλιές σημάνσεις έξω
        val it = fired.keys(); val old = ArrayList<String>(); while (it.hasNext()) { val k = it.next(); if (now - fired.optLong(k) > 2 * 86400) old.add(k) }; old.forEach { fired.remove(it) }
        try {
            Baro.read(c)?.let { Baro.store(it) }
            val d3 = Baro.d3()
            if (d3 != null && P.b("pressAlert")) {
                val thr = P.d("pressThr").coerceAtLeast(1.0); val d = d3.first
                val key = "baro" + (if (d < 0) "-" else "+")
                if (abs(d) >= thr && now - fired.optLong(key, 0) > 3 * 3600) {
                    fired.put(key, now)
                    msgs.add(L.t(if (d < 0) "PressDrop" else "PressRise") + " " + (if (d < 0) "-" else "+") + L.f1(abs(d)) + " hPa / 3h")
                }
            }
        } catch (e: Exception) {}
        if (P.b("turnAlert") || P.b("bestAlert")) {
            val loc = P.arr("loc")
            val lat = if (loc.length() >= 2) loc.getDouble(0) else P.d("homeLat"); val lon = if (loc.length() >= 2) loc.getDouble(1) else P.d("homeLon")
            val d = Api.forecast(lat, lon, bg = true)
            if (d != null) {
                P.put("bgd", d.put("got", now))
                Surfaces.update(c)
                val bw = d.optJSONObject("bw")
                if (P.b("bestAlert") && bw != null && bw.optInt("s", 0) >= 60) {
                    val db = bw.optLong("ts") - now; val key = "best" + bw.optLong("ts")
                    if (db in 1..2700 && !fired.has(key)) { fired.put(key, now); msgs.add(L.t("BestSoon", db / 60, bw.optString("w"), bw.optInt("s"))) }
                }
                val tn = d.optJSONArray("tn")
                if (P.b("turnAlert") && tn != null) for (i in 0 until tn.length()) {
                    val e = tn.getJSONObject(i); val dt = e.optLong("ts") - now; val peak = e.optString("k") == "peak"
                    val ks = "ts" + e.optLong("ts"); val kn = "tn" + e.optLong("ts")
                    if (dt in 1..3600 && !fired.has(ks)) { fired.put(ks, now); msgs.add(L.t(if (peak) "TurnPeakSoon" else "TurnLowSoon", e.optString("t"), e.optInt("p"))) }
                    else if (dt in -2700..0 && !fired.has(kn)) { fired.put(kn, now); msgs.add(L.t(if (peak) "TurnPeakNow" else "TurnLowNow", e.optString("t"), e.optInt("p"))) }
                }
            }
        }
        P.put("fired", fired)
        if (msgs.isNotEmpty()) Notify.show(c, 11, msgs.joinToString("\n"))
        Sender.flush()
        return Result.success()
    }
    companion object {
        fun schedule(c: Context) {
            val on = P.b("pressAlert") || P.b("turnAlert") || P.b("bestAlert")
            val wm = WorkManager.getInstance(c)
            if (!on) { wm.cancelUniqueWork("alk-bg"); return }
            val req = PeriodicWorkRequestBuilder<AlertWorker>(30, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.NOT_REQUIRED).build()).build()
            wm.enqueueUniquePeriodicWork("alk-bg", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}

/* ---------- κωδικός σύνδεσης από το κινητό (Wearable Data Layer, /alkyon/link) ---------- */
object Link {
    fun apply(c: Context, code: String?) {
        if (code.isNullOrBlank()) return
        val clean = code.uppercase().replace(Regex("[^A-Z0-9]"), "")
        if (clean.length < 6 || clean == P.code) return
        P.code = clean; P.setB("wel", true)
        Engine.welcome = false
        Engine.fc?.remove("got")
        android.os.Handler(Looper.getMainLooper()).post {
            Engine.sayK(L.t("LinkedMsg"), "check", 2, 3500)
            Engine.load(true); Sender.flush()
        }
    }
    /** στην εκκίνηση: διαβάζει τον κωδικό που έστειλε ήδη το κινητό */
    fun pull(c: Context) {
        Thread {
            try {
                val items = com.google.android.gms.tasks.Tasks.await(Wearable.getDataClient(c).dataItems, 10, TimeUnit.SECONDS)
                for (i in items) if (i.uri.path == "/alkyon/link") apply(c, DataMapItem.fromDataItem(i).dataMap.getString("code"))
                items.release()
            } catch (e: Exception) {}
        }.start()
    }
}

class LinkListener : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        P.init(this)
        for (e in events) if (e.type == DataEvent.TYPE_CHANGED && e.dataItem.uri.path == "/alkyon/link")
            Link.apply(this, DataMapItem.fromDataItem(e.dataItem).dataMap.getString("code"))
    }
}
