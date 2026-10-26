# Pixel Forge interaction demo

Open index.html in a browser from this checkout. This is an interactive prototype: all files and operations are simulated. No real files are converted, moved, shared, or sent. Settings persist in this browser's local storage when available. The font is referenced from the existing AngelOS Cozette asset.

Click a sample file, or drag one and tap Shift (Convert), Win/Meta (Tools), or Ctrl (Actions). Ctrl-click selects several files. Hover submenu entries to open outward arcs; click or drop in the centre to cancel. Scroll to change modes.

Settings adjusts wheel diameter, pixel size, arc gap in grid cells, pink theme colours, shortcuts, and submenu delay. Unsupported sample operations are hidden; simulated results appear beside the original with a Done notification.

## Native integration status

The native [Pixel Forge 0.3.0 plugin](../../.config/quickshell/angelos/plugins/pixel-forge/) now has a circular pixel wheel, outward submenus, persistent system settings and multiple-file operations. Its supported actions are real local operations; its README lists the exact capabilities. This playground still simulates extra features such as shelf, Telegram, OCR, merge and additional crop/archive formats. Native external-drag modes use centre dots or Ctrl+Alt+1/2/3; bare modifier switching remains demo-only. See [installation](../INSTALL-NAMI.md).

## Optional personal cursor

Roxy artwork is not included because its author disallows redistribution. The repository contains a local ANI importer and theme metadata only. To use legally obtained frames privately in this demo, define window.PIXEL_FORGE_CURSOR_FRAMES as an array of {url,x,y,delay} objects in personal-cursor.js and load that script before demo.js. The file and private-assets directory are gitignored. Cursor settings are hidden when no frames are provided; the default is the system cursor.
