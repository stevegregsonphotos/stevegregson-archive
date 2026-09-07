import type { Metadata } from "next";
import Link from "next/link";
import RelatedPolicies from "../RelatedPolicies";

import styles from "../policy-document.module.css";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  alternates: {
    canonical: "/policies/accessibility",
  },
  description:
    "Our commitment to accessible design and inclusive access across the Steve Gregson Photography website and archive.",
};

export default function AccessibilityPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <Link
          href="/policies"
          className={styles.backLink}
        >
          <span aria-hidden="true">←</span>
          <span>Policies</span>
        </Link>

        <p className={styles.eyebrow}>
          Professional Information
        </p>

        <div className={styles.heroLayout}>
<div>
  <p className={styles.documentTitle}>
    Accessibility Statement
  </p>

  <h1>
    Accessible Design
    <br />
    &amp; Inclusive Access
  </h1>
</div>
          <div className={styles.documentMeta}>
            <div>
              <span>Version</span>
              <strong>1.0</strong>
            </div>

            <div>
              <span>Last reviewed</span>
              <strong>7 September 2026</strong>
            </div>

            <div>
              <span>Effective from</span>
              <strong>11 August 2026</strong>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.documentLayout}>
        <aside className={styles.documentSidebar}>
  <p>Accessibility Statement</p>

  <nav aria-label="Accessibility Statement sections">
    <a href="#commitment">
      01 · Our commitment
    </a>

    <a href="#design">
      02 · Designing for accessibility
    </a>

    <a href="#photographic-content">
      03 · Photographic content
    </a>

    <a href="#browser-compatibility">
      04 · Browser compatibility
    </a>

    <a href="#limitations">
      05 · Known limitations
    </a>

    <a href="#feedback">
      06 · Feedback
    </a>

    <a href="#contact">
      07 · Contact
    </a>

    <a href="#improvement">
      08 · Continuous improvement
    </a>
  </nav>
</aside>

        <article className={styles.document}>
          <section className={styles.opening}>
  <p>
    Accessibility is considered throughout the
    design, development and ongoing maintenance
    of this archive.
  </p>

  <p>
    This statement explains the standards we aim
    to achieve and how visitors can request
    assistance if they experience difficulty
    using the website.
  </p>
</section>

<PolicySection
  id="commitment"
  number="01"
  title="Our Commitment"
>
  <p>
    Steve Gregson Photography is committed to
    making this website as accessible and
    inclusive as reasonably possible.
  </p>

  <p>
    The aim is to ensure that visitors can access
    and enjoy the archive regardless of age,
    experience or ability.
  </p>

  <p>
    Accessibility is considered throughout the
    design, development and ongoing maintenance
    of this website.
  </p>
</PolicySection>

<PolicySection
  id="design"
  number="02"
  title="Designing for Accessibility"
>
  <p>
    When developing this website we have sought to:
  </p>

  <ul>
    <li>use clear and consistent navigation;</li>
    <li>maintain readable typography;</li>
    <li>
      provide sufficient colour contrast wherever
      practical;
    </li>
    <li>
      ensure pages remain usable across desktop,
      tablet and mobile devices;
    </li>
    <li>
      support keyboard navigation where
      appropriate;
    </li>
    <li>
      provide meaningful alternative text for
      photographs wherever practical;
    </li>
    <li>
      use semantic HTML to improve compatibility
      with assistive technologies;
    </li>
    <li>
      avoid unnecessary animation or effects that
      may reduce usability; and
    </li>
    <li>
      keep page layouts clear, simple and
      predictable.
    </li>
  </ul>
</PolicySection>

<PolicySection
  id="photographic-content"
  number="03"
  title="Photographic Content"
>
  <p>
    This website is primarily a photographic
    archive.
  </p>

  <p>
    While every effort is made to provide
    meaningful descriptions for images, some
    historic photographs may have limited
    contextual information available.
  </p>

  <p>
    Alternative text is generated using a
    combination of automated tools and editorial
    review. While every effort is made to ensure
    descriptions are accurate and useful, they
    may occasionally contain errors or omissions.
    If you encounter an inaccurate description,
    please let us know so it can be corrected.
  </p>
</PolicySection>

<PolicySection
  id="browser-compatibility"
  number="04"
  title="Browser Compatibility"
>
  <p>
    The website is designed to work with current
    versions of all major modern browsers.
  </p>

  <p>
    Older browsers may not display all features
    correctly.
  </p>
</PolicySection>

<PolicySection
  id="limitations"
  number="05"
  title="Known Limitations"
>
  <p>
    Despite ongoing efforts, some parts of the
    website may not yet achieve the desired
    accessibility standard.
  </p>

  <p>Examples may include:</p>

  <ul>
    <li>
      historic archive material where complete
      descriptive information is unavailable;
    </li>
    <li>
      third-party content beyond the control of
      Steve Gregson Photography; and
    </li>
    <li>
      external websites linked from this archive.
    </li>
  </ul>

  <p>
    Accessibility improvements will continue as
    the archive develops.
  </p>
</PolicySection>

<PolicySection
  id="feedback"
  number="06"
  title="Feedback"
>
  <p>
    If you experience any accessibility
    difficulties while using this website, or if
    you require information in another format,
    please get in touch.
  </p>

  <p>
    Constructive feedback is welcomed and helps
    improve the website for everyone.
  </p>
</PolicySection>

<PolicySection
  id="contact"
  number="07"
  title="Contact"
>
  <address className={styles.contactDetails}>
    <strong>Steve Gregson Photography</strong>

    <a href="mailto:info@stevegregson.com">
      info@stevegregson.com
    </a>

    <a href="tel:+447729435728">
      +44 (0) 7729 435 728
    </a>
  </address>
</PolicySection>

<PolicySection
  id="improvement"
  number="08"
  title="Continuous Improvement"
>
  <p>
    Accessibility is an ongoing process rather
    than a one-time exercise.
  </p>

  <p>
    Steve Gregson Photography is committed to
    reviewing this website regularly and making
    reasonable improvements wherever practical.
  </p>
</PolicySection>
<RelatedPolicies />
          <footer className={styles.documentFooter}>
            <p className={styles.eyebrow}>
              Document history
            </p>

            <div>
              <span>Version 1.1</span>
              <span>7 September 2026</span>
              <span>
                Accessibility review and website audit
              </span>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}

function PolicySection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={styles.section}
      id={id}
    >
      <header className={styles.sectionHeader}>
        <span>{number}</span>
        <h2>{title}</h2>
      </header>

      <div className={styles.sectionContent}>
        {children}
      </div>
    </section>
  );
}

function Definition({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className={styles.definition}>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}