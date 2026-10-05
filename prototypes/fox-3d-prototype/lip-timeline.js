// Original renderer-independent lip rig controller. Cues must come from alignment
// or a provider's real timestamps; this module does not invent phoneme timing.
export class LipTimeline {
  constructor(audioContext, apply) { this.clock=audioContext; this.apply=apply; this.cues=[]; this.origin=0; this.active=false; this.frame=0; }
  start(cues, scheduledAudioStart) {
    this.stop();
    const valid=['rest','closed','open','wide','round','labiodental'];
    if(!Number.isFinite(scheduledAudioStart)) throw new Error('Audio start time required');
    this.cues=cues.map(c=>{if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||!valid.includes(c.shape))throw new Error('Invalid timestamped mouth cue');return {...c};}).sort((a,b)=>a.start-b.start);
    this.origin=scheduledAudioStart;this.active=true;
    const tick=()=>{if(!this.active)return;const time=this.clock.currentTime-this.origin;
      const weights={rest:1,closed:0,open:0,wide:0,round:0,labiodental:0};
      if(time>=0&&this.clock.state==='running'){
        weights.rest=0;let total=0;for(const cue of this.cues){const fade=.045;if(time<cue.start-fade||time>cue.end+fade)continue;const amount=Math.max(0,Math.min(1,(time-cue.start+fade)/fade,(cue.end+fade-time)/fade));weights[cue.shape]+=amount;total+=amount;}
        if(total>0){for(const key of Object.keys(weights))weights[key]/=total;}else weights.rest=1;
      }
      this.apply(weights);this.frame=requestAnimationFrame(tick);
    };tick();
  }
  stop(){this.active=false;cancelAnimationFrame(this.frame);this.apply({rest:1,closed:0,open:0,wide:0,round:0,labiodental:0});}
}
