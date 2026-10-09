"use client";
import { useEffect, useState } from "react";
import type { TransferRecord } from "@/lib/transfers/types";
import styles from "../../admin/transfers/transfers.module.css";
import { TRANSFER_BRAND_BACKGROUNDS } from "@/lib/transfers/backgrounds";

function bytes(value:number){const units=["B","KB","MB","GB","TB"];let size=value,unit=0;while(size>=1024&&unit<units.length-1){size/=1024;unit+=1}return(size>=10||unit===0?size.toFixed(0):size.toFixed(1))+" "+units[unit]}
function date(value:string){return new Intl.DateTimeFormat("en-GB",{dateStyle:"long",timeZone:"Europe/London"}).format(new Date(value))}

export default function TransferDownloadClient({transfer}:{transfer:TransferRecord}) {
 const [password,setPassword]=useState(""); const [message,setMessage]=useState(""); const [backgrounds,setBackgrounds]=useState<string[]>([]); const [index,setIndex]=useState(0);
 useEffect(()=>{let cancelled=false;(async()=>{const ids=transfer.backgroundFileIds;const urls:string[]=ids.length?[]:[...TRANSFER_BRAND_BACKGROUNDS];for(const fileId of ids){const response=await fetch("/api/transfers/"+transfer.token+"/background?fileId="+encodeURIComponent(fileId));const data=await response.json().catch(()=>({}));if(data.ok&&data.url)urls.push(data.url)}if(!cancelled)setBackgrounds(urls)})();return()=>{cancelled=true}},[transfer]);
 useEffect(()=>{if(backgrounds.length<2)return;const timer=window.setInterval(()=>setIndex((current)=>(current+1)%backgrounds.length),7000);return()=>window.clearInterval(timer)},[backgrounds.length]);
 async function download(fileId:string){setMessage("Preparing download…");const response=await fetch("/api/transfers/"+transfer.token+"/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileId,password})});const data=await response.json();if(!data.ok){setMessage(data.message||"Download unavailable.");return}setMessage("");window.location.assign(data.url)}
 const unavailable=transfer.status!=="active";
 return <main className={styles.publicShowcase} style={backgrounds[index]?{backgroundImage:"linear-gradient(90deg,rgba(0,0,0,.18),rgba(0,0,0,.05)),url("+backgrounds[index]+")"}:undefined}>
  <div className={styles.publicBrand}><strong>STEVE GREGSON</strong><span>THEATRE & PERFORMANCE PHOTOGRAPHY</span></div>
  <section className={styles.publicFloat}>
   <p className={styles.publicEyebrow}>Steve Gregson · File transfer</p><h1>{transfer.title}</h1>
   <p className={styles.publicMeta}>{transfer.fileCount} {transfer.fileCount===1?"file":"files"} · {bytes(transfer.totalSizeBytes)} · Available until {date(transfer.expiresAt)}</p>
   {transfer.message&&<p className={styles.publicMessage}>{transfer.message}</p>}
   {unavailable?<p>This transfer is no longer available.</p>:<>{transfer.hasPassword&&<label className={styles.publicPassword}><span>Password</span><input type="password" value={password} onChange={(event)=>setPassword(event.target.value)}/></label>}<div className={styles.publicFiles}>{transfer.files.map((file)=><div className={styles.publicFile} key={file.id}><span>{file.relativePath} · {bytes(file.sizeBytes)}</span><button type="button" onClick={()=>download(file.id)}>Download</button></div>)}</div>{message&&<p aria-live="polite">{message}</p>}</>}
  </section>
  {backgrounds.length>1&&<div className={styles.publicDots}>{backgrounds.map((_,i)=><button key={i} aria-label={"Background "+(i+1)} className={i===index?styles.dotActive:""} onClick={()=>setIndex(i)}/>)}</div>}
 </main>
}
