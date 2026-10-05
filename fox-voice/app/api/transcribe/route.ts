import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
const headers={"Cache-Control":"no-store"};
const settings=()=>env as unknown as {FOX_API_KEY?:string;FOX_API_BASE?:string};
export async function GET(){return Response.json({ready:Boolean(settings().FOX_API_KEY)},{headers});}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"请刷新页面重试。"},{status:403,headers});
 if(!await getChatGPTUser())return Response.json({error:"请先登录。"},{status:401,headers});
 const key=settings().FOX_API_KEY;
 if(!key)return Response.json({error:"语音服务正在配置，请先用文字聊天。"},{status:503,headers});
 const limit=1400000;
 if(Number(request.headers.get("content-length")||0)>limit)return new Response(null,{status:413,headers});
 let audio:string;
 try{const body=await request.text();if(body.length>limit)throw Error();const data=JSON.parse(body);audio=data.audio;if(typeof audio!=="string"||!/^data:audio\/wav;base64,[A-Za-z0-9+/]+=*$/.test(audio)||audio.length<100)throw Error();}catch{return Response.json({error:"录音格式不正确，请重新说一次。"},{status:400,headers});}
 try{
  const binary=atob(audio.slice(audio.indexOf(",")+1));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const form=new FormData();form.set("model","telecom-qwen-audio-3.0-asr-flash");form.set("response_format","json");form.set("file",new Blob([bytes],{type:"audio/wav"}),"speech.wav");
  const encoded=new Response(form);
  const body=await encoded.arrayBuffer();
  const r=await fetch((settings().FOX_API_BASE||"").replace(/\/$/,"")+"/audio/transcriptions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":encoded.headers.get("content-type")!},body,signal:AbortSignal.timeout(30000)});
  if(!r.ok)console.warn("Fox transcription upstream",r.status,r.headers.get("content-type"));
  if(!r.ok)return Response.json({error:r.status===401||r.status===403?"天翼云语音服务授权失败，请检查服务配置。":r.status===429?"语音服务繁忙或额度不足，请稍后再试。":"语音识别暂不可用，请重试。"},{status:502,headers});
  const data=await r.json() as {text?:string};
  const text=data.text;
  if(typeof text!=="string")throw Error();
  return Response.json({text:text.trim()},{headers});
 }catch{return Response.json({error:"语音识别连接超时，请再试一次。"},{status:502,headers});}
}
