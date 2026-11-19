// Alkyon για Apple Watch: κοινά για την εφαρμογή του ρολογιού και τα complications (WidgetKit):
// αποθήκευση (App Group, ίδια ονόματα ρυθμίσεων με το Garmin), κείμενα, ανάγνωση JSON, βαθμός της ημέρας.
import Foundation

let BC_URL = "https://sgfohmqwdwtkhtrebnix.supabase.co/functions/v1/watch"
let BC_KEY = "sb_publishable_LGuwvrvLnAj1CF22Q6g9vg_4OImZYbA"
let APP_GROUP = "group.com.alkyonfishing.app"

// si-begin
/** Double → Int χωρίς trap (1.14.88). Τα Apple Watch Series 4–8 και SE είναι arm64_32, όπου το Int είναι 32-bit: μια τιμή έξω από τα όρια, NaN ή ∞
    κλείνει την εφαρμογή (EXC_BREAKPOINT). Εδώ: NaN/∞ → 0, αλλιώς μέσα στα όρια του Int32, ίδια συμπεριφορά σε κάθε ρολόι και στον προσομοιωτή.
    ΚΑΝΟΝΑΣ: στο ρολόι καμία μετατροπή Int(Double) απευθείας· πάντα si(...). Το ελέγχει το tests/unit/watch-arm64-32.test.mjs. */
func si(_ x: Double) -> Int { x.isFinite ? Int(max(-2147483648.0, min(2147483647.0, x))) : 0 }
// si-end
func nowS() -> Int { si(Date().timeIntervalSince1970) }

/* ---------- JSON ---------- */
typealias JO = [String: Any]
func jd(_ o: JO?, _ k: String) -> Double? { (o?[k] as? NSNumber)?.doubleValue }
func ji(_ o: JO?, _ k: String) -> Int? { (o?[k] as? NSNumber)?.intValue }
func js(_ o: JO?, _ k: String) -> String { (o?[k] as? String) ?? "" }
func jo(_ o: JO?, _ k: String) -> JO? { o?[k] as? JO }
func ja(_ o: JO?, _ k: String) -> [Any]? { o?[k] as? [Any] }
func an(_ a: [Any]?, _ i: Int) -> Double? { guard let a = a, i < a.count else { return nil }; return (a[i] as? NSNumber)?.doubleValue }

/* ---------- κείμενα (ελληνικά αν το ρολόι είναι στα ελληνικά) ---------- */
enum L {
    static var el: Bool { (Locale.preferredLanguages.first ?? "en").hasPrefix("el") }
    static func t(_ k: String, _ a: Any?...) -> String {
        var s = (el ? S.el[k] : S.en[k]) ?? S.en[k] ?? k
        for (i, v) in a.enumerated() { s = s.replacingOccurrences(of: "$\(i + 1)$", with: v.map { "\($0)" } ?? "") }
        return s.replacingOccurrences(of: "|", with: "\n")
    }
    /** κεφαλαία χωρίς τόνους (όπως οι τίτλοι στο Garmin) */
    static func up(_ s: String) -> String { s.folding(options: .diacriticInsensitive, locale: Locale(identifier: "el")).uppercased() }
    private static func f(_ x: Double, _ d: Int) -> String {
        let nf = NumberFormatter(); nf.locale = Locale(identifier: el ? "el_GR" : "en_US"); nf.minimumFractionDigits = d; nf.maximumFractionDigits = d; nf.usesGroupingSeparator = false
        return nf.string(from: NSNumber(value: x)) ?? String(x)
    }
    static func f0(_ x: Double) -> String { String(si(x.rounded())) }
    static func f1(_ x: Double) -> String { f(x, 1) }
    static func f2(_ x: Double) -> String { f(x, 2) }
}

/* ---------- αποθήκευση ---------- */
enum P {
    static let ud: UserDefaults = UserDefaults(suiteName: APP_GROUP) ?? .standard
    static let defB: [String: Bool] = ["turnAlert": true, "pressAlert": true, "nightRed": true, "bestAlert": true, "keysL": true, "health": true]
    static let defD: [String: Double] = ["pressThr": 2, "homeLat": 34.75, "homeLon": 32.42, "anchorM": 40, "boatKn": 15, "trollMin": 2.5, "trollMax": 3.5, "trollLine": 40, "leadFa": 1.0, "clrFa": 1.0]
    static func b(_ k: String) -> Bool { ud.object(forKey: k) == nil ? (defB[k] ?? false) : ud.bool(forKey: k) }
    static func setB(_ k: String, _ v: Bool) { ud.set(v, forKey: k) }
    static func d(_ k: String) -> Double { (ud.object(forKey: k) as? NSNumber)?.doubleValue ?? defD[k] ?? 0 }
    static func dn(_ k: String) -> Double? { (ud.object(forKey: k) as? NSNumber)?.doubleValue }
    static func setD(_ k: String, _ v: Double?) { if let v = v { ud.set(v, forKey: k) } else { ud.removeObject(forKey: k) } }
    static func i(_ k: String) -> Int? { (ud.object(forKey: k) as? NSNumber)?.intValue }
    static func setI(_ k: String, _ v: Int?) { if let v = v { ud.set(v, forKey: k) } else { ud.removeObject(forKey: k) } }
    static func json(_ k: String) -> Any? { guard let d = ud.data(forKey: k) else { return nil }; return try? JSONSerialization.jsonObject(with: d) }
    static func obj(_ k: String) -> JO? { json(k) as? JO }
    static func arr(_ k: String) -> [Any] { (json(k) as? [Any]) ?? [] }
    static func put(_ k: String, _ v: Any?) {
        guard let v = v, JSONSerialization.isValidJSONObject(v), let d = try? JSONSerialization.data(withJSONObject: v) else { ud.removeObject(forKey: k); return }
        ud.set(d, forKey: k)
    }
    static var code: String {
        get { clean(ud.string(forKey: "code") ?? "") }
        set { ud.set(clean(newValue), forKey: "code") }
    }
    static func clean(_ s: String) -> String { String(s.uppercased().unicodeScalars.filter { CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789").contains($0) }) }
    static var linked: Bool { code.count >= 6 }
}

/* ---------- βαθμός της ημέρας για complications / Smart Stack (σαν το glance του Garmin) ---------- */
struct DayScore { var s: Int?; var w: String; var tomorrow: Bool; var b: Int?; var v: Double?; var has: Bool }
enum Score {
    static func today() -> DayScore {
        let fc = P.obj("fc"), bg = P.obj("bgd")
        let fresh = fc != nil && (bg == nil || (ji(fc, "got") ?? 0) >= (ji(bg, "got") ?? 0))
        if fresh, let days = ja(fc, "days") as? [JO], !days.isEmpty {
            let d0 = days[0]
            if ji(d0, "s") != nil { return DayScore(s: ji(d0, "s"), w: js(d0, "w"), tomorrow: false, b: ji(d0, "b"), v: jd(d0, "v"), has: true) }
            if days.count > 1 { let d1 = days[1]; return DayScore(s: ji(d1, "s"), w: js(d1, "w"), tomorrow: true, b: ji(d1, "b"), v: jd(d1, "v"), has: true) }
            return DayScore(s: nil, w: "", tomorrow: false, b: nil, v: nil, has: true)
        }
        if let bg = bg, ji(bg, "s") != nil { return DayScore(s: ji(bg, "s"), w: js(bg, "w"), tomorrow: false, b: nil, v: nil, has: true) }
        return DayScore(s: nil, w: "", tomorrow: false, b: nil, v: nil, has: fc != nil)
    }
    static func rgb(_ s: Int?) -> UInt32 { guard let s = s else { return 0xFF5A4E }; return s >= 70 ? 0x3DDC97 : s >= 50 ? 0xFFD23A : 0xFF8A50 }
}
