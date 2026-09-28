import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names, letting later Tailwind classes override earlier conflicting ones. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
