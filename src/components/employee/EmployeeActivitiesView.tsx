import React, { useState } from 'react';
import {
  Coffee,
  LogOut,
  Play,
  Square,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Lock,
  Send,
} from 'lucide-react';
import {
  ActivityRecord,
  EmployeeShiftState,
  GlobalAdminConfig,
  NavModuleId,
  OutingAuthorizationRequest,
  OutingReason,
  PauseSlot,
} from '../../core/types';
import { OUTING_REASON_CONFIG, PAUSE_SLOT_LABELS } from '../../core/permissions';
import {
  formatDurationHM,
  formatDurationHMS,
  formatTimeShort,
  formatTimeWithSeconds,
  isSameDayYmd,
  toYmd,
} from '../../utils/formatters';
import { QualityStatusText, SectionHeader } from '../ui/DataPrimitives';

interface EmployeeActivitiesViewProps {
  shiftState: EmployeeShiftState;
  nowMs: number;
  adminConfig: GlobalAdminConfig;
  activities: ActivityRecord[];
  usedPausesToday: Partial<Record<PauseSlot, ActivityRecord>>;
  outingRequests: OutingAuthorizationRequest[];
  lastSavedActivity: ActivityRecord | null;
  onStartPause: (slot: PauseSlot) => string | null;
  onStartOuting: (
    reason: OutingReason,
    authReq?: OutingAuthorizationRequest | null
  ) => string | null;
  onUpdateTimerFields: (patch: { customReason?: string; notes?: string }) => void;
  onCompleteTimer: () => string[] | null;
  onCreateOutingRequest: (payload: {
    reason: Extract<OutingReason, 'sortie_medecin' | 'sortie_personnelle'>;
    details: string;
    plannedWindow: string;
  }) => void;
  onNavigate: (moduleId: NavModuleId) => void;
}

export function EmployeeActivitiesView({
  shiftState,
  nowMs,
  adminConfig,
  activities,
  usedPausesToday,
  outingRequests,
  lastSavedActivity,
  onStartPause,
  onStartOuting,
  onUpdateTimerFields,
  onCompleteTimer,
  onCreateOutingRequest,
  onNavigate,
}: EmployeeActivitiesViewProps) {
  const [activeCategory, setActiveCategory] = useState<'pause' | 'sortie'>(() =>
    shiftState.activeTimer?.type === 'sortie' ? 'sortie' : 'pause'
  );
  const [selectedReason, setSelectedReason] = useState<OutingReason>('reunion');
  const [reqWindow, setReqWindow] = useState('');
  const [reqDetails, setReqDetails] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  const activeTimer = shiftState.activeTimer;
  const isPauseRunning = activeTimer?.type === 'pause';
  const isOutingRunning = activeTimer?.type === 'sortie';
  const isTreatmentRunning = activeTimer?.type === 'traitement';
  const anyTimerRunning = Boolean(activeTimer);

  const elapsedSeconds =
    activeTimer && (isPauseRunning || isOutingRunning)
      ? Math.max(0, Math.round((nowMs - new Date(activeTimer.startedAt).getTime()) / 1000))
      : 0;

  const pauseLimitSeconds =
    isPauseRunning && activeTimer?.allowedDurationMinutes
      ? activeTimer.allowedDurationMinutes * 60
      : 0;
  const isPauseOvertime =
    isPauseRunning && pauseLimitSeconds > 0 && elapsedSeconds >= pauseLimitSeconds;
  const pauseOvertimeSeconds = isPauseOvertime ? elapsedSeconds - pauseLimitSeconds : 0;

  const pauseSlots: { slot: PauseSlot; label: string; maxMinutes: number }[] = [
    {
      slot: 'pause_matin',
      label: PAUSE_SLOT_LABELS.pause_matin,
      maxMinutes: adminConfig.morningBreakMinutes,
    },
    {
      slot: 'pause_apres_midi',
      label: PAUSE_SLOT_LABELS.pause_apres_midi,
      maxMinutes: adminConfig.afternoonBreakMinutes,
    },
    {
      slot: 'pause_dejeuner',
      label: PAUSE_SLOT_LABELS.pause_dejeuner,
      maxMinutes: adminConfig.lunchBreakMinutes,
    },
  ];

  const todayYmd = toYmd(new Date(nowMs));
  const todayNonTreatments = activities.filter(
    (a) => a.type !== 'traitement' && isSameDayYmd(a.startedAt, todayYmd)
  );

  const selectedReasonConfig = OUTING_REASON_CONFIG[selectedReason];
  const latestMatchingAuth = outingRequests.find(
    (r) => r.reason === selectedReason && (r.status === 'approuvee' || r.status === 'en_attente')
  );

  const handlePauseClick = (slot: PauseSlot) => {
    setValidationErrors([]);
    const err = onStartPause(slot);
    setActionError(err);
  };

  const handleStartOutingClick = () => {
    setValidationErrors([]);
    const err = onStartOuting(selectedReason, latestMatchingAuth ?? null);
    setActionError(err);
  };

  const handleCompleteClick = () => {
    const errors = onCompleteTimer();
    if (errors && errors.length > 0) {
      setValidationErrors(errors);
    } else {
      setValidationErrors([]);
    }
  };

  const handleSubmitAuthRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReason !== 'sortie_medecin' && selectedReason !== 'sortie_personnelle') return;
    if (!reqDetails.trim()) {
      setActionError('Veuillez préciser le motif pour la demande.');
      return;
    }
    onCreateOutingRequest({
      reason: selectedReason,
      details: reqDetails,
      plannedWindow: reqWindow || 'Immédiat',
    });
    setActionError(null);
    setReqDetails('');
    setReqWindow('');
    setRequestNotice('Demande envoyée au superviseur.');
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Mes activités" />

      {isTreatmentRunning && activeTimer && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>Un traitement est en cours. Terminez-le avant de lancer une autre activité.</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('employee_treatment')}
            className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
          >
            Ouvrir le traitement
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="flex items-center gap-2 p-1 bg-slate-200/70 dark:bg-[#211E27] rounded-lg w-fit border border-transparent dark:border-[#393342]">
        <button
          type="button"
          onClick={() => setActiveCategory('pause')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer ${
            activeCategory === 'pause'
              ? 'bg-[#A83CE2] text-white shadow-sm'
              : 'text-slate-700 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white'
          }`}
        >
          <Coffee className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>A. Pause</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('sortie')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer ${
            activeCategory === 'sortie'
              ? 'bg-[#A83CE2] text-white shadow-sm'
              : 'text-slate-700 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>B. Sortie et autre</span>
        </button>
      </div>

      {(isPauseRunning || isOutingRunning) && activeTimer && (
        <section className="bg-white dark:bg-[#292631] border-2 border-[#A83CE2] rounded-lg p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-[#7624A8] dark:text-[#D896FF]">
                {activeTimer.taskTitle}
              </div>
              <div className="mt-1 text-4xl font-bold font-mono tabular-nums text-[#A83CE2]">
                {formatDurationHMS(elapsedSeconds)}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-1">
                Début :{' '}
                <span className="font-mono font-medium text-slate-700 dark:text-white">
                  {formatTimeWithSeconds(activeTimer.startedAt)}
                </span>
                {isPauseRunning && activeTimer.allowedDurationMinutes && (
                  <span> · Durée autorisée : {activeTimer.allowedDurationMinutes} min</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCompleteClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7624A8] hover:bg-[#A83CE2] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Square className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Terminer</span>
            </button>
          </div>

          {isPauseOvertime && (
            <div
              role="alert"
              className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200"
            >
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-semibold">
                  Dépassement ({activeTimer.allowedDurationMinutes} min max) :{' '}
                </span>
                <span className="font-mono font-semibold">
                  +{formatDurationHMS(pauseOvertimeSeconds)}
                </span>
              </div>
            </div>
          )}

          {isOutingRunning && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-[#393342]">
              {activeTimer.outingReason === 'autre' && (
                <div>
                  <label
                    htmlFor="out-custom"
                    className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
                  >
                    Préciser le motif <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="out-custom"
                    type="text"
                    value={activeTimer.customReason ?? ''}
                    onChange={(e) => onUpdateTimerFields({ customReason: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                  />
                </div>
              )}
              <div className={activeTimer.outingReason === 'autre' ? '' : 'md:col-span-2'}>
                <label
                  htmlFor="out-notes"
                  className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
                >
                  Notes
                </label>
                <input
                  id="out-notes"
                  type="text"
                  value={activeTimer.notes}
                  onChange={(e) => onUpdateTimerFields({ notes: e.target.value })}
                  placeholder="facultatif"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50"
                />
              </div>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div
              role="alert"
              className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg p-3 text-xs text-red-700 dark:text-red-200"
            >
              {validationErrors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeCategory === 'pause' && (
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">A. Pause</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pauseSlots.map(({ slot, label, maxMinutes }) => {
              const alreadyUsed = usedPausesToday[slot];
              const disabled = Boolean(alreadyUsed) || anyTimerRunning;
              return (
                <div
                  key={slot}
                  className={`border rounded-lg p-5 flex flex-col justify-between gap-4 ${
                    alreadyUsed
                      ? 'bg-slate-50 dark:bg-[#211E27] border-slate-200 dark:border-[#393342]'
                      : 'bg-white dark:bg-[#211E27] border-slate-200 dark:border-[#393342]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                        {label}
                      </h3>
                      <span className="font-mono text-xs font-semibold text-[#7624A8] dark:text-[#D896FF]">
                        {maxMinutes} min
                      </span>
                    </div>

                    {alreadyUsed ? (
                      <div className="mt-3 text-xs text-slate-600 dark:text-[#C8C2D0] space-y-1">
                        <div className="font-medium text-emerald-700 dark:text-emerald-400">
                          Utilisée
                        </div>
                        <div className="font-mono tabular-nums">
                          {formatTimeShort(alreadyUsed.startedAt)} –{' '}
                          {formatTimeShort(alreadyUsed.endedAt)} (
                          {formatDurationHM(alreadyUsed.durationSeconds)})
                        </div>
                        {alreadyUsed.overtimeSeconds && alreadyUsed.overtimeSeconds > 0 ? (
                          <div className="text-red-600 dark:text-red-400 font-medium">
                            Dépassement : +{formatDurationHM(alreadyUsed.overtimeSeconds)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500 dark:text-[#C8C2D0]">
                        Disponible
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handlePauseClick(slot)}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      disabled
                        ? 'bg-slate-200 dark:bg-[#393342] text-slate-400 dark:text-[#C8C2D0]/50 cursor-not-allowed'
                        : 'bg-[#A83CE2] hover:bg-[#7624A8] text-white cursor-pointer'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{alreadyUsed ? 'Prise' : 'Commencer'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeCategory === 'sortie' && (
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-6 space-y-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            B. Sortie et autre
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Object.keys(OUTING_REASON_CONFIG) as OutingReason[]).map((reasonKey) => {
              const cfg = OUTING_REASON_CONFIG[reasonKey];
              const isSelected = selectedReason === reasonKey;
              return (
                <button
                  key={reasonKey}
                  type="button"
                  disabled={anyTimerRunning}
                  onClick={() => {
                    setSelectedReason(reasonKey);
                    setRequestNotice(null);
                  }}
                  className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#A83CE2] bg-[#F7EEFC] dark:bg-[#A83CE2]/20'
                      : 'border-slate-200 dark:border-[#393342] bg-white dark:bg-[#211E27] hover:bg-slate-50 dark:hover:bg-[#332C40]'
                  } ${anyTimerRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      {cfg.label}
                    </span>
                    {cfg.requiresAuthorization && (
                      <span className="text-[11px] font-medium text-[#7624A8] dark:text-[#D896FF]">
                        Autorisation
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedReasonConfig.requiresAuthorization && !anyTimerRunning && (
            <div className="bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Demande d’autorisation ({selectedReasonConfig.label})
                </span>
                <span className="font-semibold text-[#7624A8] dark:text-[#D896FF]">
                  {latestMatchingAuth
                    ? latestMatchingAuth.status === 'approuvee'
                      ? 'Approuvée'
                      : 'En attente'
                    : 'Aucune demande'}
                </span>
              </div>

              <form onSubmit={handleSubmitAuthRequest} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={reqWindow}
                  onChange={(e) => setReqWindow(e.target.value)}
                  placeholder="Créneau (ex. 14:30 – 16:00)"
                  className="px-3 py-2 text-xs bg-white dark:bg-[#292631] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50"
                />
                <input
                  type="text"
                  value={reqDetails}
                  onChange={(e) => setReqDetails(e.target.value)}
                  placeholder="Motif détaillé"
                  className="px-3 py-2 text-xs bg-white dark:bg-[#292631] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF] border border-[#A83CE2]/40 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Demander</span>
                </button>
              </form>

              {requestNotice && (
                <div className="text-xs text-[#7624A8] dark:text-[#D896FF] font-medium">
                  {requestNotice}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100 dark:border-[#393342]">
            <span className="text-xs text-slate-500 dark:text-[#C8C2D0]">
              Motif : <strong className="text-slate-800 dark:text-white">{selectedReasonConfig.label}</strong>
            </span>
            <button
              type="button"
              disabled={anyTimerRunning}
              onClick={handleStartOutingClick}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                anyTimerRunning
                  ? 'bg-slate-200 dark:bg-[#393342] text-slate-400 dark:text-[#C8C2D0]/50 cursor-not-allowed'
                  : 'bg-[#A83CE2] hover:bg-[#7624A8] text-white cursor-pointer'
              }`}
            >
              <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Commencer</span>
            </button>
          </div>
        </section>
      )}

      {lastSavedActivity && lastSavedActivity.type !== 'traitement' && !anyTimerRunning && (
        <div className="flex items-center gap-2.5 text-xs text-[#7624A8] dark:text-[#D896FF] bg-[#F7EEFC] dark:bg-[#A83CE2]/15 border border-[#A83CE2]/25 dark:border-[#A83CE2]/40 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-[#A83CE2] shrink-0" aria-hidden="true" />
          <span>
            Enregistré : <strong>{lastSavedActivity.taskTitle}</strong> —{' '}
            {formatDurationHMS(lastSavedActivity.durationSeconds)}
          </span>
        </div>
      )}

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Activités du jour
          </h2>
        </div>
        {todayNonTreatments.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
            Aucune pause ni sortie enregistrée aujourd’hui.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                  <th className="py-3 px-5">Catégorie</th>
                  <th className="py-3 px-4">Motif</th>
                  <th className="py-3 px-4">Horaire</th>
                  <th className="py-3 px-4 text-right">Durée</th>
                  <th className="py-3 px-5 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
                {todayNonTreatments.map((act) => (
                  <tr key={act.id} className="hover:bg-[#F7EEFC]/40 dark:hover:bg-[#211E27]/70">
                    <td className="py-3 px-5 text-xs font-semibold text-slate-700 dark:text-[#C8C2D0] capitalize">
                      {act.type}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {act.taskTitle}
                      </div>
                      {act.notes && (
                        <div className="text-xs text-slate-500 dark:text-[#C8C2D0]">{act.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 dark:text-[#C8C2D0] whitespace-nowrap">
                      {formatTimeShort(act.startedAt)} – {formatTimeShort(act.endedAt)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-[#7624A8] dark:text-[#D896FF] whitespace-nowrap">
                      {formatDurationHM(act.durationSeconds)}
                    </td>
                    <td className="py-3 px-5 text-right text-xs">
                      {act.overtimeSeconds && act.overtimeSeconds > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          +{formatDurationHM(act.overtimeSeconds)} dépassement
                        </span>
                      ) : act.authorizationStatus && act.authorizationStatus !== 'non_requise' ? (
                        <span className="text-slate-700 dark:text-[#C8C2D0] capitalize">
                          {act.authorizationStatus.replace('_', ' ')}
                        </span>
                      ) : (
                        <div className="inline-flex justify-end">
                          <QualityStatusText status={act.status} />
                        </div>
                      )}
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
