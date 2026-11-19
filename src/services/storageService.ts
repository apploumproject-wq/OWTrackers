import {
  AccountStatus,
  ActiveTimerSession,
  ActivityRecord,
  AppUser,
  AuditLogEntry,
  AuthorizationStatus,
  CompanyRecord,
  CorrectionRequest,
  EmployeeScheduleConfig,
  EmployeeShiftState,
  GlobalAdminConfig,
  ManagedEmployee,
  OutingAuthorizationRequest,
  OutingReason,
  PauseSlot,
  Permission,
  ProductionObjective,
  QualityControlRecord,
  QualityCriterionConfig,
  QualityCriterionResult,
  QualityStatus,
  ReceptionChannel,
  ReferenceTimeEntry,
  ServiceStatus,
  TaskRecord,
  TeamRecord,
  ThemeMode,
  UserRole,
} from '../core/types';
import {
  BASE_ROLE_PERMISSIONS,
  OUTING_REASON_CONFIG,
  PAUSE_SLOT_LABELS,
  ROLE_LABELS,
} from '../core/permissions';
import {
  createInitialActivitiesForUser,
  createInitialEmployeeShiftState,
  INITIAL_ADMIN_CONFIG,
  INITIAL_COMPANIES,
  INITIAL_COMPANY_TASK_MAP,
  INITIAL_QUALITY_CRITERIA,
  INITIAL_REFERENCE_TIMES,
  INITIAL_TASKS,
} from '../data/mockData';
import { hashPassword, isValidEmail, verifyPassword } from '../utils/crypto';
import {
  generateUniqueId,
  isSameDayYmd,
  toLocalDateTimeInputValue,
  toYmd,
} from '../utils/formatters';

export const clockService = {
  nowMs(): number {
    return Date.now();
  },
  nowIso(): string {
    return new Date(this.nowMs()).toISOString();
  },
};

const STORAGE_KEYS = {
  LEGACY_PURGED_V2: 'owtrackers_legacy_demo_purged_v2',
  SYSTEM_INITIALIZED: 'owtrackers_system_initialized_v1',
  SESSION_USER_ID: 'owtrackers_session_user_id_v2',
  SHIFT_STATE_PREFIX: 'owtrackers_shift_v2_',
  ACTIVITIES_PREFIX: 'owtrackers_activities_v3_',
  ADMIN_CONFIG: 'owtrackers_admin_config_v1',
  SCHEDULES: 'owtrackers_schedules_v2',
  OUTING_REQUESTS: 'owtrackers_outing_requests_v2',
  COMPANIES: 'owtrackers_companies_v1',
  TASKS: 'owtrackers_tasks_v1',
  COMPANY_TASK_MAP: 'owtrackers_company_task_map_v1',
  ACCOUNTS: 'owtrackers_accounts_v2',
  TEAMS: 'owtrackers_teams_v2',
  SUPERVISOR_PERMS: 'owtrackers_supervisor_perms_v1',
  REFERENCE_TIMES: 'owtrackers_ref_times_v1',
  OBJECTIVES: 'owtrackers_objectives_v2',
  QUALITY_CRITERIA: 'owtrackers_qc_criteria_v1',
  QUALITY_CONTROLS: 'owtrackers_qc_records_v2',
  CORRECTION_REQUESTS: 'owtrackers_correction_requests_v2',
  AUDIT_LOGS: 'owtrackers_audit_logs_v2',
  THEME_USER_PREFIX: 'owtrackers_theme_user_v1_',
  LAST_THEME: 'owtrackers_last_theme_v1',
};

function purgeLegacyDemoStorageIfNeeded(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(STORAGE_KEYS.LEGACY_PURGED_V2) === 'true') return;
    const legacyKeys = [
      'owtrackers_demo_user_id_v1',
      'owtrackers_employees_v1',
      'owtrackers_teams_v1',
      'owtrackers_schedules_v1',
      'owtrackers_outing_requests_v1',
      'owtrackers_objectives_v1',
      'owtrackers_qc_records_v1',
      'owtrackers_correction_requests_v1',
      'owtrackers_audit_logs_v1',
      'owtrackers_shift_v2_usr-emp-01',
      'owtrackers_shift_v2_usr-sup-01',
      'owtrackers_shift_v2_usr-mgr-01',
      'owtrackers_shift_v2_usr-adm-01',
      'owtrackers_activities_v3_usr-emp-01',
      'owtrackers_theme_user_v1_usr-emp-01',
      'owtrackers_theme_user_v1_usr-sup-01',
      'owtrackers_theme_user_v1_usr-mgr-01',
      'owtrackers_theme_user_v1_usr-adm-01',
    ];
    legacyKeys.forEach((k) => window.localStorage.removeItem(k));
    window.localStorage.setItem(STORAGE_KEYS.LEGACY_PURGED_V2, 'true');
  } catch {
    // Ignore storage access errors
  }
}

purgeLegacyDemoStorageIfNeeded();

function safeReadJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota issues
  }
}

function buildAppUser(
  account: ManagedEmployee,
  teams: TeamRecord[],
  accounts: ManagedEmployee[]
): AppUser {
  const team = account.teamId ? teams.find((t) => t.id === account.teamId) : undefined;
  const supervisor = account.supervisorId
    ? accounts.find((u) => u.id === account.supervisorId)
    : undefined;
  const activeManager = accounts.find((u) => u.role === 'manager' && u.accountStatus === 'actif');

  const defaultJobTitle = account.isPrimaryAdmin
    ? 'Administrateur principal'
    : ROLE_LABELS[account.role];

  const defaultPerimeter =
    account.role === 'admin'
      ? 'Entreprise complète'
      : account.role === 'manager'
      ? 'Multi-équipes'
      : team?.name ?? account.site;

  return {
    id: account.id,
    matricule: account.matricule,
    fullName: account.fullName,
    email: account.email,
    role: account.role,
    isPrimaryAdmin: account.isPrimaryAdmin,
    jobTitle: account.jobTitle?.trim() || defaultJobTitle,
    site: account.site,
    teamId: account.teamId || undefined,
    teamName: team?.name,
    perimeterName: defaultPerimeter,
    supervisorName: supervisor?.fullName,
    managerName: account.role === 'employee' || account.role === 'supervisor' ? activeManager?.fullName : undefined,
    plannedSchedule: `${account.plannedStart} – ${account.plannedEnd}`,
    dailyTargetDossiers: account.dailyTargetDossiers,
    hireDate: account.hireDate ?? toYmd(new Date()),
  };
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  jobTitle?: string;
  site: string;
  teamId?: string;
  supervisorId?: string;
  plannedStart?: string;
  plannedEnd?: string;
  restDays?: string[];
  dailyTargetDossiers?: number;
}

export const storageService = {
  // --- Initialisation & Authentification ---
  getUsers(): ManagedEmployee[] {
    const existing = safeReadJson<ManagedEmployee[]>(STORAGE_KEYS.ACCOUNTS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, []);
    return [];
  },

  hasAnyAdmin(): boolean {
    return this.getUsers().some((u) => u.role === 'admin');
  },

  isSystemInitialized(): boolean {
    try {
      const flag = window.localStorage.getItem(STORAGE_KEYS.SYSTEM_INITIALIZED) === 'true';
      return flag && this.hasAnyAdmin();
    } catch {
      return this.hasAnyAdmin();
    }
  },

  generateNextMatricule(): string {
    const users = this.getUsers();
    let maxNum = 0;
    for (const u of users) {
      const match = /^OW-(\d+)$/i.exec(u.matricule.trim());
      if (match) {
        const val = parseInt(match[1], 10);
        if (!Number.isNaN(val) && val > maxNum) {
          maxNum = val;
        }
      }
    }
    const nextNum = maxNum + 1;
    return `OW-${String(nextNum).padStart(4, '0')}`;
  },

  async initializePrimaryAdmin(payload: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<{ user?: AppUser; error?: string }> {
    const flagAlreadySet =
      typeof window !== 'undefined' &&
      window.localStorage.getItem(STORAGE_KEYS.SYSTEM_INITIALIZED) === 'true';

    if (flagAlreadySet || this.hasAnyAdmin()) {
      return {
        error:
          'L’initialisation est définitivement verrouillée : un administrateur principal existe déjà.',
      };
    }

    const fullName = payload.fullName.trim();
    const email = payload.email.trim().toLowerCase();
    const password = payload.password;

    if (fullName.length < 2) {
      return { error: 'Veuillez renseigner le nom et le prénom.' };
    }
    if (!isValidEmail(email)) {
      return { error: 'Veuillez saisir une adresse e-mail valide.' };
    }
    if (password.length < 8) {
      return { error: 'Le mot de passe doit contenir au moins 8 caractères.' };
    }

    const passwordHash = await hashPassword(password);
    const matricule = this.generateNextMatricule();
    const todayYmd = toYmd(new Date(clockService.nowMs()));

    const primaryAdmin: ManagedEmployee = {
      id: generateUniqueId('usr'),
      matricule,
      fullName,
      email,
      role: 'admin',
      isPrimaryAdmin: true,
      passwordHash,
      jobTitle: 'Administrateur principal',
      hireDate: todayYmd,
      accountStatus: 'actif',
      site: 'Direction',
      teamId: '',
      supervisorId: '',
      plannedStart: '08:30',
      plannedEnd: '18:00',
      restDays: ['Samedi', 'Dimanche'],
      dailyTargetDossiers: 0,
      status: 'absent',
      dossiersToday: 0,
      presenceSecondsToday: 0,
      productiveSecondsToday: 0,
      pauseSecondsToday: 0,
    };

    const existingUsers = this.getUsers();
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, [primaryAdmin, ...existingUsers]);
    window.localStorage.setItem(STORAGE_KEYS.SYSTEM_INITIALIZED, 'true');
    this.setSessionUser(primaryAdmin.id);

    const appUser = buildAppUser(primaryAdmin, this.getTeams(), [primaryAdmin, ...existingUsers]);
    this.appendAuditLog(
      appUser,
      'Initialisation plateforme',
      'Aucun administrateur',
      `${primaryAdmin.fullName} (${primaryAdmin.matricule})`,
      'Création du premier administrateur principal'
    );

    return { user: appUser };
  },

  async authenticateUser(
    identifier: string,
    password: string
  ): Promise<{ user?: AppUser; error?: string }> {
    const normalized = identifier.trim().toLowerCase();
    if (!normalized || !password) {
      return { error: 'Veuillez saisir votre identifiant et votre mot de passe.' };
    }

    const accounts = this.getUsers();
    const account = accounts.find(
      (u) =>
        u.matricule.trim().toLowerCase() === normalized ||
        u.email.trim().toLowerCase() === normalized
    );

    if (!account || !account.passwordHash) {
      return { error: 'Identifiant ou mot de passe incorrect.' };
    }

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      return { error: 'Identifiant ou mot de passe incorrect.' };
    }

    if (account.accountStatus !== 'actif') {
      return {
        error:
          account.accountStatus === 'archive'
            ? 'Ce compte est archivé. Contactez un administrateur.'
            : 'Ce compte est désactivé. Contactez un administrateur.',
      };
    }

    this.setSessionUser(account.id);
    const appUser = buildAppUser(account, this.getTeams(), accounts);
    return { user: appUser };
  },

  getSessionUser(): AppUser | null {
    const savedId = window.localStorage.getItem(STORAGE_KEYS.SESSION_USER_ID);
    if (!savedId) return null;
    const accounts = this.getUsers();
    const found = accounts.find((u) => u.id === savedId);
    if (!found || found.accountStatus !== 'actif') {
      this.setSessionUser(null);
      return null;
    }
    return buildAppUser(found, this.getTeams(), accounts);
  },

  setSessionUser(userId: string | null): void {
    if (!userId) {
      window.localStorage.removeItem(STORAGE_KEYS.SESSION_USER_ID);
    } else {
      window.localStorage.setItem(STORAGE_KEYS.SESSION_USER_ID, userId);
    }
  },

  // --- Thème par utilisateur (clair / sombre) ---
  getUserTheme(userId: string): ThemeMode {
    try {
      const saved = window.localStorage.getItem(`${STORAGE_KEYS.THEME_USER_PREFIX}${userId}`);
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  },

  setUserTheme(userId: string, theme: ThemeMode): ThemeMode {
    try {
      window.localStorage.setItem(`${STORAGE_KEYS.THEME_USER_PREFIX}${userId}`, theme);
      window.localStorage.setItem(STORAGE_KEYS.LAST_THEME, theme);
    } catch {
      // Ignore quota issues
    }
    this.applyThemeToDocument(theme);
    return theme;
  },

  getFallbackTheme(): ThemeMode {
    try {
      const savedId = window.localStorage.getItem(STORAGE_KEYS.SESSION_USER_ID);
      if (savedId) {
        return this.getUserTheme(savedId);
      }
      const last = window.localStorage.getItem(STORAGE_KEYS.LAST_THEME);
      return last === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  },

  applyThemeToDocument(theme: ThemeMode): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  },

  // --- Audit / Traçabilité ---
  getAuditLogs(): AuditLogEntry[] {
    const existing = safeReadJson<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.AUDIT_LOGS, []);
    return [];
  },

  appendAuditLog(
    actor: AppUser,
    entity: string,
    oldValue: string,
    newValue: string,
    reason?: string
  ): AuditLogEntry[] {
    const logs = this.getAuditLogs();
    const entry: AuditLogEntry = {
      id: generateUniqueId('aud'),
      timestamp: clockService.nowIso(),
      actorName: actor.fullName,
      actorRole: actor.role,
      entity,
      oldValue,
      newValue,
      reason: reason?.trim() || undefined,
    };
    const next = [entry, ...logs];
    safeWriteJson(STORAGE_KEYS.AUDIT_LOGS, next);
    return next;
  },

  // --- Permissions configurables des superviseurs ---
  getSupervisorPermissions(): Permission[] {
    const existing = safeReadJson<Permission[]>(STORAGE_KEYS.SUPERVISOR_PERMS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.SUPERVISOR_PERMS, BASE_ROLE_PERMISSIONS.supervisor);
    return BASE_ROLE_PERMISSIONS.supervisor;
  },

  saveSupervisorPermissions(perms: Permission[], actor: AppUser, reason?: string): Permission[] {
    const prev = this.getSupervisorPermissions();
    safeWriteJson(STORAGE_KEYS.SUPERVISOR_PERMS, perms);
    this.appendAuditLog(
      actor,
      'Permissions Superviseur',
      `${prev.length} droits`,
      `${perms.length} droits`,
      reason
    );
    return perms;
  },

  // --- Sociétés & Tâches ---
  getCompanies(): CompanyRecord[] {
    const existing = safeReadJson<CompanyRecord[]>(STORAGE_KEYS.COMPANIES);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
    return INITIAL_COMPANIES;
  },

  addCompany(name: string, actor: AppUser): CompanyRecord[] {
    const list = this.getCompanies();
    const trimmed = name.trim();
    if (!trimmed) return list;
    const newComp: CompanyRecord = {
      id: generateUniqueId('comp'),
      name: trimmed,
      archived: false,
      createdAt: clockService.nowIso(),
    };
    const next = [...list, newComp];
    safeWriteJson(STORAGE_KEYS.COMPANIES, next);
    const map = this.getCompanyTaskMap();
    map[newComp.id] = this.getTasks()
      .filter((t) => !t.archived)
      .map((t) => t.id);
    safeWriteJson(STORAGE_KEYS.COMPANY_TASK_MAP, map);
    this.appendAuditLog(actor, 'Société créée', '—', trimmed);
    return next;
  },

  renameCompany(companyId: string, newName: string, actor: AppUser): CompanyRecord[] {
    const list = this.getCompanies();
    const target = list.find((c) => c.id === companyId);
    const trimmed = newName.trim();
    if (!target || !trimmed) return list;
    const next = list.map((c) => (c.id === companyId ? { ...c, name: trimmed } : c));
    safeWriteJson(STORAGE_KEYS.COMPANIES, next);
    this.appendAuditLog(actor, 'Société renommée', target.name, trimmed);
    return next;
  },

  toggleArchiveCompany(companyId: string, archived: boolean, actor: AppUser): CompanyRecord[] {
    const list = this.getCompanies();
    const target = list.find((c) => c.id === companyId);
    if (!target) return list;
    const next = list.map((c) => (c.id === companyId ? { ...c, archived } : c));
    safeWriteJson(STORAGE_KEYS.COMPANIES, next);
    this.appendAuditLog(
      actor,
      `Société · ${target.name}`,
      target.archived ? 'Archivée' : 'Active',
      archived ? 'Archivée' : 'Active'
    );
    return next;
  },

  getTasks(): TaskRecord[] {
    const existing = safeReadJson<TaskRecord[]>(STORAGE_KEYS.TASKS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.TASKS, INITIAL_TASKS);
    return INITIAL_TASKS;
  },

  addTask(name: string, actor: AppUser): TaskRecord[] {
    const list = this.getTasks();
    const trimmed = name.trim();
    if (!trimmed) return list;
    const newTask: TaskRecord = {
      id: generateUniqueId('task'),
      name: trimmed,
      archived: false,
      createdAt: clockService.nowIso(),
    };
    const next = [...list, newTask];
    safeWriteJson(STORAGE_KEYS.TASKS, next);
    const map = this.getCompanyTaskMap();
    for (const comp of this.getCompanies()) {
      const existingArr = map[comp.id] ?? [];
      if (!existingArr.includes(newTask.id)) {
        map[comp.id] = [...existingArr, newTask.id];
      }
    }
    safeWriteJson(STORAGE_KEYS.COMPANY_TASK_MAP, map);
    this.appendAuditLog(actor, 'Type de tâche créé', '—', trimmed);
    return next;
  },

  renameTask(taskId: string, newName: string, actor: AppUser): TaskRecord[] {
    const list = this.getTasks();
    const target = list.find((t) => t.id === taskId);
    const trimmed = newName.trim();
    if (!target || !trimmed) return list;
    const next = list.map((t) => (t.id === taskId ? { ...t, name: trimmed } : t));
    safeWriteJson(STORAGE_KEYS.TASKS, next);
    this.appendAuditLog(actor, 'Type de tâche renommé', target.name, trimmed);
    return next;
  },

  toggleArchiveTask(taskId: string, archived: boolean, actor: AppUser): TaskRecord[] {
    const list = this.getTasks();
    const target = list.find((t) => t.id === taskId);
    if (!target) return list;
    const next = list.map((t) => (t.id === taskId ? { ...t, archived } : t));
    safeWriteJson(STORAGE_KEYS.TASKS, next);
    this.appendAuditLog(
      actor,
      `Tâche · ${target.name}`,
      target.archived ? 'Archivée' : 'Active',
      archived ? 'Archivée' : 'Active'
    );
    return next;
  },

  getCompanyTaskMap(): Record<string, string[]> {
    const existing = safeReadJson<Record<string, string[]>>(STORAGE_KEYS.COMPANY_TASK_MAP);
    if (existing && typeof existing === 'object') return existing;
    safeWriteJson(STORAGE_KEYS.COMPANY_TASK_MAP, INITIAL_COMPANY_TASK_MAP);
    return INITIAL_COMPANY_TASK_MAP;
  },

  toggleTaskForCompany(
    companyId: string,
    taskId: string,
    enabled: boolean,
    actor: AppUser
  ): Record<string, string[]> {
    const map = { ...this.getCompanyTaskMap() };
    const current = map[companyId] ?? [];
    map[companyId] = enabled
      ? Array.from(new Set([...current, taskId]))
      : current.filter((id) => id !== taskId);
    safeWriteJson(STORAGE_KEYS.COMPANY_TASK_MAP, map);
    const compName = this.getCompanies().find((c) => c.id === companyId)?.name ?? companyId;
    const taskName = this.getTasks().find((t) => t.id === taskId)?.name ?? taskId;
    this.appendAuditLog(
      actor,
      `Affectation tâche · ${compName}`,
      `${taskName} (${enabled ? 'Inactive' : 'Active'})`,
      `${taskName} (${enabled ? 'Active' : 'Inactive'})`
    );
    return map;
  },

  getAvailableTasksForCompany(companyId: string): TaskRecord[] {
    const allTasks = this.getTasks().filter((t) => !t.archived);
    if (!companyId) return allTasks;
    const allowedIds = this.getCompanyTaskMap()[companyId];
    if (!allowedIds) return allTasks;
    return allTasks.filter((t) => allowedIds.includes(t.id));
  },

  // --- Comptes Utilisateurs, Employés & Équipes ---
  getEmployees(): ManagedEmployee[] {
    return this.getUsers();
  },

  async createManagedUser(
    input: CreateUserInput,
    actor: AppUser
  ): Promise<{ users: ManagedEmployee[]; created?: ManagedEmployee; error?: string }> {
    const accounts = this.getUsers();

    if (actor.role !== 'admin' && actor.role !== 'manager') {
      return {
        users: accounts,
        error: 'Votre rôle ne permet pas de créer de nouveaux comptes.',
      };
    }

    if ((input.role === 'admin' || input.role === 'manager') && actor.role !== 'admin') {
      return {
        users: accounts,
        error: 'Seul un administrateur peut créer un compte Administrateur ou Manager.',
      };
    }

    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();

    if (fullName.length < 2) {
      return { users: accounts, error: 'Le nom complet est obligatoire.' };
    }
    if (!isValidEmail(email)) {
      return { users: accounts, error: 'Veuillez saisir une adresse e-mail valide.' };
    }
    if (accounts.some((u) => u.email.trim().toLowerCase() === email)) {
      return { users: accounts, error: 'Cette adresse e-mail est déjà utilisée.' };
    }
    if (!input.password || input.password.length < 8) {
      return {
        users: accounts,
        error: 'Le mot de passe initial doit contenir au moins 8 caractères.',
      };
    }

    const passwordHash = await hashPassword(input.password);
    const matricule = this.generateNextMatricule();
    const todayYmd = toYmd(new Date(clockService.nowMs()));

    const created: ManagedEmployee = {
      id: generateUniqueId('usr'),
      matricule,
      fullName,
      email,
      role: input.role,
      isPrimaryAdmin: false,
      passwordHash,
      jobTitle: input.jobTitle?.trim() || ROLE_LABELS[input.role],
      hireDate: todayYmd,
      accountStatus: 'actif',
      site: input.site.trim() || 'Siège',
      teamId: input.role === 'employee' || input.role === 'supervisor' ? input.teamId ?? '' : '',
      supervisorId: input.role === 'employee' ? input.supervisorId ?? '' : '',
      plannedStart: input.plannedStart ?? '08:30',
      plannedEnd: input.plannedEnd ?? '17:00',
      restDays: input.restDays?.length ? input.restDays : ['Samedi', 'Dimanche'],
      dailyTargetDossiers:
        input.role === 'employee' ? Math.max(1, input.dailyTargetDossiers ?? 35) : 0,
      status: 'absent',
      dossiersToday: 0,
      presenceSecondsToday: 0,
      productiveSecondsToday: 0,
      pauseSecondsToday: 0,
    };

    const next = [created, ...accounts];
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, next);

    if (created.role === 'employee' || created.role === 'supervisor') {
      const teamName = this.getTeams().find((t) => t.id === created.teamId)?.name ?? '';
      const schedules = this.getSchedules();
      safeWriteJson(STORAGE_KEYS.SCHEDULES, [
        ...schedules,
        {
          userId: created.id,
          employeeName: created.fullName,
          matricule: created.matricule,
          teamId: created.teamId,
          teamName,
          plannedStart: created.plannedStart,
          plannedEnd: created.plannedEnd,
          restDays: created.restDays,
          isCustom: false,
        },
      ]);
    }

    this.appendAuditLog(
      actor,
      `Compte créé · ${ROLE_LABELS[created.role]}`,
      '—',
      `${created.fullName} (${created.matricule})`
    );

    return { users: next, created };
  },

  async updateManagedUser(
    userId: string,
    patch: Partial<
      Pick<
        ManagedEmployee,
        | 'fullName'
        | 'email'
        | 'role'
        | 'jobTitle'
        | 'site'
        | 'teamId'
        | 'supervisorId'
        | 'plannedStart'
        | 'plannedEnd'
        | 'restDays'
        | 'dailyTargetDossiers'
        | 'accountStatus'
      >
    >,
    actor: AppUser,
    options?: { newPassword?: string; reason?: string }
  ): Promise<{ users: ManagedEmployee[]; error?: string }> {
    const list = this.getUsers();
    const existing = list.find((e) => e.id === userId);
    if (!existing) {
      return { users: list, error: 'Compte introuvable.' };
    }

    if (existing.role === 'admin' && actor.role !== 'admin') {
      return {
        users: list,
        error: 'Seul un administrateur peut modifier un compte administrateur.',
      };
    }

    if (
      patch.role &&
      patch.role !== existing.role &&
      (patch.role === 'admin' || patch.role === 'manager') &&
      actor.role !== 'admin'
    ) {
      return {
        users: list,
        error: 'Seul un administrateur peut attribuer le rôle Administrateur ou Manager.',
      };
    }

    if (existing.isPrimaryAdmin && patch.role && patch.role !== 'admin') {
      return {
        users: list,
        error: 'Le rôle de l’administrateur principal ne peut pas être retiré.',
      };
    }

    if (
      existing.isPrimaryAdmin &&
      patch.accountStatus &&
      patch.accountStatus !== 'actif'
    ) {
      return {
        users: list,
        error: 'Le compte de l’administrateur principal ne peut pas être désactivé ou archivé.',
      };
    }

    const nextEmail = patch.email !== undefined ? patch.email.trim().toLowerCase() : existing.email;
    if (!isValidEmail(nextEmail)) {
      return { users: list, error: 'Veuillez saisir une adresse e-mail valide.' };
    }
    if (list.some((u) => u.id !== userId && u.email.trim().toLowerCase() === nextEmail)) {
      return { users: list, error: 'Cette adresse e-mail est déjà associée à un autre compte.' };
    }

    let nextPasswordHash = existing.passwordHash;
    if (options?.newPassword && options.newPassword.trim().length > 0) {
      if (actor.role !== 'admin' && actor.role !== 'manager') {
        return { users: list, error: 'Droits insuffisants pour réinitialiser le mot de passe.' };
      }
      if (options.newPassword.length < 8) {
        return {
          users: list,
          error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
        };
      }
      nextPasswordHash = await hashPassword(options.newPassword);
    }

    const updated: ManagedEmployee = {
      ...existing,
      ...patch,
      fullName: patch.fullName !== undefined ? patch.fullName.trim() : existing.fullName,
      email: nextEmail,
      passwordHash: nextPasswordHash,
      id: existing.id,
      matricule: existing.matricule,
      isPrimaryAdmin: existing.isPrimaryAdmin,
    };

    const next = list.map((e) => (e.id === existing.id ? updated : e));
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, next);

    const teamName = this.getTeams().find((t) => t.id === updated.teamId)?.name ?? '';
    const schedules = this.getSchedules();
    const hasSchedule = schedules.some((s) => s.userId === updated.id);
    if (hasSchedule) {
      const nextSchedules = schedules.map((s) =>
        s.userId === updated.id
          ? {
              ...s,
              employeeName: updated.fullName,
              teamId: updated.teamId,
              teamName,
              plannedStart: updated.plannedStart,
              plannedEnd: updated.plannedEnd,
              restDays: updated.restDays,
            }
          : s
      );
      safeWriteJson(STORAGE_KEYS.SCHEDULES, nextSchedules);
    }

    this.appendAuditLog(
      actor,
      `Compte · ${updated.fullName}`,
      `${ROLE_LABELS[existing.role]} · ${existing.accountStatus}`,
      `${ROLE_LABELS[updated.role]} · ${updated.accountStatus}${
        options?.newPassword ? ' · Mot de passe mis à jour' : ''
      }`,
      options?.reason
    );

    return { users: next };
  },

  setEmployeeAccountStatus(
    employeeId: string,
    status: AccountStatus,
    actor: AppUser,
    reason?: string
  ): { users: ManagedEmployee[]; error?: string } {
    const list = this.getUsers();
    const target = list.find((e) => e.id === employeeId);
    if (!target) return { users: list, error: 'Compte introuvable.' };

    if (target.role === 'admin' && actor.role !== 'admin') {
      return {
        users: list,
        error: 'Seul un administrateur peut modifier le statut d’un compte administrateur.',
      };
    }

    if (target.isPrimaryAdmin && status !== 'actif') {
      return {
        users: list,
        error: 'Le compte de l’administrateur principal doit rester actif.',
      };
    }

    if (target.role === 'admin' && status !== 'actif') {
      const remainingActiveAdmins = list.filter(
        (u) => u.id !== target.id && u.role === 'admin' && u.accountStatus === 'actif'
      );
      if (remainingActiveAdmins.length === 0) {
        return {
          users: list,
          error: 'Impossible de désactiver ou archiver le dernier administrateur actif.',
        };
      }
    }

    const next = list.map((e) => (e.id === employeeId ? { ...e, accountStatus: status } : e));
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, next);
    this.appendAuditLog(
      actor,
      `Statut compte · ${target.fullName}`,
      target.accountStatus,
      status,
      reason
    );
    return { users: next };
  },

  getTeams(): TeamRecord[] {
    const existing = safeReadJson<TeamRecord[]>(STORAGE_KEYS.TEAMS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.TEAMS, []);
    return [];
  },

  saveTeam(team: Omit<TeamRecord, 'id'> & { id?: string }, actor: AppUser): TeamRecord[] {
    const list = this.getTeams();
    const accounts = this.getUsers();
    const matchedSupervisor = team.supervisorId
      ? accounts.find((u) => u.id === team.supervisorId)
      : undefined;
    const supName = matchedSupervisor?.fullName ?? (team.supervisorName || 'Non assigné');

    if (team.id) {
      const old = list.find((t) => t.id === team.id);
      const next = list.map((t) =>
        t.id === team.id ? { ...t, ...team, supervisorName: supName } : t
      );
      safeWriteJson(STORAGE_KEYS.TEAMS, next);
      if (old) {
        this.appendAuditLog(
          actor,
          `Équipe · ${team.name}`,
          `Sup. ${old.supervisorName}`,
          `Sup. ${supName}`
        );
      }
      return next;
    }
    const created: TeamRecord = {
      ...team,
      id: generateUniqueId('team'),
      supervisorName: supName,
    };
    const next = [...list, created];
    safeWriteJson(STORAGE_KEYS.TEAMS, next);
    this.appendAuditLog(actor, 'Équipe créée', '—', `${created.name} (Sup. ${supName})`);
    return next;
  },

  // --- Temps de référence & Objectifs ---
  getReferenceTimes(): ReferenceTimeEntry[] {
    const existing = safeReadJson<ReferenceTimeEntry[]>(STORAGE_KEYS.REFERENCE_TIMES);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.REFERENCE_TIMES, INITIAL_REFERENCE_TIMES);
    return INITIAL_REFERENCE_TIMES;
  },

  saveReferenceTime(
    companyId: string,
    taskId: string,
    referenceMinutes: number,
    actor: AppUser
  ): ReferenceTimeEntry[] {
    const list = this.getReferenceTimes();
    const existing = list.find((r) => r.companyId === companyId && r.taskId === taskId);
    const safeMin = Math.max(1, Math.round(referenceMinutes));
    let next: ReferenceTimeEntry[];
    if (existing) {
      next = list.map((r) =>
        r.id === existing.id ? { ...r, referenceMinutes: safeMin } : r
      );
      const compName = this.getCompanies().find((c) => c.id === companyId)?.name ?? companyId;
      const taskName = this.getTasks().find((t) => t.id === taskId)?.name ?? taskId;
      this.appendAuditLog(
        actor,
        `Temps de référence · ${compName} / ${taskName}`,
        `${existing.referenceMinutes} min`,
        `${safeMin} min`
      );
    } else {
      next = [
        ...list,
        { id: generateUniqueId('ref'), companyId, taskId, referenceMinutes: safeMin },
      ];
    }
    safeWriteJson(STORAGE_KEYS.REFERENCE_TIMES, next);
    return next;
  },

  getObjectives(): ProductionObjective[] {
    const existing = safeReadJson<ProductionObjective[]>(STORAGE_KEYS.OBJECTIVES);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.OBJECTIVES, []);
    return [];
  },

  addObjective(
    obj: Omit<ProductionObjective, 'id'>,
    actor: AppUser
  ): ProductionObjective[] {
    const list = this.getObjectives();
    const created: ProductionObjective = { ...obj, id: generateUniqueId('obj') };
    const next = [created, ...list];
    safeWriteJson(STORAGE_KEYS.OBJECTIVES, next);
    this.appendAuditLog(
      actor,
      `Objectif (${obj.period})`,
      '—',
      `${obj.targetDossiers} dossiers (${obj.scopeType})`
    );
    return next;
  },

  deleteObjective(id: string): ProductionObjective[] {
    const next = this.getObjectives().filter((o) => o.id !== id);
    safeWriteJson(STORAGE_KEYS.OBJECTIVES, next);
    return next;
  },

  // --- Contrôle Qualité ---
  getQualityCriteria(): QualityCriterionConfig[] {
    const existing = safeReadJson<QualityCriterionConfig[]>(STORAGE_KEYS.QUALITY_CRITERIA);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.QUALITY_CRITERIA, INITIAL_QUALITY_CRITERIA);
    return INITIAL_QUALITY_CRITERIA;
  },

  addQualityCriterion(label: string, actor: AppUser): QualityCriterionConfig[] {
    const list = this.getQualityCriteria();
    const trimmed = label.trim();
    if (!trimmed) return list;
    const next = [...list, { id: generateUniqueId('crit'), label: trimmed, active: true }];
    safeWriteJson(STORAGE_KEYS.QUALITY_CRITERIA, next);
    this.appendAuditLog(actor, 'Critère qualité ajouté', '—', trimmed);
    return next;
  },

  toggleQualityCriterion(id: string, active: boolean): QualityCriterionConfig[] {
    const next = this.getQualityCriteria().map((c) => (c.id === id ? { ...c, active } : c));
    safeWriteJson(STORAGE_KEYS.QUALITY_CRITERIA, next);
    return next;
  },

  getQualityControls(): QualityControlRecord[] {
    const existing = safeReadJson<QualityControlRecord[]>(STORAGE_KEYS.QUALITY_CONTROLS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.QUALITY_CONTROLS, []);
    return [];
  },

  evaluateQualityControl(
    qcId: string,
    payload: {
      status: QualityStatus;
      criteriaResults: QualityCriterionResult[];
      observations: string;
    },
    controller: AppUser
  ): QualityControlRecord[] {
    const list = this.getQualityControls();
    const target = list.find((q) => q.id === qcId);
    if (!target) return list;
    const nowIso = clockService.nowIso();
    const next = list.map((q) =>
      q.id === qcId
        ? {
            ...q,
            status: payload.status,
            criteriaResults: payload.criteriaResults,
            observations: payload.observations.trim(),
            controllerName: controller.fullName,
            controlledAt: nowIso,
          }
        : q
    );
    safeWriteJson(STORAGE_KEYS.QUALITY_CONTROLS, next);
    this.appendAuditLog(
      controller,
      `Contrôle qualité · ${target.dossierRef}`,
      target.status,
      payload.status,
      payload.observations
    );

    const empActivities = this.getActivitiesForUser(target.employeeId);
    const updatedActivities = empActivities.map((act) =>
      act.id === target.activityId
        ? {
            ...act,
            status:
              payload.status === 'valide' || payload.status === 'valide_observation'
                ? ('valide' as const)
                : ('en_controle' as const),
          }
        : act
    );
    this.saveActivitiesForUser(target.employeeId, updatedActivities);

    return next;
  },

  // --- Demandes de correction employé ---
  getCorrectionRequests(): CorrectionRequest[] {
    const existing = safeReadJson<CorrectionRequest[]>(STORAGE_KEYS.CORRECTION_REQUESTS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.CORRECTION_REQUESTS, []);
    return [];
  },

  createCorrectionRequest(payload: {
    activity: ActivityRecord;
    user: AppUser;
    reason: string;
  }): CorrectionRequest[] {
    const list = this.getCorrectionRequests();
    const created: CorrectionRequest = {
      id: generateUniqueId('corr'),
      activityId: payload.activity.id,
      dossierRef: payload.activity.dossierRef,
      activityLabel: payload.activity.taskTitle,
      employeeId: payload.user.id,
      employeeName: payload.user.fullName,
      teamId: payload.user.teamId ?? '',
      reason: payload.reason.trim(),
      requestedAt: clockService.nowIso(),
      status: 'en_attente',
    };
    const next = [created, ...list];
    safeWriteJson(STORAGE_KEYS.CORRECTION_REQUESTS, next);
    return next;
  },

  reviewCorrectionRequest(
    requestId: string,
    decision: 'approuvee' | 'refusee',
    reviewer: AppUser,
    note?: string
  ): CorrectionRequest[] {
    const list = this.getCorrectionRequests();
    const target = list.find((r) => r.id === requestId);
    const next = list.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: decision,
            reviewedBy: reviewer.fullName,
            reviewedAt: clockService.nowIso(),
            reviewNote: note?.trim() || undefined,
          }
        : r
    );
    safeWriteJson(STORAGE_KEYS.CORRECTION_REQUESTS, next);
    if (target) {
      this.appendAuditLog(
        reviewer,
        `Demande de correction · ${target.dossierRef}`,
        'en_attente',
        decision,
        note ?? target.reason
      );
    }
    return next;
  },

  // --- Paramètres globaux & Horaires ---
  getAdminConfig(): GlobalAdminConfig {
    const existing = safeReadJson<GlobalAdminConfig>(STORAGE_KEYS.ADMIN_CONFIG);
    if (existing && typeof existing.lunchBreakMinutes === 'number') {
      return existing;
    }
    safeWriteJson(STORAGE_KEYS.ADMIN_CONFIG, INITIAL_ADMIN_CONFIG);
    return INITIAL_ADMIN_CONFIG;
  },

  saveAdminConfig(config: GlobalAdminConfig, actor?: AppUser): GlobalAdminConfig {
    const prev = this.getAdminConfig();
    safeWriteJson(STORAGE_KEYS.ADMIN_CONFIG, config);
    if (actor) {
      this.appendAuditLog(
        actor,
        'Configuration pauses / retard',
        `Déjeuner ${prev.lunchBreakMinutes}m · Tolérance ${prev.lateToleranceMinutes}m`,
        `Déjeuner ${config.lunchBreakMinutes}m · Tolérance ${config.lateToleranceMinutes}m`
      );
    }
    return config;
  },

  getSchedules(): EmployeeScheduleConfig[] {
    const existing = safeReadJson<EmployeeScheduleConfig[]>(STORAGE_KEYS.SCHEDULES);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.SCHEDULES, []);
    return [];
  },

  saveEmployeeSchedule(
    updated: EmployeeScheduleConfig,
    actor?: AppUser
  ): EmployeeScheduleConfig[] {
    const all = this.getSchedules();
    const old = all.find((s) => s.userId === updated.userId);
    const exists = Boolean(old);
    const next = exists
      ? all.map((s) => (s.userId === updated.userId ? updated : s))
      : [...all, updated];
    safeWriteJson(STORAGE_KEYS.SCHEDULES, next);

    const accounts = this.getUsers();
    const nextAccounts = accounts.map((e) =>
      e.id === updated.userId
        ? {
            ...e,
            plannedStart: updated.plannedStart,
            plannedEnd: updated.plannedEnd,
            restDays: updated.restDays,
          }
        : e
    );
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, nextAccounts);

    if (actor && old) {
      this.appendAuditLog(
        actor,
        `Horaire · ${updated.employeeName}`,
        `${old.plannedStart}-${old.plannedEnd}`,
        `${updated.plannedStart}-${updated.plannedEnd}`,
        updated.exceptionNote
      );
    }
    return next;
  },

  getOutingRequests(): OutingAuthorizationRequest[] {
    const existing = safeReadJson<OutingAuthorizationRequest[]>(STORAGE_KEYS.OUTING_REQUESTS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.OUTING_REQUESTS, []);
    return [];
  },

  createOutingRequest(payload: {
    user: AppUser;
    reason: Extract<OutingReason, 'sortie_medecin' | 'sortie_personnelle'>;
    details: string;
    plannedWindow: string;
  }): OutingAuthorizationRequest {
    const all = this.getOutingRequests();
    const newReq: OutingAuthorizationRequest = {
      id: generateUniqueId('auth'),
      userId: payload.user.id,
      employeeName: payload.user.fullName,
      teamId: payload.user.teamId ?? '',
      reason: payload.reason,
      details: payload.details.trim(),
      requestedAt: clockService.nowIso(),
      plannedWindow: payload.plannedWindow.trim() || 'Immédiat',
      status: 'en_attente',
    };
    safeWriteJson(STORAGE_KEYS.OUTING_REQUESTS, [newReq, ...all]);
    return newReq;
  },

  reviewOutingRequest(
    requestId: string,
    decision: 'approuvee' | 'refusee',
    reviewer: AppUser
  ): OutingAuthorizationRequest[] {
    const all = this.getOutingRequests();
    const target = all.find((r) => r.id === requestId);
    const next = all.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: decision,
            reviewedBy: reviewer.fullName,
            reviewedAt: clockService.nowIso(),
          }
        : r
    );
    safeWriteJson(STORAGE_KEYS.OUTING_REQUESTS, next);
    if (target) {
      this.appendAuditLog(
        reviewer,
        `Autorisation sortie · ${target.employeeName}`,
        'en_attente',
        decision
      );
    }
    return next;
  },

  // --- Chronomètres & État de service employé ---
  syncAccountMetricsFromShift(userId: string, shift: EmployeeShiftState): void {
    const accounts = this.getUsers();
    const target = accounts.find((u) => u.id === userId);
    if (!target) return;
    const todayYmd = toYmd(new Date(clockService.nowMs()));
    const treatmentsTodayCount = this.getActivitiesForUser(userId).filter(
      (a) => a.type === 'traitement' && isSameDayYmd(a.startedAt, todayYmd)
    ).length;

    const updated = accounts.map((u) =>
      u.id === userId
        ? {
            ...u,
            status: shift.serviceStatus,
            dossiersToday: treatmentsTodayCount,
            presenceSecondsToday: shift.presenceSecondsBase,
            productiveSecondsToday: shift.productiveSecondsBase,
            pauseSecondsToday: shift.pauseSecondsBase,
          }
        : u
    );
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, updated);
  },

  getShiftState(userId: string): EmployeeShiftState {
    const key = `${STORAGE_KEYS.SHIFT_STATE_PREFIX}${userId}`;
    const existing = safeReadJson<EmployeeShiftState>(key);
    if (existing && existing.userId === userId) {
      return existing;
    }
    const seeded = createInitialEmployeeShiftState(userId);
    safeWriteJson(key, seeded);
    return seeded;
  },

  saveShiftState(state: EmployeeShiftState): void {
    const key = `${STORAGE_KEYS.SHIFT_STATE_PREFIX}${state.userId}`;
    safeWriteJson(key, state);
    this.syncAccountMetricsFromShift(state.userId, state);
  },

  computeLivePresenceSeconds(state: EmployeeShiftState, nowMs = clockService.nowMs()): number {
    const isPresenceRunning =
      state.serviceStatus === 'present' ||
      state.serviceStatus === 'in_treatment' ||
      state.serviceStatus === 'in_outing';

    if (isPresenceRunning && state.presenceAnchorAt) {
      const elapsed = Math.max(
        0,
        Math.round((nowMs - new Date(state.presenceAnchorAt).getTime()) / 1000)
      );
      return state.presenceSecondsBase + elapsed;
    }
    return state.presenceSecondsBase;
  },

  computeLiveProductiveSeconds(state: EmployeeShiftState, nowMs = clockService.nowMs()): number {
    if (state.activeTimer && state.activeTimer.type === 'traitement') {
      const activeElapsed = Math.max(
        0,
        Math.round((nowMs - new Date(state.activeTimer.startedAt).getTime()) / 1000)
      );
      return state.productiveSecondsBase + activeElapsed;
    }
    return state.productiveSecondsBase;
  },

  computeLivePauseSeconds(state: EmployeeShiftState, nowMs = clockService.nowMs()): number {
    if (state.activeTimer && state.activeTimer.type === 'pause') {
      const activeElapsed = Math.max(
        0,
        Math.round((nowMs - new Date(state.activeTimer.startedAt).getTime()) / 1000)
      );
      return state.pauseSecondsBase + activeElapsed;
    }
    return state.pauseSecondsBase;
  },

  getUsedPauseSlotsToday(userId: string): Partial<Record<PauseSlot, ActivityRecord>> {
    const todayYmd = toYmd(new Date(clockService.nowMs()));
    const activities = this.getActivitiesForUser(userId);
    const used: Partial<Record<PauseSlot, ActivityRecord>> = {};
    for (const act of activities) {
      if (act.type === 'pause' && act.pauseSlot && isSameDayYmd(act.startedAt, todayYmd)) {
        used[act.pauseSlot] = act;
      }
    }
    return used;
  },

  transitionServiceStatus(userId: string, nextStatus: ServiceStatus): EmployeeShiftState {
    const current = this.getShiftState(userId);
    if (nextStatus === 'absent' && current.activeTimer) {
      return current;
    }

    const nowMs = clockService.nowMs();
    const nowIso = new Date(nowMs).toISOString();
    const updatedPresenceBase = this.computeLivePresenceSeconds(current, nowMs);

    const isPresenceActive =
      nextStatus === 'present' || nextStatus === 'in_treatment' || nextStatus === 'in_outing';

    const updated: EmployeeShiftState = {
      ...current,
      serviceStatus: nextStatus,
      shiftStartTime:
        isPresenceActive && !current.shiftStartTime ? nowIso : current.shiftStartTime,
      shiftEndTime: nextStatus === 'absent' ? nowIso : null,
      presenceSecondsBase: updatedPresenceBase,
      presenceAnchorAt: isPresenceActive ? nowIso : null,
    };

    this.saveShiftState(updated);
    return updated;
  },

  startTreatmentSession(userId: string): { shiftState: EmployeeShiftState; error?: string } {
    const current = this.getShiftState(userId);
    if (current.activeTimer) {
      return {
        shiftState: current,
        error: 'Un chronomètre est déjà actif. Terminez-le avant d’en démarrer un autre.',
      };
    }

    const nowMs = clockService.nowMs();
    const nowIso = new Date(nowMs).toISOString();
    const updatedPresenceBase = this.computeLivePresenceSeconds(current, nowMs);

    const session: ActiveTimerSession = {
      id: generateUniqueId('act'),
      type: 'traitement',
      startedAt: nowIso,
      taskId: '',
      taskTitle: '',
      companyId: '',
      clientName: '',
      receptionChannel: 'Mail',
      receptionDateTime: toLocalDateTimeInputValue(new Date(nowMs)),
      recipientEmail: '',
      teamsRequesterName: '',
      dossierRef: '',
      notes: '',
    };

    const updated: EmployeeShiftState = {
      ...current,
      serviceStatus: 'in_treatment',
      shiftStartTime: current.shiftStartTime ?? nowIso,
      shiftEndTime: null,
      presenceSecondsBase: updatedPresenceBase,
      presenceAnchorAt: nowIso,
      activeTimer: session,
    };

    this.saveShiftState(updated);
    return { shiftState: updated };
  },

  startPauseSession(
    userId: string,
    slot: PauseSlot
  ): { shiftState: EmployeeShiftState; error?: string } {
    const current = this.getShiftState(userId);
    if (current.activeTimer) {
      return {
        shiftState: current,
        error: 'Un chronomètre est déjà actif. Terminez-le avant de lancer une pause.',
      };
    }

    const usedToday = this.getUsedPauseSlotsToday(userId);
    if (usedToday[slot]) {
      return {
        shiftState: current,
        error: `${PAUSE_SLOT_LABELS[slot]} a déjà été prise aujourd’hui.`,
      };
    }

    const adminConfig = this.getAdminConfig();
    const allowedMinutes =
      slot === 'pause_dejeuner'
        ? adminConfig.lunchBreakMinutes
        : slot === 'pause_matin'
        ? adminConfig.morningBreakMinutes
        : adminConfig.afternoonBreakMinutes;

    const nowMs = clockService.nowMs();
    const nowIso = new Date(nowMs).toISOString();
    const updatedPresenceBase = this.computeLivePresenceSeconds(current, nowMs);

    const session: ActiveTimerSession = {
      id: generateUniqueId('act'),
      type: 'pause',
      startedAt: nowIso,
      taskTitle: PAUSE_SLOT_LABELS[slot],
      clientName: 'Interne',
      dossierRef: slot.toUpperCase(),
      notes: '',
      pauseSlot: slot,
      allowedDurationMinutes: allowedMinutes,
    };

    const updated: EmployeeShiftState = {
      ...current,
      serviceStatus: 'paused',
      shiftStartTime: current.shiftStartTime ?? nowIso,
      shiftEndTime: null,
      presenceSecondsBase: updatedPresenceBase,
      presenceAnchorAt: null,
      activeTimer: session,
    };

    this.saveShiftState(updated);
    return { shiftState: updated };
  },

  startOutingSession(
    userId: string,
    reason: OutingReason,
    authorizationRequest?: OutingAuthorizationRequest | null
  ): { shiftState: EmployeeShiftState; error?: string } {
    const current = this.getShiftState(userId);
    if (current.activeTimer) {
      return {
        shiftState: current,
        error: 'Un chronomètre est déjà actif. Terminez-le avant de démarrer une sortie.',
      };
    }

    const config = OUTING_REASON_CONFIG[reason];
    const nowMs = clockService.nowMs();
    const nowIso = new Date(nowMs).toISOString();
    const updatedPresenceBase = this.computeLivePresenceSeconds(current, nowMs);

    const authStatus: AuthorizationStatus = !config.requiresAuthorization
      ? 'non_requise'
      : authorizationRequest?.status ?? 'en_attente';

    const session: ActiveTimerSession = {
      id: generateUniqueId('act'),
      type: 'sortie',
      startedAt: nowIso,
      taskTitle: config.label,
      clientName: 'Interne',
      dossierRef: `SORTIE-${reason.toUpperCase()}`,
      notes: '',
      outingReason: reason,
      customReason: '',
      authorizationStatus: authStatus,
      authorizationRequestId: authorizationRequest?.id,
    };

    const updated: EmployeeShiftState = {
      ...current,
      serviceStatus: 'in_outing',
      shiftStartTime: current.shiftStartTime ?? nowIso,
      shiftEndTime: null,
      presenceSecondsBase: updatedPresenceBase,
      presenceAnchorAt: nowIso,
      activeTimer: session,
    };

    this.saveShiftState(updated);
    return { shiftState: updated };
  },

  updateActiveTimerFields(
    userId: string,
    patch: Partial<
      Pick<
        ActiveTimerSession,
        | 'taskId'
        | 'taskTitle'
        | 'companyId'
        | 'clientName'
        | 'dossierRef'
        | 'notes'
        | 'receptionChannel'
        | 'receptionDateTime'
        | 'recipientEmail'
        | 'teamsRequesterName'
        | 'customReason'
      >
    >
  ): EmployeeShiftState {
    const current = this.getShiftState(userId);
    if (!current.activeTimer) return current;
    const updated: EmployeeShiftState = {
      ...current,
      activeTimer: {
        ...current.activeTimer,
        ...patch,
      },
    };
    this.saveShiftState(updated);
    return updated;
  },

  completeTimerSession(
    userId: string,
    userMeta?: { fullName: string; teamId?: string }
  ): {
    shiftState: EmployeeShiftState;
    savedRecord: ActivityRecord | null;
    validationErrors?: string[];
  } {
    const current = this.getShiftState(userId);
    const active = current.activeTimer;
    if (!active) {
      return { shiftState: current, savedRecord: null };
    }

    const errors: string[] = [];

    if (active.type === 'traitement') {
      if (!active.clientName.trim()) errors.push('La société cliente est obligatoire.');
      if (!active.taskTitle.trim()) errors.push('Le type de tâche est obligatoire.');
      if (!active.receptionChannel) errors.push('Le canal de réception est obligatoire.');
      if (!active.receptionDateTime?.trim()) {
        errors.push('La date et heure de réception sont obligatoires.');
      }
      if (!active.dossierRef?.trim()) {
        errors.push('La référence du dossier est obligatoire.');
      }
    }

    if (active.type === 'sortie' && active.outingReason === 'autre') {
      if (!active.customReason?.trim()) {
        errors.push('Veuillez préciser le motif.');
      }
    }

    if (errors.length > 0) {
      return {
        shiftState: current,
        savedRecord: null,
        validationErrors: errors,
      };
    }

    const endedAtMs = clockService.nowMs();
    const endedAtIso = new Date(endedAtMs).toISOString();
    const startedAtMs = new Date(active.startedAt).getTime();
    const realDurationSeconds = Math.max(1, Math.round((endedAtMs - startedAtMs) / 1000));

    let overtimeSeconds: number | undefined;
    if (active.type === 'pause' && active.allowedDurationMinutes) {
      const limitSec = active.allowedDurationMinutes * 60;
      overtimeSeconds = realDurationSeconds > limitSec ? realDurationSeconds - limitSec : 0;
    }

    const finalTaskTitle =
      active.type === 'sortie' && active.outingReason === 'autre' && active.customReason?.trim()
        ? `Autre : ${active.customReason.trim()}`
        : active.taskTitle.trim();

    const record: ActivityRecord = {
      id: active.id || generateUniqueId('act'),
      userId,
      type: active.type,
      taskId: active.taskId,
      taskTitle: finalTaskTitle,
      companyId: active.companyId,
      clientName: active.clientName.trim() || 'Interne',
      dossierRef:
        active.dossierRef?.trim() ||
        (active.type === 'pause'
          ? (active.pauseSlot ?? 'PAUSE').toUpperCase()
          : `SORTIE-${String(endedAtMs).slice(-5)}`),
      startedAt: active.startedAt,
      endedAt: endedAtIso,
      durationSeconds: realDurationSeconds,
      status: active.type === 'traitement' ? 'en_controle' : 'termine',
      syncStatus: 'local_en_attente',
      notes: active.notes.trim() || undefined,
      receptionChannel: active.receptionChannel as ReceptionChannel | undefined,
      receptionDateTime: active.receptionDateTime,
      recipientEmail: active.recipientEmail?.trim() || undefined,
      teamsRequesterName: active.teamsRequesterName?.trim() || undefined,
      pauseSlot: active.pauseSlot,
      allowedDurationMinutes: active.allowedDurationMinutes,
      overtimeSeconds,
      outingReason: active.outingReason,
      customReason: active.customReason?.trim() || undefined,
      authorizationStatus: active.authorizationStatus,
      authorizationRequestId: active.authorizationRequestId,
    };

    const existingActivities = this.getActivitiesForUser(userId);
    const deduplicated = [record, ...existingActivities.filter((a) => a.id !== record.id)];
    this.saveActivitiesForUser(userId, deduplicated);

    if (record.type === 'traitement') {
      const qcs = this.getQualityControls();
      const empInfo = this.getUsers().find((e) => e.id === userId);
      const qcRecord: QualityControlRecord = {
        id: generateUniqueId('qc'),
        activityId: record.id,
        dossierRef: record.dossierRef,
        employeeId: userId,
        employeeName: userMeta?.fullName ?? empInfo?.fullName ?? 'Collaborateur',
        teamId: userMeta?.teamId ?? empInfo?.teamId ?? '',
        companyId: record.companyId ?? '',
        companyName: record.clientName,
        taskId: record.taskId ?? '',
        taskName: record.taskTitle,
        treatedAt: record.endedAt,
        durationSeconds: record.durationSeconds,
        receptionChannel: record.receptionChannel,
        status: 'en_attente',
        criteriaResults: [],
        observations: '',
      };
      safeWriteJson(STORAGE_KEYS.QUALITY_CONTROLS, [qcRecord, ...qcs]);
    }

    const nextPresenceBase = this.computeLivePresenceSeconds(current, endedAtMs);

    const updatedShift: EmployeeShiftState = {
      ...current,
      serviceStatus: 'present',
      presenceSecondsBase: nextPresenceBase,
      presenceAnchorAt: endedAtIso,
      productiveSecondsBase:
        active.type === 'traitement'
          ? current.productiveSecondsBase + realDurationSeconds
          : current.productiveSecondsBase,
      pauseSecondsBase:
        active.type === 'pause'
          ? current.pauseSecondsBase + realDurationSeconds
          : current.pauseSecondsBase,
      outingSecondsBase:
        active.type === 'sortie'
          ? current.outingSecondsBase + realDurationSeconds
          : current.outingSecondsBase,
      activeTimer: null,
    };

    this.saveShiftState(updatedShift);
    return { shiftState: updatedShift, savedRecord: record };
  },

  getActivitiesForUser(userId: string): ActivityRecord[] {
    const key = `${STORAGE_KEYS.ACTIVITIES_PREFIX}${userId}`;
    const existing = safeReadJson<ActivityRecord[]>(key);
    if (existing && Array.isArray(existing)) {
      return existing;
    }
    const seeded = createInitialActivitiesForUser(userId);
    safeWriteJson(key, seeded);
    return seeded;
  },

  saveActivitiesForUser(userId: string, activities: ActivityRecord[]): void {
    const key = `${STORAGE_KEYS.ACTIVITIES_PREFIX}${userId}`;
    safeWriteJson(key, activities);
  },

  syncPendingActivitiesForUser(userId: string): ActivityRecord[] {
    const all = this.getActivitiesForUser(userId);
    const updated = all.map((a) =>
      a.syncStatus === 'local_en_attente' ? { ...a, syncStatus: 'synchronise' as const } : a
    );
    this.saveActivitiesForUser(userId, updated);
    return updated;
  },
};
