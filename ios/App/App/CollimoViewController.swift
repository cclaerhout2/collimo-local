import Capacitor
import UIKit

/// Fenêtre de Collimo : la page de l'app dans la WebView de Capacitor, avec le module d'accès aux photos.
class CollimoViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CollimoStoragePlugin())
        NSLog("Collimo : module CollimoStorage enregistré")
    }
}
