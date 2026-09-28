# Steve Gregson Archive — Project Status

Last updated: 28 September 2026

This is the authoritative working handover for the current stevegregson.com / Backstage project.

---

## 1. CURRENT REPOSITORY STATE

Repository:
`~/Documents/stevegregson-archive`

Branch:
`website-redesign`

Current deployed commit:
`12c0c77 Improve production upload form feedback`

At the time this document was created:

- `HEAD` = `12c0c77`
- `origin/website-redesign` = `12c0c77`
- therefore the current website code is committed and pushed.
- the working tree is intentionally dirty because historical curator/recovery work and backup files remain locally.

Do NOT clean, reset, stash, delete, or mass-stage the working tree.

Always stage files explicitly.

---

## 2. HOW WE WORK

These rules are important.

1. Work in small, verified steps.
2. Inspect source before editing it.
3. Do not make speculative changes.
4. Do not touch unrelated files.
5. Never run destructive Git cleanup/reset commands against the existing working tree.
6. Never delete local proofing/archive photographs or backup files without explicit approval.
7. Do not expose or request secrets.
8. Do not initiate or instruct paid API usage, including OpenAI API calls, without explicit approval for that specific paid action.
9. Prefer zero-cost/read-only diagnostics first.
10. After code changes normally run:
   - `git diff --check`
   - `npx tsc --noEmit --pretty false`
11. For changes affecting file/image architecture also run:
   - `npm run check:vercel-architecture`
12. Do NOT use localhost as the acceptance test.
13. Deploy verified changes first, then test the live production site.
14. Avoid long chains of speculative terminal commands. One useful diagnostic/edit at a time.
15. When committing, stage only the files intentionally changed for that job.

---

## 3. LIVE WEBSITE / INFRASTRUCTURE

Primary website:
`www.stevegregson.com`

Hosting:
Vercel

Database:
Neon / PostgreSQL

Image/object storage:
Cloudflare R2

The site has deliberately been moved away from heavyweight image/file processing through Vercel wherever practical.

Architecture check:
`npm run check:vercel-architecture`

Most recent result:
PASS — heavyweight image/file paths are R2/browser-first.

---

## 4. DOMAIN STATE — VERIFIED 28 SEPTEMBER 2026

All relevant Vercel domains currently report Valid Configuration.

Current domain behaviour:

`stevegregson.com`
→ 308 redirect
→ `www.stevegregson.com`

`www.stevegregson.com`
→ production site

`stevegregson-archive.vercel.app`
→ production deployment

Legacy domain:

`stevegregsonphotos.com`
→ 301 permanent redirect
→ `www.stevegregson.com`

The redirect preserves paths.

Verified manually:

`https://stevegregsonphotos.com/some-old-page`
→ 301
→ `https://www.stevegregson.com/some-old-page`

This is intentional because Google still has historical information/URLs associated with stevegregsonphotos.com.

Cloudflare DNS for BOTH:

- `stevegregsonphotos.com`
- `www.stevegregsonphotos.com`

uses CNAME:

`84899170d78afa74.vercel-dns-017.com`

Proxy status:
DNS only

Do not enable the Cloudflare proxy for those records unless the Vercel configuration is intentionally redesigned.

Do not remove the legacy domain from Vercel.

---

## 5. BACKSTAGE AUTH / SECURITY

Backstage/admin authentication exists and protects `/admin` and admin APIs.

Known architecture includes:

- login/logout
- session cookie
- protected admin routes
- login rate limiting
- contact-form rate limiting
- security headers
- noindex behaviour for admin/proofing areas

Historical Safari logout behaviour caused trouble; Chrome logout was confirmed working.

Do not assume an old Safari issue is still current without retesting.

---

## 6. PRODUCTION PHOTOGRAPHY STORAGE

Production images use Cloudflare R2.

Relevant storage/helper areas include:

`lib/publishing/production-image-storage.ts`

Public production image base defaults to:

`https://images.stevegregson.com`

with environment override:

`NEXT_PUBLIC_PRODUCTION_IMAGE_BASE_URL`

Production publishing is designed to upload browser → R2 rather than send heavyweight image bodies through Vercel.

---

## 7. NEW PRODUCTION UPLOADER — CURRENT STATE

Primary component:

`app/admin/new-production/ProductionUpload.tsx`

API:

`app/api/admin/new-production-r2/route.ts`

Recent commit:

`12c0c77 Improve production upload form feedback`

### Changes confirmed live

The Production Information form was previously difficult to read because labels and field values visually ran together.

This has been redesigned.

Current live form has:

- clearly separated labels and controls
- visible input boundaries
- improved spacing
- responsive multi-column layout
- clearer Description field
- Upload & Publish control moved to the right

The redesigned form was visually verified on the live production website.

### Publish-success state

A successful finalisation now sets:

`publishSucceeded = true`

and should display a persistent confirmation panel:

`Production published successfully`

followed by:

`[Production] is now live in the archive.`

If a production URL is returned, a `View production` link is shown.

Choosing another folder resets the success state.

Validation completed before deployment:

- `git diff --check` — PASS
- TypeScript — PASS
- Vercel architecture check — PASS

There was no genuine new production available after deployment, so the final success panel has NOT yet been observed after a real post-change upload.

Do not manufacture a production solely to test this.

Verify it naturally on the next genuine production upload.

---

## 8. CURATED ARCHIVE IMPORT

The Curated Archive importer was built primarily to ingest the historical curated material from Dropbox and Google Drive.

That main curation/import phase is now effectively complete.

The importer is therefore not expected to be used regularly until additional historical material is discovered, for example when old external hard drives are connected and scanned.

A large amount of reliability work was completed around:

- browser → R2 direct uploads
- staged manifests
- R2 verification
- retry handling
- bounded reads
- image previews
- production identity
- metadata editing
- include/exclude controls
- delete controls
- R2 publishing
- preflight performance
- source diagnostics

Recent relevant commits include:

`a06fd79 Optimise curated preflight image lookup`
`e36ca3c Harden curated delete workflow`
`6463ecd Add diagnostics for curated R2 source fetches`
`50b52a9 Retry curated manifest reads from R2`
`81a0fd5 Add curated include exclude and delete controls`
`4869164 Harden curated archive editing and R2 publishing`
`317d68f Fix curated metadata save for direct imports`

Do not restart or redesign the curator simply because old local tooling remains in the repository.

Treat it as a mostly dormant historical-import feature until it is genuinely needed again.

---

## 9. ADDAMS FAMILY

The Addams Family production had previously failed to enter through the curated-import workflow.

It was subsequently uploaded manually.

It is done.

Do not treat Addams Family as an outstanding curated-import task.

---

## 10. GOOGLE DRIVE / DROPBOX CURATION HISTORY

Historical curation work involved Dropbox and Google Drive source material.

Google Drive curation received additional production-boundary protections after mixed-production/source-boundary problems were discovered.

Local `README.txt` is currently modified and contains a historical:

`GOOGLE DRIVE PRODUCTION SOURCE-BOUNDARY GUARD`

handover/procedure.

That README content describes a specific September 2026 recovery/migration operation and should NOT automatically be treated as the current project README or committed blindly.

Historical figures recorded in that local README include:

- Current galleries: 81
- Final selections after stale quarantine: 60
- PASS: 60
- FAIL: 0
- STALE: 0

It also documents stamping existing valid selections with verified source provenance.

Do not rerun historical curation/API operations merely because those instructions exist.

---

## 11. CURRENT INTENTIONAL TRACKED LOCAL MODIFICATIONS

At creation of this document, these tracked files had uncommitted changes:

`.gitignore`

`README.txt`

`scripts/archive-curator/archive-curated-overrides.json`

`scripts/archive-curator/run-all.mjs`

`scripts/google-drive-curator/research-metadata.mjs`

`scripts/google-drive-curator/run-all-metadata.mjs`

These changes have been inspected and are meaningful historical/recovery work.

### `.gitignore`

Adds:

`.google-drive-curator/`

### `README.txt`

Contains the historical Google Drive production-boundary guard instructions.

Do not overwrite it casually.

### `archive-curated-overrides.json`

Contains an added override for:

`13 (June 2025)`

including title, venue, month/year, description and production credits.

### `scripts/archive-curator/run-all.mjs`

Contains deliberate changes including:

- `--status` mode
- completion validation
- improved Phase A budget-stop detection
- corrected failure logging

### `scripts/google-drive-curator/research-metadata.mjs`

Contains recovery/alignment logic that locates the correct curated output using the production identity stored in `final-selection.json`, rather than relying only on a derived directory name.

### `scripts/google-drive-curator/run-all-metadata.mjs`

Contains metadata-alignment validation.

A production marked complete is skipped only when its metadata is actually present and aligned.

Misaligned/missing completed metadata is treated as repair work.

These six files should NOT currently be discarded or bundled into unrelated website commits.

---

## 12. IMPORTANT UNTRACKED LOCAL MATERIAL

There are numerous `.bak` files created during curator/import repairs.

They are intentionally being left alone.

There are also migration/recovery scripts and source snapshots that are not currently committed.

Do not run a blanket:

`git clean`

Do not mass-delete `.bak` files.

Do not use:

`git add .`

for normal feature commits.

Explicitly stage only intended files.

Particularly important:

`content/selected-work.backup-2026-08-30.json`

must be left untouched.

Other untracked material includes curator recovery scripts, migration source JSON, repository-check scripts and historical backup copies.

Presence of these files does NOT mean their associated migration should be rerun.

---

## 13. SELECTED WORK

Selected Work is database-backed.

Repository:

`lib/selected-work-repository.ts`

Categories include:

- production
- rehearsal
- campaign

Selected Work image base defaults to:

`https://selected-work-images.stevegregson.com`

with environment override:

`NEXT_PUBLIC_SELECTED_WORK_IMAGE_BASE_URL`

Historical local backup:

`content/selected-work.backup-2026-08-30.json`

Do not delete or overwrite that backup.

---

## 14. PROOFING

Proofing data has been moved from local JSON to Neon/Postgres.

Known persisted areas include:

- galleries
- settings
- image metadata
- visitors
- favourites
- submitted favourites
- consolidated/definitive selections

Proofing permissions include:

- none
- web
- selected

Selected access requires favourites.

Proofing uses a gallery cookie of the form:

`proofing_<gallery.id>`

Proofing images/download paths have undergone R2 migration work.

Consolidated selection functionality exists, including definitive-image selection and live polling.

Historical Lightroom requirement:

When copying image names for Lightroom search, filenames should be copied WITHOUT extensions and separated by commas.

Example:

`testimage_1234.jpeg`

should become:

`testimage_1234,`

because Lightroom search does not use the extensions effectively.

The client Lightroom control was later removed, so treat this as a requirement to remember if that workflow is reintroduced.

---

## 15. KNOWN / DEFERRED ITEMS

### New Production success confirmation
Implemented and deployed.

Still needs natural end-to-end confirmation on the next genuine upload.

### Curated Archive
Main Dropbox/Google Drive import phase is complete.

Leave dormant until new historical sources need importing.

### Historical local curator/recovery changes
Preserve.

Do not mix them into unrelated commits.

They may later deserve deliberate archival commits/documentation, but no decision has yet been made.

### Broader launch/maintenance audit
Security, accessibility, SEO and general site-health checks have been discussed historically.

Do not assume every historical audit item is still outstanding.

Inspect current production state before changing anything.

### Proofing download behaviour
Historical outstanding work included direct single-image WebP downloads and R2-backed download-all behaviour.

Current implementation should be inspected before assuming these remain unresolved.

### Admin production editing
Historical hero-image editing problems existed.

Current implementation should be inspected/tested before assuming the old problem still exists.

---

## 16. WHAT NOT TO DO NEXT

Do NOT:

- restart the historical Dropbox/Google Drive curation automatically
- rerun paid AI curation/research
- clean the repository
- delete backup files
- reset tracked local changes
- assume every historical bug is still present
- test website changes only on localhost
- make DNS changes now that the domains are healthy
- remove `stevegregsonphotos.com`
- proxy the legacy Vercel CNAMEs through Cloudflare
- stage all current changes together

---

## 17. RECOMMENDED NEXT APPROACH

The historical migration/import phase is largely behind the project.

Future work should now prioritise the live website and Backstage as an ongoing production system.

Before taking on an old outstanding item:

1. inspect the current implementation;
2. establish whether the issue still exists;
3. make the smallest necessary change;
4. run validation;
5. explicitly stage only relevant files;
6. deploy;
7. test on the live site.

The New Production form work is complete for now.

The legacy stevegregsonphotos.com DNS/redirect issue is complete.

The next feature/maintenance task should be chosen based on current live-site value rather than historical migration backlog.
