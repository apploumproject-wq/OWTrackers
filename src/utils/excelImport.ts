import * as XLSX from 'xlsx';
import { ROLE_LABELS } from '../core/permissions';
import { ManagedEmployee, ProjectRecord, UserRole } from '../core/types';

export type ExcelRowStatus = 'valid' | 'duplicate' | 'invalid';
export type ImportableUserRole = Exclude<UserRole, 'admin'>;

export interface ExcelImportRowAnalysis {
  rowNumber: number;
  fullName: string;
  matricule: string;
  rawRole: string;
  role?: ImportableUserRole;
  roleLabel?: string;
  rawProjects: string;
  projectIds: string[];
  projectLabels: string[];
  status: ExcelRowStatus;
  reason?: string;
}

export interface ExcelImportPreview {
  fileName: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  rows: ExcelImportRowAnalysis[];
  error?: string;
}

export interface AnalyzeExcelOptions {
  actorRole: UserRole;
  projects: ProjectRecord[];
  assignableProjectIds?: string[];
}

export function normalizeImportText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseImportUserRole(rawRole: unknown): {
  role?: ImportableUserRole;
  error?: string;
} {
  const trimmed = String(rawRole ?? '').trim();
  if (!trimmed) {
    return { error: 'Rôle manquant (Employé, Superviseur ou Manager).' };
  }
  const norm = normalizeImportText(trimmed);
  if (norm === 'employe' || norm === 'employes' || norm === 'employee' || norm === 'employees') {
    return { role: 'employee' };
  }
  if (
    norm === 'superviseur' ||
    norm === 'superviseurs' ||
    norm === 'supervisor' ||
    norm === 'supervisors'
  ) {
    return { role: 'supervisor' };
  }
  if (norm === 'manager' || norm === 'managers') {
    return { role: 'manager' };
  }
  return {
    error: `Rôle invalide : "${trimmed}". Valeurs autorisées : Employé, Superviseur, Manager.`,
  };
}

export function resolveImportProjects(
  rawProjects: unknown,
  allProjects: ProjectRecord[],
  assignableProjectIds: Set<string>
): {
  projectIds: string[];
  projectLabels: string[];
  errors: string[];
} {
  const rawStr = String(rawProjects ?? '').trim();
  if (!rawStr) {
    return {
      projectIds: [],
      projectLabels: [],
      errors: ['Projet manquant.'],
    };
  }

  const tokens = rawStr
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      projectIds: [],
      projectLabels: [],
      errors: ['Projet manquant ou invalide.'],
    };
  }

  const projectIds: string[] = [];
  const projectLabels: string[] = [];
  const seenIds = new Set<string>();
  const errors: string[] = [];

  for (const token of tokens) {
    const tokenKey = token.trim().toLowerCase();
    const matchedByCode = allProjects.find(
      (p) => p.code.trim().toLowerCase() === tokenKey
    );
    const matched =
      matchedByCode ??
      allProjects.find((p) => p.name.trim().toLowerCase() === tokenKey);

    if (!matched) {
      errors.push(`Projet introuvable : "${token}".`);
      continue;
    }
    if (!matched.active) {
      errors.push(`Projet désactivé : "${matched.name}" (${matched.code}).`);
      continue;
    }
    if (!assignableProjectIds.has(matched.id)) {
      errors.push(`Projet hors périmètre autorisé : "${matched.name}" (${matched.code}).`);
      continue;
    }

    if (!seenIds.has(matched.id)) {
      seenIds.add(matched.id);
      projectIds.push(matched.id);
      projectLabels.push(`${matched.code} — ${matched.name}`);
    }
  }

  return { projectIds, projectLabels, errors };
}

export function analyzeEmployeeExcelBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  existingAccounts: ManagedEmployee[],
  options: AnalyzeExcelOptions
): ExcelImportPreview {
  const emptyPreview = (error: string): ExcelImportPreview => ({
    fileName,
    totalRows: 0,
    validRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    rows: [],
    error,
  });

  if (options.actorRole !== 'admin' && options.actorRole !== 'manager') {
    return emptyPreview('Votre rôle ne permet pas d’importer des utilisateurs.');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    return emptyPreview(
      'Impossible de lire ce fichier Excel. Vérifiez qu’il s’agit bien d’un fichier .xlsx valide.'
    );
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return emptyPreview('Le fichier Excel ne contient aucune feuille de calcul.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    return emptyPreview('La première feuille du fichier Excel est illisible.');
  }

  let matrix: unknown[][];
  try {
    matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
  } catch {
    return emptyPreview('Erreur lors de l’extraction des données du tableau Excel.');
  }

  if (!matrix || matrix.length === 0) {
    return emptyPreview('La feuille Excel est vide.');
  }

  const headerRowIndex = matrix.findIndex(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
  );

  if (headerRowIndex === -1) {
    return emptyPreview('Aucune ligne d’en-tête trouvée dans le fichier.');
  }

  const headerRow = matrix[headerRowIndex] ?? [];
  let nameColIndex = -1;
  let matriculeColIndex = -1;
  let roleColIndex = -1;
  let projectColIndex = -1;

  headerRow.forEach((cell, idx) => {
    const normalized = normalizeImportText(cell);
    if ((normalized === 'nom' || normalized === 'nom complet') && nameColIndex === -1) {
      nameColIndex = idx;
    } else if (normalized === 'matricule' && matriculeColIndex === -1) {
      matriculeColIndex = idx;
    } else if ((normalized === 'role' || normalized === 'roles') && roleColIndex === -1) {
      roleColIndex = idx;
    } else if (
      (normalized === 'projet' ||
        normalized === 'projets' ||
        normalized === 'affectation projet' ||
        normalized === 'affectation au projet') &&
      projectColIndex === -1
    ) {
      projectColIndex = idx;
    }
  });

  const missingColumns: string[] = [];
  if (nameColIndex === -1) missingColumns.push('Nom');
  if (matriculeColIndex === -1) missingColumns.push('Matricule');
  if (roleColIndex === -1) missingColumns.push('Rôle');
  if (projectColIndex === -1) missingColumns.push('Projet');

  if (missingColumns.length > 0) {
    return emptyPreview(
      `Colonne(s) obligatoire(s) manquante(s) : ${missingColumns.join(', ')}. Le fichier doit contenir les colonnes "Nom", "Matricule", "Rôle" et "Projet".`
    );
  }

  const existingMatricules = new Set(
    existingAccounts
      .flatMap((acc) => [acc.matricule ?? '', acc.username ?? ''])
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
  const seenInFile = new Set<string>();
  const assignableProjectIds = new Set(
    options.assignableProjectIds ??
      options.projects.filter((p) => p.active).map((p) => p.id)
  );

  const analyzedRows: ExcelImportRowAnalysis[] = [];
  let validRows = 0;
  let duplicateRows = 0;
  let invalidRows = 0;

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const rawRow = matrix[i];
    if (!Array.isArray(rawRow)) continue;

    const hasAnyValue = rawRow.some((cell) => String(cell ?? '').trim() !== '');
    if (!hasAnyValue) continue;

    const rowNumber = i + 1;
    const fullName = String(rawRow[nameColIndex] ?? '').trim().replace(/\s+/g, ' ');
    const matricule = String(rawRow[matriculeColIndex] ?? '').trim();
    const matriculeKey = matricule.toLowerCase();
    const rawRole = String(rawRow[roleColIndex] ?? '').trim();
    const rawProjects = String(rawRow[projectColIndex] ?? '').trim();

    const parsedRole = parseImportUserRole(rawRole);
    let resolvedRole = parsedRole.role;
    const rowErrors: string[] = [];

    if (!fullName) {
      rowErrors.push('Nom complet manquant.');
    } else if (fullName.length < 2) {
      rowErrors.push('Nom complet trop court (2 caractères minimum).');
    }

    const matriculeStructurallyValid =
      Boolean(matricule) && matricule.length >= 2 && !/\s/.test(matricule);
    if (!matricule) {
      rowErrors.push('Matricule manquant.');
    } else if (/\s/.test(matricule)) {
      rowErrors.push('Le matricule ne doit pas contenir d’espaces.');
    } else if (matricule.length < 2) {
      rowErrors.push('Matricule trop court (2 caractères minimum).');
    }

    if (parsedRole.error) {
      rowErrors.push(parsedRole.error);
    } else if (resolvedRole === 'manager' && options.actorRole !== 'admin') {
      rowErrors.push(
        'Rôle non autorisé : seul un administrateur peut importer un compte Manager.'
      );
      resolvedRole = undefined;
    }

    const projectResolution = resolveImportProjects(
      rawProjects,
      options.projects,
      assignableProjectIds
    );
    if (projectResolution.errors.length > 0) {
      rowErrors.push(...projectResolution.errors);
    }

    if (matriculeStructurallyValid && seenInFile.has(matriculeKey)) {
      duplicateRows += 1;
      analyzedRows.push({
        rowNumber,
        fullName,
        matricule,
        rawRole,
        role: resolvedRole,
        roleLabel: resolvedRole ? ROLE_LABELS[resolvedRole] : undefined,
        rawProjects,
        projectIds: projectResolution.projectIds,
        projectLabels: projectResolution.projectLabels,
        status: 'duplicate',
        reason: 'Matricule en double dans le fichier Excel.',
      });
      continue;
    }

    if (matriculeStructurallyValid && existingMatricules.has(matriculeKey)) {
      seenInFile.add(matriculeKey);
      duplicateRows += 1;
      analyzedRows.push({
        rowNumber,
        fullName,
        matricule,
        rawRole,
        role: resolvedRole,
        roleLabel: resolvedRole ? ROLE_LABELS[resolvedRole] : undefined,
        rawProjects,
        projectIds: projectResolution.projectIds,
        projectLabels: projectResolution.projectLabels,
        status: 'duplicate',
        reason: 'Matricule déjà présent dans OWTrackers (compte conservé).',
      });
      continue;
    }

    if (matriculeStructurallyValid) {
      seenInFile.add(matriculeKey);
    }

    if (rowErrors.length > 0 || !resolvedRole) {
      invalidRows += 1;
      analyzedRows.push({
        rowNumber,
        fullName,
        matricule,
        rawRole,
        role: resolvedRole,
        roleLabel: resolvedRole ? ROLE_LABELS[resolvedRole] : undefined,
        rawProjects,
        projectIds: projectResolution.projectIds,
        projectLabels: projectResolution.projectLabels,
        status: 'invalid',
        reason: rowErrors.join(' '),
      });
      continue;
    }

    validRows += 1;
    analyzedRows.push({
      rowNumber,
      fullName,
      matricule,
      rawRole,
      role: resolvedRole,
      roleLabel: ROLE_LABELS[resolvedRole],
      rawProjects,
      projectIds: projectResolution.projectIds,
      projectLabels: projectResolution.projectLabels,
      status: 'valid',
    });
  }

  if (analyzedRows.length === 0) {
    return emptyPreview('Aucune ligne d’utilisateur trouvée sous la ligne d’en-tête.');
  }

  return {
    fileName,
    totalRows: analyzedRows.length,
    validRows,
    duplicateRows,
    invalidRows,
    rows: analyzedRows,
  };
}

