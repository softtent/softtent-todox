import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { DashboardStats } from '../../../types';

const STATUS_ROWS = [
	{ key: 'todo'        as const, label: 'To Do',       barColor: '#94a3b8',  trackBg: 'rgba(148,163,184,.12)', textColor: '#64748b', dot: '#94a3b8' },
	{ key: 'in_progress' as const, label: 'In Progress', barColor: '#6366f1',  trackBg: 'rgba(99,102,241,.08)',  textColor: '#6366f1', dot: '#6366f1' },
	{ key: 'review'      as const, label: 'In Review',   barColor: '#f59e0b',  trackBg: 'rgba(245,158,11,.08)',  textColor: '#d97706', dot: '#f59e0b' },
	{ key: 'completed'   as const, label: 'Completed',   barColor: '#10b981',  trackBg: 'rgba(16,185,129,.08)',  textColor: '#059669', dot: '#10b981' },
];

const SEGMENT_COLORS = [ '#94a3b8', '#6366f1', '#f59e0b', '#10b981' ];

interface Segment { pct: number; color: string }

function MultiColorDonut( { segments, total, completed }: { segments: Segment[]; total: number; completed: number } ) {
	const r     = 52;
	const circ  = 2 * Math.PI * r;
	const rate  = total > 0 ? Math.round( ( completed / total ) * 100 ) : 0;

	let cumulative = 0;

	return (
		<svg viewBox="0 0 120 120" style={ { width: '100%', height: '100%', transform: 'rotate(-90deg)' } }>
			{/* Track */}
			<circle cx="60" cy="60" r={ r } fill="none" stroke="#e2e8f0" strokeWidth="10" />

			{ total > 0 && segments.map( ( seg, idx ) => {
				if ( seg.pct <= 0 ) return null;
				const dash   = ( seg.pct / 100 ) * circ;
				const offset = -cumulative;
				cumulative  += dash;
				return (
					<circle
						key={ idx }
						cx="60" cy="60" r={ r }
						fill="none"
						stroke={ seg.color }
						strokeWidth="10"
						strokeLinecap="butt"
						strokeDasharray={ `${ dash } ${ circ - dash }` }
						strokeDashoffset={ offset }
						style={ { transition: 'stroke-dasharray 700ms ease' } }
					/>
				);
			} ) }

			{/* Center text */}
			<text
				x="60" y="55"
				textAnchor="middle"
				dominantBaseline="middle"
				fill="#0f172a"
				style={ { fontSize: 22, fontWeight: 700, fontFamily: 'inherit', transform: 'rotate(90deg)', transformOrigin: '60px 60px' } }
			>
				{ rate }%
			</text>
			<text
				x="60" y="70"
				textAnchor="middle"
				dominantBaseline="middle"
				fill="#94a3b8"
				style={ { fontSize: 10, fontWeight: 500, fontFamily: 'inherit', transform: 'rotate(90deg)', transformOrigin: '60px 60px' } }
			>
				complete
			</text>
		</svg>
	);
}

interface Props {
	stats: DashboardStats;
}

export default function TaskProgressPanel( { stats }: Props ) {
	const navigate = useNavigate();
	const total    = stats.tasks.total;

	const segments: Segment[] = [
		{ pct: total > 0 ? ( stats.tasks.todo        / total ) * 100 : 0, color: SEGMENT_COLORS[ 0 ] },
		{ pct: total > 0 ? ( stats.tasks.in_progress / total ) * 100 : 0, color: SEGMENT_COLORS[ 1 ] },
		{ pct: total > 0 ? ( stats.tasks.review      / total ) * 100 : 0, color: SEGMENT_COLORS[ 2 ] },
		{ pct: total > 0 ? ( stats.tasks.completed   / total ) * 100 : 0, color: SEGMENT_COLORS[ 3 ] },
	];

	return (
		<div className="st-todox-progress-panel">
			<div className="st-todox-progress-panel__header">
				<div>
					<h3 className="st-todox-progress-panel__title">Task Progress</h3>
					<p className="st-todox-progress-panel__sub">Overview of all { total } tasks</p>
				</div>
				<button className="st-todox-progress-panel__link" onClick={ () => navigate( '/tasks' ) }>
					View all <ArrowRight size={ 12 } />
				</button>
			</div>

			<div className="st-todox-progress-panel__body">
				{/* Donut */}
				<div className="st-todox-progress-panel__donut">
					<MultiColorDonut segments={ segments } total={ total } completed={ stats.tasks.completed } />
				</div>

				{/* Bars */}
				<div className="st-todox-progress-panel__bars">
					{ STATUS_ROWS.map( ( row ) => {
						const count = stats.tasks[ row.key ];
						const pct   = total > 0 ? Math.round( ( count / total ) * 100 ) : 0;
						return (
							<div key={ row.key } className="st-todox-progress-bar-row">
								<div className="st-todox-progress-bar-row__top">
									<div className="st-todox-progress-bar-row__label">
										<span className="st-todox-progress-bar-row__dot" style={ { background: row.dot } } />
										<span>{ row.label }</span>
									</div>
									<div className="st-todox-progress-bar-row__counts">
										<span style={ { color: row.textColor, fontWeight: 700, fontSize: 12 } }>{ count }</span>
										<span className="st-todox-progress-bar-row__pct">{ pct }%</span>
									</div>
								</div>
								<div className="st-todox-progress-bar-row__track" style={ { background: row.trackBg } }>
									<div
										className="st-todox-progress-bar-row__fill"
										style={ { width: `${ pct }%`, background: row.barColor } }
									/>
								</div>
							</div>
						);
					} ) }

					{ stats.tasks.overdue > 0 && (
						<div className="st-todox-progress-panel__overdue">
							<div className="st-todox-progress-panel__overdue-left">
								<span className="st-todox-progress-panel__overdue-ping">
									<span className="st-todox-progress-panel__overdue-ping-inner" />
								</span>
								<span className="st-todox-progress-panel__overdue-text">
									{ stats.tasks.overdue } task{ stats.tasks.overdue > 1 ? 's' : '' } past due date
								</span>
							</div>
							<button
								className="st-todox-progress-panel__overdue-link"
								onClick={ () => navigate( '/tasks?status=todo' ) }
							>
								Review →
							</button>
						</div>
					) }
				</div>
			</div>
		</div>
	);
}
