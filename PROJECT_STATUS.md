# Steve Gregson Archive — Project Status (handover)

Last updated: 27 November 2026, 14:45 (London)

This is the short handover a new chat should read first. Keep it short:
it is read at the start of every chat, so length costs usage. Older, longer
versions are in git history; deep background is in PROJECT-CONTEXT.md.

**Claude: update this file at the end of every job** (what changed, what's
live, what's waiting). Commit it with the job's own changes, so it doesn't
cost an extra Vercel build.

---

## How Steve works (always follow)

- Steve is a UK theatre photographer, not a developer. Plain English, no
  jargon, short reports.
- Website changes: push to the test branch `feature/backstage-transfers`
  first (Vercel preview). Only merge to the live branch `website-redesign`
  when Steve says **"go live"**. Always tell him when something is waiting
  for "go live".
- Minimise Vercel builds (batch changes).
- Any Google check: Google UK only.
- Never enter passwords, never put secrets in Vercel's secret store, never
  paste keys in chat. No paid services/accounts (no Apple Developer).
- Never spend on the OpenAI API without Steve's approval for that run.
- Stage files explicitly; never reset/clean/stash Steve's working tree.
- Big file copies on his Mac: give Steve a Terminal command to run himself
  rather than looping copy steps from Claude (saves usage; Claude's
  background processes on the Mac stop when each command ends).
- **DISK SPACE RULE:** before giving Steve ANY copy command, check free
  space (`df -h ~`) and the size of what's being copied; it must fit with
  a 50 GB margin, or copy in smaller batches. Copying from Dropbox into
  Storage needs space for BOTH copies until uploaded and cleared. On 14 Oct
  a copy took the Mac down to 15 GB free — must not happen again.
- Checking the Mac from a chat: connect `~/Steve Gregson Storage` and
  `~/Library/Logs` (uploader log: `Steve Gregson Storage.log`), plus
  `~/Library/CloudStorage/Dropbox/<CLIENT>` to compare Dropbox with the log.
  `~/Library/Application Support` can't be connected. Claude's Mac shell is
  a Linux VM: it can't run `df`/`tmutil` — ask Steve for those.
- **Once Mac copies are cleared, a plain rsync re-copies everything** (the
  files are gone, so it can't compare). Compare Dropbox with the log's
  `Uploaded <CLIENT>/...` lines and copy only what's missing with
  `rsync --files-from`.

## Repo, branches, checks

- GitHub: `stevegregsonphotos/stevegregson-archive`. Live branch
  `website-redesign` (Vercel production). Test branch
  `feature/backstage-transfers`. Live is fast-forwarded from the test work:
  `git push origin HEAD:website-redesign` once Steve says go live.
- GitHub's default branch is now `feature/backstage-transfers` (Steve
  changed it 22 Oct), so new chats open here. `main` is old and unused; it
  only holds a signpost pointing here.
- Next.js 16 App Router (`proxy.ts`, see AGENTS.md), Vercel Hobby, Neon
  Postgres, Cloudflare R2 (site images), Backblaze B2 (Storage/Transfers,
  bucket `stevegregson-client-archive`), Resend email, Cloudflare DNS.
- Before pushing: `npx tsc --noEmit`, eslint on changed files, and for
  bigger changes `OPENAI_API_KEY=x npm run build` (runs the architecture check too) ("DATABASE_URL not
  configured" at prerender is expected in the sandbox).
  Pre-existing lint errors: `CuratedArchiveImportClient.tsx` (setState in
  effect, lines ~703/791) — not ours.
- Steve's Mac copy of the repo is updated with `git pull` (easiest: open
  Curate Production, press Control+C, type `git pull`).
- Domains: www.stevegregson.com (site), transfers.stevegregson.com (client
  downloads/uploads), storage.stevegregson.com → Backstage Storage,
  stevegregsonphotos.com → 301 to www (keep it; DNS-only in Cloudflare).

## What's built (all live unless noted)

- **Storage** (Backstage › Storage): Dropbox-style file store on B2. Photo
  previews (640px thumbs), Deleted files (30 days), Share with client
  (live folder links, per-person activity), Request files (clients upload
  into `Received/`).
- **Transfers**: WeTransfer-style sending, progress strip under the menu
  + in the Transfer button, personal links per recipient, "Who's downloaded", first-download
  email to Steve. There is no "sent" confirmation email (by design).
- **Mac app "Steve Gregson Storage"**: `~/Steve Gregson Storage` uploads
  automatically; copies (not moves) from Dropbox/Drive/iCloud; clears Mac
  copies after OFFLOAD_DAYS (config in `~/Library/Application Support/
  Steve Gregson Storage/config`). **4 Nov: it was actually 0** (left from
  the Mountview move), so files were cleared ~30 min after upload (Babies
  28–29 Oct, MUSEUM 4 Nov). Steve set it to **2** (he wants 24–48 h).
  LIVE 4 Nov: any setting below 1 day is ignored (uses 2) and logged;
  keeps ALL
  folders on the Mac when files are cleared (Steve's rule: production
  folder names must stay); mirrors
  folders both ways; updates itself daily from the live site
  (`public/mac/agent.zsh`, `install.sh --update`).
- **Backstage sign-in**: Touch ID / Face ID passkeys, password sign-in
  switched off (Vercel `BACKSTAGE_ALLOW_PASSWORD=1` re-enables it).
- **Production curator** (`scripts/production-curator.mjs`, Mac app
  "Curate Production", output `~/Pictures/Curated/<Show>`):
  - Free route: prepares contact sheets → Steve asks Claude (Mac linked)
    to write `pass-2.json` + `metadata-research.json` per
    `CLAUDE-CURATION-BRIEF.md` → "Finish a Claude curation".
  - Paid route (OpenAI): approve with **y**.
  - Reads straight from Dropbox/Drive (stops only if a folder is >40 GB).
  - LIVE 4 Nov (Mac-only; Steve's Mac repo `~/Documents/stevegregson-archive`
    is on `website-redesign`, so curator changes only reach it after go live):
    opening window now reads Prepare (free) › Finish › Full automatic
    (paid) with clearer step-by-step wording; after Prepare it copies the
    message for Claude to the clipboard and shows a "what to do now" box
    (no longer opens Finder, which led Steve to try uploading the folder:
    the chat refuses ~300 files). Claude reads ~/Pictures/Curated via the
    linked Mac (request folder access, stage contact sheets to view).
  - 4 Nov curated: MUSEUM (Mountview, Nov 2026, 36, hero #0210); Babies
    double cast as "Babies - Backpacks Company" (36, hero #0130) and
    "Babies - Blazers Company" (37, hero #0113). DOUBLE CASTS: put the cast
    in the title, or Curated import merges them (it groups by title+venue+
    month+year). Steve deleting the merged "Babies" and re-importing.
  - Takes venue + show + date from `Client / Show - Month Year / … / Web`
    however deep; "In Rehearsal" folders get that suffix.
- **Curated archive import** (Backstage › Curated import): uploads the
  curator output and publishes productions (reads each file before upload
  to avoid Safari "Load failed").
- **X (Twitter) removed — LIVE 1 Nov:** taken out of the site's hidden profile lists (`SAME_AS` in `app/layout.tsx` and `/llms.txt`), and from the Google Business Profile social links (Google review pending). Steve doesn't use X and can't log in; don't add it back. Went live together with the three 29 Oct items below (People search, Mac folder fix, Storage folder Download), so those are LIVE too.

## Waiting / in progress

- **LIVE 27 Nov ~14:45: Transfers page Apple Passwords popup fix.** Every time the
  Transfers page opened, Safari's Apple Passwords offered Steve's saved
  "steve / stevegregson.com" login on "Email to". Cause: the optional
  transfer Password box was `type="password"`, so Safari treated the form as
  a login. Fix: that box is now `type="text"` shown as dots via CSS
  (`.masked`, `-webkit-text-security: disc`), plus `autoComplete="off"` and
  password-manager ignore attributes on Email to / Your email / Password.
  Files: `TransferWorkspace.tsx`, `RecipientInput.tsx`, `workspace.module.css`.
  tsc + eslint clean. No visible change apart from the popup going.

- **LIVE 27 Nov ~14:45: "Client page photos" picker now works for Storage
  sends.** Steve went live without checking the preview; he'll test on live.
  STILL UNKNOWN: whether the light copies get made for Storage photos (B2
  browser read). If his live test shows defaults instead of his picks, the
  light copy failed — check B2 CORS allows GET from www.stevegregson.com. Sending
  straight from Storage never showed the picker (it only listed Mac-added
  files). New `api/admin/transfers` actions: `archive-images` (photos in the
  Storage selection, JPEG/PNG/WebP, sorted) and `backdrop-source` (view URL
  for a transfer photo while still "uploading"). Send page: picks are tokens
  `q:<queue index>` / `s:<storage key>`, Storage photos show their 640px
  Storage thumb; on send, attach-archive's returned files map key → file id,
  then `set-backgrounds` in pick order + web-sized copies (Storage ones read
  via presigned URL). Steve: must never slow the client page, so a Storage
  pick is only used if its light copy was made; else left out (defaults). Same
  look as before; the section just appears for Storage sends too.

- **LIVE 23 Nov ~14:05: Storage "Move to" missed folders + 500-item limit.**
  Kings Head › Dick Whittington Panto › Promo Shoot has 714 loose photos
  (uploaded 13 Nov, cleared off the Mac 2 days later as designed — Steve's
  old proofing export, not needed). Steve made a new folder to move them
  into, but Move only read the first 200 items (folders + files A–Z), so a
  folder sorting after "DickWhit…" never showed. `browseMover` now follows
  `nextCursor` for all pages. Workaround on live until then: name the
  folder so it sorts first (e.g. starting with a number).
  ALSO: moving/deleting 714 at once failed "Choose 500 items or fewer"
  (`normaliseItems` cap). Now `planInBatches` in StorageBrowser plans +
  applies 100 items at a time with "Moving N of M" progress (move and
  delete); a retry after a stop skips items already moved.
  **LIVE 23 Nov ~14:52:** (1) moving 714 was very slow and
  seemed to stall after 100: `planMove`/`planDelete` checked each file one
  after another (~4 B2 calls each + a folder-marker PUT per file). Now 8 at
  a time (`eachLimit`), marker once per folder; `applyPairs` 5 → 8 at once.
  (2) Select all missed hundreds: it only took what had loaded so far
  (rest of the folder arrives 200 at a time in the background). Now ticking
  it while loading sets `wantAll` (ref + state): each arriving page is added
  to the selection; bar says "still loading the rest (N in all)…" and
  Move/Delete/Send wait until it's all there.

- **21 Nov: Godspell re-curated STRAIGHT FROM STORAGE (no Mac, no code
  change).** Old page "Godspell" (static `content/productions/godspell.ts`,
  18 photos, both casts) → two new imported pages "Godspell - Genesis
  Company" (40, hero GODSPELL-Genesis-394) and "Godspell - Revelation
  Company" (40, hero GODSPELL-Revelation-378), Mountview, June 2026, credits
  from godspell.ts, alt text per photo. Source: Storage
  `MOUNTVIEW/GODSPELL - June 2026/Web` (797: Genesis 1–403, Revelation
  1–394, many named `-2`; no duplicates). METHOD (reusable for any show in
  Storage): in Chrome on Backstage, list the folder via
  `/api/admin/storage?path=`, show 640px previews
  (`/api/admin/storage/thumb?key=`) as contact sheets in the page, pick;
  then on Curated import fetch the picked Web files (storage `download`
  action → presigned URL), build `Collection/<Production>/final-selection.json`
  + `metadata-research.json` + `metadata-proposed.txt` +
  `selected-web-staging/NNN__NNNN__<name>.jpg` as File objects
  (defineProperty `webkitRelativePath`), put them on the folder input via
  DataTransfer + `change` event, then Import all ready (override
  `window.confirm` first: native dialogs freeze the Chrome extension).
  LIVE 21 Nov ~12:45: imported 2, failed 0; pages
  `/productions/godspell-genesis-company-mountview-june-2026` and
  `…-revelation-company-…` (hero + 39 each, credits + alts checked).
  Steve to: check both pages, then delete the old 18-photo "Godspell"
  (`/productions/godspell`, listed in Backstage › Productions) himself.

- **LIVE 20 Nov ~20:30: stuck "Still updating from your Mac" banner fixed.**
  After the 19:18 rename the banner + "371 files left" stayed for an hour
  (files were fine: Mac vs Storage names+sizes identical). Causes: (1) the
  run's final "idle" report was sent in the background and macOS kills it
  when the launchd job exits → Backstage kept the last mid-run report;
  (2) renamed files ("moved") weren't counted as done. Fix: agent.zsh
  `write_status final` sends synchronously (curl 20 s) at the end of a run
  and of a paused run; done = uploaded + moved. Backstage: busy-client
  ignores busy reports older than 15 min (`BUSY_REPORT_MAX_AGE_MS`);
  MacProgress shows "Last heard from the Mac N min ago" for mid-run reports
  older than 15 min. Mac needs `install.sh --update` (or daily self-update).
  Also 20:15: told Steve all Frozen sends were downloaded; drafted an email
  asking Mountview to discard the two Sumarr sends; Steve to resend clean
  ones from Storage (full res "Full-…Sumarr" 388, web res/Sumarr 388).

- **20 Nov ~17:40: Storage duplicates fix + Cancel transfer + real folder
  counts + Email-to Enter fix — LIVE 20 Nov ~18:30 (Steve said go live;
  includes everything below incl. the 18:25 additions). Steve sent a client a
  19 GB folder full of duplicates (Storage said 199 files until Load more).
  CAUSES (from his log): (a) `mirror_gone` safety cap ">300 and >50% gone →
  don't mirror" fired 20 Nov 11:58 when he renamed/moved all of Reefer
  Madness into Web/Full in Bridge (1,307 files) → old copies forgotten;
  (b) server `trash` failed the WHOLE batch of 50 when one file was missing
  ("… no longer exists", Frozen 18–19 Nov, `planDelete` throws); (c) an
  upload committed while the file changed/renamed was never recorded on
  the Mac (orphan). FIXES: agent.zsh — cap removed; mirror when the file's
  folder still has files in it or its sub-folders (`HASFILES`), else keep;
  confirmed uploads always recorded; new history files in the support
  folder (`uploaded-paths.txt`, `cleared-paths.txt`, seeded once from the
  log); new **leftover check** (`leftovers()`): Storage files directly in
  folders that still have Mac files, uploaded by this Mac (history), not on
  the Mac, not cleared → trash (server re-checks ours + unchanged). Touched
  folders each run, all daily. FIRST pass only writes the tidy report
  (`~/Library/Logs/Steve Gregson Storage - tidy report.txt`) + notifies;
  `--request tidy-apply` trashes it and touches `leftovers-reviewed`, after
  which it's automatic. Dry run from Steve's real log/folder 20 Nov: ≤2,048
  old copies (Frozen full res 731, web res 731 + Sumaar 388, Reefer root
  188, 10 KHT "-Edit.tif" — check those with Steve). API `api/mac`: new
  `files` action (direct files of a folder), `trash` per file + de-duped.
  Rehearsed the zsh logic with stubs (rename into sub-folders, empty folder
  kept, cleared/Backstage-added files untouched, report then auto).
  **Cancel transfer**: detail page "Cancel transfer" (confirm) → `disable`;
  red banner with **Turn back on** (`enable`, only if not expired/files
  kept) and **Delete its files too** (`cancel-delete`: disable + delete
  uploaded copies + files_purged_at; record kept so the link still says
  cancelled; Storage files untouched). List pill "Cancelled". Client page:
  `PublicTransferView.cancelled`; popup "This transfer has been cancelled …
  Contact Steve / Close" on opening, and download APIs return 410
  `code: "cancelled"` → same popup if the page was already open.
  **Storage counts**: GET `?totals=1` → `countClientArchiveFolder` (names
  only, 1,000/request) → "389 files · 9.6 GB — showing 200 so far" + **Load
  all**. **Email to**: picking (Enter/click) closes the list and Enter
  moves to Title; list reopens only when typing.
  ALSO: sending a Storage folder included its hidden `.folder` markers
  (0 B, seen in Steve's Frozen transfer) — `listClientArchiveFilesRecursive`
  now skips them. Steve's 16:01 "Full Res - Everyone's Frozen!" transfer
  (1,463 files incl. old Sumaar names) was already fully downloaded 16:03.
  ALSO (Chrome check 17:55): Storage only sorted/selected the first 200
  loaded (Sumaar showed "199 files", 1, 2, 10, 11…) → `load()` now pulls
  the remaining pages automatically for folders ≤3,000 items (page usable
  meanwhile); and the address bar now follows the open folder (`?path=`),
  so refresh stays put. Live list shows today's Frozen sends with dupes:
  "Web - Sumarr Frozen" 777 files (≈388 real), "Everyone's Frozen" 1,463.
  ALSO (18:10, Steve: needs to rename/sort folders without breaking
  things): **renames/moves on the Mac now follow into Storage without
  re-uploading.** agent.zsh `upload_pass` builds `GONE_BY_KEY`
  (size:md5 → old path of tracked files no longer on the Mac); `upload_one`
  asks `api/mac` `move` (only if this Mac's record + unchanged etag, target
  free; uses `applyPairs`) before presigning; `collect` forgets the old name,
  keeps its upload time, builds `DIRMAP` (old folder → new folder). After the
  uploads, a folder whose photos all went to one new folder and that's gone
  from the Mac → `merge-folder` (moves everything left in the old Storage
  folder, e.g. cleared photos, never overwrites; shares/requests follow),
  then `remove-empty-folder` up the old path; renamed show folders are
  inferred from their sub-folders. `mirror_gone` now sends `exact:true`
  (server won't guess a moved copy to trash). Rehearsed with stubs (rename
  "Frozen - Novmber" → "November" incl. cleared photos). Renamed AND edited
  files still upload new + trash old. Storage-side renames do NOT follow
  onto the Mac — advise: sort on the Mac while photos are there; sort in
  Storage only for shows already cleared off the Mac.
  CHECK 18:15 (Steve worried about today's sends): every Transfer since
  10 Nov read via `/api/admin/transfers`. GSA (Reefer Web 389, Full 389,
  GIF) and Rose Bruford (Jekyll & Hyde 270) CLEAN — 1..N, no repeats, one
  naming pattern. Only Mountview Frozen sends have dupes/.folder. Storage:
  RB Jekyll full res 270 + TOAD full res 272 clean (live share of Jekyll
  folder to maisie.laurie.newman@gmail.com OK); GSA Reefer Web/Full 389
  clean but 193 old root copies left in "Reefer Madness - November 2026"
  (not in any transfer) — leftover check will list them.
  ADDED 18:25 (live with the rest): (1) **TOAD transfer kept failing** when
  picked from the Mac (Vercel Hobby keeps 1 h of logs, so cause unproven):
  a picked file changed after picking (Bridge edit) can't be read → worker
  PUT "network" ×4 → "check your internet" and "Back to try again" reused
  the stale picks. Now `changedSincePicked()` reads 1 byte of every picked
  file before creating the transfer (TransferWorkspace) and in
  `uploadQueue`; clear message + queue cleared; failure path re-checks
  readability. (2) **"Still updating from your Mac"**: agent.zsh reports
  `busyFolders` [{path, files}] in status (BUSY built per upload pass,
  incl. settling/failed files; paused runs too); `cleanMacStatus` keeps
  it; `lib/mac/busy-client.ts` `macBusyFor(paths)`; Storage shows an amber
  banner for the open folder (polls 20 s) and confirms before Send as
  transfer; Transfers confirms before sending a Storage selection.
  18:35 Steve updated the Mac; leftover check found 1,307 old copies
  (12 GB: Frozen full res 731, web res/Sumaar 388, Reefer root 188 — all
  old names, OK'd). 18:42 he ran tidy-apply → **every trash batch timed
  out** (Mac api() waits 60 s; my per-file sequential trash made 50 files
  take >60 s; curl --retry resent batches). FIX (commit after 18:45, on
  test branch, waiting go live): server `trash` checks 8 at a time, plans
  each file separately (8 at a time), then one `applyPairs` pass; agent
  `api_slow` (240 s, no retry) for trash, batches of 25, interrupted
  tidy keeps the report + `tidy-apply-pending` → resumed at the start of
  `leftovers()` next run. LIVE ~18:52 (Steve said go live); Mac updated
  19:06. Old run had already finished tidy 19:02 ("moved 1035", rest went
  through despite timeouts). Checked Storage 19:10: Frozen full res 731
  (all Full-…), web res/VETR 343, web res/Sumaar 388 Sumarr + 2 old;
  Reefer root 5 loose (340–343, 382; uploaded mid-rename 11:57, not in
  history). 19:15 Claude moved those 7 to Deleted files via Backstage API
  (Steve OK'd). All clean. 19:18 Steve renamed "Sumaar" → "Sumarr" in
  Finder: **first real folder rename WORKED** — 371 "Moved in Storage",
  17 logged "Uploaded" (Storage total bytes identical before/after, so
  almost certainly the move went through but the reply was slow and the
  presign then said "done"; `upload_one` logs "Uploaded" even for done —
  could reword), merge-folder 0/0, old Sumaar removed. Storage web res =
  Sumarr (388, 1–388) + VETR. Amber banner showed during renames (counts
  renames as "to do") — expected. Took ~5 min for 388 (moves one by one,
  8 at a time). Status commit
  NOT pushed (Steve low on Vercel deployments) — goes with the next push.

- **LIVE 20 Nov ~13:30: Pause uploads + faster Transfers when the tab is
  in the background** (Steve: Mac uploads hogged the line so transfers
  failed/crawled; 1.1 GB transfer 34% in 11 min ≈ 0.5 MB/s vs ~10 MB/s line).
  (1) **Transfers/Storage browser uploads** now run in a dedicated worker
  (`public/transfer-upload-worker.js`, 6 PUTs at once, progress ≤4/s;
  `uploadQueue` in `lib/transfers/upload-client.ts` signs the next batch
  ahead, commits batches in order while later ones upload, re-signs a
  file after 2 failed tries, max 4; holds a Web Lock). Old in-page path
  (3 at once) kept as fallback if the worker won't start. Cause: browsers
  throttle hidden tabs' page code, stretching the gap between files.
  Tested with a fake storage server in Chromium (57 files, failures,
  fallback) — not yet timed on Steve's real line/Safari.
  (2) **Pause** (`agent.zsh --pause-until <epoch|0>` / `--resume`):
  writes `paused` in the support folder, stops the run + this app's curls,
  kickstarts a run that reports state `paused` (+ `pausedUntil`, waiting
  count) and starts `--pause-watch` (own session via perl setsid; every
  60 s: time up → resume; `api/mac` `pause-check` → Backstage Resume; keeps
  status.json fresh). Hourly runs also respect/expire it. Menu bar (MB_VERSION
  6, NOT compiled here — check log for "Menu bar icon" after update):
  Pause uploads › 1 h / 3 h / until 08:00 / until I resume; paused = orange
  pause badge, "Resume uploads now", "Pause for longer". Backstage › Storage ›
  Mac app shows "Uploads paused until …" + **Resume uploads now**
  (`mac-resume` → `mac_devices.resume_requested_at`, cleared once the Mac
  isn't paused). DB stays awake while paused (1 call/min). Rehearsed on
  Linux with shims + fake server: pause, paused run, Backstage resume,
  timed expiry, manual resume. CONFIRMED on Steve's Mac 13:23: installed
  via `install.sh --update`, `--pause-until 0` paused + notified, menu bar
  rebuilt 13:23:46 and shows Resume / Pause for longer.
- **20 Nov: Web exports too big.** Recent Web JPEGs are near-max quality:
  Reefer Madness (GSA) 3000×2000 ~2.8 MB, Frozen 2048px ~1.8 MB. Told Steve:
  Lightroom Web preset Quality 75–80, long edge 2048, 72 ppi, Screen/Standard
  sharpening, sRGB (~0.4–0.7 MB). Full preset unchanged.

- **LIVE 19 Nov ~09:25: Download photos on Productions › Edit**
  (Steve OK'd mockup; a director asked for a show's website photos). Gold
  button in the editor header (`DownloadPhotos.tsx`) → panel: **Full res**
  or **Web res**, one zip. Website keeps only 2560px WebP copies, named
  `hero-`/`NN-` + slug of the ORIGINAL Web file name, so
  `lib/production-download/match.ts` pairs them with Storage files (size
  words FullRes/WebRes ignored; else unique frame number; double casts
  pick the folder nearer the title). API `/api/admin/production-download`
  (`match`: finds the show folder by title/year/month + venue≈client, two
  levels + year folders, or Steve's chosen folder; `folders`: picker).
  Full = Storage only (missing ones left out, says how many). Web = all
  in Storage → streamed zip (`transfer-zip-sw.js`, like Storage folder
  Download); otherwise JSZip in the page: Storage Web files + website
  copies converted to JPEG 0.92, then "Ready — save zip" link (Safari).
  Zip keeps Steve's file names (Finder sorts by name, not gallery order).
  Tested: matcher unit test, panel rendered with mock data (screenshots).
  NOT tested for real: preview uses the `client-archive-preview` Storage
  area (empty), and R2 CORS may not allow the preview domain — real test
  only after go live. Steve to try it on the director's show.

- **LIVE 18 Nov ~21:30: Send files card shows progress like WeTransfer**
  (Steve saw mockups, said go live). Steve: after pressing Transfer the
  card looked unchanged, so he thought it wasn't working. Now the card body
  is replaced by `SendProgressPanel.tsx` while sending (gold ring + big %,
  "Uploading N of M files", GB done, title + recipient, "Keep this tab
  open"; spins "Starting…" first). After: green tick "Transfer sent" +
  link (Copy / Open) + "Send another" (back to the form); failure: orange
  "!" + reason + "Back to try again" (files stay selected). Strip × also
  returns to the form. Styles at end of `workspace.module.css`. No Cancel
  button. Test + live branches both at this commit.

- **LIVE 18 Nov ~20:10: new default gallery layout + newest import first
  in its month** (Steve: "just do it", skipped checking the preview; this
  status commit pushed to live only — fast-forward the test branch with
  the next job). Steve saw mockups (Babies, TOAD, Mockingbird 1) and asked
  to fix every gallery. Phones: one photo per row; LIVE 20:20 (Steve
  approved from a mockup, pushed to live only): portraits on phones at 70%
  width, centred (`.curated-production-row-shot-portrait`, set when shape
  < 1; ≈ same area as a full-width landscape). Desktop unchanged.
  (1) **Balanced rows** is the new default (`balancedRows()` +
  `landscapeEndingOrder()` in `lib/production-gallery-layouts.ts`,
  rendered in `ProductionGallery.tsx` with the editorial row markup,
  `.curated-production-gallery-balanced` in globals.css): rows of 2–3 by
  photo shape (target sum 2.6), first photo + a landscape ~every 8 on its
  own row (≤80vh), nothing cropped. EVERY row gallery (balanced AND
  editorial) ends on a lone centred landscape (Steve's request): if the
  order ends on a portrait, the latest landscape moves to the end (viewer
  follows). Old "As set per photo" (each photo alone, staggered) is
  RETIRED: stored `per-photo` reads as default; per-photo layout buttons
  and bulk "Set layout" removed from Backstage Photos (image.layout data
  kept). Hand-picked presets (TOAD = editorial) unchanged. Also fixed:
  editorial single photos ignored the screen-height cap (inline flexGrow),
  e.g. TOAD portrait 1714 px tall. Tested: SSR of the real component +
  globals.css with Mockingbird's 35 shapes (1440/390), then the same rows
  injected into the live page in Chrome.
  (2) **Curated imports go to the top of their month by date.** Shows
  only have month+year, so same-month shows tied (TOAD landed 5th/6th).
  `prepareCuratedProduction` now returns `processedAt` = latest `modified`
  of the chosen photos in final-selection.json (Steve's export/Bridge
  date; capture dates are stripped and he won't export full metadata).
  Publish route calls `placeProductionWithinMonthByProcessedDate()`
  (`productions.processed_at` timestamptz, auto-added): newest first,
  above undated same-month shows, renumbers `archive_position`; Earlier/
  Later arrows still work. Rehearsed on local Postgres. TOAD itself was
  imported before this: Steve to press Move earlier.
- **18 Nov curations (free route):** Frozen (Mountview, Sumarr cast, 53
  photos, hero #0218, showstoppers first then show order); TOAD (Rose
  Bruford, 34, hero #0040, published). Frozen re-run Finish → Delete from
  upload → re-upload. Archive lists two Frozen pages ("Disney's Frozen"
  and "… Sumarr Cast") with no gallery seen — Steve to check.

- **LIVE 18 Nov ~14:25: Harry's card fix.** (Status commit pushed to live
  only — fast-forward the test branch with the next job.) Steve
  couldn't find the designer's (Harry, Dick Whittington Promo - KHT) 37
  approvals: his own visitor card said "0 photographs selected" (it counts
  favourites only) and the Each person rows started closed. Now: Each
  person rows open by default; a visitor card shows "Approved N in the
  consolidated selection" when they have an approvals row
  (`consolidatedApprovalCount` in `app/admin/proofing/[id]/page.tsx`).
  Steve said leave the rest for now (e.g. "approved by everyone" = 6 =
  James ∩ Zoe ∩ Harry — offered to make Harry's picks the final list).

- **LIVE 18 Nov ~11:55 (Steve tested on preview, said go live): share the consolidated selection with
  someone new** (Steve: poster designer must sign in themselves and see it).
  Any visitor could already open the Consolidated tab (when "Show … to
  clients" is ticked), but sign-in dropped them on the full gallery and the
  normal Share Gallery emails EVERY recipient. Now: Backstage › gallery ›
  consolidation box › **Share this selection** (end of
  `ProofingConsolidationEditor.tsx`): link `…/proofing/<slug>?view=consolidated`
  + Copy link, and "Email the selection" (share route `action:
  "share-consolidated"`, `emails[]` → emails ONLY them, not saved as gallery
  recipients; needs gallery live + selection saved as visible; email wording
  `kind: "consolidated"` in `lib/proofing/email.ts`). `ProofingGalleryEntry`
  keeps `view=consolidated` after sign-in.
- **LIVE 18 Nov ~11:55: per-person approvals in Consolidated.** (This
  status commit was pushed to live only — fast-forward the test branch
  with the next job's push.) Before:
  ONE shared `definitive_image_ids` list — any visitor's click toggled it
  for everyone. Now each person approves for themselves (table
  `proofing_consolidated_approvals` gallery_id+visitor_id, name, image_ids;
  auto-created; atomic jsonb toggle). "Everyone" = participants + anyone
  else with ≥1 approval (`buildProofingApprovalPeople`,
  `approvedByEveryone` in consolidated-repository.ts). First approval by
  someone without a Backstage label → "What should we call you?" box
  (API 409 `needName`). Visitors get names only (`clientApprovalPeople`).
  Gallery: heart = Approve/Approved, per-photo "Approved by A, B · 2 of 3"
  or "✓ Approved by everyone", "Only show approved by everyone" filter;
  old "Selected by all" now "In everyone's favourites". Backstage
  Selections card: "Approved by everyone" + "Approving: name (n)"; old
  shared picks kept, mentioned if any. Rehearsed on local Postgres (3
  people × 3 photos at once, double-click, take-back) — correct.
  ADDED same day (Steve: show who picked what; others unlikely to come
  back): a participant's ORIGINAL FAVOURITES COUNT AS THEIR APPROVALS until
  they click (first click copies their favourites, then toggles). Each
  person has a colour (`PROOFING_PERSON_COLOURS`, by list order): key at
  top + coloured name tags per photo (filled = approves, struck-through
  outline = picked originally, taken back). Backstage card: "Each person"
  rows (colour bar, picked/approves counts, thumbnails, Copy for Lightroom
  per person). Participants without a Backstage label show as
  "Participant N" — Steve should add labels.

- **16 Nov: website health check (Steve asked after the WebP discovery).**
  PageSpeed mobile: home 100, archive 92, Jekyll & Hyde 96 (a11y/BP/SEO
  92–100). Crawled all 1,604 sitemap pages: 0 broken internal links
  (1,611), 0 broken images (17,011; HEAD), 0 production-gallery images
  without alt. Found: (1) 4 PNG files left in Selected Work bucket — About
  display photo (`selected-work/about/steve-gregson-display-…png`, 945 KB)
  and the campaign banner on /marketing-pr (main, __display, __previews).
  Fix: webp-convert API action `sign-selected` (keys under selected-work/,
  never "original"), converted in Chrome in place. (2) Images served with
  `Cache-Control: max-age=14400` (4 h, Cloudflare default; stored objects
  have no Cache-Control, also before the conversion) → Cloudflare Cache Rule
  for images.stevegregson.com + selected-work-images: browser + edge TTL
  30 days. (3) NOT done (Steve: maybe later): iPhones (3× screens) pick the
  2560w file (~360 KB) over the 1000w card; a ~1600w middle size would
  roughly halve it — needs an overnight generation run for ~15k photos.
- **LIVE 15 Nov ~22:50: real WebP in every browser + Convert to WebP tool**
  (Steve: "build both parts, immediately … get them going and converting").
  FOUND 15 Nov (Range-read hero + 1st gallery photo of all 501 productions on
  images.stevegregson.com): ~375 productions' full-size gallery files are PNG
  under .webp names (median 4.9 MB vs 259 KB for real WebP); some cards too
  (e.g. Jekyll). Cause: Safari can't encode WebP (toBlob → PNG) and every
  uploader encoded in the browser. Nobody checked stored bytes.
  (1) `lib/webp-client.ts` `canvasToWebP(canvas, q)`: native toBlob if the
  browser can make WebP, else @jsquash/webp WASM (engine in `public/wasm/`,
  `locateFile` → /wasm/; CSP has 'wasm-unsafe-eval'). Never returns PNG/JPEG.
  Used by Curated import, ProductionUpload, edit-production, Selected Work
  pipeline, `renderEditedImage`. Proofing still JPEG-in-Safari (unchanged).
  Tested in Chromium with toBlob patched to act like Safari: 2560px → real
  WebP 193 KB (PNG would be 5.1 MB), 0.9 s. Architecture check marker for
  pipeline.ts is now `canvasToWebP`.
  (2) Backstage › Settings › **Convert photos to WebP** (`/admin/webp-convert`,
  API `/api/admin/webp-convert`: productions / files / sign). Browser
  Range-reads each file (cache-busting query), re-encodes PNG/JPEG to WebP
  (cards 0.75, full 0.82, same pixel size), PUTs in place via
  `createProductionImageReplaceUrl` (same key → no DB change), re-checks it's
  WebP. 3 at a time; progress in localStorage (`webp-convert-done-v1`).
  Auto-carries-on 1 min after a dropped connection (up to 60 times; one drop
  at ~23:10 stopped it). 23:15: 76/528 productions, 1,806 converted,
  7.4 GB → 0.38 GB, 3 problems (Decisions, connection drops; retried).
  **FINISHED overnight (16 Nov ~07:30): 528/528 productions, 0 problems.**
  ~15,850 photos converted in total (2 runs: 1,806 + 14,052), ~65.7 GB →
  ~3.1 GB. Verified 07:35: Range-read 1,999 files across all 501 public
  productions (first, second, a card, middle, last; cache-busted) → all
  real WebP. Plain (uncached-query) URLs spot-checked → WebP. Productions
  bucket should now be ~19 GB (was 84.77), still a bit over R2's 10 GB free.
  16 Nov 07:47: Cloudflare Purge Everything done (Steve signed in, Claude
  clicked; "Purge request successfully received"). R2 total storage now
  21.94 GB (all buckets; was ~87 GB) — ~12 GB over the free 10 GB.
- **LIVE 15 Nov ~22:00: Editorial rhythm no longer crops** (Steve saw
  mockups of Jekyll & Hyde at 1440/390, said go live). Was: 2-up/3-up tiles
  forced to 3:2 (`object-fit: cover`) → portraits cropped. Now
  `ProductionGallery.tsx` renders editorial as rows of 1/2/3
  (`.curated-production-gallery-rows`, CSS before the 1100px media block in
  globals.css): each figure gets inline `aspect-ratio` + `flex-grow` = its
  shape, so a row shares one height, nothing cropped; single photo capped
  at 88vh tall; phones one column. Shape read from the photo's blur
  placeholder (`lib/blur-aspect.ts`: PNG/WebP/JPEG header; fallback 1.5).
  Other presets unchanged (grid-2/grid-3/feature still crop to 3:2).
  Harness: SSR the component via esbuild from a folder INSIDE the repo
  (else two Reacts), playwright screenshots, wait for images to load.
- **LIVE 15 Nov ~22:00: Curated import in Safari** (Steve said go live;
  his retry after quitting Safari had already worked). Steve's Jekyll & Hyde import (37 photos, linked to Upcoming
  OK) failed twice in Safari with a bare "Load failed" (nothing published).
  Fixes: (1) Safari can't make WebP — `canvas.toBlob("image/webp")` gives
  a big PNG — so Curated import (`preparePublishedImage`, card blob) and
  `renderEditedImage` in `lib/client-image-editor.ts` (also used by Selected
  Work etc.) now use `proofEncodeType()` → JPEG in Safari (upload label stays
  image/webp, as Proofing). Productions imported from Safari before this may
  be heavy PNGs — worth checking. (2) `fetchRetrying()` in
  CuratedArchiveImportClient: prepare, sign-image, link-upcoming and R2
  downloads retry 4× on dropped connections, then say which step failed.
  Finalize is NOT retried (not safe to repeat). Not tested in real Safari.
- **LIVE 15 Nov ~19:55: Upcoming → curated import now links on Import**
  (Steve said go live). Steve's first real use (Jekyll & Hyde,
  Rose Bruford, 15 Nov): Upcoming › "Use a curated folder" → chose folder
  → pressed Import. The draft's details were only applied if he clicked
  Edit and saved, so it published with the curator's details and the
  draft stayed in Upcoming. Now Import first calls new
  `/api/admin/curated-archive-import/link-upcoming` (draft details +
  credits onto the override, blank draft fields keep curated ones, photos
  untouched, sets `upcomingId`; skips if already linked or the draft is
  already published — double casts: only the first import uses it); then
  the publish route's existing `markLinkedUpcomingPublished` moves it out
  of Upcoming. Confirm + banner wording changed. Not tried for real yet.
- **Jekyll & Hyde (15 Nov): only 36 photos, not 37.** An earlier chat
  told Steve it had added #0250 (bassist) to `pass-2.json`, but the file
  on his Mac (~/Pictures/Curated/Jekyll-Hyde, 18:16) still has the
  original 36 — the edit never landed. Site gallery shows 35 + the hero
  (#0143). DONE 15 Nov: #0250 added (checked on the Mac), Finish run (37 staged),
  old production deleted; re-imported OK in Safari 15 Nov ~21:45.

- **LIVE 14 Nov ~13:30: Recent activity rows clickable** (Steve saw the
  mockup and said go live).
  Proofing › Recent activity (and View all activity) rows are now links to
  `/admin/proofing/<id>?tab=selections&person=<visitorId>`; the gallery
  page (`searchParams.person`, matches id or email) then shows ONLY that
  person's card with a "Showing X only · Show everyone (N)" bar
  (`.proofing-selection-focus` at end of `app/admin/proofing/proofing.css`).
  Hover styles in `proofing-galleries.module.css` (`a.activityRow`,
  `.visitorLink`, `.go`).

- **LIVE (found already on live branch 14 Nov 13:30): cut Neon database bill.**
  Vercel receipt (Oct) showed ~$13 Neon compute: the DB was awake ~16 h/day
  because the Mac app checked in every 5 min (each `/api/mac` call reads the
  DB, so it never got 5 idle minutes to sleep). Changes: Mac timer 5 → 60 min
  (`install.sh` StartInterval 3600; `agent.zsh` rewrites the existing plist
  with plutil, takes effect after the Mac's next restart/log-in; new files
  still upload instantly via WatchPaths). "Stale" thresholds 15 → 75 min
  (`StatusBar.swift`, MB_VERSION 5; `MacProgress.tsx`). Backstage Storage
  progress panel now checks every 60 s when the Mac is idle, 5 s only while
  busy. After go live: Steve restarts his Mac once, then after a month moves
  Neon to the Free plan (100 CU-hours/month) in Vercel › Storage.

- **LIVE 10 Nov 15:06: downloads on each person's card in Proofing ›
  gallery › Selections** (Steve OK'd mockup, said go live). Steve asked if the gallery shows downloads: it
  already did (Downloads tab: email, time, single/zip, file names; logged
  when Download is pressed, so a failed save still counts). New: under
  each visitor's favourites, a closed "Downloaded N photos · last <date>"
  that opens to thumbnails (unique photos, newest first; matched by
  visitorId, else email), or "No downloads yet". `downloadsByVisitor` in
  `app/admin/proofing/[id]/page.tsx`; styles at end of
  `app/admin/proofing/proofing.css`.

- **LIVE 10 Nov 12:50: Duplicate for Upcoming drafts (double casts)**
  (Steve OK'd the mockup and said go live; not yet tried for real).
  Productions › Upcoming: each draft
  has a Duplicate button; also in the draft editor's header (saves unsaved
  changes first). API `action: "duplicate"` → `duplicateUpcomingDraft()`
  copies everything (details, credits, notes) as a new draft titled
  "<title> (copy)" (`duplicateTitle()`), opens it with `?copy=1`: gold
  "This is a copy — rename it to show the cast" note + title selected.
  Styles `.itemDuplicate` / `.copyNote` at end of
  `app/admin/productions/upcoming.module.css`.

- **LIVE 10 Nov 10:06: framed proofing viewer + Copy link.** Steve: in
  the client viewer, favourite/nav felt "clunky/hidden". Viewer
  (`ProofingGalleryClient.tsx`, `.proofing-viewer.is-framed` section at
  the END of `app/proofing/proofing.css`): sticky top bar = photo number,
  file name, Favourite / Add note / Annotate / Download, close; photo
  smaller in a frame (max 1180px, 100dvh−14.5rem); round ‹ › on the
  frame edges. Phones (≤700px): top = Download | Add note | Annotate;
  sticky bottom row `proofing-viewer-thumbbar` = ‹ Previous · ♡
  Favourite · Next › (replaces round arrows + top Favourite). Photos are
  never cropped. Settings › Gallery URL (`ProofingUrlEditor.tsx`, styles
  at end of `app/admin/proofing/proofing.css`): shows
  stevegregson.com/proofing/, Save + Copy link (copies saved full URL;
  disabled with a hint while unsaved). Tested with a local esbuild
  harness (gallery component + real CSS, sample crops of Steve's 1305) at
  1440 and 390: screenshots shown to Steve before push. `next dev` in the
  sandbox didn't hydrate (CSP/HMR) and `next build` needs DATABASE_URL —
  use the harness approach. Pre-existing eslint errors in
  ProofingGalleryClient (setState in effect ×3, unescaped ' at ~2943) —
  not ours.

- **LIVE 9 Nov 23:43 (commit ccfda47): full-size
  originals retry.** Steve's first "Add full-size" run said "401 didn't
  upload" (count, reason unknown — the card swallowed errors). Now
  `ProofingOriginals.tsx` retries each PUT 3× (1.5 s / 3 s waits), logs
  failures to the console and shows the first reason in the message.
  Also skips photos that already have an original (before, a retry
  re-sent all 533, ~4 GB).
  His second run (23:41) was progressing: 134 → 141 in 30 s.

- **LIVE 9 Nov 23:40 (commit c4c9d50): Safari proofing
  uploads.** Steve: 36 photos in 15 min. Safari can't encode WebP:
  `canvas.toBlob("image/webp")` silently returns PNG (ignores quality), so
  `prepareProofUpload` re-encoded big PNGs ~13 times per photo, shrinking
  ×0.85 until under 3.75 MB — that's why Mountview proofs were 1734×1156
  and ~3.7 MB, and thumbs were ~1.2 MB PNGs. Now `proofEncodeType()`
  (`lib/proofing/thumbnail-client.ts`, tested once) uses JPEG when the
  browser can't make WebP; used for proofs + thumbnails. File keeps its
  .webp name and `Content-Type: image/webp` label (signed upload URLs);
  browsers sniff images, downloads pass JPEG through. Timed in Chrome with
  toBlob patched to act like Safari (6 × 6000×4000 JPEGs): old 15.2 s →
  1474px 2.9 MB PNGs; new 1.0 s → 2400px 0.4 MB JPEGs; real Chrome
  unchanged. NOT checked in real Safari. Same Safari issue likely in
  other uploaders still using webp toBlob (selected-work pipeline,
  ProductionUpload, edit-production, Curated import, client-image-editor)
  — not changed.
  Chrome re-upload of Mountview Graduation 9 Nov ~23:13: 533 done
  (407 replaced in place, 126 new — the slow delete hadn't finished).
  Full-size originals then showed 0 → Steve to re-add them.

- **9 Nov 23:40 — "yellowy" proofs: NOT a site bug.** Steve saw Backstage
  photos warmer/duller than Lightroom/Finder. Measured: stored proof =
  his sRGB JPEG (no HDR), and Finder's display = the file; but Chrome's
  on-screen rendering was far off (blue curtain 17→3, screen turned
  yellowish). His Mac uses a custom display profile "Calibrated
  LCD_23-02-2023.icc" that Chrome mishandles. Clients see correct colours.
  Advised: judge colour in Safari/phone, or chrome://flags › Force color
  profile › Display P3 D65; consider recalibrating. Don't "fix" proof
  colours in code.

- **LIVE 9 Nov 22:38: fast proofing photo delete** (live commit
  73d785e; Steve to confirm real-world speed). Steve deleting all ~530 Mountview Graduation photos to
  re-upload took ~20 min ("not acceptable"): Delete selected sent one
  request per photo, and each re-read the whole gallery (all photos +
  blur previews), rewrote it, renumbered every remaining photo and deleted
  3 files one by one. Now `ProofingMediaWorkspace.tsx` sends batches of 200
  (`imageIds`; button shows "Deleting… N of M" past 200);
  `/api/admin/proofing/delete-image` (still takes single `imageId`) does
  ONE favourites/cover tidy, `deleteProofingImageRecords` (one delete +
  one renumber) and `deleteProofingImages` (proof+thumb+original via
  DeleteObjects, 1,000 keys per call, parallel). Failure part-way keeps the
  undeleted ones selected + refreshes. Rehearsed (local Postgres + neon shim
  + moto, 533 photos, 4 visitors): 530 deleted in 3 requests / 21 DB calls,
  0 rows and 0 files left, cover + favourites cleared, sort order
  contiguous, retry harmless. No visual change except the counter.
  Answered Steve: re-uploads make thumbnails automatically, Downloads
  setting stays, re-add full-size originals via the card; same file names
  could have used "Replace them" (keeps favourites) instead of deleting.

- **LIVE 6 Nov 21:21: Share Gallery panel.** (was waiting for
  "go live"):** the button was disabled (silently) when a gallery had no
  recipients — Steve: "awful UX". Now always clickable → panel
  (`ShareGalleryButton.tsx`): gallery link + Copy link; "Email it to"
  chips (current recipients + new ones); add saved contacts (suggestions
  by name/email/company) or any email; "Send to N people"; warns if the
  gallery isn't live. `/api/admin/proofing/share` now takes `add`
  ([{contactId}|{email}], saved onto `gallery.recipients`, de-duplicated)
  and `action: "contacts"` (address book for suggestions). Galleries list
  ⋮ "Share gallery" opens the gallery page with `?share=1` (panel opens
  itself). Tested in preview with mocked API (send body + clipboard).

- **6 Nov 19:20 — Safari downloads RESOLVED (cause was Steve's Mac Safari,
  not the site).** Fix #4 went live 18:58. Steve's Mac Safari then still
  failed every storage download: Downloads list said "Zero KB of 5.2 MB —
  Cannot create file" (correct name + size = site delivering correctly);
  the .download bundle in ~/Downloads was EMPTY. Same link worked on his
  iPhone; other sites (GitHub zip) downloaded fine in Mac Safari. Quitting
  Safari (⌘Q) and reopening fixed it. So much of the afternoon's "Safari
  failures" (fixes #1–#3) may have been this stuck Mac Safari state — next
  time, FIRST check Safari's Downloads list for the real error and test on
  a second device before changing code. Live link checked: R2 presigned
  GET → JPEG, `response-content-disposition` attachment with the
  original name. Claude signed in to the gallery in Chrome as
  info@stevegregson.com (shows as a visitor).

- **LIVE 6 Nov 18:58: Safari download fix #4:** Steve still got a stalled .download at 18:54 (live #3):
  the button was clickable during the 600 ms before preparing started (and
  after a failed prepare), using the old fetch→save path. Now (a) photos with
  a full-size original (`hasOriginal`, from `listProofingOriginalsCached`,
  60 s per-server cache, in the visitor page) download via a plain
  `<a href=/api/proofing/download?…>` (302 → R2 JPEG attachment) — no
  preparing at all; (b) otherwise, in Safari the button stays disabled
  "Preparing download…" until the JPEG blob is ready, with "Try again" if
  preparing fails (`prepareFailedId`, `prepareAttempt`). Other browsers keep
  the click fallback.

- **LIVE 6 Nov 18:46: Full-size download originals** (was waiting
  for "go live"):** proofs are capped at 2400px / 3.75 MB WebP
  (`ProofingUpload.tsx` shrinks ×0.85 until it fits → Mountview proofs came
  out 1734×1156). Now Steve can add his original JPEGs: sidebar card
  "Full-size downloads" (`ProofingOriginals.tsx`) → choose folder/files →
  matched to photos by `originalFilename` base name (case-insensitive) →
  PUT untouched to R2 as `<galleryId>/orig-<proof base>.jpg` (upload API
  actions `originals-status`, `presign-originals`, `remove-originals`).
  `/api/proofing/download` + `download-all` use `createProofingBestDownloadUrl`
  (HEAD for the original; JPEG + attachment `<name>.jpg`, else the proof).
  Gallery passes a JPEG through without re-encoding
  (`convertProofingDownloadBlobToJpeg` checks FF D8 FF). "Remove full-size
  originals" deletes them all (downloads fall back to proofs);
  `deleteProofingImage` removes a photo's original too. Tested: storage
  helpers against a local S3 stand-in (moto), card + visitor download with
  real 4000px JPEGs (bytes identical). R2 6 Nov: productions 84.77 GB,
  proofing 2.41 GB, selected-work 0.19 GB (~87 GB total, over the 10 GB free:
  ≈ $1.16/month; Mountview originals 2.85 GB ≈ 4p/month). Steve plans to
  remove them after ~a month.

- **LIVE 6 Nov 18:31: Safari download fix #3 — Steve to confirm in Safari
  + iPhone. Fixes #1/#2 FAILED in Steve's Safari:** the stored proofs are
  WebP and Safari won't take WebP downloads (Steve had hit this before —
  that's why the gallery converts to JPEG), and a download that starts
  after an await (fetch + convert) stalls as "<name>.download". Now: when
  a photo opens in the viewer (350 ms debounce), its JPEG is made in the
  background (`preparedJpeg`), and Download is a plain `<a href=blob
  download=name.jpg>` → instant click, JPEG, all browsers. Favourites in
  Safari: zip built, then gold "Ready — save N photos (zip)" link
  (`readyArchive`); other browsers auto-save as before. `?link=1` on
  `/api/proofing/download` now unused (harmless). NOT tested in real Safari
  (no WebKit here) — Steve must confirm.

- **Safari download fix #2 (live 16:40, FAILED in Steve's Safari):** fix #1 (live 16:30) still failed in Safari: it framed our
  own `/api/proofing/download`, but the site sends `X-Frame-Options: DENY`
  (next.config.ts) so Safari blocks the frame. Now, like Transfers, the page
  fetches `/api/proofing/download?…&link=1` (JSON `{url}` = R2 presigned
  link with attachment disposition) and frames THAT URL. Test harnesses must
  include the real headers — the 16:30 test mocked the route and missed it.

- **Safari download fix #1 (live 16:30, FAILED):** in Safari the viewer Download left a stalled
  "<name>.download" file (page-built JPEG blob saved after an await).
  `isAppleWebKit()` (navigator.vendor "Apple" = Mac Safari + all iOS
  browsers) → `downloadThroughFrame(/api/proofing/download?…)` hidden
  iframe, like Transfers (`lib/transfers/zip-client.ts startDownload`);
  file arrives as the stored .webp. Favourites in Safari: one frame per
  photo, 0.9 s apart (no zip). Other browsers unchanged (JPEG / zip).
  Tested with a pretend-Safari Chromium; no real WebKit here.

- **LIVE 6 Nov ~15:45: "Saved ✓" + coffee link after a single download.**
  In the viewer, after Download finishes: "Saved ✓ Enjoy it! If it made you
  smile, ☕ buy me a coffee" (Ko-fi link only when the gallery's "Buy me a
  coffee" is on; otherwise just "Enjoy it!"). `savedImageId` state in
  ProofingGalleryClient; `.proofing-viewer-saved` (own row under the
  buttons; rules at the END of proofing.css because the viewer button
  group has several older overrides).

- **LIVE 6 Nov 15:20: Proofing "Any photo, one at a time" downloads.** New
  `downloadPermission` value `"single"` (types, settings route list,
  Settings › Downloads option, listed first). Viewer shows the Download
  button for web/single (+ selected-if-favourite); `/api/proofing/download`
  already allowed it. `download-all` + `download-event` treat "single"
  like "selected" (favourites only, never the whole gallery), so the
  Favourites tab shows "Download N favourites" (LIVE 6 Nov 15:45). The viewer's
  Download button is now gold for every mode (`.proofing-viewer-download`).
  After go live Steve sets Mountview Graduation › Settings › Downloads to
  "Any photo, one at a time".

- **LIVE 6 Nov 15:10: Proofing quick-loading thumbnails.**
  Grid
  tiles were the full 2400px proofs (measured 3.7 MB each; Mountview
  Graduation 533 photos ≈ 1.5 GB per visitor) and each went through
  `/api/proofing/image` (one Vercel call per tile). Now: thumbnails
  `<galleryId>/thumb-<webFilename>` in R2 (640px short side, webp 0.74,
  ~60 KB), made in the browser (`lib/proofing/thumbnail-client.ts`).
  New uploads make them (`thumbUploadUrl` from presign-batch). Older photos:
  sidebar card "Quick-loading thumbnails" › Make thumbnails
  (`ProofingThumbnails.tsx`; upload API actions `thumbs-status`,
  `presign-thumbs`; R2 GET CORS from www confirmed working). Visitor page
  signs all thumb links in one go (`createProofingThumbUrls`: fixed 6 h
  signing window, 18 h expiry, cached per server → stable URLs, browser
  reuses them; 533 signs ≈ 0.25 s). Grid `GridImage` falls back to the full
  proof if a thumb is missing; first 8 tiles eager. Viewer: thumb shown
  behind the full proof, next/previous preloaded. `deleteProofingImage`
  also removes the thumb. After go live: Steve opens the gallery in
  Backstage and presses Make thumbnails (keep tab open ~5–10 min).

- **LIVE 6 Nov ~14:55: Transfers progress strip + full photo picker.**
  `app/admin/transfers/TransferWorkspace.tsx` + `workspace.module.css`.
  (1) While sending, a strip sits right under the Backstage menu (sticky at
  `top: 6.5rem`, full width): "Uploading N of M files · <title>", bytes, %,
  gold bar. Afterwards green "Transfer sent · Emailed to …" with Open ↗ and
  × (orange if something failed). Gold button still fills too. `--strip` on
  `.page` shifts the sticky send card down. (2) Client page photos picker
  shows ALL queued photos, 40 per page, ‹ Previous / Next › (was first 60
  only); previews made one page at a time; picks kept across pages.

- **LIVE (was already on live by 6 Nov): Proofing upload + cover fixes (5 Nov)
  and About hero alignment:**
  - Upload progress now sits under the gallery menu (Media / Settings /
    Branding…), stays while switching tabs and sticks to the top when
    scrolling. One shared upload engine (`ProofingUploadProvider` in
    `ProofingUpload.tsx`, wrapped round the gallery page). Picking photos
    starts the upload straight away; warns before closing the tab.
  - Duplicate file names (case-insensitive) → "Replace them / Skip them /
    Cancel". Replace updates the photo in place (keeps id, place,
    favourites, notes, cover) and deletes the old file.
  - Cause of the "listed twice": after a failed upload the button re-sent
    the WHOLE selection. Now only failures are retried ("Retry N"), and the
    server (`commitProofingImages` in `lib/proofing/repository.ts`) skips any
    file name already in the gallery, so it can't double up again.
  - Cover: `ProofingCoverPicker` in the sidebar and on Branding: "+ Add cover
    photo" → Choose from gallery / Upload an image (cover-only photo stored
    as `coverUpload` in the gallery record, id `cover-…`, served by the
    normal image routes; route `app/api/admin/proofing/cover`). Admin no
    longer pretends the first photo is the cover. Branding's Save button now
    only saves the introduction.
  - Tested: tsc, eslint, `npm run build` check, repository against local
    Postgres, UI with mocked uploads (screenshots).

- **LIVE 4 Nov:** Curated import opens on a **To import** view (Ready +
  Attention only); published ones under "Already published" / "Show
  everything" (`statusFilter` "todo"). Staged uploads NOT deleted.
  Productions thumbnails fade in on load (`data-loaded`).
- **LIVE 4 Nov: Productions page flash fixed** (its `<style>` was at the END
  of `ProductionManager.tsx`, after 525 rows; moved to the start of `<main>`).

- **LIVE (5 Nov): About hero alignment.** `.hero` now
  `max-width: 94rem; margin: 0 auto` (same edges as `.biography`), photo
  column `minmax(260px, 26rem)`, `.intro` vertically centred beside it.
- **LIVE 5 Nov 20:40: smaller About photo.** Steve: "absolutely
  huge". `app/about/page.tsx`: hero columns `minmax(0,1fr) minmax(260px,28vw)`;
  `.portrait` is a 4:5 box, `width: min(100%, 26rem, calc(62vh*0.8))`,
  right-aligned (phones: up to 22rem, left). Backstage preview frame 4:5 too.
  Checked with next dev at 1440 and 390.
- **LIVE 5 Nov 19:30 (promoted after Vercel queue stuck): client shared-folder page fix.** A
  client couldn't download single photos: in Photos view long filenames
  widened each tile over the next (grid items had min-content width), hiding
  the ↓ button. `app/transfer/shared/[token]/shared.module.css`: tile
  `grid-template-columns: minmax(0,1fr)` + min-width 0; names wrap to 2
  lines so the photo number shows; ↓ never shrinks. Checked in Chromium at
  1440px and 390px.
- Tidy (5 Nov 11:30): Steve wants it ONLY for `MOUNTVIEW/MUSEUM - October
  2026` and `Kings College School Wimbledon/Buckets - November 2026`. He
  queued tidy-report for MUSEUM; it waits behind Graduation 2026 uploads.
  Read the report with him before tidy-apply; then run Buckets.
- **LIVE 5 Nov 11:24: Mac renames/deletes mirrored to Storage.**
  Steve's workflow: Lightroom exports Web + Full into the Storage folder, then
  Bridge edits metadata AND renames → every rename uploaded as a new file,
  old names stayed (folders doubled). Steve chose "Mirror it, like Dropbox".
  `mirror_gone` in agent.zsh: a tracked file missing from the Mac whose
  FOLDER STILL EXISTS → `api/mac` action `trash` (≤50/call; only if this
  Mac uploaded it and Storage still holds that exact md5/size) → Deleted
  files (30 days). Whole folder gone → Storage keeps all (forget only).
  >300 missing and >50% of tracked → nothing trashed. Files the app clears
  are forgotten when cleared, so never trashed. In-place metadata edits
  already replaced the Storage copy (presign "ours → replace").
  One-off tidy (Steve chose yes): `agent.zsh --request tidy-report <path>`
  (path = Storage folder root → "ALL") writes `~/Library/Logs/Steve Gregson
  Storage - tidy report.txt` (Storage files in folders still on the Mac,
  not on the Mac, not "Freed space" in the log); `--request tidy-apply
  <root>` trashes that list (server uses the recorded md5; not-ours kept).
  Rehearsed with a fake server: rename, in-place edit, tidy, folder moved
  away — all correct. After go live: Steve runs `install.sh --update`, then
  tidy-report; Claude reads the report with him before tidy-apply.
- **LIVE 5 Nov 10:50: About page photo editor.** Backstage ›
  Settings › "Edit the About page photo" (`/admin/about-photo`): same
  ImageEditor as Selected Work (crop/zoom/auto/brightness), "Upload a new
  photo". Files in the Selected Work R2 store at `selected-work/about/`
  (untouched original + edited display, unique names); record in
  site_content key `about-portrait` (`lib/about-portrait.ts`), API
  `/api/admin/about-portrait` (presign/save). About page reads it via
  `getCachedAboutPortraitRaw` (selected-work tag + revalidatePath('/about')),
  falls back to `/images/portrait/steve-gregson.webp`. Steve: photo "too big,
  too much negative space".
- **LIVE 5 Nov 10:27: proofing visitors in their own table**
  (Mountview graduation gallery: 300+ students + families). New table
  `proofing_visitors` (gallery_id, id, email, data jsonb, version) created
  on first use; existing visitors moved out of `proofing_galleries.data`
  automatically (`moveVisitorsOutOfGalleries`, idempotent; leftovers still
  counted everywhere). Public loaders attach ONLY the cookie's visitor
  (`withCurrentVisitor`, reads `cookies()` from next/headers); admin loaders
  attach everyone. Enter → `signInProofingVisitor` (merges duplicate
  emails), favourite/submit → `updateProofingVisitor` (row version CAS).
  `updateProofingGallery` (Backstage only) gives updaters all visitors and
  saves just the changed ones (`saveChangedVisitors`); gallery JSON stores
  `visitors: []`. Image access checks the table (+ JSON leftovers).
  Architecture check now forbids `updateProofingGallery(` in enter/
  favourite/submit. Rehearsed on local Postgres: 300 simultaneous sign-ins,
  900 simultaneous favourites, 30 rapid clicks by one visitor, old-gallery
  move + duplicate merge, Backstage edit, delete — all pass; gallery record
  263 bytes with 301 visitors.
  SAME GO-LIVE: Ko-fi "Buy me a coffee" button, per-gallery setting
  `showTipButton` (Backstage › gallery settings › "Buy me a coffee", default
  off — paying clients never see it). Shown above the download buttons
  (`.proofing-tip`, KOFI_URL https://ko-fi.com/stevegregsonphotography in
  ProofingGalleryClient.tsx). Ko-fi set up 5 Nov: coffee mode, £3 each, Tip
  wording, Stripe Radar Lite (free).
- **LIVE 5 Nov 09:40: coloured menu bar icon.** Cloud in the
  menu bar's own colour with a coloured symbol inside (`cloudIcon` in
  StatusBar.swift): green tick = all uploaded, blue ↑ uploading, blue ↓
  bringing back, orange ! = stale/failed, slash = offline. agent.zsh now
  reports "Bring back" as state `downloading` + `down` {files, bytes,
  doneFiles, doneBytes}; Backstage panel shows it too. MB_VERSION=4.
  Steve saw it working 09:50 ("WE DID GOOD").
- **LIVE 5 Nov 09:10: People pages refresh only when
  affected.** `revalidateProductionContent` (now async — every caller
  awaits it) no longer revalidates `/people/[slug]` wholesale: it revalidates
  `/people/<slug>` (+ altSlugs) for people credited on the changed
  productions before (cached archive, still old) and after (fresh DB) the
  change; falls back to all on bulk/unknown changes, errors, or >400 people.
  Archive-order changes no longer touch People pages. Why: Vercel ISR writes
  189K/200K (rolling 30 days; mostly 13–17 Oct import, drops off ~12–17 Nov);
  every Backstage change rebuilt 1,000+ People pages as crawlers revisited.
  Steve: avoid big imports on 5 Nov.
- **Deployments, 4 Nov:** Steve asked to cut Vercel deployments (Hobby
  Deployment Storage 10.07/10 GB; ISR Writes 189K/200K; Active CPU 2h22/4h —
  ISR writes to investigate BEFORE more traffic). Pushes 4c43491/77287b9
  failed in 7 s: `scripts/check-vercel-architecture.mjs` (runs in
  `npm run build`) required the old marker in the proofing image route —
  ALWAYS test with `npm run build`, not `npx next build`. Fixed; pushed
  STRAIGHT to live only (test branch is behind live — fast-forward it with
  the next job's push).
- **LIVE 4 Nov ~22:50 (if the build succeeded): proofing ready for big audiences** (Mountview
  graduation gallery, 300+ students + families, going out 5–6 Nov).
  (1) `updateProofingGallery` now saves only if nobody saved since it read
  (compare `data->>'updatedAt'`, re-read + retry ×12 with jitter). Before:
  rehearsal of 50 simultaneous sign-ins kept 1 of 50; after: 50 of 50.
  Updaters must stay re-runnable (they are). (2) `/api/proofing/image` uses
  new `getProofingImageAccess` (few fields + EXISTS over visitors in SQL)
  instead of reading the whole gallery JSON per thumbnail; redirect gets
  `Cache-Control: private, max-age=600` (presigned link lasts 15 min).
  Rehearsed against local Postgres with a neon shim (/tmp test, not in repo).
- **LIVE 4 Nov ~22:50: uploader scan fix.** The two-phase
  `upload_pass` (live 22:23) stat'ed every file with an external `stat`
  before uploading anything — minutes on Steve's Mac at low priority, so
  nothing uploaded/reported 22:30→. Now uses builtin `zstat` (zsh/stat,
  only `b:zstat` loaded so /usr/bin/stat is untouched): 20k files 1m41s →
  2.5s; reports state "checking" (+ `checked` count) while scanning. Menu bar
  + Backstage show "Checking for new files…". MB_VERSION=3.
- Steve renamed "… copy" folders IN FINDER, so they re-uploaded under new
  names: Storage has both. Delete the "… copy" folders in Backstage once the
  renamed ones are up (Mockingbird 1, 80TH PARTY, others).
- **Menu bar icon LIVE — built on Steve's Mac 5 Nov 01:09; overnight 8,923
  uploads finished ~01:09 (1 file retrying).** (v1 failed to
  build: `@MainActor` class created from top-level code). v2 (`@main` +
  `-parse-as-library`, test-compiled OK on Steve's Mac,
  MB_VERSION=2, build moved to the END of the run so it never delays
  uploads; failed marker holds the version so a new version retries at once).
  Not yet seen appearing — check the log for "menu bar". Steve couldn't see
  what was uploading.
  - `agent.zsh` now finds everything to upload first (two-phase
    `upload_pass`), writes `status.json` in the support folder (≤1/s) and
    sends it to `api/mac` action `status` (≤ every 15 s, and at the end of
    every run). States: uploading / waiting / tidying / idle / offline /
    disconnected. Rehearsed on Linux with a fake server + shims (40 files,
    offline, idle) — OK.
  - **Menu bar icon**: `public/mac/StatusBar.swift`, built ON the Mac by
    `install_menubar` in agent.zsh (`xcrun swiftc`, free CLT; MB_VERSION=1),
    installed as `~/Applications/Steve Gregson Storage Progress.app` +
    LaunchAgent `com.stevegregson.storage.menubar`. NOT compiled/seen yet
    (no Swift here): after go live check `~/Library/Logs/Steve Gregson
    Storage.log` for "Menu bar icon …" lines (build errors are logged).
    Retries once a day if it fails (`menubar-failed` marker).
  - Backstage: `mac_devices.status/status_at` columns, admin action
    `mac-progress`, `app/admin/storage/MacProgress.tsx` (line under "Mac app"
    in the Storage sidebar + full panel on Storage › Mac app, polls 5 s).
  - Mac picks it up via its daily self-update after go live (or
    `install.sh --update`).

- **LIVE (4 Nov): Transfers "Email to" suggests past
  recipients** (`app/admin/transfers/RecipientInput.tsx`): as Steve types
  (or on focus, "Recently sent to"), up to 6 addresses from past
  transfers, Storage shares and file requests; works with comma lists;
  Tab/Enter picks. New `transfer_contacts` table keeps addresses even if a
  transfer is deleted (`listKnownRecipientEmails` in
  `lib/transfers/repository.ts`). tsc + eslint clean; full `next build`
  not run (Steve stopped it — sandbox needed an extra build package).

- **LIVE 4 Nov: Finder right-click options** in
  `~/Steve Gregson Storage` (Quick Actions the Mac app writes into
  `~/Library/Services` itself; `QA_VERSION` in `agent.zsh`):
  **Bring back from Storage** (downloads a folder's/file's cleared files
  back into place, 8 at a time, keeps 30 GB free, records them so they
  never re-upload as duplicates, then they stay OFFLOAD_DAYS) and
  **Clear from Mac now** (same Storage check as automatic clearing).
  Both run `agent.zsh --request <kind> <paths>` → queue file `requests` in
  the support folder → kickstarts a run. New `api/mac` actions `list` and
  `download` (read-only). Rehearsed end-to-end against a fake Storage
  (all 21 checks passed); the Quick Actions themselves haven't been seen
  on a real Mac yet — first thing to check after go live. If they don't
  appear: Finder right-click › Quick Actions › Customise, or System
  Settings › Keyboard › Keyboard Shortcuts › Services.

- 4 Nov 22:20: Steve copied Mountview shows from Google Drive into Storage;
  uploading ("Mockingbird 1 - October 2026 copy" needs renaming IN BACKSTAGE
  once uploaded, not on the Mac, or it re-uploads).

- **4 Nov: MOUNTVIEW/MUSEUM - October 2026** (562 photos) cleared from the
  Mac early (see OFFLOAD_DAYS above). All safe in Storage. Once the
  right-click options are live: right-click the show folder › Bring back
  from Storage, then edit metadata in Bridge (edited files replace the
  Storage copies, no duplicates).

- **LIVE (1 Nov): People search more forgiving**
  (`components/directory/PeopleSearch.tsx`). It was already case-insensitive;
  now curly/straight apostrophes match, hyphens = spaces, and words can be
  typed in any order. Archive search (`app/archive/ArchiveExplorer.tsx`)
  already ignored case; not changed.

- **LIVE (1 Nov):** Mac app no longer removes a show's
  folder after clearing its files (Babies at Mountview vanished from the
  Mac this way), and a one-off step recreates any folders it removed,
  from the log's "Freed space" lines (marker file `folders-restored` in
  the app's support folder). Reaches the Mac only after go live (daily
  self-update, or `install.sh --update`). Also: Backstage › Storage
  folders now have **Download** in their ⋯ menu (whole folder as one zip,
  sub-folders kept, built in the browser via `/transfer-zip-sw.js`; new
  `download-folder` action in `api/admin/storage`). Old token emails: GitHub token
  "Steve Gregson Archive" (GITHUB_BACKSTAGE_TOKEN) is unused; let it
  expire. 13 Nov "back to 7 days" reminder deleted (Steve chose 5).

- **Faster Mac uploads — LIVE 14 Oct:** `agent.zsh` uploads 8 files at once
  (`UPLOAD_JOBS` in the Mac config, 1–32); `api/mac` presign records an
  identical-but-unconfirmed file instead of making a "(Mac)" duplicate;
  `install.sh --update` stops the old run first. Steve's Mac updated 10:18.
  Measured: ~10 MB/s (~80 Mbit/s, near his line) vs ~1.6 MB/s before.
- **MOUNTVIEW → Storage — check 15 Oct 14:30: essentially DONE.**
  - The 3 remaining 2024 shows (1,833 files in
    `~/Library/Logs/mountview-missing.txt`): all uploaded 09:20–~11:00.
  - The ten 2021–22 folders (zips from dropbox.com): all ten uploaded —
    Nell Gwynn 649, Little Women Thu 435 / Wed 458 / BTS 108, Foundation
    700, Les Mis CM 572, Shoreditch TH 458, Design Showcase 328, Romeo &
    Juliet 660, SAPM 236. Last upload 14:24.
  - **10 files still to go** (connection dropped, "broken pipe"; files are
    fine, auto-retry next run): Little Women Thursday Full 48, 63, 64, 70,
    88, 174; Nell Gwynn Full 048, 060, 205, 289. Next chat: confirm these
    show as `Uploaded` in the log.
  - 14:30: Mac clearing under way (4,272 files / 42 GB still on the Mac).
  - Not checkable: whether the dropbox.com zips held every file (2021–22
    folders aren't synced locally to compare).
  - Earlier: overnight 14–15 Oct upload of everything else finished.
  - Hidden leftover `.FullRes-StreetcarNamedDesire-LEIGH-CreditSteveGregson-027.jpg.NmJUDT`
    (Streetcar › LEIGH CAST › Full) is a half-finished rsync copy from
    13 Oct. The real photo uploaded 13 Oct 20:40, so nothing is missing;
    the leftover can be deleted (probably the "1 file will be retried").
  - **Free space puzzle — SOLVED 15 Oct:** no Time Machine snapshots
    (327 GB free per `df`). The ~142 GB went into Dropbox: rsync reading
    online-only Dropbox files makes Dropbox download them, and they stay.
    The folders copied on 14 Oct (2024 shows, 9 to 5, Site Specific, Alice,
    Six Characters, Building Hires) are now fully downloaded in Dropbox.
    Fix: Make online-only on those folders (failed before — "Unable to
    Remove Download"). Every future Dropbox → Storage copy costs space
    TWICE (Dropbox download + Storage copy) until both are cleared — count
    that in the disk-space rule.
  - Still to do: PUT OFFLOAD_DAYS BACK (e.g. 7) once the last 10 files are
    up; tick the checklist artifact.
  **FIX NEEDED (agent.zsh):** (1) clearing must not block uploads — clear
  first / between upload chunks, or cap it per run; (2) do clearing
  verifies in parallel like uploads; (3) clearing loop never touches the
  lock, so a clearing run over 4 h can be taken over — touch it; (4) warn
  Steve if free space drops below ~30 GB; (5) skip rsync temp files
  (`.name.XXXXXX`).
- **Dropbox won't offload anything:** every "Make online-only" (MOUNTVIEW,
  Jermyn Street, even Twelfth Night alone) gives "Unable to Remove
  Download", even after restarting Dropbox. Files ARE online (checked).
  Suspect Dropbox account being full. macOS counts them as "purgeable",
  but don't rely on that freeing space.
- **The Rink – May 2026 (GSA): ~890 photos exist ONLY on the Mac** —
  `Full New`, `Web New`, `Full Replacement`, `Web Replacement` never
  uploaded (Dropbox full). Not yet copied to Storage. Copy command:
  `mkdir -p ~/"Steve Gregson Storage"/"Guildford School of Acting" && cd ~/Library/CloudStorage/Dropbox/"Guildford School of Acting" && rsync -rt --exclude .DS_Store "The Rink - May 2026" ~/"Steve Gregson Storage"/"Guildford School of Acting"/`
  Young Frankenstein – June 2026 is also Mac-only in Dropbox but is safe
  in Google Drive ("Young Frankenstein - June 2026 copy").
- TODO: scan Dropbox for other files on the Mac that never uploaded
  (anything since ~May 2026 may be affected).
- Steve to check Stage Door Jonny (Jez Butterworth) in Productions: the
  import showed "Load failed" but the production exists.
- **Adding missing productions to the archive:** Steve has
  "Missing productions checklist.xlsx" (93 shows not on the site, from a
  Dropbox vs archive comparison on 13 Oct; biggest gaps Jermyn Street,
  Mill Hill School, City Academy, Mountview). Workflow: make the show's
  Dropbox folder available offline → curate → import → tick off → set
  back to online-only. Curated so far: David Copperfield (free route),
  Little Brother (paid route, first test). Stage Door Jonny imported.
- Mountview move checklist artifact:
  https://claude.ai/artifact/3KaMy6VmDJAe6GRjDx6Rmh. Steve keeps Dropbox
  for other clients.
- **Backblaze Computer Backup** (RAW drives, ~20 TB uploading, 1-year
  version history): still to exclude the `Steve Gregson Storage` folder.
- Scheduled tasks: yearly Backblaze drive check (1 Oct).

## Ideas not started

- Optional "transfer sent" confirmation email to Steve (he said no need).
