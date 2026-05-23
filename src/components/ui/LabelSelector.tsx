/**
 * External dependencies
 */
import { useQuery } from '@tanstack/react-query';
import { Tag } from 'lucide-react';

/**
 * Internal dependencies
 */
import { taxonomiesApi } from '../../api';
import { MultiSelect } from '../inputs';
import type { Taxonomy } from '../../types';

interface LabelSelectorProps {
	workspaceId: number;
	labelType: 'task_label' | 'subtask_label' | 'project_label';
	selectedIds: number[];
	onChange: ( ids: number[] ) => void;
	placeholder?: string;
	disabled?: boolean;
}

const LabelSelector = ( {
	workspaceId,
	labelType,
	selectedIds,
	onChange,
	placeholder = 'Select labels…',
	disabled = false,
}: LabelSelectorProps ) => {
	const { data: labels = [], isLoading } = useQuery<Taxonomy[]>( {
		queryKey: [ 'taxonomies', labelType, workspaceId ],
		queryFn:  () => taxonomiesApi.getAll( workspaceId, labelType ),
		enabled:  !! workspaceId,
		staleTime: 5 * 60_000,
	} );

	return (
		<MultiSelect
			options={ labels }
			selectedIds={ selectedIds }
			onChange={ onChange }
			placeholder={ placeholder }
			icon={ <Tag size={ 14 } /> }
			disabled={ disabled }
			loading={ isLoading }
			emptyMessage="No labels available. Create some in Settings > Labels."
			searchPlaceholder="Search labels…"
		/>
	);
};

export default LabelSelector;
