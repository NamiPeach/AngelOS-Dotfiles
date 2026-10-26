# Install NamiPeach's AngelOS fork

For CachyOS / Arch Linux with Niri. Run this after installing Linux, as your regular user. The installer asks for administrator access when installing packages.

~~~sh
git clone https://github.com/NamiPeach/AngelOS-Dotfiles.git
cd AngelOS-Dotfiles
ANGELOS_LANG=en ANGELOS_THEME=pixel DESKTOP_SHELL=angelos bash install.sh
~~~

If this checkout already exists, run git pull --ff-only inside it instead of cloning. Keep your preferred keyboard layouts when the installer asks. Log out and choose the Niri session after setup.

Pixel Forge is bundled and enabled by default in the pixel theme. Hold files, press Ctrl+Alt+F, move the pointer and drop onto an action. Ctrl+Alt+1 / 2 / 3 selects Actions / Tools / Convert. The centre cancels; its three dots select modes on hover.

Click Forge → Settings to edit the wheel. The pink pixel theme's own colours and scaling are used by default. Converter packages are part of the shell package manifest; if installation reports a missing package, resolve that before testing the corresponding format.

## Roxy cursor

Keep your original Roxy ANI pack or your private converted theme when moving from Windows. It is intentionally not on GitHub.

Import the original pack once (use its actual Linux location):

~~~sh
python3 .config/quickshell/angelos/scripts/import-roxy-cursors.py "/path/to/[Roxy Migurdia Cursor ver.1.0.0]" "$HOME/.local/share/icons/Roxy-Migurdia"
~~~

Then choose Roxy Migurdia and the desired size in Appearance → Cursor. If you transferred the already converted Roxy-Migurdia folder instead, place it in ~/.local/share/icons/ and select it there; no re-import is necessary. Do not overwrite an existing theme during import.

## First check

Try a disposable file first: copy, PNG conversion, opening Share, centre cancellation and changing settings. The converters and radial geometry have automated tests, and the QML wheel was rendered on Windows. A real Quickshell/Niri drag test is still required on your Linux installation.

See [native capabilities and limitations](../.config/quickshell/angelos/plugins/pixel-forge/README.md). The browser playground remains a simulation and includes extra actions that are not in the native plugin.
