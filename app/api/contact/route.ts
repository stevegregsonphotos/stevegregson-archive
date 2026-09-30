import { NextResponse } from "next/server";
import { Resend } from "resend";

import {
  isContactRateLimited,
  recordContactSubmission,
} from "../../../lib/contact-rate-limit";
import {
  checkContactSpam,
  HONEYPOT_FIELD,
  STARTED_FIELD,
} from "../../../lib/contact-spam";

export const runtime = "nodejs";

function readField(
  formData: FormData,
  name: string,
) {
  const value = formData.get(name);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Which website sent them, e.g. "google.com"; empty for direct visits. */
function readReferrer(formData: FormData) {
  const value = readField(formData, "visitReferrer").toLowerCase();
  return /^[a-z0-9.-]{1,100}$/.test(value) ? value : "";
}

/** The pages of this site they viewed before enquiring, oldest first. */
function readPages(formData: FormData) {
  return readField(formData, "visitPages")
    .split("\n")
    .map((page) => page.trim())
    .filter((page) => /^\/[A-Za-z0-9\-_/%.]{0,150}$/.test(page))
    .slice(-12);
}

function describeSource(referrer: string) {
  if (!referrer) return "Direct visit or unknown";
  if (/(^|\.)google\./.test(referrer)) return `Google (${referrer})`;
  if (/(^|\.)bing\.com$/.test(referrer)) return "Bing";
  if (/chatgpt\.com|openai\.com/.test(referrer)) return "ChatGPT";
  if (/perplexity\.ai/.test(referrer)) return "Perplexity";
  if (/instagram\.com/.test(referrer)) return "Instagram";
  if (/facebook\.com/.test(referrer)) return "Facebook";
  if (/linkedin\.com/.test(referrer)) return "LinkedIn";
  return referrer;
}

export async function POST(request: Request) {
  try {
    if (
      await isContactRateLimited(request)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Too many enquiries have been sent. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "3600",
          },
        },
      );
    }

    const apiKey =
      process.env.RESEND_API_KEY;

    const from =
      process.env.PROOFING_EMAIL_FROM;

    const photographerEmail =
      process.env.PROOFING_PHOTOGRAPHER_EMAIL;

    if (!apiKey || !from || !photographerEmail) {
      console.error(
        "Contact form email configuration is missing.",
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "The contact form is temporarily unavailable.",
        },
        { status: 500 },
      );
    }

    const formData =
      await request.formData();

    const name =
      readField(formData, "name");

    const email =
      readField(formData, "email");

    const company =
      readField(formData, "company");

    const projectType =
      readField(formData, "projectType");

    const date =
      readField(formData, "date");

    const location =
      readField(formData, "location");

    const message =
      readField(formData, "message");

    if (
      !name ||
      !email ||
      !projectType ||
      !message
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Please complete the required fields.",
        },
        { status: 400 },
      );
    }

    if (
      name.length > 120 ||
      email.length > 254 ||
      company.length > 160 ||
      projectType.length > 120 ||
      date.length > 80 ||
      location.length > 160 ||
      message.length > 5000
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "One or more fields are too long.",
        },
        { status: 400 },
      );
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Please enter a valid email address.",
        },
        { status: 400 },
      );
    }

    const verdict = checkContactSpam({
      honeypot: readField(formData, HONEYPOT_FIELD),
      startedAt: readField(formData, STARTED_FIELD),
      name,
      email,
      company,
      date,
      location,
      message,
    });

    if (verdict.spam) {
      // Tell the sender it worked so bots don't adapt; nothing is emailed.
      console.warn(`Contact form: dropped likely spam (${verdict.reason}).`);
      return NextResponse.json({ ok: true });
    }

    const source = describeSource(readReferrer(formData));
    const pages = readPages(formData);
    const siteOrigin = "https://www.stevegregson.com";

    const resend =
      new Resend(apiKey);

    const safeName =
      escapeHtml(name);

    const safeEmail =
      escapeHtml(email);

    const safeCompany =
      escapeHtml(company);

    const safeProjectType =
      escapeHtml(projectType);

    const safeDate =
      escapeHtml(date);

    const safeLocation =
      escapeHtml(location);

    const safeMessage =
      escapeHtml(message).replaceAll(
        "\n",
        "<br />",
      );

    const { error } =
      await resend.emails.send({
        from: `Steve Gregson Photography - Contact <${from}>`,
        to: photographerEmail,
        replyTo: email,
        subject: `New enquiry — ${name}`,
        text: [
          "New website enquiry",
          "",
          `Name: ${name}`,
          `Email: ${email}`,
          `Company / Production: ${
            company || "Not provided"
          }`,
          `Enquiry type: ${projectType}`,
          `Shoot / production date: ${
            date || "Not provided"
          }`,
          `Location / venue: ${
            location || "Not provided"
          }`,
          "",
          "Message:",
          message,
          "",
          "How they found you",
          `Arrived from: ${source}`,
          `Pages viewed: ${
            pages.length ? pages.join(" → ") : "Not recorded"
          }`,
        ].join("\n"),
        html: `
          <div
            style="
              margin:0;
              padding:40px;
              background:#11100f;
              color:#f2eee6;
              font-family:Arial,Helvetica,sans-serif;
            "
          >
            <div
              style="
                max-width:680px;
                margin:0 auto;
              "
            >
              <p
                style="
                  margin:0 0 24px;
                  color:#c7a369;
                  font-size:11px;
                  font-weight:700;
                  letter-spacing:2px;
                  text-transform:uppercase;
                "
              >
                Website enquiry
              </p>

              <h1
                style="
                  margin:0 0 36px;
                  color:#f2eee6;
                  font-family:Georgia,serif;
                  font-size:38px;
                  font-weight:400;
                  line-height:1.1;
                "
              >
                New enquiry from ${safeName}
              </h1>

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="
                  border-collapse:collapse;
                  color:#f2eee6;
                  font-size:14px;
                  line-height:1.6;
                "
              >
                <tr>
                  <td
                    style="
                      width:190px;
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                      color:#c7a369;
                      font-size:10px;
                      font-weight:700;
                      letter-spacing:1.5px;
                      text-transform:uppercase;
                    "
                  >
                    Name
                  </td>

                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                    "
                  >
                    ${safeName}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                      color:#c7a369;
                      font-size:10px;
                      font-weight:700;
                      letter-spacing:1.5px;
                      text-transform:uppercase;
                    "
                  >
                    Email
                  </td>

                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                    "
                  >
                    ${safeEmail}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                      color:#c7a369;
                      font-size:10px;
                      font-weight:700;
                      letter-spacing:1.5px;
                      text-transform:uppercase;
                    "
                  >
                    Company / Production
                  </td>

                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                    "
                  >
                    ${safeCompany || "Not provided"}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                      color:#c7a369;
                      font-size:10px;
                      font-weight:700;
                      letter-spacing:1.5px;
                      text-transform:uppercase;
                    "
                  >
                    Enquiry
                  </td>

                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                    "
                  >
                    ${safeProjectType}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                      color:#c7a369;
                      font-size:10px;
                      font-weight:700;
                      letter-spacing:1.5px;
                      text-transform:uppercase;
                    "
                  >
                    Date
                  </td>

                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                    "
                  >
                    ${safeDate || "Not provided"}
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                      color:#c7a369;
                      font-size:10px;
                      font-weight:700;
                      letter-spacing:1.5px;
                      text-transform:uppercase;
                    "
                  >
                    Location
                  </td>

                  <td
                    style="
                      padding:13px 0;
                      border-top:1px solid rgba(242,238,230,0.18);
                    "
                  >
                    ${safeLocation || "Not provided"}
                  </td>
                </tr>
              </table>

              <div
                style="
                  margin-top:36px;
                  padding-top:24px;
                  border-top:1px solid rgba(242,238,230,0.18);
                "
              >
                <p
                  style="
                    margin:0 0 12px;
                    color:#c7a369;
                    font-size:10px;
                    font-weight:700;
                    letter-spacing:1.5px;
                    text-transform:uppercase;
                  "
                >
                  Message
                </p>

                <p
                  style="
                    margin:0;
                    color:#f2eee6;
                    font-size:15px;
                    line-height:1.75;
                  "
                >
                  ${safeMessage}
                </p>
              </div>

              <div
                style="
                  margin-top:36px;
                  padding-top:24px;
                  border-top:1px solid rgba(242,238,230,0.18);
                  font-size:13px;
                  line-height:1.7;
                  color:rgba(242,238,230,0.75);
                "
              >
                <p
                  style="
                    margin:0 0 12px;
                    color:#c7a369;
                    font-size:10px;
                    font-weight:700;
                    letter-spacing:1.5px;
                    text-transform:uppercase;
                  "
                >
                  How they found you
                </p>
                <p style="margin:0 0 6px;">
                  Arrived from: ${escapeHtml(source)}
                </p>
                <p style="margin:0;">
                  Pages viewed: ${
                    pages.length
                      ? pages
                          .map(
                            (page) =>
                              `<a href="${siteOrigin}${escapeHtml(page)}" style="color:#c7a369;">${escapeHtml(page)}</a>`,
                          )
                          .join(" → ")
                      : "Not recorded"
                  }
                </p>
              </div>

              <p
                style="
                  margin:40px 0 0;
                  color:rgba(242,238,230,0.5);
                  font-size:11px;
                  line-height:1.6;
                "
              >
                Reply directly to this email to respond
                to ${safeName}.
              </p>
            </div>
          </div>
        `,
      });

    if (error) {
      console.error(
        "Resend contact form error:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "Your enquiry could not be sent. Please try again.",
        },
        { status: 500 },
      );
    }

    await recordContactSubmission(
      request,
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Contact form error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Your enquiry could not be sent. Please try again.",
      },
      { status: 500 },
    );
  }
}