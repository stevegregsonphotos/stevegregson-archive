import { createHash } from "node:crypto";

// Each person Steve emails gets their own copy of the link with a short code
// on the end (?r=…), so downloads can be credited to the right email address.
// The code is derived from the link and the address, so nothing extra needs
// storing, and it can't be turned back into the email address.

export function recipientCode(token: string, email: string) {
  return createHash("sha256").update(token + "|" + email.trim().toLowerCase()).digest("base64url").slice(0, 12);
}

export function personalLink(url: string, token: string, email: string) {
  return url + (url.includes("?") ? "&" : "?") + "r=" + recipientCode(token, email);
}

/** The recipient's email for a code, or undefined (e.g. the link was copied and shared). */
export function recipientFromCode(token: string, emails: string[], code: unknown) {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{12}$/.test(code)) return undefined;
  return emails.find((email) => recipientCode(token, email) === code);
}
