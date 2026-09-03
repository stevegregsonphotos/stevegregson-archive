# Steve Gregson Archive — Project Context & Recovery Checkpoint

> **Purpose**
>
> Persistent handover/recovery record for development of `stevegregson.com` /
> `stevegregson-archive`.
>
> If development resumes in a new ChatGPT conversation, read this file first,
> then inspect the repository before making changes.

---

# CURRENT CHECKPOINT

**Checkpoint date:** 3 September 2026

## Exact position

We are building the private **Backstage → Clients** address book.

Confirmed completed:

1. Clients navigation item exists in Backstage.
2. `/admin/clients` exists and its visual design has been approved.
3. Contacts contain Name, Company and Email.
4. Add Contact works.
5. Companies are remembered/reused.
6. Search/filter UI exists.
7. The Add Contact modal originally remained open after submission.
8. This was fixed by adding `onSubmit={() => setIsOpen(false)}` to the contact form.
9. Steve tested the fix and confirmed it works.
10. `lib/proofing/contacts-repository.ts` contains:
   - `getProofingCompanies`
   - `getProofingContacts`
   - `getProofingContact`
   - `createProofingCompany`
   - `createProofingContact`
   - `updateProofingContact`
   - `deleteProofingContact`
11. `updateProofingContact` and `deleteProofingContact` were added successfully.
12. `npx tsc --noEmit` passed after those repository methods were added.

## IMPORTANT — next change is NOT confirmed

The next proposed step was to wire `updateProofingContact` and
`deleteProofingContact` into:

`app/admin/clients/page.tsx`

through server actions and then make the existing **Edit** button functional.

A Terminal command for that change was supplied, but Steve did **not** confirm
running it.

Therefore:

**DO NOT ASSUME `app/admin/clients/page.tsx` HAS BEEN MODIFIED.**

Before continuing, inspect the repository.

The intended next feature is **Edit Contact**.

Clicking Edit should open the existing contact modal populated with:

- Name
- Company
- Email

and provide:

- Save changes
- Delete contact

After that, complete the address-book basics and integrate contacts into gallery
recipient selection.

---

# WORKING RELATIONSHIP / DEVELOPMENT RULES

These rules are important.

## How to give Steve code changes

Steve prefers explicit, incremental instructions.

For precise/mechanical edits, strongly prefer a **Terminal command that makes the
change automatically in the correct location**. Python heredoc scripts are
acceptable.

For substantial or risky changes, prefer a **complete replacement file**, one
file at a time.

Do not make Steve hunt through a file for vague locations.

If manual editing is unavoidable:

- state the exact file path;
- state current line numbers;
- if line numbers may have changed, inspect first with `nl -ba`, `grep`, etc.

Steve has explicitly said:

> I dont need you to continue telling me the why. Just tell me the fix.

Keep implementation instructions focused.

## Controlled changes

Use:

**one controlled change → test/refresh → next change**

After TS/TSX changes run:

```bash
npx tsc --noEmit
```

Quote shell paths containing dynamic route names such as `[id]` and `[slug]`.

## Safety rule — VERY IMPORTANT

All validation/safety checks in an automated edit script must happen **before any
file is written**.

Safe pattern:

1. Read file.
2. Verify every expected anchor/state.
3. Build modified content in memory.
4. Verify resulting content.
5. Only then write file.

Avoid shell sequences where a failed edit is followed by an unconditional write.

## Whitespace-sensitive replacements

Literal replacements have failed because of tabs/spaces/formatting.

If an exact replacement fails:

- inspect `repr()` of the relevant source; or
- use a tightly scoped regex/structural anchor.

Do not repeatedly guess whitespace.

---

# GIT / REPOSITORY

Repository:

`stevegregson-archive`

Remote:

`https://github.com/stevegregsonphotos/stevegregson-archive.git`

Development branch:

`website-redesign`

Production branch:

`main`

Important recent commits:

```text
cbe54c0 Refine responsive homepage hero
c5520a0 Reorder and update selected work galleries
b7d6473 Vercel analytics / speed insights work
869c77c Expand and secure client proofing workflow
```

Proofing milestone push:

```text
f1c0ecd..869c77c website-redesign -> website-redesign
```

## DO NOT TOUCH THIS FILE

The following file is deliberately untracked:

`content/selected-work.backup-2026-08-30.json`

Never stage, delete, overwrite or commit it.

At the last known clean milestone the working tree contained only:

```text
?? content/selected-work.backup-2026-08-30.json
```

The Clients/address-book work after that milestone may now introduce additional
changes. Inspect Git before committing.

---

# PRODUCT / DESIGN CONSTITUTION

The site is Steve Gregson's theatre photography portfolio and client proofing
system.

Aesthetic:

- dark;
- theatrical;
- editorial;
- image-led;
- warm near-black backgrounds;
- gold accent;
- pale off-white typography.

Primary gold:

`#c7a369`

Avoid generic SaaS/dashboard appearance, cheap-looking cards, unnecessary bands,
crowded interfaces, and redesigning already-approved desktop public pages.

Images should dominate, particularly on mobile.

The global desktop header should not be redesigned without agreement.

---

# PUBLIC WEBSITE

Portfolio categories:

- Production
- Rehearsals
- Marketing & PR

There is sticky category navigation.

Production ordering is based on production month/year, not upload date.

Existing features include password protection/cookie flow, Next Image,
AVIF/WebP, Sharp and AI metadata pre-publish integration.

Homepage hero commit:

`cbe54c0 Refine responsive homepage hero`

Selected Work commit:

`c5520a0 Reorder and update selected work galleries`

---

# VERCEL

Vercel project:

`stevegregson-archive`

Production branch:

`main`

Preview deployments come from:

`website-redesign`

## IMPORTANT DOMAIN RULE

`www.stevegregson.com` is **not** currently connected to this Vercel project.

**DO NOT CONNECT OR ALTER THE LIVE DOMAIN WITHOUT STEVE'S EXPLICIT AGREEMENT.**

Local network IP previously used:

`192.168.86.59`

Phone testing can use, when still applicable:

`http://192.168.86.59:3000`

Stale Turbopack errors involving `.next` were previously fixed by killing
`next dev`, clearing `.next`, and restarting the dev server.

---

# PROOFING SYSTEM

The proofing system intentionally follows the familiar **ShootProof workflow and
interaction model** where practical.

Steve wants ShootProof copied closely in workflow/layout/behaviour where
practical, not merely used as loose inspiration. Branding, colours and typography
remain Steve/Backstage.

Core flow:

**Galleries → individual gallery management → client gallery → photo viewing →
favourites → submit favourites**

---

# IMPORTANT PROOFING FILES

```text
app/admin/proofing/ProofingGalleryBrowser.tsx
app/admin/proofing/NewGalleryModal.tsx
app/admin/proofing/[id]/ProofingPresentationEditor.tsx
app/admin/proofing/[id]/ProofingSelectionCopy.tsx
app/admin/proofing/[id]/ProofingUpload.tsx
app/admin/proofing/[id]/ProofingImageActions.tsx
app/admin/proofing/[id]/ProofingImageSort.tsx
app/admin/proofing/[id]/ProofingUrlEditor.tsx
app/admin/proofing/[id]/ProofingSettingsEditor.tsx
app/admin/proofing/[id]/ProofingWorkspace.tsx
app/admin/proofing/[id]/ProofingMediaWorkspace.tsx
app/admin/proofing/[id]/page.tsx
app/admin/proofing/layout.tsx
app/admin/proofing/new/page.tsx
app/admin/proofing/page.tsx
app/admin/proofing/proofing.css
app/admin/proofing/watermarks/...
app/proofing/[slug]/ProofingGalleryClient.tsx
app/proofing/[slug]/ProofingGalleryEntry.tsx
app/proofing/[slug]/ProofingGalleryWelcome.tsx
app/proofing/[slug]/page.tsx
app/proofing/layout.tsx
app/proofing/proofing.css
components/admin/ProofingIntroTemplatesManager.tsx
lib/proofing/intro-templates.ts
lib/proofing/types.ts
lib/proofing/repository.ts
lib/proofing/contacts-repository.ts
```

---

# ADMIN PROOFING — APPROVED STATE

Gallery browser was rebuilt in a ShootProof-style workflow and Steve liked it.

New Gallery modal works. Fields:

- Gallery Name
- Shoot Date
- Client (optional)

Presets are not currently implemented.

Individual gallery workspace is familiar/user-friendly. Tabs persist through the
URL.

Branding Save button was fixed.

Intro templates persist in:

`data/proofing-settings/intro-templates.json`

Media workspace supports bulk selection and bulk delete.

Steve does not currently want manual drag ordering. File numbers/capture time are
sufficient.

Watermark settings/library/live preview were implemented and accepted.

Download configuration supports:

- `none`
- `web`
- `selected`

The `"full"` value remains only for shared type compatibility.

---

# CLIENT GALLERY — APPROVED STATE

Authentication/intro flow:

**cover + email → Continue → authenticated gallery with photographs behind intro
modal → acknowledge intro → modal closes**

Important: **Do not add another large hero after authentication.**

Steve explicitly rejected this.

Authenticated gallery should show compact gallery identity and get to photographs
quickly.

Grid:

- Desktop: 4 columns
- <= 900px: 3 columns
- <= 600px: 2 columns

Selected photograph state:

- Unselected: `♡`
- Selected: `✓ SELECTED`

The selected state is a solid gold rectangular treatment. Steve likes it.

Sticky Photos/Favourites toolbar accepted.

Send action appears only in Favourites.

Favourites review heading includes count badge.

Submission API/email works.

---

# FAVOURITES STATE

Favourites view persists on refresh using `?view=favourites`.

Known hydration-safe implementation:

```tsx
const [view, setView] =
  useState<"all" | "favourites">("all");

useEffect(() => {
  const params = new URLSearchParams(
    window.location.search,
  );

  if (params.get("view") === "favourites") {
    setView("favourites");
  }
}, []);
```

`changeView(nextView)` updates state and query using `history.replaceState`.

Submission toolbar logic:

```tsx
const toolbarAction =
  favourites.length === 0
    ? null
    : hasPendingChanges
      ? {
          label: "Send changes",
          status: "Changes not sent",
        }
      : isSelectionCurrent
        ? {
            label: null,
            status: `✓ ${submittedFavourites.length} favourite${
              submittedFavourites.length === 1
                ? ""
                : "s"
            } sent`,
          }
        : {
            label: "Send favourites",
            status: null,
          };
```

Final submitted wording:

```text
✓ FAVOURITES SENT
2 photographs sent
date/time
```

Sticky submitted state example:

`✓ 2 FAVOURITES SENT`

Pending state:

`CHANGES NOT SENT` + gold `SEND CHANGES`.

---

# FULLSCREEN VIEWER

Viewer supports previous/next arrows, keyboard navigation, touch swipe,
Favourites-only cycling when viewing Favourites, and body scroll lock.

Touch swipe uses native touch handlers and `useRef`, with a 40px horizontal
threshold.

Swipe works in both directions and Steve confirmed it.

**DO NOT ALTER THE SWIPE IMPLEMENTATION UNLESS THERE IS A NEW BUG.**

`.proofing-viewer-stage` likely has:

```css
touch-action: pan-y;
```

There is a duplicate nested `.proofing-viewer-actions` div in current source. It
was not causing a reported problem. Do not clean it up merely for tidiness.

The Vercel development toolbar "N" icon previously obscured an arrow. Steve hid
the toolbar and confirmed the actual viewer arrows work.

Mobile fullscreen image sizing was improved and accepted.

---

# VIEWER BODY SCROLL LOCK

Implementation intentionally depends on:

```tsx
const isViewerOpen = viewerImageId !== null;
```

rather than viewer image ID, avoiding unlock/relock when changing photographs.

Known accepted implementation:

```tsx
useEffect(() => {
  if (!isViewerOpen) return;
  const scrollY = window.scrollY;
  const previousBodyPosition = document.body.style.position;
  const previousBodyTop = document.body.style.top;
  const previousBodyWidth = document.body.style.width;
  const previousBodyOverflow = document.body.style.overflow;

  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.position = previousBodyPosition;
    document.body.style.top = previousBodyTop;
    document.body.style.width = previousBodyWidth;
    document.body.style.overflow = previousBodyOverflow;
    window.scrollTo(0, scrollY);
  };
}, [isViewerOpen]);
```

Preserve unless a genuine issue requires changing it.

---

# DOWNLOADS

Individual route:

`app/api/proofing/download/route.ts`

It validates safe segments, gallery existence, live/expiry state, permission,
visitor session, image membership and filename. For `"selected"`, the image must
be in the visitor's current favourites.

Files come from:

`data/proofing-images/<gallery.id>/<webFilename>`

Response is a WebP attachment with safe filename and `private, no-store`.

Client wording:

- web: `Download photo`
- selected + favourited: `Download selected photo`

## Bulk ZIP

Installed:

```bash
npm install archiver
npm install --save-dev @types/archiver
```

npm reported 5 high severity vulnerabilities and pending install scripts involving
`sharp@0.34.5` and `unrs-resolver@1.12.2`.

Do **not** blindly run `npm audit fix --force`.

Bulk route:

`app/api/proofing/download-all/route.ts`

Uses:

```ts
import { ZipArchive } from "archiver";
```

and:

```ts
const archive = new ZipArchive({
  zlib: {
    level: 6,
  },
});
```

Bulk route validates gallery/session/permissions and downloads all web images or
current selected favourites as appropriate. ZIP filenames are deduplicated.
Selected ZIP gets `-selected` suffix. Response is `application/zip`,
`private, no-store`.

Current ZIP is buffered in memory using PassThrough/chunks. Revisit for very large
production galleries.

UI:

- `Download all N photos`
- `Download N selected photos`
- no bulk control for `none`

Both modes were tested successfully.

---

# CLIENT PROOFING API SECURITY

Six client-facing routes were accounted for:

```text
app/api/proofing/download-all/route.ts
app/api/proofing/download/route.ts
app/api/proofing/enter/route.ts
app/api/proofing/favourite/route.ts
app/api/proofing/image/route.ts
app/api/proofing/submit/route.ts
```

Enter and Image already handled live/expiry restrictions. Downloads are protected.

Favourite and Submit received a live/expiry guard so an existing visitor session
cannot bypass later gallery availability changes.

Known guard:

```ts
const hasExpiredByDate =
  Boolean(gallery.expiresAt) &&
  new Date(
    gallery.expiresAt as string,
  ).getTime() < Date.now();

if (
  gallery.status !== "live" ||
  hasExpiredByDate
) {
  return NextResponse.json(
    {
      ok: false,
      message:
        "This gallery is not currently available.",
    },
    { status: 403 },
  );
}
```

`app/proofing/[slug]/page.tsx` also handles gallery availability before session
lookup.

Major proofing milestone:

`869c77c Expand and secure client proofing workflow`

Before that commit, `npx tsc --noEmit` and `git diff --cached --check` passed.

---

# PERSISTENT STORAGE — MAJOR PRODUCTION BLOCKER

The proofing system currently relies on runtime filesystem data.

That is **not durable production storage on Vercel**.

Do not consider proofing production-ready until persistent storage is implemented.

Planned architecture:

**PostgreSQL + S3-compatible object storage**

Database/storage should preferably remain independent of the eventual website
host. Final website host has not yet been decided.

Use repository abstractions so approved UI does not need redesigning when storage
changes.

---

# CURRENT PROOFING REPOSITORY

`lib/proofing/repository.ts` is currently synchronous filesystem JSON using:

`data/proofing`

Known responsibilities include:

- `ensureProofingDirectory()`
- `galleryFilePath(id)`
- `getProofingGalleries()`
- `getProofingGallery(id)`
- `getProofingGalleryBySlug(slug)`
- `saveProofingGallery(gallery)`
- `updateProofingGallery(id, updater)`

This repository is an intentional migration boundary for PostgreSQL later.

---

# PRIVATE CLIENTS / CONTACTS ADDRESS BOOK

Private, admin-only address book for people/companies Steve repeatedly sends
proofing galleries to.

Fields only:

- Name
- Company
- Email

Do not turn this into a full CRM unless Steve asks.

Desired functionality:

- search by name/company/email;
- select saved contacts when sending a gallery;
- multiple recipients;
- arbitrary one-off emails without saving;
- potentially offer Add to Contacts later.

## RECIPIENTS VS VISITORS — IMPORTANT

These concepts must remain separate.

**Gallery recipients** are people Steve deliberately selected/sent the gallery to.

**Visitors** are people who actually entered the gallery.

A forwarded gallery may create a visitor who was never an original recipient.

Do not collapse these models.

Possible later activity display:

```text
SENT TO
Sarah Jones       National Theatre
James Smith       National Theatre
press@example.com

CLIENT ACTIVITY
Sarah Jones       Viewed · date
James Smith       favourites · Sent
newperson@...      Viewed · Not an original recipient
```

---

# ADDRESS BOOK TYPES

`lib/proofing/types.ts` contains `ProofingCompany`, `ProofingContact` and
`ProofingGalleryRecipient`.

Recipient details are snapshotted so historical galleries do not change when a
contact is later edited.

`ProofingGallery` has optional:

```ts
recipients?: ProofingGalleryRecipient[];
```

This is deliberately separate from visitors and optional while existing
filesystem galleries migrate to persistent storage.

TypeScript passed after this work.

---

# ADDRESS BOOK REPOSITORY

File:

`lib/proofing/contacts-repository.ts`

Temporary filesystem-backed storage:

```text
data/proofing-address-book/companies.json
data/proofing-address-book/contacts.json
```

Uses `randomUUID` from `node:crypto`.

Email is normalised lowercase.

Confirmed functions:

- `getProofingCompanies()`
- `getProofingContacts()`
- `getProofingContact(id)`
- `createProofingCompany(name)`
- `createProofingContact(...)`
- `updateProofingContact(...)`
- `deleteProofingContact(...)`

`createProofingCompany` performs case-insensitive company deduplication.

`createProofingContact` rejects duplicate email and invalid company IDs.

`updateProofingContact` validates name/email/contact/company, prevents duplicate
email belonging to another contact, preserves existing data and updates
`updatedAt`.

`deleteProofingContact` verifies the contact exists and removes it.

This filesystem implementation is temporary and should eventually move to
PostgreSQL.

---

# BACKSTAGE CLIENTS NAVIGATION

Global admin layout:

`app/admin/layout.tsx`

Navigation includes:

```text
Dashboard
Upload & publish
Productions
Proofing
Clients
Watermarks
Selected Work
Settings
```

Clients is immediately after Proofing and before Watermarks.

This has been visually confirmed. Do not redo it.

---

# CLIENTS PAGE

Files:

```text
app/admin/clients/page.tsx
app/admin/clients/ClientsAddressBook.tsx
```

Visual state was shown to Steve and approved.

Page includes private address-book heading, intro, Add Contact button, search,
contact count and empty state.

Preserve the design.

`ClientsAddressBook.tsx` is a `"use client"` component. Current features include:

- search state;
- filtering by name/email/company;
- Add Contact modal;
- company-name map;
- datalist of known companies;
- required Name;
- optional Company;
- required Email;
- Cancel;
- Add contact;
- backdrop close;
- contact list;
- Edit button expected to be nonfunctional at current confirmed checkpoint.

The Add Contact modal previously stayed open after submission. This was fixed
with:

```tsx
onSubmit={() => setIsOpen(false)}
```

Steve confirmed the fix.

---

# INTENDED ADDRESS BOOK NEXT STEPS

1. Finish Edit Contact.
2. Save changes.
3. Delete contact.
4. Make duplicate-email errors friendly if necessary.
5. Test search/filter after edits.
6. Integrate contacts into gallery recipient selection.

Gallery recipient UI should eventually use chips/autocomplete:

- choose saved contacts;
- multiple contacts;
- arbitrary email;
- one-off email need not be saved;
- possibly Add to Contacts later.

Gallery must support more than one recipient.

Snapshot recipient name/company/email so later address-book edits do not rewrite
historical gallery recipient details.

---

# CLIENTS PAGE SERVER ACTION — KNOWN STATE

At the last confirmed state, `app/admin/clients/page.tsx` had a working
`createContact(formData)` server action.

The next proposed change was to add `updateContact` and `deleteContact` server
actions using repository functions.

**VERIFY WHETHER THAT CHANGE WAS ACTUALLY APPLIED BEFORE CONTINUING.**

---

# UPLOAD / IMAGE STORAGE

Proofing uploads currently create resized WebP images, approximately maximum 2400
and quality 82.

Original uploaded files are not currently retained.

Web-size downloads are sufficient for Steve's current proofing requirement.

Persistent object storage is still required before production use.

---

# PARKED WORK

Screenshot deterrence is a second-pass feature. Ideas discussed include desktop
screenshot-key interception, mobile visual deterrence/half-image blur shift and a
disclaimer. Screenshots cannot be prevented completely.

Proof disclaimer is not yet implemented.

Do not prioritise these before persistent storage and core production readiness
unless Steve changes priorities.

---

# ROADMAP FROM CURRENT CHECKPOINT

Immediate:

**Finish Clients Edit / Save / Delete**

Then:

**Wire private Contacts into proofing gallery recipient selector**

Requirements:

- autocomplete saved contacts;
- multiple recipient chips;
- arbitrary one-off emails;
- snapshot recipient information;
- recipients remain separate from visitors.

Then production persistence:

**PostgreSQL + S3-compatible object storage**

Adapt repositories rather than redesigning approved UI.

Then Vercel preview end-to-end testing.

Later:

- screenshot deterrence;
- proof disclaimer;
- dependency/security audit;
- reconsider in-memory ZIP buffering for very large galleries.

---

# BEFORE A FUTURE CHATGPT CONTINUES DEVELOPMENT

Do not immediately produce code based solely on this checkpoint.

First inspect repository state relevant to the next task.

At the current checkpoint, at minimum run:

```bash
git status --short
```

and inspect whether update/delete wiring was actually applied:

```bash
grep -nE 'updateProofingContact|deleteProofingContact|updateContact|deleteContact|updateContact=|deleteContact=' \
  'app/admin/clients/page.tsx' \
  'app/admin/clients/ClientsAddressBook.tsx' \
  'lib/proofing/contacts-repository.ts'
```

Then continue from actual state.

---

# CHECKPOINT MAINTENANCE

Update this document at meaningful milestones, especially:

- Current checkpoint
- Exact position
- Confirmed completed
- Next step
- Known blockers
- Relevant Git commit

Do not rewrite the whole historical record after every tiny change.

The purpose is that if ChatGPT crashes, Steve can start a new conversation,
provide this file/repository, and development can continue without reconstructing
the project from memory.

---

# FINAL INSTRUCTION TO FUTURE CHATGPT

Steve has spent substantial time approving the behaviour and appearance of this
site.

Do not treat existing implementation as disposable.

Before altering approved behaviour:

1. inspect it;
2. understand why it exists;
3. make the smallest necessary change;
4. test TypeScript;
5. let Steve visually/functionally test it;
6. then move on.

When in doubt, preserve approved behaviour.
