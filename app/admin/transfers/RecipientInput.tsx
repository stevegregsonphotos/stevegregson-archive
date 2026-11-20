"use client";

import { useId, useMemo, useRef, useState } from "react";
import styles from "./workspace.module.css";

/**
 * "Email to" box that suggests addresses Steve has sent to before.
 * Several addresses can be typed, separated by commas; suggestions are for
 * the one currently being typed. Tab or Enter picks the highlighted one.
 * After a pick (Enter or click) the list closes and stays closed, and Enter
 * moves on to the next box (Title), so a second Enter never adds someone
 * else's address. The list only opens again when Steve types.
 */
export default function RecipientInput({
  value,
  onChange,
  knownEmails,
  onDone,
}: {
  value: string;
  onChange: (value: string) => void;
  knownEmails: string[];
  /** Called after an address is picked with Enter, or Enter on a finished address. */
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const listId = useId();

  // The address being typed is whatever comes after the last separator.
  const cut = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"), value.lastIndexOf("\n"));
  const typed = value.slice(cut + 1).trim().toLowerCase();

  const suggestions = useMemo(() => {
    const already = new Set(
      value.split(/[,;\n]/).map((part) => part.trim().toLowerCase()).filter(Boolean),
    );
    const fresh = knownEmails.filter((email) => !already.has(email) || email === typed);
    if (!typed) return fresh.slice(0, 6);
    const starts = fresh.filter((email) => email.startsWith(typed) || email.split("@")[1]?.startsWith(typed));
    const contains = fresh.filter((email) => !starts.includes(email) && email.includes(typed));
    return [...starts, ...contains].filter((email) => email !== typed).slice(0, 6);
  }, [knownEmails, typed, value]);

  const showing = open && suggestions.length > 0;
  const highlighted = Math.min(active, suggestions.length - 1);

  function pick(email: string) {
    const before = cut >= 0 ? value.slice(0, cut + 1).replace(/\s*$/, " ") : "";
    onChange(before + email);
    setActive(0);
    setOpen(false);
  }

  // Move on to the next box (Title): the parent's onDone, else the next input on the page.
  function moveOn() {
    setOpen(false);
    if (onDone) { onDone(); return; }
    const input = inputRef.current;
    if (!input) return;
    const all = Array.from(document.querySelectorAll<HTMLElement>("input, textarea, select"));
    const next = all[all.indexOf(input) + 1];
    next?.focus();
  }

  return (
    <div className={styles.suggestWrap}>
      <input
        inputMode="email"
        autoComplete="off"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        ref={inputRef}
        value={value}
        placeholder="client@example.com"
        onFocus={() => { if (!value.trim()) setOpen(true); }}
        onBlur={() => setOpen(false)}
        onChange={(event) => { onChange(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (!showing) {
            // List closed: Enter means "done with this box".
            if (event.key === "Enter") { event.preventDefault(); moveOn(); }
            else if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setOpen(true); }
            return;
          }
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((highlighted + 1) % suggestions.length); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setActive((highlighted - 1 + suggestions.length) % suggestions.length); }
          else if ((event.key === "Enter" || (event.key === "Tab" && typed)) && suggestions[highlighted]) {
            event.preventDefault();
            pick(suggestions[highlighted]);
            if (event.key === "Enter") moveOn();
          } else if (event.key === "Escape") setOpen(false);
        }}
      />
      {showing ? (
        <ul id={listId} role="listbox" className={styles.suggestList}>
          {!typed ? <li className={styles.suggestHeading} aria-hidden="true">Recently sent to</li> : null}
          {suggestions.map((email, index) => (
            <li
              key={email}
              role="option"
              aria-selected={index === highlighted}
              className={index === highlighted ? styles.suggestActive : undefined}
              // mousedown, so the pick happens before the box loses focus
              onMouseDown={(event) => { event.preventDefault(); pick(email); }}
              onMouseEnter={() => setActive(index)}
            >
              {email}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
