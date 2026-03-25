## Critical: Security

| # | File | Issue |
|---|------|-------|
| 1 | `shared/storage.ts` `updateUserProfile()` | Accepts `Partial<User>` and spreads directly into UPDATE. A caller could pass `{ isAdmin: 1 }` or `{ status: "active" }` to escalate privileges. Must whitelist allowed fields. |
| 2 | `shared/auth.ts:101-105` | Google OAuth login has **no status check**. An archived user can sign in via Google without restriction. Local strategy checks status but Google does not. |
| 3 | `api/admin/users/index.ts` GET | `storage.listAllUsers()` returns full `User` objects **including password hashes** in the JSON response. Other auth endpoints strip the `password` field. |
| 4 | `shared/storage.ts` `getTasksByFileId()` | The `permissions` parameter is accepted but **never used** — visibility check is skipped entirely. Any authenticated user can read tasks for any file. |
| 5 | `api/admin/users/[id]/reset-password.ts:23` | Uses `Math.random()` for password generation. Not cryptographically secure — use `crypto.randomBytes()`. |
| 6 | `shared/jwt.ts:45` | `jwt.verify()` does not specify `algorithms: ["HS256"]`. Should be explicit to prevent algorithm confusion. |
| 7 | `shared/jwt.ts:73-77` | Cookie parsing splits on `=` without limit. Base64-encoded JWTs containing `=` get truncated. Fix: `.split('=', 2)` or use a proper cookie parser. |

## Critical: Bugs

| # | File | Issue |
|---|------|-------|
| 8 | `api/admin/users/[id]/permissions.ts:28-37` | **Permission reset bug**: Partial permission updates default unspecified permissions to `0`. E.g., sending only `{ canWriteMetadata: true }` silently strips all other permissions. Should default to the user's current value. |
| 9 | `client/src/components/license-content-manager.tsx:239-242` | Wouter `<Link>` wrapping an `<a>` tag = nested anchors (invalid HTML). The inner `target="_blank"` is ignored; links open in-SPA instead of new tab. |
| 10 | `client/src/pages/browse.tsx:279-311` | `seriesGroups` is rebuilt on every render (not memoized). The `filteredSeries` useMemo depends on it, but since it's a new object ref each time, the memo is always invalidated — effectively useless. |
| 11 | `client/src/pages/tasks.tsx:272-286` | `filteredTasks` is computed via `useMemo` but **never used** in render. Only `groupedTasks` is rendered. Dead computation every render. |
| 12 | `shared/storage.ts` `upsertMetadataFile()` | When update fails (returns undefined), it **silently falls through to creating a new record** instead of erroring. This can create duplicates when the user lacks update permission. |

## High: Performance

| # | File | Issue |
|---|------|-------|
| 13 | `shared/schema.ts` — `metadataFiles` table | **No indexes** on the most-queried table. Missing indexes: `createdBy`, `groupId`, `title`, `seriesId`, `createdAt`, `licenseId`. Every listing/visibility query is a full table scan. |
| 14 | `shared/schema.ts` — `tasks` table | No index on `metadataFileId` despite every task query joining on it. |
| 15 | Multiple endpoints | **No pagination**: `getAllMetadataFiles()`, `listLicenses()`, `listTasks()`, `getAllSeries()`, `listAllUsers()` all return unbounded results. |
| 16 | `client/src/pages/all-files.tsx` | Renders ALL metadata files with no pagination or virtualization. Thousands of files = thousands of DOM nodes. |
| 17 | `shared/storage.ts` `consumeNextId()` fallback | When no `next_id` setting exists, fetches **ALL metadata file IDs** just to find the max. Should use `MAX()` or `ORDER BY id DESC LIMIT 1`. |
| 18 | `shared/storage.ts` `bulkUpdateMetadata()` | One UPDATE per item in a loop (up to 500 sequential queries). Should batch. |
| 19 | `shared/ai-service.ts:81` | `listLicenses()` loads **entire license table into memory** to filter in JS. Should be a database query. |
| 20 | `shared/ai-chat.ts:493-589` | AI tool-call loop has **no max iterations**. If the model loops, it runs indefinitely consuming API credits. |

## High: Mobile / Responsiveness

| # | File | Issue |
|---|------|-------|
| 21 | `client/src/pages/edit-season.tsx` | 10-column table with fixed widths (~700px min). No responsive breakpoints. **Unusable below 800px.** |
| 22 | `client/src/pages/admin.tsx:537-640` | User management table (8 columns) has **no `overflow-x-auto`** wrapper. Causes full-page horizontal overflow on mobile. |
| 23 | `client/src/pages/licenses.tsx:196-333` | License table (7 columns) also missing `overflow-x-auto`. Same horizontal overflow. |
| 24 | `client/src/pages/view-file.tsx:160-205` | Header has 4 buttons in a row with no `flex-wrap`. Overflows on small screens. |
| 25 | `client/src/pages/all-files.tsx:351-397` | 5 action buttons per row in `flex-shrink-0` container. Overflows on mobile. |
| 26 | `client/src/pages/dashboard.tsx:182` | View/Edit buttons use `opacity-0 group-hover:opacity-100` — **completely invisible on touch devices** with no hover. |

## Medium: Data Integrity

| # | File | Issue |
|---|------|-------|
| 27 | `shared/schema.ts` — booleans as integers | All boolean fields (`isAdmin`, `canReadMetadata`, `catchUp`, `draft`, etc.) use `integer` 0/1 instead of PostgreSQL native `boolean`. Wastes storage, forces `=== 1` comparisons everywhere. |
| 28 | `shared/schema.ts` — missing constraints | `users.status` and `users.fileVisibility` are `varchar` with no CHECK constraint. Any arbitrary string can be stored. |
| 29 | `shared/schema.ts:371-375` — missing cascades | `tasks.metadataFileId` and `tasks.createdBy` have no `onDelete` cascade. Deleting a file or user leaves orphaned tasks causing JOIN failures. Same for `userDefinedTags.userId`. |
| 30 | `shared/schema.ts:74` | `licenses.licenseFeeAmount` stored as `text`. Monetary amounts should use `numeric`/`decimal` for proper comparison and aggregation. |
| 31 | `shared/schema.ts:262-271` | `batchSeasonSchema.episodeCount` max is 100, but the `seasons` array has **no max length**. 1000 seasons x 100 episodes = 100,000 records in one request. |
| 32 | `shared/storage.ts` `getRecentMetadataFiles()` | `LIMIT` applied to joined rows, not distinct files. A file with 3 licenses consumes 3 of the limit. `limit=10` may return only 4 distinct files. |

## Medium: Code Quality

| # | File | Issue |
|---|------|-------|
| 33 | `client/src/pages/create-license.tsx` + `edit-license.tsx` | Entire license form (30+ fields, ~400 lines) is **duplicated** across both files. Should be a shared `LicenseForm` component. |
| 34 | `client/src/pages/view-file.tsx` + `edit-file.tsx` | `defaultValues` mapping from `MetadataFile` to form values is duplicated verbatim. |
| 35 | `client/src/pages/admin.tsx:776-954` | 8 nearly identical permission Switch toggles, each manually rebuilding the full permissions object. Should be a loop or helper. |
| 36 | `client/src/App.tsx:44-242` | ~20 routes with identical `<Route><AuthenticatedRoute>{perm ? <ProtectedLayout><Page/></ProtectedLayout> : <Redirect/>}</AuthenticatedRoute></Route>` boilerplate. Should be config-driven. |
| 37 | `client/src/pages/edit-license.tsx:44,51,87,107` | 4 `console.log`/`console.error` statements left in production code. |
| 38 | `client/src/pages/edit-file.tsx:244-251` | `prepareMutationData` function defined but never called. Dead code. |
| 39 | `client/src/components/metadata-form.tsx:249-261` | `{generatedId && false && (...)}` — the `false` ensures this block never renders. Dead code. |
| 40 | `client/src/components/metadata-form.tsx` vs `batch-create-form.tsx` | Content type values differ: `"program"/"commercial"` vs `"Short Form"/"Long Form"/"Ad"/"Campaign"`. Data created through one form is invalid in the other. |
| 41 | `client/src/hooks/use-auth.tsx:32` | Logout calls `queryClient.invalidateQueries()` with **no filter**, refetching every cached query. Each fires a 401 since the user just logged out, potentially flooding error toasts. |
| 42 | `client/src/pages/pending.tsx` + `pending-approval.tsx` | Two pages serving the same purpose with different implementations. One is likely dead code. |
| 43 | `client/src/components/batch-create-form.tsx:1-4` | `useState`, `useForm`, `zodResolver`, and schema imports are all unused. `form` prop is `any`. |

## Low: Polish

| # | File | Issue |
|---|------|-------|
| 44 | `client/src/pages/not-found.tsx:15` | Shows "Did you forget to add the page to the router?" — developer message, not user-friendly. |
| 45 | `client/src/pages/ai-upload.tsx:433` | "Seperate" misspelled twice (should be "Separate"). |
| 46 | `client/src/pages/dashboard.tsx:79` | "Welcome back here's what's going on..." — missing comma after "back". |
| 47 | `client/src/pages/register.tsx:67` + `batch-create.tsx:104` | `setTimeout(() => setLocation("/"), 2000)` — forced redirect prevents user from reviewing results. |
| 48 | `client/src/components/time-input.tsx:29` | Typing "3" as first character clears the field (rejects `h1 > 2`). User must type "03" — unintuitive. |

---

## Recommendations — what to tackle first

**Immediate fixes** (security + broken behavior):
- #1, #2, #3 — privilege escalation, OAuth bypass, password hash leak
- #8 — permission reset bug (data loss on every partial admin update)
- #7 — JWT cookie parsing truncation

**Quick wins** (high impact, small changes):
- #13, #14 — add database indexes (biggest perf improvement for effort)
- #22, #23 — add `overflow-x-auto` to table containers (2-line fix each)
- #26 — make hover-only buttons always visible on mobile (`md:opacity-0 md:group-hover:opacity-100`)
- #37 — remove console.logs
- #10 — wrap `seriesGroups` in `useMemo`
- #11, #38, #39 — delete dead code

**Medium-term refactors:**
- #33, #34 — extract shared `LicenseForm` and `defaultValues` mapper
- #15, #16 — add pagination to list endpoints and the all-files page
- #36 — config-driven route definitions in App.tsx
- #27 — migrate integer booleans to actual PostgreSQL booleans (breaking schema change, plan carefully)
