import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient( {
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 2,  // 2 minutes
			retry: ( failureCount, error ) => {
				// Don't retry on 4xx — those are deterministic (auth, validation).
				if ( error instanceof ApiError && error.status >= 400 && error.status < 500 ) {
					return false;
				}
				return failureCount < 1;
			},
			refetchOnWindowFocus: false,
		},
		mutations: {
			retry: false,
		},
	},
} );
