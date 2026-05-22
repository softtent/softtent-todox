/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	ArrowLeft, ChevronRight, Edit3, Trash2, X, Plus,
	User, Calendar, Clock, Tag, MessageSquare, Activity,
	CheckSquare2, CircleDashed, AlertCircle, Circle,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { tasksApi, subtasksApi, usersApi, sprintsApi } from '../../api';
import { useTaskStatuses } from '../../hooks/useTaskStatuses';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Avatar from '../../components/ui/Avatar';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SubtaskModal from '../../components/features/task/SubtaskModal';
import { formatDate, formatRelativeTime, isOverdue } from '../../utils/helpers';
import type { Task, TaskComment, Subtask, TaskActivity, TaskStatus, TaskPriority, Sprint } from '../../types';

/* ---- Priority config ---- */
const PRIORITY_BORDER: Record<string, string> = {
	urgent: '#ef4444',
	high:   '#f97316',
	medium: '#6366f1',
	low:    '#e2e8f0',
};

const PRIORITY_ACCENT: Record<string, string> = {
	urgent: '#ef4444',
	high:   '#f97316',
	medium: '#6366f1',
	low:    '#94a3b8',
};

const ACTIVITY_CONFIG: Record<string, { chip: string; dot: string }> = {
	created:        { chip: 'st-todox-activity-chip--green',  dot: 'st-todox-activity-dot--green' },
	updated:        { chip: 'st-todox-activity-chip--blue',   dot: 'st-todox-activity-dot--blue' },
	status_changed: { chip: 'st-todox-activity-chip--violet', dot: 'st-todox-activity-dot--violet' },
	commented:      { chip: 'st-todox-activity-chip--amber',  dot: 'st-todox-activity-dot--amber' },
	completed:      { chip: 'st-todox-activity-chip--teal',   dot: 'st-todox-activity-dot--teal' },
};
const DEFAULT_ACTIVITY = { chip: 'st-todox-activity-chip--slate', dot: 'st-todox-activity-dot--slate' };

const SUBTASK_STATUS_COLOR: Record<string, string> = {
	todo:        '#94a3b8',
	in_progress: '#6366f1',
	done:        '#10b981',
};

const SUBTASK_STATUS_LABEL: Record<string, string> = {
	todo:        'To Do',
	in_progress: 'In Progress',
	done:        'Done',
};

const PRIORITY_DOT: Record<string, string> = {
	urgent: '#ef4444',
	high:   '#f97316',
	medium: '#6366f1',
	low:    '#94a3b8',
};

type Tab = 'subtasks' | 'comments' | 'activity';

const TaskDetail = () => {
	const { id }       = useParams<{ id: string }>();
	const navigate     = useNavigate();
	const location     = useLocation();
	const qc           = useQueryClient();
	const taskId       = Number( id );
	const fromKanban   = ( location.state as { from?: string } | null )?.from === 'kanban';
	const backPath     = fromKanban ? '/tasks/kanban' : '/tasks';
	const backLabel    = fromKanban ? 'Kanban' : 'Tasks';

	const [ activeTab, setActiveTab ]             = useState<Tab>( 'subtasks' );
	const [ newComment, setNewComment ]           = useState( '' );
	const [ deleteCommentId, setDeleteCommentId ] = useState<number | null>( null );
	const [ editingCommentId, setEditingCommentId ] = useState<number | null>( null );
	const [ editCommentContent, setEditCommentContent ] = useState( '' );
	const [ deleteTaskOpen, setDeleteTaskOpen ]   = useState( false );
	const [ editOpen, setEditOpen ]               = useState( false );
	const [ editForm, setEditForm ]               = useState<Partial<Task>>( {} );
	const [ subtaskModalOpen, setSubtaskModalOpen ] = useState( false );
	const [ editingSubtask, setEditingSubtask ]     = useState<Subtask | null>( null );

	const { data: task, isLoading } = useQuery( {
		queryKey: [ 'tasks', taskId ],
		queryFn:  () => tasksApi.getOne( taskId ),
		enabled:  !! taskId,
	} );

	const { statuses: taskStatuses } = useTaskStatuses();

	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'all' ],
		queryFn:  () => usersApi.getAll( { per_page: 100 } ),
		staleTime: 5 * 60_000,
	} );
	const users = usersData?.items ?? [];

	const { data: sprints = [], isFetching: sprintsLoading } = useQuery< Sprint[] >( {
		queryKey: [ 'sprints', task?.project_id ],
		queryFn:  () => sprintsApi.getAll( task!.project_id! ),
		enabled:  !! task?.project_id && editOpen,
		staleTime: 2 * 60_000,
	} );

	const invalidate = () => {
		qc.invalidateQueries( { queryKey: [ 'tasks', taskId ] } );
		qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
	};

	const updateMutation = useMutation( {
		mutationFn: ( data: Partial<Task> ) => tasksApi.update( taskId, data ),
		onSuccess:  () => { invalidate(); setEditOpen( false ); toast.success( 'Task updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: () => tasksApi.delete( taskId ),
		onSuccess:  () => { navigate( backPath ); toast.success( 'Task deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
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

	const toggleSubtaskMutation = useMutation( {
		mutationFn: ( { subtaskId, completed }: { subtaskId: number; completed: boolean } ) =>
			subtasksApi.update( taskId, subtaskId, { completed } ),
		onSuccess: () => invalidate(),
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	const deleteSubtaskMutation = useMutation( {
		mutationFn: ( subtaskId: number ) => subtasksApi.delete( taskId, subtaskId ),
		onSuccess: () => invalidate(),
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	if ( isLoading ) return <Spinner fullscreen />;
	if ( ! task )    return <div className="st-todox-page"><p>Task not found.</p></div>;

	const subtasks   = task.subtasks   ?? [];
	const comments   = task.comments   ?? [];
	const activities = task.activities ?? [];
	const doneSubtasks   = subtasks.filter( ( s ) => s.completed ).length;
	const subtaskProgress = subtasks.length > 0 ? ( doneSubtasks / subtasks.length ) * 100 : 0;
	const overdue         = isOverdue( task.due_date );
	const borderColor     = PRIORITY_BORDER[ task.priority ] ?? '#e2e8f0';
	const accentColor     = PRIORITY_ACCENT[ task.priority ] ?? '#94a3b8';
	const isCompleted     = task.status === 'completed';

	const openEdit = () => {
		setEditForm( {
			title:       task.title,
			description: task.description,
			status:      task.status,
			priority:    task.priority,
			due_date:    task.due_date,
			assignee_id: task.assignee_id,
			sprint_id:   task.sprint_id ?? null,
		} );
		setEditOpen( true );
	};

	const TABS: { id: Tab; label: string; count: number }[] = [
		{ id: 'subtasks', label: 'Subtasks', count: subtasks.length },
		{ id: 'comments', label: 'Comments', count: comments.length },
		{ id: 'activity', label: 'Activity',  count: activities.length },
	];

	return (
		<div className="st-todox-page st-todox-td">

			{/* Breadcrumb */}
			<div className="st-todox-td__breadcrumb">
				<button className="st-todox-td__bc-link" onClick={ () => navigate( backPath ) }>
					<ArrowLeft size={ 13 } /> { backLabel }
				</button>
				<ChevronRight size={ 11 } className="st-todox-td__bc-sep" />
				<span className="st-todox-td__bc-current">{ task.title }</span>
			</div>

			<div className="st-todox-td__grid">

				{/* ── Main column ── */}
				<div className="st-todox-td__main">

					{/* Header card */}
					<div
						className="st-todox-td-card st-todox-td-card--header"
						style={ { borderLeftColor: borderColor } }
					>
						{/* Top row: badges + actions */}
						<div className="st-todox-td-card__top-row">
							<div className="st-todox-td-card__badges">
								<StatusBadge status={ task.status } />
								<PriorityBadge priority={ task.priority } />
								{ overdue && (
									<span className="st-todox-td-overdue-chip">
										<AlertCircle size={ 10 } /> Overdue
									</span>
								) }
							</div>
							<div className="st-todox-td-card__actions">
								<button className="st-todox-td-action-btn" onClick={ openEdit }>
									<Edit3 size={ 13 } /> Edit Task
								</button>
								<button
									className="st-todox-td-action-btn st-todox-td-action-btn--danger"
									onClick={ () => setDeleteTaskOpen( true ) }
								>
									<Trash2 size={ 13 } />
								</button>
							</div>
						</div>

						{/* Title */}
						<h1 className={ `st-todox-td-card__title ${ isCompleted ? 'st-todox-td-card__title--done' : '' }` }>
							{ task.title }
						</h1>

						{/* Description */}
						<div className="st-todox-td-card__desc-wrap">
							{ task.description ? (
								<p className="st-todox-td-card__desc">{ task.description }</p>
							) : (
								<p className="st-todox-td-card__desc st-todox-td-card__desc--empty">No description provided.</p>
							) }
						</div>

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

								{ subtasks.length === 0 ? (
									<div className="st-todox-td-empty">
										<CircleDashed size={ 32 } className="st-todox-td-empty__icon" />
										<p>No subtasks yet</p>
									</div>
								) : (
									<div className="st-todox-td-subtask-list">
										{ subtasks.map( ( st: Subtask ) => {
											const statusColor = SUBTASK_STATUS_COLOR[ st.status ] ?? '#94a3b8';
											const late = isOverdue( st.due_date ) && st.status !== 'done';
											return (
												<div key={ st.id } className="st-todox-td-subtask">
													<input
														type="checkbox"
														className="st-todox-td-subtask__check"
														checked={ st.completed }
														onChange={ ( e ) =>
															toggleSubtaskMutation.mutate( { subtaskId: st.id, completed: e.target.checked } )
														}
													/>

													<div className="st-todox-td-subtask__body">
														<span className={ `st-todox-td-subtask__title ${ st.completed ? 'st-todox-td-subtask__title--done' : '' }` }>
															{ st.title }
														</span>
														{ st.description && (
															<span className="st-todox-td-subtask__desc">{ st.description }</span>
														) }
													</div>

													<div className="st-todox-td-subtask__meta">
														<span
															className="st-todox-td-subtask__status"
															style={ { color: statusColor, background: statusColor + '18' } }
														>
															<Circle size={ 6 } fill="currentColor" />
															{ SUBTASK_STATUS_LABEL[ st.status ] }
														</span>
														<span
															className="st-todox-td-subtask__prio-dot"
															style={ { background: PRIORITY_DOT[ st.priority ] ?? '#94a3b8' } }
															title={ st.priority }
														/>
														{ st.due_date && (
															<span className={ `st-todox-td-subtask__due ${ late ? 'st-todox-text--danger' : '' }` }>
																{ formatDate( st.due_date ) }
															</span>
														) }
														{ st.assignee && (
															<Avatar name={ st.assignee.name } src={ st.assignee.avatar } size={ 18 } />
														) }
													</div>

													<div className="st-todox-td-subtask__actions">
														<button
															className="st-todox-td-subtask__edit"
															onClick={ () => { setEditingSubtask( st ); setSubtaskModalOpen( true ); } }
															title="Edit"
														>
															<Edit3 size={ 11 } />
														</button>
														<button
															className="st-todox-td-subtask__del"
															onClick={ () => deleteSubtaskMutation.mutate( st.id ) }
															title="Delete"
														>
															<X size={ 11 } />
														</button>
													</div>
												</div>
											);
										} ) }
									</div>
								) }

								{/* Add subtask button */}
								<button
									className="st-todox-td-subtask-add-btn"
									onClick={ () => { setEditingSubtask( null ); setSubtaskModalOpen( true ); } }
								>
									<Plus size={ 13 } />
									Add Subtask
								</button>
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

							<div className="st-todox-td-meta-row">
								<span className="st-todox-td-meta-row__label"><User size={ 13 } /> Assignee</span>
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
							</div>

							<div className="st-todox-td-meta-row">
								<span className="st-todox-td-meta-row__label"><Calendar size={ 13 } /> Due Date</span>
								<span className={ `st-todox-td-meta-row__val-bold ${ overdue ? 'st-todox-text--danger' : '' }` }>
									{ task.due_date ? formatDate( task.due_date ) : (
										<span className="st-todox-td-meta-row__val-muted">Not set</span>
									) }
									{ overdue && (
										<span className="st-todox-td-overdue-pill">Overdue</span>
									) }
								</span>
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

					{/* Priority card */}
					<div className="st-todox-td-priority-card">
						<div
							className="st-todox-td-priority-card__bar"
							style={ { background: accentColor } }
						/>
						<div className="st-todox-td-priority-card__body">
							<p className="st-todox-td-priority-card__label">Priority</p>
							<PriorityBadge priority={ task.priority } />
						</div>
					</div>
				</aside>
			</div>

			{/* Edit modal overlay */}
			{ editOpen && (
				<div className="st-todox-td-edit-overlay">
					<div className="st-todox-td-edit-modal">
						<div className="st-todox-td-edit-modal__head">
							<h2>Edit Task</h2>
							<button className="st-todox-td-edit-modal__close" onClick={ () => setEditOpen( false ) }>
								<X size={ 16 } />
							</button>
						</div>
						<div className="st-todox-td-edit-modal__body">
							<div className="st-todox-form__group">
								<label className="st-todox-form__label">Title</label>
								<input
									type="text"
									className="st-todox-form__input"
									value={ editForm.title ?? '' }
									onChange={ ( e ) => setEditForm( { ...editForm, title: e.target.value } ) }
									autoFocus
								/>
							</div>
							<div className="st-todox-form__group">
								<label className="st-todox-form__label">Description</label>
								<textarea
									className="st-todox-form__textarea"
									rows={ 4 }
									value={ editForm.description ?? '' }
									onChange={ ( e ) => setEditForm( { ...editForm, description: e.target.value } ) }
									placeholder="Add a description…"
								/>
							</div>
							<div className="st-todox-form__row">
								<div className="st-todox-form__group">
									<label className="st-todox-form__label">Status</label>
									<select
										className="st-todox-form__select"
										value={ editForm.status }
										onChange={ ( e ) => setEditForm( { ...editForm, status: e.target.value as TaskStatus } ) }
									>
										{ taskStatuses.map( ( s ) => (
											<option key={ s.value } value={ s.value }>{ s.label }</option>
										) ) }
									</select>
								</div>
								<div className="st-todox-form__group">
									<label className="st-todox-form__label">Priority</label>
									<select
										className="st-todox-form__select"
										value={ editForm.priority }
										onChange={ ( e ) => setEditForm( { ...editForm, priority: e.target.value as TaskPriority } ) }
									>
										<option value="low">Low</option>
										<option value="medium">Medium</option>
										<option value="high">High</option>
										<option value="urgent">Urgent</option>
									</select>
								</div>
							</div>
							<div className="st-todox-form__group">
								<label className="st-todox-form__label">Due Date</label>
								<input
									type="date"
									className="st-todox-form__input"
									value={ editForm.due_date ?? '' }
									onChange={ ( e ) => setEditForm( { ...editForm, due_date: e.target.value || null } ) }
								/>
							</div>
							<div className="st-todox-form__group">
								<label className="st-todox-form__label">Assignee</label>
								<select
									className="st-todox-form__select"
									value={ editForm.assignee_id ?? '' }
									onChange={ ( e ) => setEditForm( { ...editForm, assignee_id: e.target.value ? Number( e.target.value ) : null } ) }
								>
									<option value="">Unassigned</option>
									{ users.map( ( u ) => (
										<option key={ u.id } value={ u.id }>{ u.name }</option>
									) ) }
								</select>
							</div>
						</div>
						{ task.project_id && (
							<div className="st-todox-form__group">
								<label className="st-todox-form__label">Sprint</label>
								<select
									className="st-todox-form__select"
									value={ editForm.sprint_id ?? '' }
									onChange={ ( e ) => setEditForm( { ...editForm, sprint_id: e.target.value ? Number( e.target.value ) : null } ) }
									disabled={ sprintsLoading }
								>
									<option value="">{ sprintsLoading ? 'Loading…' : 'No sprint (backlog)' }</option>
									{ sprints.map( ( s ) => (
										<option key={ s.id } value={ s.id }>{ s.name }</option>
									) ) }
								</select>
							</div>
						) }
						<div className="st-todox-td-edit-modal__footer">
							<Button variant="secondary" onClick={ () => setEditOpen( false ) }>Cancel</Button>
							<Button onClick={ () => updateMutation.mutate( editForm ) } loading={ updateMutation.isPending }>
								Save Changes
							</Button>
						</div>
					</div>
				</div>
			) }

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

			<SubtaskModal
				isOpen={ subtaskModalOpen }
				onClose={ () => { setSubtaskModalOpen( false ); setEditingSubtask( null ); } }
				taskId={ taskId }
				subtask={ editingSubtask ?? undefined }
				onSaved={ () => { qc.invalidateQueries( { queryKey: [ 'tasks', taskId ] } ); } }
			/>
		</div>
	);
};

export default TaskDetail;
