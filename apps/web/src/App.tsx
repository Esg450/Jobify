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
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { NewJobPage } from './pages/NewJobPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AccountSettings } from './pages/settings/AccountSettings';
import { AiSettings } from './pages/settings/AiSettings';
import { DataSettings } from './pages/settings/DataSettings';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { UsersSettings } from './pages/settings/UsersSettings';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/new', element: <NewJobPage /> },
      { path: 'jobs/:id', element: <JobDetailPage /> },
      { path: 'jobs/:id/edit', element: <EditJobPage /> },
      { path: 'board', element: <BoardPage /> },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="account" replace /> },
          { path: 'account', element: <AccountSettings /> },
          { path: 'ai', element: <AiSettings /> },
          { path: 'users', element: <UsersSettings /> },
          { path: 'data', element: <DataSettings /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
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
