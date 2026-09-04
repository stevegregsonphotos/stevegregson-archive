"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";


import type {
  ProofingCompany,
  ProofingContact,
} from "@/lib/proofing/types";
type Props = {
  createGallery: (
    formData: FormData,
  ) => Promise<void>;
  contacts: ProofingContact[];
  companies: ProofingCompany[];
};

function todayForInput() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    now.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function NewGalleryModal({
  createGallery,
  contacts,
  companies,
}: Props) {
  const [open, setOpen] = useState(false);

  const [
    selectedRecipientIds,
    setSelectedRecipientIds,
  ] = useState<string[]>([]);

  const [recipientQuery, setRecipientQuery] =
    useState("");

  const [
    oneOffRecipientEmails,
    setOneOffRecipientEmails,
  ] = useState<string[]>([]);

  const cleanRecipientQuery =
    recipientQuery.trim().toLowerCase();

  const recipientQueryIsEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      cleanRecipientQuery,
    );

  const recipientQueryMatchesSavedEmail =
    contacts.some(
      (contact) =>
        contact.email.toLowerCase() ===
        cleanRecipientQuery,
    );

  const canAddOneOffRecipient =
    recipientQueryIsEmail &&
    !recipientQueryMatchesSavedEmail &&
    !oneOffRecipientEmails.includes(
      cleanRecipientQuery,
    );

  const companyNames = new Map(
    companies.map((company) => [
      company.id,
      company.name,
    ]),
  );

  const dialogRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="sp-galleries-new"
        onClick={() => setOpen(true)}
      >
        New Gallery
      </button>

      {open ? (
        <div
          className="sp-create-gallery-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            className="sp-create-gallery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sp-create-gallery-title"
          >
            <div className="sp-create-gallery-heading">
              <h2 id="sp-create-gallery-title">
                Create Gallery
              </h2>

              <button
                type="button"
                className="sp-create-gallery-close"
                aria-label="Close"
                onClick={() =>
                  setOpen(false)
                }
              >
                ×
              </button>
            </div>

            <form
              action={createGallery}
              className="sp-create-gallery-form"
            >
              <div className="sp-create-gallery-row">
                <div className="sp-create-gallery-field">
                  <label htmlFor="modal-title">
                    Gallery Name
                    <span>*</span>
                  </label>

                  <input
                    id="modal-title"
                    name="title"
                    type="text"
                    autoFocus
                    required
                  />
                </div>

                <div className="sp-create-gallery-field">
                  <label htmlFor="modal-shoot-date">
                    Shoot Date
                    <span>*</span>
                  </label>

                  <input
                    id="modal-shoot-date"
                    name="shootDate"
                    type="date"
                    defaultValue={todayForInput()}
                    required
                  />
                </div>
              </div>

              <div className="sp-create-gallery-field sp-create-gallery-recipients">
                <label htmlFor="modal-recipient">
                  Recipients
                </label>

                {selectedRecipientIds.length > 0 ||
                oneOffRecipientEmails.length > 0 ? (
                  <div className="sp-create-gallery-recipient-chips">
                    {selectedRecipientIds.map(
                      (contactId) => {
                        const contact =
                          contacts.find(
                            (item) =>
                              item.id ===
                              contactId,
                          );

                        if (!contact) {
                          return null;
                        }

                        return (
                          <button
                            key={contact.id}
                            type="button"
                            className="sp-create-gallery-recipient-chip"
                            onClick={() =>
                              setSelectedRecipientIds(
                                (current) =>
                                  current.filter(
                                    (id) =>
                                      id !==
                                      contact.id,
                                  ),
                              )
                            }
                            aria-label={`Remove ${contact.name}`}
                          >
                            <span>
                              {contact.name}
                            </span>

                            <span aria-hidden="true">
                              ×
                            </span>
                          </button>
                        );
                      },
                    )}

                    {oneOffRecipientEmails.map(
                      (email) => (
                        <button
                          key={email}
                          type="button"
                          className="sp-create-gallery-recipient-chip"
                          onClick={() =>
                            setOneOffRecipientEmails(
                              (current) =>
                                current.filter(
                                  (item) =>
                                    item !== email,
                                ),
                            )
                          }
                          aria-label={`Remove ${email}`}
                        >
                          <span>{email}</span>

                          <span aria-hidden="true">
                            ×
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                ) : null}

                <input
                  id="modal-recipient"
                  type="search"
                  value={recipientQuery}
                  onChange={(event) =>
                    setRecipientQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Search name, company or email"
                  autoComplete="off"
                />

                {recipientQuery.trim() ? (
                  <div className="sp-create-gallery-recipient-results">
                    {contacts
                      .filter((contact) => {
                        if (
                          selectedRecipientIds.includes(
                            contact.id,
                          )
                        ) {
                          return false;
                        }

                        const query =
                          recipientQuery
                            .trim()
                            .toLowerCase();

                        const company =
                          contact.companyId
                            ? companyNames.get(
                                contact.companyId,
                              ) ?? ""
                            : "";

                        return [
                          contact.name,
                          company,
                          contact.email,
                        ].some((value) =>
                          value
                            .toLowerCase()
                            .includes(query),
                        );
                      })
                      .map((contact) => {
                        const company =
                          contact.companyId
                            ? companyNames.get(
                                contact.companyId,
                              )
                            : undefined;

                        return (
                          <button
                            key={contact.id}
                            type="button"
                            className="sp-create-gallery-recipient-result"
                            onClick={() => {
                              setSelectedRecipientIds(
                                (current) => [
                                  ...current,
                                  contact.id,
                                ],
                              );
                              setRecipientQuery("");
                            }}
                          >
                            <strong>
                              {contact.name}
                            </strong>

                            {company ? (
                              <span>
                                {company}
                              </span>
                            ) : null}

                            <span>
                              {contact.email}
                            </span>

                            <span aria-hidden="true">
                              +
                            </span>
                          </button>
                        );
                      })}

                    {canAddOneOffRecipient ? (
                      <button
                        type="button"
                        className="sp-create-gallery-recipient-result"
                        onClick={() => {
                          setOneOffRecipientEmails(
                            (current) => [
                              ...current,
                              cleanRecipientQuery,
                            ],
                          );
                          setRecipientQuery("");
                        }}
                      >
                        <strong>
                          Add {cleanRecipientQuery}
                        </strong>

                        <span>
                          One-off recipient
                        </span>

                        <span aria-hidden="true">
                          +
                        </span>
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {selectedRecipientIds.map(
                  (contactId) => (
                    <input
                      key={contactId}
                      type="hidden"
                      name="recipientContactId"
                      value={contactId}
                    />
                  ),
                )}

                {oneOffRecipientEmails.map(
                  (email) => (
                    <input
                      key={email}
                      type="hidden"
                      name="recipientEmail"
                      value={email}
                    />
                  ),
                )}
              </div>

              <div className="sp-create-gallery-field">
                <label htmlFor="modal-client">
                  Client
                </label>

                <input
                  id="modal-client"
                  name="clientName"
                  type="text"
                />
              </div>

              <p className="sp-create-gallery-note">
                Gallery URL, presentation,
                watermark and delivery settings
                can be adjusted after creation.
              </p>

              <div className="sp-create-gallery-actions">
                <button
                  type="button"
                  className="sp-create-gallery-cancel"
                  onClick={() =>
                    setOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="sp-create-gallery-submit"
                >
                  Create Gallery
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
