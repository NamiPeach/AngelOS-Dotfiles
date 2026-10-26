import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.services
import qs.widgets
import "WheelLogic.js" as Logic

// One Wayland drop surface per screen. No keyboard grab: the source keeps its drag.
Item {
    id: root
    property var plugin
    property bool active: false
    property var info: ({})
    property string dragUrl: ""
    property string level: ""
    property string message: "Hold a file, move here, then drop on an action."
    property bool dragging: false
    property bool received: false
    property bool metadataReady: false
    signal dismissed()
    signal chosen(string path, string action, string target, bool immediate)

    readonly property var action: (info.actions || []).find(a => a.id === level)
    readonly property var slots: level && action
        ? (action.targets || []).map(t => ({label: t.toUpperCase(), action: level, target: t, available: action.available, submenu: false}))
        : (info.actions || []).map(a => ({label: a.label, action: a.id, target: "", available: a.available, submenu: a.targets.length > 0, tool: a.tool}))

    onActiveChanged: {
        inspector.running = false;
        root.info = ({});
        root.dragUrl = "";
        root.level = "";
        root.metadataReady = false;
        root.received = false;
        root.dragging = false;
        root.message = "Hold a file, move here, then drop on an action.";
    }
    function enter(event) {
        leaveTimer.stop();
        root.dragging = true;
        const url = Logic.localUrl(event.urls);
        if (!url) {
            root.message = "One local file at a time. Links and folders are not supported.";
            root.metadataReady = false;
            root.info = ({});
            root.dragUrl = "";
            event.accepted = false;
            root.dragging = false;
            return;
        }
        if (url === root.dragUrl) return;
        if (inspector.running) {
            // Do not reuse a previous file's metadata; a new entry can retry.
            event.accepted = false;
            root.message = "Still reading the previous file. Move out and back to retry.";
            return;
        }
        root.dragUrl = url;
        root.level = "";
        root.info = ({});
        root.metadataReady = false;
        root.message = "Reading available actions...";
        inspector.command = ["python3", plugin.dir + "/forge.py", "inspect", url];
        inspector.running = true;
    }
    function drop(event, index) {
        root.dragging = false;
        const url = Logic.localUrl(event.urls);
        const pick = Logic.choice(root.slots[index]);
        // Qt.CopyAction tells the source to retain its file, even when modifiers request Move.
        // Moving, if explicitly selected later, is handled by the backend after confirmation.
        if (!root.metadataReady || !url || url !== root.dragUrl || !pick || root.received
                || !(event.supportedActions & Qt.CopyAction)) {
            event.accepted = false;
            root.message = "Drop on an enabled tile. The original file is unchanged.";
            return;
        }
        event.accept(Qt.CopyAction);
        root.received = true;
        Qt.callLater(function() {
            root.chosen(url, pick.action, pick.target, pick.immediate);
        });
    }
    Timer {
        id: leaveTimer
        interval: 300
        onTriggered: { root.dragging = false; root.dismissed(); }
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
                if (!root.active) return;
                try {
                    const result = JSON.parse(text);
                    if (result.error) throw new Error(result.error);
                    root.info = result;
                    root.metadataReady = true;
                    root.message = "Hover Convert for formats. Drop to choose. Centre = cancel.";
                } catch (e) {
                    root.metadataReady = false;
                    root.message = String(e);
                }
            }
        }
        onExited: code => {
            if (root.active && code !== 0 && !root.metadataReady)
                root.message = "Could not read file. Check Python 3 and file access; use Browse for details.";
        }
    }
    Variants {
        model: root.active ? Shell.screens : []
        delegate: PanelWindow {
            id: win
            required property var modelData
            screen: modelData
            anchors { top: true; bottom: true; left: true; right: true }
            exclusionMode: ExclusionMode.Ignore
            color: "transparent"
            WlrLayershell.namespace: "angelos-pixel-forge"
            WlrLayershell.layer: WlrLayer.Overlay
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
            readonly property var g: Logic.geometry(width, height, Skin.px(1))
            property real cx: width / 2
            property real cy: height / 2
            property bool placed: false
            property int hover: -1
            property real pointerX: 0
            property real pointerY: 0
            function track(x, y) {
                pointerX = x;
                pointerY = y;
                if (!placed) {
                    const p = Logic.place(x, y, width, height, g);
                    cx = p.x; cy = p.y; placed = true;
                }
                hover = Logic.hit(x, y, root.slots.length, cx, cy, g);
            }
            readonly property bool inHub: Math.abs(pointerX - cx) < 62 * g.u && Math.abs(pointerY - cy) < 35 * g.u
            Timer {
                interval: 500
                running: root.dragging && win.hover >= 0 && !!root.slots[win.hover]
                         && root.slots[win.hover].submenu && root.slots[win.hover].available
                onTriggered: {
                    const slot = root.slots[win.hover];
                    if (slot && slot.submenu) { root.level = slot.action; win.hover = -1; }
                }
            }
            Timer {
                interval: 650
                running: root.dragging && !!root.level && win.inHub
                onTriggered: { root.level = ""; win.hover = -1; }
            }
            Item {
                anchors.fill: parent
                property string settingsSkin: "classic"
                Rectangle { anchors.fill: parent; color: Qt.alpha(Skin.shadow, 0.22) }
                MouseArea {
                    anchors.fill: parent
                    hoverEnabled: true
                    onPositionChanged: event => { if (!root.dragging) win.track(event.x, event.y); }
                    onClicked: root.dismissed()
                }
                Item {
                    visible: win.placed
                    anchors.fill: parent
                    Rectangle {
                        x: win.cx - 62 * win.g.u; y: win.cy - 35 * win.g.u
                        width: 124 * win.g.u; height: 70 * win.g.u
                        color: Skin.sunken
                        border.width: 2 * win.g.u; border.color: Skin.accent
                        PxText {
                            anchors.centerIn: parent
                            text: root.level ? "BACK / CANCEL" : "PIXEL FORGE"
                            kind: "tiny"
                            color: Skin.accent
                        }
                    }
                    PxText {
                        x: win.cx - 300 * win.g.u
                        y: win.cy - 245 * win.g.u
                        width: 600 * win.g.u
                        horizontalAlignment: Text.AlignHCenter
                        elide: Text.ElideMiddle
                        text: root.info.name || "Drop a file"
                        color: Skin.text
                    }
                    Repeater {
                        model: root.slots
                        delegate: Rectangle {
                            required property int index
                            required property var modelData
                            readonly property var pos: Logic.tile(index, root.slots.length, win.cx, win.cy, win.g)
                            x: pos.x; y: pos.y
                            width: win.g.tileW; height: win.g.tileH
                            color: win.hover === index ? Skin.accent : Skin.surface
                            border.width: 2 * win.g.u
                            border.color: win.hover === index ? Skin.accentText : Skin.separator
                            opacity: modelData.available ? 1 : 0.45
                            PxText {
                                anchors.centerIn: parent
                                text: modelData.label + (modelData.submenu ? " >" : "")
                                color: win.hover === parent.index ? Skin.accentText : Skin.text
                                kind: "small"
                            }
                        }
                    }
                }
                PxText {
                    anchors.bottom: parent.bottom
                    anchors.bottomMargin: Skin.padding
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: parent.width - 2 * Skin.padding
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.Wrap
                    color: Skin.text
                    text: root.message + "  |  Ctrl+Alt+F: close"
                }
                // A single stable drop surface avoids drag enter/leave churn across tiles.
                DropArea {
                    id: dropZone
                    anchors.fill: parent
                    onEntered: event => { root.enter(event); win.track(event.x, event.y); }
                    onPositionChanged: event => win.track(event.x, event.y)
                    onExited: leaveTimer.restart()
                    onDropped: event => {
                        if (win.inHub) { event.accepted = false; Qt.callLater(function() { root.dismissed(); }); return; }
                        const index = Logic.hit(event.x, event.y, root.slots.length, win.cx, win.cy, win.g);
                        root.drop(event, index);
                    }
                }
            }
        }
    }
}
