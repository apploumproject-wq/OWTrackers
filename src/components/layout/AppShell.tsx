import React, { useState } from 'react';
import {
  Home,
  PlayCircle,
  ListChecks,
  History,
  BarChart3,
  UserCircle,
  LayoutDashboard,
  Users,
  Building2,
  ClipboardList,
  CalendarClock,
  ShieldCheck,
  Target,
  FileSpreadsheet,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Info,
} from 'lucide-react';
import { AppUser, NavModuleId, Permission } from '../../core/types';
import { getNavItemsForRole, ROLE_LABELS } from '../../core/permissions';
import { BrandLogo } from '../ui/DataPrimitives';

interface AppShellProps {
  currentUser: AppUser;
  supervisorPermissions: Permission[];
  activeModule: NavModuleId;
  onSelectModule: (moduleId: NavModuleId) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const MODULE_ICONS: Record<NavModuleId, React.ComponentType<{ className?: string }>> = {
  employee_home: Home,
  employee_treatment: PlayCircle,
  employee_activities: ListChecks,
  employee_history: History,
  employee_stats: BarChart3,
  profile: UserCircle,
  mgmt_dashboard: LayoutDashboard,
  mgmt_employees: Users,
  mgmt_teams: Users,
  mgmt_clients: Building2,
  mgmt_tasks: ClipboardList,
  mgmt_schedules: CalendarClock,
  mgmt_quality: ShieldCheck,
  mgmt_objectives: Target,
  mgmt_reports: FileSpreadsheet,
  mgmt_settings: Settings,
};

export function AppShell({
  currentUser,
  supervisorPermissions,
  activeModule,
  onSelectModule,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const navItems = getNavItemsForRole(currentUser.role, supervisorPermissions);
  const currentNavItem = navItems.find((n) => n.id === activeModule) ?? navItems[0];

  const principalItems = navItems.filter((i) => i.section === 'principal');
  const pilotageItems = navItems.filter((i) => i.section === 'pilotage');
  const adminItems = navItems.filter((i) => i.section === 'administration');

  const handleNavClick = (id: NavModuleId) => {
    onSelectModule(id);
    setMobileMenuOpen(false);
  };

  const renderNavGroup = (title: string | null, items: typeof navItems) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        {title && (
          <div className="px-3 pt-4 pb-1.5 text-[11px] font-medium text-slate-400 dark:text-[#C8C2D0]/70">
            {title}
          </div>
        )}
        {items.map((item) => {
          const Icon = MODULE_ICONS[item.id];
          const isActive = item.id === activeModule;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-[#A83CE2] ${
                isActive
                  ? 'bg-[#A83CE2] text-white'
                  : 'text-slate-700 dark:text-[#C8C2D0] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15 hover:text-[#7624A8] dark:hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-500 dark:text-[#C8C2D0]'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#292631] border-r border-slate-200 dark:border-[#393342] text-slate-900 dark:text-white">
      <div className="px-5 h-16 border-b border-slate-200 dark:border-[#393342] flex items-center justify-between shrink-0">
        <BrandLogo />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-md text-slate-500 dark:text-[#C8C2D0] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#211E27] cursor-pointer"
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2" aria-label="Navigation principale">
        {renderNavGroup(null, principalItems)}
        {renderNavGroup('Gestion', pilotageItems)}
        {renderNavGroup('Compte & outils', adminItems)}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-[#393342] bg-slate-50/70 dark:bg-[#211E27] space-y-3">
        <div className="px-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {currentUser.fullName}
          </div>
          <div className="text-xs text-slate-500 dark:text-[#C8C2D0] flex items-center gap-1.5 mt-0.5">
            <span className="font-medium text-[#7624A8] dark:text-[#D896FF]">
              {ROLE_LABELS[currentUser.role]}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{currentUser.matricule}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0 text-slate-400 dark:text-[#C8C2D0]" aria-hidden="true" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#17151C] flex">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white dark:bg-[#292631] border-b border-slate-200 dark:border-[#393342] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-[#C8C2D0] hover:bg-slate-100 dark:hover:bg-[#211E27] hover:text-slate-900 dark:hover:text-white cursor-pointer"
              aria-label="Ouvrir le menu de navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-medium text-slate-500 dark:text-[#C8C2D0] hidden sm:inline whitespace-nowrap">
                {ROLE_LABELS[currentUser.role]}
              </span>
              <ChevronRight
                className="w-4 h-4 text-slate-400 dark:text-[#C8C2D0] hidden sm:inline shrink-0"
                aria-hidden="true"
              />
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {currentNavItem?.label ?? 'Accueil'}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs">
            <span className="hidden sm:inline font-mono text-slate-500 dark:text-[#C8C2D0]">
              {currentUser.matricule}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-[#C8C2D0] hover:text-[#7624A8] dark:hover:text-white bg-slate-100 dark:bg-[#211E27] hover:bg-[#F7EEFC] dark:hover:bg-[#A83CE2]/15 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>

        <footer className="border-t border-slate-200 dark:border-[#393342] bg-white dark:bg-[#292631] px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-500 dark:text-[#C8C2D0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>© 2026 AppLoumProject — apploumproject@gmail.com</span>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7624A8] dark:text-[#D896FF] hover:underline cursor-pointer w-fit"
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            <span>À propos</span>
          </button>
        </footer>
      </div>

      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70"
            onClick={() => setAboutOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-[#292631] border border-slate-200 dark:border-[#393342] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl z-10">
            <div className="flex items-center justify-between">
              <BrandLogo />
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-[#C8C2D0] hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#211E27] cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-slate-700 dark:text-[#C8C2D0] space-y-2">
              <div className="font-semibold text-slate-900 dark:text-white">
                OWTrackers — Gestion du temps, productivité et contrôle qualité BPO
              </div>
              <div className="text-xs text-slate-600 dark:text-[#C8C2D0]">
                Architecture prête pour déploiement serveur sécurisé, PostgreSQL et infrastructure hybride Cloud + serveur interne.
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-[#393342] text-xs text-slate-600 dark:text-[#C8C2D0] space-y-1">
              <div className="font-semibold text-slate-900 dark:text-white">
                © 2026 AppLoumProject
              </div>
              <div>Contact : apploumproject@gmail.com</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
