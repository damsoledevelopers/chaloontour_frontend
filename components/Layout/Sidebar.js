'use client';
import Link from 'next/link';
import Image from 'next/image';
import { appLogo } from '../../lib/branding';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Users, UserCircle, UserCog, LogOut, X, Calendar, MapPin, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAppBasePath } from '../../lib/appPaths';

function getPanelLabel(role) {
  if (role === 'superadmin') return 'Super Admin';
  if (role === 'staff') return 'Portal User';
  return 'Admin';
}

function getNavItems(role) {
  const basePath = getAppBasePath(role);
  const items = [
    { name: 'Dashboard', href: `${basePath}/dashboard`, icon: LayoutDashboard },
    { name: 'Leads', href: `${basePath}/leads`, icon: Users },
    { name: 'Reminders', href: `${basePath}/calendar`, icon: Calendar },
    { name: 'Trip plans', href: `${basePath}/trips`, icon: MapPin },
    { name: 'Invoices', href: `${basePath}/invoices`, icon: FileSpreadsheet },
    { name: 'Profile', href: `${basePath}/profile`, icon: UserCircle },
  ];

  if (role === 'superadmin') {
    items.push({ name: 'Users', href: `${basePath}/users`, icon: UserCog, superadminOnly: true });
  }

  return items;
}

export default function Sidebar(props) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isOpen = props.isOpen;
  const onClose = props.onClose;
  const isCollapsed = props.isCollapsed ?? false;
  const onToggleCollapse = props.onToggleCollapse ?? (() => {});
  const panelLabel = getPanelLabel(user?.role);
  const navItems = getNavItems(user?.role);

  const dashboardLabel = user?.role === 'staff' ? 'My Dashboard' : 'Dashboard';
  const renderNavContent = (collapsed) => {
    const linkCls = (active) =>
      (active ? 'bg-red-500 text-white font-medium shadow-sm ' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 ') +
      'flex items-center rounded-xl transition-colors ' +
      (collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5');
    return (
      <nav className="mt-5 space-y-0.5 px-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const label = item.href.endsWith('/dashboard') ? dashboardLabel : item.name;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={linkCls(active)}
              title={collapsed ? label : undefined}
            >
              <item.icon className={'h-5 w-5 flex-shrink-0 ' + (collapsed ? '' : 'mr-3.5')} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>
    );
  };
  const contentDesktop = renderNavContent(isCollapsed);
  const contentMobile = renderNavContent(false);

  return (
    <>
      <div className={'no-print fixed inset-0 z-50 lg:hidden ' + (isOpen ? 'block' : 'hidden')}>
        <div className="fixed inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-64 bg-white min-h-full shadow-xl border-r border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <Image src={appLogo} alt="ChaloOnTour" width={140} height={44} className="object-contain" />
              {panelLabel && <p className="text-xs text-red-500 font-medium mt-1">{panelLabel} Panel</p>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"><X className="h-5 w-5" /></button>
          </div>
          {contentMobile}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 flex items-center justify-between bg-white">
            <span className="text-sm font-medium text-gray-700 truncate">{user?.firstName} {user?.lastName}</span>
            <button onClick={logout} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-500 hover:text-white transition-colors"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
      <div className={'no-print hidden lg:flex lg:flex-shrink-0 transition-[width] duration-200 relative ' + (isCollapsed ? 'w-[72px]' : 'w-64')}>
        <div className={'flex flex-col border-r border-gray-200 bg-white min-h-full transition-[width] duration-200 relative ' + (isCollapsed ? 'w-[72px]' : 'w-64')}>
          {/* Toggle: half inside sidebar, half outside - right side, aligned with header bottom line */}
          <button
            onClick={onToggleCollapse}
            className="absolute -right-4 top-[68px] z-20 w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <div className={'border-b border-gray-200 flex items-center overflow-hidden ' + (isCollapsed ? 'p-2 justify-center' : 'p-4')}>
            {isCollapsed ? (
              <Image src={appLogo} alt="ChaloOnTour" width={40} height={40} className="object-contain" />
            ) : (
              <div>
                <Image src={appLogo} alt="ChaloOnTour" width={140} height={44} className="object-contain" />
                {panelLabel && <p className="text-xs text-red-500 font-medium mt-1">{panelLabel} Panel</p>}
              </div>
            )}
          </div>
          {contentDesktop}
          <div className={'mt-auto border-t border-gray-200 bg-white overflow-hidden ' + (isCollapsed ? 'p-2 flex flex-col items-center gap-1' : 'p-4')}>
            {isCollapsed ? (
              <button onClick={logout} className="p-2 rounded-lg text-gray-500 hover:bg-red-500 hover:text-white transition-colors" title="Logout"><LogOut className="h-5 w-5" /></button>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 truncate">{user?.firstName} {user?.lastName}</span>
                <button onClick={logout} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-500 hover:text-white transition-colors"><LogOut className="h-5 w-5" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
