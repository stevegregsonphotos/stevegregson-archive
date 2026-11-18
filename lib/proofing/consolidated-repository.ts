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
 *
 * Toggle one image atomically in Postgres so
 * concurrent visitors cannot overwrite each
 * other's definitive selections.
 */
export async function toggleProofingDefinitiveSelection(
  galleryId: string,
  imageId: string,
): Promise<{
  selected: boolean;
  definitiveImageIds: string[];
}> {
  const sql = getSql();

  const cleanGalleryId =
    galleryId.trim();

  const cleanImageId =
    imageId.trim();

  if (!cleanGalleryId) {
    throw new Error(
      "A proofing gallery id is required.",
    );
  }

  if (!cleanImageId) {
    throw new Error(
      "A proofing image id is required.",
    );
  }

  const rows =
    await sql`
      UPDATE proofing_consolidated_selections
      SET
        definitive_image_ids =
          CASE
            WHEN COALESCE(
              definitive_image_ids,
              '[]'::jsonb
            ) ? ${cleanImageId}
            THEN COALESCE(
              definitive_image_ids,
              '[]'::jsonb
            ) - ${cleanImageId}
            ELSE COALESCE(
              definitive_image_ids,
              '[]'::jsonb
            ) || jsonb_build_array(
              ${cleanImageId}::text
            )
          END,
        updated_at = now()
      WHERE gallery_id =
        ${cleanGalleryId}
      RETURNING definitive_image_ids
    `;

  if (rows.length !== 1) {
    throw new Error(
      "The consolidated selection could not be found.",
    );
  }

  const definitiveImageIds =
    stringArray(
      rows[0].definitive_image_ids,
    );

  return {
    selected:
      definitiveImageIds.includes(
        cleanImageId,
      ),
    definitiveImageIds,
  };
}

/*
 * Per-person approvals (18 Nov 2026). Each person in the Consolidated view
 * approves photos for themselves; a photo is final once EVERYONE has
 * approved it. "Everyone" = the selection's participants plus anyone else
 * who has approved at least one photo (e.g. a poster designer).
 * The old shared definitive_image_ids list is left untouched.
 */
let approvalStorePromise: Promise<void> | null = null;

function ensureApprovalStore() {
  approvalStorePromise ??= (async () => {
    await getSql().query(
      "CREATE TABLE IF NOT EXISTS proofing_consolidated_approvals (gallery_id text NOT NULL, visitor_id text NOT NULL, name text NOT NULL, image_ids jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (gallery_id, visitor_id))",
    );
  })().catch((error) => {
    approvalStorePromise = null;
    throw error;
  });
  return approvalStorePromise;
}

export type ProofingConsolidatedApproval = {
  visitorId: string;
  name: string;
  imageIds: string[];
  createdAt: string;
};

export async function getProofingConsolidatedApprovals(
  galleryId: string,
): Promise<ProofingConsolidatedApproval[]> {
  await ensureApprovalStore();
  const rows = (await getSql().query(
    "SELECT visitor_id, name, image_ids, created_at FROM proofing_consolidated_approvals WHERE gallery_id = $1 ORDER BY created_at, visitor_id",
    [galleryId],
  )) as Array<{ visitor_id: string; name: string; image_ids: unknown; created_at: string | Date }>;
  return rows.map((row) => ({
    visitorId: row.visitor_id,
    name: row.name,
    imageIds: stringArray(row.image_ids),
    createdAt: isoDate(row.created_at),
  }));
}

/*
 * Toggle one photo for one person, atomically (two people clicking at once
 * never overwrite each other). `name` is used when the person has no row
 * yet (or to rename them).
 */
export async function toggleProofingConsolidatedApproval(
  galleryId: string,
  visitorId: string,
  imageId: string,
  name: string,
): Promise<string[]> {
  await ensureApprovalStore();
  const rows = (await getSql().query(
    `INSERT INTO proofing_consolidated_approvals (gallery_id, visitor_id, name, image_ids)
     VALUES ($1, $2, $3, jsonb_build_array($4::text))
     ON CONFLICT (gallery_id, visitor_id) DO UPDATE SET
       name = CASE WHEN $3 <> '' THEN $3 ELSE proofing_consolidated_approvals.name END,
       image_ids = CASE
         WHEN proofing_consolidated_approvals.image_ids ? $4
         THEN proofing_consolidated_approvals.image_ids - $4
         ELSE proofing_consolidated_approvals.image_ids || jsonb_build_array($4::text)
       END,
       updated_at = now()
     RETURNING image_ids`,
    [galleryId, visitorId, name.trim().slice(0, 40), imageId],
  )) as Array<{ image_ids: unknown }>;
  return stringArray(rows[0]?.image_ids);
}

export type ProofingApprovalPerson = {
  key: string; // visitor id — server-side only, never sent to visitors
  name: string;
  imageIds: string[];
  isParticipant: boolean;
};

/* Everyone whose approval counts: participants first, then other approvers. */
export function buildProofingApprovalPeople(
  selection: ProofingConsolidatedSelection,
  approvals: ProofingConsolidatedApproval[],
): ProofingApprovalPerson[] {
  const byVisitor = new Map(approvals.map((approval) => [approval.visitorId, approval]));
  const people: ProofingApprovalPerson[] = selection.participants.map((participant, index) => {
    const approval = byVisitor.get(participant.visitorId);
    return {
      key: participant.visitorId,
      name: approval?.name || participant.publicLabel || `Participant ${index + 1}`,
      imageIds: approval?.imageIds ?? [],
      isParticipant: true,
    };
  });
  const participantIds = new Set(selection.participants.map((p) => p.visitorId));
  for (const approval of approvals) {
    if (participantIds.has(approval.visitorId)) continue;
    if (!approval.imageIds.length) continue; // took everything back: no longer counted
    people.push({ key: approval.visitorId, name: approval.name, imageIds: approval.imageIds, isParticipant: false });
  }
  return people;
}

/* Photos every counted person has approved (in no particular order). */
export function approvedByEveryone(people: ProofingApprovalPerson[]) {
  if (!people.length) return new Set<string>();
  const [first, ...rest] = people;
  return new Set(
    first.imageIds.filter((imageId) => rest.every((person) => person.imageIds.includes(imageId))),
  );
}

/* What a visitor's browser gets: names only, plus which one is them. */
export function clientApprovalPeople(
  people: ProofingApprovalPerson[],
  visitorId: string,
) {
  return people.map((person) => ({
    name: person.name,
    you: person.key === visitorId,
    imageIds: person.imageIds,
  }));
}
