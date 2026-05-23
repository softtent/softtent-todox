/**
 * External dependencies
 */
import { useState, useRef, useEffect, useCallback } from '@wordpress/element';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Plus, Check, X } from 'lucide-react';

/**
 * Internal dependencies
 */
import { tasksApi } from '../../../api';
import { useWorkspace } from '../../../hooks/useWorkspace';

interface Props {
	statusValue: string;
	statusId:    number | null;
	onCreated?:  () => void;
	className?:  string;
}

const InlineTaskInput = ( { statusValue, statusId, onCreated, className = '' }: Props ) => {
	const { activeWorkspaceId } = useWorkspace();
	const qc = useQueryClient();

	const [ isEditing, setIsEditing ] = useState( false );
	const [ title, setTitle ]         = useState( '' );

	const inputRef = useRef<HTMLInputElement>( null );

	useEffect( () => {
		if ( isEditing ) {
			inputRef.current?.focus();
		}
	}, [ isEditing ] );

	const mutation = useMutation( {
		mutationFn: () => tasksApi.create( {
			workspace_id: activeWorkspaceId!,
			title:        title.trim(),
			status:       statusValue,
			status_id:    statusId,
		} ),
		onSuccess: () => {
			qc.invalidateQueries( { queryKey: [ 'tasks' ] } );
			onCreated?.();
			setTitle( '' );
			setTimeout( () => inputRef.current?.focus(), 0 );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const handleSave = useCallback( () => {
		if ( ! title.trim() || mutation.isPending ) return;
		mutation.mutate();
	}, [ title, mutation ] );

	const handleCancel = useCallback( () => {
		setTitle( '' );
		setIsEditing( false );
	}, [] );

	const handleKeyDown = useCallback( ( e: React.KeyboardEvent<HTMLInputElement> ) => {
		if ( e.key === 'Enter' ) {
			e.preventDefault();
			handleSave();
		} else if ( e.key === 'Escape' ) {
			handleCancel();
		}
	}, [ handleSave, handleCancel ] );

	if ( isEditing ) {
		return (
			<div className={ `st-todox-inline-task-input ${ className }` }>
				<input
					ref={ inputRef }
					type="text"
					className="st-todox-inline-task-input__field"
					placeholder="Task name…"
					value={ title }
					onChange={ ( e ) => setTitle( e.target.value ) }
					onKeyDown={ handleKeyDown }
					disabled={ mutation.isPending }
				/>
				<button
					className="st-todox-inline-task-input__btn st-todox-inline-task-input__btn--save"
					onClick={ handleSave }
					disabled={ ! title.trim() || mutation.isPending }
					title="Save task (Enter)"
				>
					<Check size={ 13 } />
				</button>
				<button
					className="st-todox-inline-task-input__btn st-todox-inline-task-input__btn--cancel"
					onClick={ handleCancel }
					disabled={ mutation.isPending }
					title="Cancel (Esc)"
				>
					<X size={ 13 } />
				</button>
			</div>
		);
	}

	return (
		<button
			className={ `st-todox-add-task-row ${ className }` }
			onClick={ () => setIsEditing( true ) }
		>
			<Plus size={ 13 } />
			Add task
		</button>
	);
};

export default InlineTaskInput;
