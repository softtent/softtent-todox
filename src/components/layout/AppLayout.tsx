/**
 * External dependencies
 */
import { useEffect, Suspense } from '@wordpress/element';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSelect, useDispatch } from '@wordpress/data';
import { useQuery } from '@tanstack/react-query';

/**
 * Internal dependencies
 */
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Spinner from '../ui/Spinner';
import { STORE_NAME } from '../../store/workspace';
import { workspacesApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import { WORKSPACE_MODULE_DEFAULTS } from '../../types';
import type { WorkspaceModuleKey } from '../../types';
import '../../store'; // register stores

// Path prefixes that map to a toggleable module. Disabling a module
// redirects any nav into its prefix back to the dashboard.
const MODULE_ROUTE_PREFIXES: { prefix: string; module: WorkspaceModuleKey }[] = [
	{ prefix: '/departments', module: 'departments' },
	{ prefix: '/teams',       module: 'teams'       },
	{ prefix: '/projects',    module: 'projects'    },
	{ prefix: '/sprints',     module: 'sprints'     },
];

const AppLayout = () => {
	const sidebarOpen = useSelect(
		( select: any ) => select( STORE_NAME ).isSidebarOpen(),
		[]
	) as boolean;

	const mobileDrawerOpen = useSelect(
		( select: any ) => select( STORE_NAME ).isMobileDrawerOpen(),
		[]
	) as boolean;

	const { closeMobileDrawer } = useDispatch( STORE_NAME );

	const location  = useLocation();
	const navigate  = useNavigate();
	const isKanban  = location.pathname === '/tasks/kanban' || location.pathname === '/tasks/calendar';

	// Auto-close mobile drawer on route change as a safety net.
	useEffect( () => {
		if ( mobileDrawerOpen ) closeMobileDrawer();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ location.pathname ] );

	// Lock body scroll while drawer is open so the page behind doesn't scroll.
	useEffect( () => {
		if ( mobileDrawerOpen ) {
			document.body.style.overflow = 'hidden';
			return () => { document.body.style.overflow = ''; };
		}
		return undefined;
	}, [ mobileDrawerOpen ] );

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

	// Guard routes for disabled modules — redirect to dashboard.
	const { activeWorkspace } = useWorkspace();
	useEffect( () => {
		if ( ! activeWorkspace ) return;
		const modules = { ...WORKSPACE_MODULE_DEFAULTS, ...( activeWorkspace.modules ?? {} ) };
		const hit = MODULE_ROUTE_PREFIXES.find( ( m ) =>
			location.pathname === m.prefix || location.pathname.startsWith( m.prefix + '/' )
		);
		if ( hit && ! modules[ hit.module ] ) {
			navigate( '/', { replace: true } );
		}
	}, [ activeWorkspace, location.pathname, navigate ] );

	if ( wsLoading || ( workspaces && workspaces.length === 0 ) ) {
		return <Spinner fullscreen />;
	}

	return (
		<div
			className={ `st-todox-app ${ sidebarOpen ? 'st-todox-app--sidebar-open' : 'st-todox-app--sidebar-closed' } ${ mobileDrawerOpen ? 'st-todox-app--drawer-open' : '' }` }
		>
			<Sidebar />

			{/* Mobile drawer backdrop — only rendered when drawer is open */}
			{ mobileDrawerOpen && (
				<button
					type="button"
					aria-label="Close navigation menu"
					className="st-todox-app__backdrop"
					onClick={ () => closeMobileDrawer() }
				/>
			) }

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
