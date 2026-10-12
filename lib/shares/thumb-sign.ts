import { createHmac, timingSafeEqual } from "node:crypto";

// Preview links handed to a client viewing a shared folder. They're signed
// so a preview only works for a photo the client was actually shown (after
// any password check), without the password travelling in the link.

function secret() {
  const value = process.env.BACKSTAGE_SESSION_SECRET?.trim();
  if (!value) throw new Error("BACKSTAGE_SESSION_SECRET is not configured.");
  return value;
}

export function signSharePath(token: string, path: string) {
  return createHmac("sha256", secret()).update("share-thumb|" + token + "|" + path).digest("base64url").slice(0, 22);
}

export function checkSharePath(token: string, path: string, signature: string) {
  const expected = signSharePath(token, path);
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
