# Roxy Cursor — personal import

This plugin contributes a Roxy Migurdia option to AngelOS Appearance. It contains no cursor artwork.
The original cursor pack is by EbiEbiBeam (version 1.0.0). Its author notes prohibit redistribution, so do not commit the ANI files or generated theme to a public repository.

Install Pillow (`sudo pacman -S --needed python-pillow`) and run the importer from your AngelOS checkout:

```sh
python3 .config/quickshell/angelos/scripts/import-roxy-cursors.py "/path/to/[Roxy Migurdia Cursor ver.1.0.0]" "$HOME/.local/share/icons/Roxy-Migurdia"
```

The destination must not exist. The importer preserves ANI sequence, timing, transparency and hotspots and creates 32/48/64 px Xcursor images with nearest-neighbour scaling. Pillow is needed only when importing, not to use the resulting theme.

Enable this plugin and select Roxy Migurdia in Appearance / Cursor settings. The theme is also discoverable as an installed custom cursor without this plugin. Existing macOS/hell cursor overrides may temporarily show another cursor; that is controlled by AngelOS's own cursor settings.

The conversion was checked structurally and against the source alpha channels. A real Niri/XWayland session is still needed to check display, scaling and animation.
