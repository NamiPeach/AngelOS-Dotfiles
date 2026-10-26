import QtQuick
import qs.services
import qs.widgets
import "PixelWheel.js" as Wheel

Column {
    id: root
    property var plugin
    readonly property var prefs: Wheel.settings(plugin ? plugin.get("wheel", {}) : {})
    width: parent ? parent.width : 500
    spacing: Skin.spacing
    function save(key, value) {
        const next = Object.assign({}, prefs);
        next[key] = value;
        plugin.set("wheel", next);
    }
    PxGroup {
        title: "Pixel Forge"
        icon: "folder"
        width: parent.width
        PxText {
            width: parent.width
            wrapMode: Text.Wrap
            text: "Hold a file and press Ctrl+Alt+F. Hover the centre dots for Actions / Tools / Convert; drop in the centre to cancel. Settings save automatically."
        }
        Repeater {
            model: [
                {
                    key: "diameter",
                    label: "Wheel diameter",
                    from: 240,
                    to: 400,
                    step: 8
                },
                {
                    key: "pixel",
                    label: "Pixel size (follows system scaling)",
                    from: 4,
                    to: 12,
                    step: 2
                },
                {
                    key: "gap",
                    label: "Outer arc gap (grid pixels)",
                    from: 0,
                    to: 2,
                    step: 1
                },
                {
                    key: "delay",
                    label: "Submenu delay (ms)",
                    from: 150,
                    to: 1000,
                    step: 50
                }
            ]
            SettingRow {
                required property var modelData
                label: modelData.label
                PxSlider {
                    width: parent.width
                    from: modelData.from
                    to: modelData.to
                    stepSize: modelData.step
                    value: root.prefs[modelData.key]
                    live: false
                    onReleased: v => root.save(modelData.key, v)
                }
            }
        }
        SettingRow {
            label: "Follow system colours"
            PxToggle {
                checked: root.prefs.system
                onToggled: c => root.save("system", c)
            }
        }
        SettingRow {
            label: "Custom accent (#RRGGBB)"
            visible: !root.prefs.system
            PxField {
                text: root.prefs.accent
                onEditingFinished: if (/^#[0-9a-f]{6}$/i.test(text))
                    root.save("accent", text)
            }
        }
        SettingRow {
            label: "Custom wheel colour (#RRGGBB)"
            visible: !root.prefs.system
            PxField {
                text: root.prefs.surface
                onEditingFinished: if (/^#[0-9a-f]{6}$/i.test(text))
                    root.save("surface", text)
            }
        }
        PxText {
            width: parent.width
            wrapMode: Text.Wrap
            dim: true
            text: "The wheel uses your system cursor. Choose Roxy and its size in Appearance after importing your personal pack. Global shortcuts can be edited in Keyboard settings."
        }
        PxButton {
            text: "Reset wheel settings"
            onClicked: root.plugin.set("wheel", {})
        }
    }
}
