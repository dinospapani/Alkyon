// Alkyon για Wear OS: χρώματα (μέρα / κόκκινα τη νύχτα, όπως στο Garmin) και βοηθητικά σχεδίασης.
package com.alkyonfishing.app.wear.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import com.alkyonfishing.app.wear.Engine
import kotlin.math.cos
import kotlin.math.sin

/** 0 χρυσό, 1 κόκκινο, 2 πράσινο, 3 κίτρινο, 4 πορτοκαλί, 5 κείμενο, 6 κείμενο 2, 7 κείμενο 3, 8 τροχιά, 9 πλακίδιο, 10 σελήνη,
 *  11 μπλε, 12 γαλαζοπράσινο, 13 κοραλλί, 14 μοβ, 15 σκούρο γκρι */
val DAY = longArrayOf(0xF6B744, 0xFF5A4E, 0x3DDC97, 0xFFD23A, 0xFF8A50, 0xF4F6F8, 0xC4CDD6, 0x97A2AE, 0x1E252D, 0x141922, 0xCFE3FF, 0x4FB3FF, 0x2EC8C0, 0xFF6B5A, 0xA58BFF, 0x56616D)
val NIGHT = longArrayOf(0xFF4A3A, 0xFF2A1A, 0xFF4A3A, 0xFF4A3A, 0xFF4A3A, 0xFF6B57, 0xE0503E, 0xB33A2C, 0x2A0B08, 0x1E0907, 0xFF6B57, 0xD8402F, 0xFF4A3A, 0xFF4A3A, 0xFF4A3A, 0x6E2018)
fun pc(i: Int): Color = Color(0xFF000000 or (if (Engine.isNight()) NIGHT[i] else DAY[i]))
fun hx(c: Long): Color = if (Engine.isNight()) pc(0) else Color(0xFF000000 or c)
fun scoreCol(s: Int?): Color = when { s == null -> pc(1); s >= 70 -> pc(2); s >= 50 -> pc(3); else -> pc(4) }

/** εικονίδια ως σύμβολα (ίδια ονόματα με το Garmin) */
fun glyph(n: String?): String = when (n) {
    "fish" -> "🐟"; "check" -> "✓"; "x" -> "✕"; "play" -> "▶"; "stop" -> "■"; "anchor" -> "⚓"; "up" -> "↑"; "down" -> "↓"
    "undo" -> "↩"; "home" -> "⌂"; "pin" -> "◉"; "speed" -> "⏱"; "path" -> "↝"; "net" -> "▦"; "pest" -> "☠"; "wave" -> "≈"; "wind" -> "〰"
    "rise" -> "☀"; "set" -> "☀"; "moon" -> "☾"; "temp" -> "°"; "gauge" -> "◔"; "gear" -> "⚙"; "refresh" -> "⟳"; null -> ""; else -> "•"
}

/** τόξο σε γωνίες ρολογιού (0 = πάνω, δεξιόστροφα) */
fun DrawScope.arc(a0: Float, a1: Float, col: Color, w: Float, inset: Float = 0f, cap: StrokeCap = StrokeCap.Butt) {
    val r = size.minDimension / 2 - w / 2 - inset
    drawArc(col, a0 - 90f, a1 - a0, false, topLeft = Offset(center.x - r, center.y - r), size = Size(r * 2, r * 2), style = Stroke(w, cap = cap))
}
fun DrawScope.pol(r: Float, a: Float): Offset { val t = Math.toRadians(a.toDouble()); return Offset(center.x + r * sin(t).toFloat(), center.y - r * cos(t).toFloat()) }

@Composable
fun T(t: String, size: TextUnit, col: Color, bold: Boolean = false, modifier: Modifier = Modifier, lines: Int = 1, align: TextAlign = TextAlign.Center) =
    Text(t, modifier = modifier, color = col, fontSize = size, fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal, textAlign = align,
        maxLines = lines, overflow = TextOverflow.Ellipsis, lineHeight = size * 1.12)

/** τίτλος σελίδας: χρωματιστή τελεία + γκρι κεφαλαία */
@Composable
fun Title(t: String, dot: Color) = Row(verticalAlignment = Alignment.CenterVertically) {
    Box(Modifier.size(6.dp).background(dot, CircleShape)); Spacer(Modifier.width(5.dp)); T(t, 12.sp, pc(6), bold = true)
}

/** ετικέτα κατάστασης (σαν το tint() του Garmin) */
@Composable
fun Chip2(t: String, col: Color, solid: Boolean = false) = Box(
    Modifier.background(if (solid) col else col.copy(alpha = 0.14f), RoundedCornerShape(50)).border(1.dp, col.copy(alpha = 0.6f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 3.dp)
) { T(t, 13.sp, if (solid) Color.Black else col, bold = true) }

@Composable
fun Stat(ic: String, v: String, col: Color = pc(5)) = Column(horizontalAlignment = Alignment.CenterHorizontally) {
    T(glyph(ic), 11.sp, pc(7)); T(v, 13.sp, col, bold = true)
}

/** κυκλικό κουμπί με σύμβολο */
@Composable
fun Dot(ic: String, col: Color, d: Dp = 40.dp, txtCol: Color = Color(0xFF06261A)) = Box(Modifier.size(d).background(col, CircleShape), contentAlignment = Alignment.Center) {
    T(glyph(ic).ifEmpty { ic }, (d.value * 0.42f).sp, txtCol, bold = true)
}

@Composable
fun Ring(mod: Modifier = Modifier.fillMaxSize(), draw: DrawScope.() -> Unit) = Canvas(mod) { draw() }
