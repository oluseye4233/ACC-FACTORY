-- Versioned publication bytes/metadata must not be edited in place.
CREATE FUNCTION protect_imprima_immutable_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'imprima_files' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Publication file metadata is immutable; create a new version';
    END IF;
  ELSIF OLD.state = 'PUBLISHED' AND OLD.config->>'mode' = 'FINAL' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Published Final documents are immutable; create a new version';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER imprima_file_immutable BEFORE UPDATE ON imprima_files
FOR EACH ROW EXECUTE FUNCTION protect_imprima_immutable_version();
--> statement-breakpoint
CREATE TRIGGER imprima_final_immutable BEFORE UPDATE ON imprima_jobs
FOR EACH ROW EXECUTE FUNCTION protect_imprima_immutable_version();