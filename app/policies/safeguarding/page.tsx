import type { Metadata } from "next";
import Link from "next/link";
import RelatedPolicies from "../RelatedPolicies";

import styles from "../policy-document.module.css";

export const metadata: Metadata = {
  title:
    "Safeguarding Policy | Steve Gregson Photography",
  description:
    "Safeguarding and child protection principles for Steve Gregson Photography when working with children and young people.",
};

export default function SafeguardingPage() {
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
    Safeguarding Policy
  </p>

  <h1>
    Working Safely
    <br />
    with Children
    <br />
    &amp; Young People
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
  <p>Safeguarding Policy</p>

  <nav aria-label="Safeguarding Policy sections">
    <a href="#commitment">
      01 · Our commitment
    </a>

    <a href="#scope">
      02 · Scope
    </a>

    <a href="#principles">
      03 · Safeguarding principles
    </a>

    <a href="#working-practice">
      04 · Safe working practice
    </a>

    <a href="#photography">
      05 · Photography
    </a>

    <a href="#concerns">
      06 · Concerns &amp; disclosures
    </a>

    <a href="#reporting">
      07 · Reporting concerns
    </a>

    <a href="#confidentiality">
      08 · Confidentiality
    </a>

    <a href="#review">
      09 · Review
    </a>
  </nav>
</aside>

        <article className={styles.document}>
          <section className={styles.opening}>
  <p>
    Safeguarding is central to the professional
    standards of Steve Gregson Photography.
  </p>

  <p>
    This policy explains the responsibilities,
    procedures and expectations that support safe
    working practices whenever children and young
    people are involved.
  </p>
</section>

<PolicySection
  id="commitment"
  number="01"
  title="Our Commitment"
>
  <p>
    Steve Gregson Photography is committed to
    safeguarding and promoting the welfare of
    children and young people encountered through
    professional photographic work.
  </p>

  <p>
    The welfare and safety of the child or young
    person is the primary consideration at all
    times.
  </p>
</PolicySection>

<PolicySection
  id="scope"
  number="02"
  title="Scope"
>
  <p>
    This policy applies whenever Steve Gregson
    Photography works with or around children and
    young people, including within theatres,
    schools, rehearsal rooms, performance spaces,
    production environments and other locations.
  </p>

  <p>
    It should be read alongside any safeguarding
    procedures operated by the commissioning
    organisation, venue, school, production company
    or other responsible body.
  </p>
</PolicySection>

<PolicySection
  id="principles"
  number="03"
  title="Safeguarding Principles"
>
  <p>
    When working with children and young people,
    Steve Gregson Photography will:
  </p>

  <ul>
    <li>
      treat children and young people with dignity
      and respect;
    </li>
    <li>
      maintain appropriate professional boundaries;
    </li>
    <li>
      avoid favouritism or inappropriate
      relationships;
    </li>
    <li>
      listen to concerns and take them seriously;
    </li>
    <li>
      work openly and transparently;
    </li>
    <li>
      follow the safeguarding requirements of the
      responsible organisation; and
    </li>
    <li>
      report safeguarding concerns through the
      appropriate channels.
    </li>
  </ul>
</PolicySection>

<PolicySection
  id="working-practice"
  number="04"
  title="Safe Working Practice"
>
  <p>
    Steve Gregson Photography does not seek to
    undertake unsupervised work with children.
  </p>

  <p>
    Where children or young people are being
    photographed, an appropriate responsible adult,
    chaperone, teacher, parent, guardian or
    representative of the commissioning organisation
    should be present as required.
  </p>

  <p>
    If a situation arises in which Steve Gregson
    unexpectedly becomes alone with a child or young
    person, an appropriate responsible adult or
    chaperone should be located as soon as reasonably
    possible.
  </p>

  <p>
    Physical contact should be avoided unless it is
    necessary, appropriate and properly supervised
    within the professional activity taking place.
  </p>
</PolicySection>

<PolicySection
  id="photography"
  number="05"
  title="Photography"
>
  <p>
    Photography involving children and young people
    will only be undertaken as part of the agreed
    professional commission and in accordance with
    the instructions and safeguarding arrangements
    of the commissioning organisation.
  </p>

  <p>
    Reasonable care will be taken to ensure that
    photography is appropriate to the context in
    which it is being made.
  </p>

  <p>
    Responsibility for obtaining any permissions or
    consents required for the commissioned
    photography rests with the commissioning
    organisation unless otherwise agreed in writing.
  </p>
</PolicySection>

<PolicySection
  id="concerns"
  number="06"
  title="Concerns and Disclosures"
>
  <p>
    Any concern about the welfare or safety of a
    child or young person will be taken seriously.
  </p>

  <p>
    If a child or young person makes a disclosure,
    they should be listened to calmly and taken
    seriously. Confidentiality should not be
    promised where information may need to be shared
    in order to safeguard them.
  </p>

  <p>
    The concern should be reported promptly through
    the safeguarding procedure of the responsible
    organisation.
  </p>
</PolicySection>

<PolicySection
  id="reporting"
  number="07"
  title="Reporting Concerns"
>
  <p>
    Where a safeguarding concern arises during a
    commission, it should normally be reported to
    the designated safeguarding lead, chaperone,
    teacher, producer, company manager or other
    appropriate responsible person for the
    organisation concerned.
  </p>

  <p>
    Concerns about inappropriate behaviour by
    anyone working on behalf of Steve Gregson
    Photography should be raised directly with
    Steve Gregson.
  </p>

  <p>
    Where there is an immediate risk of harm,
    appropriate emergency or statutory safeguarding
    procedures should be followed.
  </p>
</PolicySection>

<PolicySection
  id="confidentiality"
  number="08"
  title="Confidentiality and Information"
>
  <p>
    Safeguarding information will be handled
    sensitively and shared only where there is a
    legitimate reason to do so.
  </p>

  <p>
    Information relating to a safeguarding concern
    may be shared with the responsible organisation
    or relevant authorities where this is necessary
    to protect a child or young person or to meet a
    legal obligation.
  </p>
</PolicySection>

<PolicySection
  id="review"
  number="09"
  title="Review"
>
  <p>
    This policy will be reviewed periodically and
    updated where necessary to reflect changes in
    professional practice, safeguarding guidance or
    applicable requirements.
  </p>

  <p>
    Questions about this policy can be sent to{" "}
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