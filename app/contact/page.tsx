import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact | Steve Gregson",
  description:
    "Get in touch about theatre, production, rehearsal, portrait and performing arts photography with London photographer Steve Gregson.",
};

export default function ContactPage() {
  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="contact-intro">
          <p className="contact-eyebrow">
            Enquiries
          </p>

          <h1>
            Let&apos;s make
            <br />
            something <em>together.</em>
          </h1>

          <p className="contact-lead">
            Whether you&apos;re planning a production,
            preparing a campaign or simply have an idea
            you&apos;d like to discuss, I&apos;d love to
            hear about it.
          </p>
        </div>

        <aside className="contact-details">
          <div>
            <span>Email</span>
            <a href="mailto:info@stevegregson.com">
              info@stevegregson.com
            </a>
          </div>

          
        </aside>
      </section>

      <section className="contact-enquiry">
        <div className="contact-enquiry-heading">
          <p className="contact-eyebrow">
            Start a conversation
          </p>

          <h2>
            Tell me about
            <br />
            your project.
          </h2>

          <p>
            A few details are useful to get us started.
            If you don&apos;t know everything yet,
            that&apos;s absolutely fine.
          </p>
        </div>

        <ContactForm />
      </section>

      <section className="contact-footer-statement">
        <p>Photography for theatre &amp; performance</p>

        <h2>
          Production.
          <br />
          Rehearsal.
          <br />
          <em>People.</em>
        </h2>
      </section>

      <style>{`
        .contact-page {
          min-height: 100vh;
          overflow-x: hidden;
          background: #11100f;
          color: #f2eee6;
        }

        .contact-hero {
  display: grid;
  grid-template-columns:
    minmax(0, 1.45fr)
    minmax(260px, 0.55fr);
  gap: clamp(4rem, 10vw, 11rem);
  max-width: 94rem;
  margin: 0 auto;
  padding: 9.5rem 6vw 4.5rem;
  align-items: end;
}

        .contact-intro {
          max-width: 70rem;
        }

        .contact-eyebrow,
        .contact-details span,
        .contact-footer-statement > p {
          margin: 0;
          color: #c7a369;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.21em;
          text-transform: uppercase;
        }

        .contact-intro h1,
        .contact-enquiry-heading h2,
        .contact-success h2,
        .contact-footer-statement h2 {
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-weight: 400;
        }

        .contact-intro h1 {
  margin: 1.4rem 0 0;
  font-size: clamp(4rem, 6.5vw, 7rem);
          letter-spacing: -0.06em;
          line-height: 0.88;
        }

        .contact-intro h1 em,
        .contact-footer-statement h2 em {
          color: #c7a369;
          font-weight: 400;
        }

        .contact-lead {
  max-width: 38rem;
  margin: 2rem 0 0;
          color: rgba(242, 238, 230, 0.68);
          font-size: 1.05rem;
          line-height: 1.75;
        }

        .contact-details {
          display: flex;
          padding-bottom: 0.5rem;
          flex-direction: column;
          gap: 2.5rem;
        }

        .contact-details div {
          padding-top: 1rem;
          border-top: 1px solid
            rgba(242, 238, 230, 0.18);
        }

        .contact-details a,
        .contact-details p {
          display: block;
          margin: 0.8rem 0 0;
          color: rgba(242, 238, 230, 0.76);
          font-size: 0.86rem;
          line-height: 1.6;
        }

        .contact-details a {
          transition: color 180ms ease;
        }

        .contact-details a:hover {
          color: #c7a369;
        }

        .contact-enquiry {
  display: grid;
  grid-template-columns:
    minmax(260px, 0.7fr)
    minmax(0, 1.3fr);
  gap: clamp(4rem, 10vw, 11rem);
  margin: 0 6vw;
  padding: 3.5rem 0 8rem;
  border-top: 1px solid
    rgba(242, 238, 230, 0.18);
}

        .contact-enquiry-heading {
          max-width: 31rem;
        }

        .contact-enquiry-heading h2 {
          margin: 1.8rem 0 0;
          font-size: clamp(2.8rem, 5vw, 5.2rem);
          letter-spacing: -0.05em;
          line-height: 0.96;
        }

        .contact-enquiry-heading > p:last-child {
          max-width: 25rem;
          margin: 2rem 0 0;
          color: rgba(242, 238, 230, 0.58);
          font-size: 0.9rem;
          line-height: 1.75;
        }

        .contact-form {
          width: 100%;
          max-width: 54rem;
        }

        .contact-field {
          margin-bottom: 2.4rem;
        }

        .contact-field > label,
        .contact-field-split label {
          display: block;
          margin-bottom: 0.7rem;
          color: rgba(242, 238, 230, 0.55);
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .contact-field input,
        .contact-field select,
        .contact-field textarea {
          width: 100%;
          border: 0;
          border-bottom: 1px solid
            rgba(242, 238, 230, 0.25);
          border-radius: 0;
          outline: 0;
          padding: 0.75rem 0 1rem;
          background: transparent;
          color: #f2eee6;
          font: inherit;
          font-size: 1rem;
          transition: border-color 180ms ease;
        }

        .contact-field input:focus,
        .contact-field select:focus,
        .contact-field textarea:focus {
          border-bottom-color: #c7a369;
        }

        .contact-field input::placeholder,
        .contact-field textarea::placeholder {
          color: rgba(242, 238, 230, 0.3);
        }

        .contact-field select {
          appearance: none;
          cursor: pointer;
        }

        .contact-field select option {
          background: #11100f;
          color: #f2eee6;
        }

        .contact-field textarea {
          min-height: 10rem;
          resize: vertical;
          line-height: 1.6;
        }

        .contact-field-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2.5rem;
        }

        .contact-submit,
        .contact-success button {
          border: 1px solid
            rgba(199, 163, 105, 0.65);
          padding: 1rem 1.4rem;
          background: transparent;
          color: #f2eee6;
          cursor: pointer;
          font-size: 0.56rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
          transition:
            background 180ms ease,
            color 180ms ease,
            border-color 180ms ease;
        }

        .contact-submit:hover,
        .contact-success button:hover {
          border-color: #c7a369;
          background: #c7a369;
          color: #11100f;
        }

        .contact-submit:disabled {
          cursor: wait;
          opacity: 0.55;
        }

        .contact-form-error {
          margin: -0.5rem 0 1.5rem;
          color: #d99b8e;
          font-size: 0.8rem;
          line-height: 1.5;
        }

        .contact-success {
          max-width: 38rem;
          padding-top: 0.5rem;
        }

        .contact-success-eyebrow {
          margin: 0;
          color: #c7a369;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.21em;
          text-transform: uppercase;
        }

        .contact-success h2 {
          margin: 1.5rem 0;
          font-size: clamp(3rem, 5vw, 5rem);
          letter-spacing: -0.05em;
          line-height: 1;
        }

        .contact-success > p:not(
          .contact-success-eyebrow
        ) {
          max-width: 30rem;
          margin: 0 0 2rem;
          color: rgba(242, 238, 230, 0.68);
          line-height: 1.75;
        }

        .contact-footer-statement {
          display: flex;
          min-height: 70svh;
          padding: 8rem 7vw 6rem;
          flex-direction: column;
          justify-content: center;
          border-top: 1px solid
            rgba(242, 238, 230, 0.16);
        }

        .contact-footer-statement h2 {
          max-width: 75rem;
          margin: 2rem 0 0;
          font-size: clamp(4rem, 8vw, 8rem);
          letter-spacing: -0.06em;
          line-height: 0.88;
        }

        @media (max-width: 850px) {
          .contact-hero {
            grid-template-columns: 1fr;
            gap: 5rem;
            min-height: auto;
            padding-top: 10rem;
          }

          .contact-details {
            display: grid;
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }

          .contact-enquiry {
            grid-template-columns: 1fr;
            gap: 5rem;
          }
        }

        @media (max-width: 620px) {
          
        .contact-hero {
  gap: 2rem;
  padding:
    0.75rem 1.5rem
    2.25rem;
}

          ..contact-intro h1 {
  font-size: clamp(3rem, 14vw, 4.6rem);
  line-height: 0.9;
}

          .contact-details {
  grid-template-columns: 1fr;
  gap: 0.9rem;
}
.contact-details {
  width: 100%;
  text-align: center;
}

.contact-details div {
  padding-top: 0.65rem;
  padding-bottom: 0;
  text-align: center;
}
  .contact-details {
  margin-bottom: -1rem;
}

.contact-details a,
.contact-details p {
  text-align: center;
}
  .contact-details div {
  padding-top: 0.65rem;
}

.contact-details a,
.contact-details p {
  margin-top: 0.35rem;
  margin-bottom: 0;
}

.contact-details {
  gap: 0;
  padding-bottom: 0;
}
          .contact-enquiry {
  gap: 1.5rem;
  margin: 0 1.5rem;
  padding: 0.25rem 0 4rem;
}
.contact-enquiry-heading h2 {
  margin-top: 0.9rem;
  font-size: clamp(2.6rem, 12vw, 3.6rem);
}

.contact-enquiry-heading > p:last-child {
  margin-top: 1rem;
  line-height: 1.55;
}
.contact-enquiry-heading {
  max-width: 22rem;
  margin: 0 auto;
  padding-top: 0.75rem;
  text-align: center;
}

.contact-form {
  margin: 0 auto;
  text-align: center;
}

.contact-field > label,
.contact-field-split label {
  text-align: center;
}

.contact-field input,
.contact-field select,
.contact-field textarea {
  text-align: center;
}
.contact-field {
  margin-bottom: 1rem;
}

.contact-field > label,
.contact-field-split label {
  margin-bottom: 0.25rem;
  text-align: center;
}

.contact-field input,
.contact-field select,
.contact-field textarea {
  padding-top: 0.4rem;
  padding-bottom: 0.65rem;
  text-align: center;
}
          .contact-field-split {
            grid-template-columns: 1fr;
            gap: 2.4rem;
          }

          .contact-footer-statement {
  align-items: center;
  min-height: 0;
  padding: 3rem 1.5rem 3.5rem;
  justify-content: center;
  text-align: center;
}

.contact-footer-statement h2 {
  max-width: 22rem;
  margin-top: 1.25rem;
  font-size: clamp(3rem, 14vw, 4.5rem);
  line-height: 0.9;
}
        }
      `}</style>
    </main>
  );
}