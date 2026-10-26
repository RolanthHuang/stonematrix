import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = T.MathUtils.clamp;
function hash(x,y) { let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295; }
function noise(x,y) {
  const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,a=u*u*(3-2*u),b=v*v*(3-2*v);
  return T.MathUtils.lerp(T.MathUtils.lerp(hash(i,j),hash(i+1,j),a),T.MathUtils.lerp(hash(i,j+1),hash(i+1,j+1),a),b);
}
function fbm(x,y) { let n=0,a=.54;for(let i=0;i<5;i++){n+=noise(x,y)*a;x=x*2.07+7.1;y=y*2.03+13.7;a*=.49;}return n; }
function textures() {
  const n=384,base=document.createElement('canvas'),normal=document.createElement('canvas'),rough=document.createElement('canvas'),glow=document.createElement('canvas');
  for(const c of [base,normal,rough,glow])c.width=c.height=n;
  const bc=base.getContext('2d'),nc=normal.getContext('2d'),rc=rough.getContext('2d'),gc=glow.getContext('2d');
  const bi=bc.createImageData(n,n),ni=nc.createImageData(n,n),ri=rc.createImageData(n,n),gi=gc.createImageData(n,n),height=new Float32Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/n,f=fbm(u*7,v*7),grain=hash(x+83,y+29),strata=noise(u*4+v*10,v*28);
    const fissure=Math.abs(noise(u*8+f*2,v*8)-.5),crack=clamp((.022-fissure)*65,0,1)*clamp((noise(u*19,v*19)-.28)*3,0,1);
    const pit=grain>.967?.16:0,h=f*.72+strata*.17+grain*.06-crack*.17-pit;
    height[y*n+x]=h;
    const p=(y*n+x)*4,c=88+f*93+strata*20+grain*13-crack*52-pit*110;
    bi.data[p]=c*1.04;bi.data[p+1]=c*1.01;bi.data[p+2]=c*.91;bi.data[p+3]=255;
    const r=clamp(225+f*27-grain*16,0,255);ri.data.set([r,r,r,255],p);
    const g=crack*210;gi.data.set([g,g,g,255],p);
  }
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const at=(a,b)=>height[((b+n)%n)*n+(a+n)%n],dx=(at(x-1,y)-at(x+1,y))*4,dy=(at(x,y-1)-at(x,y+1))*4;
    const v=new T.Vector3(dx,dy,1).normalize(),p=(y*n+x)*4;ni.data.set([(v.x*.5+.5)*255,(v.y*.5+.5)*255,(v.z*.5+.5)*255,255],p);
  }
  bc.putImageData(bi,0,0);nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);gc.putImageData(gi,0,0);
  const make=(c,srgb=false)=>{const t=new T.CanvasTexture(c);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;};
  return {map:make(base,true),normalMap:make(normal),roughnessMap:make(rough),emissiveMap:make(glow,true)};
}
function rockGeometry(seed) {
  const g=new RoundedBoxGeometry(.7,.7,.7,3,.065),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=noise(x*8+seed*5.7,y*8+z*11+seed*3.8)-.5;
    const cut=1-.065*noise(x*16+y*4+seed,z*15+seed*6);
    p.setXYZ(i,(x+k*.025)*cut,y+k*.025,(z+k*.02)*cut);
  }
  g.computeVertexNormals();return g;
}

export function create({stage,onHover,onPick,onView,isLocked}) {
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const canvas=renderer.domElement;canvas.className='sm-webgl';canvas.setAttribute('aria-label','可拖曳旋轉與縮放的立體飛行石室');stage.prepend(canvas);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(39,1,.1,65);
  const controls=new OrbitControls(camera,canvas);controls.target.set(2,1.65,2);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.09;
  controls.minDistance=7;controls.maxDistance=19;controls.minPolarAngle=.32;controls.maxPolarAngle=1.42;
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),pads=[],rocks=[],rays=new Map();
  let w=600,h=500,lastFrame=0,frame=0,current={stones:[],rays:[],phase:'preview',hover:null},down=null,dragged=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const backgroundColor=new T.Color(getComputedStyle(stage.closest('#stone-matrix-draft')).backgroundColor);
  scene.fog=new T.Fog(backgroundColor,13,28);
  scene.add(new T.HemisphereLight(0xe8e1cd,0x24342c,2.1));
  const sun=new T.DirectionalLight(0xffe3b7,3.4);sun.position.set(-3,9,6);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:25});sun.shadow.bias=-.0005;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun);
  const fill=new T.DirectionalLight(0xadcbd5,1.3);fill.position.set(7,4,-5);scene.add(fill);
  const rim=new T.PointLight(0x73bfb1,11,10,2);rim.position.set(2,4.8,2);scene.add(rim);
  const maps=textures();
  const pedestal=new T.Mesh(new T.BoxGeometry(4.24,.18,4.24),new T.MeshStandardMaterial({color:0x4b5144,roughness:.96,map:maps.map,normalMap:maps.normalMap}));
  pedestal.position.set(2,-.16,2);pedestal.receiveShadow=true;pedestal.castShadow=true;scene.add(pedestal);
  const padGeometries={F:new T.BoxGeometry(.95,.055,.95),X:new T.BoxGeometry(.055,.95,.95),Y:new T.BoxGeometry(.95,.95,.055)};
  for(const face of ['F','X','Y'])for(let b=0;b<4;b++)for(let a=0;a<4;a++){
    const mat=new T.MeshStandardMaterial({color:face==='F'?0x727762:0x7b826e,roughness:.97,map:maps.map,normalMap:maps.normalMap,normalScale:new T.Vector2(.23,.23),transparent:face!=='F',opacity:face==='F'?1:.72,depthWrite:face==='F',side:T.DoubleSide});
    const mesh=new T.Mesh(padGeometries[face],mat);mesh.receiveShadow=true;
    if(face==='F')mesh.position.set(a+.5,-.025,b+.5);
    else if(face==='X')mesh.position.set(-.035,b+.5,a+.5);
    else mesh.position.set(a+.5,b+.5,-.035);
    mesh.userData={key:`${face}:${a}:${b}`,face,a,b};scene.add(mesh);pads.push(mesh);
    const end=face==='F'?[a+.5,4.3,b+.5]:face==='X'?[4.3,b+.5,a+.5]:[a+.5,b+.5,4.3];
    const start=face==='F'?[a+.5,.02,b+.5]:face==='X'?[.02,b+.5,a+.5]:[a+.5,b+.5,.02];
    const group=new T.Group(),from=new T.Vector3(...start),to=new T.Vector3(...end),direction=to.clone().sub(from);
    for(const [radius,opacity,depthTest] of [[.013,.8,true],[.047,.085,false]]){
      const beam=new T.Mesh(new T.CylinderGeometry(radius,radius,direction.length(),7),new T.MeshBasicMaterial({color:0xffd58a,transparent:true,opacity,depthTest,depthWrite:false,blending:T.AdditiveBlending}));
      beam.position.copy(from).add(to).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());group.add(beam);
    }
    scene.add(group);rays.set(mesh.userData.key,group);
  }
  const frameEdges=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(4.12,4.12,4.12)),new T.LineBasicMaterial({color:0xb5ae8c,transparent:true,opacity:.14}));frameEdges.position.set(2,2,2);scene.add(frameEdges);
  for(let i=0;i<14;i++){
    const mat=new T.MeshStandardMaterial({...maps,color:new T.Color().setHSL(.11,.09,.66+hash(i,9)*.08),roughness:.96,normalScale:new T.Vector2(.9,.9),emissive:0x3bada0,emissiveIntensity:.15});
    const mesh=new T.Mesh(rockGeometry(i+2),mat);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.seed=i*1.73;scene.add(mesh);rocks.push(mesh);
  }
  // A quiet, fog-softened ring of ruined columns outside the playable chamber.
  const exterior=new T.Group();scene.add(exterior);
  const ruinMaterial=new T.MeshStandardMaterial({color:0x9ba18e,roughness:1,transparent:true,opacity:.09,depthWrite:false});
  for(let i=0;i<10;i++){
    const angle=i/10*Math.PI*2,r=7.5+hash(i,20)*1.8,x=2+Math.cos(angle)*r,z=2+Math.sin(angle)*r,height=2.5+hash(i,4)*3;
    const col=new T.Mesh(new T.CylinderGeometry(.23,.4,height,6),ruinMaterial);col.position.set(x,height/2-1,z);exterior.add(col);
    const capital=new T.Mesh(new T.BoxGeometry(.98,.2,.98),ruinMaterial);capital.position.set(x,height-1,z);capital.rotation.y=angle;exterior.add(capital);
    const base=new T.Mesh(new T.BoxGeometry(1.2,.3,1.2),ruinMaterial);base.position.set(x,-1,z);base.rotation.y=angle;exterior.add(base);
  }
  const ring=new T.Mesh(new T.RingGeometry(5.8,6,80),new T.MeshBasicMaterial({color:0xb2b496,transparent:true,opacity:.1,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(2,-.6,2);exterior.add(ring);
  const dustPositions=new Float32Array(45*3);for(let i=0;i<45;i++)dustPositions.set([(hash(i,1)-.5)*9+2,hash(i,3)*6,(hash(i,2)-.5)*9+2],i*3);
  const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));
  const dust=new T.Points(dustGeometry,new T.PointsMaterial({color:0xd8d2a7,size:.021,transparent:true,opacity:.33,depthWrite:false}));scene.add(dust);

  function notifyView(){camera.updateMatrixWorld(true);onView?.();}
  function home(){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();const distance=10.5*Math.max(1,.92/camera.aspect);camera.position.copy(new T.Vector3(1,.82,1).normalize().multiplyScalar(distance).add(controls.target));controls.update();controls.enableDamping=damping;notifyView();}
  function project(x,y,z){const v=new T.Vector3(x,z,y).project(camera);return[(v.x+1)*w/2,(1-v.y)*h/2,v.z];}
  function pick(event){
    const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(pads,false)[0];return hit?.object.userData.key||null;
  }
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,id:e.pointerId};dragged=false;canvas.classList.add('is-dragging');});
  canvas.addEventListener('pointermove',e=>{
    if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)dragged=true;
    if(!down&&!isLocked())onHover?.(pick(e));
  });
  canvas.addEventListener('pointerup',e=>{
    if(down&&down.id===e.pointerId&&!dragged&&!isLocked()){const key=pick(e);if(key)onPick?.(key);}
    down=null;canvas.classList.remove('is-dragging');
  });
  canvas.addEventListener('pointercancel',()=>{down=null;dragged=false;canvas.classList.remove('is-dragging');});
  canvas.addEventListener('pointerleave',()=>{if(!down)onHover?.(null);});
  controls.addEventListener('change',notifyView);
  function update(next){
    current=next;const selected=new Set(next.selected||[]),active=new Set(next.rays.map(r=>r.key)),settled=next.phase==='settled'||next.phase==='lighting';
    for(const pad of pads){const k=pad.userData.key,highlight=selected.has(k)||next.hover===k;pad.material.color.set(highlight?0xc8a56b:pad.userData.face==='F'?0x727762:0x7b826e);pad.material.emissive.set(highlight?0x735021:0x000000);pad.material.emissiveIntensity=highlight?.13:0;}
    for(const [k,group]of rays){group.visible=active.has(k)&&next.phase!=='spinning';const dim=next.hover&&next.hover!==k?.18:1;group.children[0].material.opacity=(settled?.83:.29)*dim;group.children[1].material.opacity=(settled?.09:.035)*dim;}
    rocks.forEach((mesh,i)=>{
      const s=next.stones[i];mesh.visible=!!s;if(!s)return;
      const matched=settled&&next.rays.some(r=>r.face==='F'?s.x===r.a&&s.y===r.b:r.face==='X'?s.y===r.a&&s.z===r.b:s.x===r.a&&s.z===r.b);
      mesh.material.emissive.set(matched?0xffb64b:0x3bada0);mesh.material.emissiveIntensity=matched?1.05:.13;
    });
    render(performance.now());
  }
  function render(now){
    const t=now/1000,moving=current.phase==='spinning';
    rocks.forEach((mesh,i)=>{
      const s=current.stones[i];if(!s)return;const p=mesh.userData.seed,amp=reduced.matches?0:.048;
      mesh.position.set(s.x+.5,s.z+.5+Math.sin(t*.87+p)*amp,s.y+.5);
      mesh.rotation.set(reduced.matches?0:Math.sin(t*.43+p)*.035,Math.sin((moving?t*2:t*.22)+p)*(moving?.18:.065),reduced.matches?0:Math.cos(t*.47+p)*.024);
    });
    for(const pad of pads){if(pad.userData.face==='X')pad.material.opacity=camera.position.x<.3?.13:.72;if(pad.userData.face==='Y')pad.material.opacity=camera.position.z<.3?.13:.72;}
    if(!reduced.matches){for(let i=0;i<45;i++){dustPositions[i*3+1]=((hash(i,3)*6+t*.035)%6); }dustGeometry.attributes.position.needsUpdate=true;}
    renderer.render(scene,camera);
  }
  function loop(now){frame=requestAnimationFrame(loop);if(document.hidden||now-lastFrame<33)return;lastFrame=now;const changed=controls.update();if(!reduced.matches||changed||current.phase==='spinning')render(now);}
  function resize(width,height){const prior=Math.max(1,.92/camera.aspect);w=width;h=height;camera.aspect=w/h;const ratio=Math.max(1,.92/camera.aspect)/prior;camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);camera.updateProjectionMatrix();renderer.setSize(w,h,false);controls.update();notifyView();render(performance.now());}
  function turn(angle){const v=camera.position.clone().sub(controls.target).applyAxisAngle(new T.Vector3(0,1,0),angle);camera.position.copy(controls.target).add(v);controls.update();notifyView();}
  function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;}else if(!frame){frame=requestAnimationFrame(loop);}}
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',event=>{cancelAnimationFrame(frame);frame=0;if(!event.persisted){controls.dispose();renderer.dispose();}});
  window.addEventListener('pageshow',event=>{if(event.persisted)visibility();});
  resize(w,h);home();frame=requestAnimationFrame(loop);
  return {update,resize,project,home,turn};
}
