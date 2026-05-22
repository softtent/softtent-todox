/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	Building2, Users, Crown, MoreHorizontal, Pencil, Trash2,
	CheckCircle2, UserPlus, Plus, Check,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { workspacesApi, usersApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import type { Workspace, WorkspaceMember, CreateWorkspaceInput, WorkspaceRole } from '../../types';

const COLORS = [ '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4' ];

const ROLE_CONFIG: Record< WorkspaceRole, { label: string; className: string } > = {
	owner:  { label: 'Owner',  className: 'st-todox-role-badge st-todox-role-badge--owner' },
	admin:  { label: 'Admin',  className: 'st-todox-role-badge st-todox-role-badge--admin' },
	member: { label: 'Member', className: 'st-todox-role-badge st-todox-role-badge--member' },
	guest:  { label: 'Guest',  className: 'st-todox-role-badge st-todox-role-badge--guest' },
};

const canManage = ( role?: WorkspaceRole ) => role === 'owner' || role === 'admin';

const WorkspacesPage = () => {
	const qc = useQueryClient();
	const { activeWorkspaceId, switchWorkspace } = useWorkspace();

	const currentUserId = ( window as any ).stTodoxParams?.currentUser?.id ?? 0;

	// ── Modals state ──
	const [ createOpen, setCreateOpen ]       = useState( false );
	const [ editTarget, setEditTarget ]       = useState< Workspace | null >( null );
	const [ deleteTarget, setDeleteTarget ]   = useState< Workspace | null >( null );
	const [ inviteTarget, setInviteTarget ]   = useState< Workspace | null >( null );
	const [ menuOpen, setMenuOpen ]           = useState< number | null >( null );

	// ── Forms ──
	const [ createForm, setCreateForm ] = useState< CreateWorkspaceInput >( { name: '', color: '#6366f1' } );
	const [ editForm, setEditForm ]     = useState< Partial< CreateWorkspaceInput > >( {} );
	const [ inviteUserId, setInviteUserId ] = useState( '' );
	const [ inviteRole, setInviteRole ]     = useState< WorkspaceRole >( 'member' );

	// ── Data ──
	const { data: workspaces = [], isLoading } = useQuery( {
		queryKey: [ 'workspaces' ],
		queryFn:  workspacesApi.getAll,
	} );

	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'all' ],
		queryFn:  () => usersApi.getAll( { per_page: 100 } ),
		staleTime: 5 * 60_000,
	} );
	const allUsers = usersData?.items ?? [];

	const invalidate = () => qc.invalidateQueries( { queryKey: [ 'workspaces' ] } );

	// ── Mutations ──
	const createMutation = useMutation( {
		mutationFn: workspacesApi.create,
		onSuccess: ( ws ) => {
			invalidate();
			switchWorkspace( ws );
			setCreateOpen( false );
			setCreateForm( { name: '', color: '#6366f1' } );
			toast.success( 'Workspace created!' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateWorkspaceInput > } ) =>
			workspacesApi.update( id, data ),
		onSuccess: () => { invalidate(); setEditTarget( null ); toast.success( 'Workspace updated.' ); },
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => workspacesApi.delete( id ),
		onSuccess: () => { invalidate(); setDeleteTarget( null ); toast.success( 'Workspace deleted.' ); },
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const inviteMutation = useMutation( {
		mutationFn: ( { id, userId, role }: { id: number; userId: number; role: WorkspaceRole } ) =>
			workspacesApi.addMember( id, userId, role ),
		onSuccess: () => {
			invalidate();
			setInviteUserId( '' );
			setInviteRole( 'member' );
			toast.success( 'Member added.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const removeMemberMutation = useMutation( {
		mutationFn: ( { wsId, userId }: { wsId: number; userId: number } ) =>
			workspacesApi.removeMember( wsId, userId ),
		onSuccess: () => { invalidate(); toast.success( 'Member removed.' ); },
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	// ── Handlers ──
	const openEdit = ( ws: Workspace ) => {
		setEditTarget( ws );
		setEditForm( { name: ws.name, description: ws.description ?? '', color: ws.color } );
		setMenuOpen( null );
	};

	const openInvite = ( ws: Workspace ) => {
		setInviteTarget( ws );
		setInviteUserId( '' );
		setInviteRole( 'member' );
		setMenuOpen( null );
	};

	const doInvite = () => {
		if ( ! inviteUserId || ! inviteTarget ) return;
		inviteMutation.mutate( { id: inviteTarget.id, userId: Number( inviteUserId ), role: inviteRole } );
	};

	return (
		<div className="st-todox-page">
			{/* Header */}
			<div className="st-todox-page-hd">
				<div className="st-todox-page-hd__left">
					<div className="st-todox-page-hd__icon-box">
						<Building2 size={ 20 } />
					</div>
					<div>
						<h1 className="st-todox-page-hd__title">Workspaces</h1>
						<p className="st-todox-page-hd__sub">
							{ workspaces.length } workspace{ workspaces.length !== 1 ? 's' : '' }
						</p>
					</div>
				</div>
				<Button onClick={ () => setCreateOpen( true ) }>
					<Plus size={ 14 } /> New Workspace
				</Button>
			</div>

			{ isLoading ? (
				<Spinner />
			) : workspaces.length === 0 ? (
				<div className="st-todox-empty-dashed">
					<Building2 size={ 40 } className="st-todox-empty-dashed__icon" />
					<p className="st-todox-empty-dashed__title">No workspaces yet</p>
					<p className="st-todox-empty-dashed__desc">Create your first workspace to get started.</p>
					<Button onClick={ () => setCreateOpen( true ) } className="st-todox-empty-dashed__action">
						Create Workspace
					</Button>
				</div>
			) : (
				<div className="st-todox-ws-list">
					{ workspaces.map( ( ws: Workspace ) => {
						const isActive = ws.id === activeWorkspaceId;
						const myRole   = ws.member_role;
						const isOwner  = ws.owner_id === currentUserId;
						const members  = ws.members ?? [];
						const cfg      = ROLE_CONFIG[ myRole ?? 'member' ];

						return (
							<div
								key={ ws.id }
								className={ `st-todox-ws-card ${ isActive ? 'st-todox-ws-card--active' : '' }` }
							>
								{/* Card header */}
								<div className="st-todox-ws-card__hd">
									<div className="st-todox-ws-card__hd-left">
										<div
											className="st-todox-ws-card__avatar"
											style={ { background: ws.color } }
										>
											{ ws.name.slice( 0, 1 ).toUpperCase() }
										</div>
										<div className="st-todox-ws-card__info">
											<div className="st-todox-ws-card__name-row">
												<h2 className="st-todox-ws-card__name">{ ws.name }</h2>
												{ isActive && (
													<span className="st-todox-ws-card__active-badge">Active</span>
												) }
												{ myRole && (
													<span className={ cfg.className }>
														{ myRole === 'owner' && <Crown size={ 10 } /> }
														{ cfg.label }
													</span>
												) }
											</div>
											{ ws.description && (
												<p className="st-todox-ws-card__desc">{ ws.description }</p>
											) }
											<div className="st-todox-ws-card__stats">
												<span>
													<Users size={ 12 } />
													{ ws.members_count ?? members.length } member{ ( ws.members_count ?? members.length ) !== 1 ? 's' : '' }
												</span>
												<span>
													<Building2 size={ 12 } />
													{ ws.departments_count ?? 0 } department{ ( ws.departments_count ?? 0 ) !== 1 ? 's' : '' }
												</span>
											</div>
										</div>
									</div>

									{/* Actions */}
									<div className="st-todox-ws-card__actions">
										{ canManage( myRole ) && (
											<Button
												variant="secondary"
												size="sm"
												onClick={ () => openInvite( ws ) }
											>
												<UserPlus size={ 13 } /> Invite
											</Button>
										) }
										<div className="st-todox-entity-card__menu-wrap">
											<button
												className="st-todox-entity-card__menu-btn"
												onClick={ ( e ) => {
													e.stopPropagation();
													setMenuOpen( menuOpen === ws.id ? null : ws.id );
												} }
											>
												<MoreHorizontal size={ 15 } />
											</button>
											{ menuOpen === ws.id && (
												<>
													<div className="st-todox-dropdown-backdrop" onClick={ () => setMenuOpen( null ) } />
													<div className="st-todox-entity-card__menu-dropdown">
														{ ! isActive && (
															<>
																<button onClick={ () => { switchWorkspace( ws ); setMenuOpen( null ); } }>
																	<CheckCircle2 size={ 13 } /> Switch to this
																</button>
																<div className="st-todox-dropdown-divider" />
															</>
														) }
														<button onClick={ () => openEdit( ws ) }>
															<Pencil size={ 13 } /> Edit
														</button>
														{ isOwner && (
															<>
																<div className="st-todox-dropdown-divider" />
																<button
																	className="st-todox-entity-card__menu-danger"
																	onClick={ () => { setDeleteTarget( ws ); setMenuOpen( null ); } }
																>
																	<Trash2 size={ 13 } /> Delete
																</button>
															</>
														) }
													</div>
												</>
											) }
										</div>
									</div>
								</div>

								{/* Members section */}
								<div className="st-todox-ws-card__members-section">
									<p className="st-todox-ws-card__members-label">
										Members ({ members.length })
									</p>
									{ members.length === 0 ? (
										<p className="st-todox-text--muted" style={ { fontSize: '12px' } }>No members yet.</p>
									) : (
										<div className="st-todox-ws-card__members-grid">
											{ members.map( ( m: WorkspaceMember ) => {
												const mCfg = ROLE_CONFIG[ m.role as WorkspaceRole ] ?? ROLE_CONFIG.member;
												const isSelf = m.id === currentUserId;
												return (
													<div key={ m.id } className="st-todox-ws-member-row">
														<Avatar name={ m.name } src={ m.avatar } size={ 28 } />
														<div className="st-todox-ws-member-row__info">
															<span className="st-todox-ws-member-row__name">
																{ m.name }{ isSelf && ' (you)' }
															</span>
															<span className="st-todox-ws-member-row__email">{ m.email }</span>
														</div>
														<span className={ mCfg.className }>
															{ m.role === 'owner' && <Crown size={ 9 } /> }
															{ mCfg.label }
														</span>
														{ canManage( myRole ) && m.role !== 'owner' && ! isSelf && (
															<button
																className="st-todox-ws-member-row__remove"
																title="Remove member"
																onClick={ () => removeMemberMutation.mutate( { wsId: ws.id, userId: m.id } ) }
															>
																<Trash2 size={ 12 } />
															</button>
														) }
													</div>
												);
											} ) }
										</div>
									) }
								</div>
							</div>
						);
					} ) }
				</div>
			) }

			{/* Create modal */}
			<Modal
				isOpen={ createOpen }
				onClose={ () => setCreateOpen( false ) }
				title="New Workspace"
				size="sm"
				footer={
					<>
						<Button variant="secondary" onClick={ () => setCreateOpen( false ) }>Cancel</Button>
						<Button
							onClick={ () => { if ( createForm.name?.trim() ) createMutation.mutate( createForm ); } }
							loading={ createMutation.isPending }
						>
							Create
						</Button>
					</>
				}
			>
				<form
					onSubmit={ ( e ) => { e.preventDefault(); if ( createForm.name?.trim() ) createMutation.mutate( createForm ); } }
					className="st-todox-form"
				>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Name <span className="st-todox-form__required">*</span></label>
						<input
							type="text"
							className="st-todox-form__input"
							placeholder="My Workspace"
							value={ createForm.name }
							onChange={ ( e ) => setCreateForm( { ...createForm, name: e.target.value } ) }
							autoFocus
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Description</label>
						<textarea
							className="st-todox-form__textarea"
							rows={ 2 }
							placeholder="Optional description"
							value={ createForm.description ?? '' }
							onChange={ ( e ) => setCreateForm( { ...createForm, description: e.target.value } ) }
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Color</label>
						<div className="st-todox-color-picker">
							{ COLORS.map( ( c ) => (
								<button
									key={ c }
									type="button"
									className={ `st-todox-color-picker__swatch ${ createForm.color === c ? 'st-todox-color-picker__swatch--active' : '' }` }
									style={ { background: c } }
									onClick={ () => setCreateForm( { ...createForm, color: c } ) }
								/>
							) ) }
						</div>
					</div>
				</form>
			</Modal>

			{/* Edit modal */}
			<Modal
				isOpen={ !! editTarget }
				onClose={ () => setEditTarget( null ) }
				title="Edit Workspace"
				size="sm"
				footer={
					<>
						<Button variant="secondary" onClick={ () => setEditTarget( null ) }>Cancel</Button>
						<Button
							onClick={ () => editTarget && updateMutation.mutate( { id: editTarget.id, data: editForm } ) }
							loading={ updateMutation.isPending }
						>
							Save Changes
						</Button>
					</>
				}
			>
				<form
					onSubmit={ ( e ) => {
						e.preventDefault();
						if ( editTarget ) updateMutation.mutate( { id: editTarget.id, data: editForm } );
					} }
					className="st-todox-form"
				>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Color</label>
						<div className="st-todox-color-picker">
							{ COLORS.map( ( c ) => (
								<button
									key={ c }
									type="button"
									className={ `st-todox-color-picker__swatch ${ editForm.color === c ? 'st-todox-color-picker__swatch--active' : '' }` }
									style={ { background: c } }
									onClick={ () => setEditForm( { ...editForm, color: c } ) }
								/>
							) ) }
						</div>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Name <span className="st-todox-form__required">*</span></label>
						<input
							type="text"
							className="st-todox-form__input"
							value={ editForm.name ?? '' }
							onChange={ ( e ) => setEditForm( { ...editForm, name: e.target.value } ) }
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Description</label>
						<textarea
							className="st-todox-form__textarea"
							rows={ 2 }
							value={ editForm.description ?? '' }
							onChange={ ( e ) => setEditForm( { ...editForm, description: e.target.value } ) }
						/>
					</div>
				</form>
			</Modal>

			{/* Invite member modal */}
			<Modal
				isOpen={ !! inviteTarget }
				onClose={ () => setInviteTarget( null ) }
				title={ `Invite to "${ inviteTarget?.name }"` }
				size="sm"
				footer={
					<>
						<Button variant="secondary" onClick={ () => setInviteTarget( null ) }>Cancel</Button>
						<Button
							onClick={ doInvite }
							loading={ inviteMutation.isPending }
							disabled={ ! inviteUserId }
						>
							Add Member
						</Button>
					</>
				}
			>
				<div className="st-todox-form">
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">User</label>
						<select
							className="st-todox-form__select"
							value={ inviteUserId }
							onChange={ ( e ) => setInviteUserId( e.target.value ) }
						>
							<option value="">— Select user —</option>
							{ allUsers
								.filter( ( u ) => ! inviteTarget?.members?.find( ( m ) => m.id === u.id ) )
								.map( ( u ) => (
									<option key={ u.id } value={ u.id }>{ u.name } ({ u.email })</option>
								) )
							}
						</select>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Role</label>
						<select
							className="st-todox-form__select"
							value={ inviteRole }
							onChange={ ( e ) => setInviteRole( e.target.value as WorkspaceRole ) }
						>
							<option value="admin">Admin — can manage members and settings</option>
							<option value="member">Member — can create projects and tasks</option>
							<option value="guest">Guest — read-only access</option>
						</select>
					</div>
				</div>
			</Modal>

			{/* Delete confirm */}
			<ConfirmDialog
				isOpen={ !! deleteTarget }
				onClose={ () => setDeleteTarget( null ) }
				onConfirm={ () => deleteTarget && deleteMutation.mutate( deleteTarget.id ) }
				title="Delete Workspace"
				message={ `Delete "${ deleteTarget?.name }"? This will permanently remove all workspace data. This action cannot be undone.` }
				confirmLabel="Delete Workspace"
				loading={ deleteMutation.isPending }
			/>
		</div>
	);
};

export default WorkspacesPage;
