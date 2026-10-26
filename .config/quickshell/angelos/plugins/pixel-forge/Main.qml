import QtQuick
import QtQuick.Window
import QtQuick.Dialogs
import Quickshell
import Quickshell.Io
import qs.config
import qs.services
import qs.widgets
import "WheelLogic.js" as Logic

Item {
    id: root
    property var plugin
    property bool opened: false
    property bool wheelOpen: false
    property string wheelMode: "convert"
    property var pendingDrop: null
    property bool quickJob: false
    property var info: ({})
    property var selected: ({})
    property string resultPath: ""
    property string message: "Drop files or choose Browse to begin."
    property bool failed: false
    property bool confirmMove: false
    property string mode: "inspect"
    property string outputText: ""
    readonly property bool busy: worker.running

    function launch(mode, value) {
        if (busy || !plugin)
            return;
        root.mode = mode;
        outputText = "";
        failed = false;
        resultPath = "";
        message = mode === "inspect" ? "Reading file..." : "Working... You can close this window; the job continues.";
        worker.command = ["python3", plugin.dir + "/forge.py", mode, value];
        worker.running = true;
    }
    function inspect(path, request) {
        if (busy)
            return;
        quickJob = !!(request && request.immediate);
        opened = !quickJob;
        pendingDrop = request || null;
        info = ({});
        selected = ({});
        confirmMove = false;
        launch("inspect", path);
    }
    function selectAction(action) {
        selected = action;
        confirmMove = false;
        formats.currentValue = action.targets.length ? action.targets[0] : "";
    }
    function perform() {
        if (!selected.id || !selected.available || busy)
            return;
        launch("run", JSON.stringify({
            path: info.path,
            paths: info.paths,
            action: selected.id,
            target: formats.currentValue || "",
            destination: destination.text,
            width: widthField.text,
            start: startField.text,
            duration: durationField.text,
            confirmMove: confirmMove
        }));
    }
    IpcHandler {
        target: "pixelForge"
        function show(): void {
            root.wheelOpen = false;
            root.opened = true;
        }
        function wheel(): void {
            if (root.busy) {
                root.opened = true;
                return;
            }
            root.wheelOpen = !root.wheelOpen;
            if (root.wheelOpen)
                root.opened = false;
        }
        function openFile(path: string): void {
            root.inspect(path);
        }
        function setMode(value: string): void {
            if (["actions", "tools", "convert"].indexOf(value) < 0)
                return;
            root.wheelMode = value;
            if (!root.busy) {
                root.wheelOpen = true;
                root.opened = false;
            }
        }
    }
    DragWheel {
        plugin: root.plugin
        active: root.wheelOpen
        mode: root.wheelMode
        onChangeMode: value => root.wheelMode = value
        onDismissed: root.wheelOpen = false
        onChosen: (path, action, target, immediate) => {
            root.wheelOpen = false;
            destination.text = "";
            root.inspect(path, {
                action: action,
                target: target,
                immediate: immediate
            });
        }
    }
    Process {
        id: worker
        stdout: StdioCollector {
            onStreamFinished: root.outputText = text
        }
        stderr: StdioCollector {
            id: errors
        }
        onExited: code => {
            try {
                const data = JSON.parse(root.outputText);
                if (data.error)
                    throw new Error(data.error);
                if (root.mode === "inspect") {
                    root.info = data;
                    root.message = "Choose an action on the wheel.";
                    const pending = root.pendingDrop;
                    root.pendingDrop = null;
                    if (pending) {
                        const action = data.actions.find(a => a.id === pending.action);
                        if (!action || !action.available)
                            throw new Error("This action is unavailable for the dropped file.");
                        Qt.callLater(function () {
                            root.selectAction(action);
                            if (pending.target)
                                formats.currentValue = pending.target;
                            if (pending.immediate || pending.action === "metadata")
                                root.perform();
                        });
                    }
                } else {
                    root.resultPath = data.output || "";
                    root.message = data.warning ? (data.message || "Completed with warnings.") + "\n" + data.warning : (data.message || ("Done: " + data.output));
                    if (root.quickJob) {
                        Quickshell.execDetached(["notify-send", "-a", "Pixel Forge", "Pixel Forge", root.message]);
                        root.quickJob = false;
                    }
                    if (root.selected.id === "move") {
                        root.info = ({});
                        root.selected = ({});
                    }
                }
            } catch (e) {
                root.failed = true;
                root.quickJob = false;
                root.opened = true;
                root.message = root.outputText ? String(e) : (errors.text || "Could not start Python or read the converter response.");
            }
        }
    }
    FileDialog {
        id: picker
        parentWindow: win.contentItem.Window.window
        title: "Choose a file for Pixel Forge"
        onAccepted: root.inspect(String(selectedFile))
    }
    FolderDialog {
        id: folderPicker
        parentWindow: win.contentItem.Window.window
        title: "Choose output folder"
        onAccepted: destination.text = decodeURIComponent(String(selectedFolder).replace(/^file:\/\//, ""))
    }
    FloatingWindow {
        id: win
        title: "Pixel Forge"
        visible: root.opened
        implicitWidth: Skin.px(760)
        implicitHeight: Skin.px(820)
        minimumSize: Qt.size(Skin.px(640), Skin.px(520))
        color: Skin.surface
        onClosed: root.opened = false
        onVisibleChanged: if (!visible)
            root.opened = false
        Item {
            anchors.fill: parent
            property string settingsSkin: "classic"
            Flickable {
                anchors.fill: parent
                anchors.margins: Skin.padding
                contentWidth: width
                contentHeight: body.height
                clip: true
                Column {
                    id: body
                    width: parent.width
                    spacing: Skin.spacing
                    Row {
                        spacing: Skin.spacing
                        PxIcon {
                            name: "folder"
                        }
                        PxText {
                            text: "PIXEL FORGE"
                            kind: "title"
                            color: Skin.accent
                        }
                    }
                    PxText {
                        text: "FILES IN. POSSIBILITIES OUT."
                        color: Skin.textDim
                    }
                    Row {
                        spacing: Skin.spacing
                        PxButton {
                            text: "Settings"
                            onClicked: {
                                root.opened = false;
                                Shell.openSettings("plugin:pixel-forge");
                            }
                        }
                        PxButton {
                            text: "Browse..."
                            enabled: !root.busy
                            onClicked: picker.open()
                        }
                        PxButton {
                            text: "Drop wheel"
                            enabled: !root.busy
                            onClicked: {
                                root.opened = false;
                                root.wheelOpen = true;
                            }
                        }
                        PxButton {
                            text: "Paste file"
                            enabled: !root.busy
                            onClicked: {
                                clipboard.running = true;
                            }
                        }
                    }
                    SkinCard {
                        width: parent.width
                        height: Skin.px(66)
                        PxText {
                            anchors.fill: parent
                            anchors.margins: Skin.padding
                            text: drop.containsDrag ? "DROP TO LOAD" : (root.info.name || "Drop a local file here")
                            elide: Text.ElideMiddle
                            verticalAlignment: Text.AlignVCenter
                            color: drop.containsDrag ? Skin.accent : Skin.text
                        }
                        DropArea {
                            id: drop
                            anchors.fill: parent
                            enabled: !root.busy
                            onDropped: event => {
                                if (event.urls.length > 0 && (event.supportedActions & Qt.CopyAction)) {
                                    root.inspect(JSON.stringify(Array.from(event.urls).map(String)));
                                    event.accept(Qt.CopyAction);
                                } else {
                                    root.failed = true;
                                    root.message = "Choose local files.";
                                }
                            }
                        }
                    }
                    RadialWheel {
                        id: inlineWheel
                        enabled: !root.busy
                        width: parent.width
                        height: implicitHeight
                        availableWidth: parent.width
                        availableHeight: Skin.px(650)
                        plugin: root.plugin
                        info: root.info
                        visible: !!root.info.path
                        onChosen: entry => {
                            const action = root.info.actions.find(a => a.id === entry.action);
                            root.selectAction(action);
                            if (entry.target)
                                formats.currentValue = entry.target;
                            if (Logic.immediate(entry.action, entry.target) || entry.action === "metadata")
                                root.perform();
                        }
                        onCancelled: {
                            root.opened = false;
                            root.selected = ({});
                        }
                    }
                    PxText {
                        width: parent.width
                        wrapMode: Text.Wrap
                        visible: !!root.selected.id
                        text: (root.selected.available ? "" : "Install " + root.selected.tool + " to use this action. ") + (root.selected.hint || "")
                        color: root.selected.available ? Skin.textDim : Skin.warn
                    }
                    PxCombo {
                        id: formats
                        width: parent.width
                        visible: (root.selected.targets || []).length > 0
                        model: root.selected.targets || []
                        onActivated: value => currentValue = value
                    }
                    Row {
                        visible: root.selected.id === "resize"
                        spacing: Skin.spacing
                        PxText {
                            text: "Width (px)"
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        PxField {
                            id: widthField
                            text: "1920"
                        }
                    }
                    Row {
                        visible: root.selected.id === "trim"
                        spacing: Skin.spacing
                        PxText {
                            text: "Start (s)"
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        PxField {
                            id: startField
                            text: "0"
                            width: Skin.px(100)
                        }
                        PxText {
                            text: "Duration (s)"
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        PxField {
                            id: durationField
                            text: "10"
                            width: Skin.px(100)
                        }
                    }
                    Row {
                        width: parent.width
                        spacing: Skin.spacing
                        PxField {
                            id: destination
                            width: parent.width - folderButton.width - Skin.spacing
                            placeholder: "Output folder (empty = beside original)"
                        }
                        PxButton {
                            id: folderButton
                            text: "Folder..."
                            onClicked: folderPicker.open()
                        }
                    }
                    PxCheck {
                        visible: root.selected.id === "move"
                        text: "Move the original file to this folder"
                        checked: root.confirmMove
                        onToggled: checked => root.confirmMove = checked
                    }
                    Row {
                        spacing: Skin.spacing
                        PxButton {
                            text: root.busy ? "Working..." : "Run action"
                            accent: true
                            enabled: !root.busy && !!root.selected.id && !!root.selected.available && (root.selected.id !== "move" || root.confirmMove)
                            onClicked: root.perform()
                        }
                        PxButton {
                            text: "Show result"
                            visible: !!root.resultPath
                            onClicked: Quickshell.execDetached(["xdg-open", root.resultPath.substring(0, root.resultPath.lastIndexOf("/"))])
                        }
                    }
                    PxText {
                        width: parent.width
                        text: root.message
                        wrapMode: Text.WrapAnywhere
                        color: root.failed ? Skin.danger : Skin.textDim
                    }
                    PxText {
                        text: "LOCAL PROCESSING / NO SUBSCRIPTION / COPIES BY DEFAULT"
                        kind: "tiny"
                        color: Skin.textDim
                    }
                }
            }
        }
    }
    Process {
        id: clipboard
        command: ["wl-paste", "--type", "text/uri-list"]
        stdout: StdioCollector {
            onStreamFinished: {
                const urls = text.split(/\r?\n/).filter(x => x && !x.startsWith("#"));
                if (urls.length > 0)
                    root.inspect(JSON.stringify(urls));
                else {
                    root.failed = true;
                    root.message = "Copy files in your file manager first (Ctrl+C).";
                }
            }
        }
        onExited: code => {
            if (code !== 0) {
                root.failed = true;
                root.message = "Copy a file first. Paste requires wl-clipboard and a file manager that provides file URLs.";
            }
        }
    }
}
