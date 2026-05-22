/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Building2, Briefcase, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react';

/**
 * Internal dependencies
 */
import { departmentsApi, usersApi } from '../../api';
import { useWorkspace } from '../../hooks/useWorkspace';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import type { Department, CreateDepartmentInput } from '../../types';

const COLORS = [ '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6' ];

const emptyForm = (): CreateDepartmentInput => ( {
	workspace_id: 0,
	name:         '',
	description:  '',
	color:        '#6366f1',
	head_id:      null,
} );

const DepartmentsPage = () => {
	const qc = useQueryClient();
	const { activeWorkspaceId, activeWorkspace } = useWorkspace();

	const [ modalOpen, setModalOpen ]       = useState( false );
	const [ editing, setEditing ]           = useState< Department | null >( null );
	const [ deleteTarget, setDeleteTarget ] = useState< Department | null >( null );
	const [ menuOpen, setMenuOpen ]         = useState< number | null >( null );
	const [ form, setForm ]                 = useState< CreateDepartmentInput >( emptyForm() );

	const { data: departments = [], isLoading } = useQuery( {
		queryKey: [ 'departments', activeWorkspaceId ],
		queryFn:  () => departmentsApi.getAll( activeWorkspaceId! ),
		enabled:  !! activeWorkspaceId,
	} );

	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'all' ],
		queryFn:  () => usersApi.getAll( { per_page: 100 } ),
		staleTime: 5 * 60_000,
	} );
	const users = usersData?.items ?? [];

	const invalidate = () => qc.invalidateQueries( { queryKey: [ 'departments', activeWorkspaceId ] } );

	const createMutation = useMutation( {
		mutationFn: ( data: CreateDepartmentInput ) => departmentsApi.create( data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Department created.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: Partial< CreateDepartmentInput > } ) =>
			departmentsApi.update( id, data ),
		onSuccess:  () => { invalidate(); handleClose(); toast.success( 'Department updated.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => departmentsApi.delete( id ),
		onSuccess:  () => { invalidate(); setDeleteTarget( null ); toast.success( 'Department deleted.' ); },
		onError:    ( err: Error ) => toast.error( err.message ),
	} );

	const openCreate = () => {
		setEditing( null );
		setForm( { ...emptyForm(), workspace_id: activeWorkspaceId! } );
		setModalOpen( true );
	};

	const openEdit = ( dept: Department ) => {
		setEditing( dept );
		setForm( {
			workspace_id: dept.workspace_id,
			name:         dept.name,
			description:  dept.description ?? '',
			color:        dept.color,
			head_id:      dept.head_id,
		} );
		setMenuOpen( null );
		setModalOpen( true );
	};

	const handleClose = () => {
		setModalOpen( false );
		setEditing( null );
		setForm( emptyForm() );
	};

	const doSubmit = () => {
		if ( ! form.name.trim() ) { toast.error( 'Name is required.' ); return; }
		if ( editing ) {
			updateMutation.mutate( { id: editing.id, data: form } );
		} else {
			createMutation.mutate( { ...form, workspace_id: activeWorkspaceId! } );
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<div className="st-todox-page">
			{/* Page Header */}
			<div className="st-todox-page-hd">
				<div className="st-todox-page-hd__left">
					<div className="st-todox-page-hd__icon-box">
						<Building2 size={ 20 } />
					</div>
					<div>
						<h1 className="st-todox-page-hd__title">Departments</h1>
						<p className="st-todox-page-hd__sub">
							{ activeWorkspace?.name } · { departments.length } department{ departments.length !== 1 ? 's' : '' }
						</p>
					</div>
				</div>
				{ activeWorkspaceId && (
					<Button onClick={ openCreate }>
						<Plus size={ 14 } /> New Department
					</Button>
				) }
			</div>

			{ isLoading ? (
				<Spinner />
			) : departments.length === 0 ? (
				<div className="st-todox-empty-dashed">
					<Building2 size={ 40 } className="st-todox-empty-dashed__icon" />
					<p className="st-todox-empty-dashed__title">No departments yet</p>
					<p className="st-todox-empty-dashed__desc">Create a department to organise your teams.</p>
					{ activeWorkspaceId && (
						<Button onClick={ openCreate } className="st-todox-empty-dashed__action">New Department</Button>
					) }
				</div>
			) : (
				<div className="st-todox-entity-grid">
					{ departments.map( ( dept: Department ) => (
						<div key={ dept.id } className="st-todox-entity-card" style={ { borderTopColor: dept.color, borderTopWidth: '3px' } }>
							<div className="st-todox-entity-card__body">
								{/* Head row */}
								<div className="st-todox-entity-card__head-row">
									<div className="st-todox-entity-card__avatar" style={ { background: dept.color } }>
										{ dept.name.slice( 0, 1 ).toUpperCase() }
									</div>
									<div className="st-todox-entity-card__meta">
										<h3 className="st-todox-entity-card__name">{ dept.name }</h3>
										{ dept.description && (
											<p className="st-todox-entity-card__desc">{ dept.description }</p>
										) }
									</div>
									{/* Actions menu */}
									<div className="st-todox-entity-card__menu-wrap">
										<button
											className="st-todox-entity-card__menu-btn"
											onClick={ ( e ) => { e.stopPropagation(); setMenuOpen( menuOpen === dept.id ? null : dept.id ); } }
										>
											<MoreHorizontal size={ 15 } />
										</button>
										{ menuOpen === dept.id && (
											<>
												<div className="st-todox-dropdown-backdrop" onClick={ () => setMenuOpen( null ) } />
												<div className="st-todox-entity-card__menu-dropdown">
													<button onClick={ () => openEdit( dept ) }>
														<Pencil size={ 13 } /> Edit
													</button>
													<button
														className="st-todox-entity-card__menu-danger"
														onClick={ () => { setDeleteTarget( dept ); setMenuOpen( null ); } }
													>
														<Trash2 size={ 13 } /> Delete
													</button>
												</div>
											</>
										) }
									</div>
								</div>

								{/* Stats */}
								<div className="st-todox-entity-card__stats">
									<span>
										<Briefcase size={ 13 } />
										<strong>{ dept.teams_count ?? 0 }</strong> team{ ( dept.teams_count ?? 0 ) !== 1 ? 's' : '' }
									</span>
								</div>

								{/* Head user */}
								{ dept.head && (
									<div className="st-todox-entity-card__footer">
										<Avatar name={ dept.head.name } src={ dept.head.avatar } size={ 18 } />
										<span className="st-todox-entity-card__footer-label">{ dept.head.name }</span>
									</div>
								) }
							</div>
						</div>
					) ) }
				</div>
			) }

			{/* Create / Edit Modal */}
			<Modal
				isOpen={ modalOpen }
				onClose={ handleClose }
				title={ editing ? 'Edit Department' : 'New Department' }
				size="sm"
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
						<input
							type="text"
							className="st-todox-form__input"
							placeholder="Department name"
							value={ form.name }
							onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) }
							autoFocus
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Description</label>
						<textarea
							className="st-todox-form__textarea"
							rows={ 2 }
							placeholder="Optional description"
							value={ form.description ?? '' }
							onChange={ ( e ) => setForm( { ...form, description: e.target.value } ) }
						/>
					</div>
					<div className="st-todox-form__group">
						<label className="st-todox-form__label">Head (optional)</label>
						<select
							className="st-todox-form__select"
							value={ form.head_id ?? '' }
							onChange={ ( e ) => setForm( { ...form, head_id: e.target.value ? Number( e.target.value ) : null } ) }
						>
							<option value="">— None —</option>
							{ users.map( ( u ) => (
								<option key={ u.id } value={ u.id }>{ u.name }</option>
							) ) }
						</select>
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

			<ConfirmDialog
				isOpen={ !! deleteTarget }
				onClose={ () => setDeleteTarget( null ) }
				onConfirm={ () => deleteTarget && deleteMutation.mutate( deleteTarget.id ) }
				title="Delete Department"
				message={ `Delete "${ deleteTarget?.name }"? Teams in this department will lose their department link.` }
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
			/>
		</div>
	);
};

export default DepartmentsPage;
