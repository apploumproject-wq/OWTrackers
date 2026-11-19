/**
 * Modèles de domaine d'OWTrackers.
 * Architecture prête pour l'intégration future d'un backend sécurisé,
 * de PostgreSQL et d'une infrastructure hybride Cloud + serveur interne.
 */

export type UserRole = 'admin' | 'manager' | 'supervisor' | 'employee';

export type ThemeMode = 'light' | 'dark';

export type AccountStatus = 'actif' | 'desactive' | 'archive';

export type ServiceStatus =
  | 'present'
  | 'in_treatment'
  | 'paused'
  | 'in_outing'
  | 'absent';

export type Permission =
  | 'view:own_dashboard'
  | 'execute:treatments'
  | 'view:own_activities'
  | 'view:own_history'
  | 'view:own_stats'
  | 'view:own_profile'
  | 'view:management_dashboard'
  | 'manage:employees'
  | 'manage:teams'
  | 'manage:clients'
  | 'manage:tasks'
  | 'manage:schedules'
  | 'manage:quality'
  | 'view:objectives_stats'
  | 'export:reports'
  | 'manage:settings_permissions'
  | 'approve:outings';

export type NavModuleId =
  | 'employee_home'
  | 'employee_treatment'
  | 'employee_activities'
  | 'employee_history'
  | 'employee_stats'
  | 'profile'
  | 'mgmt_dashboard'
  | 'mgmt_employees'
  | 'mgmt_teams'
  | 'mgmt_clients'
  | 'mgmt_tasks'
  | 'mgmt_schedules'
  | 'mgmt_quality'
  | 'mgmt_objectives'
  | 'mgmt_reports'
  | 'mgmt_settings';

export interface AppUser {
  id: string;
  username?: string;
  matricule?: string;
  fullName: string;
  email?: string;
  role: UserRole;
  isPrimaryAdmin?: boolean;
  jobTitle: string;
  site: string;
  teamId?: string;
  teamName?: string;
  perimeterName: string;
  supervisorName?: string;
  managerName?: string;
  plannedSchedule: string;
  dailyTargetDossiers?: number;
  hireDate: string;
}

export interface ManagedEmployee {
  id: string;
  username?: string;
  matricule?: string;
  fullName: string;
  email?: string;
  role: UserRole;
  isPrimaryAdmin?: boolean;
  passwordHash?: string;
  jobTitle?: string;
  hireDate?: string;
  accountStatus: AccountStatus;
  site: string;
  teamId: string;
  supervisorId: string;
  plannedStart: string;
  plannedEnd: string;
  restDays: string[];
  dailyTargetDossiers?: number;
  status: ServiceStatus;
  dossiersToday: number;
  presenceSecondsToday: number;
  productiveSecondsToday: number;
  pauseSecondsToday: number;
}

export interface TeamRecord {
  id: string;
  name: string;
  site: string;
  supervisorId: string;
  supervisorName: string;
  defaultCompanyId: string;
  productivityRate: number;
  qualityScore: number;
}

export interface CompanyRecord {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
}

export interface ReferenceTimeEntry {
  id: string;
  companyId: string;
  taskId: string;
  referenceMinutes: number;
}

export type ObjectivePeriod = 'jour' | 'semaine' | 'mois';

export interface ProductionObjective {
  id: string;
  scopeType: 'employee' | 'team';
  scopeId: string;
  companyId: string; // 'all' ou id société
  taskId: string; // 'all' ou id tâche
  period: ObjectivePeriod;
  targetDossiers: number;
}

export type QualityStatus =
  | 'en_attente'
  | 'valide'
  | 'valide_observation'
  | 'a_corriger'
  | 'rejete';

export type CriterionRating = 'conforme' | 'non_conforme' | 'non_applicable';

export interface QualityCriterionConfig {
  id: string;
  label: string;
  active: boolean;
}

export interface QualityCriterionResult {
  criterionId: string;
  label: string;
  rating: CriterionRating;
}

export interface QualityControlRecord {
  id: string;
  activityId: string;
  dossierRef: string;
  employeeId: string;
  employeeName: string;
  teamId: string;
  companyId: string;
  companyName: string;
  taskId: string;
  taskName: string;
  treatedAt: string;
  durationSeconds: number;
  receptionChannel?: ReceptionChannel;
  status: QualityStatus;
  criteriaResults: QualityCriterionResult[];
  observations: string;
  controllerName?: string;
  controlledAt?: string;
}

export interface CorrectionRequest {
  id: string;
  activityId: string;
  dossierRef: string;
  activityLabel: string;
  employeeId: string;
  employeeName: string;
  teamId: string;
  reason: string;
  requestedAt: string;
  status: 'en_attente' | 'approuvee' | 'refusee';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  entity: string;
  oldValue: string;
  newValue: string;
  reason?: string;
}

export type ActivityType = 'traitement' | 'pause' | 'sortie';
export type ReceptionChannel = 'Mail' | 'Teams';
export type PauseSlot = 'pause_matin' | 'pause_apres_midi' | 'pause_dejeuner';

export type OutingReason =
  | 'sortie_medecin'
  | 'sortie_personnelle'
  | 'reunion'
  | 'probleme_connexion'
  | 'probleme_technique'
  | 'autre';

export type AuthorizationStatus =
  | 'non_requise'
  | 'en_attente'
  | 'approuvee'
  | 'refusee';

export type SyncStatus = 'local_en_attente' | 'synchronise';

export interface ActiveTimerSession {
  id: string;
  type: ActivityType;
  startedAt: string;
  taskId?: string;
  taskTitle: string;
  companyId?: string;
  clientName: string;
  notes: string;
  receptionChannel?: ReceptionChannel;
  receptionDateTime?: string;
  recipientEmail?: string;
  teamsRequesterName?: string;
  dossierRef?: string;
  pauseSlot?: PauseSlot;
  allowedDurationMinutes?: number;
  outingReason?: OutingReason;
  customReason?: string;
  authorizationStatus?: AuthorizationStatus;
  authorizationRequestId?: string;
}

export interface ActivityRecord {
  id: string;
  userId: string;
  type: ActivityType;
  taskId?: string;
  taskTitle: string;
  companyId?: string;
  clientName: string;
  dossierRef: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  status: 'termine' | 'en_controle' | 'valide';
  syncStatus: SyncStatus;
  notes?: string;
  receptionChannel?: ReceptionChannel;
  receptionDateTime?: string;
  recipientEmail?: string;
  teamsRequesterName?: string;
  pauseSlot?: PauseSlot;
  allowedDurationMinutes?: number;
  overtimeSeconds?: number;
  outingReason?: OutingReason;
  customReason?: string;
  authorizationStatus?: AuthorizationStatus;
  authorizationRequestId?: string;
}

export interface EmployeeShiftState {
  userId: string;
  serviceStatus: ServiceStatus;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  presenceSecondsBase: number;
  presenceAnchorAt: string | null;
  productiveSecondsBase: number;
  pauseSecondsBase: number;
  outingSecondsBase: number;
  activeTimer: ActiveTimerSession | null;
}

export interface EmployeeScheduleConfig {
  userId: string;
  employeeName: string;
  matricule: string;
  teamId: string;
  teamName: string;
  plannedStart: string;
  plannedEnd: string;
  restDays: string[];
  isCustom: boolean;
  exceptionNote?: string;
}

export interface GlobalAdminConfig {
  lunchBreakMinutes: number;
  morningBreakMinutes: number;
  afternoonBreakMinutes: number;
  lateToleranceMinutes: number;
}

export interface OutingAuthorizationRequest {
  id: string;
  userId: string;
  employeeName: string;
  teamId: string;
  reason: Extract<OutingReason, 'sortie_medecin' | 'sortie_personnelle'>;
  details: string;
  requestedAt: string;
  plannedWindow: string;
  status: Extract<AuthorizationStatus, 'en_attente' | 'approuvee' | 'refusee'>;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DailyHistoryEntry {
  id: string;
  userId: string;
  date: string;
  plannedStart: string;
  plannedEnd: string;
  shiftStart: string;
  shiftEnd: string;
  presenceSeconds: number;
  productiveSeconds: number;
  pauseSeconds: number;
  outingSeconds: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  dossiersCount: number;
  targetDossiers: number;
  qualityScore: number;
}
