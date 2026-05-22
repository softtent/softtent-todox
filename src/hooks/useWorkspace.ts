import { useEffect } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { useQuery } from '@tanstack/react-query';
import { STORE_NAME } from '../store/workspace';
import { workspacesApi } from '../api';
import type { Workspace } from '../types';

export function useWorkspace() {
	const { setActiveWorkspace } = useDispatch( STORE_NAME );

	const activeWorkspaceId = useSelect(
		( select: any ) => select( STORE_NAME ).getActiveWorkspaceId(),
		[]
	);

	const activeWorkspace = useSelect(
		( select: any ) => select( STORE_NAME ).getActiveWorkspace(),
		[]
	) as Workspace | null;

	const { data: workspaces = [] as Workspace[], isLoading } = useQuery< Workspace[] >( {
		queryKey: [ 'workspaces' ],
		queryFn: workspacesApi.getAll,
	} );

	// Auto-select first workspace if none is stored, or rehydrate the active workspace object.
	useEffect( () => {
		if ( ! workspaces.length ) return;

		if ( ! activeWorkspaceId ) {
			setActiveWorkspace( workspaces[ 0 ] );
		} else if ( ! activeWorkspace ) {
			const ws = workspaces.find( ( w: Workspace ) => w.id === activeWorkspaceId );
			if ( ws ) setActiveWorkspace( ws );
		}
	}, [ workspaces, activeWorkspaceId, activeWorkspace ] );

	const switchWorkspace = ( workspace: Workspace ) => {
		setActiveWorkspace( workspace );
	};

	return {
		workspaces,
		activeWorkspace: ( activeWorkspace || workspaces.find( ( w: Workspace ) => w.id === activeWorkspaceId ) || null ) as Workspace | null,
		activeWorkspaceId: activeWorkspaceId as number | null,
		isLoading,
		switchWorkspace,
	};
}
