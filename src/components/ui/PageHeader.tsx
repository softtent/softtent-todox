interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: React.ReactNode;
}

const PageHeader = ( { title, description, actions }: PageHeaderProps ) => (
	<div className="st-todox-page-header">
		<div className="st-todox-page-header__text">
			<h1 className="st-todox-page-header__title">{ title }</h1>
			{ description && (
				<p className="st-todox-page-header__description">{ description }</p>
			) }
		</div>
		{ actions && (
			<div className="st-todox-page-header__actions">{ actions }</div>
		) }
	</div>
);

export default PageHeader;
