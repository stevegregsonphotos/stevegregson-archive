import { neon } from "@neondatabase/serverless";

export type ProofingAnnotationPoint = {
  x: number;
  y: number;
};

export type ProofingPenAnnotation = {
  id: string;
  type: "pen";
  points: ProofingAnnotationPoint[];
};

export type ProofingCircleAnnotation = {
  id: string;
  type: "circle";
  start: ProofingAnnotationPoint;
  end: ProofingAnnotationPoint;
};

export type ProofingArrowAnnotation = {
  id: string;
  type: "arrow";
  start: ProofingAnnotationPoint;
  end: ProofingAnnotationPoint;
};

export type ProofingAnnotationMark =
  | ProofingPenAnnotation
  | ProofingCircleAnnotation
  | ProofingArrowAnnotation;

export type ProofingAnnotationDocument = {
  version: 1;
  marks: ProofingAnnotationMark[];
};

export type ProofingImageAnnotation = {
  id: string;
  galleryId: string;
  visitorId: string;
  imageId: string;
  annotation: ProofingAnnotationDocument;
  createdAt: string;
  updatedAt: string;
};

type ProofingImageAnnotationRow = {
  id: string;
  gallery_id: string;
  visitor_id: string;
  image_id: string;
  annotation:
    | ProofingAnnotationDocument
    | string;
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

function parseAnnotation(
  value:
    | ProofingAnnotationDocument
    | string,
): ProofingAnnotationDocument {
  const parsed =
    typeof value === "string"
      ? JSON.parse(value)
      : value;

  return parsed;
}

function mapAnnotation(
  row: ProofingImageAnnotationRow,
): ProofingImageAnnotation {
  return {
    id: row.id,
    galleryId:
      row.gallery_id,
    visitorId:
      row.visitor_id,
    imageId:
      row.image_id,
    annotation:
      parseAnnotation(
        row.annotation,
      ),
    createdAt:
      isoDate(row.created_at),
    updatedAt:
      isoDate(row.updated_at),
  };
}

export async function getProofingImageAnnotations(
  galleryId: string,
): Promise<ProofingImageAnnotation[]> {
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
      annotation,
      created_at,
      updated_at
    FROM proofing_image_annotations
    WHERE gallery_id =
      ${cleanGalleryId}
    ORDER BY updated_at DESC, id DESC
  `;

  return rows.map(
    (row) =>
      mapAnnotation(
        row as ProofingImageAnnotationRow,
      ),
  );
}

export async function getProofingImageAnnotationsForVisitor(
  galleryId: string,
  visitorId: string,
): Promise<ProofingImageAnnotation[]> {
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
      annotation,
      created_at,
      updated_at
    FROM proofing_image_annotations
    WHERE gallery_id =
      ${cleanGalleryId}
      AND visitor_id =
        ${cleanVisitorId}
    ORDER BY updated_at DESC, id DESC
  `;

  return rows.map(
    (row) =>
      mapAnnotation(
        row as ProofingImageAnnotationRow,
      ),
  );
}

export async function upsertProofingImageAnnotation(
  input: {
    galleryId: string;
    visitorId: string;
    imageId: string;
    annotation: ProofingAnnotationDocument;
  },
): Promise<ProofingImageAnnotation> {
  const galleryId =
    input.galleryId.trim();

  const visitorId =
    input.visitorId.trim();

  const imageId =
    input.imageId.trim();

  if (
    !galleryId ||
    !visitorId ||
    !imageId
  ) {
    throw new Error(
      "Gallery, visitor and image are required.",
    );
  }

  if (
    input.annotation.version !== 1 ||
    !Array.isArray(
      input.annotation.marks,
    )
  ) {
    throw new Error(
      "Invalid proofing annotation document.",
    );
  }

  const sql = getSql();

  const annotationJson =
    JSON.stringify(
      input.annotation,
    );

  const rows = await sql`
    INSERT INTO proofing_image_annotations (
      id,
      gallery_id,
      visitor_id,
      image_id,
      annotation,
      created_at,
      updated_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${galleryId},
      ${visitorId},
      ${imageId},
      ${annotationJson}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (
      gallery_id,
      visitor_id,
      image_id
    )
    DO UPDATE SET
      annotation =
        EXCLUDED.annotation,
      updated_at =
        now()
    RETURNING
      id,
      gallery_id,
      visitor_id,
      image_id,
      annotation,
      created_at,
      updated_at
  `;

  if (!rows[0]) {
    throw new Error(
      "Image annotation could not be saved.",
    );
  }

  return mapAnnotation(
    rows[0] as ProofingImageAnnotationRow,
  );
}

export async function deleteProofingImageAnnotation(
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
    DELETE FROM proofing_image_annotations
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
