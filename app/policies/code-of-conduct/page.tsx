import type { Metadata } from "next";
import Link from "next/link";
import RelatedPolicies from "../RelatedPolicies";

import styles from "../policy-document.module.css";

export const metadata: Metadata = {
  title:
    "Code of Conduct | Steve Gregson Photography",
  description:
    "Professional conduct and safeguarding responsibilities for adults working with children on behalf of Steve Gregson Photography.",
};

export default function CodeOfConductPage() {
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
    Code of Conduct
  </p>

  <h1>
    Professional Behaviour
    <br />
    &amp; Responsibilities
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
  <p>Code of Conduct</p>

  <nav aria-label="Code of Conduct sections">
    <a href="#purpose">
      01 · Purpose
    </a>

    <a href="#relationships">
      02 · Appropriate relationships
    </a>

    <a href="#behaviour">
      03 · Inappropriate behaviour
    </a>

    <a href="#concerns">
      04 · Reporting concerns
    </a>

    <a href="#agreement">
      05 · Agreement
    </a>
  </nav>
</aside>

        <article className={styles.document}>
          <section className={styles.opening}>
  <p>
    Everyone working on behalf of Steve Gregson
    Photography is expected to maintain the
    highest standards of professionalism,
    integrity and respect.
  </p>

  <p>
    This Code of Conduct sets out the behaviour
    expected when working with children and young
    people and forms part of the safeguarding
    framework of Steve Gregson Photography.
  </p>
</section>

<PolicySection
  id="purpose"
  number="01"
  title="Purpose"
>
  <p>
    This Code of Conduct outlines the standards
    expected from anyone undertaking duties on
    behalf of Steve Gregson Photography when
    working with children and young people.
  </p>

  <p>
    Adults working with children are in a position
    of authority, responsibility and trust and may
    be regarded as role models. It is therefore
    essential that they behave appropriately and
    are able to recognise and report behaviour
    that may cause concern.
  </p>

  <p>
    Everyone working on behalf of Steve Gregson
    Photography is expected to understand and
    follow this Code of Conduct and the associated
    safeguarding requirements.
  </p>
</PolicySection>

<PolicySection
  id="relationships"
  number="02"
  title="Appropriate Relationships"
>
  <p>
    When working with children and young people,
    you should:
  </p>

  <ul>
    <li>
      promote relationships based on openness,
      honesty, trust and respect;
    </li>
    <li>avoid showing favouritism;</li>
    <li>be patient and respectful;</li>
    <li>
      exercise appropriate caution when discussing
      sensitive issues;
    </li>
    <li>
      ensure contact with children is appropriate
      and relevant to the professional activity;
    </li>
    <li>
      ensure an appropriate chaperone or responsible
      adult is present when working with children;
      and
    </li>
    <li>
      if you unexpectedly find yourself alone with
      a child, locate an appropriate chaperone or
      responsible adult as soon as reasonably
      possible.
    </li>
  </ul>
</PolicySection>

<PolicySection
  id="behaviour"
  number="03"
  title="Inappropriate Behaviour"
>
  <p>
    When working with children and young people,
    you must not:
  </p>

  <ul>
    <li>
      allow safeguarding concerns or allegations
      to go unreported;
    </li>
    <li>take unnecessary risks;</li>
    <li>
      smoke, consume alcohol or use illegal
      substances in their presence;
    </li>
    <li>
      develop inappropriate relationships with
      children or young people;
    </li>
    <li>
      make unnecessary or inappropriate physical
      contact;
    </li>
    <li>
      take photography or video footage outside
      the agreed professional commission or
      authorised activity;
    </li>
    <li>
      make inappropriate promises to children;
    </li>
    <li>
      engage in abusive, exploitative or sexual
      behaviour of any kind;
    </li>
    <li>
      give children personal contact details or
      communicate with them through personal
      social-media accounts;
    </li>
    <li>
      behave in a way that could reasonably be
      perceived as threatening or intrusive;
    </li>
    <li>
      patronise, humiliate or belittle children
      or young people;
    </li>
    <li>
      use inappropriate or offensive language; or
    </li>
    <li>
      make sarcastic, insensitive, derogatory or
      sexually suggestive comments or gestures to,
      about or in front of children.
    </li>
  </ul>
</PolicySection>

<PolicySection
  id="concerns"
  number="04"
  title="Reporting Concerns"
>
  <p>
    Any concern about inappropriate behaviour,
    safeguarding or the welfare of a child or
    young person must be taken seriously and
    reported promptly.
  </p>

  <p>
    Where the work is taking place for another
    organisation, concerns should normally be
    reported through that organisation&apos;s
    safeguarding procedure and to its designated
    safeguarding lead or other appropriate
    responsible person.
  </p>

  <p>
    Concerns relating to anyone working on behalf
    of Steve Gregson Photography should also be
    raised directly with Steve Gregson.
  </p>
</PolicySection>

<PolicySection
  id="agreement"
  number="05"
  title="Agreement"
>
  <p>
    Anyone required to work under this Code of
    Conduct should confirm that they have read,
    understood and agreed to follow it.
  </p>

  <p>
    The signed working copy may include fields for
    the individual&apos;s name, signature and date.
    The public website version does not require
    those signature fields.
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