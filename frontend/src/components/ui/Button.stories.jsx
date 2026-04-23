import Button from './Button.jsx';

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
