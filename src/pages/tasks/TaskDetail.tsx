/**
 * External dependencies
 */
import { useState, useRef, useEffect } from '@wordpress/element';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	ArrowLeft, ChevronRight, ChevronDown, Edit3, Trash2, X, Plus, Check, GripVertical,
	User, Calendar, Clock, Tag, MessageSquare, Activity,
	CheckSquare2, CircleDashed, AlertCircle, Pencil,
} from 'lucide-react';

interface TaskDetailProps {
	taskId?: number;
	onClose?: () => void;
}

/**
 * dnd-kit
 */
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	SortableContext,
	verticalListSortingStrategy,
	useSortable,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Internal dependencies
 */
import { tasksApi, subtasksApi, usersApi } from '../../api';
import { useTaskStatuses } from '../../hooks/useTaskStatuses';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Avatar from '../../components/ui/Avatar';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import TablePickerMenu from '../../components/ui/TablePickerMenu';
import SubtaskModal from '../../components/features/task/SubtaskModal';
import { formatDate, formatRelativeTime, isOverdue } from '../../utils/helpers';
import type { Task, TaskComment, Subtask, TaskActivity, TaskStatus, TaskPriority, User as UserType } from '../../types';

/* ---- Priority config ---- */
const PRIORITY_BORDER: Record<string, string> = {
	urgent: '#ef4444',
	high:   '#f97316',
	medium: '#6366f1',
	low:    '#e2e8f0',
};

const ACTIVITY_CONFIG: Record<string, { chip: string; dot: string }> = {
	created:        { chip: 'st-todox-activity-chip--green',  dot: 'st-todox-activity-dot--green' },
	updated:        { chip: 'st-todox-activity-chip--blue',   dot: 'st-todox-activity-dot--blue' },
	status_changed: { chip: 'st-todox-activity-chip--violet', dot: 'st-todox-activity-dot--violet' },
	commented:      { chip: 'st-todox-activity-chip--amber',  dot: 'st-todox-activity-dot--amber' },
	completed:      { chip: 'st-todox-activity-chip--teal',   dot: 'st-todox-activity-dot--teal' },
};
const DEFAULT_ACTIVITY = { chip: 'st-todox-activity-chip--slate', dot: 'st-todox-activity-dot--slate' };

type Tab = 'subtasks' | 'comments' | 'activity';

/* ── Sortable subtask row ──────────────────────────────────────────────────── */
const SortableSubtaskRow = ( {
	st,
	checked,
	taskStatuses,
	users,
	onSelect,
	onEdit,
	onDelete,
	onStatusChange,
	onPriorityChange,
	onAssigneeChange,
	onDueDateChange,
}: {
	st:               Subtask;
	checked:          boolean;
	taskStatuses:     { value: string; label: string; color: string }[];
	users:            UserType[];
	onSelect:         ( id: number ) => void;
	onEdit:           ( st: Subtask ) => void;
	onDelete:         ( id: number ) => void;
	onStatusChange:   ( id: number, status: TaskStatus ) => void;
	onPriorityChange: ( id: number, priority: TaskPriority ) => void;
	onAssigneeChange: ( id: number, assigneeId: number | null ) => void;
	onDueDateChange:  ( id: number, dueDate: string | null ) => void;
} ) => {
	const [ dueDateEditing, setDueDateEditing ] = useState( false );

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: st.id } );

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity:   isDragging ? 0.35 : 1,
		position:  'relative',
		zIndex:    isDragging ? 1 : 'auto',
	};

	const overdue = isOverdue( st.due_date ) && st.status !== 'done';

	return (
		<tr
			ref={ setNodeRef }
			style={ style }
			{ ...attributes }
			className={ [
				'st-todox-table__row',
				overdue    ? 'st-todox-table__row--overdue'  : '',
				isDragging ? 'st-todox-table__row--dragging' : '',
				checked    ? 'st-todox-table__row--selected'  : '',
			].filter( Boolean ).join( ' ' ) }
		>
			<td className="st-todox-table__drag-cell" onClick={ ( e ) => e.stopPropagation() }>
				<span className="st-todox-table__drag-handle" { ...listeners }>
					<GripVertical size={ 14 } />
				</span>
			</td>

			<td className="st-todox-table__check-cell" onClick={ ( e ) => e.stopPropagation() }>
				<input
					type="checkbox"
					checked={ checked }
					onChange={ () => onSelect( st.id ) }
				/>
			</td>

			<td className="st-todox-table__title-cell">
				<div className="st-todox-table__title">{ st.title }</div>
				{ st.description && (
					<div className="st-todox-td-subtask__desc">{ st.description }</div>
				) }
			</td>

			{/* Status inline picker */}
			<td onClick={ ( e ) => e.stopPropagation() }>
				<TablePickerMenu trigger={ <StatusBadge status={ st.status } /> } title="Change status">
					{ taskStatuses.map( ( s ) => (
						<button
							key={ s.value }
							className={ `st-todox-inline-picker__item ${ st.status === s.value ? 'st-todox-inline-picker__item--active' : '' }` }
							onClick={ () => onStatusChange( st.id, s.value as TaskStatus ) }
						>
							<StatusBadge status={ s.value as TaskStatus } />
						</button>
					) ) }
				</TablePickerMenu>
			</td>

			{/* Priority inline picker */}
			<td onClick={ ( e ) => e.stopPropagation() }>
				<TablePickerMenu trigger={ <PriorityBadge priority={ st.priority } /> } title="Change priority">
					{ ( [ 'low', 'medium', 'high', 'urgent' ] as TaskPriority[] ).map( ( p ) => (
						<button
							key={ p }
							className={ `st-todox-inline-picker__item ${ st.priority === p ? 'st-todox-inline-picker__item--active' : '' }` }
							onClick={ () => onPriorityChange( st.id, p ) }
						>
							<PriorityBadge priority={ p } />
						</button>
					) ) }
				</TablePickerMenu>
			</td>

			{/* Assignee inline picker */}
			<td onClick={ ( e ) => e.stopPropagation() }>
				<TablePickerMenu
					trigger={
						st.assignee ? (
							<div className="st-todox-assignee">
								<Avatar name={ st.assignee.name } src={ st.assignee.avatar } size={ 18 } />
								<span className="st-todox-assignee__name">{ st.assignee.name }</span>
							</div>
						) : (
							<span className="st-todox-text--muted">—</span>
						)
					}
					title="Change assignee"
				>
					<button
						className={ `st-todox-inline-picker__item ${ ! st.assignee_id ? 'st-todox-inline-picker__item--active' : '' }` }
						onClick={ () => onAssigneeChange( st.id, null ) }
					>
						<span style={ { width: 16, height: 16, borderRadius: '50%', border: '1.5px dashed #94a3b8', display: 'inline-block', flexShrink: 0 } } />
						Unassigned
					</button>
					{ users.map( ( u ) => (
						<button
							key={ u.id }
							className={ `st-todox-inline-picker__item ${ st.assignee_id === u.id ? 'st-todox-inline-picker__item--active' : '' }` }
							onClick={ () => onAssigneeChange( st.id, u.id ) }
						>
							<Avatar name={ u.name } src={ u.avatar } size={ 16 } />
							{ u.name }
						</button>
					) ) }
				</TablePickerMenu>
			</td>

			{/* Due date inline picker */}
			<td onClick={ ( e ) => e.stopPropagation() }>
				{ dueDateEditing ? (
					<input
						type="date"
						className="st-todox-form__input st-todox-td-meta-date-input"
						defaultValue={ st.due_date ?? '' }
						autoFocus
						onChange={ ( e ) => {
							onDueDateChange( st.id, e.target.value || null );
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
						{ st.due_date ? (
							<span className={ `st-todox-table__due ${ overdue ? 'st-todox-table__due--overdue' : '' }` }>
								<Calendar size={ 12 } />
								{ formatDate( st.due_date ) }
							</span>
						) : (
							<span className="st-todox-text--muted">—</span>
						) }
						<Pencil size={ 10 } className="st-todox-inline-picker__chevron" />
					</button>
				) }
			</td>

			<td className="st-todox-table__actions-cell" onClick={ ( e ) => e.stopPropagation() }>
				<div className="st-todox-table__row-actions">
					<button
						className="st-todox-table__action-btn"
						onClick={ () => onEdit( st ) }
						title="Edit"
					>
						<Edit3 size={ 13 } />
					</button>
					<button
						className="st-todox-table__action-btn st-todox-table__action-btn--danger"
						onClick={ () => onDelete( st.id ) }
						title="Delete"
					>
						<Trash2 size={ 13 } />
					</button>
				</div>
			</td>
		</tr>
	);
};

const TaskDetail = ( { taskId: taskIdProp, onClose }: TaskDetailProps = {} ) => {
	const { id }       = useParams<{ id: string }>();
	const navigate     = useNavigate();
	const location     = useLocation();
	const qc           = useQueryClient();
	const isModal      = !! onClose;
	const taskId       = taskIdProp ?? Number( id );
	const fromKanban   = ! isModal && ( location.state as { from?: string } | null )?.from === 'kanban';
	const backPath     = fromKanban ? '/tasks/kanban' : '/tasks';
	const backLabel    = fromKanban ? 'Kanban' : 'Tasks';

	const [ activeTab, setActiveTab ]             = useState<Tab>( 'subtasks' );
	const [ newComment, setNewComment ]           = useState( '' );
	const [ deleteCommentId, setDeleteCommentId ] = useState<number | null>( null );
	const [ editingCommentId, setEditingCommentId ] = useState<number | null>( null );
	const [ editCommentContent, setEditCommentContent ] = useState( '' );
	const [ deleteTaskOpen, setDeleteTaskOpen ]   = useState( false );
	const [ subtaskModalOpen, setSubtaskModalOpen ] = useState( false );
	const [ editingSubtask, setEditingSubtask ]     = useState<Subtask | null>( null );
	const [ addingSubtask, setAddingSubtask ]         = useState( false );
	const [ newSubtaskTitle, setNewSubtaskTitle ]     = useState( '' );
	const [ orderedSubtasks, setOrderedSubtasks ]     = useState<Subtask[]>( [] );
	const [ selectedSubtaskIds, setSelectedSubtaskIds ] = useState<Set<number>>( new Set() );
	const [ deleteSubtaskConfirmId, setDeleteSubtaskConfirmId ] = useState<number | null>( null );
	const [ bulkSubtaskConfirmOpen, setBulkSubtaskConfirmOpen ] = useState( false );

	/* Kept as render-time assignment so drag handlers never see stale list */
	const orderedSubtasksRef = useRef<Subtask[]>( [] );
	orderedSubtasksRef.current = orderedSubtasks;

	/* Inline editing state */
	const [ editingTitle, setEditingTitle ]   = useState( false );
	const [ titleDraft, setTitleDraft ]       = useState( '' );
	const [ editingDesc, setEditingDesc ]     = useState( false );
	const [ descDraft, setDescDraft ]         = useState( '' );
	const [ statusOpen, setStatusOpen ]       = useState( false );
	const [ priorityOpen, setPriorityOpen ]   = useState( false );
	const [ assigneeOpen, setAssigneeOpen ]   = useState( false );
	const [ dueDateEditing, setDueDateEditing ] = useState( false );

	const skipTitleBlur    = useRef( false );
	const skipDescBlur     = useRef( false );
	const selectAllSubRef  = useRef<HTMLInputElement>( null );
	const subtaskInputRef  = useRef<HTMLInputElement>( null );

	const { data: task, isLoading } = useQuery( {
		queryKey: [ 'tasks', taskId ],
		queryFn:  () => tasksApi.getOne( taskId ),
		enabled:  !! taskId,
	} );

	const { statuses: taskStatuses } = useTaskStatuses();

	const taskWorkspaceId = task?.workspace_id ?? 0;
	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'workspace', taskWorkspaceId ],
		queryFn:  () => usersApi.getAll( { workspace_id: taskWorkspaceId, per_page: 100 } ),
		enabled:  !! taskWorkspaceId,
		staleTime: 5 * 60_000,
	} );
	const users = usersData?.items ?? [];

	const invalidate = () => {
		qc.invalidateQueries( { queryKey: [ 'tasks', taskId ] } );
		qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
	};

	const inlineMutation = useMutation( {
		mutationFn: ( data: Partial<Task> ) => tasksApi.update( taskId, data ),
		onSuccess:  () => { invalidate(); toast.success( 'Updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const saveTitle = () => {
		if ( titleDraft.trim() && titleDraft.trim() !== task?.title ) {
			inlineMutation.mutate( { title: titleDraft.trim() } );
		}
	};

	const saveDesc = () => {
		const val = descDraft.trim() || null;
		if ( val !== ( task?.description ?? null ) ) {
			inlineMutation.mutate( { description: val } as Partial<Task> );
		}
	};

	const deleteMutation = useMutation( {
		mutationFn: () => tasksApi.delete( taskId ),
		onSuccess:  () => {
			toast.success( 'Task deleted.' );
			if ( onClose ) {
				onClose();
			} else {
				navigate( backPath );
			}
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const addCommentMutation = useMutation( {
		mutationFn: ( content: string ) => tasksApi.addComment( taskId, content ),
		onSuccess:  () => { invalidate(); setNewComment( '' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const deleteCommentMutation = useMutation( {
		mutationFn: ( commentId: number ) => tasksApi.deleteComment( taskId, commentId ),
		onSuccess:  () => { invalidate(); setDeleteCommentId( null ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const updateCommentMutation = useMutation( {
		mutationFn: ( { commentId, content }: { commentId: number; content: string } ) =>
			tasksApi.updateComment( taskId, commentId, content ),
		onSuccess: () => {
			invalidate();
			setEditingCommentId( null );
			setEditCommentContent( '' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const startEditComment = ( c: TaskComment ) => {
		setEditingCommentId( c.id );
		setEditCommentContent( c.content );
	};

	const cancelEditComment = () => {
		setEditingCommentId( null );
		setEditCommentContent( '' );
	};

	const saveEditComment = () => {
		if ( ! editCommentContent.trim() || ! editingCommentId ) return;
		updateCommentMutation.mutate( { commentId: editingCommentId, content: editCommentContent.trim() } );
	};

	const updateSubtaskMutation = useMutation( {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mutationFn: ( { id, data }: { id: number; data: Record<string, any> } ) =>
			subtasksApi.update( taskId, id, data ),
		onSuccess: () => invalidate(),
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	const handleSubtaskStatusChange   = ( id: number, status: TaskStatus )       => updateSubtaskMutation.mutate( { id, data: { status } } );
	const handleSubtaskPriorityChange = ( id: number, priority: TaskPriority )    => updateSubtaskMutation.mutate( { id, data: { priority } } );
	const handleSubtaskAssigneeChange = ( id: number, assigneeId: number | null ) => updateSubtaskMutation.mutate( { id, data: { assignee_id: assigneeId } } );
	const handleSubtaskDueDateChange  = ( id: number, dueDate: string | null )    => updateSubtaskMutation.mutate( { id, data: { due_date: dueDate } } );

	const deleteSubtaskMutation = useMutation( {
		mutationFn: ( subtaskId: number ) => subtasksApi.delete( taskId, subtaskId ),
		onSuccess: () => { invalidate(); setSelectedSubtaskIds( new Set() ); setDeleteSubtaskConfirmId( null ); },
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	const addSubtaskMutation = useMutation( {
		mutationFn: ( title: string ) => subtasksApi.create( taskId, { title } ),
		onSuccess: () => { invalidate(); setNewSubtaskTitle( '' ); setTimeout( () => subtaskInputRef.current?.focus(), 0 ); },
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	const reorderSubtaskMutation = useMutation( {
		mutationFn: ( items: Array<{ id: number; position: number }> ) =>
			subtasksApi.reorder( taskId, items ),
		onError: ( err: Error ) => {
			toast.error( err.message );
			qc.invalidateQueries( { queryKey: [ 'tasks', taskId ] } );
		},
	} );

	const bulkDeleteSubtasksMutation = useMutation( {
		mutationFn: ( ids: number[] ) =>
			Promise.all( ids.map( ( id ) => subtasksApi.delete( taskId, id ) ) ),
		onSuccess: () => {
			invalidate();
			setSelectedSubtaskIds( new Set() );
			setBulkSubtaskConfirmOpen( false );
			toast.success( 'Subtasks deleted.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const subtaskSensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 5 } } )
	);

	/* Sync local ordered list whenever server data refreshes */
	useEffect( () => {
		if ( task?.subtasks ) setOrderedSubtasks( task.subtasks );
	}, [ task?.subtasks ] ); // eslint-disable-line react-hooks/exhaustive-deps

	/* Select-all indeterminate state — must stay before early returns */
	const allSubtasksSelected  = orderedSubtasks.length > 0 && orderedSubtasks.every( ( s ) => selectedSubtaskIds.has( s.id ) );
	const someSubtasksSelected = ! allSubtasksSelected && orderedSubtasks.some( ( s ) => selectedSubtaskIds.has( s.id ) );

	useEffect( () => {
		if ( selectAllSubRef.current ) selectAllSubRef.current.indeterminate = someSubtasksSelected;
	}, [ someSubtasksSelected ] );

	if ( isLoading ) return <Spinner fullscreen={ ! isModal } />;
	if ( ! task )    return <div className="st-todox-page"><p>Task not found.</p></div>;

	const subtasks   = task.subtasks   ?? [];
	const comments   = task.comments   ?? [];
	const activities = task.activities ?? [];
	const doneSubtasks   = subtasks.filter( ( s ) => s.completed ).length;
	const subtaskProgress = subtasks.length > 0 ? ( doneSubtasks / subtasks.length ) * 100 : 0;
	const overdue         = isOverdue( task.due_date );
	const borderColor     = PRIORITY_BORDER[ task.priority ] ?? '#e2e8f0';
	const isCompleted     = task.status === 'completed';

	const handleSubtaskDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		if ( ! over || active.id === over.id ) return;
		const oldIdx    = orderedSubtasksRef.current.findIndex( ( s ) => s.id === active.id );
		const newIdx    = orderedSubtasksRef.current.findIndex( ( s ) => s.id === over.id );
		const reordered = arrayMove( orderedSubtasksRef.current, oldIdx, newIdx );
		setOrderedSubtasks( reordered );
		reorderSubtaskMutation.mutate( reordered.map( ( s, idx ) => ( { id: s.id, position: idx } ) ) );
	};

	const toggleSubtaskSelect = ( id: number ) =>
		setSelectedSubtaskIds( ( prev ) => {
			const s = new Set( prev );
			s.has( id ) ? s.delete( id ) : s.add( id );
			return s;
		} );

	const toggleAllSubtasks = () =>
		setSelectedSubtaskIds( allSubtasksSelected
			? new Set()
			: new Set( orderedSubtasks.map( ( s ) => s.id ) )
		);

	const TABS: { id: Tab; label: string; count: number }[] = [
		{ id: 'subtasks', label: 'Subtasks', count: subtasks.length },
		{ id: 'comments', label: 'Comments', count: comments.length },
		{ id: 'activity', label: 'Activity',  count: activities.length },
	];

	return (
		<div className={ `st-todox-page st-todox-td${ isModal ? ' st-todox-td--modal' : '' }` }>

			{/* Breadcrumb — hidden in modal mode */}
			{ ! isModal && (
				<div className="st-todox-td__breadcrumb">
					<button className="st-todox-td__bc-link" onClick={ () => navigate( backPath ) }>
						<ArrowLeft size={ 13 } /> { backLabel }
					</button>
					<ChevronRight size={ 11 } className="st-todox-td__bc-sep" />
					<span className="st-todox-td__bc-current">{ task.title }</span>
				</div>
			) }

			<div className="st-todox-td__grid">

				{/* ── Main column ── */}
				<div className="st-todox-td__main">

					{/* Header card */}
					<div
						className="st-todox-td-card st-todox-td-card--header"
						style={ { borderLeftColor: borderColor } }
					>
						{ overdue && (
							<div className="st-todox-td-card__overdue-row">
								<span className="st-todox-td-overdue-chip">
									<AlertCircle size={ 10 } /> Overdue
								</span>
							</div>
						) }

						{/* Title row: inline-editable title + delete button */}
						<div className="st-todox-td-card__title-row">
							{ editingTitle ? (
								<input
									className="st-todox-td-card__title-input"
									value={ titleDraft }
									onChange={ ( e ) => setTitleDraft( e.target.value ) }
									autoFocus
									onKeyDown={ ( e ) => {
										if ( e.key === 'Enter' ) {
											skipTitleBlur.current = true;
											saveTitle();
											setEditingTitle( false );
										}
										if ( e.key === 'Escape' ) {
											skipTitleBlur.current = true;
											setEditingTitle( false );
										}
									} }
									onBlur={ () => {
										if ( skipTitleBlur.current ) { skipTitleBlur.current = false; return; }
										saveTitle();
										setEditingTitle( false );
									} }
								/>
							) : (
								<h1
									className={ `st-todox-td-card__title st-todox-td-card__title--editable ${ isCompleted ? 'st-todox-td-card__title--done' : '' }` }
									onClick={ () => { setTitleDraft( task.title ); setEditingTitle( true ); } }
									title="Click to edit title"
								>
									{ task.title }
									<Pencil size={ 12 } className="st-todox-td-card__title-edit-icon" />
								</h1>
							) }
							<button
								className="st-todox-td-delete-btn"
								onClick={ () => setDeleteTaskOpen( true ) }
								title="Delete task"
							>
								<Trash2 size={ 14 } />
							</button>
						</div>

						{/* Description — inline editable */}
						{ editingDesc ? (
							<div className="st-todox-td-card__desc-edit">
								<textarea
									className="st-todox-form__textarea"
									rows={ 4 }
									value={ descDraft }
									onChange={ ( e ) => setDescDraft( e.target.value ) }
									placeholder="Add a description…"
									autoFocus
									onKeyDown={ ( e ) => {
										if ( e.key === 'Escape' ) {
											skipDescBlur.current = true;
											setEditingDesc( false );
										}
										if ( e.key === 'Enter' && ( e.metaKey || e.ctrlKey ) ) {
											skipDescBlur.current = true;
											saveDesc();
											setEditingDesc( false );
										}
									} }
									onBlur={ () => {
										if ( skipDescBlur.current ) { skipDescBlur.current = false; return; }
										saveDesc();
										setEditingDesc( false );
									} }
								/>
								<div className="st-todox-td-inline-desc-actions">
									<span className="st-todox-td-inline-hint">⌘ + Enter to save · Esc to cancel</span>
									<div style={ { display: 'flex', gap: 6 } }>
										<button
											className="st-todox-td-inline-btn st-todox-td-inline-btn--cancel"
											onMouseDown={ ( e ) => { e.preventDefault(); skipDescBlur.current = true; setEditingDesc( false ); } }
										>
											Cancel
										</button>
										<button
											className="st-todox-td-inline-btn st-todox-td-inline-btn--save"
											onMouseDown={ ( e ) => { e.preventDefault(); skipDescBlur.current = true; saveDesc(); setEditingDesc( false ); } }
										>
											Save
										</button>
									</div>
								</div>
							</div>
						) : (
							<div
								className="st-todox-td-card__desc-wrap st-todox-td-card__desc-wrap--editable"
								onClick={ () => { setDescDraft( task.description ?? '' ); setEditingDesc( true ); } }
								title="Click to edit description"
							>
								{ task.description ? (
									<p className="st-todox-td-card__desc">{ task.description }</p>
								) : (
									<p className="st-todox-td-card__desc st-todox-td-card__desc--empty">
										<Pencil size={ 11 } style={ { opacity: 0.5, marginRight: 4 } } />
										Click to add a description…
									</p>
								) }
							</div>
						) }

						{/* Labels */}
						{ task.labels.length > 0 && (
							<div className="st-todox-td-card__labels">
								{ task.labels.map( ( lbl ) => (
									<span
										key={ lbl.id }
										className="st-todox-label"
										style={ { background: lbl.color + '1a', color: lbl.color, border: `1px solid ${ lbl.color }35` } }
									>
										<span className="st-todox-label__dot" style={ { background: lbl.color } } />
										{ lbl.name }
									</span>
								) ) }
							</div>
						) }
					</div>

					{/* Tab bar */}
					<div className="st-todox-td-tabs">
						<div className="st-todox-td-tabs__bar">
							{ TABS.map( ( tab ) => (
								<button
									key={ tab.id }
									className={ `st-todox-td-tabs__btn ${ activeTab === tab.id ? 'st-todox-td-tabs__btn--active' : '' }` }
									onClick={ () => setActiveTab( tab.id ) }
								>
									{ tab.label }
									{ tab.count > 0 && (
										<span className="st-todox-td-tabs__count">{ tab.count }</span>
									) }
								</button>
							) ) }
						</div>

						{/* ── Subtasks ── */}
						{ activeTab === 'subtasks' && (
							<div className="st-todox-td-tab-body">
								{ subtasks.length > 0 && (
									<div className="st-todox-td-subtask-progress">
										<div className="st-todox-td-subtask-progress__label">
											<span>{ doneSubtasks } of { subtasks.length } done</span>
											<span>{ Math.round( subtaskProgress ) }%</span>
										</div>
										<div className="st-todox-td-subtask-progress__track">
											<div
												className="st-todox-td-subtask-progress__fill"
												style={ { width: `${ subtaskProgress }%` } }
											/>
										</div>
									</div>
								) }

								{ selectedSubtaskIds.size > 0 && (
									<div className="st-todox-bulk-bar">
										<span className="st-todox-bulk-bar__count">{ selectedSubtaskIds.size } selected</span>
										<div className="st-todox-bulk-bar__actions">
											<button
												className="st-todox-bulk-bar__btn st-todox-bulk-bar__btn--danger"
												onClick={ () => setBulkSubtaskConfirmOpen( true ) }
												disabled={ bulkDeleteSubtasksMutation.isPending }
											>
												<Trash2 size={ 12 } /> Delete
											</button>
											<button
												className="st-todox-bulk-bar__btn st-todox-bulk-bar__btn--ghost"
												onClick={ () => setSelectedSubtaskIds( new Set() ) }
											>
												<X size={ 12 } /> Clear
											</button>
										</div>
									</div>
								) }

								{ orderedSubtasks.length === 0 ? (
									<div className="st-todox-td-empty">
										<CircleDashed size={ 32 } className="st-todox-td-empty__icon" />
										<p>No subtasks yet</p>
									</div>
								) : (
									<DndContext
										sensors={ subtaskSensors }
										collisionDetection={ closestCenter }
										onDragEnd={ handleSubtaskDragEnd }
									>
										<div className="st-todox-table-wrapper">
											<table className="st-todox-table">
												<thead>
													<tr>
														<th style={ { width: 32 } } />
														<th className="st-todox-table__check-cell">
																<input
																	type="checkbox"
																	ref={ selectAllSubRef }
																	checked={ allSubtasksSelected }
																	onChange={ toggleAllSubtasks }
																/>
															</th>
														<th>Title</th>
														<th>Status</th>
														<th>Priority</th>
														<th>Assignee</th>
														<th>Due Date</th>
														<th style={ { width: 40 } } />
													</tr>
												</thead>
												<SortableContext
													items={ orderedSubtasks.map( ( s ) => s.id ) }
													strategy={ verticalListSortingStrategy }
												>
													<tbody>
														{ orderedSubtasks.map( ( st ) => (
															<SortableSubtaskRow
																key={ st.id }
																st={ st }
																checked={ selectedSubtaskIds.has( st.id ) }
																taskStatuses={ taskStatuses }
																users={ users }
																onSelect={ toggleSubtaskSelect }
																onEdit={ ( s ) => { setEditingSubtask( s ); setSubtaskModalOpen( true ); } }
																onDelete={ ( id ) => setDeleteSubtaskConfirmId( id ) }
																onStatusChange={ handleSubtaskStatusChange }
																onPriorityChange={ handleSubtaskPriorityChange }
																onAssigneeChange={ handleSubtaskAssigneeChange }
																onDueDateChange={ handleSubtaskDueDateChange }
															/>
														) ) }
													</tbody>
												</SortableContext>
											</table>
										</div>
									</DndContext>
								) }

								{/* Inline add subtask */}
								{ addingSubtask ? (
									<div className="st-todox-inline-task-input">
										<input
											ref={ subtaskInputRef }
											type="text"
											className="st-todox-inline-task-input__field"
											placeholder="Subtask name…"
											value={ newSubtaskTitle }
											onChange={ ( e ) => setNewSubtaskTitle( e.target.value ) }
											autoFocus
											disabled={ addSubtaskMutation.isPending }
											onKeyDown={ ( e ) => {
												if ( e.key === 'Enter' && newSubtaskTitle.trim() ) {
													addSubtaskMutation.mutate( newSubtaskTitle.trim() );
												}
												if ( e.key === 'Escape' ) {
													setNewSubtaskTitle( '' );
													setAddingSubtask( false );
												}
											} }
										/>
										<button
											className="st-todox-inline-task-input__btn st-todox-inline-task-input__btn--save"
											onClick={ () => { if ( newSubtaskTitle.trim() ) addSubtaskMutation.mutate( newSubtaskTitle.trim() ); } }
											disabled={ ! newSubtaskTitle.trim() || addSubtaskMutation.isPending }
											title="Save (Enter)"
										>
											<Check size={ 13 } />
										</button>
										<button
											className="st-todox-inline-task-input__btn st-todox-inline-task-input__btn--cancel"
											onClick={ () => { setNewSubtaskTitle( '' ); setAddingSubtask( false ); } }
											disabled={ addSubtaskMutation.isPending }
											title="Cancel (Esc)"
										>
											<X size={ 13 } />
										</button>
									</div>
								) : (
									<button
										className="st-todox-add-task-row"
										onClick={ () => setAddingSubtask( true ) }
									>
										<Plus size={ 13 } />
										Add Subtask
									</button>
								) }
							</div>
						) }

						{/* ── Comments ── */}
						{ activeTab === 'comments' && (
							<div className="st-todox-td-tab-body st-todox-td-tab-body--comments">
								{ comments.length === 0 ? (
									<div className="st-todox-td-empty">
										<MessageSquare size={ 32 } className="st-todox-td-empty__icon" />
										<p className="st-todox-td-empty__title">No comments yet</p>
										<p className="st-todox-td-empty__hint">Be the first to comment on this task.</p>
									</div>
								) : (
									<div className="st-todox-td-comment-list">
										{ comments.map( ( c: TaskComment ) => (
											<div key={ c.id } className="st-todox-td-comment">
												<Avatar name={ c.author.name } src={ c.author.avatar } size={ 30 } />
												<div className="st-todox-td-comment__body">
													<div className="st-todox-td-comment__meta">
														<span className="st-todox-td-comment__author">{ c.author.name }</span>
														<span className="st-todox-td-comment__time">{ formatRelativeTime( c.created_at ) }</span>
														{ editingCommentId !== c.id && (
															<div className="st-todox-td-comment__actions">
																<button
																	className="st-todox-td-comment__edit"
																	onClick={ () => startEditComment( c ) }
																	title="Edit comment"
																>
																	<Edit3 size={ 11 } />
																</button>
																<button
																	className="st-todox-td-comment__del"
																	onClick={ () => setDeleteCommentId( c.id ) }
																	title="Delete comment"
																>
																	<Trash2 size={ 11 } />
																</button>
															</div>
														) }
													</div>
													{ editingCommentId === c.id ? (
														<div className="st-todox-td-comment__edit-wrap">
															<textarea
																className="st-todox-form__textarea"
																rows={ 3 }
																value={ editCommentContent }
																onChange={ ( e ) => setEditCommentContent( e.target.value ) }
																autoFocus
																onKeyDown={ ( e ) => {
																	if ( e.key === 'Enter' && ( e.metaKey || e.ctrlKey ) ) saveEditComment();
																	if ( e.key === 'Escape' ) cancelEditComment();
																} }
															/>
															<div className="st-todox-td-comment-add__footer">
																<span className="st-todox-td-comment-add__hint">⌘ + Enter to save · Esc to cancel</span>
																<div style={ { display: 'flex', gap: 6 } }>
																	<Button size="sm" variant="secondary" onClick={ cancelEditComment }>
																		Cancel
																	</Button>
																	<Button
																		size="sm"
																		onClick={ saveEditComment }
																		loading={ updateCommentMutation.isPending }
																		disabled={ ! editCommentContent.trim() }
																	>
																		Save
																	</Button>
																</div>
															</div>
														</div>
													) : (
														<div className="st-todox-td-comment__bubble">{ c.content }</div>
													) }
												</div>
											</div>
										) ) }
									</div>
								) }

								{/* Add comment */}
								<div className="st-todox-td-comment-add">
									<textarea
										className="st-todox-form__textarea"
										rows={ 3 }
										placeholder="Write a comment… (Enter to submit)"
										value={ newComment }
										onChange={ ( e ) => setNewComment( e.target.value ) }
										onKeyDown={ ( e ) => {
											if ( e.key === 'Enter' && ( e.metaKey || e.ctrlKey ) && newComment.trim() ) {
												addCommentMutation.mutate( newComment.trim() );
											}
										} }
									/>
									<div className="st-todox-td-comment-add__footer">
										<span className="st-todox-td-comment-add__hint">⌘ + Enter to submit</span>
										<Button
											size="sm"
											onClick={ () => { if ( newComment.trim() ) addCommentMutation.mutate( newComment.trim() ); } }
											loading={ addCommentMutation.isPending }
											disabled={ ! newComment.trim() }
										>
											<MessageSquare size={ 13 } /> Post Comment
										</Button>
									</div>
								</div>
							</div>
						) }

						{/* ── Activity ── */}
						{ activeTab === 'activity' && (
							<div className="st-todox-td-tab-body">
								{ activities.length === 0 ? (
									<div className="st-todox-td-empty">
										<Activity size={ 32 } className="st-todox-td-empty__icon" />
										<p>No activity yet</p>
									</div>
								) : (
									<div className="st-todox-td-activity-list">
										{ activities.map( ( a: TaskActivity, idx: number ) => {
											const cfg    = ACTIVITY_CONFIG[ a.action ] ?? DEFAULT_ACTIVITY;
											const isLast = idx === activities.length - 1;
											return (
												<div key={ a.id } className="st-todox-td-activity">
													<div className="st-todox-td-activity__left">
														<Avatar name={ a.user.name } src={ a.user.avatar } size={ 24 } />
														{ ! isLast && <div className="st-todox-td-activity__line" /> }
													</div>
													<div className="st-todox-td-activity__body">
														<div className="st-todox-td-activity__row">
															<span className="st-todox-td-activity__user">
																{ a.user.name.split( ' ' )[ 0 ] }
															</span>
															<span className={ `st-todox-activity-chip ${ cfg.chip }` }>
																{ a.action.replace( /_/g, ' ' ) }
															</span>
															<div className={ `st-todox-activity-dot ${ cfg.dot }` } />
														</div>
														{ a.detail && (
															<p className="st-todox-td-activity__detail">{ a.detail }</p>
														) }
														<p className="st-todox-td-activity__time">{ formatRelativeTime( a.created_at ) }</p>
													</div>
												</div>
											);
										} ) }
									</div>
								) }
							</div>
						) }
					</div>
				</div>

				{/* ── Sidebar ── */}
				<aside className="st-todox-td__sidebar">

					{/* Details card */}
					<div className="st-todox-td-meta-card">
						<div className="st-todox-td-meta-card__head">Task Details</div>
						<div className="st-todox-td-meta-card__body">

							{/* Status — inline picker */}
							<div className="st-todox-td-meta-row">
								<span className="st-todox-td-meta-row__label"><CircleDashed size={ 13 } /> Status</span>
								<div className="st-todox-inline-picker">
									<button
										className="st-todox-inline-picker__trigger st-todox-inline-picker__trigger--meta"
										onClick={ () => setStatusOpen( ( v ) => ! v ) }
										title="Change status"
									>
										<StatusBadge status={ task.status } />
										<ChevronDown size={ 10 } className="st-todox-inline-picker__chevron" />
									</button>
									{ statusOpen && (
										<>
											<div className="st-todox-inline-picker__backdrop" onClick={ () => setStatusOpen( false ) } />
											<div className="st-todox-inline-picker__menu st-todox-inline-picker__menu--right">
												{ taskStatuses.map( ( s ) => (
													<button
														key={ s.value }
														className={ `st-todox-inline-picker__item ${ task.status === s.value ? 'st-todox-inline-picker__item--active' : '' }` }
														onClick={ () => { inlineMutation.mutate( { status: s.value as TaskStatus } ); setStatusOpen( false ); } }
													>
														<StatusBadge status={ s.value as TaskStatus } />
													</button>
												) ) }
											</div>
										</>
									) }
								</div>
							</div>

							{/* Priority — inline picker */}
							<div className="st-todox-td-meta-row">
								<span className="st-todox-td-meta-row__label"><AlertCircle size={ 13 } /> Priority</span>
								<div className="st-todox-inline-picker">
									<button
										className="st-todox-inline-picker__trigger st-todox-inline-picker__trigger--meta"
										onClick={ () => setPriorityOpen( ( v ) => ! v ) }
										title="Change priority"
									>
										<PriorityBadge priority={ task.priority } />
										<ChevronDown size={ 10 } className="st-todox-inline-picker__chevron" />
									</button>
									{ priorityOpen && (
										<>
											<div className="st-todox-inline-picker__backdrop" onClick={ () => setPriorityOpen( false ) } />
											<div className="st-todox-inline-picker__menu st-todox-inline-picker__menu--right">
												{ ( [ 'low', 'medium', 'high', 'urgent' ] as TaskPriority[] ).map( ( p ) => (
													<button
														key={ p }
														className={ `st-todox-inline-picker__item ${ task.priority === p ? 'st-todox-inline-picker__item--active' : '' }` }
														onClick={ () => { inlineMutation.mutate( { priority: p } ); setPriorityOpen( false ); } }
													>
														<PriorityBadge priority={ p } />
													</button>
												) ) }
											</div>
										</>
									) }
								</div>
							</div>

							{/* Assignee — inline picker */}
							<div className="st-todox-td-meta-row">
								<span className="st-todox-td-meta-row__label"><User size={ 13 } /> Assignee</span>
								<div className="st-todox-inline-picker">
									<button
										className="st-todox-inline-picker__trigger st-todox-inline-picker__trigger--meta"
										onClick={ () => setAssigneeOpen( ( v ) => ! v ) }
										title="Change assignee"
									>
										{ task.assignee ? (
											<div className="st-todox-assignee">
												<Avatar name={ task.assignee.name } src={ task.assignee.avatar } size={ 18 } />
												<span className="st-todox-td-meta-row__val-bold">{ task.assignee.name }</span>
											</div>
										) : (
											<span className="st-todox-td-meta-row__val-muted">
												<span className="st-todox-td-meta-row__empty-circle" /> Unassigned
											</span>
										) }
										<ChevronDown size={ 10 } className="st-todox-inline-picker__chevron" />
									</button>
									{ assigneeOpen && (
										<>
											<div className="st-todox-inline-picker__backdrop" onClick={ () => setAssigneeOpen( false ) } />
											<div className="st-todox-inline-picker__menu st-todox-inline-picker__menu--right">
												<button
													className={ `st-todox-inline-picker__item ${ ! task.assignee_id ? 'st-todox-inline-picker__item--active' : '' }` }
													onClick={ () => { inlineMutation.mutate( { assignee_id: null } as Partial<Task> ); setAssigneeOpen( false ); } }
												>
													<span className="st-todox-td-meta-row__empty-circle" style={ { marginRight: 4 } } />
													Unassigned
												</button>
												{ users.map( ( u ) => (
													<button
														key={ u.id }
														className={ `st-todox-inline-picker__item ${ task.assignee_id === u.id ? 'st-todox-inline-picker__item--active' : '' }` }
														onClick={ () => { inlineMutation.mutate( { assignee_id: u.id } ); setAssigneeOpen( false ); } }
													>
														<Avatar name={ u.name } src={ u.avatar } size={ 16 } />
														{ u.name }
													</button>
												) ) }
											</div>
										</>
									) }
								</div>
							</div>

							{/* Due date — inline date picker */}
							<div className="st-todox-td-meta-row">
								<span className="st-todox-td-meta-row__label"><Calendar size={ 13 } /> Due Date</span>
								{ dueDateEditing ? (
									<input
										type="date"
										className="st-todox-form__input st-todox-td-meta-date-input"
										defaultValue={ task.due_date ?? '' }
										autoFocus
										onChange={ ( e ) => {
											inlineMutation.mutate( { due_date: e.target.value || null } as Partial<Task> );
											setDueDateEditing( false );
										} }
										onBlur={ () => setDueDateEditing( false ) }
										onKeyDown={ ( e ) => { if ( e.key === 'Escape' ) setDueDateEditing( false ); } }
									/>
								) : (
									<button
										className="st-todox-inline-picker__trigger st-todox-inline-picker__trigger--meta"
										onClick={ () => setDueDateEditing( true ) }
										title="Set due date"
									>
										<span className={ `st-todox-td-meta-row__val-bold ${ overdue ? 'st-todox-text--danger' : '' }` }>
											{ task.due_date ? formatDate( task.due_date ) : (
												<span className="st-todox-td-meta-row__val-muted">Not set</span>
											) }
											{ overdue && <span className="st-todox-td-overdue-pill">Overdue</span> }
										</span>
										<Pencil size={ 11 } className="st-todox-inline-picker__chevron" />
									</button>
								) }
							</div>

							<div className="st-todox-td-meta-row">
								<span className="st-todox-td-meta-row__label"><User size={ 13 } /> Created by</span>
								<span className="st-todox-td-meta-row__val-bold">{ task.creator.name }</span>
							</div>

							<div className="st-todox-td-meta-row">
								<span className="st-todox-td-meta-row__label"><Clock size={ 13 } /> Created</span>
								<span className="st-todox-td-meta-row__val">{ formatRelativeTime( task.created_at ) }</span>
							</div>

							{ task.labels.length > 0 && (
								<div className="st-todox-td-meta-row st-todox-td-meta-row--col">
									<span className="st-todox-td-meta-row__label"><Tag size={ 13 } /> Labels</span>
									<div className="st-todox-td-meta-row__labels">
										{ task.labels.map( ( lbl ) => (
											<span
												key={ lbl.id }
												className="st-todox-label"
												style={ { background: lbl.color + '1a', color: lbl.color, border: `1px solid ${ lbl.color }35` } }
											>
												{ lbl.name }
											</span>
										) ) }
									</div>
								</div>
							) }
						</div>
					</div>

					{/* Quick stats */}
					<div className="st-todox-td-stats">
						<div className="st-todox-td-stat">
							<div className="st-todox-td-stat__label">
								<MessageSquare size={ 13 } className="st-todox-td-stat__icon st-todox-td-stat__icon--indigo" />
								Comments
							</div>
							<p className="st-todox-td-stat__value">{ comments.length }</p>
						</div>
						<div className="st-todox-td-stat">
							<div className="st-todox-td-stat__label">
								<CheckSquare2 size={ 13 } className="st-todox-td-stat__icon st-todox-td-stat__icon--green" />
								Subtasks
							</div>
							<p className="st-todox-td-stat__value">
								{ doneSubtasks }
								<span className="st-todox-td-stat__total">/{ subtasks.length }</span>
							</p>
						</div>
					</div>

				</aside>
			</div>

			<ConfirmDialog
				isOpen={ deleteTaskOpen }
				onClose={ () => setDeleteTaskOpen( false ) }
				onConfirm={ () => deleteMutation.mutate() }
				title="Delete Task"
				message={ `Are you sure you want to delete "${ task.title }"? This cannot be undone.` }
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
			/>

			<ConfirmDialog
				isOpen={ !! deleteCommentId }
				onClose={ () => setDeleteCommentId( null ) }
				onConfirm={ () => deleteCommentId && deleteCommentMutation.mutate( deleteCommentId ) }
				message="Delete this comment? This cannot be undone."
				confirmLabel="Delete"
				loading={ deleteCommentMutation.isPending }
			/>

			<ConfirmDialog
				isOpen={ !! deleteSubtaskConfirmId }
				onClose={ () => setDeleteSubtaskConfirmId( null ) }
				onConfirm={ () => deleteSubtaskConfirmId && deleteSubtaskMutation.mutate( deleteSubtaskConfirmId ) }
				message="Delete this subtask? This cannot be undone."
				confirmLabel="Delete"
				loading={ deleteSubtaskMutation.isPending }
			/>

			<ConfirmDialog
				isOpen={ bulkSubtaskConfirmOpen }
				onClose={ () => setBulkSubtaskConfirmOpen( false ) }
				onConfirm={ () => bulkDeleteSubtasksMutation.mutate( [ ...selectedSubtaskIds ] ) }
				title="Delete Subtasks"
				message={ `Delete ${ selectedSubtaskIds.size } selected subtask${ selectedSubtaskIds.size !== 1 ? 's' : '' }? This cannot be undone.` }
				confirmLabel="Delete"
				loading={ bulkDeleteSubtasksMutation.isPending }
			/>

			<SubtaskModal
				isOpen={ subtaskModalOpen }
				onClose={ () => { setSubtaskModalOpen( false ); setEditingSubtask( null ); } }
				taskId={ taskId }
				workspaceId={ task?.workspace_id ?? 0 }
				subtask={ editingSubtask ?? undefined }
				onSaved={ () => { qc.invalidateQueries( { queryKey: [ 'tasks', taskId ] } ); } }
			/>
		</div>
	);
};

export default TaskDetail;
