import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertContains(relativePath, patterns) {
  const source = read(relativePath);
  for (const pattern of patterns) {
    if (!source.includes(pattern)) {
      throw new Error(`${relativePath} is missing required architecture marker: ${pattern}`);
    }
  }
}

function assertNotContains(relativePath, patterns) {
  const source = read(relativePath);
  for (const pattern of patterns) {
    if (source.includes(pattern)) {
      throw new Error(`${relativePath} contains forbidden Vercel-heavy pattern: ${pattern}`);
    }
  }
}

const checks = [
  () => assertContains("next.config.ts", ["unoptimized: true"]),
  () => assertContains(".vercelignore", ["public/images/productions/", "public/images/selected-work/"]),

  // Proofing upload: browser -> R2, Vercel only signs/commits metadata.
  () => assertContains("app/api/admin/proofing/upload/route.ts", ["action === \"presign\"", "action === \"commit-batch\"", "createProofingImageUploadUrl"]),
  () => assertNotContains("app/api/admin/proofing/upload/route.ts", ["request.formData()", "arrayBuffer()", "from \"sharp\"", "putProofingImage("]),
  () => assertContains("app/admin/proofing/[id]/ProofingUpload.tsx", ["uploadUrl", "method: \"PUT\"", "const concurrency"]),

  // Proofing delivery/downloads: signed R2 URLs; no image/ZIP proxy through Vercel.
  () => assertContains("app/api/proofing/image/route.ts", ["createProofingImageDownloadUrl", "NextResponse.redirect"]),
  () => assertNotContains("app/api/proofing/image/route.ts", ["from \"sharp\"", "getProofingImage(", "putRenderedProof("]),
  () => assertContains("app/api/proofing/download/route.ts", ["createProofingImageDownloadUrl", "NextResponse.redirect"]),
  () => assertContains("app/api/proofing/download-all/route.ts", ["createProofingImageDownloadUrl"]),
  () => assertNotContains("app/api/proofing/download-all/route.ts", ["archiver", "getProofingImage("]),

  // Proofing watermark administration: direct R2.
  () => assertContains("app/api/admin/proofing/watermarks/upload/route.ts", ["createProofingWatermarkUploadUrl"]),
  () => assertNotContains("app/api/admin/proofing/watermarks/upload/route.ts", ["request.formData()", "from \"sharp\""]),
  () => assertContains("app/api/admin/proofing/watermarks/image/route.ts", ["createProofingWatermarkDownloadUrl", "NextResponse.redirect"]),

  // Selected Work upload: direct R2.
  () => assertContains("app/api/admin/selected-work/route.ts", ["presign", "createSelectedWorkUploadUrl"]),
  () => assertNotContains("app/api/admin/selected-work/route.ts", ["request.formData()", "arrayBuffer()"]),

  // Curated Archive staging/editor: direct R2; no legacy ZIP or Vercel thumbnail transforms.
  () => assertContains("app/api/admin/curated-archive-import/upload/route.ts", ["action", "presign"]),
  () => assertNotContains("app/api/admin/curated-archive-import/upload/route.ts", ["putCuratedImportArchive("]),
  () => assertNotContains("app/api/admin/curated-archive-import/image/route.ts", ["from \"sharp\"", "readCuratedImportDirectFile(stagedRelativePath)"]),
  () => assertContains("app/api/admin/curated-archive-import/image/route.ts", ["createCuratedImportDownloadUrl", "NextResponse.redirect"]),
  () => assertNotContains("lib/curated-archive/prepare-production.ts", ["from \"sharp\"", "readCuratedImportDirectFile(\n                  image.stagedRelativePath"]),
  () => assertContains("lib/curated-archive/prepare-production.ts", ["readCuratedImportDirectFileRange"]),

  // Curated publish: browser does source GET + transform + destination PUT; Vercel signs/finalises only.
  () => assertContains("app/api/admin/curated-archive-import/publish/route.ts", ["sign-image", "createProductionImageUploadUrl", "finalizePublishedProduction"]),
  () => assertNotContains("app/api/admin/curated-archive-import/publish/route.ts", ["publishCuratedProduction(", "publishImageBuffer(", "from \"sharp\""]),
  () => assertContains("app/admin/curated-archive-import/CuratedArchiveImportClient.tsx", ["preparePublishedImage", "sourceUrl", "uploadUrl"]),

  // Vision: pass R2-backed URLs to provider; do not fetch/transform production image bytes in Vercel.
  () => assertContains("app/api/admin/vision/analyse-image/route.ts", ["getProductionImageUrl", "getSelectedWorkImageUrl"]),
  () => assertNotContains("app/api/admin/vision/analyse-image/route.ts", ["from \"sharp\"", "getProductionImage(", "getSelectedWorkObject("]),

  // Legacy heavyweight publish/preview tools must be unavailable on Vercel.
  () => assertContains("app/api/admin/production-preview/route.ts", ["process.env.VERCEL === \"1\""]),
  () => assertContains("app/api/admin/publish-production/route.ts", ["process.env.VERCEL === \"1\""]),
  () => assertContains("app/admin/new-production/page.tsx", ["process.env.VERCEL === \"1\""]),
  () => assertContains("app/admin/bulk-import/page.tsx", ["process.env.VERCEL === \"1\""]),
];

for (const check of checks) {
  check();
}

console.log("Vercel architecture check passed: heavyweight image/file paths are R2/browser-first.");
