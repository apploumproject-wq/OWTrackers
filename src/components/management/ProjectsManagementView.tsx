import React, { useMemo, useState } from 'react';
import {
  Building2,
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardList,
  Copy,
  Edit3,
  Eye,
  FolderKanban,
  History,
  Layers,
  Lock,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  AppUser,
  FormTemplate,
  ManagedEmployee,
  ProjectCompanyItem,
  ProjectFieldType,
  ProjectFormField,
  ProjectFormVersion,
  ProjectRecord,
  ProjectTaskItem,
  TeamRecord,
} from '../../core/types';
import { PROJECT_FIELD_TYPE_LABELS } from '../../core/permissions';
import { formatDateTimeFr, generateUniqueId } from '../../utils/formatters';
import { SectionHeader } from '../ui/DataPrimitives';

interface ProjectsManagementViewProps {
  user: AppUser;
  projects: ProjectRecord[];
  formTemplates: FormTemplate[];
  employees: ManagedEmployee[];
  teams: TeamRecord[];
  onCreateProject: (input: {
    name: string;
    code?: string;
    description?: string;
    templateId?: string;
    fields?: ProjectFormField[];
    assignedTeamIds?: string[];
    addedEmployeeIds?: string[];
    companies?: string[];
    tasks?: string[];
  }) => { created?: ProjectRecord; error?: string };
  onUpdateProjectInfo: (
    projectId: string,
    patch: { name: string; code: string; description: string }
  ) => { error?: string };
  onToggleProjectActive: (projectId: string, active: boolean) => { error?: string };
  onUpdateProjectAssignments: (
    projectId: string,
    payload: {
      assignedTeamIds: string[];
      addedEmployeeIds: string[];
      excludedEmployeeIds: string[];
    }
  ) => { error?: string };
  onToggleEmployeeProjectAssignment: (
    projectId: string,
    employeeId: string,
    assigned: boolean
  ) => { error?: string };
  onAddProjectCompany: (projectId: string, name: string) => { error?: string };
  onUpdateProjectCompany: (
    projectId: string,
    companyId: string,
    name: string
  ) => { error?: string };
  onRemoveProjectCompany: (projectId: string, companyId: string) => { error?: string };
  onAddProjectTask: (projectId: string, name: string) => { error?: string };
  onUpdateProjectTask: (
    projectId: string,
    taskId: string,
    name: string
  ) => { error?: string };
  onRemoveProjectTask: (projectId: string, taskId: string) => { error?: string };
  onPublishProjectFormVersion: (
    projectId: string,
    fields: ProjectFormField[],
    options: { sourceTemplateId?: string; sourceTemplateName?: string; changeNote?: string }
  ) => { error?: string };
  onCreateFormTemplate: (input: {
    name: string;
    description?: string;
    fields: ProjectFormField[];
  }) => { error?: string };
  onUpdateFormTemplate: (
    templateId: string,
    input: { name: string; description?: string; fields: ProjectFormField[] }
  ) => { error?: string };
}

type MainTab = 'projects' | 'templates';
type ProjectDetailTab = 'info' | 'assignments' | 'form' | 'preview';

const FIELD_TYPES = Object.keys(PROJECT_FIELD_TYPE_LABELS) as ProjectFieldType[];

function makeEmptyField(order: number): ProjectFormField {
  return {
    id: generateUniqueId('fld'),
    label: '',
    type: 'short_text',
    required: false,
    options: [],
    order,
    active: true,
  };
}

function cloneFieldsForEditor(fields: ProjectFormField[]): ProjectFormField[] {
  return [...fields]
    .sort((a, b) => a.order - b.order)
    .map((f, idx) => ({
      ...f,
      options: f.options ? [...f.options] : [],
      order: idx + 1,
    }));
}

interface FieldBuilderListProps {
  fields: ProjectFormField[];
  readOnly?: boolean;
  onChange: (next: ProjectFormField[]) => void;
}

function FieldBuilderList({ fields, readOnly = false, onChange }: FieldBuilderListProps) {
  const [optionInputs, setOptionInputs] = useState<Record<string, string>>({});

  const updateField = (idx: number, patch: Partial<ProjectFormField>) => {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange(next);
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const copy = [...fields];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    onChange(copy.map((f, i) => ({ ...f, order: i + 1 })));
  };

  const removeField = (idx: number) => {
    const copy = fields.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i + 1 }));
    onChange(copy);
  };

  const addOption = (idx: number, fieldId: string) => {
    const raw = (optionInputs[fieldId] ?? '').trim();
    if (!raw) return;
    const currentOpts = fields[idx].options ?? [];
    if (!currentOpts.includes(raw)) {
      updateField(idx, { options: [...currentOpts, raw] });
    }
    setOptionInputs((prev) => ({ ...prev, [fieldId]: '' }));
  };

  const removeOption = (idx: number, optIdx: number) => {
    const currentOpts = fields[idx].options ?? [];
    updateField(idx, { options: currentOpts.filter((_, i) => i !== optIdx) });
  };

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] disabled:opacity-60';

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-[#C8C2D0] bg-slate-50 dark:bg-[#211E27] border border-dashed border-slate-300 dark:border-[#393342] rounded-lg p-6 text-center">
          Aucun champ personnalisé configuré. Ajoutez un champ ou chargez un modèle.
        </div>
      ) : (
        fields.map((field, idx) => {
          const hasOptions =
            field.type === 'select' || field.type === 'checkbox' || field.type === 'radio';
          return (
            <div
              key={field.id}
              className={`p-3.5 rounded-lg border transition-colors ${
                field.active
                  ? 'bg-white dark:bg-[#211E27] border-slate-200 dark:border-[#393342]'
                  : 'bg-slate-50 dark:bg-[#17151C] border-slate-200 dark:border-[#393342]/60 opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-[#7624A8] dark:text-[#D896FF]">
                    #{idx + 1}
                  </span>
                  <span className="text-slate-500 dark:text-[#C8C2D0]">
                    {PROJECT_FIELD_TYPE_LABELS[field.type]}
                  </span>
                  {!field.active && (
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      · Désactivé
                    </span>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveField(idx, -1)}
                      title="Monter"
                      className="p-1 text-slate-500 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === fields.length - 1}
                      onClick={() => moveField(idx, 1)}
                      title="Descendre"
                      className="p-1 text-slate-500 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(idx)}
                      title="Retirer le champ"
                      className="p-1 text-slate-400 dark:text-[#C8C2D0] hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                <div className="sm:col-span-5">
                  <label className="block font-medium text-slate-600 dark:text-[#C8C2D0] mb-1">
                    Nom du champ *
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={field.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                    placeholder="Ex. Numéro de contrat"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block font-medium text-slate-600 dark:text-[#C8C2D0] mb-1">
                    Type de champ
                  </label>
                  <select
                    disabled={readOnly}
                    value={field.type}
                    onChange={(e) => {
                      const nextType = e.target.value as ProjectFieldType;
                      updateField(idx, {
                        type: nextType,
                        options:
                          nextType === 'select' || nextType === 'checkbox' || nextType === 'radio'
                            ? field.options && field.options.length > 0
                              ? field.options
                              : []
                            : undefined,
                      });
                    }}
                    className={inputClass}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PROJECT_FIELD_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3 flex items-end gap-3 pb-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-[#C8C2D0]">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={field.required}
                      onChange={(e) => updateField(idx, { required: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[#A83CE2]"
                    />
                    <span>Obligatoire</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-[#C8C2D0]">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={field.active}
                      onChange={(e) => updateField(idx, { active: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[#A83CE2]"
                    />
                    <span>Actif</span>
                  </label>
                </div>
              </div>

              {hasOptions && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#393342] space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-600 dark:text-[#C8C2D0]">
                      Options de choix
                      {field.type === 'checkbox'
                        ? ' (laisser vide pour une case unique Oui/Non)'
                        : ' *'}
                    </span>
                  </div>

                  {(field.options ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(field.options ?? []).map((opt, optIdx) => (
                        <span
                          key={`${field.id}-opt-${optIdx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF] border border-[#A83CE2]/25 rounded text-xs"
                        >
                          <span>{opt}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => removeOption(idx, optIdx)}
                              className="hover:text-red-600 dark:hover:text-red-300 cursor-pointer"
                              aria-label={`Supprimer option ${opt}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {!readOnly && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={optionInputs[field.id] ?? ''}
                        onChange={(e) =>
                          setOptionInputs((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addOption(idx, field.id);
                          }
                        }}
                        placeholder="Saisir une option puis cliquer Ajouter..."
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => addOption(idx, field.id)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-[#292631] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF] border border-slate-300 dark:border-[#393342] font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Ajouter option
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...fields, makeEmptyField(fields.length + 1)])}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-[#211E27] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF] border border-dashed border-[#A83CE2]/50 text-xs font-semibold rounded-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Ajouter un champ personnalisé</span>
        </button>
      )}
    </div>
  );
}

export function FormFieldsPreview({
  fields,
  companies = [],
  tasks = [],
}: {
  fields: ProjectFormField[];
  companies?: ProjectCompanyItem[];
  tasks?: ProjectTaskItem[];
}) {
  const activeFields = useMemo(
    () => [...fields].filter((f) => f.active).sort((a, b) => a.order - b.order),
    [fields]
  );

  const inputClass =
    'w-full px-3 py-2 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5">
          Société {companies.length > 0 && <span className="text-red-600 dark:text-red-400">*</span>}
        </label>
        <select disabled className={inputClass}>
          <option value="">
            {companies.length === 0
              ? 'Aucune société configurée pour ce projet'
              : 'Sélectionner une société...'}
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5">
          Tâche {tasks.length > 0 && <span className="text-red-600 dark:text-red-400">*</span>}
        </label>
        <select disabled className={inputClass}>
          <option value="">
            {tasks.length === 0
              ? 'Aucune tâche configurée pour ce projet'
              : 'Sélectionner une tâche...'}
          </option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {activeFields.length === 0 && (
        <div className="md:col-span-2 text-xs text-slate-500 dark:text-[#C8C2D0] py-2">
          Aucun champ personnalisé supplémentaire actif dans cette version.
        </div>
      )}

      {activeFields.map((field) => (
        <div
          key={field.id}
          className={field.type === 'long_text' || field.type === 'checkbox' || field.type === 'radio' ? 'md:col-span-2' : ''}
        >
          <label className="block text-xs font-medium text-slate-700 dark:text-[#C8C2D0] mb-1.5">
            {field.label || 'Champ sans nom'}{' '}
            {field.required && <span className="text-red-600 dark:text-red-400">*</span>}
          </label>
          {field.type === 'short_text' && (
            <input type="text" readOnly placeholder="Texte court..." className={inputClass} />
          )}
          {field.type === 'long_text' && (
            <textarea rows={2} readOnly placeholder="Texte long..." className={inputClass} />
          )}
          {field.type === 'number' && (
            <input type="number" readOnly placeholder="0" className={`${inputClass} font-mono`} />
          )}
          {field.type === 'date' && <input type="date" readOnly className={`${inputClass} font-mono`} />}
          {field.type === 'time' && <input type="time" readOnly className={`${inputClass} font-mono`} />}
          {field.type === 'email' && (
            <input type="email" readOnly placeholder="exemple@domaine.fr" className={inputClass} />
          )}
          {field.type === 'select' && (
            <select disabled className={inputClass}>
              <option>Sélectionner...</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          )}
          {field.type === 'radio' && (
            <div className="flex flex-wrap gap-3 pt-1">
              {(field.options ?? []).map((opt) => (
                <label key={opt} className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#C8C2D0]">
                  <input type="radio" disabled name={`prev-${field.id}`} className="accent-[#A83CE2]" />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )}
          {field.type === 'checkbox' && (
            <div className="flex flex-wrap gap-3 pt-1">
              {(field.options ?? []).length > 0 ? (
                (field.options ?? []).map((opt) => (
                  <label key={opt} className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#C8C2D0]">
                    <input type="checkbox" disabled className="accent-[#A83CE2]" />
                    <span>{opt}</span>
                  </label>
                ))
              ) : (
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#C8C2D0]">
                  <input type="checkbox" disabled className="accent-[#A83CE2]" />
                  <span>Oui / Validé</span>
                </label>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ProjectsManagementView({
  user,
  projects,
  formTemplates,
  employees,
  teams,
  onCreateProject,
  onUpdateProjectInfo,
  onToggleProjectActive,
  onUpdateProjectAssignments,
  onToggleEmployeeProjectAssignment,
  onAddProjectCompany,
  onUpdateProjectCompany,
  onRemoveProjectCompany,
  onAddProjectTask,
  onUpdateProjectTask,
  onRemoveProjectTask,
  onPublishProjectFormVersion,
  onCreateFormTemplate,
  onUpdateFormTemplate,
}: ProjectsManagementViewProps) {
  const canManage = user.role === 'admin' || user.role === 'manager';

  const [mainTab, setMainTab] = useState<MainTab>('projects');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    () => projects[0]?.id ?? ''
  );
  const [detailTab, setDetailTab] = useState<ProjectDetailTab>('info');

  // Création de projet
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTemplateId, setNewTemplateId] = useState<string>(formTemplates[0]?.id ?? '');
  const [newFields, setNewFields] = useState<ProjectFormField[]>(() =>
    formTemplates[0] ? cloneFieldsForEditor(formTemplates[0].fields) : []
  );
  const [newTeamIds, setNewTeamIds] = useState<string[]>([]);
  const [newCompanies, setNewCompanies] = useState<string[]>([]);
  const [newCompanyInput, setNewCompanyInput] = useState('');
  const [newTasks, setNewTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [editingNewCompanyIdx, setEditingNewCompanyIdx] = useState<number | null>(null);
  const [editingNewCompanyValue, setEditingNewCompanyValue] = useState('');
  const [editingNewTaskIdx, setEditingNewTaskIdx] = useState<number | null>(null);
  const [editingNewTaskValue, setEditingNewTaskValue] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edition infos projet sélectionné
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId]
  );

  const [editProjectKey, setEditProjectKey] = useState<string>('');
  const [infoName, setInfoName] = useState('');
  const [infoCode, setInfoCode] = useState('');
  const [infoDesc, setInfoDesc] = useState('');
  const [empSearch, setEmpSearch] = useState('');

  // Gestion sociétés & tâches du projet sélectionné
  const [projectCompanyInput, setProjectCompanyInput] = useState('');
  const [editingProjectCompanyId, setEditingProjectCompanyId] = useState<string | null>(null);
  const [editingProjectCompanyName, setEditingProjectCompanyName] = useState('');
  const [projectTaskInput, setProjectTaskInput] = useState('');
  const [editingProjectTaskId, setEditingProjectTaskId] = useState<string | null>(null);
  const [editingProjectTaskName, setEditingProjectTaskName] = useState('');

  // Edition formulaire projet (brouillon avant publication vN+1)
  const [draftFields, setDraftFields] = useState<ProjectFormField[]>([]);
  const [draftSourceTemplateId, setDraftSourceTemplateId] = useState<string | undefined>(undefined);
  const [draftSourceTemplateName, setDraftSourceTemplateName] = useState<string | undefined>(
    undefined
  );
  const [changeNote, setChangeNote] = useState('');
  const [viewingVersion, setViewingVersion] = useState<ProjectFormVersion | null>(null);

  // Feedback
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Modèles de formulaires
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplFields, setTplFields] = useState<ProjectFormField[]>([]);
  const [tplFormOpen, setTplFormOpen] = useState(false);

  const syncSelectedProjectDrafts = (proj: ProjectRecord | null) => {
    if (!proj) return;
    setEditProjectKey(`${proj.id}:${proj.updatedAt}`);
    setInfoName(proj.name);
    setInfoCode(proj.code);
    setInfoDesc(proj.description);
    setProjectCompanyInput('');
    setEditingProjectCompanyId(null);
    setEditingProjectCompanyName('');
    setProjectTaskInput('');
    setEditingProjectTaskId(null);
    setEditingProjectTaskName('');
    const latest =
      proj.formVersions.find((v) => v.id === proj.currentFormVersionId) ??
      proj.formVersions[proj.formVersions.length - 1];
    setDraftFields(latest ? cloneFieldsForEditor(latest.fields) : []);
    setDraftSourceTemplateId(undefined);
    setDraftSourceTemplateName(undefined);
    setChangeNote('');
    setViewingVersion(null);
  };

  if (selectedProject && editProjectKey !== `${selectedProject.id}:${selectedProject.updatedAt}`) {
    syncSelectedProjectDrafts(selectedProject);
  }

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'inactive' && p.active) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter]);

  const activeEmployeesOnly = useMemo(
    () =>
      employees
        .filter((e) => e.accountStatus === 'actif' && e.role === 'employee')
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr')),
    [employees]
  );

  const getEffectiveAssignedCount = (proj: ProjectRecord) => {
    return activeEmployeesOnly.filter((emp) => {
      if (proj.addedEmployeeIds.includes(emp.id)) return true;
      if (
        emp.teamId &&
        proj.assignedTeamIds.includes(emp.teamId) &&
        !proj.excludedEmployeeIds.includes(emp.id)
      ) {
        return true;
      }
      return false;
    }).length;
  };

  const openCreateModal = () => {
    const firstTpl = formTemplates[0];
    setNewName('');
    setNewCode('');
    setNewDesc('');
    setNewTemplateId(firstTpl?.id ?? '');
    setNewFields(firstTpl ? cloneFieldsForEditor(firstTpl.fields) : []);
    setNewTeamIds([]);
    setNewCompanies([]);
    setNewCompanyInput('');
    setNewTasks([]);
    setNewTaskInput('');
    setEditingNewCompanyIdx(null);
    setEditingNewCompanyValue('');
    setEditingNewTaskIdx(null);
    setEditingNewTaskValue('');
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleAddDraftCompany = () => {
    const clean = newCompanyInput.trim();
    if (!clean) return;
    if (newCompanies.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setCreateError(`La société « ${clean} » est déjà ajoutée dans ce projet.`);
      return;
    }
    setCreateError(null);
    setNewCompanies((prev) => [...prev, clean]);
    setNewCompanyInput('');
  };

  const handleSaveDraftCompanyEdit = (idx: number) => {
    const clean = editingNewCompanyValue.trim();
    if (!clean) {
      setCreateError('Le nom de la société ne peut pas être vide.');
      return;
    }
    if (newCompanies.some((c, i) => i !== idx && c.toLowerCase() === clean.toLowerCase())) {
      setCreateError(`Une autre société porte déjà le nom « ${clean} » dans ce projet.`);
      return;
    }
    setCreateError(null);
    setNewCompanies((prev) => prev.map((c, i) => (i === idx ? clean : c)));
    setEditingNewCompanyIdx(null);
    setEditingNewCompanyValue('');
  };

  const handleAddDraftTask = () => {
    const clean = newTaskInput.trim();
    if (!clean) return;
    if (newTasks.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setCreateError(`La tâche « ${clean} » est déjà ajoutée dans ce projet.`);
      return;
    }
    setCreateError(null);
    setNewTasks((prev) => [...prev, clean]);
    setNewTaskInput('');
  };

  const handleSaveDraftTaskEdit = (idx: number) => {
    const clean = editingNewTaskValue.trim();
    if (!clean) {
      setCreateError('Le nom de la tâche ne peut pas être vide.');
      return;
    }
    if (newTasks.some((t, i) => i !== idx && t.toLowerCase() === clean.toLowerCase())) {
      setCreateError(`Une autre tâche porte déjà le nom « ${clean} » dans ce projet.`);
      return;
    }
    setCreateError(null);
    setNewTasks((prev) => prev.map((t, i) => (i === idx ? clean : t)));
    setEditingNewTaskIdx(null);
    setEditingNewTaskValue('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const tpl = formTemplates.find((t) => t.id === newTemplateId);
    const res = onCreateProject({
      name: newName,
      code: newCode,
      description: newDesc,
      templateId: tpl?.id,
      fields: newFields,
      assignedTeamIds: newTeamIds,
      companies: newCompanies,
      tasks: newTasks,
    });
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    setShowCreateModal(false);
    if (res.created) {
      setSelectedProjectId(res.created.id);
      syncSelectedProjectDrafts(res.created);
    }
    setBannerSuccess('Projet créé avec ses sociétés, tâches et formulaire v1.');
    setBannerError(null);
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = onUpdateProjectInfo(selectedProject.id, {
      name: infoName,
      code: infoCode,
      description: infoDesc,
    });
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setBannerSuccess('Informations du projet enregistrées.');
  };

  const handleAddSelectedCompany = () => {
    if (!selectedProject || !canManage) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = onAddProjectCompany(selectedProject.id, projectCompanyInput);
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setProjectCompanyInput('');
    setBannerSuccess('Société ajoutée au projet.');
  };

  const handleSaveSelectedCompany = (companyId: string) => {
    if (!selectedProject || !canManage) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = onUpdateProjectCompany(
      selectedProject.id,
      companyId,
      editingProjectCompanyName
    );
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setEditingProjectCompanyId(null);
    setEditingProjectCompanyName('');
    setBannerSuccess('Société modifiée pour ce projet.');
  };

  const handleRemoveSelectedCompany = (companyId: string) => {
    if (!selectedProject || !canManage) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = onRemoveProjectCompany(selectedProject.id, companyId);
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setBannerSuccess('Société retirée du projet (les traitements passés restent conservés).');
  };

  const handleAddSelectedTask = () => {
    if (!selectedProject || !canManage) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = onAddProjectTask(selectedProject.id, projectTaskInput);
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setProjectTaskInput('');
    setBannerSuccess('Tâche ajoutée au projet.');
  };

  const handleSaveSelectedTask = (taskId: string) => {
    if (!selectedProject || !canManage) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = onUpdateProjectTask(selectedProject.id, taskId, editingProjectTaskName);
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setEditingProjectTaskId(null);
    setEditingProjectTaskName('');
    setBannerSuccess('Tâche modifiée pour ce projet.');
  };

  const handleRemoveSelectedTask = (taskId: string) => {
    if (!selectedProject || !canManage) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = onRemoveProjectTask(selectedProject.id, taskId);
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setBannerSuccess('Tâche retirée du projet (les traitements passés restent conservés).');
  };

  const handleToggleTeam = (teamId: string) => {
    if (!selectedProject || !canManage) return;
    setBannerError(null);
    const currentTeams = selectedProject.assignedTeamIds;
    const nextTeams = currentTeams.includes(teamId)
      ? currentTeams.filter((id) => id !== teamId)
      : [...currentTeams, teamId];

    const res = onUpdateProjectAssignments(selectedProject.id, {
      assignedTeamIds: nextTeams,
      addedEmployeeIds: selectedProject.addedEmployeeIds,
      excludedEmployeeIds: selectedProject.excludedEmployeeIds,
    });
    if (res.error) setBannerError(res.error);
  };

  const handleApplyTemplateToDraft = (templateId: string) => {
    const tpl = formTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setDraftFields(cloneFieldsForEditor(tpl.fields));
    setDraftSourceTemplateId(tpl.id);
    setDraftSourceTemplateName(tpl.name);
    setBannerSuccess(
      `Modèle « ${tpl.name} » chargé dans le brouillon. Publiez pour créer la nouvelle version.`
    );
    setBannerError(null);
  };

  const handlePublishVersion = () => {
    if (!selectedProject || !canManage) return;
    setBannerError(null);
    setBannerSuccess(null);
    const res = onPublishProjectFormVersion(selectedProject.id, draftFields, {
      sourceTemplateId: draftSourceTemplateId,
      sourceTemplateName: draftSourceTemplateName,
      changeNote,
    });
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setChangeNote('');
    setDraftSourceTemplateId(undefined);
    setDraftSourceTemplateName(undefined);
    setBannerSuccess(
      `Nouvelle version v${selectedProject.currentFormVersionNumber + 1} publiée. Les anciens dossiers restent conservés dans leur version d’origine.`
    );
  };

  const openTemplateForm = (tpl?: FormTemplate) => {
    if (tpl) {
      setEditingTemplateId(tpl.id);
      setTplName(tpl.name);
      setTplDesc(tpl.description);
      setTplFields(cloneFieldsForEditor(tpl.fields));
    } else {
      setEditingTemplateId(null);
      setTplName('');
      setTplDesc('');
      setTplFields([makeEmptyField(1)]);
    }
    setBannerError(null);
    setBannerSuccess(null);
    setTplFormOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError(null);
    setBannerSuccess(null);
    const res = editingTemplateId
      ? onUpdateFormTemplate(editingTemplateId, {
          name: tplName,
          description: tplDesc,
          fields: tplFields,
        })
      : onCreateFormTemplate({
          name: tplName,
          description: tplDesc,
          fields: tplFields,
        });
    if (res.error) {
      setBannerError(res.error);
      return;
    }
    setTplFormOpen(false);
    setBannerSuccess(
      editingTemplateId
        ? 'Modèle mis à jour (les formulaires déjà publiés sur les projets restent inchangés).'
        : 'Nouveau modèle de formulaire enregistré.'
    );
  };

  const inputClass =
    'w-full px-3 py-2 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2] disabled:opacity-60';

  const latestVersion = selectedProject
    ? selectedProject.formVersions.find((v) => v.id === selectedProject.currentFormVersionId) ??
      selectedProject.formVersions[selectedProject.formVersions.length - 1]
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Gestion des projets"
        meta={
          canManage
            ? `${projects.length} projet(s) · Formulaires personnalisables et versionnés`
            : 'Consultation en lecture seule selon votre périmètre'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#211E27] rounded-lg">
              <button
                type="button"
                onClick={() => setMainTab('projects')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                  mainTab === 'projects'
                    ? 'bg-[#A83CE2] text-white'
                    : 'text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white'
                }`}
              >
                Projets ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setMainTab('templates')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                  mainTab === 'templates'
                    ? 'bg-[#A83CE2] text-white'
                    : 'text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white'
                }`}
              >
                Modèles ({formTemplates.length})
              </button>
            </div>
            {canManage && mainTab === 'projects' && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Nouveau projet</span>
              </button>
            )}
            {canManage && mainTab === 'templates' && (
              <button
                type="button"
                onClick={() => openTemplateForm()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Nouveau modèle</span>
              </button>
            )}
          </div>
        }
      />

      {!canManage && (
        <div className="bg-[#F7EEFC] dark:bg-[#A83CE2]/15 border border-[#A83CE2]/20 dark:border-[#A83CE2]/40 rounded-lg px-4 py-3 flex items-center gap-2.5 text-xs text-[#7624A8] dark:text-[#D896FF]">
          <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Mode consultation : vous voyez les projets rattachés à votre équipe et vos collaborateurs.
          </span>
        </div>
      )}

      {bannerError && (
        <div
          role="alert"
          className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-2.5"
        >
          {bannerError}
        </div>
      )}

      {bannerSuccess && (
        <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{bannerSuccess}</span>
        </div>
      )}

      {mainTab === 'projects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Colonne gauche : liste des projets */}
          <section className="lg:col-span-4 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#393342] space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-[#C8C2D0] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un projet..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                />
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#211E27] rounded-lg">
                {(
                  [
                    { id: 'all', label: 'Tous' },
                    { id: 'active', label: 'Actifs' },
                    { id: 'inactive', label: 'Désactivés' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`flex-1 py-1 text-[11px] font-medium rounded cursor-pointer ${
                      statusFilter === st.id
                        ? 'bg-white dark:bg-[#292631] text-[#7624A8] dark:text-[#D896FF] shadow-sm'
                        : 'text-slate-600 dark:text-[#C8C2D0]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-[#C8C2D0]">
                {projects.length === 0
                  ? 'Aucun projet créé pour le moment.'
                  : 'Aucun projet ne correspond à votre recherche.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#393342] max-h-[640px] overflow-y-auto">
                {filteredProjects.map((proj) => {
                  const selected = selectedProject?.id === proj.id;
                  const empCount = getEffectiveAssignedCount(proj);
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        syncSelectedProjectDrafts(proj);
                      }}
                      className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#F7EEFC] dark:bg-[#A83CE2]/20 border-l-4 border-[#A83CE2]'
                          : 'hover:bg-slate-50 dark:hover:bg-[#211E27]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-[#7624A8] dark:text-[#D896FF]">
                          {proj.code}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            proj.active
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-[#C8C2D0]'
                          }`}
                        >
                          {proj.active ? 'Actif' : 'Désactivé'}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-white mt-0.5 truncate">
                        {proj.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#C8C2D0] mt-1 flex items-center justify-between gap-2">
                        <span className="truncate">
                          {(proj.companies ?? []).length} soc. · {(proj.tasks ?? []).length} tâche(s)
                        </span>
                        <span className="font-mono shrink-0">
                          {empCount} emp. · v{proj.currentFormVersionNumber}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Colonne droite : détail du projet */}
          <section className="lg:col-span-8 bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg overflow-hidden">
            {!selectedProject ? (
              <div className="p-10 text-center space-y-2">
                <FolderKanban
                  className="w-8 h-8 text-[#A83CE2] mx-auto opacity-80"
                  aria-hidden="true"
                />
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sélectionnez ou créez un projet
                </div>
                <p className="text-xs text-slate-500 dark:text-[#C8C2D0]">
                  Configurez ses équipes, ses collaborateurs affectés et son formulaire de traitement versionné.
                </p>
              </div>
            ) : (
              <div>
                <div className="px-5 py-4 border-b border-slate-200 dark:border-[#393342] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-[#7624A8] dark:text-[#D896FF]">
                        {selectedProject.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          selectedProject.active
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {selectedProject.active ? 'Projet actif' : 'Projet désactivé'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-500 dark:text-[#C8C2D0]">
                        Formulaire v{selectedProject.currentFormVersionNumber}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {selectedProject.name}
                    </h2>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleProjectActive(selectedProject.id, !selectedProject.active)
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer whitespace-nowrap ${
                        selectedProject.active
                          ? 'bg-white dark:bg-[#211E27] border-slate-300 dark:border-[#393342] text-slate-700 dark:text-[#C8C2D0] hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300'
                          : 'bg-emerald-700 hover:bg-emerald-800 border-emerald-700 text-white'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {selectedProject.active ? 'Désactiver le projet' : 'Réactiver le projet'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Onglets détail projet */}
                <div className="px-5 pt-3 border-b border-slate-200 dark:border-[#393342] flex flex-wrap gap-1 bg-slate-50/50 dark:bg-[#211E27]/50">
                  {(
                    [
                      { id: 'info', label: 'Informations & statut', icon: Edit3 },
                      {
                        id: 'assignments',
                        label: `Affectations (${getEffectiveAssignedCount(selectedProject)})`,
                        icon: Users,
                      },
                      {
                        id: 'form',
                        label: `Formulaire & versions (v${selectedProject.currentFormVersionNumber})`,
                        icon: Layers,
                      },
                      { id: 'preview', label: 'Aperçu formulaire', icon: Eye },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = detailTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                          active
                            ? 'border-[#A83CE2] text-[#7624A8] dark:text-[#D896FF]'
                            : 'border-transparent text-slate-600 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-5 sm:p-6">
                  {detailTab === 'info' && (
                    <div className="space-y-6">
                      <form onSubmit={handleSaveInfo} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                              Nom du projet *
                            </label>
                            <input
                              type="text"
                              disabled={!canManage}
                              value={infoName}
                              onChange={(e) => setInfoName(e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                              Code projet *
                            </label>
                            <input
                              type="text"
                              disabled={!canManage}
                              value={infoCode}
                              onChange={(e) => setInfoCode(e.target.value)}
                              className={`${inputClass} font-mono`}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                              Description
                            </label>
                            <textarea
                              rows={3}
                              disabled={!canManage}
                              value={infoDesc}
                              onChange={(e) => setInfoDesc(e.target.value)}
                              placeholder="Objectif métier, consignes de traitement..."
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-[#393342] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-[#C8C2D0]">
                          <span>
                            Créé par {selectedProject.createdByName} le{' '}
                            {formatDateTimeFr(selectedProject.createdAt)} · Historique conservé même en cas de désactivation.
                          </span>
                          {canManage && (
                            <button
                              type="submit"
                              className="px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white font-semibold rounded-lg cursor-pointer"
                            >
                              Enregistrer les informations
                            </button>
                          )}
                        </div>
                      </form>

                      {/* A. Sociétés du projet & B. Tâches du projet */}
                      <div className="pt-5 border-t border-slate-200 dark:border-[#393342] grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* A. Sociétés du projet */}
                        <div className="bg-slate-50/70 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-[#A83CE2] shrink-0" aria-hidden="true" />
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                A. Sociétés du projet ({(selectedProject.companies ?? []).length})
                              </h3>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
                            Liste strictement rattachée à « {selectedProject.name} ». Affichée dans le formulaire de traitement de ce projet.
                          </p>

                          {canManage && (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={projectCompanyInput}
                                onChange={(e) => setProjectCompanyInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSelectedCompany();
                                  }
                                }}
                                placeholder="Nom de la société..."
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={handleAddSelectedCompany}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Ajouter</span>
                              </button>
                            </div>
                          )}

                          {(selectedProject.companies ?? []).length === 0 ? (
                            <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-2">
                              Aucune société configurée pour ce projet.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-200 dark:divide-[#393342] border border-slate-200 dark:border-[#393342] rounded-lg bg-white dark:bg-[#292631]">
                              {(selectedProject.companies ?? []).map((comp) => {
                                const isEditing = editingProjectCompanyId === comp.id;
                                return (
                                  <div
                                    key={comp.id}
                                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                                  >
                                    {isEditing ? (
                                      <div className="flex-1 flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={editingProjectCompanyName}
                                          onChange={(e) =>
                                            setEditingProjectCompanyName(e.target.value)
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleSaveSelectedCompany(comp.id);
                                            }
                                          }}
                                          className={inputClass}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveSelectedCompany(comp.id)}
                                          className="px-2.5 py-1.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white font-semibold rounded cursor-pointer"
                                        >
                                          Valider
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingProjectCompanyId(null);
                                            setEditingProjectCompanyName('');
                                          }}
                                          className="px-2 py-1.5 text-slate-500 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                        >
                                          Annuler
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="font-medium text-slate-900 dark:text-white truncate">
                                          {comp.name}
                                        </span>
                                        {canManage && (
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingProjectCompanyId(comp.id);
                                                setEditingProjectCompanyName(comp.name);
                                              }}
                                              className="px-2 py-1 text-[11px] font-semibold text-[#7624A8] dark:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 rounded cursor-pointer"
                                            >
                                              Modifier
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveSelectedCompany(comp.id)}
                                              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                              aria-label={`Retirer ${comp.name}`}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* B. Tâches du projet */}
                        <div className="bg-slate-50/70 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="w-4 h-4 text-[#A83CE2] shrink-0" aria-hidden="true" />
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                B. Tâches du projet ({(selectedProject.tasks ?? []).length})
                              </h3>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
                            Liste strictement rattachée à « {selectedProject.name} ». Indépendante des autres projets.
                          </p>

                          {canManage && (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={projectTaskInput}
                                onChange={(e) => setProjectTaskInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSelectedTask();
                                  }
                                }}
                                placeholder="Nom de la tâche..."
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={handleAddSelectedTask}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Ajouter</span>
                              </button>
                            </div>
                          )}

                          {(selectedProject.tasks ?? []).length === 0 ? (
                            <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-2">
                              Aucune tâche configurée pour ce projet.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-200 dark:divide-[#393342] border border-slate-200 dark:border-[#393342] rounded-lg bg-white dark:bg-[#292631]">
                              {(selectedProject.tasks ?? []).map((task) => {
                                const isEditing = editingProjectTaskId === task.id;
                                return (
                                  <div
                                    key={task.id}
                                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                                  >
                                    {isEditing ? (
                                      <div className="flex-1 flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={editingProjectTaskName}
                                          onChange={(e) => setEditingProjectTaskName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleSaveSelectedTask(task.id);
                                            }
                                          }}
                                          className={inputClass}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveSelectedTask(task.id)}
                                          className="px-2.5 py-1.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white font-semibold rounded cursor-pointer"
                                        >
                                          Valider
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingProjectTaskId(null);
                                            setEditingProjectTaskName('');
                                          }}
                                          className="px-2 py-1.5 text-slate-500 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                        >
                                          Annuler
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="font-medium text-slate-900 dark:text-white truncate">
                                          {task.name}
                                        </span>
                                        {canManage && (
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingProjectTaskId(task.id);
                                                setEditingProjectTaskName(task.name);
                                              }}
                                              className="px-2 py-1 text-[11px] font-semibold text-[#7624A8] dark:text-[#D896FF] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 rounded cursor-pointer"
                                            >
                                              Modifier
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveSelectedTask(task.id)}
                                              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                              aria-label={`Retirer ${task.name}`}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === 'assignments' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                          Équipes affectées
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-[#C8C2D0] mb-3">
                          Affecter une équipe inclut automatiquement tous ses membres actifs, tout en autorisant des ajouts ou retraits individuels ci-dessous.
                        </p>
                        {teams.length === 0 ? (
                          <div className="text-xs text-slate-500 dark:text-[#C8C2D0]">
                            Aucune équipe configurée.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {teams.map((team) => {
                              const checked = selectedProject.assignedTeamIds.includes(team.id);
                              const memberCount = activeEmployeesOnly.filter(
                                (e) => e.teamId === team.id
                              ).length;
                              return (
                                <label
                                  key={team.id}
                                  className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                                    canManage ? 'cursor-pointer' : 'cursor-default'
                                  } ${
                                    checked
                                      ? 'border-[#A83CE2] bg-[#F7EEFC] dark:bg-[#A83CE2]/15'
                                      : 'border-slate-200 dark:border-[#393342] bg-white dark:bg-[#211E27]'
                                  }`}
                                >
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                      {team.name}
                                    </div>
                                    <div className="text-slate-500 dark:text-[#C8C2D0]">
                                      {memberCount} employé(s) actif(s) · {team.supervisorName}
                                    </div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    disabled={!canManage}
                                    checked={checked}
                                    onChange={() => handleToggleTeam(team.id)}
                                    className="w-4 h-4 accent-[#A83CE2]"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="pt-5 border-t border-slate-200 dark:border-[#393342] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Employés (affectation individuelle ou exception)
                          </h3>
                          <input
                            type="text"
                            value={empSearch}
                            onChange={(e) => setEmpSearch(e.target.value)}
                            placeholder="Filtrer par nom ou matricule..."
                            className="sm:w-64 px-3 py-1.5 text-xs bg-white dark:bg-[#211E27] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                          />
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-[#393342] border border-slate-200 dark:border-[#393342] rounded-lg max-h-80 overflow-y-auto">
                          {activeEmployeesOnly
                            .filter((emp) => {
                              const q = empSearch.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                emp.fullName.toLowerCase().includes(q) ||
                                (emp.matricule ?? '').toLowerCase().includes(q)
                              );
                            })
                            .map((emp) => {
                              const viaTeam = Boolean(
                                emp.teamId && selectedProject.assignedTeamIds.includes(emp.teamId)
                              );
                              const addedIndiv = selectedProject.addedEmployeeIds.includes(emp.id);
                              const excludedFromTeam =
                                viaTeam && selectedProject.excludedEmployeeIds.includes(emp.id);
                              const isAssigned = addedIndiv || (viaTeam && !excludedFromTeam);
                              const teamName =
                                teams.find((t) => t.id === emp.teamId)?.name ?? 'Sans équipe';

                              return (
                                <div
                                  key={emp.id}
                                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div>
                                    <div className="font-medium text-slate-900 dark:text-white">
                                      {emp.fullName}{' '}
                                      <span className="font-mono text-slate-500 dark:text-[#C8C2D0]">
                                        ({emp.matricule})
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
                                      {teamName}
                                      {addedIndiv && ' · Ajout individuel'}
                                      {viaTeam && !excludedFromTeam && !addedIndiv && ' · Via équipe'}
                                      {excludedFromTeam && ' · Retiré individuellement de l’équipe'}
                                    </div>
                                  </div>
                                  {canManage ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onToggleEmployeeProjectAssignment(
                                          selectedProject.id,
                                          emp.id,
                                          !isAssigned
                                        )
                                      }
                                      className={`px-3 py-1 rounded-md font-semibold border cursor-pointer whitespace-nowrap ${
                                        isAssigned
                                          ? 'bg-[#F7EEFC] dark:bg-[#A83CE2]/20 text-[#7624A8] dark:text-[#D896FF] border-[#A83CE2]/40 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-300'
                                          : 'bg-white dark:bg-[#211E27] text-slate-600 dark:text-[#C8C2D0] border-slate-300 dark:border-[#393342] hover:border-[#A83CE2] hover:text-[#7624A8] dark:hover:text-white'
                                      }`}
                                    >
                                      {isAssigned ? 'Affecté (Retirer)' : 'Affecter'}
                                    </button>
                                  ) : (
                                    <span
                                      className={`font-semibold ${
                                        isAssigned
                                          ? 'text-emerald-700 dark:text-emerald-400'
                                          : 'text-slate-400 dark:text-[#C8C2D0]/60'
                                      }`}
                                    >
                                      {isAssigned ? 'Affecté' : 'Non affecté'}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === 'form' && (
                    <div className="space-y-6">
                      {canManage && (
                        <div className="bg-slate-50 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                Partir d’un modèle de formulaire
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
                                Charge les champs du modèle dans votre brouillon (sans écraser les versions déjà publiées).
                              </div>
                            </div>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleApplyTemplateToDraft(e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="sm:w-64 px-3 py-1.5 text-xs bg-white dark:bg-[#292631] text-slate-900 dark:text-white border border-slate-300 dark:border-[#393342] rounded-lg focus:outline-none focus:border-[#A83CE2]"
                            >
                              <option value="">Charger un modèle...</option>
                              {formTemplates.map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                  {tpl.name} ({tpl.fields.length} champs)
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            {canManage
                              ? `Éditeur du formulaire (prochaine version : v${
                                  selectedProject.currentFormVersionNumber + 1
                                })`
                              : `Champs de la version active (v${selectedProject.currentFormVersionNumber})`}
                          </h3>
                          {canManage && latestVersion && (
                            <button
                              type="button"
                              onClick={() => setDraftFields(cloneFieldsForEditor(latestVersion.fields))}
                              className="text-xs font-medium text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer"
                            >
                              Réinitialiser sur v{latestVersion.versionNumber}
                            </button>
                          )}
                        </div>

                        <FieldBuilderList
                          fields={draftFields}
                          readOnly={!canManage}
                          onChange={setDraftFields}
                        />
                      </div>

                      {canManage && (
                        <div className="bg-[#F7EEFC] dark:bg-[#A83CE2]/15 border border-[#A83CE2]/30 rounded-lg p-4 flex flex-col sm:flex-row sm:items-end gap-3">
                          <div className="flex-1 text-xs">
                            <label className="block font-semibold text-[#7624A8] dark:text-[#D896FF] mb-1">
                              Note de version (facultatif)
                            </label>
                            <input
                              type="text"
                              value={changeNote}
                              onChange={(e) => setChangeNote(e.target.value)}
                              placeholder="Ex. Ajout du champ numéro de contrat"
                              className={inputClass}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handlePublishVersion}
                            className="px-4 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            Publier la version v{selectedProject.currentFormVersionNumber + 1}
                          </button>
                        </div>
                      )}

                      {/* Historique des versions */}
                      <div className="pt-5 border-t border-slate-200 dark:border-[#393342] space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                          <History className="w-4 h-4 text-[#A83CE2]" aria-hidden="true" />
                          <span>Historique des versions ({selectedProject.formVersions.length})</span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-[#393342] border border-slate-200 dark:border-[#393342] rounded-lg">
                          {[...selectedProject.formVersions]
                            .sort((a, b) => b.versionNumber - a.versionNumber)
                            .map((ver) => {
                              const isCurrent = ver.id === selectedProject.currentFormVersionId;
                              return (
                                <div
                                  key={ver.id}
                                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                      <span className="font-mono text-[#7624A8] dark:text-[#D896FF]">
                                        v{ver.versionNumber}
                                      </span>
                                      {isCurrent && (
                                        <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                                          · Version active
                                        </span>
                                      )}
                                      {ver.sourceTemplateName && (
                                        <span className="ml-2 font-normal text-slate-500 dark:text-[#C8C2D0]">
                                          · Modèle : {ver.sourceTemplateName}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-slate-500 dark:text-[#C8C2D0] mt-0.5">
                                      Publiée par {ver.publishedByName} le{' '}
                                      {formatDateTimeFr(ver.publishedAt)} · {ver.fields.length}{' '}
                                      champ(s)
                                      {ver.changeNote ? ` — ${ver.changeNote}` : ''}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setViewingVersion(ver)}
                                      className="px-2.5 py-1 bg-slate-100 dark:bg-[#211E27] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 text-slate-700 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white rounded font-semibold cursor-pointer"
                                    >
                                      Consulter
                                    </button>
                                    {canManage && !isCurrent && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDraftFields(cloneFieldsForEditor(ver.fields));
                                          setBannerSuccess(
                                            `Champs de la version v${ver.versionNumber} copiés dans le brouillon.`
                                          );
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#211E27] border border-slate-300 dark:border-[#393342] hover:border-[#A83CE2] text-[#7624A8] dark:text-[#D896FF] rounded font-semibold cursor-pointer"
                                      >
                                        <Copy className="w-3 h-3" />
                                        <span>Reprendre</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === 'preview' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#393342] pb-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            Aperçu employé — Formulaire publié v
                            {selectedProject.currentFormVersionNumber}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-[#C8C2D0]">
                            Inclut les listes « Société » et « Tâche » propres à ce projet ainsi que les champs personnalisés actifs.
                          </p>
                        </div>
                      </div>
                      <FormFieldsPreview
                        fields={latestVersion?.fields ?? []}
                        companies={selectedProject.companies ?? []}
                        tasks={selectedProject.tasks ?? []}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {mainTab === 'templates' && (
        <div className="space-y-6">
          <div className="bg-[#F7EEFC] dark:bg-[#A83CE2]/15 border border-[#A83CE2]/20 dark:border-[#A83CE2]/40 rounded-lg px-4 py-3 text-xs text-[#7624A8] dark:text-[#D896FF]">
            La modification d’un modèle n’altère jamais les formulaires déjà publiés sur les projets existants.
          </div>

          {tplFormOpen && canManage && (
            <form
              onSubmit={handleSaveTemplate}
              className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#393342] pb-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editingTemplateId ? 'Modifier le modèle' : 'Créer un modèle de formulaire'}
                </h3>
                <button
                  type="button"
                  onClick={() => setTplFormOpen(false)}
                  className="text-xs text-slate-500 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Fermer
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Nom du modèle *
                  </label>
                  <input
                    type="text"
                    required
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="Ex. Gestion Sinistres"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={tplDesc}
                    onChange={(e) => setTplDesc(e.target.value)}
                    placeholder="Usage recommandé du modèle..."
                    className={inputClass}
                  />
                </div>
              </div>
              <FieldBuilderList fields={tplFields} onChange={setTplFields} />
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#393342]">
                <button
                  type="button"
                  onClick={() => setTplFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Enregistrer le modèle
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formTemplates.map((tpl) => (
              <section
                key={tpl.id}
                className="bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-lg p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[#7624A8] dark:text-[#D896FF]">
                      {tpl.isPredefined ? 'Modèle prédéfini' : 'Modèle personnalisé'} ·{' '}
                      {tpl.fields.length} champ(s)
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {tpl.name}
                    </h3>
                    {tpl.description && (
                      <p className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-1">
                        {tpl.description}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => openTemplateForm(tpl)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-[#211E27] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/20 text-slate-700 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Modifier</span>
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-[#393342] space-y-1 text-xs">
                  {tpl.fields.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between text-slate-700 dark:text-[#C8C2D0]"
                    >
                      <span>
                        {f.order}. {f.label}
                        {f.required ? ' *' : ''}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-[#C8C2D0]/80">
                        {PROJECT_FIELD_TYPE_LABELS[f.type]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Modal création de projet */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setShowCreateModal(false)}
            aria-hidden="true"
          />
          <form
            onSubmit={handleCreateSubmit}
            className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-3xl w-full p-6 space-y-5 shadow-xl z-10 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#393342] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Créer un nouveau projet
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-4 py-2.5">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Nom du projet *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex. Gestion Sinistres Couverture"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Code projet (auto si vide)
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Ex. PRJ-COV-01"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Modèle de formulaire initial
                </label>
                <select
                  value={newTemplateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNewTemplateId(id);
                    const tpl = formTemplates.find((t) => t.id === id);
                    setNewFields(tpl ? cloneFieldsForEditor(tpl.fields) : []);
                  }}
                  className={inputClass}
                >
                  <option value="">Formulaire vierge (création libre)</option>
                  {formTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.fields.length} champs)
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 dark:text-[#C8C2D0] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Périmètre et consignes..."
                  className={inputClass}
                />
              </div>
            </div>

            {teams.length > 0 && (
              <div className="text-xs space-y-2">
                <div className="font-semibold text-slate-700 dark:text-[#C8C2D0]">
                  Affecter des équipes dès la création (modifiable ensuite)
                </div>
                <div className="flex flex-wrap gap-2">
                  {teams.map((t) => {
                    const selected = newTeamIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setNewTeamIds((prev) =>
                            prev.includes(t.id)
                              ? prev.filter((id) => id !== t.id)
                              : [...prev, t.id]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer ${
                          selected
                            ? 'bg-[#F7EEFC] dark:bg-[#A83CE2]/20 border-[#A83CE2] text-[#7624A8] dark:text-[#D896FF]'
                            : 'bg-white dark:bg-[#211E27] border-slate-300 dark:border-[#393342] text-slate-700 dark:text-[#C8C2D0]'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* A. Sociétés du projet & B. Tâches du projet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-[#393342]">
              <div className="bg-slate-50/70 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white">
                  <Building2 className="w-3.5 h-3.5 text-[#A83CE2]" aria-hidden="true" />
                  <span>A. Sociétés du projet ({newCompanies.length})</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCompanyInput}
                    onChange={(e) => setNewCompanyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDraftCompany();
                      }
                    }}
                    placeholder="Ajouter une société..."
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleAddDraftCompany}
                    className="px-3 py-1.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
                  >
                    Ajouter
                  </button>
                </div>
                {newCompanies.length === 0 ? (
                  <div className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
                    Aucune société ajoutée pour le moment (modifiable ensuite).
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-[#393342] border border-slate-200 dark:border-[#393342] rounded bg-white dark:bg-[#292631]">
                    {newCompanies.map((cName, idx) => (
                      <div key={`${cName}-${idx}`} className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                        {editingNewCompanyIdx === idx ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingNewCompanyValue}
                              onChange={(e) => setEditingNewCompanyValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveDraftCompanyEdit(idx);
                                }
                              }}
                              className={inputClass}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveDraftCompanyEdit(idx)}
                              className="px-2 py-1 bg-[#A83CE2] text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNewCompanyIdx(null)}
                              className="px-1.5 py-1 text-slate-500 text-[11px] cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-slate-900 dark:text-white truncate">{cName}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNewCompanyIdx(idx);
                                  setEditingNewCompanyValue(cName);
                                }}
                                className="px-1.5 py-0.5 text-[11px] font-semibold text-[#7624A8] dark:text-[#D896FF] cursor-pointer"
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setNewCompanies((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                aria-label={`Retirer ${cName}`}
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50/70 dark:bg-[#211E27] border border-slate-200 dark:border-[#393342] rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white">
                  <ClipboardList className="w-3.5 h-3.5 text-[#A83CE2]" aria-hidden="true" />
                  <span>B. Tâches du projet ({newTasks.length})</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDraftTask();
                      }
                    }}
                    placeholder="Ajouter une tâche..."
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleAddDraftTask}
                    className="px-3 py-1.5 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0"
                  >
                    Ajouter
                  </button>
                </div>
                {newTasks.length === 0 ? (
                  <div className="text-[11px] text-slate-500 dark:text-[#C8C2D0]">
                    Aucune tâche ajoutée pour le moment (modifiable ensuite).
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-[#393342] border border-slate-200 dark:border-[#393342] rounded bg-white dark:bg-[#292631]">
                    {newTasks.map((tName, idx) => (
                      <div key={`${tName}-${idx}`} className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                        {editingNewTaskIdx === idx ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingNewTaskValue}
                              onChange={(e) => setEditingNewTaskValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveDraftTaskEdit(idx);
                                }
                              }}
                              className={inputClass}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveDraftTaskEdit(idx)}
                              className="px-2 py-1 bg-[#A83CE2] text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNewTaskIdx(null)}
                              className="px-1.5 py-1 text-slate-500 text-[11px] cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-slate-900 dark:text-white truncate">{tName}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNewTaskIdx(idx);
                                  setEditingNewTaskValue(tName);
                                }}
                                className="px-1.5 py-0.5 text-[11px] font-semibold text-[#7624A8] dark:text-[#D896FF] cursor-pointer"
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setNewTasks((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                aria-label={`Retirer ${tName}`}
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#393342]">
              <div className="text-xs font-semibold text-slate-800 dark:text-white">
                Configuration des champs du formulaire (v1)
              </div>
              <FieldBuilderList fields={newFields} onChange={setNewFields} />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#393342]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#A83CE2] hover:bg-[#7624A8] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Créer le projet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal consultation d'une version historique */}
      {viewingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setViewingVersion(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#393342] pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Formulaire v{viewingVersion.versionNumber}
                </h3>
                <div className="text-xs text-slate-500 dark:text-[#C8C2D0] mt-0.5">
                  Publiée par {viewingVersion.publishedByName} le{' '}
                  {formatDateTimeFr(viewingVersion.publishedAt)}
                  {viewingVersion.changeNote ? ` · ${viewingVersion.changeNote}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingVersion(null)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {viewingVersion.fields.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-[#C8C2D0] py-4">
                Aucun champ personnalisé dans cette version.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#393342] text-xs">
                {[...viewingVersion.fields]
                  .sort((a, b) => a.order - b.order)
                  .map((f) => (
                    <div key={f.id} className="py-2.5 flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {f.order}. {f.label}
                          {f.required && (
                            <span className="ml-1 text-red-600 dark:text-red-400">*</span>
                          )}
                          {!f.active && (
                            <span className="ml-2 text-amber-700 dark:text-amber-400 font-normal">
                              (Désactivé)
                            </span>
                          )}
                        </div>
                        {f.options && f.options.length > 0 && (
                          <div className="text-slate-500 dark:text-[#C8C2D0] mt-0.5">
                            Options : {f.options.join(', ')}
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-[#7624A8] dark:text-[#D896FF] shrink-0">
                        {PROJECT_FIELD_TYPE_LABELS[f.type]}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
