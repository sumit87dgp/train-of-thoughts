# UI navigation, bootstrap loading, and `ui_sections`

**Date:** 2026-07-08  
**Status:** Documented for a future release — **not required for the current v1 build**

## Context

SPPO Data 360 aims to keep roughly **70–80% of the v2 look and feel** while changing **data sources** behind the same surfaces:

| Surface | v2 | SPPO Data 360 |
|---------|-----|----------------|
| Workload sidebar | Databricks | Postgres (`workloads` catalog) |
| Dashboard analytics | Databricks (browser / live queries) | Databricks → Redis (planned sync) + live fallback |
| Top nav sections | Hardcoded in `static/v2.html`; toggled per mode (e.g. regression hides some tabs) | Proposed: data-driven from Postgres |

The **Automation / PRISM** and **Manual Execution** routes (`/automation`, `/manual`) are parallel product surfaces — not “manual = capture only, no analytics.” Manual will eventually have its own Databricks schema, Redis aggregates, and manual-only sections (e.g. **Map Your Runs**).

A natural question arose: should nav items (Landing Page, Usage Monitoring, AI Insights, Admin, etc.) live in a **Postgres config table** instead of being hardcoded in React — including which route they appear on and which roles can see them?

---

## The question

> When we build everything up and the page loads, it should not happen like nav loads, widgets wait, and different parts load at different times. Maybe we can have a load spinner, but I am not very sure. I was thinking of pushing nav config through Redis so the page gets a consistent snapshot on load.

Two concerns were bundled together:

1. **Dynamic nav config** — Postgres table + optional admin toggles vs hardcoded UI.
2. **Coordinated loading** — avoiding a jarring experience where chrome and content appear at different times.

---

## The answer: patterns and responsibilities

### What you are trying to avoid

This is usually called a **request waterfall** (or **staggered / fragmented loading**): the nav resolves first, then widgets, then filters — each part paints independently.

### Patterns that address it

| Pattern | What it does |
|---------|----------------|
| **Bootstrap / app-init payload** | One API call returns everything needed to render the shell: user, navigation, widget registry, defaults. |
| **BFF (Backend for Frontend)** | The API aggregates Postgres + Redis into one UI-shaped response instead of the browser calling many endpoints. |
| **Unified loading gate** | One spinner (or skeleton shell) until the bootstrap promise settles; then render the full frame at once. |
| **Skeleton UI** | Shell paints immediately; placeholders inside widgets until data arrives (good for widget *values*, less ideal for nav jumping in and out). |

### Redis vs Postgres for nav

**Redis does not fix a waterfall by itself.** It makes each read fast and consistent across API replicas. Fixing “everything pops in at different times” is primarily about **fewer round trips** (bootstrap/BFF) and **one render gate** on the client.

| Data | Store | Why |
|------|-------|-----|
| Nav sections, widget registry, feature flags | **Postgres** (source of truth) | Small config; fits “metadata only in Postgres” ([NFR](../architecture/NFR.md)) |
| Precomputed dashboard widget **answers** | **Redis** | Bounded aggregates; shared across API pods; 30-min sync from Databricks |
| Parsed run analytics | **Databricks** | Source of truth for workload results |

**Practical split:**

```text
Bootstrap (Postgres, one call)      →  nav + section list + widget registry  →  gate: show app chrome
Dashboard payload (Redis, one call) →  all widget values for active section →  skeletons inside widgets OK
```

Nav config is small enough to read from Postgres inside a bootstrap endpoint. Redis earns its place when batching **widget answers**, not because nav rows need caching.

### Guardrail: registry, not a page builder

Postgres config should answer: **“What tabs exist, who sees them, where?”**

It should **not** try to answer: **“How is the page built?”** (arbitrary layouts, component trees). Each section still maps to a known React `component_key`; config controls visibility and data binding, not free-form UI composition.

v2 already does route-specific nav in JavaScript (`setupRegressionUI()` in `static/v2.html` hides/shows tabs per mode). A `ui_sections` table **formalizes** that pattern.

---

## Proposed `ui_sections` table (sketch)

For implementation in a **future release** (e.g. next app version). Not required for the current v1 manual/automation build — hardcoded nav mirroring v2 is acceptable until then.

```sql
-- sppo_data_360.ui_sections
-- Navigation tabs / major app sections (Landing, Usage, Map Your Runs, …)

CREATE TABLE sppo_data_360.ui_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Stable key used in API, React routing, and admin UI
    section_key     TEXT NOT NULL,

    -- Display
    label           TEXT NOT NULL,
    icon            TEXT,                    -- emoji or icon token, e.g. '🏠' or 'home'
    sort_order      SMALLINT NOT NULL DEFAULT 0,

    -- Top-level route: Automation / PRISM vs Manual Execution
    data_source     TEXT NOT NULL,           -- 'automation' | 'manual' | 'both'

    -- Path segment under /automation or /manual
    route_path      TEXT NOT NULL,           -- e.g. 'landing', 'usage', 'map-your-runs'

    -- React view registry lookup (not free-form HTML)
    component_key   TEXT NOT NULL,           -- e.g. 'LandingPage', 'UsageMonitoring'

    -- Visibility
    enabled         BOOLEAN NOT NULL DEFAULT true,
    show_in_nav     BOOLEAN NOT NULL DEFAULT true,  -- false = deep-link only

    -- Auth: v1 dev = empty array (everyone); Phase 2 = App Role names
    required_roles  TEXT[] NOT NULL DEFAULT '{}',

    -- Filter bar, refresh policy, feature flags without schema churn
    config          JSONB NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ui_sections_key_unique
        UNIQUE (section_key),

    CONSTRAINT ui_sections_data_source_check
        CHECK (data_source IN ('automation', 'manual', 'both')),

    CONSTRAINT ui_sections_route_path_check
        CHECK (route_path ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX idx_ui_sections_nav
    ON sppo_data_360.ui_sections (data_source, enabled, show_in_nav, sort_order);
```

### Example `config` JSONB

```json
{
  "show_filter_bar": true,
  "supports_force_refresh": true,
  "default_date_range_days": 30
}
```

Mirrors v2 behavior where the filter bar only appears on Landing + Usage.

### Illustrative seed rows

| section_key | label | data_source | route_path | component_key |
|-------------|-------|-------------|------------|---------------|
| `landing` | Landing Page | both | `landing` | `LandingPage` |
| `usage` | Usage Monitoring | both | `usage` | `UsageMonitoring` |
| `map-your-runs` | Map Your Runs | manual | `map-your-runs` | `MapYourRuns` |
| `ai-insights` | AI Insights | both | `ai` | `AiInsights` |
| `forecasting` | Forecasting | automation | `forecasting` | `Forecasting` |
| `run-debugger` | Run Debugger | both | `debugger` | `RunDebugger` |
| `admin` | Admin | both | `admin` | `Admin` |

### API function (sketch)

```sql
fn_list_ui_sections(
    p_data_source TEXT,                 -- 'automation' | 'manual'
    p_roles       TEXT[] DEFAULT NULL   -- NULL or '{}' = no role filter (v1 dev)
)
```

Filter: `enabled = true`, `data_source IN (p_data_source, 'both')`, and (Phase 2) role overlap with `required_roles`.

Grant `EXECUTE` to `sppo_data_360_api`, consistent with `fn_list_workloads`.

### Optional companion: `ui_widgets` (later)

Nav defines **which page**; widgets define **what is on that page**:

```text
ui_widgets
  widget_key, section_key → ui_sections.section_key,
  sort_order, component_key, redis_key_template,
  data_source_scope, enabled, required_roles, config JSONB
```

A single function such as `fn_get_app_shell(p_data_source, p_section_key)` could return sections + widgets for bootstrap.

---

## Recommended load sequence

```text
Page load
  │
  ├─ 1. GET /api/v1/bootstrap?source=manual
  │      → { user, navigation[], defaultSection, widgets[] }   ← Postgres, one round trip
  │
  └─ 2. Render shell (nav + empty widget slots) — single gate, no partial nav
         │
         └─ 3. GET /api/v1/dashboard?source=manual&section=landing
                → { widgets: { run_summary: {...}, trend: {...}, ... } }   ← Redis batch / pre-baked blob
```

### UI rules of thumb

- **Gate 1:** Do not show top nav until bootstrap returns (short spinner — typically well under 100 ms from Postgres).
- **Gate 2:** Show nav + widget skeletons; fill when the dashboard payload returns.
- **Avoid:** Nav from one React hook and widgets from another, both mounting with no coordination.

This yields stable chrome without Redis for nav. Redis remains valuable for step 3 when many widgets would otherwise each trigger separate API or Databricks calls.

---

## Three-catalog mental model

```text
1. Catalog (Postgres)  → workloads, nav sections, widget definitions
2. Answers (Redis)     → precomputed aggregates per widget × route
3. Truth (Databricks)  → parsed run analytics (automation now; manual schema later)
```

For manual landing pages: same widget types as automation where data exists, but different Redis keys / Databricks schema / sync scope; extra sections (e.g. Map Your Runs) only on manual via nav config.

---

## Implementation timing

| Approach | When |
|----------|------|
| Hardcode nav in React mirroring v2; swap data sources per `/automation` vs `/manual` | **Current v1 build** |
| `ui_sections` migration + `fn_list_ui_sections` + bootstrap endpoint | **Next release** (not super-critical for current launch) |
| Admin UI to enable/disable sections | After Entra App Roles (Phase 2) |
| Redis cache invalidation on admin nav change | Optional; Postgres-only bootstrap is fine until scale demands it |

---

## Related docs

- [ui-routing-layout-and-section-nav.md](../learning/ui-routing-layout-and-section-nav.md) — implemented nested routing (`Layout`, `PageContentLayout`, `SectionNav`)
- [PROJECT_BRIEF.md](../architecture/PROJECT_BRIEF.md) — delivery phases; manual vs automation scope
- [NFR.md](../architecture/NFR.md) — caching model (answers in Redis, config in Postgres)
- [static/v2.html](../../static/v2.html) — legacy nav and regression-mode tab hiding
