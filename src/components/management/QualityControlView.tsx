import React, { useMemo, useState } from 'react';
import { Plus, Settings2, X } from 'lucide-react';
import {
  CompanyRecord,
  CriterionRating,
  AppUser,
  ManagedEmployee,
  ProjectRecord,
  QualityControlRecord,
  QualityCriterionConfig,
  QualityCriterionResult,
  QualityStatus,
} from '../../core/types';
import { storageService } from '../../services/storageService';
import { formatDateTimeFr, formatDurationHM } from '../../utils/formatters';
import {
  QUALITY_STATUS_LABELS,
  QualityControlStatusText,
  SectionHeader,
  StatTile,
} from '../ui/DataPrimitives';

interface QualityControlViewProps {
  user: AppUser;
  qualityControls: QualityControlRecord[];
  qualityCriteria: QualityCriterionConfig[];
  companies: CompanyRecord[];
  projects: ProjectRecord[];
  employees: ManagedEmployee[];
  onEvaluateQc: (
    qcId: string,
    payload: {
      status: QualityStatus;
      criteriaResults: QualityCriterionResult[];
      observations: string;
    }
  ) => void | { error?: string };
  onAddCriterion: (label: string) => void;
  onToggleCriterion: (id: string, active: boolean) => void;
}

export function QualityControlView({
  user,
  qualityControls,
  qualityCriteria,
  companies,
  projects,
  employees,
  onEvaluateQc,
  onAddCriterion,
  onToggleCriterion,
}: QualityControlViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | QualityStatus>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [selectedQc, setSelectedQc] = useState<QualityControlRecord | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCriteriaConfig, setShowCriteriaConfig] = useState(false);
  const [newCriterionLabel, setNewCriterionLabel] = useState('');

  // Etat du formulaire de contrôle qualité
  const [evalStatus, setEvalStatus] = useState<Exclude<QualityStatus, 'en_attente'>>('valide');
  const [evalObservations, setEvalObservations] = useState('');
  const [evalRatings, setEvalRatings] = useState<Record<string, CriterionRating>>({});

  const isSupervisor = user.role === 'supervisor';
  const canConfigureCriteria = user.role === 'manager' || user.role === 'admin';

  const visibleProjects = useMemo(
    () => (isSupervisor ? projects.filter((p) => p.active) : projects),
    [projects, isSupervisor]
  );

  const authorizedProjectIdSet = useMemo(
    () => new Set(visibleProjects.map((p) => p.id)),
    [visibleProjects]
  );

  const effectiveProjectFilter = useMemo(() => {
    if (projectFilter === 'all') return 'all';
    if (isSupervisor) {
      return authorizedProjectIdSet.has(projectFilter) ? projectFilter : 'all';
    }
    return projectFilter;
  }, [projectFilter, isSupervisor, authorizedProjectIdSet]);

  const authorizedControls = useMemo(
    () =>
      isSupervisor
        ? qualityControls.filter(
            (q) => Boolean(q.projectId) && authorizedProjectIdSet.has(q.projectId!)
          )
        : qualityControls,
    [qualityControls, isSupervisor, authorizedProjectIdSet]
  );

  const employeeOptions = useMemo(() => {
    if (!isSupervisor) return employees;
    const qcEmployeeIds = new Set(authorizedControls.map((q) => q.employeeId));
    return employees.filter(
      (emp) =>
        qcEmployeeIds.has(emp.id) ||
        visibleProjects.some((p) => storageService.isEmployeeAssignedToProject(emp, p))
    );
  }, [employees, isSupervisor, authorizedControls, visibleProjects]);

  const companyOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    const scopedProjects =
      effectiveProjectFilter !== 'all' && effectiveProjectFilter !== 'none'
        ? visibleProjects.filter((p) => p.id === effectiveProjectFilter)
        : effectiveProjectFilter === 'none'
        ? []
        : visibleProjects;
    for (const p of scopedProjects) {
      for (const c of p.companies ?? []) {
        map.set(c.id, {
          id: c.id,
          label: effectiveProjectFilter === 'all' ? `${c.name} (${p.name})` : c.name,
        });
      }
    }
    for (const q of authorizedControls) {
      if (!q.companyId) continue;
      if (effectiveProjectFilter === 'none' && q.projectId) continue;
      if (
        effectiveProjectFilter !== 'all' &&
        effectiveProjectFilter !== 'none' &&
        q.projectId !== effectiveProjectFilter
      ) {
        continue;
      }
      if (!map.has(q.companyId)) {
        const baseName = q.companyName?.trim() || q.companyId;
        map.set(q.companyId, {
          id: q.companyId,
          label:
            effectiveProjectFilter === 'all' && q.projectName
              ? `${baseName} (${q.projectName})`
              : baseName,
        });
      }
    }
    if (!isSupervisor && (effectiveProjectFilter === 'all' || effectiveProjectFilter === 'none')) {
      for (const c of companies) {
        if (!map.has(c.id)) {
          map.set(c.id, { id: c.id, label: c.name });
        }
      }
    }
    return Array.from(map.values());
  }, [visibleProjects, authorizedControls, companies, effectiveProjectFilter, isSupervisor]);

  const taskOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    const scopedProjects =
      effectiveProjectFilter !== 'all' && effectiveProjectFilter !== 'none'
        ? visibleProjects.filter((p) => p.id === effectiveProjectFilter)
        : effectiveProjectFilter === 'none'
        ? []
        : visibleProjects;
    for (const p of scopedProjects) {
      for (const t of p.tasks ?? []) {
        map.set(t.id, {
          id: t.id,
          label: effectiveProjectFilter === 'all' ? `${t.name} (${p.name})` : t.name,
        });
      }
    }
    for (const q of authorizedControls) {
      if (!q.taskId) continue;
      if (effectiveProjectFilter === 'none' && q.projectId) continue;
      if (
        effectiveProjectFilter !== 'all' &&
        effectiveProjectFilter !== 'none' &&
        q.projectId !== effectiveProjectFilter
      ) {
        continue;
      }
      if (!map.has(q.taskId)) {
        const baseName = q.taskName?.trim() || q.taskId;
        map.set(q.taskId, {
          id: q.taskId,
          label:
            effectiveProjectFilter === 'all' && q.projectName
              ? `${baseName} (${q.projectName})`
              : baseName,
        });
      }
    }
    return Array.from(map.values());
  }, [visibleProjects, authorizedControls, effectiveProjectFilter]);

  const scopedControls = useMemo(() => {
    return authorizedControls.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (effectiveProjectFilter === 'none' && q.projectId) return false;
      if (
        effectiveProjectFilter !== 'all' &&
        effectiveProjectFilter !== 'none' &&
        q.projectId !== effectiveProjectFilter
      ) {
        return false;
      }
      if (companyFilter !== 'all' && q.companyId !== companyFilter) return false;
      if (taskFilter !== 'all' && q.taskId !== taskFilter) return false;
      if (employeeFilter !== 'all' && q.employeeId !== employeeFilter) return false;
      return true;
    });
  }, [
    authorizedControls,
    statusFilter,
    effectiveProjectFilter,
    companyFilter,
    taskFilter,
    employeeFilter,
  ]);

  // RÈGLE STRICTE : Les dossiers non contrôlés ('en_attente') ne sont JAMAIS comptabilisés comme conformes
  const metrics = useMemo(() => {
    const scopeAll = authorizedControls;
    const pending = scopeAll.filter((q) => q.status === 'en_attente').length;
    const controlled = scopeAll.filter((q) => q.status !== 'en_attente');
    const compliant = controlled.filter(
      (q) => q.status === 'valide' || q.status === 'valide_observation'
    ).length;
    const toFix = controlled.filter((q) => q.status === 'a_corriger').length;
    const rejected = controlled.filter((q) => q.status === 'rejete').length;
    const complianceRate =
      controlled.length > 0 ? Math.round((compliant / controlled.length) * 100) : null;
    return { pending, controlledCount: controlled.length, complianceRate, toFix, rejected };
  }, [authorizedControls]);

  const openInspection = (qc: QualityControlRecord) => {
    setActionError(null);
    const accessCheck = storageService.getQualityControlByIdForUser(qc.id, user);
    if (accessCheck.error || !accessCheck.record) {
      setActionError(
        accessCheck.error ?? 'Accès refusé : dossier hors de votre périmètre.'
      );
      return;
    }
    const authorizedQc = accessCheck.record;
    setSelectedQc(authorizedQc);
    setEvalStatus(
      authorizedQc.status !== 'en_attente' ? authorizedQc.status : 'valide'
    );
    setEvalObservations(authorizedQc.observations ?? '');
    const activeCriteria = qualityCriteria.filter((c) => c.active);
    const initialRatings: Record<string, CriterionRating> = {};
    for (const crit of activeCriteria) {
      const existing = authorizedQc.criteriaResults.find((r) => r.criterionId === crit.id);
      initialRatings[crit.id] = existing?.rating ?? 'conforme';
    }
    setEvalRatings(initialRatings);
  };

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQc) return;
    setActionError(null);
    const activeCriteria = qualityCriteria.filter((c) => c.active);
    const criteriaResults: QualityCriterionResult[] = activeCriteria.map((c) => ({
      criterionId: c.id,
      label: c.label,
      rating: evalRatings[c.id] ?? 'conforme',
    }));
    const res = onEvaluateQc(selectedQc.id, {
      status: evalStatus,
      criteriaResults,
      observations: evalObservations,
    });
    if (res && res.error) {
      setActionError(res.error);
      setSelectedQc(null);
      return;
    }
    setSelectedQc(null);
  };

  const handleAddCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriterionLabel.trim()) return;
    onAddCriterion(newCriterionLabel);
    setNewCriterionLabel('');
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Contrôle qualité"
        action={
          canConfigureCriteria ? (
            <button
              type="button"
              onClick={() => setShowCriteriaConfig((v) => !v)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-[#292631] border border-slate-300 dark:border-[#393342] hover:border-[#A83CE2] text-slate-700 dark:text-white hover:text-[#7624A8] dark:hover:text-[#D896FF] text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Settings2 className="w-4 h-4" aria-hidden="true" />
              <span>Critères ({qualityCriteria.filter((c) => c.active).length})</span>
            </button>
          ) : undefined
        }
      />

      {actionError && (
        <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-700 dark:text-red-300 hover:opacity-75 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="En attente de contrôle" value={metrics.pending} accent="amber" />
        <StatTile label="Dossiers contrôlés" value={metrics.controlledCount} />
        <StatTile
          label="Taux de conformité"
          value={metrics.complianceRate !== null ? `${metrics.complianceRate}%` : '—'}
          subtext="Calculé uniquement sur les dossiers contrôlés"
          accent="emerald"
        />
        <StatTile
          label="À corriger / Rejetés"
          value={`${metrics.toFix} / ${metrics.rejected}`}
          accent="red"
        />
      </div>

      {showCriteriaConfig && canConfigureCriteria && (
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Critères d’évaluation qualité
            </h2>
            <button
              type="button"
              onClick={() => setShowCriteriaConfig(false)}
              className="text-xs text-slate-500 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Fermer
            </button>
          </div>
          <form onSubmit={handleAddCriterion} className="flex gap-2">
            <input
              type="text"
              value={newCriterionLabel}
              onChange={(e) => setNewCriterionLabel(e.target.value)}
              placeholder="Nouveau critère..."
              className="flex-1 px-3 py-2 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/60 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3.5 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ajouter</span>
            </button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {qualityCriteria.map((c) => (
              <label
                key={c.id}
                className="flex items-center justify-between p-2.5 bg-white dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg cursor-pointer"
              >
                <span
                  className={
                    c.active
                      ? 'text-slate-900 dark:text-white font-medium'
                      : 'text-slate-400 dark:text-[#C8C2D0]/50'
                  }
                >
                  {c.label}
                </span>
                <input
                  type="checkbox"
                  checked={c.active}
                  onChange={(e) => onToggleCriterion(c.id, e.target.checked)}
                  className="w-4 h-4 accent-[#A83CE2]"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Filtres */}
      <div className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | QualityStatus)}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
        >
          <option value="all">Tous les statuts</option>
          {(Object.keys(QUALITY_STATUS_LABELS) as QualityStatus[]).map((st) => (
            <option key={st} value={st}>
              {QUALITY_STATUS_LABELS[st]}
            </option>
          ))}
        </select>

        <select
          value={effectiveProjectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value);
            setCompanyFilter('all');
            setTaskFilter('all');
          }}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
        >
          <option value="all">Tous les projets</option>
          {!isSupervisor && <option value="none">Sans projet (historique)</option>}
          {visibleProjects.map((p) => (
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
          <option value="all">Toutes les sociétés</option>
          {companyOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
        >
          <option value="all">Toutes les tâches</option>
          {taskOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
        >
          <option value="all">Tous les employés</option>
          {employeeOptions.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.fullName}
              {emp.accountStatus !== 'actif' ? ' (Désactivé)' : ''}
            </option>
          ))}
        </select>
      </div>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                <th className="py-3 px-5">Dossier</th>
                <th className="py-3 px-4">Employé</th>
                <th className="py-3 px-4">Société & Tâche</th>
                <th className="py-3 px-4">Durée</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Contrôleur</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
              {scopedControls.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 px-5 text-center text-xs text-slate-500 dark:text-[#C8C2D0]"
                  >
                    Aucun dossier à contrôler pour cette sélection.
                  </td>
                </tr>
              ) : (
                scopedControls.map((qc) => (
                  <tr key={qc.id} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                    <td className="py-3 px-5">
                      <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {qc.dossierRef ||
                          (qc.projectName ? `v${qc.formVersionNumber ?? 1}` : '—')}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-[#C8C2D0]/70">
                        {formatDateTimeFr(qc.treatedAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800 dark:text-white">
                      {qc.employeeName}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {qc.projectName && (
                        <div className="font-semibold text-[#7624A8] dark:text-[#D896FF]">
                          {qc.projectName}
                          {qc.formVersionNumber ? ` · v${qc.formVersionNumber}` : ''}
                        </div>
                      )}
                      {qc.companyName && (
                        <div className="font-medium text-slate-900 dark:text-white">
                          {qc.companyName}
                        </div>
                      )}
                      {qc.taskName && (
                        <div className="text-slate-500 dark:text-[#C8C2D0]">{qc.taskName}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-[#C8C2D0] whitespace-nowrap">
                      {formatDurationHM(qc.durationSeconds)}
                    </td>
                    <td className="py-3 px-4">
                      <QualityControlStatusText status={qc.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0]">
                      {qc.controllerName ? (
                        <div>
                          <div>{qc.controllerName}</div>
                          <div className="text-[11px] text-slate-400 dark:text-[#C8C2D0]/70">
                            {formatDateTimeFr(qc.controlledAt)}
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openInspection(qc)}
                        className="px-3 py-1.5 bg-[#F7EEFC] dark:bg-[#A83CE2]/20 hover:bg-[#A83CE2] text-[#7624A8] dark:text-[#D896FF] hover:text-white dark:hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        {qc.status === 'en_attente' ? 'Contrôler' : 'Réviser'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal d'évaluation qualité */}
      {selectedQc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setSelectedQc(null)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleSaveEvaluation}
            className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-xl z-10 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#393342] pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Contrôle dossier
                  {selectedQc.dossierRef ? (
                    <>
                      {' '}
                      · <span className="font-mono">{selectedQc.dossierRef}</span>
                    </>
                  ) : selectedQc.projectName ? (
                    <> · {selectedQc.projectName}</>
                  ) : null}
                </h3>
                <div className="text-xs text-slate-600 dark:text-[#C8C2D0] mt-0.5">
                  {[
                    selectedQc.employeeName,
                    selectedQc.companyName,
                    selectedQc.taskName,
                  ]
                    .filter(Boolean)
                    .join(' · ')}{' '}
                  ({formatDurationHM(selectedQc.durationSeconds)})
                  {selectedQc.projectName
                    ? ` · ${selectedQc.projectName} (v${selectedQc.formVersionNumber ?? 1})`
                    : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQc(null)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedQc.formFieldsSnapshot && selectedQc.formFieldsSnapshot.length > 0 && (
              <div className="bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-3.5 space-y-2 text-xs">
                <div className="font-semibold text-[#7624A8] dark:text-[#D896FF]">
                  Données du formulaire spécifique ({selectedQc.projectName} · v
                  {selectedQc.formVersionNumber ?? 1})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedQc.formFieldsSnapshot
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((field) => {
                      const val = selectedQc.customResponses?.[field.id];
                      const formatted = Array.isArray(val)
                        ? val.length > 0
                          ? val.join(', ')
                          : '—'
                        : val && String(val).trim() !== ''
                        ? String(val)
                        : '—';
                      return (
                        <div key={field.id} className="space-y-0.5">
                          <div className="text-slate-500 dark:text-[#C8C2D0]">{field.label}</div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {formatted}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-[#C8C2D0]">
                Critères d’évaluation
              </div>
              {qualityCriteria
                .filter((c) => c.active)
                .map((crit) => (
                  <div
                    key={crit.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg text-xs"
                  >
                    <span className="font-medium text-slate-800 dark:text-white">{crit.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(
                        [
                          { id: 'conforme', label: 'Conforme' },
                          { id: 'non_conforme', label: 'Non conforme' },
                          { id: 'non_applicable', label: 'Non applicable' },
                        ] as const
                      ).map((opt) => {
                        const active = evalRatings[crit.id] === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setEvalRatings((prev) => ({ ...prev, [crit.id]: opt.id }))
                            }
                            className={`px-2.5 py-1 rounded font-medium border cursor-pointer transition-colors ${
                              active
                                ? opt.id === 'conforme'
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : opt.id === 'non_conforme'
                                  ? 'bg-red-700 text-white border-red-700'
                                  : 'bg-slate-700 dark:bg-[#393342] text-white border-slate-700 dark:border-[#393342]'
                                : 'bg-white dark:bg-[#292631] text-slate-600 dark:text-[#C8C2D0] border-slate-300 dark:border-[#393342] hover:bg-slate-100 dark:hover:bg-[#17151C]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#C8C2D0] mb-1.5">
                Décision qualité
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'valide', label: 'Validé' },
                    { id: 'valide_observation', label: 'Validé avec observation' },
                    { id: 'a_corriger', label: 'À corriger' },
                    { id: 'rejete', label: 'Rejeté' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setEvalStatus(st.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border cursor-pointer text-center ${
                      evalStatus === st.id
                        ? 'border-[#A83CE2] bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF]'
                        : 'border-slate-300 dark:border-[#393342] bg-white dark:bg-[#211E27] text-slate-700 dark:text-[#C8C2D0] hover:bg-slate-50 dark:hover:bg-[#17151C]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="qc-obs"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Observations / commentaires
              </label>
              <textarea
                id="qc-obs"
                rows={3}
                value={evalObservations}
                onChange={(e) => setEvalObservations(e.target.value)}
                placeholder="Commentaires destinés au collaborateur et au suivi qualité..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/60 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#393342]">
              <button
                type="button"
                onClick={() => setSelectedQc(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Enregistrer le contrôle
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
