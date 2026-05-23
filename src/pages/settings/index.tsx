/**
 * External dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	User,
	Settings2,
	Bell,
	Database,
	ShieldAlert,
	CheckCircle2,
	AlertTriangle,
	ChevronRight,
	Tag,
	Bookmark,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { api } from '../../utils/api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import StatusesSection from './StatusesSection';
import LabelsSection from './LabelsSection';

type Section = 'profile' | 'general' | 'statuses' | 'labels' | 'notifications' | 'data';

interface Settings {
	tasks_per_page?: number;
	default_priority?: string;
	email_notifications?: boolean;
	keep_data_on_uninstall?: boolean;
	[ key: string ]: unknown;
}

const NAV_ITEMS: { id: Section; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
	{ id: 'profile',       label: 'Profile',          icon: User },
	{ id: 'general',       label: 'General',           icon: Settings2 },
	{ id: 'statuses',      label: 'Statuses',          icon: Tag },
	{ id: 'labels',        label: 'Labels',            icon: Bookmark },
	{ id: 'notifications', label: 'Notifications',     icon: Bell },
	{ id: 'data',          label: 'Data & Privacy',    icon: Database },
];

const ROLE_STYLES: Record<string, { label: string; className: string }> = {
	administrator:   { label: 'Administrator',   className: 'st-todox-settings__role-badge--admin' },
	editor:          { label: 'Editor',          className: 'st-todox-settings__role-badge--editor' },
	author:          { label: 'Author',          className: 'st-todox-settings__role-badge--author' },
	contributor:     { label: 'Contributor',     className: 'st-todox-settings__role-badge--default' },
	subscriber:      { label: 'Subscriber',      className: 'st-todox-settings__role-badge--default' },
};

/* ---- Section Card shell ---- */
const Card = ( {
	icon: Icon,
	title,
	description,
	children,
}: {
	icon?: React.ComponentType<{ size?: number; className?: string }>;
	title: string;
	description?: string;
	children: React.ReactNode;
} ) => (
	<div className="st-todox-settings-card">
		<div className="st-todox-settings-card__head">
			{ Icon && (
				<div className="st-todox-settings-card__icon-box">
					<Icon size={ 15 } />
				</div>
			) }
			<div>
				<h2 className="st-todox-settings-card__title">{ title }</h2>
				{ description && <p className="st-todox-settings-card__desc">{ description }</p> }
			</div>
		</div>
		<div className="st-todox-settings-card__body">{ children }</div>
	</div>
);

/* ---- Toggle row ---- */
const ToggleRow = ( {
	label,
	hint,
	checked,
	onChange,
}: {
	label: string;
	hint?: string;
	checked: boolean;
	onChange: ( v: boolean ) => void;
} ) => (
	<label className="st-todox-settings-toggle">
		<div className="st-todox-settings-toggle__text">
			<span className="st-todox-settings-toggle__label">{ label }</span>
			{ hint && <span className="st-todox-settings-toggle__hint">{ hint }</span> }
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={ checked }
			className={ `st-todox-settings-switch ${ checked ? 'st-todox-settings-switch--on' : '' }` }
			onClick={ () => onChange( ! checked ) }
		>
			<span className="st-todox-settings-switch__thumb" />
		</button>
	</label>
);

/* ---- Main ---- */
const SettingsPage = () => {
	const [ activeSection, setActiveSection ] = useState<Section>( 'profile' );
	const [ form, setForm ]                   = useState<Settings>( {} );

	const { data: settings, isLoading } = useQuery<Settings>( {
		queryKey: [ 'settings' ],
		queryFn:  () => api.get<Settings>( 'settings' ),
	} );

	useEffect( () => {
		if ( settings ) setForm( settings );
	}, [ settings ] );

	const saveMutation = useMutation( {
		mutationFn: ( data: Settings ) => api.put( 'settings', data ),
		onSuccess:  () => toast.success( 'Settings saved.' ),
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const set = ( key: keyof Settings, value: unknown ) =>
		setForm( ( prev ) => ( { ...prev, [ key ]: value } ) );

	const handleSave = () => saveMutation.mutate( form );

	const { activeWorkspaceId } = useWorkspace();

	const userName  = stTodoxParams?.currentUser?.name ?? 'User';
	const userEmail = stTodoxParams?.currentUser?.email ?? '';
	const userRole  = ( stTodoxParams?.currentUser?.roles ?? [] )[ 0 ] ?? 'subscriber';
	const roleConfig = ROLE_STYLES[ userRole ] ?? ROLE_STYLES.subscriber;

	if ( isLoading ) return <Spinner fullscreen />;

	return (
		<div className="st-todox-page">
			{/* Page header */}
			<div className="st-todox-settings-page-head">
				<div>
					<h1 className="st-todox-settings-page-head__title">Settings</h1>
					<p className="st-todox-settings-page-head__desc">Manage your account and workspace preferences.</p>
				</div>
			</div>

			<div className="st-todox-settings-layout">
				{/* Left nav */}
				<aside className="st-todox-settings-sidenav">
					{ NAV_ITEMS.map( ( item ) => {
						const Icon   = item.icon;
						const active = activeSection === item.id;
						return (
							<button
								key={ item.id }
								className={ `st-todox-settings-sidenav__item ${ active ? 'st-todox-settings-sidenav__item--active' : '' }` }
								onClick={ () => setActiveSection( item.id ) }
							>
								<Icon size={ 15 } className="st-todox-settings-sidenav__icon" />
								<span>{ item.label }</span>
								{ active && <ChevronRight size={ 12 } className="st-todox-settings-sidenav__chevron" /> }
							</button>
						);
					} ) }
				</aside>

				{/* Content */}
				<div className="st-todox-settings-content">

					{ activeSection === 'profile' && (
						<div className="st-todox-settings-stack">
							{/* Identity card */}
							<div className="st-todox-settings-card st-todox-settings-card--profile">
								<div className="st-todox-settings-profile">
									<Avatar
										name={ userName }
										src={ stTodoxParams?.currentUser?.avatar ?? null }
										size={ 64 }
									/>
									<div className="st-todox-settings-profile__info">
										<p className="st-todox-settings-profile__name">{ userName }</p>
										{ userEmail && (
											<p className="st-todox-settings-profile__email">{ userEmail }</p>
										) }
										<div className="st-todox-settings-profile__badges">
											<span className={ `st-todox-settings__role-badge ${ roleConfig.className }` }>
												{ roleConfig.label }
											</span>
										</div>
									</div>
									<a
										href="/wp-admin/profile.php"
										className="st-todox-settings-profile__edit-link"
										target="_blank"
										rel="noreferrer"
									>
										Edit in WordPress
										<ChevronRight size={ 12 } />
									</a>
								</div>
							</div>

							{/* Account info */}
							<Card
								icon={ User }
								title="Account Information"
								description="Your WordPress user account details."
							>
								<div className="st-todox-settings-info-grid">
									<div className="st-todox-settings-info-row">
										<span className="st-todox-settings-info-row__label">Display Name</span>
										<span className="st-todox-settings-info-row__value">{ userName }</span>
									</div>
									{ userEmail && (
										<div className="st-todox-settings-info-row">
											<span className="st-todox-settings-info-row__label">Email</span>
											<span className="st-todox-settings-info-row__value">{ userEmail }</span>
										</div>
									) }
									<div className="st-todox-settings-info-row">
										<span className="st-todox-settings-info-row__label">Role</span>
										<span className="st-todox-settings-info-row__value">
											<span className={ `st-todox-settings__role-badge ${ roleConfig.className }` }>
												{ roleConfig.label }
											</span>
										</span>
									</div>
								</div>
								<p className="st-todox-settings-info-note">
									To change your name, email or password, visit your{' '}
									<a href="/wp-admin/profile.php" target="_blank" rel="noreferrer">WordPress profile</a>.
								</p>
							</Card>
						</div>
					) }

					{ activeSection === 'general' && (
						<div className="st-todox-settings-stack">
							<Card
								icon={ CheckCircle2 }
								title="Task Defaults"
								description="Default values applied when creating new tasks."
							>
								<div className="st-todox-settings-form">
									<div className="st-todox-settings-field">
										<label className="st-todox-settings-field__label">Tasks Per Page</label>
										<input
											type="number"
											className="st-todox-form__input st-todox-form__input--sm"
											min={ 5 }
											max={ 100 }
											value={ ( form.tasks_per_page ?? 25 ) as number }
											onChange={ ( e ) => set( 'tasks_per_page', parseInt( e.target.value, 10 ) ) }
										/>
										<p className="st-todox-settings-field__hint">Number of tasks shown in list view per page.</p>
									</div>

									<div className="st-todox-settings-field">
										<label className="st-todox-settings-field__label">Default Priority</label>
										<select
											className="st-todox-form__select st-todox-form__select--inline"
											value={ ( form.default_priority ?? 'medium' ) as string }
											onChange={ ( e ) => set( 'default_priority', e.target.value ) }
										>
											<option value="low">Low</option>
											<option value="medium">Medium</option>
											<option value="high">High</option>
											<option value="urgent">Urgent</option>
										</select>
										<p className="st-todox-settings-field__hint">Pre-selected priority when opening the new task form.</p>
									</div>
								</div>
							</Card>

							<div className="st-todox-settings-save-row">
								<Button onClick={ handleSave } loading={ saveMutation.isPending }>
									Save Changes
								</Button>
							</div>
						</div>
					) }

					{ activeSection === 'statuses' && activeWorkspaceId && (
						<StatusesSection workspaceId={ activeWorkspaceId } />
					) }

					{ activeSection === 'statuses' && ! activeWorkspaceId && (
						<div className="st-todox-settings-stack">
							<div className="st-todox-settings-info-banner st-todox-settings-info-banner--blue">
								<Tag size={ 14 } className="st-todox-settings-info-banner__icon" />
								<p>Please select or create a workspace first to manage statuses.</p>
							</div>
						</div>
					) }

					{ activeSection === 'labels' && activeWorkspaceId && (
						<LabelsSection workspaceId={ activeWorkspaceId } />
					) }

					{ activeSection === 'labels' && ! activeWorkspaceId && (
						<div className="st-todox-settings-stack">
							<div className="st-todox-settings-info-banner st-todox-settings-info-banner--blue">
								<Bookmark size={ 14 } className="st-todox-settings-info-banner__icon" />
								<p>Please select or create a workspace first to manage labels.</p>
							</div>
						</div>
					) }

					{ activeSection === 'notifications' && (
						<div className="st-todox-settings-stack">
							<Card
								icon={ Bell }
								title="Email Notifications"
								description="Control when you receive email alerts from the plugin."
							>
								<div className="st-todox-settings-toggles">
									<ToggleRow
										label="Enable email notifications"
										hint="Send email alerts for task assignments, mentions, and due-date reminders."
										checked={ !! form.email_notifications }
										onChange={ ( v ) => set( 'email_notifications', v ) }
									/>
								</div>
							</Card>

							<div className="st-todox-settings-info-banner st-todox-settings-info-banner--blue">
								<Bell size={ 14 } className="st-todox-settings-info-banner__icon" />
								<p>Notifications are sent to each user's WordPress registered email address.</p>
							</div>

							<div className="st-todox-settings-save-row">
								<Button onClick={ handleSave } loading={ saveMutation.isPending }>
									Save Changes
								</Button>
							</div>
						</div>
					) }

					{ activeSection === 'data' && (
						<div className="st-todox-settings-stack">
							<Card
								icon={ Database }
								title="Data Retention"
								description="Control what happens to your data when the plugin is removed."
							>
								<div className="st-todox-settings-toggles">
									<ToggleRow
										label="Keep data on uninstall"
										hint="When enabled, all plugin tables and options are preserved if you uninstall the plugin."
										checked={ !! form.keep_data_on_uninstall }
										onChange={ ( v ) => set( 'keep_data_on_uninstall', v ) }
									/>
								</div>
							</Card>

							{/* Warning banner */}
							<div className="st-todox-settings-info-banner st-todox-settings-info-banner--amber">
								<AlertTriangle size={ 14 } className="st-todox-settings-info-banner__icon" />
								<div>
									<p className="st-todox-settings-info-banner__title">Danger Zone</p>
									<p>To permanently delete all plugin data, uninstall with "Keep data on uninstall" turned <strong>off</strong>. This cannot be undone.</p>
								</div>
							</div>

							{/* Danger zone card */}
							<div className="st-todox-settings-card st-todox-settings-card--danger">
								<div className="st-todox-settings-card__head">
									<div className="st-todox-settings-card__icon-box st-todox-settings-card__icon-box--danger">
										<ShieldAlert size={ 15 } />
									</div>
									<div>
										<h2 className="st-todox-settings-card__title st-todox-settings-card__title--danger">Delete All Data</h2>
										<p className="st-todox-settings-card__desc">Permanently remove all workspaces, tasks, and settings.</p>
									</div>
								</div>
								<div className="st-todox-settings-card__body">
									<p className="st-todox-settings-danger-note">
										Uninstall the plugin from the{' '}
										<a href="/wp-admin/plugins.php" target="_blank" rel="noreferrer">Plugins page</a>
										{' '}with the toggle above turned <strong>off</strong> to trigger a full data wipe.
									</p>
								</div>
							</div>

							<div className="st-todox-settings-save-row">
								<Button onClick={ handleSave } loading={ saveMutation.isPending }>
									Save Changes
								</Button>
							</div>
						</div>
					) }
				</div>
			</div>
		</div>
	);
};

export default SettingsPage;
