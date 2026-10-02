"use client";

import { useState } from "react";

import ProductionPageEditor from "./ProductionPageEditor";
import SelectedWorkEditor from "./SelectedWorkEditor";

import styles from "./production-page-editor.module.css";

type Tab = "page" | "library";

export default function SelectedWorkAdminTabs() {
  const [tab, setTab] = useState<Tab>("page");

  function choose(next: Tab) {
    setTab(next);
  }

  return (
    <div style={{ marginTop: "3rem" }}>
      <div role="tablist" aria-label="Selected Work sections" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "page"}
          className={tab === "page" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => choose("page")}
        >
          Production page &amp; Commissions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "library"}
          className={tab === "library" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => choose("library")}
        >
          Photo library
        </button>
      </div>

      {tab === "page" ? (
        <ProductionPageEditor />
      ) : (
        <>
          <p className={styles.intro}>
            The photo library holds uploaded photographs. Its Rehearsal and Campaign lists still feed the
            Rehearsals and Marketing &amp; PR pages. To put a library photograph on the Selected Work page,
            upload it here, then use “Add photograph” on the first tab.
          </p>
          <SelectedWorkEditor />
        </>
      )}
    </div>
  );
}
