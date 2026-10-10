const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../preview/toy-car-tracking.fragment.html'),'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
class Element {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.events={};
    this.isConnected=true;this.value='';this.checked=false;this.disabled=false;this.textContent='';this.width=350;
    const classes=new Set();
    this.classList={add:v=>classes.add(v),remove:v=>classes.delete(v),toggle:(v,on)=>on?classes.add(v):classes.delete(v)};
  }
  setAttribute(k,v){this.attrs[k]=v;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
  fire(k,e={}){for(const fn of this.events[k]||[])fn({target:this,preventDefault(){},...e});}
  click(){this.fire('click');}
  getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.width};}
  setPointerCapture(){}
}
const els=new Map();
for(const match of source.matchAll(/<([a-z]+)[^>]*\sid="([^"]+)"/g))els.set(match[2],new Element(match[1]));
const root=els.get('toy-car-tracking');root.querySelector=id=>els.get(id.slice(1));
let now=0,nextID=0,saved;
const frames=new Map(), globals={};
const ctx={
  document:{getElementById:id=>els.get(id),createElementNS:(_,tag)=>new Element(tag)},
  window:{openai:{widgetState:null,setWidgetState:s=>{saved=s;return Promise.resolve();}},addEventListener:(k,f)=>globals[k]=f},
  performance:{now:()=>now},ResizeObserver:class{observe(){}disconnect(){}},
  requestAnimationFrame:fn=>{frames.set(++nextID,fn);return nextID;},cancelAnimationFrame:id=>frames.delete(id)
};
vm.createContext(ctx);vm.runInContext(script,ctx);
function advance(ms=100){const end=now+ms;while(now<end){now=Math.min(end,now+16);const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}}
const control=(id,value)=>{els.get(id).value=String(value);els.get(id).fire('change');advance();};
const clickAt=(x,y)=>{els.get('tct-input').fire('pointerdown',{button:0,pointerId:1,clientX:350*x,clientY:350*y});els.get('tct-input').fire('pointerup');advance();};
const active=()=>Number(root.dataset.activeCount), lit=()=>Number(root.dataset.litCount);
const lights=()=>els.get('tct-output').children.filter(e=>e.attrs.class==='tct-dot-on');
const pattern=()=>lights().map(e=>Number(e.attrs.opacity)>.99?'1':'0').join('');
advance();
assert.equal(lights().length,64);assert.ok(active()>0);assert.equal(frames.size,0,'Idle animation stops');
const lowResCount=active();
control('tct-resolution',32);assert.equal(lights().length,1024);assert.ok(active()>lowResCount*5);
const beforeRotation=pattern();els.get('tct-angle').value='90';els.get('tct-angle').fire('input');advance();assert.notEqual(pattern(),beforeRotation);
control('tct-display','position');assert.equal(active(),1);
const beforeMove=pattern();els.get('tct-right').click();advance();assert.notEqual(pattern(),beforeMove);
const held=pattern();advance(10000);assert.equal(pattern(),held,'A still object remains displayed');
els.get('tct-trail').checked=true;els.get('tct-trail').fire('change');advance();advance(5000);
clickAt(.75,.75);assert.ok(lit()>1,'Trail persists when leaving a long-held pose');advance(800);assert.equal(lit(),1);assert.equal(frames.size,0);
els.get('tct-trail').checked=false;els.get('tct-trail').fire('change');advance();
control('tct-mode','checkpoints');assert.equal(lights().length,6);assert.equal(els.get('tct-resolution').disabled,true);
clickAt(.43,.5);assert.equal(active(),1);clickAt(.43,.25);assert.equal(active(),0);
assert.match(els.get('tct-detail').textContent,/no detection/);
control('tct-mode','camera');assert.equal(active(),1);assert.equal(els.get('tct-resolution').disabled,false);
clickAt(-1,2);assert.equal(root.dataset.carX,'0.180');assert.equal(root.dataset.carY,'0.820');
els.get('tct-play').click();advance(3000);assert.equal(els.get('tct-play').textContent,'Stop movement');advance(4500);
assert.equal(els.get('tct-play').textContent,'Play a movement');assert.equal(frames.size,0);
assert.equal(saved.modelContent.tracking,'camera');assert.equal(saved.modelContent.resolution,32);
globals['openai:set_globals']({detail:{globals:{widgetState:{modelContent:{tracking:'camera',resolution:8,display:'shape',trail:false},privateContent:{x:.43,y:.51,angle:0}}}}});advance();
assert.equal(lights().length,64);assert.ok(active()>0);assert.equal(root.dataset.carX,'0.430');
assert.ok(!source.includes('fetch('));
console.log('PASS: syntax, initial render, 8/32 resolution, rotation, position mode, arrow movement, stationary presence, delayed departure trail, checkpoint gaps, input bounds, finite demo, saved state and restored state.');
console.log('This harness validates JavaScript behavior; it is not a browser rendering or hardware test.');
