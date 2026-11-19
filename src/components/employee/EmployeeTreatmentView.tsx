import React, { useMemo, useState } from 'react';
import { Play, Square, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import {
  ActivityRecord,
  CompanyRecord,
  EmployeeShiftState,
  NavModuleId,
  ReceptionChannel,
  TaskRecord,
} from '../../core/types';
import { formatDurationHMS, formatTimeWithSeconds } from '../../utils/formatters';
import { SectionHeader } from '../ui/DataPrimitives';

interface EmployeeTreatmentViewProps {
  shiftState: EmployeeShiftState;
  nowMs: number;
  companies: CompanyRecord[];
  tasks: TaskRecord[];
  companyTaskMap: Record<string, string[]>;
  lastSavedActivity: ActivityRecord | null;
  onStartTreatment: () => string | null;
  onUpdateTimerFields: (patch: {
    taskId?: string;
    taskTitle?: string;
    companyId?: string;
    clientName?: string;
    receptionChannel?: ReceptionChannel;
    receptionDateTime?: string;
    recipientEmail?: string;
    teamsRequesterName?: string;
    dossierRef?: string;
    notes?: string;
  }) => void;
  onCompleteTimer: () => string[] | null;
  onNavigate: (moduleId: NavModuleId) => void;
}

export function EmployeeTreatmentView({
  shiftState,
  nowMs,
  companies,
  tasks,
  companyTaskMap,
  lastSavedActivity,
  onStartTreatment,
  onUpdateTimerFields,
  onCompleteTimer,
  onNavigate,
}: EmployeeTreatmentViewProps) {
  const [startError, setStartError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const activeTimer = shiftState.activeTimer;
  const isTreatmentActive = activeTimer?.type === 'traitement';
  const isOtherActivityActive = Boolean(activeTimer && activeTimer.type !== 'traitement');

  const activeCompanies = useMemo(() => companies.filter((c) => !c.archived), [companies]);
  const activeTasks = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);

  const availableTasksForSelectedCompany = useMemo(() => {
    if (!activeTimer?.companyId) return activeTasks;
    const allowedIds = companyTaskMap[activeTimer.companyId];
    if (!allowedIds) return activeTasks;
    return activeTasks.filter((t) => allowedIds.includes(t.id));
  }, [activeTimer?.companyId, activeTasks, companyTaskMap]);

  const elapsedSeconds =
    isTreatmentActive && activeTimer
      ? Math.max(0, Math.round((nowMs - new Date(activeTimer.startedAt).getTime()) / 1000))
      : 0;

  const handleStartClick = () => {
    setValidationErrors([]);
    const err = onStartTreatment();
    setStartError(err);
  };

  const handleTerminateClick = () => {
    const errors = onCompleteTimer();
    if (errors && errors.length > 0) {
      setValidationErrors(errors);
    } else {
      setValidationErrors([]);
    }
  };

  const handleCompanyChange = (companyId: string) => {
    const comp = activeCompanies.find((c) => c.id === companyId);
    const allowedIds = companyTaskMap[companyId];
    const currentTaskStillAllowed =
      !activeTimer?.taskId || !allowedIds || allowedIds.includes(activeTimer.taskId);

    onUpdateTimerFields({
      companyId,
      clientName: comp?.name ?? '',
      ...(currentTaskStillAllowed ? {} : { taskId: '', taskTitle: '' }),
    });
  };

  const handleTaskChange = (taskId: string) => {
    const task = availableTasksForSelectedCompany.find((t) => t.id === taskId);
    onUpdateTimerFields({
      taskId,
      taskTitle: task?.name ?? '',
    });
  };

  const inputClass =
    'w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50';

  return (
    <div className="space-y-6">
      <SectionHeader title="Traitement" />

      {isOtherActivityActive && activeTimer && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Chronomètre actif : {activeTimer.taskTitle} (depuis{' '}
              {formatTimeWithSeconds(activeTimer.startedAt)}).
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('employee_activities')}
            className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            Ouvrir l’activité
          </button>
        </div>
      )}

      {startError && (
        <div
          role="alert"
          className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
          <span>{startError}</span>
        </div>
      )}

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#393342]">
          <div>
            <div
              className={`text-xs font-semibold ${
                isTreatmentActive
                  ? 'text-[#7624A8] dark:text-[#D896FF]'
                  : 'text-slate-500 dark:text-[#C8C2D0]'
              }`}
            >
              {isTreatmentActive ? 'Traitement en cours' : 'Prêt'}
            </div>
            <div
              className={`mt-1 text-4xl font-bold font-mono tabular-nums tracking-tight ${
                isTreatmentActive ? 'text-[#A83CE2]' : 'text-slate-900 dark:text-white'
              }`}
            >
              {formatDurationHMS(elapsedSeconds)}
            </div>
            {isTreatmentActive && activeTimer && (
              <div className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-1">
                Début :{' '}
                <span className="font-mono font-medium text-slate-700 dark:text-white">
                  {formatTimeWithSeconds(activeTimer.startedAt)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isTreatmentActive ? (
              <button
                type="button"
                disabled={isOtherActivityActive}
                onClick={handleStartClick}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  isOtherActivityActive
                    ? 'bg-slate-200 dark:bg-[#211E27] text-slate-400 dark:text-[#C8C2D0]/50 cursor-not-allowed'
                    : 'bg-[#A83CE2] hover:bg-[#7624A8] text-white cursor-pointer'
                }`}
              >
                <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Commencer un traitement</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTerminateClick}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7624A8] hover:bg-[#A83CE2] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Square className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Terminer</span>
              </button>
            )}
          </div>
        </div>

        {validationErrors.length > 0 && isTreatmentActive && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg p-4 space-y-1.5"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
              <span>Champs obligatoires manquants :</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300 space-y-0.5 pl-1">
              {validationErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {isTreatmentActive && activeTimer && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="trt-client"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Entreprise cliente <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <select
                id="trt-client"
                value={activeTimer.companyId ?? ''}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Sélectionner une société...</option>
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="trt-task"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Type de tâche <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <select
                id="trt-task"
                value={activeTimer.taskId ?? ''}
                onChange={(e) => handleTaskChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Sélectionner une tâche...</option>
                {availableTasksForSelectedCompany.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5">
                Canal de réception <span className="text-red-600 dark:text-red-400">*</span>
              </span>
              <div className="flex items-center gap-2">
                {(['Mail', 'Teams'] as const).map((channel) => {
                  const selected = activeTimer.receptionChannel === channel;
                  return (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => onUpdateTimerFields({ receptionChannel: channel })}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#A83CE2] bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-white'
                          : 'border-slate-300 dark:border-[#393342] bg-white dark:bg-[#211E27] text-slate-700 dark:text-[#C8C2D0] hover:bg-slate-50 dark:hover:bg-[#332C40]'
                      }`}
                    >
                      {channel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="trt-rec-dt"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Date et heure de réception <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="trt-rec-dt"
                type="datetime-local"
                value={activeTimer.receptionDateTime ?? ''}
                onChange={(e) => onUpdateTimerFields({ receptionDateTime: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label
                htmlFor="trt-email"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                E-mail destinataire
              </label>
              <input
                id="trt-email"
                type="email"
                value={activeTimer.recipientEmail ?? ''}
                onChange={(e) => onUpdateTimerFields({ recipientEmail: e.target.value })}
                placeholder="facultatif"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="trt-teams"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Demandeur Teams
              </label>
              <input
                id="trt-teams"
                type="text"
                value={activeTimer.teamsRequesterName ?? ''}
                onChange={(e) => onUpdateTimerFields({ teamsRequesterName: e.target.value })}
                placeholder="facultatif"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="trt-ref"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Référence du dossier <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="trt-ref"
                type="text"
                value={activeTimer.dossierRef ?? ''}
                onChange={(e) => onUpdateTimerFields({ dossierRef: e.target.value })}
                placeholder="Ex. COV-2026-4420"
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label
                htmlFor="trt-notes"
                className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
              >
                Commentaire
              </label>
              <input
                id="trt-notes"
                type="text"
                value={activeTimer.notes}
                onChange={(e) => onUpdateTimerFields({ notes: e.target.value })}
                placeholder="facultatif"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {lastSavedActivity && lastSavedActivity.type === 'traitement' && !isTreatmentActive && (
          <div className="flex items-center gap-2.5 text-xs text-[#7624A8] dark:text-[#D896FF] bg-[#F7EEFC] dark:bg-[#A83CE2]/15 border border-[#A83CE2]/25 dark:border-[#A83CE2]/40 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-[#A83CE2] shrink-0" aria-hidden="true" />
            <span>
              Enregistré : <strong>{lastSavedActivity.clientName}</strong> ·{' '}
              {lastSavedActivity.taskTitle} ({lastSavedActivity.dossierRef}) —{' '}
              {formatDurationHMS(lastSavedActivity.durationSeconds)}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
