package com.alkyonfishing.app;

/* Alkyon 1.13.8 · Βαρόμετρο του κινητού. Η ιστοσελίδα δεν έχει πρόσβαση στον αισθητήρα πίεσης· η εφαρμογή έχει.
   JS: Capacitor.registerPlugin('AlkBaro')
     available() → {ok:bool}
     read() → {hpa, t} (μέσος όρος ~3″ μετρήσεων) ή σφάλμα αν δεν υπάρχει αισθητήρας
   Διαβάζει μόνο όταν το ζητήσει η εφαρμογή (όχι συνεχώς), για να μη χαλάει μπαταρία. */

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlkBaro")
public class AlkBaroPlugin extends Plugin {
    private SensorManager sm() { return (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE); }

    @PluginMethod
    public void available(PluginCall call) {
        SensorManager m = sm();
        JSObject r = new JSObject();
        r.put("ok", m != null && m.getDefaultSensor(Sensor.TYPE_PRESSURE) != null);
        call.resolve(r);
    }

    @PluginMethod
    public void read(final PluginCall call) {
        final SensorManager m = sm();
        final Sensor s = m == null ? null : m.getDefaultSensor(Sensor.TYPE_PRESSURE);
        if (s == null) { call.reject("no-sensor"); return; }
        final Handler hd = new Handler(Looper.getMainLooper());
        final double[] acc = new double[] { 0, 0 };
        final boolean[] done = new boolean[] { false };
        final SensorEventListener[] ref = new SensorEventListener[1];
        final Runnable finish = new Runnable() {
            @Override public void run() {
                if (done[0]) return; done[0] = true;
                try { m.unregisterListener(ref[0]); } catch (Exception e) { }
                if (acc[1] < 1) { call.reject("no-data"); return; }
                JSObject r = new JSObject();
                r.put("hpa", acc[0] / acc[1]);
                r.put("n", (int) acc[1]);
                r.put("t", System.currentTimeMillis());
                call.resolve(r);
            }
        };
        ref[0] = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent ev) {
                if (ev.values.length > 0 && ev.values[0] > 300 && ev.values[0] < 1200) { acc[0] += ev.values[0]; acc[1] += 1; }
                if (acc[1] >= 20) hd.post(finish);
            }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        m.registerListener(ref[0], s, SensorManager.SENSOR_DELAY_NORMAL, hd);
        hd.postDelayed(finish, 3000);
    }
}
