/**
 * External dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Bell, Sun, Moon } from 'lucide-react';

/**
 * Internal dependencies
 */
import { notificationsApi } from '../../api';
import CreateTaskModal from '../features/task/CreateTaskModal';
import { useWorkspace } from '../../hooks/useWorkspace';

const STORAGE_KEY = 'st-todox-theme';

function getInitialTheme(): 'light' | 'dark' {
	try {
		const saved = localStorage.getItem( STORAGE_KEY );
		if ( saved === 'dark' || saved === 'light' ) return saved;
	} catch {}
	return 'light';
}

function applyTheme( theme: 'light' | 'dark' ) {
	if ( theme === 'dark' ) {
		document.documentElement.classList.add( 'dark' );
	} else {
		document.documentElement.classList.remove( 'dark' );
	}
	try {
		localStorage.setItem( STORAGE_KEY, theme );
	} catch {}
}

const Topbar = () => {
	const navigate = useNavigate();
	const [ search, setSearch ]             = useState( '' );
	const [ searchFocused, setSearchFocused ] = useState( false );
	const [ createTaskOpen, setCreateTaskOpen ] = useState( false );
	const [ theme, setTheme ] = useState< 'light' | 'dark' >( getInitialTheme );
	const { activeWorkspaceId } = useWorkspace();

	// Apply theme on mount and whenever it changes
	useEffect( () => {
		applyTheme( theme );
	}, [ theme ] );

	const toggleTheme = () => {
		setTheme( ( prev ) => ( prev === 'dark' ? 'light' : 'dark' ) );
	};

	const { data: unreadData } = useQuery( {
		queryKey: [ 'notifications', 'unread-count' ],
		queryFn:  notificationsApi.getUnreadCount,
		refetchInterval: 60_000,
	} );

	const handleSearch = ( e: React.FormEvent ) => {
		e.preventDefault();
		if ( search.trim() ) {
			navigate( `/tasks?search=${ encodeURIComponent( search ) }` );
		}
	};

	const unreadCount = unreadData?.count ?? 0;

	return (
		<>
			<header className="st-todox-topbar">
				{/* Search */}
				<form onSubmit={ handleSearch } className="st-todox-topbar__search-form">
					<div className={ `st-todox-topbar__search-wrap ${ searchFocused ? 'st-todox-topbar__search-wrap--focused' : '' }` }>
						<Search size={ 14 } className="st-todox-topbar__search-icon" />
						<input
							type="text"
							value={ search }
							onChange={ ( e ) => setSearch( e.target.value ) }
							onFocus={ () => setSearchFocused( true ) }
							onBlur={ () => setSearchFocused( false ) }
							placeholder="Search tasks…"
							className="st-todox-topbar__search-input"
						/>
						<kbd className="st-todox-topbar__search-kbd">⌘K</kbd>
					</div>
				</form>

				<div className="st-todox-topbar__actions">
					{/* Quick create */}
					<button
						className="st-todox-topbar__create-btn"
						onClick={ () => activeWorkspaceId && setCreateTaskOpen( true ) }
						disabled={ ! activeWorkspaceId }
					>
						<Plus size={ 14 } className="st-todox-topbar__create-plus" />
						<span className="st-todox-topbar__create-label">New Task</span>
					</button>

					{/* Dark mode toggle */}
					<button
						className="st-todox-topbar__icon-btn"
						onClick={ toggleTheme }
						title={ theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }
					>
						{ theme === 'dark' ? (
							<Sun size={ 15 } className="st-todox-topbar__icon" />
						) : (
							<Moon size={ 15 } className="st-todox-topbar__icon" />
						) }
					</button>

					{/* Notifications */}
					<button
						className="st-todox-topbar__icon-btn"
						onClick={ () => navigate( '/notifications' ) }
						title="Notifications"
					>
						<Bell size={ 15 } className="st-todox-topbar__icon" />
						{ unreadCount > 0 && (
							<span className="st-todox-topbar__badge">
								{ unreadCount > 99 ? '99+' : unreadCount }
							</span>
						) }
					</button>

					{/* WP Admin */}
					<a
						href={ stTodoxParams?.adminUrl }
						className="st-todox-topbar__icon-btn"
						title="Back to WP Admin"
					>
						<span className="st-todox-topbar__wp-icon" aria-hidden="true">W</span>
					</a>
				</div>
			</header>

			{ activeWorkspaceId && (
				<CreateTaskModal
					isOpen={ createTaskOpen }
					onClose={ () => setCreateTaskOpen( false ) }
					workspaceId={ activeWorkspaceId }
				/>
			) }
		</>
	);
};

export default Topbar;
