"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ExistingProduction = {
  slug: string;
  title: string;
  month: number | null;
  year: number;
};

type CuratedArchiveImportClientProps = {
  existingProductions: ExistingProduction[];
};

type PreflightProduction = {
  folder: string;
  production: string;
  title: string;
  venue: string;
  month: number | null;
  year: number | null;
  description: string;
  selectedCount: number;
  heroIndex: number | null;
  excluded: boolean;
  locked: boolean;
  automaticLocked: boolean;
  accessOverride:
    | "public"
    | "password"
    | null;
  accessSource:
    | "automatic"
    | "manual";
  existingSlug: string | null;
  status:
    | "ready"
    | "excluded"
    | "existing"
    | "attention";
  issues: string[];
};

type PreflightResponse = {
  ok: boolean;
  summary: {
    total: number;
    ready: number;
    excluded: number;
    existing: number;
    attention: number;
    locked: number;
  };
  productions: PreflightProduction[];
};

type StatusFilter =
  | "all"
  | "locked"
  | PreflightProduction["status"];

const MONTHS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function statusLabel(
  status: PreflightProduction["status"],
) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "excluded") {
    return "Excluded";
  }

  if (status === "existing") {
    return "Already published";
  }

  return "Needs attention";
}

export default function CuratedArchiveImportClient({
  existingProductions,
}: CuratedArchiveImportClientProps) {
  const [data, setData] =
    useState<PreflightResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [
    changingAccess,
    setChangingAccess,
  ] = useState<string | null>(null);

  const [
    importingProduction,
    setImportingProduction,
  ] = useState<string | null>(null);

  const [
    batchImporting,
    setBatchImporting,
  ] = useState(false);

  const [
    batchProgress,
    setBatchProgress,
  ] = useState<{
    current: number;
    total: number;
    title: string;
  } | null>(null);

  const [
    batchResult,
    setBatchResult,
  ] = useState<{
    imported: number;
    failed: Array<{
      title: string;
      message: string;
    }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreflight() {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/admin/curated-archive-import/preflight",
            {
              cache: "no-store",
            },
          );

        const result =
          (await response.json()) as
            | PreflightResponse
            | {
                ok?: boolean;
                message?: string;
              };

        if (
          !response.ok ||
          !result.ok ||
          !("summary" in result) ||
          !("productions" in result)
        ) {
          throw new Error(
            "message" in result &&
              result.message
              ? result.message
              : "Curated archive preflight failed.",
          );
        }

        if (!cancelled) {
          setData(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Curated archive preflight failed.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreflight();

    return () => {
      cancelled = true;
    };
  }, []);

  async function changeAccess(
    production: PreflightProduction,
    access:
      | "public"
      | "password"
      | "automatic",
  ) {
    const action =
      access === "public"
        ? "unlock"
        : access === "password"
          ? "lock"
          : "reset access for";

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${production.title || production.production}"?`,
      )
    ) {
      return;
    }

    setChangingAccess(
      production.production,
    );
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/curated-archive-import/access",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              production:
                production.production,
              access,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Could not change production access.",
        );
      }

      const preflightResponse =
        await fetch(
          "/api/admin/curated-archive-import/preflight",
          {
            cache: "no-store",
          },
        );

      const preflightResult =
        (await preflightResponse.json()) as
          | PreflightResponse
          | {
              ok?: boolean;
              message?: string;
            };

      if (
        !preflightResponse.ok ||
        !preflightResult.ok ||
        !("summary" in preflightResult) ||
        !("productions" in preflightResult)
      ) {
        throw new Error(
          "message" in preflightResult &&
            preflightResult.message
            ? preflightResult.message
            : "Access changed, but preflight refresh failed.",
        );
      }

      setData(preflightResult);
    } catch (accessError) {
      setError(
        accessError instanceof Error
          ? accessError.message
          : "Could not change production access.",
      );
    } finally {
      setChangingAccess(null);
    }
  }

  async function importProduction(
    production: PreflightProduction,
  ) {
    if (
      production.status !== "ready"
    ) {
      return;
    }

    if (
      !window.confirm(
        `Import "${production.title || production.production}" into the website archive now?`,
      )
    ) {
      return;
    }

    setImportingProduction(
      production.folder,
    );
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/curated-archive-import/publish",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              folder:
                production.folder,
            }),
          },
        );

      const result =
        (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "The curated production could not be imported.",
        );
      }

      const preflightResponse =
        await fetch(
          "/api/admin/curated-archive-import/preflight",
          {
            cache: "no-store",
          },
        );

      const preflightResult =
        (await preflightResponse.json()) as
          | PreflightResponse
          | {
              ok?: boolean;
              message?: string;
            };

      if (
        !preflightResponse.ok ||
        !preflightResult.ok ||
        !("summary" in preflightResult) ||
        !("productions" in preflightResult)
      ) {
        throw new Error(
          "message" in preflightResult &&
            preflightResult.message
            ? preflightResult.message
            : "Production imported, but preflight refresh failed.",
        );
      }

      setData(preflightResult);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The curated production could not be imported.",
      );
    } finally {
      setImportingProduction(null);
    }
  }

  async function importAllReady() {
    const readyProductions =
      data?.productions.filter(
        (production) =>
          production.status === "ready",
      ) ?? [];

    if (readyProductions.length === 0) {
      return;
    }

    if (
      !window.confirm(
        `Import all ${readyProductions.length} Ready productions into the website archive? They will be processed one at a time.`,
      )
    ) {
      return;
    }

    setBatchImporting(true);
    setBatchResult(null);
    setError("");

    let imported = 0;

    const failed: Array<{
      title: string;
      message: string;
    }> = [];

    try {
      for (
        let index = 0;
        index < readyProductions.length;
        index += 1
      ) {
        const production =
          readyProductions[index];

        const title =
          production.title ||
          production.production;

        setBatchProgress({
          current: index + 1,
          total:
            readyProductions.length,
          title,
        });

        try {
          const response =
            await fetch(
              "/api/admin/curated-archive-import/publish",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  folder:
                    production.folder,
                }),
              },
            );

          const result =
            (await response.json()) as {
              ok?: boolean;
              message?: string;
            };

          if (
            !response.ok ||
            !result.ok
          ) {
            throw new Error(
              result.message ||
                "Import failed.",
            );
          }

          imported += 1;
        } catch (productionError) {
          failed.push({
            title,
            message:
              productionError instanceof
              Error
                ? productionError.message
                : "Import failed.",
          });
        }
      }

      const preflightResponse =
        await fetch(
          "/api/admin/curated-archive-import/preflight",
          {
            cache: "no-store",
          },
        );

      const preflightResult =
        (await preflightResponse.json()) as
          | PreflightResponse
          | {
              ok?: boolean;
              message?: string;
            };

      if (
        !preflightResponse.ok ||
        !preflightResult.ok ||
        !("summary" in preflightResult) ||
        !("productions" in preflightResult)
      ) {
        throw new Error(
          "message" in preflightResult &&
            preflightResult.message
            ? preflightResult.message
            : "Batch import finished, but preflight refresh failed.",
        );
      }

      setData(preflightResult);

      setBatchResult({
        imported,
        failed,
      });
    } catch (batchError) {
      setError(
        batchError instanceof Error
          ? batchError.message
          : "The batch import could not be completed.",
      );

      setBatchResult({
        imported,
        failed,
      });
    } finally {
      setBatchProgress(null);
      setBatchImporting(false);
    }
  }

  const rows =
    useMemo(() => {
      const productions =
        data?.productions ?? [];

      if (statusFilter === "all") {
        return productions;
      }

      if (statusFilter === "locked") {
        return productions.filter(
          (production) =>
            production.locked,
        );
      }

      return productions.filter(
        (production) =>
          production.status ===
          statusFilter,
      );
    }, [data, statusFilter]);

  return (
    <section
      style={{
        borderTop:
          "1px solid rgba(242, 238, 230, 0.14)",
        paddingTop: "2rem",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#c7a369",
          fontSize: "0.56rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Curated archive preflight
      </p>

      <h2
        style={{
          margin: "0.8rem 0 0",
          fontFamily:
            '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
          fontSize:
            "clamp(2rem, 4vw, 3.5rem)",
          fontWeight: 400,
          letterSpacing: "-0.04em",
        }}
      >
        Archive readiness
      </h2>

      <p
        style={{
          maxWidth: "46rem",
          margin: "1rem 0 0",
          color:
            "rgba(242, 238, 230, 0.62)",
          lineHeight: 1.7,
        }}
      >
        This is a read-only scan of the
        completed curated Archive output.
        No OpenAI or Dropbox requests are
        made by this preflight.
      </p>

      {loading ? (
        <p
          style={{
            margin: "2rem 0 0",
            color:
              "rgba(242, 238, 230, 0.55)",
          }}
        >
          Scanning curated Archive…
        </p>
      ) : null}

      {error ? (
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem 1.25rem",
            border:
              "1px solid rgba(220, 100, 100, 0.35)",
            color: "#f0b2aa",
          }}
        >
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(9rem, 1fr))",
              gap: "0.8rem",
              marginTop: "2.25rem",
            }}
          >
            {(
              [
                [
                  "Final selections",
                  data.summary.total,
                  "all",
                ],
                [
                  "Ready",
                  data.summary.ready,
                  "ready",
                ],
                [
                  "Existing",
                  data.summary.existing,
                  "existing",
                ],
                [
                  "Excluded",
                  data.summary.excluded,
                  "excluded",
                ],
                [
                  "Attention",
                  data.summary.attention,
                  "attention",
                ],
                [
                  "Locked",
                  data.summary.locked,
                  "locked",
                ],
              ] as const
            ).map(
              ([label, value, filter]) => {
                const active =
                  statusFilter === filter;

                return (
                  <button
                    type="button"
                    key={label}
                    onClick={() =>
                      setStatusFilter(filter)
                    }
                    aria-pressed={active}
                    style={{
                      minHeight: "7rem",
                      padding: "1rem 1.1rem",
                      border: active
                        ? "1px solid rgba(199, 163, 105, 0.72)"
                        : "1px solid rgba(242, 238, 230, 0.12)",
                      background: active
                        ? "rgba(199, 163, 105, 0.09)"
                        : "rgba(242, 238, 230, 0.025)",
                      color: "inherit",
                      textAlign: "left",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                <p
                  style={{
                    margin: 0,
                    color: "#c7a369",
                    fontSize: "0.52rem",
                    fontWeight: 700,
                    letterSpacing:
                      "0.15em",
                    textTransform:
                      "uppercase",
                  }}
                >
                  {label}
                </p>

                <p
                  style={{
                    margin:
                      "0.7rem 0 0",
                    fontFamily:
                      '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                    fontSize: "2.25rem",
                    lineHeight: 1,
                  }}
                >
                  {value}
                </p>
                  </button>
                );
              },
            )}
          </div>

          <p
            style={{
              margin: "1rem 0 0",
              color:
                "rgba(242, 238, 230, 0.42)",
              fontSize: "0.7rem",
            }}
          >
            Existing website productions:
            {" "}
            {existingProductions.length}
          </p>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1.25rem 1.35rem",
              border:
                "1px solid rgba(199, 163, 105, 0.28)",
              background:
                "rgba(199, 163, 105, 0.045)",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  color: "#c7a369",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  letterSpacing:
                    "0.14em",
                  textTransform:
                    "uppercase",
                }}
              >
                Batch curated import
              </p>

              <p
                style={{
                  margin:
                    "0.5rem 0 0",
                  color:
                    "rgba(242, 238, 230, 0.62)",
                  fontSize: "0.75rem",
                  lineHeight: 1.5,
                }}
              >
                {batchProgress
                  ? `Importing ${batchProgress.current} of ${batchProgress.total} — ${batchProgress.title}`
                  : `${data.summary.ready} Ready production${data.summary.ready === 1 ? "" : "s"} available to import.`}
              </p>

              {batchResult ? (
                <p
                  style={{
                    margin:
                      "0.45rem 0 0",
                    color:
                      batchResult.failed
                        .length > 0
                        ? "#f0b2aa"
                        : "rgba(242, 238, 230, 0.72)",
                    fontSize:
                      "0.68rem",
                    lineHeight: 1.5,
                  }}
                >
                  Imported{" "}
                  {batchResult.imported}.
                  {" "}
                  Failed{" "}
                  {
                    batchResult.failed
                      .length
                  }.
                  {batchResult.failed
                    .length > 0
                    ? ` ${batchResult.failed
                        .map(
                          (failure) =>
                            `${failure.title}: ${failure.message}`,
                        )
                        .join(" · ")}`
                    : ""}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              className="backstage-button"
              disabled={
                batchImporting ||
                data.summary.ready === 0
              }
              onClick={() =>
                void importAllReady()
              }
              style={{
                cursor:
                  batchImporting ||
                  data.summary.ready === 0
                    ? "wait"
                    : "pointer",
                opacity:
                  batchImporting ||
                  data.summary.ready === 0
                    ? 0.5
                    : 1,
              }}
            >
              {batchImporting
                ? "Importing…"
                : `Import All Ready (${data.summary.ready})`}
            </button>
          </div>

          <div
            style={{
              marginTop: "3rem",
              borderTop:
                "1px solid rgba(242, 238, 230, 0.12)",
            }}
          >
            {rows.map(
              (production) => (
                <article
                  key={production.folder}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1fr) auto",
                    gap: "1.5rem",
                    padding:
                      "1.35rem 0",
                    borderBottom:
                      "1px solid rgba(242, 238, 230, 0.1)",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        color:
                          "rgba(242, 238, 230, 0.42)",
                        fontSize:
                          "0.54rem",
                        fontWeight: 700,
                        letterSpacing:
                          "0.13em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      {production.venue}
                      {production.venue &&
                      production.year
                        ? " · "
                        : ""}
                      {production.month
                        ? `${
                            MONTHS[
                              production
                                .month
                            ]
                          } `
                        : ""}
                      {production.year ??
                        ""}
                    </p>

                    <h3
                      style={{
                        margin:
                          "0.45rem 0 0",
                        fontFamily:
                          '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
                        fontSize:
                          "1.55rem",
                        fontWeight: 400,
                        letterSpacing:
                          "-0.025em",
                      }}
                    >
                      {production.title ||
                        production.production}
                    </h3>

                    <p
                      style={{
                        margin:
                          "0.55rem 0 0",
                        color:
                          "rgba(242, 238, 230, 0.46)",
                        fontSize:
                          "0.68rem",
                      }}
                    >
                      {
                        production.selectedCount
                      }{" "}
                      selected image
                      {production.selectedCount ===
                      1
                        ? ""
                        : "s"}
                      {production.heroIndex
                        ? ` · Hero #${String(
                            production.heroIndex,
                          ).padStart(
                            4,
                            "0",
                          )}`
                        : ""}
                    </p>

                    {production.issues
                      .length > 0 ? (
                      <div
                        style={{
                          marginTop:
                            "0.65rem",
                        }}
                      >
                        {production.issues.map(
                          (issue) => (
                            <p
                              key={
                                issue
                              }
                              style={{
                                margin:
                                  "0.2rem 0 0",
                                color:
                                  "rgba(240, 178, 170, 0.78)",
                                fontSize:
                                  "0.68rem",
                              }}
                            >
                              {issue}
                            </p>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      alignSelf:
                        "center",
                      textAlign:
                        "right",
                    }}
                  >
                    <span
                      style={{
                        display:
                          "inline-block",
                        padding:
                          "0.4rem 0.6rem",
                        border:
                          "1px solid rgba(199, 163, 105, 0.3)",
                        color:
                          production.status ===
                          "attention"
                            ? "#f0b2aa"
                            : "#c7a369",
                        fontSize:
                          "0.5rem",
                        fontWeight: 700,
                        letterSpacing:
                          "0.13em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      {statusLabel(
                        production.status,
                      )}
                    </span>

                    <div
                      style={{
                        marginTop:
                          "0.55rem",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color:
                            production.locked
                              ? "#c7a369"
                              : "rgba(242, 238, 230, 0.48)",
                          fontSize:
                            "0.55rem",
                          fontWeight: 700,
                          letterSpacing:
                            "0.13em",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {production.locked
                          ? "Locked"
                          : "Public"}
                        {" · "}
                        {production.accessSource ===
                        "manual"
                          ? "Manual override"
                          : "Automatic"}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "flex-end",
                          flexWrap: "wrap",
                          gap: "0.4rem",
                          marginTop:
                            "0.45rem",
                        }}
                      >
                        {production.status ===
                        "ready" ? (
                          <button
                            type="button"
                            className="backstage-button"
                            disabled={
                              importingProduction ===
                              production.folder
                            }
                            onClick={() =>
                              void importProduction(
                                production,
                              )
                            }
                            style={{
                              cursor:
                                importingProduction ===
                                production.folder
                                  ? "wait"
                                  : "pointer",
                              opacity:
                                importingProduction ===
                                production.folder
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            {importingProduction ===
                            production.folder
                              ? "Importing…"
                              : "Import"}
                          </button>
                        ) : null}

                        <a
                          className="backstage-button"
                          href={`/admin/curated-archive-import/edit/${encodeURIComponent(
                            production.production,
                          )}`}
                          style={{
                            textDecoration:
                              "none",
                          }}
                        >
                          Edit
                        </a>

                        <button
                          type="button"
                          disabled={
                            changingAccess ===
                            production.production
                          }
                          onClick={() =>
                            void changeAccess(
                              production,
                              production.locked
                                ? "public"
                                : "password",
                            )
                          }
                          style={{
                            padding:
                              "0.35rem 0.55rem",
                            border:
                              "1px solid rgba(199, 163, 105, 0.32)",
                            background:
                              "transparent",
                            color:
                              "#c7a369",
                            cursor:
                              changingAccess ===
                              production.production
                                ? "wait"
                                : "pointer",
                            font:
                              "inherit",
                            fontSize:
                              "0.5rem",
                            fontWeight: 700,
                            letterSpacing:
                              "0.1em",
                            textTransform:
                              "uppercase",
                            opacity:
                              changingAccess ===
                              production.production
                                ? 0.55
                                : 1,
                          }}
                        >
                          {changingAccess ===
                          production.production
                            ? "Changing…"
                            : production.locked
                              ? "Unlock"
                              : "Lock"}
                        </button>

                        {production.accessSource ===
                        "manual" ? (
                          <button
                            type="button"
                            disabled={
                              changingAccess ===
                              production.production
                            }
                            onClick={() =>
                              void changeAccess(
                                production,
                                "automatic",
                              )
                            }
                            style={{
                              padding:
                                "0.35rem 0.55rem",
                              border:
                                "1px solid rgba(242, 238, 230, 0.16)",
                              background:
                                "transparent",
                              color:
                                "rgba(242, 238, 230, 0.62)",
                              cursor:
                                changingAccess ===
                                production.production
                                  ? "wait"
                                  : "pointer",
                              font:
                                "inherit",
                              fontSize:
                                "0.5rem",
                              fontWeight: 700,
                              letterSpacing:
                                "0.1em",
                              textTransform:
                                "uppercase",
                              opacity:
                                changingAccess ===
                                production.production
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            Reset to automatic
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {production.existingSlug ? (
                      <p
                        style={{
                          margin:
                            "0.55rem 0 0",
                          color:
                            "rgba(242, 238, 230, 0.4)",
                          fontSize:
                            "0.6rem",
                        }}
                      >
                        /
                        {
                          production.existingSlug
                        }
                      </p>
                    ) : null}
                  </div>
                </article>
              ),
            )}
          </div>
        </>
      ) : null}

      <div
        style={{
          marginTop: "2.5rem",
          padding: "1.25rem 1.5rem",
          border:
            "1px solid rgba(199, 163, 105, 0.28)",
          background:
            "rgba(199, 163, 105, 0.045)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#c7a369",
            fontSize: "0.64rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Zero-AI import path
        </p>

        <p
          style={{
            margin: "0.65rem 0 0",
            color:
              "rgba(242, 238, 230, 0.68)",
            lineHeight: 1.65,
          }}
        >
          Curated Archive Import does not
          call the vision review or
          image-analysis endpoints used
          by general Bulk Import.
        </p>
      </div>
    </section>
  );
}
