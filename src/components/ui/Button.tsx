import { cn } from '../../utils/helpers';
import Spinner from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes< HTMLButtonElement > {
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
	size?: 'sm' | 'md' | 'lg';
	loading?: boolean;
	leftIcon?: React.ReactNode;
}

const Button = ( {
	children,
	variant = 'primary',
	size = 'md',
	loading = false,
	leftIcon,
	className,
	disabled,
	...props
}: ButtonProps ) => {
	return (
		<button
			{ ...props }
			disabled={ disabled || loading }
			className={ cn(
				'st-todox-btn',
				`st-todox-btn--${ variant }`,
				`st-todox-btn--${ size }`,
				loading && 'st-todox-btn--loading',
				className
			) }
		>
			{ loading ? (
				<Spinner size={ 14 } />
			) : (
				leftIcon && <span className="st-todox-btn__icon">{ leftIcon }</span>
			) }
			{ children }
		</button>
	);
};

export default Button;
