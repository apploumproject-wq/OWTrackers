import {
  ActivityRecord,
  CompanyRecord,
  EmployeeShiftState,
  FormTemplate,
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

export const INITIAL_FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'tpl-dossier-standard',
    name: 'Traitement Dossier Standard',
    description: 'Formulaire polyvalent pour qualification, statut et volume de pièces.',
    isPredefined: true,
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-05T08:00:00.000Z',
    createdByName: 'Système OWTrackers',
    fields: [
      {
        id: 'fld-std-cat',
        label: 'Catégorie du dossier',
        type: 'select',
        required: true,
        options: ['Nouveau dossier', 'Relance client', 'Mise à jour', 'Réclamation'],
        order: 1,
        active: true,
      },
      {
        id: 'fld-std-priority',
        label: 'Niveau de priorité',
        type: 'radio',
        required: true,
        options: ['Normale', 'Prioritaire', 'Urgente'],
        order: 2,
        active: true,
      },
      {
        id: 'fld-std-pieces',
        label: 'Nombre de pièces traitées',
        type: 'number',
        required: true,
        order: 3,
        active: true,
      },
      {
        id: 'fld-std-verif',
        label: 'Vérifications effectuées',
        type: 'checkbox',
        required: false,
        options: ['Identité vérifiée', 'Pièces lisibles', 'Accusé envoyé'],
        order: 4,
        active: true,
      },
      {
        id: 'fld-std-detail',
        label: 'Synthèse du traitement',
        type: 'long_text',
        required: false,
        order: 5,
        active: true,
      },
    ],
  },
  {
    id: 'tpl-devis-facturation',
    name: 'Devis & Facturation BPO',
    description: 'Suivi chiffré des devis, montants HT et validation commerciale.',
    isPredefined: true,
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-05T08:00:00.000Z',
    createdByName: 'Système OWTrackers',
    fields: [
      {
        id: 'fld-dev-num',
        label: 'Numéro de pièce comptable',
        type: 'short_text',
        required: true,
        order: 1,
        active: true,
      },
      {
        id: 'fld-dev-montant',
        label: 'Montant HT (€)',
        type: 'number',
        required: true,
        order: 2,
        active: true,
      },
      {
        id: 'fld-dev-echeance',
        label: 'Date d’échéance',
        type: 'date',
        required: false,
        order: 3,
        active: true,
      },
      {
        id: 'fld-dev-statut',
        label: 'Décision de validation',
        type: 'select',
        required: true,
        options: ['Validé', 'En attente de pièce', 'Refusé / À revoir'],
        order: 4,
        active: true,
      },
    ],
  },
  {
    id: 'tpl-support-multicanal',
    name: 'Support Client Multicanal',
    description: 'Qualification des tickets entrants, contact client et heure de rappel.',
    isPredefined: true,
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-05T08:00:00.000Z',
    createdByName: 'Système OWTrackers',
    fields: [
      {
        id: 'fld-sup-contact',
        label: 'E-mail du contact client',
        type: 'email',
        required: false,
        order: 1,
        active: true,
      },
      {
        id: 'fld-sup-motif',
        label: 'Motif principal',
        type: 'select',
        required: true,
        options: ['Information', 'Intervention', 'Facturation', 'Incident technique'],
        order: 2,
        active: true,
      },
      {
        id: 'fld-sup-rappel',
        label: 'Heure de rappel souhaitée',
        type: 'time',
        required: false,
        order: 3,
        active: true,
      },
      {
        id: 'fld-sup-actions',
        label: 'Actions réalisées',
        type: 'checkbox',
        required: true,
        options: ['Réponse apportée', 'Ticket escaladé', 'RDV planifié'],
        order: 4,
        active: true,
      },
    ],
  },
  {
    id: 'tpl-audit-conformite',
    name: 'Audit & Conformité Documentaire',
    description: 'Contrôle approfondi avec score de conformité et anomalies.',
    isPredefined: true,
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-05T08:00:00.000Z',
    createdByName: 'Système OWTrackers',
    fields: [
      {
        id: 'fld-aud-type',
        label: 'Type de contrôle',
        type: 'radio',
        required: true,
        options: ['Premier niveau', 'Contre-vérification', 'Audit complet'],
        order: 1,
        active: true,
      },
      {
        id: 'fld-aud-anomalies',
        label: 'Nombre d’anomalies détectées',
        type: 'number',
        required: true,
        order: 2,
        active: true,
      },
      {
        id: 'fld-aud-obs',
        label: 'Observations détaillées',
        type: 'long_text',
        required: false,
        order: 3,
        active: true,
      },
    ],
  },
];
