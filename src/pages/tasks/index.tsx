/**
 * External dependencies
 */
import { useState, useEffect, useRef, useMemo } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
	CheckSquare,
	Plus,
	AlertCircle,
	Calendar,
	Trash2,
	Search,
	ChevronRight,
	ChevronDown,
	GripVertical,
	Pencil,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { tasksApi, usersApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useDebounce } from '../../hooks/useDebounce';
import { useTaskStatuses } from '../../hooks/useTaskStatuses';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import CreateTaskModal from '../../components/features/task/CreateTaskModal';
import InlineTaskInput from '../../components/features/task/InlineTaskInput';
import TaskDetailModal from '../../components/features/task/TaskDetailModal';
import ViewSwitcher from '../../components/features/task/ViewSwitcher';
import { formatDate, isOverdue } from '../../utils/helpers';
import type { Task, TaskPriority, TaskStatus, User } from '../../types';

type TaskStatusOption = { value: string; label: string; color: string; id: number | null };

/* ---- Sortable Task Row ---- */
const SortableTaskRow = ( {
	task,
	checked,
	taskStatuses,
	users,
	onSelect,
	onNavigate,
	onDelete,
	onStatusChange,
	onPriorityChange,
	onAssigneeChange,
	onDueDateChange,
}: {
	task:             Task;
	checked:          boolean;
	taskStatuses:     TaskStatusOption[];
	users:            User[];
	onSelect:         ( id: number ) => void;
	onNavigate:       ( id: number ) => void;
	onDelete:         ( id: number ) => void;
	onStatusChange:   ( id: number, status: TaskStatus ) => void;
	onPriorityChange: ( id: number, priority: TaskPriority ) => void;
	onAssigneeChange: ( id: number, assigneeId: number | null ) => void;
	onDueDateChange:  ( id: number, dueDate: string | null ) => void;
} ) => {
	const [ statusOpen, setStatusOpen ]       = useState( false );
	const [ priorityOpen, setPriorityOpen ]   = useState( false );
	const [ assigneeOpen, setAssigneeOpen ]   = useState( false );
	const [ dueDateEditing, setDueDateEditing ] = useState( false );

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: task.id } );

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity: isDragging ? 0.35 : 1,
		position: 'relative',
		zIndex: isDragging ? 1 : 'auto',
	};

	const overdue = isOverdue( task.due_date );

	return (
		<tr
			ref={ setNodeRef }
			style={ style }
			{ ...attributes }
			className={ `st-todox-table__row ${ overdue ? 'st-todox-table__row--overdue' : '' } ${ isDragging ? 'st-todox-table__row--dragging' : '' } ${ checked ? 'st-todox-table__row--selected' : '' }` }
			onClick={ () => onNavigate( task.id ) }
		>
			{/* Drag handle */}
			<td
				className="st-todox-table__drag-cell"
				onClick={ ( e ) => e.stopPropagation() }
			>
				<span className="st-todox-table__drag-handle" { ...listeners }>
					<GripVertical size={ 14 } />
				</span>
			</td>

			{/* Checkbox */}
			<td className="st-todox-table__check-cell" onClick={ ( e ) => e.stopPropagation() }>
				<input type="checkbox" checked={ checked } onChange={ () => onSelect( task.id ) } />
			</td>

			{/* Title + labels */}
			<td className="st-todox-table__title-cell">
				<div className="st-todox-table__title">{ task.title }</div>
				{ ( task.labels?.length ?? 0 ) > 0 && (
					<div className="st-todox-table__labels">
						{ task.labels.map( ( l ) => (
							<span
								key={ l.id }
								className="st-todox-table__label"
								style={ { background: l.color + '22', color: l.color, borderColor: l.color + '44' } }
							>
								{ l.name }
							</span>
						) ) }
					</div>
				) }
			</td>

			{/* Status inline picker */}
			<td onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-inline-picker">
					<button
						className="st-todox-inline-picker__trigger"
						onClick={ () => setStatusOpen( ( v ) => ! v ) }
						title="Change status"
					>
						<StatusBadge status={ task.status } />
						<ChevronDown size={ 10 } className="st-todox-inline-picker__chevron" />
					</button>
					{ statusOpen && (
						<>
							<div className="st-todox-inline-picker__backdrop" onClick={ () => setStatusOpen( false ) } />
							<div className="st-todox-inline-picker__menu">
								{ taskStatuses.map( ( s ) => (
									<button
										key={ s.value }
										className={ `st-todox-inline-picker__item ${ task.status === s.value ? 'st-todox-inline-picker__item--active' : '' }` }
										onClick={ () => { onStatusChange( task.id, s.value as TaskStatus ); setStatusOpen( false ); } }
									>
										<StatusBadge status={ s.value as TaskStatus } />
									</button>
								) ) }
							</div>
						</>
					) }
				</div>
			</td>

			{/* Priority inline picker */}
			<td onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-inline-picker">
					<button
						className="st-todox-inline-picker__trigger"
						onClick={ () => setPriorityOpen( ( v ) => ! v ) }
						title="Change priority"
					>
						<PriorityBadge priority={ task.priority } />
						<ChevronDown size={ 10 } className="st-todox-inline-picker__chevron" />
					</button>
					{ priorityOpen && (
						<>
							<div className="st-todox-inline-picker__backdrop" onClick={ () => setPriorityOpen( false ) } />
							<div className="st-todox-inline-picker__menu">
								{ ( [ 'low', 'medium', 'high', 'urgent' ] as TaskPriority[] ).map( ( p ) => (
									<button
										key={ p }
										className={ `st-todox-inline-picker__item ${ task.priority === p ? 'st-todox-inline-picker__item--active' : '' }` }
										onClick={ () => { onPriorityChange( task.id, p ); setPriorityOpen( false ); } }
									>
										<PriorityBadge priority={ p } />
									</button>
								) ) }
							</div>
						</>
					) }
				</div>
			</td>

			{/* Assignee inline picker */}
			<td onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-inline-picker">
					<button
						className="st-todox-inline-picker__trigger"
						onClick={ () => setAssigneeOpen( ( v ) => ! v ) }
						title="Change assignee"
					>
						{ task.assignee ? (
							<div className="st-todox-assignee">
								<Avatar name={ task.assignee.name } src={ task.assignee.avatar } size={ 18 } />
								<span className="st-todox-assignee__name">{ task.assignee.name }</span>
							</div>
						) : (
							<span className="st-todox-text--muted">—</span>
						) }
						<ChevronDown size={ 10 } className="st-todox-inline-picker__chevron" />
					</button>
					{ assigneeOpen && (
						<>
							<div className="st-todox-inline-picker__backdrop" onClick={ () => setAssigneeOpen( false ) } />
							<div className="st-todox-inline-picker__menu">
								<button
									className={ `st-todox-inline-picker__item ${ ! task.assignee_id ? 'st-todox-inline-picker__item--active' : '' }` }
									onClick={ () => { onAssigneeChange( task.id, null ); setAssigneeOpen( false ); } }
								>
									<span style={ { width: 16, height: 16, borderRadius: '50%', border: '1.5px dashed #94a3b8', display: 'inline-block', flexShrink: 0 } } />
									Unassigned
								</button>
								{ users.map( ( u ) => (
									<button
										key={ u.id }
										className={ `st-todox-inline-picker__item ${ task.assignee_id === u.id ? 'st-todox-inline-picker__item--active' : '' }` }
										onClick={ () => { onAssigneeChange( task.id, u.id ); setAssigneeOpen( false ); } }
									>
										<Avatar name={ u.name } src={ u.avatar } size={ 16 } />
										{ u.name }
									</button>
								) ) }
							</div>
						</>
					) }
				</div>
			</td>

			{/* Due date inline picker */}
			<td onClick={ ( e ) => e.stopPropagation() }>
				{ dueDateEditing ? (
					<input
						type="date"
						className="st-todox-form__input st-todox-td-meta-date-input"
						defaultValue={ task.due_date ?? '' }
						autoFocus
						onChange={ ( e ) => {
							onDueDateChange( task.id, e.target.value || null );
							setDueDateEditing( false );
						} }
						onBlur={ () => setDueDateEditing( false ) }
						onKeyDown={ ( e ) => { if ( e.key === 'Escape' ) setDueDateEditing( false ); } }
					/>
				) : (
					<button
						className="st-todox-inline-picker__trigger"
						onClick={ () => setDueDateEditing( true ) }
						title="Set due date"
					>
						{ task.due_date ? (
							<span className={ `st-todox-table__due ${ overdue ? 'st-todox-table__due--overdue' : '' }` }>
								<Calendar size={ 12 } />
								{ formatDate( task.due_date ) }
							</span>
						) : (
							<span className="st-todox-text--muted">—</span>
						) }
						<Pencil size={ 10 } className="st-todox-inline-picker__chevron" />
					</button>
				) }
			</td>

			{/* Row actions */}
			<td
				className="st-todox-table__actions-cell"
				onClick={ ( e ) => e.stopPropagation() }
			>
				<div className="st-todox-table__row-actions">
					<button
						className="st-todox-table__action-btn st-todox-table__action-btn--danger"
						title="Delete task"
						onClick={ () => onDelete( task.id ) }
					>
						<Trash2 size={ 13 } />
					</button>
					<ChevronRight size={ 13 } className="st-todox-table__row-chevron" />
				</div>
			</td>
		</tr>
	);
};

/* ---- Drag overlay pill shown while dragging ---- */
const DragOverlayRow = ( { task }: { task: Task } ) => (
	<div className="st-todox-table__drag-overlay">
		<GripVertical size={ 14 } className="st-todox-table__drag-overlay-grip" />
		<span className="st-todox-table__drag-overlay-title">{ task.title }</span>
		<StatusBadge status={ task.status } />
		<PriorityBadge priority={ task.priority } />
	</div>
);

const TasksPage = () => {
	const [ searchParams ] = useSearchParams();
	const qc               = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();
	const { statuses: taskStatuses } = useTaskStatuses();

	const [ createOpen, setCreateOpen ] = useState( false );
	const [ deleteId, setDeleteId ]               = useState<number | null>( null );
	const [ selectedTaskId, setSelectedTaskId ]   = useState<number | null>( null );
	const [ search, setSearch ]               = useState( searchParams.get( 'search' ) ?? '' );
	const [ activeFilter, setFilter ]         = useState<TaskStatus | null>(
		( searchParams.get( 'status' ) as TaskStatus ) ?? null
	);
	const [ priorityFilter, setPriority ]     = useState<TaskPriority | ''>( '' );
	const [ orderedTasks, setOrderedTasks ]   = useState<Task[]>( [] );
	const [ activeTask, setActiveTask ]       = useState<Task | null>( null );
	const [ selectedIds, setSelectedIds ]     = useState< Set<number> >( new Set() );
	const [ bulkConfirmOpen, setBulkConfirmOpen ] = useState( false );
	const selectAllRef                        = useRef< HTMLInputElement >( null );

	const debouncedSearch = useDebounce( search, 400 );

	const { data, isLoading, isError, error } = useQuery( {
		queryKey: [ 'tasks', activeWorkspaceId, debouncedSearch, activeFilter, priorityFilter ],
		queryFn:  () => tasksApi.getAll( {
			workspace_id: activeWorkspaceId!,
			search:   debouncedSearch,
			status:   activeFilter ?? undefined,
			priority: priorityFilter || undefined,
			per_page: 50,
		} ),
		enabled: !! activeWorkspaceId,
	} );

	// Keep local ordered list in sync with server data
	useEffect( () => {
		setOrderedTasks( data?.items ?? [] );
	}, [ data ] );

	const total = data?.total ?? 0;

	const { data: countData } = useQuery( {
		queryKey: [ 'tasks', 'counts', activeWorkspaceId ],
		queryFn:  () => tasksApi.getAll( { workspace_id: activeWorkspaceId!, per_page: 1000 } ),
		enabled:  !! activeWorkspaceId,
		staleTime: 30_000,
	} );

	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'workspace', activeWorkspaceId ],
		queryFn:  () => usersApi.getAll( { workspace_id: activeWorkspaceId!, per_page: 100 } ),
		enabled:  !! activeWorkspaceId,
		staleTime: 60_000,
	} );
	const users = usersData?.items ?? [];
	const allTasks      = countData?.items ?? [];
	const countByStatus = ( f: string | null ) =>
		f ? allTasks.filter( ( t: Task ) => t.status === f ).length : allTasks.length;
	const overdueCount  = allTasks.filter(
		( t: Task ) => isOverdue( t.due_date ) && t.status !== 'completed'
	).length;

	const allSelected  = useMemo(
		() => orderedTasks.length > 0 && orderedTasks.every( ( t ) => selectedIds.has( t.id ) ),
		[ orderedTasks, selectedIds ]
	);
	const someSelected = useMemo(
		() => ! allSelected && orderedTasks.some( ( t ) => selectedIds.has( t.id ) ),
		[ orderedTasks, selectedIds, allSelected ]
	);

	useEffect( () => {
		if ( selectAllRef.current ) selectAllRef.current.indeterminate = someSelected;
	}, [ someSelected ] );

	const toggleSelect = ( id: number ) =>
		setSelectedIds( ( prev ) => { const s = new Set( prev ); s.has( id ) ? s.delete( id ) : s.add( id ); return s; } );

	const toggleAll = () =>
		setSelectedIds( allSelected ? new Set() : new Set( orderedTasks.map( ( t ) => t.id ) ) );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => tasksApi.delete( id ),
		onSuccess:  () => {
			qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
			toast.success( 'Task deleted.' );
			setDeleteId( null );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial<Task> } ) =>
			tasksApi.update( id, data ),
		onSuccess: () => qc.invalidateQueries( { queryKey: [ 'tasks' ] } ),
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	const handleStatusChange = ( id: number, status: TaskStatus ) =>
		updateMutation.mutate( { id, data: { status } } );

	const handlePriorityChange = ( id: number, priority: TaskPriority ) =>
		updateMutation.mutate( { id, data: { priority } } );

	const handleAssigneeChange = ( id: number, assigneeId: number | null ) =>
		updateMutation.mutate( { id, data: { assignee_id: assigneeId } as Partial<Task> } );

	const handleDueDateChange = ( id: number, dueDate: string | null ) =>
		updateMutation.mutate( { id, data: { due_date: dueDate } as Partial<Task> } );

	const bulkDeleteMutation = useMutation( {
		mutationFn: ( ids: number[] ) => Promise.all( ids.map( ( id ) => tasksApi.delete( id ) ) ),
		onSuccess:  () => {
			qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
			setSelectedIds( new Set() );
			toast.success( 'Tasks deleted.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const reorderMutation = useMutation( {
		mutationFn: ( items: Array<{ id: number; position: number; status: string }> ) =>
			tasksApi.reorder( items ),
		onError: ( err: Error ) => {
			toast.error( err.message );
			// Revert to server data on failure
			setOrderedTasks( data?.items ?? [] );
		},
	} );

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 5 } } )
	);

	const handleDragStart = ( event: DragStartEvent ) => {
		const task = orderedTasks.find( ( t ) => t.id === event.active.id );
		setActiveTask( task ?? null );
	};

	const handleDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		setActiveTask( null );
		if ( ! over || active.id === over.id ) return;

		setOrderedTasks( ( prev ) => {
			const oldIndex = prev.findIndex( ( t ) => t.id === active.id );
			const newIndex = prev.findIndex( ( t ) => t.id === over.id );
			const reordered = arrayMove( prev, oldIndex, newIndex );

			reorderMutation.mutate(
				reordered.map( ( t, idx ) => ( { id: t.id, position: idx, status: t.status } ) )
			);

			return reordered;
		} );
	};

	const taskIds    = orderedTasks.map( ( t ) => t.id );
	const hasFilters = !! search || !! activeFilter || !! priorityFilter;

	return (
		<div className="st-todox-page">
			<PageHeader
				title="Tasks"
				description={ `${ activeWorkspace?.name } · ${ total } task${ total !== 1 ? 's' : '' }${ search ? ` matching "${ search }"` : '' }` }
				actions={
					<div className="st-todox-page-header__btn-group">
						<ViewSwitcher />
						<Button onClick={ () => setCreateOpen( true ) } leftIcon={ <Plus size={ 14 } /> }>
							New Task
						</Button>
					</div>
				}
			/>

			{/* Status pills */}
			<div className="st-todox-pills">
				<button
					className={ `st-todox-pill ${ ! activeFilter ? 'st-todox-pill--active' : '' }` }
					style={ ! activeFilter ? { background: '#0f172a', borderColor: '#0f172a', color: '#fff' } : {} }
					onClick={ () => setFilter( null ) }
				>
					All
					<span className="st-todox-pill__count">{ countByStatus( null ) }</span>
				</button>

				{ taskStatuses.map( ( s ) => {
					const isActive = activeFilter === s.value;
					return (
						<button
							key={ s.value }
							className={ `st-todox-pill ${ isActive ? 'st-todox-pill--active' : '' }` }
							style={ isActive ? { background: s.color, borderColor: s.color, color: '#fff' } : {} }
							onClick={ () => setFilter( s.value as TaskStatus ) }
						>
							{ s.label }
							<span className="st-todox-pill__count">{ countByStatus( s.value ) }</span>
						</button>
					);
				} ) }

				{ overdueCount > 0 && (
					<button className="st-todox-pill st-todox-pill--danger">
						<AlertCircle size={ 12 } /> Overdue
						<span className="st-todox-pill__count">{ overdueCount }</span>
					</button>
				) }
			</div>

			{/* Surface card */}
			<div className="st-todox-surface-card">

				{/* Toolbar */}
				<div className="st-todox-tasks-toolbar">
					<div className="st-todox-tasks-toolbar__search">
						<Search size={ 14 } className="st-todox-tasks-toolbar__search-icon" />
						<input
							type="search"
							className="st-todox-tasks-toolbar__input"
							placeholder="Search tasks…"
							value={ search }
							onChange={ ( e ) => setSearch( e.target.value ) }
						/>
					</div>

					<div className="st-todox-tasks-toolbar__filters">
						<select
							className="st-todox-tasks-toolbar__select"
							value={ priorityFilter }
							onChange={ ( e ) => setPriority( e.target.value as TaskPriority | '' ) }
						>
							<option value="">All Priorities</option>
							<option value="urgent">Urgent</option>
							<option value="high">High</option>
							<option value="medium">Medium</option>
							<option value="low">Low</option>
						</select>

						{ hasFilters && (
							<button
								className="st-todox-tasks-toolbar__clear"
								onClick={ () => { setSearch( '' ); setFilter( null ); setPriority( '' ); } }
							>
								Clear filters
							</button>
						) }
					</div>
				</div>

				{ selectedIds.size > 0 && (
					<div className="st-todox-bulk-bar">
						<span className="st-todox-bulk-bar__count">{ selectedIds.size } task{ selectedIds.size !== 1 ? 's' : '' } selected</span>
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

				{/* Body */}
				{ isLoading ? (
					<div className="st-todox-page-loader"><Spinner /></div>
				) : isError ? (
					<div className="st-todox-empty-inline st-todox-empty-inline--error">
						<AlertCircle size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.5, color: '#ef4444' } } />
						<p>{ ( error as Error )?.message ?? 'Failed to load tasks.' }</p>
					</div>
				) : orderedTasks.length === 0 ? (
					<div className="st-todox-empty-inline">
						<CheckSquare size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
						<p>{ hasFilters ? 'No tasks match your filters.' : 'No tasks yet — create your first one.' }</p>
						{ ! hasFilters && (
							<Button size="sm" onClick={ () => setCreateOpen( true ) } leftIcon={ <Plus size={ 13 } /> }>
								Create Task
							</Button>
						) }
					</div>
				) : (
					<DndContext
						sensors={ sensors }
						collisionDetection={ closestCenter }
						onDragStart={ handleDragStart }
						onDragEnd={ handleDragEnd }
					>
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
										<th style={ { width: '35%' } }>Title</th>
										<th>Status</th>
										<th>Priority</th>
										<th>Assignee</th>
										<th>Due Date</th>
										<th style={ { width: 40 } } />
									</tr>
								</thead>
								<SortableContext items={ taskIds } strategy={ verticalListSortingStrategy }>
									<tbody>
										{ orderedTasks.map( ( task: Task ) => (
											<SortableTaskRow
												key={ task.id }
												task={ task }
												checked={ selectedIds.has( task.id ) }
												taskStatuses={ taskStatuses }
												users={ users }
												onSelect={ toggleSelect }
												onNavigate={ ( id ) => setSelectedTaskId( id ) }
												onDelete={ ( id ) => setDeleteId( id ) }
												onStatusChange={ handleStatusChange }
												onPriorityChange={ handlePriorityChange }
												onAssigneeChange={ handleAssigneeChange }
												onDueDateChange={ handleDueDateChange }
											/>
										) ) }
									</tbody>
								</SortableContext>
							</table>
						</div>

						{ ( () => {
							const activeStatus = activeFilter
								? taskStatuses.find( ( s ) => s.value === activeFilter )
								: taskStatuses[ 0 ];
							return (
								<InlineTaskInput
									key={ activeFilter ?? '__all' }
									statusValue={ activeStatus?.value ?? '' }
									statusId={ activeStatus?.id ?? null }
									onCreated={ () => qc.invalidateQueries( { queryKey: [ 'tasks' ] } ) }
								/>
							);
						} )() }

						<DragOverlay dropAnimation={ { duration: 160, easing: 'ease' } }>
							{ activeTask && <DragOverlayRow task={ activeTask } /> }
						</DragOverlay>
					</DndContext>
				) }
			</div>

			<CreateTaskModal
				isOpen={ createOpen }
				onClose={ () => setCreateOpen( false ) }
				workspaceId={ activeWorkspaceId! }
			/>

			<ConfirmDialog
				isOpen={ deleteId !== null }
				title="Delete Task"
				message="Are you sure you want to delete this task? This cannot be undone."
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
				onConfirm={ () => deleteId !== null && deleteMutation.mutate( deleteId ) }
				onClose={ () => setDeleteId( null ) }
			/>

			<ConfirmDialog
				isOpen={ bulkConfirmOpen }
				onClose={ () => setBulkConfirmOpen( false ) }
				onConfirm={ () => { setBulkConfirmOpen( false ); bulkDeleteMutation.mutate( [ ...selectedIds ] ); } }
				title={ `Delete ${ selectedIds.size } Task${ selectedIds.size !== 1 ? 's' : '' }?` }
				message="This will permanently delete the selected tasks. This cannot be undone."
				confirmLabel="Delete All"
				loading={ bulkDeleteMutation.isPending }
			/>

			<TaskDetailModal
				taskId={ selectedTaskId }
				onClose={ () => setSelectedTaskId( null ) }
			/>
		</div>
	);
};

export default TasksPage;
