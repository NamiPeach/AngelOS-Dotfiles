.pragma library
function clamp(v,lo,hi,fallback) {
    v=Number(v);return isFinite(v)?Math.max(lo,Math.min(hi,v)):fallback;
}
function settings(s) {
    s=s||{};
    return {diameter:clamp(s.diameter,240,400,304),pixel:clamp(s.pixel,4,12,8),
        gap:Math.round(clamp(s.gap,0,2,1)),delay:clamp(s.delay,150,1000,500),system:s.system!==false,
        accent:/^#[0-9a-f]{6}$/i.test(s.accent||'')?s.accent:'#ff2e7e',
        surface:/^#[0-9a-f]{6}$/i.test(s.surface||'')?s.surface:'#241432'};
}
function slot(a,target) {
    return {label:target?target.toUpperCase():a.label,action:a.id,target:target||'',available:true,children:[]};
}
function menu(info,mode) {
    var actions=(info.actions||[]).filter(a=>a.available);
    if(mode==='convert') {
        var conv=actions.find(a=>a.id==='convert');
        return conv?conv.targets.map(t=>slot(conv,t)):[];
    }
    var normal=['copy','move','copypath','metadata','terminal'];
    var share=actions.filter(a=>['email','copyfile'].indexOf(a.id)>=0);
    var result=actions.filter(a=>mode==='actions'?normal.indexOf(a.id)>=0:
        normal.concat(['convert','email','copyfile']).indexOf(a.id)<0)
        .map(a=>{var v=slot(a);v.children=(a.targets||[]).map(t=>slot(a,t));return v;});
    if(mode==='actions'&&share.length)
        result.unshift({label:'Share',action:'share',available:true,children:share.map(a=>slot(a))});
    return result;
}
function geometry(diameter,pixel,gap,width,height) {
    var fit=Math.min(1,(width-16)/(diameter+2*(gap+7)*pixel),(height-72)/(diameter+2*(gap+7)*pixel));
    var cell=Math.max(2,Math.floor(pixel*fit));
    var r=Math.max(4,Math.round(diameter*fit/(2*cell)));
    return {cell:cell,r:r,hub:Math.max(3,Math.round(r*.32)),gap:gap,band:6,extent:(r+gap+7)*cell};
}
function inside(x,y,r){return x*x+y*y<=r*r;}
function angle(x,y){return Math.atan2(y,x);}
function delta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function mainIndex(x,y,n){
    if(!n)return -1;
    var a=(angle(x,y)+Math.PI/2+Math.PI/n+Math.PI*4)%(Math.PI*2);
    return Math.floor(a/(Math.PI*2/n))%n;
}
// Dilation of the SAME pixel contour keeps the outer arc exactly parallel.
function region(x,y,g){
    if(inside(x,y,g.hub))return 0;
    if(inside(x,y,g.r))return 1;
    if(inside(Math.max(0,Math.abs(x)-g.gap),Math.max(0,Math.abs(y)-g.gap),g.r))return -1;
    if(inside(Math.max(0,Math.abs(x)-g.gap-g.band),Math.max(0,Math.abs(y)-g.gap-g.band),g.r))return 2;
    return -1;
}
function arc(parent,n,count){return {center:-Math.PI/2+parent*2*Math.PI/Math.max(1,n),span:Math.min(Math.PI*1.3,Math.max(.9,count*.42))};}
function hit(x,y,g,n,parent,count){
    var ix=Math.floor(x/g.cell+.5),iy=Math.floor(y/g.cell+.5),zone=region(ix,iy,g);
    if(zone===0)return {zone:'hub',index:-1};
    if(zone===1)return {zone:'main',index:mainIndex(ix,iy,n)};
    if(zone===2&&parent>=0&&count){
        var a=arc(parent,n,count),d=delta(angle(ix,iy),a.center);
        if(Math.abs(d)<a.span/2)return {zone:'outer',index:Math.min(count-1,Math.floor((d+a.span/2)/a.span*count))};
    }
    return {zone:'none',index:-1};
}
function position(index,count,g,outer,parent,n){
    var a=outer?arc(parent,n,count):null;
    var theta=outer?a.center-a.span/2+(index+.5)*a.span/count:-Math.PI/2+index*2*Math.PI/count;
    var r=outer?(g.r+g.gap+g.band*.65)*g.cell:g.r*g.cell*.68;
    return {x:Math.cos(theta)*r,y:Math.sin(theta)*r};
}
function paint(ctx,g,n,parent,count,hover,colors){
    var lim=g.r+g.gap+g.band+2;
    for(var y=-lim;y<=lim;y++)for(var x=-lim;x<=lim;x++){
        var h=hit(x*g.cell,y*g.cell,g,n,parent,count);
        if(h.zone==='none')continue;
        var selected=hover.zone===h.zone&&hover.index===h.index;
        var c=h.zone==='hub'?colors.hub:colors.face;
        if(h.zone==='main'&&h.index===parent)c=colors.selected;
        if(selected&&h.zone!=='hub')c=colors.selected;
        var next=hit((x+1)*g.cell,y*g.cell,g,n,parent,count),below=hit(x*g.cell,(y+1)*g.cell,g,n,parent,count);
        if(next.zone!==h.zone||below.zone!==h.zone||next.index!==h.index||below.index!==h.index)c=colors.edge;
        ctx.fillStyle=c;ctx.fillRect((x-.5)*g.cell,(y-.5)*g.cell,g.cell,g.cell);
    }
}
