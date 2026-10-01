"use client";

import { useState } from "react";

import {
  parsePastedCredits,
  type PastedCredit,
} from "@/lib/parse-pasted-credits";

type PasteCreditsPanelProps = {
  /** Credits already on the production, so duplicates can be flagged and skipped. */
  existingCredits: { role: string; name: string }[];
  /** Called with the new credits only (duplicates already removed). */
  onAdd: (credits: PastedCredit[]) => void;
  /** Shown after credits are added, e.g. a reminder to save. */
  afterAddHint?: string;
};

export function creditKey(credit: { role: string; name: string }) {
  return `${credit.role.trim().toLowerCase()}::${credit.name.trim().toLowerCase()}`;
}

const mutedText = "rgba(242, 238, 230, 0.55)";

export default function PasteCreditsPanel({
  existingCredits,
  onAdd,
  afterAddHint = "Remember to save.",
}: PasteCreditsPanelProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PastedCredit[] | null>(null);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const existingKeys = new Set(existingCredits.map(creditKey));
  const newRows = (rows ?? []).filter(
    (row) => row.role.trim() && row.name.trim() && !existingKeys.has(creditKey(row)),
  );

  function fillCredits() {
    const result = parsePastedCredits(text);
    setRows(result.credits);
    setUnparsed(result.unparsed);
    setMessage(
      result.credits.length
        ? ""
        : "No credits found. Try one credit per line, for example “Director: Jane Smith”.",
    );
  }

  function updateRow(index: number, field: "role" | "name", value: string) {
    setRows((current) =>
      (current ?? []).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  function removeRow(index: number) {
    setRows((current) => (current ?? []).filter((_, rowIndex) => rowIndex !== index));
  }

  function addToCredits() {
    const seen = new Set<string>();
    const toAdd = newRows
      .map((row) => ({ role: row.role.trim(), name: row.name.trim() }))
      .filter((row) => {
        const key = creditKey(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const skipped = (rows?.length ?? 0) - toAdd.length;

    onAdd(toAdd);
    setRows(null);
    setUnparsed([]);
    setText("");
    setMessage(
      `Added ${toAdd.length} credit${toAdd.length === 1 ? "" : "s"}.${
        skipped > 0 ? ` Skipped ${skipped} already there.` : ""
      } ${afterAddHint}`,
    );
  }

  function clearAll() {
    setRows(null);
    setUnparsed([]);
    setText("");
    setMessage("");
  }

  if (!open) {
    return (
      <div style={{ marginTop: "1.5rem" }}>
        <button
          type="button"
          className="backstage-button"
          onClick={() => setOpen(true)}
        >
          Paste a list of credits
        </button>
        {message ? (
          <p style={{ margin: "0.75rem 0 0", color: mutedText }}>{message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "1.5rem",
        border: "1px solid rgba(242, 238, 230, 0.14)",
        padding: "1.25rem",
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <label className="backstage-field">
        <span className="backstage-field-label">Paste credits</span>
        <span style={{ color: mutedText, fontSize: "0.9rem" }}>
          Paste the creative team from Google, a theatre website or a
          programme. One credit per line works best, but most layouts are
          understood. Nothing changes until you press “Add to credits”.
        </span>
        <textarea
          className="backstage-textarea"
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"Director: Jane Smith\nLighting Designer – Bob Jones\nSet and Costume Design by Cleo Pettitt\nProducers: A Person, B Person and C Person"}
        />
      </label>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <button
          type="button"
          className="backstage-button backstage-button-primary"
          onClick={fillCredits}
          disabled={!text.trim()}
        >
          Fill credits
        </button>
        <button
          type="button"
          className="backstage-button"
          onClick={() => {
            clearAll();
            setOpen(false);
          }}
        >
          Close
        </button>
      </div>

      {message ? (
        <p style={{ margin: "1rem 0 0", color: mutedText }}>{message}</p>
      ) : null}

      {rows && rows.length > 0 ? (
        <div style={{ marginTop: "1.5rem" }}>
          <p className="backstage-field-label" style={{ margin: "0 0 0.75rem" }}>
            Check these before adding ({newRows.length} new)
          </p>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            {rows.map((row, index) => {
              const duplicate = existingKeys.has(creditKey(row));
              return (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(9rem, 0.8fr) minmax(12rem, 1fr) auto",
                    gap: "0.75rem",
                    alignItems: "center",
                    opacity: duplicate ? 0.5 : 1,
                  }}
                >
                  <input
                    className="backstage-input"
                    aria-label="Role"
                    value={row.role}
                    onChange={(event) => updateRow(index, "role", event.target.value)}
                  />
                  <input
                    className="backstage-input"
                    aria-label="Name"
                    value={row.name}
                    onChange={(event) => updateRow(index, "name", event.target.value)}
                  />
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    {duplicate ? (
                      <span style={{ color: mutedText, fontSize: "0.8rem" }}>
                        Already in credits
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="backstage-button"
                      onClick={() => removeRow(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {unparsed.length > 0 ? (
        <div style={{ marginTop: "1.5rem" }}>
          <p className="backstage-field-label" style={{ margin: "0 0 0.5rem", color: "#c7a369" }}>
            Couldn’t understand {unparsed.length} line{unparsed.length === 1 ? "" : "s"} — add these by hand if needed
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: mutedText, lineHeight: 1.7 }}>
            {unparsed.map((line, index) => (
              <li key={index} style={{ whiteSpace: "pre-wrap" }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows && rows.length > 0 ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
          <button
            type="button"
            className="backstage-button backstage-button-primary"
            onClick={addToCredits}
            disabled={newRows.length === 0}
          >
            Add {newRows.length} to credits
          </button>
          <button type="button" className="backstage-button" onClick={clearAll}>
            Start again
          </button>
        </div>
      ) : null}
    </div>
  );
}
