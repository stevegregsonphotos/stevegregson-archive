import { neon } from "@neondatabase/serverless";

export type ProofingConsolidatedParticipant = {
  id: string;
  visitorId: string;
  publicLabel?: string;
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProofingConsolidatedSelection = {
  id: string;
  galleryId: string;
  title: string;
  visible: boolean;
  definitiveImageIds: string[];
  createdAt: string;
  updatedAt: string;
  participants: ProofingConsolidatedParticipant[];
};

type SelectionRow = {
  id: string;
  gallery_id: string;
  title: string;
  visible: boolean;
  definitive_image_ids: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

type ParticipantRow = {
  id: string;
  consolidated_selection_id: string;
  visitor_id: string;
  public_label: string | null;
  image_ids: unknown;
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

function mapParticipant(
  row: ParticipantRow,
): ProofingConsolidatedParticipant {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    ...(row.public_label?.trim()
      ? {
          publicLabel:
            row.public_label.trim(),
        }
      : {}),
    imageIds:
      stringArray(row.image_ids),
    createdAt:
      isoDate(row.created_at),
    updatedAt:
      isoDate(row.updated_at),
  };
}

/*
 * Consolidated proofing selections deliberately
 * live outside proofing_galleries and visitors.
 *
 * Reading this repository cannot modify any
 * existing gallery, visitor, favourite or
 * submitted selection data.
 */
export async function getProofingConsolidatedSelection(
  galleryId: string,
): Promise<
  ProofingConsolidatedSelection | undefined
> {
  const sql = getSql();

  const [selectionRows, participantRows] =
    await sql.transaction([
      sql`
        SELECT
          id,
          gallery_id,
          title,
          visible,
          definitive_image_ids,
          created_at,
          updated_at
        FROM proofing_consolidated_selections
        WHERE gallery_id = ${galleryId}
        LIMIT 1
      `,
      sql`
        SELECT
          p.id,
          p.consolidated_selection_id,
          p.visitor_id,
          p.public_label,
          p.image_ids,
          p.created_at,
          p.updated_at
        FROM proofing_consolidated_participants p
        JOIN proofing_consolidated_selections s
          ON s.id =
            p.consolidated_selection_id
        WHERE s.gallery_id = ${galleryId}
        ORDER BY p.created_at, p.id
      `,
    ]);

  if (!selectionRows[0]) {
    return undefined;
  }

  const selection =
    selectionRows[0] as SelectionRow;

  return {
    id: selection.id,
    galleryId:
      selection.gallery_id,
    title: selection.title,
    visible:
      selection.visible === true,
    definitiveImageIds:
      stringArray(
        selection.definitive_image_ids,
      ),
    createdAt:
      isoDate(selection.created_at),
    updatedAt:
      isoDate(selection.updated_at),
    participants:
      participantRows.map((row) =>
        mapParticipant(
          row as ParticipantRow,
        ),
      ),
  };
}

export type SaveProofingConsolidatedParticipant = {
  visitorId: string;
  publicLabel?: string;
  imageIds: string[];
};

export type SaveProofingConsolidatedSelection = {
  galleryId: string;
  title: string;
  visible: boolean;
  participants:
    SaveProofingConsolidatedParticipant[];
};

function cleanIds(
  values: string[],
) {
  return [
    ...new Set(
      values
        .map((value) =>
          value.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

/*
 * Writes ONLY to the isolated consolidation tables.
 *
 * It does not update proofing_galleries,
 * proofing_images, visitors, favourites or
 * submittedFavourites.
 */
export async function saveProofingConsolidatedSelection(
  input: SaveProofingConsolidatedSelection,
): Promise<ProofingConsolidatedSelection> {
  const sql = getSql();

  const galleryId =
    input.galleryId.trim();

  const title =
    input.title.trim() ||
    "Consolidated favourites from all participants";

  if (!galleryId) {
    throw new Error(
      "A proofing gallery id is required.",
    );
  }

  const participantByVisitorId =
    new Map<
      string,
      SaveProofingConsolidatedParticipant
    >();

  for (const participant of input.participants) {
    const visitorId =
      participant.visitorId.trim();

    if (!visitorId) {
      continue;
    }

    participantByVisitorId.set(
      visitorId,
      {
        visitorId,
        publicLabel:
          participant.publicLabel?.trim() ||
          undefined,
        imageIds:
          cleanIds(
            participant.imageIds,
          ),
      },
    );
  }

  const participants =
    [...participantByVisitorId.values()];

  /*
   * One consolidated selection per parent
   * proofing gallery.
   */
  const existingRows =
    await sql`
      SELECT id
      FROM proofing_consolidated_selections
      WHERE gallery_id = ${galleryId}
      LIMIT 1
    `;

  const selectionId =
    typeof existingRows[0]?.id === "string"
      ? existingRows[0].id
      : crypto.randomUUID();

  const now =
    new Date().toISOString();

  const queries = [
    sql`
      INSERT INTO proofing_consolidated_selections (
        id,
        gallery_id,
        title,
        visible,
        definitive_image_ids,
        created_at,
        updated_at
      )
      VALUES (
        ${selectionId},
        ${galleryId},
        ${title},
        ${input.visible},
        ${JSON.stringify([])}::jsonb,
        ${now},
        ${now}
      )
      ON CONFLICT (gallery_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        visible = EXCLUDED.visible,
        updated_at = EXCLUDED.updated_at
    `,

    /*
     * Participant snapshots belong exclusively
     * to this new feature, so replacing them here
     * cannot affect the source visitor selections.
     */
    sql`
      DELETE FROM proofing_consolidated_participants
      WHERE consolidated_selection_id =
        ${selectionId}
    `,

    ...participants.map(
      (participant) => sql`
        INSERT INTO proofing_consolidated_participants (
          id,
          consolidated_selection_id,
          visitor_id,
          public_label,
          image_ids,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()},
          ${selectionId},
          ${participant.visitorId},
          ${participant.publicLabel ?? null},
          ${JSON.stringify(
            participant.imageIds,
          )}::jsonb,
          ${now},
          ${now}
        )
      `,
    ),
  ];

  await sql.transaction(queries);

  const saved =
    await getProofingConsolidatedSelection(
      galleryId,
    );

  if (!saved) {
    throw new Error(
      "The consolidated selection could not be read after saving.",
    );
  }

  return saved;
}

/*
 * The definitive selection is deliberately
 * separate from every participant's favourites.
 */
export async function saveProofingDefinitiveSelection(
  galleryId: string,
  imageIds: string[],
): Promise<ProofingConsolidatedSelection> {
  const sql = getSql();

  const cleanGalleryId =
    galleryId.trim();

  if (!cleanGalleryId) {
    throw new Error(
      "A proofing gallery id is required.",
    );
  }

  const cleanImageIds =
    cleanIds(imageIds);

  const rows =
    await sql`
      UPDATE proofing_consolidated_selections
      SET
        definitive_image_ids =
          ${JSON.stringify(
            cleanImageIds,
          )}::jsonb,
        updated_at = now()
      WHERE gallery_id =
        ${cleanGalleryId}
      RETURNING id
    `;

  if (rows.length !== 1) {
    throw new Error(
      "The consolidated selection could not be found.",
    );
  }

  const saved =
    await getProofingConsolidatedSelection(
      cleanGalleryId,
    );

  if (!saved) {
    throw new Error(
      "The definitive selection could not be read after saving.",
    );
  }

  return saved;
}
