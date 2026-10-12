import { Resend } from "resend";
import type { StorageShare } from "./repository";
import { personalLink } from "@/lib/recipient-code";
import { TRANSFER_BRAND_BACKGROUNDS } from "@/lib/transfers/backgrounds";

const SITE = "https://www.stevegregson.com";

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

/** The link a client is given for a shared folder. */
export function shareLink(token: string, requestUrl: string) {
  return process.env.VERCEL_ENV === "production"
    ? "https://transfers.stevegregson.com/shared/" + token
    : new URL(requestUrl).origin + "/transfer/shared/" + token;
}

export function shareEmail(share: StorageShare, url: string) {
  const subject = "Steve Gregson shared a folder with you — " + share.title;
  const cover = SITE + TRANSFER_BRAND_BACKGROUNDS[0];
  const logo = SITE + "/images/branding/steve-gregson-logo-white.png";
  const message = share.message.trim();
  const link = esc(url);

  const text = [
    "STEVE GREGSON PHOTOGRAPHY", "",
    "Steve Gregson shared a folder with you",
    share.title, "",
    ...(message ? [message, ""] : []),
    "Open the folder:", url, "",
    "This link stays the same. Anything Steve adds to the folder will appear there, ready to download whenever you need it.",
    ...(share.hasPassword ? ["", "The folder is password protected. Steve will send you the password separately."] : []),
    "", "When sharing these images, please credit: Photography: Steve Gregson (with a link to stevegregson.com).",
    "", "Steve Gregson · Theatre & Performance Photography", "stevegregson.com",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(subject)}</title>
<style>@media (max-width:620px){.sg-pad{padding-left:24px!important;padding-right:24px!important}.sg-title{font-size:30px!important;line-height:36px!important}}a{color:#c7a369}</style>
</head>
<body style="margin:0;padding:0;background:#0b0a0a;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0b0a0a;">Your folder of photographs from Steve Gregson, ready whenever you need it.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0a0a;"><tr><td align="center" style="padding:32px 12px 40px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141211;border:1px solid #2a2622;">
<tr><td class="sg-pad" style="padding:32px 44px 26px;"><a href="${SITE}" style="text-decoration:none;"><img src="${logo}" width="150" alt="Steve Gregson Photography" style="display:block;width:150px;height:auto;border:0;color:#f4efe6;font-family:Georgia,serif;font-size:20px;"></a></td></tr>
<tr><td style="padding:0;"><a href="${link}" style="text-decoration:none;"><img src="${cover}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#1d1a17;"></a></td></tr>
<tr><td class="sg-pad" style="padding:38px 44px 8px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 14px;color:#c7a369;font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;">Steve Gregson shared a folder with you</p>
<h1 class="sg-title" style="margin:0 0 16px;color:#f4efe6;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:44px;font-weight:normal;">${esc(share.title)}</h1>
<p style="margin:0;color:#a69c90;font-size:14px;line-height:22px;">This link stays the same. Anything Steve adds to the folder appears there, ready to download whenever you need it.</p>
</td></tr>
${message ? `<tr><td class="sg-pad" style="padding:26px 44px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:2px solid #c7a369;padding:2px 0 2px 18px;color:#e6dfd4;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:27px;">${esc(message).replace(/\r?\n/g, "<br>")}</td></tr></table></td></tr>` : ""}
<tr><td class="sg-pad" style="padding:34px 44px 10px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" bgcolor="#c7a369" style="background:#c7a369;border-radius:6px;"><a href="${link}" style="display:block;padding:17px 28px;color:#16120c;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;letter-spacing:0.3px;">Open the folder &rarr;</a></td></tr></table>
${share.hasPassword ? `<p style="margin:16px 0 0;color:#a69c90;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;">&#128274; This folder is password protected. Steve will send you the password separately.</p>` : ""}
<p style="margin:16px 0 0;color:#6f675e;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">Worth bookmarking. Button not working? Copy this link into your browser:<br><a href="${link}" style="color:#a69c90;word-break:break-all;">${link}</a></p>
</td></tr>
<tr><td class="sg-pad" style="padding:30px 44px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #2a2622;"><tr><td style="padding:22px 0 0;color:#a69c90;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;">When sharing these images, please credit<br><span style="color:#f4efe6;">Photography: Steve Gregson</span> with a link to <a href="${SITE}" style="color:#c7a369;text-decoration:none;">stevegregson.com</a></td></tr></table></td></tr>
<tr><td class="sg-pad" style="padding:30px 44px 34px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0;color:#f4efe6;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Steve Gregson</p>
<p style="margin:4px 0 0;color:#6f675e;font-size:12px;line-height:18px;">Theatre &amp; Performance Photography · <a href="${SITE}" style="color:#6f675e;text-decoration:none;">stevegregson.com</a></p>
<p style="margin:12px 0 0;color:#6f675e;font-size:12px;line-height:18px;">Questions? Just reply to this email.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  return { subject, text, html };
}

/** Emails each address its own link. Never throws; reports who it couldn't reach. */
export async function sendShareEmails(share: StorageShare, url: string, to: string[]) {
  if (process.env.VERCEL_ENV !== "production") return { sent: 0, failed: [] as string[], previewSuppressed: true };
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PROOFING_EMAIL_FROM?.trim();
  const replyTo = process.env.PROOFING_PHOTOGRAPHER_EMAIL?.trim();
  if (!apiKey || !from || !replyTo) return { sent: 0, failed: to, previewSuppressed: false };
  const resend = new Resend(apiKey);
  let sent = 0;
  const failed: string[] = [];
  for (const email of to) {
    const content = shareEmail(share, personalLink(url, share.token, email));
    const result = await resend.emails.send({
      from: "Steve Gregson Photography <" + from + ">",
      to: email, replyTo, subject: content.subject, text: content.text, html: content.html,
    }).catch((error: unknown) => ({ error: { message: error instanceof Error ? error.message : String(error) } }));
    if (result.error) { console.error("Share email to " + email + " failed: " + result.error.message); failed.push(email); }
    else sent += 1;
  }
  return { sent, failed, previewSuppressed: false };
}
