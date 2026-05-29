import { useEffect, useState } from '@wordpress/element';

export function useMediaQuery( query: string ): boolean {
	const get = () =>
		typeof window !== 'undefined' && typeof window.matchMedia === 'function'
			? window.matchMedia( query ).matches
			: false;

	const [ matches, setMatches ] = useState< boolean >( get );

	useEffect( () => {
		if ( typeof window === 'undefined' || typeof window.matchMedia !== 'function' ) {
			return;
		}
		const mql = window.matchMedia( query );
		const onChange = ( e: MediaQueryListEvent ) => setMatches( e.matches );
		setMatches( mql.matches );
		if ( mql.addEventListener ) {
			mql.addEventListener( 'change', onChange );
			return () => mql.removeEventListener( 'change', onChange );
		}
		mql.addListener( onChange );
		return () => mql.removeListener( onChange );
	}, [ query ] );

	return matches;
}

export const useIsMobile = () => useMediaQuery( '(max-width: 767px)' );
