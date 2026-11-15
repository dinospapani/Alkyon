// Alkyon για Apple Watch: οι 6 σελίδες (όπως στο Garmin), οι οθόνες πάνω τους, τα μενού και οι ρυθμίσεις.
// Σελίδες πάνω / κάτω (σύρσιμο ή Digital Crown), πάτημα = μενού καταγραφής. Στη σελίδα της συρτής η κορώνα αλλάζει
// τα μολύβια / την πετονιά (σαν τα UP/DOWN του Garmin) και το μεγάλο πράσινο κουμπί γράφει ψάρι με ένα πάτημα.
import SwiftUI
import WatchKit

/* ---------- χρώματα ---------- */
let DAY: [UInt32] = [0xF6B744, 0xFF5A4E, 0x3DDC97, 0xFFD23A, 0xFF8A50, 0xF4F6F8, 0xC4CDD6, 0x97A2AE, 0x1E252D, 0x141922, 0xCFE3FF, 0x4FB3FF, 0x2EC8C0, 0xFF6B5A, 0xA58BFF, 0x56616D]
let NIGHT: [UInt32] = [0xFF4A3A, 0xFF2A1A, 0xFF4A3A, 0xFF4A3A, 0xFF4A3A, 0xFF6B57, 0xE0503E, 0xB33A2C, 0x2A0B08, 0x1E0907, 0xFF6B57, 0xD8402F, 0xFF4A3A, 0xFF4A3A, 0xFF4A3A, 0x6E2018]
extension Color { init(hex: UInt32) { self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255) } }
func pc(_ i: Int) -> Color { Color(hex: Engine.shared.isNight() ? NIGHT[i] : DAY[i]) }
func hx(_ c: UInt32) -> Color { Engine.shared.isNight() ? pc(0) : Color(hex: c) }
func scoreCol(_ s: Int?) -> Color { guard let s = s else { return pc(1) }; return s >= 70 ? pc(2) : s >= 50 ? pc(3) : pc(4) }
func glyph(_ n: String?) -> String {
    switch n { case "fish": return "🐟"; case "check": return "✓"; case "x": return "✕"; case "play": return "▶"; case "stop": return "■"; case "anchor": return "⚓"
    case "up": return "↑"; case "down": return "↓"; case "undo": return "↩"; case "home": return "⌂"; case "pin": return "◉"; case "speed": return "⏱"; case "path": return "↝"
    case "net": return "▦"; case "pest": return "☠"; case "wave": return "≈"; case "wind": return "〰"; case "rise", "set": return "☀"; case "moon": return "☾"
    case "temp": return "°"; case "gauge": return "◔"; case "gear": return "⚙"; case "refresh": return "⟳"; case nil: return ""; default: return "•" }
}

/** τόξο σε γωνίες ρολογιού (0 = πάνω, δεξιόστροφα) */
struct ArcS: Shape {
    var a0: Double, a1: Double, inset: CGFloat = 0
    func path(in r: CGRect) -> Path {
        var p = Path(); let rad = min(r.width, r.height) / 2 - inset
        p.addArc(center: CGPoint(x: r.midX, y: r.midY), radius: rad, startAngle: .degrees(a0 - 90), endAngle: .degrees(a1 - 90), clockwise: false)
        return p
    }
}
func pol(_ size: CGSize, _ r: CGFloat, _ a: Double) -> CGPoint { let t = a * .pi / 180; return CGPoint(x: size.width / 2 + r * CGFloat(sin(t)), y: size.height / 2 - r * CGFloat(cos(t))) }
struct RingBG: View { var w: CGFloat = 6; var body: some View { ArcS(a0: 0, a1: 360, inset: w / 2).stroke(pc(8), lineWidth: w) } }
struct RingV: View { var a0: Double = 0; var a1: Double; var col: Color; var w: CGFloat = 6; var round = false
    var body: some View { ArcS(a0: a0, a1: a1, inset: w / 2).stroke(col, style: StrokeStyle(lineWidth: w, lineCap: round ? .round : .butt)) } }

struct Tx: View {
    var t: String; var s: CGFloat; var c: Color; var b = false; var lines = 1
    init(_ t: String, _ s: CGFloat, _ c: Color, b: Bool = false, lines: Int = 1) { self.t = t; self.s = s; self.c = c; self.b = b; self.lines = lines }
    var body: some View { Text(t).font(.system(size: s, weight: b ? .semibold : .regular, design: .rounded)).foregroundColor(c).lineLimit(lines).minimumScaleFactor(0.6).multilineTextAlignment(.center) }
}
struct TitleV: View { var t: String; var dot: Color
    var body: some View { HStack(spacing: 4) { Circle().fill(dot).frame(width: 5, height: 5); Tx(t, 11, pc(6), b: true) } } }
struct ChipV: View { var t: String; var col: Color; var solid = false
    var body: some View { Tx(t, 12, solid ? .black : col, b: true).padding(.horizontal, 8).padding(.vertical, 2)
        .background(Capsule().fill(solid ? col : col.opacity(0.15))).overlay(Capsule().stroke(col.opacity(0.6), lineWidth: 1)) } }
struct StatV: View { var ic: String; var v: String; var col: Color = pc(5)
    var body: some View { VStack(spacing: 0) { Tx(glyph(ic), 10, pc(7)); Tx(v, 12, col, b: true) } } }
struct RoundBtn: View { var t: String; var col: Color; var d: CGFloat = 36; var fg: Color = Color(hex: 0x06261A); var act: () -> Void
    var body: some View { Button(action: act) { Tx(t, d * 0.42, fg, b: true).frame(width: d, height: d).background(Circle().fill(col)) }.buttonStyle(.plain) } }
struct SideBtn: View { var t: String; var col: Color; var long: (() -> Void)? = nil; var act: () -> Void
    var body: some View {
        Tx(t, 14, col, b: true).frame(width: 34, height: 34).background(Circle().fill(col.opacity(0.18)))
            .onTapGesture(perform: act).onLongPressGesture(minimumDuration: 0.7) { long?() }
    } }

enum Route: Hashable { case log, troll, gear, nav, species, confirm, settings, depth(Bool), count(String) }

/* ---------- κύρια οθόνη ---------- */
struct ContentView: View {
    @ObservedObject var e = Engine.shared
    @State private var path: [Route] = []
    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Color.black.ignoresSafeArea()
                TabView(selection: $e.pageSel) {
                    ForEach(0..<6, id: \.self) { i in
                        PageV(i: i, open: { path.append($0) }).tag(i)
                            .contentShape(Rectangle())
                            .onTapGesture { if i != 1 && i != 2 { path.append(.log) } }
                    }
                }
                .tabViewStyle(.verticalPage)
                .onChange(of: e.pageSel) { _, n in e.setPage(n) }
                VStack { Spacer(); Button { path.append(.log) } label: { Tx("≡", 13, pc(6), b: true).frame(width: 24, height: 24).background(Circle().fill(pc(9))) }.buttonStyle(.plain) }
                MsgOverlay(); SavedOverlay(); AfterOverlay(open: { path.append($0) }); AnchorAlarmV(); WelcomeV()
            }
            .navigationDestination(for: Route.self) { r in
                switch r {
                case .log: LogMenu(path: $path)
                case .troll: TrollMenu(path: $path)
                case .gear: GearMenu(path: $path)
                case .nav: NavMenu(path: $path)
                case .species: SpeciesMenu(path: $path)
                case .confirm: ConfirmEnd(path: $path)
                case .settings: SettingsV()
                case .depth(let only): DepthPicker(only: only, path: $path)
                case .count(let gid): CountPicker(gid: gid, path: $path)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in if e.trip.active || e.afterOn { e.bump() } }
    }
}

struct PageV: View {
    @ObservedObject var e = Engine.shared
    var i: Int; var open: (Route) -> Void
    var body: some View {
        Group {
            if e.fc == nil && i != 1 && i != 2 { NoData() }
            else {
                switch i {
                case 0: TodayV()
                case 1: TripV(open: open)
                case 2: SpotV(open: open)
                case 3: DaysV()
                case 4: PressV()
                default: SquidV()
                }
            }
        }
    }
}

struct NoData: View {
    @ObservedObject var e = Engine.shared
    var body: some View { VStack(spacing: 6) { Tx("ALKYON", 12, pc(0), b: true); Tx(e.loading ? L.t("Loading") : L.t("NoData"), 13, pc(6), lines: 4) } }
}
struct TripBadge: View { @ObservedObject var e = Engine.shared
    var body: some View { if e.trip.active { Tx("● " + Geo.hms(e.trip.secs()) + " · \(e.trip.n)", 11, pc(1), b: true) } } }

/* ---------- 0 · Σήμερα ---------- */
struct TodayV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        let days = (ja(e.fc, "days") as? [JO]) ?? []
        if days.isEmpty { NoData() } else {
            let tmr = ji(days[0], "s") == nil && days.count > 1
            let d = tmr ? days[1] : days[0]
            let t = tmr ? (jo(e.fc, "t2") ?? e.td()) : e.td()
            let nm = Geo.nowMin(), ch = tmr ? -1 : nm / 60
            ZStack {
                DayRing(t: t, ch: ch, nm: nm, tmr: tmr)
                VStack(spacing: 2) {
                    TripBadge()
                    TitleV(t: tmr ? L.up(L.t("TmrU")) + " · " + js(d, "n") : L.up(L.t("TodayU")), dot: pc(0))
                    if tmr && !e.dayOver() { Tx(L.t("TodayWind"), 10, pc(1)) }
                    if let s = ji(d, "s") { HStack(alignment: .lastTextBaseline, spacing: 1) { Tx("\(s)", 44, pc(5)); Tx("/100", 11, pc(6)) } }
                    else { Tx(L.t("Unsafe"), 20, pc(1), b: true) }
                    let w0 = js(d, "w")
                    if !w0.isEmpty { bestChip(w0, t, tmr, nm) }
                    HStack(spacing: 12) {
                        StatV(ic: "wind", v: ji(d, "b").map { "\($0) Bft" } ?? "-")
                        StatV(ic: "wave", v: jd(d, "v").map { L.f1($0) + " m" } ?? "-")
                        if let r = ji(t, "r"), let st = ji(t, "st") { let before = nm < st && nm >= r; StatV(ic: before ? "set" : "rise", v: Geo.minHm(before ? st : r)) }
                    }
                    if Sender.size() > 0 { Tx("↑ " + L.t("QShort", Sender.size()), 10, pc(7)) }
                }.padding(.horizontal, 18)
            }
        }
    }
    func bestChip(_ w0: String, _ t: JO?, _ tmr: Bool, _ nm: Int) -> some View {
        var line = w0, tc = pc(0)
        let ws = ji(t, "ws"), we = ji(t, "we")
        if tmr, let ws = ws { let lm = 1440 - nm + ws * 60; line += " · " + L.t("BestIn", "\(lm / 60):" + String(format: "%02d", lm % 60)) }
        else if !tmr, let ws = ws, let we = we {
            let s0 = ws * 60, e0 = (we + 1) * 60
            if nm < s0 { let lm = s0 - nm; line += " · " + L.t("BestIn", "\(lm / 60):" + String(format: "%02d", lm % 60)) }
            else if nm < e0 { line += " · " + L.t("BestNow"); tc = pc(2) }
            else { line += " · " + L.t("BestPast"); tc = pc(7) }
        }
        return ChipV(t: line, col: tc)
    }
}

/* ---------- 1 · Έξοδος / συρτή ---------- */
struct TripV: View {
    @ObservedObject var e = Engine.shared
    var open: (Route) -> Void
    @State private var crown = 0.0
    @State private var crownBase = 0.0
    var body: some View {
        Group {
            if !e.trip.active { TripIdle() }
            else if e.troll == "b" && e.drop != nil { DropV() }
            else if e.troll == "b" { TrollBV() }
            else if e.troll == "s" { TrollSV() }
            else { TripLive() }
        }
        .focusable(e.keysLeads() || e.keysLine())
        .digitalCrownRotation($crown, from: -100000, through: 100000, by: 1, sensitivity: .low, isContinuous: true, isHapticFeedbackEnabled: true)
        .onChange(of: crown) { _, n in
            let d = Int((n - crownBase).rounded())
            if d != 0 { crownBase = n; if !e.afterOn { for _ in 0..<abs(d) { e.keyAct(d > 0 ? 1 : -1) } } }
        }
    }
}

struct TripIdle: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        let days = (ja(e.fc, "days") as? [JO]) ?? []
        let tmr = !days.isEmpty && ji(days[0], "s") == nil && days.count > 1
        let d: JO? = days.isEmpty ? nil : (tmr ? days[1] : days[0])
        let sc = ji(d, "s")
        ZStack {
            RingBG(); if let sc = sc { RingV(a1: 3.6 * Double(sc), col: scoreCol(sc), round: true) }
            VStack(spacing: 3) {
                TitleV(t: L.up(L.t("TripPageU")), dot: pc(13))
                if let d = d { Tx((tmr ? js(d, "n") : L.t("TodayC")) + (js(d, "w").isEmpty ? "" : " · " + js(d, "w")), 11, sc.map { scoreCol($0) } ?? pc(6)) }
                if d != nil && sc == nil { Tx(L.t("Unsafe"), 16, pc(1), b: true) }
                else if let sc = sc { HStack(alignment: .lastTextBaseline, spacing: 1) { Tx("\(sc)", 30, pc(5)); Tx("/100", 10, pc(6)) } }
                Button { e.tripStart() } label: { Tx("▶ " + L.t("TripStart"), 13, .black, b: true).padding(.horizontal, 12).padding(.vertical, 6).background(Capsule().fill(hx(0xFF6B5A))) }.buttonStyle(.plain)
                let now = jo(e.fc, "now"), sq = jo(e.fc, "sq")
                HStack(spacing: 10) {
                    if let p = jd(now, "p") {
                        let pd = jd(now, "pd")
                        StatV(ic: "gauge", v: "\(Int(p))" + (pd == nil ? "" : pd! > 0.4 ? "↑" : pd! < -0.4 ? "↓" : "→"))
                        if let wt = jd(now, "wt") { StatV(ic: "temp", v: L.f0(wt) + "°") }
                        if let il = ji(sq, "il") { StatV(ic: "moon", v: "\(il)%") }
                    } else if let d = d {
                        StatV(ic: "wind", v: ji(d, "b").map { "\($0) Bft" } ?? "-"); StatV(ic: "wave", v: jd(d, "v").map { L.f1($0) + " m" } ?? "-")
                    }
                }
            }.padding(.horizontal, 16)
        }
    }
}

struct TargetRing: View {
    @ObservedObject var e = Engine.shared
    var col: Color
    var body: some View {
        let tg = e.tripTarget(), start = e.trip.start, ts = e.catchTs, track = pc(8), fishC = pc(2)
        Canvas { ctx, size in
            let rect = CGRect(origin: .zero, size: size), w: CGFloat = 6
            ctx.stroke(ArcS(a0: 0, a1: 360, inset: w / 2).path(in: rect), with: .color(track), lineWidth: w)
            guard let tg = tg else { return }
            let span = Double(max(1, tg.0 - start))
            let fr = min(1, max(0, Double(nowS() - start) / span))
            ctx.stroke(ArcS(a0: 0, a1: 360 * fr, inset: w / 2).path(in: rect), with: .color(col), style: StrokeStyle(lineWidth: w, lineCap: .round))
            for t in ts {
                let p = pol(size, size.width / 2 - w / 2, 360 * min(1, max(0, Double(t - start) / span)))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3.5, y: p.y - 3.5, width: 7, height: 7)), with: .color(fishC))
            }
        }
    }
}

/** δαχτυλίδι 24 ωρών της σελίδας «Σήμερα» */
struct DayRing: View {
    var t: JO?; var ch: Int; var nm: Int; var tmr: Bool
    var body: some View {
        let track = pc(8), past = pc(15), green = pc(2), moon = pc(10), now = pc(5), sun = pc(6)
        let h: [Int] = ((ja(t, "h") ?? []).map { ($0 as? NSNumber)?.intValue ?? -1 })
        let r = ji(t, "r"), st = ji(t, "st"), ws = ji(t, "ws"), we = ji(t, "we")
        let ma: [Double] = ((ja(t, "ma") as? [NSNumber]) ?? []).map { $0.doubleValue }
        let mi: [Double] = ((ja(t, "mi") as? [NSNumber]) ?? []).map { $0.doubleValue }
        let cols: [Color] = h.map { scoreCol($0) }
        Canvas { ctx, size in
            let rect = CGRect(origin: .zero, size: size), w: CGFloat = 6
            func arc(_ a0: Double, _ a1: Double, _ c: Color, _ lw: CGFloat) { ctx.stroke(ArcS(a0: a0, a1: a1, inset: w / 2).path(in: rect), with: .color(c), lineWidth: lw) }
            func dot(_ a: Double, _ rr: CGFloat, _ c: Color, _ inset: CGFloat) { let p = pol(size, size.width / 2 - inset, a); ctx.fill(Path(ellipseIn: CGRect(x: p.x - rr, y: p.y - rr, width: rr * 2, height: rr * 2)), with: .color(c)) }
            arc(0, 360, track, w)
            for k in 0..<min(24, h.count) {
                let sc = h[k]
                var ngt = false
                if let r = r, let st = st { ngt = k * 60 + 30 < r - 60 || k * 60 + 30 > st + 60 }
                if ngt || sc < 50 { continue }
                var best = false
                if let ws = ws, let we = we { best = k >= ws && k <= we }
                let c = k + 1 <= ch ? past : (best ? cols[k] : cols[k].opacity(0.8))
                arc(Double(k) * 15 + 0.8, Double(k + 1) * 15 - 0.8, c, w)
            }
            if let ws = ws, let we = we { arc(Double(ws) * 15 + 1, Double(we + 1) * 15 - 1, we + 1 <= ch ? past : green, w * 1.6) }
            for m in ma { dot(m / 4, 3, moon, w / 2) }
            for m in mi { dot(m / 4, 2, moon, w / 2) }
            if let r = r { dot(Double(r) / 4, 2, sun, w * 2.2) }
            if let st = st { dot(Double(st) / 4, 2, sun, w * 2.2) }
            if !tmr { dot(Double(nm) / 4, 4, now, w / 2) }
        }
    }
}

/** δαχτυλίδι της νύχτας στη σελίδα «Καλαμάρι»: σκοτάδι (πράσινο), δύση, ανατολή, τώρα */
struct NightRing: View {
    var dk: [Any]?; var st: Int?; var r: Int?; var nm: Int
    var body: some View {
        let track = pc(8), green = pc(2), set = pc(4), rise = pc(0), now = pc(5)
        let a0 = an(dk, 0), a1 = an(dk, 1)
        Canvas { ctx, size in
            let rect = CGRect(origin: .zero, size: size), w: CGFloat = 6
            func dot(_ a: Double, _ rr: CGFloat, _ c: Color) { let p = pol(size, size.width / 2 - w / 2, a); ctx.fill(Path(ellipseIn: CGRect(x: p.x - rr, y: p.y - rr, width: rr * 2, height: rr * 2)), with: .color(c)) }
            ctx.stroke(ArcS(a0: 0, a1: 360, inset: w / 2).path(in: rect), with: .color(track), lineWidth: w)
            if let a0 = a0, let a1 = a1 { ctx.stroke(ArcS(a0: a0 / 4, a1: a1 < a0 ? a1 / 4 + 360 : a1 / 4, inset: w / 2).path(in: rect), with: .color(green), lineWidth: w) }
            if let st = st { dot(Double(st) / 4, 3.5, set) }
            if let r = r { dot(Double(r) / 4, 3.5, rise) }
            dot(Double(nm) / 4, 4, now)
        }
    }
}

struct TimeLine: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        if e.anchor != nil { let bad = e.anchorD > Double(e.anchorR()); ChipV(t: L.t("AnchorLine", Int(e.anchorD), e.anchorR()), col: bad ? pc(1) : pc(6), solid: bad) }
        else if let tg = e.tripTarget() { let left = tg.0 - nowS(); if left > 0 { ChipV(t: L.t(tg.1 ? "BackIn" : "SunsetIn", Geo.hms(left)), col: pc(0)) } else { ChipV(t: L.t("Late"), col: pc(1), solid: true) } }
        else { ChipV(t: L.t("ClockNow", Geo.minHm(Geo.nowMin())), col: pc(6)) }
    }
}

struct FishBtn: View { var d: CGFloat = 38
    var body: some View { RoundBtn(t: "🐟", col: pc(2), d: d, fg: .black) { Engine.shared.quickFish() } } }

struct TripLive: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        ZStack {
            TargetRing(col: pc(13))
            VStack(spacing: 2) {
                TitleV(t: L.up(L.t("TripPageU")) + (e.trip.hasFix() ? " · GPS" : ""), dot: pc(13))
                Tx(Geo.hms(e.trip.secs()), 34, pc(5))
                TimeLine()
                HStack(spacing: 10) { StatV(ic: "fish", v: "\(e.trip.n)", col: pc(2)); StatV(ic: "path", v: L.f1(e.trip.km) + " km"); StatV(ic: "speed", v: e.trip.spd.map { L.f1($0) + " kn" } ?? "-") }
                if let l = e.catchTs.last { Tx(L.t("LastAgo", (nowS() - l) / 60), 10, pc(6)) }
                FishBtn(d: 34)
            }.padding(.horizontal, 14)
        }
    }
}

struct DropV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        let tot = max(1, Double(e.dropN) * e.secPerLead())
        let rem = e.dropAt + Int(tot) - nowS()
        ZStack {
            RingBG(); RingV(a1: 360 * min(1, max(0, 1 - Double(rem) / tot)), col: pc(4), round: true)
            VStack(spacing: 2) {
                TitleV(t: L.up(L.t("DropT")), dot: pc(4)); Tx(L.up(L.t("DropU")), 10, pc(6))
                HStack(spacing: 8) {
                    SideBtn(t: "−1", col: pc(6)) { e.keyLeads(-1) }
                    VStack(spacing: 0) { Tx("\(e.dropN)", 40, pc(4)); Tx(L.t("LeadsL"), 10, pc(6)) }
                    SideBtn(t: "+1", col: pc(6)) { e.keyLeads(1) }
                }
                if rem > 0 { Tx("↓ " + L.t("ToBottomIn", "\(rem / 60):" + String(format: "%02d", rem % 60)), 11, pc(4)) } else { ChipV(t: L.t("AtBottomQ"), col: pc(2)) }
                RoundBtn(t: "✓", col: pc(2), d: 34, fg: .black) { e.dropSet() }
            }
        }
    }
}

struct TrollBV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        let sp = e.trip.spd
        let col = sp == nil ? pc(6) : (sp! < e.trMin() || sp! > e.trMax()) ? pc(4) : pc(2)
        let cnow = e.clrNow()
        let low = cnow != nil && cnow! < e.clrFa() * 0.66
        ZStack {
            TargetRing(col: pc(12))
            VStack(spacing: 2) {
                TitleV(t: L.up(L.t("TrollBU")) + " · " + Geo.hms(e.trip.secs()), dot: pc(12))
                Tx((sp.map { L.f1($0) } ?? "-") + " kn", 12, col, b: true)
                HStack(spacing: 8) {
                    SideBtn(t: "−1", col: pc(6), long: { e.dropTouched() }) { if !e.keyAct(-1) { e.leadsAdd(-1) } }
                    VStack(spacing: 0) { Tx(e.trLeads.map { "\($0)" } ?? "-", 38, low ? pc(1) : pc(5)); Tx(L.t("LeadsL"), 10, pc(6)) }
                    SideBtn(t: "+1", col: pc(6)) { if !e.keyAct(1) { e.leadsAdd(1) } }
                }
                if let c = cnow {
                    if e.adv < 0 { ChipV(t: L.t("AdvUpU", -e.adv) + (c < 0 ? " · " + L.t("DragU") : ""), col: pc(1), solid: true) }
                    else if e.adv > 0 { ChipV(t: L.t("AdvDnU", e.adv), col: pc(3)) }
                    else { ChipV(t: L.t("AdvOk") + " · " + e.clrTxt(c) + " " + L.t("FmU"), col: pc(2)) }
                } else { ChipV(t: L.t(e.trLeads == nil ? "DropHint" : e.gridBusy ? "ChartLoad" : "NoChart"), col: pc(7)) }
                let bits = [e.bdNow.map { L.t("SeabedL", L.f0($0)) }, e.bdAhead.map { L.t("Ahead", L.f0($0)) }].compactMap { $0 }
                if !bits.isEmpty { Tx(bits.joined(separator: " · "), 10, pc(11)) }
                FishBtn(d: 34)
            }.padding(.horizontal, 12)
        }
    }
}

struct TrollSV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        let sp = e.trip.spd
        let col = sp == nil ? pc(6) : (sp! < e.trMin() || sp! > e.trMax()) ? pc(4) : pc(2)
        let st = e.lineStep()
        ZStack {
            TargetRing(col: pc(12))
            VStack(spacing: 2) {
                TitleV(t: L.up(L.t("TrollSU")) + " · " + Geo.hms(e.trip.secs()), dot: pc(12))
                Tx(sp.map { L.f1($0) } ?? "-", 34, col)
                Tx(L.t("KnotsL") + " · " + L.f1(e.trMin()) + "–" + L.f1(e.trMax()), 10, pc(6))
                GeometryReader { g in
                    let hi = e.trMax() * 1.6
                    let x: (Double) -> CGFloat = { v in CGFloat(min(1, max(0, v / hi))) * g.size.width }
                    ZStack(alignment: .leading) {
                        Capsule().fill(pc(8))
                        Rectangle().fill(pc(2).opacity(0.5)).frame(width: x(e.trMax()) - x(e.trMin())).offset(x: x(e.trMin()))
                        if let sp = sp { Circle().fill(pc(5)).frame(width: 9, height: 9).offset(x: x(sp) - 4.5) }
                    }
                }.frame(width: 110, height: 7)
                HStack(spacing: 8) {
                    SideBtn(t: "−\(st)", col: pc(6)) { e.lineAdd(-st) }
                    VStack(spacing: 0) { Tx("\(e.lineNow()) m", 15, pc(0), b: true); Tx("🐟 \(e.trip.n) · " + L.f1(e.trip.km) + " km", 10, pc(6)) }
                    SideBtn(t: "+\(st)", col: pc(6)) { e.lineAdd(st) }
                }
                FishBtn(d: 34)
            }.padding(.horizontal, 12)
        }
    }
}

/* ---------- 2 · Σημείο ---------- */
struct SpotV: View {
    @ObservedObject var e = Engine.shared
    var open: (Route) -> Void
    var body: some View {
        let ts = e.targets(), c = e.cur
        ZStack {
            if ts.isEmpty { Tx(L.t("NoSpot"), 12, pc(6), lines: 4).padding(20) }
            else {
                let i = min(max(0, e.navT), ts.count - 1), t = ts[i], hd = e.heading() ?? 0
                let br = c.map { Geo.bearing($0.0, $0.1, t.lat, t.lon) }
                let dm = c.map { Geo.dist($0.0, $0.1, t.lat, t.lon) * 1000 }
                RingBG(w: 4)
                if let br = br {
                    let a = br - hd
                    Image(systemName: "location.north.fill").font(.system(size: 34)).foregroundColor(pc(0)).rotationEffect(.degrees(a)).offset(y: -2)
                        .frame(maxHeight: .infinity, alignment: .top).padding(.top, 14)
                    RingV(a0: a - 6, a1: a + 6, col: pc(0), w: 8)
                }
                VStack(spacing: 2) {
                    Spacer().frame(height: 38)
                    TitleV(t: L.up(L.t("SpotU")) + " \(i + 1)/\(ts.count)", dot: pc(0))
                    Tx(t.name, 13, pc(5), b: true)
                    if let dm = dm, let br = br {
                        Tx(Geo.distTxt(dm), 24, pc(5))
                        let sp = (e.trip.spd ?? 0) > 2 ? e.trip.spd! : P.d("boatKn")
                        Tx("\(Int(br))° · ~\(Int((dm / 1852) / sp * 60))′ · " + L.f1(sp) + " kn", 10, pc(6))
                    } else { Tx(L.t("WaitGps"), 11, pc(7)) }
                    Tx(L.t("NavHint"), 9, pc(7))
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { open(.nav) }
    }
}

/* ---------- 3 · Επόμενες μέρες ---------- */
struct DaysV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        let days = (ja(e.fc, "days") as? [JO]) ?? []
        VStack(spacing: 2) {
            TitleV(t: L.up(L.t("DaysU")), dot: pc(2))
            ForEach(Array(days.prefix(6).enumerated()), id: \.offset) { k, d in
                let s = ji(d, "s")
                HStack(spacing: 4) {
                    Tx(js(d, "n"), 11, pc(6)).frame(width: 48, alignment: .leading)
                    Tx(s.map { "\($0)" } ?? "–", 11, s == nil ? pc(7) : scoreCol(s), b: true).frame(width: 26).background(Capsule().fill((s == nil ? pc(15) : scoreCol(s)).opacity(0.22)))
                    Tx(k == 0 && e.dayOver() ? L.t("NightL") : js(d, "w"), 11, pc(5)).frame(width: 38, alignment: .leading)
                    Tx(ji(d, "b").map { "\($0)" } ?? "-", 11, ji(d, "x") == 1 ? pc(1) : pc(6)).frame(width: 14)
                    Tx(jd(d, "v").map { L.f1($0) } ?? "", 10, pc(7))
                }
            }
            Tx(glyph("wind") + " Bft · " + glyph("wave") + " m", 9, pc(7))
        }.padding(.horizontal, 10)
    }
}

/* ---------- 4 · Πίεση ---------- */
struct PressV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        let ps = ((ja(e.fc, "hrs") as? [JO]) ?? []).compactMap { jd($0, "p") }
        let d3 = Baro.d3()
        VStack(spacing: 2) {
            TitleV(t: L.up(L.t("PressU")), dot: pc(14))
            Tx(jd(jo(e.fc, "now"), "p").map { "\(Int($0)) hPa" } ?? "-", 24, pc(5))
            if let d3 = d3 { Tx(L.t("PressWatch") + ": " + (d3.0 >= 0 ? "+" : "") + L.f1(d3.0), 10, abs(d3.0) >= P.d("pressThr") ? pc(1) : pc(6)) }
            else if !Baro.has { Tx(L.t("NoBaro"), 9, pc(7)) }
            if let pr = jo(e.fc, "pr") { Tx(((jd(pr, "d") ?? 0) >= 0 ? L.t("PeakAt") : L.t("LowAt")) + " " + js(pr, "t") + " · \(ji(pr, "to") ?? 0) hPa", 11, pc(14), b: true) }
            if ps.count >= 2 {
                GeometryReader { g in
                    let lo = (ps.min() ?? 0) - 0.5, hi = (ps.max() ?? 1) + 0.5
                    Path { p in for (k, v) in ps.enumerated() { let pt = CGPoint(x: g.size.width * CGFloat(k) / CGFloat(ps.count - 1), y: g.size.height * CGFloat(1 - (v - lo) / (hi - lo))); if k == 0 { p.move(to: pt) } else { p.addLine(to: pt) } } }
                        .stroke(pc(14), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                }.frame(width: 130, height: 40)
                Tx(L.t("PressFcH", ps.count), 9, pc(7))
            }
            ForEach(Array(((ja(e.fc, "tn") as? [JO]) ?? []).prefix(2).enumerated()), id: \.offset) { _, t in
                Tx((js(t, "k") == "peak" ? L.t("Peak") : L.t("Low")) + " · " + js(t, "t"), 10, pc(6)) }
        }.padding(.horizontal, 14)
    }
}

/* ---------- 5 · Καλαμάρι ---------- */
struct SquidV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        if let sq = jo(e.fc, "sq") {
            let il = ji(sq, "il"), nd = jd(sq, "nd"), dk = ja(sq, "dk"), wax = ji(sq, "wx") == 1
            let st = ji(e.td(), "st"), r = ji(e.td(), "r"), nm = Geo.nowMin()
            let verdict: (String, Color) = (dk != nil && (an(dk, 2) ?? 0) == 1 && (il ?? 100) < 40) ? (L.t("VIdeal"), pc(2)) : dk != nil ? (L.t("VGoodTill", Geo.minHm(Int(an(dk, 1) ?? 0))), pc(3)) : (L.t("VBright"), pc(7))
            ZStack {
                NightRing(dk: dk, st: st, r: r, nm: nm)
                VStack(spacing: 2) {
                    TitleV(t: L.up(L.t("SquidU")), dot: pc(10))
                    HStack(spacing: 6) {
                        Image(systemName: moonIcon(il ?? 0, wax)).font(.system(size: 22)).foregroundColor(pc(10))
                        VStack(alignment: .leading, spacing: 0) {
                            Tx("\(il.map { "\($0)" } ?? "-")% · " + L.t((il ?? 0) < 6 ? "PhNew" : (il ?? 0) > 94 ? "PhFull" : wax ? "PhWax" : "PhWane"), 11, pc(5))
                            if let nd = nd { Tx(abs(nd) < 0.6 ? L.t("SubNow") : nd < 0 ? L.t("SubAgo", L.f0(-nd)) : L.t("SubIn", L.f0(nd)), 10, pc(6)) }
                        }
                    }
                    ChipV(t: verdict.0, col: verdict.1)
                    if let a0 = an(dk, 0), let a1 = an(dk, 1) { Tx((an(dk, 2) ?? 0) == 1 ? L.t("TillMorning", Geo.minHm(Int(a0))) : L.t("DarkWin", Geo.minHm(Int(a0)), Geo.minHm(Int(a1))), 10, pc(6)) }
                    ForEach(Array(((ja(sq, "ev") as? [JO]) ?? []).prefix(3).enumerated()), id: \.offset) { k, v in
                        HStack(spacing: 4) { Tx(js(v, "n"), 11, k == 0 ? pc(5) : pc(6)).frame(width: 52, alignment: .leading); Tx(String(format: "%02d:00", ji(v, "h") ?? 0), 11, pc(6)); Tx("\(ji(v, "s") ?? 0)", 11, scoreCol(ji(v, "s")), b: true) }
                    }
                }.padding(.horizontal, 16)
            }
        } else { Tx(L.t("SquidOld"), 12, pc(6), lines: 3).padding(20) }
    }
    func moonIcon(_ il: Int, _ wax: Bool) -> String {
        if il < 6 { return "moonphase.new.moon" }; if il > 94 { return "moonphase.full.moon" }
        if il < 45 { return wax ? "moonphase.waxing.crescent" : "moonphase.waning.crescent" }
        if il < 56 { return wax ? "moonphase.first.quarter" : "moonphase.last.quarter" }
        return wax ? "moonphase.waxing.gibbous" : "moonphase.waning.gibbous"
    }
}

/* ---------- οθόνες πάνω από τις σελίδες ---------- */
struct MsgOverlay: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        if let m = e.msg {
            let col = pc(min(15, max(0, m.ci)))
            ZStack {
                Color.black.opacity(0.93).ignoresSafeArea()
                RingV(a1: 360, col: col, w: 5)
                VStack(spacing: 6) {
                    if let ic = m.icon { Tx(glyph(ic), 20, Color(hex: 0x06261A), b: true).frame(width: 40, height: 40).background(Circle().fill(col)) }
                    Tx(m.text, 14, pc(5), lines: 5)
                }.padding(18)
            }.onTapGesture { e.msgEnd() }
        }
    }
}
struct SavedOverlay: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        if let k = e.lastKind {
            let col = k == "miss" ? pc(1) : k == "pest" ? pc(3) : pc(2)
            ZStack {
                Color.black.opacity(0.94).ignoresSafeArea()
                RingV(a1: 360, col: col, w: 5)
                VStack(spacing: 4) {
                    Tx("✓", 24, Color(hex: 0x06261A), b: true).frame(width: 46, height: 46).background(Circle().fill(col))
                    Tx((k == "miss" ? L.t("Lost") : k == "pest" ? L.t("Pest") : L.t("Fish")) + " · " + e.lastHm, 15, pc(5), b: true)
                    if e.lastN > 0 { Tx(L.t("NthFish", e.lastN), 11, pc(6)) }
                    Tx(e.lastQ ? L.t("QueuedShort") : L.t("Saved"), 11, e.lastQ ? pc(4) : pc(6), lines: 2)
                }
            }.onTapGesture { e.msgEnd() }
        }
    }
}
struct AfterOverlay: View {
    @ObservedObject var e = Engine.shared
    var open: (Route) -> Void
    var body: some View {
        if e.afterOn {
            let left = max(0, 6000 - (e.ms() - e.afterAt))
            ZStack {
                Color.black.opacity(0.95).ignoresSafeArea()
                RingBG(); RingV(a1: 359.5 * left / 6000, col: pc(2))
                VStack(spacing: 3) {
                    RoundBtn(t: "✓", col: pc(2), d: 44) { e.quickFish() }
                    Tx(L.t("FishN", e.trip.n) + " · " + e.lastHm, 14, pc(5), b: true)
                    if e.troll == "b", let l = e.trLeads { Tx("\(l) " + L.t("LeadsL"), 10, pc(6)) }
                    HStack(spacing: 5) {
                        act(L.t("KUndo"), pc(6)) { e.afterUndo() }
                        act(L.t("KLost"), pc(1)) { e.afterLost() }
                        act(L.t("KSp"), pc(0)) { e.afterStop(); if e.speciesList().isEmpty { e.sayK(L.t("NoSp"), "fish", 7) } else { open(.species) }; e.bump() }
                    }
                }
            }
        }
    }
    func act(_ t: String, _ c: Color, _ a: @escaping () -> Void) -> some View {
        Button(action: a) { Tx(t, 10, c, b: true).padding(.horizontal, 6).padding(.vertical, 5).background(Capsule().fill(c.opacity(0.18))) }.buttonStyle(.plain)
    }
}
struct AnchorAlarmV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        if e.anchorAlarm {
            ZStack {
                Color(hex: 0x2A0B08).ignoresSafeArea()
                RingV(a1: 360, col: pc(1), w: 10)
                VStack(spacing: 4) { Tx("⚓ " + L.up(L.t("AnchorU")), 13, pc(1), b: true); Tx(L.t("Drag", Int(e.anchorD)), 20, .white, b: true); ChipV(t: L.t("StopAlarm"), col: pc(1), solid: true) }
            }.onTapGesture { e.anchorOff() }
        }
    }
}
struct WelcomeV: View {
    @ObservedObject var e = Engine.shared
    var body: some View {
        if e.welcome {
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(spacing: 3) {
                    Tx(L.t("WelHi"), 17, pc(0), b: true)
                    Tx(L.t("WelL1"), 11, pc(5), lines: 2); Tx(L.t("WelL2"), 11, pc(6), lines: 2)
                    Tx(L.t("WelL3"), 11, pc(0), lines: 2); Tx(L.t("WelL4"), 10, pc(6), lines: 2)
                    ChipV(t: L.t("Ok"), col: pc(2))
                }.padding(14)
            }.onTapGesture { e.welcomeOk() }
        }
    }
}
