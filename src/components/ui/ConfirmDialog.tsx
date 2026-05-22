import Modal from './Modal';
import Button from './Button';

interface ConfirmDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title?: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	loading?: boolean;
	variant?: 'danger' | 'primary';
}

const ConfirmDialog = ( {
	isOpen,
	onClose,
	onConfirm,
	title = 'Are you sure?',
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	loading = false,
	variant = 'danger',
}: ConfirmDialogProps ) => {
	return (
		<Modal
			isOpen={ isOpen }
			onClose={ onClose }
			title={ title }
			size="sm"
			footer={
				<>
					<Button variant="secondary" onClick={ onClose } disabled={ loading }>
						{ cancelLabel }
					</Button>
					<Button variant={ variant } onClick={ onConfirm } loading={ loading }>
						{ confirmLabel }
					</Button>
				</>
			}
		>
			<p className="st-todox-confirm__message">{ message }</p>
		</Modal>
	);
};

export default ConfirmDialog;
