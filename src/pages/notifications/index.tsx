/**
 * External dependencies
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

/**
 * Internal dependencies
 */
import { notificationsApi } from '../../api';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { formatRelativeTime } from '../../utils/helpers';
import type { Notification, NotificationType } from '../../types';

const TYPE_ICONS: Record<NotificationType, string> = {
	info:    'ℹ',
	success: '✓',
	warning: '⚠',
	error:   '✕',
	task:    '✓',
	mention: '@',
};

const NotificationsPage = () => {
	const navigate = useNavigate();
	const qc       = useQueryClient();

	const { data: notifications = [], isLoading } = useQuery< Notification[] >( {
		queryKey: [ 'notifications' ],
		queryFn: () => notificationsApi.getAll(),
	} );

	const markReadMutation = useMutation( {
		mutationFn: ( id: number ) => notificationsApi.markRead( id ),
		onSuccess: () => {
			qc.invalidateQueries( { queryKey: [ 'notifications' ] } );
			qc.invalidateQueries( { queryKey: [ 'notifications', 'unread-count' ] } );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const markAllMutation = useMutation( {
		mutationFn: () => notificationsApi.markAllRead(),
		onSuccess: () => {
			qc.invalidateQueries( { queryKey: [ 'notifications' ] } );
			qc.invalidateQueries( { queryKey: [ 'notifications', 'unread-count' ] } );
			toast.success( 'All notifications marked as read.' );
		},
		onError: ( err: Error ) => toast.error( err.message ),
	} );

	const unreadCount = notifications.filter( ( n ) => ! n.is_read ).length;

	const handleClick = ( n: Notification ) => {
		if ( ! n.is_read ) markReadMutation.mutate( n.id );
		if ( n.link ) navigate( n.link );
	};

	return (
		<div className="st-todox-page">
			<PageHeader
				title="Notifications"
				description={ unreadCount > 0 ? `${ unreadCount } unread` : 'All caught up' }
				actions={
					unreadCount > 0 ? (
						<Button
							variant="secondary"
							onClick={ () => markAllMutation.mutate() }
							loading={ markAllMutation.isPending }
						>
							Mark All Read
						</Button>
					) : undefined
				}
			/>

			{ isLoading ? (
				<Spinner fullscreen />
			) : notifications.length === 0 ? (
				<EmptyState
					title="No notifications"
					description="You're all caught up!"
					icon="🔔"
				/>
			) : (
				<div className="st-todox-notification-list">
					{ notifications.map( ( n: Notification ) => (
						<div
							key={ n.id }
							className={ `st-todox-notification ${ ! n.is_read ? 'st-todox-notification--unread' : '' } ${ n.link ? 'st-todox-notification--clickable' : '' }` }
							onClick={ () => handleClick( n ) }
							role={ n.link ? 'button' : undefined }
							tabIndex={ n.link ? 0 : undefined }
						>
							<span className={ `st-todox-notification__icon st-todox-notification__icon--${ n.type }` }>
								{ TYPE_ICONS[ n.type ] }
							</span>
							<div className="st-todox-notification__body">
								<p className="st-todox-notification__title">{ n.title }</p>
								<p className="st-todox-notification__message">{ n.message }</p>
								<span className="st-todox-notification__time">
									{ formatRelativeTime( n.created_at ) }
								</span>
							</div>
							{ ! n.is_read && (
								<span className="st-todox-notification__dot" />
							) }
						</div>
					) ) }
				</div>
			) }
		</div>
	);
};

export default NotificationsPage;
