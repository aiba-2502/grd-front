'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  DocumentChartBarIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  ClockIcon as ClockIconSolid,
  DocumentChartBarIcon as DocumentChartBarIconSolid
} from '@heroicons/react/24/solid';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'ホーム',
      href: '/',
      icon: HomeIcon,
      activeIcon: HomeIconSolid,
    },
    {
      name: 'チャット',
      href: '/chat',
      icon: ChatBubbleLeftRightIcon,
      activeIcon: ChatBubbleLeftRightIconSolid,
    },
    {
      name: '履歴',
      href: '/history',
      icon: ClockIcon,
      activeIcon: ClockIconSolid,
    },
    {
      name: 'レポート',
      href: '/report',
      icon: DocumentChartBarIcon,
      activeIcon: DocumentChartBarIconSolid,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-4 sm:px-6 lg:px-8 pb-4">
      <nav className="mx-auto max-w-md sm:max-w-lg lg:max-w-2xl">
        <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-lg border border-gray-100/50">
          <div className="flex justify-around items-center h-20 px-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = isActive ? item.activeIcon : item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center justify-center px-4 py-2 transition-all duration-200 ${
                    isActive 
                      ? 'text-blue-600' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon className={`transition-all duration-200 ${
                    isActive ? 'w-9 h-9' : 'w-8 h-8'
                  }`} />
                  <span className={`text-xs font-medium mt-1 transition-all duration-200 ${
                    isActive ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {item.name}
                  </span>
                  
                  {/* アクティブインジケータ */}
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}