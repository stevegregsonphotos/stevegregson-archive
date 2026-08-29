import { NextResponse } from "next/server";
import { Resend } from "resend";

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

export async function POST(request: Request) {
  try {
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
        from,
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