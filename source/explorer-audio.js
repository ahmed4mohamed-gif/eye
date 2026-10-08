import {SceneAudio} from './scene-audio.js';
export function installExplorerAudio(scene,button){
 const sound=new SceneAudio();let held=false;
 async function start(e){e?.preventDefault();held=true;try{await sound.unlock();if(held)sound.horn(true);}catch{held=false;button.title='الصوت مش متاح في المتصفح';}}
 function stop(){held=false;sound.horn(false);}
 button.addEventListener('pointerdown',start);button.addEventListener('pointercancel',stop);
 button.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)&&!e.repeat)start(e)});
 button.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code))stop()});
 window.addEventListener('pointerup',stop);window.addEventListener('blur',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 document.addEventListener('keydown',e=>{const target=e.target;if(e.code==='KeyZ'&&!e.repeat&&!target?.isContentEditable&&!['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))start(e)});
 document.addEventListener('keyup',e=>{if(e.code==='KeyZ')stop()});
 return {sound,stop};
}
