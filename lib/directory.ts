import directoryData from "./directory.json";

import {
  getDirectoryUrlFromData,
  type DirectoryData,
} from "./directory-data";

export const directory =
  directoryData as DirectoryData;

export function getDirectoryUrl(
  name: string,
) {
  return getDirectoryUrlFromData(
    directory,
    name,
  );
}
