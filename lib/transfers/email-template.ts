// The email a client receives when Steve sends files. Built from tables with
// inline styles so it looks right in Apple Mail, Gmail and Outlook alike.

import type { TransferRecord } from "./types";

const SITE = "https://www.stevegregson.com";

function esc(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function formatBytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return (size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)) + " " + units[unit];
}

export function transferEmail(transfer: TransferRecord, publicUrl: string, site = SITE) {
  const files = transfer.fileCount + (transfer.fileCount === 1 ? " file" : " files");
  const size = formatBytes(transfer.totalSizeBytes);
  const until = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })
    .format(new Date(transfer.expiresAt));
  const cover = site + "/api/transfers/" + encodeURIComponent(transfer.token) + "/cover";
  const logo = site + "/images/branding/steve-gregson-logo-white.png";
  const message = transfer.message.trim();
  const url = esc(publicUrl);

  const subject = "Steve Gregson sent you files — " + transfer.title;
  const preheader = files + " · " + size + " · available until " + until;

  const text = [
    "STEVE GREGSON PHOTOGRAPHY",
    "",
    "Steve Gregson sent you files",
    transfer.title,
    files + " · " + size + " · Available until " + until,
    "",
    ...(message ? [message, ""] : []),
    "View and download your files:",
    publicUrl,
    ...(transfer.hasPassword ? ["", "This transfer is password protected. Steve will send you the password separately."] : []),
    "",
    "When sharing these images, please credit: Photography: Steve Gregson (with a link to stevegregson.com).",
    "",
    "Steve Gregson · Theatre & Performance Photography",
    "stevegregson.com",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(subject)}</title>
<style>
  @media (max-width: 620px) {
    .sg-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .sg-title { font-size: 30px !important; line-height: 36px !important; }
    .sg-btn a { display: block !important; }
  }
  a { color: #c7a369; }
</style>
</head>
<body style="margin:0;padding:0;background:#0b0a0a;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0b0a0a;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0a0a;">
  <tr>
    <td align="center" style="padding:32px 12px 40px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141211;border:1px solid #2a2622;">

        <!-- Logo -->
        <tr>
          <td class="sg-pad" style="padding:32px 44px 26px;">
            <a href="${SITE}" style="text-decoration:none;"><img src="${logo}" width="150" alt="Steve Gregson Photography" style="display:block;width:150px;height:auto;border:0;color:#f4efe6;font-family:Georgia,serif;font-size:20px;"></a>
          </td>
        </tr>

        <!-- Cover photograph -->
        <tr>
          <td style="padding:0;">
            <a href="${url}" style="text-decoration:none;"><img src="${cover}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#1d1a17;"></a>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td class="sg-pad" style="padding:38px 44px 8px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 14px;color:#c7a369;font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;">Steve Gregson sent you files</p>
            <h1 class="sg-title" style="margin:0 0 16px;color:#f4efe6;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:44px;font-weight:normal;">${esc(transfer.title)}</h1>
            <p style="margin:0;color:#a69c90;font-size:14px;line-height:22px;">${esc(files)} &nbsp;·&nbsp; ${esc(size)} &nbsp;·&nbsp; Available until ${esc(until)}</p>
          </td>
        </tr>

        ${message ? `<!-- Message -->
        <tr>
          <td class="sg-pad" style="padding:26px 44px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-left:2px solid #c7a369;padding:2px 0 2px 18px;color:#e6dfd4;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:27px;">${esc(message).replace(/\r?\n/g, "<br>")}</td>
              </tr>
            </table>
          </td>
        </tr>` : ""}

        <!-- Button -->
        <tr>
          <td class="sg-pad" style="padding:34px 44px 10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="sg-btn" width="100%">
              <tr>
                <td align="center" bgcolor="#c7a369" style="background:#c7a369;border-radius:6px;">
                  <a href="${url}" style="display:block;padding:17px 28px;color:#16120c;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;letter-spacing:0.3px;">View &amp; download your files &rarr;</a>
                </td>
              </tr>
            </table>
            ${transfer.hasPassword ? `<p style="margin:16px 0 0;color:#a69c90;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;">&#128274; This transfer is password protected. Steve will send you the password separately.</p>` : ""}
            <p style="margin:16px 0 0;color:#6f675e;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">Button not working? Copy this link into your browser:<br><a href="${url}" style="color:#a69c90;word-break:break-all;">${url}</a></p>
          </td>
        </tr>

        <!-- Credit -->
        <tr>
          <td class="sg-pad" style="padding:30px 44px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #2a2622;">
              <tr>
                <td style="padding:22px 0 0;color:#a69c90;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;">
                  When sharing these images, please credit<br>
                  <span style="color:#f4efe6;">Photography: Steve Gregson</span> with a link to <a href="${SITE}" style="color:#c7a369;text-decoration:none;">stevegregson.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="sg-pad" style="padding:30px 44px 34px;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0;color:#f4efe6;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Steve Gregson</p>
            <p style="margin:4px 0 0;color:#6f675e;font-size:12px;line-height:18px;">Theatre &amp; Performance Photography · <a href="${SITE}" style="color:#6f675e;text-decoration:none;">stevegregson.com</a></p>
            <p style="margin:12px 0 0;color:#6f675e;font-size:12px;line-height:18px;">Questions? Just reply to this email.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
