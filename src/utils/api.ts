/**
 * Central apiFetch wrapper.
 *
 * All network calls go through here so we have a single point for:
 * - Namespace management
 * - Error normalization
 * - Response unwrapping
 */

import apiFetch from '@wordpress/api-fetch';

const NAMESPACE = 'todox/v1';

const path = ( endpoint: string ): string => `/${ NAMESPACE }/${ endpoint }`;

type ApiResult< T > = { success: boolean; data: T; message?: string };

async function unwrap< T >( promise: Promise< ApiResult< T > > ): Promise< T > {
	const result = await promise;

	if ( ! result.success ) {
		const messages = Array.isArray( result.data )
			? ( result.data as string[] ).join( ', ' )
			: String( result.data );
		throw new Error( messages || 'Request failed' );
	}

	return result.data;
}

export const api = {
	get< T >( endpoint: string, params?: Record< string, unknown > ): Promise< T > {
		let query = '';
		if ( params ) {
			const clean = Object.entries( params ).filter( ( [ , v ] ) => v !== undefined && v !== null );
			if ( clean.length ) {
				query = '?' + new URLSearchParams( Object.fromEntries( clean ) as Record< string, string > ).toString();
			}
		}

		return unwrap< T >(
			apiFetch( { path: path( endpoint ) + query } ) as Promise< ApiResult< T > >
		);
	},

	post< T >( endpoint: string, data: unknown ): Promise< T > {
		return unwrap< T >(
			apiFetch( {
				path: path( endpoint ),
				method: 'POST',
				data,
			} ) as Promise< ApiResult< T > >
		);
	},

	put< T >( endpoint: string, data: unknown ): Promise< T > {
		return unwrap< T >(
			apiFetch( {
				path: path( endpoint ),
				method: 'PUT',
				data,
			} ) as Promise< ApiResult< T > >
		);
	},

	delete< T = null >( endpoint: string ): Promise< T > {
		return unwrap< T >(
			apiFetch( {
				path: path( endpoint ),
				method: 'DELETE',
			} ) as Promise< ApiResult< T > >
		);
	},
};
