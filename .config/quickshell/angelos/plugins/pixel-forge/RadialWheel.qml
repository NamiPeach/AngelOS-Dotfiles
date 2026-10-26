import QtQuick
import qs.services
import qs.widgets
import "PixelWheel.js" as Wheel

Item {
    id: root
    property var plugin
    property var info: ({})
    property string mode: "convert"
    property real availableWidth: 800
    property real availableHeight: 800
    readonly property var prefs: Wheel.settings(plugin ? plugin.get("wheel", {}) : {})
    readonly property var geometry: Wheel.geometry(Skin.px(prefs.diameter), Skin.px(prefs.pixel), prefs.gap, availableWidth, availableHeight)
    readonly property var entries: Wheel.menu(info, mode)
    property int parentIndex: -1
    readonly property var childrenEntries: parentIndex >= 0 && entries[parentIndex] ? entries[parentIndex].children : []
    property var hovered: ({
            zone: "none",
            index: -1
        })
    readonly property color face: prefs.system ? Skin.surface : prefs.surface
    readonly property color accent: prefs.system ? Skin.accent : prefs.accent
    readonly property color ink: prefs.system ? Skin.text : (face.r * .299 + face.g * .587 + face.b * .114 > .55 ? "#211124" : "#ffe1f1")
    readonly property var palette: ({
            face: String(face),
            selected: String(Qt.tint(face, Qt.alpha(accent, .42))),
            hub: String(Qt.tint(face, Qt.alpha(accent, .16))),
            edge: String(Skin.separator)
        })
    implicitWidth: geometry.extent * 2
    implicitHeight: implicitWidth
    signal chosen(var entry)
    signal cancelled
    onModeChanged: {
        parentIndex = -1;
        hovered = ({
                zone: "none",
                index: -1
            });
    }
    onEntriesChanged: parentIndex = -1
    onParentIndexChanged: canvas.requestPaint()
    onHoveredChanged: {
        dwell.stop();
        if ((hovered.zone === "main" && entries[hovered.index] && entries[hovered.index].children.length) || hovered.zone === "mode")
            dwell.restart();
        canvas.requestPaint();
    }
    onGeometryChanged: canvas.requestPaint()
    onPaletteChanged: canvas.requestPaint()
    onChildrenEntriesChanged: canvas.requestPaint()
    function track(x, y) {
        const dx = x - width / 2, dy = y - height / 2, c = geometry.cell;
        let h = Wheel.hit(dx, dy, geometry, entries.length, parentIndex, childrenEntries.length);
        // Three mode dots live inside the hub; dwell selects without dropping the file.
        if (Math.abs(dy - 2 * c) < c && Math.abs(dx) < 3 * c)
            h = {
                zone: "mode",
                index: Math.max(0, Math.min(2, Math.floor((dx + 3 * c) / (2 * c))))
            };
        if (h.zone !== hovered.zone || h.index !== hovered.index)
            hovered = h;
    }
    function choose(x, y) {
        track(x, y);
        if (hovered.zone === "hub") {
            cancelled();
            return false;
        }
        if (hovered.zone === "mode") {
            mode = ["actions", "tools", "convert"][hovered.index];
            return false;
        }
        const entry = hovered.zone === "outer" ? childrenEntries[hovered.index] : hovered.zone === "main" ? entries[hovered.index] : null;
        if (!entry)
            return false;
        if (entry.children.length) {
            parentIndex = hovered.index;
            return false;
        }
        chosen(entry);
        return true;
    }
    function cycle(step) {
        const modes = ["actions", "tools", "convert"];
        mode = modes[(modes.indexOf(mode) + step + 3) % 3];
    }
    Timer {
        id: dwell
        interval: root.prefs.delay
        onTriggered: {
            if (root.hovered.zone === "mode")
                root.mode = ["actions", "tools", "convert"][root.hovered.index];
            else if (root.hovered.zone === "main")
                root.parentIndex = root.hovered.index;
        }
    }
    Canvas {
        id: canvas
        anchors.fill: parent
        antialiasing: false
        onPaint: {
            const ctx = getContext("2d");
            ctx.reset();
            ctx.clearRect(0, 0, width, height);
            ctx.translate(width / 2, height / 2);
            Wheel.paint(ctx, root.geometry, root.entries.length, root.parentIndex, root.childrenEntries.length, root.hovered, root.palette);
        }
    }
    Repeater {
        model: root.entries
        delegate: PxText {
            required property int index
            required property var modelData
            readonly property var pos: Wheel.position(index, root.entries.length, root.geometry, false, 0, 0)
            x: root.width / 2 + pos.x - width / 2
            y: root.height / 2 + pos.y - height / 2
            width: root.geometry.r * root.geometry.cell * .52
            text: modelData.label
            kind: "body"
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            color: root.ink
        }
    }
    Repeater {
        model: root.childrenEntries
        delegate: PxText {
            required property int index
            required property var modelData
            readonly property var pos: Wheel.position(index, root.childrenEntries.length, root.geometry, true, root.parentIndex, root.entries.length)
            x: root.width / 2 + pos.x - width / 2
            y: root.height / 2 + pos.y - height / 2
            width: root.geometry.cell * 7
            text: modelData.label
            kind: "body"
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
            color: root.ink
        }
    }
    PxText {
        anchors.horizontalCenter: parent.horizontalCenter
        y: parent.height / 2 - height
        width: root.geometry.hub * root.geometry.cell * 1.8
        text: root.entries.length ? root.mode.toUpperCase() : "NO ACTIONS"
        kind: "tiny"
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.Wrap
        color: root.ink
    }
    Repeater {
        model: ["actions", "tools", "convert"]
        delegate: Rectangle {
            required property int index
            required property string modelData
            x: root.width / 2 + (index - 1) * 2 * root.geometry.cell - width / 2
            y: root.height / 2 + 1.5 * root.geometry.cell
            width: root.geometry.cell
            height: width
            color: root.mode === modelData ? root.accent : Skin.textDim
        }
    }
    MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        onPositionChanged: e => root.track(e.x, e.y)
        onClicked: e => root.choose(e.x, e.y)
        onExited: {
            dwell.stop();
            root.hovered = ({
                    zone: "none",
                    index: -1
                });
        }
        onWheel: e => {
            root.cycle(e.angleDelta.y > 0 ? -1 : 1);
            e.accepted = true;
        }
    }
}
