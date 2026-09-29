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
  // Selected Work public galleries must render lightweight preview objects.
  () => assertContains(
    "components/SelectedWorkGallery.tsx",
    ["getSelectedWorkPreviewUrl"],
  ),
  () => assertContains(
    "components/SelectedProductionGallery.tsx",
    ["getSelectedWorkPreviewUrl"],
  ),
  () => assertContains(
    "lib/selected-work-storage.ts",
    ["selectedWorkPreviewStorageKey", "__previews"],
  ),

  // Public photography policy: browser-facing photographic uploads
  // must be WebP before they reach R2.
  () => assertContains(
    "lib/selected-work-storage.ts",
    [
      'contentType = "image/webp"',
      'ContentType: "image/webp"',
    ],
  ),
  () => assertNotContains(
    "lib/selected-work-storage.ts",
    [
      'contentType = "image/jpeg"',
      'ContentType: "image/jpeg"',
    ],
  ),
  () => assertContains(
    "app/admin/selected-work/SelectedWorkEditor.tsx",
    [
      '"image/webp"',
      "webpBlob",
      "maximumWidth",
    ],
  ),
  () => assertNotContains(
    "app/admin/selected-work/SelectedWorkEditor.tsx",
    [
      '"Content-Type":\n                          "image/jpeg"',
      "body: file,",
    ],
  ),
  () => assertContains(
    "lib/publishing/production-image-storage.ts",
    [
      'ContentType: "image/webp"',
      "max-age=31536000",
    ],
  ),

  () => assertContains("next.config.ts", ["unoptimized: true"]),
  () => assertContains(".vercelignore", ["public/images/productions/", "public/images/selected-work/"]),

  // Proofing upload: browser -> R2, Vercel only signs/commits metadata.
  () => assertContains("app/api/admin/proofing/upload/route.ts", ["action === \"presign\"", "action === \"commit-batch\"", "createProofingImageUploadUrl"]),
  () => assertNotContains("app/api/admin/proofing/upload/route.ts", ["request.formData()", "arrayBuffer()", "from \"sharp\"", "putProofingImage("]),
  () => assertContains("app/admin/proofing/[id]/ProofingUpload.tsx", ["uploadUrl", "method: \"PUT\"", "const concurrency"]),

  // Proofing entry/watermark/pre-entry page must avoid full gallery image loads.
  () => assertContains(
    "app/api/proofing/enter/route.ts",
    ["getProofingGalleryBaseBySlug"],
  ),
  () => assertNotContains(
    "app/api/proofing/enter/route.ts",
    ["getProofingGalleryBySlug("],
  ),
  () => assertContains(
    "app/api/proofing/watermark/route.ts",
    ["getProofingGalleryBaseBySlug"],
  ),
  () => assertNotContains(
    "app/api/proofing/watermark/route.ts",
    ["getProofingGalleryBySlug("],
  ),
  () => assertContains(
    "app/proofing/[slug]/page.tsx",
    [
      "getProofingGalleryBaseBySlug",
      "getProofingGalleryImageBySlug",
      "Only authenticated gallery visitors need",
    ],
  ),

  // Proofing notes and annotations use metadata-only or single-image lookups.
  () => assertContains(
    "app/api/proofing/image-note/route.ts",
    [
      "getProofingGalleryBaseBySlug",
      "getProofingGalleryImageBySlug",
    ],
  ),
  () => assertNotContains(
    "app/api/proofing/image-note/route.ts",
    ["getProofingGalleryBySlug("],
  ),
  () => assertContains(
    "app/api/proofing/image-annotation/route.ts",
    [
      "getProofingGalleryBaseBySlug",
      "getProofingGalleryImageBySlug",
    ],
  ),
  () => assertNotContains(
    "app/api/proofing/image-annotation/route.ts",
    ["getProofingGalleryBySlug("],
  ),

  // Consolidated proofing polling/toggles must not load every gallery image.
  () => assertContains(
    "app/api/proofing/consolidated-favourite/route.ts",
    [
      "getProofingGalleryBaseBySlug",
      "getProofingGalleryImageBySlug",
    ],
  ),
  () => assertNotContains(
    "app/api/proofing/consolidated-favourite/route.ts",
    ["getProofingGalleryBySlug("],
  ),

  // Proofing favourite toggles must not load every image in the gallery.
  () => assertContains(
    "app/api/proofing/favourite/route.ts",
    ["getProofingGalleryImageBySlug"],
  ),
  () => assertNotContains(
    "app/api/proofing/favourite/route.ts",
    ["getProofingGalleryBySlug("],
  ),

  // Public proofing image delivery must query only the requested image.
  () => assertContains(
    "app/api/proofing/image/route.ts",
    ["getProofingGalleryImageBySlug"],
  ),
  () => assertNotContains(
    "app/api/proofing/image/route.ts",
    ["getProofingGalleryBySlug("],
  ),

  // Single proofing downloads must query only the requested image.
  () => assertContains(
    "app/api/proofing/download/route.ts",
    ["getProofingGalleryImageBySlug"],
  ),
  () => assertNotContains(
    "app/api/proofing/download/route.ts",
    ["getProofingGalleryBySlug("],
  ),

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

  // Curated Archive editor: normal folder-based editing must stay on direct R2 paths.
  () => assertContains(
    "app/api/admin/curated-archive-import/edit/route.ts",
    [
      "loadDirectCuratedProduction",
      "getDirectCuratedSourceIndexes",
      "typeof body.folder === \"string\"",
    ],
  ),
  () => assertContains(
    "app/admin/curated-archive-import/edit/[production]/page.tsx",
    [
      "folderName",
      "reset: \"images\"",
      "selectedIndexes:",
      "&folder=${encodeURIComponent(",
    ],
  ),

  // Public production cards use dedicated lightweight WebP derivatives.
  () => assertContains(
    "lib/publishing/production-image-storage.ts",
    [
      "createProductionCardImageUploadUrl",
      "__cards",
      'ContentType: "image/webp"',
    ],
  ),
  () => assertContains(
    "app/admin/new-production/ProductionUpload.tsx",
    [
      "createProductionCardBlob",
      "cardUploadUrl",
    ],
  ),
  () => assertContains(
    "app/admin/curated-archive-import/CuratedArchiveImportClient.tsx",
    [
      "createProductionCardBlob",
      "cardUploadUrl",
    ],
  ),
  () => assertContains(
    "app/archive/ArchiveExplorer.tsx",
    [
      "getProductionCardImageUrl",
    ],
  ),

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
  () => assertNotContains("app/admin/new-production/ProductionUpload.tsx", ["JSZip", "/api/admin/production-preview", "/api/admin/publish-production"]),
  () => assertContains("app/admin/new-production/ProductionUpload.tsx", ["/api/admin/new-production-r2", "image/webp"]),
  () => assertContains("app/api/admin/new-production-r2/route.ts", ["createProductionImageUploadUrl", "finalizePublishedProduction"]),
  () => assertContains("app/admin/bulk-import/page.tsx", ["process.env.VERCEL === \"1\""]),
];

for (const check of checks) {
  check();
}

console.log("Vercel architecture check passed: heavyweight image/file paths are R2/browser-first.");
