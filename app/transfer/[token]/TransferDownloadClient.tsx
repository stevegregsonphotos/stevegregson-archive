"use client";
import { useState } from "react";
import type { TransferRecord } from "@/lib/transfers/types";
import styles from "../../admin/transfers/transfers.module.css";

function bytes(value:number){const units=["B","KB","MB","GB","TB"];let size=value,unit=0;while(size>=1024&&unit<units.length-1){size/=1024;unit+=1}return(size>=10||unit===0?size.toFixed(0):size.toFixed(1))+" "+units[unit]}
function date(value:string){return new Intl.DateTimeFormat("en-GB",{dateStyle:"long",timeZone:"Europe/London"}).format(new Date(value))}

export default function TransferDownloadClient({transfer}:{transfer:TransferRecord}) {
 const [password,setPassword]=useState(""); const [message,setMessage]=useState("");
 async function download(fileId:string){
   setMessage("Preparing download…");
   const response=await fetch("/api/transfers/"+transfer.token+"/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileId,password})});
   const data=await response.json();
   if(!data.ok){setMessage(data.message||"Download unavailable.");return}
   setMessage(""); window.location.assign(data.url);
 }
 const unavailable=transfer.status!=="active";
 return <main className={styles.public}><section className={styles.publicCard}>
   <p className={styles.publicEyebrow}>Steve Gregson Photography</p>
   <h1>{transfer.title}</h1>
   <p className={styles.publicMeta}>{transfer.fileCount} files · {bytes(transfer.totalSizeBytes)} · Available until {date(transfer.expiresAt)}</p>
   {transfer.message&&<p className={styles.publicMessage}>{transfer.message}</p>}
   {unavailable?<p>This transfer is no longer available.</p>:<>
     {transfer.hasPassword&&<label className={styles.publicPassword}><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>}
     <div className={styles.publicFiles}>{transfer.files.map(file=><div className={styles.publicFile} key={file.id}><span>{file.relativePath} · {bytes(file.sizeBytes)}</span><button type="button" onClick={()=>download(file.id)}>Download</button></div>)}</div>
     {message&&<p aria-live="polite">{message}</p>}
   </>}
 </section></main>
}
