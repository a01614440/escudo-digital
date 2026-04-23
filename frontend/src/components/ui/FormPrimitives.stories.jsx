import {
  Badge,
  Checkbox,
  Field,
  InlineMessage,
  Input,
  ProgressBar,
  Radio,
  Select,
  SkeletonBlock,
  Spinner,
  SurfaceCard,
  TextArea,
} from './index.js';

const meta = {
  title: 'Foundation/Primitives/Form and Feedback',
  tags: ['autodocs'],
};

export default meta;

export const Playground = {
  render: () => (
    <SurfaceCard className="grid gap-6 max-w-3xl" variant="support">
      <Field label="Correo" hint="Usa una cuenta real para recuperar tu sesion.">
        <Input type="email" placeholder="equipo@escudodigital.mx" />
      </Field>
      <Field label="Contexto" error="Necesitamos un poco mas de detalle.">
        <TextArea invalid defaultValue="Empresa pequena con ventas por Instagram y WhatsApp." />
      </Field>
      <Field label="Prioridad">
        <Select defaultValue="chat">
          <option value="chat">Mensajeria</option>
          <option value="mail">Correo</option>
          <option value="web">Web</option>
        </Select>
      </Field>
      <div className="grid gap-3" role="group" aria-label="Preferencias de practica">
        <Checkbox label="Recordarme revisar senales antes de responder" defaultChecked />
        <Checkbox label="Mostrar apoyo contextual" hint="Puedes cambiarlo despues desde ajustes." />
      </div>
      <div className="grid gap-3" role="radiogroup" aria-label="Formato de actividad preferido">
        <Radio name="story-format" value="chat" label="Chat guiado" defaultChecked />
        <Radio name="story-format" value="inbox" label="Inbox y correo" hint="Practica con mensajes mas largos." />
        <Radio name="story-format" value="call" label="Llamada simulada" disabled />
      </div>
      <InlineMessage tone="warning" title="Senal detectada">
        Una prioridad mal definida puede afectar la continuidad de la ruta.
      </InlineMessage>
      <div className="grid gap-3">
        <ProgressBar value={62} max={100} tone="accent" size="lg" />
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="accent">Activa</Badge>
          <Badge tone="soft">En revision</Badge>
          <Spinner tone="accent" />
        </div>
      </div>
      <SkeletonBlock className="h-16 w-full" />
    </SurfaceCard>
  ),
};

export const InlineMessageSemantics = {
  render: () => (
    <SurfaceCard className="grid gap-4 max-w-3xl" variant="support">
      <InlineMessage tone="info" title="Guia disponible">
        Revisa el contexto antes de tomar una decision.
      </InlineMessage>
      <InlineMessage tone="success" title="Respuesta guardada">
        Tu avance quedo registrado correctamente.
      </InlineMessage>
      <InlineMessage tone="warning" title="Senal detectada">
        La solicitud mezcla urgencia con una accion sensible.
      </InlineMessage>
      <InlineMessage tone="danger" title="Accion bloqueada">
        No compartas codigos ni contrasenas fuera de la app oficial.
      </InlineMessage>
    </SurfaceCard>
  ),
};

export const ChoiceControls = {
  render: () => (
    <SurfaceCard className="grid gap-6 max-w-3xl" variant="support">
      <div className="grid gap-3" role="group" aria-label="Opciones de apoyo">
        <Checkbox label="Guardar progreso automaticamente" defaultChecked />
        <Checkbox label="Recibir pistas durante simulaciones" hint="Las pistas aparecen sin resolver la actividad." />
        <Checkbox label="Opcion invalida de ejemplo" error="Selecciona esta opcion solo si tienes autorizacion." />
      </div>
      <div className="grid gap-3" role="radiogroup" aria-label="Nivel de guia">
        <Radio name="guidance-level" value="low" label="Poca guia" />
        <Radio name="guidance-level" value="medium" label="Guia equilibrada" defaultChecked />
        <Radio name="guidance-level" value="high" label="Guia completa" hint="Mejor para primeras practicas." />
      </div>
    </SurfaceCard>
  ),
};
