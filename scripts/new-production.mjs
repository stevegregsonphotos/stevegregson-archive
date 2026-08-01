import {
  access,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
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

const productionsRoot = path.join(
  projectRoot,
  "content",
  "productions",
);

const indexPath = path.join(productionsRoot, "index.ts");

const supportedImageExtensions = new Set([
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

function createVariableName(slug) {
  return slug
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
    const answer = (
      await terminal.question(question)
    ).trim();

    if (answer) {
      return answer;
    }

    console.log("Please enter a value.");
  }
}

async function askOptional(terminal, question) {
  return (
    await terminal.question(question)
  ).trim();
}

async function askYesNo(
  terminal,
  question,
  defaultAnswer = false,
) {
  const hint = defaultAnswer ? "[Y/n]" : "[y/N]";

  const answer = (
    await terminal.question(`${question} ${hint}: `)
  )
    .trim()
    .toLowerCase();

  if (!answer) {
    return defaultAnswer;
  }

  return answer === "y" || answer === "yes";
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
      alt: "${escapeText(
        `${title} production photograph`,
      )}",
      layout: "${layout}",
    },`;
    })
    .join("\n");
}

async function getImageFiles(imageDirectory) {
  const entries = await readdir(imageDirectory, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) =>
      supportedImageExtensions.has(
        path.extname(filename).toLowerCase(),
      ),
    )
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

async function updateProductionIndex({
  slug,
  variableName,
}) {
  const importLine =
    `import { ${variableName} } from "./${slug}";`;

  let indexContents = await readFile(
    indexPath,
    "utf8",
  );

  if (
    indexContents.includes(`from "./${slug}"`) ||
    indexContents.includes(`${variableName},`)
  ) {
    throw new Error(
      `${slug} already appears in content/productions/index.ts`,
    );
  }

  const productionsArrayPattern =
    /export const productions: Production\[\] = \[\n/;

  if (!productionsArrayPattern.test(indexContents)) {
    throw new Error(
      "Could not find the productions array in content/productions/index.ts",
    );
  }

  indexContents = indexContents.replace(
    "export const productions",
    `${importLine}\n\nexport const productions`,
  );

  indexContents = indexContents.replace(
    productionsArrayPattern,
    `export const productions: Production[] = [\n  ${variableName},\n`,
  );

  await writeFile(indexPath, indexContents, "utf8");
}

async function main() {
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(
      "\nSteve Gregson Archive — New Production\n",
    );

    const title = await askRequired(
      terminal,
      "Production title: ",
    );

    const suggestedSlug = createSlug(title);

    const slugAnswer = await askOptional(
      terminal,
      `Folder slug [${suggestedSlug}]: `,
    );

    const slug = createSlug(
      slugAnswer || suggestedSlug,
    );

    const variableName = createVariableName(slug);

    const imageDirectory = path.join(
      imagesRoot,
      slug,
    );

    const productionFilePath = path.join(
      productionsRoot,
      `${slug}.ts`,
    );

    if (!(await pathExists(imageDirectory))) {
      throw new Error(
        [
          "The image folder does not exist:",
          imageDirectory,
          "",
          "Create this folder first:",
          `public/images/productions/${slug}/`,
        ].join("\n"),
      );
    }

    if (await pathExists(productionFilePath)) {
      throw new Error(
        `content/productions/${slug}.ts already exists.`,
      );
    }

    const imageFiles =
      await getImageFiles(imageDirectory);

    if (imageFiles.length === 0) {
      throw new Error(
        `No supported images were found in public/images/productions/${slug}/`,
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
      throw new Error(
        "The year must be a whole number.",
      );
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

    const associateDirector = await askOptional(
      terminal,
      "Associate director (optional): ",
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

    const setDesigner = await askOptional(
      terminal,
      "Set designer (optional): ",
    );

    const costumeDesigner = await askOptional(
      terminal,
      "Costume designer (optional): ",
    );

    const setCostumeDesigner = await askOptional(
      terminal,
      "Combined set and costume designer (optional): ",
    );

    const soundDesigner = await askOptional(
      terminal,
      "Sound designer (optional): ",
    );

    const commissionedBy = await askOptional(
      terminal,
      "Commissioned by (optional): ",
    );

    const additionalCredits = [];

    while (
      await askYesNo(
        terminal,
        "Add another creative credit?",
      )
    ) {
      const role = await askRequired(
        terminal,
        "Credit role: ",
      );

      const name = await askRequired(
        terminal,
        "Credit name: ",
      );

      additionalCredits.push({
        role,
        name,
      });
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
      throw new Error(
        "That hero image number is invalid.",
      );
    }

    const hero = imageFiles[heroIndex];

    const galleryImages = imageFiles.filter(
      (_, index) => index !== heroIndex,
    );

    const credits = [
      createCredit("Venue", venue),
      createCredit("Director", director),
      createCredit(
        "Associate Director",
        associateDirector,
      ),
      createCredit(
        "Musical Director",
        musicalDirector,
      ),
      createCredit(
        "Choreographer",
        choreographer,
      ),
      createCredit(
        "Lighting Design",
        lightingDesigner,
      ),
      createCredit(
        "Set & Costume Design",
        setCostumeDesigner,
      ),
      createCredit("Set Design", setDesigner),
      createCredit(
        "Costume Design",
        costumeDesigner,
      ),
      createCredit(
        "Sound Design",
        soundDesigner,
      ),
      ...additionalCredits,
      createCredit(
        "Commissioned by",
        commissionedBy,
      ),
      createCredit(
        "Photography",
        "Steve Gregson",
      ),
    ];

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

    await mkdir(productionsRoot, {
      recursive: true,
    });

    await writeFile(
      productionFilePath,
      fileContents,
      "utf8",
    );

    try {
      await updateProductionIndex({
        slug,
        variableName,
      });
    } catch (error) {
      console.error(
        "\nThe production file was created, but index.ts was not updated.",
      );
      console.error(error.message);
      console.error(
        `\nCreated file: content/productions/${slug}.ts`,
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      "\nProduction created successfully.\n",
    );

    console.log(
      `Production file: content/productions/${slug}.ts`,
    );

    console.log(
      `Image folder: public/images/productions/${slug}/`,
    );

    console.log(
      `Page URL: /productions/${slug}`,
    );

    console.log(
      `Photographs: ${galleryImages.length + 1}`,
    );

    console.log(
      "\nThe production was added to content/productions/index.ts automatically.",
    );

    console.log(
      "The generated image order and layouts are a starting point and can be curated in the production file.",
    );
  } finally {
    terminal.close();
  }
}

main().catch((error) => {
  console.error(
    "\nProduction generator failed:\n",
  );

  console.error(error.message);
  process.exitCode = 1;
});