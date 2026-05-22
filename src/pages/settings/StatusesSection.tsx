/**
 * External dependencies
 */
import { useState } from '@wordpress/element';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
	DndContext,
	DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
	closestCenter,
} from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	Plus, Edit3, Trash2, Check, X, Tag, GripVertical,
	CircleDashed,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { taxonomiesApi } from '../../api';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Spinner from '../../components/ui/Spinner';
import type { Taxonomy } from '../../types';

// ---- Constants ----

const COLOR_OPTIONS = [
	'#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
	'#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
	'#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
	'#0ea5e9', '#3b82f6', '#64748b',
];

const ICON_OPTIONS: { name: string; symbol: string }[] = [
	{ name: 'circle',  symbol: '○' },
	{ name: 'half',    symbol: '◐' },
	{ name: 'dot',     symbol: '◉' },
	{ name: 'check',   symbol: '✓' },
	{ name: 'pause',   symbol: '⏸' },
];

type StatusType = 'task_status' | 'subtask_status' | 'sprint_status' | 'project_status';

const TAB_CONFIG: { id: StatusType; label: string }[] = [
	{ id: 'task_status',    label: 'Tasks' },
	{ id: 'subtask_status', label: 'Subtasks' },
	{ id: 'sprint_status',  label: 'Sprints' },
	{ id: 'project_status', label: 'Projects' },
];

// ---- Helpers ----

const getSymbol = ( icon: string | null ) =>
	ICON_OPTIONS.find( ( i ) => i.name === icon )?.symbol ?? '○';

// ---- Sortable Status Row ----

interface StatusRowProps {
	taxonomy:    Taxonomy;
	editingId:   number | null;
	editForm:    { name: string; color: string; icon: string };
	setEditForm: ( f: { name: string; color: string; icon: string } ) => void;
	onEdit:      () => void;
	onDelete:    () => void;
	onSave:      () => void;
	onCancel:    () => void;
	isSaving:    boolean;
}

const SortableStatusRow = ( {
	taxonomy,
	editingId,
	editForm,
	setEditForm,
	onEdit,
	onDelete,
	onSave,
	onCancel,
	isSaving,
}: StatusRowProps ) => {
	const isEditing = editingId === taxonomy.id;

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: taxonomy.id, disabled: isEditing } );

	const style: React.CSSProperties = {
		transform:  CSS.Transform.toString( transform ),
		transition,
		opacity:    isDragging ? 0.45 : 1,
		zIndex:     isDragging ? 10 : undefined,
	};

	return (
		<div ref={ setNodeRef } style={ style } className={ `st-todox-status-row ${ isDragging ? 'st-todox-status-row--dragging' : '' }` }>
			{ isEditing ? (
				<div className="st-todox-status-row__edit">
					<input
						type="text"
						className="st-todox-form__input st-todox-status-row__name-input"
						value={ editForm.name }
						onChange={ ( e ) => setEditForm( { ...editForm, name: e.target.value } ) }
						autoFocus
						onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) onSave(); if ( e.key === 'Escape' ) onCancel(); } }
					/>
					<div className="st-todox-status-row__color-row">
						{ COLOR_OPTIONS.map( ( c ) => (
							<button
								key={ c }
								type="button"
								className={ `st-todox-color-swatch ${ editForm.color === c ? 'st-todox-color-swatch--selected' : '' }` }
								style={ { background: c } }
								onClick={ () => setEditForm( { ...editForm, color: c } ) }
							/>
						) ) }
					</div>
					<div className="st-todox-status-row__icon-row">
						{ ICON_OPTIONS.map( ( icon ) => (
							<button
								key={ icon.name }
								type="button"
								className={ `st-todox-icon-btn ${ editForm.icon === icon.name ? 'st-todox-icon-btn--selected' : '' }` }
								onClick={ () => setEditForm( { ...editForm, icon: icon.name } ) }
							>
								{ icon.symbol }
							</button>
						) ) }
					</div>
					<div className="st-todox-status-row__edit-actions">
						<button
							className="st-todox-status-row__save-btn"
							onClick={ onSave }
							disabled={ isSaving || ! editForm.name.trim() }
							title="Save"
						>
							<Check size={ 13 } />
						</button>
						<button className="st-todox-status-row__cancel-btn" onClick={ onCancel } title="Cancel">
							<X size={ 13 } />
						</button>
					</div>
				</div>
			) : (
				<>
					<span
						className="st-todox-status-row__drag-handle"
						{ ...attributes }
						{ ...listeners }
						title="Drag to reorder"
					>
						<GripVertical size={ 14 } />
					</span>
					<span
						className="st-todox-status-badge"
						style={ {
							background: taxonomy.color + '18',
							color:      taxonomy.color,
							border:     `1px solid ${ taxonomy.color }30`,
						} }
					>
						<span style={ { color: taxonomy.color } }>{ getSymbol( taxonomy.icon ) }</span>
						{ taxonomy.name }
					</span>
					<div className="st-todox-status-row__hover-actions">
						<button className="st-todox-status-row__edit-btn" onClick={ onEdit } title="Edit">
							<Edit3 size={ 13 } />
						</button>
						<button className="st-todox-status-row__del-btn" onClick={ onDelete } title="Delete">
							<Trash2 size={ 13 } />
						</button>
					</div>
				</>
			) }
		</div>
	);
};

// ---- Add Status Modal ----

interface AddModalProps {
	open:        boolean;
	defaultType: StatusType;
	workspaceId: number;
	onClose:     () => void;
	onCreated:   ( taxonomy: Taxonomy ) => void;
}

const AddModal = ( { open, defaultType, workspaceId, onClose, onCreated }: AddModalProps ) => {
	const [ form, setForm ] = useState( {
		name:  '',
		color: COLOR_OPTIONS[ 0 ],
		icon:  ICON_OPTIONS[ 0 ].name,
		type:  defaultType,
	} );
	const [ saving, setSaving ] = useState( false );

	const handleCreate = async () => {
		if ( ! form.name.trim() ) return;
		setSaving( true );
		try {
			const created = await taxonomiesApi.create( {
				workspace_id: workspaceId,
				name:  form.name.trim(),
				type:  form.type,
				color: form.color,
				icon:  form.icon,
			} );
			onCreated( created );
			setForm( { name: '', color: COLOR_OPTIONS[ 0 ], icon: ICON_OPTIONS[ 0 ].name, type: form.type } );
			toast.success( 'Status created.' );
		} catch {
			toast.error( 'Failed to create status.' );
		} finally {
			setSaving( false );
		}
	};

	if ( ! open ) return null;

	return (
		<div className="st-todox-td-edit-overlay">
			<div className="st-todox-status-modal">
				<div className="st-todox-status-modal__head">
					<h2>Add Status</h2>
					<button className="st-todox-td-edit-modal__close" onClick={ onClose }><X size={ 15 } /></button>
				</div>
				<div className="st-todox-status-modal__body">
					{/* Type tabs */}
					<div className="st-todox-status-modal__type-tabs">
						{ TAB_CONFIG.map( ( t ) => (
							<button
								key={ t.id }
								type="button"
								className={ `st-todox-status-modal__type-btn ${ form.type === t.id ? 'st-todox-status-modal__type-btn--active' : '' }` }
								onClick={ () => setForm( { ...form, type: t.id } ) }
							>
								{ t.label }
							</button>
						) ) }
					</div>

					{/* Name */}
					<div className="st-todox-settings-field">
						<label className="st-todox-settings-field__label">Name <span className="st-todox-req">*</span></label>
						<input
							type="text"
							className="st-todox-form__input"
							placeholder="e.g., In Review, Blocked, QA"
							value={ form.name }
							onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) }
							onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) handleCreate(); } }
							autoFocus
						/>
					</div>

					{/* Color */}
					<div className="st-todox-settings-field">
						<label className="st-todox-settings-field__label">Color</label>
						<div className="st-todox-color-grid">
							{ COLOR_OPTIONS.map( ( c ) => (
								<button
									key={ c }
									type="button"
									className={ `st-todox-color-swatch st-todox-color-swatch--lg ${ form.color === c ? 'st-todox-color-swatch--selected' : '' }` }
									style={ { background: c } }
									onClick={ () => setForm( { ...form, color: c } ) }
								/>
							) ) }
						</div>
					</div>

					{/* Icon */}
					<div className="st-todox-settings-field">
						<label className="st-todox-settings-field__label">Icon</label>
						<div className="st-todox-icon-row">
							{ ICON_OPTIONS.map( ( icon ) => (
								<button
									key={ icon.name }
									type="button"
									className={ `st-todox-icon-btn st-todox-icon-btn--lg ${ form.icon === icon.name ? 'st-todox-icon-btn--selected' : '' }` }
									onClick={ () => setForm( { ...form, icon: icon.name } ) }
								>
									{ icon.symbol }
								</button>
							) ) }
						</div>
					</div>

					{/* Preview */}
					{ form.name.trim() && (
						<div className="st-todox-status-modal__preview">
							<span className="st-todox-settings-field__label">Preview</span>
							<span
								className="st-todox-status-badge"
								style={ {
									background: form.color + '18',
									color:      form.color,
									border:     `1px solid ${ form.color }30`,
								} }
							>
								<span>{ getSymbol( form.icon ) }</span>
								{ form.name }
							</span>
						</div>
					) }
				</div>
				<div className="st-todox-status-modal__footer">
					<Button variant="secondary" onClick={ onClose }>Cancel</Button>
					<Button
						onClick={ handleCreate }
						loading={ saving }
						disabled={ ! form.name.trim() }
					>
						Create Status
					</Button>
				</div>
			</div>
		</div>
	);
};

// ---- Main Component ----

interface StatusesSectionProps {
	workspaceId: number;
}

const StatusesSection = ( { workspaceId }: StatusesSectionProps ) => {
	const qc = useQueryClient();
	const [ activeTab, setActiveTab ] = useState<StatusType>( 'task_status' );
	const [ editingId, setEditingId ] = useState<number | null>( null );
	const [ editForm, setEditForm ]   = useState( { name: '', color: COLOR_OPTIONS[ 0 ], icon: ICON_OPTIONS[ 0 ].name } );
	const [ addOpen, setAddOpen ]     = useState( false );
	const [ deleteId, setDeleteId ]   = useState<number | null>( null );

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 5 } } )
	);

	const queryKey = ( type: StatusType ) => [ 'taxonomies', type, workspaceId ];

	const useStatusQuery = ( type: StatusType ) =>
		useQuery< Taxonomy[] >( {
			queryKey: queryKey( type ),
			queryFn:  () => taxonomiesApi.getAll( workspaceId, type ),
			enabled:  !! workspaceId,
		} );

	const taskQuery    = useStatusQuery( 'task_status' );
	const subtaskQuery = useStatusQuery( 'subtask_status' );
	const sprintQuery  = useStatusQuery( 'sprint_status' );
	const projectQuery = useStatusQuery( 'project_status' );

	const queryMap: Record<StatusType, { data: Taxonomy[] | undefined; isLoading: boolean }> = {
		task_status:    { data: taskQuery.data,    isLoading: taskQuery.isLoading },
		subtask_status: { data: subtaskQuery.data, isLoading: subtaskQuery.isLoading },
		sprint_status:  { data: sprintQuery.data,  isLoading: sprintQuery.isLoading },
		project_status: { data: projectQuery.data, isLoading: projectQuery.isLoading },
	};

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: { name: string; color: string; icon: string } } ) =>
			taxonomiesApi.update( id, data ),
		onSuccess: ( updated ) => {
			for ( const type of Object.keys( queryMap ) as StatusType[] ) {
				qc.setQueryData< Taxonomy[] >( queryKey( type ), ( prev ) =>
					prev?.map( ( t ) => ( t.id === updated.id ? updated : t ) )
				);
			}
			setEditingId( null );
			toast.success( 'Status updated.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const reorderMutation = useMutation( {
		mutationFn: ( items: { id: number; position: number }[] ) =>
			taxonomiesApi.reorder( items ),
		onError: ( err: Error ) => {
			toast.error( err.message );
			qc.invalidateQueries( { queryKey: queryKey( activeTab ) } );
		},
	} );

	const deleteMutation = useMutation( {
		mutationFn: ( id: number ) => taxonomiesApi.delete( id ),
		onSuccess: ( _, id ) => {
			for ( const type of Object.keys( queryMap ) as StatusType[] ) {
				qc.setQueryData< Taxonomy[] >( queryKey( type ), ( prev ) =>
					prev?.filter( ( t ) => t.id !== id )
				);
			}
			setDeleteId( null );
			toast.success( 'Status deleted.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const startEdit = ( taxonomy: Taxonomy ) => {
		setEditingId( taxonomy.id );
		setEditForm( {
			name:  taxonomy.name,
			color: taxonomy.color,
			icon:  taxonomy.icon ?? ICON_OPTIONS[ 0 ].name,
		} );
	};

	const cancelEdit = () => setEditingId( null );

	const saveEdit = () => {
		if ( editingId === null || ! editForm.name.trim() ) return;
		updateMutation.mutate( { id: editingId, data: editForm } );
	};

	const handleCreated = ( taxonomy: Taxonomy ) => {
		qc.setQueryData< Taxonomy[] >( queryKey( taxonomy.type as StatusType ), ( prev ) =>
			[ ...( prev ?? [] ), taxonomy ]
		);
		setAddOpen( false );
	};

	const handleDragEnd = ( event: DragEndEvent ) => {
		const { active, over } = event;
		if ( ! over || active.id === over.id ) return;

		const current = queryMap[ activeTab ].data ?? [];
		const oldIndex = current.findIndex( ( t ) => t.id === active.id );
		const newIndex = current.findIndex( ( t ) => t.id === over.id );
		if ( oldIndex === -1 || newIndex === -1 ) return;

		const reordered = arrayMove( current, oldIndex, newIndex );

		// Optimistic update
		qc.setQueryData< Taxonomy[] >( queryKey( activeTab ), reordered );

		// Persist new positions
		reorderMutation.mutate(
			reordered.map( ( t, idx ) => ( { id: t.id, position: idx } ) )
		);
	};

	const { data: statuses, isLoading } = queryMap[ activeTab ];

	return (
		<div className="st-todox-settings-stack">
			{/* Header row */}
			<div className="st-todox-statuses-header">
				<div>
					<h2 className="st-todox-settings-card__title">Status Settings</h2>
					<p className="st-todox-settings-card__desc">
						Customize the statuses available for tasks, subtasks, sprints, and projects.
					</p>
				</div>
				<Button size="sm" onClick={ () => setAddOpen( true ) }>
					<Plus size={ 13 } /> Add Status
				</Button>
			</div>

			{/* Tab bar */}
			<div className="st-todox-statuses-tabs">
				{ TAB_CONFIG.map( ( tab ) => (
					<button
						key={ tab.id }
						className={ `st-todox-statuses-tabs__btn ${ activeTab === tab.id ? 'st-todox-statuses-tabs__btn--active' : '' }` }
						onClick={ () => { setActiveTab( tab.id ); setEditingId( null ); } }
					>
						{ tab.label }
						{ queryMap[ tab.id ].data && (
							<span className="st-todox-statuses-tabs__count">
								{ queryMap[ tab.id ].data!.length }
							</span>
						) }
					</button>
				) ) }
			</div>

			{/* Status list */}
			<div className="st-todox-statuses-list">
				{ isLoading ? (
					<div className="st-todox-statuses-list__loading"><Spinner /></div>
				) : statuses && statuses.length > 0 ? (
					<DndContext
						sensors={ sensors }
						collisionDetection={ closestCenter }
						onDragEnd={ handleDragEnd }
					>
						<SortableContext
							items={ statuses.map( ( t ) => t.id ) }
							strategy={ verticalListSortingStrategy }
						>
							{ statuses.map( ( taxonomy ) => (
								<SortableStatusRow
									key={ taxonomy.id }
									taxonomy={ taxonomy }
									editingId={ editingId }
									editForm={ editForm }
									setEditForm={ setEditForm }
									onEdit={ () => startEdit( taxonomy ) }
									onDelete={ () => setDeleteId( taxonomy.id ) }
									onSave={ saveEdit }
									onCancel={ cancelEdit }
									isSaving={ updateMutation.isPending }
								/>
							) ) }
						</SortableContext>
					</DndContext>
				) : (
					<div className="st-todox-td-empty">
						<Tag size={ 28 } className="st-todox-td-empty__icon" />
						<p className="st-todox-td-empty__title">No statuses yet</p>
						<p className="st-todox-td-empty__hint">
							Click "Add Status" to create the first { activeTab.replace( '_status', '' ) } status.
						</p>
					</div>
				) }
			</div>

			{/* Add modal */}
			<AddModal
				open={ addOpen }
				defaultType={ activeTab }
				workspaceId={ workspaceId }
				onClose={ () => setAddOpen( false ) }
				onCreated={ handleCreated }
			/>

			{/* Delete confirm */}
			<ConfirmDialog
				isOpen={ !! deleteId }
				onClose={ () => setDeleteId( null ) }
				onConfirm={ () => deleteId && deleteMutation.mutate( deleteId ) }
				title="Delete Status"
				message="Are you sure you want to delete this status? Tasks using it will keep their current value."
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
			/>
		</div>
	);
};

export default StatusesSection;
