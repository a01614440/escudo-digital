export const ROUTE_META = {
  auth: {
    id: 'auth',
    label: 'Acceso',
    shellIntent: 'focus',
    showHeader: false,
    allowChat: false,
    navigationTarget: null,
  },
  loading: {
    id: 'loading',
    label: 'Cargando',
    shellIntent: 'focus',
    showHeader: false,
    allowChat: false,
    navigationTarget: null,
  },
  survey: {
    id: 'survey',
    label: 'Encuesta',
    shellIntent: 'focus',
    showHeader: true,
    allowChat: true,
    navigationTarget: 'survey',
  },
  courses: {
    id: 'courses',
    label: 'Ruta',
    shellIntent: 'workspace',
    showHeader: true,
    allowChat: true,
    navigationTarget: 'courses',
  },
  lesson: {
    id: 'lesson',
    label: 'Curso en progreso',
    shellIntent: 'immersive',
    showHeader: false,
    allowChat: true,
    navigationTarget: 'courses',
  },
  admin: {
    id: 'admin',
    label: 'Panel interno',
    shellIntent: 'workspace',
    showHeader: true,
    allowChat: false,
    navigationTarget: 'admin',
  },
};

const BASE_NAV_ITEMS = [
  { id: 'survey', label: 'Encuesta' },
  { id: 'courses', label: 'Ruta' },
];

export function normalizeRequestedView(view, { isAdmin = false } = {}) {
  if (view === 'admin') return isAdmin ? 'admin' : null;
  if (view === 'lesson') return 'courses';
  if (view === 'courses' || view === 'survey') return view;
  return 'survey';
}

export function getRouteMeta(routeKey, { isAdmin = false } = {}) {
  const normalizedKey =
    routeKey === 'admin' && !isAdmin ? 'survey' : ROUTE_META[routeKey] ? routeKey : 'survey';

  return ROUTE_META[normalizedKey];
}

export function getActiveViewLabel(currentView, { isAdmin = false } = {}) {
  return getRouteMeta(currentView, { isAdmin }).label;
}

export function getNavigationItems({ currentView, isAdmin = false }) {
  const normalizedCurrentView = getRouteMeta(currentView, { isAdmin }).navigationTarget;
  const items = [...BASE_NAV_ITEMS];

  if (isAdmin) {
    items.push({ id: 'admin', label: 'Panel interno' });
  }

  return items.map((item) => ({
    ...item,
    active: item.id === normalizedCurrentView,
  }));
}

export function buildNavigationModel({ currentView, isAdmin = false, currentUser = null }) {
  const routeMeta = getRouteMeta(currentView, { isAdmin });

  return {
    currentRouteKey: routeMeta.id,
    activeViewLabel: routeMeta.label,
    activeNavigationTarget: routeMeta.navigationTarget,
    items: currentUser ? getNavigationItems({ currentView, isAdmin }) : [],
    showNavigation: Boolean(currentUser) && routeMeta.showHeader,
  };
}

export function shouldShowChat(currentView, { isAdmin = false } = {}) {
  return getRouteMeta(currentView, { isAdmin }).allowChat;
}
