// Alkyon για Apple Watch: complications στο watch face και κάρτα στο Smart Stack (σαν το glance του Garmin):
// ο βαθμός της ημέρας, η καλύτερη ώρα, άνεμος και κύμα. Τα δεδομένα έρχονται από την εφαρμογή (App Group).
import SwiftUI
import WidgetKit

struct AlkEntry: TimelineEntry { let date: Date; let d: DayScore }

struct AlkProvider: TimelineProvider {
    func placeholder(in context: Context) -> AlkEntry { AlkEntry(date: Date(), d: DayScore(s: 72, w: "16-18", tomorrow: false, b: 3, v: 0.4, has: true)) }
    func getSnapshot(in context: Context, completion: @escaping (AlkEntry) -> Void) { completion(context.isPreview ? placeholder(in: context) : AlkEntry(date: Date(), d: Score.today())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<AlkEntry>) -> Void) {
        completion(Timeline(entries: [AlkEntry(date: Date(), d: Score.today())], policy: .after(Date().addingTimeInterval(30 * 60))))
    }
}

private func col(_ s: Int?) -> Color { let h = Score.rgb(s); return Color(red: Double((h >> 16) & 0xFF) / 255, green: Double((h >> 8) & 0xFF) / 255, blue: Double(h & 0xFF) / 255) }
private let GOLD = Color(red: 0.965, green: 0.718, blue: 0.267)

struct AlkWidgetView: View {
    @Environment(\.widgetFamily) var family
    var e: AlkEntry
    var body: some View {
        let d = e.d, st = d.s.map { "\($0)" } ?? "–"
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(d.s ?? 0), in: 0...100) { Text("ALK") } currentValueLabel: { Text(st).font(.system(size: 18, weight: .semibold, design: .rounded)) }
                .gaugeStyle(.accessoryCircular).tint(col(d.s))
        case .accessoryCorner:
            Text(st).font(.system(size: 20, weight: .semibold, design: .rounded)).foregroundColor(col(d.s))
                .widgetLabel { Gauge(value: Double(d.s ?? 0), in: 0...100) { Text("ALK") }.tint(col(d.s)) }
        case .accessoryInline:
            Text("Alkyon \(st)" + (d.w.isEmpty ? "" : " · \(d.w)"))
        default:
            HStack(spacing: 8) {
                Gauge(value: Double(d.s ?? 0), in: 0...100) { Text("") } currentValueLabel: { Text(st).font(.system(size: 16, weight: .semibold, design: .rounded)) }
                    .gaugeStyle(.accessoryCircular).tint(col(d.s))
                VStack(alignment: .leading, spacing: 1) {
                    Text(d.tomorrow ? L.up(L.t("TmrU")) : "ALKYON").font(.system(size: 12, weight: .semibold, design: .rounded)).foregroundColor(GOLD)
                    if !d.has { Text(L.t("GlanceOpen")).font(.system(size: 12)) }
                    else if d.s == nil { Text(L.t("Unsafe")).font(.system(size: 13)).foregroundColor(col(nil)) }
                    else if !d.w.isEmpty { Text(L.up(L.t("BestHourU")) + " " + d.w).font(.system(size: 13, weight: .medium)).foregroundColor(col(d.s)) }
                    if let b = d.b { Text("\(b) Bft" + (d.v.map { " · " + L.f1($0) + " m" } ?? "")).font(.system(size: 12)).foregroundColor(.secondary) }
                }
                Spacer(minLength: 0)
            }
        }
    }
}

struct AlkyonScoreWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AlkyonScore", provider: AlkProvider()) { e in
            AlkWidgetView(e: e).containerBackground(for: .widget) { Color.black }
        }
        .configurationDisplayName("Alkyon")
        .description(L.t("CxLong"))
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline, .accessoryRectangular])
    }
}

@main
struct AlkyonWidgets: WidgetBundle {
    var body: some Widget { AlkyonScoreWidget() }
}
