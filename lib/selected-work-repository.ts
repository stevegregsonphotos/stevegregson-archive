import "server-only";

import { neon } from "@neondatabase/serverless";

export type SelectedWorkCategory =
  | "production"
  | "rehearsal"
  | "campaign";

export type SelectedWorkImage = {
  filename: string;
  storageKey: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;
  width?: number;
  height?: number;
  analysisStatus:
    | "pending"
    | "complete";
  analysedAt?: string;
  originalFilename?: string;
  editAspect?: "original" | "3:2" | "4:5" | "1:1" | "16:9";
  editZoom?: number;
  editPanX?: number;
  editPanY?: number;
  editBrightness?: number;
  editAutoStrength?: number;
  position: number;
};

export type SelectedWorkData = Record<
  SelectedWorkCategory,
  SelectedWorkImage[]
>;

type SelectedWorkRow = {
  category: SelectedWorkCategory;
  storage_key: string;
  display_filename: string;
  suggested_filename: string | null;
  alt: string;
  uploaded_at: Date | string;
  width: number | null;
  height: number | null;
  analysis_status:
    | "pending"
    | "complete";
  analysed_at: Date | string | null;
  original_display_filename: string | null;
  edit_aspect: SelectedWorkImage["editAspect"] | null;
  edit_zoom: number | null;
  edit_pan_x: number | null;
  edit_pan_y: number | null;
  edit_brightness: number | null;
  edit_auto_strength: number | null;
  position: number;
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

function isoString(
  value: Date | string,
) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapRow(
  row: SelectedWorkRow,
): SelectedWorkImage {
  return {
    filename:
      row.display_filename,
    storageKey:
      row.storage_key,
    suggestedFilename:
      row.suggested_filename ?? "",
    alt:
      row.alt,
    uploadedAt:
      isoString(row.uploaded_at),
    ...(row.width !== null
      ? {
          width:
            row.width,
        }
      : {}),
    ...(row.height !== null
      ? {
          height:
            row.height,
        }
      : {}),
    analysisStatus:
      row.analysis_status,
    ...(row.analysed_at
      ? {
          analysedAt:
            isoString(
              row.analysed_at,
            ),
        }
      : {}),
    ...(row.original_display_filename
      ? {
          originalFilename:
            row.original_display_filename,
        }
      : {}),
    editAspect:
      row.edit_aspect ?? "original",
    editZoom:
      row.edit_zoom ?? 1,
    editPanX:
      row.edit_pan_x ?? 0,
    editPanY:
      row.edit_pan_y ?? 0,
    editBrightness:
      row.edit_brightness ?? 100,
    editAutoStrength:
      row.edit_auto_strength ?? 0,
    position:
      row.position,
  };
}

export async function getSelectedWork():
  Promise<SelectedWorkData> {
  const sql = getSql();

  const rows = await sql`
    SELECT
      category,
      storage_key,
      display_filename,
      suggested_filename,
      alt,
      uploaded_at,
      width,
      height,
      analysis_status,
      analysed_at,
      original_display_filename,
      edit_aspect,
      edit_zoom,
      edit_pan_x,
      edit_pan_y,
      edit_brightness,
      edit_auto_strength,
      position
    FROM selected_work_items
    WHERE deleted_at IS NULL
    ORDER BY category, position
  `;

  const data: SelectedWorkData = {
    production: [],
    rehearsal: [],
    campaign: [],
  };

  for (
    const row of
    rows as SelectedWorkRow[]
  ) {
    data[row.category].push(
      mapRow(row),
    );
  }

  return data;
}

export type NewSelectedWorkItem = {
  category: SelectedWorkCategory;
  storageKey: string;
  displayFilename: string;
  suggestedFilename?: string;
  alt: string;
  uploadedAt: string;
  width?: number;
  height?: number;
  analysisStatus:
    | "pending"
    | "complete";
  analysedAt?: string;
  position: number;
};

export async function insertSelectedWorkItems(
  items: NewSelectedWorkItem[],
) {
  if (items.length === 0) {
    return;
  }

  const sql = getSql();

  const queries =
    items.map(
      (item) => sql`
        INSERT INTO selected_work_items (
          id,
          category,
          storage_key,
          display_filename,
          suggested_filename,
          alt,
          uploaded_at,
          width,
          height,
          analysis_status,
          analysed_at,
          original_display_filename,
          edit_aspect,
          edit_zoom,
          edit_pan_x,
          edit_pan_y,
          edit_brightness,
          edit_auto_strength,
          position,
          version,
          created_at,
          updated_at,
          deleted_at
        )
        VALUES (
          gen_random_uuid(),
          ${item.category},
          ${item.storageKey},
          ${item.displayFilename},
          ${item.suggestedFilename ?? null},
          ${item.alt},
          ${item.uploadedAt},
          ${item.width ?? null},
          ${item.height ?? null},
          ${item.analysisStatus},
          ${item.analysedAt ?? null},
          ${item.position},
          1,
          now(),
          now(),
          null
        )
        RETURNING id
      `,
    );

  const results =
    await sql.transaction(
      queries,
    );

  if (
    results.some(
      (result) =>
        result.length !== 1,
    )
  ) {
    throw new Error(
      "One or more Selected Work items could not be inserted.",
    );
  }
}

export type SelectedWorkCategoryUpdate = {
  currentStorageKey: string;
  nextImage: SelectedWorkImage;
  nextStorageKey: string;
};

export async function replaceSelectedWorkCategory(
  category: SelectedWorkCategory,
  updates: SelectedWorkCategoryUpdate[],
) {
  const sql = getSql();

  const queries = [
    sql`
      UPDATE selected_work_items
      SET
        position = position + 1000000,
        updated_at = now()
      WHERE category = ${category}
        AND deleted_at IS NULL
    `,
    ...updates.map(
      (update, position) => {
        const image =
          update.nextImage;

        return sql`
          UPDATE selected_work_items
          SET
            storage_key =
              ${update.nextStorageKey},
            display_filename =
              ${image.filename},
            suggested_filename =
              ${image.suggestedFilename ?? null},
            alt =
              ${image.alt},
            uploaded_at =
              ${image.uploadedAt},
            width =
              ${image.width ?? null},
            height =
              ${image.height ?? null},
            analysis_status =
              ${image.analysisStatus},
            analysed_at =
              ${image.analysedAt ?? null},
            original_display_filename =
              ${image.originalFilename ?? null},
            edit_aspect =
              ${image.editAspect ?? "original"},
            edit_zoom =
              ${image.editZoom ?? 1},
            edit_pan_x =
              ${image.editPanX ?? 0},
            edit_pan_y =
              ${image.editPanY ?? 0},
            edit_brightness =
              ${image.editBrightness ?? 100},
            edit_auto_strength =
              ${image.editAutoStrength ?? 0},
            position =
              ${position},
            version =
              version + 1,
            updated_at = now()
          WHERE category = ${category}
            AND storage_key =
              ${update.currentStorageKey}
            AND deleted_at IS NULL
          RETURNING id
        `;
      },
    ),
    sql`
      UPDATE selected_work_items
      SET
        deleted_at = now(),
        updated_at = now(),
        version = version + 1
      WHERE category = ${category}
        AND deleted_at IS NULL
        AND position >= 1000000
    `,
  ];

  const results =
    await sql.transaction(queries);

  const updateResults =
    results.slice(
      1,
      1 + updates.length,
    );

  for (
    let index = 0;
    index < updateResults.length;
    index += 1
  ) {
    if (updateResults[index].length !== 1) {
      throw new Error(
        `Selected Work item could not be matched uniquely: ${updates[index].nextImage.filename}`,
      );
    }
  }

  return getSelectedWork();
}

export async function deleteSelectedWorkItemAndCompact(
  category: SelectedWorkCategory,
  filename: string,
) {
  const existing =
    await getSelectedWorkItem(
      category,
      filename,
    );

  if (!existing) {
    return null;
  }

  const sql = getSql();

  const deletedPosition =
    existing.image.position;

  const results =
    await sql.transaction([
      sql`
        UPDATE selected_work_items
        SET
          deleted_at = now(),
          updated_at = now(),
          version = version + 1
        WHERE category = ${category}
          AND display_filename = ${filename}
          AND deleted_at IS NULL
        RETURNING id
      `,
      sql`
        UPDATE selected_work_items
        SET
          position =
            position + 1000000,
          updated_at = now()
        WHERE category = ${category}
          AND deleted_at IS NULL
          AND position >
            ${deletedPosition}
      `,
      sql`
        UPDATE selected_work_items
        SET
          position =
            position - 1000001,
          updated_at = now()
        WHERE category = ${category}
          AND deleted_at IS NULL
          AND position >= 1000000
      `,
    ]);

  if (
    results[0].length !== 1
  ) {
    throw new Error(
      `Selected Work item could not be deleted uniquely: ${filename}`,
    );
  }

  return {
    storageKey:
      existing.storageKey,
  };
}

export async function getSelectedWorkItem(
  category: SelectedWorkCategory,
  filename: string,
) {
  const sql = getSql();

  const rows = await sql`
    SELECT
      category,
      storage_key,
      display_filename,
      suggested_filename,
      alt,
      uploaded_at,
      width,
      height,
      analysis_status,
      analysed_at,
      original_display_filename,
      edit_aspect,
      edit_zoom,
      edit_pan_x,
      edit_pan_y,
      edit_brightness,
      edit_auto_strength,
      position
    FROM selected_work_items
    WHERE category = ${category}
      AND display_filename = ${filename}
      AND deleted_at IS NULL
    LIMIT 1
  `;

  if (!rows[0]) {
    return null;
  }

  return {
    image:
      mapRow(
        rows[0] as SelectedWorkRow,
      ),
    storageKey:
      rows[0].storage_key as string,
  };
}


export type SelectedWorkImageEdit = {
  category: SelectedWorkCategory;
  currentFilename: string;
  nextFilename: string;
  nextStorageKey: string;
  width: number;
  height: number;
  aspect: "original" | "3:2" | "4:5" | "1:1" | "16:9";
  zoom: number;
  panX: number;
  panY: number;
  brightness: number;
  autoStrength: number;
};

export async function updateSelectedWorkImageEdit(
  edit: SelectedWorkImageEdit,
) {
  const sql = getSql();

  const rows = await sql`
    UPDATE selected_work_items
    SET
      original_display_filename =
        COALESCE(
          original_display_filename,
          display_filename
        ),
      storage_key =
        ${edit.nextStorageKey},
      display_filename =
        ${edit.nextFilename},
      width =
        ${edit.width},
      height =
        ${edit.height},
      edit_aspect =
        ${edit.aspect},
      edit_zoom =
        ${edit.zoom},
      edit_pan_x =
        ${edit.panX},
      edit_pan_y =
        ${edit.panY},
      edit_brightness =
        ${edit.brightness},
      edit_auto_strength =
        ${edit.autoStrength},
      version =
        version + 1,
      updated_at =
        now()
    WHERE category =
      ${edit.category}
      AND display_filename =
        ${edit.currentFilename}
      AND deleted_at IS NULL
    RETURNING id
  `;

  if (rows.length !== 1) {
    throw new Error(
      `Selected Work image could not be updated uniquely: ${edit.currentFilename}`,
    );
  }

  return getSelectedWorkItem(
    edit.category,
    edit.nextFilename,
  );
}
