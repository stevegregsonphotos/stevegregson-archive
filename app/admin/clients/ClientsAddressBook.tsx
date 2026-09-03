"use client";

import {
  useMemo,
  useState,
} from "react";

type Company = {
  id: string;
  name: string;
};

type Contact = {
  id: string;
  name: string;
  email: string;
  companyId?: string;
};

type ClientsAddressBookProps = {
  contacts: Contact[];
  companies: Company[];
  createContact: (
    formData: FormData,
  ) => Promise<void>;
  updateContact: (
    formData: FormData,
  ) => Promise<void>;
  deleteContact: (
    formData: FormData,
  ) => Promise<void>;
};

export default function ClientsAddressBook({
  contacts,
  companies,
  createContact,
  updateContact,
  deleteContact,
}: ClientsAddressBookProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingContact, setEditingContact] =
    useState<Contact | null>(null);

  const companyNames = useMemo(
    () =>
      new Map(
        companies.map((company) => [
          company.id,
          company.name,
        ]),
      ),
    [companies],
  );

  const filteredContacts = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const company = contact.companyId
        ? companyNames.get(contact.companyId) ?? ""
        : "";

      return [
        contact.name,
        contact.email,
        company,
      ].some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [
    contacts,
    search,
    companyNames,
  ]);

  return (
    <>
      <header className="clients-header">
        <div>
          <p className="clients-eyebrow">
            Private address book
          </p>

          <h1>Clients</h1>

          <p className="clients-intro">
            Keep the people and companies you
            regularly send galleries to in one
            place.
          </p>
        </div>

        <button
          type="button"
          className="clients-add-button"
          onClick={() => {
            setEditingContact(null);
            setIsOpen(true);
          }}
        >
          Add contact
        </button>
      </header>

      <section
        className="clients-toolbar"
        aria-label="Client address book tools"
      >
        <label className="clients-search">
          <span className="clients-search-icon">
            ⌕
          </span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search name, company or email"
            aria-label="Search clients"
          />
        </label>

        <p className="clients-count">
          {search
            ? `${filteredContacts.length} of `
            : ""}
          {contacts.length}{" "}
          {contacts.length === 1
            ? "contact"
            : "contacts"}
        </p>
      </section>

      {contacts.length === 0 ? (
        <section className="clients-empty">
          <p className="clients-empty-kicker">
            Address book
          </p>

          <h2>No contacts yet</h2>

          <p>
            Add the people you regularly send
            proofing galleries to. You will still
            be able to use one-off email addresses
            without saving them here.
          </p>

          <button
            type="button"
            className="clients-add-button"
            onClick={() => {
            setEditingContact(null);
            setIsOpen(true);
          }}
          >
            Add your first contact
          </button>
        </section>
      ) : filteredContacts.length === 0 ? (
        <section className="clients-empty">
          <p className="clients-empty-kicker">
            Search
          </p>

          <h2>No matching contacts</h2>

          <p>
            Try searching for a different name,
            company or email address.
          </p>
        </section>
      ) : (
        <section className="clients-list">
          <div
            className="clients-list-heading"
            aria-hidden="true"
          >
            <span>Name</span>
            <span>Company</span>
            <span>Email</span>
            <span />
          </div>

          {filteredContacts.map((contact) => (
            <article
              className="clients-row"
              key={contact.id}
            >
              <strong>{contact.name}</strong>

              <span>
                {contact.companyId
                  ? companyNames.get(
                      contact.companyId,
                    ) ?? "—"
                  : "—"}
              </span>

              <a
                href={`mailto:${contact.email}`}
              >
                {contact.email}
              </a>

              <button
                type="button"
                onClick={() => {
                  setEditingContact(contact);
                  setIsOpen(true);
                }}
              >
                Edit
              </button>
            </article>
          ))}
        </section>
      )}

      {isOpen ? (
        <div
          className="clients-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setIsOpen(false);
            }
          }}
        >
          <section
            className="clients-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-contact-title"
          >
            <div className="clients-modal-header">
              <div>
                <p className="clients-eyebrow">
                  Address book
                </p>

                <h2 id="add-contact-title">
                  {editingContact
                    ? "Edit contact"
                    : "Add contact"}
                </h2>
              </div>

              <button
                type="button"
                className="clients-modal-close"
                aria-label="Close"
                onClick={() =>
                  setIsOpen(false)
                }
              >
                ×
              </button>
            </div>

            <form
              action={
                editingContact
                  ? updateContact
                  : createContact
              }
              className="clients-contact-form"
              onSubmit={() => setIsOpen(false)}
            >
              {editingContact ? (
                <input
                  type="hidden"
                  name="id"
                  value={editingContact.id}
                />
              ) : null}
              <label>
                <span>Name</span>

                <input
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  defaultValue={
                    editingContact?.name ?? ""
                  }
                />
              </label>

              <label>
                <span>Company</span>

                <input
                  name="company"
                  type="text"
                  list="client-company-options"
                  autoComplete="organization"
                  placeholder="Optional"
                  defaultValue={
                    editingContact?.companyId
                      ? companyNames.get(
                          editingContact.companyId,
                        ) ?? ""
                      : ""
                  }
                />

                <datalist id="client-company-options">
                  {companies.map((company) => (
                    <option
                      value={company.name}
                      key={company.id}
                    />
                  ))}
                </datalist>
              </label>

              <label>
                <span>Email</span>

                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={
                    editingContact?.email ?? ""
                  }
                />
              </label>

              <div className="clients-modal-actions">
                {editingContact ? (
                  <button
                    type="submit"
                    formAction={deleteContact}
                    formNoValidate
                    className="clients-delete-button"
                    onClick={(event) => {
                      if (
                        !window.confirm(
                          `Delete ${editingContact.name} from your address book?`,
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Delete contact
                  </button>
                ) : null}

                <button
                  type="button"
                  className="clients-cancel-button"
                  onClick={() =>
                    setIsOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="clients-add-button"
                >
                  {editingContact
                    ? "Save changes"
                    : "Add contact"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <style>{`
        .clients-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 500;
          display: grid;
          place-items: center;
          padding: 2rem;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(8px);
        }

        .clients-modal {
          width: min(34rem, 100%);
          border:
            1px solid rgba(242, 238, 230, 0.16);
          padding: clamp(1.6rem, 4vw, 2.5rem);
          background: #171614;
          box-shadow:
            0 2rem 6rem rgba(0, 0, 0, 0.45);
        }

        .clients-modal-header {
          display: flex;
          justify-content: space-between;
          gap: 2rem;
          align-items: flex-start;
          padding-bottom: 1.5rem;
          border-bottom:
            1px solid rgba(242, 238, 230, 0.12);
        }

        .clients-modal-header h2 {
          margin: 0;
          color: #f2eee6;
          font-size: 2rem;
          font-weight: 400;
          letter-spacing: -0.03em;
        }

        .clients-modal-close {
          border: 0;
          padding: 0;
          cursor: pointer;
          background: transparent;
          color: rgba(242, 238, 230, 0.5);
          font: inherit;
          font-size: 1.8rem;
          line-height: 1;
        }

        .clients-modal-close:hover {
          color: #c7a369;
        }

        .clients-contact-form {
          display: grid;
          gap: 1.25rem;
          padding-top: 1.75rem;
        }

        .clients-contact-form label {
          display: grid;
          gap: 0.55rem;
        }

        .clients-contact-form label > span {
          color: rgba(242, 238, 230, 0.52);
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .clients-contact-form input {
          width: 100%;
          box-sizing: border-box;
          border:
            1px solid rgba(242, 238, 230, 0.16);
          outline: 0;
          padding: 0.9rem 1rem;
          background: #11100f;
          color: #f2eee6;
          font: inherit;
          font-size: 0.82rem;
        }

        .clients-contact-form input:focus {
          border-color: #c7a369;
        }

        .clients-contact-form input::placeholder {
          color: rgba(242, 238, 230, 0.28);
        }

        .clients-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          align-items: center;
          padding-top: 0.75rem;
        }

        .clients-cancel-button {
          border: 0;
          padding: 0.9rem 0.5rem;
          cursor: pointer;
          background: transparent;
          color: rgba(242, 238, 230, 0.5);
          font: inherit;
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .clients-cancel-button:hover {
          color: #f2eee6;
        }

        @media (max-width: 600px) {
          .clients-modal-backdrop {
            align-items: end;
            padding: 0;
          }

          .clients-modal {
            width: 100%;
            box-sizing: border-box;
            border-right: 0;
            border-bottom: 0;
            border-left: 0;
          }
        }

        .clients-delete-button {
          min-height: 42px;
          padding: 0.75rem 1.15rem;
          border: 1px solid rgba(199, 163, 105, 0.55);
          background: transparent;
          color: #c7a369;
          font: inherit;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition:
            background 160ms ease,
            border-color 160ms ease,
            color 160ms ease;
        }

        .clients-delete-button:hover {
          border-color: #c7a369;
          background: rgba(199, 163, 105, 0.1);
          color: #e0c28f;
        }

`}</style>
    </>
  );
}
