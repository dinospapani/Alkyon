package com.alkyonfishing.app;

/* Alkyon 1.14.83 (P0.7) · έλεγχος του GPS εξόδου με σβηστή οθόνη (AlkTripService).
   JS: Capacitor.registerPlugin('AlkTrip')
     start({id, key, url, apikey, interval, title, text}) → {ok}   (μόνο αν υπάρχει άδεια θέσης· αλλιώς {ok:false, err:'perm'})
     stop() → {ok}
     fixes({since}) → {fixes:[[lat, lon, t, acc], …]}  σημεία που κατέγραψε η υπηρεσία μετά το since (ms)
     status() → {running} */

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

@CapacitorPlugin(name = "AlkTrip")
public class AlkTripPlugin extends Plugin {
    private boolean hasLoc() {
        Context c = getContext();
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void start(PluginCall call) {
        String id = call.getString("id", ""), key = call.getString("key", "");
        if (id.isEmpty() || key.isEmpty()) { call.reject("args"); return; }
        if (!hasLoc()) { JSObject r = new JSObject(); r.put("ok", false); r.put("err", "perm"); call.resolve(r); return; }
        Context c = getContext();
        SharedPreferences p = c.getSharedPreferences(AlkTripService.PREFS, Context.MODE_PRIVATE);
        String prev = p.getString("id", "");
        if (!prev.isEmpty() && !prev.equals(id)) p.edit().remove("fixes:" + prev).apply();   // σημεία προηγούμενης εξόδου
        Intent i = new Intent(c, AlkTripService.class)
            .putExtra("id", id).putExtra("key", key).putExtra("url", call.getString("url", "")).putExtra("apikey", call.getString("apikey", ""))
            .putExtra("interval", (long) (call.getInt("interval", 180) * 1000)).putExtra("title", call.getString("title", "Alkyon")).putExtra("text", call.getString("text", ""));
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
            JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
        } catch (Exception e) { call.reject("start: " + e.getMessage()); }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context c = getContext();
        c.stopService(new Intent(c, AlkTripService.class));
        c.getSharedPreferences(AlkTripService.PREFS, Context.MODE_PRIVATE).edit().remove("id").remove("key").apply();
        JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
    }

    @PluginMethod
    public void fixes(PluginCall call) {
        double since = call.getDouble("since", 0.0);
        SharedPreferences p = getContext().getSharedPreferences(AlkTripService.PREFS, Context.MODE_PRIVATE);
        String id = call.getString("id", p.getString("id", ""));
        JSArray out = new JSArray();
        try {
            JSONArray a = new JSONArray(p.getString("fixes:" + id, "[]"));
            for (int i = 0; i < a.length(); i++) { JSONArray f = a.getJSONArray(i); if (f.getDouble(2) > since) out.put(f); }
        } catch (Exception e) { }
        JSObject r = new JSObject(); r.put("fixes", out); call.resolve(r);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject(); r.put("running", AlkTripService.running); call.resolve(r);
    }
}
