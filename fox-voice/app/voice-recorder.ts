// Capture only a spoken turn, then release the microphone before playback.
export async function recordTurn(onAudio:(audio:string)=>void,onError:(error:Error)=>void){
 const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
 let context:AudioContext;
 try{context=new AudioContext({sampleRate:16000});await context.resume();}
 catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
 const source=context.createMediaStreamSource(stream);
 const processor=context.createScriptProcessor(2048,1,1);
 const silent=context.createGain();silent.gain.value=0;
 source.connect(processor);processor.connect(silent);silent.connect(context.destination);
 let closed=false,spoken=false,lastVoice=performance.now(),count=0;
 const started=performance.now();const chunks:Float32Array[]=[];
 const stop=()=>{if(closed)return;closed=true;processor.onaudioprocess=null;source.disconnect();processor.disconnect();silent.disconnect();stream.getTracks().forEach(t=>t.stop());void context.close();};
 processor.onaudioprocess=e=>{
  if(closed)return;
  const samples=new Float32Array(e.inputBuffer.getChannelData(0));
  const rms=Math.sqrt(samples.reduce((a,v)=>a+v*v,0)/samples.length);
  const now=performance.now();
  if(rms>.015){spoken=true;lastVoice=now;}
  chunks.push(samples);count+=samples.length;
  if(!spoken&&now-started>15000){stop();onAudio("");return;}
  if((spoken&&now-lastVoice>550&&now-started>700)||now-started>28000){
   const rate=context.sampleRate;stop();
   try{
    const pcm=new Float32Array(count);let p=0;for(const chunk of chunks){pcm.set(chunk,p);p+=chunk.length;}
    const length=Math.floor(pcm.length*16000/rate);const bytes=new Uint8Array(44+length*2);const view=new DataView(bytes.buffer);
    const str=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
    str(0,"RIFF");view.setUint32(4,36+length*2,true);str(8,"WAVE");str(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,"data");view.setUint32(40,length*2,true);
    for(let i=0;i<length;i++){const v=Math.max(-1,Math.min(1,pcm[Math.min(pcm.length-1,Math.floor(i*rate/16000))]));view.setInt16(44+i*2,v<0?v*32768:v*32767,true);}
    let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    onAudio("data:audio/wav;base64,"+btoa(binary));
   }catch(error){onError(error instanceof Error?error:Error("录音处理失败"));}
  }
 };
 return stop;
}
