import { Component } from 'react';
import { clearLocalState, writeSessionToken } from '../lib/storage.js';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App render crash:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    clearLocalState();
    writeSessionToken('');
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section className="app-crash-screen" role="alert">
        <div className="app-crash-card">
          <p className="eyebrow">Recuperación de la app</p>
          <h1>Detectamos un error al cargar esta vista.</h1>
          <p className="lead">
            Puede venir de una sesión vieja o de datos guardados que ya no coinciden con la versión actual.
          </p>
          <div className="app-crash-actions">
            <button className="btn primary" type="button" onClick={this.handleReload}>
              Recargar
            </button>
            <button className="btn ghost" type="button" onClick={this.handleReset}>
              Reiniciar en este navegador
            </button>
          </div>
          {this.state.error?.message ? (
            <p className="app-crash-detail">{`Detalle: ${this.state.error.message}`}</p>
          ) : null}
        </div>
      </section>
    );
  }
}
