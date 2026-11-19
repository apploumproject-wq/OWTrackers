import React, { useMemo, useState } from 'react';
import { Plus, Settings2, X } from 'lucide-react';
import {
  CompanyRecord,
  CriterionRating,
  AppUser,
  ManagedEmployee,
  QualityControlRecord,
  QualityCriterionConfig,
  QualityCriterionResult,
  QualityStatus,
} from '../../core/types';
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
  employees: ManagedEmployee[];
  onEvaluateQc: (
    qcId: string,
    payload: {
      status: QualityStatus;
      criteriaResults: QualityCriterionResult[];
      observations: string;
    }
  ) => void;
  onAddCriterion: (label: string) => void;
  onToggleCriterion: (id: string, active: boolean) => void;
}

export function QualityControlView({
  user,
  qualityControls,
  qualityCriteria,
  companies,
  employees,
  onEvaluateQc,
  onAddCriterion,
  onToggleCriterion,
}: QualityControlViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | QualityStatus>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [selectedQc, setSelectedQc] = useState<QualityControlRecord | null>(null);
  const [showCriteriaConfig, setShowCriteriaConfig] = useState(false);
  const [newCriterionLabel, setNewCriterionLabel] = useState('');

  // Etat du formulaire de contrôle qualité
  const [evalStatus, setEvalStatus] = useState<Exclude<QualityStatus, 'en_attente'>>('valide');
  const [evalObservations, setEvalObservations] = useState('');
  const [evalRatings, setEvalRatings] = useState<Record<string, CriterionRating>>({});

  const isSupervisor = user.role === 'supervisor';
  const canConfigureCriteria = user.role === 'manager' || user.role === 'admin';

  const scopedControls = useMemo(() => {
    const base =
      isSupervisor && user.teamId
        ? qualityControls.filter((q) => q.teamId === user.teamId)
        : qualityControls;
    return base.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (companyFilter !== 'all' && q.companyId !== companyFilter) return false;
      if (employeeFilter !== 'all' && q.employeeId !== employeeFilter) return false;
      return true;
    });
  }, [qualityControls, isSupervisor, user.teamId, statusFilter, companyFilter, employeeFilter]);

  // RÈGLE STRICTE : Les dossiers non contrôlés ('en_attente') ne sont JAMAIS comptabilisés comme conformes
  const metrics = useMemo(() => {
    const scopeAll =
      isSupervisor && user.teamId
        ? qualityControls.filter((q) => q.teamId === user.teamId)
        : qualityControls;
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
  }, [qualityControls, isSupervisor, user.teamId]);

  const openInspection = (qc: QualityControlRecord) => {
    setSelectedQc(qc);
    setEvalStatus(
      qc.status !== 'en_attente' ? qc.status : 'valide'
    );
    setEvalObservations(qc.observations ?? '');
    const activeCriteria = qualityCriteria.filter((c) => c.active);
    const initialRatings: Record<string, CriterionRating> = {};
    for (const crit of activeCriteria) {
      const existing = qc.criteriaResults.find((r) => r.criterionId === crit.id);
      initialRatings[crit.id] = existing?.rating ?? 'conforme';
    }
    setEvalRatings(initialRatings);
  };

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQc) return;
    const activeCriteria = qualityCriteria.filter((c) => c.active);
    const criteriaResults: QualityCriterionResult[] = activeCriteria.map((c) => ({
      criterionId: c.id,
      label: c.label,
      rating: evalRatings[c.id] ?? 'conforme',
    }));
    onEvaluateQc(selectedQc.id, {
      status: evalStatus,
      criteriaResults,
      observations: evalObservations,
    });
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
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
        >
          <option value="all">Toutes les sociétés</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 dark:border-[#393342] rounded-lg bg-white dark:bg-[#211E27] text-slate-900 dark:text-white focus:outline-none focus:border-[#A83CE2]"
        >
          <option value="all">Tous les employés</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.fullName}
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
                        {qc.dossierRef}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-[#C8C2D0]/70">
                        {formatDateTimeFr(qc.treatedAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800 dark:text-white">
                      {qc.employeeName}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {qc.companyName}
                      </div>
                      <div className="text-slate-500 dark:text-[#C8C2D0]">{qc.taskName}</div>
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
                  Contrôle dossier · <span className="font-mono">{selectedQc.dossierRef}</span>
                </h3>
                <div className="text-xs text-slate-600 dark:text-[#C8C2D0] mt-0.5">
                  {selectedQc.employeeName} · {selectedQc.companyName} · {selectedQc.taskName} (
                  {formatDurationHM(selectedQc.durationSeconds)})
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
