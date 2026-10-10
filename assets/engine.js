export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const presets = { stand: [12, 12], reach: [150, 150], wide: [90, 90], wave: [12, 158] };
export const defaults = () => ({ source: 'human', n: 16, x: .5, y: .52, left: 150, right: 150, angle: 0, display: 'shape', trail: false, brightness: .85, threshold: 35 });
const rad = d => d * Math.PI / 180;
export function moveSubject(state, x, y) {
  const human = state.source === 'human';
  state.x = clamp(x, human ? .34 : .2, human ? .66 : .8);
  state.y = clamp(y, human ? .39 : .2, human ? .64 : .8);
}
export function geometry(s) {
  const circle = (x,y,r) => ({ type:'circle', x,y,r });
  const line = (x1,y1,x2,y2,w) => ({ type:'line', x1,y1,x2,y2,w });
  const polygon = points => ({ type:'polygon', points });
  let shapes;
  if (s.source === 'car') {
    shapes = [polygon([[-.15,-.055],[-.1,-.09],[.07,-.09],[.15,-.05],[.16,.05],[.1,.09],[-.1,.09],[-.15,.055]])];
    for (const x of [-.085,.085]) for (const y of [-.09,.09]) shapes.push(line(x-.025,y,x+.025,y,.045));
  } else {
    shapes = [circle(0,-.235,.052), line(0,-.195,0,-.12,.045), polygon([[-.075,-.145],[.075,-.145],[.065,.075],[-.065,.075]]), line(-.035,.065,-.09,.29,.065), line(.035,.065,.09,.29,.065)];
    for (const [side,angle] of [[-1,s.left],[1,s.right]]) {
      const x=side*.068, y=-.125;
      shapes.push(line(x,y,x+side*.24*Math.sin(rad(angle)),y+.24*Math.cos(rad(angle)),.055));
    }
  }
  return { shapes, x:s.x, y:s.y, angle:s.source === 'car' ? rad(s.angle) : 0 };
}
function inPolygon(x,y,points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [a,b]=points[i], [c,d]=points[j];
    if((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) inside=!inside;
  }
  return inside;
}
export function contains(g,x,y) {
  const dx=x-g.x, dy=y-g.y, cos=Math.cos(g.angle), sin=Math.sin(g.angle);
  x=dx*cos+dy*sin; y=-dx*sin+dy*cos;
  return g.shapes.some(p => {
    if(p.type==='circle') return (x-p.x)**2+(y-p.y)**2<=p.r**2;
    if(p.type==='polygon') return inPolygon(x,y,p.points);
    const vx=p.x2-p.x1, vy=p.y2-p.y1;
    const t=clamp(((x-p.x1)*vx+(y-p.y1)*vy)/(vx*vx+vy*vy||1),0,1);
    return (x-p.x1-t*vx)**2+(y-p.y1-t*vy)**2<=(p.w/2)**2;
  });
}
export function sampleShape(state) {
  const g=geometry(state), n=state.n, pixels=new Uint8Array(n*n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    let hits=0;
    for(let sy=0;sy<4;sy++) for(let sx=0;sx<4;sx++) hits+=contains(g,(x+(sx+.5)/4)/n,(y+(sy+.5)/4)/n);
    pixels[y*n+x]=hits>=3 ? 1 : 0;
  }
  return state.display==='position' ? centrePixel(pixels,n) : pixels;
}
export function centrePixel(pixels,n) {
  let x=0,y=0,count=0;
  pixels.forEach((v,i)=>{if(v){x+=i%n;y+=Math.floor(i/n);count++;}});
  const out=new Uint8Array(n*n);
  if(count) out[Math.round(y/count)*n+Math.round(x/count)]=1;
  return out;
}
// A fixed background preserves a person who stands still. It is never updated here.
export function foreground(rgba,background,side,threshold) {
  if(rgba.length!==side*side*4 || background.length!==rgba.length) throw new Error('Frame dimensions differ');
  const raw=new Uint8Array(side*side), clean=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) {
    const o=i*4;
    raw[i]=(Math.abs(rgba[o]-background[o])+Math.abs(rgba[o+1]-background[o+1])+Math.abs(rgba[o+2]-background[o+2]))/3>=threshold ? 1:0;
  }
  for(let y=1;y<side-1;y++) for(let x=1;x<side-1;x++) {
    let count=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) count+=raw[(y+dy)*side+x+dx];
    clean[y*side+x]=count>=5 ? 1:0;
  }
  return clean;
}
export function downsample(mask,side,n) {
  const out=new Uint8Array(n*n);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    let hits=0,total=0;
    for(let sy=Math.floor(y*side/n);sy<Math.floor((y+1)*side/n);sy++)
      for(let sx=Math.floor(x*side/n);sx<Math.floor((x+1)*side/n);sx++){hits+=mask[sy*side+sx];total++;}
    out[y*n+x]=hits/total>=.18 ? 1:0;
  }
  return out;
}
export function updateLights(previous,active,dt,trail) {
  return Float32Array.from(active,(v,i)=>v ? 1 : trail ? Math.max(0,(previous[i]||0)-dt/700) : 0);
}
// Invalidating a pending request prevents a late camera permission grant from leaking a stream.
export class CameraSession {
  constructor(){this.stream=null;this.request=0;this.video=null;}
  async start(video,getMedia){
    this.stop(); const id=this.request;
    const stream=await getMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
    if(id!==this.request){stream.getTracks().forEach(t=>t.stop());return false;}
    this.stream=stream; this.video=video; video.srcObject=stream;
    try { await video.play(); } catch(error) { if(id===this.request)this.stop(); throw error; }
    return id===this.request;
  }
  stop(){this.request++;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.video)this.video.srcObject=null;this.video=null;}
}
