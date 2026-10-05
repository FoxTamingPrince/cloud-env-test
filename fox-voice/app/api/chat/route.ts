import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
type Settings={FOX_API_BASE?:string;FOX_API_KEY?:string;FOX_MODEL?:string};
const settings=()=>env as unknown as Settings;
const headers={"Cache-Control":"no-store"};
export async function GET(){const c=settings();return Response.json({ready:Boolean(c.FOX_API_BASE&&c.FOX_API_KEY)},{headers});}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"请求来源不匹配，请刷新重试。"},{status:403,headers});
 const user=await getChatGPTUser();if(!user)return Response.json({error:"请先登录后再开始聊天。"},{status:401,headers});
 const c=settings();if(!c.FOX_API_KEY||!c.FOX_API_BASE)return Response.json({error:"狐狸大模型服务尚未配置。"},{status:503,headers});
 if(Number(request.headers.get("content-length")||0)>24000)return new Response(null,{status:413,headers});
 let messages:{role:"user"|"assistant";content:string}[];
 try{const text=await request.text();if(text.length>24000)throw new Error();const d=JSON.parse(text);if(!Array.isArray(d.messages)||!d.messages.length||d.messages.length>20)throw new Error();messages=d.messages.map((m:Record<string,unknown>)=>{if(!m||!["user","assistant"].includes(String(m.role))||typeof m.content!=="string"||m.content.length>2500||!m.content.trim())throw new Error();return {role:m.role as "user"|"assistant",content:m.content};});if(messages.at(-1)?.role!=="user")throw new Error();}catch{return Response.json({error:"消息过长或格式不正确。"},{status:400,headers});}
 try{
  const upstream=await fetch(c.FOX_API_BASE.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${c.FOX_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:c.FOX_MODEL||"bailian1-qwen-flash",messages:[{role:"system",content:"你是小狐狸，一位受《小王子》启发的AI语音伙伴。你的气质温暖、沉静、聪慧、有阅历，偶尔有轻巧的幽默。先听懂用户的具体处境与感受，再帮助他看清关键事实、取舍或可行的下一步。保持独立判断，不一味附和；发现误解时温和具体地说明。智慧体现在贴切的洞察，不是说教、空泛鸡汤、堆砌比喻或故作高深。不要每次都追问；只有缺失的信息影响回答时，才问一个必要的问题。自然地用中文交流，通常一至三句，适合直接朗读；用户要求详细说明时可以展开。不要用Markdown、列表或表情符号。不要称呼用户为人类。不声称自己是真实生物，不编造现实感官、已完成的行动或永久记忆。不确定就坦诚说明，区分事实与推测。"},...messages.slice(-8)],max_tokens:180,...(c.FOX_MODEL==="fox-local-qwen3.5-9b"?{reasoning_effort:"none"}:{}),...(c.FOX_MODEL?.includes("qwen")?{enable_thinking:false}:{}),stream:true}),signal:AbortSignal.timeout(40000)});
  if(!upstream.ok)return Response.json({error:upstream.status===429?"平台额度不足或请求过多，请稍后再试。":upstream.status===401?"平台密钥无效，请更新配置。":"模型服务暂时无法回答，请稍后再试。"},{status:upstream.status>=500?502:upstream.status,headers});
  if(!upstream.body)throw new Error("Missing stream");
  return new Response(upstream.body,{headers:{...headers,"Content-Type":"text/event-stream","X-Accel-Buffering":"no"}});
 }catch(error){console.warn("Fox upstream error",error instanceof Error ? error.name+": "+error.message.replace(/sk-[A-Za-z0-9_-]+/g,"[redacted]") : "unknown");return Response.json({error:"等待模型回答超时或服务暂不可用，请重试。"},{status:502,headers});}
}
