# Steve Gregson Archive — Project Status (handover)

Last updated: 13 October 2026, 19:40 (London)

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

## Repo, branches, checks

- GitHub: `stevegregsonphotos/stevegregson-archive`. Live branch
  `website-redesign` (Vercel production). Test branch
  `feature/backstage-transfers`. Live is fast-forwarded from the test work:
  `git push origin HEAD:website-redesign` once Steve says go live.
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
  Steve Gregson Storage/config`); keeps top-level client folders; mirrors
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

- Nothing waiting on the test branch (live at `1bdb24c`, 13 Oct 19:40).
- Steve to check Stage Door Jonny (Jez Butterworth) in Productions: the
  import showed "Load failed" but the production exists.
- **Adding missing productions to the archive:** Steve has
  "Missing productions checklist.xlsx" (93 shows not on the site, from a
  Dropbox vs archive comparison on 13 Oct; biggest gaps Jermyn Street,
  Mill Hill School, City Academy, Mountview). Workflow: make the show's
  Dropbox folder available offline → curate → import → tick off → set
  back to online-only. Curated so far: David Copperfield (free route),
  Little Brother (paid route, first test). Stage Door Jonny imported.
- **Moving MOUNTVIEW from Dropbox to Storage:** checklist artifact
  https://claude.ai/artifact/3KaMy6VmDJAe6GRjDx6Rmh — 4 year-batches
  (each ≤ ~170 GB), set each batch online-only in Dropbox as soon as it's
  copied. Steve keeps Dropbox for other clients.
- **Backblaze Computer Backup** (RAW drives, ~20 TB uploading, 1-year
  version history): still to exclude the `Steve Gregson Storage` folder.
- Scheduled tasks: yearly Backblaze drive check (1 Oct); put the Mac app
  back to 7-day offload on 13 Nov 2026.

## Ideas not started

- Optional "transfer sent" confirmation email to Steve (he said no need).
