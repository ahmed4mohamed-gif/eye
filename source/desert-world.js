import * as THREE from 'three';
import {EXRLoader} from './vendor/EXRLoader.js';
export async function loadDesertWorld(loader,renderer,scene){
 const gltf=await loader.loadAsync('./models/environment/desert-centres.glb');
 const group=gltf.scene;group.name='Desert transport environment';
 group.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=!/terrain|carriageway|pavement|asphalt|lane|boundary|edge/i.test(o.name);}});
 scene.add(group);
 const texture=await new EXRLoader().loadAsync('./environments/qwantani_noon_puresky_4k.exr');
 texture.mapping=THREE.EquirectangularReflectionMapping;
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(texture);pmrem.dispose();
 const route=await (await fetch('./models/environment/route.json')).json();
 const travel=await (await fetch('./models/environment/travel-bake.json')).json();
 group.updateMatrixWorld(true);
 const cameraBoxes=[];
 group.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.some(m=>/^(C-|M-|GAS_STATION(?:\.|$))/.test(m?.name??'')))cameraBoxes.push(new THREE.Box3().setFromObject(o));});
 const gate=group.getObjectByName('GARAGE_SLIDING_GATE');
 const arrivalGate=group.getObjectByName('Arrival_GARAGE_SLIDING_GATE')||group.getObjectByName('Arrival GARAGE_SLIDING_GATE');if(arrivalGate)arrivalGate.userData.closed=arrivalGate.position.clone();
 return {group,texture,environment,route,travel,gate,arrivalGate,cameraBoxes};
}
export function travelPose(travel,time){
 const rows=travel.samples,t=THREE.MathUtils.clamp(time,0,rows.at(-1).t),i=Math.min(rows.length-2,Math.floor(t*10)),a=rows[i],b=rows[i+1];
 const f=THREE.MathUtils.clamp((t-a.t)/(b.t-a.t),0,1),pose={distance:THREE.MathUtils.lerp(a.d,b.d,f)};
 for(const key of ['tractor','trailer']){
  const p=a[key],q=b[key],angle=Math.atan2(Math.sin(q[3]-p[3]),Math.cos(q[3]-p[3]));
  pose[key]={position:new THREE.Vector3(THREE.MathUtils.lerp(p[0],q[0],f),THREE.MathUtils.lerp(p[2],q[2],f),-THREE.MathUtils.lerp(p[1],q[1],f)),yaw:p[3]+angle*f};
 }
 return pose;
}
export function applyTravel(anchor,pose){anchor.position.copy(pose.position);anchor.rotation.set(0,pose.yaw,0);anchor.updateMatrixWorld(true);}

export function updateArrivalGate(world,roadTime){
 if(!world?.arrivalGate)return;const opening=THREE.MathUtils.smoothstep(roadTime,world.route.drivingDuration-12,world.route.drivingDuration-8),yaw=world.route.arrivalYard.rotation_z;
 world.arrivalGate.position.copy(world.arrivalGate.userData.closed).add(new THREE.Vector3(Math.cos(yaw)*15*opening,0,-Math.sin(yaw)*15*opening));
}
