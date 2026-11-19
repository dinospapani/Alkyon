// Alkyon για Apple Watch: GPS (και με σβηστή οθόνη, μέσω προπόνησης «Ψάρεμα»), ειδοποιήσεις, παρασκήνιο
// (καμπές πίεσης, καλύτερη ώρα, βαρόμετρο), κωδικός σύνδεσης από το iPhone (WatchConnectivity).
import Foundation
import CoreLocation
import CoreMotion
import HealthKit
import UserNotifications
import WatchConnectivity
import WatchKit
import WidgetKit

/* ---------- θέση ---------- */
final class Loc: NSObject, CLLocationManagerDelegate {
    static let shared = Loc()
    let lm = CLLocationManager()
    private var running = false
    override init() {
        super.init()
        lm.delegate = self
        lm.desiredAccuracy = kCLLocationAccuracyBest
        lm.distanceFilter = kCLDistanceFilterNone
        lm.activityType = .otherNavigation
    }
    func ask() { if lm.authorizationStatus == .notDetermined { lm.requestWhenInUseAuthorization() } }
    func allowed() -> Bool { [.authorizedWhenInUse, .authorizedAlways].contains(lm.authorizationStatus) }
    func last() -> (Double, Double)? {
        guard allowed(), let l = lm.location, Date().timeIntervalSince(l.timestamp) < 6 * 3600 else { return nil }
        return (l.coordinate.latitude, l.coordinate.longitude)
    }
    func start() {
        ask(); running = true
        lm.allowsBackgroundLocationUpdates = true
        lm.startUpdatingLocation()
    }
    func stop() { running = false; lm.stopUpdatingLocation(); lm.allowsBackgroundLocationUpdates = false }
    /** μία θέση για την πρόγνωση (όταν δεν τρέχει το GPS) */
    func once() { ask(); if allowed() && !running { lm.requestLocation() } }
    func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        guard let l = locs.last else { return }
        Health.shared.add(locs)
        if !running { return }
        Engine.shared.onPos(l.coordinate.latitude, l.coordinate.longitude, l.speed >= 0 ? l.speed : nil, l.course >= 0 ? l.course : nil, l.horizontalAccuracy >= 0 ? l.horizontalAccuracy : nil)
    }
    func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {}
    func locationManagerDidChangeAuthorization(_ m: CLLocationManager) { if allowed() { Engine.shared.load(false) } }
}

/* ---------- προπόνηση «Ψάρεμα» στο Υγεία: κρατά την εφαρμογή ζωντανή στην έξοδο (σαν τη δραστηριότητα του Garmin)
   και, με τη ρύθμιση, αποθηκεύει την έξοδο με τη διαδρομή στο Υγεία ---------- */
final class Health: NSObject {
    static let shared = Health()
    let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var route: HKWorkoutRouteBuilder?

    func start() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let share: Set<HKSampleType> = [HKObjectType.workoutType(), HKSeriesType.workoutRoute()]
        store.requestAuthorization(toShare: share, read: nil) { [weak self] _, _ in
            DispatchQueue.main.async { self?.begin() }
        }
    }
    private func begin() {
        guard session == nil, Engine.shared.trip.active else { return }
        let cfg = HKWorkoutConfiguration(); cfg.activityType = .fishing; cfg.locationType = .outdoor
        do {
            let s = try HKWorkoutSession(healthStore: store, configuration: cfg)
            let b = s.associatedWorkoutBuilder()
            b.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: cfg)
            session = s; builder = b; route = HKWorkoutRouteBuilder(healthStore: store, device: nil)
            s.startActivity(with: Date())
            b.beginCollection(withStart: Date()) { _, _ in }
        } catch { session = nil; builder = nil; route = nil }
    }
    /* 1.14.88: μετά από κλείσιμο/crash με ενεργή έξοδο, ξαναπιάνει τη συνεδρία προπόνησης που κρατά το watchOS (recoverActiveWorkoutSession)·
       αν δεν υπάρχει πια, ξεκινά καινούρια, ώστε η εφαρμογή να μείνει ζωντανή μέχρι το τέλος της εξόδου. */
    func recover() {
        guard HKHealthStore.isHealthDataAvailable(), session == nil else { return }
        store.recoverActiveWorkoutSession { [weak self] s, _ in
            DispatchQueue.main.async {
                guard let me = self, me.session == nil, Engine.shared.trip.active else { return }
                guard let s = s else { me.start(); return }
                let b = s.associatedWorkoutBuilder()
                if b.dataSource == nil { b.dataSource = HKLiveWorkoutDataSource(healthStore: me.store, workoutConfiguration: s.workoutConfiguration) }
                me.session = s; me.builder = b; me.route = HKWorkoutRouteBuilder(healthStore: me.store, device: nil)
            }
        }
    }
    func add(_ locs: [CLLocation]) {
        guard session != nil, let r = route else { return }
        let ok = locs.filter { $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy < 50 }
        if !ok.isEmpty { r.insertRouteData(ok) { _, _ in } }
    }
    func stop(_ save: Bool) {
        guard let s = session, let b = builder else { return }
        let r = route
        session = nil; builder = nil; route = nil
        s.end()
        b.endCollection(withEnd: Date()) { _, _ in
            if save && P.b("health") {
                b.finishWorkout { w, _ in if let w = w, let r = r { r.finishRoute(with: w, metadata: nil) { _, _ in } } }
            } else { b.discardWorkout() }
        }
    }
}

/* ---------- ειδοποιήσεις ---------- */
enum Notify {
    static func ask() { UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in } }
    static func show(_ text: String, id: String = UUID().uuidString) {
        let c = UNMutableNotificationContent(); c.title = "Alkyon"; c.body = text; c.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: c, trigger: nil))
    }
}

/* ---------- βαρόμετρο του ρολογιού (CMAltimeter: Apple Watch Series 6 και νεότερα) ---------- */
enum Baro {
    static let alt = CMAltimeter()
    static var has: Bool { CMAltimeter.isRelativeAltitudeAvailable() }
    /** μία μέτρηση (hPa) ή nil */
    static func read() async -> Double? {
        guard has else { return nil }
        return await withCheckedContinuation { (k: CheckedContinuation<Double?, Never>) in
            var done = false
            let fin: (Double?) -> Void = { v in if done { return }; done = true; alt.stopRelativeAltitudeUpdates(); k.resume(returning: v) }
            alt.startRelativeAltitudeUpdates(to: .main) { d, _ in fin(d.map { $0.pressure.doubleValue * 10 }) }   // kPa → hPa
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { fin(nil) }
        }
    }
    static func store(_ p: Double) {
        let now = nowS()
        var a = P.arr("bh").compactMap { $0 as? [Double] }.filter { now - si($0[0]) < 5 * 3600 }
        a.append([Double(now), p]); P.put("bh", a)
    }
    /** αλλαγή σε 3 ώρες (hPa) και η τωρινή τιμή, ή nil */
    static func d3() -> (Double, Double)? {
        let a = P.arr("bh").compactMap { $0 as? [Double] }
        guard a.count >= 2, let last = a.last else { return nil }
        let now = nowS()
        guard let p3 = a.last(where: { now - si($0[0]) >= 10800 }) else { return nil }
        let d = last[1] - p3[1]
        if abs(d) > 15 { return nil }   // όχι καιρός: υψόμετρο ή λάθος αισθητήρα
        return (d, last[1])
    }
}

/* ---------- παρασκήνιο κάθε ~30′ (AlkService.mc): καμπές πίεσης, καλύτερη ώρα σε ~30′, βαρόμετρο ---------- */
enum Bg {
    static func schedule() {
        WKApplication.shared().scheduleBackgroundRefresh(withPreferredDate: Date().addingTimeInterval(30 * 60), userInfo: nil) { _ in }
    }
    static func run() async {
        var msgs: [String] = []
        var fired = P.obj("fired") ?? [:]
        let now = nowS()
        for (k, v) in fired where now - ((v as? NSNumber)?.intValue ?? 0) > 2 * 86400 { fired.removeValue(forKey: k) }
        if let p = await Baro.read() { Baro.store(p) }
        if P.b("pressAlert"), let d3 = Baro.d3() {
            let thr = max(1, P.d("pressThr")), d = d3.0, key = "baro" + (d < 0 ? "-" : "+")
            if abs(d) >= thr && now - (ji(fired, key) ?? 0) > 3 * 3600 {
                fired[key] = now
                msgs.append(L.t(d < 0 ? "PressDrop" : "PressRise") + " " + (d < 0 ? "-" : "+") + L.f1(abs(d)) + " hPa / 3h")
            }
        }
        if P.b("turnAlert") || P.b("bestAlert") {
            let loc = P.arr("loc")
            let lat = an(loc, 0) ?? P.d("homeLat"), lon = an(loc, 1) ?? P.d("homeLon")
            if var d = await Api.forecast(lat, lon, bg: true) {
                d["got"] = now; P.put("bgd", d); WidgetCenter.shared.reloadAllTimelines()
                if P.b("bestAlert"), let bw = jo(d, "bw"), (ji(bw, "s") ?? 0) >= 60, let ts = ji(bw, "ts") {
                    let db = ts - now, key = "best\(ts)"
                    if db > 0 && db <= 2700 && fired[key] == nil { fired[key] = now; msgs.append(L.t("BestSoon", db / 60, js(bw, "w"), ji(bw, "s") ?? 0)) }
                }
                if P.b("turnAlert") {
                    for e in (ja(d, "tn") as? [JO]) ?? [] {
                        guard let ts = ji(e, "ts") else { continue }
                        let dt = ts - now, peak = js(e, "k") == "peak"
                        if dt > 0 && dt <= 3600 && fired["ts\(ts)"] == nil { fired["ts\(ts)"] = now; msgs.append(L.t(peak ? "TurnPeakSoon" : "TurnLowSoon", js(e, "t"), ji(e, "p") ?? 0)) }
                        else if dt > -2700 && dt <= 0 && fired["tn\(ts)"] == nil { fired["tn\(ts)"] = now; msgs.append(L.t(peak ? "TurnPeakNow" : "TurnLowNow", js(e, "t"), ji(e, "p") ?? 0)) }
                    }
                }
            }
        }
        P.put("fired", fired)
        if !msgs.isEmpty { Notify.show(msgs.joined(separator: "\n")) }
        await Sender.flush()
    }
}

/* ---------- κωδικός σύνδεσης από το iPhone (Alkyon › Προφίλ › Ρολόι) ---------- */
final class Link: NSObject, WCSessionDelegate {
    static let shared = Link()
    func activate() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default; s.delegate = self; s.activate()
    }
    func apply(_ d: [String: Any]) {
        guard let c = d["code"] as? String else { return }
        let clean = P.clean(c)
        guard clean.count >= 6, clean != P.code else { return }
        DispatchQueue.main.async {
            P.code = clean; P.setB("wel", true)
            let e = Engine.shared
            e.welcome = false; e.fc?["got"] = nil
            e.sayK(L.t("LinkedMsg"), "check", 2, 3.5)
            e.load(true); Sender.flushBg()
        }
    }
    func session(_ s: WCSession, activationDidCompleteWith st: WCSessionActivationState, error: Error?) { apply(s.receivedApplicationContext) }
    func session(_ s: WCSession, didReceiveApplicationContext ctx: [String: Any]) { apply(ctx) }
    func session(_ s: WCSession, didReceiveUserInfo info: [String: Any] = [:]) { apply(info) }
    func session(_ s: WCSession, didReceiveMessage m: [String: Any]) { apply(m) }
}
