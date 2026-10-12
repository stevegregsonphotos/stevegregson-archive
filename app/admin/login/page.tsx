import type { Metadata } from "next";
import Link from "next/link";
import PasskeyLoginButton from "../../../components/admin/PasskeyLoginButton";
import { hasPasskeys, passwordSignInAllowed } from "../../../lib/passkeys";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Backstage Login | Steve Gregson Archive",
  robots: {
    index: false,
    follow: false,
  },
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
    returnTo?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const { error, next, returnTo } = await searchParams;
  const destination = next || returnTo;
  const safeNext = destination?.startsWith("/") && !destination.startsWith("//") ? destination : undefined;
  const [passwordAllowed, passkeysReady] = await Promise.all([passwordSignInAllowed(), hasPasskeys()]);

  const errorMessage =
    error === "invalid"
      ? "The username or password was not recognised."
      : error === "rate_limited"
        ? "Too many unsuccessful sign-in attempts. Please wait 15 minutes before trying again."
        : error === "passkey_only"
          ? "Password sign-in is switched off. Please use Touch ID / Face ID."
        : error === "configuration"
          ? "Backstage login is not configured correctly. Check the development terminal."
          : null;

  return (
    <main className="backstage-login">
      <header className="backstage-login-header">
        <Link href="/">
          <span>Steve Gregson</span>
          <span>Archive</span>
        </Link>

        <Link href="/">
          View website
        </Link>
      </header>

      <section className="backstage-login-shell">
        <div className="backstage-login-intro">
          <p>Private archive tools</p>
          <h1>Backstage</h1>

          <div className="backstage-login-rule" />

          <p className="backstage-login-lead">
            Sign in to upload, prepare and publish
            work to the Steve Gregson Archive.
          </p>
        </div>

        <form
          action="/api/admin/login"
          method="post"
          className="backstage-login-form"
        >
          {destination?.startsWith("/") && !destination.startsWith("//") ? (
            <input type="hidden" name="next" value={destination} />
          ) : null}
          <div className="backstage-login-form-heading">
            <p>Authorised access</p>
            <h2>Sign in</h2>
          </div>

          {errorMessage ? (
            <p
              className="backstage-login-error"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          {passkeysReady || !passwordAllowed ? <PasskeyLoginButton next={safeNext} only={!passwordAllowed} /> : null}

          {passwordAllowed ? (<>
          <label>
            <span>Username</span>

            <input
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
            />
          </label>

          <label>
            <span>Password</span>

            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit">
            <span>Enter Backstage</span>
            <span aria-hidden="true">→</span>
          </button>
          </>) : null}
        </form>
      </section>

      <style>{`
        .backstage-passkey { display: grid; gap: 0.9rem; }
        .backstage-login-form .backstage-passkey-button {
          justify-content: center; gap: 0.6rem; margin-top: 0; min-height: 3.2rem;
          border: 1px solid rgba(242, 238, 230, 0.28); padding: 0.9rem 1.2rem;
          background: #f2eee6; color: #11100f;
          font-size: 0.82rem; font-weight: 600; letter-spacing: 0.01em; text-transform: none;
        }
        .backstage-login-form .backstage-passkey-button:disabled { opacity: 0.6; cursor: progress; }
        .backstage-passkey-or { position: relative; margin: 0.2rem 0; text-align: center; color: rgba(242, 238, 230, 0.45); font-size: 0.72rem; }
        .backstage-passkey-or::before { content: ""; position: absolute; top: 50%; right: 0; left: 0; border-top: 1px solid rgba(242, 238, 230, 0.14); }
        .backstage-passkey-or span { position: relative; padding: 0 0.8rem; background: #0b0a09; }
        .backstage-passkey { margin-bottom: 1.6rem; }
        .backstage-login {
          min-height: 100svh;
          background: #11100f;
          color: #f2eee6;
        }

        .backstage-login-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 7rem;
          padding: 0 4vw;
          border-bottom: 1px solid rgba(242, 238, 230, 0.14);
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .backstage-login-header > a:first-child {
          display: flex;
          flex-direction: column;
          gap: 0.12rem;
        }

        .backstage-login-header
          > a:first-child
          span:last-child {
          color: rgba(242, 238, 230, 0.46);
        }

        .backstage-login-header > a:last-child {
          color: rgba(242, 238, 230, 0.6);
        }

        .backstage-login-shell {
          display: grid;
          grid-template-columns:
            minmax(0, 1.2fr)
            minmax(22rem, 0.65fr);
          gap: clamp(4rem, 9vw, 10rem);
          align-items: center;
          width: min(92%, 88rem);
          min-height: calc(100svh - 7rem);
          margin: 0 auto;
          padding: 6rem 0;
        }

        .backstage-login-intro > p:first-child,
        .backstage-login-form-heading > p {
          margin: 0;
          color: #c7a369;
          font-size: 0.53rem;
          font-weight: 700;
          letter-spacing: 0.19em;
          text-transform: uppercase;
        }

        .backstage-login-intro h1 {
          margin: 2rem 0 0;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(5rem, 11vw, 11rem);
          font-weight: 400;
          letter-spacing: -0.07em;
          line-height: 0.82;
        }

        .backstage-login-rule {
          width: min(100%, 42rem);
          margin: 4rem 0 2.5rem;
          border-top: 1px solid rgba(242, 238, 230, 0.2);
        }

        .backstage-login-lead {
          max-width: 34rem;
          margin: 0;
          color: rgba(242, 238, 230, 0.62);
          line-height: 1.75;
        }

        .backstage-login-form {
          border: 1px solid rgba(242, 238, 230, 0.18);
          padding: clamp(2rem, 4vw, 3.5rem);
          background: #0b0a09;
        }

        .backstage-login-form-heading h2 {
          margin: 1.2rem 0 3.5rem;
          font-family:
            "Iowan Old Style",
            "Palatino Linotype",
            Georgia,
            serif;
          font-size: clamp(3rem, 5vw, 5rem);
          font-weight: 400;
          letter-spacing: -0.055em;
          line-height: 0.9;
        }

        .backstage-login-form label {
          display: block;
          margin-top: 2rem;
        }

        .backstage-login-form label > span {
          display: block;
          margin-bottom: 0.8rem;
          color: rgba(242, 238, 230, 0.52);
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .backstage-login-form input {
          width: 100%;
          border: 0;
          border-bottom: 1px solid rgba(242, 238, 230, 0.3);
          border-radius: 0;
          padding: 0.9rem 0;
          outline: none;
          background: transparent;
          color: #f2eee6;
          font: inherit;
        }

        .backstage-login-form input:focus {
          border-color: #c7a369;
        }

        .backstage-login-error {
          margin: -1.5rem 0 2.5rem;
          border-left: 2px solid #c7a369;
          padding-left: 1rem;
          color: #e4cda8;
          font-size: 0.8rem;
          line-height: 1.6;
        }

        .backstage-login-form button {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          margin-top: 4rem;
          border: 0;
          padding: 1.4rem 1.5rem;
          cursor: pointer;
          background: #c7a369;
          color: #11100f;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .backstage-login-form button
          span:last-child {
          font-size: 1.2rem;
        }

        @media (max-width: 800px) {
          .backstage-login-header {
            min-height: 6rem;
            padding-inline: 1.4rem;
          }

          .backstage-login-shell {
            grid-template-columns: 1fr;
            gap: 5rem;
            width: calc(100% - 2.8rem);
            min-height: auto;
          }

          .backstage-login-intro h1 {
            font-size: clamp(4.5rem, 24vw, 7rem);
          }
        }
      `}</style>
    </main>
  );
}