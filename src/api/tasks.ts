import { api } from '../utils/api';
import type {
	Task,
	TaskComment,
	TaskActivity,
	CreateTaskInput,
	PaginatedResponse,
} from '../types';

export interface TaskQueryParams {
	workspace_id?: number;
	project_id?: number;
	sprint_id?: number;
	status?: string | string[];
	priority?: string | string[];
	assignee_id?: number;
	search?: string;
	order_by?: string;
	order?: 'asc' | 'desc';
	page?: number;
	per_page?: number;
}

export const tasksApi = {
	getAll: ( params: TaskQueryParams ) =>
		api.get< PaginatedResponse< Task > >( 'tasks', params as Record< string, unknown > ),

	getOne: ( id: number ) => api.get< Task >( `tasks/${ id }` ),

	create: ( data: CreateTaskInput ) => api.post< Task >( 'tasks', data ),

	update: ( id: number, data: Partial< CreateTaskInput > & { status?: string; position?: number } ) =>
		api.put< Task >( `tasks/${ id }`, data ),

	delete: ( id: number ) => api.delete( `tasks/${ id }` ),

	reorder: ( items: Array< { id: number; position: number; status: string } > ) =>
		api.post( 'tasks/reorder', { items } ),

	getComments: ( id: number ) => api.get< TaskComment[] >( `tasks/${ id }/comments` ),

	addComment: ( id: number, content: string ) =>
		api.post< TaskComment[] >( `tasks/${ id }/comments`, { content } ),

	updateComment: ( taskId: number, commentId: number, content: string ) =>
		api.put( `tasks/${ taskId }/comments/${ commentId }`, { content } ),

	deleteComment: ( taskId: number, commentId: number ) =>
		api.delete( `tasks/${ taskId }/comments/${ commentId }` ),

	getActivities: ( id: number ) => api.get< TaskActivity[] >( `tasks/${ id }/activities` ),
};
