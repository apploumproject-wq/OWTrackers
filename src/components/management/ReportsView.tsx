import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import {
  CompanyRecord,
  AppUser,
  ManagedEmployee,
  QualityControlRecord,
  TaskRecord,
  TeamRecord,
} from '../../core/types';
import {
  downloadCsv,
  downloadExcel,
  downloadPdfReport,
  formatDurationHM,
  isSameDayYmd,
  isSameMonth,
  isSameQuarter,
  isSameYear,
  isWithinDateRange,
  isWithinDays,
  toYmd,
} from '../../utils/formatters';
import { QUALITY_STATUS_LABELS, SectionHeader } from '../ui/DataPrimitives';

interface ReportsViewProps {
  user: AppUser;
  employees: ManagedEmployee[];
  teams: TeamRecord[];
  companies: CompanyRecord[];
  tasks: TaskRecord[];
  qualityControls: QualityControlRecord[];
}

export function ReportsView({
  user,
  employees,
  teams,
  companies,
  tasks,
  qualityControls,
}: ReportsViewProps) {
  const isSupervisor = user.role === 'supervisor';
  const [period, setPeriod] = useState<
    'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee' | 'personnalisee'
  >('mois');
  const [startYmd, setStartYmd] = useState('');
  const [endYmd, setEndYmd] = useState('');
  const [teamFilter, setTeamFilter] = useState(isSupervisor && user.teamId ? user.teamId : 'all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const now = useMemo(() => new Date(), []);
  const todayYmd = toYmd(now);

  const filteredRows = useMemo(() => {
    return qualityControls.filter((q) => {
      if (isSupervisor && user.teamId && q.teamId !== user.teamId) return false;
      if (teamFilter !== 'all' && q.teamId !== teamFilter) return false;
      if (companyFilter !== 'all' && q.companyId !== companyFilter) return false;
      if (taskFilter !== 'all' && q.taskId !== taskFilter) return false;
      if (employeeFilter !== 'all' && q.employeeId !== employeeFilter) return false;

      if (period === 'jour') return isSameDayYmd(q.treatedAt, todayYmd);
      if (period === 'semaine') return isWithinDays(q.treatedAt, now, 7);
      if (period === 'mois') return isSameMonth(q.treatedAt, now.getFullYear(), now.getMonth());
      if (period === 'trimestre')
        return isSameQuarter(q.treatedAt, now.getFullYear(), now.getMonth());
      if (period === 'annee') return isSameYear(q.treatedAt, now.getFullYear());
      return isWithinDateRange(q.treatedAt, startYmd, endYmd);
    });
  }, [
    qualityControls,
    isSupervisor,
    user.teamId,
    teamFilter,
    companyFilter,
    taskFilter,
    employeeFilter,
    period,
    todayYmd,
    now,
    startYmd,
    endYmd,
  ]);

  const exportHeaders = [
    'Dossier',
    'Collaborateur',
    'Equipe',
    'Societe',
    'Tache',
    'Duree',
    'Statut qualite',
    'Controleur',
  ];

  const exportMatrix: (string | number)[][] = useMemo(
    () =>
      filteredRows.map((q) => [
        q.dossierRef,
        q.employeeName,
        teams.find((t) => t.id === q.teamId)?.name ?? q.teamId,
        q.companyName,
        q.taskName,
        formatDurationHM(q.durationSeconds),
        QUALITY_STATUS_LABELS[q.status],
        q.controllerName ?? 'Non controle',
      ]),
    [filteredRows, teams]
  );

  const stamp = toYmd(now);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Rapports"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadExcel(`owtrackers-rapport-${stamp}.xls`, 'Rapport OWTrackers', exportHeaders, exportMatrix)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadCsv(`owtrackers-rapport-${stamp}.csv`, exportHeaders, exportMatrix)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-[#292631] border border-slate-300 dark:border-[#393342] hover:border-[#A83CE2] text-slate-700 dark:text-white hover:text-[#7624A8] dark:hover:text-[#D896FF] text-xs font-semibold rounded-lg cursor-pointer"
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadPdfReport(
                  `owtrackers-rapport-${stamp}.pdf`,
                  'OWTrackers - Rapport d activite et qualite',
                  `Genere par ${user.fullName} le ${stamp} (${filteredRows.length} dossiers)`,
                  exportHeaders,
                  exportMatrix
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-[#292631] border border-slate-300 dark:border-[#393342] hover:border-[#A83CE2] text-slate-700 dark:text-white hover:text-[#7624A8] dark:hover:text-[#D896FF] text-xs font-semibold rounded-lg cursor-pointer"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>PDF</span>
            </button>
          </div>
        }
      />

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
          >
            <option value="jour">Jour</option>
            <option value="semaine">Semaine</option>
            <option value="mois">Mois</option>
            <option value="trimestre">Trimestre</option>
            <option value="annee">Année</option>
            <option value="personnalisee">Personnalisée</option>
          </select>

          {!isSupervisor && (
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
            >
              <option value="all">Toutes équipes</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
          >
            <option value="all">Toutes sociétés</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
          >
            <option value="all">Toutes tâches</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
          >
            <option value="all">Tous employés</option>
            {employees
              .filter((e) => !isSupervisor || e.teamId === user.teamId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
          </select>
        </div>

        {period === 'personnalisee' && (
          <div className="flex flex-wrap gap-3 text-xs">
            <input
              type="date"
              value={startYmd}
              onChange={(e) => setStartYmd(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
            />
            <input
              type="date"
              value={endYmd}
              onChange={(e) => setEndYmd(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
            />
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-900 dark:text-white">
            Aperçu des données exportées ({filteredRows.length})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                {exportHeaders.map((h) => (
                  <th key={h} className="py-3 px-4 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-xs">
              {exportMatrix.length === 0 ? (
                <tr>
                  <td
                    colSpan={exportHeaders.length}
                    className="py-8 px-4 text-center text-slate-500 dark:text-[#C8C2D0]"
                  >
                    Aucune donnée disponible pour cette période.
                  </td>
                </tr>
              ) : (
                exportMatrix.map((row, i) => (
                  <tr key={i} className="hover:bg-[#F7EEFC]/30 dark:hover:bg-[#211E27]/70">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={`py-2.5 px-4 whitespace-nowrap ${
                          j === 0
                            ? 'font-mono font-semibold text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-[#C8C2D0]'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
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
