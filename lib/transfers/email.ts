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

export type TransferEmailResult = {
  sent: number;
  failed: string[];
  previewSuppressed: boolean;
};

/**
 * Emails each recipient. Never throws: the transfer is already live when this
 * runs, so failures are reported back for Steve to follow up by copying the link.
 */
export async function sendTransferEmails(transfer: TransferRecord, publicUrl: string): Promise<TransferEmailResult> {
  if (process.env.VERCEL_ENV !== "production") {
    return { sent: 0, failed: [], previewSuppressed: true };
  }

  let settings: ReturnType<typeof config>;
  try {
    settings = config();
  } catch (error) {
    console.error(error);
    return { sent: 0, failed: transfer.recipients.map((r) => r.email), previewSuppressed: false };
  }
  const { apiKey, from, photographerEmail } = settings;
  const resend = new Resend(apiKey);
  let sent = 0;
  const failed: string[] = [];
  const fileSummary = transfer.fileCount + (transfer.fileCount === 1 ? " file" : " files") + " · " + bytes(transfer.totalSizeBytes);
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
        "Steve Gregson sent you files.", "", transfer.title, fileSummary, "",
        ...(transfer.message ? [transfer.message, ""] : []),
        publicUrl, "", "Available until " + availableUntil + ".",
        "", "Steve Gregson Photography",
      ].join("\n"),
      html:
        '<div style="font-family:Arial,sans-serif;color:#171615;line-height:1.65;max-width:620px;margin:auto;">' +
        '<p style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#8b7656;">Steve Gregson Photography</p>' +
        '<h1 style="font-size:32px;font-weight:400;margin:0 0 20px;">Steve Gregson sent you files</h1>' +
        '<p style="font-size:20px;"><strong>' + esc(transfer.title) + '</strong></p>' +
        '<p style="color:#666;">' + fileSummary + "</p>" +
        (transfer.message ? "<p>" + esc(transfer.message) + "</p>" : "") +
        '<p style="margin:32px 0;"><a href="' + esc(publicUrl) + '" style="display:inline-block;padding:14px 22px;background:#171615;color:#fff;text-decoration:none;">Get your files</a></p>' +
        '<p style="color:#777;font-size:13px;">Available until ' + availableUntil + ".</p></div>",
    }).catch((error: unknown) => ({ error: { message: error instanceof Error ? error.message : String(error) } }));

    if (result.error) {
      console.error("Transfer email to " + recipient.email + " failed: " + result.error.message);
      failed.push(recipient.email);
    } else {
      sent += 1;
    }
  }

  return { sent, failed, previewSuppressed: false };
}

/** Tells Steve the first time a client downloads from a transfer. Never throws. */
export async function sendFirstDownloadNotice(transfer: TransferRecord, adminUrl: string, fileName: string) {
  if (process.env.VERCEL_ENV !== "production") return;
  try {
    const { apiKey, from, photographerEmail } = config();
    const when = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long", timeStyle: "short", timeZone: "Europe/London",
    }).format(new Date());
    const result = await new Resend(apiKey).emails.send({
      from: "Steve Gregson Transfers <" + from + ">",
      to: photographerEmail,
      subject: "Downloaded: " + transfer.title,
      text: [
        "Your transfer \"" + transfer.title + "\" has been downloaded for the first time.", "",
        "First file: " + fileName,
        "Sent to: " + transfer.recipients.map((r) => r.email).join(", "),
        "When: " + when, "",
        adminUrl,
      ].join("\n"),
      html:
        '<div style="font-family:Arial,sans-serif;color:#171615;line-height:1.6;max-width:560px;">' +
        "<p>Your transfer <strong>" + esc(transfer.title) + "</strong> has been downloaded for the first time.</p>" +
        '<p style="color:#555;">First file: ' + esc(fileName) + "<br>Sent to: " + esc(transfer.recipients.map((r) => r.email).join(", ")) + "<br>When: " + esc(when) + "</p>" +
        '<p><a href="' + esc(adminUrl) + '">View the transfer in Backstage</a></p></div>',
    });
    if (result.error) console.error("Download notice failed: " + result.error.message);
  } catch (error) {
    console.error("Download notice failed", error);
  }
}
