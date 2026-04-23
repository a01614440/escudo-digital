import AuthView from '../components/AuthView.jsx';
import RouteContainer from './RouteContainer.jsx';

export default function PublicRouteContainer({ shellFamily, viewport, routeMeta, authProps }) {
  return (
    <RouteContainer
      routeKey="auth"
      shellFamily={shellFamily}
      intent={routeMeta?.shellIntent || 'focus'}
      scope="public"
    >
      <AuthView viewport={viewport} {...authProps} />
    </RouteContainer>
  );
}
