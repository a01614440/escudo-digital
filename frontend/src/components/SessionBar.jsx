import { useState } from 'react';
import { formatDate } from '../lib/format.js';
import { cn } from '../lib/ui.js';
import { KeyValueBlock } from '../patterns/index.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import SurfaceCard from './ui/SurfaceCard.jsx';

function UtilityBar({
  isAdmin,
  adminPreviewAsUser,
  detailsOpen,
  onToggleAdminPreview,
  onToggleDetails,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin ? (
        <Button
          variant={adminPreviewAsUser ? 'soft' : 'quiet'}
          size="compact"
          type="button"
          onClick={onToggleAdminPreview}
        >
          {adminPreviewAsUser ? 'Volver a admin' : 'Ver como usuario'}
        </Button>
      ) : null}
      <Button
        variant={detailsOpen ? 'soft' : 'quiet'}
        size="compact"
        type="button"
        onClick={onToggleDetails}
      >
        {detailsOpen ? 'Ocultar cuenta' : 'Mi cuenta'}
      </Button>
    </div>
  );
}

export default function SessionBar({
  shellFamily = 'desktop',
  user,
  navigation,
  adminPreviewAsUser = false,
  onNavigate,
  onToggleAdminPreview,
  onLogout,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isAdmin = user?.role === 'admin';
  const activeViewLabel = navigation?.activeViewLabel || 'Escudo Digital';
  const showNavigation = Boolean(navigation?.showNavigation && navigation?.items?.length);

  return (
    <SurfaceCard padding="compact" variant="raised" className="w-full">
      <div className="grid gap-3">
        <div
          className={cn(
            'grid gap-3',
            shellFamily === 'desktop'
              ? 'xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center'
              : shellFamily === 'tablet'
                ? 'lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'
                : ''
          )}
        >
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{activeViewLabel}</Badge>
              {isAdmin ? (
                <Badge tone={adminPreviewAsUser ? 'soft' : 'neutral'}>
                  {adminPreviewAsUser ? 'Preview usuario' : 'Admin'}
                </Badge>
              ) : null}
            </div>

            <div className="grid min-w-0 gap-1">
              <strong className="text-base leading-6 text-sd-text-strong sm:text-lg">
                Escudo Digital
              </strong>
              <p className="m-0 truncate text-sm leading-6 text-sd-text-soft">{user?.email}</p>
            </div>
          </div>

          <UtilityBar
            isAdmin={isAdmin}
            adminPreviewAsUser={adminPreviewAsUser}
            detailsOpen={detailsOpen}
            onToggleAdminPreview={onToggleAdminPreview}
            onToggleDetails={() => setDetailsOpen((value) => !value)}
          />
        </div>

        {showNavigation ? (
          <div className="flex flex-wrap gap-2 border-t border-sd-border-soft pt-3">
            {navigation.items.map((item) => (
              <Button
                key={item.id}
                variant={item.active ? 'primary' : 'quiet'}
                size="compact"
                active={item.active}
                type="button"
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        ) : null}

        {detailsOpen ? (
          <div
            className={cn(
              'grid gap-4 rounded-[24px] border border-sd-border bg-sd-surface-subtle px-4 py-4',
              shellFamily === 'desktop' ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : ''
            )}
          >
            <KeyValueBlock
              items={[
                {
                  key: 'last-access',
                  label: 'Ultimo acceso',
                  value: formatDate(user?.lastAccessAt),
                },
                {
                  key: 'session',
                  label: 'Sesion',
                  value: 'Tu avance, ruta y modulo siguen ligados a esta cuenta.',
                },
                ...(isAdmin
                  ? [
                      {
                        key: 'admin-mode',
                        label: 'Modo admin',
                        value: adminPreviewAsUser
                          ? 'Ahora miras la app como usuario.'
                          : 'Mantienes acceso libre para revisar el flujo completo.',
                      },
                    ]
                  : []),
              ]}
            />

            <div className="flex items-start">
              <Button variant="secondary" type="button" onClick={onLogout}>
                Cerrar sesion
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
