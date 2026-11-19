import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Lock, Plus } from 'lucide-react';
import {
  AppUser,
  ManagedEmployee,
  PlanningDisplayRow,
  PlanningWeekData,
} from '../../core/types';
import { storageService } from '../../services/storageService';
import { addDaysYmd, formatYmdFr, getMondayOfWeekYmd, isValidYmd, toYmd } from '../../utils/formatters';
import { SectionHeader } from '../ui/DataPrimitives';

interface PlanningViewProps {
  user: AppUser;
  employees: ManagedEmployee[];
  revision: number;
  onPlanningChanged: () => void;
}

export function PlanningView({
  user,
  employees,
  revision,
  onPlanningChanged,
}: PlanningViewProps) {
  const currentWeekMonday = getMondayOfWeekYmd(toYmd(new Date()));
  const [weekStartYmd, setWeekStartYmd] = useState<string>(currentWeekMonday);
  const [localTick, setLocalTick] = useState(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [manualTimeDrafts, setManualTimeDrafts] = useState<
    Record<string, { startTime?: string; endTime?: string }>
  >({});

  const weekResponse = useMemo(() => {
    void revision;
    void localTick;
    return storageService.getPlanningWeekData(weekStartYmd, user);
  }, [weekStartYmd, user, revision, localTick]);

  const weekData: PlanningWeekData | undefined = weekResponse.data;

  const refreshPlanning = () => {
    setLocalTick((t) => t + 1);
    onPlanningChanged();
  };

  if (weekResponse.error || !weekData) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Planning" />
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-8 text-center space-y-2">
          <Lock className="w-6 h-6 text-slate-400 dark:text-[#C8C2D0] mx-auto" aria-hidden="true" />
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            Accès non autorisé
          </div>
          <p className="text-xs text-slate-500 dark:text-[#C8C2D0]">
            {weekResponse.error ??
              'Vous ne disposez pas de l’autorisation individuelle pour consulter ou modifier le Planning.'}
          </p>
        </section>
      </div>
    );
  }

  const handleLeaveOverlayChange = (
    row: PlanningDisplayRow,
    patch: { motif?: string; remplacant?: string }
  ) => {
    if (!row.leaveId) return;
    setErrorBanner(null);
    const res = storageService.updatePlanningLeaveOverlay(row.leaveId, row.dateYmd, patch, user);
    if (res.error) {
      setErrorBanner(res.error);
      return;
    }
    refreshPlanning();
  };

  const handleManualRowChange = (
    row: PlanningDisplayRow,
    patch: Partial<
      Pick<
        PlanningDisplayRow,
        'matricule' | 'employeeName' | 'startTime' | 'endTime' | 'motif' | 'remplacant'
      >
    >
  ) => {
    if (row.slotIndex === undefined) return;
    setErrorBanner(null);

    const draft = manualTimeDrafts[row.rowKey];
    let nextMatricule = patch.matricule !== undefined ? patch.matricule : row.matricule;
    let nextName = patch.employeeName !== undefined ? patch.employeeName : row.employeeName;
    const nextStartTime =
      patch.startTime !== undefined ? patch.startTime : draft?.startTime ?? row.startTime;
    const nextEndTime =
      patch.endTime !== undefined ? patch.endTime : draft?.endTime ?? row.endTime;

    if (patch.matricule !== undefined && !nextName.trim()) {
      const normalized = patch.matricule.trim().toLowerCase();
      if (normalized) {
        const matched = employees.find(
          (e) =>
            e.accountStatus === 'actif' &&
            (e.matricule ?? '').trim().toLowerCase() === normalized
        );
        if (matched) {
          nextName = matched.fullName;
        }
      }
    }

    const res = storageService.savePlanningManualRow(
      {
        weekStartYmd: weekData.weekStartYmd,
        dateYmd: row.dateYmd,
        slotIndex: row.slotIndex,
        matricule: nextMatricule,
        employeeName: nextName,
        startTime: nextStartTime,
        endTime: nextEndTime,
        motif: patch.motif !== undefined ? patch.motif : row.motif,
        remplacant: patch.remplacant !== undefined ? patch.remplacant : row.remplacant,
      },
      user
    );
    if (res.error) {
      setErrorBanner(res.error);
      if (patch.startTime !== undefined || patch.endTime !== undefined) {
        setManualTimeDrafts((prev) => ({
          ...prev,
          [row.rowKey]: { startTime: nextStartTime, endTime: nextEndTime },
        }));
      }
      return;
    }
    if (draft) {
      setManualTimeDrafts((prev) => {
        const copy = { ...prev };
        delete copy[row.rowKey];
        return copy;
      });
    }
    refreshPlanning();
  };

  const handleAddDayRow = (dateYmd: string) => {
    setErrorBanner(null);
    const res = storageService.addPlanningDayRow(weekData.weekStartYmd, dateYmd, user);
    if (res.error) {
      setErrorBanner(res.error);
      return;
    }
    refreshPlanning();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Planning hebdomadaire"
        meta={`Semaine du ${formatYmdFr(weekData.weekStartYmd)} au ${formatYmdFr(weekData.weekEndYmd)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStartYmd(addDaysYmd(weekData.weekStartYmd, -7))}
              className="inline-flex items-center gap-1 px-3 py-2 bg-white dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15 text-slate-700 dark:text-[#C8C2D0] border border-slate-300 dark:border-[#393342] text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span>Semaine précédente</span>
            </button>
            <button
              type="button"
              onClick={() => setWeekStartYmd(currentWeekMonday)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap border ${
                weekData.weekStartYmd === currentWeekMonday
                  ? 'bg-[#A83CE2] text-white border-[#A83CE2]'
                  : 'bg-white dark:bg-[#292631] text-[#7624A8] dark:text-[#D896FF] border-[#A83CE2]/40 hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15'
              }`}
            >
              Semaine en cours
            </button>
            <button
              type="button"
              onClick={() => setWeekStartYmd(addDaysYmd(weekData.weekStartYmd, 7))}
              className="inline-flex items-center gap-1 px-3 py-2 bg-white dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15 text-slate-700 dark:text-[#C8C2D0] border border-slate-300 dark:border-[#393342] text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <span>Semaine suivante</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#292631] border border-slate-300 dark:border-[#393342] rounded-lg text-xs text-slate-600 dark:text-[#C8C2D0]">
              <Calendar className="w-3.5 h-3.5 text-[#A83CE2] shrink-0" aria-hidden="true" />
              <input
                type="date"
                aria-label="Choisir une semaine"
                value={weekData.weekStartYmd}
                onChange={(e) => {
                  if (isValidYmd(e.target.value)) {
                    setWeekStartYmd(getMondayOfWeekYmd(e.target.value));
                  }
                }}
                className="font-mono text-xs bg-transparent text-slate-900 dark:text-white focus:outline-none"
              />
            </label>
          </div>
        }
      />

      {errorBanner && (
        <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-2.5">
          {errorBanner}
        </div>
      )}

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-semibold text-slate-600 dark:text-[#C8C2D0]">
                <th className="py-3 px-4 w-40">Jour</th>
                <th className="py-3 px-3 w-36">Matricule</th>
                <th className="py-3 px-3 w-48">Nom</th>
                <th className="py-3 px-3 w-28">Heure début</th>
                <th className="py-3 px-3 w-28">Heure fin</th>
                <th className="py-3 px-3">Motif</th>
                <th className="py-3 px-3 w-48">Remplaçant</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {weekData.days.map((day, dayIdx) =>
                day.rows.map((row, rowIdx) => {
                  const isLeave = row.source === 'leave';
                  const isFirstOfDay = rowIdx === 0;
                  const daySeparatorClass =
                    dayIdx > 0 && isFirstOfDay
                      ? 'border-t-2 border-slate-300 dark:border-[#393342]'
                      : 'border-t border-slate-100 dark:border-[#393342]/70';

                  return (
                    <tr
                      key={row.rowKey}
                      className={`${daySeparatorClass} ${
                        isLeave
                          ? 'bg-[#F7EEFC]/55 dark:bg-[#A83CE2]/10'
                          : 'hover:bg-slate-50/70 dark:hover:bg-[#211E27]/60'
                      }`}
                    >
                      {isFirstOfDay && (
                        <td
                          rowSpan={day.rows.length}
                          className="align-top py-3 px-4 bg-slate-50/70 dark:bg-[#211E27] border-r border-slate-200 dark:border-[#393342]"
                        >
                          <div className="space-y-2">
                            <div>
                              <div className="font-semibold text-sm text-slate-900 dark:text-white">
                                {day.dayLabel}
                              </div>
                              <div className="font-mono text-xs text-slate-500 dark:text-[#C8C2D0]">
                                {formatYmdFr(day.dateYmd)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddDayRow(day.dateYmd)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF] border border-slate-200 dark:border-[#393342] rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                            >
                              <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span>Ajouter une ligne</span>
                            </button>
                          </div>
                        </td>
                      )}

                      {isLeave ? (
                        <>
                          <td className="py-2 px-3">
                            <div className="font-mono font-semibold text-[#7624A8] dark:text-[#D896FF]">
                              {row.matricule}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-[#C8C2D0]">
                              Congé validé
                            </div>
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                            {row.employeeName}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-800 dark:text-white whitespace-nowrap">
                            {row.startTime}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-800 dark:text-white whitespace-nowrap">
                            {row.endTime}
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              aria-label={`Motif congé ${row.employeeName} ${day.dateYmd}`}
                              value={row.motif}
                              onChange={(e) =>
                                handleLeaveOverlayChange(row, { motif: e.target.value })
                              }
                              placeholder="Motif (facultatif)"
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50 border border-slate-300 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              aria-label={`Remplaçant congé ${row.employeeName} ${day.dateYmd}`}
                              value={row.remplacant}
                              onChange={(e) =>
                                handleLeaveOverlayChange(row, { remplacant: e.target.value })
                              }
                              placeholder="Remplaçant"
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50 border border-slate-300 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              aria-label={`Matricule ${day.dateYmd} ligne ${(row.slotIndex ?? 0) + 1}`}
                              value={row.matricule}
                              onChange={(e) =>
                                handleManualRowChange(row, { matricule: e.target.value })
                              }
                              placeholder="Matricule"
                              className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/40 border border-slate-200 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              aria-label={`Nom ${day.dateYmd} ligne ${(row.slotIndex ?? 0) + 1}`}
                              value={row.employeeName}
                              onChange={(e) =>
                                handleManualRowChange(row, { employeeName: e.target.value })
                              }
                              placeholder="Nom"
                              className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/40 border border-slate-200 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="time"
                              aria-label={`Heure début ${day.dateYmd} ligne ${(row.slotIndex ?? 0) + 1}`}
                              value={manualTimeDrafts[row.rowKey]?.startTime ?? row.startTime}
                              onChange={(e) =>
                                handleManualRowChange(row, { startTime: e.target.value })
                              }
                              className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-200 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="time"
                              aria-label={`Heure fin ${day.dateYmd} ligne ${(row.slotIndex ?? 0) + 1}`}
                              value={manualTimeDrafts[row.rowKey]?.endTime ?? row.endTime}
                              onChange={(e) =>
                                handleManualRowChange(row, { endTime: e.target.value })
                              }
                              className="w-full px-2 py-1.5 text-xs font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-200 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              aria-label={`Motif ${day.dateYmd} ligne ${(row.slotIndex ?? 0) + 1}`}
                              value={row.motif}
                              onChange={(e) =>
                                handleManualRowChange(row, { motif: e.target.value })
                              }
                              placeholder="Motif"
                              className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/40 border border-slate-200 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              aria-label={`Remplaçant ${day.dateYmd} ligne ${(row.slotIndex ?? 0) + 1}`}
                              value={row.remplacant}
                              onChange={(e) =>
                                handleManualRowChange(row, { remplacant: e.target.value })
                              }
                              placeholder="Remplaçant"
                              className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/40 border border-slate-200 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
