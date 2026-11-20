import {
  LeaveStatus,
  NavModuleId,
  OutingReason,
  PauseSlot,
  Permission,
  ProjectFieldType,
  UserRole,
} from './types';

/**
 * Matrice de permissions et d'accès par rôle.
 * Note d'architecture : le stockage local côté navigateur sert uniquement aux tests d'interface.
 * Les droits, l'authentification et les sessions doivent être appliqués côté serveur avec PostgreSQL en production.
 */

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  supervisor: 'Superviseur',
  employee: 'Employé',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'view:own_dashboard': 'Tableau de bord personnel',
  'execute:treatments': 'Exécuter traitements, pauses et sorties',
  'view:own_activities': 'Gérer ses pauses et sorties',
  'view:own_history': 'Consulter son historique (lecture seule)',
  'view:own_stats': 'Consulter ses statistiques personnelles',
  'view:own_profile': 'Consulter son profil',
  'view:management_dashboard': 'Tableau de bord de pilotage',
  'manage:employees': 'Gérer les comptes et collaborateurs du périmètre',
  'manage:teams': 'Gérer les équipes et affectations',
  'manage:schedules': 'Planifier les horaires et exceptions',
  'manage:quality': 'Effectuer le contrôle qualité',
  'view:objectives_stats': 'Objectifs, temps de référence et statistiques',
  'export:reports': 'Exporter les rapports (Excel, CSV, PDF)',
  'manage:settings_permissions': 'Paramètres, permissions et traçabilité',
  'approve:outings': 'Valider sorties et demandes de correction',
  'manage:leaves': 'Enregistrer, modifier et statuer les congés',
  'view:projects': 'Consulter les projets et affectations',
  'manage:projects': 'Créer et configurer les projets et formulaires',
};

export const BASE_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  employee: [
    'view:own_dashboard',
    'execute:treatments',
    'view:own_activities',
    'view:own_history',
    'view:own_stats',
    'view:own_profile',
  ],
  supervisor: [
    'view:own_profile',
    'view:management_dashboard',
    'manage:employees',
    'manage:schedules',
    'manage:leaves',
    'view:projects',
    'manage:quality',
    'view:objectives_stats',
    'approve:outings',
  ],
  manager: [
    'view:own_profile',
    'view:management_dashboard',
    'manage:employees',
    'manage:teams',
    'view:projects',
    'manage:projects',
    'manage:schedules',
    'manage:leaves',
    'manage:quality',
    'view:objectives_stats',
    'export:reports',
    'approve:outings',
  ],
  admin: [
    'view:own_profile',
    'view:management_dashboard',
    'manage:employees',
    'manage:teams',
    'view:projects',
    'manage:projects',
    'manage:schedules',
    'manage:leaves',
    'manage:quality',
    'view:objectives_stats',
    'export:reports',
    'manage:settings_permissions',
    'approve:outings',
  ],
};

export const CONFIGURABLE_SUPERVISOR_PERMISSIONS: Permission[] = [
  'manage:employees',
  'manage:schedules',
  'manage:quality',
  'view:objectives_stats',
  'approve:outings',
  'export:reports',
];

export const PAUSE_SLOT_LABELS: Record<PauseSlot, string> = {
  pause_matin: 'Pause 1 — Matin',
  pause_apres_midi: 'Pause 2 — Après-midi',
  pause_dejeuner: 'Pause déjeuner',
};

export const OUTING_REASON_CONFIG: Record<
  OutingReason,
  { label: string; requiresAuthorization: boolean }
> = {
  sortie_medecin: { label: 'Sortie médecin', requiresAuthorization: true },
  sortie_personnelle: { label: 'Sortie personnelle', requiresAuthorization: true },
  reunion: { label: 'Réunion', requiresAuthorization: false },
  probleme_connexion: { label: 'Problème de connexion', requiresAuthorization: false },
  probleme_technique: { label: 'Problème technique', requiresAuthorization: false },
  autre: { label: 'Autre', requiresAuthorization: false },
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  en_attente: 'En attente',
  valide: 'Validé',
  refuse: 'Refusé',
};

export const PROJECT_FIELD_TYPE_LABELS: Record<ProjectFieldType, string> = {
  short_text: 'Texte court',
  long_text: 'Texte long',
  number: 'Nombre',
  date: 'Date',
  time: 'Heure',
  email: 'Adresse e-mail',
  select: 'Liste déroulante',
  checkbox: 'Cases à cocher',
  radio: 'Choix unique',
};

export interface NavItemConfig {
  id: NavModuleId;
  label: string;
  section: 'principal' | 'pilotage' | 'administration';
  requiredPermission?: Permission;
  requiresPlanningAccess?: boolean;
}

export const ALL_NAV_ITEMS: NavItemConfig[] = [
  // Employé
  { id: 'employee_home', label: 'Accueil', section: 'principal', requiredPermission: 'view:own_dashboard' },
  { id: 'employee_treatment', label: 'Traitement', section: 'principal', requiredPermission: 'execute:treatments' },
  { id: 'employee_activities', label: 'Mes activités', section: 'principal', requiredPermission: 'view:own_activities' },
  { id: 'employee_history', label: 'Historique', section: 'principal', requiredPermission: 'view:own_history' },
  { id: 'employee_stats', label: 'Mes statistiques', section: 'principal', requiredPermission: 'view:own_stats' },

  // Gestion
  { id: 'mgmt_dashboard', label: 'Tableau de bord', section: 'principal', requiredPermission: 'view:management_dashboard' },
  { id: 'mgmt_employees', label: 'Utilisateurs', section: 'pilotage', requiredPermission: 'manage:employees' },
  { id: 'mgmt_teams', label: 'Équipes', section: 'pilotage', requiredPermission: 'manage:teams' },
  { id: 'mgmt_projects', label: 'Gestion des projets', section: 'pilotage', requiredPermission: 'view:projects' },
  { id: 'mgmt_schedules', label: 'Horaires & sorties', section: 'pilotage', requiredPermission: 'manage:schedules' },
  { id: 'mgmt_leaves', label: 'Gestion des congés', section: 'pilotage', requiredPermission: 'manage:leaves' },
  { id: 'planning', label: 'Planning', section: 'pilotage', requiresPlanningAccess: true },
  { id: 'mgmt_quality', label: 'Contrôle qualité', section: 'pilotage', requiredPermission: 'manage:quality' },
  { id: 'mgmt_objectives', label: 'Objectifs & statistiques', section: 'pilotage', requiredPermission: 'view:objectives_stats' },
  { id: 'mgmt_reports', label: 'Rapports', section: 'administration', requiredPermission: 'export:reports' },
  { id: 'mgmt_settings', label: 'Administration', section: 'administration', requiredPermission: 'manage:settings_permissions' },

  // Commun
  { id: 'profile', label: 'Mon profil', section: 'administration', requiredPermission: 'view:own_profile' },
];

export function getPermissionsForRole(
  role: UserRole,
  supervisorPermissions?: Permission[]
): Permission[] {
  if (role === 'supervisor' && supervisorPermissions) {
    return Array.from(
      new Set([
        'view:own_profile',
        'view:management_dashboard',
        'manage:leaves',
        'view:projects',
        ...supervisorPermissions,
      ])
    );
  }
  return BASE_ROLE_PERMISSIONS[role];
}

export function hasPermission(
  role: UserRole,
  permission: Permission,
  supervisorPermissions?: Permission[]
): boolean {
  return getPermissionsForRole(role, supervisorPermissions).includes(permission);
}

export function getNavItemsForRole(
  role: UserRole,
  supervisorPermissions?: Permission[],
  canAccessPlanning = false
): NavItemConfig[] {
  return ALL_NAV_ITEMS.filter((item) => {
    if (item.requiresPlanningAccess) {
      return role === 'admin' || canAccessPlanning;
    }
    if (!item.requiredPermission) return false;
    return hasPermission(role, item.requiredPermission, supervisorPermissions);
  });
}

export function canAccessModule(
  role: UserRole,
  moduleId: NavModuleId,
  supervisorPermissions?: Permission[],
  canAccessPlanning = false
): boolean {
  const item = ALL_NAV_ITEMS.find((nav) => nav.id === moduleId);
  if (!item) return false;
  if (item.requiresPlanningAccess) {
    return role === 'admin' || canAccessPlanning;
  }
  if (!item.requiredPermission) return false;
  return hasPermission(role, item.requiredPermission, supervisorPermissions);
}

export function getDefaultModuleForRole(role: UserRole): NavModuleId {
  return role === 'employee' ? 'employee_home' : 'mgmt_dashboard';
}
