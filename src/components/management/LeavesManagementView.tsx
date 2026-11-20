import React, { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Check,
  Edit3,
  History,
  Search,
  X,
} from 'lucide-react';
import { AppUser, LeaveRecord, LeaveStatus, ManagedEmployee } from '../../core/types';
import { LEAVE_STATUS_LABELS, ROLE_LABELS } from '../../core/permissions';
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
    motif?: string;
    status: LeaveStatus;
  }) => { error?: string };
  onUpdateLeave: (
    leaveId: string,
    patch: {
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
      motif?: string;
      status: LeaveStatus;
    }
  ) => { error?: string };
  onUpdateLeaveStatus: (leaveId: string, status: LeaveStatus) => { error?: string };
}

const ACTION_LABELS = {
  creation: 'Enregistrement',
  modification: 'Modification',
  statut: 'Changement de statut',
} as const;

const STATUS_TEXT_CLASS: Record<LeaveStatus, string> = {
  en_attente: 'text-amber-700 dark:text-amber-400',
  valide: 'text-emerald-700 dark:text-emerald-400',
  refuse: 'text-red-700 dark:text-red-400',
};

export function LeavesManagementView({
  user,
  employees,
  manageableEmployees,
  leaves,
  onCreateLeave,
  onUpdateLeave,
  onUpdateLeaveStatus,
}: LeavesManagementViewProps) {
  const todayYmd = toYmd(new Date());

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    () => manageableEmployees[0]?.id ?? ''
  );
  const [startDate, setStartDate] = useState<string>(todayYmd);
  const [endDate, setEndDate] = useState<string>(todayYmd);
  const [startTime, setStartTime] = useState<string>('08:30');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [motif, setMotif] = useState<string>('');
  const [status, setStatus] = useState<LeaveStatus>('en_attente');
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all');
  const [historyLeave, setHistoryLeave] = useState<LeaveRecord | null>(null);

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
        (lv.motif ?? '').toLowerCase().includes(q) ||
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
    setMotif('');
    setStatus('en_attente');
    setFormError(null);
  };

  const startEditLeave = (leave: LeaveRecord) => {
    setEditingLeaveId(leave.id);
    setSelectedEmployeeId(leave.employeeId);
    setStartDate(leave.startDate);
    setEndDate(leave.endDate);
    setStartTime(leave.startTime);
    setEndTime(leave.endTime);
    setMotif(leave.motif ?? '');
    setStatus(leave.status);
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
        motif,
        status,
      });
      if (res.error) {
        setFormError(res.error);
        return;
      }
      setFormSuccess('Congé mis à jour.');
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
      motif,
      status,
    });
    if (res.error) {
      setFormError(res.error);
      return;
    }

    setFormSuccess(`Demande enregistrée (${LEAVE_STATUS_LABELS[status]}).`);
    setStartDate(todayYmd);
    setEndDate(todayYmd);
    setMotif('');
  };

  const handleInlineStatusChange = (leaveId: string, nextStatus: LeaveStatus) => {
    setFormError(null);
    setFormSuccess(null);
    const res = onUpdateLeaveStatus(leaveId, nextStatus);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    setFormSuccess(`Statut mis à jour : ${LEAVE_STATUS_LABELS[nextStatus]}.`);
  };

  const pendingCount = leaves.filter((l) => l.status === 'en_attente').length;
  const validatedCount = leaves.filter((l) => l.status === 'valide').length;
  const refusedCount = leaves.filter((l) => l.status === 'refuse').length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Gestion des congés"
        meta={`Enregistrement et suivi des congés · ${ROLE_LABELS[user.role]} (${user.fullName})`}
      />

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#393342]">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {editingLeaveId ? 'Modifier une demande de congé' : 'Enregistrer un congé'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5">
              Les congés sont visibles dans l’espace « Mes congés » du collaborateur selon leur statut (En attente, Validé, Refusé). Le Planning reste indépendant.
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

            <div className="sm:col-span-2">
              <label
                htmlFor="owt-leave-motif"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Motif (facultatif)
              </label>
              <input
                id="owt-leave-motif"
                type="text"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex. Congé annuel, rendez-vous personnel..."
                className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>

            <div>
              <label
                htmlFor="owt-leave-status"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Statut *
              </label>
              <select
                id="owt-leave-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as LeaveStatus)}
                className="w-full px-3 py-2 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              >
                <option value="en_attente">En attente</option>
                <option value="valide">Validé</option>
                <option value="refuse">Refusé</option>
              </select>
            </div>

            <div className="flex items-end justify-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <CalendarCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{editingLeaveId ? 'Mettre à jour' : 'Enregistrer'}</span>
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
            placeholder="Rechercher par nom, matricule, motif ou date..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/60 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#211E27] rounded-lg w-fit">
          {(
            [
              { id: 'all', label: `Tous (${leaves.length})` },
              { id: 'en_attente', label: `En attente (${pendingCount})` },
              { id: 'valide', label: `Validés (${validatedCount})` },
              { id: 'refuse', label: `Refusés (${refusedCount})` },
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
                <th className="py-3 px-4">Motif</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Traçabilité</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
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
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0] max-w-[200px] truncate">
                        {leave.motif || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <select
                          aria-label={`Statut congé ${info.fullName}`}
                          value={leave.status}
                          onChange={(e) =>
                            handleInlineStatusChange(leave.id, e.target.value as LeaveStatus)
                          }
                          className={`px-2 py-1 text-xs font-semibold bg-white dark:bg-[#211E27] border border-slate-300 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2] cursor-pointer ${
                            STATUS_TEXT_CLASS[leave.status]
                          }`}
                        >
                          <option value="en_attente">En attente</option>
                          <option value="valide">Validé</option>
                          <option value="refuse">Refusé</option>
                        </select>
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
                          <button
                            type="button"
                            onClick={() => startEditLeave(leave)}
                            title="Modifier ce congé"
                            className="p-1.5 rounded-lg text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
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
                      {entry.oldStatus && entry.newStatus && entry.oldStatus !== entry.newStatus
                        ? ` (${LEAVE_STATUS_LABELS[entry.oldStatus]} → ${
                            LEAVE_STATUS_LABELS[entry.newStatus]
                          })`
                        : ''}
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
    </div>
  );
}
