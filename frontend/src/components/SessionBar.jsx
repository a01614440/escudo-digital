import { useState } from 'react';
import { formatDate } from '../lib/format.js';

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
      <button
        className={`btn ghost ${currentView === 'survey' ? 'active' : ''}`}
        type="button"
        onClick={() => onViewChange('survey')}
      >
        Encuesta
      </button>
      <button
        className={`btn ghost ${currentView === 'courses' || currentView === 'lesson' ? 'active' : ''}`}
        type="button"
        onClick={() => onViewChange('courses')}
      >
        Cursos
      </button>
      {isAdmin ? (
        <button
          className={`btn ghost ${currentView === 'admin' ? 'active' : ''}`}
          type="button"
          onClick={() => onViewChange('admin')}
        >
          Panel interno
        </button>
      ) : null}
    </>
  );

  const utilityButtons = (
    <>
      {isAdmin ? (
        <button
          className={`btn ghost compact ${adminPreviewAsUser ? 'active' : ''}`}
          type="button"
          onClick={onToggleAdminPreview}
        >
          {adminPreviewAsUser ? 'Volver a modo admin' : 'Ver como usuario normal'}
        </button>
      ) : null}
      <button className="btn ghost compact" type="button" onClick={onThemeToggle}>
        {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      </button>
      <button className="btn ghost compact" type="button" onClick={() => setDetailsOpen((value) => !value)}>
        {detailsOpen ? 'Ocultar cuenta' : 'Mi cuenta'}
      </button>
    </>
  );

  return (
    <section className={`panel session-bar session-bar-compact viewport-${viewport}`}>
      <div className="session-main">
        <div className="session-identity">
          <p className="eyebrow">Cuenta</p>
          <h2>{user?.email || 'usuario@correo.com'}</h2>
          <p className="hint">{`Vista actual: ${activeViewLabel}`}</p>
          {isCompact ? <span className="session-current-chip">{activeViewLabel}</span> : null}
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
              <strong>{adminPreviewAsUser ? 'Vista de usuario normal' : 'Acceso libre a todos los módulos'}</strong>
            </div>
          ) : null}
          <div className="session-detail-actions">
            <button className="btn primary" type="button" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
