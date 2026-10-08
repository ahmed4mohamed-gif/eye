// Clone the scene hierarchy and rebind each skin to bones within that clone.
// Mesh geometry, textures and materials remain shared; rig state does not.
export function cloneModel(source){
 const copy=source.clone(true),pairs=new Map();
 function pair(a,b){pairs.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);}
 pair(source,copy);
 source.traverse(original=>{
  if(!original.isSkinnedMesh)return;
  const mesh=pairs.get(original),skeleton=original.skeleton.clone();
  skeleton.bones=original.skeleton.bones.map(bone=>{const cloned=pairs.get(bone);if(!cloned)throw Error('Skin bone outside model: '+bone.name);return cloned;});
  mesh.bind(skeleton,original.bindMatrix.clone());
 });
 copy.updateMatrixWorld(true);return copy;
}
