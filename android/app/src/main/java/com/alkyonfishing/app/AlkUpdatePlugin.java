package com.alkyonfishing.app;

/* Alkyon 1.14.102 · Νέα έκδοση από το Google Play μέσα στην εφαρμογή (Play In-App Updates).
   JS: Capacitor.registerPlugin('AlkUpdate')   (window.AKN.upd, v4/shell.js)
     info()  → {available, code, immediate, inProgress, staleDays}
               available: το Play έχει νεότερη έκδοση για ΑΥΤΟΝ τον χρήστη (internal / closed / production)
               code: το versionCode της (1014102 = 1.14.102)
               inProgress: ενημέρωση που ξεκίνησε από την εφαρμογή και διακόπηκε
               Σφάλμα (reject) όταν η εφαρμογή δεν εγκαταστάθηκε από το Play (π.χ. APK δοκιμής): τότε η εφαρμογή διαβάζει το app-version.json.
     start() → ανοίγει την οθόνη ενημέρωσης του Play (IMMEDIATE: κατέβασμα, εγκατάσταση, επανεκκίνηση). {result: RESULT_OK / RESULT_CANCELED / ...}
   Καλείται μόνο όταν ο χρήστης πατήσει «Ενημέρωση» (ή για να συνεχίσει ενημέρωση που διακόπηκε)· η εφαρμογή δεν το καλεί μέσα σε έξοδο. */

import android.app.Activity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

@CapacitorPlugin(name = "AlkUpdate")
public class AlkUpdatePlugin extends Plugin {
    private AppUpdateManager mgr;

    private AppUpdateManager mgr() {
        if (mgr == null) mgr = AppUpdateManagerFactory.create(getContext());
        return mgr;
    }

    @PluginMethod
    public void info(final PluginCall call) {
        try {
            mgr().getAppUpdateInfo()
                .addOnSuccessListener(i -> {
                    JSObject r = new JSObject();
                    int a = i.updateAvailability();
                    r.put("available", a == UpdateAvailability.UPDATE_AVAILABLE);
                    r.put("inProgress", a == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS);
                    r.put("code", i.availableVersionCode());
                    r.put("immediate", i.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
                    Integer st = i.clientVersionStalenessDays();
                    if (st != null) r.put("staleDays", st);
                    call.resolve(r);
                })
                .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage())));
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void start(final PluginCall call) {
        final Activity act = getActivity();
        if (act == null) { call.reject("no-activity"); return; }
        try {
            mgr().getAppUpdateInfo()
                .addOnSuccessListener(i -> {
                    int a = i.updateAvailability();
                    boolean ok = (a == UpdateAvailability.UPDATE_AVAILABLE && i.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
                        || a == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
                    if (!ok) { call.reject("not-available"); return; }
                    launch(call, act, i);
                })
                .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage())));
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    private void launch(final PluginCall call, final Activity act, final AppUpdateInfo i) {
        try {
            mgr().startUpdateFlow(i, act, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
                .addOnSuccessListener(res -> {
                    JSObject r = new JSObject();
                    r.put("result", res == null ? 0 : res);
                    call.resolve(r);
                })
                .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage())));
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
