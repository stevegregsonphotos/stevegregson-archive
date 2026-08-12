import type { Metadata } from "next";
import Link from "next/link";
import RelatedPolicies from "../RelatedPolicies";

import styles from "../policy-document.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Steve Gregson Photography",
  description:
    "How Steve Gregson Photography collects, uses, stores and protects personal information.",
};

export default function PrivacyPolicyPage() {
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
      Privacy Policy
    </p>

    <h1>
      Personal Information
      <br />
      &amp; Data Protection
    </h1>
  </div>

          <div className={styles.documentMeta}>
            <div>
              <span>Version</span>
              <strong>2.0</strong>
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
          <p>Privacy Policy</p>

          <nav aria-label="Privacy Policy sections">
            <a href="#data-protection-law">
              01 · Data protection law
            </a>

            <a href="#information-collected">
              02 · Information I may collect
            </a>

            <a href="#how-collected">
              03 · How information is collected
            </a>

            <a href="#why-used">
              04 · Why I use personal information
            </a>

            <a href="#lawful-bases">
              05 · Lawful bases
            </a>

            <a href="#photography">
              06 · Photography
            </a>

            <a href="#marketing">
              07 · Marketing
            </a>

            <a href="#sharing">
              08 · Sharing information
            </a>

            <a href="#international-transfers">
              09 · International transfers
            </a>

            <a href="#retention">
              10 · Data retention
            </a>

            <a href="#archive">
              11 · Photographic archive
            </a>

            <a href="#security">
              12 · Data security
            </a>

            <a href="#rights">
              13 · Your rights
            </a>

            <a href="#requests">
              14 · Requests
            </a>

            <a href="#complaints">
              15 · Complaints
            </a>

            <a href="#cookies">
              16 · Cookies
            </a>

            <a href="#external-websites">
              17 · External websites
            </a>

            <a href="#changes">
              18 · Changes
            </a>
          </nav>
        </aside>

        <article className={styles.document}>
          <section className={styles.opening}>
            <p>
              Steve Gregson Photography respects your
              privacy and is committed to protecting
              your personal information.
            </p>

            <p>
              This Privacy Policy explains what
              information I may collect, why I use it,
              how it is stored and shared, and the
              rights you have in relation to your
              personal information.
            </p>

            <p>
              For the purposes of UK data protection
              law, Steve Gregson / Steve Gregson
              Photography is the data controller
              responsible for the personal information
              described in this policy.
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
            id="information-collected"
            number="02"
            title="Information I may collect"
          >
            <p>
              Depending on the nature of our
              relationship, I may collect and process
              information including:
            </p>

            <ul>
              <li>your name;</li>
              <li>job title or professional role;</li>
              <li>
                organisation or company name;
              </li>
              <li>postal address;</li>
              <li>email address;</li>
              <li>telephone number;</li>
              <li>
                billing and payment information;
              </li>
              <li>
                correspondence relating to bookings,
                commissions or licences;
              </li>
              <li>
                production, event or project
                information;
              </li>
              <li>
                contractual and licensing information;
              </li>
              <li>
                information necessary for safeguarding
                or legal compliance;
              </li>
              <li>
                photographs where those photographs
                constitute personal information;
              </li>
              <li>
                technical information submitted through
                the website, where applicable; and
              </li>
              <li>
                any other information you choose to
                provide when contacting Steve Gregson
                Photography.
              </li>
            </ul>

            <p>
              I do not intentionally collect personal
              information that is unnecessary for the
              work being undertaken.
            </p>
          </PolicySection>

          <PolicySection
            id="how-collected"
            number="03"
            title="How personal information is collected"
          >
            <p>Information may be collected:</p>

            <ul>
              <li>directly from you;</li>
              <li>
                through email, telephone or other
                correspondence;
              </li>
              <li>
                when you request a quotation or make a
                booking;
              </li>
              <li>
                during the administration and delivery
                of photographic services;
              </li>
              <li>
                through contracts, licences and
                invoices;
              </li>
              <li>
                from a theatre, production company,
                school, agency or other organisation
                for which you work;
              </li>
              <li>
                through professional or publicly
                available sources where appropriate;
                and
              </li>
              <li>
                through the website when you contact
                Steve Gregson Photography.
              </li>
            </ul>
          </PolicySection>

          <PolicySection
            id="why-used"
            number="04"
            title="Why I use personal information"
          >
            <p>
              I may use personal information in order
              to:
            </p>

            <ul>
              <li>respond to enquiries;</li>
              <li>
                prepare quotations and confirm
                bookings;
              </li>
              <li>provide photographic services;</li>
              <li>
                administer projects and commissions;
              </li>
              <li>
                communicate with clients, venues,
                creatives and other project
                participants;
              </li>
              <li>deliver and license photographs;</li>
              <li>
                issue invoices and maintain financial
                records;
              </li>
              <li>
                administer copyright and
                image-licensing arrangements;
              </li>
              <li>
                maintain appropriate business and
                customer records;
              </li>
              <li>
                fulfil legal, regulatory, accounting
                and tax obligations;
              </li>
              <li>
                protect the security and integrity of
                the business and its systems;
              </li>
              <li>
                establish, exercise or defend legal
                rights;
              </li>
              <li>
                manage safeguarding obligations where
                applicable;
              </li>
              <li>
                maintain an accurate professional
                archive; and
              </li>
              <li>
                promote Steve Gregson Photography where
                there is an appropriate lawful basis
                for doing so.
              </li>
            </ul>

            <p>
              I will not use personal information for
              purposes that are incompatible with the
              purpose for which it was originally
              collected unless there is a lawful basis
              for doing so.
            </p>
          </PolicySection>

          <PolicySection
            id="lawful-bases"
            number="05"
            title="Lawful bases for processing"
          >
            <p>
              Depending on the circumstances, I may
              rely on one or more lawful bases for
              processing personal information.
            </p>

            <p>These may include:</p>

            <Definition
              title="Contract"
              text="Where processing is necessary to enter into or perform a contract with you."
            />

            <Definition
              title="Legal obligation"
              text="Where information must be processed in order to comply with a legal or regulatory requirement."
            />

            <Definition
              title="Legitimate interests"
              text="Where processing is reasonably necessary for the legitimate interests of Steve Gregson Photography or another person, provided those interests are not overridden by your rights and interests."
            />

            <p>
              Examples may include maintaining customer
              records, administering commissions,
              protecting copyright, maintaining
              business security and carrying out
              appropriate business communications.
            </p>

            <Definition
              title="Consent"
              text="Where you have specifically agreed to a particular use of your personal information and consent is the appropriate lawful basis."
            />

            <p>
              Where processing is based on consent, you
              may withdraw that consent at any time.
            </p>

            <p>
              The ICO requires organisations to
              identify a valid lawful basis for
              processing and to be clear about the
              purposes for which personal information
              is used.
            </p>
          </PolicySection>

          <PolicySection
            id="photography"
            number="06"
            title="Photography and personal information"
          >
            <p>
              Photographs may constitute personal
              information where an individual can be
              identified.
            </p>

            <p>
              Photography undertaken by Steve Gregson
              Photography is generally created in
              connection with professional theatre,
              performance, education, publicity,
              editorial or commissioned photographic
              activity.
            </p>

            <p>
              Responsibility for obtaining any
              production-specific permissions,
              performer permissions, parental or
              guardian consents, performance licences
              or similar authorisations may depend upon
              the nature of the commission and the
              contractual arrangements between Steve
              Gregson Photography and the commissioning
              organisation.
            </p>

            <p>
              Where children or young people are
              photographed, Steve Gregson Photography
              also operates in accordance with its{" "}
              <Link href="/policies/safeguarding">
                Safeguarding &amp; Child Protection
                Policy
              </Link>
              .
            </p>
          </PolicySection>

          <PolicySection
            id="marketing"
            number="07"
            title="Marketing communications"
          >
            <p>
              I will only send direct marketing
              communications where there is an
              appropriate lawful basis for doing so.
            </p>

            <p>
              Where consent is relied upon, you may
              withdraw it at any time.
            </p>

            <p>
              You may also ask at any time not to
              receive marketing communications from
              Steve Gregson Photography.
            </p>
          </PolicySection>

          <PolicySection
            id="sharing"
            number="08"
            title="Sharing personal information"
          >
            <p>
              Personal information may be shared where
              reasonably necessary with organisations
              or individuals involved in providing or
              supporting the services you have
              requested.
            </p>

            <p>These may include:</p>

            <ul>
              <li>production companies;</li>
              <li>theatres and venues;</li>
              <li>agents or representatives;</li>
              <li>
                printers, reprographics providers or
                image-delivery services;
              </li>
              <li>
                accountants and professional advisers;
              </li>
              <li>
                IT, hosting and technical service
                providers;
              </li>
              <li>
                payment or financial service providers
                where applicable;
              </li>
              <li>
                regulatory, legal or public authorities
                where disclosure is required by law;
                and
              </li>
              <li>
                other service providers acting on
                behalf of Steve Gregson Photography.
              </li>
            </ul>

            <p>
              Only information reasonably necessary for
              the relevant purpose will be shared.
            </p>

            <p>
              Where third parties process personal
              information on behalf of Steve Gregson
              Photography, reasonable steps will be
              taken to ensure appropriate
              confidentiality and data-protection
              arrangements are in place.
            </p>
          </PolicySection>

          <PolicySection
            id="international-transfers"
            number="09"
            title="International transfers"
          >
            <p>
              Some technology or service providers may
              process information outside the United
              Kingdom.
            </p>

            <p>
              Where personal information is transferred
              internationally, I will take reasonable
              steps to ensure that the transfer is made
              using an appropriate legal mechanism and
              that the information continues to receive
              an appropriate level of protection.
            </p>
          </PolicySection>

          <PolicySection
            id="retention"
            number="10"
            title="Data retention"
          >
            <p>
              Personal information will not be retained
              for longer than reasonably necessary.
            </p>

            <p>
              Different types of information may need
              to be retained for different periods
              depending on:
            </p>

            <ul>
              <li>the nature of the commission;</li>
              <li>contractual obligations;</li>
              <li>
                copyright and licensing records;
              </li>
              <li>safeguarding requirements;</li>
              <li>insurance requirements;</li>
              <li>
                accounting and taxation obligations;
              </li>
              <li>potential legal claims; and</li>
              <li>
                legitimate archival or business-record
                purposes.
              </li>
            </ul>

            <p>
              Financial and contractual records may
              therefore be retained for longer than
              general correspondence.
            </p>

            <p>
              Where information is no longer required,
              it will be securely deleted, destroyed or
              anonymised where reasonably practicable.
            </p>
          </PolicySection>

          <PolicySection
            id="archive"
            number="11"
            title="Photographic archive"
          >
            <p>
              Steve Gregson Photography maintains a
              professional photographic archive
              documenting productions, performances and
              commissions.
            </p>

            <p>
              Photographs and associated production
              information may be retained for long-term
              professional, historical, artistic,
              evidential and copyright-management
              purposes.
            </p>

            <p>
              Where personal information is retained as
              part of that archive, it will be handled
              in accordance with applicable data
              protection law.
            </p>
          </PolicySection>

          <PolicySection
            id="security"
            number="12"
            title="Data security"
          >
            <p>
              Reasonable technical and organisational
              measures are used to protect personal
              information against:
            </p>

            <ul>
              <li>unauthorised access;</li>
              <li>unlawful use;</li>
              <li>accidental loss;</li>
              <li>alteration;</li>
              <li>disclosure; and</li>
              <li>destruction.</li>
            </ul>

            <p>
              Access to personal information is limited
              to those who reasonably require it for
              legitimate business purposes.
            </p>

            <p>
              No internet-based system can be
              guaranteed to be completely secure, but
              appropriate precautions are taken to
              protect information under my control.
            </p>
          </PolicySection>

          <PolicySection
            id="rights"
            number="13"
            title="Your rights"
          >
            <p>
              Depending on the circumstances, UK data
              protection law may give you rights
              including the right to:
            </p>

            <ul>
              <li>
                request access to personal information
                held about you;
              </li>
              <li>
                request correction of inaccurate or
                incomplete information;
              </li>
              <li>
                request deletion of information in
                certain circumstances;
              </li>
              <li>
                request restriction of processing;
              </li>
              <li>
                object to certain forms of processing;
              </li>
              <li>object to direct marketing;</li>
              <li>
                request transfer of information in
                certain circumstances;
              </li>
              <li>
                withdraw consent where consent is
                relied upon; and
              </li>
              <li>
                raise a concern about how your personal
                information has been handled.
              </li>
            </ul>

            <p>
              These rights are not absolute and may be
              subject to exemptions or other lawful
              reasons for continuing to process or
              retain information.
            </p>
          </PolicySection>

          <PolicySection
            id="requests"
            number="14"
            title="Requests relating to your information"
          >
            <p>
              If you wish to exercise any
              data-protection right or ask what personal
              information Steve Gregson Photography
              holds about you, please contact:
            </p>

            <address className={styles.contactDetails}>
              <strong>
                Steve Gregson Photography
              </strong>

              <a href="mailto:info@stevegregson.com">
                info@stevegregson.com
              </a>

              <a href="tel:+447729435728">
                +44 (0) 7729 435 728
              </a>
            </address>

            <p>
              I may need to verify your identity before
              responding to a request.
            </p>
          </PolicySection>

          <PolicySection
            id="complaints"
            number="15"
            title="Complaints"
          >
            <p>
              If you have concerns about the way your
              personal information has been handled,
              please contact Steve Gregson Photography
              first so that the issue can be
              investigated.
            </p>

            <p>
              You also have the right to raise a
              complaint with the UK Information
              Commissioner&apos;s Office where
              applicable.
            </p>
          </PolicySection>

          <PolicySection
            id="cookies"
            number="16"
            title="Cookies and website technology"
          >
            <p>
              The website may use cookies or similar
              technologies that are necessary for its
              operation or used to understand how the
              website performs.
            </p>

            <p>
              Where non-essential cookies or similar
              technologies requiring consent are
              introduced, appropriate information and
              consent controls will be provided.
            </p>
          </PolicySection>

          <PolicySection
            id="external-websites"
            number="17"
            title="External websites"
          >
            <p>
              This website may contain links to
              third-party websites, including theatres,
              venues, organisations and creative
              professionals.
            </p>

            <p>
              Steve Gregson Photography is not
              responsible for the privacy practices,
              security or content of external websites.
            </p>
          </PolicySection>

          <PolicySection
            id="changes"
            number="18"
            title="Changes to this policy"
          >
            <p>
              This Privacy Policy may be updated from
              time to time to reflect changes in the
              website, business practices, technology
              or applicable law.
            </p>

            <p>
              The latest version will be published on
              this website with an updated review date.
            </p>
          </PolicySection>

          <RelatedPolicies />

          <footer className={styles.documentFooter}>
            <p className={styles.eyebrow}>
              Document history
            </p>

            <div>
              <span>Version 2.0</span>
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