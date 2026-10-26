# Pixel Forge interaction demo

Open index.html in a browser from this checkout. This is an interactive prototype: all files and operations are simulated. No real files are converted, moved, shared, or sent. Settings persist in this browser's local storage when available. The font is referenced from the existing AngelOS Cozette asset.

Click a sample file, or drag one and tap Shift (Convert), Win/Meta (Tools), or Ctrl (Actions). Ctrl-click selects several files. Hover submenu entries to open outward arcs; click or drop in the centre to cancel. Scroll to change modes.

Settings adjusts wheel diameter, pixel size, arc gap in grid cells, pink theme colours, shortcuts, and submenu delay. Unsupported sample operations are hidden; simulated results appear beside the original with a Done notification.

## Native integration status

The native plugin is at [pixel-forge](../../.config/quickshell/angelos/plugins/pixel-forge/). It implements a smaller set of real local conversions and a Ctrl+Alt+F drag overlay. The current browser wheel geometry, outward Share submenus, multi-file selection, and editable appearance settings still need porting to QML. Share targets, OCR, and other demo-only operations are not implemented by the native backend. Native Quickshell/Niri behaviour needs testing on Linux.

## Optional personal cursor

Roxy artwork is not included because its author disallows redistribution. The repository contains a local ANI importer and theme metadata only. To use legally obtained frames privately in this demo, define window.PIXEL_FORGE_CURSOR_FRAMES as an array of {url,x,y,delay} objects in personal-cursor.js and load that script before demo.js. The file and private-assets directory are gitignored. Cursor settings are hidden when no frames are provided; the default is the system cursor.
