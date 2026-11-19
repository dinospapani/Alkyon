// Alkyon 1.14.83 (P0.7) · GPS εξόδου με κλειδωμένη οθόνη (iPhone).
// Ενημερώσεις θέσης στο παρασκήνιο (UIBackgroundModes: location) ΜΟΝΟ όσο τρέχει έξοδος που ξεκίνησε ο χρήστης· σταματούν στο «Τέλος εξόδου».
// Αρκεί η άδεια «Κατά τη χρήση» (When In Use): οι ενημερώσεις ξεκινούν με την εφαρμογή ανοιχτή και το iPhone δείχνει τη μπλε ένδειξη θέσης.
// JS: Capacitor.registerPlugin('AlkTrip')  — ίδιες μέθοδοι με το Android: start / stop / fixes / status
import Foundation
import Capacitor
import CoreLocation
import UIKit

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
            if let prev = self.ud.string(forKey: "alkTrip.id"), prev != id { self.ud.removeObject(forKey: "alkTrip.fixes." + prev); self.ud.removeObject(forKey: "alkTrip.diag." + prev) }
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
        if !tripId.isEmpty { ud.set(d, forKey: dk) }
        if Date().timeIntervalSince1970 - lastHb >= interval { sendHb() }
    }
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { /* χωρίς σήμα GPS: ξαναδοκιμάζει μόνο του */ }

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
        URLSession.shared.dataTask(with: rq) { _, resp, _ in
            if let h = resp as? HTTPURLResponse, h.statusCode == 404 {   // η έξοδος έκλεισε στον server
                DispatchQueue.main.async { self.lm.stopUpdatingLocation(); self.lm.allowsBackgroundLocationUpdates = false; self.running = false
                    self.ud.removeObject(forKey: "alkTrip.id"); self.ud.removeObject(forKey: "alkTrip.key") }
            }
        }.resume()
    }
}
