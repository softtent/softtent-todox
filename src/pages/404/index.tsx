import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const NotFound = () => {
	const navigate = useNavigate();

	return (
		<div className="st-todox-not-found">
			<div className="st-todox-not-found__inner">
				<div className="st-todox-not-found__code">404</div>
				<h1 className="st-todox-not-found__title">Page not found</h1>
				<p className="st-todox-not-found__description">
					The page you're looking for doesn't exist or has been moved.
				</p>
				<Button onClick={ () => navigate( '/' ) }>Go to Dashboard</Button>
			</div>
		</div>
	);
};

export default NotFound;
