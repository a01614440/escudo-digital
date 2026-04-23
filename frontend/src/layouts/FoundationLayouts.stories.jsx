import { Button, SurfaceCard } from '../components/ui/index.js';
import { ActionCluster, InfoPanel, ProgressSummary, QuestionPage, StageHero, SupportRail } from '../patterns/index.js';
import { AssessmentLayout, SplitHeroLayout, WorkspaceLayout } from './index.js';

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

export const Assessment = {
  render: () => (
    <AssessmentLayout
      shellFamily="desktop"
      hero={
        <StageHero
          tone="spotlight"
          eyebrow="Assessment layout"
          title="Encuesta con pregunta central y rail educativo."
          subtitle="Composition base para F3.refine sin tocar SurveyView en esta fase."
        />
      }
      progress={
        <ProgressSummary
          eyebrow="Diagnostico"
          title="Progreso del assessment"
          value="2/4"
          hint="El progreso queda fuera de la pregunta para mantener el contrato claro."
          progressValue={50}
        />
      }
      question={
        <QuestionPage
          eyebrow="Pregunta 2 de 4"
          title="Que senal revisarias primero?"
          description="Esta composicion muestra como AssessmentLayout aloja QuestionPage."
          type="single"
          name="assessment-layout-signal"
          value="domain"
          onValueChange={() => {}}
          options={[
            { value: 'domain', label: 'Dominio del enlace', hint: 'Confirma que la direccion sea legitima.' },
            { value: 'sender', label: 'Nombre del remitente', hint: 'Revisa si coincide con la organizacion.' },
          ]}
          actions={<ActionCluster align="end"><Button variant="secondary">Atras</Button><Button variant="primary">Continuar</Button></ActionCluster>}
        />
      }
      insight={
        <InfoPanel
          tone="coach"
          eyebrow="Apoyo"
          title="Antes de decidir"
          subtitle="El rail acompana sin meter logica de dominio en el layout."
          items={[
            { label: 'Orden sugerido', body: 'Primero valida remitente y destino.' },
            { label: 'No dependas del tono', body: 'Un mensaje cordial tambien puede ser riesgoso.' },
          ]}
        />
      }
    />
  ),
};
