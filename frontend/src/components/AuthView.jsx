import { getShellFamily } from '../hooks/useResponsiveLayout.js';
import { SplitHeroLayout } from '../layouts/index.js';
import { ActionCluster, PanelHeader, StageHero, StatStrip, SupportRail } from '../patterns/index.js';
import { Badge, Button, Field, InlineMessage, Input, Spinner, SurfaceCard } from './ui/index.js';

const ACCESS_STRIP = [
  {
    key: 'continuity',
    eyebrow: 'Continuidad',
    value: 'Sin reset',
    label: 'Recuperas tu punto exacto',
    hint: 'Encuesta, ruta y modulo vuelven contigo.',
    tone: 'accent',
  },
  {
    key: 'next',
    eyebrow: 'Salida',
    value: '1 paso',
    label: 'Entrar y seguir',
    hint: 'La cuenta te manda al siguiente punto correcto.',
    tone: 'neutral',
  },
];

const ACCESS_SUPPORT = [
  {
    title: 'La cuenta guarda tu avance',
    body: 'No vuelves a decidir manualmente si toca encuesta, ruta o modulo.',
  },
  {
    title: 'La reentrada es directa',
    body: 'El sistema retoma desde el mismo estado que dejaste guardado.',
  },
];

const ACCESS_MODE_COPY = {
  login: {
    heroEyebrow: 'Reentrada',
    heroTitle: 'Vuelves directo a tu avance.',
    heroSubtitle:
      'Accedes, recuperas contexto y sigues donde te habias quedado sin ruido extra.',
    panelEyebrow: 'Iniciar sesion',
    panelTitle: 'Entrar y retomar',
    panelSubtitle: 'Usa tu correo para recuperar tu ruta, tu progreso y el modulo que sigue.',
    cta: 'Entrar y retomar',
    loadingTitle: 'Restaurando tu avance',
    loadingBody: 'Estamos sincronizando sesion, diagnostico y continuidad.',
  },
  register: {
    heroEyebrow: 'Alta persistente',
    heroTitle: 'Creas una cuenta y el avance deja de ser fragil.',
    heroSubtitle:
      'Desde este acceso quedan guardados tu diagnostico, tu ruta y el punto exacto al que debes volver.',
    panelEyebrow: 'Crear cuenta',
    panelTitle: 'Abrir tu acceso',
    panelSubtitle: 'Desde aqui dejas lista la cuenta que va a conservar tu continuidad.',
    cta: 'Crear cuenta',
    loadingTitle: 'Preparando tu cuenta',
    loadingBody: 'Estamos creando el acceso y dejando lista la persistencia.',
  },
};

function AccessHero({ shellFamily, isLogin }) {
  const copy = ACCESS_MODE_COPY[isLogin ? 'login' : 'register'];

  return (
    <StageHero
      tone="editorial"
      eyebrow={copy.heroEyebrow}
      title={copy.heroTitle}
      subtitle={copy.heroSubtitle}
      actions={<Badge tone="accent">{isLogin ? 'Reentrada con continuidad' : 'Alta con continuidad'}</Badge>}
      meta={shellFamily === 'mobile' ? 'Una sola accion visible' : 'Contexto breve antes de acceder'}
      footer={<StatStrip items={ACCESS_STRIP} compact={shellFamily === 'mobile'} variant="support" />}
    />
  );
}

function AccessConsole({
  shellFamily,
  isLogin,
  error,
  submitting,
  email,
  password,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  const copy = ACCESS_MODE_COPY[isLogin ? 'login' : 'register'];

  return (
    <SurfaceCard padding="lg" variant="raised" className="border-sd-border-strong">
      <div className="grid gap-5">
        <PanelHeader
          eyebrow={copy.panelEyebrow}
          title={copy.panelTitle}
          subtitle={copy.panelSubtitle}
          divider
        />

        <ActionCluster align="start" collapse="wrap">
          <Button
            variant={isLogin ? 'primary' : 'quiet'}
            active={isLogin}
            type="button"
            onClick={() => onModeChange('login')}
          >
            Iniciar sesion
          </Button>
          <Button
            variant={!isLogin ? 'primary' : 'quiet'}
            active={!isLogin}
            type="button"
            onClick={() => onModeChange('register')}
          >
            Crear cuenta
          </Button>
        </ActionCluster>

        {error ? (
          <InlineMessage tone="danger" title="No pudimos completar el acceso.">
            {error}
          </InlineMessage>
        ) : (
          <InlineMessage tone={submitting ? 'success' : 'info'} title={submitting ? copy.loadingTitle : 'Continuidad intacta'}>
            {submitting
              ? copy.loadingBody
              : 'Tu cuenta recupera encuesta, ruta y progreso sin obligarte a navegar otra vez.'}
          </InlineMessage>
        )}

        <form className="grid gap-5" onSubmit={onSubmit}>
          <Field label="Correo electronico" required>
            <Input
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
            />
          </Field>

          <Field label="Contrasena" required>
            <Input
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="Minimo 6 caracteres"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
            />
          </Field>

          {submitting ? (
            <SurfaceCard
              padding="compact"
              variant="command"
              className="shadow-[0_28px_80px_-42px_rgba(16,33,61,0.9)] [&_.text-sd-text]:text-white [&_.text-sd-muted]:text-white/76"
            >
              <div className="flex items-start gap-4">
                <Spinner size="lg" />
                <div className="grid gap-2">
                  <strong className="text-base text-white">{copy.loadingTitle}</strong>
                  <p className="m-0 text-sm leading-6 text-white/76">{copy.loadingBody}</p>
                </div>
              </div>
            </SurfaceCard>
          ) : null}

          <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
            <Button variant="primary" size="lg" type="submit" loading={submitting}>
              {submitting ? 'Procesando...' : copy.cta}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => onModeChange(isLogin ? 'register' : 'login')}
            >
              {isLogin ? 'Prefiero crear cuenta' : 'Ya tengo cuenta'}
            </Button>
          </ActionCluster>
        </form>
      </div>
    </SurfaceCard>
  );
}

function AccessSupportBand({ shellFamily }) {
  return (
    <SupportRail
      tone={shellFamily === 'desktop' ? 'editorial' : 'support'}
      sticky={shellFamily === 'desktop'}
      eyebrow="Que conserva esta cuenta"
      title="Menos ruido, mas continuidad"
      subtitle="Solo dejamos visible lo que realmente importa antes de entrar."
    >
      <div className="grid gap-3">
        {ACCESS_SUPPORT.map((item) => (
          <SurfaceCard key={item.title} padding="compact" variant="subtle">
            <strong className="block text-sm text-sd-text">{item.title}</strong>
            <p className="mt-2 mb-0 text-sm leading-6 text-sd-muted">{item.body}</p>
          </SurfaceCard>
        ))}
      </div>
    </SupportRail>
  );
}

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
  const shellFamily = getShellFamily(viewport);
  const isLogin = mode === 'login';

  return (
    <section
      id="authView"
      className="sd-page-shell py-[var(--sd-shell-padding-block)]"
      data-sd-container="true"
    >
      <SplitHeroLayout
        shellFamily={shellFamily}
        className={
          shellFamily === 'tablet'
            ? 'md:grid-cols-[minmax(0,1.08fr)_minmax(23rem,0.92fr)]'
            : shellFamily === 'desktop'
              ? 'xl:grid-cols-[minmax(0,1.2fr)_minmax(26rem,0.88fr)] 2xl:grid-cols-[minmax(0,1.26fr)_minmax(27rem,0.84fr)]'
              : ''
        }
        hero={<AccessHero shellFamily={shellFamily} isLogin={isLogin} />}
        primary={
          <AccessConsole
            shellFamily={shellFamily}
            isLogin={isLogin}
            error={error}
            submitting={submitting}
            email={email}
            password={password}
            onModeChange={onModeChange}
            onEmailChange={onEmailChange}
            onPasswordChange={onPasswordChange}
            onSubmit={onSubmit}
          />
        }
        secondary={<AccessSupportBand shellFamily={shellFamily} />}
      />
    </section>
  );
}
