import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn('animate-spin', className ?? 'size-5')} />;
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-24 text-zinc-400" role="status" aria-label="Loading">
      <Spinner className="size-6" />
    </div>
  );
}
