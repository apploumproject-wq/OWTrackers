import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  Check,
  Edit3,
  History,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { AppUser, LeaveRecord, ManagedEmployee } from '../../core/types';
import { ROLE_LABELS } from '../../core/permissions';
import { formatDateTimeFr, formatYmdFr, toYmd } from '../../utils/formatters';
import { SectionHeader } from '../ui/DataPrimitives';

interface LeavesManagementViewProps {
  user: AppUser;
  employees: ManagedEmployee[];
  manageableEmployees: ManagedEmployee[];
  leaves: LeaveRecord[];
  onCreateLeave: (input: {
    employeeId: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
  }) => { error?: string };
  onUpdateLeave: (
    leaveId: string,
    patch: {
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
    }
  ) => { error?: string };
  onCancelLeave: (leaveId: string, reason?: string) => { error?: string };
}

const ACTION_LABELS = {
  validation: 'Validation',
  modification: 'Modification',
  annulation: 'Annulation',
} as const;

export function LeavesManagementView({
  user,
  employees,
  manageableEmployees,
  leaves,
  onCreateLeave,
  onUpdateLeave,
  onCancelLeave,
}: LeavesManagementViewProps) {
  const todayYmd = toYmd(new Date());

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    () => manageableEmployees[0]?.id ?? ''
  );
  const [startDate, setStartDate] = useState<string>(todayYmd);
  const [endDate, setEndDate] = useState<string>(todayYmd);
  const [startTime, setStartTime] = useState<string>('08:30');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'valide' | 'annule' | 'all'>('valide');
  const [historyLeave, setHistoryLeave] = useState<LeaveRecord | null>(null);
  const [pendingCancelLeave, setPendingCancelLeave] = useState<LeaveRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const effectiveSelectedEmployeeId = useMemo(() => {
    if (editingLeaveId) {
      const lv = leaves.find((l) => l.id === editingLeaveId);
      if (lv) return lv.employeeId;
    }
    if (manageableEmployees.some((e) => e.id === selectedEmployeeId)) {
      return selectedEmployeeId;
    }
    return manageableEmployees[0]?.id ?? '';
  }, [editingLeaveId, leaves, manageableEmployees, selectedEmployeeId]);

  const selectedEmployee = useMemo(() => {
    return (
      employees.find((e) => e.id === effectiveSelectedEmployeeId) ??
      manageableEmployees.find((e) => e.id === effectiveSelectedEmployeeId) ??
      null
    );
  }, [employees, manageableEmployees, effectiveSelectedEmployeeId]);

  const resolveEmployeeInfo = (leave: LeaveRecord) => {
    const live = employees.find((e) => e.id === leave.employeeId);
    return {
      fullName: live?.fullName ?? leave.employeeNameSnapshot,
      matricule: live?.matricule?.trim() || leave.employeeMatriculeSnapshot || '—',
      role: live?.role,
    };
  };

  const filteredLeaves = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaves.filter((lv) => {
      if (statusFilter !== 'all' && lv.status !== statusFilter) return false;
      if (!q) return true;
      const info = resolveEmployeeInfo(lv);
      return (
        info.fullName.toLowerCase().includes(q) ||
        info.matricule.toLowerCase().includes(q) ||
        lv.startDate.includes(q) ||
        lv.endDate.includes(q)
      );
    });
  }, [leaves, statusFilter, search, employees]);

  const resetFormToCreate = () => {
    setEditingLeaveId(null);
    setStartDate(todayYmd);
    setEndDate(todayYmd);
    setStartTime('08:30');
    setEndTime('17:00');
    setFormError(null);
  };

  const startEditLeave = (leave: LeaveRecord) => {
    setEditingLeaveId(leave.id);
    setSelectedEmployeeId(leave.employeeId);
    setStartDate(leave.startDate);
    setEndDate(leave.endDate);
    setStartTime(leave.startTime);
    setEndTime(leave.endTime);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (editingLeaveId) {
      const res = onUpdateLeave(editingLeaveId, {
        startDate,
        endDate,
        startTime,
        endTime,
      });
      if (res.error) {
        setFormError(res.error);
        return;
      }
      setFormSuccess('Congé mis à jour et synchronisé avec le Planning.');
      resetFormToCreate();
      return;
    }

    if (!effectiveSelectedEmployeeId) {
      setFormError('Veuillez sélectionner un employé actif.');
      return;
    }

    const res = onCreateLeave({
      employeeId: effectiveSelectedEmployeeId,
      startDate,
      endDate,
      startTime,
      endTime,
    });
    if (res.error) {
      setFormError(res.error);
      return;
    }

    setFormSuccess('Congé validé et ajouté automatiquement au Planning.');
    setStartDate(todayYmd);
    setEndDate(todayYmd);
  };

  const handleConfirmCancel = () => {
    if (!pendingCancelLeave) return;
    setFormError(null);
    setFormSuccess(null);
    const res = onCancelLeave(pendingCancelLeave.id, cancelReason);
    setPendingCancelLeave(null);
    setCancelReason('');
    if (res.error) {
      setFormError(res.error);
      return;
    }
    if (editingLeaveId === pendingCancelLeave.id) {
      resetFormToCreate();
    }
    setFormSuccess('Congé annulé et retiré du Planning.');
  };

  const validatedCount = leaves.filter((l) => l.status === 'valide').length;
  const cancelledCount = leaves.filter((l) => l.status === 'annule').length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Gestion des congés"
        meta={`Enregistrement et validation directe · ${ROLE_LABELS[user.role]} (${user.fullName})`}
      />

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#393342]">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {editingLeaveId
                ? 'Modifier un congé validé'
                : 'Enregistrer et valider un congé'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5">
              Les congés validés sont automatiquement reportés dans les jours correspondants du Planning.
            </p>
          </div>
          {editingLeaveId && (
            <button
              type="button"
              onClick={resetFormToCreate}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer self-start"
            >
              Annuler la modification
            </button>
          )}
        </div>

        {manageableEmployees.length === 0 && !editingLeaveId ? (
          <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-2">
            Aucun employé actif disponible dans votre périmètre.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label
                htmlFor="owt-leave-employee"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Employé actif *
              </label>
              <select
                id="owt-leave-employee"
                value={effectiveSelectedEmployeeId}
                disabled={Boolean(editingLeaveId)}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] disabled:opacity-60"
              >
                {manageableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} — {emp.matricule} ({ROLE_LABELS[emp.role]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="owt-leave-matricule"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Matricule (automatique)
              </label>
              <input
                id="owt-leave-matricule"
                type="text"
                readOnly
                value={selectedEmployee?.matricule ?? '—'}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-[#17151C] text-slate-700 dark:text-[#C8C2D0] border border-slate-200 dark:border-[#393342] rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="owt-leave-name"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Nom (automatique)
              </label>
              <input
                id="owt-leave-name"
                type="text"
                readOnly
                value={selectedEmployee?.fullName ?? '—'}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#17151C] text-slate-700 dark:text-[#C8C2D0] border border-slate-200 dark:border-[#393342] rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="owt-leave-start-date"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Date de début *
              </label>
              <input
                id="owt-leave-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (endDate < val) setEndDate(val);
                }}
                className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div>
              <label
                htmlFor="owt-leave-end-date"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Date de fin *
              </label>
              <input
                id="owt-leave-end-date"
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div>
              <label
                htmlFor="owt-leave-start-time"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Heure de début *
              </label>
              <input
                id="owt-leave-start-time"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div>
              <label
                htmlFor="owt-leave-end-time"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Heure de fin *
              </label>
              <input
                id="owt-leave-end-time"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 flex items-end justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <CalendarCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {editingLeaveId ? 'Enregistrer la modification' : 'Valider le congé'}
                </span>
              </button>
            </div>
          </div>
        )}

        {formError && (
          <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-2.5">
            {formError}
          </div>
        )}

        {formSuccess && (
          <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-4 py-2.5 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{formSuccess}</span>
          </div>
        )}
      </form>

      <div className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#C8C2D0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, matricule ou date..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/60 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#211E27] rounded-lg w-fit">
          {(
            [
              { id: 'valide', label: `Validés (${validatedCount})` },
              { id: 'annule', label: `Annulés (${cancelledCount})` },
              { id: 'all', label: `Tous (${leaves.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-[#A83CE2] text-white'
                  : 'text-slate-600 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                <th className="py-3 px-5">Employé</th>
                <th className="py-3 px-4">Période</th>
                <th className="py-3 px-4">Horaires</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Traçabilité</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 px-5 text-center text-xs text-slate-500 dark:text-[#C8C2D0]"
                  >
                    Aucun congé enregistré pour ces critères.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => {
                  const info = resolveEmployeeInfo(leave);
                  const latestTrace = leave.history?.[0];
                  const periodLabel =
                    leave.startDate === leave.endDate
                      ? formatYmdFr(leave.startDate)
                      : `${formatYmdFr(leave.startDate)} → ${formatYmdFr(leave.endDate)}`;

                  return (
                    <tr key={leave.id} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                      <td className="py-3 px-5">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {info.fullName}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-[#C8C2D0]">
                          {info.matricule}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-800 dark:text-white whitespace-nowrap">
                        {periodLabel}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] whitespace-nowrap">
                        {leave.startTime} – {leave.endTime}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span
                          className={`font-semibold ${
                            leave.status === 'valide'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-[#C8C2D0]'
                          }`}
                        >
                          {leave.status === 'valide' ? 'Validé' : 'Annulé'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0]">
                        {latestTrace ? (
                          <div>
                            <div className="font-medium text-slate-800 dark:text-white">
                              {ACTION_LABELS[latestTrace.action]} · {latestTrace.actorName}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 dark:text-[#C8C2D0]/80">
                              {formatDateTimeFr(latestTrace.timestamp)}
                            </div>
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoryLeave(leave)}
                            title="Voir l'historique des actions"
                            className="p-1.5 rounded-lg text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {leave.status === 'valide' && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditLeave(leave)}
                                title="Modifier ce congé"
                                className="p-1.5 rounded-lg text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelReason('');
                                  setPendingCancelLeave(leave);
                                }}
                                title="Annuler ce congé"
                                className="p-1.5 rounded-lg text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
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

      {historyLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setHistoryLeave(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#393342] pb-3 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Traçabilité du congé
                </h3>
                <div className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5">
                  {resolveEmployeeInfo(historyLeave).fullName} ·{' '}
                  <span className="font-mono">
                    {resolveEmployeeInfo(historyLeave).matricule}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryLeave(null)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-[#393342] text-xs">
              {(historyLeave.history ?? []).map((entry) => (
                <div key={entry.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#7624A8] dark:text-[#D896FF]">
                      {ACTION_LABELS[entry.action]}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-[#C8C2D0]">
                      {formatDateTimeFr(entry.timestamp)}
                    </span>
                  </div>
                  <div className="text-slate-800 dark:text-white font-medium">
                    {entry.actorName} ({ROLE_LABELS[entry.actorRole]})
                  </div>
                  <div className="text-slate-600 dark:text-[#C8C2D0]">{entry.details}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pendingCancelLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setPendingCancelLeave(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirmer l’annulation du congé
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingCancelLeave(null)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-3.5 text-xs space-y-1">
              <div className="font-semibold text-sm text-slate-900 dark:text-white">
                {resolveEmployeeInfo(pendingCancelLeave).fullName}
              </div>
              <div className="font-mono text-[#7624A8] dark:text-[#D896FF]">
                {resolveEmployeeInfo(pendingCancelLeave).matricule} ·{' '}
                {pendingCancelLeave.startDate === pendingCancelLeave.endDate
                  ? formatYmdFr(pendingCancelLeave.startDate)
                  : `${formatYmdFr(pendingCancelLeave.startDate)} → ${formatYmdFr(pendingCancelLeave.endDate)}`}{' '}
                ({pendingCancelLeave.startTime}–{pendingCancelLeave.endTime})
              </div>
            </div>

            <div className="text-xs">
              <label
                htmlFor="owt-leave-cancel-reason"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Motif d’annulation (facultatif)
              </label>
              <input
                id="owt-leave-cancel-reason"
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex. Report demandé par le collaborateur"
                className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingCancelLeave(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
              >
                Conserver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Annuler le congé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
