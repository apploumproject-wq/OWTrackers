import React, { useState } from 'react';
import { Check, Save, X } from 'lucide-react';
import {
  AppUser,
  EmployeeScheduleConfig,
  ManagedEmployee,
  OutingAuthorizationRequest,
} from '../../core/types';
import { OUTING_REASON_CONFIG } from '../../core/permissions';
import { formatTimeShort } from '../../utils/formatters';
import { SectionHeader } from '../ui/DataPrimitives';

interface SchedulesOutingsViewProps {
  user: AppUser;
  employees: ManagedEmployee[];
  schedules: EmployeeScheduleConfig[];
  outingRequests: OutingAuthorizationRequest[];
  canApproveOutings: boolean;
  onSaveEmployeeSchedule: (schedule: EmployeeScheduleConfig) => void;
  onReviewOutingRequest: (requestId: string, decision: 'approuvee' | 'refusee') => void;
}

export function SchedulesOutingsView({
  user,
  employees,
  schedules,
  outingRequests,
  canApproveOutings,
  onSaveEmployeeSchedule,
  onReviewOutingRequest,
}: SchedulesOutingsViewProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState('08:30');
  const [draftEnd, setDraftEnd] = useState('17:00');
  const [draftRestDays, setDraftRestDays] = useState('Samedi, Dimanche');
  const [draftNote, setDraftNote] = useState('');

  const activeUserIds = new Set(
    employees.filter((e) => e.accountStatus === 'actif').map((e) => e.id)
  );
  const activeSchedules = schedules.filter((s) => activeUserIds.has(s.userId));
  const scopedSchedules =
    user.role === 'supervisor' && user.teamId
      ? activeSchedules.filter((s) => s.teamId === user.teamId)
      : activeSchedules;

  const scopedOutings =
    user.role === 'supervisor' && user.teamId
      ? outingRequests.filter((r) => r.teamId === user.teamId)
      : outingRequests;

  const startEdit = (sch: EmployeeScheduleConfig) => {
    setEditingUserId(sch.userId);
    setDraftStart(sch.plannedStart);
    setDraftEnd(sch.plannedEnd);
    setDraftRestDays(sch.restDays.join(', '));
    setDraftNote(sch.exceptionNote ?? '');
  };

  const handleSave = (sch: EmployeeScheduleConfig) => {
    onSaveEmployeeSchedule({
      ...sch,
      plannedStart: draftStart,
      plannedEnd: draftEnd,
      restDays: draftRestDays
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      isCustom: true,
      exceptionNote: draftNote.trim() || undefined,
    });
    setEditingUserId(null);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Horaires & sorties" />

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Planification horaire
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                <th className="py-3 px-5">Employé</th>
                <th className="py-3 px-4">Équipe</th>
                <th className="py-3 px-4">Horaire</th>
                <th className="py-3 px-4">Jours de repos</th>
                <th className="py-3 px-4">Exception</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
              {scopedSchedules.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 px-5 text-center text-xs text-slate-500 dark:text-[#C8C2D0]"
                  >
                    Aucun planning configuré pour le moment.
                  </td>
                </tr>
              ) : (
                scopedSchedules.map((sch) => {
                const isEditing = editingUserId === sch.userId;
                return (
                  <tr key={sch.userId} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                    <td className="py-3 px-5">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {sch.employeeName}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-[#C8C2D0]">
                        {sch.matricule}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0]">
                      {sch.teamName}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                          <input
                            type="time"
                            value={draftStart}
                            onChange={(e) => setDraftStart(e.target.value)}
                            className="px-2 py-1 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded text-xs focus:outline-none focus:border-[#A83CE2]"
                          />
                          <span>–</span>
                          <input
                            type="time"
                            value={draftEnd}
                            onChange={(e) => setDraftEnd(e.target.value)}
                            className="px-2 py-1 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded text-xs focus:outline-none focus:border-[#A83CE2]"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {sch.plannedStart} – {sch.plannedEnd}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0]">
                      {isEditing ? (
                        <input
                          type="text"
                          value={draftRestDays}
                          onChange={(e) => setDraftRestDays(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded text-xs focus:outline-none focus:border-[#A83CE2]"
                        />
                      ) : (
                        sch.restDays.join(', ')
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {isEditing ? (
                        <input
                          type="text"
                          value={draftNote}
                          onChange={(e) => setDraftNote(e.target.value)}
                          placeholder="Motif"
                          className="w-full px-2 py-1 bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/60 border border-slate-300 dark:border-[#393342] rounded text-xs focus:outline-none focus:border-[#A83CE2]"
                        />
                      ) : sch.exceptionNote ? (
                        <span className="text-[#7624A8] dark:text-[#D896FF]">
                          {sch.exceptionNote}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-[#C8C2D0]/60">—</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => handleSave(sch)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Enregistrer</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(sch)}
                          className="text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer"
                        >
                          Modifier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Demandes d’autorisation de sortie
          </h2>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[#393342]">
          {scopedOutings.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
              Aucune demande d’autorisation de sortie en cours.
            </div>
          ) : (
            scopedOutings.map((req) => (
              <div
                key={req.id}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="text-xs space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {req.employeeName} ·{' '}
                    <span className="text-[#7624A8] dark:text-[#D896FF]">
                      {OUTING_REASON_CONFIG[req.reason].label}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-[#C8C2D0]">
                    Créneau : <span className="font-mono">{req.plannedWindow}</span> ·{' '}
                    {formatTimeShort(req.requestedAt)} — {req.details}
                  </div>
                </div>

                {req.status === 'en_attente' && canApproveOutings ? (
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
                ) : (
                  <div className="text-xs font-semibold shrink-0">
                    <span
                      className={
                        req.status === 'approuvee'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : req.status === 'refusee'
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }
                    >
                      {req.status === 'approuvee'
                        ? 'Approuvée'
                        : req.status === 'refusee'
                        ? 'Refusée'
                        : 'En attente'}
                    </span>
                    {req.reviewedBy && (
                      <span className="text-slate-400 dark:text-[#C8C2D0]/70 font-normal">
                        {' '}
                        · {req.reviewedBy}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
