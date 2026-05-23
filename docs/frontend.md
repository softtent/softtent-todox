# Frontend

## Tech Stack

| Library | Version | Role |
|---|---|---|
| React | 18 | UI rendering |
| TypeScript | — | Type safety |
| `@wordpress/element` | 5.x | Re-exports React, `lazy`, `Suspense` etc. |
| `@wordpress/api-fetch` | — | REST API client (auto nonce) |
| React Router DOM | 6.x | Client-side routing (Hash Router) |
| TanStack React Query | 5.x | Server state, caching, refetch |
| Zustand | — | Client state (current workspace) |
| `@dnd-kit/core` + sortable | — | Kanban drag-and-drop |
| Tailwind CSS | 3.x | Utility-first styling |
| lucide-react | — | Icon set |
| react-toastify | — | Toast notifications |

## Directory Structure

```
src/
├── index.tsx              # Entry: ReactDOM.createRoot → <App />
├── App.tsx                # <RouterProvider router={router} />
├── routes/index.tsx       # createHashRouter — all route definitions
│
├── api/
│   ├── index.ts           # All API modules re-exported
│   ├── tasks.ts           # tasksApi (get, create, update, delete, reorder)
│   └── workspaces.ts      # workspacesApi (CRUD + members)
│
├── components/
│   ├── features/
│   │   ├── dashboard/     # ActivityFeed, TaskProgressPanel
│   │   ├── task/          # CreateTaskModal, SubtaskModal
│   │   └── workspace/     # WorkspaceSwitcher
│   ├── layout/
│   │   ├── AppLayout.tsx  # Root layout: Sidebar + Topbar + <Outlet />
│   │   ├── Sidebar.tsx    # Navigation links
│   │   └── Topbar.tsx     # Header bar
│   └── ui/                # Reusable primitives
│       ├── Avatar, Badge, Button, ConfirmDialog
│       ├── EmptyState, ErrorBoundary, Modal
│       ├── PageHeader, PriorityBadge, Spinner
│       ├── StatusBadge, StatusPill
│
├── hooks/
│   ├── useClickOutside.ts
│   ├── useDebounce.ts
│   ├── useTaskStatuses.ts  # Fetches workspace task_status taxonomies
│   └── useWorkspace.ts     # Reads current workspace from Zustand
│
├── pages/
│   ├── 404/
│   ├── dashboard/
│   ├── departments/
│   ├── notifications/
│   ├── projects/
│   │   ├── index.tsx        # Projects list
│   │   └── ProjectDetail.tsx
│   ├── settings/
│   │   ├── index.tsx
│   │   └── StatusesSection.tsx  # Taxonomy management UI
│   ├── sprints/
│   │   ├── index.tsx
│   │   └── SprintDetail.tsx
│   ├── tasks/
│   │   ├── index.tsx        # Task list with filters
│   │   ├── TaskDetail.tsx   # Full task view with comments, activity
│   │   └── KanbanPage.tsx   # DnD kanban board
│   ├── teams/
│   └── workspaces/
│
├── store/
│   ├── index.ts             # Re-exports all stores
│   └── workspace/index.ts   # Zustand: { currentWorkspace, setCurrentWorkspace }
│
├── styles/main.scss         # Global SCSS (Tailwind @apply overrides etc.)
│
├── types/index.ts           # All TypeScript interfaces (single source of truth)
│
└── utils/
    ├── api.ts               # Core fetch wrapper (see below)
    ├── admin-menu.ts        # Sync WP admin sidebar highlight on navigation
    ├── helpers.ts           # Misc utilities
    └── query-client.ts      # TanStack QueryClient singleton
```

## Routing

All routes use `createHashRouter` (hash-based URLs, e.g. `/#/tasks/kanban`). This avoids any WP permalink conflicts.

```
/                    → Dashboard
/workspaces          → Workspaces list
/departments         → Departments list
/teams               → Teams list
/teams/:id           → Team detail
/projects            → Projects list
/projects/:id        → Project detail
/sprints             → Sprints list
/sprints/:id         → Sprint detail (+ kanban board)
/tasks               → Tasks list
/tasks/kanban        → Kanban board
/tasks/:id           → Task detail
/notifications       → Notifications
/settings            → Settings
/settings/:section   → Settings section
```

All pages are lazy-loaded via `React.lazy()` for code splitting.

After each navigation, `router.subscribe` fires `syncAdminMenu()` to update the WP admin sidebar active state (50ms debounce).

## API Layer

`src/utils/api.ts` wraps `@wordpress/api-fetch`:

```ts
import { api } from '@todox/utils/api';

// GET  /wp-json/todox/v1/tasks?workspace_id=1
const tasks = await api.get<Task[]>('tasks', { workspace_id: 1 });

// POST /wp-json/todox/v1/tasks
const task = await api.post<Task>('tasks', { title: 'Fix bug' });

// PUT  /wp-json/todox/v1/tasks/42
await api.put<Task>('tasks/42', { status: 'completed' });

// DELETE /wp-json/todox/v1/tasks/42
await api.delete('tasks/42');
```

`@wordpress/api-fetch` automatically reads the nonce from the middleware registered during app boot (set via `window.stTodoxParams.nonce`). All responses are unwrapped from `{ success, data }` before returning.

## State Management

Two layers:

1. **TanStack React Query** — all server data. Use `useQuery` / `useMutation`. The `QueryClient` singleton is in `src/utils/query-client.ts`. Query keys should be arrays: `['tasks', { workspaceId }]`.

2. **Zustand** — client-only UI state. Currently one store: `workspace` — holds `currentWorkspace: Workspace | null` and `setCurrentWorkspace`. Import from `@todox/store`.

## Types

All shared types live in `src/types/index.ts`. Import from there:

```ts
import type { Task, Sprint, Workspace } from '@todox/types';
```

Key enum-like types: `WorkspaceRole`, `ProjectStatus`, `TeamRole`, `SprintStatus`, `TaskStatus`, `TaskPriority`, `SubtaskStatus`, `NotificationType`, `ViewMode`.

## `stTodoxParams` Global

Injected by `Assets\Manager::get_script_data()` via `wp_localize_script`. Available as `window.stTodoxParams` and typed in `globals.d.ts`:

```ts
window.stTodoxParams.nonce        // wp_rest nonce
window.stTodoxParams.restUrl      // WP REST root URL
window.stTodoxParams.adminUrl     // wp-admin URL
window.stTodoxParams.pluginUrl    // Plugin root URL
window.stTodoxParams.version      // Plugin version string
window.stTodoxParams.currentUser  // { id, name, email, avatar, roles }
```

## Adding a New Page

1. Create `src/pages/my-feature/index.tsx`.
2. Add a lazy import and route entry in `src/routes/index.tsx`.
3. Add a sidebar link in `src/components/layout/Sidebar.tsx` if needed.
4. Create API module in `src/api/` and export from `src/api/index.ts`.

## Build Notes

- Dev: `npm start` — webpack dev server at `:8888`, writes output to `build/` on disk (required by WP asset loader).
- Production: `npm run build` — minified output in `build/`.
- The `build/` directory is committed to the repo. The distributable zip is `dist/softtent-todox.zip` (generated by `tools/zip.js`).
- Webpack alias `@todox` maps to `src/` — use it for all imports within the project.
