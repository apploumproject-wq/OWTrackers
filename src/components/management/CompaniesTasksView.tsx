import React, { useState } from 'react';
import { Archive, Check, Edit2, Plus, RotateCcw, X } from 'lucide-react';
import { CompanyRecord, TaskRecord } from '../../core/types';
import { SectionHeader } from '../ui/DataPrimitives';

interface CompaniesTasksViewProps {
  companies: CompanyRecord[];
  tasks: TaskRecord[];
  companyTaskMap: Record<string, string[]>;
  onAddCompany: (name: string) => void;
  onRenameCompany: (id: string, name: string) => void;
  onToggleArchiveCompany: (id: string, archived: boolean) => void;
  onAddTask: (name: string) => void;
  onRenameTask: (id: string, name: string) => void;
  onToggleArchiveTask: (id: string, archived: boolean) => void;
  onToggleTaskForCompany: (companyId: string, taskId: string, enabled: boolean) => void;
}

export function CompaniesTasksView({
  companies,
  tasks,
  companyTaskMap,
  onAddCompany,
  onRenameCompany,
  onToggleArchiveCompany,
  onAddTask,
  onRenameTask,
  onToggleArchiveTask,
  onToggleTaskForCompany,
}: CompaniesTasksViewProps) {
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    onAddCompany(newCompanyName);
    setNewCompanyName('');
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    onAddTask(newTaskName);
    setNewTaskName('');
  };

  const activeCompanies = companies.filter((c) => !c.archived);
  const activeTasks = tasks.filter((t) => !t.archived);

  return (
    <div className="space-y-6">
      <SectionHeader title="Sociétés & tâches" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sociétés */}
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Sociétés</h2>

          <form onSubmit={handleAddCompany} className="flex gap-2">
            <input
              type="text"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Nouvelle société..."
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/60 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ajouter</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-[#393342] border-t border-slate-100 dark:border-[#393342]">
            {companies.map((comp) => {
              const isEditing = editingCompanyId === comp.id;
              return (
                <div key={comp.id} className="py-3 flex items-center justify-between gap-3">
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingCompanyName}
                        onChange={(e) => setEditingCompanyName(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-[#A83CE2] rounded-md focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onRenameCompany(comp.id, editingCompanyName);
                          setEditingCompanyId(null);
                        }}
                        className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCompanyId(null)}
                        className="p-1.5 text-slate-400 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div
                          className={`text-sm font-medium ${
                            comp.archived
                              ? 'text-slate-400 dark:text-[#C8C2D0]/50 line-through'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {comp.name}
                        </div>
                        {comp.archived && (
                          <div className="text-[11px] text-slate-400 dark:text-[#C8C2D0]/70">
                            Archivée (historique conservé)
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCompanyId(comp.id);
                            setEditingCompanyName(comp.name);
                          }}
                          title="Renommer"
                          className="p-1.5 text-slate-500 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 rounded cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleArchiveCompany(comp.id, !comp.archived)}
                          title={comp.archived ? 'Réactiver' : 'Archiver'}
                          className="p-1.5 text-slate-500 dark:text-[#C8C2D0] hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded cursor-pointer"
                        >
                          {comp.archived ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Tâches */}
        <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Types de tâches
          </h2>

          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Nouveau type de tâche..."
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#C8C2D0]/60 border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ajouter</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-[#393342] border-t border-slate-100 dark:border-[#393342]">
            {tasks.map((task) => {
              const isEditing = editingTaskId === task.id;
              return (
                <div key={task.id} className="py-3 flex items-center justify-between gap-3">
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingTaskName}
                        onChange={(e) => setEditingTaskName(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-sm bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-[#A83CE2] rounded-md focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onRenameTask(task.id, editingTaskName);
                          setEditingTaskId(null);
                        }}
                        className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTaskId(null)}
                        className="p-1.5 text-slate-400 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div
                          className={`text-sm font-medium ${
                            task.archived
                              ? 'text-slate-400 dark:text-[#C8C2D0]/50 line-through'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {task.name}
                        </div>
                        {task.archived && (
                          <div className="text-[11px] text-slate-400 dark:text-[#C8C2D0]/70">
                            Archivée (historique conservé)
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTaskId(task.id);
                            setEditingTaskName(task.name);
                          }}
                          title="Renommer"
                          className="p-1.5 text-slate-500 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 rounded cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleArchiveTask(task.id, !task.archived)}
                          title={task.archived ? 'Réactiver' : 'Archiver'}
                          className="p-1.5 text-slate-500 dark:text-[#C8C2D0] hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded cursor-pointer"
                        >
                          {task.archived ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Matrice d'association tâches disponibles par société */}
      <section className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Tâches autorisées par société
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] text-xs font-medium text-slate-500 dark:text-[#C8C2D0]">
                <th className="py-3 px-5">Type de tâche</th>
                {activeCompanies.map((c) => (
                  <th key={c.id} className="py-3 px-4 text-center whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#393342] text-sm">
              {activeTasks.map((task) => (
                <tr key={task.id} className="hover:bg-[#F7EEFC]/30 dark:hover:bg-[#211E27]/70">
                  <td className="py-3 px-5 font-medium text-slate-900 dark:text-white">
                    {task.name}
                  </td>
                  {activeCompanies.map((comp) => {
                    const checked = (companyTaskMap[comp.id] ?? []).includes(task.id);
                    return (
                      <td key={comp.id} className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            onToggleTaskForCompany(comp.id, task.id, e.target.checked)
                          }
                          aria-label={`${task.name} pour ${comp.name}`}
                          className="w-4 h-4 accent-[#A83CE2] cursor-pointer"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
