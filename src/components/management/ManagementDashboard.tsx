import React, { useMemo } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import {
  CompanyRecord,
  CorrectionRequest,
  AppUser,
  ManagedEmployee,
  NavModuleId,
  OutingAuthorizationRequest,
  QualityControlRecord,
  TeamRecord,
} from '../../core/types';
import { OUTING_REASON_CONFIG, ROLE_LABELS } from '../../core/permissions';
import { formatDateLongFr, formatDurationHM, formatTimeShort } from '../../utils/formatters';
import {
  QualityControlStatusText,
  SectionHeader,
  ServiceStatusDisplay,
  StatTile,
} from '../ui/DataPrimitives';

interface ManagementDashboardProps {
  user: AppUser;
  employees: ManagedEmployee[];
  teams: TeamRecord[];
  companies: CompanyRecord[];
  qualityControls: QualityControlRecord[];
  outingRequests: OutingAuthorizationRequest[];
  correctionRequests: CorrectionRequest[];
  onReviewOutingRequest: (requestId: string, decision: 'approuvee' | 'refusee') => void;
  onNavigate: (moduleId: NavModuleId) => void;
}

export function ManagementDashboard({
  user,
  employees,
  teams,
  companies,
  qualityControls,
  outingRequests,
  correctionRequests,
  onReviewOutingRequest,
  onNavigate,
}: ManagementDashboardProps) {
  const isSupervisor = user.role === 'supervisor';
  const isManager = user.role === 'manager';

  const scopedTeams = isSupervisor
    ? teams.filter((t) => t.id === user.teamId || t.supervisorId === user.id)
    : teams;

  const scopedEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (e.accountStatus !== 'actif' || e.role !== 'employee') return false;
        if (isSupervisor && user.teamId) return e.teamId === user.teamId;
        return true;
      }),
    [employees, isSupervisor, user.teamId]
  );

  const activeAccountsCount = useMemo(
    () => employees.filter((e) => e.accountStatus === 'actif').length,
    [employees]
  );

  const scopedQc = useMemo(
    () =>
      isSupervisor && user.teamId
        ? qualityControls.filter((q) => q.teamId === user.teamId)
        : qualityControls,
    [qualityControls, isSupervisor, user.teamId]
  );

  const controlledQc = scopedQc.filter((q) => q.status !== 'en_attente');
  const compliantQc = controlledQc.filter(
    (q) => q.status === 'valide' || q.status === 'valide_observation'
  );
  const qualityRate =
    controlledQc.length > 0 ? Math.round((compliantQc.length / controlledQc.length) * 100) : null;

  const pendingOutings = outingRequests.filter((r) => {
    if (r.status !== 'en_attente') return false;
    if (isSupervisor && user.teamId) return r.teamId === user.teamId;
    return true;
  });

  const pendingCorrectionsCount = correctionRequests.filter((r) => {
    if (r.status !== 'en_attente') return false;
    if (isSupervisor && user.teamId) return r.teamId === user.teamId;
    return true;
  }).length;

  const presentCount = scopedEmployees.filter((e) => e.status !== 'absent').length;
  const pausedCount = scopedEmployees.filter((e) => e.status === 'paused').length;
  const totalDossiersToday = scopedEmployees.reduce((s, e) => s + e.dossiersToday, 0);
  const employeesWithTarget = scopedEmployees.filter(
    (e) => typeof e.dailyTargetDossiers === 'number' && e.dailyTargetDossiers > 0
  );
  const totalTargetToday = employeesWithTarget.reduce(
    (s, e) => s + (e.dailyTargetDossiers ?? 0),
    0
  );
  const targetSubtext =
    employeesWithTarget.length > 0 ? `Objectif : ${totalTargetToday}` : 'Objectif : Non défini';

  const kpis = isSupervisor
    ? [
        {
          label: 'Équipe en service',
          value: `${presentCount} / ${scopedEmployees.length}`,
          subtext: `${pausedCount} en pause`,
          accent: 'default' as const,
        },
        {
          label: 'Dossiers traités (équipe)',
          value: totalDossiersToday,
          subtext: targetSubtext,
          accent: 'primary' as const,
        },
        {
          label: 'Contrôles en attente',
          value: scopedQc.filter((q) => q.status === 'en_attente').length,
          subtext: `${pendingCorrectionsCount} demande(s) de correction`,
          accent: 'amber' as const,
        },
        {
          label: 'Conformité qualité',
          value: qualityRate !== null ? `${qualityRate}%` : '—',
          subtext: `${controlledQc.length} contrôlé(s)`,
          accent: 'emerald' as const,
        },
      ]
    : isManager
    ? [
        {
          label: 'Collaborateurs suivis',
          value: scopedEmployees.length,
          subtext: `${presentCount} présents · ${teams.length} équipes`,
          accent: 'default' as const,
        },
        {
          label: 'Dossiers du jour',
          value: totalDossiersToday,
          subtext: targetSubtext,
          accent: 'primary' as const,
        },
        {
          label: 'Sociétés actives',
          value: companies.filter((c) => !c.archived).length,
          subtext: `${scopedQc.filter((q) => q.status === 'en_attente').length} contrôles en attente`,
          accent: 'amber' as const,
        },
        {
          label: 'Conformité qualité',
          value: qualityRate !== null ? `${qualityRate}%` : '—',
          subtext: `${controlledQc.length} dossier(s) contrôlé(s)`,
          accent: 'emerald' as const,
        },
      ]
    : [
        {
          label: 'Comptes actifs',
          value: activeAccountsCount,
          subtext: `${scopedEmployees.length} employé(s) · ${teams.length} équipe(s)`,
          accent: 'default' as const,
        },
        {
          label: 'Présents en service',
          value: presentCount,
          subtext: `${pausedCount} en pause`,
          accent: 'emerald' as const,
        },
        {
          label: 'Sociétés actives',
          value: companies.filter((c) => !c.archived).length,
          subtext: `${scopedQc.length} dossier(s) en file qualité`,
          accent: 'primary' as const,
        },
        {
          label: 'Conformité qualité',
          value: qualityRate !== null ? `${qualityRate}%` : '—',
          subtext: `${controlledQc.length} contrôlé(s)`,
          accent: 'default' as const,
        },
      ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`${ROLE_LABELS[user.role]} — ${user.fullName}`}
        meta={`${formatDateLongFr(new Date())} · ${user.perimeterName}`}
        action={
          <button
            type="button"
            onClick={() => onNavigate(isSupervisor ? 'mgmt_quality' : 'mgmt_objectives')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{isSupervisor ? 'Contrôle qualité' : 'Statistiques'}</span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        }
      />

      <section aria-label="Indicateurs" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <StatTile
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            subtext={kpi.subtext}
            accent={kpi.accent}
          />
        ))}
      </section>

      {pendingOutings.length > 0 && (
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Sorties à approuver ({pendingOutings.length})
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('mgmt_schedules')}
              className="text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer"
            >
              Tout afficher
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#393342]">
            {pendingOutings.map((req) => (
              <div
                key={req.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-white text-sm">
                    {req.employeeName} ·{' '}
                    <span className="text-[#7624A8] dark:text-[#D896FF]">
                      {OUTING_REASON_CONFIG[req.reason].label}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-[#C8C2D0]">
                    {req.plannedWindow} · {formatTimeShort(req.requestedAt)} — {req.details}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onReviewOutingRequest(req.id, 'approuvee')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Approuver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onReviewOutingRequest(req.id, 'refusee')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 text-xs font-semibold rounded-lg cursor-pointer"
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Équipes</h2>
            {!isSupervisor && (
              <button
                type="button"
                onClick={() => onNavigate('mgmt_teams')}
                className="text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer"
              >
                Gérer
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                  <th className="py-3 px-5">Équipe</th>
                  <th className="py-3 px-4 text-right">Présents</th>
                  <th className="py-3 px-4 text-right">Productivité</th>
                  <th className="py-3 px-5 text-right">Qualité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
                {scopedTeams.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 px-5 text-center text-xs text-slate-500 dark:text-[#C8C2D0]"
                    >
                      Aucune équipe configurée pour le moment.
                    </td>
                  </tr>
                ) : (
                  scopedTeams.map((team) => {
                    const members = employees.filter(
                      (e) => e.teamId === team.id && e.accountStatus === 'actif'
                    );
                    const active = members.filter((m) => m.status !== 'absent').length;
                    const comp = companies.find((c) => c.id === team.defaultCompanyId);
                    return (
                      <tr key={team.id} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                        <td className="py-3 px-5">
                          <div className="font-medium text-slate-900 dark:text-white">{team.name}</div>
                          <div className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5">
                            {comp?.name ?? team.site} · {team.supervisorName}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-800 dark:text-white whitespace-nowrap">
                          {active} / {members.length}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] whitespace-nowrap">
                          {team.productivityRate}%
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {team.qualityScore}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Contrôles qualité récents
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('mgmt_quality')}
              className="text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer"
            >
              Ouvrir
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#393342]">
            {scopedQc.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
                Aucun dossier en file qualité.
              </div>
            ) : (
              scopedQc.slice(0, 4).map((qc) => (
                <div key={qc.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {qc.employeeName} · <span className="font-mono text-xs">{qc.dossierRef}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#C8C2D0] truncate mt-0.5">
                      {qc.companyName} · {qc.taskName}
                    </div>
                  </div>
                  <QualityControlStatusText status={qc.status} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Collaborateurs</h2>
          <button
            type="button"
            onClick={() => onNavigate('mgmt_employees')}
            className="text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer"
          >
            Tout afficher
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                <th className="py-3 px-5">Collaborateur</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Présence</th>
                <th className="py-3 px-4 text-right">Productif</th>
                <th className="py-3 px-4 text-right">Pauses</th>
                <th className="py-3 px-5 text-right">Dossiers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
              {scopedEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 px-5 text-center text-xs text-slate-500 dark:text-[#C8C2D0]"
                  >
                    Aucun employé enregistré. Créez un compte employé depuis le module Utilisateurs.
                  </td>
                </tr>
              ) : (
                scopedEmployees.slice(0, 6).map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                    <td className="py-3 px-5">
                      <div className="font-medium text-slate-900 dark:text-white">{emp.fullName}</div>
                      <div className="text-xs font-mono text-slate-500 dark:text-[#C8C2D0]">
                        {emp.matricule}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <ServiceStatusDisplay status={emp.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-800 dark:text-white whitespace-nowrap">
                      {formatDurationHM(emp.presenceSecondsToday)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] whitespace-nowrap">
                      {formatDurationHM(emp.productiveSecondsToday)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {formatDurationHM(emp.pauseSecondsToday)}
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {emp.dossiersToday}
                      {typeof emp.dailyTargetDossiers === 'number' && emp.dailyTargetDossiers > 0
                        ? ` / ${emp.dailyTargetDossiers}`
                        : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
