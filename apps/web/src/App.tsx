import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { setUnauthorizedHandler } from './api/client';
import { queryKeys, useAuthStatus } from './api/hooks';
import { Layout } from './components/Layout';
import { PageSpinner } from './components/ui/Spinner';
import { BoardPage } from './pages/BoardPage';
import { DashboardPage } from './pages/DashboardPage';
import { EditJobPage } from './pages/EditJobPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { LoginPage } from './pages/LoginPage';
import { NewJobPage } from './pages/NewJobPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SettingsPage } from './pages/SettingsPage';

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
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  const queryClient = useQueryClient();
  const { data: auth, isPending } = useAuthStatus();

  useEffect(() => {
    setUnauthorizedHandler(() => void queryClient.invalidateQueries({ queryKey: queryKeys.auth }));
  }, [queryClient]);

  if (isPending) return <PageSpinner />;
  if (auth?.enabled && !auth.authenticated) return <LoginPage />;
  return <RouterProvider router={router} />;
}
