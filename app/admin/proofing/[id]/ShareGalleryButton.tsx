"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/*
 * Share Gallery: always clickable. Opens a panel with the gallery link (to
 * copy) and who it'll be emailed to — add saved contacts or any email
 * address right there, then send. Opens by itself with ?share=1 (the
 * galleries list's "Share gallery" links here).
 */

type Recipient = { id: string; name?: string; company?: string; email: string };
type Contact = { id: string; name: string; email: string; company?: string };
type Pending = { key: string; contactId?: string; name?: string; company?: string; email: string };

type ShareGalleryButtonProps = {
  galleryId: string;
  galleryTitle: string;
  galleryUrl: string;
  isLive: boolean;
  recipients: Recipient[];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/admin/proofing/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!response.ok || !data.ok) throw new Error(data.message || "Gallery could not be shared.");
  return data;
}

export default function ShareGalleryButton({
  galleryId,
  galleryTitle,
  galleryUrl,
  isLive,
  recipients,
}: ShareGalleryButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchParams.get("share") !== "1") return;
    const timer = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    if (!open) return;
    if (contacts === null) {
      post<{ contacts: Contact[] }>({ galleryId, action: "contacts" })
        .then((data) => setContacts(data.contacts))
        .catch(() => setContacts([]));
    }
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, contacts, galleryId]);

  const taken = useMemo(
    () => new Set([...recipients, ...pending].map((r) => r.email.toLowerCase())),
    [recipients, pending],
  );
  const clean = query.trim().toLowerCase();
  const suggestions = useMemo(
    () =>
      clean
        ? (contacts ?? [])
            .filter((c) => !taken.has(c.email.toLowerCase()))
            .filter((c) => [c.name, c.email, c.company ?? ""].some((v) => v.toLowerCase().includes(clean)))
            .slice(0, 6)
        : [],
    [contacts, clean, taken],
  );
  const canAddEmail = EMAIL.test(clean) && !taken.has(clean) && !suggestions.some((c) => c.email.toLowerCase() === clean);
  const total = recipients.length + pending.length;

  function add(person: Omit<Pending, "key">) {
    setPending((current) => [...current, { ...person, key: person.contactId || person.email }]);
    setQuery("");
    setMessage(null);
    input.current?.focus();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(galleryUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      input.current?.blur();
      setMessage({ tone: "bad", text: "Couldn't copy — select the link and copy it instead." });
    }
  }

  async function send() {
    if (!total || sending) return;
    setSending(true);
    setMessage(null);
    try {
      const result = await post<{ sent?: number; message?: string }>({
        galleryId,
        add: pending.map((p) => (p.contactId ? { contactId: p.contactId } : { email: p.email })),
      });
      setPending([]);
      setMessage({ tone: "good", text: "✓ " + (result.message || "Gallery sent.") });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "Gallery could not be shared." });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" className="sp-gallery-share-link" onClick={() => { setOpen(true); setMessage(null); }}>
        Share Gallery
      </button>

      {open ? (
        <div className="sp-share-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="sp-share-panel" role="dialog" aria-modal="true" aria-label={"Share " + galleryTitle}>
            <div className="sp-share-head">
              <h2>Share {galleryTitle}</h2>
              <button type="button" className="sp-share-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>

            <p className="sp-share-label">Gallery link</p>
            <div className="sp-share-link-row">
              <input readOnly value={galleryUrl} onFocus={(event) => event.currentTarget.select()} aria-label="Gallery link" />
              <button type="button" onClick={() => void copyLink()}>{copied ? "Copied ✓" : "Copy link"}</button>
            </div>

            <p className="sp-share-label">Email it to</p>
            <div className="sp-share-people">
              {recipients.map((r) => (
                <span key={r.id} className="sp-share-chip">
                  {r.name ? <strong>{r.name}</strong> : null}
                  <span>{r.email}</span>
                </span>
              ))}
              {pending.map((p) => (
                <span key={p.key} className="sp-share-chip is-new">
                  {p.name ? <strong>{p.name}</strong> : null}
                  <span>{p.email}</span>
                  <button type="button" aria-label={"Remove " + p.email} onClick={() => setPending((c) => c.filter((x) => x.key !== p.key))}>×</button>
                </span>
              ))}
              {!total ? <span className="sp-share-empty">Nobody yet — add someone below.</span> : null}
            </div>

            <div className="sp-share-add">
              <input
                ref={input}
                value={query}
                autoFocus
                placeholder="Type a name or email address"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (suggestions[0]) add({ contactId: suggestions[0].id, name: suggestions[0].name, company: suggestions[0].company, email: suggestions[0].email });
                  else if (canAddEmail) add({ email: clean });
                }}
                aria-label="Add a recipient"
              />
              {suggestions.length || canAddEmail ? (
                <div className="sp-share-suggestions" role="listbox">
                  {suggestions.map((c) => (
                    <button key={c.id} type="button" role="option" aria-selected={false} onClick={() => add({ contactId: c.id, name: c.name, company: c.company, email: c.email })}>
                      <strong>{c.name}</strong>
                      <span>{c.company ? c.company + " · " : ""}{c.email}</span>
                    </button>
                  ))}
                  {canAddEmail ? (
                    <button type="button" role="option" aria-selected={false} onClick={() => add({ email: clean })}>
                      <strong>Add {clean}</strong>
                      <span>Send to this address</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!isLive ? <p className="sp-share-note">This gallery isn&apos;t live yet. Make it live in Settings before sending, or visitors won&apos;t get in.</p> : null}
            {message ? <p className={"sp-share-message is-" + message.tone}>{message.text}</p> : null}

            <div className="sp-share-actions">
              <button type="button" className="sp-share-cancel" onClick={() => setOpen(false)}>Close</button>
              <button type="button" className="sp-share-send" disabled={!total || sending} onClick={() => void send()}>
                {sending ? "Sending…" : total ? `Send to ${total} ${total === 1 ? "person" : "people"}` : "Add someone to send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
