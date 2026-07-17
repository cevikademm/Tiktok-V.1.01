import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Marka adı — PRD/CLAUDE.md §8: parametrik (TikFinity varlıkları kopyalanmaz). */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "LiveKit";
