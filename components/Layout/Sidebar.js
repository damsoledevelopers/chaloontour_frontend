'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Users, UserCircle, LogOut, X } from 'lucide-react';

const items = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/admin/leads', icon: Users },
  { name: 'Profile', href: '/admin/profile', icon: UserCircle },
];

export default function Sidebar(props) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isOpen = props.isOpen;
  const onClose = props.onClose;

  const content = (
    <nav className="mt-5 px-2 space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onClose}
            className={(active ? 'bg-primary-100 text-primary-800 font-medium ' : 'text-gray-600 hover:bg-slate-100 hover:text-gray-900 ') + 'flex items-center px-3 py-2.5 rounded-xl transition-colors'}
          >
            <item.icon className="mr-3.5 h-5 w-5 flex-shrink-0" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className={'no-print fixed inset-0 z-50 lg:hidden ' + (isOpen ? 'block' : 'hidden')}>
        <div className="fixed inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-64 bg-white min-h-full shadow-xl border-r border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
            <Image src="/chalo-on-tour-e1766686260447.png" alt="ChaloOnTour" width={140} height={44} className="object-contain" />
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700"><X className="h-5 w-5" /></button>
          </div>
          {content}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 truncate">{user?.firstName} {user?.lastName}</span>
            <button onClick={logout} className="p-1.5 rounded-lg text-gray-500 hover:bg-accent-50 hover:text-accent-600"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
      <div className="no-print hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-gray-100 bg-white min-h-full">
          <div className="p-4 border-b border-gray-100 flex items-center bg-slate-50/30">
            <Image src="/chalo-on-tour-e1766686260447.png" alt="ChaloOnTour" width={140} height={44} className="object-contain" />
          </div>
          {content}
          <div className="mt-auto p-4 border-t border-gray-100 bg-slate-50/30 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 truncate">{user?.firstName} {user?.lastName}</span>
            <button onClick={logout} className="p-1.5 rounded-lg text-gray-500 hover:bg-accent-50 hover:text-accent-600 transition-colors"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
    </>
  );
}
