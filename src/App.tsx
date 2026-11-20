/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  AccountStatus,
  ActivityRecord,
  AppUser,
  AuditLogEntry,
  CompanyRecord,
  CorrectionRequest,
  CustomFieldValue,
  EmployeeScheduleConfig,
  EmployeeShiftState,
  FormTemplate,
  GlobalAdminConfig,
  LeaveRecord,
  LeaveStatus,
  ManagedEmployee,
  NavModuleId,
  OutingAuthorizationRequest,
  OutingReason,
  PauseSlot,
  Permission,
  ProductionObjective,
  ProjectFormField,
  ProjectRecord,
  QualityControlRecord,
  QualityCriterionConfig,
  QualityCriterionResult,
  QualityStatus,
  ReceptionChannel,
  ReferenceTimeEntry,
  ServiceStatus,
  TaskRecord,
  TeamRecord,
  ThemeMode,
} from './core/types';
import { canAccessModule, getDefaultModuleForRole, hasPermission } from './core/permissions';
import {
  CreateUserInput,
  ExcelImportExecutionResult,
  ExcelImportRowInput,
  clockService,
  storageService,
} from './services/storageService';
import { InitialAdminSetupScreen } from './components/auth/InitialAdminSetupScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { AppShell } from './components/layout/AppShell';
import { EmployeeDashboard } from './components/employee/EmployeeDashboard';
import { EmployeeTreatmentView } from './components/employee/EmployeeTreatmentView';
import { EmployeeActivitiesView } from './components/employee/EmployeeActivitiesView';
import { EmployeeHistoryView } from './components/employee/EmployeeHistoryView';
import { EmployeeStatsView } from './components/employee/EmployeeStatsView';
import { ProfileView } from './components/profile/ProfileView';
import { ManagementDashboard } from './components/management/ManagementDashboard';
import { EmployeesTeamsView } from './components/management/EmployeesTeamsView';
import { ProjectsManagementView } from './components/management/ProjectsManagementView';
import { SchedulesOutingsView } from './components/management/SchedulesOutingsView';
import { QualityControlView } from './components/management/QualityControlView';
import { ObjectivesStatsView } from './components/management/ObjectivesStatsView';
import { ReportsView } from './components/management/ReportsView';
import { SettingsAuditView } from './components/management/SettingsAuditView';
import { LeavesManagementView } from './components/management/LeavesManagementView';
import { PlanningView } from './components/management/PlanningView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() =>
    storageService.getSessionUser()
  );
  const [supervisorPermissions, setSupervisorPermissions] = useState<Permission[]>(() =>
    storageService.getSupervisorPermissions()
  );
  const [activeModule, setActiveModule] = useState<NavModuleId>(() => {
    const u = storageService.getSessionUser();
    return u ? getDefaultModuleForRole(u.role) : 'employee_home';
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const u = storageService.getSessionUser();
    return u ? storageService.getUserTheme(u.id) : storageService.getFallbackTheme();
  });

  const [adminConfig, setAdminConfig] = useState<GlobalAdminConfig>(() =>
    storageService.getAdminConfig()
  );
  const [schedules, setSchedules] = useState<EmployeeScheduleConfig[]>(() =>
    storageService.getSchedules()
  );
  const [outingRequests, setOutingRequests] = useState<OutingAuthorizationRequest[]>(() =>
    storageService.getOutingRequests()
  );
  const [companies, setCompanies] = useState<CompanyRecord[]>(() =>
    storageService.getCompanies()
  );
  const [tasks, setTasks] = useState<TaskRecord[]>(() => storageService.getTasks());
  const [allProjects, setAllProjects] = useState<ProjectRecord[]>(() =>
    storageService.getProjects()
  );
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>(() =>
    storageService.getFormTemplates()
  );
  const [treatmentActivities, setTreatmentActivities] = useState(() =>
    storageService.getAllTreatmentActivities()
  );
  const [employees, setEmployees] = useState<ManagedEmployee[]>(() =>
    storageService.getEmployees()
  );
  const [teams, setTeams] = useState<TeamRecord[]>(() => storageService.getTeams());
  const [referenceTimes, setReferenceTimes] = useState<ReferenceTimeEntry[]>(() =>
    storageService.getReferenceTimes()
  );
  const [objectives, setObjectives] = useState<ProductionObjective[]>(() =>
    storageService.getObjectives()
  );
  const [qualityCriteria, setQualityCriteria] = useState<QualityCriterionConfig[]>(() =>
    storageService.getQualityCriteria()
  );
  const [qualityControls, setQualityControls] = useState<QualityControlRecord[]>(() => {
    const u = storageService.getSessionUser();
    return u ? storageService.getQualityControlsForUser(u).records : [];
  });
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>(() =>
    storageService.getCorrectionRequests()
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    storageService.getAuditLogs()
  );
  const [planningAuthorizedUserIds, setPlanningAuthorizedUserIds] = useState<string[]>(() =>
    storageService.getPlanningAuthorizedUserIds()
  );
  const [leaves, setLeaves] = useState<LeaveRecord[]>(() => {
    const u = storageService.getSessionUser();
    return u && storageService.canUserManageLeaves(u)
      ? storageService.getLeavesForManagement(u).leaves
      : [];
  });
  const [planningRevision, setPlanningRevision] = useState<number>(0);

  const [shiftState, setShiftState] = useState<EmployeeShiftState | null>(() => {
    const u = storageService.getSessionUser();
    return u && u.role === 'employee' ? storageService.getShiftState(u.id) : null;
  });

  const [activities, setActivities] = useState<ActivityRecord[]>(() => {
    const u = storageService.getSessionUser();
    return u && u.role === 'employee' ? storageService.getActivitiesForUser(u.id) : [];
  });

  const [lastSavedActivity, setLastSavedActivity] = useState<ActivityRecord | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => clockService.nowMs());

  useEffect(() => {
    storageService.applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'employee') return;
    const id = window.setInterval(() => {
      setNowMs(clockService.nowMs());
    }, 1000);
    return () => window.clearInterval(id);
  }, [currentUser]);

  const refreshAllStores = (targetUser: AppUser | null = currentUser) => {
    setSupervisorPermissions(storageService.getSupervisorPermissions());
    setAdminConfig(storageService.getAdminConfig());
    setSchedules(storageService.getSchedules());
    setOutingRequests(storageService.getOutingRequests());
    setCompanies(storageService.getCompanies());
    setTasks(storageService.getTasks());
    setAllProjects(storageService.getProjects());
    setFormTemplates(storageService.getFormTemplates());
    setTreatmentActivities(storageService.getAllTreatmentActivities());
    setEmployees(storageService.getEmployees());
    setTeams(storageService.getTeams());
    setReferenceTimes(storageService.getReferenceTimes());
    setObjectives(storageService.getObjectives());
    setQualityCriteria(storageService.getQualityCriteria());
    setQualityControls(
      targetUser ? storageService.getQualityControlsForUser(targetUser).records : []
    );
    setCorrectionRequests(storageService.getCorrectionRequests());
    setAuditLogs(storageService.getAuditLogs());
    setPlanningAuthorizedUserIds(storageService.getPlanningAuthorizedUserIds());
    if (targetUser && storageService.canUserManageLeaves(targetUser)) {
      setLeaves(storageService.getLeavesForManagement(targetUser).leaves);
    } else {
      setLeaves([]);
    }
  };

  const loadUserWorkspace = (user: AppUser) => {
    storageService.setSessionUser(user.id);
    const hydrated = storageService.getSessionUser() ?? user;
    const userTheme = storageService.getUserTheme(hydrated.id);
    storageService.applyThemeToDocument(userTheme);
    setTheme(userTheme);
    setCurrentUser(hydrated);
    setActiveModule(getDefaultModuleForRole(hydrated.role));
    setLastSavedActivity(null);
    refreshAllStores(hydrated);
    if (hydrated.role === 'employee') {
      setShiftState(storageService.getShiftState(hydrated.id));
      setActivities(storageService.getActivitiesForUser(hydrated.id));
    } else {
      setShiftState(null);
      setActivities([]);
    }
    setNowMs(clockService.nowMs());
  };

  const handleChangeTheme = (nextTheme: ThemeMode) => {
    if (currentUser) {
      storageService.setUserTheme(currentUser.id, nextTheme);
    } else {
      storageService.applyThemeToDocument(nextTheme);
    }
    setTheme(nextTheme);
  };

  const handleLogout = () => {
    storageService.setSessionUser(null);
    setCurrentUser(null);
    setShiftState(null);
    setActivities([]);
    setLeaves([]);
    setLastSavedActivity(null);
  };

  const handleSelectModule = (moduleId: NavModuleId) => {
    if (!currentUser) return;
    const canPlan = storageService.canUserAccessPlanning(currentUser);
    if (canAccessModule(currentUser.role, moduleId, supervisorPermissions, canPlan)) {
      setActiveModule(moduleId);
    }
  };

  // --- Actions Employé (Chronomètres, Pauses, Sorties, Corrections) ---
  const handleChangeServiceStatus = (status: ServiceStatus) => {
    if (!currentUser || currentUser.role !== 'employee') return;
    const updated = storageService.transitionServiceStatus(currentUser.id, status);
    setShiftState(updated);
    setNowMs(clockService.nowMs());
  };

  const handleStartTreatment = (projectId?: string): string | null => {
    if (!currentUser || currentUser.role !== 'employee') return null;
    const res = storageService.startTreatmentSession(currentUser.id, projectId);
    setShiftState(res.shiftState);
    if (!res.error) setLastSavedActivity(null);
    setNowMs(clockService.nowMs());
    return res.error ?? null;
  };

  const handleStartPause = (slot: PauseSlot): string | null => {
    if (!currentUser || currentUser.role !== 'employee') return null;
    const res = storageService.startPauseSession(currentUser.id, slot);
    setShiftState(res.shiftState);
    if (!res.error) setLastSavedActivity(null);
    setNowMs(clockService.nowMs());
    return res.error ?? null;
  };

  const handleStartOuting = (
    reason: OutingReason,
    authReq?: OutingAuthorizationRequest | null
  ): string | null => {
    if (!currentUser || currentUser.role !== 'employee') return null;
    const res = storageService.startOutingSession(currentUser.id, reason, authReq);
    setShiftState(res.shiftState);
    if (!res.error) setLastSavedActivity(null);
    setNowMs(clockService.nowMs());
    return res.error ?? null;
  };

  const handleUpdateTimerFields = (patch: {
    taskId?: string;
    taskTitle?: string;
    companyId?: string;
    clientName?: string;
    dossierRef?: string;
    notes?: string;
    receptionChannel?: ReceptionChannel;
    receptionDateTime?: string;
    recipientEmail?: string;
    teamsRequesterName?: string;
    customReason?: string;
    customResponses?: Record<string, CustomFieldValue>;
  }) => {
    if (!currentUser || currentUser.role !== 'employee') return;
    const updated = storageService.updateActiveTimerFields(currentUser.id, patch);
    setShiftState(updated);
  };

  const handleCompleteTimer = (): string[] | null => {
    if (!currentUser || currentUser.role !== 'employee') return null;
    const { shiftState: updatedShift, savedRecord, validationErrors } =
      storageService.completeTimerSession(currentUser.id, {
        fullName: currentUser.fullName,
        teamId: currentUser.teamId,
      });
    setShiftState(updatedShift);
    if (validationErrors && validationErrors.length > 0) {
      return validationErrors;
    }
    setActivities(storageService.getActivitiesForUser(currentUser.id));
    setQualityControls(storageService.getQualityControlsForUser(currentUser).records);
    setTreatmentActivities(storageService.getAllTreatmentActivities());
    setEmployees(storageService.getEmployees());
    setLastSavedActivity(savedRecord);
    setNowMs(clockService.nowMs());
    return null;
  };

  const handleCreateOutingRequest = (payload: {
    reason: Extract<OutingReason, 'sortie_medecin' | 'sortie_personnelle'>;
    details: string;
    plannedWindow: string;
  }) => {
    if (!currentUser) return;
    storageService.createOutingRequest({ user: currentUser, ...payload });
    setOutingRequests(storageService.getOutingRequests());
  };

  const handleCreateCorrectionRequest = (activity: ActivityRecord, reason: string) => {
    if (!currentUser) return;
    const next = storageService.createCorrectionRequest({
      activity,
      user: currentUser,
      reason,
    });
    setCorrectionRequests(next);
  };

  const handleSyncPending = () => {
    if (!currentUser) return;
    const synced = storageService.syncPendingActivitiesForUser(currentUser.id);
    setActivities(synced);
  };

  // --- Actions Gestion / Administration ---
  const handleReviewOutingRequest = (requestId: string, decision: 'approuvee' | 'refusee') => {
    if (!currentUser) return;
    setOutingRequests(storageService.reviewOutingRequest(requestId, decision, currentUser));
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleSaveEmployeeSchedule = (schedule: EmployeeScheduleConfig) => {
    if (!currentUser) return;
    setSchedules(storageService.saveEmployeeSchedule(schedule, currentUser));
    setEmployees(storageService.getEmployees());
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleSaveAdminConfig = (config: GlobalAdminConfig) => {
    if (!currentUser) return;
    setAdminConfig(storageService.saveAdminConfig(config, currentUser));
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleSaveSupervisorPermissions = (perms: Permission[]) => {
    if (!currentUser) return;
    setSupervisorPermissions(storageService.saveSupervisorPermissions(perms, currentUser));
    setAuditLogs(storageService.getAuditLogs());
    if (storageService.canUserManageLeaves(currentUser)) {
      setLeaves(storageService.getLeavesForManagement(currentUser).leaves);
    }
  };

  const handleCreateAccount = async (
    input: CreateUserInput
  ): Promise<{
    error?: string;
    createdMatricule?: string;
    provisionalPassword?: string;
  }> => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = await storageService.createManagedUser(input, currentUser);
    setEmployees(res.users);
    setSchedules(storageService.getSchedules());
    if (!res.error) {
      setAllProjects(storageService.getProjects());
    }
    setAuditLogs(storageService.getAuditLogs());
    return res.error
      ? { error: res.error }
      : {
          createdMatricule: res.created?.matricule,
          provisionalPassword: res.provisionalPassword,
        };
  };

  const handleImportEmployeesExcel = async (
    rows: ExcelImportRowInput[]
  ): Promise<ExcelImportExecutionResult> => {
    if (!currentUser) {
      return {
        users: employees,
        createdAccounts: [],
        rejectedItems: [],
        error: 'Session expirée.',
      };
    }
    const res = await storageService.importEmployeesFromExcel(rows, currentUser);
    setEmployees(res.users);
    setSchedules(storageService.getSchedules());
    setAllProjects(storageService.getProjects());
    setAuditLogs(storageService.getAuditLogs());
    return res;
  };

  const handleUpdateAccount = async (
    userId: string,
    patch: Partial<
      Pick<
        ManagedEmployee,
        | 'username'
        | 'matricule'
        | 'fullName'
        | 'email'
        | 'role'
        | 'jobTitle'
        | 'site'
        | 'teamId'
        | 'supervisorId'
        | 'plannedStart'
        | 'plannedEnd'
        | 'restDays'
        | 'dailyTargetDossiers'
        | 'accountStatus'
      >
    >,
    options?: { newPassword?: string; reason?: string; assignedProjectIds?: string[] }
  ): Promise<{ error?: string }> => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = await storageService.updateManagedUser(userId, patch, currentUser, options);
    setEmployees(res.users);
    setSchedules(storageService.getSchedules());
    if (!res.error) {
      setAllProjects(storageService.getProjects());
    }
    setAuditLogs(storageService.getAuditLogs());
    if (!res.error && userId === currentUser.id) {
      const refreshedSession = storageService.getSessionUser();
      if (refreshedSession) {
        setCurrentUser(refreshedSession);
      }
    }
    if (!res.error) {
      setPlanningRevision((r) => r + 1);
      if (storageService.canUserManageLeaves(currentUser)) {
        setLeaves(storageService.getLeavesForManagement(currentUser).leaves);
      }
    }
    return res.error ? { error: res.error } : {};
  };

  const handleSetAccountStatus = (
    employeeId: string,
    status: AccountStatus,
    reason?: string
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.setEmployeeAccountStatus(employeeId, status, currentUser, reason);
    setEmployees(res.users);
    setAuditLogs(storageService.getAuditLogs());
    if (!res.error) {
      setPlanningRevision((r) => r + 1);
      if (storageService.canUserManageLeaves(currentUser)) {
        setLeaves(storageService.getLeavesForManagement(currentUser).leaves);
      }
    }
    return res.error ? { error: res.error } : {};
  };

  const handleSaveTeam = (team: Omit<TeamRecord, 'id'> & { id?: string }) => {
    if (!currentUser) return;
    setTeams(storageService.saveTeam(team, currentUser));
    setAuditLogs(storageService.getAuditLogs());
    if (storageService.canUserManageLeaves(currentUser)) {
      setLeaves(storageService.getLeavesForManagement(currentUser).leaves);
    }
  };

  const handleReviewCorrectionRequest = (
    requestId: string,
    decision: 'approuvee' | 'refusee',
    note?: string
  ) => {
    if (!currentUser) return;
    setCorrectionRequests(
      storageService.reviewCorrectionRequest(requestId, decision, currentUser, note)
    );
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleEvaluateQc = (
    qcId: string,
    payload: {
      status: QualityStatus;
      criteriaResults: QualityCriterionResult[];
      observations: string;
    }
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.evaluateQualityControl(qcId, payload, currentUser);
    setQualityControls(res.records);
    setTreatmentActivities(storageService.getAllTreatmentActivities());
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleAddCriterion = (label: string) => {
    if (!currentUser) return;
    setQualityCriteria(storageService.addQualityCriterion(label, currentUser));
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleToggleCriterion = (id: string, active: boolean) => {
    setQualityCriteria(storageService.toggleQualityCriterion(id, active, currentUser ?? undefined));
  };

  const handleSaveReferenceTime = (companyId: string, taskId: string, minutes: number) => {
    if (!currentUser) return;
    setReferenceTimes(storageService.saveReferenceTime(companyId, taskId, minutes, currentUser));
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleAddObjective = (obj: Omit<ProductionObjective, 'id'>) => {
    if (!currentUser) return;
    setObjectives(storageService.addObjective(obj, currentUser));
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleDeleteObjective = (id: string) => {
    setObjectives(storageService.deleteObjective(id));
  };

  const handleCreateLeave = (input: {
    employeeId: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    motif?: string;
    status: LeaveStatus;
  }): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.createLeave(input, currentUser);
    setLeaves(res.leaves);
    setAuditLogs(storageService.getAuditLogs());
    if (!res.error) setPlanningRevision((r) => r + 1);
    return res.error ? { error: res.error } : {};
  };

  const handleUpdateLeave = (
    leaveId: string,
    patch: {
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
      motif?: string;
      status: LeaveStatus;
    }
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.updateLeave(leaveId, patch, currentUser);
    setLeaves(res.leaves);
    setAuditLogs(storageService.getAuditLogs());
    if (!res.error) setPlanningRevision((r) => r + 1);
    return res.error ? { error: res.error } : {};
  };

  const handleUpdateLeaveStatus = (leaveId: string, status: LeaveStatus): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.updateLeaveStatus(leaveId, status, currentUser);
    setLeaves(res.leaves);
    setAuditLogs(storageService.getAuditLogs());
    if (!res.error) setPlanningRevision((r) => r + 1);
    return res.error ? { error: res.error } : {};
  };

  const handleCreateProject = (input: {
    name: string;
    code?: string;
    description?: string;
    templateId?: string;
    fields?: ProjectFormField[];
    assignedTeamIds?: string[];
    addedEmployeeIds?: string[];
    companies?: string[];
    tasks?: string[];
  }): { created?: ProjectRecord; error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.createProject(input, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return { created: res.created, error: res.error };
  };

  const handleAddProjectCompany = (projectId: string, name: string): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.addProjectCompany(projectId, name, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleUpdateProjectCompany = (
    projectId: string,
    companyId: string,
    name: string
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.updateProjectCompany(projectId, companyId, name, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleRemoveProjectCompany = (
    projectId: string,
    companyId: string
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.removeProjectCompany(projectId, companyId, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleAddProjectTask = (projectId: string, name: string): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.addProjectTask(projectId, name, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleUpdateProjectTask = (
    projectId: string,
    taskId: string,
    name: string
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.updateProjectTask(projectId, taskId, name, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleRemoveProjectTask = (projectId: string, taskId: string): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.removeProjectTask(projectId, taskId, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleUpdateProjectInfo = (
    projectId: string,
    patch: { name: string; code: string; description: string }
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.updateProjectInfo(projectId, patch, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleToggleProjectActive = (projectId: string, active: boolean): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.toggleProjectActive(projectId, active, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleUpdateProjectAssignments = (
    projectId: string,
    payload: {
      assignedTeamIds: string[];
      addedEmployeeIds: string[];
      excludedEmployeeIds: string[];
    }
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.updateProjectAssignments(projectId, payload, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleToggleEmployeeProjectAssignment = (
    projectId: string,
    employeeId: string,
    assigned: boolean
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.toggleEmployeeAssignmentOnProject(
      projectId,
      employeeId,
      assigned,
      currentUser
    );
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handlePublishProjectFormVersion = (
    projectId: string,
    fields: ProjectFormField[],
    options: { sourceTemplateId?: string; sourceTemplateName?: string; changeNote?: string }
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.publishProjectFormVersion(projectId, fields, options, currentUser);
    setAllProjects(res.projects);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleCreateFormTemplate = (input: {
    name: string;
    description?: string;
    fields: ProjectFormField[];
  }): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.createFormTemplate(input, currentUser);
    setFormTemplates(res.templates);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleUpdateFormTemplate = (
    templateId: string,
    input: { name: string; description?: string; fields: ProjectFormField[] }
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.updateFormTemplate(templateId, input, currentUser);
    setFormTemplates(res.templates);
    setAuditLogs(storageService.getAuditLogs());
    return res.error ? { error: res.error } : {};
  };

  const handleSetUserPlanningAccess = (
    userId: string,
    authorized: boolean
  ): { error?: string } => {
    if (!currentUser) return { error: 'Session expirée.' };
    const res = storageService.setUserPlanningAccess(userId, authorized, currentUser);
    setPlanningAuthorizedUserIds(res.authorizedUserIds);
    setAuditLogs(storageService.getAuditLogs());
    if (!res.error) setPlanningRevision((r) => r + 1);
    return res.error ? { error: res.error } : {};
  };

  const handlePlanningChanged = () => {
    setPlanningRevision((r) => r + 1);
  };

  if (!currentUser) {
    const needsInitialSetup =
      !storageService.isSystemInitialized() || !storageService.hasAnyAdmin();
    return needsInitialSetup ? (
      <InitialAdminSetupScreen onInitialized={loadUserWorkspace} />
    ) : (
      <LoginScreen onLogin={loadUserWorkspace} />
    );
  }

  const canAccessPlanning = storageService.canUserAccessPlanning(currentUser);
  const safeModule: NavModuleId = canAccessModule(
    currentUser.role,
    activeModule,
    supervisorPermissions,
    canAccessPlanning
  )
    ? activeModule
    : getDefaultModuleForRole(currentUser.role);

  const livePresenceSeconds = shiftState
    ? storageService.computeLivePresenceSeconds(shiftState, nowMs)
    : 0;
  const liveProductiveSeconds = shiftState
    ? storageService.computeLiveProductiveSeconds(shiftState, nowMs)
    : 0;
  const livePauseSeconds = shiftState
    ? storageService.computeLivePauseSeconds(shiftState, nowMs)
    : 0;

  const userSchedule = schedules.find((s) => s.userId === currentUser.id) ?? null;
  const usedPausesToday =
    currentUser.role === 'employee' ? storageService.getUsedPauseSlotsToday(currentUser.id) : {};
  const userOutingRequests = outingRequests.filter((r) => r.userId === currentUser.id);
  const userCorrectionRequests = correctionRequests.filter((r) => r.employeeId === currentUser.id);
  const myLeaves =
    (void planningRevision, void leaves, storageService.getMyLeaves(currentUser.id));
  const userProjects =
    (void allProjects,
    void employees,
    void teams,
    storageService.getProjectsForUser(currentUser));

  return (
    <AppShell
      currentUser={currentUser}
      supervisorPermissions={supervisorPermissions}
      canAccessPlanning={canAccessPlanning}
      activeModule={safeModule}
      onSelectModule={handleSelectModule}
      onLogout={handleLogout}
    >
      {/* Espace Employé */}
      {currentUser.role === 'employee' && shiftState && (
        <>
          {safeModule === 'employee_home' && (
            <EmployeeDashboard
              user={currentUser}
              shiftState={shiftState}
              schedule={userSchedule}
              activities={activities}
              myLeaves={myLeaves}
              nowMs={nowMs}
              livePresenceSeconds={livePresenceSeconds}
              liveProductiveSeconds={liveProductiveSeconds}
              livePauseSeconds={livePauseSeconds}
              lateToleranceMinutes={adminConfig.lateToleranceMinutes}
              onChangeServiceStatus={handleChangeServiceStatus}
              onSyncPending={handleSyncPending}
              onNavigate={handleSelectModule}
            />
          )}
          {safeModule === 'employee_treatment' && (
            <EmployeeTreatmentView
              shiftState={shiftState}
              nowMs={nowMs}
              projects={userProjects}
              allProjectsCount={allProjects.length}
              lastSavedActivity={lastSavedActivity}
              onStartTreatment={handleStartTreatment}
              onUpdateTimerFields={handleUpdateTimerFields}
              onCompleteTimer={handleCompleteTimer}
              onNavigate={handleSelectModule}
            />
          )}
          {safeModule === 'employee_activities' && (
            <EmployeeActivitiesView
              shiftState={shiftState}
              nowMs={nowMs}
              adminConfig={adminConfig}
              activities={activities}
              usedPausesToday={usedPausesToday}
              outingRequests={userOutingRequests}
              lastSavedActivity={lastSavedActivity}
              onStartPause={handleStartPause}
              onStartOuting={handleStartOuting}
              onUpdateTimerFields={handleUpdateTimerFields}
              onCompleteTimer={handleCompleteTimer}
              onCreateOutingRequest={handleCreateOutingRequest}
              onNavigate={handleSelectModule}
            />
          )}
          {safeModule === 'employee_history' && (
            <EmployeeHistoryView
              user={currentUser}
              activities={activities}
              correctionRequests={userCorrectionRequests}
              projects={allProjects}
              onCreateCorrectionRequest={handleCreateCorrectionRequest}
            />
          )}
          {safeModule === 'employee_stats' && (
            <EmployeeStatsView
              user={currentUser}
              activities={activities}
              qualityControls={qualityControls}
              referenceTimes={referenceTimes}
              projects={allProjects}
              livePresenceSeconds={livePresenceSeconds}
              liveProductiveSeconds={liveProductiveSeconds}
              livePauseSeconds={livePauseSeconds}
            />
          )}
        </>
      )}

      {/* Espace Gestion (Administrateur, Manager, Superviseur) */}
      {currentUser.role !== 'employee' && (
        <>
          {safeModule === 'mgmt_dashboard' && (
            <ManagementDashboard
              user={currentUser}
              employees={employees}
              teams={teams}
              companies={companies}
              qualityControls={qualityControls}
              outingRequests={outingRequests}
              correctionRequests={correctionRequests}
              myLeaves={myLeaves}
              onReviewOutingRequest={handleReviewOutingRequest}
              onNavigate={handleSelectModule}
            />
          )}
          {(safeModule === 'mgmt_employees' || safeModule === 'mgmt_teams') && (
            <EmployeesTeamsView
              mode={safeModule === 'mgmt_teams' ? 'teams' : 'employees'}
              user={currentUser}
              employees={employees}
              teams={teams}
              projects={userProjects}
              companies={companies}
              correctionRequests={correctionRequests}
              qualityControls={qualityControls}
              onCreateAccount={handleCreateAccount}
              onImportEmployeesExcel={handleImportEmployeesExcel}
              onUpdateAccount={handleUpdateAccount}
              onSetAccountStatus={handleSetAccountStatus}
              onSaveTeam={handleSaveTeam}
              onReviewCorrectionRequest={handleReviewCorrectionRequest}
            />
          )}
          {safeModule === 'mgmt_projects' && (
            <ProjectsManagementView
              user={currentUser}
              projects={userProjects}
              formTemplates={formTemplates}
              employees={employees}
              teams={teams}
              onCreateProject={handleCreateProject}
              onUpdateProjectInfo={handleUpdateProjectInfo}
              onToggleProjectActive={handleToggleProjectActive}
              onUpdateProjectAssignments={handleUpdateProjectAssignments}
              onToggleEmployeeProjectAssignment={handleToggleEmployeeProjectAssignment}
              onAddProjectCompany={handleAddProjectCompany}
              onUpdateProjectCompany={handleUpdateProjectCompany}
              onRemoveProjectCompany={handleRemoveProjectCompany}
              onAddProjectTask={handleAddProjectTask}
              onUpdateProjectTask={handleUpdateProjectTask}
              onRemoveProjectTask={handleRemoveProjectTask}
              onPublishProjectFormVersion={handlePublishProjectFormVersion}
              onCreateFormTemplate={handleCreateFormTemplate}
              onUpdateFormTemplate={handleUpdateFormTemplate}
            />
          )}
          {safeModule === 'mgmt_schedules' && (
            <SchedulesOutingsView
              user={currentUser}
              employees={employees}
              schedules={schedules}
              outingRequests={outingRequests}
              canApproveOutings={hasPermission(
                currentUser.role,
                'approve:outings',
                supervisorPermissions
              )}
              onSaveEmployeeSchedule={handleSaveEmployeeSchedule}
              onReviewOutingRequest={handleReviewOutingRequest}
            />
          )}
          {safeModule === 'mgmt_leaves' && storageService.canUserManageLeaves(currentUser) && (
            <LeavesManagementView
              user={currentUser}
              employees={employees}
              manageableEmployees={storageService.getManageableEmployeesForLeaves(currentUser)}
              leaves={leaves}
              onCreateLeave={handleCreateLeave}
              onUpdateLeave={handleUpdateLeave}
              onUpdateLeaveStatus={handleUpdateLeaveStatus}
            />
          )}
          {safeModule === 'mgmt_quality' && (
            <QualityControlView
              user={currentUser}
              qualityControls={qualityControls}
              qualityCriteria={qualityCriteria}
              companies={companies}
              projects={storageService.getQualityControlProjectsForUser(currentUser)}
              employees={employees}
              onEvaluateQc={handleEvaluateQc}
              onAddCriterion={handleAddCriterion}
              onToggleCriterion={handleToggleCriterion}
            />
          )}
          {safeModule === 'mgmt_objectives' && (
            <ObjectivesStatsView
              user={currentUser}
              employees={employees}
              teams={teams}
              companies={companies}
              tasks={tasks}
              projects={allProjects}
              treatmentActivities={treatmentActivities}
              referenceTimes={referenceTimes}
              objectives={objectives}
              qualityControls={qualityControls}
              onSaveReferenceTime={handleSaveReferenceTime}
              onAddObjective={handleAddObjective}
              onDeleteObjective={handleDeleteObjective}
            />
          )}
          {safeModule === 'mgmt_reports' && (
            <ReportsView
              user={currentUser}
              employees={employees}
              teams={teams}
              companies={companies}
              tasks={tasks}
              projects={allProjects}
              qualityControls={qualityControls}
            />
          )}
          {safeModule === 'mgmt_settings' && (
            <SettingsAuditView
              adminConfig={adminConfig}
              supervisorPermissions={supervisorPermissions}
              employees={employees}
              planningAuthorizedUserIds={planningAuthorizedUserIds}
              auditLogs={auditLogs}
              theme={theme}
              onChangeTheme={handleChangeTheme}
              onSaveAdminConfig={handleSaveAdminConfig}
              onSaveSupervisorPermissions={handleSaveSupervisorPermissions}
              onSetUserPlanningAccess={handleSetUserPlanningAccess}
            />
          )}
        </>
      )}

      {safeModule === 'planning' && canAccessPlanning && (
        <PlanningView
          user={currentUser}
          employees={employees}
          revision={planningRevision}
          onPlanningChanged={handlePlanningChanged}
        />
      )}

      {safeModule === 'profile' && (
        <ProfileView
          user={currentUser}
          supervisorPermissions={supervisorPermissions}
          schedule={userSchedule}
          theme={theme}
          onChangeTheme={handleChangeTheme}
        />
      )}
    </AppShell>
  );
}
