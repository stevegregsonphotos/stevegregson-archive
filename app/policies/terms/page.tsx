import type { Metadata } from "next";
import Link from "next/link";
import RelatedPolicies from "../RelatedPolicies";

import styles from "../policy-document.module.css";

export const metadata: Metadata = {
  title:
    "Terms & Conditions | Steve Gregson Photography",
  description:
    "Terms governing photographic commissions, copyright, licensing, payment and reproduction of photographs by Steve Gregson Photography.",
};

export default function TermsPage() {
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
              Terms &amp; Conditions
            </p>

            <h1>
              Commissioning,
              <br />
              Licensing &amp;
              <br />
              Copyright
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
          <SidebarGroup title="Agreement">
            <a href="#definitions">
              01 · Terms &amp; Definitions
            </a>

            <a href="#copyright">
              02 · Copyright &amp; Ownership
            </a>

            <a href="#use-reproduction">
              03 · Use &amp; Reproduction
            </a>
          </SidebarGroup>

          <SidebarGroup title="Commercial">
            <a href="#reproduction-rights">
              04 · Reproduction Rights
            </a>

            <a href="#booking">
              05 · Booking &amp; Cancellation
            </a>

            <a href="#payment">
              06 · Payment Terms
            </a>
          </SidebarGroup>

          <SidebarGroup title="Licensing">
            <a href="#licensing">
              07 · Licence Types
            </a>

            <a href="#licence-one-year">
              7.1 · One Year
            </a>

            <a href="#licence-two-year">
              7.2 · Two Year
            </a>

            <a href="#licence-perpetual">
              7.3 · Perpetual
            </a>
          </SidebarGroup>

          <SidebarGroup title="Professional Practice">
            <a href="#editing">
              08 · Editing &amp; Selection
            </a>

            <a href="#liability">
              09 · Liability &amp; Permissions
            </a>
          </SidebarGroup>

          <SidebarGroup title="Legal">
            <a href="#applicable-law">
              10 · Applicable Law
            </a>

            <a href="#published-use">
              11 · Published Reproductions
            </a>

            <a href="#contact">
              12 · Contact
            </a>
          </SidebarGroup>
        </aside>

        <article className={styles.document}>
          <section className={styles.opening}>
            <p>
              These Terms &amp; Conditions apply to
              photographic commissions undertaken by
              Steve Gregson Photography and to the
              licensing, supply and reproduction of
              photographs created or supplied by Steve
              Gregson Photography.
            </p>

            <p>
              Unless otherwise agreed in writing,
              placing a booking, commissioning
              photography, accepting delivery of
              photographs or using photographs supplied
              by Steve Gregson Photography constitutes
              acceptance of these Terms &amp;
              Conditions.
            </p>
          </section>

          <PolicySection
            id="definitions"
            number="01"
            title="Terms and Definitions"
          >
            <Definition
              title="1.1 Photograph"
              text="“Photograph” or “Image” means any photographic image, digital file, scan, print, artwork, derivative image or other visual material created or supplied by Steve Gregson Photography."
            />

            <Definition
              title="1.2 Reproduction"
              text="“Reproduction” includes any publication, copying, display, distribution, transmission, storage or other use of the whole or any part of a Photograph, whether altered or unaltered, in print, digital, electronic, online, broadcast, projected or any other media."
            />

            <Definition
              title="1.3 Client"
              text="The “Client” is the person or organisation to whom the quotation, booking confirmation or invoice is addressed, whether acting on its own behalf or on behalf of a third party."
            />

            <Definition
              title="1.4 Photographer"
              text="The “Photographer” means Steve Gregson, trading as Steve Gregson Photography, and the author of the Photographs."
            />

            <Definition
              title="1.5 Agreement"
              text="These Terms & Conditions, together with the relevant quotation, booking confirmation, invoice and any written variation agreed between the Photographer and the Client, constitute the agreement between the parties."
            />

            <p>
              Any variation must be agreed in writing.
            </p>

            <p>
              Email and other written electronic
              communications may form part of that
              agreement.
            </p>
          </PolicySection>

          <PolicySection
            id="copyright"
            number="02"
            title="Copyright and Ownership"
          >
            <Callout label="Copyright">
              Copyright in all Photographs created by
              Steve Gregson remains with Steve Gregson
              at all times throughout the world unless
              copyright is expressly assigned under a
              separate written agreement signed by the
              Photographer.
            </Callout>

            <Subsection title="2.1">
              <p>
                Copyright in all Photographs created by
                Steve Gregson remains with Steve
                Gregson at all times throughout the
                world unless copyright is expressly
                assigned under a separate written
                agreement signed by the Photographer.
              </p>
            </Subsection>

            <Subsection title="2.2">
              <p>
                Ownership of copyright does not pass to
                the Client simply because the Client
                commissioned, possesses, paid for or has
                been supplied with a Photograph.
              </p>

              <p>
                Steve Gregson Photography provides
                photographic services and licenses
                agreed rights to reproduce the
                resulting Photographs.
              </p>
            </Subsection>

            <Subsection title="2.3">
              <p>
                Any reproduction rights granted to the
                Client are licences only. No
                assignment, transfer or partial
                assignment of copyright shall be
                implied.
              </p>
            </Subsection>

            <Subsection title="2.4">
              <p>
                Unless otherwise specified in writing
                or under one of the licensing
                arrangements in section 7, Photographs
                are licensed for the period stated on
                the relevant quotation or invoice.
              </p>

              <p>
                Once a licence has expired, further use
                requires the written agreement of Steve
                Gregson Photography.
              </p>

              <p>
                Where requested, the Client must cease
                further publication and distribution
                and delete or archive supplied digital
                files in accordance with the
                Photographer&apos;s instructions.
              </p>
            </Subsection>

            <Subsection title="2.5 Moral Rights and Credit">
              <p>
                Steve Gregson asserts his moral right
                to be identified as the author of his
                work in accordance with sections 77
                and 78 of the Copyright, Designs and
                Patents Act 1988.
              </p>

              <p>
                Where a credit is required, the credit
                shall be:
              </p>

              <p>
                <strong>
                  Steve Gregson Photography
                </strong>
              </p>

              <p>
                or another credit expressly agreed in
                writing.
              </p>
            </Subsection>

            <Subsection title="2.6">
              <p>
                Where a required copyright notice or
                credit is omitted, Steve Gregson
                Photography reserves the right to
                charge an additional fee. Unless
                otherwise agreed, that additional fee
                may be no less than 25% of the relevant
                original licence fee.
              </p>
            </Subsection>

            <Subsection title="2.7 Alteration">
              <p>
                The Client must not materially alter,
                manipulate, retouch, composite or
                otherwise adapt a Photograph without
                the prior written permission of Steve
                Gregson Photography.
              </p>

              <p>
                Normal resizing necessary for an
                authorised reproduction does not
                constitute an assignment of rights or
                permission for any other alteration.
              </p>
            </Subsection>
          </PolicySection>

          <PolicySection
            id="use-reproduction"
            number="03"
            title="Use and Reproduction"
          >
            <Subsection title="3.1">
              <p>
                Reproduction rights are strictly
                limited to the uses, territories, media
                and periods stated on the quotation,
                invoice or other written licence issued
                by Steve Gregson Photography.
              </p>

              <p>
                Any additional use requires prior
                written agreement.
              </p>
            </Subsection>

            <Subsection title="3.2">
              <p>
                Unless expressly stated otherwise,
                licences are non-exclusive.
              </p>
            </Subsection>

            <Subsection title="3.3">
              <p>
                Reproduction rights are granted to the
                Client named on the relevant invoice
                and may not be assigned, sold or
                transferred.
              </p>

              <p>
                The Client may supply Photographs to
                third parties only where reasonably
                necessary for the exercise of the
                rights expressly granted — for example,
                to press contacts, printers, designers
                or other authorised suppliers — and
                remains responsible for ensuring that
                such third parties comply with the
                applicable licence.
              </p>
            </Subsection>

            <Subsection title="3.4">
              <p>
                No copyright transfer or broader
                licence shall arise by implication.
              </p>
            </Subsection>

            <Subsection title="3.5">
              <p>
                Steve Gregson Photography may refuse to
                grant additional reproduction rights or
                licences to the Client or to any third
                party.
              </p>
            </Subsection>

            <Subsection title="3.6 Unauthorised Use">
              <p>
                Any use outside the scope of an agreed
                licence constitutes unauthorised use
                and may constitute copyright
                infringement.
              </p>

              <p>
                Steve Gregson Photography reserves the
                right to charge an appropriate
                retrospective licence fee and to pursue
                any other remedies available.
              </p>
            </Subsection>

            <Subsection title="3.7 Artificial Intelligence, Machine Learning and Automated Use">
              <Callout label="AI & automated use">
                Unless expressly licensed in writing,
                no Photograph or other material
                supplied by Steve Gregson Photography
                may be used for training, developing or
                evaluating artificial-intelligence or
                machine-learning systems.
              </Callout>

              <p>
                Unless expressly licensed in writing by
                Steve Gregson Photography, no
                Photograph or other material supplied
                by the Photographer may be:
              </p>

              <ul>
                <li>
                  used to train, fine-tune, develop,
                  benchmark or evaluate an
                  artificial-intelligence or
                  machine-learning system;
                </li>

                <li>
                  uploaded to a generative AI service
                  for the purpose of creating
                  derivative or competing imagery;
                </li>

                <li>
                  incorporated into a dataset intended
                  for AI or machine-learning use;
                </li>

                <li>
                  systematically scraped, harvested or
                  extracted for such purposes; or
                </li>

                <li>
                  supplied to a third party for any of
                  those purposes.
                </li>
              </ul>

              <p>
                No licence granted under these Terms
                includes AI or machine-learning rights
                unless those rights are expressly
                stated in writing.
              </p>
            </Subsection>
          </PolicySection>

          <PolicySection
            id="reproduction-rights"
            number="04"
            title="Definitions of Reproduction Rights"
          >
            <p>
              Where the following descriptions are
              used on a quotation or invoice, they have
              the meanings below.
            </p>

            <Definition
              title="4.1 Internal Use Only"
              text="The right to use Photographs internally within the Client’s organisation for non-commercial internal purposes, including internal presentations, internal communications, an intranet and display within the Client’s premises. It does not include general public-facing publication unless separately agreed."
            />

            <Definition
              title="4.2 PR and Press Distribution"
              text="The right to use Photographs for legitimate public-relations and press purposes connected with the agreed production, project or organisation, including distribution to third-party editorial media where no payment has been made to guarantee publication."
            />

            <Definition
              title="4.3 Specified Use Only"
              text="The right to reproduce Photographs solely for the specific use described on the relevant quotation or invoice."
            />

            <Definition
              title="4.4 Editorial"
              text="The right to reproduce Photographs in the specified editorial publication or context, subject to any limitations stated on the quotation or invoice."
            />

            <Definition
              title="4.5 Company Public Use"
              text="The right to use Photographs for authorised public-facing purposes of the Client, including its website, publicity material, reports and official social-media channels, within the scope and duration of the relevant licence."
            />
          </PolicySection>

          <PolicySection
            id="booking"
            number="05"
            title="Booking and Cancellation"
          >
            <Subsection title="5.1 Confirmed Bookings">
              <p>
                Once a date and time have been
                confirmed, Steve Gregson Photography
                reserves that period for the Client and
                may decline other work for the same
                period.
              </p>
            </Subsection>

            <Subsection title="5.2 Cancellation by the Client">
              <p>
                If a confirmed booking is cancelled by
                the Client, the following cancellation
                fees apply:
              </p>

              <Definition
                title="14 days or less before the confirmed booking"
                text="50% of the booked photography fee."
              />

              <Definition
                title="Less than 7 days before the confirmed booking"
                text="75% of the booked photography fee."
              />

              <Definition
                title="Less than 2 days before the confirmed booking"
                text="100% of the booked photography fee."
              />

              <p>
                In addition, the Client remains
                responsible for any reasonable expenses
                or non-refundable costs already
                incurred by Steve Gregson Photography
                in connection with the booking.
              </p>
            </Subsection>

            <Subsection title="5.3 Rescheduling or Circumstances Beyond Reasonable Control">
              <p>
                Where a shoot cannot reasonably proceed
                because of weather, lighting, venue
                circumstances, illness, safety concerns
                or another circumstance outside Steve
                Gregson Photography&apos;s reasonable
                control, the Photographer and Client
                will endeavour to agree a replacement
                date.
              </p>

              <p>
                Where no suitable replacement date can
                be agreed within a reasonable mutually
                agreed period, or within two calendar
                months where no other period is agreed,
                Steve Gregson Photography reserves the
                right to charge 50% of the booked
                photography fee together with expenses
                already incurred.
              </p>
            </Subsection>
          </PolicySection>

          <PolicySection
            id="payment"
            number="06"
            title="Payment Terms"
          >
            <Subsection title="6.1">
              <p>
                Unless agreed otherwise in writing,
                Steve Gregson Photography&apos;s payment
                terms are strictly net 28 days from the
                date of invoice.
              </p>
            </Subsection>

            <Subsection title="6.2">
              <p>
                Where a qualifying commercial invoice
                remains unpaid after its due date,
                Steve Gregson Photography reserves the
                right to claim statutory interest,
                fixed compensation and reasonable
                recovery costs where permitted under
                the Late Payment of Commercial Debts
                (Interest) Act 1998 and associated
                legislation.
              </p>

              <p>
                For qualifying business-to-business
                debts, statutory interest is currently
                calculated at 8 percentage points above
                the Bank of England base rate unless an
                applicable contractual provision
                provides otherwise.
              </p>
            </Subsection>

            <Subsection title="6.3">
              <p>
                Steve Gregson Photography reserves the
                right to recover reasonable
                administrative and debt-recovery costs
                arising from overdue accounts where
                legally recoverable.
              </p>
            </Subsection>

            <Subsection title="6.4">
              <p>
                Where reproduction rights are subject
                to payment, the Client&apos;s right to
                exercise those rights arises only once
                the relevant invoice has been paid in
                full, unless expressly agreed otherwise
                in writing.
              </p>

              <p>
                Use before the licence becomes
                effective may constitute both a breach
                of contract and an infringement of
                copyright.
              </p>
            </Subsection>

            <Subsection title="6.5">
              <p>
                If an invoice remains unpaid after its
                due date, Steve Gregson Photography may
                suspend ongoing services, including
                image delivery, galleries, downloadable
                pages or other access provided to the
                Client, until the account is brought up
                to date.
              </p>
            </Subsection>

            <Subsection title="6.6">
              <p>
                Where several invoices are outstanding,
                Steve Gregson Photography reserves the
                right, where legally permissible, to
                suspend further services pending
                settlement of overdue sums.
              </p>
            </Subsection>

            <Subsection title="6.7 Payment Method">
              <p>
                Payment by BACS is preferred. Payment
                details will be supplied on the
                relevant invoice.
              </p>
            </Subsection>
          </PolicySection>

          <PolicySection
            id="licensing"
            number="07"
            title="Licensing Types Designated in Invoice"
          >
            <Callout label="Invoice reference">
              Sections 7.1, 7.2 and 7.3 are distinct
              licence options and may be specifically
              referenced on Steve Gregson Photography
              invoices.
            </Callout>

            <Licence
              id="licence-one-year"
              title="7.1 One Year Licence"
              duration="one year (365 days)"
            />

            <Licence
              id="licence-two-year"
              title="7.2 Two Year Licence"
              duration="two years (730 days)"
            />

            <Licence
              id="licence-perpetual"
              title="7.3 Perpetual Licence"
              duration="in perpetuity"
            />
          </PolicySection>

          <PolicySection
            id="editing"
            number="08"
            title="Editing, Selection and Rejection"
          >
            <Subsection title="8.1">
              <p>
                Steve Gregson Photography will
                professionally edit the photographs
                created during a commission and will
                deliver the images the Photographer
                considers to represent the strongest
                and most appropriate coverage of the
                commissioned work.
              </p>
            </Subsection>

            <Subsection title="8.2">
              <p>
                Unless otherwise agreed in advance, the
                Client has no right to reject delivered
                work solely on the basis of
                photographic style, composition,
                selection or editing.
              </p>
            </Subsection>

            <Subsection title="8.3">
              <p>
                No material addition, deletion,
                manipulation or adaptation of a
                Photograph may be made without the
                prior written permission of Steve
                Gregson Photography.
              </p>
            </Subsection>
          </PolicySection>

          <PolicySection
            id="liability"
            number="09"
            title="Liability, Permissions and Indemnity"
          >
            <Subsection title="9.1">
              <p>
                Steve Gregson Photography will take
                reasonable professional care in
                carrying out each commission but shall
                not be responsible for losses arising
                from circumstances outside its
                reasonable control.
              </p>

              <p>
                Nothing in these Terms excludes or
                limits liability where doing so would
                be unlawful.
              </p>
            </Subsection>

            <Subsection title="9.2">
              <p>
                The Client is responsible for ensuring
                that its use of supplied Photographs
                remains within the scope of the licence
                granted.
              </p>

              <p>
                The Client agrees to be responsible for
                claims, losses or reasonable costs
                arising from its unauthorised
                reproduction, distribution or licensing
                of Photographs.
              </p>
            </Subsection>

            <Subsection title="9.3 Permissions, Releases and Third-Party Rights">
              <p>
                Unless otherwise expressly agreed in
                writing, the Client is responsible for
                ensuring that any permissions,
                consents, performance permissions,
                venue permissions, model or performer
                releases, parental permissions,
                trademark permissions or other
                third-party rights required for the
                intended commissioned use have been
                obtained.
              </p>

              <p>
                Steve Gregson Photography does not
                warrant that rights belonging to
                people, venues, artworks, trademarks,
                designs, sets, costumes or other
                material depicted within a Photograph
                are cleared for every possible use.
              </p>

              <p>
                The Client must therefore satisfy
                itself that its intended reproduction
                is appropriately authorised.
              </p>
            </Subsection>

            <Subsection title="9.4 Original Materials">
              <p>
                Where physical originals, prints or
                other irreplaceable materials are
                supplied to a Client, responsibility
                for their reasonable care passes to the
                Client while they remain in its
                possession or under its control.
              </p>

              <p>
                Any loss or damage must be reported
                promptly.
              </p>

              <p>
                Payment of compensation for lost or
                damaged material does not transfer
                copyright or any other rights in that
                material.
              </p>
            </Subsection>
          </PolicySection>

          <PolicySection
            id="applicable-law"
            number="10"
            title="Applicable Law and Agreement"
          >
            <Subsection title="10.1">
              <p>
                These Terms &amp; Conditions and any
                dispute or claim arising from them
                shall be governed by the laws of
                England and Wales.
              </p>

              <p>
                The courts of England and Wales shall
                have jurisdiction, subject to any
                mandatory legal rights that apply.
              </p>
            </Subsection>

            <Subsection title="10.2">
              <p>
                No variation of these Terms shall be
                effective unless agreed in writing by
                Steve Gregson Photography and the
                Client.
              </p>
            </Subsection>

            <Subsection title="10.3">
              <p>
                For the purposes of these Terms, an
                agreement made by email or other
                written electronic communication may
                constitute written agreement where the
                intention of the parties is clear.
              </p>
            </Subsection>

            <Subsection title="10.4 Severability">
              <p>
                If any provision of these Terms is
                found to be invalid or unenforceable,
                the remaining provisions shall
                continue in effect to the extent
                permitted by law.
              </p>
            </Subsection>
          </PolicySection>

          <PolicySection
            id="published-use"
            number="11"
            title="Printed and Published Reproductions"
          >
            <p>
              Where reasonably requested, the Client
              shall supply Steve Gregson Photography
              with evidence of published use of
              supplied Photographs.
            </p>

            <p>
              For significant printed publications,
              Steve Gregson Photography may request up
              to two complimentary copies or relevant
              tear sheets/pages showing the published
              Photographs.
            </p>
          </PolicySection>

          <PolicySection
            id="contact"
            number="12"
            title="Contact"
          >
            <p>
              Questions about these Terms, image
              licensing or additional reproduction
              rights should be directed to:
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

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.subsection}>
      <h3>{title}</h3>
      {children}
    </div>
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

function SidebarGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.sidebarGroup}>
      <p>{title}</p>
      {children}
    </div>
  );
}

function Callout({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={styles.callout}>
      <p>{label}</p>
      <blockquote>{children}</blockquote>
    </aside>
  );
}

function Licence({
  id,
  title,
  duration,
}: {
  id: string;
  title: string;
  duration: string;
}) {
  return (
    <div
      className={styles.licence}
      id={id}
    >
      <h3>{title}</h3>

      <p>
        The fee covers use of the selected
        Photographs for <strong>{duration}</strong>{" "}
        from the date of supply and relates to use
        within the <strong>United Kingdom only</strong>.
      </p>

      <p>The licence includes use:</p>

      <ul>
        <li>
          in programmes, playtexts and freesheets for
          the production;
        </li>

        <li>
          on the website, blog and official
          social-media channels of the Client and
          applicable co-producers;
        </li>

        <li>
          in advertising and publicity for the
          production;
        </li>

        <li>
          for editorial and press use connected with
          the production;
        </li>

        <li>
          for front-of-house display at the venue in
          which the production is photographed;
        </li>

        <li>
          in connection with awards for which the
          production is nominated or which it receives;
        </li>

        <li>in funding applications and reports;</li>

        <li>
          in educational material connected with the
          production.
        </li>
      </ul>

      <p>
        If the production transfers to another theatre
        or venue under different management,
        additional permission and/or licensing must be
        agreed with Steve Gregson Photography unless
        otherwise agreed in writing.
      </p>

      <p>
        This licence also permits cast members to use
        supplied Photographs on their personal
        professional websites. Cast members must
        credit <strong>Steve Gregson Photography</strong>{" "}
        whenever the Photographs are used.
      </p>

      <p>
        Requests from creatives, agencies or other
        third parties, or requests connected with a
        future life, revival, transfer or separate
        exploitation of the production, must be
        referred to Steve Gregson Photography for
        permission and any applicable additional fee.
      </p>

      <p>
        Copyright remains the property of Steve
        Gregson. The Client receives only the rights
        expressly granted by this licence.
      </p>
    </div>
  );
}