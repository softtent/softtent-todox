import { api } from '../utils/api';
import type { Workspace, WorkspaceMember, CreateWorkspaceInput } from '../types';

export const workspacesApi = {
	getAll: () => api.get< Workspace[] >( 'workspaces' ),

	getOne: ( id: number ) => api.get< Workspace >( `workspaces/${ id }` ),

	create: ( data: CreateWorkspaceInput ) => api.post< Workspace >( 'workspaces', data ),

	update: ( id: number, data: Partial< CreateWorkspaceInput > ) =>
		api.put< Workspace >( `workspaces/${ id }`, data ),

	delete: ( id: number ) => api.delete( `workspaces/${ id }` ),

	getMembers: ( id: number ) => api.get< WorkspaceMember[] >( `workspaces/${ id }/members` ),

	addMember: ( id: number, userId: number, role = 'member' ) =>
		api.post< WorkspaceMember[] >( `workspaces/${ id }/members`, { user_id: userId, role } ),

	removeMember: ( id: number, userId: number ) =>
		api.delete( `workspaces/${ id }/members/${ userId }` ),
};
