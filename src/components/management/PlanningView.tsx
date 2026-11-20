import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react';
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

  const handleManualRowChange = (
    row: PlanningDisplayRow,
    patch: Partial<
      Pick<
        PlanningDisplayRow,
        'matricule' | 'employeeName' | 'startTime' | 'endTime' | 'motif' | 'remplacant'
      >
    >
  ) => {
    setErrorBanner(null);

    const draft = manualTimeDrafts[row.rowKey];
    const nextMatricule = patch.matricule !== undefined ? patch.matricule : row.matricule;
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

  const handleDeleteOrClearRow = (row: PlanningDisplayRow) => {
    setErrorBanner(null);
    const res = storageService.deletePlanningManualRow(
      weekData.weekStartYmd,
      row.dateYmd,
      row.slotIndex,
      user
    );
    if (res.error) {
      setErrorBanner(res.error);
      return;
    }
    setManualTimeDrafts((prev) => {
      if (!prev[row.rowKey]) return prev;
      const copy = { ...prev };
      delete copy[row.rowKey];
      return copy;
    });
    refreshPlanning();
  };

  const compactInputClass =
    'w-full px-1.5 py-1 lg:py-0.5 text-[11px] leading-tight bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/45 border border-slate-200 dark:border-[#393342] rounded focus:outline-none focus:border-[#A83CE2]';

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Planning hebdomadaire"
        meta={`Semaine du ${formatYmdFr(weekData.weekStartYmd)} au ${formatYmdFr(
          weekData.weekEndYmd
        )} · Saisie manuelle`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStartYmd(addDaysYmd(weekData.weekStartYmd, -7))}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15 text-slate-700 dark:text-[#C8C2D0] border border-slate-300 dark:border-[#393342] text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span>Semaine précédente</span>
            </button>
            <button
              type="button"
              onClick={() => setWeekStartYmd(currentWeekMonday)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap border ${
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
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15 text-slate-700 dark:text-[#C8C2D0] border border-slate-300 dark:border-[#393342] text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
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
        <div
          role="alert"
          className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-2.5"
        >
          {errorBanner}
        </div>
      )}

      {/* Grille hebdomadaire 5 colonnes simultanées (Lundi -> Vendredi) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5 items-start">
        {weekData.days.map((day) => {
          const filledCount = day.rows.filter(
            (r) =>
              r.matricule.trim() ||
              r.employeeName.trim() ||
              r.startTime.trim() ||
              r.endTime.trim() ||
              r.motif.trim() ||
              r.remplacant.trim()
          ).length;

          return (
            <section
              key={day.dateYmd}
              aria-label={`${day.dayLabel} ${formatYmdFr(day.dateYmd)}`}
              className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden flex flex-col"
            >
              {/* En-tête jour */}
              <div className="px-2.5 py-2 border-b border-slate-200 dark:border-[#393342] bg-[#F7EEFC]/60 dark:bg-[#211E27] flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                    {day.dayLabel}
                  </h2>
                  <span className="font-mono text-[11px] font-semibold text-[#7624A8] dark:text-[#D896FF]">
                    {day.shortDate}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 dark:text-[#C8C2D0] shrink-0">
                  {filledCount}/{day.rows.length}
                </span>
              </div>

              {/* Lignes horizontales numérotées 1 à 10+ empilées */}
              <div className="divide-y divide-slate-100 dark:divide-[#393342]">
                {day.rows.map((row) => {
                  const hasContent = Boolean(
                    row.matricule.trim() ||
                      row.employeeName.trim() ||
                      row.startTime.trim() ||
                      row.endTime.trim() ||
                      row.motif.trim() ||
                      row.remplacant.trim()
                  );
                  const canRemove = row.slotIndex >= 10 || hasContent;

                  return (
                    <div
                      key={row.rowKey}
                      className={`px-2 py-1.5 space-y-1 transition-colors ${
                        hasContent
                          ? 'bg-[#F7EEFC]/25 dark:bg-[#A83CE2]/5'
                          : 'hover:bg-slate-50/70 dark:hover:bg-[#211E27]/60'
                      }`}
                    >
                      {/* Ligne A : N° + Matricule + Nom + Suppression/Effacement */}
                      <div className="flex items-center gap-1">
                        <span className="w-4 text-[10px] font-mono font-bold text-slate-400 dark:text-[#C8C2D0]/70 shrink-0 text-right">
                          {row.slotIndex + 1}
                        </span>
                        <input
                          type="text"
                          aria-label={`Matricule ${day.dayLabel} ligne ${row.slotIndex + 1}`}
                          value={row.matricule}
                          onChange={(e) =>
                            handleManualRowChange(row, { matricule: e.target.value })
                          }
                          placeholder="Matricule"
                          className={`${compactInputClass} w-20 font-mono shrink-0`}
                        />
                        <input
                          type="text"
                          aria-label={`Nom ${day.dayLabel} ligne ${row.slotIndex + 1}`}
                          value={row.employeeName}
                          onChange={(e) =>
                            handleManualRowChange(row, { employeeName: e.target.value })
                          }
                          placeholder="Nom"
                          className={`${compactInputClass} flex-1 min-w-0`}
                        />
                        <button
                          type="button"
                          disabled={!canRemove}
                          onClick={() => handleDeleteOrClearRow(row)}
                          title={
                            row.slotIndex >= 10 ? 'Supprimer la ligne' : 'Effacer la ligne'
                          }
                          aria-label={
                            row.slotIndex >= 10
                              ? `Supprimer ${day.dayLabel} ligne ${row.slotIndex + 1}`
                              : `Effacer ${day.dayLabel} ligne ${row.slotIndex + 1}`
                          }
                          className="p-0.5 text-slate-400 dark:text-[#C8C2D0]/60 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-25 cursor-pointer disabled:cursor-default shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Ligne B : Heure début + Heure fin + Motif + Remplaçant */}
                      <div className="grid grid-cols-12 gap-1 pl-5">
                        <input
                          type="time"
                          title="Heure début"
                          aria-label={`Heure début ${day.dayLabel} ligne ${row.slotIndex + 1}`}
                          value={manualTimeDrafts[row.rowKey]?.startTime ?? row.startTime}
                          onChange={(e) =>
                            handleManualRowChange(row, { startTime: e.target.value })
                          }
                          className={`${compactInputClass} col-span-3 font-mono`}
                        />
                        <input
                          type="time"
                          title="Heure fin"
                          aria-label={`Heure fin ${day.dayLabel} ligne ${row.slotIndex + 1}`}
                          value={manualTimeDrafts[row.rowKey]?.endTime ?? row.endTime}
                          onChange={(e) =>
                            handleManualRowChange(row, { endTime: e.target.value })
                          }
                          className={`${compactInputClass} col-span-3 font-mono`}
                        />
                        <input
                          type="text"
                          aria-label={`Motif ${day.dayLabel} ligne ${row.slotIndex + 1}`}
                          value={row.motif}
                          onChange={(e) => handleManualRowChange(row, { motif: e.target.value })}
                          placeholder="Motif"
                          className={`${compactInputClass} col-span-3`}
                        />
                        <input
                          type="text"
                          aria-label={`Remplaçant ${day.dayLabel} ligne ${row.slotIndex + 1}`}
                          value={row.remplacant}
                          onChange={(e) =>
                            handleManualRowChange(row, { remplacant: e.target.value })
                          }
                          placeholder="Remplaçant"
                          className={`${compactInputClass} col-span-3`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bouton Ajouter une ligne */}
              <div className="p-2 border-t border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27]">
                <button
                  type="button"
                  onClick={() => handleAddDayRow(day.dateYmd)}
                  className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF] border border-slate-200 dark:border-[#393342] rounded text-[11px] font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Ajouter une ligne</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
