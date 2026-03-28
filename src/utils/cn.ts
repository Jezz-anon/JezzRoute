import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
  // Combines class names and merges Tailwind classes for conflict resolution
  return twMerge(clsx(inputs));
 * 
 * @param inputs - List of class values to combine and merge.
 * @returns A single string of merged class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
