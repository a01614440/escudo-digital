export const STORAGE_KEYS = {
  session: 'escudo_session_v1',
  assessment: 'escudo_assessment_v1',
  answers: 'escudo_answers_v1',
  coursePlan: 'escudo_course_plan_v4',
  courseProgress: 'escudo_course_progress_v4',
  theme: 'escudo_theme_v1',
};

export const PRESENTATION_THEME = 'light';

export const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const clearLocalState = () => {
  try {
    [
      STORAGE_KEYS.answers,
      STORAGE_KEYS.assessment,
      STORAGE_KEYS.coursePlan,
      STORAGE_KEYS.courseProgress,
    ].forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
};

export const readSessionToken = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.session) || '';
  } catch {
    return '';
  }
};

export const writeSessionToken = (token) => {
  try {
    if (token) localStorage.setItem(STORAGE_KEYS.session, token);
    else localStorage.removeItem(STORAGE_KEYS.session);
  } catch {
    // ignore
  }
};

export const readThemePreference = () => {
  try {
    if (localStorage.getItem(STORAGE_KEYS.theme) === 'dark') {
      localStorage.setItem(STORAGE_KEYS.theme, PRESENTATION_THEME);
    }
    return PRESENTATION_THEME;
  } catch {
    return PRESENTATION_THEME;
  }
};

export const writeThemePreference = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, PRESENTATION_THEME);
  } catch {
    // ignore
  }
};

export const readLocalState = () => ({
  answers: safeJsonParse(localStorage.getItem(STORAGE_KEYS.answers)) || {},
  assessment: safeJsonParse(localStorage.getItem(STORAGE_KEYS.assessment)),
  coursePlan: safeJsonParse(localStorage.getItem(STORAGE_KEYS.coursePlan)),
  courseProgress: safeJsonParse(localStorage.getItem(STORAGE_KEYS.courseProgress)),
});

export const writeLocalState = ({ answers, assessment, coursePlan, courseProgress }) => {
  try {
    localStorage.setItem(STORAGE_KEYS.answers, JSON.stringify(answers || {}));

    if (assessment) localStorage.setItem(STORAGE_KEYS.assessment, JSON.stringify(assessment));
    else localStorage.removeItem(STORAGE_KEYS.assessment);

    if (coursePlan) localStorage.setItem(STORAGE_KEYS.coursePlan, JSON.stringify(coursePlan));
    else localStorage.removeItem(STORAGE_KEYS.coursePlan);

    if (courseProgress) {
      localStorage.setItem(STORAGE_KEYS.courseProgress, JSON.stringify(courseProgress));
    } else {
      localStorage.removeItem(STORAGE_KEYS.courseProgress);
    }
  } catch {
    // ignore
  }
};
