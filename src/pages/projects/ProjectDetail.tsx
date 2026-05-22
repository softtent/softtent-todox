/**
 * External dependencies
 */
import { useState, useRef } from '@wordpress/element';
// useRef kept for SprintMenu
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	ArrowLeft, ChevronRight, Zap, CheckSquare, Calendar, Clock,
	MoreHorizontal, Pencil, Trash2, Eye, Plus, PlayCircle,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { projectsApi, sprintsApi, tasksApi } from '../../api';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import PriorityBadge from '../../components/ui/PriorityBadge';
import Avatar from '../../components/ui/Avatar';
import CreateTaskModal from '../../components/features/task/CreateTaskModal';
import StatusPill from '../../components/ui/StatusPill';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatDate, isOverdue } from '../../utils/helpers';
import type { Sprint, Task, CreateSprintInput, SprintStatus, ProjectStatus } from '../../types';

// ---- Config ----

const PROJECT_STATUS_CONFIG: Record< ProjectStatus, { label: string; color: string } > = {
	active:    { label: 'Active',    color: '#10b981' },
	completed: { label: 'Completed', color: '#3b82f6' },
	archived:  { label: 'Archived',  color: '#94a3b8' },
};

const SPRINT_STATUS_CONFIG: Record< SprintStatus, { label: string; color: string } > = {
	active:    { label: 'Active',    color: '#10b981' },
	planned:   { label: 'Planned',   color: '#6366f1' },
	completed: { label: 'Completed', color: '#94a3b8' },
};

const SPRINT_STATUS_ORDER: SprintStatus[] = [ 'active', 'planned', 'completed' ];

// ---- Sprint row actions menu ----

interface SprintMenuProps {
	sprint:         Sprint;
	onEdit:         () => void;
	onDelete:       () => void;
	loading:        boolean;
}

const SprintMenu = ( { sprint, onEdit, onDelete, loading }: SprintMenuProps ) => {
	const navigate          = useNavigate();
	const [ open, setOpen ] = useState( false );
	const ref               = useRef< HTMLDivElement >( null );
	useClickOutside( ref, () => setOpen( false ) );

	return (
		<div className="st-todox-entity-card__menu-wrap" ref={ ref }>
			<button
				className="st-todox-entity-card__menu-btn"
				onClick={ ( e ) => { e.stopPropagation(); setOpen( ! open ); } }
				disabled={ loading }
			>
				<MoreHorizontal size={ 15 } />
			</button>
			{ open && (
				<>
					<div className="st-todox-dropdown-backdrop" onClick={ () => setOpen( false ) } />
					<div className="st-todox-entity-card__menu-dropdown">
						<button onClick={ () => { navigate( `/sprints/${ sprint.id }` ); setOpen( false ); } }>
							<Eye size={ 13 } /> View Sprint
						</button>
						<button onClick={ () => { onEdit(); setOpen( false ); } }>
							<Pencil size={ 13 } /> Edit
						</button>
						<div className="st-todox-dropdown-divider" />
						<button className="st-todox-entity-card__menu-danger" onClick={ () => { onDelete(); setOpen( false ); } }>
							<Trash2 size={ 13 } /> Delete
						</button>
					</div>
				</>
			) }
		</div>
	);
};

// ---- Main page ----

const emptySprintForm = (): CreateSprintInput => ( {
	project_id: 0,
	name:       '',
	goal:       '',
	start_date: '',
	end_date:   '',
} );

const ProjectDetail = () => {
	const { id }    = useParams<{ id: string }>();
	const navigate  = useNavigate();
	const qc        = useQueryClient();
	const projectId = Number( id );

	const [ sprintModalOpen, setSprintModalOpen ] = useState( false );
	const [ editSprint, setEditSprint ]           = useState< Sprint | null >( null );
	const [ deleteSprint, setDeleteSprint ]       = useState< Sprint | null >( null );
	const [ sprintForm, setSprintForm ]           = useState< CreateSprintInput >( emptySprintForm() );
	const [ taskCreateOpen, setTaskCreateOpen ]   = useState( false );

	// ── Data ──
	const { data: project, isLoading: projectLoading } = useQuery( {
		queryKey: [ 'projects', projectId ],
		queryFn:  () => projectsApi.getOne( projectId ),
		enabled:  !! projectId,
	} );

	const { data: sprints = [], isLoading: sprintsLoading } = useQuery( {
		queryKey: [ 'sprints', projectId ],
		queryFn:  () => sprintsApi.getAll( projectId ),
		enabled:  !! projectId,
	} );

	const { data: tasksData } = useQuery( {
		queryKey: [ 'tasks', 'project', projectId ],
		queryFn:  () => tasksApi.getAll( { project_id: projectId, per_page: 100 } ),
		enabled:  !! projectId,
	} );
	const tasks    = tasksData?.items ?? [];
	const backlog  = tasks.filter( ( t ) => ! t.sprint_id );
	const totalTasks = tasks.length;

	// ── Invalidate helpers ──
	const invalidateSprints  = () => qc.invalidateQueries( { queryKey: [ 'sprints', projectId ] } );
	const invalidateProject  = () => qc.invalidateQueries( { queryKey: [ 'projects', projectId ] } );

	// ── Mutations ──
	const projectStatusMutation = useMutation( {
		mutationFn: ( status: ProjectStatus ) => projectsApi.update( projectId, { status } ),
		onSuccess: () => { invalidateProject(); toast.success( 'Project status updated.' ); },
		onError:   ( err: Error ) => toast.error( err.message ),
	} );

	const createSprintMutation = useMutation( {
		mutationFn: ( data: CreateSprintInput ) => sprintsApi.create( data ),
		onSuccess:  () => { invalidateSprints(); closeSprint(); toast.success( 'Sprint created.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const updateSprintMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateSprintInput > & { status?: string } } ) =>
			sprintsApi.update( id, data ),
		onSuccess:  () => { invalidateSprints(); closeSprint(); toast.success( 'Sprint updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const deleteSprintMutation = useMutation( {
		mutationFn: ( id: number ) => sprintsApi.delete( id ),
		onSuccess:  () => { invalidateSprints(); setDeleteSprint( null ); toast.success( 'Sprint deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	// ── Sprint handlers ──
	const openCreateSprint = () => {
		setEditSprint( null );
		setSprintForm( { ...emptySprintForm(), project_id: projectId } );
		setSprintModalOpen( true );
	};

	const openEditSprint = ( sprint: Sprint ) => {
		setEditSprint( sprint );
		setSprintForm( {
			project_id: sprint.project_id,
			name:       sprint.name,
			goal:       sprint.goal ?? '',
			start_date: sprint.start_date ?? '',
			end_date:   sprint.end_date ?? '',
		} );
		setSprintModalOpen( true );
	};

	const closeSprint = () => {
		setSprintModalOpen( false );
		setEditSprint( null );
		setSprintForm( emptySprintForm() );
	};

	const doSprintSubmit = () => {
		if ( ! sprintForm.name.trim() ) { toast.error( 'Sprint name is required.' ); return; }
		if ( editSprint ) {
			updateSprintMutation.mutate( { id: editSprint.id, data: sprintForm } );
		} else {
			createSprintMutation.mutate( { ...sprintForm, project_id: projectId } );
		}
	};

	// ── Render ──
	if ( projectLoading ) return <Spinner fullscreen />;
	if ( ! project )      return <div className="st-todox-page"><p>Project not found.</p></div>;

	const sprintPending = createSprintMutation.isPending || updateSprintMutation.isPending;
	const activeSprint  = sprints.find( ( s ) => s.status === 'active' );

	return (
		<div className="st-todox-page">

			{/* Breadcrumb */}
			<div className="st-todox-td__breadcrumb" style={ { marginBottom: 16 } }>
				<button className="st-todox-td__bc-link" onClick={ () => navigate( '/projects' ) }>
					<ArrowLeft size={ 13 } /> Projects
				</button>
				<ChevronRight size={ 11 } className="st-todox-td__bc-sep" />
				<span className="st-todox-td__bc-current">{ project.name }</span>
			</div>

			{/* ── Project header card ── */}
			<div className="st-todox-pd-card">
				<div className="st-todox-pd-card__strip" style={ { background: project.color } } />
				<div className="st-todox-pd-card__body">
					<div className="st-todox-pd-card__main">
						{/* Avatar + info */}
						<div className="st-todox-pd-card__avatar" style={ { background: project.color } }>
							{ ( project.name ?? '' ).slice( 0, 1 ).toUpperCase() || '?' }
						</div>
						<div className="st-todox-pd-card__info">
							<div className="st-todox-pd-card__title-row">
								<h1 className="st-todox-pd-card__title">{ project.name }</h1>
								<StatusPill< ProjectStatus >
									current={ project.status as ProjectStatus ?? 'active' }
									options={ [ 'active', 'completed', 'archived' ] }
									config={ PROJECT_STATUS_CONFIG }
									onChange={ ( s ) => projectStatusMutation.mutate( s ) }
									loading={ projectStatusMutation.isPending }
								/>
							</div>
							{ project.description && (
								<p className="st-todox-pd-card__desc">{ project.description }</p>
							) }
							<div className="st-todox-pd-card__meta">
								{ project.team?.name && (
									<span>
										{ project.team.department?.name && `${ project.team.department.name } · ` }
										{ project.team.name }
									</span>
								) }
							</div>
						</div>
					</div>

					{/* Right actions */}
					<div className="st-todox-pd-card__actions">
						<Button size="sm" onClick={ openCreateSprint }>
							<Plus size={ 13 } /> New Sprint
						</Button>
						<Button size="sm" variant="secondary" onClick={ () => setTaskCreateOpen( true ) }>
							<Plus size={ 13 } /> Add Task
						</Button>
					</div>
				</div>

				{/* Stats bar */}
				<div className="st-todox-pd-card__stats">
					<span>
						<strong>{ sprints.length }</strong>
						{ ' ' }sprint{ sprints.length !== 1 ? 's' : '' }
					</span>
					<span>
						<strong>{ totalTasks }</strong>
						{ ' ' }task{ totalTasks !== 1 ? 's' : '' }
					</span>
					<span>
						<strong>{ backlog.length }</strong>
						{ ' ' }backlog
					</span>
					{ activeSprint && (
						<span className="st-todox-pd-card__active-sprint">
							<PlayCircle size={ 12 } />
							Active: { activeSprint.name }
						</span>
					) }
				</div>
			</div>

			{/* ── Sprints ── */}
			<div className="st-todox-section">
				<div className="st-todox-section__header">
					<h2 className="st-todox-section__title">Sprints</h2>
				</div>

				{ sprintsLoading ? (
					<Spinner />
				) : sprints.length === 0 ? (
					<div className="st-todox-empty-dashed">
						<Zap size={ 32 } className="st-todox-empty-dashed__icon" />
						<p className="st-todox-empty-dashed__title">No sprints yet</p>
						<p className="st-todox-empty-dashed__desc">Create a sprint to start organizing tasks.</p>
						<Button size="sm" onClick={ openCreateSprint } className="st-todox-empty-dashed__action">
							<Plus size={ 13 } /> New Sprint
						</Button>
					</div>
				) : (
					<div className="st-todox-sprint-rows">
						{ sprints.map( ( sprint: Sprint ) => {
							const scfg = SPRINT_STATUS_CONFIG[ sprint.status ] ?? SPRINT_STATUS_CONFIG.planned;
							return (
								<div
									key={ sprint.id }
									className="st-todox-sprint-row"
									onClick={ () => navigate( `/sprints/${ sprint.id }` ) }
								>
									{/* Left icon */}
									<div
										className="st-todox-sprint-row__icon"
										style={ { background: scfg.color + '20', color: scfg.color } }
									>
										<Zap size={ 16 } />
									</div>

									{/* Middle content */}
									<div className="st-todox-sprint-row__content">
										<span className="st-todox-sprint-row__name">{ sprint.name }</span>
										{ sprint.goal && (
											<span className="st-todox-sprint-row__goal">{ sprint.goal }</span>
										) }
									</div>

									{/* Right section */}
									<div className="st-todox-sprint-row__right" onClick={ ( e ) => e.stopPropagation() }>
										<StatusPill< SprintStatus >
											current={ sprint.status }
											options={ SPRINT_STATUS_ORDER }
											config={ SPRINT_STATUS_CONFIG }
											onChange={ ( s ) => updateSprintMutation.mutate( { id: sprint.id, data: { status: s } } ) }
											loading={ updateSprintMutation.isPending }
										/>
										<div className="st-todox-sprint-row__stats">
											<span>
												<CheckSquare size={ 12 } />
												{ sprint.tasks_count ?? 0 }
											</span>
											{ ( sprint.start_date || sprint.end_date ) && (
												<span>
													<Clock size={ 12 } />
													{ sprint.start_date ? formatDate( sprint.start_date ) : '?' }
													{ ' – ' }
													{ sprint.end_date ? formatDate( sprint.end_date ) : '?' }
												</span>
											) }
										</div>
										<ChevronRight size={ 15 } className="st-todox-sprint-row__chevron" />
										<SprintMenu
											sprint={ sprint }
											onEdit={ () => openEditSprint( sprint ) }
											onDelete={ () => setDeleteSprint( sprint ) }
											loading={ updateSprintMutation.isPending }
										/>
									</div>
								</div>
							);
						} ) }
					</div>
				) }
			</div>

			{/* ── Backlog ── */}
			{ backlog.length > 0 && (
				<div className="st-todox-section">
					<div className="st-todox-section__header">
						<h2 className="st-todox-section__title">
							Backlog
							<span className="st-todox-section__count">{ backlog.length }</span>
						</h2>
					</div>
					<div className="st-todox-table-wrapper">
						<table className="st-todox-table">
							<thead>
								<tr>
									<th>Title</th>
									<th>Status</th>
									<th>Priority</th>
									<th>Assignee</th>
									<th>Due</th>
								</tr>
							</thead>
							<tbody>
								{ backlog.map( ( task: Task ) => (
									<tr
										key={ task.id }
										className={ `st-todox-table__row ${ isOverdue( task.due_date ) ? 'st-todox-table__row--overdue' : '' }` }
									>
										<td>
											<button className="st-todox-link" onClick={ () => navigate( `/tasks/${ task.id }` ) }>
												{ task.title }
											</button>
										</td>
										<td><StatusBadge status={ task.status } /></td>
										<td><PriorityBadge priority={ task.priority } /></td>
										<td>
											{ task.assignee ? (
												<div className="st-todox-assignee">
													<Avatar name={ task.assignee.name } src={ task.assignee.avatar } size={ 20 } />
													<span>{ task.assignee.name }</span>
												</div>
											) : (
												<span className="st-todox-text--muted">—</span>
											) }
										</td>
										<td className={ isOverdue( task.due_date ) ? 'st-todox-text--danger' : '' }>
											{ formatDate( task.due_date ) }
										</td>
									</tr>
								) ) }
							</tbody>
						</table>
					</div>
				</div>
			) }

			{/* Sprint modal */}
			<Modal
				isOpen={ sprintModalOpen }
				onClose={ closeSprint }
				title={ editSprint ? 'Edit Sprint' : 'New Sprint' }
				size="sm"
				footer={
					<>
						<Button variant="secondary" onClick={ closeSprint } disabled={ sprintPending }>Cancel</Button>
						<Button onClick={ doSprintSubmit } loading={ sprintPending }>
							{ editSprint ? 'Save Changes' : 'Create Sprint' }
						</Button>
					</>
				}
			>
				<form onSubmit={ ( e ) => { e.preventDefault(); doSprintSubmit(); } } className="st-todox-form">
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Name <span className="st-todox-form__required">*</span></label>
						<input
							type="text"
							className="st-todox-form__input"
							placeholder="Sprint name"
							value={ sprintForm.name }
							onChange={ ( e ) => setSprintForm( { ...sprintForm, name: e.target.value } ) }
							autoFocus
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Goal</label>
						<textarea
							className="st-todox-form__textarea"
							rows={ 2 }
							placeholder="What is this sprint trying to achieve?"
							value={ sprintForm.goal ?? '' }
							onChange={ ( e ) => setSprintForm( { ...sprintForm, goal: e.target.value } ) }
						/>
					</div>
					<div className="st-todox-form__row">
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">Start Date</label>
							<input
								type="date"
								className="st-todox-form__input"
								value={ sprintForm.start_date ?? '' }
								onChange={ ( e ) => setSprintForm( { ...sprintForm, start_date: e.target.value } ) }
							/>
						</div>
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">End Date</label>
							<input
								type="date"
								className="st-todox-form__input"
								value={ sprintForm.end_date ?? '' }
								onChange={ ( e ) => setSprintForm( { ...sprintForm, end_date: e.target.value } ) }
							/>
						</div>
					</div>
				</form>
			</Modal>

			<ConfirmDialog
				isOpen={ !! deleteSprint }
				onClose={ () => setDeleteSprint( null ) }
				onConfirm={ () => deleteSprint && deleteSprintMutation.mutate( deleteSprint.id ) }
				title="Delete Sprint"
				message={ `Delete "${ deleteSprint?.name }"? Tasks in this sprint will move to backlog.` }
				confirmLabel="Delete"
				loading={ deleteSprintMutation.isPending }
			/>

			<CreateTaskModal
				isOpen={ taskCreateOpen }
				onClose={ () => setTaskCreateOpen( false ) }
				workspaceId={ project.workspace_id }
				projectId={ projectId }
				onCreated={ () => qc.invalidateQueries( { queryKey: [ 'tasks', 'project', projectId ] } ) }
			/>
		</div>
	);
};

export default ProjectDetail;
