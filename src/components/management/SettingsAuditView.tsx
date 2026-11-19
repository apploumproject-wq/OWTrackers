import React, { useState } from 'react';
import { Save, ShieldAlert } from 'lucide-react';
import {
  AuditLogEntry,
  GlobalAdminConfig,
  Permission,
  ThemeMode,
} from '../../core/types';
import {
  CONFIGURABLE_SUPERVISOR_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
} from '../../core/permissions';
import { formatDateTimeFr } from '../../utils/formatters';
import { SectionHeader, ThemeSelectorControl } from '../ui/DataPrimitives';

interface SettingsAuditViewProps {
  adminConfig: GlobalAdminConfig;
  supervisorPermissions: Permission[];
  auditLogs: AuditLogEntry[];
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  onSaveAdminConfig: (config: GlobalAdminConfig) => void;
  onSaveSupervisorPermissions: (perms: Permission[]) => void;
}

export function SettingsAuditView({
  adminConfig,
  supervisorPermissions,
  auditLogs,
  theme,
  onChangeTheme,
  onSaveAdminConfig,
  onSaveSupervisorPermissions,
}: SettingsAuditViewProps) {
  const [lunchMinutes, setLunchMinutes] = useState<number>(adminConfig.lunchBreakMinutes);
  const [lateTolerance, setLateTolerance] = useState<number>(adminConfig.lateToleranceMinutes);
  const [draftSupPerms, setDraftSupPerms] = useState<Permission[]>(supervisorPermissions);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const toggleSupPerm = (perm: Permission) => {
    setDraftSupPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAdminConfig({
      ...adminConfig,
      lunchBreakMinutes: Math.max(15, Math.min(120, lunchMinutes)),
      lateToleranceMinutes: Math.max(0, Math.min(30, lateTolerance)),
    });
    setSavedBanner('Paramètres enregistrés.');
  };

  const handleSaveSupPerms = () => {
    onSaveSupervisorPermissions(draftSupPerms);
    setSavedBanner('Permissions superviseur enregistrées.');
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Administration & traçabilité" />

      {savedBanner && (
        <div className="bg-[#F7EEFC] dark:bg-[#A83CE2]/15 border border-[#A83CE2]/30 text-[#7624A8] dark:text-[#D896FF] rounded-lg px-4 py-2.5 text-xs font-medium">
          {savedBanner}
        </div>
      )}

      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Apparence de l’interface
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5">
            Préférence enregistrée individuellement pour votre compte.
          </p>
        </div>
        <div className="w-full sm:w-80">
          <ThemeSelectorControl theme={theme} onChangeTheme={onChangeTheme} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveConfig}
          className="lg:col-span-5 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Pauses & ponctualité
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label
                htmlFor="cfg-lunch"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Pause déjeuner (min)
              </label>
              <input
                id="cfg-lunch"
                type="number"
                min={15}
                max={120}
                value={lunchMinutes}
                onChange={(e) => setLunchMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>
            <div>
              <label
                htmlFor="cfg-late"
                className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1"
              >
                Tolérance retard (min)
              </label>
              <input
                id="cfg-late"
                type="number"
                min={0}
                max={30}
                value={lateTolerance}
                onChange={(e) => setLateTolerance(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
              />
            </div>
          </div>
          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Enregistrer</span>
            </button>
          </div>
        </form>

        <section className="lg:col-span-7 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Permissions configurables des superviseurs
            </h2>
            <button
              type="button"
              onClick={handleSaveSupPerms}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Appliquer</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {CONFIGURABLE_SUPERVISOR_PERMISSIONS.map((perm) => (
              <label
                key={perm}
                className="flex items-center justify-between p-2.5 bg-white dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-[#17151C]"
              >
                <span className="text-slate-800 dark:text-white font-medium">
                  {PERMISSION_LABELS[perm]}
                </span>
                <input
                  type="checkbox"
                  checked={draftSupPerms.includes(perm)}
                  onChange={() => toggleSupPerm(perm)}
                  className="w-4 h-4 accent-[#A83CE2]"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#C8C2D0] pt-1">
            <ShieldAlert className="w-3.5 h-3.5 text-[#7624A8] dark:text-[#D896FF] shrink-0" aria-hidden="true" />
            <span>
              Stockage local de test : les droits définitifs doivent être vérifiés côté serveur (PostgreSQL).
            </span>
          </div>
        </section>
      </div>

      {/* Journal de traçabilité administrative */}
      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Journal de traçabilité ({auditLogs.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                <th className="py-3 px-5">Date & Heure</th>
                <th className="py-3 px-4">Acteur</th>
                <th className="py-3 px-4">Élément</th>
                <th className="py-3 px-4">Avant</th>
                <th className="py-3 px-4">Après</th>
                <th className="py-3 px-5">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-xs">
              {auditLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 px-5 text-center text-slate-500 dark:text-[#C8C2D0]"
                  >
                    Aucune entrée dans le journal pour le moment.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F7EEFC]/30 dark:hover:bg-[#211E27]/70">
                    <td className="py-3 px-5 font-mono text-slate-600 dark:text-[#C8C2D0] whitespace-nowrap">
                      {formatDateTimeFr(log.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {log.actorName}
                      </div>
                      <div className="text-[11px] text-[#7624A8] dark:text-[#D896FF]">
                        {ROLE_LABELS[log.actorRole]}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">
                      {log.entity}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-[#C8C2D0]">{log.oldValue}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {log.newValue}
                    </td>
                    <td className="py-3 px-5 text-slate-600 dark:text-[#C8C2D0]">
                      {log.reason ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
