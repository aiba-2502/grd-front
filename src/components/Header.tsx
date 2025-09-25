'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContextOptimized';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // ページ遷移時にモバイルメニューを閉じる
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  if (!user) {
    return null;
  }

  // ナビゲーションアイテムの定義
  const navItems = [
    { href: '/', label: 'ホーム' },
    { href: '/mypage', label: 'マイページ' },
    { href: '/information', label: '使い方' },
  ];

  // アクティブなリンクかどうかを判定
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="bg-white shadow-sm border-b relative z-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="flex items-center h-16 max-w-screen-2xl mx-auto">
          {/* ロゴ - 左側固定幅 */}
          <div className="w-40 lg:w-48 xl:w-56 flex-shrink-0">
            <Link href="/" className="text-lg sm:text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors inline-block">
              心のログ
            </Link>
          </div>

          {/* デスクトップナビゲーション - 中央配置 */}
          <nav className="hidden md:flex flex-1 justify-center items-center">
            <div className="flex items-center space-x-6 lg:space-x-8 xl:space-x-10">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm lg:text-base font-medium transition-colors whitespace-nowrap ${
                    isActive(item.href)
                      ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          {/* ユーザー情報（デスクトップ） - 右側固定幅 */}
          <div className="hidden md:flex items-center justify-end w-40 lg:w-48 xl:w-56">
            <span className="text-xs lg:text-sm text-gray-700 truncate max-w-[150px] lg:max-w-[200px] xl:max-w-[250px]" title={user.name || user.email}>
              {user.name || user.email}
            </span>
          </div>

          {/* モバイルメニューボタン */}
          <div className="md:hidden flex items-center space-x-2">
            {/* モバイル時のユーザー名表示（短縮版） */}
            <span className="text-xs text-gray-600 truncate max-w-[100px]">
              {user.name?.split(' ')[0] || user.email?.split('@')[0]}
            </span>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
              aria-label="メニューを開く"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* モバイルメニュー */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-gray-200 pt-2">
                <div className="px-3 py-2 text-sm text-gray-700">
                  {user.name || user.email}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}