import React from 'react';
import {
  AppUser,
  EmployeeScheduleConfig,
  Permission,
  ThemeMode,
} from '../../core/types';
import {
  getPermissionsForRole,
  PERMISSION_LABELS,
  ROLE_LABELS,
} from '../../core/permissions';
import { formatDateFr } from '../../utils/formatters';
import { SectionHeader, ThemeSelectorControl } from '../ui/DataPrimitives';

interface ProfileViewProps {
  user: AppUser;
  supervisorPermissions: Permission[];
  schedule: EmployeeScheduleConfig | null;
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
}

export function ProfileView({
  user,
  supervisorPermissions,
  schedule,
  theme,
  onChangeTheme,
}: ProfileViewProps) {
  const grantedPermissions = getPermissionsForRole(user.role, supervisorPermissions);
  const displaySchedule = schedule
    ? `${schedule.plannedStart} – ${schedule.plannedEnd}`
    : user.plannedSchedule;

  return (
    <div className="space-y-6">
      <SectionHeader title="Mon profil" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-6">
          <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-6 space-y-5">
            <div className="pb-4 border-b border-slate-200 dark:border-[#393342] flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {user.fullName}
                </h2>
                <p className="text-sm text-slate-600 dark:text-[#C8C2D0] mt-0.5">
                  {user.jobTitle}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#7624A8] dark:text-[#D896FF]">
                {user.matricule}
              </span>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Rôle</dt>
                <dd className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {ROLE_LABELS[user.role]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Identifiant</dt>
                <dd className="font-mono text-xs text-slate-800 dark:text-white mt-1 break-all">
                  {user.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Site</dt>
                <dd className="font-medium text-slate-900 dark:text-white mt-0.5">{user.site}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Périmètre</dt>
                <dd className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {user.perimeterName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Horaire planifié</dt>
                <dd className="font-medium font-mono text-slate-900 dark:text-white mt-0.5">
                  {displaySchedule}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Date d’entrée</dt>
                <dd className="font-medium text-slate-900 dark:text-white mt-0.5 capitalize">
                  {formatDateFr(user.hireDate)}
                </dd>
              </div>
              {schedule?.restDays && (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Jours de repos</dt>
                  <dd className="font-medium text-slate-900 dark:text-white mt-0.5">
                    {schedule.restDays.join(', ')}
                  </dd>
                </div>
              )}
              {user.supervisorName && (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Superviseur</dt>
                  <dd className="font-medium text-slate-900 dark:text-white mt-0.5">
                    {user.supervisorName}
                  </dd>
                </div>
              )}
              {user.managerName && (
                <div>
                  <dt className="text-xs text-slate-500 dark:text-[#C8C2D0]">Manager</dt>
                  <dd className="font-medium text-slate-900 dark:text-white mt-0.5">
                    {user.managerName}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Apparence de l’interface
            </h2>
            <ThemeSelectorControl theme={theme} onChangeTheme={onChangeTheme} />
          </section>
        </div>

        <section className="lg:col-span-6 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-6 space-y-4 h-fit">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Permissions actives ({ROLE_LABELS[user.role]})
          </h2>

          <ul className="divide-y divide-slate-100 dark:divide-[#393342] border-t border-slate-100 dark:border-[#393342] text-xs">
            {grantedPermissions.map((perm) => (
              <li key={perm} className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-slate-800 dark:text-white">{PERMISSION_LABELS[perm]}</span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-[#C8C2D0] shrink-0">
                  {perm}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
