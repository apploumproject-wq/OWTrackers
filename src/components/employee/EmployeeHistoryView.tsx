import React, { useMemo, useState } from 'react';
import { Lock, MessageSquareWarning, Send, X } from 'lucide-react';
import {
  ActivityRecord,
  ActivityType,
  AppUser,
  CorrectionRequest,
} from '../../core/types';
import {
  formatDateFr,
  formatDateTimeFr,
  formatDurationHM,
  formatTimeShort,
  isSameDayYmd,
  isSameMonth,
  isWithinDays,
  toYmd,
} from '../../utils/formatters';
import { SectionHeader, StatTile } from '../ui/DataPrimitives';

interface EmployeeHistoryViewProps {
  user: AppUser;
  activities: ActivityRecord[];
  correctionRequests: CorrectionRequest[];
  onCreateCorrectionRequest: (activity: ActivityRecord, reason: string) => void;
}

export function EmployeeHistoryView({
  user,
  activities,
  correctionRequests,
  onCreateCorrectionRequest,
}: EmployeeHistoryViewProps) {
  const [period, setPeriod] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityType>('all');
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecord | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const todayYmd = toYmd(now);

  const filteredOperations = useMemo(() => {
    return activities.filter((act) => {
      if (typeFilter !== 'all' && act.type !== typeFilter) return false;
      if (period === 'jour') return isSameDayYmd(act.startedAt, todayYmd);
      if (period === 'semaine') return isWithinDays(act.startedAt, now, 7);
      return isSameMonth(act.startedAt, now.getFullYear(), now.getMonth());
    });
  }, [activities, period, typeFilter, todayYmd, now]);

  const dailySummaries = useMemo(() => {
    const byDay: Record<
      string,
      {
        date: string;
        productiveSeconds: number;
        pauseSeconds: number;
        outingSeconds: number;
        dossiersCount: number;
        firstStart: string;
        lastEnd: string;
      }
    > = {};

    for (const act of activities) {
      const ymd = toYmd(new Date(act.startedAt));
      const inPeriod =
        period === 'jour'
          ? isSameDayYmd(ymd, todayYmd)
          : period === 'semaine'
          ? isWithinDays(ymd, now, 7)
          : isSameMonth(ymd, now.getFullYear(), now.getMonth());
      if (!inPeriod) continue;

      if (!byDay[ymd]) {
        byDay[ymd] = {
          date: ymd,
          productiveSeconds: 0,
          pauseSeconds: 0,
          outingSeconds: 0,
          dossiersCount: 0,
          firstStart: act.startedAt,
          lastEnd: act.endedAt,
        };
      }
      const bucket = byDay[ymd];
      if (act.type === 'traitement') {
        bucket.productiveSeconds += act.durationSeconds;
        bucket.dossiersCount += 1;
      } else if (act.type === 'pause') {
        bucket.pauseSeconds += act.durationSeconds;
      } else {
        bucket.outingSeconds += act.durationSeconds;
      }
      if (new Date(act.startedAt).getTime() < new Date(bucket.firstStart).getTime()) {
        bucket.firstStart = act.startedAt;
      }
      if (new Date(act.endedAt).getTime() > new Date(bucket.lastEnd).getTime()) {
        bucket.lastEnd = act.endedAt;
      }
    }

    return Object.values(byDay)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => ({
        id: `hist-${item.date}`,
        date: item.date,
        plannedStart: user.plannedSchedule.split('–')[0]?.trim() || '08:30',
        plannedEnd: user.plannedSchedule.split('–')[1]?.trim() || '17:00',
        shiftStart: formatTimeShort(item.firstStart),
        shiftEnd: formatTimeShort(item.lastEnd),
        presenceSeconds: item.productiveSeconds + item.outingSeconds,
        productiveSeconds: item.productiveSeconds,
        pauseSeconds: item.pauseSeconds,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
      }));
  }, [activities, period, todayYmd, now, user.plannedSchedule]);

  const sumProductive = filteredOperations
    .filter((a) => a.type === 'traitement')
    .reduce((acc, a) => acc + a.durationSeconds, 0);
  const sumPauses = filteredOperations
    .filter((a) => a.type === 'pause')
    .reduce((acc, a) => acc + a.durationSeconds, 0);
  const sumOutings = filteredOperations
    .filter((a) => a.type === 'sortie')
    .reduce((acc, a) => acc + a.durationSeconds, 0);

  const handleSubmitCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;
    if (!reason.trim()) {
      setFormError('Veuillez indiquer le motif de la correction demandée.');
      return;
    }
    onCreateCorrectionRequest(selectedActivity, reason);
    setSelectedActivity(null);
    setReason('');
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Historique" />

      <div className="bg-[#F7EEFC] dark:bg-[#A83CE2]/15 border border-[#A83CE2]/20 dark:border-[#A83CE2]/40 rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-[#7624A8] dark:text-[#D896FF]">
        <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>
          Relevés verrouillés en lecture seule. Utilisez « Demander correction » en cas d’anomalie.
        </span>
      </div>

      <div className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#211E27] rounded-lg w-fit">
          {(
            [
              { id: 'jour', label: 'Jour' },
              { id: 'semaine', label: 'Semaine (7 j.)' },
              { id: 'mois', label: 'Mois' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                period === p.id
                  ? 'bg-[#A83CE2] text-white'
                  : 'text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#211E27] rounded-lg w-fit">
          {(
            [
              { id: 'all', label: 'Toutes' },
              { id: 'traitement', label: 'Traitements' },
              { id: 'pause', label: 'Pauses' },
              { id: 'sortie', label: 'Sorties' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                typeFilter === t.id
                  ? 'bg-white dark:bg-[#292631] text-[#7624A8] dark:text-[#D896FF] shadow-sm'
                  : 'text-slate-600 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Opérations" value={filteredOperations.length} />
        <StatTile
          label="Temps productif"
          value={formatDurationHM(sumProductive)}
          accent="primary"
        />
        <StatTile label="Pauses" value={formatDurationHM(sumPauses)} accent="amber" />
        <StatTile label="Sorties" value={formatDurationHM(sumOutings)} />
      </div>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Opérations ({filteredOperations.length})
          </h2>
        </div>

        {filteredOperations.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-[#C8C2D0]">
            Aucune opération pour cette sélection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                  <th className="py-3 px-5">Date & Catégorie</th>
                  <th className="py-3 px-4">Tâche / Motif</th>
                  <th className="py-3 px-4">Société & Référence</th>
                  <th className="py-3 px-4">Horaire</th>
                  <th className="py-3 px-4 text-right">Durée</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
                {filteredOperations.map((op) => {
                  const existingReq = correctionRequests.find((r) => r.activityId === op.id);
                  return (
                    <tr
                      key={op.id}
                      className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70 transition-colors"
                    >
                      <td className="py-3 px-5 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-900 dark:text-white capitalize">
                          {formatDateFr(op.startedAt)}
                        </div>
                        <div className="text-[11px] font-semibold text-[#7624A8] dark:text-[#D896FF] capitalize">
                          {op.type}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {op.taskTitle}
                        </div>
                        {op.notes && (
                          <div className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5">
                            {op.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0] space-y-0.5">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-white">
                            {op.clientName}
                          </span>{' '}
                          · <span className="font-mono">{op.dossierRef}</span>
                        </div>
                        {op.receptionChannel && <div>{op.receptionChannel}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 dark:text-[#C8C2D0] whitespace-nowrap">
                        {formatTimeShort(op.startedAt)} – {formatTimeShort(op.endedAt)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatDurationHM(op.durationSeconds)}
                        {op.overtimeSeconds && op.overtimeSeconds > 0 ? (
                          <div className="text-[11px] text-red-600 dark:text-red-400 font-normal">
                            +{formatDurationHM(op.overtimeSeconds)}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        {existingReq ? (
                          <span
                            className={`text-xs font-medium ${
                              existingReq.status === 'approuvee'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : existingReq.status === 'refusee'
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {existingReq.status === 'approuvee'
                              ? 'Correction approuvée'
                              : existingReq.status === 'refusee'
                              ? 'Correction refusée'
                              : 'Correction demandée'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedActivity(op);
                              setReason('');
                              setFormError(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer"
                          >
                            <MessageSquareWarning className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Demander correction</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {correctionRequests.length > 0 && (
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Mes demandes de correction
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#393342]">
            {correctionRequests.map((req) => (
              <div
                key={req.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {req.activityLabel} · <span className="font-mono">{req.dossierRef}</span>
                  </div>
                  <div className="text-slate-600 dark:text-[#C8C2D0] mt-0.5">{req.reason}</div>
                  {req.reviewNote && (
                    <div className="text-slate-500 dark:text-[#C8C2D0]/80 mt-0.5">
                      Réponse : {req.reviewNote}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-semibold ${
                      req.status === 'approuvee'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : req.status === 'refusee'
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {req.status === 'approuvee'
                      ? 'Approuvée'
                      : req.status === 'refusee'
                      ? 'Refusée'
                      : 'En attente'}
                  </div>
                  <div className="text-slate-400 dark:text-[#C8C2D0] font-mono">
                    {formatDateTimeFr(req.requestedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {dailySummaries.length > 0 && (
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Relevé journalier
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Prévu / Réel</th>
                  <th className="py-3 px-4 text-right">Présence</th>
                  <th className="py-3 px-4 text-right">Productif</th>
                  <th className="py-3 px-4 text-right">Pauses</th>
                  <th className="py-3 px-5 text-right">Ponctualité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
                {dailySummaries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70 transition-colors"
                  >
                    <td className="py-3 px-5 font-medium text-slate-900 dark:text-white capitalize whitespace-nowrap">
                      {formatDateFr(entry.date)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 dark:text-[#C8C2D0] whitespace-nowrap">
                      <div>
                        Prévu : {entry.plannedStart} – {entry.plannedEnd}
                      </div>
                      <div>
                        Réel : {entry.shiftStart} – {entry.shiftEnd}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-800 dark:text-white whitespace-nowrap">
                      {formatDurationHM(entry.presenceSeconds)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] whitespace-nowrap">
                      {formatDurationHM(entry.productiveSeconds)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {formatDurationHM(entry.pauseSeconds)}
                    </td>
                    <td className="py-3 px-5 text-right text-xs whitespace-nowrap">
                      {entry.lateMinutes > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          Retard {entry.lateMinutes} min
                        </span>
                      ) : entry.earlyLeaveMinutes > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          Départ anticipé {entry.earlyLeaveMinutes} min
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          Conforme
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setSelectedActivity(null)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleSubmitCorrection}
            className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl z-10"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Demande de correction
              </h3>
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-600 dark:text-[#C8C2D0] bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-3">
              <div className="font-semibold text-slate-900 dark:text-white">
                {selectedActivity.taskTitle}
              </div>
              <div className="font-mono mt-0.5">
                {selectedActivity.dossierRef} · {formatTimeShort(selectedActivity.startedAt)} –{' '}
                {formatTimeShort(selectedActivity.endedAt)}
              </div>
            </div>
            <div>
              <label
                htmlFor="corr-reason"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Motif et correction souhaitée{' '}
                <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <textarea
                id="corr-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. Oubli d'arrêt du chronomètre lors d'un appel..."
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50"
              />
            </div>
            {formError && <div className="text-xs text-red-600 dark:text-red-400">{formError}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Transmettre</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
