export default function AuthView({
  mode,
  email,
  password,
  error,
  submitting,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  const isLogin = mode === 'login';

  return (
    <section id="authView" className="auth-shell">
      <div className="auth-hero">
        <p className="eyebrow">Mexico | Prevencion de estafas digitales</p>
        <h1>Escudo Digital</h1>
        <p className="lead">
          Inicia sesion para guardar tu avance, retomar tus modulos y seguir fortaleciendo tu
          seguridad digital.
        </p>
      </div>

      <section className="panel auth-panel">
        <div className="auth-toggle">
          <button
            className={`btn ghost ${isLogin ? 'active' : ''}`}
            type="button"
            onClick={() => onModeChange('login')}
          >
            Iniciar sesion
          </button>
          <button
            className={`btn ghost ${!isLogin ? 'active' : ''}`}
            type="button"
            onClick={() => onModeChange('register')}
          >
            Crear cuenta
          </button>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">Acceso</p>
          <h2>{isLogin ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h2>
          <p className="hint">
            {isLogin
              ? 'Entra con tu correo para continuar exactamente donde te quedaste.'
              : 'Solo te pediremos correo y contrasena para guardar tu progreso.'}
          </p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="authEmail">Correo electronico</label>
          <input
            id="authEmail"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
          />

          <label htmlFor="authPassword">Contrasena</label>
          <input
            id="authPassword"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder="Minimo 6 caracteres"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
          />

          <div className={`alert ${error ? '' : 'hidden'}`}>{error}</div>
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting
              ? isLogin
                ? 'Entrando...'
                : 'Creando...'
              : isLogin
                ? 'Entrar'
                : 'Crear cuenta'}
          </button>
        </form>
      </section>
    </section>
  );
}
