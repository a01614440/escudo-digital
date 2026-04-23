import React from 'react';

import '../frontend/src/styles/tailwind.css';

const preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      expanded: true,
    },
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: '#eef3fb' },
        { name: 'ink', value: '#08111f' },
      ],
    },
    a11y: {
      test: 'todo',
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: ['light', 'dark'],
      },
    },
  },
  decorators: [
    (Story, context) => {
      if (typeof document !== 'undefined') {
        document.body.dataset.theme = context.globals.theme;
      }

      return (
        <div className="sd-page-shell py-8">
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
