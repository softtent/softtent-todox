/**
 * External dependencies
 */
import { Building2 } from 'lucide-react';

/**
 * Internal dependencies
 */
import { MultiSelect } from '../inputs';
import type { Department } from '../../types';

interface DepartmentSelectorProps {
	departments: Department[];
	selectedIds: number[];
	onChange: ( ids: number[] ) => void;
	placeholder?: string;
	disabled?: boolean;
}

const DepartmentSelector = ( {
	departments,
	selectedIds,
	onChange,
	placeholder = 'Select teams…',
	disabled = false,
}: DepartmentSelectorProps ) => (
	<MultiSelect
		options={ departments }
		selectedIds={ selectedIds }
		onChange={ onChange }
		placeholder={ placeholder }
		icon={ <Building2 size={ 14 } /> }
		disabled={ disabled }
		emptyMessage="No teams available."
		searchPlaceholder="Search teams…"
	/>
);

export default DepartmentSelector;
