import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
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
  ClipboardDocumentListIcon,
  ServerIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, logout, checkAuth } = useAuthStore();
  const { t } = useI18n();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [isLoading, user, navigate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const closeMenu = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      document.addEventListener('click', closeMenu);
      return () => document.removeEventListener('click', closeMenu);
    }
  }, [userMenuOpen]);

  const isAdmin = user?.roles?.includes('system_admin');

  const navigation = [
    { name: t('navigation.dashboard'), href: '/', icon: HomeIcon },
    { name: t('navigation.assets'), href: '/assets', icon: CubeIcon },
    { name: t('navigation.risks'), href: '/risks', icon: ExclamationTriangleIcon },
    { name: t('navigation.controls'), href: '/controls', icon: ShieldCheckIcon },
    { name: t('navigation.incidents'), href: '/incidents', icon: FireIcon },
    { name: 'Contracts', href: '/contracts', icon: DocumentTextIcon },
    { name: 'Licenses', href: '/licenses', icon: ClipboardDocumentListIcon },
    { name: 'Processes', href: '/processes', icon: ServerIcon },
    ...(isAdmin ? [
      { name: 'Risk Aggregation', href: '/risk-aggregation', icon: ChartBarIcon },
      { name: t('navigation.admin'), href: '/admin/users', icon: Cog6ToothIcon },
    ] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/admin/users' && location.pathname.startsWith('/admin')) {
      return true;
    }
    // Check for sub-path matches for new pages
    const pathParts = location.pathname.split('/').filter(Boolean);
    const hrefParts = href.split('/').filter(Boolean);
    if (pathParts.length > 0 && hrefParts.length > 0) {
      return pathParts[0] === hrefParts[hrefParts.length - 1];
    }
    return location.pathname === href;
  };

  const adminSubPages = [
    { name: t('navigation.userManagement'), href: '/admin/users' },
    { name: t('navigation.roleManagement'), href: '/admin/roles' },
    { name: t('navigation.groupManagement'), href: '/admin/groups' },
    { name: t('navigation.assetTypes'), href: '/admin/asset-types' },
    { name: t('navigation.oidcConfig'), href: '/admin/oidc' },
    { name: 'Intune', href: '/admin/intune' },
    { name: 'VMware vCenter', href: '/admin/vmware' },
    { name: 'Proxmox PVE', href: '/admin/proxmox' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center flex-1 min-w-0 overflow-hidden">
              <div className="flex-shrink-0 flex items-center">
                <ShieldCheckIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white">
                  {t('navigation.applicationName')}
                </span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4 overflow-x-auto">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
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
              {/* Settings Link */}
              <Link
                to="/settings"
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 mr-4"
              >
                <CogIcon className="h-5 w-5" />
              </Link>

              {/* User Menu */}
              <div className="relative mr-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserMenuOpen(!userMenuOpen);
                  }}
                  className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none"
                >
                  <UserIcon className="h-5 w-5" />
                  <span className="font-medium">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                    onClick={(e) => e.stopPropagation()}
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
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <CogIcon className="h-4 w-4 inline mr-2" />
                      {t('settings.title')}
                    </Link>
                    <button
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
        </div>
      </nav>
      {isAdmin && location.pathname.startsWith('/admin') && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-4 text-sm border-b border-gray-200 dark:border-gray-700 mb-6 py-3 overflow-x-auto">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
