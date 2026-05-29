/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	CheckSquare2, Clock, TrendingUp, AlertCircle,
	FolderKanban, ListChecks, Building2,
	LayoutGrid, Kanban, Plus, AlertTriangle,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { dashboardApi, workspacesApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Modal from '../../components/ui/Modal';
import CreateTaskModal from '../../components/features/task/CreateTaskModal';
import TaskDetailModal from '../../components/features/task/TaskDetailModal';
import TaskProgressPanel from '../../components/features/dashboard/TaskProgressPanel';
import ActivityFeed from '../../components/features/dashboard/ActivityFeed';
import { formatDate, formatRelativeTime, isOverdue } from '../../utils/helpers';
import type { Task, CreateWorkspaceInput, DashboardStats } from '../../types';

const COLORS = [ '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6' ];

function getGreeting() {
	const h = new Date().getHours();
	if ( h < 12 ) return 'Good morning';
	if ( h < 17 ) return 'Good afternoon';
	return 'Good evening';
}

/* ---- Stats Cards ---- */
function StatsCards( { stats }: { stats: DashboardStats } ) {
	const { tasks } = stats;
	const completionRate  = tasks.total > 0 ? Math.round( ( tasks.completed  / tasks.total ) * 100 ) : 0;
	const inProgressPct   = tasks.total > 0 ? Math.round( ( tasks.in_progress / tasks.total ) * 100 ) : 0;

	const cards = [
		{
			label:      'Total Tasks',
			value:      tasks.total,
			sub:        `${ tasks.todo } to do · ${ tasks.review } in review`,
			Icon:       CheckSquare2,
			topBar:     'linear-gradient(90deg, #8b5cf6, #7c3aed)',
			iconBg:     'rgba(139,92,246,.1)',
			iconColor:  '#7c3aed',
			valueCls:   '',
			bar:        null,
			urgent:     false,
		},
		{
			label:      'In Progress',
			value:      tasks.in_progress,
			sub:        `${ inProgressPct }% of all tasks`,
			Icon:       Clock,
			topBar:     'linear-gradient(90deg, #6366f1, #3b82f6)',
			iconBg:     'rgba(99,102,241,.1)',
			iconColor:  '#6366f1',
			valueCls:   '',
			bar:        { pct: inProgressPct, color: 'linear-gradient(90deg, #6366f1, #3b82f6)' },
			urgent:     false,
		},
		{
			label:      'Completed',
			value:      tasks.completed,
			sub:        `${ completionRate }% completion rate`,
			Icon:       TrendingUp,
			topBar:     'linear-gradient(90deg, #10b981, #14b8a6)',
			iconBg:     'rgba(16,185,129,.1)',
			iconColor:  '#059669',
			valueCls:   '',
			bar:        { pct: completionRate, color: 'linear-gradient(90deg, #10b981, #14b8a6)' },
			urgent:     false,
		},
		{
			label:      'Overdue',
			value:      tasks.overdue,
			sub:        tasks.overdue > 0 ? 'Needs immediate attention' : "You're on track!",
			Icon:       AlertCircle,
			topBar:     tasks.overdue > 0 ? 'linear-gradient(90deg, #ef4444, #f43f5e)' : 'linear-gradient(90deg, #94a3b8, #64748b)',
			iconBg:     tasks.overdue > 0 ? 'rgba(239,68,68,.1)' : 'rgba(148,163,184,.1)',
			iconColor:  tasks.overdue > 0 ? '#dc2626' : '#94a3b8',
			valueCls:   tasks.overdue > 0 ? 'st-todox-stat2-card__value--danger' : '',
			bar:        null,
			urgent:     tasks.overdue > 0,
		},
	];

	return (
		<div className="st-todox-stat2-grid">
			{ cards.map( ( card ) => (
				<div
					key={ card.label }
					className={ `st-todox-stat2-card ${ card.urgent ? 'st-todox-stat2-card--urgent' : '' }` }
				>
					<div className="st-todox-stat2-card__top-bar" style={ { background: card.topBar } } />
					<div className="st-todox-stat2-card__wash" style={ { background: card.topBar.replace('linear-gradient(90deg, ', 'linear-gradient(135deg, ').replace(')', ', transparent)').replace(/, #\S+\)/, ', transparent)') } } />

					<div className="st-todox-stat2-card__body">
						<div className="st-todox-stat2-card__head">
							<div className="st-todox-stat2-card__icon" style={ { background: card.iconBg, color: card.iconColor } }>
								<card.Icon size={ 20 } />
							</div>
							{ card.urgent && card.value > 0 && (
								<span className="st-todox-stat2-card__ping">
									<span className="st-todox-stat2-card__ping-inner" />
								</span>
							) }
						</div>

						<div className="st-todox-stat2-card__numbers">
							<p className={ `st-todox-stat2-card__value ${ card.valueCls }` }>{ card.value }</p>
							<p className="st-todox-stat2-card__label">{ card.label }</p>
							<p className="st-todox-stat2-card__sub">{ card.sub }</p>
						</div>

						{ card.bar && (
							<div className="st-todox-stat2-card__bar-wrap">
								<div className="st-todox-stat2-card__bar-track">
									<div
										className="st-todox-stat2-card__bar-fill"
										style={ { width: `${ card.bar.pct }%`, background: card.bar.color } }
									/>
								</div>
							</div>
						) }
					</div>
				</div>
			) ) }
		</div>
	);
}

/* ---- Welcome / Onboarding ---- */
const Welcome = ( { onCreate }: { onCreate: () => void } ) => (
	<div className="st-todox-welcome">
		<div className="st-todox-welcome__inner">
			<div className="st-todox-welcome__brand">
				<LayoutGrid size={ 28 } />
			</div>

			<h1 className="st-todox-welcome__title">
				TodoX - All in one place
			</h1>
			<p className="st-todox-welcome__desc">
				Organize teams, track sprints, and ship faster — start by creating your first workspace.
			</p>

			<Button onClick={ onCreate } size="lg" className="st-todox-welcome__cta">
				<Plus size={ 16 } /> Create Your First Workspace
			</Button>

			<div className="st-todox-welcome__steps">
				{ [
					{ num: '01', Icon: Building2,   color: '#6366f1', bg: 'rgba(99,102,241,.1)',  title: 'Create a Workspace', desc: 'Set up your environment and invite your team.' },
					{ num: '02', Icon: FolderKanban, color: '#8b5cf6', bg: 'rgba(139,92,246,.1)', title: 'Add Projects',         desc: 'Organize work into projects and sprints.'     },
					{ num: '03', Icon: ListChecks,   color: '#3b82f6', bg: 'rgba(59,130,246,.1)', title: 'Manage Tasks',         desc: 'Assign, track and ship with kanban boards.'  },
				].map( ( s ) => (
					<div key={ s.num } className="st-todox-welcome__step">
						<div className="st-todox-welcome__step-icon" style={ { background: s.bg, color: s.color } }>
							<s.Icon size={ 18 } />
						</div>
						<div className="st-todox-welcome__step-num">{ s.num }</div>
						<h3 className="st-todox-welcome__step-title">{ s.title }</h3>
						<p className="st-todox-welcome__step-desc">{ s.desc }</p>
					</div>
				) ) }
			</div>
		</div>
	</div>
);

/* ---- Dashboard ---- */
const Dashboard = () => {
	const navigate = useNavigate();
	const qc       = useQueryClient();
	const { activeWorkspace, activeWorkspaceId, switchWorkspace, isLoading: workspaceLoading } = useWorkspace();

	const [ createOpen, setCreateOpen ]         = useState( false );
	const [ createTaskOpen, setCreateTaskOpen ] = useState( false );
	const [ selectedTaskId, setSelectedTaskId ] = useState< number | null >( null );
	const [ form, setForm ]                     = useState< CreateWorkspaceInput >( { name: '', color: '#6366f1' } );

	const { data: stats, isLoading: statsLoading } = useQuery( {
		queryKey: [ 'dashboard', 'stats', activeWorkspaceId ],
		queryFn:  () => dashboardApi.getStats( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const { data: recentTasks = [], isLoading: tasksLoading } = useQuery( {
		queryKey: [ 'dashboard', 'recent-tasks', activeWorkspaceId ],
		queryFn:  () => dashboardApi.getRecentTasks( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const { data: activities = [], isLoading: activitiesLoading } = useQuery( {
		queryKey: [ 'dashboard', 'recent-activity', activeWorkspaceId ],
		queryFn:  () => dashboardApi.getRecentActivity( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const createMutation = useMutation( {
		mutationFn: workspacesApi.create,
		onSuccess: ( ws ) => {
			qc.invalidateQueries( { queryKey: [ 'workspaces' ] } );
			switchWorkspace( ws );
			setCreateOpen( false );
			setForm( { name: '', color: '#6366f1' } );
			toast.success( 'Workspace created!' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const handleCreateSubmit = ( e: React.FormEvent ) => {
		e.preventDefault();
		if ( ! form.name.trim() ) return;
		createMutation.mutate( form );
	};

	if ( workspaceLoading ) {
		return (
			<div className="st-todox-page-loader">
				<Spinner />
			</div>
		);
	}

	if ( ! activeWorkspace ) {
		return (
			<>
				<Welcome onCreate={ () => setCreateOpen( true ) } />
				<Modal
					isOpen={ createOpen }
					onClose={ () => setCreateOpen( false ) }
					title="Create Workspace"
					size="sm"
					footer={
						<>
							<Button variant="secondary" onClick={ () => setCreateOpen( false ) }>Cancel</Button>
							<Button
								onClick={ handleCreateSubmit as unknown as React.MouseEventHandler }
								loading={ createMutation.isPending }
							>
								Create
							</Button>
						</>
					}
				>
					<form onSubmit={ handleCreateSubmit } className="st-todox-form">
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">Name <span className="st-todox-form__required">*</span></label>
							<input
								type="text"
								className="st-todox-form__input"
								placeholder="My Workspace"
								value={ form.name }
								onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) }
								autoFocus
							/>
						</div>
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">Color</label>
							<div className="st-todox-color-picker">
								{ COLORS.map( ( c ) => (
									<button
										key={ c }
										type="button"
										className={ `st-todox-color-picker__swatch ${ form.color === c ? 'st-todox-color-picker__swatch--active' : '' }` }
										style={ { background: c } }
										onClick={ () => setForm( { ...form, color: c } ) }
									/>
								) ) }
							</div>
						</div>
					</form>
				</Modal>
			</>
		);
	}

	const firstName      = stTodoxParams?.currentUser?.name?.split( ' ' )[ 0 ] ?? 'there';
	const completionRate = stats && stats.tasks.total > 0
		? Math.round( ( stats.tasks.completed / stats.tasks.total ) * 100 )
		: 0;

	return (
		<div className="st-todox-page st-todox-dashboard">

			{/* Welcome Banner */}
			<div className="st-todox-dashboard-banner">
				<div className="st-todox-dashboard-banner__deco st-todox-dashboard-banner__deco--1" />
				<div className="st-todox-dashboard-banner__deco st-todox-dashboard-banner__deco--2" />
				<div className="st-todox-dashboard-banner__deco st-todox-dashboard-banner__deco--3" />

				<div className="st-todox-dashboard-banner__body">
					<div>
						<p className="st-todox-dashboard-banner__date">
							{ new Date().toLocaleDateString( 'en-US', { weekday: 'long', month: 'long', day: 'numeric' } ) }
						</p>
						<h1 className="st-todox-dashboard-banner__greeting">
							{ getGreeting() }, { firstName }
						</h1>
						<div className="st-todox-dashboard-banner__pills">
							{ stats && stats.tasks.overdue > 0 && (
								<span className="st-todox-dashboard-banner__pill st-todox-dashboard-banner__pill--danger">
									<AlertTriangle size={ 11 } />
									{ stats.tasks.overdue } overdue
								</span>
							) }
							{ stats && (
								<span className="st-todox-dashboard-banner__pill">
									<span className="st-todox-dashboard-banner__pill-dot st-todox-dashboard-banner__pill-dot--green" />
									{ completionRate }% completion
								</span>
							) }
						</div>
					</div>

					<div className="st-todox-dashboard-banner__actions">
						<button
							className="st-todox-dashboard-banner__btn st-todox-dashboard-banner__btn--ghost"
							onClick={ () => navigate( '/tasks/kanban' ) }
						>
							<Kanban size={ 14 } /> Kanban
						</button>
						<button
							className="st-todox-dashboard-banner__btn st-todox-dashboard-banner__btn--white"
							onClick={ () => setCreateTaskOpen( true ) }
						>
							<Plus size={ 14 } /> New Task
						</button>
					</div>
				</div>
			</div>

			{/* Stats Cards */}
			{ statsLoading ? (
				<div style={ { marginBottom: 32, display: 'flex', justifyContent: 'center' } }><Spinner /></div>
			) : stats ? (
				<StatsCards stats={ stats } />
			) : null }

			{/* Middle Row: Progress Panel */}
			{ stats && (
				<div className="st-todox-dashboard-mid">
					<TaskProgressPanel stats={ stats } />
				</div>
			) }

			{/* Bottom Row: Recent Tasks + Activity Feed */}
			<div className="st-todox-dashboard-bottom">
				{/* Recent Tasks */}
				<div className="st-todox-surface-card">
					<div className="st-todox-surface-card__header">
						<h2 className="st-todox-surface-card__title">Recent Tasks</h2>
						<button className="st-todox-link-btn" onClick={ () => navigate( '/tasks' ) }>
							View all →
						</button>
					</div>

					{ tasksLoading ? (
						<div className="st-todox-surface-card__body" style={ { display: 'flex', justifyContent: 'center' } }><Spinner /></div>
					) : recentTasks.length === 0 ? (
						<div className="st-todox-empty-inline">
							<p>No tasks yet.</p>
							<Button size="sm" onClick={ () => navigate( '/tasks' ) }>Create first task</Button>
						</div>
					) : (
						<div className="st-todox-table-scroll">
							<table className="st-todox-table">
								<thead>
									<tr>
										<th>Task</th>
										<th>Status</th>
										<th>Priority</th>
										<th>Due</th>
										<th>Assignee</th>
									</tr>
								</thead>
								<tbody>
									{ recentTasks.map( ( task: Task ) => (
										<tr
											key={ task.id }
											className={ `st-todox-table__row ${ isOverdue( task.due_date ) ? 'st-todox-table__row--overdue' : '' }` }
											onClick={ () => setSelectedTaskId( task.id ) }
											style={ { cursor: 'pointer' } }
										>
											<td className="st-todox-table__title-cell">
												<div className="st-todox-table__title">{ task.title }</div>
											</td>
											<td><StatusBadge status={ task.status } /></td>
											<td><PriorityBadge priority={ task.priority } /></td>
											<td className={ isOverdue( task.due_date ) ? 'st-todox-text--danger' : '' }>
												{ formatDate( task.due_date ) }
											</td>
											<td>{ task.assignee?.name ?? <span className="st-todox-text--muted">—</span> }</td>
										</tr>
									) ) }
								</tbody>
							</table>
						</div>
					) }
				</div>

				{/* Activity Feed */}
				{ activitiesLoading ? (
					<div className="st-todox-surface-card" style={ { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 } }>
						<Spinner />
					</div>
				) : (
					<ActivityFeed activities={ activities } />
				) }
			</div>

			{ activeWorkspaceId && (
				<CreateTaskModal
					isOpen={ createTaskOpen }
					onClose={ () => setCreateTaskOpen( false ) }
					workspaceId={ activeWorkspaceId }
				/>
			) }

			<TaskDetailModal
				taskId={ selectedTaskId }
				onClose={ () => setSelectedTaskId( null ) }
			/>
		</div>
	);
};

export default Dashboard;
