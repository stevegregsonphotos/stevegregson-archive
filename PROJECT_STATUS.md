# Steve Gregson Archive — Project Status (handover)

Last updated: 29 October 2026, 10:20 (London)

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
  bigger changes `OPENAI_API_KEY=x npx next build` ("DATABASE_URL not
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
  Steve Gregson Storage/config`; Steve set it to 5 on 29 Oct); keeps ALL
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
  - Takes venue + show + date from `Client / Show - Month Year / … / Web`
    however deep; "In Rehearsal" folders get that suffix.
- **Curated archive import** (Backstage › Curated import): uploads the
  curator output and publishes productions (reads each file before upload
  to avoid Safari "Load failed").

## Waiting / in progress

- **WAITING FOR "GO LIVE" (29 Oct): People search more forgiving**
  (`components/directory/PeopleSearch.tsx`). It was already case-insensitive;
  now curly/straight apostrophes match, hyphens = spaces, and words can be
  typed in any order. Archive search (`app/archive/ArchiveExplorer.tsx`)
  already ignored case; not changed.

- **WAITING FOR "GO LIVE" (29 Oct):** Mac app no longer removes a show's
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
