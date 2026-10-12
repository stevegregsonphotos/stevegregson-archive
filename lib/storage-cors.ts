// Checks and updates which websites may talk to the storage bucket directly
// from a browser (its "CORS rules"). Uses Backblaze's own API with the site's
// existing storage key. Existing rules are always kept; one rule named
// "stevegregson-website" is added or refreshed.

const RULE_NAME = "stevegregson-website";

export const REQUIRED_ORIGINS = [
  "https://www.stevegregson.com",
  "https://transfers.stevegregson.com",
];
const REQUIRED_OPERATIONS = ["s3_get", "s3_head", "s3_put"];

type CorsRule = {
  corsRuleName: string;
  allowedOrigins: string[];
  allowedOperations: string[];
  allowedHeaders?: string[];
  exposeHeaders?: string[];
  maxAgeSeconds: number;
};

function env(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

async function authorize() {
  const keyId = env("CLIENT_ARCHIVE_STORAGE_ACCESS_KEY_ID", "TRANSFER_STORAGE_ACCESS_KEY_ID");
  const appKey = env("CLIENT_ARCHIVE_STORAGE_SECRET_ACCESS_KEY", "TRANSFER_STORAGE_SECRET_ACCESS_KEY");
  const bucketName = env("CLIENT_ARCHIVE_STORAGE_BUCKET_NAME", "TRANSFER_STORAGE_BUCKET_NAME");
  if (!keyId || !appKey || !bucketName) throw new Error("Storage keys aren't configured.");

  const response = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: "Basic " + Buffer.from(keyId + ":" + appKey).toString("base64") },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Backblaze sign-in failed: " + (data.message || response.status));
  const api = data.apiInfo?.storageApi;
  return {
    apiUrl: String(api?.apiUrl || ""),
    token: String(data.authorizationToken || ""),
    accountId: String(data.accountId || ""),
    bucketName,
    canEdit: Array.isArray(api?.capabilities) && api.capabilities.includes("writeBuckets"),
  };
}

async function call(auth: Awaited<ReturnType<typeof authorize>>, name: string, body: Record<string, unknown>) {
  const response = await fetch(auth.apiUrl + "/b2api/v3/" + name, {
    method: "POST",
    headers: { Authorization: auth.token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Backblaze said: " + (data.message || data.code || response.status));
  return data;
}

async function loadBucket() {
  const auth = await authorize();
  const list = await call(auth, "b2_list_buckets", { accountId: auth.accountId, bucketName: auth.bucketName });
  const bucket = list.buckets?.[0];
  if (!bucket) throw new Error("Couldn't find the storage bucket.");
  return { auth, bucket: bucket as { bucketId: string; revision: number; corsRules?: CorsRule[] } };
}

/** For each origin, whether browsers there can upload (put) and download (get). */
function summarise(rules: CorsRule[]) {
  return REQUIRED_ORIGINS.map((origin) => {
    const allows = (op: string) => rules.some((rule) =>
      (rule.allowedOrigins.includes("*") || rule.allowedOrigins.includes(origin)) && rule.allowedOperations.includes(op));
    return { origin, upload: allows("s3_put"), download: allows("s3_get") };
  });
}

export async function checkStorageCors() {
  const { auth, bucket } = await loadBucket();
  const rules = bucket.corsRules || [];
  const origins = summarise(rules);
  return {
    ok: origins.every((item) => item.upload && item.download),
    canEdit: auth.canEdit,
    origins,
    ruleCount: rules.length,
  };
}

export async function fixStorageCors() {
  const { auth, bucket } = await loadBucket();
  if (!auth.canEdit) {
    throw new Error("The storage key can't change bucket settings. Add the rule in Backblaze instead.");
  }
  const kept = (bucket.corsRules || []).filter((rule) => rule.corsRuleName !== RULE_NAME);
  const ours: CorsRule = {
    corsRuleName: RULE_NAME,
    allowedOrigins: REQUIRED_ORIGINS,
    allowedOperations: REQUIRED_OPERATIONS,
    allowedHeaders: ["*"],
    exposeHeaders: ["ETag", "Content-Length", "Content-Type"],
    maxAgeSeconds: 3600,
  };
  await call(auth, "b2_update_bucket", {
    accountId: auth.accountId,
    bucketId: bucket.bucketId,
    corsRules: [...kept, ours],
    ifRevisionMatches: bucket.revision,
  });
  return checkStorageCors();
}
