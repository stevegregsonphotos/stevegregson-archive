"use client";

import {
  useState,
} from "react";

type ReportItem = {
  filename: string;
  clientEmail: string;
  updatedAt: string;
  note: string;
  imageUrl: string;
};

type DownloadNotesReportButtonProps = {
  galleryId: string;
  galleryTitle: string;
  items: ReportItem[];
};

function safeFilename(
  value: string,
) {
  const clean =
    value
      .replace(
        /[^a-z0-9]+/gi,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .toLowerCase();

  return (
    clean ||
    "proofing-gallery"
  );
}

function formatDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone:
        "Europe/London",
    },
  );
}

function saveBrowserBlob(
  blob: Blob,
  filename: string,
) {
  const objectUrl =
    URL.createObjectURL(
      blob,
    );

  const link =
    document.createElement(
      "a",
    );

  link.href =
    objectUrl;

  link.download =
    filename;

  link.style.display =
    "none";

  document.body.appendChild(
    link,
  );

  link.click();
  link.remove();

  /*
   * Match the Safari-safe proofing download
   * behaviour already used by the client gallery.
   */
  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        objectUrl,
      );
    },
    60_000,
  );
}

async function imageUrlToJpegBytes(
  imageUrl: string,
) {
  const response =
    await fetch(
      imageUrl,
      {
        cache: "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      "A report photograph could not be loaded.",
    );
  }

  const sourceBlob =
    await response.blob();

  const bitmap =
    await createImageBitmap(
      sourceBlob,
    );

  try {
    const canvas =
      document.createElement(
        "canvas",
      );

    /*
     * The report only displays photographs at a
     * relatively small physical size. Do not embed
     * the full proofing-image pixel dimensions in
     * the PDF.
     *
     * 1600px on the longest edge is comfortably
     * above the resolution needed for this report
     * while keeping the resulting PDF manageable.
     */
    const maximumDimension =
      1600;

    const imageScale =
      Math.min(
        1,
        maximumDimension /
          Math.max(
            bitmap.width,
            bitmap.height,
          ),
      );

    canvas.width =
      Math.max(
        1,
        Math.round(
          bitmap.width *
            imageScale,
        ),
      );

    canvas.height =
      Math.max(
        1,
        Math.round(
          bitmap.height *
            imageScale,
        ),
      );

    const context =
      canvas.getContext(
        "2d",
      );

    if (!context) {
      throw new Error(
        "A report photograph could not be prepared.",
      );
    }

    context.drawImage(
      bitmap,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    /*
     * Annotation support will be composited here.
     *
     * The photograph remains untouched in R2.
     * Future saved annotation paths can be drawn
     * onto this canvas before JPEG export.
     */

    const jpegBlob =
      await new Promise<Blob>(
        (resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(
                  new Error(
                    "A report photograph could not be converted.",
                  ),
                );
                return;
              }

              resolve(blob);
            },
            "image/jpeg",
            0.9,
          );
        },
      );

    return new Uint8Array(
      await jpegBlob.arrayBuffer(),
    );
  } finally {
    bitmap.close();
  }
}

export default function DownloadNotesReportButton({
  galleryId,
  galleryTitle,
  items,
}: DownloadNotesReportButtonProps) {
  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    readyDownloadUrl,
    setReadyDownloadUrl,
  ] = useState<string | null>(
    null,
  );

  async function downloadPdf() {
    if (
      isGenerating ||
      items.length === 0
    ) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setReadyDownloadUrl(null);

    try {
      const {
        PDFDocument,
        StandardFonts,
        rgb,
      } =
        await import(
          "pdf-lib"
        );

      const pdf =
        await PDFDocument.create();

      const regular =
        await pdf.embedFont(
          StandardFonts.Helvetica,
        );

      const bold =
        await pdf.embedFont(
          StandardFonts.HelveticaBold,
        );

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 46;
      const contentWidth =
        pageWidth -
        margin * 2;

      function drawTextLines(
        page: ReturnType<
          typeof pdf.addPage
        >,
        text: string,
        options: {
          x: number;
          y: number;
          maxWidth: number;
          size: number;
          lineHeight: number;
          font:
            typeof regular;
          color?: ReturnType<
            typeof rgb
          >;
        },
      ) {
        const words =
          text
            .replace(
              /\s+/g,
              " ",
            )
            .trim()
            .split(" ")
            .filter(Boolean);

        const lines: string[] =
          [];

        let current = "";

        for (const word of words) {
          const candidate =
            current
              ? `${current} ${word}`
              : word;

          const width =
            options.font.widthOfTextAtSize(
              candidate,
              options.size,
            );

          if (
            width <=
              options.maxWidth ||
            !current
          ) {
            current =
              candidate;
          } else {
            lines.push(
              current,
            );
            current =
              word;
          }
        }

        if (current) {
          lines.push(
            current,
          );
        }

        lines.forEach(
          (line, index) => {
            page.drawText(
              line,
              {
                x:
                  options.x,
                y:
                  options.y -
                  index *
                    options.lineHeight,
                size:
                  options.size,
                font:
                  options.font,
                color:
                  options.color ??
                  rgb(
                    0.08,
                    0.08,
                    0.08,
                  ),
              },
            );
          },
        );

        return (
          lines.length *
          options.lineHeight
        );
      }

      for (
        let index = 0;
        index < items.length;
        index += 1
      ) {
        const item =
          items[index];

        const page =
          pdf.addPage([
            pageWidth,
            pageHeight,
          ]);

        let y =
          pageHeight -
          margin;

        page.drawText(
          "STEVE GREGSON · BACKSTAGE",
          {
            x: margin,
            y,
            size: 8,
            font: bold,
            color: rgb(
              0.15,
              0.15,
              0.15,
            ),
          },
        );

        y -= 28;

        page.drawText(
          galleryTitle,
          {
            x: margin,
            y,
            size: 24,
            font: regular,
            color: rgb(
              0.05,
              0.05,
              0.05,
            ),
          },
        );

        y -= 22;

        page.drawText(
          "Client notes / editing requests",
          {
            x: margin,
            y,
            size: 11,
            font: bold,
          },
        );

        y -= 24;

        page.drawLine({
          start: {
            x: margin,
            y,
          },
          end: {
            x:
              pageWidth -
              margin,
            y,
          },
          thickness: 1,
          color: rgb(
            0.15,
            0.15,
            0.15,
          ),
        });

        y -= 24;

        page.drawText(
          String(
            index + 1,
          ).padStart(
            2,
            "0",
          ),
          {
            x: margin,
            y,
            size: 14,
            font: regular,
            color: rgb(
              0.45,
              0.45,
              0.45,
            ),
          },
        );

        const jpegBytes =
          await imageUrlToJpegBytes(
            item.imageUrl,
          );

        const jpeg =
          await pdf.embedJpg(
            jpegBytes,
          );

        const imageBoxWidth =
          190;

        const imageBoxHeight =
          260;

        const scale =
          Math.min(
            imageBoxWidth /
              jpeg.width,
            imageBoxHeight /
              jpeg.height,
          );

        const drawWidth =
          jpeg.width *
          scale;

        const drawHeight =
          jpeg.height *
          scale;

        const imageX =
          margin + 38;

        const imageY =
          y -
          drawHeight +
          2;

        page.drawImage(
          jpeg,
          {
            x: imageX,
            y: imageY,
            width:
              drawWidth,
            height:
              drawHeight,
          },
        );

        const textX =
          imageX +
          imageBoxWidth +
          22;

        let textY =
          y + 2;

        const filenameHeight =
          drawTextLines(
            page,
            item.filename,
            {
              x: textX,
              y: textY,
              maxWidth:
                contentWidth -
                imageBoxWidth -
                60,
              size: 10,
              lineHeight: 13,
              font: bold,
            },
          );

        textY -=
          filenameHeight +
          12;

        page.drawText(
          "CLIENT",
          {
            x: textX,
            y: textY,
            size: 7,
            font: bold,
            color: rgb(
              0.4,
              0.4,
              0.4,
            ),
          },
        );

        textY -= 12;

        page.drawText(
          item.clientEmail,
          {
            x: textX,
            y: textY,
            size: 8.5,
            font: regular,
          },
        );

        textY -= 24;

        page.drawText(
          "UPDATED",
          {
            x: textX,
            y: textY,
            size: 7,
            font: bold,
            color: rgb(
              0.4,
              0.4,
              0.4,
            ),
          },
        );

        textY -= 12;

        page.drawText(
          formatDate(
            item.updatedAt,
          ),
          {
            x: textX,
            y: textY,
            size: 8.5,
            font: regular,
          },
        );

        textY -= 28;

        page.drawText(
          "REQUEST",
          {
            x: textX,
            y: textY,
            size: 7,
            font: bold,
            color: rgb(
              0.4,
              0.4,
              0.4,
            ),
          },
        );

        textY -= 15;

        drawTextLines(
          page,
          item.note,
          {
            x: textX,
            y: textY,
            maxWidth:
              contentWidth -
              imageBoxWidth -
              60,
            size: 10,
            lineHeight: 14,
            font: bold,
          },
        );

        const completedY =
          Math.min(
            imageY - 26,
            150,
          );

        page.drawRectangle({
          x: margin + 38,
          y: completedY,
          width: 11,
          height: 11,
          borderWidth: 1,
          borderColor: rgb(
            0.2,
            0.2,
            0.2,
          ),
        });

        page.drawText(
          "COMPLETED",
          {
            x:
              margin +
              56,
            y:
              completedY +
              1,
            size: 8,
            font: bold,
          },
        );
      }

      const bytes =
        await pdf.save();

      const pdfBlob =
        new Blob(
          [
            new Uint8Array(
              bytes,
            ),
          ],
          {
            type:
              "application/pdf",
          },
        );

      const downloadFilename =
        `${safeFilename(
          galleryTitle,
        )}-client-editing-requests.pdf`;

      /*
       * Vercel signs only.
       *
       * The finished PDF body travels
       * browser -> R2 directly, then Safari
       * downloads the private R2 object via
       * a signed attachment response.
       */
      const signResponse =
        await fetch(
          "/api/admin/proofing/notes-report",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              galleryId,
              downloadFilename,
            }),
          },
        );

      const signed =
        (await signResponse.json()) as {
          ok?: boolean;
          uploadUrl?: string;
          downloadUrl?: string;
          message?: string;
        };

      if (
        !signResponse.ok ||
        !signed.ok ||
        !signed.uploadUrl ||
        !signed.downloadUrl
      ) {
        throw new Error(
          signed.message ??
            "The PDF download could not be prepared.",
        );
      }

      const uploadResponse =
        await fetch(
          signed.uploadUrl,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/pdf",
              "Cache-Control":
                "private, no-store",
            },
            body:
              pdfBlob,
          },
        );

      if (!uploadResponse.ok) {
        throw new Error(
          "The PDF could not be prepared for download.",
        );
      }

      /*
       * Use a conventional same-origin attachment
       * response for the final download.
       *
       * Safari no longer has to save a Blob URL.
       */
      const finalDownloadUrl =
        `/api/admin/proofing/notes-report/download?galleryId=${encodeURIComponent(
          galleryId,
        )}&filename=${encodeURIComponent(
          downloadFilename,
        )}`;

      /*
       * Do not attempt to start the download here.
       *
       * PDF generation and upload are asynchronous, so
       * Safari may no longer regard a download triggered
       * at this point as part of the user's click.
       *
       * Instead expose a genuine HTML link. The user's
       * next click goes directly to the attachment
       * endpoint with no JavaScript download trigger.
       */
      setReadyDownloadUrl(
        finalDownloadUrl,
      );

    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The PDF could not be generated.",
      );
    } finally {
      setIsGenerating(
        false,
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={
          isGenerating ||
          items.length === 0
        }
        onClick={() =>
          void downloadPdf()
        }
      >
        {isGenerating
          ? "Preparing PDF…"
          : "Export PDF"}
      </button>

      {error ? (
        <p
          role="alert"
          style={{
            margin:
              "0.5rem 0 0",
            color:
              "#b42318",
            fontSize:
              "0.72rem",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
