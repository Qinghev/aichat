package com.qinghe.aichatsandbox;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InternalUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
