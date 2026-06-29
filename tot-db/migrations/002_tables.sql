-- Phase 1: tables, indexes, and optional view
-- (001_schema.sql already created app schema in Phase 0)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app.thoughts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL CHECK (char_length(title) <= 500),
    body        TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.tags (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) <= 100)
);

CREATE TABLE IF NOT EXISTS app.thought_tags (
    thought_id UUID NOT NULL REFERENCES app.thoughts (id) ON DELETE CASCADE,
    tag_id     UUID NOT NULL REFERENCES app.tags (id) ON DELETE CASCADE,
    PRIMARY KEY (thought_id, tag_id)
);

CREATE INDEX IF NOT EXISTS thoughts_updated_at_idx
    ON app.thoughts (updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS tags_name_lower_unique
    ON app.tags (LOWER(name));

CREATE INDEX IF NOT EXISTS thought_tags_tag_id_idx
    ON app.thought_tags (tag_id);

CREATE OR REPLACE VIEW app.v_tags AS
SELECT id, name
FROM app.tags
ORDER BY LOWER(name);
