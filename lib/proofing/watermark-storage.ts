import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function getBucket() {
  return requiredEnv("R2_BUCKET_NAME");
}

function safeSegment(value: string) {
  if (
    !value ||
    value.includes("/") ||
    value.includes("\\") ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(
      "Invalid proofing watermark storage segment.",
    );
  }

  return value;
}

export function getProofingWatermarkObjectKey(
  filename: string,
) {
  return `watermarks/${safeSegment(filename)}`;
}

export async function putProofingWatermark(
  filename: string,
  body: Buffer,
) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: getProofingWatermarkObjectKey(filename),
      Body: body,
      ContentType: "image/png",
    }),
  );
}

export async function getProofingWatermarkFile(
  filename: string,
) {
  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: getProofingWatermarkObjectKey(filename),
    }),
  );

  if (!result.Body) {
    throw new Error(
      "Proofing watermark object has no body.",
    );
  }

  const bytes =
    await result.Body.transformToByteArray();

  return Buffer.from(bytes);
}

export async function deleteProofingWatermark(
  filename: string,
) {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: getProofingWatermarkObjectKey(filename),
    }),
  );
}
