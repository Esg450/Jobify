import { Star } from 'lucide-react';
import { cn } from '../lib/cn';

interface InterestRatingProps {
  value: number | null;
  /** When provided the rating is editable. Clicking the current value clears it. */
  onChange?: (value: number | null) => void;
  size?: 'sm' | 'md';
}

export function InterestRating({ value, onChange, size = 'md' }: InterestRatingProps) {
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-5';
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span
        className="inline-flex"
        aria-label={value ? `Interest ${value} of 5` : 'No interest rating'}
      >
        {stars.map((star) => (
          <Star
            key={star}
            aria-hidden
            className={cn(
              iconSize,
              star <= (value ?? 0)
                ? 'fill-amber-400 text-amber-400'
                : 'text-zinc-300 dark:text-zinc-700',
            )}
          />
        ))}
      </span>
    );
  }

  return (
    <div className="inline-flex" role="radiogroup" aria-label="Interest">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} of 5`}
          onClick={() => onChange(value === star ? null : star)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              iconSize,
              star <= (value ?? 0)
                ? 'fill-amber-400 text-amber-400'
                : 'text-zinc-300 hover:text-amber-300 dark:text-zinc-600',
            )}
          />
        </button>
      ))}
    </div>
  );
}
