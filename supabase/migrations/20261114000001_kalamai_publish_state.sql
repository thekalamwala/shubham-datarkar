-- Publish-state columns for the Meeticulous content pipeline on kalamai_articles.
--
-- These drive the Meeticulous publish flow: an article is approved, its content is
-- read over the API, then marked published (or rejected). publish_state holds one of
-- 'none' | 'approved' | 'published' | 'rejected'. brand says which brand config the
-- article was written for. published_url and publish_note record where it went live
-- and any note from the publish step.
--
-- Idempotent; safe to re-run. The CHECK is inline on add column if not exists, so it
-- is only attached when the column is created. Re-running skips it cleanly. Existing
-- rows get the 'none' default and nothing else is touched.
alter table public.kalamai_articles
  add column if not exists brand text,
  add column if not exists publish_state text not null default 'none'
    check (publish_state in ('none', 'approved', 'published', 'rejected')),
  add column if not exists published_url text,
  add column if not exists publish_note text;
