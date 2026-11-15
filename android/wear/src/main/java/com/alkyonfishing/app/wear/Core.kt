// Alkyon για Wear OS: αποθήκευση, κείμενα, server, γεωμετρία, διαδρομή εξόδου και ουρά αποστολής.
// Ίδια λογική με την εφαρμογή Garmin (AlkSender.mc, AlkTrip.mc, ρυθμίσεις properties.xml).
package com.alkyonfishing.app.wear

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

const val BC_URL = "https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/watch"
const val BC_KEY = "sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA"
const val DEV = "wearos"

fun nowS(): Long = System.currentTimeMillis() / 1000

/* ---------- κείμενα (ελληνικά αν το ρολόι είναι στα ελληνικά) ---------- */
object L {
    val el: Boolean get() = Locale.getDefault().language == "el"
    fun t(k: String, vararg a: Any?): String {
        var s = (if (el) S.EL[k] else S.EN[k]) ?: S.EN[k] ?: k
        a.forEachIndexed { i, v -> s = s.replace("$" + (i + 1) + "$", v?.toString() ?: "") }
        return s.replace("|", "\n")
    }
    /** κεφαλαία χωρίς τόνους (όπως οι τίτλοι στο Garmin) */
    fun up(s: String): String {
        val m = mapOf('ά' to 'α', 'έ' to 'ε', 'ή' to 'η', 'ί' to 'ι', 'ό' to 'ο', 'ύ' to 'υ', 'ώ' to 'ω', 'ϊ' to 'ι', 'ϋ' to 'υ', 'ΐ' to 'ι', 'ΰ' to 'υ')
        return s.map { m[it] ?: it }.joinToString("").uppercase(Locale.ROOT)
    }
    fun f1(x: Double): String = String.format(if (el) Locale("el") else Locale.US, "%.1f", x)
    fun f2(x: Double): String = String.format(if (el) Locale("el") else Locale.US, "%.2f", x)
    fun f0(x: Double): String = String.format(Locale.US, "%.0f", x)
}

/* ---------- αποθήκευση: ρυθμίσεις (ίδια ονόματα με το Garmin) και κατάσταση ---------- */
object P {
    lateinit var sp: SharedPreferences
    fun init(c: Context) { if (!::sp.isInitialized) sp = c.applicationContext.getSharedPreferences("alk", Context.MODE_PRIVATE) }

    private val DEF_B = mapOf("turnAlert" to true, "pressAlert" to true, "nightRed" to true, "bestAlert" to true, "keysL" to true, "health" to true)
    private val DEF_D = mapOf("pressThr" to 2.0, "homeLat" to 34.75, "homeLon" to 32.42, "anchorM" to 40.0, "boatKn" to 15.0,
        "trollMin" to 2.5, "trollMax" to 3.5, "trollLine" to 40.0, "leadFa" to 1.0, "clrFa" to 1.0)

    fun b(k: String): Boolean = sp.getBoolean(k, DEF_B[k] ?: false)
    fun setB(k: String, v: Boolean) = sp.edit().putBoolean(k, v).apply()
    fun d(k: String): Double = if (sp.contains(k)) java.lang.Double.longBitsToDouble(sp.getLong(k, 0)) else (DEF_D[k] ?: 0.0)
    fun dn(k: String): Double? = if (sp.contains(k)) java.lang.Double.longBitsToDouble(sp.getLong(k, 0)) else null
    fun setD(k: String, v: Double?) { if (v == null) sp.edit().remove(k).apply() else sp.edit().putLong(k, java.lang.Double.doubleToRawLongBits(v)).apply() }
    fun s(k: String): String = sp.getString(k, "") ?: ""
    fun setS(k: String, v: String?) { if (v == null) sp.edit().remove(k).apply() else sp.edit().putString(k, v).apply() }
    fun i(k: String): Int? = if (sp.contains(k)) sp.getInt(k, 0) else null
    fun setI(k: String, v: Int?) { if (v == null) sp.edit().remove(k).apply() else sp.edit().putInt(k, v).apply() }
    fun obj(k: String): JSONObject? = try { sp.getString(k, null)?.let { JSONObject(it) } } catch (e: Exception) { null }
    fun arr(k: String): JSONArray = try { sp.getString(k, null)?.let { JSONArray(it) } ?: JSONArray() } catch (e: Exception) { JSONArray() }
    fun put(k: String, v: Any?) { if (v == null) sp.edit().remove(k).apply() else sp.edit().putString(k, v.toString()).apply() }

    /** κωδικός σύνδεσης (από το κινητό ή γραμμένος στο ρολόι) */
    var code: String
        get() = s("code").uppercase(Locale.ROOT).replace(Regex("[^A-Z0-9]"), "")
        set(v) = setS("code", v.uppercase(Locale.ROOT).replace(Regex("[^A-Z0-9]"), ""))
    fun linked() = code.length >= 6
}

/* ---------- server (Supabase function «watch»: ίδια με του Garmin) ---------- */
object Api {
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
    fun get(q: Map<String, String>, timeout: Int = 20000): JSONObject? = try {
        val u = URL(BC_URL + "?" + (q + ("apikey" to BC_KEY)).entries.joinToString("&") { enc(it.key) + "=" + enc(it.value) })
        val c = u.openConnection() as HttpURLConnection
        c.connectTimeout = timeout; c.readTimeout = timeout
        c.setRequestProperty("apikey", BC_KEY)
        val ok = c.responseCode == 200
        val t = (if (ok) c.inputStream else c.errorStream)?.bufferedReader()?.readText() ?: ""
        c.disconnect()
        if (ok) JSONObject(t) else null
    } catch (e: Exception) { null }

    /** POST: επιστρέφει τον κωδικό HTTP (0 = χωρίς δίκτυο) */
    fun post(body: JSONObject): Int = try {
        val c = URL("$BC_URL?apikey=$BC_KEY").openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true
        c.connectTimeout = 20000; c.readTimeout = 20000
        c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("apikey", BC_KEY)
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = c.responseCode
        try { (if (code < 400) c.inputStream else c.errorStream)?.close() } catch (e: Exception) {}
        c.disconnect(); code
    } catch (e: Exception) { 0 }

    fun forecast(lat: Double, lon: Double, bg: Boolean = false): JSONObject? {
        val q = mutableMapOf("lat" to String.format(Locale.US, "%.2f", lat), "lon" to String.format(Locale.US, "%.2f", lon), "lang" to if (L.el) "el" else "en")
        if (bg) q["bg"] = "1"
        if (P.linked() && !bg) q["code"] = P.code
        return get(q)?.takeIf { it.has("ok") }
    }
    fun grid(lat: Double, lon: Double): JSONObject? {
        val q = mutableMapOf("grid" to "1", "lat" to String.format(Locale.US, "%.4f", lat), "lon" to String.format(Locale.US, "%.4f", lon))
        if (P.linked()) q["code"] = P.code
        return get(q, 25000)?.takeIf { it.has("ok") && it.has("d") }
    }
}

/* ---------- γεωμετρία ---------- */
object Geo {
    /** km (haversine) */
    fun dist(a1: Double, o1: Double, a2: Double, o2: Double): Double {
        val r = Math.PI / 180
        val x = sin((a2 - a1) * r / 2) * sin((a2 - a1) * r / 2) + cos(a1 * r) * cos(a2 * r) * sin((o2 - o1) * r / 2) * sin((o2 - o1) * r / 2)
        return 2 * 6371.0 * asin(sqrt(x))
    }
    fun bearing(a1: Double, o1: Double, a2: Double, o2: Double): Double {
        val r = Math.PI / 180
        val y = sin((o2 - o1) * r) * cos(a2 * r)
        val x = cos(a1 * r) * sin(a2 * r) - sin(a1 * r) * cos(a2 * r) * cos((o2 - o1) * r)
        val b = Math.toDegrees(atan2(y, x)); return if (b < 0) b + 360 else b
    }
    /** σημείο m μέτρα από (lat, lon) προς την πορεία hd */
    fun fwd(lat: Double, lon: Double, hd: Double, m: Double): DoubleArray {
        val r = Math.toRadians(hd)
        return doubleArrayOf(lat + m * cos(r) / 111320.0, lon + m * sin(r) / (111320.0 * cos(Math.toRadians(lat))))
    }
    fun distTxt(m: Double): String = if (m < 1000) "${m.toInt()} m" else (if (m < 10000) L.f1(m / 1000) else L.f0(m / 1000)) + " km"
    fun hms(sx: Long): String { val s = if (sx < 0) 0 else sx; return "${s / 3600}:" + String.format(Locale.US, "%02d", (s % 3600) / 60) }
    fun minHm(m: Int): String { val x = ((m % 1440) + 1440) % 1440; return String.format(Locale.US, "%02d:%02d", x / 60 % 24, x % 60) }
    fun tsHm(ts: Long): String { val c = java.util.Calendar.getInstance(); c.timeInMillis = ts * 1000; return String.format(Locale.US, "%02d:%02d", c.get(java.util.Calendar.HOUR_OF_DAY), c.get(java.util.Calendar.MINUTE)) }
    fun nowMin(): Int { val c = java.util.Calendar.getInstance(); return c.get(java.util.Calendar.HOUR_OF_DAY) * 60 + c.get(java.util.Calendar.MINUTE) }
    fun tzMin(): Int = java.util.TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60000
    fun r5(x: Double) = Math.round(x * 1e5) / 1e5
}

/* ---------- διαδρομή της εξόδου (AlkTrip.mc 1.5.1): σημείο στη στροφή, κάθε ~200 m ή κάθε 30″ σε κίνηση ---------- */
class Track {
    var active = false
    var tid = ""
    var start = 0L
    var n = 0
    var pts = ArrayList<DoubleArray>()   // [lat, lon, ts]
    var lastT = 0L
    var km = 0.0
    var spd: Double? = null
    var fixAt = 0L
    var p0: DoubleArray? = null
    var lastFix: DoubleArray? = null
    var lastHd: Double? = null

    fun begin() {
        active = true; start = nowS(); tid = "wt$start"; n = 0; pts.clear(); lastT = 0; km = 0.0; spd = null; fixAt = 0; p0 = null; lastFix = null; lastHd = null
    }
    fun onPos(lat: Double, lon: Double, speedMs: Float?, headingDeg: Float?, accM: Float?) {
        val t = nowS(); fixAt = t
        if (speedMs != null) spd = speedMs * 1.94384
        if (lat == 0.0 && lon == 0.0) return
        if (accM != null && accM > 80) return
        if (p0 == null) p0 = doubleArrayOf(lat, lon)
        val lf = lastFix
        if (lf == null) lastFix = doubleArrayOf(lat, lon)
        else { val step = Geo.dist(lf[0], lf[1], lat, lon); if (step >= 0.008) { km += step; lastFix = doubleArrayOf(lat, lon) } }
        val hd = if (headingDeg != null && speedMs != null && speedMs > 1.0f) headingDeg.toDouble() else null
        if (pts.isEmpty()) { add(lat, lon, t, hd); return }
        val last = pts[pts.size - 1]
        val dt = t - lastT
        if (dt < 2) return
        val dm = Geo.dist(last[0], last[1], lat, lon) * 1000
        if (dm < 15) return
        var turn = 0.0
        val lh = lastHd
        if (hd != null && lh != null) { turn = abs(hd - lh); if (turn > 180) turn = 360 - turn }
        if (turn >= 20 || dm >= 200 || dt >= 30) add(lat, lon, t, hd)
    }
    private fun add(lat: Double, lon: Double, t: Long, hd: Double?) {
        lastT = t; if (hd != null) lastHd = hd
        pts.add(doubleArrayOf(Geo.r5(lat), Geo.r5(lon), t.toDouble()))
        if (pts.size > 500) pts = simplify(pts, 350)
    }
    fun hasFix() = active && nowS() - fixAt < 30
    fun secs() = if (active) nowS() - start else 0L
    fun onCatch(kind: String): String? { if (!active) return null; if (kind == "fish") n += 1; return tid }

    fun finish(save: Boolean): JSONObject? {
        if (!active) return null
        active = false
        val p = simplify(pts, 250); pts = ArrayList()
        if (!save) return null
        val a = JSONArray(); p.forEach { a.put(JSONArray().put(it[0]).put(it[1]).put(it[2].toLong())) }
        return JSONObject().put("k", "trip").put("ts", start).put("te", nowS()).put("tz", Geo.tzMin()).put("tid", tid).put("n", n).put("pts", a)
    }

    /* Douglas–Peucker που κρατά τις στροφές */
    companion object {
        fun simplify(a: ArrayList<DoubleArray>, maxN: Int): ArrayList<DoubleArray> {
            if (a.size <= maxN) return a
            var eps = 8.0; var out = a
            while (out.size > maxN && eps < 5000) { out = dp(a, eps); eps *= 2 }
            if (out.size > maxN) { val o = ArrayList<DoubleArray>(); var i = 0; while (i < out.size) { o.add(out[i]); i += 2 }; if (out.size % 2 == 0) o.add(out.last()); out = o }
            return out
        }
        private fun dp(a: ArrayList<DoubleArray>, eps: Double): ArrayList<DoubleArray> {
            val n0 = a.size; val keep = BooleanArray(n0); keep[0] = true; keep[n0 - 1] = true
            val st = ArrayList<IntArray>(); st.add(intArrayOf(0, n0 - 1))
            val c = cos(a[0][0] * Math.PI / 180)
            while (st.isNotEmpty()) {
                val s = st.removeAt(st.size - 1); val i0 = s[0]; val i1 = s[1]
                if (i1 <= i0 + 1) continue
                val ax = a[i0][1] * c * 111320; val ay = a[i0][0] * 110540; val bx = a[i1][1] * c * 111320; val by = a[i1][0] * 110540
                val vx = bx - ax; val vy = by - ay; val len = sqrt(vx * vx + vy * vy)
                var best = -1.0; var bi = -1
                for (k in i0 + 1 until i1) {
                    val px = a[k][1] * c * 111320 - ax; val py = a[k][0] * 110540 - ay
                    val dd = if (len > 0.5) abs((vx * py - vy * px) / len) else sqrt(px * px + py * py)
                    if (dd > best) { best = dd; bi = k }
                }
                if (best > eps && bi > 0) { keep[bi] = true; st.add(intArrayOf(i0, bi)); st.add(intArrayOf(bi, i1)) }
            }
            val out = ArrayList<DoubleArray>(); for (m in 0 until n0) if (keep[m]) out.add(a[m]); return out
        }
    }
}

/* ---------- ουρά αποστολής (Storage «q» του Garmin): χωρίς δίκτυο μένει και στέλνεται αργότερα ---------- */
object Sender {
    @Volatile private var busy = false
    fun size(): Int = P.arr("q").length()
    @Synchronized fun add(item: JSONObject) {
        val q = P.arr("q"); q.put(item)
        val out = if (q.length() > 80) JSONArray().also { for (i in q.length() - 80 until q.length()) it.put(q.get(i)) } else q
        P.put("q", out)
    }
    @Synchronized private fun drop1() { val q = P.arr("q"); val o = JSONArray(); for (i in 1 until q.length()) o.put(q.get(i)); P.put("q", o) }

    /** στέλνει όσα περιμένουν (σε νήμα): cb(true) εστάλη, cb(null) λάθος κωδικός, cb(false) χωρίς δίκτυο */
    fun flush(cb: ((Boolean?) -> Unit)? = null) {
        if (busy || !P.linked() || size() == 0) return
        busy = true
        Thread {
            var res: Boolean? = true
            try {
                while (true) {
                    val q = P.arr("q"); if (q.length() == 0) break
                    val it = q.getJSONObject(0)
                    val body = JSONObject().put("code", P.code).put("dev", DEV)
                    val keys = it.keys()
                    while (keys.hasNext()) { val k = keys.next(); if (k == "k") body.put("kind", it.get(k)) else body.put(k, it.get(k)) }
                    val c = Api.post(body)
                    if (c == 200) { drop1(); continue }
                    if (c in 400..499 && c != 403 && c != 408 && c != 429) { drop1(); continue }   // χαλασμένο στοιχείο: να μη μπλοκάρει την ουρά
                    res = if (c == 403) null else false
                    break
                }
            } finally { busy = false }
            cb?.invoke(res)
        }.start()
    }
}
