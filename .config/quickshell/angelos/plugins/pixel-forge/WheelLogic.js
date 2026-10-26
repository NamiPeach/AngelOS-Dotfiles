.pragma library

// Shared by the Wayland drop surface and deterministic geometry/dispatch tests.
function geometry(width, height, unit) {
    var fit = Math.min(1, width / (660 * unit), height / (560 * unit));
    var u = unit * fit;
    return {tileW: 128 * u, tileH: 46 * u, rx: 245 * u, ry: 194 * u,
            marginX: 317 * u, marginY: 248 * u, u: u};
}
function place(x, y, width, height, g) {
    return {x: Math.max(g.marginX, Math.min(width - g.marginX, x)),
            y: Math.max(g.marginY, Math.min(height - g.marginY, y))};
}
function tile(index, count, cx, cy, g) {
    var a = -Math.PI / 2 + index * 2 * Math.PI / Math.max(1, count);
    return {x: cx + Math.cos(a) * g.rx - g.tileW / 2,
            y: cy + Math.sin(a) * g.ry - g.tileH / 2};
}
function hit(x, y, count, cx, cy, g) {
    for (var i = 0; i < count; i++) {
        var p = tile(i, count, cx, cy, g);
        if (x >= p.x && x <= p.x + g.tileW && y >= p.y && y <= p.y + g.tileH) return i;
    }
    return -1;
}
function localUrl(urls) {
    if (!urls || urls.length !== 1) return "";
    var u = String(urls[0]);
    return /^file:\/\/(localhost)?\//.test(u) ? u : "";
}
function immediate(action, target) {
    if (action === "convert" || action === "audio") return !!target;
    return ["zip", "extract", "crop", "compress", "mute"].indexOf(action) !== -1;
}
function choice(slot) {
    if (!slot || !slot.available) return null;
    return {action: slot.action, target: slot.target || "", immediate: immediate(slot.action, slot.target)};
}
