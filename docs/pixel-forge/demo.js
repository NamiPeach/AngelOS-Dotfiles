(function(){
const root=document.getElementById('pf-playground'),$=s=>root.querySelector(s);
const stage=$('.pf-stage'),grid=$('.pf-files'),wheel=$('.pf-wheel'),slotsEl=$('.pf-slots'),shade=$('.pf-shade'),ghost=$('.pf-ghost'),params=$('.pf-params'),status=$('.pf-status');
const initial=[['photo','Sunset.heic','image'],['photo2','Garden.png','image'],['clip','Clip.mov','video'],['pdf','Report.pdf','pdf'],['pdf2','Sketch.pdf','pdf'],['notes','Notes.docx','document'],['sheet','Budget.xlsx','sheet'],['voice','Voice.aiff','audio'],['zip','Archive.zip','archive'],['folder','Photos','folder']].map(([id,name,kind])=>({id,name,kind}));
const formats={image:['png','jpg','heic','avif','tiff','gif','pdf','webp','bmp','jp2','icns','ico','psd','tga'],video:['mp4','mov','m4v','gif','webm','mkv'],audio:['m4a','wav','aiff','flac','aac','caf','mp3','ogg','opus'],pdf:['txt','png','jpg','heic','tiff'],document:['pdf','docx','doc','odt','rtf','txt','html'],sheet:['pdf','xlsx','ods','csv'],slides:['pdf','pptx','odp'],archive:['zip','tar.gz','tar.xz','7z'],folder:[]};

const defaults={diameter:304,pixel:8,gap:1,delay:500,theme:'dark',accent:'#ff2e7e',surface:'#241432',cursor:'system',animation:true,cursorScale:1,convertKey:'Shift',toolsKey:'Meta',actionsKey:'Control'};
let settings={...defaults},settingsOpen=false;
function cleanSettings(s={}){const num=(k,min,max,fallback)=>Number.isFinite(Number(s[k]))?Math.max(min,Math.min(max,Math.round(Number(s[k])))):fallback;
const color=(v,fallback)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:fallback;
const out={diameter:num('diameter',240,400,304),pixel:[4,6,8,10,12].includes(Number(s.pixel))?Number(s.pixel):8,gap:num('gap',0,2,1),delay:num('delay',150,1000,500),theme:s.theme==='light'?'light':'dark',accent:color(s.accent,defaults.accent),surface:color(s.surface,defaults.surface),cursor:s.cursor==='roxy'&&roxyFrames.length?'roxy':'system',animation:s.animation!==false,cursorScale:Number(s.cursorScale)===2?2:1};
const keys=['Shift','Control','Meta','Alt'];for(const k of ['convertKey','toolsKey','actionsKey'])out[k]=keys.includes(s[k])?s[k]:defaults[k];
if(new Set([out.convertKey,out.toolsKey,out.actionsKey]).size!==3)Object.assign(out,{convertKey:defaults.convertKey,toolsKey:defaults.toolsKey,actionsKey:defaults.actionsKey});return out;}
const keyName=k=>({Shift:'Shift',Control:'Ctrl',Meta:'Win',Alt:'Alt'}[k]);
function controlsHint(){return keyName(settings.convertKey)+': Convert · '+keyName(settings.toolsKey)+': Tools · '+keyName(settings.actionsKey)+': Actions · Center: cancel';}
let files=initial.map(x=>({...x})),selected='photo',selection=new Set(['photo']),mode='convert',stack=[],activeSlots=[],outerSlots=[],drag=null,hoverTimer=null,hoverId='',wheelOpen=false,point={x:200,y:260},pending=null,lastAction=null,serial=1,toastTimer;
const item=(id,label,children)=>({id,label,children});
const leaves=(action,values)=>values.map(v=>({id:action,label:String(v),value:String(v)}));
function current(){return files.find(f=>f.id===selected);}
function batch(){return files.filter(f=>selection.has(f.id));}
function all(kind){return batch().length>0&&batch().every(f=>kind.includes(f.kind));}
function save(){window.openai?.setWidgetState?.({modelContent:{simulation:true,lastAction,settings},privateContent:{version:4,files:files.slice(-60),selected,selection:[...selection],theme:root.dataset.theme,settings}}).catch(()=>{});}
function restore(state){const s=state?.privateContent;settings=cleanSettings(s?.settings||{theme:s?.theme});if(s?.version!==4||!Array.isArray(s.files)||s.files.length>60)return;files=s.files.filter(f=>f&&typeof f.id==='string'&&typeof f.name==='string'&&f.kind in formats);if(!files.length)files=initial.map(f=>({...f}));selection=new Set((s.selection||[]).filter(id=>files.some(f=>f.id===id)));if(!selection.size)selection.add(files[0].id);selected=selection.has(s.selected)?s.selected:[...selection][0];root.dataset.theme=s.theme==='light'?'light':'dark';serial=1+Math.max(0,...files.map(f=>Number(f.id.replace('result-',''))||0));}
function kind(ext){for(const k of ['image','video','audio','sheet','slides','archive'])if(formats[k].includes(ext)&&ext!=='pdf')return k;return ext==='pdf'?'pdf':'document';}
function syncSelection(){grid.querySelectorAll('.pf-file').forEach(b=>{b.dataset.selected=String(selection.has(b.dataset.id));b.setAttribute('aria-pressed',b.dataset.selected);});$('.pf-path').textContent='~/Demo files/ · '+selection.size+' selected';}
function select(id,toggle=false){if(toggle){if(selection.has(id))selection.delete(id);else selection.add(id);selected=selection.has(id)?id:[...selection][0];}else {if(!selection.has(id))selection=new Set([id]);selected=id;}syncSelection();}
function renderFiles(newIds=[]){grid.replaceChildren();files.forEach(f=>{const b=document.createElement('button');b.type='button';b.className='pf-file';b.dataset.id=f.id;b.dataset.new=String(newIds.includes(f.id));b.setAttribute('aria-label',f.name);const icon=document.createElement('span');icon.className='pf-icon'+(f.kind==='folder'?' folder':'');icon.setAttribute('aria-hidden','true');const badge=document.createElement('b');badge.textContent=f.kind==='folder'?'':f.name.split('.').pop().toUpperCase();icon.append(badge);const label=document.createElement('span');label.className='pf-name';label.textContent=(f.inFolder?'Photos/':'')+f.name;b.append(icon,label);b.addEventListener('click',e=>{if(e.detail===0){select(f.id,e.ctrlKey||e.metaKey);if(!e.ctrlKey&&!e.metaKey)openWheel(stage.clientWidth/2,260);}});grid.append(b);});syncSelection();}
function archiveMenu(){return leaves('archive',['ZIP','TAR.GZ','TAR.XZ','7Z']);}
function conversionMenu(){const chosen=batch();if(!chosen.length)return[];let common=formats[chosen[0].kind].filter(t=>chosen.every(f=>formats[f.kind].includes(t)));let a=common.map(t=>({id:'convert',label:t.toUpperCase(),value:t}));if(all(['video']))a.push(item('audio','Extract audio ›',leaves('audio',['M4A','WAV','AIFF','FLAC','MP3'])),item('frame','Still frame'));return a;}
function actionMenu(){return [item('share','Share ›',[...leaves('share',['Telegram','Mail','Notes','Other app']),...(all(['image','video'])?leaves('share',['Photos']):[]),item('clipboard','Copy file')]),item('metadata','Metadata'),item('shelf','Float on shelf'),item('copy','Copy to…'),item('move','Move to…'),item('path','Copy path'),item('terminal','Open Terminal')];}
function toolsMenu(){let a=[];
if(all(['image']))a.push(item('resize','Resize ›',leaves('resize',['640','1280','1920','2560','Custom…'])),item('crop','Crop ›',leaves('crop',['Square','4:3','3:2','16:9','3:4','2:3','9:16','Custom…'])),item('rotate','Rotate / Flip ›',leaves('rotate',['90° right','90° left','180°','Flip horizontal','Flip vertical'])),item('fit','Fit to size ›',leaves('fit',['1 MB','5 MB','8 MB','25 MB'])),item('compress','Compress'),item('background','Remove background'),item('clean','Remove metadata'),item('ocr','Recognize text'),item('combine','Combine to PDF'));
if(all(['video']))a.push(item('trim','Trim'),item('resize','Resize ›',leaves('resize',['3840','1920','1280','960'])),item('compress','Compress'),item('mute','Remove audio'),item('clean','Remove metadata'));
if(all(['audio']))a.push(item('trim','Trim'),item('compress','Compress'));
if(all(['pdf'])){if(batch().length>1)a.push(item('merge','Merge PDFs'));a.push(item('split','Split PDF'),item('compress','Compress'),item('clean','Remove metadata'),item('ocr','Recognize text'));}
if(all(['archive']))a.push(item('extract','Extract'));
a.push(item('archive','Archive ›',archiveMenu()));return a;}
function rootMenu(){return mode==='actions'?actionMenu():mode==='tools'?toolsMenu():conversionMenu();}
function paged(items){return items.length>6?[...items.slice(0,5),item('more','More ›',items.slice(5))]:items;}
function stopHover(){clearTimeout(hoverTimer);hoverTimer=null;hoverId='';wheel.querySelectorAll('.is-hover').forEach(x=>x.classList.remove('is-hover'));}

function pixelContour(d,step){
 const cells=d/step,rows=[],out=[];
 for(let i=0;i<cells;i++){const e=Math.sqrt(cells*cells/4-(i+.5-cells/2)**2);rows.push([Math.round(cells/2-e),Math.round(cells/2+e)]);}
 for(let i=0;i<cells;i++)out.push([rows[i][1]*step,i*step],[rows[i][1]*step,(i+1)*step]);
 for(let i=cells-1;i>=0;i--)out.push([rows[i][0]*step,(i+1)*step],[rows[i][0]*step,i*step]);
 const unique=out.filter((p,i)=>i===0||p[0]!==out[i-1][0]||p[1]!==out[i-1][1]);
 if(unique[0][0]===unique.at(-1)[0]&&unique[0][1]===unique.at(-1)[1])unique.pop();
 return unique.filter((p,i)=>{const prev=unique[(i+unique.length-1)%unique.length],next=unique[(i+1)%unique.length];return (p[0]-prev[0])*(next[1]-p[1])!==(p[1]-prev[1])*(next[0]-p[0]);});
}
function pixelOutline(d,step){return 'polygon('+pixelContour(d,step).map(p=>p.map(v=>v/d*100+'%').join(' ')).join(',')+')';}
function offsetContour(points,gap){
 return points.map((p,i)=>{const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
 const n1=[Math.sign(p[1]-prev[1]),-Math.sign(p[0]-prev[0])],n2=[Math.sign(next[1]-p[1]),-Math.sign(next[0]-p[0])];
 return [p[0]+gap*(n1[0]+n2[0]),p[1]+gap*(n1[1]+n2[1])];});
}
function layoutWheel(x,y){
 const narrow=stage.clientWidth<480,step=settings.pixel,band=Math.round((narrow?56:88)/step)*step,total=Math.floor(Math.min(settings.diameter+2*band,stage.clientWidth-24,stage.clientHeight-56)/step)*step,outerR=total/2,r=outerR-band,d=r*2;
 wheel.style.width=d+'px';wheel.style.height=d+'px';wheel.style.setProperty('--pf-band',band+'px');wheel.classList.toggle('pf-small',narrow);
 const cx=Math.max(outerR+12,Math.min(stage.clientWidth-outerR-12,x)),cy=Math.max(outerR+12,Math.min(stage.clientHeight-outerR-44,y));
 wheel.style.left=(cx-r)+'px';wheel.style.top=(cy-r)+'px';
 wheel.style.setProperty('--pf-outline',pixelOutline(d,step));
 const hub=Math.round(Math.min(112,Math.max(72,d*.34))/step)*step;wheel.style.setProperty('--pf-hub-size',hub+'px');$('.pf-hub').style.setProperty('--pf-outline',pixelOutline(Math.round(hub/step)*step,step));
 slotsEl.querySelectorAll('.pf-divider').forEach(el=>el.remove());
 slotsEl.querySelectorAll('.pf-choice').forEach((el,i)=>{
 const n=activeSlots.length,mid=-Math.PI/2+i*2*Math.PI/n,half=Math.PI/n,pts=['50% 50%'];
 for(let j=0;j<=32;j++){const t=mid-half+2*half*j/32;pts.push((50+Math.cos(t)*74)+'% '+(50+Math.sin(t)*74)+'%');}
 el.style.clipPath='polygon('+pts.join(',')+')';el.dataset.angle=mid;
 el.firstChild.style.left=(50+Math.cos(mid)*36)+'%';el.firstChild.style.top=(50+Math.sin(mid)*36)+'%';
 const line=document.createElement('i');line.className='pf-divider';line.style.transform='rotate('+(mid+half)+'rad)';slotsEl.append(line);
 });
 const outer=$('.pf-outer');outer.style.width=total+'px';outer.style.height=total+'px';outer.style.left=-band+'px';outer.style.top=-band+'px';

 // One visible art-grid cell of clearance, offset from the exact main contour.
 const rim=pixelContour(total,step),hole=offsetContour(pixelContour(d,step),step*settings.gap).map(p=>[p[0]+band,p[1]+band]);
 const ring=[...rim,rim[0],...hole,hole[0],rim[0]];
 outer.style.clipPath='polygon(evenodd,'+ring.map(p=>p.map(v=>v+'px').join(' ')).join(',')+')';
 outer.dataset.gap=step*settings.gap;
 if(!stack.length)return;
 const direction=stack[0].angle,n=outerSlots.length,span=Math.min(Math.PI,n*Math.PI/5),start=direction-span/2;
 // The arc follows the selected slice, and stays on the same art-pixel grid.
 outer.querySelectorAll('.pf-choice').forEach((el,i)=>{
 const from=start+i*span/n+.006,to=start+(i+1)*span/n-.006,mid=(from+to)/2;

 const pts=[[outerR,outerR]];
 for(let j=0;j<=32;j++){const t=from+(to-from)*j/32;pts.push([outerR+Math.cos(t)*total,outerR+Math.sin(t)*total]);}
 el.style.clipPath='polygon('+pts.map(p=>p.map(v=>v+'px').join(' ')).join(',')+')';
 const labelR=r+band*.55;el.firstChild.style.left=(outerR+Math.cos(mid)*labelR)+'px';el.firstChild.style.top=(outerR+Math.sin(mid)*labelR)+'px';el.dataset.angle=mid;
 });
}
function slotFor(button){return (button.dataset.tier==='outer'?outerSlots:activeSlots)[Number(button.dataset.index)];}
function enterSub(s,button){if(button?.dataset.tier==='outer')stack.push({...s,angle:Number(button.dataset.angle)});else stack=[{...s,angle:Number(button?.dataset.angle??-Math.PI/2)}];paintWheel();}
function paintWheel(){stopHover();activeSlots=paged(rootMenu());slotsEl.replaceChildren();
const hub=$('.pf-hub');hub.replaceChildren();const m=document.createElement('small');m.textContent=keyName(settings[mode+'Key'])+' '+mode.toUpperCase();const name=document.createElement('strong');name.textContent=stack.length?stack[stack.length-1].label.replace(' ›',''):(batch().length===1?current().name:batch().length+' files');name.dataset.tooltip=batch().map(f=>f.name).join(', ');const hint=document.createElement('small');hint.textContent=activeSlots.length?'Cancel':'No actions';hub.append(m,name,hint);hub.setAttribute('aria-label','Cancel');
$('.pf-ring-dots').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ring===mode)));
activeSlots.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.className='pf-choice cursor-interaction';b.dataset.index=i;b.dataset.tier='main';b.classList.toggle('is-parent',stack.length>0&&stack[0].id===s.id);b.setAttribute('aria-label',s.label.replace(' ›',''));const label=document.createElement('span');label.textContent=s.label;b.append(label);b.addEventListener('click',()=>choose(s,b));b.addEventListener('pointerenter',()=>hover(b));b.addEventListener('pointerleave',()=>{if(!drag)stopHover();});slotsEl.append(b);});

const outer=$('.pf-outer');outer.replaceChildren();outer.hidden=!stack.length;outerSlots=[];
if(stack.length){const items=stack[stack.length-1].children,limit=stage.clientWidth<480?4:6;
outerSlots=items.length>limit?[...items.slice(0,limit-1),item('more','More ›',items.slice(limit-1))]:items;
outerSlots.forEach((s,i)=>{const el=document.createElement('button');el.type='button';el.className='pf-choice pf-outer-choice cursor-interaction';el.dataset.index=i;el.dataset.tier='outer';el.setAttribute('aria-label',s.label.replace(' ›',''));const label=document.createElement('span');label.textContent=s.label;el.append(label);el.addEventListener('click',()=>choose(s,el));el.addEventListener('pointerenter',()=>hover(el));el.addEventListener('pointerleave',()=>{if(!drag)stopHover();});outer.append(el);});}
$('.pf-back').hidden=true;layoutWheel(point.x,point.y);}
function openWheel(x,y){if(settingsOpen)closeSettings();if(!selection.size){status.textContent='Select a file first.';return;}point={x,y};stack=[];wheelOpen=true;params.hidden=true;wheel.hidden=false;shade.hidden=false;paintWheel();if(!drag)$('.pf-hub').focus({preventScroll:true});status.textContent=controlsHint();}
function switchMode(next){mode=next;stack=[];if(wheelOpen)paintWheel();else openWheel(drag?.last.x??stage.clientWidth/2,drag?.last.y??260);}
function closeWheel(){stopHover();wheelOpen=false;wheel.hidden=true;stack=[];shade.hidden=params.hidden;}
function cancel(){closeWheel();params.hidden=true;shade.hidden=true;ghost.hidden=true;if(drag&&stage.hasPointerCapture(drag.pointer))stage.releasePointerCapture(drag.pointer);drag=null;status.textContent='Cancelled';}
function hover(b){const idx=b.dataset.tier+':'+b.dataset.index,s=slotFor(b);if(!s||hoverId===idx)return;stopHover();hoverId=idx;b.classList.add('is-hover');if(s.children&&!(b.dataset.tier==='main'&&stack[0]?.id===s.id))hoverTimer=setTimeout(()=>enterSub(s,b),settings.delay);}
function choose(s,button){if(!s)return;if(s.children){enterSub(s,button);return;}if(['trim','copy','move','split'].includes(s.id)||s.value==='Custom…'){showParams(s);return;}if(s.id==='metadata'){showMetadata();return;}run(s);}
function done(s,results){lastAction={action:s.id,target:s.value||'',parameters:s.parameters||{},files:batch().map(f=>f.name),results};closeWheel();params.hidden=true;shade.hidden=true;const toast=$('.pf-toast');toast.textContent='Done';toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2200);status.textContent='Demo only · no real files changed or sent';save();}
function output(name,kind,inFolder=false){const base=name;let n=2;while(files.some(f=>f.name===name&&!!f.inFolder===inFolder)){const dot=base.lastIndexOf('.');name=dot>0?base.slice(0,dot)+' '+n+++base.slice(dot):base+' '+n++;}const f={id:'result-'+serial++,name,kind,inFolder};files.push(f);return f;}
function stem(f){return f.kind==='folder'?f.name:f.name.replace(/\.[^.]+$/,'');}
function run(s,values={}){s={...s,parameters:values};const chosen=batch(),created=[],results=[];if(!chosen.length)return;
if(['share','clipboard','path','terminal'].includes(s.id)){done(s,[s.id==='share'?'Preview: '+s.value:'Preview: '+s.label]);return;}
if(s.id==='shelf'){chosen.forEach(f=>f.onShelf=true);renderShelf();done(s,chosen.map(f=>f.name));return;}
if(['archive','combine','merge'].includes(s.id)){const ext=s.id==='archive'?s.value.toLowerCase():'pdf',name=(chosen.length>1?'Selection':stem(chosen[0]))+(s.id==='archive'?'':' (combined)')+'.'+ext;created.push(output(name,s.id==='archive'?'archive':'pdf'));}
else for(const f of chosen){
if(s.id==='move'){f.inFolder=true;results.push('Photos/'+f.name);continue;}
if(s.id==='copy'){created.push(output(f.name,f.kind,true));continue;}
if(s.id==='extract'){created.push(output(stem(f)+' (extracted)','folder'));continue;}
if(s.id==='split'){for(let p=1;p<=2;p++)created.push(output(stem(f)+' (page '+p+').pdf','pdf'));continue;}
let ext=f.name.split('.').pop().toLowerCase(),suffix='';
if(s.id==='convert'||s.id==='audio')ext=s.value.toLowerCase();else if(['ocr'].includes(s.id))ext='txt';else if(['frame','background'].includes(s.id))ext='png';
if(s.id!=='convert')suffix=' ('+(s.value&&s.id==='crop'?s.value.replace(':','x'):s.id)+')';
created.push(output(stem(f)+suffix+'.'+ext,kind(ext)));
}
results.push(...created.map(f=>f.name));renderFiles(created.map(f=>f.id));done(s,results);}
function renderShelf(){const shelf=$('.pf-shelf');shelf.replaceChildren();const entries=files.filter(f=>f.onShelf);shelf.hidden=!entries.length;if(!entries.length)return;const title=document.createElement('span');title.textContent='Shelf';shelf.append(title);entries.forEach(f=>{const b=document.createElement('button');b.type='button';b.className='pf-btn';b.textContent=f.name;b.addEventListener('click',()=>{selection=new Set([f.id]);selected=f.id;syncSelection();openWheel(stage.clientWidth/2,260);});shelf.append(b);});}
function showMetadata(){closeWheel();params.hidden=false;shade.hidden=false;pending=null;params.querySelector('h3').textContent='Metadata · demo';$('.pf-fields').replaceChildren();batch().forEach(f=>{const p=document.createElement('p');p.textContent=f.name+' · '+f.kind+' · simulated file';$('.pf-fields').append(p);});$('.pf-apply').hidden=true;params.querySelector('[data-cmd=cancel]').textContent='Close';}
function showParams(s){closeWheel();pending=s;params.hidden=false;shade.hidden=false;$('.pf-apply').hidden=false;params.querySelector('[data-cmd=cancel]').textContent='Cancel';params.querySelector('h3').textContent=s.label.replace('…','');const fields=$('.pf-fields');fields.replaceChildren();
function input(label,name,value,type='number'){const l=document.createElement('label'),i=document.createElement('input');l.textContent=label;i.name=name;i.type=type;i.value=value;i.required=true;if(type==='number'){i.min=name==='start'?'0':'1';i.max='864000';}l.append(i);fields.append(l);}
if(s.id==='trim'){input('Start (seconds)','start',0);input('Duration (seconds)','duration',10);}
if(s.id==='resize')input('Maximum width (px)','width',1920);
if(s.id==='crop'){input('Width (px)','width',800);input('Height (px)','height',800);}
if(s.id==='split'){const p=document.createElement('p');p.textContent='Preview: split the sample into 2 pages.';fields.append(p);}
if(['copy','move'].includes(s.id)){const p=document.createElement('p');p.textContent='Destination: Photos';fields.append(p);}
if(s.id==='move'){const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.required=true;c.name='confirm';l.append(c,document.createTextNode(' Move selected demo files'));fields.append(l);}params.querySelector('input')?.focus();}
function local(e){const r=stage.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
stage.addEventListener('pointerdown',e=>{const b=e.target.closest('.pf-file');if(!b||wheelOpen||!params.hidden||e.button!==0)return;if(e.ctrlKey||e.metaKey){select(b.dataset.id,true);save();return;}select(b.dataset.id);const p=local(e);drag={pointer:e.pointerId,start:p,last:p,moved:false};stage.setPointerCapture(e.pointerId);});
stage.addEventListener('pointermove',e=>{if(!drag)return;const p=local(e);drag.last=p;if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>5)drag.moved=true;if(!drag.moved)return;e.preventDefault();ghost.hidden=false;ghost.textContent=batch().length>1?batch().length+' files':current().name;ghost.style.left=Math.max(0,Math.min(stage.clientWidth-175,p.x+13))+'px';ghost.style.top=Math.max(0,Math.min(stage.clientHeight-34,p.y+16))+'px';if(wheelOpen){const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.pf-choice');if(hit&&root.contains(hit))hover(hit);else stopHover();}});
stage.addEventListener('pointerup',e=>{if(!drag)return;const state=drag;drag=null;ghost.hidden=true;if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);if(!state.moved){openWheel(state.last.x,state.last.y);return;}if(wheelOpen){const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.pf-choice');if(hit&&root.contains(hit))choose(slotFor(hit),hit);else cancel();}else status.textContent='Drag, then tap Shift / Win / Ctrl';});
stage.addEventListener('pointercancel',cancel);
root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(settingsOpen)closeSettings();else cancel();return;}if(settingsOpen||e.target.matches('input,select'))return;if(e.key==='Backspace'&&wheelOpen&&stack.length){e.preventDefault();stack.pop();paintWheel();return;}const next={[settings.convertKey]:'convert',[settings.toolsKey]:'tools',[settings.actionsKey]:'actions'}[e.key];if(next&&(drag?.moved||wheelOpen)){e.preventDefault();if(!e.repeat)switchMode(next);}});
$('.pf-hub').addEventListener('click',cancel);shade.addEventListener('click',cancel);
$('.pf-back').addEventListener('click',()=>{stack.pop();paintWheel();});
root.querySelectorAll('[data-ring]').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.ring)));
let lastScroll=0;wheel.addEventListener('wheel',e=>{e.preventDefault();if(Date.now()-lastScroll<220)return;lastScroll=Date.now();const modes=['actions','tools','convert'];switchMode(modes[(modes.indexOf(mode)+(e.deltaY<0?1:2))%3]);},{passive:false});
function apply(){if(pending&&params.reportValidity())run(pending,Object.fromEntries(new FormData(params)));}
$('.pf-apply').addEventListener('click',apply);params.addEventListener('submit',e=>e.preventDefault());params.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}});
root.addEventListener('click',e=>{const cmd=e.target.closest('[data-cmd]')?.dataset.cmd;if(cmd==='wheel'){if(settingsOpen)closeSettings();openWheel(stage.clientWidth/2,260);}if(cmd==='theme'){if(settingsOpen)return;settings.theme=settings.theme==='dark'?'light':'dark';settings.surface=settings.theme==='dark'?'#241432':'#fff0f6';applySettings();save();}if(cmd==='cancel')cancel();if(cmd==='reset'){cancel();files=initial.map(x=>({...x}));selection=new Set(['photo']);selected='photo';serial=1;lastAction=null;renderFiles();renderShelf();status.textContent='Demo only · no real files changed or sent';save();}});
stage.addEventListener('dragover',e=>e.preventDefault());stage.addEventListener('drop',e=>{e.preventDefault();status.textContent='Use sample files · real files are not read';});
new ResizeObserver(()=>{if(wheelOpen)layoutWheel(point.x,point.y);}).observe(stage);


 // Optional personal cursor frames; artwork is not distributed with this demo.
 const roxyFrames=Array.isArray(window.PIXEL_FORGE_CURSOR_FRAMES)?window.PIXEL_FORGE_CURSOR_FRAMES:[];
 const roxyMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let roxyIndex=0,roxyTimer=null;
 // Decode each frame in advance; a native cursor never leaves an image on the page.
 roxyFrames.forEach(f=>{const image=new Image();image.src=f.url;});

 const roxyLarge=new Map();
 const roxyImages=roxyFrames.map(f=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,64,64);roxyLarge.set(f.url,canvas.toDataURL('image/png'));if(settings.cursorScale===2)roxyPaint();};image.src=f.url;return image;});
 function roxyPaint(){root.classList.toggle('pf-custom-cursor',settings.cursor==='roxy'&&roxyFrames.length>0);if(settings.cursor!=='roxy'||!roxyFrames.length){root.style.removeProperty('--pf-roxy-cursor');return;}const f=roxyFrames[roxyIndex],scale=settings.cursorScale,url=scale===2?(roxyLarge.get(f.url)||f.url):f.url;root.style.setProperty('--pf-roxy-cursor','url("'+url+'") '+f.x*scale+' '+f.y*scale+', auto');}
 function roxyStop(){clearTimeout(roxyTimer);roxyTimer=null;}
 function roxyTick(){roxyTimer=null;if(document.hidden||roxyMotion.matches||!settings.animation||settings.cursor!=='roxy')return;roxyIndex=(roxyIndex+1)%roxyFrames.length;roxyPaint();roxyTimer=setTimeout(roxyTick,roxyFrames[roxyIndex].delay);}
 function roxyStart(){if(roxyFrames.length&&roxyTimer===null&&!roxyMotion.matches&&!document.hidden&&settings.animation&&settings.cursor==='roxy')roxyTimer=setTimeout(roxyTick,roxyFrames[roxyIndex].delay);}
 function roxyReset(){roxyStop();roxyIndex=0;roxyPaint();roxyStart();}
 root.addEventListener('pointerenter',roxyStart);root.addEventListener('pointermove',roxyStart);
 root.addEventListener('pointerleave',roxyStop);window.addEventListener('blur',roxyStop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)roxyStop();else roxyStart();});
 roxyMotion.addEventListener('change',roxyReset);roxyReset();

const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.className='pf-btn';settingsButton.textContent='Settings';settingsButton.dataset.cmd='settings';$('.pf-toolbar').append(settingsButton);
const settingsPanel=document.createElement('section');settingsPanel.className='pf-settings';settingsPanel.hidden=true;settingsPanel.setAttribute('aria-label','Pixel Forge settings');stage.before(settingsPanel);
const settingsTitle=document.createElement('h2');settingsTitle.textContent='Settings';settingsPanel.append(settingsTitle);
const settingsForm=document.createElement('form');settingsForm.className='pf-settings-form';settingsPanel.append(settingsForm);
const settingsGrid=document.createElement('div');settingsGrid.className='pf-settings-grid';settingsForm.append(settingsGrid);
const settingInputs={};
function settingGroup(title){const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;group.append(legend);settingsGrid.append(group);return group;}
function addSetting(group,key,label,type,choices){const l=document.createElement('label');l.className='pf-setting';const caption=document.createElement('span');caption.textContent=label;const control=document.createElement(type==='select'?'select':'input');control.name=key;if(type!=='select')control.type=type;if(choices&&type==='select')choices.forEach(([value,name])=>{const option=document.createElement('option');option.value=value;option.textContent=name;control.append(option);});if(type==='range'){[control.min,control.max,control.step]=choices;const output=document.createElement('output');output.textContent=settings[key];caption.append(' ',output);control.addEventListener('input',()=>output.textContent=control.value);control._output=output;}settingInputs[key]=control;l.append(caption,control);group.append(l);}
const appearance=settingGroup('Appearance');
addSetting(appearance,'diameter','Wheel diameter (px)','range',[240,400,8]);
addSetting(appearance,'pixel','Pixel grid (px)','select',[[4,'4'],[6,'6'],[8,'8 — current'],[10,'10'],[12,'12']]);
addSetting(appearance,'gap','Arc gap (grid pixels)','range',[0,2,1]);
addSetting(appearance,'theme','Theme','select',[['dark','Pink · dark'],['light','Pink · light']]);
addSetting(appearance,'accent','Accent','color');addSetting(appearance,'surface','Wheel background','color');
const controls=settingGroup('Controls');
const keyOptions=[['Shift','Shift'],['Control','Ctrl'],['Meta','Win'],['Alt','Alt']];
addSetting(controls,'convertKey','Convert key','select',keyOptions);addSetting(controls,'toolsKey','Tools key','select',keyOptions);addSetting(controls,'actionsKey','Actions key','select',keyOptions);
addSetting(controls,'delay','Submenu delay (ms)','range',[150,1000,50]);
const cursorGroup=settingGroup('Cursor');cursorGroup.hidden=!roxyFrames.length;
addSetting(cursorGroup,'cursor','Cursor','select',[['roxy','Roxy Migurdia'],['system','System']]);
addSetting(cursorGroup,'cursorScale','Roxy size','select',[[1,'32 px'],[2,'64 px']]);addSetting(cursorGroup,'animation','Animate Roxy','checkbox');
const prefsError=document.createElement('p');prefsError.className='pf-settings-error';prefsError.setAttribute('role','alert');prefsError.hidden=true;settingsForm.append(prefsError);
const settingsActions=document.createElement('div');settingsActions.className='pf-settings-actions';settingsForm.append(settingsActions);
function settingsAction(label,handler,primary=false){const b=document.createElement('button');b.type='button';b.className='pf-btn'+(primary?' primary':'');b.textContent=label;b.addEventListener('click',handler);settingsActions.append(b);}
function fillSettings(values){for(const [key,input]of Object.entries(settingInputs)){if(input.type==='checkbox')input.checked=values[key];else input.value=values[key];if(input._output)input._output.textContent=input.value;}prefsError.hidden=true;}
function closeSettings(){settingsPanel.hidden=true;stage.hidden=false;settingsOpen=false;settingsButton.setAttribute('aria-expanded','false');$('[data-cmd=theme]').disabled=false;settingsButton.focus({preventScroll:true});}
function openSettings(){cancel();fillSettings(settings);settingsPanel.hidden=false;stage.hidden=true;settingsOpen=true;settingsButton.setAttribute('aria-expanded','true');$('[data-cmd=theme]').disabled=true;settingInputs.diameter.focus({preventScroll:true});}
function colorText(hex){const rgb=hex.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const lum=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];return lum>.179?'#1a0d24':'#fff0f6';}
function applySettings(){stage.style.minHeight=Math.max(540,settings.diameter+232)+'px';root.dataset.theme=settings.theme;root.style.setProperty('--pf-pink',settings.accent);root.style.setProperty('--pf-blue',settings.accent);root.style.setProperty('--pf-pink-ink',colorText(settings.accent));root.style.setProperty('--pf-wheel-fill',settings.surface);root.style.setProperty('--pf-wheel-text',colorText(settings.surface));root.style.setProperty('--pf-center',settings.surface);root.style.setProperty('--pf-face-arc',settings.surface);$('.pf-tip').textContent='CTRL + CLICK: SELECT MANY · DRAG + '+[settings.convertKey,settings.toolsKey,settings.actionsKey].map(keyName).join(' / ');roxyReset();if(wheelOpen)paintWheel();}
function saveSettings(){const draft={};for(const [key,input]of Object.entries(settingInputs))draft[key]=input.type==='checkbox'?input.checked:input.value;if(new Set([draft.convertKey,draft.toolsKey,draft.actionsKey]).size!==3){prefsError.textContent='Choose a different key for each mode.';prefsError.hidden=false;return;}settings=cleanSettings(draft);applySettings();save();closeSettings();openWheel(stage.clientWidth/2,260);}
settingsButton.addEventListener('click',()=>settingsOpen?closeSettings():openSettings());
settingInputs.theme.addEventListener('change',()=>{settingInputs.surface.value=settingInputs.theme.value==='light'?'#fff0f6':'#241432';});
settingsAction('Save & try',saveSettings,true);settingsAction('Cancel',closeSettings);settingsAction('Reset defaults',()=>fillSettings(defaults));
settingsForm.addEventListener('submit',e=>{e.preventDefault();saveSettings();});

restore(window.openai?.widgetState);applySettings();renderFiles();renderShelf();
window.addEventListener('openai:set_globals',e=>{if(e.detail?.globals?.widgetState){cancel();restore(e.detail.globals.widgetState);applySettings();if(settingsOpen)fillSettings(settings);renderFiles();renderShelf();}});
})();
