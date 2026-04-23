import MobileShell from './MobileShell.jsx';
import TabletShell from './TabletShell.jsx';
import DesktopShell from './DesktopShell.jsx';
import { getShellLayoutPolicy } from './shellPolicies.js';

const SHELL_RENDERERS = {
  mobile: MobileShell,
  tablet: TabletShell,
  desktop: DesktopShell,
};

export default function DeviceShell({
  shellFamily = 'desktop',
  routeKey,
  routeIntent = 'focus',
  header,
  primary,
  secondary,
  floating,
  overlay,
  className,
}) {
  const Shell = SHELL_RENDERERS[shellFamily] || SHELL_RENDERERS.desktop;
  const policy = getShellLayoutPolicy(shellFamily);

  return (
    <Shell
      routeKey={routeKey}
      routeIntent={routeIntent}
      policy={policy}
      className={className}
      slots={{
        header,
        primary,
        secondary,
        floating,
        overlay,
      }}
    />
  );
}
