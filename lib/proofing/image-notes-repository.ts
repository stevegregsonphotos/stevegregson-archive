import { neon } from "@neondatabase/serverless";

export type ProofingImageNote = {
  id: string;
  galleryId: string;
  visitorId: string;
  imageId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type ProofingImageNoteRow = {
  id: string;
  gallery_id: string;
  visitor_id: string;
  image_id: string;
  note: string;
  created_at: string | Date;
  updated_at: string | Date;
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

function isoDate(
  value: string | Date,
) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapImageNote(
  row: ProofingImageNoteRow,
): ProofingImageNote {
  return {
    id: row.id,
    galleryId:
      row.gallery_id,
    visitorId:
      row.visitor_id,
    imageId:
      row.image_id,
    note:
      row.note,
    createdAt:
      isoDate(row.created_at),
    updatedAt:
      isoDate(row.updated_at),
  };
}

export async function getProofingImageNotes(
  galleryId: string,
): Promise<ProofingImageNote[]> {
  const cleanGalleryId =
    galleryId.trim();

  if (!cleanGalleryId) {
    return [];
  }

  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      gallery_id,
      visitor_id,
      image_id,
      note,
      created_at,
      updated_at
    FROM proofing_image_notes
    WHERE gallery_id =
      ${cleanGalleryId}
    ORDER BY updated_at DESC, id DESC
  `;

  return rows.map(
    (row) =>
      mapImageNote(
        row as ProofingImageNoteRow,
      ),
  );
}

export async function getProofingImageNotesForVisitor(
  galleryId: string,
  visitorId: string,
): Promise<ProofingImageNote[]> {
  const cleanGalleryId =
    galleryId.trim();

  const cleanVisitorId =
    visitorId.trim();

  if (
    !cleanGalleryId ||
    !cleanVisitorId
  ) {
    return [];
  }

  const sql = getSql();

  const rows = await sql`
    SELECT
      id,
      gallery_id,
      visitor_id,
      image_id,
      note,
      created_at,
      updated_at
    FROM proofing_image_notes
    WHERE gallery_id =
      ${cleanGalleryId}
      AND visitor_id =
        ${cleanVisitorId}
    ORDER BY updated_at DESC, id DESC
  `;

  return rows.map(
    (row) =>
      mapImageNote(
        row as ProofingImageNoteRow,
      ),
  );
}

export async function upsertProofingImageNote(
  input: {
    galleryId: string;
    visitorId: string;
    imageId: string;
    note: string;
  },
): Promise<ProofingImageNote> {
  const galleryId =
    input.galleryId.trim();

  const visitorId =
    input.visitorId.trim();

  const imageId =
    input.imageId.trim();

  const note =
    input.note.trim();

  if (
    !galleryId ||
    !visitorId ||
    !imageId ||
    !note
  ) {
    throw new Error(
      "Gallery, visitor, image and note are required.",
    );
  }

  const sql = getSql();

  const rows = await sql`
    INSERT INTO proofing_image_notes (
      id,
      gallery_id,
      visitor_id,
      image_id,
      note,
      created_at,
      updated_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${galleryId},
      ${visitorId},
      ${imageId},
      ${note},
      now(),
      now()
    )
    ON CONFLICT (
      gallery_id,
      visitor_id,
      image_id
    )
    DO UPDATE SET
      note = EXCLUDED.note,
      updated_at = now()
    RETURNING
      id,
      gallery_id,
      visitor_id,
      image_id,
      note,
      created_at,
      updated_at
  `;

  if (!rows[0]) {
    throw new Error(
      "Image note could not be saved.",
    );
  }

  return mapImageNote(
    rows[0] as ProofingImageNoteRow,
  );
}

export async function deleteProofingImageNote(
  galleryId: string,
  visitorId: string,
  imageId: string,
) {
  const cleanGalleryId =
    galleryId.trim();

  const cleanVisitorId =
    visitorId.trim();

  const cleanImageId =
    imageId.trim();

  if (
    !cleanGalleryId ||
    !cleanVisitorId ||
    !cleanImageId
  ) {
    return false;
  }

  const sql = getSql();

  const rows = await sql`
    DELETE FROM proofing_image_notes
    WHERE gallery_id =
      ${cleanGalleryId}
      AND visitor_id =
        ${cleanVisitorId}
      AND image_id =
        ${cleanImageId}
    RETURNING id
  `;

  return rows.length === 1;
}
