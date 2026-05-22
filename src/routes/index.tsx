/**
 * External dependencies
 */
import { lazy } from '@wordpress/element';
import { createHashRouter } from 'react-router-dom';

/**
 * Internal dependencies
 */
import AppLayout from '../components/layout/AppLayout';
import { syncAdminMenu } from '../utils/admin-menu';

// Lazy-loaded pages for code splitting
const Dashboard       = lazy( () => import( '../pages/dashboard' ) );
const WorkspacesPage  = lazy( () => import( '../pages/workspaces' ) );
const DepartmentsPage = lazy( () => import( '../pages/departments' ) );
const TeamsPage       = lazy( () => import( '../pages/teams' ) );
const ProjectsPage    = lazy( () => import( '../pages/projects' ) );
const ProjectDetail   = lazy( () => import( '../pages/projects/ProjectDetail' ) );
const SprintsPage     = lazy( () => import( '../pages/sprints' ) );
const SprintDetail    = lazy( () => import( '../pages/sprints/SprintDetail' ) );
const TasksPage       = lazy( () => import( '../pages/tasks' ) );
const TaskDetail      = lazy( () => import( '../pages/tasks/TaskDetail' ) );
const KanbanPage      = lazy( () => import( '../pages/tasks/KanbanPage' ) );
const NotificationsPage = lazy( () => import( '../pages/notifications' ) );
const SettingsPage    = lazy( () => import( '../pages/settings' ) );
const NotFound        = lazy( () => import( '../pages/404' ) );

export const router = createHashRouter( [
	{
		path: '/',
		element: <AppLayout />,
		children: [
			{ index: true, element: <Dashboard /> },
			{ path: 'workspaces', element: <WorkspacesPage /> },
			{ path: 'departments', element: <DepartmentsPage /> },
			{ path: 'teams', element: <TeamsPage /> },
			{ path: 'teams/:id', element: <TeamsPage /> },
			{ path: 'projects', element: <ProjectsPage /> },
			{ path: 'projects/:id', element: <ProjectDetail /> },
			{ path: 'sprints', element: <SprintsPage /> },
			{ path: 'sprints/:id', element: <SprintDetail /> },
			{ path: 'tasks', element: <TasksPage /> },
			{ path: 'tasks/kanban', element: <KanbanPage /> },
			{ path: 'tasks/:id', element: <TaskDetail /> },
			{ path: 'notifications', element: <NotificationsPage /> },
			{ path: 'settings', element: <SettingsPage /> },
			{ path: 'settings/:section', element: <SettingsPage /> },
			{ path: '*', element: <NotFound /> },
		],
	},
] );

// Sync WP admin sidebar highlight on React Router navigation.
router.subscribe( () => {
	setTimeout( syncAdminMenu, 50 );
} );
