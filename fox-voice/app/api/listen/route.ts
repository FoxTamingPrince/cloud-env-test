import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
export async function GET(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin||!await getChatGPTUser())return new Response(null,{status:403});
 if(request.headers.get("upgrade")?.toLowerCase()!=="websocket")return new Response(null,{status:426});
 const c=env as unknown as {FOX_API_BASE:string;FOX_API_KEY:string};
 const response=await fetch(c.FOX_API_BASE.replace(/\/$/,"")+"/realtime?model=fox-local-streaming-asr",{headers:{Upgrade:"websocket",Authorization:`Bearer ${c.FOX_API_KEY}`}});
 // The framework adds headers, so the upstream's immutable headers must be copied.
 return new Response(response.body, {
  status: response.status,
  statusText: response.statusText,
  headers: new Headers(response.headers),
  webSocket: response.webSocket,
 });
}
