/**
 * External dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

/**
 * Internal dependencies
 */
import { subtasksApi, usersApi } from '../../../api';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import type { Subtask, SubtaskStatus, TaskPriority, CreateSubtaskInput } from '../../../types';

interface SubtaskModalProps {
	isOpen:    boolean;
	onClose:   () => void;
	taskId:    number;
	subtask?:  Subtask;
	onSaved?:  () => void;
}

const STATUSES: { value: SubtaskStatus; label: string }[] = [
	{ value: 'todo',        label: 'To Do' },
	{ value: 'in_progress', label: 'In Progress' },
	{ value: 'done',        label: 'Done' },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
	{ value: 'low',    label: 'Low' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'high',   label: 'High' },
	{ value: 'urgent', label: 'Urgent' },
];

const emptyForm = (): CreateSubtaskInput => ( {
	title:       '',
	description: '',
	status:      'todo',
	priority:    'medium',
	due_date:    null,
	assignee_id: null,
} );

const SubtaskModal = ( { isOpen, onClose, taskId, subtask, onSaved }: SubtaskModalProps ) => {
	const qc      = useQueryClient();
	const isEdit  = !! subtask;
	const [ form, setForm ] = useState<CreateSubtaskInput>( emptyForm() );

	useEffect( () => {
		if ( isOpen ) {
			setForm( subtask ? {
				title:       subtask.title,
				description: subtask.description ?? '',
				status:      subtask.status,
				priority:    subtask.priority,
				due_date:    subtask.due_date ?? null,
				assignee_id: subtask.assignee_id ?? null,
			} : emptyForm() );
		}
	}, [ isOpen, subtask ] );

	const { data: usersData } = useQuery( {
		queryKey: [ 'users', 'all' ],
		queryFn:  () => usersApi.getAll( { per_page: 100 } ),
		enabled:  isOpen,
		staleTime: 5 * 60_000,
	} );
	const users = usersData?.items ?? [];

	const mutateFn = isEdit
		? ( data: CreateSubtaskInput ) => subtasksApi.update( taskId, subtask!.id, data )
		: ( data: CreateSubtaskInput ) => subtasksApi.create( taskId, data );

	const mutation = useMutation( {
		mutationFn: mutateFn,
		onSuccess: () => {
			qc.invalidateQueries( { queryKey: [ 'tasks', taskId ] } );
			toast.success( isEdit ? 'Subtask updated.' : 'Subtask created.' );
			onSaved?.();
			handleClose();
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const handleClose = () => {
		setForm( emptyForm() );
		onClose();
	};

	const doSubmit = () => {
		if ( ! form.title?.trim() ) {
			toast.error( 'Title is required.' );
			return;
		}
		mutation.mutate( { ...form, title: form.title.trim() } );
	};

	const set = ( key: keyof CreateSubtaskInput, value: unknown ) =>
		setForm( ( prev ) => ( { ...prev, [ key ]: value } ) );

	return (
		<Modal
			isOpen={ isOpen }
			onClose={ handleClose }
			title={ isEdit ? 'Edit Subtask' : 'Add Subtask' }
			size="sm"
			footer={
				<>
					<Button variant="secondary" onClick={ handleClose } disabled={ mutation.isPending }>
						Cancel
					</Button>
					<Button
						onClick={ doSubmit }
						loading={ mutation.isPending }
					>
						{ isEdit ? 'Save' : 'Add Subtask' }
					</Button>
				</>
			}
		>
			<form onSubmit={ ( e ) => { e.preventDefault(); doSubmit(); } } className="st-todox-form">
				{/* Title */}
				<div className="st-todox-form__group">
					<label className="st-todox-form__label">
						Title <span className="st-todox-form__required">*</span>
					</label>
					<input
						type="text"
						className="st-todox-form__input"
						placeholder="Subtask title…"
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
						rows={ 2 }
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
							value={ form.status }
							onChange={ ( e ) => set( 'status', e.target.value as SubtaskStatus ) }
						>
							{ STATUSES.map( ( s ) => (
								<option key={ s.value } value={ s.value }>{ s.label }</option>
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

				{/* Assignee + Due Date */}
				<div className="st-todox-form__row">
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
			</form>
		</Modal>
	);
};

export default SubtaskModal;
