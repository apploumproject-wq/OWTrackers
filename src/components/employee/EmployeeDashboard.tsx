import React from 'react';
import {
  Play,
  Power,
  ArrowRight,
  Clock,
  Coffee,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import {
  ActivityRecord,
  AppUser,
  EmployeeScheduleConfig,
  EmployeeShiftState,
  NavModuleId,
  ServiceStatus,
} from '../../core/types';
import {
  computeLateMinutes,
  formatDateLongFr,
  formatDurationHM,
  formatDurationHMS,
  formatTimeShort,
  isSameDayYmd,
  toYmd,
} from '../../utils/formatters';
import {
  QualityStatusText,
  SectionHeader,
  ServiceStatusDisplay,
  StatTile,
} from '../ui/DataPrimitives';

interface EmployeeDashboardProps {
  user: AppUser;
  shiftState: EmployeeShiftState;
  schedule: EmployeeScheduleConfig | null;
  activities: ActivityRecord[];
  nowMs: number;
  livePresenceSeconds: number;
  liveProductiveSeconds: number;
  livePauseSeconds: number;
  lateToleranceMinutes: number;
  onChangeServiceStatus: (status: ServiceStatus) => void;
  onSyncPending: () => void;
  onNavigate: (moduleId: NavModuleId) => void;
}

export function EmployeeDashboard({
  user,
  shiftState,
  schedule,
  activities,
  nowMs,
  livePresenceSeconds,
  liveProductiveSeconds,
  livePauseSeconds,
  lateToleranceMinutes,
  onChangeServiceStatus,
  onSyncPending,
  onNavigate,
}: EmployeeDashboardProps) {
  const todayYmd = toYmd(new Date(nowMs));
  const todayActivities = activities.filter((a) => isSameDayYmd(a.startedAt, todayYmd));
  const treatmentsToday = todayActivities.filter((a) => a.type === 'traitement');

  const dossiersCount = treatmentsToday.length;
  const target = user.dailyTargetDossiers || 35;
  const progressPercent = Math.min(100, Math.round((dossiersCount / target) * 100));
  const productiveRatio =
    livePresenceSeconds > 0
      ? Math.min(100, Math.round((liveProductiveSeconds / livePresenceSeconds) * 100))
      : 0;

  const activeTimer = shiftState.activeTimer;
  const activeElapsedSeconds = activeTimer
    ? Math.max(0, Math.round((nowMs - new Date(activeTimer.startedAt).getTime()) / 1000))
    : 0;

  const pendingSyncCount = activities.filter((a) => a.syncStatus === 'local_en_attente').length;
  const plannedStart = schedule?.plannedStart ?? '08:30';
  const plannedEnd = schedule?.plannedEnd ?? '17:00';
  const lateMinutes = computeLateMinutes(
    shiftState.shiftStartTime,
    plannedStart,
    lateToleranceMinutes
  );

  const recentActivities = activities.slice(0, 6);

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Bonjour, ${user.fullName}`}
        meta={`${formatDateLongFr(new Date(nowMs))} · ${user.teamName ?? user.site}`}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={onSyncPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#F7EEFC] dark:bg-[#A83CE2]/15 hover:bg-[#A83CE2] dark:hover:bg-[#A83CE2] text-[#7624A8] dark:text-[#D896FF] hover:text-white dark:hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Synchroniser ({pendingSyncCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('employee_treatment')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Traitement</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        }
      />

      <section
        aria-label="État du service"
        className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 flex-1">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">État</div>
            <div className="mt-1.5">
              <ServiceStatusDisplay status={shiftState.serviceStatus} />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">Horaire prévu</div>
            <div className="mt-1.5 text-sm font-mono font-semibold text-slate-900 dark:text-white">
              {plannedStart} – {plannedEnd}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">Début de service</div>
            <div className="mt-1.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatTimeShort(shiftState.shiftStartTime)}
            </div>
            {lateMinutes > 0 && (
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                Retard : {lateMinutes} min
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">Jours de repos</div>
            <div className="mt-1.5 text-xs font-medium text-slate-700 dark:text-[#C8C2D0]">
              {schedule?.restDays.join(', ') ?? 'Samedi, Dimanche'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-[#393342] lg:pl-6 shrink-0">
          {shiftState.serviceStatus === 'absent' && (
            <button
              type="button"
              onClick={() => onChangeServiceStatus('present')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Prendre son poste</span>
            </button>
          )}
          {!activeTimer && shiftState.serviceStatus !== 'absent' && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('employee_activities')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-[#211E27] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 hover:text-[#7624A8] dark:hover:text-white text-slate-700 dark:text-[#C8C2D0] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Coffee className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Pause</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('employee_activities')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-[#211E27] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 hover:text-[#7624A8] dark:hover:text-white text-slate-700 dark:text-[#C8C2D0] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Sortie / Autre</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeServiceStatus('absent')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-[#211E27] hover:bg-slate-200 dark:hover:bg-[#393342] text-slate-700 dark:text-[#C8C2D0] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Power className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Fin de service</span>
              </button>
            </>
          )}
        </div>
      </section>

      {activeTimer && (
        <section
          aria-label="Chronomètre actif"
          className="bg-[#F7EEFC] dark:bg-[#292631] border border-[#A83CE2]/35 dark:border-[#A83CE2] rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <Clock className="w-5 h-5 text-[#A83CE2] shrink-0" aria-hidden="true" />
            <div>
              <div className="text-xs font-semibold text-[#7624A8] dark:text-[#D896FF]">
                {activeTimer.type === 'traitement'
                  ? 'Traitement en cours'
                  : activeTimer.type === 'pause'
                  ? activeTimer.taskTitle
                  : `Sortie : ${activeTimer.taskTitle}`}
              </div>
              <div className="text-xs text-slate-700 dark:text-[#C8C2D0] mt-0.5">
                Début : {formatTimeShort(activeTimer.startedAt)}
                {activeTimer.dossierRef ? ` · Réf. ${activeTimer.dossierRef}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-2xl font-bold font-mono tabular-nums text-[#7624A8] dark:text-[#A83CE2]">
              {formatDurationHMS(activeElapsedSeconds)}
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  activeTimer.type === 'traitement'
                    ? 'employee_treatment'
                    : 'employee_activities'
                )
              }
              className="px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Ouvrir
            </button>
          </div>
        </section>
      )}

      <section
        aria-label="Indicateurs du jour"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
      >
        <StatTile
          label="Temps de présence"
          value={formatDurationHMS(livePresenceSeconds)}
          accent="default"
        />
        <StatTile
          label="Temps productif"
          value={formatDurationHMS(liveProductiveSeconds)}
          subtext={`${productiveRatio}% de la présence`}
          accent="primary"
        />
        <StatTile
          label="Durée des pauses"
          value={formatDurationHMS(livePauseSeconds)}
          accent="amber"
        />
        <StatTile
          label="Dossiers traités"
          value={dossiersCount}
          subtext={`Objectif : ${target}`}
          accent="emerald"
        />
        <div className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
              Objectif journalier
            </span>
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-white">
              {dossiersCount} / {target}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#A83CE2]">
            {progressPercent}%
          </div>
          <div className="w-full h-2 bg-[#F7EEFC] dark:bg-[#211E27] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#A83CE2] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Dernières activités
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('employee_history')}
            className="text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] hover:text-[#A83CE2] hover:underline cursor-pointer whitespace-nowrap"
          >
            Historique complet
          </button>
        </div>

        {recentActivities.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
            Aucune activité enregistrée pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                  <th className="py-3 px-5">Activité</th>
                  <th className="py-3 px-4">Société / Référence</th>
                  <th className="py-3 px-4">Horaire</th>
                  <th className="py-3 px-4 text-right">Durée</th>
                  <th className="py-3 px-5 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
                {recentActivities.map((act) => (
                  <tr
                    key={act.id}
                    className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {act.taskTitle}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5 capitalize">
                        {act.type}
                        {act.receptionChannel ? ` · ${act.receptionChannel}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-white text-xs font-medium">
                        {act.clientName}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-[#C8C2D0]">
                        {act.dossierRef}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 dark:text-[#C8C2D0] whitespace-nowrap">
                      {formatTimeShort(act.startedAt)} – {formatTimeShort(act.endedAt)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatDurationHM(act.durationSeconds)}
                      {act.overtimeSeconds && act.overtimeSeconds > 0 ? (
                        <div className="text-[11px] text-red-600 dark:text-red-400 font-normal">
                          +{formatDurationHM(act.overtimeSeconds)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex justify-end">
                        <QualityStatusText status={act.status} />
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
