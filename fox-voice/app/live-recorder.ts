export async function recordLive(onText:(text:string,final:boolean)=>void,onError:(error:Error)=>void){
 const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
 let context:AudioContext|undefined,source:MediaStreamAudioSourceNode|undefined,processor:ScriptProcessorNode|undefined,silent:GainNode|undefined,ws:WebSocket|undefined,closed=false,ready=false;
 let timer:ReturnType<typeof setTimeout>;
 const stop=()=>{if(closed)return;closed=true;clearTimeout(timer);stream.getTracks().forEach(t=>t.stop());if(processor)processor.onaudioprocess=null;source?.disconnect();processor?.disconnect();silent?.disconnect();void context?.close();ws?.close();};
 const fail=(message:string)=>{if(closed)return;stop();onError(Error(message));};
 try{
  context=new AudioContext({sampleRate:16000});await context.resume();
  ws=new WebSocket(location.origin.replace(/^http/,"ws")+"/api/listen");
  const send=(data:Record<string,unknown>)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({event_id:crypto.randomUUID(),...data}));};
  timer=setTimeout(()=>fail("实时语音连接超时，请重试。"),12000);
  ws.onopen=()=>send({type:"session.update",session:{input_audio_format:"pcm",sample_rate:16000,input_audio_transcription:{language:"zh"},turn_detection:{type:"server_vad",threshold:.3,silence_duration_ms:550}}});
  ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.type==="session.updated"){ready=true;clearTimeout(timer);}else if(d.type==="error")fail("实时语音服务返回错误，请重试。");else if(d.type==="conversation.item.input_audio_transcription.text")onText((d.text||"")+(d.stash||""),false);else if(d.type==="conversation.item.input_audio_transcription.completed"){const t=d.transcript||d.text||"";if(t.trim()){stop();onText(t,true);}}}catch{fail("实时语音响应异常。");}};
  ws.onerror=()=>fail("实时语音连接失败，请重试。");ws.onclose=()=>{if(!closed)fail("实时语音连接断开，请重试。");};
  source=context.createMediaStreamSource(stream);processor=context.createScriptProcessor(2048,1,1);silent=context.createGain();silent.gain.value=0;source.connect(processor);processor.connect(silent);silent.connect(context.destination);
  const rate=context.sampleRate;
  processor.onaudioprocess=e=>{if(!ready||closed)return;if((ws?.bufferedAmount||0)>256000){fail("网络上传较慢，请稍后重试。");return;}const input=e.inputBuffer.getChannelData(0),out=new Uint8Array(Math.floor(input.length*16000/rate)*2),view=new DataView(out.buffer);for(let i=0;i<out.length/2;i++){const v=Math.max(-1,Math.min(1,input[Math.floor(i*rate/16000)]));view.setInt16(i*2,v<0?v*32768:v*32767,true);}send({type:"input_audio_buffer.append",audio:btoa(String.fromCharCode(...out))});};
  return stop;
 }catch(error){stop();throw error;}
}
