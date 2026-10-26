# Pixel Forge 0.3.0

Native local-file action wheel for AngelOS / Niri. The bundled plugin is enabled by default in the pixel theme. It uses the system palette, font and cursor.

## Use

Hold one or more local files in your file manager, press **Ctrl+Alt+F**, then move the pointer. Hover an action with a submenu to open an outward arc. Drop on an action to execute it; drop in the centre to cancel. The centre's three square dots switch **Actions / Tools / Convert** after a short hover. There is no bottom action bar.

**Ctrl+Alt+1 / 2 / 3** opens or switches directly to Actions / Tools / Convert. Niri owns these shortcuts; change them under Keyboard settings. Bare Shift / Win / Ctrl during an external drag are not implemented: Qt Quick DragEvent exposes MIME keys, not keyboard modifiers. The source keeps keyboard focus. Mode dots provide a drag-compatible alternative.

Click **Forge** on the bar to open the regular window, browse or paste files, choose parameters or a destination. The same radial component appears here; the mouse wheel cycles modes. Move requires confirmation. Running operations continue if the window is closed.

## Settings

Open Pixel Forge's **Settings** button or Settings → Plugins → Pixel Forge. Diameter, art-pixel size, outer arc gap and submenu delay persist in AngelOS's plugin data in ~/.config/angelos/settings.json. Pixel size follows system scaling. Colours follow the system by default; custom accent and background colours can be saved. The default arc gap is one grid pixel.

Roxy is a system cursor, so the wheel uses it automatically once imported and selected under Appearance. Artwork is not included in this public repository; see the [personal importer](../roxy-cursor/README.md).

## Real actions

- Convert images, video, audio, office documents, tables, slides, ebooks and PDFs using installed local tools.
- Resize images/video, central square image crop, compress media, trim video/audio, mute video and extract audio.
- Create ZIP, extract ZIP, copy/move files, copy paths, inspect basic metadata and open a terminal in the file's folder.
- Share opens an **email draft with attachments**, or copies file URLs to the clipboard. It never sends email automatically. Email needs a configured desktop mail client.
- A selection offers only common actions/formats. Each file gets its own output. Partial batch failures are reported; completed outputs are retained.

Missing tools are hidden. Outputs are saved beside the originals unless another folder is chosen, with a numbered suffix when needed. Existing files are never overwritten. Drops always acknowledge CopyAction so the file manager retains its source. Only an explicitly confirmed Move removes originals.

## Install

Use the [fork installation instructions](../../../../../docs/INSTALL-NAMI.md). The normal installer copies the plugin and Niri shortcuts and installs FFmpeg, ImageMagick, LibreOffice, pandoc-cli, Poppler and libnotify with the AngelOS package set.

For an existing AngelOS installation, copy this directory to ~/.config/angelos/plugins/pixel-forge, install the tools, reload the shell, and add the shortcuts from cfg/keybinds-common.kdl if needed.

## Limits

Regular local files only, up to 100 per selection; folders, URLs and symlinks are rejected. Formats depend on codecs/delegates and valid input. Images use their first frame. Image crop is a central square, not an interactive editor. PDF conversion supports text or page 1 as PNG; no PDF-to-DOCX, merge or OCR. Office layout may change; CSV retains one sheet. Compression is lossy and may not shrink a file. Extraction supports ZIP only, rejects unsafe paths and links, and limits entries to 10,000 / 2 GiB declared expanded size.

The [browser demo](../../../../../docs/pixel-forge/) contains additional simulated operations (Telegram, Notes, shelf, OCR, more crop presets and archive formats). These are not offered by the native plugin.

## Verification

Run python3 test_forge.py, node test_pixel.cjs and node test_wheel.cjs from this directory. Tests cover non-overwrite behaviour, move confirmation, unsafe archives, batch intersection and partial failures, Share argument handling, metadata, radial hit regions and exact pixel gaps.

All QML files parse with Qt's qmlformat. The actual RadialWheel.qml was instantiated and rendered with Qt Quick on Windows using small theme/widget stubs and the bundled Cozette font. This does not test Quickshell, Wayland or Niri. On Linux verify first drag position, monitor boundaries, multi-file drops, mode shortcuts, submenu dwell, hub cancellation, converter errors and the settings page before relying on it for important files.
