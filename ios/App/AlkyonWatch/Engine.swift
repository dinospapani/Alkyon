// Alkyon για Apple Watch: η λογική της εφαρμογής (μεταφορά της MainView.mc / AlkGear.mc του Garmin 1.12.25).
// Σελίδες: 0 σήμερα, 1 έξοδος / συρτή, 2 σημείο, 3 επόμενες μέρες, 4 πίεση, 5 καλαμάρι.
import Foundation
import SwiftUI
import WatchKit
import WidgetKit

struct Msg { var text: String; var icon: String?; var ci: Int }
struct Target { var name: String; var lat: Double; var lon: Double; var home = false }

final class Engine: ObservableObject {
    static let shared = Engine()
    @Published var ver = 0
    @Published var pageSel = 0
    func bump() { if Thread.isMainThread { ver &+= 1 } else { DispatchQueue.main.async { self.ver &+= 1 } } }

    var page = 0
    var startRoute: String? = nil
    var visible = false
    var fc: JO? = nil
    var loading = false
    var welcome = false
    var msg: Msg? = nil
    private var msgSeq = 0
    var lastKind: String? = nil
    var lastHm = "", lastQ = false, lastN = 0

    let trip = Track()
    var catchTs: [Int] = []
    var troll: String? = nil       // nil | "s" αφρού | "b" βυθού
    var trLeads: Int? = nil
    var drop: String? = nil
    var dropD = 0, dropN = 0, dropAt = 0
    private var dropInSince = 0, dropAsk = 0, dropAskAt = 0
    private var trOut = 0, trAlarm = 0
    var grid: JO? = nil
    private var gridD: [Int] = []
    var gridBusy = false
    private var gridAt: Double = -999999
    var bdNow: Double? = nil, bdAhead: Double? = nil
    var adv = 0
    private var advSince = 0, advAt = 0, hitAt = 0
    private var depthChk: Double = 0
    var afterOn = false
    var afterAt: Double = 0
    var afterCid: String? = nil
    private var pageAt: Double = 0
    private var spotChk: Double = 0
    private var spotSeen: [Int: Int] = [:]
    private var turnHd: Double? = nil
    private var turnT: Double = 0
    private var turnAlarm = 0
    private var keyAdjAt: Double = 0
    private var keyAdjOld: Int? = nil

    var cur: (Double, Double)? = nil
    var gpsHead: Double? = nil
    var compass: Double? = nil
    var anchor: (Double, Double)? = nil
    private var anchorOut = 0
    var anchorAlarm = false
    var anchorD = 0.0
    private var alarmAt = 0
    private var homeWarned = false
    var navT = 0
    private var arrived: Target? = nil
    var gpsOn = false
    var gearHaul = false
    private var gearWant = false

    private init() {
        fc = P.obj("fc")
        grid = P.obj("grid"); gridD = (grid?["d"] as? [NSNumber])?.map { $0.intValue } ?? []
        welcome = !P.linked && !P.b("wel")
        // έλεγχος στο CI (στιγμιότυπα στον προσομοιωτή): -alkPage N ανοίγει στη σελίδα N, -alkWel 0 χωρίς «Καλώς ήρθες»
        if let s = UserDefaults.standard.string(forKey: "alkPage"), let n = Int(s), (0..<6).contains(n) { page = n; pageSel = n }
        if UserDefaults.standard.string(forKey: "alkWel") == "0" { welcome = false }
        if let r = UserDefaults.standard.string(forKey: "alkRoute") { startRoute = r }
        tripRestore()
        Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.onTick() }
    }
    func ms() -> Double { Date().timeIntervalSince1970 * 1000 }

    /* ---------- 1.14.88: αποθήκευση της εξόδου ---------- */
    private var tripSavedAt = 0, tripSavedN = -1
    var resumed = false
    /** γράφει την κατάσταση της εξόδου· χωρίς force το πολύ μία φορά στα 15″ (σε κάθε νέο σημείο θα ήταν πολύ συχνά) */
    func tripPersist(_ force: Bool = false) {
        guard trip.active else { return }
        let t = nowS()
        if !force && (t - tripSavedAt < 15 || (trip.pts.count == tripSavedN && t - tripSavedAt < 120)) { return }
        var o = trip.snapshot(); o["catchTs"] = catchTs; o["at"] = t
        if let m = troll { o["troll"] = m }
        if let l = trLeads { o["trLeads"] = l }
        P.put("tripSt", o); tripSavedAt = t; tripSavedN = trip.pts.count
    }
    /** στην εκκίνηση: αν υπάρχει ενεργή έξοδος, συνεχίζει από εκεί που έμεινε (μόνο τα δεδομένα· GPS και Υγεία στο tripResume) */
    private func tripRestore() {
        let o = P.obj("tripSt")
        guard trip.restore(o) else { if o != nil { P.put("tripSt", nil) }; return }
        catchTs = ((o?["catchTs"] as? [NSNumber]) ?? []).map { $0.intValue }
        let m = js(o, "troll"); troll = (m == "s" || m == "b") ? m : nil
        trLeads = troll == "b" ? ji(o, "trLeads") : nil
        homeWarned = false; resumed = true; page = 1; pageSel = 1
    }
    /** καλείται από το AppDelegate μετά την εκκίνηση (και από την ανάκτηση προπόνησης του watchOS): ξαναρχίζει GPS και συνεδρία Υγείας */
    func tripResume() {
        guard resumed, trip.active else { return }
        resumed = false
        gpsUpdate(); Health.shared.recover()
        if troll == "b" { gridAt = -999999; gridNeed() }
        vib(.start); sayK(L.t("TripResumed"), "play", 13, 4)
        bump()
    }
    func welcomeOk() { welcome = false; P.setB("wel", true); bump() }

    /* ---------- μηνύματα ---------- */
    func sayK(_ t: String, _ ic: String?, _ ci: Int, _ dur: Double = 2.5) {
        msg = Msg(text: t, icon: ic, ci: ci); lastKind = nil
        msgSeq += 1; let my = msgSeq
        DispatchQueue.main.asyncAfter(deadline: .now() + dur) { [weak self] in guard let s = self, s.msgSeq == my else { return }; s.msg = nil; s.lastKind = nil; s.bump() }
        bump()
    }
    func msgEnd() { msgSeq += 1; msg = nil; lastKind = nil; bump() }

    /* ---------- πρόγνωση ---------- */
    func realPos() -> (Double, Double)? { cur ?? Loc.shared.last() }
    func pos() -> (Double, Double) { realPos() ?? (P.d("homeLat"), P.d("homeLon")) }
    func load(_ force: Bool) {
        if loading { return }
        if !force, let f = fc, nowS() - (ji(f, "got") ?? 0) < 1800 { return }
        let p = pos()
        P.put("loc", [p.0, p.1])
        loading = true; bump()
        Task {
            let d = await Api.forecast(p.0, p.1)
            await MainActor.run {
                self.loading = false
                if var d = d { d["got"] = nowS(); self.fc = d; P.put("fc", d); WidgetCenter.shared.reloadAllTimelines() }
                self.bump()
            }
        }
    }
    func td() -> JO? { jo(fc, "td") }
    func dayOver() -> Bool { guard let st = ji(td(), "st") else { return false }; return Geo.nowMin() + 30 > st + 60 }
    func isNight() -> Bool {
        if !P.b("nightRed") { return false }
        let t = td(), m = Geo.nowMin(), r = ji(t, "r") ?? 360, s = ji(t, "st") ?? 1140
        return m > s + 30 || m < r - 30
    }

    /* ---------- δόνηση ---------- */
    func vib(_ k: WKHapticType, _ times: Int = 1) {
        WKInterfaceDevice.current().play(k)
        if times > 1 { for i in 1..<times { DispatchQueue.main.asyncAfter(deadline: .now() + 0.45 * Double(i)) { WKInterfaceDevice.current().play(k) } } }
    }

    /* ---------- GPS ---------- */
    func gpsUpdate() {
        let need = trip.active || (page == 2 && visible) || anchor != nil || gearHaul || gearSetting() != nil
        if need && !gpsOn { gpsOn = true; Loc.shared.start() }
        else if !need && gpsOn { gpsOn = false; Loc.shared.stop() }
    }
    func onPos(_ lat: Double, _ lon: Double, _ speed: Double?, _ heading: Double?, _ acc: Double?) {
        if lat == 0 && lon == 0 { return }
        cur = (lat, lon)
        gearFix(lat, lon)
        if let h = heading, (speed ?? 0) > 1.0 { gpsHead = h }
        if trip.active { trip.onPos(lat, lon, speed, heading, acc); tripPersist() }
        checkAnchor(); checkArrive(); checkTroll(); checkDepth(); checkSpots(); checkAutoDown(); checkTurn()
        bump()
    }
    func anchorR() -> Int { let r = si(P.d("anchorM")); return r < 10 ? 40 : r }
    private func checkAnchor() {
        guard let a = anchor, let c = cur else { return }
        anchorD = Geo.dist(a.0, a.1, c.0, c.1) * 1000
        anchorOut = anchorD > Double(anchorR()) ? anchorOut + 1 : 0
        let now = nowS()
        if anchorOut >= 5 && (!anchorAlarm || now - alarmAt >= 20) {
            anchorAlarm = true; alarmAt = now
            vib(.failure, 3)
            Notify.show(L.up(L.t("AnchorU")) + " · " + L.t("Drag", si(anchorD)), id: "anchor")
            bump()
        }
    }
    func anchorSet() {
        if cur == nil { cur = realPos() }
        guard let c = cur else { gpsUpdate(); sayK(L.t("WaitGps"), "pin", 7); return }
        anchor = c; anchorOut = 0; anchorAlarm = false
        gpsUpdate(); sayK(L.t("AnchorSet", anchorR()), "anchor", 11)
    }
    func anchorOff() { anchor = nil; anchorAlarm = false; anchorOut = 0; gpsUpdate(); bump() }

    func targets() -> [Target] {
        var a: [Target] = []
        if trip.active, let p0 = trip.p0 { a.append(Target(name: L.t("TripStartPt"), lat: p0.0, lon: p0.1, home: true)) }
        let lc = P.arr("lastc")
        if lc.count >= 3, let la = an(lc, 0), let lo = an(lc, 1), let ts = an(lc, 2) { a.append(Target(name: L.t("LastFish") + " " + Geo.tsHm(si(ts)), lat: la, lon: lo)) }
        if let an0 = anchor { a.append(Target(name: L.t("Anchor"), lat: an0.0, lon: an0.1)) }
        for e in (ja(fc, "sp") ?? []) { guard let r = e as? [Any], r.count >= 3, let la = an(r, 1), let lo = an(r, 2) else { continue }
            let n = (r[0] as? String) ?? ""; a.append(Target(name: n.isEmpty ? L.t("Spot") : n, lat: la, lon: lo)) }
        return a
    }
    func heading() -> Double? { compass ?? gpsHead }
    private func checkArrive() {
        guard let c = cur, trip.active else { return }
        if let ar = arrived { if Geo.dist(c.0, c.1, ar.lat, ar.lon) * 1000 > 150 { arrived = nil }; return }
        for t in targets() where !t.home {
            if Geo.dist(c.0, c.1, t.lat, t.lon) * 1000 <= 50 { arrived = t; vib(.notification, 2); sayK(L.t("Arrived") + "\n" + t.name, "pin", 0); return }
        }
    }

    /* ---------- συρτή ---------- */
    func trMin() -> Double { P.d("trollMin") }
    func trMax() -> Double { P.d("trollMax") }
    private func checkTroll() {
        guard troll != nil, trip.active, let sp = trip.spd else { trOut = 0; return }
        let now = nowS(), lo = sp < trMin(), hi = sp > trMax()
        if !lo && !hi { trOut = 0; return }
        if trOut == 0 { trOut = now }
        if now - trOut >= 20 && now - trAlarm >= 60 {
            trAlarm = now; vib(lo ? .directionDown : .directionUp, 2); toTroll()
            sayK(L.t(lo ? "TrollSlow" : "TrollFast") + "\n" + L.f1(sp) + " kn (" + L.f1(trMin()) + "–" + L.f1(trMax()) + ")", "speed", 4)
        }
    }
    func trollSet(_ m: String?) {
        troll = m; trOut = 0; adv = 0
        defer { tripPersist(true) }
        if m == "b" { gridAt = -999999; gridNeed() }
        if m != "b" { drop = nil }
        if m == nil { trLeads = nil }
        bump()
    }
    func leadsAdd(_ d: Int) {
        let base = trLeads ?? P.i("trLeads") ?? 20
        let n = min(80, max(1, base + d)); trLeads = n; P.setI("trLeads", n)
        sayK(L.t("Leads") + "\n\(n)", "check", 6)
    }
    func leadFa() -> Double { let v = P.d("leadFa"); return v <= 0 ? 1 : v }
    func clrFa() -> Double { P.d("clrFa") }
    func kD() -> Double { P.dn("kD") ?? 1 }
    func sf() -> Double { guard let v = trip.spd, v >= 0.8 else { return 1 }; return min(1.3, max(0.75, pow((trMin() + trMax()) / 2 / v, 0.7))) }
    func faPerLead() -> Double { leadFa() * kD() * sf() }
    func kdReset() { P.setD("kD", 1); depthChk = 0; sayK(L.t("KdL", L.f2(leadFa())), "check", 6) }
    func clrTxt(_ c: Double) -> String { (c < 3 && c > -3) ? L.f1(c) : L.f0(c) }
    func recN(_ d: Double) -> Int {
        let fpl = faPerLead(), cl = clrFa()
        var n = si((d - cl) / fpl)
        let c0 = d - Double(n) * fpl, c1 = d - Double(n + 1) * fpl
        if c1 >= cl * 0.66 && abs(c1 - cl) < abs(c0 - cl) { n += 1 }
        return min(80, max(1, n))
    }
    func dropStart(_ d: Int) {
        sounderSet(d)
        dropAt = nowS(); dropInSince = 0; dropAsk = 0; dropD = d; dropN = recN(Double(d)); drop = "d"
        P.setI("dropD", d); toTroll(); vib(.start); bump()
    }
    func dropAdj(_ d: Int) { dropN = min(80, max(1, dropN + d)); bump() }
    func dropSet() { learnDrop(); trLeads = dropN; P.setI("trLeads", dropN); drop = nil; sayK(L.t("DownOk") + "\n\(dropN) " + L.t("LeadsL"), "check", 4) }
    func dropCancel() { drop = nil; bump() }
    func dropTouched() {
        if let old = keyAdjOld, ms() - keyAdjAt < 2000 { trLeads = old; P.setI("trLeads", old) }
        keyAdjOld = nil
        let n = trLeads ?? dropN
        if dropD <= 0, let d = P.i("dropD") { dropD = d }
        if n < 1 || dropD <= 0 { leadsAdd(-1); return }
        if let b = bdNow { dropD = si(b) }
        let ratio = min(1.35, max(0.75, Double(dropD) / (Double(n) * leadFa() * sf())))
        let nw = min(1.6, max(0.6, kD() * 0.6 + ratio * 0.4))
        P.setD("kD", nw)
        let m = max(1, n - 1); trLeads = m; P.setI("trLeads", m)
        vib(.retry, 2); adv = 0; advSince = 0; advAt = nowS()
        sayK(L.t("TouchedMsg", m, L.f2(nw)), "up", 1)
    }

    /* ---------- χάρτης βυθού ---------- */
    func gridNeed() {
        guard troll == "b", trip.active, !gridBusy, let p = cur ?? realPos() else { return }
        if grid != nil && gridIn(p.0, p.1, 4) { return }
        let t = ms(); if t - gridAt < 120000 { return }
        gridAt = t; gridBusy = true; bump()
        Task {
            let g = await Api.grid(p.0, p.1)
            await MainActor.run {
                self.gridBusy = false
                if let g = g { self.grid = g; self.gridD = (g["d"] as? [NSNumber])?.map { $0.intValue } ?? []; P.put("grid", g); self.depthChk = 0 }
                self.bump()
            }
        }
    }
    private func gridIn(_ lat: Double, _ lon: Double, _ m: Double) -> Bool {
        guard let g = grid, let x0 = jd(g, "x0"), let dx = jd(g, "dx"), let y0 = jd(g, "y0"), let dy = jd(g, "dy") else { return false }
        let fx = (lon - x0) / dx, fy = (y0 - lat) / dy
        return fx >= m && fy >= m && fx <= Double((ji(g, "w") ?? 0) - 1) - m && fy <= Double((ji(g, "h") ?? 0) - 1) - m
    }
    func chartFa(_ lat: Double, _ lon: Double) -> Double? {
        guard let g = grid, let x0 = jd(g, "x0"), let dx = jd(g, "dx"), let y0 = jd(g, "y0"), let dy = jd(g, "dy"), let w = ji(g, "w"), let h = ji(g, "h"), !gridD.isEmpty else { return nil }
        let fx = (lon - x0) / dx, fy = (y0 - lat) / dy
        if fx < 0 || fy < 0 || fx > Double(w - 1) || fy > Double(h - 1) { return nil }
        let i = si(floor(fx)), j = si(floor(fy)), i1 = i + 1 < w ? i + 1 : i, j1 = j + 1 < h ? j + 1 : j
        let a = fx - Double(i), b = fy - Double(j)
        func at(_ x: Int, _ y: Int) -> Double { let k = y * w + x; return k < gridD.count ? Double(gridD[k]) : 0 }
        let v00 = at(i, j), v10 = at(i1, j), v01 = at(i, j1), v11 = at(i1, j1)
        var v: Double
        if v00 > 0 && v10 > 0 && v01 > 0 && v11 > 0 { v = v00 * (1 - a) * (1 - b) + v10 * a * (1 - b) + v01 * (1 - a) * b + v11 * a * b }
        else { v = a < 0.5 ? (b < 0.5 ? v00 : v01) : (b < 0.5 ? v10 : v11); if v <= 0 { return nil } }
        return v / 1.8288
    }
    func dOff() -> Double { P.dn("dOff") ?? 0 }
    func seaFa(_ lat: Double, _ lon: Double) -> Double? { guard let c = chartFa(lat, lon) else { return nil }; return max(1, c + dOff()) }
    func sounderSet(_ d: Int) {
        guard let p = cur ?? realPos(), let c = chartFa(p.0, p.1) else { return }
        P.setD("dOff", min(15, max(-15, Double(d) - c))); depthChk = 0
    }
    func chartHere() -> Double? { guard let p = cur ?? realPos() else { return nil }; return seaFa(p.0, p.1) }
    private func hdg() -> Double? { gpsHead ?? trip.lastHd }
    func lureBack(_ n: Int) -> Double { max(25, Double(n) * faPerLead() * 1.8288 * 1.3) }
    private func checkDepth() {
        guard troll == "b", trip.active, let c = cur else { return }
        gridNeed()
        let t = ms(); if t - depthChk < 3000 { return }; depthChk = t
        let n = trLeads, hd = hdg()
        var lp = c, ap = c
        if let h = hd, let n = n { lp = Geo.fwd(c.0, c.1, h + 180, lureBack(n)); ap = Geo.fwd(c.0, c.1, h, 120) }
        let bl = seaFa(lp.0, lp.1) ?? seaFa(c.0, c.1)
        bdNow = bl; bdAhead = seaFa(ap.0, ap.1)
        guard let b = bl, let nn = n, drop == nil else { adv = 0; return }
        dropD = si(b)
        let now = nowS(), lure = Double(nn) * faPerLead()
        if let ba = bdAhead, ba < lure + 0.3, now - hitAt >= 60 {
            hitAt = now
            let k2 = (lure - ba + clrFa()) / faPerLead() + 0.99
            vib(.failure, 3); toTroll(); sayK(L.t("HitAhead", si(k2), L.f0(ba)), "up", 1); return
        }
        var use = b; if let ba = bdAhead, ba < use { use = ba }
        var dlt = recN(use) - nn
        if dlt == 1 && use - lure - clrFa() < faPerLead() * 1.5 { dlt = 0 }
        if dlt == -1 && use - lure >= clrFa() * 0.66 { dlt = 0 }
        if dlt == 0 { adv = 0; advSince = 0; return }
        if adv == 0 || (adv > 0) != (dlt > 0) { advSince = now }
        adv = dlt
        if now - advSince >= 15 && now - advAt >= 60 {
            advAt = now; vib(dlt < 0 ? .directionUp : .directionDown, dlt < 0 ? 2 : 1); toTroll()
            sayK(L.t(dlt < 0 ? "AdvUp" : "AdvDown", abs(dlt), L.f0(use)), dlt < 0 ? "up" : "down", dlt < 0 ? 1 : 3)
        }
    }
    func clrNow() -> Double? { guard let b = bdNow, let n = trLeads else { return nil }; return b - Double(n) * faPerLead() }
    private func checkSpots() {
        guard let c = cur, troll != nil, trip.active, let tc = ja(fc, "tc") else { return }
        let t = ms(); if t - spotChk < 5000 { return }; spotChk = t
        let now = nowS()
        for (i, e) in tc.enumerated() {
            guard let p = e as? [Any], let la = an(p, 0), let lo = an(p, 1) else { continue }
            if Geo.dist(c.0, c.1, la, lo) * 1000 > 80 { continue }
            if let last = spotSeen[i], now - last < 900 { continue }
            spotSeen[i] = now
            var info = ""
            if let n = an(p, 2) { info = "\(si(n)) " + L.t("LeadsL") }
            if let bd = an(p, 3) { info += (info.isEmpty ? "" : " · ") + L.t("SeabedL", si(bd)) }
            vib(.notification, 2); toTroll()
            sayK(L.t("SpotHit") + "\n" + (info.isEmpty ? L.t("SpotHere") : L.t("SpotThen", info)), "fish", 2); return
        }
    }
    func secPerLead() -> Double { P.dn("spl") ?? 8 }
    private func learnDrop() {
        guard dropAt > 0, dropN >= 1 else { return }
        let m = Double(nowS() - dropAt) / Double(dropN)
        if m < 2 || m > 40 { return }
        P.setD("spl", secPerLead() * 0.7 + m * 0.3)
    }
    private func checkAutoDown() {
        guard drop != nil, troll == "b", trip.active, let sp = trip.spd else { dropInSince = 0; return }
        let now = nowS()
        if sp < trMin() || sp > trMax() { dropInSince = 0; return }
        if dropInSince == 0 { dropInSince = now }
        let need = Double(dropN) * secPerLead() + 20
        if dropAsk < 2 && Double(now - dropAt) >= need && now - dropInSince >= 30 && (dropAsk == 0 || now - dropAskAt >= 60) {
            dropAsk += 1; dropAskAt = now; vib(.notification, 2); toTroll()
            sayK(L.t("AutoDown", dropN), "down", 4)
        }
    }
    private func checkTurn() {
        guard troll == "b", trLeads != nil, drop == nil, let gh = gpsHead, let sp = trip.spd, sp >= 1 else { turnHd = nil; return }
        let t = ms()
        guard let th = turnHd, t - turnT <= 15000 else { turnHd = gh; turnT = t; return }
        var d = abs(gh - th); while d > 360 { d -= 360 }; if d > 180 { d = 360 - d }
        let now = nowS()
        if d > 40 && now - turnAlarm >= 60 { turnAlarm = now; turnHd = nil; vib(.click, 2); toTroll(); sayK(L.t("TurnMsg"), "path", 4) }
    }

    /* ---------- κουμπιά στη συρτή ---------- */
    func toTroll() { if page != 1 { page = 1; pageAt = ms(); pageSel = 1; gpsUpdate() } }
    func trollPage() -> Bool { page == 1 && troll != nil && trip.active }
    func quickFish() {
        logCatch("fish")
        if !P.linked { return }
        msgEnd(); afterOn = true; afterAt = ms()
        let my = afterAt
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in guard let s = self, s.afterAt == my, s.afterOn else { return }; s.afterOn = false; s.bump() }
        bump()
    }
    func afterStop() { afterOn = false }
    private func fixItem(_ kind: String) -> JO { ["ts": nowS(), "tz": Geo.tzMin(), "k": kind, "cid": afterCid ?? ""] }
    func afterUndo() {
        afterStop(); guard afterCid != nil else { return }
        Sender.add(fixItem("undo")); Sender.flushBg()
        if trip.n > 0 { trip.n -= 1 }; if !catchTs.isEmpty { catchTs.removeLast() }
        tripPersist(true)
        afterCid = nil; vib(.click, 2); sayK(L.t("Undone"), "undo", 6)
    }
    func afterLost() {
        afterStop(); guard afterCid != nil else { return }
        var it = fixItem("upd"); it["miss"] = 1; Sender.add(it); Sender.flushBg()
        if trip.n > 0 { trip.n -= 1 }; if !catchTs.isEmpty { catchTs.removeLast() }
        tripPersist(true)
        sayK(L.t("LostOk"), "x", 1)
    }
    func speciesList() -> [(String, String)] {
        let ls = (ja(fc, "tsp") as? [String]) ?? [], lb = (ja(fc, "tspl") as? [String]) ?? []
        return ls.enumerated().map { ($0.element, $0.offset < lb.count && !lb[$0.offset].isEmpty ? lb[$0.offset] : $0.element) }
    }
    func setSpecies(_ i: Int) {
        let ls = speciesList(); guard afterCid != nil, i >= 0, i < ls.count else { return }
        var it = fixItem("upd"); it["sp"] = ls[i].0; Sender.add(it); Sender.flushBg()
        sayK(L.t("SpQ") + "\n" + ls[i].1, "fish", 0)
    }
    @discardableResult
    func keyAct(_ d: Int) -> Bool {
        if keysLeads() { keyLeads(d); return true }
        if keysLine() { lineAdd(d * lineStep()); return true }
        return false
    }
    func keysLeads() -> Bool { page == 1 && troll == "b" && trip.active && P.b("keysL") }
    func keysLine() -> Bool { page == 1 && troll == "s" && trip.active && P.b("keysL") }
    func lineNow() -> Int { P.i("trLn") ?? si(P.d("trollLine")) }
    func lineStep() -> Int { P.i("trLs") ?? 5 }
    func lineStepNext() { let s = lineStep(); P.setI("trLs", s == 1 ? 5 : s == 5 ? 10 : 1); bump() }
    func lineAdd(_ d: Int) { if msg != nil { msgEnd() }; P.setI("trLn", min(300, max(0, lineNow() + d))); vib(.click); bump() }
    func lurePos(_ p: (Double, Double)?, _ m: Int) -> (Double, Double)? { guard let p = p, let hd = hdg(), m > 0 else { return nil }; return Geo.fwd(p.0, p.1, hd + 180, Double(m)) }
    func keyLeads(_ d: Int) {
        if msg != nil { msgEnd() }
        if drop != nil { dropAdj(d) }
        else {
            let base = trLeads ?? P.i("trLeads") ?? 20
            keyAdjOld = trLeads; keyAdjAt = ms()
            let n = min(80, max(1, base + d)); trLeads = n; P.setI("trLeads", n)
            adv = 0; advSince = 0; depthChk = 0; advAt = nowS(); checkDepth()
        }
        vib(.click); bump()
    }
    func advApply() {
        guard let l = trLeads, adv != 0 else { return }
        let n = min(80, max(1, l + adv)); trLeads = n; P.setI("trLeads", n); adv = 0; advSince = 0; advAt = nowS(); depthChk = 0
        sayK(L.t("Leads") + "\n\(n)", "check", 6)
    }
    func tripTarget() -> (Int, Bool)? {
        let now = nowS()
        if let due = ji(fc, "due"), due > trip.start { return (due, true) }
        guard let st = ji(td(), "st") else { return nil }
        let ss = now + (st - Geo.nowMin()) * 60
        return ss > trip.start ? (ss, false) : nil
    }
    private func checkHome() {
        guard let c = cur, let p0 = trip.p0, trip.active, !homeWarned, let tg = tripTarget() else { return }
        let km = Geo.dist(c.0, c.1, p0.0, p0.1)
        var kn = P.d("boatKn"); if kn < 2 { kn = 15 }
        let eta = (km / 1.852) / kn * 3600
        if Double(nowS()) >= Double(tg.0) - eta - 600 { homeWarned = true; vib(.notification, 2); sayK(L.t("HeadBack", si(eta / 60 + 1)), "home", 4) }
    }

    /* ---------- καταγραφή ---------- */
    func logCatch(_ kind: String) {
        var p = cur ?? realPos()
        let ts = nowS()
        var item: JO = ["ts": ts, "tz": Geo.tzMin(), "k": kind]
        let cid = "c\(ts)" + String(format: "%03d", si(ms().truncatingRemainder(dividingBy: 1000)))
        item["cid"] = cid; afterCid = cid
        if let p = p { item["lat"] = Geo.r5(p.0); item["lon"] = Geo.r5(p.1) }
        if let tr = troll, kind == "fish", trip.active {
            var o: JO = ["m": tr]
            if let s = trip.spd { o["kn"] = (s * 10).rounded() / 10 }
            if let h = trip.lastHd { o["hd"] = si(h) }
            if tr == "b", let l = trLeads { o["n"] = l }
            if tr == "b", let b = bdNow { o["bd"] = (b * 10).rounded() / 10; if let l = trLeads { o["cl"] = ((b - Double(l) * faPerLead()) * 10).rounded() / 10 } }
            if tr == "s" { o["ln"] = lineNow() }
            item["tr"] = o
        }
        if trip.active { item["trip"] = trip.onCatch(kind) ?? ""; if kind == "fish" { catchTs.append(ts) }; tripPersist(true) }
        Sender.add(item)
        if troll == "s" && kind == "fish" && trip.active, let lp = lurePos(p, lineNow()) { p = lp }
        if let p = p { P.put("lastc", [p.0, p.1, ts]) }
        vib(.success)
        if !P.linked { sayK(L.t("NoCode"), "x", 1); return }
        lastHm = Geo.tsHm(ts); lastQ = false; lastN = (trip.active && kind == "fish") ? trip.n : 0
        msg = nil; lastKind = kind
        msgSeq += 1; let my = msgSeq
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in guard let s = self, s.msgSeq == my else { return }; s.lastKind = nil; s.bump() }
        bump()
        Sender.flushBg { [weak self] r in
            guard let s = self else { return }
            if r == nil { s.sayK(L.t("NoCode"), "x", 1) } else if r == false { s.lastQ = true; s.bump() } else { s.bump() }
        }
    }
    func tripStart() {
        trip.begin(); catchTs = []; homeWarned = false; resumed = false
        tripPersist(true)
        vib(.start); page = 1; pageSel = 1
        Health.shared.start()
        gpsUpdate()
        sayK(L.t("TripStarted"), "play", 13)
    }
    func tripEnd(_ save: Bool) {
        troll = nil; trLeads = nil; drop = nil
        let it = trip.finish(save)
        P.put("tripSt", nil); tripSavedN = -1; tripSavedAt = 0; resumed = false
        gpsUpdate()
        Health.shared.stop(save)
        if let it = it { Sender.add(it); Sender.flushBg(); vib(.stop); sayK(L.t("TripSaved"), "stop", 13) }
        bump()
    }
    private func onTick() {
        checkHome(); tripPersist()
        if troll != nil && trip.active && page != 1 && ms() - pageAt > 60000 { toTroll() }
        bump()
    }
    func setPage(_ p: Int) { if p == page { return }; page = p; pageAt = ms(); gpsUpdate(); bump() }

    /* ---------- δίχτυ / παραγάδι / κλουβί ---------- */
    func gear() -> [JO] { (P.arr("gear") as? [JO]) ?? [] }
    private func gearPut(_ g: [JO]) { P.put("gear", g) }
    func gearType(_ t: String) -> String { L.t(t == "ll" ? "GearLl" : t == "trap" ? "GearTrap" : "GearNet") }
    func gearSetting() -> JO? { gear().first { js($0, "st") == "set" } }
    func gearOut() -> [JO] { gear().filter { js($0, "st") == "out" } }
    func gearSub() -> String {
        if let s = gearSetting() { return L.t("GearSetting", js(s, "nm")) }
        let o = gearOut(); if !o.isEmpty { return L.t("GearOut", o.count) }
        return L.t("GearSub")
    }
    private func gearPos() -> Any {
        guard let p = cur ?? realPos() else { gearWant = true; return NSNull() }
        return [Geo.r5(p.0), Geo.r5(p.1)]
    }
    private func isNil(_ o: JO, _ k: String) -> Bool { o[k] == nil || o[k] is NSNull }
    private func gearFix(_ lat: Double, _ lon: Double) {
        guard gearWant else { return }
        gearWant = false
        var g = gear(); let p = [Geo.r5(lat), Geo.r5(lon)]; var ch = false
        for i in g.indices {
            if isNil(g[i], "sa") { g[i]["sa"] = p; ch = true }
            if isNil(g[i], "sb") && js(g[i], "st") == "out" { g[i]["sb"] = p; ch = true }
            if !isNil(g[i], "h0") && isNil(g[i], "ha") { g[i]["ha"] = p; ch = true }
        }
        if ch { gearPut(g) }
    }
    private func gearSend(_ it: JO, _ n: Int?) {
        var item: JO = ["ts": nowS(), "tz": Geo.tzMin(), "k": "gear", "gid": js(it, "id"), "gt": js(it, "t"), "gnm": js(it, "nm"), "gst": js(it, "st") == "done" ? "done" : "out"]
        for k in ["s0", "s1", "sa", "sb", "h0", "h1", "ha", "hb"] where !isNil(it, k) { item[k] = it[k] }
        if let n = n { item["n"] = n }
        Sender.add(item); Sender.flushBg()
    }
    func gearNew(_ t: String) {
        let now = nowS(); var g = gear()
        var seq = P.obj("gseq") ?? [:]; let k = (ji(seq, t) ?? 0) + 1; seq[t] = k; P.put("gseq", seq)
        let p = gearPos(), trap = t == "trap"
        var it: JO = ["id": "g\(now)" + String(format: "%03d", si(ms().truncatingRemainder(dividingBy: 1000))), "t": t, "nm": gearType(t) + " \(k)", "st": trap ? "out" : "set", "s0": now, "sa": p]
        if trap { it["s1"] = now; it["sb"] = p }
        g.append(it); gearPut(g); gpsUpdate(); vib(.success)
        if trap { gearSend(it, nil); sayK(L.t("GearOutMsg", js(it, "nm")), "net", 12) } else { sayK(L.t("GearSetMsg", js(it, "nm")), "down", 12) }
    }
    func gearEndSet() {
        var g = gear(); let now = nowS()
        guard let i = g.firstIndex(where: { js($0, "st") == "set" }) else { return }
        g[i]["st"] = "out"; g[i]["s1"] = now; let p = gearPos(); g[i]["sb"] = p
        if isNil(g[i], "sa") { g[i]["sa"] = p }
        gearPut(g); gpsUpdate(); vib(.success); gearSend(g[i], nil)
        sayK(L.t("GearOutMsg", js(g[i], "nm")), "net", 12)
    }
    func gearHaulStart(_ gid: String) {
        var g = gear(); guard let i = g.firstIndex(where: { js($0, "id") == gid }) else { return }
        g[i]["h0"] = nowS(); g[i]["ha"] = gearPos(); gearPut(g); gearHaul = true; gpsUpdate()
    }
    func gearHaulCancel() { gearHaul = false; gpsUpdate() }
    func gearHaulDone(_ gid: String, _ n: Int) {
        let g = gear(); let now = nowS()
        guard var d = g.first(where: { js($0, "id") == gid }) else { gearHaul = false; gpsUpdate(); return }
        d["st"] = "done"; d["h1"] = now
        let p = gearPos(); d["hb"] = (p is NSNull) ? (d["ha"] ?? NSNull()) : p
        if isNil(d, "ha") { d["ha"] = d["hb"] }
        if isNil(d, "h0") { d["h0"] = now }
        gearHaul = false
        gearPut(g.filter { js($0, "id") != gid }); gearSend(d, n); gpsUpdate(); vib(.success)
        let t0 = ji(d, "s1") ?? ji(d, "s0") ?? now
        sayK(L.t("GearDoneMsg", js(d, "nm"), n, Geo.hms((ji(d, "h0") ?? now) - t0)), "fish", 2)
    }
    func gearItem(_ gid: String) -> JO? { gear().first { js($0, "id") == gid } }
}
