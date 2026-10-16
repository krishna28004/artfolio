-- Forward-only repair: publishing a staged exhibition must not discard
-- artwork geometry. The historical publication migration remains unchanged.
CREATE OR REPLACE FUNCTION public.set_exhibition_publication(
  p_publish boolean, p_actor text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_setting public.exhibition_settings%ROWTYPE;
BEGIN
  SELECT * INTO current_setting FROM public.exhibition_settings WHERE id = 'main' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'exhibition_missing'; END IF;
  IF p_publish THEN
    LOCK TABLE public.artworks IN SHARE ROW EXCLUSIVE MODE;
    UPDATE public.artworks SET wall_identifier = NULL, updated_at = now()
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
