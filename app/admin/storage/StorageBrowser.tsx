"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./storage.module.css";

type Folder = {
  name: string;
  path: string;
};

type FileItem = {
  name: string;
  path: string;
  objectKey: string;
  sizeBytes: number;
  lastModified?: string;
  isImage: boolean;
  viewUrl?: string;
};

type Listing = {
  path: string;
  folders: Folder[];
  files: FileItem[];
  nextCursor?: string;
  truncated: boolean;
};

type ViewMode = "grid" | "list";

function bytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;

  while (
    size >= 1024 &&
    unit < units.length - 1
  ) {
    size /= 1024;
    unit += 1;
  }

  return (
    (size >= 10 || unit === 0
      ? size.toFixed(0)
      : size.toFixed(1)) +
    " " +
    units[unit]
  );
}

function joinPath(
  base: string,
  relative: string,
) {
  return [base, relative]
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
}

function modified(value?: string) {
  return value
    ? new Intl.DateTimeFormat(
        "en-GB",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        },
      ).format(new Date(value))
    : "—";
}

function pathPrefixes(path: string) {
  const parts = path
    .split("/")
    .filter(Boolean);

  return parts.map((_, index) =>
    parts
      .slice(0, index + 1)
      .join("/"),
  );
}

export default function StorageBrowser() {
  const [listing, setListing] =
    useState<Listing>({
      path: "",
      folders: [],
      files: [],
      truncated: false,
    });

  const [view, setView] =
    useState<ViewMode>("grid");

  const [query, setQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<{
      folders: Folder[];
      files: FileItem[];
    } | null>(null);

  const [rootFolders, setRootFolders] =
    useState<Folder[]>([]);

  const [treeChildren, setTreeChildren] =
    useState<
      Record<string, Folder[]>
    >({});

  const [message, setMessage] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [
    selectedFiles,
    setSelectedFiles,
  ] = useState<string[]>([]);

  const [
    selectedFolders,
    setSelectedFolders,
  ] = useState<string[]>([]);

  const [uploadOpen, setUploadOpen] =
    useState(false);

  const filesRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const folderRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  async function fetchListing(
    path: string,
  ): Promise<Listing> {
    const response =
      await fetch(
        "/api/admin/storage?path=" +
          encodeURIComponent(path),
        { cache: "no-store" },
      );

    const data =
      await response.json();

    if (!data.ok) {
      throw new Error(
        data.message ||
          "Could not load storage.",
      );
    }

    return data.listing;
  }

  async function refreshTree(
    path: string,
    current?: Listing,
  ) {
    const prefixes =
      pathPrefixes(path);

    const requested = [
      "",
      ...prefixes,
    ];

    const loaded =
      await Promise.all(
        requested.map(
          async (treePath) => {
            if (
              current &&
              current.path ===
                treePath
            ) {
              return current;
            }

            return fetchListing(
              treePath,
            );
          },
        ),
      );

    const root =
      loaded.find(
        (item) =>
          item.path === "",
      );

    if (root) {
      setRootFolders(
        root.folders,
      );
    }

    setTreeChildren(
      (previous) => {
        const next = {
          ...previous,
        };

        for (const item of loaded) {
          if (item.path) {
            next[item.path] =
              item.folders;
          }
        }

        return next;
      },
    );
  }

  async function load(path = "") {
    setBusy(true);

    try {
      const current =
        await fetchListing(path);

      setListing(current);
      setSearchResults(null);
      setQuery("");
      setMessage("");

      await refreshTree(
        path,
        current,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load storage.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  async function search() {
    const value =
      query.trim();

    if (!value) {
      setSearchResults(null);
      return;
    }

    setBusy(true);

    try {
      const response =
        await fetch(
          "/api/admin/storage?q=" +
            encodeURIComponent(
              value,
            ),
          {
            cache: "no-store",
          },
        );

      const data =
        await response.json();

      if (!data.ok) {
        throw new Error(
          data.message ||
            "Search failed.",
        );
      }

      setSearchResults(
        data.search,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Search failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload(
    files: FileList | null,
    folderMode = false,
  ) {
    if (!files?.length) {
      return;
    }

    setBusy(true);
    setUploadOpen(false);

    try {
      const queued =
        Array.from(files).map(
          (file) => ({
            file,
            path: joinPath(
              listing.path,
              folderMode
                ? (
                    file as File & {
                      webkitRelativePath?: string;
                    }
                  )
                    .webkitRelativePath ||
                    file.name
                : file.name,
            ),
          }),
        );

      let completed = 0;

      for (
        let start = 0;
        start < queued.length;
        start += 50
      ) {
        const batch =
          queued.slice(
            start,
            start + 50,
          );

        const response =
          await fetch(
            "/api/admin/storage",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                action:
                  "presign-upload-batch",
                paths:
                  batch.map(
                    (item) =>
                      item.path,
                  ),
              }),
            },
          );

        const data =
          await response.json();

        if (!data.ok) {
          throw new Error(
            data.message ||
              "Could not prepare upload.",
          );
        }

        for (
          let index = 0;
          index < batch.length;
          index += 1
        ) {
          const item =
            batch[index];

          setMessage(
            "Uploading " +
              (completed + 1) +
              " of " +
              queued.length +
              " · " +
              item.file.name,
          );

          const put =
            await fetch(
              data.jobs[index]
                .uploadUrl,
              {
                method: "PUT",
                body: item.file,
              },
            );

          if (!put.ok) {
            throw new Error(
              "Upload failed for " +
                item.file.name +
                ".",
            );
          }

          completed += 1;
        }
      }

      setMessage(
        queued.length +
          " " +
          (queued.length === 1
            ? "file"
            : "files") +
          " uploaded.",
      );

      await load(
        listing.path,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Upload failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createFolder() {
    const name =
      window.prompt(
        "New folder name",
      );

    if (!name?.trim()) {
      return;
    }

    const path =
      joinPath(
        listing.path,
        name.trim(),
      );

    setBusy(true);

    try {
      const response =
        await fetch(
          "/api/admin/storage",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "create-folder",
                path,
              }),
          },
        );

      const data =
        await response.json();

      if (!data.ok) {
        throw new Error(
          data.message ||
            "Could not create folder.",
        );
      }

      await load(
        listing.path,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create folder.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function download(
    file: FileItem,
  ) {
    const response =
      await fetch(
        "/api/admin/storage",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              action: "download",
              objectKey:
                file.objectKey,
              name: file.name,
            }),
        },
      );

    const data =
      await response.json();

    if (data.ok) {
      window.location.assign(
        data.url,
      );
    } else {
      setMessage(
        data.message ||
          "Download unavailable.",
      );
    }
  }

  async function remove(
    file: FileItem,
  ) {
    if (
      !confirm(
        "Delete " +
          file.name +
          " from Storage?",
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const response =
        await fetch(
          "/api/admin/storage",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "delete-file",
                objectKey:
                  file.objectKey,
              }),
          },
        );

      const data =
        await response.json();

      if (!data.ok) {
        throw new Error(
          data.message ||
            "Delete failed.",
        );
      }

      setSelectedFiles(
        (current) =>
          current.filter(
            (key) =>
              key !==
              file.objectKey,
          ),
      );

      await load(
        listing.path,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Delete failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleFile(
    objectKey: string,
  ) {
    setSelectedFiles(
      (current) =>
        current.includes(
          objectKey,
        )
          ? current.filter(
              (key) =>
                key !==
                objectKey,
            )
          : [
              ...current,
              objectKey,
            ],
    );
  }

  function toggleFolder(
    path: string,
  ) {
    setSelectedFolders(
      (current) =>
        current.includes(path)
          ? current.filter(
              (item) =>
                item !== path,
            )
          : [
              ...current,
              path,
            ],
    );
  }

  function sendSelection() {
    if (
      !selectedFiles.length &&
      !selectedFolders.length
    ) {
      return;
    }

    sessionStorage.setItem(
      "backstage-transfer-archive-selection",
      JSON.stringify({
        objectKeys:
          selectedFiles,
        folderPaths:
          selectedFolders,
      }),
    );

    window.location.assign(
      "/admin/transfers?archive=1",
    );
  }

  function renderTreeChildren(
    parent: string,
    depth: number,
  ): React.ReactNode {
    const children =
      treeChildren[parent] ||
      [];

    return children.map(
      (folder) => {
        const expanded =
          listing.path ===
            folder.path ||
          listing.path.startsWith(
            folder.path + "/",
          );

        return (
          <div
            key={
              folder.path
            }
          >
            <button
              type="button"
              className={
                expanded
                  ? styles.treeActive
                  : ""
              }
              style={{
                paddingLeft:
                  12 +
                  depth * 14,
              }}
              onClick={() =>
                void load(
                  folder.path,
                )
              }
            >
              <span>
                {expanded
                  ? "⌄"
                  : "›"}
              </span>
              <span>
                📁
              </span>
              <span>
                {
                  folder.name
                }
              </span>
            </button>

            {expanded
              ? renderTreeChildren(
                  folder.path,
                  depth + 1,
                )
              : null}
          </div>
        );
      },
    );
  }

  const crumbs =
    listing.path
      ? listing.path.split("/")
      : [];

  const shown =
    searchResults || {
      folders:
        listing.folders,
      files:
        listing.files,
    };

  const selectionCount =
    selectedFiles.length +
    selectedFolders.length;

  return (
    <main
      className={styles.page}
    >
      <header
        className={
          styles.topbar
        }
      >
        <div>
          <p>Steve Gregson</p>
          <h1>Storage</h1>
        </div>

        <form
          className={
            styles.search
          }
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <span>⌕</span>

          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target
                  .value,
              )
            }
            placeholder="Search Storage"
          />

          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSearchResults(
                  null,
                );
              }}
            >
              ×
            </button>
          ) : null}
        </form>

        <div
          className={
            styles.topActions
          }
        >
          <div
            className={
              styles.uploadWrap
            }
          >
            <button
              type="button"
              className={
                styles.primary
              }
              onClick={() =>
                setUploadOpen(
                  (current) =>
                    !current,
                )
              }
            >
              ↑ Upload{" "}
              <span>⌄</span>
            </button>

            {uploadOpen ? (
              <div
                className={
                  styles.uploadMenu
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    filesRef.current?.click()
                  }
                >
                  Files
                </button>

                <button
                  type="button"
                  onClick={() =>
                    folderRef.current?.click()
                  }
                >
                  Folder
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() =>
              void createFolder()
            }
          >
            ▣ New folder
          </button>
        </div>

        <input
          ref={filesRef}
          className={
            styles.hidden
          }
          type="file"
          multiple
          onChange={(event) =>
            void upload(
              event.target.files,
            )
          }
        />

        <input
          ref={folderRef}
          className={
            styles.hidden
          }
          type="file"
          multiple
          {...({
            webkitdirectory: "",
            directory: "",
          } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={(event) =>
            void upload(
              event.target.files,
              true,
            )
          }
        />
      </header>

      <div
        className={
          styles.browser
        }
      >
        <aside
          className={
            styles.sidebar
          }
        >
          <button
            className={
              styles.allFiles
            }
            type="button"
            onClick={() =>
              void load("")
            }
          >
            ▦{" "}
            <span>
              All files
            </span>
          </button>

          <div
            className={
              styles.tree
            }
          >
            {rootFolders.map(
              (folder) => {
                const expanded =
                  listing.path ===
                    folder.path ||
                  listing.path.startsWith(
                    folder.path +
                      "/",
                  );

                return (
                  <div
                    key={
                      folder.path
                    }
                  >
                    <button
                      type="button"
                      className={
                        expanded
                          ? styles.treeActive
                          : ""
                      }
                      onClick={() =>
                        void load(
                          folder.path,
                        )
                      }
                    >
                      <span>
                        {expanded
                          ? "⌄"
                          : "›"}
                      </span>
                      <span>
                        📁
                      </span>
                      <span>
                        {
                          folder.name
                        }
                      </span>
                    </button>

                    {expanded
                      ? renderTreeChildren(
                          folder.path,
                          1,
                        )
                      : null}
                  </div>
                );
              },
            )}
          </div>
        </aside>

        <section
          className={
            styles.content
          }
          aria-busy={busy}
        >
          <div
            className={
              styles.breadcrumbs
            }
          >
            <button
              type="button"
              onClick={() =>
                void load("")
              }
            >
              All files
            </button>

            {crumbs.map(
              (
                crumb,
                index,
              ) => {
                const path =
                  crumbs
                    .slice(
                      0,
                      index + 1,
                    )
                    .join("/");

                return (
                  <span
                    key={
                      path
                    }
                  >
                    {" / "}
                    <button
                      type="button"
                      onClick={() =>
                        void load(
                          path,
                        )
                      }
                    >
                      {crumb}
                    </button>
                  </span>
                );
              },
            )}
          </div>

          <div
            className={
              styles.folderHead
            }
          >
            <div>
              <p>{searchResults ? "Search results" : crumbs.length ? "All files" : "Storage"}</p>
              <h2>{searchResults ? "“" + query + "”" : crumbs.at(-1) || "All files"}</h2>
            </div>

            <div
              className={
                styles.viewToggle
              }
              aria-label="View"
            >
              <button
                className={
                  view === "grid"
                    ? styles.active
                    : ""
                }
                type="button"
                onClick={() =>
                  setView(
                    "grid",
                  )
                }
                title="Thumbnail view"
                aria-label="Thumbnail view"
              >
                ▦
              </button>

              <button
                className={
                  view === "list"
                    ? styles.active
                    : ""
                }
                type="button"
                onClick={() =>
                  setView(
                    "list",
                  )
                }
                title="List view"
                aria-label="List view"
              >
                ☷
              </button>
            </div>
          </div>

          {selectionCount >
          0 ? (
            <div
              className={
                styles.selectionBar
              }
            >
              <strong>
                {
                  selectionCount
                }{" "}
                selected
              </strong>

              <button
                type="button"
                onClick={
                  sendSelection
                }
              >
                Send transfer
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedFiles(
                    [],
                  );
                  setSelectedFolders(
                    [],
                  );
                }}
              >
                Clear selection
              </button>
            </div>
          ) : null}

          {message ? (
            <p
              className={
                styles.message
              }
              aria-live="polite"
            >
              {message}
            </p>
          ) : null}

          {view === "list" ? (
            <div
              className={
                styles.list
              }
            >
              <div
                className={
                  styles.listHead
                }
              >
                <span />
                <strong>
                  Name
                </strong>
                <strong>
                  Last modified
                </strong>
                <strong>
                  Size
                </strong>
                <span />
              </div>

              {shown.folders.map(
                (folder) => (
                  <div
                    className={
                      styles.listRow
                    }
                    key={
                      folder.path
                    }
                  >
                    <input
                      aria-label={
                        "Select " +
                        folder.name
                      }
                      type="checkbox"
                      checked={selectedFolders.includes(
                        folder.path,
                      )}
                      onChange={() =>
                        toggleFolder(
                          folder.path,
                        )
                      }
                    />

                    <button
                      className={
                        styles.nameButton
                      }
                      type="button"
                      onClick={() =>
                        void load(
                          folder.path,
                        )
                      }
                    >
                      📁{" "}
                      <strong>
                        {
                          folder.name
                        }
                      </strong>
                    </button>

                    <span>—</span>
                    <span>—</span>
                    <span />
                  </div>
                ),
              )}

              {shown.files.map(
                (file) => (
                  <div
                    className={
                      styles.listRow
                    }
                    key={
                      file.objectKey
                    }
                  >
                    <input
                      aria-label={
                        "Select " +
                        file.name
                      }
                      type="checkbox"
                      checked={selectedFiles.includes(
                        file.objectKey,
                      )}
                      onChange={() =>
                        toggleFile(
                          file.objectKey,
                        )
                      }
                    />

                    <div
                      className={
                        styles.fileName
                      }
                    >
                      {file.isImage &&
                      file.viewUrl ? (
                        <img
                          src={
                            file.viewUrl
                          }
                          alt=""
                        />
                      ) : (
                        <span
                          className={
                            styles.fileIcon
                          }
                        >
                          FILE
                        </span>
                      )}

                      <strong>
                        {file.name}
                      </strong>
                    </div>

                    <span>
                      {modified(
                        file.lastModified,
                      )}
                    </span>

                    <span>
                      {bytes(
                        file.sizeBytes,
                      )}
                    </span>

                    <div
                      className={
                        styles.rowActions
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void download(
                            file,
                          )
                        }
                      >
                        Download
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void remove(
                            file,
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div
              className={
                styles.grid
              }
            >
              {shown.folders.map(
                (folder) => (
                  <article
                    className={
                      styles.folderCard
                    }
                    key={
                      folder.path
                    }
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedFolders.includes(
                          folder.path,
                        )}
                        onChange={() =>
                          toggleFolder(
                            folder.path,
                          )
                        }
                      />
                      Select
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        void load(
                          folder.path,
                        )
                      }
                    >
                      <span>
                        📁
                      </span>
                      <strong>
                        {
                          folder.name
                        }
                      </strong>
                      <small>
                        Folder
                      </small>
                    </button>
                  </article>
                ),
              )}

              {shown.files.map(
                (file) => (
                  <article
                    className={
                      styles.fileCard
                    }
                    key={
                      file.objectKey
                    }
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(
                          file.objectKey,
                        )}
                        onChange={() =>
                          toggleFile(
                            file.objectKey,
                          )
                        }
                      />
                      Select
                    </label>

                    <div
                      className={
                        styles.thumb
                      }
                    >
                      {file.isImage &&
                      file.viewUrl ? (
                        <img
                          src={
                            file.viewUrl
                          }
                          alt=""
                        />
                      ) : (
                        <span>
                          FILE
                        </span>
                      )}
                    </div>

                    <div
                      className={
                        styles.cardMeta
                      }
                    >
                      <strong
                        title={
                          file.name
                        }
                      >
                        {file.name}
                      </strong>

                      <span>
                        {bytes(
                          file.sizeBytes,
                        )}{" "}
                        ·{" "}
                        {modified(
                          file.lastModified,
                        )}
                      </span>
                    </div>

                    <div
                      className={
                        styles.cardActions
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void download(
                            file,
                          )
                        }
                      >
                        Download
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void remove(
                            file,
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}

          {!busy &&
          !shown.folders.length &&
          !shown.files.length ? (
            <p
              className={
                styles.empty
              }
            >
              {searchResults
                ? "No matching files or folders."
                : "This folder is empty."}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
