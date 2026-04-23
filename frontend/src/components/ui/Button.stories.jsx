import { Button, IconButton } from './index.js';

const meta = {
  title: 'Foundation/Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'Continuar',
    variant: 'primary',
    size: 'md',
  },
  render: (args) => <Button {...args} />,
};

export default meta;

export const Primary = {};

export const Secondary = {
  args: {
    variant: 'secondary',
  },
};

export const Hero = {
  args: {
    variant: 'hero',
  },
};

export const Loading = {
  args: {
    loading: true,
    children: 'Guardando',
  },
};

export const IconButtons = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton label="Abrir ayuda" variant="secondary">
        ?
      </IconButton>
      <IconButton label="Agregar elemento" variant="primary">
        +
      </IconButton>
      <IconButton label="Marcar como importante" variant="soft" active>
        !
      </IconButton>
      <IconButton label="Cerrar" variant="ghost">
        x
      </IconButton>
      <IconButton label="Guardando" variant="primary" loading>
        +
      </IconButton>
    </div>
  ),
};
