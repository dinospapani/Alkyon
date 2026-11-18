// Alkyon: η οθόνη του Capacitor, με τα δικά μας πρόσθετα (ρολόι Apple Watch).
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AlkWatchPlugin())
        bridge?.registerPluginInstance(AlkTripPlugin())   // 1.14.83: GPS εξόδου με κλειδωμένη οθόνη
    }
}
