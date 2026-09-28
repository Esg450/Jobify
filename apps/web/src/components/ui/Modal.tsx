import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** A dialog built on the native <dialog> element, which traps focus and renders above the page. */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  // Keep the native dialog in step with `open` on every render, in case the browser closed it
  // without telling us.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  });

  return (
    <dialog
      ref={dialog}
      // Escape fires `cancel`. Handle it ourselves so the parent's state stays the source of
      // truth; the native `close` event is not delivered reliably in every browser.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 text-zinc-900 shadow-xl ring-1 ring-zinc-200 backdrop:bg-zinc-950/40 backdrop:backdrop-blur-sm dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          {footer}
        </div>
      )}
    </dialog>
  );
}
