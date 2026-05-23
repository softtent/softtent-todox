/**
 * External dependencies
 */
import { useState, useEffect, useRef, createPortal } from '@wordpress/element';
// @ts-ignore — externalized at runtime via window.wp.components
import { ColorPicker as WPColorPicker, GradientPicker } from '@wordpress/components';

interface ColorPickerProps {
	colors?: string[];
	value: string;
	onChange: ( color: string ) => void;
	gradient?: boolean;
}

const PRESET_GRADIENTS = [
	{ name: 'Ocean',   gradient: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', slug: 'ocean' },
	{ name: 'Sunset',  gradient: 'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)', slug: 'sunset' },
	{ name: 'Emerald', gradient: 'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)', slug: 'emerald' },
	{ name: 'Forest',  gradient: 'linear-gradient(135deg,#11998e 0%,#38ef7d 100%)',  slug: 'forest' },
];

const isGradient = ( v: string ) => !! v && v.includes( 'gradient' );

const ColorPicker = ( {
	colors = [],
	value = '',
	onChange,
	gradient = false,
}: ColorPickerProps ) => {
	const [ isOpen, setIsOpen ]             = useState( false );
	const [ colorType, setColorType ]       = useState<'solid' | 'gradient'>( () => isGradient( value ) ? 'gradient' : 'solid' );
	const [ popoverStyle, setPopoverStyle ] = useState<React.CSSProperties>( {} );
	const triggerRef = useRef<HTMLDivElement>( null );
	const popoverRef = useRef<HTMLDivElement>( null );

	// Sync colorType when value changes
	useEffect( () => {
		setColorType( isGradient( value ) ? 'gradient' : 'solid' );
	}, [ value ] );

	const updatePosition = () => {
		if ( ! triggerRef.current ) return;
		const rect = triggerRef.current.getBoundingClientRect();
		setPopoverStyle( {
			position: 'fixed',
			top:      rect.bottom + 6,
			left:     rect.left,
			zIndex:   99999,
		} );
	};

	useEffect( () => {
		const handleOutside = ( e: MouseEvent ) => {
			const t = e.target as Node;
			if ( ! triggerRef.current?.contains( t ) && ! popoverRef.current?.contains( t ) ) {
				setIsOpen( false );
			}
		};
		if ( isOpen ) {
			updatePosition();
			document.addEventListener( 'mousedown', handleOutside, true );
			window.addEventListener( 'scroll', updatePosition, true );
			window.addEventListener( 'resize', updatePosition );
		}
		return () => {
			document.removeEventListener( 'mousedown', handleOutside, true );
			window.removeEventListener( 'scroll', updatePosition, true );
			window.removeEventListener( 'resize', updatePosition );
		};
	}, [ isOpen ] );

	const handleColorTypeChange = ( type: 'solid' | 'gradient' ) => {
		setColorType( type );
		// Clear value when switching types
		if ( type === 'solid' && isGradient( value ) ) onChange( '' );
		else if ( type === 'gradient' && ! isGradient( value ) ) onChange( '' );
	};

	const previewBackground = value || 'transparent';

	return (
		<div className="st-todox-cp" ref={ triggerRef }>
			{/* Trigger: swatch + hex/gradient value */}
			<div
				className={ `st-todox-cp__trigger ${ isOpen ? 'st-todox-cp__trigger--open' : '' }` }
				onClick={ () => setIsOpen( ! isOpen ) }
				role="button"
				tabIndex={ 0 }
				onKeyDown={ ( e ) => {
					if ( e.key === 'Enter' || e.key === ' ' ) { e.preventDefault(); setIsOpen( ! isOpen ); }
				} }
			>
				<span
					className="st-todox-cp__preview"
					style={ { background: previewBackground } }
				/>
				<span className="st-todox-cp__value-text">
					{ value || 'Choose color…' }
				</span>
			</div>

			{ isOpen && createPortal(
				<div className="st-todox-cp__popover" style={ popoverStyle } ref={ popoverRef }>

					{/* Solid / Gradient tabs */}
					{ gradient && (
						<div className="st-todox-cp__tabs">
							<button
								type="button"
								className={ `st-todox-cp__tab ${ colorType === 'solid' ? 'st-todox-cp__tab--active' : '' }` }
								onClick={ () => handleColorTypeChange( 'solid' ) }
							>
								Solid
							</button>
							<button
								type="button"
								className={ `st-todox-cp__tab ${ colorType === 'gradient' ? 'st-todox-cp__tab--active' : '' }` }
								onClick={ () => handleColorTypeChange( 'gradient' ) }
							>
								Gradient
							</button>
						</div>
					) }

					{/* Picker content */}
					<div className="st-todox-cp__picker-wrap">
						{ gradient && colorType === 'gradient' ? (
							<GradientPicker
								value={ value || undefined }
								onChange={ ( v: string | null ) => onChange( v || '' ) }
								gradients={ PRESET_GRADIENTS }
							/>
						) : (
							<WPColorPicker
								color={ isGradient( value ) ? '' : value }
								onChange={ onChange }
								enableAlpha={ false }
								defaultValue={ value }
							/>
						) }
					</div>
				</div>,
				document.body
			) }
		</div>
	);
};

export default ColorPicker;
