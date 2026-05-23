/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	type LucideIcon,
	Zap, Calendar, Circle, Clock, AlertCircle, CheckCircle2, ArrowLeft,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { sprintsApi, tasksApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Avatar from '../../components/ui/Avatar';
import CreateTaskModal from '../../components/features/task/CreateTaskModal';
import StatusPill from '../../components/ui/StatusPill';
import { formatDate, isOverdue } from '../../utils/helpers';
import type { Task, SprintStatus } from '../../types';

const SPRINT_STATUS_CONFIG: Record< SprintStatus, { label: string; color: string } > = {
	planned:   { label: 'Planned',   color: '#6366f1' },
	active:    { label: 'Active',    color: '#3b82f6' },
	completed: { label: 'Completed', color: '#10b981' },
};

const SPRINT_STATUS_ORDER: SprintStatus[] = [ 'active', 'planned', 'completed' ];

const TASK_STATUS_ORDER = [ 'todo', 'in_progress', 'review', 'completed' ] as const;
type TStatus = typeof TASK_STATUS_ORDER[number];

const TASK_STATUS_LABELS: Record<TStatus, string> = {
	todo:        'To Do',
	in_progress: 'In Progress',
	review:      'In Review',
	completed:   'Completed',
};

const TASK_STATUS_ICONS: Record<TStatus, LucideIcon> = {
	todo:        Circle,
	in_progress: Clock,
	review:      AlertCircle,
	completed:   CheckCircle2,
};

const TASK_STATUS_COLOR: Record<TStatus, string> = {
	todo:        '#94a3b8',
	in_progress: '#6366f1',
	review:      '#f59e0b',
	completed:   '#10b981',
};

const PRIORITY_COLORS: Record<string, string> = {
	urgent: '#ef4444',
	high:   '#f97316',
	medium: '#6366f1',
	low:    '#94a3b8',
};

const SprintDetail = () => {
	const { id }    = useParams<{ id: string }>();
	const navigate  = useNavigate();
	const qc        = useQueryClient();
	const sprintId  = Number( id );
	const { activeWorkspaceId } = useWorkspace();

	const [ taskCreateOpen, setTaskCreateOpen ] = useState( false );

	const { data: sprint, isLoading: sprintLoading } = useQuery( {
		queryKey: [ 'sprints', sprintId ],
		queryFn: () => sprintsApi.getOne( sprintId ),
		enabled: !! sprintId,
	} );

	const { data: tasksData, isLoading: tasksLoading } = useQuery( {
		queryKey: [ 'tasks', 'sprint', sprintId ],
		queryFn: () => tasksApi.getAll( { workspace_id: activeWorkspaceId!, sprint_id: sprintId, per_page: 100 } ),
		enabled: !! sprintId && !! activeWorkspaceId,
	} );
	const tasks = tasksData?.items ?? [];

	const updateSprintMutation = useMutation( {
		mutationFn: ( status: SprintStatus ) => sprintsApi.update( sprintId, { status } ),
		onSuccess: () => {
			qc.invalidateQueries( { queryKey: [ 'sprints', sprintId ] } );
			toast.success( 'Sprint updated.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	if ( sprintLoading ) return <Spinner fullscreen />;
	if ( ! sprint )      return <div className="st-todox-page"><p>Sprint not found.</p></div>;

	const completedCount = tasks.filter( ( t ) => t.status === 'completed' ).length;
	const total          = tasks.length;
	const progress       = total > 0 ? Math.round( ( completedCount / total ) * 100 ) : 0;

	const statusColor  = SPRINT_STATUS_CONFIG[ sprint.status ]?.color ?? '#6366f1';
	const projectColor = sprint.project?.color ?? statusColor;

	const tasksByStatus = TASK_STATUS_ORDER.reduce<Record<string, Task[]>>( ( acc, s ) => {
		acc[ s ] = tasks.filter( ( t ) => t.status === s );
		return acc;
	}, {} as Record<string, Task[]> );

	return (
		<div className="st-todox-page">
			{/* Back */}
			<button className="st-todox-back-btn" onClick={ () => navigate( `/projects/${ sprint.project_id }` ) }>
				<ArrowLeft size={ 13 } />
				{ sprint.project?.name ?? 'Project' }
			</button>

			{/* Header card */}
			<div className="st-todox-sprint-hd-card">
				<div className="st-todox-sprint-hd-card__strip" style={ { background: projectColor } } />
				<div className="st-todox-sprint-hd-card__inner">
					<div className="st-todox-sprint-hd-card__top">
						<div className="st-todox-sprint-hd-card__icon" style={ { background: statusColor + '20', color: statusColor } }>
							<Zap size={ 22 } />
						</div>
						<div className="st-todox-sprint-hd-card__info">
							<div className="st-todox-sprint-hd-card__title-row">
								<h1 className="st-todox-sprint-hd-card__title">{ sprint.name }</h1>
								<StatusPill< SprintStatus >
									current={ sprint.status }
									options={ SPRINT_STATUS_ORDER }
									config={ SPRINT_STATUS_CONFIG }
									onChange={ ( s ) => updateSprintMutation.mutate( s ) }
									loading={ updateSprintMutation.isPending }
								/>
							</div>
							{ sprint.goal && (
								<p className="st-todox-sprint-hd-card__goal">{ sprint.goal }</p>
							) }
							{ ( sprint.start_date || sprint.end_date ) && (
								<p className="st-todox-sprint-hd-card__dates">
									<Calendar size={ 12 } />
									{ sprint.start_date ? formatDate( sprint.start_date ) : '?' }
									{ ' – ' }
									{ sprint.end_date ? formatDate( sprint.end_date ) : '?' }
								</p>
							) }
						</div>
						<div className="st-todox-sprint-hd-card__actions">
							<Button onClick={ () => setTaskCreateOpen( true ) } leftIcon="+">Add Task</Button>
						</div>
					</div>

					{/* Progress */}
					<div className="st-todox-sprint-hd-card__progress">
						<div className="st-todox-sprint-hd-card__progress-meta">
							<span>{ total } task{ total !== 1 ? 's' : '' } total</span>
							<span className="st-todox-sprint-hd-card__progress-pct">{ progress }% complete</span>
						</div>
						<div className="st-todox-sprint-progress__bar">
							<div
								className="st-todox-sprint-progress__fill"
								style={ { width: `${ progress }%`, background: projectColor } }
							/>
						</div>
						<div className="st-todox-sprint-hd-card__progress-counts">
							{ TASK_STATUS_ORDER.map( ( s ) => {
								const count = tasksByStatus[ s ]?.length ?? 0;
								const Icon  = TASK_STATUS_ICONS[ s ];
								return (
									<span key={ s } className="st-todox-sprint-status-chip" style={ { color: TASK_STATUS_COLOR[ s ] } }>
										<Icon size={ 12 } />
										{ count } { TASK_STATUS_LABELS[ s ] }
									</span>
								);
							} ) }
						</div>
					</div>
				</div>
			</div>

			{/* Task groups */}
			{ tasksLoading ? (
				<Spinner />
			) : tasks.length === 0 ? (
				<div className="st-todox-empty-dashed">
					<Zap size={ 36 } className="st-todox-empty-dashed__icon" />
					<p className="st-todox-empty-dashed__title">No tasks yet</p>
					<p className="st-todox-empty-dashed__desc">Add tasks to start tracking work in this sprint.</p>
					<Button onClick={ () => setTaskCreateOpen( true ) } leftIcon="+" className="st-todox-empty-dashed__action">
						Add Task
					</Button>
				</div>
			) : (
				<div className="st-todox-sprint-task-groups">
					{ TASK_STATUS_ORDER.map( ( status ) => {
						const group = tasksByStatus[ status ];
						if ( ! group?.length ) return null;
						const Icon  = TASK_STATUS_ICONS[ status ];
						const color = TASK_STATUS_COLOR[ status ];
						return (
							<div key={ status } className="st-todox-sprint-task-group">
								<div className="st-todox-sprint-task-group__hd" style={ { color } }>
									<Icon size={ 14 } />
									<span>{ TASK_STATUS_LABELS[ status ] }</span>
									<span className="st-todox-sprint-task-group__count">{ group.length }</span>
								</div>
								<div className="st-todox-sprint-task-list">
									{ group.map( ( task: Task, idx: number ) => {
										const late = isOverdue( task.due_date ) && task.status !== 'completed';
										return (
											<button
												key={ task.id }
												className={ `st-todox-sprint-task-row ${ idx > 0 ? 'st-todox-sprint-task-row--bordered' : '' }` }
												onClick={ () => navigate( `/tasks/${ task.id }` ) }
											>
												<div
													className="st-todox-sprint-task-row__bar"
													style={ { background: PRIORITY_COLORS[ task.priority ] ?? '#94a3b8' } }
												/>
												<div className="st-todox-sprint-task-row__body">
													<span className={ `st-todox-sprint-task-row__title ${ task.status === 'completed' ? 'st-todox-sprint-task-row__title--done' : '' }` }>
														{ task.title }
													</span>
													{ late && <span className="st-todox-late-badge">LATE</span> }
												</div>
												<div className="st-todox-sprint-task-row__meta">
													{ task.due_date && (
														<span className={ `st-todox-sprint-task-row__due ${ late ? 'st-todox-text--danger' : '' }` }>
															{ formatDate( task.due_date ) }
														</span>
													) }
													<PriorityBadge priority={ task.priority } />
													{ task.assignee ? (
														<Avatar name={ task.assignee.name } src={ task.assignee.avatar } size={ 22 } />
													) : (
														<div className="st-todox-sprint-task-row__unassigned" />
													) }
												</div>
											</button>
										);
									} ) }
								</div>
							</div>
						);
					} ) }
				</div>
			) }

			<CreateTaskModal
				isOpen={ taskCreateOpen }
				onClose={ () => setTaskCreateOpen( false ) }
				workspaceId={ activeWorkspaceId! }
				projectId={ sprint.project_id }
				sprintId={ sprintId }
				onCreated={ () => qc.invalidateQueries( { queryKey: [ 'tasks', 'sprint', sprintId ] } ) }
			/>
		</div>
	);
};

export default SprintDetail;
