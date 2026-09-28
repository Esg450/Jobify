import { Database, ServerCog, Sparkles, UserRound, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useCurrentUser, useHealth } from '../../api/hooks';
import { PageHeader } from '../../components/PageHeader';
import { cn } from '../../lib/cn';

const SECTIONS = [
  { to: 'account', label: 'Account', icon: UserRound, adminOnly: false },
  { to: 'ai', label: 'AI provider', icon: Sparkles, adminOnly: false },
  { to: 'users', label: 'Users', icon: Users, adminOnly: true },
  { to: 'data', label: 'Your data', icon: Database, adminOnly: false },
  { to: 'system', label: 'System', icon: ServerCog, adminOnly: true },
];

export function SettingsLayout() {
  const user = useCurrentUser();
  const { data: health } = useHealth();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Settings"
        description={
          health &&
          `Jobify ${health.version === 'dev' ? 'development build' : `v${health.version}`}`
        }
      />
      <div className="flex flex-col gap-6 md:flex-row">
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto md:w-48 md:flex-col"
          aria-label="Settings sections"
        >
          {SECTIONS.filter((section) => !section.adminOnly || user.role === 'admin').map(
            ({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
