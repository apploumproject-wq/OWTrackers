import * as XLSX from 'xlsx';
import { ManagedEmployee } from '../core/types';

export type ExcelRowStatus = 'valid' | 'duplicate' | 'invalid';

export interface ExcelImportRowAnalysis {
  rowNumber: number;
  fullName: string;
  matricule: string;
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

function normalizeColumnHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function analyzeEmployeeExcelBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  existingAccounts: ManagedEmployee[]
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

  headerRow.forEach((cell, idx) => {
    const normalized = normalizeColumnHeader(cell);
    if (normalized === 'nom complet' && nameColIndex === -1) {
      nameColIndex = idx;
    } else if (normalized === 'matricule' && matriculeColIndex === -1) {
      matriculeColIndex = idx;
    }
  });

  const missingColumns: string[] = [];
  if (nameColIndex === -1) missingColumns.push('Nom complet');
  if (matriculeColIndex === -1) missingColumns.push('Matricule');

  if (missingColumns.length > 0) {
    return emptyPreview(
      `Colonne(s) obligatoire(s) manquante(s) : ${missingColumns.join(', ')}. Le fichier doit contenir les colonnes "Nom complet" et "Matricule".`
    );
  }

  const existingMatricules = new Set(
    existingAccounts
      .flatMap((acc) => [acc.matricule ?? '', acc.username ?? ''])
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
  const seenInFile = new Set<string>();

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

    if (!fullName || fullName.length < 2) {
      invalidRows += 1;
      analyzedRows.push({
        rowNumber,
        fullName,
        matricule,
        status: 'invalid',
        reason: !fullName
          ? 'Nom complet manquant.'
          : 'Nom complet trop court (2 caractères minimum).',
      });
      continue;
    }

    if (!matricule || matricule.length < 2 || /\s/.test(matricule)) {
      invalidRows += 1;
      analyzedRows.push({
        rowNumber,
        fullName,
        matricule,
        status: 'invalid',
        reason: !matricule
          ? 'Matricule manquant.'
          : /\s/.test(matricule)
          ? 'Le matricule ne doit pas contenir d’espaces.'
          : 'Matricule trop court (2 caractères minimum).',
      });
      continue;
    }

    if (seenInFile.has(matriculeKey)) {
      duplicateRows += 1;
      analyzedRows.push({
        rowNumber,
        fullName,
        matricule,
        status: 'duplicate',
        reason: 'Matricule en double dans le fichier Excel.',
      });
      continue;
    }

    if (existingMatricules.has(matriculeKey)) {
      seenInFile.add(matriculeKey);
      duplicateRows += 1;
      analyzedRows.push({
        rowNumber,
        fullName,
        matricule,
        status: 'duplicate',
        reason: 'Matricule déjà présent dans OWTrackers (compte conservé).',
      });
      continue;
    }

    seenInFile.add(matriculeKey);
    validRows += 1;
    analyzedRows.push({
      rowNumber,
      fullName,
      matricule,
      status: 'valid',
    });
  }

  if (analyzedRows.length === 0) {
    return emptyPreview('Aucune ligne d’employé trouvée sous la ligne d’en-tête.');
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
