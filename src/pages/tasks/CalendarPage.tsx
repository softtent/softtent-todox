/**
 * External dependencies
 */
import { useState, useMemo, useEffect } from '@wordpress/element';
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
	useDraggable,
	useDroppable,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

/**
 * Internal dependencies
 */
import { tasksApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useTaskStatuses } from '../../hooks/useTaskStatuses';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import ViewSwitcher from '../../components/features/task/ViewSwitcher';
import CreateTaskModal from '../../components/features/task/CreateTaskModal';
import TaskDetailModal from '../../components/features/task/TaskDetailModal';
import { isOverdue } from '../../utils/helpers';
import type { Task } from '../../types';

const DAY_NAMES   = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];
const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

function buildCalendarDays( year: number, month: number ) {
	const firstDayOfWeek = new Date( year, month, 1 ).getDay();
	const daysInMonth    = new Date( year, month + 1, 0 ).getDate();
	const daysInPrev     = new Date( year, month, 0 ).getDate();

	const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

	for ( let i = firstDayOfWeek - 1; i >= 0; i-- ) {
		days.push( { date: new Date( year, month - 1, daysInPrev - i ), isCurrentMonth: false } );
	}
	for ( let d = 1; d <= daysInMonth; d++ ) {
		days.push( { date: new Date( year, month, d ), isCurrentMonth: true } );
	}
	while ( days.length < 42 ) {
		days.push( { date: new Date( year, month + 1, days.length - daysInMonth - firstDayOfWeek + 1 ), isCurrentMonth: false } );
	}

	return days;
}

function toDateKey( date: Date ) {
	return `${ date.getFullYear() }-${ String( date.getMonth() + 1 ).padStart( 2, '0' ) }-${ String( date.getDate() ).padStart( 2, '0' ) }`;
}

type SpanSegment = {
	task:     Task;
	colStart: number;
	colEnd:   number;
	isStart:  boolean;
	isEnd:    boolean;
};

/* ---- Spanning task bar (multi-day) ---- */
const SpansLayer = ( {
	spans,
	statusColorMap,
	onNavigate,
}: {
	spans:          SpanSegment[];
	statusColorMap: Record<string, string>;
	onNavigate:     ( id: number ) => void;
} ) => {
	if ( spans.length === 0 ) return null;

	return (
		<div className="st-todox-calendar__spans-layer">
			{ spans.map( ( { task, colStart, colEnd, isStart, isEnd } ) => {
				const color = statusColorMap[ task.status ] ?? '#94a3b8';
				return (
					<button
						key={ `${ task.id }-${ colStart }` }
						className={ [
							'st-todox-calendar__span-pill',
							isStart ? 'st-todox-calendar__span-pill--start' : '',
							isEnd   ? 'st-todox-calendar__span-pill--end'   : '',
						].filter( Boolean ).join( ' ' ) }
						style={ {
							gridColumn:      `${ colStart } / ${ colEnd }`,
							backgroundColor: color + '22',
							color,
							borderLeftColor: color,
						} as React.CSSProperties }
						title={ task.title }
						onClick={ () => onNavigate( task.id ) }
					>
						{ isStart ? task.title : '' }
					</button>
				);
			} ) }
		</div>
	);
};

/* ---- Draggable task pill ---- */
const DraggableTaskPill = ( {
	task,
	statusColor,
	onNavigate,
}: {
	task:        Task;
	statusColor: string;
	onNavigate:  ( id: number ) => void;
} ) => {
	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable( { id: task.id } );

	const overdue = isOverdue( task.due_date ) && task.status !== 'completed';

	return (
		<div
			ref={ setNodeRef }
			{ ...attributes }
			{ ...listeners }
			style={ {
				transform:   transform ? `translate3d(${ transform.x }px, ${ transform.y }px, 0)` : undefined,
				opacity:     isDragging ? 0.3 : 1,
				touchAction: 'none',
				cursor:      isDragging ? 'grabbing' : 'grab',
			} }
		>
			<button
				className={ `st-todox-calendar__task-pill${ overdue ? ' st-todox-calendar__task-pill--overdue' : '' }` }
				style={ { borderLeftColor: statusColor, cursor: 'inherit', pointerEvents: isDragging ? 'none' : 'auto' } }
				title={ task.title }
				onClick={ () => onNavigate( task.id ) }
			>
				{ task.title }
			</button>
		</div>
	);
};

/* ---- Droppable day cell ---- */
const DroppableCell = ( {
	dateKey,
	isCurrentMonth,
	isToday,
	children,
}: {
	dateKey:        string;
	isCurrentMonth: boolean;
	isToday:        boolean;
	children:       React.ReactNode;
} ) => {
	const { isOver, setNodeRef } = useDroppable( { id: dateKey } );

	return (
		<div
			ref={ setNodeRef }
			className={ [
				'st-todox-calendar__cell',
				! isCurrentMonth ? 'st-todox-calendar__cell--out'   : '',
				isToday          ? 'st-todox-calendar__cell--today' : '',
				isOver           ? 'st-todox-calendar__cell--over'  : '',
			].filter( Boolean ).join( ' ' ) }
		>
			{ children }
		</div>
	);
};

/* ---- Page ---- */
const CalendarPage = () => {
	const qc       = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();
	const { statuses } = useTaskStatuses();

	const [ viewDate, setViewDate ]             = useState( () => new Date() );
	const [ createOpen, setCreateOpen ]         = useState( false );
	const [ createDate, setCreateDate ]         = useState<string | null>( null );
	const [ localTasks, setLocalTasks ]         = useState<Task[]>( [] );
	const [ activeDragTask, setActiveDragTask ] = useState<Task | null>( null );
	const [ selectedTaskId, setSelectedTaskId ] = useState<number | null>( null );

	const year  = viewDate.getFullYear();
	const month = viewDate.getMonth();

	const { data, isLoading } = useQuery( {
		queryKey: [ 'tasks', 'calendar', activeWorkspaceId ],
		queryFn:  () => tasksApi.getAll( { workspace_id: activeWorkspaceId!, per_page: 500 } ),
		enabled:  !! activeWorkspaceId,
	} );

	const serverTasks = ( data?.items ?? [] ) as Task[];

	useEffect( () => {
		if ( ! activeDragTask ) {
			setLocalTasks( serverTasks );
		}
	}, [ data ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Single-day tasks keyed by date; multi-day spans collected separately.
	const { tasksByDate, multiDayTasks } = useMemo( () => {
		const byDate: Record<string, Task[]> = {};
		const spanning: Task[]               = [];

		localTasks.forEach( ( task ) => {
			const start = task.start_date?.slice( 0, 10 ) ?? null;
			const end   = task.due_date?.slice( 0, 10 )   ?? null;

			if ( start && end && start !== end ) {
				// Has both distinct dates → spanning bar
				spanning.push( task );
			} else {
				// Single day: prefer due_date, fall back to start_date
				const key = end ?? start;
				if ( key ) {
					if ( ! byDate[ key ] ) byDate[ key ] = [];
					byDate[ key ].push( task );
				}
			}
		} );

		// Sort by id so first-created task always occupies the top lane
		spanning.sort( ( a, b ) => a.id - b.id );

		return { tasksByDate: byDate, multiDayTasks: spanning };
	}, [ localTasks ] );

	const statusColorMap = useMemo( () => {
		const map: Record<string, string> = {};
		statuses.forEach( ( s ) => { map[ s.value ] = s.color; } );
		return map;
	}, [ statuses ] );

	const calendarDays = useMemo( () => buildCalendarDays( year, month ), [ year, month ] );
	const todayKey     = toDateKey( new Date() );

	// Break 42 days into 6 week rows
	const calendarRows = useMemo( () => {
		const rows: typeof calendarDays[] = [];
		for ( let i = 0; i < 6; i++ ) {
			rows.push( calendarDays.slice( i * 7, ( i + 1 ) * 7 ) );
		}
		return rows;
	}, [ calendarDays ] );

	// Per-row spanning segments for multi-day tasks
	const spanningByRow = useMemo( () => {
		const result: SpanSegment[][] = Array.from( { length: 6 }, () => [] );

		multiDayTasks.forEach( ( task ) => {
			const taskStart = new Date( task.start_date!.slice( 0, 10 ) + 'T00:00:00' );
			const taskEnd   = new Date( task.due_date!.slice( 0, 10 )   + 'T00:00:00' );

			calendarRows.forEach( ( row, rowIndex ) => {
				const rowStart = new Date( row[ 0 ].date.getFullYear(), row[ 0 ].date.getMonth(), row[ 0 ].date.getDate() );
				const rowEnd   = new Date( row[ 6 ].date.getFullYear(), row[ 6 ].date.getMonth(), row[ 6 ].date.getDate() );

				if ( taskEnd < rowStart || taskStart > rowEnd ) return;

				const startCol = taskStart >= rowStart
					? Math.round( ( taskStart.getTime() - rowStart.getTime() ) / 86400000 )
					: 0;
				const endCol = taskEnd <= rowEnd
					? Math.round( ( taskEnd.getTime() - rowStart.getTime() ) / 86400000 )
					: 6;

				result[ rowIndex ].push( {
					task,
					colStart: startCol + 1,   // CSS grid is 1-based
					colEnd:   endCol   + 2,   // inclusive end → +1, then 1-based → +1
					isStart:  taskStart >= rowStart,
					isEnd:    taskEnd   <= rowEnd,
				} );
			} );
		} );

		return result;
	}, [ multiDayTasks, calendarRows ] );

	// Max overlapping span rows per week (drives cell padding-top reservation)
	const spanLanes = useMemo( () => {
		return spanningByRow.map( ( segments ) => {
			if ( segments.length === 0 ) return 0;
			const col = new Array( 7 ).fill( 0 );
			segments.forEach( ( { colStart, colEnd } ) => {
				for ( let c = colStart - 1; c < Math.min( colEnd - 1, 7 ); c++ ) {
					col[ c ]++;
				}
			} );
			return Math.max( ...col );
		} );
	}, [ spanningByRow ] );

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 5 } } )
	);

	const updateTaskDateMutation = useMutation( {
		mutationFn: ( { id, ...fields }: { id: number; due_date?: string; start_date?: string } ) =>
			tasksApi.update( id, fields ),
		onSuccess: () => {
			qc.invalidateQueries( { queryKey: [ 'tasks', 'calendar', activeWorkspaceId ] } );
		},
		onError: ( err: Error ) => {
			toast.error( err.message );
			setLocalTasks( serverTasks );
		},
	} );

	const handleDragStart = ( event: DragStartEvent ) => {
		const task = localTasks.find( ( t ) => t.id === event.active.id );
		setActiveDragTask( task ?? null );
	};

	const handleDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		setActiveDragTask( null );
		if ( ! over ) return;

		const taskId     = active.id as number;
		const newDateKey = over.id as string;
		const task       = localTasks.find( ( t ) => t.id === taskId );
		if ( ! task ) return;

		const start = task.start_date?.slice( 0, 10 );
		const end   = task.due_date?.slice( 0, 10 );

		// Multi-day spans are not draggable via single-cell drop
		if ( start && end && start !== end ) return;

		// Determine which field this pill represents
		const isStartOnly = start && ! end;
		const currentKey  = end ?? start;
		if ( currentKey === newDateKey ) return;

		if ( isStartOnly ) {
			setLocalTasks( ( prev ) =>
				prev.map( ( t ) => t.id === taskId ? { ...t, start_date: newDateKey } : t )
			);
			updateTaskDateMutation.mutate( { id: taskId, start_date: newDateKey } );
		} else {
			setLocalTasks( ( prev ) =>
				prev.map( ( t ) => t.id === taskId ? { ...t, due_date: newDateKey } : t )
			);
			updateTaskDateMutation.mutate( { id: taskId, due_date: newDateKey } );
		}
	};

	return (
		<div className="st-todox-page">
			<PageHeader
				title="Calendar"
				description={ `${ activeWorkspace?.name } · ${ localTasks.length } task${ localTasks.length !== 1 ? 's' : '' }` }
				actions={
					<div className="st-todox-page-header__btn-group">
						<ViewSwitcher />
						<Button onClick={ () => { setCreateDate( null ); setCreateOpen( true ); } } leftIcon={ <Plus size={ 14 } /> }>
							New Task
						</Button>
					</div>
				}
			/>

			<div className="st-todox-surface-card st-todox-calendar">
				{/* Nav */}
				<div className="st-todox-calendar__nav">
					<button
						className="st-todox-calendar__nav-btn"
						onClick={ () => setViewDate( new Date( year, month - 1, 1 ) ) }
					>
						<ChevronLeft size={ 16 } />
					</button>

					<div className="st-todox-calendar__nav-center">
						<span className="st-todox-calendar__month-label">
							{ MONTH_NAMES[ month ] } { year }
						</span>
						<button
							className="st-todox-calendar__today-btn"
							onClick={ () => setViewDate( new Date() ) }
						>
							Today
						</button>
					</div>

					<button
						className="st-todox-calendar__nav-btn"
						onClick={ () => setViewDate( new Date( year, month + 1, 1 ) ) }
					>
						<ChevronRight size={ 16 } />
					</button>
				</div>

				{/* Day headers */}
				<div className="st-todox-calendar__day-headers">
					{ DAY_NAMES.map( ( d ) => (
						<div key={ d } className="st-todox-calendar__day-header">{ d }</div>
					) ) }
				</div>

				{/* Grid */}
				{ isLoading ? (
					<div className="st-todox-page-loader"><Spinner /></div>
				) : (
					<DndContext
						sensors={ sensors }
						onDragStart={ handleDragStart }
						onDragEnd={ handleDragEnd }
					>
						<div className="st-todox-calendar__grid">
							{ calendarRows.map( ( row, rowIndex ) => (
								<div key={ rowIndex } className="st-todox-calendar__week-row">
									<div
										className="st-todox-calendar__cells"
										style={ { '--span-lanes': spanLanes[ rowIndex ] } as React.CSSProperties }
									>
										<SpansLayer
											spans={ spanningByRow[ rowIndex ] }
											statusColorMap={ statusColorMap }
											onNavigate={ ( id ) => setSelectedTaskId( id ) }
										/>
										{ row.map( ( { date, isCurrentMonth } ) => {
											const key         = toDateKey( date );
											const dayTasks    = tasksByDate[ key ] ?? [];
											const isToday     = key === todayKey;
											const MAX_VISIBLE = 3;
											const visible     = dayTasks.slice( 0, MAX_VISIBLE );
											const hiddenCount = dayTasks.length - MAX_VISIBLE;

											return (
												<DroppableCell
													key={ key }
													dateKey={ key }
													isCurrentMonth={ isCurrentMonth }
													isToday={ isToday }
												>
													<div className="st-todox-calendar__cell-header">
														<span className="st-todox-calendar__cell-date">{ date.getDate() }</span>
														<button
															className="st-todox-calendar__cell-add"
															title={ `Add task on ${ date.toLocaleDateString() }` }
															onClick={ () => { setCreateDate( key ); setCreateOpen( true ); } }
														>
															<Plus size={ 15 } strokeWidth={ 2.5 } />
														</button>
													</div>
													<div className="st-todox-calendar__cell-tasks">
														{ visible.map( ( task ) => (
															<DraggableTaskPill
																key={ task.id }
																task={ task }
																statusColor={ statusColorMap[ task.status ] ?? '#94a3b8' }
																onNavigate={ ( id ) => setSelectedTaskId( id ) }
															/>
														) ) }
														{ hiddenCount > 0 && (
															<span className="st-todox-calendar__cell-more">+{ hiddenCount } more</span>
														) }
													</div>
												</DroppableCell>
											);
										} ) }
									</div>
								</div>
							) ) }
						</div>

						<DragOverlay dropAnimation={ { duration: 160, easing: 'ease' } }>
							{ activeDragTask && (
								<button
									className={ `st-todox-calendar__task-pill${ isOverdue( activeDragTask.due_date ) && activeDragTask.status !== 'completed' ? ' st-todox-calendar__task-pill--overdue' : '' }` }
									style={ {
										borderLeftColor: statusColorMap[ activeDragTask.status ] ?? '#94a3b8',
										opacity: 0.9,
										cursor:  'grabbing',
									} }
								>
									{ activeDragTask.title }
								</button>
							) }
						</DragOverlay>
					</DndContext>
				) }
			</div>

			<CreateTaskModal
				isOpen={ createOpen }
				onClose={ () => setCreateOpen( false ) }
				workspaceId={ activeWorkspaceId! }
				defaultDueDate={ createDate }
			/>

			<TaskDetailModal
				taskId={ selectedTaskId }
				onClose={ () => setSelectedTaskId( null ) }
			/>
		</div>
	);
};

export default CalendarPage;
