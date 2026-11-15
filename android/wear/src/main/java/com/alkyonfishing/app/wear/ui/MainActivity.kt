// Alkyon για Wear OS: κύρια οθόνη. Σελίδες πάνω / κάτω (σύρσιμο ή κορώνα), πάτημα = μενού καταγραφής,
// κουμπί του ρολογιού (STEM 1) = START του Garmin (ψάρι στη συρτή, έναρξη εξόδου, μενού).
package com.alkyonfishing.app.wear.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.alkyonfishing.app.wear.Engine
import com.alkyonfishing.app.wear.P
import com.alkyonfishing.app.wear.Sender
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Engine.init(this)
        setContent { AlkUi() }
    }
    override fun onResume() {
        super.onResume()
        Engine.visible = true
        Engine.load(false); Sender.flush(); Engine.gpsUpdate()
        // στη συρτή η οθόνη μένει αναμμένη (όπως η σελίδα συρτής στο Garmin)
        if (Engine.troll != null && Engine.trip.active) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
    override fun onPause() { Engine.visible = false; Engine.gpsUpdate(); super.onPause() }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_STEM_1 || keyCode == KeyEvent.KEYCODE_STEM_PRIMARY) { start(); return true }
        if (keyCode == KeyEvent.KEYCODE_STEM_2) { if (Engine.afterOn) Engine.afterUndo() else opener?.invoke("log"); return true }
        return super.onKeyDown(keyCode, event)
    }
    /** το START του Garmin */
    private fun start() {
        val e = Engine
        if (e.welcome) { e.welcomeOk(); return }
        if (e.anchorAlarm) { e.anchorOff(); return }
        if (e.page == 2) { opener?.invoke("nav"); return }
        if (e.page == 1 && !e.trip.active) { e.tripStart(); return }
        if (e.trollPage() && e.drop != null) { e.dropSet(); return }
        if (e.trollPage()) { e.quickFish(); return }
        opener?.invoke("log")
    }
    companion object { var opener: ((String) -> Unit)? = null }
}

@Composable
fun AlkUi() {
    val nav = rememberSwipeDismissableNavController()
    MainActivity.opener = { r -> if (nav.currentDestination?.route == "main") nav.navigate(r) }
    // ζωντανή ώρα στην έξοδο / στο «Ρίχνω» / στα 6″ μετά το ψάρι
    LaunchedEffect(Unit) { while (true) { delay(1000); if (Engine.trip.active || Engine.afterOn) Engine.bump() } }
    val perms = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { Engine.load(true); Engine.gpsUpdate() }
    LaunchedEffect(Unit) {
        val need = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.POST_NOTIFICATIONS)
            .filter { Engine.ctx.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (need.isNotEmpty() && !P.b("askedPerm")) { P.setB("askedPerm", true); perms.launch(need.toTypedArray()) }
    }
    MaterialTheme {
        SwipeDismissableNavHost(navController = nav, startDestination = "main") {
            composable("main") { Main { nav.navigate(it) } }
            composable("log") { LogMenu(nav) }
            composable("troll") { TrollMenu(nav) }
            composable("gear") { GearMenu(nav) }
            composable("nav") { NavMenu(nav) }
            composable("species") { SpeciesMenu(nav) }
            composable("confirm") { ConfirmEnd(nav) }
            composable("settings") { SettingsScreen(nav) }
            composable("depth/{only}") { b -> DepthPicker(b.arguments?.getString("only") == "1", nav) }
            composable("count/{gid}") { b -> CountPicker(b.arguments?.getString("gid") ?: "", nav) }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun Main(open: (String) -> Unit) {
    Engine.ver
    val ps = rememberPagerState(initialPage = Engine.page) { 6 }
    val scope = rememberCoroutineScope()
    LaunchedEffect(ps.currentPage) { Engine.goPage(ps.currentPage) }
    val req = Engine.pageReq
    LaunchedEffect(req) { if (req >= 0) { ps.animateScrollToPage(req); Engine.pageReq = -1 } }
    val fr = remember { FocusRequester() }
    var acc by remember { mutableFloatStateOf(0f) }
    Box(Modifier.fillMaxSize().background(Color.Black).onRotaryScrollEvent { e ->
        acc += e.verticalScrollPixels
        if (abs(acc) > 60f) {
            val d = if (acc > 0) 1 else -1; acc = 0f
            // κορώνα: στη σελίδα της συρτής = μολύβια / πετονιά (UP/DOWN του Garmin), αλλού = σελίδα
            if (!Engine.afterOn && !Engine.keyAct(d)) scope.launch { ps.animateScrollToPage((ps.currentPage + d).coerceIn(0, 5)) }
        }
        true
    }.focusRequester(fr).focusable()) {
        VerticalPager(state = ps, modifier = Modifier.fillMaxSize()) { i ->
            Box(Modifier.fillMaxSize().clickable(enabled = i != 1 && i != 2) { open("log") }) { Page(i, open) }
        }
        PageDots(ps.currentPage)
        // μενού (πάντα διαθέσιμο, και στη σελίδα της εξόδου)
        Box(Modifier.fillMaxSize().padding(bottom = 4.dp), contentAlignment = Alignment.BottomCenter) {
            Box(Modifier.size(26.dp).background(pc(9), CircleShape).clickable { open("log") }, contentAlignment = Alignment.Center) { T("≡", 14.sp, pc(6), bold = true) }
        }
        MsgOverlay(); SavedOverlay(); AfterOverlay(open); AnchorAlarm(); Welcome()
    }
    LaunchedEffect(Unit) { fr.requestFocus() }
}
