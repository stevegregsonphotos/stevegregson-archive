import { Resend } from "resend";
import type { TransferRecord } from "./types";
import { transferEmail } from "./email-template";
import { personalLink } from "@/lib/recipient-code";

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
  for (const recipient of transfer.recipients) {
    // Each person gets their own link, so their downloads show their address.
    const email = transferEmail(transfer, personalLink(publicUrl, transfer.token, recipient.email));
    const result = await resend.emails.send({
      from: "Steve Gregson Photography <" + from + ">",
      to: recipient.email,
      replyTo: photographerEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
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
export async function sendFirstDownloadNotice(transfer: TransferRecord, adminUrl: string, fileName: string, who?: string) {
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
        "Downloaded by: " + (who || "someone using the link"),
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
