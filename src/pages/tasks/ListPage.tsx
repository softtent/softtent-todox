/**
 * External dependencies
 */
import { useState, useMemo, useEffect, useRef, useCallback } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	DndContext,
	DragEndEvent,
	DragOverEvent,
	DragOverlay,
	DragStartEvent,
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
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	ChevronDown,
	ChevronRight,
	Plus,
	AlertCircle,
	Search,
	Trash2,
	Calendar,
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
import ViewSwitcher from '../../components/features/task/ViewSwitcher';
import CreateTaskModal from '../../components/features/task/CreateTaskModal';
import InlineTaskInput from '../../components/features/task/InlineTaskInput';
import TaskDetailModal from '../../components/features/task/TaskDetailModal';
import { formatDate, isOverdue } from '../../utils/helpers';
import type { Task, TaskPriority, TaskStatus } from '../../types';

/* ---- Droppable section body (accepts cross-section drops) ---- */
const DroppableSectionBody = ( {
	statusValue,
	children,
}: {
	statusValue: string;
	children:    React.ReactNode;
} ) => {
	const { setNodeRef, isOver } = useDroppable( { id: statusValue } );
	return (
		<div
			ref={ setNodeRef }
			className={ `st-todox-list-section__body${ isOver ? ' st-todox-list-section__body--over' : '' }` }
		>
			{ children }
		</div>
	);
};

/* ---- Sortable row ---- */
const SortableListRow = ( {
	task,
	checked,
	onSelect,
	onNavigate,
	onDelete,
	statuses,
	onStatusChange,
	onPriorityChange,
}: {
	task:             Task;
	checked:          boolean;
	onSelect:         ( id: number ) => void;
	onNavigate:       ( id: number ) => void;
	onDelete:         ( id: number ) => void;
	statuses:         { value: string; label: string; color: string; id: number | null }[];
	onStatusChange:   ( id: number, status: TaskStatus ) => void;
	onPriorityChange: ( id: number, priority: TaskPriority ) => void;
} ) => {
	const [ statusOpen, setStatusOpen ]     = useState( false );
	const [ priorityOpen, setPriorityOpen ] = useState( false );

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
		opacity:  isDragging ? 0.35 : 1,
		position: 'relative',
		zIndex:   isDragging ? 1 : 'auto',
	};

	const overdue = isOverdue( task.due_date ) && task.status !== 'completed';

	return (
		<div
			ref={ setNodeRef }
			style={ style }
			{ ...attributes }
			className={ [
				'st-todox-list-row',
				overdue    ? 'st-todox-list-row--overdue'  : '',
				isDragging ? 'st-todox-list-row--dragging' : '',
				checked    ? 'st-todox-list-row--selected'  : '',
			].filter( Boolean ).join( ' ' ) }
			onClick={ () => onNavigate( task.id ) }
		>
			<input
				type="checkbox"
				className="st-todox-list-row__check"
				checked={ checked }
				onChange={ () => onSelect( task.id ) }
				onClick={ ( e ) => e.stopPropagation() }
			/>
			<span
				className="st-todox-list-row__grip"
				{ ...listeners }
				onClick={ ( e ) => e.stopPropagation() }
			>
				<GripVertical size={ 13 } />
			</span>

			<div className="st-todox-list-row__title">
				<span>{ task.title }</span>
				{ ( task.labels?.length ?? 0 ) > 0 && (
					<span className="st-todox-list-row__labels">
						{ task.labels.map( ( l ) => (
							<span
								key={ l.id }
								className="st-todox-table__label"
								style={ { background: l.color + '22', color: l.color, borderColor: l.color + '44' } }
							>
								{ l.name }
							</span>
						) ) }
					</span>
				) }
			</div>

			<div className="st-todox-list-row__meta" onClick={ ( e ) => e.stopPropagation() }>

				{/* Status picker */}
				<div className="st-todox-inline-picker">
					<button
						className="st-todox-inline-picker__trigger"
						onClick={ () => { setPriorityOpen( false ); setStatusOpen( ( v ) => ! v ); } }
						title="Change status"
					>
						<StatusBadge status={ task.status as TaskStatus } />
						<ChevronDown size={ 10 } className="st-todox-inline-picker__chevron" />
					</button>
					{ statusOpen && (
						<>
							<div className="st-todox-inline-picker__backdrop" onClick={ () => setStatusOpen( false ) } />
							<div className="st-todox-inline-picker__menu">
								{ statuses.map( ( s ) => (
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

				{/* Priority picker */}
				<div className="st-todox-inline-picker">
					<button
						className="st-todox-inline-picker__trigger"
						onClick={ () => { setStatusOpen( false ); setPriorityOpen( ( v ) => ! v ); } }
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

				{ task.due_date && (
					<span className={ `st-todox-table__due${ overdue ? ' st-todox-table__due--overdue' : '' }` }>
						<Calendar size={ 12 } />
						{ formatDate( task.due_date ) }
					</span>
				) }
				{ task.assignee && (
					<div className="st-todox-assignee">
						<Avatar name={ task.assignee.name } src={ task.assignee.avatar } size={ 20 } />
						<span className="st-todox-assignee__name">{ task.assignee.name }</span>
					</div>
				) }
				<button
					className="st-todox-table__action-btn st-todox-table__action-btn--danger"
					title="Delete task"
					onClick={ ( e ) => { e.stopPropagation(); onDelete( task.id ); } }
				>
					<Trash2 size={ 13 } />
				</button>
			</div>
		</div>
	);
};

/* ---- Drag overlay pill ---- */
const DragOverlayRow = ( { task }: { task: Task } ) => (
	<div className="st-todox-list-row st-todox-list-row--drag-overlay">
		<span className="st-todox-list-row__grip"><GripVertical size={ 13 } /></span>
		<div className="st-todox-list-row__title"><span>{ task.title }</span></div>
		<div className="st-todox-list-row__meta">
			<PriorityBadge priority={ task.priority } />
		</div>
	</div>
);

/* ---- Page ---- */
const ListPage = () => {
	const qc       = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();
	const { statuses, isLoading: statusLoading } = useTaskStatuses();

	const [ createOpen, setCreateOpen ] = useState( false );
	const [ deleteId, setDeleteId ]     = useState<number | null>( null );
	const [ selectedTaskId, setSelectedTaskId ]   = useState<number | null>( null );
	const [ search, setSearch ]                 = useState( '' );
	const [ priorityFilter, setPriority ]       = useState<TaskPriority | ''>( '' );
	const [ collapsed, setCollapsed ]           = useState<Record<string, boolean>>( {} );
	const [ orderedGroups, setOrderedGroups ]   = useState<Record<string, Task[]>>( {} );
	const [ activeDragTask, setActiveDragTask ] = useState<Task | null>( null );
	const [ selectedIds, setSelectedIds ]       = useState< Set<number> >( new Set() );
	const [ bulkConfirmOpen, setBulkConfirmOpen ] = useState( false );
	const selectAllRef                          = useRef< HTMLInputElement >( null );

	// Ref so event handlers always see current state without stale closures
	const orderedGroupsRef = useRef( orderedGroups );
	orderedGroupsRef.current = orderedGroups;

	const debouncedSearch = useDebounce( search, 400 );

	const { data, isLoading } = useQuery( {
		queryKey: [ 'tasks', activeWorkspaceId, debouncedSearch, priorityFilter ],
		queryFn:  () => tasksApi.getAll( {
			workspace_id: activeWorkspaceId!,
			search:   debouncedSearch,
			priority: priorityFilter || undefined,
			per_page: 500,
		} ),
		enabled: !! activeWorkspaceId,
	} );

	const tasks = ( data?.items ?? [] ) as Task[];

	const groupedTasks = useMemo( () => {
		const map: Record<string, Task[]> = {};
		statuses.forEach( ( s ) => { map[ s.value ] = []; } );
		tasks.forEach( ( task ) => {
			if ( map[ task.status ] ) {
				map[ task.status ].push( task );
			} else {
				const first = statuses[ 0 ]?.value;
				if ( first ) {
					if ( ! map[ first ] ) map[ first ] = [];
					map[ first ].push( task );
				}
			}
		} );
		return map;
	}, [ tasks, statuses ] );

	// Sync local order whenever server data arrives
	useEffect( () => {
		setOrderedGroups( groupedTasks );
	}, [ data ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 5 } } )
	);

	const reorderMutation = useMutation( {
		mutationFn: ( items: Array<{ id: number; position: number; status: string }> ) =>
			tasksApi.reorder( items ),
		onError: ( err: Error ) => {
			toast.error( err.message );
			qc.invalidateQueries( { queryKey: [ 'tasks', activeWorkspaceId ] } );
		},
	} );

	/* Find which section a task currently lives in */
	const findTaskSection = ( taskId: number ): string | null => {
		for ( const [ status, sectionTasks ] of Object.entries( orderedGroupsRef.current ) ) {
			if ( sectionTasks.find( ( t ) => t.id === taskId ) ) return status;
		}
		return null;
	};

	const handleDragStart = ( event: DragStartEvent ) => {
		const taskId = event.active.id as number;
		const status = findTaskSection( taskId );
		if ( status ) {
			const task = orderedGroupsRef.current[ status ].find( ( t ) => t.id === taskId );
			setActiveDragTask( task ?? null );
		}
	};

	/*
	 * Live-update positions and status as the user drags.
	 * Mirrors the Kanban handleDragOver so cross-section moves are visible immediately.
	 */
	const handleDragOver = ( event: DragOverEvent ) => {
		const { active, over } = event;
		if ( ! over ) return;

		const activeId   = active.id as number;
		const fromStatus = findTaskSection( activeId );
		if ( ! fromStatus ) return;

		const activeTask = orderedGroupsRef.current[ fromStatus ].find( ( t ) => t.id === activeId );
		if ( ! activeTask ) return;

		let toStatus:    string | null = null;
		let insertIndex: number        = -1;

		if ( typeof over.id === 'string' ) {
			// Dropped over a DroppableSectionBody (section's status value is the ID)
			toStatus = over.id;
		} else {
			// Dropped over another sortable task
			const overTaskId = over.id as number;
			toStatus         = findTaskSection( overTaskId );
			if ( toStatus && overTaskId !== activeId ) {
				const filteredDest = orderedGroupsRef.current[ toStatus ].filter( ( t ) => t.id !== activeId );
				insertIndex        = filteredDest.findIndex( ( t ) => t.id === overTaskId );
			}
		}

		if ( ! toStatus ) return;

		if ( toStatus === fromStatus ) {
			// Same-section reorder
			if ( insertIndex < 0 ) return;
			setOrderedGroups( ( prev ) => {
				const section = prev[ fromStatus ].filter( ( t ) => t.id !== activeId );
				section.splice( insertIndex, 0, activeTask );
				return { ...prev, [ fromStatus ]: section };
			} );
			return;
		}

		// Cross-section move
		const dest = toStatus;
		setOrderedGroups( ( prev ) => {
			const fromTasks = prev[ fromStatus ].filter( ( t ) => t.id !== activeId );
			const movedTask = { ...activeTask, status: dest as Task[ 'status' ] };
			const destTasks = prev[ dest ]?.filter( ( t ) => t.id !== activeId ) ?? [];
			if ( insertIndex >= 0 ) {
				destTasks.splice( insertIndex, 0, movedTask );
			} else {
				destTasks.push( movedTask );
			}
			return { ...prev, [ fromStatus ]: fromTasks, [ dest ]: destTasks };
		} );
	};

	/* Commit the final state (positions + statuses) to the server */
	const handleDragEnd = ( event: DragEndEvent ) => {
		const { over } = event;
		setActiveDragTask( null );
		if ( ! over ) return;

		const current = orderedGroupsRef.current;
		const items: Array<{ id: number; position: number; status: string }> = [];
		for ( const status of Object.keys( current ) ) {
			current[ status ].forEach( ( t, idx ) => {
				items.push( { id: t.id, position: idx, status } );
			} );
		}
		reorderMutation.mutate( items );
	};

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: { status?: string; priority?: TaskPriority } } ) => tasksApi.update( id, data ),
		onSuccess: () => qc.invalidateQueries( { queryKey: [ 'tasks', activeWorkspaceId ] } ),
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	const handleStatusChange   = useCallback( ( id: number, status: TaskStatus ) =>
		updateMutation.mutate( { id, data: { status } } ), [ updateMutation ] );

	const handlePriorityChange = useCallback( ( id: number, priority: TaskPriority ) =>
		updateMutation.mutate( { id, data: { priority } } ), [ updateMutation ] );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => tasksApi.delete( id ),
		onSuccess: () => {
			qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
			toast.success( 'Task deleted.' );
			setDeleteId( null );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const bulkDeleteMutation = useMutation( {
		mutationFn: ( ids: number[] ) => Promise.all( ids.map( ( id ) => tasksApi.delete( id ) ) ),
		onSuccess: () => {
			qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
			setSelectedIds( new Set() );
			toast.success( 'Tasks deleted.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const allTaskIds  = tasks.map( ( t ) => t.id );
	const allSelected = allTaskIds.length > 0 && allTaskIds.every( ( id ) => selectedIds.has( id ) );
	const someSelected = ! allSelected && allTaskIds.some( ( id ) => selectedIds.has( id ) );

	useEffect( () => {
		if ( selectAllRef.current ) selectAllRef.current.indeterminate = someSelected;
	}, [ someSelected ] );

	const toggleSelect = ( id: number ) =>
		setSelectedIds( ( prev ) => { const s = new Set( prev ); s.has( id ) ? s.delete( id ) : s.add( id ); return s; } );

	const toggleAll = () =>
		setSelectedIds( allSelected ? new Set() : new Set( allTaskIds ) );

	const toggleSection = ( statusValue: string ) =>
		setCollapsed( ( prev ) => ( { ...prev, [ statusValue ]: ! prev[ statusValue ] } ) );

	const hasFilters = !! search || !! priorityFilter;

	return (
		<div className="st-todox-page">
			<PageHeader
				title="Tasks"
				description={ `${ activeWorkspace?.name } · ${ tasks.length } task${ tasks.length !== 1 ? 's' : '' }` }
				actions={
					<div className="st-todox-page-header__btn-group">
						<ViewSwitcher />
						<Button onClick={ () => setCreateOpen( true ) } leftIcon={ <Plus size={ 14 } /> }>
							New Task
						</Button>
					</div>
				}
			/>

			<div className="st-todox-surface-card">
				{/* Toolbar */}
				<div className="st-todox-tasks-toolbar">
					<label className="st-todox-list-select-all" onClick={ ( e ) => e.stopPropagation() }>
						<input
							type="checkbox"
							ref={ selectAllRef }
							checked={ allSelected }
							onChange={ toggleAll }
						/>
					</label>
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
								onClick={ () => { setSearch( '' ); setPriority( '' ); } }
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

				{ isLoading || statusLoading ? (
					<div className="st-todox-page-loader"><Spinner /></div>
				) : tasks.length === 0 ? (
					<div className="st-todox-empty-inline">
						<AlertCircle size={ 36 } strokeWidth={ 1.5 } style={ { opacity: 0.3 } } />
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
						onDragOver={ handleDragOver }
						onDragEnd={ handleDragEnd }
					>
						<div className="st-todox-list-view">
							{ statuses.map( ( status ) => {
								const statusTasks = orderedGroups[ status.value ] ?? [];
								const isCollapsed = collapsed[ status.value ] ?? false;
								const sectionIds  = statusTasks.map( ( t ) => t.id );

								return (
									<div key={ status.value } className="st-todox-list-section">
										<button
											className="st-todox-list-section__header"
											onClick={ () => toggleSection( status.value ) }
										>
											<span
												className="st-todox-list-section__accent"
												style={ { background: status.color } }
											/>
											{ isCollapsed
												? <ChevronRight size={ 14 } className="st-todox-list-section__chevron" />
												: <ChevronDown  size={ 14 } className="st-todox-list-section__chevron" />
											}
											<span className="st-todox-list-section__title">{ status.label }</span>
											<span className="st-todox-list-section__count">{ statusTasks.length }</span>
										</button>

										{ ! isCollapsed && (
											<SortableContext
												items={ sectionIds }
												strategy={ verticalListSortingStrategy }
											>
												<DroppableSectionBody statusValue={ status.value }>
													{ statusTasks.length === 0 ? (
														<div className="st-todox-list-section__empty">
															Drop tasks here
														</div>
													) : (
														statusTasks.map( ( task ) => (
															<SortableListRow
																key={ task.id }
																task={ task }
																checked={ selectedIds.has( task.id ) }
																onSelect={ toggleSelect }
																onNavigate={ ( id ) => setSelectedTaskId( id ) }
																onDelete={ ( id ) => setDeleteId( id ) }
																statuses={ statuses }
																onStatusChange={ handleStatusChange }
																onPriorityChange={ handlePriorityChange }
															/>
														) )
													) }
													<InlineTaskInput
														statusValue={ status.value }
														statusId={ status.id }
													/>
												</DroppableSectionBody>
											</SortableContext>
										) }
									</div>
								);
							} ) }
						</div>

						<DragOverlay dropAnimation={ { duration: 160, easing: 'ease' } }>
							{ activeDragTask && <DragOverlayRow task={ activeDragTask } /> }
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

export default ListPage;
