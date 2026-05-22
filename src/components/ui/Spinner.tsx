import { cn } from '../../utils/helpers';

interface SpinnerProps {
	size?: number;
	fullscreen?: boolean;
	className?: string;
}

const Spinner = ( { size = 24, fullscreen = false, className }: SpinnerProps ) => {
	const spinner = (
		<svg
			width={ size }
			height={ size }
			viewBox="0 0 24 24"
			fill="none"
			className={ cn( 'st-todox-spinner', className ) }
			aria-label="Loading"
		>
			<circle
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeDasharray="31.4"
				strokeDashoffset="10"
			/>
		</svg>
	);

	if ( fullscreen ) {
		return (
			<div className="st-todox-spinner-fullscreen">
				{ spinner }
			</div>
		);
	}

	return spinner;
};

export default Spinner;
