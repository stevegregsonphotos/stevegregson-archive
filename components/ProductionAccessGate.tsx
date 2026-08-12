"use client";

import {
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type ProductionAccessGateProps = {
  slug: string;
  title: string;
  venue: string;
  year: number;
};

type UnlockResponse = {
  ok: boolean;
  message?: string;
};

export default function ProductionAccessGate({
  slug,
  title,
  venue,
  year,
}: ProductionAccessGateProps) {
  const router = useRouter();

  const [password, setPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!password.trim()) {
      setMessage("Enter the password.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(
          slug,
        )}/unlock`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            password,
          }),
        },
      );

      const data =
        (await response.json()) as UnlockResponse;

      if (!response.ok || !data.ok) {
        setMessage(
          data.message ??
            "The password is incorrect.",
        );
        return;
      }

      setPassword("");
      router.refresh();
    } catch {
      setMessage(
        "The production could not be unlocked. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="production-access-page">
      <section className="production-access-panel">
        <p className="production-access-eyebrow">
          Private gallery
        </p>

        <h1>{title}</h1>

        <p className="production-access-meta">
          {venue}
          <span aria-hidden="true">
            {" "}
            ·{" "}
          </span>
          {year}
        </p>

        <p className="production-access-copy">
          This production is password protected.
          Enter the password to view the gallery.
        </p>

        <form
          onSubmit={handleSubmit}
          className="production-access-form"
        >
          <label
            htmlFor="production-password"
            className="production-access-label"
          >
            Password
          </label>

          <div className="production-access-field">
            <input
              id="production-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              autoComplete="current-password"
              autoFocus
              disabled={isSubmitting}
            />

            <button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Unlocking…"
                : "View gallery"}
              {!isSubmitting ? (
                <span aria-hidden="true">
                  →
                </span>
              ) : null}
            </button>
          </div>

          {message ? (
            <p
              className="production-access-message"
              role="alert"
            >
              {message}
            </p>
          ) : null}
        </form>
      </section>

      <style jsx>{`
        .production-access-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          background: #11100f;
          color: #f2eee6;
          padding: 9rem 6vw 7rem;
        }

        .production-access-panel {
          width: min(100%, 58rem);
        }

        .production-access-eyebrow {
          margin: 0;
          color: #c7a369;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.21em;
          text-transform: uppercase;
        }

        h1 {
          max-width: 12ch;
          margin: 2rem 0 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(
            4rem,
            7vw,
            7.5rem
          );
          font-weight: 400;
          letter-spacing: -0.058em;
          line-height: 0.92;
          text-wrap: balance;
        }

        .production-access-meta {
          margin: 1.5rem 0 0;
          color: rgba(
            242,
            238,
            230,
            0.48
          );
          font-size: 0.56rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .production-access-copy {
          max-width: 34rem;
          margin: 3.5rem 0 0;
          color: rgba(
            242,
            238,
            230,
            0.62
          );
          font-size: 1rem;
          line-height: 1.75;
        }

        .production-access-form {
          width: min(100%, 32rem);
          margin-top: 2.5rem;
        }

        .production-access-label {
          display: block;
          margin-bottom: 0.8rem;
          color: #c7a369;
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .production-access-field {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) auto;
          border-bottom: 1px solid
            rgba(
              242,
              238,
              230,
              0.28
            );
          transition:
            border-color 220ms ease;
        }

        .production-access-field:focus-within {
          border-color: #c7a369;
        }

        input {
          min-width: 0;
          border: 0;
          outline: 0;
          padding: 0.95rem 0;
          background: transparent;
          color: #f2eee6;
          font: inherit;
          font-size: 1rem;
        }

        button {
          display: inline-flex;
          align-items: center;
          gap: 0.7rem;
          border: 0;
          padding: 0 0 0 1.5rem;
          background: transparent;
          color: #c7a369;
          cursor: pointer;
          font-size: 0.54rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        button:disabled {
          cursor: wait;
          opacity: 0.55;
        }

        button span {
          transition:
            transform 180ms ease;
        }

        button:hover:not(:disabled)
          span {
          transform: translateX(
            0.25rem
          );
        }

        button:focus-visible {
          outline: 1px solid
            #c7a369;
          outline-offset: 0.45rem;
        }

        .production-access-message {
          margin: 1rem 0 0;
          color: #ffb3a7;
          font-size: 0.8rem;
          line-height: 1.5;
        }

        @media (max-width: 700px) {
          .production-access-page {
            align-items: flex-start;
            padding: 10rem 1.4rem 6rem;
          }

          h1 {
            max-width: none;
            font-size: clamp(
              3.4rem,
              15vw,
              5rem
            );
          }

          .production-access-copy {
            margin-top: 2.75rem;
          }

          .production-access-field {
            grid-template-columns: 1fr;
          }

          button {
            width: fit-content;
            padding: 0.85rem 0 0.8rem;
          }
        }

        @media (
          prefers-reduced-motion:
            reduce
        ) {
          .production-access-field,
          button span {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}