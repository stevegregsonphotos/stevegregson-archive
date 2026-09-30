"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { track } from "@vercel/analytics";

import {
  HONEYPOT_FIELD,
  STARTED_FIELD,
} from "../../lib/contact-spam";
import { getVisitTrail } from "../../lib/visit-trail";

type ContactResponse = {
  ok: boolean;
  message?: string;
};

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const successRef = useRef<HTMLDivElement | null>(null);

  // When the form appeared, so the server can tell a person from a bot.
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!submitted) startedAtRef.current = Date.now();
  }, [submitted]);

  useEffect(() => {
    if (submitted) {
      successRef.current?.focus();
    }
  }, [submitted]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set(STARTED_FIELD, String(startedAtRef.current));

    // What brought them here, for the enquiry email.
    const visit = getVisitTrail();
    formData.set("visitReferrer", visit.referrer);
    formData.set("visitPages", visit.pages.join("\n"));

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/contact",
        {
          method: "POST",
          body: formData,
        },
      );

      const data =
        (await response.json()) as ContactResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.message ??
            "Your enquiry could not be sent.",
        );
      }

      form.reset();
      setSubmitted(true);

      try {
        track("Enquiry sent", {
          source: visit.referrer || "direct",
          landing: visit.landing || "/contact",
        });
      } catch {
        // Analytics is optional.
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Your enquiry could not be sent.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        ref={successRef}
        className="contact-success"
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        <p className="contact-success-eyebrow">
          Enquiry sent
        </p>

        <h2>Thank you.</h2>

        <p>
          Your message has been sent successfully.
          I&apos;ll get back to you as soon as I can.
        </p>

        <button
          type="button"
          onClick={() => setSubmitted(false)}
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form
      className="contact-form"
      onSubmit={handleSubmit}
    >
      {/* Left empty by people (they never see it); bots fill it in. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="contact-field">
        <label htmlFor="name">
          Name
        </label>

        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={120}
          required
        />
      </div>

      <div className="contact-field">
        <label htmlFor="email">
          Email address
        </label>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </div>

      <div className="contact-field">
        <label htmlFor="company">
          Company / Production
        </label>

        <input
          id="company"
          name="company"
          type="text"
          autoComplete="organization"
          maxLength={160}
        />
      </div>

      <div className="contact-field">
        <label htmlFor="projectType">
          What are you looking for?
        </label>

        <select
          id="projectType"
          name="projectType"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Select an option
          </option>

          <option value="Production photography">
            Production photography
          </option>

          <option value="Rehearsal photography">
            Rehearsal photography
          </option>

          <option value="Campaign / publicity">
            Campaign / publicity
          </option>

          <option value="Education / training">
            Education / training
          </option>

          <option value="Other">
            Other
          </option>
        </select>
      </div>

      <div className="contact-field contact-field-split">
        <div>
          <label htmlFor="date">
            Shoot / production date
          </label>

          <input
            id="date"
            name="date"
            type="text"
            maxLength={80}
            placeholder="If known"
          />
        </div>

        <div>
          <label htmlFor="location">
            Location / venue
          </label>

          <input
            id="location"
            name="location"
            type="text"
            maxLength={160}
          />
        </div>
      </div>

      <div className="contact-field">
        <label htmlFor="message">
          Tell me about the project
        </label>

        <textarea
          id="message"
          name="message"
          rows={7}
          maxLength={5000}
          required
        />
      </div>

      {error ? (
        <p
          className="contact-form-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="contact-submit"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? "Sending…"
          : "Send enquiry"}
      </button>
    </form>
  );
}