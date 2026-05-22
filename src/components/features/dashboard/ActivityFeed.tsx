import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import Avatar from '../../ui/Avatar';
import { formatRelativeTime } from '../../../utils/helpers';
import type { TaskActivity } from '../../../types';

const ACTION_CONFIG: Record< string, { label: string; chipBg: string; chipColor: string; dot: string } > = {
	created:        { label: 'created',      chipBg: 'rgba(16,185,129,.1)',  chipColor: '#059669', dot: '#10b981' },
	updated:        { label: 'updated',      chipBg: 'rgba(59,130,246,.1)',  chipColor: '#2563eb', dot: '#3b82f6' },
	status_changed: { label: 'moved',        chipBg: 'rgba(139,92,246,.1)', chipColor: '#7c3aed', dot: '#8b5cf6' },
	commented:      { label: 'commented on', chipBg: 'rgba(245,158,11,.1)', chipColor: '#d97706', dot: '#f59e0b' },
	completed:      { label: 'completed',    chipBg: 'rgba(20,184,166,.1)', chipColor: '#0f766e', dot: '#14b8a6' },
};

const DEFAULT_ACTION = { label: 'acted on', chipBg: 'rgba(148,163,184,.12)', chipColor: '#64748b', dot: '#94a3b8' };

interface Props {
	activities: TaskActivity[];
}

export default function ActivityFeed( { activities }: Props ) {
	const navigate = useNavigate();

	return (
		<div className="st-todox-activity-feed">
			<div className="st-todox-activity-feed__header">
				<div className="st-todox-activity-feed__header-left">
					<div className="st-todox-activity-feed__icon-box">
						<Activity size={ 16 } />
					</div>
					<div>
						<h3 className="st-todox-activity-feed__title">Recent Activity</h3>
						<p className="st-todox-activity-feed__sub">Latest team actions</p>
					</div>
				</div>
				<span className="st-todox-activity-feed__count">{ activities.length }</span>
			</div>

			<div className="st-todox-activity-feed__body">
				{ activities.length === 0 ? (
					<div className="st-todox-activity-feed__empty">
						<div className="st-todox-activity-feed__empty-icon">
							<Activity size={ 20 } />
						</div>
						<p className="st-todox-activity-feed__empty-title">No activity yet</p>
						<p className="st-todox-activity-feed__empty-desc">Actions on tasks will appear here</p>
					</div>
				) : (
					<div className="st-todox-activity-list">
						{ activities.map( ( activity, idx ) => {
							const cfg       = ACTION_CONFIG[ activity.action ] ?? DEFAULT_ACTION;
							const firstName = activity.user?.name?.split( ' ' )[ 0 ] ?? 'Someone';
							const title     = ( activity.task_title ?? '' ).length > 30
								? activity.task_title!.slice( 0, 30 ) + '…'
								: ( activity.task_title ?? '' );
							const isLast    = idx === activities.length - 1;

							return (
								<div key={ activity.id } className="st-todox-activity-item">
									<div className="st-todox-activity-item__timeline">
										<Avatar
											name={ activity.user?.name ?? 'U' }
											src={ activity.user?.avatar ?? null }
											size={ 28 }
										/>
										{ ! isLast && <div className="st-todox-activity-item__line" /> }
									</div>

									<div className="st-todox-activity-item__content">
										<div className="st-todox-activity-item__top">
											<span className="st-todox-activity-item__user">{ firstName }</span>
											<span
												className="st-todox-activity-item__action-chip"
												style={ { background: cfg.chipBg, color: cfg.chipColor } }
											>
												{ cfg.label }
											</span>
										</div>
										<button
											className="st-todox-activity-item__task"
											onClick={ () => navigate( `/tasks/${ activity.task_id }` ) }
										>
											{ title }
										</button>
										<p className="st-todox-activity-item__time">
											{ formatRelativeTime( activity.created_at ) }
										</p>
									</div>

									<span
										className="st-todox-activity-item__dot"
										style={ { background: cfg.dot } }
									/>
								</div>
							);
						} ) }
					</div>
				) }
			</div>
		</div>
	);
}
