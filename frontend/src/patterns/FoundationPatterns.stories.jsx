import { Button, SurfaceCard } from '../components/ui/index.js';
import {
  ActionCluster,
  EmptyState,
  KeyValueBlock,
  PanelHeader,
  ProgressSummary,
  StageHero,
  StatStrip,
  SupportRail,
} from './index.js';

const meta = {
  title: 'Foundation/Patterns',
  tags: ['autodocs'],
};

export default meta;

export const HeroAndRails = {
  render: () => (
    <div className="grid gap-6">
      <StageHero
        eyebrow="Cabina de acceso"
        title="La foundation ya puede sostener heroes con direccion real."
        subtitle="Este hero ya define apertura, continuidad y accion principal sin depender de cards genericas."
        actions={<ActionCluster><Button variant="primary">Entrar</Button><Button variant="hero">Ver enfoque</Button></ActionCluster>}
        aside={
          <StatStrip
            compact
            variant="command"
            items={[
              { key: '1', eyebrow: 'Continuidad', value: '3', label: 'Pasos' },
              { key: '2', eyebrow: 'Superficies', value: '6', label: 'Roles' },
            ]}
          />
        }
      >
        <p className="sd-copy-inverse m-0">La meta es evitar heroes armados con bloques indistintos.</p>
      </StageHero>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SurfaceCard variant="editorial" className="grid gap-5">
          <PanelHeader
            eyebrow="Workspace"
            title="Panel principal"
            subtitle="Header de panel para contenido central o detalle."
            actions={<Button variant="soft">Editar</Button>}
            divider
          />
          <KeyValueBlock
            items={[
              { label: 'Nivel', value: 'Medio' },
              { label: 'Prioridad', value: 'Mensajeria' },
              { label: 'Riesgo', value: 'Ingenieria social' },
              { label: 'Continuidad', value: 'Modulo 2' },
            ]}
          />
          <ProgressSummary
            eyebrow="Progreso"
            title="Ruta personalizada"
            value="62%"
            hint="Este pattern condensa progreso, heading y lectura secundaria."
            progressValue={62}
            progressMax={100}
          />
        </SurfaceCard>

        <SupportRail
          eyebrow="Support rail"
          title="Apoyo lateral"
          subtitle="Rail secundario normado para contexto, hints o continuidad."
          sticky
          footer={<Button variant="secondary">Abrir guia</Button>}
        >
          <p className="sd-copy-sm m-0">No debe volver a inventarse sidebars ad hoc.</p>
        </SupportRail>
      </div>
    </div>
  ),
};

export const EmptyAndSummary = {
  render: () => (
    <div className="grid gap-6">
      <EmptyState
        eyebrow="Estado vacio"
        title="No hay ruta configurada todavia."
        body="Este pattern cubre ausencia de datos sin degradarse a una card generica."
        primaryActionLabel="Crear ruta"
        secondaryActionLabel="Ver ejemplo"
      />
      <StatStrip
        items={[
          { key: 'a', eyebrow: 'Cobertura', value: '11', label: 'Primitives', hint: 'Base esencial cerrada.' },
          { key: 'b', eyebrow: 'Patterns', value: '10', label: 'Normados', hint: 'Listos para Fase 2-5.' },
          { key: 'c', eyebrow: 'Overlays', value: '4', label: 'Base', hint: 'Dialog, Drawer, Sheet y frame.' },
        ]}
      />
    </div>
  ),
};
