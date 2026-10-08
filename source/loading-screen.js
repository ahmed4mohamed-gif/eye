export async function finishLoading(renderer,scene,camera){
 const label=document.querySelector('#boot-detail');if(label)label.textContent='بنجهّز الخامات والإضاءة…';
 if(renderer.compileAsync)await renderer.compileAsync(scene,camera);else renderer.compile(scene,camera);
 renderer.render(scene,camera);
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const overlay=document.querySelector('#ain-boot');if(overlay)overlay.hidden=true;
}
export function failLoading(){const label=document.querySelector('#boot-detail');if(label)label.textContent='التجهيز ما كملش. اتأكد إن مجلدات المشروع جنب ملف HTML.';const retry=document.querySelector('#boot-retry');if(retry){retry.hidden=false;retry.onclick=()=>location.reload();}}
