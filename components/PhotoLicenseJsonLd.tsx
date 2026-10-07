import { JsonLd, SITE_URL } from "./directory/DirectoryParts";

export type LicensedPhoto = {
  src: string;
  alt?: string;
};

function absoluteUrl(src: string) {
  if (/^https?:\/\//i.test(src)) {
    return src;
  }

  return `${SITE_URL}${src.startsWith("/") ? src : `/${src}`}`;
}

export function licensedPhotoObjects(
  pageUrl: string,
  photos: LicensedPhoto[],
) {
  const unique = photos.filter(
    (photo, index, list) =>
      Boolean(photo.src) &&
      list.findIndex(
        (candidate) => candidate.src === photo.src,
      ) === index,
  );

  return unique.map((photo, index) => ({
    "@type": "ImageObject",
    "@id": `${pageUrl}#licensed-image-${index + 1}`,
    contentUrl: absoluteUrl(photo.src),
    url: absoluteUrl(photo.src),
    ...(photo.alt?.trim()
      ? { caption: photo.alt.trim() }
      : {}),
    creator: {
      "@id": `${SITE_URL}/#steve-gregson`,
    },
    creditText: "Steve Gregson Photography",
    copyrightNotice: "© Steve Gregson Photography",
    license: `${SITE_URL}/policies/terms`,
    acquireLicensePage: `${SITE_URL}/contact`,
  }));
}

export default function PhotoLicenseJsonLd({
  pagePath,
  photos,
}: {
  pagePath: string;
  photos: LicensedPhoto[];
}) {
  if (photos.length === 0) {
    return null;
  }

  const pageUrl = absoluteUrl(pagePath);

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": licensedPhotoObjects(pageUrl, photos),
      }}
    />
  );
}
