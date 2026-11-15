package com.alkyonfishing.app;

/* Alkyon · ρολόι Wear OS (Samsung Galaxy Watch, Pixel Watch κ.ά.): στέλνει τον κωδικό σύνδεσης στο ρολόι μέσω του Wearable Data Layer,
   ώστε ο χρήστης να μη χρειάζεται να τον γράψει. Το ρολόι τον διαβάζει από το /alkyon/link (LinkListener στο :wear).
   JS: Capacitor.registerPlugin('AlkWatch')
     link({code, lang}) → {ok}
     status() → {watches: πόσα ρολόγια είναι συνδεδεμένα, app: πόσα έχουν την εφαρμογή Alkyon} */

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.wearable.CapabilityClient;
import com.google.android.gms.wearable.CapabilityInfo;
import com.google.android.gms.wearable.Node;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;

import java.util.List;

@CapacitorPlugin(name = "AlkWatch")
public class AlkWatchPlugin extends Plugin {
    @PluginMethod
    public void link(final PluginCall call) {
        String code = call.getString("code", "");
        if (code == null || code.length() < 6) { call.reject("code"); return; }
        try {
            PutDataMapRequest r = PutDataMapRequest.create("/alkyon/link");
            r.getDataMap().putString("code", code);
            r.getDataMap().putString("lang", call.getString("lang", "en"));
            r.getDataMap().putLong("at", System.currentTimeMillis());
            PutDataRequest req = r.asPutDataRequest().setUrgent();
            Wearable.getDataClient(getContext()).putDataItem(req)
                .addOnSuccessListener(x -> { JSObject o = new JSObject(); o.put("ok", true); call.resolve(o); })
                .addOnFailureListener(e -> { JSObject o = new JSObject(); o.put("ok", false); o.put("err", String.valueOf(e.getMessage())); call.resolve(o); });
        } catch (Exception e) {
            JSObject o = new JSObject(); o.put("ok", false); o.put("err", String.valueOf(e.getMessage())); call.resolve(o);
        }
    }

    @PluginMethod
    public void status(final PluginCall call) {
        final JSObject o = new JSObject();
        try {
            Wearable.getNodeClient(getContext()).getConnectedNodes().addOnCompleteListener(t -> {
                List<Node> nodes = t.isSuccessful() ? t.getResult() : null;
                o.put("watches", nodes == null ? 0 : nodes.size());
                Wearable.getCapabilityClient(getContext()).getCapability("alkyon_watch", CapabilityClient.FILTER_REACHABLE).addOnCompleteListener(c -> {
                    CapabilityInfo ci = c.isSuccessful() ? c.getResult() : null;
                    o.put("app", ci == null ? 0 : ci.getNodes().size());
                    call.resolve(o);
                });
            });
        } catch (Exception e) { o.put("watches", 0); o.put("app", 0); call.resolve(o); }
    }
}
