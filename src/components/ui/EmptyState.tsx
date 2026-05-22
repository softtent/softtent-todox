interface EmptyStateProps {
	title: string;
	description?: string;
	action?: React.ReactNode;
	icon?: string;
}

const EmptyState = ( { title, description, action, icon = '📭' }: EmptyStateProps ) => (
	<div className="st-todox-empty-state">
		<div className="st-todox-empty-state__icon">{ icon }</div>
		<h3 className="st-todox-empty-state__title">{ title }</h3>
		{ description && (
			<p className="st-todox-empty-state__description">{ description }</p>
		) }
		{ action && <div className="st-todox-empty-state__action">{ action }</div> }
	</div>
);

export default EmptyState;
