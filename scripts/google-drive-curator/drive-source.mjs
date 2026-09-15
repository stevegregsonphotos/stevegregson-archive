import fs from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";

const PROJECT_ROOT = process.cwd();

const PRIVATE_ROOT = path.join(
  PROJECT_ROOT,
  ".google-drive-curator",
);

const CREDENTIALS_PATH = path.join(
  PRIVATE_ROOT,
  "credentials.json",
);

const TOKEN_PATH = path.join(
  PRIVATE_ROOT,
  "token.json",
);


const DRIVE_MAX_ATTEMPTS = 4;
async function withDriveRetry(operation, label) {
  let lastError;
  for (let attempt = 1; attempt <= DRIVE_MAX_ATTEMPTS; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      const status = Number(error?.code ?? error?.response?.status ?? 0);
      if (attempt === DRIVE_MAX_ATTEMPTS || (status && ![408, 429, 500, 502, 503, 504].includes(status))) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 750 * 2 ** (attempt - 1))));
    }
  }
  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function createDriveAuth() {
  const credentialContent =
    await fs.readFile(
      CREDENTIALS_PATH,
      "utf8",
    );

  const tokenContent =
    await fs.readFile(
      TOKEN_PATH,
      "utf8",
    );

  const keys =
    JSON.parse(
      credentialContent,
    );

  const token =
    JSON.parse(
      tokenContent,
    );

  const key =
    keys.installed ??
    keys.web;

  if (!key) {
    throw new Error(
      "Google OAuth client configuration is missing.",
    );
  }

  const auth =
    new google.auth.OAuth2(
      key.client_id,
      key.client_secret,
      key.redirect_uris?.[0],
    );

  auth.setCredentials(
    token,
  );

  return auth;
}

export async function createDriveClient() {
  const auth =
    await createDriveAuth();

  return google.drive({
    version: "v3",
    auth,
  });
}

export async function listDriveFolder(
  drive,
  folderId,
) {
  const files = [];
  let pageToken;

  do {
    const response =
      await withDriveRetry(() => drive.files.list({
        q:
          `'${folderId}' in parents and trashed = false`,
        pageSize: 1000,
        pageToken,
        fields:
          "nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)",
        orderBy: "name",
      }), "Google Drive list");

    files.push(
      ...(response.data.files ?? []),
    );

    pageToken =
      response.data.nextPageToken ??
      undefined;
  } while (pageToken);

  return files;
}

function normaliseResolutionFolderName(
  value,
) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\\-_]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isPreferredWebFolder(
  value,
) {
  const name =
    normaliseResolutionFolderName(
      value,
    );

  return new Set([
    "web",
    "web res",
    "web resolution",
    "web new",
    "new web",
  ]).has(name);
}

function isIgnoredFullFolder(
  value,
) {
  const name =
    normaliseResolutionFolderName(
      value,
    );

  return new Set([
    "full",
    "full res",
    "full resolution",
    "full res new",
    "full new",
    "full resolution new",
    "new full",
    "new full res",
    "new full resolution",
  ]).has(name);
}

export async function listDriveFolderRecursive(
  drive,
  folderId,
  folderLabel = folderId,
) {
  const results = [];

  async function walk(
    currentFolderId,
    currentPath,
    isRoot = false,
  ) {
    const entries =
      await listDriveFolder(
        drive,
        currentFolderId,
      );

    const folders =
      entries.filter(
        (entry) =>
          entry.mimeType ===
          "application/vnd.google-apps.folder" &&
          entry.id,
      );

    const files =
      entries.filter(
        (entry) =>
          entry.mimeType !==
          "application/vnd.google-apps.folder",
      );

    /*
     * At the production root, prefer explicit
     * web-resolution folders when present.
     */
    if (isRoot) {
      const preferredWebFolders =
        folders.filter(
          (entry) =>
            isPreferredWebFolder(
              entry.name,
            ),
        );

      if (
        preferredWebFolders.length >
        0
      ) {
        for (
          const folder
          of preferredWebFolders
        ) {
          await walk(
            folder.id,
            `${currentPath}/${folder.name ?? folder.id}`,
            false,
          );
        }

        return;
      }
    }

    for (const file of files) {
      results.push({
        ...file,
        driveFolderPath:
          currentPath,
      });
    }

    for (const folder of folders) {
      if (
        isIgnoredFullFolder(
          folder.name,
        )
      ) {
        continue;
      }

      await walk(
        folder.id,
        `${currentPath}/${folder.name ?? folder.id}`,
        false,
      );
    }
  }

  await walk(
    folderId,
    folderLabel,
    true,
  );

  return results;
}

export async function downloadDriveFile(
  drive,
  fileId,
) {
  const response =
    await withDriveRetry(() => drive.files.get(
      {
        fileId,
        alt: "media",
      },
      {
        responseType:
          "arraybuffer",
      },
    ), "Google Drive download");

  return Buffer.from(
    response.data,
  );
}

export async function getDriveThumbnail(
  drive,
  fileId,
) {
  return downloadDriveFile(
    drive,
    fileId,
  );
}

export function driveFileToCandidate(
  file,
  sourceFolder,
) {
  return {
    name: file.name ?? "",
    path: file.id ?? "",
    sourceFolder,
    modified:
      file.modifiedTime ??
      null,
    size:
      file.size
        ? Number(file.size)
        : null,
  };
}
