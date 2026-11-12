package com.alkyonfishing.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlkNetPlugin.class); /* 1.13.1: «Δίκτυο σκάφους» (NMEA μέσω WiFi) */
        super.onCreate(savedInstanceState);
    }
}
