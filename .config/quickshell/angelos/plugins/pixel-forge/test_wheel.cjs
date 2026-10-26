// Run with Node; the same functions are imported by DragWheel.qml.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, 'WheelLogic.js'), 'utf8').replace(/^\uFEFF/, '').replace(/^\.pragma library\s*/, '');
const logic = {};
vm.createContext(logic);
vm.runInContext(code, logic);
let checks = 0;
for (const [w,h,u] of [[1920,1080,1],[1366,768,1],[800,600,1],[640,480,1],[3840,2160,2],[1080,1920,1],[320,240,1]]) {
    const g = logic.geometry(w,h,u);
    for (const [x,y] of [[0,0],[w,h],[w,0],[0,h],[w/2,h/2]]) {
        const c = logic.place(x,y,w,h,g);
        for (const n of [3,5,7,9,10]) {
            const rectangles = [];
            for (let i=0;i<n;i++) {
                const p = logic.tile(i,n,c.x,c.y,g);
                assert.ok(p.x>=0 && p.y>=0 && p.x+g.tileW<=w && p.y+g.tileH<=h, 'tile stays on screen');
                assert.equal(logic.hit(p.x+g.tileW/2,p.y+g.tileH/2,n,c.x,c.y,g),i,'drop chooses displayed tile');
                for (const other of rectangles) {
                    const overlap = p.x < other.x+g.tileW && p.x+g.tileW > other.x && p.y < other.y+g.tileH && p.y+g.tileH > other.y;
                    assert.ok(!overlap,'tiles must not overlap');
                }
                rectangles.push(p); checks++;
            }
            assert.equal(logic.hit(c.x,c.y,n,c.x,c.y,g),-1,'hub never triggers conversion');
        }
    }
}
for (const action of ['trim','resize','copy','move']) assert.equal(logic.immediate(action,''),false);
for (const action of ['crop','mute','zip','compress','extract']) assert.equal(logic.immediate(action,''),true);
assert.equal(logic.immediate('convert',''),false);
assert.equal(logic.immediate('convert','pdf'),true);
assert.equal(logic.choice({available:false,action:'zip'}),null);
assert.equal(logic.localUrl(['https://example.com/file']), '');
assert.equal(logic.localUrl(['file://server/path']), '');
assert.equal(logic.localUrl(['file:///one','file:///two']), '');
assert.equal(logic.localUrl(['file:///home/a%20b.pdf']), 'file:///home/a%20b.pdf');
console.log(`PASS: ${checks} tile checks across 7 screen/scale combinations; cancel, dispatch and URL checks.`);
