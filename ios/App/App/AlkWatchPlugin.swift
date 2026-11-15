// Alkyon · Apple Watch: στέλνει τον κωδικό σύνδεσης στο ρολόι (WatchConnectivity), ώστε ο χρήστης να μη χρειάζεται να τον γράψει.
// JS: Capacitor.registerPlugin('AlkWatch')
//   link({code, lang}) → {ok}
//   status() → {watches: 1 αν υπάρχει ζευγαρωμένο Apple Watch, app: 1 αν έχει την εφαρμογή Alkyon}
import Foundation
import Capacitor
import WatchConnectivity

@objc(AlkWatchPlugin)
public class AlkWatchPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "AlkWatchPlugin"
    public let jsName = "AlkWatch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "link", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]
    private var pending: [String: Any]? = nil

    override public func load() {
        if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
    }

    @objc func link(_ call: CAPPluginCall) {
        let code = call.getString("code") ?? ""
        guard code.count >= 6 else { call.reject("code"); return }
        let ctx: [String: Any] = ["code": code, "lang": call.getString("lang") ?? "en", "at": Date().timeIntervalSince1970]
        guard WCSession.isSupported() else { call.resolve(["ok": false, "err": "unsupported"]); return }
        let s = WCSession.default
        if s.activationState != .activated { pending = ctx; s.activate(); call.resolve(["ok": true, "queued": true]); return }
        send(ctx)
        call.resolve(["ok": true])
    }

    private func send(_ ctx: [String: Any]) {
        let s = WCSession.default
        guard s.isPaired, s.isWatchAppInstalled else { return }
        try? s.updateApplicationContext(ctx)
        s.transferUserInfo(ctx)
        if s.isReachable { s.sendMessage(ctx, replyHandler: nil, errorHandler: nil) }
    }

    @objc func status(_ call: CAPPluginCall) {
        guard WCSession.isSupported() else { call.resolve(["watches": 0, "app": 0]); return }
        let s = WCSession.default
        call.resolve(["watches": s.isPaired ? 1 : 0, "app": (s.isPaired && s.isWatchAppInstalled) ? 1 : 0])
    }

    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if activationState == .activated, let p = pending { pending = nil; send(p) }
    }
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
