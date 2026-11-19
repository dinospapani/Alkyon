// Alkyon για Apple Watch: server, γεωμετρία, διαδρομή εξόδου, ουρά αποστολής (AlkSender.mc / AlkTrip.mc του Garmin).
import Foundation

let DEV = "applewatch"

/* ---------- server (Supabase function «watch», ίδια με του Garmin) ---------- */
enum Api {
    static func url(_ q: [String: String]) -> URL {
        var c = URLComponents(string: BC_URL)!
        c.queryItems = (q.merging(["apikey": BC_KEY]) { a, _ in a }).map { URLQueryItem(name: $0.key, value: $0.value) }
        return c.url!
    }
    static func get(_ q: [String: String], timeout: Double = 20) async -> JO? {
        var r = URLRequest(url: url(q)); r.timeoutInterval = timeout; r.setValue(BC_KEY, forHTTPHeaderField: "apikey")
        guard let (d, res) = try? await URLSession.shared.data(for: r), (res as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return (try? JSONSerialization.jsonObject(with: d)) as? JO
    }
    /** POST: κωδικός HTTP (0 = χωρίς δίκτυο) */
    static func post(_ body: JO) async -> Int {
        var r = URLRequest(url: URL(string: BC_URL + "?apikey=" + BC_KEY)!); r.httpMethod = "POST"; r.timeoutInterval = 20
        r.setValue("application/json", forHTTPHeaderField: "Content-Type"); r.setValue(BC_KEY, forHTTPHeaderField: "apikey")
        r.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard let (_, res) = try? await URLSession.shared.data(for: r) else { return 0 }
        return (res as? HTTPURLResponse)?.statusCode ?? 0
    }
    static func forecast(_ lat: Double, _ lon: Double, bg: Bool = false) async -> JO? {
        var q = ["lat": String(format: "%.2f", lat), "lon": String(format: "%.2f", lon), "lang": L.el ? "el" : "en"]
        if bg { q["bg"] = "1" } else if P.linked { q["code"] = P.code }
        guard let d = await get(q), d["ok"] != nil else { return nil }
        return d
    }
    static func grid(_ lat: Double, _ lon: Double) async -> JO? {
        var q = ["grid": "1", "lat": String(format: "%.4f", lat), "lon": String(format: "%.4f", lon)]
        if P.linked { q["code"] = P.code }
        guard let d = await get(q, timeout: 25), d["ok"] != nil, d["d"] != nil else { return nil }
        return d
    }
}

/* ---------- γεωμετρία ---------- */
enum Geo {
    static func dist(_ a1: Double, _ o1: Double, _ a2: Double, _ o2: Double) -> Double {
        let r = Double.pi / 180
        let x = sin((a2 - a1) * r / 2) * sin((a2 - a1) * r / 2) + cos(a1 * r) * cos(a2 * r) * sin((o2 - o1) * r / 2) * sin((o2 - o1) * r / 2)
        return 2 * 6371.0 * asin(sqrt(x))
    }
    static func bearing(_ a1: Double, _ o1: Double, _ a2: Double, _ o2: Double) -> Double {
        let r = Double.pi / 180
        let y = sin((o2 - o1) * r) * cos(a2 * r), x = cos(a1 * r) * sin(a2 * r) - sin(a1 * r) * cos(a2 * r) * cos((o2 - o1) * r)
        let b = atan2(y, x) * 180 / .pi; return b < 0 ? b + 360 : b
    }
    static func fwd(_ lat: Double, _ lon: Double, _ hd: Double, _ m: Double) -> (Double, Double) {
        let r = hd * .pi / 180
        return (lat + m * cos(r) / 111320.0, lon + m * sin(r) / (111320.0 * cos(lat * .pi / 180)))
    }
    static func distTxt(_ m: Double) -> String { m < 1000 ? "\(si(m)) m" : (m < 10000 ? L.f1(m / 1000) : L.f0(m / 1000)) + " km" }
    static func hms(_ sx: Int) -> String { let s = max(0, sx); return "\(s / 3600):" + String(format: "%02d", (s % 3600) / 60) }
    static func minHm(_ m: Int) -> String { let x = ((m % 1440) + 1440) % 1440; return String(format: "%02d:%02d", x / 60 % 24, x % 60) }
    static func tsHm(_ ts: Int) -> String { let c = Calendar.current.dateComponents([.hour, .minute], from: Date(timeIntervalSince1970: Double(ts))); return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0) }
    static func nowMin() -> Int { let c = Calendar.current.dateComponents([.hour, .minute], from: Date()); return (c.hour ?? 0) * 60 + (c.minute ?? 0) }
    static func tzMin() -> Int { TimeZone.current.secondsFromGMT() / 60 }
    static func r5(_ x: Double) -> Double { (x * 1e5).rounded() / 1e5 }
}

/* ---------- διαδρομή της εξόδου (AlkTrip.mc 1.5.1) ---------- */
final class Track {
    var active = false, tid = "", start = 0, n = 0
    var pts: [[Double]] = []      // [lat, lon, ts]
    var lastT = 0, km = 0.0, fixAt = 0
    var spd: Double? = nil
    var p0: (Double, Double)? = nil
    var lastFix: (Double, Double)? = nil
    var lastHd: Double? = nil

    func begin() { active = true; start = nowS(); tid = "wt\(start)"; n = 0; pts = []; lastT = 0; km = 0; spd = nil; fixAt = 0; p0 = nil; lastFix = nil; lastHd = nil }
    func onPos(_ lat: Double, _ lon: Double, _ speed: Double?, _ heading: Double?, _ acc: Double?) {
        let t = nowS(); fixAt = t
        if let s = speed { spd = s * 1.94384 }
        if lat == 0 && lon == 0 { return }
        if let a = acc, a > 80 { return }
        if p0 == nil { p0 = (lat, lon) }
        if let lf = lastFix { let step = Geo.dist(lf.0, lf.1, lat, lon); if step >= 0.008 { km += step; lastFix = (lat, lon) } } else { lastFix = (lat, lon) }
        let hd: Double? = (heading != nil && (speed ?? 0) > 1.0) ? heading : nil
        guard let last = pts.last else { add(lat, lon, t, hd); return }
        let dt = t - lastT; if dt < 2 { return }
        let dm = Geo.dist(last[0], last[1], lat, lon) * 1000; if dm < 15 { return }
        var turn = 0.0
        if let h = hd, let lh = lastHd { turn = abs(h - lh); if turn > 180 { turn = 360 - turn } }
        if turn >= 20 || dm >= 200 || dt >= 30 { add(lat, lon, t, hd) }
    }
    private func add(_ lat: Double, _ lon: Double, _ t: Int, _ hd: Double?) {
        lastT = t; if let h = hd { lastHd = h }
        pts.append([Geo.r5(lat), Geo.r5(lon), Double(t)])
        if pts.count > 500 { pts = Track.simplify(pts, 350) }
    }
    /* 1.14.88: η έξοδος αποθηκεύεται (App Group) για να συνεχίσει αν η εφαρμογή κλείσει ή κρασάρει. Πριν ζούσε μόνο στη μνήμη και χανόταν μαζί με τη διαδρομή. */
    func snapshot() -> JO {
        var o: JO = ["active": active, "tid": tid, "start": start, "n": n, "pts": pts, "km": (km * 1000).rounded() / 1000, "lastT": lastT]
        if let p = p0 { o["p0"] = [p.0, p.1] }
        return o
    }
    /** true αν υπήρχε ενεργή έξοδος και συνεχίζεται. Έξοδος πάνω από 36 ώρες δεν συνεχίζεται (ο server δεν τη δέχεται). */
    func restore(_ o: JO?) -> Bool {
        guard let o = o, (o["active"] as? Bool) == true, let st = ji(o, "start"), st > 0, nowS() - st < 36 * 3600, nowS() >= st else { return false }
        let id = js(o, "tid"); guard !id.isEmpty else { return false }
        active = true; tid = id; start = st; n = max(0, ji(o, "n") ?? 0); km = max(0, jd(o, "km") ?? 0); lastT = ji(o, "lastT") ?? 0
        pts = ((o["pts"] as? [[NSNumber]]) ?? []).filter { $0.count >= 3 }.map { $0.map { $0.doubleValue } }
        if let a = ja(o, "p0"), let la = an(a, 0), let lo = an(a, 1) { p0 = (la, lo) } else { p0 = nil }
        if let l = pts.last { lastFix = (l[0], l[1]) } else { lastFix = nil }
        spd = nil; fixAt = 0; lastHd = nil
        return true
    }
    func hasFix() -> Bool { active && nowS() - fixAt < 30 }
    func secs() -> Int { active ? nowS() - start : 0 }
    func onCatch(_ kind: String) -> String? { guard active else { return nil }; if kind == "fish" { n += 1 }; return tid }
    func finish(_ save: Bool) -> JO? {
        guard active else { return nil }
        active = false
        let p = Track.simplify(pts, 250); pts = []
        guard save else { return nil }
        return ["k": "trip", "ts": start, "te": nowS(), "tz": Geo.tzMin(), "tid": tid, "n": n, "pts": p.map { [$0[0], $0[1], si($0[2])] }]
    }
    static func simplify(_ a: [[Double]], _ maxN: Int) -> [[Double]] {
        if a.count <= maxN { return a }
        var eps = 8.0, out = a
        while out.count > maxN && eps < 5000 { out = dp(a, eps); eps *= 2 }
        if out.count > maxN { var o: [[Double]] = []; var i = 0; while i < out.count { o.append(out[i]); i += 2 }; if out.count % 2 == 0, let l = out.last { o.append(l) }; out = o }
        return out
    }
    private static func dp(_ a: [[Double]], _ eps: Double) -> [[Double]] {
        let n0 = a.count; var keep = [Bool](repeating: false, count: n0); keep[0] = true; keep[n0 - 1] = true
        var st: [(Int, Int)] = [(0, n0 - 1)]; let c = cos(a[0][0] * .pi / 180)
        while let s = st.popLast() {
            let (i0, i1) = s; if i1 <= i0 + 1 { continue }
            let ax = a[i0][1] * c * 111320, ay = a[i0][0] * 110540, bx = a[i1][1] * c * 111320, by = a[i1][0] * 110540
            let vx = bx - ax, vy = by - ay, len = sqrt(vx * vx + vy * vy)
            var best = -1.0, bi = -1
            for k in (i0 + 1)..<i1 {
                let px = a[k][1] * c * 111320 - ax, py = a[k][0] * 110540 - ay
                let dd = len > 0.5 ? abs((vx * py - vy * px) / len) : sqrt(px * px + py * py)
                if dd > best { best = dd; bi = k }
            }
            if best > eps && bi > 0 { keep[bi] = true; st.append((i0, bi)); st.append((bi, i1)) }
        }
        return (0..<n0).filter { keep[$0] }.map { a[$0] }
    }
}

/* ---------- ουρά αποστολής: χωρίς δίκτυο μένει και στέλνεται αργότερα ---------- */
enum Sender {
    private static var busy = false
    static func size() -> Int { P.arr("q").count }
    static func add(_ item: JO) {
        var q = P.arr("q"); q.append(item)
        if q.count > 80 { q = Array(q.suffix(80)) }
        P.put("q", q)
    }
    /** true εστάλησαν, nil λάθος κωδικός, false χωρίς δίκτυο */
    @discardableResult
    static func flush() async -> Bool? {
        if busy || !P.linked || size() == 0 { return true }
        busy = true; defer { busy = false }
        while let it = P.arr("q").first as? JO {
            var body: JO = ["code": P.code, "dev": DEV]
            for (k, v) in it { body[k == "k" ? "kind" : k] = v }
            let c = await Api.post(body)
            if c == 200 || (c >= 400 && c < 500 && c != 403 && c != 408 && c != 429) { var q = P.arr("q"); if !q.isEmpty { q.removeFirst() }; P.put("q", q); continue }
            return c == 403 ? nil : false
        }
        return true
    }
    static func flushBg(_ cb: ((Bool?) -> Void)? = nil) { Task { let r = await flush(); await MainActor.run { cb?(r) } } }
}
