/**
 * External dependencies
 */
import { useMemo } from '@wordpress/element';
import { useQuery } from '@tanstack/react-query';

/**
 * Internal dependencies
 */
import { taxonomiesApi } from '../api';
import { useWorkspace } from './useWorkspace';
import type { Taxonomy } from '../types';

export interface TaskStatusOption {
	id:    number | null;
	value: string;
	label: string;
	color: string;
	icon:  string | null;
}

const FALLBACK: TaskStatusOption[] = [
	{ id: null, value: 'todo',        label: 'To Do',       color: '#94a3b8', icon: 'circle' },
	{ id: null, value: 'in_progress', label: 'In Progress',  color: '#3b82f6', icon: 'clock' },
	{ id: null, value: 'review',      label: 'In Review',    color: '#f59e0b', icon: 'eye' },
	{ id: null, value: 'completed',   label: 'Completed',    color: '#22c55e', icon: 'check-circle' },
];

function taxonomyToOption( t: Taxonomy ): TaskStatusOption {
	const value = t.slug
		?? t.name.toLowerCase().replace( /[^a-z0-9]+/g, '_' ).replace( /^_|_$/g, '' );
	return { id: t.id, value, label: t.name, color: t.color, icon: t.icon };
}

export function useTaskStatuses() {
	const { activeWorkspaceId } = useWorkspace();

	const { data: taxonomies, isLoading: queryLoading } = useQuery< Taxonomy[] >( {
		queryKey:  [ 'taxonomies', 'task_status', activeWorkspaceId ],
		queryFn:   () => taxonomiesApi.getAll( activeWorkspaceId!, 'task_status' ),
		enabled:   !! activeWorkspaceId,
		staleTime: 5 * 60_000,
	} );

	// isLoading is true while workspace hasn't resolved OR the taxonomy query is in-flight.
	// Callers that group/filter tasks should wait for isLoading=false before using statuses
	// so they never operate on the hardcoded FALLBACK list and silently misplace tasks.
	const isLoading = ! activeWorkspaceId || queryLoading;

	const statuses = useMemo<TaskStatusOption[]>(
		() => taxonomies && taxonomies.length > 0
			? taxonomies.map( taxonomyToOption )
			: FALLBACK,
		[ taxonomies ]
	);

	return { statuses, isLoading };
}
