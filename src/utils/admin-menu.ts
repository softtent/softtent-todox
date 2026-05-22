/**
 * Synchronize the WordPress admin sidebar active state
 * with the current React Router hash route.
 */
export function syncAdminMenu(): void {
	const hash = window.location.hash || '#/';
	const slug = 'softtent-todox';

	document.querySelectorAll< HTMLAnchorElement >(
		`#adminmenu a[href*="page=${ slug }"]`
	).forEach( ( link ) => {
		const linkHash = link.href.split( '#' )[ 1 ] ?? '/';
		const li = link.closest( 'li' );

		if ( ! li ) return;

		li.classList.remove( 'current', 'wp-has-current-submenu' );
		link.classList.remove( 'current', 'wp-current-item' );

		if ( hash.startsWith( '#' + linkHash ) ) {
			li.classList.add( 'current' );
			link.classList.add( 'current' );
		}
	} );
}
