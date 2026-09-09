import directoryData from "./directory.json";

type DirectoryEntry = {
  url: string;
};

type DirectorySection =
  Record<string, DirectoryEntry>;

type Directory = {
  venues: DirectorySection;
  companies: DirectorySection;
  people: DirectorySection;
};

export const directory =
  directoryData as Directory;

function normaliseDirectoryName(
  value: string,
) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-GB");
}

function findDirectoryUrl(
  section: DirectorySection,
  name: string,
) {
  const direct =
    section[name]?.url;

  if (direct) {
    return direct;
  }

  const wanted =
    normaliseDirectoryName(name);

  const existingName =
    Object.keys(section).find(
      (candidate) =>
        normaliseDirectoryName(
          candidate,
        ) === wanted,
    );

  return existingName
    ? section[existingName]?.url
    : undefined;
}

export function getDirectoryUrl(
  name: string,
) {
  return (
    findDirectoryUrl(
      directory.venues,
      name,
    ) ??
    findDirectoryUrl(
      directory.companies,
      name,
    ) ??
    findDirectoryUrl(
      directory.people,
      name,
    )
  );
}
