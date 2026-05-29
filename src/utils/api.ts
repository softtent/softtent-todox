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

/**
 * Shape of a WordPress REST API error returned with a non-2xx status.
 */
interface WpRestError {
	code?: string;
	message?: string;
	data?: { status?: number };
}

export class ApiError extends Error {
	code: string;
	status: number;

	constructor( message: string, code = 'unknown_error', status = 0 ) {
		super( message );
		this.name = 'ApiError';
		this.code = code;
		this.status = status;
	}
}

function toApiError( err: unknown ): ApiError {
	if ( err instanceof ApiError ) return err;

	if ( err && typeof err === 'object' ) {
		const e = err as WpRestError;
		if ( typeof e.message === 'string' ) {
			return new ApiError(
				e.message,
				e.code ?? 'rest_error',
				e.data?.status ?? 0
			);
		}
	}

	if ( err instanceof Error ) return new ApiError( err.message );

	return new ApiError( 'Request failed' );
}

async function unwrap< T >( promise: Promise< ApiResult< T > > ): Promise< T > {
	let result: ApiResult< T >;

	try {
		result = await promise;
	} catch ( err ) {
		throw toApiError( err );
	}

	if ( ! result.success ) {
		const messages = Array.isArray( result.data )
			? ( result.data as string[] ).join( ', ' )
			: String( result.data );
		throw new ApiError( messages || result.message || 'Request failed', 'request_failed' );
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
