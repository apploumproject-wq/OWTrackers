import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  Search,
  UserCheck,
  UserMinus,
  Archive,
  X,
} from 'lucide-react';
import {
  AccountStatus,
  ActivityRecord,
  AppUser,
  CompanyRecord,
  CorrectionRequest,
  ManagedEmployee,
  QualityControlRecord,
  TeamRecord,
  UserRole,
} from '../../core/types';
import { ROLE_LABELS } from '../../core/permissions';
import { CreateUserInput, storageService } from '../../services/storageService';
import { isValidEmail } from '../../utils/crypto';
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
  correctionRequests: CorrectionRequest[];
  qualityControls: QualityControlRecord[];
  onCreateAccount: (input: CreateUserInput) => Promise<{ error?: string }>;
  onUpdateAccount: (
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
    options?: { newPassword?: string; reason?: string }
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
  matriculePreview: string;
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
  dailyTargetDossiers: number;
  accountStatus: AccountStatus;
  password: string;
  confirmPassword: string;
}

export function EmployeesTeamsView({
  mode,
  user,
  employees,
  teams,
  companies,
  correctionRequests,
  qualityControls,
  onCreateAccount,
  onUpdateAccount,
  onSetAccountStatus,
  onSaveTeam,
  onReviewCorrectionRequest,
}: EmployeesTeamsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [accountForm, setAccountForm] = useState<AccountFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inspectedEmp, setInspectedEmp] = useState<ManagedEmployee | null>(null);
  const [editingTeam, setEditingTeam] = useState<(Omit<TeamRecord, 'id'> & { id?: string }) | null>(
    null
  );

  const isSupervisor = user.role === 'supervisor';
  const isAdmin = user.role === 'admin';

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
      if (statusFilter !== 'all' && e.accountStatus !== statusFilter) return false;
      if (roleFilter !== 'all' && e.role !== roleFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.matricule.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
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

  const openNewAccountForm = () => {
    const defaultTeam = teams[0];
    setFormError(null);
    setShowPassword(false);
    setAccountForm({
      matriculePreview: storageService.generateNextMatricule(),
      fullName: '',
      email: '',
      role: 'employee',
      jobTitle: '',
      site: defaultTeam?.site ?? 'Siège',
      teamId: defaultTeam?.id ?? '',
      supervisorId: defaultTeam?.supervisorId ?? '',
      plannedStart: '08:30',
      plannedEnd: '17:00',
      restDays: ['Samedi', 'Dimanche'],
      dailyTargetDossiers: 35,
      accountStatus: 'actif',
      password: '',
      confirmPassword: '',
    });
  };

  const openEditAccountForm = (emp: ManagedEmployee) => {
    setFormError(null);
    setShowPassword(false);
    setAccountForm({
      id: emp.id,
      matriculePreview: emp.matricule,
      isPrimaryAdmin: emp.isPrimaryAdmin,
      fullName: emp.fullName,
      email: emp.email,
      role: emp.role,
      jobTitle: emp.jobTitle ?? '',
      site: emp.site,
      teamId: emp.teamId,
      supervisorId: emp.supervisorId,
      plannedStart: emp.plannedStart,
      plannedEnd: emp.plannedEnd,
      restDays: emp.restDays,
      dailyTargetDossiers: emp.dailyTargetDossiers,
      accountStatus: emp.accountStatus,
      password: '',
      confirmPassword: '',
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
    if (!isValidEmail(accountForm.email)) {
      setFormError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    if (!accountForm.id) {
      if (accountForm.password.length < 8) {
        setFormError('Le mot de passe initial doit contenir au moins 8 caractères.');
        return;
      }
      if (accountForm.password !== accountForm.confirmPassword) {
        setFormError('Les deux mots de passe ne correspondent pas.');
        return;
      }

      setSubmitting(true);
      try {
        const res = await onCreateAccount({
          fullName: accountForm.fullName,
          email: accountForm.email,
          password: accountForm.password,
          role: accountForm.role,
          jobTitle: accountForm.jobTitle,
          site: accountForm.site,
          teamId: accountForm.teamId,
          supervisorId: accountForm.supervisorId,
          plannedStart: accountForm.plannedStart,
          plannedEnd: accountForm.plannedEnd,
          restDays: accountForm.restDays,
          dailyTargetDossiers: accountForm.dailyTargetDossiers,
        });
        if (res.error) {
          setFormError(res.error);
          return;
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
          fullName: accountForm.fullName,
          email: accountForm.email,
          role: accountForm.role,
          jobTitle: accountForm.jobTitle,
          site: accountForm.site,
          teamId: accountForm.role === 'employee' || accountForm.role === 'supervisor' ? accountForm.teamId : '',
          supervisorId: accountForm.role === 'employee' ? accountForm.supervisorId : '',
          plannedStart: accountForm.plannedStart,
          plannedEnd: accountForm.plannedEnd,
          restDays: accountForm.restDays,
          dailyTargetDossiers:
            accountForm.role === 'employee' ? accountForm.dailyTargetDossiers : 0,
          accountStatus: accountForm.accountStatus,
        },
        {
          newPassword: accountForm.password.trim() ? accountForm.password : undefined,
          reason: 'Mise à jour compte utilisateur',
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
      (e) => e.accountStatus !== 'archive' && e.role === 'employee'
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
                (e) => e.teamId === team.id && e.accountStatus !== 'archive'
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
            <button
              type="button"
              onClick={openNewAccountForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Créer un compte</span>
            </button>
          ) : undefined
        }
      />

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
            placeholder="Nom, matricule, e-mail ou site..."
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
                { id: 'archive', label: 'Archivés' },
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
                  const canChangeStatusTarget = !isSupervisor && canEditTarget && !emp.isPrimaryAdmin;

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
                          {emp.matricule} · {emp.email}
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
                              : emp.accountStatus === 'desactive'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-500 dark:text-[#C8C2D0]/60'
                          }`}
                        >
                          {ACCOUNT_STATUS_LABELS[emp.accountStatus]}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white">
                        {emp.role === 'employee'
                          ? `${emp.dossiersToday} / ${emp.dailyTargetDossiers}`
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
                              onClick={() => handleStatusChange(emp, 'actif', 'Réactivation compte')}
                              title="Activer"
                              className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          {canChangeStatusTarget && emp.accountStatus === 'actif' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusChange(emp, 'desactive', 'Désactivation temporaire')
                              }
                              title="Désactiver"
                              className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                          {canChangeStatusTarget && emp.accountStatus !== 'archive' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusChange(
                                  emp,
                                  'archive',
                                  'Archivage avec historique conservé'
                                )
                              }
                              title="Archiver"
                              className="p-1.5 rounded-lg text-slate-500 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] cursor-pointer"
                            >
                              <Archive className="w-4 h-4" />
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
                <div className="text-xs font-mono text-[#7624A8] dark:text-[#D896FF] mt-0.5">
                  Matricule : {accountForm.matriculePreview}
                  {!accountForm.id ? ' (attribué automatiquement)' : ''}
                </div>
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
                  placeholder="Ex. Jean Dupont"
                  className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
              </div>

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
                      dailyTargetDossiers:
                        nextRole === 'employee'
                          ? accountForm.dailyTargetDossiers || 35
                          : 0,
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

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Adresse e-mail *
                </label>
                <input
                  type="email"
                  required
                  value={accountForm.email}
                  onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                  placeholder="utilisateur@entreprise.com"
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
                      const t = teams.find((item) => item.id === e.target.value);
                      setAccountForm({
                        ...accountForm,
                        teamId: e.target.value,
                        supervisorId: t?.supervisorId ?? accountForm.supervisorId,
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
                  <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Objectif / jour
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={accountForm.dailyTargetDossiers || 35}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        dailyTargetDossiers: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
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
                    disabled={Boolean(accountForm.isPrimaryAdmin) || isSupervisor}
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
                    <option value="archive">Archivé</option>
                  </select>
                </div>
              )}

              {!isSupervisor && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                      {accountForm.id
                        ? 'Nouveau mot de passe (optionnel)'
                        : 'Mot de passe initial * (8 car. min.)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={!accountForm.id}
                        minLength={accountForm.id && !accountForm.password ? undefined : 8}
                        autoComplete="new-password"
                        value={accountForm.password}
                        onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                        placeholder={accountForm.id ? 'Laisser vide si inchangé' : ''}
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
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                      Confirmation du mot de passe{!accountForm.id ? ' *' : ''}
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!accountForm.id || accountForm.password.length > 0}
                      autoComplete="new-password"
                      value={accountForm.confirmPassword}
                      onChange={(e) =>
                        setAccountForm({ ...accountForm, confirmPassword: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                    />
                  </div>
                </>
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
                  {inspectedEmp.matricule} · {ROLE_LABELS[inspectedEmp.role]} · {inspectedEmp.site} ·{' '}
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
                  {inspectedEmp.dossiersToday} / {inspectedEmp.dailyTargetDossiers}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#211E27] rounded-lg border border-slate-200 dark:border-[#393342]">
                <div className="text-slate-500 dark:text-[#C8C2D0]">Contrôles qualité</div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {inspectedQc.length}
                </div>
              </div>
            </div>

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
                          {a.taskTitle}
                        </span>{' '}
                        <span className="text-slate-500 dark:text-[#C8C2D0]">· {a.clientName}</span>{' '}
                        <span className="font-mono text-slate-400 dark:text-[#C8C2D0]/70">
                          ({a.dossierRef})
                        </span>
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
                          {q.dossierRef}
                        </span>{' '}
                        · {q.companyName} ({q.taskName})
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
    </div>
  );
}
