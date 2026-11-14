# Meeticulous Content Pipeline — Implementation Plan (Phases 1–3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A keyword entered in KalamAI becomes a Meeticulous-branded article that, after one manual approval, publishes to the Meeticulous blog through the existing `blog-autopost` path — with KalamAI's inline backlinks preserved and plagiarism/AI-slop checked on the final text.

**Architecture:** KalamAI (in the `Shubham Datarkar Website` repo, Vercel) owns KW → research → article → SEO/AEO gate → human approval, then exposes approved Meeticulous drafts over a token-auth API. A local `blog-autopost` run (Meeticulous repo, Windows Task Scheduler) pulls those drafts into its drafts folder and publishes them unchanged except for two surgical `blog-seo-optimizer` edits (keep KalamAI's links; run the plagiarism/AI gate on the final text). No repo/DB secrets ever reach the cloud app.

**Tech Stack:** Next.js 16 (App Router) + Supabase (Postgres) + `@anthropic-ai/sdk` on the KalamAI side; the Meeticulous side is its existing Node scripts + `blog-seo-optimizer`/`blog-autopost` Claude-Code skills; Originality.ai (pending sign-off) for the plagiarism/AI check.

**Spec:** `docs/superpowers/specs/2026-11-14-meeticulous-content-pipeline-design.md`

**Repos:** tasks are tagged `[KalamAI]` (this repo) or `[Meeticulous]` (`../Meeticulous`). Phase 4 (outreach) is a separate plan after its own design — out of scope here.

## Global Constraints

- **Next.js is non-standard here** — read the relevant guide in `node_modules/next/dist/docs/` before writing any framework code (per `AGENTS.md`). [KalamAI]
- **Every change ships via a PR**; never commit to `main`. [both]
- **Supabase migrations are hand-written SQL**, run manually against Supabase. [KalamAI]
- **Meeticulous: never merge inside `blog-seo-optimizer`**; a fresh branch from `origin/main`; `blog-autopost` may only merge a diff limited to `client/src/data/blogPosts.js` + `client/src/data/blogClusters.js`. [Meeticulous]
- **Secrets stay local.** The publish token (`KALAMAI_PUBLISH_TOKEN`) and `ORIGINALITY_API_KEY` live in env; the token authenticates the local bridge to the cloud read API. Never log article bodies or tokens.
- **Author/category must be valid Meeticulous values**: `author` name = `AUTHOR.name` (`Shubham N Datarkar`); `category` = a `CATEGORY_THEME` key (fallback `News`). From `client/src/data/blogPosts.js`.

## Review Focus

- **Article with no FAQ or no backlinks** — exporter must not emit an empty `## FAQ` or malformed front-matter. → Task 2 tests.
- **Approved slug duplicates an already-published Meeticulous slug** — must be skipped, not double-published. → Task 8 (autopost Select already skips known slugs) + Task 5 excludes `published`.
- **Bridge runs twice before the mark-callback lands** — same approved article pulled twice ⇒ duplicate publish. → Task 6 (idempotent mark) + Task 8 (slug skip).
- **Optimizer drops a KalamAI backlink during its passes** — a later outreach would claim a link that isn't live. → Task 7 post-optimize assertion that incoming inline links survive.
- **Approve with brand unset or an invalid category** — `blog-seo-optimizer` step 1 fails on parse. → Task 4 requires `brand` + a valid `category` (defaults to `News`).

---

## Phase 1 — Brand + Meeticulous-format export

### Task 1: Brand config [KalamAI]

**Files:**
- Create: `src/lib/kalamai/brands.ts`
- Test: `src/lib/kalamai/brands.test.ts`

**Interfaces:**
- Produces: `type Brand = { slug: string; brandFacts: string; authorName: string; defaultCategory: string; draftsDir: string }`; `getBrand(slug: string): Brand | undefined`; `BRANDS` record seeded with `meeticulous`.

> ponytail: a config map, not a DB table — brand facts change rarely. Add a table only if brands become user-editable.

- [ ] **Step 1: Write the failing test** — `getBrand("meeticulous")` returns a brand whose `authorName === "Shubham N Datarkar"` and non-empty `brandFacts`; `getBrand("nope")` is `undefined`.
- [ ] **Step 2: Run test, verify it fails** (`vitest run src/lib/kalamai/brands.test.ts`) — FAIL, module missing.
- [ ] **Step 3: Implement** `brands.ts` with the `meeticulous` entry (facts = a short Meeticulous description; `defaultCategory: "News"`; `draftsDir: "D:/My Marketing/Meeticulous/Blog"`).
- [ ] **Step 4: Run test, verify PASS.**
- [ ] **Step 5: Commit** — `feat(kalamai): add brand config with meeticulous`.

### Task 2: Meeticulous-format exporter [KalamAI]

**Files:**
- Create: `src/lib/kalamai/export-meeticulous.ts`
- Test: `src/lib/kalamai/export-meeticulous.test.ts`

**Interfaces:**
- Consumes: `blocksToMarkdown` from `./serialize`; `Brand` from `./brands`; a finished article `{ meta: ArticleMeta; blocks: ContentBlock[] }`.
- Produces: `toMeeticulousDraft(article, brand: Brand, opts?: { category?: string; slug?: string; date?: string }): string` — a full `.md` string: YAML front-matter (`title, slug, category, date, author, excerpt`) + body.

> ponytail: reuse `blocksToMarkdown` (already preserves inline `[text](href)` backlinks). For `slug`, reuse an existing slug util if one exists (`grep -ri slugify src/lib`), else inline `s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")`.

- [ ] **Step 1: Write the failing tests:**
  - front-matter contains all six keys; `author` = `brand.authorName`; `category` = `opts.category ?? brand.defaultCategory`; `excerpt` = `meta.description`.
  - a block carrying an inline link serializes with the `[anchor](https://…)` intact (backlink preserved).
  - when a `faq` block is present, the body contains an `## FAQ` heading immediately before it (so `blog-seo-optimizer` re-parses it as a structured FAQ ⇒ FAQPage schema); when absent, no `## FAQ` and no empty block.
  - an article with zero inline links still produces valid front-matter + body (no crash).
- [ ] **Step 2: Run tests, verify they fail** — exporter missing.
- [ ] **Step 3: Implement** `toMeeticulousDraft`: build front-matter, then `blocksToMarkdown(blocks)`; if a `faq` block exists and isn't already preceded by a FAQ heading, inject `## FAQ`. Escape nothing in the body (Markdown passthrough).
- [ ] **Step 4: Run tests, verify PASS.**
- [ ] **Step 5: Commit** — `feat(kalamai): export finished article as meeticulous markdown draft`.

---

## Phase 2 — Approval + bridge + first live article

### Task 3: DB columns for publish state [KalamAI]

**Files:**
- Create: `supabase/migrations/<timestamp>_kalamai_publish_state.sql`

**Interfaces:**
- Produces: on `kalamai_articles`: `brand text`, `publish_state text not null default 'none'` (`'none'|'approved'|'published'|'rejected'`), `published_url text`, `publish_note text`.

- [ ] **Step 1:** Write the migration (ADD COLUMN × 4, with the default).
- [ ] **Step 2:** Apply it manually against Supabase (per repo convention).
- [ ] **Step 3: Verify** — `select brand, publish_state, published_url from kalamai_articles limit 1` runs without error.
- [ ] **Step 4: Commit** — `feat(kalamai): publish-state columns on articles`.

### Task 4: Approve / reject action + admin control [KalamAI]

**Files:**
- Create: `src/app/api/kalamai/articles/[id]/approve/route.ts`
- Modify: the article view that renders a finished article (add an Approve button + category select) — locate via `grep -rl "article" src/app/tools/kalamai/w` / `src/app/admin/kalamai`.
- Test: `src/app/api/kalamai/articles/[id]/approve/route.test.ts`

**Interfaces:**
- Consumes: `getBrand` (Task 1); the member/admin session (`getMemberContext` + the admin check used elsewhere in `src/app/admin`).
- Produces: `POST .../approve` body `{ brand: string; category?: string; decision: "approve"|"reject"; note?: string }` → on approve sets `brand`, `publish_state='approved'`; on reject sets `publish_state='rejected'`, `publish_note=note`.

- [ ] **Step 1: Write failing tests:** approve on a `complete` article sets `publish_state='approved'` + `brand`; a non-admin caller → 403; an unknown `brand` → 400; a `category` not in `CATEGORY_THEME` → 400 (defaults allowed to `News`).
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** the route (admin-scoped) + wire the button/select in the view.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(kalamai): approve/reject a finished article for a brand`.

### Task 5: Publish read API (token auth) [KalamAI]

**Files:**
- Create: `src/app/api/kalamai/publish/meeticulous/route.ts`
- Test: `src/app/api/kalamai/publish/meeticulous/route.test.ts`

**Interfaces:**
- Consumes: `toMeeticulousDraft` (Task 2), `getBrand` (Task 1), `kalamai_articles` rows.
- Produces: `GET` with header `Authorization: Bearer <KALAMAI_PUBLISH_TOKEN>` → `{ drafts: { id: string; slug: string; markdown: string }[] }` for `brand='meeticulous' AND publish_state='approved'`, **across all users** (service-role query, not ownership-scoped).

- [ ] **Step 1: Write failing tests:** valid token returns the approved article's markdown (slug matches front-matter); missing/wrong token → 401; a `published` or `none` article is excluded; a different brand is excluded.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — constant-time token compare against `process.env.KALAMAI_PUBLISH_TOKEN`; fetch rows; render each via the exporter.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(kalamai): token-auth read API for approved meeticulous drafts`.

### Task 6: Publish mark-back API (idempotent) [KalamAI]

**Files:**
- Create: `src/app/api/kalamai/publish/meeticulous/mark/route.ts`
- Test: `src/app/api/kalamai/publish/meeticulous/mark/route.test.ts`

**Interfaces:**
- Produces: `POST` (same bearer token) body `{ id: string; status: "published"|"rejected"; url?: string; reason?: string }` → sets `publish_state`, `published_url`, `publish_note`. Idempotent: marking an already-`published` row again is a no-op 200.

- [ ] **Step 1: Write failing tests:** `status:"published"` sets `publish_state='published'` + `published_url`; a second identical call is a 200 no-op (no duplicate side effect); `status:"rejected"` stores `reason` in `publish_note` and sets `publish_state='rejected'`; bad token → 401.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** — guarded update (`.eq("id", id)`), return current state.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(kalamai): mark-back API for publish result`.

### Task 7: Preserve KalamAI links + raise outbound cap [Meeticulous]

**Files:**
- Modify: `.claude/skills/blog-seo-optimizer/SKILL.md` (steps 6, 7, and the Quality-gate links condition).

**Interfaces:** none (skill-instruction edit; the scorer only *reports* `links.external`, it does not cap the count — verified in `server/scripts/scoreBlogDraft.mjs`).

- [ ] **Step 1:** Edit step 6 "max 4 outbound" → "outbound links already present in the incoming draft are KalamAI-verified citations: **keep them all**; the optimizer may add internal links + up to a few of its own outbound, but never strips an incoming inline link."
- [ ] **Step 2:** Edit step 7 (claim verification) so it applies only to claims/links the optimizer *adds*, not to the incoming KalamAI links.
- [ ] **Step 3:** Edit the gate's "No broken links / outbound from WebSearch" condition to exempt incoming inline links, and add a check: **after optimize, every inline link present in the input draft is still present in the post object** (else NEEDS WORK).
- [ ] **Step 4: Verify** — run `blog-seo-optimizer` on a sample KalamAI export carrying ~10 inline links; confirm the report shows them retained and `seo/geo ≥ 90` still reachable. Record the run in the PR body.
- [ ] **Step 5: Commit** — `feat(blog): preserve incoming KalamAI backlinks, lift outbound cap`.

### Task 8: Bridge — pull drafts + mark back [Meeticulous]

**Files:**
- Modify: `.claude/skills/blog-autopost/SKILL.md` (Select step + after-publish + NEEDS-WORK path).

**Interfaces:** consumes the read API (Task 5) and mark API (Task 6); `KALAMAI_PUBLISH_URL` + `KALAMAI_PUBLISH_TOKEN` from `server/.env`.

- [ ] **Step 1:** Edit the marketing **Select** step: before listing the drafts folder, `curl` the KalamAI read API; for each returned draft whose `slug` is **not** already in `blogPosts.js` or `_posted/`, write `<slug>.md` into the drafts folder. Then proceed with existing oldest-by-mtime selection.
- [ ] **Step 2:** After a successful publish (seed both DBs ok), `POST` the mark API `{id, status:"published", url}`. On `NEEDS WORK` / gate failure, `POST` `{id, status:"rejected", reason}` so KalamAI surfaces it.
- [ ] **Step 3:** Keep every existing safety rule (blog-only diff before merge, single-run lock, dedicated worktree).
- [ ] **Step 4: Verify** — a dry run: one approved KalamAI article is pulled, optimized, gated, merged, both DBs seeded, and the KalamAI row flips to `published` with the live URL.
- [ ] **Step 5: Commit** — `feat(blog): autopost pulls approved KalamAI drafts and marks results back`.

**Phase 2 done:** a keyword → one approval → a live Meeticulous post, KalamAI showing it `published`.

---

## Phase 3 — Plagiarism + AI-slop gate on the final text

> Provider = Originality.ai (recommended, pending founder sign-off). Isolated behind one script + env key, so the vendor can change without touching the gate.

### Task 9: Originality check script [Meeticulous]

**Files:**
- Create: `server/scripts/checkOriginality.mjs`
- Test: inline `demo()` self-check in the same file (run via `node server/scripts/checkOriginality.mjs --selftest`).

**Interfaces:**
- Produces: CLI `node server/scripts/checkOriginality.mjs <postJson>` → prints `{ plagiarism: number, ai: number, pass: boolean }` (0–100; `pass` = plagiarism ≤ `PLAGIARISM_MAX` AND ai ≤ `AI_MAX`); exit 0 always (the caller reads `pass`). Reads `ORIGINALITY_API_KEY`.

> ponytail: mirror `scoreBlogDraft.mjs`'s shape (temp-JSON in, JSON out). Thresholds are consts with a `ponytail:` note naming them as the tuning knobs.

- [ ] **Step 1: Write the self-check** (`--selftest`): with a stubbed provider response, `{plagiarism:5, ai:3}` ⇒ `pass:true`; `{plagiarism:40, ai:3}` ⇒ `pass:false`; `{plagiarism:5, ai:95}` ⇒ `pass:false`.
- [ ] **Step 2: Run `--selftest`, verify it fails** (script missing).
- [ ] **Step 3: Implement** — extract plain text from the post body, call the provider (stubbed when `--selftest`), apply thresholds.
- [ ] **Step 4: Run `--selftest`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(blog): originality (plagiarism + AI) check script`.

### Task 10: Add originality to the quality gate [Meeticulous]

**Files:**
- Modify: `.claude/skills/blog-seo-optimizer/SKILL.md` (step 9/11 + Quality gate).

**Interfaces:** consumes Task 9; the fail path reuses Task 8's mark-rejected call.

- [ ] **Step 1:** After scoring on the **final** optimized body, run `checkOriginality.mjs`; add a gate condition "originality `pass:true`". `pass:false` ⇒ NEEDS WORK with the scores in the report; override only via an explicit, logged human action in the PR.
- [ ] **Step 2: Verify** — a deliberately plagiarized/AI-pasted draft is blocked (no PR) and the failure reaches KalamAI (`publish_state='rejected'`, note carries the scores).
- [ ] **Step 3: Commit** — `feat(blog): gate publish on plagiarism + AI-slop of the final text`.

**Phase 3 done:** the text that ships is the text that was plagiarism/AI-checked; a failure can't publish without a logged override.

---

## Out of scope (own plan)

- **Phase 4 — outreach engine** (cited-domain → ~30 contacts → send → track → comply). Gets its own design doc + plan; sourcing from the links that actually shipped, per the spec.
