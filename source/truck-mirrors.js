import * as THREE from 'three';
import {mirrorSurfaces} from './mirror-surfaces.js';
const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
export function reflectedPose(eye,forward,up,point,normal){
 const reflectPoint=p=>p.clone().addScaledVector(normal,-2*p.clone().sub(point).dot(normal));
 return {eye:reflectPoint(eye),target:reflectPoint(eye.clone().add(forward)),up:up.clone().reflect(normal)};
}
export class TruckMirrors {
 constructor(truck,anchor){this.groups=[];this.meshes=[];this.last=-Infinity;truck.updateMatrixWorld(true);anchor.updateMatrixWorld(true);
  for(const side of [-1,1]){const target=new THREE.WebGLRenderTarget(768,768,{type:THREE.HalfFloatType,depthBuffer:true});const matrix=new THREE.Matrix4();const meshes=[];
   for(const def of mirrorSurfaces.filter(d=>d.side===side)){let parent;truck.traverse(o=>{if(o.userData.name===def.parent||o.name===THREE.PropertyBinding.sanitizeNodeName(def.parent))parent=o;});if(!parent)continue;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(def.positions,3));geometry.setIndex(def.indices);geometry.computeBoundingSphere();
    const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{reflection:{value:target.texture},projection:{value:matrix}},vertexShader:'uniform mat4 projection; varying vec4 mirrorUV; void main(){vec4 world=modelMatrix*vec4(position,1.);mirrorUV=projection*world;gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:'uniform sampler2D reflection; varying vec4 mirrorUV; void main(){gl_FragColor=texture2DProj(reflection,mirrorUV);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Live_mirror_'+side+'_'+def.part;anchor.add(mesh);parent.attach(mesh);mesh.castShadow=false;mesh.receiveShadow=false;meshes.push({mesh,def});this.meshes.push(mesh);
   }
   if(meshes.length)this.groups.push({target,matrix,meshes,camera:new THREE.PerspectiveCamera()});else target.dispose();
  }
 }
 update(renderer,scene,camera,now){if(now-this.last<100){this.pending=true;return false;}this.pending=false;this.last=now;scene.updateMatrixWorld(true);camera.updateMatrixWorld();
  const eye=camera.getWorldPosition(new THREE.Vector3()),forward=camera.getWorldDirection(new THREE.Vector3()),up=new THREE.Vector3(0,1,0).transformDirection(camera.matrixWorld),frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));let changed=false;
  for(const group of this.groups){const first=group.meshes[0],point=new THREE.Vector3(...first.def.center).applyMatrix4(first.mesh.matrixWorld),normal=new THREE.Vector3(...first.def.normal).transformDirection(first.mesh.matrixWorld);
   if(eye.distanceTo(point)>14||eye.clone().sub(point).dot(normal)<=0||!group.meshes.some(({mesh})=>frustum.intersectsObject(mesh)))continue;
   const pose=reflectedPose(eye,forward,up,point,normal),virtual=group.camera;virtual.position.copy(pose.eye);virtual.up.copy(pose.up);virtual.lookAt(pose.target);virtual.near=camera.near;virtual.far=camera.far;virtual.projectionMatrix.copy(camera.projectionMatrix);virtual.updateMatrixWorld();
   // Oblique near clipping excludes objects between the virtual eye and the mirror.
   const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,point).applyMatrix4(virtual.matrixWorldInverse),clip=new THREE.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant),p=virtual.projectionMatrix.elements,q=new THREE.Vector4((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);clip.multiplyScalar(2/clip.dot(q));p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1-.003;p[14]=clip.w;virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();
   group.matrix.copy(bias).multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);
   const oldTarget=renderer.getRenderTarget(),oldAuto=renderer.shadowMap.autoUpdate,oldNeeds=renderer.shadowMap.needsUpdate,visibility=this.meshes.map(m=>m.visible);
   try{this.meshes.forEach(m=>m.visible=false);renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setRenderTarget(group.target);renderer.clear();renderer.render(scene,virtual);changed=true;}finally{renderer.setRenderTarget(oldTarget);renderer.shadowMap.autoUpdate=oldAuto;renderer.shadowMap.needsUpdate=oldNeeds;this.meshes.forEach((m,i)=>m.visible=visibility[i]);}
  }
  return changed;
 }
 dispose(){for(const group of this.groups){group.target.dispose();for(const {mesh} of group.meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}}this.groups=[];this.meshes=[];}
}
