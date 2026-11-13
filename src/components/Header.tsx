import React from 'react';
import { Menu, BookOpen, Download, Wifi, WifiOff, Laptop } from 'lucide-react';

interface HeaderProps {
  onToggleMenu: () => void;
  isMenuOpen: boolean;
  isOnline: boolean;
  onOpenLibrary: () => void;
  onOpenReader: () => void;
  canInstallPWA: boolean;
  onInstallPWA: () => void;
  onOpenInstall?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMenu,
  isMenuOpen,
  isOnline,
  onOpenLibrary,
  onOpenReader,
  canInstallPWA,
  onInstallPWA,
  onOpenInstall,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Right Zone: 3-line hamburger menu & App Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMenu}
            aria-label="منوی اصلی"
            className={`p-2 rounded-lg border transition-colors ${
              isMenuOpen
                ? 'bg-slate-900 text-white border-slate-900'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
              جزوه‌نگار هوشمند
            </span>
            <span className="hidden sm:inline-block text-xs text-slate-400 font-latin tracking-wide">
              Smart Jozveh
            </span>
          </div>
        </div>

        {/* Center Zone: Quiet status & quick view tabs */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
          <button
            onClick={onOpenReader}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 transition font-medium"
          >
            <BookOpen className="w-4 h-4 text-amber-700" />
            <span>کتابخوان و مطالعه</span>
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={onOpenLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-700 transition font-medium"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>کتابخانه خروجی‌ها</span>
          </button>
        </div>

        {/* Left Zone: Network badge & PWA Install Action */}
        <div className="flex items-center gap-2">
          {/* Online/Offline status indicator */}
          <div
            title={isOnline ? 'اتصال برقرار است' : 'حالت آفلاین (استفاده از حافظه دستگاه)'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">آنلاین</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>آفلاین</span>
              </>
            )}
          </div>

          {/* Install Button for Windows and Android */}
          <button
            onClick={() => {
              if (canInstallPWA && onInstallPWA) {
                onInstallPWA();
              } else if (onOpenInstall) {
                onOpenInstall();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition"
            title="نصب نسخه ویندوز و اندروید"
          >
            <Laptop className="w-3.5 h-3.5 text-blue-700" />
            <span>نصب (ویندوز / اندروید)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
