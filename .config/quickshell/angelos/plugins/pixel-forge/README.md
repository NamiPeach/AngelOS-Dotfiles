# Pixel Forge

Pixel-style local file action wheel for AngelOS, with English labels and live theme colours.
Version 0.2.0. 12 Python tests, a real PDF-to-PNG conversion and empty-file copying passed on Windows; the actual Quickshell/Niri UI still needs a Linux smoke test.

## New interaction preview

The latest circular UI, outward submenu arcs, pink theme, multi-file simulation, and editable settings are in [docs/pixel-forge](../../../../../docs/pixel-forge/). They are a browser prototype and have not yet been ported to this native 0.2.0 plugin. See the demo README for remaining work.

## Drag wheel

Hold a local file in your file manager, press **Ctrl+Alt+F**, and move the pointer slightly. An overlay captures the first drag position and places a pixel wheel there, clamped inside the monitor. Hover **Convert >** (or Extract audio) for half a second to open its formats; drop onto a format to run. Hover the hub to return to actions; drop in the hub to cancel. Press Ctrl+Alt+F again to dismiss. No raw keyboard/device access or clipboard modification is used for this gesture.

Direct format conversions, square crop, compression, mute, ZIP and ZIP extraction run in the background and notify when finished. Trim, Resize, Copy and Move open their settings in the main window. Move still needs explicit confirmation. A failed job opens the window with its error. Only one local file is accepted; the drag is always acknowledged as Copy so the source does not delete it.

This is implemented using Quickshell's Wayland layer-shell and Qt drag-and-drop. The source application's drag behaviour and Niri shortcut delivery still require a live Linux smoke test. Positioning happens when the surface receives the first drag motion, not by reading a global cursor API. Invalid drops do nothing; dismissal cancels the drop, not a running conversion.

## Use

Enable **Pixel Forge** under Settings > Plugins. Click **Forge** on the bar or use the desktop menu.
Choose **Browse**, drop one local file into the drop target, or copy a file in your file manager with Ctrl+C and choose **Paste file**.
Choose a wheel action, adjust options, then press **Run action**. Output is saved beside the original unless you choose another existing folder.
Conversion never overwrites an existing file. Move is the only action that removes the original and requires its own confirmation.
Closing the window keeps the job running. Disabling the plugin or restarting the shell during a job is not supported.

## Formats and actions

| Input | Output / actions | Required tool |
|---|---|---|
| Images: PNG, JPEG, WebP, AVIF, BMP, TIFF, HEIC, GIF | PNG, JPG, WebP, AVIF, TIFF, BMP, PDF; resize, central square crop, JPEG compression | ImageMagick 7 (`magick`) |
| Video: MP4, MOV, MKV, WebM, AVI, M4V, MPEG | MP4, MOV, MKV, WebM, GIF; trim by start + duration, compress, resize, mute, extract audio | FFmpeg |
| Audio: MP3, WAV, FLAC, Ogg, Opus, M4A, AAC, AIFF | MP3, WAV, FLAC, Ogg, Opus, M4A; trim, compress | FFmpeg |
| Documents: DOC, DOCX, ODT, RTF, TXT, HTML | PDF, DOCX, ODT, RTF, TXT, HTML | LibreOffice |
| Tables: XLS, XLSX, ODS, CSV, TSV | PDF, XLSX, ODS, CSV | LibreOffice |
| Slides: PPT, PPTX, ODP | PDF, PPTX, ODP | LibreOffice |
| Ebooks/text: EPUB, Markdown, RST | EPUB, HTML, DOCX, ODT, TXT | Pandoc |
| PDF | Text, first page as PNG | Poppler |
| ZIP | Extract into a new folder | Python standard library |
| Any regular file, including other archives | Make ZIP, copy, move | Python standard library |

Output support depends on the installed tool's codecs, delegates and policies. An extension is not a guarantee a particular damaged or unusual file is readable. Missing tools and converter errors are shown in the window.
Images use their first frame; animated GIF conversion to images is not animation-preserving. Crop is currently a centre square, not an interactive crop editor. PDF-to-PNG exports page 1 only. PDF text extraction does not perform OCR. PDF-to-DOCX is not included. CSV stores one sheet and loses formatting. Office conversions may change layout/fonts. Compression is lossy and cannot guarantee a smaller result. ZIP extraction is limited to 10,000 entries / 2 GiB declared expanded size; other archive formats can be wrapped in ZIP but are not unpacked or transcoded.

## Install on CachyOS / Arch

From your modified AngelOS checkout, its normal installer copies the bundled plugin with the shell. To install only this plugin into an existing AngelOS installation:

```sh
mkdir -p ~/.config/angelos/plugins
cp -R .config/quickshell/angelos/plugins/pixel-forge ~/.config/angelos/plugins/
sudo pacman -S --needed python ffmpeg imagemagick libreoffice-fresh pandoc poppler wl-clipboard
```

Reload AngelOS, then enable Pixel Forge in Settings > Plugins. Python 3 is required even if using only copy/ZIP. Qt Quick Dialogs must be installed with your Quickshell Qt runtime.

## Keyboard access

Open an empty wheel:

```sh
qs -c angelos ipc call pixelForge show
```

Open a specific file (also suitable for a file-manager custom action that passes an argument):

```sh
qs -c angelos ipc call pixelForge openFile "/home/you/Downloads/example.mp4"
```

For a Niri shortcut, add this binding inside your existing `binds` block in your user configuration. Verify the combination is unused first:

```kdl
Mod+Shift+F { spawn "qs" "-c" "angelos" "ipc" "call" "pixelForge" "show"; }
```

To open with a copied file directly, bind this instead, adjusting the script path to the installed plugin:

```kdl
Mod+Shift+F { spawn "python3" "/home/YOUR_USER/.config/angelos/plugins/pixel-forge/forge.py" "clipboard"; }
```

The clipboard helper is an alternative to dragging. It requires Ctrl+C in a file manager that supplies `text/uri-list` and accepts exactly one file.

The modified fork already includes the Ctrl+Alt+F binding in `cfg/keybinds-common.kdl`. For a standalone plugin install, add the following to your own Niri configuration (check for an existing conflicting shortcut first):

```kdl
binds {
    CTRL+ALT+F repeat=false hotkey-overlay-title="Pixel Forge: file action wheel" {
        spawn "qs" "-c" "angelos" "ipc" "call" "pixelForge" "wheel";
    }
}
```

The normal `show` IPC still opens the settings window. The `wheel` IPC toggles the drag overlay. It does not take keyboard focus away from the drag source. Escape in the source normally cancels its drag; the toggle shortcut and hub are explicit cancellation routes.

## Verification

```sh
python3 test_forge.py
node test_wheel.cjs
```

On Linux, test opening/closing the window, a drag from your file manager, Copy/Paste, the IPC shortcut, long filenames, a missing converter, each media category, failed conversions and a confirmed move. Check the light/dark pixel themes, display scaling, small screens and the final output in its normal application. Jobs are one file at a time and have a one-hour timeout. No network service, API key or AI subscription is used by this plugin.

Drag-wheel regression checks: the real JS geometry/dispatch module passes 1,190 tile placement checks across seven monitor/scale combinations, plus hub cancellation, disabled-action rejection and local single-file URL checks. These do not replace native QML/runtime testing. In Linux specifically test Ctrl+Alt+F while holding a file, submenu dwell, source retention, dropping outside/on the hub, disabled tools, monitor crossing, and a busy converter.
