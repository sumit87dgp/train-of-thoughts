-- Phase 1: composite type, helper, and API-facing functions (SECURITY DEFINER)

CREATE TYPE app.thought_row AS (
    id          UUID,
    title       TEXT,
    body        TEXT,
    created_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ,
    tags        TEXT[]
);

-- Private helper: not granted to tot_api
CREATE OR REPLACE FUNCTION app._thought_with_tags(p_id UUID)
RETURNS app.thought_row
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app
AS $$
    SELECT
        t.id,
        t.title,
        t.body,
        t.created_at,
        t.updated_at,
        COALESCE(
            array_agg(tg.name ORDER BY LOWER(tg.name))
                FILTER (WHERE tg.name IS NOT NULL),
            '{}'::TEXT[]
        ) AS tags
    FROM app.thoughts t
    LEFT JOIN app.thought_tags tt ON tt.thought_id = t.id
    LEFT JOIN app.tags tg ON tg.id = tt.tag_id
    WHERE t.id = p_id
    GROUP BY t.id, t.title, t.body, t.created_at, t.updated_at;
$$;

CREATE OR REPLACE FUNCTION app.ensure_tag(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app
AS $$
DECLARE
    v_name TEXT := TRIM(p_name);
    v_id   UUID;
BEGIN
    IF v_name IS NULL OR v_name = '' THEN
        RAISE EXCEPTION 'tag name cannot be empty';
    END IF;

    SELECT id INTO v_id
    FROM app.tags
    WHERE LOWER(name) = LOWER(v_name);

    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    BEGIN
        INSERT INTO app.tags (name) VALUES (v_name)
        RETURNING id INTO v_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT id INTO v_id
            FROM app.tags
            WHERE LOWER(name) = LOWER(v_name);
    END;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_thought(
    p_title     TEXT,
    p_body      TEXT,
    p_tag_names TEXT[] DEFAULT '{}'
)
RETURNS app.thought_row
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app
AS $$
DECLARE
    v_id       UUID;
    v_tag_name TEXT;
    v_tag_id   UUID;
BEGIN
    INSERT INTO app.thoughts (title, body)
    VALUES (p_title, COALESCE(p_body, ''))
    RETURNING id INTO v_id;

    FOREACH v_tag_name IN ARRAY COALESCE(p_tag_names, '{}')
    LOOP
        IF TRIM(v_tag_name) <> '' THEN
            v_tag_id := app.ensure_tag(TRIM(v_tag_name));
            INSERT INTO app.thought_tags (thought_id, tag_id)
            VALUES (v_id, v_tag_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RETURN app._thought_with_tags(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION app.get_thought(p_id UUID)
RETURNS app.thought_row
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app
AS $$
DECLARE
    v_row app.thought_row;
BEGIN
    SELECT * INTO v_row FROM app._thought_with_tags(p_id);
    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'thought not found: %', p_id;
    END IF;
    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION app.update_thought(
    p_id        UUID,
    p_title     TEXT,
    p_body      TEXT,
    p_tag_names TEXT[] DEFAULT '{}'
)
RETURNS app.thought_row
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app
AS $$
DECLARE
    v_tag_name TEXT;
    v_tag_id   UUID;
BEGIN
    UPDATE app.thoughts
    SET title = p_title,
        body = COALESCE(p_body, ''),
        updated_at = now()
    WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'thought not found: %', p_id;
    END IF;

    DELETE FROM app.thought_tags WHERE thought_id = p_id;

    FOREACH v_tag_name IN ARRAY COALESCE(p_tag_names, '{}')
    LOOP
        IF TRIM(v_tag_name) <> '' THEN
            v_tag_id := app.ensure_tag(TRIM(v_tag_name));
            INSERT INTO app.thought_tags (thought_id, tag_id)
            VALUES (p_id, v_tag_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RETURN app._thought_with_tags(p_id);
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_thought(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app
AS $$
BEGIN
    DELETE FROM app.thoughts WHERE id = p_id;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.list_thoughts(
    p_limit     INT,
    p_offset    INT,
    p_tag_name  TEXT DEFAULT NULL
)
RETURNS SETOF app.thought_row
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app
AS $$
    SELECT
        t.id,
        t.title,
        t.body,
        t.created_at,
        t.updated_at,
        COALESCE(
            array_agg(tg.name ORDER BY LOWER(tg.name))
                FILTER (WHERE tg.name IS NOT NULL),
            '{}'::TEXT[]
        ) AS tags
    FROM app.thoughts t
    LEFT JOIN app.thought_tags tt ON tt.thought_id = t.id
    LEFT JOIN app.tags tg ON tg.id = tt.tag_id
    WHERE p_tag_name IS NULL
       OR EXISTS (
            SELECT 1
            FROM app.thought_tags tt2
            JOIN app.tags tg2 ON tg2.id = tt2.tag_id
            WHERE tt2.thought_id = t.id
              AND LOWER(tg2.name) = LOWER(TRIM(p_tag_name))
        )
    GROUP BY t.id, t.title, t.body, t.created_at, t.updated_at
    ORDER BY t.updated_at DESC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION app.search_thoughts(
    p_query  TEXT,
    p_limit  INT,
    p_offset INT
)
RETURNS SETOF app.thought_row
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app
AS $$
    SELECT
        t.id,
        t.title,
        t.body,
        t.created_at,
        t.updated_at,
        COALESCE(
            array_agg(tg.name ORDER BY LOWER(tg.name))
                FILTER (WHERE tg.name IS NOT NULL),
            '{}'::TEXT[]
        ) AS tags
    FROM app.thoughts t
    LEFT JOIN app.thought_tags tt ON tt.thought_id = t.id
    LEFT JOIN app.tags tg ON tg.id = tt.tag_id
    WHERE TRIM(p_query) <> ''
      AND (
            t.title ILIKE '%' || TRIM(p_query) || '%'
         OR t.body ILIKE '%' || TRIM(p_query) || '%'
        )
    GROUP BY t.id, t.title, t.body, t.created_at, t.updated_at
    ORDER BY t.updated_at DESC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION app.list_tags()
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app
AS $$
    SELECT t.id, t.name
    FROM app.tags t
    ORDER BY LOWER(t.name);
$$;

ALTER TYPE app.thought_row OWNER TO tot_owner;

ALTER FUNCTION app._thought_with_tags(UUID) OWNER TO tot_owner;
ALTER FUNCTION app.ensure_tag(TEXT) OWNER TO tot_owner;
ALTER FUNCTION app.create_thought(TEXT, TEXT, TEXT[]) OWNER TO tot_owner;
ALTER FUNCTION app.get_thought(UUID) OWNER TO tot_owner;
ALTER FUNCTION app.update_thought(UUID, TEXT, TEXT, TEXT[]) OWNER TO tot_owner;
ALTER FUNCTION app.delete_thought(UUID) OWNER TO tot_owner;
ALTER FUNCTION app.list_thoughts(INT, INT, TEXT) OWNER TO tot_owner;
ALTER FUNCTION app.search_thoughts(TEXT, INT, INT) OWNER TO tot_owner;
ALTER FUNCTION app.list_tags() OWNER TO tot_owner;
