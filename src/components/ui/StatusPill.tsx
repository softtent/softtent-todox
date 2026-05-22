/**
 * External dependencies
 */
import { useState, useRef } from '@wordpress/element';
import { ChevronRight, Check } from 'lucide-react';

/**
 * Internal dependencies
 */
import { useClickOutside } from '../../hooks/useClickOutside';

export interface StatusPillOption {
	label: string;
	color: string;
}

interface StatusPillProps< T extends string > {
	current:  T;
	options:  T[];
	config:   Record< T, StatusPillOption >;
	onChange: ( s: T ) => void;
	loading?: boolean;
}

function StatusPill< T extends string >( {
	current,
	options,
	config,
	onChange,
	loading,
}: StatusPillProps< T > ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef< HTMLDivElement >( null );
	useClickOutside( ref, () => setOpen( false ) );
	const cfg = config[ current ];

	return (
		<div className="st-todox-status-pill-wrap" ref={ ref }>
			<button
				className="st-todox-status-pill"
				style={ {
					background: cfg.color + '18',
					color:      cfg.color,
					border:     `1px solid ${ cfg.color }30`,
				} }
				onClick={ ( e ) => { e.stopPropagation(); setOpen( ! open ); } }
				disabled={ loading }
			>
				<span className="st-todox-status-pill__dot" style={ { background: cfg.color } } />
				{ cfg.label }
				<ChevronRight size={ 10 } className="st-todox-status-pill__chevron" />
			</button>

			{ open && (
				<>
					<div className="st-todox-dropdown-backdrop" onClick={ () => setOpen( false ) } />
					<div className="st-todox-status-pill__dropdown">
						{ options.map( ( s ) => {
							const c = config[ s ];
							return (
								<button
									key={ s }
									className={ current === s ? 'st-todox-dropdown-status-current' : '' }
									onClick={ () => { onChange( s ); setOpen( false ); } }
								>
									<span className="st-todox-dropdown-status-dot" style={ { background: c.color } } />
									{ c.label }
									{ current === s && <Check size={ 11 } className="st-todox-dropdown-status-check" /> }
								</button>
							);
						} ) }
					</div>
				</>
			) }
		</div>
	);
}

export default StatusPill;
