import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,presets,sampleShape,moveSubject,foreground,downsample,centrePixel,updateLights,CameraSession} from '../assets/engine.js';
const count=a=>a.reduce((x,y)=>x+y,0);
test('Each human pose remains visible at all three resolutions, with distinct patterns',()=>{
  for(const n of [8,16,32]){
    const patterns=new Set();
    for(const [left,right] of Object.values(presets)){
      const pixels=sampleShape({...defaults(),n,left,right});
      assert.equal(pixels.length,n*n);assert.ok(count(pixels)>0&&count(pixels)<n*n/2);patterns.add(pixels.join(''));
    }
    assert.equal(patterns.size,4,`Distinct presets at ${n}×${n}`);
  }
});
test('Translation and rotation change the car image; stationary sampling stays stable',()=>{
  const s={...defaults(),source:'car'};const a=sampleShape(s);
  assert.deepEqual(sampleShape(s),a);s.angle=90;assert.notDeepEqual(sampleShape(s),a);
  s.angle=0;moveSubject(s,.7,.7);assert.notDeepEqual(sampleShape(s),a);
  moveSubject(s,-100,100);assert.equal(s.x,.2);assert.equal(s.y,.8);assert.ok(count(sampleShape(s))>0);
});
test('Position mode emits one pixel, and an empty mask never creates a false dot',()=>{
  assert.equal(count(sampleShape({...defaults(),display:'position'})),1);
  assert.equal(count(centrePixel(new Uint8Array(64),8)),0);
});
test('Trails fade in elapsed time while a held pose stays at full brightness',()=>{
  const on=Uint8Array.of(1,0),off=Uint8Array.of(0,1);
  const held=updateLights(Float32Array.of(1,0),on,10000,true);assert.equal(held[0],1);
  const moved=updateLights(held,off,16,true);assert.ok(moved[0]>.9);assert.equal(moved[1],1);
  assert.deepEqual([...updateLights(moved,off,700,true)],[0,1]);
  assert.deepEqual([...updateLights(held,off,16,false)],[0,1]);
});
test('Fixed camera background detects a static foreground and rejects identical frames and isolated noise',()=>{
  const side=32,background=new Uint8ClampedArray(side*side*4).fill(50),frame=background.slice();
  for(let y=8;y<24;y++)for(let x=8;x<24;x++)for(let k=0;k<3;k++)frame[(y*side+x)*4+k]=200;
  const saved=background.slice(),mask=foreground(frame,background,side,35);
  assert.ok(count(mask)>200);assert.deepEqual(foreground(frame,background,side,35),mask);assert.deepEqual(background,saved);
  assert.equal(count(foreground(background,background,side,35)),0);
  assert.equal(count(downsample(mask,side,8)),16);
  const noise=background.slice();noise.set([255,255,255,255],(16*side+16)*4);
  assert.equal(count(foreground(noise,background,side,35)),0);
  assert.throws(()=>foreground(frame,new Uint8Array(3),side,35));
});
function fakeStream(){const track={stopped:false,stop(){this.stopped=true;}};return {track,getTracks:()=>[track]};}
test('A late camera permission grant is closed after switching away',async()=>{
  const camera=new CameraSession(),stream=fakeStream();let resolve;
  const video={srcObject:null,async play(){}};
  const pending=camera.start(video,()=>new Promise(r=>{resolve=r;}));
  camera.stop();resolve(stream);assert.equal(await pending,false);assert.equal(stream.track.stopped,true);assert.equal(video.srcObject,null);
});
test('Camera stop and playback failure release the stream; requests never include audio',async()=>{
  const camera=new CameraSession(),stream=fakeStream(),video={srcObject:null,async play(){}};
  assert.equal(await camera.start(video,async c=>{assert.equal(c.audio,false);return stream;}),true);
  camera.stop();assert.equal(stream.track.stopped,true);assert.equal(video.srcObject,null);
  const broken=fakeStream();await assert.rejects(camera.start({async play(){throw new Error('unavailable');}},async()=>broken));assert.equal(broken.track.stopped,true);
});
