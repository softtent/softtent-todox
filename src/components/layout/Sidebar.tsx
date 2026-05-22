/**
 * External dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { useSelect, useDispatch } from '@wordpress/data';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
	LayoutDashboard,
	Building2,
	Briefcase,
	FolderKanban,
	Zap,
	CheckSquare,
	Kanban,
	Bell,
	Settings,
	ChevronRight,
	Users,
	Clock,
	DollarSign,
	Calendar,
	BarChart3,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { STORE_NAME } from '../../store/workspace';
import { useWorkspace } from '../../hooks/useWorkspace';
import WorkspaceSwitcher from '../features/workspace/WorkspaceSwitcher';
import Avatar from '../ui/Avatar';

interface NavChild {
	path:  string;
	label: string;
	icon:  React.ComponentType<{ size?: number; className?: string }>;
	soon?: boolean;
}

interface NavItem {
	path:      string;
	label:     string;
	icon:      React.ComponentType<{ size?: number; className?: string }>;
	soon?:     boolean;
	children?: NavChild[];
}

interface NavGroup {
	label: string;
	items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
	{
		label: 'Main',
		items: [
			{ path: '/', label: 'Dashboard', icon: LayoutDashboard },
		],
	},
	{
		label: 'Work',
		items: [
			{ path: '/departments', label: 'Departments', icon: Building2 },
			{ path: '/teams',       label: 'Teams',        icon: Briefcase },
			{ path: '/projects',    label: 'Projects',     icon: FolderKanban },
			{ path: '/sprints',     label: 'Sprints',      icon: Zap },
			{
				path:     '/tasks',
				label:    'Tasks',
				icon:     CheckSquare,
				children: [
					{ path: '/tasks',        label: 'All Tasks',    icon: CheckSquare },
					{ path: '/tasks/kanban', label: 'Kanban Board', icon: Kanban },
				],
			},
		],
	},
	// {
	// 	label: 'Insights',
	// 	items: [
	// 		{ path: '/reports', label: 'Reports', icon: BarChart3, soon: true },
	// 	],
	// },
	{
		label: 'General',
		items: [
			// { path: '/notifications', label: 'Notifications', icon: Bell },
			{ path: '/settings',      label: 'Settings',      icon: Settings },
		],
	},
];

const Sidebar = () => {
	const location = useLocation();
	const navigate  = useNavigate();

	const sidebarOpen = useSelect(
		( select: any ) => select( STORE_NAME ).isSidebarOpen(),
		[]
	) as boolean;

	const { toggleSidebar } = useDispatch( STORE_NAME );

	const [ expanded, setExpanded ] = useState< Record< string, boolean > >( {
		'/tasks': location.pathname.startsWith( '/tasks' ),
	} );

	// Keep submenu open whenever route matches
	useEffect( () => {
		if ( location.pathname.startsWith( '/tasks' ) ) {
			setExpanded( ( prev ) => ( { ...prev, '/tasks': true } ) );
		}
	}, [ location.pathname ] );

	const isActive = ( path: string ) => {
		if ( path === '/' ) return location.pathname === '/';
		if ( path === '/tasks' ) return location.pathname === '/tasks' || ( location.pathname.startsWith( '/tasks' ) && location.pathname !== '/tasks/kanban' );
		return location.pathname === path || location.pathname.startsWith( path + '/' );
	};

	const toggleExpand = ( path: string ) =>
		setExpanded( ( prev ) => ( { ...prev, [ path ]: ! prev[ path ] } ) );

	const collapsed = ! sidebarOpen;

	return (
		<aside className={ `st-todox-sidebar ${ collapsed ? 'st-todox-sidebar--collapsed' : 'st-todox-sidebar--expanded' }` }>

			{/* Floating toggle button */}
			<button
				className="st-todox-sidebar__float-toggle"
				onClick={ () => toggleSidebar() }
				title={ collapsed ? 'Expand sidebar' : 'Collapse sidebar' }
			>
				<ChevronRight
					size={ 14 }
					style={ { transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform 200ms ease' } }
				/>
			</button>

			{/* Brand */}
			<div className="st-todox-sidebar__brand">
				{ ! collapsed && (
					<div className="st-todox-sidebar__logo-wrap">
						<div className="st-todox-sidebar__logo-icon">TX</div>
						<span className="st-todox-sidebar__logo-text">TodoX</span>
					</div>
				) }
			</div>

			{/* Workspace Switcher */}
			<div className="st-todox-sidebar__workspace">
				<WorkspaceSwitcher collapsed={ collapsed } />
			</div>

			{/* Navigation */}
			<nav className="st-todox-sidebar__nav">
				{ NAV_GROUPS.map( ( group ) => (
					<div key={ group.label } className="st-todox-sidebar__nav-group">
						{ ! collapsed && (
							<span className="st-todox-sidebar__nav-group-label">{ group.label }</span>
						) }

						{ group.items.map( ( item ) => {
							const active      = isActive( item.path );
							const hasChildren = !! item.children;
							const isExpanded  = expanded[ item.path ];
							const Icon        = item.icon;

							return (
								<div key={ item.path }>
									{ hasChildren ? (
										<button
											className={ `st-todox-sidebar__nav-item ${ active ? 'st-todox-sidebar__nav-item--active' : '' }` }
											onClick={ () => { navigate( item.path ); if ( ! collapsed ) setExpanded( ( prev ) => ( { ...prev, [ item.path ]: true } ) ); } }
											title={ collapsed ? item.label : undefined }
										>
											<span className="st-todox-sidebar__nav-icon">
												<Icon size={ 16 } />
											</span>
											{ ! collapsed && (
												<>
													<span className="st-todox-sidebar__nav-label">{ item.label }</span>
													<ChevronRight
														size={ 13 }
														className={ `st-todox-sidebar__nav-chevron ${ isExpanded ? 'st-todox-sidebar__nav-chevron--open' : '' }` }
													/>
												</>
											) }
										</button>
									) : (
										<NavLink
											to={ item.soon ? '#' : item.path }
											end={ item.path === '/' }
											className={ ( { isActive: a } ) =>
												`st-todox-sidebar__nav-item ${ ( a && ! item.soon ) ? 'st-todox-sidebar__nav-item--active' : '' } ${ item.soon ? 'st-todox-sidebar__nav-item--soon' : '' }`
											}
											title={ collapsed ? item.label : undefined }
											onClick={ item.soon ? ( e ) => e.preventDefault() : undefined }
										>
											<span className="st-todox-sidebar__nav-icon">
												<Icon size={ 16 } />
											</span>
											{ ! collapsed && (
												<>
													<span className="st-todox-sidebar__nav-label">{ item.label }</span>
													{ item.soon && <span className="st-todox-sidebar__soon-badge">Soon</span> }
												</>
											) }
										</NavLink>
									) }

									{ hasChildren && isExpanded && ! collapsed && (
										<div className="st-todox-sidebar__sub-nav">
											{ item.children!.map( ( child ) => {
												const ChildIcon = child.icon;
												return (
													<NavLink
														key={ child.path }
														to={ child.path }
														end={ child.path === '/tasks' }
														className={ ( { isActive: a } ) =>
															`st-todox-sidebar__sub-item ${ a ? 'st-todox-sidebar__sub-item--active' : '' }`
														}
													>
														<ChildIcon size={ 13 } />
														{ child.label }
													</NavLink>
												);
											} ) }
										</div>
									) }
								</div>
							);
						} ) }
					</div>
				) ) }
			</nav>

			{/* User profile */}
			{ ! collapsed && (
				<div className="st-todox-sidebar__user">
					<div className="st-todox-sidebar__user-info">
						<Avatar
							name={ stTodoxParams?.currentUser?.name ?? 'User' }
							src={ stTodoxParams?.currentUser?.avatar ?? null }
							size={ 30 }
						/>
						<div className="st-todox-sidebar__user-text">
							<span className="st-todox-sidebar__user-name">{ stTodoxParams?.currentUser?.name }</span>
							<span className="st-todox-sidebar__user-role">
								{ ( stTodoxParams?.currentUser?.roles ?? [] )[ 0 ] ?? 'User' }
							</span>
						</div>
					</div>
				</div>
			) }
		</aside>
	);
};

export default Sidebar;
