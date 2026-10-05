import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { setUnauthorizedHandler } from './api/client';
import { queryKeys, useAuthStatus } from './api/hooks';
import { Layout } from './components/Layout';
import { Alert, errorText } from './components/ui/feedback';
import { PageSpinner } from './components/ui/Spinner';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { SetupPage } from './pages/auth/SetupPage';
import { BoardPage } from './pages/BoardPage';
import { DashboardPage } from './pages/DashboardPage';
import { EditJobPage } from './pages/EditJobPage';
import { HuntsPage } from './pages/HuntsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { NewJobPage } from './pages/NewJobPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteError } from './pages/RouteError';
import { AccountSettings } from './pages/settings/AccountSettings';
import { AiSettings } from './pages/settings/AiSettings';
import { DataSettings } from './pages/settings/DataSettings';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { TimelinePage } from './pages/TimelinePage';
import { SystemSettings } from './pages/settings/SystemSettings';
import { UsersSettings } from './pages/settings/UsersSettings';

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        // Errors inside a page keep the sidebar; this nested boundary catches them.
        errorElement: <RouteError />,
        children: [
          // `hunt` marks the pages that show one hunt's jobs; see `Layout`.
          { index: true, element: <DashboardPage />, handle: { hunt: true } },
          { path: 'jobs', element: <JobsPage />, handle: { hunt: true } },
          { path: 'jobs/new', element: <NewJobPage />, handle: { hunt: true } },
          { path: 'jobs/:id', element: <JobDetailPage /> },
          { path: 'jobs/:id/edit', element: <EditJobPage /> },
          { path: 'board', element: <BoardPage />, handle: { fullWidth: true, hunt: true } },
          { path: 'timeline', element: <TimelinePage />, handle: { hunt: true } },
          { path: 'hunts', element: <HuntsPage /> },
          {
            path: 'settings',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="account" replace /> },
              { path: 'account', element: <AccountSettings /> },
              { path: 'ai', element: <AiSettings /> },
              { path: 'users', element: <UsersSettings /> },
              { path: 'data', element: <DataSettings /> },
              { path: 'system', element: <SystemSettings /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export function App() {
  const queryClient = useQueryClient();
  const { data: auth, isPending, error } = useAuthStatus();
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => void queryClient.invalidateQueries({ queryKey: queryKeys.auth }));
  }, [queryClient]);

  if (isPending) return <PageSpinner />;
  if (error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert>Could not reach the Jobify server: {errorText(error)}</Alert>
      </div>
    );
  }

  if (auth.setupRequired) return <SetupPage setupPasswordRequired={auth.setupPasswordRequired} />;
  if (!auth.user) {
    return registering && auth.registrationOpen ? (
      <RegisterPage onSignIn={() => setRegistering(false)} />
    ) : (
      <LoginPage onRegister={auth.registrationOpen ? () => setRegistering(true) : undefined} />
    );
  }
  return <RouterProvider router={router} />;
}
