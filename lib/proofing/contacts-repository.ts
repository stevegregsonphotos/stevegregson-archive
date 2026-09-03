import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ProofingCompany,
  ProofingContact,
} from "./types";

const addressBookDirectory = path.join(
  process.cwd(),
  "data",
  "proofing-address-book",
);

const companiesFile = path.join(
  addressBookDirectory,
  "companies.json",
);

const contactsFile = path.join(
  addressBookDirectory,
  "contacts.json",
);

function ensureAddressBook() {
  if (!fs.existsSync(addressBookDirectory)) {
    fs.mkdirSync(addressBookDirectory, {
      recursive: true,
    });
  }

  if (!fs.existsSync(companiesFile)) {
    fs.writeFileSync(
      companiesFile,
      "[]\n",
      "utf8",
    );
  }

  if (!fs.existsSync(contactsFile)) {
    fs.writeFileSync(
      contactsFile,
      "[]\n",
      "utf8",
    );
  }
}

function readCompanies(): ProofingCompany[] {
  ensureAddressBook();

  const contents = fs.readFileSync(
    companiesFile,
    "utf8",
  );

  const parsed = JSON.parse(contents);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Proofing companies data is invalid.",
    );
  }

  return parsed as ProofingCompany[];
}

function readContacts(): ProofingContact[] {
  ensureAddressBook();

  const contents = fs.readFileSync(
    contactsFile,
    "utf8",
  );

  const parsed = JSON.parse(contents);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Proofing contacts data is invalid.",
    );
  }

  return parsed as ProofingContact[];
}

function writeCompanies(
  companies: ProofingCompany[],
) {
  ensureAddressBook();

  fs.writeFileSync(
    companiesFile,
    `${JSON.stringify(companies, null, 2)}\n`,
    "utf8",
  );
}

function writeContacts(
  contacts: ProofingContact[],
) {
  ensureAddressBook();

  fs.writeFileSync(
    contactsFile,
    `${JSON.stringify(contacts, null, 2)}\n`,
    "utf8",
  );
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getProofingCompanies() {
  return readCompanies().sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function getProofingContacts() {
  return readContacts().sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function getProofingContact(
  id: string,
) {
  return readContacts().find(
    (contact) => contact.id === id,
  );
}

export function createProofingCompany(
  name: string,
): ProofingCompany {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Company name is required.");
  }

  const companies = readCompanies();

  const existing = companies.find(
    (company) =>
      company.name.toLowerCase() ===
      cleanName.toLowerCase(),
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();

  const company: ProofingCompany = {
    id: randomUUID(),
    name: cleanName,
    createdAt: now,
    updatedAt: now,
  };

  writeCompanies([
    ...companies,
    company,
  ]);

  return company;
}


export function updateProofingContact(
  id: string,
  input: {
    name: string;
    email: string;
    companyId?: string;
  },
): ProofingContact {
  const name = input.name.trim();
  const email = normaliseEmail(input.email);
  const companyId =
    input.companyId?.trim() || undefined;

  if (!name) {
    throw new Error("Contact name is required.");
  }

  if (!email) {
    throw new Error("Contact email is required.");
  }

  const contacts = readContacts();

  const existingIndex = contacts.findIndex(
    (contact) => contact.id === id,
  );

  if (existingIndex === -1) {
    throw new Error("Contact could not be found.");
  }

  const duplicateEmail = contacts.some(
    (contact) =>
      contact.id !== id &&
      contact.email === email,
  );

  if (duplicateEmail) {
    throw new Error(
      "A contact with this email already exists.",
    );
  }

  if (companyId) {
    const companyExists =
      readCompanies().some(
        (company) =>
          company.id === companyId,
      );

    if (!companyExists) {
      throw new Error(
        "Selected company could not be found.",
      );
    }
  }

  const existing = contacts[existingIndex];

  const updated: ProofingContact = {
    ...existing,
    name,
    email,
    companyId,
    updatedAt: new Date().toISOString(),
  };

  const nextContacts = [...contacts];
  nextContacts[existingIndex] = updated;

  writeContacts(nextContacts);

  return updated;
}

export function deleteProofingContact(
  id: string,
) {
  const contacts = readContacts();

  const exists = contacts.some(
    (contact) => contact.id === id,
  );

  if (!exists) {
    throw new Error("Contact could not be found.");
  }

  writeContacts(
    contacts.filter(
      (contact) => contact.id !== id,
    ),
  );
}

export function createProofingContact(input: {
  name: string;
  email: string;
  companyId?: string;
}): ProofingContact {
  const name = input.name.trim();
  const email = normaliseEmail(input.email);
  const companyId =
    input.companyId?.trim() || undefined;

  if (!name) {
    throw new Error("Contact name is required.");
  }

  if (!email) {
    throw new Error("Contact email is required.");
  }

  const contacts = readContacts();

  const existing = contacts.find(
    (contact) => contact.email === email,
  );

  if (existing) {
    throw new Error(
      "A contact with this email already exists.",
    );
  }

  if (companyId) {
    const companyExists =
      readCompanies().some(
        (company) =>
          company.id === companyId,
      );

    if (!companyExists) {
      throw new Error(
        "Selected company could not be found.",
      );
    }
  }

  const now = new Date().toISOString();

  const contact: ProofingContact = {
    id: randomUUID(),
    name,
    email,
    companyId,
    createdAt: now,
    updatedAt: now,
  };

  writeContacts([
    ...contacts,
    contact,
  ]);

  return contact;
}
