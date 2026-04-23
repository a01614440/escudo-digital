import { Badge, Button, SurfaceCard } from './index.js';

const meta = {
  title: 'Foundation/Primitives/SurfaceCard',
  component: SurfaceCard,
  tags: ['autodocs'],
};

export default meta;

export const Panel = {
  render: () => (
    <SurfaceCard className="grid gap-4 max-w-3xl" variant="panel">
      <p className="sd-eyebrow">Superficie base</p>
      <h2 className="sd-heading-md m-0">Panel claro para contenido principal</h2>
      <p className="sd-copy m-0">SurfaceCard mantiene padding, borde y profundidad consistentes.</p>
      <Button variant="secondary">Accion secundaria</Button>
    </SurfaceCard>
  ),
};

export const InverseTone = {
  render: () => (
    <SurfaceCard className="grid gap-4 max-w-3xl" tone="inverse">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="ink">Inverse</Badge>
        <p className="sd-eyebrow m-0">Tono oscuro reutilizable</p>
      </div>
      <h2 className="sd-heading-md m-0">Superficie inversa sin hacks locales</h2>
      <p className="sd-copy m-0">
        Este tono permite montar soporte, modales o paneles oscuros sin redefinir texto, bordes y acciones por vista.
      </p>
      <div className="sd-divider" />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="hero">Continuar</Button>
        <Button variant="secondary">Ver detalle</Button>
      </div>
    </SurfaceCard>
  ),
};
