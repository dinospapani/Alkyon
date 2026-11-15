// Alkyon για Wear OS: οι 6 σελίδες (όπως στο Garmin) και οι οθόνες πάνω τους (μήνυμα, «Καταγράφηκε», μετά το ψάρι, άγκυρα).
package com.alkyonfishing.app.wear.ui

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alkyonfishing.app.wear.Baro
import com.alkyonfishing.app.wear.Engine
import com.alkyonfishing.app.wear.Geo
import com.alkyonfishing.app.wear.L
import com.alkyonfishing.app.wear.P
import com.alkyonfishing.app.wear.Sender
import com.alkyonfishing.app.wear.nowS
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min

private val E = Engine

@Composable
fun Page(i: Int, open: (String) -> Unit) {
    val f = E.fc
    if (f == null && i != 1 && i != 2) { NoData(); return }
    when (i) {
        0 -> Today(f!!)
        1 -> TripPage(open)
        2 -> SpotPage(open)
        3 -> Days(f!!)
        4 -> Press(f!!)
        else -> Squid(f!!)
    }
}

@Composable
fun NoData() = Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        T("ALKYON", 13.sp, pc(0), bold = true)
        Spacer(Modifier.height(8.dp))
        T(if (E.loading) L.t("Loading") else L.t("NoData"), 14.sp, pc(6), lines = 4)
    }
}

/** μικρή ένδειξη εξόδου πάνω, όταν η έξοδος τρέχει και βλέπεις άλλη σελίδα */
@Composable
fun TripBadge() { if (E.trip.active) T("● " + Geo.hms(E.trip.secs()) + " · " + E.trip.n, 12.sp, pc(1), bold = true) }

/* ---------- 0 · Σήμερα: δαχτυλίδι 24 ωρών ---------- */
@Composable
fun Today(f: JSONObject) {
    val days = f.optJSONArray("days") ?: return
    if (days.length() == 0) { NoData(); return }
    var d = days.getJSONObject(0); var isToday = true
    if (d.isNull("s") && days.length() > 1) { d = days.getJSONObject(1); isToday = false }
    val t = if (isToday) f.optJSONObject("td") else (f.optJSONObject("t2") ?: f.optJSONObject("td"))
    val nm = Geo.nowMin(); val ch = if (isToday) nm / 60 else -1
    Box(Modifier.fillMaxSize()) {
        Ring {
            val w = size.minDimension * 0.045f
            arc(0f, 360f, pc(8), w)
            val h = t?.optJSONArray("h")
            if (t != null && h != null) {
                val r = E.nint(t, "r"); val st = E.nint(t, "st"); val ws = E.nint(t, "ws"); val we = E.nint(t, "we")
                for (k in 0 until min(24, h.length())) {
                    val sc = if (h.isNull(k)) -1 else h.optInt(k)
                    val ngt = r != null && st != null && (k * 60 + 30 < r - 60 || k * 60 + 30 > st + 60)
                    if (ngt || sc < 50) continue
                    val best = ws != null && we != null && k in ws..we
                    val c = scoreCol(sc)
                    arc(k * 15 + 0.8f, (k + 1) * 15 - 0.8f, if (k + 1 <= ch) pc(15) else if (best) c else c.copy(alpha = 0.8f), w)
                }
                if (ws != null && we != null) arc(ws * 15 + 1f, (we + 1) * 15 - 1f, if (we + 1 <= ch) pc(15) else pc(2), w * 1.6f)
                // ηλιοσεληνιακές περίοδοι
                listOf("ma" to 4f, "mi" to 2.5f).forEach { (k, rr) -> t.optJSONArray(k)?.let { a -> for (q in 0 until a.length()) {
                    val p = pol(size.minDimension / 2 - w / 2, a.optInt(q) / 4f); drawCircle(Color.Black, rr * 1.6f + 2f, p); drawCircle(pc(10), rr * 1.6f, p) } } }
                // ανατολή / δύση
                listOf(r, st).forEach { m -> if (m != null) drawCircle(pc(6), 3f, pol(size.minDimension / 2 - w * 2.2f, m / 4f)) }
                if (isToday) { val p = pol(size.minDimension / 2 - w / 2, nm / 4f); drawCircle(pc(5).copy(alpha = 0.2f), w * 1.3f, p); drawCircle(pc(5), w * 0.7f, p) }
            }
        }
        Column(Modifier.fillMaxSize().padding(horizontal = 26.dp, vertical = 22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            TripBadge()
            Title(if (isToday) L.up(L.t("TodayU")) else L.up(L.t("TmrU")) + " · " + d.optString("n"), pc(0))
            if (!isToday && !E.dayOver()) T(L.t("TodayWind"), 11.sp, pc(1))
            if (d.isNull("s")) T(L.t("Unsafe"), 22.sp, pc(1), bold = true)
            else Row(verticalAlignment = Alignment.Bottom) { T(d.optInt("s").toString(), 50.sp, pc(5)); T("/100", 12.sp, pc(6), modifier = Modifier.padding(bottom = 10.dp)) }
            val w0 = d.optString("w", "")
            if (w0.isNotEmpty()) {
                var line = w0; var tc = pc(0)
                val ws = E.nint(t, "ws"); val we = E.nint(t, "we")
                if (!isToday && ws != null) { val lm = 1440 - nm + ws * 60; line += " · " + L.t("BestIn", "${lm / 60}:" + String.format("%02d", lm % 60)) }
                else if (isToday && ws != null && we != null) {
                    val s0 = ws * 60; val e0 = (we + 1) * 60
                    when { nm < s0 -> { val lm = s0 - nm; line += " · " + L.t("BestIn", "${lm / 60}:" + String.format("%02d", lm % 60)) }
                           nm < e0 -> { line += " · " + L.t("BestNow"); tc = pc(2) }
                           else -> { line += " · " + L.t("BestPast"); tc = pc(7) } }
                }
                Chip2(line, tc)
            }
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Stat("wind", if (d.isNull("b")) "-" else "${d.optInt("b")} Bft")
                Stat("wave", if (d.isNull("v")) "-" else L.f1(d.optDouble("v")) + " m")
                val r = E.nint(t, "r"); val st = E.nint(t, "st")
                if (r != null && st != null) { val before = nm < st && nm >= r; Stat(if (before) "set" else "rise", Geo.minHm(if (before) st else r)) }
            }
            val qn = Sender.size()
            if (qn > 0) T("↑ " + L.t("QShort", qn), 11.sp, pc(7))
        }
    }
}

/* ---------- 1 · Έξοδος / συρτή ---------- */
@Composable
fun TripPage(open: (String) -> Unit) {
    when {
        !E.trip.active -> TripIdle()
        E.troll == "b" && E.drop != null -> DropPage()
        E.troll == "b" -> TrollB(open)
        E.troll == "s" -> TrollS()
        else -> TripLive()
    }
}

@Composable
fun TripIdle() {
    val f = E.fc
    var qD: JSONObject? = null; var tmr = false
    f?.optJSONArray("days")?.let { a -> if (a.length() > 0) { qD = a.getJSONObject(0); if (qD!!.isNull("s") && a.length() > 1) { qD = a.getJSONObject(1); tmr = true } } }
    val sc = qD?.let { if (it.isNull("s")) null else it.optInt("s") }
    Box(Modifier.fillMaxSize()) {
        Ring { val w = size.minDimension * 0.045f; arc(0f, 360f, pc(8), w); if (sc != null) arc(0f, 3.6f * sc, scoreCol(sc), w, cap = StrokeCap.Round) }
        Column(Modifier.fillMaxSize().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Title(L.up(L.t("TripPageU")), pc(13))
            qD?.let { d -> T((if (tmr) d.optString("n") else L.t("TodayC")) + (d.optString("w", "").let { if (it.isNotEmpty()) " · $it" else "" }), 12.sp, if (sc != null) scoreCol(sc) else pc(6)) }
            if (qD != null && sc == null) T(L.t("Unsafe"), 18.sp, pc(1), bold = true)
            else if (sc != null) Row(verticalAlignment = Alignment.Bottom) { T("$sc", 34.sp, pc(5)); T("/100", 11.sp, pc(6), modifier = Modifier.padding(bottom = 6.dp)) }
            Spacer(Modifier.height(4.dp))
            Box(Modifier.background(hx(0xFF6B5A), RoundedCornerShape(50)).clickable { E.tripStart() }.padding(horizontal = 16.dp, vertical = 8.dp)) {
                T("▶ " + L.t("TripStart"), 14.sp, Color.Black, bold = true)
            }
            Spacer(Modifier.height(6.dp))
            val now = f?.optJSONObject("now"); val sq = f?.optJSONObject("sq")
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (now != null && !now.isNull("p")) {
                    val pd = E.ndbl(now, "pd")
                    Stat("gauge", "${now.optDouble("p").toInt()}" + (if (pd == null) "" else if (pd > 0.4) "↑" else if (pd < -0.4) "↓" else "→"))
                    E.ndbl(now, "wt")?.let { Stat("temp", L.f0(it) + "°") }
                    E.nint(sq, "il")?.let { Stat("moon", "$it%") }
                } else qD?.let { d ->
                    Stat("wind", if (d.isNull("b")) "-" else "${d.optInt("b")} Bft"); Stat("wave", if (d.isNull("v")) "-" else L.f1(d.optDouble("v")) + " m")
                }
            }
        }
    }
}

@Composable
private fun TargetRing(col: Color) {
    val tg = E.tripTarget()
    Ring {
        val w = size.minDimension * 0.045f
        arc(0f, 360f, pc(8), w)
        if (tg != null) { val fr = ((nowS() - E.trip.start).toFloat() / max(1L, tg.first - E.trip.start)).coerceIn(0f, 1f); arc(0f, 360f * fr, col, w, cap = StrokeCap.Round) }
        // ψάρια πάνω στο δαχτυλίδι
        if (tg != null) E.catchTs.forEach { ts -> val fr = ((ts - E.trip.start).toFloat() / max(1L, tg.first - E.trip.start)).coerceIn(0f, 1f)
            val p = pol(size.minDimension / 2 - w / 2, 360f * fr); drawCircle(Color.Black, w * 0.9f, p); drawCircle(pc(2), w * 0.6f, p) }
    }
}

@Composable
private fun TimeLine() {
    val tg = E.tripTarget(); val a = E.anchor
    if (a != null) { val bad = E.anchorD > E.anchorR(); Chip2(L.t("AnchorLine", E.anchorD.toInt(), E.anchorR()), if (bad) pc(1) else pc(6), bad) }
    else if (tg != null) { val left = tg.first - nowS(); if (left > 0) Chip2(L.t(if (tg.second) "BackIn" else "SunsetIn", Geo.hms(left)), pc(0)) else Chip2(L.t("Late"), pc(1), true) }
    else Chip2(L.t("ClockNow", Geo.minHm(Geo.nowMin())), pc(6))
}

@Composable
fun FishBtn(d: androidx.compose.ui.unit.Dp = 46.dp) = Box(Modifier.size(d).background(pc(2), CircleShape).clickable { E.quickFish() }, contentAlignment = Alignment.Center) {
    T("🐟", (d.value * 0.45f).sp, Color.Black)
}

@Composable
fun TripLive() {
    Box(Modifier.fillMaxSize()) {
        TargetRing(pc(13))
        Column(Modifier.fillMaxSize().padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Title(L.up(L.t("TripPageU")) + if (E.trip.hasFix()) " · GPS" else "", pc(13))
            T(Geo.hms(E.trip.secs()), 40.sp, pc(5))
            TimeLine()
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Stat("fish", "${E.trip.n}", pc(2)); Stat("path", L.f1(E.trip.km) + " km")
                Stat("speed", E.trip.spd?.let { L.f1(it) + " kn" } ?: "-")
            }
            if (E.catchTs.isNotEmpty()) T(L.t("LastAgo", (nowS() - E.catchTs.last()) / 60), 11.sp, pc(6))
            Spacer(Modifier.height(4.dp))
            FishBtn(40.dp)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SideBtn(t: String, col: Color, onLong: (() -> Unit)? = null, on: () -> Unit) {
    Box(Modifier.size(40.dp).background(col.copy(alpha = 0.18f), CircleShape).combinedClickable(onClick = on, onLongClick = onLong), contentAlignment = Alignment.Center) {
        T(t, 15.sp, col, bold = true)
    }
}

@Composable
fun DropPage() {
    val rem = (E.dropAt + (E.dropN * E.secPerLead()).toLong() - nowS())
    Box(Modifier.fillMaxSize()) {
        Ring { val w = size.minDimension * 0.045f; arc(0f, 360f, pc(8), w)
            val fr = (1f - rem.toFloat() / max(1.0, E.dropN * E.secPerLead()).toFloat()).coerceIn(0f, 1f); arc(0f, 360f * fr, pc(4), w, cap = StrokeCap.Round) }
        Column(Modifier.fillMaxSize().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Title(L.up(L.t("DropT")), pc(4)); T(L.up(L.t("DropU")), 11.sp, pc(6))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SideBtn("−1", pc(6)) { E.keyLeads(-1) }
                Column(horizontalAlignment = Alignment.CenterHorizontally) { T("${E.dropN}", 44.sp, pc(4)); T(L.t("LeadsL"), 11.sp, pc(6)) }
                SideBtn("+1", pc(6)) { E.keyLeads(1) }
            }
            if (rem > 0) T("↓ " + L.t("ToBottomIn", "${rem / 60}:" + String.format("%02d", rem % 60)), 12.sp, pc(4)) else Chip2(L.t("AtBottomQ"), pc(2))
            Spacer(Modifier.height(4.dp))
            Box(Modifier.size(40.dp).background(pc(2), CircleShape).clickable { E.dropSet() }, contentAlignment = Alignment.Center) { T("✓", 20.sp, Color.Black, bold = true) }
        }
    }
}

@Composable
fun TrollB(open: (String) -> Unit) {
    val sp = E.trip.spd
    val col = if (sp == null) pc(6) else if (sp < E.trMin() || sp > E.trMax()) pc(4) else pc(2)
    val cnow = E.clrNow()
    val low = cnow != null && cnow < E.clrFa() * 0.66
    Box(Modifier.fillMaxSize()) {
        TargetRing(pc(12))
        Column(Modifier.fillMaxSize().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Title(L.up(L.t("TrollBU")) + " · " + Geo.hms(E.trip.secs()), pc(12))
            T((sp?.let { L.f1(it) } ?: "-") + " kn", 13.sp, col, bold = true)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SideBtn("−1", pc(6), onLong = { E.dropTouched() }) { if (!E.keyAct(-1)) E.leadsAdd(-1) }
                Column(horizontalAlignment = Alignment.CenterHorizontally) { T(E.trLeads?.toString() ?: "-", 42.sp, if (low) pc(1) else pc(5)); T(L.t("LeadsL"), 11.sp, pc(6)) }
                SideBtn("+1", pc(6)) { if (!E.keyAct(1)) E.leadsAdd(1) }
            }
            when {
                cnow != null && E.adv < 0 -> Chip2(L.t("AdvUpU", -E.adv) + if (cnow < 0) " · " + L.t("DragU") else "", pc(1), true)
                cnow != null && E.adv > 0 -> Chip2(L.t("AdvDnU", E.adv), pc(3))
                cnow != null -> Chip2(L.t("AdvOk") + " · " + E.clrTxt(cnow) + " " + L.t("FmU"), pc(2))
                else -> Chip2(L.t(if (E.trLeads == null) "DropHint" else if (E.gridBusy) "ChartLoad" else "NoChart"), pc(7))
            }
            val bits = ArrayList<String>()
            E.bdNow?.let { bits.add(L.t("SeabedL", L.f0(it))) }; E.bdAhead?.let { bits.add(L.t("Ahead", L.f0(it))) }
            if (bits.isNotEmpty()) T(bits.joinToString(" · "), 11.sp, pc(11))
            Spacer(Modifier.height(3.dp))
            FishBtn(40.dp)
        }
    }
}

@Composable
fun TrollS() {
    val sp = E.trip.spd
    val col = if (sp == null) pc(6) else if (sp < E.trMin() || sp > E.trMax()) pc(4) else pc(2)
    val st = E.lineStep()
    Box(Modifier.fillMaxSize()) {
        TargetRing(pc(12))
        Column(Modifier.fillMaxSize().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Title(L.up(L.t("TrollSU")) + " · " + Geo.hms(E.trip.secs()), pc(12))
            T(sp?.let { L.f1(it) } ?: "-", 40.sp, col); T(L.t("KnotsL") + " · " + L.f1(E.trMin()) + "–" + L.f1(E.trMax()), 11.sp, pc(6))
            // μπάρα ταχύτητας
            Ring(Modifier.fillMaxWidth(0.7f).height(8.dp)) {
                val lo = 0.0; val hi = E.trMax() * 1.6
                fun x(v: Double) = (((v - lo) / (hi - lo)).coerceIn(0.0, 1.0) * size.width).toFloat()
                drawRoundRect(pc(8), size = size, cornerRadius = androidx.compose.ui.geometry.CornerRadius(8f))
                drawRect(pc(2).copy(alpha = 0.5f), topLeft = Offset(x(E.trMin()), 0f), size = androidx.compose.ui.geometry.Size(x(E.trMax()) - x(E.trMin()), size.height))
                if (sp != null) drawCircle(pc(5), size.height * 0.8f, Offset(x(sp), size.height / 2))
            }
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SideBtn("−$st", pc(6)) { E.lineAdd(-st) }
                Column(horizontalAlignment = Alignment.CenterHorizontally) { T("${E.lineNow()} m", 16.sp, pc(0), bold = true); T("🐟 ${E.trip.n} · " + L.f1(E.trip.km) + " km", 11.sp, pc(6)) }
                SideBtn("+$st", pc(6)) { E.lineAdd(st) }
            }
            Spacer(Modifier.height(3.dp))
            FishBtn(40.dp)
        }
    }
}

/* ---------- 2 · Σημείο: βέλος, απόσταση, χρόνος ---------- */
@Composable
fun SpotPage(open: (String) -> Unit) {
    val ctx = LocalContext.current
    DisposableEffect(Unit) {
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val s = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        val rm = FloatArray(9); val o = FloatArray(3)
        val l = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) { SensorManager.getRotationMatrixFromVector(rm, e.values); SensorManager.getOrientation(rm, o)
                var a = Math.toDegrees(o[0].toDouble()); if (a < 0) a += 360.0
                val old = E.compass; if (old == null || abs(old - a) > 2) { E.compass = a; E.bump() } }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        if (s != null) sm.registerListener(l, s, SensorManager.SENSOR_DELAY_UI)
        onDispose { sm.unregisterListener(l); E.compass = null }
    }
    val ts = E.targets(); val c = E.cur
    Box(Modifier.fillMaxSize().clickable { open("nav") }) {
        if (ts.isEmpty()) { Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) { T(L.t("NoSpot"), 13.sp, pc(6), lines = 4) }; return@Box }
        val i = E.navT.coerceIn(0, ts.size - 1); val t = ts[i]
        val hd = E.heading()
        val br = if (c != null) Geo.bearing(c[0], c[1], t.lat, t.lon) else null
        val dm = if (c != null) Geo.dist(c[0], c[1], t.lat, t.lon) * 1000 else null
        Ring {
            val w = size.minDimension * 0.03f
            arc(0f, 360f, pc(8), w)
            val north = -(hd ?: 0.0).toFloat()
            // ενδείξεις πυξίδας ανά 30°
            for (k in 0 until 12) { val a = north + k * 30; drawCircle(if (k == 0) pc(1) else pc(15), if (k == 0) 4f else 2f, pol(size.minDimension / 2 - w * 2.5f, a)) }
            if (br != null) {
                val a = (br - (hd ?: 0.0)).toFloat()
                rotate(a) {
                    val r = size.minDimension * 0.30f
                    val p = Path().apply { moveTo(center.x, center.y - r); lineTo(center.x + r * 0.28f, center.y - r * 0.45f); lineTo(center.x - r * 0.28f, center.y - r * 0.45f); close() }
                    drawPath(p, pc(0))
                }
                arc(a - 6, a + 6, pc(0), w * 2)
            }
        }
        Column(Modifier.fillMaxSize().padding(26.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Spacer(Modifier.height(30.dp))
            Title(L.up(L.t("SpotU")) + " ${i + 1}/${ts.size}", pc(0))
            T(t.name, 14.sp, pc(5), bold = true)
            if (c == null) T(L.t("WaitGps"), 12.sp, pc(7))
            else {
                T(Geo.distTxt(dm!!), 26.sp, pc(5))
                val sp = E.trip.spd?.takeIf { it > 2 } ?: P.d("boatKn")
                val min = (dm / 1852.0) / sp * 60
                T("${br!!.toInt()}° · ~${min.toInt()}′ · " + L.f1(sp) + " kn", 11.sp, pc(6))
            }
            T(L.t("NavHint"), 10.sp, pc(7))
        }
    }
}

/* ---------- 3 · Επόμενες μέρες ---------- */
@Composable
fun Days(f: JSONObject) {
    val days = f.optJSONArray("days") ?: return
    Column(Modifier.fillMaxSize().padding(horizontal = 22.dp, vertical = 26.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Title(L.up(L.t("DaysU")), pc(2))
        Spacer(Modifier.height(4.dp))
        for (k in 0 until min(6, days.length())) {
            val d = days.getJSONObject(k); val s = if (d.isNull("s")) null else d.optInt("s")
            val night = k == 0 && E.dayOver()
            Row(Modifier.fillMaxWidth().padding(vertical = 1.dp), verticalAlignment = Alignment.CenterVertically) {
                T(d.optString("n"), 12.sp, pc(6), modifier = Modifier.width(52.dp), align = TextAlign.Start)
                Box(Modifier.width(30.dp).background((if (s == null) pc(15) else scoreCol(s)).copy(alpha = 0.22f), RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                    T(s?.toString() ?: "–", 12.sp, if (s == null) pc(7) else scoreCol(s), bold = true) }
                Spacer(Modifier.width(6.dp))
                T(if (night) L.t("NightL") else d.optString("w", ""), 12.sp, pc(5), modifier = Modifier.width(42.dp), align = TextAlign.Start)
                T(if (d.isNull("b")) "-" else "${d.optInt("b")}", 12.sp, if (d.optInt("x") == 1) pc(1) else pc(6), modifier = Modifier.width(16.dp))
                T(if (d.isNull("v")) "" else L.f1(d.optDouble("v")), 11.sp, pc(7))
            }
        }
        T(glyph("wind") + " Bft · " + glyph("wave") + " m", 10.sp, pc(7))
    }
}

/* ---------- 4 · Πίεση: βαρόμετρο του ρολογιού και πρόγνωση 12 ωρών ---------- */
@Composable
fun Press(f: JSONObject) {
    val ctx = LocalContext.current
    val d3 = Baro.d3()
    val hrs = f.optJSONArray("hrs")
    val ps = ArrayList<Double>(); if (hrs != null) for (k in 0 until hrs.length()) { val o = hrs.getJSONObject(k); if (!o.isNull("p")) ps.add(o.optDouble("p")) }
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 26.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Title(L.up(L.t("PressU")), pc(14))
        val now = f.optJSONObject("now")
        T(if (now != null && !now.isNull("p")) "${now.optDouble("p").toInt()} hPa" else "-", 26.sp, pc(5))
        if (d3 != null) T(L.t("PressWatch") + ": " + (if (d3.first >= 0) "+" else "") + L.f1(d3.first), 11.sp, if (abs(d3.first) >= P.d("pressThr")) pc(1) else pc(6))
        else if (!Baro.has(ctx)) T(L.t("NoBaro"), 10.sp, pc(7))
        f.optJSONObject("pr")?.let { pr -> val dd = pr.optDouble("d"); T((if (dd >= 0) L.t("PeakAt") else L.t("LowAt")) + " " + pr.optString("t") + " · " + pr.optInt("to") + " hPa", 12.sp, pc(14), bold = true) }
        if (ps.size >= 2) {
            Spacer(Modifier.height(4.dp))
            Ring(Modifier.fillMaxWidth(0.85f).height(46.dp)) {
                val lo = ps.min() - 0.5; val hi = ps.max() + 0.5
                val path = Path()
                ps.forEachIndexed { k, v -> val x = size.width * k / (ps.size - 1); val y = size.height * (1 - ((v - lo) / (hi - lo)).toFloat()); if (k == 0) path.moveTo(x, y) else path.lineTo(x, y) }
                drawPath(path, pc(14), style = Stroke(3f, cap = StrokeCap.Round))
                f.optJSONArray("tn")?.let { tn -> for (k in 0 until tn.length()) { val e = tn.getJSONObject(k); val hh = (e.optLong("ts") - nowS()) / 3600.0
                    if (hh in 0.0..(ps.size - 1).toDouble()) { val x = (size.width * hh / (ps.size - 1)).toFloat(); val y = size.height * (1 - ((e.optDouble("p") - lo) / (hi - lo)).toFloat())
                        drawCircle(if (e.optString("k") == "peak") pc(1) else pc(11), 5f, Offset(x, y.coerceIn(0f, size.height))) } } }
            }
            T(L.t("PressFcH", ps.size), 10.sp, pc(7))
        }
        f.optJSONArray("tn")?.let { tn -> for (k in 0 until min(2, tn.length())) { val e = tn.getJSONObject(k)
            T((if (e.optString("k") == "peak") L.t("Peak") else L.t("Low")) + " · " + e.optString("t"), 11.sp, pc(6)) } }
    }
}

/* ---------- 5 · Καλαμάρι ---------- */
@Composable
fun Squid(f: JSONObject) {
    val sq = f.optJSONObject("sq")
    if (sq == null) { Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) { T(L.t("SquidOld"), 13.sp, pc(6), lines = 3) }; return }
    val il = E.nint(sq, "il"); val nd = E.ndbl(sq, "nd"); val dk = sq.optJSONArray("dk"); val wax = sq.optInt("wx", 0) == 1
    val nm = Geo.nowMin(); val td = f.optJSONObject("td"); val st = E.nint(td, "st"); val r = E.nint(td, "r")
    val verdict: Pair<String, Color> = when {
        dk != null && dk.optInt(2) == 1 && (il ?: 100) < 40 -> L.t("VIdeal") to pc(2)
        dk != null -> L.t("VGoodTill", Geo.minHm(dk.optInt(1))) to pc(3)
        else -> L.t("VBright") to pc(7)
    }
    Box(Modifier.fillMaxSize()) {
        Ring {
            val w = size.minDimension * 0.045f
            arc(0f, 360f, pc(8), w)
            if (dk != null) { val a0 = dk.optInt(0) / 4f; var a1 = dk.optInt(1) / 4f; if (a1 < a0) a1 += 360f; arc(a0, a1, pc(2), w) }
            if (st != null) drawCircle(pc(4), 4f, pol(size.minDimension / 2 - w / 2, st / 4f))
            if (r != null) drawCircle(pc(0), 4f, pol(size.minDimension / 2 - w / 2, r / 4f))
            val p = pol(size.minDimension / 2 - w / 2, nm / 4f); drawCircle(pc(5), w * 0.7f, p)
        }
        Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Title(L.up(L.t("SquidU")), pc(10))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Ring(Modifier.size(30.dp)) {   // φάση φεγγαριού
                    drawCircle(pc(15), size.minDimension / 2)
                    val fr = (il ?: 0) / 100f
                    val cx = center.x + (if (wax) 1 else -1) * size.minDimension / 2 * (1 - fr) * 2 * 0.5f
                    drawCircle(pc(10), size.minDimension / 2 * fr.coerceAtLeast(0.05f), Offset(cx.coerceIn(0f, size.width), center.y))
                }
                Spacer(Modifier.width(6.dp))
                Column {
                    T("${il ?: "-"}% · " + L.t(when { (il ?: 0) < 6 -> "PhNew"; (il ?: 0) > 94 -> "PhFull"; wax -> "PhWax"; else -> "PhWane" }), 12.sp, pc(5), align = TextAlign.Start)
                    T(if (nd == null) "" else if (abs(nd) < 0.6) L.t("SubNow") else if (nd < 0) L.t("SubAgo", L.f0(-nd)) else L.t("SubIn", L.f0(nd)), 11.sp, pc(6), align = TextAlign.Start)
                }
            }
            Spacer(Modifier.height(3.dp))
            Chip2(verdict.first, verdict.second)
            if (dk != null) T(if (dk.optInt(2) == 1) L.t("TillMorning", Geo.minHm(dk.optInt(0))) else L.t("DarkWin", Geo.minHm(dk.optInt(0)), Geo.minHm(dk.optInt(1))), 11.sp, pc(6))
            Spacer(Modifier.height(3.dp))
            sq.optJSONArray("ev")?.let { ev -> for (k in 0 until min(3, ev.length())) { val e = ev.getJSONObject(k)
                Row(verticalAlignment = Alignment.CenterVertically) { T(e.optString("n"), 12.sp, if (k == 0) pc(5) else pc(6), modifier = Modifier.width(56.dp), align = TextAlign.Start)
                    T(String.format("%02d", e.optInt("h")) + ":00", 12.sp, pc(6), modifier = Modifier.width(40.dp)); T("${e.optInt("s")}", 12.sp, scoreCol(e.optInt("s")), bold = true) } } }
        }
    }
}

/* ---------- οθόνες πάνω από τις σελίδες ---------- */
@Composable
fun MsgOverlay() {
    val m = E.msg ?: return
    val col = pc(m.ci.coerceIn(0, 15))
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.92f)).clickable { E.msgEnd() }, contentAlignment = Alignment.Center) {
        Ring { arc(0f, 360f, col, size.minDimension * 0.035f) }
        Column(Modifier.padding(26.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (m.icon != null) { Dot(m.icon, col, 44.dp); Spacer(Modifier.height(8.dp)) }
            T(m.text, 15.sp, pc(5), lines = 5)
        }
    }
}

@Composable
fun SavedOverlay() {
    val k = E.lastKind ?: return
    val col = when (k) { "miss" -> pc(1); "pest" -> pc(3); else -> pc(2) }
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.94f)).clickable { E.msgEnd() }, contentAlignment = Alignment.Center) {
        Ring { arc(0f, 360f, col, size.minDimension * 0.035f) }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Dot("check", col, 50.dp)
            Spacer(Modifier.height(8.dp))
            T(when (k) { "miss" -> L.t("Lost"); "pest" -> L.t("Pest"); else -> L.t("Fish") } + " · " + E.lastHm, 16.sp, pc(5), bold = true)
            if (E.lastN > 0) T(L.t("NthFish", E.lastN), 12.sp, pc(6))
            T(if (E.lastQ) L.t("QueuedShort") else L.t("Saved"), 12.sp, if (E.lastQ) pc(4) else pc(6), lines = 2)
        }
    }
}

/** 6″ μετά το ψάρι: αναίρεση / χάθηκε / είδος (BACK / UP / DOWN του Garmin) */
@Composable
fun AfterOverlay(open: (String) -> Unit) {
    if (!E.afterOn) return
    val left = (6000 - (System.currentTimeMillis() - E.afterAt)).coerceAtLeast(0)
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.95f)), contentAlignment = Alignment.Center) {
        Ring { arc(0f, 360f, pc(8), size.minDimension * 0.04f); arc(0f, 359.5f * left / 6000f, pc(2), size.minDimension * 0.04f) }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(50.dp).background(pc(2), CircleShape).clickable { E.quickFish() }, contentAlignment = Alignment.Center) { T("✓", 24.sp, Color(0xFF06261A), bold = true) }
            Spacer(Modifier.height(4.dp))
            T(L.t("FishN", E.trip.n) + " · " + E.lastHm, 15.sp, pc(5), bold = true)
            if (E.troll == "b" && E.trLeads != null) T("${E.trLeads} " + L.t("LeadsL"), 11.sp, pc(6))
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Act(L.t("KUndo"), pc(6)) { E.afterUndo() }
                Act(L.t("KLost"), pc(1)) { E.afterLost() }
                Act(L.t("KSp"), pc(0)) { E.afterStop(); if (E.speciesList().isEmpty()) E.sayK(L.t("NoSp"), "fish", 7) else open("species"); E.bump() }
            }
        }
    }
}

@Composable
fun Act(t: String, col: Color, on: () -> Unit) = Box(Modifier.background(col.copy(alpha = 0.18f), RoundedCornerShape(50)).clickable(onClick = on).padding(horizontal = 8.dp, vertical = 6.dp)) {
    T(t, 11.sp, col, bold = true)
}

@Composable
fun AnchorAlarm() {
    if (!E.anchorAlarm) return
    Box(Modifier.fillMaxSize().background(Color(0xFF2A0B08)).clickable { E.anchorOff() }, contentAlignment = Alignment.Center) {
        Ring { arc(0f, 360f, pc(1), size.minDimension * 0.06f) }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            T("⚓ " + L.up(L.t("AnchorU")), 14.sp, pc(1), bold = true)
            T(L.t("Drag", E.anchorD.toInt()), 22.sp, Color.White, bold = true)
            Spacer(Modifier.height(8.dp))
            Chip2(L.t("StopAlarm"), pc(1), true)
        }
    }
}

@Composable
fun Welcome() {
    if (!E.welcome) return
    Box(Modifier.fillMaxSize().background(Color.Black).clickable { E.welcomeOk() }, contentAlignment = Alignment.Center) {
        Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            T(L.t("WelHi"), 18.sp, pc(0), bold = true)
            Spacer(Modifier.height(6.dp))
            T(L.t("WelL1"), 12.sp, pc(5), lines = 2); T(L.t("WelL2"), 12.sp, pc(6), lines = 2)
            T(L.t("WelL3"), 12.sp, pc(0), lines = 2); T(L.t("WelL4"), 11.sp, pc(6), lines = 2)
            Spacer(Modifier.height(6.dp)); Chip2(L.t("Ok"), pc(2))
        }
    }
}

/** τελείες σελίδων δεξιά (κάθετες, όπως οι σελίδες) */
@Composable
fun PageDots(cur: Int) = Column(Modifier.fillMaxSize().padding(end = 5.dp), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.Center) {
    for (k in 0 until 6) Box(Modifier.padding(vertical = 2.dp).size(if (k == cur) 6.dp else 4.dp).background(if (k == cur) pc(5) else pc(15), CircleShape))
}
