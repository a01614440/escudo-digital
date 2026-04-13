import { useState } from 'react';
import { formatDate } from '../lib/format.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import SurfaceCard from './ui/SurfaceCard.jsx';

const VIEW_LABELS = {
  survey: 'Encuesta',
  courses: 'Cursos',
  lesson: 'Curso en progreso',
  admin: 'Panel interno',
};

export default function SessionBar({
  viewport = 'desktop',
  user,
  currentView,
  theme,
  adminPreviewAsUser = false,
  onViewChange,
  onThemeToggle,
  onToggleAdminPreview,
  onLogout,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const activeViewLabel = VIEW_LABELS[currentView] || 'Escudo Digital';
  const isAdmin = user?.role === 'admin';
  const isCompact = ['phone-small', 'phone', 'tablet-compact'].includes(viewport);

  const navButtons = (
    <>
      <Button
        variant="ghost"
        active={currentView === 'survey'}
        type="button"
        onClick={() => onViewChange('survey')}
      >
        Encuesta
      </Button>
      <Button
        variant="ghost"
        active={currentView === 'courses' || currentView === 'lesson'}
        type="button"
        onClick={() => onViewChange('courses')}
      >
        Cursos
      </Button>
      {isAdmin ? (
        <Button
          variant="ghost"
          active={currentView === 'admin'}
          type="button"
          onClick={() => onViewChange('admin')}
        >
          Panel interno
        </Button>
      ) : null}
    </>
  );

  const utilityButtons = (
    <>
      {isAdmin ? (
        <Button
          variant="ghost"
          size="compact"
          active={adminPreviewAsUser}
          type="button"
          onClick={onToggleAdminPreview}
        >
          {adminPreviewAsUser ? 'Volver a modo admin' : 'Ver como usuario normal'}
        </Button>
      ) : null}
      <Button variant="ghost" size="compact" type="button" onClick={onThemeToggle}>
        {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      </Button>
      <Button
        variant="ghost"
        size="compact"
        type="button"
        onClick={() => setDetailsOpen((value) => !value)}
      >
        {detailsOpen ? 'Ocultar cuenta' : 'Mi cuenta'}
      </Button>
    </>
  );

  return (
    <SurfaceCard
      padding="md"
      className={`session-bar session-bar-compact viewport-${viewport} sd-page-shell`}
    >
      <div className="session-main">
        <div className="session-identity">
          <p className="eyebrow">Cuenta</p>
          <h2 className="sd-title text-[1.7rem] sm:text-[2rem]">
            {user?.email || 'usuario@correo.com'}
          </h2>
          <p className="hint">{`Vista actual: ${activeViewLabel}`}</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">{activeViewLabel}</Badge>
            {isAdmin ? (
              <Badge tone={adminPreviewAsUser ? 'soft' : 'neutral'}>
                {adminPreviewAsUser ? 'Preview usuario' : 'Admin'}
              </Badge>
            ) : null}
          </div>
        </div>

        {isCompact ? (
          <div className="session-main-actions">
            <div className="session-utility-row">{utilityButtons}</div>
            <div className="row inline nav-responsive session-nav-pills">{navButtons}</div>
          </div>
        ) : (
          <div className="row inline nav-responsive">
            {navButtons}
            {utilityButtons}
          </div>
        )}
      </div>

      {detailsOpen ? (
        <div className="session-details">
          <div className="session-detail-card">
            <span>Último acceso</span>
            <strong>{formatDate(user?.lastAccessAt)}</strong>
          </div>
          <div className="session-detail-card">
            <span>Guardado</span>
            <strong>Tu avance se sincroniza automáticamente</strong>
          </div>
          {isAdmin ? (
            <div className="session-detail-card">
              <span>Modo admin</span>
              <strong>
                {adminPreviewAsUser
                  ? 'Vista de usuario normal'
                  : 'Acceso libre a todos los módulos'}
              </strong>
            </div>
          ) : null}
          <div className="session-detail-actions">
            <Button variant="primary" type="button" onClick={onLogout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
