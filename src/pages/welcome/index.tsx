/**
 * External dependencies
 */
import { useState, useEffect, useMemo, Fragment } from '@wordpress/element';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	Sparkles, Building2, Briefcase, Users, Plus, Trash2,
	ArrowRight, ArrowLeft, ChevronRight, Check, Rocket, PartyPopper,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { workspacesApi, departmentsApi, teamsApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { MultiSelect, ColorPicker, COLORS_ENTITY } from '../../components/inputs';
import type { Workspace, Department } from '../../types';

const COLORS = [ '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4' ];

interface DraftDepartment {
	key:   string;
	name:  string;
	color: string;
}

interface DraftTeam {
	key:            string;
	name:           string;
	color:          string;
	departmentKeys: string[];
}

const STEPS = [ 'intro', 'workspace', 'departments', 'teams', 'done' ] as const;
type Step = typeof STEPS[ number ];

const STEP_LABELS: Record< Step, string > = {
	intro:       'Welcome',
	workspace:   'Workspace',
	departments: 'Departments',
	teams:       'Teams',
	done:        'Done',
};

const makeKey = () => Math.random().toString( 36 ).slice( 2, 9 );

const WelcomePage = () => {
	const navigate = useNavigate();
	const qc       = useQueryClient();
	const { switchWorkspace } = useWorkspace();

	// If a workspace already exists, this page is reachable but unnecessary.
	// We still let the user proceed so they can run setup again if they want —
	// the guard in AppLayout only forces a redirect when there are zero workspaces.
	const { data: existingWorkspaces = [], isLoading: wsLoading } = useQuery( {
		queryKey: [ 'workspaces' ],
		queryFn:  workspacesApi.getAll,
	} );

	const [ step, setStep ] = useState< Step >( 'intro' );

	// Step 2: workspace
	const [ wsName,  setWsName  ] = useState( '' );
	const [ wsDesc,  setWsDesc  ] = useState( '' );
	const [ wsColor, setWsColor ] = useState( COLORS[ 0 ] );

	// Step 3: departments (in-memory drafts; persisted only on "Finish")
	const [ departments, setDepartments ] = useState< DraftDepartment[] >( [
		{ key: makeKey(), name: '', color: COLORS[ 1 ] },
	] );

	// Step 4: teams
	const [ teams, setTeams ] = useState< DraftTeam[] >( [
		{ key: makeKey(), name: '', color: COLORS[ 2 ], departmentKeys: [] },
	] );

	// Submission state
	const [ submitting, setSubmitting ] = useState( false );
	const [ createdWs, setCreatedWs ]   = useState< Workspace | null >( null );

	// Prefill workspace name when an existing workspace already exists.
	useEffect( () => {
		if ( existingWorkspaces.length && ! wsName ) {
			setWsName( existingWorkspaces[ 0 ].name );
		}
	}, [ existingWorkspaces, wsName ] );

	const currentIndex = STEPS.indexOf( step );

	const filledDepartments = useMemo(
		() => departments.filter( ( d ) => d.name.trim() !== '' ),
		[ departments ]
	);

	const departmentKeyToName = useMemo( () => {
		const map: Record< string, string > = {};
		filledDepartments.forEach( ( d ) => { map[ d.key ] = d.name.trim(); } );
		return map;
	}, [ filledDepartments ] );

	// ── Step navigation ──
	const canGoNext = (): boolean => {
		if ( step === 'workspace' ) return wsName.trim().length > 0;
		return true;
	};

	const goNext = async () => {
		if ( step === 'done' ) {
			finish();
			return;
		}
		if ( step === 'teams' ) {
			await runSetup();
			return;
		}
		const next = STEPS[ currentIndex + 1 ];
		if ( next ) setStep( next );
	};

	const goBack = () => {
		const prev = STEPS[ currentIndex - 1 ];
		if ( prev ) setStep( prev );
	};

	// ── Department editing ──
	const addDepartment = () =>
		setDepartments( [ ...departments, { key: makeKey(), name: '', color: COLORS[ departments.length % COLORS.length ] } ] );

	const updateDepartment = ( key: string, patch: Partial< DraftDepartment > ) =>
		setDepartments( departments.map( ( d ) => ( d.key === key ? { ...d, ...patch } : d ) ) );

	const removeDepartment = ( key: string ) => {
		setDepartments( departments.filter( ( d ) => d.key !== key ) );
		setTeams( teams
			.map( ( t ) => ( { ...t, departmentKeys: t.departmentKeys.filter( ( k ) => k !== key ) } ) )
			.filter( ( t ) => t.departmentKeys.length > 0 )
		);
	};

	// ── Team editing ──
	const addTeam = () => {
		if ( filledDepartments.length === 0 ) return;
		setTeams( [
			...teams,
			{
				key:            makeKey(),
				name:           '',
				color:          COLORS[ ( teams.length + 2 ) % COLORS.length ],
				departmentKeys: [ filledDepartments[ 0 ].key ],
			},
		] );
	};

	const updateTeam = ( key: string, patch: Partial< DraftTeam > ) =>
		setTeams( teams.map( ( t ) => ( t.key === key ? { ...t, ...patch } : t ) ) );

	const removeTeam = ( key: string ) => setTeams( teams.filter( ( t ) => t.key !== key ) );

	// ── Submit everything ──
	const runSetup = async () => {
		if ( ! wsName.trim() ) {
			toast.error( 'Workspace name is required.' );
			setStep( 'workspace' );
			return;
		}

		setSubmitting( true );

		try {
			// 1. Workspace
			const ws = await workspacesApi.create( {
				name:        wsName.trim(),
				description: wsDesc.trim() || undefined,
				color:       wsColor,
			} );

			setCreatedWs( ws );
			switchWorkspace( ws );

			// 2. Departments — map draft key → real DB id
			const deptKeyToId: Record< string, number > = {};
			for ( const draft of filledDepartments ) {
				const dept: Department = await departmentsApi.create( {
					workspace_id: ws.id,
					name:         draft.name.trim(),
					color:        draft.color,
					head_id:      null,
				} );
				deptKeyToId[ draft.key ] = dept.id;
			}

			// 3. Teams
			const validTeams = teams.filter(
				( t ) => t.name.trim() !== '' && t.departmentKeys.some( ( k ) => deptKeyToId[ k ] )
			);
			for ( const draft of validTeams ) {
				await teamsApi.create( {
					workspace_id:   ws.id,
					department_ids: draft.departmentKeys
						.map( ( k ) => deptKeyToId[ k ] )
						.filter( Boolean ),
					name:           draft.name.trim(),
					color:          draft.color,
					manager_id:     null,
				} );
			}

			// Refresh caches so the rest of the app sees the new data.
			qc.invalidateQueries( { queryKey: [ 'workspaces' ] } );
			qc.invalidateQueries( { queryKey: [ 'departments', ws.id ] } );
			qc.invalidateQueries( { queryKey: [ 'teams', ws.id ] } );

			setStep( 'done' );
		} catch ( err ) {
			toast.error( ( err as Error ).message || 'Setup failed.' );
		} finally {
			setSubmitting( false );
		}
	};

	const finish = () => navigate( '/' );

	if ( wsLoading ) {
		return <Spinner fullscreen />;
	}

	return (
		<div className="st-todox-welcome">
			<div className="st-todox-welcome__shell">
				{/* Brand */}
				<div className="st-todox-welcome__brand">
					<div className="st-todox-sidebar__logo-wrap">
						<div className="st-todox-sidebar__logo-icon">TX</div>
						<span className="st-todox-sidebar__logo-text">TodoX</span>
					</div>
				</div>

				{/* Stepper */}
				<ol className="st-todox-welcome__steps">
					{ STEPS.map( ( s, i ) => {
						const isDone    = i < currentIndex;
						const isCurrent = i === currentIndex;
						const isLast    = i === STEPS.length - 1;
						return (
							<Fragment key={ s }>
								<li
									className={
										'st-todox-welcome__step' +
										( isDone ? ' st-todox-welcome__step--done' : '' ) +
										( isCurrent ? ' st-todox-welcome__step--current' : '' )
									}
								>
									<span className="st-todox-welcome__step-dot">
										{ isDone ? <Check size={ 13 } /> : i + 1 }
									</span>
									<span className="st-todox-welcome__step-label">{ STEP_LABELS[ s ] }</span>
								</li>
								{ ! isLast && (
									<ChevronRight
										size={ 14 }
										className={
											'st-todox-welcome__step-arrow' +
											( isDone ? ' st-todox-welcome__step-arrow--done' : '' )
										}
										aria-hidden="true"
									/>
								) }
							</Fragment>
						);
					} ) }
				</ol>

				{/* Body */}
				<div className="st-todox-welcome__body">
					{ step === 'intro' && (
						<div className="st-todox-welcome__intro">
							<div className="st-todox-welcome__hero-icon">
								<Sparkles size={ 28 } />
							</div>
							<h1 className="st-todox-welcome__title">Welcome to TodoX</h1>
							<p className="st-todox-welcome__lede">
								Let&rsquo;s get you set up in a few quick steps. We&rsquo;ll create your
								first workspace, then add departments and teams so you can start
								shipping work right away.
							</p>
							<ul className="st-todox-welcome__feature-list">
								<li><Building2 size={ 16 } /> Create a workspace for your organisation</li>
								<li><Briefcase  size={ 16 } /> Organise work into departments</li>
								<li><Users      size={ 16 } /> Group people into teams</li>
							</ul>
						</div>
					) }

					{ step === 'workspace' && (
						<div className="st-todox-welcome__step-body">
							<div className="st-todox-welcome__step-hd">
								<Building2 size={ 22 } />
								<div>
									<h2>Create your workspace</h2>
									<p>The top-level container for everything in TodoX.</p>
								</div>
							</div>

							<div className="st-todox-form">
								<div className="st-todox-form__group">
									<label className="st-todox-form__label">
										Workspace name <span className="st-todox-form__required">*</span>
									</label>
									<input
										type="text"
										className="st-todox-form__input"
										placeholder="Acme Inc."
										value={ wsName }
										onChange={ ( e ) => setWsName( e.target.value ) }
										autoFocus
									/>
								</div>
								<div className="st-todox-form__group">
									<label className="st-todox-form__label">Description</label>
									<textarea
										className="st-todox-form__textarea"
										rows={ 2 }
										placeholder="Optional — what is this workspace for?"
										value={ wsDesc }
										onChange={ ( e ) => setWsDesc( e.target.value ) }
									/>
								</div>
								<div className="st-todox-form__group">
									<label className="st-todox-form__label">Color</label>
									<div className="st-todox-color-picker">
										{ COLORS.map( ( c ) => (
											<button
												key={ c }
												type="button"
												className={ `st-todox-color-picker__swatch ${ wsColor === c ? 'st-todox-color-picker__swatch--active' : '' }` }
												style={ { background: c } }
												onClick={ () => setWsColor( c ) }
											/>
										) ) }
									</div>
								</div>
							</div>
						</div>
					) }

					{ step === 'departments' && (
						<div className="st-todox-welcome__step-body">
							<div className="st-todox-welcome__step-hd">
								<Briefcase size={ 22 } />
								<div>
									<h2>Add departments</h2>
									<p>Departments group related teams. You can skip this and add them later.</p>
								</div>
							</div>

							<div className="st-todox-welcome__draft-list">
								{ departments.map( ( d, idx ) => (
									<div key={ d.key } className="st-todox-welcome__draft-row st-todox-welcome__draft-row--dept">
										<div
											className="st-todox-welcome__draft-avatar"
											style={ { background: d.color } }
										>
											{ ( d.name.trim()[ 0 ] || ( idx + 1 ).toString() ).toUpperCase() }
										</div>
										<input
											type="text"
											className="st-todox-form__input"
											placeholder="Department name (e.g. Engineering)"
											value={ d.name }
											onChange={ ( e ) => updateDepartment( d.key, { name: e.target.value } ) }
										/>
										<ColorPicker
											colors={ COLORS_ENTITY }
											value={ d.color }
											onChange={ ( c ) => updateDepartment( d.key, { color: c } ) }
										/>
										<button
											type="button"
											className="st-todox-welcome__draft-remove"
											onClick={ () => removeDepartment( d.key ) }
											aria-label="Remove department"
										>
											<Trash2 size={ 14 } />
										</button>
									</div>
								) ) }
							</div>

							<button
								type="button"
								className="st-todox-welcome__add-btn"
								onClick={ addDepartment }
							>
								<Plus size={ 14 } /> Add another department
							</button>
						</div>
					) }

					{ step === 'teams' && (
						<div className="st-todox-welcome__step-body">
							<div className="st-todox-welcome__step-hd">
								<Users size={ 22 } />
								<div>
									<h2>Add teams</h2>
									<p>Teams sit inside a department. Skip if you&rsquo;d rather add them later.</p>
								</div>
							</div>

							{ filledDepartments.length === 0 ? (
								<div className="st-todox-welcome__notice">
									Add at least one department in the previous step to create teams here.
								</div>
							) : (
								<>
									<div className="st-todox-welcome__draft-list">
										{ teams.map( ( t, idx ) => (
											<div key={ t.key } className="st-todox-welcome__draft-row">
												<div
													className="st-todox-welcome__draft-avatar"
													style={ { background: t.color } }
												>
													{ ( t.name.trim()[ 0 ] || ( idx + 1 ).toString() ).toUpperCase() }
												</div>
												<input
													type="text"
													className="st-todox-form__input"
													placeholder="Team name (e.g. Backend)"
													value={ t.name }
													onChange={ ( e ) => updateTeam( t.key, { name: e.target.value } ) }
												/>
												<div style={ { flex: 1, minWidth: 0 } }>
													<MultiSelect
														options={ filledDepartments.map( ( d, i ) => ( { id: i, name: d.name, color: d.color } ) ) }
														selectedIds={ t.departmentKeys
															.map( ( k ) => filledDepartments.findIndex( ( d ) => d.key === k ) )
															.filter( ( i ) => i !== -1 ) }
														onChange={ ( indices ) => updateTeam( t.key, {
															departmentKeys: indices
																.map( ( i ) => filledDepartments[ i ]?.key )
																.filter( Boolean ) as string[],
														} ) }
														placeholder="Select departments…"
														icon={ <Building2 size={ 14 } /> }
														emptyMessage="No departments added yet."
														searchPlaceholder="Search departments…"
													/>
												</div>
												<button
													type="button"
													className="st-todox-welcome__draft-remove"
													onClick={ () => removeTeam( t.key ) }
													aria-label="Remove team"
												>
													<Trash2 size={ 14 } />
												</button>
											</div>
										) ) }
									</div>

									<button
										type="button"
										className="st-todox-welcome__add-btn"
										onClick={ addTeam }
									>
										<Plus size={ 14 } /> Add a team
									</button>

									<p className="st-todox-welcome__hint">
										Departments referenced: { Object.keys( departmentKeyToName ).length }
									</p>
								</>
							) }
						</div>
					) }

					{ step === 'done' && (
						<div className="st-todox-welcome__intro">
							<div className="st-todox-welcome__hero-icon st-todox-welcome__hero-icon--success">
								<PartyPopper size={ 28 } />
							</div>
							<h1 className="st-todox-welcome__title">You&rsquo;re all set!</h1>
							<p className="st-todox-welcome__lede">
								Workspace <strong>{ createdWs?.name }</strong> is ready with
								{ ' ' }{ filledDepartments.length } department{ filledDepartments.length === 1 ? '' : 's' }
								{ ' ' }and{ ' ' }{ teams.filter( ( t ) => t.name.trim() ).length } team{ teams.filter( ( t ) => t.name.trim() ).length === 1 ? '' : 's' }.
							</p>
							<p className="st-todox-welcome__lede">
								Next, create your first project, add a sprint, and start tracking tasks on the Kanban board.
							</p>
						</div>
					) }
				</div>

				{/* Footer */}
				<div className="st-todox-welcome__footer">
					<div className="st-todox-welcome__footer-left">
						{ step !== 'intro' && step !== 'done' && (
							<Button variant="ghost" onClick={ goBack } disabled={ submitting }>
								<ArrowLeft size={ 14 } /> Back
							</Button>
						) }
					</div>
					<div className="st-todox-welcome__footer-right">
						{ step === 'intro' && (
							<Button onClick={ goNext }>
								Get started <ArrowRight size={ 14 } />
							</Button>
						) }
						{ step === 'workspace' && (
							<Button onClick={ goNext } disabled={ ! canGoNext() }>
								Continue <ArrowRight size={ 14 } />
							</Button>
						) }
						{ step === 'departments' && (
							<Button onClick={ goNext }>
								Continue <ArrowRight size={ 14 } />
							</Button>
						) }
						{ step === 'teams' && (
							<Button onClick={ goNext } loading={ submitting }>
								<Rocket size={ 14 } /> Finish setup
							</Button>
						) }
						{ step === 'done' && (
							<Button onClick={ finish }>
								Go to dashboard <ArrowRight size={ 14 } />
							</Button>
						) }
					</div>
				</div>
			</div>
		</div>
	);
};

export default WelcomePage;
