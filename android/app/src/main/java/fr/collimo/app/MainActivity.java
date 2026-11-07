package fr.collimo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** Fenêtre unique de Collimo : la page de l'app dans la WebView de Capacitor, avec le module d'accès aux dossiers. */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CollimoStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
