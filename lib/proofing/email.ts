import { Resend } from "resend";

type ProofingSubmissionEmailOptions = {
  galleryTitle: string;
  clientEmail: string;
  filenames: string[];
  submittedAt: string;
  isUpdate?: boolean;
};

function getEmailConfig() {
  const apiKey =
    process.env.RESEND_API_KEY;

  const from =
    process.env.PROOFING_EMAIL_FROM;

  const photographerEmail =
    process.env.PROOFING_PHOTOGRAPHER_EMAIL;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured.",
    );
  }

  if (!from) {
    throw new Error(
      "PROOFING_EMAIL_FROM is not configured.",
    );
  }

  if (!photographerEmail) {
    throw new Error(
      "PROOFING_PHOTOGRAPHER_EMAIL is not configured.",
    );
  }

  return {
    apiKey,
    from,
    photographerEmail,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSubmissionDate(
  submittedAt: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/London",
    },
  ).format(new Date(submittedAt));
}

export async function sendProofingSubmissionEmails({
  galleryTitle,
  clientEmail,
  filenames,
  submittedAt,
  isUpdate = false,
}: ProofingSubmissionEmailOptions) {
  const {
    apiKey,
    from,
    photographerEmail,
  } = getEmailConfig();

  const resend = new Resend(apiKey);

  const photographCount =
    filenames.length;

  const photographWord =
    photographCount === 1
      ? "photograph"
      : "photographs";

  const formattedDate =
    formatSubmissionDate(submittedAt);

  /*
   * Deliberately comma-separated so this can
   * be copied directly into Lightroom.
   */
  const lightroomFilenames =
    filenames.join(", ");

  const safeGalleryTitle =
    escapeHtml(galleryTitle);

  const safeClientEmail =
    escapeHtml(clientEmail);

  const safeFilenames =
    escapeHtml(lightroomFilenames);

  const safeDate =
    escapeHtml(formattedDate);

  /*
   * Wording changes depending on whether this
   * is the client's first submission or a
   * replacement of an earlier submission.
   */

  const photographerSubject = isUpdate
    ? `Proofing selection updated — ${galleryTitle}`
    : `Proofing selection submitted — ${galleryTitle}`;

  const photographerHeading = isUpdate
    ? "Proofing selection updated"
    : "New proofing selection";

  const photographerIntro = isUpdate
    ? "A client has updated their previously submitted photograph selection."
    : "A client has submitted their final photograph selection.";

  const clientSubject = isUpdate
    ? `Your updated photograph selection — ${galleryTitle}`
    : `Your photograph selection — ${galleryTitle}`;

  const clientHeading = isUpdate
    ? "Updated selection received"
    : "Selection received";

  const clientIntro = isUpdate
    ? `
      Thank you. We've received your updated
      photograph selection for
      <strong>${safeGalleryTitle}</strong>.
    `
    : `
      Thank you for submitting your
      photograph selection for
      <strong>${safeGalleryTitle}</strong>.
    `;

  const clientConfirmation = isUpdate
    ? "Your updated selection has been received successfully and replaces your previous submission."
    : "Your selection has been received successfully.";

  /*
   * Photographer notification
   */

  const photographerEmailResult =
    await resend.emails.send({
      from,

      to: photographerEmail,

      subject: photographerSubject,

      replyTo: clientEmail,

      text: [
        isUpdate
          ? "A client has updated a previously submitted proofing selection."
          : "A client has submitted a proofing selection.",
        "",
        `Gallery: ${galleryTitle}`,
        `Client: ${clientEmail}`,
        `Selection: ${photographCount} ${photographWord}`,
        `${isUpdate ? "Updated" : "Submitted"}: ${formattedDate}`,
        "",
        isUpdate
          ? "This selection replaces the client's previous submitted selection."
          : "This is the client's submitted selection.",
        "",
        "Lightroom filenames:",
        lightroomFilenames,
      ].join("\n"),

      html: `
        <div style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.6;">
          <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8b7656;">
            Steve Gregson Photography
          </p>

          <h1 style="font-size:28px;font-weight:400;margin:0 0 24px;">
            ${photographerHeading}
          </h1>

          <p>
            ${photographerIntro}
          </p>

          ${
            isUpdate
              ? `
                <p style="padding:12px 14px;background:#f3f1ed;">
                  This selection replaces the
                  client's previous submitted
                  selection.
                </p>
              `
              : ""
          }

          <table
            cellpadding="0"
            cellspacing="0"
            style="margin:24px 0;"
          >
            <tr>
              <td style="padding:5px 20px 5px 0;color:#777;">
                Gallery
              </td>
              <td style="padding:5px 0;">
                ${safeGalleryTitle}
              </td>
            </tr>

            <tr>
              <td style="padding:5px 20px 5px 0;color:#777;">
                Client
              </td>
              <td style="padding:5px 0;">
                ${safeClientEmail}
              </td>
            </tr>

            <tr>
              <td style="padding:5px 20px 5px 0;color:#777;">
                Selection
              </td>
              <td style="padding:5px 0;">
                ${photographCount} ${photographWord}
              </td>
            </tr>

            <tr>
              <td style="padding:5px 20px 5px 0;color:#777;">
                ${isUpdate ? "Updated" : "Submitted"}
              </td>
              <td style="padding:5px 0;">
                ${safeDate}
              </td>
            </tr>
          </table>

          <p style="margin-bottom:8px;">
            <strong>Lightroom filenames</strong>
          </p>

          <div
            style="
              padding:16px;
              background:#f3f1ed;
              font-family:monospace;
              font-size:13px;
              line-height:1.7;
            "
          >
            ${safeFilenames}
          </div>
        </div>
      `,
    });

  if (photographerEmailResult.error) {
    throw new Error(
      `Photographer email failed: ${
        photographerEmailResult.error.message
      }`,
    );
  }

  /*
   * Client confirmation
   */

  const clientEmailResult =
    await resend.emails.send({
      from,

      to: clientEmail,

      subject: clientSubject,

      replyTo: photographerEmail,

      text: [
        isUpdate
          ? "Thank you for updating your photograph selection."
          : "Thank you for submitting your photograph selection.",
        "",
        `Gallery: ${galleryTitle}`,
        `Selection: ${photographCount} ${photographWord}`,
        `${isUpdate ? "Updated" : "Submitted"}: ${formattedDate}`,
        "",
        isUpdate
          ? "Your updated selection has been received successfully and replaces your previous submission."
          : "Your selection has been received successfully.",
        "",
        "Steve Gregson Photography",
      ].join("\n"),

      html: `
        <div style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.7;">
          <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8b7656;">
            Steve Gregson Photography
          </p>

          <h1 style="font-size:30px;font-weight:400;margin:0 0 24px;">
            ${clientHeading}
          </h1>

          <p>
            ${clientIntro}
          </p>

          <p>
            We've received
            <strong>
              ${photographCount} ${photographWord}
            </strong>
            in your ${
              isUpdate
                ? "updated"
                : "final"
            } selection.
          </p>

          <p style="color:#777;">
            ${isUpdate ? "Updated" : "Submitted"} ${safeDate}
          </p>

          <p style="margin-top:32px;">
            ${clientConfirmation}
          </p>

          <p style="margin-top:32px;">
            Steve Gregson Photography
          </p>
        </div>
      `,
    });

  if (clientEmailResult.error) {
    throw new Error(
      `Client email failed: ${
        clientEmailResult.error.message
      }`,
    );
  }
}