/**
 * External dependencies
 */
import { useEffect } from '@wordpress/element';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * Internal dependencies
 */
import Button from './Button';

interface ConfirmDialogProps {
	isOpen:         boolean;
	onClose:        () => void;
	onConfirm:      () => void;
	title?:         string;
	message:        string;
	confirmLabel?:  string;
	cancelLabel?:   string;
	loading?:       boolean;
	variant?:       'danger' | 'primary';
}

const ConfirmDialog = ( {
	isOpen,
	onClose,
	onConfirm,
	title        = 'Are you sure?',
	message,
	confirmLabel = 'Confirm',
	cancelLabel  = 'Cancel',
	loading      = false,
	variant      = 'danger',
}: ConfirmDialogProps ) => {
	useEffect( () => {
		if ( ! isOpen ) return;
		const onKey = ( e: KeyboardEvent ) => { if ( e.key === 'Escape' ) onClose(); };
		document.addEventListener( 'keydown', onKey );
		return () => document.removeEventListener( 'keydown', onKey );
	}, [ isOpen, onClose ] );

	if ( ! isOpen ) return null;

	return (
		<div
			className="st-todox-modal-overlay"
			onMouseDown={ onClose }
		>
			<div
				className={ `st-todox-confirm st-todox-confirm--${ variant }` }
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="st-todox-confirm-title"
				onMouseDown={ ( e ) => e.stopPropagation() }
			>
				<div className={ `st-todox-confirm__icon st-todox-confirm__icon--${ variant }` }>
					{ variant === 'danger'
						? <AlertTriangle size={ 24 } strokeWidth={ 2 } />
						: <Info size={ 24 } strokeWidth={ 2 } /> }
				</div>

				<h3 id="st-todox-confirm-title" className="st-todox-confirm__title">
					{ title }
				</h3>

				<p className="st-todox-confirm__message">{ message }</p>

				<div className="st-todox-confirm__actions">
					<Button variant="secondary" onClick={ onClose } disabled={ loading }>
						{ cancelLabel }
					</Button>
					<Button variant={ variant } onClick={ onConfirm } loading={ loading }>
						{ confirmLabel }
					</Button>
				</div>
			</div>
		</div>
	);
};

export default ConfirmDialog;
