import React, { useMemo } from 'react';
import {
  ActivityRecord,
  AppUser,
  QualityControlRecord,
  ReferenceTimeEntry,
} from '../../core/types';
import { formatDateFr, formatDurationHM, toYmd } from '../../utils/formatters';
import { QualityControlStatusText, SectionHeader, StatTile } from '../ui/DataPrimitives';

interface EmployeeStatsViewProps {
  user: AppUser;
  activities: ActivityRecord[];
  qualityControls: QualityControlRecord[];
  referenceTimes: ReferenceTimeEntry[];
  livePresenceSeconds: number;
  liveProductiveSeconds: number;
  livePauseSeconds: number;
}

export function EmployeeStatsView({
  user,
  activities,
  qualityControls,
  referenceTimes,
  livePresenceSeconds,
  liveProductiveSeconds,
  livePauseSeconds,
}: EmployeeStatsViewProps) {
  const history = useMemo(() => {
    const map: Record<
      string,
      { id: string; date: string; presenceSeconds: number; productiveSeconds: number }
    > = {};
    for (const act of activities) {
      const ymd = toYmd(new Date(act.startedAt));
      if (!map[ymd]) {
        map[ymd] = { id: ymd, date: ymd, presenceSeconds: 0, productiveSeconds: 0 };
      }
      if (act.type === 'traitement') {
        map[ymd].productiveSeconds += act.durationSeconds;
        map[ymd].presenceSeconds += act.durationSeconds;
      } else if (act.type === 'sortie') {
        map[ymd].presenceSeconds += act.durationSeconds;
      }
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  }, [activities]);
  const treatments = useMemo(() => activities.filter((a) => a.type === 'traitement'), [activities]);

  const totalTreatmentSeconds = treatments.reduce((s, a) => s + a.durationSeconds, 0);
  const avgHandlingSeconds =
    treatments.length > 0 ? Math.round(totalTreatmentSeconds / treatments.length) : 0;

  const hourlyProductivity =
    totalTreatmentSeconds > 0
      ? (treatments.length / (totalTreatmentSeconds / 3600)).toFixed(1)
      : '0.0';

  const occupancyRate =
    livePresenceSeconds > 0
      ? Math.min(100, Math.round((liveProductiveSeconds / livePresenceSeconds) * 100))
      : 0;

  const refEfficiencyPct = useMemo(() => {
    let refTotalSec = 0;
    let actualSec = 0;
    for (const tr of treatments) {
      const refEntry = referenceTimes.find(
        (r) => r.companyId === tr.companyId && r.taskId === tr.taskId
      );
      if (refEntry) {
        refTotalSec += refEntry.referenceMinutes * 60;
        actualSec += tr.durationSeconds;
      }
    }
    if (actualSec === 0) return 100;
    return Math.round((refTotalSec / actualSec) * 100);
  }, [treatments, referenceTimes]);

  const byCompany = useMemo(() => {
    const map: Record<string, { count: number; seconds: number }> = {};
    for (const cur of treatments) {
      if (!map[cur.clientName]) map[cur.clientName] = { count: 0, seconds: 0 };
      map[cur.clientName].count += 1;
      map[cur.clientName].seconds += cur.durationSeconds;
    }
    return Object.entries(map);
  }, [treatments]);

  const byTask = useMemo(() => {
    const map: Record<string, { count: number; seconds: number }> = {};
    for (const cur of treatments) {
      if (!map[cur.taskTitle]) map[cur.taskTitle] = { count: 0, seconds: 0 };
      map[cur.taskTitle].count += 1;
      map[cur.taskTitle].seconds += cur.durationSeconds;
    }
    return Object.entries(map);
  }, [treatments]);

  const myQc = useMemo(
    () => qualityControls.filter((q) => q.employeeId === user.id),
    [qualityControls, user.id]
  );
  const controlledQc = myQc.filter((q) => q.status !== 'en_attente');
  const compliantQc = controlledQc.filter(
    (q) => q.status === 'valide' || q.status === 'valide_observation'
  );
  const complianceRate =
    controlledQc.length > 0 ? Math.round((compliantQc.length / controlledQc.length) * 100) : null;

  const dossiersTodayCount = treatments.filter((t) => {
    const d = new Date(t.startedAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;
  const objectivePct = Math.min(
    100,
    Math.round((dossiersTodayCount / (user.dailyTargetDossiers || 35)) * 100)
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="Mes statistiques" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Dossiers traités (historique)"
          value={treatments.length}
          subtext={`Objectif jour : ${objectivePct}% (${dossiersTodayCount}/${user.dailyTargetDossiers})`}
          accent="primary"
        />
        <StatTile
          label="Temps moyen / dossier"
          value={formatDurationHM(avgHandlingSeconds)}
          subtext={`Productivité horaire : ${hourlyProductivity} doss./h`}
        />
        <StatTile
          label="Indice temps de référence"
          value={`${refEfficiencyPct}%`}
          subtext={`Occupation : ${occupancyRate}% · Pauses : ${formatDurationHM(livePauseSeconds)}`}
        />
        <StatTile
          label="Conformité qualité"
          value={complianceRate !== null ? `${complianceRate}%` : '—'}
          subtext={`${controlledQc.length} contrôlé(s) · ${myQc.length - controlledQc.length} en attente`}
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Présence vs Temps productif
          </h2>

          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-4">
                Aucune activité enregistrée pour le moment.
              </div>
            ) : (
              history.map((day) => {
                const maxSec = Math.max(8 * 3600, day.presenceSeconds);
                const presencePct = Math.min(100, Math.round((day.presenceSeconds / maxSec) * 100));
                const productivePct = Math.min(100, Math.round((day.productiveSeconds / maxSec) * 100));
                return (
                  <div key={day.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-white capitalize">
                        {formatDateFr(day.date)}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600 dark:text-[#C8C2D0]">
                        {formatDurationHM(day.presenceSeconds)} /{' '}
                        {formatDurationHM(day.productiveSeconds)}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-[#211E27] rounded overflow-hidden relative">
                      <div
                        className="h-full bg-slate-300 dark:bg-[#393342] absolute left-0 top-0"
                        style={{ width: `${presencePct}%` }}
                      />
                      <div
                        className="h-full bg-[#A83CE2] absolute left-0 top-0"
                        style={{ width: `${productivePct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-6 pt-2 border-t border-slate-100 dark:border-[#393342] text-xs text-slate-600 dark:text-[#C8C2D0]">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-xs bg-slate-300 dark:bg-[#393342] inline-block"
                aria-hidden="true"
              />
              <span>Présence</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs bg-[#A83CE2] inline-block" aria-hidden="true" />
              <span>Productif</span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Répartition par société
            </h2>
            {byCompany.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-2">
                Aucun traitement enregistré.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#393342]">
                {byCompany.map(([companyName, stats]) => (
                  <div key={companyName} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{companyName}</div>
                      <div className="text-xs text-slate-500 dark:text-[#C8C2D0]">
                        {stats.count} dossier(s)
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white">
                      {formatDurationHM(stats.seconds)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-[#393342]">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Répartition par tâche
            </h2>
            {byTask.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-2">
                Aucun traitement enregistré.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#393342]">
                {byTask.map(([taskName, stats]) => (
                  <div key={taskName} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{taskName}</div>
                      <div className="text-xs text-slate-500 dark:text-[#C8C2D0]">
                        {stats.count} dossier(s)
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-xs font-semibold text-[#7624A8] dark:text-[#D896FF]">
                      {formatDurationHM(stats.seconds)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Résultats de contrôle qualité
          </h2>
          <span className="text-xs text-slate-500 dark:text-[#C8C2D0]">
            {myQc.length} dossier(s)
          </span>
        </div>
        {myQc.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
            Aucun contrôle enregistré.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                  <th className="py-3 px-5">Dossier</th>
                  <th className="py-3 px-4">Société & Tâche</th>
                  <th className="py-3 px-4">Contrôleur</th>
                  <th className="py-3 px-4">Observations</th>
                  <th className="py-3 px-5 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
                {myQc.map((qc) => (
                  <tr key={qc.id} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                    <td className="py-3 px-5 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {qc.dossierRef}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {qc.companyName}
                      </div>
                      <div className="text-slate-500 dark:text-[#C8C2D0]">{qc.taskName}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0]">
                      {qc.controllerName ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#C8C2D0]">
                      {qc.observations || '—'}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex justify-end">
                        <QualityControlStatusText status={qc.status} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
