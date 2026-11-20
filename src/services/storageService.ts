import {
  AccountStatus,
  ActiveTimerSession,
  ActivityRecord,
  AppUser,
  AuditLogEntry,
  AuthorizationStatus,
  CompanyRecord,
  CorrectionRequest,
  CustomFieldValue,
  EmployeeScheduleConfig,
  EmployeeShiftState,
  FormTemplate,
  GlobalAdminConfig,
  LeaveActionTrace,
  LeaveRecord,
  LeaveStatus,
  ManagedEmployee,
  MyLeaveItem,
  OutingAuthorizationRequest,
  OutingReason,
  PauseSlot,
  Permission,
  PlanningDisplayRow,
  PlanningManualRow,
  PlanningWeekData,
  ProductionObjective,
  ProjectFormField,
  ProjectFormVersion,
  ProjectRecord,
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
  hasPermission,
  LEAVE_STATUS_LABELS,
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
  INITIAL_FORM_TEMPLATES,
  INITIAL_QUALITY_CRITERIA,
  INITIAL_REFERENCE_TIMES,
  INITIAL_TASKS,
} from '../data/mockData';
import {
  buildProvisionalPassword,
  hashPassword,
  isValidEmail,
  verifyPassword,
} from '../utils/crypto';
import {
  formatYmdFr,
  generateUniqueId,
  getMondayOfWeekYmd,
  getWeekDaysYmd,
  isSameDayYmd,
  isValidHHmm,
  isValidYmd,
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
  PROJECTS: 'owtrackers_projects_v1',
  FORM_TEMPLATES: 'owtrackers_form_templates_v1',
  LEAVES: 'owtrackers_leaves_v1',
  PLANNING_MANUAL_ROWS: 'owtrackers_planning_manual_rows_v1',
  PLANNING_DAY_ROW_COUNTS: 'owtrackers_planning_day_counts_v1',
  PLANNING_ACCESS_USERS: 'owtrackers_planning_access_users_v1',
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
    username: account.username?.trim() || undefined,
    matricule: account.matricule?.trim() || undefined,
    fullName: account.fullName,
    email: account.email?.trim() || undefined,
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
  username?: string;
  matricule?: string;
  fullName: string;
  email?: string;
  password?: string;
  role: UserRole;
  jobTitle?: string;
  site: string;
  teamId?: string;
  supervisorId?: string;
  plannedStart?: string;
  plannedEnd?: string;
  restDays?: string[];
  dailyTargetDossiers?: number;
  assignedProjectIds?: string[];
}

export interface ExcelImportCreatedAccount {
  fullName: string;
  matricule: string;
  provisionalPassword: string;
}

export interface ExcelImportExecutionResult {
  users: ManagedEmployee[];
  createdAccounts: ExcelImportCreatedAccount[];
  rejectedItems: Array<{
    rowNumber: number;
    fullName: string;
    matricule: string;
    reason: string;
  }>;
  error?: string;
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
      const m = (u.matricule ?? '').trim();
      if (!m) continue;
      const match = /^OW-(\d+)$/i.exec(m);
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
    username: string;
    fullName: string;
    email?: string;
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

    const cleanUsername = payload.username.trim();
    const fullName = payload.fullName.trim();
    const cleanEmail = payload.email?.trim().toLowerCase() ?? '';
    const password = payload.password;

    if (cleanUsername.length < 2 || /\s/.test(cleanUsername)) {
      return {
        error:
          'L’identifiant de connexion est obligatoire (2 caractères minimum, sans espace).',
      };
    }
    if (fullName.length < 2) {
      return { error: 'Veuillez renseigner le nom et le prénom.' };
    }
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      return { error: 'Veuillez saisir une adresse e-mail valide.' };
    }
    if (password.length < 8) {
      return { error: 'Le mot de passe doit contenir au moins 8 caractères.' };
    }

    const existingUsers = this.getUsers();
    if (
      existingUsers.some(
        (u) =>
          (u.username ?? '').trim().toLowerCase() === cleanUsername.toLowerCase() ||
          (u.matricule ?? '').trim().toLowerCase() === cleanUsername.toLowerCase()
      )
    ) {
      return { error: `L’identifiant "${cleanUsername}" est déjà utilisé.` };
    }

    const passwordHash = await hashPassword(password);
    const todayYmd = toYmd(new Date(clockService.nowMs()));

    const primaryAdmin: ManagedEmployee = {
      id: generateUniqueId('usr'),
      username: cleanUsername,
      matricule: undefined,
      fullName,
      email: cleanEmail || undefined,
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
      dailyTargetDossiers: undefined,
      status: 'absent',
      dossiersToday: 0,
      presenceSecondsToday: 0,
      productiveSecondsToday: 0,
      pauseSecondsToday: 0,
    };

    safeWriteJson(STORAGE_KEYS.ACCOUNTS, [primaryAdmin, ...existingUsers]);
    window.localStorage.setItem(STORAGE_KEYS.SYSTEM_INITIALIZED, 'true');
    this.setSessionUser(primaryAdmin.id);

    const appUser = buildAppUser(primaryAdmin, this.getTeams(), [primaryAdmin, ...existingUsers]);
    this.appendAuditLog(
      appUser,
      'Initialisation plateforme',
      'Aucun administrateur',
      `${primaryAdmin.fullName} (${cleanUsername})`,
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
    const account =
      accounts.find(
        (u) => Boolean(u.username?.trim()) && u.username!.trim().toLowerCase() === normalized
      ) ??
      accounts.find(
        (u) => Boolean(u.matricule?.trim()) && u.matricule!.trim().toLowerCase() === normalized
      ) ??
      accounts.find(
        (u) => Boolean(u.email?.trim()) && u.email!.trim().toLowerCase() === normalized
      );

    if (!account || !account.passwordHash) {
      return { error: 'Identifiant, matricule, e-mail ou mot de passe incorrect.' };
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
  ): Promise<{
    users: ManagedEmployee[];
    created?: ManagedEmployee;
    provisionalPassword?: string;
    error?: string;
  }> {
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
    const cleanEmail = input.email?.trim().toLowerCase() ?? '';

    if (fullName.length < 2) {
      return { users: accounts, error: 'Le nom complet est obligatoire.' };
    }

    const existingIdentifiers = new Set(
      accounts
        .flatMap((u) => [u.username ?? '', u.matricule ?? ''])
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    );

    let finalUsername: string | undefined;
    let finalMatricule: string | undefined;

    if (input.role === 'admin') {
      const cleanUsername = (input.username ?? '').trim();
      if (cleanUsername.length < 2 || /\s/.test(cleanUsername)) {
        return {
          users: accounts,
          error:
            'L’identifiant de connexion administrateur est obligatoire (2 caractères minimum, sans espace).',
        };
      }
      if (existingIdentifiers.has(cleanUsername.toLowerCase())) {
        return {
          users: accounts,
          error: `L’identifiant "${cleanUsername}" est déjà utilisé par un autre compte.`,
        };
      }
      finalUsername = cleanUsername;

      const optionalMatricule = (input.matricule ?? '').trim();
      if (optionalMatricule) {
        if (optionalMatricule.length < 2 || /\s/.test(optionalMatricule)) {
          return {
            users: accounts,
            error: 'Le matricule saisi doit contenir au moins 2 caractères sans espace.',
          };
        }
        if (
          optionalMatricule.toLowerCase() === cleanUsername.toLowerCase() ||
          existingIdentifiers.has(optionalMatricule.toLowerCase())
        ) {
          return {
            users: accounts,
            error: `Le matricule "${optionalMatricule}" est déjà utilisé.`,
          };
        }
        finalMatricule = optionalMatricule;
      }
    } else {
      const cleanMatricule =
        input.matricule !== undefined ? input.matricule.trim() : this.generateNextMatricule();
      if (cleanMatricule.length < 2 || /\s/.test(cleanMatricule)) {
        return {
          users: accounts,
          error: 'Le matricule est obligatoire (2 caractères minimum, sans espace).',
        };
      }
      if (existingIdentifiers.has(cleanMatricule.toLowerCase())) {
        return {
          users: accounts,
          error: `Le matricule "${cleanMatricule}" est déjà attribué à un autre compte.`,
        };
      }
      finalMatricule = cleanMatricule;
    }

    if (cleanEmail && !isValidEmail(cleanEmail)) {
      return { users: accounts, error: 'Veuillez saisir une adresse e-mail valide.' };
    }
    if (
      cleanEmail &&
      accounts.some((u) => (u.email ?? '').trim().toLowerCase() === cleanEmail)
    ) {
      return { users: accounts, error: 'Cette adresse e-mail est déjà utilisée.' };
    }

    const rawPassword = input.password ?? '';
    const hasCustomPassword = rawPassword.trim().length > 0;
    if (input.role === 'admin' && !hasCustomPassword) {
      return {
        users: accounts,
        error: 'Un mot de passe (8 caractères minimum) est obligatoire pour un compte administrateur.',
      };
    }
    if (hasCustomPassword && rawPassword.length < 8) {
      return {
        users: accounts,
        error: 'Le mot de passe personnalisé doit contenir au moins 8 caractères.',
      };
    }

    let finalDailyTarget: number | undefined;
    if (input.role === 'employee') {
      if (input.dailyTargetDossiers !== undefined && input.dailyTargetDossiers !== null) {
        if (
          typeof input.dailyTargetDossiers !== 'number' ||
          !Number.isInteger(input.dailyTargetDossiers) ||
          input.dailyTargetDossiers < 1
        ) {
          return {
            users: accounts,
            error: 'L’objectif journalier doit être un nombre entier positif (1 minimum).',
          };
        }
        finalDailyTarget = input.dailyTargetDossiers;
      }
    }

    if (input.assignedProjectIds !== undefined) {
      const projAssignErr = this._validateRequestedProjectIds(input.assignedProjectIds, actor);
      if (projAssignErr) {
        return { users: accounts, error: projAssignErr };
      }
    }

    const provisionalPassword =
      !hasCustomPassword && finalMatricule
        ? buildProvisionalPassword(finalMatricule)
        : undefined;
    const effectivePassword = hasCustomPassword ? rawPassword : provisionalPassword!;
    const passwordHash = await hashPassword(effectivePassword);
    const todayYmd = toYmd(new Date(clockService.nowMs()));

    const created: ManagedEmployee = {
      id: generateUniqueId('usr'),
      username: finalUsername,
      matricule: finalMatricule,
      fullName,
      email: cleanEmail || undefined,
      role: input.role,
      isPrimaryAdmin: false,
      passwordHash,
      jobTitle: input.jobTitle?.trim() || ROLE_LABELS[input.role],
      hireDate: todayYmd,
      accountStatus: 'actif',
      site: input.site.trim() || (input.role === 'admin' ? 'Direction' : 'Siège'),
      teamId: input.role === 'employee' || input.role === 'supervisor' ? input.teamId ?? '' : '',
      supervisorId: input.role === 'employee' ? input.supervisorId ?? '' : '',
      plannedStart: input.plannedStart ?? '08:30',
      plannedEnd: input.plannedEnd ?? '17:00',
      restDays: input.restDays?.length ? input.restDays : ['Samedi', 'Dimanche'],
      dailyTargetDossiers: finalDailyTarget,
      status: 'absent',
      dossiersToday: 0,
      presenceSecondsToday: 0,
      productiveSecondsToday: 0,
      pauseSecondsToday: 0,
    };

    const next = [created, ...accounts];
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, next);

    if ((created.role === 'employee' || created.role === 'supervisor') && created.matricule) {
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

    if (
      input.assignedProjectIds !== undefined &&
      (created.role === 'employee' || created.role === 'supervisor')
    ) {
      this._syncUserProjectAssignments(created, input.assignedProjectIds, actor);
    }

    const displayId = created.username ?? created.matricule ?? '—';
    this.appendAuditLog(
      actor,
      `Compte créé · ${ROLE_LABELS[created.role]}`,
      '—',
      `${created.fullName} (${displayId})`
    );

    return { users: next, created, provisionalPassword };
  },

  async importEmployeesFromExcel(
    rows: Array<{ rowNumber: number; fullName: string; matricule: string }>,
    actor: AppUser
  ): Promise<ExcelImportExecutionResult> {
    const accounts = this.getUsers();

    if (actor.role !== 'admin' && actor.role !== 'manager') {
      return {
        users: accounts,
        createdAccounts: [],
        rejectedItems: [],
        error: 'Votre rôle ne permet pas d’importer des comptes employés.',
      };
    }

    const knownMatricules = new Set(
      accounts
        .flatMap((u) => [u.matricule ?? '', u.username ?? ''])
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    );
    const todayYmd = toYmd(new Date(clockService.nowMs()));

    const newEmployees: ManagedEmployee[] = [];
    const newSchedules: EmployeeScheduleConfig[] = [];
    const createdAccounts: ExcelImportCreatedAccount[] = [];
    const rejectedItems: ExcelImportExecutionResult['rejectedItems'] = [];

    for (const row of rows) {
      const cleanName = row.fullName.trim().replace(/\s+/g, ' ');
      const cleanMatricule = row.matricule.trim();
      const matriculeKey = cleanMatricule.toLowerCase();

      if (cleanName.length < 2) {
        rejectedItems.push({
          rowNumber: row.rowNumber,
          fullName: cleanName,
          matricule: cleanMatricule,
          reason: 'Nom complet invalide.',
        });
        continue;
      }

      if (cleanMatricule.length < 2 || /\s/.test(cleanMatricule)) {
        rejectedItems.push({
          rowNumber: row.rowNumber,
          fullName: cleanName,
          matricule: cleanMatricule,
          reason: 'Matricule invalide.',
        });
        continue;
      }

      if (knownMatricules.has(matriculeKey)) {
        rejectedItems.push({
          rowNumber: row.rowNumber,
          fullName: cleanName,
          matricule: cleanMatricule,
          reason: 'Matricule déjà existant dans OWTrackers (compte conservé).',
        });
        continue;
      }

      knownMatricules.add(matriculeKey);
      const provisionalPassword = buildProvisionalPassword(cleanMatricule);
      const passwordHash = await hashPassword(provisionalPassword);

      const emp: ManagedEmployee = {
        id: generateUniqueId('usr'),
        matricule: cleanMatricule,
        fullName: cleanName,
        email: undefined,
        role: 'employee',
        isPrimaryAdmin: false,
        passwordHash,
        jobTitle: ROLE_LABELS.employee,
        hireDate: todayYmd,
        accountStatus: 'actif',
        site: 'Siège',
        teamId: '',
        supervisorId: '',
        plannedStart: '08:30',
        plannedEnd: '17:00',
        restDays: ['Samedi', 'Dimanche'],
        dailyTargetDossiers: undefined,
        status: 'absent',
        dossiersToday: 0,
        presenceSecondsToday: 0,
        productiveSecondsToday: 0,
        pauseSecondsToday: 0,
      };

      newEmployees.push(emp);
      newSchedules.push({
        userId: emp.id,
        employeeName: emp.fullName,
        matricule: emp.matricule ?? '',
        teamId: '',
        teamName: '',
        plannedStart: emp.plannedStart,
        plannedEnd: emp.plannedEnd,
        restDays: emp.restDays,
        isCustom: false,
      });
      createdAccounts.push({
        fullName: emp.fullName,
        matricule: emp.matricule ?? '',
        provisionalPassword,
      });
    }

    if (newEmployees.length === 0) {
      return {
        users: accounts,
        createdAccounts: [],
        rejectedItems,
      };
    }

    const updatedUsers = [...newEmployees, ...accounts];
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, updatedUsers);

    const existingSchedules = this.getSchedules();
    safeWriteJson(STORAGE_KEYS.SCHEDULES, [...existingSchedules, ...newSchedules]);

    const previewMatricules = createdAccounts
      .slice(0, 8)
      .map((c) => c.matricule)
      .join(', ');
    const suffix = createdAccounts.length > 8 ? ` (+${createdAccounts.length - 8} autres)` : '';

    this.appendAuditLog(
      actor,
      'Import Excel employés',
      '—',
      `${createdAccounts.length} employé(s) créé(s) : ${previewMatricules}${suffix}`,
      `${rejectedItems.length} ligne(s) ignorée(s)`
    );

    return {
      users: updatedUsers,
      createdAccounts,
      rejectedItems,
    };
  },

  async updateManagedUser(
    userId: string,
    patch: Partial<
      Pick<
        ManagedEmployee,
        | 'username'
        | 'matricule'
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
    options?: { newPassword?: string; reason?: string; assignedProjectIds?: string[] }
  ): Promise<{ users: ManagedEmployee[]; error?: string }> {
    const list = this.getUsers();
    const existing = list.find((e) => e.id === userId);
    if (!existing) {
      return { users: list, error: 'Compte introuvable.' };
    }

    if (options?.assignedProjectIds !== undefined) {
      const projAssignErr = this._validateRequestedProjectIds(options.assignedProjectIds, actor);
      if (projAssignErr) {
        return { users: list, error: projAssignErr };
      }
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
      patch.accountStatus !== undefined &&
      patch.accountStatus !== existing.accountStatus
    ) {
      if (actor.role !== 'admin') {
        return {
          users: list,
          error: 'Seul un administrateur peut désactiver ou réactiver un compte utilisateur.',
        };
      }
      if (patch.accountStatus !== 'actif') {
        if (existing.id === actor.id) {
          return {
            users: list,
            error: 'Vous ne pouvez pas désactiver votre propre compte administrateur.',
          };
        }
        if (existing.isPrimaryAdmin) {
          return {
            users: list,
            error: 'Le compte de l’administrateur principal ne peut pas être désactivé.',
          };
        }
        if (existing.role === 'admin') {
          const remainingActiveAdmins = list.filter(
            (u) => u.id !== existing.id && u.role === 'admin' && u.accountStatus === 'actif'
          );
          if (remainingActiveAdmins.length === 0) {
            return {
              users: list,
              error: 'Impossible de désactiver le dernier administrateur actif.',
            };
          }
        }
      }
    }

    const nextEmail =
      patch.email !== undefined
        ? patch.email.trim().toLowerCase()
        : (existing.email ?? '').trim().toLowerCase();
    if (nextEmail && !isValidEmail(nextEmail)) {
      return { users: list, error: 'Veuillez saisir une adresse e-mail valide.' };
    }
    if (
      nextEmail &&
      list.some((u) => u.id !== userId && (u.email ?? '').trim().toLowerCase() === nextEmail)
    ) {
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

    const nextRole = patch.role ?? existing.role;
    const otherIdentifiers = new Set(
      list
        .filter((u) => u.id !== userId)
        .flatMap((u) => [u.username ?? '', u.matricule ?? ''])
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    );

    const requestedUsername =
      patch.username !== undefined ? patch.username.trim() : undefined;
    const requestedMatricule =
      patch.matricule !== undefined ? patch.matricule.trim() : undefined;

    if (
      requestedUsername !== undefined &&
      requestedUsername !== (existing.username ?? '') &&
      actor.role !== 'admin'
    ) {
      return {
        users: list,
        error: 'Seul un administrateur peut modifier l’identifiant de connexion.',
      };
    }

    if (
      requestedMatricule !== undefined &&
      requestedMatricule !== (existing.matricule ?? '') &&
      actor.role !== 'admin'
    ) {
      return {
        users: list,
        error: 'Seul un administrateur peut modifier le matricule après la création du compte.',
      };
    }

    let finalUsername = existing.username;
    if (nextRole === 'admin') {
      const candidate =
        requestedUsername !== undefined ? requestedUsername : (existing.username ?? '').trim();
      if (candidate.length < 2 || /\s/.test(candidate)) {
        return {
          users: list,
          error:
            'L’identifiant administrateur est obligatoire (2 caractères minimum, sans espace).',
        };
      }
      if (otherIdentifiers.has(candidate.toLowerCase())) {
        return { users: list, error: `L’identifiant "${candidate}" est déjà utilisé.` };
      }
      finalUsername = candidate;
    }

    let finalMatricule = existing.matricule;
    if (nextRole !== 'admin') {
      const candidate =
        requestedMatricule !== undefined ? requestedMatricule : (existing.matricule ?? '').trim();
      if (candidate.length < 2 || /\s/.test(candidate)) {
        return {
          users: list,
          error: 'Le matricule est obligatoire (2 caractères minimum, sans espace).',
        };
      }
      if (
        (finalUsername && candidate.toLowerCase() === finalUsername.toLowerCase()) ||
        otherIdentifiers.has(candidate.toLowerCase())
      ) {
        return { users: list, error: `Le matricule "${candidate}" est déjà utilisé.` };
      }
      finalMatricule = candidate;
    } else if (requestedMatricule !== undefined) {
      if (requestedMatricule === '') {
        finalMatricule = undefined;
      } else {
        if (requestedMatricule.length < 2 || /\s/.test(requestedMatricule)) {
          return {
            users: list,
            error: 'Le matricule saisi doit contenir au moins 2 caractères sans espace.',
          };
        }
        if (
          (finalUsername && requestedMatricule.toLowerCase() === finalUsername.toLowerCase()) ||
          otherIdentifiers.has(requestedMatricule.toLowerCase())
        ) {
          return { users: list, error: `Le matricule "${requestedMatricule}" est déjà utilisé.` };
        }
        finalMatricule = requestedMatricule;
      }
    }

    let nextDailyTarget: number | undefined = existing.dailyTargetDossiers;
    if (nextRole !== 'employee') {
      nextDailyTarget = undefined;
    } else if ('dailyTargetDossiers' in patch) {
      if (patch.dailyTargetDossiers === undefined || patch.dailyTargetDossiers === null) {
        nextDailyTarget = undefined;
      } else if (
        typeof patch.dailyTargetDossiers !== 'number' ||
        !Number.isInteger(patch.dailyTargetDossiers) ||
        patch.dailyTargetDossiers < 1
      ) {
        return {
          users: list,
          error: 'L’objectif journalier doit être un nombre entier positif (1 minimum).',
        };
      } else {
        nextDailyTarget = patch.dailyTargetDossiers;
      }
    }

    const updated: ManagedEmployee = {
      ...existing,
      ...patch,
      fullName: patch.fullName !== undefined ? patch.fullName.trim() : existing.fullName,
      email: nextEmail || undefined,
      passwordHash: nextPasswordHash,
      id: existing.id,
      username: finalUsername,
      matricule: finalMatricule,
      dailyTargetDossiers: nextDailyTarget,
      isPrimaryAdmin: existing.isPrimaryAdmin,
    };

    const next = list.map((e) => (e.id === existing.id ? updated : e));
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, next);

    if (
      options?.assignedProjectIds !== undefined &&
      (updated.role === 'employee' || updated.role === 'supervisor')
    ) {
      this._syncUserProjectAssignments(updated, options.assignedProjectIds, actor);
    }

    const teamName = this.getTeams().find((t) => t.id === updated.teamId)?.name ?? '';
    const schedules = this.getSchedules();
    const hasSchedule = schedules.some((s) => s.userId === updated.id);
    if (hasSchedule) {
      const nextSchedules = schedules.map((s) =>
        s.userId === updated.id
          ? {
              ...s,
              employeeName: updated.fullName,
              matricule: updated.matricule ?? s.matricule,
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

    if ((existing.matricule ?? '') !== (updated.matricule ?? '')) {
      this.appendAuditLog(
        actor,
        `Matricule modifié · ${updated.fullName}`,
        existing.matricule ?? '—',
        updated.matricule ?? '—',
        options?.reason
      );
    }

    if ((existing.username ?? '') !== (updated.username ?? '')) {
      this.appendAuditLog(
        actor,
        `Identifiant modifié · ${updated.fullName}`,
        existing.username ?? '—',
        updated.username ?? '—',
        options?.reason
      );
    }

    if (existing.accountStatus !== updated.accountStatus) {
      const idLabel = updated.matricule || updated.username || '—';
      const statusLabel = (s: AccountStatus) =>
        s === 'actif' ? 'Actif' : s === 'desactive' ? 'Désactivé' : 'Archivé';
      this.appendAuditLog(
        actor,
        `${updated.accountStatus === 'actif' ? 'Réactivation compte' : 'Désactivation compte'} · ${updated.fullName} (${idLabel})`,
        statusLabel(existing.accountStatus),
        statusLabel(updated.accountStatus),
        options?.reason
      );
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

    if (actor.role !== 'admin') {
      return {
        users: list,
        error: 'Seul un administrateur peut désactiver ou réactiver un compte utilisateur.',
      };
    }

    if (status !== 'actif' && target.id === actor.id) {
      return {
        users: list,
        error: 'Vous ne pouvez pas désactiver votre propre compte administrateur.',
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
          error: 'Impossible de désactiver le dernier administrateur actif.',
        };
      }
    }

    const next = list.map((e) => (e.id === employeeId ? { ...e, accountStatus: status } : e));
    safeWriteJson(STORAGE_KEYS.ACCOUNTS, next);

    const statusLabel = (s: AccountStatus) =>
      s === 'actif' ? 'Actif' : s === 'desactive' ? 'Désactivé' : 'Archivé';
    const targetIdLabel = target.matricule || target.username || '—';
    const actionLabel =
      status === 'actif'
        ? `Réactivation compte · ${target.fullName} (${targetIdLabel})`
        : `Désactivation compte · ${target.fullName} (${targetIdLabel})`;

    this.appendAuditLog(
      actor,
      actionLabel,
      statusLabel(target.accountStatus),
      statusLabel(status),
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
      dossierRef:
        payload.activity.dossierRef ||
        (payload.activity.formVersionNumber
          ? `v${payload.activity.formVersionNumber}`
          : '—'),
      activityLabel:
        payload.activity.taskTitle || payload.activity.projectName || 'Traitement',
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

  // --- Gestion des congés & Planning (avec contrôle strict des autorisations) ---
  getPlanningAuthorizedUserIds(): string[] {
    const existing = safeReadJson<string[]>(STORAGE_KEYS.PLANNING_ACCESS_USERS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.PLANNING_ACCESS_USERS, []);
    return [];
  },

  canUserAccessPlanning(actorOrId: AppUser | string): boolean {
    const actorId = typeof actorOrId === 'string' ? actorOrId : actorOrId.id;
    const account = this.getUsers().find((u) => u.id === actorId);
    if (!account || account.accountStatus !== 'actif') return false;
    if (account.role === 'admin') return true;
    return this.getPlanningAuthorizedUserIds().includes(account.id);
  },

  setUserPlanningAccess(
    targetUserId: string,
    authorized: boolean,
    actor: AppUser
  ): { authorizedUserIds: string[]; error?: string } {
    const actorAccount = this.getUsers().find((u) => u.id === actor.id);
    if (!actorAccount || actorAccount.accountStatus !== 'actif' || actorAccount.role !== 'admin') {
      return {
        authorizedUserIds: this.getPlanningAuthorizedUserIds(),
        error: 'Seul un administrateur actif peut gérer les autorisations d’accès au Planning.',
      };
    }

    const target = this.getUsers().find((u) => u.id === targetUserId);
    if (!target) {
      return {
        authorizedUserIds: this.getPlanningAuthorizedUserIds(),
        error: 'Utilisateur introuvable.',
      };
    }

    if (target.role === 'admin') {
      return {
        authorizedUserIds: this.getPlanningAuthorizedUserIds(),
        error: 'Les administrateurs disposent déjà d’un accès complet au Planning.',
      };
    }

    const current = this.getPlanningAuthorizedUserIds();
    const next = authorized
      ? Array.from(new Set([...current, targetUserId]))
      : current.filter((id) => id !== targetUserId);
    safeWriteJson(STORAGE_KEYS.PLANNING_ACCESS_USERS, next);

    const idLabel = target.matricule || target.username || target.id;
    this.appendAuditLog(
      actor,
      `Accès Planning · ${target.fullName} (${idLabel})`,
      current.includes(targetUserId) ? 'Autorisé' : 'Non autorisé',
      authorized ? 'Autorisé' : 'Non autorisé'
    );

    return { authorizedUserIds: next };
  },

  canUserManageLeaves(actorOrId: AppUser | string): boolean {
    const actorId = typeof actorOrId === 'string' ? actorOrId : actorOrId.id;
    const account = this.getUsers().find((u) => u.id === actorId);
    if (!account || account.accountStatus !== 'actif') return false;
    if (account.role === 'admin' || account.role === 'manager') return true;
    if (account.role === 'supervisor') {
      return hasPermission('supervisor', 'manage:leaves', this.getSupervisorPermissions());
    }
    return false;
  },

  _isEmployeeInActorLeaveScope(
    actorAccount: ManagedEmployee,
    targetEmployee: ManagedEmployee,
    accounts: ManagedEmployee[],
    teams: TeamRecord[]
  ): boolean {
    if (actorAccount.role === 'admin' || actorAccount.role === 'manager') {
      return targetEmployee.role !== 'admin' && Boolean(targetEmployee.matricule?.trim());
    }
    if (actorAccount.role === 'supervisor') {
      if (targetEmployee.role !== 'employee') return false;
      const supTeamIds = Array.from(
        new Set(
          [
            actorAccount.teamId,
            ...teams.filter((t) => t.supervisorId === actorAccount.id).map((t) => t.id),
          ].filter(Boolean)
        )
      );
      const hasExplicitScope =
        supTeamIds.length > 0 || accounts.some((u) => u.supervisorId === actorAccount.id);
      if (!hasExplicitScope) return true;
      return (
        supTeamIds.includes(targetEmployee.teamId) ||
        targetEmployee.supervisorId === actorAccount.id
      );
    }
    return false;
  },

  getManageableEmployeesForLeaves(actor: AppUser): ManagedEmployee[] {
    const accounts = this.getUsers();
    const actorAccount = accounts.find((u) => u.id === actor.id);
    if (!actorAccount || actorAccount.accountStatus !== 'actif' || !this.canUserManageLeaves(actor)) {
      return [];
    }
    const teams = this.getTeams();
    const roleRank: Record<UserRole, number> = {
      employee: 0,
      supervisor: 1,
      manager: 2,
      admin: 3,
    };
    return accounts
      .filter(
        (emp) =>
          emp.accountStatus === 'actif' &&
          this._isEmployeeInActorLeaveScope(actorAccount, emp, accounts, teams)
      )
      .sort((a, b) => {
        const rankDiff = roleRank[a.role] - roleRank[b.role];
        if (rankDiff !== 0) return rankDiff;
        return a.fullName.localeCompare(b.fullName, 'fr');
      });
  },

  _readAllLeavesRaw(): LeaveRecord[] {
    const existing = safeReadJson<Array<LeaveRecord & { status: string; validatedAt?: string }>>(
      STORAGE_KEYS.LEAVES
    );
    if (existing && Array.isArray(existing)) {
      return existing.map((lv) => {
        const normalizedStatus: LeaveStatus =
          lv.status === 'en_attente' || lv.status === 'valide' || lv.status === 'refuse'
            ? lv.status
            : lv.status === 'annule'
            ? 'refuse'
            : 'en_attente';
        return {
          ...lv,
          status: normalizedStatus,
          createdAt: lv.createdAt ?? lv.validatedAt ?? clockService.nowIso(),
        };
      });
    }
    safeWriteJson(STORAGE_KEYS.LEAVES, []);
    return [];
  },

  getLeavesForManagement(actor: AppUser): { leaves: LeaveRecord[]; error?: string } {
    const accounts = this.getUsers();
    const actorAccount = accounts.find((u) => u.id === actor.id);
    if (!actorAccount || actorAccount.accountStatus !== 'actif' || !this.canUserManageLeaves(actor)) {
      return { leaves: [], error: 'Accès refusé au module Gestion des congés.' };
    }
    const all = this._readAllLeavesRaw();
    const teams = this.getTeams();
    const filtered =
      actorAccount.role === 'supervisor'
        ? all.filter((leave) => {
            const emp = accounts.find((u) => u.id === leave.employeeId);
            if (!emp) return false;
            return this._isEmployeeInActorLeaveScope(actorAccount, emp, accounts, teams);
          })
        : all;

    return {
      leaves: [...filtered].sort((a, b) =>
        (b.createdAt ?? b.validatedAt ?? '').localeCompare(a.createdAt ?? a.validatedAt ?? '')
      ),
    };
  },

  createLeave(
    input: {
      employeeId: string;
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
      motif?: string;
      status?: LeaveStatus;
    },
    actor: AppUser
  ): { leaves: LeaveRecord[]; created?: LeaveRecord; error?: string } {
    const accounts = this.getUsers();
    const actorAccount = accounts.find((u) => u.id === actor.id);
    const currentScoped = this.getLeavesForManagement(actor).leaves;

    if (!actorAccount || actorAccount.accountStatus !== 'actif' || !this.canUserManageLeaves(actor)) {
      return {
        leaves: currentScoped,
        error: 'Vous n’êtes pas autorisé à enregistrer des demandes de congé.',
      };
    }

    const target = accounts.find((u) => u.id === input.employeeId);
    if (!target || target.accountStatus !== 'actif') {
      return {
        leaves: currentScoped,
        error: 'Veuillez sélectionner un employé actif valide.',
      };
    }

    const teams = this.getTeams();
    if (!this._isEmployeeInActorLeaveScope(actorAccount, target, accounts, teams)) {
      return {
        leaves: currentScoped,
        error: 'Cet employé ne relève pas de votre périmètre de gestion des congés.',
      };
    }

    const startDate = input.startDate.trim();
    const endDate = input.endDate.trim();
    const startTime = input.startTime.trim();
    const endTime = input.endTime.trim();
    const cleanMotif = input.motif?.trim() || undefined;
    const status: LeaveStatus =
      input.status === 'valide' || input.status === 'refuse' || input.status === 'en_attente'
        ? input.status
        : 'en_attente';

    if (!isValidYmd(startDate) || !isValidYmd(endDate)) {
      return {
        leaves: currentScoped,
        error: 'Veuillez renseigner des dates de début et de fin valides.',
      };
    }
    if (endDate < startDate) {
      return {
        leaves: currentScoped,
        error: 'La date de fin doit être postérieure ou égale à la date de début.',
      };
    }
    if (!isValidHHmm(startTime) || !isValidHHmm(endTime)) {
      return {
        leaves: currentScoped,
        error: 'Veuillez renseigner des heures de début et de fin valides (HH:MM).',
      };
    }
    if (endTime <= startTime) {
      return {
        leaves: currentScoped,
        error: 'L’heure de fin doit être strictement postérieure à l’heure de début.',
      };
    }

    const allLeaves = this._readAllLeavesRaw();
    if (status === 'valide') {
      const hasConflict = allLeaves.some(
        (existing) =>
          existing.status === 'valide' &&
          existing.employeeId === target.id &&
          existing.startDate <= endDate &&
          startDate <= existing.endDate &&
          existing.startTime < endTime &&
          startTime < existing.endTime
      );
      if (hasConflict) {
        return {
          leaves: currentScoped,
          error: 'Un congé validé existe déjà pour cet employé sur ce créneau.',
        };
      }
    }

    const nowIso = clockService.nowIso();
    const periodLabel =
      startDate === endDate
        ? `${formatYmdFr(startDate)} (${startTime}–${endTime})`
        : `${formatYmdFr(startDate)} → ${formatYmdFr(endDate)} (${startTime}–${endTime})`;

    const trace: LeaveActionTrace = {
      id: generateUniqueId('lvt'),
      action: 'creation',
      actorId: actorAccount.id,
      actorName: actorAccount.fullName,
      actorRole: actorAccount.role,
      timestamp: nowIso,
      newStatus: status,
      details: `Demande enregistrée (${LEAVE_STATUS_LABELS[status]}) : ${periodLabel}${
        cleanMotif ? ` · Motif : ${cleanMotif}` : ''
      }`,
    };

    const created: LeaveRecord = {
      id: generateUniqueId('lv'),
      employeeId: target.id,
      employeeNameSnapshot: target.fullName,
      employeeMatriculeSnapshot: target.matricule ?? '',
      startDate,
      endDate,
      startTime,
      endTime,
      motif: cleanMotif,
      status,
      createdById: actorAccount.id,
      createdByName: actorAccount.fullName,
      createdByRole: actorAccount.role,
      createdAt: nowIso,
      validatedAt: status === 'valide' ? nowIso : undefined,
      history: [trace],
    };

    const nextAll = [created, ...allLeaves];
    safeWriteJson(STORAGE_KEYS.LEAVES, nextAll);

    this.appendAuditLog(
      actor,
      `Congé (${LEAVE_STATUS_LABELS[status]}) · ${target.fullName} (${target.matricule ?? '—'})`,
      '—',
      periodLabel,
      cleanMotif
    );

    return {
      leaves: this.getLeavesForManagement(actor).leaves,
      created,
    };
  },

  updateLeave(
    leaveId: string,
    patch: {
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
      motif?: string;
      status: LeaveStatus;
    },
    actor: AppUser
  ): { leaves: LeaveRecord[]; updated?: LeaveRecord; error?: string } {
    const accounts = this.getUsers();
    const actorAccount = accounts.find((u) => u.id === actor.id);
    const currentScoped = this.getLeavesForManagement(actor).leaves;

    if (!actorAccount || actorAccount.accountStatus !== 'actif' || !this.canUserManageLeaves(actor)) {
      return {
        leaves: currentScoped,
        error: 'Vous n’êtes pas autorisé à modifier les demandes de congé.',
      };
    }

    const allLeaves = this._readAllLeavesRaw();
    const existing = allLeaves.find((l) => l.id === leaveId);
    if (!existing) {
      return { leaves: currentScoped, error: 'Demande de congé introuvable.' };
    }

    const target = accounts.find((u) => u.id === existing.employeeId);
    const teams = this.getTeams();
    if (
      actorAccount.role === 'supervisor' &&
      (!target || !this._isEmployeeInActorLeaveScope(actorAccount, target, accounts, teams))
    ) {
      return {
        leaves: currentScoped,
        error: 'Vous ne pouvez modifier que les congés des employés de votre périmètre.',
      };
    }

    const startDate = patch.startDate.trim();
    const endDate = patch.endDate.trim();
    const startTime = patch.startTime.trim();
    const endTime = patch.endTime.trim();
    const cleanMotif = patch.motif?.trim() || undefined;
    const nextStatus: LeaveStatus =
      patch.status === 'valide' || patch.status === 'refuse' || patch.status === 'en_attente'
        ? patch.status
        : existing.status;

    if (!isValidYmd(startDate) || !isValidYmd(endDate)) {
      return {
        leaves: currentScoped,
        error: 'Veuillez renseigner des dates de début et de fin valides.',
      };
    }
    if (endDate < startDate) {
      return {
        leaves: currentScoped,
        error: 'La date de fin doit être postérieure ou égale à la date de début.',
      };
    }
    if (!isValidHHmm(startTime) || !isValidHHmm(endTime)) {
      return {
        leaves: currentScoped,
        error: 'Veuillez renseigner des heures de début et de fin valides (HH:MM).',
      };
    }
    if (endTime <= startTime) {
      return {
        leaves: currentScoped,
        error: 'L’heure de fin doit être strictement postérieure à l’heure de début.',
      };
    }

    if (nextStatus === 'valide') {
      const hasConflict = allLeaves.some(
        (other) =>
          other.id !== existing.id &&
          other.status === 'valide' &&
          other.employeeId === existing.employeeId &&
          other.startDate <= endDate &&
          startDate <= other.endDate &&
          other.startTime < endTime &&
          startTime < other.endTime
      );
      if (hasConflict) {
        return {
          leaves: currentScoped,
          error: 'Un autre congé validé existe déjà pour cet employé sur ce créneau.',
        };
      }
    }

    const nowIso = clockService.nowIso();
    const prevLabel =
      existing.startDate === existing.endDate
        ? `${formatYmdFr(existing.startDate)} (${existing.startTime}–${existing.endTime})`
        : `${formatYmdFr(existing.startDate)} → ${formatYmdFr(existing.endDate)} (${existing.startTime}–${existing.endTime})`;
    const nextLabel =
      startDate === endDate
        ? `${formatYmdFr(startDate)} (${startTime}–${endTime})`
        : `${formatYmdFr(startDate)} → ${formatYmdFr(endDate)} (${startTime}–${endTime})`;

    const statusChanged = existing.status !== nextStatus;
    const fieldsChanged =
      existing.startDate !== startDate ||
      existing.endDate !== endDate ||
      existing.startTime !== startTime ||
      existing.endTime !== endTime ||
      (existing.motif ?? '') !== (cleanMotif ?? '');

    const detailParts: string[] = [];
    if (statusChanged) {
      detailParts.push(
        `Statut : ${LEAVE_STATUS_LABELS[existing.status]} → ${LEAVE_STATUS_LABELS[nextStatus]}`
      );
    }
    if (
      existing.startDate !== startDate ||
      existing.endDate !== endDate ||
      existing.startTime !== startTime ||
      existing.endTime !== endTime
    ) {
      detailParts.push(`Période : ${prevLabel} → ${nextLabel}`);
    }
    if ((existing.motif ?? '') !== (cleanMotif ?? '')) {
      detailParts.push(`Motif : ${cleanMotif ?? 'Aucun'}`);
    }
    if (detailParts.length === 0) {
      detailParts.push(`Enregistré (${LEAVE_STATUS_LABELS[nextStatus]})`);
    }

    const trace: LeaveActionTrace = {
      id: generateUniqueId('lvt'),
      action: statusChanged && !fieldsChanged ? 'statut' : 'modification',
      actorId: actorAccount.id,
      actorName: actorAccount.fullName,
      actorRole: actorAccount.role,
      timestamp: nowIso,
      oldStatus: existing.status,
      newStatus: nextStatus,
      details: detailParts.join(' · '),
    };

    const updated: LeaveRecord = {
      ...existing,
      startDate,
      endDate,
      startTime,
      endTime,
      motif: cleanMotif,
      status: nextStatus,
      validatedAt: nextStatus === 'valide' ? existing.validatedAt ?? nowIso : existing.validatedAt,
      updatedById: actorAccount.id,
      updatedByName: actorAccount.fullName,
      updatedByRole: actorAccount.role,
      updatedAt: nowIso,
      history: [trace, ...(existing.history ?? [])],
    };

    const nextAll = allLeaves.map((l) => (l.id === leaveId ? updated : l));
    safeWriteJson(STORAGE_KEYS.LEAVES, nextAll);

    const empName = target?.fullName ?? existing.employeeNameSnapshot;
    const empMatricule = target?.matricule ?? existing.employeeMatriculeSnapshot;
    this.appendAuditLog(
      actor,
      `Congé modifié · ${empName} (${empMatricule || '—'})`,
      `${LEAVE_STATUS_LABELS[existing.status]} · ${prevLabel}`,
      `${LEAVE_STATUS_LABELS[nextStatus]} · ${nextLabel}`,
      cleanMotif
    );

    return {
      leaves: this.getLeavesForManagement(actor).leaves,
      updated,
    };
  },

  updateLeaveStatus(
    leaveId: string,
    nextStatus: LeaveStatus,
    actor: AppUser
  ): { leaves: LeaveRecord[]; updated?: LeaveRecord; error?: string } {
    const allLeaves = this._readAllLeavesRaw();
    const existing = allLeaves.find((l) => l.id === leaveId);
    if (!existing) {
      return {
        leaves: this.getLeavesForManagement(actor).leaves,
        error: 'Demande de congé introuvable.',
      };
    }
    return this.updateLeave(
      leaveId,
      {
        startDate: existing.startDate,
        endDate: existing.endDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
        motif: existing.motif,
        status: nextStatus,
      },
      actor
    );
  },

  _readPlanningManualRows(): PlanningManualRow[] {
    const existing = safeReadJson<PlanningManualRow[]>(STORAGE_KEYS.PLANNING_MANUAL_ROWS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.PLANNING_MANUAL_ROWS, []);
    return [];
  },

  _readPlanningDayRowCounts(): Record<string, number> {
    const existing = safeReadJson<Record<string, number>>(STORAGE_KEYS.PLANNING_DAY_ROW_COUNTS);
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.PLANNING_DAY_ROW_COUNTS, {});
    return {};
  },

  getMyLeaves(userId: string): MyLeaveItem[] {
    const allLeaves = this._readAllLeavesRaw();
    return allLeaves
      .filter((l) => l.employeeId === userId)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .map((leave) => ({
        id: leave.id,
        startDate: leave.startDate,
        endDate: leave.endDate,
        startTime: leave.startTime,
        endTime: leave.endTime,
        motif: leave.motif,
        status: leave.status,
        createdAt: leave.createdAt,
      }));
  },

  getMyValidatedLeaves(userId: string): MyLeaveItem[] {
    return this.getMyLeaves(userId);
  },

  getPlanningWeekData(
    weekStartYmdInput: string,
    actor: AppUser
  ): { data?: PlanningWeekData; error?: string } {
    if (!this.canUserAccessPlanning(actor)) {
      return {
        error: 'Accès refusé : vous n’êtes pas autorisé à consulter le Planning.',
      };
    }

    const weekStartYmd = getMondayOfWeekYmd(
      isValidYmd(weekStartYmdInput) ? weekStartYmdInput : toYmd(new Date(clockService.nowMs()))
    );
    const weekDays = getWeekDaysYmd(weekStartYmd);
    const weekEndYmd = weekDays[weekDays.length - 1].dateYmd;

    const manualRows = this._readPlanningManualRows();
    const dayCounts = this._readPlanningDayRowCounts();

    const days = weekDays.map((day) => {
      const manualForDay = manualRows.filter((m) => m.dateYmd === day.dateYmd);
      const highestSlot = manualForDay.reduce((max, r) => Math.max(max, r.slotIndex), -1);
      const storedCount = dayCounts[day.dateYmd] ?? 10;
      const manualRowCount = Math.max(10, storedCount, highestSlot + 1);

      const rows: PlanningDisplayRow[] = Array.from(
        { length: manualRowCount },
        (_, slotIndex) => {
          const existing = manualForDay.find((m) => m.slotIndex === slotIndex);
          return {
            rowKey: `manual:${day.dateYmd}:${slotIndex}`,
            source: 'manual',
            dateYmd: day.dateYmd,
            slotIndex,
            matricule: existing?.matricule ?? '',
            employeeName: existing?.employeeName ?? '',
            startTime: existing?.startTime ?? '',
            endTime: existing?.endTime ?? '',
            motif: existing?.motif ?? '',
            remplacant: existing?.remplacant ?? '',
          };
        }
      );

      return {
        dateYmd: day.dateYmd,
        dayLabel: day.dayLabel,
        shortDate: day.shortDate,
        manualRowCount,
        rows,
      };
    });

    return {
      data: {
        weekStartYmd,
        weekEndYmd,
        days,
      },
    };
  },

  savePlanningManualRow(
    input: {
      weekStartYmd: string;
      dateYmd: string;
      slotIndex: number;
      matricule: string;
      employeeName: string;
      startTime: string;
      endTime: string;
      motif: string;
      remplacant: string;
    },
    actor: AppUser
  ): { error?: string } {
    if (!this.canUserAccessPlanning(actor)) {
      return {
        error: 'Accès refusé : vous n’êtes pas autorisé à modifier le Planning.',
      };
    }

    if (!isValidYmd(input.dateYmd) || input.slotIndex < 0 || !Number.isInteger(input.slotIndex)) {
      return { error: 'Ligne de Planning invalide.' };
    }

    const startTime = input.startTime.trim();
    const endTime = input.endTime.trim();
    if (startTime && !isValidHHmm(startTime)) {
      return { error: 'Heure de début invalide.' };
    }
    if (endTime && !isValidHHmm(endTime)) {
      return { error: 'Heure de fin invalide.' };
    }
    if (startTime && endTime && endTime <= startTime) {
      return { error: 'L’heure de fin doit être postérieure à l’heure de début.' };
    }

    const all = this._readPlanningManualRows();
    const isEmpty =
      !input.matricule.trim() &&
      !input.employeeName.trim() &&
      !startTime &&
      !endTime &&
      !input.motif.trim() &&
      !input.remplacant.trim();

    const filtered = all.filter(
      (r) => !(r.dateYmd === input.dateYmd && r.slotIndex === input.slotIndex)
    );

    if (isEmpty) {
      safeWriteJson(STORAGE_KEYS.PLANNING_MANUAL_ROWS, filtered);
      return {};
    }

    const nextRow: PlanningManualRow = {
      id: generateUniqueId('plm'),
      weekStartYmd: getMondayOfWeekYmd(input.weekStartYmd || input.dateYmd),
      dateYmd: input.dateYmd,
      slotIndex: input.slotIndex,
      matricule: input.matricule.trim(),
      employeeName: input.employeeName.trim(),
      startTime,
      endTime,
      motif: input.motif,
      remplacant: input.remplacant,
      updatedAt: clockService.nowIso(),
      updatedByName: actor.fullName,
    };

    safeWriteJson(STORAGE_KEYS.PLANNING_MANUAL_ROWS, [...filtered, nextRow]);
    return {};
  },

  addPlanningDayRow(
    weekStartYmd: string,
    dateYmd: string,
    actor: AppUser
  ): { count?: number; error?: string } {
    if (!this.canUserAccessPlanning(actor)) {
      return {
        error: 'Accès refusé : vous n’êtes pas autorisé à modifier le Planning.',
      };
    }
    if (!isValidYmd(dateYmd)) {
      return { error: 'Date invalide.' };
    }
    const counts = this._readPlanningDayRowCounts();
    const manualForDay = this._readPlanningManualRows().filter((m) => m.dateYmd === dateYmd);
    const highestSlot = manualForDay.reduce((max, r) => Math.max(max, r.slotIndex), -1);
    const currentCount = Math.max(10, counts[dateYmd] ?? 10, highestSlot + 1);
    const nextCount = currentCount + 1;
    safeWriteJson(STORAGE_KEYS.PLANNING_DAY_ROW_COUNTS, {
      ...counts,
      [dateYmd]: nextCount,
    });
    void weekStartYmd;
    return { count: nextCount };
  },

  deletePlanningManualRow(
    weekStartYmd: string,
    dateYmd: string,
    slotIndex: number,
    actor: AppUser
  ): { error?: string } {
    if (!this.canUserAccessPlanning(actor)) {
      return {
        error: 'Accès refusé : vous n’êtes pas autorisé à modifier le Planning.',
      };
    }
    if (!isValidYmd(dateYmd) || slotIndex < 0 || !Number.isInteger(slotIndex)) {
      return { error: 'Ligne de Planning invalide.' };
    }
    const all = this._readPlanningManualRows();
    const counts = this._readPlanningDayRowCounts();
    const manualForDay = all.filter((m) => m.dateYmd === dateYmd);
    const highestSlot = manualForDay.reduce((max, r) => Math.max(max, r.slotIndex), -1);
    const currentCount = Math.max(10, counts[dateYmd] ?? 10, highestSlot + 1);

    if (slotIndex < 10) {
      const next = all.filter(
        (r) => !(r.dateYmd === dateYmd && r.slotIndex === slotIndex)
      );
      safeWriteJson(STORAGE_KEYS.PLANNING_MANUAL_ROWS, next);
      return {};
    }

    const nextRows = all
      .filter((r) => !(r.dateYmd === dateYmd && r.slotIndex === slotIndex))
      .map((r) =>
        r.dateYmd === dateYmd && r.slotIndex > slotIndex
          ? { ...r, slotIndex: r.slotIndex - 1 }
          : r
      );
    safeWriteJson(STORAGE_KEYS.PLANNING_MANUAL_ROWS, nextRows);
    safeWriteJson(STORAGE_KEYS.PLANNING_DAY_ROW_COUNTS, {
      ...counts,
      [dateYmd]: Math.max(10, currentCount - 1),
    });
    void weekStartYmd;
    return {};
  },

  // --- Projets, Affectations & Formulaires personnalisables ---
  _normalizeFormFields(fields: ProjectFormField[], preserveIds = false): ProjectFormField[] {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    return sorted.map((f, idx) => {
      const needsOptions = f.type === 'select' || f.type === 'checkbox' || f.type === 'radio';
      const cleanedOptions = needsOptions
        ? Array.from(
            new Set(
              (f.options ?? [])
                .map((opt) => opt.trim())
                .filter(Boolean)
            )
          )
        : undefined;
      return {
        id: preserveIds && f.id ? f.id : f.id || generateUniqueId('fld'),
        label: f.label.trim(),
        type: f.type,
        required: Boolean(f.required),
        options: cleanedOptions,
        order: idx + 1,
        active: f.active !== false,
      };
    });
  },

  _cloneFormFields(fields: ProjectFormField[], regenerateIds = false): ProjectFormField[] {
    return fields.map((f, idx) => ({
      id: regenerateIds ? generateUniqueId('fld') : f.id,
      label: f.label,
      type: f.type,
      required: Boolean(f.required),
      options: f.options ? [...f.options] : undefined,
      order: idx + 1,
      active: f.active !== false,
    }));
  },

  _validateFormFields(fields: ProjectFormField[]): string | null {
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.label.trim()) {
        return `Le champ n°${i + 1} doit avoir un nom.`;
      }
      if (f.type === 'select' || f.type === 'radio') {
        const opts = (f.options ?? []).map((o) => o.trim()).filter(Boolean);
        if (opts.length === 0) {
          return `Le champ « ${f.label} » doit contenir au moins une option.`;
        }
      }
    }
    return null;
  },

  canUserManageProjects(actorOrId: AppUser | string): boolean {
    const actorId = typeof actorOrId === 'string' ? actorOrId : actorOrId.id;
    const account = this.getUsers().find((u) => u.id === actorId);
    if (!account || account.accountStatus !== 'actif') return false;
    return account.role === 'admin' || account.role === 'manager';
  },

  getFormTemplates(): FormTemplate[] {
    const existing = safeReadJson<FormTemplate[]>(STORAGE_KEYS.FORM_TEMPLATES);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.FORM_TEMPLATES, INITIAL_FORM_TEMPLATES);
    return INITIAL_FORM_TEMPLATES;
  },

  createFormTemplate(
    input: { name: string; description?: string; fields: ProjectFormField[] },
    actor: AppUser
  ): { templates: FormTemplate[]; created?: FormTemplate; error?: string } {
    const current = this.getFormTemplates();
    if (!this.canUserManageProjects(actor)) {
      return {
        templates: current,
        error: 'Seuls l’administrateur et les managers peuvent créer des modèles de formulaire.',
      };
    }
    const cleanName = input.name.trim();
    if (!cleanName) {
      return { templates: current, error: 'Le nom du modèle est obligatoire.' };
    }
    if (current.some((t) => t.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      return { templates: current, error: 'Un modèle portant ce nom existe déjà.' };
    }
    const normalizedFields = this._normalizeFormFields(input.fields, false);
    const fieldErr = this._validateFormFields(normalizedFields);
    if (fieldErr) {
      return { templates: current, error: fieldErr };
    }

    const nowIso = clockService.nowIso();
    const created: FormTemplate = {
      id: generateUniqueId('tpl'),
      name: cleanName,
      description: input.description?.trim() ?? '',
      isPredefined: false,
      fields: normalizedFields,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdByName: actor.fullName,
    };
    const next = [created, ...current];
    safeWriteJson(STORAGE_KEYS.FORM_TEMPLATES, next);
    this.appendAuditLog(actor, 'Modèle de formulaire créé', '—', cleanName);
    return { templates: next, created };
  },

  updateFormTemplate(
    templateId: string,
    input: { name: string; description?: string; fields: ProjectFormField[] },
    actor: AppUser
  ): { templates: FormTemplate[]; updated?: FormTemplate; error?: string } {
    const current = this.getFormTemplates();
    if (!this.canUserManageProjects(actor)) {
      return {
        templates: current,
        error: 'Seuls l’administrateur et les managers peuvent modifier les modèles.',
      };
    }
    const existing = current.find((t) => t.id === templateId);
    if (!existing) {
      return { templates: current, error: 'Modèle introuvable.' };
    }
    const cleanName = input.name.trim();
    if (!cleanName) {
      return { templates: current, error: 'Le nom du modèle est obligatoire.' };
    }
    if (
      current.some(
        (t) => t.id !== templateId && t.name.trim().toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      return { templates: current, error: 'Un autre modèle porte déjà ce nom.' };
    }
    const normalizedFields = this._normalizeFormFields(input.fields, true);
    const fieldErr = this._validateFormFields(normalizedFields);
    if (fieldErr) {
      return { templates: current, error: fieldErr };
    }

    const nowIso = clockService.nowIso();
    const updated: FormTemplate = {
      ...existing,
      name: cleanName,
      description: input.description?.trim() ?? '',
      fields: normalizedFields,
      updatedAt: nowIso,
    };
    const next = current.map((t) => (t.id === templateId ? updated : t));
    safeWriteJson(STORAGE_KEYS.FORM_TEMPLATES, next);
    this.appendAuditLog(actor, `Modèle mis à jour · ${cleanName}`, existing.name, cleanName);
    return { templates: next, updated };
  },

  getProjects(): ProjectRecord[] {
    const existing = safeReadJson<ProjectRecord[]>(STORAGE_KEYS.PROJECTS);
    if (existing && Array.isArray(existing)) return existing;
    safeWriteJson(STORAGE_KEYS.PROJECTS, []);
    return [];
  },

  isEmployeeAssignedToProject(
    employee: { id: string; teamId?: string },
    project: ProjectRecord
  ): boolean {
    if (project.addedEmployeeIds.includes(employee.id)) return true;
    if (
      employee.teamId &&
      project.assignedTeamIds.includes(employee.teamId) &&
      !project.excludedEmployeeIds.includes(employee.id)
    ) {
      return true;
    }
    return false;
  },

  getProjectsForUser(actor: AppUser): ProjectRecord[] {
    const accounts = this.getUsers();
    const actorAccount = accounts.find((u) => u.id === actor.id);
    if (!actorAccount || actorAccount.accountStatus !== 'actif') return [];

    const all = this.getProjects();
    if (actorAccount.role === 'admin' || actorAccount.role === 'manager') {
      return all;
    }

    if (actorAccount.role === 'supervisor') {
      const teams = this.getTeams();
      const supTeamIds = Array.from(
        new Set(
          [
            actorAccount.teamId,
            ...teams.filter((t) => t.supervisorId === actorAccount.id).map((t) => t.id),
          ].filter(Boolean)
        )
      );
      const scopedEmployees = accounts.filter(
        (emp) =>
          emp.role === 'employee' &&
          (supTeamIds.includes(emp.teamId) || emp.supervisorId === actorAccount.id)
      );
      return all.filter(
        (p) =>
          p.assignedTeamIds.some((tid) => supTeamIds.includes(tid)) ||
          scopedEmployees.some((emp) => this.isEmployeeAssignedToProject(emp, p)) ||
          this.isEmployeeAssignedToProject(actorAccount, p)
      );
    }

    // Employé : uniquement ses projets actifs affectés
    return all.filter((p) => p.active && this.isEmployeeAssignedToProject(actorAccount, p));
  },

  getAssignableProjectsForActor(actor: AppUser): ProjectRecord[] {
    if (!this.canUserManageProjects(actor)) return [];
    return this.getProjectsForUser(actor).filter((p) => p.active);
  },

  _validateRequestedProjectIds(assignedProjectIds: string[], actor: AppUser): string | null {
    if (!this.canUserManageProjects(actor)) {
      return 'Seuls l’administrateur et les managers peuvent modifier les affectations aux projets.';
    }
    const assignableIds = new Set(this.getAssignableProjectsForActor(actor).map((p) => p.id));
    for (const pid of assignedProjectIds) {
      if (!assignableIds.has(pid)) {
        return 'Un ou plusieurs projets sélectionnés sont désactivés ou ne relèvent pas de votre périmètre.';
      }
    }
    return null;
  },

  _syncUserProjectAssignments(
    targetUser: ManagedEmployee,
    desiredProjectIds: string[],
    actor: AppUser
  ): ProjectRecord[] {
    const allProjects = this.getProjects();
    if (allProjects.length === 0) return allProjects;

    const assignableIds = new Set(this.getAssignableProjectsForActor(actor).map((p) => p.id));
    const desiredSet = new Set(desiredProjectIds);
    const nowIso = clockService.nowIso();
    let changedCount = 0;

    const nextProjects = allProjects.map((proj) => {
      if (!proj.active || !assignableIds.has(proj.id)) return proj;

      const inAssignedTeam = Boolean(
        targetUser.teamId && proj.assignedTeamIds.includes(targetUser.teamId)
      );
      const wantAssigned = desiredSet.has(proj.id);

      let nextAdded = proj.addedEmployeeIds;
      let nextExcluded = proj.excludedEmployeeIds;

      if (wantAssigned) {
        nextExcluded = proj.excludedEmployeeIds.filter((id) => id !== targetUser.id);
        if (!inAssignedTeam && !proj.addedEmployeeIds.includes(targetUser.id)) {
          nextAdded = [...proj.addedEmployeeIds, targetUser.id];
        }
      } else {
        nextAdded = proj.addedEmployeeIds.filter((id) => id !== targetUser.id);
        if (inAssignedTeam) {
          if (!proj.excludedEmployeeIds.includes(targetUser.id)) {
            nextExcluded = [...proj.excludedEmployeeIds, targetUser.id];
          }
        } else {
          nextExcluded = proj.excludedEmployeeIds.filter((id) => id !== targetUser.id);
        }
      }

      const addedChanged =
        nextAdded.length !== proj.addedEmployeeIds.length ||
        nextAdded.some((id, idx) => id !== proj.addedEmployeeIds[idx]);
      const excludedChanged =
        nextExcluded.length !== proj.excludedEmployeeIds.length ||
        nextExcluded.some((id, idx) => id !== proj.excludedEmployeeIds[idx]);

      if (!addedChanged && !excludedChanged) return proj;

      changedCount += 1;
      return {
        ...proj,
        addedEmployeeIds: nextAdded,
        excludedEmployeeIds: nextExcluded,
        updatedAt: nowIso,
      };
    });

    if (changedCount > 0) {
      safeWriteJson(STORAGE_KEYS.PROJECTS, nextProjects);
      const idLabel = targetUser.matricule || targetUser.username || targetUser.id;
      const assignedNames = nextProjects
        .filter((p) => p.active && this.isEmployeeAssignedToProject(targetUser, p))
        .map((p) => p.name);
      this.appendAuditLog(
        actor,
        `Affectations projets · ${targetUser.fullName} (${idLabel})`,
        `${changedCount} projet(s) mis à jour`,
        assignedNames.length > 0 ? assignedNames.join(', ') : 'Aucun projet actif'
      );
    }

    return nextProjects;
  },

  getLatestPublishedFormVersion(project: ProjectRecord): ProjectFormVersion | null {
    if (!project.formVersions || project.formVersions.length === 0) return null;
    return (
      project.formVersions.find((v) => v.id === project.currentFormVersionId) ??
      project.formVersions[project.formVersions.length - 1]
    );
  },

  createProject(
    input: {
      name: string;
      code?: string;
      description?: string;
      templateId?: string;
      fields?: ProjectFormField[];
      assignedTeamIds?: string[];
      addedEmployeeIds?: string[];
    },
    actor: AppUser
  ): { projects: ProjectRecord[]; created?: ProjectRecord; error?: string } {
    const current = this.getProjects();
    if (!this.canUserManageProjects(actor)) {
      return {
        projects: current,
        error: 'Seuls l’administrateur et les managers peuvent créer un projet.',
      };
    }

    const cleanName = input.name.trim();
    if (!cleanName) {
      return { projects: current, error: 'Le nom du projet est obligatoire.' };
    }
    if (current.some((p) => p.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      return { projects: current, error: 'Un projet portant ce nom existe déjà.' };
    }

    const rawCode = (input.code ?? '').trim();
    const autoCode =
      rawCode ||
      `PRJ-${String(current.length + 1).padStart(3, '0')}`;
    if (current.some((p) => p.code.trim().toLowerCase() === autoCode.toLowerCase())) {
      return { projects: current, error: 'Ce code projet est déjà utilisé.' };
    }

    let sourceTemplate: FormTemplate | undefined;
    let initialFields: ProjectFormField[] = [];
    if (input.fields && input.fields.length > 0) {
      initialFields = this._normalizeFormFields(this._cloneFormFields(input.fields, true), true);
    } else if (input.templateId) {
      sourceTemplate = this.getFormTemplates().find((t) => t.id === input.templateId);
      if (sourceTemplate) {
        initialFields = this._cloneFormFields(sourceTemplate.fields, true);
      }
    }

    const fieldErr = this._validateFormFields(initialFields);
    if (fieldErr) {
      return { projects: current, error: fieldErr };
    }

    const nowIso = clockService.nowIso();
    const projectId = generateUniqueId('prj');
    const v1Id = generateUniqueId('pfv');
    const v1: ProjectFormVersion = {
      id: v1Id,
      projectId,
      versionNumber: 1,
      fields: initialFields,
      sourceTemplateId: sourceTemplate?.id,
      sourceTemplateName: sourceTemplate?.name,
      publishedAt: nowIso,
      publishedById: actor.id,
      publishedByName: actor.fullName,
      changeNote: sourceTemplate
        ? `Création initiale depuis le modèle « ${sourceTemplate.name} »`
        : 'Création initiale du formulaire',
    };

    const created: ProjectRecord = {
      id: projectId,
      name: cleanName,
      code: autoCode,
      description: input.description?.trim() ?? '',
      active: true,
      assignedTeamIds: Array.from(new Set(input.assignedTeamIds ?? [])),
      addedEmployeeIds: Array.from(new Set(input.addedEmployeeIds ?? [])),
      excludedEmployeeIds: [],
      currentFormVersionId: v1Id,
      currentFormVersionNumber: 1,
      formVersions: [v1],
      createdAt: nowIso,
      createdByName: actor.fullName,
      updatedAt: nowIso,
    };

    const next = [created, ...current];
    safeWriteJson(STORAGE_KEYS.PROJECTS, next);
    this.appendAuditLog(actor, 'Projet créé', '—', `${cleanName} (${autoCode})`);
    return { projects: next, created };
  },

  updateProjectInfo(
    projectId: string,
    patch: { name: string; code: string; description: string },
    actor: AppUser
  ): { projects: ProjectRecord[]; updated?: ProjectRecord; error?: string } {
    const current = this.getProjects();
    if (!this.canUserManageProjects(actor)) {
      return {
        projects: current,
        error: 'Seuls l’administrateur et les managers peuvent modifier un projet.',
      };
    }
    const existing = current.find((p) => p.id === projectId);
    if (!existing) {
      return { projects: current, error: 'Projet introuvable.' };
    }

    const cleanName = patch.name.trim();
    const cleanCode = patch.code.trim();
    if (!cleanName) return { projects: current, error: 'Le nom du projet est obligatoire.' };
    if (!cleanCode) return { projects: current, error: 'Le code projet est obligatoire.' };

    if (
      current.some(
        (p) => p.id !== projectId && p.name.trim().toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      return { projects: current, error: 'Un autre projet porte déjà ce nom.' };
    }
    if (
      current.some(
        (p) => p.id !== projectId && p.code.trim().toLowerCase() === cleanCode.toLowerCase()
      )
    ) {
      return { projects: current, error: 'Un autre projet utilise déjà ce code.' };
    }

    const updated: ProjectRecord = {
      ...existing,
      name: cleanName,
      code: cleanCode,
      description: patch.description.trim(),
      updatedAt: clockService.nowIso(),
    };
    const next = current.map((p) => (p.id === projectId ? updated : p));
    safeWriteJson(STORAGE_KEYS.PROJECTS, next);
    this.appendAuditLog(
      actor,
      `Projet modifié · ${cleanCode}`,
      existing.name,
      cleanName
    );
    return { projects: next, updated };
  },

  toggleProjectActive(
    projectId: string,
    active: boolean,
    actor: AppUser
  ): { projects: ProjectRecord[]; error?: string } {
    const current = this.getProjects();
    if (!this.canUserManageProjects(actor)) {
      return {
        projects: current,
        error: 'Seuls l’administrateur et les managers peuvent activer ou désactiver un projet.',
      };
    }
    const existing = current.find((p) => p.id === projectId);
    if (!existing) {
      return { projects: current, error: 'Projet introuvable.' };
    }
    const next = current.map((p) =>
      p.id === projectId
        ? { ...p, active, updatedAt: clockService.nowIso() }
        : p
    );
    safeWriteJson(STORAGE_KEYS.PROJECTS, next);
    this.appendAuditLog(
      actor,
      `Statut projet · ${existing.name}`,
      existing.active ? 'Actif' : 'Désactivé',
      active ? 'Actif' : 'Désactivé'
    );
    return { projects: next };
  },

  updateProjectAssignments(
    projectId: string,
    payload: {
      assignedTeamIds: string[];
      addedEmployeeIds: string[];
      excludedEmployeeIds: string[];
    },
    actor: AppUser
  ): { projects: ProjectRecord[]; updated?: ProjectRecord; error?: string } {
    const current = this.getProjects();
    if (!this.canUserManageProjects(actor)) {
      return {
        projects: current,
        error: 'Seuls l’administrateur et les managers peuvent gérer les affectations de projet.',
      };
    }
    const existing = current.find((p) => p.id === projectId);
    if (!existing) {
      return { projects: current, error: 'Projet introuvable.' };
    }

    const accounts = this.getUsers();
    const teamSet = new Set(payload.assignedTeamIds);
    const addedSet = new Set(payload.addedEmployeeIds);
    const excluded = payload.excludedEmployeeIds.filter((empId) => {
      if (addedSet.has(empId)) return false;
      const emp = accounts.find((u) => u.id === empId);
      return Boolean(emp && emp.teamId && teamSet.has(emp.teamId));
    });

    const updated: ProjectRecord = {
      ...existing,
      assignedTeamIds: Array.from(teamSet),
      addedEmployeeIds: Array.from(addedSet),
      excludedEmployeeIds: Array.from(new Set(excluded)),
      updatedAt: clockService.nowIso(),
    };
    const next = current.map((p) => (p.id === projectId ? updated : p));
    safeWriteJson(STORAGE_KEYS.PROJECTS, next);
    this.appendAuditLog(
      actor,
      `Affectations projet · ${existing.name}`,
      `${existing.assignedTeamIds.length} éq. / +${existing.addedEmployeeIds.length} emp.`,
      `${updated.assignedTeamIds.length} éq. / +${updated.addedEmployeeIds.length} emp.`
    );
    return { projects: next, updated };
  },

  toggleEmployeeAssignmentOnProject(
    projectId: string,
    employeeId: string,
    assigned: boolean,
    actor: AppUser
  ): { projects: ProjectRecord[]; updated?: ProjectRecord; error?: string } {
    const current = this.getProjects();
    if (!this.canUserManageProjects(actor)) {
      return {
        projects: current,
        error: 'Seuls l’administrateur et les managers peuvent modifier les affectations.',
      };
    }
    const existing = current.find((p) => p.id === projectId);
    if (!existing) return { projects: current, error: 'Projet introuvable.' };
    const emp = this.getUsers().find((u) => u.id === employeeId);
    if (!emp) return { projects: current, error: 'Employé introuvable.' };

    const inAssignedTeam = Boolean(emp.teamId && existing.assignedTeamIds.includes(emp.teamId));
    let nextAdded = [...existing.addedEmployeeIds];
    let nextExcluded = [...existing.excludedEmployeeIds];

    if (assigned) {
      nextExcluded = nextExcluded.filter((id) => id !== employeeId);
      if (!inAssignedTeam && !nextAdded.includes(employeeId)) {
        nextAdded.push(employeeId);
      }
    } else {
      nextAdded = nextAdded.filter((id) => id !== employeeId);
      if (inAssignedTeam && !nextExcluded.includes(employeeId)) {
        nextExcluded.push(employeeId);
      }
    }

    return this.updateProjectAssignments(
      projectId,
      {
        assignedTeamIds: existing.assignedTeamIds,
        addedEmployeeIds: nextAdded,
        excludedEmployeeIds: nextExcluded,
      },
      actor
    );
  },

  publishProjectFormVersion(
    projectId: string,
    fields: ProjectFormField[],
    options: { sourceTemplateId?: string; sourceTemplateName?: string; changeNote?: string },
    actor: AppUser
  ): { projects: ProjectRecord[]; version?: ProjectFormVersion; error?: string } {
    const current = this.getProjects();
    if (!this.canUserManageProjects(actor)) {
      return {
        projects: current,
        error: 'Seuls l’administrateur et les managers peuvent publier une version de formulaire.',
      };
    }
    const existing = current.find((p) => p.id === projectId);
    if (!existing) {
      return { projects: current, error: 'Projet introuvable.' };
    }

    const clonedNormalized = this._normalizeFormFields(
      this._cloneFormFields(fields, true),
      true
    );
    const fieldErr = this._validateFormFields(clonedNormalized);
    if (fieldErr) {
      return { projects: current, error: fieldErr };
    }

    const nextVersionNumber =
      existing.formVersions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
    const nowIso = clockService.nowIso();
    const version: ProjectFormVersion = {
      id: generateUniqueId('pfv'),
      projectId,
      versionNumber: nextVersionNumber,
      fields: clonedNormalized,
      sourceTemplateId: options.sourceTemplateId,
      sourceTemplateName: options.sourceTemplateName,
      publishedAt: nowIso,
      publishedById: actor.id,
      publishedByName: actor.fullName,
      changeNote: options.changeNote?.trim() || undefined,
    };

    const updated: ProjectRecord = {
      ...existing,
      currentFormVersionId: version.id,
      currentFormVersionNumber: nextVersionNumber,
      formVersions: [...existing.formVersions, version],
      updatedAt: nowIso,
    };

    const next = current.map((p) => (p.id === projectId ? updated : p));
    safeWriteJson(STORAGE_KEYS.PROJECTS, next);
    this.appendAuditLog(
      actor,
      `Formulaire publié · ${existing.name}`,
      `v${existing.currentFormVersionNumber}`,
      `v${nextVersionNumber}`,
      options.changeNote
    );

    return { projects: next, version };
  },

  getAllTreatmentActivities(): Array<
    ActivityRecord & { employeeName: string; teamId: string; matricule: string }
  > {
    const accounts = this.getUsers();
    const result: Array<
      ActivityRecord & { employeeName: string; teamId: string; matricule: string }
    > = [];
    for (const acc of accounts) {
      const acts = this.getActivitiesForUser(acc.id);
      for (const act of acts) {
        if (act.type === 'traitement') {
          result.push({
            ...act,
            employeeName: acc.fullName,
            teamId: acc.teamId ?? '',
            matricule: acc.matricule ?? '',
          });
        }
      }
    }
    return result.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
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

  startTreatmentSession(
    userId: string,
    projectId?: string
  ): { shiftState: EmployeeShiftState; error?: string } {
    const current = this.getShiftState(userId);
    if (current.activeTimer) {
      return {
        shiftState: current,
        error: 'Un chronomètre est déjà actif. Terminez-le avant d’en démarrer un autre.',
      };
    }

    const empAccount = this.getUsers().find((u) => u.id === userId);
    const allProjects = this.getProjects();
    const authorizedActiveProjects = empAccount
      ? allProjects.filter((p) => p.active && this.isEmployeeAssignedToProject(empAccount, p))
      : [];

    if (!projectId) {
      if (authorizedActiveProjects.length === 0) {
        return {
          shiftState: current,
          error:
            'Aucun projet actif ne vous est affecté. Contactez votre manager ou superviseur.',
        };
      }
      return {
        shiftState: current,
        error: 'Veuillez sélectionner un projet avant de démarrer un traitement.',
      };
    }

    const candidate = allProjects.find((p) => p.id === projectId);
    if (
      !candidate ||
      !candidate.active ||
      !empAccount ||
      !this.isEmployeeAssignedToProject(empAccount, candidate)
    ) {
      return {
        shiftState: current,
        error: 'Ce projet est désactivé ou ne fait pas partie de vos affectations.',
      };
    }

    const formVersion = this.getLatestPublishedFormVersion(candidate);
    const activeFields = formVersion
      ? this._cloneFormFields(
          formVersion.fields.filter((f) => f.active).sort((a, b) => a.order - b.order),
          false
        )
      : [];

    if (!formVersion || activeFields.length === 0) {
      return {
        shiftState: current,
        error:
          'Ce projet ne possède pas de formulaire publié actif. Contactez votre manager ou administrateur.',
      };
    }

    const nowMs = clockService.nowMs();
    const nowIso = new Date(nowMs).toISOString();
    const updatedPresenceBase = this.computeLivePresenceSeconds(current, nowMs);

    const session: ActiveTimerSession = {
      id: generateUniqueId('act'),
      type: 'traitement',
      startedAt: nowIso,
      projectId: candidate.id,
      projectName: candidate.name,
      formVersionId: formVersion.id,
      formVersionNumber: formVersion.versionNumber,
      formFieldsSnapshot: activeFields,
      customResponses: {},
      taskId: '',
      taskTitle: '',
      companyId: '',
      clientName: '',
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
        | 'customResponses'
      >
    >
  ): EmployeeShiftState {
    const current = this.getShiftState(userId);
    if (!current.activeTimer) return current;
    const mergedResponses =
      patch.customResponses !== undefined
        ? {
            ...(current.activeTimer.customResponses ?? {}),
            ...patch.customResponses,
          }
        : current.activeTimer.customResponses;
    const updated: EmployeeShiftState = {
      ...current,
      activeTimer: {
        ...current.activeTimer,
        ...patch,
        customResponses: mergedResponses,
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
      const orderedFields = (active.formFieldsSnapshot ?? [])
        .filter((f) => f.active)
        .slice()
        .sort((a, b) => a.order - b.order);

      if (orderedFields.length === 0) {
        errors.push('Aucun formulaire publié actif n’est associé à ce traitement.');
      } else {
        const responses = active.customResponses ?? {};
        for (const field of orderedFields) {
          const rawVal = responses[field.id];
          if (field.type === 'checkbox') {
            const arr = Array.isArray(rawVal)
              ? rawVal.map((v) => String(v).trim()).filter(Boolean)
              : [];
            if (field.required && arr.length === 0) {
              errors.push(`Le champ « ${field.label} » est obligatoire.`);
            }
            if ((field.options ?? []).length > 0 && arr.some((v) => !(field.options ?? []).includes(v))) {
              errors.push(`Le champ « ${field.label} » contient une option invalide.`);
            }
          } else {
            const strVal = typeof rawVal === 'string' ? rawVal.trim() : '';
            if (field.required && !strVal) {
              errors.push(`Le champ « ${field.label} » est obligatoire.`);
            } else if (strVal) {
              if (field.type === 'number' && Number.isNaN(Number(strVal))) {
                errors.push(`Le champ « ${field.label} » doit contenir un nombre valide.`);
              }
              if (field.type === 'email' && !isValidEmail(strVal)) {
                errors.push(`Le champ « ${field.label} » doit contenir une adresse e-mail valide.`);
              }
              if (field.type === 'date' && !isValidYmd(strVal)) {
                errors.push(`Le champ « ${field.label} » doit contenir une date valide.`);
              }
              if (field.type === 'time' && !isValidHHmm(strVal)) {
                errors.push(`Le champ « ${field.label} » doit contenir une heure valide (HH:MM).`);
              }
              if (
                (field.type === 'select' || field.type === 'radio') &&
                (field.options ?? []).length > 0 &&
                !(field.options ?? []).includes(strVal)
              ) {
                errors.push(`Le champ « ${field.label} » contient une option invalide.`);
              }
            }
          }
        }
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

    const isDynamicTreatment = active.type === 'traitement';

    const finalTaskTitle = isDynamicTreatment
      ? ''
      : active.type === 'sortie' && active.outingReason === 'autre' && active.customReason?.trim()
      ? `Autre : ${active.customReason.trim()}`
      : active.taskTitle.trim();

    const allowedFieldIds = new Set(
      (active.formFieldsSnapshot ?? []).filter((f) => f.active).map((f) => f.id)
    );
    const cleanedResponses: Record<string, CustomFieldValue> | undefined =
      active.formFieldsSnapshot && active.formFieldsSnapshot.length > 0
        ? Object.fromEntries(
            Object.entries(active.customResponses ?? {})
              .filter(([k]) => allowedFieldIds.has(k))
              .map(([k, v]) => [
                k,
                Array.isArray(v)
                  ? v.map((item) => String(item).trim()).filter(Boolean)
                  : String(v ?? '').trim(),
              ])
          )
        : undefined;

    const record: ActivityRecord = {
      id: active.id || generateUniqueId('act'),
      userId,
      type: active.type,
      projectId: active.projectId,
      projectName: active.projectName,
      formVersionId: active.formVersionId,
      formVersionNumber: active.formVersionNumber,
      formFieldsSnapshot: active.formFieldsSnapshot
        ? this._cloneFormFields(active.formFieldsSnapshot, false)
        : undefined,
      customResponses: cleanedResponses,
      taskId: isDynamicTreatment ? '' : active.taskId,
      taskTitle: finalTaskTitle,
      companyId: isDynamicTreatment ? '' : active.companyId,
      clientName: isDynamicTreatment ? '' : active.clientName.trim() || 'Interne',
      dossierRef: isDynamicTreatment
        ? ''
        : active.dossierRef?.trim() ||
          (active.type === 'pause'
            ? (active.pauseSlot ?? 'PAUSE').toUpperCase()
            : `SORTIE-${String(endedAtMs).slice(-5)}`),
      startedAt: active.startedAt,
      endedAt: endedAtIso,
      durationSeconds: realDurationSeconds,
      status: active.type === 'traitement' ? 'en_controle' : 'termine',
      syncStatus: 'local_en_attente',
      notes: isDynamicTreatment ? undefined : active.notes.trim() || undefined,
      receptionChannel: isDynamicTreatment
        ? undefined
        : (active.receptionChannel as ReceptionChannel | undefined),
      receptionDateTime: isDynamicTreatment ? undefined : active.receptionDateTime,
      recipientEmail: isDynamicTreatment ? undefined : active.recipientEmail?.trim() || undefined,
      teamsRequesterName: isDynamicTreatment
        ? undefined
        : active.teamsRequesterName?.trim() || undefined,
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
        projectId: record.projectId,
        projectName: record.projectName,
        formVersionId: record.formVersionId,
        formVersionNumber: record.formVersionNumber,
        formFieldsSnapshot: record.formFieldsSnapshot
          ? this._cloneFormFields(record.formFieldsSnapshot, false)
          : undefined,
        customResponses: record.customResponses,
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
