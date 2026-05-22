/**
 * External dependencies
 */
import { Suspense } from '@wordpress/element';
import { RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/**
 * Internal dependencies
 */
import { router } from './routes';
import Spinner from './components/ui/Spinner';
import ErrorBoundary from './components/ui/ErrorBoundary';

const App = () => {
	return (
		<ErrorBoundary>
			<ToastContainer
				position="top-right"
				autoClose={ 3000 }
				hideProgressBar
				closeOnClick
				pauseOnHover
			/>
			<Suspense fallback={ <Spinner fullscreen /> }>
				<RouterProvider router={ router } />
			</Suspense>
		</ErrorBoundary>
	);
};

export default App;
