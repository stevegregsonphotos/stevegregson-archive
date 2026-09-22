import {
  createUnauthorizedResponse,
  isBackstageRequestAuthenticated,
} from "@/lib/backstage-auth";

import {
  getProofingImageNotes,
} from "@/lib/proofing/image-notes-repository";

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

  const resolvedNotes =
    notes
      .map((note) => {
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
          return null;
        }

        return {
          ...note,
          visitorEmail:
            visitor.email,
          image,
        };
      })
      .filter(
        (
          note,
        ): note is NonNullable<
          typeof note
        > =>
          Boolean(note),
      );

  if (
    resolvedNotes.length === 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "There are no client notes to export.",
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

    for (
      let index = 0;
      index <
      resolvedNotes.length;
      index += 1
    ) {
      const item =
        resolvedNotes[index];

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
        pdfText(
          gallery.title,
        ),
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
          width: drawWidth,
          height: drawHeight,
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
          item.image.originalFilename,
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
            `attachment; filename="${safeFilename(
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
