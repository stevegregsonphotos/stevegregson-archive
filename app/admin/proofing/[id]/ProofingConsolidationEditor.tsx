"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Visitor = {
  id: string;
  email: string;
  status: string;
  favouriteCount: number;
  submittedFavouriteCount: number;
  lastSeenAt: string;
};

type ConsolidatedParticipant = {
  visitorId: string;
  publicLabel?: string;
  imageIds: string[];
};

type ConsolidatedSelection = {
  id: string;
  galleryId: string;
  title: string;
  visible: boolean;
  definitiveImageIds: string[];
  participants:
    ConsolidatedParticipant[];
};

type LoadResponse = {
  ok: boolean;
  visitors?: Visitor[];
  consolidated?: ConsolidatedSelection;
  message?: string;
};

type SaveResponse = {
  ok: boolean;
  consolidated?: ConsolidatedSelection;
  message?: string;
};

type ProofingConsolidationEditorProps = {
  galleryId: string;
};

export default function ProofingConsolidationEditor({
  galleryId,
}: ProofingConsolidationEditorProps) {
  const [visitors, setVisitors] =
    useState<Visitor[]>([]);

  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(
      new Set(),
    );

  const [labels, setLabels] =
    useState<Record<string, string>>(
      {},
    );

  const [title, setTitle] =
    useState(
      "Consolidated favourites from all participants",
    );

  const [visible, setVisible] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [messageType, setMessageType] =
    useState<
      "success" | "error" | null
    >(null);

  const [hasExisting, setHasExisting] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setMessage(null);
      setMessageType(null);

      try {
        const response =
          await fetch(
            `/api/admin/proofing/consolidated-selection?galleryId=${encodeURIComponent(
              galleryId,
            )}`,
          );

        const data =
          (await response.json()) as
            LoadResponse;

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data.message ??
              "The consolidation data could not be loaded.",
          );
        }

        if (cancelled) {
          return;
        }

        const nextVisitors =
          data.visitors ?? [];

        setVisitors(
          nextVisitors,
        );

        if (
          data.consolidated
        ) {
          setHasExisting(true);

          setTitle(
            data.consolidated
              .title,
          );

          setVisible(
            data.consolidated
              .visible === true,
          );

          setSelectedIds(
            new Set(
              data.consolidated
                .participants
                .map(
                  (participant) =>
                    participant.visitorId,
                ),
            ),
          );

          setLabels(
            Object.fromEntries(
              data.consolidated
                .participants
                .map(
                  (participant) => [
                    participant.visitorId,
                    participant
                      .publicLabel ??
                      "",
                  ],
                ),
            ),
          );
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "The consolidation data could not be loaded.",
        );

        setMessageType(
          "error",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [galleryId]);

  const selectableVisitors =
    useMemo(
      () =>
        visitors.filter(
          (visitor) =>
            visitor.favouriteCount >
            0,
        ),
      [visitors],
    );

  function toggleVisitor(
    visitorId: string,
  ) {
    setSelectedIds(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(visitorId)
        ) {
          next.delete(
            visitorId,
          );
        } else {
          next.add(
            visitorId,
          );
        }

        return next;
      },
    );

    setMessage(null);
    setMessageType(null);
  }

  async function save() {
    if (
      selectedIds.size === 0
    ) {
      setMessage(
        "Select at least one visitor.",
      );
      setMessageType(
        "error",
      );
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setMessageType(null);

    try {
      const response =
        await fetch(
          "/api/admin/proofing/consolidated-selection",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              galleryId,
              title:
                title.trim(),
              visible,
              participants:
                [...selectedIds]
                  .map(
                    (visitorId) => ({
                      visitorId,
                      publicLabel:
                        labels[
                          visitorId
                        ]?.trim() ||
                        undefined,
                    }),
                  ),
            }),
          },
        );

      const data =
        (await response.json()) as
          SaveResponse;

      if (
        !response.ok ||
        !data.ok ||
        !data.consolidated
      ) {
        throw new Error(
          data.message ??
            "The consolidated selection could not be saved.",
        );
      }

      setHasExisting(true);

      setVisible(
        data.consolidated.visible === true,
      );

      setMessage(
        data.consolidated.visible
          ? "Consolidated selection saved and visible to clients."
          : "Consolidated selection saved. It is hidden from clients.",
      );

      setMessageType(
        "success",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The consolidated selection could not be saved.",
      );

      setMessageType(
        "error",
      );
    } finally {
      setIsSaving(
        false,
      );
    }
  }

  return (
    <section
      style={{
        marginTop: "2.5rem",
        paddingTop: "2rem",
        borderTop:
          "1px solid rgba(242, 238, 230, 0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="proofing-section-label">
            Consolidated selection
          </p>

          <h3
            style={{
              margin:
                "0.4rem 0 0",
              fontSize:
                "1.25rem",
              fontWeight: 500,
            }}
          >
            Consolidate favourites
          </h3>

          <p
            style={{
              margin:
                "0.65rem 0 0",
              maxWidth: "46rem",
              color:
                "rgba(242, 238, 230, 0.58)",
              lineHeight: 1.6,
            }}
          >
            Choose exactly which
            visitors to include.
            Their current favourites
            are copied into a separate
            consolidated snapshot.
            Existing client selections
            are never changed.
          </p>
        </div>

        {hasExisting ? (
          <span
            style={{
              color:
                "#c7a369",
              fontSize:
                "0.65rem",
              fontWeight: 700,
              letterSpacing:
                "0.12em",
              textTransform:
                "uppercase",
            }}
          >
            Existing consolidation
          </span>
        ) : null}
      </div>

      <label
        style={{
          display: "block",
          marginTop: "1.75rem",
        }}
      >
        <span
          style={{
            display: "block",
            marginBottom:
              "0.5rem",
            fontSize:
              "0.7rem",
            fontWeight: 700,
            letterSpacing:
              "0.1em",
            textTransform:
              "uppercase",
            color:
              "rgba(242, 238, 230, 0.62)",
          }}
        >
          Client-facing title
        </span>

        <input
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(
              event.target.value,
            );
            setMessage(null);
            setMessageType(null);
          }}
          style={{
            width: "100%",
            maxWidth: "42rem",
          }}
        />
      </label>

      {isLoading ? (
        <p
          style={{
            marginTop: "1.5rem",
          }}
        >
          Loading visitors…
        </p>
      ) : selectableVisitors.length ===
        0 ? (
        <p
          className="proofing-empty"
          style={{
            marginTop: "1.5rem",
          }}
        >
          No visitors currently
          have favourites to
          consolidate.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "0.85rem",
            marginTop:
              "1.75rem",
          }}
        >
          {selectableVisitors.map(
            (visitor) => {
              const selected =
                selectedIds.has(
                  visitor.id,
                );

              return (
                <div
                  key={
                    visitor.id
                  }
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "minmax(14rem, 1fr) minmax(12rem, 22rem)",
                    gap: "1rem",
                    alignItems:
                      "center",
                    padding:
                      "1rem",
                    border:
                      selected
                        ? "1px solid rgba(199, 163, 105, 0.7)"
                        : "1px solid rgba(242, 238, 230, 0.12)",
                    background:
                      selected
                        ? "rgba(199, 163, 105, 0.06)"
                        : "rgba(255, 255, 255, 0.015)",
                  }}
                >
                  <label
                    style={{
                      display:
                        "flex",
                      gap:
                        "0.85rem",
                      alignItems:
                        "flex-start",
                      cursor:
                        "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        selected
                      }
                      onChange={() =>
                        toggleVisitor(
                          visitor.id,
                        )
                      }
                    />

                    <span>
                      <strong
                        style={{
                          display:
                            "block",
                        }}
                      >
                        {
                          visitor.email
                        }
                      </strong>

                      <span
                        style={{
                          display:
                            "block",
                          marginTop:
                            "0.3rem",
                          color:
                            "rgba(242, 238, 230, 0.5)",
                          fontSize:
                            "0.76rem",
                        }}
                      >
                        {
                          visitor.favouriteCount
                        }{" "}
                        favourite
                        {visitor.favouriteCount ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </span>
                  </label>

                  <label>
                    <span
                      style={{
                        display:
                          "block",
                        marginBottom:
                          "0.4rem",
                        color:
                          "rgba(242, 238, 230, 0.5)",
                        fontSize:
                          "0.65rem",
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      Public label
                      (optional)
                    </span>

                    <input
                      type="text"
                      value={
                        labels[
                          visitor.id
                        ] ?? ""
                      }
                      disabled={
                        !selected
                      }
                      placeholder="e.g. Marketing"
                      onChange={(
                        event,
                      ) => {
                        setLabels(
                          (
                            current,
                          ) => ({
                            ...current,
                            [visitor.id]:
                              event
                                .target
                                .value,
                          }),
                        );
                      }}
                      style={{
                        width:
                          "100%",
                      }}
                    />
                  </label>
                </div>
              );
            },
          )}
        </div>
      )}

      <p
        style={{
          margin:
            "1.25rem 0 0",
          color:
            "rgba(242, 238, 230, 0.48)",
          fontSize:
            "0.74rem",
          lineHeight: 1.6,
        }}
      >
        Email addresses are used
        only here in Backstage to
        identify participants.
        Client-facing consolidated
        selections will expose only
        labels you choose to enter.
      </p>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          marginTop: "1.5rem",
          padding: "1rem",
          border:
            "1px solid rgba(242, 238, 230, 0.14)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={visible}
          disabled={
            isLoading ||
            isSaving ||
            !hasExisting
          }
          onChange={(event) => {
            setVisible(
              event.target.checked,
            );
            setMessage(null);
            setMessageType(null);
          }}
        />

        <span>
          <strong>
            Show consolidated selection to clients
          </strong>

          <span
            style={{
              display: "block",
              marginTop: "0.25rem",
              color:
                "rgba(242, 238, 230, 0.5)",
              fontSize: "0.75rem",
            }}
          >
            When enabled, visitors to this gallery can
            open the separate Consolidated view. Email
            addresses are never shown.
          </span>
        </span>
      </label>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems:
            "center",
          flexWrap: "wrap",
          marginTop:
            "1.5rem",
        }}
      >
        <button
          type="button"
          className="backstage-button backstage-button-primary"
          disabled={
            isLoading ||
            isSaving ||
            selectedIds.size === 0
          }
          onClick={() =>
            void save()
          }
        >
          {isSaving
            ? "Saving…"
            : hasExisting
              ? "Update consolidated selection"
              : "Create consolidated selection"}
        </button>

        <span
          style={{
            color:
              "rgba(242, 238, 230, 0.5)",
            fontSize:
              "0.75rem",
          }}
        >
          {selectedIds.size}{" "}
          participant
          {selectedIds.size ===
          1
            ? ""
            : "s"}{" "}
          selected
        </span>
      </div>

      {message ? (
        <p
          role="status"
          style={{
            margin:
              "1rem 0 0",
            color:
              messageType ===
              "error"
                ? "#e6a29a"
                : "#c7a369",
          }}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
