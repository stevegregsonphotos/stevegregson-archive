import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

const projectRoot = process.cwd();
const imagesRoot = path.join(
  projectRoot,
  "public",
  "images",
  "productions",
);
const contentRoot = path.join(
  projectRoot,
  "content",
  "productions",
);

const supportedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const galleryLayouts = [
  "wide",
  "left",
  "right",
  "medium",
  "full",
  "left-small",
  "right-small",
  "wide-left",
  "wide-right",
];

function createSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeText(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"');
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function askRequired(terminal, question) {
  while (true) {
    const answer = (await terminal.question(question)).trim();

    if (answer) {
      return answer;
    }

    console.log("Please enter a value.");
  }
}

async function askOptional(terminal, question) {
  return (await terminal.question(question)).trim();
}

function createCredit(role, name) {
  if (!name) {
    return null;
  }

  return {
    role,
    name,
  };
}

function formatCredits(credits) {
  return credits
    .filter(Boolean)
    .map(
      ({ role, name }) => `    {
      role: "${escapeText(role)}",
      name: "${escapeText(name)}",
    },`,
    )
    .join("\n");
}

function formatImages(images, title) {
  return images
    .map((filename, index) => {
      const layout =
        galleryLayouts[index % galleryLayouts.length];

      return `    {
      src: "${escapeText(filename)}",
      alt: "${escapeText(title)} production photograph",
      layout: "${layout}",
    },`;
    })
    .join("\n");
}

async function main() {
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("\nSteve Gregson Archive — New Production\n");

    const title = await askRequired(
      terminal,
      "Production title: ",
    );

    const suggestedSlug = createSlug(title);

    const slugAnswer = await askOptional(
      terminal,
      `Folder slug [${suggestedSlug}]: `,
    );

    const slug = createSlug(slugAnswer || suggestedSlug);

    const imageDirectory = path.join(imagesRoot, slug);

    if (!(await pathExists(imageDirectory))) {
      throw new Error(
        [
          `The image folder does not exist:`,
          imageDirectory,
          "",
          `Create this folder first:`,
          `public/images/productions/${slug}/`,
        ].join("\n"),
      );
    }

    const venue = await askRequired(
      terminal,
      "Venue or theatre: ",
    );

    const yearText = await askRequired(
      terminal,
      "Year: ",
    );

    const year = Number.parseInt(yearText, 10);

    if (!Number.isInteger(year)) {
      throw new Error("The year must be a number.");
    }

    const description =
      (await askOptional(
        terminal,
        "Description [dress rehearsal publicity photography]: ",
      )) ||
      "Dress rehearsal photography created for the production’s publicity campaign.";

    const director = await askOptional(
      terminal,
      "Director (optional): ",
    );

    const musicalDirector = await askOptional(
      terminal,
      "Musical director (optional): ",
    );

    const choreographer = await askOptional(
      terminal,
      "Choreographer (optional): ",
    );

    const lightingDesigner = await askOptional(
      terminal,
      "Lighting designer (optional): ",
    );

    const setCostumeDesigner = await askOptional(
      terminal,
      "Set and costume designer (optional): ",
    );

    const soundDesigner = await askOptional(
      terminal,
      "Sound designer (optional): ",
    );

    const commissionedBy = await askOptional(
      terminal,
      "Commissioned by (optional): ",
    );

    const directoryEntries = await readdir(imageDirectory, {
      withFileTypes: true,
    });

    const imageFiles = directoryEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((filename) =>
        supportedExtensions.has(
          path.extname(filename).toLowerCase(),
        ),
      )
      .sort((a, b) =>
        a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

    if (imageFiles.length === 0) {
      throw new Error(
        `No supported image files were found in public/images/productions/${slug}/`,
      );
    }

    console.log("\nAvailable images:\n");

    imageFiles.forEach((filename, index) => {
      console.log(
        `${String(index + 1).padStart(2, "0")}. ${filename}`,
      );
    });

    const heroNumberText = await askRequired(
      terminal,
      "\nHero image number: ",
    );

    const heroIndex =
      Number.parseInt(heroNumberText, 10) - 1;

    if (
      !Number.isInteger(heroIndex) ||
      heroIndex < 0 ||
      heroIndex >= imageFiles.length
    ) {
      throw new Error("That hero image number is invalid.");
    }

    const hero = imageFiles[heroIndex];

    const galleryImages = imageFiles.filter(
      (_, index) => index !== heroIndex,
    );

    const credits = [
      createCredit("Venue", venue),
      createCredit("Director", director),
      createCredit(
        "Musical Director",
        musicalDirector,
      ),
      createCredit("Choreographer", choreographer),
      createCredit(
        "Lighting Design",
        lightingDesigner,
      ),
      createCredit(
        "Set & Costume Design",
        setCostumeDesigner,
      ),
      createCredit("Sound Design", soundDesigner),
      createCredit(
        "Commissioned by",
        commissionedBy,
      ),
      createCredit("Photography", "Steve Gregson"),
    ];

    const variableName = slug
      .split("-")
      .map((part, index) => {
        if (index === 0) {
          return part;
        }

        return (
          part.charAt(0).toUpperCase() +
          part.slice(1)
        );
      })
      .join("");

    const fileContents = `import type { Production } from "./types";

export const ${variableName}: Production = {
  slug: "${escapeText(slug)}",
  title: "${escapeText(title)}",
  venue: "${escapeText(venue)}",
  year: ${year},

  description:
    "${escapeText(description)}",

  hero: "${escapeText(hero)}",

  heroAlt:
    "${escapeText(
      `${title} at ${venue}, photographed by Steve Gregson`,
    )}",

  credits: [
${formatCredits(credits)}
  ],

  images: [
${formatImages(galleryImages, title)}
  ],
};
`;

    await mkdir(contentRoot, {
      recursive: true,
    });

    const outputPath = path.join(
      contentRoot,
      `${slug}.ts`,
    );

    if (await pathExists(outputPath)) {
      const overwrite = (
        await terminal.question(
          `\n${slug}.ts already exists. Replace it? (yes/no): `,
        )
      )
        .trim()
        .toLowerCase();

      if (overwrite !== "yes") {
        console.log("\nNo file was changed.");
        return;
      }
    }

    await writeFile(outputPath, fileContents, "utf8");

    console.log("\nProduction file created successfully:");
    console.log(
      `content/productions/${slug}.ts`,
    );
    console.log(
      `\n${galleryImages.length + 1} photographs found.`,
    );
    console.log(
      "The generated layouts are a starting point and can be curated manually.",
    );
    console.log(
      "\nThe live website has not been changed.",
    );
  } finally {
    terminal.close();
  }
}

main().catch((error) => {
  console.error("\nProduction generator failed:\n");
  console.error(error.message);
  process.exitCode = 1;
});