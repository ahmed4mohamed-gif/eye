// Local effects only. Engine/exhaust synthesis intentionally removed.
export class SceneAudio {
 constructor(){this.level=.4;this.muted=false;this.previous=null;this.wasPlaying=false;this.voices=[];}
 async unlock(){
  if(!this.ctx){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw Error('Web Audio unavailable');this.ctx=new C();const c=this.ctx;
   this.master=c.createGain();this.master.connect(c.destination);this.master.gain.value=this.level;
   this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const a=this.noise.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
   this.hornA=this.tone(310);this.hornB=this.tone(390);
   this.wind=this.noiseLoop(300,.45);this.hydraulic=this.noiseLoop(750,1.1);
  }
  await this.ctx.resume();this.volume(this.level);
 }
 tone(freq){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.value=0;o.connect(g).connect(this.master);o.start();return {o,g};}
 noiseLoop(freq,q){const o=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain();o.buffer=this.noise;o.loop=true;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=q;g.gain.value=0;o.connect(filter).connect(g).connect(this.master);o.start();return {o,g,filter};}
 volume(v){this.level=v;if(this.ctx)this.master.gain.setTargetAtTime(this.muted?0:v,this.ctx.currentTime,.025);}
 horn(on){if(!this.ctx)return;for(const v of [this.hornA,this.hornB])v.g.gain.setTargetAtTime(on?.085:0,this.ctx.currentTime,.015);}
 track(o,nodes){this.voices.push(o);o.onended=()=>{o.disconnect();for(const n of nodes)n.disconnect();this.voices=this.voices.filter(v=>v!==o)};}
 impact(delay,duration,frequency,gain){const c=this.ctx,t=c.currentTime+delay,o=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();o.buffer=this.noise;f.type='lowpass';f.frequency.value=frequency;g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(gain,t+.005);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(f).connect(g).connect(this.master);this.track(o,[f,g]);o.start(t);o.stop(t+duration+.02);}
 effect(kind){if(!this.ctx||this.muted)return;
  if(kind==='door'){this.impact(0,.055,2400,.18);this.impact(.075,.16,650,.13);return;}
  if(kind==='close'){this.impact(0,.19,180,.65);this.impact(.035,.065,1900,.18);return;}
  if(kind!=='beep'&&kind!=='success')return;
  const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.frequency.value=kind==='success'?1450:1000;g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.035,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.13);o.connect(g).connect(this.master);this.track(o,[g]);o.start();o.stop(t+.15);
 }
 stopEffects(){for(const o of [...this.voices])try{o.stop()}catch{}this.voices=[];}
 reset(time=null){this.previous=time;this.wasPlaying=false;this.stopEffects();if(this.ctx)this.hydraulic.g.gain.setTargetAtTime(0,this.ctx.currentTime,.025);}
 update({time,playing,driver,speed=0,hydraulicMoving=false}){
  if(!this.ctx)return;const delta=this.previous===null?0:time-this.previous;
  const jump=this.previous!==null&&(delta<0||delta>.4),paused=this.wasPlaying&&!playing;
  if(jump||paused)this.stopEffects();
  if(playing&&this.wasPlaying&&!jump&&delta>0){for(const [at,kind] of [[2369/30,'door'],[2849/30,'close'],[2939/30,'beep'],[2994/30,'success']])if(this.previous<at&&time>=at)this.effect(kind);}
  this.previous=time;this.wasPlaying=playing;
  this.hydraulic.g.gain.setTargetAtTime(playing&&!jump&&hydraulicMoving?(driver?.025:.085):0,this.ctx.currentTime,.045);
  this.wind.g.gain.setTargetAtTime((driver?.012:.022)+(playing?Math.min(speed,30)*.0005:0),this.ctx.currentTime,.2);
 }
}
