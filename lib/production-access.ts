import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function getPasswordKey() {
  const value =
    process.env.PRODUCTION_PASSWORD_KEY;

  if (
    !value ||
    !/^[a-f0-9]{64}$/i.test(value)
  ) {
    throw new Error(
      "PRODUCTION_PASSWORD_KEY is missing or invalid.",
    );
  }

  return Buffer.from(value, "hex");
}

function getAccessTokenKey() {
  return createHmac(
    "sha256",
    getPasswordKey(),
  )
    .update(
      "steve-gregson-production-access-token-key",
      "utf8",
    )
    .digest();
}

function digest(value: string) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest();
}

export function encryptProductionPassword(
  password: string,
) {
  const iv = randomBytes(12);

  const cipher = createCipheriv(
    "aes-256-gcm",
    getPasswordKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptProductionPassword(
  value: string,
) {
  const [
    ivHex,
    authTagHex,
    encryptedHex,
  ] = value.split(":");

  if (
    !ivHex ||
    !authTagHex ||
    !encryptedHex
  ) {
    throw new Error(
      "The stored production password is invalid.",
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getPasswordKey(),
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(
    Buffer.from(authTagHex, "hex"),
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(encryptedHex, "hex"),
    ),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function productionPasswordMatches(
  submittedPassword: string,
  encryptedPassword: string,
) {
  const expectedPassword =
    decryptProductionPassword(
      encryptedPassword,
    );

  return timingSafeEqual(
    digest(submittedPassword),
    digest(expectedPassword),
  );
}

export function createProductionAccessToken(
  slug: string,
  encryptedPassword: string,
) {
  return createHmac(
    "sha256",
    getAccessTokenKey(),
  )
    .update(
      `steve-gregson-production-access:${slug}:${encryptedPassword}`,
      "utf8",
    )
    .digest("hex");
}

export function productionAccessCookieName(
  slug: string,
) {
  return `sg-production-access-${slug}`;
}

export function productionAccessTokenMatches(
  suppliedToken: string,
  expectedToken: string,
) {
  const supplied = Buffer.from(
    suppliedToken,
    "utf8",
  );

  const expected = Buffer.from(
    expectedToken,
    "utf8",
  );

  if (
    supplied.length !== expected.length
  ) {
    return false;
  }

  return timingSafeEqual(
    supplied,
    expected,
  );
}
