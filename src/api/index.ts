export { workspacesApi } from './workspaces';
export { tasksApi } from './tasks';

import { api } from '../utils/api';
import type {
	Department, Team, TeamMember, Project, Sprint,
	Subtask, Taxonomy, Notification, DashboardStats,
	User, PaginatedResponse,
	CreateDepartmentInput, CreateTeamInput, CreateProjectInput,
	CreateSprintInput, CreateSubtaskInput,
} from '../types';

// ---- Departments ----
export const departmentsApi = {
	getAll: ( workspaceId: number, params?: Record< string, unknown > ) =>
		api.get< Department[] >( 'departments', { workspace_id: workspaceId, ...params } ),
	getOne: ( id: number ) => api.get< Department >( `departments/${ id }` ),
	create: ( data: CreateDepartmentInput ) => api.post< Department >( 'departments', data ),
	update: ( id: number, data: Partial< CreateDepartmentInput > ) => api.put< Department >( `departments/${ id }`, data ),
	delete: ( id: number ) => api.delete( `departments/${ id }` ),
};

// ---- Teams ----
export const teamsApi = {
	getAll: ( workspaceId: number, params?: Record< string, unknown > ) =>
		api.get< Team[] >( 'teams', { workspace_id: workspaceId, ...params } ),
	getOne: ( id: number ) => api.get< Team >( `teams/${ id }` ),
	create: ( data: CreateTeamInput ) => api.post< Team >( 'teams', data ),
	update: ( id: number, data: Partial< CreateTeamInput > ) => api.put< Team >( `teams/${ id }`, data ),
	delete: ( id: number ) => api.delete( `teams/${ id }` ),
	getMembers: ( id: number ) => api.get< TeamMember[] >( `teams/${ id }/members` ),
	addMember: ( id: number, userId: number, role = 'member' ) =>
		api.post< TeamMember[] >( `teams/${ id }/members`, { user_id: userId, role } ),
	removeMember: ( id: number, userId: number ) =>
		api.delete( `teams/${ id }/members/${ userId }` ),
};

// ---- Projects ----
export const projectsApi = {
	getAll: ( workspaceId: number, params?: Record< string, unknown > ) =>
		api.get< Project[] >( 'projects', { workspace_id: workspaceId, ...params } ),
	getOne: ( id: number ) => api.get< Project >( `projects/${ id }` ),
	create: ( data: CreateProjectInput ) => api.post< Project >( 'projects', data ),
	update: ( id: number, data: Partial< CreateProjectInput > & { status?: string } ) =>
		api.put< Project >( `projects/${ id }`, data ),
	delete: ( id: number ) => api.delete( `projects/${ id }` ),
};

// ---- Sprints ----
export const sprintsApi = {
	getAll: ( projectId: number, params?: Record< string, unknown > ) =>
		api.get< Sprint[] >( 'sprints', { project_id: projectId, ...params } ),
	getOne: ( id: number ) => api.get< Sprint >( `sprints/${ id }` ),
	create: ( data: CreateSprintInput ) => api.post< Sprint >( 'sprints', data ),
	update: ( id: number, data: Partial< CreateSprintInput > & { status?: string } ) =>
		api.put< Sprint >( `sprints/${ id }`, data ),
	delete: ( id: number ) => api.delete( `sprints/${ id }` ),
};

// ---- Subtasks ----
export const subtasksApi = {
	getAll: ( taskId: number ) => api.get< Subtask[] >( `tasks/${ taskId }/subtasks` ),
	create: ( taskId: number, data: CreateSubtaskInput ) =>
		api.post< Subtask >( `tasks/${ taskId }/subtasks`, data ),
	update: ( taskId: number, id: number, data: Partial< CreateSubtaskInput > & { completed?: boolean } ) =>
		api.put< Subtask >( `tasks/${ taskId }/subtasks/${ id }`, data ),
	delete: ( taskId: number, id: number ) =>
		api.delete( `tasks/${ taskId }/subtasks/${ id }` ),
};

// ---- Taxonomies ----
export const taxonomiesApi = {
	getAll: ( workspaceId: number, type?: string ) =>
		api.get< Taxonomy[] >( 'taxonomies', { workspace_id: workspaceId, ...(type ? { type } : {}) } ),
	create: ( data: { workspace_id: number; name: string; type: string; color?: string; icon?: string } ) =>
		api.post< Taxonomy >( 'taxonomies', data ),
	update: ( id: number, data: { name?: string; color?: string; icon?: string; position?: number } ) =>
		api.put< Taxonomy >( `taxonomies/${ id }`, data ),
	reorder: ( items: { id: number; position: number }[] ) =>
		api.post( 'taxonomies/reorder', { items } ),
	delete: ( id: number ) => api.delete( `taxonomies/${ id }` ),
};

// ---- Notifications ----
export const notificationsApi = {
	getAll: ( params?: Record< string, unknown > ) => api.get< Notification[] >( 'notifications', params ),
	markRead: ( id: number ) => api.post( `notifications/${ id }/read`, {} ),
	markAllRead: () => api.post( 'notifications/read-all', {} ),
	getUnreadCount: () => api.get< { count: number } >( 'notifications/unread-count' ),
};

// ---- Users ----
export const usersApi = {
	getAll: ( params?: Record< string, unknown > ) =>
		api.get< PaginatedResponse< User > >( 'users', params ),
	me: () => api.get< User >( 'users/me' ),
};

// ---- Dashboard ----
export const dashboardApi = {
	getStats: ( workspaceId: number ) =>
		api.get< DashboardStats >( 'dashboard/stats', { workspace_id: workspaceId } ),
	getRecentTasks: ( workspaceId: number ) =>
		api.get< import('../types').Task[] >( 'dashboard/recent-tasks', { workspace_id: workspaceId } ),
	getRecentActivity: ( workspaceId: number ) =>
		api.get< import('../types').TaskActivity[] >( 'dashboard/recent-activity', { workspace_id: workspaceId } ),
};
