import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/feedback';
import { reportError } from '../lib/reportError';

/** Shown instead of a blank page when a screen crashes. The error is sent to the server log. */
export function RouteError() {
  const error = useRouteError();

  useEffect(() => {
    if (!isRouteErrorResponse(error)) reportError(error);
  }, [error]);

  return (
    <EmptyState
      icon={<TriangleAlert className="size-6" />}
      title="Something went wrong"
      description="This page ran into a problem. It has been recorded in the Jobify log; reloading usually helps."
      action={<Button onClick={() => location.reload()}>Reload</Button>}
    />
  );
}
