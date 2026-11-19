import React from 'react';
import {
  CheckCircle2,
  PauseCircle,
  MinusCircle,
  AlertTriangle,
  Clock,
  PlayCircle,
  LogOut,
  XCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { QualityStatus, ServiceStatus, ThemeMode } from '../../core/types';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="28" height="28" rx="6" fill="#A83CE2" />
        <path
          d="M8.5 14C8.5 10.9624 10.9624 8.5 14 8.5C17.0376 8.5 19.5 10.9624 19.5 14C19.5 17.0376 17.0376 19.5 14 19.5"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M14 11V14.2L16.2 15.6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="7" y="18" width="4" height="2.2" rx="1" fill="#F7EEFC" />
      </svg>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap text-slate-900 dark:text-white">
          OWTrackers
        </span>
      )}
    </div>
  );
}

export function ServiceStatusDisplay({ status }: { status: ServiceStatus }) {
  if (status === 'in_treatment') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7624A8] dark:text-[#D896FF] whitespace-nowrap">
        <PlayCircle className="w-4 h-4 shrink-0 text-[#A83CE2]" aria-hidden="true" />
        <span>En traitement</span>
      </span>
    );
  }
  if (status === 'present') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>Présent</span>
      </span>
    );
  }
  if (status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <PauseCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span>En pause</span>
      </span>
    );
  }
  if (status === 'in_outing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-[#C8C2D0] whitespace-nowrap">
        <LogOut className="w-4 h-4 shrink-0 text-slate-600 dark:text-[#C8C2D0]" aria-hidden="true" />
        <span>En sortie</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-[#C8C2D0] whitespace-nowrap">
      <MinusCircle className="w-4 h-4 shrink-0 text-slate-400 dark:text-[#C8C2D0]" aria-hidden="true" />
      <span>Absent</span>
    </span>
  );
}

export const QUALITY_STATUS_LABELS: Record<QualityStatus, string> = {
  en_attente: 'En attente de contrôle',
  valide: 'Validé',
  valide_observation: 'Validé avec observation',
  a_corriger: 'À corriger',
  rejete: 'Rejeté',
};

export function QualityControlStatusText({ status }: { status: QualityStatus }) {
  switch (status) {
    case 'valide':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Validé</span>
        </span>
      );
    case 'valide_observation':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7624A8] dark:text-[#D896FF] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#A83CE2] shrink-0" aria-hidden="true" />
          <span>Validé avec observation</span>
        </span>
      );
    case 'a_corriger':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span>À corriger</span>
        </span>
      );
    case 'rejete':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
          <span>Rejeté</span>
        </span>
      );
    case 'en_attente':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#C8C2D0] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-[#C8C2D0] shrink-0" aria-hidden="true" />
          <span>En attente de contrôle</span>
        </span>
      );
  }
}

export function QualityStatusText({
  status,
}: {
  status: 'termine' | 'en_controle' | 'valide';
}) {
  if (status === 'valide') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        <span>Validé</span>
      </span>
    );
  }
  if (status === 'en_controle') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
        <span>En contrôle</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#C8C2D0] whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 text-[#A83CE2] shrink-0" aria-hidden="true" />
      <span>Terminé</span>
    </span>
  );
}

interface StatTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  mono?: boolean;
  accent?: 'default' | 'emerald' | 'primary' | 'amber' | 'red';
}

export function StatTile({
  label,
  value,
  subtext,
  mono = true,
  accent = 'default',
}: StatTileProps) {
  const accentColor =
    accent === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : accent === 'primary'
      ? 'text-[#A83CE2]'
      : accent === 'amber'
      ? 'text-amber-700 dark:text-amber-400'
      : accent === 'red'
      ? 'text-red-700 dark:text-red-400'
      : 'text-slate-900 dark:text-white';

  return (
    <div className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 flex flex-col justify-between gap-2">
      <span className="text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">{label}</span>
      <div
        className={`text-2xl font-bold tracking-tight ${accentColor} ${
          mono ? 'font-mono tabular-nums' : 'font-display'
        }`}
      >
        {value}
      </div>
      {subtext && (
        <p className="text-xs text-slate-500 dark:text-[#C8C2D0] leading-relaxed">{subtext}</p>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  meta?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, meta, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
          {title}
        </h1>
        {meta && (
          <p className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5 capitalize">{meta}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface ThemeSelectorControlProps {
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
}

export function ThemeSelectorControl({ theme, onChangeTheme }: ThemeSelectorControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Sélection du thème"
      className="grid grid-cols-2 gap-3"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={() => onChangeTheme('light')}
        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          theme === 'light'
            ? 'bg-[#A83CE2] border-[#A83CE2] text-white'
            : 'bg-slate-50 dark:bg-[#211E27] border-slate-200 dark:border-[#393342] text-slate-700 dark:text-[#C8C2D0] hover:border-[#A83CE2]/50'
        }`}
      >
        <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Thème clair</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={() => onChangeTheme('dark')}
        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          theme === 'dark'
            ? 'bg-[#A83CE2] border-[#A83CE2] text-white'
            : 'bg-slate-50 dark:bg-[#211E27] border-slate-200 dark:border-[#393342] text-slate-700 dark:text-[#C8C2D0] hover:border-[#A83CE2]/50'
        }`}
      >
        <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Thème sombre</span>
      </button>
    </div>
  );
}
