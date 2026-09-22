import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  getProofingImageNotes,
} from "@/lib/proofing/image-notes-repository";

import {
  getProofingImageAnnotations,
} from "@/lib/proofing/image-annotations-repository";

import {
  getProofingImage,
} from "@/lib/proofing/image-storage";

import {
  getProofingGallery,
} from "@/lib/proofing/repository";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import sharp from "sharp";

import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return `${clean || "proofing-gallery"}-client-editing-requests.pdf`;
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

function pdfText(
  value: string,
) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function drawTextLines(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    size: number;
    lineHeight: number;
    font: PDFFont;
  },
) {
  const words =
    pdfText(text)
      .replace(
        /\s+/g,
        " ",
      )
      .trim()
      .split(" ")
      .filter(Boolean);

  const lines: string[] = [];
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
      width <= options.maxWidth ||
      !current
    ) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  lines.forEach(
    (line, index) => {
      page.drawText(
        line,
        {
          x: options.x,
          y:
            options.y -
            index *
              options.lineHeight,
          size: options.size,
          font: options.font,
          color: rgb(
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

export async function GET(
  request: NextRequest,
) {
  if (
    !isBackstageRequestAuthenticated(
      request,
    )
  ) {
    return createUnauthorizedResponse();
  }

  const galleryId =
    request.nextUrl.searchParams
      .get("galleryId")
      ?.trim() ?? "";

  if (!galleryId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Gallery ID is required.",
      },
      {
        status: 400,
      },
    );
  }

  const gallery =
    await getProofingGallery(
      galleryId,
    );

  if (!gallery) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Proofing gallery not found.",
      },
      {
        status: 404,
      },
    );
  }

  const notes =
    await getProofingImageNotes(
      gallery.id,
    );

  const annotations =
    await getProofingImageAnnotations(
      gallery.id,
    );

  type EditingRequest = {
    id: string;
    visitorId: string;
    visitorEmail: string;
    image: (typeof gallery.images)[number];
    note?: string;
    annotation?: (typeof annotations)[number]["annotation"];
    updatedAt: string;
  };

  const editingRequestMap =
    new Map<
      string,
      EditingRequest
    >();

  for (const note of notes) {
    const visitor =
      gallery.visitors.find(
        (candidate) =>
          candidate.id ===
          note.visitorId,
      );

    const image =
      gallery.images.find(
        (candidate) =>
          candidate.id ===
          note.imageId,
      );

    if (
      !visitor ||
      !image
    ) {
      continue;
    }

    const key =
      `${note.visitorId}:${note.imageId}`;

    editingRequestMap.set(
      key,
      {
        id: key,
        visitorId:
          note.visitorId,
        visitorEmail:
          visitor.email,
        image,
        note:
          note.note,
        updatedAt:
          note.updatedAt,
      },
    );
  }

  for (
    const annotation of
    annotations
  ) {
    const visitor =
      gallery.visitors.find(
        (candidate) =>
          candidate.id ===
          annotation.visitorId,
      );

    const image =
      gallery.images.find(
        (candidate) =>
          candidate.id ===
          annotation.imageId,
      );

    if (
      !visitor ||
      !image ||
      annotation.annotation.marks.length ===
        0
    ) {
      continue;
    }

    const key =
      `${annotation.visitorId}:${annotation.imageId}`;

    const existing =
      editingRequestMap.get(
        key,
      );

    editingRequestMap.set(
      key,
      {
        id: key,
        visitorId:
          annotation.visitorId,
        visitorEmail:
          visitor.email,
        image,
        note:
          existing?.note,
        annotation:
          annotation.annotation,
        updatedAt:
          existing &&
          new Date(
            existing.updatedAt,
          ).getTime() >
            new Date(
              annotation.updatedAt,
            ).getTime()
            ? existing.updatedAt
            : annotation.updatedAt,
      },
    );
  }

  const editingRequests =
    [...editingRequestMap.values()]
      .sort(
        (first, second) =>
          new Date(
            second.updatedAt,
          ).getTime() -
          new Date(
            first.updatedAt,
          ).getTime(),
      );

  if (
    editingRequests.length === 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "There are no editing requests to export.",
      },
      {
        status: 400,
      },
    );
  }

  try {
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

    const imageBoxWidth =
      190;

    const imageBoxHeight =
      260;

    const requestGap = 24;
    const dividerGap = 12;
    const bottomMargin = 46;

    const galleryTitle =
      gallery.title;

    let page: PDFPage | null =
      null;

    let requestY = 0;

    function addReportPage() {
      const nextPage =
        pdf.addPage([
          pageWidth,
          pageHeight,
        ]);

      let headerY =
        pageHeight -
        margin;

      nextPage.drawText(
        "STEVE GREGSON · BACKSTAGE",
        {
          x: margin,
          y: headerY,
          size: 8,
          font: bold,
          color: rgb(
            0.15,
            0.15,
            0.15,
          ),
        },
      );

      headerY -= 28;

      nextPage.drawText(
        pdfText(
          galleryTitle,
        ),
        {
          x: margin,
          y: headerY,
          size: 24,
          font: regular,
          color: rgb(
            0.05,
            0.05,
            0.05,
          ),
        },
      );

      headerY -= 22;

      nextPage.drawText(
        "Client notes / editing requests",
        {
          x: margin,
          y: headerY,
          size: 11,
          font: bold,
        },
      );

      headerY -= 24;

      nextPage.drawLine({
        start: {
          x: margin,
          y: headerY,
        },
        end: {
          x:
            pageWidth -
            margin,
          y: headerY,
        },
        thickness: 1,
        color: rgb(
          0.15,
          0.15,
          0.15,
        ),
      });

      return {
        page: nextPage,
        requestY:
          headerY - 24,
      };
    }

    for (
      let index = 0;
      index <
      editingRequests.length;
      index += 1
    ) {
      const item =
        editingRequests[index];

      const source =
        await getProofingImage(
          gallery.id,
          item.image.webFilename,
        );

      const jpegBytes =
        await sharp(source)
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 88,
            mozjpeg: true,
          })
          .toBuffer();

      const jpeg =
        await pdf.embedJpg(
          jpegBytes,
        );

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

      const textMaxWidth =
        contentWidth -
        imageBoxWidth -
        60;

      const filenameWords =
        pdfText(
          item.image.originalFilename,
        )
          .replace(
            /\s+/g,
            " ",
          )
          .trim()
          .split(" ")
          .filter(Boolean);

      let filenameLines = 0;
      let filenameCurrent = "";

      for (
        const word of
        filenameWords
      ) {
        const candidate =
          filenameCurrent
            ? `${filenameCurrent} ${word}`
            : word;

        if (
          bold.widthOfTextAtSize(
            candidate,
            10,
          ) <=
            textMaxWidth ||
          !filenameCurrent
        ) {
          filenameCurrent =
            candidate;
        } else {
          filenameLines += 1;
          filenameCurrent =
            word;
        }
      }

      if (filenameCurrent) {
        filenameLines += 1;
      }

      const filenameHeight =
        Math.max(
          filenameLines,
          1,
        ) * 13;

      const requestText =
        item.note ??
        "Client supplied visual markup on the photograph.";

      const requestWords =
        pdfText(
          requestText,
        )
          .replace(
            /\s+/g,
            " ",
          )
          .trim()
          .split(" ")
          .filter(Boolean);

      let requestLines = 0;
      let requestCurrent = "";

      for (
        const word of
        requestWords
      ) {
        const candidate =
          requestCurrent
            ? `${requestCurrent} ${word}`
            : word;

        if (
          bold.widthOfTextAtSize(
            candidate,
            10,
          ) <=
            textMaxWidth ||
          !requestCurrent
        ) {
          requestCurrent =
            candidate;
        } else {
          requestLines += 1;
          requestCurrent =
            word;
        }
      }

      if (requestCurrent) {
        requestLines += 1;
      }

      const requestTextHeight =
        Math.max(
          requestLines,
          1,
        ) * 14;

      const textHeight =
        filenameHeight +
        12 +
        12 +
        24 +
        12 +
        28 +
        15 +
        requestTextHeight;

      const contentHeight =
        Math.max(
          drawHeight,
          textHeight,
        );

      const requestHeight =
        contentHeight +
        32;

      if (
        !page ||
        requestY -
          requestHeight <
          bottomMargin
      ) {
        const created =
          addReportPage();

        page =
          created.page;

        requestY =
          created.requestY;
      } else {
        page.drawLine({
          start: {
            x: margin,
            y:
              requestY -
              dividerGap,
          },
          end: {
            x:
              pageWidth -
              margin,
            y:
              requestY -
              dividerGap,
          },
          thickness: 0.6,
          color: rgb(
            0.72,
            0.72,
            0.72,
          ),
        });

        requestY -=
          requestGap;
      }

      const currentPage =
        page;

      currentPage.drawText(
        String(
          index + 1,
        ).padStart(
          2,
          "0",
        ),
        {
          x: margin,
          y: requestY,
          size: 14,
          font: regular,
          color: rgb(
            0.45,
            0.45,
            0.45,
          ),
        },
      );

      const imageX =
        margin + 38;

      const imageY =
        requestY -
        drawHeight +
        2;

      currentPage.drawImage(
        jpeg,
        {
          x: imageX,
          y: imageY,
          width: drawWidth,
          height: drawHeight,
        },
      );

      if (item.annotation) {
        for (
          const mark of
          item.annotation.marks
        ) {
          if (
            mark.type !== "pen" ||
            mark.points.length < 2
          ) {
            continue;
          }

          for (
            let pointIndex = 1;
            pointIndex <
            mark.points.length;
            pointIndex += 1
          ) {
            const previous =
              mark.points[
                pointIndex - 1
              ];

            const current =
              mark.points[
                pointIndex
              ];

            currentPage.drawLine({
              start: {
                x:
                  imageX +
                  previous.x *
                    drawWidth,
                y:
                  imageY +
                  (1 -
                    previous.y) *
                    drawHeight,
              },
              end: {
                x:
                  imageX +
                  current.x *
                    drawWidth,
                y:
                  imageY +
                  (1 -
                    current.y) *
                    drawHeight,
              },
              thickness: 2.2,
              color: rgb(
                1,
                0.23,
                0.19,
              ),
            });
          }
        }
      }

      const textX =
        imageX +
        imageBoxWidth +
        22;

      let textY =
        requestY + 2;

      const actualFilenameHeight =
        drawTextLines(
          currentPage,
          item.image.originalFilename,
          {
            x: textX,
            y: textY,
            maxWidth:
              textMaxWidth,
            size: 10,
            lineHeight: 13,
            font: bold,
          },
        );

      textY -=
        actualFilenameHeight +
        12;

      currentPage.drawText(
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

      currentPage.drawText(
        pdfText(
          item.visitorEmail,
        ),
        {
          x: textX,
          y: textY,
          size: 8.5,
          font: regular,
        },
      );

      textY -= 24;

      currentPage.drawText(
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

      currentPage.drawText(
        pdfText(
          formatDate(
            item.updatedAt,
          ),
        ),
        {
          x: textX,
          y: textY,
          size: 8.5,
          font: regular,
        },
      );

      textY -= 28;

      currentPage.drawText(
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
        currentPage,
        requestText,
        {
          x: textX,
          y: textY,
          maxWidth:
            textMaxWidth,
          size: 10,
          lineHeight: 14,
          font: bold,
        },
      );

      const completedY =
        requestY -
        contentHeight -
        17;

      currentPage.drawRectangle({
        x: imageX,
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

      currentPage.drawText(
        "COMPLETED",
        {
          x:
            imageX +
            18,
          y:
            completedY +
            1,
          size: 8,
          font: bold,
        },
      );

      requestY -=
        requestHeight;
    }

    const bytes =
      await pdf.save();

    const body =
      new ArrayBuffer(
        bytes.byteLength,
      );

    new Uint8Array(
      body,
    ).set(
      bytes,
    );

    return new Response(
      body,
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/pdf",
          "Content-Disposition":
            `inline; filename="${safeFilename(
              gallery.title,
            )}"`,
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Proofing notes PDF export failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "The PDF report could not be generated.",
      },
      {
        status: 500,
      },
    );
  }
}
