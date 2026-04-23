import { useState } from 'react';

import { Button, SurfaceCard } from '../components/ui/index.js';
import {
  ActionCluster,
  EmptyState,
  InfoPanel,
  JourneyStepper,
  KeyValueBlock,
  PanelHeader,
  ProgressSummary,
  QuestionPage,
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

export const JourneyAndProgress = {
  render: () => (
    <div className="grid gap-6">
      <ProgressSummary
        eyebrow="Foundation"
        title="F1 closeout"
        value="78%"
        hint="Resumen con container query activa y layout interno estable."
        progressValue={78}
        aside={
          <KeyValueBlock
            items={[
              { label: 'Estado', value: 'En cierre' },
              { label: 'Bloque', value: 'F1.H' },
            ]}
          />
        }
      />
      <JourneyStepper
        steps={[
          { id: 'typography', label: 'Typography', state: 'done' },
          { id: 'a11y', label: 'A11y base', state: 'done' },
          { id: 'patterns', label: 'Patterns', state: 'current' },
          { id: 'closeout', label: 'Closeout', state: 'upcoming' },
        ]}
      />
    </div>
  ),
};

const signalOptions = [
  { value: 'domain', label: 'El dominio no coincide', hint: 'La liga usa una marca parecida, pero no exacta.' },
  { value: 'urgency', label: 'Pide actuar con urgencia', hint: 'Presiona para responder antes de validar.' },
  { value: 'attachment', label: 'Incluye un archivo inesperado', hint: 'El adjunto no fue solicitado.' },
  { value: 'tone', label: 'El tono parece normal', hint: 'No todo mensaje amable es seguro.' },
];

export const QuestionPageSingle = {
  render: function Render() {
    const [value, setValue] = useState('domain');

    return (
      <QuestionPage
        eyebrow="Pregunta 1 de 4"
        title="Cual es la senal principal de riesgo?"
        description="Elige una respuesta para continuar con el diagnostico."
        type="single"
        name="single-signal"
        value={value}
        onValueChange={setValue}
        options={signalOptions}
        actions={<ActionCluster align="end"><Button variant="secondary">Atras</Button><Button variant="primary">Continuar</Button></ActionCluster>}
      />
    );
  },
};

export const QuestionPageMulti = {
  render: function Render() {
    const [values, setValues] = useState(['domain', 'urgency']);

    return (
      <QuestionPage
        eyebrow="Pregunta 2 de 4"
        title="Que senales conviene revisar antes de responder?"
        description="Puedes marcar mas de una opcion."
        type="multi"
        name="multi-signals"
        values={values}
        onValueChange={setValues}
        options={signalOptions}
        help={<p className="sd-copy-sm m-0">La respuesta puede combinar senales tecnicas y senales de contexto.</p>}
        actions={<ActionCluster align="between"><Button variant="quiet">Guardar y salir</Button><Button variant="primary">Continuar</Button></ActionCluster>}
      />
    );
  },
};

export const QuestionPageSelect = {
  render: function Render() {
    const [value, setValue] = useState('');

    return (
      <QuestionPage
        eyebrow="Pregunta 3 de 4"
        title="Que canal recibio el mensaje?"
        description="Este pattern cubre preguntas de seleccion corta sin recrear campos por vista."
        type="select"
        name="channel"
        value={value}
        onValueChange={setValue}
        placeholder="Selecciona el canal"
        options={[
          { value: 'sms', label: 'SMS' },
          { value: 'email', label: 'Correo' },
          { value: 'chat', label: 'Chat' },
          { value: 'call', label: 'Llamada' },
        ]}
        error={!value ? 'Selecciona un canal para avanzar.' : ''}
        actions={<ActionCluster align="end"><Button variant="primary">Continuar</Button></ActionCluster>}
      />
    );
  },
};

export const QuestionPageText = {
  render: function Render() {
    const [value, setValue] = useState('Verificaria el dominio antes de abrir el enlace.');

    return (
      <QuestionPage
        eyebrow="Reflexion guiada"
        title="Que harias antes de responder?"
        description="El campo libre queda contenido en el mismo contrato visual que las opciones."
        type="text"
        name="reflection"
        value={value}
        onValueChange={setValue}
        textPlaceholder="Escribe tu decision segura..."
        actions={<ActionCluster align="end"><Button variant="primary">Guardar respuesta</Button></ActionCluster>}
      />
    );
  },
};

export const InfoPanels = {
  render: () => (
    <div className="grid gap-6 lg:grid-cols-3">
      <InfoPanel
        tone="evidence"
        eyebrow="Evidencia"
        title="Senales detectadas"
        subtitle="Lista compacta para rails de aprendizaje."
        items={[
          { label: 'Dominio', body: 'La liga usa una variante del nombre real.' },
          { label: 'Presion', body: 'El mensaje pide actuar antes de validar.' },
        ]}
      />
      <InfoPanel
        tone="coach"
        eyebrow="Coach"
        title="Lectura guiada"
        subtitle="Feedback pedagogico sin bloquear la tarea."
      >
        <p className="sd-copy-sm m-0">Observa primero remitente, contexto y destino antes de decidir.</p>
      </InfoPanel>
      <InfoPanel
        tone="safeAction"
        eyebrow="Accion segura"
        title="Siguiente paso"
        subtitle="Recomendacion reusable para rutas y modulos."
        footer={<Button variant="secondary">Ver guia</Button>}
      />
    </div>
  ),
};
