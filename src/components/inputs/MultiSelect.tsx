/**
 * External dependencies
 */
import { useState, useEffect, useRef, KeyboardEvent, createPortal } from '@wordpress/element';
import { X, ChevronDown } from 'lucide-react';

/**
 * Internal dependencies
 */
import Spinner from '../ui/Spinner';

export interface MultiSelectOption {
	id: number;
	name: string;
	color?: string;
}

interface MultiSelectProps {
	options: MultiSelectOption[];
	selectedIds: number[];
	onChange: ( ids: number[] ) => void;
	placeholder?: string;
	icon?: React.ReactNode;
	disabled?: boolean;
	loading?: boolean;
	emptyMessage?: string;
	searchPlaceholder?: string;
}

const MultiSelect = ( {
	options,
	selectedIds,
	onChange,
	placeholder = 'Select…',
	icon,
	disabled = false,
	loading = false,
	emptyMessage = 'No options available.',
	searchPlaceholder = 'Search…',
}: MultiSelectProps ) => {
	const [ isOpen, setIsOpen ]               = useState( false );
	const [ search, setSearch ]               = useState( '' );
	const [ dropdownStyle, setDropdownStyle ] = useState<React.CSSProperties>( {} );
	const containerRef  = useRef<HTMLDivElement>( null );
	const dropdownRef   = useRef<HTMLDivElement>( null );
	const searchInputRef = useRef<HTMLInputElement>( null );

	const updatePosition = () => {
		if ( ! containerRef.current ) return;
		const rect = containerRef.current.getBoundingClientRect();
		setDropdownStyle( {
			position: 'fixed',
			top:      rect.bottom + 4,
			left:     rect.left,
			width:    rect.width,
			zIndex:   99999,
		} );
	};

	useEffect( () => {
		const handleOutside = ( e: MouseEvent ) => {
			const target = e.target as Node;
			if ( ! containerRef.current?.contains( target ) && ! dropdownRef.current?.contains( target ) ) {
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

	useEffect( () => {
		if ( isOpen ) searchInputRef.current?.focus();
	}, [ isOpen ] );

	useEffect( () => {
		if ( ! isOpen ) setSearch( '' );
	}, [ isOpen ] );

	const selected = options.filter( ( o ) => selectedIds.includes( o.id ) );
	const filtered = options.filter( ( o ) =>
		! search.trim() || o.name.toLowerCase().includes( search.toLowerCase() )
	);

	const toggle = ( id: number ) =>
		onChange( selectedIds.includes( id )
			? selectedIds.filter( ( x ) => x !== id )
			: [ ...selectedIds, id ]
		);

	const remove = ( id: number, e: React.MouseEvent ) => {
		e.stopPropagation();
		onChange( selectedIds.filter( ( x ) => x !== id ) );
	};

	const handleTriggerKey = ( e: KeyboardEvent<HTMLButtonElement> ) => {
		if ( e.key === 'Enter' || e.key === ' ' ) { e.preventDefault(); setIsOpen( ! isOpen ); }
	};

	const handleItemKey = ( e: KeyboardEvent<HTMLButtonElement>, id: number ) => {
		if ( e.key === 'Enter' || e.key === ' ' ) { e.preventDefault(); toggle( id ); }
	};

	const swatchStyle = ( color?: string ) => color ? {
		background: color + '18',
		color,
		border: `1px solid ${ color }30`,
	} : {};

	return (
		<div className="st-todox-label-selector" ref={ containerRef }>
			<button
				type="button"
				className="st-todox-label-selector__trigger"
				onClick={ () => ! disabled && setIsOpen( ! isOpen ) }
				onKeyDown={ handleTriggerKey }
				disabled={ disabled }
				tabIndex={ 0 }
			>
				<div className="st-todox-label-selector__content">
					{ selected.length > 0 ? (
						<div className="st-todox-label-selector__badges">
							{ selected.map( ( o ) => (
								<span key={ o.id } className="st-todox-label-badge" style={ swatchStyle( o.color ) }>
									{ o.name }
									<span
										role="button"
										className="st-todox-label-badge__remove"
										onClick={ ( e ) => remove( o.id, e as unknown as React.MouseEvent ) }
										tabIndex={ -1 }
										aria-label="Remove"
									>
										<X size={ 12 } />
									</span>
								</span>
							) ) }
						</div>
					) : (
						<span className="st-todox-label-selector__placeholder">
							{ icon }
							{ placeholder }
						</span>
					) }
					<ChevronDown
						size={ 14 }
						className={ `st-todox-label-selector__chevron ${ isOpen ? 'st-todox-label-selector__chevron--open' : '' }` }
					/>
				</div>
			</button>

			{ isOpen && createPortal(
				<div className="st-todox-label-selector__dropdown" style={ dropdownStyle } ref={ dropdownRef }>
					<div className="st-todox-label-selector__search">
						<input
							ref={ searchInputRef }
							type="text"
							className="st-todox-form__input st-todox-label-selector__search-input"
							placeholder={ searchPlaceholder }
							value={ search }
							onChange={ ( e ) => setSearch( e.target.value ) }
							onClick={ ( e ) => e.stopPropagation() }
						/>
					</div>
					<div className="st-todox-label-selector__list">
						{ loading ? (
							<div className="st-todox-label-selector__loading">
								<Spinner size="sm" />
							</div>
						) : filtered.length > 0 ? (
							filtered.map( ( o ) => {
								const isSelected = selectedIds.includes( o.id );
								return (
									<button
										key={ o.id }
										type="button"
										className={ `st-todox-label-selector__item ${ isSelected ? 'st-todox-label-selector__item--selected' : '' }` }
										onClick={ () => toggle( o.id ) }
										onKeyDown={ ( e ) => handleItemKey( e, o.id ) }
									>
										<span className="st-todox-label-selector__item-badge" style={ swatchStyle( o.color ) }>
											{ o.name }
										</span>
										{ isSelected && <span className="st-todox-label-selector__check">✓</span> }
									</button>
								);
							} )
						) : (
							<div className="st-todox-label-selector__empty">
								{ search.trim() ? 'No results found.' : emptyMessage }
							</div>
						) }
					</div>
				</div>,
				document.body
			) }
		</div>
	);
};

export default MultiSelect;
