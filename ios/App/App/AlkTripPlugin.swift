// Alkyon 1.14.83 (P0.7) · GPS εξόδου με κλειδωμένη οθόνη (iPhone).
// Ενημερώσεις θέσης στο παρασκήνιο (UIBackgroundModes: location) ΜΟΝΟ όσο τρέχει έξοδος που ξεκίνησε ο χρήστης· σταματούν στο «Τέλος εξόδου».
// Αρκεί η άδεια «Κατά τη χρήση» (When In Use): οι ενημερώσεις ξεκινούν με την εφαρμογή ανοιχτή και το iPhone δείχνει τη μπλε ένδειξη θέσης.
// JS: Capacitor.registerPlugin('AlkTrip')  — ίδιες μέθοδοι με το Android: start / stop / fixes / status
import Foundation
import Capacitor
import CoreLocation
import UIKit

// 1.14.95 · πότε η απάντηση του server στον παλμό σταματά την καταγραφή της εξόδου.
// Ο server απαντά 404 «no active trip» και όταν η έξοδος δεν καταχωρήθηκε ποτέ (ειδοποίηση επαφής κλειστή, χωρίς λογαριασμό,
// έναρξη χωρίς σήμα) και σε στιγμιαίο σφάλμα της βάσης. Πριν, κάθε 404 σταματούσε την καταγραφή και χανόταν η διαδρομή.
// Κανόνας: σταματά ΜΟΝΟ όταν ο server έχει απαντήσει τουλάχιστον μία φορά 2xx για αυτή την έξοδο ΚΑΙ έρθουν stopAfter συνεχόμενα
// 404 του δικού μας κώδικα. Ο παλμός δεν σταματά ποτέ εδώ. Ίδιος κανόνας και ίδιες σταθερές με το Android (AlkHbRule.java).
struct AlkHbRule {
    static let stopAfter = 3
    static let maxUnacked: TimeInterval = 24 * 3600
    static let ours = "no active trip"
    static func ours404(_ code: Int, _ body: String) -> Bool { return code == 404 && body.contains(ours) }
    static func next(acked: Bool, n404: Int, code: Int, body: String) -> (acked: Bool, n404: Int, stop: Bool) {
        if code >= 200 && code < 300 { return (true, 0, false) }
        if ours404(code, body) {
            if !acked { return (false, 0, false) }
            let n = n404 + 1
            return (true, n, n >= stopAfter)
        }
        return (acked, n404, false)
    }
    // δίχτυ για τη μπαταρία: καταγραφή που ο server δεν αναγνώρισε ποτέ δεν τρέχει πάνω από maxUnacked
    static func expired(acked: Bool, born: TimeInterval, now: TimeInterval) -> Bool { return !acked && born > 0 && now - born >= maxUnacked }
}

@objc(AlkTripPlugin)
public class AlkTripPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "AlkTripPlugin"
    public let jsName = "AlkTrip"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fixes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]
    private let lm = CLLocationManager()
    private let ud = UserDefaults.standard
    private var running = false
    private var tripId = "", key = "", url = "", apikey = ""
    private var interval: TimeInterval = 180, lastHb: TimeInterval = 0
    private var last: CLLocation? = nil
    // 1.14.95: κατάσταση του κανόνα AlkHbRule, αποθηκευμένη ανά έξοδο (η εφαρμογή μπορεί να ξαναξεκινήσει από το iOS)
    private var acked = false, n404 = 0
    private var born: TimeInterval = 0
    private let maxFixes = 4000

    override public func load() {
        lm.delegate = self
        lm.desiredAccuracy = kCLLocationAccuracyBest
        lm.distanceFilter = kCLDistanceFilterNone
        lm.activityType = .otherNavigation
        lm.pausesLocationUpdatesAutomatically = false
        // συνέχιση μετά από επανεκκίνηση της εφαρμογής από το iOS, αν η έξοδος τρέχει ακόμα
        if let id = ud.string(forKey: "alkTrip.id"), !id.isEmpty { configure(id: id, key: ud.string(forKey: "alkTrip.key") ?? "", url: ud.string(forKey: "alkTrip.url") ?? "",
                                                                               apikey: ud.string(forKey: "alkTrip.apikey") ?? "", interval: ud.double(forKey: "alkTrip.interval")); begin() }
    }

    private func authorized() -> Bool {
        let s: CLAuthorizationStatus = lm.authorizationStatus
        return s == .authorizedWhenInUse || s == .authorizedAlways
    }
    private func configure(id: String, key: String, url: String, apikey: String, interval: Double) {
        self.tripId = id; self.key = key; self.url = url; self.apikey = apikey
        self.interval = min(900, max(60, interval > 0 ? interval : 180))
        self.acked = ud.bool(forKey: "alkTrip.ack." + id); self.n404 = ud.integer(forKey: "alkTrip.n404." + id)
        var b0 = ud.double(forKey: "alkTrip.born." + id)
        if b0 <= 0 { b0 = Date().timeIntervalSince1970; ud.set(b0, forKey: "alkTrip.born." + id) }
        self.born = b0
    }
    // σταματά την καταγραφή (ίδιες ενέργειες με πριν το 1.14.95, όταν ερχόταν 404)
    private func halt() {
        lm.stopUpdatingLocation(); lm.allowsBackgroundLocationUpdates = false; running = false
        ud.removeObject(forKey: "alkTrip.id"); ud.removeObject(forKey: "alkTrip.key")
    }
    private func begin() {
        guard authorized() else { return }
        lm.allowsBackgroundLocationUpdates = true
        lm.showsBackgroundLocationIndicator = true
        lm.startUpdatingLocation()
        running = true
    }

    @objc func start(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? "", k = call.getString("key") ?? ""
        guard !id.isEmpty, !k.isEmpty else { call.reject("args"); return }
        DispatchQueue.main.async {
            guard self.authorized() else { call.resolve(["ok": false, "err": "perm"]); return }
            if let prev = self.ud.string(forKey: "alkTrip.id"), prev != id { self.ud.removeObject(forKey: "alkTrip.fixes." + prev); self.ud.removeObject(forKey: "alkTrip.diag." + prev)
                self.ud.removeObject(forKey: "alkTrip.ack." + prev); self.ud.removeObject(forKey: "alkTrip.n404." + prev); self.ud.removeObject(forKey: "alkTrip.born." + prev) }
            self.configure(id: id, key: k, url: call.getString("url") ?? "", apikey: call.getString("apikey") ?? "", interval: Double(call.getInt("interval") ?? 180))
            self.ud.set(id, forKey: "alkTrip.id"); self.ud.set(k, forKey: "alkTrip.key"); self.ud.set(self.url, forKey: "alkTrip.url")
            self.ud.set(self.apikey, forKey: "alkTrip.apikey"); self.ud.set(self.interval, forKey: "alkTrip.interval")
            self.begin()
            call.resolve(["ok": true])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.lm.stopUpdatingLocation()
            self.lm.allowsBackgroundLocationUpdates = false
            self.running = false
            self.ud.removeObject(forKey: "alkTrip.id"); self.ud.removeObject(forKey: "alkTrip.key")
            call.resolve(["ok": true])
        }
    }

    @objc func fixes(_ call: CAPPluginCall) {
        let since = call.getDouble("since") ?? 0
        let id = call.getString("id") ?? (ud.string(forKey: "alkTrip.id") ?? "")
        let a = (ud.array(forKey: "alkTrip.fixes." + id) as? [[Double]]) ?? []
        // 1.14.88: μαζί και οι μετρητές διάγνωσης (raw / acc / near / kept / gaps60 / gapMax / half / t0 / t1)
        var d = (ud.dictionary(forKey: "alkTrip.diag." + id) as? [String: Double]) ?? [:]
        d["every"] = 1
        call.resolve(["fixes": a.filter { $0.count >= 3 && $0[2] > since }, "diag": d])
    }

    @objc func status(_ call: CAPPluginCall) { call.resolve(["running": running]) }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let dk = "alkTrip.diag." + tripId
        var d = (ud.dictionary(forKey: dk) as? [String: Double]) ?? [:]
        let now = (Date().timeIntervalSince1970 * 1000).rounded()
        if d["t0"] == nil { d["t0"] = now }
        for l in locations {
            if let t1 = d["t1"], now - t1 > 60000 { d["gaps60"] = (d["gaps60"] ?? 0) + 1; d["gapMax"] = max(d["gapMax"] ?? 0, ((now - t1) / 1000).rounded()) }
            d["raw"] = (d["raw"] ?? 0) + 1; d["t1"] = now
            if l.horizontalAccuracy < 0 || l.horizontalAccuracy > 60 { d["acc"] = (d["acc"] ?? 0) + 1; continue }
            let moved = last == nil || l.distance(from: last!) >= 12 || l.timestamp.timeIntervalSince(last!.timestamp) >= 60
            if moved { if addFix(l) { d["half"] = (d["half"] ?? 0) + 1 }; last = l; d["kept"] = (d["kept"] ?? 0) + 1 } else { d["near"] = (d["near"] ?? 0) + 1 }
        }
        d["ack"] = acked ? 1 : 0   // 1.14.95: ο server γνωρίζει την έξοδο;
        perm(&d)
        if !tripId.isEmpty { ud.set(d, forKey: dk) }
        // 1.14.95: καταγραφή που ο server δεν αναγνώρισε ποτέ δεν τρέχει πάνω από 24 ώρες (δίχτυ για τη μπαταρία)
        if AlkHbRule.expired(acked: acked, born: born, now: Date().timeIntervalSince1970) { halt(); return }
        if Date().timeIntervalSince1970 - lastHb >= interval { sendHb() }
    }
    /* 1.14.95 · διάγνωση (τρία πεδία στο λεξικό της εξόδου, ταξιδεύουν στο gps.n):
       auth   = CLAuthorizationStatus.rawValue τη στιγμή της εγγραφής: 0 χωρίς απάντηση · 1 περιορισμένη · 2 άρνηση · 3 Πάντα · 4 Κατά τη χρήση
       prec   = 1 «Ακριβής τοποθεσία» ανοιχτή · 0 κατά προσέγγιση
       lmErr  = πόσες φορές το iOS ανέφερε σφάλμα θέσης (didFailWithError)
       Δεν αλλάζουν τίποτα στη συμπεριφορά της καταγραφής. */
    private func perm(_ d: inout [String: Double]) {
        d["auth"] = Double(lm.authorizationStatus.rawValue)
        d["prec"] = lm.accuracyAuthorization == .fullAccuracy ? 1 : 0
    }
    private func noteDiag(_ f: (inout [String: Double]) -> Void) {
        guard !tripId.isEmpty else { return }
        let dk = "alkTrip.diag." + tripId
        var d = (ud.dictionary(forKey: dk) as? [String: Double]) ?? [:]
        f(&d); perm(&d)
        ud.set(d, forKey: dk)
    }
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        /* χωρίς σήμα GPS: ξαναδοκιμάζει μόνο του · 1.14.95: μετριέται για τη διάγνωση */
        noteDiag { d in d["lmErr"] = (d["lmErr"] ?? 0) + 1 }
    }
    /* 1.14.95: αν ο χρήστης αλλάξει την άδεια θέσης μέσα στην έξοδο, φαίνεται στη διάγνωση ακόμη κι αν δεν έρθει άλλη θέση */
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if running { noteDiag { _ in } }
    }

    @discardableResult private func addFix(_ l: CLLocation) -> Bool {
        let k = "alkTrip.fixes." + tripId
        var a = (ud.array(forKey: k) as? [[Double]]) ?? []
        a.append([l.coordinate.latitude, l.coordinate.longitude, (l.timestamp.timeIntervalSince1970 * 1000).rounded(), l.horizontalAccuracy.rounded()])
        var halved = false
        if a.count > maxFixes { halved = true; a = a.enumerated().filter { $0.offset % 2 == 0 || $0.offset == a.count - 1 }.map { $0.element } }
        ud.set(a, forKey: k)
        return halved
    }

    private func sendHb() {
        guard !url.isEmpty, !key.isEmpty, let u = URL(string: url) else { return }
        lastHb = Date().timeIntervalSince1970
        var b: [String: Any] = ["action": "hb", "id": tripId, "key": key]
        if let l = last, Date().timeIntervalSince(l.timestamp) < 900 { b["lat"] = l.coordinate.latitude; b["lon"] = l.coordinate.longitude }
        UIDevice.current.isBatteryMonitoringEnabled = true
        let lvl = UIDevice.current.batteryLevel
        if lvl >= 0 { b["battery"] = Int((lvl * 100).rounded()) }
        var rq = URLRequest(url: u); rq.httpMethod = "POST"; rq.timeoutInterval = 15
        rq.setValue("application/json", forHTTPHeaderField: "Content-Type"); rq.setValue(apikey, forHTTPHeaderField: "apikey"); rq.setValue("Bearer " + apikey, forHTTPHeaderField: "Authorization")
        rq.httpBody = try? JSONSerialization.data(withJSONObject: b)
        let sent = tripId
        URLSession.shared.dataTask(with: rq) { data, resp, _ in
            guard let h = resp as? HTTPURLResponse else { return }   // χωρίς σήμα: ο επόμενος παλμός θα ξαναδοκιμάσει
            let body = h.statusCode == 404 ? (String(data: (data ?? Data()).prefix(512), encoding: .utf8) ?? "") : ""
            DispatchQueue.main.async { self.onHb(sent: sent, code: h.statusCode, body: body) }
        }.resume()
    }

    // 1.14.95: η απάντηση του server στον παλμό. Πριν, κάθε 404 σταματούσε την καταγραφή· τώρα αποφασίζει ο AlkHbRule.
    private func onHb(sent: String, code: Int, body: String) {
        guard sent == tripId else { return }   // απάντηση για προηγούμενη έξοδο
        let s = AlkHbRule.next(acked: acked, n404: n404, code: code, body: body)
        if AlkHbRule.ours404(code, body) {   // μετρητής διάγνωσης: πόσα 404 «no active trip» ήρθαν
            let dk = "alkTrip.diag." + tripId
            var d = (ud.dictionary(forKey: dk) as? [String: Double]) ?? [:]
            d["hb4"] = (d["hb4"] ?? 0) + 1; d["ack"] = s.acked ? 1 : 0
            ud.set(d, forKey: dk)
        }
        if s.acked != acked || s.n404 != n404 {
            acked = s.acked; n404 = s.n404
            ud.set(acked, forKey: "alkTrip.ack." + tripId); ud.set(n404, forKey: "alkTrip.n404." + tripId)
        }
        if s.stop { halt() }   // η έξοδος έκλεισε στον server
    }
}
