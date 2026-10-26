import QtQuick
import Quickshell
import qs.widgets
PxButton {
    property var plugin
    property string screenName
    property var barWindow
    text: "Forge"
    icon: "folder"
    compact: true
    onClicked: Quickshell.execDetached(["qs", "-c", "angelos", "ipc", "call", "pixelForge", "show"])
}
