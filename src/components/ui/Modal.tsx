/**
 * External dependencies
 */
import { useEffect, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { cn } from '../../utils/helpers';
import Button from './Button';

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	size?: 'sm' | 'md' | 'lg';
}

const Modal = ( { isOpen, onClose, title, children, footer, size = 'md' }: ModalProps ) => {
	const overlayRef = useRef< HTMLDivElement >( null );

	useEffect( () => {
		if ( ! isOpen ) return;

		const handleKeyDown = ( e: KeyboardEvent ) => {
			if ( e.key === 'Escape' ) onClose();
		};

		document.addEventListener( 'keydown', handleKeyDown );

		return () => document.removeEventListener( 'keydown', handleKeyDown );
	}, [ isOpen, onClose ] );

	if ( ! isOpen ) return null;

	return (
		<div
			ref={ overlayRef }
			className="st-todox-modal-overlay"
			onMouseDown={ () => onClose() }
		>
			<div
				className={ cn( 'st-todox-modal', `st-todox-modal--${ size }` ) }
				role="dialog"
				aria-modal="true"
				aria-labelledby="st-todox-modal-title"
				onMouseDown={ ( e ) => e.stopPropagation() }
			>
				{/* Header */}
				<div className="st-todox-modal__header">
					<h2 id="st-todox-modal-title" className="st-todox-modal__title">
						{ title }
					</h2>
					<button
						onClick={ onClose }
						className="st-todox-modal__close"
						aria-label="Close"
					>
						✕
					</button>
				</div>

				{/* Body */}
				<div className="st-todox-modal__body">{ children }</div>

				{/* Footer */}
				{ footer && (
					<div className="st-todox-modal__footer">{ footer }</div>
				) }
			</div>
		</div>
	);
};

export default Modal;
