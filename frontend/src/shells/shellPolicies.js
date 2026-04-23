export const SHELL_LAYOUT_POLICY = {
  mobile: {
    headerMode: 'stacked-command',
    primaryMode: 'single-task',
    secondaryMode: 'stack',
    secondaryPersistent: false,
    overlayMode: 'sheet-or-drawer',
    floatingMode: 'fab',
    slotOrder: ['header', 'primary', 'secondary', 'floating', 'overlay'],
  },
  tablet: {
    headerMode: 'balanced-command',
    primaryMode: 'balanced-workspace',
    secondaryMode: 'contextual-split',
    secondaryPersistent: false,
    overlayMode: 'drawer-or-sheet',
    floatingMode: 'fab',
    slotOrder: ['header', 'primary', 'secondary', 'floating', 'overlay'],
  },
  desktop: {
    headerMode: 'command-deck',
    primaryMode: 'workspace',
    secondaryMode: 'aside',
    secondaryPersistent: true,
    overlayMode: 'drawer-or-modal',
    floatingMode: 'corner-action',
    slotOrder: ['header', 'primary', 'secondary', 'floating', 'overlay'],
  },
};

export function getShellLayoutPolicy(shellFamily) {
  return SHELL_LAYOUT_POLICY[shellFamily] || SHELL_LAYOUT_POLICY.desktop;
}
