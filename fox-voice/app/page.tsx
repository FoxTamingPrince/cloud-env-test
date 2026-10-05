import FoxClient from "./FoxClient";
import { requireChatGPTUser } from "./chatgpt-auth";
export default async function Page(){await requireChatGPTUser("/");return <FoxClient/>;}
