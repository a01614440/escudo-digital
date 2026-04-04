import { useState } from 'react';
import { formatDate } from '../lib/format.js';

const VIEW_LABELS = {
  survey: 'Encuesta',
  courses: 'Cursos',
  lesson: 'Curso en progreso',
  admin: 'Panel interno',
};

export default function SessionBar({ user, currentView, onViewChange, onLogout }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const activeViewLabel = VIEW_LABELS[currentView] || 'Escudo Digital';

  return (
    <section className="panel session-bar session-bar-compact">
      <div className="session-main">
        <div className="session-identity">
          <p className="eyebrow">Cuenta</p>
          <h2>{user?.email || 'usuario@correo.com'}</h2>
          <p className="hint">{`Vista actual: ${activeViewLabel}`}</p>
        </div>

        <div className="row inline nav-responsive">
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
          {user?.role === 'admin' ? (
            <button
              className={`btn ghost ${currentView === 'admin' ? 'active' : ''}`}
              type="button"
              onClick={() => onViewChange('admin')}
            >
              Panel interno
            </button>
          ) : null}
          <button className="btn ghost compact" type="button" onClick={() => setDetailsOpen((value) => !value)}>
            {detailsOpen ? 'Ocultar cuenta' : 'Mi cuenta'}
          </button>
        </div>
      </div>

      {detailsOpen ? (
        <div className="session-details">
          <div className="session-detail-card">
            <span>Ultimo acceso</span>
            <strong>{formatDate(user?.lastAccessAt)}</strong>
          </div>
          <div className="session-detail-card">
            <span>Guardado</span>
            <strong>Tu avance se sincroniza automaticamente</strong>
          </div>
          <div className="session-detail-actions">
            <button className="btn primary" type="button" onClick={onLogout}>
              Cerrar sesion
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
