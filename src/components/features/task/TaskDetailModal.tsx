/**
 * External dependencies
 */
import { useEffect } from '@wordpress/element';
import { X } from 'lucide-react';

/**
 * Internal dependencies
 */
import TaskDetail from '../../../pages/tasks/TaskDetail';

interface TaskDetailModalProps {
	taskId: number | null;
	onClose: () => void;
}

const TaskDetailModal = ( { taskId, onClose }: TaskDetailModalProps ) => {
	useEffect( () => {
		if ( ! taskId ) return;
		const handler = ( e: KeyboardEvent ) => {
			if ( e.key === 'Escape' ) onClose();
		};
		document.addEventListener( 'keydown', handler );
		return () => document.removeEventListener( 'keydown', handler );
	}, [ taskId, onClose ] );

	if ( ! taskId ) return null;

	return (
		<div
			className="st-todox-td-modal-overlay"
			onMouseDown={ onClose }
		>
			<div
				className="st-todox-td-modal-container"
				onMouseDown={ ( e ) => e.stopPropagation() }
			>
				<button
					className="st-todox-td-modal-close"
					onClick={ onClose }
					aria-label="Close task"
				>
					<X size={ 15 } />
				</button>
				<div className="st-todox-td-modal-wrap">
					<TaskDetail taskId={ taskId } onClose={ onClose } />
				</div>
			</div>
		</div>
	);
};

export default TaskDetailModal;
