import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getProofingImageNotes,
} from "../../../../../lib/proofing/image-notes-repository";

import {
  getProofingGallery,
} from "../../../../../lib/proofing/repository";

import PrintNotesReportButton from "./PrintNotesReportButton";

export const dynamic = "force-dynamic";

type NotesReportPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatReportDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
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

export default async function NotesReportPage({
  params,
}: NotesReportPageProps) {
  const { id } =
    await params;

  const gallery =
    await getProofingGallery(
      id,
    );

  if (!gallery) {
    notFound();
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

  const generatedAt =
    new Date().toISOString();

  return (
    <main className="proofing-notes-report">
      <header className="proofing-notes-report-header">
        <div>
          <p className="proofing-notes-report-eyebrow">
            Steve Gregson · Backstage
          </p>

          <h1>
            {gallery.title}
          </h1>

          <p className="proofing-notes-report-subtitle">
            Client notes / editing requests
          </p>

          <p className="proofing-notes-report-meta">
            {resolvedNotes.length}{" "}
            request
            {resolvedNotes.length === 1
              ? ""
              : "s"}
            {" · "}
            Generated{" "}
            {formatReportDate(
              generatedAt,
            )}
          </p>
        </div>

        <div className="proofing-notes-report-controls">
          <Link
            href={`/admin/proofing/${gallery.id}`}
          >
            ← Back to gallery
          </Link>

          <PrintNotesReportButton />
        </div>
      </header>

      {resolvedNotes.length > 0 ? (
        <div className="proofing-notes-report-list">
          {resolvedNotes.map(
            (note, index) => (
              <article
                key={note.id}
                className="proofing-notes-report-item"
              >
                <div className="proofing-notes-report-number">
                  {String(
                    index + 1,
                  ).padStart(
                    2,
                    "0",
                  )}
                </div>

                <div className="proofing-notes-report-image">
                  <img
                    src={`/api/admin/proofing/image?galleryId=${encodeURIComponent(
                      gallery.id,
                    )}&imageId=${encodeURIComponent(
                      note.image.id,
                    )}`}
                    alt=""
                  />
                </div>

                <div className="proofing-notes-report-content">
                  <h2>
                    {
                      note.image
                        .originalFilename
                    }
                  </h2>

                  <dl>
                    <div>
                      <dt>
                        Client
                      </dt>

                      <dd>
                        {
                          note.visitorEmail
                        }
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Updated
                      </dt>

                      <dd>
                        {formatReportDate(
                          note.updatedAt,
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="proofing-notes-report-request">
                    <p>Request</p>

                    <div>
                      {note.note}
                    </div>
                  </div>

                  <div className="proofing-notes-report-completed">
                    <span
                      aria-hidden="true"
                    >
                      ☐
                    </span>

                    Completed
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      ) : (
        <p className="proofing-notes-report-empty">
          No client notes have been added
          to this gallery.
        </p>
      )}
    </main>
  );
}
