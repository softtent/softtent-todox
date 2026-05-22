import { cn } from '../../utils/helpers';

interface BadgeProps {
	children: React.ReactNode;
	color?: string;
	variant?: 'solid' | 'soft' | 'outline';
	size?: 'sm' | 'md';
	className?: string;
}

const Badge = ( {
	children,
	color = '#6366f1',
	variant = 'soft',
	size = 'sm',
	className,
}: BadgeProps ) => {
	const getStyle = (): React.CSSProperties => {
		switch ( variant ) {
			case 'solid':
				return { background: color, color: '#fff' };
			case 'outline':
				return { border: `1px solid ${ color }`, color };
			case 'soft':
			default:
				return { background: color + '20', color };
		}
	};

	return (
		<span
			className={ cn(
				'st-todox-badge',
				size === 'sm' ? 'st-todox-badge--sm' : 'st-todox-badge--md',
				className
			) }
			style={ getStyle() }
		>
			{ children }
		</span>
	);
};

export default Badge;
