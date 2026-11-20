import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FolderKanban,
  Plus,
  Search,
  Upload,
  UserCheck,
  UserMinus,
  X,
} from 'lucide-react';
import {
  AccountStatus,
  ActivityRecord,
  AppUser,
  CompanyRecord,
  CorrectionRequest,
  ManagedEmployee,
  ProjectRecord,
  QualityControlRecord,
  TeamRecord,
  UserRole,
} from '../../core/types';
import { ROLE_LABELS } from '../../core/permissions';
import {
  CreateUserInput,
  ExcelImportExecutionResult,
  ExcelImportRowInput,
  storageService,
} from '../../services/storageService';
import { buildProvisionalPassword, isValidEmail } from '../../utils/crypto';
import { analyzeEmployeeExcelBuffer, ExcelImportPreview } from '../../utils/excelImport';
import {
  formatDateFr,
  formatDateTimeFr,
  formatDurationHM,
  formatTimeShort,
  toYmd,
} from '../../utils/formatters';
import {
  QualityControlStatusText,
  SectionHeader,
  ServiceStatusDisplay,
} from '../ui/DataPrimitives';

interface EmployeesTeamsViewProps {
  mode: 'employees' | 'teams';
  user: AppUser;
  employees: ManagedEmployee[];
  teams: TeamRecord[];
  companies: CompanyRecord[];
  projects: ProjectRecord[];
  correctionRequests: CorrectionRequest[];
  qualityControls: QualityControlRecord[];
  onCreateAccount: (input: CreateUserInput) => Promise<{
    error?: string;
    createdMatricule?: string;
    provisionalPassword?: string;
  }>;
  onImportEmployeesExcel: (
    rows: ExcelImportRowInput[]
  ) => Promise<ExcelImportExecutionResult>;
  onUpdateAccount: (
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
    options?: { newPassword?: string; reason?: string; assignedProjectIds?: string[] }
  ) => Promise<{ error?: string }>;
  onSetAccountStatus: (
    employeeId: string,
    status: AccountStatus,
    reason?: string
  ) => { error?: string } | void;
  onSaveTeam: (team: Omit<TeamRecord, 'id'> & { id?: string }) => void;
  onReviewCorrectionRequest: (requestId: string, decision: 'approuvee' | 'refusee', note?: string) => void;
}

const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  actif: 'Actif',
  desactive: 'Désactivé',
  archive: 'Archivé',
};

interface AccountFormState {
  id?: string;
  username: string;
  matricule: string;
  hasExistingUsername?: boolean;
  hasExistingMatricule?: boolean;
  isPrimaryAdmin?: boolean;
  fullName: string;
  email: string;
  role: UserRole;
  jobTitle: string;
  site: string;
  teamId: string;
  supervisorId: string;
  plannedStart: string;
  plannedEnd: string;
  restDays: string[];
  dailyTargetDossiers: string;
  accountStatus: AccountStatus;
  password: string;
  confirmPassword: string;
  selectedProjectIds: string[];
  manuallyToggledProjectIds: Record<string, boolean>;
}

export function EmployeesTeamsView({
  mode,
  user,
  employees,
  teams,
  companies,
  projects,
  correctionRequests,
  qualityControls,
  onCreateAccount,
  onImportEmployeesExcel,
  onUpdateAccount,
  onSetAccountStatus,
  onSaveTeam,
  onReviewCorrectionRequest,
}: EmployeesTeamsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'actif' | 'desactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [accountForm, setAccountForm] = useState<AccountFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [createdCredentialsBanner, setCreatedCredentialsBanner] = useState<{
    fullName: string;
    matricule: string;
    provisionalPassword: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inspectedEmp, setInspectedEmp] = useState<ManagedEmployee | null>(null);
  const [pendingDeactivation, setPendingDeactivation] = useState<ManagedEmployee | null>(null);
  const [editingTeam, setEditingTeam] = useState<(Omit<TeamRecord, 'id'> & { id?: string }) | null>(
    null
  );
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelPreview, setExcelPreview] = useState<ExcelImportPreview | null>(null);
  const [excelResult, setExcelResult] = useState<{
    execution: ExcelImportExecutionResult;
    ignoredFromPreview: Array<{
      rowNumber: number;
      fullName: string;
      matricule: string;
      reason: string;
    }>;
  } | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  const isSupervisor = user.role === 'supervisor';
  const isAdmin = user.role === 'admin';
  const canAssignProjects = user.role === 'admin' || user.role === 'manager';

  const activeAssignableProjects = useMemo(
    () =>
      projects
        .filter((p) => p.active)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [projects]
  );

  // Liste dynamique des encadrants pouvant superviser une équipe ou un employé
  const supervisorCandidates = useMemo(() => {
    return employees.filter(
      (e) =>
        e.accountStatus === 'actif' &&
        (e.role === 'supervisor' || e.role === 'manager' || e.role === 'admin')
    );
  }, [employees]);

  const creatableRoles: UserRole[] = useMemo(() => {
    if (isAdmin) return ['employee', 'supervisor', 'manager', 'admin'];
    if (user.role === 'manager') return ['employee', 'supervisor'];
    return [];
  }, [isAdmin, user.role]);

  const scopedEmployees = useMemo(() => {
    const base = isSupervisor
      ? employees.filter(
          (e) =>
            e.role === 'employee' &&
            ((user.teamId && e.teamId === user.teamId) || e.supervisorId === user.id)
        )
      : employees;

    return base.filter((e) => {
      if (statusFilter === 'actif' && e.accountStatus !== 'actif') return false;
      if (statusFilter === 'desactive' && e.accountStatus === 'actif') return false;
      if (roleFilter !== 'all' && e.role !== roleFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        (e.username ?? '').toLowerCase().includes(q) ||
        (e.matricule ?? '').toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        e.site.toLowerCase().includes(q)
      );
    });
  }, [employees, isSupervisor, user.teamId, user.id, statusFilter, roleFilter, search]);

  const pendingCorrections = useMemo(() => {
    return correctionRequests.filter((r) => {
      if (r.status !== 'en_attente') return false;
      if (isSupervisor && user.teamId) return r.teamId === user.teamId;
      return true;
    });
  }, [correctionRequests, isSupervisor, user.teamId]);

  const copyText = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      setCopiedId(key);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === key ? null : cur));
      }, 2000);
    }
  };

  const computeProjectsForTeamChange = (
    teamId: string,
    overrides: Record<string, boolean>
  ): string[] =>
    activeAssignableProjects
      .filter((p) => {
        if (Object.prototype.hasOwnProperty.call(overrides, p.id)) {
          return overrides[p.id];
        }
        return Boolean(teamId && p.assignedTeamIds.includes(teamId));
      })
      .map((p) => p.id);

  const openNewAccountForm = () => {
    const defaultTeam = teams[0];
    const defaultTeamId = defaultTeam?.id ?? '';
    setFormError(null);
    setShowPassword(false);
    setAccountForm({
      username: '',
      matricule: storageService.generateNextMatricule(),
      fullName: '',
      email: '',
      role: 'employee',
      jobTitle: '',
      site: defaultTeam?.site ?? 'Siège',
      teamId: defaultTeamId,
      supervisorId: defaultTeam?.supervisorId ?? '',
      plannedStart: '08:30',
      plannedEnd: '17:00',
      restDays: ['Samedi', 'Dimanche'],
      dailyTargetDossiers: '',
      accountStatus: 'actif',
      password: '',
      confirmPassword: '',
      selectedProjectIds: computeProjectsForTeamChange(defaultTeamId, {}),
      manuallyToggledProjectIds: {},
    });
  };

  const openEditAccountForm = (emp: ManagedEmployee) => {
    setFormError(null);
    setShowPassword(false);
    const initialOverrides: Record<string, boolean> = {};
    for (const p of activeAssignableProjects) {
      if (p.addedEmployeeIds.includes(emp.id)) {
        initialOverrides[p.id] = true;
      } else if (
        emp.teamId &&
        p.assignedTeamIds.includes(emp.teamId) &&
        p.excludedEmployeeIds.includes(emp.id)
      ) {
        initialOverrides[p.id] = false;
      }
    }
    setAccountForm({
      id: emp.id,
      username: emp.username ?? '',
      matricule: emp.matricule ?? '',
      hasExistingUsername: Boolean(emp.username?.trim()),
      hasExistingMatricule: Boolean(emp.matricule?.trim()),
      isPrimaryAdmin: emp.isPrimaryAdmin,
      fullName: emp.fullName,
      email: emp.email ?? '',
      role: emp.role,
      jobTitle: emp.jobTitle ?? '',
      site: emp.site,
      teamId: emp.teamId,
      supervisorId: emp.supervisorId,
      plannedStart: emp.plannedStart,
      plannedEnd: emp.plannedEnd,
      restDays: emp.restDays,
      dailyTargetDossiers:
        typeof emp.dailyTargetDossiers === 'number' && emp.dailyTargetDossiers > 0
          ? String(emp.dailyTargetDossiers)
          : '',
      accountStatus: emp.accountStatus,
      password: '',
      confirmPassword: '',
      selectedProjectIds: activeAssignableProjects
        .filter((p) => storageService.isEmployeeAssignedToProject(emp, p))
        .map((p) => p.id),
      manuallyToggledProjectIds: initialOverrides,
    });
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm) return;
    setFormError(null);

    if (accountForm.fullName.trim().length < 2) {
      setFormError('Le nom complet est obligatoire.');
      return;
    }

    const isAdminAccount = accountForm.role === 'admin';
    const cleanUsername = accountForm.username.trim();
    const cleanMatricule = accountForm.matricule.trim();

    if (!accountForm.id || isAdmin) {
      if (isAdminAccount) {
        if (cleanUsername.length < 2 || /\s/.test(cleanUsername)) {
          setFormError(
            'L’identifiant de connexion administrateur est obligatoire (2 caractères minimum, sans espace).'
          );
          return;
        }
      } else if (cleanMatricule.length < 2 || /\s/.test(cleanMatricule)) {
        setFormError('Le matricule est obligatoire (2 caractères minimum, sans espace).');
        return;
      }
    }

    let parsedDailyTarget: number | undefined;
    if (accountForm.role === 'employee') {
      const rawTarget = accountForm.dailyTargetDossiers.trim();
      if (rawTarget !== '') {
        const numericTarget = Number(rawTarget);
        if (!/^\d+$/.test(rawTarget) || !Number.isInteger(numericTarget) || numericTarget < 1) {
          setFormError('L’objectif / jour doit être un nombre entier positif (1 minimum).');
          return;
        }
        parsedDailyTarget = numericTarget;
      }
    }

    if (accountForm.email.trim() && !isValidEmail(accountForm.email)) {
      setFormError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    if (!accountForm.id) {
      const hasCustomPassword = accountForm.password.trim().length > 0;
      if (isAdminAccount && !hasCustomPassword) {
        setFormError('Le mot de passe initial est obligatoire pour un compte administrateur.');
        return;
      }
      if (hasCustomPassword) {
        if (accountForm.password.length < 8) {
          setFormError('Le mot de passe doit contenir au moins 8 caractères.');
          return;
        }
        if (accountForm.password !== accountForm.confirmPassword) {
          setFormError('Les deux mots de passe ne correspondent pas.');
          return;
        }
      }

      setSubmitting(true);
      try {
        const res = await onCreateAccount({
          username: isAdminAccount ? cleanUsername : undefined,
          matricule: isAdminAccount ? undefined : cleanMatricule,
          fullName: accountForm.fullName,
          email: accountForm.email.trim() || undefined,
          password: hasCustomPassword ? accountForm.password : undefined,
          role: accountForm.role,
          jobTitle: accountForm.jobTitle,
          site: accountForm.site,
          teamId: accountForm.teamId,
          supervisorId: accountForm.supervisorId,
          plannedStart: accountForm.plannedStart,
          plannedEnd: accountForm.plannedEnd,
          restDays: accountForm.restDays,
          dailyTargetDossiers: parsedDailyTarget,
          assignedProjectIds:
            canAssignProjects &&
            (accountForm.role === 'employee' || accountForm.role === 'supervisor')
              ? accountForm.selectedProjectIds
              : undefined,
        });
        if (res.error) {
          setFormError(res.error);
          return;
        }
        if (res.provisionalPassword && res.createdMatricule) {
          setCreatedCredentialsBanner({
            fullName: accountForm.fullName.trim(),
            matricule: res.createdMatricule,
            provisionalPassword: res.provisionalPassword,
          });
        } else {
          setCreatedCredentialsBanner(null);
        }
        setAccountForm(null);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Mode édition
    if (accountForm.password.trim().length > 0) {
      if (accountForm.password.length < 8) {
        setFormError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
        return;
      }
      if (accountForm.password !== accountForm.confirmPassword) {
        setFormError('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await onUpdateAccount(
        accountForm.id,
        {
          username:
            isAdmin && isAdminAccount
              ? cleanUsername
              : isAdminAccount && !accountForm.hasExistingUsername && cleanUsername
              ? cleanUsername
              : undefined,
          matricule:
            isAdmin && !isAdminAccount
              ? cleanMatricule
              : !isAdminAccount && !accountForm.hasExistingMatricule && cleanMatricule
              ? cleanMatricule
              : undefined,
          fullName: accountForm.fullName,
          email: accountForm.email.trim(),
          role: accountForm.role,
          jobTitle: accountForm.jobTitle,
          site: accountForm.site,
          teamId:
            accountForm.role === 'employee' || accountForm.role === 'supervisor'
              ? accountForm.teamId
              : '',
          supervisorId: accountForm.role === 'employee' ? accountForm.supervisorId : '',
          plannedStart: accountForm.plannedStart,
          plannedEnd: accountForm.plannedEnd,
          restDays: accountForm.restDays,
          dailyTargetDossiers: accountForm.role === 'employee' ? parsedDailyTarget : undefined,
          accountStatus: isAdmin ? accountForm.accountStatus : undefined,
        },
        {
          newPassword: accountForm.password.trim() ? accountForm.password : undefined,
          reason: 'Mise à jour compte utilisateur',
          assignedProjectIds:
            canAssignProjects &&
            (accountForm.role === 'employee' || accountForm.role === 'supervisor')
              ? accountForm.selectedProjectIds
              : undefined,
        }
      );
      if (res.error) {
        setFormError(res.error);
        return;
      }
      setAccountForm(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = (emp: ManagedEmployee, nextStatus: AccountStatus, reason: string) => {
    setBannerError(null);
    const res = onSetAccountStatus(emp.id, nextStatus, reason);
    if (res && res.error) {
      setBannerError(res.error);
    }
  };

  const openExcelModal = () => {
    setExcelPreview(null);
    setExcelResult(null);
    setExcelModalOpen(true);
  };

  const closeExcelModal = () => {
    if (importingExcel) return;
    setExcelModalOpen(false);
    setExcelPreview(null);
    setExcelResult(null);
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
    }
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelResult(null);
    try {
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith('.xlsx')) {
        setExcelPreview({
          fileName: file.name,
          totalRows: 0,
          validRows: 0,
          duplicateRows: 0,
          invalidRows: 0,
          rows: [],
          error: 'Format non pris en charge. Veuillez sélectionner un fichier Excel (.xlsx).',
        });
        return;
      }
      const buffer = await file.arrayBuffer();
      const preview = analyzeEmployeeExcelBuffer(buffer, file.name, employees, {
        actorRole: user.role,
        projects,
        assignableProjectIds: activeAssignableProjects.map((p) => p.id),
      });
      setExcelPreview(preview);
    } catch {
      setExcelPreview({
        fileName: file.name,
        totalRows: 0,
        validRows: 0,
        duplicateRows: 0,
        invalidRows: 0,
        rows: [],
        error: 'Erreur lors de la lecture du fichier sélectionné.',
      });
    } finally {
      if (excelInputRef.current) {
        excelInputRef.current.value = '';
      }
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelPreview || excelPreview.validRows === 0) return;
    const validRows: ExcelImportRowInput[] = excelPreview.rows
      .filter((r) => r.status === 'valid' && r.role)
      .map((r) => ({
        rowNumber: r.rowNumber,
        fullName: r.fullName,
        matricule: r.matricule,
        rawRole: r.rawRole,
        role: r.role,
        rawProjects: r.rawProjects,
        projectIds: r.projectIds,
      }));
    const ignoredFromPreview = excelPreview.rows
      .filter((r) => r.status !== 'valid')
      .map((r) => ({
        rowNumber: r.rowNumber,
        fullName: r.fullName,
        matricule: r.matricule,
        reason: r.reason ?? 'Ligne ignorée',
      }));

    setImportingExcel(true);
    try {
      const execution = await onImportEmployeesExcel(validRows);
      setExcelResult({ execution, ignoredFromPreview });
    } finally {
      setImportingExcel(false);
    }
  };

  const openNewTeamForm = () => {
    const defaultSup = supervisorCandidates[0];
    setEditingTeam({
      name: '',
      site: 'Siège',
      supervisorId: defaultSup?.id ?? '',
      supervisorName: defaultSup?.fullName ?? 'Non assigné',
      defaultCompanyId: companies.find((c) => !c.archived)?.id ?? '',
      productivityRate: 90,
      qualityScore: 95,
    });
  };

  const handleTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editingTeam.name.trim()) return;
    onSaveTeam(editingTeam);
    setEditingTeam(null);
  };

  // Données de détail d'un utilisateur inspecté
  const inspectedActivities: ActivityRecord[] = useMemo(() => {
    if (!inspectedEmp) return [];
    return storageService.getActivitiesForUser(inspectedEmp.id);
  }, [inspectedEmp]);

  const inspectedHistory = useMemo(() => {
    if (!inspectedEmp || inspectedActivities.length === 0) return [];
    const byDay: Record<
      string,
      { id: string; date: string; productiveSeconds: number; dossiersCount: number }
    > = {};
    for (const act of inspectedActivities) {
      const ymd = toYmd(new Date(act.startedAt));
      if (!byDay[ymd]) {
        byDay[ymd] = { id: ymd, date: ymd, productiveSeconds: 0, dossiersCount: 0 };
      }
      if (act.type === 'traitement') {
        byDay[ymd].productiveSeconds += act.durationSeconds;
        byDay[ymd].dossiersCount += 1;
      }
    }
    return Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  }, [inspectedEmp, inspectedActivities]);

  const inspectedQc = useMemo(() => {
    if (!inspectedEmp) return [];
    return qualityControls.filter((q) => q.employeeId === inspectedEmp.id);
  }, [inspectedEmp, qualityControls]);

  if (mode === 'teams') {
    const assignableEmployees = employees.filter(
      (e) => e.accountStatus === 'actif' && e.role === 'employee'
    );

    return (
      <div className="space-y-6">
        <SectionHeader
          title="Équipes"
          action={
            <button
              type="button"
              onClick={openNewTeamForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Nouvelle équipe</span>
            </button>
          }
        />

        {teams.length === 0 ? (
          <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-8 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
            Aucune équipe créée pour le moment. Cliquez sur « Nouvelle équipe » pour structurer vos pôles.
          </section>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teams.map((team) => {
              const members = employees.filter(
                (e) => e.teamId === team.id && e.accountStatus === 'actif'
              );
              const presentMembers = members.filter((m) => m.status !== 'absent').length;
              const company = companies.find((c) => c.id === team.defaultCompanyId);
              return (
                <div
                  key={team.id}
                  className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-base text-slate-900 dark:text-white">
                          {team.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5">
                          {team.site} · {company?.name ?? 'Multi-sociétés'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingTeam(team)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 cursor-pointer"
                        aria-label={`Modifier ${team.name}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-[#C8C2D0]">
                      Superviseur :{' '}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {team.supervisorName || 'Non assigné'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-[#393342] text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-[#C8C2D0] block">Effectif</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {presentMembers}/{members.length}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-[#C8C2D0] block">Productivité</span>
                        <span className="font-mono font-semibold text-[#7624A8] dark:text-[#D896FF]">
                          {team.productivityRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-[#C8C2D0] block">Qualité</span>
                        <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {team.qualityScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#393342] space-y-1.5">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-[#C8C2D0]">
                      Membres rattachés
                    </div>
                    {members.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-[#C8C2D0]/60">Aucun membre</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {members.map((m) => (
                          <span
                            key={m.id}
                            className="text-xs bg-slate-100 dark:bg-[#211E27] text-slate-700 dark:text-[#C8C2D0] border border-transparent dark:border-[#393342] px-2 py-0.5 rounded"
                          >
                            {m.fullName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Affectation rapide employé -> équipe */}
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Affectation des employés aux équipes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                  <th className="py-3 px-5">Employé</th>
                  <th className="py-3 px-4">Site</th>
                  <th className="py-3 px-4">Équipe affectée</th>
                  <th className="py-3 px-5">Superviseur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
                {assignableEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 px-5 text-center text-xs text-slate-500 dark:text-[#C8C2D0]"
                    >
                      Aucun employé disponible à affecter.
                    </td>
                  </tr>
                ) : (
                  assignableEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-[#F7EEFC]/30 dark:hover:bg-[#211E27]/70">
                      <td className="py-3 px-5">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {emp.fullName}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-[#C8C2D0]">
                          {emp.matricule}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0]">
                        {emp.site}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={emp.teamId}
                          onChange={(e) => {
                            const newTeam = teams.find((t) => t.id === e.target.value);
                            void onUpdateAccount(
                              emp.id,
                              {
                                teamId: e.target.value,
                                supervisorId: newTeam?.supervisorId ?? emp.supervisorId,
                                site: newTeam?.site ?? emp.site,
                              },
                              { reason: `Affectation équipe ${newTeam?.name ?? 'Aucune'}` }
                            );
                          }}
                          className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                        >
                          <option value="">Aucune équipe</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-5 text-xs text-slate-700 dark:text-white">
                        <select
                          value={emp.supervisorId}
                          onChange={(e) =>
                            void onUpdateAccount(
                              emp.id,
                              { supervisorId: e.target.value },
                              { reason: 'Changement de superviseur' }
                            )
                          }
                          className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                        >
                          <option value="">Non assigné</option>
                          {supervisorCandidates.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName} ({ROLE_LABELS[s.role]})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {editingTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
              onClick={() => setEditingTeam(null)}
              aria-hidden="true"
            />
            <form
              onSubmit={handleTeamSubmit}
              className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl z-10"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editingTeam.id ? 'Modifier l’équipe' : 'Nouvelle équipe'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTeam.name}
                    onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Site *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTeam.site}
                    onChange={(e) => setEditingTeam({ ...editingTeam, site: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Superviseur responsable
                  </label>
                  <select
                    value={editingTeam.supervisorId}
                    onChange={(e) => setEditingTeam({ ...editingTeam, supervisorId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                  >
                    <option value="">Non assigné</option>
                    {supervisorCandidates.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({ROLE_LABELS[s.role]})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Société principale
                  </label>
                  <select
                    value={editingTeam.defaultCompanyId}
                    onChange={(e) =>
                      setEditingTeam({ ...editingTeam, defaultCompanyId: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                  >
                    <option value="">Multi-sociétés</option>
                    {companies
                      .filter((c) => !c.archived)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Utilisateurs & comptes"
        action={
          creatableRoles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openExcelModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15 text-[#7624A8] dark:text-[#D896FF] border border-[#A83CE2]/50 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                <span>Importer depuis Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={openNewAccountForm}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Créer un compte</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {createdCredentialsBanner && (
        <div className="bg-[#F7EEFC] dark:bg-[#292631] border border-[#A83CE2]/40 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[#7624A8] dark:text-[#D896FF]">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Compte créé pour {createdCredentialsBanner.fullName} — Mot de passe provisoire généré
              </span>
            </div>
            <div className="text-slate-700 dark:text-[#C8C2D0] flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Matricule :{' '}
                <strong className="font-mono text-slate-900 dark:text-white">
                  {createdCredentialsBanner.matricule}
                </strong>
              </span>
              <span>
                Mot de passe provisoire :{' '}
                <strong className="font-mono text-slate-900 dark:text-white bg-white dark:bg-[#211E27] px-2 py-0.5 rounded border border-slate-200 dark:border-[#393342]">
                  {createdCredentialsBanner.provisionalPassword}
                </strong>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#C8C2D0]/80">
              Communiquez ce mot de passe à l’employé. Pour des raisons de sécurité, il n’est pas conservé en clair.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                copyText(
                  `Matricule : ${createdCredentialsBanner.matricule}\nMot de passe provisoire : ${createdCredentialsBanner.provisionalPassword}`,
                  'created-banner'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{copiedId === 'created-banner' ? 'Copié' : 'Copier'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatedCredentialsBanner(null)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {bannerError && (
        <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span>{bannerError}</span>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="text-red-700 dark:text-red-300 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pendingCorrections.length > 0 && (
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Demandes de correction en attente ({pendingCorrections.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#393342]">
            {pendingCorrections.map((req) => (
              <div
                key={req.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {req.employeeName} · {req.activityLabel} ({req.dossierRef})
                  </div>
                  <div className="text-slate-600 dark:text-[#C8C2D0] mt-0.5">{req.reason}</div>
                  <div className="text-slate-400 dark:text-[#C8C2D0]/70 font-mono mt-0.5">
                    {formatDateTimeFr(req.requestedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onReviewCorrectionRequest(req.id, 'approuvee', 'Correction validée')
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Approuver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onReviewCorrectionRequest(req.id, 'refusee', 'Justificatif insuffisant')
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 font-semibold rounded-lg cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Refuser</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#C8C2D0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, identifiant, matricule, e-mail ou site..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/60 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isSupervisor && (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
            >
              <option value="all">Tous les rôles</option>
              <option value="admin">Administrateurs</option>
              <option value="manager">Managers</option>
              <option value="supervisor">Superviseurs</option>
              <option value="employee">Employés</option>
            </select>
          )}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#211E27] rounded-lg w-fit">
            {(
              [
                { id: 'all', label: 'Tous' },
                { id: 'actif', label: 'Actifs' },
                { id: 'desactive', label: 'Désactivés' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-[#A83CE2] text-white'
                    : 'text-slate-600 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                <th className="py-3 px-5">Utilisateur</th>
                <th className="py-3 px-4">Rôle & Périmètre</th>
                <th className="py-3 px-4">Horaire</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Compte</th>
                <th className="py-3 px-4 text-right">Dossiers</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
              {scopedEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 px-5 text-center text-xs text-slate-500 dark:text-[#C8C2D0]"
                  >
                    Aucun utilisateur trouvé pour ces critères.
                  </td>
                </tr>
              ) : (
                scopedEmployees.map((emp) => {
                  const team = teams.find((t) => t.id === emp.teamId);
                  const sup = employees.find((s) => s.id === emp.supervisorId);
                  const canEditTarget = isAdmin || (emp.role !== 'admin' && emp.role !== 'manager');
                  const canChangeStatusTarget = isAdmin && !emp.isPrimaryAdmin && emp.id !== user.id;

                  return (
                    <tr key={emp.id} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                      <td className="py-3 px-5">
                        <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{emp.fullName}</span>
                          {emp.isPrimaryAdmin && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF]">
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-[#C8C2D0]">
                          {emp.username || emp.matricule || '—'}
                          {emp.email ? ` · ${emp.email}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-[#7624A8] dark:text-[#D896FF]">
                          {ROLE_LABELS[emp.role]}
                        </div>
                        <div className="text-slate-500 dark:text-[#C8C2D0]">
                          {team?.name ?? emp.site}
                          {sup ? ` · Sup. ${sup.fullName}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-[#C8C2D0] whitespace-nowrap">
                        {emp.plannedStart} – {emp.plannedEnd}
                      </td>
                      <td className="py-3 px-4">
                        {emp.role === 'employee' ? (
                          <ServiceStatusDisplay status={emp.status} />
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-[#C8C2D0]/60">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span
                          className={`font-semibold ${
                            emp.accountStatus === 'actif'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {emp.accountStatus === 'actif' ? 'Actif' : ACCOUNT_STATUS_LABELS[emp.accountStatus]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white">
                        {emp.role === 'employee'
                          ? typeof emp.dailyTargetDossiers === 'number' && emp.dailyTargetDossiers > 0
                            ? `${emp.dossiersToday} / ${emp.dailyTargetDossiers}`
                            : `${emp.dossiersToday}`
                          : '—'}
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setInspectedEmp(emp)}
                            title="Consulter fiche, présence et statistiques"
                            className="p-1.5 rounded-lg text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEditTarget && (
                            <button
                              type="button"
                              onClick={() => openEditAccountForm(emp)}
                              title="Modifier"
                              className="p-1.5 rounded-lg text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canChangeStatusTarget && emp.accountStatus !== 'actif' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusChange(
                                  emp,
                                  'actif',
                                  'Réactivation du compte par administrateur'
                                )
                              }
                              title="Réactiver le compte"
                              className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          {canChangeStatusTarget && emp.accountStatus === 'actif' && (
                            <button
                              type="button"
                              onClick={() => setPendingDeactivation(emp)}
                              title="Désactiver le compte"
                              className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Création / Modification compte utilisateur */}
      {accountForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setAccountForm(null)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleAccountSubmit}
            className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl z-10 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {accountForm.id ? 'Modifier le compte utilisateur' : 'Créer un compte utilisateur'}
                </h3>
                {accountForm.id && (
                  <div className="text-xs font-mono text-[#7624A8] dark:text-[#D896FF] mt-0.5">
                    {accountForm.role === 'admin'
                      ? `Identifiant : ${accountForm.username || accountForm.matricule || '—'}`
                      : `Matricule : ${accountForm.matricule || '—'}`}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAccountForm(null)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Nom complet *
                </label>
                <input
                  type="text"
                  required
                  value={accountForm.fullName}
                  onChange={(e) => setAccountForm({ ...accountForm, fullName: e.target.value })}
                  placeholder="Ex. Jean Rakoto"
                  className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
              </div>

              {accountForm.role === 'admin' ? (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Identifiant de connexion *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(accountForm.id && !isAdmin)}
                    value={accountForm.username}
                    onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                    placeholder="Ex. admin"
                    autoComplete="off"
                    className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] disabled:opacity-60"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="owt-account-matricule"
                    className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
                  >
                    Matricule *
                  </label>
                  <input
                    id="owt-account-matricule"
                    type="text"
                    required
                    disabled={Boolean(accountForm.id && !isAdmin)}
                    value={accountForm.matricule}
                    onChange={(e) => setAccountForm({ ...accountForm, matricule: e.target.value })}
                    placeholder="Ex. OWT0001"
                    autoComplete="off"
                    className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] disabled:opacity-60"
                  />
                  {accountForm.id && !isAdmin && (
                    <p className="text-[11px] text-slate-500 dark:text-[#C8C2D0] mt-1">
                      Seul un administrateur peut modifier le matricule.
                    </p>
                  )}
                  {accountForm.id && isAdmin && (
                    <p className="text-[11px] text-[#7624A8] dark:text-[#D896FF] mt-1">
                      Modifiable par l’administrateur : devient immédiatement l’identifiant de connexion.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Rôle *
                </label>
                <select
                  value={accountForm.role}
                  disabled={Boolean(accountForm.isPrimaryAdmin) || isSupervisor}
                  onChange={(e) => {
                    const nextRole = e.target.value as UserRole;
                    setAccountForm({
                      ...accountForm,
                      role: nextRole,
                      matricule:
                        nextRole !== 'admin' && !accountForm.matricule.trim()
                          ? storageService.generateNextMatricule()
                          : accountForm.matricule,
                      site:
                        !accountForm.id && nextRole === 'admin' && accountForm.site === 'Siège'
                          ? 'Direction'
                          : !accountForm.id &&
                            nextRole !== 'admin' &&
                            accountForm.site === 'Direction'
                          ? 'Siège'
                          : accountForm.site,
                      dailyTargetDossiers:
                        nextRole === 'employee' ? accountForm.dailyTargetDossiers : '',
                    });
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] disabled:opacity-60"
                >
                  {(accountForm.id && !isAdmin
                    ? [accountForm.role]
                    : isAdmin
                    ? (['employee', 'supervisor', 'manager', 'admin'] as UserRole[])
                    : (['employee', 'supervisor'] as UserRole[])
                  ).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Adresse e-mail (facultative)
                </label>
                <input
                  type="email"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                  placeholder="Optionnel"
                  className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Intitulé de poste
                </label>
                <input
                  type="text"
                  value={accountForm.jobTitle}
                  onChange={(e) => setAccountForm({ ...accountForm, jobTitle: e.target.value })}
                  placeholder={ROLE_LABELS[accountForm.role]}
                  className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Site
                </label>
                <input
                  type="text"
                  value={accountForm.site}
                  onChange={(e) => setAccountForm({ ...accountForm, site: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
              </div>

              {(accountForm.role === 'employee' || accountForm.role === 'supervisor') && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Équipe
                  </label>
                  <select
                    value={accountForm.teamId}
                    onChange={(e) => {
                      const nextTeamId = e.target.value;
                      const t = teams.find((item) => item.id === nextTeamId);
                      setAccountForm({
                        ...accountForm,
                        teamId: nextTeamId,
                        supervisorId: t?.supervisorId ?? accountForm.supervisorId,
                        selectedProjectIds: computeProjectsForTeamChange(
                          nextTeamId,
                          accountForm.manuallyToggledProjectIds
                        ),
                      });
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                  >
                    <option value="">Aucune équipe</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {accountForm.role === 'employee' && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Superviseur
                  </label>
                  <select
                    value={accountForm.supervisorId}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, supervisorId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                  >
                    <option value="">Non assigné</option>
                    {supervisorCandidates.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({ROLE_LABELS[s.role]})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Début prévu
                </label>
                <input
                  type="time"
                  value={accountForm.plannedStart}
                  onChange={(e) => setAccountForm({ ...accountForm, plannedStart: e.target.value })}
                  className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Fin prévue
                </label>
                <input
                  type="time"
                  value={accountForm.plannedEnd}
                  onChange={(e) => setAccountForm({ ...accountForm, plannedEnd: e.target.value })}
                  className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
              </div>

              {accountForm.role === 'employee' && (
                <div>
                  <label
                    htmlFor="owt-account-daily-target"
                    className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
                  >
                    Objectif / jour (facultatif)
                  </label>
                  <input
                    id="owt-account-daily-target"
                    type="number"
                    step="any"
                    inputMode="numeric"
                    autoComplete="off"
                    value={accountForm.dailyTargetDossiers}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        dailyTargetDossiers: e.target.value,
                      })
                    }
                    placeholder="Non défini"
                    className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              )}

              {accountForm.id && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Statut du compte
                  </label>
                  <select
                    value={accountForm.accountStatus}
                    disabled={
                      !isAdmin ||
                      Boolean(accountForm.isPrimaryAdmin) ||
                      accountForm.id === user.id
                    }
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        accountStatus: e.target.value as AccountStatus,
                      })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] disabled:opacity-60"
                  >
                    <option value="actif">Actif</option>
                    <option value="desactive">Désactivé</option>
                    {accountForm.accountStatus === 'archive' && (
                      <option value="archive">Archivé</option>
                    )}
                  </select>
                </div>
              )}

              {!isSupervisor && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                      {accountForm.id
                        ? 'Nouveau mot de passe (optionnel)'
                        : accountForm.role === 'admin'
                        ? 'Mot de passe initial * (8 car. min.)'
                        : 'Mot de passe personnalisé (facultatif)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={!accountForm.id && accountForm.role === 'admin'}
                        minLength={
                          accountForm.password.trim() || (!accountForm.id && accountForm.role === 'admin')
                            ? 8
                            : undefined
                        }
                        autoComplete="new-password"
                        value={accountForm.password}
                        onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                        placeholder={
                          accountForm.id
                            ? 'Laisser vide si inchangé'
                            : accountForm.role === 'admin'
                            ? '8 caractères minimum'
                            : 'Laisser vide pour mot de passe provisoire'
                        }
                        className="w-full pl-3 pr-9 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        aria-label={showPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {!accountForm.id &&
                      accountForm.role !== 'admin' &&
                      !accountForm.password.trim() && (
                        <p className="text-[11px] text-[#7624A8] dark:text-[#D896FF] mt-1 font-mono">
                          Provisoire auto : {buildProvisionalPassword(accountForm.matricule || 'MATRICULE')}
                        </p>
                      )}
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                      Confirmation du mot de passe
                      {accountForm.password.trim().length > 0 ||
                      (!accountForm.id && accountForm.role === 'admin')
                        ? ' *'
                        : ''}
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={
                        accountForm.password.trim().length > 0 ||
                        (!accountForm.id && accountForm.role === 'admin')
                      }
                      autoComplete="new-password"
                      value={accountForm.confirmPassword}
                      onChange={(e) =>
                        setAccountForm({ ...accountForm, confirmPassword: e.target.value })
                      }
                      placeholder={
                        accountForm.password.trim().length > 0 ||
                        (!accountForm.id && accountForm.role === 'admin')
                          ? 'Confirmer le mot de passe'
                          : 'Non requis si provisoire auto'
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Section Affectation aux projets */}
            <div className="pt-3 border-t border-slate-200 dark:border-[#393342] space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white">
                  <FolderKanban className="w-4 h-4 text-[#A83CE2] shrink-0" aria-hidden="true" />
                  <span>Affectation aux projets</span>
                </div>
                {(accountForm.role === 'employee' || accountForm.role === 'supervisor') && (
                  <span className="font-mono text-[11px] text-[#7624A8] dark:text-[#D896FF] tabular-nums">
                    {accountForm.selectedProjectIds.length} sélectionné(s)
                  </span>
                )}
              </div>

              {accountForm.role === 'admin' || accountForm.role === 'manager' ? (
                <div className="p-3 bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg text-slate-600 dark:text-[#C8C2D0]">
                  Les comptes {ROLE_LABELS[accountForm.role]} disposent automatiquement de l’accès de gestion aux projets selon leur rôle.
                </div>
              ) : activeAssignableProjects.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg text-slate-500 dark:text-[#C8C2D0]">
                  Aucun projet actif disponible pour affectation.
                </div>
              ) : (
                <div className="space-y-2">
                  {!canAssignProjects && (
                    <div className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
                      Consultation uniquement : seuls l’administrateur et les managers peuvent modifier les affectations aux projets.
                    </div>
                  )}
                  <div className="border border-slate-200 dark:border-[#393342] rounded-lg divide-y divide-slate-100 dark:divide-[#393342] max-h-48 overflow-y-auto bg-white dark:bg-[#211E27]">
                    {activeAssignableProjects.map((proj) => {
                      const isChecked = accountForm.selectedProjectIds.includes(proj.id);
                      const inSelectedTeam = Boolean(
                        accountForm.teamId && proj.assignedTeamIds.includes(accountForm.teamId)
                      );
                      const statusHint = isChecked
                        ? inSelectedTeam
                          ? 'Inclus via équipe'
                          : 'Affectation individuelle'
                        : inSelectedTeam
                        ? 'Exclu de l’équipe'
                        : 'Non affecté';

                      return (
                        <label
                          key={proj.id}
                          className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
                            canAssignProjects
                              ? 'cursor-pointer hover:bg-[#F7EEFC]/50 dark:hover:bg-[#A83CE2]/10'
                              : 'cursor-default opacity-80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              disabled={!canAssignProjects}
                              checked={isChecked}
                              onChange={() => {
                                if (!canAssignProjects) return;
                                const nextChecked = !isChecked;
                                const nextSelected = nextChecked
                                  ? Array.from(new Set([...accountForm.selectedProjectIds, proj.id]))
                                  : accountForm.selectedProjectIds.filter((id) => id !== proj.id);
                                setAccountForm({
                                  ...accountForm,
                                  selectedProjectIds: nextSelected,
                                  manuallyToggledProjectIds: {
                                    ...accountForm.manuallyToggledProjectIds,
                                    [proj.id]: nextChecked,
                                  },
                                });
                              }}
                              className="w-4 h-4 accent-[#A83CE2] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-white truncate">
                                {proj.name}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 dark:text-[#C8C2D0]">
                                {proj.code}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[11px] shrink-0 ${
                              isChecked
                                ? 'font-semibold text-[#7624A8] dark:text-[#D896FF]'
                                : inSelectedTeam
                                ? 'font-medium text-amber-700 dark:text-amber-400'
                                : 'text-slate-400 dark:text-[#C8C2D0]/60'
                            }`}
                          >
                            {statusHint}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {formError && (
              <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-3.5 py-2.5">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAccountForm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] disabled:opacity-60 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Consultation Historique / Traitements / Stats Utilisateur */}
      {inspectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setInspectedEmp(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-3xl w-full p-6 space-y-5 shadow-xl z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#393342] pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {inspectedEmp.fullName}
                </h3>
                <div className="text-xs text-slate-500 dark:text-[#C8C2D0] font-mono mt-0.5">
                  {inspectedEmp.username || inspectedEmp.matricule || '—'} ·{' '}
                  {ROLE_LABELS[inspectedEmp.role]} · {inspectedEmp.site} ·{' '}
                  {inspectedEmp.plannedStart}–{inspectedEmp.plannedEnd}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedEmp(null)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-[#211E27] rounded-lg border border-slate-200 dark:border-[#393342]">
                <div className="text-slate-500 dark:text-[#C8C2D0]">Présence jour</div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {formatDurationHM(inspectedEmp.presenceSecondsToday)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#211E27] rounded-lg border border-slate-200 dark:border-[#393342]">
                <div className="text-slate-500 dark:text-[#C8C2D0]">Productif jour</div>
                <div className="text-base font-bold font-mono text-[#7624A8] dark:text-[#D896FF] mt-1">
                  {formatDurationHM(inspectedEmp.productiveSecondsToday)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#211E27] rounded-lg border border-slate-200 dark:border-[#393342]">
                <div className="text-slate-500 dark:text-[#C8C2D0]">Dossiers jour</div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {typeof inspectedEmp.dailyTargetDossiers === 'number' &&
                  inspectedEmp.dailyTargetDossiers > 0
                    ? `${inspectedEmp.dossiersToday} / ${inspectedEmp.dailyTargetDossiers}`
                    : `${inspectedEmp.dossiersToday}`}
                </div>
                {!(
                  typeof inspectedEmp.dailyTargetDossiers === 'number' &&
                  inspectedEmp.dailyTargetDossiers > 0
                ) && (
                  <div className="text-[11px] text-slate-500 dark:text-[#C8C2D0] mt-0.5">
                    Objectif non défini
                  </div>
                )}
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#211E27] rounded-lg border border-slate-200 dark:border-[#393342]">
                <div className="text-slate-500 dark:text-[#C8C2D0]">Contrôles qualité</div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {inspectedQc.length}
                </div>
              </div>
            </div>

            {(inspectedEmp.role === 'employee' || inspectedEmp.role === 'supervisor') && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-[#C8C2D0] mb-2">
                  Projets actifs affectés
                </h4>
                {(() => {
                  const empProjects = activeAssignableProjects.filter((p) =>
                    storageService.isEmployeeAssignedToProject(inspectedEmp, p)
                  );
                  if (empProjects.length === 0) {
                    return (
                      <div className="text-xs text-slate-500 dark:text-[#C8C2D0]">
                        Aucun projet actif affecté.
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {empProjects.map((p) => (
                        <span
                          key={p.id}
                          className="px-2.5 py-1 bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF] border border-[#A83CE2]/25 rounded font-medium"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-slate-700 dark:text-[#C8C2D0] mb-2">
                Derniers traitements & activités
              </h4>
              {inspectedActivities.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-3">
                  Aucune activité enregistrée pour ce compte.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-[#393342] rounded-lg divide-y divide-slate-100 dark:divide-[#393342] text-xs">
                  {inspectedActivities.slice(0, 6).map((a) => (
                    <div key={a.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {a.taskTitle || a.projectName || 'Traitement'}
                        </span>
                        {a.clientName && (
                          <span className="text-slate-500 dark:text-[#C8C2D0]">
                            {' '}
                            · {a.clientName}
                          </span>
                        )}
                        {a.dossierRef ? (
                          <span className="font-mono text-slate-400 dark:text-[#C8C2D0]/70">
                            {' '}
                            ({a.dossierRef})
                          </span>
                        ) : a.formVersionNumber ? (
                          <span className="font-mono text-slate-400 dark:text-[#C8C2D0]/70">
                            {' '}
                            (v{a.formVersionNumber})
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-slate-700 dark:text-[#C8C2D0] whitespace-nowrap">
                        {formatTimeShort(a.startedAt)}–{formatTimeShort(a.endedAt)} (
                        {formatDurationHM(a.durationSeconds)})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {inspectedHistory.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-[#C8C2D0] mb-2">
                  Historique d’activité récent
                </h4>
                <div className="border border-slate-200 dark:border-[#393342] rounded-lg divide-y divide-slate-100 dark:divide-[#393342] text-xs">
                  {inspectedHistory.map((h) => (
                    <div key={h.id} className="px-3.5 py-2 flex items-center justify-between">
                      <span className="capitalize font-medium text-slate-800 dark:text-white">
                        {formatDateFr(h.date)}
                      </span>
                      <span className="font-mono text-slate-600 dark:text-[#C8C2D0]">
                        Productif {formatDurationHM(h.productiveSeconds)} · {h.dossiersCount} doss.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inspectedQc.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-[#C8C2D0] mb-2">
                  Contrôles qualité
                </h4>
                <div className="border border-slate-200 dark:border-[#393342] rounded-lg divide-y divide-slate-100 dark:divide-[#393342] text-xs">
                  {inspectedQc.map((q) => (
                    <div key={q.id} className="px-3.5 py-2 flex items-center justify-between">
                      <div className="text-slate-700 dark:text-[#C8C2D0]">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {q.dossierRef ||
                            (q.projectName ? `${q.projectName} (v${q.formVersionNumber ?? 1})` : '—')}
                        </span>
                        {q.companyName || q.taskName
                          ? ` · ${[q.companyName, q.taskName].filter(Boolean).join(' · ')}`
                          : ''}
                      </div>
                      <QualityControlStatusText status={q.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Importation Excel (.xlsx) */}
      {excelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={closeExcelModal}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-5xl w-full p-6 space-y-5 shadow-xl z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#393342] pb-4 gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#7624A8] dark:text-[#D896FF]">
                  <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                  <span>Importation Excel (.xlsx)</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {excelResult
                    ? 'Bilan de l’importation'
                    : excelPreview && !excelPreview.error
                    ? 'Aperçu avant importation'
                    : 'Importer des utilisateurs depuis Excel'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeExcelModal}
                disabled={importingExcel}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer disabled:opacity-50"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!excelResult && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1.5 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Colonnes attendues :{' '}
                      <span className="font-mono text-[#7624A8] dark:text-[#D896FF]">Nom</span>,{' '}
                      <span className="font-mono text-[#7624A8] dark:text-[#D896FF]">Matricule</span>,{' '}
                      <span className="font-mono text-[#7624A8] dark:text-[#D896FF]">Rôle</span> et{' '}
                      <span className="font-mono text-[#7624A8] dark:text-[#D896FF]">Projet</span>
                    </div>
                    <p className="text-slate-600 dark:text-[#C8C2D0]">
                      Rôles acceptés : <span className="font-medium">Employé</span>,{' '}
                      <span className="font-medium">Superviseur</span>
                      {isAdmin ? (
                        <>
                          , <span className="font-medium">Manager</span>
                        </>
                      ) : (
                        ' (le rôle Manager est réservé à l’Administrateur)'
                      )}
                      . Indiquez le code ou le nom exact du projet ; séparez plusieurs projets par{' '}
                      <span className="font-mono font-semibold">;</span> (ex :{' '}
                      <span className="font-mono">PROJET_A; PROJET_B</span>).
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#C8C2D0]/80">
                      Mot de passe provisoire généré automatiquement :{' '}
                      <span className="font-mono">2026-OWT-&#123;MATRICULE&#125;</span>. Les comptes existants ne sont jamais modifiés.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleExcelFileSelected}
                      className="hidden"
                      id="owt-excel-import-input"
                    />
                    <label
                      htmlFor="owt-excel-import-input"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      <span>{excelPreview ? 'Changer de fichier' : 'Choisir un fichier .xlsx'}</span>
                    </label>
                  </div>
                </div>

                {excelPreview?.error && (
                  <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{excelPreview.error}</span>
                  </div>
                )}

                {excelPreview && !excelPreview.error && (
                  <div className="space-y-4">
                    <div className="text-xs text-slate-600 dark:text-[#C8C2D0]">
                      Fichier analysé :{' '}
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {excelPreview.fileName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 dark:bg-[#211E27] rounded-lg border border-slate-200 dark:border-[#393342]">
                        <div className="text-slate-500 dark:text-[#C8C2D0]">Total lignes</div>
                        <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                          {excelPreview.totalRows}
                        </div>
                      </div>
                      <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                        <div className="text-emerald-800 dark:text-emerald-300">Lignes valides</div>
                        <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {excelPreview.validRows}
                        </div>
                      </div>
                      <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                        <div className="text-amber-800 dark:text-amber-300">Doublons</div>
                        <div className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400 mt-0.5">
                          {excelPreview.duplicateRows}
                        </div>
                      </div>
                      <div className="p-3 bg-red-50/70 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800/50">
                        <div className="text-red-800 dark:text-red-300">Invalides</div>
                        <div className="text-lg font-bold font-mono text-red-700 dark:text-red-400 mt-0.5">
                          {excelPreview.invalidRows}
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden max-h-72 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-[#211E27] border-b border-slate-200 dark:border-[#393342] text-slate-500 dark:text-[#C8C2D0]">
                          <tr>
                            <th className="py-2.5 px-3">Ligne</th>
                            <th className="py-2.5 px-3">Nom</th>
                            <th className="py-2.5 px-3">Matricule</th>
                            <th className="py-2.5 px-3">Rôle</th>
                            <th className="py-2.5 px-3">Projets</th>
                            <th className="py-2.5 px-3">Statut</th>
                            <th className="py-2.5 px-3">Détail / Motif de rejet</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#393342]">
                          {excelPreview.rows.map((row) => (
                            <tr key={`${row.rowNumber}-${row.matricule}`} className="bg-white dark:bg-[#292631]">
                              <td className="py-2 px-3 font-mono text-slate-500 dark:text-[#C8C2D0]">
                                #{row.rowNumber}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                                {row.fullName || '—'}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-800 dark:text-white">
                                {row.matricule || '—'}
                              </td>
                              <td className="py-2 px-3 text-slate-700 dark:text-[#C8C2D0] whitespace-nowrap">
                                {row.roleLabel ?? (row.rawRole || '—')}
                              </td>
                              <td className="py-2 px-3 text-slate-700 dark:text-[#C8C2D0]">
                                {row.projectLabels.length > 0
                                  ? row.projectLabels.join(' ; ')
                                  : row.rawProjects || '—'}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {row.status === 'valid' ? (
                                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                    Valide
                                  </span>
                                ) : row.status === 'duplicate' ? (
                                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                                    Doublon
                                  </span>
                                ) : (
                                  <span className="font-semibold text-red-700 dark:text-red-400">
                                    Invalide
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-[#C8C2D0]">
                                {row.reason ??
                                  `Prêt pour création (${row.roleLabel} · ${row.projectLabels.length} projet${
                                    row.projectLabels.length > 1 ? 's' : ''
                                  })`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={closeExcelModal}
                        disabled={importingExcel}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmExcelImport}
                        disabled={excelPreview.validRows === 0 || importingExcel}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#A83CE2] hover:bg-[#7624A8] disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        <Check className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {importingExcel
                            ? 'Importation en cours...'
                            : `Confirmer l’importation (${excelPreview.validRows} compte${
                                excelPreview.validRows > 1 ? 's' : ''
                              })`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {excelResult && (
              <div className="space-y-4">
                {excelResult.execution.error && (
                  <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3">
                    {excelResult.execution.error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                    <div className="text-emerald-800 dark:text-emerald-300">Comptes créés</div>
                    <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {excelResult.execution.createdAccounts.length}
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-[#211E27] rounded-lg border border-slate-200 dark:border-[#393342]">
                    <div className="text-slate-500 dark:text-[#C8C2D0]">Lignes ignorées</div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                      {excelResult.ignoredFromPreview.length +
                        excelResult.execution.rejectedItems.length}
                    </div>
                  </div>
                </div>

                {excelResult.execution.createdAccounts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                          Comptes créés, affectations projets et mots de passe provisoires
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
                          Ces mots de passe provisoires sont affichés uniquement ici pour transmission aux utilisateurs ; seul leur hash est stocké.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            excelResult.execution.createdAccounts
                              .map(
                                (acc) =>
                                  `${acc.matricule}\t${acc.fullName}\t${acc.roleLabel}\t${acc.assignedProjects.join('; ')}\t${acc.provisionalPassword}`
                              )
                              .join('\n'),
                            'excel-all'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7EEFC] dark:bg-[#A83CE2]/20 hover:bg-[#A83CE2] hover:text-white text-[#7624A8] dark:text-[#D896FF] text-xs font-semibold rounded-lg cursor-pointer transition-colors shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{copiedId === 'excel-all' ? 'Liste copiée' : 'Copier tout'}</span>
                      </button>
                    </div>

                    <div className="border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden max-h-64 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-[#211E27] border-b border-slate-200 dark:border-[#393342] text-slate-500 dark:text-[#C8C2D0]">
                          <tr>
                            <th className="py-2.5 px-3">Matricule</th>
                            <th className="py-2.5 px-3">Nom complet</th>
                            <th className="py-2.5 px-3">Rôle</th>
                            <th className="py-2.5 px-3">Projets affectés</th>
                            <th className="py-2.5 px-3">Mot de passe provisoire</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#393342]">
                          {excelResult.execution.createdAccounts.map((acc) => (
                            <tr key={acc.matricule} className="bg-white dark:bg-[#292631]">
                              <td className="py-2 px-3 font-mono font-semibold text-[#7624A8] dark:text-[#D896FF]">
                                {acc.matricule}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                                {acc.fullName}
                              </td>
                              <td className="py-2 px-3 text-slate-700 dark:text-[#C8C2D0] whitespace-nowrap">
                                {acc.roleLabel}
                              </td>
                              <td className="py-2 px-3 text-slate-700 dark:text-[#C8C2D0]">
                                {acc.assignedProjects.join(' ; ')}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-900 dark:text-white">
                                {acc.provisionalPassword}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyText(acc.provisionalPassword, `pw-${acc.matricule}`)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-[#211E27] text-slate-700 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" aria-hidden="true" />
                                  <span>
                                    {copiedId === `pw-${acc.matricule}` ? 'Copié' : 'Copier'}
                                  </span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(excelResult.ignoredFromPreview.length > 0 ||
                  excelResult.execution.rejectedItems.length > 0) && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-[#C8C2D0]">
                      Lignes ignorées ({excelResult.ignoredFromPreview.length + excelResult.execution.rejectedItems.length})
                    </h4>
                    <div className="border border-slate-200 dark:border-[#393342] rounded-lg divide-y divide-slate-100 dark:divide-[#393342] max-h-40 overflow-y-auto text-xs">
                      {[...excelResult.ignoredFromPreview, ...excelResult.execution.rejectedItems].map(
                        (item, idx) => (
                          <div
                            key={`${item.rowNumber}-${item.matricule}-${idx}`}
                            className="px-3 py-2 flex items-center justify-between gap-3 bg-white dark:bg-[#292631]"
                          >
                            <span className="text-slate-700 dark:text-white">
                              <span className="font-mono text-slate-400 mr-1.5">
                                #{item.rowNumber}
                              </span>
                              {item.fullName || '—'} ({item.matricule || '—'})
                            </span>
                            <span className="text-amber-700 dark:text-amber-400 text-right">
                              {item.reason}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeExcelModal}
                    className="px-5 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Confirmation Désactivation */}
      {pendingDeactivation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setPendingDeactivation(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirmer la désactivation du compte
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeactivation(null)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-3.5 text-xs space-y-1">
              <div className="font-semibold text-sm text-slate-900 dark:text-white">
                {pendingDeactivation.fullName}
              </div>
              <div className="font-mono text-[#7624A8] dark:text-[#D896FF]">
                {pendingDeactivation.role === 'admin' ? 'Identifiant' : 'Matricule'} :{' '}
                {pendingDeactivation.matricule || pendingDeactivation.username || '—'}
              </div>
              <div className="text-slate-500 dark:text-[#C8C2D0]">
                Rôle : {ROLE_LABELS[pendingDeactivation.role]}
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#C8C2D0] leading-relaxed">
              Ce compte sera immédiatement bloqué à la connexion et exclu des effectifs actifs et
              nouvelles affectations. Aucune donnée historique (activités, statistiques, contrôles
              qualité, horaires et journal d’audit) ne sera supprimée et le compte pourra être
              réactivé ultérieurement.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingDeactivation(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingDeactivation;
                  setPendingDeactivation(null);
                  handleStatusChange(
                    target,
                    'desactive',
                    'Désactivation du compte par administrateur'
                  );
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Confirmer la désactivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
