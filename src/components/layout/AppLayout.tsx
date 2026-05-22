/**
 * External dependencies
 */
import { Outlet, useLocation } from 'react-router-dom';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { STORE_NAME } from '../../store/workspace';
import '../../store'; // register stores

const AppLayout = () => {
	const sidebarOpen = useSelect(
		( select: any ) => select( STORE_NAME ).isSidebarOpen(),
		[]
	) as boolean;

	const location  = useLocation();
	const isKanban  = location.pathname === '/tasks/kanban';

	return (
		<div className={ `st-todox-app ${ sidebarOpen ? 'st-todox-app--sidebar-open' : 'st-todox-app--sidebar-closed' }` }>
			<Sidebar />
			<div className="st-todox-app__body">
				<Topbar />
				<main className="st-todox-app__content">
					<div className={ `st-todox-app__inner${ isKanban ? ' st-todox-app__inner--full' : '' }` }>
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	);
};

export default AppLayout;
