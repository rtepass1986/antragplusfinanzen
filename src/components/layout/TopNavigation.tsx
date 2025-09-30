'use client';

import { useState } from 'react';

interface TopNavigationProps {
  activeTab:
    | 'liquidity'
    | 'bank'
    | 'expected'
    | 'finance'
    | 'personal-dashboards';
}

export default function TopNavigation({ activeTab }: TopNavigationProps) {
  const [selectedCompany, setSelectedCompany] = useState('Mein Unternehmen');

  const navigationTabs = [
    { id: 'liquidity', name: 'Liquidität', href: '/liquidity' },
    { id: 'bank', name: 'Bank', href: '/bank', hasNotification: true },
    { id: 'expected', name: 'Erwartet', href: '/expected' },
    { id: 'finance', name: 'Finanzen', href: '/finance' },
    {
      id: 'personal-dashboards',
      name: 'Persönliche Dashboards',
      href: '/personal-dashboards',
    },
  ];

  return (
    <div className="bg-gray-100 border-b border-gray-200 px-6 py-2">
      <div className="flex items-center justify-between">
        {/* Left Side - Navigation Tabs */}
        <div className="flex items-center space-x-1">
          {navigationTabs.map(tab => (
            <button
              key={tab.id}
              className={`
                relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
                ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }
              `}
            >
              <div className="flex items-center space-x-2">
                <span>{tab.name}</span>
                {tab.hasNotification && (
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                )}
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Right Side - Actions & Company */}
        <div className="flex items-center space-x-2">
          {/* Action Buttons */}
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors">
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </button>

          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors">
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>

          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors">
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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </button>

          {/* Company Selector */}
          <div className="flex items-center space-x-2">
            <button className="flex items-center space-x-2 px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-white rounded-md transition-colors">
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
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <span className="font-medium">{selectedCompany}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Hamburger Menu */}
          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-md transition-colors">
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
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
