import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.services
import qs.widgets
import "WheelLogic.js" as Logic

Item {
    id: root
    property var plugin
    property bool active: false
    property string mode: "convert"
    property var info: ({})
    property string dragUrl: ""
    property string message: "Move the held file here. Centre = cancel."
    property bool dragging: false
    property bool received: false
    property bool metadataReady: false
    signal changeMode(string value)
    signal dismissed
    signal chosen(string path, string action, string target, bool immediate)
    onActiveChanged: {
        inspector.running = false;
        info = ({});
        dragUrl = "";
        metadataReady = false;
        received = false;
        dragging = false;
        message = "Move the held file here. Centre = cancel.";
    }
    function enter(event) {
        leaveTimer.stop();
        dragging = true;
        const urls = Array.from(event.urls).map(String);
        if (!urls.length || urls.some(u => !/^file:\/\/(localhost)?\//.test(u))) {
            event.accepted = false;
            metadataReady = false;
            info = ({});
            message = "Choose local files.";
            return;
        }
        const url = JSON.stringify(urls);
        if (url === dragUrl)
            return;
        if (inspector.running) {
            event.accepted = false;
            message = "Still reading. Move out and back to retry.";
            return;
        }
        dragUrl = url;
        info = ({});
        metadataReady = false;
        message = "Reading available actions...";
        inspector.command = ["python3", plugin.dir + "/forge.py", "inspect", url];
        inspector.running = true;
    }
    function dispatch(entry) {
        if (!metadataReady || received)
            return;
        received = true;
        const url = dragUrl;
        Qt.callLater(function () {
            root.chosen(url, entry.action, entry.target, Logic.immediate(entry.action, entry.target));
        });
    }
    Timer {
        id: leaveTimer
        interval: 300
        onTriggered: {
            root.dragging = false;
            root.dismissed();
        }
    }
    Timer {
        interval: 60000
        running: root.active && !root.dragging
        onTriggered: root.dismissed()
    }
    Process {
        id: inspector
        stdout: StdioCollector {
            onStreamFinished: {
                if (!root.active)
                    return;
                try {
                    const result = JSON.parse(text);
                    if (result.error)
                        throw new Error(result.error);
                    root.info = result;
                    root.metadataReady = true;
                    root.message = "Hover a submenu or a mode dot. Drop in the centre to cancel.";
                } catch (e) {
                    root.metadataReady = false;
                    root.message = String(e);
                }
            }
        }
        onExited: code => {
            if (root.active && code !== 0 && !root.metadataReady)
                root.message = "Could not read files. Open Pixel Forge for details.";
        }
    }
    Variants {
        model: root.active ? Shell.screens : []
        delegate: PanelWindow {
            id: win
            required property var modelData
            screen: modelData
            anchors {
                top: true
                bottom: true
                left: true
                right: true
            }
            exclusionMode: ExclusionMode.Ignore
            color: "transparent"
            WlrLayershell.namespace: "angelos-pixel-forge"
            WlrLayershell.layer: WlrLayer.Overlay
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
            property bool placed: false
            function track(x, y) {
                if (!placed) {
                    wheel.x = Math.max(0, Math.min(width - wheel.width, x - wheel.width / 2));
                    wheel.y = Math.max(24, Math.min(height - wheel.height - 32, y - wheel.height / 2));
                    placed = true;
                }
                wheel.track(x - wheel.x, y - wheel.y);
            }
            Item {
                anchors.fill: parent
                property string settingsSkin: "classic"
                MouseArea {
                    anchors.fill: parent
                    onClicked: root.dismissed()
                }
                RadialWheel {
                    id: wheel
                    visible: win.placed
                    width: implicitWidth
                    height: implicitHeight
                    availableWidth: win.width
                    availableHeight: win.height
                    plugin: root.plugin
                    info: root.info
                    mode: root.mode
                    onModeChanged: if (root.mode !== mode)
                        root.changeMode(mode)
                    Connections {
                        target: root
                        function onModeChanged() {
                            wheel.mode = root.mode;
                        }
                    }
                    onChosen: entry => root.dispatch(entry)
                    onCancelled: root.dismissed()
                }
                PxText {
                    visible: win.placed
                    x: Math.max(8, Math.min(win.width - width - 8, wheel.x + wheel.width / 2 - width / 2))
                    y: Math.max(0, wheel.y - 24)
                    width: Math.min(win.width - 16, Skin.px(440))
                    text: root.info.name || "Pixel Forge"
                    horizontalAlignment: Text.AlignHCenter
                    elide: Text.ElideMiddle
                    color: Skin.text
                }
                PxText {
                    anchors.bottom: parent.bottom
                    anchors.bottomMargin: 8
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: parent.width - 16
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.Wrap
                    kind: "tiny"
                    text: root.message
                    color: Skin.text
                }
                DropArea {
                    anchors.fill: parent
                    onEntered: e => {
                        root.enter(e);
                        win.track(e.x, e.y);
                    }
                    onPositionChanged: e => win.track(e.x, e.y)
                    onExited: leaveTimer.restart()
                    onDropped: e => {
                        root.dragging = false;
                        if (!root.metadataReady || root.received || JSON.stringify(Array.from(e.urls).map(String)) !== root.dragUrl || !(e.supportedActions & Qt.CopyAction)) {
                            e.accepted = false;
                            root.dismissed();
                            return;
                        }
                        // The source always retains its files. Move has its own confirmation.
                        const picked = wheel.choose(e.x - wheel.x, e.y - wheel.y);
                        if (picked)
                            e.accept(Qt.CopyAction);
                        else {
                            e.accepted = false;
                            root.dismissed();
                        }
                    }
                }
            }
        }
    }
}
