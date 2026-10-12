"use client";

export type AdminShare = {
  id: string;
  token: string;
  path: string;
  title: string;
  message: string;
  recipients: string[];
  hasPassword: boolean;
  createdAt: string;
  lastActivityAt?: string;
  downloads: number;
  link: string;
};

export type AdminShareEvent = {
  id: string;
  recipientEmail?: string;
  eventType: "open" | "file" | "folder";
  path: string;
  fileCount?: number;
  createdAt: string;
};

export type EmailResult = { sent: number; failed: string[]; previewSuppressed: boolean } | null;

export async function shareApi<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ ok: false, message: "Unexpected response (HTTP " + response.status + ")." }));
  if (!data.ok) throw new Error(data.message || "Something went wrong.");
  return data as T;
}

export function describeEmail(email: EmailResult) {
  if (!email) return "";
  if (email.previewSuppressed) return " (This is the test site, so no email was sent.)";
  if (email.failed.length) return " Couldn't email " + email.failed.join(", ") + " — copy the link and send it yourself.";
  return email.sent ? " Emailed " + email.sent + (email.sent === 1 ? " person." : " people.") : "";
}

export function when(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(value));
}
