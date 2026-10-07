"server-only";

export type TransferRecipient = {
  email: string;
};

export type TransferFile = {
  id: string;
  transferId: string;
  originalName: string;
  relativePath: string;
  objectKey: string;
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
  files: TransferFile[];
  downloads: TransferDownloadEvent[];
};
