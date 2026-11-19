import React from 'react';
import { CalendarDays } from 'lucide-react';
import { MyValidatedLeaveItem } from '../../core/types';
import { formatYmdFr, formatYmdLongFr } from '../../utils/formatters';

interface MyLeavesSectionProps {
  leaves: MyValidatedLeaveItem[];
}

export function MyLeavesSection({ leaves }: MyLeavesSectionProps) {
  return (
    <section
      aria-label="Mes congés"
      className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#A83CE2] shrink-0" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Mes congés</h2>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-[#C8C2D0]">
          {leaves.length} validé{leaves.length > 1 ? 's' : ''}
        </span>
      </div>

      {leaves.length === 0 ? (
        <div className="px-5 py-5 text-xs text-slate-500 dark:text-[#C8C2D0]">
          Aucun congé validé enregistré.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-[#393342]">
          {leaves.map((leave) => {
            const periodLabel =
              leave.startDate === leave.endDate
                ? formatYmdLongFr(leave.startDate)
                : `Du ${formatYmdFr(leave.startDate)} au ${formatYmdFr(leave.endDate)}`;
            const motifText = leave.motifs.length > 0 ? leave.motifs.join(' / ') : '';

            return (
              <div
                key={leave.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white capitalize">
                    {periodLabel}
                  </div>
                  {motifText && (
                    <div className="text-slate-600 dark:text-[#C8C2D0] truncate">
                      Motif : <span className="font-medium text-slate-800 dark:text-white">{motifText}</span>
                    </div>
                  )}
                </div>
                <div className="font-mono tabular-nums font-semibold text-[#7624A8] dark:text-[#D896FF] whitespace-nowrap shrink-0">
                  {leave.startTime} – {leave.endTime}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
