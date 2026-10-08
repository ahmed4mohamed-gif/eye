import {cloneModel} from './clone-model.js';
import {TruckMirrors} from './truck-mirrors.js';
import {loadDesertWorld,travelPose,applyTravel,updateArrivalGate} from './desert-world.js';
import {preserveTextureQuality} from './texture-quality.js';
import {vehicles} from './vehicles.js';
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
export class VehicleScene {
 constructor(onReady,onError){this.onReady=onReady;this.onError=onError;this.vehicle='carrier';this.env='studio';this.moving=false;this.doorOpen=false;this.wireOn=false;this.time=0;this.models=new Map();this.hotspots=[];this.wheels=[];this.doors=[];this.tweens=[];
 try{this.canvas=document.querySelector('#scene');this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(devicePixelRatio);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(39,1,.1,400);this.camera.position.set(21,13,23);this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.set(0,1.6,0);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.maxPolarAngle=Math.PI/2-.025;this.controls.minDistance=2;this.controls.maxDistance=55;this.controls.enablePan=false;this.controls.autoRotateSpeed=.4;this.controls.addEventListener('start',()=>{this.tween=null;});const pmrem=new THREE.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();this.scene.environmentIntensity=.55;this.scene.add(new THREE.HemisphereLight(0xcceaff,0x172a30,2));this.key=new THREE.DirectionalLight(0xffffff,3.2);this.key.position.set(8,18,10);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);Object.assign(this.key.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:.5,far:60});this.key.shadow.bias=-.001;this.scene.add(this.key);let rim=new THREE.DirectionalLight(0x86d9de,2);rim.position.set(-14,8,-8);this.scene.add(rim);this.ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x18292f,roughness:.84,metalness:.08}));this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-.035;this.ground.receiveShadow=true;this.scene.add(this.ground);this.grid=new THREE.GridHelper(100,50,0x334c52,0x22383e);this.grid.position.y=-.024;this.grid.material.transparent=true;this.grid.material.opacity=.24;this.scene.add(this.grid);this.root=new THREE.Group();this.scene.add(this.root);this.installCabClicks();this.loader=new GLTFLoader();const decoder=new DRACOLoader();decoder.setDecoderPath('./vendor/draco/');decoder.setWorkerLimit(2);this.loader.setDRACOLoader(decoder);this.clock=new THREE.Clock();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.canvas.parentElement);this.animate=this.animate.bind(this);this.renderer.setAnimationLoop(this.animate);this.loadVehicle('carrier').then(()=>onReady()).catch(onError);}catch(e){onError(e);}}
 async getModel(id){
  // Cache the pending load too: rapid vehicle changes must not decode a model twice.
  if(!this.models.has(id)){
   const pending=this.loader.loadAsync('./models/'+id+'.glb').then(({scene,animations})=>({scene,animations}));
   this.models.set(id,pending);
   pending.catch(()=>{if(this.models.get(id)===pending)this.models.delete(id);});
  }
  return this.models.get(id);
 }
 clearVehicle(){
  this.exitSeat?.();
  this.mirrors?.dispose();this.mirrors=null;
  // Only materials cloned for the displayed vehicle belong to this instance.
  // Cached geometry and textures are shared with the next view.
  this.root.traverse(o=>{if(o.userData.ownedMaterials)for(const material of o.userData.ownedMaterials)material.dispose();});
  if(this.wires){this.wires.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.wires=null;}
  this.root.clear();this.carrierGroup=null;this.currentRoadPose=null;
 }

 async loadVehicle(type){if(type==='carrier')return this.loadDetailedCarrier();const token=this.loadToken=(this.loadToken||0)+1;const config=vehicles[type];if(!config)throw Error('Unknown vehicle');const cabId=config.cab;const cab=await this.getModel(cabId);const trailer=config.trailer?await this.getModel(config.trailer):null;if(token!==this.loadToken)return;this.vehicle=type;this.clearVehicle();this.wheels=[];this.doors=[];this.parts=[];this.doorOpen=false;this.loaded=false;this.cab=cloneModel(cab.scene);this.cab.position.z=config.cabZ;this.root.add(this.cab);if(trailer){this.trailer=cloneModel(trailer.scene);this.trailer.position.z=.1;this.root.add(this.trailer);}else this.trailer=null;
 this.root.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.userData.ownedMaterials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=true;o.receiveShadow=true;for(const material of o.userData.ownedMaterials){if(material.name==='paint'||/paint|body/i.test(material.name)){material.color.set(o.name.includes('transporter')?0x236475:0xd8e1db);material.metalness=.5;material.roughness=.28;}}this.parts.push(o);}if(/^wheel-\d/.test(o.name)&&o.children.length)this.wheels.push(o);if(/^cab-door/.test(o.name)&&o.children.length){o.userData.start=o.rotation.y;this.doors.push(o);}});this.home();this.loaded=true;this.setHotspots();this.setWiring(this.wireOn);}
 async ensureDesert(){if(!this.desertPromise)this.desertPromise=loadDesertWorld(this.loader,this.renderer,this.scene).then(world=>this.desert=world);return this.desertPromise;}
 async loadDetailedCarrier(){
 const token=this.loadToken=(this.loadToken||0)+1;
 const ids=['actros','carrier',...Array.from({length:8},(_,i)=>`car-${i+1}`)];
 const group=new THREE.Group();group.position.z=11.5;const tractorTravel=new THREE.Group(),trailerTravel=new THREE.Group();group.add(tractorTravel,trailerTravel);
 let cursor=0;const collect=async()=>{while(cursor<ids.length){const id=ids[cursor++];const gltf=await this.getModel('operation/'+id);if(token!==this.loadToken)return;const model=cloneModel(gltf.scene);preserveTextureQuality(model,this.renderer);(id==='actros'?tractorTravel:trailerTravel).add(model);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();}mixer.setTime(2279/30);}}};
 await collect();if(token!==this.loadToken)return;await this.ensureDesert();if(token!==this.loadToken)return;
 this.vehicle='carrier';this.clearVehicle();this.carrierGroup=group;this.tractorTravel=tractorTravel;this.trailerTravel=trailerTravel;this.root.add(group);this.wheels=[];this.doors=[];this.parts=[];this.doorOpen=false;
 group.traverse(o=>{if(o.isMesh){if(!Array.isArray(o.material)&&o.material.name==='AM_Clear automotive glazing'){o.material=o.material.clone();o.userData.ownedMaterials=[o.material];Object.assign(o.material,{transparent:true,opacity:.16,metalness:0,roughness:.12,depthWrite:false});o.material.color.setRGB(.72,.85,.89);}o.castShadow=o.material?.name!=='AM_Clear automotive glazing';o.receiveShadow=true;this.parts.push(o);}if(!o.isMesh&&(o.name.includes('AW_WHEEL_')||o.name.startsWith('V009_TRAILER_WHEEL_')))this.wheels.push(o);if(!o.isMesh&&/^V007_AW_DOOR_(DRIVER|PASSENGER)(?:\.?\d+)?$/.test(o.userData.name||o.name)&&o.children.length){o.userData.start=o.rotation.y;this.doors.push(o);}});
 this.mirrors=new TruckMirrors(tractorTravel.children[0],tractorTravel);
 this.wheels.forEach(w=>{w.userData.roadBaseQuaternion=w.quaternion.clone();});
 this.loaded=true;this.setHotspots();this.setWiring(this.wireOn);this.setEnvironment(this.env);this.home();
 }
 roadPose(t=50){
  if(!this.desert||!this.carrierGroup)return;
  this.carrierGroup.position.set(0,0,0);this.currentRoadPose=travelPose(this.desert.travel,t);
  applyTravel(this.tractorTravel,this.currentRoadPose.tractor);applyTravel(this.trailerTravel,this.currentRoadPose.trailer);updateArrivalGate(this.desert,t);
  this.wheels.forEach(w=>{if(w.userData.roadBaseQuaternion){w.quaternion.copy(w.userData.roadBaseQuaternion);w.rotateX(this.currentRoadPose.distance/.53);}});
  const p=this.currentRoadPose.tractor.position;this.key.position.copy(p).add(new THREE.Vector3(8,18,10));this.key.target.position.copy(p).add(new THREE.Vector3(0,0,-12));this.scene.add(this.key.target);
 }
 home(){this.exitSeat();this.controls.minDistance=2;if(this.currentRoadPose&&this.env!=='studio'){const p=this.currentRoadPose.tractor,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw);const eye=new THREE.Vector3(27,14,16).applyQuaternion(q).add(p.position),target=new THREE.Vector3(0,1.8,-12).applyQuaternion(q).add(p.position);this.fly(eye.toArray(),target.toArray());return;}if(this.carrierGroup&&this.desert){this.fly([35,18,30],[0,2,-13]);return;}const d=vehicles[this.vehicle].distance;this.fly([23*d,12*d,22*d],[0,1.5,0]);}

 fly(pos,target){this.tween={start:performance.now(),from:this.camera.position.clone(),to:new THREE.Vector3(...pos),fromTarget:this.controls.target.clone(),toTarget:new THREE.Vector3(...target)};}
 zoom(factor){this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);}
 setHotspots(){this.renderRevision=(this.renderRevision||0)+1;let z=this.vehicle==='carrier'?11.5:2;this.points=[{id:'brain',p:[1.25,1.3,z-.7]},{id:'camera',p:[1.25,this.vehicle==='box'?3.5:3.15,this.vehicle==='carrier'?-3:-1.8]},{id:'weight',p:[1.25,.65,this.vehicle==='carrier'?-4.5:-2]},{id:'gnss',p:[.5,3.2,z+.1]},{id:'driver',p:[-1.15,2.25,z+.65]},{id:'door',p:[1.25,2,z+.7]}];if(this.carrierGroup)this.points.push({id:'door-passenger',p:[-1.25,2,z+.7]},{id:'seat-driver',seat:true,p:[.705,2.15,z+.42]},{id:'seat-passenger',seat:true,p:[-.705,2.15,z+.42]});this.onHotspots?.(this.points);}
 hotspotPosition(item){const p=new THREE.Vector3(...item.p);if(this.carrierGroup&&this.desert&&this.env==='studio')p.z-=11.5;if(this.currentRoadPose&&this.env!=='studio'){p.z-=11.5;const pose=['brain','driver','door','door-passenger','seat-driver','seat-passenger','gnss'].includes(item.id)?this.currentRoadPose.tractor:this.currentRoadPose.trailer;p.applyAxisAngle(new THREE.Vector3(0,1,0),pose.yaw).add(pose.position);}return p;}
 focus(id){this.exitSeat();const item=this.points?.find(p=>p.id===id);if(!item)return;const p=this.hotspotPosition(item);this.fly(p.clone().add(new THREE.Vector3(5,2.4,5)).toArray(),p.toArray());}

 toggleDoors(force){this.doorOpen=force??!this.doorOpen;this.doors.forEach(d=>d.userData.cabinOpen=this.doorOpen);return this.doorOpen;}
 toggleCabDoor(side){if(this.moving)return;const d=this.doors.find(d=>d.name.includes(side==='passenger'?'PASSENGER':'DRIVER'));if(!d)return;d.userData.cabinOpen=!(d.userData.cabinOpen??false);this.doorOpen=this.doors.some(d=>d.userData.cabinOpen);this.onDoorChange?.(this.doorOpen);}
 enterSeat(side){if(!this.tractorTravel)return;this.seatView=side;this.tween=null;this.controls.autoRotate=false;this.controls.enabled=false;this.camera.fov=65;this.camera.updateProjectionMatrix();this.seatYaw=0;this.seatPitch=-.06;this.seatReturn.hidden=false;this.seatReturn.textContent=(side==='driver'?'كرسي السواق':'كرسي الراكب')+' · ارجع برّه';this.updateSeat();}
 exitSeat(){if(!this.seatView)return;this.seatView=null;this.controls.enabled=true;this.camera.fov=39;this.camera.updateProjectionMatrix();if(this.seatReturn)this.seatReturn.hidden=true;}
 updateSeat(){if(!this.seatView||!this.tractorTravel)return;const x=this.seatView==='driver'?.705:-.705,eye=new THREE.Vector3(x,2.8,.48),direction=new THREE.Vector3(Math.sin(this.seatYaw)*Math.cos(this.seatPitch),Math.sin(this.seatPitch),Math.cos(this.seatYaw)*Math.cos(this.seatPitch)),target=eye.clone().addScaledVector(direction,5);this.tractorTravel.updateWorldMatrix(true,false);this.camera.position.copy(this.tractorTravel.localToWorld(eye));this.controls.target.copy(this.tractorTravel.localToWorld(target));this.camera.lookAt(this.controls.target);}
 installCabClicks(){
 this.seatReturn=document.createElement('button');this.seatReturn.className='seat-return';this.seatReturn.hidden=true;this.canvas.parentElement.append(this.seatReturn);this.seatReturn.onclick=()=>this.home();
 let down=null,last=null;const ray=new THREE.Raycaster();
 this.canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};last=down;});
 this.canvas.addEventListener('pointermove',e=>{if(!down||!this.seatView)return;this.seatYaw=THREE.MathUtils.clamp(this.seatYaw-(e.clientX-last.x)*.004,-1.4,1.4);this.seatPitch=THREE.MathUtils.clamp(this.seatPitch+(e.clientY-last.y)*.004,-.55,.4);last={x:e.clientX,y:e.clientY};});
 this.canvas.addEventListener('pointerup',e=>{const start=down;down=null;if(!start||this.seatView||this.moving||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;const rect=this.canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),this.camera);const hit=ray.intersectObject(this.root,true).find(h=>h.object.visible);if(!hit)return;let node=hit.object;while(node&&!this.doors.includes(node))node=node.parent;if(node)this.toggleCabDoor(node.name.includes('PASSENGER')?'passenger':'driver');});
 this.canvas.addEventListener('pointercancel',()=>down=null);window.addEventListener('pointerup',()=>down=null);document.addEventListener('keydown',e=>{if(e.code==='Escape'&&this.seatView)this.home();});
 }

 setEnvironment(type){
  this.env=type;this.grid.visible=type==='studio'&&!this.desert;this.ground.visible=!this.desert;
  this.key.intensity=type==='night'?.15:1.5;this.renderer.toneMappingExposure=type==='night'?.35:1;
  if(this.desert){this.desert.group.visible=true;this.scene.environment=this.desert.environment.texture;this.scene.background=type==='night'?new THREE.Color(0x071018):this.desert.texture;this.scene.fog=new THREE.Fog(type==='night'?0x071018:0xc8baa3,450,2200);this.camera.far=12000;this.camera.updateProjectionMatrix();}
  if(this.carrierGroup){if(type!=='studio'){this.roadTime=50;this.roadPose(50);}else{this.carrierGroup.position.set(0,0,this.desert?0:11.5);for(const a of [this.tractorTravel,this.trailerTravel]){a.position.set(0,0,0);a.rotation.set(0,0,0);}this.currentRoadPose=null;this.wheels.forEach(w=>{if(w.userData.roadBaseQuaternion)w.quaternion.copy(w.userData.roadBaseQuaternion);});this.key.position.set(8,18,10);this.key.target.position.set(0,0,0);}}
  this.setHotspots();this.setWiring(this.wireOn);this.home();
 }
 setWiring(on){this.renderRevision=(this.renderRevision||0)+1;this.wireOn=on;if(this.wires){this.root.remove(this.wires);this.wires.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}this.wires=new THREE.Group();this.root.add(this.wires);if(!on||!this.points)return;const brain=this.hotspotPosition(this.points[0]);for(const item of this.points.filter(p=>!['brain','door','door-passenger','seat-driver','seat-passenger'].includes(p.id))){const from=this.hotspotPosition(item);const mid=from.clone().lerp(brain,.5);mid.add(new THREE.Vector3(.8,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),this.currentRoadPose?.tractor.yaw||0));mid.y=1.1;const curve=new THREE.CatmullRomCurve3([from,mid,brain]);const line=new THREE.Mesh(new THREE.TubeGeometry(curve,30,.025,6,false),new THREE.MeshBasicMaterial({color:item.id==='weight'?0xffc078:0x6ae8d4,depthTest:false,transparent:true,opacity:.9}));line.renderOrder=8;this.wires.add(line);} }
 resize(){this.renderRevision=(this.renderRevision||0)+1;const {clientWidth:w,clientHeight:h}=this.canvas.parentElement;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 animate(){let dt=Math.min(this.clock.getDelta(),.05);if(document.hidden)return;this.time+=dt;if(this.tween){let p=Math.min((performance.now()-this.tween.start)/1000,1);let e=1-Math.pow(1-p,3);this.camera.position.lerpVectors(this.tween.from,this.tween.to,e);this.controls.target.lerpVectors(this.tween.fromTarget,this.tween.toTarget,e);if(p===1)this.tween=null;}this.doors.forEach((d,i)=>{let goal=d.userData.start+((d.userData.cabinOpen??false)?(d.name.includes('PASSENGER')?1.15:-1.15):0);d.rotation.y=Math.abs(d.rotation.y-goal)<1e-5?goal:THREE.MathUtils.damp(d.rotation.y,goal,6,dt);});if(this.moving&&!this.carrierGroup)this.wheels.forEach(w=>w.rotation.x+=dt*7);if(this.moving&&this.currentRoadPose){this.roadTime=Math.min(this.desert?.route.drivingDuration??90,this.roadTime+dt);this.roadPose(this.roadTime);}this.controls.update();this.updateSeat();this.onFrame?.(dt);this.camera.updateMatrixWorld();
 const shadowStamp=[this.vehicle,this.loadToken,this.env,this.loaded,this.root.children.length,this.scene.children.length,...this.doors.map(d=>d.rotation.y),...this.key.position.toArray(),...this.key.target.position.toArray()].join('|');
 if(this.moving||shadowStamp!==this.lastShadowStamp)this.renderer.shadowMap.needsUpdate=true;
 const stamp=this.camera.matrixWorld.elements.join(',')+'|'+this.camera.projectionMatrix.elements.join(',')+'|'+shadowStamp+'|'+this.renderRevision+'|'+this.scene.children.length+'|'+this.seatView;
 if(this.moving||this.tween||stamp!==this.lastFrameStamp||this.mirrors?.pending){this.mirrors?.update(this.renderer,this.scene,this.camera,performance.now());this.renderer.render(this.scene,this.camera);this.updateHotspots();this.lastFrameStamp=stamp;this.lastShadowStamp=shadowStamp;}
}
 updateHotspots(){if(!this.points)return;const w=this.canvas.clientWidth,h=this.canvas.clientHeight;for(const p of this.points){const n=document.querySelector('[data-hotspot="'+p.id+'"]');if(!n)continue;let v=this.hotspotPosition(p).applyMatrix4(this.root.matrixWorld).project(this.camera);n.style.left=(v.x*.5+.5)*w+'px';n.style.top=(-v.y*.5+.5)*h+'px';const seatDoor=p.seat?this.doors.find(d=>d.name.includes(p.id==='seat-driver'?'DRIVER':'PASSENGER')):null;const hideSeat=p.seat&&(!seatDoor||Math.abs(seatDoor.rotation.y-seatDoor.userData.start)<.25);n.classList.toggle('is-hidden',!!this.seatView||hideSeat||v.z>1||v.z<0||v.x<-1||v.x>1||v.y<-1||v.y>1);}}
}


