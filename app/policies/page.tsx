import type { Metadata } from "next";
import Link from "next/link";

import styles from "./policies.module.css";

export const metadata: Metadata = {
  title: "Policies | Steve Gregson Photography",
  description:
    "Professional, legal, accessibility and safeguarding policies for Steve Gregson Photography.",
};

const policies = [
  {
    number: "01",
    title: "Privacy Policy",
    description:
      "How personal information is collected, used, stored and protected by Steve Gregson Photography.",
    href: "/policies/privacy",
    meta: "Version 2.0 · August 2026",
  },
  {
    number: "02",
    title: "Terms & Conditions",
    description:
      "The terms governing photography commissions, copyright, licensing, payment and permitted image use.",
    href: "/policies/terms",
    meta: "Version 2.0 · August 2026",
  },
  {
    number: "03",
    title: "Accessibility Statement",
    description:
      "Our commitment to making the Steve Gregson Photography website and archive accessible to as many people as possible.",
    href: "/policies/accessibility",
    meta: "Version 1.0 · August 2026",
  },
  {
    number: "04",
    title: "AI & Content Statement",
    description:
      "How artificial intelligence is used within the archive, and the restrictions applying to the use of our photographs and content.",
    href: "/policies/ai-content",
    meta: "Version 1.0 · August 2026",
  },
  {
    number: "05",
    title: "Safeguarding & Child Protection",
    description:
      "The principles and procedures supporting safe professional work with children and young people.",
    href: "/policies/safeguarding",
    meta: "Version 2.0 · August 2026",
  },
  {
    number: "06",
    title: "Code of Conduct",
    description:
      "The professional standards expected of anyone working on behalf of Steve Gregson Photography with children and young people.",
    href: "/policies/code-of-conduct",
    meta: "Version 2.0 · August 2026",
  },
];

export default function PoliciesPage() {
  return (
    <main className={styles.page}>
      <section className={styles.introduction}>
        <p className={styles.eyebrow}>
          Professional Information
        </p>

        <div className={styles.introductionLayout}>
          <h1>
            Policies,
            <br />
            standards &amp;
            <br />
            professional practice.
          </h1>

          <div className={styles.introductionCopy}>
            <p>
              Steve Gregson Photography is committed
              to maintaining high professional, legal
              and ethical standards across every area
              of its work.
            </p>

            <p>
              The documents below explain how personal
              information is handled, the terms under
              which photography is commissioned and
              licensed, and the standards that support
              our work across theatre, performance and
              education.
            </p>
          </div>
        </div>
      </section>

      <section
        className={styles.policyDirectory}
        aria-label="Policies and professional information"
      >
        {policies.map((policy) => (
          <Link
            href={policy.href}
            className={styles.policy}
            key={policy.href}
          >
            <div className={styles.policyNumber}>
              {policy.number}
            </div>

            <div className={styles.policyMain}>
              <p className={styles.policyMeta}>
                {policy.meta}
              </p>

              <h2>{policy.title}</h2>

              <p className={styles.policyDescription}>
                {policy.description}
              </p>
            </div>

            <div className={styles.policyAction}>
              <span>View document</span>
              <span aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
      </section>

      <section className={styles.contact}>
        <p className={styles.eyebrow}>
          Questions
        </p>

        <div className={styles.contactLayout}>
          <h2>
            Need further
            <br />
            information?
          </h2>

          <div className={styles.contactCopy}>
            <p>
              If you have a question about licensing,
              privacy, safeguarding or any of the
              policies published here, please get in
              touch.
            </p>

            <a href="mailto:info@stevegregson.com">
              <span>info@stevegregson.com</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}