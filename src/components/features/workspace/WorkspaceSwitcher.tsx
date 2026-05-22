/**
 * External dependencies
 */
import { useState, useRef } from '@wordpress/element';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { ChevronDown, Plus, Settings, Check } from 'lucide-react';

/**
 * Internal dependencies
 */
import { useWorkspace } from '../../../hooks/useWorkspace';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { workspacesApi } from '../../../api';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import type { Workspace, CreateWorkspaceInput } from '../../../types';

interface Props {
	collapsed?: boolean;
}

const COLORS = [ '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6' ];

const WorkspaceSwitcher = ( { collapsed = false }: Props ) => {
	const navigate   = useNavigate();
	const qc         = useQueryClient();
	const ref        = useRef< HTMLDivElement >( null );
	const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();

	const [ open, setOpen ]           = useState( false );
	const [ createOpen, setCreateOpen ] = useState( false );
	const [ form, setForm ]           = useState< CreateWorkspaceInput >( { name: '', color: '#6366f1' } );

	useClickOutside( ref, () => setOpen( false ) );

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

	const handleSelect = ( ws: Workspace ) => {
		switchWorkspace( ws );
		setOpen( false );
	};

	const handleCreate = ( e: React.FormEvent ) => {
		e.preventDefault();
		if ( ! form.name.trim() ) return;
		createMutation.mutate( form );
	};

	const initials = ( name: string ) => name.slice( 0, 2 ).toUpperCase();
	const bgColor  = activeWorkspace?.color ?? '#6366f1';

	if ( collapsed ) {
		return (
			<div ref={ ref } className="st-todox-ws-switcher st-todox-ws-switcher--collapsed">
				<button
					className="st-todox-ws-switcher__avatar-btn"
					onClick={ () => setOpen( ! open ) }
					title={ activeWorkspace?.name ?? 'Select workspace' }
					style={ { background: bgColor, boxShadow: `0 4px 12px ${ bgColor }55` } }
				>
					{ activeWorkspace ? initials( activeWorkspace.name ) : '+' }
				</button>

				{ open && (
					<div className="st-todox-ws-switcher__dropdown st-todox-ws-switcher__dropdown--left">
						<WorkspaceList
							workspaces={ workspaces }
							active={ activeWorkspace }
							onSelect={ handleSelect }
							onCreate={ () => { setCreateOpen( true ); setOpen( false ); } }
							onManage={ () => { navigate( '/workspaces' ); setOpen( false ); } }
						/>
					</div>
				) }

				<CreateModal
					open={ createOpen }
					form={ form }
					setForm={ setForm }
					onSubmit={ handleCreate }
					onClose={ () => setCreateOpen( false ) }
					loading={ createMutation.isPending }
					colors={ COLORS }
				/>
			</div>
		);
	}

	return (
		<div ref={ ref } className="st-todox-ws-switcher">
			<button
				className="st-todox-ws-switcher__trigger"
				onClick={ () => setOpen( ! open ) }
			>
				<div
					className="st-todox-ws-switcher__ws-avatar"
					style={ { background: bgColor, boxShadow: `0 4px 10px ${ bgColor }44` } }
				>
					{ activeWorkspace ? initials( activeWorkspace.name ) : '?' }
				</div>
				{ activeWorkspace ? (
					<div className="st-todox-ws-switcher__ws-info">
						<span className="st-todox-ws-switcher__ws-name">{ activeWorkspace.name }</span>
						<span className="st-todox-ws-switcher__ws-sub">{ ( activeWorkspace.members_count ?? 0 ) } member{ ( activeWorkspace.members_count ?? 0 ) !== 1 ? 's' : '' }</span>
					</div>
				) : (
					<span className="st-todox-ws-switcher__placeholder">Select workspace</span>
				) }
				<ChevronDown size={ 13 } className={ `st-todox-ws-switcher__chevron ${ open ? 'st-todox-ws-switcher__chevron--open' : '' }` } />
			</button>

			{ open && (
				<div className="st-todox-ws-switcher__dropdown">
					<WorkspaceList
						workspaces={ workspaces }
						active={ activeWorkspace }
						onSelect={ handleSelect }
						onCreate={ () => { setCreateOpen( true ); setOpen( false ); } }
						onManage={ () => { navigate( '/workspaces' ); setOpen( false ); } }
					/>
				</div>
			) }

			<CreateModal
				open={ createOpen }
				form={ form }
				setForm={ setForm }
				onSubmit={ handleCreate }
				onClose={ () => setCreateOpen( false ) }
				loading={ createMutation.isPending }
				colors={ COLORS }
			/>
		</div>
	);
};

/* ---- Sub-components ---- */

interface ListProps {
	workspaces: Workspace[];
	active: Workspace | null;
	onSelect: ( ws: Workspace ) => void;
	onCreate: () => void;
	onManage: () => void;
}

const WorkspaceList = ( { workspaces, active, onSelect, onCreate, onManage }: ListProps ) => (
	<>
		<div className="st-todox-ws-switcher__list">
			{ workspaces.length === 0 && (
				<p className="st-todox-ws-switcher__empty">No workspaces yet</p>
			) }
			{ workspaces.map( ( ws ) => (
				<button
					key={ ws.id }
					className={ `st-todox-ws-switcher__item ${ ws.id === active?.id ? 'st-todox-ws-switcher__item--active' : '' }` }
					onClick={ () => onSelect( ws ) }
				>
					<div
						className="st-todox-ws-switcher__item-avatar"
						style={ { background: ws.color } }
					>
						{ ws.name.slice( 0, 2 ).toUpperCase() }
					</div>
					<div className="st-todox-ws-switcher__item-info">
						<span className="st-todox-ws-switcher__item-name">{ ws.name }</span>
					</div>
					{ ws.id === active?.id && (
						<Check size={ 13 } className="st-todox-ws-switcher__item-check" />
					) }
				</button>
			) ) }
		</div>
		<div className="st-todox-ws-switcher__footer">
			<button className="st-todox-ws-switcher__footer-btn" onClick={ onCreate }>
				<Plus size={ 13 } /> New workspace
			</button>
			<button className="st-todox-ws-switcher__footer-btn" onClick={ onManage }>
				<Settings size={ 13 } /> Manage workspaces
			</button>
		</div>
	</>
);

interface CreateModalProps {
	open: boolean;
	form: CreateWorkspaceInput;
	setForm: ( f: CreateWorkspaceInput ) => void;
	onSubmit: ( e: React.FormEvent ) => void;
	onClose: () => void;
	loading: boolean;
	colors: string[];
}

const CreateModal = ( { open, form, setForm, onSubmit, onClose, loading, colors }: CreateModalProps ) => (
	<Modal
		isOpen={ open }
		onClose={ onClose }
		title="New Workspace"
		size="sm"
		footer={
			<>
				<Button variant="secondary" onClick={ onClose } disabled={ loading }>Cancel</Button>
				<Button onClick={ onSubmit as unknown as React.MouseEventHandler } loading={ loading }>Create</Button>
			</>
		}
	>
		<form onSubmit={ onSubmit } className="st-todox-form">
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
				<label className="st-todox-form__label">Color</label>
				<div className="st-todox-color-picker">
					{ colors.map( ( c ) => (
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
);

export default WorkspaceSwitcher;
