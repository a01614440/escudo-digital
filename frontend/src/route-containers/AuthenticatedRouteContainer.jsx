import AdminView from '../components/AdminView.jsx';
import CoursesView from '../components/CoursesView.jsx';
import LessonView from '../components/LessonView.jsx';
import SurveyView from '../components/SurveyView.jsx';
import RouteContainer from './RouteContainer.jsx';

export default function AuthenticatedRouteContainer({
  shellFamily,
  viewport,
  currentView,
  isAdmin,
  routeMeta,
  surveyProps,
  coursesProps,
  lessonProps,
  adminProps,
}) {
  let routeKey = currentView;
  let content = null;

  if (currentView === 'survey') {
    content = <SurveyView viewport={viewport} currentView={currentView} {...surveyProps} />;
  } else if (currentView === 'courses') {
    content = <CoursesView viewport={viewport} currentView={currentView} {...coursesProps} />;
  } else if (currentView === 'lesson') {
    content = <LessonView viewport={viewport} {...lessonProps} />;
  } else if (currentView === 'admin' && isAdmin) {
    content = <AdminView viewport={viewport} {...adminProps} />;
  }

  if (!content) {
    routeKey = 'survey';
    content = <SurveyView viewport={viewport} currentView="survey" {...surveyProps} />;
  }

  return (
    <RouteContainer
      routeKey={routeKey}
      shellFamily={shellFamily}
      intent={routeMeta?.shellIntent || 'workspace'}
      scope="authenticated"
    >
      {content}
    </RouteContainer>
  );
}
