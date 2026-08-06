import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const BACKSTAGE_COOKIE_NAME =
  "stevegregson_backstage";

const SESSION_DURATION_SECONDS = 60 * 60 * 12;

type BackstageSession = {
  authenticated: true;
  username: string;
  expiresAt: number;
};

function getSessionSecret() {
  const secret =
    process.env.BACKSTAGE_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "BACKSTAGE_SESSION_SECRET is not configured.",
    );
  }

  return secret;
}

function encodePayload(value: unknown) {
  return Buffer.from(
    JSON.stringify(value),
    "utf8",
  ).toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(
    Buffer.from(value, "base64url").toString(
      "utf8",
    ),
  ) as unknown;
}

function signPayload(payload: string) {
  return createHmac(
    "sha256",
    getSessionSecret(),
  )
    .update(payload)
    .digest("base64url");
}

function safelyCompare(
  first: string,
  second: string,
) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    firstBuffer,
    secondBuffer,
  );
}

export function backstageCredentialsMatch(
  username: string,
  password: string,
) {
  const expectedUsername =
    process.env.BACKSTAGE_USERNAME?.trim();

  const expectedPassword =
    process.env.BACKSTAGE_PASSWORD;

  if (
    !expectedUsername ||
    !expectedPassword
  ) {
    throw new Error(
      "Backstage username or password is not configured.",
    );
  }

  return (
    safelyCompare(
      username,
      expectedUsername,
    ) &&
    safelyCompare(
      password,
      expectedPassword,
    )
  );
}

export function createBackstageSession(
  username: string,
) {
  const session: BackstageSession = {
    authenticated: true,
    username,
    expiresAt:
      Math.floor(Date.now() / 1000) +
      SESSION_DURATION_SECONDS,
  };

  const payload = encodePayload(session);
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function readBackstageSession(
  token: string | undefined,
): BackstageSession | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payload, suppliedSignature] =
    parts;

  if (!payload || !suppliedSignature) {
    return null;
  }

  const expectedSignature =
    signPayload(payload);

  if (
    !safelyCompare(
      suppliedSignature,
      expectedSignature,
    )
  ) {
    return null;
  }

  try {
    const decoded =
      decodePayload(payload) as Partial<BackstageSession>;

    if (
      decoded.authenticated !== true ||
      typeof decoded.username !== "string" ||
      !decoded.username ||
      typeof decoded.expiresAt !== "number" ||
      !Number.isInteger(decoded.expiresAt) ||
      decoded.expiresAt <=
        Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return decoded as BackstageSession;
  } catch {
    return null;
  }
}

function getCookieFromHeader(
  cookieHeader: string | null,
  cookieName: string,
) {
  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] =
      cookie.trim().split("=");

    if (rawName === cookieName) {
      return decodeURIComponent(
        rawValue.join("="),
      );
    }
  }

  return undefined;
}

export function readBackstageSessionFromRequest(
  request: Request,
) {
  const token = getCookieFromHeader(
    request.headers.get("cookie"),
    BACKSTAGE_COOKIE_NAME,
  );

  return readBackstageSession(token);
}

export function isBackstageRequestAuthenticated(
  request: Request,
) {
  return Boolean(
    readBackstageSessionFromRequest(request),
  );
}

export function createUnauthorizedResponse() {
  return Response.json(
    {
      ok: false,
      message:
        "Your Backstage session is missing or has expired.",
    },
    {
      status: 401,
    },
  );
}

export function getBackstageCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}