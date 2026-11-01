-- ============================================================================
-- 0003_seed_personas.sql
-- Seeds the six persona rows. Idempotent (upsert) so it is safe to re-run.
-- Mirrors lib/content/fixtures.ts. engineer/trader/photographer are published;
-- artist/ride/gamer stay unpublished until they have real content.
-- ============================================================================

insert into personas (slug, label, eyebrow, heading, body, accent, cta, points, is_published, "order")
values
  ('engineer', 'Engineer Mode', 'Developer + Software Engineer',
   'I design fast, scalable web products with premium UX.',
   'Building clean systems, modern interfaces, and reliable backends from idea to launch.',
   '#3b82f6', 'View engineering projects',
   array['Next.js + TypeScript','System architecture','API and backend integration'],
   true, 0),

  ('trader', 'Trader Mode', 'Quant Mind + Risk Discipline',
   'I track setups, probabilities, and execution with system-first thinking.',
   'Focused on process quality, risk control, and repeatable decisions across market cycles.',
   '#22c55e', 'Explore trading journal',
   array['Risk-managed strategy','Data-backed journaling','Daily review workflow'],
   true, 1),

  ('photographer', 'Photographer Mode', 'Lens Focus + Composition',
   'I capture light, shape stories, and design visuals.',
   'From portraits to street scenes, I focus on framing, timing, and atmosphere.',
   '#ec4899', 'View photography',
   array['Portrait lighting','Street composition','Editing + color grading'],
   true, 2),

  ('artist', 'Artist Mode', 'Sketch + Paint', 'I make things by hand.',
   'Drawing and painting across mediums.',
   '#f59e0b', 'View artwork', array['Sketching','Watercolor','Digital'], false, 3),

  ('ride', 'Rider Mode', 'Travel + Ride', 'I ride, and I bring back the story.',
   'Routes, places, and the experiences between them.',
   '#14b8a6', 'View rides', array['Routes','Places','Experiences'], false, 4),

  ('gamer', 'Gamer Mode', 'Play + Collection', 'What I''m playing and where I''ve been.',
   'A living collection across platforms.',
   '#8b5cf6', 'View collection', array['Steam','Epic','Progress'], false, 5)

on conflict (slug) do update set
  label        = excluded.label,
  eyebrow      = excluded.eyebrow,
  heading      = excluded.heading,
  body         = excluded.body,
  accent       = excluded.accent,
  cta          = excluded.cta,
  points       = excluded.points,
  is_published = excluded.is_published,
  "order"      = excluded."order",
  updated_at   = now();
