/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FolderKanban, Zap, MoreHorizontal, Pencil, Trash2, Plus, Check } from 'lucide-react';

/**
 * Internal dependencies
 */
import { projectsApi, teamsApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Spinner from '../../components/ui/Spinner';
import type { Project, CreateProjectInput, ProjectStatus } from '../../types';

const COLORS = [ '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6' ];

const STATUS_CONFIG: Record< ProjectStatus, { label: string; color: string } > = {
	active:    { label: 'Active',    color: '#10b981' },
	completed: { label: 'Completed', color: '#3b82f6' },
	archived:  { label: 'Archived',  color: '#94a3b8' },
};

const emptyForm = (): CreateProjectInput => ( {
	workspace_id: 0,
	team_id:      0,
	name:         '',
	description:  '',
	color:        '#6366f1',
} );

const ProjectsPage = () => {
	const navigate = useNavigate();
	const qc       = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();

	const [ modalOpen, setModalOpen ]       = useState( false );
	const [ editing, setEditing ]           = useState< Project | null >( null );
	const [ deleteTarget, setDeleteTarget ] = useState< Project | null >( null );
	const [ menuOpen, setMenuOpen ]         = useState< number | null >( null );
	const [ form, setForm ]                 = useState< CreateProjectInput >( emptyForm() );

	const { data: projects = [], isLoading } = useQuery( {
		queryKey: [ 'projects', activeWorkspaceId ],
		queryFn:  () => projectsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const { data: teams = [] } = useQuery( {
		queryKey: [ 'teams', activeWorkspaceId ],
		queryFn:  () => teamsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const invalidate = () => qc.invalidateQueries( { queryKey: [ 'projects', activeWorkspaceId ] } );

	const createMutation = useMutation( {
		mutationFn: ( data: CreateProjectInput ) => projectsApi.create( data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Project created.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateProjectInput > } ) =>
			projectsApi.update( id, data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Project updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => projectsApi.delete( id ),
		onSuccess:  () => { invalidate(); setDeleteTarget( null ); toast.success( 'Project deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const statusMutation = useMutation( {
		mutationFn: ( { id, status }: { id: number; status: ProjectStatus } ) =>
			projectsApi.update( id, { status } ),
		onSuccess:  () => { invalidate(); toast.success( 'Status updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const changeStatus = ( project: Project, status: ProjectStatus ) => {
		setMenuOpen( null );
		statusMutation.mutate( { id: project.id, status } );
	};

	const openCreate = () => {
		setEditing( null );
		setForm( { ...emptyForm(), workspace_id: activeWorkspaceId! } );
		setModalOpen( true );
	};

	const openEdit = ( project: Project ) => {
		setEditing( project );
		setForm( {
			workspace_id: project.workspace_id,
			team_id:      project.team_id,
			name:         project.name,
			description:  project.description ?? '',
			color:        project.color,
		} );
		setMenuOpen( null );
		setModalOpen( true );
	};

	const handleClose = () => { setModalOpen( false ); setEditing( null ); setForm( emptyForm() ); };

	const doSubmit = () => {
		if ( ! form.name.trim() ) { toast.error( 'Name is required.' ); return; }
		if ( ! form.team_id ) { toast.error( 'Team is required.' ); return; }
		if ( editing ) {
			updateMutation.mutate( { id: editing.id, data: form } );
		} else {
			createMutation.mutate( { ...form, workspace_id: activeWorkspaceId! } );
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	const grouped: Record< string, Project[] > = {};
	projects.forEach( ( p: Project ) => {
		const key = p.status ?? 'active';
		if ( ! grouped[ key ] ) grouped[ key ] = [];
		grouped[ key ].push( p );
	} );
	const statusOrder: ProjectStatus[] = [ 'active', 'completed', 'archived' ];

	return (
		<div className="st-todox-page">
			{/* Page Header */}
			<div className="st-todox-page-hd">
				<div className="st-todox-page-hd__left">
					<div className="st-todox-page-hd__icon-box">
						<FolderKanban size={ 20 } />
					</div>
					<div>
						<h1 className="st-todox-page-hd__title">Projects</h1>
						<p className="st-todox-page-hd__sub">
							{ activeWorkspace?.name } · { projects.length } project{ projects.length !== 1 ? 's' : '' }
						</p>
					</div>
				</div>
				{ activeWorkspaceId && (
					<Button onClick={ openCreate }><Plus size={ 14 } /> New Project</Button>
				) }
			</div>

			{ isLoading ? (
				<Spinner />
			) : projects.length === 0 ? (
				<div className="st-todox-empty-dashed">
					<FolderKanban size={ 40 } className="st-todox-empty-dashed__icon" />
					<p className="st-todox-empty-dashed__title">No projects yet</p>
					<p className="st-todox-empty-dashed__desc">Create a project and assign it to a team.</p>
					{ teams.length > 0 ? (
						<Button onClick={ openCreate } className="st-todox-empty-dashed__action">New Project</Button>
					) : (
						<button className="st-todox-link-btn st-todox-empty-dashed__action" onClick={ () => navigate( '/departments' ) }>
							Create a team first →
						</button>
					) }
				</div>
			) : (
				<div className="st-todox-section-groups">
					{ statusOrder.map( ( status ) => {
						const items = grouped[ status ];
						if ( ! items?.length ) return null;
						const cfg = STATUS_CONFIG[ status ];
						return (
							<div key={ status } className="st-todox-section-group">
								<div className="st-todox-section-group__label">
									<span className="st-todox-section-group__dot" style={ { background: cfg.color } } />
									{ cfg.label }
								</div>
								<div className="st-todox-entity-grid">
									{ items.map( ( project ) => (
										<div
											key={ project.id }
											className="st-todox-entity-card st-todox-entity-card--clickable"
											onClick={ () => navigate( `/projects/${ project.id }` ) }
											style={ { borderTopColor: project.color, borderTopWidth: '3px' } }
										>
											<div className="st-todox-entity-card__body">
												<div className="st-todox-entity-card__head-row">
													<div className="st-todox-entity-card__avatar" style={ { background: project.color } }>
														{ project.name.slice( 0, 1 ).toUpperCase() }
													</div>
													<div className="st-todox-entity-card__meta">
														<h3 className="st-todox-entity-card__name">{ project.name }</h3>
														{ project.team?.name && (
															<p className="st-todox-entity-card__desc">
																{ project.team.department?.name && `${ project.team.department.name } · ` }
																{ project.team.name }
															</p>
														) }
													</div>
													<div className="st-todox-entity-card__menu-wrap" onClick={ ( e ) => e.stopPropagation() }>
														<button
															className="st-todox-entity-card__menu-btn"
															onClick={ () => setMenuOpen( menuOpen === project.id ? null : project.id ) }
														>
															<MoreHorizontal size={ 15 } />
														</button>
														{ menuOpen === project.id && (
															<>
																<div className="st-todox-dropdown-backdrop" onClick={ () => setMenuOpen( null ) } />
																<div className="st-todox-entity-card__menu-dropdown">
																	<button onClick={ () => openEdit( project ) }>
																		<Pencil size={ 13 } /> Edit
																	</button>

																	<div className="st-todox-dropdown-divider" />
																	<div className="st-todox-dropdown-section-label">Set status</div>

																	{ ( [ 'active', 'completed', 'archived' ] as ProjectStatus[] ).map( ( s ) => (
																		<button
																			key={ s }
																			className={ project.status === s ? 'st-todox-dropdown-status-current' : '' }
																			onClick={ () => changeStatus( project, s ) }
																		>
																			<span className="st-todox-dropdown-status-dot" style={ { background: STATUS_CONFIG[ s ].color } } />
																			{ STATUS_CONFIG[ s ].label }
																			{ project.status === s && <Check size={ 11 } className="st-todox-dropdown-status-check" /> }
																		</button>
																	) ) }

																	<div className="st-todox-dropdown-divider" />
																	<button className="st-todox-entity-card__menu-danger"
																		onClick={ () => { setDeleteTarget( project ); setMenuOpen( null ); } }>
																		<Trash2 size={ 13 } /> Delete
																	</button>
																</div>
															</>
														) }
													</div>
												</div>
												{ project.description && (
													<p className="st-todox-entity-card__body-desc">{ project.description }</p>
												) }
												<div className="st-todox-entity-card__stats">
													<span><Zap size={ 13 } /><strong>{ project.sprints_count ?? 0 }</strong> sprint{ ( project.sprints_count ?? 0 ) !== 1 ? 's' : '' }</span>
												</div>
											</div>
										</div>
									) ) }
								</div>
							</div>
						);
					} ) }
				</div>
			) }

			<Modal isOpen={ modalOpen } onClose={ handleClose } title={ editing ? 'Edit Project' : 'New Project' } size="sm"
				footer={
					<>
						<Button variant="secondary" onClick={ handleClose } disabled={ isPending }>Cancel</Button>
						<Button onClick={ doSubmit } loading={ isPending }>
							{ editing ? 'Save Changes' : 'Create' }
						</Button>
					</>
				}
			>
				<form onSubmit={ ( e ) => { e.preventDefault(); doSubmit(); } } className="st-todox-form">
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Name <span className="st-todox-form__required">*</span></label>
						<input type="text" className="st-todox-form__input" placeholder="Project name"
							value={ form.name } onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) } autoFocus />
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Team <span className="st-todox-form__required">*</span></label>
						<select className="st-todox-form__select" value={ form.team_id || '' }
							onChange={ ( e ) => setForm( { ...form, team_id: Number( e.target.value ) } ) }>
							<option value="">— Select team —</option>
							{ teams.map( ( t ) => <option key={ t.id } value={ t.id }>{ t.name }</option> ) }
						</select>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Description</label>
						<textarea className="st-todox-form__textarea" rows={ 2 } placeholder="Optional"
							value={ form.description ?? '' } onChange={ ( e ) => setForm( { ...form, description: e.target.value } ) } />
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Color</label>
						<div className="st-todox-color-picker">
							{ COLORS.map( ( c ) => (
								<button key={ c } type="button"
									className={ `st-todox-color-picker__swatch ${ form.color === c ? 'st-todox-color-picker__swatch--active' : '' }` }
									style={ { background: c } } onClick={ () => setForm( { ...form, color: c } ) } />
							) ) }
						</div>
					</div>
				</form>
			</Modal>

			<ConfirmDialog isOpen={ !! deleteTarget } onClose={ () => setDeleteTarget( null ) }
				onConfirm={ () => deleteTarget && deleteMutation.mutate( deleteTarget.id ) }
				title="Delete Project" message={ `Delete "${ deleteTarget?.name }"? This cannot be undone.` }
				confirmLabel="Delete" loading={ deleteMutation.isPending } />
		</div>
	);
};

export default ProjectsPage;
