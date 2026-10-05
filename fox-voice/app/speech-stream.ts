// Queue PCM chunks on a shared audio clock; synthesis continues during playback.
export class SpeechStream {
 private controller=new AbortController();
 private chain=Promise.resolve();
 private error:Error|null=null;
 private sources=new Map<AudioBufferSourceNode,()=>void>();
 private nextAt=0;
 private last=Promise.resolve();
 private cancelled=false;
 private analyser:AnalyserNode;
 private animation=0;
 constructor(private context:AudioContext,private onSpeaking:()=>void,private onMouth:(level:number)=>void){
  this.analyser=context.createAnalyser();this.analyser.fftSize=256;this.analyser.connect(context.destination);
  const samples=new Float32Array(256);let smooth=0;
  const tick=()=>{this.analyser.getFloatTimeDomainData(samples);let sum=0;for(const sample of samples)sum+=sample*sample;const rms=Math.sqrt(sum/samples.length);smooth=smooth*.35+Math.min(1,Math.max(0,(rms-.012)*9))*.65;this.onMouth(context.state==="running"?smooth:0);this.animation=requestAnimationFrame(tick);};tick();
 }
 private closeMeter(){cancelAnimationFrame(this.animation);this.analyser.disconnect();this.onMouth(0);}
 enqueue(text:string){
  if(!text.trim()||this.cancelled)return;
  this.chain=this.chain.then(async()=>{if(!this.cancelled)await this.synthesize(text);}).catch(error=>{this.error=error instanceof Error?error:Error("语音生成失败");this.cancel();});
 }
 cancel(){this.cancelled=true;this.controller.abort();for(const [source,done] of this.sources){try{source.stop();}catch{}done();}this.sources.clear();this.closeMeter();}
 async done(){
  await this.chain;if(this.error)throw this.error;if(this.cancelled)return;
  const remaining=Math.max(0,this.nextAt-this.context.currentTime)*1000;
  let watchdog:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([this.last,new Promise<never>((_,reject)=>{watchdog=setTimeout(()=>{this.cancel();reject(Error("播放已暂停，请点击再听一遍。"));},remaining+5000);})]);}
  finally{if(watchdog)clearTimeout(watchdog);this.closeMeter();}
 }
 private async synthesize(text:string){
  const timeout=setTimeout(()=>this.controller.abort(),45000);
  try{
   const response=await fetch("/api/speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text}),signal:this.controller.signal});
   if(!response.ok){const d=await response.json();throw Error(d.error||"语音暂时不可用。");}
   if(!response.body)throw Error("没有收到语音。");
   const reader=response.body.getReader(),decoder=new TextDecoder();let pending="",complete=false;
   try{while(true){
    const {value,done}=await reader.read();if(this.cancelled)return;
    pending+=decoder.decode(value||new Uint8Array(),{stream:!done});
    const lines=pending.split("\n");pending=lines.pop()||"";
    for(const line of lines){
     if(!line.startsWith("data:"))continue;const data=line.slice(5).trim();if(!data||data==="[DONE]")continue;
     const event=JSON.parse(data);if(event.error)throw Error("语音生成中断，请点击再听一遍。");
     if(event.type==="speech.audio.done")complete=true;
     if(event.type==="speech.audio.delta"&&typeof event.audio==="string")await this.schedule(event.audio);
    }
    if(done||complete)break;
   }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(!complete&&!this.cancelled)throw Error("语音连接中断，请点击再听一遍。");
  }finally{clearTimeout(timeout);}
 }
 private async schedule(base64:string){
  const raw=atob(base64);if(raw.length%2!==0)throw Error("语音数据格式不正确。");
  if(!raw.length)return;
  let resumeTimer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([this.context.resume(),new Promise<never>((_,reject)=>{resumeTimer=setTimeout(()=>reject(Error("请点击狐狸恢复声音播放。")),3000);})]);}finally{if(resumeTimer)clearTimeout(resumeTimer);}
  if(this.cancelled)return;
  if(this.context.state!=="running")throw Error("请点击再听一遍播放声音。");
  const buffer=this.context.createBuffer(1,raw.length/2,24000),pcm=buffer.getChannelData(0);
  for(let i=0;i<pcm.length;i++){let value=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);if(value>=32768)value-=65536;pcm[i]=value/32768;}
  const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.analyser);
  this.last=new Promise<void>(resolve=>{const done=()=>{source.disconnect();this.sources.delete(source);resolve();};this.sources.set(source,done);source.onended=done;});
  const start=Math.max(this.nextAt,this.context.currentTime+.08);source.start(start);this.nextAt=start+buffer.duration;this.onSpeaking();
 }
}
