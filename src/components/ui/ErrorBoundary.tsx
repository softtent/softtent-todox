/**
 * External dependencies
 */
import { Component } from '@wordpress/element';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
	children: React.ReactNode;
	fallback?: React.ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
	constructor( props: Props ) {
		super( props );
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError( error: Error ): State {
		return { hasError: true, error };
	}

	componentDidCatch( error: Error, info: React.ErrorInfo ) {
		// eslint-disable-next-line no-console
		console.error( '[TodoX] Uncaught error:', error, info.componentStack );
	}

	render() {
		if ( this.state.hasError ) {
			if ( this.props.fallback ) return this.props.fallback;

			return (
				<div className="st-todox-error-boundary">
					<div className="st-todox-error-boundary__card">
						<AlertTriangle size={ 36 } className="st-todox-error-boundary__icon" />
						<h2 className="st-todox-error-boundary__title">Something went wrong</h2>
						<p className="st-todox-error-boundary__msg">
							{ this.state.error?.message ?? 'An unexpected error occurred.' }
						</p>
						<button
							className="st-todox-error-boundary__btn"
							onClick={ () => {
								this.setState( { hasError: false, error: null } );
								window.location.reload();
							} }
						>
							<RefreshCw size={ 14 } /> Reload page
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
