// Alkyon · έλεγχοι λογικής του Apple Watch που τρέχουν στο CI (macOS), χωρίς ρολόι:
//   swiftc ios/App/AlkyonShared/Shared.swift ios/App/AlkyonShared/Strings.swift ios/App/AlkyonWatch/Core.swift watch/tests/main.swift -o /tmp/wt && /tmp/wt
// 1.14.88: το 🐟 έκλεινε την εφαρμογή στα Series 4–8 / SE (arm64_32, Int 32-bit) γιατί το Int(ms()) ξεχείλιζε. Ο προσομοιωτής είναι 64-bit και δεν το έπιανε.
// Εδώ ελέγχεται με τα όρια του Int32 ότι καμία τιμή που βγάζει το si() δεν θα έκανε trap σε 32-bit, και ότι η έξοδος αποθηκεύεται και συνεχίζει.
import Foundation

var fails = 0
func check(_ name: String, _ ok: Bool) { if ok { print("  ok   " + name) } else { fails += 1; print("  FAIL " + name) } }
func fits32(_ v: Int) -> Bool { Int32(exactly: v) != nil }

let ms = Date().timeIntervalSince1970 * 1000
check("the old expression would trap on a 32-bit Int: ms() does not fit in Int32", Int32(exactly: ms.rounded()) == nil)
let rem = si(ms.truncatingRemainder(dividingBy: 1000))
check("catch id suffix is 0…999 and fits in 32 bits", rem >= 0 && rem <= 999 && fits32(rem))
check("si(1.8e12) is clamped to Int32.max", si(1.8e12) == 2147483647)
check("si(-1.8e12) is clamped to Int32.min", si(-1.8e12) == -2147483648)
check("si(NaN) = 0, si(∞) = 0, si(-∞) = 0", si(Double.nan) == 0 && si(Double.infinity) == 0 && si(-Double.infinity) == 0)
check("si keeps ordinary values", si(12.9) == 12 && si(-3.2) == -3 && si(0) == 0)
for x in [ms, ms * 1000, 1e300, -1e300, Double.greatestFiniteMagnitude, 4294967296.0, 2147483647.5, -2147483648.5] { check("si(\(x)) fits in 32 bits", fits32(si(x))) }
// ETA στη σελίδα Spot: ταχύτητα 0 από τις ρυθμίσεις δεν διαιρεί πια με το μηδέν
let dm = 5000.0, sp = 0.0
check("spot ETA with speed 0 is finite and bounded", si(min(99999, (dm / 1852) / max(sp, 0.5) * 60)) == 323)
check("division by a zero setting no longer traps", si((10.0 - 1.0) / 0.0) == 0 && si(0.0 / 0.0) == 0)
check("nowS() fits in 32 bits", fits32(nowS()))

// αποθήκευση και συνέχιση της εξόδου
let t = Track(); t.begin()
t.onPos(34.70000, 32.40000, 2.0, 90, 5); t.lastT -= 40
t.onPos(34.70000, 32.40300, 2.0, 90, 5); t.lastT -= 40
t.onPos(34.70200, 32.40300, 2.0, 0, 5)
_ = t.onCatch("fish"); _ = t.onCatch("fish"); _ = t.onCatch("miss")
check("track has points, distance and catches before saving", t.pts.count == 3 && t.km > 0.4 && t.n == 2)
let data = try! JSONSerialization.data(withJSONObject: t.snapshot())
let back = (try! JSONSerialization.jsonObject(with: data)) as! JO
let u = Track()
check("a saved active trip is restored", u.restore(back))
check("restored: same id, start, catches, distance and points", u.active && u.tid == t.tid && u.start == t.start && u.n == 2 && abs(u.km - t.km) < 0.001 && u.pts.count == 3 && u.pts[2][0] == t.pts[2][0] && u.pts[2][2] == t.pts[2][2])
check("restored: start point and last fix are back", u.p0 != nil && abs(u.p0!.0 - 34.7) < 1e-6 && u.lastFix != nil && abs(u.lastFix!.1 - 32.403) < 1e-6)
u.lastT -= 40
u.onPos(34.70500, 32.40300, 2.0, 0, 5)
check("the restored trip keeps recording", u.pts.count == 4 && u.km > t.km)
let fin = u.finish(true)
check("the restored trip ends as one trip with the same id and all its points", fin != nil && (fin!["tid"] as? String) == t.tid && (fin!["n"] as? Int) == 2 && ((fin!["pts"] as? [[Any]])?.count ?? 0) == 4 && (fin!["ts"] as? Int) == t.start)
var old = back; old["start"] = nowS() - 40 * 3600
check("a trip left open for more than 36 hours is not resumed", !Track().restore(old))
var off = back; off["active"] = false
check("an ended trip is not resumed", !Track().restore(off) && !Track().restore(nil) && !Track().restore([:]))

print(fails == 0 ? "watch logic: all ok" : "watch logic: \(fails) FAILED")
exit(fails == 0 ? 0 : 1)
