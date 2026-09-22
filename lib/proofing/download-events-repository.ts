import { neon } from "@neondatabase/serverless";

import type {
  ProofingDownloadPermission,
} from "./types";

export type ProofingDownloadEvent = {
  id: string;
  galleryId: string;
  visitorId: string;
  visitorEmail: string;
  downloadType:
    | "single"
    | "archive";
  downloadPermission:
    ProofingDownloadPermission;
  imageIds: string[];
  filenames: string[];
  fileCount: number;
  archiveFilename?: string;
  createdAt: string;
};

type DownloadEventRow = {
  id: string;
  gallery_id: string;
  visitor_id: string;
  visitor_email: string;
  download_type: string;
  download_permission: string;
  image_ids: unknown;
  filenames: unknown;
  file_count: number;
  archive_filename: string | null;
  created_at: string | Date;
};

function getSql() {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured.",
    );
  }

  return neon(databaseUrl);
}

function cleanStrings(
  values: string[],
) {
  return values
    .map((value) =>
      value.trim(),
    )
    .filter(Boolean);
}

function stringArray(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      Boolean(item.trim()),
  );
}

function isoDate(
  value: string | Date,
) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapDownloadEvent(
  row: DownloadEventRow,
): ProofingDownloadEvent {
  return {
    id: row.id,
    galleryId:
      row.gallery_id,
    visitorId:
      row.visitor_id,
    visitorEmail:
      row.visitor_email,
    downloadType:
      row.download_type === "archive"
        ? "archive"
        : "single",
    downloadPermission:
      row.download_permission as
        ProofingDownloadPermission,
    imageIds:
      stringArray(row.image_ids),
    filenames:
      stringArray(row.filenames),
    fileCount:
      Number(row.file_count) || 0,
    ...(row.archive_filename
      ? {
          archiveFilename:
            row.archive_filename,
        }
      : {}),
    createdAt:
      isoDate(row.created_at),
  };
}

export type RecordProofingDownloadEvent = {
  galleryId: string;
  visitorId: string;
  visitorEmail: string;
  downloadType:
    | "single"
    | "archive";
  downloadPermission:
    ProofingDownloadPermission;
  imageIds: string[];
  filenames: string[];
  archiveFilename?: string;
};

export async function recordProofingDownloadEvent(
  input: RecordProofingDownloadEvent,
): Promise<ProofingDownloadEvent> {
  const sql = getSql();

  const galleryId =
    input.galleryId.trim();

  const visitorId =
    input.visitorId.trim();

  const visitorEmail =
    input.visitorEmail.trim();

  const imageIds =
    cleanStrings(
      input.imageIds,
    );

  const filenames =
    cleanStrings(
      input.filenames,
    );

  const archiveFilename =
    input.archiveFilename?.trim() ||
    null;

  if (
    !galleryId ||
    !visitorId ||
    !visitorEmail
  ) {
    throw new Error(
      "Gallery, visitor and email are required for download activity.",
    );
  }

  const rows =
    await sql`
      INSERT INTO proofing_download_events (
        id,
        gallery_id,
        visitor_id,
        visitor_email,
        download_type,
        download_permission,
        image_ids,
        filenames,
        file_count,
        archive_filename,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${galleryId},
        ${visitorId},
        ${visitorEmail},
        ${input.downloadType},
        ${input.downloadPermission},
        ${JSON.stringify(
          imageIds,
        )}::jsonb,
        ${JSON.stringify(
          filenames,
        )}::jsonb,
        ${imageIds.length},
        ${archiveFilename},
        now()
      )
      RETURNING
        id,
        gallery_id,
        visitor_id,
        visitor_email,
        download_type,
        download_permission,
        image_ids,
        filenames,
        file_count,
        archive_filename,
        created_at
    `;

  if (!rows[0]) {
    throw new Error(
      "Download activity could not be recorded.",
    );
  }

  return mapDownloadEvent(
    rows[0] as DownloadEventRow,
  );
}

export async function getProofingDownloadEvents(
  galleryId: string,
): Promise<ProofingDownloadEvent[]> {
  const sql = getSql();

  const cleanGalleryId =
    galleryId.trim();

  if (!cleanGalleryId) {
    return [];
  }

  const rows =
    await sql`
      SELECT
        id,
        gallery_id,
        visitor_id,
        visitor_email,
        download_type,
        download_permission,
        image_ids,
        filenames,
        file_count,
        archive_filename,
        created_at
      FROM proofing_download_events
      WHERE gallery_id =
        ${cleanGalleryId}
      ORDER BY created_at DESC, id DESC
    `;

  return rows.map((row) =>
    mapDownloadEvent(
      row as DownloadEventRow,
    ),
  );
}
