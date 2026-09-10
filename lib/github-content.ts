const GITHUB_OWNER = "stevegregsonphotos";
const GITHUB_REPOSITORY = "stevegregson-archive";
const GITHUB_BRANCH = "website-redesign";
const GITHUB_API = "https://api.github.com";

type GitHubCommit = {
  sha: string;
  tree: {
    sha: string;
  };
};

type GitHubReference = {
  object: {
    sha: string;
  };
};

type GitHubTree = {
  sha: string;
};

type GitHubBlob = {
  sha: string;
};

function getGitHubToken() {
  const token =
    process.env.GITHUB_BACKSTAGE_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "GitHub Backstage persistence is not configured.",
    );
  }

  return token;
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${getGitHubToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubRequest<T>(
  pathname: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${GITHUB_API}${pathname}`,
    {
      ...init,
      headers: {
        ...githubHeaders(),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let message =
      `GitHub returned HTTP ${response.status}.`;

    try {
      const body = (await response.json()) as {
        message?: unknown;
      };

      if (typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // Keep the generic HTTP message.
    }

    throw new Error(
      `GitHub persistence failed: ${message}`,
    );
  }

  return (await response.json()) as T;
}

export async function readGitHubTextFile(
  filePath: string,
) {
  const encodedPath = filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const response = await fetch(
    `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}` +
      `/contents/${encodedPath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`,
    {
      headers: githubHeaders(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not read "${filePath}" from GitHub.`,
    );
  }

  const file = (await response.json()) as {
    type?: unknown;
    encoding?: unknown;
    content?: unknown;
  };

  if (
    file.type !== "file" ||
    file.encoding !== "base64" ||
    typeof file.content !== "string"
  ) {
    throw new Error(
      `GitHub returned an unexpected response for "${filePath}".`,
    );
  }

  return Buffer.from(
    file.content.replace(/\n/g, ""),
    "base64",
  ).toString("utf8");
}

export async function commitGitHubTextFiles({
  files,
  message,
}: {
  files: Array<{
    path: string;
    source: string;
  }>;
  message: string;
}) {
  if (files.length === 0) {
    return;
  }

  const reference =
    await githubRequest<GitHubReference>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}` +
        `/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}`,
    );

  const expectedHeadSha = reference.object.sha;

  const parentCommit =
    await githubRequest<GitHubCommit>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}` +
        `/git/commits/${expectedHeadSha}`,
    );

  const treeEntries = await Promise.all(
    files.map(async (file) => {
      const blob =
        await githubRequest<GitHubBlob>(
          `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/git/blobs`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: file.source,
              encoding: "utf-8",
            }),
          },
        );

      return {
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      };
    }),
  );

  const tree =
    await githubRequest<GitHubTree>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/git/trees`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_tree: parentCommit.tree.sha,
          tree: treeEntries,
        }),
      },
    );

  const commit =
    await githubRequest<{ sha: string }>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/git/commits`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: [expectedHeadSha],
        }),
      },
    );

  await githubRequest<GitHubReference>(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}` +
      `/git/refs/heads/${encodeURIComponent(GITHUB_BRANCH)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sha: commit.sha,
        force: false,
      }),
    },
  );
}
