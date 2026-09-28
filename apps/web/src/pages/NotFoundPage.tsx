import { SearchX } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/feedback';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<SearchX className="size-6" />}
      title="Page not found"
      description="The page you were looking for does not exist."
      action={<ButtonLink to="/">Back to dashboard</ButtonLink>}
    />
  );
}
