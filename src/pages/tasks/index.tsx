/**
 * External dependencies
 */
import { useState, useEffect, useRef } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
	Kanban,
	Plus,
	AlertCircle,
	Calendar,
	Trash2,
	Search,
	ChevronRight,
	GripVertical,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { tasksApi } from '../../api';
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
import { formatDate, isOverdue } from '../../utils/helpers';
import type { Task, TaskPriority, TaskStatus } from '../../types';

/* ---- Inline subtask progress ---- */
const SubtaskCell = ( { task }: { task: Task } ) => {
	const total = task.subtasks?.length ?? 0;
	if ( total === 0 ) return <span className="st-todox-text--muted">—</span>;
	const done = task.subtasks!.filter( ( s ) => s.completed ).length;
	const pct  = Math.round( ( done / total ) * 100 );
	return (
		<div className="st-todox-table__subtasks">
			<div className="st-todox-table__subtask-bar">
				<div className="st-todox-table__subtask-fill" style={ { width: `${ pct }%` } } />
			</div>
			<span>{ done }/{ total }</span>
		</div>
	);
};

/* ---- Sortable Task Row ---- */
const SortableTaskRow = ( {
	task,
	onNavigate,
	onDelete,
}: {
	task: Task;
	onNavigate: ( id: number ) => void;
	onDelete: ( id: number ) => void;
} ) => {
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
			className={ `st-todox-table__row ${ overdue ? 'st-todox-table__row--overdue' : '' } ${ isDragging ? 'st-todox-table__row--dragging' : '' }` }
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

			<td><StatusBadge status={ task.status } /></td>

			<td><PriorityBadge priority={ task.priority } /></td>

			<td>
				{ task.assignee ? (
					<div className="st-todox-assignee">
						<Avatar name={ task.assignee.name } src={ task.assignee.avatar } size={ 22 } />
						<span className="st-todox-assignee__name">{ task.assignee.name }</span>
					</div>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>

			<td>
				{ task.due_date ? (
					<span className={ `st-todox-table__due ${ overdue ? 'st-todox-table__due--overdue' : '' }` }>
						<Calendar size={ 12 } />
						{ formatDate( task.due_date ) }
					</span>
				) : (
					<span className="st-todox-text--muted">—</span>
				) }
			</td>

			<td><SubtaskCell task={ task } /></td>

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
	const navigate         = useNavigate();
	const [ searchParams ] = useSearchParams();
	const qc               = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();
	const { statuses: taskStatuses } = useTaskStatuses();

	const [ createOpen, setCreateOpen ]       = useState( false );
	const [ deleteId, setDeleteId ]           = useState<number | null>( null );
	const [ search, setSearch ]               = useState( searchParams.get( 'search' ) ?? '' );
	const [ activeFilter, setFilter ]         = useState<TaskStatus | null>(
		( searchParams.get( 'status' ) as TaskStatus ) ?? null
	);
	const [ priorityFilter, setPriority ]     = useState<TaskPriority | ''>( '' );
	const [ orderedTasks, setOrderedTasks ]   = useState<Task[]>( [] );
	const [ activeTask, setActiveTask ]       = useState<Task | null>( null );

	const debouncedSearch = useDebounce( search, 400 );

	const { data, isLoading } = useQuery( {
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
	const allTasks      = countData?.items ?? [];
	const countByStatus = ( f: string | null ) =>
		f ? allTasks.filter( ( t: Task ) => t.status === f ).length : allTasks.length;
	const overdueCount  = allTasks.filter(
		( t: Task ) => isOverdue( t.due_date ) && t.status !== 'completed'
	).length;

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => tasksApi.delete( id ),
		onSuccess:  () => {
			qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
			toast.success( 'Task deleted.' );
			setDeleteId( null );
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
						<Button variant="secondary" onClick={ () => navigate( '/tasks/kanban' ) } leftIcon={ <Kanban size={ 14 } /> }>
							Kanban
						</Button>
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

				{/* Body */}
				{ isLoading ? (
					<div className="st-todox-surface-card__body"><Spinner /></div>
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
										<th style={ { width: '38%' } }>Title</th>
										<th>Status</th>
										<th>Priority</th>
										<th>Assignee</th>
										<th>Due Date</th>
										<th>Subtasks</th>
										<th style={ { width: 40 } } />
									</tr>
								</thead>
								<SortableContext items={ taskIds } strategy={ verticalListSortingStrategy }>
									<tbody>
										{ orderedTasks.map( ( task: Task ) => (
											<SortableTaskRow
												key={ task.id }
												task={ task }
												onNavigate={ ( id ) => navigate( `/tasks/${ id }` ) }
												onDelete={ ( id ) => setDeleteId( id ) }
											/>
										) ) }
									</tbody>
								</SortableContext>
							</table>
						</div>

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
				variant="danger"
				loading={ deleteMutation.isPending }
				onConfirm={ () => deleteId !== null && deleteMutation.mutate( deleteId ) }
				onClose={ () => setDeleteId( null ) }
			/>
		</div>
	);
};

export default TasksPage;
