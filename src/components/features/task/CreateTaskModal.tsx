/**
 * External dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

/**
 * Internal dependencies
 */
import { tasksApi, projectsApi, sprintsApi, usersApi } from '../../../api';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import LabelSelector from '../../ui/LabelSelector';
import { useTaskStatuses } from '../../../hooks/useTaskStatuses';
import type { Task, TaskPriority, CreateTaskInput, Sprint, Project } from '../../../types';

interface CreateTaskModalProps {
	isOpen:            boolean;
	onClose:           () => void;
	workspaceId:       number;
	projectId?:        number;
	sprintId?:         number;
	defaultStatusId?:  number | null;
	defaultDueDate?:   string | null;
	onCreated?:        ( task: Task ) => void;
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
	{ value: 'low',    label: 'Low' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'high',   label: 'High' },
	{ value: 'urgent', label: 'Urgent' },
];

const initialForm = (): Partial<CreateTaskInput> => ( {
	title:       '',
	description: '',
	status_id:   null,
	priority:    'medium',
	start_date:  null,
	due_date:    null,
	assignee_id: null,
	label_ids:   [],
} );

const CreateTaskModal = ( {
	isOpen,
	onClose,
	workspaceId,
	projectId,
	sprintId,
	defaultStatusId,
	defaultDueDate,
	onCreated,
}: CreateTaskModalProps ) => {
	const qc = useQueryClient();
	const { statuses: taskStatuses } = useTaskStatuses();
	const [ form, setForm ] = useState<Partial<CreateTaskInput>>( initialForm() );

	useEffect( () => {
		if ( isOpen ) {
			const id = defaultStatusId ?? taskStatuses[0]?.id ?? null;
			setForm( { ...initialForm(), status_id: id, due_date: defaultDueDate ?? null } );
		}
	}, [ isOpen, defaultStatusId, defaultDueDate, taskStatuses ] );

	// ── Projects (only when no project is pre-set) ──
	const { data: projects = [] } = useQuery< Project[] >( {
		queryKey: [ 'projects', workspaceId ],
		queryFn:  () => projectsApi.getAll( workspaceId ),
		enabled:  isOpen && ! projectId,
		staleTime: 2 * 60_000,
	} );

	// ── Sprints ──
	// When projectId prop is given → load that project's sprints only.
	// When no projectId prop → load sprints for ALL workspace projects so the
	//   user can pick any sprint (same pattern as managex).
	const formProjectId = form.project_id;
	const effectiveProjectId = projectId ?? formProjectId;

	const { data: projectSprints = [], isLoading: sprintsLoading } = useQuery< Sprint[] >( {
		queryKey: [ 'sprints', effectiveProjectId ],
		queryFn:  () => sprintsApi.getAll( effectiveProjectId! ),
		enabled:  isOpen && !! effectiveProjectId && ! sprintId,
		staleTime: 2 * 60_000,
	} );

	// Load all workspace sprints when no project prop AND no project chosen in form yet
	const { data: allSprints = [], isLoading: allSprintsLoading } = useQuery< Sprint[] >( {
		queryKey: [ 'sprints', 'workspace-all', workspaceId, projects.map( ( p ) => p.id ).join( ',' ) ],
		queryFn:  async () => {
			if ( ! projects.length ) return [];
			const results = await Promise.all( projects.map( ( p ) => sprintsApi.getAll( p.id ) ) );
			return results.flat();
		},
		enabled:  isOpen && ! projectId && ! formProjectId && projects.length > 0 && ! sprintId,
		staleTime: 2 * 60_000,
	} );

	// Which sprint list to display
	const sprintOptions: Sprint[] = sprintId
		? []
		: effectiveProjectId
			? projectSprints
			: allSprints;

	const sprintsIsLoading = sprintsLoading || allSprintsLoading;

	// ── Users ──
	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'workspace', workspaceId ],
		queryFn:  () => usersApi.getAll( { workspace_id: workspaceId, per_page: 100 } ),
		enabled:  isOpen && !! workspaceId,
		staleTime: 5 * 60_000,
	} );
	const users = usersData?.items ?? [];

	// ── Mutation ──
	const createMutation = useMutation( {
		mutationFn: ( data: CreateTaskInput ) => tasksApi.create( data ),
		onSuccess: ( task ) => {
			qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
			toast.success( 'Task created.' );
			onCreated?.( task );
			handleClose();
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const handleClose = () => {
		setForm( initialForm() );
		onClose();
	};

	const doSubmit = () => {
		if ( ! workspaceId ) { toast.error( 'No workspace selected.' ); return; }
		if ( ! form.title?.trim() ) { toast.error( 'Title is required.' ); return; }

		createMutation.mutate( {
			workspace_id: workspaceId,
			project_id:   projectId ?? formProjectId,
			sprint_id:    sprintId  ?? form.sprint_id ?? null,
			title:        form.title.trim(),
			description:  form.description || undefined,
			status_id:    form.status_id ?? null,
			priority:     form.priority,
			start_date:   form.start_date || null,
			due_date:     form.due_date || null,
			assignee_id:  form.assignee_id || null,
			label_ids:    form.label_ids || [],
		} );
	};

	const set = ( key: keyof CreateTaskInput, value: unknown ) =>
		setForm( ( prev ) => ( { ...prev, [ key ]: value } ) );

	// ── Sprint label helper ──
	const sprintLabel = ( sprint: Sprint ) => {
		if ( effectiveProjectId || projectId ) return sprint.name;
		return sprint.project?.name ? `${ sprint.project.name } · ${ sprint.name }` : sprint.name;
	};

	return (
		<Modal
			isOpen={ isOpen }
			onClose={ handleClose }
			title="Create Task"
			size="md"
			footer={
				<>
					<Button variant="secondary" onClick={ handleClose } disabled={ createMutation.isPending }>
						Cancel
					</Button>
					<Button
						onClick={ doSubmit }
						loading={ createMutation.isPending }
					>
						Create Task
					</Button>
				</>
			}
		>
			<form onSubmit={ ( e ) => { e.preventDefault(); doSubmit(); } } className="st-todox-form">

				{/* Title */}
				<div className="st-todox-form__group">
					<label className="st-todox-form__label">Title <span className="st-todox-form__required">*</span></label>
					<input
						type="text"
						className="st-todox-form__input"
						placeholder="Task title…"
						value={ form.title }
						onChange={ ( e ) => set( 'title', e.target.value ) }
						autoFocus
					/>
				</div>

				{/* Description */}
				<div className="st-todox-form__group">
					<label className="st-todox-form__label">Description</label>
					<textarea
						className="st-todox-form__textarea"
						placeholder="Optional description…"
						rows={ 3 }
						value={ form.description ?? '' }
						onChange={ ( e ) => set( 'description', e.target.value ) }
					/>
				</div>

				{/* Status + Priority */}
				<div className="st-todox-form__row">
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Status</label>
						<select
							className="st-todox-form__select"
							value={ form.status_id ?? '' }
							onChange={ ( e ) => set( 'status_id', e.target.value ? Number( e.target.value ) : null ) }
						>
							{ taskStatuses.map( ( s ) => (
								<option key={ s.value } value={ s.id ?? '' }>{ s.label }</option>
							) ) }
						</select>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Priority</label>
						<select
							className="st-todox-form__select"
							value={ form.priority }
							onChange={ ( e ) => set( 'priority', e.target.value as TaskPriority ) }
						>
							{ PRIORITIES.map( ( p ) => (
								<option key={ p.value } value={ p.value }>{ p.label }</option>
							) ) }
						</select>
					</div>
				</div>

				{/* Project (only when not pre-set) */}
				{ ! projectId && projects.length > 0 && (
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Project</label>
						<select
							className="st-todox-form__select"
							value={ formProjectId ?? '' }
							onChange={ ( e ) => {
								set( 'project_id', e.target.value ? Number( e.target.value ) : undefined );
								set( 'sprint_id', null );
							} }
						>
							<option value="">No project</option>
							{ projects.map( ( p ) => (
								<option key={ p.id } value={ p.id }>{ p.name }</option>
							) ) }
						</select>
					</div>
				) }

				{/* Sprint */}
				{ ! sprintId && (
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Sprint</label>
						<select
							className="st-todox-form__select"
							value={ form.sprint_id ?? '' }
							onChange={ ( e ) => set( 'sprint_id', e.target.value ? Number( e.target.value ) : null ) }
							disabled={ sprintsIsLoading }
						>
							<option value="">{ sprintsIsLoading ? 'Loading…' : 'No sprint (backlog)' }</option>
							{ sprintOptions.map( ( s ) => (
								<option key={ s.id } value={ s.id }>{ sprintLabel( s ) }</option>
							) ) }
						</select>
					</div>
				) }

				{/* Assignee */}
				<div className="st-todox-form__group">
					<label className="st-todox-form__label">Assignee</label>
					<select
						className="st-todox-form__select"
						value={ form.assignee_id ?? '' }
						onChange={ ( e ) => set( 'assignee_id', e.target.value ? Number( e.target.value ) : null ) }
					>
						<option value="">Unassigned</option>
						{ users.map( ( u ) => (
							<option key={ u.id } value={ u.id }>{ u.name }</option>
						) ) }
					</select>
				</div>

				{/* Start Date + Due Date */}
				<div className="st-todox-form__row">
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Start Date</label>
						<input
							type="date"
							className="st-todox-form__input"
							value={ form.start_date ?? '' }
							onChange={ ( e ) => set( 'start_date', e.target.value || null ) }
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Due Date</label>
						<input
							type="date"
							className="st-todox-form__input"
							value={ form.due_date ?? '' }
							onChange={ ( e ) => set( 'due_date', e.target.value || null ) }
						/>
					</div>
				</div>

				{/* Labels */}
				{ workspaceId && (
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Labels</label>
						<LabelSelector
							workspaceId={ workspaceId }
							labelType="task_label"
							selectedIds={ form.label_ids || [] }
							onChange={ ( ids ) => set( 'label_ids', ids ) }
						/>
					</div>
				) }

			</form>
		</Modal>
	);
};

export default CreateTaskModal;
