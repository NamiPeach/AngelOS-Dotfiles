const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const W={};vm.createContext(W);vm.runInContext(fs.readFileSync(__dirname+'/PixelWheel.js','utf8').replace('.pragma library',''),W);
let checked=0;
for(const diameter of [240,304,400])for(const pixel of [4,8,12])for(const gap of [0,1,2])for(const [width,height] of [[360,640],[1920,1080],[1280,720]]) {
 const g=W.geometry(diameter,pixel,gap,width,height);
 assert.ok(g.extent*2<=width && g.extent*2<=height);
 for(let n=1;n<=7;n++)for(let i=0;i<n;i++){
   const p=W.position(i,n,g,false,0,0),h=W.hit(p.x,p.y,g,n,-1,0);
   assert.equal(h.zone,'main');assert.equal(h.index,i);checked++;
 }
 // Along the cardinal edge exactly gap cells are empty; the next is outer.
 for(let k=1;k<=gap;k++)assert.equal(W.region(g.r+k,0,g),-1);
 assert.equal(W.region(g.r+gap+1,0,g),2);
 assert.equal(W.hit(0,0,g,7,0,3).zone,'hub');
}
const info={actions:[{id:'convert',targets:['png','jpg'],available:true},
 {id:'email',label:'Email',targets:[],available:true},
 {id:'copyfile',label:'Copy file',targets:[],available:false},
 {id:'copy',label:'Copy',targets:[],available:true}]};
assert.equal(W.menu(info,'convert').length,2);
const actions=W.menu(info,'actions');
assert.equal(actions[0].label,'Share');assert.equal(actions[0].children.length,1);
assert.equal(W.menu(info,'tools').length,0);
assert.equal(W.settings({pixel:NaN,diameter:-5,gap:999,accent:'bad'}).pixel,8);
console.log('PASS: '+checked+' radial selection points, exact grid gaps, menu filtering, defaults');
