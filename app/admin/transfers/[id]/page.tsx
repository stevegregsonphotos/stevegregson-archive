import Link from "next/link";
import { notFound } from "next/navigation";
import { getTransferById } from "@/lib/transfers/repository";
import styles from "../transfers.module.css";

export const dynamic = "force-dynamic";

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"]; let size=value, unit=0;
  while(size>=1024&&unit<units.length-1){size/=1024;unit+=1}
  return (size>=10||unit===0?size.toFixed(0):size.toFixed(1))+" "+units[unit];
}
function date(value:string){return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/London"}).format(new Date(value))}

export default async function TransferDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const transfer=await getTransferById(id);
  if(!transfer) notFound();
  return <main className={styles.detail}>
    <Link className={styles.detailBack} href="/admin/transfers">← Transfers</Link>
    <h1>{transfer.title}</h1>
    <p className={styles.detailMeta}>{transfer.recipients.map(r=>r.email).join(", ")} · {bytes(transfer.totalSizeBytes)} · {transfer.fileCount} files · {transfer.status}</p>
    <div className={styles.detailGrid}>
      <section className={styles.detailPanel}>
        <h2>Files</h2>
        {transfer.files.map(file=><div className={styles.fileRow} key={file.id}><span>{file.relativePath}</span><span>{bytes(file.sizeBytes)}</span></div>)}
      </section>
      <section className={styles.detailPanel}>
        <h2>Activity</h2>
        <div className={styles.eventRow}><span>Sent</span><span>{date(transfer.finalizedAt||transfer.createdAt)}</span></div>
        <div className={styles.eventRow}><span>Expires</span><span>{date(transfer.expiresAt)}</span></div>
        {transfer.downloads.map(event=><div className={styles.eventRow} key={event.id}><span>{event.eventType==="all"?"Transfer downloaded":"File downloaded"}{event.recipientEmail?" · "+event.recipientEmail:""}</span><span>{date(event.createdAt)}</span></div>)}
        {!transfer.downloads.length&&<p>No downloads yet.</p>}
      </section>
    </div>
  </main>;
}
