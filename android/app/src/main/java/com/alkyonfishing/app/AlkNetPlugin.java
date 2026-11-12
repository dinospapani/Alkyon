package com.alkyonfishing.app;

/* Alkyon 1.13.1 · «Δίκτυο σκάφους»: ακούει στο WiFi (UDP broadcast/multicast) και συνδέεται σε TCP,
   για να διαβάσει NMEA 0183 (βάθος, θερμοκρασία, θέση) από plotter ή πύλη NMEA. Η ιστοσελίδα δεν μπορεί
   να ανοίξει τέτοιες συνδέσεις· η εφαρμογή Android μπορεί.
   JS: Capacitor.registerPlugin('AlkNet')
     start({udp:[ports], groups:['239.255.0.1',…], tcp:[{host,port}]}) → {udp:[ok ports], bad:[…]}
     stop(), info() → {ifs:[{name,ip,prefix}]}, scan({host, ports:[…], timeout}) → {open:[ports]}
     event 'data' {items:[{p:'udp'|'tcp', port, from, n, txt?|hex?, err?}], drop} κάθε ~300 ms */

import android.content.Context;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.Closeable;
import java.io.InputStream;
import java.net.DatagramPacket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "AlkNet")
public class AlkNetPlugin extends Plugin {
    private final List<Closeable> socks = new CopyOnWriteArrayList<>();
    private WifiManager.MulticastLock mlock;
    private volatile boolean running = false;
    private volatile int gen = 0;
    private final Object qlock = new Object();
    private JSArray queue = new JSArray();
    private int qn = 0, drop = 0;
    private final Map<String, Long> lastBin = new ConcurrentHashMap<>();
    private ScheduledExecutorService flusher;

    @PluginMethod
    public void start(PluginCall call) {
        stopAll();
        running = true;
        final int g0 = ++gen;
        JSArray udp = call.getArray("udp", new JSArray());
        JSArray groups = call.getArray("groups", new JSArray());
        JSArray tcp = call.getArray("tcp", new JSArray());
        JSArray ok = new JSArray(), bad = new JSArray();
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) { mlock = wm.createMulticastLock("alkyon-net"); mlock.setReferenceCounted(false); mlock.acquire(); }
        } catch (Exception e) { bad.put("multicast lock: " + e.getMessage()); }
        List<NetworkInterface> ifs = mcastIfs();
        for (int i = 0; i < udp.length(); i++) {
            final int port = udp.optInt(i, -1);
            if (port <= 0 || port > 65535) continue;
            try {
                final MulticastSocket s = new MulticastSocket(null);
                s.setReuseAddress(true);
                s.setBroadcast(true);
                s.bind(new InetSocketAddress(port));
                for (int g = 0; g < groups.length(); g++) {
                    String ga = groups.optString(g, "");
                    if (ga.isEmpty()) continue;
                    for (NetworkInterface ni : ifs) {
                        try { s.joinGroup(new InetSocketAddress(InetAddress.getByName(ga), port), ni); } catch (Exception ignored) { }
                    }
                }
                socks.add(s);
                ok.put(port);
                Thread t = new Thread(() -> udpLoop(s, port, g0), "alk-udp-" + port);
                t.setDaemon(true);
                t.start();
            } catch (Exception e) { bad.put(port + ": " + e.getMessage()); }
        }
        for (int i = 0; i < tcp.length(); i++) {
            try {
                org.json.JSONObject o = tcp.getJSONObject(i);
                final String host = o.optString("host", "");
                final int port = o.optInt("port", 0);
                if (host.isEmpty() || port <= 0) continue;
                Thread t = new Thread(() -> tcpLoop(host, port, g0), "alk-tcp-" + port);
                t.setDaemon(true);
                t.start();
            } catch (Exception e) { bad.put("tcp: " + e.getMessage()); }
        }
        flusher = Executors.newSingleThreadScheduledExecutor();
        flusher.scheduleWithFixedDelay(this::flush, 300, 300, TimeUnit.MILLISECONDS);
        JSObject r = new JSObject();
        r.put("udp", ok);
        r.put("bad", bad);
        call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) { stopAll(); call.resolve(); }

    @PluginMethod
    public void info(PluginCall call) {
        JSArray arr = new JSArray();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    if (!(ia.getAddress() instanceof Inet4Address)) continue;
                    JSObject o = new JSObject();
                    o.put("name", ni.getName());
                    o.put("ip", ia.getAddress().getHostAddress());
                    o.put("prefix", ia.getNetworkPrefixLength());
                    arr.put(o);
                }
            }
        } catch (Exception ignored) { }
        JSObject r = new JSObject();
        r.put("ifs", arr);
        call.resolve(r);
    }

    /* ποιες πόρτες TCP είναι ανοιχτές σε μια διεύθυνση (π.χ. του plotter) */
    @PluginMethod
    public void scan(PluginCall call) {
        final String host = call.getString("host", "");
        final JSArray ports = call.getArray("ports", new JSArray());
        final int to = call.getInt("timeout", 700);
        if (host == null || host.isEmpty()) { call.reject("host"); return; }
        new Thread(() -> {
            final List<Integer> open = Collections.synchronizedList(new ArrayList<>());
            final CountDownLatch done = new CountDownLatch(ports.length());
            for (int i = 0; i < ports.length(); i++) {
                final int p = ports.optInt(i, -1);
                new Thread(() -> {
                    try (Socket so = new Socket()) { so.connect(new InetSocketAddress(host, p), to); open.add(p); }
                    catch (Exception ignored) { }
                    finally { done.countDown(); }
                }).start();
            }
            try { done.await(to + 3000, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) { }
            JSArray a = new JSArray();
            synchronized (open) { Collections.sort(open); for (Integer p : open) a.put(p); }
            JSObject r = new JSObject();
            r.put("open", a);
            call.resolve(r);
        }, "alk-scan").start();
    }

    private void udpLoop(MulticastSocket s, int port, int g0) {
        byte[] buf = new byte[65535];
        while (running && g0 == gen && !s.isClosed()) {
            try {
                DatagramPacket pk = new DatagramPacket(buf, buf.length);
                s.receive(pk);
                push("udp", port, pk.getAddress() != null ? pk.getAddress().getHostAddress() : "", buf, pk.getLength(), null);
            } catch (Exception e) {
                if (running) push("udp", port, "", null, 0, String.valueOf(e.getMessage()));
                break;
            }
        }
    }

    private void tcpLoop(String host, int port, int g0) {
        int wait = 2000;
        while (running && g0 == gen) {
            Socket so = new Socket();
            try {
                so.connect(new InetSocketAddress(host, port), 5000);
                so.setSoTimeout(0);
                socks.add(so);
                wait = 2000;
                push("tcp", port, host, null, 0, "connected");
                InputStream in = so.getInputStream();
                byte[] buf = new byte[8192];
                int n;
                while (running && g0 == gen && (n = in.read(buf)) > 0) push("tcp", port, host, buf, n, null);
                if (running) push("tcp", port, host, null, 0, "closed");
            } catch (Exception e) {
                if (running) push("tcp", port, host, null, 0, String.valueOf(e.getMessage()));
            } finally {
                try { so.close(); } catch (Exception ignored) { }
                socks.remove(so);
            }
            try { Thread.sleep(wait); } catch (InterruptedException ignored) { }
            wait = Math.min(wait * 2, 30000);
        }
    }

    private void push(String proto, int port, String from, byte[] b, int n, String err) {
        JSObject o = new JSObject();
        o.put("p", proto);
        o.put("port", port);
        o.put("from", from);
        o.put("n", n);
        if (err != null) o.put("err", err);
        if (b != null && n > 0) {
            int printable = 0;
            for (int i = 0; i < n; i++) { int c = b[i] & 0xff; if (c == 9 || c == 10 || c == 13 || (c >= 32 && c < 127)) printable++; }
            if (printable >= n * 0.9) {
                o.put("txt", new String(b, 0, Math.min(n, 4000), StandardCharsets.US_ASCII));
            } else {
                /* δυαδικά (π.χ. ηχώ/ραντάρ): ένα δείγμα ανά πόρτα και πηγή κάθε 2″, για να μη γεμίσει η ουρά */
                String k = proto + port + from;
                long now = System.currentTimeMillis();
                Long last = lastBin.get(k);
                if (last != null && now - last < 2000) { synchronized (qlock) { drop++; } return; }
                lastBin.put(k, now);
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < Math.min(n, 48); i++) sb.append(String.format("%02x", b[i] & 0xff));
                o.put("hex", sb.toString());
            }
        }
        synchronized (qlock) {
            if (qn >= 400) { drop++; return; }
            queue.put(o);
            qn++;
        }
    }

    private void flush() {
        JSArray q;
        int d;
        synchronized (qlock) {
            if (qn == 0 && drop == 0) return;
            q = queue; d = drop;
            queue = new JSArray(); qn = 0; drop = 0;
        }
        JSObject r = new JSObject();
        r.put("items", q);
        r.put("drop", d);
        notifyListeners("data", r);
    }

    private List<NetworkInterface> mcastIfs() {
        List<NetworkInterface> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback() || !ni.supportsMulticast()) continue;
                boolean v4 = false;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) if (ia.getAddress() instanceof Inet4Address) v4 = true;
                if (v4) out.add(ni);
            }
        } catch (Exception ignored) { }
        return out;
    }

    private void stopAll() {
        running = false;
        for (Closeable c : socks) { try { c.close(); } catch (Exception ignored) { } }
        socks.clear();
        if (flusher != null) { flusher.shutdownNow(); flusher = null; }
        if (mlock != null) { try { if (mlock.isHeld()) mlock.release(); } catch (Exception ignored) { } mlock = null; }
        synchronized (qlock) { queue = new JSArray(); qn = 0; drop = 0; }
        lastBin.clear();
    }

    @Override
    protected void handleOnDestroy() { stopAll(); super.handleOnDestroy(); }
}
