import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type ProofingIntroTemplate = {
  id: string;
  name: string;
  message: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const proofingDirectory = path.join(
  process.cwd(),
  "data",
  "proofing-settings",
);

const templateFile = path.join(
  proofingDirectory,
  "intro-templates.json",
);

const initialTemplates: Array<{
  name: string;
  message: string;
  isDefault: boolean;
}> = [
  {
    name: "Standard proofing",
    message:
      "Welcome to your private proofing gallery. Please take a look through the photographs and select your favourites. When you are happy with your selection, submit it and I’ll take it from there.",
    isDefault: true,
  },
  {
    name: "Rehearsal selection",
    message:
      "Welcome to your rehearsal proofing gallery. Please look through the photographs and select the images you would like me to work from. Once you have finished, submit your selection and I’ll begin the final edits.",
    isDefault: false,
  },
  {
    name: "Production selection",
    message:
      "Welcome to your production proofing gallery. Please review the photographs and favourite the images you would like to select. When your selection is complete, submit it to let me know you are finished.",
    isDefault: false,
  },
  {
    name: "Shortlist / final choices",
    message:
      "Here is your private gallery of shortlisted photographs. Please mark your final choices as favourites and submit the selection when you are happy with it.",
    isDefault: false,
  },
];

function ensureTemplateStorage() {
  fs.mkdirSync(proofingDirectory, {
    recursive: true,
  });

  if (!fs.existsSync(templateFile)) {
    const now = new Date().toISOString();

    const templates: ProofingIntroTemplate[] =
      initialTemplates.map((template) => ({
        id: randomUUID(),
        name: template.name,
        message: template.message,
        isDefault: template.isDefault,
        createdAt: now,
        updatedAt: now,
      }));

    fs.writeFileSync(
      templateFile,
      JSON.stringify(templates, null, 2),
    );
  }
}

export function getProofingIntroTemplates():
  ProofingIntroTemplate[] {
  ensureTemplateStorage();

  try {
    const raw = fs.readFileSync(
      templateFile,
      "utf8",
    );

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? (parsed as ProofingIntroTemplate[])
      : [];
  } catch {
    return [];
  }
}

export function saveProofingIntroTemplates(
  templates: ProofingIntroTemplate[],
) {
  ensureTemplateStorage();

  fs.writeFileSync(
    templateFile,
    JSON.stringify(templates, null, 2),
  );
}

export function getDefaultProofingIntroTemplate() {
  return getProofingIntroTemplates().find(
    (template) => template.isDefault,
  );
}
