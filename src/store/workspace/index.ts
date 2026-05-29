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
	mobileDrawerOpen: boolean;
	viewMode: 'list' | 'kanban';
}

const DEFAULT_STATE: State = {
	activeWorkspaceId: parseInt( localStorage.getItem( 'st_todox_workspace_id' ) ?? '0', 10 ) || null,
	activeWorkspace: null,
	sidebarOpen: localStorage.getItem( 'st_todox_sidebar_open' ) !== 'false',
	mobileDrawerOpen: false,
	viewMode: ( localStorage.getItem( 'st_todox_view_mode' ) as State[ 'viewMode' ] ) || 'list',
};

// ---- Actions ----
type Action =
	| { type: 'SET_ACTIVE_WORKSPACE'; workspace: Workspace }
	| { type: 'CLEAR_ACTIVE_WORKSPACE' }
	| { type: 'TOGGLE_SIDEBAR' }
	| { type: 'OPEN_MOBILE_DRAWER' }
	| { type: 'CLOSE_MOBILE_DRAWER' }
	| { type: 'TOGGLE_MOBILE_DRAWER' }
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
	openMobileDrawer() {
		return { type: 'OPEN_MOBILE_DRAWER' as const };
	},
	closeMobileDrawer() {
		return { type: 'CLOSE_MOBILE_DRAWER' as const };
	},
	toggleMobileDrawer() {
		return { type: 'TOGGLE_MOBILE_DRAWER' as const };
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

		case 'TOGGLE_SIDEBAR': {
			const next = ! state.sidebarOpen;
			localStorage.setItem( 'st_todox_sidebar_open', String( next ) );
			return { ...state, sidebarOpen: next };
		}

		case 'OPEN_MOBILE_DRAWER':
			return { ...state, mobileDrawerOpen: true };

		case 'CLOSE_MOBILE_DRAWER':
			return { ...state, mobileDrawerOpen: false };

		case 'TOGGLE_MOBILE_DRAWER':
			return { ...state, mobileDrawerOpen: ! state.mobileDrawerOpen };

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
	isMobileDrawerOpen: ( state: State ) => state.mobileDrawerOpen,
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
