"use client";

import {
  FormEvent,
  useState,
} from "react";

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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

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
      <div className="contact-success">
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
      <div className="contact-field">
        <label htmlFor="name">
          Name
        </label>

        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
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

          <option value="Portraits / headshots">
            Portraits / headshots
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