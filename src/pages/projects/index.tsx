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
import { FolderKanban, Zap, Pencil, Trash2, Plus, Search, Check, ChevronRight, GripVertical } from 'lucide-react';

/**
 * Internal dependencies
 */
import { projectsApi, teamsApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import LabelSelector from '../../components/ui/LabelSelector';
import DepartmentSelector from '../../components/ui/DepartmentSelector';
import { ColorPicker, COLORS_ENTITY } from '../../components/inputs';
import Spinner from '../../components/ui/Spinner';
import type { Project, ProjectTeam, CreateProjectInput, ProjectStatus } from '../../types';


const STATUS_CONFIG: Record< ProjectStatus, { label: string; color: string } > = {
	active:    { label: 'Active',    color: '#10b981' },
	completed: { label: 'Completed', color: '#3b82f6' },
	archived:  { label: 'Archived',  color: '#94a3b8' },
};

const STATUS_ORDER: ProjectStatus[] = [ 'active', 'completed', 'archived' ];

const emptyForm = (): CreateProjectInput => ( {
	workspace_id: 0,
	team_ids:     [],
	name:         '',
	description:  '',
	color:        '#6366f1',
	label_ids:    [],
} );

/* ---- Sortable row ---- */
const SortableRow = ( {
	project,
	checked,
	onSelect,
	statusMenuId,
	onStatusMenu,
	onChangeStatus,
	onEdit,
	onDelete,
	onNavigate,
}: {
	project:       Project;
	checked:       boolean;
	onSelect:      ( id: number ) => void;
	statusMenuId:  number | null;
	onStatusMenu:  ( id: number | null ) => void;
	onChangeStatus: ( p: Project, s: ProjectStatus ) => void;
	onEdit:        ( p: Project ) => void;
	onDelete:      ( p: Project ) => void;
	onNavigate:    ( id: number ) => void;
} ) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable( { id: project.id } );

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity:   isDragging ? 0.35 : 1,
		position:  'relative',
		zIndex:    isDragging ? 1 : 'auto',
	};

	const status    = ( project.status ?? 'active' ) as ProjectStatus;
	const statusCfg = STATUS_CONFIG[ status ];

	return (
		<tr
			ref={ setNodeRef }
			style={ style }
			{ ...attributes }
			className={ `st-todox-table__row st-todox-table__row--clickable ${ isDragging ? 'st-todox-table__row--dragging' : '' } ${ checked ? 'st-todox-table__row--selected' : '' }` }
			onClick={ () => onNavigate( project.id ) }
		>
			<td className="st-todox-table__drag-cell" onClick={ ( e ) => e.stopPropagation() }>
				<span className="st-todox-table__drag-handle" { ...listeners }>
					<GripVertical size={ 14 } />
				</span>
			</td>
			<td className="st-todox-table__check-cell" onClick={ ( e ) => e.stopPropagation() }>
				<input type="checkbox" checked={ checked } onChange={ () => onSelect( project.id ) } />
			</td>
			<td className="st-todox-table__title-cell">
				<div className="st-todox-entity-name">
					<span className="st-todox-entity-name__dot" style={ { background: project.color } } />
					<span className="st-todox-entity-name__text">{ project.name }</span>
				</div>
			</td>
			<td>
				{ project.teams && project.teams.length > 0 ? (
					<span className="st-todox-text--muted">
						{ project.teams.map( ( t: ProjectTeam, i: number ) => (
							<span key={ t.id }>
								{ i > 0 && <span style={ { margin: '0 4px', opacity: 0.4 } }>·</span> }
								<span style={ { display: 'inline-flex', alignItems: 'center', gap: 4 } }>
									<span style={ { width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0, display: 'inline-block' } } />
									{ t.name }
								</span>
							</span>
						) ) }
					</span>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>
			<td onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-entity-status-wrap">
					<button
						className="st-todox-entity-status-badge"
						style={ { background: statusCfg.color + '20', color: statusCfg.color, borderColor: statusCfg.color + '44' } }
						onClick={ () => onStatusMenu( statusMenuId === project.id ? null : project.id ) }
					>
						{ statusCfg.label }
					</button>
					{ statusMenuId === project.id && (
						<>
							<div className="st-todox-dropdown-backdrop" onClick={ () => onStatusMenu( null ) } />
							<div className="st-todox-entity-card__menu-dropdown">
								<div className="st-todox-dropdown-section-label">Set status</div>
								{ STATUS_ORDER.map( ( s ) => (
									<button
										key={ s }
										className={ status === s ? 'st-todox-dropdown-status-current' : '' }
										onClick={ () => onChangeStatus( project, s ) }
									>
										<span className="st-todox-dropdown-status-dot" style={ { background: STATUS_CONFIG[ s ].color } } />
										{ STATUS_CONFIG[ s ].label }
										{ status === s && <Check size={ 11 } className="st-todox-dropdown-status-check" /> }
									</button>
								) ) }
							</div>
						</>
					) }
				</div>
			</td>
			<td>
				{ project.description ? (
					<span className="st-todox-text--muted st-todox-table__cell-truncate">{ project.description }</span>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>
			<td>
				<div className="st-todox-entity-count">
					<Zap size={ 12 } />
					{ project.sprints_count ?? 0 }
				</div>
			</td>
			<td className="st-todox-table__actions-cell" onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-table__row-actions">
					<button className="st-todox-table__action-btn" title="Edit" onClick={ () => onEdit( project ) }>
						<Pencil size={ 13 } />
					</button>
					<button className="st-todox-table__action-btn st-todox-table__action-btn--danger" title="Delete" onClick={ () => onDelete( project ) }>
						<Trash2 size={ 13 } />
					</button>
					<ChevronRight size={ 13 } className="st-todox-table__row-chevron" />
				</div>
			</td>
		</tr>
	);
};

const EMPTY_PROJECTS: Project[] = [];

const ProjectsPage = () => {
	const navigate = useNavigate();
	const qc       = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();

	const [ modalOpen, setModalOpen ]       = useState( false );
	const [ editing, setEditing ]           = useState< Project | null >( null );
	const [ deleteTarget, setDeleteTarget ] = useState< Project | null >( null );
	const [ statusMenuId, setStatusMenuId ] = useState< number | null >( null );
	const [ form, setForm ]                 = useState< CreateProjectInput >( emptyForm() );
	const [ search, setSearch ]             = useState( '' );
	const [ statusFilter, setStatusFilter ] = useState< ProjectStatus | 'all' >( 'all' );
	const [ ordered, setOrdered ]           = useState< Project[] >( [] );
	const [ activeDrag, setActiveDrag ]     = useState< Project | null >( null );
	const [ selectedIds, setSelectedIds ]   = useState< Set< number > >( new Set() );
	const [ bulkStatus, setBulkStatus ]     = useState< ProjectStatus >( 'active' );
	const [ bulkConfirmOpen, setBulkConfirmOpen ] = useState( false );
	const selectAllRef                      = useRef< HTMLInputElement >( null );

	const { data: projects = EMPTY_PROJECTS, isLoading } = useQuery( {
		queryKey: [ 'projects', activeWorkspaceId ],
		queryFn:  () => projectsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const { data: teams = [] } = useQuery( {
		queryKey: [ 'teams', activeWorkspaceId ],
		queryFn:  () => teamsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	useEffect( () => {
		setOrdered( projects as Project[] );
	}, [ projects ] );

	const filtered = useMemo( () => {
		let list = ordered;
		if ( statusFilter !== 'all' ) {
			list = list.filter( ( p ) => ( p.status ?? 'active' ) === statusFilter );
		}
		const q = search.trim().toLowerCase();
		if ( q ) {
			list = list.filter( ( p ) => p.name.toLowerCase().includes( q ) );
		}
		return list;
	}, [ ordered, statusFilter, search ] );

	const countByStatus = ( s: ProjectStatus | 'all' ) => {
		const list = projects as Project[];
		return s === 'all' ? list.length : list.filter( ( p ) => ( p.status ?? 'active' ) === s ).length;
	};

	const allSelected  = filtered.length > 0 && filtered.every( ( p ) => selectedIds.has( p.id ) );
	const someSelected = ! allSelected && filtered.some( ( p ) => selectedIds.has( p.id ) );

	useEffect( () => {
		if ( selectAllRef.current ) selectAllRef.current.indeterminate = someSelected;
	}, [ someSelected ] );

	const toggleSelect = ( id: number ) =>
		setSelectedIds( ( prev ) => { const s = new Set( prev ); s.has( id ) ? s.delete( id ) : s.add( id ); return s; } );

	const toggleAll = () =>
		setSelectedIds( allSelected ? new Set() : new Set( filtered.map( ( p ) => p.id ) ) );

	const invalidate = () => qc.invalidateQueries( { queryKey: [ 'projects', activeWorkspaceId ] } );

	const createMutation = useMutation( {
		mutationFn: ( data: CreateProjectInput ) => projectsApi.create( data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Project created.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateProjectInput > } ) =>
			projectsApi.update( id, data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Project updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => projectsApi.delete( id ),
		onSuccess:  () => { invalidate(); setDeleteTarget( null ); toast.success( 'Project deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const bulkDeleteMutation = useMutation( {
		mutationFn: ( ids: number[] ) => Promise.all( ids.map( ( id ) => projectsApi.delete( id ) ) ),
		onSuccess:  () => { invalidate(); setSelectedIds( new Set() ); toast.success( 'Projects deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const bulkStatusMutation = useMutation( {
		mutationFn: ( { ids, status }: { ids: number[]; status: ProjectStatus } ) =>
			Promise.all( ids.map( ( id ) => projectsApi.update( id, { status } ) ) ),
		onSuccess:  () => { invalidate(); setSelectedIds( new Set() ); toast.success( 'Status updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const statusMutation = useMutation( {
		mutationFn: ( { id, status }: { id: number; status: ProjectStatus } ) =>
			projectsApi.update( id, { status } ),
		onSuccess:  () => { invalidate(); toast.success( 'Status updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const reorderMutation = useMutation( {
		mutationFn: ( items: { id: number; position: number }[] ) => projectsApi.reorder( items ),
		onError:    ( err: Error ) => {
			toast.error( err.message );
			setOrdered( projects as Project[] );
		},
	} );

	const sensors = useSensors( useSensor( PointerSensor, { activationConstraint: { distance: 5 } } ) );

	const handleDragStart = ( event: DragStartEvent ) => {
		setActiveDrag( ordered.find( ( p ) => p.id === event.active.id ) ?? null );
	};

	const handleDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		setActiveDrag( null );
		if ( ! over || active.id === over.id ) return;

		setOrdered( ( prev ) => {
			const oldIdx    = prev.findIndex( ( p ) => p.id === active.id );
			const newIdx    = prev.findIndex( ( p ) => p.id === over.id );
			const reordered = arrayMove( prev, oldIdx, newIdx );
			reorderMutation.mutate( reordered.map( ( p, i ) => ( { id: p.id, position: i } ) ) );
			return reordered;
		} );
	};

	const changeStatus = ( project: Project, status: ProjectStatus ) => {
		setStatusMenuId( null );
		statusMutation.mutate( { id: project.id, status } );
	};

	const openCreate = () => {
		setEditing( null );
		setForm( { ...emptyForm(), workspace_id: activeWorkspaceId! } );
		setModalOpen( true );
	};

	const openEdit = ( project: Project ) => {
		setEditing( project );
		setForm( {
			workspace_id: project.workspace_id,
			team_ids:     project.team_ids ?? [],
			name:         project.name,
			description:  project.description ?? '',
			color:        project.color,
			label_ids:    ( ( project as { labels?: { id: number }[] } ).labels ?? [] ).map( ( l ) => l.id ),
		} );
		setModalOpen( true );
	};

	const handleClose = () => { setModalOpen( false ); setEditing( null ); setForm( emptyForm() ); };


	const doSubmit = () => {
		if ( ! form.name.trim() ) { toast.error( 'Name is required.' ); return; }
		if ( ! form.team_ids || form.team_ids.length === 0 ) { toast.error( 'At least one team is required.' ); return; }
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
				title="Projects"
				description={ `${ activeWorkspace?.name } · ${ ( projects as Project[] ).length } project${ ( projects as Project[] ).length !== 1 ? 's' : '' }` }
				actions={
					activeWorkspaceId ? (
						<Button onClick={ openCreate } leftIcon={ <Plus size={ 14 } /> }>
							New Project
						</Button>
					) : undefined
				}
			/>

			{/* Status filter pills */}
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

			<div className="st-todox-surface-card">
				{/* Toolbar */}
				<div className="st-todox-tasks-toolbar">
					<div className="st-todox-tasks-toolbar__search">
						<Search size={ 14 } className="st-todox-tasks-toolbar__search-icon" />
						<input
							type="search"
							className="st-todox-tasks-toolbar__input"
							placeholder="Search projects…"
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

				{ isLoading ? (
					<div className="st-todox-page-loader"><Spinner /></div>
				) : ( projects as Project[] ).length === 0 ? (
					<div className="st-todox-empty-inline">
						<FolderKanban size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>No projects yet — create your first one.</p>
						{ teams.length > 0 ? (
							activeWorkspaceId && (
								<Button size="sm" onClick={ openCreate } leftIcon={ <Plus size={ 13 } /> }>
									New Project
								</Button>
							)
						) : (
							<button className="st-todox-link-btn" onClick={ () => navigate( '/departments' ) }>
								Create a team first →
							</button>
						) }
					</div>
				) : filtered.length === 0 ? (
					<div className="st-todox-empty-inline">
						<FolderKanban size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>No projects match your filters.</p>
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
										onChange={ ( e ) => setBulkStatus( e.target.value as ProjectStatus ) }
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
										<th style={ { width: '24%' } }>Name</th>
										<th>Team</th>
										<th style={ { width: 110 } }>Status</th>
										<th>Description</th>
										<th style={ { width: 80 } }>Sprints</th>
										<th style={ { width: 80 } } />
									</tr>
								</thead>
								<SortableContext items={ filtered.map( ( p ) => p.id ) } strategy={ verticalListSortingStrategy }>
									<tbody>
										{ filtered.map( ( project ) => (
											<SortableRow
												key={ project.id }
												project={ project }
												checked={ selectedIds.has( project.id ) }
												onSelect={ toggleSelect }
												statusMenuId={ statusMenuId }
												onStatusMenu={ setStatusMenuId }
												onChangeStatus={ changeStatus }
												onEdit={ openEdit }
												onDelete={ setDeleteTarget }
												onNavigate={ ( id ) => navigate( `/projects/${ id }` ) }
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

			<Modal isOpen={ modalOpen } onClose={ handleClose } title={ editing ? 'Edit Project' : 'New Project' } size="sm"
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
						<input type="text" className="st-todox-form__input" placeholder="Project name"
							value={ form.name } onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) } autoFocus />
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Teams <span className="st-todox-form__required">*</span></label>
						<DepartmentSelector
							departments={ teams }
							selectedIds={ form.team_ids ?? [] }
							onChange={ ( ids ) => setForm( { ...form, team_ids: ids } ) }
						/>
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
					{ activeWorkspaceId && (
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">Labels</label>
							<LabelSelector
								workspaceId={ activeWorkspaceId }
								labelType="project_label"
								selectedIds={ form.label_ids || [] }
								onChange={ ( ids ) => setForm( { ...form, label_ids: ids } ) }
							/>
						</div>
					) }
				</form>
			</Modal>

			<ConfirmDialog isOpen={ !! deleteTarget } onClose={ () => setDeleteTarget( null ) }
				onConfirm={ () => deleteTarget && deleteMutation.mutate( deleteTarget.id ) }
				title="Delete Project" message={ `Delete "${ deleteTarget?.name }"? This cannot be undone.` }
				confirmLabel="Delete" loading={ deleteMutation.isPending } />

			<ConfirmDialog
				isOpen={ bulkConfirmOpen }
				onClose={ () => setBulkConfirmOpen( false ) }
				onConfirm={ () => { setBulkConfirmOpen( false ); bulkDeleteMutation.mutate( [ ...selectedIds ] ); } }
				title={ `Delete ${ selectedIds.size } Project${ selectedIds.size !== 1 ? 's' : '' }?` }
				message="This will permanently delete the selected projects and all their sprints. This cannot be undone."
				confirmLabel="Delete All"
				loading={ bulkDeleteMutation.isPending }
			/>
		</div>
	);
};

export default ProjectsPage;
