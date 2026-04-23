import { createContext, useContext, useMemo } from 'react';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout.js';
import { getShellLayoutPolicy } from '../shells/shellPolicies.js';

const DeviceProfileContext = createContext(null);

export function DeviceProfileProvider({ children }) {
  const profile = useResponsiveLayout();
  const shellPolicy = useMemo(
    () => getShellLayoutPolicy(profile.shellFamily),
    [profile.shellFamily]
  );

  const value = useMemo(
    () => ({
      ...profile,
      shellPolicy,
      layoutModel: {
        macro: profile.shellFamily,
        fine: profile.viewport,
        compatViewportDataset: profile.compatViewportDataset,
        dataShell: profile.shellFamily,
      },
    }),
    [profile, shellPolicy]
  );

  return <DeviceProfileContext.Provider value={value}>{children}</DeviceProfileContext.Provider>;
}

export function useDeviceProfile() {
  const value = useContext(DeviceProfileContext);

  if (!value) {
    throw new Error('useDeviceProfile must be used within DeviceProfileProvider');
  }

  return value;
}
