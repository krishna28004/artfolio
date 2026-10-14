-- Keep public visibility, sale availability, and exhibition placement independent.
-- Existing catalog rows stay published; unavailable rows become not-for-sale.
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS draft_wall_identifier text;

-- Initialize sale state only when introducing the column, never overwrite artist edits.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='artworks' AND column_name='sale_status') THEN
  ALTER TABLE public.artworks ADD COLUMN sale_status text NOT NULL DEFAULT 'available';
  UPDATE public.artworks SET sale_status = CASE WHEN is_available THEN 'available' ELSE 'not_for_sale' END;
 END IF;
END $$;
ALTER TABLE public.artworks
  ADD CONSTRAINT artworks_publication_status_check
    CHECK (publication_status IN ('draft', 'published', 'archived')),
  ADD CONSTRAINT artworks_sale_status_check
    CHECK (sale_status IN ('available', 'reserved', 'sold', 'not_for_sale')),
  ADD CONSTRAINT artworks_image_urls_count_check
    CHECK (cardinality(image_urls) <= 8);


UPDATE public.artworks SET image_urls = ARRAY[image_url]
WHERE cardinality(image_urls) = 0;

-- The original seed coordinates target the legacy hall. Move only seed rows
-- still marked with legacy wall names into their existing museum-shell slots.
WITH slots(id, slot_id, pos, rot) AS (VALUES
  ('sorcerer-supreme', 'sanctuary-apex', '[0,1.8,-35.85]'::jsonb, '[0,0,0]'::jsonb),
  ('the-curious-mr-bean', 'entrance-west', '[-7.85,1.6,24]'::jsonb, '[0,1.5707963267948966,0]'::jsonb),
  ('luminous-veil', 'main-west-1', '[-9.85,1.6,12]'::jsonb, '[0,1.5707963267948966,0]'::jsonb),
  ('sovereign-gaze', 'main-west-2', '[-9.85,1.6,0]'::jsonb, '[0,1.5707963267948966,0]'::jsonb),
  ('the-dreamer', 'main-east-1', '[9.85,1.6,12]'::jsonb, '[0,-1.5707963267948966,0]'::jsonb),
  ('behind-the-lens', 'main-east-2', '[9.85,1.6,0]'::jsonb, '[0,-1.5707963267948966,0]'::jsonb),
  ('monsoon-child', 'west-gallery-1', '[-25.85,1.6,3]'::jsonb, '[0,1.5707963267948966,0]'::jsonb),
  ('tears-in-the-rain', 'west-gallery-2', '[-25.85,1.6,9]'::jsonb, '[0,1.5707963267948966,0]'::jsonb),
  ('radiant-spirit', 'east-wing-1', '[25.85,1.6,3]'::jsonb, '[0,-1.5707963267948966,0]'::jsonb),
  ('chrome-elegy', 'east-wing-2', '[25.85,1.6,11]'::jsonb, '[0,-1.5707963267948966,0]'::jsonb)
)
UPDATE public.artworks AS a SET wall_identifier = slots.slot_id,
  position_3d = slots.pos, rotation_3d = slots.rot
FROM slots WHERE a.id = slots.id AND a.wall_identifier IN ('west', 'east', 'north')
 AND a.position_3d = CASE a.id
  WHEN 'luminous-veil' THEN '[-24.92,2.1,-28]'::jsonb
  WHEN 'sovereign-gaze' THEN '[-24.92,2.1,-12]'::jsonb
  WHEN 'monsoon-child' THEN '[-24.92,2.1,4]'::jsonb
  WHEN 'tears-in-the-rain' THEN '[-24.92,2.1,20]'::jsonb
  WHEN 'the-dreamer' THEN '[24.92,2.1,-28]'::jsonb
  WHEN 'behind-the-lens' THEN '[24.92,2.1,-12]'::jsonb
  WHEN 'radiant-spirit' THEN '[24.92,2.1,4]'::jsonb
  WHEN 'chrome-elegy' THEN '[24.92,2.1,20]'::jsonb
  WHEN 'the-curious-mr-bean' THEN '[-10,2.1,-39.92]'::jsonb
  WHEN 'sorcerer-supreme' THEN '[10,2.1,-39.92]'::jsonb END
 AND a.rotation_3d = CASE
  WHEN a.id IN ('the-curious-mr-bean', 'sorcerer-supreme') THEN '[0,0,0]'::jsonb
  WHEN a.id IN ('the-dreamer', 'behind-the-lens', 'radiant-spirit', 'chrome-elegy') THEN '[0,-1.5707963267948966,0]'::jsonb
  ELSE '[0,1.5707963267948966,0]'::jsonb END;

UPDATE public.artworks SET draft_wall_identifier = wall_identifier
WHERE draft_wall_identifier IS NULL AND wall_identifier IN (
  'sanctuary-apex', 'entrance-west', 'main-west-1', 'main-west-2',
  'main-east-1', 'main-east-2', 'west-gallery-1', 'west-gallery-2',
  'east-wing-1', 'east-wing-2');

ALTER TABLE public.artworks ADD CONSTRAINT artworks_draft_museum_slot_check
  CHECK (draft_wall_identifier IS NULL OR draft_wall_identifier IN (
    'sanctuary-apex', 'entrance-west', 'main-west-1', 'main-west-2',
    'main-east-1', 'main-east-2', 'west-gallery-1', 'west-gallery-2',
    'east-wing-1', 'east-wing-2'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_artworks_active_museum_slot
  ON public.artworks(wall_identifier)
  WHERE publication_status <> 'archived' AND wall_identifier IN (
    'sanctuary-apex', 'entrance-west', 'main-west-1', 'main-west-2',
    'main-east-1', 'main-east-2', 'west-gallery-1', 'west-gallery-2',
    'east-wing-1', 'east-wing-2');

CREATE UNIQUE INDEX IF NOT EXISTS idx_artworks_draft_museum_slot
  ON public.artworks(draft_wall_identifier)
  WHERE publication_status <> 'archived' AND draft_wall_identifier IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.exhibition_settings (
  id text PRIMARY KEY,
  is_published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exhibition_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exhibition_settings FROM PUBLIC, anon, authenticated;
INSERT INTO public.exhibition_settings(id, is_published) VALUES ('main', true)
ON CONFLICT (id) DO NOTHING;

-- The owner publishes all staged placements together, or hides the exhibition.
CREATE OR REPLACE FUNCTION public.set_exhibition_publication(
  p_publish boolean, p_actor text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_setting public.exhibition_settings%ROWTYPE;
BEGIN
  SELECT * INTO current_setting FROM public.exhibition_settings WHERE id = 'main' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'exhibition_missing'; END IF;
  IF p_publish THEN
    LOCK TABLE public.artworks IN SHARE ROW EXCLUSIVE MODE;
    UPDATE public.artworks SET wall_identifier = NULL, position_3d = NULL,
      rotation_3d = NULL, updated_at = now()
      WHERE publication_status <> 'archived' AND wall_identifier IS NOT NULL;
    UPDATE public.artworks SET wall_identifier = draft_wall_identifier, updated_at = now()
      WHERE publication_status = 'published' AND draft_wall_identifier IS NOT NULL;
  END IF;
  UPDATE public.exhibition_settings SET is_published = p_publish, updated_at = now()
    WHERE id = 'main';
  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
    VALUES (p_actor, CASE WHEN p_publish THEN 'exhibition_published' ELSE 'exhibition_unpublished' END,
      'exhibition', 'main', jsonb_build_object('published', p_publish));
  RETURN p_publish;
END $$;
REVOKE ALL ON FUNCTION public.set_exhibition_publication(boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_exhibition_publication(boolean,text) TO service_role;

-- Service-role admin requests bypass RLS; anonymous catalog access sees published rows only.
DROP POLICY IF EXISTS "Allow public read on artworks" ON public.artworks;
CREATE POLICY "Published artwork catalog" ON public.artworks
  FOR SELECT TO anon, authenticated USING (publication_status = 'published');

CREATE INDEX IF NOT EXISTS idx_artworks_publication_order
  ON public.artworks(publication_status, display_order, created_at DESC);

-- Portfolio images are intentionally public. Commission references and deliverables
-- remain in the separate commission-private bucket.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('artworks-public', 'artworks-public', true, 12582912,
  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Record every artwork write in the same transaction as its row change.
CREATE OR REPLACE FUNCTION public.audit_artwork_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
    VALUES ('owner', 'artwork_delete', 'artwork', OLD.id,
      jsonb_build_object('title', OLD.title, 'publication_status', OLD.publication_status));
    RETURN OLD;
  END IF;
  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
  VALUES ('owner', 'artwork_' || lower(TG_OP), 'artwork', NEW.id,
    jsonb_build_object('title', NEW.title, 'publication_status', NEW.publication_status,
      'sale_status', NEW.sale_status));
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.audit_artwork_write() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS artwork_write_audit ON public.artworks;
CREATE TRIGGER artwork_write_audit AFTER INSERT OR UPDATE OR DELETE ON public.artworks
  FOR EACH ROW EXECUTE FUNCTION public.audit_artwork_write();

-- Telemetry is recorded and aggregated by the server view endpoint. Public table
-- reads expose pseudonymous visitor records; direct writes bypass deduplication.
DROP POLICY IF EXISTS "Allow public insert on artwork_views" ON public.artwork_views;
DROP POLICY IF EXISTS "Allow public select on artwork_views" ON public.artwork_views;
REVOKE ALL ON public.artwork_views FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, artwork_id, ip_hash, viewed_at) ON public.artwork_views FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.artwork_views TO service_role;
DO $$
DECLARE sequence_name text;
BEGIN
  sequence_name := pg_get_serial_sequence('public.artwork_views', 'id');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', sequence_name);
  END IF;
END $$;
