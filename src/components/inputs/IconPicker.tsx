/**
 * External dependencies
 */
import { useState, useEffect, useRef, createPortal } from '@wordpress/element';
import { ChevronDown } from 'lucide-react';

export interface IconOption {
	name: string;
	symbol: string;
}

interface IconPickerProps {
	icons: IconOption[];
	value: string;
	onChange: ( name: string ) => void;
}

const IconPicker = ( { icons, value, onChange }: IconPickerProps ) => {
	const [ isOpen, setIsOpen ]             = useState( false );
	const [ dropdownStyle, setDropdownStyle ] = useState<React.CSSProperties>( {} );
	const triggerRef  = useRef<HTMLDivElement>( null );
	const dropdownRef = useRef<HTMLDivElement>( null );

	const current = icons.find( ( i ) => i.name === value ) ?? icons[ 0 ];

	const updatePosition = () => {
		if ( ! triggerRef.current ) return;
		const rect = triggerRef.current.getBoundingClientRect();
		setDropdownStyle( {
			position: 'fixed',
			top:      rect.bottom + 4,
			left:     rect.left,
			minWidth: rect.width,
			zIndex:   99999,
		} );
	};

	useEffect( () => {
		const handleOutside = ( e: MouseEvent ) => {
			const t = e.target as Node;
			if ( ! triggerRef.current?.contains( t ) && ! dropdownRef.current?.contains( t ) ) {
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

	const select = ( name: string ) => {
		onChange( name );
		setIsOpen( false );
	};

	return (
		<div className="st-todox-ip" ref={ triggerRef }>
			<button
				type="button"
				className={ `st-todox-ip__trigger ${ isOpen ? 'st-todox-ip__trigger--open' : '' }` }
				onClick={ () => setIsOpen( ! isOpen ) }
			>
				<span className="st-todox-ip__symbol">{ current.symbol }</span>
				<span className="st-todox-ip__name">{ current.name }</span>
				<ChevronDown
					size={ 14 }
					className={ `st-todox-ip__chevron ${ isOpen ? 'st-todox-ip__chevron--open' : '' }` }
				/>
			</button>

			{ isOpen && createPortal(
				<div className="st-todox-ip__dropdown" style={ dropdownStyle } ref={ dropdownRef }>
					{ icons.map( ( icon ) => (
						<button
							key={ icon.name }
							type="button"
							className={ `st-todox-ip__item ${ value === icon.name ? 'st-todox-ip__item--selected' : '' }` }
							onClick={ () => select( icon.name ) }
						>
							<span className="st-todox-ip__item-symbol">{ icon.symbol }</span>
							<span className="st-todox-ip__item-name">{ icon.name }</span>
						</button>
					) ) }
				</div>,
				document.body
			) }
		</div>
	);
};

export default IconPicker;
