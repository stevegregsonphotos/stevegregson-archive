import type { Metadata } from "next";
import Link from "next/link";
import RelatedPolicies from "../RelatedPolicies";

import styles from "../policy-document.module.css";

export const metadata: Metadata = {
  title:
    "AI & Content Statement | Steve Gregson Photography",
  description:
    "How Steve Gregson Photography uses artificial intelligence while protecting photographic authenticity, copyright and creative integrity.",
};

export default function AIContentPage() {
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
    AI &amp; Content Statement
  </p>

  <h1>
    Technology,
    <br />
    Authenticity &amp;
    <br />
    Copyright
  </h1>
</div>
          <div className={styles.documentMeta}>
            <div>
              <span>Version</span>
              <strong>1.0</strong>
            </div>

            <div>
              <span>Last reviewed</span>
              <strong>11 August 2026</strong>
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
  <p>AI &amp; Content Statement</p>

  <nav aria-label="AI & Content Statement sections">
    <a href="#principle">
      01 · Core principle
    </a>

    <a href="#use-of-ai">
      02 · How AI is used
    </a>

    <a href="#photographs">
      03 · Photographic authenticity
    </a>

    <a href="#alt-text">
      04 · Accessibility &amp; alt text
    </a>

    <a href="#copyright">
      05 · Copyright &amp; AI training
    </a>

    <a href="#third-party">
      06 · Third-party services
    </a>

    <a href="#review">
      07 · Review &amp; transparency
    </a>
  </nav>
</aside>

        <article className={styles.document}>
          <section className={styles.opening}>
  <p>
    Artificial intelligence is used only where it
    improves accessibility, organisation and
    discoverability.
  </p>

  <p>
    It is not used to create, manipulate or
    fabricate the photographic works presented
    within this archive.
  </p>

  <p>
    This statement explains how AI-assisted tools
    may be used by Steve Gregson Photography while
    protecting photographic authenticity,
    copyright and creative integrity.
  </p>
</section>

          <PolicySection
            id="data-protection-law"
            number="01"
            title="Data protection law"
          >
            <p>
              Personal information is handled in
              accordance with applicable UK data
              protection legislation, including the UK
              General Data Protection Regulation, the
              Data Protection Act 2018 and relevant
              amendments introduced by the Data (Use
              and Access) Act 2025.
            </p>

            <p>
              I aim to ensure that personal information
              is:
            </p>

            <ul>
              <li>
                used lawfully, fairly and transparently;
              </li>
              <li>
                collected for clear and legitimate
                purposes;
              </li>
              <li>
                limited to what is reasonably necessary;
              </li>
              <li>
                accurate and kept up to date where
                appropriate;
              </li>
              <li>
                retained only for as long as reasonably
                necessary;
              </li>
              <li>kept secure; and</li>
              <li>
                handled in a way that respects your
                legal rights.
              </li>
            </ul>
          </PolicySection>

          <PolicySection
  id="principle"
  number="01"
  title="Core Principle"
>
  <p>
    Steve Gregson Photography embraces technology
    where it improves accessibility, organisation
    and the visitor experience.
  </p>

  <p>
    Artificial intelligence is used as an
    assistive tool. It does not replace the
    authorship, judgement or creative work of
    the photographer.
  </p>
</PolicySection>

<PolicySection
  id="use-of-ai"
  number="02"
  title="How AI Is Used"
>
  <p>
    Artificial intelligence and automated tools
    may be used to assist with:
  </p>

  <ul>
    <li>
      generating descriptive alternative text;
    </li>
    <li>
      organising and cataloguing photographic
      archives;
    </li>
    <li>
      improving searchability and discoverability;
    </li>
    <li>
      assisting with metadata;
    </li>
    <li>
      supporting website administration; and
    </li>
    <li>
      other administrative tasks where appropriate.
    </li>
  </ul>

  <p>
    AI-assisted output may be reviewed, amended
    or rejected where necessary.
  </p>
</PolicySection>

<PolicySection
  id="photographs"
  number="03"
  title="Photographic Authenticity"
>
  <p>
    Artificial intelligence is not used to
    generate, replace or fabricate the
    photographic works presented within this
    archive.
  </p>

  <p>
    The photographs document real productions,
    performances, people and commissions and
    remain the photographic work of Steve
    Gregson unless otherwise stated.
  </p>

  <p>
    AI-generated imagery will not knowingly be
    presented as an original photograph by
    Steve Gregson.
  </p>
</PolicySection>

<PolicySection
  id="alt-text"
  number="04"
  title="Accessibility and Alternative Text"
>
  <p>
    AI-assisted tools may be used to generate
    descriptive alternative text for photographs
    in order to improve accessibility.
  </p>

  <p>
    Automated descriptions may occasionally
    contain errors or omissions. Where an
    inaccurate or inappropriate description is
    identified, it may be corrected or replaced.
  </p>

  <p>
    Visitors who identify an inaccurate
    description are encouraged to get in touch
    so that it can be reviewed.
  </p>
</PolicySection>

<PolicySection
  id="copyright"
  number="05"
  title="Copyright and AI Training"
>
  <p>
    Copyright in photographs and other original
    material created by Steve Gregson remains
    with Steve Gregson unless expressly assigned
    in writing.
  </p>

  <p>
    Photographs and other website content may
    not be used to train, fine-tune, develop,
    benchmark or evaluate artificial-intelligence
    or machine-learning systems without prior
    written permission from Steve Gregson
    Photography.
  </p>

  <p>
    This includes systematic scraping, harvesting,
    extraction or incorporation of photographs
    or other protected material into datasets
    intended for AI or machine-learning use.
  </p>

  <p>
    No licence to use material published on this
    website includes AI or machine-learning rights
    unless those rights have been expressly
    granted in writing.
  </p>
</PolicySection>

<PolicySection
  id="third-party"
  number="06"
  title="Third-Party Services"
>
  <p>
    Steve Gregson Photography may use third-party
    software or services that incorporate
    artificial-intelligence or automated
    technologies.
  </p>

  <p>
    Where such services are used, reasonable care
    will be taken to consider privacy,
    confidentiality, copyright and the nature of
    the information being processed.
  </p>
</PolicySection>

<PolicySection
  id="review"
  number="07"
  title="Review and Transparency"
>
  <p>
    Artificial-intelligence technology and the
    legal and professional standards surrounding
    its use continue to develop.
  </p>

  <p>
    Steve Gregson Photography will review the use
    of AI-assisted tools as appropriate and may
    update this statement to reflect changes in
    technology, working practices or applicable
    standards.
  </p>

  <p>
    Questions about the use of artificial
    intelligence within the archive can be sent
    to{" "}
    <a href="mailto:info@stevegregson.com">
      info@stevegregson.com
    </a>
    .
  </p>
</PolicySection>
          <RelatedPolicies />

          <footer className={styles.documentFooter}>
            <p className={styles.eyebrow}>
              Document history
            </p>

            <div>
              <span>Version 1.0</span>
              <span>11 August 2026</span>
              <span>
                Complete review and modernisation
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