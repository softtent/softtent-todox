import { useEffect, RefObject } from '@wordpress/element';

export function useClickOutside< T extends HTMLElement >(
	ref: RefObject< T >,
	callback: () => void
): void {
	useEffect( () => {
		function handler( event: MouseEvent ) {
			if ( ref.current && ! ref.current.contains( event.target as Node ) ) {
				callback();
			}
		}

		document.addEventListener( 'mousedown', handler );

		return () => document.removeEventListener( 'mousedown', handler );
	}, [ ref, callback ] );
}
