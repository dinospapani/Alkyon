// Alkyon · Apple Watch: στέλνει τον κωδικό σύνδεσης στο ρολόι (WatchConnectivity), ώστε ο χρήστης να μη χρειάζεται να τον γράψει.
// JS: Capacitor.registerPlugin('AlkWatch')
//   link({code, lang}) → {ok: true} όταν στάλθηκε · {ok: false, err: 'nowatch' | 'noapp' | 'inactive' | 'unsupported'} όταν δεν στάλθηκε
//   status() → {watches: 1 αν υπάρχει ζευγαρωμένο Apple Watch, app: 1 αν έχει την εφαρμογή Alkyon}
// 1.14.96: καταχωρείται στο AlkBridgeViewController (SceneDelegate.swift). Πριν ήταν σε οθόνη που δεν εμφανίζεται και δεν δούλευε καθόλου.
// 1.14.96: το link απαντούσε πάντα ok, ακόμη κι όταν δεν υπήρχε ρολόι ή εφαρμογή στο ρολόι, και η οθόνη έγραφε «Στάλθηκε στο ρολόι».
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
    private var pendingCall: CAPPluginCall? = nil

    override public func load() {
        if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
    }

    @objc func link(_ call: CAPPluginCall) {
        let code = call.getString("code") ?? ""
        guard code.count >= 6 else { call.reject("code"); return }
        let ctx: [String: Any] = ["code": code, "lang": call.getString("lang") ?? "en", "at": Date().timeIntervalSince1970]
        guard WCSession.isSupported() else { call.resolve(["ok": false, "err": "unsupported"]); return }
        DispatchQueue.main.async {
            let s = WCSession.default
            if s.activationState != .activated {
                // η σύνδεση με το ρολόι ενεργοποιείται ακόμη: απάντηση όταν τελειώσει, ή «inactive» μετά από 5″
                self.finishPending(err: "inactive")
                self.pending = ctx; self.pendingCall = call; call.keepAlive = true; s.activate()
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) { if self.pendingCall === call { self.finishPending(err: "inactive") } }
                return
            }
            self.answer(call, self.send(ctx))
        }
    }

    /* nil = στάλθηκε· αλλιώς ο λόγος που δεν στάλθηκε */
    private func send(_ ctx: [String: Any]) -> String? {
        let s = WCSession.default
        guard s.isPaired else { return "nowatch" }
        guard s.isWatchAppInstalled else { return "noapp" }
        try? s.updateApplicationContext(ctx)
        s.transferUserInfo(ctx)
        if s.isReachable { s.sendMessage(ctx, replyHandler: nil, errorHandler: nil) }
        return nil
    }

    private func answer(_ call: CAPPluginCall, _ err: String?) {
        if let e = err { call.resolve(["ok": false, "err": e]) } else { call.resolve(["ok": true]) }
    }

    private func finishPending(err: String?) {
        guard let c = pendingCall else { return }
        pendingCall = nil; pending = nil
        answer(c, err); bridge?.releaseCall(c)
    }

    @objc func status(_ call: CAPPluginCall) {
        guard WCSession.isSupported() else { call.resolve(["watches": 0, "app": 0]); return }
        let s = WCSession.default
        call.resolve(["watches": s.isPaired ? 1 : 0, "app": (s.isPaired && s.isWatchAppInstalled) ? 1 : 0])
    }

    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            guard let p = self.pending, self.pendingCall != nil else { return }
            if activationState == .activated { self.finishPending(err: self.send(p)) } else { self.finishPending(err: "inactive") }
        }
    }
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
