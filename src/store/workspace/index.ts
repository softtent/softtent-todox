/**
 * @wordpress/data store for workspace context.
 *
 * Holds: activeWorkspaceId, sidebarOpen, viewMode.
 * Everything else (data) lives in React Query.
 */

import { createReduxStore, register } from '@wordpress/data';
import type { Workspace } from '../../types';

// ---- State ----
interface State {
	activeWorkspaceId: number | null;
	activeWorkspace: Workspace | null;
	sidebarOpen: boolean;
	viewMode: 'list' | 'kanban';
}

const DEFAULT_STATE: State = {
	activeWorkspaceId: parseInt( localStorage.getItem( 'st_todox_workspace_id' ) ?? '0', 10 ) || null,
	activeWorkspace: null,
	sidebarOpen: true,
	viewMode: ( localStorage.getItem( 'st_todox_view_mode' ) as State[ 'viewMode' ] ) || 'list',
};

// ---- Actions ----
type Action =
	| { type: 'SET_ACTIVE_WORKSPACE'; workspace: Workspace }
	| { type: 'CLEAR_ACTIVE_WORKSPACE' }
	| { type: 'TOGGLE_SIDEBAR' }
	| { type: 'SET_VIEW_MODE'; mode: State[ 'viewMode' ] };

const actions = {
	setActiveWorkspace( workspace: Workspace ) {
		return { type: 'SET_ACTIVE_WORKSPACE' as const, workspace };
	},
	clearActiveWorkspace() {
		return { type: 'CLEAR_ACTIVE_WORKSPACE' as const };
	},
	toggleSidebar() {
		return { type: 'TOGGLE_SIDEBAR' as const };
	},
	setViewMode( mode: State[ 'viewMode' ] ) {
		return { type: 'SET_VIEW_MODE' as const, mode };
	},
};

// ---- Reducer ----
function reducer( state = DEFAULT_STATE, action: Action ): State {
	switch ( action.type ) {
		case 'SET_ACTIVE_WORKSPACE':
			localStorage.setItem( 'st_todox_workspace_id', String( action.workspace.id ) );
			return {
				...state,
				activeWorkspaceId: action.workspace.id,
				activeWorkspace: action.workspace,
			};

		case 'CLEAR_ACTIVE_WORKSPACE':
			localStorage.removeItem( 'st_todox_workspace_id' );
			return { ...state, activeWorkspaceId: null, activeWorkspace: null };

		case 'TOGGLE_SIDEBAR':
			return { ...state, sidebarOpen: ! state.sidebarOpen };

		case 'SET_VIEW_MODE':
			localStorage.setItem( 'st_todox_view_mode', action.mode );
			return { ...state, viewMode: action.mode };
	}

	return state;
}

// ---- Selectors ----
const selectors = {
	getActiveWorkspaceId: ( state: State ) => state.activeWorkspaceId,
	getActiveWorkspace: ( state: State ) => state.activeWorkspace,
	isSidebarOpen: ( state: State ) => state.sidebarOpen,
	getViewMode: ( state: State ) => state.viewMode,
};

// ---- Store ----
export const STORE_NAME = 'todox/workspace';

const store = createReduxStore( STORE_NAME, {
	reducer,
	actions,
	selectors,
} );

register( store );

export { actions, selectors };
