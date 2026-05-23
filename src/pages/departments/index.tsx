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
import { Building2, Briefcase, Pencil, Trash2, Plus, Search, GripVertical } from 'lucide-react';

/**
 * Internal dependencies
 */
import { departmentsApi, usersApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { ColorPicker, COLORS_ENTITY } from '../../components/inputs';
import type { Department, CreateDepartmentInput } from '../../types';

const emptyForm = (): CreateDepartmentInput => ( {
	workspace_id: 0,
	name:         '',
	description:  '',
	color:        '#6366f1',
	head_id:      null,
} );

/* ---- Sortable row ---- */
const SortableRow = ( {
	dept,
	checked,
	onSelect,
	onEdit,
	onDelete,
}: {
	dept:     Department;
	checked:  boolean;
	onSelect: ( id: number ) => void;
	onEdit:   ( d: Department ) => void;
	onDelete: ( d: Department ) => void;
} ) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable( { id: dept.id } );

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
				<input type="checkbox" checked={ checked } onChange={ () => onSelect( dept.id ) } />
			</td>
			<td className="st-todox-table__title-cell">
				<div className="st-todox-entity-name">
					<span className="st-todox-entity-name__dot" style={ { background: dept.color } } />
					<span className="st-todox-entity-name__text">{ dept.name }</span>
				</div>
			</td>
			<td>
				{ dept.description ? (
					<span className="st-todox-text--muted st-todox-table__cell-truncate">{ dept.description }</span>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>
			<td>
				{ dept.head ? (
					<div className="st-todox-assignee">
						<Avatar name={ dept.head.name } src={ dept.head.avatar } size={ 22 } />
						<span className="st-todox-assignee__name">{ dept.head.name }</span>
					</div>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>
			<td>
				<div className="st-todox-entity-count">
					<Briefcase size={ 12 } />
					{ dept.teams_count ?? 0 }
				</div>
			</td>
			<td className="st-todox-table__actions-cell" onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-table__row-actions">
					<button className="st-todox-table__action-btn" title="Edit" onClick={ () => onEdit( dept ) }>
						<Pencil size={ 13 } />
					</button>
					<button className="st-todox-table__action-btn st-todox-table__action-btn--danger" title="Delete" onClick={ () => onDelete( dept ) }>
						<Trash2 size={ 13 } />
					</button>
				</div>
			</td>
		</tr>
	);
};

const EMPTY_DEPTS: Department[] = [];

const DepartmentsPage = () => {
	const qc = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();

	const [ modalOpen, setModalOpen ]       = useState( false );
	const [ editing, setEditing ]           = useState< Department | null >( null );
	const [ deleteTarget, setDeleteTarget ] = useState< Department | null >( null );
	const [ form, setForm ]                 = useState< CreateDepartmentInput >( emptyForm() );
	const [ search, setSearch ]             = useState( '' );
	const [ ordered, setOrdered ]           = useState< Department[] >( [] );
	const [ activeDrag, setActiveDrag ]     = useState< Department | null >( null );
	const [ selectedIds, setSelectedIds ]   = useState< Set< number > >( new Set() );
	const [ bulkConfirmOpen, setBulkConfirmOpen ] = useState( false );
	const selectAllRef                      = useRef< HTMLInputElement >( null );

	const { data: departments = EMPTY_DEPTS, isLoading } = useQuery( {
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

	useEffect( () => {
		setOrdered( departments as Department[] );
	}, [ departments ] );

	const filtered = useMemo( () => {
		const q = search.trim().toLowerCase();
		if ( ! q ) return ordered;
		return ordered.filter( ( d ) => d.name.toLowerCase().includes( q ) );
	}, [ ordered, search ] );

	const allSelected  = filtered.length > 0 && filtered.every( ( d ) => selectedIds.has( d.id ) );
	const someSelected = ! allSelected && filtered.some( ( d ) => selectedIds.has( d.id ) );

	useEffect( () => {
		if ( selectAllRef.current ) selectAllRef.current.indeterminate = someSelected;
	}, [ someSelected ] );

	const toggleSelect = ( id: number ) =>
		setSelectedIds( ( prev ) => { const s = new Set( prev ); s.has( id ) ? s.delete( id ) : s.add( id ); return s; } );

	const toggleAll = () =>
		setSelectedIds( allSelected ? new Set() : new Set( filtered.map( ( d ) => d.id ) ) );

	const invalidate = () => qc.invalidateQueries( { queryKey: [ 'departments', activeWorkspaceId ] } );

	const createMutation = useMutation( {
		mutationFn: ( data: CreateDepartmentInput ) => departmentsApi.create( data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Department created.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateDepartmentInput > } ) =>
			departmentsApi.update( id, data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Department updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => departmentsApi.delete( id ),
		onSuccess:  () => { invalidate(); setDeleteTarget( null ); toast.success( 'Department deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const bulkDeleteMutation = useMutation( {
		mutationFn: ( ids: number[] ) => Promise.all( ids.map( ( id ) => departmentsApi.delete( id ) ) ),
		onSuccess:  () => { invalidate(); setSelectedIds( new Set() ); toast.success( 'Departments deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const reorderMutation = useMutation( {
		mutationFn: ( items: { id: number; position: number }[] ) => departmentsApi.reorder( items ),
		onError:    ( err: Error ) => {
			toast.error( err.message );
			setOrdered( departments as Department[] );
		},
	} );

	const sensors = useSensors( useSensor( PointerSensor, { activationConstraint: { distance: 5 } } ) );

	const handleDragStart = ( event: DragStartEvent ) => {
		setActiveDrag( ordered.find( ( d ) => d.id === event.active.id ) ?? null );
	};

	const handleDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		setActiveDrag( null );
		if ( ! over || active.id === over.id ) return;

		setOrdered( ( prev ) => {
			const oldIdx    = prev.findIndex( ( d ) => d.id === active.id );
			const newIdx    = prev.findIndex( ( d ) => d.id === over.id );
			const reordered = arrayMove( prev, oldIdx, newIdx );
			reorderMutation.mutate( reordered.map( ( d, i ) => ( { id: d.id, position: i } ) ) );
			return reordered;
		} );
	};

	const openCreate = () => {
		setEditing( null );
		setForm( { ...emptyForm(), workspace_id: activeWorkspaceId! } );
		setModalOpen( true );
	};

	const openEdit = ( dept: Department ) => {
		setEditing( dept );
		setForm( {
			workspace_id: dept.workspace_id,
			name:         dept.name,
			description:  dept.description ?? '',
			color:        dept.color,
			head_id:      dept.head_id,
		} );
		setModalOpen( true );
	};

	const handleClose = () => {
		setModalOpen( false );
		setEditing( null );
		setForm( emptyForm() );
	};

	const doSubmit = () => {
		if ( ! form.name.trim() ) { toast.error( 'Name is required.' ); return; }
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
				title="Departments"
				description={ `${ activeWorkspace?.name } · ${ ( departments as Department[] ).length } department${ ( departments as Department[] ).length !== 1 ? 's' : '' }` }
				actions={
					activeWorkspaceId ? (
						<Button onClick={ openCreate } leftIcon={ <Plus size={ 14 } /> }>
							New Department
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
							placeholder="Search departments…"
							value={ search }
							onChange={ ( e ) => setSearch( e.target.value ) }
						/>
					</div>
				</div>

				{ isLoading ? (
					<div className="st-todox-page-loader"><Spinner /></div>
				) : ( departments as Department[] ).length === 0 ? (
					<div className="st-todox-empty-inline">
						<Building2 size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>No departments yet — create your first one.</p>
						{ activeWorkspaceId && (
							<Button size="sm" onClick={ openCreate } leftIcon={ <Plus size={ 13 } /> }>
								New Department
							</Button>
						) }
					</div>
				) : filtered.length === 0 ? (
					<div className="st-todox-empty-inline">
						<Building2 size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>No departments match your search.</p>
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
										<th style={ { width: '28%' } }>Name</th>
										<th>Description</th>
										<th>Head</th>
										<th style={ { width: 80 } }>Teams</th>
										<th style={ { width: 80 } } />
									</tr>
								</thead>
								<SortableContext items={ filtered.map( ( d ) => d.id ) } strategy={ verticalListSortingStrategy }>
									<tbody>
										{ filtered.map( ( dept ) => (
											<SortableRow
												key={ dept.id }
												dept={ dept }
												checked={ selectedIds.has( dept.id ) }
												onSelect={ toggleSelect }
												onEdit={ openEdit }
												onDelete={ setDeleteTarget }
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
				title={ editing ? 'Edit Department' : 'New Department' }
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
						<input
							type="text"
							className="st-todox-form__input"
							placeholder="Department name"
							value={ form.name }
							onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) }
							autoFocus
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Description</label>
						<textarea
							className="st-todox-form__textarea"
							rows={ 2 }
							placeholder="Optional description"
							value={ form.description ?? '' }
							onChange={ ( e ) => setForm( { ...form, description: e.target.value } ) }
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Head (optional)</label>
						<select
							className="st-todox-form__select"
							value={ form.head_id ?? '' }
							onChange={ ( e ) => setForm( { ...form, head_id: e.target.value ? Number( e.target.value ) : null } ) }
						>
							<option value="">— None —</option>
							{ users.map( ( u ) => (
								<option key={ u.id } value={ u.id }>{ u.name }</option>
							) ) }
						</select>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Color</label>
						<ColorPicker colors={ COLORS_ENTITY } value={ form.color } onChange={ ( c ) => setForm( { ...form, color: c } ) } />
					</div>
				</form>
			</Modal>

			<ConfirmDialog
				isOpen={ !! deleteTarget }
				onClose={ () => setDeleteTarget( null ) }
				onConfirm={ () => deleteTarget && deleteMutation.mutate( deleteTarget.id ) }
				title="Delete Department"
				message={ `Delete "${ deleteTarget?.name }"? Teams in this department will lose their department link.` }
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
			/>

			<ConfirmDialog
				isOpen={ bulkConfirmOpen }
				onClose={ () => setBulkConfirmOpen( false ) }
				onConfirm={ () => { setBulkConfirmOpen( false ); bulkDeleteMutation.mutate( [ ...selectedIds ] ); } }
				title={ `Delete ${ selectedIds.size } Department${ selectedIds.size !== 1 ? 's' : '' }?` }
				message="This will permanently delete the selected departments. Teams inside them will lose their department link."
				confirmLabel="Delete All"
				loading={ bulkDeleteMutation.isPending }
			/>
		</div>
	);
};

export default DepartmentsPage;
