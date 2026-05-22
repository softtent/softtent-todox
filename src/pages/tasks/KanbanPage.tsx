/**
 * External dependencies
 */
import { useState, useCallback, useRef, useEffect } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
	LayoutGrid,
	List,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { tasksApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useTaskStatuses } from '../../hooks/useTaskStatuses';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Avatar from '../../components/ui/Avatar';
import CreateTaskModal from '../../components/features/task/CreateTaskModal';
import { formatDate, isOverdue } from '../../utils/helpers';
import type { Task, TaskStatus } from '../../types';

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
	onClick,
}: {
	task: Task;
	isDragging?: boolean;
	onClick: () => void;
} ) => {
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

	const overdue       = isOverdue( task.due_date );
	const subtaskTotal  = task.subtasks?.length ?? 0;
	const subtaskDone   = task.subtasks?.filter( ( s ) => s.completed ).length ?? 0;
	const hasLabels     = ( task.labels?.length ?? 0 ) > 0;

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

			{/* Meta row */}
			<div className="st-todox-kanban-card__meta">
				<PriorityBadge priority={ task.priority } />
				{ task.due_date && (
					<span className={ `st-todox-kanban-card__due ${ overdue ? 'st-todox-kanban-card__due--overdue' : '' }` }>
						<Calendar size={ 11 } />
						{ formatDate( task.due_date ) }
					</span>
				) }
			</div>

			{/* Footer */}
			{ ( task.assignee || subtaskTotal > 0 ) && (
				<div className="st-todox-kanban-card__footer">
					{ subtaskTotal > 0 && (
						<SubtaskProgress total={ subtaskTotal } done={ subtaskDone } />
					) }
					{ task.assignee && (
						<div className="st-todox-kanban-card__assignee">
							<Avatar name={ task.assignee.name } src={ task.assignee.avatar } size={ 22 } />
							<span className="st-todox-kanban-card__assignee-name">{ task.assignee.name }</span>
						</div>
					) }
				</div>
			) }
		</div>
	);
};

/* ---- Droppable Kanban Column ---- */
const KanbanColumnComponent = ( {
	column,
	tasks,
	onAddTask,
	onTaskClick,
}: {
	column: { id: string; title: string; color: string };
	tasks: Task[];
	onAddTask: ( status: string ) => void;
	onTaskClick: ( id: number ) => void;
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
				<button
					className="st-todox-kanban-column__add-btn"
					onClick={ () => onAddTask( column.id ) }
					title={ `Add task to ${ column.title }` }
				>
					<Plus size={ 14 } />
				</button>
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
							onClick={ () => onTaskClick( task.id ) }
						/>
					) ) }
					{ tasks.length === 0 && (
						<div className="st-todox-kanban-column__empty">
							<CheckSquare size={ 28 } strokeWidth={ 1.5 } />
							<span>No tasks yet</span>
							<button
								className="st-todox-kanban-column__empty-add"
								onClick={ () => onAddTask( column.id ) }
							>
								+ Add task
							</button>
						</div>
					) }
				</div>
			</SortableContext>
		</div>
	);
};

/* ---- Main Kanban Page ---- */
const KanbanPage = () => {
	const navigate = useNavigate();
	const qc       = useQueryClient();
	const { activeWorkspaceId } = useWorkspace();
	const { statuses, isLoading: statusesLoading } = useTaskStatuses();

	const [ createOpen, setCreateOpen ]       = useState( false );
	const [ defaultStatus, setDefaultStatus ] = useState<string>( 'todo' );
	const [ activeTask, setActiveTask ]        = useState<Task | null>( null );

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

	const reorderMutation = useMutation( {
		mutationFn: ( items: Array<{ id: number; position: number; status: string }> ) =>
			tasksApi.reorder( items ),
		onError: ( err: Error ) => {
			toast.error( err.message );
			qc.invalidateQueries( { queryKey: [ 'tasks', 'kanban', activeWorkspaceId ] } );
		},
	} );

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

	const openCreate = ( status: string ) => {
		setDefaultStatus( status );
		setCreateOpen( true );
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
						<Button variant="secondary" onClick={ () => navigate( '/tasks' ) } leftIcon={ <List size={ 14 } /> }>
							List View
						</Button>
						<Button onClick={ () => openCreate( statuses[ 0 ]?.value ?? 'todo' ) } leftIcon={ <Plus size={ 14 } /> }>
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
								column={ { id: s.value, title: s.label, color: s.color } }
								tasks={ columns[ s.value ] ?? [] }
								onAddTask={ openCreate }
								onTaskClick={ ( id ) => navigate( `/tasks/${ id }`, { state: { from: 'kanban' } } ) }
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
					defaultStatus={ defaultStatus as TaskStatus }
					onCreated={ handleCreated }
				/>
			) }
		</div>
	);
};

export default KanbanPage;
