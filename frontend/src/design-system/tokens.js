export const colorTokens = {
  canvas: ['--sd-canvas', '--sd-canvas-muted'],
  surface: [
    '--sd-surface',
    '--sd-surface-subtle',
    '--sd-surface-raised',
    '--sd-panel',
  ],
  regionSurface: [
    '--sd-surface-hero',
    '--sd-surface-command',
    '--sd-surface-support',
    '--sd-surface-insight',
    '--sd-surface-spotlight',
    '--sd-surface-inverse',
  ],
  border: ['--sd-border-soft', '--sd-border', '--sd-border-strong', '--sd-border-accent'],
  text: [
    '--sd-text-strong',
    '--sd-text',
    '--sd-text-soft',
    '--sd-muted',
    '--sd-text-inverse',
    '--sd-text-inverse-soft',
  ],
  accent: [
    '--sd-accent',
    '--sd-accent-strong',
    '--sd-accent-soft',
    '--sd-accent-glow',
    '--sd-accent-contrast',
  ],
  semantic: ['--sd-success', '--sd-success-soft', '--sd-warning', '--sd-warning-soft', '--sd-danger', '--sd-danger-soft'],
  educational: [
    '--sd-evidence',
    '--sd-evidence-soft',
    '--sd-evidence-contrast',
    '--sd-safe-action',
    '--sd-safe-action-soft',
    '--sd-safe-action-contrast',
    '--sd-coach',
    '--sd-coach-soft',
    '--sd-coach-contrast',
    '--sd-progress-track',
    '--sd-progress-fill',
    '--sd-progress-complete',
    '--sd-progress-risk',
    '--sd-simulation-surface',
    '--sd-simulation-surface-strong',
    '--sd-simulation-border',
    '--sd-simulation-glow',
  ],
};

export const educationalTokens = {
  evidence: {
    base: '--sd-evidence',
    soft: '--sd-evidence-soft',
    contrast: '--sd-evidence-contrast',
    use: 'Senales detectadas, evidencia sospechosa o elementos que requieren inspeccion.',
  },
  safeAction: {
    base: '--sd-safe-action',
    soft: '--sd-safe-action-soft',
    contrast: '--sd-safe-action-contrast',
    use: 'Acciones seguras recomendadas; no equivale automaticamente a exito del usuario.',
  },
  coach: {
    base: '--sd-coach',
    soft: '--sd-coach-soft',
    contrast: '--sd-coach-contrast',
    use: 'Feedback pedagogico, reflexion guiada y explicaciones de apoyo.',
  },
  progress: {
    track: '--sd-progress-track',
    fill: '--sd-progress-fill',
    complete: '--sd-progress-complete',
    risk: '--sd-progress-risk',
    use: 'Progreso de ruta, modulo o actividad separado del accent primario.',
  },
  simulation: {
    surface: '--sd-simulation-surface',
    surfaceStrong: '--sd-simulation-surface-strong',
    border: '--sd-simulation-border',
    glow: '--sd-simulation-glow',
    use: 'Superficies inmersivas base para chat, inbox, llamada y laboratorio web.',
  },
};

export const radiusTokens = {
  xs: '10px',
  sm: '16px',
  md: '22px',
  lg: '30px',
  xl: '38px',
  pill: '999px',
};

export const spacingTokens = {
  scale: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '2rem',
    8: '2.5rem',
    9: '3rem',
    10: '3.75rem',
    11: '4.5rem',
  },
  regions: {
    sm: '0.875rem',
    md: '1.25rem',
    lg: '1.75rem',
    xl: '2.5rem',
  },
};

export const typographyTokens = {
  fontFamily: {
    sans: '"Sora", ui-sans-serif, system-ui, sans-serif',
    display: '"Unbounded", "Sora", ui-sans-serif, system-ui, sans-serif',
  },
  size: {
    eyebrow: '0.72rem',
    caption: '0.75rem',
    bodySm: '0.875rem',
    body: '1rem',
    headingSm: '1.125rem',
    headingSmWide: '1.25rem',
    headingMd: '1.25rem',
    headingMdWide: '1.5rem',
    title: '1.5rem',
    titleWide: '1.875rem',
    titleLarge: '2.45rem',
    display: '2rem',
    displayWide: '2.5rem',
    displayLarge: '3.25rem',
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  leading: {
    display: '0.98',
    title: '1.03',
    heading: '1.08',
    compact: '1.25',
    normal: '1.5',
    body: '1.75',
  },
  tracking: {
    none: '0em',
    ui: '0em',
    display: '0em',
    title: '0em',
    heading: '0em',
    label: '0em',
    overline: '0em',
  },
  roles: {
    display: {
      family: 'display',
      size: 'display',
      leading: 'display',
      tracking: 'display',
    },
    title: {
      family: 'display',
      size: 'title',
      leading: 'title',
      tracking: 'title',
    },
    headingMd: {
      family: 'display',
      size: 'headingMd',
      leading: 'heading',
      tracking: 'heading',
    },
    headingSm: {
      family: 'sans',
      size: 'headingSm',
      weight: 'semibold',
      leading: 'compact',
      tracking: 'heading',
    },
    body: {
      family: 'sans',
      size: 'body',
      leading: 'body',
      tracking: 'none',
    },
    caption: {
      family: 'sans',
      size: 'caption',
      weight: 'medium',
      leading: 'normal',
      tracking: 'none',
    },
  },
};

export const shellSpacingTokens = {
  mobile: {
    inline: '1rem',
    block: '1.25rem',
    sectionGap: '1rem',
    paneGap: '1rem',
    railGap: '0.875rem',
    heroGap: '1.125rem',
  },
  tablet: {
    inline: '1.5rem',
    block: '1.5rem',
    sectionGap: '1.25rem',
    paneGap: '1.25rem',
    railGap: '1rem',
    heroGap: '1.5rem',
  },
  desktop: {
    inline: '2rem',
    block: '2rem',
    sectionGap: '1.5rem',
    paneGap: '1.5rem',
    railGap: '1.25rem',
    heroGap: '2rem',
  },
  widths: {
    maxContent: '92rem',
    rail: '18rem',
    detail: '22rem',
  },
};

export const shadowTokens = {
  xs: '0 10px 24px -22px rgba(11, 24, 46, 0.16)',
  sm: '0 18px 36px -28px rgba(11, 24, 46, 0.2)',
  panel: '0 24px 52px -34px rgba(11, 24, 46, 0.26)',
  md: '0 28px 66px -36px rgba(11, 24, 46, 0.3)',
  lg: '0 36px 94px -44px rgba(11, 24, 46, 0.38)',
  spotlight: '0 24px 60px -34px rgba(166, 112, 25, 0.28)',
  floating: '0 42px 110px -42px rgba(8, 16, 31, 0.54)',
};

export const blurTokens = {
  soft: '10px',
  panel: '18px',
  hero: '26px',
};

export const motionTokens = {
  fast: '140ms',
  base: '220ms',
  slow: '360ms',
  enter: '480ms',
  standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  emphasis: 'cubic-bezier(0.16, 1, 0.3, 1)',
  decisive: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

export const zIndexTokens = {
  base: 0,
  sticky: 20,
  dropdown: 40,
  drawer: 50,
  scrim: 55,
  modal: 60,
  toast: 70,
  overlay: 80,
};

export const interactionRules = {
  hover: 'Elevar ligeramente superficies interactivas y reforzar el borde, nunca cambiar toda la estructura.',
  focus: 'Usar un focus ring de 1px + halo de 4px basado en accent.',
  active: 'Bajar la superficie y mantener el feedback de seleccion por borde y glow, no por color plano.',
  disabled: 'Reducir opacidad y cancelar elevacion sin perder legibilidad.',
  loading: 'Mostrar spinner o skeleton sin colapsar la geometria original.',
  error: 'Usar borde + halo + mensaje contextual; no depender solo del color de texto.',
  success: 'Reservar verde para confirmacion y progreso, no como color primario de accion.',
};

export const overlayInventory = {
  primitives: ['OverlayFrame', 'Dialog', 'Drawer', 'Sheet'],
  guidance: {
    dialog: 'Usar para confirmacion, formularios cortos o decisiones de bloqueo.',
    drawer: 'Usar para panel secundario persistente o detalle lateral en shells amplios.',
    sheet: 'Usar para apoyo movil o acciones contextuales desde la parte baja.',
  },
};

export const a11yRules = {
  labels: 'Todo control de entrada debe exponerse con label o aria-label legible.',
  focus: 'Todo control interactivo debe mostrar focus visible fuerte y consistente.',
  keyboard: 'Los overlays deben ser invocables con botones reales y cerrables sin depender de puntero.',
  invalid: 'Los estados invalidos deben usar aria-invalid y apoyo textual.',
  disabled: 'Disabled debe seguir siendo legible y no depender solo de baja opacidad.',
  loading: 'Loading debe exponer aria-busy o role=status sin colapsar la geometria.',
  semantics: 'Mensajes, progreso y overlays deben usar roles nativos o ARIA apropiados.',
  contrast: 'Las superficies de alto contraste deben mantener legibilidad entre texto, borde y fondo.',
};

export const containerAwarenessRules = {
  base: 'Los layouts y patterns macro deben marcarse con data-sd-container=true.',
  requiredFor: ['SplitHeroLayout', 'WorkspaceLayout', 'StageHero', 'SupportRail', 'StatStrip', 'KeyValueBlock', 'ProgressSummary'],
  policy: 'La composicion interna debe reaccionar al espacio util del contenedor antes que al viewport global.',
};

export const foundationInventory = {
  primitives: [
    'Button',
    'Badge',
    'SurfaceCard',
    'Input',
    'TextArea',
    'Select',
    'Field',
    'InlineMessage',
    'ProgressBar',
    'Spinner',
    'SkeletonBlock',
    'OverlayFrame',
    'Dialog',
    'Drawer',
    'Sheet',
  ],
  patterns: [
    'ActionCluster',
    'SectionHeader',
    'PanelHeader',
    'EmptyState',
    'MetricCard',
    'KeyValueBlock',
    'ProgressSummary',
    'StageHero',
    'SupportRail',
    'StatStrip',
  ],
  layouts: ['SplitHeroLayout', 'WorkspaceLayout'],
};
