/**
 * External dependencies
 */
import { useEffect, Suspense } from '@wordpress/element';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSelect } from '@wordpress/data';
import { useQuery } from '@tanstack/react-query';

/**
 * Internal dependencies
 */
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Spinner from '../ui/Spinner';
import { STORE_NAME } from '../../store/workspace';
import { workspacesApi } from '../../api';
import '../../store'; // register stores

const AppLayout = () => {
	const sidebarOpen = useSelect(
		( select: any ) => select( STORE_NAME ).isSidebarOpen(),
		[]
	) as boolean;

	const location  = useLocation();
	const navigate  = useNavigate();
	const isKanban  = location.pathname === '/tasks/kanban' || location.pathname === '/tasks/calendar';

	// First-run guard: if no workspaces exist yet, force the wizard.
	const { data: workspaces, isLoading: wsLoading } = useQuery( {
		queryKey: [ 'workspaces' ],
		queryFn:  workspacesApi.getAll,
	} );

	useEffect( () => {
		if ( ! wsLoading && workspaces && workspaces.length === 0 ) {
			navigate( '/welcome', { replace: true } );
		}
	}, [ wsLoading, workspaces, navigate ] );

	if ( wsLoading || ( workspaces && workspaces.length === 0 ) ) {
		return <Spinner fullscreen />;
	}

	return (
		<div className={ `st-todox-app ${ sidebarOpen ? 'st-todox-app--sidebar-open' : 'st-todox-app--sidebar-closed' }` }>
			<Sidebar />
			<div className="st-todox-app__body">
				<Topbar />
				<main className="st-todox-app__content">
					<div className={ `st-todox-app__inner${ isKanban ? ' st-todox-app__inner--full' : '' }` }>
						<Suspense fallback={ <div className="st-todox-page-loader"><Spinner /></div> }>
							<Outlet />
						</Suspense>
					</div>
				</main>
			</div>
		</div>
	);
};

export default AppLayout;
