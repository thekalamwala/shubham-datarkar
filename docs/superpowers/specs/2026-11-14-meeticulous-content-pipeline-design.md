# Meeticulous content pipeline — KW → article → publish → outreach

**Status:** design, pending approval — publish handoff = **Hybrid** (see Approaches)
**Date:** 2026-11-14
**Home repo:** `Shubham Datarkar Website` (KalamAI lives here)
**Touches:** `Meeticulous` repo (publish side), a Windows-local bridge, external check/outreach providers

---

## Intent and why

Automate Meeticulous's blog engine end to end: founder supplies a keyword, the system
researches + writes an SEO/AEO/GEO-grade article, passes quality + plagiarism + AI-slop
gates, waits for one manual approval, publishes to the Meeticulous blog, and then runs
link-building outreach to the real sites the article cites — asking each for a reciprocal
link, truthfully, because the article already backlinks them.

Why now: KalamAI (the research + writing engine) already exists and is strong. Meeticulous
already has a safe, headless publisher (`blog-autopost`). The two have never been connected.
Connecting them turns a manual, per-post effort into a repeatable pipeline, and adds the one
thing neither side does today — outreach — where the contact list is a free byproduct of how
KalamAI writes.

## Goals

1. Founder enters a keyword in KalamAI; the system produces a Meeticulous-branded article.
2. Article passes KalamAI's existing SEO/AEO score-gate **plus** new plagiarism + AI-slop gates.
3. One manual approve/reject step before anything goes public.
4. Approved article publishes to the Meeticulous blog through the **existing** `blog-autopost`
   path (no new merge/seed machinery).
5. After publish, outreach: for each article, reach ~30 real human contacts at the cited
   domains with a reciprocal-link ask, tracked, compliant, honest.

## Non-goals

- No new blog CMS. Meeticulous's own CMS editor is ~2 months out; this pipeline is the sole
  publisher until then and must not block or pre-empt that editor.
- No rebuild of the Meeticulous publisher. v1 makes only **surgical** edits to `blog-seo-optimizer`
  (raise the outbound-link cap, preserve KalamAI's inline backlinks, add the plagiarism/AI check on
  the final text). `blog-autopost`'s merge / dual-seed / blog-only-diff safety stays untouched.
- No full multi-tenant rebuild of KalamAI. A light "brand" concept only.
- No autonomous publishing. Human approval is mandatory in v1.

## Anti-goals (failure even if it "works")

- Publishing an article that is thin, plagiarized, or reads as AI slop. The gates exist to make
  this impossible, not optional.
- Outreach that burns Meeticulous's sending-domain reputation or violates anti-spam law. A fast
  but spammy outreach engine is worse than none.
- Fabricated backlinks or claims. KalamAI only links pages it actually crawled; outreach only
  claims links that were actually placed.
- KalamAI (cloud) holding Meeticulous repo or DB secrets. The publish side stays local.

## Constraints (discovered, not assumed)

- **KalamAI** = a feature inside `Shubham Datarkar Website` (Next.js 16 + Supabase + Anthropic
  SDK), deployed on Vercel. Pipeline: `kalamai_analyses` (SERP → crawl top 10 → extract →
  distill terms → brief) then `kalamai_articles` (outline → answer-first draft → inline
  backlinks → self-critique → score-gate). Writer already accepts `brandFacts` and
  `contentType` params. It **stops at the finished article** — no publish step exists.
- **The cited domains are already stored** in `kalamai_pages` (the crawled top-10). These are
  exactly the outreach targets, and the backlinks to them are genuine.
- **Meeticulous blog** is **not** MDX files. Posts are entries in
  `client/src/data/blogPosts.js` + a link graph in `client/src/data/blogClusters.js`.
  Front-matter shape a draft must carry: `title / slug / category / date / author / excerpt`
  (category = a `CATEGORY_THEME` key; author = the exported `AUTHOR`).
- **Existing publish flow** (`blog-autopost`, run headless via Windows Task Scheduler,
  `claude -p "/blog-autopost marketing"`):
  draft `.md` in `D:\My Marketing\Meeticulous\Blog`
  → `blog-seo-optimizer` (SERP, cannibalization, link-build, score, **gate**, PR)
  → `blog-autopost` (verify blog-only diff → squash-merge → seed **both** Supabase DBs: prod
  Mumbai + staging Tokyo → archive draft to `_posted/`). Runs in a dedicated git worktree,
  single-run lock, blog-only diff enforced before merge.
- KalamAI runs on Vercel; the drafts folder, repo, DB secrets, and `gh` auth are all on the
  **Windows machine**. Any publish bridge lives local, not in the cloud app.

## Approaches considered

- **A — Pipeline inside KalamAI's app (CHOSEN).** Run KW → article → checks → approval inside
  KalamAI; feed approved articles to Meeticulous's existing publisher. Reuses the engine and DB
  wholesale; fastest to a live article. Cost: Meeticulous content-ops ride on the personal
  site's app. *Chosen by founder.*
- B — KalamAI exposed as an API, orchestrated from Meeticulous. Cleaner separation, more
  plumbing up front. Deferred; A is built so this stays cheap later.
- C — Port KalamAI into Meeticulous. Most work, risk of drift from the original engine. Rejected.

**Publish handoff** (how KalamAI output reaches the Meeticulous blog):

- **Hybrid — keep KalamAI's links, keep the optimizer's useful checks (CHOSEN).** KalamAI writes +
  gates (SEO/AEO) + gets human approval. On publish, the optimizer still runs — cannibalization
  check, internal cluster-linking, SERP, 90/90 scoring — **but** its outbound-link cap is raised and
  it is told to **preserve KalamAI's inline backlinks**, and the plagiarism + AI-slop gate runs on the
  **final** optimized text before merge. Keeps outreach scale + honesty + Meeticulous's checks.
  Cost: small, surgical `blog-seo-optimizer` edits (so not literally "untouched"). *Chosen by founder.*
- True reuse-as-is (optimizer owns the text). Rejected: its 4-link cap cuts ~10 cited domains to 4,
  which breaks the "we linked you" outreach premise for the rest and guts the 30-contact goal; and the
  published rewrite was never plagiarism/AI-checked.
- Full slim (bypass the optimizer, KalamAI sole author). Rejected for v1: loses the optimizer's
  cannibalization check + internal cluster-linking unless ported.

## Architecture (decided how)

```
KalamAI (Vercel)                         Windows-local                 Meeticulous (Render + Supabase)
────────────────                         ─────────────                 ───────────────────────────────
KW ─▶ analysis ─▶ brief ─▶ article                                      
        │ (brandFacts = Meeticulous)                                    
        ▼                                                               
   SEO/AEO score-gate (KalamAI)                                        
        ▼                                                               
   manual APPROVE  (KalamAI admin UI)                                   
        ▼                                                               
   article marked approved,                                            
   Meeticulous-format .md available via API                            
        │                                                               
        └───────────────▶  bridge: blog-autopost "Select" step pulls   
                           approved KalamAI drafts ─▶ writes .md into    
                           D:\My Marketing\Meeticulous\Blog             
                                     │                                   
                                     ▼                                   
                           blog-autopost run: optimizer                 
                           (KalamAI backlinks preserved, cap raised)     
                           ─▶ plagiarism + AI-slop gate on FINAL text    
                           (new) ─▶ PR → merge → seed both DBs → LIVE
                                     │                                   
        ◀────── publish result ──────┘                                   
        ▼                                                               
   outreach: cited domains (kalamai_pages) ─▶ find ~30 contacts ─▶ draft ─▶ send ─▶ track
```

**Brand concept (light):** a `Brand` record (initially one row: Meeticulous) carrying brand
facts (fed to the writer's `brandFacts`), the Meeticulous `author`, a keyword→`CATEGORY_THEME`
mapping, and the outreach sender identity. Articles reference a brand. Not full tenancy.

**Bridge:** the KalamAI↔publish seam is a pull, not a push — `blog-autopost`'s *Select* step is
extended to first fetch newly-approved Meeticulous articles from a KalamAI API endpoint and
write them as drafts, before its normal draft-folder selection. This keeps all repo/DB/gh
secrets on the local runner and keeps KalamAI cloud-only. Auth: a single API token.

## Phases (sequenced to reach a live article fast)

### Phase 1 — Brand + Meeticulous-format export
- Add the `Brand` record + Meeticulous seed (facts, author, category map).
- KalamAI article flow can target a brand; writer receives Meeticulous `brandFacts`.
- Exporter: finished KalamAI article (content blocks + meta + inline backlinks) →
  Meeticulous-format `.md` string. Correct front-matter (title/slug/category/date/author/excerpt);
  inline `[anchor](url)` backlinks preserved; KalamAI's **FAQ block emitted in a form the optimizer
  re-recognizes as a structured FAQ** (so FAQPage schema survives, not flattened to prose).
- **Done when:** given a completed KalamAI article, the exporter emits a draft `.md` that
  `blog-seo-optimizer` parses with no front-matter errors, its inline backlinks intact, and its FAQ
  recognized as a structured block.

### Phase 2 — Approve + bridge + first live article
- KalamAI admin UI: approve / reject a finished article; approved articles exposed via a
  read API (token-auth) as Meeticulous-format drafts + a "mark published" callback.
- Extend `blog-autopost` *Select* to pull approved KalamAI drafts into the drafts folder.
- Surgical `blog-seo-optimizer` edits: raise the outbound-link cap (to ≥ KalamAI's placed count) and
  instruct the optimizer to **preserve KalamAI's inline backlinks** through its optimize/verify passes.
- On publish success, call KalamAI back to mark the article published + record the live URL.
- **Done when:** a keyword entered in KalamAI results, after one approval, in a live post on the
  Meeticulous blog (both DBs seeded), with KalamAI showing it as published.

### Phase 3 — Harden the gate (plagiarism + AI-slop) on the FINAL text
- The gated artifact must be the text that actually ships, i.e. the **optimizer's output**, not the
  KalamAI pre-approval draft (they differ). So the plagiarism + AI-detection checks run inside
  `blog-seo-optimizer`'s quality gate, after optimize, before PR — via one external provider.
- Flow: KalamAI SEO/AEO gate → human approve → optimizer (links preserved) → **plagiarism + AI gate on
  final text** → pass ⇒ PR/merge; fail ⇒ NEEDS WORK, PR held open, KalamAI shows "rejected at publish
  gate" + reason. Override = an explicit, logged human action.
- **Done when:** an optimized post that fails either check cannot merge without an explicit, logged
  override, and the failure is surfaced back in KalamAI.

### Phase 4 — Outreach engine (own design pass before build)
- Source: the outbound backlinks that **actually shipped** in the live post — read the published post
  and reconcile against `kalamai_pages`. Only domains truly linked get pitched. This is what keeps the
  "we added your link" promise honest, and it is why Phase 2 preserves KalamAI's links through the
  optimizer (so the honest outreach surface stays ~10 domains, not ~4).
- Enrich: find ~30 real contacts per article (deep SERP + a contact-finding provider), dedup
  across articles, respect a per-domain cap.
- Draft + send: personalized reciprocal-link emails from the Meeticulous sender identity;
  warm-up, throttle, per-domain/day limits.
- Track + comply: opens/replies/link-placed; one-click unsubscribe, suppression list,
  CAN-SPAM/GDPR footer and consent posture.
- **Done when:** for a published article, the system assembles a verified ~30-contact list,
  sends compliant personalized outreach, and tracks responses — **but this phase gets its own
  design doc before any code**, because sending infra + legal posture are load-bearing.

## Open decisions (surface before/within the relevant phase)

1. **Plagiarism + AI-slop provider (Phase 3).** Candidates: Originality.ai (does both,
   SEO-focused), Copyleaks, Winston. Recommendation: Originality.ai for single-vendor coverage.
   Needs: account + API key + budget sign-off. *Founder decision — cost + vendor.*
2. **Outreach sending identity + providers (Phase 4).** Which sending domain/mailbox (a
   Meeticulous subdomain is safer than the root), contact-finding provider (Hunter / Apollo /
   Dropcontact), and ESP vs. the existing Nodemailer SMTP. *Founder decision — deferred to the
   Phase 4 design.*
3. **Outreach volume + consent posture (Phase 4).** 30 cold contacts/article is the stated
   target; legal footing (legitimate-interest + opt-out vs. stricter) sets daily caps and
   footer. *Founder decision — deferred to Phase 4 design.*

## Left to the builder

- Exact KalamAI DB shape for `Brand` + approval state + publish/outreach status columns.
- The read API + callback contract and token handling between KalamAI and the local bridge.
- `blog-autopost` *Select*-step patch (additive; keep all existing safety rules, especially the
  blog-only-diff merge guard).
- Keyword→category mapping defaults and slug generation rules.
- Idempotency: an approved article must publish exactly once even if the bridge runs repeatedly.
- The read API + approve action filter by **`brand = Meeticulous` across users**, not by the caller's
  `user_id` (KalamAI is per-user ownership-scoped; the single-token server auth must see all
  Meeticulous articles regardless of which user authored them).
- New outbound-link cap value in `blog-seo-optimizer`: set to ≥ KalamAI's actual placed-link count
  (no fixed 4); confirm the raised cap doesn't trip the optimizer's own quality heuristics.
