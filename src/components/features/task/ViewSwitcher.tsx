/**
 * External dependencies
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutList, Kanban, AlignJustify, CalendarDays } from 'lucide-react';

const VIEWS = [
	{ path: '/tasks',          Icon: LayoutList,    label: 'Table'    },
	{ path: '/tasks/kanban',   Icon: Kanban,        label: 'Kanban'   },
	{ path: '/tasks/list',     Icon: AlignJustify,  label: 'List'     },
	{ path: '/tasks/calendar', Icon: CalendarDays,  label: 'Calendar' },
] as const;

const ViewSwitcher = () => {
	const navigate         = useNavigate();
	const { pathname }     = useLocation();

	return (
		<div className="st-todox-view-switcher">
			{ VIEWS.map( ( { path, Icon, label } ) => {
				const isActive = path === '/tasks'
					? pathname === '/tasks'
					: pathname === path;

				return (
					<button
						key={ path }
						className={ `st-todox-view-switcher__btn${ isActive ? ' st-todox-view-switcher__btn--active' : '' }` }
						title={ label }
						onClick={ () => navigate( path ) }
					>
						<Icon size={ 14 } />
						<span>{ label }</span>
					</button>
				);
			} ) }
		</div>
	);
};

export default ViewSwitcher;
