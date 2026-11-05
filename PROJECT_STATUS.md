# Steve Gregson Archive — Project Status (handover)

Last updated: 5 November 2026, 10:45 (London)

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
- **Transfers**: WeTransfer-style sending, progress in the Transfer
  button, personal links per recipient, "Who's downloaded", first-download
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

- **LIVE 4 Nov:** Curated import opens on a **To import** view (Ready +
  Attention only); published ones under "Already published" / "Show
  everything" (`statusFilter` "todo"). Staged uploads NOT deleted.
  Productions thumbnails fade in on load (`data-loaded`).
- **LIVE 4 Nov: Productions page flash fixed** (its `<style>` was at the END
  of `ProductionManager.tsx`, after 525 rows; moved to the start of `<main>`).

- **WAITING FOR "GO LIVE" (5 Nov): proofing visitors in their own table**
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
  263 bytes with 301 visitors. Ko-fi "buy me a coffee" button: Steve to send
  his Ko-fi link; add to galleries in the same go-live.
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
