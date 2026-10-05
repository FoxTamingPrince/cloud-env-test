import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
const headers={"Cache-Control":"no-store"};
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return new Response(null,{status:403,headers});
 if(!await getChatGPTUser())return new Response(null,{status:401,headers});
 const c=env as unknown as {FOX_API_BASE?:string;FOX_API_KEY?:string};
 if(!c.FOX_API_BASE||!c.FOX_API_KEY)return Response.json({error:"语音服务尚未配置。"},{status:503,headers});
 let text:string;
 try{if(Number(request.headers.get("content-length")||0)>8000)throw Error();const raw=await request.text();if(raw.length>8000)throw Error();const body=JSON.parse(raw);if(typeof body.text!=="string"||!body.text.trim()||body.text.length>1200)throw Error();text=body.text;}catch{return Response.json({error:"朗读内容过长或格式不正确。"},{status:400,headers});}
 try{
  const result=await fetch(c.FOX_API_BASE.replace(/\/$/,"")+"/audio/speech",{method:"POST",headers:{Authorization:`Bearer ${c.FOX_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"fox-wise-tts",input:text,voice:"Ethan",response_format:"pcm",stream_format:"sse"}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(55000)])});
  if(!result.ok||!result.headers.get("content-type")?.includes("text/event-stream"))return Response.json({error:"专用语音暂时不可用，请稍后点击再听一遍。"},{status:502,headers});
  return new Response(result.body,{headers:{...headers,"Content-Type":"text/event-stream","X-Accel-Buffering":"no"}});
 }catch{return Response.json({error:"语音生成超时，请稍后点击再听一遍。"},{status:502,headers});}
}
