/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Briefcase, Users, FolderKanban, Crown, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react';

/**
 * Internal dependencies
 */
import { teamsApi, departmentsApi, usersApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import type { Team, TeamMember, CreateTeamInput } from '../../types';

const COLORS = [ '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6' ];

const emptyForm = (): CreateTeamInput => ( {
	workspace_id:  0,
	department_id: 0,
	name:          '',
	description:   '',
	color:         '#6366f1',
	manager_id:    null,
} );

const TeamsPage = () => {
	const qc = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();

	const [ modalOpen, setModalOpen ]             = useState( false );
	const [ memberModalOpen, setMemberModalOpen ] = useState( false );
	const [ editing, setEditing ]                 = useState< Team | null >( null );
	const [ selectedTeam, setSelectedTeam ]       = useState< Team | null >( null );
	const [ deleteTarget, setDeleteTarget ]       = useState< Team | null >( null );
	const [ menuOpen, setMenuOpen ]               = useState< number | null >( null );
	const [ form, setForm ]                       = useState< CreateTeamInput >( emptyForm() );
	const [ addUserId, setAddUserId ]             = useState( '' );
	const [ addUserRole, setAddUserRole ]         = useState< 'lead' | 'member' >( 'member' );

	const { data: teams = [], isLoading } = useQuery( {
		queryKey: [ 'teams', activeWorkspaceId ],
		queryFn:  () => teamsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const { data: departments = [] } = useQuery( {
		queryKey: [ 'departments', activeWorkspaceId ],
		queryFn:  () => departmentsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'all' ],
		queryFn:  () => usersApi.getAll( { per_page: 100 } ),
		staleTime: 5 * 60_000,
	} );
	const users = usersData?.items ?? [];

	const { data: teamMembers = [] } = useQuery( {
		queryKey: [ 'teams', selectedTeam?.id, 'members' ],
		queryFn:  () => teamsApi.getMembers( selectedTeam!.id ),
		enabled:  !! selectedTeam,
	} );

	const invalidate = () => qc.invalidateQueries( { queryKey: [ 'teams', activeWorkspaceId ] } );

	const createMutation = useMutation( {
		mutationFn: ( data: CreateTeamInput ) => teamsApi.create( data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Team created.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateTeamInput > } ) =>
			teamsApi.update( id, data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Team updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => teamsApi.delete( id ),
		onSuccess:  () => { invalidate(); setDeleteTarget( null ); toast.success( 'Team deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const addMemberMutation = useMutation( {
		mutationFn: () => teamsApi.addMember( selectedTeam!.id, Number( addUserId ), addUserRole ),
		onSuccess:  () => {
			qc.invalidateQueries( { queryKey: [ 'teams', selectedTeam!.id, 'members' ] } );
			setAddUserId( '' );
			toast.success( 'Member added.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const removeMemberMutation = useMutation( {
		mutationFn: ( userId: number ) => teamsApi.removeMember( selectedTeam!.id, userId ),
		onSuccess:  () => qc.invalidateQueries( { queryKey: [ 'teams', selectedTeam!.id, 'members' ] } ),
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const openCreate = () => {
		setEditing( null );
		setForm( { ...emptyForm(), workspace_id: activeWorkspaceId! } );
		setModalOpen( true );
	};

	const openEdit = ( team: Team ) => {
		setEditing( team );
		setForm( {
			workspace_id:  team.workspace_id,
			department_id: team.department_id,
			name:          team.name,
			description:   team.description ?? '',
			color:         team.color,
			manager_id:    team.manager_id,
		} );
		setMenuOpen( null );
		setModalOpen( true );
	};

	const handleClose = () => { setModalOpen( false ); setEditing( null ); setForm( emptyForm() ); };

	const doSubmit = () => {
		if ( ! form.name.trim() ) { toast.error( 'Name is required.' ); return; }
		if ( ! form.department_id ) { toast.error( 'Department is required.' ); return; }
		if ( editing ) {
			updateMutation.mutate( { id: editing.id, data: form } );
		} else {
			createMutation.mutate( { ...form, workspace_id: activeWorkspaceId! } );
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<div className="st-todox-page">
			{/* Page Header */}
			<div className="st-todox-page-hd">
				<div className="st-todox-page-hd__left">
					<div className="st-todox-page-hd__icon-box">
						<Briefcase size={ 20 } />
					</div>
					<div>
						<h1 className="st-todox-page-hd__title">Teams</h1>
						<p className="st-todox-page-hd__sub">
							{ activeWorkspace?.name } · { teams.length } team{ teams.length !== 1 ? 's' : '' }
						</p>
					</div>
				</div>
				{ activeWorkspaceId && (
					<Button onClick={ openCreate }><Plus size={ 14 } /> New Team</Button>
				) }
			</div>

			{ isLoading ? (
				<Spinner />
			) : teams.length === 0 ? (
				<div className="st-todox-empty-dashed">
					<Briefcase size={ 40 } className="st-todox-empty-dashed__icon" />
					<p className="st-todox-empty-dashed__title">No teams yet</p>
					<p className="st-todox-empty-dashed__desc">Create your first team to get started.</p>
					{ activeWorkspaceId && (
						<Button onClick={ openCreate } className="st-todox-empty-dashed__action">New Team</Button>
					) }
				</div>
			) : (
				<div className="st-todox-entity-grid">
					{ teams.map( ( team: Team ) => (
						<div key={ team.id } className="st-todox-entity-card" style={ { borderTopColor: team.color, borderTopWidth: '3px' } }>
							<div className="st-todox-entity-card__body">
								{/* Head row */}
								<div className="st-todox-entity-card__head-row">
									<div className="st-todox-entity-card__avatar" style={ { background: team.color } }>
										{ team.name.slice( 0, 1 ).toUpperCase() }
									</div>
									<div className="st-todox-entity-card__meta">
										<h3 className="st-todox-entity-card__name">{ team.name }</h3>
										{ team.department?.name && (
											<p className="st-todox-entity-card__desc">{ team.department.name }</p>
										) }
									</div>
									{/* Actions */}
									<div className="st-todox-entity-card__menu-wrap">
										<button
											className="st-todox-entity-card__menu-btn"
											onClick={ ( e ) => { e.stopPropagation(); setMenuOpen( menuOpen === team.id ? null : team.id ); } }
										>
											<MoreHorizontal size={ 15 } />
										</button>
										{ menuOpen === team.id && (
											<>
												<div className="st-todox-dropdown-backdrop" onClick={ () => setMenuOpen( null ) } />
												<div className="st-todox-entity-card__menu-dropdown">
													<button onClick={ () => openEdit( team ) }>
														<Pencil size={ 13 } /> Edit
													</button>
													<button
														onClick={ () => { setSelectedTeam( team ); setMemberModalOpen( true ); setMenuOpen( null ); } }
													>
														<Users size={ 13 } /> Members
													</button>
													<button
														className="st-todox-entity-card__menu-danger"
														onClick={ () => { setDeleteTarget( team ); setMenuOpen( null ); } }
													>
														<Trash2 size={ 13 } /> Delete
													</button>
											</div>
											</>
										) }
									</div>
								</div>

								{/* Stats */}
								<div className="st-todox-entity-card__stats">
									<span>
										<Users size={ 13 } />
										<strong>{ team.members_count ?? 0 }</strong> member{ ( team.members_count ?? 0 ) !== 1 ? 's' : '' }
									</span>
									<span>
										<FolderKanban size={ 13 } />
										<strong>{ team.projects_count ?? 0 }</strong> project{ ( team.projects_count ?? 0 ) !== 1 ? 's' : '' }
									</span>
								</div>

								{/* Members preview */}
								{ team.members && team.members.length > 0 && (
									<div className="st-todox-entity-card__members">
										{ team.members.slice( 0, 4 ).map( ( m: TeamMember ) => (
											<div key={ m.id } className="st-todox-entity-card__member-row">
												<Avatar name={ m.name } src={ m.avatar } size={ 24 } />
												<span className="st-todox-entity-card__member-name">{ m.name }</span>
												{ m.team_role === 'lead' && (
													<span className="st-todox-entity-card__badge st-todox-entity-card__badge--lead">
														<Crown size={ 10 } /> LEAD
													</span>
												) }
											</div>
										) ) }
										{ ( team.members_count ?? 0 ) > 4 && (
											<p className="st-todox-entity-card__more">+{ ( team.members_count ?? 0 ) - 4 } more members</p>
										) }
									</div>
								) }

								{/* Footer — manager */}
								{ team.manager && (
									<div className="st-todox-entity-card__footer">
										<Avatar name={ team.manager.name } src={ team.manager.avatar } size={ 18 } />
										<span className="st-todox-entity-card__footer-label">{ team.manager.name }</span>
									</div>
								) }

								{/* Manage members button */}
								<div className="st-todox-entity-card__action-row">
									<button
										className="st-todox-entity-card__text-btn"
										onClick={ () => { setSelectedTeam( team ); setMemberModalOpen( true ); } }
									>
										<Users size={ 12 } /> Manage Members
									</button>
								</div>
							</div>
						</div>
					) ) }
				</div>
			) }

			{/* Create / Edit Modal */}
			<Modal
				isOpen={ modalOpen }
				onClose={ handleClose }
				title={ editing ? 'Edit Team' : 'New Team' }
				size="sm"
				footer={
					<>
						<Button variant="secondary" onClick={ handleClose } disabled={ isPending }>Cancel</Button>
						<Button onClick={ doSubmit } loading={ isPending }>
							{ editing ? 'Save Changes' : 'Create' }
						</Button>
					</>
				}
			>
				<form onSubmit={ ( e ) => { e.preventDefault(); doSubmit(); } } className="st-todox-form">
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Name <span className="st-todox-form__required">*</span></label>
						<input type="text" className="st-todox-form__input" placeholder="Team name"
							value={ form.name } onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) } autoFocus />
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Department <span className="st-todox-form__required">*</span></label>
						<select className="st-todox-form__select"
							value={ form.department_id || '' }
							onChange={ ( e ) => setForm( { ...form, department_id: Number( e.target.value ) } ) }
						>
							<option value="">— Select department —</option>
							{ departments.map( ( d ) => <option key={ d.id } value={ d.id }>{ d.name }</option> ) }
						</select>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Manager</label>
						<select className="st-todox-form__select"
							value={ form.manager_id ?? '' }
							onChange={ ( e ) => setForm( { ...form, manager_id: e.target.value ? Number( e.target.value ) : null } ) }
						>
							<option value="">— None —</option>
							{ users.map( ( u ) => <option key={ u.id } value={ u.id }>{ u.name }</option> ) }
						</select>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Description</label>
						<textarea className="st-todox-form__textarea" rows={ 2 } placeholder="Optional"
							value={ form.description ?? '' } onChange={ ( e ) => setForm( { ...form, description: e.target.value } ) } />
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Color</label>
						<div className="st-todox-color-picker">
							{ COLORS.map( ( c ) => (
								<button key={ c } type="button"
									className={ `st-todox-color-picker__swatch ${ form.color === c ? 'st-todox-color-picker__swatch--active' : '' }` }
									style={ { background: c } } onClick={ () => setForm( { ...form, color: c } ) } />
							) ) }
						</div>
					</div>
				</form>
			</Modal>

			{/* Members Modal */}
			<Modal
				isOpen={ memberModalOpen }
				onClose={ () => { setMemberModalOpen( false ); setSelectedTeam( null ); } }
				title={ `${ selectedTeam?.name } — Members` }
				size="md"
			>
				<div className="st-todox-member-list">
					{ ( teamMembers as TeamMember[] ).map( ( m ) => (
						<div key={ m.id } className="st-todox-member-row">
							<Avatar name={ m.name } src={ m.avatar } size={ 32 } />
							<div className="st-todox-member-row__info">
								<span className="st-todox-member-row__name">{ m.name }</span>
								<span className="st-todox-member-row__role">{ m.team_role }</span>
							</div>
							<button className="st-todox-member-row__remove" onClick={ () => removeMemberMutation.mutate( m.id ) } title="Remove">
								<Trash2 size={ 13 } />
							</button>
						</div>
					) ) }
					{ teamMembers.length === 0 && <p className="st-todox-text--muted">No members yet.</p> }
				</div>
				<div className="st-todox-member-add">
					<h4 className="st-todox-member-add__title">Add Member</h4>
					<div className="st-todox-form__row">
						<select className="st-todox-form__select" value={ addUserId } onChange={ ( e ) => setAddUserId( e.target.value ) }>
							<option value="">— Select user —</option>
							{ users.filter( ( u ) => ! ( teamMembers as TeamMember[] ).find( ( m ) => m.id === u.id ) )
								.map( ( u ) => <option key={ u.id } value={ u.id }>{ u.name }</option> ) }
						</select>
						<select className="st-todox-form__select" value={ addUserRole } onChange={ ( e ) => setAddUserRole( e.target.value as 'lead' | 'member' ) }>
							<option value="member">Member</option>
							<option value="lead">Lead</option>
						</select>
						<Button size="sm" onClick={ () => addUserId && addMemberMutation.mutate() }
							loading={ addMemberMutation.isPending } disabled={ ! addUserId }>Add</Button>
					</div>
				</div>
			</Modal>

			<ConfirmDialog
				isOpen={ !! deleteTarget }
				onClose={ () => setDeleteTarget( null ) }
				onConfirm={ () => deleteTarget && deleteMutation.mutate( deleteTarget.id ) }
				title="Delete Team"
				message={ `Delete "${ deleteTarget?.name }"? This cannot be undone.` }
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
			/>
		</div>
	);
};

export default TeamsPage;
