package com.chordly.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Explicitly clear any launch window background drawable so splash never lingers behind WebView
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);
    }
}
