// Alkyon για Wear OS: μενού (καταγραφή, συρτή, εργαλεία, στόχος, είδος), τροχός βάθους, μέτρημα ψαριών, «Τέλος εξόδου;», ρυθμίσεις.
package com.alkyonfishing.app.wear.ui

import android.app.RemoteInput
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.Switch
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.ToggleChip
import androidx.wear.input.RemoteInputIntentHelper
import com.alkyonfishing.app.wear.AlertWorker
import com.alkyonfishing.app.wear.Engine
import com.alkyonfishing.app.wear.Geo
import com.alkyonfishing.app.wear.L
import com.alkyonfishing.app.wear.P
import com.alkyonfishing.app.wear.Sender
import com.alkyonfishing.app.wear.nowS
import kotlin.math.abs

private val E = Engine
private val TILE = Color(0xFF141922)

@Composable
fun MenuList(title: String, col: Color, content: ScalingLazyListScope.() -> Unit) {
    E.ver
    val st = rememberScalingLazyListState()
    ScalingLazyColumn(state = st, modifier = Modifier.fillMaxSize().background(Color.Black), horizontalAlignment = Alignment.CenterHorizontally) {
        item { ListHeader { T(L.up(title), 13.sp, col, bold = true) } }
        content()
    }
}

@Composable
fun Item(label: String, sub: String?, ic: String?, col: Color, on: () -> Unit) {
    val icon: @Composable () -> Unit = { Box(Modifier.size(26.dp).background(col.copy(alpha = 0.18f), CircleShape), contentAlignment = Alignment.Center) { T(glyph(ic).ifEmpty { "•" }, 14.sp, col, bold = true) } }
    if (sub == null) Chip(onClick = on, label = { Text(label, maxLines = 2, fontSize = 14.sp) }, icon = { icon() },
        colors = ChipDefaults.chipColors(backgroundColor = TILE, contentColor = pc(5)), modifier = Modifier.fillMaxWidth())
    else Chip(onClick = on, label = { Text(label, maxLines = 2, fontSize = 14.sp) }, secondaryLabel = { Text(sub, maxLines = 2, fontSize = 11.sp, color = pc(6)) }, icon = { icon() },
        colors = ChipDefaults.chipColors(backgroundColor = TILE, contentColor = pc(5)), modifier = Modifier.fillMaxWidth())
}

private fun NavHostController.go(r: String) { popBackStack(); navigate(r) }

/* ---------- μενού καταγραφής (START / πάτημα στο Garmin) ---------- */
@Composable
fun LogMenu(nav: NavHostController) {
    E.afterStop()
    MenuList(L.t("Log"), hx(0x3DDC97)) {
        item { Item(L.t("Fish"), L.t("SubFish"), "fish", hx(0x3DDC97)) { nav.popBackStack(); E.logCatch("fish") } }
        if (E.trip.active && E.troll == "b") item { Item(L.t("Drop"), L.t("SubDrop"), "down", hx(0xFFB020)) { nav.go("depth/0") } }
        item { Item(L.t("Lost"), L.t("SubLost"), "x", hx(0xE0583A)) { nav.popBackStack(); E.logCatch("miss") } }
        item { Item(L.t("Pest"), L.t("SubPest"), "pest", hx(0xFFD23A)) { nav.popBackStack(); E.logCatch("pest") } }
        item { Item(L.t("GearT"), E.gearSub(), "net", hx(0x2EC8C0)) { nav.go("gear") } }
        if (E.trip.active) item { Item(L.t("Troll"), E.troll?.let { L.t(if (it == "b") "TrollB" else "TrollS") }, "speed", hx(0x3DDC97)) { nav.go("troll") } }
        if (E.trip.active) item { Item(L.t("TripEnd"), L.t("SubTripEnd", Geo.hms(E.trip.secs()), E.trip.n), "stop", hx(0xFF5A4E)) { nav.go("confirm") } }
        else item { Item(L.t("TripStart"), L.t("SubTripGo"), "play", hx(0xF6B744)) { nav.popBackStack(); E.tripStart() } }
        if (E.anchor != null) item { Item(L.t("AnchorOff"), null, "anchor", hx(0x7F8899)) { nav.popBackStack(); E.anchorOff() } }
        else item { Item(L.t("Anchor"), L.t("SubAnchor", E.anchorR()), "anchor", hx(0x9CC3FF)) { nav.popBackStack(); E.anchorSet() } }
        item { Item(L.t("Refresh"), E.fc?.optString("at")?.let { L.t("ClockNow", it) }, "refresh", hx(0xA58BFF)) { nav.popBackStack(); E.load(true) } }
        item { Item(L.t("Settings"), if (P.linked()) L.t("Linked", P.code.take(4) + "…") else L.t("NotLinked"), "gear", hx(0xC4CDD6)) { nav.go("settings") } }
    }
}

/* ---------- μενού συρτής ---------- */
@Composable
fun TrollMenu(nav: NavHostController) {
    MenuList(L.t("Troll"), hx(0x2EC8C0)) {
        if (E.troll == "b") {
            if (E.drop != null) {
                item { Item(L.t("DownOk"), "${E.dropN} " + L.t("LeadsL"), "check", hx(0x3DDC97)) { nav.popBackStack(); E.dropSet() } }
                item { Item("+1", null, "down", hx(0xFFD23A)) { nav.popBackStack(); E.dropAdj(1) } }
                item { Item("-1", null, "up", hx(0xFF8A50)) { nav.popBackStack(); E.dropAdj(-1) } }
                item { Item(L.t("DropAgain"), null, "down", hx(0xFFB020)) { nav.go("depth/0") } }
                item { Item(L.t("CancelL"), null, "x", hx(0xE0583A)) { nav.popBackStack(); E.dropCancel() } }
                return@MenuList
            }
            val tl = E.trLeads
            if (E.adv != 0 && tl != null) item { Item(L.t(if (E.adv < 0) "AdvUpM" else "AdvDnM", abs(E.adv)), "${tl + E.adv} " + L.t("LeadsL"), if (E.adv < 0) "up" else "down", if (E.adv < 0) hx(0xFF5A4E) else hx(0xFFD23A)) { nav.popBackStack(); E.advApply() } }
            item { Item(L.t("Drop"), null, "down", hx(0xFFB020)) { nav.go("depth/0") } }
            if (tl != null) item { Item(L.t("Touched"), L.t("TouchedSub"), "up", hx(0xFF5A4E)) { nav.popBackStack(); E.dropTouched() } }
            val ch = E.chartHere()
            item { Item(L.t("DepthQ"), if (ch == null) L.t("NoChart") else L.t("ChartL", L.f0(ch)), "down", hx(0x4FB3FF)) { nav.go("depth/1") } }
            item { Item(L.t("KdL", L.f2(E.leadFa() * E.kD())), L.t("KdSub"), "anchor", hx(0xA58BFF)) { nav.popBackStack(); E.kdReset() } }
            listOf(1, -1, 5, -5).forEach { dv ->
                item { Item((if (dv > 0) "+" else "-") + abs(dv) + " " + L.t("LeadsL"), if (tl == null) L.t("LeadsAuto") else "$tl > ${(tl + dv).coerceAtLeast(0)}", if (dv > 0) "down" else "up", if (dv > 0) hx(0xFFD23A) else hx(0xFF8A50)) { nav.popBackStack(); E.leadsAdd(dv) } }
            }
            item { Item(L.t("LeadsAutoM"), null, "speed", hx(0x2EC8C0)) { nav.popBackStack(); E.trLeads = null; E.bump() } }
            item { KeysToggle(L.t("KeysL")) }
        }
        if (E.troll == "s") {
            val ln = E.lineNow(); val stp = E.lineStep()
            item { Item("+$stp m", "$ln > ${(ln + stp).coerceAtMost(300)} m", "down", hx(0xFFD23A)) { nav.popBackStack(); E.lineAdd(stp) } }
            item { Item("-$stp m", "$ln > ${(ln - stp).coerceAtLeast(0)} m", "up", hx(0xFF8A50)) { nav.popBackStack(); E.lineAdd(-stp) } }
            item { Item(L.t("LnStep", stp), L.t("LnStepSub"), "path", hx(0x2EC8C0)) { E.lineStepNext() } }
            item { KeysToggle(L.t("KeysLn")) }
        }
        item { Item(L.t("TrollB"), null, "anchor", hx(0x9CC3FF)) { E.trollSet("b"); E.toTroll(); nav.go("depth/0") } }
        item { Item(L.t("TrollS"), null, "wave", hx(0x9CC3FF)) { nav.popBackStack(); E.trollSet("s"); E.toTroll() } }
        if (E.troll != null) item { Item(L.t("TrollEnd"), null, "stop", hx(0xFF5A4E)) { nav.popBackStack(); E.trollSet(null) } }
    }
}

@Composable
fun KeysToggle(label: String) {
    E.ver
    val on = P.b("keysL")
    ToggleChip(checked = on, onCheckedChange = { P.setB("keysL", it); E.bump() }, label = { Text(label, fontSize = 13.sp) },
        secondaryLabel = { Text(L.t("KeysSub"), fontSize = 11.sp) }, toggleControl = { Switch(checked = on) }, modifier = Modifier.fillMaxWidth())
}

/* ---------- δίχτυ / παραγάδι / κλουβί ---------- */
@Composable
fun GearMenu(nav: NavHostController) {
    MenuList(L.t("GearT"), hx(0x2EC8C0)) {
        val now = nowS()
        val s = E.gearSetting()
        if (s != null) item { Item(L.t("GearEnd"), s.optString("nm") + " · " + Geo.hms(now - s.optLong("s0")), "check", hx(0x3DDC97)) { nav.popBackStack(); E.gearEndSet() } }
        E.gearOut().forEach { o ->
            val t0 = if (o.has("s1") && !o.isNull("s1")) o.optLong("s1") else o.optLong("s0")
            item { Item(L.t("GearHaulN", o.optString("nm")), L.t("GearIn", Geo.hms(now - t0)), "up", hx(0xFFB020)) { E.gearHaulStart(o.optString("id")); nav.go("count/" + o.optString("id")) } }
        }
        if (s == null) listOf("net", "ll", "trap").forEach { t -> item { Item(L.t("GearNew", E.gearType(t)), null, "net", hx(0x2EC8C0)) { nav.popBackStack(); E.gearNew(t) } } }
    }
}

/* ---------- στόχος (σελίδα «Σημείο») ---------- */
@Composable
fun NavMenu(nav: NavHostController) {
    MenuList(L.t("Target"), hx(0xF6B744)) {
        item { Item(L.t("Fish"), null, "fish", hx(0x3DDC97)) { nav.popBackStack(); E.logCatch("fish") } }
        val c = E.cur
        E.targets().forEachIndexed { i, t ->
            item { Item(t.name, c?.let { Geo.distTxt(Geo.dist(it[0], it[1], t.lat, t.lon) * 1000) }, if (t.home) "home" else "pin", hx(0xF6B744)) { nav.popBackStack(); E.navT = i; E.bump() } }
        }
    }
}

@Composable
fun SpeciesMenu(nav: NavHostController) {
    MenuList(L.t("SpQ"), hx(0xF6B744)) {
        E.speciesList().forEachIndexed { i, sp -> item { Item(sp.second, null, "fish", hx(0x3DDC97)) { nav.popBackStack(); E.setSpecies(i) } } }
    }
}

/* ---------- τροχός αριθμού (βάθος για «Ρίχνω», ψάρια στο ανέβασμα): κορώνα, −/+, ✓ ---------- */
@Composable
fun Picker(title: String, col: Color, start: Int, minV: Int, maxV: Int, unit: String, sub: (Int) -> String?, bigStep: Int, ok: (Int) -> Unit) {
    var v by remember { mutableIntStateOf(start.coerceIn(minV, maxV)) }
    var acc by remember { mutableFloatStateOf(0f) }
    val fr = remember { FocusRequester() }
    E.ver
    Box(Modifier.fillMaxSize().background(Color.Black).onRotaryScrollEvent { e ->
        acc += e.verticalScrollPixels
        if (abs(acc) > 40f) { v = (v + if (acc > 0) 1 else -1).coerceIn(minV, maxV); acc = 0f; E.vib(30) }
        true
    }.focusRequester(fr).focusable(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Title(L.up(title), col)
            Spacer(Modifier.height(2.dp))
            if (v > minV) T("${v - 1}", 16.sp, pc(7)) else Spacer(Modifier.height(19.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SideBtn("−", pc(6)) { v = (v - 1).coerceIn(minV, maxV) }
                Column(horizontalAlignment = Alignment.CenterHorizontally) { T("$v", 46.sp, pc(5)); T(unit, 11.sp, pc(6)) }
                SideBtn("+", pc(6)) { v = (v + 1).coerceIn(minV, maxV) }
            }
            if (v < maxV) T("${v + 1}", 16.sp, pc(7)) else Spacer(Modifier.height(19.dp))
            sub(v)?.let { T(it, 11.sp, col) }
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Act("−$bigStep", pc(6)) { v = (v - bigStep).coerceIn(minV, maxV) }
                Box(Modifier.size(40.dp).background(pc(2), CircleShape).clickable { ok(v) }, contentAlignment = Alignment.Center) { T("✓", 20.sp, Color.Black, bold = true) }
                Act("+$bigStep", pc(6)) { v = (v + bigStep).coerceIn(minV, maxV) }
            }
        }
    }
    LaunchedEffect(Unit) { fr.requestFocus() }
}

@Composable
fun DepthPicker(only: Boolean, nav: NavHostController) {
    val ch = E.chartHere()
    val last = ch?.let { (it + 0.5).toInt() } ?: P.i("dropD") ?: 20
    Picker(L.t("DepthQ"), hx(0x4FB3FF), last, 3, 120, L.t("FmL"), { d -> if (ch != null && d == (ch + 0.5).toInt()) L.t("ChartSub") else null }, 5) { d ->
        nav.popBackStack()
        if (only) { E.sounderSet(d); E.sayK(L.t("DepthQ") + "\n$d " + L.t("FmL"), "down", 11) } else E.dropStart(d)
    }
}

@Composable
fun CountPicker(gid: String, nav: NavHostController) {
    val it = E.gearItem(gid)
    val t0 = it?.let { o -> if (o.has("s1") && !o.isNull("s1")) o.optLong("s1") else o.optLong("s0") }
    androidx.compose.runtime.DisposableEffect(Unit) { onDispose { if (E.gearHaul) E.gearHaulCancel() } }
    Picker(L.t("GearCountT") + (it?.let { " · " + it.optString("nm") } ?: ""), hx(0x2EC8C0), 0, 0, 999, L.t("FishL"), { _ -> t0?.let { L.t("GearIn", Geo.hms(nowS() - it)) } }, 5) { n ->
        nav.popBackStack(); E.gearHaulDone(gid, n)
    }
}

/* ---------- «Τέλος εξόδου;» ---------- */
@Composable
fun ConfirmEnd(nav: NavHostController) {
    E.ver
    Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
        Ring { arc(0f, 360f, pc(13), size.minDimension * 0.04f) }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            T(L.t("TripEndT"), 17.sp, pc(5), bold = true)
            T(Geo.hms(E.trip.secs()) + " · ${E.trip.n} " + L.t("FishL") + " · " + L.f1(E.trip.km) + " km", 12.sp, pc(6))
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(46.dp).background(pc(15), CircleShape).clickable { nav.popBackStack() }, contentAlignment = Alignment.Center) { T("✕", 20.sp, pc(5), bold = true) }
                    T(L.t("CancelL"), 11.sp, pc(6))
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(46.dp).background(pc(2), CircleShape).clickable { nav.popBackStack(); E.tripEnd(true) }, contentAlignment = Alignment.Center) { T("✓", 20.sp, Color.Black, bold = true) }
                    T(L.t("SaveL"), 11.sp, pc(6))
                }
            }
        }
    }
}

/* ---------- ρυθμίσεις (ό,τι έχει το Connect IQ › Alkyon › Ρυθμίσεις) ---------- */
@Composable
fun NumRow(label: String, key: String, step: Double, minV: Double, maxV: Double, dec: Int, after: () -> Unit = {}) {
    E.ver
    val v = P.d(key)
    fun set(x: Double) { P.setD(key, (Math.round(x.coerceIn(minV, maxV) / step) * step)); E.bump(); after() }
    Row(Modifier.fillMaxWidth().background(TILE, RoundedCornerShape(24.dp)).padding(horizontal = 6.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        SideBtn("−", pc(6)) { set(v - step) }
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            T(label, 11.sp, pc(6), lines = 2)
            T(when (dec) { 0 -> L.f0(v); 1 -> L.f1(v); else -> L.f2(v) }, 15.sp, pc(5), bold = true)
        }
        SideBtn("+", pc(6)) { set(v + step) }
    }
}

@Composable
fun Toggle(label: String, key: String, after: () -> Unit = {}) {
    E.ver
    val on = P.b(key)
    ToggleChip(checked = on, onCheckedChange = { P.setB(key, it); E.bump(); after() }, label = { Text(label, fontSize = 13.sp, maxLines = 3) },
        toggleControl = { Switch(checked = on) }, modifier = Modifier.fillMaxWidth())
}

@Composable
fun SettingsScreen(nav: NavHostController) {
    val ctx = LocalContext.current
    val input = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val d = r.data ?: return@rememberLauncherForActivityResult
        val code = RemoteInput.getResultsFromIntent(d)?.getCharSequence("code")?.toString() ?: return@rememberLauncherForActivityResult
        P.code = code; P.setB("wel", true); E.welcome = false
        if (P.linked()) { E.sayK(L.t("LinkedMsg"), "check", 2); E.load(true); Sender.flush() }
        E.bump()
    }
    val sched = { AlertWorker.schedule(ctx) }
    MenuList(L.t("Settings"), pc(6)) {
        item { ListHeader { T(L.t("LinkT"), 12.sp, pc(0), bold = true) } }
        item { T(if (P.linked()) L.t("Linked", P.code.take(4) + " " + P.code.drop(4)) else L.t("NotLinked"), 13.sp, if (P.linked()) pc(2) else pc(4), bold = true) }
        if (!P.linked()) item { T(L.t("LinkAuto"), 11.sp, pc(6), lines = 4) }
        item { Item(L.t("EnterCode"), L.t("SetCodeHelp"), "pin", hx(0xF6B744)) {
            val i = RemoteInputIntentHelper.createActionRemoteInputIntent()
            RemoteInputIntentHelper.putRemoteInputsExtra(i, listOf(RemoteInput.Builder("code").setLabel(L.t("SetCode")).build()))
            try { input.launch(i) } catch (e: Exception) {}
        } }
        if (P.linked()) item { Item(L.t("Unlink"), null, "x", hx(0xE0583A)) { P.code = ""; E.bump() } }
        item { ListHeader { T(L.t("Alerts"), 12.sp, pc(0), bold = true) } }
        item { Toggle(L.t("SetTurn"), "turnAlert", sched) }
        item { Toggle(L.t("SetBest"), "bestAlert", sched) }
        item { Toggle(L.t("SetPress"), "pressAlert", sched) }
        item { NumRow(L.t("SetPressThr"), "pressThr", 1.0, 1.0, 6.0, 0) }
        item { ListHeader { T(L.t("Display"), 12.sp, pc(0), bold = true) } }
        item { Toggle(L.t("SetNight"), "nightRed") }
        item { ListHeader { T(L.t("Trolling"), 12.sp, pc(0), bold = true) } }
        item { NumRow(L.t("SetTrMin"), "trollMin", 0.1, 0.5, 15.0, 1) }
        item { NumRow(L.t("SetTrMax"), "trollMax", 0.1, 0.5, 20.0, 1) }
        item { NumRow(L.t("SetTrLine"), "trollLine", 5.0, 5.0, 300.0, 0) { P.setI("trLn", null) } }
        item { NumRow(L.t("SetLeadFa"), "leadFa", 0.05, 0.3, 3.0, 2) }
        item { NumRow(L.t("SetClr"), "clrFa", 0.5, 0.0, 10.0, 1) }
        item { NumRow(L.t("SetAnchor"), "anchorM", 10.0, 10.0, 300.0, 0) }
        item { NumRow(L.t("SetBoatKn"), "boatKn", 1.0, 2.0, 50.0, 0) }
        item { ListHeader { T(L.t("SpotSet"), 12.sp, pc(0), bold = true) } }
        item { T(L.f2(P.d("homeLat")) + ", " + L.f2(P.d("homeLon")), 13.sp, pc(5)) }
        item { Item(L.t("UseHere"), null, "pin", hx(0x4FB3FF)) { E.realPos()?.let { P.setD("homeLat", it[0]); P.setD("homeLon", it[1]); E.bump() } ?: E.sayK(L.t("WaitGps"), "pin", 7) } }
        item { Spacer(Modifier.height(6.dp)) }
        item { T(L.t("Version", try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName } catch (e: Exception) { "" }), 10.sp, pc(7)) }
    }
}
