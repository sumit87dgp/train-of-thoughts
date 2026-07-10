# UI routing: Layout, PageContentLayout, and SectionNav

**Date:** 2026-07-08  
**Status:** Implemented in v1 (hardcoded `sectionNav.js`); sidebar moved into `PageContentLayout` — **source-aware fetch still to do**

## Context

After Phase 1, the workload sidebar lived in the global `Layout`. Section navigation (Dashboard, Map Runs, AI Insights, etc.) was added as a **reusable nav bar** shared by `/automation` and `/manual`, with different items per route (Map Runs is manual-only).

A follow-up question: how are `Layout`, `PageContentLayout`, and `SectionNav` wired together — and why is `Sidebar` still common to both routes when data sources may differ?

### Naming: what is this layer called?

In UI/UX and front-end frameworks, the hierarchy is usually described as:

| Term | Typical meaning in this app |
|------|----------------------------|
| **App shell** / **root layout** | `Layout` — persistent chrome (header, user, data-source toggle) |
| **Nested layout** / **route layout** | `PageContentLayout` — React Router’s term for a layout route with its own `<Outlet />` |
| **Section** / **view** | Dashboard, Map Runs, etc. — the active tab’s page content |
| **Workspace** (product UX) | `/automation` vs `/manual` — parallel areas of work with shared patterns |

`DataSourceShell` was renamed to **`PageContentLayout`** — the layout for the **main content column** under the app shell: section tab bar plus the outlet for the active page. It pairs with `SectionNav` (tabs) and section pages such as `SectionPlaceholder`. The `source` prop (`automation` \| `manual`) denotes which data-source branch is active.

Other valid names teams use: `SectionLayout`, `WorkspaceLayout`, `ModuleLayout`. **`PageContentLayout`** emphasizes that this layer wraps page content (nav + body), distinct from the global `Layout` chrome.

---

## Route table (`App.jsx`)

React Router uses **nested routes**. Each parent route can render a layout component with an `<Outlet />` where child routes mount.

```text
BrowserRouter (main.jsx)
└── App / Routes
    └── Route path="/"  element={<Layout />}                    ← outer layout
        ├── index → redirect /automation/dashboard
        ├── Route path="automation"  element={<PageContentLayout source="automation" />}
        │   ├── index → redirect dashboard
        │   ├── dashboard      → SectionPlaceholder
        │   ├── ai-insights    → SectionPlaceholder
        │   ├── forecasting    → SectionPlaceholder
        │   ├── run-debugger   → SectionPlaceholder
        │   └── admin          → SectionPlaceholder
        └── Route path="manual"  element={<PageContentLayout source="manual" />}
            ├── index → redirect dashboard
            ├── dashboard      → SectionPlaceholder
            ├── map-runs       → SectionPlaceholder          ← manual only
            ├── ai-insights    → SectionPlaceholder
            ├── forecasting    → SectionPlaceholder
            ├── run-debugger   → SectionPlaceholder
            └── admin          → SectionPlaceholder
```

Example URL **`/manual/map-runs`** resolves to:

```text
Layout
└── main (via Outlet)
    └── PageContentLayout (source="manual")
        ├── Sidebar
        ├── SectionNav (manual items incl. Map Runs)
        └── SectionPlaceholder "Map Runs"
```

---

## Two `<Outlet />` chain

| # | Component | File | Outlet renders |
|---|-----------|------|----------------|
| 1 | `Layout` | `sppo-data-360-ui/src/components/Layout.jsx` | `PageContentLayout` for the matched `/automation` or `/manual` branch |
| 2 | `PageContentLayout` | `sppo-data-360-ui/src/components/PageContentLayout.jsx` | Section page (`SectionPlaceholder` today) for `dashboard`, `map-runs`, etc. |

```mermaid
flowchart TB
  subgraph Layout["Layout (path /) — header only"]
    H[Header: Automation | Manual]
    subgraph Shell["PageContentLayout (automation | manual)"]
      SB[Sidebar]
      subgraph Main["main column"]
        SN[SectionNav]
        subgraph Content["page-content → Outlet #2"]
          P[Section page content]
        end
      end
    end
  end
  H --> Shell
```

---

## What each component owns

### `Layout.jsx` — global app chrome

Responsibilities:

- AMD header and branding
- **Data-source toggle** — `NavLink` to `/automation` and `/manual`
- User label
- **`<Outlet />`** — renders `PageContentLayout` for the active branch

`Layout` does **not** include the workload sidebar or section tabs.

### `PageContentLayout.jsx` — page content layout (per data source)

Responsibilities:

- Receives `source="automation"` or `source="manual"` from `App.jsx`
- **`Sidebar`** — remounts when `source` changes (`key={source}`)
- Renders **`SectionNav`** with that `source`
- **`<Outlet />`** — section page content inside `.page-content`

### `SectionNav.jsx` — section tabs (v2-style horizontal nav)

Responsibilities:

- Reads items from `getSectionNavItems(source)` in `config/sectionNav.js`
- Renders `NavLink`s with **relative** paths (`to="dashboard"`, `to="map-runs"`)
- Under `/manual`, `to="map-runs"` resolves to **`/manual/map-runs`**
- Map Runs is omitted on `/automation` because it is not in that source’s filtered list

Styling lives in `styles/components/section-nav.css` (frosted bar, blue gradient active pill — aligned with v2).

### `config/sectionNav.js` — v1 nav config (hardcoded)

Each item has:

- `key`, `label`, `icon`, `path`
- `sources: ['automation'] | ['manual'] | both`

Planned migration to Postgres `ui_sections` is documented in [ui-navigation-bootstrap-and-loading.md](ui-navigation-bootstrap-and-loading.md) — not required for the current build.

---

## Section nav items (current)

| Section | `/automation` | `/manual` |
|---------|:-------------:|:---------:|
| Dashboard | ✓ | ✓ |
| Map Runs | — | ✓ |
| AI Insights | ✓ | ✓ |
| Forecasting | ✓ | ✓ |
| Run Debugger | ✓ | ✓ |
| Admin | ✓ | ✓ |

---

## Known gap: source-aware sidebar data

`Sidebar` lives in **`PageContentLayout`** and remounts per route (`key={source}`). **`useWorkloads()`** still calls the same Postgres catalog for both branches — next step is source-specific fetching (automation vs manual).

### Likely next step

Pass `source` into `useWorkloads(source)` and/or different API endpoints when backends diverge. Some sections (e.g. Admin) may hide the sidebar via section config later.

---

## Quick reference: who controls what

| Concern | Component | Config / data today |
|---------|-----------|---------------------|
| Automation vs Manual | `Layout` header `NavLink`s | Routes `/automation`, `/manual` |
| Section tabs | `SectionNav` | `config/sectionNav.js` + `source` prop |
| Section page body | `App.jsx` child routes | `SectionPlaceholder` (temporary) |
| Workload list | `Sidebar` in `PageContentLayout` | Postgres only — **not source-aware yet** |

---

## Key source files

| File | Role |
|------|------|
| `sppo-data-360-ui/src/App.jsx` | Route definitions |
| `sppo-data-360-ui/src/components/Layout.jsx` | Global chrome, outlet #1 |
| `sppo-data-360-ui/src/components/PageContentLayout.jsx` | Per-source nested layout, outlet #2 |
| `sppo-data-360-ui/src/components/SectionNav.jsx` | Section tab bar |
| `sppo-data-360-ui/src/config/sectionNav.js` | Nav item list and source filter |
| `sppo-data-360-ui/src/styles/components/section-nav.css` | v2-like tab styling |

---

## Related docs

- [ui-navigation-bootstrap-and-loading.md](ui-navigation-bootstrap-and-loading.md) — dynamic `ui_sections`, bootstrap loading, Redis vs Postgres for nav
- [PROJECT_BRIEF.md](../architecture/PROJECT_BRIEF.md) — Phase 1 sidebar; manual vs automation scope
- [sppo-data-360-ui.md](../../sppo-data-360-ui/sppo-data-360-ui.md) — frontend folder layout
