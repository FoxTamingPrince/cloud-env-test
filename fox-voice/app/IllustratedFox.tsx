"use client";
import {useEffect,useRef} from "react";
type Props={speaking:boolean;level:number;listening:boolean};
export default function IllustratedFox({speaking,level,listening}:Props){
 const frame=useRef<HTMLIFrameElement>(null);
 const send=()=>frame.current?.contentWindow?.postMessage({type:"fox-mouth",level,speaking},window.location.origin);
 useEffect(()=>{send();},[speaking,level]);
 return <span className={`illustrated-fox ${listening?"attentive":""}`}>
 <iframe ref={frame} src="/fox-relief/index.html" title="麦田里的水彩狐狸" tabIndex={-1} onLoad={send}/>
 </span>;
}
