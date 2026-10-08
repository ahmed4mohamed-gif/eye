// Keep full texture resolution; shared maps only need a sampler update once.
export function preserveTextureQuality(root,renderer){
 const anisotropy=renderer.capabilities.getMaxAnisotropy(),seen=new Set();
 root.traverse(o=>{if(!o.isMesh)return;for(const material of Array.isArray(o.material)?o.material:[o.material]){
  if(!material)continue;
  for(const value of Object.values(material))if(value?.isTexture&&!seen.has(value)){seen.add(value);if(value.anisotropy!==anisotropy){value.anisotropy=anisotropy;value.needsUpdate=true;}}
 }});
}
