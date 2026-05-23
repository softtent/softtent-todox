import { useState, useEffect, useRef, createPortal } from '@wordpress/element';
import { ChevronDown } from 'lucide-react';

interface TablePickerMenuProps {
	trigger:   React.ReactNode;
	children:  React.ReactNode;
	title?:    string;
}

const TablePickerMenu = ( { trigger, children, title }: TablePickerMenuProps ) => {
	const [ isOpen, setIsOpen ]         = useState( false );
	const [ menuStyle, setMenuStyle ]   = useState<React.CSSProperties>( {} );
	const triggerRef = useRef<HTMLButtonElement>( null );
	const menuRef    = useRef<HTMLDivElement>( null );

	const updatePosition = () => {
		if ( ! triggerRef.current ) return;
		const rect = triggerRef.current.getBoundingClientRect();
		setMenuStyle( {
			position: 'fixed',
			top:      rect.bottom + 4,
			left:     rect.left,
			zIndex:   99999,
		} );
	};

	useEffect( () => {
		const handleOutside = ( e: MouseEvent ) => {
			const target = e.target as Node;
			if (
				! triggerRef.current?.contains( target ) &&
				! menuRef.current?.contains( target )
			) {
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

	return (
		<div className="st-todox-inline-picker">
			<button
				ref={ triggerRef }
				className="st-todox-inline-picker__trigger"
				onClick={ () => setIsOpen( ( v ) => ! v ) }
				title={ title }
			>
				{ trigger }
				<ChevronDown size={ 10 } className="st-todox-inline-picker__chevron" />
			</button>

			{ isOpen && createPortal(
				<div
					ref={ menuRef }
					className="st-todox-inline-picker__menu"
					style={ menuStyle }
				>
					{ children }
				</div>,
				document.body
			) }
		</div>
	);
};

export default TablePickerMenu;
