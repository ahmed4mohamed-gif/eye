import * as THREE from 'three';
export function followShot(mode,pose,{distance=28,height=12,active=null}={}){
 const origin=pose?.tractor.position??new THREE.Vector3(),yaw=pose?.tractor.yaw??0;
 const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
 let eye,target;
 switch(mode){
 case 'top':eye=new THREE.Vector3(0,Math.max(26,height+22),-11.9);target=new THREE.Vector3(0,0,-12);break;
 case 'rear-close':eye=new THREE.Vector3(0,Math.max(4,height*.5),-30-distance*.32);target=new THREE.Vector3(0,2,-16);break;
 case 'rear-far':eye=new THREE.Vector3(0,height,-30-distance);target=new THREE.Vector3(0,2,-13);break;
 case 'front':eye=new THREE.Vector3(distance*.35,height,10+distance);target=new THREE.Vector3(0,2,-8);break;
 case 'side':eye=new THREE.Vector3(distance,height,-12);target=new THREE.Vector3(0,2,-12);break;
 case 'passenger':eye=new THREE.Vector3(-.705,2.80,.48);target=new THREE.Vector3(-.705,2.53,5);break;
 case 'driver':eye=new THREE.Vector3(.705,2.80,.48);target=new THREE.Vector3(.705,2.53,5);break;
 case 'loading':
  if(active)return {eye:active.clone().add(new THREE.Vector3(9,Math.max(5,height*.6),-9)),target:active.clone().add(new THREE.Vector3(0,.8,0))};
  eye=new THREE.Vector3(11,8,-38);target=new THREE.Vector3(0,2,-23);break;
 default:eye=new THREE.Vector3(distance,height,18);target=new THREE.Vector3(0,2,-12);
 }
 return {eye:eye.applyQuaternion(q).add(origin),target:target.applyQuaternion(q).add(origin)};
}
export function avoidBuildings(eye,target,boxes){
 const delta=eye.clone().sub(target),length=delta.length();if(length<.01)return eye;
 const ray=new THREE.Ray(target,delta.normalize());let nearest=length;const hit=new THREE.Vector3();
 for(const box of boxes??[]){if(box.containsPoint(target))continue;if(ray.intersectBox(box,hit)){const d=target.distanceTo(hit);if(d<nearest)nearest=Math.max(.5,d-.65);}}
 return nearest<length?target.clone().addScaledVector(ray.direction,nearest):eye;
}
export function gateOpening(time,drivingStart,distance){
 const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
 return smooth((time-(drivingStart-5))/4)*(1-smooth((distance-60)/25));
}
