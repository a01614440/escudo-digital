import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import SurfaceCard from './ui/SurfaceCard.jsx';

export default function AuthView({
  viewport = 'desktop',
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
  const isCompact = ['phone-small', 'phone', 'tablet-compact'].includes(viewport);

  return (
    <section
      id="authView"
      className={`auth-shell auth-shell-${viewport} sd-page-shell grid gap-4 lg:grid-cols-[1.05fr_0.95fr] xl:items-start`}
    >
      <SurfaceCard
        as="div"
        padding="lg"
        className="auth-hero relative overflow-hidden lg:min-h-[420px] lg:px-10"
      >
        <p className="eyebrow">México | Prevención de estafas digitales</p>
        <h1 className="sd-title max-w-[9ch]">Escudo Digital</h1>
        <p className="lead sd-subtitle max-w-[48ch]">
          Inicia sesión para guardar tu avance, retomar tus módulos y seguir fortaleciendo tu
          seguridad digital.
        </p>
        {isCompact ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tone="accent" className="activity-pill">
              Avance sincronizado
            </Badge>
            <Badge tone="soft" className="activity-pill">
              Rutas personalizadas
            </Badge>
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard as="section" padding="lg" className="auth-panel">
        <div className="grid gap-6">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              active={isLogin}
              type="button"
              className={isLogin ? 'active' : ''}
              onClick={() => onModeChange('login')}
            >
              Iniciar sesión
            </Button>
            <Button
              variant="ghost"
              active={!isLogin}
              type="button"
              className={!isLogin ? 'active' : ''}
              onClick={() => onModeChange('register')}
            >
              Crear cuenta
            </Button>
          </div>

          <div className="grid gap-3">
            <p className="eyebrow">Acceso</p>
            <h2 className="sd-title text-[1.9rem] sm:text-[2.1rem]">
              {isLogin ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
            </h2>
            <p className="sd-subtitle">
              {isLogin
                ? 'Entra con tu correo para continuar exactamente donde te quedaste.'
                : 'Solo te pediremos correo y contraseña para guardar tu progreso.'}
            </p>
          </div>

          <form className="grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2" htmlFor="authEmail">
              <span className="text-sm font-medium text-sd-text">Correo electrónico</span>
              <input
                id="authEmail"
                type="email"
                autoComplete="email"
                className="sd-input"
                placeholder="tucorreo@ejemplo.com"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                required
              />
            </label>

            <label className="grid gap-2" htmlFor="authPassword">
              <span className="text-sm font-medium text-sd-text">Contraseña</span>
              <input
                id="authPassword"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="sd-input"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                required
              />
            </label>

            <div className={`alert ${error ? '' : 'hidden'}`}>{error}</div>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting
                ? isLogin
                  ? 'Entrando...'
                  : 'Creando...'
                : isLogin
                  ? 'Entrar'
                  : 'Crear cuenta'}
            </Button>
          </form>
        </div>
      </SurfaceCard>
    </section>
  );
}
