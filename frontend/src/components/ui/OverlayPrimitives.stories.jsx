import { Button, Dialog, Drawer, Sheet } from './index.js';

const meta = {
  title: 'Foundation/Primitives/Overlays',
  tags: ['autodocs'],
};

export default meta;

export const DialogPreview = {
  render: () => (
    <div className="grid gap-4">
      <Button variant="secondary">Trigger de ejemplo</Button>
      <Dialog
        open
        title="Confirmar decision"
        subtitle="Esta capa sirve como referencia de semantica y contraste."
        actions={<Button variant="primary">Aceptar</Button>}
      >
        <p className="sd-copy m-0">El contenido del dialogo debe mantenerse corto, claro y enfocado.</p>
      </Dialog>
    </div>
  ),
};

export const DrawerPreview = {
  render: () => (
    <Drawer
      open
      title="Detalle lateral"
      subtitle="Drawer base para railes secundarios o detalle persistente."
      actions={<Button variant="primary">Aplicar</Button>}
    >
      <p className="sd-copy m-0">Esta variante mantiene lectura vertical y footer fijo.</p>
    </Drawer>
  ),
};

export const SheetPreview = {
  render: () => (
    <Sheet
      open
      title="Acciones moviles"
      subtitle="Base para support sheet o panel contextual."
      actions={<Button variant="primary">Continuar</Button>}
    >
      <p className="sd-copy m-0">El sheet debe sentirse inferior y contextual, no como un modal centrado.</p>
    </Sheet>
  ),
};
