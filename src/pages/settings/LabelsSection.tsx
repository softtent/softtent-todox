/**
 * External dependencies
 */
import { useState, useRef, useEffect } from '@wordpress/element';
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
	Plus, Edit3, Trash2, Check, X, Bookmark, GripVertical, Globe, Lock,
} from 'lucide-react';

/**
 * Internal dependencies
 */
import { taxonomiesApi } from '../../api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Spinner from '../../components/ui/Spinner';
import { ColorPicker, COLORS_TAXONOMY } from '../../components/inputs';
import type { Taxonomy } from '../../types';

type LabelType = 'task_label' | 'subtask_label' | 'project_label';

const TAB_CONFIG: { id: LabelType; label: string }[] = [
	{ id: 'task_label',    label: 'Tasks' },
	{ id: 'subtask_label', label: 'Subtasks' },
	{ id: 'project_label', label: 'Projects' },
];

// ---- Sortable Label Row ----

type EditForm = { name: string; color: string; is_global: boolean };

interface LabelRowProps {
	taxonomy:    Taxonomy;
	editingId:   number | null;
	editForm:    EditForm;
	setEditForm: ( f: EditForm ) => void;
	onEdit:      () => void;
	onDelete:    () => void;
	onSave:      () => void;
	onCancel:    () => void;
	isSaving:    boolean;
}

const SortableLabelRow = ( {
	taxonomy,
	editingId,
	editForm,
	setEditForm,
	onEdit,
	onDelete,
	onSave,
	onCancel,
	isSaving,
}: LabelRowProps ) => {
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
						<ColorPicker colors={ COLORS_TAXONOMY } value={ editForm.color } onChange={ ( c ) => setEditForm( { ...editForm, color: c } ) } />
					</div>
					<div className="st-todox-status-row__scope-row">
						<button
							type="button"
							className={ `st-todox-scope-btn ${ ! editForm.is_global ? 'st-todox-scope-btn--active' : '' }` }
							onClick={ () => setEditForm( { ...editForm, is_global: false } ) }
						>
							<Lock size={ 12 } /> This workspace
						</button>
						<button
							type="button"
							className={ `st-todox-scope-btn ${ editForm.is_global ? 'st-todox-scope-btn--active' : '' }` }
							onClick={ () => setEditForm( { ...editForm, is_global: true } ) }
						>
							<Globe size={ 12 } /> All workspaces
						</button>
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
						className="st-todox-label-badge"
						style={ {
							background: taxonomy.color + '18',
							color:      taxonomy.color,
							border:     `1px solid ${ taxonomy.color }30`,
						} }
					>
						{ taxonomy.name }
					</span>
					<span
						className={ `st-todox-scope-badge ${ taxonomy.is_global ? 'st-todox-scope-badge--global' : 'st-todox-scope-badge--workspace' }` }
						title={ taxonomy.is_global ? 'Visible in all workspaces' : 'This workspace only' }
					>
						{ taxonomy.is_global
							? <><Globe size={ 11 } /> All workspaces</>
							: <><Lock size={ 11 } /> This workspace</>
						}
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

// ---- Inline Add Form ----

interface InlineAddLabelProps {
	activeType:  LabelType;
	workspaceId: number;
	onCreated:   ( taxonomy: Taxonomy ) => void;
}

const InlineAddLabel = ( { activeType, workspaceId, onCreated }: InlineAddLabelProps ) => {
	const [ isAdding, setIsAdding ] = useState( false );
	const [ form, setForm ]         = useState( { name: '', color: COLORS_TAXONOMY[ 0 ] } );
	const [ saving, setSaving ]     = useState( false );
	const inputRef                  = useRef<HTMLInputElement>( null );

	useEffect( () => {
		if ( isAdding ) inputRef.current?.focus();
	}, [ isAdding ] );

	// Reset when the active type tab changes
	useEffect( () => {
		setIsAdding( false );
		setForm( { name: '', color: COLORS_TAXONOMY[ 0 ] } );
	}, [ activeType ] );

	const handleSave = async () => {
		if ( ! form.name.trim() || saving ) return;
		setSaving( true );
		try {
			const created = await taxonomiesApi.create( {
				workspace_id: workspaceId,
				name:         form.name.trim(),
				type:         activeType,
				color:        form.color,
				is_global:    false,
			} );
			onCreated( created );
			setForm( { name: '', color: COLORS_TAXONOMY[ 0 ] } );
			toast.success( 'Label created.' );
			setTimeout( () => inputRef.current?.focus(), 0 );
		} catch {
			toast.error( 'Failed to create label.' );
		} finally {
			setSaving( false );
		}
	};

	const handleCancel = () => {
		setForm( { name: '', color: COLORS_TAXONOMY[ 0 ] } );
		setIsAdding( false );
	};

	if ( ! isAdding ) {
		return (
			<button
				className="st-todox-add-task-row"
				onClick={ () => setIsAdding( true ) }
			>
				<Plus size={ 13 } /> Add label
			</button>
		);
	}

	return (
		<div className="st-todox-status-row__edit st-todox-status-row__edit--inline-add">
			<input
				ref={ inputRef }
				type="text"
				className="st-todox-form__input st-todox-status-row__name-input"
				placeholder="Label name…"
				value={ form.name }
				onChange={ ( e ) => setForm( { ...form, name: e.target.value } ) }
				onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) handleSave(); if ( e.key === 'Escape' ) handleCancel(); } }
				disabled={ saving }
			/>
			<div className="st-todox-status-row__color-row">
				<ColorPicker colors={ COLORS_TAXONOMY } value={ form.color } onChange={ ( c ) => setForm( { ...form, color: c } ) } />
			</div>
			<div className="st-todox-status-row__edit-actions">
				<button
					className="st-todox-status-row__save-btn"
					onClick={ handleSave }
					disabled={ saving || ! form.name.trim() }
					title="Save (Enter)"
				>
					<Check size={ 13 } />
				</button>
				<button
					className="st-todox-status-row__cancel-btn"
					onClick={ handleCancel }
					disabled={ saving }
					title="Cancel (Esc)"
				>
					<X size={ 13 } />
				</button>
			</div>
		</div>
	);
};

// ---- Main Component ----

interface LabelsSectionProps {
	workspaceId: number;
}

const LabelsSection = ( { workspaceId }: LabelsSectionProps ) => {
	const qc = useQueryClient();
	const [ activeTab, setActiveTab ] = useState<LabelType>( 'task_label' );
	const [ editingId, setEditingId ] = useState<number | null>( null );
	const [ editForm, setEditForm ]   = useState<EditForm>( { name: '', color: COLORS_TAXONOMY[ 0 ], is_global: false } );
	const [ deleteId, setDeleteId ]   = useState<number | null>( null );

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 5 } } )
	);

	const queryKey = ( type: LabelType ) => [ 'taxonomies', type, workspaceId ];

	const useLabelQuery = ( type: LabelType ) =>
		useQuery< Taxonomy[] >( {
			queryKey: queryKey( type ),
			queryFn:  () => taxonomiesApi.getAll( workspaceId, type ),
			enabled:  !! workspaceId,
		} );

	const taskQuery    = useLabelQuery( 'task_label' );
	const subtaskQuery = useLabelQuery( 'subtask_label' );
	const projectQuery = useLabelQuery( 'project_label' );

	const queryMap: Record<LabelType, { data: Taxonomy[] | undefined; isLoading: boolean }> = {
		task_label:    { data: taskQuery.data,    isLoading: taskQuery.isLoading },
		subtask_label: { data: subtaskQuery.data, isLoading: subtaskQuery.isLoading },
		project_label: { data: projectQuery.data, isLoading: projectQuery.isLoading },
	};

	const updateMutation = useMutation( {
		mutationFn: ( { id, data }: { id: number; data: EditForm } ) =>
			taxonomiesApi.update( id, { ...data, workspace_id: workspaceId } ),
		onSuccess: ( updated ) => {
			for ( const type of Object.keys( queryMap ) as LabelType[] ) {
				qc.setQueryData< Taxonomy[] >( queryKey( type ), ( prev ) =>
					prev?.map( ( t ) => ( t.id === updated.id ? updated : t ) )
				);
			}
			setEditingId( null );
			toast.success( 'Label updated.' );
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
			for ( const type of Object.keys( queryMap ) as LabelType[] ) {
				qc.setQueryData< Taxonomy[] >( queryKey( type ), ( prev ) =>
					prev?.filter( ( t ) => t.id !== id )
				);
			}
			setDeleteId( null );
			toast.success( 'Label deleted.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const startEdit = ( taxonomy: Taxonomy ) => {
		setEditingId( taxonomy.id );
		setEditForm( {
			name:      taxonomy.name,
			color:     taxonomy.color,
			is_global: taxonomy.is_global,
		} );
	};

	const cancelEdit = () => setEditingId( null );

	const saveEdit = () => {
		if ( editingId === null || ! editForm.name.trim() ) return;
		updateMutation.mutate( { id: editingId, data: editForm } );
	};

	const handleCreated = ( taxonomy: Taxonomy ) => {
		qc.setQueryData< Taxonomy[] >( queryKey( taxonomy.type as LabelType ), ( prev ) =>
			[ ...( prev ?? [] ), taxonomy ]
		);
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

	const { data: labels, isLoading } = queryMap[ activeTab ];

	return (
		<div className="st-todox-settings-stack">
			{/* Header row */}
			<div className="st-todox-statuses-header">
				<div>
					<h2 className="st-todox-settings-card__title">Label Settings</h2>
					<p className="st-todox-settings-card__desc">
						Customize the labels available for tasks, subtasks, and projects.
					</p>
				</div>
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

			{/* Label list */}
			<div className="st-todox-statuses-list">
				{ isLoading ? (
					<div className="st-todox-statuses-list__loading"><Spinner /></div>
				) : (
					<>
						{ labels && labels.length > 0 ? (
							<DndContext
								sensors={ sensors }
								collisionDetection={ closestCenter }
								onDragEnd={ handleDragEnd }
							>
								<SortableContext
									items={ labels.map( ( t ) => t.id ) }
									strategy={ verticalListSortingStrategy }
								>
									{ labels.map( ( taxonomy ) => (
										<SortableLabelRow
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
								<Bookmark size={ 28 } className="st-todox-td-empty__icon" />
								<p className="st-todox-td-empty__title">No labels yet</p>
								<p className="st-todox-td-empty__hint">
									Use the form below to create the first { activeTab.replace( '_label', '' ) } label.
								</p>
							</div>
						) }

						<InlineAddLabel
							key={ activeTab }
							activeType={ activeTab }
							workspaceId={ workspaceId }
							onCreated={ handleCreated }
						/>
					</>
				) }
			</div>

			{/* Delete confirm */}
			<ConfirmDialog
				isOpen={ !! deleteId }
				onClose={ () => setDeleteId( null ) }
				onConfirm={ () => deleteId && deleteMutation.mutate( deleteId ) }
				title="Delete Label"
				message="Are you sure you want to delete this label? Items using it will keep their current value."
				confirmLabel="Delete"
				loading={ deleteMutation.isPending }
			/>
		</div>
	);
};

export default LabelsSection;
