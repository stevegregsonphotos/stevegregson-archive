import { Resend } from "resend";
import type { TransferRecord } from "./types";

function config() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PROOFING_EMAIL_FROM?.trim();
  const photographerEmail = process.env.PROOFING_PHOTOGRAPHER_EMAIL?.trim();
  if (!apiKey || !from || !photographerEmail) {
    throw new Error("Transfer email configuration is incomplete.");
  }
  return { apiKey, from, photographerEmail };
}

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

export async function sendTransferEmails(transfer: TransferRecord, publicUrl: string) {
  if (process.env.VERCEL_ENV !== "production") {
    return { sent: 0, previewSuppressed: true };
  }

  const { apiKey, from, photographerEmail } = config();
  const resend = new Resend(apiKey);
  let sent = 0;
  const availableUntil = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long", timeZone: "Europe/London",
  }).format(new Date(transfer.expiresAt));

  for (const recipient of transfer.recipients) {
    const result = await resend.emails.send({
      from: "Steve Gregson Photography <" + from + ">",
      to: recipient.email,
      replyTo: photographerEmail,
      subject: "Steve Gregson sent you files — " + transfer.title,
      text: [
        "Steve Gregson sent you files.", "", transfer.title,
        transfer.fileCount + " files · " + bytes(transfer.totalSizeBytes), "",
        transfer.message, "", publicUrl, "", "Available until " + availableUntil + ".",
        "", "Steve Gregson Photography",
      ].filter(Boolean).join("\n"),
      html:
        '<div style="font-family:Arial,sans-serif;color:#171615;line-height:1.65;max-width:620px;margin:auto;">' +
        '<p style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#8b7656;">Steve Gregson Photography</p>' +
        '<h1 style="font-size:32px;font-weight:400;margin:0 0 20px;">Steve Gregson sent you files</h1>' +
        '<p style="font-size:20px;"><strong>' + esc(transfer.title) + '</strong></p>' +
        '<p style="color:#666;">' + transfer.fileCount + " files · " + bytes(transfer.totalSizeBytes) + "</p>" +
        (transfer.message ? "<p>" + esc(transfer.message) + "</p>" : "") +
        '<p style="margin:32px 0;"><a href="' + esc(publicUrl) + '" style="display:inline-block;padding:14px 22px;background:#171615;color:#fff;text-decoration:none;">Get your files</a></p>' +
        '<p style="color:#777;font-size:13px;">Available until ' + availableUntil + ".</p></div>",
    });

    if (result.error) throw new Error("Transfer email to " + recipient.email + " failed: " + result.error.message);
    sent += 1;
  }

  return { sent, previewSuppressed: false };
}
