// Alkyon: η οθόνη του Capacitor, με τα δικά μας πρόσθετα (ρολόι Apple Watch).
import UIKit
import Capacitor

// ΠΡΟΣΟΧΗ (1.14.94): αυτή η οθόνη ΔΕΝ εμφανίζεται. Το Main.storyboard τη δηλώνει, αλλά ο SceneDelegate αντικαθιστά το παράθυρο με AlkBridgeViewController
// (SceneDelegate.swift) πριν φορτωθεί. Ό,τι καταχωρείται εδώ δεν φτάνει στη σελίδα. Το AlkTrip μεταφέρθηκε εκεί. Το AlkWatch (αυτόματη αποστολή του κωδικού
// σύνδεσης στο Apple Watch) μένει εδώ, δηλαδή ΑΝΕΝΕΡΓΟ όπως ήταν, μέχρι να αποφασιστεί ξεχωριστά: η ενεργοποίησή του είναι αλλαγή συμπεριφοράς που δεν έχει δοκιμαστεί.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AlkWatchPlugin())
    }
}
