/**
 * External dependencies
 */
import { useState, useMemo, useEffect, useRef } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	DndContext,
	DragEndEvent,
	DragOverlay,
	DragStartEvent,
	PointerSensor,
	useSensor,
	useSensors,
	closestCenter,
} from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Briefcase, Users, FolderKanban, Crown, Pencil, Trash2, Plus, Search, GripVertical } from 'lucide-react';

/**
 * Internal dependencies
 */
import { teamsApi, departmentsApi, usersApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import DepartmentSelector from '../../components/ui/DepartmentSelector';
import { ColorPicker, COLORS_ENTITY } from '../../components/inputs';
import type { Team, TeamMember, CreateTeamInput } from '../../types';

const emptyForm = (): CreateTeamInput => ( {
	workspace_id:   0,
	department_ids: [],
	name:           '',
	description:    '',
	color:          '#6366f1',
	manager_id:     null,
} );

/* ---- Sortable row ---- */
const SortableRow = ( {
	team,
	checked,
	onSelect,
	onEdit,
	onDelete,
	onMembers,
}: {
	team:      Team;
	checked:   boolean;
	onSelect:  ( id: number ) => void;
	onEdit:    ( t: Team ) => void;
	onDelete:  ( t: Team ) => void;
	onMembers: ( t: Team ) => void;
} ) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable( { id: team.id } );

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity:   isDragging ? 0.35 : 1,
		position:  'relative',
		zIndex:    isDragging ? 1 : 'auto',
	};

	return (
		<tr ref={ setNodeRef } style={ style } { ...attributes } className={ `st-todox-table__row ${ isDragging ? 'st-todox-table__row--dragging' : '' } ${ checked ? 'st-todox-table__row--selected' : '' }` }>
			<td className="st-todox-table__drag-cell" onClick={ ( e ) => e.stopPropagation() }>
				<span className="st-todox-table__drag-handle" { ...listeners }>
					<GripVertical size={ 14 } />
				</span>
			</td>
			<td className="st-todox-table__check-cell" onClick={ ( e ) => e.stopPropagation() }>
				<input type="checkbox" checked={ checked } onChange={ () => onSelect( team.id ) } />
			</td>
			<td className="st-todox-table__title-cell">
				<div className="st-todox-entity-name">
					<span className="st-todox-entity-name__dot" style={ { background: team.color } } />
					<span className="st-todox-entity-name__text">{ team.name }</span>
				</div>
			</td>
			<td>
				{ team.departments?.length > 0 ? (
					<span className="st-todox-text--muted">
						{ team.departments.map( ( d ) => d.name ).join( ', ' ) }
					</span>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>
			<td>
				{ team.manager ? (
					<div className="st-todox-assignee">
						<Avatar name={ team.manager.name } src={ team.manager.avatar } size={ 22 } />
						<span className="st-todox-assignee__name">{ team.manager.name }</span>
					</div>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>
			<td>
				<div className="st-todox-entity-count">
					<Users size={ 12 } />
					{ team.members_count ?? 0 }
				</div>
			</td>
			<td>
				<div className="st-todox-entity-count">
					<FolderKanban size={ 12 } />
					{ team.projects_count ?? 0 }
				</div>
			</td>
			<td className="st-todox-table__actions-cell" onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-table__row-actions">
					<button className="st-todox-table__action-btn" title="Members" onClick={ () => onMembers( team ) }>
						<Users size={ 13 } />
					</button>
					<button className="st-todox-table__action-btn" title="Edit" onClick={ () => onEdit( team ) }>
						<Pencil size={ 13 } />
					</button>
					<button className="st-todox-table__action-btn st-todox-table__action-btn--danger" title="Delete" onClick={ () => onDelete( team ) }>
						<Trash2 size={ 13 } />
					</button>
				</div>
			</td>
		</tr>
	);
};

const EMPTY_TEAMS: Team[] = [];

const TeamsPage = () => {
	const qc = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();

	const [ modalOpen, setModalOpen ]             = useState( false );
	const [ memberModalOpen, setMemberModalOpen ] = useState( false );
	const [ editing, setEditing ]                 = useState< Team | null >( null );
	const [ selectedTeam, setSelectedTeam ]       = useState< Team | null >( null );
	const [ deleteTarget, setDeleteTarget ]       = useState< Team | null >( null );
	const [ form, setForm ]                       = useState< CreateTeamInput >( emptyForm() );
	const [ addUserId, setAddUserId ]             = useState( '' );
	const [ addUserRole, setAddUserRole ]         = useState< 'lead' | 'member' >( 'member' );
	const [ search, setSearch ]                   = useState( '' );
	const [ ordered, setOrdered ]                 = useState< Team[] >( [] );
	const [ activeDrag, setActiveDrag ]           = useState< Team | null >( null );
	const [ selectedIds, setSelectedIds ]         = useState< Set< number > >( new Set() );
	const [ bulkConfirmOpen, setBulkConfirmOpen ] = useState( false );
	const selectAllRef                            = useRef< HTMLInputElement >( null );

	const { data: teams = EMPTY_TEAMS, isLoading } = useQuery( {
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

	useEffect( () => {
		setOrdered( teams as Team[] );
	}, [ teams ] );

	const filtered = useMemo( () => {
		const q = search.trim().toLowerCase();
		if ( ! q ) return ordered;
		return ordered.filter( ( t ) => t.name.toLowerCase().includes( q ) );
	}, [ ordered, search ] );

	const allSelected  = filtered.length > 0 && filtered.every( ( t ) => selectedIds.has( t.id ) );
	const someSelected = ! allSelected && filtered.some( ( t ) => selectedIds.has( t.id ) );

	useEffect( () => {
		if ( selectAllRef.current ) selectAllRef.current.indeterminate = someSelected;
	}, [ someSelected ] );

	const toggleSelect = ( id: number ) =>
		setSelectedIds( ( prev ) => { const s = new Set( prev ); s.has( id ) ? s.delete( id ) : s.add( id ); return s; } );

	const toggleAll = () =>
		setSelectedIds( allSelected ? new Set() : new Set( filtered.map( ( t ) => t.id ) ) );

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

	const bulkDeleteMutation = useMutation( {
		mutationFn: ( ids: number[] ) => Promise.all( ids.map( ( id ) => teamsApi.delete( id ) ) ),
		onSuccess:  () => { invalidate(); setSelectedIds( new Set() ); toast.success( 'Teams deleted.' ); },
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

	const reorderMutation = useMutation( {
		mutationFn: ( items: { id: number; position: number }[] ) => teamsApi.reorder( items ),
		onError:    ( err: Error ) => {
			toast.error( err.message );
			setOrdered( teams as Team[] );
		},
	} );

	const sensors = useSensors( useSensor( PointerSensor, { activationConstraint: { distance: 5 } } ) );

	const handleDragStart = ( event: DragStartEvent ) => {
		setActiveDrag( ordered.find( ( t ) => t.id === event.active.id ) ?? null );
	};

	const handleDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		setActiveDrag( null );
		if ( ! over || active.id === over.id ) return;

		setOrdered( ( prev ) => {
			const oldIdx    = prev.findIndex( ( t ) => t.id === active.id );
			const newIdx    = prev.findIndex( ( t ) => t.id === over.id );
			const reordered = arrayMove( prev, oldIdx, newIdx );
			reorderMutation.mutate( reordered.map( ( t, i ) => ( { id: t.id, position: i } ) ) );
			return reordered;
		} );
	};

	const openCreate = () => {
		setEditing( null );
		setForm( { ...emptyForm(), workspace_id: activeWorkspaceId! } );
		setModalOpen( true );
	};

	const openEdit = ( team: Team ) => {
		setEditing( team );
		setForm( {
			workspace_id:   team.workspace_id,
			department_ids: team.department_ids ?? [],
			name:           team.name,
			description:    team.description ?? '',
			color:          team.color,
			manager_id:     team.manager_id,
		} );
		setModalOpen( true );
	};

	const handleClose = () => { setModalOpen( false ); setEditing( null ); setForm( emptyForm() ); };

	const doSubmit = () => {
		if ( ! form.name.trim() ) { toast.error( 'Name is required.' ); return; }
		if ( ! form.department_ids?.length ) { toast.error( 'Select at least one department.' ); return; }
		if ( editing ) {
			updateMutation.mutate( { id: editing.id, data: form } );
		} else {
			createMutation.mutate( { ...form, workspace_id: activeWorkspaceId! } );
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<div className="st-todox-page">
			<PageHeader
				title="Teams"
				description={ `${ activeWorkspace?.name } · ${ ( teams as Team[] ).length } team${ ( teams as Team[] ).length !== 1 ? 's' : '' }` }
				actions={
					activeWorkspaceId ? (
						<Button onClick={ openCreate } leftIcon={ <Plus size={ 14 } /> }>
							New Team
						</Button>
					) : undefined
				}
			/>

			<div className="st-todox-surface-card">
				{/* Toolbar */}
				<div className="st-todox-tasks-toolbar">
					<div className="st-todox-tasks-toolbar__search">
						<Search size={ 14 } className="st-todox-tasks-toolbar__search-icon" />
						<input
							type="search"
							className="st-todox-tasks-toolbar__input"
							placeholder="Search teams…"
							value={ search }
							onChange={ ( e ) => setSearch( e.target.value ) }
						/>
					</div>
				</div>

				{ isLoading ? (
					<div className="st-todox-page-loader"><Spinner /></div>
				) : ( teams as Team[] ).length === 0 ? (
					<div className="st-todox-empty-inline">
						<Briefcase size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>No teams yet — create your first one.</p>
						{ activeWorkspaceId && (
							<Button size="sm" onClick={ openCreate } leftIcon={ <Plus size={ 13 } /> }>
								New Team
							</Button>
						) }
					</div>
				) : filtered.length === 0 ? (
					<div className="st-todox-empty-inline">
						<Briefcase size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>No teams match your search.</p>
					</div>
				) : (
					<DndContext
						sensors={ sensors }
						collisionDetection={ closestCenter }
						onDragStart={ handleDragStart }
						onDragEnd={ handleDragEnd }
					>
						{ selectedIds.size > 0 && (
							<div className="st-todox-bulk-bar">
								<span className="st-todox-bulk-bar__count">{ selectedIds.size } selected</span>
								<div className="st-todox-bulk-bar__actions">
									<button
										className="st-todox-bulk-bar__btn st-todox-bulk-bar__btn--danger"
										onClick={ () => setBulkConfirmOpen( true ) }
									>
										<Trash2 size={ 13 } />
										Delete selected
									</button>
									<span className="st-todox-bulk-bar__sep" />
									<button
										className="st-todox-bulk-bar__btn st-todox-bulk-bar__btn--ghost"
										onClick={ () => setSelectedIds( new Set() ) }
									>
										Clear
									</button>
								</div>
							</div>
						) }
						<div className="st-todox-table-scroll">
							<table className="st-todox-table">
								<thead>
									<tr>
										<th style={ { width: 32 } } />
										<th className="st-todox-table__check-cell">
											<input
												type="checkbox"
												ref={ selectAllRef }
												checked={ allSelected }
												onChange={ toggleAll }
											/>
										</th>
										<th style={ { width: '23%' } }>Name</th>
										<th>Departments</th>
										<th>Manager</th>
										<th style={ { width: 90 } }>Members</th>
										<th style={ { width: 90 } }>Projects</th>
										<th style={ { width: 110 } } />
									</tr>
								</thead>
								<SortableContext items={ filtered.map( ( t ) => t.id ) } strategy={ verticalListSortingStrategy }>
									<tbody>
										{ filtered.map( ( team ) => (
											<SortableRow
												key={ team.id }
												team={ team }
												checked={ selectedIds.has( team.id ) }
												onSelect={ toggleSelect }
												onEdit={ openEdit }
												onDelete={ setDeleteTarget }
												onMembers={ ( t ) => { setSelectedTeam( t ); setMemberModalOpen( true ); } }
											/>
										) ) }
									</tbody>
								</SortableContext>
							</table>
						</div>
						<DragOverlay dropAnimation={ { duration: 160, easing: 'ease' } }>
							{ activeDrag && (
								<div className="st-todox-table__drag-overlay">
									<GripVertical size={ 14 } className="st-todox-table__drag-overlay-grip" />
									<span className="st-todox-table__drag-overlay-title">{ activeDrag.name }</span>
								</div>
							) }
						</DragOverlay>
					</DndContext>
				) }
			</div>

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
						<label className="st-todox-form__label">
							Departments <span className="st-todox-form__required">*</span>
						</label>
						<DepartmentSelector
							departments={ departments }
							selectedIds={ form.department_ids ?? [] }
							onChange={ ( ids ) => setForm( { ...form, department_ids: ids } ) }
						/>
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
						<ColorPicker colors={ COLORS_ENTITY } value={ form.color } onChange={ ( c ) => setForm( { ...form, color: c } ) } />
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
								<span className="st-todox-member-row__role">
									{ m.team_role === 'lead' && <Crown size={ 10 } style={ { marginRight: 3 } } /> }
									{ m.team_role }
								</span>
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

			<ConfirmDialog
				isOpen={ bulkConfirmOpen }
				onClose={ () => setBulkConfirmOpen( false ) }
				onConfirm={ () => { setBulkConfirmOpen( false ); bulkDeleteMutation.mutate( [ ...selectedIds ] ); } }
				title={ `Delete ${ selectedIds.size } Team${ selectedIds.size !== 1 ? 's' : '' }?` }
				message="This will permanently delete the selected teams. This cannot be undone."
				confirmLabel="Delete All"
				loading={ bulkDeleteMutation.isPending }
			/>
		</div>
	);
};

export default TeamsPage;
