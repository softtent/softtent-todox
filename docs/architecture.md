# Architecture

## Boot Sequence

```
WordPress loads softtent-todox.php
  └── st_todox() calls ST_TodoX::init()
        └── ST_TodoX constructor
              ├── require vendor/autoload.php
              ├── define_constants()
              ├── register_activation_hook  → activate()
              ├── register_deactivation_hook → deactivate()
              └── add_action('plugins_loaded') → init_plugin()

plugins_loaded fires:
  └── init_plugin()
        ├── do_action('st_todox_before_init')
        ├── includes()
        │     ├── [admin] Installer  — runs migrations on admin_init
        │     ├── [admin] Admin\Menu — registers WP admin menu item
        │     ├── Frontend\App       — template_include + dequeue
        │     ├── Assets\Manager     — register/enqueue scripts
        │     ├── Api\Controller     — registers REST routes on rest_api_init
        │     └── Hooks\Manager      — plugin action links
        └── do_action('st_todox_init')
```

## Plugin Container

`ST_TodoX` acts as a lightweight service container via `$this->container[]`. Services are accessible via magic `__get`:

```php
st_todox()->rest_api   // Api\Controller
st_todox()->assets     // Assets\Manager
st_todox()->frontend   // Frontend\App
st_todox()->hooks      // Hooks\Manager
// admin only:
st_todox()->installer  // Setup\Installer
st_todox()->admin_menu // Admin\Menu
```

## Frontend Delivery

The React SPA is delivered on a public WordPress page (not in wp-admin):

1. **Activation** — `Frontend\App::create_page()` inserts a WP page with `post_name = 'todox'`. The page ID is stored in `st_todox_page_id` option.
2. **Admin menu** — `Admin\Menu` registers a top-level WP admin menu item but immediately rewrites its URL to the frontend page URL (not `admin.php?page=…`). A safety-net `admin_init` redirect catches direct URL access.
3. **Template override** — `Frontend\App::load_app_template()` hooks `template_include` and, when on the app page, replaces the theme template with `templates/app.php`. Unauthenticated visitors are sent to `auth_redirect()`.
4. **Asset isolation** — `maybe_dequeue_third_party()` runs at `PHP_INT_MAX` priority on `wp_enqueue_scripts`, dequeueing everything except the plugin's own script/style handles.
5. **React mount** — `templates/app.php` provides a bare HTML shell with `<div id="todox-app"></div>`. `src/index.tsx` mounts `<App />` on that element.

## REST API Structure

```
SoftTent\TodoX\Abstracts\RestApi  (extends WP_REST_Controller)
  ├── namespace: 'todox/v1'
  ├── Permission helpers: is_admin(), is_workspace_member()
  ├── Response helpers: ok(), error()  → delegates to Fns::success/error
  └── Abstract: routes()

Api\Controller
  └── Registers all controllers on 'rest_api_init'
      (filterable via 'st_todox_rest_api_class_map')
```

Each controller in `includes/Api/Controllers/` has one `routes()` method that calls `register_rest_route()` for its resource.

## Database Layer

There is no ORM. Each entity has a static Model class in `includes/Models/` that issues raw `$wpdb` queries with `prepare()`. Pattern:

```php
Model::get_all( array $args )  // paginated list
Model::get( int $id )          // single item with relations
Model::create( array $data )   // insert + return new ID
Model::update( int $id, array $data )  // selective field update
Model::delete( int $id )       // hard delete
Model::format( array $row )    // raw DB row → API-ready array
```

Relations are loaded inline in `get()` (no lazy loading). `Fns::get_user_info()` enriches user IDs with WP user data.

## Assets Pipeline

- **Build tool**: `@wordpress/scripts` (webpack wrapper)
- **Entry points**: `src/index.tsx` (app) + `tools/i18n-loader.ts` (chunk translations)
- **Output**: `build/` directory — committed to the repo for distribution
- **CSS**: Tailwind CSS processed via PostCSS, output as `build/index.css`
- **Webpack alias**: `@todox` → `src/`
- **i18n**: `@automattic/i18n-loader-webpack-plugin` handles dynamic chunk translation loading. Text domain: `softtent-todox`.

Script handles: `softtent-todox` (app), `st-todox-i18n-loader` (chunk i18n).

## Installer / Migration Flow

`Setup\Installer` hooks `admin_init` and runs whenever `st_todox_db_version` option is behind `ST_TODOX_DB_VERSION` constant:

1. Record install time (first run only)
2. Run all `CreateXxxTable::up()` migrations via `dbDelta()`
3. Run `Seeder::run()` (currently no-op at global level)
4. Backfill `category` column on existing taxonomy rows (v1.1.0 migration)
5. Alter `tasks.status` from ENUM to VARCHAR if needed (v1.2.0 migration)
6. Update `st_todox_db_version` option

## Workspace Defaults

When a new workspace is created, `Seeder::seed_workspace_defaults( $workspace_id )` inserts default taxonomies:
- **Task statuses**: To Do, In Progress, In Review, Completed
- **Sprint statuses**: Planned, Active, Completed
