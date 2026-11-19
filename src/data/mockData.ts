import {
  ActivityRecord,
  CompanyRecord,
  EmployeeShiftState,
  GlobalAdminConfig,
  QualityCriterionConfig,
  ReferenceTimeEntry,
  TaskRecord,
} from '../core/types';

export const INITIAL_ADMIN_CONFIG: GlobalAdminConfig = {
  lunchBreakMinutes: 60,
  morningBreakMinutes: 20,
  afternoonBreakMinutes: 20,
  lateToleranceMinutes: 5,
};

/**
 * Référentiel initial des sociétés clientes.
 */
export const INITIAL_COMPANIES: CompanyRecord[] = [
  { id: 'comp-couverture', name: 'Société Couverture', archived: false, createdAt: '2026-01-05T08:00:00.000Z' },
  { id: 'comp-plomberie', name: 'Société Plomberie', archived: false, createdAt: '2026-01-05T08:00:00.000Z' },
  { id: 'comp-fumisterie', name: 'Société Fumisterie', archived: false, createdAt: '2026-01-05T08:00:00.000Z' },
];

/**
 * Référentiel initial des types de tâches.
 */
export const INITIAL_TASKS: TaskRecord[] = [
  { id: 'task-saisie-mail', name: 'Saisie mail', archived: false, createdAt: '2026-01-05T08:00:00.000Z' },
  { id: 'task-association-doc', name: 'Association document', archived: false, createdAt: '2026-01-05T08:00:00.000Z' },
  { id: 'task-redaction-devis', name: 'Rédaction devis', archived: false, createdAt: '2026-01-05T08:00:00.000Z' },
  { id: 'task-redaction-facture', name: 'Rédaction facture', archived: false, createdAt: '2026-01-05T08:00:00.000Z' },
  { id: 'task-ponctuelle', name: 'Tâche ponctuelle', archived: false, createdAt: '2026-01-05T08:00:00.000Z' },
];

export const INITIAL_COMPANY_TASK_MAP: Record<string, string[]> = {
  'comp-couverture': INITIAL_TASKS.map((t) => t.id),
  'comp-plomberie': INITIAL_TASKS.map((t) => t.id),
  'comp-fumisterie': INITIAL_TASKS.map((t) => t.id),
};

export const INITIAL_REFERENCE_TIMES: ReferenceTimeEntry[] = [
  { id: 'ref-1', companyId: 'comp-couverture', taskId: 'task-saisie-mail', referenceMinutes: 8 },
  { id: 'ref-2', companyId: 'comp-couverture', taskId: 'task-association-doc', referenceMinutes: 6 },
  { id: 'ref-3', companyId: 'comp-couverture', taskId: 'task-redaction-devis', referenceMinutes: 18 },
  { id: 'ref-4', companyId: 'comp-couverture', taskId: 'task-redaction-facture', referenceMinutes: 12 },
  { id: 'ref-5', companyId: 'comp-couverture', taskId: 'task-ponctuelle', referenceMinutes: 15 },
  { id: 'ref-6', companyId: 'comp-plomberie', taskId: 'task-saisie-mail', referenceMinutes: 7 },
  { id: 'ref-7', companyId: 'comp-plomberie', taskId: 'task-association-doc', referenceMinutes: 5 },
  { id: 'ref-8', companyId: 'comp-plomberie', taskId: 'task-redaction-devis', referenceMinutes: 16 },
  { id: 'ref-9', companyId: 'comp-plomberie', taskId: 'task-redaction-facture', referenceMinutes: 11 },
  { id: 'ref-10', companyId: 'comp-plomberie', taskId: 'task-ponctuelle', referenceMinutes: 14 },
  { id: 'ref-11', companyId: 'comp-fumisterie', taskId: 'task-saisie-mail', referenceMinutes: 9 },
  { id: 'ref-12', companyId: 'comp-fumisterie', taskId: 'task-association-doc', referenceMinutes: 7 },
  { id: 'ref-13', companyId: 'comp-fumisterie', taskId: 'task-redaction-devis', referenceMinutes: 20 },
  { id: 'ref-14', companyId: 'comp-fumisterie', taskId: 'task-redaction-facture', referenceMinutes: 13 },
  { id: 'ref-15', companyId: 'comp-fumisterie', taskId: 'task-ponctuelle', referenceMinutes: 15 },
];

export const INITIAL_QUALITY_CRITERIA: QualityCriterionConfig[] = [
  { id: 'crit-1', label: 'Exactitude des informations', active: true },
  { id: 'crit-2', label: 'Respect des consignes', active: true },
  { id: 'crit-3', label: 'Qualité de rédaction', active: true },
  { id: 'crit-4', label: 'Bonne association des documents', active: true },
  { id: 'crit-5', label: 'Respect des procédures', active: true },
];

export function createInitialEmployeeShiftState(userId: string): EmployeeShiftState {
  return {
    userId,
    serviceStatus: 'absent',
    shiftStartTime: null,
    shiftEndTime: null,
    presenceSecondsBase: 0,
    presenceAnchorAt: null,
    productiveSecondsBase: 0,
    pauseSecondsBase: 0,
    outingSecondsBase: 0,
    activeTimer: null,
  };
}

export function createInitialActivitiesForUser(_userId: string): ActivityRecord[] {
  return [];
}
