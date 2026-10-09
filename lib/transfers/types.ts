

export type TransferRecipient = {
  email: string;
};

export type TransferFile = {
  id: string;
  transferId: string;
  originalName: string;
  relativePath: string;
  objectKey: string;
  source?: "upload" | "archive";
  sizeBytes: number;
  contentType: string;
  createdAt: string;
};

export type TransferDownloadEvent = {
  id: string;
  transferId: string;
  fileId?: string;
  recipientEmail?: string;
  eventType: "file" | "all";
  createdAt: string;
};

export type TransferRecord = {
  id: string;
  token: string;
  title: string;
  message: string;
  senderEmail: string;
  recipients: TransferRecipient[];
  status: "uploading" | "active" | "disabled" | "expired";
  createdAt: string;
  finalizedAt?: string;
  expiresAt: string;
  fileCount: number;
  totalSizeBytes: number;
  hasPassword: boolean;
  backgroundFileIds: string[];
  files: TransferFile[];
  downloads: TransferDownloadEvent[];
};

/** What a client sees on a transfer link — never includes emails, storage keys or history. */
export type PublicTransferFile = {
  id: string;
  name: string;
  sizeBytes: number;
};

export type PublicTransferView = {
  token: string;
  title: string;
  available: boolean;
  locked: boolean;
  message: string;
  fileCount: number;
  totalSizeBytes: number;
  expiresAt: string;
  files: PublicTransferFile[];
  backgroundUrls: string[];
};
