-- Phase 0: API role with schema usage only (function EXECUTE grants in Phase 1)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tot_api') THEN
    CREATE ROLE tot_api WITH LOGIN PASSWORD 'tot_api_dev';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA app TO tot_api;
