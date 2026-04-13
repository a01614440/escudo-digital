import CallSimulationActivity from './CallSimulationActivity.jsx';
import {
  ChecklistActivity,
  ConceptActivity,
  OpenAnswerActivity,
  QuizActivity,
} from './basicActivities.jsx';
import { InboxActivity, ScenarioFlowActivity, WebLabActivity } from './immersiveActivities.jsx';
import {
  CompareDomainsActivity,
  SignalHuntActivity,
  WhatsAppSimulation,
} from './signalActivities.jsx';

export const ACTIVITY_COMPONENTS = {
  concepto: ConceptActivity,
  quiz: QuizActivity,
  simulacion: QuizActivity,
  checklist: ChecklistActivity,
  abierta: OpenAnswerActivity,
  sim_chat: WhatsAppSimulation,
  compare_domains: CompareDomainsActivity,
  signal_hunt: SignalHuntActivity,
  inbox: InboxActivity,
  web_lab: WebLabActivity,
  call_sim: CallSimulationActivity,
  scenario_flow: ScenarioFlowActivity,
};

export const KNOWN_ACTIVITY_TYPES = Object.keys(ACTIVITY_COMPONENTS);

export function resolveActivityComponent(type) {
  return ACTIVITY_COMPONENTS[String(type || '').toLowerCase()] || ConceptActivity;
}
