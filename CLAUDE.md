# SoftTent TodoX — Claude Code Guide

## What This Plugin Is

**SoftTent TodoX** is a WordPress plugin that embeds a full project management SPA (Kanban boards, sprints, tasks, teams) into a WordPress site. The React app runs on a dedicated WordPress page — not inside wp-admin — and communicates with custom REST API endpoints.

- Plugin slug: `softtent-todox`
- PHP namespace root: `SoftTent\TodoX\` → `includes/`
- REST API namespace: `todox/v1`
- JS global injected by PHP: `window.stTodoxParams`
- Frontend webpack alias: `@todox` → `src/`

## Project Layout

```
softtent-todox/
├── softtent-todox.php       # Entry point, ST_TodoX singleton + st_todox() helper
├── uninstall.php            # Runs on plugin deletion
├── includes/                # PHP source (PSR-4 autoloaded)
│   ├── Abstracts/RestApi.php        # Base REST controller
│   ├── Admin/Menu.php               # WP admin menu (redirects to frontend)
│   ├── Api/Controller.php           # REST controller registry
│   ├── Api/Controllers/             # One controller per resource
│   ├── Assets/Manager.php           # Script/style registration & enqueue
│   ├── Database/Migrations/         # CREATE TABLE via dbDelta
│   ├── Frontend/App.php             # Page creation + template_include override
│   ├── Helpers/Fns.php              # Shared utilities
│   ├── Helpers/Keys.php             # WP option/transient key constants
│   ├── Hooks/Manager.php            # Plugin action links
│   ├── Models/                      # Static query classes per table
│   ├── Setup/Installer.php          # Runs migrations on activation/upgrade
│   ├── Setup/Seeder.php             # Default taxonomy data per workspace
│   ├── Setup/Uninstaller.php        # Cleanup on uninstall
│   └── Traits/                      # Sanitizer, Singleton
├── src/                     # TypeScript/React source
│   ├── index.tsx            # Webpack entry — mounts <App />
│   ├── App.tsx              # RouterProvider wrapper
│   ├── routes/index.tsx     # Hash-based route definitions
│   ├── api/                 # Typed API client modules
│   ├── components/          # UI components (features/, layout/, ui/)
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # One folder per route
│   ├── store/               # Zustand stores
│   ├── styles/main.scss     # Global styles
│   ├── types/index.ts       # All TypeScript interfaces & enums
│   └── utils/               # api.ts, helpers.ts, query-client.ts
├── templates/app.php        # Standalone page template (replaces WP theme)
├── build/                   # Webpack output (committed for distribution)
├── languages/               # POT file for i18n
├── tools/                   # i18n-loader.ts, zip.js
├── composer.json            # PHP deps + PHPCS config
└── package.json             # JS deps + build scripts
```

## Development Commands

### Frontend
```bash
npm start          # Dev build with HMR (writes to disk)
npm run build      # Production build → build/
npm run lint:js    # ESLint
npm run lint:css   # Stylelint
npm run format     # Prettier
```

### PHP
```bash
composer run phpcs      # PHPCS lint
composer run phpcs:fix  # Auto-fix PHPCS issues
```

### Release
```bash
npm run release    # build + makepot + zip → dist/softtent-todox.zip
```

## Key Architectural Decisions

### Frontend lives on a public WordPress page, not wp-admin
On activation, `Frontend\App::create_page()` inserts a WP page with slug `todox`. The admin menu item links directly to that page URL. The `template_include` filter swaps the theme template for `templates/app.php`. All third-party scripts/styles are dequeued so the SPA runs clean.

### REST API base controller
All controllers extend `SoftTent\TodoX\Abstracts\RestApi` which extends `WP_REST_Controller`. Permission callbacks: `is_admin()` (requires `manage_options`) and `is_workspace_member()` (checks membership or admin bypass). All responses use `Fns::success()` / `Fns::error()` → `{ success: bool, data: T }`.

### Database migrations run on every admin_init after a version bump
`Setup\Installer` checks `st_todox_db_version` option against `ST_TODOX_DB_VERSION` constant (currently `1.3.0`). Migrations use `dbDelta()`. All custom tables are prefixed `{wpdb->prefix}st_todox_`.

### Task status is a VARCHAR, not ENUM
Tasks were migrated from ENUM to VARCHAR(100) in v1.2.0 so custom statuses from the Taxonomy system can be stored. `valid_status()` sanitizes to `[a-z0-9_]`.

### Taxonomy system drives statuses
Custom task statuses and sprint statuses are stored in `st_todox_taxonomies` with `type = 'task_status'` or `'sprint_status'`. A `category` column holds the slug used internally (e.g. `todo`, `in_progress`). Default statuses are seeded per workspace via `Seeder::seed_workspace_defaults()`.

### Frontend API layer
`src/utils/api.ts` wraps `@wordpress/api-fetch` with auto-namespace (`todox/v1`) and response unwrapping. All network calls go through `api.get/post/put/delete`. `@wordpress/api-fetch` uses the nonce from `stTodoxParams.nonce` automatically.

## PHP Constants

| Constant | Value |
|---|---|
| `ST_TODOX_VERSION` | `0.1.0` |
| `ST_TODOX_SLUG` | `softtent-todox` |
| `ST_TODOX_FILE` | Absolute path to main plugin file |
| `ST_TODOX_DIR` | Plugin directory (no trailing slash) |
| `ST_TODOX_PATH` | Plugin directory (with trailing slash) |
| `ST_TODOX_URL` | Plugin URL (no trailing slash) |
| `ST_TODOX_ASSETS` | `ST_TODOX_URL . '/build'` |
| `ST_TODOX_DB_VERSION` | `1.3.0` |

## WP Option Keys (via `Helpers\Keys`)

| Key | Purpose |
|---|---|
| `st_todox_version` | Installed plugin version |
| `st_todox_db_version` | Installed DB schema version |
| `st_todox_installed_at` | First install datetime |
| `st_todox_settings` | Plugin settings array |
| `st_todox_page_id` | WP page ID that hosts the SPA |
| `st_todox_activation_redirect` | Transient: redirect after activation |

## Filterable Extension Points

| Hook | Description |
|---|---|
| `st_todox_before_init` | Fires before plugin components load |
| `st_todox_init` | Fires after plugin components load |
| `st_todox_rest_api_class_map` | Add/remove REST controller classes |
| `st_todox_script_data` | Modify `stTodoxParams` passed to JS |

## JS `stTodoxParams` Object

Passed via `wp_localize_script` as `window.stTodoxParams`:
```ts
{
  nonce: string;
  restUrl: string;
  adminUrl: string;
  pluginUrl: string;
  version: string;
  currentUser: { id, name, email, avatar, roles };
}
```

## See Also

- [docs/architecture.md](docs/architecture.md) — Component wiring, boot sequence
- [docs/database.md](docs/database.md) — All table schemas
- [docs/api.md](docs/api.md) — REST endpoint reference
- [docs/frontend.md](docs/frontend.md) — React structure, state, routing
