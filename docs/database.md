# Database Schema

All tables use the WordPress table prefix + `st_todox_` prefix. Current DB version: **1.3.0**.

## Entity Hierarchy

```
Workspace
  └── Department
        └── Team
              ├── TeamMember (→ WP Users)
              └── Project
                    └── Sprint
                          └── Task
                                ├── TaskLabel
                                ├── TaskComment
                                ├── TaskActivity
                                ├── TaskAttachment
                                └── Subtask

Workspace → WorkspaceMember (→ WP Users)
Workspace → Taxonomy (task_status, sprint_status)
User → Notification
```

---

## `st_todox_workspaces`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| name | VARCHAR(200) | |
| slug | VARCHAR(200) UNIQUE | sanitize_title() |
| description | TEXT | nullable |
| logo | VARCHAR(500) | nullable |
| color | VARCHAR(20) | hex, default `#6366f1` |
| owner_id | BIGINT UNSIGNED | WP user ID |
| is_public | TINYINT(1) | default 0 |
| created_at | DATETIME | |
| updated_at | DATETIME | auto-update |

## `st_todox_workspace_members`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| workspace_id | BIGINT UNSIGNED | FK workspaces.id |
| user_id | BIGINT UNSIGNED | WP user ID |
| role | ENUM | owner / admin / member / guest |
| joined_at | DATETIME | |

Unique key: `(workspace_id, user_id)`.

---

## `st_todox_departments`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| workspace_id | BIGINT UNSIGNED | |
| name | VARCHAR(200) | |
| description | TEXT | nullable |
| color | VARCHAR(20) | |
| head_id | BIGINT UNSIGNED | nullable, WP user ID |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## `st_todox_teams`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| department_id | BIGINT UNSIGNED | |
| workspace_id | BIGINT UNSIGNED | |
| name | VARCHAR(200) | |
| description | TEXT | nullable |
| color | VARCHAR(20) | |
| avatar | VARCHAR(500) | nullable |
| manager_id | BIGINT UNSIGNED | nullable, WP user ID |
| created_at | DATETIME | |
| updated_at | DATETIME | |

## `st_todox_team_members`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| team_id | BIGINT UNSIGNED | |
| user_id | BIGINT UNSIGNED | WP user ID |
| role | ENUM | lead / member |
| joined_at | DATETIME | |

---

## `st_todox_taxonomies`

Flexible classification system. Currently used for task statuses and sprint statuses per workspace.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| workspace_id | BIGINT UNSIGNED | |
| name | VARCHAR(200) | display name, e.g. "In Progress" |
| type | VARCHAR(100) | `task_status` or `sprint_status` |
| category | VARCHAR(100) | internal slug, e.g. `in_progress` |
| color | VARCHAR(20) | |
| icon | VARCHAR(100) | nullable, lucide icon name |
| position | INT | sort order |
| is_active | TINYINT(1) | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**Note**: `category` was backfilled in v1.1.0. For built-in statuses the category matches the legacy ENUM value; for custom statuses it is auto-generated from the name.

---

## `st_todox_projects`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| team_id | BIGINT UNSIGNED | |
| workspace_id | BIGINT UNSIGNED | |
| name | VARCHAR(200) | |
| description | TEXT | nullable |
| color | VARCHAR(20) | |
| icon | VARCHAR(100) | nullable |
| status | ENUM | active / completed / archived |
| taxonomy_id | BIGINT UNSIGNED | nullable |
| owner_id | BIGINT UNSIGNED | WP user ID |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## `st_todox_sprints`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| project_id | BIGINT UNSIGNED | |
| name | VARCHAR(200) | |
| goal | TEXT | nullable |
| status | ENUM | planned / active / completed |
| taxonomy_id | BIGINT UNSIGNED | nullable |
| start_date | DATE | nullable |
| end_date | DATE | nullable |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## `st_todox_tasks`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| sprint_id | BIGINT UNSIGNED | nullable |
| project_id | BIGINT UNSIGNED | nullable |
| workspace_id | BIGINT UNSIGNED | nullable |
| title | VARCHAR(500) | |
| description | LONGTEXT | nullable, stored as HTML (wp_kses_post) |
| status | VARCHAR(100) | sanitized slug, default `todo` |
| taxonomy_id | BIGINT UNSIGNED | nullable, points to active taxonomy row |
| priority | ENUM | low / medium / high / urgent |
| due_date | DATE | nullable |
| position | INT | sort order within sprint/project |
| is_archived | TINYINT(1) | default 0 |
| assignee_id | BIGINT UNSIGNED | nullable, WP user ID |
| creator_id | BIGINT UNSIGNED | WP user ID |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**Status note**: Stored as a plain VARCHAR slug (e.g. `todo`, `in_progress`, custom slugs). The `taxonomy_id` column links to the taxonomy row that represents the status.

## `st_todox_task_labels`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| task_id | BIGINT UNSIGNED | |
| name | VARCHAR(100) | |
| color | VARCHAR(20) | hex |

Labels are re-synced on each update (delete + re-insert).

## `st_todox_task_comments`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| task_id | BIGINT UNSIGNED | |
| author_id | BIGINT UNSIGNED | WP user ID |
| content | LONGTEXT | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

## `st_todox_task_activities`

Immutable audit log. Never updated, only inserted.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| task_id | BIGINT UNSIGNED | |
| user_id | BIGINT UNSIGNED | WP user ID |
| action | VARCHAR(100) | e.g. `created`, `status_changed` |
| detail | TEXT | nullable, context for the action |
| created_at | DATETIME | |

## `st_todox_task_attachments`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| task_id | BIGINT UNSIGNED | |
| filename | VARCHAR(255) | |
| url | VARCHAR(1000) | |
| size | INT | bytes |
| mime_type | VARCHAR(100) | |
| uploaded_by | BIGINT UNSIGNED | WP user ID |
| created_at | DATETIME | |

---

## `st_todox_subtasks`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| task_id | BIGINT UNSIGNED | |
| title | VARCHAR(500) | |
| description | LONGTEXT | nullable |
| status | VARCHAR(100) | todo / in_progress / done |
| taxonomy_id | BIGINT UNSIGNED | nullable |
| priority | ENUM | low / medium / high / urgent |
| due_date | DATE | nullable |
| completed | TINYINT(1) | default 0 |
| position | INT | |
| assignee_id | BIGINT UNSIGNED | nullable |
| created_at | DATETIME | |
| updated_at | DATETIME | |

---

## `st_todox_notifications`

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| user_id | BIGINT UNSIGNED | WP user ID |
| title | VARCHAR(300) | |
| message | TEXT | |
| type | ENUM | info / success / warning / error / task / mention |
| is_read | TINYINT(1) | default 0 |
| link | VARCHAR(500) | nullable |
| meta | LONGTEXT | nullable, JSON |
| created_at | DATETIME | |
