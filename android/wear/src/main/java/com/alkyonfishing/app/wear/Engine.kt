// Alkyon για Wear OS: η λογική της εφαρμογής (μεταφορά της MainView.mc / AlkGear.mc του Garmin 1.12.25).
// Σελίδες: 0 σήμερα, 1 έξοδος / συρτή, 2 σημείο, 3 επόμενες μέρες, 4 πίεση, 5 καλαμάρι.
// Έξοδος με GPS (GpsService), ψάρι / χάθηκε / λαγοκέφαλος, συρτή αφρού και βυθού (μολύβια, «Ρίχνω», «Ακούμπησε», χάρτης βυθού),
// σημεία ψαριών, στροφή, «Στον βυθό;», ώρα επιστροφής, άγκυρα, δίχτυ / παραγάδι / κλουβί.
package com.alkyonfishing.app.wear

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.pow

data class Msg(val text: String, val icon: String?, val ci: Int)
data class Target(val name: String, val lat: Double, val lon: Double, val home: Boolean = false)

object Engine {
    lateinit var ctx: Context
    private val h = Handler(Looper.getMainLooper())

    /** αυξάνεται σε κάθε αλλαγή: η οθόνη (Compose) ξαναζωγραφίζεται */
    var ver by mutableIntStateOf(0)
    fun bump() { if (Looper.myLooper() == Looper.getMainLooper()) ver++ else h.post { ver++ } }
    /** ζήτηση αλλαγής σελίδας από τη λογική (π.χ. γύρνα στη συρτή) */
    var pageReq by mutableIntStateOf(-1)

    var page = 0
    var visible = false
    var fc: JSONObject? = null
    var loading = false
    var welcome = false

    // μηνύματα (sayK) και οθόνη «Καταγράφηκε»
    var msg: Msg? = null
    private var msgSeq = 0
    var lastKind: String? = null
    var lastHm = ""
    var lastQ = false
    var lastN = 0

    val trip = Track()
    var catchTs = ArrayList<Long>()
    var troll: String? = null      // null | "s" αφρού | "b" βυθού
    var trLeads: Int? = null
    var drop: String? = null       // "d" = «Ρίχνω»
    var dropD = 0
    var dropN = 0
    var dropAt = 0L
    private var dropInSince = 0L
    private var dropAsk = 0
    private var dropAskAt = 0L
    private var trOut = 0L
    private var trAlarm = 0L
    var grid: JSONObject? = null
    private var gridD: IntArray? = null
    var gridBusy = false
    private var gridAt = -999999L
    var bdNow: Double? = null
    var bdAhead: Double? = null
    var adv = 0
    private var advSince = 0L
    private var advAt = 0L
    private var hitAt = 0L
    private var depthChk = 0L
    var afterOn = false
    var afterAt = 0L
    var afterCid: String? = null
    private var pageAt = 0L
    private var spotChk = 0L
    private val spotSeen = HashMap<Int, Long>()
    private var turnHd: Double? = null
    private var turnT = 0L
    private var turnAlarm = 0L
    private var keyAdjAt = 0L
    private var keyAdjOld: Int? = null
    private var lnOld: Int? = null
    private var lnAt = 0L

    // GPS, άγκυρα, σημείο
    var cur: DoubleArray? = null
    var gpsHead: Double? = null
    var compass: Double? = null
    var anchor: DoubleArray? = null
    private var anchorOut = 0
    var anchorAlarm = false
    var anchorD = 0.0
    private var alarmAt = 0L
    private var homeWarned = false
    var navT = 0
    private var arrived: Target? = null
    var gpsOn = false
    var gearHaul = false
    private var gearWant = false

    fun init(c: Context) {
        if (::ctx.isInitialized) return
        ctx = c.applicationContext
        P.init(ctx)
        fc = P.obj("fc")
        grid = P.obj("grid"); gridD = grid?.let { toInts(it.optJSONArray("d")) }
        welcome = !P.linked() && !P.b("wel")
        h.postDelayed(object : Runnable { override fun run() { onTick(); h.postDelayed(this, 30000) } }, 30000)
    }

    fun welcomeOk() { welcome = false; P.setB("wel", true); bump() }

    /* ---------- μηνύματα ---------- */
    fun sayK(t: String, ic: String?, ci: Int, ms: Long = 2500) {
        msg = Msg(t, ic, ci); lastKind = null
        val my = ++msgSeq
        h.postDelayed({ if (msgSeq == my) { msg = null; lastKind = null; bump() } }, ms)
        bump()
    }
    fun msgEnd() { msgSeq++; msg = null; lastKind = null; bump() }

    /* ---------- πρόγνωση ---------- */
    fun hasLoc(): Boolean = ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ctx.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun realPos(): DoubleArray? {
        cur?.let { return it }
        if (!hasLoc()) return null
        return try {
            val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val l = listOf(LocationManager.GPS_PROVIDER, LocationManager.FUSED_PROVIDER, LocationManager.NETWORK_PROVIDER)
                .mapNotNull { p -> try { lm.getLastKnownLocation(p) } catch (e: Exception) { null } }
                .filter { System.currentTimeMillis() - it.time < 6 * 3600e3 }.maxByOrNull { it.time }
            l?.let { doubleArrayOf(it.latitude, it.longitude) }
        } catch (e: Exception) { null }
    }
    fun pos(): DoubleArray = realPos() ?: doubleArrayOf(P.d("homeLat"), P.d("homeLon"))

    fun load(force: Boolean) {
        if (loading) return
        val f = fc
        if (!force && f != null && nowS() - f.optLong("got", 0) < 1800) return
        val p = pos()
        P.put("loc", JSONArray().put(p[0]).put(p[1]))
        loading = true; bump()
        Thread {
            val d = Api.forecast(p[0], p[1])
            h.post {
                loading = false
                if (d != null) {
                    d.put("got", nowS()); fc = d; P.put("fc", d)
                    Surfaces.update(ctx)
                }
                bump()
            }
        }.start()
    }
    fun days(): JSONArray? = fc?.optJSONArray("days")
    fun td(): JSONObject? = fc?.optJSONObject("td")
    fun nint(o: JSONObject?, k: String): Int? = if (o == null || !o.has(k) || o.isNull(k)) null else o.optInt(k)
    fun ndbl(o: JSONObject?, k: String): Double? = if (o == null || !o.has(k) || o.isNull(k)) null else o.optDouble(k)

    fun dayOver(): Boolean { val st = nint(td(), "st") ?: return false; return Geo.nowMin() + 30 > st + 60 }
    fun isNight(): Boolean {
        if (!P.b("nightRed")) return false
        val t = td(); val m = Geo.nowMin(); val r = nint(t, "r") ?: 360; val s = nint(t, "st") ?: 1140
        return m > s + 30 || m < r - 30
    }

    /* ---------- δόνηση ---------- */
    fun vib(vararg onOff: Long) {
        try {
            val v = if (android.os.Build.VERSION.SDK_INT >= 31) (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                    else @Suppress("DEPRECATION") (ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator)
            val t = LongArray(onOff.size + 1); t[0] = 0; onOff.forEachIndexed { i, x -> t[i + 1] = x }
            v.vibrate(VibrationEffect.createWaveform(t, -1))
        } catch (e: Exception) {}
    }

    /* ---------- GPS ---------- */
    fun gpsUpdate() {
        val need = trip.active || (page == 2 && visible) || anchor != null || gearHaul || gearSetting() != null
        if (need && !gpsOn && hasLoc()) {
            gpsOn = true
            try { ctx.startForegroundService(Intent(ctx, GpsService::class.java)) } catch (e: Exception) { gpsOn = false }
        } else if (!need && gpsOn) {
            gpsOn = false
            try { ctx.stopService(Intent(ctx, GpsService::class.java)) } catch (e: Exception) {}
        }
        GpsService.refreshNote(ctx)
    }

    fun onPos(lat: Double, lon: Double, speed: Float?, heading: Float?, acc: Float?) {
        if (lat == 0.0 && lon == 0.0) return
        cur = doubleArrayOf(lat, lon)
        gearFix(lat, lon)
        if (heading != null && speed != null && speed > 1.0f) gpsHead = heading.toDouble()
        if (trip.active) trip.onPos(lat, lon, speed, heading, acc)
        checkAnchor(); checkArrive(); checkTroll(); checkDepth(); checkSpots(); checkAutoDown(); checkTurn()
        bump()
    }

    fun anchorR(): Int { val r = P.d("anchorM").toInt(); return if (r < 10) 40 else r }
    private fun checkAnchor() {
        val a = anchor ?: return; val c = cur ?: return
        anchorD = Geo.dist(a[0], a[1], c[0], c[1]) * 1000
        anchorOut = if (anchorD > anchorR()) anchorOut + 1 else 0
        val now = nowS()
        if (anchorOut >= 5 && (!anchorAlarm || now - alarmAt >= 20)) {
            anchorAlarm = true; alarmAt = now
            vib(700, 300, 700, 300, 700)
            Notify.alarm(ctx, L.t("AnchorU"), L.t("Drag", anchorD.toInt()))
            bump()
        }
    }
    fun anchorSet() {
        if (cur == null) cur = realPos()
        val c = cur
        if (c == null) { gpsUpdate(); sayK(L.t("WaitGps"), "pin", 7); return }
        anchor = doubleArrayOf(c[0], c[1]); anchorOut = 0; anchorAlarm = false
        gpsUpdate(); sayK(L.t("AnchorSet", anchorR()), "anchor", 11)
    }
    fun anchorOff() { anchor = null; anchorAlarm = false; anchorOut = 0; Notify.cancelAlarm(ctx); gpsUpdate(); bump() }

    /** στόχοι της σελίδας «Σημείο»: αφετηρία, τελευταίο ψάρι, άγκυρα, σημεία του χρήστη (fc.sp) */
    fun targets(): List<Target> {
        val a = ArrayList<Target>()
        val p0 = trip.p0
        if (trip.active && p0 != null) a.add(Target(L.t("TripStartPt"), p0[0], p0[1], true))
        val lc = P.arr("lastc")
        if (lc.length() >= 3) a.add(Target(L.t("LastFish") + " " + Geo.tsHm(lc.getLong(2)), lc.getDouble(0), lc.getDouble(1)))
        anchor?.let { a.add(Target(L.t("Anchor"), it[0], it[1])) }
        fc?.optJSONArray("sp")?.let { sp ->
            for (i in 0 until sp.length()) { val e = sp.optJSONArray(i) ?: continue
                val n = e.optString(0, ""); a.add(Target(if (n.isEmpty()) L.t("Spot") else n, e.optDouble(1), e.optDouble(2))) }
        }
        return a
    }
    fun heading(): Double? = compass ?: gpsHead

    private fun checkArrive() {
        val c = cur ?: return
        if (!trip.active) return
        arrived?.let { if (Geo.dist(c[0], c[1], it.lat, it.lon) * 1000 > 150) arrived = null; return }
        for (t in targets()) {
            if (t.home) continue
            if (Geo.dist(c[0], c[1], t.lat, t.lon) * 1000 <= 50) {
                arrived = t; vib(300, 150, 300)
                sayK(L.t("Arrived") + "\n" + t.name, "pin", 0); return
            }
        }
    }

    /* ---------- συρτή ---------- */
    fun trMin() = P.d("trollMin")
    fun trMax() = P.d("trollMax")
    private fun checkTroll() {
        val sp = trip.spd
        if (troll == null || !trip.active || sp == null) { trOut = 0; return }
        val now = nowS(); val lo = sp < trMin(); val hi = sp > trMax()
        if (!lo && !hi) { trOut = 0; return }
        if (trOut == 0L) trOut = now
        if (now - trOut >= 20 && now - trAlarm >= 60) {
            trAlarm = now
            if (lo) vib(400, 150, 400) else vib(150, 100, 150, 100, 150)
            toTroll()
            sayK(L.t(if (lo) "TrollSlow" else "TrollFast") + "\n" + L.f1(sp) + " kn (" + L.f1(trMin()) + "–" + L.f1(trMax()) + ")", "speed", 4)
        }
    }
    fun trollSet(m: String?) {
        troll = m; trOut = 0; adv = 0
        if (m == "b") { gridAt = -999999; gridNeed() }
        if (m != "b") drop = null
        if (m == null) trLeads = null
        bump()
    }
    fun leadsAdd(d: Int) {
        val base = trLeads ?: P.i("trLeads") ?: 20
        val n = (base + d).coerceIn(1, 80)
        trLeads = n; P.setI("trLeads", n)
        sayK(L.t("Leads") + "\n" + n, "check", 6)
    }
    fun leadFa(): Double { val v = P.d("leadFa"); return if (v <= 0) 1.0 else v }
    fun clrFa() = P.d("clrFa")
    fun kD(): Double = P.dn("kD") ?: 1.0
    fun sf(): Double {
        val v = trip.spd ?: return 1.0
        if (v < 0.8) return 1.0
        return ((trMin() + trMax()) / 2.0 / v).pow(0.7).coerceIn(0.75, 1.3)
    }
    fun faPerLead() = leadFa() * kD() * sf()
    fun kdReset() { P.setD("kD", 1.0); depthChk = 0; sayK(L.t("KdL", L.f2(leadFa())), "check", 6) }
    fun clrTxt(c: Double) = if (c < 3 && c > -3) L.f1(c) else L.f0(c)
    fun recN(d: Double): Int {
        val fpl = faPerLead(); val cl = clrFa()
        var n = ((d - cl) / fpl).toInt()
        val c0 = d - n * fpl; val c1 = d - (n + 1) * fpl
        if (c1 >= cl * 0.66 && abs(c1 - cl) < abs(c0 - cl)) n += 1
        return n.coerceIn(1, 80)
    }
    fun dropStart(d: Int) {
        sounderSet(d)
        dropAt = nowS(); dropInSince = 0; dropAsk = 0; dropD = d; dropN = recN(d.toDouble()); drop = "d"
        P.setI("dropD", d); toTroll(); vib(200); bump()
    }
    fun dropAdj(d: Int) { dropN = (dropN + d).coerceIn(1, 80); bump() }
    fun dropSet() {
        learnDrop(); trLeads = dropN; P.setI("trLeads", dropN); drop = null
        sayK(L.t("DownOk") + "\n" + dropN + " " + L.t("LeadsL"), "check", 4)
    }
    fun dropCancel() { drop = null; bump() }
    fun dropTouched() {
        val old = keyAdjOld
        if (old != null && System.currentTimeMillis() - keyAdjAt < 2000) { trLeads = old; P.setI("trLeads", old) }
        keyAdjOld = null
        val n = trLeads ?: dropN
        if (dropD <= 0) P.i("dropD")?.let { dropD = it }
        if (n < 1 || dropD <= 0) { leadsAdd(-1); return }
        bdNow?.let { dropD = it.toInt() }
        val ratio = (dropD.toDouble() / (n * leadFa() * sf())).coerceIn(0.75, 1.35)
        val nw = (kD() * 0.6 + ratio * 0.4).coerceIn(0.6, 1.6)
        P.setD("kD", nw)
        val m = (n - 1).coerceAtLeast(1)
        trLeads = m; P.setI("trLeads", m)
        vib(300, 120, 300)
        adv = 0; advSince = 0; advAt = nowS()
        sayK(L.t("TouchedMsg", m, L.f2(nw)), "up", 1)
    }

    /* ---------- χάρτης βυθού ---------- */
    private fun toInts(a: JSONArray?): IntArray? { if (a == null) return null; return IntArray(a.length()) { a.optInt(it) } }
    fun gridNeed() {
        if (troll != "b" || !trip.active || gridBusy) return
        val p = cur ?: realPos() ?: return
        if (grid != null && gridIn(p[0], p[1], 4.0)) return
        val t = System.currentTimeMillis()
        if (t - gridAt < 120000) return
        gridAt = t; gridBusy = true; bump()
        Thread {
            val g = Api.grid(p[0], p[1])
            h.post {
                gridBusy = false
                if (g != null) { grid = g; gridD = toInts(g.optJSONArray("d")); P.put("grid", g); depthChk = 0 }
                bump()
            }
        }.start()
    }
    private fun gridIn(lat: Double, lon: Double, m: Double): Boolean {
        val g = grid ?: return false
        val fx = (lon - g.optDouble("x0")) / g.optDouble("dx"); val fy = (g.optDouble("y0") - lat) / g.optDouble("dy")
        return fx >= m && fy >= m && fx <= g.optInt("w") - 1 - m && fy <= g.optInt("h") - 1 - m
    }
    /** βάθος χάρτη σε οργιές (χωρίς διόρθωση) */
    fun chartFa(lat: Double, lon: Double): Double? {
        val g = grid ?: return null; val d = gridD ?: return null
        val w = g.optInt("w"); val hh = g.optInt("h")
        val fx = (lon - g.optDouble("x0")) / g.optDouble("dx"); val fy = (g.optDouble("y0") - lat) / g.optDouble("dy")
        if (fx < 0 || fy < 0 || fx > w - 1 || fy > hh - 1) return null
        val i = floor(fx).toInt(); val j = floor(fy).toInt()
        val i1 = if (i + 1 < w) i + 1 else i; val j1 = if (j + 1 < hh) j + 1 else j
        val a = fx - i; val b = fy - j
        fun at(x: Int, y: Int) = d.getOrElse(y * w + x) { 0 }.toDouble()
        val v00 = at(i, j); val v10 = at(i1, j); val v01 = at(i, j1); val v11 = at(i1, j1)
        val v = if (v00 > 0 && v10 > 0 && v01 > 0 && v11 > 0) v00 * (1 - a) * (1 - b) + v10 * a * (1 - b) + v01 * (1 - a) * b + v11 * a * b
                else { val x = if (a < 0.5) (if (b < 0.5) v00 else v01) else (if (b < 0.5) v10 else v11); if (x <= 0) return null; x }
        return v / 1.8288
    }
    fun dOff(): Double = P.dn("dOff") ?: 0.0
    fun seaFa(lat: Double, lon: Double): Double? { val c = chartFa(lat, lon) ?: return null; val v = c + dOff(); return if (v < 1) 1.0 else v }
    fun sounderSet(d: Int) {
        val p = cur ?: realPos() ?: return
        val c = chartFa(p[0], p[1]) ?: return
        P.setD("dOff", (d - c).coerceIn(-15.0, 15.0)); depthChk = 0
    }
    fun chartHere(): Double? { val p = cur ?: realPos() ?: return null; return seaFa(p[0], p[1]) }
    private fun hdg(): Double? = gpsHead ?: trip.lastHd
    fun lureBack(n: Int): Double { val m = n * faPerLead() * 1.8288 * 1.3; return if (m < 25) 25.0 else m }
    private fun checkDepth() {
        val c = cur ?: return
        if (troll != "b" || !trip.active) return
        gridNeed()
        val t = System.currentTimeMillis()
        if (t - depthChk < 3000) return
        depthChk = t
        val n = trLeads; val hd = hdg()
        var lp = c; var ap = c
        if (hd != null && n != null) { lp = Geo.fwd(c[0], c[1], hd + 180, lureBack(n)); ap = Geo.fwd(c[0], c[1], hd, 120.0) }
        val bl = seaFa(lp[0], lp[1]) ?: seaFa(c[0], c[1])
        bdNow = bl; bdAhead = seaFa(ap[0], ap[1])
        if (bl == null || n == null || drop != null) { adv = 0; return }
        dropD = bl.toInt()
        val now = nowS(); val lure = n * faPerLead()
        val ba = bdAhead
        if (ba != null && ba < lure + 0.3 && now - hitAt >= 60) {
            hitAt = now
            val k2 = (lure - ba + clrFa()) / faPerLead() + 0.99
            vib(500, 150, 500, 150, 500); toTroll()
            sayK(L.t("HitAhead", k2.toInt(), L.f0(ba)), "up", 1); return
        }
        var use = bl; if (ba != null && ba < use) use = ba
        var dlt = recN(use) - n
        if (dlt == 1 && use - lure - clrFa() < faPerLead() * 1.5) dlt = 0
        if (dlt == -1 && use - lure >= clrFa() * 0.66) dlt = 0
        if (dlt == 0) { adv = 0; advSince = 0; return }
        if (adv == 0 || (adv > 0) != (dlt > 0)) advSince = now
        adv = dlt
        if (now - advSince >= 15 && now - advAt >= 60) {
            advAt = now
            if (dlt < 0) vib(300, 120, 300) else vib(200)
            toTroll()
            sayK(L.t(if (dlt < 0) "AdvUp" else "AdvDown", abs(dlt), L.f0(use)), if (dlt < 0) "up" else "down", if (dlt < 0) 1 else 3)
        }
    }
    /** απόσταση δολώματος από τον βυθό τώρα (οργιές) ή null */
    fun clrNow(): Double? { val b = bdNow ?: return null; val n = trLeads ?: return null; return b - n * faPerLead() }

    private fun checkSpots() {
        val c = cur ?: return
        val tc = fc?.optJSONArray("tc") ?: return
        if (troll == null || !trip.active) return
        val t = System.currentTimeMillis(); if (t - spotChk < 5000) return; spotChk = t
        val now = nowS()
        for (i in 0 until tc.length()) {
            val p = tc.optJSONArray(i) ?: continue
            if (Geo.dist(c[0], c[1], p.optDouble(0), p.optDouble(1)) * 1000 > 80) continue
            val last = spotSeen[i]; if (last != null && now - last < 900) continue
            spotSeen[i] = now
            var info = ""
            if (!p.isNull(2)) info = "${p.optInt(2)} " + L.t("LeadsL")
            if (p.length() > 3 && !p.isNull(3)) info += (if (info.isNotEmpty()) " · " else "") + L.t("SeabedL", p.optInt(3))
            vib(150, 100, 150, 100, 400); toTroll()
            sayK(L.t("SpotHit") + "\n" + (if (info.isNotEmpty()) L.t("SpotThen", info) else L.t("SpotHere")), "fish", 2); return
        }
    }
    fun secPerLead(): Double = P.dn("spl") ?: 8.0
    private fun learnDrop() {
        if (dropAt <= 0 || dropN < 1) return
        val m = (nowS() - dropAt).toDouble() / dropN
        if (m < 2 || m > 40) return
        P.setD("spl", secPerLead() * 0.7 + m * 0.3)
    }
    private fun checkAutoDown() {
        val sp = trip.spd
        if (drop == null || troll != "b" || !trip.active || sp == null) { dropInSince = 0; return }
        val now = nowS()
        if (sp < trMin() || sp > trMax()) { dropInSince = 0; return }
        if (dropInSince == 0L) dropInSince = now
        val need = dropN * secPerLead() + 20
        if (dropAsk < 2 && now - dropAt >= need && now - dropInSince >= 30 && (dropAsk == 0 || now - dropAskAt >= 60)) {
            dropAsk += 1; dropAskAt = now
            vib(250, 150, 250); toTroll()
            sayK(L.t("AutoDown", dropN), "down", 4)
        }
    }
    private fun checkTurn() {
        val gh = gpsHead; val sp = trip.spd
        if (troll != "b" || trLeads == null || drop != null || gh == null || sp == null || sp < 1.0) { turnHd = null; return }
        val t = System.currentTimeMillis()
        val th = turnHd
        if (th == null || t - turnT > 15000) { turnHd = gh; turnT = t; return }
        var d = abs(gh - th); while (d > 360) d -= 360; if (d > 180) d = 360 - d
        val now = nowS()
        if (d > 40 && now - turnAlarm >= 60) {
            turnAlarm = now; turnHd = null
            vib(200, 120, 200); toTroll()
            sayK(L.t("TurnMsg"), "path", 4)
        }
    }

    /* ---------- κουμπιά στη συρτή (UP/DOWN του Garmin = κορώνα και κουμπιά οθόνης) ---------- */
    fun toTroll() { if (page != 1) { page = 1; pageAt = System.currentTimeMillis(); pageReq = 1; gpsUpdate() } }
    fun trollPage() = page == 1 && troll != null && trip.active
    fun quickFish() {
        logCatch("fish")
        if (!P.linked()) return
        msgEnd(); afterOn = true; afterAt = System.currentTimeMillis()
        val my = afterAt
        h.postDelayed({ if (afterAt == my && afterOn) { afterOn = false; bump() } }, 6000)
        bump()
    }
    fun afterStop() { afterOn = false }
    private fun fixItem(kind: String) = JSONObject().put("ts", nowS()).put("tz", Geo.tzMin()).put("k", kind).put("cid", afterCid)
    fun afterUndo() {
        afterStop(); if (afterCid == null) return
        Sender.add(fixItem("undo")); Sender.flush()
        if (trip.n > 0) trip.n -= 1
        if (catchTs.isNotEmpty()) catchTs.removeAt(catchTs.size - 1)
        afterCid = null; vib(120, 80, 120)
        sayK(L.t("Undone"), "undo", 6)
    }
    fun afterLost() {
        afterStop(); if (afterCid == null) return
        Sender.add(fixItem("upd").put("miss", 1)); Sender.flush()
        if (trip.n > 0) trip.n -= 1
        if (catchTs.isNotEmpty()) catchTs.removeAt(catchTs.size - 1)
        sayK(L.t("LostOk"), "x", 1)
    }
    /** τα είδη για το «είδος» μετά το ψάρι: [τιμή, ετικέτα] */
    fun speciesList(): List<Pair<String, String>> {
        val ls = fc?.optJSONArray("tsp") ?: return emptyList(); val lb = fc?.optJSONArray("tspl")
        return (0 until ls.length()).map { ls.optString(it) to (lb?.optString(it)?.takeIf { s -> s.isNotEmpty() } ?: ls.optString(it)) }
    }
    fun setSpecies(i: Int) {
        val ls = speciesList(); if (afterCid == null || i < 0 || i >= ls.size) return
        Sender.add(fixItem("upd").put("sp", ls[i].first)); Sender.flush()
        sayK(L.t("SpQ") + "\n" + ls[i].second, "fish", 0)
    }
    /** κορώνα / κουμπιά ± στη σελίδα της συρτής. true = το χειρίστηκε */
    fun keyAct(d: Int): Boolean {
        if (keysLeads()) { keyLeads(d); return true }
        if (keysLine()) { lineAdd(d * lineStep()); return true }
        return false
    }
    fun keysLeads() = page == 1 && troll == "b" && trip.active && P.b("keysL")
    fun keysLine() = page == 1 && troll == "s" && trip.active && P.b("keysL")
    fun lineNow(): Int = P.i("trLn") ?: P.d("trollLine").toInt()
    fun lineStep(): Int = P.i("trLs") ?: 5
    fun lineStepNext(): Int { val s = lineStep(); val n = if (s == 1) 5 else if (s == 5) 10 else 1; P.setI("trLs", n); bump(); return n }
    fun lineAdd(d: Int) {
        if (msg != null) msgEnd()
        lnOld = lineNow(); lnAt = System.currentTimeMillis()
        P.setI("trLn", (lineNow() + d).coerceIn(0, 300)); vib(60); bump()
    }
    fun lurePos(p: DoubleArray?, m: Int): DoubleArray? { val hd = hdg(); if (p == null || hd == null || m <= 0) return null; return Geo.fwd(p[0], p[1], hd + 180, m.toDouble()) }
    fun keyLeads(d: Int) {
        if (msg != null) msgEnd()
        if (drop != null) dropAdj(d)
        else {
            val base = trLeads ?: P.i("trLeads") ?: 20
            keyAdjOld = trLeads; keyAdjAt = System.currentTimeMillis()
            val n = (base + d).coerceIn(1, 80)
            trLeads = n; P.setI("trLeads", n)
            adv = 0; advSince = 0; depthChk = 0; advAt = nowS()
            checkDepth()
        }
        vib(60); bump()
    }
    fun advApply() {
        val l = trLeads ?: return; if (adv == 0) return
        val n = (l + adv).coerceIn(1, 80)
        trLeads = n; P.setI("trLeads", n); adv = 0; advSince = 0; advAt = nowS(); depthChk = 0
        sayK(L.t("Leads") + "\n" + n, "check", 6)
    }

    /** στόχος της εξόδου: ώρα επιστροφής από το πλάνο του κινητού, αλλιώς η δύση. (ts, είναι_επιστροφή) */
    fun tripTarget(): Pair<Long, Boolean>? {
        val now = nowS(); val f = fc
        if (f != null && f.has("due") && f.optLong("due") > trip.start) return f.optLong("due") to true
        val st = nint(td(), "st") ?: return null
        val ss = now + (st - Geo.nowMin()) * 60L
        return if (ss > trip.start) ss to false else null
    }
    private fun checkHome() {
        val c = cur ?: return; val p0 = trip.p0 ?: return
        if (!trip.active || homeWarned) return
        val tg = tripTarget() ?: return
        val km = Geo.dist(c[0], c[1], p0[0], p0[1])
        var kn = P.d("boatKn"); if (kn < 2) kn = 15.0
        val eta = (km / 1.852) / kn * 3600
        if (nowS() >= tg.first - eta - 600) {
            homeWarned = true; vib(500, 250, 500)
            sayK(L.t("HeadBack", (eta / 60 + 1).toInt()), "home", 4)
        }
    }

    /* ---------- καταγραφή ---------- */
    fun logCatch(kind: String) {
        var p = cur ?: realPos()
        val ts = nowS()
        val item = JSONObject().put("ts", ts).put("tz", Geo.tzMin()).put("k", kind)
        val cid = "c$ts" + String.format("%03d", System.currentTimeMillis() % 1000)
        item.put("cid", cid); afterCid = cid
        p?.let { item.put("lat", Geo.r5(it[0])).put("lon", Geo.r5(it[1])) }
        val tr = troll
        if (tr != null && kind == "fish" && trip.active) {
            val o = JSONObject().put("m", tr)
            trip.spd?.let { o.put("kn", Math.round(it * 10) / 10.0) }
            trip.lastHd?.let { o.put("hd", it.toInt()) }
            if (tr == "b") trLeads?.let { o.put("n", it) }
            if (tr == "b") bdNow?.let { b -> o.put("bd", Math.round(b * 10) / 10.0); trLeads?.let { o.put("cl", Math.round((b - it * faPerLead()) * 10) / 10.0) } }
            if (tr == "s") o.put("ln", lineNow())
            item.put("tr", o)
        }
        if (trip.active) { item.put("trip", trip.onCatch(kind)); if (kind == "fish") catchTs.add(ts) }
        Sender.add(item)
        if (tr == "s" && kind == "fish" && trip.active) lurePos(p, lineNow())?.let { p = it }
        p?.let { P.put("lastc", JSONArray().put(it[0]).put(it[1]).put(ts)) }
        vib(250)
        if (!P.linked()) { sayK(L.t("NoCode"), "x", 1); return }
        lastHm = Geo.tsHm(ts); lastQ = !Net.online(ctx); lastN = if (trip.active && kind == "fish") trip.n else 0
        msg = null; lastKind = kind
        val my = ++msgSeq
        h.postDelayed({ if (msgSeq == my) { lastKind = null; bump() } }, 4000)
        bump()
        Sender.flush { ok -> if (ok == null) h.post { sayK(L.t("NoCode"), "x", 1) } else bump() }
    }

    fun tripStart() {
        if (!hasLoc()) { sayK(L.t("PermLoc"), "pin", 7); return }
        trip.begin(); catchTs = ArrayList(); homeWarned = false
        vib(400); page = 1; pageReq = 1
        gpsUpdate()
        Health.start(ctx)
        sayK(L.t("TripStarted"), "play", 13)
    }
    fun tripEnd(save: Boolean) {
        troll = null; trLeads = null; drop = null
        val it = trip.finish(save)
        gpsUpdate()
        Health.stop(ctx, save)
        if (it != null) { Sender.add(it); Sender.flush(); sayK(L.t("TripSaved"), "stop", 13) }
        bump()
    }
    private fun onTick() {
        checkHome()
        if (troll != null && trip.active && page != 1 && System.currentTimeMillis() - pageAt > 60000) toTroll()
        if (trip.active) GpsService.refreshNote(ctx)
        bump()
    }
    fun goPage(p: Int) { if (p == page) return; page = p; pageAt = System.currentTimeMillis(); gpsUpdate(); bump() }

    /* ---------- δίχτυ / παραγάδι / κλουβί (AlkGear.mc) ---------- */
    fun gear(): JSONArray = P.arr("gear")
    private fun gearPut(g: JSONArray) = P.put("gear", g)
    fun gearType(t: String) = L.t(when (t) { "ll" -> "GearLl"; "trap" -> "GearTrap"; else -> "GearNet" })
    fun gearSetting(): JSONObject? { val g = gear(); for (i in 0 until g.length()) { val o = g.getJSONObject(i); if (o.optString("st") == "set") return o }; return null }
    fun gearOut(): List<JSONObject> { val g = gear(); return (0 until g.length()).map { g.getJSONObject(it) }.filter { it.optString("st") == "out" } }
    fun gearSub(): String {
        gearSetting()?.let { return L.t("GearSetting", it.optString("nm")) }
        val o = gearOut(); if (o.isNotEmpty()) return L.t("GearOut", o.size)
        return L.t("GearSub")
    }
    private fun gearPos(): JSONArray? {
        val p = cur ?: realPos()
        if (p == null) { gearWant = true; return null }
        return JSONArray().put(Geo.r5(p[0])).put(Geo.r5(p[1]))
    }
    private fun gearFix(lat: Double, lon: Double) {
        if (!gearWant) return
        gearWant = false
        val g = gear(); val p = JSONArray().put(Geo.r5(lat)).put(Geo.r5(lon)); var ch = false
        for (i in 0 until g.length()) { val o = g.getJSONObject(i)
            if (o.isNull("sa") || !o.has("sa")) { o.put("sa", p); ch = true }
            if ((o.isNull("sb") || !o.has("sb")) && o.optString("st") == "out") { o.put("sb", p); ch = true }
            if (o.has("h0") && (!o.has("ha") || o.isNull("ha"))) { o.put("ha", p); ch = true } }
        if (ch) gearPut(g)
    }
    private fun gearSend(it: JSONObject, n: Int?) {
        val item = JSONObject().put("ts", nowS()).put("tz", Geo.tzMin()).put("k", "gear").put("gid", it.optString("id")).put("gt", it.optString("t"))
            .put("gnm", it.optString("nm")).put("gst", if (it.optString("st") == "done") "done" else "out")
        for (k in listOf("s0", "s1", "sa", "sb", "h0", "h1", "ha", "hb")) if (it.has(k) && !it.isNull(k)) item.put(k, it.get(k))
        if (n != null) item.put("n", n)
        Sender.add(item); Sender.flush()
    }
    fun gearNew(t: String) {
        val now = nowS(); val g = gear()
        val seq = P.obj("gseq") ?: JSONObject(); val k = seq.optInt(t, 0) + 1; seq.put(t, k); P.put("gseq", seq)
        val p = gearPos(); val trap = t == "trap"
        val it = JSONObject().put("id", "g$now" + String.format("%03d", System.currentTimeMillis() % 1000)).put("t", t).put("nm", gearType(t) + " " + k)
            .put("st", if (trap) "out" else "set").put("s0", now).put("sa", p ?: JSONObject.NULL)
        if (trap) { it.put("s1", now); it.put("sb", p ?: JSONObject.NULL) }
        g.put(it); gearPut(g); gpsUpdate(); vib(250)
        if (trap) { gearSend(it, null); sayK(L.t("GearOutMsg", it.optString("nm")), "net", 12) }
        else sayK(L.t("GearSetMsg", it.optString("nm")), "down", 12)
    }
    fun gearEndSet() {
        val g = gear(); val now = nowS()
        for (i in 0 until g.length()) { val o = g.getJSONObject(i)
            if (o.optString("st") == "set") {
                o.put("st", "out"); o.put("s1", now); val p = gearPos(); o.put("sb", p ?: JSONObject.NULL)
                if (o.isNull("sa") || !o.has("sa")) o.put("sa", p ?: JSONObject.NULL)
                gearPut(g); gpsUpdate(); vib(250); gearSend(o, null)
                sayK(L.t("GearOutMsg", o.optString("nm")), "net", 12); return
            } }
    }
    fun gearHaulStart(gid: String) {
        val g = gear()
        for (i in 0 until g.length()) { val o = g.getJSONObject(i)
            if (o.optString("id") == gid) { o.put("h0", nowS()); o.put("ha", gearPos() ?: JSONObject.NULL); gearPut(g); gearHaul = true; gpsUpdate(); return } }
    }
    fun gearHaulCancel() { gearHaul = false; gpsUpdate() }
    fun gearHaulDone(gid: String, n: Int) {
        val g = gear(); val now = nowS(); val keep = JSONArray(); var done: JSONObject? = null
        for (i in 0 until g.length()) { val o = g.getJSONObject(i)
            if (o.optString("id") == gid) {
                done = o; o.put("st", "done"); o.put("h1", now)
                val p = gearPos(); o.put("hb", p ?: o.opt("ha") ?: JSONObject.NULL)
                if (!o.has("ha") || o.isNull("ha")) o.put("ha", o.opt("hb"))
                if (!o.has("h0")) o.put("h0", now)
            } else keep.put(o) }
        gearHaul = false
        val d = done ?: run { gpsUpdate(); return }
        gearPut(keep); gearSend(d, n); gpsUpdate(); vib(250)
        val t0 = if (d.has("s1") && !d.isNull("s1")) d.optLong("s1") else d.optLong("s0")
        sayK(L.t("GearDoneMsg", d.optString("nm"), n, Geo.hms(d.optLong("h0") - t0)), "fish", 2)
    }
    fun gearItem(gid: String): JSONObject? { val g = gear(); for (i in 0 until g.length()) { val o = g.getJSONObject(i); if (o.optString("id") == gid) return o }; return null }
}

object Net {
    fun online(c: Context): Boolean = try {
        val cm = c.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        cm.activeNetwork != null
    } catch (e: Exception) { true }
}
