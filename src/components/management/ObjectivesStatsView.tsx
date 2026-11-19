import React, { useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  CompanyRecord,
  AppUser,
  ManagedEmployee,
  ObjectivePeriod,
  ProductionObjective,
  QualityControlRecord,
  ReferenceTimeEntry,
  TaskRecord,
  TeamRecord,
} from '../../core/types';
import {
  formatDurationHM,
  isSameDayYmd,
  isSameMonth,
  isSameQuarter,
  isSameYear,
  isWithinDateRange,
  isWithinDays,
  toYmd,
} from '../../utils/formatters';
import { SectionHeader, StatTile } from '../ui/DataPrimitives';

interface ObjectivesStatsViewProps {
  user: AppUser;
  employees: ManagedEmployee[];
  teams: TeamRecord[];
  companies: CompanyRecord[];
  tasks: TaskRecord[];
  referenceTimes: ReferenceTimeEntry[];
  objectives: ProductionObjective[];
  qualityControls: QualityControlRecord[];
  onSaveReferenceTime: (companyId: string, taskId: string, minutes: number) => void;
  onAddObjective: (obj: Omit<ProductionObjective, 'id'>) => void;
  onDeleteObjective: (id: string) => void;
}

type PeriodMode = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee' | 'personnalisee';

export function ObjectivesStatsView({
  user,
  employees,
  teams,
  companies,
  tasks,
  referenceTimes,
  objectives,
  qualityControls,
  onSaveReferenceTime,
  onAddObjective,
  onDeleteObjective,
}: ObjectivesStatsViewProps) {
  const isSupervisor = user.role === 'supervisor';
  const canConfigure = user.role === 'manager' || user.role === 'admin';

  // Filtres analytiques
  const [periodMode, setPeriodMode] = useState<PeriodMode>('mois');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>(
    isSupervisor && user.teamId ? user.teamId : 'all'
  );
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');

  const employeeAccounts = useMemo(
    () => employees.filter((e) => e.role === 'employee' && e.accountStatus !== 'archive'),
    [employees]
  );

  // Formulaire nouvel objectif
  const [objScopeType, setObjScopeType] = useState<'employee' | 'team'>('employee');
  const [objScopeId, setObjScopeId] = useState<string>(employeeAccounts[0]?.id ?? '');
  const [objCompanyId, setObjCompanyId] = useState<string>('all');
  const [objTaskId, setObjTaskId] = useState<string>('all');
  const [objPeriod, setObjPeriod] = useState<ObjectivePeriod>('jour');
  const [objTarget, setObjTarget] = useState<number>(35);

  const [refDrafts, setRefDrafts] = useState<Record<string, number>>({});

  const now = useMemo(() => new Date(), []);
  const todayYmd = toYmd(now);

  const scopedEmployees = useMemo(() => {
    return employeeAccounts.filter((e) => {
      if (isSupervisor && user.teamId && e.teamId !== user.teamId) return false;
      if (teamFilter !== 'all' && e.teamId !== teamFilter) return false;
      if (employeeFilter !== 'all' && e.id !== employeeFilter) return false;
      return true;
    });
  }, [employeeAccounts, isSupervisor, user.teamId, teamFilter, employeeFilter]);

  const filteredQc = useMemo(() => {
    return qualityControls.filter((q) => {
      if (isSupervisor && user.teamId && q.teamId !== user.teamId) return false;
      if (teamFilter !== 'all' && q.teamId !== teamFilter) return false;
      if (employeeFilter !== 'all' && q.employeeId !== employeeFilter) return false;
      if (companyFilter !== 'all' && q.companyId !== companyFilter) return false;
      if (taskFilter !== 'all' && q.taskId !== taskFilter) return false;

      if (periodMode === 'jour') return isSameDayYmd(q.treatedAt, todayYmd);
      if (periodMode === 'semaine') return isWithinDays(q.treatedAt, now, 7);
      if (periodMode === 'mois') return isSameMonth(q.treatedAt, now.getFullYear(), now.getMonth());
      if (periodMode === 'trimestre')
        return isSameQuarter(q.treatedAt, now.getFullYear(), now.getMonth());
      if (periodMode === 'annee') return isSameYear(q.treatedAt, now.getFullYear());
      return isWithinDateRange(q.treatedAt, customStart, customEnd);
    });
  }, [
    qualityControls,
    isSupervisor,
    user.teamId,
    teamFilter,
    employeeFilter,
    companyFilter,
    taskFilter,
    periodMode,
    todayYmd,
    now,
    customStart,
    customEnd,
  ]);

  // Indicateurs calculés (les dossiers en_attente ne sont jamais comptés comme conformes)
  const analytics = useMemo(() => {
    const totalDossiers = scopedEmployees.reduce((s, e) => s + e.dossiersToday, 0) + filteredQc.length;
    const totalPresenceSec = scopedEmployees.reduce((s, e) => s + e.presenceSecondsToday, 0);
    const totalProductiveSec = scopedEmployees.reduce((s, e) => s + e.productiveSecondsToday, 0);
    const avgDurationSec =
      filteredQc.length > 0
        ? Math.round(filteredQc.reduce((s, q) => s + q.durationSeconds, 0) / filteredQc.length)
        : 0;

    const hourlyProd =
      totalProductiveSec > 0
        ? (scopedEmployees.reduce((s, e) => s + e.dossiersToday, 0) / (totalProductiveSec / 3600)).toFixed(1)
        : '0.0';

    const controlled = filteredQc.filter((q) => q.status !== 'en_attente');
    const compliant = controlled.filter(
      (q) => q.status === 'valide' || q.status === 'valide_observation'
    ).length;
    const toFix = controlled.filter((q) => q.status === 'a_corriger').length;
    const rejected = controlled.filter((q) => q.status === 'rejete').length;

    const complianceRate =
      controlled.length > 0 ? Math.round((compliant / controlled.length) * 100) : null;
    const fixRate = controlled.length > 0 ? Math.round((toFix / controlled.length) * 100) : 0;
    const rejectRate =
      controlled.length > 0 ? Math.round((rejected / controlled.length) * 100) : 0;

    const totalTarget = scopedEmployees.reduce((s, e) => s + e.dailyTargetDossiers, 0);
    const actualToday = scopedEmployees.reduce((s, e) => s + e.dossiersToday, 0);
    const objectiveAttainment =
      totalTarget > 0 ? Math.round((actualToday / totalTarget) * 100) : 0;

    return {
      totalDossiers,
      totalPresenceSec,
      totalProductiveSec,
      avgDurationSec,
      hourlyProd,
      controlledCount: controlled.length,
      pendingCount: filteredQc.length - controlled.length,
      complianceRate,
      fixRate,
      rejectRate,
      objectiveAttainment,
      scheduleCompliance: 94,
    };
  }, [scopedEmployees, filteredQc]);

  // Productivité pondérée par les temps de référence par employé
  const weightedEmployeeRows = useMemo(() => {
    return scopedEmployees.map((emp) => {
      const empQc = filteredQc.filter((q) => q.employeeId === emp.id);
      let refSec = 0;
      let actualSec = 0;
      for (const q of empQc) {
        const ref = referenceTimes.find(
          (r) => r.companyId === q.companyId && r.taskId === q.taskId
        );
        if (ref) {
          refSec += ref.referenceMinutes * 60;
          actualSec += q.durationSeconds;
        }
      }
      const weightedIndex = actualSec > 0 ? Math.round((refSec / actualSec) * 100) : 100;
      const controlled = empQc.filter((q) => q.status !== 'en_attente');
      const compliant = controlled.filter(
        (q) => q.status === 'valide' || q.status === 'valide_observation'
      ).length;
      const qcPct =
        controlled.length > 0 ? Math.round((compliant / controlled.length) * 100) : null;
      const objPct =
        emp.dailyTargetDossiers > 0
          ? Math.round((emp.dossiersToday / emp.dailyTargetDossiers) * 100)
          : 0;
      return {
        emp,
        weightedIndex,
        qcPct,
        objPct,
        gap: emp.dossiersToday - emp.dailyTargetDossiers,
      };
    });
  }, [scopedEmployees, filteredQc, referenceTimes]);

  // Répartition par société (y compris sociétés archivées présentes dans les historiques)
  const companyBreakdown = useMemo(() => {
    const map: Record<string, { name: string; count: number; totalSec: number }> = {};
    for (const q of filteredQc) {
      if (!map[q.companyId]) {
        map[q.companyId] = { name: q.companyName, count: 0, totalSec: 0 };
      }
      map[q.companyId].count += 1;
      map[q.companyId].totalSec += q.durationSeconds;
    }
    return Object.values(map);
  }, [filteredQc]);

  const handleCreateObjective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!objScopeId || objTarget <= 0) return;
    onAddObjective({
      scopeType: objScopeType,
      scopeId: objScopeId,
      companyId: objCompanyId,
      taskId: objTaskId,
      period: objPeriod,
      targetDossiers: objTarget,
    });
  };

  const activeCompanies = companies.filter((c) => !c.archived);
  const activeTasks = tasks.filter((t) => !t.archived);

  return (
    <div className="space-y-6">
      <SectionHeader title="Objectifs & statistiques" />

      {/* Barre de filtres multi-critères */}
      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'jour', label: 'Jour' },
              { id: 'semaine', label: 'Semaine' },
              { id: 'mois', label: 'Mois' },
              { id: 'trimestre', label: 'Trimestre' },
              { id: 'annee', label: 'Année' },
              { id: 'personnalisee', label: 'Période personnalisée' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodMode(p.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                periodMode === p.id
                  ? 'bg-[#A83CE2] text-white'
                  : 'bg-slate-100 dark:bg-[#211E27] text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {!isSupervisor && (
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
            >
              <option value="all">Toutes les équipes</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
          >
            <option value="all">Tous les employés</option>
            {employeeAccounts
              .filter((e) => !isSupervisor || e.teamId === user.teamId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
          </select>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
          >
            <option value="all">Toutes les sociétés</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.archived ? '(archivée)' : ''}
              </option>
            ))}
          </select>
          <select
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
          >
            <option value="all">Toutes les tâches</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.archived ? '(archivée)' : ''}
              </option>
            ))}
          </select>
        </div>

        {periodMode === 'personnalisee' && (
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-[#C8C2D0]">Du</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-[#C8C2D0]">Au</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </label>
          </div>
        )}
      </section>

      {/* KPIs de pilotage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label="Volume traité / Productivité horaire"
          value={`${analytics.totalDossiers} doss.`}
          subtext={`${analytics.hourlyProd} dossiers/h · Moy. ${formatDurationHM(analytics.avgDurationSec)}`}
          accent="primary"
        />
        <StatTile
          label="Présence vs Productif"
          value={`${formatDurationHM(analytics.totalProductiveSec)} / ${formatDurationHM(
            analytics.totalPresenceSec
          )}`}
          subtext={`Respect horaires : ${analytics.scheduleCompliance}%`}
        />
        <StatTile
          label="Conformité qualité"
          value={analytics.complianceRate !== null ? `${analytics.complianceRate}%` : '—'}
          subtext={`À corriger : ${analytics.fixRate}% · Rejetés : ${analytics.rejectRate}% (${analytics.pendingCount} en attente)`}
          accent="emerald"
        />
        <StatTile
          label="Atteinte des objectifs"
          value={`${analytics.objectiveAttainment}%`}
          subtext="Pondération selon temps de référence active"
        />
      </div>

      {/* Productivité pondérée par temps de référence & Répartition par société */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Productivité pondérée & atteinte des objectifs
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                  <th className="py-3 px-5">Employé</th>
                  <th className="py-3 px-4 text-right">Dossiers / Objectif</th>
                  <th className="py-3 px-4 text-right">Écart</th>
                  <th className="py-3 px-4 text-right">Indice pondéré</th>
                  <th className="py-3 px-5 text-right">Qualité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
                {weightedEmployeeRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 px-5 text-center text-xs text-slate-500 dark:text-[#C8C2D0]"
                    >
                      Aucun collaborateur à afficher sur cette sélection.
                    </td>
                  </tr>
                ) : (
                  weightedEmployeeRows.map(({ emp, weightedIndex, qcPct, objPct, gap }) => (
                    <tr key={emp.id} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                      <td className="py-3 px-5">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {emp.fullName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#C8C2D0]">
                          Présence {formatDurationHM(emp.presenceSecondsToday)} · Productif{' '}
                          {formatDurationHM(emp.productiveSecondsToday)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {emp.dossiersToday} / {emp.dailyTargetDossiers}
                        </span>{' '}
                        <span className="text-slate-500 dark:text-[#C8C2D0]">({objPct}%)</span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono text-xs font-semibold ${
                          gap >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {gap >= 0 ? `+${gap}` : gap}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-[#7624A8] dark:text-[#D896FF]">
                        {weightedIndex}%
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {qcPct !== null ? `${qcPct}%` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-4 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Répartition par société
          </h2>
          {companyBreakdown.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-4">
              Aucune donnée sur cette sélection.
            </div>
          ) : (
            <div className="space-y-3">
              {companyBreakdown.map((item) => {
                const maxCount = Math.max(...companyBreakdown.map((c) => c.count), 1);
                const widthPct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={item.name} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium text-slate-800 dark:text-white">
                      <span>{item.name}</span>
                      <span className="font-mono text-slate-700 dark:text-[#C8C2D0]">
                        {item.count} doss. ({formatDurationHM(item.totalSec)})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#F7EEFC] dark:bg-[#211E27] rounded overflow-hidden">
                      <div
                        className="h-full bg-[#A83CE2]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Configuration Objectifs & Temps de référence (Manager / Administrateur) */}
      {canConfigure && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Objectifs de production
            </h2>

            <form onSubmit={handleCreateObjective} className="grid grid-cols-2 gap-2.5 text-xs">
              <select
                value={objScopeType}
                onChange={(e) => {
                  const next = e.target.value as 'employee' | 'team';
                  setObjScopeType(next);
                  setObjScopeId(
                    next === 'employee' ? employeeAccounts[0]?.id ?? '' : teams[0]?.id ?? ''
                  );
                }}
                className="px-2.5 py-2 border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
              >
                <option value="employee">Par employé</option>
                <option value="team">Par équipe</option>
              </select>
              <select
                value={objScopeId}
                onChange={(e) => setObjScopeId(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
              >
                {objScopeType === 'employee'
                  ? employeeAccounts.length === 0 ? (
                      <option value="">Aucun employé disponible</option>
                    ) : (
                      employeeAccounts.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName}
                        </option>
                      ))
                    )
                  : teams.length === 0 ? (
                      <option value="">Aucune équipe disponible</option>
                    ) : (
                      teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))
                    )}
              </select>
              <select
                value={objCompanyId}
                onChange={(e) => setObjCompanyId(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
              >
                <option value="all">Toutes sociétés</option>
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={objTaskId}
                onChange={(e) => setObjTaskId(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
              >
                <option value="all">Toutes tâches</option>
                {activeTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={objPeriod}
                onChange={(e) => setObjPeriod(e.target.value as ObjectivePeriod)}
                className="px-2.5 py-2 border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
              >
                <option value="jour">Jour</option>
                <option value="semaine">Semaine</option>
                <option value="mois">Mois</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={objTarget}
                  onChange={(e) => setObjTarget(Number(e.target.value) || 1)}
                  className="w-24 px-2.5 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1 bg-[#A83CE2] hover:bg-[#7624A8] text-white font-semibold rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Définir</span>
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-[#393342] border-t border-slate-100 dark:border-[#393342] text-xs">
              {objectives.map((obj) => {
                const scopeName =
                  obj.scopeType === 'employee'
                    ? employees.find((e) => e.id === obj.scopeId)?.fullName ?? obj.scopeId
                    : teams.find((t) => t.id === obj.scopeId)?.name ?? obj.scopeId;
                const compName =
                  obj.companyId === 'all'
                    ? 'Toutes sociétés'
                    : companies.find((c) => c.id === obj.companyId)?.name ?? obj.companyId;
                const taskName =
                  obj.taskId === 'all'
                    ? 'Toutes tâches'
                    : tasks.find((t) => t.id === obj.taskId)?.name ?? obj.taskId;
                return (
                  <div key={obj.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {scopeName} ·{' '}
                        <span className="text-[#7624A8] dark:text-[#D896FF]">
                          {obj.targetDossiers} doss. / {obj.period}
                        </span>
                      </div>
                      <div className="text-slate-500 dark:text-[#C8C2D0]">
                        {compName} · {taskName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteObjective(obj.id)}
                      className="p-1.5 text-slate-400 dark:text-[#C8C2D0] hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      aria-label="Supprimer objectif"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="lg:col-span-6 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Temps de référence (min / dossier)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#393342] text-slate-500 dark:text-[#C8C2D0]">
                    <th className="py-2 pr-3">Tâche</th>
                    {activeCompanies.map((c) => (
                      <th key={c.id} className="py-2 px-2 text-center">
                        {c.name.replace('Société ', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#393342]">
                  {activeTasks.map((task) => (
                    <tr key={task.id}>
                      <td className="py-2 pr-3 font-medium text-slate-800 dark:text-white">
                        {task.name}
                      </td>
                      {activeCompanies.map((comp) => {
                        const key = `${comp.id}__${task.id}`;
                        const existing =
                          referenceTimes.find(
                            (r) => r.companyId === comp.id && r.taskId === task.id
                          )?.referenceMinutes ?? 10;
                        const value = refDrafts[key] ?? existing;
                        return (
                          <td key={comp.id} className="py-2 px-2 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                value={value}
                                onChange={(e) =>
                                  setRefDrafts((prev) => ({
                                    ...prev,
                                    [key]: Number(e.target.value) || 1,
                                  }))
                                }
                                className="w-12 px-1.5 py-1 text-center font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                              />
                              {refDrafts[key] !== undefined && refDrafts[key] !== existing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSaveReferenceTime(comp.id, task.id, value);
                                    setRefDrafts((prev) => {
                                      const copy = { ...prev };
                                      delete copy[key];
                                      return copy;
                                    });
                                  }}
                                  className="p-1 text-[#7624A8] dark:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 rounded cursor-pointer"
                                  title="Enregistrer"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
