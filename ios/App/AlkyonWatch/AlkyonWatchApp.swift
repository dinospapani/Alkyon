// Alkyon για Apple Watch: εφαρμογή. Πρόγνωση από τη συνάρτηση «watch» του Supabase (ίδιος βαθμός με το κινητό και το Garmin),
// καταγραφή ψαριού, έξοδος με GPS, συρτή, σημεία, άγκυρα, δίχτυα, καλαμάρι, ειδοποιήσεις πίεσης στο παρασκήνιο, complications.
import SwiftUI
import WatchKit
import UserNotifications

final class AppDelegate: NSObject, WKApplicationDelegate, UNUserNotificationCenterDelegate {
    func applicationDidFinishLaunching() {
        UNUserNotificationCenter.current().delegate = self
        Link.shared.activate()
        Bg.schedule()
    }
    func applicationDidBecomeActive() {
        let e = Engine.shared
        e.visible = true; Loc.shared.once(); e.load(false); Sender.flushBg(); e.gpsUpdate()
    }
    func applicationWillResignActive() { Engine.shared.visible = false; Engine.shared.gpsUpdate() }
    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for task in backgroundTasks {
            if let t = task as? WKApplicationRefreshBackgroundTask {
                Task { await Bg.run(); Bg.schedule(); t.setTaskCompletedWithSnapshot(false) }
            } else if let t = task as? WKWatchConnectivityRefreshBackgroundTask {
                Link.shared.activate(); t.setTaskCompletedWithSnapshot(false)
            } else {
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }
    // ειδοποιήσεις και με την εφαρμογή ανοιχτή
    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification, withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) { done([.banner, .sound]) }
}

@main
struct AlkyonWatchApp: App {
    @WKApplicationDelegateAdaptor(AppDelegate.self) var delegate
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear { Loc.shared.ask(); Notify.ask() }
        }
    }
}
