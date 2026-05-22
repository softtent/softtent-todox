import Badge from './Badge';
import { useTaskStatuses } from '../../hooks/useTaskStatuses';
import { statusColor, statusLabel } from '../../utils/helpers';

interface StatusBadgeProps {
	status: string;
}

const StatusBadge = ( { status }: StatusBadgeProps ) => {
	const { statuses } = useTaskStatuses();
	const match = statuses.find( ( s ) => s.value === status );
	const color = match?.color ?? statusColor( status );
	const label = match?.label ?? statusLabel( status );

	return <Badge color={ color }>{ label }</Badge>;
};

export default StatusBadge;
