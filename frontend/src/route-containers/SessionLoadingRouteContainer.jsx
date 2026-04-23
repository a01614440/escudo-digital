import SurfaceCard from '../components/ui/SurfaceCard.jsx';
import RouteContainer from './RouteContainer.jsx';

export default function SessionLoadingRouteContainer({ shellFamily, routeMeta }) {
  return (
    <RouteContainer
      routeKey="loading"
      shellFamily={shellFamily}
      intent={routeMeta?.shellIntent || 'focus'}
      scope="loading"
    >
      <div className="sd-page-shell">
        <SurfaceCard padding="lg" className="mx-auto max-w-3xl">
          <p className="eyebrow">Cargando</p>
          <h1 className="sd-title max-w-[12ch]">Restaurando sesión</h1>
          <p className="lead sd-subtitle">Estamos recuperando tu información guardada.</p>
        </SurfaceCard>
      </div>
    </RouteContainer>
  );
}
