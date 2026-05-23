/**
 * External dependencies
 */
import { StrictMode, createRoot } from '@wordpress/element';
import { QueryClientProvider } from '@tanstack/react-query';

/**
 * Internal dependencies
 */
import App from './App';
import { queryClient } from './utils/query-client';
import './styles/main.scss';

// Apply saved theme before React renders to prevent flash.
try {
	if ( localStorage.getItem( 'st-todox-theme' ) === 'dark' ) {
		document.documentElement.classList.add( 'dark' );
	}
} catch {}

const rootElement = document.getElementById( 'st-todox' );

if ( rootElement ) {
	createRoot( rootElement ).render(
		<StrictMode>
			<QueryClientProvider client={ queryClient }>
				<App />
			</QueryClientProvider>
		</StrictMode>
	);
}
