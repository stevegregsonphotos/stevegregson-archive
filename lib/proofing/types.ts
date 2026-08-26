export type ProofingGalleryStatus =
  | "draft"
  | "live"
  | "expired"
  | "archived";

export type ProofingSelectionStatus =
  | "not-started"
  | "in-progress"
  | "submitted";

export type ProofingDownloadPermission =
  | "none"
  | "web"
  | "full"
  | "selected";

export type ProofingImage = {
  id: string;

  /*
   * Exact filename used for Lightroom lookup.
   * This must never be replaced by an
   * optimised website filename.
   */
  originalFilename: string;

  /*
   * Optimised proof used by the website.
   */
  webFilename: string;

  width: number;
  height: number;

  alt: string;

  sortOrder: number;

  blurDataURL?: string;
};

export type ProofingFavourite = {
  imageId: string;
  createdAt: string;
};

export type ProofingSelection = {
  status: ProofingSelectionStatus;

  /*
   * The client's current working selection.
   *
   * These may change after a submission.
   */
  favourites: ProofingFavourite[];

  /*
   * Snapshot of the last selection formally
   * submitted by the client.
   *
   * This lets Backstage distinguish between
   * the last confirmed selection and any
   * changes currently being made.
   */
  submittedFavourites?: ProofingFavourite[];

  /*
   * Date/time of the most recent formal
   * submission.
   */
  submittedAt?: string;
};

export type ProofingVisitor = {
  id: string;

  /*
   * Email identifies whose selection this is.
   * Store normalised lowercase email.
   */
  email: string;

  createdAt: string;
  lastSeenAt: string;

  selection: ProofingSelection;
};

export type ProofingGallery = {
  id: string;
  slug: string;

  title: string;
  clientName?: string;

  venue?: string;
  description?: string;

  /*
   * Client-facing gallery presentation.
   *
   * coverImageId references one of the images
   * already uploaded to this gallery.
   */
  coverImageId?: string;

  /*
   * Editable welcome/introduction shown to the
   * client before they enter the gallery.
   */
  introMessage?: string;

  createdAt: string;
  updatedAt: string;

  status: ProofingGalleryStatus;

  /*
   * Optional gallery expiry date.
   */
  expiresAt?: string;

  /*
   * Optional gallery password hash.
   * Plain passwords must never live here.
   */
  passwordHash?: string;

  downloadPermission:
    ProofingDownloadPermission;

  watermarkEnabled: boolean;

  images: ProofingImage[];

  /*
   * Every identified visitor gets their
   * own independent selection.
   */
  visitors: ProofingVisitor[];

  /*
   * Temporary backwards compatibility
   * for galleries created before visitors
   * were introduced.
   *
   * We can remove this once legacy test data
   * is no longer needed.
   */
  selection?: ProofingSelection;
};