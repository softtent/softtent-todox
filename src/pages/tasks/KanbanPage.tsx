/**
 * External dependencies
 */
import { useState, useCallback, useRef, useEffect } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	DndContext,
	DragEndEvent,
	DragOverEvent,
	DragStartEvent,
	DragOverlay,
	PointerSensor,
	useSensor,
	useSensors,
	closestCenter,
	useDroppable,
} from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	Calendar,
	GripVertical,
	Plus,
	CheckSquare,
	Pencil,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { tasksApi, usersApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useTaskStatuses } from '../../hooks/useTaskStatuses';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Avatar from '../../components/ui/Avatar';
import TablePickerMenu from '../../components/ui/TablePickerMenu';
import CreateTaskModal from '../../components/features/task/CreateTaskModal';
import InlineTaskInput from '../../components/features/task/InlineTaskInput';
import TaskDetailModal from '../../components/features/task/TaskDetailModal';
import ViewSwitcher from '../../components/features/task/ViewSwitcher';
import { formatDate, isOverdue } from '../../utils/helpers';
import type { Task, TaskPriority, User } from '../../types';

/* ---- Subtask progress bar ---- */
const SubtaskProgress = ( { total, done }: { total: number; done: number } ) => {
	const pct = total > 0 ? Math.round( ( done / total ) * 100 ) : 0;
	return (
		<div className="st-todox-kanban-card__subtask-wrap">
			<div className="st-todox-kanban-card__subtask-bar">
				<div
					className="st-todox-kanban-card__subtask-fill"
					style={ { width: `${ pct }%` } }
				/>
			</div>
			<span className="st-todox-kanban-card__subtask-label">
				{ done }/{ total }
			</span>
		</div>
	);
};

/* ---- Sortable Task Card ---- */
const TaskCard = ( {
	task,
	isDragging = false,
	users,
	onClick,
	onUpdate,
}: {
	task:       Task;
	isDragging?: boolean;
	users:      User[];
	onClick:    () => void;
	onUpdate:   ( id: number, data: Partial<Task> ) => void;
} ) => {
	const [ dueDateEditing, setDueDateEditing ] = useState( false );

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging: isSortableDragging,
	} = useSortable( { id: `task-${ task.id }` } );

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity: isSortableDragging ? 0.35 : 1,
	};

	const overdue      = isOverdue( task.due_date );
	const subtaskTotal = task.subtask_counts?.total ?? task.subtasks?.length ?? 0;
	const subtaskDone  = task.subtask_counts?.completed ?? task.subtasks?.filter( ( s ) => s.completed ).length ?? 0;
	const hasLabels    = ( task.labels?.length ?? 0 ) > 0;

	return (
		<div
			ref={ setNodeRef }
			style={ style }
			{ ...attributes }
			className={ `st-todox-kanban-card ${ overdue ? 'st-todox-kanban-card--overdue' : '' } ${ isDragging ? 'st-todox-kanban-card--dragging' : '' }` }
			onClick={ onClick }
		>
			{/* Drag handle */}
			<div className="st-todox-kanban-card__grip" { ...listeners }>
				<GripVertical size={ 14 } />
			</div>

			{/* Labels */}
			{ hasLabels && (
				<div className="st-todox-kanban-card__labels">
					{ task.labels.map( ( label ) => (
						<span
							key={ label.id }
							className="st-todox-kanban-card__label"
							style={ { background: label.color + '22', color: label.color, borderColor: label.color + '44' } }
						>
							{ label.name }
						</span>
					) ) }
				</div>
			) }

			{/* Title */}
			<p className="st-todox-kanban-card__title">{ task.title }</p>

			{/* Meta row — priority + due date */}
			<div className="st-todox-kanban-card__meta">

				{/* Priority picker */}
				<div onClick={ ( e ) => e.stopPropagation() }>
					<TablePickerMenu trigger={ <PriorityBadge priority={ task.priority } /> } title="Change priority">
						{ ( [ 'low', 'medium', 'high', 'urgent' ] as TaskPriority[] ).map( ( p ) => (
							<button
								key={ p }
								className={ `st-todox-inline-picker__item ${ task.priority === p ? 'st-todox-inline-picker__item--active' : '' }` }
								onClick={ () => onUpdate( task.id, { priority: p } ) }
							>
								<PriorityBadge priority={ p } />
							</button>
						) ) }
					</TablePickerMenu>
				</div>

				{/* Due date picker */}
				<div onClick={ ( e ) => e.stopPropagation() }>
					{ dueDateEditing ? (
						<input
							type="date"
							className="st-todox-form__input st-todox-td-meta-date-input"
							defaultValue={ task.due_date ?? '' }
							autoFocus
							onChange={ ( e ) => {
								onUpdate( task.id, { due_date: e.target.value || null } as Partial<Task> );
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
								<span className={ `st-todox-kanban-card__due ${ overdue ? 'st-todox-kanban-card__due--overdue' : '' }` }>
									<Calendar size={ 11 } />
									{ formatDate( task.due_date ) }
								</span>
							) : (
								<span className="st-todox-text--muted" style={ { fontSize: 11 } }>No date</span>
							) }
							<Pencil size={ 9 } className="st-todox-inline-picker__chevron" />
						</button>
					) }
				</div>

			</div>

			{/* Footer — subtask progress + assignee */}
			<div className="st-todox-kanban-card__footer">
				{ subtaskTotal > 0 && (
					<SubtaskProgress total={ subtaskTotal } done={ subtaskDone } />
				) }

				{/* Assignee picker */}
				<div onClick={ ( e ) => e.stopPropagation() } style={ { marginLeft: 'auto' } }>
					<TablePickerMenu
						trigger={
							task.assignee ? (
								<div className="st-todox-kanban-card__assignee">
									<Avatar name={ task.assignee.name } src={ task.assignee.avatar } size={ 20 } />
									<span className="st-todox-kanban-card__assignee-name">{ task.assignee.name }</span>
								</div>
							) : (
								<span className="st-todox-text--muted" style={ { fontSize: 11 } }>Unassigned</span>
							)
						}
						title="Change assignee"
					>
						<button
							className={ `st-todox-inline-picker__item ${ ! task.assignee_id ? 'st-todox-inline-picker__item--active' : '' }` }
							onClick={ () => onUpdate( task.id, { assignee_id: null } as Partial<Task> ) }
						>
							<span style={ { width: 16, height: 16, borderRadius: '50%', border: '1.5px dashed #94a3b8', display: 'inline-block', flexShrink: 0 } } />
							Unassigned
						</button>
						{ users.map( ( u ) => (
							<button
								key={ u.id }
								className={ `st-todox-inline-picker__item ${ task.assignee_id === u.id ? 'st-todox-inline-picker__item--active' : '' }` }
								onClick={ () => onUpdate( task.id, { assignee_id: u.id } ) }
							>
								<Avatar name={ u.name } src={ u.avatar } size={ 16 } />
								{ u.name }
							</button>
						) ) }
					</TablePickerMenu>
				</div>
			</div>
		</div>
	);
};

/* ---- Droppable Kanban Column ---- */
const KanbanColumnComponent = ( {
	column,
	tasks,
	users,
	onTaskClick,
	onTaskUpdate,
	onCreated,
}: {
	column:       { id: string; title: string; color: string; statusId: number | null };
	tasks:        Task[];
	users:        User[];
	onTaskClick:  ( id: number ) => void;
	onTaskUpdate: ( id: number, data: Partial<Task> ) => void;
	onCreated:    () => void;
} ) => {
	const taskIds = tasks.map( ( t ) => `task-${ t.id }` );

	const { setNodeRef: setDropRef, isOver } = useDroppable( { id: column.id } );

	return (
		<div
			className={ `st-todox-kanban-column ${ isOver ? 'st-todox-kanban-column--over' : '' }` }
			style={ { '--col-color': column.color } as React.CSSProperties }
		>
			{/* Colored accent line at top */}
			<div className="st-todox-kanban-column__accent" style={ { background: column.color } } />

			<div className="st-todox-kanban-column__header">
				<div className="st-todox-kanban-column__title-wrap">
					<h3 className="st-todox-kanban-column__title">{ column.title }</h3>
					<span
						className="st-todox-kanban-column__count"
						style={ { background: column.color + '18', color: column.color, borderColor: column.color + '30' } }
					>
						{ tasks.length }
					</span>
				</div>
			</div>

			<SortableContext items={ taskIds } strategy={ verticalListSortingStrategy }>
				<div
					ref={ setDropRef }
					className="st-todox-kanban-column__body"
				>
					{ tasks.map( ( task ) => (
						<TaskCard
							key={ task.id }
							task={ task }
							users={ users }
							onClick={ () => onTaskClick( task.id ) }
							onUpdate={ onTaskUpdate }
						/>
					) ) }
					{ tasks.length === 0 && (
						<div className="st-todox-kanban-column__empty">
							<CheckSquare size={ 28 } strokeWidth={ 1.5 } />
							<span>No tasks yet</span>
						</div>
					) }
					<InlineTaskInput
						statusValue={ column.id }
						statusId={ column.statusId }
						onCreated={ onCreated }
					/>
				</div>
			</SortableContext>
		</div>
	);
};

/* ---- Main Kanban Page ---- */
const KanbanPage = () => {
	const qc       = useQueryClient();
	const { activeWorkspaceId } = useWorkspace();
	const { statuses, isLoading: statusesLoading } = useTaskStatuses();

	const [ createOpen, setCreateOpen ] = useState( false );
	const [ activeTask, setActiveTask ] = useState<Task | null>( null );
	const [ selectedTaskId, setSelectedTaskId ]   = useState<number | null>( null );

	const [ columns, setColumns ] = useState<Record<string, Task[]>>( {} );
	const columnsRef = useRef( columns );
	columnsRef.current = columns;

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 5 } } )
	);

	const statusKey = statuses.map( ( s ) => s.value ).join( ',' );

	const { data: tasksData, isLoading: tasksLoading } = useQuery( {
		queryKey: [ 'tasks', 'kanban', activeWorkspaceId, statusKey ],
		queryFn: () => tasksApi.getAll( {
			workspace_id: activeWorkspaceId!,
			per_page: 200,
		} ),
		enabled: !! activeWorkspaceId && ! statusesLoading,
	} );

	useEffect( () => {
		if ( ! tasksData || statusesLoading ) return;
		const statusValues = statuses.map( ( s ) => s.value );
		const grouped: Record<string, Task[]> = statusValues.reduce<Record<string, Task[]>>(
			( acc, v ) => { acc[ v ] = []; return acc; }, {}
		);
		for ( const task of tasksData.items ) {
			if ( grouped[ task.status ] !== undefined ) {
				grouped[ task.status ].push( task );
			} else {
				const first = statusValues[ 0 ];
				if ( first ) ( grouped[ first ] ??= [] ).push( task );
			}
		}
		for ( const key of Object.keys( grouped ) ) {
			grouped[ key ].sort( ( a, b ) => a.position - b.position );
		}
		setColumns( grouped );
	}, [ tasksData, statuses, statusesLoading ] );

	const isLoading = statusesLoading || tasksLoading;

	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'workspace', activeWorkspaceId ],
		queryFn:  () => usersApi.getAll( { workspace_id: activeWorkspaceId!, per_page: 100 } ),
		enabled:  !! activeWorkspaceId,
		staleTime: 60_000,
	} );
	const users = usersData?.items ?? [];

	const reorderMutation = useMutation( {
		mutationFn: ( items: Array<{ id: number; position: number; status: string }> ) =>
			tasksApi.reorder( items ),
		onError: ( err: Error ) => {
			toast.error( err.message );
			qc.invalidateQueries( { queryKey: [ 'tasks', 'kanban', activeWorkspaceId ] } );
		},
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial<Task> } ) =>
			tasksApi.update( id, data ),
		onSuccess: () => qc.invalidateQueries( { queryKey: [ 'tasks', 'kanban', activeWorkspaceId ] } ),
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	const handleTaskUpdate = useCallback(
		( id: number, data: Partial<Task> ) => updateMutation.mutate( { id, data } ),
		[ updateMutation ]
	);

	const getTaskIdFromDndId = ( dndId: string ) => Number( String( dndId ).replace( 'task-', '' ) );

	const findTaskInRef = ( taskId: number ): { task: Task; status: string } | null => {
		const cols = columnsRef.current;
		for ( const status of Object.keys( cols ) ) {
			const task = cols[ status ].find( ( t ) => t.id === taskId );
			if ( task ) return { task, status };
		}
		return null;
	};

	const handleDragStart = ( event: DragStartEvent ) => {
		const taskId = getTaskIdFromDndId( String( event.active.id ) );
		const found  = findTaskInRef( taskId );
		if ( found ) setActiveTask( found.task );
	};

	const handleDragOver = ( event: DragOverEvent ) => {
		const { active, over } = event;
		if ( ! over ) return;

		const activeTaskId = getTaskIdFromDndId( String( active.id ) );
		const overStr      = String( over.id );

		const found = findTaskInRef( activeTaskId );
		if ( ! found ) return;

		const fromStatus = found.status;

		let toStatus: string | null = null;
		let insertIndex = -1;

		if ( statuses.some( ( s ) => s.value === overStr ) ) {
			toStatus = overStr;
		} else {
			const overTaskId = getTaskIdFromDndId( overStr );
			const overFound  = findTaskInRef( overTaskId );
			if ( overFound && overTaskId !== activeTaskId ) {
				toStatus = overFound.status;
				// Index within the filtered list (active task excluded) so splice lands correctly
				const filteredDest = columnsRef.current[ toStatus ].filter( ( t ) => t.id !== activeTaskId );
				insertIndex = filteredDest.findIndex( ( t ) => t.id === overTaskId );
			}
		}

		if ( ! toStatus ) return;

		if ( toStatus === fromStatus ) {
			if ( insertIndex < 0 ) return;
			setColumns( ( prev ) => {
				const tasks = prev[ fromStatus ].filter( ( t ) => t.id !== activeTaskId );
				tasks.splice( insertIndex, 0, found.task );
				return { ...prev, [ fromStatus ]: tasks };
			} );
			return;
		}

		const dest = toStatus;
		setColumns( ( prev ) => {
			const fromTasks = prev[ fromStatus ].filter( ( t ) => t.id !== activeTaskId );
			const movedTask = { ...found.task, status: dest as Task['status'] };
			const destTasks = prev[ dest ].filter( ( t ) => t.id !== activeTaskId );
			if ( insertIndex >= 0 ) {
				destTasks.splice( insertIndex, 0, movedTask );
			} else {
				destTasks.push( movedTask );
			}
			return { ...prev, [ fromStatus ]: fromTasks, [ dest ]: destTasks };
		} );
	};

	const handleDragEnd = ( event: DragEndEvent ) => {
		const { over } = event;
		setActiveTask( null );
		if ( ! over ) return;

		const current = columnsRef.current;
		const items: Array<{ id: number; position: number; status: string }> = [];
		for ( const status of Object.keys( current ) ) {
			current[ status ].forEach( ( t, idx ) => {
				items.push( { id: t.id, position: idx, status } );
			} );
		}
		reorderMutation.mutate( items );
	};

	const handleCreated = () => {
		qc.invalidateQueries( { queryKey: [ 'tasks', 'kanban', activeWorkspaceId ] } );
	};

	const totalTasks = Object.values( columns ).reduce( ( sum, col ) => sum + col.length, 0 );

	return (
		<div className="st-todox-page">
			<PageHeader
				title="Kanban Board"
				description={ `${ totalTasks } task${ totalTasks !== 1 ? 's' : '' } across ${ statuses.length } column${ statuses.length !== 1 ? 's' : '' }` }
				actions={
					<div className="st-todox-page-header__btn-group">
						<ViewSwitcher />
						<Button onClick={ () => setCreateOpen( true ) } leftIcon={ <Plus size={ 14 } /> }>
							New Task
						</Button>
					</div>
				}
			/>

			{ isLoading ? (
				<Spinner fullscreen />
			) : (
				<DndContext
					sensors={ sensors }
					collisionDetection={ closestCenter }
					onDragStart={ handleDragStart }
					onDragOver={ handleDragOver }
					onDragEnd={ handleDragEnd }
				>
					<div className="st-todox-kanban">
						{ statuses.map( ( s ) => (
							<KanbanColumnComponent
								key={ s.value }
								column={ { id: s.value, title: s.label, color: s.color, statusId: s.id } }
								tasks={ columns[ s.value ] ?? [] }
								users={ users }
								onTaskClick={ ( id ) => setSelectedTaskId( id ) }
								onTaskUpdate={ handleTaskUpdate }
								onCreated={ handleCreated }
							/>
						) ) }
					</div>

					<DragOverlay dropAnimation={ { duration: 180, easing: 'ease' } }>
						{ activeTask && (
							<div className="st-todox-kanban-card st-todox-kanban-card--overlay">
								{ ( activeTask.labels?.length ?? 0 ) > 0 && (
									<div className="st-todox-kanban-card__labels">
										{ activeTask.labels.map( ( label ) => (
											<span
												key={ label.id }
												className="st-todox-kanban-card__label"
												style={ { background: label.color + '22', color: label.color, borderColor: label.color + '44' } }
											>
												{ label.name }
											</span>
										) ) }
									</div>
								) }
								<p className="st-todox-kanban-card__title">{ activeTask.title }</p>
								<div className="st-todox-kanban-card__meta">
									<PriorityBadge priority={ activeTask.priority } />
									{ activeTask.due_date && (
										<span className="st-todox-kanban-card__due">
											<Calendar size={ 11 } />
											{ formatDate( activeTask.due_date ) }
										</span>
									) }
								</div>
								{ activeTask.assignee && (
									<div className="st-todox-kanban-card__footer">
										<div className="st-todox-kanban-card__assignee">
											<Avatar name={ activeTask.assignee.name } src={ activeTask.assignee.avatar } size={ 22 } />
											<span className="st-todox-kanban-card__assignee-name">{ activeTask.assignee.name }</span>
										</div>
									</div>
								) }
							</div>
						) }
					</DragOverlay>
				</DndContext>
			) }

			{ activeWorkspaceId && (
				<CreateTaskModal
					isOpen={ createOpen }
					onClose={ () => setCreateOpen( false ) }
					workspaceId={ activeWorkspaceId }
					onCreated={ handleCreated }
				/>
			) }

			<TaskDetailModal
				taskId={ selectedTaskId }
				onClose={ () => setSelectedTaskId( null ) }
			/>
		</div>
	);
};

export default KanbanPage;
