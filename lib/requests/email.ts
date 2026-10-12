import { Resend } from "resend";
import type { FileRequest } from "./repository";

const SITE = "https://www.stevegregson.com";

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function settings() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PROOFING_EMAIL_FROM?.trim();
  const steve = process.env.PROOFING_PHOTOGRAPHER_EMAIL?.trim();
  return apiKey && from && steve ? { apiKey, from, steve } : undefined;
}

export function requestLink(token: string, requestUrl: string) {
  return process.env.VERCEL_ENV === "production"
    ? "https://transfers.stevegregson.com/request/" + token
    : new URL(requestUrl).origin + "/transfer/request/" + token;
}

/** Emails the client the upload link. Never throws. */
export async function sendFileRequestEmail(request: FileRequest, url: string) {
  if (!request.recipientEmail) return { sent: 0, failed: [] as string[], previewSuppressed: false };
  if (process.env.VERCEL_ENV !== "production") return { sent: 0, failed: [] as string[], previewSuppressed: true };
  const config = settings();
  if (!config) return { sent: 0, failed: [request.recipientEmail], previewSuppressed: false };
  const until = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(request.expiresAt));
  const subject = "Steve Gregson has asked you to send files — " + request.title;
  const message = request.message.trim();
  const link = esc(url);
  const text = [
    "STEVE GREGSON PHOTOGRAPHY", "", "Steve Gregson has asked you to send files", request.title, "",
    ...(message ? [message, ""] : []),
    "Upload your files here:", url, "", "The link works until " + until + ".", "",
    "Steve Gregson · Theatre & Performance Photography", "stevegregson.com",
  ].join("\n");
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#0b0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0a0a;"><tr><td align="center" style="padding:32px 12px 40px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141211;border:1px solid #2a2622;">
<tr><td style="padding:32px 44px 8px;"><img src="${SITE}/images/branding/steve-gregson-logo-white.png" width="150" alt="Steve Gregson Photography" style="display:block;width:150px;height:auto;border:0;"></td></tr>
<tr><td style="padding:30px 44px 8px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 14px;color:#c7a369;font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;">Steve Gregson has asked you to send files</p>
<h1 style="margin:0 0 14px;color:#f4efe6;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:40px;font-weight:normal;">${esc(request.title)}</h1>
<p style="margin:0;color:#a69c90;font-size:14px;line-height:22px;">The upload link works until ${esc(until)}.</p></td></tr>
${message ? `<tr><td style="padding:22px 44px 0;"><div style="border-left:2px solid #c7a369;padding:2px 0 2px 18px;color:#e6dfd4;font-family:Georgia,serif;font-size:17px;line-height:27px;">${esc(message).replace(/\r?\n/g, "<br>")}</div></td></tr>` : ""}
<tr><td style="padding:30px 44px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#c7a369" style="background:#c7a369;border-radius:6px;"><a href="${link}" style="display:block;padding:17px 28px;color:#16120c;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;">Upload your files &rarr;</a></td></tr></table>
<p style="margin:16px 0 0;color:#6f675e;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">Button not working? Copy this link into your browser:<br><a href="${link}" style="color:#a69c90;word-break:break-all;">${link}</a></p></td></tr>
<tr><td style="padding:28px 44px 34px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0;color:#f4efe6;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Steve Gregson</p><p style="margin:4px 0 0;color:#6f675e;font-size:12px;">Theatre &amp; Performance Photography · <a href="${SITE}" style="color:#6f675e;text-decoration:none;">stevegregson.com</a> · Questions? Just reply.</p></td></tr>
</table></td></tr></table></body></html>`;
  try {
    const result = await new Resend(config.apiKey).emails.send({
      from: "Steve Gregson Photography <" + config.from + ">", to: request.recipientEmail, replyTo: config.steve, subject, text, html,
    });
    if (result.error) throw new Error(result.error.message);
    return { sent: 1, failed: [] as string[], previewSuppressed: false };
  } catch (error) {
    console.error("File request email failed", error);
    return { sent: 0, failed: [request.recipientEmail], previewSuppressed: false };
  }
}

/** Tells Steve that someone has sent him files. Never throws. */
export async function sendFilesReceivedNotice(request: FileRequest, upload: { name: string; email?: string; count: number; bytes: string; folder: string }) {
  if (process.env.VERCEL_ENV !== "production") return;
  const config = settings();
  if (!config) return;
  try {
    const storageUrl = SITE + "/admin/storage";
    await new Resend(config.apiKey).emails.send({
      from: "Steve Gregson Transfers <" + config.from + ">",
      to: config.steve,
      ...(upload.email ? { replyTo: upload.email } : {}),
      subject: "Files received: " + request.title + " (from " + upload.name + ")",
      text: [upload.name + (upload.email ? " (" + upload.email + ")" : "") + " sent " + upload.count + " files (" + upload.bytes + ") for \"" + request.title + "\".", "",
        "They're in Storage › " + upload.folder, "", storageUrl].join("\n"),
      html: '<div style="font-family:Arial,sans-serif;color:#171615;line-height:1.6;max-width:560px;"><p><strong>' + esc(upload.name) + "</strong>" +
        (upload.email ? " (" + esc(upload.email) + ")" : "") + " sent " + upload.count + " files (" + esc(upload.bytes) + ") for <strong>" + esc(request.title) + "</strong>.</p>" +
        '<p style="color:#555;">They&rsquo;re in Storage › ' + esc(upload.folder.split("/").join(" › ")) + '</p><p><a href="' + storageUrl + '">Open Storage</a></p></div>',
    });
  } catch (error) {
    console.error("Files received notice failed", error);
  }
}
