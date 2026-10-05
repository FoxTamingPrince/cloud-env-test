import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"小狐狸 · 和你说说话",description:"与你的小王子水彩狐狸语音聊天。",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>;}
