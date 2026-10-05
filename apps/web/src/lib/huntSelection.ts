import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'jobify.hunt';
const listeners = new Set<() => void>();

function read(): number | null {
  try {
    return Number(sessionStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

let selected = read();

/**
 * Chooses the job hunt to look at; `null` goes back to the current one. Kept for the browser
 * session only, so a new visit always starts on the current hunt rather than an old one.
 */
export function selectHunt(id: number | null): void {
  selected = id;
  try {
    if (id === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Storage can be unavailable (e.g. private mode); the choice still holds until a reload.
  }
  for (const listener of listeners) listener();
}

/** The hunt picked with `selectHunt`, or `null` when following the current hunt. */
export function useSelectedHuntId(): number | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selected,
  );
}
