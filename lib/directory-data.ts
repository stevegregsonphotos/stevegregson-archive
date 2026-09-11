export type DirectoryEntry = {
  url: string;
};

export type DirectorySection =
  Record<string, DirectoryEntry>;

export type DirectoryData = {
  venues: DirectorySection;
  companies: DirectorySection;
  people: DirectorySection;
};

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

export function getDirectoryUrlFromData(
  directory: DirectoryData,
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
