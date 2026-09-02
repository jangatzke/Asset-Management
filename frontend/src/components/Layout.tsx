import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';
import {
  HomeIcon,
  CubeIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  FireIcon,
  Cog6ToothIcon,
  CogIcon,
  ChevronDownIcon,
  UserIcon,
  KeyIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon, BellAlertIcon,
  BanknotesIcon,
  ServerIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, logout, checkAuth } = useAuthStore();
  const { t } = useI18n();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && user?.mustChangePasswordOnNext && location.pathname !== '/settings') {
      navigate('/settings');
    }
  }, [isLoading, user, navigate, location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    };
    if (userMenuOpen) {
      document.addEventListener('click', closeMenu);
      return () => document.removeEventListener('click', closeMenu);
    }
  }, [userMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileMenuOpen(false);
      setUserMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const isAdmin = user?.roles?.includes('system_admin');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-sm text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const navigation = [
    { name: t('navigation.dashboard'), href: '/', icon: HomeIcon },
    { name: t('navigation.assets'), href: '/assets', icon: CubeIcon },
    { name: t('navigation.risks'), href: '/risks', icon: ExclamationTriangleIcon },
    { name: t('navigation.controls'), href: '/controls', icon: ShieldCheckIcon },
    { name: t('navigation.incidents'), href: '/incidents', icon: FireIcon },
    { name: t('navigation.tickets'), href: '/tickets', icon: ClipboardDocumentListIcon },
    { name: 'NIS2', href: '/nis2', icon: ShieldCheckIcon },
    { name: t('navigation.contracts'), href: '/contracts', icon: DocumentTextIcon },
    { name: t('navigation.licenses'), href: '/licenses', icon: ClipboardDocumentListIcon },
    { name: t('navigation.processes'), href: '/processes', icon: ServerIcon },
    { name: t('navigation.costPlanning'), href: '/cost-planning', icon: BanknotesIcon },
    { name: t('navigation.ismsOperations'), href: '/isms-operations', icon: ChartBarIcon },
    { name: t('navigation.ismsProcessWorkspace'), href: '/isms-operations/process', icon: ClipboardDocumentCheckIcon },
    ...(isAdmin ? [
      { name: t('navigation.riskAggregation'), href: '/risk-aggregation', icon: ChartBarIcon },
      { name: t('navigation.admin'), href: '/admin/users', icon: Cog6ToothIcon },
    ] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/admin/users' && location.pathname.startsWith('/admin')) {
      return true;
    }
    if (href === '/isms-operations') {
      return location.pathname === '/isms-operations' || location.pathname === '/isms-phase6';
    }
    // Exact match or sub-path match (e.g. /isms-operations/process)
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const adminSubPages = [
    { name: t('navigation.userManagement'), href: '/admin/users' },
    { name: t('navigation.roleManagement'), href: '/admin/roles' },
    { name: t('navigation.groupManagement'), href: '/admin/groups' },
    { name: t('navigation.assetTypes'), href: '/admin/asset-types' },
    { name: t('navigation.organizationUnits'), href: '/admin/organization-units' },
    { name: t('navigation.oidcConfig'), href: '/admin/oidc' },
    { name: t('navigation.authSettings'), href: '/admin/auth-settings' },
    { name: t('intune.title'), href: '/admin/intune' },
    { name: t('navigation.vmwareConfig'), href: '/admin/vmware' },
    { name: t('navigation.proxmoxConfig'), href: '/admin/proxmox' },
    { name: t('navigation.reminderSettings'), href: '/admin/reminders' },
    { name: t('navigation.emailGateway'), href: '/admin/email-gateway' },
    { name: t('navigation.fiscalYearSettings'), href: '/admin/fiscal-year' },
    { name: t('navigation.databaseBackup'), href: '/admin/database' },
    { name: t('navigation.ticketSlaSettings'), href: '/admin/ticket-slas' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-[100] px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded shadow-md"
      >
        Skip to main content
      </a>
      <nav className="bg-white dark:bg-gray-800 shadow-sm" aria-label="Main navigation">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between min-h-16 gap-3 py-2 lg:py-0">
            <div className="flex items-center flex-1 min-w-0 overflow-hidden">
                <div className="flex-shrink-0 flex items-center min-w-0">
                 <ShieldCheckIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white truncate">
                  {t('navigation.applicationName')}
                </span>
              </div>
              <div className="hidden lg:ml-6 lg:flex lg:flex-wrap lg:items-center lg:gap-1 min-w-0 overflow-hidden">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-2 xl:px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                      isActive(item.href)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <item.icon className="h-5 w-5 inline mr-1" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
              <div className="flex items-center flex-shrink-0">
               <Link to="/action-center" data-testid="action-center-nav" className={`relative mr-2 rounded-md p-2 ${isActive('/action-center') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`} aria-label="Open Action Center">
                 <BellAlertIcon className="h-5 w-5" aria-hidden="true" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 mr-2"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation-menu"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
              </button>

              {/* User Menu */}
              <div ref={userMenuRef} className="relative ml-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserMenuOpen(!userMenuOpen);
                  }}
                  className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none"
                  aria-haspopup="menu"
                  aria-controls="user-menu"
                  aria-expanded={userMenuOpen}
                  aria-label="User menu"
                >
                  <UserIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="hidden max-w-36 truncate font-medium sm:inline">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                </button>

                {userMenuOpen && (
                  <div
                    id="user-menu"
                    role="menu"
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user?.email}
                      </div>
                      <div className="text-xs mt-1">
                        {user?.isOidcLinked ? (
                          <span className="text-blue-600 dark:text-blue-400">
                            {t('settings.oidcLinked')}
                          </span>
                        ) : (
                          <span className="text-gray-500">{t('settings.localAccount')}</span>
                        )}
                      </div>
                    </div>
                    <Link
                      to="/settings"
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <CogIcon className="h-4 w-4 inline mr-2" />
                      {t('settings.title')}
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <KeyIcon className="h-4 w-4 inline mr-2" />
                      {t('navigation.logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {mobileMenuOpen && (
            <div id="mobile-navigation-menu" className="lg:hidden border-t border-gray-200 dark:border-gray-700 py-3" role="navigation" aria-label="Mobile navigation">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive(item.href)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <item.icon className="h-5 w-5 inline mr-1" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>
      {isAdmin && location.pathname.startsWith('/admin') && (
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm border-b border-gray-200 dark:border-gray-700 mb-6 py-3 overflow-visible">
            {adminSubPages.map((page) => (
              <Link
                key={page.href}
                to={page.href}
                className={`font-medium whitespace-nowrap ${
                  location.pathname === page.href
                    ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {page.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
      <main id="main-content" className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
