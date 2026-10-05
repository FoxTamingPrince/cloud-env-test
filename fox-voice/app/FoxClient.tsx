"use client";
import { useEffect, useRef, useState } from "react";
import IllustratedFox from "./IllustratedFox";
import {SpeechStream} from "./speech-stream";
import {recordLive} from "./live-recorder";
import {recordTurn} from "./voice-recorder";
import { Mic, MicOff, PhoneOff, Volume2, Sparkles, Send } from "lucide-react";
type Phase="idle"|"listening"|"thinking"|"speaking";
type Message={role:"user"|"assistant";content:string};
export default function Home(){
 const [phase,setPhase]=useState<Phase>("idle");const [ready,setReady]=useState<boolean|null>(null);const [notice,setNotice]=useState("");const [muted,setMuted]=useState(false);const [lines,setLines]=useState<Message[]>([]);const [draft,setDraft]=useState("");const [heard,setHeard]=useState("");const [supported,setSupported]=useState(true);
 const recorder=useRef<(()=>void)|null>(null);const captureId=useRef(0);const active=useRef(false);const mute=useRef(false);const processing=useRef(false);const history=useRef<Message[]>([]);const generation=useRef(0);const abort=useRef<AbortController|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const audioContext=useRef<AudioContext|null>(null);const stopAudio=useRef<(()=>void)|null>(null);
 const [mouth,setMouth]=useState(0);const [showText,setShowText]=useState(false);
 const realtimeUnavailable=useRef(false);
 const labels={idle:"我在这里，等你开口",listening:"我在听",thinking:"让我想一想…",speaking:"小狐狸正在说话"};
 function stopRecognition(){captureId.current++;recorder.current?.();recorder.current=null;}
 function finish(){active.current=false;generation.current++;processing.current=false;abort.current?.abort();stopRecognition();stopAudio.current?.();if(timer.current)clearTimeout(timer.current);mute.current=false;setMuted(false);setPhase("idle");setHeard("");setMouth(0);}
 async function listen(){
  if(!active.current||mute.current||processing.current)return;
  stopRecognition();const capture=captureId.current;const run=generation.current;
  const fail=(error:Error)=>{if(run!==generation.current||capture!==captureId.current)return;finish();setNotice(error.name==="NotAllowedError"?"请允许麦克风权限后重新开始。":error.message||"无法开启麦克风，请重试。");};
  const current=()=>run===generation.current&&capture===captureId.current&&active.current&&!mute.current;
  const fallback=async()=>{
   if(!current())return;
   realtimeUnavailable.current=true;
   setNotice("实时识别暂不可用，已切换为说完一句后识别。");
   try{
    const stop=await recordTurn(async audio=>{
     if(!current())return;
     recorder.current=null;
     if(!audio){void listen();return;}
     setPhase("thinking");
     const controller=new AbortController();abort.current=controller;
     const deadline=setTimeout(()=>controller.abort(),32000);
     try{
      const r=await fetch("/api/transcribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({audio}),signal:controller.signal});
      const d=await r.json();if(!current())return;
      if(!r.ok)throw Error(d.error||"语音识别暂不可用，请重试。");
      if(typeof d.text!=="string"||!d.text.trim()){void listen();return;}
      void ask(d.text,true);
     }catch(error){if(current())fail(error instanceof Error?error:Error("语音识别失败"));}
     finally{clearTimeout(deadline);if(abort.current===controller)abort.current=null;}
    },fail);
    if(!current()){stop();return;}
    recorder.current=stop;setPhase("listening");
   }catch(error){fail(error instanceof Error?error:Error("无法开启麦克风"));}
  };
  try{
   if(realtimeUnavailable.current){await fallback();return;}
   const stop=await recordLive((text,final)=>{
    if(!current())return;
    setHeard(text);if(final){recorder.current=null;void ask(text,true);}
   },()=>{void fallback();});
   if(!current()){stop();return;}
   recorder.current=stop;setPhase("listening");
  }catch(error){fail(error instanceof Error?error:Error("无法开启麦克风"));}
 }
 function unlockAudio(){if(!audioContext.current)audioContext.current=new AudioContext();void audioContext.current.resume().catch(()=>{});}
 function speechPlayer(run:number){
  const context=audioContext.current;if(!context)throw Error("请点击再听一遍播放声音。");
  const player=new SpeechStream(context,()=>{if(run===generation.current)setPhase("speaking");},level=>{if(run===generation.current)setMouth(level);});
  stopAudio.current=()=>player.cancel();return player;
 }
 async function playSpeech(text:string,run:number){const player=speechPlayer(run);player.enqueue(text);await player.done();}
 async function speak(text:string,run:number){
  setPhase("thinking");setNotice("");
  try{await playSpeech(text,run);}catch(error){if(run===generation.current)setNotice((error as Error).message);}
  finally{if(run===generation.current){processing.current=false;setPhase("idle");if(active.current)timer.current=setTimeout(listen,300);}}
 }
 async function ask(text:string,voice:boolean){
  if(processing.current||!text.trim())return;if(!ready){setNotice("模型服务尚未配置，请稍后刷新。");return;}
  processing.current=true;stopRecognition();stopAudio.current?.();setNotice("");setHeard("");setDraft("");setPhase("thinking");
  const run=generation.current;const messages=[...history.current,{role:"user" as const,content:text}].slice(-20);history.current=messages;setLines([...messages]);
  const controller=new AbortController();abort.current=controller;const deadline=setTimeout(()=>controller.abort(),45000);
  let player:SpeechStream|null=null;
  try{
   if(voice)player=speechPlayer(run);
   const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages}),signal:controller.signal});
   if(!r.ok){const d=await r.json() as {error?:string};throw Error(d.error||"模型暂不可用");}
   if(!r.body)throw Error("没有收到回答");
   const reader=r.body.getReader(),decoder=new TextDecoder();let buffer="",reply="",unsaid="",ended=false;
   try{while(!ended){
    const chunk=await reader.read();if(run!==generation.current){await reader.cancel();return;}
    buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});
    const lines=buffer.split("\n");buffer=lines.pop()||"";
    for(const line of lines){if(!line.startsWith("data:"))continue;const data=line.slice(5).trim();if(data==="[DONE]"){ended=true;continue;}
     if(!data)continue;const event=JSON.parse(data);if(event.error)throw Error("模型回答中断，请重试。");
     const delta=event.choices?.[0]?.delta?.content;if(typeof delta!=="string")continue;
     reply+=delta;unsaid+=delta;setLines([...messages,{role:"assistant",content:reply}]);
     let split=unsaid.search(/[。！？!?；;\n]/);
     if(split<0&&unsaid.length>=24)split=unsaid.search(/[，,：:]/);
     if(split<0&&unsaid.length>=90)split=89;
     while(split>=0){player?.enqueue(unsaid.slice(0,split+1));unsaid=unsaid.slice(split+1);split=unsaid.search(/[。！？!?；;\n]/);}

    }
    if(chunk.done){if(!ended)throw Error("回答连接中断，请重试。");break;}
   }}finally{reader.releaseLock();}
   if(!reply.trim())throw Error("模型没有返回回答，请重试。");
   history.current=[...messages,{role:"assistant",content:reply}];clearTimeout(deadline);
   player?.enqueue(unsaid);await player?.done();if(run!==generation.current)return;
   processing.current=false;setPhase(active.current?"listening":"idle");if(active.current)timer.current=setTimeout(listen,150);
  }
  catch(e){player?.cancel();if(run!==generation.current)return;processing.current=false;setPhase(active.current?"listening":"idle");setNotice((e as Error).name==="AbortError"?"这次回答等待超时，请再试一次。":(e as Error).message);if(active.current)timer.current=setTimeout(listen,400);}
  finally{clearTimeout(deadline);if(abort.current===controller)abort.current=null;}
 }
 function begin(){unlockAudio();if(!ready){setNotice("模型服务尚未配置，请稍后刷新。");return;}if(processing.current)return;setNotice("");active.current=true;mute.current=false;setMuted(false);listen();}
 function toggleMute(){mute.current=!mute.current;setMuted(mute.current);if(mute.current)stopRecognition();else listen();}
 useEffect(()=>{setSupported(Boolean(navigator.mediaDevices?.getUserMedia&&window.AudioContext));fetch("/api/chat",{cache:"no-store"}).then(r=>r.json()).then(d=>setReady((d as {ready?:boolean}).ready===true)).catch(()=>{setReady(false);setNotice("无法连接服务，请刷新重试。");});const hide=()=>finish();window.addEventListener("pagehide",hide);return()=>{finish();void audioContext.current?.close();audioContext.current=null;window.removeEventListener("pagehide",hide);};},[]);
 useEffect(()=>{const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>|void}}).modelContext;if(!context)return;const lifecycle=new AbortController();Promise.resolve(context.registerTool({name:"end_fox_voice_chat",description:"结束小狐狸语音通话并关闭听写和播放。",inputSchema:{type:"object",properties:{},additionalProperties:false},execute(input:unknown){if(!input||typeof input!=="object"||Object.keys(input).length)throw new Error("No arguments expected");finish();return{ended:true};}},{signal:lifecycle.signal})).catch(()=>{});return()=>lifecycle.abort();},[]);
 const lastAnswer=[...lines].reverse().find(l=>l.role==="assistant");
 function interrupt(){generation.current++;abort.current?.abort();stopAudio.current?.();processing.current=false;setMouth(0);setPhase("idle");if(active.current)void listen();}
 return <main className="fox-home">
  <header><span className="brand">小狐狸</span><button className="quiet-button" onClick={()=>setShowText(v=>!v)} aria-expanded={showText}>聊天记录</button></header>
  <section className="conversation" aria-label="小狐狸语音聊天">
   <button className={`scene ${phase}`} aria-label={phase==="speaking"?"打断狐狸，继续说话":"小狐狸"} onClick={()=>{unlockAudio();if(processing.current)interrupt();else if(!active.current)begin();}}>
    <span className="halo" aria-hidden="true"/>
    <IllustratedFox speaking={phase==="speaking"} level={mouth} listening={phase==="listening"}/>
   </button>
   <div className="status" role="status">{muted&&active.current?"麦克风已静音":phase==="speaking"?"点我，可以打断":labels[phase]}</div>
   <div className="live-caption" aria-live="polite">{heard||(phase==="speaking"||phase==="thinking"?lastAnswer?.content:"")}</div>
   {notice&&<p className="notice" role="alert">{notice}</p>}
   {!supported&&<p className="notice">请用支持麦克风的 Chrome 或 Safari 打开。</p>}
   <div className="controls">{!active.current?<button className="primary" onClick={begin} disabled={ready===null||phase!=="idle"||!supported}><Mic size={20}/>{ready===null?"连接中…":"和我说话"}</button>:<><button className="secondary" onClick={toggleMute} aria-label={muted?"打开麦克风":"静音麦克风"}>{muted?<MicOff size={21}/>:<Mic size={21}/>}</button><button className="end" onClick={finish} aria-label="结束聊天"><PhoneOff size={19}/></button></>}{processing.current&&<button className="secondary" onClick={interrupt} aria-label="停止回答">停止</button>}</div>
   <form className="text-entry" onSubmit={e=>{e.preventDefault();unlockAudio();void ask(draft,true);}}><input aria-label="打字聊天" placeholder="也可以悄悄打字…" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000}/><button aria-label="发送" disabled={!draft.trim()||phase==="thinking"||phase==="speaking"||!ready}><Send size={17}/></button></form>
  </section>
  {showText&&<section className="transcript" aria-label="聊天记录"><h2>刚刚聊到</h2>{lines.length?lines.map((l,i)=><p key={i}><b>{l.role==="user"?"你":"小狐狸"}</b><span>{l.content}</span></p>):<p>我们的故事，从你开口开始。</p>}{lastAnswer&&<button className="play" disabled={phase==="thinking"||phase==="speaking"} onClick={()=>{unlockAudio();processing.current=true;stopRecognition();void speak(lastAnswer.content,generation.current);}}><Volume2 size={18}/>再听一遍</button>}</section>}
  <footer><details><summary>关于这段陪伴</summary><p>回答由狐狸平台生成，百炼合成语音。实时识别在你的 Mac 上运行，不可用时由天翼云识别。本站不保存录音。嘴型跟随声音强弱变化。</p></details></footer>
 </main>;
}
