"use client";

import {
  useMemo,
  useState,
} from "react";

type LocalImage = {
  id: string;
  file: File;
  filepath: string;
  previewUrl: string;
  included: boolean;
};

type PublishedAsset = {
  sourceFilepath: string;
  filename: string;
  blurDataURL: string;
};

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

const IMAGE_EXTENSIONS =
  /\.(jpe?g|png|webp)$/i;

const DETAIL_LABELS: Record<
  string,
  | "title"
  | "venue"
  | "year"
  | "director"
  | "writer"
  | "cast"
  | "associateDirector"
  | "musicalDirector"
  | "choreographer"
  | "movementDirector"
  | "lightingDesign"
  | "setDesign"
  | "costumeDesign"
  | "setCostumeDesign"
  | "soundDesign"
  | "commissionedBy"
  | "description"
> = {
  production: "title",
  title: "title",
  venue: "venue",
  theatre: "venue",
  year: "year",
  director: "director",
  writer: "writer",
  cast: "cast",
  "associate director":
    "associateDirector",
  "musical director":
    "musicalDirector",
  choreographer:
    "choreographer",
  "movement director":
    "movementDirector",
  "lighting design":
    "lightingDesign",
  "lighting designer":
    "lightingDesign",
  "set design":
    "setDesign",
  "set designer":
    "setDesign",
  "costume design":
    "costumeDesign",
  "costume designer":
    "costumeDesign",
  "set & costume design":
    "setCostumeDesign",
  "set and costume design":
    "setCostumeDesign",
  "set & costume designer":
    "setCostumeDesign",
  "set and costume designer":
    "setCostumeDesign",
  "sound design":
    "soundDesign",
  "sound designer":
    "soundDesign",
  "commissioned by":
    "commissionedBy",
  description:
    "description",
};

function normaliseDetailLabel(
  value: string,
) {
  return value
    .trim()
    .replace(/:$/, "")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase();
}

function normaliseAllCapsDisplayValue(
  value: string,
) {
  const trimmed = value.trim();

  const letters =
    trimmed.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? [];

  if (
    letters.length === 0 ||
    letters.some(
      (letter) =>
        letter !== letter.toUpperCase(),
    )
  ) {
    return trimmed;
  }

  const acronymLike =
    /^[A-Z0-9&.+/-]{2,6}$/.test(
      trimmed,
    );

  if (acronymLike) {
    return trimmed;
  }

  return trimmed
    .toLowerCase()
    .replace(
      /(^|[\s\-–—/('])([a-zà-öø-ÿ])/g,
      (_match, prefix: string, letter: string) =>
        `${prefix}${letter.toUpperCase()}`,
    )
    .replace(
      /\b([A-Z])\.\s*([A-Z])\./g,
      "$1.$2.",
    );
}

function cleanDetailValue(
  value: string,
) {
  const cleaned =
    value
      .trim()
      .replace(/\s+\.$/, ".")
      .replace(/\.$/, "")
      .trim();

  if (
    !cleaned ||
    /^not\s+found$/i.test(
      cleaned,
    )
  ) {
    return "";
  }

  return normaliseAllCapsDisplayValue(
    cleaned,
  );
}

function decodeWindows1252Byte(
  hex: string,
) {
  return new TextDecoder(
    "windows-1252",
  ).decode(
    Uint8Array.of(
      Number.parseInt(
        hex,
        16,
      ),
    ),
  );
}

function rtfToPlainText(
  rtf: string,
) {
  let result = rtf;

  result =
    result.replace(
      /\{\\(?:fonttbl|colortbl|expandedcolortbl|stylesheet|info)[\s\S]*?\}(?=\s*\{|\s*\\|\s*$)/gi,
      "",
    );

  result =
    result.replace(
      /\\'([0-9a-f]{2})/gi,
      (
        _match,
        hex: string,
      ) =>
        decodeWindows1252Byte(
          hex,
        ),
    );

  result =
    result.replace(
      /\\u(-?\d+)\??/g,
      (
        _match,
        value: string,
      ) => {
        const number =
          Number.parseInt(
            value,
            10,
          );

        const codePoint =
          number < 0
            ? number +
              65536
            : number;

        return String.fromCharCode(
          codePoint,
        );
      },
    );

  result =
    result
      .replace(
        /\\par(?=[\\\s{}]|$)/gi,
        "\n",
      )
      .replace(
        /\\line(?=[\\\s{}]|$)/gi,
        "\n",
      )
      .replace(
        /\\tab(?=[\\\s{}]|$)/gi,
        "\t",
      )
      .replace(
        /\\\{/g,
        "{",
      )
      .replace(
        /\\\}/g,
        "}",
      )
      .replace(
        /\\\\/g,
        "\\",
      );

  result =
    result.replace(
      /\\\r?\n/g,
      "\n",
    );

  result =
    result
      .replace(
        /\\[a-z]+-?\d*\s?/gi,
        "",
      )
      .replace(
        /[{}]/g,
        "",
      );

  const lines =
    result
      .split(/\r?\n/)
      .map(
        (line) =>
          line
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),
      )
      .filter(Boolean);

  const firstLabelIndex =
    lines.findIndex(
      (line) =>
        Boolean(
          DETAIL_LABELS[
            normaliseDetailLabel(
              line,
            )
          ],
        ),
    );

  return (
    firstLabelIndex >= 0
      ? lines.slice(
          firstLabelIndex,
        )
      : lines
  ).join("\n");
}

function parseDetails(
  plainText: string,
) {
  const fields = {
    title: "",
    venue: "",
    year: "",
    director: "",
    writer: "",
    cast: "",
    associateDirector: "",
    musicalDirector: "",
    choreographer: "",
    movementDirector: "",
    lightingDesign: "",
    setDesign: "",
    costumeDesign: "",
    setCostumeDesign: "",
    soundDesign: "",
    commissionedBy: "",
    description: "",
  };

  let activeField:
    | keyof typeof fields
    | null = null;

  const lines =
    plainText
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim(),
      )
      .filter(Boolean);

  for (
    const line of lines
  ) {
    const inlineMatch =
      line.match(
        /^([^:]{2,60}):\s*(.+)$/,
      );

    if (inlineMatch) {
      const [
        ,
        rawLabel,
        rawValue,
      ] =
        inlineMatch;

      const field =
        DETAIL_LABELS[
          normaliseDetailLabel(
            rawLabel,
          )
        ];

      if (field) {
        const value =
          cleanDetailValue(
            rawValue,
          );

        if (
          field ===
            "description" &&
          fields.description
        ) {
          fields.description =
            `${fields.description} ${value}`;
        } else if (
          !fields[field]
        ) {
          fields[field] =
            value;
        }

        activeField =
          null;
        continue;
      }
    }

    const field =
      DETAIL_LABELS[
        normaliseDetailLabel(
          line,
        )
      ];

    if (field) {
      activeField =
        field;
      continue;
    }

    if (!activeField) {
      continue;
    }

    const value =
      cleanDetailValue(
        line,
      );

    if (!value) {
      continue;
    }

    if (
      activeField ===
        "description" &&
      fields.description
    ) {
      fields.description =
        `${fields.description} ${value}`;
    } else if (
      !fields[
        activeField
      ]
    ) {
      fields[
        activeField
      ] = value;
    }

    if (
      activeField !==
      "description"
    ) {
      activeField =
        null;
    }
  }

  return fields;
}

function slugify(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function webStem(
  value: string,
) {
  const filename =
    value
      .split("/")
      .at(-1) ??
    value;

  const withoutExtension =
    filename.replace(
      /\.[^.]+$/,
      "",
    );

  return (
    slugify(
      withoutExtension,
    ) || "photograph"
  );
}

async function prepareImage(
  source: LocalImage,
  outputFilename: string,
): Promise<{
  blob: Blob;
  asset: PublishedAsset;
}> {
  const objectUrl =
    URL.createObjectURL(
      source.file,
    );

  try {
    const image =
      new Image();

    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        image.onload = () =>
          resolve();

        image.onerror = () =>
          reject(
            new Error(
              `Could not read ${source.file.name}.`,
            ),
          );

        image.src =
          objectUrl;
      },
    );

    const scale =
      Math.min(
        1,
        2560 /
          Math.max(
            image.naturalWidth,
            image.naturalHeight,
          ),
      );

    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
            scale,
        ),
      );

    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
            scale,
        ),
      );

    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      width;
    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d",
      );

    if (!context) {
      throw new Error(
        `Could not prepare ${source.file.name}.`,
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );

    const blob =
      await new Promise<Blob>(
        (
          resolve,
          reject,
        ) => {
          canvas.toBlob(
            (result) => {
              if (
                result
              ) {
                resolve(
                  result,
                );
              } else {
                reject(
                  new Error(
                    `Could not create ${outputFilename}.`,
                  ),
                );
              }
            },
            "image/webp",
            0.82,
          );
        },
      );

    const blurCanvas =
      document.createElement(
        "canvas",
      );

    const blurWidth =
      24;

    blurCanvas.width =
      blurWidth;

    blurCanvas.height =
      Math.max(
        1,
        Math.round(
          height *
            (
              blurWidth /
              width
            ),
        ),
      );

    const blurContext =
      blurCanvas.getContext(
        "2d",
      );

    if (!blurContext) {
      throw new Error(
        `Could not create blur placeholder for ${source.file.name}.`,
      );
    }

    blurContext.drawImage(
      canvas,
      0,
      0,
      blurCanvas.width,
      blurCanvas.height,
    );

    return {
      blob,
      asset: {
        sourceFilepath:
          source.filepath,
        filename:
          outputFilename,
        blurDataURL:
          blurCanvas.toDataURL(
            "image/webp",
            0.38,
          ),
      },
    };
  } finally {
    URL.revokeObjectURL(
      objectUrl,
    );
  }
}


async function createProductionCardBlob(
  source: Blob,
) {
  const objectUrl =
    URL.createObjectURL(
      source,
    );

  try {
    const image =
      new Image();

    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        image.onload =
          () =>
            resolve();

        image.onerror =
          () =>
            reject(
              new Error(
                "The production card image could not be decoded.",
              ),
            );

        image.src =
          objectUrl;
      },
    );

    const maximumWidth =
      1000;

    const scale =
      Math.min(
        1,
        maximumWidth /
          image.naturalWidth,
      );

    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
            scale,
        ),
      );

    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
            scale,
        ),
      );

    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      width;
    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d",
      );

    if (!context) {
      throw new Error(
        "The production card canvas could not be created.",
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );

    return await new Promise<Blob>(
      (
        resolve,
        reject,
      ) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(
                blob,
              );
            } else {
              reject(
                new Error(
                  "The production card WebP could not be created.",
                ),
              );
            }
          },
          "image/webp",
          0.75,
        );
      },
    );
  } finally {
    URL.revokeObjectURL(
      objectUrl,
    );
  }
}

export default function ProductionUpload() {
  const [
    images,
    setImages,
  ] =
    useState<
      LocalImage[]
    >([]);

  const [
    heroId,
    setHeroId,
  ] =
    useState("");

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    venue,
    setVenue,
  ] =
    useState("");

  const [
    month,
    setMonth,
  ] =
    useState("");

  const [
    year,
    setYear,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    commissionedBy,
    setCommissionedBy,
  ] =
    useState("");

  const [
    director,
    setDirector,
  ] =
    useState("");

  const [
    writer,
    setWriter,
  ] =
    useState("");

  const [
    cast,
    setCast,
  ] =
    useState("");

  const [
    associateDirector,
    setAssociateDirector,
  ] =
    useState("");

  const [
    musicalDirector,
    setMusicalDirector,
  ] =
    useState("");

  const [
    choreographer,
    setChoreographer,
  ] =
    useState("");

  const [
    movementDirector,
    setMovementDirector,
  ] =
    useState("");

  const [
    lightingDesign,
    setLightingDesign,
  ] =
    useState("");

  const [
    setDesign,
    setSetDesign,
  ] =
    useState("");

  const [
    costumeDesign,
    setCostumeDesign,
  ] =
    useState("");

  const [
    setAndCostumeDesign,
    setSetAndCostumeDesign,
  ] =
    useState("");

  const [
    soundDesign,
    setSoundDesign,
  ] =
    useState("");

  const [
    progress,
    setProgress,
  ] =
    useState("");

  const [
    detailsFileName,
    setDetailsFileName,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    publishedUrl,
    setPublishedUrl,
  ] =
    useState("");

  const [
    publishSucceeded,
    setPublishSucceeded,
  ] =
    useState(false);

  const [
    isPublishing,
    setIsPublishing,
  ] =
    useState(false);

  const includedImages =
    useMemo(
      () =>
        images.filter(
          (image) =>
            image.included,
        ),
      [images],
    );

  const hero =
    images.find(
      (image) =>
        image.id ===
        heroId,
    ) ?? null;

  async function chooseFolder(
    files:
      FileList | null,
  ) {
    if (!files) {
      return;
    }

    for (
      const old of
      images
    ) {
      URL.revokeObjectURL(
        old.previewUrl,
      );
    }

    const selectedFiles =
      Array.from(
        files,
      );

    const next =
      selectedFiles
        .filter(
          (file) =>
            IMAGE_EXTENSIONS.test(
              file.name,
            ),
        )
        .map(
          (
            file,
            index,
          ) => ({
            id:
              `${index}:${file.webkitRelativePath || file.name}`,
            file,
            filepath:
              file.webkitRelativePath ||
              file.name,
            previewUrl:
              URL.createObjectURL(
                file,
              ),
            included:
              true,
          }),
        );

    setImages(
      next,
    );

    setHeroId(
      next[0]?.id ??
        "",
    );

    setError("");
    setPublishedUrl("");
    setPublishSucceeded(false);
    setDetailsFileName("");

    const detailsFile =
      selectedFiles.find(
        (file) =>
          /(^|\/)details?\.txt$/i.test(
            file.webkitRelativePath ||
              file.name,
          ),
      ) ??
      selectedFiles.find(
        (file) =>
          /(^|\/)details?\.rtf$/i.test(
            file.webkitRelativePath ||
              file.name,
          ),
      ) ??
      selectedFiles.find(
        (file) =>
          /\.txt$/i.test(
            file.name,
          ),
      ) ??
      selectedFiles.find(
        (file) =>
          /\.rtf$/i.test(
            file.name,
          ),
      ) ??
      null;

    if (detailsFile) {
      try {
        const rawText =
          await detailsFile.text();

        const plainText =
          /\.rtf$/i.test(
            detailsFile.name,
          )
            ? rtfToPlainText(
                rawText,
              )
            : rawText
                .split(
                  /\r?\n/,
                )
                .map(
                  (line) =>
                    line.trim(),
                )
                .filter(
                  Boolean,
                )
                .join(
                  "\n",
                );

        const fields =
          parseDetails(
            plainText,
          );

        setTitle(
          fields.title,
        );
        setVenue(
          fields.venue,
        );
        setYear(
          fields.year,
        );
        setDirector(
          fields.director,
        );
        setWriter(
          fields.writer,
        );
        setCast(
          fields.cast,
        );
        setAssociateDirector(
          fields.associateDirector,
        );
        setMusicalDirector(
          fields.musicalDirector,
        );
        setChoreographer(
          fields.choreographer,
        );
        setMovementDirector(
          fields.movementDirector,
        );
        setLightingDesign(
          fields.lightingDesign,
        );
        setSetDesign(
          fields.setDesign,
        );
        setCostumeDesign(
          fields.costumeDesign,
        );
        setSetAndCostumeDesign(
          fields.setCostumeDesign,
        );
        setSoundDesign(
          fields.soundDesign,
        );
        setCommissionedBy(
          fields.commissionedBy,
        );
        setDescription(
          fields.description,
        );

        setDetailsFileName(
          detailsFile.name,
        );

        setProgress(
          `Found ${next.length.toLocaleString()} photograph${
            next.length === 1
              ? ""
              : "s"
          }. Read production details from ${detailsFile.name}.`,
        );
      } catch (detailsError) {
        setProgress(
          `Found ${next.length.toLocaleString()} photograph${
            next.length === 1
              ? ""
              : "s"
          }.`,
        );

        setError(
          detailsError instanceof Error
            ? `Photographs loaded, but ${detailsFile.name} could not be read: ${detailsError.message}`
            : `Photographs loaded, but ${detailsFile.name} could not be read.`,
        );
      }
    } else {
      setProgress(
        `Found ${next.length.toLocaleString()} photograph${
          next.length === 1
            ? ""
            : "s"
        }. No details.txt or details.rtf file was found.`,
      );
    }
  }

  async function publish() {
    setError("");
    setPublishedUrl("");
    setPublishSucceeded(false);

    const parsedMonth =
      Number.parseInt(
        month,
        10,
      );

    const parsedYear =
      Number.parseInt(
        year,
        10,
      );

    if (
      !title.trim() ||
      !venue.trim() ||
      !Number.isInteger(
        parsedMonth,
      ) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      !Number.isInteger(
        parsedYear,
      ) ||
      parsedYear < 1800 ||
      parsedYear > 2200 ||
      !description.trim()
    ) {
      setError(
        "Title, venue, month, year and description are required.",
      );
      return;
    }

    if (
      !hero ||
      !hero.included
    ) {
      setError(
        "Choose an included hero image.",
      );
      return;
    }

    const gallery =
      includedImages.filter(
        (image) =>
          image.id !==
          hero.id,
      );

    if (
      gallery.length === 0
    ) {
      setError(
        "Include at least one gallery image in addition to the hero.",
      );
      return;
    }

    const slug =
      slugify(
        [
          title,
          venue,
          MONTHS[
            parsedMonth
          ],
          parsedYear,
        ].join(" "),
      );

    if (!slug) {
      setError(
        "Could not create a production slug.",
      );
      return;
    }

    if (
      !window.confirm(
        `Publish "${title.trim()}" with ${gallery.length + 1} images?`,
      )
    ) {
      return;
    }

    setIsPublishing(
      true,
    );

    try {
      setProgress(
        "Checking production identity…",
      );

      const checkResponse =
        await fetch(
          "/api/admin/new-production-r2",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  action:
                    "check",
                  slug,
                },
              ),
          },
        );

      const check =
        (await checkResponse.json()) as {
          ok?: boolean;
          exists?: boolean;
          message?: string;
        };

      if (
        !checkResponse.ok ||
        !check.ok
      ) {
        throw new Error(
          check.message ||
            "Production check failed.",
        );
      }

      if (
        check.exists
      ) {
        throw new Error(
          `A production already exists for "${slug}".`,
        );
      }

      const jobs = [
        {
          image:
            hero,
          outputFilename:
            `hero-${webStem(
              hero.file.name,
            )}.webp`,
        },
        ...gallery.map(
          (
            image,
            index,
          ) => ({
            image,
            outputFilename:
              `${String(
                index + 1,
              ).padStart(
                2,
                "0",
              )}-${webStem(
                image.file.name,
              )}.webp`,
          }),
        ),
      ];

      const assets:
        PublishedAsset[] =
        [];

      for (
        let index = 0;
        index <
        jobs.length;
        index += 1
      ) {
        const job =
          jobs[
            index
          ];

        setProgress(
          `Preparing and uploading ${index + 1} of ${jobs.length}: ${job.image.file.name}`,
        );

        const signedResponse =
          await fetch(
            "/api/admin/new-production-r2",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  {
                    action:
                      "sign-image",
                    slug,
                    filename:
                      job.outputFilename,
                  },
                ),
            },
          );

        const signed =
          (await signedResponse.json()) as {
            ok?: boolean;
            uploadUrl?: string;
            cardUploadUrl?: string;
            message?: string;
          };

        if (
          !signedResponse.ok ||
          !signed.ok ||
          !signed.uploadUrl
        ) {
          throw new Error(
            signed.message ||
              `Could not prepare ${job.image.file.name} for upload.`,
          );
        }

        const prepared =
          await prepareImage(
            job.image,
            job.outputFilename,
          );

        const uploadResponse =
          await fetch(
            signed.uploadUrl,
            {
              method:
                "PUT",
              headers: {
                "Content-Type":
                  "image/webp",
                "Cache-Control":
                  "public, max-age=31536000, immutable",
              },
              body:
                prepared.blob,
            },
          );

        if (
          !uploadResponse.ok
        ) {
          throw new Error(
            `R2 upload failed for ${job.image.file.name} (HTTP ${uploadResponse.status}).`,
          );
        }

        if (
          signed.cardUploadUrl
        ) {
          const cardBlob =
            await createProductionCardBlob(
              prepared.blob,
            );

          const cardResponse =
            await fetch(
              signed.cardUploadUrl,
              {
                method:
                  "PUT",
                headers: {
                  "Content-Type":
                    "image/webp",
                  "Cache-Control":
                    "public, max-age=31536000, immutable",
                },
                body:
                  cardBlob,
              },
            );

          if (
            !cardResponse.ok
          ) {
            throw new Error(
              `R2 card upload failed for ${job.image.file.name} (HTTP ${cardResponse.status}).`,
            );
          }
        }

        assets.push(
          prepared.asset,
        );
      }

      const genericAlt =
        `${title.trim()} at ${venue.trim()} — production photograph`;

      const castCredits =
        cast
          .split(
            /\s*(?:,|;|\band\b)\s*/i,
          )
          .map(
            (name) =>
              normaliseAllCapsDisplayValue(
                name,
              ),
          )
          .filter(Boolean)
          .map((name) => ({
            role: "Cast",
            name,
          }));

      const credits = [
        ["Director", director],
        ["Writer", writer],
        ["Associate Director", associateDirector],
        ["Musical Director", musicalDirector],
        ["Choreographer", choreographer],
        ["Movement Director", movementDirector],
        ["Lighting Design", lightingDesign],
        ["Set Design", setDesign],
        ["Costume Design", costumeDesign],
        ["Set & Costume Design", setAndCostumeDesign],
        ["Sound Design", soundDesign],
        ["Commissioned by", commissionedBy],
      ].flatMap(
        ([rawRole, rawName]) => {
          const role =
            normaliseAllCapsDisplayValue(
              rawRole,
            );

          const name =
            normaliseAllCapsDisplayValue(
              rawName,
            );

          return name
            ? [
                {
                  role,
                  name,
                },
              ]
            : [];
        },
      );

      credits.push(
        ...castCredits,
      );

      const payload = {
        slug,
        title:
          title.trim(),
        venue:
          venue.trim(),
        month:
          parsedMonth,
        year:
          parsedYear,
        description:
          description.trim(),
        hero: {
          filepath:
            hero.filepath,
          filename:
            jobs[0]
              .outputFilename,
          alt:
            genericAlt,
        },
        credits,
        images:
          gallery.map(
            (
              image,
              index,
            ) => ({
              filepath:
                image.filepath,
              filename:
                jobs[
                  index +
                    1
                ]
                  .outputFilename,
              alt:
                genericAlt,
              layout:
                "wide" as const,
            }),
          ),
      };

      setProgress(
        "Verifying R2 and committing production to the archive…",
      );

      const finalizeResponse =
        await fetch(
          "/api/admin/new-production-r2",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  action:
                    "finalize",
                  payload,
                  heroAsset:
                    assets[0],
                  galleryAssets:
                    assets.slice(
                      1,
                    ),
                },
              ),
          },
        );

      const finalized =
        (await finalizeResponse.json()) as {
          ok?: boolean;
          message?: string;
          production?: {
            url?: string;
          };
        };

      if (
        !finalizeResponse.ok ||
        !finalized.ok
      ) {
        throw new Error(
          finalized.message ||
            "Production could not be finalized.",
        );
      }

      setProgress(
        "Published successfully.",
      );

      setPublishSucceeded(
        true,
      );

      setPublishedUrl(
        finalized.production
          ?.url ?? "",
      );
    } catch (
      publishError
    ) {
      setError(
        publishError instanceof
          Error
          ? publishError.message
          : "Production publishing failed.",
      );
    } finally {
      setIsPublishing(
        false,
      );
    }
  }

  return (
    <div
      style={{
        display:
          "grid",
        gap:
          "2rem",
      }}
    >
      <section className="backstage-section">
        <div className="backstage-section-heading">
          <h2>
            Production folder
          </h2>
          <p>
            Browser → Cloudflare R2
          </p>
        </div>

        <p
          style={{
            maxWidth:
              "52rem",
            color:
              "rgba(242,238,230,.72)",
            lineHeight:
              1.7,
          }}
        >
          Choose one production folder. Photographs remain in your browser until the selected images are converted to WebP and uploaded directly to R2.
        </p>

        <input
          type="file"
          multiple
          // @ts-expect-error webkitdirectory is supported by Safari/Chromium.
          webkitdirectory=""
          onChange={(
            event,
          ) =>
            void chooseFolder(
              event.target
                .files,
            )
          }
        />

        {progress ? (
          <p>
            {progress}
          </p>
        ) : null}

        {error ? (
          <p
            style={{
              color:
                "#e6a89c",
            }}
          >
            {error}
          </p>
        ) : null}

        {publishedUrl ? (
          <p>
            Published:{" "}
            <a
              href={
                publishedUrl
              }
            >
              {publishedUrl}
            </a>
          </p>
        ) : null}
      </section>

      {images.length >
      0 ? (
        <>
          <section className="backstage-section">
            <div className="backstage-section-heading">
              <h2>
                Production information
              </h2>
              <p>
                {detailsFileName
                  ? `Read from ${detailsFileName}`
                  : "Required before publishing"}
              </p>
            </div>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                columnGap:
                  "2rem",
                rowGap:
                  "1.5rem",
              }}
            >
              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Production
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={
                    title
                  }
                  onChange={(
                    event,
                  ) =>
                    setTitle(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Venue
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={
                    venue
                  }
                  onChange={(
                    event,
                  ) =>
                    setVenue(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Month
                <select
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "#11100f",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={
                    month
                  }
                  onChange={(
                    event,
                  ) =>
                    setMonth(
                      event
                        .target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Choose month
                  </option>
                  {MONTHS.slice(
                    1,
                  ).map(
                    (
                      name,
                      index,
                    ) => (
                      <option
                        key={
                          name
                        }
                        value={
                          index +
                          1
                        }
                      >
                        {name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Year
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  inputMode="numeric"
                  value={
                    year
                  }
                  onChange={(
                    event,
                  ) =>
                    setYear(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Director
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={
                    director
                  }
                  onChange={(
                    event,
                  ) =>
                    setDirector(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Writer
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={writer}
                  onChange={(event) =>
                    setWriter(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Cast
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={cast}
                  onChange={(event) =>
                    setCast(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Associate Director
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={associateDirector}
                  onChange={(event) =>
                    setAssociateDirector(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Musical Director
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={musicalDirector}
                  onChange={(event) =>
                    setMusicalDirector(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Choreographer
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={choreographer}
                  onChange={(event) =>
                    setChoreographer(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Movement Director
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={movementDirector}
                  onChange={(event) =>
                    setMovementDirector(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Lighting Design
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={lightingDesign}
                  onChange={(event) =>
                    setLightingDesign(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Set Design
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={setDesign}
                  onChange={(event) =>
                    setSetDesign(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Costume Design
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={costumeDesign}
                  onChange={(event) =>
                    setCostumeDesign(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Set &amp; Costume Design
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={setAndCostumeDesign}
                  onChange={(event) =>
                    setSetAndCostumeDesign(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Sound Design
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={soundDesign}
                  onChange={(event) =>
                    setSoundDesign(event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display:
                    "grid",
                  gap:
                    ".5rem",
                  color:
                    "rgba(242,238,230,.68)",
                  fontSize:
                    ".68rem",
                  fontWeight:
                    700,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Commissioned by
                <input
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    minHeight:
                      "2.8rem",
                    padding:
                      ".75rem .9rem",
                    border:
                      "1px solid rgba(242,238,230,.24)",
                    borderRadius:
                      "2px",
                    background:
                      "rgba(255,255,255,.035)",
                    color:
                      "#f2eee6",
                    fontSize:
                      ".95rem",
                    fontWeight:
                      400,
                    letterSpacing:
                      "normal",
                    textTransform:
                      "none",
                  }}
                  value={
                    commissionedBy
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommissionedBy(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            <label
              style={{
                display:
                  "grid",
                gap:
                  ".5rem",
                marginTop:
                  "1.5rem",
                color:
                  "rgba(242,238,230,.68)",
                fontSize:
                  ".68rem",
                fontWeight:
                  700,
                letterSpacing:
                  ".08em",
                textTransform:
                  "uppercase",
              }}
            >
              Description
              <textarea
                style={{
                  width:
                    "100%",
                  boxSizing:
                    "border-box",
                  padding:
                    ".9rem",
                  border:
                    "1px solid rgba(242,238,230,.24)",
                  borderRadius:
                    "2px",
                  background:
                    "rgba(255,255,255,.035)",
                  color:
                    "#f2eee6",
                  fontSize:
                    ".95rem",
                  fontWeight:
                    400,
                  letterSpacing:
                    "normal",
                  lineHeight:
                    1.6,
                  textTransform:
                    "none",
                  resize:
                    "vertical",
                }}
                rows={
                  7
                }
                value={
                  description
                }
                onChange={(
                  event,
                ) =>
                  setDescription(
                    event
                      .target
                      .value,
                  )
                }
              />
            </label>
          </section>

          <section className="backstage-section">
            <div className="backstage-section-heading">
              <h2>
                Images
              </h2>
              <p>
                {includedImages.length} included
              </p>
            </div>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fill,minmax(180px,1fr))",
                gap:
                  "1rem",
              }}
            >
              {images.map(
                (
                  image,
                ) => (
                  <article
                    key={
                      image.id
                    }
                    style={{
                      border:
                        image.id ===
                        heroId
                          ? "2px solid #c7a369"
                          : "1px solid rgba(242,238,230,.18)",
                      padding:
                        ".65rem",
                    }}
                  >
                    <img
                      src={
                        image.previewUrl
                      }
                      alt=""
                      style={{
                        display:
                          "block",
                        width:
                          "100%",
                        aspectRatio:
                          "4 / 3",
                        objectFit:
                          "contain",
                        background:
                          "#080808",
                      }}
                    />

                    <p
                      style={{
                        fontSize:
                          ".72rem",
                        overflowWrap:
                          "anywhere",
                      }}
                    >
                      {
                        image
                          .file
                          .name
                      }
                    </p>

                    <label
                      style={{
                        display:
                          "block",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          image.included
                        }
                        onChange={() =>
                          setImages(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  candidate,
                                ) =>
                                  candidate.id ===
                                  image.id
                                    ? {
                                        ...candidate,
                                        included:
                                          !candidate.included,
                                      }
                                    : candidate,
                              ),
                          )
                        }
                      />{" "}
                      Include
                    </label>

                    <label
                      style={{
                        display:
                          "block",
                        marginTop:
                          ".45rem",
                      }}
                    >
                      <input
                        type="radio"
                        name="hero"
                        checked={
                          heroId ===
                          image.id
                        }
                        onChange={() =>
                          setHeroId(
                            image.id,
                          )
                        }
                      />{" "}
                      Hero
                    </label>
                  </article>
                ),
              )}
            </div>
          </section>

          <section className="backstage-section">
            {publishSucceeded ? (
              <div
                role="status"
                style={{
                  marginBottom:
                    "1.5rem",
                  padding:
                    "1.25rem 1.4rem",
                  border:
                    "1px solid rgba(199,163,105,.55)",
                  background:
                    "rgba(199,163,105,.08)",
                }}
              >
                <strong
                  style={{
                    display:
                      "block",
                    marginBottom:
                      ".4rem",
                    color:
                      "#c7a369",
                    fontSize:
                      ".78rem",
                    letterSpacing:
                      ".1em",
                    textTransform:
                      "uppercase",
                  }}
                >
                  Production published successfully
                </strong>

                <span>
                  {title.trim()} is now live in the archive.
                </span>

                {publishedUrl ? (
                  <>
                    {" "}
                    <a
                      href={
                        publishedUrl
                      }
                      style={{
                        color:
                          "#c7a369",
                        fontWeight:
                          700,
                      }}
                    >
                      View production
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "flex-end",
              }}
            >
              <button
                type="button"
                className="backstage-button"
                disabled={
                  isPublishing
                }
                onClick={() =>
                  void publish()
                }
              >
                {isPublishing
                  ? "Publishing…"
                  : "Upload & Publish"}
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
