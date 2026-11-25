// Alkyon για Apple Watch: μενού (καταγραφή, συρτή, εργαλεία, στόχος, είδος), τροχός βάθους, μέτρημα ψαριών,
// «Τέλος εξόδου;» και ρυθμίσεις (ό,τι έχει το Connect IQ › Alkyon › Ρυθμίσεις στο Garmin).
import SwiftUI
import WidgetKit

struct ItemV: View {
    var label: String; var sub: String? = nil; var ic: String?; var col: Color; var act: () -> Void
    var body: some View {
        Button(action: act) {
            HStack(spacing: 8) {
                Tx(glyph(ic).isEmpty ? "•" : glyph(ic), 13, col, b: true).frame(width: 24, height: 24).background(Circle().fill(col.opacity(0.18)))
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.system(size: 14, weight: .medium, design: .rounded)).foregroundColor(pc(5)).lineLimit(2)
                    if let s = sub { Text(s).font(.system(size: 11, design: .rounded)).foregroundColor(pc(6)).lineLimit(2) }
                }
                Spacer(minLength: 0)
            }
        }
    }
}
struct Header: View { var t: String; var col: Color; var body: some View { Tx(L.up(t), 12, col, b: true) } }
private func pop(_ path: Binding<[Route]>) { if !path.wrappedValue.isEmpty { path.wrappedValue.removeLast() } }
private func go(_ path: Binding<[Route]>, _ r: Route) { pop(path); path.wrappedValue.append(r) }

/* ---------- μενού καταγραφής ---------- */
struct LogMenu: View {
    @ObservedObject var e = Engine.shared
    @Binding var path: [Route]
    var body: some View {
        List {
            Header(t: L.t("Log"), col: hx(0x3DDC97))
            ItemV(label: L.t("Fish"), sub: L.t("SubFish"), ic: "fish", col: hx(0x3DDC97)) { pop($path); e.logCatch("fish") }
            if e.trip.active && e.troll == "b" { ItemV(label: L.t("Drop"), sub: L.t("SubDrop"), ic: "down", col: hx(0xFFB020)) { go($path, .depth(false)) } }
            ItemV(label: L.t("Lost"), sub: L.t("SubLost"), ic: "x", col: hx(0xE0583A)) { pop($path); e.logCatch("miss") }
            ItemV(label: L.t("Pest"), sub: L.t("SubPest"), ic: "pest", col: hx(0xFFD23A)) { pop($path); e.logCatch("pest") }
            ItemV(label: L.t("GearT"), sub: e.gearSub(), ic: "net", col: hx(0x2EC8C0)) { go($path, .gear) }
            if e.trip.active {
                ItemV(label: L.t("Troll"), sub: e.troll.map { L.t($0 == "b" ? "TrollB" : "TrollS") }, ic: "speed", col: hx(0x3DDC97)) { go($path, .troll) }
                ItemV(label: L.t("TripEnd"), sub: L.t("SubTripEnd", Geo.hms(e.trip.secs()), e.trip.n), ic: "stop", col: hx(0xFF5A4E)) { go($path, .confirm) }
            } else {
                ItemV(label: L.t("TripStart"), sub: L.t("SubTripGo"), ic: "play", col: hx(0xF6B744)) { pop($path); e.tripStart() }
            }
            if e.anchor != nil { ItemV(label: L.t("AnchorOff"), ic: "anchor", col: hx(0x7F8899)) { pop($path); e.anchorOff() } }
            else { ItemV(label: L.t("Anchor"), sub: L.t("SubAnchor", e.anchorR()), ic: "anchor", col: hx(0x9CC3FF)) { pop($path); e.anchorSet() } }
            ItemV(label: L.t("Refresh"), sub: js(e.fc, "at").isEmpty ? nil : L.t("ClockNow", js(e.fc, "at")), ic: "refresh", col: hx(0xA58BFF)) { pop($path); e.load(true) }
            ItemV(label: L.t("Settings"), sub: P.linked ? L.t("Linked", String(P.code.prefix(4)) + "…") : L.t("NotLinked"), ic: "gear", col: hx(0xC4CDD6)) { go($path, .settings) }
        }
        .onAppear { e.afterStop() }
    }
}

/* ---------- μενού συρτής ---------- */
struct TrollMenu: View {
    @ObservedObject var e = Engine.shared
    @Binding var path: [Route]
    var body: some View {
        List {
            Header(t: L.t("Troll"), col: hx(0x2EC8C0))
            if e.troll == "b" {
                if e.drop != nil {
                    ItemV(label: L.t("DownOk"), sub: "\(e.dropN) " + L.t("LeadsL"), ic: "check", col: hx(0x3DDC97)) { pop($path); e.dropSet() }
                    ItemV(label: "+1", ic: "down", col: hx(0xFFD23A)) { pop($path); e.dropAdj(1) }
                    ItemV(label: "-1", ic: "up", col: hx(0xFF8A50)) { pop($path); e.dropAdj(-1) }
                    ItemV(label: L.t("DropAgain"), ic: "down", col: hx(0xFFB020)) { go($path, .depth(false)) }
                    ItemV(label: L.t("CancelL"), ic: "x", col: hx(0xE0583A)) { pop($path); e.dropCancel() }
                } else {
                    if e.adv != 0, let tl = e.trLeads {
                        ItemV(label: L.t(e.adv < 0 ? "AdvUpM" : "AdvDnM", abs(e.adv)), sub: "\(tl + e.adv) " + L.t("LeadsL"), ic: e.adv < 0 ? "up" : "down", col: e.adv < 0 ? hx(0xFF5A4E) : hx(0xFFD23A)) { pop($path); e.advApply() }
                    }
                    ItemV(label: L.t("Drop"), ic: "down", col: hx(0xFFB020)) { go($path, .depth(false)) }
                    if e.trLeads != nil { ItemV(label: L.t("Touched"), sub: L.t("TouchedSub"), ic: "up", col: hx(0xFF5A4E)) { pop($path); e.dropTouched() } }
                    ItemV(label: L.t("DepthQ"), sub: e.chartHere().map { L.t("ChartL", L.f0($0)) } ?? L.t("NoChart"), ic: "down", col: hx(0x4FB3FF)) { go($path, .depth(true)) }
                    ItemV(label: L.t("KdL", L.f2(e.leadFa() * e.kD())), sub: L.t("KdSub"), ic: "anchor", col: hx(0xA58BFF)) { pop($path); e.kdReset() }
                    ForEach([1, -1, 5, -5], id: \.self) { dv in
                        ItemV(label: (dv > 0 ? "+" : "-") + "\(abs(dv)) " + L.t("LeadsL"), sub: e.trLeads.map { "\($0) > \(max(0, $0 + dv))" } ?? L.t("LeadsAuto"), ic: dv > 0 ? "down" : "up", col: dv > 0 ? hx(0xFFD23A) : hx(0xFF8A50)) { pop($path); e.leadsAdd(dv) }
                    }
                    ItemV(label: L.t("LeadsAutoM"), ic: "speed", col: hx(0x2EC8C0)) { pop($path); e.trLeads = nil; e.bump() }
                    Toggle(isOn: Binding(get: { P.b("keysL") }, set: { P.setB("keysL", $0); e.bump() })) { VStack(alignment: .leading) { Text(L.t("KeysL")).font(.system(size: 13)); Text(L.t("KeysSub")).font(.system(size: 10)).foregroundColor(pc(6)) } }
                }
            }
            if e.troll == "s" {
                let ln = e.lineNow(), stp = e.lineStep()
                ItemV(label: "+\(stp) m", sub: "\(ln) > \(min(300, ln + stp)) m", ic: "down", col: hx(0xFFD23A)) { pop($path); e.lineAdd(stp) }
                ItemV(label: "-\(stp) m", sub: "\(ln) > \(max(0, ln - stp)) m", ic: "up", col: hx(0xFF8A50)) { pop($path); e.lineAdd(-stp) }
                ItemV(label: L.t("LnStep", stp), sub: L.t("LnStepSub"), ic: "path", col: hx(0x2EC8C0)) { e.lineStepNext() }
                Toggle(isOn: Binding(get: { P.b("keysL") }, set: { P.setB("keysL", $0); e.bump() })) { Text(L.t("KeysLn")).font(.system(size: 13)) }
            }
            if e.drop == nil {
                ItemV(label: L.t("TrollB"), ic: "anchor", col: hx(0x9CC3FF)) { e.trollSet("b"); e.toTroll(); go($path, .depth(false)) }
                ItemV(label: L.t("TrollS"), ic: "wave", col: hx(0x9CC3FF)) { pop($path); e.trollSet("s"); e.toTroll() }
                if e.troll != nil { ItemV(label: L.t("TrollEnd"), ic: "stop", col: hx(0xFF5A4E)) { pop($path); e.trollSet(nil) } }
            }
        }
    }
}

/* ---------- δίχτυ / παραγάδι / κλουβί ---------- */
struct GearMenu: View {
    @ObservedObject var e = Engine.shared
    @Binding var path: [Route]
    var body: some View {
        let now = nowS(), s = e.gearSetting()
        List {
            Header(t: L.t("GearT"), col: hx(0x2EC8C0))
            if let s = s { ItemV(label: L.t("GearEnd"), sub: js(s, "nm") + " · " + Geo.hms(now - (ji(s, "s0") ?? now)), ic: "check", col: hx(0x3DDC97)) { pop($path); e.gearEndSet() } }
            ForEach(Array(e.gearOut().enumerated()), id: \.offset) { _, o in
                let t0 = ji(o, "s1") ?? ji(o, "s0") ?? now
                ItemV(label: L.t("GearHaulN", js(o, "nm")), sub: L.t("GearIn", Geo.hms(now - t0)), ic: "up", col: hx(0xFFB020)) { e.gearHaulStart(js(o, "id")); go($path, .count(js(o, "id"))) }
            }
            if s == nil {
                ForEach(["net", "ll", "trap"], id: \.self) { t in ItemV(label: L.t("GearNew", e.gearType(t)), ic: "net", col: hx(0x2EC8C0)) { pop($path); e.gearNew(t) } }
            }
        }
    }
}

struct NavMenu: View {
    @ObservedObject var e = Engine.shared
    @Binding var path: [Route]
    var body: some View {
        List {
            Header(t: L.t("Target"), col: hx(0xF6B744))
            ItemV(label: L.t("Fish"), ic: "fish", col: hx(0x3DDC97)) { pop($path); e.logCatch("fish") }
            ForEach(Array(e.targets().enumerated()), id: \.offset) { i, t in
                ItemV(label: t.name, sub: e.cur.map { Geo.distTxt(Geo.dist($0.0, $0.1, t.lat, t.lon) * 1000) }, ic: t.home ? "home" : "pin", col: hx(0xF6B744)) { pop($path); e.navT = i; e.bump() }
            }
        }
    }
}

struct SpeciesMenu: View {
    @ObservedObject var e = Engine.shared
    @Binding var path: [Route]
    var body: some View {
        List {
            Header(t: L.t("SpQ"), col: hx(0xF6B744))
            ForEach(Array(e.speciesList().enumerated()), id: \.offset) { i, sp in ItemV(label: sp.1, ic: "fish", col: hx(0x3DDC97)) { pop($path); e.setSpecies(i) } }
        }
    }
}

/* ---------- τροχός αριθμού: Digital Crown, −/+, ✓ ---------- */
struct PickerV: View {
    var title: String; var col: Color; var minV: Int; var maxV: Int; var unit: String; var bigStep: Int
    var sub: (Int) -> String?
    var ok: (Int) -> Void
    @State var v: Double
    var body: some View {
        let n = si(v.rounded())
        VStack(spacing: 2) {
            TitleV(t: L.up(title), dot: col)
            Tx(n > minV ? "\(n - 1)" : " ", 14, pc(7))
            HStack(spacing: 10) {
                SideBtn(t: "−", col: pc(6)) { v = Double(max(minV, n - 1)) }
                VStack(spacing: 0) { Tx("\(n)", 40, pc(5)); Tx(unit, 10, pc(6)) }
                SideBtn(t: "+", col: pc(6)) { v = Double(min(maxV, n + 1)) }
            }
            Tx(n < maxV ? "\(n + 1)" : " ", 14, pc(7))
            if let s = sub(n) { Tx(s, 10, col) }
            HStack(spacing: 8) {
                Button { v = Double(max(minV, n - bigStep)) } label: { Tx("−\(bigStep)", 11, pc(6), b: true) }.buttonStyle(.plain)
                RoundBtn(t: "✓", col: pc(2), d: 36, fg: .black) { ok(n) }
                Button { v = Double(min(maxV, n + bigStep)) } label: { Tx("+\(bigStep)", 11, pc(6), b: true) }.buttonStyle(.plain)
            }
        }
        .focusable()
        .digitalCrownRotation($v, from: Double(minV), through: Double(maxV), by: 1, sensitivity: .medium, isContinuous: false, isHapticFeedbackEnabled: true)
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct DepthPicker: View {
    var only: Bool
    @Binding var path: [Route]
    var body: some View {
        let e = Engine.shared, ch = e.chartHere()
        let last = ch.map { si($0 + 0.5) } ?? P.i("dropD") ?? 20
        PickerV(title: L.t("DepthQ"), col: hx(0x4FB3FF), minV: 3, maxV: 120, unit: L.t("FmL"), bigStep: 5,
                sub: { d in ch != nil && d == si(ch! + 0.5) ? L.t("ChartSub") : nil },
                ok: { d in pop($path); if only { e.sounderSet(d); e.sayK(L.t("DepthQ") + "\n\(d) " + L.t("FmL"), "down", 11) } else { e.dropStart(d) } },
                v: Double(min(120, max(3, last))))
    }
}

struct CountPicker: View {
    var gid: String
    @Binding var path: [Route]
    var body: some View {
        let e = Engine.shared, it = e.gearItem(gid)
        let t0 = it.flatMap { ji($0, "s1") ?? ji($0, "s0") }
        PickerV(title: L.t("GearCountT") + (it.map { " · " + js($0, "nm") } ?? ""), col: hx(0x2EC8C0), minV: 0, maxV: 999, unit: L.t("FishL"), bigStep: 5,
                sub: { _ in t0.map { L.t("GearIn", Geo.hms(nowS() - $0)) } },
                ok: { n in pop($path); e.gearHaulDone(gid, n) }, v: 0)
            .onDisappear { if e.gearHaul { e.gearHaulCancel() } }
    }
}

struct ConfirmEnd: View {
    @ObservedObject var e = Engine.shared
    @Binding var path: [Route]
    var body: some View {
        ZStack {
            RingV(a1: 360, col: pc(13), w: 5)
            VStack(spacing: 6) {
                Tx(L.t("TripEndT"), 16, pc(5), b: true)
                Tx(Geo.hms(e.trip.secs()) + " · \(e.trip.n) " + L.t("FishL") + " · " + L.f1(e.trip.km) + " km", 11, pc(6))
                HStack(spacing: 16) {
                    VStack(spacing: 2) { RoundBtn(t: "✕", col: pc(15), d: 42, fg: pc(5)) { pop($path) }; Tx(L.t("CancelL"), 10, pc(6)) }
                    VStack(spacing: 2) { RoundBtn(t: "✓", col: pc(2), d: 42, fg: .black) { pop($path); e.tripEnd(true) }; Tx(L.t("SaveL"), 10, pc(6)) }
                }
            }
        }.toolbar(.hidden, for: .navigationBar)
    }
}

/* ---------- ρυθμίσεις ---------- */
struct NumRow: View {
    @ObservedObject var e = Engine.shared
    var label: String; var key: String; var step: Double; var minV: Double; var maxV: Double; var dec: Int; var after: () -> Void = {}
    var body: some View {
        let v = P.d(key)
        HStack(spacing: 4) {
            SideBtn(t: "−", col: pc(6)) { set(v - step) }
            VStack(spacing: 0) { Tx(label, 10, pc(6), lines: 2); Tx(dec == 0 ? L.f0(v) : dec == 1 ? L.f1(v) : L.f2(v), 14, pc(5), b: true) }.frame(maxWidth: .infinity)
            SideBtn(t: "+", col: pc(6)) { set(v + step) }
        }
    }
    func set(_ x: Double) { P.setD(key, (min(maxV, max(minV, x)) / step).rounded() * step); e.bump(); after() }
}

struct SettingsV: View {
    @ObservedObject var e = Engine.shared
    @State private var codeIn = ""
    func tg(_ label: String, _ key: String) -> some View {
        Toggle(isOn: Binding(get: { P.b(key) }, set: { P.setB(key, $0); e.bump() })) { Text(label).font(.system(size: 13)).lineLimit(3) }
    }
    var body: some View {
        List {
            Header(t: L.t("Settings"), col: pc(6))
            Section(header: Tx(L.t("LinkT"), 11, pc(0), b: true)) {
                Tx(P.linked ? L.t("Linked", String(P.code.prefix(4)) + " " + String(P.code.dropFirst(4))) : L.t("NotLinked"), 13, P.linked ? pc(2) : pc(4), b: true)
                if !P.linked { Tx(L.t("LinkAuto"), 10, pc(6), lines: 4) }
                TextField(L.t("EnterCode"), text: $codeIn).textContentType(.oneTimeCode)
                    .onSubmit {
                        P.code = codeIn; codeIn = ""; P.setB("wel", true); P.setD("codeAt", Date().timeIntervalSince1970); e.welcome = false /* 21/11/2026: κωδικός γραμμένος στο ρολόι· παλιότεροι από το iPhone που φτάνουν αργότερα δεν τον αλλάζουν */
                        if P.linked { e.sayK(L.t("LinkedMsg"), "check", 2); e.load(true); Sender.flushBg() }
                        e.bump()
                    }
                if P.linked { ItemV(label: L.t("Unlink"), ic: "x", col: hx(0xE0583A)) { P.code = ""; P.setD("codeAt", Date().timeIntervalSince1970); e.bump() } }
            }
            Section(header: Tx(L.t("Alerts"), 11, pc(0), b: true)) {
                tg(L.t("SetTurn"), "turnAlert"); tg(L.t("SetBest"), "bestAlert"); tg(L.t("SetPress"), "pressAlert")
                NumRow(label: L.t("SetPressThr"), key: "pressThr", step: 1, minV: 1, maxV: 6, dec: 0)
            }
            Section(header: Tx(L.t("Display"), 11, pc(0), b: true)) { tg(L.t("SetNight"), "nightRed"); tg(L.t("Health"), "health") }
            Section(header: Tx(L.t("Trolling"), 11, pc(0), b: true)) {
                NumRow(label: L.t("SetTrMin"), key: "trollMin", step: 0.1, minV: 0.5, maxV: 15, dec: 1)
                NumRow(label: L.t("SetTrMax"), key: "trollMax", step: 0.1, minV: 0.5, maxV: 20, dec: 1)
                NumRow(label: L.t("SetTrLine"), key: "trollLine", step: 5, minV: 5, maxV: 300, dec: 0) { P.setI("trLn", nil) }
                NumRow(label: L.t("SetLeadFa"), key: "leadFa", step: 0.05, minV: 0.3, maxV: 3, dec: 2)
                NumRow(label: L.t("SetClr"), key: "clrFa", step: 0.5, minV: 0, maxV: 10, dec: 1)
                NumRow(label: L.t("SetAnchor"), key: "anchorM", step: 10, minV: 10, maxV: 300, dec: 0)
                NumRow(label: L.t("SetBoatKn"), key: "boatKn", step: 1, minV: 2, maxV: 50, dec: 0)
            }
            Section(header: Tx(L.t("SpotSet"), 11, pc(0), b: true)) {
                Tx(L.f2(P.d("homeLat")) + ", " + L.f2(P.d("homeLon")), 13, pc(5))
                ItemV(label: L.t("UseHere"), ic: "pin", col: hx(0x4FB3FF)) { if let p = e.realPos() { P.setD("homeLat", p.0); P.setD("homeLon", p.1); e.bump() } else { Loc.shared.once(); e.sayK(L.t("WaitGps"), "pin", 7) } }
            }
            Tx(L.t("Version", (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? ""), 9, pc(7))
        }
    }
}
