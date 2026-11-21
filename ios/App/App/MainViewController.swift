// Alkyon: οθόνη του Capacitor που δηλώνει το Main.storyboard. ΔΕΝ εμφανίζεται: δεν καταχωρεί κανένα πρόσθετο.
import UIKit
import Capacitor

// ΠΡΟΣΟΧΗ (1.14.94): αυτή η οθόνη ΔΕΝ εμφανίζεται. Το Main.storyboard τη δηλώνει, αλλά ο SceneDelegate φτιάχνει νέο παράθυρο με
// AlkBridgeViewController (SceneDelegate.swift). Ό,τι καταχωρείται εδώ δεν φτάνει στη σελίδα.
// 1.14.94: το AlkTrip μεταφέρθηκε εκεί. 1.14.96: και το AlkWatch. Μην καταχωρείτε πρόσθετα σε αυτή την οθόνη.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
    }
}
