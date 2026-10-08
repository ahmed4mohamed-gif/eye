// Evaluate ended clips once; a rewind or seek always resamples the new time.
const sampled=new WeakMap();
export function sampleMixer(mixer,time){
 const target=Math.min(time,mixer.userDataEnd??Infinity);
 if(sampled.get(mixer)===target)return false;
 mixer.setTime(target);sampled.set(mixer,target);return true;
}
