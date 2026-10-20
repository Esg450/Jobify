import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface DropdownProps {
  /** Button contents, before the chevron. */
  trigger: ReactNode;
  /** Accessible name for the panel. */
  label: string;
  /** Draws a chevron after the trigger; on by default. */
  chevron?: boolean;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  children: ReactNode;
}

/** A button that opens a panel, closing on a click outside, Escape or focus leaving it. */
export function Dropdown({
  trigger,
  label,
  chevron = true,
  className,
  buttonClassName,
  panelClassName,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={cn('relative', className)}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && !root.current?.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
          buttonClassName,
        )}
      >
        {trigger}
        {chevron && (
          <ChevronDown
            className={cn(
              'ml-auto size-4 text-zinc-400 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            'absolute z-20 mt-1 rounded-lg bg-white shadow-lg dark:bg-zinc-900',
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
