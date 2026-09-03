import type { Metadata } from "next";
import { revalidatePath } from "next/cache";

import {
  createProofingCompany,
  createProofingContact,
  deleteProofingContact,
  updateProofingContact,
  getProofingCompanies,
  getProofingContacts,
} from "../../../lib/proofing/contacts-repository";

import ClientsAddressBook from "./ClientsAddressBook";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients | Backstage",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ClientsPage() {
  async function createContact(
    formData: FormData,
  ) {
    "use server";

    const name = String(
      formData.get("name") ?? "",
    ).trim();

    const companyName = String(
      formData.get("company") ?? "",
    ).trim();

    const email = String(
      formData.get("email") ?? "",
    )
      .trim()
      .toLowerCase();

    if (!name || !email) {
      return;
    }

    let companyId: string | undefined;

    if (companyName) {
      const company =
        createProofingCompany(companyName);

      companyId = company.id;
    }

    createProofingContact({
      name,
      email,
      companyId,
    });

    revalidatePath("/admin/clients");
  }

  async function updateContact(
    formData: FormData,
  ) {
    "use server";

    const id = String(
      formData.get("id") ?? "",
    ).trim();

    const name = String(
      formData.get("name") ?? "",
    ).trim();

    const companyName = String(
      formData.get("company") ?? "",
    ).trim();

    const email = String(
      formData.get("email") ?? "",
    )
      .trim()
      .toLowerCase();

    if (!id || !name || !email) {
      return;
    }

    let companyId: string | undefined;

    if (companyName) {
      const company =
        createProofingCompany(companyName);

      companyId = company.id;
    }

    updateProofingContact(
      id,
      {
        name,
        email,
        companyId,
      },
    );

    revalidatePath("/admin/clients");
  }

  async function deleteContact(
    formData: FormData,
  ) {
    "use server";

    const id = String(
      formData.get("id") ?? "",
    ).trim();

    if (!id) {
      return;
    }

    deleteProofingContact(id);

    revalidatePath("/admin/clients");
  }

  const contacts = getProofingContacts();
  const companies = getProofingCompanies();

  return (
    <main className="clients-page">
      <div className="clients-shell">
        <ClientsAddressBook
          contacts={contacts}
          companies={companies}
          createContact={createContact}
          updateContact={updateContact}
          deleteContact={deleteContact}
        />
      </div>

      <style>{`
        .clients-page {
          min-height: calc(100vh - 6.5rem);
          background: #11100f;
          color: #f2eee6;
        }

        .clients-shell {
          width: min(1180px, 92vw);
          margin: 0 auto;
          padding:
            clamp(3rem, 6vw, 5.5rem)
            0
            6rem;
        }

        .clients-header {
          display: flex;
          justify-content: space-between;
          gap: 3rem;
          align-items: flex-end;
          padding-bottom: 2.5rem;
          border-bottom:
            1px solid rgba(
              242,
              238,
              230,
              0.14
            );
        }

        .clients-eyebrow,
        .clients-empty-kicker {
          margin: 0 0 0.8rem;
          color: #c7a369;
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .clients-header h1 {
          margin: 0;
          font-size:
            clamp(2.8rem, 5vw, 4.8rem);
          font-weight: 400;
          letter-spacing: -0.04em;
          line-height: 0.95;
        }

        .clients-intro {
          max-width: 34rem;
          margin: 1.2rem 0 0;
          color:
            rgba(242, 238, 230, 0.58);
          font-size: 0.9rem;
          line-height: 1.65;
        }

        .clients-add-button {
          flex: 0 0 auto;
          border: 1px solid #c7a369;
          padding: 0.9rem 1.25rem;
          cursor: pointer;
          background: #c7a369;
          color: #11100f;
          font: inherit;
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          transition:
            background 160ms ease,
            color 160ms ease;
        }

        .clients-add-button:hover {
          background: transparent;
          color: #c7a369;
        }

        .clients-toolbar {
          display: flex;
          justify-content: space-between;
          gap: 2rem;
          align-items: center;
          padding: 1.5rem 0;
          border-bottom:
            1px solid rgba(
              242,
              238,
              230,
              0.1
            );
        }

        .clients-search {
          display: flex;
          width: min(31rem, 100%);
          align-items: center;
          gap: 0.7rem;
          border:
            1px solid rgba(
              242,
              238,
              230,
              0.16
            );
          padding: 0 1rem;
          background:
            rgba(255, 255, 255, 0.025);
        }

        .clients-search-icon {
          color:
            rgba(242, 238, 230, 0.45);
          font-size: 1rem;
        }

        .clients-search input {
          width: 100%;
          border: 0;
          outline: 0;
          padding: 0.85rem 0;
          background: transparent;
          color: #f2eee6;
          font: inherit;
          font-size: 0.76rem;
        }

        .clients-search input::placeholder {
          color:
            rgba(242, 238, 230, 0.34);
        }

        .clients-count {
          margin: 0;
          color:
            rgba(242, 238, 230, 0.42);
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .clients-list {
          margin-top: 1.5rem;
          border-top:
            1px solid rgba(
              242,
              238,
              230,
              0.14
            );
        }

        .clients-list-heading,
        .clients-row {
          display: grid;
          grid-template-columns:
            minmax(10rem, 1.2fr)
            minmax(10rem, 1fr)
            minmax(14rem, 1.5fr)
            4rem;
          gap: 1.5rem;
          align-items: center;
        }

        .clients-list-heading {
          padding: 0.85rem 1rem;
          color:
            rgba(242, 238, 230, 0.35);
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .clients-row {
          min-height: 4.8rem;
          border-top:
            1px solid rgba(
              242,
              238,
              230,
              0.09
            );
          padding: 0 1rem;
          font-size: 0.78rem;
        }

        .clients-row strong {
          font-weight: 600;
        }

        .clients-row > span,
        .clients-row > a {
          color:
            rgba(242, 238, 230, 0.58);
        }

        .clients-row > a:hover,
        .clients-row button:hover {
          color: #c7a369;
        }

        .clients-row button {
          border: 0;
          padding: 0;
          cursor: pointer;
          background: transparent;
          color:
            rgba(242, 238, 230, 0.42);
          font: inherit;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .clients-empty {
          max-width: 38rem;
          padding:
            clamp(4rem, 9vw, 8rem)
            0;
        }

        .clients-empty h2 {
          margin: 0;
          font-size:
            clamp(2rem, 4vw, 3.5rem);
          font-weight: 400;
          letter-spacing: -0.035em;
        }

        .clients-empty > p:not(
          .clients-empty-kicker
        ) {
          max-width: 31rem;
          margin: 1.2rem 0 2rem;
          color:
            rgba(242, 238, 230, 0.55);
          font-size: 0.86rem;
          line-height: 1.7;
        }

        @media (max-width: 800px) {
          .clients-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 2rem;
          }

          .clients-toolbar {
            align-items: flex-start;
            flex-direction: column;
            gap: 1rem;
          }

          .clients-list-heading {
            display: none;
          }

          .clients-row {
            grid-template-columns:
              1fr auto;
            gap: 0.45rem 1rem;
            padding: 1.25rem 0;
          }

          .clients-row strong,
          .clients-row > span,
          .clients-row > a {
            grid-column: 1;
          }

          .clients-row button {
            grid-column: 2;
            grid-row: 1;
          }
        }
      `}</style>
    </main>
  );
}
