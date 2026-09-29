import {
  BriefcaseBusiness,
  Columns3,
  GanttChart,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useMatches } from 'react-router';
import { useCurrentUser, useLogout } from '../api/hooks';
import { cn } from '../lib/cn';
import { useTheme, type Theme } from '../lib/theme';
import { ButtonLink } from './ui/Button';

const NAVIGATION = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/jobs', label: 'Jobs', icon: List, end: true },
  { to: '/board', label: 'Board', icon: Columns3, end: true },
  { to: '/timeline', label: 'Timeline', icon: GanttChart, end: true },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase() || '?';
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-lg bg-indigo-600 p-1.5 text-white">
        <BriefcaseBusiness className="size-4" aria-hidden />
      </div>
      <span className="text-base font-semibold tracking-tight">Jobify</span>
    </div>
  );
}

function ThemeSwitcher() {
  const [theme, setTheme] = useTheme();
  return (
    <div
      className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800"
      role="radiogroup"
      aria-label="Theme"
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'flex flex-1 justify-center rounded-md py-1.5 transition-colors',
            theme === value
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
          )}
        >
          <Icon className="size-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const logout = useLogout();

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Logo />
      <ButtonLink
        to="/jobs/new"
        variant="primary"
        icon={<Plus className="size-4" />}
        onClick={onNavigate}
      >
        Add job
      </ButtonLink>
      <nav className="flex flex-col gap-1">
        {NAVIGATION.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-3">
        <ThemeSwitcher />
        <div className="flex items-center gap-3 rounded-lg px-1 py-1">
          <div
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          >
            {initials(user.displayName)}
          </div>
          <NavLink
            to="/settings/account"
            onClick={onNavigate}
            className="min-w-0 flex-1 hover:underline"
          >
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{user.username}</p>
          </NavLink>
          <button
            type="button"
            onClick={() => logout.mutate()}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  // Pages such as the board opt out of the centred column to use the whole width.
  const fullWidth = useMatches().some(
    (match) => (match.handle as { fullWidth?: boolean } | undefined)?.fullWidth,
  );

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-900">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-900/90">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-zinc-950/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <main
        className={cn(
          'px-4 py-6 sm:px-6',
          fullWidth
            ? 'flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-dvh lg:px-6 lg:py-6'
            : 'mx-auto max-w-7xl lg:px-8 lg:py-8',
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
