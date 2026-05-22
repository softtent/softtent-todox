=== Softtent TodoX ===
Contributors:      softtent
Tags:              project management, tasks, kanban, sprints, teams
Requires at least: 6.4
Tested up to:      7.0
Requires PHP:      7.4
Stable tag:        0.1.0
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

A professional project management system for WordPress. Manage workspaces, departments, teams, projects, sprints, and tasks with a Kanban board.

== Description ==

Softtent TodoX is a full-featured project management plugin for WordPress. It provides a clean, fast React-powered SPA that lets your team manage work without leaving your WordPress site.

**Key Features**

* **Workspaces** — Organize work into isolated workspaces with member roles (owner, admin, member, guest).
* **Departments & Teams** — Group team members by department and assign them to teams.
* **Projects** — Create projects inside workspaces and assign them to teams.
* **Sprints** — Plan and run sprints within projects (Planned → Active → Completed).
* **Tasks** — Full task lifecycle: title, description, priority, due date, assignee, labels, subtasks, comments, and activity log.
* **Kanban Board** — Drag-and-drop task reordering across custom statuses.
* **Custom Statuses** — Define unlimited task statuses per workspace with custom color and icon.
* **Notifications** — In-app notification feed with unread badge.
* **Dashboard** — At-a-glance stats, recent tasks, and activity feed per workspace.
* **REST API** — Full WP REST API integration so data is always in sync.
* **i18n Ready** — Fully internationalized with `.pot` file for translators.

== Installation ==

1. Upload the `todox` folder to the `/wp-content/plugins/` directory, or install directly through the WordPress plugin screen.
2. Activate the plugin through the **Plugins** screen in WordPress.
3. Click **Projects** in the WordPress admin sidebar. You will be redirected to the standalone project management app.
4. Create your first workspace to get started.

== Frequently Asked Questions ==

= Where does the app live? =

The app runs at `https://yoursite.com/todox` — a standalone virtual page that does not require a WordPress page or theme template.

= Who can access the app? =

Any logged-in WordPress user can access the app. Access to individual workspaces is controlled by the workspace membership system.

= Can I keep my data if I deactivate the plugin? =

Yes. Go to the plugin settings and enable **Keep data on uninstall** before deleting the plugin. Without that option, all plugin tables and options are removed on uninstall.

= Is the REST API secured? =

Yes. All endpoints require an authenticated WordPress session. Workspace-level operations also verify workspace membership or the `manage_options` capability.

= Does this work with multisite? =

The plugin is single-site compatible. Multisite network-level features are not currently supported.

== Screenshots ==

1. Dashboard with workspace stats and recent activity.
2. Kanban board with drag-and-drop task management.
3. Task detail panel with comments and activity log.
4. Workspace settings with member management.

== Source Code ==

The development source code is available on GitHub: https://github.com/softtent/softtent-todox

== Changelog ==

= 0.1.0 =
* Initial release.

== Upgrade Notice ==

= 0.1.0 =
Initial release.
