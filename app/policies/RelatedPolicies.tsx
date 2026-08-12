import Link from "next/link";

import styles from "./policy-document.module.css";

export default function RelatedPolicies() {
  return (
    <section className={styles.relatedPolicies}>
      <p className={styles.eyebrow}>
        Related policies
      </p>

      <nav aria-label="Related policies">
        <Link href="/policies/privacy">
          <span>Privacy Policy</span>
          <span aria-hidden="true">→</span>
        </Link>

        <Link href="/policies/terms">
          <span>Terms &amp; Conditions</span>
          <span aria-hidden="true">→</span>
        </Link>

        <Link href="/policies/accessibility">
          <span>Accessibility Statement</span>
          <span aria-hidden="true">→</span>
        </Link>

        <Link href="/policies/ai-content">
          <span>AI &amp; Content Statement</span>
          <span aria-hidden="true">→</span>
        </Link>

        <Link href="/policies/safeguarding">
          <span>Safeguarding Policy</span>
          <span aria-hidden="true">→</span>
        </Link>

        <Link href="/policies/code-of-conduct">
          <span>Code of Conduct</span>
          <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </section>
  );
}
