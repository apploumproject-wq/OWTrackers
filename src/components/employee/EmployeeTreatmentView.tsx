import React, { useMemo, useState } from 'react';
import { Play, Square, CheckCircle2, AlertCircle, Lock, FolderKanban } from 'lucide-react';
import {
  ActivityRecord,
  CustomFieldValue,
  EmployeeShiftState,
  NavModuleId,
  ProjectFormField,
  ProjectRecord,
} from '../../core/types';
import { formatDurationHMS, formatTimeWithSeconds } from '../../utils/formatters';
import { SectionHeader } from '../ui/DataPrimitives';

interface EmployeeTreatmentViewProps {
  shiftState: EmployeeShiftState;
  nowMs: number;
  projects: ProjectRecord[];
  allProjectsCount: number;
  lastSavedActivity: ActivityRecord | null;
  onStartTreatment: (projectId?: string) => string | null;
  onUpdateTimerFields: (patch: {
    companyId?: string;
    clientName?: string;
    taskId?: string;
    taskTitle?: string;
    customResponses?: Record<string, CustomFieldValue>;
  }) => void;
  onCompleteTimer: () => string[] | null;
  onNavigate: (moduleId: NavModuleId) => void;
}

export function EmployeeTreatmentView({
  shiftState,
  nowMs,
  projects,
  allProjectsCount,
  lastSavedActivity,
  onStartTreatment,
  onUpdateTimerFields,
  onCompleteTimer,
  onNavigate,
}: EmployeeTreatmentViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    () => projects[0]?.id ?? ''
  );
  const [startError, setStartError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const activeTimer = shiftState.activeTimer;
  const isTreatmentActive = activeTimer?.type === 'traitement';
  const isOtherActivityActive = Boolean(activeTimer && activeTimer.type !== 'traitement');

  const effectiveSelectedProject = useMemo(() => {
    if (projects.length === 0) return null;
    return projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  }, [projects, selectedProjectId]);

  const previewFormVersion = useMemo(() => {
    if (!effectiveSelectedProject || !effectiveSelectedProject.formVersions?.length) return null;
    return (
      effectiveSelectedProject.formVersions.find(
        (v) => v.id === effectiveSelectedProject.currentFormVersionId
      ) ??
      effectiveSelectedProject.formVersions[effectiveSelectedProject.formVersions.length - 1] ??
      null
    );
  }, [effectiveSelectedProject]);

  const previewActiveFields = useMemo(() => {
    if (!previewFormVersion) return [];
    return [...previewFormVersion.fields]
      .filter((f) => f.active)
      .sort((a, b) => a.order - b.order);
  }, [previewFormVersion]);

  const activeCustomFields = useMemo(() => {
    if (!activeTimer?.formFieldsSnapshot) return [];
    return [...activeTimer.formFieldsSnapshot]
      .filter((f) => f.active)
      .sort((a, b) => a.order - b.order);
  }, [activeTimer?.formFieldsSnapshot]);

  const elapsedSeconds =
    isTreatmentActive && activeTimer
      ? Math.max(0, Math.round((nowMs - new Date(activeTimer.startedAt).getTime()) / 1000))
      : 0;

  const noProjectsConfigured = allProjectsCount === 0;
  const noAssignedProjectBlocked = allProjectsCount > 0 && projects.length === 0;
  const previewCompaniesCount = effectiveSelectedProject?.companies?.length ?? 0;
  const previewTasksCount = effectiveSelectedProject?.tasks?.length ?? 0;
  const hasNoPublishedForm =
    Boolean(effectiveSelectedProject) &&
    (!previewFormVersion ||
      (previewActiveFields.length === 0 &&
        previewCompaniesCount === 0 &&
        previewTasksCount === 0));

  const canStartTreatment =
    !isOtherActivityActive &&
    !noProjectsConfigured &&
    !noAssignedProjectBlocked &&
    Boolean(effectiveSelectedProject) &&
    !hasNoPublishedForm;

  const handleStartClick = () => {
    setValidationErrors([]);
    const err = onStartTreatment(effectiveSelectedProject?.id);
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

  const handleCustomFieldChange = (fieldId: string, value: CustomFieldValue) => {
    onUpdateTimerFields({
      customResponses: {
        [fieldId]: value,
      },
    });
  };

  const handleCheckboxToggle = (field: ProjectFormField, optionValue: string, checked: boolean) => {
    const currentRaw = activeTimer?.customResponses?.[field.id];
    const currentArr = Array.isArray(currentRaw) ? [...currentRaw] : [];
    const nextArr = checked
      ? Array.from(new Set([...currentArr, optionValue]))
      : currentArr.filter((v) => v !== optionValue);
    handleCustomFieldChange(field.id, nextArr);
  };

  const inputClass =
    'w-full px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/50 disabled:opacity-60 disabled:cursor-not-allowed';

  const displayedFields = isTreatmentActive ? activeCustomFields : previewActiveFields;
  const displayedCompanies = isTreatmentActive
    ? activeTimer?.projectCompaniesSnapshot ?? []
    : effectiveSelectedProject?.companies ?? [];
  const displayedTasks = isTreatmentActive
    ? activeTimer?.projectTasksSnapshot ?? []
    : effectiveSelectedProject?.tasks ?? [];
  const displayedProjectName = isTreatmentActive
    ? activeTimer?.projectName ?? ''
    : effectiveSelectedProject?.name ?? '';
  const displayedFormVersionNumber = isTreatmentActive
    ? activeTimer?.formVersionNumber ?? 1
    : previewFormVersion?.versionNumber ?? effectiveSelectedProject?.currentFormVersionNumber ?? 1;

  return (
    <div className="space-y-6">
      <SectionHeader title="Traitement" />

      {isOtherActivityActive && activeTimer && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <Lock
              className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
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
          <AlertCircle
            className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0"
            aria-hidden="true"
          />
          <span>{startError}</span>
        </div>
      )}

      {/* Sélection du projet avant le démarrage */}
      {!isTreatmentActive && (
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-[#A83CE2] shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Sélection du projet de traitement
            </h2>
          </div>

          {noProjectsConfigured ? (
            <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3.5">
              Aucun projet n’est encore configuré dans l’application. Contactez votre manager ou administrateur.
            </div>
          ) : noAssignedProjectBlocked ? (
            <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3.5">
              Aucun projet actif ne vous est actuellement affecté. Contactez votre manager ou superviseur.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-5">
                <label
                  htmlFor="trt-project-select"
                  className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
                >
                  Projet affecté <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <select
                  id="trt-project-select"
                  disabled={isOtherActivityActive}
                  value={effectiveSelectedProject?.id ?? ''}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setStartError(null);
                  }}
                  className={inputClass}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
                {effectiveSelectedProject?.description && (
                  <p className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-2">
                    {effectiveSelectedProject.description}
                  </p>
                )}
              </div>

              {effectiveSelectedProject && (
                <div className="lg:col-span-7 bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-3.5 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Formulaire du projet : {effectiveSelectedProject.name}
                    </span>
                    <span className="font-mono font-semibold text-[#7624A8] dark:text-[#D896FF]">
                      v{displayedFormVersionNumber} · {previewCompaniesCount} soc. ·{' '}
                      {previewTasksCount} tâche(s) · {previewActiveFields.length} champ(s)
                    </span>
                  </div>
                  {hasNoPublishedForm ? (
                    <div className="text-amber-800 dark:text-amber-300 font-medium">
                      Aucun formulaire publié actif n’est configuré pour ce projet.
                    </div>
                  ) : (
                    <div className="text-slate-600 dark:text-[#C8C2D0]">
                      Le formulaire ci-dessous s’adapte automatiquement au projet sélectionné. Démarrez le chronomètre pour le renseigner.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
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
              {isTreatmentActive
                ? activeTimer?.projectName
                  ? `Traitement en cours · ${activeTimer.projectName} (v${
                      activeTimer.formVersionNumber ?? 1
                    })`
                  : 'Traitement en cours'
                : effectiveSelectedProject
                ? `Prêt · ${effectiveSelectedProject.name}`
                : 'Prêt'}
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
                disabled={!canStartTreatment}
                onClick={handleStartClick}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  !canStartTreatment
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
              <AlertCircle
                className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0"
                aria-hidden="true"
              />
              <span>Champs obligatoires manquants ou invalides :</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300 space-y-0.5 pl-1">
              {validationErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Formulaire dynamique exclusivement lié au projet sélectionné */}
        {(isTreatmentActive || effectiveSelectedProject) && (
          <div className="space-y-4">
            {displayedFields.length === 0 &&
            displayedCompanies.length === 0 &&
            displayedTasks.length === 0 ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <AlertCircle
                  className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  Ce projet ne possède pas encore de formulaire publié actif. Veuillez contacter votre manager ou administrateur pour configurer ses sociétés, tâches ou champs avant d’effectuer un traitement.
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#7624A8] dark:text-[#D896FF]">
                    Formulaire du projet — {displayedProjectName} (v{displayedFormVersionNumber})
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-[#C8C2D0]">
                    {displayedCompanies.length} société(s) · {displayedTasks.length} tâche(s) ·{' '}
                    {displayedFields.length} champ(s){' '}
                    {!isTreatmentActive ? '· Aperçu avant démarrage' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Champ Société propre au projet */}
                  <div>
                    <label
                      htmlFor="trt-project-company"
                      className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
                    >
                      Société{' '}
                      {displayedCompanies.length > 0 && (
                        <span className="text-red-600 dark:text-red-400">*</span>
                      )}
                    </label>
                    <select
                      id="trt-project-company"
                      disabled={!isTreatmentActive || displayedCompanies.length === 0}
                      value={isTreatmentActive ? activeTimer?.companyId ?? '' : ''}
                      onChange={(e) => {
                        const comp = displayedCompanies.find((c) => c.id === e.target.value);
                        onUpdateTimerFields({
                          companyId: comp?.id ?? '',
                          clientName: comp?.name ?? '',
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="">
                        {displayedCompanies.length === 0
                          ? 'Aucune société configurée pour ce projet'
                          : 'Sélectionner une société...'}
                      </option>
                      {displayedCompanies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {displayedCompanies.length === 0 && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                        Aucune société n’est rattachée à ce projet.
                      </p>
                    )}
                  </div>

                  {/* Champ Tâche propre au projet */}
                  <div>
                    <label
                      htmlFor="trt-project-task"
                      className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
                    >
                      Tâche{' '}
                      {displayedTasks.length > 0 && (
                        <span className="text-red-600 dark:text-red-400">*</span>
                      )}
                    </label>
                    <select
                      id="trt-project-task"
                      disabled={!isTreatmentActive || displayedTasks.length === 0}
                      value={isTreatmentActive ? activeTimer?.taskId ?? '' : ''}
                      onChange={(e) => {
                        const t = displayedTasks.find((item) => item.id === e.target.value);
                        onUpdateTimerFields({
                          taskId: t?.id ?? '',
                          taskTitle: t?.name ?? '',
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="">
                        {displayedTasks.length === 0
                          ? 'Aucune tâche configurée pour ce projet'
                          : 'Sélectionner une tâche...'}
                      </option>
                      {displayedTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {displayedTasks.length === 0 && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                        Aucune tâche n’est rattachée à ce projet.
                      </p>
                    )}
                  </div>

                  {displayedFields.map((field) => {
                    const rawVal = isTreatmentActive
                      ? activeTimer?.customResponses?.[field.id]
                      : undefined;
                    const strVal = typeof rawVal === 'string' ? rawVal : '';
                    const arrVal = Array.isArray(rawVal) ? rawVal : [];
                    const fullSpan =
                      field.type === 'long_text' ||
                      field.type === 'checkbox' ||
                      field.type === 'radio';
                    const isReadOnlyPreview = !isTreatmentActive;

                    return (
                      <div key={field.id} className={fullSpan ? 'md:col-span-2' : ''}>
                        <label
                          htmlFor={`custom-${field.id}`}
                          className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5"
                        >
                          {field.label}{' '}
                          {field.required && (
                            <span className="text-red-600 dark:text-red-400">*</span>
                          )}
                        </label>

                        {field.type === 'short_text' && (
                          <input
                            id={`custom-${field.id}`}
                            type="text"
                            disabled={isReadOnlyPreview}
                            value={strVal}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            className={inputClass}
                          />
                        )}

                        {field.type === 'long_text' && (
                          <textarea
                            id={`custom-${field.id}`}
                            rows={3}
                            disabled={isReadOnlyPreview}
                            value={strVal}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            className={inputClass}
                          />
                        )}

                        {field.type === 'number' && (
                          <input
                            id={`custom-${field.id}`}
                            type="number"
                            step="any"
                            disabled={isReadOnlyPreview}
                            value={strVal}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            className={`${inputClass} font-mono`}
                          />
                        )}

                        {field.type === 'date' && (
                          <input
                            id={`custom-${field.id}`}
                            type="date"
                            disabled={isReadOnlyPreview}
                            value={strVal}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            className={`${inputClass} font-mono`}
                          />
                        )}

                        {field.type === 'time' && (
                          <input
                            id={`custom-${field.id}`}
                            type="time"
                            disabled={isReadOnlyPreview}
                            value={strVal}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            className={`${inputClass} font-mono`}
                          />
                        )}

                        {field.type === 'email' && (
                          <input
                            id={`custom-${field.id}`}
                            type="email"
                            disabled={isReadOnlyPreview}
                            value={strVal}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            placeholder="exemple@domaine.fr"
                            className={inputClass}
                          />
                        )}

                        {field.type === 'select' && (
                          <select
                            id={`custom-${field.id}`}
                            disabled={isReadOnlyPreview}
                            value={strVal}
                            onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                            className={inputClass}
                          >
                            <option value="">Sélectionner...</option>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {field.type === 'radio' && (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {(field.options ?? []).map((opt) => {
                              const checked = strVal === opt;
                              return (
                                <label
                                  key={opt}
                                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                                    isReadOnlyPreview
                                      ? 'opacity-60 cursor-not-allowed'
                                      : 'cursor-pointer'
                                  } ${
                                    checked
                                      ? 'border-[#A83CE2] bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-white font-semibold'
                                      : 'border-slate-300 dark:border-[#393342] bg-white dark:bg-[#211E27] text-slate-700 dark:text-[#C8C2D0]'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    disabled={isReadOnlyPreview}
                                    name={`custom-radio-${field.id}`}
                                    checked={checked}
                                    onChange={() => handleCustomFieldChange(field.id, opt)}
                                    className="accent-[#A83CE2]"
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {field.type === 'checkbox' && (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {(field.options ?? []).length > 0 ? (
                              (field.options ?? []).map((opt) => {
                                const checked = arrVal.includes(opt);
                                return (
                                  <label
                                    key={opt}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                                      isReadOnlyPreview
                                        ? 'opacity-60 cursor-not-allowed'
                                        : 'cursor-pointer'
                                    } ${
                                      checked
                                        ? 'border-[#A83CE2] bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-white font-semibold'
                                        : 'border-slate-300 dark:border-[#393342] bg-white dark:bg-[#211E27] text-slate-700 dark:text-[#C8C2D0]'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={isReadOnlyPreview}
                                      checked={checked}
                                      onChange={(e) =>
                                        handleCheckboxToggle(field, opt, e.target.checked)
                                      }
                                      className="accent-[#A83CE2]"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })
                            ) : (
                              <label
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                                  isReadOnlyPreview
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'cursor-pointer'
                                } ${
                                  arrVal.includes('Oui')
                                    ? 'border-[#A83CE2] bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-white font-semibold'
                                    : 'border-slate-300 dark:border-[#393342] bg-white dark:bg-[#211E27] text-slate-700 dark:text-[#C8C2D0]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isReadOnlyPreview}
                                  checked={arrVal.includes('Oui')}
                                  onChange={(e) =>
                                    handleCheckboxToggle(field, 'Oui', e.target.checked)
                                  }
                                  className="accent-[#A83CE2]"
                                />
                                <span>Oui / Confirmé</span>
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {lastSavedActivity && lastSavedActivity.type === 'traitement' && !isTreatmentActive && (
          <div className="flex items-center gap-2.5 text-xs text-[#7624A8] dark:text-[#D896FF] bg-[#F7EEFC] dark:bg-[#A83CE2]/15 border border-[#A83CE2]/25 dark:border-[#A83CE2]/40 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-[#A83CE2] shrink-0" aria-hidden="true" />
            <span>
              Enregistré :{' '}
              <strong>
                {[
                  lastSavedActivity.projectName
                    ? `${lastSavedActivity.projectName} (v${
                        lastSavedActivity.formVersionNumber ?? 1
                      })`
                    : '',
                  lastSavedActivity.clientName,
                  lastSavedActivity.taskTitle,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </strong>{' '}
              {lastSavedActivity.dossierRef ? `(${lastSavedActivity.dossierRef}) ` : ''}—{' '}
              {formatDurationHMS(lastSavedActivity.durationSeconds)}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
