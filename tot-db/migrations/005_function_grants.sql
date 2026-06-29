-- Phase 1: EXECUTE grants on API-facing functions only (not private helpers)

GRANT EXECUTE ON FUNCTION app.ensure_tag(TEXT) TO tot_api;
GRANT EXECUTE ON FUNCTION app.create_thought(TEXT, TEXT, TEXT[]) TO tot_api;
GRANT EXECUTE ON FUNCTION app.get_thought(UUID) TO tot_api;
GRANT EXECUTE ON FUNCTION app.update_thought(UUID, TEXT, TEXT, TEXT[]) TO tot_api;
GRANT EXECUTE ON FUNCTION app.delete_thought(UUID) TO tot_api;
GRANT EXECUTE ON FUNCTION app.list_thoughts(INT, INT, TEXT) TO tot_api;
GRANT EXECUTE ON FUNCTION app.search_thoughts(TEXT, INT, INT) TO tot_api;
GRANT EXECUTE ON FUNCTION app.list_tags() TO tot_api;

-- tot_api must not call private helper directly
REVOKE EXECUTE ON FUNCTION app._thought_with_tags(UUID) FROM tot_api;
