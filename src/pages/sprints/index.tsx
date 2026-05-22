/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
	Zap, Calendar, CheckSquare, MoreHorizontal, Pencil, Trash2, Plus, Check,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { sprintsApi, projectsApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { formatDate } from '../../utils/helpers';
import type { Sprint, SprintStatus, CreateSprintInput } from '../../types';

const STATUS_CONFIG: Record< SprintStatus, { label: string; color: string } > = {
	active:    { label: 'Active',    color: '#10b981' },
	planned:   { label: 'Planned',   color: '#6366f1' },
	completed: { label: 'Completed', color: '#94a3b8' },
};

const STATUS_ORDER: SprintStatus[] = [ 'active', 'planned', 'completed' ];

interface SprintForm {
	project_id: string;
	name:       string;
	goal:       string;
	start_date: string;
	end_date:   string;
}

const emptyForm = (): SprintForm => ( {
	project_id: '',
	name:       '',
	goal:       '',
	start_date: '',
	end_date:   '',
} );

const SprintsPage = () => {
	const navigate = useNavigate();
	const qc       = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();

	const [ menuOpen, setMenuOpen ]         = useState< number | null >( null );
	const [ modalOpen, setModalOpen ]       = useState( false );
	const [ editing, setEditing ]           = useState< Sprint | null >( null );
	const [ deleteTarget, setDeleteTarget ] = useState< Sprint | null >( null );
	const [ form, setForm ]                 = useState< SprintForm >( emptyForm() );

	// ── Data ──
	const { data: projects = [], isLoading: projectsLoading } = useQuery( {
		queryKey: [ 'projects', activeWorkspaceId ],
		queryFn:  () => projectsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const projectIds = projects.map( ( p ) => p.id );

	const { data: allSprints = [], isLoading: sprintsLoading } = useQuery< Sprint[] >( {
		queryKey: [ 'sprints', 'all', activeWorkspaceId, projectIds.join( ',' ) ],
		queryFn:  async () => {
			if ( ! projectIds.length ) return [];
			const results = await Promise.all( projectIds.map( ( pid ) => sprintsApi.getAll( pid ) ) );
			return results.flat();
		},
		enabled: !! activeWorkspaceId && projectIds.length > 0,
	} );

	const isLoading = projectsLoading || sprintsLoading;

	// ── Invalidate ──
	const invalidate = () => {
		qc.invalidateQueries( { queryKey: [ 'sprints', 'all', activeWorkspaceId ] } );
	};

	// ── Mutations ──
	const createMutation = useMutation( {
		mutationFn: ( data: CreateSprintInput ) => sprintsApi.create( data ),
		onSuccess: () => {
			invalidate();
			handleClose();
			toast.success( 'Sprint created.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateSprintInput > & { status?: string } } ) =>
			sprintsApi.update( id, data ),
		onSuccess: () => {
			invalidate();
			handleClose();
			toast.success( 'Sprint updated.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => sprintsApi.delete( id ),
		onSuccess:  () => { invalidate(); setDeleteTarget( null ); toast.success( 'Sprint deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	// ── Handlers ──
	const openCreate = () => {
		setEditing( null );
		setForm( { ...emptyForm(), project_id: String( projects[ 0 ]?.id ?? '' ) } );
		setModalOpen( true );
	};

	const openEdit = ( sprint: Sprint ) => {
		setEditing( sprint );
		setForm( {
			project_id: String( sprint.project?.id ?? '' ),
			name:       sprint.name,
			goal:       sprint.goal ?? '',
			start_date: sprint.start_date ?? '',
			end_date:   sprint.end_date ?? '',
		} );
		setMenuOpen( null );
		setModalOpen( true );
	};

	const handleClose = () => { setModalOpen( false ); setEditing( null ); setForm( emptyForm() ); };

	const doSubmit = () => {
		if ( ! form.name.trim() ) { toast.error( 'Name is required.' ); return; }

		const payload = {
			name:       form.name.trim(),
			goal:       form.goal || undefined,
			start_date: form.start_date || undefined,
			end_date:   form.end_date || undefined,
		};

		if ( editing ) {
			updateMutation.mutate( { id: editing.id, data: payload } );
		} else {
			if ( ! form.project_id ) { toast.error( 'Please select a project.' ); return; }
			createMutation.mutate( { project_id: Number( form.project_id ), ...payload } );
		}
	};

	const changeStatus = ( sprint: Sprint, status: SprintStatus ) => {
		setMenuOpen( null );
		updateMutation.mutate( { id: sprint.id, data: { status } } );
	};

	const isSaving = createMutation.isPending || updateMutation.isPending;

	// ── Grouping ──
	const grouped: Record< SprintStatus, Sprint[] > = {
		active:    allSprints.filter( ( s ) => s.status === 'active' ),
		planned:   allSprints.filter( ( s ) => s.status === 'planned' ),
		completed: allSprints.filter( ( s ) => s.status === 'completed' ),
	};

	return (
		<div className="st-todox-page">
			<PageHeader
				title="Sprints"
				description={ `${ activeWorkspace?.name } · ${ allSprints.length } sprint${ allSprints.length !== 1 ? 's' : '' }` }
				actions={
					<div className="st-todox-page-header__btn-group">
						{ projects.length > 0 && (
							<>
								<Button variant="secondary" onClick={ () => navigate( '/projects' ) }>
									Manage Projects
								</Button>
								<Button onClick={ openCreate } leftIcon={ <Plus size={ 14 } /> }>
									New Sprint
								</Button>
							</>
						) }
					</div>
				}
			/>

			{ isLoading ? (
				<Spinner />
			) : projects.length === 0 ? (
				<div className="st-todox-empty-dashed">
					<Zap size={ 40 } className="st-todox-empty-dashed__icon" />
					<p className="st-todox-empty-dashed__title">No projects yet</p>
					<p className="st-todox-empty-dashed__desc">Create a project first, then you can add sprints to it.</p>
					<button className="st-todox-link-btn st-todox-empty-dashed__action" onClick={ () => navigate( '/projects' ) }>
						Go to Projects →
					</button>
				</div>
			) : allSprints.length === 0 ? (
				<div className="st-todox-empty-dashed">
					<Zap size={ 40 } className="st-todox-empty-dashed__icon" />
					<p className="st-todox-empty-dashed__title">No sprints yet</p>
					<p className="st-todox-empty-dashed__desc">Create your first sprint to start planning work.</p>
					<Button onClick={ openCreate } className="st-todox-empty-dashed__action" leftIcon={ <Plus size={ 14 } /> }>
						New Sprint
					</Button>
				</div>
			) : (
				<div className="st-todox-section-groups">
					{ STATUS_ORDER.map( ( status ) => {
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
									{ items.map( ( sprint ) => (
										<div
											key={ sprint.id }
											className="st-todox-entity-card st-todox-entity-card--clickable"
											onClick={ () => navigate( `/sprints/${ sprint.id }` ) }
											style={ { borderTopColor: sprint.project?.color ?? cfg.color, borderTopWidth: '3px' } }
										>
											<div className="st-todox-entity-card__body">
												<div className="st-todox-entity-card__head-row">
													<div
														className="st-todox-entity-card__avatar"
														style={ { background: cfg.color + '20', color: cfg.color } }
													>
														<Zap size={ 18 } />
													</div>
													<div className="st-todox-entity-card__meta">
														<h3 className="st-todox-entity-card__name">{ sprint.name }</h3>
														<p className="st-todox-entity-card__desc">{ sprint.project?.name }</p>
													</div>

													{/* Actions menu */}
													<div className="st-todox-entity-card__menu-wrap" onClick={ ( e ) => e.stopPropagation() }>
														<button
															className="st-todox-entity-card__menu-btn"
															onClick={ () => setMenuOpen( menuOpen === sprint.id ? null : sprint.id ) }
														>
															<MoreHorizontal size={ 15 } />
														</button>
														{ menuOpen === sprint.id && (
															<>
																<div className="st-todox-dropdown-backdrop" onClick={ () => setMenuOpen( null ) } />
																<div className="st-todox-entity-card__menu-dropdown">
																	<button onClick={ () => openEdit( sprint ) }>
																		<Pencil size={ 13 } /> Edit
																	</button>

																	<div className="st-todox-dropdown-divider" />
																	<div className="st-todox-dropdown-section-label">Set status</div>

																	{ STATUS_ORDER.map( ( s ) => (
																		<button
																			key={ s }
																			className={ sprint.status === s ? 'st-todox-dropdown-status-current' : '' }
																			onClick={ () => changeStatus( sprint, s ) }
																		>
																			<span className="st-todox-dropdown-status-dot" style={ { background: STATUS_CONFIG[ s ].color } } />
																			{ STATUS_CONFIG[ s ].label }
																			{ sprint.status === s && <Check size={ 11 } className="st-todox-dropdown-status-check" /> }
																		</button>
																	) ) }

																	<div className="st-todox-dropdown-divider" />
																	<button
																		className="st-todox-entity-card__menu-danger"
																		onClick={ () => { setDeleteTarget( sprint ); setMenuOpen( null ); } }
																	>
																		<Trash2 size={ 13 } /> Delete
																	</button>
																</div>
															</>
														) }
													</div>
												</div>

												{ sprint.goal && (
													<p className="st-todox-entity-card__body-desc">{ sprint.goal }</p>
												) }

												<div className="st-todox-entity-card__stats">
													<span>
														<CheckSquare size={ 13 } />
														<strong>{ sprint.tasks_count ?? 0 }</strong> task{ ( sprint.tasks_count ?? 0 ) !== 1 ? 's' : '' }
													</span>
													{ ( sprint.start_date || sprint.end_date ) && (
														<span>
															<Calendar size={ 13 } />
															{ sprint.start_date ? formatDate( sprint.start_date ) : '?' }
															{ ' – ' }
															{ sprint.end_date ? formatDate( sprint.end_date ) : '?' }
														</span>
													) }
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

			{/* Create / Edit modal */}
			<Modal
				isOpen={ modalOpen }
				onClose={ handleClose }
				title={ editing ? 'Edit Sprint' : 'New Sprint' }
				size="sm"
				footer={
					<>
						<Button variant="secondary" onClick={ handleClose } disabled={ isSaving }>Cancel</Button>
						<Button onClick={ doSubmit } loading={ isSaving }>
							{ editing ? 'Save Changes' : 'Create Sprint' }
						</Button>
					</>
				}
			>
				<form onSubmit={ ( e ) => { e.preventDefault(); doSubmit(); } } className="st-todox-form">
					{ ! editing && (
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">Project <span className="st-todox-form__required">*</span></label>
							<select
								className="st-todox-form__input"
								value={ form.project_id }
								onChange={ ( e ) => setForm( { ...form, project_id: e.target.value } ) }
								required
							>
								<option value="">Select a project…</option>
								{ projects.map( ( p ) => (
									<option key={ p.id } value={ p.id }>{ p.name }</option>
								) ) }
							</select>
						</div>
					) }
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Name <span className="st-todox-form__required">*</span></label>
						<input
							type="text"
							className="st-todox-form__input"
							placeholder="Sprint name"
							value={ form.name }
							onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) }
							autoFocus
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Goal</label>
						<textarea
							className="st-todox-form__textarea"
							rows={ 2 }
							placeholder="What is this sprint trying to achieve?"
							value={ form.goal }
							onChange={ ( e ) => setForm( { ...form, goal: e.target.value } ) }
						/>
					</div>
					<div className="st-todox-form__row">
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">Start Date</label>
							<input
								type="date"
								className="st-todox-form__input"
								value={ form.start_date }
								onChange={ ( e ) => setForm( { ...form, start_date: e.target.value } ) }
							/>
						</div>
						<div className="st-todox-form__group">
							<label className="st-todox-form__label">End Date</label>
							<input
								type="date"
								className="st-todox-form__input"
								value={ form.end_date }
								onChange={ ( e ) => setForm( { ...form, end_date: e.target.value } ) }
							/>
						</div>
					</div>
				</form>
			</Modal>

			{/* Delete confirm */}
			<ConfirmDialog
				isOpen={ !! deleteTarget }
				onClose={ () => setDeleteTarget( null ) }
				onConfirm={ () => deleteTarget && deleteMutation.mutate( deleteTarget.id ) }
				title="Delete Sprint"
				message={ `Delete "${ deleteTarget?.name }"? This cannot be undone.` }
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
			/>
		</div>
	);
};

export default SprintsPage;
