import Badge from './Badge';
import { priorityColor, priorityLabel } from '../../utils/helpers';
import type { TaskPriority } from '../../types';

interface PriorityBadgeProps {
	priority: TaskPriority;
}

const PriorityBadge = ( { priority }: PriorityBadgeProps ) => (
	<Badge color={ priorityColor( priority ) }>
		{ priorityLabel( priority ) }
	</Badge>
);

export default PriorityBadge;
