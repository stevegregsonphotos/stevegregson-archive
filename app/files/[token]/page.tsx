import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTransferByToken } from "@/lib/transfers/repository";
import TransferDownloadClient from "./TransferDownloadClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title:"Files from Steve Gregson Photography", robots:{index:false,follow:false,noarchive:true} };

export default async function TransferPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const transfer=await getTransferByToken(token);
  if(!transfer) notFound();
  return <TransferDownloadClient transfer={transfer}/>;
}
