'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('Mein Unternehmen');
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: '🏠' },
    { name: 'Rechnungen', href: '/invoices', icon: '📄' },
    { name: 'Rechnung importieren', href: '/invoices/import', icon: '📥' },
    { name: 'Projekte', href: '/projects', icon: '🎯' },
    { name: 'Cash Flow', href: '/cashflow', icon: '📊' },
    { name: 'Liquidität', href: '/liquidity', icon: '💰' },
    { name: 'Analytics', href: '/analytics', icon: '📈' },
    { name: 'Bank', href: '/bank', icon: '🏦' },
    { name: 'Finanzen', href: '/finance', icon: '💳' },
    { name: 'Geschäftspartner', href: '/business-partners', icon: '🤝' },
    { name: 'Genehmigungen', href: '/approvals', icon: '✅' },
    { name: 'Zahlungen', href: '/payments', icon: '💸' },
    { name: 'Archiv', href: '/archive', icon: '📁' },
    { name: 'Export', href: '/export', icon: '📤' },
    { name: 'Support', href: '/support', icon: '🆘' },
    { name: 'Benachrichtigungen', href: '/notifications', icon: '🔔' },
    { name: 'Einstellungen', href: '/settings', icon: '⚙️' },
  ];

  return (
    <div
      className={`bg-white border-r border-gray-200 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}
    >
      {/* Company Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">€</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {selectedCompany}
                </h2>
                <p className="text-xs text-gray-500">Finanzverwaltung</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {navigation.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      {!isCollapsed && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">U</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Benutzer</p>
                <p className="text-xs text-gray-500">admin@example.com</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
