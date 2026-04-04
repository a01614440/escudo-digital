import { formatDate } from '../lib/format.js';

export default function SessionBar({ user, currentView, onViewChange, onLogout }) {
  return (
    <section className="panel session-bar">
      <div>
        <p className="eyebrow">Sesion activa</p>
        <h2>{user?.email || 'usuario@correo.com'}</h2>
        <p className="hint">
          Ultimo acceso: {formatDate(user?.lastAccessAt)} | Tu avance se guarda automaticamente.
        </p>
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
        <button className="btn primary" type="button" onClick={onLogout}>
          Cerrar sesion
        </button>
      </div>
    </section>
  );
}
