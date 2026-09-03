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

export type ProofingWatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

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

createdAt?: string;

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

export type ProofingCompany = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProofingContact = {
  id: string;
  name: string;
  companyId?: string;

  /*
   * Store normalised lowercase email.
   */
  email: string;

  createdAt: string;
  updatedAt: string;
};

export type ProofingGalleryRecipient = {
  id: string;

  /*
   * Present when this recipient came from
   * the private Backstage address book.
   *
   * One-off email recipients do not require
   * a saved contact.
   */
  contactId?: string;

  /*
   * Snapshot the recipient details used for
   * this gallery so historical galleries do
   * not change when a contact is later edited.
   */
  name?: string;
  company?: string;
  email: string;

  addedAt: string;
};

export type ProofingGallery = {
  id: string;
  slug: string;

  title: string;
  clientName?: string;

  venue?: string;
  shootDate?: string;
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

  /*
   * Optional reusable watermark selected from
   * the Backstage watermark library.
   */
  watermarkId?: string;

  /*
   * Per-gallery watermark presentation.
   *
   * size and opacity are percentages.
   */
  watermarkPosition?: ProofingWatermarkPosition;
  watermarkSize?: number;
  watermarkOpacity?: number;

  images: ProofingImage[];

  /*
   * Every identified visitor gets their
   * own independent selection.
   */
  visitors: ProofingVisitor[];

  /*
   * People this gallery was sent to.
   *
   * This is deliberately separate from visitors:
   * recipients are chosen by Steve, while visitors
   * are people who actually enter the gallery.
   *
   * Optional while existing filesystem galleries
   * are migrated to persistent storage.
   */
  recipients?: ProofingGalleryRecipient[];

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