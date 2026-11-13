import UIKit
import Capacitor
import CoreMotion

/* 1.13.8: δικά μας πρόσθετα Capacitor καταχωρούνται εδώ (το Capacitor δεν τα βρίσκει μόνο του μέσα στο target της εφαρμογής). */
class AlkBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AlkBaroPlugin())
    }
}

/* Βαρόμετρο του iPhone (CMAltimeter). Η ιστοσελίδα δεν έχει πρόσβαση· η εφαρμογή έχει.
   JS: Capacitor.registerPlugin('AlkBaro') → available() {ok}, read() {hpa, n, t} (μέσος όρος ~3″). */
@objc(AlkBaroPlugin)
public class AlkBaroPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AlkBaroPlugin"
    public let jsName = "AlkBaro"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)
    ]
    private let alt = CMAltimeter()
    private var busy = false

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["ok": CMAltimeter.isRelativeAltitudeAvailable()])
    }

    @objc func read(_ call: CAPPluginCall) {
        if !CMAltimeter.isRelativeAltitudeAvailable() { call.reject("no-sensor"); return }
        if busy { call.reject("busy"); return }
        busy = true
        var sum = 0.0, n = 0, done = false
        let finish: () -> Void = { [weak self] in
            if done { return }
            done = true
            self?.alt.stopRelativeAltitudeUpdates()
            self?.busy = false
            if n < 1 { call.reject("no-data"); return }
            call.resolve(["hpa": sum / Double(n), "n": n, "t": Date().timeIntervalSince1970 * 1000])
        }
        alt.startRelativeAltitudeUpdates(to: OperationQueue.main) { data, err in
            if let d = data {
                let hpa = d.pressure.doubleValue * 10.0 /* kPa → hPa */
                if hpa > 300 && hpa < 1200 { sum += hpa; n += 1 }
                if n >= 3 { finish() }
            } else if err != nil { finish() }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) { finish() }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = AlkBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
