import { cn, getInitials } from '../../utils/helpers';

interface AvatarProps {
	name: string;
	src?: string | null;
	size?: number;
	className?: string;
}

const Avatar = ( { name, src, size = 32, className }: AvatarProps ) => {
	const safeName = name ?? '';
	const initials  = getInitials( safeName );

	if ( src ) {
		return (
			<img
				src={ src }
				alt={ safeName }
				title={ safeName }
				width={ size }
				height={ size }
				className={ cn( 'st-todox-avatar st-todox-avatar--image', className ) }
				style={ { width: size, height: size, borderRadius: '50%' } }
				onError={ ( e ) => {
					( e.currentTarget as HTMLImageElement ).style.display = 'none';
				} }
			/>
		);
	}

	// Color derived deterministically from name
	const code0 = safeName.charCodeAt( 0 ) || 0;
	const codeN = safeName.charCodeAt( safeName.length - 1 ) || 0;
	const hue   = ( code0 + codeN ) % 360;

	return (
		<span
			title={ safeName }
			className={ cn( 'st-todox-avatar st-todox-avatar--initials', className ) }
			style={ {
				width: size,
				height: size,
				fontSize: size * 0.4,
				background: `hsl(${ hue }, 60%, 50%)`,
				color: '#fff',
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				borderRadius: '50%',
				fontWeight: 600,
				flexShrink: 0,
				userSelect: 'none',
			} }
		>
			{ initials }
		</span>
	);
};

export default Avatar;
