import { Button, SurfaceCard } from '../components/ui/index.js';
import { StageHero, SupportRail } from '../patterns/index.js';
import { SplitHeroLayout, WorkspaceLayout } from './index.js';

const meta = {
  title: 'Foundation/Layouts',
  tags: ['autodocs'],
};

export default meta;

export const SplitHero = {
  render: () => (
    <SplitHeroLayout
      shellFamily="desktop"
      hero={
        <StageHero
          eyebrow="Split hero"
          title="Layout base para acceso, intro, loading o resultados."
          subtitle="Separa direccion y accion principal antes de migrar vistas reales."
        />
      }
      primary={
        <SurfaceCard variant="raised" className="grid gap-4">
          <h3 className="sd-heading-sm m-0">Panel primario</h3>
          <p className="sd-copy m-0">Aqui vivira la accion principal de la pantalla.</p>
          <Button variant="primary">Continuar</Button>
        </SurfaceCard>
      }
      secondary={
        <SupportRail
          eyebrow="Secondary"
          title="Capa secundaria"
          subtitle="Apoyo, contexto o lectura editorial suave."
        >
          <p className="sd-copy-sm m-0">En desktop puede vivir debajo o al lado segun shell.</p>
        </SupportRail>
      }
    />
  ),
};

export const Workspace = {
  render: () => (
    <WorkspaceLayout
      shellFamily="desktop"
      command={
        <SupportRail tone="command" title="Command rail" subtitle="Tabs, filtros o continuidad." />
      }
      main={
        <SurfaceCard variant="editorial" className="grid gap-4">
          <h3 className="sd-heading-sm m-0">Workspace main</h3>
          <p className="sd-copy m-0">Contenido principal de trabajo.</p>
        </SurfaceCard>
      }
      insight={
        <SupportRail title="Insight rail" subtitle="Detalle, resumen o apoyo." sticky>
          <p className="sd-copy-sm m-0">El rail de insight se prepara desde foundation.</p>
        </SupportRail>
      }
    />
  ),
};
