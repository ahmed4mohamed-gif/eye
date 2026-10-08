import {finishLoading,failLoading} from './loading-screen.js';
import {sampleMixer} from './animation-sampling.js';
import {TruckMirrors} from './truck-mirrors.js';
import {SceneAudio} from './scene-audio.js';
import {followShot,avoidBuildings,gateOpening} from './operation-cameras.js';
import {loadDesertWorld,travelPose,applyTravel,updateArrivalGate} from './desert-world.js';
import {preserveTextureQuality} from './texture-quality.js';
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';

const $=s=>document.querySelector(s), loadingDuration=2279/30, drivingStart=3179/30;
let duration=drivingStart+90;
const names=['Subaru Impreza','Mazda RX-7','Ford Shelby GT500','Mazda RX-8','Porsche GT3 RS','Porsche GT3 R','Nissan R34','BMW M3'];
const starts=[100,330,560,790,1230,1510,1730,1950].map(f=>(f-1)/30);
const ends=starts.map(t=>t+7);
let time=loadingDuration,hasStarted=false,lastShot=null,playing=false,ready=false,automatic=true,mode='studio',doorOpen=false,last=performance.now(),loaded=0;
let renderer,scene,camera,controls,loader,road,ground,ambient,sun,root,desert,tractorTravel,trailerTravel,currentPose;
let lastRenderStamp='';
let cabYaw=0,cabPitch=0;
let cameraMode='auto',followDistance=28,followHeight=12;
const sound=new SceneAudio();let lastAudioDistance=0,mirrors=null;const hydraulicNodes=[];
const mixers=[],actions=[],assets=new Map(),truckWheels=[],doorNodes=[],readerMaterials=[];
const target=new THREE.Vector3(),eye=new THREE.Vector3(),world=new THREE.Vector3();
const format=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function state(){
 const upper=ends.slice(0,4).filter(t=>time>=t).length,lower=ends.slice(4).filter(t=>time>=t).length;
 $('#upper-count').textContent=`${upper} / 4`;$('#lower-count').textContent=`${lower} / 4`;$('#phase-count').textContent=`${String(upper+lower).padStart(2,'0')} / 08`;
 let title='تجهيز المنصات',description='المنصات بتتجهز علشان تستقبل أول عربية.';
 const active=starts.findIndex((t,i)=>time>=t&&time<=ends[i]);
 if(active>=0){title=`${names[active]}`;const phase=(time-starts[active])*30;description=`العربية ${active+1} · ${phase<70?'بتدخل على منصة الرفع':phase<115?'المنصة بترفع العربية لمسار التحميل':active<4?'بتتحرك لمكانها فوق':'بتتحرك لمكانها تحت'}`;}
 else if(time>=duration-.05){title='وصلنا لساحة الوصول';description='الناقلة وصلت بالعربيات الثمانية. تقدر ترجع لأي مرحلة من شريط التجربة.';}
 else if(time>=drivingStart){title=time<drivingStart+25?'الخروج من مركز النقل':'الرحلة على الطريق';description='رأس الشاحنة والمقطورة بيتحركوا على المسار لحد ساحة الوصول.';}
 else if(time>=3059/30){title='تشغيل الشاحنة';description='تمثيل تشغيل الشاحنة والاستعداد للحركة.';}
 else if(time>=2939/30){title=time>=2994/30?'التحقق التوضيحي نجح':'التحقق بالبصمة';description='السائق بيستخدم قارئ البصمة على التابلوه. دي حركة توضيحية، من غير قراءة بصمة حقيقية.';}
 else if(time>=2849/30){title='الاستعداد للقيادة';description='السائق بيقفل الباب ويظبط قعدته.';}
 else if(time>=2549/30){title='دخول الكابينة';description='السائق بيطلع درجات الكابينة وبعدها يقعد.';}
 else if(time>=2369/30){title='فتح باب السائق';description='السائق بيمسك المقبض ويفتح الباب علشان يطلع.';}
 else if(time>=loadingDuration){title=hasStarted?'السائق رايح للكابينة':'اكتمل التحميل';description=hasStarted?'التحميل خلص، وبدأ مشهد السائق.':'أربع عربيات فوق وأربع تحت. دوس ابدأ التحميل علشان تشوف الخطوات من الأول.';}
 else if(time>72){title='ضبط وضع النقل';description='المنصات بتستقر في وضع النقل.';}
 else if(time>=38&&time<41){title='تجهيز الدور السفلي';description='بنجهّز مسار دخول العربيات للدور السفلي.';}
 else if(time>=34.3&&time<38){title='رفع المنصات العلوية';description='الأربع عربيات فوق في أماكنها، وبنجهّز الدور السفلي.';}
 else if(time>=48&&time<50.3){title='ضبط المنصة السفلية';description='المنصة بتتجهز للعربية اللي بعدها.';}
 else if(time>3.3){title='تجهيز العربية اللي بعدها';description='العربيات بتطلع واحدة ورا التانية.';}
 if(mode==='road'){title='معاينة القيادة';description='الناقلة المحمّلة على الطريق الصحراوي. شغّل تجربة العملية علشان تبدأ من ساحة التحميل.';}
 $('#phase-title').textContent=title;$('#phase-description').textContent=description;
 $('#time').textContent=`${format(time)} / ${format(duration)}`;$('#timeline').value=time;
 $('#play').innerHTML=playing?'إيقاف مؤقت <span>Ⅱ</span>':(!hasStarted||time>=duration-.1?'تجربة العملية <span>▶</span>':'استكمال <span>▶</span>');
 return active;
}
function setTime(t){time=Math.max(0,Math.min(duration,t));for(const a of actions){a.paused=false;a.enabled=true;}for(const m of mixers)sampleMixer(m,Math.min(time,3479/30));if(desert){currentPose=travelPose(desert.travel,Math.max(0,time-drivingStart));applyTravel(tractorTravel,currentPose.tractor);applyTravel(trailerTravel,currentPose.trailer);updateArrivalGate(desert,Math.max(0,time-drivingStart));for(const wheel of truckWheels){if(wheel.userData.roadBaseQuaternion){wheel.quaternion.copy(wheel.userData.roadBaseQuaternion);if(time>=drivingStart)wheel.rotateX(currentPose.distance/.53);}}}if(desert?.gate)desert.gate.position.x=15*gateOpening(time,drivingStart,currentPose?.distance??0);if(assets.has('yard'))assets.get('yard').visible=time<loadingDuration-.1&&mode!=='road';if(assets.has('driver'))assets.get('driver').visible=time>=loadingDuration&&(hasStarted||mode==='road');state();}
function syncCameraControls(){
 const distanceModes=['rear-close','rear-far','front','side'];
 const heightModes=[...distanceModes,'top','loading'];
 $('#camera-distance').closest('label').hidden=!distanceModes.includes(cameraMode);
 $('#camera-height').closest('label').hidden=!heightModes.includes(cameraMode);

 document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===cameraMode)));
 $('#camera-auto').setAttribute('aria-pressed',String(cameraMode==='auto'));
}
function chooseCamera(mode){cameraMode=mode;cabYaw=0;cabPitch=0;$('#leave-cab').hidden=!['driver','passenger'].includes(mode);if(camera){camera.fov=['driver','passenger'].includes(mode)?65:40;camera.updateProjectionMatrix();}if(controls)controls.enabled=!['driver','passenger'].includes(mode);automatic=mode==='auto';lastShot=null;if(controls){controls.maxPolarAngle=['driver','passenger'].includes(mode)?Math.PI:Math.PI*.495;controls.minDistance=['driver','passenger'].includes(mode)?.1:1;}if(['driver','passenger'].includes(mode)&&camera){const shot=followShot(mode,currentPose);camera.position.copy(shot.eye);controls.target.copy(shot.target);}syncCameraControls();}
function view(kind){
 if(kind==='side'){eye.set(33,8,-12);target.set(0,2,-12);}
 else if(kind==='rear'){eye.set(12,9,-37);target.set(0,2,-19);}
 else{eye.set(28,17,19);target.set(0,2,-12);}
 if(currentPose&&time>=drivingStart){const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),currentPose.tractor.yaw);eye.applyQuaternion(q).add(currentPose.tractor.position);target.applyQuaternion(q).add(currentPose.tractor.position);}
 camera.position.copy(eye);controls.target.copy(target);controls.update();
}
function environment(next){mode=next;road.visible=next==='road';ground.material.color.set(next==='road'?0x273131:0x112127);scene.background=new THREE.Color(next==='road'?0xa7bec2:0x09171d);scene.fog.color.copy(scene.background);scene.fog.near=next==='road'?65:100;scene.fog.far=next==='road'?170:240;
 ground.visible=false;road.visible=false;if(desert){desert.group.visible=true;scene.background=desert.texture;scene.environment=desert.environment.texture;scene.fog=new THREE.Fog(0xc8baa3,450,2200);camera.far=12000;camera.updateProjectionMatrix();}
 if(next==='road'){playing=false;hasStarted=true;setTime(drivingStart+50);doorOpen=false;view('overview');}
 document.querySelectorAll('[data-env]').forEach(b=>b.classList.toggle('active',b.dataset.env===next));state();
}
async function boot(){
 try{
 renderer=new THREE.WebGLRenderer({canvas:$('#operation-scene'),antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(devicePixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();scene.background=new THREE.Color(0x09171d);scene.fog=new THREE.Fog(0x09171d,100,240);
 camera=new THREE.PerspectiveCamera(40,1,.05,400);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=1;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.485;
 controls.addEventListener('start',()=>chooseCamera('free'));
 const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();
 ambient=new THREE.HemisphereLight(0xc1e0ed,0x465445,1);scene.add(ambient);sun=new THREE.DirectionalLight(0xfff2dc,2);sun.position.set(-8,18,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=38;sun.shadow.camera.bottom=-38;sun.shadow.normalBias=.025;sun.target.position.set(0,0,-12);scene.add(sun,sun.target);
 ground=new THREE.Mesh(new THREE.PlaneGeometry(500,500),new THREE.MeshStandardMaterial({color:0x112127,roughness:.8}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;scene.add(ground);
 road=new THREE.Group();road.visible=false;scene.add(road);
 const lineMat=new THREE.MeshStandardMaterial({color:0xd6ddd5,roughness:.85});
 for(let z=-180;z<90;z+=8){for(const x of [-3.6,3.6]){const dash=new THREE.Mesh(new THREE.BoxGeometry(.12,.008,3),lineMat);dash.position.set(x,0,z);road.add(dash);}}
 root=new THREE.Group();scene.add(root);tractorTravel=new THREE.Group();trailerTravel=new THREE.Group();root.add(tractorTravel,trailerTravel);
 loader=new GLTFLoader();const draco=new DRACOLoader();draco.setDecoderPath('./vendor/draco/');draco.setWorkerLimit(2);loader.setDRACOLoader(draco);
 desert=await loadDesertWorld(loader,renderer,scene);duration=drivingStart+desert.route.drivingDuration;$('#timeline').max=duration;environment('studio');
 view('overview');const resize=()=>{const box=renderer.domElement.parentElement.getBoundingClientRect();renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.zoom=Math.min(1,camera.aspect/1.15);camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(renderer.domElement.parentElement);resize();requestAnimationFrame(tick);
 const order=['actros','carrier','car-1','car-2','car-3','car-4','car-5','car-6','car-7','car-8','yard','driver'];
 let cursor=0;
 const worker=async()=>{while(cursor<order.length){const name=order[cursor++];const gltf=await loader.loadAsync(`./models/operation/${name}.glb`);preserveTextureQuality(gltf.scene,renderer);(name==='yard'?root:['actros','driver'].includes(name)?tractorTravel:trailerTravel).add(gltf.scene);assets.set(name,gltf.scene);
   gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.envMapIntensity=.85;if(m.name.includes("V009_Fingerprint_active"))readerMaterials.push(m);}}}
    if((name==='actros'&&o.name.includes('AW_WHEEL_')&&!o.isMesh)||(name==='carrier'&&o.name.startsWith('V009_TRAILER_WHEEL_')&&!o.isMesh))truckWheels.push(o);
    if(name==='actros'&&/DOOR_(DRIVER|PASSENGER)/.test(o.name)&&!o.isMesh)doorNodes.push(o);
   });
   if(name==='actros')gltf.scene.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m?.name==='AM_Clear automotive glazing'){m.transparent=true;m.opacity=.16;m.metalness=0;m.roughness=.12;m.depthWrite=false;m.color.setRGB(.72,.85,.89);m.needsUpdate=true;o.castShadow=false;}}});
   if(name==='carrier'||name==='yard')gltf.scene.traverse(o=>{if((name==='carrier'&&/lift.*rod|lift_rod|adjustment_rod/i.test(o.name))||(name==='yard'&&o.name==='V009_LIFT_PLATFORM'))hydraulicNodes.push({node:o,position:o.position.clone(),quaternion:o.quaternion.clone()});});
   if(gltf.animations.length){const mixer=new THREE.AnimationMixer(gltf.scene);for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();actions.push(action);}mixer.userDataEnd=Math.max(...gltf.animations.map(c=>c.duration));sampleMixer(mixer,Math.min(time,3479/30));mixers.push(mixer);}
   if(name==='actros')mirrors=new TruckMirrors(gltf.scene,tractorTravel);
   loaded++;$('#asset-progress').value=loaded;$('#load-detail').textContent=`${loaded} / 12 موديل`;}
 };
 await worker();for(const wheel of truckWheels)wheel.userData.roadBaseQuaternion=wheel.quaternion.clone();ready=true;setTime(loadingDuration);await finishLoading(renderer,scene,camera);$('#load-screen').hidden=true;$('#play').disabled=false;$('#restart').disabled=false;$('#timeline').disabled=false;
 }catch(error){console.error(error);failLoading();$('#load-label').textContent='تعذّر تجهيز المشهد';$('#load-detail').textContent='اتأكد إن مجلدات المشروع موجودة جنب ملف HTML، وبعدها جرّب تاني.';$('#retry').hidden=false;}
}
function tick(now){
 const dt=Math.min((now-last)/1000,.1);last=now;if(document.hidden){requestAnimationFrame(tick);return;}
 const distance=currentPose?.distance??0,speed=playing?Math.min(40,Math.max(0,(distance-lastAudioDistance)/Math.max(dt,.001))):0;lastAudioDistance=distance;



 if(ready&&playing){setTime(time+dt*Number($('#speed').value));if(time>=duration){playing=false;state();}}
 let hydraulicMoving=false;for(const h of hydraulicNodes){if(h.node.position.distanceToSquared(h.position)>1e-10||h.node.quaternion.angleTo(h.quaternion)>1e-5)hydraulicMoving=true;h.position.copy(h.node.position);h.quaternion.copy(h.node.quaternion);}
 sound.update({time,playing,driver:cameraMode==='driver',speed,hydraulicMoving});
 if(ready&&cameraMode==='auto'&&(playing||hasStarted)){
  const active=starts.findIndex((t,i)=>time>=t&&time<=ends[i]);
  if(active>=0){const node=assets.get(`car-${active+1}`).getObjectByName(`asset_car-${active+1}`);node.getWorldPosition(world);target.copy(world).add(new THREE.Vector3(0,.6,0));eye.copy(world).add(new THREE.Vector3(active%2===0?10:12,6,-9));}
  else if(time>=drivingStart){const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),currentPose.tractor.yaw);target.set(0,2,-12).applyQuaternion(q).add(currentPose.tractor.position);eye.set(23,9,16).applyQuaternion(q).add(currentPose.tractor.position);}
  else if(time>=2939/30&&time<3059/30){target.set(.40,2.53,1.49);eye.set(-.05,2.9,.80);}
  else if(time>=2849/30){target.set(.65,2.45,.85);eye.set(-.8,3,1.5);}
  else if(time>=2549/30){target.set(1,1.9,1);eye.set(5,3.5,-1.8);}
  else if(time>=loadingDuration){target.set(1.5,1.5,.8);eye.set(5,3.1,3.4);}
  else{target.set(0,2,-16);eye.set(27,13,-6);}
  const shot=active>=0?'car-'+active:time>=drivingStart?'road':time>=2939/30&&time<3059/30?'finger':time>=2849/30?'cabin':time>=2549/30?'entry':time>=loadingDuration?'door':'loading';if(shot!==lastShot){lastShot=shot;}
  if(desert?.cameraBoxes&&shot!=='finger'&&shot!=='cabin'&&shot!=='entry')eye.copy(avoidBuildings(eye,target,desert.cameraBoxes));const a=1-Math.exp(-dt*2);camera.position.lerp(eye,a);controls.target.lerp(target,a);
 }
 if(ready&&cameraMode!=='auto'&&cameraMode!=='free'){
  const activeIndex=starts.findIndex((t,i)=>time>=t&&time<=ends[i]);let active=null;
  if(activeIndex>=0){const model=assets.get(`car-${activeIndex+1}`),node=model?.getObjectByName(`asset_car-${activeIndex+1}`)??model;if(node)active=node.getWorldPosition(new THREE.Vector3());}
  const shot=followShot(cameraMode,currentPose,{distance:followDistance,height:followHeight,active});
  if(['driver','passenger'].includes(cameraMode)){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-cabPitch,cabYaw,0,'YXZ'));const direction=new THREE.Vector3(0,-.06,1).normalize().applyQuaternion(q).applyAxisAngle(new THREE.Vector3(0,1,0),currentPose?.tractor.yaw??0);shot.target.copy(shot.eye).addScaledVector(direction,5);}
  if(!['driver','passenger'].includes(cameraMode))shot.eye=avoidBuildings(shot.eye,shot.target,desert?.cameraBoxes);
  const blend=['driver','passenger'].includes(cameraMode)?1:1-Math.exp(-dt*5);camera.position.lerp(shot.eye,blend);controls.target.lerp(shot.target,blend);
  if(!['driver','passenger'].includes(cameraMode))camera.position.copy(avoidBuildings(camera.position,controls.target,desert?.cameraBoxes));
 }

 if(ready&&(time<loadingDuration||!hasStarted)){for(const door of doorNodes)door.rotation.y=THREE.MathUtils.damp(door.rotation.y,door.userData.manualOpen?(door.name.includes('PASSENGER')?1:-1)*Math.PI*65/180:0,4,dt);}
 const driving=mode==='road'||(hasStarted&&time>=drivingStart);road.visible=false;ground.material.color.set(driving?0x273131:0x112127);
 if(currentPose&&time>=drivingStart){sun.position.copy(currentPose.tractor.position).add(new THREE.Vector3(-8,18,5));sun.target.position.copy(currentPose.tractor.position).add(new THREE.Vector3(0,0,-12));}
 if(assets.has('driver'))assets.get('driver').visible=cameraMode!=='driver'&&time>=loadingDuration&&(hasStarted||mode==='road');
 for(const m of readerMaterials){m.emissive.set(time>=2994/30?0x17d8a0:0xd89522);m.emissiveIntensity=time>=2994/30?.7:.15;}controls.update();camera.updateMatrixWorld();
 const horn=$('#steering-horn');horn.hidden=cameraMode!=='driver'||!ready;
 if(!horn.hidden){const p=new THREE.Vector3(.705,2.36,1.24);tractorTravel.localToWorld(p);camera.updateMatrixWorld();p.project(camera);const rect=renderer.domElement.getBoundingClientRect();horn.style.left=(rect.left+(p.x+1)*rect.width/2)+'px';horn.style.top=(rect.top+(1-p.y)*rect.height/2)+'px';horn.hidden=p.z< -1||p.z>1;}
 for(const side of ['driver','passenger']){const button=$('#seat-'+side),door=doorNodes.find(d=>d.name.includes(side==='driver'?'DRIVER':'PASSENGER'));button.hidden=!ready||hasStarted||['driver','passenger'].includes(cameraMode)||!door||Math.abs(door.rotation.y)<.25;if(button.hidden)continue;const v=new THREE.Vector3(side==='driver'?.705:-.705,2.15,.42);tractorTravel.localToWorld(v);v.project(camera);const rect=renderer.domElement.getBoundingClientRect();button.style.left=(rect.left+(v.x+1)*rect.width/2)+'px';button.style.top=(rect.top+(1-v.y)*rect.height/2)+'px';button.hidden=v.z< -1||v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1;}
 const stamp=camera.matrixWorld.elements.join(',')+'|'+camera.projectionMatrix.elements.join(',')+'|'+time+'|'+mode+'|'+cameraMode+'|'+doorOpen+'|'+doorNodes.map(o=>o.rotation.y).join(',');
 const shadowStamp=[time,mode,loaded,...doorNodes.map(d=>d.rotation.y)].join('|');if(shadowStamp!==renderer.userDataShadowStamp){renderer.shadowMap.needsUpdate=true;renderer.userDataShadowStamp=shadowStamp;}
 if(!ready||playing||stamp!==lastRenderStamp||mirrors?.pending){mirrors?.update(renderer,scene,camera,now);renderer.render(scene,camera);lastRenderStamp=stamp;}
 requestAnimationFrame(tick);
}
$('#play').onclick=()=>{if(!ready)return;ensureSound();if(mode!=='studio'){environment('studio');hasStarted=false;}if(!hasStarted||time>=duration-.1)setTime(0);hasStarted=true;playing=!playing;automatic=cameraMode==='auto';syncCameraControls();doorOpen=false;doorNodes.forEach(d=>d.userData.manualOpen=false);state();};
$('#restart').onclick=()=>{ensureSound();sound.reset();hasStarted=true;lastShot=null;environment('studio');setTime(0);playing=true;automatic=cameraMode==='auto';syncCameraControls();state();};
$('#timeline').oninput=e=>{sound.reset(Number(e.target.value));hasStarted=true;playing=false;environment('studio');setTime(Number(e.target.value));};
$('#camera-auto').onclick=()=>chooseCamera('auto');
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>chooseCamera(b.dataset.camera));
$('#camera-distance').oninput=e=>{followDistance=Number(e.target.value);$('#camera-distance-value').textContent=followDistance+' م';};
$('#camera-height').oninput=e=>{followHeight=Number(e.target.value);$('#camera-height-value').textContent=followHeight+' م';};
$('#camera-reset').onclick=()=>{followDistance=28;followHeight=12;$('#camera-distance').value=28;$('#camera-height').value=12;$('#camera-distance-value').textContent='28 م';$('#camera-height-value').textContent='12 م';chooseCamera('auto');};
$('#camera-panel-toggle').onclick=()=>{const panel=$('#camera-panel'),closed=!panel.hidden;panel.hidden=closed;$('#camera-panel-toggle').setAttribute('aria-expanded',String(!closed));};
document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{if(!ready)return;hasStarted=true;automatic=true;playing=false;environment('studio');setTime(Number(b.dataset.time));});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(!ready)return;chooseCamera(b.dataset.view==='rear'?'rear-far':b.dataset.view);});
document.querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>{if(ready)environment(b.dataset.env);});
async function openCabDoor(side){if(!ready||playing)return;await ensureSound();sound.reset();const door=doorNodes.find(d=>d.name.includes(side==='passenger'?'PASSENGER':'DRIVER'));if(!door)return;const rotations=doorNodes.map(d=>d.rotation.y);playing=false;environment('studio');hasStarted=false;setTime(loadingDuration);doorNodes.forEach((d,i)=>d.rotation.y=rotations[i]);door.userData.manualOpen=!door.userData.manualOpen;doorOpen=doorNodes.some(d=>d.userData.manualOpen);sound.effect(door.userData.manualOpen?'door':'close');chooseCamera('free');$('#door').setAttribute('aria-pressed',String(doorOpen));}
$('#door').onclick=()=>openCabDoor('driver');
$('#retry').onclick=()=>location.reload();
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','A'].includes(document.activeElement.tagName)){e.preventDefault();$('#play').click();}});
// Local QA can observe state without changing application behavior.
window.operationReview={get ready(){return ready},get time(){return time},get loaded(){return loaded},get stats(){return renderer?.info.render},get driverReady(){return assets.has('driver')}};
$('#timeline').max=duration;$('#asset-progress').max=12;boot();



syncCameraControls();

let soundEnabled=false;
$('#sound-toggle').onclick=async()=>{try{await sound.unlock();soundEnabled=!soundEnabled;sound.muted=!soundEnabled;sound.volume(sound.level);$('#sound-toggle').textContent=soundEnabled?'اكتم الصوت':'شغّل الصوت';$('#sound-toggle').setAttribute('aria-pressed',String(soundEnabled));}catch{$('#sound-toggle').textContent='الصوت غير متاح';}};
$('#sound-level').oninput=e=>sound.volume(Number(e.target.value)/100);
let hornHeld=false;
async function ensureSound(){try{if(!sound.ctx){await sound.unlock();soundEnabled=true;}else if(soundEnabled)await sound.unlock();sound.muted=!soundEnabled;sound.volume(sound.level);$('#sound-toggle').textContent=soundEnabled?'اكتم الصوت':'شغّل الصوت';$('#sound-toggle').setAttribute('aria-pressed',String(soundEnabled));}catch{$('#sound-toggle').textContent='الصوت غير متاح';}}
async function hornStart(e){e?.preventDefault();e?.stopPropagation();hornHeld=true;await ensureSound();if(hornHeld&&soundEnabled)sound.horn(true);}
function hornStop(){hornHeld=false;sound.horn(false);}
for(const id of ['#horn-button','#steering-horn']){$(id).addEventListener('pointerdown',hornStart);$(id).addEventListener('pointercancel',hornStop);}
window.addEventListener('pointerup',hornStop);window.addEventListener('blur',()=>{hornStop();sound.reset();if(sound.ctx)sound.ctx.suspend();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){hornStop();sound.reset();if(sound.ctx)sound.ctx.suspend();}});
document.addEventListener('keydown',e=>{if(e.code==='KeyZ'&&!e.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))hornStart(e);});document.addEventListener('keyup',e=>{if(e.code==='KeyZ')hornStop();});

window.addEventListener('focus',()=>{if(soundEnabled&&!document.hidden)sound.unlock().catch(()=>{});});

$('#seat-driver').onclick=()=>chooseCamera('driver');$('#seat-passenger').onclick=()=>chooseCamera('passenger');$('#leave-cab').onclick=()=>{chooseCamera('free');view('overview');};
let cabPointer=null,cabLast=null;const cabRay=new THREE.Raycaster(),canvas=$('#operation-scene');
canvas.addEventListener('pointerdown',e=>{cabPointer={x:e.clientX,y:e.clientY};cabLast=cabPointer;});
canvas.addEventListener('pointermove',e=>{if(!cabPointer||!['driver','passenger'].includes(cameraMode))return;cabYaw=THREE.MathUtils.clamp(cabYaw-(e.clientX-cabLast.x)*.004,-1.4,1.4);cabPitch=THREE.MathUtils.clamp(cabPitch+(e.clientY-cabLast.y)*.004,-.5,.4);cabLast={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{const start=cabPointer;cabPointer=null;if(!start||!ready||playing||['driver','passenger'].includes(cameraMode)||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;const rect=canvas.getBoundingClientRect();cabRay.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const hit=cabRay.intersectObject(root,true).find(h=>h.object.visible);let node=hit?.object;while(node&&!doorNodes.includes(node))node=node.parent;if(node)openCabDoor(node.name.includes('PASSENGER')?'passenger':'driver');});
canvas.addEventListener('pointercancel',()=>cabPointer=null);window.addEventListener('pointerup',()=>cabPointer=null);document.addEventListener('keydown',e=>{if(e.code==='Escape'&&['driver','passenger'].includes(cameraMode))$('#leave-cab').click();});
