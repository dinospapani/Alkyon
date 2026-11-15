// Alkyon για Wear OS: tile (σαν το glance του Garmin) και complication στο watch face (βαθμός της ημέρας).
package com.alkyonfishing.app.wear

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.degrees
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.alkyonfishing.app.wear.ui.MainActivity
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

object Surfaces {
    /** βαθμός και καλύτερη ώρα σήμερα (ή αύριο, αν σήμερα πέρασε / δεν βγαίνει): (βαθμός, ώρα, είναι_αύριο) */
    fun today(): Triple<Int?, String, Boolean> {
        val fc = P.obj("fc"); val bg = P.obj("bgd")
        val days = fc?.optJSONArray("days")
        val fresh = fc != null && (bg == null || fc.optLong("got") >= bg.optLong("got"))
        if (fresh && days != null && days.length() > 0) {
            val d0 = days.getJSONObject(0)
            if (!d0.isNull("s")) return Triple(d0.optInt("s"), d0.optString("w", ""), false)
            if (days.length() > 1) { val d1 = days.getJSONObject(1); return Triple(if (d1.isNull("s")) null else d1.optInt("s"), d1.optString("w", ""), true) }
            return Triple(null, "", false)
        }
        if (bg != null && bg.has("s") && !bg.isNull("s")) return Triple(bg.optInt("s"), bg.optString("w", ""), false)
        return Triple(null, "", false)
    }
    fun update(c: Context) {
        try { TileService.getUpdater(c).requestUpdate(AlkTileService::class.java) } catch (e: Exception) {}
        try { ComplicationDataSourceUpdateRequester.create(c, ComponentName(c, AlkComplication::class.java)).requestUpdateAll() } catch (e: Exception) {}
    }
    fun col(s: Int?): Int = when { s == null -> 0xFFFF5A4E.toInt(); s >= 70 -> 0xFF3DDC97.toInt(); s >= 50 -> 0xFFFFD23A.toInt(); else -> 0xFFFF8A50.toInt() }
}

class AlkTileService : TileService() {
    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        P.init(this)
        val tile = TileBuilders.Tile.Builder().setResourcesVersion("1").setFreshnessIntervalMillis(30 * 60 * 1000L)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout())).build()
        return Futures.immediateFuture(tile)
    }
    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion("1").build())

    private fun txt(t: String, size: Float, color: Int, bold: Boolean = false) = LayoutElementBuilders.Text.Builder().setText(t)
        .setFontStyle(LayoutElementBuilders.FontStyle.Builder().setSize(sp(size)).setColor(argb(color))
            .setWeight(if (bold) LayoutElementBuilders.FONT_WEIGHT_BOLD else LayoutElementBuilders.FONT_WEIGHT_NORMAL).build()).build()

    private fun layout(): LayoutElementBuilders.LayoutElement {
        val (s, w, tmr) = Surfaces.today()
        val fc = P.obj("fc")
        val d = fc?.optJSONArray("days")?.optJSONObject(if (tmr) 1 else 0)
        val c = Surfaces.col(s)
        val ring = LayoutElementBuilders.Arc.Builder().setAnchorAngle(degrees(0f)).setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
            .addContent(LayoutElementBuilders.ArcLine.Builder().setLength(degrees(359.9f)).setThickness(dp(8f)).setColor(argb(0xFF1E252D.toInt())).build()).build()
        val val0 = LayoutElementBuilders.Arc.Builder().setAnchorAngle(degrees(0f)).setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
            .addContent(LayoutElementBuilders.ArcLine.Builder().setLength(degrees(3.6f * (s ?: 0).coerceIn(0, 100))).setThickness(dp(8f)).setColor(argb(c)).build()).build()
        val col = LayoutElementBuilders.Column.Builder().setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(txt(if (tmr) L.up(L.t("TmrU")) else "ALKYON", 13f, 0xFFF6B744.toInt(), true))
            .addContent(txt(s?.toString() ?: (if (fc == null) "–" else L.t("Unsafe")), if (s != null) 46f else 16f, if (s != null) 0xFFF4F6F8.toInt() else 0xFFFF5A4E.toInt()))
            .addContent(txt(if (w.isNotEmpty()) L.up(L.t("BestHourU")) + " " + w else if (fc == null) L.t("GlanceOpen") else "", 14f, c, true))
        if (d != null) {
            val b = if (d.isNull("b")) "-" else d.optInt("b").toString() + " Bft"
            val v = if (d.isNull("v")) "-" else L.f1(d.optDouble("v")) + " m"
            col.addContent(LayoutElementBuilders.Spacer.Builder().setHeight(dp(4f)).build()).addContent(txt("$b · $v", 13f, 0xFFC4CDD6.toInt()))
        }
        val click = ModifiersBuilders.Clickable.Builder().setId("open").setOnClick(ActionBuilders.LaunchAction.Builder()
            .setAndroidActivity(ActionBuilders.AndroidActivity.Builder().setPackageName(packageName).setClassName(MainActivity::class.java.name).build()).build()).build()
        return LayoutElementBuilders.Box.Builder().setWidth(expand()).setHeight(expand())
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(click).build())
            .addContent(ring).addContent(val0).addContent(col.build()).build()
    }
}

class AlkComplication : SuspendingComplicationDataSourceService() {
    private fun tap(): PendingIntent = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE)
    private fun make(type: ComplicationType, s: Int?, w: String): ComplicationData {
        val desc = PlainComplicationText.Builder(L.t("CxLong")).build()
        val st = s?.toString() ?: "–"
        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(PlainComplicationText.Builder(st).build(), desc)
                .setTitle(PlainComplicationText.Builder(if (w.isNotEmpty()) w else "ALK").build()).setTapAction(tap()).build()
            ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder((s ?: 0).toFloat(), 0f, 100f, desc)
                .setText(PlainComplicationText.Builder(st).build()).setTitle(PlainComplicationText.Builder("ALK").build()).setTapAction(tap()).build()
            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(PlainComplicationText.Builder("Alkyon $st" + (if (w.isNotEmpty()) " · $w" else "")).build(), desc)
                .setTapAction(tap()).build()
            else -> NoDataComplicationData()
        }
    }
    override fun getPreviewData(type: ComplicationType): ComplicationData = make(type, 72, "16-18")
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData {
        P.init(this)
        val (s, w, _) = Surfaces.today()
        return make(request.complicationType, s, w)
    }
}
