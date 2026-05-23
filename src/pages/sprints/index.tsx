/**
 * External dependencies
 */
import { useState, useMemo, useEffect, useRef } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import {
	Zap, Calendar, CheckSquare, Pencil, Trash2, Plus, Check, Search, ChevronRight, GripVertical,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { sprintsApi, projectsApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { formatDate } from '../../utils/helpers';
import type { Sprint, SprintStatus, CreateSprintInput } from '../../types';

const STATUS_CONFIG: Record< SprintStatus, { label: string; color: string } > = {
	active:    { label: 'Active',    color: '#10b981' },
	planned:   { label: 'Planned',   color: '#6366f1' },
	completed: { label: 'Completed', color: '#94a3b8' },
};

const STATUS_ORDER: SprintStatus[] = [ 'active', 'planned', 'completed' ];

interface SprintForm {
	project_id: string;
	name:       string;
	goal:       string;
	start_date: string;
	end_date:   string;
}

const emptyForm = (): SprintForm => ( {
	project_id: '',
	name:       '',
	goal:       '',
	start_date: '',
	end_date:   '',
} );

/* ---- Sortable row ---- */
const SortableRow = ( {
	sprint,
	checked,
	onSelect,
	statusMenuId,
	onStatusMenu,
	onChangeStatus,
	onEdit,
	onDelete,
	onNavigate,
}: {
	sprint:         Sprint;
	checked:        boolean;
	onSelect:       ( id: number ) => void;
	statusMenuId:   number | null;
	onStatusMenu:   ( id: number | null ) => void;
	onChangeStatus: ( s: Sprint, status: SprintStatus ) => void;
	onEdit:         ( s: Sprint ) => void;
	onDelete:       ( s: Sprint ) => void;
	onNavigate:     ( id: number ) => void;
} ) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable( { id: sprint.id } );

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity:   isDragging ? 0.35 : 1,
		position:  'relative',
		zIndex:    isDragging ? 1 : 'auto',
	};

	const statusCfg = STATUS_CONFIG[ sprint.status as SprintStatus ] ?? STATUS_CONFIG.planned;

	return (
		<tr
			ref={ setNodeRef }
			style={ style }
			{ ...attributes }
			className={ `st-todox-table__row st-todox-table__row--clickable ${ isDragging ? 'st-todox-table__row--dragging' : '' } ${ checked ? 'st-todox-table__row--selected' : '' }` }
			onClick={ () => onNavigate( sprint.id ) }
		>
			<td className="st-todox-table__drag-cell" onClick={ ( e ) => e.stopPropagation() }>
				<span className="st-todox-table__drag-handle" { ...listeners }>
					<GripVertical size={ 14 } />
				</span>
			</td>
			<td className="st-todox-table__check-cell" onClick={ ( e ) => e.stopPropagation() }>
				<input type="checkbox" checked={ checked } onChange={ () => onSelect( sprint.id ) } />
			</td>
			<td className="st-todox-table__title-cell">
				<div className="st-todox-entity-name">
					<span className="st-todox-entity-name__dot" style={ { background: sprint.project?.color ?? statusCfg.color } } />
					<span className="st-todox-entity-name__text">{ sprint.name }</span>
				</div>
			</td>
			<td>
				<span className="st-todox-text--muted">{ sprint.project?.name ?? '—' }</span>
			</td>
			<td onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-entity-status-wrap">
					<button
						className="st-todox-entity-status-badge"
						style={ { background: statusCfg.color + '20', color: statusCfg.color, borderColor: statusCfg.color + '44' } }
						onClick={ () => onStatusMenu( statusMenuId === sprint.id ? null : sprint.id ) }
					>
						{ statusCfg.label }
					</button>
					{ statusMenuId === sprint.id && (
						<>
							<div className="st-todox-dropdown-backdrop" onClick={ () => onStatusMenu( null ) } />
							<div className="st-todox-entity-card__menu-dropdown">
								<div className="st-todox-dropdown-section-label">Set status</div>
								{ STATUS_ORDER.map( ( s ) => (
									<button
										key={ s }
										className={ sprint.status === s ? 'st-todox-dropdown-status-current' : '' }
										onClick={ () => onChangeStatus( sprint, s ) }
									>
										<span className="st-todox-dropdown-status-dot" style={ { background: STATUS_CONFIG[ s ].color } } />
										{ STATUS_CONFIG[ s ].label }
										{ sprint.status === s && <Check size={ 11 } className="st-todox-dropdown-status-check" /> }
									</button>
								) ) }
							</div>
						</>
					) }
				</div>
			</td>
			<td>
				{ sprint.goal ? (
					<span className="st-todox-text--muted st-todox-table__cell-truncate">{ sprint.goal }</span>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>
			<td>
				{ sprint.start_date ? (
					<span className="st-todox-table__date-cell"><Calendar size={ 12 } />{ formatDate( sprint.start_date ) }</span>
				) : <span className="st-todox-text--muted">—</span> }
			</td>
			<td>
				{ sprint.end_date ? (
					<span className="st-todox-table__date-cell"><Calendar size={ 12 } />{ formatDate( sprint.end_date ) }</span>
				) : <span className="st-todox-text--muted">—</span> }
			</td>
			<td>
				<div className="st-todox-entity-count">
					<CheckSquare size={ 12 } />
					{ sprint.tasks_count ?? 0 }
				</div>
			</td>
			<td className="st-todox-table__actions-cell" onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-table__row-actions">
					<button className="st-todox-table__action-btn" title="Edit" onClick={ () => onEdit( sprint ) }>
						<Pencil size={ 13 } />
					</button>
					<button className="st-todox-table__action-btn st-todox-table__action-btn--danger" title="Delete" onClick={ () => onDelete( sprint ) }>
						<Trash2 size={ 13 } />
					</button>
					<ChevronRight size={ 13 } className="st-todox-table__row-chevron" />
				</div>
			</td>
		</tr>
	);
};

const EMPTY_SPRINTS: Sprint[] = [];

const SprintsPage = () => {
	const navigate = useNavigate();
	const qc       = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();

	const [ statusMenuId, setStatusMenuId ] = useState< number | null >( null );
	const [ modalOpen, setModalOpen ]       = useState( false );
	const [ editing, setEditing ]           = useState< Sprint | null >( null );
	const [ deleteTarget, setDeleteTarget ] = useState< Sprint | null >( null );
	const [ form, setForm ]                 = useState< SprintForm >( emptyForm() );
	const [ search, setSearch ]             = useState( '' );
	const [ statusFilter, setStatusFilter ] = useState< SprintStatus | 'all' >( 'all' );
	const [ ordered, setOrdered ]           = useState< Sprint[] >( [] );
	const [ activeDrag, setActiveDrag ]     = useState< Sprint | null >( null );
	const [ selectedIds, setSelectedIds ]   = useState< Set< number > >( new Set() );
	const [ bulkStatus, setBulkStatus ]     = useState< SprintStatus >( 'active' );
	const [ bulkConfirmOpen, setBulkConfirmOpen ] = useState( false );
	const selectAllRef                      = useRef< HTMLInputElement >( null );

	const { data: projects = [], isLoading: projectsLoading } = useQuery( {
		queryKey: [ 'projects', activeWorkspaceId ],
		queryFn:  () => projectsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const projectIds = projects.map( ( p ) => p.id );

	const { data: allSprints = EMPTY_SPRINTS, isLoading: sprintsLoading } = useQuery< Sprint[] >( {
		queryKey: [ 'sprints', 'all', activeWorkspaceId, projectIds.join( ',' ) ],
		queryFn:  async () => {
			if ( ! projectIds.length ) return [];
			const results = await Promise.all( projectIds.map( ( pid ) => sprintsApi.getAll( pid ) ) );
			return results.flat();
		},
		enabled: !! activeWorkspaceId && projectIds.length > 0,
	} );

	const isLoading = projectsLoading || sprintsLoading;

	useEffect( () => {
		setOrdered( allSprints );
	}, [ allSprints ] );

	const filtered = useMemo( () => {
		let list = ordered;
		if ( statusFilter !== 'all' ) {
			list = list.filter( ( s ) => s.status === statusFilter );
		}
		const q = search.trim().toLowerCase();
		if ( q ) {
			list = list.filter( ( s ) =>
				s.name.toLowerCase().includes( q ) ||
				( s.project?.name ?? '' ).toLowerCase().includes( q )
			);
		}
		return list;
	}, [ ordered, statusFilter, search ] );

	const countByStatus = ( s: SprintStatus | 'all' ) =>
		s === 'all' ? allSprints.length : allSprints.filter( ( sp ) => sp.status === s ).length;

	const allSelected  = filtered.length > 0 && filtered.every( ( s ) => selectedIds.has( s.id ) );
	const someSelected = ! allSelected && filtered.some( ( s ) => selectedIds.has( s.id ) );

	useEffect( () => {
		if ( selectAllRef.current ) selectAllRef.current.indeterminate = someSelected;
	}, [ someSelected ] );

	const toggleSelect = ( id: number ) =>
		setSelectedIds( ( prev ) => { const s = new Set( prev ); s.has( id ) ? s.delete( id ) : s.add( id ); return s; } );

	const toggleAll = () =>
		setSelectedIds( allSelected ? new Set() : new Set( filtered.map( ( s ) => s.id ) ) );

	const invalidate = () => {
		qc.invalidateQueries( { queryKey: [ 'sprints', 'all', activeWorkspaceId ] } );
	};

	const createMutation = useMutation( {
		mutationFn: ( data: CreateSprintInput ) => sprintsApi.create( data ),
		onSuccess: () => { invalidate(); handleClose(); toast.success( 'Sprint created.' ); },
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateSprintInput > & { status?: string } } ) =>
			sprintsApi.update( id, data ),
		onSuccess: () => { invalidate(); handleClose(); toast.success( 'Sprint updated.' ); },
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => sprintsApi.delete( id ),
		onSuccess:  () => { invalidate(); setDeleteTarget( null ); toast.success( 'Sprint deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const bulkDeleteMutation = useMutation( {
		mutationFn: ( ids: number[] ) => Promise.all( ids.map( ( id ) => sprintsApi.delete( id ) ) ),
		onSuccess:  () => { invalidate(); setSelectedIds( new Set() ); toast.success( 'Sprints deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const bulkStatusMutation = useMutation( {
		mutationFn: ( { ids, status }: { ids: number[]; status: SprintStatus } ) =>
			Promise.all( ids.map( ( id ) => sprintsApi.update( id, { status } ) ) ),
		onSuccess:  () => { invalidate(); setSelectedIds( new Set() ); toast.success( 'Status updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const reorderMutation = useMutation( {
		mutationFn: ( items: { id: number; position: number }[] ) => sprintsApi.reorder( items ),
		onError:    ( err: Error ) => {
			toast.error( err.message );
			setOrdered( allSprints );
		},
	} );

	const sensors = useSensors( useSensor( PointerSensor, { activationConstraint: { distance: 5 } } ) );

	const handleDragStart = ( event: DragStartEvent ) => {
		setActiveDrag( ordered.find( ( s ) => s.id === event.active.id ) ?? null );
	};

	const handleDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		setActiveDrag( null );
		if ( ! over || active.id === over.id ) return;

		setOrdered( ( prev ) => {
			const oldIdx    = prev.findIndex( ( s ) => s.id === active.id );
			const newIdx    = prev.findIndex( ( s ) => s.id === over.id );
			const reordered = arrayMove( prev, oldIdx, newIdx );
			reorderMutation.mutate( reordered.map( ( s, i ) => ( { id: s.id, position: i } ) ) );
			return reordered;
		} );
	};

	const openCreate = () => {
		setEditing( null );
		setForm( { ...emptyForm(), project_id: String( projects[ 0 ]?.id ?? '' ) } );
		setModalOpen( true );
	};

	const openEdit = ( sprint: Sprint ) => {
		setEditing( sprint );
		setForm( {
			project_id: String( sprint.project?.id ?? '' ),
			name:       sprint.name,
			goal:       sprint.goal ?? '',
			start_date: sprint.start_date ?? '',
			end_date:   sprint.end_date ?? '',
		} );
		setModalOpen( true );
	};

	const handleClose = () => { setModalOpen( false ); setEditing( null ); setForm( emptyForm() ); };

	const doSubmit = () => {
		if ( ! form.name.trim() ) { toast.error( 'Name is required.' ); return; }
		const payload = {
			name:       form.name.trim(),
			goal:       form.goal || undefined,
			start_date: form.start_date || undefined,
			end_date:   form.end_date || undefined,
		};
		if ( editing ) {
			updateMutation.mutate( { id: editing.id, data: payload } );
		} else {
			if ( ! form.project_id ) { toast.error( 'Please select a project.' ); return; }
			createMutation.mutate( { project_id: Number( form.project_id ), ...payload } );
		}
	};

	const changeStatus = ( sprint: Sprint, status: SprintStatus ) => {
		setStatusMenuId( null );
		updateMutation.mutate( { id: sprint.id, data: { status } } );
	};

	const isSaving = createMutation.isPending || updateMutation.isPending;

	return (
		<div className="st-todox-page">
			<PageHeader
				title="Sprints"
				description={ `${ activeWorkspace?.name } · ${ allSprints.length } sprint${ allSprints.length !== 1 ? 's' : '' }` }
				actions={
					<div className="st-todox-page-header__btn-group">
						{ projects.length > 0 && (
							<>
								<Button variant="secondary" onClick={ () => navigate( '/projects' ) }>
									Manage Projects
								</Button>
								<Button onClick={ openCreate } leftIcon={ <Plus size={ 14 } /> }>
									New Sprint
								</Button>
							</>
						) }
					</div>
				}
			/>

			{/* Status filter pills */}
			{ allSprints.length > 0 && (
				<div className="st-todox-pills">
					<button
						className={ `st-todox-pill ${ statusFilter === 'all' ? 'st-todox-pill--active' : '' }` }
						style={ statusFilter === 'all' ? { background: '#0f172a', borderColor: '#0f172a', color: '#fff' } : {} }
						onClick={ () => setStatusFilter( 'all' ) }
					>
						All
						<span className="st-todox-pill__count">{ countByStatus( 'all' ) }</span>
					</button>
					{ STATUS_ORDER.map( ( s ) => {
						const cfg      = STATUS_CONFIG[ s ];
						const isActive = statusFilter === s;
						return (
							<button
								key={ s }
								className={ `st-todox-pill ${ isActive ? 'st-todox-pill--active' : '' }` }
								style={ isActive ? { background: cfg.color, borderColor: cfg.color, color: '#fff' } : {} }
								onClick={ () => setStatusFilter( s ) }
							>
								{ cfg.label }
								<span className="st-todox-pill__count">{ countByStatus( s ) }</span>
							</button>
						);
					} ) }
				</div>
			) }

			<div className="st-todox-surface-card">
				{ isLoading ? (
					<div className="st-todox-page-loader"><Spinner /></div>
				) : projects.length === 0 ? (
					<div className="st-todox-empty-inline">
						<Zap size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>No projects yet — create a project first, then add sprints.</p>
						<button className="st-todox-link-btn" onClick={ () => navigate( '/projects' ) }>
							Go to Projects →
						</button>
					</div>
				) : allSprints.length === 0 ? (
					<div className="st-todox-empty-inline">
						<Zap size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>No sprints yet — create your first sprint to start planning work.</p>
						<Button size="sm" onClick={ openCreate } leftIcon={ <Plus size={ 13 } /> }>
							New Sprint
						</Button>
					</div>
				) : (
					<>
						{/* Toolbar */}
						<div className="st-todox-tasks-toolbar">
							<div className="st-todox-tasks-toolbar__search">
								<Search size={ 14 } className="st-todox-tasks-toolbar__search-icon" />
								<input
									type="search"
									className="st-todox-tasks-toolbar__input"
									placeholder="Search sprints…"
									value={ search }
									onChange={ ( e ) => setSearch( e.target.value ) }
								/>
							</div>
							{ search && (
								<div className="st-todox-tasks-toolbar__filters">
									<button className="st-todox-tasks-toolbar__clear" onClick={ () => setSearch( '' ) }>
										Clear search
									</button>
								</div>
							) }
						</div>

						{ filtered.length === 0 ? (
							<div className="st-todox-empty-inline">
								<Zap size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
								<p>No sprints match your filters.</p>
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
											<select
												className="st-todox-bulk-bar__status-select"
												value={ bulkStatus }
												onChange={ ( e ) => setBulkStatus( e.target.value as SprintStatus ) }
											>
												{ STATUS_ORDER.map( ( s ) => (
													<option key={ s } value={ s }>{ STATUS_CONFIG[ s ].label }</option>
												) ) }
											</select>
											<button
												className="st-todox-bulk-bar__btn"
												disabled={ bulkStatusMutation.isPending }
												onClick={ () => bulkStatusMutation.mutate( { ids: [ ...selectedIds ], status: bulkStatus } ) }
											>
												Set status
											</button>
											<span className="st-todox-bulk-bar__sep" />
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
												<th style={ { width: '18%' } }>Name</th>
												<th style={ { width: '13%' } }>Project</th>
												<th style={ { width: 110 } }>Status</th>
												<th>Goal</th>
												<th style={ { width: 105 } }>Start</th>
												<th style={ { width: 105 } }>End</th>
												<th style={ { width: 80 } }>Tasks</th>
												<th style={ { width: 80 } } />
											</tr>
										</thead>
										<SortableContext items={ filtered.map( ( s ) => s.id ) } strategy={ verticalListSortingStrategy }>
											<tbody>
												{ filtered.map( ( sprint ) => (
													<SortableRow
														key={ sprint.id }
														sprint={ sprint }
														checked={ selectedIds.has( sprint.id ) }
														onSelect={ toggleSelect }
														statusMenuId={ statusMenuId }
														onStatusMenu={ setStatusMenuId }
														onChangeStatus={ changeStatus }
														onEdit={ openEdit }
														onDelete={ setDeleteTarget }
														onNavigate={ ( id ) => navigate( `/sprints/${ id }` ) }
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
					</>
				) }
			</div>

			<Modal
				isOpen={ modalOpen }
				onClose={ handleClose }
				title={ editing ? 'Edit Sprint' : 'New Sprint' }
				size="sm"
				footer={
					<>
						<Button variant="secondary" onClick={ handleClose } disabled={ isSaving }>Cancel</Button>
						<Button onClick={ doSubmit } loading={ isSaving }>
							{ editing ? 'Save Changes' : 'Create Sprint' }
						</Button>
					</>
				}
			>
				<form onSubmit={ ( e ) => { e.preventDefault(); doSubmit(); } } className="st-todox-form">
					{ ! editing && (
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">Project <span className="st-todox-form__required">*</span></label>
							<select className="st-todox-form__input" value={ form.project_id }
								onChange={ ( e ) => setForm( { ...form, project_id: e.target.value } ) } required>
								<option value="">Select a project…</option>
								{ projects.map( ( p ) => <option key={ p.id } value={ p.id }>{ p.name }</option> ) }
							</select>
						</div>
					) }
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Name <span className="st-todox-form__required">*</span></label>
						<input type="text" className="st-todox-form__input" placeholder="Sprint name"
							value={ form.name } onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) } autoFocus />
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Goal</label>
						<textarea className="st-todox-form__textarea" rows={ 2 } placeholder="What is this sprint trying to achieve?"
							value={ form.goal } onChange={ ( e ) => setForm( { ...form, goal: e.target.value } ) } />
					</div>
					<div className="st-todox-form__row">
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">Start Date</label>
							<input type="date" className="st-todox-form__input" value={ form.start_date }
								onChange={ ( e ) => setForm( { ...form, start_date: e.target.value } ) } />
						</div>
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">End Date</label>
							<input type="date" className="st-todox-form__input" value={ form.end_date }
								onChange={ ( e ) => setForm( { ...form, end_date: e.target.value } ) } />
						</div>
					</div>
				</form>
			</Modal>

			<ConfirmDialog
				isOpen={ !! deleteTarget }
				onClose={ () => setDeleteTarget( null ) }
				onConfirm={ () => deleteTarget && deleteMutation.mutate( deleteTarget.id ) }
				title="Delete Sprint"
				message={ `Delete "${ deleteTarget?.name }"? This cannot be undone.` }
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
			/>

			<ConfirmDialog
				isOpen={ bulkConfirmOpen }
				onClose={ () => setBulkConfirmOpen( false ) }
				onConfirm={ () => { setBulkConfirmOpen( false ); bulkDeleteMutation.mutate( [ ...selectedIds ] ); } }
				title={ `Delete ${ selectedIds.size } Sprint${ selectedIds.size !== 1 ? 's' : '' }?` }
				message="This will permanently delete the selected sprints and all their tasks. This cannot be undone."
				confirmLabel="Delete All"
				loading={ bulkDeleteMutation.isPending }
			/>
		</div>
	);
};

export default SprintsPage;
