import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import {
  CompanyRecord,
  AppUser,
  ManagedEmployee,
  ProjectRecord,
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
  projects: ProjectRecord[];
  qualityControls: QualityControlRecord[];
}

export function ReportsView({
  user,
  employees,
  teams,
  companies,
  tasks,
  projects,
  qualityControls,
}: ReportsViewProps) {
  const isSupervisor = user.role === 'supervisor';
  const [period, setPeriod] = useState<
    'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee' | 'personnalisee'
  >('mois');
  const [startYmd, setStartYmd] = useState('');
  const [endYmd, setEndYmd] = useState('');
  const [teamFilter, setTeamFilter] = useState(isSupervisor && user.teamId ? user.teamId : 'all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const now = useMemo(() => new Date(), []);
  const todayYmd = toYmd(now);

  const projectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; active: boolean }>();
    for (const p of projects) {
      map.set(p.id, { id: p.id, name: p.name, active: p.active });
    }
    for (const q of qualityControls) {
      if (q.projectId && !map.has(q.projectId)) {
        map.set(q.projectId, {
          id: q.projectId,
          name: q.projectName ?? q.projectId,
          active: false,
        });
      }
    }
    return Array.from(map.values());
  }, [projects, qualityControls]);

  const filteredRows = useMemo(() => {
    return qualityControls.filter((q) => {
      if (isSupervisor && user.teamId && q.teamId !== user.teamId) return false;
      if (teamFilter !== 'all' && q.teamId !== teamFilter) return false;
      if (projectFilter === 'none' && q.projectId) return false;
      if (projectFilter !== 'all' && projectFilter !== 'none' && q.projectId !== projectFilter)
        return false;
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
    projectFilter,
    companyFilter,
    taskFilter,
    employeeFilter,
    period,
    todayYmd,
    now,
    startYmd,
    endYmd,
  ]);

  // Colonnes spécifiques au projet sélectionné (jamais mélangées entre projets)
  const selectedProjectColumns = useMemo(() => {
    if (projectFilter === 'all' || projectFilter === 'none') return [];
    const byLabel = new Map<string, { label: string; fieldIds: Set<string> }>();
    const proj = projects.find((p) => p.id === projectFilter);
    if (proj) {
      for (const ver of proj.formVersions) {
        for (const f of ver.fields) {
          const norm = f.label.trim().toLowerCase();
          const ex = byLabel.get(norm);
          if (ex) ex.fieldIds.add(f.id);
          else byLabel.set(norm, { label: f.label.trim(), fieldIds: new Set([f.id]) });
        }
      }
    }
    for (const q of filteredRows) {
      for (const f of q.formFieldsSnapshot ?? []) {
        const norm = f.label.trim().toLowerCase();
        const ex = byLabel.get(norm);
        if (ex) ex.fieldIds.add(f.id);
        else byLabel.set(norm, { label: f.label.trim(), fieldIds: new Set([f.id]) });
      }
    }
    return Array.from(byLabel.values());
  }, [projectFilter, projects, filteredRows]);

  const exportHeaders = useMemo(
    () => [
      'Dossier',
      'Collaborateur',
      'Equipe',
      'Projet',
      'Version',
      'Societe',
      'Tache',
      'Duree',
      'Statut qualite',
      'Controleur',
      ...selectedProjectColumns.map((c) => c.label),
    ],
    [selectedProjectColumns]
  );

  const exportMatrix: (string | number)[][] = useMemo(
    () =>
      filteredRows.map((q) => {
        const base: (string | number)[] = [
          q.dossierRef || '—',
          q.employeeName,
          teams.find((t) => t.id === q.teamId)?.name ?? q.teamId,
          q.projectName ?? 'Sans projet',
          q.formVersionNumber ? `v${q.formVersionNumber}` : '—',
          q.companyName || '—',
          q.taskName || '—',
          formatDurationHM(q.durationSeconds),
          QUALITY_STATUS_LABELS[q.status],
          q.controllerName ?? 'Non controle',
        ];
        for (const col of selectedProjectColumns) {
          let cellVal = '—';
          if (q.customResponses) {
            for (const fid of col.fieldIds) {
              const raw = q.customResponses[fid];
              if (raw !== undefined) {
                cellVal = Array.isArray(raw)
                  ? raw.join(', ') || '—'
                  : String(raw).trim() || '—';
                break;
              }
            }
          }
          base.push(cellVal);
        }
        return base;
      }),
    [filteredRows, teams, selectedProjectColumns]
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
                downloadExcel(
                  `owtrackers-rapport-${stamp}.xls`,
                  'Rapport OWTrackers',
                  exportHeaders,
                  exportMatrix
                )
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
          >
            <option value="all">Tous projets</option>
            <option value="none">Sans projet (historique)</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {!p.active ? '(désactivé)' : ''}
              </option>
            ))}
          </select>

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
                  {e.accountStatus !== 'actif' ? ' (Désactivé)' : ''}
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
