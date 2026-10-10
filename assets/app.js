import {defaults,presets,moveSubject,geometry,sampleShape,foreground,downsample,centrePixel,updateLights,CameraSession} from './engine.js';
const $=id=>document.getElementById(id), all=s=>[...document.querySelectorAll(s)];
let state=defaults(), lights=new Float32Array(256), active=new Uint8Array(256);
const scene=$('scene'), led=$('leds'), ctx=scene.getContext('2d'), out=led.getContext('2d');
const video=$('video'), camera=new CameraSession(), sample=document.createElement('canvas');
sample.width=sample.height=128;
const sampleCtx=sample.getContext('2d',{willReadFrequently:true});
let background=null, captureAt=0, cameraBusy=false, cameraAttempt=0, playStart=null, frame=0, lastTime=0, dirty=true, dragging=false;
const status=text=>{$('status').textContent=text;};
function clearLights(){lights=new Float32Array(state.n**2);active=new Uint8Array(state.n**2);}
function requestDraw(){dirty=true;if(!frame){lastTime=performance.now();frame=requestAnimationFrame(tick);}}
function stopPlay(){playStart=null;$('play').textContent='Play movement';}
function stopCamera(message){
  cameraAttempt++;camera.stop();cameraBusy=false;captureAt=0;background=null;
  $('camera-toggle').textContent='Start camera';$('camera-toggle').disabled=false;$('capture').disabled=true;
  $('capture').textContent='Capture empty room · 3s';
  if(message)status(message);clearLights();requestDraw();
}
function syncControls(){
  all('[data-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.source===state.source)));
  all('[data-grid]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.grid)===state.n)));
  for(const source of ['human','car','camera'])$(source+'-controls').hidden=state.source!==source;
  $('left-arm').value=state.left;$('right-arm').value=state.right;$('rotation').value=state.angle;
  $('left-value').textContent=state.left+'°';$('right-value').textContent=state.right+'°';$('rotation-value').textContent=state.angle+'°';
  $('brightness').value=Math.round(state.brightness*100);$('brightness-value').textContent=Math.round(state.brightness*100)+'%';
  $('threshold').value=state.threshold;$('threshold-value').textContent=state.threshold;
  $('display-mode').value=state.display;$('trail').checked=state.trail;$('trail-legend').hidden=!state.trail;
  const webcam=state.source==='camera';$('movement').hidden=webcam;$('play').disabled=webcam;
  $('mode-label').textContent=webcam?'WEBCAM EXPERIMENT':state.source.toUpperCase()+' SIMULATION';
  $('input-name').textContent=webcam?'Your camera, mirrored':state.source==='car'?'A car on the stage':'Your virtual subject';
  $('stage-tag').textContent=webcam?'LOCAL CAMERA':'DRAG TO MOVE';
  $('stage-help').textContent=webcam?'Fit your body inside the square crop. Keep lighting and camera position steady.':'Drag or tap the stage. Arrow keys work when the stage is focused.';
  scene.setAttribute('aria-label',webcam?'Mirrored camera view':`Movable ${state.source} figure. Drag or use the arrow keys.`);
  $('grid-name').textContent=`${state.n} × ${state.n} light matrix`;
  $('resolution-note').textContent=state.n===8?'Coarse silhouette':state.n===16?'Recognisable poses':'Finer detail · virtual';
  $('model-note').textContent=webcam?'This compares your camera image with a saved empty background. It detects visible differences, including shadows; it does not understand or classify gestures.':'This is a simulated silhouette. A real build needs a camera and computer to measure the shape; the LEDs display it.';
  all('[data-pose]').forEach(b=>{const p=presets[b.dataset.pose];b.setAttribute('aria-pressed',String(p[0]===state.left&&p[1]===state.right));});
}
function drawGeometry(g){
  ctx.save();ctx.translate(g.x*640,g.y*640);ctx.rotate(g.angle);ctx.scale(640,640);ctx.fillStyle='#c8dcc0';ctx.strokeStyle='#c8dcc0';ctx.lineCap='round';ctx.lineJoin='round';
  for(const p of g.shapes){ctx.beginPath();if(p.type==='circle'){ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}else if(p.type==='line'){ctx.lineWidth=p.w;ctx.moveTo(p.x1,p.y1);ctx.lineTo(p.x2,p.y2);ctx.stroke();}else{p.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}}
  if(state.source==='car'){ctx.fillStyle='#40544a';ctx.fillRect(-.065,-.06,.095,.12);ctx.fillStyle='#ddebce';ctx.fillRect(.09,-.05,.025,.023);ctx.fillRect(.09,.027,.025,.023);}
  ctx.restore();
}
function drawInput(){
  ctx.fillStyle='#17221e';ctx.fillRect(0,0,640,640);
  if(state.source==='camera'&&camera.stream&&video.readyState>=2){ctx.drawImage(sample,0,0,640,640);return;}
  ctx.strokeStyle='#28382d';ctx.lineWidth=1;
  for(let i=1;i<16;i++){ctx.beginPath();ctx.moveTo(i*40,0);ctx.lineTo(i*40,640);ctx.moveTo(0,i*40);ctx.lineTo(640,i*40);ctx.stroke();}
  ctx.strokeStyle='#4b5c49';ctx.setLineDash([4,9]);ctx.strokeRect(26,26,588,588);ctx.setLineDash([]);
  if(state.source!=='camera')drawGeometry(geometry(state));
  else {ctx.textAlign='center';ctx.fillStyle='#b7c6b2';ctx.font='22px Arial';ctx.fillText('Your camera appears here',320,300);ctx.font='17px Arial';ctx.fillText('Select “Start camera” below',320,336);}
}
function drawOutput(){
  const n=state.n,margin=26,step=(640-2*margin)/n,r=step*.27;
  out.fillStyle='#080e0b';out.fillRect(0,0,640,640);
  lights.forEach((value,i)=>{
    const x=margin+(i%n+.5)*step,y=margin+(Math.floor(i/n)+.5)*step;
    out.shadowBlur=0;out.fillStyle='#20281d';out.beginPath();out.arc(x,y,r,0,Math.PI*2);out.fill();
    if(value>.01){out.globalAlpha=value*state.brightness;out.fillStyle='#ffd27d';out.shadowColor='#f2ad3d';out.shadowBlur=step*.65;out.beginPath();out.arc(x,y,r,0,Math.PI*2);out.fill();out.globalAlpha=1;}
  });
  out.shadowBlur=0;const count=active.reduce((a,b)=>a+b,0);
  $('lit-count').innerHTML=`${count} <small>/ ${n*n}</small>`;
  led.setAttribute('aria-label',`${n} by ${n} LED grid; ${count} pixels in the current silhouette.`);
}
function readCamera(now){
  if(!camera.stream||video.readyState<2)return new Uint8Array(state.n**2);
  const side=Math.min(video.videoWidth,video.videoHeight);
  sampleCtx.save();sampleCtx.translate(128,0);sampleCtx.scale(-1,1);
  sampleCtx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,128,128);sampleCtx.restore();
  const image=sampleCtx.getImageData(0,0,128,128).data;
  if(captureAt){
    if(now>=captureAt){background=new Uint8ClampedArray(image);captureAt=0;$('capture').disabled=false;$('capture').textContent='Recapture empty room · 3s';clearLights();status('Background captured. Step into the frame. Holding still keeps your silhouette visible.');}
    else {$('capture').textContent=`Step out · ${Math.ceil((captureAt-now)/1000)}s`;}
  }
  if(!background)return new Uint8Array(state.n**2);
  const pixels=downsample(foreground(image,background,128,state.threshold),128,state.n);
  return state.display==='position'?centrePixel(pixels,state.n):pixels;
}
function tick(now){
  frame=0;const dt=lastTime?Math.max(0,now-lastTime):0;lastTime=now;
  if(playStart!==null){
    const t=(now-playStart)/1000;
    if(t>=8){stopPlay();status('Movement complete. Try another pose, grid size, or move the subject yourself.');}
    else{moveSubject(state,.5+.18*Math.sin(t*.9),state.source==='human'?.52+.035*Math.sin(t*1.8):.5+.2*Math.cos(t*.9));if(state.source==='human'){state.left=Math.round(85+65*Math.sin(t*1.5));state.right=Math.round(85+65*Math.sin(t*1.5+.8));}else state.angle=Math.round(t*42)%360;syncControls();}
    dirty=true;
  }
  if(state.source==='camera')active=readCamera(now);else if(dirty)active=sampleShape(state);
  lights=updateLights(lights,active,dt,state.trail);
  drawInput();drawOutput();dirty=false;
  const fading=state.trail&&lights.some((v,i)=>v>.001&&!active[i]);
  if(playStart!==null||camera.stream||captureAt||fading)frame=requestAnimationFrame(tick);
}
all('[data-source]').forEach(b=>b.addEventListener('click',()=>{
  stopPlay();if(state.source==='camera')stopCamera();state.source=b.dataset.source;state.x=.5;state.y=state.source==='human'?.52:.5;clearLights();syncControls();
  status(state.source==='camera'?'Camera is off. Start it only when you are ready.':`Move your ${state.source==='car'?'car':'figure'} and watch the light image follow.`);requestDraw();
}));
all('[data-grid]').forEach(b=>b.addEventListener('click',()=>{state.n=Number(b.dataset.grid);clearLights();syncControls();requestDraw();status(`${state.n} × ${state.n}: ${state.n**2} display pixels. Tracking covers the whole visible stage.`);}));
all('[data-pose]').forEach(b=>b.addEventListener('click',()=>{stopPlay();[state.left,state.right]=presets[b.dataset.pose];syncControls();requestDraw();status(`Pose: ${b.textContent}. Try comparing 8 × 8 with 16 × 16.`);}));
for(const [id,key] of [['left-arm','left'],['right-arm','right'],['rotation','angle'],['threshold','threshold'],['brightness','brightness']])$(id).addEventListener('input',e=>{if(['left','right','angle'].includes(key))stopPlay();state[key]=Number(e.target.value)/(key==='brightness'?100:1);syncControls();requestDraw();});
$('display-mode').addEventListener('change',e=>{state.display=e.target.value;clearLights();requestDraw();});
$('trail').addEventListener('change',e=>{state.trail=e.target.checked;syncControls();requestDraw();});
function move(dx,dy){if(state.source==='camera')return;stopPlay();moveSubject(state,state.x+dx,state.y+dy);requestDraw();}
const directions={left:[-.035,0],right:[.035,0],up:[0,-.035],down:[0,.035]};
all('[data-move]').forEach(b=>b.addEventListener('click',()=>move(...directions[b.dataset.move])));
scene.addEventListener('keydown',e=>{const d=directions[e.key.replace('Arrow','').toLowerCase()];if(d&&state.source!=='camera'){e.preventDefault();move(...d);}});
function pointer(e){const box=scene.getBoundingClientRect();moveSubject(state,(e.clientX-box.left)/box.width,(e.clientY-box.top)/box.height);requestDraw();}
scene.addEventListener('pointerdown',e=>{if(state.source==='camera'||e.button!==0)return;stopPlay();dragging=true;scene.setPointerCapture(e.pointerId);scene.focus({preventScroll:true});pointer(e);});
scene.addEventListener('pointermove',e=>{if(dragging)pointer(e);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])scene.addEventListener(name,()=>{dragging=false;});
$('play').addEventListener('click',()=>{if(playStart!==null){stopPlay();status('Movement paused.');}else{playStart=performance.now();$('play').textContent='Pause movement';status('Playing an eight-second movement. You can pause or drag at any time.');requestDraw();}});
$('reset').addEventListener('click',()=>{stopPlay();stopCamera();state=defaults();clearLights();syncControls();status('Reset to a 16 × 16 human silhouette.');requestDraw();});
$('camera-toggle').addEventListener('click',async()=>{
  if(camera.stream||cameraBusy){stopCamera('Camera stopped.');return;}
  if(!navigator.mediaDevices?.getUserMedia){status('Camera access needs HTTPS or localhost and a browser with camera support. The simulated subjects still work.');return;}
  const attempt=++cameraAttempt;cameraBusy=true;$('camera-toggle').disabled=true;status('Waiting for camera permission…');
  try{
    const started=await camera.start(video,c=>navigator.mediaDevices.getUserMedia(c));
    if(!started||attempt!==cameraAttempt)return;
    $('camera-toggle').textContent='Stop camera';$('capture').disabled=false;
    const stream=camera.stream;stream.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(camera.stream===stream)stopCamera('Camera disconnected. Start it again to continue.');},{once:true}));
    status('Camera ready. Leave the frame, then capture an empty background.');requestDraw();
  }catch(error){if(attempt===cameraAttempt){stopCamera();status(error.name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser, or use Human / Toy car mode.':'Could not start the camera. Check that it is connected and not in use by another app.');}}
  finally{if(attempt===cameraAttempt){cameraBusy=false;$('camera-toggle').disabled=false;}}
});
$('capture').addEventListener('click',()=>{if(!camera.stream)return;captureAt=performance.now()+3000;$('capture').disabled=true;status('Step out of the frame. Capturing the empty room in three seconds…');requestDraw();});
$('save-image').addEventListener('click',()=>{led.toBlob(blob=>{if(!blob){status('Image export is unavailable in this browser.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`light-motion-${state.n}x${state.n}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Saved your LED image as a PNG.');});});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlay();if(camera.stream||cameraBusy)stopCamera('Camera stopped while the page was hidden. Start it again to continue.');}});
window.addEventListener('pagehide',()=>{cameraAttempt++;camera.stop();});
syncControls();requestDraw();
