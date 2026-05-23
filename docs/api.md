# REST API Reference

**Base URL**: `{site_url}/wp-json/todox/v1/`

All responses follow the envelope:
```json
{ "success": true, "data": <payload> }
{ "success": false, "data": ["error message"] }
```

Authentication uses WordPress cookie nonce (`wp_rest` nonce passed via `X-WP-Nonce` header, handled automatically by `@wordpress/api-fetch`).

---

## Workspaces `/workspaces`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/workspaces` | logged-in | List workspaces for current user |
| POST | `/workspaces` | logged-in | Create workspace |
| GET | `/workspaces/{id}` | member | Get workspace with members |
| PUT | `/workspaces/{id}` | admin/owner | Update workspace |
| DELETE | `/workspaces/{id}` | admin | Delete workspace |
| POST | `/workspaces/{id}/members` | admin | Add member |
| DELETE | `/workspaces/{id}/members/{user_id}` | admin | Remove member |

---

## Departments `/departments`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/departments?workspace_id=` | member | List departments |
| POST | `/departments` | admin | Create department |
| GET | `/departments/{id}` | member | Get department |
| PUT | `/departments/{id}` | admin | Update department |
| DELETE | `/departments/{id}` | admin | Delete department |

---

## Teams `/teams`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/teams?workspace_id=` | member | List teams |
| POST | `/teams` | admin | Create team |
| GET | `/teams/{id}` | member | Get team with members |
| PUT | `/teams/{id}` | admin | Update team |
| DELETE | `/teams/{id}` | admin | Delete team |
| GET | `/teams/{id}/members` | member | List team members |
| POST | `/teams/{id}/members` | admin | Add member `{user_id, role}` |
| DELETE | `/teams/{id}/members/{user_id}` | admin | Remove member |

---

## Projects `/projects`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects?workspace_id=` | member | List projects |
| POST | `/projects` | member | Create project |
| GET | `/projects/{id}` | member | Get project |
| PUT | `/projects/{id}` | member | Update project |
| DELETE | `/projects/{id}` | admin | Delete project |

---

## Sprints `/sprints`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sprints?project_id=` | member | List sprints |
| POST | `/sprints` | member | Create sprint |
| GET | `/sprints/{id}` | member | Get sprint |
| PUT | `/sprints/{id}` | member | Update sprint |
| DELETE | `/sprints/{id}` | admin | Delete sprint |

---

## Tasks `/tasks`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tasks` | member | List tasks (filterable) |
| POST | `/tasks` | member | Create task |
| GET | `/tasks/{id}` | member | Get task with subtasks, comments, activities |
| PUT | `/tasks/{id}` | member | Update task |
| DELETE | `/tasks/{id}` | admin | Delete task |
| POST | `/tasks/reorder` | member | Bulk reorder (Kanban DnD) `{items: [{id, position, status}]}` |

**GET `/tasks` query params**: `workspace_id`, `project_id`, `sprint_id`, `status` (repeatable), `priority` (repeatable), `assignee_id`, `search`, `per_page`, `page`, `order_by` (position/created_at/due_date/priority), `order` (ASC/DESC).

### Task Comments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tasks/{id}/comments` | member | List comments |
| POST | `/tasks/{id}/comments` | member | Add comment `{content}` |
| PUT | `/tasks/{id}/comments/{comment_id}` | author | Edit comment |
| DELETE | `/tasks/{id}/comments/{comment_id}` | author/admin | Delete comment |

---

## Subtasks `/tasks/{task_id}/subtasks`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tasks/{id}/subtasks` | member | List subtasks |
| POST | `/tasks/{id}/subtasks` | member | Create subtask |
| PUT | `/tasks/{id}/subtasks/{sub_id}` | member | Update subtask |
| DELETE | `/tasks/{id}/subtasks/{sub_id}` | admin | Delete subtask |

---

## Taxonomies `/taxonomies`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/taxonomies?workspace_id=&type=` | member | List taxonomies |
| POST | `/taxonomies` | admin | Create taxonomy |
| PUT | `/taxonomies/{id}` | admin | Update taxonomy |
| POST | `/taxonomies/reorder` | admin | Reorder `{items: [{id, position}]}` |
| DELETE | `/taxonomies/{id}` | admin | Delete taxonomy |

---

## Notifications `/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | logged-in | List notifications (current user) |
| GET | `/notifications/unread-count` | logged-in | `{count: number}` |
| POST | `/notifications/{id}/read` | logged-in | Mark one read |
| POST | `/notifications/read-all` | logged-in | Mark all read |

---

## Users `/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users` | admin | List WP users (paginated) |
| GET | `/users/me` | logged-in | Current user data |

---

## Dashboard `/dashboard`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/stats?workspace_id=` | member | Task counts + project count |
| GET | `/dashboard/recent-tasks?workspace_id=` | member | Recent tasks |
| GET | `/dashboard/recent-activity?workspace_id=` | member | Recent task activity |

---

## Settings `/settings`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/settings` | admin | Get all plugin settings |
| POST | `/settings` | admin | Update settings |

---

## Adding a New Controller

1. Create `includes/Api/Controllers/MyController.php` extending `SoftTent\TodoX\Abstracts\RestApi`.
2. Set `$base = 'my-resource'`.
3. Implement `routes()` — call `register_rest_route( $this->namespace, '/' . $this->base . '/...', [...] )`.
4. Register via filter: `add_filter( 'st_todox_rest_api_class_map', fn($map) => [...$map, MyController::class] )`.
